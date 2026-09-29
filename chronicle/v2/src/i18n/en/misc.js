// 英語の文の表（misc）。key は日本語の表（src/i18n/ja/misc.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/data/config.js
    'data.config.defaultHero.name': 'Arun',
    // ---- src/data/demo_gate.js
    'data.demo_gate.TEXT': 'In the demo, you can\'t go\nany further from here.',
  });
})(window.RPG);
