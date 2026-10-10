// BSCENE: 演出の汎用の部品（R.BFX.seq の prims）。fn(g, u, L, c, e)
//   u = この層の進み 0〜1、L = 表の値、c = 文脈（fx_seq.js の S.ctx）、e = {x, y（置いた点の画面の座標）, sx, sy（使い手の向きの座標）, seed, i, n, ms}
//   置いた点が原点。+x が使い手の側（味方 → 敵の時は画面の右）。画面の部品（at:'scr'）は画面の座標のまま。
//   粒は状態を持たない（種 e.seed と u から位置を出す）。数は c.q（品質。低 0.5）を掛ける。
(function (R) {
  'use strict';
  const S = R.BFX.seq;
  const P = S.prim;
  const E = S.E, hr = S.hr, col = S.col;
  const TAU = Math.PI * 2;
  const N = (c, n) => Math.max(1, Math.round(n * (c.q || 1)));
  // 虹の 7 色（L.hues で 1 本・1 粒ごとに色を変える）
  const HUES = ['255,110,110', '255,170,80', '255,235,100', '120,240,130', '100,200,255', '120,130,255', '210,130,255'];
  S.HUES = HUES;

  // ================================================================ 画面の部品
  // 暗く（下に敷く）。L.a 最大の濃さ、L.col 色、fi/fo 出入りの割合
  P('dim', (g, u, L, c) => {
    const a = (L.a || 0.4) * E.env(u, L.fi || 0.2, L.fo || 0.3);
    if (a <= 0.004) return;
    // 1 回の塗りで: 的の周りは少し薄く、画面の端ほど暗く（見せ場の集中）
    const col0 = L.col || '6,6,16';
    const gr = g.createRadialGradient(c.tc.x, c.tc.y, Math.min(c.W, c.H) * 0.15, c.tc.x, c.tc.y, Math.max(c.W, c.H) * 0.8);
    gr.addColorStop(0, `rgba(${col0},${a * 0.8})`); gr.addColorStop(1, `rgba(${col0},${Math.min(0.95, a * 1.4)})`);
    g.fillStyle = gr; g.fillRect(-20, -20, c.W + 40, c.H + 40);
  });
  // 閃光（加算）。閃光を減らす設定で 3 割
  P('flash', (g, u, L, c) => {
    const k = u < 0.12 ? u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 2);
    const a = (L.a || 0.3) * k * (c.lf ? 0.3 : 1);
    if (a <= 0.004) return;
    g.fillStyle = `rgba(${col(c, L.col, 1)},${a})`;
    g.fillRect(-20, -20, c.W + 40, c.H + 40);
  });
  // 空の色（上から下へのグラデーション）。L.top / L.bot（rgb）、L.a
  P('sky', (g, u, L, c) => {
    const a = (L.a || 0.5) * E.env(u, L.fi || 0.25, L.fo || 0.3);
    const gr = g.createLinearGradient(0, 0, 0, c.H);
    gr.addColorStop(0, `rgba(${L.top || col(c, 2)},${a})`);
    gr.addColorStop(L.mid || 0.55, `rgba(${L.bot || col(c, 0)},${a * 0.35})`);
    gr.addColorStop(1, `rgba(${L.bot || col(c, 0)},0)`);
    g.fillStyle = gr; g.fillRect(-20, -20, c.W + 40, c.H + 40);
  });
  // 黒帯（映画の帯）
  P('bars', (g, u, L, c) => {
    const k = E.env(u, 0.12, 0.15);
    const h = c.H * (L.h || 0.08) * E.out3(k);
    if (h < 0.5) return;
    g.fillStyle = 'rgba(0,0,0,0.92)';
    g.fillRect(-20, -20, c.W + 40, h + 20); g.fillRect(-20, c.H - h, c.W + 40, h + 20);
  });
  // 集中線（的へ向かう線）。見せ場の溜め
  P('speedlines', (g, u, L, c, e) => {
    const k = E.env(u, 0.2, 0.4) * (L.a || 0.25);
    if (k <= 0.004 || c.rm) return;
    const n = N(c, L.n || 26), cx = c.tc.x, cy = c.tc.y, R0 = Math.max(c.W, c.H) * 0.95;
    const flick = Math.floor(e.ms / 50);
    g.fillStyle = `rgba(${L.col || '255,255,255'},${k})`;
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 13 + flick * 977;
      const ang = (i + hr(s) * 0.8) / n * TAU, w = 0.006 + hr(s + 1) * 0.012;
      const r0 = R0 * (0.32 + hr(s + 2) * 0.22);
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * R0, cy + Math.sin(ang) * R0);
      g.lineTo(cx + Math.cos(ang + w) * R0, cy + Math.sin(ang + w) * R0);
      g.lineTo(cx + Math.cos(ang + w / 2) * r0, cy + Math.sin(ang + w / 2) * r0);
      g.closePath(); g.fill();
    }
  });
  // 差し込みの帯（一番上の段だけ）: 斜めの帯が右から入り、技名を大きく出して左へ抜ける
  P('banner', (g, u, L, c) => {
    if (c.noBanner || !c.name) return;
    const k = R.uiScale || 1;
    const inK = E.out3(E.win(u, 0, 0.2)), outK = E.in(E.win(u, 0.8, 1));
    const cy = c.H * 0.44, bh = 56 * Math.min(1.25, k);
    const slide = (1 - inK) * c.W * 0.6 - outK * c.W * 0.8;
    const rgb = col(c, L.col, 0), hi = col(c, 1);
    g.save();
    g.translate(slide, 0);
    g.globalAlpha *= 1 - outK * 0.6;
    // 帯（斜め）
    const sk = bh * 0.9;
    const gr = g.createLinearGradient(0, 0, c.W, 0);
    gr.addColorStop(0, 'rgba(8,8,18,0)'); gr.addColorStop(0.18, 'rgba(8,8,18,0.86)'); gr.addColorStop(0.82, 'rgba(8,8,18,0.86)'); gr.addColorStop(1, 'rgba(8,8,18,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-20, cy - bh / 2 + sk * 0.2); g.lineTo(c.W + 20, cy - bh / 2 - sk * 0.2); g.lineTo(c.W + 20, cy + bh / 2 - sk * 0.2); g.lineTo(-20, cy + bh / 2 + sk * 0.2); g.closePath(); g.fill();
    g.globalCompositeOperation = 'lighter';
    for (const [dy, w] of [[-bh / 2, 2], [bh / 2, 2]]) {
      const lg = g.createLinearGradient(0, 0, c.W, 0);
      lg.addColorStop(0, `rgba(${rgb},0)`); lg.addColorStop(0.5, `rgba(${rgb},0.95)`); lg.addColorStop(1, `rgba(${rgb},0)`);
      g.strokeStyle = lg; g.lineWidth = w;
      g.beginPath(); g.moveTo(-20, cy + dy + sk * 0.2); g.lineTo(c.W + 20, cy + dy - sk * 0.2); g.stroke();
    }
    // 流れる光の筋
    for (let i = 0; i < 10; i++) {
      const s = c.seed + i * 17, x = ((hr(s) + u * (1.5 + hr(s + 1))) % 1) * c.W, y = cy + (hr(s + 2) - 0.5) * bh * 0.85;
      S.line(g, x, y, x + 40 + hr(s + 3) * 90, y - 3, 1.2, hi, 0.35);
    }
    g.globalCompositeOperation = 'source-over';
    // 技名
    const size = Math.min(40 * Math.min(1.25, k), (c.W * 0.7) / Math.max(1, [...c.name].length) / 1.05);
    g.font = R.Gfx && R.Gfx.font ? R.Gfx.font(size, 700) : `700 ${size}px sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = Math.round(6 * k) + 'px';
    const tx = c.W * 0.5 + (1 - inK) * 30, ty = cy + 1;
    g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = 'rgba(10,6,20,0.95)';
    g.strokeText(c.name, tx, ty);
    const tg = g.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.55, `rgb(${hi})`); tg.addColorStop(1, `rgb(${rgb})`);
    g.fillStyle = tg; g.fillText(c.name, tx, ty);
    g.restore();
  });
  // 画面を横切る流れ（吹雪・砂嵐・火の粉の風）。L.kind 'snow'|'sand'|'ember'|'rain'|'leaf'、L.n、L.ang（傾き）
  P('gale', (g, u, L, c, e) => {
    const n = N(c, L.n || 70), a = E.env(u, 0.15, 0.25) * (L.a || 0.8);
    const rgb = col(c, L.col, 0), hi = col(c, L.col2, 1);
    const sp = L.sp || 1.6, ang = L.ang || 0.18, dir = c.dir < 0 ? -1 : 1;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 29;
      const ph = (hr(s) + u * sp * (0.7 + hr(s + 1) * 0.6)) % 1;
      const x = dir < 0 ? c.W * (1.1 - ph * 1.2) : c.W * (ph * 1.2 - 0.1);
      const y = hr(s + 2) * c.H + ph * c.H * ang;
      const len = (L.len || 26) * (0.5 + hr(s + 3));
      const sz = (L.size || 1.6) * (0.6 + hr(s + 4));
      if (L.kind === 'snow' || L.kind === 'ember') S.dot(g, x, y, sz * 3, i % 3 ? rgb : hi, a * 0.9);
      else S.line(g, x, y, x - dir * len, y - len * ang, sz, i % 4 ? rgb : hi, a * 0.55);
    }
  });

  // ================================================================ 武器の部品
  // 三日月の弧: L.r 半径、L.a0 始まりの角、L.sw 振る角、L.w 太さ、L.n 本数、L.rot 1 本ごとの回り、L.gap 遅れ、L.flat 楕円、L.alt 当たりごとに逆
  P('arc', (g, u, L, c, e) => {
    const n = L.n || 1, gap = L.gap != null ? L.gap : 0.18;
    const span = Math.max(0.2, 1 - gap * (n - 1));
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const flip = L.alt && (e.hit || 0) % 2 ? -1 : 1;
    g.lineCap = 'round';
    for (let j = 0; j < n; j++) {
      const uj = E.win(u, j * gap, j * gap + span);
      if (uj <= 0 || uj >= 1) continue;
      const head = E.out3(Math.min(1, uj * 1.8)), tail = E.in(E.win(uj, 0.2, 1));
      const a0 = (L.a0 != null ? L.a0 : -2.3) + j * (L.rot || 0.9) + (L.spin || 0) * u, sw = (L.sw || 2.2);
      const r = (L.r || 36) * (1 + j * (L.grow || 0)), w = (L.w || 8) * (1 - tail * 0.6);
      const fade = 1 - tail;
      g.save();
      g.scale(1, (L.flat || 1) * flip);
      g.rotate(L.tilt || 0);
      const s0 = a0 + sw * tail, s1 = a0 + sw * head;
      if (s1 > s0 + 0.01) {
        g.strokeStyle = `rgba(${c0},${0.2 * fade})`; g.lineWidth = w * 2.6; g.beginPath(); g.arc(0, 0, r, s0, s1); g.stroke();
        g.strokeStyle = `rgba(${c0},${0.6 * fade})`; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, s0, s1); g.stroke();
        g.strokeStyle = `rgba(${c1},${0.95 * fade})`; g.lineWidth = Math.max(1, w * 0.32); g.beginPath(); g.arc(0, 0, r, (s0 + s1) / 2, s1); g.stroke();
        S.dot(g, Math.cos(s1) * r, Math.sin(s1) * r, w * 1.6, c1, fade * 0.9);
      }
      g.restore();
    }
  });
  // まっすぐの斬り線（X・十字・放射）: L.n 本、L.len 長さ、L.ang 始まりの角、L.step 1 本ごとの角、L.w、L.gap、L.jit（角のゆらぎ）
  P('cut', (g, u, L, c, e) => {
    const n = L.n || 1, gap = L.gap != null ? L.gap : 0.14, span = Math.max(0.2, 1 - gap * (n - 1));
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    for (let j = 0; j < n; j++) {
      const uj = E.win(u, j * gap, j * gap + span);
      if (uj <= 0 || uj >= 1) continue;
      const s = e.seed + j * 53 + (e.hit || 0) * 11;
      const ang = (L.ang != null ? L.ang : -0.7) + j * (L.step != null ? L.step : Math.PI / Math.max(2, n)) + (hr(s) - 0.5) * (L.jit || 0);
      const len = (L.len || 70) * (0.85 + hr(s + 1) * 0.3), w = L.w || 4;
      const head = E.out3(Math.min(1, uj * 2.2)), tail = E.in(E.win(uj, 0.3, 1));
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const p0 = -len / 2 + len * tail, p1 = -len / 2 + len * head;
      const ox = (L.off || 0) * (hr(s + 2) - 0.5), oy = (L.off || 0) * (hr(s + 3) - 0.5);
      S.glowLine(g, ox + ca * p0, oy + sa * p0, ox + ca * p1, oy + sa * p1, w * (1 - tail * 0.5), c0, c1, 1 - tail * 0.7);
      if (head < 1) S.dot(g, ox + ca * p1, oy + sa * p1, w * 3, c1, 0.9);
      // 残る細い傷
      if (L.scar && uj > 0.45) S.line(g, ox - ca * len * 0.5, oy - sa * len * 0.5, ox + ca * len * 0.5, oy + sa * len * 0.5, 1, c1, 0.5 * (1 - uj));
    }
  });
  // 突き（光の槍）: 使い手の側（+x）から的を貫いて -x へ。L.len、L.w、L.n（連続）、L.spread（縦のずれ）、L.ang、L.through（抜ける長さ）
  P('thrust', (g, u, L, c, e) => {
    const n = N(c, L.n || 1), gap = n > 1 ? (L.gap != null ? L.gap : 0.7 / n) : 0, span = Math.max(0.18, 1 - gap * (n - 1));
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    for (let j = 0; j < n; j++) {
      const uj = E.win(u, j * gap, j * gap + span);
      if (uj <= 0 || uj >= 1) continue;
      const s = e.seed + j * 71 + (e.hit || 0) * 5;
      const ang = (L.ang || 0) + (hr(s) - 0.5) * (L.aj || 0), oy = (hr(s + 1) - 0.5) * (L.spread || 0), ox = (hr(s + 2) - 0.5) * (L.spread || 0) * 0.6;
      const len = L.len || 90, thr = L.through || 24;
      const head = E.out3(Math.min(1, uj * 2.4)), fade = 1 - E.win(uj, 0.35, 1);
      const x0 = len, x1 = len - (len + thr) * head;
      g.save(); g.translate(ox, oy); g.rotate(ang);
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(1, `rgba(${c1},${0.95 * fade})`);
      const w = (L.w || 3) * (0.7 + 0.3 * fade);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0, -w * 0.4); g.lineTo(x1, -w * 0.5); g.lineTo(x1 - w * 3, 0); g.lineTo(x1, w * 0.5); g.lineTo(x0, w * 0.4); g.closePath(); g.fill();
      g.fillStyle = `rgba(${c0},${0.25 * fade})`; g.fillRect(x1, -w * 1.6, x0 - x1, w * 3.2);
      if (head > 0.5) S.star(g, 0, 0, (L.star || 12) * fade, 4, c1, fade, 0.785);
      g.restore();
    }
  });
  // 輪（衝撃波）: L.r0→L.r、L.w、L.flat（地面なら 0.35）、L.n（何重）、L.gap、L.fill（中の光）
  P('ring', (g, u, L, c, e) => {
    const n = L.n || 1, gap = L.gap != null ? L.gap : 0.16, span = Math.max(0.3, 1 - gap * (n - 1));
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    for (let j = 0; j < n; j++) {
      const uj = E.win(u, j * gap, j * gap + span);
      if (uj <= 0 || uj >= 1) continue;
      const r = (L.r0 || 4) + ((L.r || 50) - (L.r0 || 4)) * E.out3(uj), fade = 1 - E.in(uj);
      const fl = L.flat || 1, w = (L.w || 3) * fade + 0.5;
      g.strokeStyle = `rgba(${c0},${0.35 * fade})`; g.lineWidth = w * 3;
      g.beginPath(); g.ellipse(0, 0, r, r * fl, 0, 0, TAU); g.stroke();
      g.strokeStyle = `rgba(${c1},${0.9 * fade})`; g.lineWidth = w;
      g.beginPath(); g.ellipse(0, 0, r, r * fl, 0, 0, TAU); g.stroke();
      if (L.fill) S.dot(g, 0, 0, r * 1.1, c0, L.fill * fade);
    }
  });
  // 火花（放射）: L.n、L.v（飛ぶ距離）、L.grav、L.len（筋）、L.size、L.ang・L.spread（向き。既定は全方向）、L.star（星形）
  P('sparks', (g, u, L, c, e) => {
    const n = N(c, L.n || 12), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const k = E.out3(u), fade = 1 - E.in(u);
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 17 + (e.hit || 0) * 3;
      const ang = L.spread != null ? (L.ang || 0) + (hr(s) - 0.5) * L.spread : hr(s) * TAU;
      const d = (L.v || 40) * (0.35 + hr(s + 1) * 0.65) * k;
      const x = Math.cos(ang) * d, y = Math.sin(ang) * d * (L.flat || 1) + (L.grav || 0) * u * u;
      const len = (L.len || 7) * fade;
      const cc = i % 3 ? c0 : c1;
      if (L.star) S.star(g, x, y, (L.size || 4) * fade + 1, 4, cc, fade, u * 3 + i);
      else if (len > 0.5) S.line(g, x, y, x - Math.cos(ang) * len, y - Math.sin(ang) * len * (L.flat || 1), L.size || 1.8, cc, fade);
      if (L.glow) S.dot(g, x, y, (L.size || 2) * 4, cc, fade * 0.6);
    }
  });
  // 柔らかい大きな光: L.r、L.a、L.pulse（脈）、L.fi・L.fo
  P('glow', (g, u, L, c, e) => {
    const a = (L.a || 0.6) * E.env(u, L.fi != null ? L.fi : 0.15, L.fo != null ? L.fo : 0.5) * (L.pulse ? 0.75 + 0.25 * Math.sin(e.ms / (L.pulse || 80)) : 1);
    const r = (L.r || 50) * (L.grow ? 0.6 + 0.4 * E.out(u) * L.grow : 1);
    S.dot(g, 0, 0, r, col(c, L.col, 0), a);
    if (L.core) S.dot(g, 0, 0, r * 0.35, col(c, L.col2, 1), a, true);
  });
  // 岩のかけら: L.n、L.v、L.grav、L.size
  P('debris', (g, u, L, c, e) => {
    const n = N(c, L.n || 10), c0 = col(c, L.col, 'earth'), fade = 1 - E.win(u, 0.6, 1);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 23;
      const ang = -Math.PI / 2 + (hr(s) - 0.5) * (L.spread || 2.2);
      const v = (L.v || 60) * (0.5 + hr(s + 1) * 0.6);
      const x = Math.cos(ang) * v * u + (hr(s + 5) - 0.5) * (L.w || 20), y = Math.sin(ang) * v * u + (L.grav || 140) * u * u;
      const sz = (L.size || 5) * (0.5 + hr(s + 2));
      g.save(); g.translate(x, y); g.rotate(u * 8 * (hr(s + 3) - 0.5));
      g.fillStyle = `rgba(${c0},${0.95 * fade})`;
      g.beginPath(); g.moveTo(-sz, -sz * 0.4); g.lineTo(-sz * 0.2, -sz); g.lineTo(sz, -sz * 0.3); g.lineTo(sz * 0.6, sz * 0.7); g.lineTo(-sz * 0.6, sz * 0.6); g.closePath(); g.fill();
      g.fillStyle = `rgba(255,240,210,${0.35 * fade})`; g.fillRect(-sz * 0.5, -sz * 0.7, sz * 0.7, sz * 0.3);
      g.restore();
    }
  });
  // 地割れ（地面に放射する光る裂け目）: L.n、L.len、L.flat、L.w
  P('crack', (g, u, L, c, e) => {
    const n = N(c, L.n || 6), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const grow = E.out3(E.win(u, 0, 0.35)), fade = 1 - E.win(u, 0.6, 1);
    g.lineJoin = 'miter'; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 41;
      const ang = L.dirx ? (hr(s) < 0.5 ? Math.PI : 0) + (hr(s + 9) - 0.5) * 0.8 : (i + hr(s) * 0.6) / n * TAU;
      const len = (L.len || 60) * (0.6 + hr(s + 1) * 0.5) * grow;
      g.beginPath();
      let x = 0, y = 0; g.moveTo(0, 0);
      const seg = 5;
      for (let k = 1; k <= seg; k++) {
        const d = len * k / seg, j = (hr(s + k * 3) - 0.5) * 0.7;
        x = Math.cos(ang + j) * d; y = Math.sin(ang + j) * d * (L.flat || 0.35);
        g.lineTo(x, y);
      }
      g.strokeStyle = `rgba(${c0},${0.5 * fade})`; g.lineWidth = (L.w || 2) * 3; g.stroke();
      g.strokeStyle = `rgba(${c1},${0.95 * fade})`; g.lineWidth = L.w || 2; g.stroke();
    }
    S.dot(g, 0, 0, (L.len || 60) * 0.6, c0, 0.5 * fade * grow);
  });
  // 飛ぶ物（矢・短剣・石・火の玉・光の槍）: 使い手（e.sx, e.sy）から的へ。L.n、L.arc（山の高さ）、L.spread、L.kind、L.size、L.gap
  P('shots', (g, u, L, c, e) => {
    const n = N(c, L.n || 1), gap = n > 1 ? (L.gap != null ? L.gap : 0.5 / n) : 0, span = Math.max(0.2, 1 - gap * (n - 1));
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const sx = L.fromTop ? (L.fx || 40) : e.sx * (L.from || 1), sy = L.fromTop ? -e.y - 40 : e.sy - 20;
    for (let j = 0; j < n; j++) {
      const uj = E.win(u, j * gap, j * gap + span);
      if (uj <= 0 || uj >= 1) continue;
      const s = e.seed + j * 37 + (e.hit || 0) * 7;
      const tx = (hr(s) - 0.5) * (L.spread || 0), ty = (hr(s + 1) - 0.5) * (L.spread || 0) * 0.6;
      const fly = L.fly || 0.75;
      const k = E.win(uj, 0, fly), kk = L.ease ? E.in(k) : k;
      const arc = (L.arc != null ? L.arc : 30) * (1 + (hr(s + 2) - 0.5) * 0.6);
      const x = sx + (tx - sx) * kk, y = sy + (ty - sy) * kk - arc * 4 * kk * (1 - kk);
      const dx = (tx - sx) - 0, dy = (ty - sy) - arc * 4 * (1 - 2 * kk);
      const ang = Math.atan2(dy, dx);
      if (k < 1) {
        const tl = L.trail || 36;
        g.save(); g.translate(x, y); g.rotate(ang);
        const gr = g.createLinearGradient(-tl, 0, 0, 0);
        gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(1, `rgba(${c1},0.9)`);
        g.fillStyle = gr; g.fillRect(-tl, -(L.tw || 1.5), tl, (L.tw || 1.5) * 2);
        drawShot(g, L.kind || 'arrow', L.size || 1, c0, c1, e.ms + j * 40);
        g.restore();
      } else {
        const hk = E.win(uj, fly, 1), fade = 1 - hk;
        S.star(g, tx, ty, (L.burst || 12) * (0.4 + hk), 4, c1, fade, hk * 2);
        S.dot(g, tx, ty, (L.burst || 12) * 1.8, c0, fade * 0.6);
      }
    }
  });
  function drawShot(g, kind, s, c0, c1, ms) {
    switch (kind) {
      case 'arrow':
        g.fillStyle = `rgba(${c1},1)`; g.beginPath(); g.moveTo(7 * s, 0); g.lineTo(-1 * s, -3 * s); g.lineTo(-1 * s, 3 * s); g.closePath(); g.fill();
        g.fillStyle = `rgba(${c0},0.9)`; g.fillRect(-14 * s, -0.8 * s, 14 * s, 1.6 * s);
        g.fillStyle = `rgba(${c0},0.8)`; g.beginPath(); g.moveTo(-14 * s, 0); g.lineTo(-18 * s, -3 * s); g.lineTo(-12 * s, 0); g.lineTo(-18 * s, 3 * s); g.closePath(); g.fill();
        break;
      case 'knife':
        g.rotate(ms / 30);
        g.fillStyle = `rgba(${c1},1)`; g.beginPath(); g.moveTo(8 * s, 0); g.lineTo(0, -2 * s); g.lineTo(-4 * s, 0); g.lineTo(0, 2 * s); g.closePath(); g.fill();
        g.fillStyle = `rgba(${c0},0.9)`; g.fillRect(-8 * s, -1.2 * s, 4 * s, 2.4 * s);
        break;
      case 'spin':
        g.rotate(ms / 25);
        g.strokeStyle = `rgba(${c1},0.95)`; g.lineWidth = 3 * s; g.beginPath(); g.arc(0, 0, 12 * s, 0, 4.5); g.stroke();
        g.strokeStyle = `rgba(${c0},0.4)`; g.lineWidth = 8 * s; g.beginPath(); g.arc(0, 0, 12 * s, 0, 5.5); g.stroke();
        break;
      case 'rock':
        g.rotate(ms / 60);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = `rgba(${c0},1)`; g.beginPath(); g.moveTo(-5 * s, -3 * s); g.lineTo(2 * s, -5 * s); g.lineTo(6 * s, 0); g.lineTo(2 * s, 5 * s); g.lineTo(-5 * s, 3 * s); g.closePath(); g.fill();
        g.globalCompositeOperation = 'lighter';
        break;
      case 'orb':
        S.dot(g, 0, 0, 16 * s, c0, 0.8); S.dot(g, 0, 0, 7 * s, c1, 1, true);
        break;
      case 'flame':
        S.dot(g, 0, 0, 14 * s, c0, 0.9); S.dot(g, 2 * s, 0, 6 * s, c1, 1, true);
        g.fillStyle = `rgba(${c0},0.6)`; g.beginPath(); g.moveTo(6 * s, 0); g.quadraticCurveTo(-4 * s, -8 * s, -22 * s, 0); g.quadraticCurveTo(-4 * s, 8 * s, 6 * s, 0); g.fill();
        break;
      case 'lance':
        g.fillStyle = `rgba(${c1},1)`; g.beginPath(); g.moveTo(14 * s, 0); g.lineTo(-10 * s, -2.5 * s); g.lineTo(-18 * s, 0); g.lineTo(-10 * s, 2.5 * s); g.closePath(); g.fill();
        S.dot(g, 0, 0, 14 * s, c0, 0.7);
        break;
      case 'feather':
        g.fillStyle = `rgba(${c1},0.95)`; g.beginPath(); g.ellipse(0, 0, 9 * s, 2.6 * s, 0, 0, TAU); g.fill();
        S.dot(g, 0, 0, 12 * s, c0, 0.5);
        break;
      default:
        S.dot(g, 0, 0, 10 * s, c0, 0.9); S.dot(g, 0, 0, 4 * s, c1, 1, true);
    }
  }
  S.drawShot = drawShot;
  // 空から降る物: L.n、L.w（範囲の幅）、L.h（高さ）、L.slant、L.kind（'arrow'|'star'|'flame'|'drop'|'shard'|'sword'|'feather'|'ember'）、L.life、L.splash
  P('rain', (g, u, L, c, e) => {
    const n = N(c, L.n || 16), c0b = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const life = L.life || 0.35, W = L.w || 160, Hh = L.h || 260, sl = L.slant != null ? L.slant : 0.35;
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 19;
      const c0 = L.hues ? HUES[i % HUES.length] : c0b;
      const st = hr(s) * (1 - life);
      const k = (u - st) / life;
      if (k < 0 || k > 1.6) continue;
      const tx = (hr(s + 1) - 0.5) * W, ty = (hr(s + 2) - 0.5) * (L.d || 40);
      if (k <= 1) {
        const kk = E.in(k);
        const x = tx + sl * Hh * (1 - kk), y = ty - Hh * (1 - kk);
        const ang = Math.atan2(Hh, -sl * Hh);
        g.save(); g.translate(x, y); g.rotate(ang);
        const tl = (L.trail || 30) * (0.6 + hr(s + 3) * 0.6);
        const gr = g.createLinearGradient(-tl, 0, 0, 0);
        gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(1, `rgba(${c1},0.85)`);
        g.fillStyle = gr; g.fillRect(-tl, -1.2 * (L.size || 1), tl, 2.4 * (L.size || 1));
        if (L.kind === 'sword') { g.fillStyle = `rgba(${c1},1)`; g.fillRect(-18, -2, 26, 4); g.fillRect(-20, -6, 3, 12); S.dot(g, 4, 0, 14, c0, 0.7); }
        else drawShot(g, L.kind === 'star' ? 'orb' : L.kind === 'drop' ? 'orb' : L.kind === 'shard' ? 'lance' : L.kind || 'arrow', (L.size || 1) * (L.kind === 'star' || L.kind === 'drop' ? 0.45 : 1), c0, c1, e.ms + i * 50);
        if (L.kind === 'star') S.star(g, 0, 0, 7 * (L.size || 1), 4, c1, 1, e.ms / 80);
        g.restore();
      } else if (L.splash !== false) {
        const hk = (k - 1) / 0.6, fade = 1 - hk;
        g.strokeStyle = `rgba(${c1},${0.8 * fade})`; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(tx, ty, 3 + hk * (L.sr || 12), (3 + hk * (L.sr || 12)) * 0.35, 0, 0, TAU); g.stroke();
        S.dot(g, tx, ty, 8 + hk * 6, c0, fade * 0.5);
      }
    }
  });
  // 柱（縦の光）: L.w、L.h（上へ。既定は画面の上まで）、L.core、L.flick
  P('pillar', (g, u, L, c, e) => {
    const k = E.env(u, L.fi || 0.15, L.fo || 0.35), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const h = L.h || e.y + 40, w = (L.w || 30) * (0.5 + 0.5 * E.out3(E.win(u, 0, 0.2))) * (1 + (L.flick ? Math.sin(e.ms / 26) * 0.08 : 0));
    const top = -h, bot = L.bot || 10;
    let gr = g.createLinearGradient(-w, 0, w, 0);
    gr.addColorStop(0, `rgba(${c0},0)`); gr.addColorStop(0.3, `rgba(${c0},${0.55 * k})`); gr.addColorStop(0.5, `rgba(${c1},${0.95 * k})`); gr.addColorStop(0.7, `rgba(${c0},${0.55 * k})`); gr.addColorStop(1, `rgba(${c0},0)`);
    g.fillStyle = gr; g.fillRect(-w, top, w * 2, h + bot);
    gr = g.createLinearGradient(0, top, 0, top + 60);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    S.dot(g, 0, 0, w * 2.2, c0, 0.7 * k);
    // 立ちのぼる粒
    const n = N(c, L.n || 10);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 13, y = bot - ((hr(s) + u * (1 + hr(s + 1))) % 1) * h, x = (hr(s + 2) - 0.5) * w * 1.4;
      S.dot(g, x, y, 3 + hr(s + 3) * 3, c1, k * 0.8);
    }
  });
  // まっすぐの光線（使い手 → 的）: L.w、L.from（'src'|'sky'）、L.ang（空からの角）
  P('beam', (g, u, L, c, e) => {
    const k = E.env(u, L.fi || 0.12, L.fo || 0.35), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    let sx = e.sx, sy = e.sy - 20;
    if (L.from === 'sky') { const a = L.ang || -1.2; sx = Math.cos(a) * 700 * -1; sy = Math.sin(a) * 700; }
    const grow = E.out3(E.win(u, 0, 0.25));
    const ex = sx + (0 - sx) * grow, ey = sy + (0 - sy) * grow;
    const w = (L.w || 10) * (0.8 + 0.2 * Math.sin(e.ms / 30));
    g.lineCap = 'round';
    S.line(g, sx, sy, ex, ey, w * 3, c0, 0.25 * k);
    S.line(g, sx, sy, ex, ey, w * 1.4, c0, 0.7 * k);
    S.line(g, sx, sy, ex, ey, w * 0.5, c1, 0.95 * k);
    S.dot(g, ex, ey, w * 5, c1, 0.8 * k);
  });
  // 魔法陣: L.r、L.flat（地面 0.34・立てる 1）、L.sides（星の角の数）、L.rings、L.glyphs、L.spin
  P('runes', (g, u, L, c, e) => {
    const k = E.env(u, 0.18, 0.25), grow = E.out3(E.win(u, 0, 0.3));
    const r = (L.r || 40) * (0.4 + 0.6 * grow), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const rot = e.ms / 1000 * (L.spin || 0.8) + (L.rot0 || 0);
    g.save();
    g.scale(1, L.flat || 0.34);
    S.dot(g, 0, 0, r * 1.25, c0, 0.35 * k);
    g.lineWidth = 1.6;
    const rings = L.rings || 2;
    for (let j = 0; j < rings; j++) {
      g.strokeStyle = `rgba(${j ? c0 : c1},${(j ? 0.6 : 0.9) * k})`;
      g.beginPath(); g.arc(0, 0, r * (1 - j * 0.16), 0, TAU); g.stroke();
    }
    // 星形（n 角、1 つ飛ばしで結ぶ）
    const n = L.sides || 5, step = n % 2 ? 2 : 3;
    g.strokeStyle = `rgba(${c1},${0.8 * k})`; g.lineWidth = 1.3;
    g.beginPath();
    for (let i = 0; i <= n; i++) { const a = rot + (i * step % n) / n * TAU - Math.PI / 2, rr = r * 0.8; if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.stroke();
    // 文字（外の輪の上の小さな印）
    const gl = N(c, L.glyphs || 12);
    g.fillStyle = `rgba(${c1},${0.9 * k})`;
    for (let i = 0; i < gl; i++) {
      const a = -rot * 0.6 + i / gl * TAU, rr = r * 0.92;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr, sh = (hr(e.seed + i) * 3) | 0;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      if (sh === 0) g.fillRect(-2.5, -1, 5, 2); else if (sh === 1) { g.fillRect(-0.8, -3, 1.6, 6); g.fillRect(-2.5, -3, 5, 1.4); } else { g.beginPath(); g.moveTo(0, -3); g.lineTo(2.5, 2); g.lineTo(-2.5, 2); g.closePath(); g.fill(); }
      g.restore();
    }
    g.restore();
    if (L.up) {   // 立ちのぼる光
      const gr = g.createLinearGradient(0, 0, 0, -r * 1.6);
      gr.addColorStop(0, `rgba(${c0},${0.3 * k})`); gr.addColorStop(1, `rgba(${c0},0)`);
      g.fillStyle = gr; g.fillRect(-r * 0.7, -r * 1.6, r * 1.4, r * 1.6);
    }
  });
  // 溜め（光の粒が集まる玉）: L.r、L.n
  P('orb', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1), k = E.env(u, 0.1, 0.15);
    const n = N(c, L.n || 14);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 11, ph = (hr(s) + u * 2) % 1, d = (L.r || 14) * 3.2 * (1 - ph), a = hr(s + 1) * TAU + ph * 2;
      S.dot(g, Math.cos(a) * d, Math.sin(a) * d, 2.5 + ph * 2, i % 2 ? c0 : c1, k * ph);
    }
    S.dot(g, 0, 0, (L.r || 14) * (1 + 0.5 * E.out(u)), c0, 0.8 * k);
    S.dot(g, 0, 0, (L.r || 14) * 0.4 * (1 + E.out(u)), c1, k, true);
  });
  // 渦（竜巻・渦潮）: L.r、L.h（高さ。0 で平らな渦）、L.turns、L.n、L.funnel（上ほど広い）
  P('vortex', (g, u, L, c, e) => {
    const n = N(c, L.n || 40), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.15, 0.25), H = L.h || 0, R0 = L.r || 40, fl = L.flat || 0.32;
    const spin = e.ms / 1000 * (L.spin || 7);
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 7;
      const ph = hr(s);
      if (H > 0) {
        const hh = ((ph + u * (0.5 + hr(s + 1))) % 1);
        const rad = R0 * ((L.funnel != null ? L.funnel : 0.25) + (1 - (L.funnel != null ? L.funnel : 0.25)) * hh) * (0.8 + hr(s + 2) * 0.4);
        const a = hr(s + 3) * TAU + spin * (1.2 - hh * 0.5);
        const x = Math.cos(a) * rad, y = -hh * H + Math.sin(a) * rad * fl;
        const x2 = Math.cos(a - 0.35) * rad, y2 = -hh * H + Math.sin(a - 0.35) * rad * fl;
        S.line(g, x, y, x2, y2, 1.5 + hr(s + 4) * 2.5, i % 3 ? c0 : c1, k * (Math.sin(a) > 0 ? 0.9 : 0.4));
      } else {
        // 平らな渦: 外から中へ巻き込む
        const rr = R0 * ((ph + u * 0.8) % 1), a = hr(s + 3) * TAU + spin * (1.5 - rr / R0);
        const pr = R0 - rr;
        const x = Math.cos(a) * pr, y = Math.sin(a) * pr * fl, x2 = Math.cos(a - 0.4) * pr, y2 = Math.sin(a - 0.4) * pr * fl;
        S.line(g, x, y, x2, y2, 1.4 + hr(s + 4) * 2, i % 3 ? c0 : c1, k * 0.85);
      }
    }
    if (!H) S.dot(g, 0, 0, R0 * 0.5, L.core || c0, 0.5 * k);
  });
  // 雷: L.n、L.from（'sky'|'src'|'chain'）、L.w、L.jag、L.flick（ms ごとに形が変わる）
  P('bolt', (g, u, L, c, e) => {
    const n = N(c, L.n || 1), c0 = col(c, L.col, 'thunder'), c1 = col(c, L.col2, 1);
    const fl = Math.floor(e.ms / (L.flick || 55));
    const k = E.env(u, 0.05, 0.3) * (fl % 3 === 2 ? 0.35 : 1);
    g.lineJoin = 'miter'; g.lineCap = 'round';
    // 描いた稲妻（lightning_bolt。fx_seq_img.js）があればそれを、落ちる点から始まりの点へ向けて伸ばして描く
    const IMG = R.BFX.img;
    if (IMG && IMG.on && IMG.ready('lightning_bolt') && k > 0.004) {
      const m = IMG.meta('lightning_bolt'), pal = IMG.palOf(c, L.col != null ? L.col : 'thunder');
      for (let j = 0; j < n; j++) {
        const s = e.seed + j * 97;
        let x0, y0;
        const x1 = (hr(s + 5) - 0.5) * (L.spread || 0), y1 = (hr(s + 6) - 0.5) * (L.spread || 0) * 0.4;
        if (L.from === 'src') { x0 = e.sx; y0 = e.sy - 20; } else { x0 = x1 + (hr(s) - 0.5) * 80; y0 = -(L.h || e.y + 30); }
        const dx = x0 - x1, dy = y0 - y1, len = Math.hypot(dx, dy) + 24;
        g.save();
        g.translate(x1, y1 + 12);
        IMG.drawFrame(g, 'lightning_bolt', IMG.frameAt(m, u, {}), { s: len / (m.h * (m.scale || 0.5) * 0.9), rot: Math.atan2(dx, -dy), mx: (fl + j) % 2, a: E.env(u, 0.02, 0.3), pal: pal[0] === S.PAL.thunder[0] ? null : pal });
        g.restore();
        S.dot(g, x1, y1, 30, c0, 0.8 * k);
      }
      return;
    }
    for (let j = 0; j < n; j++) {
      const s = e.seed + j * 97 + fl * 13;
      let x0, y0, x1 = (hr(s + 5) - 0.5) * (L.spread || 0), y1 = (hr(s + 6) - 0.5) * (L.spread || 0) * 0.4;
      if (L.from === 'src') { x0 = e.sx; y0 = e.sy - 20; } else { x0 = x1 + (hr(s) - 0.5) * 80; y0 = -(L.h || e.y + 30); }
      const pts = [];
      const seg = 9;
      for (let i = 0; i <= seg; i++) {
        const kk = i / seg;
        pts.push([x0 + (x1 - x0) * kk + (i && i < seg ? (hr(s + i * 3) - 0.5) * (L.jag || 30) : 0), y0 + (y1 - y0) * kk]);
      }
      for (const [w, cc, a] of [[(L.w || 3) * 4, c0, 0.25], [(L.w || 3) * 1.6, c0, 0.7], [L.w || 3, c1, 1]]) {
        g.strokeStyle = `rgba(${cc},${a * k})`; g.lineWidth = w;
        g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      }
      // 枝
      const bi = 3 + ((hr(s + 40) * 4) | 0);
      if (pts[bi]) { g.strokeStyle = `rgba(${c1},${0.7 * k})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(pts[bi][0], pts[bi][1]); g.lineTo(pts[bi][0] + (hr(s + 41) - 0.5) * 60, pts[bi][1] + 30 + hr(s + 42) * 30); g.stroke(); }
      S.dot(g, x1, y1, 26, c0, 0.7 * k);
    }
  });
  // 炎（立ちのぼる舌）: L.n、L.w（幅）、L.h（高さ）、L.size
  P('flames', (g, u, L, c, e) => {
    const n = N(c, L.n || 14), c0 = col(c, L.col, 'fire'), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const k = E.env(u, 0.15, 0.3), H = L.h || 60, W = L.w || 60;
    S.dot(g, 0, -H * 0.2, W * 0.9, c0, 0.4 * k);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 13;
      const ph = (hr(s) + u * (1.2 + hr(s + 1))) % 1;
      const x = (hr(s + 2) - 0.5) * W * (1 - ph * 0.5), y = -ph * H;
      const sz = (L.size || 10) * (0.6 + hr(s + 3) * 0.7) * (1 - ph * 0.7);
      const cc = ph < 0.3 ? c1 : ph < 0.65 ? c0 : c2;
      g.fillStyle = `rgba(${cc},${0.85 * k * (1 - ph * 0.6)})`;
      g.beginPath(); g.moveTo(x - sz * 0.5, y); g.quadraticCurveTo(x + Math.sin(e.ms / 90 + i) * sz * 0.3, y - sz * 2.2, x + sz * 0.5, y); g.quadraticCurveTo(x, y + sz * 0.5, x - sz * 0.5, y); g.fill();
    }
  });
  // 水しぶき（しずくの弧と輪）: L.n、L.v、L.h
  P('splash', (g, u, L, c, e) => {
    const n = N(c, L.n || 14), c0 = col(c, L.col, 'water'), c1 = col(c, L.col2, 1);
    const fade = 1 - E.win(u, 0.55, 1);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 17;
      const a = -Math.PI / 2 + (hr(s) - 0.5) * (L.spread || 2.4), v = (L.v || 50) * (0.4 + hr(s + 1) * 0.7);
      const x = Math.cos(a) * v * u, y = Math.sin(a) * v * u * (L.h || 1.3) + 150 * u * u;
      S.dot(g, x, y, 3 + hr(s + 2) * 2.5, i % 3 ? c0 : c1, fade, true);
    }
    for (let j = 0; j < 2; j++) {
      const uj = E.win(u, j * 0.2, 1), r = 6 + uj * (L.r || 40);
      g.strokeStyle = `rgba(${c1},${0.7 * (1 - uj)})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, L.gy || 20, r, r * 0.3, 0, 0, TAU); g.stroke();
    }
  });
  // 刃風（飛ぶ三日月）: 使い手の側から横切る。L.n、L.len、L.spread（縦）、L.dist、L.curve
  P('blades', (g, u, L, c, e) => {
    const n = N(c, L.n || 5), c0 = col(c, L.col, 'wind'), c1 = col(c, L.col2, 1);
    const gap = L.gap != null ? L.gap : 0.5 / n, span = Math.max(0.25, 1 - gap * (n - 1));
    const dist = L.dist || 160;
    for (let j = 0; j < n; j++) {
      const uj = E.win(u, j * gap, j * gap + span);
      if (uj <= 0 || uj >= 1) continue;
      const s = e.seed + j * 31;
      const x = dist * (1 - 2 * E.inOut(uj)), y = (hr(s) - 0.5) * (L.spread || 60) + Math.sin(uj * 3) * (L.curve || 0);
      const len = (L.len || 26) * (0.8 + hr(s + 1) * 0.4), fade = E.env(uj, 0.1, 0.3);
      g.save(); g.translate(x, y); g.rotate((hr(s + 2) - 0.5) * 0.6);
      g.fillStyle = `rgba(${c0},${0.7 * fade})`;
      g.beginPath(); g.moveTo(0, -len); g.quadraticCurveTo(-len * 0.6, 0, 0, len); g.quadraticCurveTo(-len * 0.25, 0, 0, -len); g.fill();
      g.strokeStyle = `rgba(${c1},${0.95 * fade})`; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, -len); g.quadraticCurveTo(-len * 0.6, 0, 0, len); g.stroke();
      for (let t = 1; t < 4; t++) S.line(g, t * 10, -len * 0.5 + t * 6, t * 10 + 18, -len * 0.5 + t * 6, 1, c1, 0.4 * fade);
      g.restore();
    }
  });
  // 地面から突き出る棘（岩・氷・光・影）: L.n、L.w（範囲）、L.h、L.bw（根の幅）、L.kind
  P('spikes', (g, u, L, c, e) => {
    const n = N(c, L.n || 7), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const W = L.w || 70, dark = L.kind === 'dark', solid = L.kind === 'rock';
    if (solid || dark) g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 29;
      const d = hr(s) * 0.35;
      const up = E.out3(E.win(u, d, d + 0.25)) * (1 - E.in(E.win(u, 0.7, 1)));
      if (up <= 0.01) continue;
      const x = (i / Math.max(1, n - 1) - 0.5) * W + (hr(s + 1) - 0.5) * W * 0.2, y = (hr(s + 2) - 0.5) * (L.d || 20);
      const h = (L.h || 44) * (0.6 + hr(s + 3) * 0.6) * up, bw = (L.bw || 9) * (0.7 + hr(s + 4) * 0.6);
      const lean = (hr(s + 5) - 0.5) * 0.5;
      g.fillStyle = dark ? `rgba(20,8,36,0.92)` : `rgba(${solid ? c2 : c0},${solid ? 1 : 0.8})`;
      g.beginPath(); g.moveTo(x - bw, y); g.lineTo(x + lean * h, y - h); g.lineTo(x + bw, y); g.closePath(); g.fill();
      g.fillStyle = dark ? `rgba(${c0},0.8)` : `rgba(${c1},${solid ? 0.8 : 0.9})`;
      g.beginPath(); g.moveTo(x - bw * 0.1, y); g.lineTo(x + lean * h, y - h); g.lineTo(x + bw * 0.6, y); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'lighter';
    S.dot(g, 0, 0, W * 0.6, c0, 0.3 * (1 - u));
  });
  // 放射する光線: L.n、L.len、L.w（角の幅）、L.spin、L.r0
  P('rays', (g, u, L, c, e) => {
    const n = N(c, L.n || 12), c0 = col(c, L.col, 0), k = E.env(u, L.fi || 0.2, L.fo || 0.4);
    const len = (L.len || 90) * (0.6 + 0.4 * E.out(u)), rot = (L.rot || 0) + e.ms / 1000 * (L.spin || 0.3);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 3, a = rot + i / n * TAU + (hr(s) - 0.5) * 0.2, w = (L.w || 0.06) * (0.6 + hr(s + 1) * 0.8), l = len * (0.6 + hr(s + 2) * 0.6);
      const gr = g.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l);
      const rc = L.hues ? HUES[i % HUES.length] : c0;
      gr.addColorStop(0, `rgba(${rc},${0.7 * k})`); gr.addColorStop(1, `rgba(${rc},0)`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(Math.cos(a) * (L.r0 || 0), Math.sin(a) * (L.r0 || 0) * (L.flat || 1)); g.lineTo(Math.cos(a - w) * l, Math.sin(a - w) * l * (L.flat || 1)); g.lineTo(Math.cos(a + w) * l, Math.sin(a + w) * l * (L.flat || 1)); g.closePath(); g.fill();
    }
  });
  // 光の輪（頭の上）と十字: L.r、L.cross
  P('halo', (g, u, L, c, e) => {
    const k = E.env(u, 0.2, 0.35), c0 = col(c, L.col, 'light'), c1 = col(c, L.col2, 1);
    const r = (L.r || 20) * (0.7 + 0.3 * E.out(u));
    g.save(); g.translate(0, L.hy || -30); g.scale(1, 0.35);
    g.strokeStyle = `rgba(${c0},${0.5 * k})`; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.strokeStyle = `rgba(${c1},${0.95 * k})`; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.restore();
    if (L.cross) {
      const cl = (L.cross || 40) * E.out3(E.win(u, 0.1, 0.5));
      S.glowLine(g, 0, -cl, 0, cl * 0.8, 2.5, c0, c1, k);
      S.glowLine(g, -cl * 0.55, -cl * 0.3, cl * 0.55, -cl * 0.3, 2.5, c0, c1, k);
    }
    S.dot(g, 0, 0, r * 1.8, c0, 0.35 * k);
  });
  // 闇の触手（地面から曲がって伸びる）: L.n、L.len、L.w、L.curl
  P('tendrils', (g, u, L, c, e) => {
    const n = N(c, L.n || 6), c0 = col(c, L.col, 'dark'), c1 = col(c, L.col2, 1);
    const grow = E.out3(E.win(u, 0, 0.45)), fade = 1 - E.in(E.win(u, 0.65, 1));
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 43;
      const bx = (hr(s) - 0.5) * (L.w || 90), by = (hr(s + 1) - 0.5) * 16 + (L.gy || 20);
      const len = (L.len || 70) * (0.6 + hr(s + 2) * 0.6) * grow;
      const side = bx < 0 ? 1 : -1, curl = (L.curl || 1.2) * (0.6 + hr(s + 3) * 0.8);
      const wob = Math.sin(e.ms / 140 + i) * 6;
      const tx = bx + side * len * 0.45 + wob, ty = by - len;
      const cx1 = bx - side * len * 0.3 * curl, cy1 = by - len * 0.5;
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(16,6,28,${0.9 * fade})`; g.lineWidth = (L.tw || 7) * (1 - 0.3 * grow); g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx1, cy1, tx, ty); g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(${c0},${0.7 * fade})`; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx1, cy1, tx, ty); g.stroke();
      S.dot(g, tx, ty, 6, c1, 0.8 * fade);
    }
  });
  // 虚ろ（黒い玉に吸い込まれる）: L.r、L.n
  P('void', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'dark'), c1 = col(c, L.col2, 1), k = E.env(u, 0.15, 0.3);
    const r = (L.r || 26) * (0.5 + 0.5 * E.out3(E.win(u, 0, 0.3))) * (1 - 0.6 * E.in(E.win(u, 0.75, 1)));
    const n = N(c, L.n || 26);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 19, ph = (hr(s) + u * 1.8) % 1, d = r * (1 + 3 * (1 - ph)), a = hr(s + 1) * TAU + ph * 3;
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.8, x2 = Math.cos(a - 0.3) * (d + 10), y2 = Math.sin(a - 0.3) * (d + 10) * 0.8;
      S.line(g, x, y, x2, y2, 1.6, i % 2 ? c0 : c1, k * ph);
    }
    S.dot(g, 0, 0, r * 2.2, c0, 0.6 * k);
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, `rgba(0,0,0,${0.95 * k})`); gr.addColorStop(0.75, `rgba(8,0,18,${0.9 * k})`); gr.addColorStop(1, 'rgba(8,0,18,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(${c1},${0.8 * k})`; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r * 0.95, 0, TAU); g.stroke();
  });
  // 舞う物（花びら・葉・羽・雪・火の粉・月）: L.n、L.w、L.h、L.kind、L.swirl
  P('petals', (g, u, L, c, e) => {
    const n = N(c, L.n || 24), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.15, 0.3), W = L.w || 160, H = L.h || 120;
    const kind = L.kind || 'petal';
    if (kind === 'petal' || kind === 'leaf' || kind === 'sand') g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 23;
      const ph = (hr(s) + u * (L.sp || 0.8)) % 1;
      let x, y;
      if (L.swirl) { const a = hr(s + 1) * TAU + e.ms / 1000 * L.swirl, rr = W * 0.5 * (0.3 + hr(s + 2) * 0.7); x = Math.cos(a) * rr; y = Math.sin(a) * rr * 0.4 - ph * H * 0.5; }
      else { x = (hr(s + 1) - 0.5) * W + Math.sin(e.ms / 300 + i) * 10 - (L.drift || 0) * ph; y = (L.rise ? -ph : ph - 0.5) * H + (hr(s + 2) - 0.5) * 20; }
      const rot = e.ms / 200 * (hr(s + 3) - 0.5) + i, sz = (L.size || 4) * (0.6 + hr(s + 4) * 0.8);
      const a = k * E.env(ph, 0.15, 0.2);
      g.save(); g.translate(x, y); g.rotate(rot);
      if (kind === 'petal') { g.fillStyle = `rgba(${i % 3 ? c0 : c1},${0.9 * a})`; g.beginPath(); g.ellipse(0, 0, sz, sz * 0.55, 0, 0, TAU); g.fill(); }
      else if (kind === 'leaf') { g.fillStyle = `rgba(${i % 3 ? c0 : c1},${0.9 * a})`; g.beginPath(); g.moveTo(-sz, 0); g.quadraticCurveTo(0, -sz * 0.7, sz, 0); g.quadraticCurveTo(0, sz * 0.7, -sz, 0); g.fill(); }
      else if (kind === 'feather') { g.fillStyle = `rgba(${c1},${0.85 * a})`; g.beginPath(); g.ellipse(0, 0, sz * 1.6, sz * 0.45, 0, 0, TAU); g.fill(); S.dot(g, 0, 0, sz * 2, c0, a * 0.5); }
      else if (kind === 'moon') { g.fillStyle = `rgba(${c1},${0.9 * a})`; g.beginPath(); g.arc(0, 0, sz, 0.6, 5.7); g.arc(sz * 0.5, 0, sz * 0.8, 5.2, 1.1, true); g.fill(); }
      else if (kind === 'sand') { g.fillStyle = `rgba(${c0},${0.8 * a})`; g.fillRect(-sz * 0.4, -sz * 0.4, sz * 0.8, sz * 0.8); }
      else if (kind === 'coin') { g.fillStyle = `rgba(${c1},${a})`; g.beginPath(); g.ellipse(0, 0, sz * 0.9 * Math.abs(Math.cos(rot)), sz * 0.9, 0, 0, TAU); g.fill(); S.dot(g, 0, 0, sz * 2, c0, a * 0.5); }
      else if (kind === 'note') { g.fillStyle = `rgba(${c1},${a})`; g.fillRect(0, -sz * 1.6, 1.2, sz * 1.6); g.beginPath(); g.ellipse(-sz * 0.3, 0, sz * 0.5, sz * 0.35, -0.4, 0, TAU); g.fill(); }
      else { S.dot(g, 0, 0, sz * 1.8, i % 3 ? c0 : c1, a); S.dot(g, 0, 0, sz * 0.5, c1, a, true); }
      g.restore();
    }
  });
  // 立ちのぼる十字の光（回復・強化）: L.n、L.w、L.h
  P('motes', (g, u, L, c, e) => {
    const n = N(c, L.n || 12), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1), k = E.env(u, 0.15, 0.3);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 13;
      const ph = (hr(s) + u * (L.sp || 1.2)) % 1;
      const x = (hr(s + 1) - 0.5) * (L.w || 50), y = (L.gy || 30) - ph * (L.h || 90), sz = 1.5 + (i % 3);
      const a = k * E.bell(ph);
      g.fillStyle = `rgba(${i % 2 ? c1 : c0},${a})`;
      g.fillRect(x - sz / 2, y - sz * 1.6, sz, sz * 3.2); g.fillRect(x - sz * 1.6, y - sz / 2, sz * 3.2, sz);
      S.dot(g, x, y, sz * 3, c0, a * 0.4);
    }
  });
  // 結晶のかけら（集まって・砕ける）: L.n、L.r、L.size
  P('shards', (g, u, L, c, e) => {
    const n = N(c, L.n || 10), c0 = col(c, L.col, 'ice'), c1 = col(c, L.col2, 1);
    const inK = E.out3(E.win(u, 0, 0.45)), outK = E.win(u, L.hold || 0.55, 1);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 37, a = hr(s) * TAU;
      const d = (L.r || 34) * (L.out ? 0.2 : (1.8 - inK * 0.8)) + outK * (L.r || 34) * 2.4 * (0.6 + hr(s + 1));
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.8 + outK * outK * 60;
      const sz = (L.size || 9) * (0.6 + hr(s + 2) * 0.8), fade = (L.out ? 1 : inK) * (1 - outK);
      g.save(); g.translate(x, y); g.rotate(a + e.ms / 300 * (hr(s + 3) - 0.5));
      g.fillStyle = `rgba(${c0},${0.6 * fade})`;
      g.beginPath(); g.moveTo(0, -sz); g.lineTo(sz * 0.4, 0); g.lineTo(0, sz); g.lineTo(-sz * 0.4, 0); g.closePath(); g.fill();
      g.strokeStyle = `rgba(${c1},${0.95 * fade})`; g.lineWidth = 1; g.stroke();
      g.restore();
    }
  });
  // 粒の流れ（吸う・分ける）: 的と使い手を結ぶ。L.n、L.rev（使い手 → 的）、L.curve
  P('stream', (g, u, L, c, e) => {
    const n = N(c, L.n || 24), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1), k = E.env(u, 0.1, 0.25);
    const sx = e.sx, sy = e.sy - 20;
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 11, ph = (hr(s) + u * 1.6) % 1;
      const p = L.rev ? ph : 1 - ph;
      const x = sx * (1 - p), y = sy * (1 - p) - Math.sin(p * Math.PI) * (L.curve || 40) * (hr(s + 1) - 0.3) * 2;
      S.dot(g, x, y, 3 + hr(s + 2) * 3, i % 2 ? c0 : c1, k * E.bell(ph));
    }
  });
  // 鎖（的を縛る輪）: L.n、L.r
  P('chains', (g, u, L, c, e) => {
    const n = L.n || 2, c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const k = E.env(u, 0.15, 0.3), tight = E.out3(E.win(u, 0, 0.4));
    for (let j = 0; j < n; j++) {
      const r = (L.r || 34) * (1.6 - tight * 0.6), y = (j - (n - 1) / 2) * 16, rot = e.ms / 700 * (j % 2 ? 1 : -1);
      const links = 14;
      for (let i = 0; i < links; i++) {
        const a = rot + i / links * TAU, x = Math.cos(a) * r, yy = y + Math.sin(a) * r * 0.3;
        g.save(); g.translate(x, yy); g.rotate(a + Math.PI / 2 + (i % 2) * 0.5);
        g.strokeStyle = `rgba(${Math.sin(a) > 0 ? c1 : c0},${(Math.sin(a) > 0 ? 0.95 : 0.45) * k})`; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(0, 0, 4, 2.2, 0, 0, TAU); g.stroke();
        g.restore();
      }
    }
  });
  // 泡（毒・湯・沼）: L.n、L.w、L.h
  P('bubbles', (g, u, L, c, e) => {
    const n = N(c, L.n || 14), c0 = col(c, L.col, 'poison'), c1 = col(c, L.col2, 1), k = E.env(u, 0.1, 0.3);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 17, ph = (hr(s) + u * 1.2) % 1;
      const x = (hr(s + 1) - 0.5) * (L.w || 50) + Math.sin(ph * 8 + i) * 4, y = (L.gy || 20) - ph * (L.h || 60), r = (L.size || 3) * (0.6 + hr(s + 2)) * (1 + ph * 0.6);
      g.strokeStyle = `rgba(${c1},${0.8 * k * (1 - ph)})`; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      S.dot(g, x, y, r * 1.6, c0, 0.4 * k * (1 - ph));
      if (ph > 0.92) S.star(g, x, y, r * 1.5, 4, c1, k, 0);
    }
  });
  // 煙・もや（ふつうの重ね）: L.n、L.r、L.col、L.a、L.rise
  P('smoke', (g, u, L, c, e) => {
    const n = N(c, L.n || 10), c0 = col(c, L.col, '150,150,170');
    const k = E.env(u, 0.15, 0.45) * (L.a || 0.5);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 19, a = hr(s) * TAU, d = (L.w || 20) * hr(s + 1) + u * (L.v || 30) * (0.5 + hr(s + 2));
      const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.5 - u * (L.rise || 20), r = (L.r || 14) * (0.7 + hr(s + 3) * 0.6) * (0.7 + u * 0.6);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${c0},${k})`); gr.addColorStop(1, `rgba(${c0},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  // 画面を割る大きな一太刀（上の段）: L.ang、L.len、L.w
  P('bigslash', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const ang = L.ang != null ? L.ang : -0.45, len = L.len || 900;
    const head = E.out3(E.win(u, 0, L.draw || 0.18)), fade = 1 - E.in(E.win(u, 0.35, 1));
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const p0 = -len / 2, p1 = -len / 2 + len * head;
    const w = (L.w || 6) * (1 + 1.5 * E.bell(E.win(u, 0.1, 0.5)));
    S.glowLine(g, ca * p0 * -1, sa * p0 * -1, ca * -p1, sa * -p1, w, c0, c1, fade);
    if (head < 1) S.dot(g, ca * -p1, sa * -p1, 30, c1, 0.9);
    // 割れ目の光のにじみ
    if (u > 0.15) { g.save(); g.rotate(ang); S.dot(g, 0, 0, len * 0.18, c0, 0.25 * fade); g.restore(); }
  });
  // 残像の筋（踏み込み）: 使い手から的への横の筋。L.n、L.w
  P('dash', (g, u, L, c, e) => {
    const n = N(c, L.n || 6), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1), k = E.env(u, 0.1, 0.5);
    for (let i = 0; i < n; i++) {
      const s = e.seed + i * 13, y = (hr(s) - 0.5) * (L.spread || 40), x0 = e.sx * (0.2 + hr(s + 1) * 0.5), x1 = x0 - (L.len || 80) * (0.6 + hr(s + 2) * 0.6) * E.out(u);
      S.line(g, x0, y, x1, y, 1 + hr(s + 3) * 2, i % 2 ? c0 : c1, 0.6 * k);
    }
  });
  // 網（光の線で的どうし・周りの点を結ぶ）: L.n（点）、L.w、L.h
  P('net', (g, u, L, c, e) => {
    const n = N(c, L.n || 10), c0 = col(c, L.col, 0), c1 = col(c, L.col2, 1);
    const grow = E.out3(E.win(u, 0, 0.4)), fade = 1 - E.in(E.win(u, 0.7, 1));
    const pts = [];
    for (let i = 0; i < n; i++) { const s = e.seed + i * 7; pts.push([(hr(s) - 0.5) * (L.w || 200), (hr(s + 1) - 0.5) * (L.h || 90)]); }
    for (const t of c.tgts) pts.push([(t.x - e.x) * (c.dir < 0 ? 1 : -1), t.y - e.y]);
    g.lineWidth = 1.2;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
      if (dx * dx + dy * dy > (L.link || 110) * (L.link || 110)) continue;
      const m = grow;
      S.line(g, pts[i][0], pts[i][1], pts[i][0] - dx * m, pts[i][1] - dy * m, 1.2, (i + j) % 2 ? c0 : c1, 0.8 * fade);
    }
    for (const p of pts) S.star(g, p[0], p[1], 5 * fade * grow + 0.5, 4, c1, fade, e.ms / 300);
  });
  // 波（地面を横切る水・炎の波）: L.h（高さ）、L.w（幅）、L.col
  P('wave', (g, u, L, c, e) => {
    const c0 = col(c, L.col, 'water'), c1 = col(c, L.col2, 1), c2 = col(c, L.col3, 2);
    const W = L.w || 420, H = (L.h || 90) * E.bell(E.win(u, 0, 1)) + 10;
    const front = W * 0.5 - W * 1.3 * E.inOut(u);   // 使い手の側（+x）から -x へ
    const k = E.env(u, 0.1, 0.25);
    // 波の形（奥の層・手前の層の 2 枚。手前は少し遅れて低い）
    const shape = (sh, lag, amp) => {
      const f = front + lag;
      g.beginPath();
      g.moveTo(f + W * 0.8, 24);
      for (let i = 0; i <= 24; i++) {
        const x = f + W * 0.8 - i / 24 * W * 0.8;
        const hh = H * amp * Math.pow(i / 24, 1.6) * (1 + Math.sin(e.ms / 90 + i * 0.9 + sh) * 0.06);
        g.lineTo(x, 24 - hh);
      }
      g.quadraticCurveTo(f - 30, 24 - H * amp * 1.05, f - 36 * amp, 24 - H * amp * 0.7);
      g.quadraticCurveTo(f - 14, 24 - H * amp * 0.78, f, 24);
      g.closePath();
    };
    g.globalCompositeOperation = 'source-over';
    for (const [lag, amp, al] of [[-40, 1.12, 0.55], [0, 1, 0.8], [60, 0.62, 0.9]]) {
      const gr = g.createLinearGradient(0, -H * amp, 0, 24);
      gr.addColorStop(0, `rgba(${c1},${al * k})`); gr.addColorStop(0.25, `rgba(${c0},${al * 0.85 * k})`); gr.addColorStop(1, `rgba(${c2},${al * 0.5 * k})`);
      shape(lag * 0.1, lag, amp);
      g.fillStyle = gr; g.fill();
      g.strokeStyle = `rgba(255,255,255,${0.7 * al * k})`; g.lineWidth = 2.5; g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    // 水の筋（波の中を流れる光）
    for (let i = 0; i < N(c, 16); i++) {
      const s2 = e.seed + i * 29, y = 24 - H * (0.1 + hr(s2) * 0.7), x = front + 20 + hr(s2 + 1) * W * 0.6;
      S.line(g, x, y, x + 40 + hr(s2 + 2) * 60, y + 6, 1.5, c1, 0.45 * k);
    }
    // 泡
    for (let i = 0; i < N(c, 26); i++) {
      const s = e.seed + i * 11, t = hr(s);
      const x = front - 30 + t * W * 0.3, y = 24 - H * (1 - t * 0.8) + (hr(s + 1) - 0.5) * 16;
      S.dot(g, x, y, 3 + hr(s + 2) * 4, c1, 0.8 * k);
    }
  });
  // 横に流れる帯（夜明けの風・せせらぎ）: L.n、L.w、L.h
  P('ribbons', (g, u, L, c, e) => {
    const n = L.n || 4, k = E.env(u, 0.2, 0.3), W = L.w || 400, H = L.h || 80;
    for (let j = 0; j < n; j++) {
      const cc = col(c, j % 3), y0 = (j / Math.max(1, n - 1) - 0.5) * H;
      g.strokeStyle = `rgba(${cc},${0.45 * k})`; g.lineWidth = 6 + (j % 2) * 5;
      g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const x = -W / 2 + i / 30 * W * E.out3(Math.min(1, u * 1.6)), y = y0 + Math.sin(i * 0.45 + e.ms / 240 + j * 1.7) * 14;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
      g.strokeStyle = `rgba(${col(c, 1)},${0.8 * k})`; g.lineWidth = 1.2; g.stroke();
    }
  });
})(window.RPG);
