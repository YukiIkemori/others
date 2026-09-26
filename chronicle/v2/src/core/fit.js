// 画面合わせ（CORE）: R.fit() と、DOM に触れない計算 R.fitCalc()（MODERN_UI §1.2）
//
// 横持ち: 論理の高さ 540 固定。幅は画面の横/縦で決める
//   横/縦 ≥ 16:9        → 幅 = 540 × 横/縦 を偶数に丸め、1260 まで（それより横長は左右に帯）
//   1.6 ≤ 横/縦 < 16:9   → 幅 960（上下に帯。MODERN_UI §1.2 の「PC 16:10」の行）
//   横/縦 < 1.6          → 幅 = 540 × 横/縦（偶数）、720 まで（それより細いと上下に帯。「タブレット 4:3」の行）
// 縦持ち（縦 > 横）: 幅 540、高さ = 540 × 縦/横 を丸めて 1260 まで（layout 'tall'）
// SCALE: 2 か 4 だけ。4 は実画面（デバイス px）の短い辺が 1600 以上のときだけ
// uiScale: 端末の型の既定（縦持ち 1.3・横長のタッチ 1.25・4:3 のタッチ 1.1・ほか 1.0）と
//          「本文 15 論理 px が 12 CSS px 以上」になる値の大きい方 × 設定 uiSize（1 / 1.15 / 1.3）
// safe: env(safe-area-inset-*) を論理 px にした値。UI のアンカーはこの内側に置く
(function (R) {
  'use strict';
  const even = (v) => 2 * Math.round(v / 2);

  /** o = {cssW, cssH, dpr, safe:{l,t,r,b} (CSS px), uiSize, coarse} → 画面の決め方（DOM に触れない） */
  R.fitCalc = function (o) {
    const cssW = Math.max(1, o.cssW), cssH = Math.max(1, o.cssH), dpr = o.dpr || 1;
    const a = cssW / cssH;
    let W, H, layout;
    if (cssH > cssW) {
      layout = 'tall';
      W = 540;
      H = Math.min(1260, Math.max(540, Math.round(540 * cssH / cssW)));
    } else {
      layout = 'wide';
      H = 540;
      if (a >= 16 / 9 - 1e-6) W = Math.min(1260, even(540 * a));
      else if (a >= 1.6) W = 960;
      else W = Math.max(720, even(540 * a));
    }
    const scale = Math.min(cssW / W, cssH / H); // CSS px / 論理 px
    const cw = W * scale, ch = H * scale;
    const SCALE = Math.min(cssW, cssH) * dpr >= 1600 ? 4 : 2;
    let base = 1;
    if (layout === 'tall') base = 1.3;
    else if (o.coarse && a > 1.9) base = 1.25;
    else if (o.coarse && a < 1.5) base = 1.1;
    const need = 12 / (15 * scale);
    let ui = Math.max(base, Math.ceil(need * 20 - 1e-9) / 20);
    ui = Math.round(ui * (o.uiSize || 1) * 100) / 100;
    const s = o.safe || { l: 0, t: 0, r: 0, b: 0 };
    const left = (cssW - cw) / 2, top = (cssH - ch) / 2;
    // セーフエリアは帯の外なら 0（帯がすでに避けている）
    const safe = {
      l: Math.max(0, (s.l - left) / scale), r: Math.max(0, (s.r - left) / scale),
      t: Math.max(0, (s.t - top) / scale), b: Math.max(0, (s.b - top) / scale),
    };
    for (const k in safe) safe[k] = Math.round(safe[k] * 10) / 10;
    return { W, H, SCALE, layout, uiScale: ui, safe, css: { w: cw, h: ch, left, top }, displayScale: scale * dpr / SCALE, cssScale: scale };
  };

  let lastKey = '';
  /** 画面に合わせ直す。変わったら R.emit('layout') */
  R.fit = function (force) {
    if (typeof document === 'undefined' || !document.getElementById) return null;
    const cv = R.Gfx && R.Gfx.canvas;
    if (!cv) return null;
    const probe = document.getElementById('safe-probe');
    let safe = { l: 0, t: 0, r: 0, b: 0 };
    if (probe && window.getComputedStyle) {
      const cs = getComputedStyle(probe);
      safe = { l: parseFloat(cs.paddingLeft) || 0, t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0 };
    }
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const uiSize = (R.Settings && R.Settings.get) ? +R.Settings.get('uiSize') || 1 : 1;
    const f = R.fitCalc({ cssW: window.innerWidth, cssH: window.innerHeight, dpr: window.devicePixelRatio || 1, safe, uiSize, coarse });
    const key = [f.W, f.H, f.SCALE, f.layout, f.uiScale, f.safe.l, f.safe.t, f.safe.r, f.safe.b].join(',');
    cv.style.width = f.css.w + 'px';
    cv.style.height = f.css.h + 'px';
    cv.style.left = f.css.left + 'px';
    cv.style.top = f.css.top + 'px';
    R.fitInfo = f;
    if (key === lastKey && !force) return f;
    lastKey = key;
    R.W = f.W; R.H = f.H; R.SCALE = f.SCALE; R.layout = f.layout; R.uiScale = f.uiScale; R.safe = f.safe;
    if (cv.width !== f.W * f.SCALE || cv.height !== f.H * f.SCALE) { cv.width = f.W * f.SCALE; cv.height = f.H * f.SCALE; }
    if (R.Gfx.reset) R.Gfx.reset();
    R.emit('layout', f);
    if (R.Engine && R.Engine.layoutChanged) R.Engine.layoutChanged();
    return f;
  };
})(window.RPG);
