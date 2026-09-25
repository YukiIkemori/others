#!/usr/bin/env node
// gear-b（A10b）の検査と数の報告: 店の品数（ティアごと）、宝箱のプールの期待値と抽選のかたより、
// ほかの担当のファイルからの参照（道具・大事なもの・店・プールの id、旧案の id）。
//
//   node tools/check_gear-b.js                  報告（ほかの担当への参照の食い違いは警告。自分のデータの誤りは exit 1）
//   node tools/check_gear-b.js --write-fixture  tools/fixtures/gear-b/stub_gear.js を DESIGN.md から作り直す
//   node tools/check_gear-b.js --no-stub        仮の装備を読まない
//   node tools/check_gear-b.js --seed 7         抽選の種（既定 1）
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);

if (argv.includes('--write-fixture')) {
  const r = require('./fixtures/gear-b/lib/gen_stub')();
  console.log(`wrote ${path.relative(ROOT, r.file)}: 系列 ${r.lines}・補助のアクセサリ ${r.charms}・帯のレア品 ${r.band}（${(r.bytes / 1024).toFixed(1)} KB）`);
  process.exit(0);
}
const NO_STUB = argv.includes('--no-stub');
const SEED = argv.includes('--seed') ? +argv[argv.indexOf('--seed') + 1] : 1;
const R = require('./lib/load')({ quiet: true, extra: NO_STUB ? [] : [path.join(ROOT, 'tools/fixtures/gear-b/stub_gear.js')] });
const DB = R.DB;
let errors = 0, warns = 0;
const err = (s) => { errors++; console.log('  ERROR ' + s); };
const warn = (s) => { warns++; console.log('  WARN  ' + s); };
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += ch.charCodeAt(0) < 0x100 ? 1 : 2; return s + ' '.repeat(Math.max(0, n - w)); };

// ------------------------------------------------------------------ 参照の実装（§3.3.5）
const condOk = (cond, st) => !cond || Object.entries(cond).every(([k, v]) => (k === 'postgame' ? !!st.postgame === !!v : k === 'cleared' ? st.cleared.includes(v) : true));
function shopItems(shop, st) {
  const steps = (shop.stock || []).filter((s) => s.tier <= st.tier && condOk(s.cond, st));
  return [...(shop.items || []), ...(shop.keepOld ? steps.flatMap((s) => s.items) : (steps.length ? steps[steps.length - 1].items : []))];
}

// ------------------------------------------------------------------ 1. 数
const mine = Object.entries(DB.items).filter(([id]) => /^[ik]_/.test(id));
const cons = mine.filter(([, it]) => it.type === 'consumable'), keys = mine.filter(([, it]) => it.type === 'key');
console.log(`== gear-b のデータ（種 ${SEED}、仮の装備 ${Object.values(DB.items).filter((i) => i._stub).length} 品）`);
console.log(`道具 ${cons.length}（店 ${cons.filter(([, i]) => i.src === 'shop').length}・宝箱/ボス ${cons.filter(([, i]) => i.src === 'drop').length}・レア魔物 ${cons.filter(([, i]) => i.src === 'relic').length}）、大事なもの ${keys.length}、店 ${Object.keys(DB.shops).length}、プール ${Object.keys(DB.pools).length}`);
if (cons.length !== 58) err(`道具が ${cons.length}`);
if (keys.length !== 18) err(`大事なものが ${keys.length}`);
if (Object.keys(DB.shops).length !== 34) err(`店が ${Object.keys(DB.shops).length}`);
if (Object.keys(DB.pools).length !== 10) err(`プールが ${Object.keys(DB.pools).length}`);

// ------------------------------------------------------------------ 2. 店の品数
console.log('\n== 店の品数（固定品を含む。T0 / T3 / T8 / クリア後 / 坑道クリア後）');
const ST = (tier, o) => Object.assign({ tier, postgame: false, cleared: [] }, o || {});
for (const [id, s] of Object.entries(DB.shops)) {
  const n = (st) => shopItems(s, st).length;
  const cols = [n(ST(0)), n(ST(3)), n(ST(8)), n(ST(8, { postgame: true })), n(ST(3, { cleared: ['r_mine'] }))];
  const missing = new Set();
  for (const st of [ST(0), ST(3), ST(8), ST(8, { postgame: true }), ST(3, { cleared: ['r_mine'] })]) for (const i of shopItems(s, st)) if (!DB.items[i]) missing.add(i);
  console.log(`  ${pad(id, 15)} ${pad(s.name, 18)} ${pad(s.kind, 8)} ${cols.map((c) => String(c).padStart(3)).join(' ')}` + (missing.size ? `  （まだ無い品 ${missing.size}）` : ''));
}
// §8.16-2: 町の防具屋 20〜36 品（ファロスとビブリアは 36〜38）
for (const [id, s] of Object.entries(DB.shops)) if (s.kind === 'armor') {
  const n = shopItems(s, ST(3)).length;
  if (/^(lute|biblia)_/.test(id) ? n !== 38 : n > 36) warn(`${id} の T3 の品数 ${n}（§8.16-2 の目安の外）`);
}

// ------------------------------------------------------------------ 3. 宝箱の期待値
const value = (e) => (e.gold ? e.gold : (DB.items[e.item] ? (DB.items[e.item].price || 0) : 0) * (e.n || 1));
const ev = (list) => { const W = list.reduce((a, e) => a + e.w, 0); return list.reduce((a, e) => a + value(e) * e.w, 0) / W; };
console.log('\n== 宝箱 1 つの期待値（買値の合計。ゴールド）');
const PIDS = Object.keys(DB.pools);
console.log('  ' + pad('T', 3) + PIDS.map((p) => pad(p.replace('p_', ''), 9)).join(''));
for (let T = 0; T < 10; T++) console.log('  ' + pad(T, 3) + PIDS.map((p) => pad(Math.round(ev(DB.pools[p].tiers[T])), 9)).join(''));
// ダンジョンの 1 階（宝箱 4 つ。p_supply 5 割・p_gear 2 割・p_gold 2 割・p_stone 1 割。§8.12.4）と、1 地方の収入の目安（§4.15）
const INCOME = [2800, 6400, 11500, 18300, 26600, 36500, 47900, 61000, 75600];
console.log('\n== ダンジョンの 1 階（宝箱 4 つ）の期待値 と §4.15 の 1 地方の戦闘の収入');
for (let T = 0; T < 9; T++) {
  const floor = 4 * (0.5 * ev(DB.pools.p_supply.tiers[T]) + 0.2 * ev(DB.pools.p_gear.tiers[T]) + 0.2 * ev(DB.pools.p_gold.tiers[T]) + 0.1 * ev(DB.pools.p_stone.tiers[T]));
  const gold = 4 * 0.2 * DB.pools.p_gold.tiers[T][0].gold;
  console.log(`  T${T}: 品と金 ${Math.round(floor)} G（うち現金 ${Math.round(gold)} G）、6 階ぶん ${Math.round(floor * 6)} G ＝ 収入 ${INCOME[T]} G の ${(100 * floor * 6 / INCOME[T]).toFixed(0)}%`);
}

// ------------------------------------------------------------------ 4. 抽選（重みどおりに出るか）
function U() { let a = SEED >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = U();
const pickW = (list) => { let W = 0; for (const e of list) W += e.w; let x = rnd() * W; for (const e of list) { x -= e.w; if (x < 0) return e; } return list[list.length - 1]; };
const useChest = !!(R.Tier && R.Tier.chest);
console.log(`\n== 抽選 60000 回ずつ（${useChest ? 'R.Tier.chest' : '参照の重み付き抽選'}）: 品ごとの出た率と重みの率のずれ（最大の z と、期待 1000 回以上の品の最大の相対のずれ）`);
for (const pid of ['p_supply', 'p_rare', 'p_gear', 'p_boss', 'p_stone']) {
  const line = [];
  for (const T of [0, 4, 8]) {
    const list = DB.pools[pid].tiers[T]; if (!list.length) { line.push(`T${T} 空`); continue; }
    const cnt = new Map();
    const N = 60000;
    for (let k = 0; k < N; k++) {
      let e;
      if (useChest) {
        const saved = R.Game;
        try { R.Game = Object.assign({}, saved || {}, { chests: {}, tier: T }); const r = R.Tier.chest({ id: 'gearb_x', pool: pid, tier: T }, {}); e = list.find((x) => x.item === r.item && (x.n || 1) === (r.n || 1)) || list.find((x) => x.item === r.item); }
        catch (x) { e = pickW(list); } finally { R.Game = saved; }
      } else e = pickW(list);
      if (!e) { err(`${pid} T${T}: 抽選がプールに無い物を返した`); break; }
      cnt.set(e, (cnt.get(e) || 0) + 1);
    }
    const W = list.reduce((a, e) => a + e.w, 0);
    let zmax = 0, rel = 0;
    for (const e of list) {
      const p = e.w / W, q = (cnt.get(e) || 0) / N;
      zmax = Math.max(zmax, Math.abs(q - p) / Math.sqrt(p * (1 - p) / N));
      if (p * N >= 1000) rel = Math.max(rel, Math.abs(q - p) / p);
    }
    if (zmax > 4.5) err(`${pid} T${T} の抽選が重みからずれた（z ${zmax.toFixed(1)}）`);
    line.push(`T${T} ${list.length} 品 z≤${zmax.toFixed(1)}・${(rel * 100).toFixed(1)}%`);
  }
  console.log(`  ${pad(pid, 11)} ${line.join('、')}`);
}
// p_rare の中身の割合
console.log('\n== p_rare（ダンジョンに 1 つ）の中身の割合');
for (const T of [0, 2, 4, 6, 8, 9]) {
  const l = DB.pools.p_rare.tiers[T], W = l.reduce((a, e) => a + e.w, 0);
  const gear = l.filter((e) => DB.items[e.item] && DB.items[e.item].type !== 'consumable').reduce((a, e) => a + e.w, 0);
  const seeds = l.filter((e) => /^i_seed_/.test(e.item)).reduce((a, e) => a + e.w, 0);
  console.log(`  T${T}: 帯${[1, 1, 3, 3, 5, 5, 7, 7, 9, 9][T]} のレア装備 ${(100 * gear / W).toFixed(0)}%・実 ${(100 * seeds / W).toFixed(0)}%・レアの道具 ${(100 * (W - gear - seeds) / W).toFixed(0)}%`);
}

// ------------------------------------------------------------------ 5. ほかの担当のファイルからの参照
console.log('\n== ほかの担当からの参照');
const OLD = { i_herb: 'i_salve', i_herb2: 'i_potion', i_revive2: 'i_phoenix', i_eyedrop: 'i_clear', i_fruit_hp: 'i_seed_hp', i_fruit_mp: 'i_seed_mp', i_fruit_wp: 'i_seed_wp', p_seed: '（無し。§8.0 の 0.6）' };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const srcFiles = walk(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'));
const MY = new Set(['items_use.js', 'items_key.js', 'shops.js', 'pools.js']);
const refs = { i: new Set(), k: new Set(), p: new Set(), shop: new Set() };
for (const f of srcFiles) {
  if (MY.has(path.basename(f))) continue;
  const code = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
  const rel = path.relative(ROOT, f);
  for (const [o, n] of Object.entries(OLD)) if (new RegExp(`['"\`]${o}['"\`]`).test(code)) warn(`${rel}: 旧案の id ${o}（→ ${n}）`);
  for (const m of code.matchAll(/['"`](i_[a-z0-9_]+)['"`]/g)) refs.i.add(m[1] + '\t' + rel);
  for (const m of code.matchAll(/['"`](k_[a-z0-9_]+)['"`]/g)) refs.k.add(m[1] + '\t' + rel);
  for (const m of code.matchAll(/pool\s*:\s*['"`]([a-z0-9_]+)['"`]/g)) refs.p.add(m[1] + '\t' + rel);
  for (const m of code.matchAll(/shop\s*:\s*['"`]([a-z0-9_]+)['"`]/g)) refs.shop.add(m[1] + '\t' + rel);
}
const report = (set, ok, what) => {
  const bad = [...set].filter((s) => !ok(s.split('\t')[0]));
  for (const s of bad) warn(`${s.split('\t')[1]}: 無い${what} ${s.split('\t')[0]}`);
  console.log(`  ${what}の参照 ${set.size}（ファイル × id）、無いもの ${bad.length}`);
};
report(refs.i, (id) => !!DB.items[id] || /^i_stone_$|^i_seed_$|^i_$/.test(id), '道具');
report(refs.k, (id) => !!DB.items[id] || /^k_page_$|^k_$/.test(id), '大事なもの');
report(refs.p, (id) => !!DB.pools[id], 'プール');
report(refs.shop, (id) => !!DB.shops[id], '店');
// 大事なものがどこかで渡されるか（イベントの meta.gives か ev.give の文字列）
const given = new Set([...refs.k].map((s) => s.split('\t')[0]));
const notGiven = keys.map(([id]) => id).filter((id) => !given.has(id) && !(id.startsWith('k_page_') && Object.values(DB.regions || {}).some((r) => r.fragment === id)));
console.log(`  大事なもの 18 のうち、ほかの担当のファイルに出てこないもの ${notGiven.length}${notGiven.length ? '（' + notGiven.join(' ') + '。物語・地方の担当がまだ）' : ''}`);
// 店の NPC とマップ
const placed = new Set([...refs.shop].map((s) => s.split('\t')[0]));
const unplaced = Object.keys(DB.shops).filter((id) => !placed.has(id));
console.log(`  店 34 のうち、店の NPC がまだ置かれていないもの ${unplaced.length}${unplaced.length && unplaced.length <= 8 ? '（' + unplaced.join(' ') + '）' : ''}`);

// ------------------------------------------------------------------ 6. 宝箱の置き方（§8.12.4・§8.12.1。地方・ワールド・物語の担当のマップ）
// ダンジョン 1 階 3〜5 個（p_rare はダンジョンに 1 つ。大書庫・忘却の底は各階に 1 つ）、町 0〜2 個（p_supply か p_gold）、
// ファロス灯台は各階 1〜2 個（p_supply。2 階に p_gear を 1 つ）。固定の中身の宝箱は作らない。大書庫の chestTier 8・忘却の底 9。
console.log('\n== 宝箱の置き方（§8.12.4。ほかの担当のマップ）');
{
  const maps = Object.entries(DB.maps || {});
  const DUNGEON_POOLS = new Set(['p_supply', 'p_gear', 'p_weapon', 'p_armor', 'p_acc', 'p_gold', 'p_stone', 'p_rare']);
  // 隠し通路の先の宝箱（§10.6.4。BRIEF Part A4 で足した）: その階の数と灯台の中身の決まりに上乗せしてよい。
  // p_rare はそのダンジョン（大書庫・忘却の底はその階）の 1 つを隠し通路の先に置くだけなので、数は変わらない
  const SECRET = { lighthouse_2: ['p_supply', 'p_gold'], verda_maze_2: ['p_gear'], elder_tree_1: ['p_supply'], frost_peak_2: ['p_gold'],
    tide_cave_1: ['p_supply'], ash_volcano_2: ['p_gear', 'p_gold'], stargaze_3: ['p_supply'], archive_4: ['p_supply'] };
  const byLoc = {};
  let n = 0;
  for (const [mid, m] of maps) {
    const cs = m.chests || [];
    n += cs.length;
    for (const c of cs) {
      if (c.item) warn(`${mid} ${c.id}: 固定の中身の宝箱（item ${c.item}。§8.12.1 はプールだけ）`);
      if (c.id && !c.id.startsWith(mid + '_c')) warn(`${mid} ${c.id}: 宝箱の id は <マップid>_c<n>（§8.12.4）`);
    }
    const pools = cs.map((c) => c.pool).filter(Boolean);
    const cnt = (p) => pools.filter((x) => x === p).length;
    if (/^archive_\d/.test(mid) && m.chestTier !== 8) warn(`${mid}: chestTier が ${m.chestTier}（8 のはず。§8.12.1）`);
    if (/^oblivion_\d/.test(mid) && m.chestTier !== 9) warn(`${mid}: chestTier が ${m.chestTier}（9 のはず。§8.12.1）`);
    if (m.type === 'town') {
      if (cs.length > 2) warn(`${mid}（町）: 宝箱 ${cs.length} 個（0〜2 個。§8.12.4）`);
      for (const p of pools) if (p !== 'p_supply' && p !== 'p_gold') warn(`${mid}（町）: ${p} の宝箱（町は p_supply か p_gold）`);
    } else if (m.type === 'dungeon') {
      const loc = m.location || mid.replace(/_\d+$/, '');
      (byLoc[loc] = byLoc[loc] || []).push([mid, pools]);
      const extra = SECRET[mid] || [];
      if (/^lighthouse_\d/.test(mid)) {
        if (cs.length > 2 + extra.length || (cs.length < 1 && mid !== 'lighthouse_3')) warn(`${mid}: 宝箱 ${cs.length} 個（ファロス灯台は各階 1〜2 個${extra.length ? '＋隠し通路の ' + extra.length : ''}。§8.12.4・§10.6.4）`);
        const left = extra.slice();
        for (const p of pools) {
          if (p === 'p_supply' || (p === 'p_gear' && mid === 'lighthouse_2')) continue;
          const k = left.indexOf(p);
          if (k >= 0) left.splice(k, 1); else warn(`${mid}: ${p} の宝箱（灯台は p_supply、2 階に p_gear を 1 つ。隠し通路の先は §10.6.4 の表）`);
        }
      } else {
        if (cs.length && (cs.length < 3 || cs.length > 5 + extra.length)) warn(`${mid}: 宝箱 ${cs.length} 個（ダンジョンは 1 階あたり 3〜5 個${extra.length ? '＋隠し通路の ' + extra.length : ''}）`);
        for (const p of pools) if (!DUNGEON_POOLS.has(p)) warn(`${mid}: ダンジョンに ${p} の宝箱`);
        if (/^(archive|oblivion)_\d/.test(mid) && cs.length && cnt('p_rare') !== 1) warn(`${mid}: p_rare ${cnt('p_rare')} 個（大書庫・忘却の底は各階に 1 つ）`);
      }
    }
  }
  for (const [loc, floors] of Object.entries(byLoc)) {
    if (loc === 'lighthouse' || loc === 'archive') continue;
    const all = floors.flatMap(([, p]) => p);
    if (!all.length) continue;
    const rare = all.filter((p) => p === 'p_rare').length;
    if (rare > 1) warn(`${loc}: p_rare ${rare} 個（ダンジョンごとに 1 つ）`);
    const share = (re) => Math.round(100 * all.filter((p) => re.test(p)).length / all.length);
    console.log(`  ${pad(loc, 12)} ${floors.length} 階・宝箱 ${all.length}: supply ${share(/^p_supply$/)}%・装備 ${share(/^p_(gear|weapon|armor|acc)$/)}%・gold ${share(/^p_gold$/)}%・stone ${share(/^p_stone$/)}%・rare ${rare}（目安 50/20/20/10、rare 1）`);
  }
  console.log(`  宝箱 ${n} 個をマップ ${maps.length} 枚で見た`);
}

console.log(`\n${errors} error(s), ${warns} warning(s)`);
process.exit(errors ? 1 : 0);
