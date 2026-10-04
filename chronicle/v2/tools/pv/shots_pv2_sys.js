// PV 第2弾の撮影の台本（戦いのしくみ §5・戦い §8）。shots.js と同じ形（1 カット = 1 つの mp4）。
//   node v2/tools/pv/shots_pv2_sys.js --site <dist の写し（slice:false）> --out <clips のディレクトリ> [カットの id ...]   （id なしで全部）
//   出力: <out>/<id>.mp4（1920×1080・60fps・音なし）、<id>.audio.json（鳴った音の記録）、<id>.jpg（頭・中・終わりの 3 コマ）
//   一行は リーネ（女・術剣士）＋ シグレ・ザフィラ・ロウガ（§8 は台本の仲間を入れ替える）。森の敵・森の背景は使わない。
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./cap');
const PVLIB = require('./pvlib');

const sec = (s) => Math.round(s * 60);

// PV 第2弾だけの小道具（ページの中。ゲームのファイルも pvlib も変えない。PV2 に足すだけ）
//   PV2.voice({接頭辞: 声の id})   戦闘ボイスの候補をその 1 本にする（台本の声に決める。'b_noela_spell_' → 'b_noela_bigtech_1' のように種類も替えられる）
//   PV2.autoWin(n)                 勝利の札が出て n フレームで決定を押す（自動では閉じないので）
//   PV2.rareDrop()                 金色の魔物のレア枠を必ず落とす（ドロップの確率の表を包むだけ）
//   PV2.noTeleText()               何もしない（予告の文はそのまま出す）
//   PV2.shadow(on)                 敵の絵を黒い影にする（最後の影: 名前・姿をはっきり見せない）
const PV2LIB = `(() => {
  const R = window.RPG, PV = window.PV;
  const PV2 = (window.PV2 = {
    voice(map) {
      const V = R.Battle._.voice, cl = V.__pvClips || (V.__pvClips = V.clips);
      V.clips = (pre) => { for (const k of Object.keys(map)) if (pre && pre.startsWith(k)) return [map[k]]; return cl(pre); };
      return true;
    },
    winAfter: 0, winF: 0,
    autoWin(n) { PV2.winAfter = n || 90; PV2.winF = 0; return true; },
    rareDrop() {
      // 落とし物を振る関数を包む（中の dropChances は外から差し替えられないので rollDrops の結果に足す）: 金色の魔物は必ずレアの枠を落とす
      const M = R.Mon, rd = M.__pvRd || (M.__pvRd = M.rollDrops);
      M.rollDrops = function (d, o) {
        const out = rd.apply(this, arguments);
        const sl = d && d.drops && d.drops.rare;
        if (o && o.golden && sl && sl.item && !out.some((x) => x.grade === 'rare')) out.push({ item: sl.item, n: 1, grade: 'rare', slot: 'rare' });
        return out;
      };
      return true;
    },

    /** 偶然の閃きを止める（台本の技をそのまま出す。テスト用メニューの差し込み口の関数を差し替えるだけで、切り替えは入れない） */
    noGlim() { if (R.Tester) R.Tester.glim = () => 0; return true; },
    /** 魔物の行動の表に「最初の手番で必ずこれ」を足す（DB の写しの上で。戦闘の前に呼ぶ） */
    firstAct(mon, act, every) { const d = R.DB.monsters[mon]; d.actions = [{ id: act, w: 100000, cond: { every: every || [99, 0] } }].concat((d.actions || []).filter((a) => a.id !== act)); return true; },
    /** 魔物の行動の表から 1 つ外す（撮りの間だけ。例: 霧食らいの霧の大波の予告） */
    dropAct(mon, act) { const d = R.DB.monsters[mon]; d.actions = (d.actions || []).filter((a) => a.id !== act); return true; },
    /** 戦闘の場面が積まれたか（入る移りが終わった） */
    pushed() { const b = R.Battle.debug && R.Battle.debug(); return !!(b && b.scene && R.Engine.stack.includes(b.scene)); },
    /** 画像の効果の部品（assets/fx の 55 個）を全部読み終えるまで待つ印（PV2.fxOk）。撮る前に読み終える */
    fxLoad() {
      const M = R.Media && R.Media.table ? R.Media.table() : null, ids = Object.keys((M && M.fx) || {});
      PV2.fxN = ids.length; PV2.fxOk = false;
      if (!R.BFX || !R.BFX.img || !R.BFX.img.preload) { PV2.fxOk = true; return 0; }
      R.BFX.img.preload(ids).then(() => { PV2.fxOk = true; }, () => { PV2.fxOk = true; });
      return ids.length;
    },
    /** 閃きの技を決める（glimmerForce の閃きで出す技。R.Glimmer.roll を包むだけ） */
    /** 敵に当たる攻撃を空振りにしない（速い戦い・大技が外れて間延びしないように） */
    sureHit() { const Tt = R.Tester; if (!Tt) return false; Tt.enabled = true; if (!PV.dmgMul) PV.dmgMul = 1; Tt.hitFix = (t, r) => { if (t && !t.isParty) r.miss = false; return r; }; return true; },
    glimTo(id) { const G = R.Glimmer, rl = G.__pvRoll || (G.__pvRoll = G.roll); G.roll = function (c, ctx) { if (ctx && ctx.force) return { id, kind: 'tech' }; return rl.apply(this, arguments); }; return true; },
    /** 敵の合体技を必ず出す（その技の確率を 1 に・間を 0 に。表の写しの上で） */
    comboOn(id) { const c = R.DB.enemyCombos && R.DB.enemyCombos[id]; if (!c) return false; c.chance = 1; c.cd = 0; c.round = null; c.tierMin = 0; return true; },
    phase() { const b = R.Battle.debug && R.Battle.debug(); return b ? b.phase : null; },
    /** 最後の影: 敵の絵を黒い影に・名前の札（ボスの札）・敵の名・上の文・人の札・ボタンの手引き・予告の文を描かない */
    shadow() {
      const _ = R.Battle._, A = _.actors, dr = A.draw, H = _.hud, P = _.play;
      A.draw = function (g, st, a) { if (a.side !== 'enemy') return dr.apply(this, arguments); g.save(); g.filter = 'brightness(0) blur(3px)'; try { return dr.apply(this, arguments); } finally { g.restore(); } };
      H.enemyTags = () => {}; H.head = () => {}; H.party = () => {}; H.chips = () => {}; P.drawTele = () => {};
      R.Battle.prompts = () => ({ list: [] });
      PV2.noCard = true;
      return true;
    },
  });
  R.Engine.addTick(() => {
    if (PV2.noCard) { const b = R.Battle.debug && R.Battle.debug(); if (b && b.bossCard) b.bossCard.ms = 0; }
    if (PV2.winAfter > 0 && PV2.phase() === 'result') { if (++PV2.winF % PV2.winAfter === 0) PV.tap('a', 3); } else PV2.winF = 0;
  });
  return true;
})()`;

// リーネの一行（PV 第2弾。主人公は女・術剣士。仲間はシグレ・ザフィラ・ロウガ）
const STATE = (o) => JSON.stringify(Object.assign({
  hero: { type: 'spellblade', sex: 'f', name: 'リーネ', fav: 'sword' }, party: ['hero', 'shigure', 'zafira', 'rouga'], reserve: [], tier: 3, gl: 'auto', prof: 'auto', vars: {},
  items: { i_potion: 4, i_ether: 2, i_revive: 2 }, gold: 3000, leads: [],
  flags: { prologue_done: true, forest_start: true, cleared_r_forest: true, story_t1: true, forest_fine: true },
  map: { id: 'kasim', spawn: 'warp' } }, o || {}));
// 戦闘を始める（plan は (st, u, round) → {cmd, id, target} の式の文字列。pre は状態を当てた後・マップに入る前の式）
const BATTLE = (st, map, spawn, setup, plan, pre) => `PV.clean(); PV.noEnc(); PV.state(${STATE(st)}); ${pre || ''}; PV.enter('${map}', ${JSON.stringify(spawn)}).then(() => { PV.scriptBattle(${plan || 'null'}); return RPG.Battle.start(${JSON.stringify(setup)}); })`;
const at = (tbl) => (i) => tbl[i] || null;

// 台本の指示: who が cmd/id、ほかは守る（r0 ラウンドより前は全員攻撃）
const FOCUS = (who, cmd, id, o) => `(st, u, r) => { const O = ${JSON.stringify(o || {})}; if (O.from && r < O.from) return {cmd: 'attack', id: 'attack'}; if (u.id === '${who}') return {cmd: '${cmd}', id: '${id}'}; return O.rest === 'attack' ? {cmd: 'attack', id: 'attack'} : {cmd: 'defend', id: 'defend', self: true}; }`;
const DEF = `(st, u, r) => ({cmd: 'defend', id: 'defend', self: true})`;
const INTRO = async (T) => { await T.until(`PV2.pushed()`, 900); };

const SHOTS = {
  // ---------------------------------------------------------------- §5 戦いのしくみ
  // 遭遇: 雪原（一枚絵のフィールド f_floe。立ち止まった一行）→ 画面が砕けて戦闘（雪原の群れ tr_siege_1b、背景 snow）
  s5_enc: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${STATE({ map: { id: 'f_floe', spawn: 'landing' } })}); PV.enter('f_floe', 'landing')`);
      await T.idle(150); await T.settle();
      await T.js(`PV.scriptBattle(${DEF}); PV2.noGlim()`);
    },
    n: sec(6),
    each: at({ 60: `RPG.Battle.start({troop: 'tr_siege_1b', bg: 'snow', seed: 'pv2-enc'})` }),
  },
  // 閃き: リーネの頭に電球 → 大きな技名「日の出の剣」→ その技で一撃（砂漠の待ち伏せ tr_desert_ambush3、背景 desert）
  s5_glimmer: {
    prep: async (T) => {
      await T.js(BATTLE({}, 'kasim', 'warp', { troop: 'tr_desert_ambush3', bg: 'desert', seed: 'pv2-glim', glimmerForce: 'hero', surprise: 'pre' },
        `(st, u, r) => u.id === 'hero' ? {cmd: 'attack', id: 'attack'} : {cmd: 'defend', id: 'defend', self: true}`, `PV2.autoWin(80); PV.boost(3); PV2.glimTo('t_sword_dawn')`));
      await INTRO(T);
    },
    n: sec(13),
  },
  // 技・術の画面（リーネ）: 覚えた技と術。閃いたばかりの物に NEW（ゲームに「？？？」の技の書は無いので、この画面で代える）
  s5_book: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${STATE({ map: { id: 'kasim', spawn: 'warp' } })}); PV.teach('hero', ['t_sword_draw', 't_sword_twin', 't_sword_bladewind', 't_sword_first', 't_sword_triple', 't_sword_dawn'], ['s_fire_1', 's_fire_2', 's_water_1', 's_fire_water_a', 's_wind_1', 's_earth_3', 's_light_2']); PV.enter('kasim', 'warp')`);
      await T.idle(120); await T.settle();
      await T.js(`(() => { const s = (RPG.Game.seenSkill = RPG.Game.seenSkill || {}); s.hero = {t_sword_stepcut: true, t_sword_draw: true, t_sword_twin: true, s_fire_1: true, s_fire_2: true, s_water_1: true, s_wind_1: true}; return RPG.Screens.open('skills', {id: 'hero'}); })()`);
      await T.idle(40);
    },
    n: sec(6),
    each: (i) => (i >= 40 && i < 330 && (i - 40) % 26 === 0 ? `PV.tap('down', 3)` : null),
  },
  // 合成術: 荒れ狂う海（水×風×土の三つ重ね）を湿原の魔物に（湿原の館の出現表 z_marsh_manor、背景はゲームのまま manor）
  s5_combo: {
    prep: async (T) => {
      await T.js(BATTLE({}, 'kasim', 'warp', { zone: 'z_marsh_manor', bg: 'manor', seed: 'pv2-combo', surprise: 'pre', golden: false, rare: false },
        FOCUS('hero', 'spell', 's_water_wind_earth'), `PV.teach('hero', null, ['s_water_wind_earth']); PV2.noGlim(); PV2.autoWin(70); PV.boost(1); PV.kill = true`));
      await INTRO(T);
    },
    n: sec(16),
  },
  // ボスの予告（不意打ちの 1 手番目に必ず「身を沈める」。組み直しで予告はたまにになったので撮りでは最初に出す）→ 全員で守る → しのぐ（砂の王墓の 砂もぐり tr_b_sandworm、背景はゲームのまま pyramid）
  s5_tell: {
    prep: async (T) => {
      await T.js(BATTLE({}, 'kasim', 'warp', { troop: 'tr_b_sandworm', boss: true, seed: 'pv2-tell', surprise: 'ambush' },
        DEF, `RPG.Party.restoreAll(); PV2.noGlim(); PV2.autoWin(60); PV2.firstAct('b_sandworm', 'eb_worm_rear')`));
      await INTRO(T);
    },
    n: sec(30),
  },
  // 持ち主 2026-10-03「敵の攻撃の 2 カットが古い弱い演出」→ ボスの必殺技（差し込みの帯つき。src/systems/battle/ult_fx.js）に替える。
  // 砂の王の裁き: 名なき砂の王（王墓の王の間 tr_b_sandking、背景はゲームのまま pyramid）。1 手番目に「呪いの紋を掲げる」（予告）→ 全員で守る → 必殺技（ボスの掛け声つき）
  s5_tell_king: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 3 }, 'kasim', 'warp', { troop: 'tr_b_sandking', boss: true, seed: 'pv2-king', surprise: 'ambush' },
        DEF, `RPG.Party.restoreAll(); PV2.noGlim(); PV2.autoWin(60); PV2.firstAct('b_sandking', 'eb_king_raise')`));
      await INTRO(T);
    },
    n: sec(30),
  },
  // ボスの必殺技の候補（1 つ選ぶ）: 天球の番人の皆既日食（tower）・白竜の氷河落とし（peak）・溶岩の巨獣の大噴火（volcano）。1 手番目に必ず出す
  s5_ult_eclipse: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 6 }, 'kasim', 'warp', { troop: 'tr_b_orrery', boss: true, seed: 'pv2-ecl', surprise: 'ambush' },
        DEF, `RPG.Party.restoreAll(); PV2.noGlim(); PV2.firstAct('b_orrery', 'eb_orrery_eclipse')`));
      await INTRO(T);
    },
    n: sec(16),
  },
  s5_ult_glacier: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 4 }, 'kasim', 'warp', { troop: 'tr_b_whitedragon', boss: true, seed: 'pv2-glac', surprise: 'ambush' },
        DEF, `RPG.Party.restoreAll(); PV2.noGlim(); PV2.firstAct('b_whitedragon', 'eb_glacier_fall')`));
      await INTRO(T);
    },
    n: sec(16),
  },
  s5_ult_eruption: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 5 }, 'kasim', 'warp', { troop: 'tr_b_lavabeast', boss: true, seed: 'pv2-erup', surprise: 'ambush' },
        DEF, `RPG.Party.restoreAll(); PV2.noGlim(); PV2.firstAct('b_lavabeast', 'eb_eruption')`));
      await INTRO(T);
    },
    n: sec(16),
  },
  // 出現表だけの戦闘は setup に出現表の bg を渡す（フィールドの遭遇 R.Mon.encounter と同じ）
  // 金色の魔物 → 倒して「レア」のジングルと演出（諸島の洞窟の出現表 z_r_isles_cave の魚人＋カニ。金色はレアの枠を持つカニ、背景はゲームのまま watercave）
  s5_gold: {
    prep: async (T) => {
      await T.js(BATTLE({}, 'kasim', 'warp', { zone: 'z_r_isles_cave', mons: [['@merman', 1], ['@crab', 1]], bg: 'watercave', seed: 'pv2-gold', golden: 1, rare: false, surprise: 'pre' },
        FOCUS('hero', 'skill', 't_sword_crest'), `PV.teach('hero', ['t_sword_crest']); PV2.rareDrop(); PV2.noGlim(); PV2.autoWin(300); PV.boost(1); PV.kill = true; PV2.sureHit()`));
      await INTRO(T);
    },
    n: sec(19),
  },
  // 図鑑: 通常・レア・超レアの枠（見た魔物と手に入れた落とし物を入れてから開く。森の魔物は入れない）
  s5_bestiary: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${STATE({ map: { id: 'kasim', spawn: 'warp' } })}); PV.enter('kasim', 'warp')`);
      await T.idle(120); await T.settle();
      await T.js(`(() => { const G = RPG.Game; G.book = G.book || {}; G.book.mon = {}; const LN = RPG.DB.lineages; let k = 0;
        for (const ln of ['scorpion', 'snake', 'mummy', 'cactus', 'sandworm', 'wolf', 'yeti', 'frostling', 'owl', 'mammoth', 'ghost', 'wisp', 'frog'])
          for (const st of ((LN[ln] || {}).stages || [])) { k++; if (k % 7 === 5) continue;
            G.book.mon[st.mon] = {seen: true, kills: 2 + (k * 7) % 23, normal: true, rare: k % 3 !== 0, super: k % 3 === 1}; }
        return RPG.Screens.open('bestiary'); })()`);
      await T.idle(40);
    },
    n: sec(6),
    each: (i) => (i >= 50 && i < 340 && (i - 50) % 36 === 0 ? `PV.tap('down', 3)` : null),
  },
  // 装備: 9 つの枠 →「いちばん強く」（X → 確かめ → 決定）
  s5_equip: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${STATE({ map: { id: 'kasim', spawn: 'warp' } })}); PV.enter('kasim', 'warp')`);
      await T.idle(120); await T.settle();
      await T.js(`(() => { const I = RPG.DB.items, G = RPG.Game; const pick = (re, n) => Object.keys(I).filter((k) => re.test(k) && !/_sr_|_r_|super|rare/.test(k)).slice(0, n);
        for (const k of [].concat(pick(/^w_sword_/, 6), pick(/^sh_/, 3), pick(/^hd_/, 4), pick(/^bd_/, 4), pick(/^ar_|^gl_|^hn_/, 3), pick(/^ft_|^bt_/, 3), pick(/^ac_/, 4))) G.items[k] = (G.items[k] || 0) + 1;
        return RPG.Screens.open('equip', {id: 'hero'}); })()`);
      await T.idle(40);
    },
    n: sec(8),
    each: at({ 60: `PV.tap('down', 3)`, 90: `PV.tap('down', 3)`, 120: `PV.tap('up', 3)`, 150: `PV.tap('up', 3)`, 200: `PV.tap('x', 3)`, 250: `PV.tap('a', 3)` }),
  },
  // リピートと速さ: 雑魚戦を 3 つ続けて（諸島の出現表 zw_isles のカニ・海鳥・魚人、背景 isles。間のフィールドは i_cape。ゼリーは絵が無いので出さない）。L でリピート、R で速さ（＋1 → ＋2）
  s5_speed: {
    prep: async (T) => {
      await T.js(BATTLE({}, 'i_cape', 'west', { zone: 'zw_isles', mons: [['@crab', 2], ['@seabird', 2]], bg: 'isles', seed: 'pv2-speed', golden: false, rare: false },
        `(st, u, r) => ({cmd: 'attack', id: 'attack'})`, `RPG.Settings.set('battleSpeed', 1); PV2.noGlim(); PV2.autoWin(40); PV.boost(1); PV.kill = true; PV2.sureHit(); RPG.Battle.repeatMemory().on = false`));
      await INTRO(T);
    },
    n: sec(26),
    each: (i) => (i === 90 ? `PV.tap('l', 3)` : i === 150 ? `PV.tap('r', 3)` : i === 200 ? `PV.tap('r', 3)` : `(() => { const n = PV2.next || 0; if (n < 2 && RPG.Battle.lastEnd && RPG.Battle.lastEnd.closed && !RPG.Battle.active() && RPG.Engine.fade.a < 0.01) { PV2.next = n + 1; RPG.Battle.start({zone: 'zw_isles', mons: n ? [['@merman', 2], ['@seabird', 1]] : [['@seabird', 3]], bg: 'isles', seed: 'pv2-speed' + n, golden: false, rare: false}); } })()`),
  },

  // 敵の合体技: サラマンダーとインプの「炎の竜巻」（灰の荒野の出現表 zw_ash_plain、背景 ash）→ 一行は守ってしのぐ
  s5_ecombo: {
    prep: async (T) => {
      await T.js(BATTLE({}, 'a_foot', 'north', { zone: 'zw_ash_plain', mons: [['@salamander', 1], ['@imp', 1]], bg: 'ash', seed: 'pv2-ecombo', golden: false, rare: false, surprise: 'ambush' },
        DEF, `PV2.noGlim(); PV2.comboOn('c_fire_tornado'); RPG.Party.restoreAll()`));
      await INTRO(T);
    },
    n: sec(12),
  },

  // ---------------------------------------------------------------- §8 戦い（1 カット 1 ボス・背景もちがう）
  // ロウェルと向き合う: ティア 2 の場面（story_t2）。「口で言っても分からないなら、力ずくで止める。」（v_rowell_t2_03）→ 戦いの始まり
  s8_rowell: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${STATE({ tier: 2, map: { id: 'loch', spawn: 'plaza' }, flags: { prologue_done: true, forest_start: true, cleared_r_forest: true, story_t1: true, forest_fine: true, cleared_r_marsh: true } })}); PV.enter('loch', 'plaza')`);
      await T.idle(120); await T.settle();
      await T.js(`PV.scriptBattle(${DEF}); PV.autoMsg(40); RPG.Events.run('story_t2', {map: 'loch', reason: 'leave'})`);
      await T.until(`PV.lastLine().includes('この町へ来た')`, 4000);   // 地の文（narr_2）が出たら撮り始める（次の「力ずく」の声を撮りの中で鳴らす）
    },
    n: sec(12),
    each: at({ 1: `PV.autoMsg(60)` }),
  },
  // 白竜ネーヴェ（背景はゲームのまま peak）: シグレの一の太刀（b_shigure_bigtech_2）
  s8_white: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 4 }, 'kasim', 'warp', { troop: 'tr_b_whitedragon', boss: true, seed: 'pv2-white', surprise: 'pre' }, FOCUS('shigure', 'skill', 't_sword_first'),
        `PV.teach('shigure', ['t_sword_first']); RPG.Party.restoreAll(); PV2.noGlim(); PV2.voice({b_shigure_bigtech_: 'b_shigure_bigtech_2'})`));
      await INTRO(T);
    },
    n: sec(13),
  },
  // 亡霊船長グレン（背景はゲームのまま ship）: ザフィラの闇夜の刃（b_zafira_bigtech_1。荒波の連撃は合成術のカットの大波と似るので月の技に）
  s8_captain: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 4 }, 'kasim', 'warp', { troop: 'tr_b_captain', boss: true, seed: 'pv2-capt', surprise: 'pre' }, FOCUS('zafira', 'skill', 't_dagger_nightfall'),
        `PV.teach('zafira', ['t_dagger_nightfall']); RPG.Party.restoreAll(); PV2.noGlim(); PV2.voice({b_zafira_bigtech_: 'b_zafira_bigtech_1'})`));
      await INTRO(T);
    },
    n: sec(13),
  },
  // 霧食らい（背景はゲームのまま swamp）: 分身が 2 体並んだ形で始める（霧食らいの編成に、霧食らいが呼ぶ魔女の分身 b_mist_double を足した撮り用の写し pv2_mist）→ 先手で仲間が分身を割り、ノエラの裁きの光柱（光の術。b_noela_bigtech_1）
  s8_mist: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 4, party: ['hero', 'noela', 'shigure', 'zafira'] }, 'kasim', 'warp', { troop: 'pv2_mist', boss: true, seed: 'pv2-mist', surprise: 'pre' },
        `(st, u, r) => { const d = st.aliveEnemies().find((a) => a.id !== 'b_mistbeast'); if (!d) return {cmd: 'attack', id: 'attack'}; return u.id === 'noela' ? {cmd: 'spell', id: 's_wind_earth_light'} : {cmd: 'attack', id: 'attack', target: d.uid}; }`,
        `PV.teach('noela', null, ['s_wind_earth_light']); RPG.Party.restoreAll(); PV2.noGlim(); PV2.voice({b_noela_spell_: 'b_noela_bigtech_1', b_noela_bigtech_: 'b_noela_bigtech_1'}); RPG.DB.troops.pv2_mist = Object.assign({}, RPG.DB.troops.tr_b_mistbeast, {mons: [['b_mistbeast', 1], ['b_mist_double', 1], ['b_mist_double', 1]]}); RPG.Tester.enabled = true; RPG.Tester.hitFix = (t, r) => r; RPG.Tester.dmgFix = (t, d) => (t && t.id === 'b_mist_double' ? Math.max(d, t.hp || 1) : d)`));
      await INTRO(T);
    },
    n: sec(20),
  },
  // 鉄の番人（背景 mine）: ドッカの天崩し（b_dokka_bigtech_2）。大技は外さない（hitFix で敵への空振りを消す）
  s8_iron: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 5, party: ['hero', 'dokka', 'shigure', 'zafira'] }, 'kasim', 'warp', { troop: 'tr_b_ironwarden', boss: true, seed: 'pv2-iron', surprise: 'pre' }, FOCUS('dokka', 'skill', 't_greatsword_skyfall'),
        `PV.teach('dokka', ['t_greatsword_skyfall']); RPG.Party.restoreAll(); PV2.noGlim(); PV2.voice({b_dokka_bigtech_: 'b_dokka_bigtech_2'}); PV.boost(1); RPG.Tester.hitFix = (t, r) => { if (t && !t.isParty) r.miss = false; return r; }`));
      await INTRO(T);
    },
    n: sec(13),
  },
  // 溶岩の巨獣（背景はゲームのまま volcano）: ロウガの神鳴り打ち（b_rouga_bigtech_2）
  s8_lava: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 5 }, 'kasim', 'warp', { troop: 'tr_b_lavabeast', boss: true, seed: 'pv2-lava', surprise: 'pre' }, FOCUS('rouga', 'skill', 't_greatsword_thunder'),
        `PV.teach('rouga', ['t_greatsword_thunder']); RPG.Party.restoreAll(); PV2.noGlim(); PV2.voice({b_rouga_bigtech_: 'b_rouga_bigtech_2'})`));
      await INTRO(T);
    },
    n: sec(13),
  },
  // 星食らい（背景はゲームのまま tower）: イルゼの合成術 百雷（火×水×風。b_ilse_bigtech_1）
  s8_star: {
    prep: async (T) => {
      await T.js(BATTLE({ tier: 5, party: ['hero', 'ilse', 'shigure', 'rouga'] }, 'kasim', 'warp', { troop: 'tr_b_stareater', boss: true, seed: 'pv2-star', surprise: 'pre' }, FOCUS('ilse', 'spell', 's_fire_water_wind'),
        `PV.teach('ilse', null, ['s_fire_water_wind']); RPG.Party.restoreAll(); PV2.noGlim(); PV2.voice({b_ilse_spell_: 'b_ilse_bigtech_1', b_ilse_bigtech_: 'b_ilse_bigtech_1'})`));
      await INTRO(T);
    },
    n: sec(13),
  },
  // 最後の影: 書庫の 6 階から闇に閉じる → 黒い影（名前の札・敵の名・HUD を描かない。絵は黒い影）→ 白い闇が集まる
  s8_shadow: {
    prep: async (T) => {
      await T.js(`PV.clean(); PV.noEnc(); PV.state(${STATE({ tier: 8, map: { id: 'archive_6', spawn: 'from5' } })}); PV.enter('archive_6', 'from5')`);
      await T.idle(150); await T.settle();
      await T.js(`PV2.shadow(); PV2.noGlim(); PV2.firstAct('b_nemrea1', 'eb_nemrea_gather', [2, 0]); PV.scriptBattle(${DEF}); RPG.Party.restoreAll()`);
    },
    n: sec(16),
    each: at({ 30: `RPG.Battle.start({troop: 'tr_b_nemrea1', boss: true, noEscape: true, seed: 'pv2-shadow'})` }),
  },
};

// ---------------------------------------------------------------- 撮る
async function setupPage(S, sh) {
  const P = await C.open(S, sh.url || 'dev.html?fixture=content_d_kasim');
  await C.run(P, PVLIB);
  await C.run(P, PV2LIB);
  // 描いた顔絵を先に読み終える（勝利の札の仲間の顔。ページの時計は進めない）
  await P.page.evaluate("RPG.Media && RPG.Media.preload ? RPG.Media.preload('portraits') : 0");
  await C.run(P, 'PV2.fxLoad()');
  const nf = await C.until(P, 'PV2.fxOk', 1800);
  if (nf < 0) console.log('[pv] fx parts not all loaded');
  const T = {
    js: (code) => C.run(P, code),
    idle: (n, each) => C.idle(P, n, each),
    until: (cond, max) => C.until(P, cond, max),
    settle: async () => { await C.run(P, 'PV.autoMsg(15)'); await C.until(P, '!RPG.Events.busy() && !RPG.UIK.Message.busy()', 1800); await C.run(P, 'PV.autoMsg(0)'); await C.idle(P, 20); },
    P,
  };
  return { P, T };
}
async function shoot(S, id, out) {
  const sh = SHOTS[id];
  const { P, T } = await setupPage(S, sh);
  await sh.prep(T);
  const file = path.join(out, id + '.mp4');
  await C.rec(P, file, sh.n, sh.each || null);
  if (P.errors.length) console.log(`[pv] ${id} errors:`, P.errors.slice(0, 4));
  await P.close();
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
module.exports = { SHOTS, setupPage, PV2LIB };
