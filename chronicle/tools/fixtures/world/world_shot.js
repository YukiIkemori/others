// Browser-side helper for looking at the whole world map with the real art (A18a).
// Built into debug_world.html by `node tools/build.js --with tools/fixtures/world`, then:
//   node tools/shot.js --html debug_world.html --eval "RPG.WorldShot.overview()" --out /tmp/w.png
//   --eval "RPG.WorldShot.view(30, 36)"                  64×56 cells from (30,36) at 16 px (wraps)
//   --eval "RPG.WorldShot.view(30, 36, {scale:2})"       32×28 cells at 32 px
//   --eval "RPG.WorldShot.overview({flags:['prologue_done','final_open'], cleared:['r_snow']})"
// The engine is paused and the canvas is drawn directly (1024×896 device px).
(function (R) {
  'use strict';
  function prep(o) {
    o = o || {};
    if (!R.Game && R.State && R.State.newGame) R.State.newGame();
    const g = R.Game;
    for (const f of o.flags || []) g.flags[f] = true;
    for (const id of o.cleared || []) {
      if (!g.regionsCleared.includes(id)) g.regionsCleared.push(id);
      g.flags['cleared_' + id] = true;
    }
    if (o.tier != null) {
      while (g.regionsCleared.length < o.tier) {
        const next = Object.keys(R.DB.regions).find((id) => !g.regionsCleared.includes(id));
        if (!next) break;
        g.regionsCleared.push(next); g.flags['cleared_' + next] = true;
      }
    }
    g.tier = g.regionsCleared.length;
    for (const k of o.secrets || []) (g.secrets = g.secrets || {})[k] = true;
    const m = R.FieldMap.compile('world');
    m.refresh();
    R.Engine.paused = true;
    const ctx = R.Gfx.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = o.smooth !== false && (o.px || 16) < 16;
    return { m, ctx };
  }
  function cell(m, x, y) {
    let g = R.Art.worldTile(m, m.wx(x), m.wy(y));
    if (Array.isArray(g)) g = g[0];
    return g;
  }
  function label(ctx, m, x0, y0, px, o) {
    if (!o.labels) return;
    ctx.font = (o.font || 10) + 'px monospace';
    for (const k in m.spawns) {
      const s = m.spawns[k];
      let dx = ((s.x - x0) % m.w + m.w) % m.w, dy = ((s.y - y0) % m.h + m.h) % m.h;
      if (dx * px > 1024 || dy * px > 896) continue;
      ctx.fillStyle = '#000';
      ctx.fillText(k, dx * px + px + 1, dy * px + px / 2 + 1);
      ctx.fillStyle = '#ffe070';
      ctx.fillText(k, dx * px + px, dy * px + px / 2);
    }
  }
  const WorldShot = {
    /** the whole world at 8 px per cell (128×112 → 1024×896) */
    overview(o) {
      o = Object.assign({ px: 8 }, o || {});
      const { m, ctx } = prep(o);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) ctx.drawImage(cell(m, x, y), x * o.px, y * o.px, o.px, o.px);
      if (o.chests) for (const c of m.chests) { ctx.strokeStyle = '#ff40ff'; ctx.strokeRect(c.x * o.px - 1, c.y * o.px - 1, o.px + 2, o.px + 2); }
      label(ctx, m, 0, 0, o.px, o);
      return { w: m.w, h: m.h, version: m.version };
    },
    /** a window of the world at full size: 64×56 cells at 16 px (scale 2: 32×28 at 32 px) */
    view(x0, y0, o) {
      o = Object.assign({ scale: 1 }, o || {});
      const px = 16 * o.scale;
      o.px = px;
      const { m, ctx } = prep(o);
      ctx.imageSmoothingEnabled = false;
      const cw = Math.ceil(1024 / px), ch = Math.ceil(896 / px);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) ctx.drawImage(cell(m, x0 + i, y0 + j), i * px, j * px, px, px);
      if (o.objects !== false) {
        for (const c of m.chests) {
          if (!c.present) continue;
          const i = ((c.x - x0) % m.w + m.w) % m.w, j = ((c.y - y0) % m.h + m.h) % m.h;
          if (i >= cw || j >= ch) continue;
          const key = c.pool === 'p_rare' && R.Gfx.has('obj:chest_rare') ? 'obj:chest_rare' : 'obj:chest';
          let img = R.Gfx.has(key) ? R.Gfx.get(key) : null;
          if (Array.isArray(img)) img = img[0];
          if (img) ctx.drawImage(img, i * px, j * px, px, px);
        }
      }
      label(ctx, m, x0, y0, px, o);
      return { x0, y0, cells: [cw, ch] };
    },
  };
  R.WorldShot = WorldShot;
})(window.RPG);
