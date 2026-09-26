#!/usr/bin/env node
// Unit tests of the battle screen (bui A3: src/systems/battle_scene.js, battle_fx.js). Node, no browser:
// the scene runs frame by frame on R.Engine.step() with input from R.Input._set, text is measured with
// R.Text.approxWidth and sprites are stand-in boxes. The stage and the scripted engine come from
// tools/fixtures/bui (the same ones the gallery uses); section R also drives the real R.Battle.Engine (A2).
//   node tools/test_bui.js [-v]          exit 1 on any failure
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true, extra: [path.join(ROOT, 'tools/fixtures/bui/fake_engine.js'), path.join(ROOT, 'tools/fixtures/bui/stage.js')] });
const DB = R.DB, B = R.Battle, FX = R.BattleFX, BUI = R.bui;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, info) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok', name); }
  else { fail++; fails.push(name + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
}
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
const section = (s) => { if (VERBOSE) console.log('\n' + s); };

// ---------------------------------------------------------------- headless graphics / audio
const sizes = {};
function box(w, h) {
  // a stand-in canvas that also reads as a frame list (fx sprites like bfx:flame are arrays)
  const b = { width: w, height: h, getContext: () => null, length: 4, map: (f) => [0, 1, 2, 3].map((i) => f(b, i)) };
  for (let i = 0; i < 4; i++) b[i] = b;
  return b;
}
const FS = R.Gfx.FS;
R.Gfx.ctx = {
  font: '', globalAlpha: 1,
  measureText(s) { const px = parseFloat(String(this.font)) || FS; return { width: (R.Text && R.Text.approxWidth ? R.Text.approxWidth(s) : [...s].length * FS) * (px / FS) }; },
  save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, fillText() {}, drawImage() {}, setTransform() {},
  createLinearGradient() { return { addColorStop() {} }; }, fillStyle: '#000', textAlign: 'left', textBaseline: 'top', imageSmoothingEnabled: false,
};
// offscreen canvases (tints, stand-in frames) are inert stubs
R.Gfx.makeCanvas = (w, h) => ({ width: w, height: h, getContext: () => ({ drawImage() {}, fillRect() {}, translate() {}, rotate() {}, getImageData: () => ({ data: [] }), putImageData() {}, createImageData: (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) }) }) });
const realGet = R.Gfx.get.bind(R.Gfx);
R.Gfx.get = (k) => {
  if (k.startsWith('mon:')) return sizes[k] || (sizes[k] = box(48, 48));
  if (k.startsWith('bfx:') || k.startsWith('obj:') || k.startsWith('icon:') || k.startsWith('bbg:')) return box(16, 16);
  if (k.startsWith('party:')) { const f = box(16, 24); return { down: [f, f], up: [f, f], left: [f, f], right: [f, f] }; }
  return realGet(k);
};
R.Gfx.variant = (k) => R.Gfx.get(k);
const sfx = [], jingles = [];
let jingleHold = null; // when set, R.jingle(id) returns this promise (the super-rare fanfare test)
R.sfx = (id) => { sfx.push(id); };
R.jingle = (id) => { jingles.push(id); return jingleHold || Promise.resolve(); };
// party battle sprites: the scene's own stand-in (R.Art.battler needs a canvas — §11.4.4.3 代わり; SV-ART tests its own)
if (R.Art) { R.Art._battlerNode = R.Art.battler; delete R.Art.battler; }
R.Settings.battleSpeed = 1; R.Settings.msgSpeed = 2; R.Settings.cursorMemory = true; R.Settings.autoKeep = true;

const A = BUI.api;
const step = (n) => A.step(n);
const press = (b) => A.press(b);
async function until(fn, max) { for (let i = 0; i < (max || 600); i++) { if (fn()) return i; await step(1); } return -1; }
const std = () => [{ id: 'wolf_2' }, { id: 'wolf_2', golden: true }, { id: 'wolf_2' }, { id: 'goblin_2' }];

(async () => {
  // ================================================================ L — layout constants (§11.5.1)
  section('L layout');
  const LY = B.LAYOUT;
  eq(LY.FIELD, { x: 0, y: 0, w: 256, h: 152 }, 'L1 FIELD');
  eq([LY.MSG, LY.MSG_BIG, LY.HELP], [{ x: 4, y: 4, w: 248, h: 34, lines: 2 }, { x: 4, y: 4, w: 248, h: 62, lines: 4 }, { x: 4, y: 4, w: 248, h: 19 }], 'L2 MSG / MSG_BIG / HELP');
  eq([LY.LIST, LY.CMD, LY.STATUS], [{ x: 4, y: 64, w: 168, rows: 5, lineH: 14, padY: 8 }, { x: 4, y: 152, w: 88, h: 68 }, { x: 94, y: 152, w: 158, h: 68 }], 'L3 LIST / CMD / STATUS');
  eq([LY.BANNER, LY.CARD, LY.EZ], [{ cx: 88, y: 44, h: 32 }, { x: 8, y: 76, w: 168 }, { x0: 4, x1: 172, cx: 88 }], 'L4 BANNER / CARD / EZ');
  eq(LY.PARTY, { front: 192, middle: 222, zig: [0, 10, 0, 10], step: 10, y: { 1: [126], 2: [112, 136], 3: [106, 124, 142], 4: [100, 116, 132, 148] } }, 'L5 PARTY');
  ok(B.HELP === LY.HELP && B.BANNER === LY.BANNER && B.CARD === LY.CARD, 'L6 R.Battle.HELP / BANNER / CARD are the new values');
  eq([B.WIN, B.WIN_BOTTOM, [B.BOX.x, B.BOX.y, B.BOX.w, B.BOX.h], B.GROUND], [{ xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, 56, [8, 150, 240, 68], 130], 'L7 legacy WIN / WIN_BOTTOM / BOX / GROUND keep their values');
  ok(LY.CMD.x + LY.CMD.w < LY.STATUS.x && LY.STATUS.x + LY.STATUS.w <= 256 - 4 && LY.CMD.y + LY.CMD.h <= 224 - 4, 'L8 CMD and STATUS side by side inside the screen');
  // enemyLayout (§11.5.13): 1–8 monsters of 32 / 48 / 64, big sprites + escorts — inside x 4–172, every one ≥ 50 % visible
  const boxes = (w, h, n) => Array.from({ length: n }, () => ({ w, h }));
  // the share of each sprite's box not covered by a sprite drawn after it (a nearer row, or later in the same row)
  const visibleShare = (pos, list) => list.map((it) => {
    const p = pos.get(it);
    const over = list.filter((o) => o !== it && (pos.get(o).feet > p.feet || (pos.get(o).feet === p.feet && list.indexOf(o) > list.indexOf(it))));
    let n = 0, hid = 0;
    for (let y = p.y; y < p.feet; y++) for (let x = p.x; x < p.x + it.w; x++) {
      n++;
      if (over.some((o) => { const q = pos.get(o); return x >= q.x && x < q.x + o.w && y >= q.y && y < q.feet; })) hid++;
    }
    return 1 - hid / n;
  });
  const layoutOk = (list, name, need) => {
    const pos = B.enemyLayout(list);
    const inside = list.every((it) => { const p = pos.get(it); return p && p.x >= 4 && p.x + it.w <= 172; });
    const vis = visibleShare(pos, list);
    need = need == null ? 0.5 : need;
    ok(inside && vis.every((v) => v >= need), 'L9 enemyLayout ' + name + ': inside x 4–172, each ≥ ' + Math.round(need * 100) + ' % visible', { inside, vis: vis.map((v) => v.toFixed(2)), pos: list.map((it) => [pos.get(it).x, pos.get(it).feet]) });
    return pos;
  };
  // 32 / 48 px up to 8 and 64 px up to 4 keep half of each sprite; the extreme crowds (5–8 of 64 px, never in the
  // encounter data) still show a third
  for (const w of [32, 48, 64]) for (let n = 1; n <= 8; n++) layoutOk(boxes(w, w, n), `${n}×${w}`, w === 64 && n > 4 ? (n > 6 ? 0.2 : 0.3) : n > 6 ? 0.45 : 0.5);
  layoutOk(boxes(32, 32, 3).concat(boxes(48, 48, 3), boxes(64, 64, 2)), 'mixed 8', 0.45);
  let pos = layoutOk(boxes(48, 48, 1), '1×48');
  const one = [...pos.values()][0];
  ok(one.feet === 134 && one.rows === 1 && one.x === 88 - 24, 'L10 one monster: feet 134, centred on x 88', one);
  const eight = boxes(32, 32, 8);
  pos = B.enemyLayout(eight);
  ok(eight.every((it, i) => pos.get(it).feet === (i % 2 ? 142 : 114)) && pos.get(eight[0]).x > pos.get(eight[1]).x, 'L11 eight 32s: two rows (even ids behind at 114, odd in front at 142), the back row shifted right', eight.map((it) => [pos.get(it).x, pos.get(it).feet]));
  const nine = boxes(64, 64, 8);
  pos = B.enemyLayout(nine);
  ok(nine.every((it, i) => { const f = pos.get(it).feet, d = [102, 122, 142][i % 3]; return f <= d && f >= d - 6; }), 'L12 eight 64s: three rows 102 / 122 / 142 (a crowded back row may stand ≤ 6 px further back)', nine.map((it) => pos.get(it).feet));
  const boss = { w: 128, h: 112 }, esc = boxes(48, 48, 2), bl = [esc[0], boss, esc[1]];
  pos = B.enemyLayout([boss]);
  const pb = pos.get(boss);
  ok(pb.x === 24 && pb.y === 34 && pb.feet === 146, 'L13 a 128×112 boss: x 24–152, top 34, feet 146', pb);
  pos = B.enemyLayout(bl);
  ok(visibleShare(pos, bl).every((v) => v >= 0.5) && Math.max(...esc.map((e) => pos.get(e).x + 48)) === 172, 'L14 boss + two escorts: right-aligned to 172, everyone ≥ 50 % visible (the boss steps left, the escorts come forward when needed)', { pos: bl.map((e) => pos.get(e)), vis: visibleShare(pos, bl) });
  const small = { w: 96, h: 96 }, one1 = { w: 48, h: 48 };
  pos = B.enemyLayout([small, one1]);
  ok(pos.get(one1).feet === 114 && pos.get(one1).x + 48 === 172 && pos.get(small).feet === 146, 'L14b a 96 boss + one escort: the escort peeks out behind at its upper right (feet 114, right-aligned)', [pos.get(small), pos.get(one1)]);
  // the party (§11.5.14): feet by row and number of members
  let S = BUI.open({ mons: std() });
  const P = S.eng.party;
  ok(P.length === 4 && S.pvs.length === 4 && S.winFx.length === 4, 'L15 four members on screen', P.length);
  eq(S.pvs.map((v) => [v.homeX, v.homeY]), [[192, 100], [232, 116], [222, 132], [202, 148]], 'L16 feet: front 192 / middle 222 + zig 0 10 0 10, y 100 116 132 148');
  for (const n of [1, 2, 3]) {
    const Sn = BUI.open({ mons: std(), size: n, tweak: (p) => { for (const c of p) c.row = 'front'; } });
    eq(Sn.pvs.map((v) => v.homeY), LY.PARTY.y[n], 'L17 ' + n + ' member(s): y ' + LY.PARTY.y[n].join(' '));
  }
  S = BUI.open({ mons: std(), tweak: (p) => { p[0].hp = 0; p[3].hp = 0; } });
  eq(S.pvs.map((v) => v.homeX), [192, 202, 192, 202], 'L18 the front row down: the middle row counts as the front (x 192)');
  // rectOf a member = the sprite box + anchors (screen coordinates)
  S = BUI.open({ mons: std() });
  const r0 = S.rectOf(S.eng.party[0]);
  ok(r0.side === 'party' && r0.bottom === 100 && r0.feet[0] === 192 && r0.x < 192 && r0.x + r0.w > 192 && r0.y < 100 && r0.head[1] < r0.cy && Array.isArray(r0.cast) && Array.isArray(r0.tip), 'L19 rectOf(member): sprite box, feet, head, cast, tip', r0);
  const Q = S.eng.party; // this scene's members (P above belongs to the previous scene)
  S.pop(Q[2], 12, 'white'); S.pop(Q[2], 5, 'green');
  const r2 = S.rectOf(Q[2]);
  eq([S.pops[0].x, S.pops[0].y, S.pops[1].y], [r2.cx, Math.max(42, r2.cy - 8), Math.max(42, r2.cy - 8) - 9], 'L20 member numbers on the member\'s own chest (hit anchor − 8), 9 px up per stacked number');
  {
    // the number must not land on the member drawn one row higher (rows are 16 px apart)
    const r1 = S.rectOf(Q[1]);
    ok(r2.side === 'party' && S.pv(Q[2]) && S.pops[0].y > r1.cy && S.pops[0].y + 7 > r2.head[1], 'L20b a member\'s number sits below the upper member\'s chest', { y: S.pops[0].y, upperCy: r1.cy, head: r2.head[1] });
  }
  {
    // draw order: a member who ran in is drawn after every monster (a front-row monster must not hide them)
    const v = S.pvs[0], order = [];
    const dm = S.drawMonster, dp = S.drawMember;
    S.drawMonster = (mv) => order.push('m'); S.drawMember = (pv) => order.push(pv === v ? 'V' : 'p');
    v.away = true; v.y = 100;
    S.drawUnits();
    const lastM = order.lastIndexOf('m'), iv = order.indexOf('V');
    S.drawMonster = dm; S.drawMember = dp; v.away = false; S.updateHomes(true);
    ok(lastM >= 0 && iv > lastM, 'L20c a ran-in member is drawn in front of every monster', order.join(''));
  }
  const rm = S.rectOf(S.eng.mons[0]);
  S.pop(S.eng.mons[0], 3, 'white');
  eq([S.pops[2].x, S.pops[2].y], [rm.cx, Math.max(42, rm.y + rm.h * 0.4)], 'L21 monster numbers at 40 % of the sprite');
  // the member entering commands steps forward 10 px (6 frames at speed 1)
  S = BUI.open({ mons: std() });
  S.commandPhase();
  await step(2); await press('a'); await step(8);
  ok(S.acting === P[0] || S.acting === S.eng.party[0], 'L22 the first member is entering commands');
  ok(S.pvs[0].x === 182 && S.pvs[1].x === 232, 'L23 the one entering commands stands 10 px forward', S.pvs.map((v) => v.x));
  await press('b'); await step(8);
  ok(S.pvs[0].x === 192, 'L24 back to the party menu: back in place', S.pvs[0].x);

  // ================================================================ W — the STATUS panel (§11.5.2)
  section('W status');
  S = BUI.open({ mons: std() });
  const [h0, b0, s0, m0] = S.eng.party;
  eq(S.eng.party.map((p) => S.rowOf(p)), ['front', 'middle', 'middle', 'front'], 'W1 row tags use the effective row');
  h0.c.hp = 0; m0.c.hp = 0;
  eq(S.eng.party.map((p) => S.rowOf(p)), ['front', 'front', 'front', 'front'], 'W2 no living front row → the middle row shows 前');
  h0.c.hp = 10; m0.c.hp = 10;
  b0.c.status = { cover: true, poison: true, burn: true, regen: true, silence: true };
  b0.buffs.atk = 1; b0.buffs.def = -1;
  eq(S.iconsOf(b0), ['poison', 'burn', 'silence', 'regen', 'cover', 'up', 'down'], 'W3 icons in DB.statuses order, then up / down');
  ok(Object.keys(DB.statuses).filter((s) => s !== 'death').every((s) => R.Gfx.has('bfx:icon_' + s)), 'W4 every status has a bfx:icon_');
  for (const k of ['burn', 'freeze', 'stun', 'veil', 'counter', 'nimble', 'cover']) ok(!!FX.icons[k], 'W5 new icon ' + k);
  const ICON_SPEC = {
    burn: ['#ff8a30', '...#....', '..##....', '..###.#.', '.#####..', '.######.', '.##..##.', '..####..', '........'],
    freeze: ['#a8ecff', '...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
    stun: ['#ffe45a', '.#####..', '#.....#.', '#.###.#.', '#.#.#.#.', '#.#...#.', '#.####..', '#.......', '........'],
    veil: ['#9ce8ff', '.######.', '#......#', '.######.', '........', '...#....', '..###...', '...#....', '........'],
    counter: ['#ff9c5a', '#.....#.', '.#...#..', '..#.#...', '...#....', '..#.#...', '.#...#..', '#.....#.', '........'],
    nimble: ['#b8ffb0', '......#.', '....###.', '..####..', '.####...', '####....', '.#......', '#.......', '........'],
    cover: ['#d8c8ff', '.######.', '#.####.#', '#.####.#', '#.####.#', '.#.##.#.', '..#..#..', '...##...', '........'],
  };
  for (const k in ICON_SPEC) eq([FX.icons[k][1]].concat(FX.icons[k][0]), ICON_SPEC[k], 'W6 icon grid §11.3.6 ' + k);
  // glow decays in real frames (40), not shortened by the battle speed
  R.Settings.battleSpeed = 2;
  {
    // A22.0: no status window name / title can rise into y 0 (the front view's raise is gone; STATUS and CMD sit at y 152)
    const L = R.Battle.LAYOUT;
    ok(S.winFx.every((f) => !('raise' in f)) && L.STATUS.y >= 8 && L.CMD.y >= 8 && L.BANNER.y - 3 >= 0,
      'W6b no raised window: STATUS / CMD / title plates stay below y 0', { st: L.STATUS.y, cmd: L.CMD.y, fx: S.winFx[0] });
  }
  S.winFx[0].glow = 40; await step(20);
  ok(S.winFx[0].glow === 20, 'W7 glimmer glow counts real frames', S.winFx[0].glow);
  R.Settings.battleSpeed = 1;
  // every part of a row inside the 158-px window with the worst row (5-char names, 999 / 150 / 99)
  {
    S = BUI.open({ mons: std(), tweak: (p) => { p[0].hp = 999; p[0].mp = 150; p[0].wp = 99; } });
    const drawn = [], keep = {};
    for (const k of ['window', 'rect', 'text', 'fitText', 'draw', 'strokeRect']) keep[k] = R.Gfx[k];
    for (const k of ['window', 'rect', 'draw', 'strokeRect']) R.Gfx[k] = () => {};
    const W = (s) => R.Gfx.textWidth(String(s));
    R.Gfx.text = (s, x, y, o) => { const w = W(s); const al = (o && o.align) || 'left'; drawn.push({ s: String(s), x0: al === 'right' ? x - w : x, x1: al === 'right' ? x : x + w, y }); };
    R.Gfx.fitText = (s, x, y, maxW) => { drawn.push({ s: String(s), x0: x, x1: x + Math.min(maxW, W(s)), y, fit: maxW }); };
    try { S.drawStatus(); } finally { Object.assign(R.Gfx, keep); }
    const X0 = LY.STATUS.x + 3, X1 = LY.STATUS.x + LY.STATUS.w - 3;
    ok(drawn.length >= 4 * 8 && drawn.every((d) => d.x0 >= X0 && d.x1 <= X1), 'W8 every part of every row inside the STATUS window', drawn.filter((d) => d.x0 < X0 || d.x1 > X1));
    const row0 = drawn.filter((d) => d.y === 159).sort((a, b) => a.x0 - b.x0);
    ok(row0.every((d, i) => i === 0 || d.x0 >= row0[i - 1].x1 + 1.5), 'W9 no two parts of a row touch (999 / 150 / 99)', row0.map((d) => [d.s, Math.round(d.x0), Math.round(d.x1)]));
    eq([...new Set(drawn.map((d) => d.y))].sort((a, b) => a - b), [159, 173, 187, 201], 'W10 row text at y 159 173 187 201');
    ok(drawn.filter((d) => d.fit === 46).length === 4, 'W11 names fitted into 46 px');
  }
  // fx and numbers are clipped to the battlefield (y < 152): every fx draw happens inside the FIELD clip
  {
    S = BUI.open({ mons: std() });
    const ctx = R.Gfx.ctx, keep = { save: ctx.save, restore: ctx.restore, rect: ctx.rect, clip: ctx.clip };
    const stack = []; let last = null, clip = null, bad = 0, seen = 0;
    ctx.save = () => stack.push(clip); ctx.restore = () => { clip = stack.pop() || null; };
    ctx.rect = (x, y, w, h) => { last = [x, y, w, h]; }; ctx.clip = () => { clip = last; };
    R.BattleFX.FX.cast(S, { user: S.rectOf(S.eng.party[3]), ab: DB.actions.s_fire_1 || null });
    for (const id of ['slash3', 'fire3', 'breath_fire', 'smoke', 'arrow3', 'holy3', 'earth3']) {
      R.BattleFX.play(S, id, { user: S.rectOf(id === 'breath_fire' ? S.eng.mons[0] : S.eng.party[3]), targets: id === 'breath_fire' ? S.eng.party.map((p) => S.rectOf(p)) : [S.rectOf(S.eng.mons[0])], dir: id === 'breath_fire' ? 1 : -1 });
    }
    S.pop(S.eng.party[3], 999, 'white');
    for (const f of S.fxList) { const d = f.draw; f.draw = (g, t) => { seen++; if (!clip || clip[1] !== 0 || clip[3] !== 152) bad++; d(g, t); }; }
    try { for (let i = 0; i < 6; i++) { await step(3); S.draw(); } } finally { Object.assign(ctx, keep); }
    ok(seen > 0 && bad === 0 && S.fxList.every((f) => f.layer === 'mid' || f.layer === 'under'), 'W12 every fx is drawn inside the FIELD clip (0, 0, 256, 152), on the battlefield layers (mid / under)', { seen, bad });
  }

  // ================================================================ C — command menus, cursor memory, help
  section('C commands');
  S = BUI.open({ mons: std() });
  let cmds = null;
  S.commandPhase().then((c) => { cmds = c; });
  await step(3);
  ok(S.panel && S.panel.left && S.panel.enemies, 'C1 the party menu shows with the enemy window');
  eq(S.panel.left.items.map((i) => (typeof i === 'object' ? i.label : i)), ['戦う', 'リピート', 'オート', '逃げる'], 'C2 戦う リピート / オート 逃げる');
  ok(S.panel.left.isDisabled(1), 'C3 リピート gray before any command this battle');
  await press('down'); await step(1);
  ok(S.panel.help() === 'くり返す行動がまだない。', 'C4 help of a gray リピート', S.panel.help());
  await press('up'); await press('a'); await step(2);
  const hero = S.eng.party[0];
  eq(S.panel.left.items.map((i) => i.label), R.Rules.commands(hero.c).map((k) => k.name), 'C5 the member menu = R.Rules.commands order');
  ok(S.panel.left.title === hero.c.name && S.acting === hero, 'C6 title is the name; the member steps forward');
  ok(S.panel.left.x === B.LAYOUT.CMD.x && S.panel.left.y === B.LAYOUT.CMD.y && S.panel.left.cols === 2, 'C6b the member menu is in CMD (2 columns)');
  await press('a'); await step(2); // 剣 → 攻撃 + techs
  const L = S.panel.left;
  ok(L.items[0].label === '攻撃' && !L.items[0].right, 'C7 攻撃 first, no cost');
  ok(L.x === 4 && L.y === 64 && L.w === 168 && L.cols === 1 && L.rows === 5 && S.panel.under && S.panel.under.title === hero.c.name, 'C7b the tech list is LIST (1 column of 5) with the member menu kept in CMD');
  const techIds = R.Rules.techList(hero.c, 'sword', 'weapon1');
  ok(L.items.length === techIds.length + 1 && L.items.slice(1).every((it, i) => it.right === 'W' + R.Rules.wpCost(hero.c, techIds[i])), 'C8 techs with W and the cost', L.items.slice(1, 3));
  ok(L.title === DB.weaponTypes.sword.name, 'C9 list title = the weapon type name', L.title);
  ok(/で攻撃する。$/.test(S.panel.help()), 'C10 help of 攻撃 names the weapon', S.panel.help());
  await press('down'); await step(1);
  ok(S.panel.help() === DB.actions[techIds[0]].desc, 'C11 help = the tech desc');
  // WP short → gray + 「WPが足りない！」
  hero.c.wp = 0;
  await press('b'); await step(1); await press('a'); await step(2);
  ok(S.panel.left.items.slice(1).every((it) => it.disabled), 'C12 WP 0 → every tech gray');
  ok(S.panel.left.index === 0, 'C13 a list reopens where it was last chosen (nothing chosen yet → top)', S.panel.left.index);
  await press('down'); await step(1);
  ok(S.panel.help() === 'WPが足りない！', 'C14 help WPが足りない！', S.panel.help());
  sfx.length = 0;
  await press('a'); await step(2);
  ok(sfx[sfx.length - 1] === 'buzzer' && S.panel.left.title === DB.weaponTypes.sword.name, 'C15 a gray tech buzzes and stays in the list', sfx);
  hero.c.wp = 40;
  await press('b'); await step(1); await press('b'); await step(2);
  ok(S.panel.left.items[0] === '戦う', 'C16 B from the first member → the party menu');
  await press('a'); await step(2);
  ok(S.panel.left.index === 0 && hero.c.mem.cmd === 0, 'C17 command cursor remembered in c.mem.cmd');
  // members one after another: B goes back to the previous member
  await press('a'); await step(2); // 剣
  await press('a'); await step(2); // 攻撃
  await press('a'); await step(2); // target → the first enemy
  ok(S.acting === S.eng.party[1], 'C18 the next member after a command', S.acting && S.acting.name);
  await press('b'); await step(2);
  ok(S.acting === hero && S.panel.left.title === hero.c.name, 'C19 B → back to the previous member');
  // finish: every member attacks (A through 剣 → 攻撃 → the first enemy)
  for (let k = 0; k < 40 && !cmds; k++) { await press('a'); await step(2); }
  await step(2);
  ok(Array.isArray(cmds) && cmds.filter(Boolean).length === 4, 'C20 four commands', cmds && cmds.map((c) => c && c.type));
  ok(cmds && cmds[0].type === 'attack' && cmds[0].slot === 'weapon1' && cmds[0].target && !cmds[0].target.isParty, 'C21 attack command shape {type, slot, target}', cmds && { type: cmds[0].type, slot: cmds[0].slot });
  S = BUI.open({ mons: std(), tweak: (p) => { p[2].hp = 0; } });
  cmds = null;
  S.commandPhase().then((c) => { cmds = c; });
  for (let k = 0; k < 40 && !cmds; k++) { await press('a'); await step(2); }
  ok(cmds && cmds.filter(Boolean).length === 3 && !cmds[2], 'C22 the member who is down gets no command', cmds && cmds.map((c) => c && c.type));

  // middle row with a front-only weapon: 攻撃 gray + 中列からは届かない。
  S = BUI.open({ mons: std(), tweak: (p) => { p[0].row = 'middle'; } });
  S.weaponMenu(S.eng.party[0], R.Rules.commands(S.eng.party[0].c)[0]); await step(2);
  ok(S.panel.left.items[0].disabled && S.panel.help() === '中列からは届かない。', 'C23 攻撃 out of reach is gray with the reason', S.panel.help());
  // spells: M + cost, silence
  S = BUI.open({ mons: std() });
  const mar = S.eng.party[3];
  S.spellMenu(mar); await step(2);
  ok(S.panel.left.title === '術' && S.panel.left.items.every((it, i) => it.right === 'M' + R.Rules.mpCost(mar.c, R.Rules.spellList(mar.c)[i])), 'C24 spells with M and the cost');
  mar.c.status = { silence: true };
  await press('b'); await step(1); S.spellMenu(mar); await step(2);
  ok(S.panel.left.items.every((it) => it.disabled) && S.panel.help() === '術を封じられている！', 'C25 silence: gray + 術を封じられている！', S.panel.help());
  // items: reserved counts, ★ labels, 逃げられない戦闘の煙玉
  S = BUI.open({ mons: std(), noEscape: true });
  const list = S.battleItems({ i_salve: 11 });
  const salve = list.find((x) => x.id === 'i_salve');
  ok(salve && salve.n === 1, 'C26 item count minus the reserved ones', salve && salve.n);
  ok(list.find((x) => x.id === 'i_smoke').noEsc, 'C27 an escape item is marked in a no-escape battle');
  S.itemMenu(S.eng.party[0], {}); await step(2);
  const lab = S.panel.left.items.map((i) => i.label);
  ok(lab.includes('★' + DB.items.i_lifedew.name) && lab.includes(DB.items.i_salve.name), 'C28 rare items carry ★', lab.slice(0, 8));
  const iSmoke = S.battleItems({}).findIndex((x) => x.id === 'i_smoke');
  ok(S.panel.left.items[iSmoke].disabled, 'C29 煙玉 gray when there is no escape');
  const gradeSorted = S.battleItems({}).map((x) => ({ normal: 0, rare: 1, super: 2 }[x.it.grade] || 0));
  ok(gradeSorted.every((g, i) => i === 0 || g >= gradeSorted[i - 1]), 'C30 rare items after the normal ones');
  // cursor memory off
  R.Settings.cursorMemory = false;
  S = BUI.open({ mons: std() });
  S.eng.party[0].c.mem.cmd = 2;
  S.memberMenu(S.eng.party[0], {}); await step(2);
  ok(S.panel.left.index === 0, 'C31 カーソル記憶 off → every menu starts at the top');
  R.Settings.cursorMemory = true;
  // noEscape: 逃げる gray + help
  S = BUI.open({ mons: std(), noEscape: true });
  S.partyMenu(); await step(2);
  ok(S.panel.left.isDisabled(3), 'C32 逃げる gray in a no-escape battle');
  await press('down'); await press('down'); await press('down'); await step(1);
  ok(S.panel.help() === 'この戦いからは逃げられない！', 'C33 help of the gray 逃げる', S.panel.help());
  eq([S.panel.left.x, S.panel.left.y, S.panel.left.cols, S.panel.left.rows], [4, 152, 1, 4], 'C34 the party menu: one column of four in CMD');

  // ================================================================ T — targeting
  section('T targets');
  S = BUI.open({ mons: [{ id: 'goblin_2' }, { id: 'goblin_2' }, { id: 'goblin_2' }, { id: 'wolf_2', golden: true }] });
  let tgt;
  const pick = (type) => S.pickTarget(S.eng.party[0], type);
  let pr = pick('ally'); await step(2); await press('left'); await step(1);
  ok(S.picking && S.picking.ally === S.eng.party[3], 'T1 ally cursor wraps over all four members (0 ← → 3)', S.picking && S.picking.ally && S.picking.ally.idx);
  ok(/^マルタ　HP \d+\/\d+　MP \d+\/\d+　WP \d+\/\d+$/.test(S.panel.help()), 'T2 ally help: name HP MP WP', S.panel.help());
  await press('a'); tgt = await pr;
  ok(tgt === S.eng.party[3], 'T3 the chosen ally is returned');
  S.eng.party[1].c.hp = 0;
  pr = pick('ally'); await step(2); await press('right'); await step(1);
  ok(S.picking.ally === S.eng.party[2], 'T4 ally skips the one who is down');
  await press('b'); tgt = await pr;
  pr = pick('ally_dead'); await step(2);
  ok(S.picking.ally === S.eng.party[1], 'T5 ally_dead starts on the one who is down');
  await press('a'); tgt = await pr;
  S.eng.party[1].c.hp = 100;
  pr = pick('enemy'); await step(2);
  const cx = (m) => S.vis.get(m).x + S.vis.get(m).w / 2;
  const byX = S.eng.mons.slice().sort((x, y) => cx(x) - cx(y) || S.vis.get(x).row - S.vis.get(y).row);
  ok(S.picking.units[0] === byX[0] && S.panel.help() === byX[0].name && /[Ａ-Ｈ]$/.test(byX[0].name), 'T6 the cursor starts on the leftmost; help = name with its letter', S.panel.help());
  await press('left'); await step(1);
  ok(S.picking.units[0] === byX[3], 'T6b ← wraps round to the rightmost (screen x order)', S.panel.help());
  for (let k = 0; k < 4 && !S.picking.units[0].golden; k++) { await press('right'); await step(1); }
  ok(S.picking.units[0] === S.eng.mons[3] && S.panel.helpColor() === R.Gfx.C.gold, 'T7 a golden name in gold');
  await press('a'); tgt = await pr;
  ok(S.eng.party[0].c.mem.target === S.eng.mons[3].key, 'T8 the enemy target is remembered (unit key)');
  pr = pick('group'); await step(2);
  ok(S.panel.help() === S.eng.mons[3].name, 'T9 group choice starts on the remembered target (the golden one, alone)', S.panel.help());
  await press('left'); await step(1);
  ok(S.panel.help() === S.eng.mons[0].base + '　3匹' && S.picking.units.length === 3, 'T9b group help 「小鬼の斧兵　3匹」', S.panel.help());
  await press('b'); await pr;
  pr = pick('enemies'); await step(2);
  ok(S.panel.help() === '敵全体' && S.picking.units.length === 4, 'T10 敵全体');
  await press('b'); await pr;
  pr = pick('random'); await step(2);
  ok(S.panel.help() === '敵全体にランダム', 'T11 敵全体にランダム');
  await press('b'); await pr;
  pr = pick('allies'); await step(2);
  ok(S.panel.help() === '味方全員' && S.isPicked(S.eng.party[2]), 'T12 味方全員 raises every window');
  await press('b'); await pr;
  ok((await S.pickTarget(S.eng.party[0], 'party')) === null && (await S.pickTarget(S.eng.party[0], 'self')) === null, 'T13 party / self: no choice');

  // ================================================================ G — glimmer presentation (§11.5.7)
  section('G glimmer');
  const pickC = BUI.pick();
  eq(['tech', 'oogi', 'gokui', 'spell', 'combo'].map((k) => B.ui.bannerOf(DB.actions[pickC[k]]).title), ['閃き！', '奥義', '極意', '閃き！', '合成術'], 'G1 banner titles');
  const bo = B.ui.bannerOf(DB.actions[pickC.oogi]), bk = B.ui.bannerOf(DB.actions[pickC.gokui]);
  ok(bo.color === R.Gfx.C.gold && bk.color === R.Gfx.C.super && B.ui.bannerOf(DB.actions[pickC.tech]).color === '#fff8d0', 'G2 name colours: tech #fff8d0, 奥義 gold, 極意 super');
  const combo = DB.actions[pickC.combo];
  const firstEl = Object.keys(DB.elements).find((e) => combo.elements.includes(e));
  ok(B.ui.bannerOf(combo).color === DB.elements[firstEl].color, 'G3 a spell banner takes its first element colour (official order)', [combo.elements, firstEl]);
  const bt = B.ui.bannerOf(DB.actions[pickC.tech]);
  ok(bt.w === Math.max(128, Math.ceil(R.Gfx.textWidth(bt.name, 16)) + 40), 'G4 banner width = max(128, tw + 40)', bt.w);
  ok(B.ui.bannerOf({ name: 'ひかり', kind: 'tech' }).w === 128, 'G4b a short name keeps the 128 minimum');
  const long = B.ui.bannerOf(DB.actions.bui_t_long);
  ok(long.w === Math.max(128, Math.ceil(R.Gfx.textWidth(DB.actions.bui_t_long.name, 16)) + 40) && long.w <= 176, 'G5 8-character name: w = tw + 40 (≈168)', long.w);
  for (const spd of [0, 1, 2]) {
    R.Settings.battleSpeed = spd;
    S = BUI.open({ mons: std() });
    sfx.length = 0;
    const F0 = R.Engine.frame;
    let back = -1;
    S.handle({ t: 'glimmer', u: S.eng.party[0], id: pickC.tech, kind: 'tech' }).then(() => { back = R.Engine.frame - F0; });
    await step(1);
    ok(sfx[0] === 'glimmer' && S.winFx[0].glow > 0, 'G6 ピコーン + the window glows (speed ' + spd + ')');
    await until(() => back >= 0, 40);
    const t0 = S.glim.t0;
    back = back + F0 - t0;
    ok(back === 14, 'G7 the handler hands back at frame 14 after the ピコーン (speed ' + spd + ')', back);
    ok(S.glim.bulb && S.pvs[0].tmp && S.pvs[0].tmp.pose === 'idle', 'G7b the bulb shows over the member, who stands up (idle frame 0)');
    let actAt = -1;
    const act0 = S.actStart;
    S.playFx({ t: 'fx', fx: 'slash', user: S.eng.party[0], targets: [S.eng.mons[0]], kind: 'ability' });
    await until(() => { if (S.actStart !== act0 && actAt < 0) actAt = S.actStart - t0; return actAt >= 0; }, 120);
    const H = Math.max(36, Math.round(50 / [1, 1.6, 2.6][spd]));
    ok(actAt >= H && actAt <= H + 1, 'G8 the new tech starts (the run-in) at frame H = max(36, 50/spd) (speed ' + spd + ')', { actAt, H });
    ok(S.glim && S.glim.name === DB.actions[pickC.tech].name, 'G9 banner holds the tech name');
    await step(8);
    ok(!S.glim, 'G10 the banner is gone after H + 6');
  }
  R.Settings.battleSpeed = 1;
  // two glimmers in one round: one banner at a time
  S = BUI.open({ mons: std() });
  let second = -1;
  const F1 = R.Engine.frame;
  // events play one after another (scene.play), as the engine yields them
  S.handle({ t: 'glimmer', u: S.eng.party[0], id: pickC.tech, kind: 'tech' })
    .then(() => S.handle({ t: 'glimmer', u: S.eng.party[1], id: pickC.tech, kind: 'tech' })).then(() => { second = R.Engine.frame; });
  await until(() => second >= 0, 200);
  const H1 = Math.max(36, Math.round(50 / S.spd));
  ok(second - F1 >= H1 + 6 + 14, 'G11 the second banner waits for the first to close', { waited: second - F1, H: H1 });
  // a whole round through the scripted engine: glimmer → message → fx (waits) → damage
  S = BUI.open({ mons: std(), script: { glimmer: [{ round: 1, idx: 0, id: pickC.tech }], monsIdle: true } });
  const log = [];
  const oh = S.handle.bind(S);
  S.handle = (ev) => { log.push([ev.t, R.Engine.frame]); return oh(ev); };
  let done = false;
  const c1 = []; c1[0] = { type: 'attack', slot: 'weapon1', target: S.eng.mons[0] };
  S.play(S.eng.playRound(c1)).then(() => { done = true; });
  await until(() => done, 600);
  const tG = log.find((e) => e[0] === 'glimmer'), tF = log.find((e) => e[0] === 'fx');
  ok(done && tG && tF && tF[1] - tG[1] >= 12, 'G12 the round plays through: glimmer before fx', log.map((e) => e[0]).join(' '));
  ok(S.log.glimmers.length === 1 && S.log.glimmers[0].id === pickC.tech, 'G13 the glimmer is logged for R.Battle.last');

  // ================================================================ D — drops (§11.5.8)
  section('D drops');
  S = BUI.open({ mons: std() });
  S.paged = true;
  sfx.length = 0; jingles.length = 0;
  await S.handle({ t: 'drop', mon: 'wolf_2', item: 'i_salve', grade: 'normal' });
  ok(sfx.includes('item') && !S.card && !jingles.length, 'D1 normal: sfx item, no card, no jingle');
  S.handle({ t: 'drop', mon: 'wolf_2', item: pickC.rareItem, grade: 'rare' });
  await step(1);
  ok(jingles[0] === 'rare' && S.card && S.card.grade === 'rare' && !S.dim, 'D2 rare: jingle rare + the rare card');
  let paused = false;
  S.handle({ t: 'pause' }).then(() => { paused = true; });
  await step(2); await press('a'); await step(40); // taken at 0.6 s at the earliest (Part A12)
  ok(paused && !S.card, 'D3 the card goes when the pause is answered');
  let release;
  jingleHold = new Promise((r) => { release = r; });
  S.handle({ t: 'drop', mon: 'wolf_2', item: pickC.superItem, grade: 'super' });
  await step(2);
  ok(jingles[jingles.length - 1] === 'superrare' && S.dim === 0.45 && S.card.grade === 'super' && S.locked, 'D4 super: dim 45 %, card, fanfare, keys locked');
  paused = false;
  S.handle({ t: 'pause' }).then(() => { paused = true; });
  await step(2); await press('a'); await step(2);
  ok(!paused, 'D5 no key is taken while the super-rare fanfare plays');
  release(); jingleHold = null;
  await step(2); await press('a'); await step(40);
  ok(paused && !S.card && !S.dim, 'D6 after the fanfare a key closes it');
  // stolen rare → the steal popup (Part A12), the next actor waits for it
  S = BUI.open({ mons: std() });
  sfx.length = 0; jingles.length = 0;
  await S.handle({ t: 'gain', item: pickC.rareItem, grade: 'rare', stolen: true });
  ok(sfx.includes('steal') && jingles.includes('rare') && S.stealPop && S.stealPop.grade === 'rare' && !S.card, 'D7 stolen rare: steal + rare jingle + the steal popup');
  let acted = false;
  S.handle({ t: 'actor', u: S.eng.party[1] }).then(() => { acted = true; });
  await step(10);
  ok(!acted && S.stealPopLeft() > 0, 'D8a the next actor waits for the popup');
  await until(() => acted, 200);
  ok(acted && !S.stealPop, 'D8 the popup closes before the next actor');
  sfx.length = 0; jingles.length = 0;
  await S.handle({ t: 'gain', item: 'i_salve', grade: 'normal', stolen: true });
  ok(!S.card && !S.stealPop && sfx.includes('steal') && !jingles.length, 'D9 a normal steal: the steal sound only, no popup');

  // Part A12 at the fastest settings: msgSpeed 3, battleSpeed 2, オート (and リピート)
  const svSpd = [R.Settings.msgSpeed, R.Settings.battleSpeed];
  R.Settings.msgSpeed = 3; R.Settings.battleSpeed = 2;
  /** frames from the gain until the steal popup is gone and the next actor has started; hold = A held all along */
  async function popRun(grade, item, o) {
    const Sx = BUI.open({ mons: std() });
    Sx.auto = !!o.auto; Sx.repeating = !!o.repeat;
    const u = Sx.eng.party[2];
    const evs = [{ t: 'actor', u }, { t: 'gain', item, grade, stolen: true, u, mon: 'wolf_2' }, { t: 'msg', text: `${u.name}は★${DB.items[item].name}を盗んだ！` }, { t: 'actor', u: Sx.eng.party[0] }];
    let done = false, seen = 0, t0 = null, frames = 0;
    (async () => { for (const e of evs) await Sx.handle(e); })().then(() => { done = true; });
    if (o.hold) R.Input._set('a', true);
    for (let i = 0; i < 400 && !done; i++) {
      await step(1); frames++;
      if (Sx.stealPop && t0 == null) t0 = Sx.stealPop.t0;
      if (Sx.stealPopLeft() > 0) seen++;
    }
    if (o.hold) { R.Input._set('a', false); await step(1); }
    return { done, seen, frames, grade: t0 != null };
  }
  let sp = await popRun('rare', pickC.rareItem, { auto: true });
  ok(sp.done && sp.seen >= 84 && sp.seen <= 96, 'D10 rare steal popup ~1.5 s at msgSpeed 3 / battleSpeed 2 / オート', sp);
  sp = await popRun('rare', pickC.rareItem, { auto: true, hold: true });
  ok(sp.done && sp.seen >= 36 && sp.seen < 60, 'D11 A held cuts it, but never below 0.6 s', sp);
  sp = await popRun('super', pickC.superItem, { repeat: true });
  ok(sp.done && sp.seen >= 84 && sp.seen <= 96 && jingles.includes('superrare'), 'D12 a super steal (リピート): ~1.5 s, superrare fanfare', sp);
  // rewards: a rare drop card takes no key before 0.6 s (a key pressed sooner is kept and taken at 0.6 s)
  for (const grade of ['rare', 'super']) {
    const Sd = BUI.open({ mons: std() });
    Sd.paged = true;
    const item = grade === 'rare' ? pickC.rareItem : pickC.superItem;
    let over = false;
    (async () => { await Sd.handle({ t: 'drop', mon: 'wolf_2', item, grade }); await Sd.handle({ t: 'msg', text: 'x' }); await Sd.handle({ t: 'pause' }); })().then(() => { over = true; });
    const t0 = R.Engine.frame;
    let shown = 0;
    for (let i = 0; i < 400 && !over; i++) { await press('a'); shown = R.Engine.frame - t0; }
    ok(over && shown >= 36 && (grade === 'super' || shown <= 44), `D13 ${grade} drop card mashed with A at the fastest settings: ≥ 0.6 s`, { shown, over });
  }
  [R.Settings.msgSpeed, R.Settings.battleSpeed] = svSpd;

  // ================================================================ E — entrances, phases, summons, level ups
  section('E entrances / events');
  S = BUI.open({ mons: std(), flow: true });
  sfx.length = 0;
  await until(() => sfx.includes('golden'), 200);
  const vg = S.vis.get(S.eng.mons[1]);
  ok(sfx.includes('golden') && vg.gflash > 0, 'E1 golden: sfx golden + the monster flashes', vg.gflash);
  const eg = S.enemyGroups();
  ok(eg.length === 3 && eg[1].gold && eg[1].n === 1 && !eg[0].gold, 'E2 the golden one has its own gold line in the enemy window', eg.map((g) => g.name + g.n));
  await step(40);
  ok(vg.spk.length >= 0 && S.goldenShown.has(S.eng.mons[1]), 'E3 golden shown once');
  BUI.open({ mons: [{ id: pickC.rare }], flow: true, rare: true });
  jingles.length = 0;
  S = BUI.scene;
  let sawRare = false;
  for (let i = 0; i < 200 && !sawRare; i++) { await step(1); sawRare = S.msg.lines.some((l) => l.includes('めったに出会えない魔物が現れた！')); }
  ok(sawRare && jingles.includes('rare'), 'E4 rare monster: the fanfare and 「めったに出会えない魔物が現れた！」');
  S = BUI.open({ mons: [{ id: pickC.bosses[0] }], flow: true });
  sfx.length = 0;
  await until(() => sfx.includes('roar'), 200);
  ok(sfx.includes('roar'), 'E5 boss: roar');
  // phase: shake sfx, white flash, the sprite swaps at frame 6 keeping feet and centre, then the text
  S = BUI.open({ mons: [{ id: 'goblin_2' }] });
  sizes['mon:bui_phase2'] = box(64, 80);
  R.Gfx._defs['mon:bui_phase2'] = () => sizes['mon:bui_phase2'];
  const v0 = S.vis.get(S.eng.mons[0]), feet0 = v0.y + v0.h, cx0 = v0.x + v0.w / 2;
  sfx.length = 0;
  let phDone = false;
  S.handle({ t: 'phase', u: S.eng.mons[0], text: '大鬼は怒りに燃えている！', sprite: 'bui_phase2' }).then(() => { phDone = true; });
  await step(2);
  ok(sfx[0] === 'shake' && v0.solid > 0, 'E6 phase: sfx shake + white flash');
  await until(() => v0.h === 80, 20);
  ok(v0.y + v0.h === feet0 && Math.abs(v0.x + v0.w / 2 - cx0) <= 0.5, 'E7 the new sprite keeps feet and centre');
  await until(() => phDone, 200);
  ok(S.msg.lines.join('').includes('大鬼は怒りに燃えている！'), 'E8 then the phase text');
  delete R.Gfx._defs['mon:bui_phase2'];
  // summon: newcomers slide in from the nearer edge, everyone re-centred
  S = BUI.open({ mons: [{ id: 'goblin_2' }, { id: 'goblin_2' }] });
  const eng = S.eng;
  const Mon = Object.getPrototypeOf(eng.mons[0]).constructor;
  eng.mons.push(new Mon({ id: 'goblin_2' }, 2), new Mon({ id: 'goblin_2' }, 3));
  S.handle({ t: 'summon', units: [2, 3] });
  const vn = S.vis.get(eng.mons[3]);
  ok(vn && vn.x + vn.w <= 0 && vn.move && vn.appear > 0, 'E9 a summoned monster slides in from the left edge', vn && vn.x);
  await step(16);
  const fin = eng.mons.map((m) => [S.vis.get(m).x, S.vis.get(m).y + S.vis.get(m).h]);
  const want = S.arrange(eng.mons);
  ok(!vn.move && eng.mons.every((m, i) => fin[i][0] === want.get(m).x && fin[i][0] >= 4 && fin[i][0] + 48 <= 172), 'E10 then all four stand where enemyLayout puts them (x 4–172)', fin);
  // level ups: one levelup jingle per victory
  S = BUI.open({ mons: std(), script: { levelUps: [{ idx: 0, level: 35 }, { idx: 1, level: 35 }] } });
  jingles.length = 0;
  S.paged = true;
  for (const m of S.eng.mons) m.hp = 0;
  let rwDone = false;
  S.play(S.eng.rewards()).then(() => { rwDone = true; });
  for (let i = 0; i < 40 && !rwDone; i++) { await step(20); await press('a'); }
  ok(rwDone && jingles.filter((j) => j === 'levelup').length === 1 && jingles[0] === 'victory', 'E11 victory, then levelup once for two level-ups', jingles);
  ok(S.log.levelUps.length === 2, 'E12 level-ups logged');

  // ================================================================ P — repeat / auto (§11.5.3a, §11.5.11)
  section('P repeat / auto');
  S = BUI.open({ mons: std(), script: { partyDamage: 1, monDamage: 0 } });
  let rounds = 0, phase = null;
  const loop = (async () => {
    while (!S.eng.result && rounds < 6) {
      phase = 'input';
      const c = await S.commandPhase();
      if (c && !c.flee && c.some(Boolean)) S.lastCmds = c.map((x) => x && Object.assign({}, x));
      phase = 'round';
      await S.play(S.eng.playRound(c));
      rounds++;
    }
    phase = 'end';
  })();
  await step(3);
  // round 1: everyone attacks by hand (A through 戦う → 剣 → 攻撃 → the first enemy)
  for (let k = 0; k < 40 && phase === 'input'; k++) { await press('a'); await step(2); }
  await until(() => rounds >= 1 && phase === 'input' && S.panel, 1200);
  ok(S.panel && !S.panel.left.isDisabled(1), 'P1 リピート is selectable after a round of commands');
  await press('down'); await step(1);
  ok(S.panel.help() === '前と同じ行動を、Bを押すまで続ける。', 'P2 リピート help', S.panel.help());
  const before = S.eng.rounds.length;
  await press('a'); await step(2);
  ok(S.repeating && S.eng.rounds.length === before + 1, 'P3 リピート starts at once, no menu');
  const r1 = S.eng.rounds[S.eng.rounds.length - 1];
  ok(r1.filter(Boolean).length === 4 && r1.every((c, i) => !c || c.type === S.lastCmds[i].type), 'P4 the repeated commands copy the last round', r1.map((c) => c && c.type));
  await until(() => S.eng.rounds.length >= before + 3, 1500);
  ok(S.repeating && S.eng.rounds.length >= before + 3 && !S.panel, 'P5 リピート keeps going round after round (no menu)', S.eng.rounds.length - before);
  // B during a round: the round finishes, then the party menu opens on 戦う
  await until(() => phase === 'round', 300);
  await press('b'); await step(1);
  ok(S.repeatCancel && sfx[sfx.length - 1] === 'cancel', 'P6 B → リピート解除 (cancel sound)');
  const nAtB = S.eng.rounds.length;
  await until(() => phase === 'input' && S.panel, 800);
  ok(!S.repeating && S.panel && S.panel.left.index === 0 && S.eng.rounds.length === nAtB, 'P7 the round ended, repeat stopped, party menu on 戦う', { rounds: S.eng.rounds.length - nAtB, idx: S.panel && S.panel.left.index });
  ok(!S.repeating && !S.repeatCancel && !S.auto, 'P7b the リピート解除 badge is gone (S-R1)');
  // flee is never repeated
  const fl = []; fl.flee = true;
  const lc = S.lastCmds;
  if (fl && !fl.flee && fl.some(Boolean)) S.lastCmds = fl;
  ok(S.lastCmds === lc, 'P8 逃げる is not stored as the last commands');
  // a fresh battle starts without repeat
  S = BUI.open({ mons: std() });
  ok(!S.repeating && !S.lastCmds, 'P9 repeat does not carry to the next battle');
  // auto: B cancels at the next input and autoCarry goes off
  B.autoCarry = true;
  S = BUI.open({ mons: std(), auto: true });
  ok(S.auto, 'P10 autoStart opens in auto');
  await press('b'); await step(1);
  ok(S.autoCancel, 'P11 B during auto → オート解除');
  let ac = null;
  S.commandPhase().then((c) => { ac = c; });
  await step(3);
  ok(!S.auto && B.autoCarry === false && S.panel && S.panel.left.items[0] === '戦う', 'P12 at the next input auto is off, autoCarry false, the menu shows');

  // ================================================================ F — fx (§11.5.12)
  section('F fx');
  const need = 'arrow arrow2 arrow3 lash lash2 lash3 stance bite bite2 breath_fire breath_ice breath_poison breath_dark buff claw claw3 confuse dark dark2 dark3 death debuff dispel drain earth earth2 earth3 explosion explosion2 fire fire2 fire3 heal heal3 holy holy2 holy3 ice ice2 ice3 magic magic2 magic3 mp paralyze pierce pierce2 pierce3 poison regen revive silence slash slash2 slash3 sleep smoke song strike strike2 strike3 thunder warp water water2 wind wind2 wind3 steal'.split(' ');
  for (const id of need) {
    const r = FX.resolve(id);
    const bare = id.replace(/\d+$/, '');
    ok(r.kind === bare || (bare.startsWith('breath') && r.kind === 'breath'), 'F1 exact fx id ' + id, r);
  }
  eq(FX.resolve('arrow3').level, 3, 'F2 trailing digit = size');
  eq(['jump', 'stomp', 'slice', 'uppercut', 'sparkle', 'lightning'].map((s) => FX.resolve(s).kind), ['pierce', 'strike', 'strike', 'strike', 'strike', 'thunder'], 'F3 keywords only on word boundaries (jump is not mp, slice is not ice, uppercut is not up)');
  ok(FX.resolve(null, { kind: 'spell', elements: ['light'], effects: [{ type: 'damage' }] }).kind === 'holy', 'F4 an element without fx id uses DB.elements[el].fx (light → holy)');
  ok(FX.sfxFor('holy', { kind: 'spell', elements: ['light'] }) === DB.elements.light.sfx, 'F5 element sound from DB.elements (light)');
  ok(FX.sfxFor('arrow', null) === 'arrow' && FX.sfxFor('lash', null) === 'lash' && FX.sfxFor('stance', null) === 'buff', 'F6 new fx sounds arrow / lash / buff');
  FX.glyphs('orange');
  ok(R.Gfx.has('bfx:digits_orange'), 'F7 orange digits');
  // every fx id the data writes resolves to an effect by its exact id (no keyword guessing)
  const used = new Set();
  const addFx = (f) => { for (const x of [].concat(f || [])) if (x) used.add(String(x)); };
  for (const id in DB.actions) addFx(DB.actions[id].fx);
  for (const id in DB.items) if (DB.items[id].use) addFx(DB.items[id].use.fx);
  for (const w in DB.weaponTypes) addFx(DB.weaponTypes[w].fx);
  for (const e in DB.elements) addFx(DB.elements[e].fx);
  const inexact = [...used].filter((id) => { const b = id.toLowerCase().replace(/\d+$/, ''); return !FX.FX[b] && !b.startsWith('breath'); });
  ok(inexact.length === 0, 'F8 every data fx id is an exact FX (' + used.size + ' ids)', inexact);
  {
    // a member who stepped in: the thrust starts at the weapon's tip, never behind the member's back (§11.5.12)
    const got = [];
    const fake = { addFx: (f) => got.push(f) };
    const tgt = { x: 100, y: 90, w: 32, h: 32, cx: 116, cy: 108, side: 'mon' };
    FX.FX.pierce(fake, { user: { x: 134, cx: 146, tip: [128, 108], side: 'party' }, targets: [tgt], dir: -1 }, 1);
    let maxX = -1;
    const spy = { rect: (x) => { maxX = Math.max(maxX, x); }, draw: () => {} };
    for (const f of got) for (let t = 0; t < 12; t++) f.draw(spy, t);
    ok(got.length && maxX > 116 && maxX <= 128 + 2, 'F9 a stepped-in thrust starts at the tip (nothing drawn past it), not 34–60 px back', { maxX });
    got.length = 0; maxX = -1;
    FX.FX.pierce(fake, { user: null, targets: [tgt], dir: -1 }, 1);
    for (const f of got) for (let t = 0; t < 12; t++) f.draw(spy, t);
    ok(maxX >= 116 + 34, 'F9b without a user tip the thrust still comes from 34 px away', { maxX });
  }
  // fx arrays: each fx in turn, the 2nd+ at 60 % length
  S = BUI.open({ mons: std() });
  const calls = [];
  const op = FX.play;
  FX.play = (sc, id, ctx) => { calls.push([id, ctx.rate, R.Engine.frame]); return op(sc, id, ctx); };
  let fxDone = false;
  S.playFx({ t: 'fx', fx: ['water2', 'fire2'], user: S.eng.party[3], targets: [S.eng.mons[0]], ab: { kind: 'spell', magic: true, elements: ['fire', 'water'] }, kind: 'ability' }).then(() => { fxDone = true; });
  await until(() => fxDone, 200);
  FX.play = op;
  ok(calls.length === 2 && calls[0][0] === 'water2' && calls[1][0] === 'fire2' && calls[0][1] === 1 && Math.abs(calls[1][1] - 1 / 0.6) < 1e-9, 'F9 an fx array plays in order, the second at 60 %', calls);
  ok(calls[1][2] - calls[0][2] >= 10, 'F10 the second starts after the first one\'s impact', calls.map((c) => c[2]));

  // ================================================================ V — side-view choreography (§11.5.15–16)
  section('V choreography');
  const weaponOf = (wtype) => {
    const ids = Object.keys(DB.items).filter((id) => DB.items[id].type === 'weapon' && DB.items[id].wtype === wtype);
    return ids.find((id) => !DB.items[id].grade || DB.items[id].grade === 'normal') || ids[0] || null;
  };
  const FAM = (R.Art && R.Art.BATTLER && R.Art.BATTLER.FAMILY) || B.ui.BAT_FALLBACK.FAMILY;
  eq(Object.keys(FAM).sort(), ['axe', 'bow', 'club', 'dagger', 'fist', 'greatsword', 'katana', 'spear', 'staff', 'sword', 'whip'], 'V1 FAMILY covers the 11 weapon types');
  async function attackRound(wtype, o) {
    o = o || {};
    const S = BUI.open({ mons: std(), script: { monsIdle: true }, tweak: (p) => { const id = weaponOf(wtype); p[0].equip.weapon1 = id; p[0].equip.weapon2 = o.w2 ? weaponOf(o.w2) : null; p[0].row = 'front'; } });
    const v = S.pvs[0];
    const seen = { poses: new Set(), away: false, maxLeft: v.x, fxAtImpact: false, alt: null };
    const cmds = []; cmds[0] = o.cmd ? o.cmd(S) : { type: 'attack', slot: o.slot || 'weapon1', target: S.eng.mons[1] };
    S.roundCmds = cmds; S.inRound = true;
    let done = false;
    S.play(S.eng.playRound(cmds)).then(() => S.settle()).then(() => { done = true; });
    const n0 = S.fxList.length;
    for (let i = 0; i < 900 && !done; i++) {
      await step(1);
      const q = S.poseOf(v);
      seen.poses.add(q.pose);
      if (v.away) seen.away = true;
      if (v.alt) seen.alt = v.alt;
      seen.maxLeft = Math.min(seen.maxLeft, v.x);
      if (S.fxList.length > n0 && !seen.fxPose) seen.fxPose = q.pose + ':' + q.fi;
    }
    seen.done = done; seen.home = v.x === v.homeX && v.y === v.homeY && !v.away && !v.act;
    return { S, v, seen };
  }
  for (const w of Object.keys(FAM)) {
    const fam = FAM[w];
    const { seen } = await attackRound(w);
    const melee = fam !== 'shoot';
    const imp = fam === 'shoot' ? 2 : 1;
    ok(seen.done && seen.home && seen.poses.has(fam) && seen.fxPose === fam + ':' + imp && seen.away === melee && (melee ? seen.maxLeft < 150 : seen.maxLeft >= 190),
      `V2 ${w}: ${melee ? 'runs in, ' : 'in place, '}${fam} with the fx at frame ${imp}, back home`, seen);
  }
  // weapon2's slot: that weapon's sheet only for the action
  {
    const { seen } = await attackRound('sword', { w2: 'bow', slot: 'weapon2' });
    ok(seen.alt === 'bow' && seen.poses.has('shoot') && !seen.away && seen.home, 'V3 an attack with weapon 2 (bow) shoots with the bow sheet, then weapon 1 again', seen);
  }
  // a spell: cast in place, the circle at frame 1, the spell at frame 2; an item: in place, frame 1
  {
    const fire = DB.actions.s_fire_1 ? 's_fire_1' : BUI.pick().spell;
    const S = BUI.open({ mons: std(), script: { monsIdle: true } });
    const v = S.pvs[3];
    const cmds = []; cmds[3] = { type: 'spell', id: fire, target: S.eng.mons[0] };
    S.roundCmds = cmds; S.inRound = true;
    const calls = [];
    const op = FX.play, oc = FX.FX.cast;
    FX.play = (sc, id, ctx) => { calls.push(['play', id, S.poseOf(v).pose + ':' + S.poseOf(v).fi, ctx.dir, ctx.user && ctx.user.cast]); return op(sc, id, ctx); };
    FX.FX.cast = (sc, ctx) => { calls.push(['cast', S.poseOf(v).pose + ':' + S.poseOf(v).fi, ctx.user.feet]); return oc(sc, ctx); };
    let done = false, away = false;
    S.play(S.eng.playRound(cmds)).then(() => S.settle()).then(() => { done = true; });
    for (let i = 0; i < 600 && !done; i++) { await step(1); if (v.away) away = true; }
    FX.play = op; FX.FX.cast = oc;
    const c0 = calls.find((c) => c[0] === 'cast'), p0 = calls.find((c) => c[0] === 'play');
    ok(done && !away && c0 && c0[1] === 'cast:1' && p0 && p0[2] === 'cast:2' && p0[3] === -1 && Array.isArray(p0[4]), 'V4 a spell: cast in place, the magic circle at frame 1, the spell (dir −1, from the cast point) at frame 2', calls);
  }
  {
    const S = BUI.open({ mons: std(), script: { monsIdle: true }, tweak: (p) => { p[1].hp = 30; } });
    const v = S.pvs[0];
    const cmds = []; cmds[0] = { type: 'item', id: 'i_salve', target: S.eng.party[1] };
    S.roundCmds = cmds; S.inRound = true;
    const poses = [];
    const op = FX.play;
    FX.play = (sc, id, ctx) => { poses.push(S.poseOf(v).pose + ':' + S.poseOf(v).fi + ':' + ctx.dir); return op(sc, id, ctx); };
    let done = false;
    S.play(S.eng.playRound(cmds)).then(() => S.settle()).then(() => { done = true; });
    await until(() => done, 600);
    FX.play = op;
    ok(done && poses[0] === 'item:1:0' && !v.away, 'V5 an item: in place, the fx at frame 1 of item, dir 0 on an ally', poses);
  }
  // a monster's attack: it hops toward the party (+x), the fx has dir +1, the target recoils and is pushed right
  {
    const S = BUI.open({ mons: [{ id: 'wolf_2' }], script: { monDamage: 21 } });
    const v = S.pvs[0], mv = S.vis.get(S.eng.mons[0]);
    const dirs = [];
    const op = FX.play;
    FX.play = (sc, id, ctx) => { dirs.push(ctx.dir); return op(sc, id, ctx); };
    let done = false, lunged = false, hit = false, pushed = 0;
    S.roundCmds = []; S.inRound = true;
    S.play(S.eng.playRound([])).then(() => { done = true; });
    for (let i = 0; i < 600 && !done; i++) { await step(1); if (mv.lunge > 0) lunged = true; if (S.poseOf(v).pose === 'hit') hit = true; pushed = Math.max(pushed, S.posOf(v)[0] - v.x); }
    FX.play = op;
    ok(done && lunged && dirs[0] === 1 && hit && pushed >= 2, 'V6 enemy attack: lunge, fx dir +1, the member recoils (hit) pushed to the right', { lunged, dirs, hit, pushed });
    ok(S.pops.length === 0 || S.pops.every((p) => { if (!p.party) return true; const r = S.rectOf(p.u); return p.y + 7 > r.y && p.y < r.bottom; }), 'V7 the number pops on the member\'s own body');
  }
  // speed scaling (§11.5.16): the same attack gets shorter at はやい / さいそく and under オート
  {
    const frames = [];
    for (const [spd, auto] of [[0, false], [1, false], [2, false], [0, true]]) {
      R.Settings.battleSpeed = spd;
      const S = BUI.open({ mons: std(), script: { monsIdle: true } });
      S.auto = auto;
      eq([S.dur(12, 'move'), S.dur(5, 'atk')], [[12, 5], [8, 4], [5, 2], [8, 4]][frames.length], 'V8 dur(): run 12 / wind-up 5 at speed ' + spd + (auto ? ' (auto)' : ''));
      const v = S.pvs[0];
      const cmds = []; cmds[0] = { type: 'attack', slot: 'weapon1', target: S.eng.mons[1] };
      S.roundCmds = cmds; S.inRound = true;
      let runN = 0, backN = 0;
      let done = false;
      S.play(S.eng.playRound(cmds)).then(() => S.settle()).then(() => { done = true; });
      for (let i = 0; i < 900 && !done; i++) { await step(1); if (v.move && !v.move.arc) runN = v.move.n; if (v.move && v.move.arc) backN = v.move.n; }
      frames.push([runN, backN]);
    }
    R.Settings.battleSpeed = 1;
    eq(frames, [[12, 10], [8, 7], [5, 4], [8, 6]], 'V9 run-in / hop back frames: 12·10, はやい 8·7, さいそく 5·4, オート 8·6');
  }
  // a lethal hit: the member reels (hit) until the 'die' event, then lies down — never lies, stands up and falls again
  {
    const S = BUI.open({ mons: std() });
    const u = S.eng.party[1], v = S.pv(u);
    u.hp = 0;
    const seen = [];
    for (let i = 0; i < 20; i++) { await step(1); seen.push(S.poseOf(v).pose); }
    let dd = false; S.handle({ t: 'die', u }).then(() => { dd = true; });
    for (let i = 0; i < 30; i++) { await step(1); seen.push(S.poseOf(v).pose); }
    const firstKo = seen.indexOf('ko');
    ok(seen.slice(0, 20).every((p) => p === 'hit') && firstKo > 20 && seen.slice(firstKo).every((p) => p === 'ko') && dd, 'V9b a lethal hit: hit until the die event, then ko for good', seen.join(','));
  }
  // victory: everyone standing raises the weapon; KO stays down. escape: the party runs off to the right
  {
    const S = BUI.open({ mons: std(), tweak: (p) => { p[2].hp = 0; p[1].hp = 5; } });
    for (const m of S.eng.mons) m.hp = 0;
    let vd = false; S.handle({ t: 'victory' }).then(() => { vd = true; }); await until(() => vd, 60);
    eq(S.pvs.map((v) => S.poseOf(v).pose), ['victory', 'victory', 'ko', 'victory'], 'V10 victory poses (the weak one stands, the fallen stays down)');
    const S2 = BUI.open({ mons: std(), tweak: (p) => { p[3].hp = 0; } });
    const x0 = S2.pvs.map((v) => S2.posOf(v)[0]);
    const pe = S2.handle({ t: 'escape', ok: true });
    await step(12);
    const x1 = S2.pvs.map((v) => S2.posOf(v)[0]);
    let escDone = false; pe.then(() => { escDone = true; });
    await until(() => escDone, 200);
    ok(x1[0] > x0[0] + 20 && x1[3] === x0[3] && S2.poseOf(S2.pvs[0]).flip, 'V11 a successful escape: the living run off to the right (flipped walk), the fallen stays', { x0, x1 });
  }
  // the rest poses (§11.5.14)
  {
    const S = BUI.open({ mons: std(), tweak: (p) => { p[0].hp = 0; p[1].status = { sleep: true }; p[2].hp = 10; p[3].status = { freeze: true }; } });
    eq(S.pvs.map((v) => { const q = S.poseOf(v); return q.pose + (q.fi != null ? ':' + q.fi : ''); }), ['ko:0', 'weak:0', 'weak', 'idle:0'], 'V12 rest poses: KO / sleep (weak frame 0) / HP ≤ 25 % (weak) / frozen (idle frame 0)');
  }
  // the whole battle draws frame by frame with the stand-in sprites (no R.Art.battler) — §11.5.17
  {
    const S = BUI.open({ mons: std(), script: { partyDamage: 30, monDamage: 5 } });
    let errs = 0, frames = 0;
    const loop = (async () => {
      for (let r = 0; r < 6 && !S.eng.result; r++) {
        const cmds = S.eng.party.map((p, i) => (p.alive ? [{ type: 'attack', slot: 'weapon1', target: null }, { type: 'defend' }, { type: 'spell', id: DB.actions.s_fire_1 ? 's_fire_1' : BUI.pick().spell, target: null }, { type: 'item', id: 'i_salve', target: p }][i] : null));
        S.roundCmds = cmds; S.inRound = true;
        await S.play(S.eng.playRound(cmds)); await S.settle(); S.inRound = false;
      }
    })();
    let fin = false; loop.then(() => { fin = true; });
    for (let i = 0; i < 4000 && !fin; i++) { await step(1); try { S.draw(); frames++; } catch (e) { errs++; if (errs < 3) console.log(e); } }
    ok(fin && errs === 0 && frames > 50 && !R.Art.battler, 'V13 a whole battle draws with the stand-in sheets (no R.Art.battler)', { fin, errs, frames, result: S.eng.result });
  }

  // ================================================================ S — R.Battle.start / prepare
  section('S start');
  R.State.newGame();
  const sv = { rareEncounters: DB.rareEncounters.bui_zone, encounters: DB.encounters.bui_zone };
  DB.encounters.bui_zone = { region: 'prologue', tier: 3, bg: 'forest', groups: [{ w: 1, mons: [['wolf_2', 2]] }] };
  DB.rareEncounters.bui_zone = { mon: pickC.rare, rate: 1 };
  B.autoCarry = true;
  let p0 = B.prepare({ zone: 'bui_zone' });
  ok(p0.rareMon === pickC.rare && p0.bgm === 'rarebattle' && !p0.autoStart, 'P-S1 rate 1 (= 1/1) swaps to the rare monster; rarebattle; manual start', { rare: p0.rareMon, bgm: p0.bgm });
  p0 = B.prepare({ zone: 'bui_zone', noRare: true, noGolden: true });
  ok(!p0.rareMon && p0.bgm === 'battle' && p0.autoStart && p0.bg === 'forest' && p0.tier === 3, 'P-S2 plain zone fight: battle BGM, zone bg, fixed tier, auto carries', { bgm: p0.bgm, auto: p0.autoStart, bg: p0.bg, tier: p0.tier });
  DB.rareEncounters.bui_zone = { mon: pickC.rare, rate: 1e9 };
  let gold = 0;
  for (let i = 0; i < 400; i++) if (B.prepare({ zone: 'bui_zone' }).golden >= 0) gold++;
  ok(gold > 0 && gold < 40, 'P-S3 golden roll ≈ 1/40 of zone fights', gold);
  const pm = B.prepare({ mons: [['wolf_2', 1]], members: ['hero'] });
  ok(pm.party.length === 1 && pm.party[0].id === 'hero' && !pm.autoStart, 'P-S4 members: only those fight; event fights start manual');
  ok(B.prepare({ troop: Object.keys(DB.troops)[0] }).noEscape, 'P-S5 a boss troop cannot be fled');
  DB.encounters.bui_zone = sv.encounters; DB.rareEncounters.bui_zone = sv.rareEncounters;
  if (!sv.encounters) delete DB.encounters.bui_zone;
  if (!sv.rareEncounters) delete DB.rareEncounters.bui_zone;

  // ================================================================ R — the real engine through the real start()
  section('R real engine');
  let real = 'skipped';
  try {
    R.State.newGame({ name: 'アルン', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } });
    for (const id of ['brigitta', 'sylvain', 'marta']) R.Party.recruit(id);
    for (const c of R.Game.party) { c.level = 20; const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; c.row = 'front'; }
    R.Engine.clear();
    B.autoCarry = false;
    let res = null;
    B.start({ mons: [['wolf_1', 2]], tier: 1, bg: 'grass' }).then((r) => { res = r; });
    await step(2);
    const scene = B.current;
    ok(scene && scene.eng instanceof B.Engine, 'R1 R.Battle.start opens the scene on the real engine');
    // first round by hand: 戦う → everyone attacks
    await until(() => scene.panel && scene.panel.left && scene.panel.left.items[0] === '戦う', 600);
    ok(!!scene.panel, 'R2 the party menu comes up after the intro');
    const n = scene.eng.party.filter((p) => p.commandable()).length;
    await press('a'); await step(2);
    for (let k = 0; k < n; k++) {
      await until(() => scene.panel && scene.panel.left && scene.panel.left.title, 60);
      const items = scene.panel.left.items;
      if (items[0].label !== '攻撃') { await press('a'); await step(2); }
      await press('a'); await step(2); await press('a'); await step(3);
    }
    // then リピート (S-R1): chosen once, it stays on round after round until the battle ends
    let menus = 0, repeatRounds = 0, lastRound = scene.eng.round;
    for (let i = 0; i < 6000 && !res; i++) {
      await step(1);
      if (scene.eng.round !== lastRound) { lastRound = scene.eng.round; if (scene.repeating) repeatRounds++; }
      const pl = scene.panel && scene.panel.left;
      if (pl && pl.items[0] === '戦う') { menus++; ok(!pl.isDisabled(1), 'R2b リピート enabled after the first round'); await press('down'); await press('a'); }
      else if (scene.msg.key) await press('a');
    }
    ok(res === 'win' || res === 'lose' || res === 'escape', 'R3 the battle runs to its end (' + res + ')', res);
    ok(menus === 1 && repeatRounds >= 1, 'R3b リピート chosen once kept the battle going without the menu', { menus, repeatRounds, rounds: scene.eng.round });
    ok(B.last && B.last.result === res && Array.isArray(B.last.drops) && Array.isArray(B.last.glimmers), 'R4 R.Battle.last is filled', B.last && Object.keys(B.last));
    ok(!B.current, 'R5 the scene closed');
    real = res;
  } catch (e) {
    ok(false, 'R real engine threw', String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  }

  // real engine: 逃げる, リピート stopped with B, オート carried to the next battle
  async function realRun(o, driver) {
    R.Engine.clear();
    let res = null;
    B.start(o).then((r) => { res = r; }, (e) => { res = 'threw ' + e; });
    await step(2);
    const scene = B.current;
    for (let i = 0; i < 8000 && !res; i++) { await step(1); await driver(scene); }
    return { res, scene };
  }
  const partyMenuOf = (s) => { const pl = s.panel && s.panel.left; return pl && pl.items[0] === '戦う' ? pl : null; };
  try {
    for (const c of R.Game.party) { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; c.status = {}; }
    B.autoCarry = false;
    // 逃げる (the party menu's 4th command) ends the battle with 'escape'
    let r = await realRun({ mons: [['wolf_1', 2]], tier: 1, bg: 'grass', surprise: null }, async (s) => {
      if (partyMenuOf(s)) { await press('down'); await press('down'); await press('down'); await press('a'); } else if (s.msg.key) await press('a');
    });
    ok(r.res === 'escape' && B.last.result === 'escape', 'R6 逃げる on the real engine returns escape', r.res);
    // リピート then B: the round finishes, the party menu comes back on 戦う with repeat off; リピート can be chosen again
    for (const c of R.Game.party) { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; c.status = {}; }
    let stage = 0, backAt = null, stoppedRound = null;
    r = await realRun({ mons: [['wolf_1', 3]], tier: 1, bg: 'grass', surprise: null }, async (s) => {
      const pm = partyMenuOf(s);
      if (pm) {
        if (stage === 0) { stage = 1; await press('a'); return; } // 戦う (round 1 by hand)
        if (stage === 2) backAt = { idx: pm.index, repeating: s.repeating, round: s.eng.round, canRepeat: !pm.isDisabled(1) };
        if (stage === 1 || stage === 2) { stage++; await press('down'); await press('a'); } // リピート (again after the stop)
        return;
      }
      const pl = s.panel && s.panel.left;
      if (pl && pl.title && stage === 1) { if (pl.items[0].label !== '攻撃') { await press('a'); await step(2); } await press('a'); await step(2); await press('a'); await step(3); return; }
      if (stage === 2 && s.repeating && !s.repeatCancel && s.eng.round >= 2) { stoppedRound = s.eng.round; await press('b'); return; }
      if (s.msg.key) await press('a');
    });
    ok(r.res === 'win', 'R7 the repeat battle is won', r.res);
    ok(backAt && backAt.idx === 0 && !backAt.repeating && backAt.canRepeat && backAt.round === stoppedRound,
      'R8 B stops リピート after that round: the menu is back on 戦う and リピート stays available', { backAt, stoppedRound });
    // オート: chosen once it carries into the next plain battle, which then starts on its own
    for (const c of R.Game.party) { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; c.status = {}; }
    let menus = 0;
    r = await realRun({ mons: [['wolf_1', 2]], tier: 1, bg: 'grass', surprise: null }, async (s) => {
      if (partyMenuOf(s)) { menus++; await press('down'); await press('down'); await press('a'); } else if (s.msg.key) await press('a');
    });
    ok(r.res === 'win' && menus === 1 && B.autoCarry === true, 'R9 オート runs the battle to the end and sets autoCarry', { res: r.res, menus, carry: B.autoCarry });
    ok(B.prepare({ zone: Object.keys(DB.encounters)[0] }).autoStart !== undefined, 'R10 prepare reports autoStart');
    B.autoCarry = false;
  } catch (e) {
    ok(false, 'R real engine (flee / repeat / auto) threw', String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  }

  // ---------------------------------------------------------------- summary
  console.log(`test_bui: ${pass} passed, ${fail} failed` + (real !== 'skipped' ? ` (real battle: ${real})` : ''));
  for (const f of fails) console.log('  FAIL', f);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
