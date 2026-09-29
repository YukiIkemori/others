// 英語の文の表（maps_prologue）。key は日本語の表（src/i18n/ja/maps_prologue.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/prologue_lighthouse.js
    'map.prologue_lighthouse.lighthouse_1.name': 'Pharos Lighthouse',
    'map.prologue_lighthouse.lighthouse_2.name': 'Pharos Lighthouse',
    'map.prologue_lighthouse.lighthouse_3.name': 'Pharos Lighthouse',
    // ---- src/maps/prologue_roa.js
    'map.prologue_roa.roa.name': 'Roa',
    'map.prologue_roa.roa_house.name': 'Berna\'s House',
  });
})(window.RPG);
