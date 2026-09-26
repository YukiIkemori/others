// 仮の実装: UIK（R.UIK）。本物は src/uik/*（UIK）。V2_PLAN §2.5.6、MODERN_UI §3
// 窓は紺の半透明の角丸、文字は素の Zen Maru Gothic。Message（会話）は場面として積む。
(function (R) {
  'use strict';
  const T = {
    color: {
      text: '#f6f0e3', text2: '#d2c9b6', text3: '#9a917f', disabled: '#6c675f',
      panel: 'rgba(14,16,28,0.72)', panelDense: 'rgba(14,16,28,0.9)', edge: 'rgba(240,228,200,0.14)',
      gold: '#ecc97c', goldHi: '#fff1c8', goldLo: '#b98f47', teal: '#8fd6d8',
      hp: ['#5f9e5a', '#a9dc8e'], mp: ['#3d6aa6', '#92bdf0'], up: '#8ee08a', down: '#f47e6c', same: '#8e8878',
      rare: '#86c8ff', superRare: '#ffb65e', front: '#f2c28a', back: '#a9d2f2',
    },
    size: { display: 44, h1: 30, h2: 20, title: 16.5, body: 15, talk: 16.5, label: 13, caption: 11.5, micro: 10 },
    radius: 12,
    pad: 16,
    ms: { cursor: 80, focus: 120, open: 180, close: 140, screen: 260, place: 2400, toast: 2400 },
  };
  const u = () => R.uiScale || 1;

  // ---------------------------------------------------------------- 通知（toast）
  const toasts = [];
  function drawToasts(g) {
    const now = R.Engine.time;
    for (let i = toasts.length - 1; i >= 0; i--) if (now - toasts[i].t0 > toasts[i].ms) toasts.splice(i, 1);
    let y = R.H - (R.safe.b || 0) - 20 * u();
    for (const t of toasts) {
      const k = Math.min(1, (now - t.t0) / 180, (t.ms - (now - t.t0)) / 300);
      const w = R.UIK.measure(t.text, { size: T.size.label * u() }) + 36 * u(), h = 30 * u();
      const x = t.anchor === 'bl' ? (R.safe.l || 0) + 16 * u() : R.W - (R.safe.r || 0) - 16 * u() - w;
      y -= h;
      g.save();
      g.globalAlpha = Math.max(0, k);
      R.UIK.panel(g, { x, y, w, h }, { r: 8 });
      R.Gfx.circle(x + 14 * u(), y + h / 2, 4 * u(), T.color.gold);
      R.UIK.text(g, t.text, x + 26 * u(), y + h / 2 - T.size.label * u() * 0.62, { size: T.size.label * u() });
      g.restore();
      y -= 8 * u();
    }
  }

  // ---------------------------------------------------------------- List
  class List {
    constructor(o) {
      Object.assign(this, { rows: [], rowH: 34, cols: 1, index: 0, top: 0 }, o);
    }
    get visible() { return Math.max(1, Math.floor((this.rect ? this.rect.h : 300) / (this.rowH * u()))); }
    update() {
      const I = R.Input, n = this.rows.length;
      if (!n) { if (I.pressed('b') && this.onCancel) this.onCancel(); return; }
      if (I.repeat('down')) this.index = (this.index + 1) % n;
      if (I.repeat('up')) this.index = (this.index + n - 1) % n;
      const p = I.pointer;
      if (this.rect && (p.pressed || p.wheel)) {
        const r = this.rect, rh = this.rowH * u();
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const i = this.top + Math.floor((p.y - r.y) / rh);
          if (p.pressed && i >= 0 && i < n) { this.index = i; if (this.onSelect) this.onSelect(this.rows[i], i); return; }
        }
      }
      if (this.index < this.top) this.top = this.index;
      if (this.index >= this.top + this.visible) this.top = this.index - this.visible + 1;
      if (I.pressed('a') && this.onSelect) this.onSelect(this.rows[this.index], this.index);
      else if (I.pressed('b') && this.onCancel) this.onCancel();
    }
    draw(g, rect) {
      this.rect = rect;
      const rh = this.rowH * u();
      const end = Math.min(this.rows.length, this.top + this.visible);
      for (let i = this.top; i < end; i++) {
        const rr = { x: rect.x, y: rect.y + (i - this.top) * rh, w: rect.w, h: rh };
        const f = i === this.index;
        if (f) R.UIK.focus(g, rr, R.Engine.time);
        if (this.render) this.render(g, this.rows[i], rr, f);
        else R.UIK.text(g, String(this.rows[i].label || this.rows[i]), rr.x + 16 * u(), rr.y + (rh - T.size.body * u()) / 2 - 1, { size: T.size.body * u(), weight: f ? 700 : 500, color: this.rows[i].disabled ? T.color.disabled : T.color.text });
      }
    }
  }
  class Layer {
    constructor(o) { Object.assign(this, { anchor: 'c' }, o); }
  }

  // ---------------------------------------------------------------- Message（会話）
  const SPEED = { slow: 30, normal: 60, fast: 120, instant: 1e9 }; // 字/秒
  let cur = null; // {scene, resolve}
  function msgScene(o) {
    const pages = Array.isArray(o.text) ? o.text.slice() : [String(o.text == null ? '' : o.text)];
    const st = { page: 0, shown: 0, choice: 0 };
    const hasChoices = Array.isArray(o.choices) && o.choices.length > 0;
    const scene = {
      id: 'message',
      opaque: false,
      enter() { if (o.voice && R.Audio && R.Audio.voice) R.Audio.voice(o.voice); },
      exit() {},
      full() { return st.shown >= [...pages[st.page]].length; },
      update(dt) {
        const I = R.Input;
        const len = [...pages[st.page]].length;
        st.shown = Math.min(len, st.shown + (SPEED[R.Settings.get('textSpeed')] || 60) * dt / 1000 * (I.down('r') ? 4 : 1));
        const last = st.page === pages.length - 1;
        if (last && hasChoices && scene.full()) {
          if (I.repeat('down')) st.choice = (st.choice + 1) % o.choices.length;
          if (I.repeat('up')) st.choice = (st.choice + o.choices.length - 1) % o.choices.length;
          if (I.pressed('a') || I.pointer.pressed) return finish(st.choice);
          if (I.pressed('b') && o.cancel != null) return finish(o.cancel);
          return;
        }
        if (I.pressed('a') || I.pressed('b') || I.pressed('down') || I.pointer.pressed) {
          if (!scene.full()) { st.shown = len; return; }
          if (R.Audio && R.Audio.stopVoice) R.Audio.stopVoice();
          if (!last) { st.page++; st.shown = 0; return; }
          finish(undefined);
        }
      },
      draw(g) {
        const k = u(), pad = 20 * k;
        const w = Math.min(R.W - 32 * k, 860 * k), h = 128 * k;
        const x = (R.W - w) / 2, y = R.H - (R.safe.b || 0) - h - 16 * k;
        R.UIK.panel(g, { x, y, w, h }, {});
        let tx = x + pad;
        if (o.face) {
          R.UIK.portraitFrame(g, { x: x + 14 * k, y: y + 14 * k, w: 100 * k, h: 100 * k }, o.face, {});
          tx = x + 128 * k;
        }
        if (o.name) R.UIK.text(g, o.name + (o.title ? '  ' + o.title : ''), tx, y + 14 * k, { size: T.size.title * k, weight: 700, color: T.color.gold });
        const s = [...pages[st.page]].slice(0, Math.floor(st.shown)).join('');
        const lines = s.split('\n');
        lines.forEach((l, i) => R.UIK.text(g, l, tx, y + (o.name ? 42 : 20) * k + i * 28 * k, { size: T.size.talk * k }));
        if (hasChoices && st.page === pages.length - 1 && scene.full()) {
          const cw = 220 * k, ch = o.choices.length * 34 * k + 16 * k;
          const cx = x + w - cw, cy = y - ch - 8 * k;
          R.UIK.panel(g, { x: cx, y: cy, w: cw, h: ch }, {});
          o.choices.forEach((c, i) => {
            const rr = { x: cx + 6 * k, y: cy + 8 * k + i * 34 * k, w: cw - 12 * k, h: 34 * k };
            if (i === st.choice) R.UIK.focus(g, rr, R.Engine.time);
            R.UIK.text(g, c, rr.x + 16 * k, rr.y + 8 * k, { size: T.size.body * k, weight: i === st.choice ? 700 : 500 });
          });
        } else if (scene.full()) {
          const b = 0.5 + 0.5 * Math.sin(R.Engine.time / 180);
          g.fillStyle = `rgba(236,201,124,${0.5 + b * 0.5})`;
          g.beginPath(); g.moveTo(x + w - 30 * k, y + h - 24 * k); g.lineTo(x + w - 18 * k, y + h - 24 * k); g.lineTo(x + w - 24 * k, y + h - 16 * k); g.fill();
        }
      },
    };
    function finish(v) {
      if (!cur || cur.scene !== scene) return;
      const c = cur; cur = null;
      R.Engine.remove(scene, v);
      c.resolve(v);
    }
    scene.finish = finish;
    return scene;
  }

  R.Stubs.define('UIK', {
    T,
    text(g, s, x, y, o) {
      o = o || {};
      if (o.shadow) { g.save(); g.shadowColor = 'rgba(0,0,10,0.8)'; g.shadowBlur = 4; }
      R.Gfx.text(s, x, y, { size: o.size || T.size.body, weight: o.weight || 500, color: o.color || T.color.text, align: o.align, family: o.family, baseline: o.baseline });
      if (o.shadow) g.restore();
    },
    measure(s, o) { o = o || {}; return R.Gfx.measure(s, { size: o.size || T.size.body, weight: o.weight || 500, family: o.family }); },
    fit(s, w, o) {
      s = String(s);
      if (R.UIK.measure(s, o) <= w) return s;
      const a = [...s];
      while (a.length && R.UIK.measure(a.join('') + '…', o) > w) a.pop();
      return a.join('') + '…';
    },
    panel(g, rect, o) {
      o = o || {};
      R.Gfx.roundRect(rect.x, rect.y, rect.w, rect.h, o.r != null ? o.r : T.radius, R.Settings.get('panel') === 'dense' ? T.color.panelDense : T.color.panel, T.color.edge, 1);
    },
    fadePanel(g, rect, o) {
      const side = (o && o.side) || 'r';
      const gr = side === 'r' ? g.createLinearGradient(rect.x + rect.w, 0, rect.x, 0) : g.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
      gr.addColorStop(0, 'rgba(14,16,28,0.78)'); gr.addColorStop(1, 'rgba(14,16,28,0)');
      g.fillStyle = gr; g.fillRect(rect.x, rect.y, rect.w, rect.h);
    },
    card(g, rect, o) {
      o = o || {};
      R.Gfx.roundRect(rect.x, rect.y, rect.w, rect.h, 8, T.color.panel, o.focused ? T.color.gold : T.color.edge, o.focused ? 1.5 : 1);
    },
    chip(g, x, y, text, o) {
      o = o || {};
      const s = (o.size || T.size.micro) * u(), w = R.UIK.measure(text, { size: s, weight: 700 }) + 14 * u();
      R.Gfx.roundRect(x, y, w, s + 8 * u(), (s + 8 * u()) / 2, o.bg || 'rgba(236,201,124,0.18)', o.color || T.color.gold, 1);
      R.UIK.text(g, text, x + 7 * u(), y + 3 * u(), { size: s, weight: 700, color: o.color || T.color.gold });
      return w;
    },
    toast(text, o) {
      o = o || {};
      toasts.push({ text: String(text), icon: o.icon, t0: R.Engine.time, ms: o.ms || T.ms.toast, anchor: o.anchor || 'bl' });
      if (toasts.length > 4) toasts.shift();
      if (R.Engine.overlay) R.Engine.overlay('toast', drawToasts, 50);
    },
    bubble(g, x, y, prompts) {
      const txt = (prompts || []).map((p) => `[${R.Input.prompt(p.btn).label}] ${p.label}`).join('  ');
      const s = T.size.label * u(), w = R.UIK.measure(txt, { size: s }) + 20 * u();
      R.Gfx.roundRect(Math.round(x - w / 2), y - s - 16 * u(), w, s + 12 * u(), 8, 'rgba(14,16,28,0.82)', T.color.edge, 1);
      R.UIK.text(g, txt, x, y - s - 10 * u(), { size: s, align: 'center' });
    },
    focus(g, rect, t) {
      const gr = g.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
      gr.addColorStop(0, 'rgba(236,201,124,0.28)'); gr.addColorStop(1, 'rgba(236,201,124,0.02)');
      g.fillStyle = gr; g.fillRect(rect.x, rect.y, rect.w, rect.h);
      g.fillStyle = T.color.gold; g.fillRect(rect.x, rect.y, 2, rect.h);
      const cy = rect.y + rect.h / 2, cx = rect.x + 8;
      g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx + 4, cy); g.lineTo(cx, cy + 4); g.lineTo(cx - 4, cy); g.fill();
    },
    gauge(g, rect, cur, max, kind) {
      const k = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(rect.x, rect.y, rect.w, rect.h);
      const c = kind === 'mp' ? T.color.mp : T.color.hp;
      const gr = g.createLinearGradient(rect.x, 0, rect.x + rect.w, 0); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
      g.fillStyle = kind === 'hp' && k < 0.25 ? '#e0664f' : kind === 'hp' && k < 0.5 ? T.color.gold : gr;
      g.fillRect(rect.x, rect.y, rect.w * k, rect.h);
    },
    icon(g, name, x, y, size, color) { R.Gfx.roundRect(x, y, size, size, size / 4, null, color || T.color.text2, 1.5); },
    stars(g, grade, x, y) { R.UIK.text(g, grade === 'super' ? '★★' : grade === 'rare' ? '★' : '', x, y, { size: T.size.label, color: grade === 'super' ? T.color.superRare : T.color.rare }); },
    snapshot() { return null; },
    List,
    Layer,
    Message: {},
    prompts(g, list, anchor) {
      const k = u(), s = T.size.caption * k;
      let x = R.W - (R.safe.r || 0) - 16 * k;
      const y = R.H - (R.safe.b || 0) - 16 * k - s;
      for (const p of (list || []).slice().reverse()) {
        const pr = R.Input.prompt(p.btn);
        const lw = R.UIK.measure(p.label, { size: s });
        x -= lw;
        R.UIK.text(g, p.label, x, y, { size: s, color: T.color.text2 });
        const kw = Math.max(s + 8 * k, R.UIK.measure(pr.label, { size: s, weight: 700 }) + 10 * k);
        x -= kw + 6 * k;
        R.Gfx.roundRect(x, y - 3 * k, kw, s + 6 * k, pr.kind === 'pad' ? (s + 6 * k) / 2 : 4, 'rgba(246,240,227,0.9)', null);
        R.UIK.text(g, pr.label, x + kw / 2, y, { size: s, weight: 700, color: '#1a1a28', align: 'center' });
        x -= 16 * k;
      }
    },
    portraitFrame(g, rect, key, o) {
      R.Gfx.roundRect(rect.x, rect.y, rect.w, rect.h, 10, 'rgba(30,32,52,0.9)', T.color.edge, 1);
      const p = R.Portrait.parse(String(key));
      R.Portrait.draw(g, p.look, rect, { expr: p.expr, dim: o && o.dim });
    },
  });

  R.Stubs.define('UIK.Message', {
    say(o) {
      o = o || {};
      if (cur) cur.scene.finish(undefined); // 前の say を先に解決する（A6 の固まりの原因）
      return new Promise((resolve) => {
        const scene = msgScene(o);
        cur = { scene, resolve };
        R.Engine.push(scene);
      });
    },
    busy() { return !!cur; },
    close() { if (cur) cur.scene.finish(undefined); },
  });
})(window.RPG);
