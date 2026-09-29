// 英語の文の表（maps_ash）。key は日本語の表（src/i18n/ja/maps_ash.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/ash_arena.js
    'map.ash_arena.caldera_arena.name': 'Caldera Arena',
    // ---- src/maps/ash_caldera.js
    'map.ash_caldera.caldera.name': 'Caldera',
    // ---- src/maps/ash_caldera_interiors.js
    'map.ash_caldera_interiors.haimi_inn.name': 'Ashview Inn',
    // ---- src/maps/ash_volcano.js
    'map.ash_volcano.ash_volcano_1.name': 'Ash Volcano',
    'map.ash_volcano.ash_volcano_2.name': 'Ash Volcano',
  });
})(window.RPG);
