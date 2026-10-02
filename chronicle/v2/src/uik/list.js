// UIK: 一覧（MODERN_UI §3.5・§3.7・§8.3。今の R.UI.List の置き換え）
//   const L = new R.UIK.List({rows:[{label, disabled?, value, right?, icon?, color?}], rowH: 34（掛ける前）, cols: 1,
//                             render(g, row, rect, focused), onSelect(row, i), onCancel(), onFocus(row, i), onDetail(row, i), tall, wrap: true})
//   L.update()           入力（十字・A・B・Y、マウスの重ね・クリック・ホイール、タッチのタップ・引きずり・長押し）
//   L.draw(g, rect)      rect は掛けた後の論理 px。行の高さは rowH × uiScale（縦持ちで tall なら × 1.2）。入り切らなければ右端に細いつまみ
//   cols > 1 は左から右・上から下の順に並べ、←→ で列、↑↓ で段。フォーカスの帯は 80 ms で滑る（ease-out）。
//   使えない行（disabled）は灰色で残し、選べない（決定で buzzer）。o.selectDisabled で onSelect に渡す。
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});
  const DRAG = 8;

  class List {
    constructor(o) {
      o = o || {};
      this.rows = o.rows || [];
      this.rowH = o.rowH || UIK.T.row.list;
      this.cols = Math.max(1, (o.cols | 0) || 1);
      this.index = Math.max(0, Math.min(o.index | 0, Math.max(0, this.rows.length - 1)));
      this.top = 0;                 // いちばん上に見えている段
      this.render = o.render || null;
      this.onSelect = o.onSelect || null;
      this.onCancel = o.onCancel || null;
      this.onFocus = o.onFocus || null;
      this.onDetail = o.onDetail || null;
      this.tall = !!o.tall;
      this.wrap = o.wrap !== false;
      this.sound = o.sound !== false;
      this.selectDisabled = !!o.selectDisabled;
      this.active = o.active !== false;   // false のときフォーカスを薄く出す（別の一覧を操作中）
      this.rect = o.rect || null;
      this._last = -1;
      this._anim = this._at(this.index);
      this._touch = null;           // {i, y0, top0, dragged}
      this._px = null; this._py = null;
    }
    // ---------------------------------------------------------------- 大きさ
    rowPx() { return Math.max(this.rowH * (R.uiScale || 1) * (this.tall && R.layout === 'tall' ? 1.2 : 1), R.layout === 'tall' && R.minTouch ? R.minTouch : 0); }   // 縦持ちは 44 CSS px 以上（押せる大きさ）
    get lines() { return Math.ceil(this.rows.length / this.cols); }
    get visible() { return Math.max(1, Math.floor(((this.rect ? this.rect.h : 300) + 0.5) / this.rowPx())); }
    maxTop() { return Math.max(0, this.lines - this.visible); }
    /** 行 i の rect（見えていなければ null） */
    rowRect(i) {
      if (!this.rect || i < 0 || i >= this.rows.length) return null;
      const line = Math.floor(i / this.cols) - this.top;
      if (line < 0 || line >= this.visible) return null;
      const cw = this.colW(), rh = this.rowPx();
      return { x: this.rect.x + (i % this.cols) * cw, y: this.rect.y + line * rh, w: cw, h: rh };
    }
    colW() { return (this.rect ? this.rect.w - (this.lines > this.visible ? UIK.u(8) : 0) : 300) / this.cols; }
    /** 点 (x, y) の行（無ければ -1） */
    hitIndex(x, y) {
      const r = this.rect;
      if (!r || !UIK.hit(r, x, y)) return -1;
      const line = this.top + Math.floor((y - r.y) / this.rowPx());
      const col = Math.min(this.cols - 1, Math.floor((x - r.x) / this.colW()));
      const i = line * this.cols + col;
      return i >= 0 && i < this.rows.length && line < this.top + this.visible ? i : -1;
    }
    current() { return this.rows[this.index]; }
    setRows(rows, keep) {
      this.rows = rows || [];
      if (!keep) { this.index = 0; this.top = 0; }
      this.index = Math.max(0, Math.min(this.index, this.rows.length - 1));
      this.clampTop();
      this._anim = this._at(this.index);
    }
    /** フォーカスを i へ（音なし・動きなし） */
    focusIndex(i) {
      if (!this.rows.length) return;
      this.index = Math.max(0, Math.min(i | 0, this.rows.length - 1));
      this.clampTop();
      this._anim = this._at(this.index);
    }
    clampTop() {
      const line = Math.floor(this.index / this.cols);
      if (line < this.top) this.top = line;
      if (line >= this.top + this.visible) this.top = line - this.visible + 1;
      this.top = Math.max(0, Math.min(this.top, this.maxTop()));
    }
    _move(i, snd) {
      if (i === this.index || i < 0 || i >= this.rows.length) return;
      const cur = this._animPos();
      this._anim = { fl: cur.line, fc: cur.col, tl: Math.floor(i / this.cols), tc: i % this.cols, t0: R.Engine.time };
      this.index = i;
      this.clampTop();
      if (snd && this.sound) UIK.sfx('cursor');
    }
    _at(i) { const l = Math.floor(i / this.cols), c = i % this.cols; return { fl: l, fc: c, tl: l, tc: c, t0: -1e9 }; }
    /** フォーカスの帯の今の位置 {line, col}（80 ms で滑る） */
    _animPos() {
      const a = this._anim;
      const t = UIK.reduceMotion() ? 1 : UIK.ease(Math.min(1, ((R.Engine ? R.Engine.time : 0) - a.t0) / UIK.T.ms.cursor));
      return { line: a.fl + (a.tl - a.fl) * t, col: a.fc + (a.tc - a.fc) * t };
    }
    _select(i) {
      const row = this.rows[i];
      if (!row || this.hold) return;   // hold: 決定を受けない間（R.UIK.choiceGuard）
      if (row.disabled && !this.selectDisabled) { if (this.sound) UIK.sfx('buzzer'); return; }
      if (this.sound) UIK.sfx('confirm');
      if (this.onSelect) this.onSelect(row, i);
    }
    // ---------------------------------------------------------------- 入力
    update() {
      const I = R.Input, n = this.rows.length, c = this.cols;
      if (!n) {
        if (I.pressed('b') && this.onCancel) { if (this.sound) UIK.sfx('cancel'); this.onCancel(); }
        return;
      }
      if (this.index >= n) this.index = n - 1;
      // 十字
      if (I.repeat('down')) {
        let i = this.index + c;
        if (i >= n) {
          if (Math.floor(this.index / c) < this.lines - 1) i = n - 1;            // 下の段が短い → その段の最後へ
          else i = this.wrap && I.pressed('down') ? this.index % c : this.index; // 最後の段 → 先頭の段へ回る
        }
        this._move(i, true);
      } else if (I.repeat('up')) {
        let i = this.index - c;
        if (i < 0) {
          if (this.wrap && I.pressed('up')) { const col = this.index % c; i = (this.lines - 1) * c + col; if (i >= n) i -= c; } else i = this.index;
        }
        this._move(i, true);
      } else if (c > 1 && I.repeat('right')) {
        this._move(this.index + 1 < n ? this.index + 1 : this.wrap ? 0 : this.index, true);
      } else if (c > 1 && I.repeat('left')) {
        this._move(this.index - 1 >= 0 ? this.index - 1 : this.wrap ? n - 1 : this.index, true);
      }
      // ポインタ
      const p = I.pointer, r = this.rect;
      if (r) {
        const touch = p.type === 'touch' || p.type === 'pen' || I.lastDevice === 'touch';
        if (p.wheel && UIK.hit(r, p.x, p.y)) {
          this.top = Math.max(0, Math.min(this.maxTop(), this.top + (p.wheel > 0 ? 1 : -1)));
          const line = Math.floor(this.index / c);
          if (line < this.top) this._move(this.top * c + (this.index % c), false);
          else if (line >= this.top + this.visible) this._move(Math.min(n - 1, (this.top + this.visible - 1) * c + (this.index % c)), false);
        }
        if (p.longPress && this.onDetail) {
          const i = this.hitIndex(p.x, p.y);
          if (i >= 0) { this._touch = null; this._move(i, false); this.onDetail(this.rows[i], i); return; }
        }
        if (p.pressed) {
          const i = this.hitIndex(p.x, p.y);
          if (i >= 0) {
            if (touch) this._touch = { i, y0: p.y, top0: this.top, dragged: false };
            else { this._move(i, false); this._select(i); return; }
          }
        } else if (this._touch && p.down) {
          const t = this._touch, dy = p.y - t.y0;
          if (Math.abs(dy) > DRAG * (R.uiScale || 1)) t.dragged = true;
          if (t.dragged) this.top = Math.max(0, Math.min(this.maxTop(), Math.round(t.top0 - dy / this.rowPx())));
        } else if (this._touch && (p.released || !p.down)) {
          const t = this._touch; this._touch = null;
          if (!t.dragged && p.released) {
            const i = this.hitIndex(p.x, p.y);
            if (i === t.i) { this._move(i, false); this._select(i); return; }
          }
        } else if (!touch && I.lastDevice === 'mouse' && (p.x !== this._px || p.y !== this._py)) {
          const i = this.hitIndex(p.x, p.y);
          if (i >= 0 && i !== this.index) this._move(i, true);
        }
        this._px = p.x; this._py = p.y;
      }
      if (this.onFocus && this.index !== this._last) { this._last = this.index; this.onFocus(this.rows[this.index], this.index); }
      if (this.onDetail && I.pressed('y')) { this.onDetail(this.rows[this.index], this.index); return; }
      if (I.pressed('a')) this._select(this.index);
      else if (I.pressed('b') && this.onCancel) { if (this.sound) UIK.sfx('cancel'); this.onCancel(); }
    }
    // ---------------------------------------------------------------- 描く
    draw(g, rect) {
      this.rect = rect;
      this.clampTopSoft();
      const T = UIK.T, rh = this.rowPx(), cw = this.colW(), c = this.cols;
      const end = Math.min(this.rows.length, (this.top + this.visible) * c);
      // フォーカスの帯（滑る）
      if (this.rows.length) {
        const ap = this._animPos();
        const fy = rect.y + (ap.line - this.top) * rh;
        if (fy > rect.y - rh && fy < rect.y + this.visible * rh) {
          g.save(); g.beginPath(); g.rect(rect.x - UIK.u(8), rect.y, rect.w + UIK.u(16), this.visible * rh); g.clip();
          if (!this.active) g.globalAlpha *= 0.45;
          UIK.focus(g, { x: rect.x + ap.col * cw, y: fy + 1, w: cw, h: rh - 2 }, R.Engine.time, { cursor: this.active });
          g.restore();
        }
      }
      for (let i = this.top * c; i < end; i++) {
        const rr = this.rowRect(i);
        if (!rr) continue;
        const f = i === this.index && this.active;
        const row = this.rows[i];
        if (this.render) this.render(g, row, rr, f);
        else this.drawRow(g, row, rr, f);
      }
      // つまみ
      if (this.lines > this.visible) {
        const tx = rect.x + rect.w - UIK.u(3), th = this.visible * rh;
        g.save();
        g.fillStyle = 'rgba(240,228,200,0.10)'; g.fillRect(tx, rect.y, UIK.u(2), th);
        const k = this.visible / this.lines, h = Math.max(UIK.u(16), th * k);
        const y = rect.y + (th - h) * (this.top / Math.max(1, this.maxTop()));
        g.fillStyle = 'rgba(236,201,124,0.7)'; g.fillRect(tx, y, UIK.u(2), h);
        g.restore();
      }
    }
    clampTopSoft() { this.top = Math.max(0, Math.min(this.top, this.maxTop())); }
    /** 既定の行: アイコン・名前・右寄せの値 */
    drawRow(g, row, rr, focused) {
      const T = UIK.T;
      const label = row && typeof row === 'object' ? row.label : row;
      const dis = row && row.disabled;
      const size = UIK.u(T.size.body) * (this.tall && R.layout === 'tall' ? 1.1 : 1);
      const col = dis ? T.color.disabled : (row && row.color) || (focused ? T.color.goldHi : T.color.text);
      let x = rr.x + UIK.u(16);
      const ty = rr.y + (rr.h - size) / 2 - UIK.u(0.5);
      if (row && row.icon) { UIK.icon(g, row.icon, x, rr.y + (rr.h - size * 1.1) / 2, size * 1.1, dis ? T.color.disabled : focused ? T.color.gold : T.color.text2); x += size * 1.1 + UIK.u(8); }
      let rw = 0;
      if (row && row.right != null) {
        const rs = String(row.right);
        rw = UIK.measure(rs, { size: size * 0.92 }) + UIK.u(12);
        UIK.text(g, rs, rr.x + rr.w - UIK.u(12), ty + size * 0.04, { size: size * 0.92, color: dis ? T.color.disabled : T.color.text2, align: 'right' });
      }
      UIK.text(g, String(label == null ? '' : label), x, ty, { size, weight: focused ? 700 : 500, color: col, maxW: rr.x + rr.w - x - rw - UIK.u(8) });
    }
  }
  UIK.List = List;
})(window.RPG);
