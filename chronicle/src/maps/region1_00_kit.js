// Region 1 ヴェルダの森 (r_forest) — shared helpers for the region's maps and events.
// Owner: R1 (reg1). DESIGN §10.8.0 · §10.8.2 · §10.6. Loaded before region1_*.js ('0' sorts first).
//
// Maps are plain terrain rows + a decor layer; every object is listed explicitly with x,y
// (chest ids never depend on row order, §3.1.4).
//   const K = R.Reg1;
//   K.npc(id, sprite, x, y, o)          NPC ('npc:' prefix added unless the key has ':')
//   K.talk(id, sprite, x, y, text, o)   NPC with text (string, pages[] or [{cond,text}] §3.2.4)
//   K.sign(x, y, text, cond)            sign (examine)
//   K.chest(id, x, y, pool)             tier chest {id, x, y, pool} (§8.12.1: pools only)
//   K.step(id, x, y, o) / K.exam(id, x, y, o) / K.band(id, x0, y0, x1, y1, o)
//   K.warp(x, y, to, spawn, o)
//
// Public ids other areas rely on (DESIGN §10.13):
//   maps    fern · verda_maze_1 · verda_maze_2 · elder_tree_1 · elder_tree_2
//   spawns  fern: entrance · inn     dungeons: entrance (1F) · from_prev · from_next
//           verda_maze_2 from_next = back from 千年樹 (elder_tree_1 entrance warps there)
//   NPCs    fern: inn tavern shop_item shop_weapon shop_armor folk_a folk_b scribe
//                 st_rival st_fine st_extra hanna rita dan
//           elder_tree_2: fine · boss · rest · elm        verda_maze_2: boss · rest
//   flags   forest_start forest_dan forest_mid forest_fine forest_boss (+ cleared_r_forest)
//   var     forest_verses (0..3)
//   objectives obj_forest_1..3 (registered in src/events/region1_forest.js)
(function (R) {
  'use strict';
  const K = (R.Reg1 = R.Reg1 || {});

  K.npc = function (id, sprite, x, y, o) {
    const s = String(sprite || 'man');
    return Object.assign({ id, sprite: s.includes(':') ? s : 'npc:' + s, x, y, dir: 'down' }, o || {});
  };
  K.talk = function (id, sprite, x, y, text, o) { return K.npc(id, sprite, x, y, Object.assign({ text }, o || {})); };
  K.sign = function (x, y, text, cond) { const s = { x, y, text }; if (cond != null) s.cond = cond; return s; };
  K.chest = function (id, x, y, pool) { return { id, x, y, pool: pool || 'p_supply' }; };
  K.step = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'step' }, o || {}); };
  K.exam = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'examine' }, o || {}); };
  K.band = function (id, x0, y0, x1, y1, o) {
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(K.step(id, x, y, o));
    return out;
  };
  K.warp = function (x, y, to, spawn, o) { return Object.assign({ x, y, to, spawn }, o || {}); };

  // text conds (§3.2.3): the region's own clear, tiers, the fog over the inner sea, the ending
  K.C = {
    clear: { cleared: 'r_forest' },
    before: { notCleared: 'r_forest' },
    post: { postgame: true },
    fog: 'final_open',
    t1: { tier: 1 }, t2: { tier: 2 }, t3: { tier: 3 }, t4: { tier: 4 }, t6: { tier: 6 }, t7: { tier: 7 },
    scribes: [{ tier: 4 }, { tierBelow: 7 }],
  };

  K.ZONE_MAZE = 'z_r_forest_maze';
  K.ZONE_TREE = 'z_r_forest_tree';
  K.ESCAPE = { to: 'world', spawn: 'verda_maze_1' }; // §10.6.2-3 (千年樹 too)

  /** every row (and decor row) of a def has the same width; warns once per map */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('region1 map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('region1 map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('region1 map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  K.MAPS = ['fern', 'verda_maze_1', 'verda_maze_2', 'elder_tree_1', 'elder_tree_2'];
})(window.RPG);
