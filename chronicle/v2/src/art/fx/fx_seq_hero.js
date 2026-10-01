// BSCENE: 上の段の演出の主役（一品物）。竜・不死鳥・隕石・日輪・月・日食・黄泉の門・大樹・極光・虹・噴火・渦潮・竜巻・
// 巨大な武器・日の出・大鷹・大釜・氷の彫像・墓標・大鐘・山並み・天の眼・翼・影分身・雷雲・守りの紋・蓮・立石・陰陽・鬼火・空割れ。
// 形は fx_seq_prims.js と同じ fn(g, u, L, c, e)。原点は置いた点（多くは的の中ほど）、画面の上端は y = -e.y。
(function (R) {
  'use strict';
  const S = R.BFX.seq;
  const P = S.prim;
  const E = S.E, hr = S.hr, col = S.col;
  const TAU = Math.PI * 2;
  const N = (c, n) => Math.max(1, Math.round(n * (c.q || 1)));
  const sub = (name, g, u, L, c, e) => { if (u > 0 && u < 1) S.prims[name](g, u, L, c, e); };

  // ---------------------------------------------------------------- 竜（体の節が弧を描いて的を巻き、最後に突っ込む）
  P('dragon', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const Rr = L.r || 110, M = N(c, L.len || 30), lag = 0.012;
    const pos = (t) => {
      t = Math.max(0, t);
      if (t < 0.78) {
        const k = t / 0.78, ang = (L.a0 || -0.6) + k * TAU * 1.15, rad = Rr * (1.9 - k * 0.9);
        return [Math.cos(ang) * rad * 1.35, Math.sin(ang) * rad * 0.55 - (1 - k) * Rr * 0.9 - Rr * 0.2];
      }
      const k = (t - 0.78) / 0.22, p = pos(0.7799), kk = E.in(k);
      return [p[0] * (1 - kk), p[1] * (1 - kk)];
    };
    const k = E.env(u, 0.08, 0.12);
    const pts = [];
    for (let i = 0; i < M; i++) pts.push(pos(u * 1.05 - i * lag));
    // 体（尾から頭へ）
    for (let i = M - 1; i >= 0; i--) {
      const [x, y] = pts[i];
      const w = (L.w || 13) * (i < 3 ? 1.1 : 1 - i / M * 0.75);
      S.dot(g, x, y, w * 2.4, c0, 0.45 * k);
      S.dot(g, x, y, w * 0.9, i % 2 ? c1 : c0, 0.9 * k, true);
      // 背のとげ
      if (i > 1 && i % 2 === 0 && pts[i - 1]) {
        const dx = pts[i - 1][0] - x, dy = pts[i - 1][1] - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        g.fillStyle = `rgba(${c1},${0.8 * k})`;
        g.beginPath(); g.moveTo(x + nx * w * 0.6, y + ny * w * 0.6); g.lineTo(x + nx * w * 1.9 - dx * 0.4, y + ny * w * 1.9 - dy * 0.4); g.lineTo(x - dx * 0.5 + nx * w * 0.4, y - dy * 0.5 + ny * w * 0.4); g.closePath(); g.fill();
      }
    }
    // 頭
    if (pts[0] && pts[1]) {
      const [x, y] = pts[0], a = Math.atan2(y - pts[1][1], x - pts[1][0]);
      g.save(); g.translate(x, y); g.rotate(a);
      const hs = (L.w || 13) * 1.5;
      g.fillStyle = `rgba(${c0},${0.9 * k})`;
      g.beginPath(); g.moveTo(hs * 2.2, 0); g.lineTo(hs * 0.6, -hs * 0.9); g.lineTo(-hs * 0.6, -hs * 0.7); g.lineTo(-hs * 0.6, hs * 0.7); g.lineTo(hs * 0.6, hs * 0.9); g.closePath(); g.fill();
      g.strokeStyle = `rgba(${c1},${0.95 * k})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-hs * 0.2, -hs * 0.7); g.quadraticCurveTo(-hs * 1.2, -hs * 1.6, -hs * 2.2, -hs * 1.4); g.stroke();
      g.beginPath(); g.moveTo(-hs * 0.2, hs * 0.7); g.quadraticCurveTo(-hs * 1.2, hs * 1.6, -hs * 2.2, hs * 1.4); g.stroke();
      // ひげ
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(hs * 1.6, hs * 0.3); g.quadraticCurveTo(hs * 0.5, hs * 2 + Math.sin(e.ms / 90) * 6, -hs * 1.5, hs * 1.8); g.stroke();
      S.dot(g, hs * 0.9, -hs * 0.35, hs * 0.55, c2 === c0 ? c1 : '255,255,255', k, true);
      S.dot(g, hs * 2.2, 0, hs * 1.4, c1, 0.6 * k);
      g.restore();
    }
    // 突っ込んだ時の爆ぜ
    if (u > 0.8) { const kk = E.win(u, 0.8, 1); sub('ring', g, kk, { r: Rr * 1.4, w: 5, n: 2, flat: 0.5, col: L.col, col2: L.col2 }, c, e); S.dot(g, 0, 0, Rr * (0.6 + kk), c0, 0.7 * (1 - kk)); }
  });

  // ---------------------------------------------------------------- 不死鳥（炎の鳥が右上から舞い降り、翼を広げて燃え上がる）
  P('phoenix', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'fire'), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const k = E.env(u, 0.08, 0.2);
    const fly = E.inOut(E.win(u, 0, 0.6));
    const x = (1 - fly) * 320, y = -(1 - fly) * e.y * 0.8 - 60 - E.out(E.win(u, 0.6, 1)) * 40;
    const sc = (L.s2 || 1) * (0.7 + 0.5 * E.win(u, 0.4, 0.8));
    // 尾（残り火の筋）
    for (let i = 0; i < N(c, 40); i++) {
      const s = e.seed + i * 7, t = hr(s);
      const tx = x + t * 260 * (1 - fly * 0.7) + (hr(s + 1) - 0.5) * 20, ty = y - t * 120 * (1 - fly) + (hr(s + 2) - 0.5) * 30 + t * 30;
      S.dot(g, tx, ty, 3 + (1 - t) * 6, i % 3 ? c0 : c1, k * (1 - t) * 0.9);
    }
    g.save(); g.translate(x, y); g.scale(sc, sc);
    const flap = Math.sin(e.ms / 110) * 0.45 + (u > 0.6 ? -0.5 * E.win(u, 0.6, 0.75) : 0);
    for (const side of [-1, 1]) {
      g.save(); g.scale(1, side); g.rotate(-0.3 + flap * side * 0.6);
      for (let f = 0; f < 7; f++) {
        const len = 70 + f * 14, a = -0.2 - f * 0.18;
        g.fillStyle = `rgba(${f < 3 ? c1 : f < 5 ? c0 : c2},${0.75 * k})`;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a) * len * 0.5 - 10, Math.sin(a) * len * 0.5 - 18, Math.cos(a) * len, Math.sin(a) * len); g.quadraticCurveTo(Math.cos(a) * len * 0.5 + 6, Math.sin(a) * len * 0.5 + 4, 0, 6); g.fill();
      }
      g.restore();
    }
    // 尾羽
    for (let f = 0; f < 5; f++) {
      const a = (f - 2) * 0.16, wv = Math.sin(e.ms / 140 + f) * 10;
      g.strokeStyle = `rgba(${f % 2 ? c1 : c0},${0.8 * k})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(80, a * 60 + wv, 150 + f * 8, a * 120 + wv * 1.6); g.stroke();
    }
    S.dot(g, 0, 0, 40, c0, 0.8 * k);
    S.dot(g, -14, -6, 16, c1, k, true);
    g.fillStyle = `rgba(${c1},${k})`; g.beginPath(); g.moveTo(-30, -8); g.lineTo(-18, -12); g.lineTo(-18, -2); g.closePath(); g.fill();
    g.restore();
    if (u > 0.55) { const kk = E.win(u, 0.55, 1); sub('pillar', g, kk, { w: 50, col: L.col, col2: L.col2, n: 16 }, c, e); sub('ring', g, kk, { r: 150, n: 3, flat: 0.35, w: 4, col: L.col, col2: L.col2 }, c, { ...e, y: e.y }); }
  });

  // ---------------------------------------------------------------- 隕石（L.n 個。斜め上から落ちて爆ぜる）
  P('meteor', (g, u, L, c, e) => {
    const n = L.n || 1, c0 = col(c, L.col, 'fire'), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const land = L.land || 0.55;
    for (let j = 0; j < n; j++) {
      const s = e.seed + j * 131;
      const st = n > 1 ? hr(s) * 0.45 : 0, uj = E.win(u, st, st + (n > 1 ? 0.55 : 1));
      if (uj <= 0 || uj >= 1) continue;
      const tx = n > 1 ? (hr(s + 1) - 0.5) * (L.w || 260) : 0, ty = n > 1 ? (hr(s + 2) - 0.5) * 50 : 0;
      const sz = (L.size || 34) * (n > 1 ? 0.45 + hr(s + 3) * 0.5 : 1);
      if (uj < land) {
        const k = E.in(uj / land);
        const x0 = tx + (L.from || 1) * (e.y + 260), y0 = ty - e.y - 120;
        const x = x0 + (tx - x0) * k, y = y0 + (ty - y0) * k, ang = Math.atan2(ty - y0, tx - x0);
        g.save(); g.translate(x, y); g.rotate(ang);
        const tl = sz * 9;
        const gr = g.createLinearGradient(-tl, 0, 0, 0);
        gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(0.7, `rgba(${c0},0.55)`); gr.addColorStop(1, `rgba(${c1},0.95)`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(-tl, 0); g.lineTo(0, -sz * 0.9); g.lineTo(sz * 0.4, 0); g.lineTo(0, sz * 0.9); g.closePath(); g.fill();
        S.dot(g, 0, 0, sz * 2.2, c0, 0.8);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = `rgba(${L.rock || '70,40,30'},0.95)`;
        g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = sz * 0.55 * (0.8 + hr(s + i) * 0.35); if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
        g.globalCompositeOperation = 'lighter';
        S.dot(g, sz * 0.15, 0, sz * 0.5, c1, 0.9, true);
        g.restore();
        // 地面が明るくなる
        S.dot(g, tx, ty + 20, sz * 3 * k, c0, 0.4 * k);
      } else {
        const k = (uj - land) / (1 - land);
        g.save(); g.translate(tx, ty);
        S.dot(g, 0, 0, sz * (2 + 5 * E.out(k)), c0, 0.9 * (1 - k));
        S.dot(g, 0, 0, sz * (1 + 2 * E.out(k)), c1, 1 - k, true);
        sub('ring', g, k, { r: sz * 6, w: 5, n: 2, flat: 0.35, col: L.col, col2: L.col2 }, c, { ...e, seed: s });
        sub('sparks', g, k, { n: 18, v: sz * 5, grav: 80, len: 12, col: L.col, col2: L.col2 }, c, { ...e, seed: s });
        sub('debris', g, k, { n: 8, v: sz * 5, grav: 200, size: sz * 0.2, col: L.rock || '90,60,45' }, c, { ...e, seed: s });
        g.restore();
      }
    }
  });

  // ---------------------------------------------------------------- 日輪（大きな太陽が降りてきて、的に落ちる）
  P('sun', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'fire'), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const land = L.land || 0.62, r = L.r || 60;
    const k = E.env(u, 0.1, 0.12);
    if (u < land) {
      const kk = E.in(E.win(u, 0.15, 1) * 1) * (u / land);
      const y = -e.y * 0.55 * (1 - E.in(u / land)) - r * 0.2;
      const rr = r * (0.6 + 0.4 * E.out(u / land * 2));
      void kk;
      g.save(); g.translate(0, y); g.rotate(e.ms / 900);
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU, l = rr * (1.5 + 0.25 * Math.sin(e.ms / 120 + i * 2));
        g.fillStyle = `rgba(${c0},${0.55 * k})`;
        g.beginPath(); g.moveTo(Math.cos(a - 0.08) * rr, Math.sin(a - 0.08) * rr); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.lineTo(Math.cos(a + 0.08) * rr, Math.sin(a + 0.08) * rr); g.closePath(); g.fill();
      }
      g.restore();
      S.dot(g, 0, y, rr * 2.6, c0, 0.55 * k);
      S.dot(g, 0, y, rr * 1.1, c1, k, true);
      S.dot(g, 0, y, rr * 0.7, '255,255,255', 0.8 * k, true);
      g.strokeStyle = `rgba(${c2},${0.6 * k})`; g.lineWidth = 3; g.beginPath(); g.arc(0, y, rr * 1.05, 0, TAU); g.stroke();
      S.dot(g, 0, 30, rr * 2 * (u / land), c0, 0.5 * (u / land));
    } else {
      const kk = (u - land) / (1 - land);
      S.dot(g, 0, 0, r * (1.5 + 4 * E.out(kk)), c0, 0.9 * (1 - kk));
      S.dot(g, 0, 0, r * (1 + 2 * E.out(kk)), c1, 1 - kk, true);
      sub('ring', g, kk, { r: r * 5, n: 3, w: 6, flat: 0.4, col: L.col, col2: L.col2 }, c, e);
      sub('rays', g, kk, { n: 18, len: r * 5, w: 0.05, col: L.col2 }, c, e);
      sub('flames', g, kk, { n: 26, w: r * 4, h: r * 2, size: 14, col: L.col, col2: L.col2, col3: L.col3 }, c, { ...e });
    }
  });

  // ---------------------------------------------------------------- 月（空の月が満ちて欠け、月の光が落ちる）
  P('moon', (g, u, L, c, e) => {
    const c0 = col(c, L.col, '220,230,255'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.12, 0.2), r = L.r || 46;
    const mx = L.mx || 0, my = -e.y * 0.62;
    // 星
    for (let i = 0; i < N(c, 30); i++) { const s = e.seed + i * 5; S.dot(g, (hr(s) - 0.5) * 700, -e.y * hr(s + 1) * 0.8, 2 + hr(s + 2) * 2, c1, k * (0.4 + 0.6 * Math.abs(Math.sin(e.ms / 300 + i)))); }
    S.dot(g, mx, my, r * 3.2, c0, 0.45 * k);
    g.fillStyle = `rgba(${c1},${0.95 * k})`; g.beginPath(); g.arc(mx, my, r, 0, TAU); g.fill();
    // 影（満ち欠け: 右から左へ横切る）
    const ph = L.phases ? (u * L.phases) % 1 : u;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(14,14,34,${0.92 * k})`;
    g.save(); g.beginPath(); g.arc(mx, my, r + 0.5, 0, TAU); g.clip();
    g.beginPath(); g.arc(mx + r * 2.2 - ph * r * 4.4, my, r * 1.05, 0, TAU); g.fill();
    g.restore();
    g.globalCompositeOperation = 'lighter';
    // 月の光
    if (u > 0.3) {
      const kk = E.win(u, 0.3, 1);
      const gr = g.createLinearGradient(mx, my, 0, 0);
      gr.addColorStop(0, `rgba(${c0},${0.25 * E.bell(kk)})`); gr.addColorStop(1, `rgba(${c0},${0.5 * E.bell(kk)})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(mx - r * 0.7, my); g.lineTo(mx + r * 0.7, my); g.lineTo(90, 30); g.lineTo(-90, 30); g.closePath(); g.fill();
    }
  });

  // ---------------------------------------------------------------- 日食（黒い円が太陽を覆い、光の輪 → ダイヤモンドリング → 黒金の光線）
  P('eclipse', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'light'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.1, 0.15), r = L.r || 58, my = -e.y * 0.55;
    const cov = E.inOut(E.win(u, 0.05, 0.5));
    const total = E.bell(E.win(u, 0.42, 0.75));
    // 光の輪（コロナ）
    g.save(); g.translate(0, my); g.rotate(e.ms / 2000);
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, l = r * (1.4 + 0.5 * hr(e.seed + i) + 0.2 * Math.sin(e.ms / 150 + i)); S.line(g, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * l, Math.sin(a) * l, 3, c0, (0.2 + 0.6 * total) * k); }
    g.restore();
    S.dot(g, 0, my, r * (2.5 + total * 1.5), c0, (0.6 - 0.3 * cov + 0.4 * total) * k);
    g.fillStyle = `rgba(${c1},${k})`; g.beginPath(); g.arc(0, my, r, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(4,2,10,${k})`; g.beginPath(); g.arc(r * 2.4 * (1 - cov), my - r * 0.2 * (1 - cov), r * 1.01, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(${c1},${(0.3 + 0.7 * total) * k})`; g.lineWidth = 2.5; g.beginPath(); g.arc(0, my, r * 1.02, 0, TAU); g.stroke();
    // ダイヤモンドリング
    const dia = E.bell(E.win(u, 0.62, 0.8));
    if (dia > 0) { S.dot(g, r * 0.7, my - r * 0.7, r * 1.6 * dia, c1, dia); S.star(g, r * 0.7, my - r * 0.7, r * 2.2 * dia, 4, '255,255,255', dia, 0.2); }
    // 黒と金の光線が的へ
    if (u > 0.7) {
      const kk = E.win(u, 0.7, 1), w = 22 * E.bell(kk);
      const gr = g.createLinearGradient(-w, 0, w, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(${c1},${0.9 * E.bell(kk)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(-w, my, w * 2, -my + 20);
      sub('ring', g, kk, { r: 170, n: 3, flat: 0.35, w: 4, col: 'dark', col2: L.col2 }, c, e);
    }
  });

  // ---------------------------------------------------------------- 黄泉の門（地から大きな門がせり上がり、開いて闇があふれる）
  P('gate', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'dark'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.08, 0.15), rise = E.out3(E.win(u, 0, 0.35)), open = E.inOut(E.win(u, 0.35, 0.65));
    const W = L.w || 150, H = (L.h || 190) * rise, gy = L.gy || 40, x0 = L.gx || -20;
    g.save(); g.translate(x0, gy);
    // 中の闇と眼
    if (open > 0) {
      const iw = W * open;
      g.globalCompositeOperation = 'source-over';
      const gr = g.createLinearGradient(0, -H, 0, 0);
      gr.addColorStop(0, `rgba(8,0,16,${0.95 * k})`); gr.addColorStop(1, `rgba(40,10,70,${0.95 * k})`);
      g.fillStyle = gr; g.fillRect(-iw / 2, -H, iw, H);
      g.globalCompositeOperation = 'lighter';
      S.dot(g, 0, -H * 0.4, W * 0.8 * open, c0, 0.7 * k);
      for (let i = 0; i < 6; i++) { const s = e.seed + i * 7, ex = (hr(s) - 0.5) * iw * 0.8, ey = -H * (0.2 + hr(s + 1) * 0.6), bl = Math.abs(Math.sin(e.ms / 260 + i)) > 0.15 ? 1 : 0.1; S.dot(g, ex - 4, ey, 3, '255,80,120', bl * k, true); S.dot(g, ex + 4, ey, 3, '255,80,120', bl * k, true); }
    }
    // 扉（左右）
    g.globalCompositeOperation = 'source-over';
    for (const side of [-1, 1]) {
      const dw = (W / 2) * (1 - open * 0.8);
      const xa = side * (W / 2 * open * 0.8 + (side < 0 ? 0 : 0)), x1 = side < 0 ? -W / 2 : W / 2 - dw;
      void xa;
      const xL = side < 0 ? -W / 2 - (W / 2) * open * 0.1 : W / 2 - dw + (W / 2) * open * 0.1;
      g.fillStyle = `rgba(30,18,44,${0.97 * k})`; g.fillRect(side < 0 ? xL : xL, -H, dw, H);
      g.strokeStyle = `rgba(${c0},${0.9 * k})`; g.lineWidth = 2; g.strokeRect(xL + 3, -H + 3, dw - 6, H - 6);
      for (let r = 1; r < 5; r++) { g.beginPath(); g.moveTo(xL + 6, -H * r / 5); g.lineTo(xL + dw - 6, -H * r / 5); g.stroke(); }
      void x1;
    }
    // 門の枠（上のアーチ）
    g.strokeStyle = `rgba(${c1},${0.9 * k})`; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-W / 2 - 14, 0); g.lineTo(-W / 2 - 14, -H); g.quadraticCurveTo(0, -H - 60 * rise, W / 2 + 14, -H); g.lineTo(W / 2 + 14, 0); g.stroke();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(${c0},${0.5 * k})`; g.lineWidth = 12; g.stroke();
    g.restore();
    if (u > 0.55) sub('tendrils', g, E.win(u, 0.55, 1), { n: 10, len: 120, w: W, gy: gy, col: L.col, col2: L.col2 }, c, e);
  });

  // ---------------------------------------------------------------- 大樹（地から幹が伸び、枝が広がり、光の実と葉が降る）
  P('tree', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'heal'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.05, 0.15), grow = E.out3(E.win(u, 0, 0.5)), bloom = E.out(E.win(u, 0.4, 0.8));
    const H = (L.h || 220) * grow, gy = L.gy || 40;
    g.save(); g.translate(L.gx || 0, gy);
    g.lineCap = 'round';
    const leaves = [];
    const branch = (x, y, a, len, w, d, s) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = `rgba(${L.bark || '140,105,70'},${0.95 * k})`; g.lineWidth = w;
      g.globalCompositeOperation = 'source-over';
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, x2, y2); g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${c0},${0.35 * k})`; g.lineWidth = w * 0.4; g.stroke();
      if (d <= 0) { leaves.push([x2, y2]); return; }
      branch(x2, y2, a - 0.45 - hr(s) * 0.3, len * 0.72, w * 0.66, d - 1, s * 3 + 1);
      branch(x2, y2, a + 0.45 + hr(s + 1) * 0.3, len * 0.72, w * 0.66, d - 1, s * 3 + 2);
      if (d === 2) leaves.push([x2, y2]);
    };
    branch(0, 0, -Math.PI / 2, H * 0.42, 16 * grow + 2, 3, e.seed % 97 + 1);
    for (let i = 0; i < leaves.length; i++) {
      const [x, y] = leaves[i];
      S.dot(g, x, y, 26 * bloom, c0, 0.55 * k);
      S.dot(g, x, y, 5 * bloom, i % 2 ? c1 : '255,236,160', k, true);
    }
    g.restore();
    if (u > 0.45) sub('petals', g, E.win(u, 0.45, 1), { n: 30, w: 320, h: 240, kind: 'leaf', col: L.col, col2: L.col2, dy: 0 }, c, e);
  });

  // ---------------------------------------------------------------- 極光（空にたなびく光の幕）
  // 広い面を何度も塗るので、4 分の 1 の大きさの裏の絵に描いて引き伸ばす（ぼけて極光らしくなり、ソフトの描画でも軽い）
  let aurC = null;
  P('aurora', (g0, u, L, c, e) => {
    const k = E.env(u, 0.2, 0.25) * (L.a || 1);
    const n = L.n || 4, W = L.w || 900, top = -e.y + 20;
    let g = g0;
    const Q = 0.25, fl = -c.dir;
    if (typeof document !== 'undefined' && g0.drawImage) {
      const w = Math.ceil(c.W * Q), h = Math.ceil(c.H * Q);
      if (!aurC) aurC = document.createElement('canvas');
      if (aurC.width !== w || aurC.height !== h) { aurC.width = w; aurC.height = h; }
      g = aurC.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      g.setTransform(Q, 0, 0, Q, e.x * Q, e.y * Q);
    }
    const spread = E.out(Math.min(1, u * 1.4));
    for (let j = 0; j < n; j++) {
      const cc = col(c, j % 3), y0 = top + (L.y0 || 40) + j * 18, len = (L.len || 160) * (0.8 + 0.3 * Math.sin(j));
      // 幕: 上の端が波打つ帯を縦のグラデーションで塗り、細い縦の筋を少し重ねる
      const seg = 36, half = W / 2 * spread;
      const yt = (t) => y0 + Math.sin(t * 6 + e.ms / 700 + j * 1.3) * 24 + Math.sin(t * 13 - e.ms / 450 + j) * 7;
      const gr = g.createLinearGradient(0, y0 - 30, 0, y0 + len);
      gr.addColorStop(0, `rgba(${cc},0)`); gr.addColorStop(0.12, `rgba(${cc},${0.42 * k})`); gr.addColorStop(0.5, `rgba(${cc},${0.16 * k})`); gr.addColorStop(1, `rgba(${cc},0)`);
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i <= seg; i++) { const t = i / seg, x = -half + t * half * 2; if (i) g.lineTo(x, yt(t)); else g.moveTo(x, yt(t)); }
      for (let i = seg; i >= 0; i--) { const t = i / seg, x = -half + t * half * 2; g.lineTo(x, yt(t) + len * (0.75 + 0.25 * Math.sin(t * 9 + e.ms / 500 + j))); }
      g.closePath(); g.fill();
      // 筋
      for (let i = 0; i < N(c, 26); i++) {
        const t = hr(e.seed + j * 97 + i), x = -half + t * half * 2, y = yt(t);
        S.line(g, x, y, x, y + len * (0.5 + 0.4 * hr(e.seed + i * 3 + j)), 2 + 3 * hr(e.seed + i + j * 5), cc, 0.22 * k * (0.6 + 0.4 * Math.sin(e.ms / 300 + i)));
      }
    }
    // 左右の端をぼかす（裏の絵の時だけ。画面のままの時はそのまま）
    if (g !== g0) {
      g.globalCompositeOperation = 'destination-in';
      const hg = g.createLinearGradient(-W / 2, 0, W / 2, 0);
      hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.2, 'rgba(0,0,0,1)'); hg.addColorStop(0.8, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hg; g.fillRect(-W / 2 - 400, -e.y - 50, W + 800, c.H + 100);
      g.globalCompositeOperation = 'lighter';
    }
    if (g !== g0) {
      g0.save(); g0.scale(fl, 1);   // 向きの反転を戻して、画面の座標で置く
      g0.imageSmoothingEnabled = true;
      g0.drawImage(aurC, -e.x, -e.y, c.W, c.H);
      g0.restore();
    }
  });

  // ---------------------------------------------------------------- 虹（大きな七色の弧が描かれ、きらめく）
  P('rainbow', (g, u, L, c, e) => {
    const k = E.env(u, 0.1, 0.25), draw = E.out3(E.win(u, 0, 0.45));
    const Rr = L.r || 260, cy = L.cy || 60, band = L.band || 9;
    const COLS = ['255,90,90', '255,160,70', '255,235,90', '110,235,120', '90,200,255', '110,120,255', '200,120,255'];
    const a0 = Math.PI, a1 = Math.PI + Math.PI * draw;
    for (let i = 0; i < 7; i++) {
      const r = Rr - i * band;
      g.strokeStyle = `rgba(${COLS[i]},${0.55 * k})`; g.lineWidth = band + 1;
      g.beginPath(); g.arc(0, cy, r, a0, a1); g.stroke();
    }
    g.strokeStyle = `rgba(255,255,255,${0.35 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(0, cy, Rr + band * 0.5, a0, a1); g.stroke();
    for (let i = 0; i < N(c, 26); i++) { const s = e.seed + i * 3, a = a0 + hr(s) * Math.PI * draw, r = Rr - hr(s + 1) * band * 7; S.star(g, Math.cos(a) * r, cy + Math.sin(a) * r, 3 + 3 * Math.abs(Math.sin(e.ms / 120 + i)), 4, '255,255,255', k, 0); }
  });

  // ---------------------------------------------------------------- 噴火（地から山がせり上がり、溶岩の塊が降る）
  P('volcano', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'fire'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.08, 0.15), rise = E.out3(E.win(u, 0, 0.3)), erupt = E.win(u, 0.3, 1);
    const W = L.w || 220, H = (L.h || 130) * rise, gy = L.gy || 40;
    g.save(); g.translate(0, gy);
    // 煙の柱
    if (erupt > 0) sub('smoke', g, erupt, { n: 14, r: 40, w: 20, v: 30, rise: 200, col: '50,40,40', a: 0.75 }, c, { ...e });
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(60,34,26,${k})`;
    g.beginPath(); g.moveTo(-W / 2, 0); g.lineTo(-W * 0.12, -H); g.lineTo(W * 0.12, -H); g.lineTo(W / 2, 0); g.closePath(); g.fill();
    g.globalCompositeOperation = 'lighter';
    // 溶岩の筋
    g.strokeStyle = `rgba(${c0},${0.8 * k * rise})`; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const s = e.seed + i * 9, x = (hr(s) - 0.5) * W * 0.2; g.beginPath(); g.moveTo(x, -H); g.quadraticCurveTo(x + (hr(s + 1) - 0.5) * 60, -H * 0.5, x + (hr(s + 2) - 0.5) * W * 0.8, 0); g.stroke(); }
    S.dot(g, 0, -H, W * 0.35, c0, 0.9 * k * rise);
    if (erupt > 0) {
      S.dot(g, 0, -H - 30, W * 0.5 * (0.5 + E.bell(erupt)), c1, 0.7 * k);
      g.save(); g.translate(0, -H);
      sub('sparks', g, erupt, { n: 40, v: 260, grav: 420, len: 16, size: 3, ang: -Math.PI / 2, spread: 2.2, glow: 1, col: L.col, col2: L.col2 }, c, e);
      g.restore();
    }
    g.restore();
    if (erupt > 0.35) sub('meteor', g, E.win(erupt, 0.35, 1), { n: 6, w: 420, size: 16, col: L.col, col2: L.col2, land: 0.6 }, c, e);
  });

  // ---------------------------------------------------------------- 大渦潮（足もとの大きな渦）
  P('maelstrom', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'water'), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const k = E.env(u, 0.12, 0.2), Rr = (L.r || 150) * (0.4 + 0.6 * E.out3(E.win(u, 0, 0.3))), fl = 0.34, rot = e.ms / 1000 * (L.spin || 3);
    g.save(); g.translate(0, L.gy || 30);
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, Rr);
    gr.addColorStop(0, `rgba(${L.deep || '4,14,40'},${0.95 * k})`); gr.addColorStop(0.6, `rgba(${c2},${0.6 * k})`); gr.addColorStop(1, `rgba(${c2},0)`);
    g.save(); g.scale(1, fl); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, Rr, 0, TAU); g.fill(); g.restore();
    g.globalCompositeOperation = 'lighter';
    const arms = L.arms || 5;
    for (let j = 0; j < arms; j++) {
      g.strokeStyle = `rgba(${j % 2 ? c1 : c0},${0.7 * k})`; g.lineWidth = 2.5;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, a = rot + j / arms * TAU + t * 5, r = Rr * (1 - t * 0.92);
        const x = Math.cos(a) * r, y = Math.sin(a) * r * fl;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.restore();
    sub('vortex', g, u, { r: Rr, n: 60, col: L.col, col2: L.col2, spin: 5, flat: fl, dy: 0 }, c, { ...e });
  });

  // ---------------------------------------------------------------- 竜巻（地から空へ伸びる漏斗）
  P('tornado', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'wind'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.1, 0.2), H = (L.h || e.y + 60) * E.out3(E.win(u, 0, 0.35)), Rb = L.r || 30, gy = L.gy || 30;
    g.save(); g.translate(0, gy);
    const rings = N(c, 22);
    for (let i = 0; i < rings; i++) {
      const t = i / rings, y = -t * H, r = Rb * (0.4 + t * 2.6), sway = Math.sin(e.ms / 300 + t * 4) * 12 * t;
      const a0 = e.ms / 1000 * (L.spin || 9) + t * 6;
      g.strokeStyle = `rgba(${i % 3 ? c0 : c1},${(0.25 + 0.4 * (1 - t)) * k})`; g.lineWidth = 2 + (1 - t) * 3;
      g.beginPath(); g.ellipse(sway, y, r, r * 0.28, 0, a0, a0 + 4.2); g.stroke();
    }
    g.restore();
    sub('vortex', g, u, { r: Rb * 2.5, h: H, n: 70, col: L.col, col2: L.col2, spin: 11, funnel: 0.15, dy: gy }, c, e);
    if (L.debris) sub('debris', g, u, { n: 10, v: 90, grav: -40, size: 4, col: L.debris }, c, e);
  });

  // ---------------------------------------------------------------- 巨大な武器（空から降りて突き立つ）: L.kind 'sword'|'hammer'|'spear'
  P('giant', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const land = L.land || 0.5, k = E.env(u, 0.08, 0.2), kind = L.kind || 'sword';
    const drop = E.in(E.win(u, 0, land)), H = L.h || 200;
    const y = -e.y - H + (e.y + H * 0.35) * drop;
    g.save(); g.translate(0, u < land ? y : -H * 0.65 + (L.sink || 0)); g.rotate(L.tilt || 0);
    const w = L.w || 26;
    // 描いた部品（spectral_sword・spectral_hammer。fx_seq_img.js）があればそれを描く（先が下。原点 = 柄の上、先 = H）
    const IMG = R.BFX.img, pid = kind === 'hammer' ? 'spectral_hammer' : 'spectral_sword';
    if (IMG && IMG.on && IMG.ready(pid)) {
      const m = IMG.meta(pid);
      g.save();
      g.translate(0, H * 1.02);
      IMG.drawFrame(g, pid, 0, { s: (H * 1.15) / (m.h * (m.scale || 0.5) * 0.9), a: k, pal: IMG.palOf(c, L.col) });
      g.restore();
    } else if (kind === 'hammer') {
      g.fillStyle = `rgba(${c0},${0.6 * k})`; g.fillRect(-w * 0.12, -H * 0.2, w * 0.24, H * 0.7);
      g.fillStyle = `rgba(${c1},${0.85 * k})`; g.fillRect(-w * 1.4, H * 0.45, w * 2.8, w * 1.4);
      S.dot(g, 0, H * 0.5, w * 3, c0, 0.7 * k);
    } else if (kind === 'spear') {
      g.fillStyle = `rgba(${c0},${0.6 * k})`; g.fillRect(-w * 0.1, -H * 0.4, w * 0.2, H * 1.0);
      g.fillStyle = `rgba(${c1},${0.95 * k})`; g.beginPath(); g.moveTo(0, H * 0.95); g.lineTo(-w * 0.5, H * 0.55); g.lineTo(w * 0.5, H * 0.55); g.closePath(); g.fill();
    } else {
      const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      gr.addColorStop(0, `rgba(${c0},${0.5 * k})`); gr.addColorStop(0.5, `rgba(${c1},${0.95 * k})`); gr.addColorStop(1, `rgba(${c0},${0.5 * k})`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(w / 2, H * 0.85); g.lineTo(0, H); g.lineTo(-w / 2, H * 0.85); g.closePath(); g.fill();
      g.fillStyle = `rgba(${c1},${0.95 * k})`; g.fillRect(-w * 1.6, -6, w * 3.2, 8);
      g.fillStyle = `rgba(${c0},${0.8 * k})`; g.fillRect(-w * 0.18, -H * 0.3, w * 0.36, H * 0.3);
      S.dot(g, 0, -H * 0.3, w * 0.8, c1, k, true);
    }
    S.dot(g, 0, H * 0.4, w * 5, c0, 0.35 * k);
    g.restore();
    if (u >= land) {
      const kk = E.win(u, land, 1);
      sub('ring', g, kk, { r: 180, n: 3, w: 5, flat: 0.35, col: L.col, col2: L.col2, dy: 0 }, c, e);
      sub('sparks', g, kk, { n: 30, v: 150, len: 14, grav: 60, col: L.col, col2: L.col2 }, c, e);
      sub('rays', g, kk, { n: 14, len: 260, w: 0.04, col: L.col2 }, c, e);
    }
  });

  // ---------------------------------------------------------------- 日の出（地平に光の線 → 太陽が昇り、光が掃く）
  P('sunrise', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'gold'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.1, 0.2), hy = L.hy || 20, rise = E.out(E.win(u, 0.1, 0.8)), r = L.r || 70;
    const W = 1200;
    const gr = g.createLinearGradient(0, hy - 140, 0, hy + 10);
    gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(1, `rgba(${c0},${0.45 * k})`);
    g.fillStyle = gr; g.fillRect(-W / 2, hy - 140, W, 150);
    S.glowLine(g, -W / 2, hy, W / 2, hy, 3, c0, c1, k * E.out(E.win(u, 0, 0.2)));
    g.save(); g.beginPath(); g.rect(-W / 2, -e.y - 50, W, hy + e.y + 50); g.clip();
    const sy = hy + r - rise * r * 1.7;
    S.dot(g, 0, sy, r * 2.4, c0, 0.45 * k);
    S.dot(g, 0, sy, r * 0.9, c1, 0.75 * k, true);
    g.strokeStyle = `rgba(${c1},${0.8 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(0, sy, r * 0.75, Math.PI, TAU); g.stroke();
    g.restore();
    sub('rays', g, E.win(u, 0.25, 1), { n: 20, len: 520, w: 0.035, col: L.col2, flat: 1, spin: 0.15, r0: r }, c, { ...e });
  });

  // ---------------------------------------------------------------- 大鷹（光の鳥が弧を描いて急降下）
  P('hawk', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'gold'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.05, 0.1), fly = E.win(u, 0, L.land || 0.7);
    const px = (t) => [Math.cos(t * 2.4 - 0.3) * 260 * (1 - t) + 20 * (1 - t), -Math.sin(t * 2.4 + 0.2) * 180 * (1 - t) - (1 - t) * 60];
    const [x, y] = px(E.in(fly)), [x2, y2] = px(E.in(Math.max(0, fly - 0.03)));
    const a = Math.atan2(y - y2, x - x2);
    for (let i = 1; i < 14; i++) { const [tx, ty] = px(E.in(Math.max(0, fly - i * 0.02))); S.dot(g, tx, ty, 16 - i, i % 2 ? c0 : c1, 0.5 * k * (1 - i / 14)); }
    if (fly < 1) {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(L.s2 || 1.4, L.s2 || 1.4);
      const fl = Math.sin(e.ms / 70) * 0.3;
      for (const sd of [-1, 1]) {
        g.fillStyle = `rgba(${c1},${0.85 * k})`;
        g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(-8, sd * (30 + fl * 20), -34, sd * (44 + fl * 26)); g.quadraticCurveTo(-18, sd * 12, -16, 0); g.closePath(); g.fill();
      }
      g.fillStyle = `rgba(${c0},${0.95 * k})`; g.beginPath(); g.ellipse(-4, 0, 16, 5, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-18, 0); g.lineTo(-30, -6); g.lineTo(-30, 6); g.closePath(); g.fill();
      S.dot(g, 6, 0, 22, c0, 0.7 * k);
      g.restore();
    } else {
      const kk = E.win(u, L.land || 0.7, 1);
      sub('petals', g, kk, { n: 20, w: 120, h: 80, kind: 'feather', col: L.col, col2: L.col2 }, c, e);
      sub('ring', g, kk, { r: 110, n: 2, w: 4, col: L.col, col2: L.col2 }, c, e);
    }
  });

  // ---------------------------------------------------------------- 魔女の大釜（足もとの大きな釜が煮え立ち、髑髏の泡と毒の湯気）
  P('cauldron', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'poison'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.1, 0.18), rise = E.out3(E.win(u, 0, 0.3)), W = L.w || 150, gy = (L.gy || 50) + (1 - rise) * 80;
    g.save(); g.translate(0, gy);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(22,16,26,${k})`;
    g.beginPath(); g.ellipse(0, -W * 0.25, W * 0.55, W * 0.42, 0, 0, TAU); g.fill();
    g.fillRect(-W * 0.4, W * 0.08, 8, 16); g.fillRect(W * 0.4 - 8, W * 0.08, 8, 16);
    g.globalCompositeOperation = 'lighter';
    // 湯の面
    g.fillStyle = `rgba(${c0},${0.85 * k})`; g.beginPath(); g.ellipse(0, -W * 0.52, W * 0.46, W * 0.1, 0, 0, TAU); g.fill();
    g.strokeStyle = `rgba(${c1},${0.9 * k})`; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -W * 0.52, W * 0.5, W * 0.12, 0, 0, TAU); g.stroke();
    S.dot(g, 0, -W * 0.55, W * 0.7, c0, 0.5 * k);
    // 髑髏の泡
    for (let i = 0; i < N(c, 10); i++) {
      const s = e.seed + i * 13, ph = (hr(s) + u * 1.4) % 1, x = (hr(s + 1) - 0.5) * W * 0.8, y = -W * 0.55 - ph * 170, r = 7 + hr(s + 2) * 6;
      const a = k * (1 - ph);
      g.strokeStyle = `rgba(${c1},${a})`; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      if (i % 3 === 0) { g.fillStyle = `rgba(20,10,30,${a})`; g.globalCompositeOperation = 'source-over'; g.fillRect(x - r * 0.45, y - r * 0.2, r * 0.3, r * 0.3); g.fillRect(x + r * 0.15, y - r * 0.2, r * 0.3, r * 0.3); g.globalCompositeOperation = 'lighter'; }
    }
    g.restore();
    sub('smoke', g, u, { n: 10, r: 30, w: 40, v: 30, rise: 160, col: '120,60,150', a: 0.5, dy: 0 }, c, e);
  });

  // ---------------------------------------------------------------- 氷の彫像（的を結晶が包み、最後に砕ける）
  P('crystal', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'ice'), c1 = col(c, L.col2, 1);
    const grow = E.out3(E.win(u, 0, 0.45)), br = E.win(u, L.brk || 0.72, 1), k = E.env(u, 0.05, 0.05);
    const H = (L.h || 90), W = L.w || 60;
    if (br <= 0) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const s = e.seed + i * 11, x = (i / 6 - 0.5) * W, h = H * (0.6 + hr(s) * 0.5) * grow, w = 12 + hr(s + 1) * 10, lean = (i / 6 - 0.5) * 0.4;
        g.save(); g.translate(x, 30); g.rotate(lean);
        g.fillStyle = `rgba(${c0},${0.35 * k})`; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h * 0.85); g.lineTo(0, -h); g.lineTo(w / 2, -h * 0.85); g.lineTo(w / 2, 0); g.closePath(); g.fill();
        g.strokeStyle = `rgba(${c1},${0.9 * k})`; g.lineWidth = 1.4; g.stroke();
        S.line(g, -w * 0.2, -h * 0.1, -w * 0.1, -h * 0.8, 1, c1, 0.6 * k);
        g.restore();
      }
      if (u > 0.5) { const cr = E.win(u, 0.5, L.brk || 0.72); g.strokeStyle = `rgba(255,255,255,${cr})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-10, -40); g.lineTo(4, -18); g.lineTo(-6, 0); g.lineTo(10, 20); g.stroke(); }
    } else {
      sub('shards', g, br, { n: 24, r: 30, size: 12, out: 1, hold: 0, col: L.col, col2: L.col2 }, c, e);
      S.dot(g, 0, 0, 90 * (1 - br), c1, 1 - br);
    }
  });

  // ---------------------------------------------------------------- 砂の墓標（墓石が地から並んでせり上がる）
  P('tombs', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'earth'), c1 = col(c, L.col2, 1);
    const n = L.n || 7, W = L.w || 320, k = E.env(u, 0.08, 0.15);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 17, d = i / n * 0.35, up = E.out3(E.win(u, d, d + 0.25));
      if (up <= 0) continue;
      const x = (i / (n - 1) - 0.5) * W, y = 34 + (hr(s) - 0.5) * 40, h = (46 + hr(s + 1) * 26) * up, w = 26 + hr(s + 2) * 10, tilt = (hr(s + 3) - 0.5) * 0.3;
      g.save(); g.translate(x, y); g.rotate(tilt);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(92,78,64,${0.97 * k})`;
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + w / 2); g.arc(0, -h + w / 2, w / 2, Math.PI, 0); g.lineTo(w / 2, 0); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${c0},${0.7 * k})`; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = `rgba(${c1},${0.8 * k})`; g.fillRect(-1.5, -h + 8, 3, 18); g.fillRect(-7, -h + 13, 14, 3);
      g.restore();
      S.dot(g, x, y, 30, c0, 0.4 * k * (1 - up * 0.5));
    }
  });

  // ---------------------------------------------------------------- 大鐘（的の上に大きな鐘。揺れて音の輪が広がる）
  P('bell', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'gold'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.1, 0.2), drop = E.out3(E.win(u, 0, 0.3)), sw = Math.sin(e.ms / 90) * 0.25 * E.win(u, 0.3, 0.5) * (1 - E.win(u, 0.7, 1));
    const by = -e.y * 0.3 * (1 - drop) - (L.hy || 70);
    g.save(); g.translate(0, by); g.rotate(sw);
    const W = L.w || 70;
    g.fillStyle = `rgba(${c0},${0.7 * k})`;
    g.beginPath(); g.moveTo(-W * 0.3, -W * 0.8); g.quadraticCurveTo(-W * 0.4, -W * 0.1, -W * 0.7, W * 0.3); g.lineTo(W * 0.7, W * 0.3); g.quadraticCurveTo(W * 0.4, -W * 0.1, W * 0.3, -W * 0.8); g.closePath(); g.fill();
    g.strokeStyle = `rgba(${c1},${0.95 * k})`; g.lineWidth = 2.5; g.stroke();
    g.fillRect(-W * 0.72, W * 0.25, W * 1.44, 5);
    S.dot(g, 0, W * 0.4, W * 0.3, c1, k, true);
    g.restore();
    // 音の輪
    if (u > 0.3) for (let j = 0; j < 4; j++) { const kk = E.win(u, 0.3 + j * 0.1, 0.8 + j * 0.05); if (kk > 0 && kk < 1) { g.strokeStyle = `rgba(${c1},${0.8 * (1 - kk)})`; g.lineWidth = 3 * (1 - kk) + 1; g.beginPath(); g.ellipse(0, by, 40 + kk * 220, (40 + kk * 220) * 0.55, 0, 0, TAU); g.stroke(); } }
  });

  // ---------------------------------------------------------------- 山並み（的の後ろに岩山がせり上がり、縦の光で割れる）
  P('mountain', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'earth'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.06, 0.15), rise = E.out3(E.win(u, 0, 0.35)), split = E.inOut(E.win(u, L.split || 0.5, 0.85));
    const W = L.w || 520, H = (L.h || 170) * rise, gy = L.gy || 40;
    const peaks = 9;
    for (const side of [-1, 1]) {
      g.save(); g.translate(side * split * 40, gy);
      g.beginPath(); g.rect(side < 0 ? -W : 0, -H - 40, W, H + 80); g.clip();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(62,48,40,${0.96 * k})`;
      g.beginPath(); g.moveTo(-W / 2, 0);
      for (let i = 0; i <= peaks * 2; i++) { const x = -W / 2 + i / (peaks * 2) * W, s = e.seed + i; const h = i % 2 ? H * (0.55 + hr(s) * 0.45) * (1 - Math.abs(x) / W) : H * 0.25 * hr(s + 3); g.lineTo(x, -h); }
      g.lineTo(W / 2, 0); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${c0},${0.6 * k})`; g.lineWidth = 2; g.stroke();
      g.restore();
    }
    if (split > 0) {
      const gr = g.createLinearGradient(-30, 0, 30, 0);
      gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(0.5, `rgba(${c1},${0.95 * E.bell(split * 0.9 + 0.1)})`); gr.addColorStop(1, `rgba(${c0},0)`);
      g.fillStyle = gr; g.fillRect(-30, -e.y, 60, e.y + gy + 30);
    }
  });

  // ---------------------------------------------------------------- 天の眼（空に大きな眼が開き、瞳から光が落ちる）
  P('eye', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'staff'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.1, 0.15), open = E.inOut(E.win(u, 0.05, 0.35)) * (1 - E.in(E.win(u, 0.85, 1)));
    const ey = -e.y * 0.58, W = L.w || 150, Hh = W * 0.38 * open;
    S.dot(g, 0, ey, W * 1.3, c0, 0.4 * k);
    sub('runes', g, u, { r: W * 0.95, flat: 0.5, sides: 9, rings: 3, glyphs: 30, spin: 0.4, col: L.col, col2: L.col2 }, c, { ...e });
    g.save(); g.translate(0, ey - e.y * 0);
    g.restore();
    g.save(); g.translate(0, ey);
    g.beginPath(); g.moveTo(-W, 0); g.quadraticCurveTo(0, -Hh * 2, W, 0); g.quadraticCurveTo(0, Hh * 2, -W, 0); g.closePath();
    g.fillStyle = `rgba(250,245,255,${0.85 * k})`; g.fill();
    g.strokeStyle = `rgba(${c1},${k})`; g.lineWidth = 3; g.stroke();
    g.save(); g.clip();
    const look = Math.sin(e.ms / 500) * W * 0.12;
    S.dot(g, look, 0, W * 0.34, c0, k, true);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(12,6,30,${k})`; g.beginPath(); g.ellipse(look, 0, W * 0.08, W * 0.2 * open, 0, 0, TAU); g.fill();
    g.restore();
    g.restore();
    if (u > 0.4) {
      const kk = E.win(u, 0.4, 1);
      for (const t of c.tgts) {
        const tx = (t.x - e.x) * (c.dir < 0 ? 1 : -1), ty = t.y - e.y;
        S.glowLine(g, 0, ey, tx, ty, 5 * E.bell(kk), c0, c1, E.bell(kk));
        S.dot(g, tx, ty, 30 * E.bell(kk), c1, E.bell(kk));
      }
    }
  });

  // ---------------------------------------------------------------- 翼（背に大きな光の翼が開く）
  P('wings', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'light'), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.1, 0.25), open = E.out3(E.win(u, 0, 0.45)), W = L.w || 150;
    for (const sd of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        const n = 9 - row * 2;
        for (let f = 0; f < n; f++) {
          const t = f / (n - 1), a = -Math.PI / 2 + sd * (0.3 + t * 1.25 * open) + sd * Math.sin(e.ms / 400) * 0.05;
          const len = W * (1 - row * 0.28) * (0.55 + 0.45 * Math.sin(t * Math.PI * 0.9 + 0.2));
          const x0 = sd * 8, y0 = -20;
          g.fillStyle = `rgba(${row ? c0 : c1},${(0.35 + row * 0.15) * k})`;
          g.save(); g.translate(x0, y0); g.rotate(a);
          g.beginPath(); g.ellipse(len / 2, 0, len / 2, 6 + row * 2, 0, 0, TAU); g.fill();
          g.restore();
        }
      }
    }
    S.dot(g, 0, -20, W * 0.7, c0, 0.5 * k);
  });

  // ---------------------------------------------------------------- 影分身（黒い人影が四方から的を斬り抜ける）
  P('clones', (g, u, L, c, e) => {
    const n = L.n || 6, c0 = col(c, L.col, 'dark'), c1 = col(c, L.col2, 1);
    for (let j = 0; j < n; j++) {
      const st = j / n * 0.7, uj = E.win(u, st, st + 0.3);
      if (uj <= 0 || uj >= 1) continue;
      const a = (j / n) * TAU + (L.a0 || 0.4), d = 150;
      const k = E.inOut(uj), x = Math.cos(a) * d * (1 - 2 * k), y = Math.sin(a) * d * 0.45 * (1 - 2 * k);
      const fade = E.bell(uj);
      // 人影
      const cs = L.size || 1;
      g.save(); g.translate(x, y); g.scale((Math.cos(a) > 0 ? -1 : 1) * cs, cs);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(10,4,18,${0.85 * fade})`;
      g.beginPath(); g.arc(0, -34, 7, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-6, -27); g.lineTo(8, -26); g.lineTo(14, -8); g.lineTo(4, -10); g.lineTo(10, 8); g.lineTo(2, 8); g.lineTo(-2, -6); g.lineTo(-10, 8); g.lineTo(-16, 6); g.lineTo(-8, -10); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${c0},${0.8 * fade})`; g.lineWidth = 1.2; g.stroke();
      S.line(g, 10, -22, 30, -34, 2, c1, fade);
      g.restore();
      // 残像の筋と斬り線
      S.line(g, Math.cos(a) * d, Math.sin(a) * d * 0.45 - 20, x, y - 20, 3, c0, 0.4 * fade);
      if (uj > 0.45 && uj < 0.8) sub('cut', g, E.win(uj, 0.45, 0.8), { n: 1, len: 90, ang: a + Math.PI / 2, w: 3, col: L.col, col2: L.col2 }, c, { ...e, seed: e.seed + j });
    }
  });

  // ---------------------------------------------------------------- 雷雲（空を覆う黒雲と、中で走る稲光）
  P('storm', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'thunder'), k = E.env(u, 0.12, 0.2), top = -e.y;
    const W = L.w || 1000;
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < N(c, 26); i++) {
      const s = e.seed + i * 13, x = (hr(s) - 0.5) * W + Math.sin(e.ms / 900 + i) * 12, y = top + 20 + hr(s + 1) * 90, r = 50 + hr(s + 2) * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${L.cloud || '30,30,46'},${0.9 * k})`); gr.addColorStop(1, `rgba(${L.cloud || '30,30,46'},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'lighter';
    const fl = Math.floor(e.ms / 70);
    for (let i = 0; i < 3; i++) { const s = e.seed + fl * 7 + i; if (hr(s) < 0.35) S.dot(g, (hr(s + 1) - 0.5) * W, top + 60 + hr(s + 2) * 50, 90, c0, 0.5 * k); }
    if (L.bolts) {
      const n = N(c, L.bolts);
      for (let j = 0; j < n; j++) {
        const s = e.seed + j * 53, st = hr(s) * 0.8, uj = E.win(u, st, st + 0.12);
        if (uj <= 0 || uj >= 1) continue;
        const tx = (hr(s + 1) - 0.5) * (L.bw || 360), ty = (hr(s + 2) - 0.5) * 60;
        g.save(); g.translate(tx, ty);
        S.prims.bolt(g, uj, { n: 1, h: e.y + ty + 40 - 80, w: 2.5, jag: 26, col: L.col, col2: L.col2 }, c, { ...e, y: e.y + ty, seed: s, ms: e.ms });
        g.restore();
      }
    }
    if (L.drops) sub('gale', g, u, { n: L.drops, kind: 'rain', ang: 3, sp: 3, len: 30, col: L.dropCol || '150,180,255', a: 0.5 }, c, { ...e, seed: e.seed + 5 });
  });

  // ---------------------------------------------------------------- 守りの紋: L.kind 'dome'（丸屋根）|'wall'（光の城壁）|'shield'（盾の紋）|'trio'（三つの紋）
  P('crest', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1), k = E.env(u, 0.12, 0.3), grow = E.out3(E.win(u, 0, 0.4));
    const kind = L.kind || 'shield', W = L.w || 60;
    if (kind === 'dome') {
      const r = W * grow;
      g.save(); g.translate(0, 30);
      const gr = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r);
      gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(0.85, `rgba(${c0},${0.25 * k})`); gr.addColorStop(1, `rgba(${c1},${0.6 * k})`);
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r, r * 0.8, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = `rgba(${c1},${0.8 * k})`; g.lineWidth = 1.2;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.ellipse(0, 0, r * i / 6, r * 0.8, 0, Math.PI, TAU); g.stroke(); }
      for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(0, -r * 0.8 * i / 4, r * Math.sqrt(1 - (i / 4) * (i / 4)), 4, 0, 0, TAU); g.stroke(); }
      g.restore();
      return;
    }
    if (kind === 'wall') {
      const H = (L.h || 110) * grow;
      g.save(); g.translate(-(L.off || 34), 30);
      const gr = g.createLinearGradient(0, -H, 0, 0);
      gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(1, `rgba(${c0},${0.4 * k})`);
      g.fillStyle = gr; g.fillRect(-8, -H, 16, H);
      g.strokeStyle = `rgba(${c1},${0.85 * k})`; g.lineWidth = 1.2;
      for (let y = 0; y < H; y += 14) { const o = (y / 14) % 2 ? 0 : 6; g.strokeRect(-8 + o, -y - 14, 10, 14); }
      g.restore();
      return;
    }
    const n = kind === 'trio' ? 3 : 1;
    for (let j = 0; j < n; j++) {
      const x = n > 1 ? (j - 1) * W * 1.4 : 0, y = -(L.hy || 50) - (n > 1 && j === 1 ? 20 : 0) - E.out(u) * 10;
      const cc = n > 1 ? col(c, [0, 'blood', 'water'][j] === 0 ? 0 : ['fire', 'earth', 'light'][j]) : c0;
      g.save(); g.translate(x, y); g.scale(grow, grow);
      g.fillStyle = `rgba(${cc},${0.45 * k})`;
      g.beginPath(); g.moveTo(0, -W * 0.6); g.lineTo(W * 0.45, -W * 0.45); g.lineTo(W * 0.4, W * 0.1); g.quadraticCurveTo(W * 0.2, W * 0.45, 0, W * 0.6); g.quadraticCurveTo(-W * 0.2, W * 0.45, -W * 0.4, W * 0.1); g.lineTo(-W * 0.45, -W * 0.45); g.closePath(); g.fill();
      g.strokeStyle = `rgba(${c1},${0.95 * k})`; g.lineWidth = 2.2; g.stroke();
      S.star(g, 0, -W * 0.02, W * 0.22, j === 0 ? 4 : j === 1 ? 5 : 6, c1, k, e.ms / 800);
      S.dot(g, 0, 0, W * 0.9, cc, 0.4 * k);
      g.restore();
    }
  });

  // ---------------------------------------------------------------- 蓮（光の蓮が開き、泉の輪が広がる）
  P('lotus', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'heal'), c1 = col(c, L.col2, 1), k = E.env(u, 0.1, 0.25), open = E.out3(E.win(u, 0.1, 0.6));
    const W = L.w || 60;
    g.save(); g.translate(0, L.gy || 20);
    for (let layer = 0; layer < 3; layer++) {
      const n = 8 - layer * 2, len = W * (1 - layer * 0.22), spread = (0.35 + layer * 0.1) * open + 0.1;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.6 * spread * 2;
        g.save(); g.rotate(a + Math.PI / 2); g.scale(1, 1);
        g.fillStyle = `rgba(${layer === 2 ? c1 : c0},${(0.3 + layer * 0.18) * k})`;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-len * 0.28, -len * 0.5, 0, -len); g.quadraticCurveTo(len * 0.28, -len * 0.5, 0, 0); g.fill();
        g.strokeStyle = `rgba(${c1},${0.6 * k})`; g.lineWidth = 1; g.stroke();
        g.restore();
      }
    }
    S.dot(g, 0, -W * 0.3, W * 0.8 * open, c1, 0.7 * k);
    g.restore();
    sub('ring', g, E.win(u, 0.2, 1), { r: W * 3, n: 3, gap: 0.2, flat: 0.3, w: 2, col: L.col, col2: L.col2, dy: 0 }, c, { ...e });
  });

  // ---------------------------------------------------------------- 立石（的を囲んで石の柱が立ち、紋が光って結ばれる）
  P('monolith', (g, u, L, c, e) => {
    const n = L.n || 6, c0 = col(c, L.col, 'earth'), c1 = col(c, L.col2, 1), k = E.env(u, 0.06, 0.15);
    const Rr = L.r || 150, pts = [];
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 7, a = i / n * TAU + 0.3, d = i / n * 0.3, up = E.out3(E.win(u, d, d + 0.25));
      const x = Math.cos(a) * Rr, y = 30 + Math.sin(a) * Rr * 0.32, h = (70 + hr(s) * 40) * up, w = 18 + hr(s + 1) * 8;
      pts.push([x, y - h * 0.6, a]);
      if (up <= 0) continue;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(${Math.sin(a) > 0 ? '84,70,60' : '64,54,48'},${0.97 * k})`;
      g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w * 0.4, y - h); g.lineTo(x + w * 0.4, y - h * 1.05); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      const gl = E.win(u, 0.35 + d, 0.55 + d);
      g.fillStyle = `rgba(${c1},${0.9 * k * gl})`;
      for (let r = 0; r < 3; r++) g.fillRect(x - 2, y - h * (0.3 + r * 0.2), 4, 5);
      S.dot(g, x, y - h * 0.5, 16, c0, 0.6 * k * gl);
    }
    if (u > 0.55) {
      const kk = E.win(u, 0.55, 1);
      for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 2) % n]; S.glowLine(g, p[0], p[1], p[0] + (q[0] - p[0]) * E.out(kk), p[1] + (q[1] - p[1]) * E.out(kk), 2, c0, c1, E.bell(kk)); }
      S.dot(g, 0, 0, 140 * E.bell(kk), c0, E.bell(kk) * 0.8);
    }
  });

  // ---------------------------------------------------------------- 陰陽（白と黒の刃が交差し、渦が巻く）
  P('yinyang', (g, u, L, c, e) => {
    const k = E.env(u, 0.1, 0.2), r = (L.r || 60) * E.out3(E.win(u, 0, 0.3)), rot = e.ms / 400;
    g.save(); g.rotate(rot);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(10,6,20,${0.85 * k})`; g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); g.arc(0, r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,250,235,${0.6 * k})`; g.beginPath(); g.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5); g.arc(0, -r / 2, r / 2, -Math.PI / 2, Math.PI / 2, true); g.arc(0, r / 2, r / 2, -Math.PI / 2, Math.PI / 2); g.fill();
    g.strokeStyle = `rgba(255,255,255,${0.8 * k})`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.restore();
    if (u > 0.4) {
      const kk = E.win(u, 0.4, 0.85);
      sub('cut', g, kk, { n: 1, len: 300, ang: -0.8, w: 7, col: '255,250,230', col2: '255,255,255' }, c, e);
      g.globalCompositeOperation = 'source-over';
      const k2 = E.win(u, 0.5, 0.95);
      if (k2 > 0 && k2 < 1) { const p = E.out3(Math.min(1, k2 * 2)), f = 1 - E.in(k2); g.strokeStyle = `rgba(12,4,24,${0.95 * f})`; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-150 * Math.cos(0.8), -150 * Math.sin(0.8)); g.lineTo((-150 + 300 * p) * Math.cos(0.8), (-150 + 300 * p) * Math.sin(0.8)); g.stroke(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = `rgba(190,120,255,${0.8 * f})`; g.lineWidth = 1.5; g.stroke(); }
    }
  });

  // ---------------------------------------------------------------- 鬼火（青紫の火の玉が的の周りを回り、集まって燃える）
  P('wisps', (g, u, L, c, e) => {
    const n = L.n || 6, c0 = col(c, L.col, '140,120,255'), c1 = col(c, L.col2, 1), k = E.env(u, 0.1, 0.15);
    const conv = E.in(E.win(u, 0.55, 0.85));
    for (let j = 0; j < n; j++) {
      const a = j / n * TAU + e.ms / 500, d = (L.r || 70) * (1 - conv);
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.45 - 10 + Math.sin(e.ms / 200 + j) * 6;
      S.dot(g, x, y, 22, c0, 0.7 * k);
      g.fillStyle = `rgba(${c1},${0.9 * k})`; g.beginPath(); g.moveTo(x - 6, y + 4); g.quadraticCurveTo(x, y - 20, x + 6, y + 4); g.quadraticCurveTo(x, y + 9, x - 6, y + 4); g.fill();
    }
    if (u > 0.82) { const kk = E.win(u, 0.82, 1); S.dot(g, 0, 0, 90 * E.out(kk), c0, 1 - kk); sub('flames', g, kk, { n: 18, w: 60, h: 90, col: L.col, col2: L.col2, col3: L.col }, c, e); }
  });

  // ---------------------------------------------------------------- 空割れ（空にひびが走り、空のかけらが降ってくる）
  P('skycrack', (g, u, L, c, e) => {
    const c0 = col(c, L.col, '160,200,255'), c1 = col(c, L.col2, 1), k = E.env(u, 0.05, 0.15);
    const top = -e.y, grow = E.out3(E.win(u, 0, 0.35));
    g.lineJoin = 'miter';
    for (let j = 0; j < 7; j++) {
      const s = e.seed + j * 31;
      let x = (hr(s) - 0.5) * 120, y = top + 60 + hr(s + 1) * 30;
      g.beginPath(); g.moveTo(x, y);
      const a0 = (j / 7) * TAU;
      for (let i = 1; i <= 6; i++) { const d = 30 * grow; x += Math.cos(a0 + (hr(s + i) - 0.5) * 1.2) * d; y += Math.sin(a0 + (hr(s + i) - 0.5) * 1.2) * d * 0.6; g.lineTo(x, y); }
      g.strokeStyle = `rgba(${c0},${0.4 * k})`; g.lineWidth = 6; g.stroke();
      g.strokeStyle = `rgba(${c1},${0.95 * k})`; g.lineWidth = 1.6; g.stroke();
    }
    S.dot(g, 0, top + 80, 140 * grow, c0, 0.5 * k);
    if (u > 0.3) {
      const kk = E.win(u, 0.3, 1);
      for (let i = 0; i < N(c, 12); i++) {
        const s = e.seed + i * 17, st = hr(s) * 0.5, ki = E.win(kk, st, st + 0.45);
        if (ki <= 0 || ki >= 1) continue;
        const x = (hr(s + 1) - 0.5) * 200, y = top + 80 + (e.y - 80 + (hr(s + 2) - 0.5) * 40) * E.in(ki), sz = 10 + hr(s + 3) * 14;
        g.save(); g.translate(x * (1 - ki * 0.6), y); g.rotate(ki * 4 * (hr(s + 4) - 0.5));
        g.fillStyle = `rgba(${c0},${0.6})`; g.beginPath(); g.moveTo(-sz, -sz * 0.4); g.lineTo(0, -sz); g.lineTo(sz * 0.8, 0); g.lineTo(-sz * 0.2, sz * 0.8); g.closePath(); g.fill();
        g.strokeStyle = `rgba(${c1},0.9)`; g.lineWidth = 1.2; g.stroke();
        g.restore();
      }
    }
  });
})(window.RPG);
