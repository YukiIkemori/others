// Decor dispatcher: art modules register context-aware builders per decor id
//   R.Art.decorAuto[id] = (map, x, y) => canvas | canvas[] | null
// (rugs, long tables, stalls, fountains and hedges join with neighbours).
// Anything without a builder uses the plain 'decor:<id>' graphic.
(function (R) {
  'use strict';
  R.Art = R.Art || {};
  R.Art.decorAuto = R.Art.decorAuto || {};
  R.Art.decorTile = function (map, x, y) {
    const id = map.decorAt(x, y);
    if (!id) return null;
    const f = R.Art.decorAuto[id];
    return f ? f(map, x, y) : null;
  };
})(window.RPG);
