// TERRAIN: 建物（V2_PLAN §2.5.7 hd:bld:<hash>・§2.6.1 objects[type:'building']、MODERN_UI §7.3）
// design/art_proto/ui/art_town.js の building() を移した。屋根（瓦の段・棟・軒の影・苔・寄棟・屋根窓）と正面の壁（漆喰・石積み・板・丸太・樹皮・
// 煉瓦、角石・梁・窓（夜は灯る）・よろい戸・花箱・扉・灯り・看板・日よけ）を 1 枚に焼く。
//
//   R.Terrain.building(def) → 'hd:bld:<hash>'   同じ中身の def は同じキー（登録は 1 回）。R.Hd.get(key, {tile}) で Sheet
//   Sheet: frames[0] = {c, ox, oy}（描く点 = 敷地の左下の角）、meta = {w, h, tile, door:{x, y}, emit:[…], roof:[x0, y0, x1, y1], footprint}
//   emit（描く点からの相対 px）: {kind:'win'|'door'|'lamp'|'sign'|'smoke', x, y, w?, h?}
//
// def の書き方（CONTENT）: {type:'building', id, x, y, w, h, wall: 2, roof: 'slate'|'terra'|'thatch'|'shingle'|'bark'|'moss',
//   mat: 'plaster'|'stone'|'plank'|'log'|'bark'|'brick', door: {x, y, to, open?}, windows: 2 | [px…], sign: 'inn'|'shop'|…, lamp: true,
//   chimney?, hip?, awning?, beam?, shutters?: 'b'|'g', flowers?, dormers?: n | [px…], win2?: n | [px…], small?}
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});

  let P = null;
  function pal() {
    if (P) return P;
    const r = T._u.ramp;
    P = {
      plaster: r(['#4e4a46', '#7a746a', '#a49c8c', '#c8bea8', '#e2d8c2', '#f0e8d6'], 8),
      stoneW: r(['#2e2824', '#4c423a', '#6c5e52', '#8c7c6c', '#a89886', '#c0b09a'], 8),
      brick: r(['#34160e', '#562618', '#7a3a24', '#9c5434', '#bc724c', '#d6946a'], 8),
      plank: r(['#241610', '#40281a', '#5c3e28', '#7a5838', '#96744c', '#b08e62'], 8),
      log: r(['#1e120a', '#3a2414', '#5a3a20', '#7a5230', '#966a40', '#b08456'], 8),
      barkW: r(['#1c140e', '#322418', '#4a3824', '#624c32', '#7c6242'], 7),
      quay: r(['#262426', '#403d40', '#5c5858', '#7c7670', '#9a9388', '#b4ab9c'], 8),
      slate: r(['#1a2232', '#2c3850', '#42526c', '#5a6c88', '#7a8ca6', '#9eaec6'], 8),
      terra: r(['#34160e', '#562618', '#7a3a24', '#9c5434', '#bc724c', '#d6946a'], 8),
      thatch: r(['#2a1e0c', '#4a3616', '#6e5424', '#927234', '#b4924a', '#ceae64'], 8),
      // 夜の掛け算で平らな暗い青の箱に見えないよう、明るい段まで持つ（CONTENT-F の依頼、P2）
      shingle: r(['#24160e', '#442c1a', '#664428', '#8a5e36', '#ae804c', '#c89c66'], 7),
      barkR: r(['#1e160e', '#3a2a1a', '#5a4428', '#7c6038', '#9c7e50', '#b89a6a'], 7),
      mossR: r(['#101a10', '#1c2e1a', '#2a4424', '#3c5c2e', '#54783a', '#6e9448'], 8),
      timber: r(['#180e08', '#2e1c0e', '#4a3018', '#664626', '#7e5c36'], 6),
      door: r(['#1e1008', '#38200e', '#54341a', '#704a28', '#8a603a'], 6),
      glass: r(['#7a3408', '#c0661c', '#ee9a3c', '#ffc86a', '#ffe6a8'], 6),
      shutterB: r(['#10202c', '#1c3446', '#2a4c62', '#3c6680', '#5a86a0'], 6),
      shutterG: r(['#12201a', '#1e3428', '#2e4c3a', '#44684e', '#5e8666'], 6),
      awnR: r(['#3a0e0e', '#5e1a18', '#862a24', '#a84436', '#c8664e'], 6),
      awnW: r(['#6a645a', '#9a9284', '#c4baa8', '#e2d8c4'], 5),
    };
    return P;
  }

  /** 32 art px の格子で書いた生成器を、tile の大きさ（倍率 s）の画素に落とす画素の入れ物 */
  class Buf {
    constructor(W, H, s) { this.s = s; this.W = Math.ceil(W * s); this.H = Math.ceil(H * s); this.d = new Uint8ClampedArray(this.W * this.H * 4); }
    put(rx, ry, c, a) {
      if (rx < 0 || ry < 0 || rx >= this.W || ry >= this.H) return;
      const q = (ry * this.W + rx) * 4, d = this.d;
      if (a != null && a < 1) { d[q] += (c[0] - d[q]) * a; d[q + 1] += (c[1] - d[q + 1]) * a; d[q + 2] += (c[2] - d[q + 2]) * a; d[q + 3] = Math.max(d[q + 3], 255 * a); }
      else { d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255; }
    }
    set(x, y, c, a) { const s = this.s; x = Math.floor(x); y = Math.floor(y); const x0 = Math.floor(x * s), y0 = Math.floor(y * s), x1 = Math.max(x0 + 1, Math.floor((x + 1) * s)), y1 = Math.max(y0 + 1, Math.floor((y + 1) * s)); for (let ry = y0; ry < y1; ry++) for (let rx = x0; rx < x1; rx++) this.put(rx, ry, c, a); }
    get(x, y) { const s = this.s, q = (Math.floor(y * s) * this.W + Math.floor(x * s)) * 4; return [this.d[q], this.d[q + 1], this.d[q + 2]]; }
    /** 仮想の範囲 [x0, x1) × [y0, y1) の実の画素ごとに f(仮想の x, y) */
    fill(x0, y0, x1, y1, f) {
      const s = this.s, rx0 = Math.max(0, Math.floor(x0 * s)), ry0 = Math.max(0, Math.floor(y0 * s)), rx1 = Math.min(this.W, Math.ceil(x1 * s)), ry1 = Math.min(this.H, Math.ceil(y1 * s));
      for (let ry = ry0; ry < ry1; ry++) {
        const y = Math.floor((ry + 0.5) / s); if (y < y0 || y >= y1) continue;
        for (let rx = rx0; rx < rx1; rx++) { const x = Math.floor((rx + 0.5) / s); if (x < x0 || x >= x1) continue; const c = f(x, y); if (c) this.put(rx, ry, c); }
      }
    }
    canvas() { const c = T._u.canvas(this.W, this.H); if (!c) return null; const g = c.getContext('2d'); const img = g.createImageData(this.W, this.H); img.data.set(this.d); g.putImageData(img, 0, 0); return c; }
  }

  const TS = 32;
  /** 地図の def → 生成器の形（b）。窓の数・扉の位置などは決まった規則と def の id の種で決める */
  function norm(def) {
    const U = T._u, tw = Math.max(1, def.w || 3), th = Math.max(2, def.h || 3);
    const wall = Math.max(1, Math.min(th - 1, def.wall != null ? def.wall : th >= 5 ? 3 : 2));
    const seed = R.U.hash(def.id || JSON.stringify(def));
    const b = {
      tw, th, wall, roof: def.roof || 'slate', mat: def.mat || 'plaster', seed: seed % 9973,
      hip: def.hip != null ? def.hip : (seed % 3 === 0 && def.roof !== 'thatch'),
      small: def.small != null ? def.small : wall <= 1, beam: def.beam != null ? def.beam : (def.mat || 'plaster') === 'plaster' && wall >= 3,
      shutters: def.shutters != null ? def.shutters : ['b', 'g', null][seed % 3], flowers: def.flowers != null ? def.flowers : seed % 2 === 0,
      lamp: def.lamp, sign: def.sign ? { x: 0, kind: def.sign } : null, awning: def.awning || null,
    };
    const Wpx = tw * TS;
    if (def.door) {
      const dxp = def.door.x != null ? (def.door.x - (def.x || 0)) * TS + TS / 2 : Wpx / 2;
      b.door = { x: U.clamp(dxp, 12, Wpx - 12), open: def.door.open != null ? def.door.open : !!def.sign, w: def.door.w, h: def.door.h };
    }
    // 窓: 数 → 位置（扉の周りを空けて等間隔）
    const place = (n) => {
      if (Array.isArray(n)) return n;
      const out = [], cand = [];
      for (let x = 22; x <= Wpx - 22; x += 6) if (!b.door || Math.abs(x - b.door.x) > 26) cand.push(x);
      if (!n || !cand.length) return out;
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = cand[Math.min(cand.length - 1, Math.floor(t * cand.length))]; if (!out.some((q) => Math.abs(q - x) < 22)) out.push(x); }
      return out;
    };
    const nWin = def.windows != null ? def.windows : Math.max(1, Math.floor(tw / 2));
    b.windows = place(nWin);
    if (wall >= 3) b.win2 = place(def.win2 != null ? def.win2 : typeof nWin === 'number' ? nWin + (b.door ? 1 : 0) : nWin.length);
    if (def.dormers != null) b.dormers = place(def.dormers);
    else if (th - wall >= 3 && tw >= 5) b.dormers = place(Math.floor(tw / 4));
    if (def.chimney !== false && b.roof !== 'moss') b.chimney = typeof def.chimney === 'number' ? def.chimney : Math.round(Wpx * (seed % 2 ? 0.72 : 0.22));
    if (b.sign) b.sign.x = b.door ? U.clamp(b.door.x + 16, 4, Wpx - 16) : Wpx / 2;
    if (b.awning === true) b.awning = { x: b.windows[0] || Wpx / 3, w: 60 };
    if (b.lamp == null) b.lamp = !!b.door;
    return b;
  }

  function roofRamp(p, roof) { return p[{ slate: 'slate', terra: 'terra', thatch: 'thatch', shingle: 'shingle', bark: 'barkR', moss: 'mossR' }[roof] || 'slate']; }
  function wallRamp(p, m) { return p[{ plaster: 'plaster', stone: 'stoneW', plank: 'plank', log: 'log', bark: 'barkW', brick: 'brick' }[m] || 'plaster']; }

  /** 建物 1 棟を焼く（art_town.js building() を移した。座標は 32 の格子の仮想 px） */
  function draw(b, s) {
    const U = T._u, p = pal(), pick = U.pick, mix = U.mix, clamp = U.clamp, vn = (x, y, sd) => U.vn(x, y, 1, sd), H3 = U.h3;
    const over = 6, top = 22, W = b.tw * TS + 12, wallH = b.wall * TS, roofH = (b.th - b.wall) * TS, Ht = top + roofH + wallH + 2;
    const buf = new Buf(W, Ht, s);
    const x0 = over, x1 = over + b.tw * TS, ry0 = top, ry1 = top + roofH, wy0 = ry1, wy1 = ry1 + wallH;
    const RR = roofRamp(p, b.roof), WR = wallRamp(p, b.mat), emit = [], sid = b.seed;
    // --- 正面の壁
    buf.fill(x0, wy0, x1, wy1, (x, y) => {
      const lx = x - x0, ly = y - wy0;
      let c;
      if (b.mat === 'stone' || b.mat === 'brick') {
        const rh = b.mat === 'brick' ? 5 : 8, bw = b.mat === 'brick' ? 11 : 18;
        const row = Math.floor(ly / rh), off = (row & 1) * (bw >> 1), col = Math.floor((lx + off) / bw), ex = lx + off - col * bw, ey = ly - row * rh;
        if (ex < 1 || ey < 1) c = b.mat === 'brick' ? [44, 24, 20] : [30, 26, 24];
        else { let l = 0.5 + (H3(col, row, sid) - 0.5) * 0.35 + (vn(x * 0.3, y * 0.3, 5) - 0.5) * 0.2; if (ey < 2) l += 0.12; if (ey > rh - 2) l -= 0.12; c = pick(WR, l); }
      } else if (b.mat === 'plank' || b.mat === 'log' || b.mat === 'bark') {
        if (b.mat === 'log') { const rh = 7, row = Math.floor(ly / rh), ey = ly - row * rh; let l = 0.72 - Math.abs(ey - 3) * 0.12 + (vn(x * 0.2, row, 3) - 0.5) * 0.25; if (ey === 0) l = 0.12; c = pick(WR, l); if (lx < 4 || lx >= b.tw * TS - 4) c = pick(WR, 0.35 + (ey < 2 ? 0.3 : 0)); }
        else if (b.mat === 'bark') { const n = vn(x * 0.35, y * 0.06, 31); let l = 0.5 + (n - 0.5) * 0.7; if (n < 0.3) l -= 0.2; c = pick(WR, l); }
        else { const w = 7, k = Math.floor((x + sid) / w), eu = x + sid - k * w; c = eu < 1 ? [16, 10, 8] : pick(WR, 0.5 + (H3(k, 0, sid) - 0.5) * 0.3 + (vn(x * 0.3, y * 0.05, 11) - 0.5) * 0.3 + (eu < 2 ? 0.1 : eu > w - 2 ? -0.12 : 0)); }
      } else { const l = 0.6 + (vn(x * 0.18, y * 0.18, 17) - 0.5) * 0.14 + (vn(x * 0.9, y * 0.9, 18) - 0.5) * 0.08; c = pick(WR, l); }
      if ((b.mat === 'plaster') && (lx < 6 || lx >= b.tw * TS - 6)) { const row = Math.floor(ly / 7); const w = (row & 1) ? 6 : 4; const inside = lx < 6 ? lx < w : lx >= b.tw * TS - w; if (inside) { const ey = ly - row * 7; c = ey < 1 ? [40, 36, 34] : pick(p.stoneW, 0.6 + (H3(row, lx < 6 ? 0 : 1, sid) - 0.5) * 0.3 - (ey > 5 ? 0.15 : 0)); } }
      const eave = clamp(1 - ly / 9, 0, 1); if (eave > 0) c = mix(c, [18, 14, 20], eave * 0.7);
      if (ly > wallH - 8) { const pl = Math.floor(lx / 12), ey = ly - (wallH - 8); c = ey < 1 ? [28, 26, 26] : pick(p.quay, 0.45 + (H3(pl, 1, sid) - 0.5) * 0.3 - ey * 0.03); if (lx % 12 === 0) c = [28, 26, 26]; }
      return mix(c, [4, 4, 12], (lx / (b.tw * TS)) * 0.12);
    });
    if (b.beam && b.wall >= 3) { const by = wy0 + Math.round(wallH * 0.44); buf.fill(x0, by, x1, by + 4, (x, y) => pick(p.timber, y === by ? 0.85 : y === by + 3 ? 0.1 : 0.5 + (vn(x * 0.2, y, 3) - 0.5) * 0.3)); }
    // --- 窓（夜は灯る）
    const drawWin = (cx, cy, w, h, shut) => {
      const wx = x0 + cx - w / 2, wy = cy;
      buf.fill(wx - 2, wy - 2, wx + w + 2, wy + h + 2, () => pick(p.timber, 0.3));
      buf.fill(wx, wy, wx + w, wy + h, (x, y) => { const mid = x === Math.floor(wx + w / 2) || y === Math.floor(wy + h * 0.45); return mid ? pick(p.timber, 0.55) : pick(p.glass, 0.95 - ((y - wy) / h) * 0.55 + (vn(x, y, 23) - 0.5) * 0.15); });
      buf.fill(wx - 2, wy - 5, wx + w + 2, wy - 2, (x, y) => { const d = Math.abs(x - (wx + w / 2)) / (w / 2 + 2); return (y - (wy - 5)) >= (1 - Math.sqrt(1 - Math.min(1, d * d))) * 3 ? pick(p.stoneW, 0.75 - (y - wy + 5) * 0.1) : null; });
      buf.fill(wx - 3, wy + h + 2, wx + w + 3, wy + h + 4, (x, y) => pick(p.stoneW, y === wy + h + 2 ? 0.9 : 0.35));
      if (shut) { const SR = shut === 'g' ? p.shutterG : p.shutterB; [[wx - 7, wx - 2], [wx + w + 2, wx + w + 7]].forEach(([a, bb]) => buf.fill(a, wy - 1, bb, wy + h + 1, (x, y) => pick(SR, 0.55 + ((x - a) % 3 === 0 ? -0.25 : 0) + (y === wy - 1 ? 0.2 : 0)))); }
      emit.push({ kind: 'win', x: wx, y: wy, w, h });
    };
    const winH = b.small ? 10 : b.wall >= 3 ? 16 : 15, lowY = b.winY != null ? wy0 + b.winY : Math.max(wy0 + 8, wy1 - 8 - (b.wall >= 3 ? 28 : 26));
    (b.windows || []).forEach((wx) => drawWin(wx, lowY, b.small ? 9 : 12, winH, b.shutters));
    (b.win2 || []).forEach((wx) => drawWin(wx, wy0 + 14, 12, 14, b.shutters));
    if (b.flowers) (b.windows || []).forEach((wx) => {
      const fx = x0 + wx - 9, fy = lowY + winH + 4;
      buf.fill(fx, fy, fx + 18, fy + 4, (x, y) => pick(p.door, y === fy ? 0.8 : 0.4));
      const rr = R.rng('flw:' + wx + ':' + sid);
      for (let i = 0; i < 9; i++) { const px = fx + 1 + rr.next() * 16, py = fy - 1 - rr.next() * 3; const cc = [[210, 90, 110], [230, 200, 110], [240, 236, 220], [140, 110, 210]][i % 4]; buf.set(px, py, cc); buf.set(px + 1, py, mix(cc, [8, 6, 12], 0.3)); buf.set(px, py + 1, [50, 80, 36]); }
    });
    // --- 扉
    let door = null;
    if (b.door) {
      const dw = b.door.w || (b.small ? 12 : 16), dh = b.door.h || (b.small ? 19 : 25), dx = x0 + b.door.x - dw / 2, dy = wy1 - 8 - dh + 6;
      buf.fill(dx - 3, dy - 4, dx + dw + 3, wy1 - 2, (x, y) => { const d = Math.abs(x + 0.5 - (dx + dw / 2)) / (dw / 2 + 3); return (y - (dy - 4)) >= (1 - Math.sqrt(Math.max(0, 1 - d * d))) * 6 ? pick(p.stoneW, 0.7 - H3(x >> 2, y >> 2, 3) * 0.2) : null; });
      buf.fill(dx, dy, dx + dw, wy1 - 2, (x, y) => {
        const d = Math.abs(x + 0.5 - (dx + dw / 2)) / (dw / 2); if ((y - dy) < (1 - Math.sqrt(Math.max(0, 1 - d * d))) * 5) return null;
        if (b.door.open) return mix(pick(p.glass, 0.8 - ((y - dy) / dh) * 0.4), [120, 50, 10], ((x - dx) / dw) * 0.3);
        const pl = (x - dx) % 4 === 0; let l = pl ? 0.1 : 0.5 + (vn(x * 0.3, y * 0.06, 29) - 0.5) * 0.35; if (y === dy + 7 || y === wy1 - 7) l = 0.2; return pick(p.door, l);
      });
      if (!b.door.open) { buf.set(dx + dw - 4, dy + 12, [230, 190, 90]); buf.set(dx + dw - 4, dy + 13, [120, 80, 30]); }
      else emit.push({ kind: 'door', x: dx, y: dy, w: dw, h: wy1 - 2 - dy });
      buf.fill(dx - 4, wy1 - 2, dx + dw + 4, wy1, (x, y) => pick(p.quay, y === wy1 - 2 ? 0.85 : 0.5));
      door = { x: dx + dw / 2, y: wy1 };
      if (b.lamp) { const lx = dx + dw + 6, ly = dy + 2; buf.fill(lx - 2, ly - 1, lx + 3, ly + 6, (x, y) => (y === ly - 1 || y === ly + 5 ? [30, 28, 30] : pick(p.glass, 0.95))); emit.push({ kind: 'lamp', x: lx, y: ly + 2 }); }
    }
    if (b.awning) {
      const ax = x0 + b.awning.x - b.awning.w / 2, ay = lowY - 10, aw = b.awning.w;
      buf.fill(ax, ay, ax + aw, ay + 12, (x, y) => { const st = Math.floor((x - ax) / 6) & 1; return pick(st ? p.awnR : p.awnW, 0.75 - ((y - ay) / 12) * 0.45 + ((y - ay) === 11 ? -0.3 : 0)); });
    }
    // --- 屋根
    const hip = b.hip ? Math.min(roofH * 0.9, 34) : 0, ridgeY = ry0 + Math.round(roofH * 0.38);
    const thatch = b.roof === 'thatch' || b.roof === 'moss' || b.roof === 'bark';   // 樹皮の屋根も筋のある葺き方（板の格子にしない）
    buf.fill(x0 - over, ry0, x1 + over, ry1 + 4, (x, y) => {
      const lx = x - x0;
      if (y >= ry1 + 3 && (x < x0 - over + 2 || x > x1 + over - 3)) return null;
      if (hip && y < ridgeY) { const t = (y - ry0) / (ridgeY - ry0), inset = hip * (1 - t); if (lx < -over + inset || lx > b.tw * TS + over - inset) return null; }
      const back = y < ridgeY;
      let l;
      if (thatch) {
        // 茅（藁の筋と段）
        const rh = 9, row = Math.floor((y - ry0) / rh), ey = (y - ry0) - row * rh;
        l = back ? 0.7 - ((ridgeY - y) / (ridgeY - ry0)) * 0.15 : 0.52 - ((y - ridgeY) / (ry1 - ridgeY)) * 0.18;
        l += (vn(x * 0.9, y * 0.12, sid + 5) - 0.5) * 0.35 + (vn(x * 0.2, y * 0.2, 13) - 0.5) * 0.1;
        if (ey >= rh - 2) l -= 0.25 + (vn(x * 0.5, row, sid) > 0.5 ? 0.1 : 0);
      } else {
        const rh = 7, row = Math.floor((y - ry0) / rh), off = (row & 1) * 6, col = Math.floor((x + off) / 12), ey = (y - ry0) - row * rh, ex = (x + off) - col * 12;
        l = back ? 0.72 - ((ridgeY - y) / (ridgeY - ry0)) * 0.14 : 0.5 - ((y - ridgeY) / (ry1 - ridgeY)) * 0.16;
        l += (H3(col, row, sid) - 0.5) * 0.2 + (vn(x * 0.2, y * 0.2, 13) - 0.5) * 0.1;
        if (ey === rh - 1) l -= 0.34; else if (ey === rh - 2) l -= 0.1; else if (ey === 0) l += 0.12;
        if (ex === 0 && ey < rh - 1) l -= 0.22;
      }
      l += (1 - (x - x0 + over) / (b.tw * TS + over * 2)) * 0.12;
      if (Math.abs(y - ridgeY) < 2) l = y < ridgeY ? 0.95 : 0.78;
      if (y >= ry1) l = 0.12 - (y - ry1) * 0.03;
      if (x < x0 - over + 2) l -= 0.15; if (x > x1 + over - 3) l -= 0.25;
      if (!thatch && vn(x * 0.15, y * 0.3, sid + 3) > 0.8 && !back) return mix(pick(RR, l), [70, 90, 50], 0.35);
      return pick(RR, l);
    });
    (b.dormers || []).forEach((dxp) => {
      const cx = x0 + dxp, t0 = ridgeY + 4, bot = ry1 - 4, w = 22;
      buf.fill(cx - w / 2 - 2, t0, cx + w / 2 + 2, bot, (x, y) => { const t = (y - t0) / (bot - t0), half = (w / 2 + 2) * Math.min(1, 0.35 + t * 1.3); if (Math.abs(x - cx) > half) return null; return pick(RR, 0.35 + (x < cx ? 0.2 : 0) + ((y - t0) % 5 === 4 ? -0.2 : 0)); });
      buf.fill(cx - 6, bot - 14, cx + 6, bot - 1, (x, y) => (x === cx - 6 || x === cx + 5 || y === bot - 14 ? pick(p.timber, 0.3) : x === cx ? pick(p.timber, 0.5) : pick(p.glass, 0.9 - (y - bot + 14) * 0.03)));
      emit.push({ kind: 'win', x: cx - 5, y: bot - 13, w: 10, h: 12 });
    });
    if (b.chimney != null) {
      const cx = x0 + b.chimney, cy = ry0 + 2;
      buf.fill(cx, cy - 16, cx + 12, cy + 10, (x, y) => { const row = Math.floor((y - cy + 16) / 4), ex = (x - cx + (row & 1) * 3) % 6; if (y < cy - 14) return pick(p.quay, 0.85); if (ex === 0 || (y - cy + 16) % 4 === 0) return [40, 30, 28]; return pick(p.terra, 0.55 + (H3(x >> 1, row, 5) - 0.5) * 0.3 - (x - cx) * 0.03); });
      buf.fill(cx - 1, cy - 17, cx + 13, cy - 14, (x, y) => pick(p.quay, y === cy - 17 ? 0.9 : 0.5));
      emit.push({ kind: 'smoke', x: cx + 6, y: cy - 18 });
    }
    if (b.sign) {
      const sx = x0 + b.sign.x, sy = wy0 + 12;
      buf.fill(sx - 1, sy - 4, sx + 12, sy - 2, () => [24, 22, 24]);
      buf.fill(sx + 1, sy - 2, sx + 13, sy + 11, (x, y) => (x === sx + 1 || x === sx + 12 || y === sy - 2 || y === sy + 10 ? pick(p.timber, 0.2) : pick(p.door, 0.62 + (vn(x, y * 0.3, 3) - 0.5) * 0.2)));
      signIcon(buf, sx + 7, sy + 4, b.sign.kind);
      emit.push({ kind: 'sign', x: sx + 7, y: sy + 4, icon: b.sign.kind });
    }
    const c = buf.canvas();
    if (!c) return null;
    const k = s;
    const sc = (e) => Object.assign({}, e, { x: (e.x - x0) * k, y: (e.y - wy1) * k, w: e.w != null ? e.w * k : undefined, h: e.h != null ? e.h * k : undefined });
    return {
      frames: [{ c, ox: Math.round(x0 * k), oy: Math.round(wy1 * k) }], poses: { default: [0] }, anchors: { feet: [0, 0], door: door ? [(door.x - x0) * k, 0] : null },
      w: c.width, h: c.height,
      meta: { tile: TS * s, footprint: [b.tw, b.th], door: door ? { x: (door.x - x0) * k, y: 0 } : null, emit: emit.map(sc), roof: [(-over) * k, (ry0 - wy1) * k, (b.tw * TS + over) * k, (ry1 - wy1) * k], wallTop: (wy0 - wy1) * k },
    };
  }
  /** 吊り看板の小さな絵（文字ではなく絵で店の種類、STYLE_REFERENCE §6.2） */
  function signIcon(buf, x, y, kind) {
    const G = [232, 192, 112], W = [255, 248, 224], S = [232, 224, 208];
    const px = (dx, dy, c) => buf.set(x + dx, y + dy, c || G);
    const rect = (dx, dy, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(dx + i, dy + j, c); };
    switch (kind) {
      case 'inn': rect(-4, 0, 9, 2); rect(-4, -3, 1, 5); rect(4, -1, 1, 3); rect(-3, -2, 3, 2, W); break;
      case 'tavern': case 'mug': rect(-3, -3, 5, 6); rect(2, -2, 2, 1); rect(3, -2, 1, 4); rect(2, 1, 2, 1); rect(-3, -4, 5, 1, W); break;
      case 'shop': case 'item': case 'bag': rect(-3, -1, 7, 5); rect(-1, -3, 3, 2); break;
      case 'weapon': case 'sword': for (let i = 0; i < 7; i++) px(-3 + i, 3 - i, S); rect(-3, 1, 3, 1); rect(-2, 0, 1, 3); break;
      case 'armor': rect(-3, -3, 7, 2); rect(-3, -1, 7, 3); rect(-2, 2, 5, 1); rect(-1, 3, 3, 1); break;
      case 'anchor': case 'harbor': rect(0, -4, 1, 8); rect(-3, 3, 7, 1); rect(-3, 1, 1, 2); rect(3, 1, 1, 2); rect(-2, -3, 5, 1); break;
      case 'church': case 'record': rect(0, -4, 1, 8); rect(-2, -2, 5, 1); break;
      default: rect(-2, -2, 5, 5);
    }
  }

  /** 描いた建物の画像（env.js、v2/design/ENV_ASSETS.md）→ Sheet（描く点 = 敷地の左下の角、コードの絵と同じ）。無ければ null。
   *  地図の建物 id ごとの絵（窓・扉は地図の def に合わせて描いてある）か、def.art の汎用の建物（扉は敷地のまん中の列）。
   *  meta.emitLayer = 灯った窓の画素だけの絵（光の地図の後に描き直す。props_light.js）、meta.emit = 窓の光（窓ごとの矩形） */
  function envBuilding(d, tile) {
    const eb = T.Env && T.Env.bld ? T.Env.bld(d) : null;
    if (!eb) return null;
    const p = eb.img(tile);
    if (!p) return null;
    const j = eb.j || {}, k = tile / TS, W = Math.round(p.im.width * p.k), H = Math.round(p.im.height * p.k);
    const c = R.Hd.RZ.canvas(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = false; g.drawImage(p.im, 0, 0, W, H);
    let emitLayer = null;
    const pe = eb.emit(tile);
    if (pe) { emitLayer = R.Hd.RZ.canvas(W, H); const eg = emitLayer.getContext('2d'); eg.imageSmoothingEnabled = false; eg.drawImage(pe.im, 0, 0, W, H); }
    const ax = Math.round(((j.anchor32 && j.anchor32[0]) || 8) * k), ay = H;
    const sc = (e) => ({ kind: e.kind, x: e.x * k, y: e.y * k, w: e.w != null ? e.w * k : undefined, h: e.h != null ? e.h * k : undefined });
    const door = j.door32 ? { x: j.door32.x * k, y: 0 } : null;
    const meta = { tile, footprint: j.footprint || [d.w || 3, d.h || 3], door, emit: (j.emit32 || []).map(sc), roof: (j.roof32 || [0, -H, W, -H / 2]).map((v) => v * k),
      wallTop: (j.wallTop32 || 0) * k, emitLayer, envAnchor: [ax, ay], env: eb.id };
    return { frames: [{ c, ox: ax, oy: ay }], poses: { default: [0] }, anchors: { feet: [0, 0], door: door ? [door.x, 0] : null }, w: W, h: H, meta };
  }
  T._envBuilding = envBuilding;

  const keys = {};
  /** def → キー（中身が同じなら同じキー。登録は 1 回） */
  T.building = function (def) {
    def = def || {};
    const shape = {};
    for (const k of ['w', 'h', 'wall', 'roof', 'mat', 'windows', 'sign', 'lamp', 'chimney', 'hip', 'awning', 'beam', 'shutters', 'flowers', 'dormers', 'win2', 'small', 'art']) if (def[k] !== undefined) shape[k] = def[k];
    if (def.door) shape.door = { x: def.door.x != null ? def.door.x - (def.x || 0) : null, open: def.door.open };
    shape.id = def.id || '';
    const json = JSON.stringify(shape), key = 'hd:bld:' + R.U.hash(json).toString(36);
    if (!keys[key]) {
      const d = Object.assign({}, shape, { x: 0, door: shape.door ? { x: shape.door.x != null ? shape.door.x : null, open: shape.door.open } : null });
      if (d.door && d.door.x == null) d.door.x = Math.floor((d.w || 3) / 2);
      keys[key] = d;
      if (!(R.Hd && R.Hd.has && R.Hd.has(key))) T._hdDef(key, (o) => envBuilding(d, (o && o.tile) || TS) || draw(norm(d), ((o && o.tile) || TS) / TS), { kind: 'building', footprint: [d.w || 3, d.h || 3] });
    }
    return key;
  };
  T._bldNorm = norm;
})(window.RPG);
