// 英語の文の表（maps_desert）。key は日本語の表（src/i18n/ja/maps_desert.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/desert_camps.js
    'map.desert_camps.desert_camp1.name': 'Rock Well Camp',
    'map.desert_camps.desert_camp2.name': 'Star Stone Camp',
    'map.desert_camps.desert_camp3.name': 'Tomb Oasis',
    // ---- src/maps/desert_hawks.js
    'map.desert_hawks.desert_hawks_1.name': 'Sand Hawks\' Hideout',
    'map.desert_hawks.desert_hawks_2.name': 'Sand Hawks\' Hideout',
    // ---- src/maps/desert_kasim.js
    'map.desert_kasim.kasim.name': 'Kasim',
    // ---- src/maps/desert_optional.js
    'map.desert_optional.desert_mirage.name': 'Mirage Market',
    'map.desert_optional.desert_rocks.name': 'Diamond Lizard Rocks',
    'map.desert_optional.desert_oldcamp.name': 'Old Campsite',
    'map.desert_optional.desert_wellroom.name': 'Old Well Hut',
    // ---- src/maps/desert_sandedge.js
    'map.desert_sandedge.sandedge.name': 'Sandedge',
    'map.desert_sandedge.sandedge_inn.name': 'Sandedge Inn',
    // ---- src/maps/desert_temple.js
    'map.desert_temple.desert_temple_1.name': 'Sunken Temple',
    'map.desert_temple.desert_temple_2.name': 'Sunken Temple',
    // ---- src/maps/desert_tomb.js
    'map.desert_tomb.desert_tomb_1.name': 'Sand King\'s Tomb',
    'map.desert_tomb.desert_tomb_2.name': 'Sand King\'s Tomb',
    'map.desert_tomb.desert_tomb_3.name': 'Sand King\'s Tomb',
  });
})(window.RPG);
