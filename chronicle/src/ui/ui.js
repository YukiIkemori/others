// Core UI widgets shared by every system: message window (typewriter),
// choice window, reusable List widget, number input, notices.
// All interactive helpers return Promises (see R.Engine.run).
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const sfx = (id) => R.sfx(id);

  const MSG = { x: 8, y: 148, w: 240, h: 72, lines: 4, pad: 10 };

  // ------------------------------------------------------ text placeholders
  // The hero is named by the player, so text never hard-codes the name:
  //   {hero}          → the hero's current name
  //   {leader}        → the first living active member's name (hero while wiped)
  //   {g:男形|女形}    → chosen by the hero's gender (e.g. {g:坊や|お嬢さん})
  // R.Gfx.text / textWidth / wrap and every message window apply this.
  R.Text = {
    hero() {
      const h = R.Game && R.State && R.State.hero && R.State.hero();
      if (h) return h;
      return null;
    },
    name(key) {
      const g = R.Game;
      if (key === 'hero') {
        const h = R.Text.hero();
        if (h) return h.name;
        const d = R.DB.config && R.DB.config.defaultHero;
        return d ? d.name : '';
      }
      if (key === 'leader') {
        const l = g && R.State && R.State.leader && R.State.leader();
        return l ? l.name : R.Text.name('hero');
      }
      return '{' + key + '}';
    },
    gender() {
      const h = R.Text.hero();
      if (h && h.gender) return h.gender;
      const d = R.DB.config && R.DB.config.defaultHero;
      return (d && d.gender) || 'm';
    },
    fmt(s) {
      if (s == null) return '';
      s = String(s);
      if (s.indexOf('{') < 0) return s;
      return s
        .replace(/\{g:([^|}]*)\|([^}]*)\}/g, (m, a, b) => (R.Text.gender() === 'f' ? b : a))
        .replace(/\{(hero|leader)\}/g, (m, k) => R.Text.name(k));
    },
    /** canvas-free width estimate (node tools): full-width 32/3 px, half-width 16/3 px */
    approxWidth(s) {
      s = R.Text.fmt(s);
      let w = 0;
      for (const ch of s) w += ch.charCodeAt(0) < 0x2000 || (ch >= '｡' && ch <= 'ﾟ') ? 16 / 3 : 32 / 3;
      return w;
    },
  };

  // ----------------------------------------------------------- message
  class MessageLayer extends R.Layer {
    constructor(opts) {
      super();
      this.opts = opts || {};
      this.pages = [];
      this.page = 0;
      this.shown = 0; // chars revealed on current page
      this.waiting = false;
      this.resolveText = null;
      this.box = Object.assign({}, MSG);
      if (this.opts.pos === 'top') this.box.y = 6;
      if (this.opts.pos === 'middle') this.box.y = 78;
    }
    setText(text, opts, resolve) {
      // a new say into a window that is still showing an earlier say supersedes it: settle the
      // earlier promise first, or its caller (e.g. an onEnter event) waits forever and the
      // event runner stays busy (the Crest 「城で復活したあと固まる」 freeze)
      if (this.resolveText && this.resolveText !== resolve) { const prev = this.resolveText; this.resolveText = null; try { prev(); } catch (e) { console.error(e); } }
      // options never carry over from the previous say (only the position does)
      this.opts = Object.assign({ pos: this.opts.pos }, opts || {});
      this.box.y = this.opts.pos === 'top' ? 6 : this.opts.pos === 'middle' ? 78 : MSG.y;
      const w = this.box.w - this.box.pad * 2;
      const pages = [];
      for (const chunk of String(text).split('\f')) {
        const lines = G().wrap(chunk, w);
        for (let i = 0; i < lines.length; i += this.box.lines) pages.push(lines.slice(i, i + this.box.lines));
      }
      this.pages = pages.length ? pages : [['']];
      this.page = 0; this.shown = 0; this.waiting = false; this.autoT = 0;
      this.resolveText = resolve;
      this.stopVoice();
      this.startVoice();
    }
    // voice line (BRIEF A9): opts.voice = 'id' (the whole say) or ['id', …] (one per page). Starts with the
    // page, stops when the player advances past it / the window closes / a new say replaces it.
    // No file, volume 0 or no audio → silent (R.Audio.playVoice returns null).
    voiceId() {
      const v = this.opts.voice;
      return Array.isArray(v) ? v[this.page] || null : this.page === 0 ? v || null : null;
    }
    startVoice() {
      const id = this.voiceId();
      if (!id) return;
      try { this.voiceH = R.Audio && R.Audio.playVoice ? R.Audio.playVoice(id) : null; } catch (e) { console.error(e); }
    }
    stopVoice() {
      const h = this.voiceH;
      this.voiceH = null;
      if (h) { try { R.Audio.stopVoice(h); } catch (e) { console.error(e); } }
    }
    onRemove() { this.stopVoice(); }
    pageLen() { return this.pages[this.page].join('').length; }
    speed() {
      const s = this.opts.speed != null ? this.opts.speed : R.Settings.msgSpeed;
      return [0.5, 1, 2, 999][s] || 2;
    }
    // typing & auto-advance run in tick() so they progress even when another
    // layer (e.g. a choice window) is on top
    tick() {
      if (!this.resolveText) return;
      const len = this.pageLen();
      if (this.shown < len) {
        this.shown = Math.min(len, this.shown + this.speed() * (R.Engine.top() === this && In().down('b') ? 3 : 1));
        if (this.shown >= len && this.opts.noWait && this.page === this.pages.length - 1) this.finish();
        return;
      }
      if (this.opts.auto && ++this.autoT >= this.opts.auto) this.advance();
    }
    update() {
      if (!this.resolveText) return; // idle, kept open between says
      const len = this.pageLen();
      if (this.shown < len) {
        if (In().pressed('a') || In().pressed('down')) {
          this.shown = len;
          if (this.opts.noWait && this.page === this.pages.length - 1) this.finish();
        }
        return;
      }
      if (this.opts.auto) return;
      // A, B or Down advances (Down lets players page through long result text one-handed)
      if (In().pressed('a') || In().pressed('b') || In().pressed('down')) { sfx('confirm_soft'); this.advance(); }
    }
    advance() {
      if (this.page < this.pages.length - 1) {
        this.page++; this.shown = 0; this.autoT = 0;
        if (Array.isArray(this.opts.voice)) { this.stopVoice(); this.startVoice(); }
        return;
      }
      this.finish();
    }
    finish() {
      const r = this.resolveText; this.resolveText = null;
      // noWait (a question follows): the line keeps playing under the choice until the window moves on
      if (!this.opts.noWait) this.stopVoice();
      if (!this.opts.keep) { if (UI._msg === this) UI._msg = null; this.close(); }
      else R.Input.consume();
      if (r) r();
    }
    draw() {
      const b = this.box;
      G().window(b.x, b.y, b.w, b.h);
      if (!this.pages.length) return;
      let left = Math.floor(this.shown);
      const lines = this.pages[this.page];
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i].slice(0, Math.max(0, left));
        left -= lines[i].length;
        G().text(s, b.x + b.pad, b.y + 6 + i * 14);
      }
      if (this.resolveText && this.shown >= this.pageLen() && !this.opts.noWait && !this.opts.auto) {
        G().moreArrow(b.x + b.w / 2 - 3, b.y + b.h - 9);
      }
    }
  }

  // ------------------------------------------------------------- List
  /**
   * Reusable cursor list. Not a layer — embed it in your own layer:
   *   this.list = new R.UI.List({x:8,y:8,w:120, items:[...], rows:6});
   *   update(){ const r = this.list.update(); if (r==='select') ...; if (r==='cancel') ... }
   *   draw(){ this.list.draw(); }
   * items: string | {label, disabled, right, color, icon}
   * opts: x,y,w,h?,cols=1,rows(visible rows, default = all),lineH=14,cancel=true,
   *       window=true,title,wrap=true,active=true,colW,padX=16,padY=8,onChange(i),
   *       drawItem(item,x,y,w,i,selected) to custom-render a row.
   */
  class List {
    constructor(o) {
      Object.assign(this, { cols: 1, lineH: 14, cancel: true, window: true, wrap: true, active: true, padX: 16, padY: 8, index: 0, top: 0 }, o);
      this.items = o.items || [];
      if (!this.rows) this.rows = Math.max(1, Math.ceil(this.items.length / this.cols));
      if (!this.h) this.h = this.padY * 2 + this.rows * this.lineH - 2;
      if (!this.colW) this.colW = Math.floor((this.w - this.padX - 6) / this.cols);
      this.index = R.U.clamp(this.index, 0, Math.max(0, this.items.length - 1));
      this.scrollTo();
    }
    setItems(items, keepIndex = true) {
      this.items = items;
      if (!keepIndex) this.index = 0;
      this.index = R.U.clamp(this.index, 0, Math.max(0, items.length - 1));
      this.scrollTo();
    }
    /** content-sized list (BRIEF A11): as many visible rows as items, between min and max; the height follows */
    fitRows(max, min) {
      const n = R.U.clamp(Math.ceil(this.items.length / this.cols), min || 1, max);
      if (n !== this.rows || this._fitH !== this.h) {
        this.rows = n;
        this.h = this._fitH = this.padY * 2 + n * this.lineH - 2;
        this.scrollTo();
      }
      return this;
    }
    get item() { return this.items[this.index]; }
    isDisabled(i) { const it = this.items[i]; return it && typeof it === 'object' && it.disabled; }
    scrollTo() {
      const row = Math.floor(this.index / this.cols);
      if (row < this.top) this.top = row;
      if (row >= this.top + this.rows) this.top = row - this.rows + 1;
      const maxTop = Math.max(0, Math.ceil(this.items.length / this.cols) - this.rows);
      this.top = R.U.clamp(this.top, 0, maxTop);
    }
    /** returns 'select' | 'cancel' | 'move' | null */
    update() {
      if (!this.active) return null;
      const n = this.items.length;
      const d = In().dirRepeat();
      if (d && n) {
        const old = this.index;
        let i = this.index;
        const c = this.cols;
        if (d === 'up') i -= c; else if (d === 'down') i += c;
        else if (d === 'left' && c > 1) i -= 1; else if (d === 'right' && c > 1) i += 1;
        else if (c === 1 && (d === 'left' || d === 'right') && this.rows < n) {
          // page jump in long single-column lists
          i += (d === 'left' ? -1 : 1) * this.rows;
          i = R.U.clamp(i, 0, n - 1);
        }
        if (i < 0) {
          i = this.wrap ? (d === 'up' ? i + Math.ceil(n / c) * c : n - 1) : old;
          if (d === 'up' && i >= n) i -= c; // short last row: wrap to the last item of the same column
        }
        if (i >= n) i = this.wrap ? (d === 'down' ? i % c : 0) : old;
        if (i >= n) i = n - 1;
        if (i !== old) {
          this.index = i; this.scrollTo(); sfx('cursor');
          if (this.onChange) this.onChange(i);
          return 'move';
        }
      }
      if (In().pressed('a') && n) {
        if (this.isDisabled(this.index)) { sfx('buzzer'); return null; }
        sfx('confirm');
        return 'select';
      }
      if (In().pressed('b') && this.cancel) { sfx('cancel'); return 'cancel'; }
      return null;
    }
    draw(opts) {
      const o = opts || {};
      if (this.window) G().window(this.x, this.y, this.w, this.h, { title: this.title });
      const start = this.top * this.cols, end = Math.min(this.items.length, start + this.rows * this.cols);
      for (let i = start; i < end; i++) {
        const k = i - start;
        const col = k % this.cols, row = Math.floor(k / this.cols);
        const x = this.x + this.padX + col * this.colW;
        const y = this.y + this.padY + row * this.lineH;
        const it = this.items[i];
        const sel = i === this.index;
        if (this.drawItem) this.drawItem(it, x, y, this.colW - 4, i, sel);
        else {
          const label = typeof it === 'object' ? it.label : it;
          const dis = typeof it === 'object' && it.disabled;
          const color = (typeof it === 'object' && it.color) || (dis ? G().C.gray : G().C.white);
          const right = typeof it === 'object' && it.right != null && it.right !== '' ? String(it.right) : null;
          // a long label never runs into its count / cost or the next column (squeezed instead)
          // in a multi-column list the right text ends 6px short of the next column's cursor (x - 10)
          const rEnd = this.cols > 1 ? this.colW - 16 : this.colW - 10;
          const room = right ? rEnd - 6 - G().textWidth(right) : this.cols > 1 ? this.colW - 6 : 0;
          if (room > 0) G().fitText(label, x, y, room, { color });
          else G().text(label, x, y, { color });
          if (right) G().text(right, x + rEnd, y, { color, align: 'right' });
        }
        if (sel && (this.active || o.showInactiveCursor)) G().cursor(x - 10, y + 1, this.active);
      }
      // scroll arrows
      const totalRows = Math.ceil(this.items.length / this.cols);
      if (this.top > 0) {
        if (this.window && this.title) {
          // the title plate sits on the top border: the ▲ goes beside it, never over the title
          const tw = Math.ceil(G().textWidth(this.title)) + 8;
          const ax = this.x + Math.floor((this.w - tw) / 2) + tw + 6;
          if (ax + 3 < this.x + this.w - 6) tri(ax, this.y + 3, -1);
        } else tri(this.x + this.w / 2, this.y + 3, -1);
      }
      if (this.top + this.rows < totalRows) tri(this.x + this.w / 2, this.y + this.h - 5, 1);
    }
  }
  function tri(x, y, dir) {
    if (Math.floor(R.Engine.frame / 12) % 2) return;
    for (let i = 0; i < 3; i++) {
      const yy = dir < 0 ? y + 2 - i : y + i; // top mark ▲ (wide base at the bottom), bottom mark ▼
      G().rect(x - 2 + i, yy, 5 - i * 2, 1, '#fff');
    }
  }

  class ChoiceLayer extends R.Layer {
    constructor(items, o) {
      super();
      const w = o.w || Math.max(48, ...items.map((it) => Math.ceil(G().textWidth(typeof it === 'object' ? it.label : it)) + 30 + (it && it.right != null ? 40 : 0)));
      const cols = o.cols || 1;
      const rows = o.rows || Math.min(Math.ceil(items.length / cols), 8);
      const h = 16 + rows * 14 - 2;
      // o.scale (menus, BRIEF A11): the window is laid out in a virtual screen of R.W/scale units
      this.o = o;
      const s = o.scale || 1;
      const x = o.x != null ? o.x : Math.floor((R.W - 8 - (o.ox || 0)) / s) - w * 1;
      const y = o.y != null ? o.y : Math.floor((MSG.y - 2 - (o.oy || 0)) / s) - h;
      this.list = new List({ x, y, w: w * (cols > 1 && !o.w ? cols : 1), items, cols, rows, cancel: o.cancel !== false, index: o.initial || 0, title: o.title, onChange: o.onChange });
    }
    update() {
      const r = this.list.update();
      if (r === 'select') this.close(this.list.index);
      else if (r === 'cancel') this.close(-1);
    }
    draw() { UI.inFrame(this.o, () => this.list.draw()); }
  }

  class NumberLayer extends R.Layer {
    constructor(o) {
      super();
      this.o = o; this.v = o.initial != null ? o.initial : o.min;
    }
    update() {
      const o = this.o, d = In().dirRepeat();
      const old = this.v;
      if (d === 'up') this.v++; if (d === 'down') this.v--;
      if (d === 'right') this.v += 10; if (d === 'left') this.v -= 10;
      if (this.v > o.max) this.v = d === 'up' ? o.min : o.max;
      if (this.v < o.min) this.v = d === 'down' ? o.max : o.min;
      if (old !== this.v) sfx('cursor');
      if (In().pressed('a')) { sfx('confirm'); this.close(this.v); }
      else if (In().pressed('b')) { sfx('cancel'); this.close(-1); }
    }
    draw() { UI.inFrame(this.o, () => this.drawBox()); }
    drawBox() {
      const o = this.o, w = o.w || 120, h = o.price != null ? 42 : 28;
      const s = o.scale || 1;
      const x = o.x != null ? o.x : Math.floor((R.W - 8 - (o.ox || 0)) / s) - w, y = o.y != null ? o.y : Math.floor((MSG.y - 2 - (o.oy || 0)) / s) - h;
      G().window(x, y, w, h);
      G().text(o.label || '個数', x + 10, y + 8);
      G().text('× ' + this.v, x + w - 10, y + 8, { align: 'right' });
      if (o.price != null) G().text((o.price * this.v) + ' G', x + w - 10, y + 22, { align: 'right', color: G().C.yellow });
    }
  }

  const UI = (R.UI = {
    MSG,
    /** draw fn() inside a menu frame: o.ox/o.oy (logical px) then o.scale (BRIEF A11 compact menus) */
    inFrame(o, fn) {
      const s = (o && o.scale) || 1, ox = (o && o.ox) || 0, oy = (o && o.oy) || 0;
      if (s === 1 && !ox && !oy) return fn();
      const c = G().ctx;
      c.save();
      try { c.translate(ox, oy); return G().scaled(s, fn); } finally { c.restore(); }
    },
    List,
    MessageLayer,
    _msg: null,
    /**
     * Show text in the message window. Resolves when the player dismisses it.
     * opts: {keep:bool (leave window open for the next say/choose),
     *        noWait:bool (resolve as soon as the text is typed; implies keep),
     *        pos:'bottom'|'top'|'middle', auto:frames, speed:0..3,
     *        voice:'v_<speaker>_<scene>_<nn>' | [id per page] (assets/voice/<id>.*; silent when missing)}
     * '\n' = newline, '\f' = page break. Long text is wrapped & paginated.
     */
    say(text, opts) {
      const o = Object.assign({}, opts || {});
      if (o.noWait) o.keep = true;
      return new Promise((resolve) => {
        let m = UI._msg;
        if (!m || m.closed || R.Engine.top() !== m) {
          if (m && !m.closed) m.close();
          m = UI._msg = new MessageLayer(o);
          R.Engine.push(m);
        }
        m.setText(text, o, resolve);
      });
    },
    /** close a kept-open message window */
    /** the live message window layer (null when none is open); a handle for msgSettled() */
    msgOpen() { const m = UI._msg; return m && !m.closed ? m : null; },
    /**
     * true when the message window m (default: the current one) holds no unsettled say:
     * a window its reader closed has settled (finish() clears it before close()); one closed from
     * outside (closeMessage) still holds it
     */
    msgSettled(m) { const w = m === undefined ? UI._msg : m; return !w || !w.resolveText; },
    closeMessage() { if (UI._msg && !UI._msg.closed) UI._msg.close(); UI._msg = null; },
    /**
     * Choice window. Resolves to the chosen index, or -1 on cancel.
     * opts: {x,y,w,cols,rows,title,initial,cancel:true,onChange,scale,ox,oy}
     * Default position: right side, directly above the message window. scale (menus, BRIEF A11):
     * the window is drawn at that UI scale and x/y/w are in its virtual units (R.W/scale wide).
     */
    choose(items, opts) { return R.Engine.run(new ChoiceLayer(items, opts || {})); },
    /** say(text) + はい/いいえ. Resolves true for はい. Leaves the message window open. */
    async yesno(text, opts) {
      if (text) await UI.say(text, Object.assign({ noWait: true }, opts));
      const r = await UI.choose(['はい', 'いいえ'], { cancel: true });
      return r === 0;
    },
    /** numeric input. opts: {min,max,initial,label,price,x,y,w,scale}. Resolves value or -1 */
    number(opts) { return R.Engine.run(new NumberLayer(opts)); },
    /** short auto-closing notice (e.g. 'セーブしました') */
    notice(text, frames = 70) { return UI.say(text, { auto: frames, speed: 3 }); },
  });
})(window.RPG);
