// 画面合わせ（CORE）: R.fit() と、DOM に触れない計算 R.fitCalc()（MODERN_UI §1.2）
//
// 横持ち: 論理の高さ 540 固定。幅は画面の横/縦で決める
//   横/縦 ≥ 16:9        → 幅 = 540 × 横/縦 を偶数に丸め、1260 まで（それより横長は左右に帯）
//   1.6 ≤ 横/縦 < 16:9   → 幅 960（上下に帯。MODERN_UI §1.2 の「PC 16:10」の行）
//   横/縦 < 1.6          → 幅 = 540 × 横/縦（偶数）、720 まで（それより細いと上下に帯。「タブレット 4:3」の行）
// 縦持ち（縦/横 ≥ TALL_MIN）: 幅 540、高さ = 540 × 縦/横 を丸めて 1260 まで（layout 'tall'）
//   縦が横より少しだけ長い窓（PC のブラウザの 800×885 など。縦/横 < TALL_MIN）は縦持ちにしない: 縦持ちの画面は高さ 700 前後から下では
//   札どうしが重なる（テスト報告 2026-10-01 P5・P30・P32・P40）。横持ちの 4:3（720×540）を上下に帯で置く
//   縦持ちの uiScale の既定は高さに合わせて 1.0〜1.3（スマホの高さ 1170 で 1.3、900 で 1.0）。低い縦長の窓で縦に積んだ札が下にはみ出さない
// SCALE（論理 1 px ＝ 実キャンバスの px。PC 版で決め直した、ぼけない拡大）:
//   実画面の px／論理 px（= dev）が 2 以下 → 2（大きく描いて縮める。1280×720 など）
//   2 より大きく 4 まで → dev そのもの（実キャンバス＝実画面の画素に 1:1。2560×1440 は 2.667、3840×2160 は 4）。帯の位置も実画面の画素に揃える
//   4 より大きい → 4（ブラウザが拡げる）
//   設定 scaleMode 'integer' は dev を整数に切り下げる（2560×1440 なら 2 倍の 1920×1080 を真ん中に、余りは帯）
// uiScale: 端末の型の既定（縦持ち 1.3・横長のタッチ 1.25・4:3 のタッチ 1.1・ほか 1.0）と
//          「本文 15 論理 px が 12 CSS px 以上」になる値の大きい方 × 設定 uiSize（1 / 1.15 / 1.3）
// safe: env(safe-area-inset-*) を論理 px にした値。UI のアンカーはこの内側に置く
(function (R) {
  'use strict';
  const even = (v) => 2 * Math.round(v / 2);
  const TALL_MIN = 1.5;   // 縦/横 がこれ以上で縦持ち（高さ 810 以上）

  /** o = {cssW, cssH, dpr, safe:{l,t,r,b} (CSS px), uiSize, coarse} → 画面の決め方（DOM に触れない） */
  R.fitCalc = function (o) {
    const cssW = Math.max(1, o.cssW), cssH = Math.max(1, o.cssH), dpr = o.dpr || 1;
    const a = cssW / cssH;
    let W, H, layout;
    if (cssH >= cssW * TALL_MIN) {
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
    let scale = Math.min(cssW / W, cssH / H); // CSS px / 論理 px
    let dev = scale * dpr;                      // 実画面の px / 論理 px
    if (o.scaleMode === 'integer' && dev >= 1) { dev = Math.floor(dev + 1e-6); scale = dev / dpr; }
    let SCALE = dev <= 2 + 1e-6 ? 2 : Math.min(4, dev);
    const bh = Math.round(H * SCALE);
    SCALE = bh / H;
    const bw = Math.round(W * SCALE);
    const crisp = Math.abs(SCALE - dev) < 0.01;  // 実画面の画素に 1:1
    let cw = W * scale, ch = H * scale;
    if (crisp) { cw = bw / dpr; ch = bh / dpr; scale = ch / H; }
    let base = 1;
    if (layout === 'tall') base = Math.max(1, Math.min(1.3, Math.round(H / 900 * 20) / 20));
    else if (o.coarse && a > 1.9) base = 1.25;
    else if (o.coarse && a < 1.5) base = 1.1;
    const need = 12 / (15 * scale);
    let ui = Math.max(base, Math.ceil(need * 20 - 1e-9) / 20);
    ui = Math.round(ui * (o.uiSize || 1) * 100) / 100;
    const s = o.safe || { l: 0, t: 0, r: 0, b: 0 };
    // 帯の幅は実画面の画素に揃える（半端な位置だとブラウザが拡げ直してぼける）
    const left = Math.round(((cssW - cw) / 2) * dpr) / dpr, top = Math.round(((cssH - ch) / 2) * dpr) / dpr;
    // セーフエリアは帯の外なら 0（帯がすでに避けている）
    const safe = {
      l: Math.max(0, (s.l - left) / scale), r: Math.max(0, (s.r - left) / scale),
      t: Math.max(0, (s.t - top) / scale), b: Math.max(0, (s.b - top) / scale),
    };
    for (const k in safe) safe[k] = Math.round(safe[k] * 10) / 10;
    // 版 3 の後（QA check_ui、MODERN_UI の 12 CSS px・44 CSS px）: どの字もこれより小さく描かない（R.Gfx.font が丸める）・押せる行の最小（論理 px）
    const minFont = Math.round((12.2 / scale) * 100) / 100, minTouch = Math.round((44.5 / scale) * 100) / 100;
    return { W, H, SCALE, layout, uiScale: ui, safe, css: { w: cw, h: ch, left, top }, backing: { w: bw, h: bh }, crisp, displayScale: scale * dpr / SCALE, cssScale: scale, minFont, minTouch };
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
    const scaleMode = (R.Settings && R.Settings.get) ? R.Settings.get('scaleMode') : 'fit';
    const f = R.fitCalc({ cssW: window.innerWidth, cssH: window.innerHeight, dpr: window.devicePixelRatio || 1, safe, uiSize, coarse, scaleMode });
    const key = [f.W, f.H, f.SCALE, f.layout, f.uiScale, f.minFont, f.safe.l, f.safe.t, f.safe.r, f.safe.b].join(',');
    cv.style.width = f.css.w + 'px';
    cv.style.height = f.css.h + 'px';
    cv.style.left = f.css.left + 'px';
    cv.style.top = f.css.top + 'px';
    f.inW = window.innerWidth; f.inH = window.innerHeight; f.dpr = window.devicePixelRatio || 1;   // R.fitPoll が比べる
    R.fitInfo = f;
    if (key === lastKey && !force) return f;
    lastKey = key;
    R.W = f.W; R.H = f.H; R.SCALE = f.SCALE; R.layout = f.layout; R.uiScale = f.uiScale; R.safe = f.safe; R.minFont = f.minFont; R.minTouch = f.minTouch;
    if (cv.width !== f.backing.w || cv.height !== f.backing.h) { cv.width = f.backing.w; cv.height = f.backing.h; }
    if (R.Gfx.reset) R.Gfx.reset();
    R.emit('layout', f);
    if (R.Engine && R.Engine.layoutChanged) R.Engine.layoutChanged();
    return f;
  };

  R.fitCalc.TALL_MIN = TALL_MIN;

  /**
   * 毎フレーム（main.js の tick）: 窓の大きさ・画素比が前に合わせた時と違えば合わせ直す。
   * resize が来ない・遅れる変わり方（ブラウザの表示の拡大縮小・開発ツールの画面の切り替え・全画面の出入りの途中で読んだ大きさ）でも、
   * キャンバスが古い大きさのまま左上に縮んで描かれない（テスト報告 2026-10-01 P26・P33 の 195）
   */
  R.fitPoll = function () {
    if (typeof window === 'undefined' || !R.fitInfo) return;
    const f = R.fitInfo;
    if (window.innerWidth !== f.inW || window.innerHeight !== f.inH || (window.devicePixelRatio || 1) !== f.dpr) R.fit();
  };
})(window.RPG);
