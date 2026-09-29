// 英語の文の表（shops）。key は日本語の表（src/i18n/ja/shops.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/data/shops.js
    'shops.shop_pharos_items.name': 'Pharos Item Shop',
    'shops.shop_pharos_arms.name': 'Pharos Armory',
    'shops.shop_fern_items.name': 'Fern Item Shop',
    'shops.shop_fern_peddler.name': 'Square Peddler',
    'shops.shop_yura.name': 'Yura Shop',
    // ---- src/data/shops_ash.js
    'shops.shop_caldera_items.name': 'Shell Item Shop',
    'shops.shop_caldera_arms.name': 'Shell Armory',
    'shops.shop_arena.name': 'Arena Counter',
    'shops.shop_haimi.name': 'Ashview Inn Counter',
    // ---- src/data/shops_desert.js
    'shops.shop_kasim_items.name': 'Kasim Item Shop',
    'shops.shop_kasim_arms.name': 'Market Arms Stall',
    'shops.shop_kasim_bazaar.name': 'Market Stall',
    'shops.shop_sandedge.name': 'Sandedge Counter',
    'shops.shop_lotta.name': 'Lotta\'s Pack Basket',
    'shops.shop_hawks.name': 'Hawks\' Black Market',
    // ---- src/data/shops_marsh.js
    'shops.shop_loch_items.name': 'Great Bell Item Shop',
    'shops.shop_loch_arms.name': 'Great Bell Armory',
    'shops.shop_loch_night.name': 'Night Market Stall',
    // ---- src/data/shops_snow.js
    'shops.shop_yule_items.name': 'Yule Item Shop',
    'shops.shop_yule_arms.name': 'Yule Armory',
    'shops.shop_yule_arms_low.name': 'Yule Armory (Looted Storeroom)',
    'shops.shop_yule_fur.name': 'Fur Peddler',
    'shops.shop_pass_inn.name': 'Pass Inn Shop',
  });
})(window.RPG);
