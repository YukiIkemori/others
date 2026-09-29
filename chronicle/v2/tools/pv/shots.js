// PV の撮影の台本（1 カット = 1 つの mp4）。どのカットも同じ手順で撮り直せる（時計は 1 フレームずつ、入力は台本どおり）。
//   node v2/tools/pv/shots.js --site <dist の写し> --out <clips のディレクトリ> [カットの id ...]   （id なしで全部）
//   出力: <out>/<id>.mp4（1920×1080・60fps・音なし）、<id>.audio.json（鳴った音の記録）、<id>.jpg（頭・中・終わりの 3 コマ）
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./cap');
const PVLIB = require('./pvlib');

const sec = (s) => Math.round(s * 60);
// よく使う形
const FIELD = (state, flags, map, spawn) => `PV.clean(); PV.noEnc(); PV.state('${state}', ${JSON.stringify(flags || {})}); PV.enter('${map}', ${JSON.stringify(spawn)})`;
const FX = (name, flags, spawn) => `PV.clean(); PV.noEnc(); PV.fixture('${name}', ${JSON.stringify(flags || {})}, ${JSON.stringify(spawn || null)})`;
// 森の一行（PV 用の状態。主人公は アルン・剣。仲間 セルマ・ヴィオラ・ティッタ）
const FOREST = (o) => JSON.stringify(Object.assign({
  hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, party: ['hero', 'selma', 'viola', 'titta'], reserve: [], tier: 1, gl: 'auto', prof: 'auto', vars: {},
  items: { i_salve: 3, i_potion: 2 }, gold: 500, leads: [],
  flags: { prologue_done: true, forest_found_hans: true, forest_found_ben: true, forest_found_roy: true, forest_start: true, tr_yura_arrival: true, tr_verda_1_arrive: true, tr_verda_2_arrive: true, tr_hut_arrive: true, forest_fine: true },
  map: { id: 'verda_1', spawn: 'camp' } }, o || {}));
// 森で戦闘を始める（台本の指示 plan は (st, u, round) → {cmd, id, target} の式の文字列）
const BATTLE = (setup, plan, pre) => `PV.clean(); PV.state(${FOREST()}); ${pre || ''}; PV.enter('verda_1', 'camp').then(() => { PV.scriptBattle(${plan || 'null'}); return RPG.Battle.start(${JSON.stringify(setup)}); })`;
const at = (tbl) => (i) => tbl[i] || null;   // {フレーム: 式}
// 道に沿って走る（壁に向かって押し続けない）: 撮る前に道のりを決め、毎フレーム PV.steer() で次のマスへ向ける。n フレームぶんより少し長い道のりを取る
const RUN = (hx, hy, n, o) => async (T) => { const k = await T.js(`PV.goFar(${Math.ceil(n / 60 * (o && o.run === false ? 4.1 : 7.3)) + 6}, ${hx}, ${hy}, ${JSON.stringify(Object.assign({ run: true }, o || {}))})`); console.log('[pv] route', k); };
const STEER = () => 'PV.steer()';

const SHOTS = {
  // ---------------------------------------------------------------- 1 つかみ
  // ロアの長老の一言（本物の会話の窓。序章のあとの台詞 E.AGE.old）
  hook_elder: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', { prologue_done: true, prologue_boss: true }, 'roa', 'warp'));
      await T.idle(120);
      await T.js(`RPG.Field.camera.focus(24, 15, {ms: 0})`);
      await T.idle(30);
      await T.js(`RPG.Events.run('roa_elder', {map: 'roa'})`);
    },
    n: sec(5),
  },
  // 灯台の光が夜の海を掃く（ワールドの灯台。灯った後）
  hook_beam: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', { prologue_done: true, prologue_boss: true }, 'world', 'lighthouse'));
      await T.idle(200);
      await T.js(`PV.pan(325, 380, 319, 371, 6500)`);
    },
    n: sec(6.5),
  },
  // ---------------------------------------------------------------- 2 旅立ち
  roa_pan: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', {}, 'roa', 'warp'));
      await T.idle(150);
      await T.js(`PV.pan(12, 12, 30, 16, 5000)`);
    },
    n: sec(5),
  },
  roa_hill_run: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', { prologue_berna: true }, 'f_roa', 'roa'));
      await T.idle(150);
      await RUN(1, 0, sec(5))(T);
    },
    n: sec(5),
    each: STEER,
  },
  pharos_pan: {
    prep: async (T) => {
      await T.js(FIELD('content_p_pharos', {}, 'pharos', 'harbor'));
      await T.idle(150);
      await T.js(`PV.pan(14, 26, 44, 26, 6000)`);
    },
    n: sec(6),
  },

  // オットー（本物の会話・声あり v_otto_pharos_04 の台詞）
  otto: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', { prologue_key: false }, 'pharos', { x: 21, y: 32, dir: 'n' }));
      await T.idle(150); await T.settle();
      await T.js(`PV.autoMsg(30); RPG.Events.run('pharos_otto', {map: 'pharos'})`);
      await T.until(`PV.lastLine().includes('守り歌が')`, 1800);
      await T.js(`PV.autoMsg(0)`);
    },
    n: sec(6),
  },
  // 灯台の中を上る
  lh_climb: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', {}, 'lighthouse_1', 'entrance'));
      await T.idle(150);
      await RUN(0, -1, sec(5), { run: false })(T);   // 灯台の中は歩く（狭いので走ると先に着いて止まる）
    },
    n: sec(5),
    each: STEER,
  },
  // 灯室: 守り歌を書き記して、灯台に火がともる（戦闘は勝ったことにして飛ばす）
  lamp_lit: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', {}, 'lighthouse_3', 'lamp'));
      await T.idle(150); await T.settle();
      await T.js(`RPG.Battle.start = async () => ({result: 'win'}); PV.hideMsg(); PV.autoMsg(40); RPG.Events.run('lighthouse_3_boss', {map: 'lighthouse_3'})`);   // 窓は出さない（火がともる絵だけ）
      await T.until(`PV.lastLine().includes('文字が浮かんで')`, 3000);
    },
    n: sec(16),
  },
  // ベルナ「この大陸には八つの大きな伝承がある。」（v_berna_lute_03）
  berna_lute: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', { prologue_boss: true }, 'pharos', { x: 7, y: 13, dir: 'n' }));
      // 灯った後にファロスへ入ると、朝の鐘の場面（pharos_departure）が始まる
      await T.js(`PV.autoMsg(30)`);
      await T.until(`PV.lastLine().includes('八つ')`, 4000);
      await T.js(`PV.autoMsg(0)`);
    },
    n: sec(7),
  },
  title_screen: {
    url: 'dev.html',
    // 命令の列・版の表記・ボタンの手引きを描かない（題字と絵だけ）
    prep: async (T) => {
      await T.js(`(() => { const U = RPG.UIK, S = RPG.Screens; const tx = U.text;
        U.text = function (g, s) { if (typeof s === 'string' && s.indexOf('ver ') >= 0 && s.indexOf('Studio Metem') >= 0) return; return tx.apply(this, arguments); };
        S.prompts = () => {};
        for (const sc of RPG.Engine.stack) for (const o of [sc, sc.view]) if (o && o.list && o.list.draw) o.list.draw = () => {};
        return true; })()`);
      await T.idle(4);
    },
    n: sec(8),
  },

  // ---------------------------------------------------------------- 4 探索のモンタージュ（走る）
  ex_windhill: { prep: async (T) => { await T.js(FIELD('content_p_roa', {}, 'f_windhill', 'east')); await T.idle(150); await RUN(-1, 0, sec(4))(T); }, n: sec(4), each: STEER },
  ex_cape: { prep: async (T) => { await T.js(FIELD('content_p_roa', { prologue_boss: true }, 'f_cape', 'west')); await T.idle(150); await RUN(1, 0, sec(4))(T); }, n: sec(4), each: STEER },
  ex_verda_stone: { prep: async (T) => { await T.js(FX('content_f_verda_1', {}, { x: 16, y: 29, dir: 'w' })); await T.idle(150); await T.settle(); await RUN(-1, 0, sec(4))(T); }, n: sec(4), each: STEER },
  ex_verda_dark: { prep: async (T) => { await T.js(FX('content_f_verda_2_dark')); await T.idle(150); await T.settle(); await RUN(0, 1, sec(4))(T); }, n: sec(4), each: STEER },
  ex_elder: { prep: async (T) => { await T.js(FX('content_f_elder_1')); await T.idle(150); await T.settle(); }, n: sec(4), each: at({ 0: `PV.btn({up: 1, b: 1})` }) },
  ex_elder2: { prep: async (T) => { await T.js(FX('content_f_elder_2', {}, { x: 23, y: 6, dir: 's' })); await T.idle(150); await T.settle(); await RUN(-1, 1, sec(4))(T); }, n: sec(4), each: STEER },
  ex_well: { prep: async (T) => { await T.js(FX('content_p_well')); await T.idle(150); await T.settle(); }, n: sec(4), each: at({ 0: `PV.btn({up: 1, b: 1})` }) },
  ex_fern: { prep: async (T) => { await T.js(FX('content_f_fern_plaza')); await T.idle(150); await T.settle(); await T.js(`PV.pan(22, 30, 40, 26, 4000)`); }, n: sec(4) },
  ex_lh2: { prep: async (T) => { await T.js(FX('content_p_lighthouse_2')); await T.idle(150); await T.settle(); }, n: sec(4), each: at({ 0: `PV.btn({up: 1, b: 1})` }) },
  ex_world: { prep: async (T) => { await T.js(FX('content_p_world_forest')); await T.idle(150); await T.settle(); }, n: sec(4), each: at({ 0: `PV.btn({left: 1, b: 1})` }) },
  ex_pharos_run: { prep: async (T) => { await T.js(FIELD('content_p_pharos', {}, 'pharos', 'gate_w')); await T.idle(150); await T.settle(); await RUN(1, 0, sec(4))(T); }, n: sec(4), each: STEER },
  // 一枚絵のフィールド（f_*）を走る（古いマス目のワールド・フィールドの代わり）
  nf_roa: { prep: async (T) => { await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST()}); PV.enter('f_roa', 'east')`); await T.idle(150); await T.settle(); await RUN(-1, 0, sec(4.5))(T); }, n: sec(4.5), each: STEER },
  nf_south: { prep: async (T) => { await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST()}); PV.enter('f_south', 'north')`); await T.idle(150); await T.settle(); await RUN(0, 1, sec(4.5))(T); }, n: sec(4.5), each: STEER },
  nf_hut: { prep: async (T) => { await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST()}); PV.enter('f_hut', 'west')`); await T.idle(150); await T.settle(); await RUN(1, 0, sec(4.5))(T); }, n: sec(4.5), each: STEER },
  nf_lookout: { prep: async (T) => { await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST()}); PV.enter('f_lookout', 'south')`); await T.idle(150); await T.settle(); await RUN(0, -1, sec(4.5))(T); }, n: sec(4.5), each: STEER },
  nf_cross: { prep: async (T) => { await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST()}); PV.enter('f_cross', 'west')`); await T.idle(150); await T.settle(); await RUN(1, 0, sec(4.5))(T); }, n: sec(4.5), each: STEER },
  // つかみ: 灯台の岬（灯った後）をゆっくり見渡す（ワールドの灯台の代わり）
  nf_cape_pan: {
    prep: async (T) => { await T.js(FIELD('content_p_roa', { prologue_done: true, prologue_boss: true }, 'f_cape', 'lighthouse')); await T.idle(150); await T.settle(); await T.js(`PV.pan(18, 14, 31, 30, 6500)`); },
    n: sec(6.5),
  },
  ex_map: { url: 'dev.html?scene=menus_map', prep: async (T) => { await T.idle(90); }, n: sec(5) },

  // ---------------------------------------------------------------- 6 戦闘
  bt_enc: {
    prep: async (T) => { await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST()}); PV.enter('verda_1', 'camp')`); await T.idle(150); await T.settle(); await T.js(`PV.scriptBattle(null)`); },
    n: sec(6),
    each: at({ 0: `PV.btn({up: 1})`, 50: `PV.btn({}); RPG.Battle.start({zone: 'z_verda', bg: 'forest', seed: 'pv-enc'})` }),
  },
  bt_glimmer: {
    prep: async (T) => { await T.js(BATTLE({ zone: 'z_verda', bg: 'forest', seed: 'pv-glim', glimmerForce: 'hero' }, `(st, u, r) => u.id === 'hero' ? {cmd: 'skill', id: 't_sword_stepcut'} : null`)); await T.idle(30); },
    n: sec(14),
  },
  bt_derive: {
    prep: async (T) => {
      await T.js(BATTLE({ zone: 'z_verda', bg: 'forest', seed: 'pv-derive' }, `(st, u, r) => u.id === 'hero' ? {cmd: 'skill', id: 't_sword_twin'} : {cmd: 'defend', id: 'defend', self: true}`,
        `PV.teach('hero', ['t_sword_twin']); RPG.Game.chars.hero.techUse = {t_sword_twin: 40}; const dr = RPG.Glimmer.deriveRoll; RPG.Glimmer.deriveRoll = (c, used, ctx) => dr(c, used, Object.assign({}, ctx, {force: c && c.id === 'hero'}))`));
      await T.idle(30);
    },
    n: sec(28),
  },
  bt_spell: {
    prep: async (T) => {
      await T.js(BATTLE({ zone: 'z_verda', bg: 'forest', seed: 'pv-spell' }, `(st, u, r) => u.id === 'viola' ? {cmd: 'spell', id: 's_fire_wind_a'} : {cmd: 'defend', id: 'defend', self: true}`,
        `PV.teach('viola', null, ['s_fire_wind_a', 's_fire_wind_b']); RPG.Game.chars.viola.mp = 99`));
      await T.idle(30);
    },
    n: sec(14),
  },
  bt_boss: {
    prep: async (T) => {
      await T.js(BATTLE({ troop: 'tr_a21_forest_wolves', boss: true, seed: 'pv-boss' },
        `(st, u, r) => u.id === 'hero' ? {cmd: 'skill', id: 't_sword_twin'} : u.id === 'viola' ? {cmd: 'spell', id: 's_fire_wind_b'} : null`,
        `PV.teach('hero', ['t_sword_twin']); PV.teach('viola', null, ['s_fire_wind_b']); PV.boost(1); RPG.Party.restoreAll()`));
      await T.idle(10);
    },
    n: sec(66),
  },
  // 強敵の倒れる所（ラウンドの出来事は始まりにまとめて決まるので、別の撮りで「当たれば倒れる」を最初から入れる）
  bt_boss_kill: {
    prep: async (T) => {
      await T.js(BATTLE({ troop: 'tr_a21_forest_wolves', boss: true, seed: 'pv-boss' },
        `(st, u, r) => u.id === 'hero' ? {cmd: 'skill', id: 't_sword_twin'} : u.id === 'viola' ? {cmd: 'spell', id: 's_fire_wind_b'} : null`,
        `PV.teach('hero', ['t_sword_twin']); PV.teach('viola', null, ['s_fire_wind_b']); PV.boost(1); PV.kill = true; RPG.Party.restoreAll()`));
      await T.idle(10);
    },
    n: sec(26),
  },
  bt_speed: {
    prep: async (T) => { await T.js(BATTLE({ zone: 'z_verda', bg: 'forest', seed: 'pv-speed' }, null)); await T.idle(200); },
    n: sec(10),
    each: at({ 30: `PV.tap('r', 3)`, 150: `PV.tap('r', 3)` }),
  },
  // ---------------------------------------------------------------- 7 寄り道
  ex_golden: {
    prep: async (T) => { await T.js(BATTLE({ zone: 'z_verda', bg: 'forest', seed: 'pv-gold', golden: 'force' }, null)); await T.idle(10); },
    n: sec(8),
  },
  ex_steal: {
    prep: async (T) => { await T.js(BATTLE({ zone: 'z_verda', bg: 'forest', seed: 'pv-steal' }, `(st, u, r) => u.id === 'titta' ? {cmd: 'skill', id: 't_dagger_filch'} : {cmd: 'defend', id: 'defend', self: true}`, `PV.teach('titta', ['t_dagger_filch'])`)); await T.idle(30); },
    n: sec(12),
  },
  ex_shop: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST({ gold: 3000, map: { id: 'pharos', spawn: 'warp' } })}); PV.enter('pharos', 'warp')`);
      await T.idle(90); await T.settle();
      await T.js(`RPG.Screens.open('shop', {id: 'shop_pharos_items'})`); await T.idle(40);
    },
    n: sec(6), each: at({ 30: `PV.tap('a', 3)`, 80: `PV.tap('right', 3)`, 105: `PV.tap('right', 3)`, 130: `PV.tap('up', 3)`, 160: `PV.tap('right', 3)`, 185: `PV.tap('right', 3)` }),
  },
  // 図鑑: 体験版の範囲で出会う魔物を「見た」にしてから開く（空の図鑑を撮らない）
  ex_bestiary: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST({ map: { id: 'fern', spawn: 'plaza' } })}); PV.enter('fern', 'plaza')`);
      await T.idle(90); await T.settle();
      await T.js(`(() => { const G = RPG.Game; G.book = G.book || {}; G.book.mon = G.book.mon || {}; const E = RPG.DB.encounters || RPG.DB.zones || {};
        for (const z of ['zw_peninsula', 'z_lighthouse', 'zw_forest_road', 'z_verda', 'z_elder', 'z_well']) for (const g of ((E[z] || {}).groups || [])) for (const m of g.mons) G.book.mon[m[0]] = Object.assign({seen: true, kills: 3}, G.book.mon[m[0]] || {});
        return RPG.Screens.open('bestiary'); })()`);
      await T.idle(40);
    },
    n: sec(5), each: at({ 50: `PV.tap('down', 3)`, 110: `PV.tap('down', 3)`, 170: `PV.tap('down', 3)`, 230: `PV.tap('down', 3)` }),
  },
  // ---------------------------------------------------------------- 5 仲間
  tavern: { url: 'dev.html?scene=menus_tavern', prep: async (T) => { await T.idle(60); }, n: sec(9), each: (i) => (i >= 30 && i % 24 === 0 && i < 500 ? `PV.tap('${['right', 'right', 'down', 'left', 'left', 'down', 'right', 'right', 'down', 'left', 'left', 'down', 'right', 'right', 'down', 'left', 'left', 'down', 'right', 'right'][(i - 30) / 24 | 0] || 'right'}', 3)` : null) },

  // ---------------------------------------------------------------- 8 山場: 千年樹のこずえに歌の灯（forest_finale の頭。地方の解決の演出）
  fin_beacon: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${FOREST({ map: { id: 'elder_2', spawn: 'altar' } })}); PV.enter('elder_2', 'altar')`);
      await T.idle(120); await T.settle();
      await T.js(`PV.autoMsg(50); RPG.Events.run('forest_finale', {map: 'elder_2'})`);
    },
    n: sec(24),
  },
  // 体験版の終わりの画面の「八つの灯火」（一つ目だけがともる）。上の灯の列だけを使う
  fin_lights: {
    prep: async (T) => { await T.js(`PV.clean(); RPG.UIK.text = () => {}; RPG.Screens.prompts = () => {}; RPG.Demo.showEnd({playMs: 0})`); },   // 字は PV の側で重ねる（灯と夜空と峠だけ）
    n: sec(6),
  },
};

// ---------------------------------------------------------------- 撮る
async function shoot(S, id, out) {
  const sh = SHOTS[id];
  const P = await C.open(S, sh.url || 'dev.html?fixture=content_p_roa');   // タイトルを通らずにフィールドから（タイトルの流れと重ならない）
  await C.run(P, PVLIB);
  const T = {
    js: (code) => C.run(P, code),
    idle: (n, each) => C.idle(P, n, each),
    until: (cond, max) => C.until(P, cond, max),
    // 入った時のイベント（町の人の一言など）を送って終わらせる
    settle: async () => { await C.run(P, 'PV.autoMsg(15)'); await C.until(P, '!RPG.Events.busy() && !RPG.UIK.Message.busy()', 1800); await C.run(P, 'PV.autoMsg(0)'); await C.idle(P, 20); },
    P,
  };
  await sh.prep(T);
  const file = path.join(out, id + '.mp4');
  await C.rec(P, file, sh.n, sh.each || null);
  const st = await C.run(P, 'JSON.stringify({stuck: PV.stuck || 0, left: PV.route ? PV.route.length - PV.ri : 0})');
  if (sh.each === STEER) console.log(`[pv] ${id} steer`, st);   // stuck > 0 なら道から外れた・止まった
  if (P.errors.length) console.log(`[pv] ${id} errors:`, P.errors.slice(0, 4));
  await P.close();
  // 頭・中・終わりの 3 コマ（見て確かめる用）
  const t = [0.05, sh.n / 120, sh.n / 60 - 0.1];
  const args = ['-y', '-loglevel', 'error'];
  t.forEach((s) => args.push('-ss', String(s), '-i', file));
  args.push('-filter_complex', '[0:v]scale=640:360[a];[1:v]scale=640:360[b];[2:v]scale=640:360[c];[a][b][c]hstack=3', '-frames:v', '1', path.join(out, id + '.jpg'));
  execFileSync(C.FF, args);
}

async function main() {
  const a = process.argv.slice(2);
  let site = null, out = null;
  const ids = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--site') site = a[++i];
    else if (a[i] === '--out') out = a[++i];
    else ids.push(a[i]);
  }
  fs.mkdirSync(out, { recursive: true });
  const S = await C.start({ site });
  try {
    for (const id of ids.length ? ids : Object.keys(SHOTS)) {
      if (!SHOTS[id]) { console.log('no shot', id); continue; }
      await shoot(S, id, out);
    }
  } finally { await C.stop(S); }
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { SHOTS };
