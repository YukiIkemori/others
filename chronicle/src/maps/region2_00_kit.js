// Region 2 r_desert ザハラ砂漠 (R2 reg2) — shared helpers for the region's maps and events.
// Loaded before region2_kasim.js / region2_tomb.js ('0' sorts before letters). DESIGN §10.8.0, §10.8.3.
//
// Maps are written as plain terrain rows + a decor layer; every object (NPCs, signs, chests,
// spawns, events, warps) is listed explicitly with x,y (chest ids never depend on row order, §3.1.4).
//
//   const K = R.Region2;
//   K.npc(id, sprite, x, y, o)          NPC ('npc:' prefix added unless the key has ':'); pass fixed/push in o
//   K.talk(id, sprite, x, y, text, o)   NPC with text (string, pages[] or [{cond,text}] §3.2.4)
//   K.sign(x, y, text, cond)            sign (examine); text may be a {cond,text} array
//   K.chest(id, x, y, pool, o)          tier chest {id, x, y, pool} (§8.12.1: pools only)
//   K.step(id, x, y, o) / K.exam(id, x, y, o)   map events
//   K.band(id, x0, y0, x1, y1, o)       the same step event on every cell of a rectangle
//   K.warp(x, y, to, spawn, o)
//   K.C                                 the text conds used in the region (§3.2.3, §10.9)
//
// Also registers the closed tile `quicksand` (流砂. impassable, animated; drawn here unless the
// tile art already has it) used by sand_tomb_2 through tilePatches {tile:'quicksand', cond:'!desert_mid'}:
// the corridors are plain sand in the rows and become quicksand while the mid-boss lives
// (§10.8.3 #5「倒すと流砂が止まり、奥の像へ行ける」, §10.8.0-6 closed passage + examine event).
(function (R) {
  'use strict';
  const K = (R.Region2 = R.Region2 || {});

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

  K.REGION = 'r_desert';
  K.C = {
    post: { postgame: true },
    fog: 'final_open',
    clear: { cleared: 'r_desert' },
    notClear: { notCleared: 'r_desert' },
    start: 'desert_start',
    t1: { tier: 1 }, t3: { tier: 3 }, t4: { tier: 4 }, t6: { tier: 6 }, t7: { tier: 7 },
    scribe: [{ tier: 4 }, { tierBelow: 7 }],
  };

  /** every row (and decor row) of a def has the same width; warns once per map */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('region2 map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('region2 map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('region2 map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  /** the region's map ids (for tools) */
  K.MAPS = ['kasim', 'sand_tomb_1', 'sand_tomb_2', 'sand_tomb_3'];

  // ------------------------------------------------------------ 流砂 (closed tile, sand_tomb_2)
  if (!R.DB.tiles.quicksand) {
    R.DB.tiles.quicksand = { name: '流砂', pass: false, anim: 2, closed: true };
  }
  /** 2 frames of sand pouring into a funnel: the ring of ripples turns a quarter between frames */
  function quicksandFrames() {
    const G = R.Gfx;
    const P = [0x6e5630, 0x8e7244, 0xae9060, 0xc8ac7a, 0xdcc496, 0xeadab4];
    const rgb = (c) => 'rgb(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ')';
    const frames = [];
    for (let f = 0; f < 2; f++) {
      const cv = G.makeCanvas(16, 16), c = cv.getContext('2d');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x - 7.5, dy = (y - 7.5) * 1.15;
          const r = Math.sqrt(dx * dx + dy * dy);
          const a = Math.atan2(dy, dx);
          // a spiral: the band index follows the radius plus the angle (turns with the frame)
          const s = r * 0.9 + (a / (Math.PI * 2)) * 3 + f * 1.5;
          const band = ((Math.floor(s) % 3) + 3) % 3;
          let k = r < 2.2 ? 0 : r < 3.6 ? 1 : 2 + band;
          if (k > 5) k = 5;
          // tiny grains
          if (((x * 7 + y * 13 + f * 5) % 23) === 0 && r > 4) k = Math.min(5, k + 1);
          c.fillStyle = rgb(P[k]);
          c.fillRect(x, y, 1, 1);
        }
      }
      frames.push(cv);
    }
    return frames;
  }
  if (R.Gfx && !R.Gfx.has('tile:quicksand')) R.Gfx.def('tile:quicksand', quicksandFrames);
})(window.RPG);
