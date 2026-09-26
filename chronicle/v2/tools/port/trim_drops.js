#!/usr/bin/env node
// trim_drops.js（RULES・BATTLE）: STATS_REWORK §10.1 の品の側。魔物のドロップの枠を減らした後（port_mons.js）に、
// 枠を失った魔物の品（レア 'mdrop'・超レア *_monster.js）の行き先を決める。
//   node v2/tools/port/trim_drops.js           → 選んだ結果を表示する（書かない）
//   node v2/tools/port/trim_drops.js --write   → tools/port/trim_10_1.json を書き、items_*_monster.js から消す品を外す
// 決まり（§10.1）:
//   - 魔物がまだ落とす品はそのまま。落とさなくなった品のうち
//   - 必ず残す: クセを残す品（§4.1、quirk）・BUILD_SETS の品（party_model）・T8〜T9・鋼に通る（metalHit）・起き上がる（autoRevive）
//   - それに加えて、レア・超レアそれぞれ約 30 品になるまで「同じ枠×ティアにまだ無い」「効果の形が重ならない」品から選んで残す
//     （レア → 宝箱 p_rare、超レア → p_super・p_boss。pools.js は「どの魔物も落とさない品」をそのまま拾う）
//   - 残りは消す。消す品の一覧は trim_10_1.json（port_items.js が読み、移し直しても戻らない）
'use strict';
const fs = require('fs');
const path = require('path');
const V2 = path.resolve(__dirname, '..', '..');
const DATA = path.join(V2, 'src', 'data');
const OUT = path.join(__dirname, 'trim_10_1.json');
const WRITE = process.argv.includes('--write');
const TARGET = 30;

const R = require(path.join(V2, 'tools', 'lib', 'load'))({ quiet: true });
const PM = require(path.join(V2, 'tools', 'lib', 'party_model'));
const I = R.DB.items, M = R.DB.monsters;

// 品 → ファイル
const fileOf = {};
for (const f of fs.readdirSync(DATA).filter((f) => /^items_.*\.js$/.test(f))) {
  const s = fs.readFileSync(path.join(DATA, f), 'utf8');
  for (const m of s.matchAll(/^ {2}([a-z0-9_]+): \{/gm)) fileOf[m[1]] = f;
}
// 参照: 魔物のドロップ（steal を含む）とほかの表（店・ボス・編成・レアの出現・イベント）
const monRef = new Set(), otherRef = new Set();
const walk = (o, set) => { if (!o) return; if (typeof o === 'string') { if (I[o]) set.add(o); return; } if (typeof o === 'object') for (const k in o) walk(o[k], set); };
walk(M, monRef);
for (const t of ['troops', 'bosses', 'rareEncounters', 'shops', 'events', 'maps', 'companions', 'herotypes']) walk(R.DB[t], otherRef);
// イベント（ev.item の報酬）・フィクスチャ・テストが名前で使う品も「参照あり」（ほかの担当のファイルを壊さない）
const scan = (dir, re) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? scan(path.join(dir, e.name), re) : re.test(e.name) ? [path.join(dir, e.name)] : [])) : []);
for (const f of [...scan(path.join(V2, 'src', 'events'), /\.js$/), ...scan(path.join(V2, 'src', 'maps'), /\.js$/), ...scan(path.join(V2, 'tools', 'fixtures'), /\.json$/),
  ...fs.readdirSync(path.join(V2, 'tools')).filter((n) => /^test_.*\.js$/.test(n)).map((n) => path.join(V2, 'tools', n))]) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/['"]([a-z]{1,2}_[a-z0-9_]+)['"]/g)) if (I[m[1]]) otherRef.add(m[1]);
}
const build = new Set();
walk(PM.BUILD_SETS, build);

const isMonRare = (id, it) => it.grade === 'rare' && it.src === 'mdrop';
const isMonSuper = (id, it) => it.grade === 'super' && /_monster\.js$/.test(fileOf[id] || '');
const must = (id, it) => !!(it.quirk || build.has(id) || (it.tier | 0) >= 8 || it.metalHit || (it.mods && it.mods.autoRevive));
const sig = (it) => JSON.stringify([it.slot, it.wtype || '', Object.keys(it.mods || {}).sort(), it.element || '', it.onHit ? it.onHit.status : '']);

function pick(pred) {
  const cand = Object.entries(I).filter(([id, it]) => pred(id, it) && !monRef.has(id) && !otherRef.has(id)).sort(([a], [b]) => (a < b ? -1 : 1));
  const keep = new Map(), cell = {}, sigs = {};
  const add = (id, it, why) => { keep.set(id, why); const c = it.slot + ':' + it.tier; cell[c] = (cell[c] || 0) + 1; sigs[sig(it)] = (sigs[sig(it)] || 0) + 1; };
  for (const [id, it] of cand) if (must(id, it)) add(id, it, 'must');
  // 同じ枠×ティアの数・効果の形の重なりの少ない物から（決まった順。乱数なし）
  while (keep.size < TARGET) {
    let best = null, bs = Infinity;
    for (const [id, it] of cand) {
      if (keep.has(id)) continue;
      const s = (cell[it.slot + ':' + it.tier] || 0) * 10 + (sigs[sig(it)] || 0) * 3 + Math.abs((it.tier | 0) - 4) * 0.1;
      if (s < bs) { bs = s; best = [id, it]; }
    }
    if (!best) break;
    add(best[0], best[1], 'spread');
  }
  const del = cand.filter(([id]) => !keep.has(id)).map(([id]) => id);
  return { cand: cand.length, keep: [...keep.entries()], del };
}

const rare = pick(isMonRare), sup = pick(isMonSuper);
const count = (list, pred) => Object.entries(I).filter(([id, it]) => pred(id, it)).length;
console.log(`monster rare: ${count(0, isMonRare)} items, still dropped ${count(0, (id, it) => isMonRare(id, it) && monRef.has(id))}, orphaned ${rare.cand} → keep ${rare.keep.length} (must ${rare.keep.filter((k) => k[1] === 'must').length}) → p_rare, delete ${rare.del.length}`);
console.log(`monster super: ${count(0, isMonSuper)} items, still dropped ${count(0, (id, it) => isMonSuper(id, it) && monRef.has(id))}, orphaned ${sup.cand} → keep ${sup.keep.length} (must ${sup.keep.filter((k) => k[1] === 'must').length}) → p_super/p_boss, delete ${sup.del.length}`);
if (process.argv.includes('-v')) console.log(JSON.stringify({ rareKeep: rare.keep, superKeep: sup.keep }, null, 1));

if (WRITE) {
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')).deleted || []; } catch (e) { /* 初めて */ }
  const del = [...new Set([...prev, ...rare.del, ...sup.del])].filter((id) => I[id]).sort();
  const allDel = [...new Set([...prev, ...rare.del, ...sup.del])].sort();
  fs.writeFileSync(OUT, JSON.stringify({ note: 'STATS_REWORK §10.1: 魔物の枠を失い、宝箱にも移さなかった品（trim_drops.js が選ぶ。port_items.js が読んで移さない）', rareToChest: rare.keep.map((k) => k[0]), superToChest: sup.keep.map((k) => k[0]), deleted: allDel }, null, 1) + '\n');
  // items_*_monster.js から消す（1 品 = "  id: {" から次の "  }," まで）
  const byFile = {};
  for (const id of del) (byFile[fileOf[id]] = byFile[fileOf[id]] || []).push(id);
  for (const [f, ids] of Object.entries(byFile)) {
    const p = path.join(DATA, f);
    let s = fs.readFileSync(p, 'utf8');
    for (const id of ids) {
      const one = new RegExp(`^ {2}${id}: \\{.*\\},\\n`, 'm');                       // 1 行の形
      const re = new RegExp(`^ {2}${id}: \\{\\n[\\s\\S]*?^ {2}\\},\\n`, 'm');     // 複数行の形
      if (one.test(s)) s = s.replace(one, '');
      else if (re.test(s)) s = s.replace(re, '');
      else { console.error('not found', id, f); process.exitCode = 1; }
    }
    const n = (s.match(/^ {2}[a-z0-9_]+: \{/gm) || []).length;
    s = s.replace(/^(\/\/ items_[a-z_]+\.js — [^0-9\n]*)\d+/m, `$1${n}`);
    fs.writeFileSync(p, s);
    console.log(`${f}: -${ids.length} → ${n}`);
  }
  console.log('wrote', path.relative(process.cwd(), OUT));
}
