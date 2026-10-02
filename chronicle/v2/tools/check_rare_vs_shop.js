#!/usr/bin/env node
// check_rare_vs_shop（RULES）: レアの品（★。等級 rare・super）が、手に入るときに店で買える同じ種類の品よりはっきり強いか。
//   持ち主 2026-10-02「店の装備は最低限（ティアの進みについていける分だけ。店は強くしない）。足りない分はレアのドロップと盗みで埋める」→
//   宝箱・レアのドロップ・盗みの ★ の装備は、同じ時点（同じ地方・ティア）で店に並ぶ品より強くないといけない（P29: 砂の王の墓の ★朝露の弓 < カシムの弓）。
//
//   node tools/check_rare_vs_shop.js [--verbose]     違反があれば終了コード 1
//
// 比べ方:
//   店の天井: ティア T で、どこかの店（R.Rules.shopItems(id, T)）に並ぶ同じ種類の品のいちばん強い物。終章の都の店（shop_biblia*）は T8 だけ。
//     武器は系統（wtype）ごと（杖は素の術力、ほかは攻撃力 × physPct）、防具は枠 × 重さごと（守備力 + 魔法防御）。アクセサリは比べない（効き目が品ごとに違う）。
//     カシムの武具の屋台・フェルンの行商・鷹団の店などは T+1 の武器を並べるので、武器の天井はたいてい T+1 の段。
//   レアの品の出どころと、そのときのティア:
//     宝箱のプール p_rare・p_boss・p_super（開けたときのティア T = 0〜8）
//     魔物のレア・スーパーレアのドロップと盗み専用（出現表の地方ごと。序章・森は T0、ほかの 7 地方は T1〜T7、終章 T8、クリア後 T9）
//       … 地方のボス（bossTroop）とレア魔物（rareEncounters）も同じ地方のティア
//     決まった宝箱の伸びる一品物（u_*。開けたティアの値。R.Rules.fillItem(it, {tier})）
//   合格: レアの値 ≥ 店の天井 × MARGIN（1.05）
'use strict';

const MARGIN = 1.05;
const ARMOR = ['shield', 'head', 'body', 'hands', 'feet'];

function loadR() { return require('./lib/load')({ quiet: true }); }

function check(R) {
  const DB = R.DB, Ru = R.Rules;
  const isGear = (it) => it && (it.slot === 'weapon' || ARMOR.includes(it.slot));
  const keyOf = (it) => (it.slot === 'weapon' ? 'w:' + it.wtype : it.slot + ':' + (it.weight || 'light'));
  // 武器の力: 杖は術力（回復にも効く素の値。店の杖の magicPct +10 は攻撃の術だけなので入れない）、
  //   ほかは攻撃力 × (1 + physPct/100)（狂い咲きの大剣の +50% のような品の効き目も入れる）。防具は 守備力 + 魔法防御
  const pct = (it, k) => 1 + (((it.mods || {})[k]) || 0) / 100;
  const power = (it) => (it.slot === 'weapon' ? Math.round(it.wtype === 'staff' ? (it.mag || 0) : (it.atk || 0) * pct(it, 'physPct'))
    : (it.def || 0) + (it.mdef || 0));
  const lateShop = (id) => /^shop_biblia/.test(id);

  // ---- 店の天井 ceil[T][key] = {v, id}
  const ceil = [];
  for (let T = 0; T <= 9; T++) {
    const row = {};
    for (const sid of Object.keys(DB.shops)) {
      if (lateShop(sid) && T < 8) continue;
      for (const id of Ru.shopItems(sid, Math.min(T, 8))) {
        const it = Ru.itemOf ? Ru.itemOf(id) : DB.items[id];
        if (!isGear(it) || (it.grade || 'normal') !== 'normal') continue;
        const k = keyOf(it), v = power(it);
        if (!row[k] || v > row[k].v) row[k] = { v, id, shop: sid };
      }
    }
    ceil.push(row);
  }

  // ---- 地方 → そのティアの幅
  const reach = (rid, z) => {
    if (z && typeof z.tier === 'number') return [z.tier];
    if (rid === 'prologue' || rid === 'r_forest') return [0];
    if (rid === 'finale') return [8];
    if (rid === 'postgame') return [9];
    return [1, 2, 3, 4, 5, 6, 7];
  };

  const rows = [];   // {src, where, T, item, v, shop, sv}
  const seen = new Set();
  const test = (src, where, T, id, it) => {
    it = it || DB.items[id];
    if (!isGear(it) || !['rare', 'super'].includes(it.grade)) return;
    const c = ceil[Math.min(9, T)][keyOf(it)];
    if (!c) return;
    const v = power(it);
    const key = `${src}|${where}|${id}|${T}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ src, where, T, item: id, name: it.name, v, shop: c.id, shopName: (DB.items[c.id] || {}).name, sv: c.v, ok: v >= c.v * MARGIN });
  };

  // ---- 宝箱のプール
  for (const pid of ['p_rare', 'p_boss', 'p_super']) {
    const P = DB.pools[pid];
    if (!P) continue;
    for (let T = 0; T <= 8; T++) for (const e of P.tiers[T] || []) if (e.item) test('chest', pid, T, e.item);
  }

  // ---- 魔物（出現表・レア魔物・地方のボス）
  const monItems = (d) => {
    const dr = (d && d.drops) || {};
    return ['rare', 'super', 'steal'].map((s) => dr[s] && dr[s].item && { s, item: dr[s].item }).filter(Boolean);
  };
  for (const [zid, z] of Object.entries(DB.encounters)) {
    if (!z || !z.groups || !z.region) continue;
    for (const T of reach(z.region, z)) {
      for (const g of z.groups) {
        if ((g.tierMin != null && T < g.tierMin) || (g.tierMax != null && T > g.tierMax)) continue;
        for (const e of g.mons || []) {
          const ref = Array.isArray(e) ? e[0] : e && (e.ref || e.id || e);
          const m = typeof ref === 'string' && ref[0] === '@' ? R.Mon.resolve(ref, T) : ref;
          for (const x of monItems(DB.monsters[m])) test(x.s === 'steal' ? 'steal' : 'drop', `${zid}:${m}`, T, x.item);
        }
      }
    }
  }
  for (const [zid, list0] of Object.entries(DB.rareEncounters || {})) {
    const z = DB.encounters[zid];
    if (!z || !z.region) continue;
    for (const r of [].concat(list0)) for (const T of reach(z.region, z)) for (const x of monItems(DB.monsters[r && r.mon])) test(x.s === 'steal' ? 'steal' : 'drop', `${zid}:${r.mon}`, T, x.item);
  }
  for (const [rid, reg] of Object.entries(DB.regions)) {
    const tr = reg.bossTroop && DB.troops[reg.bossTroop];
    if (!tr) continue;
    const mons = (tr.mons || tr.members || []).map((x) => (typeof x === 'string' ? x : Array.isArray(x) ? x[0] : x && (x.id || x.mon)));
    for (const m0 of mons) for (const T of reach(rid)) { const m = typeof m0 === 'string' && m0[0] === '@' ? R.Mon.resolve(m0, T) : m0; for (const x of monItems(DB.monsters[m])) test(x.s === 'steal' ? 'steal' : 'drop', `${reg.bossTroop}:${m}`, T, x.item); }
  }

  // ---- 決まった宝箱（伸びる一品物は開けたティアの値。決まった数値の ★ はその品のまま）
  for (const [mid, m] of Object.entries(DB.maps || {})) {
    for (const o of m.objects || []) {
      if (!o || o.type !== 'chest' || !o.item) continue;
      const it = DB.items[o.item];
      if (!isGear(it)) continue;
      for (const T of reach(m.region)) test('chest', `${mid}:${o.id}`, T, o.item, it.grow === 'tier' ? Ru.fillItem(Object.assign({}, it), { tier: T }) : it);
    }
  }
  return rows;
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const R = loadR();
  const rows = check(R);
  const bad = rows.filter((r) => !r.ok);
  console.log(`check_rare_vs_shop: ★ の装備の出どころ ${rows.length} 件（品 ${new Set(rows.map((r) => r.item)).size}）、店の天井 × ${MARGIN} 未満 ${bad.length} 件`);
  const show = verbose ? rows : bad;
  for (const r of show) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} T${r.T} ${r.src.padEnd(5)} ${r.where.padEnd(34)} ${r.item}（${r.name}）${r.v}  vs 店 ${r.shop}（${r.shopName}）${r.sv}`);
  }
  if (bad.length) process.exitCode = 1;
}

module.exports = { check, MARGIN };
if (require.main === module) main();
