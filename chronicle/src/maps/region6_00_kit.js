// Region 6 ガルド山地 (r_mine) — shared helpers for the region's maps and events (R6, DESIGN §13.1).
// Loaded before region6_mine.js / region6_town.js ('0' sorts first) and used again by
// src/events/region6_*.js (events load after maps, §1.3). Every helper only builds plain objects.
//
//   const K = R.Reg6;
//   K.npc(id, sprite, x, y, o)          NPC ('npc:' prefix added unless the key has ':')
//   K.talk(id, sprite, x, y, text, o)   NPC with text (string, pages[] or [{cond,text}] §3.2.4)
//   K.sign(x, y, text, cond)            sign (examine)
//   K.chest(id, x, y, pool)             tier chest (§8.12.1: pool only)
//   K.step / K.exam / K.band / K.warp   map events and warps
//   K.C                                 the text conds used by the region (§3.2.3, §10.9.3)
//   K.checkRows(id, def)                every row (and decor row) the same width (warns)
//
// Contracts for other areas: map ids dovan, deep_mine_1..3; flags mine_start mine_mid mine_fine
// mine_boss mine_door (the 七の層の岩戸 opened); var mine_rescued (0–3); key item k_oath_hammer;
// objectives obj_mine_1 obj_mine_2 (registered in src/events/region6_story.js); the extra encounter
// zone z_r_mine_den (the rare-monster den behind the secret passage on deep_mine_2).
(function (R) {
  'use strict';
  const K = (R.Reg6 = R.Reg6 || {});

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

  K.C = {
    post: { postgame: true },
    fog: 'final_open',
    clr: { cleared: 'r_mine' },
    t1: { tier: 1 }, t3: { tier: 3 }, t4: { tier: 4 }, t6: { tier: 6 }, t7: { tier: 7 },
  };

  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('region6 map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('region6 map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('region6 map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  /** the region's map ids (tools and tests) */
  K.MAPS = ['dovan', 'deep_mine_1', 'deep_mine_2', 'deep_mine_3'];
  K.ZONE = 'z_r_mine_mine';
  K.DEN_ZONE = 'z_r_mine_den';
})(window.RPG);
