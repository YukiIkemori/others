// 英語の文の表（misc）。key は日本語の表（src/i18n/ja/misc.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/data/config.js
    'data.config.defaultHero.name': 'Arun',
    'data.config.chronicle.prologue.title': 'The Lighthouse Keeper\'s Song',
    'data.config.chronicle.prologue.summary': 'The lighthouse of Port\nPharos had lost its fire,\nits keeper\'s song forgotten.\nAn apprentice storyteller\nbrought the song back, and\nthe light shone over the\nsea once more.',
    // ---- src/data/demo_gate.js
    'data.demo_gate.TEXT': 'In the demo, you can\'t go\nany further from here.',
  });
})(window.RPG);
