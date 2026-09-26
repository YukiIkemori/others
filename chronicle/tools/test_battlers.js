#!/usr/bin/env node
// Unit tests for the party battle sprites (Part A8, DESIGN §11.4.4.7; owner SV-ART).
// Node only: R.Gfx.makeCanvas is replaced by a tiny in-memory canvas so the frames'
// pixels can be read back. Exit 1 on any failure.
//
//   node tools/test_battlers.js [-v]
//
//  1. 30 looks × 11 weapon families build without exceptions; pending count (0 passes)
//  2. every sheet has the 15 poses; frame counts / impact = R.Art.BATTLER; hold per frame within ±2
//  3. every frame 48×40, feet [24,39], anchors inside; box: idle 26–31 (short 22–27),
//     ko ≤ 17 high / ≤ 34 wide (see note), box bottom = 39
//  4. no semi-transparent pixels
//  5. left-facing: thrust and punch frame 1 have tip.x < feet.x − 6
//  6. same person: idle frame 0 carries ≥ 2 of the field hair colours (or all the field head shows,
//     when a hood leaves fewer) and ≥ 1 main-outfit colour
//  7. the 30 idle frame 0 images are pairwise different
//  8. FAMILY has the 11 weapon families, values are attack pose names
//  9. cache: the same call returns the same object; one sheet builds in ≤ 30 ms (mean)
// Note on 3: the ko figure lies on its back with the FIELD head turned 90°, and the field
// heads are 13–15px deep, so a lying figure is up to 17 high (DESIGN §11.4.4.4 says ≤ 12;
// reported to the lead as a spec correction).
'use strict';
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });

// ------------------------------------------------------------------ canvas shim
function fakeCanvas(w, h) {
  const cv = { width: w, height: h, _d: new Uint8ClampedArray(w * h * 4) };
  cv.getContext = () => ({
    imageSmoothingEnabled: false,
    createImageData: (W, H) => ({ width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }),
    putImageData: (id) => { cv._d.set(id.data); },
    getImageData: () => ({ width: w, height: h, data: cv._d }),
    drawImage: () => {}, fillRect: () => {}, clearRect: () => {},
  });
  return cv;
}
R.Gfx.makeCanvas = fakeCanvas;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; if (VERBOSE) console.log('  ok', msg); } else { fail++; fails.push(msg); if (fails.length < 60) console.log('  FAIL', msg); } }
function section(t) { console.log('\n# ' + t); }

const A = R.Art, B = A.BATTLER, CA = A.Chars;
const IDS = CA.PARTY_IDS;
const WT = Object.keys(B.FAMILY);
const hex = (d, i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');

section('1. build 30 looks × 11 families');
const sheets = {};
let errs = 0;
const t0 = Date.now();
for (const id of IDS) for (const w of WT) {
  try { sheets[id + ':' + w] = A.battler(id, { wtype: w }); } catch (e) { errs++; console.log('  ', id, w, e.message); }
}
const ms = (Date.now() - t0) / (IDS.length * WT.length);
ok(errs === 0, `no exceptions (${errs})`);
const pend = Object.values(sheets).filter((s) => s.pending).length;
console.log(`  pending sheets: ${pend}`);
ok(pend === 0, `pending = 0 (got ${pend})`);
ok(IDS.length === 30 && IDS.every((id) => B.LOOK[id]), 'LOOK has all 30 party looks');

section('2. poses / frames / impact / hold');
for (const k in sheets) {
  const s = sheets[k];
  ok(B.POSES.every((p) => s.poses[p]), k + ' has 15 poses');
  for (const p of B.POSES) {
    const P = s.poses[p];
    if (!P) continue;
    ok(P.frames.length === B.FRAMES[p], `${k} ${p} frames ${P.frames.length}`);
    ok(P.impact === (p in B.IMPACT ? B.IMPACT[p] : null), `${k} ${p} impact`);
    ok(P.hold.length === P.frames.length && P.hold.every((h, i) => Math.abs(h - B.HOLD[p][i]) <= 2), `${k} ${p} hold ${P.hold}`);
  }
  ok(s.family === B.FAMILY[s.wtype] && s.W === 48 && s.H === 40, k + ' family / size');
}

section('3–5. frames, anchors, boxes, alpha, facing');
const inside = (p) => p && p[0] >= 0 && p[1] >= 0 && p[0] < 48 && p[1] < 40;
let alphaBad = 0;
const boxStats = { idle: [99, 0], ko: [99, 0], koW: 0 };
for (const k in sheets) {
  const s = sheets[k], short = B.LOOK[s.look].height === 'short';
  for (const p of B.POSES) for (const f of s.poses[p].frames) {
    if (f.img.width !== 48 || f.img.height !== 40) ok(false, `${k} ${p} size`);
    if (f.feet[0] !== 24 || f.feet[1] !== 39) ok(false, `${k} ${p} feet`);
    for (const a of ['head', 'hit', 'hand', 'tip', 'cast']) if (!inside(f[a])) ok(false, `${k} ${p} ${a} inside ${f[a]}`);
    if (f.box.y + f.box.h - 1 !== 39) ok(false, `${k} ${p} box bottom ${f.box.y + f.box.h - 1}`);
    const d = f.img._d;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0 && d[i] !== 255) { alphaBad++; break; }
  }
  const id0 = s.poses.idle.frames[0].box.h;
  if (!short) { boxStats.idle[0] = Math.min(boxStats.idle[0], id0); boxStats.idle[1] = Math.max(boxStats.idle[1], id0); }
  ok(short ? id0 >= 22 && id0 <= 27 : id0 >= 26 && id0 <= 31, `${k} idle box h ${id0}`);
  const ko = s.poses.ko.frames[0].box;
  boxStats.ko[0] = Math.min(boxStats.ko[0], ko.h); boxStats.ko[1] = Math.max(boxStats.ko[1], ko.h); boxStats.koW = Math.max(boxStats.koW, ko.w);
  ok(ko.h <= 17 && ko.w <= 34, `${k} ko box ${ko.w}×${ko.h}`);
  for (const p of ['thrust', 'punch']) { const f = s.poses[p].frames[1]; ok(f.tip[0] < f.feet[0] - 6, `${k} ${p}[1] tip.x ${f.tip[0]} < 18`); }
}
console.log(`  idle box h ${boxStats.idle[0]}–${boxStats.idle[1]}, ko h ${boxStats.ko[0]}–${boxStats.ko[1]} w ≤ ${boxStats.koW}`);
ok(alphaBad === 0, `no semi-transparent pixels (${alphaBad} frames)`);

section('6–7. same person / all different');
const idleSigs = {};
for (const id of IDS) {
  const who = CA.parts.party[id], pal = CA.partyPalette(who);
  const f = A.battler(id, { wtype: 'sword' }).poses.idle.frames[0];
  const d = f.img._d, cols = new Set();
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) cols.add(hex(d, i));
  // the hair colours the FIELD head actually shows (a hood can leave only one visible)
  const fieldHead = new Set(R.Art._Battlers.headLayer(who, pal).buf.filter(Boolean).map((c) => c.toLowerCase()));
  const hairAll = (CA.hairColors(who.hair) || []).map((c) => c.toLowerCase());
  const want = Math.min(2, hairAll.filter((c) => fieldHead.has(c)).length);
  const hair = hairAll.filter((c) => cols.has(c)).length;
  const main = [pal.A, pal.B, pal.C].map((c) => c.toLowerCase()).filter((c) => cols.has(c)).length;
  ok(hair >= want && want >= 1, `${id} idle has ${hair} field hair colours (≥ ${want})`);
  ok(main >= 1, `${id} idle has ${main} main outfit colours (≥ 1)`);
  idleSigs[id] = Buffer.from(d).toString('base64');
}
const seen = {};
for (const id of IDS) { ok(!seen[idleSigs[id]], `${id} idle differs from ${seen[idleSigs[id]] || '-'}`); seen[idleSigs[id]] = id; }

section('8. FAMILY');
ok(WT.length === 11 && ['sword', 'katana', 'greatsword', 'axe', 'club', 'staff', 'spear', 'dagger', 'bow', 'fist', 'whip'].every((w) => B.FAMILY[w]), '11 families');
ok(Object.values(B.FAMILY).every((v) => B.POSES.includes(v) && v in B.IMPACT), 'FAMILY values are attack poses');

section('9. cache / time / API');
ok(A.battler('selma', { wtype: 'sword' }) === A.battler('selma', { wtype: 'sword' }), 'same object from the cache');
console.log(`  mean build time ${ms.toFixed(1)} ms per sheet`);
ok(ms <= 30, `build ≤ 30 ms per sheet (${ms.toFixed(1)})`);
ok(A.battlerKey('selma', { wtype: 'bow' }) === 'btl:selma:bow' && A.battlerKey('selma', { wtype: 'bow', grade: 'rare' }) === 'btl:selma:bow:rare', 'battlerKey');
const DB = R.DB;
const findW = (wt, g) => Object.keys(DB.items).find((k) => DB.items[k].wtype === wt && (!g || DB.items[k].grade === g));
const c = { id: 'hero', gender: 'f', heroType: 'mage', equip: { weapon1: null, weapon2: findW('bow') } };
ok(A.battlerWtype(c) === 'bow' && A.battlerWtype({ equip: {} }) === 'fist' && A.battlerWtype('selma') === 'fist', 'battlerWtype (other slot / none / id)');
c.equip.weapon1 = findW('spear');
ok(A.battlerWtype(c) === 'spear' && A.battlerWtype(c, 'weapon2') === 'bow', 'battlerWtype slot');
const sc = A.battler(c);
ok(sc.look === 'hero_f_mage' && sc.wtype === 'spear', 'battler(CharState) uses spriteKey look and weapon1 (' + sc.key + ')');
const rareW = findW('sword', 'rare');
if (rareW) ok(A.battlerKey({ id: 'selma', equip: { weapon1: rareW } }) === 'btl:selma:sword:rare', 'grade from weapon1');
const bad = A.battler('nobody_here', { wtype: 'sword' });
ok(bad.pending === true && bad.poses.idle.frames.length === 2, 'unknown look → pending stand-in');
A.PENDING = (A.PENDING || []).filter((k) => k !== 'btl:nobody_here');

section('10. nothing crosses the face (the poses the scene plays)');
// The face = the skin pixels of the stamped field head. An arm, hand or weapon drawn over more than
// 2 of them reads as "covering the face" (round-2 review). Bow shoot 1/2 draws the string to the cheek on purpose.
{
  const BT = A._Battlers, [nx, ny] = BT.HEAD_NECK;
  let face = null, hits = [];
  BT._probe = (b, fig, F, stage, J) => {
    if (stage === 'head') {
      const skin = new Set(['s', 'd', 't'].map((k) => fig.pal[k]).filter(Boolean));
      const ox = J.n[0] - nx, oy = J.n[1] - ny;
      face = [];
      for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) {
        const c = fig.head.buf[y * 16 + x], X = ox + x, Y = oy + y;
        if (c && skin.has(c) && X >= 0 && Y >= 0 && X < BT.W && Y < BT.H) face.push([Y * BT.W + X, BT.colorAt(b, Y * BT.W + X)]);
      }
    } else if (face) hits.push(face.filter(([i, c]) => BT.colorAt(b, i) !== c).length);
  };
  const worst = [];
  for (const id of IDS) for (const w of WT) {
    const fig = BT.makeFig(id, w, 'normal');
    for (const p of ['idle', 'walk', B.FAMILY[w], 'cast', 'item', 'guard', 'hit', 'weak', 'victory']) {
      BT.POSE_FN[p](fig.style).forEach((F, i) => {
        if (w === 'bow' && p === 'shoot' && i > 0) return;
        hits = []; face = null;
        BT.renderFrame(fig, F);
        if ((hits[0] || 0) > 2) worst.push(`${id}:${w}:${p}${i}=${hits[0]}`);
      });
    }
  }
  BT._probe = null;
  ok(worst.length === 0, `face clear in every played frame (${worst.length}: ${worst.slice(0, 8).join(' ')})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(fails.slice(0, 20).join('\n')); process.exit(1); }
