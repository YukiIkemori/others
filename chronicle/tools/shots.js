#!/usr/bin/env node
// shots.js (owner qa A22) — the screenshot set of DESIGN §11.12.2 (#1–#22) for the owner, in design/shots/.
// §12.5: every PNG is looked at (Read) by whoever runs this; the list of files + what each should show is printed
// and written to <out>/shots.json. Screens whose content has not landed yet are SKIPped with the reason (never a
// fake picture), so the set becomes complete by itself as the areas land.
//
//   node tools/shots.js [--only 1,2,8-13] [--out design/shots] [--html dist/index.html] [--no-build] [--verbose]
//
// How each screen is reached (all in the real game page; nothing is drawn by this tool):
//   #1–#3   the real title → はじめから → creation (女・術剣士・火) → name entry (a 5-character name) by key presses
//   #4 #15  the tavern screens through the newgame fixture (tools/fixtures/newgame: RPG.NGFixture.show)
//   #5–#7 #18 #19  R.debug.quickStart + R.debug.warp / here / zoom on the real maps (4-member formation walked in)
//   #8–#13 #22b  battle screens through the bui fixture (tools/fixtures/bui: RPG.bui.run(<scenario>) → canvas PNGs)
//   #14 #20 #21 #22a  menus at T5 through the menu fixture (tools/fixtures/menu: RPG.menuFixture.setup)
//   #16 #17  R.debug.chapter (the region-clear stage), R.debug.wipe (game over), R.Ending (epilogue + credits)
// At the end the stand-ins still in use are counted: R.Art.PENDING and R.Audio.PENDING (§11.3, 批評 84).
// Exit 1 when a shot that should work fails (a console.error / pageerror counts); SKIPs do not fail.
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { Driver } = require('./smoke');

const ROOT = path.resolve(__dirname, '..');
const FIX = {
  bui: ['tools/fixtures/bui/fake_engine.js', 'tools/fixtures/bui/stage.js'],
  menu: ['tools/fixtures/menu/menu_fixture.js'],
  newgame: ['tools/fixtures/newgame/00_stubs.js'],
};
const FIVE = 'ミルフィア';          // a 5-character hero name (§11.12.2 #3, §12.5)

class Skip extends Error {}
const skip = (why) => { throw new Skip(why); };

// ---------------------------------------------------------------------------------------------- context
class Ctx {
  constructor(D, out, verbose) { this.D = D; this.out = out; this.verbose = verbose; this.files = []; this.notes = []; this.cur = null; }
  async load(fixtures) {
    const D = this.D;
    await D.load();
    await D.ev(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
    await D.load();
    for (const f of fixtures || []) for (const p of FIX[f]) {
      const file = path.join(ROOT, p);
      if (!fs.existsSync(file)) skip(`fixture ${p} is missing`);
      await D.page.addScriptTag({ path: file });
    }
  }
  /** screenshot of the canvas (as the player sees it) */
  async shot(name, what) {
    await this.D.wait(60);
    const file = await this.D.shot(name);
    this.files.push({ no: this.cur, file: path.relative(ROOT, file), what: what || '' });
    return file;
  }
  /** a PNG data URL (from the canvas) written as a file */
  save(name, dataUrl, what) {
    const file = path.join(this.out, name.replace(/[^\w.-]+/g, '_') + '.png');
    fs.writeFileSync(file, Buffer.from(String(dataUrl).split(',')[1] || '', 'base64'));
    this.files.push({ no: this.cur, file: path.relative(ROOT, file), what: what || '' });
    return file;
  }
  note(s) { this.notes.push({ no: this.cur, text: s }); }
  /** evaluate in the page; never waits more than 60 s (a promise the game resolves only on input would hang) */
  ev(fn, arg) {
    let t;
    const to = new Promise((res, rej) => { t = setTimeout(() => rej(new Error('page evaluate timed out (60 s)')), 60000); });
    return Promise.race([this.D.ev(fn, arg), to]).finally(() => clearTimeout(t));
  }
  wait(ms) { return this.D.wait(ms); }
  press(k) { return this.D.press(k); }
  st() { return this.D.st(); }
  until(fn, ms, what) { return this.D.until(fn, ms, what); }
  /** the frame counter moves on for n frames */
  async frames(n) {
    const f0 = await this.ev(() => window.RPG.Engine.frame);
    await this.until(() => true, 10, '');
    for (let i = 0; i < 200; i++) { const f = await this.ev(() => window.RPG.Engine.frame); if (f - f0 >= n) return; await this.wait(16); }
  }
  /** a quick-started game (the prologue done) at map/spawn */
  async game(o) {
    const r = await this.ev(async (oo) => { const R = window.RPG; await R.debug.quickStart(Object.assign({ noEncounter: true }, oo)); return R.debug.pos(); }, o || {});
    await this.D.idle(20000);
    return r;
  }
  hasMap(id) { return this.ev((m) => !!window.RPG.DB.maps[m], id); }
  /** warp to map at spawn / {x,y,dir}; then walk `walk` (list of dirs) so the 4 members line up behind the leader */
  async at(map, spawn, walk) {
    await this.ev(([m, s]) => window.RPG.debug.warp(m, s), [map, spawn]);
    await this.until((s) => s.map === map, 8000, 'warp to ' + map);
    await this.D.drive({ menus: 'leave' }, (s) => s.idle && s.map === map, 30000, 'onEnter of ' + map);
    for (const d of walk || []) { await this.D.step(d); await this.D.drive({ menus: 'leave' }, (st) => st.idle, 30000, 'after a step on ' + map); }
    await this.D.idle(8000);
  }
  /** stand next to npc id on its `side` and face it, after walking in from 3 tiles away */
  async nearNpc(id, side) {
    const p = await this.ev(([nid, sd]) => {
      const R = window.RPG, M = R.Field.map, n = M.npcs.find((k) => k.id === nid);
      if (!n) return null;
      const D = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
      const order = [sd, 'down', 'up', 'left', 'right'].filter(Boolean);
      for (const s of order) {
        const [dx, dy] = D[s];
        let x = Math.round(n.x) + dx, y = Math.round(n.y) + dy;
        // a shopkeeper behind a counter: stand on the customer's side of it (talking over the counter)
        for (let k = 0; k < 3 && M.counterAt(x, y); k++) { x += dx; y += dy; }
        if (!M.walkable(x, y) || M.npcAt(x, y)) continue;
        // a start 1–3 tiles further out on the same line, so the followers trail in
        let k = 0;
        while (k < 3 && M.walkable(x + dx * (k + 1), y + dy * (k + 1)) && !M.npcAt(x + dx * (k + 1), y + dy * (k + 1)) && !M.warpCell(x + dx * (k + 1), y + dy * (k + 1))) k++;
        const back = { down: 'up', up: 'down', left: 'right', right: 'left' }[s];
        return { x, y, sx: x + dx * k, sy: y + dy * k, k, face: back };
      }
      return null;
    }, [id, side]);
    if (!p) skip(`npc ${id} has no free side`);
    await this.ev(([x, y, d]) => window.RPG.debug.here(x, y, d), [p.sx, p.sy, p.face]);
    for (let i = 0; i < p.k; i++) await this.D.step(p.face);
    await this.D.idle(8000);
    return p;
  }
}

// ---------------------------------------------------------------------------------------------- the list
const SHOTS = [];
const def = (no, title, run) => SHOTS.push({ no, title, run });

// ---- #1–#3 the real new-game flow (one page)
def('1-3', 'タイトル・主人公の作成・名前入力', async (X) => {
  const D = X.D;
  X.cur = 1;
  await X.load();
  await X.until((s) => s.top === 'TitleLayer', 15000, 'the title');
  await X.wait(3000);
  await X.shot('01_title', '起動して 3 秒後');
  await D.drive({}, (s) => s.top === 'MenuLayer', 10000, 'the title menu');
  await X.wait(400);
  await X.shot('01_title_menu', 'メニューを開いた状態');
  X.cur = 2;
  const pol = { titleIndex: 0, create: { gender: 'f', type: 'spellblade', favor: 'fire' } };
  const seen = new Set();
  await D.drive(Object.assign({}, pol, {
    onState: async (s) => {
      if (s.top !== 'CreateLayer' || s.create.busy) return;
      const c = s.create;
      const key = c.step === 1 && c.type === 'spellblade' ? 'type' : c.step === 2 && c.favor === 'fire' ? 'favor' : c.step === 4 ? 'confirm' : null;
      if (key && !seen.has(key)) {
        seen.add(key); await X.wait(250);
        await X.shot('02_create_' + key, { type: 'タイプ（術剣士）', favor: '得意分野（火）', confirm: '確認（女・術剣士・火）' }[key]);
      }
    },
  }), (s) => s.top === 'NameLayer' && !s.name.busy, 60000, 'the name entry');
  X.cur = 3;
  await X.ev((nm) => { const t = window.RPG.Engine.top(); t.name = [...nm]; if (t.toOk) t.toOk(); }, FIVE);
  await X.wait(300);
  await X.shot('03_name_entry', `5 字の名前（${FIVE}）`);
  X.cur = 2;
  await D.drive(Object.assign({}, pol, {
    onState: async (s) => {
      if (s.top === 'CreateLayer' && s.create.step === 4 && !s.create.busy && !seen.has('confirm')) { seen.add('confirm'); await X.wait(250); await X.shot('02_create_confirm', '確認（女・術剣士・火・5 字の名前）'); }
    },
  }), (s) => s.top !== 'NameLayer' && s.top !== 'CreateLayer', 30000, 'the name entry');
  const h = await X.ev(() => { const h = window.RPG.State.hero(); return h && { name: h.name, type: h.heroType, gender: h.gender }; });
  if (!h || h.name !== FIVE) X.note(`the hero was made as ${JSON.stringify(h)}`);
});

// ---- #4 companions, #15 the swap screen (newgame fixture)
def(4, '仲間を選ぶ（1 ページ・2 ページ、2 人選んだ状態）', async (X) => {
  await X.load(['newgame']);
  await X.ev(() => { window.RPG.NGFixture.show('choose'); });
  // the advice line comes first (A to read on)
  await X.D.drive({ menus: 'leave' }, (s) => s.top === 'ChooseLayer' && !s.choose.busy, 15000, 'the choose screen');
  for (let i = 0; i < 2; i++) {
    const s = await X.st();
    await X.press('a');
    await X.until((t) => t.top === 'ChooseLayer' && !t.choose.busy && t.choose.chosen.length > s.choose.chosen.length, 5000, 'a pick');
    await X.press('down');
  }
  await X.wait(300);
  await X.shot('04_choose_page1', '2 人選んだ状態・1 ページ');
  await X.press('right');
  await X.wait(300);
  await X.shot('04_choose_page2', '同・2 ページ');
});
def(15, '酒場の入れ替え（控え 10 人）', async (X) => {
  await X.load(['newgame']);
  await X.ev(() => { window.RPG.NGFixture.show('swap'); });
  await X.wait(800);
  const s = await X.st();
  if (!/Swap|Tavern|Layer|Screen/.test(s.top || '')) skip('the swap screen did not open (' + s.top + ')');
  await X.shot('15_tavern_swap', '控え 10 人');
});

// ---- #5–#7, #18, #19 the field
def(5, 'ワールドマップ（森・山・街道・海岸、砂嵐、湿地の霧）', async (X) => {
  await X.load();
  await X.game();
  const L = await X.ev(() => { const R = window.RPG, L = R.DB.locations.lute; return { map: (R.FieldMap.findWorld && R.FieldMap.findWorld(L.spawn)) || 'world', spawn: L.spawn }; });
  await X.at(L.map, L.spawn, ['down', 'down']);
  await X.wait(600);
  await X.shot('05_world_lute', '港町ファロスのまわり（森・山・街道・海岸）');
  // the weather is drawn over its own tiles: stand next to the middle of the sandstorm / marsh-fog / sea-fog cells
  for (const [tile, name, what] of [['sandstorm', '05_world_sandstorm', '砂漠の砂嵐'], ['marsh_fog', '05_world_marsh_fog', '湿地の霧'], ['fog', '05_world_sea_fog', '内海の霧（ビブリア島）']]) {
    const at = await X.ev((tid) => {
      const R = window.RPG, M = R.Field.map, cells = [];
      for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.tileAt(x, y) === tid) cells.push([x, y]);
      if (!cells.length) return null;
      const cx = cells.reduce((a, c) => a + c[0], 0) / cells.length, cy = cells.reduce((a, c) => a + c[1], 0) / cells.length;
      cells.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
      for (const [x0, y0] of cells.slice(0, 40)) for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (M.walkable(x, y) && !M.warpCell(x, y)) return { x: M.wx(x), y: M.wy(y), n: cells.length };
      }
      return null;
    }, tile);
    if (!at) { X.note(`no '${tile}' cell on the world map`); continue; }
    await X.ev(([x, y]) => window.RPG.debug.here(x, y, 'down'), [at.x, at.y]);
    await X.wait(900);
    await X.shot(name, `${what}（${tile} ${at.n} マス）`);
  }
});
def(6, '町 2 つ（ファロス・カシム）と屋内（酒場・道具屋）、4 人の隊列', async (X) => {
  await X.load();
  await X.game();
  await X.at('lute', 'entrance', ['up', 'up', 'up']);
  await X.shot('06_town_lute', '港町ファロス（4 人の隊列）');
  await X.nearNpc('tavern', 'down');
  await X.shot('06_interior_tavern', 'ファロスの酒場');
  await X.nearNpc('shop_item', 'down');
  await X.shot('06_interior_item_shop', 'ファロスの道具屋');
  if (await X.hasMap('kasim')) { await X.at('kasim', 'entrance', ['up', 'up', 'up']); await X.shot('06_town_kasim', 'オアシスの町カシム'); }
  else X.note('カシム (kasim, R2) is not registered yet');
});
def(7, 'ダンジョン 4 つ（迷いの森・幽霊船・深き坑道・白の大書庫）', async (X) => {
  await X.load();
  await X.game();
  const list = [['verda_maze_1', '迷いの森', 'R1'], ['ghost_ship_1', '幽霊船', 'R5'], ['deep_mine_1', '深き坑道', 'R6'], ['archive_1', '白の大書庫', 'A19']];
  let n = 0;
  for (const [m, name, who] of list) {
    if (!(await X.hasMap(m))) { X.note(`${name} (${m}, ${who}) is not registered yet`); continue; }
    await X.at(m, 'entrance', ['up', 'up']);
    await X.shot('07_dungeon_' + m, name);
    n++;
  }
  // the prologue dungeon is always there (not in the list of 4; shown so the set has a dungeon today)
  await X.at('lighthouse_2', 'entrance', ['up', 'up']);
  await X.shot('07_dungeon_lighthouse_2', 'ファロス灯台 2 階（序章。表の 4 つの外）');
  if (!n) X.note('none of the 4 dungeons exists yet');
});
def(18, 'フィールドの広さ 3 つ（同じ町の同じ場所）', async (X) => {
  await X.load();
  await X.game();
  await X.at('lute', 'entrance', ['up', 'up', 'up']);
  for (const z of ['normal', 'wide', 'wider']) {
    await X.ev((zz) => window.RPG.debug.zoom(zz), z);
    await X.wait(400);
    await X.shot('18_zoom_' + z, { normal: 'ふつう', wide: 'ひろい', wider: 'もっとひろい' }[z]);
  }
  await X.ev(() => window.RPG.debug.zoom('normal'));
  // the same spot in a dungeon floor (outside must be wall, not a black margin)
  await X.at('lighthouse_2', 'entrance', ['up']);
  await X.ev(() => window.RPG.debug.zoom('wider'));
  await X.wait(400);
  await X.shot('18_zoom_wider_dungeon', 'もっとひろい（ダンジョン）');
  await X.ev(() => window.RPG.debug.zoom('normal'));
});
def(19, '隠し通路を見つけた瞬間', async (X) => {
  await X.load();
  await X.game();
  const maps = await X.ev(() => Object.keys(window.RPG.DB.maps).filter((m) => window.RPG.DB.maps[m].type === 'dungeon' || /_\d+$/.test(m)));
  let found = null;
  for (const m of maps) {
    await X.at(m, 'entrance');
    found = await X.ev(() => {
      const R = window.RPG, M = R.Field.map;
      const D = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
      for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
        if (!M.isSecret(x, y)) continue;
        for (const [d, dx, dy] of D) {
          const sx = x - dx, sy = y - dy;
          if (M.walkable(sx, sy) && !M.isSecret(sx, sy) && !M.npcAt(sx, sy)) return { map: M.id, x: sx, y: sy, dir: d };
        }
      }
      return null;
    });
    if (found) break;
  }
  if (!found) skip('no secret passage on any dungeon floor');
  await X.ev(([x, y, d]) => window.RPG.debug.here(x, y, d), [found.x, found.y, found.dir]);
  await X.D.idle(5000);
  await X.press(found.dir);
  await X.until((s) => s.top !== 'FieldLayer' || s.evBusy, 4000, 'the secret notice').catch(() => null);
  await X.wait(250);
  await X.shot('19_secret_found', `「隠し通路を見つけた！」（${found.map}）`);
});

// ---- #8–#13, #22b battle screens (bui fixture scenarios)
const BUI_SHOTS = [
  [8, 'command', { party_menu: '08_battle_command', member_menu_hero: '08_battle_member_menu' }, '4 人（5 字の名前 2 人・中列 2 人・状態 2 つ・戦闘不能 1 人）'],
  [9, 'techs', { tech_list_8char_wp_short: '09_battle_tech_list', tech_list: '09_battle_tech_list_top' }, '8 字の技名・WP の足りない技'],
  [10, 'glimmer', { glimmer_f12: '10_glimmer', glimmer_f32: '10_glimmer_b' }, '技名の札が開いた瞬間'],
  [10, 'glimmer_oogi', { glimmer_oogi_f12: '10_glimmer_oogi' }, '奥義の閃き'],
  [11, 'drop_super', { drop_super: '11_drop_super', drop_super_b: '11_drop_super_b' }, '超レアの札とキラキラ'],
  [12, 'golden', { golden_sparkles: '12_golden', golden_intro: '12_golden_intro' }, '金色の個体'],
  [12, 'rare', { rare_intro: '12_rare_intro' }, 'レア魔物の登場'],
  [13, 'boss', null, 'ボス（高さ 112 のもの）: 頭がどこまで隠れるか'],
  [22, 'repeat', { repeat_on: '22_battle_repeat_on', repeat_cancel: '22_battle_repeat_cancel' }, '「リピート　Bで解除」と「リピート解除」'],
];
for (const [no, sc, map, what] of BUI_SHOTS) {
  def(no, `戦闘: ${sc}`, async (X) => {
    await X.load(['bui']);
    const ok = await X.ev((s) => !!(window.RPG.bui && window.RPG.bui.scenarios && window.RPG.bui.scenarios[s]), sc);
    if (!ok) skip(`bui scenario '${sc}' is missing`);
    const shots = await X.ev((s) => window.RPG.bui.run(s), sc);
    const err = shots.find((s) => s.error);
    if (err) throw new Error(`bui.run('${sc}'): ${err.error.split('\n')[0]}`);
    let n = 0;
    for (const s of shots) {
      const name = map ? map[s.label] : '13_' + s.label;
      if (!name) continue;
      X.save(name, s.data, what);
      n++;
    }
    if (!n) throw new Error(`bui.run('${sc}') gave no shot (${shots.map((s) => s.label).join(', ')})`);
  });
}

// ---- #14, #20, #21, #22a menus at T5 (menu fixture)
async function menuGame(X, o) {
  await X.load(['menu']);
  await X.ev(async (oo) => { await window.RPG.menuFixture.setup(oo); }, Object.assign({ tier: 5 }, o || {}));
  await X.D.idle(20000);
}
async function openShow(X, name, arg) {
  const r = await X.ev(([n, a]) => window.RPG.menuFixture.show(n, a), [name, arg == null ? null : arg]);
  if (r !== true) skip(`menu ${name}: ${r}`);
  await X.wait(500);
  return X.st();
}
def(14, 'メニュー・装備・強さ・技の書・術の書・図鑑・年代記（T5）', async (X) => {
  await menuGame(X);
  await openShow(X, 'main');
  await X.shot('14_menu_main', 'メインメニュー（T5）');
  // §12.5: the worst names / numbers (5-character names, HP 999, MP 150, WP 99) in the same menu
  const worst = await X.ev(() => { const F = window.RPG.menuFixture; if (!F || !F.worst) return null; const r = F.worst(); window.RPG.Engine.layers.filter((l) => l.constructor.name !== 'FieldLayer').forEach((l) => window.RPG.Engine.remove(l)); return r; });
  if (worst) { await openShow(X, 'main'); await X.shot('14_menu_main_worst', `§12.5 の最悪の組（${worst.join('・')}、HP 999・MP 150・WP 99）`); }
  const screens = [['equipScreen', '14_menu_equip', '装備'], ['statusScreen', '14_menu_status', '強さ（熟練度）'], ['itemScreen', '14_menu_items', '持ち物'],
    ['chronicleScreen', '14_menu_chronicle', '年代記']];
  for (const [fn, name, what] of screens) {
    await X.ev(() => window.RPG.Engine.clear && window.RPG.Engine.layers.filter((l) => l.constructor.name !== 'FieldLayer').forEach((l) => window.RPG.Engine.remove(l)));
    await openShow(X, fn, {});
    await X.shot(name, what);
    if (fn === 'statusScreen') { await X.press('right'); await X.wait(300); await X.shot('14_menu_status_2', '強さ（2 人目）'); }
  }
  // the books of arts
  for (const [kind, name, what] of [['tech', '14_menu_techbook', '技の書'], ['spell', '14_menu_spellbook', '術の書']]) {
    await X.ev(() => window.RPG.Engine.layers.filter((l) => l.constructor.name !== 'FieldLayer').forEach((l) => window.RPG.Engine.remove(l)));
    await openShow(X, 'skillBookScreen', { kind });
    await X.shot(name, what);
  }
  // the bestiary: the list, then the detail page 1 (drops and steals) of the first found monster
  await X.ev(() => window.RPG.Engine.layers.filter((l) => l.constructor.name !== 'FieldLayer').forEach((l) => window.RPG.Engine.remove(l)));
  await openShow(X, 'bookScreen', {});
  await X.shot('14_menu_bestiary', '図鑑');
  await X.press('a');
  await X.wait(500);
  await X.shot('14_menu_bestiary_detail', '図鑑の詳しい画面の 1 ページ目（落とす物と盗める物）');
});
def(20, '装備の候補の一覧（術師の頭）', async (X) => {
  await menuGame(X);
  const who = await X.ev(() => {
    const R = window.RPG, g = R.Game;
    // the caster: the member whose best stat is int
    let best = 0, bi = 0;
    g.party.forEach((c, i) => { const st = R.Rules.stats(c); if (st.int > best) { best = st.int; bi = i; } });
    // a few int hats and other heads in the bag, so the order of the candidates shows
    const heads = Object.keys(R.DB.items).filter((id) => R.DB.items[id].type === 'head' && (R.DB.items[id].tier || 0) <= 5);
    for (const id of heads.slice(0, 40)) R.State.addItem(id, 1);
    return { i: bi, name: g.party[bi].name };
  });
  await openShow(X, 'equipScreen', { member: who.i });
  await X.ev(() => { const t = window.RPG.Engine.top(); const S = window.RPG.Rules.SLOTS || ['weapon1', 'weapon2', 'shield', 'head']; t.row = Math.max(0, S.indexOf('head')); });
  await X.wait(200);
  await X.press('a');
  await X.wait(500);
  await X.shot('20_equip_candidates_head', `${who.name}（術師）の頭の候補: 名前　攻±n　術±n　守±n、強い順`);
  const top = await X.ev(() => { const t = window.RPG.Engine.top(); const r = t.cand && t.cand.rows; return r ? r.slice(0, 4).map((x) => x.id && window.RPG.DB.items[x.id] && window.RPG.DB.items[x.id].name) : null; });
  X.note('top head candidates: ' + JSON.stringify(top));
});
def(21, 'Y の詳細ポップアップ 4 枚', async (X) => {
  await menuGame(X);
  const ids = await X.ev(() => {
    const R = window.RPG, DB = R.DB, it = (p) => Object.keys(DB.items).find((id) => p(DB.items[id], id));
    const w = it((x) => x.type === 'weapon' && x.grade === 'super');
    const a = it((x) => ['head', 'body', 'shield', 'hands', 'feet'].includes(x.type) && x.grade === 'rare' && (x.quirk || (x.mods && Object.values(x.mods).some((v) => v < 0))));
    const acc = it((x) => x.type === 'acc' && x.src === 'shop');
    const sp = Object.keys(DB.actions).find((id) => DB.actions[id].kind === 'spell' && (DB.actions[id].elements || []).length === 2);
    for (const id of [w, a]) if (id) R.State.addItem(id, 1);
    return { w, a, acc, sp };
  });
  const clear = () => X.ev(() => window.RPG.Engine.layers.filter((l) => l.constructor.name !== 'FieldLayer').forEach((l) => window.RPG.Engine.remove(l)));
  const pop = async (behind, kind, id, name, what) => {
    if (!id) { X.note(`no item for ${name}`); return; }
    await clear();
    if (behind) await openShow(X, behind[0], behind[1]);
    await X.ev(([k, i]) => { const M = window.RPG.Menu; (k === 'item' ? M.itemDetail(i, {}) : M.actionDetail(i, {})); }, [kind, id]);
    await X.wait(500);
    await X.shot(name, what);
  };
  await pop(['itemScreen', {}], 'item', ids.w, '21_detail_super_weapon', '道具: 超レアの武器');
  await pop(['equipScreen', {}], 'item', ids.a, '21_detail_rare_armor', '装備の候補: クセのあるレアの防具');
  await pop(null, 'item', ids.acc, '21_detail_shop_acc', '店: アクセサリ');
  await pop(['spellScreen', {}], 'action', ids.sp, '21_detail_combo_spell', '技と術: 合成術');
});
def(22, 'ワープの一覧', async (X) => {
  await menuGame(X, { tier: 8 });
  const n = await X.ev(() => { const R = window.RPG; R.debug.visitAll(); return (R.Menu.warpList ? R.Menu.warpList() : []).length; });
  await X.ev(() => { window.RPG.Menu.chooseWarp(); });
  await X.wait(500);
  await X.shot('22_warp_list', `ワープの一覧（${n} 行）`);
  for (let i = 0; i < 14; i++) await X.press('down');
  await X.wait(300);
  await X.shot('22_warp_list_scrolled', '13 行を超えて送った所');
});

// ---- #16 the region clear, #17 game over / ending / credits
def(16, '地方クリアの演出（羽ペンと章の題）', async (X) => {
  await X.load();
  await X.game({ tier: 0 });
  const r = await X.ev(() => { const R = window.RPG; const reg = Object.keys(R.DB.regions || {})[0]; if (!reg || !R.debug.chapter) return null; R.debug.chapter(reg); return reg; });
  if (!r) skip('no region / no R.debug.chapter');
  const t = [700, 1600, 2600, 3600];
  for (let i = 0; i < t.length; i++) { await X.wait(i ? t[i] - t[i - 1] : t[0]); await X.shot('16_chapter_' + (i + 1), `地方クリア（${r}）${i + 1}/4`); }
  await X.D.drive({}, (s) => s.idle, 60000, 'the end of the chapter stage').catch((e) => X.note(e.message));
});
def(17, 'ゲームオーバー・エンディングの後日談・クレジット', async (X) => {
  await X.load();
  await X.game();
  await X.ev(() => { window.RPG.debug.wipe(); });
  await X.until((s) => s.top === 'GameOverLayer', 20000, 'the game over');
  await X.wait(1500);
  await X.shot('17_gameover', 'ゲームオーバー');
  const crest = await X.ev(() => { const E = window.RPG.Ending; return !E || !E.start || (E.EPILOGUES || []).some((e) => (e.who || []).some((w) => /yuki|non|metem/.test(w))); });
  if (crest) { X.note('the ending is still the Crest one (A19 ending.js): epilogue and credits not shot'); return; }
  await X.load();
  await X.game({ tier: 8 });
  await X.ev(() => { window.RPG.Ending.start(); });
  // read on with A (only when a page is fully shown); a picture every 5 s, up to 12, until the title comes back
  const t0 = Date.now();
  let k = 0, last = 0;
  while (Date.now() - t0 < 180000 && k < 12) {
    await X.wait(400);
    const s = await X.st();
    if (s.top === 'TitleLayer') break;
    if (Date.now() - last > 5000) { last = Date.now(); await X.shot('17_ending_' + String(++k).padStart(2, '0'), 'エンディング（後日談・クレジット）'); }
    if (s.top === 'MessageLayer' && s.msg && s.msg.waiting && s.msg.typed) await X.press('a');
    else if (s.top === 'ChoiceLayer') await X.press('b');
  }
});

// ---------------------------------------------------------------------------------------------- main
function nums(no) { const m = String(no).match(/^(\d+)-(\d+)$/); if (!m) return [+no]; const r = []; for (let i = +m[1]; i <= +m[2]; i++) r.push(i); return r; }
function pickShots(spec) {
  if (!spec) return SHOTS;
  const want = new Set();
  for (const p of spec.split(',')) for (const i of nums(p)) want.add(i);
  return SHOTS.filter((s) => nums(s.no).some((i) => want.has(i)));
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  const flag = (k) => argv.includes('--' + k);
  const out = path.resolve(opt('out', path.join(ROOT, 'design', 'shots')));
  const html = path.resolve(opt('html', path.join(ROOT, 'dist', 'index.html')));
  if (!flag('no-build') && !argv.includes('--html')) {
    try { execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js')], { stdio: 'pipe' }); } catch (e) { console.log('build: ' + String(e.stderr || e).split('\n')[0]); }
  }
  const D = new Driver({ html, out, verbose: flag('verbose') });
  if (!D.pw) { console.log('SKIP shots: playwright is not installed'); return; }
  fs.mkdirSync(out, { recursive: true });
  const X = new Ctx(D, out, flag('verbose'));
  const results = [];
  const t0 = Date.now();
  console.log(`shots: ${path.relative(ROOT, html)} → ${path.relative(ROOT, out) || out}`);
  let pending = null;
  try {
    await D.open();
    for (const s of pickShots(opt('only', null))) {
      X.cur = s.no;
      D.stage = 'shot ' + s.no;
      const n0 = X.files.length, e0 = D.errors.length, t1 = Date.now();
      let status = 'PASS', detail = '';
      try { await s.run(X); } catch (e) {
        if (e instanceof Skip) { status = 'SKIP'; detail = e.message; } else { status = 'FAIL'; detail = String(e.message || e).split('\n')[0]; if (flag('verbose')) console.log(e.stack); }
        try { await D.shot(`FAIL_${String(s.no)}`); } catch (e2) { /* ignore */ }
      }
      // a file of another owner that fails to load is reported (once) but does not fail the shot; an error while
      // the screen runs does
      const errs = D.errors.slice(e0).filter((x) => !x.load && !/^\[console\.error\] (src\/[^ ]+\.js[: ]|LOAD ERRORS)/.test(x.text));
      if (status === 'PASS' && errs.length) { status = 'FAIL'; detail = errs.map((x) => x.text).join(' | ').slice(0, 300); }
      const files = X.files.slice(n0);
      if (status === 'PASS') { try { fs.unlinkSync(path.join(out, `FAIL_${String(s.no)}.png`)); } catch (e) { /* none */ } }
      results.push({ no: s.no, title: s.title, status, detail, files: files.map((f) => f.file), ms: Date.now() - t1 });
      const mark = status === 'PASS' ? '✓' : status === 'SKIP' ? '–' : '✗';
      console.log(`${mark} ${status} #${String(s.no).padEnd(4)} ${s.title}  (${files.length} png, ${((Date.now() - t1) / 1000).toFixed(1)}s)${detail ? '  ' + detail : ''}`);
      for (const f of files) console.log(`         ${f.file.startsWith('..') ? path.resolve(ROOT, f.file) : f.file}  ${f.what}`);
      for (const nt of X.notes.filter((x) => x.no === s.no)) console.log(`         note: ${nt.text}`);
      X.notes = X.notes.filter((x) => x.no !== s.no);
    }
    // stand-ins still in use (§11.3 / 批評 84)
    await D.load();
    pending = await D.ev(() => ({ art: ((window.RPG.Art && window.RPG.Art.PENDING) || []).slice(), audio: ((window.RPG.Audio && window.RPG.Audio.PENDING) || []).slice() }));
  } catch (e) {
    console.log('shots aborted:', e.stack || e);
    results.push({ no: '-', title: 'driver', status: 'FAIL', detail: String(e.message || e), files: [] });
  } finally {
    await D.close();
  }
  const n = (st) => results.filter((r) => r.status === st).length;
  const files = results.reduce((a, r) => a + r.files.length, 0);
  if (pending) console.log(`\nstand-ins: R.Art.PENDING ${pending.art.length}${pending.art.length ? ' (' + pending.art.slice(0, 12).join(' ') + (pending.art.length > 12 ? ' …' : '') + ')' : ''} · R.Audio.PENDING ${pending.audio.length}${pending.audio.length ? ' (' + pending.audio.slice(0, 12).join(' ') + ')' : ''}`);
  console.log(`shots: ${n('PASS')} pass, ${n('FAIL')} fail, ${n('SKIP')} skip — ${files} PNG(s) in ${path.relative(ROOT, out) || out} — ${D.errors.length} console error(s) — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('Look at every PNG (§12.5) before calling the set done.');
  // a partial run (--only) replaces its own entries in shots.json and keeps the others
  let all = results;
  const jf = path.join(out, 'shots.json');
  if (opt('only', null)) {
    try {
      const old = JSON.parse(fs.readFileSync(jf, 'utf8')).results || [];
      const key = (r) => `${r.no}|${r.title}`;
      const mine = new Set(results.map(key));
      all = old.filter((r) => !mine.has(key(r))).concat(results);
      all.sort((a, b) => (parseInt(a.no, 10) || 0) - (parseInt(b.no, 10) || 0));
    } catch (e) { all = results; }
  }
  fs.writeFileSync(jf, JSON.stringify({ when: new Date().toISOString(), html: path.relative(ROOT, html), results: all, pending, errors: D.errors }, null, 1));
  if (n('FAIL')) process.exitCode = 1;
}

module.exports = { SHOTS, pickShots };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
