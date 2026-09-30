// MENUS: 名前の入力（五十音表、V2_PLAN §3.8、SCREEN_RESULTS.nameentry: params {value, max: 5, title} → string | null）
//   十字で字を選び A で足す。B で 1 字消す（空なら閉じて null）。X でひらがな／カタカナ。下の段: かな切替・消す・決定。
//   マウスとタッチは字を直に押す。最初は決定の上にカーソル（決めた名前をそのまま使える）。
//   キーボード（Steam の PC 版）: 表に割り当てのない字のキーを押すか、IME で打ち始めるか、Y（Tab）で「キーボードで入力」になる。
//     隠した <input> に字を打つ（IME の変換中の字も枠に出す。日本語・中国語・韓国語）。Enter で決定、Esc・Tab で表に戻る。パッド・マウスを使うと表に戻る。
//     長さ（max）と決定の決まり（空は不可）は表と同じ。差し込みの印になる字（{ } < > \ と制御文字）は入れない。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  // 字の表は言語ごと（src/i18n/<言語>/ui.js の ui.nameentry.*）。日本語は五十音（列ごと、上から ア イ ウ エ オ の段）、
  //   英語などラテン字の言語は A〜Z（行ごとの表を列に並べ直す）。中国語・韓国語（と日本語の漢字）の名前はキーボードの IME で打つ（下の「キーボードで入力」）
  const latin = () => R.I18n.isLatin() || R.I18n.lang() === 'ko' || /^zh/.test(R.I18n.lang());
  /** 行の配列 → 列の配列（ラテン字の表は行で書く方が読みやすい） */
  const cols = (rows) => { const out = []; const w = Math.max(...rows.map((r) => [...r].length)); for (let c = 0; c < w; c++) out.push(rows.map((r) => [...r][c] || ' ').join('')); return out; };
  const gridA = () => (latin() ? cols(R.T('ui.nameentry.latinA')) : R.T('ui.nameentry.kanaA'));
  const gridB = () => (latin() ? cols(R.T('ui.nameentry.latinB')) : R.T('ui.nameentry.kanaB'));
  // カタカナ → ひらがな（ヴは同じ）。ラテン字は大文字 → 小文字
  const hira = (ch) => { if (latin()) return ch.toLowerCase(); const c = ch.charCodeAt(0); return c >= 0x30a1 && c <= 0x30f6 && ch !== '\u30f4' ? String.fromCharCode(c - 0x60) : ch; };   // i18n:ignore（字の処理）

  function cells(tall) {
    const out = [];
    const put = (cols, gx0, gy0) => cols.forEach((col, ci) => [...col].forEach((ch, ri) => { if (ch !== ' ') out.push({ ch, gx: gx0 + ci, gy: gy0 + ri, w: 1 }); }));
    if (tall) {
      const A = gridA(), B = gridB();
      put(A, 0, 0); put(B, 1.5, 5.4);
      out.push({ act: 'kana', gx: 0, gy: 10.8, w: 3.2 }, { act: 'del', gx: 3.4, gy: 10.8, w: 3.2 }, { act: 'ok', gx: 6.8, gy: 10.8, w: 3.2 });
    } else {
      const A = gridA(), B = gridB();
      put(A, 0, 0); put(B, 10.6, 0);
      out.push({ act: 'kana', gx: 0, gy: 5.4, w: 5.6 }, { act: 'del', gx: 5.9, gy: 5.4, w: 5.6 }, { act: 'ok', gx: 11.8, gy: 5.4, w: 5.8 });
    }
    return out;
  }

  // ---------------------------------------------------------------- キーボードで入力（隠した <input>。IME の変換を受ける）
  const hasDom = () => typeof document !== 'undefined' && !!document.body && typeof document.createElement === 'function';
  /** 名前に入れない字を除く（{hero} の差し込みの印・制御文字・改行） */
  const clean = (t) => String(t || '').replace(/[\u0000-\u001f\u007f{}<>\\]/g, '');
  /** 表の操作に割り当てたキー（押しても「キーボードで入力」にしない） */
  function boundCodes() {
    const set = new Set(['Space', 'Enter', 'NumpadEnter', 'Escape', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    try { const kb = R.Input.bindings().kb; for (const k of Object.keys(kb)) for (const c of kb[k] || []) if (c) set.add(c); } catch (e) { /* 割り当てが読めない */ }
    return set;
  }

  S.def('nameentry', {
    opaque: true,
    init(p) {
      // ラテン字の名前は字が細いので 2 倍まで（5 → 10）
      this.max = latin() ? Math.max(p.maxLatin || 0, (p.max || 5) * 2) : p.max || 5;
      this.value = [...String(p.value || '')].slice(0, this.max);
      this.kata = true;
      this.tall = S.tall();
      this.cells = cells(this.tall);
      this.cur = this.cells.findIndex((c) => c.act === (this.value.length ? 'ok' : 'kana'));
      if (!this.value.length) this.cur = 0;
      this.rects = [];
      this.kb = { on: false, comp: '', el: null, bound: boundCodes(), off: [] };
      this.kbSetup();
    },
    /** 隠した <input> と、表の間に字のキーを待つ受け口を作る（ブラウザ・デスクトップ版だけ） */
    kbSetup() {
      if (!hasDom()) return;
      const K = this.kb;
      const el = document.createElement('input');
      el.type = 'text';
      el.setAttribute('autocomplete', 'off'); el.setAttribute('autocorrect', 'off'); el.setAttribute('autocapitalize', 'off'); el.setAttribute('spellcheck', 'false');
      el.setAttribute('aria-label', this.p.title || R.T('ui.nameentry.title'));
      // 見えない（字は画面の枠に描く）が、IME の候補の窓が名前の枠の近くに出るように置く
      Object.assign(el.style, { position: 'fixed', left: '0px', top: '0px', width: '1px', height: '24px', opacity: '0', border: '0', padding: '0', margin: '0', outline: 'none', background: 'transparent', color: 'transparent', caretColor: 'transparent', fontSize: '16px', zIndex: '5', pointerEvents: 'none' });
      document.body.appendChild(el);
      K.el = el;
      const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); K.off.push(() => t.removeEventListener(ev, fn, o)); };
      on(el, 'compositionstart', () => { K.comp = ''; });
      on(el, 'compositionupdate', (e) => { K.comp = clean(e.data); });
      on(el, 'compositionend', () => { K.comp = ''; this.kbSync(); });
      on(el, 'input', (e) => { if (!e.isComposing) this.kbSync(); });
      on(el, 'keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;   // IME の変換中の Enter・Esc は IME のもの
        if (e.key === 'Enter') { e.preventDefault(); this.kbSync(); this.press(this.cells.find((c) => c.act === 'ok')); }
        else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); this.kbOff(); R.UIK.sfx('cancel'); }
      });
      // 入力の中で離したキーは R.Input に届かない（押しっぱなしにならないように離したことだけ伝える）
      on(el, 'keyup', (e) => { if (e.code && R.Input._key) R.Input._key(e.code, false); });
      on(el, 'blur', () => { if (K.on) this.kbOff(true); });
      // 表の間: 割り当てのない字のキー・IME の打ち始め → キーボードで入力（その字はそのまま <input> に入る）
      on(window, 'keydown', (e) => {
        if (K.on || this.closing || this.modal || e.ctrlKey || e.metaKey || e.altKey) return;
        const ime = e.key === 'Process' || e.keyCode === 229;
        const ch = e.key && [...e.key].length === 1 && !K.bound.has(e.code);
        if (ime || ch) this.kbOn();
      }, true);
    },
    kbOn() {
      const K = this.kb;
      if (!K || !K.el || K.on) return;
      K.on = true; K.comp = '';
      K.el.value = this.value.join('');
      this.kbPlace();
      try { K.el.focus({ preventScroll: true }); K.el.setSelectionRange(K.el.value.length, K.el.value.length); } catch (e) { /* 古い環境 */ }
    },
    kbOff(blurred) {
      const K = this.kb;
      if (!K || !K.on) return;
      K.on = false; K.comp = '';
      this.kbSync(true);
      if (!blurred && K.el) try { K.el.blur(); } catch (e) { /* */ }
      this.cur = Math.max(0, this.cells.findIndex((x) => x.act === 'ok'));
    },
    /** <input> の字 → 名前（長さを max で切る） */
    kbSync(noWrite) {
      const K = this.kb;
      if (!K || !K.el) return;
      const v = [...clean(K.el.value)].slice(0, this.max);
      this.value = v;
      if (!noWrite && K.el.value !== v.join('')) K.el.value = v.join('');
    },
    /** IME の候補の窓が名前の枠の横に出るように、<input> を枠の所へ動かす */
    kbPlace() {
      const K = this.kb;
      if (!K || !K.el || !this.box || !R.Gfx || !R.Gfx.canvas || !R.Gfx.canvas.getBoundingClientRect) return;
      const r = R.Gfx.canvas.getBoundingClientRect(), k = r.width / R.W;
      K.el.style.left = Math.round(r.left + this.box.x * k) + 'px';
      K.el.style.top = Math.round(r.top + this.box.y * k) + 'px';
      K.el.style.height = Math.round(this.box.h * k) + 'px';
    },
    exit() {
      const K = this.kb;
      if (!K) return;
      for (const f of K.off) try { f(); } catch (e) { /* */ }
      K.off = [];
      if (K.el && K.el.parentNode) K.el.parentNode.removeChild(K.el);
      K.el = null; K.on = false;
    },
    layout() { const c = this.cells[this.cur]; this.tall = S.tall(); this.cells = cells(this.tall); this.cur = Math.max(0, this.cells.findIndex((x) => (c.act ? x.act === c.act : x.ch === c.ch))); },
    label(c) {
      if (c.act === 'kana') return this.kata ? R.T('ui.nameentry.toHira') : R.T('ui.nameentry.toKata');
      if (c.act === 'del') return R.T('ui.nameentry.del');
      if (c.act === 'ok') return R.T('ui.nameentry.ok');
      return this.kata ? c.ch : hira(c.ch);
    },
    press(c) {
      if (c.act === 'kana') { this.kata = !this.kata; R.UIK.sfx('cursor'); return; }
      if (c.act === 'del') { if (this.value.length) { this.value.pop(); R.UIK.sfx('cancel'); } else R.UIK.sfx('buzzer'); return; }
      if (c.act === 'ok') {
        const s = this.value.join('').trim();
        if (!s) { R.UIK.sfx('buzzer'); return; }
        R.UIK.sfx('confirm'); if (this.kb && this.kb.on) { this.kb.on = false; try { this.kb.el.blur(); } catch (e) { /* */ } } this.close(s); return;
      }
      if (this.value.length >= this.max) { R.UIK.sfx('buzzer'); return; }
      this.value.push(this.label(c)); R.UIK.sfx('cursor');
      if (this.value.length >= this.max) this.cur = this.cells.findIndex((x) => x.act === 'ok');
    },
    move(dx, dy) {
      const c = this.cells[this.cur];
      const cx = c.gx + c.w / 2, cy = c.gy;
      let best = -1, bd = 1e9;
      this.cells.forEach((o, i) => {
        if (i === this.cur) return;
        const ox = o.gx + o.w / 2, oy = o.gy;
        if (dx) {
          if (Math.abs(oy - cy) > 0.3) return;
          const d = (ox - cx) * dx;
          if (d > 0 && d < bd) { bd = d; best = i; }
        } else {
          const d = (oy - cy) * dy;
          if (d <= 0.3) return;
          const score = d * 10 + Math.abs(ox - cx);
          if (score < bd) { bd = score; best = i; }
        }
      });
      if (best < 0) {   // 端から反対の端へ
        this.cells.forEach((o, i) => {
          const ox = o.gx + o.w / 2, oy = o.gy;
          if (dx && Math.abs(oy - cy) <= 0.3) { const d = -(ox - cx) * dx; if (d > 0 && (best < 0 || d > bd)) { bd = d; best = i; } }
          if (dy) { const d = -(oy - cy) * dy; const score = d * 10 - Math.abs(ox - cx); if (d > 0.3 && (best < 0 || score > bd)) { bd = score; best = i; } }
        });
      }
      if (best >= 0) { this.cur = best; R.UIK.sfx('cursor'); }
    },
    update() {
      const I = R.Input;
      if (this.kb && this.kb.on) {
        // キーボードで入力の間: 字は <input> が受ける。パッドを使ったら表に戻る（マウスで押すと <input> が外れて戻る）
        if (I.lastDevice === 'pad') { this.kbOff(); return; }
        this.kbPlace();
        for (let i = 0; i < this.rects.length; i++) if (S.clicked(this.rects[i])) { this.kbOff(); this.cur = i; this.press(this.cells[i]); return; }
        return;
      }
      if (I.pressed('y') && this.kb && this.kb.el && I.lastDevice === 'kb') { this.kbOn(); R.UIK.sfx('cursor'); return; }
      if (I.repeat('left')) this.move(-1, 0);
      else if (I.repeat('right')) this.move(1, 0);
      else if (I.repeat('up')) this.move(0, -1);
      else if (I.repeat('down')) this.move(0, 1);
      for (let i = 0; i < this.rects.length; i++) if (S.clicked(this.rects[i])) { this.cur = i; this.press(this.cells[i]); return; }
      if (I.pressed('x')) { this.kata = !this.kata; R.UIK.sfx('cursor'); }
      if (I.pressed('a')) this.press(this.cells[this.cur]);
      else if (I.pressed('b')) {
        if (this.value.length) { this.value.pop(); R.UIK.sfx('cancel'); } else { R.UIK.sfx('cancel'); this.close(null); }
      }
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const cols = tall ? 10 : 17.6, rows = tall ? 11.8 : 6.4;
      const cell = Math.min((b.w - u(40)) / cols, (b.h - u(170)) / rows, u(tall ? 44 : 46));
      const gw = cell * cols, gh = cell * rows;
      const px = b.x + (b.w - gw) / 2 - u(20);
      const p = { x: px, y: b.y + u(4), w: gw + u(40), h: gh + u(160) };
      R.UIK.panel(g, p, {});
      S.heading(g, this.p.title || R.T('ui.nameentry.title'), p.x + u(24), p.y + u(20), 0, { size: 15, track: 3 });
      // 名前の枠
      const bw = latin() ? u(34) : u(46), bx0 = p.x + (p.w - bw * this.max) / 2, by = p.y + u(58);
      this.box = { x: bx0, y: by, w: bw * this.max, h: u(48) };
      // IME の変換中の字（まだ決まっていない字）は枠の続きに薄く出す
      const comp = this.kb && this.kb.on ? [...this.kb.comp].slice(0, Math.max(0, this.max - this.value.length)) : [];
      const at = this.value.length + comp.length;
      for (let i = 0; i < this.max; i++) {
        const x = bx0 + i * bw;
        const ci = i - this.value.length;
        R.UIK.rule(g, x + u(6), x + bw - u(6), by + u(44), ci >= 0 && ci < comp.length ? 1.5 : 0.5, i === at ? C.gold : ci >= 0 && ci < comp.length ? C.goldHi : undefined);
        if (this.value[i]) R.UIK.text(g, this.value[i], x + bw / 2, by + u(6), { size: u(30), weight: 700, color: C.goldHi, align: 'center' });
        else if (ci >= 0 && ci < comp.length) R.UIK.text(g, comp[ci], x + bw / 2, by + u(6), { size: u(30), weight: 500, color: C.text2 || C.text, align: 'center' });
        else if (i === at && Math.floor(R.Engine.time / 500) % 2 === 0) R.UIK.diamond(g, x + bw / 2, by + u(24), u(4), C.gold);
      }
      if (this.kb && this.kb.on) R.UIK.text(g, R.T('ui.nameentry.kbHint'), p.x + p.w / 2, by + u(52), { size: u(12.5), color: C.gold, align: 'center' });
      R.UIK.text(g, `${this.value.length} / ${this.max}`, p.x + p.w - u(24), by + u(22), { size: u(12.5), color: C.text3, align: 'right' });
      // 表
      const gx = p.x + u(20), gy = p.y + u(126);
      this.rects = [];
      this.cells.forEach((c, i) => {
        const r = { x: gx + c.gx * cell, y: gy + c.gy * cell, w: c.w * cell, h: cell };
        this.rects.push(r);
        const f = i === this.cur;
        if (c.act) {
          const rr = { x: r.x + u(3), y: r.y + u(3), w: r.w - u(6), h: r.h - u(6) };
          R.UIK.card(g, rr, { focused: f });
          R.UIK.text(g, this.label(c), rr.x + rr.w / 2, rr.y + (rr.h - u(15)) / 2 - u(1), { size: u(15), weight: 700, color: c.act === 'ok' ? (f ? C.goldHi : C.gold) : f ? C.goldHi : C.text, align: 'center' });
        } else {
          if (f) R.UIK.focus(g, { x: r.x + u(2), y: r.y + u(2), w: r.w - u(4), h: r.h - u(4) }, R.Engine.time, { cursor: false });
          R.UIK.text(g, this.label(c), r.x + r.w / 2, r.y + (r.h - u(20)) / 2 - u(1), { size: u(20), weight: f ? 700 : 500, color: f ? C.goldHi : C.text, align: 'center' });
        }
      });
      if (this.kb && this.kb.on) return;   // キーボードで入力の間は、ボタンの案内の代わりに枠の横の案内
      const pr = [{ btn: 'a', label: R.T('ui.nameentry.put') }, { btn: 'b', label: this.value.length ? R.T('ui.nameentry.delBack') : R.T('ui.nameentry.back') }, { btn: 'x', label: R.T('ui.nameentry.kanaToggle') }];
      if (this.kb && this.kb.el && R.Input.lastDevice === 'kb') pr.push({ btn: 'y', label: R.T('ui.nameentry.kbToggle') });
      S.prompts(g, pr);
    },
  });
})(window.RPG);
