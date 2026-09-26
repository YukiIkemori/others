// Town + dungeon snippets (3/4 top-down), drawn at 512×448 "world" pixels and shown ×2.
// Surfaces (cobbles, masonry, timber, shingles, flagstones) are generated per pixel; props and actors
// use the 2.5D rasterizer; night lighting = ambient light map (multiply) + lamp/torch lights (add),
// with the sprites lit by the same point lights.
'use strict';
(function (G) {
  const { hex, mix, clamp, rng, vnoise, ramp, mat, Builder, render } = G.RZ;
  const W = 512, H = 448;

  class PX {
    constructor(ctx) { this.ctx = ctx; this.img = ctx.getImageData(0, 0, W, H); this.d = this.img.data; }
    set(x, y, c, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const q = (y * W + x) * 4, d = this.d; if (a != null && a < 1) { d[q] += (c[0] - d[q]) * a; d[q + 1] += (c[1] - d[q + 1]) * a; d[q + 2] += (c[2] - d[q + 2]) * a; } else { d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; } d[q + 3] = 255; }
    get(x, y) { const q = ((y | 0) * W + (x | 0)) * 4; return [this.d[q], this.d[q + 1], this.d[q + 2]]; }
    fill(x0, y0, x1, y1, f) { for (let y = Math.max(0, y0 | 0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(W, x1); x++) { const c = f(x, y); if (c) this.set(x, y, c); } }
    done() { this.ctx.putImageData(this.img, 0, 0); }
  }
  const pick = (r, l) => r[clamp(Math.round(l * (r.length - 1)), 0, r.length - 1)];

  // Voronoi cobblestones
  function cobbles(px, x0, y0, x1, y1, o) {
    const cw = o.cw || 9, ch = o.ch || 6, rs = ramp(o.keys, 7), mortar = hex(o.mortar), seed = o.seed || 1;
    const R = (i, j, k) => { let h = (i * 73856093) ^ (j * 19349663) ^ (k * 83492791) ^ seed; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    px.fill(x0, y0, x1, y1, (x, y) => {
      const j = Math.floor(y / ch), off = (j & 1) * cw * 0.5, i = Math.floor((x + off) / cw);
      let d1 = 1e9, d2 = 1e9, sx = 0, sy = 0, id = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const jj = j + dj, oo = (jj & 1) * cw * 0.5, ii = Math.floor((x + oo) / cw) + di;
        const cx = ii * cw - oo + cw * (0.3 + R(ii, jj, 1) * 0.4), cy = jj * ch + ch * (0.3 + R(ii, jj, 2) * 0.4);
        const d = Math.hypot((x + 0.5 - cx) * (ch / cw), y + 0.5 - cy);
        if (d < d1) { d2 = d1; d1 = d; sx = cx; sy = cy; id = ii * 1000 + jj; } else if (d < d2) d2 = d;
      }
      if (d2 - d1 < 0.9) return mortar;
      const nx = (x + 0.5 - sx) / (cw * 0.5), ny = (y + 0.5 - sy) / (ch * 0.5);
      let l = 0.55 - nx * 0.18 - ny * 0.3 + (vnoise(x * 0.5, y * 0.5, 3) - 0.5) * 0.25 + (R(id, 0, 5) - 0.5) * 0.3;
      if (d2 - d1 < 1.8) l -= 0.18;
      let c = pick(rs, l);
      if (o.tint) c = mix(c, hex(o.tint), R(id, 0, 6) * 0.3);
      return c;
    });
  }
  // masonry blocks (walls / flagstones)
  function blocks(px, x0, y0, x1, y1, o) {
    const rh = o.rh, rs = ramp(o.keys, 8), mortar = hex(o.mortar), R = rng(o.seed || 3);
    const rows = [];
    for (let y = y0; y < y1; y += rh) { const cuts = []; let x = x0 - R() * o.bw; while (x < x1) { cuts.push(x); x += o.bw * (0.6 + R() * 0.8); } cuts.push(x); rows.push({ y, cuts, t: cuts.map(() => R()) }); }
    for (const r of rows) for (let k = 0; k < r.cuts.length - 1; k++) {
      const bx0 = Math.round(r.cuts[k]), bx1 = Math.round(r.cuts[k + 1]), by0 = r.y, by1 = Math.min(y1, r.y + rh), t = r.t[k];
      for (let y = Math.max(y0, by0); y < by1; y++) for (let x = Math.max(x0, bx0); x < Math.min(x1, bx1); x++) {
        if (x === bx0 || y === by0) { px.set(x, y, mortar); continue; }
        const e1 = Math.min(x - bx0, y - by0), e2 = Math.min(bx1 - 1 - x, by1 - 1 - y);
        let l = 0.5 + (t - 0.5) * 0.35 + (vnoise(x * 0.35, y * 0.35, 7 + k) - 0.5) * 0.35 + (vnoise(x * 1.1, y * 1.1, 9) - 0.5) * 0.12;
        if (e1 <= 1) l += 0.2; if (e2 <= 1) l -= 0.22; if (e2 === 0) l -= 0.1;
        if (o.moss && y > by1 - 3 && vnoise(x * 0.3, y, 11) > 0.55) { px.set(x, y, pick(o.moss, l)); continue; }
        if (o.crack && vnoise(x * 0.15 + k, y * 0.9, 13) > 0.86 && e1 > 2 && e2 > 2) l -= 0.35;
        px.set(x, y, pick(rs, l));
      }
    }
  }

  // ---------- town ----------
  const TW = {
    plaster: ramp(['#5e5046', '#948472', '#c0ae96', '#dccab0', '#eee0c8'], 7),
    timber: ramp(['#1c100a', '#36200f', '#54341c', '#74502e'], 5),
    roofR: ramp(['#3e1c16', '#643024', '#8a4630', '#ae6444', '#cc8a62'], 7),
    roofS: ramp(['#1e2430', '#323c4c', '#4a5666', '#687484', '#9aa2ac'], 7),
    stone: ramp(['#28262a', '#48454a', '#6c686a', '#94908a', '#bcb6aa'], 7),
    glassOn: ramp(['#a04a10', '#e08a28', '#ffc860', '#fff0b0'], 4),
    glassDay: ramp(['#141c28', '#26344a', '#46607a', '#9cb4c4'], 4),
  };
  function house(px, o) {
    const { x0, x1, yb, wall, roof } = o, R = rng(o.seed);
    const yt = yb - wall, rt = yt - roof;
    // roof (seen from above-front): shingle rows, overhang
    const rr = o.slate ? TW.roofS : TW.roofR;
    for (let y = rt; y < yt + 3; y++) {
      const row = Math.floor((y - rt) / 5), off = (row & 1) * 4;
      for (let x = x0 - 5; x < x1 + 5; x++) {
        const ty = (y - rt) % 5, tx = (x + off - x0) % 8;
        let l = 0.62 - (y - rt) / roof * 0.25 + (vnoise(x * 0.2, row, o.seed) - 0.5) * 0.3;
        if (ty === 4) l -= 0.35; else if (ty === 0) l += 0.12;
        if (tx === 0 && ty < 4) l -= 0.25;
        if (y >= yt) l -= 0.3 + (y - yt) * 0.1; // eave edge
        if (x < x0 - 3 || x > x1 + 2) l -= 0.15;
        px.set(x, y, pick(rr, l));
      }
    }
    // ridge cap
    for (let x = x0 - 5; x < x1 + 5; x++) { px.set(x, rt, pick(rr, 0.85)); px.set(x, rt + 1, pick(rr, 0.7)); px.set(x, rt - 1, pick(rr, 0.2)); }
    // chimney
    if (o.chimney) { const cx = x0 + (x1 - x0) * 0.72; blocks(px, cx, rt - 12, cx + 10, rt + 14, { rh: 3, bw: 5, keys: ['#3a1c14', '#6a3424', '#94503a', '#b8745a'], mortar: '#241410', seed: 5 }); for (let x = cx - 1; x < cx + 11; x++) { px.set(x, rt - 13, TW.stone[4]); px.set(x, rt - 12, TW.stone[2]); } }
    // wall: plaster with timber frame
    px.fill(x0, yt + 3, x1, yb - 7, (x, y) => {
      let l = 0.62 + (vnoise(x * 0.25, y * 0.25, 17) - 0.5) * 0.18 + (vnoise(x * 1.3, y * 1.3, 18) - 0.5) * 0.08;
      if (y < yt + 6) l -= (yt + 6 - y) * 0.12; // eave shadow
      return pick(TW.plaster, l);
    });
    const beam = (bx0, by0, bx1, by1, w) => {
      const n = Math.max(Math.abs(bx1 - bx0), Math.abs(by1 - by0)) * 2;
      for (let i = 0; i <= n; i++) { const x = bx0 + (bx1 - bx0) * i / n, y = by0 + (by1 - by0) * i / n; for (let k = 0; k < w; k++) { const ll = k === 0 ? 0.9 : k === w - 1 ? 0.15 : 0.55 + (vnoise(x * 0.2, y * 1.5, 19) - 0.5) * 0.4; if (bx0 === bx1) px.set(x + k, y, pick(TW.timber, ll)); else px.set(x, y + k, pick(TW.timber, ll)); } }
    };
    const midY = yt + 3 + Math.round((wall - 10) * 0.45);
    beam(x0, yt + 3, x1 - 1, yt + 3, 3); beam(x0, midY, x1 - 1, midY, 3);
    const posts = o.posts || [x0, x1 - 4];
    posts.forEach((x) => beam(x, yt + 3, x, yb - 7, 4));
    (o.braces || []).forEach(([a, b]) => { for (let i = 0; i < 3; i++) beam(a + i, yt + 6, b + i, midY, 1); });
    // stone foundation
    blocks(px, x0, yb - 7, x1, yb, { rh: 3.5, bw: 7, keys: ['#26242a', '#46444a', '#6c6868', '#96928a', '#b8b2a4'], mortar: '#1a181c', seed: o.seed + 1 });
    // windows (emissive recorded)
    (o.windows || []).forEach(([wx, wy, ww, wh]) => {
      for (let y = wy - 1; y < wy + wh + 1; y++) for (let x = wx - 1; x < wx + ww + 1; x++) px.set(x, y, TW.timber[1]);
      px.fill(wx, wy, wx + ww, wy + wh, (x, y) => { const mid = x === wx + (ww >> 1) || y === wy + (wh >> 1); return mid ? TW.timber[2] : pick(o.day ? TW.glassDay : TW.glassOn, (o.day ? 0.25 + ((x - wx + (y - wy)) % 7 < 2 ? 0.6 : 0) : 0.9 - (y - wy) / wh * 0.5) + (vnoise(x, y, 23) - 0.5) * 0.2); });
      for (let x = wx - 2; x < wx + ww + 2; x++) { px.set(x, wy + wh + 1, TW.timber[3]); px.set(x, wy + wh + 2, TW.timber[1]); }
      o.emit.push([wx + ww / 2, wy + wh / 2, ww]);
    });
    // door
    if (o.door) {
      const [dx, dw, dh] = o.door, dy = yb - dh;
      px.fill(dx - 2, dy - 2, dx + dw + 2, yb, (x, y) => (x < dx || x >= dx + dw || y < dy) ? TW.stone[(x + y) & 1 ? 2 : 3] : null);
      px.fill(dx, dy, dx + dw, yb, (x, y) => { const pl = (x - dx) % 4 === 0; let l = pl ? 0.1 : 0.5 + (vnoise(x * 0.3, y * 0.08, 29) - 0.5) * 0.4; if (y === dy + 3 || y === yb - 4) l = 0.25; return pick(TW.timber, l); });
      px.set(dx + dw - 3, dy + dh / 2, [230, 190, 90]); px.set(dx + dw - 3, dy + dh / 2 + 1, [120, 80, 30]);
    }
  }

  function prop(B, kind, x, y, s) {
    if (kind === 'barrel') {
      const m = mat({ keys: ['#1c1008', '#3c2412', '#62401e', '#8a6030', '#b4884c'], n: 7, tex: 1.5, tsx: 1.5, tsy: 0.2 });
      const g = B.group();
      B.cap(x, y - 3, x, y - 13, 6.5, 6.5, m, y, { g });
      B.ell(x, y - 16, 6.2, 2.4, m, y + 0.05, { g: B.group(), shadeOff: -1, bulge: 0.2 });
      [y - 5, y - 13].forEach((by) => B.cap(x - 6.6, by, x + 6.6, by, 0.9, 0.9, G.RIG.M.iron, y + 0.02));
    } else if (kind === 'crate') {
      const m = mat({ keys: ['#241408', '#4a2e14', '#74502a', '#9c7442', '#c8a068'], n: 7, tex: 1.2, tsx: 0.15, tsy: 1 });
      B.poly([[x - 8, y], [x + 8, y], [x + 8, y - 12], [x - 8, y - 12]], m, y, { bevel: 1.5 });
      B.poly([[x - 8, y - 12], [x + 8, y - 12], [x + 6, y - 18], [x - 6, y - 18]], m, y + 0.01, { bevel: 1.2, ny: -0.8, g: B.group() });
      B.cap(x - 7, y - 1.5, x + 7, y - 10.5, 0.8, 0.8, m, y + 0.02, { shadeOff: 1 });
    } else if (kind === 'lamp') {
      const post = mat({ keys: ['#08080c', '#1c1e26', '#343844', '#5a6070'], n: 5, metal: true, spec: 0.6 });
      B.cap(x, y, x, y - 44, 1.6, 1.2, post, y);
      B.ell(x, y - 1, 3.4, 1.6, post, y + 0.01);
      B.cap(x, y - 44, x + 5, y - 46, 0.8, 0.8, post, y + 0.02);
      B.poly([[x + 2, y - 48], [x + 8, y - 48], [x + 7, y - 40], [x + 3, y - 40]], mat({ keys: ['#ff9a30', '#ffe7a0', '#fffbe8'], n: 3, flat: true, glow: '#ffd070' }), y + 0.03, { bevel: 0.1, shade: 2 });
      B.poly([[x + 1, y - 48], [x + 9, y - 48], [x + 5, y - 52]], post, y + 0.04, { bevel: 1 });
    } else if (kind === 'planter') {
      const m = mat({ keys: ['#2a1810', '#5a3624', '#8a5a3c', '#b48058'], n: 6 });
      B.poly([[x - 10, y], [x + 10, y], [x + 11, y - 7], [x - 11, y - 7]], m, y, { bevel: 1.2 });
      const R = rng(x * 7 + y);
      for (let i = 0; i < 9; i++) B.ell(x - 9 + i * 2.2, y - 8 - R() * 3, 2.2, 1.8, G.ENV.EM.leaf, y + 0.1 + R() * 0.1);
      for (let i = 0; i < 6; i++) B.ell(x - 8 + i * 3.2 + R(), y - 10 - R() * 3, 1.2, 1.0, [G.ENV.EM.petalP, G.ENV.EM.petalY, G.ENV.EM.petalW][i % 3], y + 0.3);
    } else if (kind === 'sign') {
      const w = mat({ keys: ['#2a160a', '#54321a', '#80542c', '#a87a48'], n: 5 });
      B.cap(x, y, x, y - 8, 0.8, 0.8, G.RIG.M.iron, y);
      B.poly([[x - 9, y + 1], [x + 9, y + 1], [x + 9, y + 11], [x - 9, y + 11]], w, y + 0.1, { bevel: 1.4 });
      B.ell(x, y + 6, 3, 2.4, G.RIG.M.gold, y + 0.2);
    }
  }

  function npcLook() {
    const L = Object.assign({}, G.RIG.LOOKS.selma);
    L.name = '町の人'; L.hairStyle = 'bob'; L.circlet = false; L.weapon = null; L.armor = null; L.robe = true;
    L.hair = mat({ keys: ['#140c08', '#3a2416', '#5a3a22', '#7c5634', '#a07a50', '#c8a47a'], n: 8, sheen: [-0.62, -0.28], tex: 1.1, tsx: 0.25, tsy: 1.6 });
    L.top = mat({ keys: ['#1a1c2c', '#2e3450', '#48527a', '#6a78a0', '#9aa8c8'], n: 7, tex: 0.5, tsx: 1.4, tsy: 0.3 });
    L.trim = mat({ keys: ['#5a5046', '#a09280', '#d8ccb4', '#f4ecd8'], n: 6 });
    L.belt = mat({ keys: ['#5a5046', '#a09280', '#d8ccb4', '#f4ecd8'], n: 6 });
    L.eye = G.RIG.LOOKS.arun.eye;
    return L;
  }

  function actor(L, pose, x, y, light, sc) {
    const B = new Builder(); G.RIG.draw(B, L, pose);
    return render(B, { flip: pose.flip, scale: sc, light, wx: x, wy: y, wk: sc });
  }

  G.PLACES = { PX, cobbles, blocks, house, prop, npcLook, actor, TW, pick };
})(window);
