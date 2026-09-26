// Map kit of the endgame maps (owner: story A19; loaded before final_*.js maps: '0' sorts first).
// The endgame maps — 書の都ビブリア (biblia) and 白の大書庫 (archive_1..6) — are drawn on a grid with a few
// stamping helpers, then written out as plain rows + a decor layer (the normal map format, DESIGN §3.3.10).
// Every object (NPCs, signs, chests, spawns, events, warps) is listed explicitly with x,y (no mark chars;
// chest ids never depend on row order, §3.1.4).
//
//   const K = R.Final;
//   const g = K.grid(w, h, fill)       a w×h grid of legend chars (and g.dec, the decor layer, '.')
//   K.fill(g, x, y, w, h, ch)          rectangle of one char (terrain)
//   K.put(g, x, y, str | [rows])       write strings (terrain); ' ' in a string leaves the cell as it is
//   K.deco(g, x, y, str | [rows])      the same on the decor layer
//   K.house(g, x, y, w, h, o)          a building seen without its roof (Faros style): two rows of wall
//                                      face on top, one-tile side walls, a bottom wall; o.floor, o.doors:[x…]
//   K.rows(g) / K.decor(g)             → the row strings
//   K.npc / K.talk / K.sign / K.chest / K.step / K.exam / K.band / K.warp   object builders (as the prologue kit)
(function (R) {
  'use strict';
  const K = (R.Final = R.Final || {});

  // ------------------------------------------------------------ grid
  K.grid = function (w, h, fill) {
    const g = { w, h, t: [], dec: [] };
    for (let y = 0; y < h; y++) { g.t.push(new Array(w).fill(fill || '.')); g.dec.push(new Array(w).fill('.')); }
    return g;
  };
  const inG = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;
  K.fill = function (g, x, y, w, h, ch) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inG(g, i, j)) g.t[j][i] = ch;
    return g;
  };
  function write(layer, g, x, y, s) {
    const rows = Array.isArray(s) ? s : [s];
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) if (r[i] !== ' ' && inG(g, x + i, y + j)) layer[y + j][x + i] = r[i];
    });
    return g;
  }
  K.put = (g, x, y, s) => write(g.t, g, x, y, s);
  K.deco = (g, x, y, s) => write(g.dec, g, x, y, s);
  K.at = (g, x, y) => (inG(g, x, y) ? g.t[y][x] : null);
  /** a roofless building: wall face rows y, y+1; sides; bottom wall at y+h-1 with doors */
  K.house = function (g, x, y, w, h, o) {
    const opt = o || {};
    const wall = opt.wall || 'B';
    K.fill(g, x, y, w, h, wall);
    K.fill(g, x + 1, y + 2, w - 2, h - 3, opt.floor || '_');
    for (const dx of opt.doors || []) g.t[y + h - 1][x + dx] = 'D';
    return g;
  };
  K.rows = (g) => g.t.map((r) => r.join(''));
  K.decor = (g) => g.dec.map((r) => r.join(''));

  // ------------------------------------------------------------ objects
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

  /** every row (and decor row) of a def has the same width; warns once per map */
  K.check = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('final map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('final map ' + id + ': decor has ' + def.decor.length + ' rows');
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('final map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide'); });
    }
    return def;
  };

  K.MAPS = ['biblia', 'archive_1', 'archive_2', 'archive_3', 'archive_4', 'archive_5', 'archive_6'];
  K.ZONE_LO = 'z_finale_archive_lo';
  K.ZONE_HI = 'z_finale_archive_hi';
  K.ESC = { to: 'world', spawn: 'archive_1' };
})(window.RPG);
