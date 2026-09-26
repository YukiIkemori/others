// Region 8 r_star オルビス高原 (R8 reg8): shared helpers for the region's maps and events
// (loaded before region8_*.js maps: '0' sorts before letters). DESIGN §10.8.0, §10.8.9, §13.1.
//
// Maps are written as plain terrain rows + a decor layer; every object (NPCs, signs, chests,
// spawns, events, warps) is listed with explicit x,y (chest ids never depend on row order).
//
//   const K = R.Reg8;
//   K.npc(id, sprite, x, y, o)          NPC ('npc:' prefix unless the key has ':')
//   K.talk(id, sprite, x, y, text, o)   NPC with text (string, pages[] or [{cond,text}] §3.2.4)
//   K.sign(x, y, text, cond)            sign (examine)
//   K.chest(id, x, y, pool, o)          tier chest {id, x, y, pool} (§8.12.1: no fixed items)
//   K.step(id, x, y, o) / K.exam(id, x, y, o)   map events
//   K.band(id, x0, y0, x1, y1, o)       the same step event on every cell of a rectangle
//   K.warp(x, y, to, spawn, o)
//
// Public contract (other areas rely on these):
//   maps     orbis · stargaze_1 · stargaze_2 · stargaze_3 · stargaze_4   (K.MAPS)
//   spawns   orbis: entrance · inn · west · stargaze_n: entrance (1F) · from_prev · from_next
//   flags    star_start · star_chart · star_mid · star_fine · star_boss (+ once ids = event ids)
//   objectives obj_star_1 · obj_star_2 (registered in src/events/region8_star.js)
(function (R) {
  'use strict';
  const K = (R.Reg8 = R.Reg8 || {});

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

  // text conds (§3.2.3 / §10.9)
  K.C = {
    post: { postgame: true },
    fog: 'final_open',
    clear: { cleared: 'r_star' },
    t1: { tier: 1 }, t3: { tier: 3 }, t4: { tier: 4 }, t6: { tier: 6 }, t7: { tier: 7 },
    scribe: [{ tier: 4 }, { tierBelow: 7 }],
  };

  /** check that every row (and decor row) of a def has the same width; warns once per map */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('reg8 map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('reg8 map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('reg8 map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  K.MAPS = ['orbis', 'stargaze_1', 'stargaze_2', 'stargaze_3', 'stargaze_4'];
  K.REGION = 'r_star';
  K.ZONE = 'z_r_star_tower';
  K.ESCAPE = { to: 'world', spawn: 'stargaze_1' };

  // ------------------------------------------------------------ small field sprites of the region
  // obj:r8_chart   the old star chart spread on the library's pedestal, with a slow sparkle (4 frames)
  // obj:r8_starglass  a hanging brass orrery ring used as a floor set piece in the tower (2 frames)
  function frames(n, w, h, draw) {
    const G = R.Gfx, out = [];
    for (let i = 0; i < n; i++) {
      const cv = G.makeCanvas(w, h), c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      draw(c, i);
      out.push(cv);
    }
    return out;
  }
  function px(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w || 1, h || 1); }
  const STARS = [[3, 3], [6, 2], [9, 4], [12, 3], [4, 6], [8, 7], [11, 6], [5, 9], [10, 9], [7, 10]];
  function drawChart(c, i) {
    // parchment sheet lying on the pedestal top (y 4..13), slightly curled corners
    px(c, '#3a2a1c', 1, 4, 14, 10);
    px(c, '#d8c89c', 2, 4, 12, 9);
    px(c, '#e8dcb4', 2, 4, 12, 1);
    px(c, '#b8a47a', 2, 12, 12, 1);
    px(c, '#1c2448', 3, 5, 10, 7);          // the navy sky printed on it
    px(c, '#2c3a6c', 3, 5, 10, 1);
    const lit = [[4, 6], [7, 6], [10, 7], [5, 9], [9, 10], [11, 9], [6, 8]];
    lit.forEach(([x, y], k) => px(c, (k + i) % 4 === 0 ? '#ffffff' : '#ffe890', x, y));
    px(c, '#8a9ad0', 5, 7, 2, 1); px(c, '#8a9ad0', 8, 7, 2, 1); px(c, '#8a9ad0', 10, 8, 1, 1); // constellation lines
    // sparkle (4-point star) moving across the corners
    const S = [[13, 2], [2, 3], [12, 12], [3, 12]][i % 4];
    px(c, '#ffffff', S[0], S[1] - 1, 1, 3); px(c, '#ffffff', S[0] - 1, S[1], 3, 1);
    px(c, '#fff4b0', S[0], S[1]);
  }
  function drawStarglass(c, i) {
    // a small floor orrery: brass ring on a foot, a golden sun and a blue planet
    px(c, '#2a1c10', 6, 18, 4, 5); px(c, '#b08a3c', 7, 18, 2, 5); px(c, '#6a4c20', 4, 22, 8, 2); px(c, '#c8a050', 5, 22, 6, 1);
    const ring = [[4, 6], [5, 5], [6, 4], [7, 4], [8, 4], [9, 4], [10, 5], [11, 6], [12, 7], [12, 8], [12, 9], [11, 10], [10, 11], [9, 12], [8, 12], [7, 12], [6, 12], [5, 11], [4, 10], [3, 9], [3, 8], [3, 7]];
    ring.forEach(([x, y]) => px(c, '#d8b060', x, y + 4));
    ring.forEach(([x, y]) => px(c, '#6a4c20', x + 1, y + 5));
    ring.forEach(([x, y]) => px(c, '#e8c878', x, y + 4));
    px(c, '#ffd040', 7, 11, 2, 2); px(c, '#fff8c0', 7, 11);
    const p = ring[(i * 7) % ring.length];
    px(c, '#4c6cd0', p[0] - 1, p[1] + 3, 2, 2); px(c, '#a8c0ff', p[0] - 1, p[1] + 3);
  }
  function install() {
    const G = R.Gfx;
    if (!G || !G.def) return;
    if (!G.has('obj:r8_chart')) G.def('obj:r8_chart', () => frames(4, 16, 16, drawChart));
    if (!G.has('obj:r8_starglass')) G.def('obj:r8_starglass', () => frames(2, 16, 28, drawStarglass));
  }
  install();
  K.STARS = STARS;
})(window.RPG);
