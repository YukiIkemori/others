// chars5 — hand-authored pixel sprites (string grids + palette keys) for the hero アルン, 5 variants.
// No procedural rig: every pixel is placed in the data files (v1.js … v5.js). This file only
//   · parses the grids, builds frames (breathing, walk steps as leg overlays),
//   · paints a sprite canvas from a palette,
//   · derives the lamp-lit night version (cool ambient + warm key from one side + cool rim),
//   · measures a frame against STYLE_REFERENCE (height, colours, outline darkness).
'use strict';
(function (G) {
  const VAR = (G.VARIANTS = G.VARIANTS || {});
  const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);

  // HSV (h in degrees, s/v 0..1) → hex
  function hsv(h, s, v) {
    h = ((h % 360) + 360) % 360; const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
  }
  // ramp helper: list of [h,s,v] → hex list (dark → light)
  const ramp = (list) => list.map((a) => hsv(a[0], a[1], a[2]));
  function rgbToHsv(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }

  // ---------------------------------------------------------------- grids
  // A view: { rows: [...], walk?: [{y, rows}], walkB?: [{y, rows}], waist, neck, anchor?:[x,y] }
  // grid chars: '.' transparent, anything else a palette key. In overlays '_' = keep.
  function grid(rows) {
    const w = Math.max(...rows.map((r) => r.length));
    return { w, h: rows.length, px: rows.map((r) => r.padEnd(w, '.').split('')) };
  }
  const clone = (g) => ({ w: g.w, h: g.h, px: g.px.map((r) => r.slice()) });
  function overlay(g, patch, mirror) {
    const o = clone(g);
    patch.rows.forEach((row, i) => {
      const y = patch.y + i; if (y < 0 || y >= o.h) return;
      let r = ('_'.repeat(patch.x || 0) + row).padEnd(o.w, '_').split('').slice(0, o.w);
      if (mirror) r = r.reverse();
      r.forEach((ch, x) => { if (ch !== '_') o.px[y][x] = ch; });
    });
    return o;
  }
  // breathing: rows [0, to) move down by `d` px (the moved block overlays the row it lands on)
  function sink(g, to, d) {
    d = d || 1; const o = clone(g);
    for (let y = to - 1 + d; y >= 0; y--) {
      const src = y - d;
      for (let x = 0; x < g.w; x++) {
        const s = src >= 0 && src < to ? g.px[src][x] : '.';
        if (y < to) o.px[y][x] = s;
        else if (s !== '.') o.px[y][x] = s; // landing row: overlay
      }
    }
    return o;
  }
  function shift(g, dx, dy) {
    const o = { w: g.w, h: g.h, px: g.px.map((r) => r.map(() => '.')) };
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const sx = x - dx, sy = y - dy; if (sx >= 0 && sy >= 0 && sx < g.w && sy < g.h) o.px[y][x] = g.px[sy][sx]; }
    return o;
  }
  // stamp layers {x, y, rows} (later on top, '.' transparent) into a w×h grid → rows
  function compose(w, h, layers, tag) {
    const px = Array.from({ length: h }, () => new Array(w).fill('.'));
    layers.forEach((L, li) => L.rows.forEach((r, i) => {
      if (L.w && r.length !== L.w) console.warn(`${tag || ''} layer ${li} row ${i} len ${r.length} != ${L.w}`);
      r.split('').forEach((ch, j) => { const x = (L.x || 0) + j, y = (L.y || 0) + i; if (ch !== '.' && x >= 0 && y >= 0 && x < w && y < h) px[y][x] = ch; });
    }));
    return px.map((r) => r.join(''));
  }
  // check that every row of a full-width grid has the same length
  function check(rows, tag) { const w = rows[0].length; rows.forEach((r, i) => { if (r.length !== w) console.warn(`${tag} row ${i}: len ${r.length} != ${w}  "${r}"`); }); return rows; }
  const flipG = (g) => ({ w: g.w, h: g.h, px: g.px.map((r) => r.slice().reverse()) });

  // frames of one variant: { key: {g, ox, oy, lightSide, lamp:[x,y]|null} }
  function frames(V) {
    const out = {};
    const add = (k, g, view, extra) => {
      const a = view.anchor || [Math.floor(g.w / 2), g.h];
      out[k] = Object.assign({ g, ox: a[0], oy: a[1], view }, extra || {});
    };
    for (const name of ['down', 'side', 'up', 'battle']) {
      const view = V.views[name]; if (!view) continue;
      const g0 = grid(view.rows);
      view._g = g0;
      if (name === 'battle') {
        add('battle0', g0, view);
        add('battle1', sink(g0, view.neck, 1), view);
        add('battle2', sink(g0, view.waist, 1), view);
        if (view.extra) for (const k in view.extra) add('battle_' + k, grid(view.extra[k].rows), Object.assign({}, view, view.extra[k]));
      } else {
        add(name + '0', g0, view);
        if (view.walk) add(name + '1', overlay(g0, view.walk), view);
        if (view.walkB) add(name + '2', overlay(g0, view.walkB), view);
        else if (view.walk) add(name + '2', overlay(g0, view.walk, true), view);
        if (name === 'down') { add('idle1', sink(g0, view.neck, 1), view); add('idle2', sink(g0, view.waist, 1), view); }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- paint
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function paintRGB(g, colorAt) {
    const c = mk(g.w, g.h), x = c.getContext('2d'), id = x.createImageData(g.w, g.h);
    for (let y = 0; y < g.h; y++) for (let i = 0; i < g.w; i++) {
      const col = colorAt(i, y); if (!col) continue;
      const k = (y * g.w + i) * 4; id.data[k] = col[0]; id.data[k + 1] = col[1]; id.data[k + 2] = col[2]; id.data[k + 3] = col[3] == null ? 255 : col[3];
    }
    x.putImageData(id, 0, 0); return c;
  }
  function palRGB(V) {
    if (V._rgb) return V._rgb;
    const P = {}; for (const k in V.pal) P[k] = hex(V.pal[k]);
    return (V._rgb = P);
  }
  // selective outline (V.selout): each outline pixel takes the darkest tone of the material it
  // borders (most frequent 8-neighbour), a step lighter on the lit top-left, never black.
  function matOf(V, ch) { for (const m in V.mats) if (V.mats[m].includes(ch)) return V.mats[m]; return null; }
  function selCol(V, g, x, y) {
    const P = palRGB(V), outl = V.outlineKeys || 'X', cnt = {};
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || yy >= g.h || xx >= g.w) continue;
      const k = g.px[yy][xx]; if (k === '.' || outl.includes(k) || (V.emissive || '').includes(k)) continue;
      const m = matOf(V, k); if (!m) continue; cnt[m] = (cnt[m] || 0) + (dx && dy ? 1 : 2);
    }
    let best = null, bn = 0; for (const m in cnt) if (cnt[m] > bn) { bn = cnt[m]; best = m; }
    if (!best) return hex(V.selDefault || '#2a2030');
    const op = (xx, yy) => xx >= 0 && yy >= 0 && xx < g.w && yy < g.h && g.px[yy][xx] !== '.';
    const litEdge = !op(x - 1, y) || !op(x, y - 1); // outer edge toward the top-left key
    const edge = !op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1);
    const base = P[best[0]];
    if (edge && litEdge && best.length > 3) return mix(P[best[0]], P[best[1]], 0.55);
    return edge ? mul(base, [0.9, 0.88, 0.92]) : base;
  }
  function paint(V, g) {
    const P = palRGB(V), outl = V.outlineKeys || 'X';
    return paintRGB(g, (x, y) => {
      const ch = g.px[y][x]; if (ch === '.') return null;
      if (V.selout && outl.includes(ch)) return selCol(V, g, x, y);
      const c = P[ch]; if (!c) { console.warn('no colour for', JSON.stringify(ch), V.id); return [255, 0, 255]; } return c;
    });
  }

  // ---------------------------------------------------------------- lamp-lit night version
  // lightSide: -1 = warm key from the left, +1 = from the right. Cool moon rim on the other side.
  // Discrete light levels keep clusters clean: 0 ambient, 1 lit half, 2 warm rim, -1 cool rim.
  function litColors(V, o) {
    o = Object.assign({ amb: [0.40, 0.42, 0.66], ambAdd: [8, 6, 22], litK: 1.0, warmAdd: [10, 3, -6], rimC: [255, 196, 128], rimK: 0.45, moon: [0.72, 0.86, 1.15], moonK: 0.55, half: 0.62, olWarm: [120, 60, 30] }, V.lit || {}, o || {});
    return o;
  }
  // for a key, the next lighter key in its material ramp (or itself)
  function lighter(V, ch, n) {
    for (const m in V.mats) { const s = V.mats[m]; const i = s.indexOf(ch); if (i >= 0) return s[Math.min(s.length - 1, i + (n || 1))]; }
    return ch;
  }
  function darker(V, ch, n) {
    for (const m in V.mats) { const s = V.mats[m]; const i = s.indexOf(ch); if (i >= 0) return s[Math.max(0, i - (n || 1))]; }
    return ch;
  }
  function light(V, g, side, o) {
    const L = litColors(V, o);
    const P = palRGB(V);
    const emis = V.emissive || '';
    const noLit = V.noLit || '';
    const outl = V.outlineKeys || 'X';
    const op = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.px[y][x] !== '.';
    const isOl = (x, y) => op(x, y) && (outl.includes(g.px[y][x]) || !op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1));
    // row spans (silhouette) for the lit-half test
    const span = g.px.map((r) => { let a = -1, b = -1; r.forEach((c, i) => { if (c !== '.') { if (a < 0) a = i; b = i; } }); return [a, b]; });
    const amb = (c) => [c[0] * L.amb[0] + L.ambAdd[0], c[1] * L.amb[1] + L.ambAdd[1], c[2] * L.amb[2] + L.ambAdd[2]];
    const lvl = (x, y) => {
      if (isOl(x, y)) return 'o';
      const ch = g.px[y][x];
      // rim: first interior pixel whose neighbour toward the key (or away from it) is the silhouette outline
      const edgeTo = (s) => op(x + s, y) && isOl(x + s, y) && !op(x + 2 * s, y);
      if (edgeTo(side)) return 2;
      if (edgeTo(-side)) return -1;
      const [a, b] = span[y]; if (a < 0) return 0;
      const t = side < 0 ? (x - a) / Math.max(1, b - a) : (b - x) / Math.max(1, b - a);
      return t < (L.half == null ? 0.5 : L.half) ? 1 : 0;
    };
    return paintRGB(g, (x, y) => {
      const ch = g.px[y][x]; if (ch === '.') return null;
      const c = V.selout && outl.includes(ch) ? selCol(V, g, x, y) : P[ch];
      if (emis.includes(ch)) return c;
      const l = lvl(x, y);
      if (noLit.includes(ch)) return l === 'o' ? amb(c) : mix(amb(c), c, 0.8);
      if (l === 'o') return !op(x + side, y) ? mix(amb(c), L.olWarm, 0.35) : amb(c);
      if (l === 0) return amb(c);
      const up = P[lighter(V, ch, 1)] || c;
      if (l === 1) { const m = mix(amb(c), c, L.litK); return [m[0] + L.warmAdd[0], m[1] + L.warmAdd[1], m[2] + L.warmAdd[2]]; }
      if (l === 2) return mix(up, L.rimC, L.rimK);
      return mix(amb(c), mul(up, L.moon), L.moonK);
    });
  }

  // ---------------------------------------------------------------- measurement (STYLE_REFERENCE §2, §9)
  function stats(canvas) {
    const x = canvas.getContext('2d'), d = x.getImageData(0, 0, canvas.width, canvas.height).data, W = canvas.width, H = canvas.height;
    let y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1; const cols = new Set();
    const A = (i, j) => i >= 0 && j >= 0 && i < W && j < H && d[(j * W + i) * 4 + 3] > 0;
    let edge = 0, dark = 0, nearBlack = 0, opaque = 0;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!A(i, j)) continue; opaque++;
      const k = (j * W + i) * 4; cols.add(d[k] << 16 | d[k + 1] << 8 | d[k + 2]);
      y0 = Math.min(y0, j); y1 = Math.max(y1, j); x0 = Math.min(x0, i); x1 = Math.max(x1, i);
      if (!A(i - 1, j) || !A(i + 1, j) || !A(i, j - 1) || !A(i, j + 1)) {
        edge++; const c = [d[k], d[k + 1], d[k + 2]], l = lum(c);
        if (l < 60) dark++;
        const hs = rgbToHsv(c); if (l < 40 && hs[1] < 0.35) nearBlack++;
      }
    }
    return { h: y1 - y0 + 1, w: x1 - x0 + 1, colors: cols.size, px: opaque, olDark: Math.round(dark / edge * 100), olNeutral: Math.round(nearBlack / Math.max(1, dark) * 100) };
  }
  // head height: rows from the top of the sprite down to the chin row (view.chin)
  G.C5 = { compose, check, hex, toHex, hsv, ramp, grid, overlay, sink, shift, flipG, frames, paint, paintRGB, light, stats, mk, mix, mul, lum, rgbToHsv, lighter, darker };
})(window);
