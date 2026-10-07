#!/usr/bin/env node
// クリア後のテスターの報告（2026-10-07）の node の確かめ。ブラウザの確かめは test_postclear_fixes_1007_browser.js
//   Z1 店の中（ビブリアの白紙堂）からのワープ: どの行き先も着く／飛べない・飛べなかった時は黙らずにわけを出す／
//      ワープの一覧が問いの失敗で入力を受けなくならない
//   Z2 マップが替わった直後の押しっぱなし: 忘却の底 2 階の下り階段で↓を押したまま → 3 階に着いて、すぐ後ろの上り階段を踏まない。
//      離せばすぐ歩ける。出口の無い向きは少し（F.HOLD_GUARD_MS）止まってから歩き続ける。ふつうの歩きは遅くならない
//   Z8 戦闘のリピートで盗む（かすめ取り）が続く。盗めない相手 → まだ盗める相手へ。誰からも盗めない → 攻撃
//   node v2/tools/test_postclear_fixes_1007.js
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const S = R.Field._s;
R.Field._warmPeople = () => 0;   // node には canvas が無い（人の絵を焼かない。test_field と同じく当たりと動きだけを見る）
const I = R.Input;

const adv = (ms) => R.Engine.advance(ms);
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function settle(ms) { for (let t = 0; t < (ms || 400); t += 50) { adv(50); await flush(); } }
async function drive(p, ms) {
  let fin = false, val;
  p.then((v) => { fin = true; val = v; }, (e) => { fin = true; console.error(e); });
  for (let t = 0; t < (ms || 3000) && !fin; t += 16.67) { adv(16.67); await flush(); }
  return val;
}
/** drive と同じ。着いた所のイベントの文は A で送る */
async function driveA(p, ms) {
  let fin = false, val;
  p.then((v) => { fin = true; val = v; }, (e) => { fin = true; console.error(e); });
  for (let t = 0, k = 0; t < (ms || 3000) && !fin; t += 16.67, k++) {
    if (k % 12 === 0 && R.UIK.Message.busy()) { I._set('a', true); adv(16.67); await flush(); I._set('a', false); }
    adv(16.67); await flush();
  }
  return val;
}
/** ms の間、フレームを進める（押している物はそのまま） */
async function frames(ms) { for (let t = 0; t < ms; t += 16.67) { adv(16.67); await flush(); } }
const pos = () => R.Field.pos;

function postClear() {
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 7 });
  const G = R.Game;
  R.DB.config.slice = false;   // 製品版（体験版の境はワープの一覧から終盤の地方を外す）
  Object.assign(G.flags, { oblivion_2_arrive: true, oblivion_3_arrive: true, oblivion_echo: true, prologue_done: true, final_arrived: true, final_archive_seen: true, final_clear: true, story_t8: true, final_roa: true, final_open: true, final_sailed: true });
  G.tier = 8; G.pendingTier = null;
  for (const id of ['roa', 'pharos', 'biblia', 'archive', 'oblivion']) G.warps[id] = true;
  R.Field._encounterStep = () => null;
}

async function main() {
  postClear();
  await R.Field.enter('biblia_shop', Object.keys(R.DB.maps.biblia_shop.spawns)[0], { fade: 0, noAutosave: true });
  await settle(200);

  // ================================================================ Z1
  section('Z1 店の中からのワープ');
  ok('in the Biblia shop (interior, location biblia)', pos().map === 'biblia_shop' && R.DB.maps.biblia_shop.kind === 'interior');
  ok('warpWhy: Roa and Pharos are usable from the shop', R.Field.warpWhy('roa') === null && R.Field.warpWhy('pharos') === null, [R.Field.warpWhy('roa'), R.Field.warpWhy('pharos')]);
  // 着く所のデータ: 一覧に出るすべての場所に、マップと着く所（spawn）があり、歩けるマスで、出口のマスでない
  {
    const bad = [];
    for (const [id, l] of Object.entries(R.DB.locations)) {
      const m = R.DB.maps[l.map];
      const sp = m && (typeof l.spawn === 'string' ? (m.spawns || {})[l.spawn] : l.spawn);
      if (!m || !sp) { bad.push(id + ': no map/spawn'); continue; }
      if (!R.Field._walkable(m, sp.x, sp.y, null, sp.lv || 0)) bad.push(id + ': spawn not walkable');
      if (R.Field._warpAt(m, sp.x, sp.y, sp.lv || 0)) bad.push(id + ': spawn on an exit');
    }
    ok('every warp destination has a walkable landing spot (not on an exit)', bad.length === 0, bad);
  }
  for (const dest of ['roa', 'pharos', 'biblia']) {
    await R.Field.enter('biblia_shop', Object.keys(R.DB.maps.biblia_shop.spawns)[0], { fade: 0, noAutosave: true });
    await settle(100);
    const r = await driveA(R.Field.warp(dest), 20000);
    await settle(200);
    ok('warp from the shop → ' + dest, r === true && pos().map === R.DB.locations[dest].map, { r, pos: pos() });
    for (let i = 0; i < 20 && (R.Events.busy() || R.UIK.Message.busy()); i++) { R.UIK.Message.skip && R.UIK.Message.skip(); I._set('a', true); adv(17); await flush(); I._set('a', false); await settle(120); }
  }
  // 飛べなかった（入る途中で投げた）: 黙らずにわけ、暗転を明ける、止めた物が残らない
  {
    await R.Field.enter('biblia_shop', Object.keys(R.DB.maps.biblia_shop.spawns)[0], { fade: 0, noAutosave: true });
    await settle(100);
    const toasts = [];
    const origToast = R.Field.hud.toast, origEnter = R.Field.enter;
    R.Field.hud.toast = (t) => { toasts.push(t); };
    R.Field.enter = () => Promise.reject(new Error('test: enter failed'));
    const origErr = console.error; console.error = () => {};
    const r = await drive(R.Field.warp('roa'));
    console.error = origErr;
    R.Field.enter = origEnter;
    await settle(300);
    ok('enter throws → warp resolves false and shows the reason', r === false && toasts.includes(R.T('sys.field.warp.fail.failed')), { r, toasts });
    ok('… still in the shop, no locks, screen not dark', pos().map === 'biblia_shop' && Object.keys(R.Field.locks()).length === 0 && R.Engine.fade.a < 0.01 && !S.entering, { pos: pos(), locks: R.Field.locks(), fade: R.Engine.fade.a });
    // 何も起きずに元のマップのまま（enter が黙って戻った）
    R.Field.enter = () => Promise.resolve();
    toasts.length = 0;
    const r2 = await drive(R.Field.warp('roa'));
    R.Field.enter = origEnter;
    ok('enter returns without moving → reason shown (no silent no-op)', r2 === false && toasts.length === 1, toasts);
    // 行き先のデータが無い
    toasts.length = 0;
    const r3 = await drive(R.Field.warp('no_such_place'));
    ok('unknown destination → reason shown', r3 === false && toasts[0] === R.T('sys.field.warp.fail.missing'), toasts);
    R.Field.hud.toast = origToast;
    const langs = ['ja', 'en', 'ko', 'zh-Hans', 'zh-Hant'];
    const src = langs.map((l) => fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', l, 'field.js'), 'utf8'));
    for (const k of ['missing', 'locked', 'here', 'failed']) ok('reason text exists in every language: ' + k, src.every((t) => t.includes("'sys.field.warp.fail." + k + "'")));
  }
  // ワープの一覧（screens/warp.js）: 問いが投げても busy が残らない／飛べない行は選ぶとわけを出し、閉じない
  {
    const def = R.Screens._defs.warp;
    const v = Object.create(def);
    v.p = {}; v.closed = undefined; v.close = (x) => { v.closed = x; };
    v.init();
    const roaRow = v.list.rows.find((r) => r.value === 'roa');
    const here = v.list.rows.find((r) => r.value === 'biblia');
    ok('warp list from the shop: Roa selectable, Biblia (here) greyed with a reason', roaRow && !roaRow.disabled && here && here.disabled && here.why === 'here', v.list.rows.map((r) => [r.value, r.disabled, r.why]));
    const origAsk = R.Screens.ask;
    const origErr = console.error; console.error = () => {};
    R.Screens.ask = () => Promise.reject(new Error('test: ask failed'));
    await v.pick(roaRow); await flush();
    console.error = origErr;
    ok('ask throws → the list is not stuck (busy false), nothing closed', v.busy === false && v.closed === undefined);
    const asked = [];
    R.Screens.ask = (vv, o) => { asked.push(o.text); return Promise.resolve(0); };
    await v.pick(here); await flush();
    ok('greyed row → a reason is shown, the list stays open', asked[0] === R.T('sys.field.warp.fail.here') && v.closed === undefined && v.busy === false, asked);
    asked.length = 0;
    await v.pick(roaRow); await flush();
    ok('Roa → confirm → closes with {warp: roa}', v.closed && v.closed.warp === 'roa' && asked[0] === R.T('ui.warp.pick.k.ask.text', { label: roaRow.label }), v.closed);
    R.Screens.ask = origAsk;
  }

  // ================================================================ Z2
  section('Z2 マップが替わった直後の押しっぱなし');
  const ob = (x, y, dir) => R.Field.enter('oblivion_2', { x, y, dir: dir || 's' }, { fade: 0, noAutosave: true }).then(() => settle(100));
  {
    const st = R.DB.maps.oblivion_2.objects.find((o) => o.type === 'stairs' && o.to && o.to.map === 'oblivion_3');
    const back = R.DB.maps.oblivion_3.objects.find((o) => o.type === 'stairs' && o.to && o.to.map === 'oblivion_2');
    await ob(st.x, st.y - 1, 's');
    I._set('down', true);
    for (let i = 0; i < 200 && pos().map !== 'oblivion_3'; i++) { adv(16.67); await flush(); }
    ok('holding ↓ onto the down stairs → floor 3', pos().map === 'oblivion_3', pos());
    const land = { x: pos().x, y: pos().y };
    ok('(the up stairs are right behind the landing, in the held direction)', back.x === land.x && back.y === land.y + 1, { land, back: [back.x, back.y] });
    await frames(1500);
    ok('still holding ↓ for 1.5 s → stays on floor 3 (does not walk back onto the up stairs)', pos().map === 'oblivion_3' && pos().x === land.x && pos().y === land.y, pos());
    I._set('down', false); await frames(50);
    I._set('down', true);
    for (let i = 0; i < 200 && pos().map !== 'oblivion_2'; i++) { adv(16.67); await flush(); }
    I._set('down', false);
    ok('after releasing, pressing ↓ again takes the stairs (deliberate)', pos().map === 'oblivion_2', pos());
    await settle(400);
    // 押していた向きを替えた → すぐ歩ける（新しい入力）
    await ob(st.x, st.y - 1, 's');
    I._set('down', true);
    for (let i = 0; i < 200 && pos().map !== 'oblivion_3'; i++) { adv(16.67); await flush(); }
    I._set('down', false); I._set('up', true);
    const y0 = pos().y;
    await frames(200);
    I._set('up', false);
    for (let i = 0; i < 30 && S.mv; i++) { adv(16.67); await flush(); }
    ok('switching to ↑ right after arriving walks at once', pos().map === 'oblivion_3' && pos().y === y0 - 1, pos());
    await settle(200);
    // 出口の無い向きを押したまま: 少し止まって（HOLD_GUARD_MS）から歩き続ける
    await R.Field.enter('oblivion_3', { x: land.x, y: land.y, dir: 'n' }, { fade: 0, noAutosave: true });
    I._set('up', true); adv(17); await flush();   // 押した物は次のフレームで読まれる
    await R.Field.enter('oblivion_3', 'from2', { fade: 0, noAutosave: true });   // ↑ を押したまま着いた（≒ 階段で着いた直後）
    const t0 = R.Engine.time, y1 = pos().y;
    let moved = null;
    for (let i = 0; i < 120 && moved == null; i++) { adv(16.67); await flush(); if (S.mv || pos().y !== y1) moved = R.Engine.time - t0; }
    I._set('up', false);
    ok('holding a direction with no exit ahead: walking resumes after a short pause', moved != null && moved >= R.Field.HOLD_GUARD_MS - 20 && moved <= R.Field.HOLD_GUARD_MS + 120, { moved, guard: R.Field.HOLD_GUARD_MS });
    await settle(400);
    // ふつうの歩き（マップの中）は遅くならない: 押してすぐ 1 歩目が始まる
    await R.Field.enter('oblivion_3', 'from2', { fade: 0, noAutosave: true });
    await settle(100);
    I._set('up', true); adv(17); await flush();
    ok('normal walking: the first step starts on the first frame', !!S.mv);
    I._set('up', false);
    await settle(400);
    ok('guard cleared once released', !S.holdGuard);
  }

  // ================================================================ Z8
  section('Z8 リピートで盗む');
  {
    R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 11 });
    const h = R.Game.chars.hero;
    h.equip.weapon1 = 'w_dagger_1'; h.equip.shield = null; h.techs = ['t_dagger_filch'];
    ok('(fixture) w_dagger_1 is a dagger, filch is a steal tech', R.DB.items.w_dagger_1 && R.DB.items.w_dagger_1.wtype === 'dagger' && R.DB.techs.t_dagger_filch.effects.some((e) => e.type === 'steal'));
    const B = R.BattleCore.create({ mons: [['rat_1', 2]], lv: 7, seed: 'z8' });
    const eng = B.engine;
    for (const m of eng.mons) { m.hp = 99999; try { m.mhp = 99999; } catch (e) { /* getter */ } }
    for (const p of eng.party) { p.hp = 99999; p.mp = 999; }
    const hu = eng.party[0];
    const e0 = eng.mons[0], e1 = eng.mons[1];
    const enemy = B.units.filter((u) => u.side === 'enemy');
    B.submit(hu.uid, { cmd: 'skill', id: 't_dagger_filch', target: enemy[0].uid });
    B.round();
    ok('repeat offered after a steal round', B.partyOptions().includes('repeat'));
    B.setRepeat(true);
    let filch = 0;
    for (let i = 0; i < 2; i++) { const evs = B.round(); filch += evs.filter((e) => e.t === 'act' && e.uid === hu.uid && e.id === 't_dagger_filch').length; for (const p of eng.party) p.mp = 999; }
    ok('repeat keeps using the steal tech (no manual input)', filch === 2, filch);
    ok('carried to the next battle as a steal tech', JSON.stringify(B.lastCommands().hero) === JSON.stringify({ type: 'tech', id: 't_dagger_filch' }), B.lastCommands());
    // 盗めない相手 → まだ盗める相手へ
    e0.stolen = true; e0.stolenSt = true; e1.stolen = false; e1.stolenSt = false;
    let c = eng.repeatCommands([{ type: 'tech', id: 't_dagger_filch', target: e0 }])[hu.idx];
    ok('target already robbed → retarget to someone who still has something', c && c.type === 'tech' && c.id === 't_dagger_filch' && c.target === e1, c && [c.type, c.id, c.target && c.target.uid]);
    // 倒れた相手 → 同じ種の次（ほかのリピートと同じ）
    e0.stolen = false; e0.hp = 0;
    c = eng.repeatCommands([{ type: 'tech', id: 't_dagger_filch', target: e0 }])[hu.idx];
    ok('target fell → next of the same kind, still stealing', c && c.id === 't_dagger_filch' && c.target === e1, c && [c.type, c.target && c.target.uid]);
    // 誰からも盗めない → 攻撃（使えない命令の決まり）
    e0.hp = 99999; e0.stolen = e1.stolen = true; e0.stolenSt = e1.stolenSt = true;
    c = eng.repeatCommands([{ type: 'tech', id: 't_dagger_filch', target: e0 }])[hu.idx];
    ok('nothing left to steal from anyone → falls back to attack', c && c.type === 'attack' && !!c.target, c && c.type);
    // 盗める相手には同じ相手のまま
    e0.stolen = false; e0.stolenSt = false;
    c = eng.repeatCommands([{ type: 'tech', id: 't_dagger_filch', target: e0 }])[hu.idx];
    ok('target still has something → same target', c && c.id === 't_dagger_filch' && c.target === e0);
    // 戦闘をまたぐ持ち越し（相手なし）でも盗める相手を選ぶ
    const B2 = R.BattleCore.create({ mons: [['rat_1', 2]], lv: 7, seed: 'z8b' });
    B2.engine.mons[0].stolen = true; B2.engine.mons[0].stolenSt = true;
    ok('seedRepeat with a steal tech', B2.seedRepeat({ hero: { type: 'tech', id: 't_dagger_filch' } }));
    for (const p of B2.engine.party) p.mp = 999;
    B2.repeat();
    const evs = B2.round();
    const act = evs.find((e) => e.t === 'act' && e.uid === hu.uid);
    ok('next battle: the carried steal goes to a foe that can still be robbed', act && act.id === 't_dagger_filch' && act.targets && act.targets[0] === B2.engine.mons[1].uid, act);
  }
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
