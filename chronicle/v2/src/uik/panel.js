// UIK: 窓（MODERN_UI §3.3）。panel（紺のすりガラス）・paper（会話の羊皮紙）・fadePanel・card・chip・tag・snapshot と細かな飾り
//   panel(g, rect, o)   o = {r, a, dense, frost: canvas|true, shadow, line, tone:[r,g,b]}   rect は掛けた後の論理 px
//   snapshot()          メニューを開いたとき 1 回だけ: 今の画面を 1/4 に縮めて R.Hd.blur でぼかした canvas（無ければ null）。
//                       以後 panel の o.frost === true はこの写しを窓の中に敷く（毎フレームぼかさない、§2.10）
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});
  let snap = null; // {canvas, w, h}（論理の大きさ）

  function tone(o) { return (o && o.tone) || UIK.T.color.glass; }

  // 窓の落ち影（2026-09-29 性能）: 画面いっぱいの窓の影のぼかしを毎フレーム描いていた（店・メニューで 1 フレームの 3 割）。
  // 同じ角の丸み・色・ぼかし・画素の端数の影を小さな 1 枚（角の周りだけ）に焼き、9 つに切って置く。辺と中は 1 画素の列を伸ばすだけ
  // （ぼかしの届く幅より内側は辺に沿って同じ値なので、直に描いた影と同じ画素）。窓の端が実画素の途中にあっても、左上と右下の端数を
  // 焼いた 1 枚に合わせるので置く位置は整数のまま。変換が拡大と平行移動だけ・影のぼかしとずれが整数のときだけ（ほかは今までどおり直に）
  const PSH = { color: 'rgba(2,3,8,0.45)', cache: new Map() };
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-6;
  const frac = (v) => { const f = v - Math.floor(v); return f > 1 - 1e-6 ? 0 : f; };
  function shadowSprite(Rd, blur, fill, sc, fx, fy, fr, fb) {
    const key = [Rd.toFixed(4), blur, fill, sc, fx.toFixed(4), fy.toFixed(4), fr.toFixed(4), fb.toFixed(4)].join('|');
    let e = PSH.cache.get(key);
    if (e) { PSH.cache.delete(key); PSH.cache.set(key, e); return e; }
    const K = Math.ceil(Rd + 1.5 * blur) + 2, P = Math.ceil(1.5 * blur) + 2, n = 2 * K + 1;
    const ws = n + fr - fx, hs = n + fb - fy;   // 焼く形の大きさ（右・下の端の端数を窓と同じにする）
    const cw = 2 * P + n + (fr > 0 ? 1 : 0), ch = 2 * P + n + (fb > 0 ? 1 : 0);
    const c = R.Gfx.canvas2d(cw, ch);
    if (!c) return null;
    const x = c.getContext('2d');
    // 形は画面の外に置き、影だけを (P + fx, P + fy) に落とす（影のずれは変換に掛からない実画素）
    const BIG = 16384;
    x.shadowColor = PSH.color; x.shadowBlur = blur; x.shadowOffsetX = BIG; x.shadowOffsetY = 0;
    x.setTransform(sc, 0, 0, sc, P + fx - BIG, P + fy);
    UIK.rr(x, 0, 0, ws / sc, hs / sc, Rd / sc);
    x.fillStyle = fill; x.fill();
    e = { c, K, P, n };
    PSH.cache.set(key, e);
    while (PSH.cache.size > 24) PSH.cache.delete(PSH.cache.keys().next().value);
    return e;
  }
  /** 焼いた影を置けたら true（置けない形・変換なら false で、呼ぶ側が直に描く） */
  function panelShadow(g, x, y, w, h, r, fill) {
    if (!g.getTransform || !R.Gfx.canvas2d || UIK._direct) return false;   // UIK._direct: 比べる試験用（焼いた物を使わず直に描く）
    const m = g.getTransform(), S = R.SCALE || 2, blur = 20 * S / 2, offY = 6 * S / 2;
    if (m.b || m.c || m.a !== m.d || !(m.a > 0) || g.globalCompositeOperation !== 'source-over' || !isInt(offY) || !isInt(blur)) return false;   // ぼかしが端数（2560×1440）は直に（端数のぼかしは形の大きさで僅かに違う）
    const sc = m.a, X = sc * x + m.e, Y = sc * y + m.f, W = sc * w, H = sc * h;
    if (!(r >= 0) || !(r <= w / 2 && r <= h / 2)) return false;   // 丸みが縮められる小さな窓は直に
    const Rd = r * sc, K = Math.ceil(Rd + 1.5 * blur) + 2, n = 2 * K + 1;
    const x0 = Math.floor(X), y0 = Math.floor(Y);
    const D = Math.floor(X + W) - x0 - n, E = Math.floor(Y + H) - y0 - n;   // 伸ばす長さ − 1
    if (D < 0 || E < 0) return false;
    const sp = shadowSprite(Rd, blur, fill, sc, frac(X), frac(Y), frac(X + W), frac(Y + H));
    if (!sp) return false;
    const { c, P } = sp, a = K + P;
    const dx = x0 - P, dy = y0 + offY - P;
    const cw = c.width - (a + 1), ch = c.height - (a + 1);   // 右・下の切れの幅
    const sx = [0, a, a + 1], sw = [a, 1, cw], tx = [dx, dx + a, dx + a + 1 + D], tw = [a, D + 1, cw];
    const sy = [0, a, a + 1], sh = [a, 1, ch], ty = [dy, dy + a, dy + a + 1 + E], th = [a, E + 1, ch];
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.drawImage(c, sx[i], sy[j], sw[i], sh[j], tx[i], ty[j], tw[i], th[j]);
    g.restore();
    return true;
  }
  UIK._panelShadow = panelShadow;

  /** 紺のすりガラスの窓 */
  UIK.panel = function (g, rect, o) {
    o = o || {};
    const T = UIK.T, x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    const r = o.r != null ? o.r : T.radius;
    const dense = o.dense || UIK.setting('panel', 'normal') === 'dense';
    const a = o.a != null ? o.a : dense ? 0.92 : 0.74;
    const [r0, g0, b0] = tone(o);
    g.save();
    if (o.shadow !== false) {
      const fill = `rgba(${r0},${g0},${b0},${Math.min(1, a)})`;
      if (!panelShadow(g, x, y, w, h, r, fill)) {
        g.save();
        g.shadowColor = PSH.color; g.shadowBlur = 20 * (R.SCALE || 2) / 2; g.shadowOffsetY = 6 * (R.SCALE || 2) / 2;
        UIK.rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
        g.restore();
      } else { UIK.rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); }
    }
    // すりガラス（写しがあるときだけ）
    const fr = o.frost === true ? snap : o.frost && o.frost.canvas ? o.frost : o.frost ? { canvas: o.frost, w: R.W, h: R.H } : null;
    if (fr && fr.canvas) {
      g.save(); UIK.rr(g, x, y, w, h, r); g.clip();
      g.imageSmoothingEnabled = true;
      g.drawImage(fr.canvas, 0, 0, fr.w || R.W, fr.h || R.H);
      g.restore();
    }
    UIK.rr(g, x, y, w, h, r);
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, `rgba(${r0 + 8},${g0 + 8},${b0 + 12},${a})`);
    gr.addColorStop(1, `rgba(${r0},${g0},${b0},${Math.min(1, a + 0.08)})`);
    g.fillStyle = gr; g.fill();
    if (o.line !== false) {
      g.lineWidth = 1; g.strokeStyle = o.edge || T.color.edge; g.stroke();
      g.clip();
      const hg = g.createLinearGradient(0, y, 0, y + 18);
      hg.addColorStop(0, 'rgba(255,245,220,0.07)'); hg.addColorStop(1, 'rgba(255,245,220,0)');
      g.fillStyle = hg; g.fillRect(x, y, w, 18);
    }
    g.restore();
  };

  /** 会話の羊皮紙の札（角を切った 8 角、淡い紙、濃い茶の縁。STYLE_REFERENCE §7.2）
   *  紙の繊維と焼けは大きさごとに 1 回だけ実画素で焼いて使い回す（毎フレーム作らない、§2.10） */
  const paperCache = new Map(); // key → {c, pad}
  function paperPath(g, x, y, w, h, c) {
    g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c);
    g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  }
  function bakePaper(w, h, cut, S) {
    const T = UIK.T, pad = 28;
    const cv = R.Gfx.canvas2d(Math.ceil((w + pad * 2) * S), Math.ceil((h + pad * 2) * S));
    if (!cv) return null;
    const g = cv.getContext('2d');
    g.setTransform(S, 0, 0, S, 0, 0);
    g.translate(pad, pad);
    g.save();
    g.shadowColor = 'rgba(2,3,8,0.5)'; g.shadowBlur = 20 * S / 2; g.shadowOffsetY = 5 * S / 2;
    paperPath(g, 0, 0, w, h, cut);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, T.color.paper[0]); gr.addColorStop(1, T.color.paper[1]);
    g.fillStyle = gr; g.fill();
    g.restore();
    g.save();
    paperPath(g, 0, 0, w, h, cut); g.clip();
    const n = Math.min(2400, (w * h / 60) | 0);
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(120,90,50,${0.03 + ((i * 7919) % 13) / 420})`;
      g.fillRect((i * 37.7) % w, (i * 91.3) % h, 1, 1);
    }
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    v.addColorStop(0, 'rgba(120,80,30,0)'); v.addColorStop(1, 'rgba(120,80,30,0.16)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.restore();
    paperPath(g, 0.5 / S * 2 / 2, 0.5 / S, w - 1 / S, h - 1 / S, cut);
    g.strokeStyle = T.color.paperEdge; g.lineWidth = 1; g.stroke();
    return { c: cv, pad };
  }
  UIK.paper = function (g, rect, o) {
    o = o || {};
    const x = rect.x, y = rect.y, w = Math.round(rect.w), h = Math.round(rect.h);
    const cut = o.cut != null ? o.cut : Math.min(9 * (R.uiScale || 1), w / 6, h / 6);
    const S = R.SCALE || 2;
    const key = w + 'x' + h + '@' + S + ':' + cut.toFixed(2);
    let e = paperCache.get(key);
    if (!e) {
      e = bakePaper(w, h, cut, S);
      if (!e) return;
      paperCache.set(key, e);
      if (paperCache.size > 8) paperCache.delete(paperCache.keys().next().value);
      let bytes = 0;
      for (const v of paperCache.values()) bytes += v.c.width * v.c.height * 4;
      try { if (R.Hd && R.Hd.track) R.Hd.track('snap', 'uik_paper', bytes); } catch (err) { /* */ }
    } else if (paperCache.size > 1) { paperCache.delete(key); paperCache.set(key, e); }
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(e.c, Math.round((x - e.pad) * S) / S, Math.round((y - e.pad) * S) / S, e.c.width / S, e.c.height / S);
    g.restore();
  };

  /** 画面の端から中へ薄くなる帯（枠なし）。o.side = 'l'|'r'|'t'|'b'（'left' 'right' 'top' 'bottom' も可）、o.a */
  UIK.fadePanel = function (g, rect, o) {
    o = o || {};
    const side = String(o.side || 'r').charAt(0);
    const a = o.a != null ? o.a : UIK.setting('panel', 'normal') === 'dense' ? 0.78 : 0.62;
    let gr;
    if (side === 'r') gr = g.createLinearGradient(rect.x + rect.w, 0, rect.x, 0);
    else if (side === 'l') gr = g.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
    else if (side === 'b') gr = g.createLinearGradient(0, rect.y + rect.h, 0, rect.y);
    else gr = g.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    gr.addColorStop(0, `rgba(10,11,18,${a})`); gr.addColorStop(0.55, `rgba(10,11,18,${a * 0.7})`); gr.addColorStop(1, 'rgba(10,11,18,0)');
    g.save(); g.fillStyle = gr; g.fillRect(rect.x, rect.y, rect.w, rect.h); g.restore();
  };

  /** 小さい窓（人の札・比較の行）。o.focused で琥珀の縁 */
  UIK.card = function (g, rect, o) {
    o = o || {};
    UIK.panel(g, rect, { r: o.r != null ? o.r : UIK.T.radii.m, shadow: false, frost: o.frost, a: o.a != null ? o.a : 0.66, edge: o.focused ? 'rgba(236,201,124,0.85)' : undefined });
    if (o.focused) {
      g.save(); UIK.rr(g, rect.x, rect.y, rect.w, rect.h, o.r != null ? o.r : UIK.T.radii.m); g.clip();
      const gr = g.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
      gr.addColorStop(0, 'rgba(236,201,124,0.16)'); gr.addColorStop(1, 'rgba(236,201,124,0.02)');
      g.fillStyle = gr; g.fillRect(rect.x, rect.y, rect.w, rect.h); g.restore();
    }
  };

  // 札の種類（o.kind）
  const CHIP = {
    plain: { bg: 'rgba(240,228,200,0.12)', line: 'rgba(240,228,200,0.25)', c: null },
    gold: { bg: 'rgba(236,201,124,0.16)', line: 'rgba(236,201,124,0.55)', c: 'gold' },
    new: { bg: '#ecc97c', line: '#fff1c8', c: '#2a1d0c' },
    teal: { bg: 'rgba(143,214,216,0.12)', line: 'rgba(143,214,216,0.55)', c: 'teal' },
    ink: { bg: 'rgba(120,80,30,0.08)', line: 'rgba(70,50,26,0.35)', c: 'ink2' },
  };
  /** 丸い小さな札（文字＋アイコン）。o = {size（掛ける前）, kind:'plain'|'gold'|'new'|'teal'|'ink', icon, color, bg, line}。→ 幅（掛けた後） */
  UIK.chip = function (g, x, y, text, o) {
    o = o || {};
    const T = UIK.T, k = R.uiScale || 1;
    const st = CHIP[o.kind || (o.color || o.bg ? 'plain' : 'gold')] || CHIP.plain;
    const col = o.color || (st.c && T.color[st.c]) || st.c || T.color.text;
    const s = (o.size || 11) * k, pad = 7 * k, iw = o.icon ? s + 4 * k : 0;
    const w = UIK.measure(text, { size: s, weight: 700 }) + pad * 2 + iw, h = s + 8 * k;
    g.save();
    UIK.rr(g, x, y, w, h, h / 2);
    g.fillStyle = o.bg || st.bg; g.fill();
    g.strokeStyle = o.line || st.line; g.lineWidth = 0.75; g.stroke();
    g.restore();
    if (o.icon) UIK.icon(g, o.icon, x + pad - 1 * k, y + (h - s) / 2, s, col);
    UIK.text(g, text, x + pad + iw, y + (h - s) / 2 - 0.5 * k, { size: s, weight: 700, color: col });
    return w;
  };
  /** 札の高さ（掛けた後） */
  UIK.chipH = function (size) { const k = R.uiScale || 1; return (size || 11) * k + 8 * k; };

  /** 隊列の札「前」「後」。size は掛けた後。→ 幅 */
  UIK.tag = function (g, row, x, y, size) {
    const T = UIK.T, front = row === 'front' || row === '前';
    const label = front ? '前' : '後';
    const s = size || UIK.u(11), w = s + UIK.u(6), h = s + UIK.u(4);
    g.save();
    UIK.rr(g, x, y, w, h, UIK.u(3));
    g.fillStyle = front ? 'rgba(242,194,138,0.18)' : 'rgba(169,210,242,0.16)'; g.fill();
    g.strokeStyle = front ? 'rgba(242,194,138,0.6)' : 'rgba(169,210,242,0.55)'; g.lineWidth = 0.75; g.stroke();
    g.restore();
    UIK.text(g, label, x + w / 2, y + (h - s) / 2, { size: s, weight: 700, color: front ? T.color.front : T.color.back, align: 'center' });
    return w;
  };

  /** 両端が消える細い線 */
  UIK.hline = function (g, x0, x1, y, a, rgb) {
    const col = rgb || '240,228,200';
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.12, `rgba(${col},${a == null ? 0.3 : a})`);
    gr.addColorStop(0.88, `rgba(${col},${a == null ? 0.3 : a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.save(); g.fillStyle = gr; g.fillRect(x0, y, x1 - x0, 2 / (R.SCALE || 2)); g.restore();
  };
  /** 1 デバイス px の区切り線 */
  UIK.rule = function (g, x0, x1, y, a, color) {
    g.save(); g.fillStyle = color || `rgba(240,228,200,${a == null ? 0.14 : a})`; g.fillRect(x0, y, x1 - x0, 1 / (R.SCALE || 2)); g.restore();
  };
  /** 菱形 */
  UIK.diamond = function (g, x, y, r, fill, stroke, lw) {
    g.save(); g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    g.restore();
  };
  /** 柔らかい光（足し算）。c = [r,g,b] */
  // 光のにじみ（2026-09-29 性能）: 放射グラデーションを毎フレーム塗っていた（一覧の選んだ行の光だけで店の 1 フレームの 3 割）。
  // 大きさ・色・画素の端数が 2 フレーム続けて同じなら、濃さ 1 の 1 枚に焼き、濃さ a は globalAlpha で掛けて置く
  // （色が同じで濃さだけの段なので、掛ける順が違っても同じ絵。丸めの差は 1/255 まで）。動き続けるにじみは今までどおり直に塗る
  const GLOW = { cache: new Map(), seen: new Map(), frame: -1 };
  function glowDirect(g, x, y, r, c, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); gr.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.4})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
  }
  UIK.glow = function (g, x, y, r, c, a) {
    const m = g.getTransform ? g.getTransform() : null;
    if (!m || m.b || m.c || m.a !== m.d || !(m.a > 0) || !(r > 0) || !(a > 0) || a > 1 || r * m.a < 24 || !R.Gfx.canvas2d || UIK._direct) { glowDirect(g, x, y, r, c, a); return; }
    const sc = m.a, X = sc * (x - r) + m.e, Y = sc * (y - r) + m.f, fx = X - Math.floor(X), fy = Y - Math.floor(Y);
    const key = [r * sc, c.join(','), sc, fx.toFixed(4), fy.toFixed(4)].join('|');
    let e = GLOW.cache.get(key);
    if (!e) {
      const f = R.Engine ? R.Engine.frame : 0;
      if (GLOW.frame !== f) { GLOW.frame = f; for (const [k, v] of GLOW.seen) if (f - v > 2) GLOW.seen.delete(k); }
      const prev = GLOW.seen.get(key);
      GLOW.seen.set(key, f);
      if (prev == null || prev === f) { glowDirect(g, x, y, r, c, a); return; }
      const d = Math.ceil(2 * r * sc + fx) + 1, d2 = Math.ceil(2 * r * sc + fy) + 1;
      const cv = R.Gfx.canvas2d(d, d2);
      if (!cv) { glowDirect(g, x, y, r, c, a); return; }
      const cx = cv.getContext('2d');
      cx.setTransform(sc, 0, 0, sc, fx - sc * (x - r), fy - sc * (y - r));
      glowDirect(cx, x, y, r, c, 1);
      e = { cv };
      GLOW.cache.set(key, e);
      while (GLOW.cache.size > 16) GLOW.cache.delete(GLOW.cache.keys().next().value);
    } else { GLOW.cache.delete(key); GLOW.cache.set(key, e); }
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha *= a;
    g.imageSmoothingEnabled = false;
    g.drawImage(e.cv, Math.floor(X), Math.floor(Y));
    g.restore();
  };
  /** 画面全体を暗く */
  UIK.dim = function (g, a) { g.save(); g.fillStyle = `rgba(6,7,12,${a})`; g.fillRect(0, 0, R.W, R.H); g.restore(); };

  /** 今の画面の 1/4 のぼかした写し（メニューを開いたときに 1 回）。→ canvas | null */
  UIK.snapshot = function () {
    const src = R.Gfx && R.Gfx.canvas;
    if (!src || !R.Gfx.canvas2d) return null;
    const lw = Math.max(1, Math.round(R.W / 4)), lh = Math.max(1, Math.round(R.H / 4));
    const c = R.Gfx.canvas2d(lw, lh);
    if (!c) return null;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.drawImage(src, 0, 0, lw, lh);
    let out = c;
    try { if (R.Hd && R.Hd.blur) out = R.Hd.blur(c, 3) || c; } catch (e) { out = c; }
    snap = { canvas: out, w: R.W, h: R.H };
    try { if (R.Hd && R.Hd.track) R.Hd.track('snap', 'uik', out.width * out.height * 4); } catch (e) { /* 量の届けは無くてよい */ }
    return out;
  };
  /** 写しを捨てる（メニューを閉じたとき） */
  UIK.dropSnapshot = function () { snap = null; try { if (R.Hd && R.Hd.track) R.Hd.track('snap', 'uik', 0); } catch (e) { /* */ } };
  UIK.lastSnapshot = function () { return snap && snap.canvas; };
})(window.RPG);
