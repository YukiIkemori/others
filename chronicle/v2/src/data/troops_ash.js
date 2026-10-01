// 灰の荒野の編成（BATTLE の形。WORLD_REDESIGN §4.7・§4.10・§3.5-1: 地方の話の中の戦いはすべて scale:'tier'）。
//   炎の試練の 5 回戦（tr_ash_r1〜r4・tr_b_zakuro）、炎の番犬・溶岩の巨獣（背景は火口の中 volcano）、記録院の写し手（八百長を受けたとき）。
(function (R) {
  'use strict';
  const T = R.DB.troops;
  const bout = (mons, o) => Object.assign({ mons, noEscape: true, scale: 'tier', lvOff: 1, bg: 'ash', bgm: 'battle' }, o || {});
  Object.assign(T, {
    tr_ash_r1: bout([['ash_youth', 4]]),
    tr_b_ash_r2: bout([['ash_pup', 1], ['b_rockbeast', 1], ['b_tamer', 1], ['ash_pup', 1]], { lvOff: 2 }),
    tr_b_ash_r3: bout([['b_sister_younger', 1], ['b_sister_elder', 1]], { lvOff: 2 }),
    tr_b_ash_r4: bout([['b_armorman', 1]], { lvOff: 2, bgm: 'boss' }),
    tr_b_zakuro: bout([['b_zakuro', 1]], { lvOff: 3, bgm: 'boss' }),
    tr_ash_copyists: bout([['ash_copyist', 3]], { lvOff: 1 }),
  });
  if (T.tr_b_hellhound) Object.assign(T.tr_b_hellhound, { bg: 'volcano' });   // 火山の中（描いた絵 bbg/volcano）
  if (T.tr_b_lavabeast) Object.assign(T.tr_b_lavabeast, { bg: 'volcano' });
})(window.RPG);
