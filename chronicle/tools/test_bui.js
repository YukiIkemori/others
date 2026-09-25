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
function box(w, h) { return { width: w, height: h, getContext: () => null }; }
const FS = R.Gfx.FS;
R.Gfx.ctx = {
  font: '', globalAlpha: 1,
  measureText(s) { const px = parseFloat(String(this.font)) || FS; return { width: (R.Text && R.Text.approxWidth ? R.Text.approxWidth(s) : [...s].length * FS) * (px / FS) }; },
  save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}, fillText() {}, drawImage() {}, setTransform() {},
};
const realGet = R.Gfx.get.bind(R.Gfx);
R.Gfx.get = (k) => {
  if (k.startsWith('mon:')) return sizes[k] || (sizes[k] = box(48, 48));
  if (k.startsWith('bfx:') || k.startsWith('obj:') || k.startsWith('icon:') || k.startsWith('bbg:')) return box(16, 16);
  return realGet(k);
};
R.Gfx.variant = (k) => R.Gfx.get(k);
const sfx = [], jingles = [];
let jingleHold = null; // when set, R.jingle(id) returns this promise (the super-rare fanfare test)
R.sfx = (id) => { sfx.push(id); };
R.jingle = (id) => { jingles.push(id); return jingleHold || Promise.resolve(); };
R.Settings.battleSpeed = 1; R.Settings.msgSpeed = 2; R.Settings.cursorMemory = true; R.Settings.autoKeep = true;

const A = BUI.api;
const step = (n) => A.step(n);
const press = (b) => A.press(b);
async function until(fn, max) { for (let i = 0; i < (max || 600); i++) { if (fn()) return i; await step(1); } return -1; }
const std = () => [{ id: 'wolf_2' }, { id: 'wolf_2', golden: true }, { id: 'wolf_2' }, { id: 'goblin_2' }];

(async () => {
  // ================================================================ L — layout constants (§11.5.1)
  section('L layout');
  eq(B.WIN, { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, 'L1 WIN');
  ok(B.WIN_BOTTOM === 56, 'L2 WIN_BOTTOM 56');
  eq(B.HELP, { x: 8, y: 133, w: 240, h: 19 }, 'L3 HELP');
  eq([B.BOX.x, B.BOX.y, B.BOX.w, B.BOX.h], [8, 150, 240, 68], 'L4 BOX');
  ok(B.GROUND === 130, 'L5 GROUND');
  eq(B.BANNER, { y: 64, h: 32 }, 'L6 BANNER');
  eq(B.CARD, { y: 64 }, 'L7 CARD');
  ok(B.WIN.xs[3] + B.WIN.w <= 256 - 3, 'L8 four windows fit 256 px with a 3 px margin');

  let S = BUI.open({ mons: std() });
  const P = S.eng.party;
  ok(P.length === 4 && S.winFx.length === 4, 'L9 four party windows', P.length);
  P.forEach((p, i) => {
    const r = S.rectOf(p), x = B.WIN.xs[i];
    eq([r.x, r.y, r.w, r.h, r.cx, r.cy, r.bottom, r.side], [x, 5, 61, 46, x + 30, 28, 51, 'party'], 'L10 rectOf party ' + i);
  });
  S.pop(P[2], 12, 'white'); S.pop(P[2], 5, 'green');
  eq([S.pops[0].x, S.pops[0].y + 4, S.pops[1].y + 4], [159, 62, 71], 'L11 party popups centred at (x+30, y+57 + n×9)');
  // feet sinking (§11.4.2): h ≤ 64 none, 96 → +13, 112 → +20, 128 → +20 (clamp)
  eq([64, 96, 112, 128, 48].map((h) => B.Scene.feet(h)), [130, 143, 150, 150, 130], 'L12 feet = GROUND + clamp(round((h−64)/2.4), 0, 20)');
  // one row: centred, gap ≤ 8
  const pos1 = S.arrange(S.eng.mons);
  const xs = S.eng.mons.map((m) => pos1.get(m).x);
  ok(xs[0] === Math.round(128 - (4 * 48 + 3 * 8) / 2) && xs[1] - xs[0] === 56, 'L13 one row centred, gap 8', xs);
  // two rows when the total width > 256 with ≥ 4 monsters: 1st/3rd/5th behind (feet −12), 2nd/4th in front
  sizes['mon:bui_big'] = box(64, 64);
  S = BUI.open({ mons: [1, 2, 3, 4, 5].map(() => ({ id: 'wolf_2', sprite: 'bui_big' })) });
  const pos2 = S.arrange(S.eng.mons);
  const rows = S.eng.mons.map((m) => pos2.get(m));
  ok(rows[0].back && !rows[1].back && rows[2].back && !rows[3].back && rows[4].back, 'L14 two rows: odd-numbered at the back', rows.map((r) => r.back));
  ok(rows[0].y + 64 === 118 && rows[1].y + 64 === 130, 'L15 back row feet GROUND−12', [rows[0].y, rows[1].y]);
  const back = rows.filter((r) => r.back), front = rows.filter((r) => !r.back);
  ok(Math.abs((back[0].x + back[2].x + 64) / 2 - 128) <= 1 && Math.abs((front[0].x + front[1].x + 64) / 2 - 128) <= 1, 'L16 each row centred');
  S = BUI.open({ mons: [1, 2, 3].map(() => ({ id: 'wolf_2', sprite: 'bui_big' })) });
  ok([...S.vis.values()].every((v) => !v.back), 'L17 three wide monsters stay in one row (overlap allowed)');

  // ================================================================ W — status windows
  section('W windows');
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
  // DESIGN §11.3.6 grids and colours
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
  S.winFx[0].glow = 40; await step(20);
  ok(S.winFx[0].glow === 20, 'W7 glimmer glow counts real frames', S.winFx[0].glow);
  R.Settings.battleSpeed = 1;

  // ================================================================ C — command menus, cursor memory, help
  section('C commands');
  S = BUI.open({ mons: std() });
  let cmds = null;
  S.commandPhase().then((c) => { cmds = c; });
  await step(3);
  ok(S.panel && S.panel.left && S.panel.enemies, 'C1 the party menu shows with the enemy window');
  eq(S.panel.left.items.map((i) => (typeof i === 'object' ? i.label : i)), ['戦う', 'リピート', 'オート', '逃げる'], 'C2 戦う リピート / オート 逃げる');
  ok(S.panel.left.isDisabled(1), 'C3 リピート gray before any command this battle');
  await press('right'); await step(1);
  ok(S.panel.help() === 'くり返す行動がまだない。', 'C4 help of a gray リピート', S.panel.help());
  await press('left'); await press('a'); await step(2);
  const hero = S.eng.party[0];
  eq(S.panel.left.items.map((i) => i.label), R.Rules.commands(hero.c).map((k) => k.name), 'C5 the member menu = R.Rules.commands order');
  ok(S.panel.left.title === hero.c.name && S.acting === hero, 'C6 title is the name; the acting window rises');
  await press('a'); await step(2); // 剣 → 攻撃 + techs
  const L = S.panel.left;
  ok(L.items[0].label === '攻撃' && !L.items[0].right, 'C7 攻撃 first, no cost');
  const techIds = R.Rules.techList(hero.c, 'sword', 'weapon1');
  ok(L.items.length === techIds.length + 1 && L.items.slice(1).every((it, i) => it.right === 'W' + R.Rules.wpCost(hero.c, techIds[i])), 'C8 techs with W and the cost', L.items.slice(1, 3));
  ok(L.title === DB.weaponTypes.sword.name, 'C9 list title = the weapon type name', L.title);
  ok(/で攻撃する。$/.test(S.panel.help()), 'C10 help of 攻撃 names the weapon', S.panel.help());
  await press('right'); await step(1);
  ok(S.panel.help() === DB.actions[techIds[0]].desc, 'C11 help = the tech desc');
  // WP short → gray + 「WPが足りない！」
  hero.c.wp = 0;
  await press('b'); await step(1); await press('a'); await step(2);
  ok(S.panel.left.items.slice(1).every((it) => it.disabled), 'C12 WP 0 → every tech gray');
  ok(S.panel.left.index === 1, 'C13 cursor memory per list (weapon1 list remembered index 1)', S.panel.left.index);
  ok(S.panel.help() === 'WPが足りない！', 'C14 help WPが足りない！', S.panel.help());
  await press('a'); await step(2);
  ok(sfx[sfx.length - 1] === 'buzzer', 'C15 a gray tech buzzes');
  hero.c.wp = 40;
  await press('b'); await step(1); await press('b'); await step(2);
  ok(S.panel.left.items[0].label === '戦う', 'C16 B from the first member → the party menu');
  await press('a'); await step(2);
  ok(S.panel.left.index === 0 && hero.c.mem.cmd === 0, 'C17 command cursor remembered in c.mem.cmd');
  // members one after another: B goes back to the previous member
  await press('a'); await step(2); await press('a'); await step(2); // 剣 → 攻撃
  await press('a'); await step(2); // target → the first enemy
  ok(S.acting === S.eng.party[1], 'C18 the next member after a command', S.acting && S.acting.name);
  await press('b'); await step(2);
  ok(S.acting === hero, 'C19 B → back to the previous member');
  // finish: attack with everyone
  for (let k = 0; k < 4 && !cmds; k++) { await press('a'); await step(2); await press('a'); await step(2); await press('a'); await step(2); }
  await step(4);
  ok(Array.isArray(cmds) && cmds.filter(Boolean).length === 3, 'C20 three living members → three commands (the dead one is skipped)', cmds && cmds.map((c) => c && c.type));
  ok(cmds && cmds[0].type === 'attack' && cmds[0].slot === 'weapon1' && cmds[0].target && !cmds[0].target.isParty, 'C21 attack command shape {type, slot, target}', cmds && { type: cmds[0].type, slot: cmds[0].slot });
  ok(!cmds[2], 'C22 no command for the member who is down');

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
  await press('down'); await press('right'); await step(1);
  ok(S.panel.help() === 'この戦いからは逃げられない！', 'C33 help of the gray 逃げる', S.panel.help());

  // ================================================================ T — targeting
  section('T targets');
  S = BUI.open({ mons: [{ id: 'goblin_2' }, { id: 'goblin_2' }, { id: 'goblin_2' }, { id: 'wolf_2', golden: true }] });
  let tgt;
  const pick = (type, keys) => new Promise(async (res) => { S.pickTarget(S.eng.party[0], type).then(res); await step(2); for (const k of keys) { await press(k); await step(1); } });
  let pr = pick('ally', ['left']); await step(1);
  ok(S.picking && S.picking.ally === S.eng.party[3], 'T1 ally cursor wraps over all four members (0 ← → 3)', S.picking && S.picking.ally && S.picking.ally.idx);
  ok(/^マルタ　HP \d+\/\d+　MP \d+\/\d+　WP \d+\/\d+$/.test(S.panel.help()), 'T2 ally help: name HP MP WP', S.panel.help());
  await press('a'); tgt = await pr;
  ok(tgt === S.eng.party[3], 'T3 the chosen ally is returned');
  S.eng.party[1].c.hp = 0;
  pr = pick('ally', ['right']); await step(1);
  ok(S.picking.ally === S.eng.party[2], 'T4 ally skips the one who is down');
  await press('b'); tgt = await pr;
  pr = pick('ally_dead', []); await step(1);
  ok(S.picking.ally === S.eng.party[1], 'T5 ally_dead starts on the one who is down');
  await press('a'); tgt = await pr;
  S.eng.party[1].c.hp = 100;
  pr = pick('enemy', []); await step(1);
  ok(S.panel.help() === S.eng.mons[0].name && /Ａ$/.test(S.eng.mons[0].name), 'T6 enemy help = name with its letter', S.panel.help());
  await press('left'); await step(1);
  ok(S.picking.units[0] === S.eng.mons[3] && S.panel.helpColor() === R.Gfx.C.gold, 'T7 enemy cursor wraps; a golden name in gold');
  await press('a'); tgt = await pr;
  ok(S.eng.party[0].c.mem.target === S.eng.mons[3].key, 'T8 the enemy target is remembered (unit key)');
  pr = pick('group', []); await step(1);
  ok(S.panel.help() === S.eng.mons[0].base + '　3匹', 'T9 group help 「小鬼の斧兵　3匹」', S.panel.help());
  await press('b'); await pr;
  pr = pick('enemies', []); await step(1);
  ok(S.panel.help() === '敵全体' && S.picking.units.length === 4, 'T10 敵全体');
  await press('b'); await pr;
  pr = pick('random', []); await step(1);
  ok(S.panel.help() === '敵全体にランダム', 'T11 敵全体にランダム');
  await press('b'); await pr;
  pr = pick('allies', []); await step(1);
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
  ok(B.ui.bannerOf(DB.actions[pickC.tech]).w === 128, 'G4 banner width ≥ 128');
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
    ok(back === 12, 'G7 the handler hands back at frame 12 (speed ' + spd + ')', back);
    let fxAt = -1;
    S.playFx({ t: 'fx', fx: 'slash', user: S.eng.party[0], targets: [S.eng.mons[0]], kind: 'ability' });
    const n0 = S.fxList.length;
    await until(() => { if (S.fxList.length > n0 && fxAt < 0) fxAt = R.Engine.frame - F0; return fxAt >= 0; }, 120);
    const H = Math.max(36, Math.round(50 / [1, 1.6, 2.6][spd]));
    ok(fxAt >= H && fxAt <= H + 1, 'G8 the next fx starts at frame H = max(36, 50/spd) (speed ' + spd + ')', { fxAt, H });
    ok(S.glim && S.glim.name === DB.actions[pickC.tech].name, 'G9 banner holds the tech name');
    await step(8);
    ok(!S.glim, 'G10 the banner is gone after H + 6');
  }
  R.Settings.battleSpeed = 1;
  // two glimmers in one round: one banner at a time
  S = BUI.open({ mons: std() });
  let second = -1;
  const F1 = R.Engine.frame;
  S.handle({ t: 'glimmer', u: S.eng.party[0], id: pickC.tech, kind: 'tech' });
  S.handle({ t: 'glimmer', u: S.eng.party[1], id: pickC.tech, kind: 'tech' }).then(() => { second = R.Engine.frame; });
  await until(() => second >= 0, 200);
  ok(second - F1 >= 50 + 6 + 12, 'G11 the second banner waits for the first to close', second - F1);
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
  await step(2); await press('a'); await step(2);
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
  await step(2); await press('a'); await step(2);
  ok(paused && !S.card && !S.dim, 'D6 after the fanfare a key closes it');
  // stolen rare → the rare card during the round, gone at the next actor
  S = BUI.open({ mons: std() });
  sfx.length = 0;
  await S.handle({ t: 'gain', item: pickC.rareItem, grade: 'rare', stolen: true });
  ok(sfx.includes('steal') && S.card && S.card.grade === 'rare', 'D7 stolen rare: steal + the rare card');
  await S.handle({ t: 'actor', u: S.eng.party[1] });
  ok(!S.card, 'D8 the card of a steal closes at the next actor');
  await S.handle({ t: 'gain', item: 'i_salve', grade: 'normal', stolen: true });
  ok(!S.card, 'D9 a normal steal: no card');

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
  ok(vn && vn.x >= 256 && vn.move && vn.appear > 0, 'E9 a summoned monster starts off screen at the nearer edge', vn && vn.x);
  await step(16);
  const fin = eng.mons.map((m) => S.vis.get(m).x);
  ok(!vn.move && fin[0] < fin[1] && fin[1] < fin[2] && fin[2] < fin[3] && Math.abs((fin[0] + fin[3] + 48) / 2 - 128) <= 1, 'E10 then all four are re-centred in order', fin);
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
  // round 1: everyone attacks by hand
  for (let k = 0; k < 3; k++) { await press('a'); await step(2); await press('a'); await step(2); await press('a'); await step(2); await press('a'); await step(2); }
  await until(() => rounds >= 1 && phase === 'input', 800);
  ok(S.panel && !S.panel.left.isDisabled(1), 'P1 リピート is selectable after a round of commands');
  await press('right'); await step(1);
  ok(S.panel.help() === '前と同じ行動を、Bを押すまで続ける。', 'P2 リピート help', S.panel.help());
  const before = S.eng.rounds.length;
  await press('a'); await step(2);
  ok(S.repeating && S.eng.rounds.length === before + 1, 'P3 リピート starts at once, no menu');
  const r1 = S.eng.rounds[S.eng.rounds.length - 1];
  ok(r1.filter(Boolean).length === 3 && r1.every((c, i) => !c || c.type === S.lastCmds[i].type), 'P4 the repeated commands copy the last round', r1.map((c) => c && c.type));
  await until(() => S.eng.rounds.length >= before + 3, 1500);
  ok(S.repeating && S.eng.rounds.length >= before + 3 && !S.panel, 'P5 リピート keeps going round after round (no menu)', S.eng.rounds.length - before);
  // B during a round: the round finishes, then the party menu opens on 戦う
  await until(() => phase === 'round', 300);
  await press('b'); await step(1);
  ok(S.repeatCancel && sfx[sfx.length - 1] === 'cancel', 'P6 B → リピート解除 (cancel sound)');
  const nAtB = S.eng.rounds.length;
  await until(() => phase === 'input' && S.panel, 800);
  ok(!S.repeating && S.panel && S.panel.left.index === 0 && S.eng.rounds.length === nAtB, 'P7 the round ended, repeat stopped, party menu on 戦う', { rounds: S.eng.rounds.length - nAtB, idx: S.panel && S.panel.left.index });
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
  const g = FX.glyphs('orange');
  ok(g && g['0'], 'F7 orange digits');
  // every fx id the data writes resolves to an effect by its exact id (no keyword guessing)
  const used = new Set();
  const addFx = (f) => { for (const x of [].concat(f || [])) if (x) used.add(String(x)); };
  for (const id in DB.actions) addFx(DB.actions[id].fx);
  for (const id in DB.items) if (DB.items[id].use) addFx(DB.items[id].use.fx);
  for (const w in DB.weaponTypes) addFx(DB.weaponTypes[w].fx);
  for (const e in DB.elements) addFx(DB.elements[e].fx);
  const inexact = [...used].filter((id) => { const b = id.toLowerCase().replace(/\d+$/, ''); return !FX.FX[b] && !b.startsWith('breath'); });
  ok(inexact.length === 0, 'F8 every data fx id is an exact FX (' + used.size + ' ids)', inexact);
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
    for (const c of R.Game.party) { c.level = 20; const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; }
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
    // then リピート (S-R1): on until B, or the battle ends
    for (let i = 0; i < 3000 && !res; i++) {
      await step(1);
      if (scene.panel && scene.panel.left && scene.panel.left.items[0] === '戦う' && !scene.panel.left.isDisabled(1) && scene.partyIdx !== 1) { await press('right'); await press('a'); }
      if (scene.msg.key) await press('a');
    }
    ok(res === 'win' || res === 'lose' || res === 'escape', 'R3 the battle runs to its end (' + res + ')', res);
    ok(B.last && B.last.result === res && Array.isArray(B.last.drops) && Array.isArray(B.last.glimmers), 'R4 R.Battle.last is filled', B.last && Object.keys(B.last));
    ok(!B.current, 'R5 the scene closed');
    real = res;
  } catch (e) {
    ok(false, 'R real engine threw', String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  }

  // ---------------------------------------------------------------- summary
  console.log(`test_bui: ${pass} passed, ${fail} failed` + (real !== 'skipped' ? ` (real battle: ${real})` : ''));
  for (const f of fails) console.log('  FAIL', f);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
