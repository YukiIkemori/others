// UIK: 通知（MODERN_UI §3.3・§6.2）。すべての場面の上に重ね描き（R.Engine.overlay 'toast'）
//   toast(text, o)   o = {icon, anchor:'bl'（システム: オートセーブ・セーブ）|'tr'（入手・手がかり）, ms: 2400}
//   どちらも右上に出す（'bl' は名前だけ残した。'tr' の下に積む。会話の窓が開いている間は 'bl' を出さない）
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
    let yt = s.t + m + (UIK.toastOffset.tr || 0);
    // 手がかりの札（systems/leads.js、右上・縦持ちは左上）が出ている間は、その下から積む（3 つ同時に出ても重ならない。テスト報告 P9）
    try {
      const lr = R.Leads && R.Leads._shownRect && R.Leads._shownRect();
      if (lr) yt = Math.max(yt, lr.y + lr.h + gap);
    } catch (e) { /* 手がかりが無い場面 */ }
    // システムの通知（'bl' = オートセーブ・セーブなど）は、会話の窓（下の中央。縦持ちは幅いっぱい）と重ならないよう右上の
    // 入手の札（'tr'）の下に積む（オーナーの所見 2026-09-27: オートセーブの札が NPC の台詞を隠す）。
    // 会話・キャプションが開いている間は出さない（時間は進む。長い会話なら出ないまま消える）
    const talking = !!(UIK.Message && UIK.Message.busy && UIK.Message.busy());
    const order = [];
    for (let i = list.length - 1; i >= 0; i--) if (list[i].anchor === 'tr') order.push(list[i]);
    let ys = null;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].anchor !== 'tr') order.push(list[i]);
    // 新しい物ほど角に近い
    for (const t of order) {
      const age = now - t.t0;
      if (t.anchor !== 'tr' && talking) continue;
      const kin = Math.min(1, age / T.ms.toastIn), kout = Math.min(1, (t.ms - age) / T.ms.toastOut);
      const k = Math.max(0, Math.min(kin, kout));
      const iw = t.icon ? size + UIK.u(8) : UIK.u(8);
      const w = UIK.measure(t.text, { size }) + UIK.u(24) + iw;
      const slide = still ? 0 : (1 - UIK.ease(kin)) * UIK.u(14);
      let x, y;
      if (t.anchor === 'tr') { x = R.W - s.r - m - w + slide; y = yt; yt += h + gap; }
      else { if (ys == null) ys = yt + (UIK.toastOffset.bl || 0); x = R.W - s.r - m - w + slide; y = ys; ys += h + gap; }
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
    // 同じシステムの通知（オートセーブが続けて 2 回など）は積まずに出し直す
    if (anchor === 'bl') for (let i = list.length - 1; i >= 0; i--) if (list[i].anchor === 'bl' && list[i].text === String(text)) list.splice(i, 1);
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
