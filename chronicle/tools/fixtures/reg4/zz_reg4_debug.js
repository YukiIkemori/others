// R4 (reg4) browser fixture: loaded only by debug_reg4.html (node tools/build.js --with tools/fixtures/reg4).
// Adds nothing to the game data; exposes a helper to screenshot region-4 scenes.
(function (R) {
  'use strict';
  R.reg4 = {
    /** jump to a map spot with flags set (e.g. {flags:['marsh_start'], tier:1}) */
    async at(map, spawn, o) {
      o = o || {};
      await R.debug.quickStart({ map: 'loch', spawn: 'inn', noEncounter: true, tier: o.tier || 0 });
      for (const f of o.flags || []) R.debug.flag(f, true);
      if (o.vars) for (const k in o.vars) R.State.setVar(k, o.vars[k]);
      if (o.items) for (const k of o.items) R.debug.give(k, 1);
      await R.debug.warp(map, spawn);
      return R.debug.pos();
    },
  };
})(window.RPG);
