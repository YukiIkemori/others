// In-game boss check (art-boss A15a): node tools/build.js --with tools/fixtures/art-boss → debug_art-boss.html
//   node tools/shot.js --html debug_art-boss.html --eval "RPG.artBoss.show('tr_b_ouroboros')" --wait 4000 --out x.png
// show(troop, o) starts a quick game (o.tier, default: the troop's tier) and opens that boss battle without
// waiting for it to end (the eval returns at once). list() gives the 26 boss troop ids.
(function (R) {
  'use strict';
  const TIER = { tr_b_pageeater: 0, tr_b_rowell1: 2, tr_b_rowell2: 5, tr_b_valzard_echo: 9, tr_b_ouroboros: 9 };
  R.artBoss = {
    list: () => Object.keys((R.DB && R.DB.troops) || {}).filter((k) => k.startsWith('tr_b_')),
    show(troop, o) {
      o = o || {};
      const t = o.tier != null ? o.tier : troop in TIER ? TIER[troop] : /nemrea|lazaro|shades|bookgolem/.test(troop) ? 8 : 3;
      return Promise.resolve(R.debug.quickStart({ tier: t, level: o.level || 10 + t * 6, postgame: t === 9 })).then(() => { R.debug.battle(troop); return troop; });
    },
  };
})(window.RPG);
