// Region 7 灰の荒野 (r_ash) — shared helpers for the region's maps and events (R7 reg7, DESIGN §10.8.8).
// Loaded before region7_caldera.js / region7_volcano.js ('0' sorts before letters).
//
// Maps are written as plain terrain rows + a decor layer; every object (NPCs, signs, chests, spawns,
// events, warps) is listed explicitly with x,y, so no mark chars are needed and chest ids never depend
// on row order (§3.1.4).
//
//   const K = R.Reg7;
//   K.npc(id, sprite, x, y, o)          NPC ('npc:' prefix added unless the key has ':')
//   K.talk(id, sprite, x, y, text, o)   NPC with text (string, pages[] or [{cond,text}] §3.2.4)
//   K.sign(x, y, text, cond)            sign (examine)
//   K.chest(id, x, y, pool, o)          tier chest {id, x, y, pool} (§8.12.1: no fixed items)
//   K.step(id, x, y, o) / K.exam(id, x, y, o)   map events
//   K.band(id, x0, y0, x1, y1, o)       the same step event on every cell of a rectangle
//   K.warp(x, y, to, spawn, o)
//   K.C                                  the conditions the region's text uses (§3.2.3, §10.9)
//   K.MAPS                               the region's map ids (tools)
(function (R) {
  'use strict';
  const K = (R.Reg7 = R.Reg7 || {});

  K.npc = function (id, sprite, x, y, o) {
    const s = String(sprite || 'man');
    return Object.assign({ id, sprite: s.includes(':') ? s : 'npc:' + s, x, y, dir: 'down' }, o || {});
  };
  K.talk = function (id, sprite, x, y, text, o) { return K.npc(id, sprite, x, y, Object.assign({ text }, o || {})); };
  K.sign = function (x, y, text, cond) { const s = { x, y, text }; if (cond != null) s.cond = cond; return s; };
  K.chest = function (id, x, y, pool, o) { return Object.assign({ id, x, y, pool: pool || 'p_supply' }, o || {}); };
  K.step = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'step' }, o || {}); };
  K.exam = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'examine' }, o || {}); };
  K.band = function (id, x0, y0, x1, y1, o) {
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(K.step(id, x, y, o));
    return out;
  };
  K.warp = function (x, y, to, spawn, o) { return Object.assign({ x, y, to, spawn }, o || {}); };

  // text / object conditions (§3.2.3)
  K.C = {
    clear: { cleared: 'r_ash' },          // the region's chapter is written (after the lava beast)
    before: { notCleared: 'r_ash' },
    post: { postgame: true },              // after the ending
    fog: 'final_open',                     // the inner-sea fog is gone (T8 scene)
    t1: { tier: 1 }, t4: { tier: 4 }, t6: { tier: 6 }, t7: { tier: 7 },
    scribe: [{ tier: 4 }, { tierBelow: 7 }], // 白衣の書記 (§10.9.5)
    mid: 'ash_mid',
    murals3: { var: 'ash_murals', gte: 3 },
  };

  /** check that every row (and decor row) of a def has the same width; warns once per map */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('reg7 map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('reg7 map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('reg7 map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  /** the region's maps (for tools and tests) */
  K.MAPS = ['caldera', 'ash_volcano_1', 'ash_volcano_2', 'ash_volcano_3'];
})(window.RPG);
