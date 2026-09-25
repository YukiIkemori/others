// Prologue (A18b) shared helpers for the prologue maps and events (loaded before
// prologue_*.js maps: '0' sorts before letters). Owner: prologue (A18b). DESIGN §10.7.
//
// Maps are written with plain terrain rows + a decor layer; every object (NPCs,
// signs, chests, spawns, events, warps) is listed explicitly with x,y so no mark
// chars are needed (and chest ids never depend on row order, §3.1.4).
//
//   const K = R.Prologue;
//   K.npc(id, sprite, x, y, o)          NPC ('npc:' prefix added unless the key has ':')
//   K.talk(id, sprite, x, y, text, o)   NPC with text (string, pages[] or [{cond,text}] §3.2.4)
//   K.sign(x, y, text, cond)            sign (examine)
//   K.chest(id, x, y, pool, o)          tier chest {id, x, y, pool} (§8.12.1: no fixed items)
//   K.step(id, x, y, o) / K.exam(id, x, y, o)   map events
//   K.band(id, x0, y0, x1, y1, o)       the same step event on every cell of a rectangle
//   K.warp(x, y, to, spawn, o)
//
// Text conds used by the prologue towns (§3.2.3 / §10.9):
//   K.C.post    after the ending             K.C.fog     the inner-sea fog is gone
//   K.C.t1..t7  tier >= n                   K.C.done    the prologue is over
(function (R) {
  'use strict';
  const K = (R.Prologue = R.Prologue || {});

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

  K.C = {
    post: { postgame: true },
    fog: 'final_open',
    done: 'prologue_done',
    t1: { tier: 1 }, t2: { tier: 2 }, t3: { tier: 3 }, t4: { tier: 4 }, t5: { tier: 5 }, t6: { tier: 6 }, t7: { tier: 7 },
  };

  /** check that every row (and decor row) of a def has the same width; warns once per map */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('prologue map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('prologue map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('prologue map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  /** the prologue map ids (for tools) */
  K.MAPS = ['roa_house', 'roa', 'lute', 'lighthouse_1', 'lighthouse_2', 'lighthouse_3'];
})(window.RPG);
