#!/usr/bin/env node
// Unit tests for the rare-monster and post-game art registry (area art-rare A15b).
// Node only (no browser): checks what can be checked without building pixels.
// The pixel checks are in tools/check_art-rare.js (Playwright).
//
//   node tools/test_art-rare.js [-v]
//
// Against DESIGN.md (parsed, so the test follows the spec):
//   T1  §9.10.2: 23 rare monsters, each rm_ id → its sprite id and size class (s/m/l)
//   T2  R.Art.RARE_SPRITES has exactly those 23 sprites at 32 / 48 / 64 px
//   T3  R.Art.RARE_BY_MON maps the same 23 monster ids to the same sprites
//   T4  every 'mon:rare_*' and 'mon:rm_*' key is registered (R.Gfx.has)
//   T5  §9.10.3: the 17 new designs live in rare_monsters_b.js (R.Art.rareMonstersB),
//       the 6 Crest ones are rare_monsters.js + rare_prism in postgame.js
//   T6  R.Art.RareTK exports the toolkit rare_monsters_b.js uses
//   T7  post-game: void_wraith / chaos_beast / rare_prism / boss_abyss registered; both base
//       sprites have MON_ANCHORS with every §9.4.3 key inside the canvas
//   T8  if the monster data is loaded (A12 rare.js): each rm_ monster's sprite key exists,
//       its size letter matches the sprite, and it carries the 'rare' flag
//   T9  if the compose table is loaded (A14a): void_1..3 / chaos_1..3 build on the two bases
//   T10 nothing of this area in R.Art.PENDING; no STYLE_JA §7.3 banned words in own files
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });

let fails = 0, passes = 0;
const ok = (cond, name, detail) => {
  if (cond) { passes++; if (VERBOSE) console.log('  ok  ', name); }
  else { fails++; console.log('  FAIL', name, detail != null ? '— ' + detail : ''); }
};
const section = (s) => console.log(s);

// ---------------------------------------------------------------- the spec
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const sec = (from, to) => DESIGN.slice(DESIGN.indexOf(from), DESIGN.indexOf(to, DESIGN.indexOf(from) + 1));
const T2 = sec('#### 9.10.2 一覧', '#### 9.10.3');
const T3 = sec('#### 9.10.3 新しい絵', '### 9.11');
const SIZE = { s: 32, m: 48, l: 64 };
const spec = {}; // rm id → {sprite, size, isNew}
for (const m of T2.matchAll(/^\| `(rm_\w+)` \| [^|]+ \| `(rare_\w+)`（([sml])）(既存|新) \|/gm)) {
  spec[m[1]] = { sprite: m[2], size: SIZE[m[3]], isNew: m[4] === '新' };
}
const newSpec = [...T3.matchAll(/^- `(rare_\w+)`（[^）]+）: (\d+)×(\d+)。/gm)].map((m) => ({ id: m[1], w: +m[2], h: +m[3] }));

section('T1 spec §9.10.2 / §9.10.3');
ok(Object.keys(spec).length === 23, 'T1 23 rare monsters in §9.10.2', Object.keys(spec).length);
ok(Object.values(spec).filter((r) => r.isNew).length === 17, 'T1 17 marked 新', Object.values(spec).filter((r) => r.isNew).length);
ok(newSpec.length === 17, 'T1 17 designs in §9.10.3', newSpec.length);
for (const n of newSpec) {
  const r = Object.values(spec).find((q) => q.sprite === n.id);
  ok(r && r.isNew && r.size === n.w && n.w === n.h, 'T1 §9.10.3 ' + n.id + ' ' + n.w + 'x' + n.h + ' agrees with §9.10.2', r && r.size);
}

// ---------------------------------------------------------------- registry
const A = R.Art || {};
section('T2-T3 registry');
const RS = A.RARE_SPRITES || {};
ok(Object.keys(RS).length === 23, 'T2 RARE_SPRITES has 23 sprites', Object.keys(RS).length);
for (const [rm, r] of Object.entries(spec)) {
  ok(RS[r.sprite] === r.size, 'T2 ' + r.sprite + ' is ' + r.size + 'px', RS[r.sprite]);
  ok((A.RARE_BY_MON || {})[rm] === r.sprite, 'T3 ' + rm + ' → ' + r.sprite, (A.RARE_BY_MON || {})[rm]);
}
ok(Object.keys(A.RARE_BY_MON || {}).length === 23, 'T3 RARE_BY_MON has 23 ids');

section('T4 graphics keys');
for (const [rm, r] of Object.entries(spec)) {
  ok(R.Gfx.has('mon:' + r.sprite), 'T4 mon:' + r.sprite + ' registered');
  ok(R.Gfx.has('mon:' + rm), 'T4 mon:' + rm + ' alias registered');
}

section('T5 files');
const B = (A.rareMonstersB || {}).ids || [];
const newIds = Object.values(spec).filter((r) => r.isNew).map((r) => r.sprite).sort();
ok(JSON.stringify(B.slice().sort()) === JSON.stringify(newIds), 'T5 rare_monsters_b.js has exactly the 17 new sprites', B.length);
for (const id of B) ok(((A.rareMonstersB || {}).sizes || {})[id] === RS[id], 'T5 rareMonstersB size of ' + id);
const crest = (A.rareMonsters || {}).crest || [];
const oldIds = Object.values(spec).filter((r) => !r.isNew).map((r) => r.sprite).sort();
ok(JSON.stringify(crest.slice().sort()) === JSON.stringify(oldIds), 'T5 the 6 kept Crest sprites', crest.join(' '));
const srcB = fs.readFileSync(path.join(ROOT, 'src/art/rare_monsters_b.js'), 'utf8');
for (const id of newIds) ok(new RegExp('S\\.' + id + ' = \\(\\) =>').test(srcB), 'T5 ' + id + ' factory in rare_monsters_b.js');
ok(((A.Postgame || {}).SPRITES || []).includes('rare_prism'), 'T5 rare_prism in postgame.js');

section('T6 toolkit');
const TK = A.RareTK || {};
for (const k of ['Scene', 'mat', 'gradMat', 'stamp', 'on', 'jewel', 'sparkle', 'crystal', 'crystalEdges', 'finish', 'hash', 'clamp', 'GOLD', 'RUBY', 'SAPH', 'PINK', 'OUT', 'INK', 'WHITE']) ok(k in TK, 'T6 RareTK.' + k);
// every name a factory destructures from kit() must exist in the toolkit
for (const m of srcB.matchAll(/const \{ ([^}]+) \} = kit\(\);/g)) for (const n of m[1].split(',').map((q) => q.trim())) ok(n in TK, 'T6 kit() provides ' + n);

section('T7 post-game');
const PG = A.Postgame || {};
for (const id of ['void_wraith', 'chaos_beast', 'rare_prism', 'boss_abyss']) ok(R.Gfx.has('mon:' + id), 'T7 mon:' + id + ' registered');
const KEYS = ['head', 'brow', 'eyes', 'mouth', 'neck', 'back', 'body', 'hand', 'hand2', 'tail', 'feet'];
for (const base of ['void_wraith', 'chaos_beast']) {
  const an = (A.MON_ANCHORS || {})[base], sz = (PG.SIZES || {})[base] || [0, 0];
  ok(!!an, 'T7 MON_ANCHORS.' + base);
  if (!an) continue;
  for (const k of KEYS) {
    const v = an[k];
    const pts = k === 'eyes' ? v : [v];
    ok(Array.isArray(pts) && pts.length > 0 && pts.every((q) => Array.isArray(q) && q[0] >= 0 && q[1] >= 0 && q[0] < sz[0] && q[1] < sz[1]), 'T7 ' + base + '.' + k + ' inside ' + sz.join('x'), JSON.stringify(v));
  }
  ok(an.feet[1] >= sz[1] - 3, 'T7 ' + base + ' feet on the ground line', an.feet[1]);
  ok(an.head[1] < an.body[1] && an.body[1] < an.feet[1], 'T7 ' + base + ' head above body above feet');
}

section('T8 monster data (A12)');
const M = (R.DB && R.DB.monsters) || {};
const have = Object.keys(spec).filter((rm) => M[rm]);
if (!have.length) console.log('  (skipped: R.DB.monsters has no rm_ entries yet)');
for (const rm of have) {
  const d = M[rm];
  const sprite = d.sprite || rm;
  ok(R.Gfx.has('mon:' + sprite), 'T8 ' + rm + ' sprite mon:' + sprite + ' registered');
  ok(d.sprite === spec[rm].sprite, 'T8 ' + rm + '.sprite = ' + spec[rm].sprite, d.sprite);
  if (d.size) ok(SIZE[d.size] === RS[spec[rm].sprite], 'T8 ' + rm + '.size ' + d.size + ' matches the ' + RS[spec[rm].sprite] + 'px sprite');
  ok(Array.isArray(d.flags) && d.flags.includes('rare'), 'T8 ' + rm + " has the 'rare' flag", JSON.stringify(d.flags));
}
if (have.length) console.log('  checked', have.length, 'of 23 rare monsters in the data');

section('T9 lineage compose (A14a)');
const MC = A.MON_COMPOSE || {};
const lin = ['void_1', 'void_2', 'void_3', 'chaos_1', 'chaos_2', 'chaos_3'].filter((id) => MC[id]);
if (!lin.length) console.log('  (skipped: MON_COMPOSE has no void_/chaos_ rows yet)');
for (const id of lin) ok(MC[id][0] === (id.startsWith('void') ? 'void_wraith' : 'chaos_beast'), 'T9 ' + id + ' composes on ' + MC[id][0]);

section('T10 hygiene');
const pend = (A.PENDING || []).filter((k) => /^mon:(rare_|rm_|void_wraith|chaos_beast|boss_abyss)/.test(k));
ok(pend.length === 0, 'T10 no pending keys of this area', pend.join(' '));
const BANNED = ['冒険の書', '復活の呪文', 'ふっかつのじゅもん', '呪文', '痛恨', '会心の一撃', 'やっつけた', 'リジェネ', 'ジョブ', 'アビリティ', '麻痺', '魔法防御', '秘奥義', '魔剣士', 'スライム', 'メタル'];
for (const f of ['src/art/rare_monsters.js', 'src/art/rare_monsters_b.js', 'src/art/postgame.js']) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const hit = BANNED.filter((w) => t.includes(w));
  ok(!hit.length, 'T10 ' + f + ' has no banned words', hit.join(' '));
}
ok(!(R._nodeLoadErrors || []).some((e) => /rare_monsters|postgame\.js/.test(e)), 'T10 own files load in node', (R._nodeLoadErrors || []).filter((e) => /rare_monsters|postgame/.test(e)).join('\n'));

console.log(`\ntest_art-rare: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
