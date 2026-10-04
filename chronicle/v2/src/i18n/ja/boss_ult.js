// 日本語の文の表（boss_ult）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/boss_ult.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- ?
    'battle.ult.head': '必殺技',
  });
})(window.RPG);
