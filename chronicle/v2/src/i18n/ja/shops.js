// 日本語の文の表（shops）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/shops.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/data/shops.js
    'shops.shop_pharos_items.name': 'ファロスの道具屋',
    'shops.shop_pharos_arms.name': 'ファロスの武具屋',
    'shops.shop_fern_items.name': 'フェルンの道具屋',
    'shops.shop_fern_peddler.name': '広場の行商',
    'shops.shop_yura.name': 'ユラの店',
    // ---- src/data/shops_ash.js
    'shops.shop_caldera_items.name': '殻の道具屋',
    'shops.shop_caldera_arms.name': '殻の武具屋',
    'shops.shop_arena.name': '闘技場の売り台',
    'shops.shop_haimi.name': '灰見の宿の売り台',
    // ---- src/data/shops_desert.js
    'shops.shop_kasim_items.name': 'カシムの道具屋',
    'shops.shop_kasim_arms.name': '市場の武具の屋台',
    'shops.shop_kasim_bazaar.name': '市場の屋台',
    'shops.shop_sandedge.name': '砂の縁の売り台',
    'shops.shop_lotta.name': 'ロッタの背負い籠',
    'shops.shop_hawks.name': '鷹団の闇市',
    // ---- src/data/shops_marsh.js
    'shops.shop_loch_items.name': '大鐘の道具屋',
    'shops.shop_loch_arms.name': '大鐘の武具屋',
    'shops.shop_loch_night.name': '夜市の屋台',
    // ---- src/data/shops_snow.js
    'shops.shop_yule_items.name': 'ユールの道具屋',
    'shops.shop_yule_arms.name': 'ユールの武具屋',
    'shops.shop_yule_arms_low.name': 'ユールの武具屋（荒らされた倉）',
    'shops.shop_yule_fur.name': '毛皮の行商',
    'shops.shop_pass_inn.name': '峠の宿の売店',
    // ---- src/data/shops_isles.js
    'shops.shop_coral_items.name': 'コーラルの道具屋',
    'shops.shop_coral_arms.name': 'コーラルの武具屋',
    'shops.shop_coral_guild.name': '船乗り組合の売り台',
    'shops.shop_nerei.name': 'ネレイの雑貨屋',
  });
})(window.RPG);
