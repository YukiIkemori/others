// UIK: ボタン表示（MODERN_UI §3.8）と吹き出し（§3.3）
//   glyph(g, btn, cx, cy, o)            1 つのボタンの印（最後に触った入力で パッド＝白い丸・L/R は角丸の札／キーボード＝キー帽子／タッチ＝輪）。
//                                        o = {size（掛けた後）, kind?, label?, style?, index?}。→ 幅
//                                        パッドは R.Input.prompt の style（'xbox' 下が A・'ps' ×○□△・'nintendo' 右が A）と今の割り当ての
//                                        ボタンの番号で描く（面は色の付いた字・形、肩は LB/L1/L の札、start は ≡ や Options）。どの画面もここを通る
//   prompts(g, list, anchor)            [{btn, label}…]（[btn, label] も可）を 1 行に。anchor = 'br'（既定）|'bl'|'bc'|'tr'|'tl'|{x, y, align}
//                                        大きさは中で uiScale を掛ける。→ {x, y, w, h}（掛けた後）
//   bubble(g, x, y, prompts)            人・物の上（x, y = 頭の上の点）に「[A] 話す」の小さな吹き出し。中で uiScale を掛ける
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});
  const INK = '#1c1a18', CAP = 'rgba(245,238,224,0.94)';
  const ARROW = { up: 'M0 -3.5L3.5 2H-3.5z', down: 'M0 3.5L3.5 -2H-3.5z', left: 'M-3.5 0L2 -3.5V3.5z', right: 'M3.5 0L-2 -3.5V3.5z' };

  // 印の中の字（× 0.8〜0.92）も 12 CSS px 以上に: 印の大きさの下限（R.minFont は R.fit、スマホ縦だけ効く）
  const minG = (sz) => Math.max(sz, (R.minFont || 0) / 0.8);
  // パッドの面のボタンの色（標準配置の番号 0 下・1 右・2 左・3 上）。地は同じクリーム、字と形だけ色を付ける
  const FACE = {
    xbox: ['#2f8a3a', '#c23b33', '#2f63b8', '#a87808'],
    ps: ['#3d67b8', '#c8424e', '#b85c9c', '#23897a'],
    nintendo: [INK, INK, INK, INK],
  };
  const DPAD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  function info(btn, o) {
    if (o && o.kind) return { kind: o.kind, label: o.label || String(btn).toUpperCase(), style: o.style, index: o.index };
    try { if (R.Input && R.Input.prompt) return R.Input.prompt(btn); } catch (e) { /* */ }
    return { kind: 'kb', label: String(btn).toUpperCase() };
  }
  /** 印の形: 'key'（キー帽子）| 'touch' | 'face'（丸に字）| 'ps'（丸に ×○□△ の形）| 'pill'（角丸の札）| 'arrow' | 'view' | 'menu' */
  function shape(btn, pr) {
    if (pr.kind === 'kb') return 'key';
    if (pr.kind === 'touch') return 'touch';
    const i = pr.index;
    if (i == null) return btn === 'l' || btn === 'r' ? 'pill' : ARROW[btn] ? 'arrow' : 'face';   // 系統の無い古い形（仮の実装など）
    if (DPAD[i]) return 'arrow';
    if (i >= 0 && i <= 3) return pr.style === 'ps' ? 'ps' : 'face';
    if (i === 8 || i === 9) return pr.style === 'xbox' ? (i === 8 ? 'view' : 'menu') : pr.style === 'nintendo' ? 'face' : 'pill';
    return 'pill';
  }
  /** 札の字の大きさ（長い名前は小さく） */
  const pillFs = (pr, size) => size * (String(pr.label).length > 3 ? 0.66 : 0.8);
  /** 印の幅（掛けた後）。size は掛けた後の文字の大きさ */
  function glyphW(btn, size, pr) {
    const r = size / 2 + size * 0.14;
    const sh = shape(btn, pr);
    if (sh === 'key') return Math.max(r * 2, UIK.measure(pr.label, { size: size * 0.82, weight: 700 }) + size * 0.7);
    if (sh === 'pill') return Math.max(r * 2.4, UIK.measure(pr.label, { size: pillFs(pr, size), weight: 700 }) + size * 0.9);
    return r * 2;
  }

  /** 印の幅（描かずに。o は glyph と同じ） */
  UIK.glyphWidth = function (btn, size, o) { return glyphW(btn, size, info(btn, o)); };

  UIK.glyph = function (g, btn, cx, cy, o) {
    o = o || {};
    const size = o.size || minG(UIK.u(12));
    const pr = info(btn, o);
    const r = size / 2 + size * 0.14;
    const w = glyphW(btn, size, pr);
    const x = cx - r;
    const sh = shape(btn, pr);
    const disc = () => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = CAP; g.fill(); };
    g.save();
    if (sh === 'key') {
      UIK.rr(g, x, cy - r, w, r * 2, size * 0.3); g.fillStyle = CAP; g.fill();
      g.fillStyle = 'rgba(20,16,10,0.28)'; g.fillRect(x + 1, cy + r - size * 0.16, w - 2, size * 0.13);
      UIK.text(g, pr.label, x + w / 2, cy - size * 0.82 / 2 - size * 0.04, { size: size * 0.82, weight: 700, color: INK, align: 'center' });
    } else if (sh === 'touch') {
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.strokeStyle = CAP; g.lineWidth = Math.max(1, size * 0.1); g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.42, 0, Math.PI * 2); g.fillStyle = CAP; g.fill();
    } else if (sh === 'pill') {
      UIK.rr(g, x, cy - r * 0.85, w, r * 1.7, r * 0.85); g.fillStyle = CAP; g.fill();
      const fs = pillFs(pr, size);
      UIK.text(g, pr.label, x + w / 2, cy - fs / 2 - size * 0.04, { size: fs, weight: 700, color: INK, align: 'center' });
    } else if (sh === 'arrow') {
      disc();
      const dir = DPAD[pr.index] || btn;
      g.translate(cx, cy); g.scale(size / 12, size / 12); g.fillStyle = INK; g.fill(new Path2D(ARROW[dir] || ARROW.up));
    } else if (sh === 'ps') {
      // ×○□△ は書体に頼らず線で描く（どの書体でも同じ形）
      disc();
      const k = size * 0.3, col = FACE.ps[pr.index] || INK;
      g.strokeStyle = col; g.lineWidth = Math.max(1, size * 0.13); g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      if (pr.index === 0) { g.moveTo(cx - k, cy - k); g.lineTo(cx + k, cy + k); g.moveTo(cx + k, cy - k); g.lineTo(cx - k, cy + k); }
      else if (pr.index === 1) g.arc(cx, cy, k * 1.02, 0, Math.PI * 2);
      else if (pr.index === 2) g.rect(cx - k * 0.9, cy - k * 0.9, k * 1.8, k * 1.8);
      else { g.moveTo(cx, cy - k * 1.05); g.lineTo(cx + k * 1.05, cy + k * 0.75); g.lineTo(cx - k * 1.05, cy + k * 0.75); g.closePath(); }
      g.stroke();
    } else if (sh === 'view' || sh === 'menu') {
      disc();
      g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = Math.max(0.75, size * 0.09);
      const k = size * 0.26;
      if (sh === 'menu') { for (const dy of [-k * 0.75, 0, k * 0.75]) g.fillRect(cx - k, cy + dy - size * 0.045, k * 2, size * 0.09); }
      else { g.strokeRect(cx - k, cy - k * 0.8, k * 1.25, k * 1.1); g.fillRect(cx - k * 0.25, cy - k * 0.3, k * 1.25, k * 1.1); }
    } else {
      disc();
      const col = (pr.style && FACE[pr.style] && pr.index >= 0 && pr.index <= 3) ? FACE[pr.style][pr.index] : INK;
      UIK.text(g, pr.label, cx, cy - size * 0.92 / 2 - size * 0.02, { size: size * 0.92, weight: 700, color: col, align: 'center' });
    }
    g.restore();
    return w;
  };

  function norm(list) { return (list || []).map((p) => (Array.isArray(p) ? { btn: p[0], label: p[1] } : p)).filter((p) => p && p.btn); }
  /** 行の幅（掛けた後） */
  UIK.promptsWidth = function (list, o) {
    const size = (o && o.size) || minG(UIK.u(12)), gap = UIK.u(18);
    const items = norm(list);
    let w = 0;
    for (const p of items) w += glyphW(p.btn, size, info(p.btn)) + UIK.u(6) + UIK.measure(p.label, { size });
    return w + gap * Math.max(0, items.length - 1);
  };

  UIK.prompts = function (g, list, anchor, o) {
    o = o || {};
    const items = norm(list);
    const size = minG(UIK.u(o.size || 12)), gap = UIK.u(18), m = UIK.margin();
    const s = R.safe || { l: 0, t: 0, r: 0, b: 0 };
    const total = UIK.promptsWidth(items, { size });
    let x, y, align;
    if (anchor && typeof anchor === 'object') { x = anchor.x; y = anchor.y; align = anchor.align || 'right'; }
    else {
      const a = anchor || 'br';
      const bottom = a.charAt(0) === 'b';
      y = bottom ? R.H - s.b - m - size / 2 : s.t + m + size / 2;
      const h = a.charAt(1);
      if (h === 'l') { x = s.l + m; align = 'left'; } else if (h === 'c') { x = R.W / 2; align = 'center'; } else { x = R.W - s.r - m; align = 'right'; }
    }
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    const x0 = cx;
    for (const p of items) {
      const pr = info(p.btn);
      const r = size / 2 + size * 0.14;
      const gw = UIK.glyph(g, p.btn, cx + r, y, { size });
      UIK.text(g, p.label, cx + gw + UIK.u(6), y - size / 2 - size * 0.06, { size, color: o.color || UIK.T.color.text2, shadow: o.shadow !== false });
      cx += glyphW(p.btn, size, pr) + UIK.u(6) + UIK.measure(p.label, { size }) + gap;
    }
    return { x: x0, y: y - size / 2 - UIK.u(4), w: total, h: size + UIK.u(8) };
  };

  UIK.bubble = function (g, x, y, list) {
    const items = norm(list);
    if (!items.length) return;
    const size = minG(UIK.u(11)), padX = UIK.u(8), gap = UIK.u(10);
    let w = padX * 2 + gap * (items.length - 1);
    for (const p of items) w += glyphW(p.btn, size, info(p.btn)) + UIK.u(5) + UIK.measure(p.label, { size, weight: 700 });
    const h = size + UIK.u(10), tail = UIK.u(5);
    const bx = Math.round(x - w / 2), by = Math.round(y - h - tail);
    g.save();
    // 吹き出しの地（紺、細い縁）としっぽ
    g.beginPath();
    const r = h / 2;
    g.moveTo(bx + r, by); g.lineTo(bx + w - r, by); g.arcTo(bx + w, by, bx + w, by + r, r); g.arcTo(bx + w, by + h, bx + w - r, by + h, r);
    g.lineTo(x + tail, by + h); g.lineTo(x, by + h + tail); g.lineTo(x - tail, by + h);
    g.lineTo(bx + r, by + h); g.arcTo(bx, by + h, bx, by + r, r); g.arcTo(bx, by, bx + r, by, r); g.closePath();
    g.fillStyle = 'rgba(14,16,26,0.84)'; g.fill();
    g.strokeStyle = 'rgba(240,228,200,0.28)'; g.lineWidth = 0.75; g.stroke();
    g.restore();
    let cx = bx + padX;
    const cy = by + h / 2;
    for (const p of items) {
      const pr = info(p.btn);
      const rr = size / 2 + size * 0.14;
      const gw = UIK.glyph(g, p.btn, cx + rr, cy, { size });
      UIK.text(g, p.label, cx + gw + UIK.u(5), cy - size / 2 - size * 0.06, { size, weight: 700, color: UIK.T.color.text });
      cx += glyphW(p.btn, size, pr) + UIK.u(5) + UIK.measure(p.label, { size, weight: 700 }) + gap;
    }
  };
})(window.RPG);
