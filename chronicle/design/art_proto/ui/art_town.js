// Top-down (high 3/4) field renderer for the mocks: town (港町ファロス), and the shared kit used by the
// world field and the dungeon (art_world.js). Everything is code-drawn at the HD pixel grid
// (1 art px = 2 device px, 1 tile = 32 art px) and lit for the night world of BRIEF A25:
// moon-blue ambient (multiply) + warm light pools (lamps, windows, the party's lantern) + emissive redraw.
// Layers (MODERN_UI.md §8): ground → vertical faces → soft shadows / AO → y-sorted sprites
// (buildings, props, people) → lightmap → emissive + reflections → bloom / grade.
'use strict';
(function (G) {
  const { hex, mix, clamp, rng, vnoise, ramp, mat } = G.RZ;
  const mk = ENV.mk;
  const TS = 32;
  const STYLE = { tones: 5, sat: 0.9, olMix: 0.82 };
  const FL = G.FIELD_LIGHT;

  class Buf {
    constructor(W, H) { this.W = W; this.H = H; this.c = mk(W, H); this.x = this.c.getContext('2d'); this.img = this.x.createImageData(W, H); this.d = this.img.data; }
    set(x, y, c, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; const q = (y * this.W + x) * 4, d = this.d; if (a != null && a < 1) { d[q] += (c[0] - d[q]) * a; d[q + 1] += (c[1] - d[q + 1]) * a; d[q + 2] += (c[2] - d[q + 2]) * a; d[q + 3] = Math.max(d[q + 3], 255 * a); } else { d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255; } }
    get(x, y) { const q = ((y | 0) * this.W + (x | 0)) * 4; return [this.d[q], this.d[q + 1], this.d[q + 2]]; }
    fill(x0, y0, x1, y1, f) { for (let y = Math.max(0, y0 | 0); y < Math.min(this.H, y1); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(this.W, x1); x++) { const c = f(x, y); if (c) this.set(x, y, c); } }
    done() { this.x.putImageData(this.img, 0, 0); return this.c; }
  }
  const pick = (r, l) => r[clamp(Math.round(l * (r.length - 1)), 0, r.length - 1)];
  const H3 = (i, j, k) => { let h = Math.imul((i * 73856093) ^ (j * 19349663) ^ (k * 83492791), 1274126177); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

  // ------------------------------------------------------------------ palettes (authored "in daylight"; night comes from the lightmap)
  const P = {
    cobble: ramp(['#262422', '#3e3a36', '#5a534c', '#776d62', '#93877a', '#ad9f8e'], 8), mortar: [26, 24, 24],
    flag: ramp(['#34302c', '#524c44', '#70685c', '#8e8474', '#aa9f8c'], 8), flagMortar: [30, 27, 25],
    plank: ramp(['#241610', '#40281a', '#5c3e28', '#7a5838', '#96744c', '#b08e62'], 8),
    quay: ramp(['#262426', '#403d40', '#5c5858', '#7c7670', '#9a9388', '#b4ab9c'], 8),
    grass: ramp(['#16240e', '#223a14', '#34521c', '#4a6a26', '#628434', '#7e9c46'], 8),
    dirt: ramp(['#2a1e14', '#42301e', '#5c442a', '#76583a', '#8e6e4a'], 7),
    water: ramp(['#08121e', '#0e1e2e', '#15293c', '#1e384c', '#2c4c60', '#446a7c'], 8),
    plaster: ramp(['#4e4a46', '#7a746a', '#a49c8c', '#c8bea8', '#e2d8c2', '#f0e8d6'], 8),
    stoneW: ramp(['#2e2824', '#4c423a', '#6c5e52', '#8c7c6c', '#a89886', '#c0b09a'], 8),
    slate: ramp(['#1a2232', '#2c3850', '#42526c', '#5a6c88', '#7a8ca6', '#9eaec6'], 8),
    terra: ramp(['#34160e', '#562618', '#7a3a24', '#9c5434', '#bc724c', '#d6946a'], 8),
    timber: ramp(['#180e08', '#2e1c0e', '#4a3018', '#664626', '#7e5c36'], 6),
    door: ramp(['#1e1008', '#38200e', '#54341a', '#704a28', '#8a603a'], 6),
    glass: ramp(['#7a3408', '#c0661c', '#ee9a3c', '#ffc86a', '#ffe6a8'], 6),
    shutterB: ramp(['#10202c', '#1c3446', '#2a4c62', '#3c6680', '#5a86a0'], 6),
    shutterG: ramp(['#12201a', '#1e3428', '#2e4c3a', '#44684e', '#5e8666'], 6),
    awnR: ramp(['#3a0e0e', '#5e1a18', '#862a24', '#a84436', '#c8664e'], 6), awnW: ramp(['#6a645a', '#9a9284', '#c4baa8', '#e2d8c4'], 5),
  };
  G.TD_PAL = P;

  function cobbleAt(x, y, o) {
    o = o || {}; const cw = o.cw || 11, ch = o.ch || 8, rs = o.ramp || P.cobble;
    const j = Math.floor(y / ch);
    let d1 = 1e9, d2 = 1e9, sx = 0, sy = 0, id = 0;
    for (let dj = -1; dj <= 1; dj++) {
      const jj = j + dj, oo = (jj & 1) * cw * 0.5, ib = Math.floor((x + oo) / cw);
      for (let di = -1; di <= 1; di++) {
        const ii = ib + di;
        const cx = ii * cw - oo + cw * (0.3 + H3(ii, jj, 1) * 0.4), cy = jj * ch + ch * (0.3 + H3(ii, jj, 2) * 0.4);
        const d = Math.hypot((x + 0.5 - cx) * (ch / cw), y + 0.5 - cy);
        if (d < d1) { d2 = d1; d1 = d; sx = cx; sy = cy; id = ii * 7919 + jj; } else if (d < d2) d2 = d;
      }
    }
    if (d2 - d1 < 0.9) return o.mortar || P.mortar;
    const nx = (x + 0.5 - sx) / (cw * 0.5), ny = (y + 0.5 - sy) / (ch * 0.5);
    let l = 0.52 - nx * 0.16 - ny * 0.28 + (vnoise(x * 0.5, y * 0.5, 3) - 0.5) * 0.22 + (H3(id, 0, 5) - 0.5) * 0.3;
    if (d2 - d1 < 1.8) l -= 0.16;
    return pick(rs, l);
  }
  function flagAt(x, y) {
    const rh = 14, row = Math.floor(y / rh), off = H3(row, 0, 9) * 20, bw = 22 + H3(row, 1, 9) * 8;
    const col = Math.floor((x + off) / bw), ex = (x + off) - col * bw, ey = y - row * rh;
    if (ex < 1 || ey < 1) return P.flagMortar;
    const t = H3(col, row, 3);
    let l = 0.5 + (t - 0.5) * 0.35 + (vnoise(x * 0.3, y * 0.3, 7) - 0.5) * 0.25 + (vnoise(x * 1.1, y * 1.1, 8) - 0.5) * 0.1;
    if (ex < 2 || ey < 2) l += 0.14; if (ex > bw - 2 || ey > rh - 2) l -= 0.16;
    return pick(P.flag, l);
  }
  function plankAt(x, y, vertical) {
    const u = vertical ? x : y, v = vertical ? y : x;
    const w = 7, k = Math.floor(u / w), eu = u - k * w;
    const seg = 60 + H3(k, 0, 4) * 50, sk = Math.floor((v + H3(k, 1, 4) * 80) / seg), ev = (v + H3(k, 1, 4) * 80) - sk * seg;
    if (eu < 1) return [16, 10, 8];
    if (ev < 1) return [26, 16, 10];
    let l = 0.5 + (H3(k, sk, 2) - 0.5) * 0.3 + (vnoise(u * 0.4, v * 0.05, 11) - 0.5) * 0.35 + (vnoise(u * 2, v * 0.3, 12) - 0.5) * 0.12;
    if (eu < 2) l += 0.1; if (eu > w - 2) l -= 0.12;
    if ((ev === 3 || ev === seg - 4) && (eu === 3)) l = 0.9; // nail
    return pick(P.plank, l);
  }
  function grassAt(x, y) {
    const n = vnoise(x * 0.06, y * 0.06, 21), b = vnoise(x * 0.9, y * 0.35, 22), c = vnoise(x * 0.25, y * 0.25, 23);
    let l = 0.45 + (n - 0.5) * 0.4 + (b - 0.5) * 0.35 + (c - 0.5) * 0.2;
    const col = pick(P.grass, l);
    if (H3(x >> 1, y >> 1, 31) > 0.992) return [200, 190, 150];
    return col;
  }
  function waterAt(x, y) {
    const n = vnoise(x * 0.015, y * 0.03, 41), r = vnoise(x * 0.06, y * 0.32, 42), r2 = vnoise(x * 0.11, y * 0.6, 43);
    let l = 0.32 + (n - 0.5) * 0.25;
    if (r > 0.7 && r2 > 0.45) l += 0.22; else if (r < 0.25) l -= 0.1;
    return pick(P.water, l);
  }

  // ------------------------------------------------------------------ building sprite (roof + front wall), per pixel
  // b = {tx, ty, tw, th, wall (tiles), roof: 'slate'|'terra', mat: 'plaster'|'stone'|'plank', hip, door:{x,w,open}, windows:[x..], win2:[x..] (upper floor),
  //      chimney: x, sign:{x, kind}, awning:{x, w}, beam: bool}
  function building(b) {
    const W = b.tw * TS + 12, over = 6, top = 22; // overhang + chimney room
    const wallH = b.wall * TS, roofH = (b.th - b.wall) * TS, H = top + roofH + wallH + 2;
    const buf = new Buf(W, H);
    const x0 = over, x1 = over + b.tw * TS, ry0 = top, ry1 = top + roofH, wy0 = ry1, wy1 = ry1 + wallH;
    const RR = b.roof === 'terra' ? P.terra : P.slate, WR = b.mat === 'stone' ? P.stoneW : b.mat === 'plank' ? P.plank : P.plaster;
    const emit = [], sid = b.tx * 31 + b.ty * 7;
    // --- front wall
    buf.fill(x0, wy0, x1, wy1, (x, y) => {
      const lx = x - x0, ly = y - wy0;
      let c;
      if (b.mat === 'stone') {
        const rh = 8, row = Math.floor(ly / rh), off = (row & 1) * 9, bw = 18, col = Math.floor((lx + off) / bw), ex = lx + off - col * bw, ey = ly - row * rh;
        if (ex < 1 || ey < 1) c = [30, 26, 24]; else { let l = 0.5 + (H3(col, row, sid) - 0.5) * 0.35 + (vnoise(x * 0.3, y * 0.3, 5) - 0.5) * 0.2; if (ey < 2) l += 0.12; if (ey > rh - 2) l -= 0.12; c = pick(WR, l); }
      } else if (b.mat === 'plank') c = plankAt(x + sid, y, true);
      else { let l = 0.6 + (vnoise(x * 0.18, y * 0.18, 17) - 0.5) * 0.14 + (vnoise(x * 0.9, y * 0.9, 18) - 0.5) * 0.08; c = pick(WR, l); }
      // quoins (corner stones) on plaster walls
      if (b.mat !== 'stone' && (lx < 6 || lx >= b.tw * TS - 6)) { const row = Math.floor(ly / 7); const w = (row & 1) ? 6 : 4; const inside = lx < 6 ? lx < w : lx >= b.tw * TS - w; if (inside) { const ey = ly - row * 7; c = ey < 1 ? [40, 36, 34] : pick(P.stoneW, 0.6 + (H3(row, lx < 6 ? 0 : 1, sid) - 0.5) * 0.3 - (ey > 5 ? 0.15 : 0)); } }
      // eave shadow and AO at the wall base
      const eave = clamp(1 - ly / 9, 0, 1); if (eave > 0) c = mix(c, [18, 14, 20], eave * 0.7);
      if (ly > wallH - 8) { // plinth
        const pl = Math.floor(lx / 12), ey = ly - (wallH - 8);
        c = ey < 1 ? [28, 26, 26] : pick(P.quay, 0.45 + (H3(pl, 1, sid) - 0.5) * 0.3 - ey * 0.03);
        if (lx % 12 === 0) c = [28, 26, 26];
      }
      // vertical light falloff (moon from the upper left): left side a touch brighter
      return mix(c, [0, 0, 0], (lx / (b.tw * TS)) * 0.12);
    });
    // timber beam between floors
    if (b.beam && b.wall >= 3) {
      const by = wy0 + Math.round(wallH * 0.44);
      buf.fill(x0, by, x1, by + 4, (x, y) => pick(P.timber, y === by ? 0.85 : y === by + 3 ? 0.1 : 0.5 + (vnoise(x * 0.2, y, 3) - 0.5) * 0.3));
    }
    // --- windows (lit)
    const drawWin = (cx, cy, w, h, shut) => {
      const wx = x0 + cx - w / 2, wy = cy;
      buf.fill(wx - 2, wy - 2, wx + w + 2, wy + h + 2, () => pick(P.timber, 0.3));
      buf.fill(wx, wy, wx + w, wy + h, (x, y) => {
        const mid = x === Math.floor(wx + w / 2) || y === Math.floor(wy + h * 0.45);
        return mid ? pick(P.timber, 0.55) : pick(P.glass, 0.95 - (y - wy) / h * 0.55 + (vnoise(x, y, 23) - 0.5) * 0.15);
      });
      // arched top
      buf.fill(wx - 2, wy - 5, wx + w + 2, wy - 2, (x, y) => { const d = Math.abs(x - (wx + w / 2)) / (w / 2 + 2); return (y - (wy - 5)) >= (1 - Math.sqrt(1 - Math.min(1, d * d))) * 3 ? pick(P.stoneW, 0.75 - (y - wy + 5) * 0.1) : null; });
      // sill
      buf.fill(wx - 3, wy + h + 2, wx + w + 3, wy + h + 4, (x, y) => pick(P.stoneW, y === wy + h + 2 ? 0.9 : 0.35));
      if (shut) { const SR = shut === 'g' ? P.shutterG : P.shutterB; [[wx - 7, wx - 2], [wx + w + 2, wx + w + 7]].forEach(([a, bb]) => buf.fill(a, wy - 1, bb, wy + h + 1, (x, y) => pick(SR, 0.55 + ((x - a) % 3 === 0 ? -0.25 : 0) + (y === wy - 1 ? 0.2 : 0)))); }
      emit.push({ kind: 'win', x: wx, y: wy, w, h });
    };
    const winH = b.wall >= 3 ? 16 : 15, lowY = wy1 - 8 - (b.wall >= 3 ? 28 : 26);
    (b.windows || []).forEach((wx) => drawWin(wx, lowY, 12, winH, b.shutters));
    (b.win2 || []).forEach((wx) => drawWin(wx, wy0 + 14, 12, 14, b.shutters));
    // flower boxes under the lower windows
    if (b.flowers) (b.windows || []).forEach((wx) => {
      const fx = x0 + wx - 9, fy = lowY + winH + 4;
      buf.fill(fx, fy, fx + 18, fy + 4, (x, y) => pick(P.door, y === fy ? 0.8 : 0.4));
      const R = rng(wx + sid);
      for (let i = 0; i < 9; i++) { const px = fx + 1 + R() * 16, py = fy - 1 - R() * 3; const cc = [[210, 90, 110], [230, 200, 110], [240, 236, 220], [140, 110, 210]][i % 4]; buf.set(px, py, cc); buf.set(px + 1, py, mix(cc, [0, 0, 0], 0.3)); buf.set(px, py + 1, [50, 80, 36]); }
    });
    // --- door
    if (b.door) {
      const dw = b.door.w || 16, dh = 25, dx = x0 + b.door.x - dw / 2, dy = wy1 - 8 - dh + 6;
      buf.fill(dx - 3, dy - 4, dx + dw + 3, wy1 - 2, (x, y) => { const d = Math.abs(x + 0.5 - (dx + dw / 2)) / (dw / 2 + 3); return (y - (dy - 4)) >= (1 - Math.sqrt(Math.max(0, 1 - d * d))) * 6 ? pick(P.stoneW, 0.7 - (H3(x >> 2, y >> 2, 3) * 0.2)) : null; });
      buf.fill(dx, dy, dx + dw, wy1 - 2, (x, y) => {
        const d = Math.abs(x + 0.5 - (dx + dw / 2)) / (dw / 2); if ((y - dy) < (1 - Math.sqrt(Math.max(0, 1 - d * d))) * 5) return null;
        if (b.door.open) return mix(pick(P.glass, 0.7 - (y - dy) / dh * 0.4), [120, 50, 10], ((x - dx) / dw) * 0.3);
        const pl = (x - dx) % 4 === 0; let l = pl ? 0.1 : 0.5 + (vnoise(x * 0.3, y * 0.06, 29) - 0.5) * 0.35; if (y === dy + 7 || y === wy1 - 7) l = 0.2; return pick(P.door, l);
      });
      if (!b.door.open) { buf.set(dx + dw - 4, dy + 12, [230, 190, 90]); buf.set(dx + dw - 4, dy + 13, [120, 80, 30]); }
      else emit.push({ kind: 'door', x: dx, y: dy, w: dw, h: wy1 - 2 - dy });
      // step
      buf.fill(dx - 4, wy1 - 2, dx + dw + 4, wy1, (x, y) => pick(P.quay, y === wy1 - 2 ? 0.85 : 0.5));
      b._door = [dx + dw / 2, wy1];
      // wall lamp beside the door
      if (b.lamp !== false) { const lx = dx + dw + 6, ly = dy + 2; buf.fill(lx - 2, ly - 1, lx + 3, ly + 6, (x, y) => y === ly - 1 || y === ly + 5 ? [30, 28, 30] : pick(P.glass, 0.95)); emit.push({ kind: 'lamp', x: lx, y: ly + 2 }); }
    }
    // --- awning
    if (b.awning) {
      const ax = x0 + b.awning.x - b.awning.w / 2, ay = lowY - 10, aw = b.awning.w;
      buf.fill(ax, ay, ax + aw, ay + 12, (x, y) => { const st = Math.floor((x - ax) / 6) & 1; const R2 = st ? P.awnR : P.awnW; return pick(R2, 0.75 - (y - ay) / 12 * 0.45 + ((y - ay) === 11 ? -0.3 : 0)); });
      for (let x = ax; x < ax + aw; x += 6) for (let k = 0; k < 3; k++) buf.set(x + 3, ay + 12 + k - (k === 2 ? 0 : 0), mix(pick(Math.floor((x - ax) / 6) & 1 ? P.awnR : P.awnW, 0.3), [0, 0, 0], 0.2));
    }
    // --- roof
    const hip = b.hip ? Math.min(roofH * 0.9, 34) : 0;
    const ridgeY = ry0 + Math.round(roofH * 0.38);
    buf.fill(x0 - over, ry0, x1 + over, ry1 + 4, (x, y) => {
      const lx = x - x0, ly = y - ry0;
      if (y >= ry1 + 3 && (x < x0 - over + 2 || x > x1 + over - 3)) return null;
      // hip ends: triangles cut in from the sides (above the eave)
      let side = 0;
      if (hip && y < ry1) { const t = (y - ry0) / (ridgeY - ry0); const inset = y < ridgeY ? hip * (1 - t) : 0; if (lx < -over + inset) return null; if (lx > b.tw * TS + over - inset) return null; if (y < ridgeY) { if (lx < -over + hip * 1.0 - (y - ry0) * (hip / (ridgeY - ry0)) * 0 && lx < inset + 10) side = -1; } }
      const back = y < ridgeY;
      // shingles
      const rh = 6, row = Math.floor((y - ry0) / rh), off = (row & 1) * 5, col = Math.floor((x + off) / 10), ey = (y - ry0) - row * rh, ex = (x + off) - col * 10;
      let l = back ? 0.62 - (ridgeY - y) / (ridgeY - ry0) * 0.12 : 0.46 - (y - ridgeY) / (ry1 - ridgeY) * 0.14;
      l += (H3(col, row, sid) - 0.5) * 0.22 + (vnoise(x * 0.2, y * 0.2, 13) - 0.5) * 0.12;
      if (ey === rh - 1) l -= 0.3; else if (ey === 0) l += 0.08;
      if (ex === 0 && ey < rh - 1) l -= 0.18;
      l += (1 - (x - x0 + over) / (b.tw * TS + over * 2)) * 0.1; // moon from the left
      if (Math.abs(y - ridgeY) < 2) l = y < ridgeY ? 0.82 : 0.68; // ridge cap
      if (y >= ry1) l = 0.12 - (y - ry1) * 0.03; // eave underside
      if (x < x0 - over + 2) l -= 0.15; if (x > x1 + over - 3) l -= 0.25; // fascia
      if (vnoise(x * 0.15, y * 0.3, sid + 3) > 0.8 && !back) return mix(pick(RR, l), [70, 90, 50], 0.35); // moss
      return pick(RR, l);
    });
    // hip end faces: redraw the triangles darker/lighter
    if (hip) {
      buf.fill(x0 - over, ry0, x0 - over + hip, ridgeY, (x, y) => { const t = (y - ry0) / (ridgeY - ry0), lim = x0 - over + hip * (1 - t); return x >= lim - 0.5 && x < lim + hip * 0.9 * (1 - t) + 0 ? null : null; });
    }
    // chimney
    if (b.chimney != null) {
      const cx = x0 + b.chimney, cy = ry0 + 2;
      buf.fill(cx, cy - 16, cx + 12, cy + 10, (x, y) => { const row = Math.floor((y - cy + 16) / 4), ex = (x - cx + (row & 1) * 3) % 6; if (y < cy - 14) return pick(P.quay, 0.85); if (ex === 0 || (y - cy + 16) % 4 === 0) return [40, 30, 28]; return pick(P.terra, 0.55 + (H3(x >> 1, row, 5) - 0.5) * 0.3 - (x - cx) * 0.03); });
      buf.fill(cx - 1, cy - 17, cx + 13, cy - 14, (x, y) => pick(P.quay, y === cy - 17 ? 0.9 : 0.5));
      emit.push({ kind: 'smoke', x: cx + 6, y: cy - 18 });
    }
    // hanging sign with an icon
    if (b.sign) {
      const sx = x0 + b.sign.x, sy = wy0 + 12;
      buf.fill(sx - 1, sy - 4, sx + 12, sy - 2, () => [24, 22, 24]);
      buf.fill(sx + 1, sy - 2, sx + 13, sy + 11, (x, y) => (x === sx + 1 || x === sx + 12 || y === sy - 2 || y === sy + 10) ? pick(P.timber, 0.2) : pick(P.door, 0.62 + (vnoise(x, y * 0.3, 3) - 0.5) * 0.2));
      emit.push({ kind: 'sign', x: sx + 7, y: sy + 4, icon: b.sign.kind });
    }
    const c = buf.done();
    // sign icons drawn with the vector set (small, crisp enough at art px)
    return { canvas: c, ox: x0, oy: wy1, emit, x: b.tx * TS, y: (b.ty + b.th) * TS, b, W, H, ry0, x0 };
  }

  // ------------------------------------------------------------------ props (rasterizer)
  const M = {
    iron: G.RIG.M.iron, gold: G.RIG.M.gold, wood: G.RIG.M.wood,
    stone: mat({ keys: ['#1e1c20', '#36343a', '#57545a', '#7c7876', '#a29d94', '#c4bdb0'], n: 7, tex: 1.6, tsx: 0.5, tsy: 0.5 }),
    barrel: mat({ keys: ['#1c1008', '#3c2412', '#62401e', '#8a6030', '#b4884c'], n: 7, tex: 1.5, tsx: 1.5, tsy: 0.2 }),
    crate: mat({ keys: ['#241408', '#4a2e14', '#74502a', '#9c7442', '#c8a068'], n: 7, tex: 1.2, tsx: 0.15, tsy: 1 }),
    chestLid: mat({ keys: ['#3a0e08', '#6a1e10', '#9e3418', '#c85426', '#ec8040'], n: 7, tex: 0.6, tsx: 0.2, tsy: 1 }),
    chestBody: mat({ keys: ['#241008', '#42200e', '#643218', '#864a26'], n: 6, tex: 0.8, tsx: 0.15, tsy: 1 }),
    brightGold: mat({ keys: ['#5a3a08', '#a8741c', '#e8b83c', '#ffe27a', '#fff8d0'], n: 7, metal: true, spec: 1, specPow: 8 }),
    leaf: ENV.EM.leaf, pine: ENV.EM.pine, bark: ENV.EM.bark,
    water: mat({ keys: ['#0e2a3a', '#1c4a5e', '#2e6e84', '#5aa0b4', '#a8dce4'], n: 6, spec: 1, specPow: 20 }),
    glowW: mat({ keys: ['#c05a10', '#ff9a30', '#ffd070', '#fff4c8'], n: 4, flat: true, glow: '#ffd070' }),
    glowC: mat({ keys: ['#1a6a7a', '#40c0d0', '#a0f4f0', '#f0ffff'], n: 4, flat: true, glow: '#a0f4f0' }),
    cloth: mat({ keys: ['#3a0e0e', '#5e1a18', '#862a24', '#a84436', '#c8664e'], n: 6, tex: 0.6, tsx: 1, tsy: 0.3 }),
    rope: mat({ keys: ['#3a2c1a', '#6a5634', '#9a8456', '#c4b07c'], n: 5 }),
    sail: mat({ keys: ['#5a5446', '#8a8270', '#b8ae96', '#dcd2b8'], n: 5, tex: 0.5, tsx: 0.3, tsy: 1.2 }),
    fish: mat({ keys: ['#28323c', '#4a5a68', '#7a8c98', '#b8c8cc'], n: 5, metal: true, spec: 0.6 }),
    fruit: mat({ keys: ['#4a1408', '#8a2a10', '#c84a1c', '#f07a30'], n: 5 }),
    paper: mat({ keys: ['#6a6254', '#a8a090', '#d8d2c2', '#f6f2e8'], n: 5 }),
    crystal: mat({ keys: ['#10304a', '#1e6a8a', '#40b0c8', '#9af0f0', '#e8ffff'], n: 7, spec: 1, specPow: 6, glow: '#8af0f0' }),
  };
  G.TD_M = M;
  function render(B, o) { return RZ.render(B, Object.assign({}, STYLE, { light: FL }, o || {})); }
  const PROPS = {
    lamp(B) { // street lamp post, 52 tall
      const post = mat({ keys: ['#08080c', '#1c1e26', '#343844', '#5a6070'], n: 5, metal: true, spec: 0.6 });
      B.ell(0, -1, 4, 2, post, 0); B.cap(0, -2, 0, -44, 1.7, 1.3, post, 0.1);
      B.cap(0, -40, 5, -42, 0.8, 0.8, post, 0.2);
      B.poly([[1.5, -50], [8.5, -50], [7.5, -41], [2.5, -41]], M.glowW, 0.3, { bevel: 0.1 });
      B.poly([[0.5, -50], [9.5, -50], [5, -55]], post, 0.4, { bevel: 1 });
      return { light: [5, -46] };
    },
    barrel(B) { const g = B.group(); B.cap(0, -3, 0, -13, 6.5, 6.5, M.barrel, 0, { g }); B.ell(0, -16, 6.2, 2.4, M.barrel, 0.05, { g: B.group(), shadeOff: -1, bulge: 0.2 }); [-5, -13].forEach((by) => B.cap(-6.6, by, 6.6, by, 0.9, 0.9, M.iron, 0.02)); },
    crate(B) { B.poly([[-8, 0], [8, 0], [8, -12], [-8, -12]], M.crate, 0, { bevel: 1.5 }); B.poly([[-8, -12], [8, -12], [6, -18], [-6, -18]], M.crate, 0.01, { bevel: 1.2, ny: -0.8, g: B.group() }); B.cap(-7, -1.5, 7, -10.5, 0.8, 0.8, M.crate, 0.02, { shadeOff: 1 }); },
    bollard(B) { B.cap(0, -1, 0, -9, 3.2, 2.8, M.iron, 0); B.ell(0, -10, 3.4, 1.8, M.iron, 0.1); },
    chest(B, o) { // WORLD_REDESIGN §6.3: bright lid, gold trim, readable on any floor
      o = o || {};
      B.poly([[-10, 0], [10, 0], [10, -10], [-10, -10]], M.chestBody, 0, { bevel: 1.4 });
      if (o.open) { B.poly([[-10, -10], [10, -10], [9, -13], [-9, -13]], mat({ keys: ['#080404', '#140a08'], n: 2, flat: true }), 0.05); B.poly([[-10, -12], [10, -12], [10, -22], [-10, -22]], M.chestLid, 0.1, { bevel: 1.4, ny: 0.4 }); }
      else { B.poly([[-10.5, -9], [10.5, -9], [10, -16], [7, -19], [-7, -19], [-10, -16]], M.chestLid, 0.1, { bevel: 2.5, ny: -0.5 }); B.rect(-10.5, -10, 21, 2, M.brightGold, 0.2); }
      [-6.5, 6.5].forEach((x) => B.rect(x - 1.2, o.open ? -22 : -19, 2.4, o.open ? 22 : 19, M.brightGold, 0.25));
      if (!o.open) B.rect(-2, -12, 4, 4.5, M.brightGold, 0.3);
    },
    beacon(B) { // the town's great lamp: stone column with a brazier (town centre)
      B.ell(0, -2, 15, 6, M.stone, 0, { bulge: 0.5 });
      B.poly([[-11, -2], [11, -2], [11, -8], [-11, -8]], M.stone, 0.05, { bevel: 2 });
      B.cap(0, -8, 0, -40, 5.5, 4.5, M.stone, 0.1);
      B.ell(0, -42, 9, 3.5, M.iron, 0.2, { bulge: 0.4 }); B.poly([[-9, -42], [9, -42], [6, -48], [-6, -48]], M.iron, 0.25, { bevel: 1.5 });
      B.ell(0, -50, 5.5, 4.5, M.glowW, 0.3); B.ell(-1, -55, 3, 4, M.glowW, 0.35);
      return { light: [0, -50] };
    },
    tree(B, o) { const R = rng(o && o.seed || 3); ENV.roundTree(B, 0, 0, (o && o.h) || 56, R, 0, M.leaf); },
    pine(B, o) { const R = rng(o && o.seed || 3); ENV.conifer(B, 0, 0, (o && o.h) || 56, R, 0); },
    bush(B, o) { const R = rng(o && o.seed || 5); for (let i = 0; i < 7; i++) B.ell((R() - 0.5) * 16, -5 - R() * 6, 5 + R() * 3, 4 + R() * 2, M.leaf, 0.1 + i * 0.01, { bulge: 0.85 }); },
    stall(B) { // market stall with a striped awning and wares
      [-14, 14].forEach((x) => B.cap(x, 0, x, -26, 1, 1, M.wood, 0));
      B.poly([[-17, -10], [17, -10], [17, -16], [-17, -16]], M.crate, 0.1, { bevel: 1.5 });
      for (let i = 0; i < 5; i++) B.ell(-11 + i * 5.5, -18, 2.6, 1.6, i % 2 ? M.fish : M.fruit, 0.2 + i * 0.01);
      for (let i = 0; i < 6; i++) B.poly([[-18 + i * 6, -26], [-12 + i * 6, -26], [-12 + i * 6, -33], [-18 + i * 6, -33]], i % 2 ? M.cloth : M.sail, 0.3, { bevel: 1, ny: -0.6 });
    },
    board(B) { // notice board (掲示板)
      [-9, 9].forEach((x) => B.cap(x, 0, x, -26, 1.2, 1.2, M.wood, 0));
      B.poly([[-12, -12], [12, -12], [12, -28], [-12, -28]], M.crate, 0.1, { bevel: 1.2 });
      B.poly([[-13, -28], [13, -28], [10, -32], [-10, -32]], M.wood, 0.15, { bevel: 1 });
      [[-8, -26, 7, 8], [1, -25, 8, 6], [-6, -17, 6, 4], [3, -18, 6, 5]].forEach(([x, y, w, h]) => B.rect(x, y, w, h, M.paper, 0.2));
    },
    bench(B) { B.poly([[-12, -5], [12, -5], [12, -8], [-12, -8]], M.crate, 0.1, { bevel: 1 }); [-9, 9].forEach((x) => B.cap(x, 0, x, -5, 0.8, 0.8, M.iron, 0)); B.poly([[-12, -9], [12, -9], [12, -13], [-12, -13]], M.crate, 0.05, { bevel: 1, ny: -0.5 }); },
    table(B) { B.ell(0, -9, 10, 5, M.crate, 0.1, { bulge: 0.4 }); B.cap(0, 0, 0, -9, 1.2, 1.2, M.wood, 0); B.ell(-4, -12, 2, 1.6, M.paper, 0.2); B.ell(4, -11, 1.6, 2.4, M.glowW, 0.2); return { light: [4, -12], small: true }; },
    rowboat(B) { B.poly([[-24, -2], [22, -2], [28, -9], [20, -14], [-22, -14], [-28, -8]], M.barrel, 0, { bevel: 4, ny: -0.3 }); B.poly([[-19, -5], [18, -5], [22, -9], [17, -12], [-18, -12], [-22, -8]], mat({ keys: ['#1a0e08', '#2e1c10', '#44301c'], n: 3 }), 0.1, { bevel: 2 }); [-8, 6].forEach((x) => B.rect(x, -13, 3, 9, M.crate, 0.2)); },
    ship(B) { // small fishing ship, deck seen from above-front
      B.poly([[-70, -4], [56, -4], [84, -18], [60, -34], [-66, -34], [-78, -20]], M.barrel, 0, { bevel: 6, ny: -0.2 });
      B.poly([[-62, -10], [52, -10], [74, -19], [54, -30], [-60, -30], [-70, -20]], M.crate, 0.1, { bevel: 2, ny: -0.6 });
      B.poly([[-44, -14], [-18, -14], [-18, -30], [-44, -30]], M.barrel, 0.2, { bevel: 2, ny: -0.2 });
      B.poly([[-46, -30], [-16, -30], [-20, -36], [-42, -36]], M.stone, 0.25, { bevel: 1.5, ny: -0.8 });
      B.cap(12, -20, 12, -118, 2.4, 1.8, M.wood, 0.3);
      B.cap(-24, -80, 46, -80, 1.2, 1.2, M.wood, 0.31);
      B.poly([[-22, -80], [44, -80], [40, -88], [-18, -88]], M.sail, 0.32, { bevel: 2, ny: -0.3 });
      B.cap(12, -118, 70, -22, 0.35, 0.35, M.rope, 0.29); B.cap(12, -118, -60, -24, 0.35, 0.35, M.rope, 0.29);
      B.poly([[9, -100], [15, -100], [15, -93], [9, -93]], M.glowW, 0.34, { bevel: 0.2 });
      for (let i = 0; i < 3; i++) B.cap(-2 + i * 10, -14, -2 + i * 10, -24, 5, 5, M.barrel, 0.22 + i * 0.01);
      return { light: [12, -96] };
    },
    net(B) { for (let i = 0; i < 6; i++) B.ell(-8 + i * 3, -2 - (i % 2), 4, 2, M.rope, 0.1 + i * 0.01, { bulge: 0.3 }); },
    well(B) {
      B.ell(0, -3, 16, 8, M.stone, 0, { bulge: 0.6 }); B.ell(0, -9, 13, 6, mat({ keys: ['#04080c', '#0a1620', '#12283a'], n: 3 }), 0.1, { bulge: 0.2 });
      B.ell(0, -9.5, 10, 4.2, M.water, 0.12, { bulge: 0.1 });
    },
    crystal(B, o) { const R = rng(o && o.seed || 3); for (let i = 0; i < 5; i++) { const a = (R() - 0.5) * 1.2, h = 10 + R() * 16, x = (R() - 0.5) * 12; B.poly([[x - 3, 0], [x + 3, 0], [x + 2 + Math.sin(a) * h, -h * 0.8], [x + Math.sin(a) * h, -h], [x - 2 + Math.sin(a) * h, -h * 0.8]], M.crystal, 0.1 + i * 0.01, { bevel: 2 }); } return { light: [0, -12], cyan: true }; },
    torch(B) { B.cap(0, 0, 0, -8, 1.3, 1, M.iron, 0); B.ell(0, -10, 3, 2, M.iron, 0.1); B.ell(0, -13, 2.6, 3.4, M.glowW, 0.2); return { light: [0, -13] }; },
    spring(B) { // healing spring (WORLD_REDESIGN §6.2)
      B.ell(0, -3, 28, 13, M.stone, 0, { bulge: 0.5 }); B.ell(0, -7, 24, 10, M.stone, 0.05, { bulge: 0.3 });
      B.ell(0, -8, 20, 8, M.water, 0.1, { bulge: 0.15 });
      B.cap(0, -8, 0, -26, 4.5, 3.6, M.stone, 0.2); B.ell(0, -28, 8, 3.4, M.stone, 0.25, { bulge: 0.4 }); B.ell(0, -29, 6, 2.2, M.water, 0.3, { bulge: 0.1 });
      return { light: [0, -24], cyan: true, big: true };
    },
    rock(B, o) { const R = rng(o && o.seed || 7); ENV.rock(B, 0, 0, (o && o.s) || 10, R, 0, !!(o && o.moss)); },
    stairs(B) { for (let i = 0; i < 4; i++) B.poly([[-14 + i, -i * 5], [14 - i, -i * 5], [14 - i, -i * 5 - 5], [-14 + i, -i * 5 - 5]], M.stone, i * 0.01, { bevel: 1, ny: -0.6 }); },
    grave(B) { B.poly([[-6, 0], [6, 0], [6, -14], [3, -18], [-3, -18], [-6, -14]], M.stone, 0, { bevel: 2 }); },
    tent(B) { B.poly([[-18, 0], [18, 0], [0, -26]], M.sail, 0, { bevel: 3, ny: -0.2 }); B.poly([[-4, 0], [4, 0], [0, -12]], mat({ keys: ['#100806', '#241410'], n: 2 }), 0.1); },
  };
  const propCache = {};
  function prop(kind, o) {
    o = o || {};
    const key = kind + JSON.stringify(o);
    if (propCache[key]) return propCache[key];
    const B = new RZ.Builder(); const meta = PROPS[kind](B, o) || {};
    const r = render(B, { scale: o.scale || 1, flip: !!o.flip, sat: o.sat || 0.9 });
    r.meta = meta; return (propCache[key] = r);
  }

  // ------------------------------------------------------------------ scene assembly helpers
  function shadowBlob(ctx, x, y, rx, ry, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(6,6,16,${a})`); g.addColorStop(0.6, `rgba(6,6,16,${a * 0.6})`); g.addColorStop(1, 'rgba(6,6,16,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
  }
  // moon shadow of a sprite: silhouette sheared to the lower right, blurred
  function spriteShadow(ctx, r, x, y, a, len) {
    const s = mk(r.canvas.width, r.canvas.height), sx = s.getContext('2d');
    sx.drawImage(r.canvas, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = 'rgb(8,8,20)'; sx.fillRect(0, 0, s.width, s.height);
    ctx.save(); ctx.globalAlpha = a; ctx.filter = 'blur(1.2px)';
    ctx.setTransform(1, 0, -(len || 0.7), 0.45, 0, 0); // shear: up in sprite → right on the ground
    // transform maps (px,py) → (px - len*py, 0.45*py); place so the feet stay at (x,y)
    ctx.setTransform(1, 0, -(len || 0.7), 0.45, x, y);
    ctx.drawImage(s, -r.ox, -r.oy); ctx.restore();
  }

  // compose a scene: ground (canvas), faces, sprites [{r, x, y, z?, shadow}], lights, emissive → canvas (art px)
  function lightmap(ctx, W, H, amb, lights) {
    const lm = mk(W, H), lx = lm.getContext('2d');
    lx.fillStyle = amb; lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const { x, y, r, c, k } = L, sy = L.sy || 0.8;
      lx.save(); lx.translate(x, y); lx.scale(1, sy);
      const g = lx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${k})`); g.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},${k * 0.6})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      lx.fillStyle = g; lx.fillRect(-r, -r, r * 2, r * 2); lx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lm, 0, 0); ctx.restore();
  }
  function glowA(ctx, x, y, r, c, a) { ENV.glow(ctx, x, y, r, c, a); }

  // ================================================================== TOWN: 港町ファロス (pier town)
  // ================================================================== TOWN: 港町ファロス (pier town, WORLD_REDESIGN §5.3)
  // upper town (buildings + beacon plaza) → retaining wall with stairs → harbour promenade → piers over the sea
  const TW_W = 32, TW_H = 38, PLAZA = [11, 10.2];
  function townTile(tx, ty) {
    if (tx < 0 || tx >= TW_W || ty < 0) return '.';
    if (ty >= TW_H) return '~';
    if (ty === 13) return tx >= 14 && tx <= 17 ? 's' : 'w';       // retaining wall face / stairs
    if (ty === 14 || ty === 15) return 'p';                         // promenade
    if (ty >= 16) {
      if ((tx === 6 || tx === 7) && ty <= 30) return '=';
      if ((tx === 22 || tx === 23) && ty <= 33) return '=';
      if (tx >= 24 && tx <= 30 && ty >= 26 && ty <= 30) return '=';   // shed platform
      if (tx >= 11 && tx <= 13 && ty >= 32 && ty <= 34) return 'r';   // beacon rock
      return '~';
    }
    if (ty >= 8 && ty <= 12 && tx >= 3 && tx <= 27) return '_';
    if ((tx <= 2 || tx >= 29) && ty >= 9 && ty <= 12) return ',';
    if (ty <= 5 && (tx === 8 || tx === 19 || tx === 26)) return 'a';
    return '.';
  }
  const BUILDINGS = [
    { name: 'inn', tx: 0, ty: 0, tw: 8, th: 6, wall: 3, roof: 'slate', mat: 'plaster', door: { x: 96 }, windows: [30, 60, 150, 200, 232], win2: [30, 70, 130, 180, 226], chimney: 196, sign: { x: 112, kind: 'inn' }, beam: true, shutters: 'b', flowers: true, dormers: [60, 180] },
    { name: 'tavern', tx: 9, ty: 0, tw: 10, th: 6, wall: 3, roof: 'terra', mat: 'stone', door: { x: 160, w: 18, open: true }, windows: [40, 96, 220, 276], win2: [40, 110, 200, 276], chimney: 60, sign: { x: 182, kind: 'mug' }, hip: true },
    { name: 'shop', tx: 20, ty: 1, tw: 6, th: 5, wall: 2, roof: 'slate', mat: 'plaster', door: { x: 132 }, windows: [36, 84], sign: { x: 150, kind: 'bag' }, awning: { x: 60, w: 80 }, shutters: 'g', hip: true },
    { name: 'house', tx: 27, ty: 0, tw: 6, th: 6, wall: 3, roof: 'terra', mat: 'plaster', door: { x: 50 }, windows: [110, 160], win2: [30, 110, 160], chimney: 150, shutters: 'b', flowers: true, beam: true, dormers: [90] },
    { name: 'shed', tx: 25, ty: 26, tw: 5, th: 4, wall: 2, roof: 'slate', mat: 'plank', door: { x: 80, w: 20 }, windows: [34], sign: { x: 104, kind: 'anchor' } },
  ];
  function plazaAt(x, y) {
    const cx = PLAZA[0] * TS, cy = PLAZA[1] * TS, dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 1.25, r = Math.hypot(dx, dy);
    if (r < 150) {
      const ring = Math.floor(r / 13), er = r - ring * 13, circ = Math.max(1, Math.round(2 * Math.PI * (ring * 13 + 6) / 16));
      const a = (Math.atan2(dy, dx) / (2 * Math.PI) + 0.5 + (ring & 1) * 0.5 / circ), seg = Math.floor(a * circ), ea = (a * circ - seg);
      if (er < 1 || ea < 0.06 * (8 / Math.max(3, ring))) return P.flagMortar;
      let l = 0.5 + (H3(seg, ring, 2) - 0.5) * 0.3 + (vnoise(x * 0.4, y * 0.4, 7) - 0.5) * 0.18 + (ring % 4 === 0 ? 0.12 : 0);
      if (er < 2.2) l += 0.1; if (er > 11) l -= 0.12;
      return pick(P.flag, l);
    }
    return flagAt(x, y);
  }
  function townGround() {
    const W = TW_W * TS, H = TW_H * TS, buf = new Buf(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const jx = x + (vnoise(x * 0.08, y * 0.08, 51) - 0.5) * 14, jy = y + (vnoise(x * 0.08, y * 0.08, 52) - 0.5) * 14;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS), t = townTile(tx, ty), ts = townTile(Math.floor(jx / TS), Math.floor(jy / TS));
      let c;
      if (t === '~') c = waterAt(x, y);
      else if (t === '=') c = plankAt(x, y, tx >= 24 && ty >= 26 ? true : false);
      else if (t === 'r') c = pick(P.quay, 0.4 + (vnoise(x * 0.12, y * 0.12, 61) - 0.5) * 0.6);
      else if (t === 'p') c = cobbleAt(x, y, { cw: 16, ch: 11, ramp: P.flag });
      else if (t === 'a') c = mix(cobbleAt(x, y), [10, 10, 18], 0.55);
      else if (t === 'w' || t === 's') c = [30, 28, 30];
      else if (ts === ',' && t !== '_') c = grassAt(x, y);
      else if (t === '_') c = plazaAt(x, y);
      else c = cobbleAt(x, y);
      // puddles on the street reflect the sky a little
      if (t === '.' && vnoise(x * 0.03, y * 0.05, 71) > 0.78) c = mix(c, [40, 56, 84], 0.45);
      const q = (y * W + x) * 4; buf.d[q] = c[0]; buf.d[q + 1] = c[1]; buf.d[q + 2] = c[2]; buf.d[q + 3] = 255;
    }
    // retaining wall (row 14): kerb on top, stone face, ivy; stairs in the middle
    const wy = 13 * TS;
    buf.fill(0, wy, W, wy + TS, (x, y) => {
      const tx = Math.floor(x / TS), e = y - wy;
      if (townTile(tx, 13) === 's') {
        const st = Math.floor(e / 8), es = e - st * 8, edge = x < 14 * TS + 4 || x >= 18 * TS - 4;
        if (edge) return pick(P.quay, 0.55 + (H3(st, x >> 2, 3) - 0.5) * 0.2 - (x >= 18 * TS - 4 ? 0.25 : 0));
        return pick(P.flag, es < 2 ? 0.85 : es > 5 ? 0.25 : 0.55 - st * 0.03 + (vnoise(x * 0.3, y, 4) - 0.5) * 0.15);
      }
      if (e < 4) return pick(P.quay, e === 0 ? 0.95 : 0.7 + (H3(x >> 4, 1, 2) - 0.5) * 0.2);
      const row = Math.floor((e - 4) / 7), k = Math.floor((x + (row & 1) * 8) / 16), ex = (x + (row & 1) * 8) % 16, ey = (e - 4) % 7;
      if (ex === 0 || ey === 0) return [22, 20, 24];
      let l = 0.42 + (H3(k, row, 7) - 0.5) * 0.3 - e * 0.006 + (vnoise(x * 0.4, y * 0.4, 5) - 0.5) * 0.15;
      if (ey === 1) l += 0.1;
      const c = pick(P.quay, l);
      if (vnoise(x * 0.07, 0, 81) > 0.62 && e < 4 + vnoise(x * 0.3, 1, 82) * 22) return pick(P.grass, 0.35 + (vnoise(x * 0.9, y * 0.9, 83) - 0.5) * 0.6); // ivy
      return c;
    });
    // AO under the retaining wall
    for (let x = 0; x < W; x++) for (let k = 0; k < 8; k++) { if (townTile(Math.floor(x / TS), 13) === 's') continue; buf.set(x, 14 * TS + k, [8, 8, 16], 0.5 * (1 - k / 8)); }
    // quay: kerb + face above the water; piers: beam, pilings, shadow
    for (let ty = 0; ty < TW_H; ty++) for (let tx = 0; tx < TW_W; tx++) {
      const t = townTile(tx, ty); if (t === '~') continue;
      const below = townTile(tx, ty + 1), x0 = tx * TS, y0 = ty * TS;
      const land = t === 'p' || t === 'r';
      if (below === '~') {
        if (land) {
          buf.fill(x0, y0 + TS - 4, x0 + TS, y0 + TS, (x, y) => { const k = Math.floor(x / 12); return x % 12 === 0 ? [26, 24, 26] : pick(P.quay, y === y0 + TS - 4 ? 0.9 : 0.62 + (H3(k, ty, 4) - 0.5) * 0.25); });
          buf.fill(x0, y0 + TS, x0 + TS, y0 + TS + 16, (x, y) => { const e = y - y0 - TS, row = Math.floor(e / 5), k = Math.floor((x + (row & 1) * 6) / 12), ex = (x + (row & 1) * 6) % 12; if (ex === 0 || e % 5 === 0) return [20, 20, 24]; const l = 0.44 - e * 0.02 + (H3(k, row + ty * 3, 6) - 0.5) * 0.3; const c = pick(P.quay, l); return e > 10 ? mix(c, [30, 64, 64], 0.5) : c; });
          buf.fill(x0, y0 + TS + 16, x0 + TS, y0 + TS + 19, (x, y) => (vnoise(x * 0.3, y, 9) > 0.45 ? [150, 180, 190] : null));
        } else if (t === '=') {
          buf.fill(x0, y0 + TS, x0 + TS, y0 + TS + 4, (x, y) => pick(P.plank, y === y0 + TS ? 0.7 : 0.25));
          buf.fill(x0, y0 + TS + 4, x0 + TS, y0 + TS + 20, (x, y) => { const px = (x - x0) % 16; if (px >= 2 && px < 6) return pick(P.plank, 0.35 - (y - y0 - TS) * 0.012 + (px === 2 ? 0.15 : 0)); return mix(buf.get(x, y), [4, 8, 14], 0.55 - (y - y0 - TS) * 0.02); });
        }
      }
      // pier sides: dark edge lines + shadow on the water to the right (moon from the upper left)
      if (t === '=') {
        if (townTile(tx - 1, ty) === '~') buf.fill(x0, y0, x0 + 2, y0 + TS, () => pick(P.plank, 0.15));
        if (townTile(tx + 1, ty) === '~') { buf.fill(x0 + TS - 2, y0, x0 + TS, y0 + TS, () => pick(P.plank, 0.12)); buf.fill(x0 + TS, y0, x0 + TS + 12, y0 + TS, (x, y) => mix(buf.get(x, y), [4, 8, 14], 0.5 * (1 - (x - x0 - TS) / 12))); }
      }
    }
    return buf;
  }
  function place(list, kind, tx, ty, o) { const r = prop(kind, o); list.push({ r, x: Math.round(tx * TS), y: Math.round(ty * TS), kind, o: o || {} }); return r; }
  function person(list, L, dir, frame, tx, ty, o) { const r = FIELD_CHAR.sprite(L, dir, frame, o); list.push({ r, x: Math.round(tx * TS), y: Math.round(ty * TS), kind: 'person', o: o || {} }); return r; }

  // draw sprites / buildings in y order + shadows; returns lights and emissive
  function composeScene(ctx, list, blds, opt) {
    opt = opt || {};
    const lights = [], emits = [];
    // building shadows first (moon from the upper left → lower right), soft
    { const sc = mk(ctx.canvas.width, ctx.canvas.height), sx = sc.getContext('2d');
      sx.fillStyle = 'rgb(0,0,0)';
      for (const bb of blds) { const b = bb.b, x = b.tx * TS, y = b.ty * TS, w = b.tw * TS, h = b.th * TS; sx.beginPath(); sx.moveTo(x + 4, y + h - 40); sx.lineTo(x + w + 4, y + h - 40); sx.lineTo(x + w + 26, y + h + 10); sx.lineTo(x + 26, y + h + 10); sx.closePath(); sx.fill(); }
      const bl = mk(sc.width, sc.height), bx = bl.getContext('2d'); bx.filter = 'blur(6px)'; bx.drawImage(sc, 0, 0);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(bl, 0, 0); ctx.restore();
      // ambient occlusion along the wall bases
      for (const bb of blds) { const b = bb.b, x = b.tx * TS - 2, y = (b.ty + b.th) * TS, w = b.tw * TS + 4; const g = ctx.createLinearGradient(0, y, 0, y + 9); g.addColorStop(0, 'rgba(0,0,8,0.55)'); g.addColorStop(1, 'rgba(0,0,8,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, 9); }
    }
    const items = list.map((it) => ({ y: it.y, it })).concat(blds.map((bb) => ({ y: bb.y, bb })));
    items.sort((a, b) => a.y - b.y);
    for (const { it } of items) if (it && it.kind !== 'flat') {
      if (it.kind === 'person') { shadowBlob(ctx, it.x, it.y - 1, 9, 3.5, 0.6); spriteShadow(ctx, it.r, it.x, it.y, 0.32, 0.8); }
      else if (it.o.noShadow) { /* flat */ }
      else { const w = it.r.canvas.width; shadowBlob(ctx, it.x, it.y - 1, Math.max(6, w * 0.42), Math.max(2.5, w * 0.14), 0.55); if (it.r.canvas.height > 24) spriteShadow(ctx, it.r, it.x, it.y, 0.3, 0.9); }
    }
    for (const e of items) {
      if (e.bb) {
        const bb = e.bb; ctx.drawImage(bb.canvas, bb.x - bb.x0, bb.y - bb.oy);
        for (const m of bb.emit) {
          const ex = bb.x - bb.x0 + m.x, ey = bb.y - bb.oy + m.y;
          if (m.kind === 'win') { emits.push({ kind: 'win', x: ex, y: ey, w: m.w, h: m.h }); lights.push({ x: ex + m.w / 2, y: bb.y + 14, r: 34, c: [255, 190, 110], k: 0.55, sy: 0.55 }); lights.push({ x: ex + m.w / 2, y: ey + m.h / 2, r: 18, c: [255, 200, 130], k: 0.6 }); }
          if (m.kind === 'door') { emits.push({ kind: 'door', x: ex, y: ey, w: m.w, h: m.h }); lights.push({ x: ex + m.w / 2, y: bb.y + 18, r: 58, c: [255, 180, 100], k: 0.9, sy: 0.6 }); }
          if (m.kind === 'lamp') { emits.push({ kind: 'lamp', x: ex, y: ey }); lights.push({ x: ex, y: bb.y + 10, r: 60, c: [255, 190, 110], k: 0.75, sy: 0.6 }); lights.push({ x: ex, y: ey, r: 22, c: [255, 210, 150], k: 0.8 }); }
          if (m.kind === 'sign') emits.push({ kind: 'sign', x: ex, y: ey, icon: m.icon });
          if (m.kind === 'smoke') emits.push({ kind: 'smoke', x: ex, y: ey });
        }
      } else {
        const it = e.it; ctx.imageSmoothingEnabled = false;
        ctx.drawImage(it.r.canvas, it.x - it.r.ox, it.y - it.r.oy);
        const m = it.r.meta;
        if (m && m.light) {
          const lx = it.x + m.light[0] * (it.o.scale || 1) * (it.o.flip ? -1 : 1), ly = it.y + m.light[1] * (it.o.scale || 1);
          const col = m.cyan ? [120, 230, 240] : [255, 188, 105];
          if (m.big) lights.push({ x: lx, y: it.y, r: 150, c: col, k: 1.0, sy: 0.65 });
          else if (m.small) lights.push({ x: lx, y: it.y, r: 40, c: col, k: 0.6, sy: 0.6 });
          else lights.push({ x: lx, y: it.y - 4, r: it.kind === 'beacon' ? 230 : it.kind === 'ship' ? 70 : 105, c: col, k: it.kind === 'beacon' ? 1.1 : 0.9, sy: 0.62 });
          lights.push({ x: lx, y: ly, r: 26, c: col, k: 0.7 });
          emits.push({ kind: 'point', x: lx, y: ly, cyan: m.cyan, big: it.kind === 'beacon' || m.big });
        }
        if (it.o.lantern) { const lx = it.x + (it.o.ldx || 8), ly = it.y - 7; lights.push({ x: lx, y: it.y, r: 88, c: [255, 196, 120], k: 0.95, sy: 0.7 }); emits.push({ kind: 'point', x: lx, y: ly, small: true }); }
        if (it.kind === 'chest' && !it.o.open) emits.push({ kind: 'sparkle', x: it.x + 7, y: it.y - 19 });
      }
    }
    return { lights, emits };
  }
  function drawEmissive(ctx, emits, t) {
    for (const e of emits) {
      if (e.kind === 'win') {
        ctx.save(); const g = ctx.createLinearGradient(0, e.y, 0, e.y + e.h); g.addColorStop(0, 'rgba(255,214,140,0.95)'); g.addColorStop(1, 'rgba(240,140,50,0.9)');
        ctx.fillStyle = g; ctx.fillRect(e.x, e.y, e.w, e.h); ctx.fillStyle = 'rgba(70,40,20,0.8)'; ctx.fillRect(e.x + Math.floor(e.w / 2), e.y, 1, e.h); ctx.fillRect(e.x, e.y + Math.floor(e.h * 0.45), e.w, 1); ctx.restore();
        glowA(ctx, e.x + e.w / 2, e.y + e.h / 2, 20, [255, 180, 90], 0.35);
      } else if (e.kind === 'door') {
        ctx.save(); const g = ctx.createLinearGradient(0, e.y, 0, e.y + e.h); g.addColorStop(0, 'rgba(255,220,150,0.95)'); g.addColorStop(1, 'rgba(230,130,50,0.9)'); ctx.fillStyle = g; ctx.fillRect(e.x + 1, e.y + 4, e.w - 2, e.h - 4); ctx.restore();
        glowA(ctx, e.x + e.w / 2, e.y + e.h / 2, 30, [255, 180, 90], 0.45);
      } else if (e.kind === 'lamp') { glowA(ctx, e.x, e.y, 16, [255, 200, 120], 0.8); ctx.fillStyle = '#fff2c8'; ctx.fillRect(e.x - 1, e.y - 1, 3, 3); }
      else if (e.kind === 'point') {
        const c = e.cyan ? [140, 240, 250] : [255, 196, 110];
        glowA(ctx, e.x, e.y, e.big ? 60 : e.small ? 14 : 26, c, e.big ? 0.8 : 0.75); glowA(ctx, e.x, e.y, e.big ? 16 : 6, [255, 250, 230], 0.9);
      } else if (e.kind === 'sparkle') {
        glowA(ctx, e.x, e.y, 16, [255, 240, 180], 0.7);
        ctx.fillStyle = '#fffbe8'; ctx.fillRect(e.x - 5, e.y, 11, 1); ctx.fillRect(e.x, e.y - 5, 1, 11); ctx.fillRect(e.x - 1, e.y - 1, 3, 3);
      } else if (e.kind === 'sign') {
        // painted icon on the board (vector, tiny), after the lightmap so it stays readable
        ctx.save(); ctx.translate(e.x - 5, e.y - 5); ctx.scale(10 / 24, 10 / 24); ctx.restore();
      } else if (e.kind === 'smoke') {
        ctx.save(); ctx.filter = 'blur(2px)'; for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(150,160,190,${0.18 - i * 0.03})`; ctx.beginPath(); ctx.arc(e.x + i * 4 + Math.sin(i) * 2, e.y - i * 7, 3 + i * 1.5, 0, 7); ctx.fill(); } ctx.restore();
      }
    }
  }
  function signIcons(ctx, emits, S) {
    // drawn in device px on the final canvas: little painted icons on hanging signs
    for (const e of emits) if (e.kind === 'sign') {
      const map = { inn: 'inn', mug: 'shop', bag: 'bag', anchor: 'warp', sword: 'sword' };
      const name = e.icon === 'mug' ? null : map[e.icon];
      ctx.save();
      if (e.icon === 'mug') { ctx.fillStyle = '#e8c070'; ctx.fillRect(e.x - 3, e.y - 3, 5, 6); ctx.fillRect(e.x + 2, e.y - 2, 2, 1); ctx.fillRect(e.x + 3, e.y - 2, 1, 4); ctx.fillRect(e.x + 2, e.y + 1, 2, 1); ctx.fillStyle = '#fff8e0'; ctx.fillRect(e.x - 3, e.y - 4, 5, 1); }
      else if (e.icon === 'inn') { ctx.fillStyle = '#e8c070'; ctx.fillRect(e.x - 4, e.y, 9, 2); ctx.fillRect(e.x - 4, e.y - 3, 1, 5); ctx.fillRect(e.x + 4, e.y - 1, 1, 3); ctx.fillStyle = '#fff8e0'; ctx.fillRect(e.x - 3, e.y - 2, 3, 2); }
      else if (e.icon === 'bag') { ctx.fillStyle = '#e8c070'; ctx.fillRect(e.x - 3, e.y - 1, 7, 5); ctx.fillRect(e.x - 1, e.y - 3, 3, 2); }
      else if (e.icon === 'anchor') { ctx.fillStyle = '#e8c070'; ctx.fillRect(e.x, e.y - 4, 1, 8); ctx.fillRect(e.x - 3, e.y + 3, 7, 1); ctx.fillRect(e.x - 3, e.y + 1, 1, 2); ctx.fillRect(e.x + 3, e.y + 1, 1, 2); ctx.fillRect(e.x - 2, e.y - 3, 5, 1); }
      else if (e.icon === 'sword') { ctx.fillStyle = '#e8e0d0'; for (let i = 0; i < 7; i++) ctx.fillRect(e.x - 3 + i, e.y + 3 - i, 1, 1); ctx.fillStyle = '#e8c070'; ctx.fillRect(e.x - 3, e.y + 1, 3, 1); ctx.fillRect(e.x - 2, e.y, 1, 3); }
      ctx.restore();
    }
  }
  function moonWater(ctx, W, H, isWater, lamps, seed) {
    // moon glitter + warm lamp reflections (short horizontal dashes) on water pixels only
    const R = rng(seed || 3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < W * H / 260; i++) {
      const x = Math.floor(R() * W), y = Math.floor(R() * H); if (!isWater(x, y)) continue;
      const k = 0.08 + R() * 0.16; ctx.fillStyle = `rgba(150,180,230,${k})`; ctx.fillRect(x, y, 3 + Math.floor(R() * 6), 1);
    }
    for (const L of lamps) for (let i = 0; i < 26; i++) {
      const y = L.y + 6 + Math.pow(R(), 0.8) * 70, x = L.x + (R() - 0.5) * (8 + (y - L.y) * 0.18);
      if (!isWater(Math.floor(x), Math.floor(y))) continue;
      ctx.fillStyle = `rgba(255,${170 + R() * 40},${90 + R() * 40},${0.5 * (1 - (y - L.y) / 80)})`; ctx.fillRect(Math.floor(x), Math.floor(y), 2 + Math.floor(R() * 5), 1);
    }
    ctx.restore();
  }

  // final: crop (art px) → device canvas ×2 with bloom, grade, vignette
  function present(src, vx, vy, vw, vh, opt) {
    opt = opt || {};
    const out = mk(vw * 2, vh * 2), o = out.getContext('2d');
    o.imageSmoothingEnabled = false; o.drawImage(src, vx, vy, vw, vh, 0, 0, vw * 2, vh * 2);
    if (opt.after) opt.after(o, vx, vy);
    ENV.post(o, { dofPx: 0, bloom: opt.bloom == null ? 0.6 : opt.bloom, thr: opt.thr || 0.62, vig: opt.vig == null ? 0.6 : opt.vig, grade: Object.assign({ sh: [-2, 2, 14], hi: [14, 6, -8], sat: 1.05, con: 1.08, lift: 0 }, opt.grade || {}) });
    return out;
  }

  const townCache = {};
  function town() {
    if (townCache.c) return townCache;
    const W = TW_W * TS, H = TW_H * TS;
    const g = townGround();
    const c = g.done(); const ctx = c.getContext('2d');
    const list = [];
    const blds = BUILDINGS.map(building);
    const LOOK = BATTLE_ART.LOOKS, NP = BATTLE_ART.NPC;
    place(list, 'beacon', PLAZA[0], PLAZA[1] + 0.35);
    [[3.4, 8.2], [27.6, 8.2], [3.4, 12.7], [27.6, 12.7], [13.3, 12.9], [18.7, 12.9], [1.5, 15.6], [30.5, 15.6], [22.5, 33.6], [7.5, 30.4]].forEach(([x, y]) => place(list, 'lamp', x, y));
    [[4, 15.8], [10, 15.8], [20, 15.8], [26, 15.8]].forEach(([x, y]) => place(list, 'bollard', x, y));
    place(list, 'stall', 21.2, 11.3); place(list, 'stall', 24.6, 11.3); place(list, 'board', 7.7, 7.4);
    place(list, 'bench', 6.2, 10.8); place(list, 'bench', 15.6, 9.2);
    place(list, 'table', 12.3, 6.9); place(list, 'table', 16.6, 6.9); place(list, 'barrel', 19.2, 6.5); place(list, 'barrel', 8.6, 6.4);
    place(list, 'barrel', 2.4, 14.9); place(list, 'barrel', 3.0, 15.4); place(list, 'crate', 1.4, 15.3); place(list, 'net', 27.6, 15.3); place(list, 'crate', 28.8, 14.8);
    place(list, 'tree', 1.2, 10.6, { h: 64, seed: 9 }); place(list, 'tree', 30.2, 10.8, { h: 60, seed: 4 }); place(list, 'bush', 1.8, 12.8, { seed: 3 }); place(list, 'bush', 29.6, 12.9, { seed: 8 });
    place(list, 'chest', 24.3, 15.3);
    place(list, 'ship', 14.2, 20.4); place(list, 'rowboat', 3.4, 21.6); place(list, 'rowboat', 26.6, 21.2, { flip: true });
    place(list, 'beacon', 12.5, 33.4, { scale: 1.3 });
    person(list, LOOK.arun, 'left', 1, 14.45, 11.7, { lantern: true, ldx: -4 });
    person(list, LOOK.selma, 'left', 2, 15.45, 11.7);
    person(list, LOOK.sylvan, 'left', 0, 16.45, 11.7);
    person(list, LOOK.viola, 'left', 1, 17.45, 11.7);
    person(list, NP.girl, 'right', 0, 13.15, 11.7);
    person(list, NP.merchant, 'down', 0, 21.2, 10.6);
    person(list, NP.sailor, 'down', 0, 12.5, 15.2);
    person(list, NP.innkeeper, 'down', 0, 3.9, 6.9);
    const { lights, emits } = composeScene(ctx, list, blds);
    lightmap(ctx, W, H, 'rgb(76,90,146)', lights);
    const isWater = (x, y) => townTile(Math.floor(x / TS), Math.floor(y / TS)) === '~';
    moonWater(ctx, W, H, isWater, lights.filter((L) => L.r >= 100).map((L) => ({ x: L.x, y: L.y + 14 })), 5);
    drawEmissive(ctx, emits);
    signIcons(ctx, emits);
    fireflies(ctx, W, H, 36, 17);
    Object.assign(townCache, { c, W, H, blds, list, tile: townTile });
    return townCache;
  }
  function fireflies(ctx, W, H, n, seed, cols) {
    const R = rng(seed); cols = cols || [[255, 210, 120], [150, 240, 220]];
    for (let i = 0; i < n; i++) { const x = R() * W, y = R() * H, c = cols[i % cols.length]; glowA(ctx, x, y, 7, c, 0.5); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1); }
  }

  G.TOPDOWN = { TS, Buf, P, pick, H3, cobbleAt, flagAt, plankAt, grassAt, waterAt, building, prop, place, person, composeScene, lightmap, drawEmissive, signIcons, moonWater, present, fireflies, shadowBlob, town, townTile };
})(window);
