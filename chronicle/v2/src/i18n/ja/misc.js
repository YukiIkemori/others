// 日本語の文の表（misc）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/misc.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/data/config.js
    'data.config.defaultHero.name': 'アルン',
    'data.config.chronicle.prologue.title': '灯台守の歌',
    'data.config.chronicle.prologue.summary': '港町ファロスの灯台は、\n守り歌が忘れられて\n火を失っていた。\n語り部の見習いが歌を\n取り戻し、灯はふたたび\n海を照らした。',
    // ---- src/data/demo_gate.js
    'data.demo_gate.TEXT': '体験版では、ここから先へは\n行けません。',
  });
})(window.RPG);
