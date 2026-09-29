// 英語の文の表（maps_snow）。key は日本語の表（src/i18n/ja/maps_snow.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/snow_optional.js
    'map.snow_optional.icicle_1.name': 'Icicle Corridor',
    'map.snow_optional.icicle_2.name': 'Icicle Corridor',
    'map.snow_optional.pass_inn.name': 'Pass Inn',
    'map.snow_optional.pass_inn_in.name': 'Pass Inn',
    'map.snow_optional.pass_inn_shop.name': 'Pass Inn Shop',
    'map.snow_optional.aurora.name': 'Aurora Cliffs',
    'map.snow_optional.frost_ship_1.name': 'Icebound Galleon',
    'map.snow_optional.frost_ship_2.name': 'Icebound Galleon',
    // ---- src/maps/snow_peak.js
    'map.snow_peak.peak_1.name': 'White Dragon Peak',
    'map.snow_peak.peak_top.name': 'White Dragon Peak',
    // ---- src/maps/snow_yule.js
    'map.snow_yule.yule.name': 'Yule',
    'map.snow_yule.yule_night.name': 'Yule',
  });
})(window.RPG);
