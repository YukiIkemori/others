// Field: the map screen (DESIGN §7.2). One opaque layer that draws tiles,
// objects and y-sorted sprites, moves the party tile by tile (caterpillar),
// runs NPC AI, doors/locks, damage floors, warps, step events, encounters and
// the ship, plus the public R.Field API used by title/menu/events/debug.
//
// Map runtime objects come from R.FieldMap.compile (field_map.js); scripted
// actions (talk, chests, signs, events) run through R.Events (events_runtime.js)
// which serialises them and freezes the field while they run.
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const TS = 16;

  // frames per tile. 16px / 6 = 2⅔ px per frame = exactly 8 device px on the 3× canvas.
  const WALK = 6, DASH = 4, SAIL = 6, SAIL_DASH = 3, NPC_STEP = 16;
  const SCRIPT_WALK = 8; // cutscene party walks keep their original pacing
  const BUMP_EVERY = 20;
  const BANNER_FRAMES = 130;
  const ANIM_RATE = { sea: 16, water: 16, lava: 24, magma: 24, poison: 24, wall_torch: 8, warp_pad: 8, barrier: 8, seal: 16 };
  const BW = 17, BH = 15; // cells touched by the view (256x224 + one partial cell)
  const SPIN = { down: 'left', left: 'up', up: 'right', right: 'down' };

  let L = null; // the FieldLayer
  let M = null; // current map runtime (R.FieldMap)

  const dirTo = (a, b) => (b.x > a.x ? 'right' : b.x < a.x ? 'left' : b.y > a.y ? 'down' : b.y < a.y ? 'up' : null);
  const isDoor = (id) => typeof id === 'string' && id.startsWith('door');
  const leaderName = () => R.State.leader().name;

  // ------------------------------------------------------------ tile art
  // The map (tiles + decor) is pre-rendered into a cache canvas that is only
  // ever patched, never rebuilt while walking:
  //   * small maps (every town / dungeon): the whole map plus a screen-sized
  //     border is drawn once when the map loads (behind the fade);
  //   * big maps (the overworld): a window a few cells larger than the view
  //     slides along; crossing its edge shifts the pixels and draws only the
  //     newly exposed strip.
  // Animated tiles / decor redraw just their own cells when their frame changes.
  // (Previously the whole 17×15 buffer was redrawn at every tile crossing and
  // every 8 frames on maps with water, which showed up as frame-time spikes.)
  const WHOLE_MAX = 9000; // cells: cache the whole map when (w+2·PADX)·(h+2·PADY) fits
  const PADX = 9, PADY = 8; // cells of "outside" around a whole-map cache (a centred small map shows them)
  const MARG = 3; // sliding window margin (cells) on each side of the view
  const CH = 8; // whole-map cache chunk (cells)
  const TC = { cv: null, ctx: null, spare: null, uid: -1, ver: -1, x0: 0, y0: 0, w: 0, h: 0, whole: false, anim: [], danim: [], drawn: new Map() };
  const artWarned = {};

  function tileGfx(m, id) {
    let g = m.gfx[id];
    if (g !== undefined) return g;
    const G = R.Gfx;
    if (id === 'void' && !G.has('tile:void')) g = null;
    else if (m.theme && G.has('tile:' + m.theme + ':' + id)) g = G.get('tile:' + m.theme + ':' + id);
    else g = G.get('tile:' + id);
    return (m.gfx[id] = g);
  }
  /** canvas | canvas[] | null for a cell */
  function cellGfx(m, x, y) {
    if (!m.inBounds(x, y)) return tileGfx(m, m.outside);
    const i = m.idx(x, y);
    if (m.opened.size && m.opened.has(i)) return tileGfx(m, m.opened.get(i));
    // context-aware art (autotiling): worldTile for the overworld, localTile elsewhere
    const ctxFn = R.Art && (m.isWorld ? R.Art.worldTile : R.Art.localTile);
    if (typeof ctxFn === 'function') {
      let w = m.wcache[i];
      if (w === undefined) {
        try { w = ctxFn(m, x, y) || null; } catch (e) {
          w = null;
          if (!artWarned.ctx) { artWarned.ctx = 1; console.error('R.Art context tile failed', e); }
        }
        m.wcache[i] = w;
      }
      if (w) return w;
    }
    return tileGfx(m, m.tiles[i]);
  }
  /** decor canvas | frames | null at a cell (cached per cell) */
  function decorGfx(m, x, y) {
    const id = m.decorAt(x, y);
    if (!id) return null;
    const i = m.idx(x, y);
    m.dcache = m.dcache || [];
    let g = m.dcache[i];
    if (g === undefined) {
      g = null;
      if (R.Art && typeof R.Art.decorTile === 'function') {
        try { g = R.Art.decorTile(m, x, y) || null; } catch (e) {
          if (!artWarned.decor) { artWarned.decor = 1; console.error('R.Art.decorTile failed', e); }
        }
      }
      if (!g) g = R.Gfx.get('decor:' + id);
      m.dcache[i] = g;
    }
    return g;
  }
  const tileRate = (m, x, y) => ANIM_RATE[m.tileAt(x, y)] || 16;
  const decorRate = (m, x, y) => { const dd = R.DB.decor[m.decorAt(x, y)]; return (dd && dd.animRate) || 12; };
  const cellKey = (x, y) => (y + 1024) * 4096 + (x + 1024);
  function frameOf(g, rate) { return Math.floor(R.Engine.frame / rate) % g.length; }

  /** redraw a rectangle of the cache (cache-local px): tiles, then every decor that can reach it, clipped */
  function redrawRect(px, py, pw, ph) {
    const c = TC.ctx, m = M;
    c.save();
    c.beginPath(); c.rect(px, py, pw, ph); c.clip();
    c.fillStyle = '#000';
    c.fillRect(px, py, pw, ph);
    const c0 = Math.floor(px / TS), c1 = Math.floor((px + pw - 1) / TS);
    const r0 = Math.floor(py / TS), r1 = Math.floor((py + ph - 1) / TS);
    for (let j = r0; j <= r1; j++) {
      for (let i = c0; i <= c1; i++) {
        const x = TC.x0 + i, y = TC.y0 + j;
        let g = cellGfx(m, x, y);
        if (!g) continue;
        if (Array.isArray(g)) {
          const f = frameOf(g, tileRate(m, x, y));
          TC.drawn.set(cellKey(x, y), f);
          g = g[f];
          if (!g) continue;
        }
        c.drawImage(g, i * TS, j * TS);
      }
    }
    // decor: tall props are drawn bottom-aligned (up to 48px) and centred (up to 48px wide),
    // so cells up to 2 rows below and 1 column either side can reach into the rect
    if (m.decor) {
      for (let j = r0; j <= r1 + 2; j++) {
        for (let i = c0 - 1; i <= c1 + 1; i++) {
          const x = TC.x0 + i, y = TC.y0 + j;
          let g = decorGfx(m, x, y);
          if (!g) continue;
          if (Array.isArray(g)) {
            const f = frameOf(g, decorRate(m, x, y));
            TC.drawn.set(-cellKey(x, y), f);
            g = g[f];
            if (!g) continue;
          }
          c.drawImage(g, i * TS + ((TS - g.width) >> 1), j * TS + TS - g.height);
        }
      }
    }
    c.restore();
  }
  /** (re)collect the animated cells of the cached area */
  function scanAnim(i0, j0, i1, j1) {
    const m = M;
    if (i0 === undefined) { TC.anim = []; TC.danim = []; i0 = 0; j0 = 0; i1 = TC.w - 1; j1 = TC.h - 1; }
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = TC.x0 + i, y = TC.y0 + j;
        const g = cellGfx(m, x, y);
        if (Array.isArray(g)) {
          let plain = true; // no decor can overlap this cell: a plain blit is enough
          if (m.decor) for (let jj = y; jj <= y + 2 && plain; jj++) for (let ii = x - 1; ii <= x + 1; ii++) if (m.decorAt(ii, jj)) { plain = false; break; }
          TC.anim.push({ x, y, plain });
        }
        const dg = m.decor && decorGfx(m, x, y);
        if (Array.isArray(dg)) TC.danim.push({ x, y });
      }
    }
  }
  function tcCanvas(w, h) {
    const pw = w * TS, ph = h * TS;
    if (!TC.cv || TC.cv.width !== pw || TC.cv.height !== ph) {
      TC.cv = R.Gfx.makeCanvas(pw, ph);
      TC.ctx = TC.cv.getContext('2d');
      TC.ctx.imageSmoothingEnabled = false;
      TC.spare = null;
    }
  }
  function tcRebuild(ox, oy) {
    TC.uid = M.uid; TC.ver = M.version;
    const W = M.w + 2 * PADX, H = M.h + 2 * PADY;
    TC.whole = W * H <= WHOLE_MAX;
    if (TC.whole) { TC.x0 = -PADX; TC.y0 = -PADY; TC.w = W; TC.h = H; }
    else { TC.w = BW + 2 * MARG; TC.h = BH + 2 * MARG; TC.x0 = ox - MARG; TC.y0 = oy - MARG; }
    tcCanvas(TC.w, TC.h);
    TC.drawn.clear();
    if (TC.whole) {
      // drawn lazily in CH×CH chunks: the view's chunks at once, the rest a little per frame
      TC.cw = Math.ceil(TC.w / CH); TC.chh = Math.ceil(TC.h / CH);
      TC.chunks = new Uint8Array(TC.cw * TC.chh);
      TC.left = TC.chunks.length;
      TC.anim = []; TC.danim = [];
    } else {
      redrawRect(0, 0, TC.w * TS, TC.h * TS);
      scanAnim();
    }
  }
  function tcChunk(ci, cj) {
    const k = cj * TC.cw + ci;
    if (TC.chunks[k]) return;
    TC.chunks[k] = 1; TC.left--;
    const i0 = ci * CH, j0 = cj * CH, i1 = Math.min(TC.w, i0 + CH) - 1, j1 = Math.min(TC.h, j0 + CH) - 1;
    redrawRect(i0 * TS, j0 * TS, (i1 - i0 + 1) * TS, (j1 - j0 + 1) * TS);
    scanAnim(i0, j0, i1, j1);
  }
  /** whole-map cache: make sure the view's chunks exist, then fill others nearest-first within a time budget */
  function tcFill(ox, oy, budgetMs) {
    const ci0 = Math.max(0, Math.floor((ox - 1 - TC.x0) / CH)), cj0 = Math.max(0, Math.floor((oy - 1 - TC.y0) / CH));
    const ci1 = Math.min(TC.cw - 1, Math.floor((ox + BW - TC.x0) / CH)), cj1 = Math.min(TC.chh - 1, Math.floor((oy + BH + 2 - TC.y0) / CH));
    for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) tcChunk(ci, cj);
    if (!TC.left) return;
    const t0 = performance.now();
    const cx = (ci0 + ci1) / 2, cy = (cj0 + cj1) / 2;
    for (let r = 1; TC.left && r < TC.cw + TC.chh; r++) {
      for (let cj = Math.floor(cy - r); cj <= cy + r; cj++) {
        for (let ci = Math.floor(cx - r); ci <= cx + r; ci++) {
          if (ci < 0 || cj < 0 || ci >= TC.cw || cj >= TC.chh || TC.chunks[cj * TC.cw + ci]) continue;
          tcChunk(ci, cj);
          if (performance.now() - t0 > budgetMs) return;
        }
      }
    }
  }
  /** slide the window so the view (ox,oy)+(BW,BH) sits in its middle, redrawing only exposed strips */
  function tcSlide(ox, oy) {
    const nx0 = ox - MARG, ny0 = oy - MARG;
    const dx = TC.x0 - nx0, dy = TC.y0 - ny0; // old origin in new cache cells
    if (Math.abs(dx) >= TC.w || Math.abs(dy) >= TC.h) { tcRebuild(ox, oy); return; }
    if (!TC.spare) {
      TC.spare = R.Gfx.makeCanvas(TC.cv.width, TC.cv.height);
      TC.spareCtx = TC.spare.getContext('2d');
      TC.spareCtx.imageSmoothingEnabled = false;
    }
    const s = TC.spareCtx;
    s.fillStyle = '#000'; s.fillRect(0, 0, TC.spare.width, TC.spare.height);
    s.drawImage(TC.cv, dx * TS, dy * TS);
    [TC.cv, TC.spare] = [TC.spare, TC.cv];
    [TC.ctx, TC.spareCtx] = [TC.spareCtx, TC.ctx];
    TC.x0 = nx0; TC.y0 = ny0;
    const W = TC.w * TS, H = TC.h * TS;
    if (dx > 0) redrawRect(0, 0, dx * TS, H);
    if (dx < 0) redrawRect(W + dx * TS, 0, -dx * TS, H);
    if (dy > 0) redrawRect(0, 0, W, dy * TS);
    if (dy < 0) redrawRect(0, H + dy * TS, W, -dy * TS);
    // forget frames drawn for cells that left the window
    for (const k of TC.drawn.keys()) {
      const a = Math.abs(k), x = (a % 4096) - 1024, y = Math.floor(a / 4096) - 1024;
      if (x < TC.x0 - 1 || y < TC.y0 || x > TC.x0 + TC.w || y > TC.y0 + TC.h + 1) TC.drawn.delete(k);
    }
    scanAnim();
  }
  /** Generate (and cache) the art of cells around the sliding window a little
   *  every frame, so a slide only copies ready-made canvases. Context tiles
   *  (autotiling) cost far more to build than to draw. */
  const WARM = 10; // cells beyond the window
  function warmArt(budgetMs) {
    const m = M, t0 = performance.now();
    const x0 = Math.max(0, TC.x0 - WARM), y0 = Math.max(0, TC.y0 - WARM);
    const x1 = Math.min(m.w - 1, TC.x0 + TC.w + WARM), y1 = Math.min(m.h - 1, TC.y0 + TC.h + WARM);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = m.idx(x, y);
        const need = m.wcache[i] === undefined || (m.decor && m.decor[i] && (!m.dcache || m.dcache[i] === undefined));
        if (!need) continue;
        cellGfx(m, x, y); decorGfx(m, x, y);
        if (performance.now() - t0 > budgetMs) return;
      }
    }
  }
  /** redraw the animated cells near the view whose frame changed */
  function tcAnimate(ox, oy) {
    const m = M, c = TC.ctx;
    const vx0 = ox - 1, vy0 = oy - 1, vx1 = ox + BW, vy1 = oy + BH + 2;
    for (const a of TC.anim) {
      if (a.x < vx0 || a.y < vy0 || a.x > vx1 || a.y > vy1) continue;
      const g = cellGfx(m, a.x, a.y);
      if (!Array.isArray(g)) continue;
      const f = frameOf(g, tileRate(m, a.x, a.y)), k = cellKey(a.x, a.y);
      if (TC.drawn.get(k) === f) continue;
      const lx = (a.x - TC.x0) * TS, ly = (a.y - TC.y0) * TS;
      if (a.plain) {
        c.fillStyle = '#000'; c.fillRect(lx, ly, TS, TS);
        if (g[f]) c.drawImage(g[f], lx, ly);
        TC.drawn.set(k, f);
      } else redrawRect(lx, ly, TS, TS);
    }
    for (const a of TC.danim) {
      if (a.x < vx0 - 1 || a.y < vy0 || a.x > vx1 + 1 || a.y > vy1 + 2) continue;
      const g = decorGfx(m, a.x, a.y);
      if (!Array.isArray(g)) continue;
      const f = frameOf(g, decorRate(m, a.x, a.y));
      if (TC.drawn.get(-cellKey(a.x, a.y)) === f) continue;
      const im = g[f] || g[0];
      const w = (im && im.width) || TS, h = (im && im.height) || TS;
      redrawRect((a.x - TC.x0) * TS + ((TS - w) >> 1), (a.y - TC.y0) * TS + TS - h, w, h);
    }
  }
  function drawTiles(camX, camY) {
    const ox = Math.floor(camX / TS), oy = Math.floor(camY / TS);
    if (TC.uid !== M.uid || !TC.cv) tcRebuild(ox, oy);
    else if (TC.ver !== M.version) {
      // doors opened on this visit patch single cells; anything else redraws everything
      const dirty = (M.dirtyCells || []).filter((d) => d.v > TC.ver && d.v <= M.version);
      if (dirty.length === M.version - TC.ver) {
        TC.ver = M.version;
        for (const d of dirty) {
          const lx = (d.x - TC.x0) * TS, ly = (d.y - TC.y0) * TS;
          if (lx >= 0 && ly >= 0 && lx < TC.w * TS && ly < TC.h * TS) redrawRect(lx, ly, TS, TS);
        }
      } else tcRebuild(ox, oy);
    }
    const P = R._prof, t0 = performance.now();
    if (TC.whole) { if (TC.left) tcFill(ox, oy, 0); }
    else if (ox < TC.x0 || oy < TC.y0 || ox + BW > TC.x0 + TC.w || oy + BH > TC.y0 + TC.h) { tcSlide(ox, oy); if (P) P.push(['slide', performance.now() - t0]); }
    const t1 = performance.now();
    tcAnimate(ox, oy);
    if (P) P.push(['anim', performance.now() - t1]);
    const t2 = performance.now();
    // copy just the visible part of the cache (whole-pixel source rect, sub-pixel destination)
    const ix = Math.floor(camX), iy = Math.floor(camY);
    const sx = ix - TC.x0 * TS, sy = iy - TC.y0 * TS;
    const w = Math.min(R.W + 1, TC.cv.width - sx), h = Math.min(R.H + 1, TC.cv.height - sy);
    if (sx < 0 || sy < 0 || w <= 0 || h <= 0) { blit(TC.cv, TC.x0 * TS - camX, TC.y0 * TS - camY); return; }
    R.Gfx.ctx.drawImage(TC.cv, sx, sy, w, h, q(ix - camX), q(iy - camY), w, h);
    if (P) P.push(['blit', performance.now() - t2]);
    const t3 = performance.now();
    if (TC.whole) { if (TC.left) tcFill(ox, oy, 1); }
    else warmArt(1);
    if (P) P.push(['warm', performance.now() - t3]);
  }
  /** draw at a sub-pixel position: logical px quantised to device px (the canvas is R.SCALE×) */
  const q = (v) => Math.round(v * R.SCALE) / R.SCALE;
  function blit(img, x, y, o) {
    if (!img) return;
    const c = R.Gfx.ctx;
    x = q(x); y = q(y);
    if (!o) { c.drawImage(img, x, y); return; }
    const a = c.globalAlpha;
    if (o.alpha != null) c.globalAlpha = a * o.alpha;
    if (o.w) c.drawImage(img, x, y, o.w, o.h); else c.drawImage(img, x, y);
    c.globalAlpha = a;
  }
  /** pick a frame from a sprite sheet {down:[..],..} / array / canvas */
  function sheetFrame(g, dir, f) {
    if (!g) return null;
    if (g.getContext || g.width) return g;
    if (Array.isArray(g)) return g[f % g.length] || g[0];
    const a = g[dir] || g.down || g[Object.keys(g)[0]];
    if (Array.isArray(a)) return a[f % a.length] || a[0];
    return a || null;
  }

  // ------------------------------------------------------------ the layer
  class FieldLayer extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.P = [0, 1, 2].map(() => ({ x: 0, y: 0, dir: 'down' })); // P[0] = leader (tile coords)
      this.mv = null; // party move {t,dur,from,kind,scripted,resolve}
      this.arrived = null; // kind of the move that just completed (processed in update)
      this.locks = 0; // >0 while warping / processing a step / in battle
      this.walking = false; // a step is chained (no idle frame between tiles)
      this.bumpT = 0;
      this.clock = 0; // walk animation clock
      this.lift = 0; // teleport lift (px, negative = up)
      this.liftAnim = null;
      this.banner = null;
      this.encCount = 20;
      this.spawnName = null;
      this.heldBlock = null;
      this._fm = null; this._fmT = -99;
    }

    // ------------------------------------------------------------ helpers
    get lead() { return this.P[0]; }
    place(x, y, dir) {
      for (const p of this.P) { p.x = x; p.y = y; if (dir) p.dir = dir; }
      this.mv = null; this.arrived = null; this.walking = false;
    }
    savePos() {
      const p = this.P[0];
      R.Game.pos = { map: M.id, x: p.x, y: p.y, dir: p.dir, spawn: this.spawnName };
    }
    resetEnc() { this.encCount = M.encRate * U.rf(0.6, 1.4); }
    /** party-wide field mods: strongest encounterPct, max walkHeal, any noFloorDamage/treasureSense */
    fieldMods() {
      if (this._fm && R.Engine.frame - this._fmT < 20) return this._fm;
      const out = { encounterPct: 0, walkHeal: 0, noFloorDamage: false, treasureSense: false };
      for (const c of R.State.alive()) {
        let m;
        try { m = R.Rules.mods(c); } catch (e) { continue; }
        const e = m.encounterPct || 0, cur = out.encounterPct;
        if (Math.abs(e) > Math.abs(cur) || (Math.abs(e) === Math.abs(cur) && e < cur)) out.encounterPct = e;
        out.walkHeal = Math.max(out.walkHeal, m.walkHeal || 0);
        if (m.noFloorDamage) out.noFloorDamage = true;
        if (m.treasureSense) out.treasureSense = true;
      }
      this._fm = out; this._fmT = R.Engine.frame;
      return out;
    }
    /** order of drawn members: leader (first living) then the others in party order */
    members() {
      const party = R.Game.party, lead = R.State.leader();
      return [lead].concat(party.filter((c) => c !== lead)).slice(0, 3);
    }
    /** drawn position (px) of party member i. Between fixed steps the move is
     *  advanced by Engine.alpha so motion follows real time on any refresh rate;
     *  values are quantised to device pixels (1/3 px), never to whole pixels. */
    renderPos(i) {
      const p = this.P[i], mv = this.mv;
      if (!mv) return { x: p.x * TS, y: p.y * TS };
      const f = mv.from[i], k = Math.min(1, (mv.t + (R.Engine.alpha || 0)) / mv.dur);
      return { x: q((f.x + (p.x - f.x) * k) * TS), y: q((f.y + (p.y - f.y) * k) * TS) };
    }
    camera() {
      const lp = this.renderPos(0);
      let cx = lp.x + 8 - R.W / 2, cy = lp.y + 8 - R.H / 2;
      const mw = M.w * TS, mh = M.h * TS;
      cx = mw <= R.W ? Math.floor((mw - R.W) / 2) : U.clamp(cx, 0, mw - R.W);
      cy = mh <= R.H ? Math.floor((mh - R.H) / 2) : U.clamp(cy, 0, mh - R.H);
      return { x: q(cx), y: q(cy) };
    }
    /** the engine renders every display refresh while something glides */
    wantsFrame() {
      if (this.mv || this.liftAnim) return true;
      if (M) for (const n of M.npcs) if (n.mv && n.present) return true;
      return false;
    }
    runLocked(fn) {
      this.locks++;
      this.walking = false;
      return Promise.resolve().then(fn).catch((e) => R.Engine.reportError(e)).finally(() => { this.locks = Math.max(0, this.locks - 1); });
    }
    liftTo(to, frames) {
      return new Promise((res) => { this.liftAnim = { from: this.lift, to, t: 0, dur: Math.max(1, frames), resolve: res }; });
    }

    // ------------------------------------------------------------ movement
    startMove(d, nx, ny, kind, opts) {
      const o = opts || {};
      // hold B (or Shift) while moving to dash; "いつでもダッシュ" inverts it
      const dash = !!R.Settings.alwaysDash !== !!(R.Input.down('b') || R.Input.down('dash'));
      const dur = o.dur || (kind === 'sail' ? (dash ? SAIL_DASH : SAIL) : (dash ? DASH : WALK));
      const from = this.P.map((p) => ({ x: p.x, y: p.y }));
      if (kind === 'sail') {
        for (const p of this.P) { p.x = nx; p.y = ny; p.dir = d; }
        R.Game.ship = { map: M.id, x: nx, y: ny, dir: d };
      } else if (kind === 'land') {
        // everyone steps ashore together (followers are never left standing on the hull)
        for (const p of this.P) { p.x = nx; p.y = ny; p.dir = d; }
        R.Game.onShip = false; R.bgm(M.bgm);
      } else {
        for (let i = this.P.length - 1; i > 0; i--) {
          const a = this.P[i], b = this.P[i - 1];
          a.dir = dirTo(a, b) || a.dir;
          a.x = b.x; a.y = b.y;
        }
        this.P[0].x = nx; this.P[0].y = ny; this.P[0].dir = d;
      }
      this.mv = { t: 0, dur, from, kind, scripted: !!o.scripted, resolve: o.resolve || null };
    }
    bump() {
      if (this.bumpT <= 0) { R.sfx('bump'); this.bumpT = BUMP_EVERY; }
      return false;
    }
    /** try to step the leader in direction d; true if a move/warp started */
    tryMove(d) {
      const p = this.P[0];
      const nx = p.x + U.DX[d], ny = p.y + U.DY[d];
      p.dir = d;
      const g = R.Game;
      if (g.onShip) {
        if (g.ship) g.ship.dir = d;
        if (!M.inBounds(nx, ny) || M.npcAt(nx, ny)) return this.bump();
        if (M.sailable(nx, ny)) { this.startMove(d, nx, ny, 'sail'); return true; }
        if (M.walkable(nx, ny) && !M.chestAt(nx, ny) && !M.tile(nx, ny).lock) { this.startMove(d, nx, ny, 'land'); return true; }
        return this.bump();
      }
      if (!M.inBounds(nx, ny)) {
        const ex = M.exitFor(d);
        if (!ex) return this.bump();
        this.runLocked(() => Field.warp(ex.to, ex.spawn, { dir: ex.dir || d }));
        return true;
      }
      const sh = g.ship;
      if (sh && sh.map === M.id && sh.x === nx && sh.y === ny) { this.startMove(d, nx, ny, 'board'); return true; }
      if (!M.walkable(nx, ny) || M.npcAt(nx, ny) || M.chestAt(nx, ny)) return this.bump();
      const id = M.tileAt(nx, ny), t = M.tile(nx, ny);
      const i = M.idx(nx, ny);
      if (t.lock && !M.opened.has(i)) {
        if (!R.State.hasItem(t.lock)) {
          this.heldBlock = d; // don't repeat the message while the direction stays held
          this.runLocked(() => R.Events.run(async (ev) => { R.sfx('locked'); await ev.say('鍵がかかっている。'); }, { self: 'lock' }));
          return false;
        }
      }
      if (isDoor(id) && !M.opened.has(i)) { R.sfx('door'); openDoor(i, nx, ny, d); }
      this.startMove(d, nx, ny, 'walk');
      return true;
    }
    /** scripted single step (events): no triggers, ignores collisions */
    stepScripted(d, dur) {
      return new Promise((res) => {
        const p = this.P[0];
        this.startMove(d, p.x + U.DX[d], p.y + U.DY[d], R.Game.onShip ? 'sail' : 'walk', { scripted: true, resolve: res, dur: dur || SCRIPT_WALK });
      });
    }

    // ------------------------------------------------------------ arrival
    /** sync part of arriving on a tile; returns an async task when something must happen */
    onArrive(kind) {
      const g = R.Game;
      const p = this.P[0];
      g.steps = (g.steps || 0) + 1;
      this._fm = null;
      if (kind === 'board') {
        g.onShip = true;
        g.ship = { map: M.id, x: p.x, y: p.y, dir: p.dir };
        this.place(p.x, p.y, p.dir);
        R.sfx('ship');
        R.bgm('sea');
      }
      this.savePos();
      R.emit('step', M.id, p.x, p.y);
      const tasks = [];
      const t = M.tile(p.x, p.y);
      if (!g.onShip) {
        const fm = this.fieldMods();
        const fallen = [];
        if (t.damage > 0 && !fm.noFloorDamage) {
          for (const c of R.State.alive()) { c.hp = Math.max(0, c.hp - t.damage); if (c.hp <= 0) { c.status = {}; fallen.push(c); } }
          R.Engine.flashScreen('#ff2010', 8);
          R.sfx('step_damage');
        }
        let poisoned = false;
        for (const c of R.State.alive()) {
          if (c.status && c.status.poison) { poisoned = true; if (c.hp > 1) c.hp--; }
        }
        if (poisoned && !(t.damage > 0 && !fm.noFloorDamage)) R.Engine.flashScreen('#9020c0', 5);
        if (fm.walkHeal > 0) {
          for (const c of R.State.alive()) c.hp = Math.min(R.Rules.stats(c).hp, c.hp + fm.walkHeal);
        }
        if (!R.State.alive().length) return () => Field.gameOver();
        if (fallen.length) {
          tasks.push(() => R.Events.run(async (ev) => {
            R.sfx('death');
            for (const c of fallen) await ev.say(c.name + 'は力尽きた……');
          }, { self: 'floor' }));
        }
      }
      if (g.repelSteps > 0) {
        g.repelSteps--;
        if (g.repelSteps === 0) {
          tasks.push(() => R.Events.run(async (ev) => { await ev.say('魔除けの効果が切れた。'); }, { self: 'repel' }));
        }
      }
      // step events, then warps, then encounters
      const evs = M.eventsAt(p.x, p.y, 'step');
      if (evs.length) {
        const e = evs[0];
        tasks.push(() => R.Events.run(e.id, { self: e.id, trigger: 'step', once: e.once, x: p.x, y: p.y }));
        return seq(tasks);
      }
      const w = M.warpAt(p.x, p.y);
      if (w) { tasks.push(() => this.useWarp(w)); return seq(tasks); }
      if (!tasks.length) {
        const zone = this.encounterStep(t);
        if (zone) return () => Field.encounter(zone);
      }
      return tasks.length ? seq(tasks) : null;
    }
    /** advance the encounter counter; returns a zone id when a battle starts */
    encounterStep(t) {
      const g = R.Game;
      if (Field.noEncounter || g.repelSteps > 0) return null;
      const p = this.P[0];
      const zone = M.zoneAt(p.x, p.y);
      if (!zone) return null;
      const rate = t.enc == null ? 1 : t.enc;
      if (!(rate > 0)) return null;
      const mult = Math.max(0, 1 + (this.fieldMods().encounterPct || 0) / 100);
      this.encCount -= rate * mult;
      if (this.encCount > 0) return null;
      this.resetEnc();
      if (!DB.encounters[zone]) { R.FieldMap.warn(M.id, 'unknown encounter zone ' + zone); return null; }
      if (!R.Battle || !R.Battle.start) return null;
      return zone;
    }
    async useWarp(w) {
      const id = M.tileAt(this.P[0].x, this.P[0].y);
      if (w.sfx) R.sfx(w.sfx);
      else if (id === 'stairs_up' || id === 'stairs_down') R.sfx('stairs');
      else if (id === 'warp_pad') R.sfx('warp');
      await Field.warp(w.to, w.spawn, { dir: w.dir });
    }

    // ------------------------------------------------------------ A button
    examine() {
      const p = this.P[0], d = p.dir;
      const fx = p.x + U.DX[d], fy = p.y + U.DY[d];
      let npc = M.npcAt(fx, fy);
      if (!npc && M.counterAt(fx, fy)) npc = M.npcAt(fx + U.DX[d], fy + U.DY[d]);
      if (npc) return this.runLocked(() => this.talk(npc));
      const chest = M.chestAt(fx, fy);
      if (chest && !R.Game.chests[chest.id]) return this.runLocked(() => openChest(chest));
      const sign = M.signAt(fx, fy);
      if (sign) return this.runLocked(() => R.Events.run(async (ev) => { await ev.say(sign.text); }, { self: 'sign' }));
      for (const [x, y] of [[fx, fy], [p.x, p.y]]) {
        const evs = M.eventsAt(x, y, 'examine');
        if (evs.length) {
          const e = evs[0];
          return this.runLocked(() => R.Events.run(e.id, { self: e.id, trigger: 'examine', once: e.once, x, y }));
        }
        const h = M.hiddenAt(x, y);
        if (h) return this.runLocked(() => findHidden(h, x === p.x && y === p.y));
      }
      return null;
    }
    talk(npc) {
      if (npc.mv) { npc.mv = null; }
      if (!npc.sprite.startsWith('mon:') && !npc.fixedDir) npc.dir = U.opposite(this.P[0].dir);
      npc.ai = 90;
      return R.Events.talk(npc);
    }
    openMenu() {
      // no field lock: the menu sits on top (so update() pauses) and may call R.Field.* itself
      if (!R.Menu || !R.Menu.open) return;
      try { Promise.resolve(R.Menu.open()).catch((e) => R.Engine.reportError(e)); } catch (e) { R.Engine.reportError(e); }
    }

    // ------------------------------------------------------------ frame
    update() {
      if (!M || !R.Game) return;
      if (this.bumpT > 0) this.bumpT--;
      if (this.locks > 0 || R.Events.busy()) { this.walking = false; return; }
      if (this.mv) return;
      if (this.arrived) {
        const k = this.arrived;
        this.arrived = null;
        const task = this.onArrive(k);
        if (task) { this.runLocked(task); return; }
      }
      const In = R.Input;
      // Y opens the menu (B is held for dashing, so it no longer does)
      if (In.pressed('y')) { this.walking = false; this.openMenu(); return; }
      if (In.pressed('a')) { this.walking = false; this.examine(); return; }
      const d = In.dir();
      if (!d) { this.walking = false; this.bumpT = 0; this.heldBlock = null; return; }
      if (d === this.heldBlock) return;
      this.heldBlock = null;
      // walk on the very first frame a direction is held (no turn-in-place delay);
      // blocked directions just turn (so facing an NPC / shelf is still a tap)
      const turned = this.P[0].dir !== d;
      this.walking = this.tryMove(d);
      if (!this.walking && turned && !this.locks) this.savePos();
    }
    tick() {
      const g = R.Game;
      if (!g || !M) return;
      g.playFrames = (g.playFrames || 0) + 1;
      const mv = this.mv;
      if (mv) {
        mv.t++;
        this.clock += 8 / mv.dur;
        if (mv.t >= mv.dur) {
          this.mv = null;
          if (mv.scripted) { this.savePos(); if (mv.resolve) mv.resolve(); }
          else this.arrived = mv.kind;
        }
      } else this.clock += 0.5;
      this.tickNpcs(R.Engine.top() === this && this.locks === 0 && !R.Events.busy());
      const la = this.liftAnim;
      if (la) {
        la.t++;
        const k = la.t / la.dur;
        this.lift = la.from + (la.to - la.from) * (la.to < la.from ? k * k : 1 - (1 - k) * (1 - k));
        if (la.t >= la.dur) { this.lift = la.to; this.liftAnim = null; la.resolve(); }
      }
      if (this.banner && ++this.banner.t >= BANNER_FRAMES) this.banner = null;
      // a message (e.g. the opening speech) takes over: the map-name banner must not cover the speaker
      const msg = R.UI && R.UI._msg;
      if (this.banner && msg && !msg.closed && msg.resolveText && R.Engine.layers.includes(msg)) this.banner = null;
    }
    tickNpcs(ai) {
      for (const n of M.npcs) {
        if (!n.present) { if (n.path) finishPath(n); continue; }
        if (n.mv) {
          if (++n.mv.t >= n.mv.dur) { n.mv = null; if (n.path) nextPathStep(n); }
          continue;
        }
        if (n.path) { nextPathStep(n); continue; }
        if (!ai) continue;
        if (n.move === 'wander') this.wander(n);
        else if (n.move === 'spin') {
          if (n.ai == null) n.ai = U.ri(20, 60);
          if (--n.ai <= 0) { n.ai = U.ri(24, 56); n.dir = SPIN[n.dir] || 'down'; }
        }
      }
    }
    wander(n) {
      if (n.ai == null) n.ai = U.ri(30, 150);
      if (--n.ai > 0) return;
      n.ai = U.ri(50, 170);
      const d = U.pick(U.DIRS);
      n.dir = d;
      const nx = n.x + U.DX[d], ny = n.y + U.DY[d];
      if (Math.abs(nx - n.homeX) > 2 || Math.abs(ny - n.homeY) > 2) return;
      if (!this.npcCanEnter(nx, ny, n)) return;
      n.mv = { fx: n.x, fy: n.y, t: 0, dur: NPC_STEP };
      n.x = nx; n.y = ny;
    }
    npcCanEnter(x, y, n) {
      if (!M.walkable(x, y)) return false;
      const id = M.tileAt(x, y), t = M.tile(x, y);
      if (t.counter || t.damage || t.warpIcon || isDoor(id) || id.startsWith('stairs') || id === 'warp_pad') return false;
      // the party may cut across trees / benches / flowerbeds, townsfolk keep to open ground
      if (id === 'tree' || M.decorAt(x, y)) return false;
      if (M.warpAt(x, y) || M.chestAt(x, y) || M.eventIdx.has(M.idx(x, y)) || M.signAt(x, y)) return false;
      if (M.npcAt(x, y, n)) return false;
      for (const p of this.P) if (p.x === x && p.y === y) return false;
      if (this.mv) for (const f of this.mv.from) if (f.x === x && f.y === y) return false;
      const sh = R.Game.ship;
      if (sh && sh.map === M.id && sh.x === x && sh.y === y) return false;
      return true;
    }

    // ------------------------------------------------------------ drawing
    draw() {
      const G = R.Gfx;
      if (!M || !R.Game) { G.clear('#000'); return; }
      const cam = this.camera();
      drawTiles(cam.x, cam.y);
      this.drawObjects(cam);
      this.drawSprites(cam);
      if (this.banner) this.drawBanner();
      if (Field.showCoords) {
        const p = this.P[0];
        G.text(M.id + ' ' + p.x + ',' + p.y + (R.Game.onShip ? ' ship' : ''), 3, R.H - 11, { size: 8, color: G.C.yellow, shadow: true });
      }
    }
    inView(cam, px, py, pad) {
      return px > cam.x - pad && px < cam.x + R.W + pad && py > cam.y - pad && py < cam.y + R.H + pad;
    }
    drawObjects(cam) {
      const G = R.Gfx;
      if (M.chests.length) {
        const g = G.get('obj:chest');
        for (const c of M.chests) {
          if (!c.present || !this.inView(cam, c.x * TS, c.y * TS, 16)) continue;
          const img = Array.isArray(g) ? g[R.Game.chests[c.id] ? 1 : 0] || g[0] : g;
          blit(img, c.x * TS - cam.x, c.y * TS - cam.y);
        }
      }
      if (M.hidden.length && this.fieldMods().treasureSense) {
        const g = G.get('obj:sparkle');
        const f = Math.floor(R.Engine.frame / 8);
        for (const h of M.hidden) {
          if (R.Game.chests[h.id] || !R.State.check(h.cond) || !this.inView(cam, h.x * TS, h.y * TS, 16)) continue;
          const img = Array.isArray(g) ? g[f % g.length] : g;
          blit(img, h.x * TS - cam.x, h.y * TS - cam.y);
        }
      }
    }
    drawSprites(cam) {
      const G = R.Gfx;
      const list = [];
      const af = Math.floor(R.Engine.frame / 16);
      for (const n of M.npcs) {
        if (!n.present) continue;
        let x = n.x * TS, y = n.y * TS;
        if (n.mv) {
          const k = Math.min(1, (n.mv.t + (R.Engine.alpha || 0)) / n.mv.dur);
          x = q((n.mv.fx + (n.x - n.mv.fx) * k) * TS);
          y = q((n.mv.fy + (n.y - n.mv.fy) * k) * TS);
        }
        if (!this.inView(cam, x, y, 48)) continue;
        list.push({ y, pri: 1, x, npc: n });
      }
      const g = R.Game;
      const ship = g.ship && g.ship.map === M.id ? g.ship : null;
      if (ship) {
        const pos = g.onShip ? this.renderPos(0) : { x: ship.x * TS, y: ship.y * TS };
        list.push({ y: pos.y, pri: 0, x: pos.x, ship });
      }
      if (!g.onShip) {
        const mem = this.members();
        for (let i = mem.length - 1; i >= 0; i--) {
          const pos = this.renderPos(i);
          list.push({ y: pos.y, pri: 5 - i, x: pos.x, member: mem[i], i });
        }
      }
      list.sort((a, b) => a.y - b.y || a.pri - b.pri);
      const pf = Math.floor(this.clock / 8);
      for (const s of list) {
        const sx = s.x - cam.x, sy = s.y - cam.y;
        if (s.npc) {
          const n = s.npc;
          const spr = G.get(n.sprite);
          const moving = !!n.mv;
          const img = n.sprite.startsWith('mon:') ? (Array.isArray(spr) ? spr[af % spr.length] : spr) : sheetFrame(spr, n.dir, moving ? Math.floor(n.mv.t / 8) + n.seq : af + n.seq);
          if (img) {
            // battle-size monster art standing on the map is drawn at half size (bottom-aligned on its tile)
            const mon = n.sprite.startsWith('mon:') || n.sprite.startsWith('fieldmon:');
            const k = mon && img.height > 40 ? 0.5 : 1;
            const w = Math.round(img.width * k), h = Math.round(img.height * k);
            if (k === 1) blit(img, sx + 8 - (img.width >> 1), sy + TS - img.height);
            else blit(img, sx + 8 - (w >> 1), sy + TS - h + 1, { w, h });
          }
        } else if (s.ship) {
          const img = sheetFrame(G.get('obj:ship'), s.ship.dir || 'down', af);
          if (img) {
            const bob = g.onShip && Math.floor(R.Engine.frame / 24) % 2 ? 1 : 0;
            blit(img, sx + 8 - (img.width >> 1), sy + TS - img.height + Math.min(4, (img.height - TS) >> 2) + bob);
          }
        } else {
          const c = s.member;
          const img = sheetFrame(G.get('party:' + c.id + ':' + c.job), this.P[s.i].dir, pf);
          if (img) blit(img, sx + 8 - (img.width >> 1), sy + TS - img.height + Math.round(this.lift), c.hp > 0 ? null : { alpha: 0.5 });
        }
      }
    }
    drawBanner() {
      const G = R.Gfx, b = this.banner;
      const a = b.t < 10 ? b.t / 10 : BANNER_FRAMES - b.t < 16 ? (BANNER_FRAMES - b.t) / 16 : 1;
      const w = Math.ceil(G.textWidth(b.text)) + 28;
      const x = (R.W - w) >> 1, y = 10;
      const c = G.ctx;
      c.globalAlpha = a;
      G.window(x, y, w, 26);
      G.text(b.text, R.W / 2, y + 7, { align: 'center' });
      c.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ scripted NPC walks
  function parsePath(path) {
    if (Array.isArray(path)) return path.filter((d) => U.DX[d] !== undefined);
    const out = [];
    const MAP = { U: 'up', D: 'down', L: 'left', R: 'right' };
    const s = String(path || '').toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const d = MAP[s[i]];
      if (!d) continue;
      let n = '';
      while (i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9') n += s[++i];
      for (let k = 0; k < (n ? +n : 1); k++) out.push(d);
    }
    return out;
  }
  function nextPathStep(n) {
    if (!n.path || !n.path.length) return finishPath(n);
    const d = n.path.shift();
    n.dir = d;
    n.mv = { fx: n.x, fy: n.y, t: 0, dur: n.pathDur || NPC_STEP };
    n.x += U.DX[d]; n.y += U.DY[d];
  }
  function finishPath(n) {
    n.path = null;
    n.homeX = n.x; n.homeY = n.y;
    const r = n.pathResolve;
    n.pathResolve = null;
    if (r) r();
  }

  // ------------------------------------------------------------ chests & hidden items
  // message phrases are joined by R.Events.lines: a new line starts only where
  // the next phrase would overflow the window (long names break before the verb)
  const FULL = 'しかし、これ以上は持てない！';
  function openChest(c) {
    return R.Events.run(async (ev) => {
      const g = R.Game;
      const name = leaderName();
      const lines = R.Events.lines;
      const it = c.item && DB.items[c.item];
      if (it && R.State.count(c.item) + c.n > 99) {
        R.sfx('buzzer');
        await ev.say(lines('宝箱の中には', it.name + 'が入っている。') + '\n' + FULL);
        return;
      }
      R.sfx('chest');
      if (c.troop) {
        // mimic: the box stays shut unless the monster is beaten
        await ev.wait(10);
        await ev.say('なんと、宝箱は魔物だった！');
        if ((await ev.battle(c.troop)) !== 'win') return;
      }
      g.chests[c.id] = true;
      await ev.wait(10);
      const opened = name + 'は宝箱を開けた！\n';
      if (c.gold) {
        R.State.addGold(c.gold);
        R.sfx('gold');
        await ev.say(opened + c.gold + 'ゴールドを手に入れた！');
      } else if (it) {
        R.State.addItem(c.item, c.n);
        await ev.gotItem(opened + lines(...R.Events.gotPhrases(it.name, c.n, '手に入れた！')), it.type === 'key' ? 'keyitem' : 'item');
      } else {
        await ev.say(opened + 'しかし、空っぽだった！');
      }
    }, { self: c.id, chest: c });
  }
  function findHidden(h, underfoot) {
    return R.Events.run(async (ev) => {
      const name = leaderName();
      const lines = R.Events.lines;
      const look = name + 'は' + (underfoot ? '足元' : 'あたり') + 'を調べた。\n';
      if (h.gold) {
        R.Game.chests[h.id] = true;
        R.State.addGold(h.gold);
        R.sfx('gold');
        await ev.say(look + 'なんと、' + h.gold + 'ゴールドを見つけた！');
        return;
      }
      const it = DB.items[h.item];
      if (!it) { R.Game.chests[h.id] = true; return; }
      if (R.State.count(h.item) + h.n > 99) {
        await ev.say(look + lines('なんと、', it.name + 'を', '見つけた！') + '\n' + FULL);
        return;
      }
      R.Game.chests[h.id] = true;
      R.State.addItem(h.item, h.n);
      await ev.gotItem(look + lines('なんと、', ...R.Events.gotPhrases(it.name, h.n, '見つけた！')), it.type === 'key' ? 'keyitem' : 'item');
    }, { self: h.id, hidden: h });
  }

  /** an opened door is drawn as the floor beyond it (else the floor we came from) */
  function openDoor(i, x, y, d) {
    const bx = x + U.DX[d], by = y + U.DY[d], fx = x - U.DX[d], fy = y - U.DY[d];
    const ok = (tx, ty) => M.inBounds(tx, ty) && M.walkable(tx, ty) && !isDoor(M.tileAt(tx, ty)) && !M.tile(tx, ty).warpIcon;
    M.opened.set(i, ok(bx, by) ? M.tileAt(bx, by) : ok(fx, fy) ? M.tileAt(fx, fy) : 'floor');
    M.version++;
    (M.dirtyCells = M.dirtyCells || []).push({ v: M.version, x, y }); // the renderer patches just this cell
  }
  function seq(tasks) {
    return async () => { for (const t of tasks) await t(); };
  }

  // ------------------------------------------------------------ map loading
  function ensureLayer(fresh) {
    if (fresh && L) { R.Engine.remove(L); L = null; }
    if (!L) L = new FieldLayer();
    if (!R.Engine.layers.includes(L)) {
      R.Engine.layers.unshift(L); // the field always sits at the bottom of the stack
      L.closed = false;
      L.onPush();
    }
    return L;
  }
  function unlock(lay) { lay.locks = Math.max(0, lay.locks - 1); }
  function flushPaths(m) {
    if (m) for (const n of m.npcs) if (n.path || n.pathResolve) { n.path = []; finishPath(n); }
  }
  /** load a map and place the party (no fades, no events) */
  function load(mapId, spawn, dir) {
    const m = R.FieldMap.compile(mapId);
    if (!m) return false;
    flushPaths(M);
    if (L.mv && L.mv.resolve) L.mv.resolve();
    M = m;
    let s = m.spawn(spawn == null ? 'entrance' : spawn);
    if (!m.inBounds(s.x, s.y)) { R.FieldMap.warn(m.id, 'position ' + s.x + ',' + s.y + ' is outside the map'); s = m.spawn('entrance'); }
    L.place(s.x, s.y, dir || s.dir || L.P[0].dir);
    L.spawnName = typeof spawn === 'string' ? spawn : null;
    const g = R.Game;
    const sh = g.ship;
    g.onShip = !!(sh && sh.map === m.id && sh.x === s.x && sh.y === s.y && !m.walkable(s.x, s.y));
    if (g.onShip) sh.dir = L.P[0].dir;
    if (m.location) g.visited[m.location] = true;
    L.resetEnc();
    L._fm = null;
    L.banner = null;
    R.bgm(g.onShip ? 'sea' : m.bgm);
    L.savePos();
    R.emit('mapload', m.id);
    return true;
  }
  /** after the screen is visible: banner + onEnter event (queued, never awaited) */
  function afterEnter(prev) {
    if (!M) return;
    if (M.name && !M.isWorld && (!prev || prev.name !== M.name)) L.banner = { text: M.name, t: 0 };
    if (M.onEnter) R.Events.run(M.onEnter, { trigger: 'enter', self: M.id, onlyOnMap: M.id, defer: true });
  }

  // ------------------------------------------------------------ public API
  const Field = (R.Field = {
    noEncounter: false,
    showCoords: false,
    WALK, DASH,
    get map() { return M; },
    get layer() { return L; },

    /** entry point after title / new game */
    async start(mapId, spawn) {
      if (!R.Game) R.State.newGame();
      R.Events.reset();
      const lay = ensureLayer(true);
      lay.locks++;
      try {
        R.Engine.fade(1, 0);
        const st = R.State.START;
        if (!load(mapId || st.map, spawn != null ? spawn : mapId ? 'entrance' : st.spawn)) load(st.map, st.spawn);
        await R.Engine.fadeIn(24);
      } finally { unlock(lay); }
      afterEnter(null);
    },
    /** continue from R.Game.pos (after loading a save) */
    async resume() {
      R.Events.reset();
      const lay = ensureLayer(true);
      const pos = R.Game.pos || {};
      lay.locks++;
      try {
        R.Engine.fade(1, 0);
        const st = R.State.START;
        let ok = false;
        if (pos.map && DB.maps[pos.map]) ok = load(pos.map, pos.x != null ? { x: pos.x, y: pos.y, dir: pos.dir } : pos.spawn, pos.dir);
        if (!ok) load(st.map, st.spawn);
        await R.Engine.fadeIn(24);
      } finally { unlock(lay); }
      afterEnter(null);
    },
    /** warp(map, spawnName | {x,y}, {dir, fade=true}) */
    async warp(mapId, spawn, opts) {
      const o = opts || {};
      if (!DB.maps[mapId]) { R.warn('warp: unknown map', mapId); return false; }
      const lay = ensureLayer();
      const prev = M;
      lay.locks++;
      try {
        const fade = o.fade !== false;
        if (fade) await R.Engine.fadeOut(o.frames || 12);
        load(mapId, spawn, o.dir);
        if (fade) await R.Engine.fadeIn(o.frames || 12);
      } finally { unlock(lay); }
      afterEnter(prev);
      return true;
    },
    /** fly to a visited location (ability / wing): R.DB.locations[locId] */
    async teleport(locId) {
      const loc = DB.locations[locId];
      if (!loc) { R.warn('teleport: unknown location', locId); return false; }
      const mapId = loc.map || R.FieldMap.findWorld(loc.spawn);
      if (!DB.maps[mapId]) { R.warn('teleport: unknown map', mapId); return false; }
      const lay = ensureLayer();
      const prev = M;
      lay.locks++;
      try {
        const g = R.Game;
        if (g.onShip && M) { g.onShip = false; lay.place(lay.P[0].x, lay.P[0].y, 'down'); }
        R.sfx('teleport');
        await lay.liftTo(-(R.H + 40), 26);
        await R.Engine.fadeOut(10);
        if (g.ship && loc.dock) {
          const d = R.FieldMap.spawnPos(loc.dock, mapId);
          if (d) g.ship = { map: mapId, x: d.x, y: d.y, dir: g.ship.dir || 'down' };
        }
        load(mapId, loc.spawn, 'down');
        lay.lift = -(R.H + 40);
        await R.Engine.fadeIn(10);
        await lay.liftTo(0, 22);
      } finally { lay.lift = 0; unlock(lay); }
      // landing on a town / castle entrance tile enters it at once (no step off and back on)
      const p = lay.P[0];
      const w = M && !R.Game.onShip && M.warpAt(p.x, p.y);
      if (w && !M.eventsAt(p.x, p.y, 'step').length) { await lay.useWarp(w); return true; }
      afterEnter(prev);
      return true;
    },
    /** visited teleport targets [{id,name}] in R.DB.locations order */
    teleportList() {
      return Object.keys(DB.locations).filter((id) => R.Game.visited[id]).map((id) => ({ id, name: DB.locations[id].name }));
    },
    canExit() { return !!(M && M.escape && M.escape.to && DB.maps[M.escape.to]); },
    /** teleport works outdoors/in towns, not inside dungeons (map.noTeleport overrides) */
    canTeleport() {
      if (!M) return false;
      if (M.def.noTeleport != null) return !M.def.noTeleport;
      return M.type !== 'dungeon';
    },
    /** leave the dungeon (ability / escape_rope) */
    async exitDungeon() {
      if (!Field.canExit()) return false;
      const lay = ensureLayer();
      const e = M.escape;
      lay.locks++;
      try {
        R.sfx('warp');
        R.Engine.flashScreen('#ffffff', 14);
        await lay.liftTo(-12, 8);
        await lay.liftTo(0, 6);
      } finally { unlock(lay); }
      return Field.warp(e.to, e.spawn, { dir: e.dir || 'down', frames: 16 });
    },
    repel(steps) { R.Game.repelSteps = Math.max(R.Game.repelSteps || 0, steps | 0); },
    setRespawnHere() {
      if (!M || !L) return;
      const p = L.P[0];
      R.Game.respawn = { map: M.id, x: p.x, y: p.y, dir: p.dir };
    },
    /** warp to R.Game.respawn (after a wipe) */
    respawn() {
      const r = R.Game.respawn || { map: R.State.START.map, spawn: R.State.START.spawn };
      const map = DB.maps[r.map] ? r.map : R.State.START.map;
      R.Game.onShip = false;
      return Field.warp(map, r.x != null ? { x: r.x, y: r.y, dir: r.dir } : r.spawn, { dir: r.dir || 'down' });
    },
    /** re-evaluate NPC conds / tilePatches (after flags change) */
    refresh() { if (M) M.refresh(); },
    isBusy() { return !!L && (L.locks > 0 || !!L.mv) || R.Events.busy(); },

    /** battle backdrop for the current position */
    battleBg(zone) {
      if (!M) return 'grass';
      const enc = zone && DB.encounters[zone];
      if (M.isWorld) {
        const p = L.P[0];
        return M.tile(p.x, p.y).bbg || (enc && enc.bg) || 'grass';
      }
      if (M.bbg) return M.bbg;
      const th = M.theme && DB.themes[M.theme];
      return (th && th.bbg) || (enc && enc.bg) || 'cave';
    },
    /** random encounter in zone (default: the current position's zone) */
    async encounter(zone) {
      zone = zone || (M && L && M.zoneAt(L.P[0].x, L.P[0].y));
      if (!zone || !R.Battle || !R.Battle.start) return null;
      const lay = ensureLayer();
      lay.locks++;
      let res;
      try {
        res = await R.Battle.start({ zone, bg: Field.battleBg(zone) });
        if (res === 'lose') await Field.gameOver();
      } finally { unlock(lay); }
      return res;
    },
    /** wipe: game-over screen (menu owner) or plain recover + respawn */
    async gameOver() {
      if (R.GameOver && R.GameOver.run) await R.GameOver.run();
      else { R.State.wipeRecover(); await Field.respawn(); }
    },

    // ---- scripting hooks (events_runtime / debug)
    npc(id) { return M ? M.npc(id) : null; },
    walkNpc(n, path, dur) {
      const steps = parsePath(path);
      if (!n || !steps.length) return Promise.resolve();
      return new Promise((res) => {
        if (n.pathResolve) { const r = n.pathResolve; n.pathResolve = null; r(); }
        n.path = steps; n.pathDur = dur || NPC_STEP; n.pathResolve = res;
        if (!n.mv) nextPathStep(n);
      });
    },
    async walkParty(path, dur) {
      if (!L || !M) return;
      for (const d of parsePath(path)) await L.stepScripted(d, dur);
    },
    facePlayer(dir) {
      if (!L || !U.DX.hasOwnProperty(dir)) return;
      L.P[0].dir = dir;
      if (R.Game.onShip && R.Game.ship) R.Game.ship.dir = dir;
      if (M) L.savePos();
    },
    setPlayerPos(x, y, dir) {
      if (!L || !M) return;
      L.place(x, y, dir || L.P[0].dir);
      L.savePos();
    },
    /** leader tile position {x,y,dir} */
    pos() { return L ? Object.assign({}, L.P[0]) : null; },
    /** the tile in front of the leader */
    front() {
      if (!L) return null;
      const p = L.P[0];
      return { x: p.x + U.DX[p.dir], y: p.y + U.DY[p.dir] };
    },
    parsePath,
  });
})(window.RPG);
