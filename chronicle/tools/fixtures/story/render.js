// A19 story fixture (copied from the prologue fixture): whole-map renderer for visual checks (browser only).
//   RPG.storyShowMap(mapId, {flags:[..], tier, scale:2, pad:2, crop:{x,y,w,h}, grid:false, marks:true})
// Pauses the engine, resizes #screen to the map and draws tiles + decor + chests + NPCs
// exactly like the field does (R.Art.localTile / decorTile, bottom-aligned sprites).
// Never overrides anything that exists; it only adds RPG.storyShowMap.
(function (R) {
  'use strict';
  const TS = 16;
  function sheetFrame(g, dir, f) {
    if (!g) return null;
    if (g.getContext || g.width) return g;
    if (Array.isArray(g)) return g[f % g.length] || g[0];
    const a = g[dir] || g.down || g[Object.keys(g)[0]];
    if (Array.isArray(a)) return a[f % a.length] || a[0];
    return a || null;
  }
  function fakeGame(o) {
    const flags = {};
    for (const f of o.flags || []) flags[f] = true;
    const inv = {};
    for (const it of o.items || []) inv[it] = 1;
    const g = R.Game && !o.fresh ? R.Game : {};
    g.flags = Object.assign(g.flags || {}, flags);
    g.vars = g.vars || {};
    g.inv = Object.assign(g.inv || {}, inv);
    g.party = g.party || [];
    g.reserve = g.reserve || [];
    g.tier = o.tier || 0;
    g.regionsCleared = g.regionsCleared || [];
    while (g.regionsCleared.length < g.tier) g.regionsCleared.push('r' + g.regionsCleared.length);
    g.chests = g.chests || {};
    g.secrets = g.secrets || {};
    g.visited = g.visited || {};
    g.gameClear = !!o.postgame;
    R.Game = g;
    return g;
  }
  R.storyShowMap = function (id, o) {
    o = o || {};
    fakeGame(o);
    R.Engine.paused = true;
    const m = R.FieldMap.compile(id);
    if (!m) return 'no map ' + id;
    m.refresh();
    const pad = o.pad != null ? o.pad : 2;
    const cr = o.crop || { x: -pad, y: -pad, w: m.w + pad * 2, h: m.h + pad * 2 };
    const sc = o.scale || 2;
    const cv = document.getElementById('screen');
    cv.width = cr.w * TS * sc; cv.height = cr.h * TS * sc;
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    const off = R.Gfx.makeCanvas(cr.w * TS, cr.h * TS);
    const c = off.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000'; c.fillRect(0, 0, off.width, off.height);
    const G = R.Gfx;
    const tileGfx = (tid) => {
      if (tid === 'void' && !G.has('tile:void')) return null;
      if (m.theme && G.has('tile:' + m.theme + ':' + tid)) return G.get('tile:' + m.theme + ':' + tid);
      return G.has('tile:' + tid) ? G.get('tile:' + tid) : null;
    };
    const frame0 = (g) => (Array.isArray(g) ? g[0] : g);
    for (let y = cr.y; y < cr.y + cr.h; y++) {
      for (let x = cr.x; x < cr.x + cr.w; x++) {
        let g = null;
        if (!m.inBounds(x, y)) g = tileGfx(m.outside);
        else {
          try { g = R.Art && R.Art.localTile ? R.Art.localTile(m, x, y) : null; } catch (e) { console.warn('localTile', e); }
          if (!g) g = tileGfx(m.tileAt(x, y));
        }
        g = frame0(g);
        if (g) c.drawImage(g, (x - cr.x) * TS, (y - cr.y) * TS);
      }
    }
    if (m.decor) {
      for (let y = cr.y; y < cr.y + cr.h + 2; y++) {
        for (let x = cr.x - 1; x < cr.x + cr.w + 1; x++) {
          if (!m.inBounds(x, y) || !m.decorAt(x, y)) continue;
          let g = null;
          try { g = R.Art.decorTile ? R.Art.decorTile(m, x, y) : null; } catch (e) { console.warn('decorTile', e); }
          if (!g) g = G.get('decor:' + m.decorAt(x, y));
          g = frame0(g);
          if (g) c.drawImage(g, (x - cr.x) * TS + ((TS - g.width) >> 1), (y - cr.y) * TS + TS - g.height);
        }
      }
    }
    // chests
    for (const ch of m.chests) {
      if (!ch.present) continue;
      const key = ch.pool === 'p_rare' && G.has('obj:chest_rare') ? 'obj:chest_rare' : 'obj:chest';
      const g = G.get(key);
      const img = Array.isArray(g) ? g[0] : g;
      if (img) c.drawImage(img, (ch.x - cr.x) * TS, (ch.y - cr.y) * TS);
    }
    // sprites, y-sorted
    const list = m.npcs.filter((n) => n.present).sort((a, b) => a.y - b.y);
    for (const n of list) {
      let img = null;
      try {
        const spr = G.get(n.sprite);
        img = n.sprite.startsWith('mon:') ? (Array.isArray(spr) ? spr[0] : spr) : sheetFrame(spr, n.dir, 0);
      } catch (e) { console.warn('sprite', n.sprite, e); }
      if (!img) continue;
      const sx = (n.x - cr.x) * TS, sy = (n.y - cr.y) * TS;
      const mon = n.sprite.startsWith('mon:');
      const k = mon && img.height > 40 ? 0.5 : 1;
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      c.drawImage(img, sx + 8 - (w >> 1), sy + TS - h + (k === 1 ? 0 : 1), w, h);
    }
    // debug marks: spawns (cyan), warps (magenta), step events (yellow), examine events (orange), signs (green)
    if (o.marks !== false) {
      const box = (x, y, col, inset) => {
        c.strokeStyle = col; c.lineWidth = 1;
        c.strokeRect((x - cr.x) * TS + 0.5 + inset, (y - cr.y) * TS + 0.5 + inset, TS - 1 - inset * 2, TS - 1 - inset * 2);
      };
      for (const k in m.spawns) box(m.spawns[k].x, m.spawns[k].y, '#00ffff', 0);
      for (const w of m.warps) box(w.x, w.y, '#ff00ff', 1);
      for (const e of m.events) box(e.x, e.y, e.trigger === 'examine' ? '#ff9900' : '#ffff00', 2);
      for (const s of m.signs) box(s.x, s.y, '#00ff00', 3);
    }
    if (o.grid) {
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.font = '6px monospace';
      for (let x = Math.max(0, cr.x); x < Math.min(m.w, cr.x + cr.w); x += 5) c.fillText(String(x), (x - cr.x) * TS + 1, 7);
      for (let y = Math.max(0, cr.y); y < Math.min(m.h, cr.y + cr.h); y += 5) c.fillText(String(y), 1, (y - cr.y) * TS + 7);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
    return { w: m.w, h: m.h, npcs: m.npcs.filter((n) => n.present).length, chests: m.chests.length };
  };
})(window.RPG);

