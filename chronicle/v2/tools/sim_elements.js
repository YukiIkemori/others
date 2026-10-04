#!/usr/bin/env node
// sim_elements（BATTLE / RULES）: 属性の釣り合い（持ち主 2026-10-04「炎魔法強すぎて他を覚える必要性が感じられない。炎弱点のボス多すぎる」）。
//
//   node v2/tools/sim_elements.js [--n 40] [--seed 20261004] [--static] [--quick] [--json]
//
// 1. 数え（静的）: 魔物（R.DB.monsters）の属性ごとの弱点（倍率 > 1）・耐性（0 < 倍率 < 1）・無効（0）・吸収（< 0）の数。全体とボス（flags に boss）。
//    合格: どの属性の弱点の数も、6 属性の中央値の 1.5 倍まで。火を無効・吸収する魔物 ≥ 10（うちボス ≥ 3）。ボスの火の弱点 ≤ 10。
//    参考: 各地方の出現表の魔物に対し、その属性だけで打ったときの倍率の平均（「その属性 1 本で足りるか」）。
// 2. 戦い（sim）: 標準の一行（sim_zones の buildParty: 主人公・バルトロ・マルタ・シルヴァン）の後列 2 人の攻めの術を、
//    「火だけ」「水だけ」…「混ぜ（2 人で 6 属性）」に差し替えて（回復・補助の術はそのまま、熟練度はそろえる）、
//    代表の出現表（雑魚）とボス（sim_bosses の台本）で戦う。雑魚は平均ラウンド・MP の使用、ボスは台本の勝率・平均ラウンド。
//    合格: 「混ぜ」が「火だけ」以上（ボスの勝率の平均が上、または雑魚のラウンドが短い）、かつ「火だけ」が単属性の中で頭一つ抜けていない
//    （ボスの勝率の平均で、火だけ − 単属性の 2 番目 ≤ 5 ポイント）。
'use strict';

const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const isBoss = (m) => !!(m && (m.bossType || (m.flags || []).includes('boss')));

/** 魔物の属性の数え。filter(id, m) → {el: {weak, res, nul, abs}} */
function countElems(R, filter) {
  const o = {};
  for (const e of EL) o[e] = { weak: 0, res: 0, nul: 0, abs: 0 };
  for (const [id, m] of Object.entries(R.DB.monsters)) {
    if (/^stub_/.test(id) || (filter && !filter(id, m))) continue;
    const el = m.elem || {};
    for (const e of EL) {
      const v = el[e];
      if (v == null) continue;
      if (v > 1) o[e].weak++;
      else if (v < 0) o[e].abs++;
      else if (v === 0) o[e].nul++;
      else if (v < 1) o[e].res++;
    }
  }
  return o;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

/** 静的な合否（tools/test_battle.js からも使う） */
function staticChecks(R) {
  const all = countElems(R), boss = countElems(R, (id, m) => isBoss(m));
  const weak = EL.map((e) => all[e].weak), med = median(weak), mx = Math.max(...weak);
  const fireProof = Object.entries(R.DB.monsters).filter(([id, m]) => !/^stub_/.test(id) && m.elem && m.elem.fire != null && m.elem.fire <= 0);
  const fireProofBoss = fireProof.filter(([, m]) => isBoss(m));
  const checks = [
    { ok: mx <= med * 1.5, msg: `max weak ${mx} ≤ 1.5 × median ${med} (${(med * 1.5).toFixed(1)})` },
    { ok: fireProof.length >= 10, msg: `fire null/absorb monsters ${fireProof.length} ≥ 10` },
    { ok: fireProofBoss.length >= 3, msg: `fire null/absorb bosses ${fireProofBoss.length} ≥ 3 (${fireProofBoss.map(([id]) => id).join(', ')})` },
    { ok: boss.fire.weak <= 10, msg: `bosses weak to fire ${boss.fire.weak} ≤ 10` },
  ];
  return { all, boss, checks, fireProof: fireProof.map(([id]) => id) };
}

/** 出現表の魔物（系統はティアで解く）に、属性 e だけで打ったときの倍率の平均（無効・吸収は 0 として数える） */
function zoneCoverage(R, zone, tier, els) {
  const z = R.DB.encounters[zone];
  if (!z) return null;
  let s = 0, n = 0;
  for (const g of z.groups || []) for (const [mid, lo, hi] of g.mons || []) {
    let id = mid;
    try { if (/^@/.test(mid)) id = R.Mon.resolve(mid, tier); } catch (e) { id = null; }
    const m = id && R.DB.monsters[id];
    if (!m) continue;
    const k = ((lo || 1) + (hi || lo || 1)) / 2;
    const best = Math.max(...els.map((e) => { const v = (m.elem || {})[e]; return v == null ? 1 : Math.max(0, v); }));
    s += best * k * (g.w || 1); n += k * (g.w || 1);
  }
  return n ? s / n : null;
}

// ---------------------------------------------------------------- 戦い
/** 後列 2 人（marta・sylvain）の攻めの術の組み */
const PROFILES = {
  fire: [['fire'], ['fire']],
  water: [['water'], ['water']],
  wind: [['wind'], ['wind']],
  earth: [['earth'], ['earth']],
  dark: [['dark'], ['dark']],
  mixed: [['fire', 'water', 'light'], ['wind', 'earth', 'dark']],
};
const ZONES = [
  ['zw_forest', 0], ['z_elder', 0], ['zw_desert', 1], ['z_desert_tomb', 1], ['zw_snow', 1], ['z_snow_peak', 1], ['zw_marsh', 1], ['z_marsh_manor', 1],
  ['zw_ash', 3], ['z_ash_volcano', 1], ['zw_isles', 3], ['z_r_isles_ship', 3], ['zw_mine', 3], ['z_mine_vein', 3], ['zw_star', 3], ['z_r_star_tower', 3],
  ['z_finale_archive_lo', 8],
];
const BOSS_KEYS = ['tr_b_rooteater', 'tr_b_sandworm@1', 'tr_b_sandking@1', 'tr_b_icegiant@1', 'tr_b_whitedragon@1', 'tr_b_mistbeast@1', 'tr_b_hellhound@3',
  'tr_b_lavabeast@3', 'tr_b_octopus@3', 'tr_b_captain@3', 'tr_b_rockeater@3', 'tr_b_ironwarden@3', 'tr_b_stareater@3', 'tr_b_frost_admiral@6', 'tr_b_bookgolem@8', 'tr_b_lazaro@8'];

const isDamage = (a) => !!(a && (a.effects || []).some((e) => e.type === 'damage' && e.on !== 'allies'));
function applyProfile(R, party, prof, tier) {
  const casters = party.filter((c) => c.id === 'marta' || c.id === 'sylvain');
  const lvCap = tier + 2;
  casters.forEach((c, i) => {
    const els = prof[i];
    c.spells = (c.spells || []).filter((id) => !isDamage(R.DB.spells[id]));
    for (const id of Object.keys(R.DB.spells)) {
      const a = R.DB.spells[id];
      if (a.elements.length === 1 && els.includes(a.elements[0]) && isDamage(a) && a.glim.lv <= lvCap) c.spells.push(id);
    }
    const P = Math.max(...EL.map((e) => (c.eprof || {})[e] || 0));
    c.eprof = c.eprof || {};
    for (const e of EL) c.eprof[e] = P;   // 熟練度はそろえる（得意・不得意で差が出ないように）
    const st = R.Rules.stats(c); c.hp = st.maxHp; c.mp = st.maxMp;
  });
  return party;
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function runZones(R, prof, n, seed) {
  const { buildParty, STD } = require('./sim_zones');
  const out = {};
  for (const [zone, tier] of ZONES) {
    if (!R.DB.encounters[zone]) continue;
    const party = applyProfile(R, buildParty(R, { seed: 7, tier, kind: 'party', members: STD }), PROFILES[prof], tier);
    for (const c of party) c.mp = Math.round(R.Rules.stats(c).maxMp * 0.6);
    const rounds = [], mp = [], hp = [];
    let win = 0, k = 0;
    for (let i = 0; i < n; i++) {
      const s = R.BattleCore.simulate({ party, zone, tier, seed: `${seed}:${zone}:${i}`, inv: { i_potion: 5, i_antidote: 2 }, maxRounds: 30 });
      if (s.result === 'none') continue;
      k++; if (s.result === 'win') win++;
      rounds.push(s.rounds); mp.push(s.mpUsed); hp.push(s.hpLossPct);
    }
    out[zone] = { win: (100 * win) / Math.max(1, k), rounds: mean(rounds), mp: mean(mp), hp: mean(hp) };
  }
  return out;
}
function runBosses(R, prof, n, seed) {
  const { buildParty } = require('./sim_zones');
  const { BOSSES, ITEMS } = require('./sim_bosses');
  const out = {};
  for (const key of BOSS_KEYS) {
    const cfg = BOSSES[key];
    if (!cfg) continue;
    const troop = cfg.troop || key;
    const items = cfg.items || ITEMS;
    const party = applyProfile(R, buildParty(R, Object.assign({ seed: 5, items }, cfg)), PROFILES[prof], cfg.tier);
    let win = 0;
    const rounds = [];
    for (let i = 0; i < n; i++) {
      const s = R.BattleCore.simulate({ party, troop, tier: cfg.tier, seed: `${seed}:${troop}:script:${i}`, inv: items, maxRounds: 40, ai: R.BattleAI.styleAI('script') });
      if (s.result === 'win') win++;
      rounds.push(s.rounds);
    }
    out[key] = { win: (100 * win) / n, rounds: mean(rounds) };
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const n = +arg('--n', argv.includes('--quick') ? 16 : 40);
  const seed = arg('--seed', '20261004');
  const R = require('./lib/load')({ quiet: true });
  let fails = 0;
  const S = staticChecks(R);
  console.log('sim_elements: 魔物の属性（weak > 1 / res 0〜1 / null 0 / abs < 0）');
  console.log('elem    all: weak  res  null  abs   | boss: weak  res  null  abs');
  for (const e of EL) {
    const a = S.all[e], b = S.boss[e];
    console.log(`${e.padEnd(6)}      ${String(a.weak).padStart(4)} ${String(a.res).padStart(4)} ${String(a.nul).padStart(5)} ${String(a.abs).padStart(4)}   |       ${String(b.weak).padStart(4)} ${String(b.res).padStart(4)} ${String(b.nul).padStart(5)} ${String(b.abs).padStart(4)}`);
  }
  for (const c of S.checks) { console.log((c.ok ? 'PASS ' : 'FAIL ') + c.msg); if (!c.ok) fails++; }
  console.log('\n出現表ごと、その属性 1 本で打ったときの倍率の平均（無効・吸収は 0）');
  console.log('zone                     T  ' + EL.map((e) => e.padStart(6)).join('') + '   mixed');
  const cov = {};
  for (const [zone, T] of ZONES) {
    const row = EL.map((e) => zoneCoverage(R, zone, T, [e]));
    if (row[0] == null) continue;
    const mixed = zoneCoverage(R, zone, T, EL);
    EL.forEach((e, i) => { (cov[e] = cov[e] || []).push(row[i]); });
    (cov.mixed = cov.mixed || []).push(mixed);
    console.log(`${zone.padEnd(24)} ${String(T).padStart(1)}  ${row.map((v) => v.toFixed(2).padStart(6)).join('')}   ${mixed.toFixed(2)}`);
  }
  console.log(`${'mean'.padEnd(26)} ${EL.map((e) => mean(cov[e]).toFixed(2).padStart(6)).join('')}   ${mean(cov.mixed).toFixed(2)}`);
  const result = { static: S, coverage: Object.fromEntries(Object.entries(cov).map(([k, v]) => [k, mean(v)])) };
  if (!argv.includes('--static')) {
    console.log(`\n戦い（後列 2 人の攻めの術を差し替え）: n=${n}`);
    console.log('profile   mobs: rounds  MP used  HP loss | bosses: script win%  rounds');
    const rows = {};
    for (const p of Object.keys(PROFILES)) {
      const z = runZones(R, p, n, seed), b = runBosses(R, p, n, seed);
      const zr = Object.values(z), br = Object.values(b);
      rows[p] = { mobRounds: mean(zr.map((x) => x.rounds)), mobMp: mean(zr.map((x) => x.mp)), mobHp: mean(zr.map((x) => x.hp)), bossWin: mean(br.map((x) => x.win)), bossRounds: mean(br.map((x) => x.rounds)), zones: z, bosses: b };
      const r = rows[p];
      console.log(`${p.padEnd(8)}        ${r.mobRounds.toFixed(2).padStart(5)}  ${r.mobMp.toFixed(1).padStart(7)}  ${r.mobHp.toFixed(1).padStart(7)} |               ${r.bossWin.toFixed(1).padStart(5)}  ${r.bossRounds.toFixed(2).padStart(6)}`);
    }
    if (argv.includes('--detail')) {
      for (const k of BOSS_KEYS) console.log(k.padEnd(22), Object.keys(PROFILES).map((p) => `${p} ${rows[p].bosses[k] ? rows[p].bosses[k].win.toFixed(0).padStart(3) : '  —'}%/${rows[p].bosses[k] ? rows[p].bosses[k].rounds.toFixed(1) : '—'}`).join('  '));
      for (const [zz] of ZONES) if (rows.fire.zones[zz]) console.log(zz.padEnd(22), Object.keys(PROFILES).map((p) => `${p} ${rows[p].zones[zz].rounds.toFixed(2)}r`).join('  '));
    }
    const singles = ['fire', 'water', 'wind', 'earth', 'dark'].map((p) => [p, rows[p].bossWin]).sort((a, b) => b[1] - a[1]);
    const second = singles.find(([p]) => p !== 'fire')[1];
    const c1 = rows.mixed.bossWin >= rows.fire.bossWin || rows.mixed.mobRounds <= rows.fire.mobRounds;
    const c2 = rows.fire.bossWin - second <= 5;
    console.log((c1 ? 'PASS ' : 'FAIL ') + `mixed ≥ fire-only (boss win ${rows.mixed.bossWin.toFixed(1)} vs ${rows.fire.bossWin.toFixed(1)}, mob rounds ${rows.mixed.mobRounds.toFixed(2)} vs ${rows.fire.mobRounds.toFixed(2)})`);
    console.log((c2 ? 'PASS ' : 'FAIL ') + `fire-only not clearly best among singles (fire ${rows.fire.bossWin.toFixed(1)} − next ${second.toFixed(1)} ≤ 5; order ${singles.map(([p, v]) => p + ' ' + v.toFixed(1)).join(' > ')})`);
    if (!c1) fails++;
    if (!c2) fails++;
    result.battle = rows;
  }
  if (argv.includes('--json')) console.log(JSON.stringify(result));
  if (fails) process.exitCode = 1;
  return result;
}

module.exports = { staticChecks, countElems, zoneCoverage, PROFILES, applyProfile, isBoss };
if (require.main === module) main();
