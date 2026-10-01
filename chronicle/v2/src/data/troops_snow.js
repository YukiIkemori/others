// 雪原の編成（BATTLE の形。WORLD_REDESIGN §4.3・§4.10・§3.5-1: 地方の話の中の戦いはすべて scale:'tier'）。
//   籠城の 3 波（どの門を守るかで同じ組。猟師が加勢すると最初の 1 戦が 1 匹少ない _e）と、吹雪の大狼（守らなかった門の数で援軍 0〜2）。
//   峰の氷壁の巨人は氷壁（ice）、白竜ネーヴェは峰の頂（peak）の背景に。隠しボス 氷の船団長は強さ固定（ティア 6 相当）。
(function (R) {
  'use strict';
  const T = R.DB.troops;
  const boss = (mons, o) => Object.assign({ mons, noEscape: true }, o);
  const wave = (mons, o) => Object.assign({ mons, noEscape: true, scale: 'tier', lvOff: 1, bg: 'snow', bgm: 'siege' }, o || {});
  Object.assign(T, {
    tr_siege_1a: wave([['@wolf', 3]]), tr_siege_1a_e: wave([['@wolf', 2]]),
    tr_siege_1b: wave([['@wolf', 2], ['@frostling', 2]]),
    tr_siege_2a: wave([['@frostling', 2], ['@wolf', 2]]), tr_siege_2a_e: wave([['@frostling', 1], ['@wolf', 2]]),
    tr_siege_2b: wave([['@yeti', 1], ['@wolf', 2]]),
    tr_siege_3a: wave([['@owl', 2], ['@wolf', 2]]), tr_siege_3a_e: wave([['@owl', 1], ['@wolf', 2]]),
    tr_b_blizzardwolf_0: boss([['b_siegewolf', 1], ['b_blizzardwolf', 1]], { scale: 'tier', lvOff: 2, bg: 'snow', bgm: 'boss' }),
    tr_b_blizzardwolf_1: boss([['b_siegewolf', 1], ['b_blizzardwolf_1', 1]], { scale: 'tier', lvOff: 2, bg: 'snow', bgm: 'boss' }),
    tr_b_blizzardwolf_2: boss([['b_siegewolf', 1], ['b_blizzardwolf_2', 1]], { scale: 'tier', lvOff: 2, bg: 'snow', bgm: 'boss' }),
    // 雪の林の倒木を守る雪男（薪集めの 1 本）
    tr_snow_woods_yeti: wave([['@yeti', 1], ['@wolf', 1]], { bgm: 'battle' }),
    // つららの回廊のつらら番（#11、暗がりの奥の中ボス）
    tr_icicle_guard: wave([['@frostling', 1], ['@yeti', 1], ['@frostling', 1]], { lvOff: 2, bgm: 'boss' }),
    // 隠しボス（#13）。手前の看板と噂で「危険」と知らせる
    tr_b_frost_admiral: boss([['b_frost_sailor', 1], ['b_frost_admiral', 1], ['b_frost_sailor', 1]], { tier: 6, lvOff: 3, bg: 'snow', bgm: 'boss2' }),
  });
  if (T.tr_b_icegiant) T.tr_b_icegiant.bg = 'ice';   // 巨人の氷壁の前（描いた絵 bbg/ice）
  if (T.tr_b_whitedragon) T.tr_b_whitedragon.bg = 'peak';   // 峰の頂（描いた絵 bbg/peak）
  // ティア 1（2 つ目の地方）だけ HP を 3% 軽く（2026-09-30: 台本が 13.1 ラウンドで地方ボスの幅 8〜13 を越えた。ティア 0・3 はそのまま。battle_core の troop.hpAt）
  if (T.tr_b_whitedragon) T.tr_b_whitedragon.hpAt = { 1: 0.97 };
})(window.RPG);
