// UIK: 開く／閉じる動きの入れ物（MODERN_UI §3.6）
//   const L = new R.UIK.Layer({anchor:'c', dim:0.4, onOpen, onClose})
//   await L.open()   k: 0 → 1（180 ms、下から 8 px 上がりつつフェードイン。「動きを減らす」ではフェードだけ）
//   await L.close()  k: 1 → 0（140 ms、フェードアウト）
//   L.k（0〜1）・L.isOpen・L.alpha()・L.offset()（掛けた後の px）・L.apply(g)（g.save の後に呼ぶ: 透明度と位置を当てる）・L.drawDim(g)
//   o.open / o.close に関数を渡した場合は、動きの始まりに呼ぶ（版 2 の書き方 {anchor, open(), close()} のため）
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});

  class Layer {
    constructor(o) {
      o = o || {};
      this.anchor = o.anchor || 'c';
      this.dim = o.dim != null ? o.dim : 0.4;
      this.k = 0;
      this.isOpen = false;
      this.dir = 0;           // 1 開いている途中、-1 閉じている途中
      this._onOpen = o.onOpen || (typeof o.open === 'function' ? o.open : null);
      this._onClose = o.onClose || (typeof o.close === 'function' ? o.close : null);
      this._openMs = o.openMs != null ? o.openMs : null;
      this._closeMs = o.closeMs != null ? o.closeMs : null;
      this._run = 0;
    }
    _anim(to, ms) {
      const id = ++this._run;
      const from = this.k;
      const t0 = R.Engine ? R.Engine.time : 0;
      if (!(ms > 0) || !R.until) { this.k = to; this.dir = 0; return Promise.resolve(); }
      return R.until(() => {
        if (id !== this._run) return true;   // 次の動きに負けた
        const t = Math.min(1, (R.Engine.time - t0) / ms);
        this.k = from + (to - from) * (to > from ? UIK.ease(t) : t);
        if (t >= 1) { this.k = to; this.dir = 0; return true; }
        return false;
      });
    }
    open() {
      this.isOpen = true; this.dir = 1;
      if (this._onOpen) { try { this._onOpen.call(this); } catch (e) { console.error(e); } }
      return this._anim(1, this._openMs != null ? this._openMs : UIK.T.ms.open);
    }
    close() {
      this.isOpen = false; this.dir = -1;
      if (this._onClose) { try { this._onClose.call(this); } catch (e) { console.error(e); } }
      return this._anim(0, this._closeMs != null ? this._closeMs : UIK.T.ms.close);
    }
    /** 今の透明度 */
    alpha() { return Math.max(0, Math.min(1, this.k)); }
    /** 今の縦のずれ（開くときだけ下から、掛けた後の px） */
    offset() {
      if (UIK.reduceMotion() || this.dir === -1 || this.k >= 1) return 0;
      const a = this.anchor.charAt(0);
      const d = a === 't' ? -1 : 1;
      return Math.round(d * (1 - this.k) * UIK.u(8) * 4) / 4;
    }
    /** g に透明度と位置を当てる（呼ぶ側が g.save/restore） */
    apply(g) {
      g.globalAlpha *= this.alpha();
      const oy = this.offset();
      if (oy) g.translate(0, oy);
    }
    /** 後ろを暗くする（dim × k） */
    drawDim(g) { if (this.dim > 0 && this.k > 0) UIK.dim(g, this.dim * this.alpha()); }
  }
  UIK.Layer = Layer;
})(window.RPG);
