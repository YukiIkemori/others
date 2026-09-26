// UIK: 通知（MODERN_UI §3.3・§6.2）。すべての場面の上に重ね描き（R.Engine.overlay 'toast'）
//   toast(text, o)   o = {icon, anchor:'bl'（システム: オートセーブ・セーブ）|'tr'（入手・手がかり）, ms: 2400}
//   2.4 秒で消える。同じ角には 4 つまで積む（古い物から消える）。大きさは中で uiScale を掛ける。
//   R.UIK.toastOffset = {bl: 0, tr: 0}: FIELD などが角の札（小地図・目印の札）の分だけずらすとき（掛けた後の px）
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});
  const list = [];
  UIK.toastOffset = UIK.toastOffset || { bl: 0, tr: 0 };

  function draw(g) {
    const T = UIK.T, now = R.Engine.time;
    for (let i = list.length - 1; i >= 0; i--) if (now - list[i].t0 > list[i].ms) list.splice(i, 1);
    if (!list.length) { R.Engine.overlay('toast', null); return; }
    const s = R.safe || { l: 0, t: 0, r: 0, b: 0 }, m = UIK.margin();
    const size = UIK.u(T.size.label), h = UIK.u(30), gap = UIK.u(8);
    const still = UIK.reduceMotion();
    let yb = R.H - s.b - m - (UIK.toastOffset.bl || 0);
    let yt = s.t + m + (UIK.toastOffset.tr || 0);
    // 新しい物ほど角に近い
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i], age = now - t.t0;
      const kin = Math.min(1, age / T.ms.toastIn), kout = Math.min(1, (t.ms - age) / T.ms.toastOut);
      const k = Math.max(0, Math.min(kin, kout));
      const iw = t.icon ? size + UIK.u(8) : UIK.u(8);
      const w = UIK.measure(t.text, { size }) + UIK.u(24) + iw;
      const slide = still ? 0 : (1 - UIK.ease(kin)) * UIK.u(14);
      let x, y;
      if (t.anchor === 'tr') { x = R.W - s.r - m - w + slide; y = yt; yt += h + gap; }
      else { yb -= h; x = s.l + m - slide; y = yb; yb -= gap; }
      g.save();
      g.globalAlpha = k;
      UIK.panel(g, { x, y, w, h }, { r: UIK.u(8), a: 0.82, shadow: false });
      const col = t.anchor === 'tr' ? T.color.gold : T.color.teal;
      if (t.icon) UIK.icon(g, t.icon, x + UIK.u(12), y + (h - size) / 2, size, col);
      else UIK.diamond(g, x + UIK.u(14), y + h / 2, UIK.u(3.5), col);
      UIK.text(g, t.text, x + UIK.u(12) + iw, y + (h - size) / 2 - UIK.u(0.5), { size, color: T.color.text });
      g.restore();
    }
  }

  UIK.toast = function (text, o) {
    o = o || {};
    const anchor = o.anchor === 'tr' ? 'tr' : 'bl';
    list.push({ text: String(text), icon: o.icon, t0: R.Engine ? R.Engine.time : 0, ms: o.ms || UIK.T.ms.toast, anchor });
    // 同じ角は 4 つまで
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].anchor === anchor && ++n > 4) list.splice(i, 1);
    if (R.Engine && R.Engine.overlay) R.Engine.overlay('toast', draw, 50);
  };
  /** 出ている通知（テスト・QA 用）: [{text, anchor}] */
  UIK.toasts = function () { return list.map((t) => ({ text: t.text, anchor: t.anchor, icon: t.icon })); };
  UIK.clearToasts = function () { list.length = 0; };
})(window.RPG);
