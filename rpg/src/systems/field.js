// Field: the map screen (DESIGN §7.2). One opaque layer that draws tiles,
// objects and y-sorted sprites, moves the party tile by tile in 8 directions
// (caterpillar trail),
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

  // frames per tile (a diagonal step takes √2× that: same px/frame in every direction).
  // 16px / 6 = 2⅔ map px per frame = exactly 8 device px at the default field scale (3, see VIEW).
  const WALK = 6, DASH = 4, SAIL = 6, SAIL_DASH = 3, NPC_STEP = 16;
  const SCRIPT_WALK = 8; // cutscene party walks keep their original pacing
  const BUMP_EVERY = 20;
  // pushing an NPC (DESIGN §7.2): after PUSH_FRAMES of walking into it — or at once when pushed
  // again within PUSH_AGAIN frames — it side-steps (PUSH_STEP frames); a displaced standing NPC
  // heads back to its post PUSH_BACK frames later, when the party is not next to it
  const PUSH_FRAMES = 14, PUSH_AGAIN = 45, PUSH_STEP = 10, PUSH_BACK = 360;
  const BANNER_FRAMES = 130;
  const ANIM_RATE = { sea: 16, water: 16, lava: 24, magma: 24, poison: 24, wall_torch: 8, warp_pad: 8, barrier: 8, seal: 16 };
  const SPIN = { down: 'left', left: 'up', up: 'right', right: 'down' };

  // ------------------------------------------------------------ view (field zoom)
  // The field draws with its own scale on the R.SCALE× canvas: V.z device px
  // per map px (always an integer, so pixel art stays crisp), picked by
  // Settings.fieldZoom. UI layers (menus, messages, battle) keep R.SCALE.
  //   normal: 4 → 256x224 map px (16×14 tiles, the original framing)
  //   wide:   3 → 341⅓x298⅔ (≈21×19 tiles, default)
  //   wider:  2 → 512x448 (32×28 tiles)
  // Everything inside the field layer (camera, tile cache, sprites) works in
  // map px over the view V.w×V.h; overlays (banner, debug coords) switch back
  // to the UI transform.
  const ZOOM_DIV = { normal: 1, wide: 4 / 3, wider: 2 }; // view size ÷ the original 256x224
  const V = { key: '', z: 3, w: 0, h: 0, bw: 0, bh: 0, padx: 0, pady: 0 };
  function updateView() {
    let key = R.Settings && R.Settings.fieldZoom;
    if (!ZOOM_DIV[key]) key = 'wide';
    if (key === V.key && V.scale === R.SCALE) return V;
    const div = ZOOM_DIV[key];
    V.key = key; V.scale = R.SCALE;
    V.z = Math.max(1, Math.round(R.SCALE / div));
    V.w = R.W * R.SCALE / V.z; V.h = R.H * R.SCALE / V.z;
    V.bw = Math.ceil(V.w / TS) + 1; V.bh = Math.ceil(V.h / TS) + 1; // cells touched by the view (+ one partial cell)
    V.padx = Math.ceil(V.w / TS / 2) + 1; V.pady = Math.ceil(V.h / TS / 2) + 1; // "outside" cells a centred small map shows
    return V;
  }
  updateView();

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
  const WHOLE_MAX = 12000; // cells: cache the whole map when (w+2·V.padx)·(h+2·V.pady) fits
  const MARG = 3; // sliding window margin (cells) on each side of the view
  const CH = 8; // whole-map cache chunk (cells)
  const TC = { cv: null, ctx: null, spare: null, uid: -1, ver: -1, z: 0, x0: 0, y0: 0, w: 0, h: 0, whole: false, anim: [], danim: [], drawn: new Map() };
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
    if (m.wrap) { x = m.wx(x); y = m.wy(y); } // the art of a wrapped cell is the art of its original
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
    if (m.wrap) { x = m.wx(x); y = m.wy(y); }
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
  /** on a wrapping map: the copy of coordinate v (tiles) nearest to ref along axis 'w' | 'h' */
  function unwrap(m, v, ref, axis) {
    if (!m || !m.wrap) return v;
    const n = m[axis];
    return v + Math.round((ref - v) / n) * n;
  }
  /** the party position jumped by (sx,sy) whole map sizes (wrapping): move the cache window along,
   *  its pixels stay valid because the map repeats */
  function tcShift(sx, sy) {
    if (!TC.cv || TC.uid !== M.uid) return;
    TC.x0 += sx; TC.y0 += sy;
    for (const a of TC.anim) { a.x += sx; a.y += sy; }
    for (const a of TC.danim) { a.x += sx; a.y += sy; }
    const old = [...TC.drawn];
    TC.drawn.clear();
    for (const [k, f] of old) {
      const a = Math.abs(k), x = (a % 4096) - 1024 + sx, y = Math.floor(a / 4096) - 1024 + sy;
      TC.drawn.set(Math.sign(k) * cellKey(x, y), f);
    }
  }
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
    TC.uid = M.uid; TC.ver = M.version; TC.z = V.z;
    const W = M.w + 2 * V.padx, H = M.h + 2 * V.pady;
    TC.whole = !M.wrap && W * H <= WHOLE_MAX; // a wrapping map always slides (the camera never stops at an edge)
    if (TC.whole) { TC.x0 = -V.padx; TC.y0 = -V.pady; TC.w = W; TC.h = H; }
    else { TC.w = V.bw + 2 * MARG; TC.h = V.bh + 2 * MARG; TC.x0 = ox - MARG; TC.y0 = oy - MARG; }
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
    const ci1 = Math.min(TC.cw - 1, Math.floor((ox + V.bw - TC.x0) / CH)), cj1 = Math.min(TC.chh - 1, Math.floor((oy + V.bh + 2 - TC.y0) / CH));
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
  /** slide the window so the view (ox,oy)+(V.bw,V.bh) sits in its middle, redrawing only exposed strips */
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
    const x0 = m.wrap ? TC.x0 - WARM : Math.max(0, TC.x0 - WARM), y0 = m.wrap ? TC.y0 - WARM : Math.max(0, TC.y0 - WARM);
    const x1 = m.wrap ? TC.x0 + TC.w + WARM : Math.min(m.w - 1, TC.x0 + TC.w + WARM), y1 = m.wrap ? TC.y0 + TC.h + WARM : Math.min(m.h - 1, TC.y0 + TC.h + WARM);
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
  /** true when every pixel of a tile frame is opaque (then a redraw needs no black underlay) */
  function isOpaque(img) {
    if (!img) return false;
    if (img._opaque !== undefined) return img._opaque;
    let op = false;
    try {
      const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
      op = img.width >= TS && img.height >= TS;
      for (let i = 3; op && i < d.length; i += 4) if (d[i] !== 255) op = false;
    } catch (e) { op = false; }
    return (img._opaque = op);
  }
  // Animated cells whose frame changed are redrawn top to bottom, at most
  // ANIM_MAX per frame: on the wide views a whole sea changes frame at once
  // (~1000 cells at 'wider'); spread over a few frames that is a quick sweep
  // instead of a frame-time spike.
  const ANIM_MAX = 280;
  /** redraw the animated cells near the view whose frame changed */
  function tcAnimate(ox, oy) {
    const m = M, c = TC.ctx;
    const vx0 = ox - 1, vy0 = oy - 1, vx1 = ox + V.bw, vy1 = oy + V.bh + 2;
    let budget = ANIM_MAX;
    for (const a of TC.anim) {
      if (a.x < vx0 || a.y < vy0 || a.x > vx1 || a.y > vy1) continue;
      const g = cellGfx(m, a.x, a.y);
      if (!Array.isArray(g)) continue;
      const f = frameOf(g, tileRate(m, a.x, a.y)), k = cellKey(a.x, a.y);
      if (TC.drawn.get(k) === f) continue;
      if (budget-- <= 0) break;
      const lx = (a.x - TC.x0) * TS, ly = (a.y - TC.y0) * TS;
      if (a.plain) {
        const im = g[f];
        if (!isOpaque(im)) { c.fillStyle = '#000'; c.fillRect(lx, ly, TS, TS); }
        if (im) c.drawImage(im, lx, ly);
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
    if (TC.uid !== M.uid || !TC.cv || TC.z !== V.z) tcRebuild(ox, oy);
    else if (TC.ver !== M.version) {
      // doors opened on this visit patch single cells; anything else redraws everything
      const dirty = (M.dirtyCells || []).filter((d) => d.v > TC.ver && d.v <= M.version);
      if (dirty.length === M.version - TC.ver) {
        TC.ver = M.version;
        for (const d of dirty) {
          const lx = (unwrap(M, d.x, TC.x0 + TC.w / 2, 'w') - TC.x0) * TS, ly = (unwrap(M, d.y, TC.y0 + TC.h / 2, 'h') - TC.y0) * TS;
          if (lx >= 0 && ly >= 0 && lx < TC.w * TS && ly < TC.h * TS) redrawRect(lx, ly, TS, TS);
        }
      } else tcRebuild(ox, oy);
    }
    if (TC.whole) { if (TC.left) tcFill(ox, oy, 0); }
    else if (ox < TC.x0 || oy < TC.y0 || ox + V.bw > TC.x0 + TC.w || oy + V.bh > TC.y0 + TC.h) tcSlide(ox, oy);
    tcAnimate(ox, oy);
    // copy just the visible part of the cache (whole-pixel source rect, sub-pixel destination)
    const ix = Math.floor(camX), iy = Math.floor(camY);
    const sx = ix - TC.x0 * TS, sy = iy - TC.y0 * TS;
    const w = Math.min(Math.ceil(V.w) + 1, TC.cv.width - sx), h = Math.min(Math.ceil(V.h) + 1, TC.cv.height - sy);
    if (sx < 0 || sy < 0 || w <= 0 || h <= 0) { blit(TC.cv, TC.x0 * TS - camX, TC.y0 * TS - camY); return false; }
    R.Gfx.ctx.drawImage(TC.cv, sx, sy, w, h, q(ix - camX), q(iy - camY), w, h);
    // spare time: build the rest of the map cache / the art around the window
    if (TC.whole) { if (TC.left) tcFill(ox, oy, 1); }
    else warmArt(1);
    return w >= V.w + 1 && h >= V.h + 1; // the view is fully painted (the destination starts within 1px left/above)
  }
  /** draw at a sub-pixel position: map px quantised to device px (the field draws at V.z device px per map px) */
  const q = (v) => Math.round(v * V.z) / V.z;
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
  // Movement (DESIGN §7.2): the leader's collision box is one tile (16×16)
  // anchored at P[0].x/y, in tile units, and always stops on whole tiles
  // (the old half-tile grid / corner assist were dropped at the owner's request:
  // 「半歩ずれるのがストレス」). Each move is one whole tile in up to 8 directions;
  // a diagonal needs all three tiles of the swept 2×2 square free (no corner
  // cutting), otherwise the party walks one whole tile along the free axis (the
  // most recently pressed one first) or stops.
  //
  // Tile-based rules use `cell`, the leader's logical tile (= the box position
  // once a step has ended). Step events, warps, stairs, damage floors and the
  // saved position fire / are taken when `cell` changes — once per tile entered.
  // Encounters, poison, walk-heal and 魔除け count the distance walked
  // (a diagonal counts √2).
  const STEP = 1;
  const EPS = 1e-6;
  const GAP = 1; // follower spacing along the leader's path (tiles)
  const isInt = (v) => Math.abs(v - Math.round(v)) < EPS;
  const HORIZ = { left: 1, right: 1 };
  const dirOf = (dx, dy) => (dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : dy < 0 ? 'up' : null);
  /** cells [x,y] touched by the 1×1 boxes at (x0,y0) and (x1,y1) and everything between */
  function rectCells(x0, y0, x1, y1) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1) + 1, ay = Math.min(y0, y1), by = Math.max(y0, y1) + 1;
    const out = [];
    for (let cy = Math.floor(ay + EPS); cy < by - EPS; cy++) for (let cx = Math.floor(ax + EPS); cx < bx - EPS; cx++) out.push([cx, cy]);
    return out;
  }
  /** does the 1×1 box at (bx,by) overlap cell (cx,cy)? */
  const boxHits = (bx, by, cx, cy) => bx < cx + 1 - EPS && bx + 1 > cx + EPS && by < cy + 1 - EPS && by + 1 > cy + EPS;

  class FieldLayer extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.P = [0, 1, 2].map(() => ({ x: 0, y: 0, dir: 'down' })); // P[0] = leader box (tile units, whole tiles between steps)
      this.cell = { x: 0, y: 0 }; // the leader's logical tile (see above)
      this.trail = [{ x: 0, y: 0 }]; // leader positions, newest first (caterpillar path)
      this.mv = null; // party move {t,dur,from,kind,len,scripted,resolve}
      this.arrived = null; // the move that just completed {kind,dist,changed} (processed in update)
      this.carry = 0; // frames left over from the move that just ended (keeps chained steps exact)
      this.walked = 0; // tiles walked since the last whole step (poison / 魔除け / walk-heal)
      this.shipPos = null; // exact ship position this visit {x,y,ref} (saves keep the whole tile)
      this.locks = 0; // >0 while warping / processing a step / in battle
      this.walking = false; // a step is chained (no idle frame between steps)
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
    place(x, y, dir, cell) {
      if (M && M.wrap) {
        // keep the logical tile inside the map
        const c0 = cell || { x: Math.round(x), y: Math.round(y) };
        const sx = c0.x - M.wx(c0.x), sy = c0.y - M.wy(c0.y);
        x -= sx; y -= sy;
        cell = { x: c0.x - sx, y: c0.y - sy };
      }
      for (const p of this.P) { p.x = x; p.y = y; if (dir) p.dir = dir; }
      this.cell = cell ? { x: cell.x, y: cell.y } : { x: Math.round(x), y: Math.round(y) };
      this.trail = [{ x, y }];
      this.mv = null; this.arrived = null; this.walking = false; this.carry = 0; this.last = null;
    }
    savePos() {
      const c = this.cell;
      R.Game.pos = { map: M.id, x: c.x, y: c.y, dir: this.P[0].dir, spawn: this.spawnName };
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
    /** leader position (tiles) at fraction `a` of the current fixed step */
    leadAt(a) {
      const p = this.P[0], mv = this.mv;
      const at = (m, t) => { const k = U.clamp(t / m.dur, 0, 1); return { x: m.from.x + (m.to.x - m.from.x) * k, y: m.from.y + (m.to.y - m.from.y) * k }; };
      a = a || 0;
      // a step ends up to one frame early (see tick): until its real end time the previous step is still drawn
      // (`back`: the point lies on the segment before trail[0])
      if (mv) return mv.t + a < 0 && mv.prev ? Object.assign(at(mv.prev, mv.prev.dur + mv.t + a), { back: 1 }) : at(mv, mv.t + a);
      const l = this.last;
      if (l && l.t + a < 0) return Object.assign(at(l.mv, l.mv.dur + l.t + a), { back: 1 });
      return { x: p.x, y: p.y };
    }
    /** follower i: the point GAP·i back along the leader's path from `lead`, facing its motion */
    followerAt(i, lead) {
      const keep = this.P[i].dir;
      if (this.mv && this.mv.kind === 'land') return { x: lead.x, y: lead.y, dir: this.P[0].dir };
      let need = GAP * i, a = lead;
      for (let j = lead.back ? 1 : 0; j < this.trail.length; j++) {
        const b = this.trail[j];
        const dx = a.x - b.x, dy = a.y - b.y, len = Math.hypot(dx, dy);
        if (len < EPS) continue;
        if (len >= need - EPS) {
          const ax = Math.abs(dx), ay = Math.abs(dy);
          let dir = ax > ay + EPS ? dirOf(dx, 0) : ay > ax + EPS ? dirOf(0, dy) : null;
          if (!dir) dir = keep === dirOf(dx, 0) || keep === dirOf(0, dy) ? keep : dirOf(dx, 0); // diagonal: keep a matching facing
          const k = need / len;
          return { x: a.x - dx * k, y: a.y - dy * k, dir };
        }
        need -= len;
        a = b;
      }
      return { x: a.x, y: a.y, dir: keep }; // the path is shorter (just placed): wait at its start
    }
    /** drawn position (px) of party member i. Between fixed steps the move is
     *  advanced by Engine.alpha so motion follows real time on any refresh rate;
     *  values are quantised to device pixels (1/V.z px), never to whole pixels. */
    renderPos(i) {
      const lead = this.leadAt(R.Engine.alpha || 0);
      const p = i ? this.followerAt(i, lead) : lead;
      return { x: q(p.x * TS), y: q(p.y * TS), dir: i ? p.dir : this.P[0].dir };
    }
    /** move the followers to their trail points (fixed step) */
    syncFollowers() {
      const lead = this.mv ? this.leadAt(0) : { x: this.P[0].x, y: this.P[0].y };
      for (let i = 1; i < this.P.length; i++) { const f = this.followerAt(i, lead); Object.assign(this.P[i], f); }
    }
    /** top-left of the view in map px (quantised to device px); the view is V.w×V.h */
    camera() {
      updateView();
      const lp = this.renderPos(0);
      let cx = lp.x + 8 - V.w / 2, cy = lp.y + 8 - V.h / 2;
      const mw = M.w * TS, mh = M.h * TS;
      if (M.wrap) return { x: q(cx), y: q(cy) }; // follows the party everywhere (the map repeats)
      cx = mw <= V.w ? Math.floor((mw - V.w) / 2) : U.clamp(cx, 0, mw - V.w);
      cy = mh <= V.h ? Math.floor((mh - V.h) / 2) : U.clamp(cy, 0, mh - V.h);
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
    aligned() { return isInt(this.P[0].x) && isInt(this.P[0].y); }
    /** the ship's exact position on this map {x,y} or null */
    shipXY() {
      const sh = R.Game.ship;
      if (!sh || !M || sh.map !== M.id) return null;
      const s = this.shipPos;
      const at = s && s.ref === sh ? s : { x: sh.x, y: sh.y };
      if (!M.wrap) return at;
      // the copy nearest to the party (the ship may sit just across the seam)
      const p = this.P[0];
      return { x: unwrap(M, at.x, p.x, 'w'), y: unwrap(M, at.y, p.y, 'h'), ref: at.ref };
    }
    /** does any party box (or the leader's move origin) overlap cell (x,y)? */
    partyOn(x, y) {
      const hit = (bx, by) => boxHits(bx, by, unwrap(M, x, bx, 'w'), unwrap(M, y, by, 'h'));
      for (const p of this.P) if (hit(p.x, p.y)) return true;
      return !!(this.mv && hit(this.mv.from.x, this.mv.from.y));
    }
    /** wrapping maps: keep the logical tile inside [0,w)×[0,h) — when a step ends past an edge,
     *  every position (party, trail, the step being drawn, logical tile, cache window) moves by a
     *  whole map size, so nothing visible changes (the camera follows the same relative path) */
    rewrap(mv) {
      if (!M || !M.wrap) return;
      const c = this.cell;
      const sx = c.x < 0 ? M.w : c.x >= M.w ? -M.w : 0, sy = c.y < 0 ? M.h : c.y >= M.h ? -M.h : 0;
      if (!sx && !sy) return;
      const mvp = (o) => { if (o) { o.x += sx; o.y += sy; } };
      for (const q of this.P) mvp(q);
      for (const t of this.trail) mvp(t);
      mvp(this.cell);
      const moves = new Set();
      for (const m of [mv, this.mv, this.last && this.last.mv]) if (m) { moves.add(m); if (m.prev) moves.add(m.prev); }
      for (const m of moves) { mvp(m.from); mvp(m.to); }
      const g = R.Game;
      if (this.shipPos && g.onShip) mvp(this.shipPos);
      tcShift(sx, sy);
    }

    // ------------------------------------------------------------ movement
    /** on foot: null if the leader's box may cover (x,y); else 'out' | 'lock' | 'wall' */
    footBlock(x, y) {
      if (!M.inBounds(x, y)) return 'out';
      if (!M.walkable(x, y) || M.npcAt(x, y) || M.chestAt(x, y)) return 'wall';
      const t = M.tile(x, y);
      if (t.lock && !M.opened.has(M.idx(x, y)) && !R.State.hasItem(t.lock)) return 'lock';
      return null;
    }
    sailOk(x, y) { return M.sailable(x, y) && !M.npcAt(x, y); }
    /** what a one-tile step by (dx,dy) from (fx,fy) would do:
     *  {kind:'walk'|'sail'|'land'|'board', x, y} | {kind:'exit', ex} | {kind:'lock'} | null (blocked) */
    plan(dx, dy, fx, fy) {
      const p = this.P[0], g = R.Game;
      if (fx == null) { fx = p.x; fy = p.y; }
      const tx = fx + dx * STEP, ty = fy + dy * STEP;
      // only the cells the box moves into (never stuck on a tile it already covers, e.g. after setPos)
      const cells = rectCells(fx, fy, tx, ty).filter(([x, y]) => !boxHits(fx, fy, x, y));
      if (g.onShip) {
        if (cells.every(([x, y]) => this.sailOk(x, y))) return { kind: 'sail', x: tx, y: ty };
        if (dx && dy) return null;
        // step ashore: the box leaves the hull for the land beyond (a whole tile from an aligned ship)
        const lx = dx ? (isInt(fx) ? fx + dx : tx) : fx, ly = dy ? (isInt(fy) ? fy + dy : ty) : fy;
        const land = rectCells(lx, ly, lx, ly);
        if (land.every(([x, y]) => !this.footBlock(x, y) && !M.tile(x, y).lock)) return { kind: 'land', x: lx, y: ly };
        return null;
      }
      if (cells.some(([x, y]) => !M.inBounds(x, y))) {
        if (dx && dy) return null;
        const ex = M.exitFor(dirOf(dx, dy));
        return ex ? { kind: 'exit', ex } : null;
      }
      const sh = this.shipXY();
      if (sh && Math.abs(tx - sh.x) < 1 - EPS && Math.abs(ty - sh.y) < 1 - EPS) return { kind: 'board', x: sh.x, y: sh.y };
      let lock = false;
      for (const [x, y] of cells) {
        const b = this.footBlock(x, y);
        if (b === 'lock') lock = true;
        else if (b) return null;
      }
      if (lock) return { kind: 'lock' };
      const doors = cells.filter(([x, y]) => isDoor(M.tileAt(x, y)) && !M.opened.has(M.idx(x, y)));
      return { kind: 'walk', x: tx, y: ty, doors };
    }
    /** carry out a plan; true if the party moves / warps */
    exec(pl, face) {
      if (pl.kind === 'exit') {
        const ex = pl.ex;
        this.P[0].dir = face;
        this.runLocked(() => Field.warp(ex.to, ex.spawn, { dir: ex.dir || face }));
        return true;
      }
      if (pl.doors && pl.doors.length) {
        R.sfx('door');
        for (const [x, y] of pl.doors) openDoor(M.idx(x, y), x, y, face);
      }
      this.startMove(pl.kind, pl.x, pl.y, face);
      return true;
    }
    startMove(kind, nx, ny, d, opts) {
      const o = opts || {};
      const p = this.P[0], g = R.Game;
      const from = { x: p.x, y: p.y };
      const len = Math.hypot(nx - p.x, ny - p.y);
      // hold B (or Shift) while moving to dash; "いつでもダッシュ" inverts it
      const dash = !!R.Settings.alwaysDash !== !!(R.Input.down('b') || R.Input.down('dash'));
      const perTile = o.dur || (kind === 'sail' ? (dash ? SAIL_DASH : SAIL) : (dash ? DASH : WALK));
      const dur = Math.max(1, perTile * Math.max(len, EPS));
      if (kind === 'land') {
        // everyone steps ashore together (followers are never left standing on the hull)
        this.shipPos = { x: from.x, y: from.y, ref: g.ship };
        g.onShip = false; R.bgm(M.bgm);
      }
      p.x = nx; p.y = ny;
      if (d) p.dir = d;
      if (g.onShip && g.ship) g.ship.dir = p.dir;
      const chained = !o.scripted && this.carryF === R.Engine.frame && this.last;
      const t = chained ? this.carry : 0;
      this.carry = 0;
      this.mv = { t, dur, from, to: { x: nx, y: ny }, kind, len, prev: chained ? this.last.mv : null, scripted: !!o.scripted, resolve: o.resolve || null };
      this.last = null;
    }
    /** the fixed step reached its end: commit the logical tile, the trail and the ship */
    commit(mv) {
      const p = this.P[0], g = R.Game, c = this.cell;
      const was = c.x + ',' + c.y;
      if (mv.kind === 'board') { c.x = unwrap(M, g.ship.x, p.x, 'w'); c.y = unwrap(M, g.ship.y, p.y, 'h'); }
      else { if (isInt(p.x)) c.x = Math.round(p.x); if (isInt(p.y)) c.y = Math.round(p.y); }
      this.rewrap(mv);
      if (mv.kind === 'land') this.trail = [{ x: p.x, y: p.y }];
      else {
        this.trail.unshift({ x: p.x, y: p.y });
        let len = 0;
        for (let i = 1; i < this.trail.length; i++) {
          len += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
          if (len > GAP * (this.P.length - 1) + 1) { this.trail.length = i + 1; break; }
        }
      }
      if (g.onShip && mv.kind !== 'board') {
        g.ship = { map: M.id, x: c.x, y: c.y, dir: p.dir };
        this.shipPos = { x: p.x, y: p.y, ref: g.ship };
      }
      return was !== c.x + ',' + c.y;
    }
    bump() {
      if (this.bumpT <= 0) { R.sfx('bump'); this.bumpT = BUMP_EVERY; }
      return false;
    }
    lockedMsg(d) {
      this.heldBlock = d; // don't repeat the message while the direction stays held
      this.runLocked(() => R.Events.run(async (ev) => { R.sfx('locked'); await ev.say('鍵がかかっている。'); }, { self: 'lock' }));
      return false;
    }
    /** held directions → one whole-tile step (8 directions; a blocked diagonal walks along the free axis); true if moving */
    tryMove(hx, vy, last) {
      const p = this.P[0];
      const hd = dirOf(hx, 0), vd = dirOf(0, vy);
      const movable = (pl) => pl && pl.kind !== 'lock';
      if (hx && vy) {
        const pd = this.plan(hx, vy);
        if (movable(pd)) return this.exec(pd, p.dir === hd || p.dir === vd ? p.dir : last);
        // blocked diagonal: one whole tile along whichever axis is free (the most recently pressed one first), else stop
        const order = HORIZ[last] ? [[hx, 0, hd], [0, vy, vd]] : [[0, vy, vd], [hx, 0, hd]];
        for (const [dx, dy, d] of order) {
          const pl = this.plan(dx, dy);
          if (movable(pl)) return this.exec(pl, d);
        }
        p.dir = last;
        return this.bump();
      }
      const d = hd || vd;
      p.dir = d;
      if (R.Game.onShip && R.Game.ship) R.Game.ship.dir = d;
      const pl = this.plan(hx, vy);
      if (movable(pl)) return this.exec(pl, d);
      if (pl && pl.kind === 'lock') return this.lockedMsg(d);
      const pushed = this.pushNpc(d);
      if (pushed) return pushed === true; // 'aside': the NPC is stepping out of the way (no bump)
      return this.bump();
    }

    // ------------------------------------------------------------ pushing NPCs aside
    /** the pushable NPC that alone blocks a step toward d (null if a wall is in the way too) */
    npcAhead(d) {
      if (R.Game.onShip) return null;
      const p = this.P[0], tx = p.x + U.DX[d] * STEP, ty = p.y + U.DY[d] * STEP;
      let npc = null;
      for (const [x, y] of rectCells(p.x, p.y, tx, ty)) {
        if (boxHits(p.x, p.y, x, y)) continue;
        const n = M.npcAt(x, y);
        if (n) { if (npc && npc !== n) return null; npc = n; continue; }
        if (this.footBlock(x, y)) return null;
      }
      return npc && !npc.mv && !npc.path && R.FieldMap.pushable(npc) ? npc : null;
    }
    /** held direction d is blocked: count the push → true (swapped: the party moves) | 'aside' | false */
    pushNpc(d) {
      const npc = this.npcAhead(d), f = R.Engine.frame;
      if (!npc) { this.push = null; return false; }
      let pu = this.push;
      if (!pu || pu.npc !== npc || pu.d !== d || f - pu.last > 1) {
        // a fresh push; a quick second push (released and pressed again) moves it at once
        const again = !!(pu && pu.npc === npc && pu.d === d && f - pu.last <= PUSH_AGAIN);
        pu = this.push = { npc, d, n: 0, last: f, again };
      }
      pu.n++; pu.last = f;
      if (pu.n < PUSH_FRAMES && !(pu.again && pu.n >= 2)) return false;
      this.push = null;
      return this.shove(npc, d);
    }
    /** move npc one tile out of the way: sideways first (the side the party's box leaves free), then
     *  straight ahead; if it cannot move anywhere, it swaps places with the leader */
    shove(npc, d) {
      const p = this.P[0], hz = !!HORIZ[d];
      const off = hz ? p.y - npc.y : p.x - npc.x; // the box hangs toward this side of the NPC
      let side = hz ? ['up', 'down'] : ['left', 'right'];
      if (off > EPS) side = side.reverse(); // the box is lower / further right: dodge up / left
      else if (!(off < -EPS) && U.rng() < 0.5) side = side.reverse();
      for (const nd of side.concat([d])) {
        const nx = npc.x + U.DX[nd], ny = npc.y + U.DY[nd];
        if (!this.npcCanEnter(nx, ny, npc)) continue;
        this.npcStep(npc, nx, ny, nd, PUSH_STEP);
        if (!npc.move || npc.move === 'still' || npc.move === 'spin') npc.backT = PUSH_BACK;
        npc.ai = U.ri(90, 150);
        return 'aside'; // the leader stays put this frame; the way opens as the NPC steps aside
      }
      // boxed in: trade places (only from a whole tile, straight at the NPC)
      const c = this.cell, dx = U.DX[d], dy = U.DY[d];
      if (!this.aligned() || M.wx(c.x + dx) !== npc.x || M.wy(c.y + dy) !== npc.y) return false;
      if (M.warpAt(c.x, c.y) || M.eventsAt(c.x, c.y, 'step').length || isDoor(M.tileAt(c.x, c.y))) return false;
      this.npcStep(npc, M.wx(c.x), M.wy(c.y), U.opposite(d), WALK);
      if (!npc.move || npc.move === 'still' || npc.move === 'spin') npc.backT = PUSH_BACK;
      npc.ai = U.ri(90, 150);
      this.startMove('walk', p.x + dx, p.y + dy, d);
      return true;
    }
    npcStep(n, nx, ny, dir, dur) {
      n.mv = { fx: n.x, fy: n.y, t: 0, dur };
      n.x = nx; n.y = ny;
      if (!n.fixedDir) n.dir = dir;
    }
    /** a displaced standing NPC walks back to its post (never next to the party) */
    npcReturn(n) {
      if (n.backT == null || --n.backT > 0) return;
      if (n.x === n.homeX && n.y === n.homeY) { n.backT = null; if (!n.fixedDir) n.dir = n.dir0; return; }
      n.backT = 60;
      const c = this.cell;
      const opts = [];
      if (n.x !== n.homeX) opts.push(n.homeX > n.x ? 'right' : 'left');
      if (n.y !== n.homeY) opts.push(n.homeY > n.y ? 'down' : 'up');
      for (const d of opts) {
        const nx = n.x + U.DX[d], ny = n.y + U.DY[d];
        if (Math.abs(M.wx(nx) - c.x) + Math.abs(M.wy(ny) - c.y) <= 1) continue;
        if (!this.npcCanEnter(nx, ny, n, true)) continue;
        this.npcStep(n, nx, ny, d, NPC_STEP);
        n.backT = 1; // keep going next frame (after the step)
        return;
      }
    }
    /** scripted single tile step (events): no triggers, ignores collisions */
    stepScripted(d, dur) {
      return new Promise((res) => {
        const p = this.P[0];
        this.startMove(R.Game.onShip ? 'sail' : 'walk', p.x + U.DX[d], p.y + U.DY[d], d, { scripted: true, resolve: res, dur: dur || SCRIPT_WALK });
      });
    }
    /** scripted: glide onto the logical tile first (events move the party on whole tiles) */
    alignScripted(dur) {
      if (this.aligned()) return Promise.resolve();
      return new Promise((res) => {
        const p = this.P[0], c = this.cell;
        this.startMove(R.Game.onShip ? 'sail' : 'walk', c.x, c.y, p.dir, { scripted: true, resolve: res, dur: dur || SCRIPT_WALK });
      });
    }

    // ------------------------------------------------------------ arrival
    /** sync part of a completed step; returns an async task when something must happen */
    onArrive(a) {
      const g = R.Game;
      const p = this.P[0], c = this.cell;
      this._fm = null;
      if (a.kind === 'board') {
        g.onShip = true;
        this.shipPos = { x: p.x, y: p.y, ref: g.ship };
        g.ship.dir = p.dir;
        this.place(p.x, p.y, p.dir, c);
        R.sfx('ship');
        R.bgm('sea');
      }
      this.savePos();
      if (a.changed) R.emit('step', M.id, c.x, c.y);
      // distance-based effects: one "step" per whole tile walked
      this.walked += a.dist;
      let whole = 0;
      while (this.walked >= 1 - EPS) { this.walked -= 1; whole++; }
      g.steps = (g.steps || 0) + whole;
      const tasks = [];
      const t = M.tile(c.x, c.y);
      if (!g.onShip && (whole || a.changed)) {
        const fm = this.fieldMods();
        const fallen = [];
        const hurt = a.changed && t.damage > 0 && !fm.noFloorDamage;
        if (hurt) {
          for (const m of R.State.alive()) { m.hp = Math.max(0, m.hp - t.damage); if (m.hp <= 0) { m.status = {}; fallen.push(m); } }
          R.Engine.flashScreen('#ff2010', 8);
          R.sfx('step_damage');
        }
        let poisoned = false;
        for (let k = 0; k < whole; k++) {
          for (const m of R.State.alive()) {
            if (m.status && m.status.poison) { poisoned = true; if (m.hp > 1) m.hp--; }
          }
          if (fm.walkHeal > 0) for (const m of R.State.alive()) m.hp = Math.min(R.Rules.stats(m).hp, m.hp + fm.walkHeal);
        }
        if (poisoned && !hurt) R.Engine.flashScreen('#9020c0', 5);
        if (!R.State.alive().length) return () => Field.gameOver();
        if (fallen.length) {
          tasks.push(() => R.Events.run(async (ev) => {
            R.sfx('death');
            for (const m of fallen) await ev.say(m.name + 'は力尽きた……');
          }, { self: 'floor' }));
        }
      }
      for (let k = 0; k < whole && g.repelSteps > 0; k++) {
        g.repelSteps--;
        if (g.repelSteps === 0) {
          tasks.push(() => R.Events.run(async (ev) => { await ev.say('魔除けの効果が切れた。'); }, { self: 'repel' }));
        }
      }
      // step events, then warps (once per tile entered; the box glides onto the tile first), then encounters
      if (a.changed || a.kind === 'align') {
        const evs = M.eventsAt(c.x, c.y, 'step');
        const w = !evs.length && M.warpAt(c.x, c.y);
        if ((evs.length || w) && !this.aligned()) {
          // pending: the triggers run when the glide ends ('align' arrival); damage/poison already applied
          this.startMove('align', c.x, c.y, p.dir);
          return tasks.length ? seq(tasks) : null;
        }
        if (evs.length) {
          const e = evs[0];
          tasks.push(() => R.Events.run(e.id, { self: e.id, trigger: 'step', once: e.once, x: c.x, y: c.y }));
          return seq(tasks);
        }
        if (w) { tasks.push(() => this.useWarp(w)); return seq(tasks); }
      }
      if (!tasks.length && a.dist > 0) {
        const zone = this.encounterStep(t, a.dist);
        if (zone) return () => Field.encounter(zone);
      }
      return tasks.length ? seq(tasks) : null;
    }
    /** advance the encounter counter by `dist` tiles walked; returns a zone id when a battle starts */
    encounterStep(t, dist) {
      const g = R.Game;
      if (Field.noEncounter) return null;
      const c = this.cell;
      const zone = M.zoneAt(c.x, c.y);
      if (!zone) return null;
      // 気配消し / 魔除けの香 only keep away monsters the party has outgrown (DQ せいすい rule)
      if (g.repelSteps > 0 && this.repelBlocks(zone)) return null;
      const rate = t.enc == null ? 1 : t.enc;
      if (!(rate > 0)) return null;
      const mult = Math.max(0, 1 + (this.fieldMods().encounterPct || 0) / 100);
      this.encCount -= rate * mult * (dist == null ? 1 : dist);
      if (this.encCount > 0) return null;
      this.resetEnc();
      if (!DB.encounters[zone]) { R.FieldMap.warn(M.id, 'unknown encounter zone ' + zone); return null; }
      if (!R.Battle || !R.Battle.start) return null;
      return zone;
    }
    /** repel works only once the party's average level has reached the top of the zone's level band */
    repelBlocks(zone) {
      const z = DB.encounters[zone];
      if (!z || z.lv == null) return true;
      const top = Array.isArray(z.lv) ? z.lv[z.lv.length - 1] : z.lv; // the top of the zone's band
      const alive = (R.Game.party || []).filter((c) => c.hp > 0);
      if (!alive.length) return true;
      const avg = alive.reduce((n, c) => n + c.level, 0) / alive.length;
      return avg >= top;
    }
    async useWarp(w) {
      const id = M.tileAt(this.cell.x, this.cell.y);
      if (w.sfx) R.sfx(w.sfx);
      else if (id === 'stairs_up' || id === 'stairs_down') R.sfx('stairs');
      else if (id === 'warp_pad') R.sfx('warp');
      await Field.warp(w.to, w.spawn, { dir: w.dir });
    }

    // ------------------------------------------------------------ A button
    /** cells right in front of the box (the first whole tiles past its leading edge; two when it straddles) */
    frontCells() {
      const p = this.P[0], d = p.dir, c = this.cell;
      const out = [];
      if (HORIZ[d]) {
        const fx = d === 'right' ? Math.ceil(p.x + 1 - EPS) : Math.floor(p.x + EPS) - 1;
        out.push([fx, c.y]);
        if (!isInt(p.y)) out.push([fx, c.y === Math.floor(p.y) ? c.y + 1 : c.y - 1]);
      } else {
        const fy = d === 'down' ? Math.ceil(p.y + 1 - EPS) : Math.floor(p.y + EPS) - 1;
        out.push([c.x, fy]);
        if (!isInt(p.x)) out.push([c.x === Math.floor(p.x) ? c.x + 1 : c.x - 1, fy]);
      }
      return out;
    }
    examine() {
      const p = this.P[0], d = p.dir;
      const front = this.frontCells();
      for (const [fx, fy] of front) {
        let npc = M.npcAt(fx, fy);
        if (!npc && M.counterAt(fx, fy)) npc = M.npcAt(fx + U.DX[d], fy + U.DY[d]);
        if (npc) return this.runLocked(() => this.talk(npc));
      }
      for (const [fx, fy] of front) {
        const chest = M.chestAt(fx, fy);
        if (chest && !R.Game.chests[chest.id]) return this.runLocked(() => openChest(chest));
      }
      for (const [fx, fy] of front) {
        const sign = M.signAt(fx, fy);
        if (sign) return this.runLocked(() => R.Events.run(async (ev) => { await ev.say(sign.text); }, { self: 'sign' }));
      }
      const own = rectCells(p.x, p.y, p.x, p.y).sort((a, b) => (a[0] === this.cell.x && a[1] === this.cell.y ? -1 : b[0] === this.cell.x && b[1] === this.cell.y ? 1 : 0));
      const under = new Set(own.map(([x, y]) => x + ',' + y));
      for (const [x, y] of front.concat(own)) {
        const evs = M.eventsAt(x, y, 'examine');
        if (evs.length) {
          const e = evs[0];
          return this.runLocked(() => R.Events.run(e.id, { self: e.id, trigger: 'examine', once: e.once, x, y }));
        }
        const h = M.hiddenAt(x, y);
        if (h) return this.runLocked(() => findHidden(h, under.has(x + ',' + y)));
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
      if (this.locks > 0 || R.Events.busy()) { this.walking = false; this.carry = 0; return; }
      if (this.mv) return;
      if (this.arrived) {
        const a = this.arrived;
        this.arrived = null;
        const task = this.onArrive(a);
        if (task) { this.carry = 0; this.runLocked(task); return; }
        if (this.mv) return; // gliding onto a warp / event tile
      }
      const In = R.Input;
      // Y opens the menu (B is held for dashing, so it no longer does)
      if (In.pressed('y')) { this.walking = false; this.carry = 0; this.openMenu(); return; }
      if (In.pressed('a')) { this.walking = false; this.carry = 0; this.examine(); return; }
      const last = In.dir();
      if (!last) { this.walking = false; this.carry = 0; this.bumpT = 0; this.heldBlock = null; return; }
      // held axes (opposite keys: the most recently pressed wins)
      const axis = (neg, pos) => {
        const a = In.down(neg), b = In.down(pos);
        if (a && b) return last === neg ? -1 : last === pos ? 1 : 0;
        return a ? -1 : b ? 1 : 0;
      };
      const hx = axis('left', 'right'), vy = axis('up', 'down');
      if (last === this.heldBlock && !(hx && vy)) { this.carry = 0; return; }
      this.heldBlock = null;
      // walk on the very first frame a direction is held (no turn-in-place delay);
      // blocked directions just turn (so facing an NPC / shelf is still a tap)
      const d0 = this.P[0].dir;
      this.walking = this.tryMove(hx, vy, last);
      if (!this.walking) this.carry = 0;
      if (!this.walking && d0 !== this.P[0].dir && !this.locks) this.savePos();
    }
    tick() {
      const g = R.Game;
      if (!g || !M) return;
      g.playFrames = (g.playFrames || 0) + 1;
      const mv = this.mv;
      if (mv) {
        mv.t++;
        this.clock += (8 * mv.len) / mv.dur; // one walk frame per tile
        // a move ends on the tick after which it would overshoot (t > dur − 1): the next step then
        // starts at t − dur ∈ (−1, 0], so the drawn position (t + alpha) never stalls or jumps at a
        // step boundary even when a step lasts a fractional number of frames (diagonals, sail dash)
        if (mv.t > mv.dur - 1 + EPS) {
          this.mv = null;
          mv.prev = null;
          this.last = { mv, t: mv.t - mv.dur };
          const changed = this.commit(mv);
          if (mv.scripted) { this.savePos(); if (mv.resolve) mv.resolve(); }
          else {
            this.carry = Math.min(0, mv.t - mv.dur); this.carryF = R.Engine.frame;
            this.arrived = { kind: mv.kind, dist: mv.kind === 'board' || mv.kind === 'align' ? 0 : mv.len, changed };
          }
        }
        this.syncFollowers();
      } else {
        this.clock += 0.5;
        if (this.last && ++this.last.t > -EPS) this.last = null;
      }
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
        if (n.backT != null && n.move !== 'wander') { this.npcReturn(n); if (n.mv) continue; }
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
      if (!this.npcCanEnter(nx, ny, n, true)) return;
      n.mv = { fx: n.x, fy: n.y, t: 0, dur: NPC_STEP };
      n.x = nx; n.y = ny;
    }
    /** may npc n step onto (x,y)? `own`: a move of its own (wandering / walking home) — then it
     *  also never takes the leader's last free ways out (so townsfolk cannot box the party in) */
    npcCanEnter(x, y, n, own) {
      if (!M.inMap(x, y) || !M.walkable(x, y)) return false; // NPCs never cross a wrapping map's seam
      const id = M.tileAt(x, y), t = M.tile(x, y);
      if (t.counter || t.damage || t.warpIcon || isDoor(id) || id.startsWith('stairs') || id === 'warp_pad') return false;
      // the party may cut across trees / benches / flowerbeds, townsfolk keep to open ground
      if (id === 'tree' || M.decorAt(x, y)) return false;
      if (M.warpAt(x, y) || M.chestAt(x, y) || M.eventIdx.has(M.idx(x, y)) || M.signAt(x, y)) return false;
      if (M.npcAt(x, y, n)) return false;
      if (this.partyOn(x, y)) return false;
      const sh = this.shipXY();
      if (sh && boxHits(sh.x, sh.y, unwrap(M, x, sh.x, 'w'), unwrap(M, y, sh.y, 'h'))) return false;
      if (own && this.wouldTrap(x, y, n)) return false;
      return true;
    }
    /** would npc n standing on (x,y) leave the leader fewer than two free neighbouring tiles
     *  (or none, where there was only one to begin with)? */
    wouldTrap(x, y, n) {
      const c = this.cell;
      if (Math.abs(M.wx(x) - c.x) + Math.abs(M.wy(y) - c.y) !== 1 && !this.partyOn(x, y)) return false;
      const free = (tx, ty, blockTarget) => {
        if (blockTarget && M.wx(tx) === M.wx(x) && M.wy(ty) === M.wy(y)) return false;
        if (!M.walkable(tx, ty) || M.chestAt(tx, ty)) return false;
        const o = M.npcAt(tx, ty, n);
        return !o;
      };
      let before = 0, after = 0;
      for (const d of U.DIRS) {
        const tx = c.x + U.DX[d], ty = c.y + U.DY[d];
        if (free(tx, ty, false)) before++;
        if (free(tx, ty, true)) after++;
      }
      return after < Math.min(2, before);
    }

    // ------------------------------------------------------------ drawing
    draw() {
      const G = R.Gfx;
      if (!M || !R.Game) { G.clear('#000'); return; }
      updateView();
      // map px → V.z device px (keeps the engine's shake offset, which is in UI px)
      const c = G.ctx, k = V.z / R.SCALE;
      c.save();
      c.scale(k, k);
      const cam = this.camera();
      this.coversScreen = drawTiles(cam.x, cam.y); // next frame the engine may skip its clear
      this.drawObjects(cam);
      this.drawSprites(cam);
      c.restore();
      // overlays in UI px
      if (this.banner) this.drawBanner();
      if (Field.showCoords) {
        const p = this.P[0], c = this.cell;
        G.text(M.id + ' ' + c.x + ',' + c.y + (this.aligned() ? '' : ' (' + p.x + ',' + p.y + ')') + (R.Game.onShip ? ' ship' : ''), 3, R.H - 11, { size: 8, color: G.C.yellow, shadow: true });
      }
    }
    inView(cam, px, py, pad) {
      return px > cam.x - pad && px < cam.x + V.w + pad && py > cam.y - pad && py < cam.y + V.h + pad;
    }
    /** px position of an object at tile (x,y): on a wrapping map the copy nearest the view's centre */
    objPx(cam, x, y) {
      if (!M.wrap) return { x: x * TS, y: y * TS };
      return { x: unwrap(M, x, (cam.x + V.w / 2) / TS, 'w') * TS, y: unwrap(M, y, (cam.y + V.h / 2) / TS, 'h') * TS };
    }
    drawObjects(cam) {
      const G = R.Gfx;
      if (M.chests.length) {
        const g = G.get('obj:chest');
        for (const c of M.chests) {
          if (!c.present) continue;
          const o = this.objPx(cam, c.x, c.y);
          if (!this.inView(cam, o.x, o.y, 16)) continue;
          const img = Array.isArray(g) ? g[R.Game.chests[c.id] ? 1 : 0] || g[0] : g;
          blit(img, o.x - cam.x, o.y - cam.y);
        }
      }
      if (M.hidden.length && this.fieldMods().treasureSense) {
        const g = G.get('obj:sparkle');
        const f = Math.floor(R.Engine.frame / 8);
        for (const h of M.hidden) {
          if (R.Game.chests[h.id] || !R.State.check(h.cond)) continue;
          const o = this.objPx(cam, h.x, h.y);
          if (!this.inView(cam, o.x, o.y, 16)) continue;
          const img = Array.isArray(g) ? g[f % g.length] : g;
          blit(img, o.x - cam.x, o.y - cam.y);
        }
      }
    }
    drawSprites(cam) {
      const G = R.Gfx;
      const list = [];
      const af = Math.floor(R.Engine.frame / 16);
      for (const n of M.npcs) {
        if (!n.present) continue;
        const o = this.objPx(cam, n.x, n.y);
        let x = o.x, y = o.y;
        if (n.mv) {
          const k = Math.min(1, (n.mv.t + (R.Engine.alpha || 0)) / n.mv.dur);
          x = q(x + (n.mv.fx - n.x) * (1 - k) * TS);
          y = q(y + (n.mv.fy - n.y) * (1 - k) * TS);
        }
        if (!this.inView(cam, x, y, 48)) continue;
        list.push({ y, pri: 1, x, npc: n });
      }
      const g = R.Game;
      const ship = g.ship && g.ship.map === M.id ? g.ship : null;
      if (ship) {
        const sp = this.shipXY();
        const pos = g.onShip ? this.renderPos(0) : { x: q(sp.x * TS), y: q(sp.y * TS) };
        list.push({ y: pos.y, pri: 0, x: pos.x, ship });
      }
      if (!g.onShip) {
        const mem = this.members();
        for (let i = mem.length - 1; i >= 0; i--) {
          const pos = this.renderPos(i);
          list.push({ y: pos.y, pri: 5 - i, x: pos.x, member: mem[i], i, dir: pos.dir });
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
          const img = sheetFrame(G.get('party:' + c.id + ':' + c.job), s.dir, pf);
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
  /** a saved position → whole tiles. Saves from the old half-tile movement may hold x.5 values:
   *  take the nearest of the (up to 4) surrounding tiles the party can stand on (or the ship's tile). */
  function snapPos(m, pos) {
    const x = +pos.x || 0, y = +pos.y || 0, out = { x: Math.round(x), y: Math.round(y), dir: pos.dir };
    if (isInt(x) && isInt(y)) return pos;
    const sh = R.Game.ship;
    const cand = [];
    for (const cx of [...new Set([Math.floor(x), Math.ceil(x)])]) {
      for (const cy of [...new Set([Math.floor(y), Math.ceil(y)])]) cand.push({ x: cx, y: cy, d: Math.hypot(cx - x, cy - y) + (cx === out.x && cy === out.y ? 0 : 1e-3) });
    }
    cand.sort((a, b) => a.d - b.d);
    const ok = (c) => m.inBounds(c.x, c.y) && ((m.walkable(c.x, c.y) && !m.npcAt(c.x, c.y) && !m.chestAt(c.x, c.y)) ||
      (sh && sh.map === m.id && sh.x === c.x && sh.y === c.y));
    const hit = cand.find(ok);
    return hit ? { x: hit.x, y: hit.y, dir: pos.dir } : out;
  }
  /** load a map and place the party (no fades, no events) */
  function load(mapId, spawn, dir) {
    const m = R.FieldMap.compile(mapId);
    if (!m) return false;
    flushPaths(M);
    if (L.mv && L.mv.resolve) L.mv.resolve();
    M = m;
    let s = m.spawn(spawn == null ? 'entrance' : spawn && typeof spawn === 'object' && spawn.x != null ? snapPos(m, spawn) : spawn);
    if (!m.inBounds(s.x, s.y)) { R.FieldMap.warn(m.id, 'position ' + s.x + ',' + s.y + ' is outside the map'); s = m.spawn('entrance'); }
    L.place(s.x, s.y, dir || s.dir || L.P[0].dir);
    L.shipPos = null; L.walked = 0;
    L.spawnName = typeof spawn === 'string' ? spawn : null;
    const g = R.Game;
    const sh = g.ship;
    g.onShip = !!(sh && sh.map === m.id && sh.x === s.x && sh.y === s.y && !m.walkable(s.x, s.y));
    if (g.onShip) sh.dir = L.P[0].dir;
    if (m.location) g.visited[m.location] = true;
    else if (m.type === 'dungeon') { const loc = R.State.dungeonLocation(m.def); if (loc) g.visited[loc] = true; }
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
    WALK, DASH, SAIL, SAIL_DASH,
    get map() { return M; },
    get layer() { return L; },
    ZOOMS: Object.keys(ZOOM_DIV),
    /** current field view {zoom, z (device px per map px), w, h (map px)} — follows Settings.fieldZoom */
    view() { updateView(); return { zoom: V.key, z: V.z, w: V.w, h: V.h }; },
    /** top-left of the view in map px (null off the field) */
    camera() { return L && M && R.Game ? L.camera() : null; },

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
        if (g.onShip && M) { g.onShip = false; lay.place(lay.cell.x, lay.cell.y, 'down'); }
        R.sfx('teleport');
        await lay.liftTo(-(V.h + 40), 26);
        await R.Engine.fadeOut(10);
        if (g.ship && loc.dock) {
          const d = R.FieldMap.spawnPos(loc.dock, mapId);
          if (d) g.ship = { map: mapId, x: d.x, y: d.y, dir: g.ship.dir || 'down' };
        }
        load(mapId, loc.spawn, 'down');
        lay.lift = -(V.h + 40);
        await R.Engine.fadeIn(10);
        await lay.liftTo(0, 22);
      } finally { lay.lift = 0; unlock(lay); }
      // landing on a town / castle entrance tile enters it at once (no step off and back on)
      const p = lay.cell;
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
      const p = L.cell;
      R.Game.respawn = { map: M.id, x: p.x, y: p.y, dir: L.P[0].dir };
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
        const p = L.cell;
        return M.tile(p.x, p.y).bbg || (enc && enc.bg) || 'grass';
      }
      if (M.bbg) return M.bbg;
      const th = M.theme && DB.themes[M.theme];
      return (th && th.bbg) || (enc && enc.bg) || 'cave';
    },
    /** random encounter in zone (default: the current position's zone) */
    async encounter(zone) {
      zone = zone || (M && L && M.zoneAt(L.cell.x, L.cell.y));
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
      await L.alignScripted(dur); // events move the party on whole tiles
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
      L.place(Math.round(x), Math.round(y), dir || L.P[0].dir);
      L.savePos();
    },
    /** leader tile position {x,y,dir}: the logical tile (whole tiles; see the layer's `cell`) */
    pos() { return L ? { x: L.cell.x, y: L.cell.y, dir: L.P[0].dir } : null; },
    /** exact leader box position {x,y,dir} in tiles (whole tiles except mid-step) */
    exactPos() { return L ? { x: L.P[0].x, y: L.P[0].y, dir: L.P[0].dir } : null; },
    /** the tile in front of the leader (the first of frontCells) */
    front() {
      if (!L) return null;
      const [x, y] = L.frontCells()[0];
      return { x, y };
    },
    parsePath,
  });
})(window.RPG);
