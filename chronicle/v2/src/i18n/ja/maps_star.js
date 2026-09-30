// 日本語の文の表（maps_star）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/maps_star.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/maps/field_star_steps.js
    'map.field_star_steps.s_steps.name': '星見の坂',
    'map.field_star_steps.s_steps.objects.0.text': '星見の坂\n東へ上る → 列柱の高原・学術都市オルビス',
    'map.field_star_steps.s_steps.meta.sub': '高原へ上る古い石段の道',
    // ---- src/maps/field_star_plateau.js
    'map.field_star_plateau.s_plateau.name': '列柱の高原',
    'map.field_star_plateau.s_plateau.objects.0.text': '列柱の高原\n北 → 学術都市オルビス\n東 → 星降りの窪地・星読みの尾根',
    'map.field_star_plateau.s_plateau.meta.sub': '学術都市オルビスの南の台地',
    // ---- src/maps/field_star_crater.js
    'map.field_star_crater.s_crater.name': '星降りの窪地',
    'map.field_star_crater.s_crater.objects.0.text': '星降りの窪地\n窪地の底へ下りる道',
    'map.field_star_crater.s_crater.meta.sub': '高原に落ちた星の跡',
    // ---- src/maps/field_star_ridge.js
    'map.field_star_ridge.s_ridge.name': '星読みの尾根',
    'map.field_star_ridge.s_ridge.objects.0.text': '星読みの尾根\n北 → 星読みの塔\n西 → 学術都市オルビス 東門',
    'map.field_star_ridge.s_ridge.meta.sub': '星読みの塔へ続く細い尾根',
  });
})(window.RPG);
