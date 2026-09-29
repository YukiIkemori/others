// 英語の文の表（maps_field）。key は日本語の表（src/i18n/ja/maps_field.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/field_cape.js
    'map.field_cape.f_cape.name': 'Lighthouse Cape',
    // ---- src/maps/field_cross.js
    'map.field_cross.f_cross.name': 'Northern Fields',
    // ---- src/maps/field_fern.js
    'map.field_fern.f_fern.name': 'Forest Road',
    // ---- src/maps/field_hut.js
    'map.field_hut.f_hut.name': 'Woodcutters\' Field',
    // ---- src/maps/field_lookout.js
    'map.field_lookout.f_lookout.name': 'Lookout',
    // ---- src/maps/field_roa.js
    'map.field_roa.f_roa.name': 'Roa Hills',
    // ---- src/maps/field_south.js
    'map.field_south.f_south.name': 'South of the Forest',
    // ---- src/maps/field_windhill.js
    'map.field_windhill.f_windhill.name': 'Windsong Hill',
    // ---- src/maps/homes_slice.js
    'map.homes_slice.roa_home1.name': 'Village House',
    'map.homes_slice.roa_home2.name': 'Woodcutter\'s House',
    'map.homes_slice.roa_home3.name': 'Village House',
    'map.homes_slice.roa_home4.name': 'Village House',
    'map.homes_slice.roa_home5.name': 'Field Watch Hut',
    'map.homes_slice.roa_home6.name': 'House by the Pond',
    'map.homes_slice.roa_hall_in.name': 'Hall of the Telling Stone',
    'map.homes_slice.pharos_home1.name': 'Harbor House',
    'map.homes_slice.pharos_home2.name': 'Harbor House',
    'map.homes_slice.pharos_home3.name': 'Sailor\'s House',
    'map.homes_slice.pharos_home4.name': 'Harbor House',
    'map.homes_slice.pharos_home5.name': 'Harbor House',
    'map.homes_slice.pharos_home6.name': 'Harbor House',
    'map.homes_slice.fern_home1.name': 'Village House',
    'map.homes_slice.fern_home2.name': 'Village House',
    'map.homes_slice.fern_home3.name': 'Village House',
    'map.homes_slice.fern_shed.name': 'Storage Shed',
    'map.homes_slice.yura_home_elder.name': 'Elder\'s House',
    'map.homes_slice.yura_home1.name': 'House in Yura',
    'map.homes_slice.yura_home2.name': 'House in Yura',
    'map.homes_slice.yura_home3.name': 'House in Yura',
    'map.homes_slice.yura_home4.name': 'House in Yura',
    // ---- src/maps/optional_hut.js
    'map.optional_hut.hut.name': 'Woodcutters\' Hut',
    // ---- src/maps/optional_well.js
    'map.optional_well.well.name': 'Old Travelers\' Well',
  });
})(window.RPG);
