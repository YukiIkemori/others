// Region 5 マレア諸島 (r_isles) — shared helpers for the region's maps and events.
// Owner: reg-5 (R5, DESIGN §13.1). Loaded before region5_*.js maps ('0' sorts before letters).
// Spec: DESIGN §10.8.0 (common rules), §10.8.6 (the region), §10.6 (maps), §10.6.4 (secret passage),
// §9.7 (zones z_r_isles_cave / z_r_isles_ship), §11.2.6 / §11.2.8 / §11.2.11 (themes and decor).
//
// Maps: coral (港町コーラル), nerei (岬の村ネレイ), tide_cave_1 (潮鳴りの洞窟), ghost_ship_1..3 (幽霊船).
// Every object (NPC, sign, chest, spawn, event, warp) is listed explicitly with x,y — no mark chars —
// so chest ids never depend on row order (§3.1.4).
//
//   const K = R.Isles;
//   K.npc(id, sprite, x, y, o)          NPC ('npc:' prefix unless the key has ':')
//   K.folk(id, sprite, x, y, text, o)   a townsperson: text + push:true (§10.13.10)
//   K.sign(x, y, text, cond)            sign (examine)
//   K.chest(id, x, y, pool)             tier chest (§8.12.1: pool only)
//   K.step / K.exam / K.band / K.warp   map events and warps
//   K.C                                 text conds (below)
//   K.tint(color, alpha)                a full-screen colour wash for the night / dawn scenes
//   K.MAPS                              the region's map ids (tools)
(function (R) {
  'use strict';
  const K = (R.Isles = R.Isles || {});

  K.REGION = 'r_isles';
  K.MAPS = ['coral', 'nerei', 'tide_cave_1', 'ghost_ship_1', 'ghost_ship_2', 'ghost_ship_3'];

  K.npc = function (id, sprite, x, y, o) {
    const s = String(sprite || 'man');
    return Object.assign({ id, sprite: s.includes(':') ? s : 'npc:' + s, x, y, dir: 'down' }, o || {});
  };
  K.folk = function (id, sprite, x, y, text, o) {
    return K.npc(id, sprite, x, y, Object.assign({ text, push: true }, o || {}));
  };
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

  // Text conds (§3.2.3). Lines are {cond, text} arrays read top to bottom (§3.2.4).
  K.C = {
    post: { postgame: true },           // after the ending
    fog: 'final_open',                  // the inner-sea fog is gone
    clear: { cleared: 'r_isles' },      // this region is told again
    t1: { tier: 1 }, t3: { tier: 3 }, t4: { tier: 4 }, t6: { tier: 6 }, t7: { tier: 7 },
    ship: 'isles_ship',                 // the ghost ship came to the pier (the night of the song)
    mid: 'isles_mid',                   // the great octopus is beaten
    marina: 'isles_marina',             // Marina told her story
    start: 'isles_start',               // Drake told about the ghost ship
    shell: { item: 'k_shanty' },
  };

  /** check that every row (and decor row) of a def has the same width; warns once per problem */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('isles map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('isles map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('isles map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  // ------------------------------------------------------------ colour wash (night / dawn scenes)
  // A plain layer drawn over the field (and under the message windows and captions pushed after it).
  // K.tint('#101840', 0.45[, 'soft-light']) → {fade(alpha, frames), set(a), color(c), close()}. The optional
  // blend mode is a canvas globalCompositeOperation ('soft-light' warms a dawn without greying the sea).
  // Always close() it (the scripts use try/finally).
  K.tint = function (color, alpha, mode) {
    const E = R.Engine;
    if (!E || !R.Layer || typeof document === 'undefined') return { fade: async () => {}, close() {}, set() {}, color() {} };
    const L = new R.Layer();
    L.opaque = false;
    L.a = 0; L.to = alpha == null ? 0.4 : alpha; L.step = 0; L.color = color || '#101840';
    L.update = function () {};
    L.tick = function () {
      if (this.step && this.a !== this.to) {
        this.a += this.step;
        if ((this.step > 0 && this.a >= this.to) || (this.step < 0 && this.a <= this.to)) { this.a = this.to; this.step = 0; }
      }
    };
    L.draw = function () {
      if (this.a <= 0) return;
      const G = R.Gfx, c = G.ctx;
      c.globalAlpha = Math.min(1, this.a);
      if (mode) c.globalCompositeOperation = mode;
      G.rect(0, 0, R.W, R.H, this.color);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    };
    // sit directly above the field layer, so windows opened later stay on top
    const fl = R.Field && R.Field.layer;
    const i = fl ? E.layers.indexOf(fl) : -1;
    if (i >= 0) { E.layers.splice(i + 1, 0, L); L.closed = false; if (L.onPush) L.onPush(); } else E.push(L);
    L.a = L.to;
    return {
      set(a) { L.a = a; L.to = a; L.step = 0; },
      async fade(a, frames) {
        const f = Math.max(1, frames | 0 || 30);
        L.to = a; L.step = (a - L.a) / f;
        if (!L.step) return;
        await E.wait(f + 1);
      },
      color(c) { L.color = c; },
      close() { const j = E.layers.indexOf(L); if (j >= 0) { E.layers.splice(j, 1); if (L.onRemove) L.onRemove(); } L.closed = true; },
    };
  };
})(window.RPG);
