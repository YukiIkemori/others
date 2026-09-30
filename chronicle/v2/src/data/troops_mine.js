// ガルド山地の編成（BATTLE の形。WORLD_REDESIGN §2.7 #17）。岩食らい・鉄の番人は troops.js（前からある）。
//   隠しボス 鉱脈の主（深淵の鉱脈の底）は強さ固定（ティア 6 相当）。手前の看板とうわさで「危険」と知らせる。
(function (R) {
  'use strict';
  const T = R.DB.troops;
  const boss = (mons, o) => Object.assign({ mons, noEscape: true }, o);
  Object.assign(T, {
    tr_b_vein_lord: boss([['b_vein_shard', 1], ['b_vein_lord', 1], ['b_vein_shard', 1]], { tier: 6, lvOff: 3, bg: 'mine', bgm: 'boss2' }),
  });
})(window.RPG);
