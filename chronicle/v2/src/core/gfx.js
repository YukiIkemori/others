// Gfx（CORE）: 実キャンバス（論理 × SCALE）と、論理座標の 2D コンテキスト R.Gfx.g（V2_PLAN §2.1・§2.5.1）
// 絵は整数の論理座標に最近傍で置く（imageSmoothing なし）。文字は実キャンバスの解像度で描かれる（滑らか）。
// ここの text/measure は素の道具。UI の文字の決まり（大きさの段・影・字間）は R.UIK.text が持つ。
(function (R) {
  'use strict';
  const FONT = {
    jp: '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
    en: '"Cinzel", "Times New Roman", serif',
  };
  const BG = '#070812'; // 帯と何も無い所の色（純粋な黒は使わない、§2.1）
  const mcache = new Map();

  const Gfx = (R.Gfx = {
    canvas: null,
    ctx: null,
    g: null,
    FONT,
    BG,
    init(canvas) {
      Gfx.canvas = canvas;
      Gfx.ctx = canvas.getContext('2d', { alpha: false });
      Gfx.g = Gfx.ctx;
      Gfx.reset();
    },
    /** 変換を SCALE 倍に戻し、透明度・合成・影を既定に */
    reset() {
      const c = Gfx.ctx;
      if (!c) return;
      c.setTransform(R.SCALE, 0, 0, R.SCALE, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.imageSmoothingEnabled = false;
      c.shadowBlur = 0;
      c.shadowColor = 'transparent';
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
    },
    clear(color) {
      const c = Gfx.ctx;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = color || BG;
      c.fillRect(0, 0, Gfx.canvas.width, Gfx.canvas.height);
      c.restore();
    },
    rect(x, y, w, h, color) { const c = Gfx.g; c.fillStyle = color; c.fillRect(x, y, w, h); },
    strokeRect(x, y, w, h, color, lw) { const c = Gfx.g; c.strokeStyle = color; c.lineWidth = lw || 1; c.strokeRect(x, y, w, h); },
    roundRect(x, y, w, h, r, fill, stroke, lw) {
      const c = Gfx.g;
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, w, h, r);
      else { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
    },
    line(x1, y1, x2, y2, color, lw) {
      const c = Gfx.g; c.strokeStyle = color; c.lineWidth = lw || 1;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    },
    circle(x, y, r, fill, stroke, lw) {
      const c = Gfx.g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); }
    },
    /** 画像・キャンバスを整数の論理座標に置く */
    image(img, x, y, w, h) {
      if (!img) return;
      const c = Gfx.g;
      if (w == null) c.drawImage(img, Math.round(x), Math.round(y));
      else c.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },
    // 字の大きさは R.minFont（R.fit: 12 CSS px になる論理 px）より小さくしない（スマホ縦で caption・micro・キーの字が 9〜11 CSS px だった。QA check_ui）
    // 本文の書体は言語で変わる（中国語・韓国語は Noto Sans の各地域版。R.I18n.fontStack）
    font(size, weight, family) { const s = R.minFont && size < R.minFont ? R.minFont : size; return `${weight || 500} ${s}px ${family === 'en' ? FONT.en : R.I18n ? R.I18n.fontStack() : FONT.jp}`; },
    /** 幅のキャッシュを捨てる（言語を変えたとき） */
    clearMeasure() { mcache.clear(); },
    /** 素の文字。o = {size=15, weight=500, color, align, baseline='top', family:'jp'|'en'} */
    text(s, x, y, o) {
      o = o || {};
      const c = Gfx.g;
      c.font = Gfx.font(o.size || 15, o.weight, o.family);
      c.fillStyle = o.color || '#f6f0e3';
      c.textAlign = o.align || 'left';
      c.textBaseline = o.baseline || 'top';
      c.fillText(String(s), x, y);
    },
    /** 文字の幅（論理 px）。結果をキャッシュ */
    measure(s, o) {
      o = o || {};
      const f = Gfx.font(o.size || 15, o.weight, o.family);
      const k = f + '|' + s;
      let w = mcache.get(k);
      if (w == null) {
        if (!Gfx.ctx) return String(s).length * (o.size || 15);
        const c = Gfx.ctx; c.save(); c.font = f; w = c.measureText(String(s)).width; c.restore();
        if (mcache.size > 4000) mcache.clear();
        mcache.set(k, w);
      }
      return w;
    },
    /** 画面外に描く用のキャンバス（node では null） */
    canvas2d(w, h) {
      if (typeof document === 'undefined' || !document.createElement) return null;
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h));
      return cv;
    },
  });
})(window.RPG);
