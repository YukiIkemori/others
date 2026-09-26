// v2 の新しい効果音・ジングルの id（CORE、V2_PLAN §3.10）。P0 では今の音への付け替え。
// P1 で CORE が専用の音を作ったら、ここの付け替えを本物の定義に差し替える（id は変えない）。
//   効果音: spring（泉）・lead（手がかり帳に書いた）・lamp（灯籠がともる）・telegraph（ボスの予告）・bridge（つり橋）
//   ジングル: grow（HP/MP の伸び。今の levelup を使う、A30）
(function (R) {
  'use strict';
  const ALIAS_SFX = { spring: 'heal', lead: 'quill', lamp: 'light', telegraph: 'status', bridge: 'step_damage' };
  const ALIAS_MUSIC = { grow: 'levelup' };
  R.onData(function () {
    for (const id of Object.keys(ALIAS_SFX)) {
      if (R.DB.sfx[id]) continue;
      const to = ALIAS_SFX[id];
      R.DB.sfx[id] = function (S) { const f = R.DB.sfx[to] || R.DB.sfx.confirm; if (f) f(S); };
    }
    for (const id of Object.keys(ALIAS_MUSIC)) {
      if (!R.DB.music[id] && R.DB.music[ALIAS_MUSIC[id]]) R.DB.music[id] = R.DB.music[ALIAS_MUSIC[id]];
    }
  });
})(window.RPG);
