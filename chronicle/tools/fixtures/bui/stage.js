// Battle UI fixture (bui A3): a battle stage for screenshots without the rest of the game.
// Loaded after src/ by `node tools/build.js --with tools/fixtures/bui` (→ debug_bui.html) and by
// tools/test_bui.js in node. Real data (DB.*), rules and art are used whenever they are there; the few
// things a screenshot needs that the data does not have (an 8-character tech name) are fixture entries
// prefixed `bui_`, registered only here.
//
//   RPG.bui.open({mons, engine:'fake'|'real', bg, script, party:'worst'|'plain'}) → the BattleScene (no auto flow)
//   RPG.bui.run('glimmer') → [{label, data:dataURL}]   (browser; tools/battle_gallery.js calls it)
(function (R) {
  'use strict';
  const U = R.U, DB = R.DB;
  const BUI = (R.bui = R.bui || {});
  const G = () => R.Gfx;

  // ---------------------------------------------------------------- fixture-only entries
  function fixtureData() {
    // an 8-character tech (the longest name the list must show; the real 121 stop at 6)
    if (!DB.actions.bui_t_long) {
      DB.actions.bui_t_long = {
        kind: 'tech', wtype: 'sword', name: '千年樹の祈り斬り', desc: '光る刃で敵1体を大きく斬る。', wp: 12, target: 'enemy', reach: false,
        effects: [{ type: 'damage', power: 3 }], fx: 'slash3', rank: 8, glim: { lv: 8, from: ['attack'] },
      };
    }
    if (!DB.weaponTypes.sword) Object.assign(DB.weaponTypes, { sword: { name: '剣', reach: false, fx: 'slash', icon: 'icon:sword' } });
  }

  // ---------------------------------------------------------------- party
  const pickTechs = (wtype, maxLv) => Object.keys(DB.actions).filter((id) => { const a = DB.actions[id]; return a.kind === 'tech' && a.wtype === wtype && (!a.glim || a.glim.lv <= maxLv); });
  function fullUp(c, level) {
    c.level = level;
    let st = null;
    try { st = R.Rules.stats(c); } catch (e) { st = null; }
    if (st) { c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; }
    return c;
  }
  /** a fresh game with アルン + ブリギッタ + シルヴァン + マルタ (5-char names twice), mid-game levels */
  function setupGame(kind) {
    fixtureData();
    let ok = false;
    try {
      R.State.newGame({ name: 'アルン', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } });
      for (const id of ['brigitta', 'sylvain', 'marta']) if (DB.companions[id]) R.Party.recruit(id);
      ok = R.Game && R.Game.party.length === 4;
    } catch (e) { R.warn('bui fixture: real party failed', e && e.message); }
    if (!ok) fallbackGame();
    const [hero, bri, syl, mar] = R.Game.party;
    const lv = kind === 'plain' ? 12 : 34;
    for (const c of R.Game.party) fullUp(c, lv);
    const add = (c, ids) => { for (const id of ids) if (DB.actions[id] && !c.techs.includes(id)) c.techs.push(id); };
    add(hero, pickTechs('sword', 7).concat(['bui_t_long']));
    add(bri, pickTechs('spear', 6).concat(pickTechs('bow', 5)));
    add(syl, pickTechs('bow', 7).concat(pickTechs('dagger', 4)));
    add(mar, pickTechs('staff', 6));
    const sp = ['s_light_1', 's_light_2', 's_water_2', 's_light_4', 's_wind_1', 's_fire_1', 's_fire_wind_a', 's_water_light_a', 's_light_dark_a'].filter((id) => DB.actions[id]);
    for (const id of sp) if (!mar.spells.includes(id)) mar.spells.push(id);
    hero.row = 'front'; bri.row = 'middle'; syl.row = 'middle'; mar.row = 'front';
    R.Game.inv = {};
    const inv = { i_salve: 12, i_potion: 5, i_elixir: 2, i_revive: 3, i_ether: 4, i_tonic: 2, i_lifedew: 1, i_phoenix: 1, i_smoke: 2, i_firepot: 3, i_lens: 1 };
    for (const id in inv) if (DB.items[id]) R.Game.inv[id] = inv[id];
    return R.Game.party;
  }
  function fallbackGame() {
    const mk = (id, name, row, w1, w2) => ({
      id, name, gender: 'f', level: 30, exp: 0, hp: 240, mp: 30, wp: 31, bonus: { hp: 0, mp: 0, wp: 0 }, status: {},
      equip: { weapon1: w1, weapon2: w2 || null, shield: null, head: null, body: null, hands: null, feet: null, acc1: null, acc2: null },
      wprof: {}, eprof: {}, techs: [], spells: [], row, mem: { cmd: 0, list: {}, item: 0, target: null }, counts: {}, _max: { hp: 240, mp: 30, wp: 31 },
    });
    R.Game = R.Game || { party: [], reserve: [], inv: {}, flags: {}, vars: {}, book: { mon: {}, tech: {}, spell: {} }, records: {} };
    R.Game.party = [mk('hero', 'アルン', 'front'), mk('brigitta', 'ブリギッタ', 'middle'), mk('sylvain', 'シルヴァン', 'middle'), mk('marta', 'マルタ', 'front')];
    R.Game.reserve = [];
  }

  // ---------------------------------------------------------------- content picked from the real data
  function monsOf(pred) { return Object.keys(DB.monsters).filter((id) => pred(DB.monsters[id], id)); }
  const flag = (d, f) => (d.flags || []).includes(f);
  function pick() {
    const techs = Object.keys(DB.actions).filter((id) => DB.actions[id].kind === 'tech');
    const spells = Object.keys(DB.actions).filter((id) => DB.actions[id].kind === 'spell');
    const lv = (id) => (DB.actions[id].glim && DB.actions[id].glim.lv) || 0;
    const items = Object.keys(DB.items);
    const longest = (list) => list.slice().sort((a, b) => [...DB.items[b].name].length - [...DB.items[a].name].length)[0];
    return {
      tech: DB.actions.t_sword_stepcut ? 't_sword_stepcut' : techs[0],
      tech8: 'bui_t_long',
      oogi: techs.find((id) => lv(id) === 9 && DB.actions[id].wtype === 'sword') || techs.find((id) => lv(id) === 9),
      gokui: techs.find((id) => lv(id) === 10 && DB.actions[id].wtype === 'sword') || techs.find((id) => lv(id) === 10),
      spell: spells.find((id) => DB.actions[id].elements.length === 1 && DB.actions[id].elements[0] === 'water') || spells[0],
      combo: spells.find((id) => DB.actions[id].elements.length === 2 && DB.actions[id].elements.includes('wind') && DB.actions[id].elements.includes('fire')) || spells.find((id) => DB.actions[id].elements.length >= 2),
      triple: spells.find((id) => DB.actions[id].elements.length === 3),
      rareItem: items.find((id) => DB.items[id].grade === 'rare' && DB.items[id].type === 'weapon') || items.find((id) => DB.items[id].grade === 'rare'),
      superItem: longest(items.filter((id) => DB.items[id].grade === 'super' && DB.items[id].type === 'weapon')) || items.find((id) => DB.items[id].grade === 'super'),
      normalItem: DB.items.i_salve ? 'i_salve' : items[0],
      golden: monsOf((d, id) => /^wolf_/.test(id) && !flag(d, 'boss'))[0] || monsOf((d) => !flag(d, 'boss') && !flag(d, 'rare') && !flag(d, 'metal'))[0],
      rare: DB.monsters.rm_jewel_hare ? 'rm_jewel_hare' : monsOf((d) => flag(d, 'rare'))[0],
      metal: DB.monsters.quicksilver_1 ? 'quicksilver_1' : monsOf((d) => flag(d, 'metal'))[0],
      bosses: monsOf((d) => flag(d, 'boss')),
    };
  }
  BUI.pick = pick;

  // ---------------------------------------------------------------- stage
  /**
   * o: {mons:[id | {id, golden, …}], engine:'fake'|'real', bg, script, party:'worst'|'plain', noEscape, flow, auto, rare}
   * flow: run the scene's own main() (intro, begin, commands…); otherwise the scene is opened ready and idle.
   */
  BUI.open = function (o) {
    o = o || {};
    R.Engine.clear();
    R.Engine.fadeAlpha = 0;
    R.Engine.flash.frames = 0;
    R.Engine._shake.frames = 0;
    const party = setupGame(o.party);
    if (o.tweak) o.tweak(party);
    const inv = R.Game.inv;
    let eng = null;
    if (o.engine === 'real' && R.Battle.Engine) {
      try { eng = new R.Battle.Engine({ party, mons: o.mons, inv, live: false, noEscape: !!o.noEscape, tier: o.tier != null ? o.tier : 3, noSurprise: true }); } catch (e) { R.warn('bui fixture: real engine failed', e && e.message); eng = null; }
    }
    if (!eng) eng = new BUI.FakeEngine({ party, mons: o.mons, inv, noEscape: !!o.noEscape, script: o.script, surprise: o.surprise });
    const S = new R.Battle.Scene(eng, { bg: o.bg || 'grass', autoStart: !!o.auto, rare: !!o.rare, canLose: !!o.canLose });
    if (!o.flow) { S.main = async () => {}; S.ready = true; S.opaque = true; }
    R.Battle.current = S;
    BUI.result = null;
    R.Engine.run(S).then((r) => { BUI.result = r; });
    BUI.scene = S; BUI.eng = eng;
    return S;
  };

  // ---------------------------------------------------------------- stepping (works in node and the browser)
  async function flush() { for (let k = 0; k < 12; k++) await null; }
  const api = {
    async step(n) { for (let i = 0; i < (n || 1); i++) { R.Engine.step(); await flush(); } },
    async press(b, hold) {
      R.Input._set(b, true); await api.step(hold || 1);
      R.Input._set(b, false); await api.step(1);
    },
    async keys(list) { for (const k of list.split(',').map((s) => s.trim()).filter(Boolean)) { if (/^\d+$/.test(k)) await api.step(+k); else await api.press(k); } },
    shots: [],
    shot(label) {
      if (typeof document === 'undefined') return;
      R.Engine.render();
      api.shots.push({ label, data: G().canvas.toDataURL('image/png') });
    },
    /** a crop of the screen (logical x, y, w, h) enlarged k× more with no smoothing — for checking pixels */
    zoom(label, x, y, w, h, k) {
      if (typeof document === 'undefined') return;
      R.Engine.render();
      const S = R.SCALE, src = G().canvas, cv = document.createElement('canvas');
      k = k || 2;
      cv.width = w * S * k; cv.height = h * S * k;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(src, x * S, y * S, w * S, h * S, 0, 0, cv.width, cv.height);
      api.shots.push({ label, data: cv.toDataURL('image/png') });
    },
  };
  BUI.api = api;
  BUI.flush = flush;

  // ---------------------------------------------------------------- scenarios (§11.12.2 #8–#13, #22 and the rest of §11.5)
  const P = () => BUI.P || (BUI.P = pick());
  const SC = (BUI.scenarios = {});
  const std = () => [{ id: 'wolf_2' }, { id: 'wolf_2', golden: true }, { id: 'wolf_2' }, { id: 'goblin_2' }];
  /** the worst window row of §12.5: 5-char names, HP 999 / MP 150 / WP 99, two in the middle row, statuses, one down */
  function worst(party) {
    const [h, b, s, m] = party;
    h.hp = 999; h.mp = 150; h.wp = 99; h._max = { hp: 999, mp: 150, wp: 99 };
    b.status = { poison: true, silence: true };
    s.hp = 0; s.status = {};
    m.hp = 18; m.status = { regen: true, veil: true, nimble: true, burn: true };
  }
  const atCommands = async (S) => { S.commandPhase().then((c) => { BUI.cmds = c; }); await api.step(2); };

  SC.command = async (a) => {
    const S = BUI.open({ mons: std(), tweak: worst });
    await atCommands(S);
    await a.step(30); a.shot('party_menu');
    a.zoom('zoom_windows_right', 128, 0, 128, 60, 2);
    await a.keys('right'); await a.step(2); a.shot('party_menu_repeat_gray');
    await a.keys('left,a'); await a.step(4); a.shot('member_menu_hero');
    await a.step(60); a.shot('member_menu_icons_page2');
  };
  SC.member = async (a) => {
    const S = BUI.open({ mons: std() });
    const m = R.Game.party[3];
    S.memberMenu(S.eng.party[3], {}); await a.step(4); a.shot('member_menu_marta');
    void m;
  };
  SC.techs = async (a) => {
    const S = BUI.open({ mons: std(), tweak: (p) => { p[0].wp = 7; } });
    const u = S.eng.party[0];
    S.acting = u;
    S.weaponMenu(u, R.Rules.commands(u.c)[0]); await a.step(4); a.shot('tech_list');
    await a.keys('up,right'); await a.step(4); a.shot('tech_list_8char_wp_short');
    a.zoom('zoom_tech_list', 8, 150, 240, 68, 2);
    await a.keys('left'); await a.step(4); a.shot('tech_list_w7_ok');
  };
  SC.reach = async (a) => {
    // a sword in the middle row: 攻撃 and the front-only techs are gray, the help says why
    const S = BUI.open({ mons: std(), tweak: (p) => { p[0].row = 'middle'; } });
    const u = S.eng.party[0];
    S.weaponMenu(u, R.Rules.commands(u.c)[0]); await a.step(4); a.shot('reach_attack_gray');
  };
  SC.spells = async (a) => {
    const S = BUI.open({ mons: std(), tweak: (p) => { p[3].mp = 6; } });
    S.spellMenu(S.eng.party[3]); await a.step(4); a.shot('spell_list');
    await a.keys('down,down,down'); await a.step(4); a.shot('spell_list_mp_short');
  };
  SC.items = async (a) => {
    const S = BUI.open({ mons: std(), noEscape: true });
    S.itemMenu(S.eng.party[0], {}); await a.step(4); a.shot('item_list');
    await a.keys('b'); await a.step(2);
    const c = S.eng.party[0].c;
    c.mem.item = S.battleItems({}).findIndex((x) => x.id === 'i_smoke');
    S.itemMenu(S.eng.party[0], {}); await a.step(4); a.shot('item_list_noescape');
  };
  SC.targets = async (a) => {
    const S = BUI.open({ mons: [{ id: 'goblin_2' }, { id: 'goblin_2' }, { id: 'goblin_2' }, { id: 'wolf_2', golden: true }] });
    const u = S.eng.party[0];
    S.pickTarget(u, 'enemy'); await a.step(4); a.shot('target_enemy');
    await a.keys('right,right,right'); await a.step(4); a.shot('target_enemy_golden');
    await a.keys('b'); await a.step(2);
    S.pickTarget(u, 'group'); await a.step(4); a.shot('target_group');
    await a.keys('b'); await a.step(2);
    S.pickTarget(u, 'ally'); await a.step(4); a.shot('target_ally');
    await a.keys('left'); await a.step(4); a.shot('target_ally_wrap4');
    await a.keys('b'); await a.step(2);
    S.pickTarget(u, 'enemies'); await a.step(4); a.shot('target_all');
    await a.keys('b'); await a.step(2);
    S.pickTarget(u, 'allies'); await a.step(4); a.shot('target_allies');
  };
  async function glimmerShot(a, id, label, idx) {
    const S = BUI.open({ mons: std() });
    const u = S.eng.party[idx || 0];
    S.acting = u;
    const p = (async () => { await S.handle({ t: 'glimmer', u, id, kind: DB.actions[id].kind }); await S.handle({ t: 'msg', text: `${u.name}は${DB.actions[id].name}を閃いた！` }); })();
    await a.step(3); a.shot(label + '_f3');
    await a.step(9); a.shot(label + '_f12');
    await a.step(20); a.shot(label + '_f32');
    void p;
  }
  SC.glimmer = async (a) => { await glimmerShot(a, P().tech, 'glimmer'); };
  SC.glimmer_oogi = async (a) => { await glimmerShot(a, P().oogi, 'glimmer_oogi'); };
  SC.glimmer_gokui = async (a) => { await glimmerShot(a, P().gokui, 'glimmer_gokui'); };
  SC.glimmer_combo = async (a) => { await glimmerShot(a, P().combo, 'glimmer_combo', 3); };
  SC.glimmer_long = async (a) => { await glimmerShot(a, P().tech8, 'glimmer_8char'); };
  SC.glimmer_flow = async (a) => {
    // a real round through the scene: the fx of the new tech waits until frame H after the ピコーン
    const S = BUI.open({ mons: std(), script: { glimmer: [{ round: 1, idx: 0, id: P().tech }], monsIdle: true } });
    const u = S.eng.party[0];
    const cmds = []; cmds[0] = { type: 'attack', slot: 'weapon1', target: S.eng.mons[0] };
    S.play(S.eng.playRound(cmds)).then(() => { BUI.roundDone = true; });
    for (let f = 0; f < 70; f += 10) { await a.step(10); a.shot('glimmer_flow_' + (f + 10)); }
    void u;
  };
  async function dropShot(a, grade, item, label) {
    const S = BUI.open({ mons: std() });
    S.paged = true;
    const name = DB.monsters.wolf_2 ? DB.monsters.wolf_2.name : 'オオカミ';
    const it = DB.items[item];
    const evs = [{ t: 'clear' }, { t: 'drop', mon: 'wolf_2', name, item, grade }, { t: 'msg', text: `${name}は${grade !== 'normal' ? '★' : ''}${it.name}を残していった！` }];
    if (grade === 'rare') evs.push({ t: 'msg', text: 'レアアイテムだ！' });
    if (grade === 'super') evs.push({ t: 'msg', text: '超レアアイテムだ！' });
    evs.push({ t: 'pause' });
    for (const e of S.eng.mons) e.hp = 0;
    const p = (async () => { for (const e of evs) await S.handle(e); })();
    await a.step(3); a.shot(label + '_open');
    await a.step(60); a.shot(label);
    await a.step(7); a.shot(label + '_b');
    void p;
  }
  SC.drop_normal = async (a) => { await dropShot(a, 'normal', P().normalItem, 'drop_normal'); };
  SC.drop_rare = async (a) => { await dropShot(a, 'rare', P().rareItem, 'drop_rare'); };
  SC.drop_super = async (a) => { await dropShot(a, 'super', P().superItem, 'drop_super'); };
  SC.steal_rare = async (a) => {
    const S = BUI.open({ mons: std() });
    const p = (async () => { await S.handle({ t: 'gain', item: P().rareItem, grade: 'rare', stolen: true }); await S.handle({ t: 'msg', text: `シルヴァンは★${DB.items[P().rareItem].name}を盗んだ！` }); })();
    await a.step(40); a.shot('steal_rare');
    void p;
  };
  SC.golden = async (a) => {
    const S = BUI.open({ mons: [{ id: P().golden }, { id: P().golden, golden: true }, { id: P().golden }], flow: true });
    await a.step(80); a.shot('golden_intro');
    await a.step(10); a.shot('golden_intro_b');
    await a.step(60); a.shot('golden_sparkles');
    void S;
  };
  SC.rare = async (a) => {
    const S = BUI.open({ mons: [{ id: P().rare }], flow: true, rare: true, bg: 'forest' });
    await a.step(96); a.shot('rare_intro');
    await a.step(120); a.shot('rare_after');
    void S;
  };
  SC.metal = async (a) => {
    const S = BUI.open({ mons: [{ id: P().metal }, { id: P().metal }], bg: 'cave' });
    await atCommands(S); await a.step(20); a.shot('metal_names');
  };
  SC.boss = async (a) => {
    // the tallest boss sprite (≈ 112): how much of the head hides behind the window band
    const list = P().bosses.map((id) => { const d = DB.monsters[id]; let img = G().get('mon:' + (d.sprite || id)); if (Array.isArray(img)) img = img[0]; return { id, h: img.height, w: img.width }; })
      .filter((x) => x.w <= 160).sort((x, y) => y.h - x.h);
    const S = BUI.open({ mons: [{ id: list[0].id }], bg: 'castle' });
    await atCommands(S); await a.step(10); a.shot('boss_tall_' + list[0].h);
    BUI.open({ mons: [{ id: list[3].id }], bg: 'cave' });
    await a.step(10); a.shot('boss_' + list[3].h);
  };
  SC.repeat = async (a) => {
    const S = BUI.open({ mons: std(), script: { partyDamage: 1, monDamage: 1 } });
    S.lastCmds = S.eng.party.map((p) => ({ type: 'attack', slot: 'weapon1', target: S.eng.mons[0] }));
    S.repeating = true;
    const loop = (async () => { for (let r = 0; r < 3 && !S.eng.result; r++) { const c = await S.commandPhase(); S.lastCmds = c; await S.play(S.eng.playRound(c)); } })();
    await a.step(40); a.shot('repeat_on');
    await a.press('b'); await a.step(20); a.shot('repeat_cancel');
    await a.step(600); a.shot('repeat_stopped_menu');
    void loop;
  };
  SC.auto = async (a) => {
    const S = BUI.open({ mons: std() });
    S.auto = true;
    await a.step(20); a.shot('auto_on');
    S.autoCancel = true; await a.step(2); a.shot('auto_cancel');
  };
  SC.popups = async (a) => {
    const S = BUI.open({ mons: std() });
    const [h, b, s, m] = S.eng.party, e = S.eng.mons;
    S.pop(e[0], 128, 'white'); S.pop(e[1], 256, 'yellow'); S.pop(e[2], 24, 'purple'); S.pop(e[3], 18, 'orange'); S.pop(e[3], null, 'gray');
    S.pop(h, 214, 'white'); S.pop(b, 36, 'green'); S.pop(s, 12, 'cyan'); S.pop(m, 9, 'orange');
    S.winFx[0].flash = 14; S.winFx[0].shake = 18;
    await a.step(8); a.shot('popups');
  };
  SC.statuses = async (a) => {
    const S = BUI.open({ mons: std(), tweak: (p) => {
      p[0].status = { poison: true, burn: true, sleep: true }; p[1].status = { paralyze: true, freeze: true, stun: true };
      p[2].status = { confuse: true, silence: true, blind: true }; p[3].status = { regen: true, veil: true, counter: true };
    } });
    await a.step(2); a.shot('status_icons_a');
    for (const p of S.eng.party) p.c.status = {};
    const [h, b, s, m] = S.eng.party; h.c.status = { nimble: true, cover: true }; h.buffs.atk = 1; h.buffs.def = -1;
    b.c.status = { poison: true, sleep: true, confuse: true, silence: true, blind: true };
    await a.step(2); a.shot('status_icons_b');
    await a.step(60); a.shot('status_icons_b_rot');
  };
  async function fxShots(a, ids, fromParty, label) {
    const S = BUI.open({ mons: std(), bg: 'forest' });
    for (const id of ids) {
      S.fxList = [];
      const u = fromParty ? S.eng.party[1] : S.eng.mons[0];
      const t = fromParty ? S.eng.mons.slice(0, id === 'stance' ? 0 : 1) : [S.eng.party[0]];
      const h = R.BattleFX.play(S, id, { user: S.rectOf(u), targets: t.map((x) => S.rectOf(x)), ab: null, kind: 'ability' });
      // fx instances run at the battle speed: impact after h / spd real frames
      const imp = Math.max(2, Math.ceil(h / S.spd));
      const f1 = Math.max(1, Math.round(imp * 0.45));
      await a.step(f1); a.zoom(label + '_' + id + '_a', 0, 0, 256, 150, 1);
      await a.step(Math.max(1, imp - f1)); a.zoom(label + '_' + id + '_b', 0, 0, 256, 150, 1);
      await a.step(6);
    }
  }
  SC.fx_new = async (a) => { await fxShots(a, ['arrow', 'arrow2', 'arrow3', 'lash', 'lash2', 'lash3', 'stance'], true, 'fx'); };
  SC.fx_levels = async (a) => { await fxShots(a, ['slash2', 'slash3', 'pierce3', 'strike3', 'claw3', 'bite2', 'holy2', 'dark3', 'magic3', 'explosion2', 'heal3'], true, 'fx'); };
  SC.fx_status = async (a) => { await fxShots(a, ['burn', 'freeze', 'stun', 'veil', 'nimble', 'wp'], true, 'fx'); };
  SC.fx_chain = async (a) => {
    // an fx array (合成術): the second effect plays at 60 % length after the first one's impact
    const S = BUI.open({ mons: std(), bg: 'forest' });
    const id = P().combo, ab = DB.actions[id];
    S.playFx({ t: 'fx', fx: ab.fx, user: S.eng.party[3], targets: S.eng.mons.slice(0, 4), ab, kind: 'ability' });
    for (let i = 1; i <= 6; i++) { await a.step(8); a.shot('fx_chain_' + i * 8); }
  };
  SC.phase = async (a) => {
    const sp = Object.keys((R.Art && R.Art.BOSS_PHASE_SPRITES) || {});
    const bid = P().bosses.find((id) => DB.monsters[id].phases && DB.monsters[id].phases.some((p) => p.set && p.set.sprite)) || P().bosses[0];
    const ph = (DB.monsters[bid].phases || []).find((p) => p.set && p.set.sprite) || { msg: '魔物の様子が変わった！', set: { sprite: sp[0] || DB.monsters[bid].sprite } };
    const S = BUI.open({ mons: [{ id: bid }], bg: 'castle' });
    const u = S.eng.mons[0];
    const p = S.handle({ t: 'phase', u, text: ph.msg, sprite: ph.set.sprite });
    await a.step(4); a.shot('phase_flash');
    await a.step(40); a.shot('phase_after');
    void p;
  };
  SC.summon = async (a) => {
    const S = BUI.open({ mons: [{ id: 'goblin_2' }, { id: 'goblin_2' }] });
    const eng = S.eng;
    const add = (id) => { const m = new (Object.getPrototypeOf(eng.mons[0]).constructor)({ id }, eng.mons.length); eng.mons.push(m); return eng.mons.length - 1; };
    const idx = [add('goblin_2'), add('goblin_2')];
    eng.relabel();
    S.handle({ t: 'summon', units: idx });
    await a.step(4); a.shot('summon_slide');
    await a.step(20); a.shot('summon_done');
  };
  SC.layout = async (a) => {
    BUI.open({ mons: ['bat_1', 'bat_1', 'bat_1', 'jelly_1', 'jelly_1', 'jelly_1', 'rat_1', 'rat_1'].map((id) => ({ id })) });
    await a.step(6); a.shot('eight_small');
    BUI.open({ mons: ['orc_2', 'mammoth_1', 'yeti_2', 'treant_3', 'orc_2'].map((id) => ({ id })) });
    await a.step(6); a.shot('two_rows');
  };
  SC.flow = async (a) => {
    // the whole scene from the wipe: intro → appearance lines → party menu
    const S = BUI.open({ mons: std(), flow: true, bg: 'grass' });
    await a.step(20); a.shot('intro_wipe');
    await a.step(60); a.shot('intro_begin');
    await a.step(200); a.shot('first_menu');
    void S;
  };
  SC.defeat = async (a) => {
    const S = BUI.open({ mons: std(), canLose: false });
    for (const p of S.eng.party) p.c.hp = 0;
    S.defeat(); await a.step(90); a.shot('defeat');
  };
  SC.levelup = async (a) => {
    const S = BUI.open({ mons: std(), script: { levelUps: [{ idx: 0, level: 35 }] } });
    S.paged = true;
    for (const m of S.eng.mons) m.hp = 0;
    S.play(S.eng.rewards());
    await a.step(80); a.shot('rewards');
    await a.press('a'); await a.step(60); a.shot('levelup');
  };

  BUI.run = async function (name) {
    api.shots = [];
    R.Engine.paused = true;
    try { await SC[name](api); } catch (e) { api.shots.push({ label: 'ERROR', error: String((e && e.stack) || e) }); }
    const out = api.shots;
    api.shots = [];
    return out;
  };
  BUI.list = () => Object.keys(SC);
})(window.RPG);
