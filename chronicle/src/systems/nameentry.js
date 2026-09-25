// 名前入力（担当 newgame A6。DESIGN §5.2.6・§11.8.3）。
// 主人公 1 人の名前を、五十音表（ひらがな・カタカナ・英数字）か DOM のキーボードで入れる。
// 1〜5 文字（全角も半角も 1 文字）。漢字・空白・記号は使えない。
//
//   const name = await R.NameEntry.run({initial, max:5, spriteKey, title, gender, step});   // 名前 | null（B で前の段へ）
//   R.NameEntry.check(name, max) → null | 理由の文     R.NameEntry.normalize(s)     R.NameEntry.VALID
//   R.NameEntry.omakase(gender, current) → 次の「おまかせ」の名前（DB.starterKit.heroNames。8 つで一巡）
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const U = R.U;

  const MAX = 5;
  const HIRA = [
    'あいうえおがぎぐげご',
    'かきくけこざじずぜぞ',
    'さしすせそだぢづでど',
    'たちつてとばびぶべぼ',
    'なにぬねのぱぴぷぺぽ',
    'はひふへほぁぃぅぇぉ',
    'まみむめもっゃゅょゎ',
    'やゆよわをんゔー　　',
    'らりるれろ　　　　　',
  ];
  const toKata = (s) => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const KATA = HIRA.map(toKata);
  const ALNUM = [
    'ABCDEFGHIJ',
    'KLMNOPQRST',
    'UVWXYZ　　　　',
    'abcdefghij',
    'klmnopqrst',
    'uvwxyz　　　　',
    '0123456789',
    '　　　　　　　　　　',
    '　　　　　　　　　　',
  ];
  const PAGES = [
    { label: 'ひらがな', rows: HIRA },
    { label: 'カタカナ', rows: KATA },
    { label: '英数字', rows: ALNUM },
  ];
  const COLS = 10, ROWS = 9;
  // 下のコマンド: 2 行 × 4 列（4 つ目の 2 行目は空き）
  const CMDS = [
    [{ id: 'page0', label: 'ひらがな' }, { id: 'page1', label: 'カタカナ' }, { id: 'page2', label: '英数字' }, { id: 'auto', label: 'おまかせ' }],
    [{ id: 'del', label: '1字消す' }, { id: 'kbd', label: 'キーボード' }, { id: 'ok', label: '決定' }, null],
  ];
  const CMD_XS = [20, 80, 146, 200]; // 60 apart, nudged so the ▶ never touches キーボード
  const CMD_X = (c) => CMD_XS[c], CMD_Y = (r) => 192 + 14 * r;
  const CELL_X = (c) => 22 + 22 * c + (c >= 5 ? 6 : 0), CELL_Y = (r) => 67 + 12.8 * r;

  /** 使える字: ひらがな・カタカナ（ー ヴ を含む）・半角の英数字 */
  const VALID = /^[ぁ-ゖァ-ヺーA-Za-z0-9]+$/;
  /** 全角の英数字 → 半角、半角カナ → 全角（NFKC）、空白を取る */
  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFKC').replace(/\s+/g, '');
  }
  const len = (s) => [...String(s || '')].length;
  function check(name, max) {
    const m = max || MAX;
    if (!name) return '名前を入れてください。';
    if (!VALID.test(name)) {
      return /[一-鿿㐀-䶿々]/.test(name)
        ? '漢字は使えません。\nひらがな・カタカナ・英数字だけです。'
        : '使えない字があります。\nひらがな・カタカナ・英数字だけ使えます。';
    }
    if (len(name) > m) return '名前は' + m + '文字までです。';
    return null;
  }
  /** 「おまかせ」: その性別の候補を順に（今の名前が候補にあれば次の名前、無ければ最初） */
  function omakase(gender, current) {
    const kit = R.DB.starterKit || {};
    const list = (kit.heroNames && (kit.heroNames[gender] || kit.heroNames.m)) || [];
    if (!list.length) return current || '';
    const i = list.indexOf(current);
    return list[(i + 1) % list.length];
  }
  const genderOf = (o) => o.gender || (/hero_f_/.test(o.spriteKey || '') ? 'f' : 'm');

  // ------------------------------------------------------------ the layer
  class NameLayer extends R.Layer {
    constructor(o) {
      super();
      this.opaque = true;
      this.o = o;
      this.max = o.max || MAX;
      this.gender = genderOf(o);
      this.name = [...normalize(o.initial || '')].slice(0, this.max);
      const s = this.name.join('');
      this.page = /^[A-Za-z0-9]+$/.test(s) ? 2 : /[ァ-ヺ]/.test(s) || !s ? 1 : 0;
      this.cx = 0; this.cy = 0; // cy === ROWS: the command rows
      this.cr = 0; this.cc = 0; // command row / column
      if (this.name.length >= this.max) this.toOk();
      this.msg = ''; this.msgT = 0;
      this.busy = false;
    }
    get str() { return this.name.join(''); }
    toOk() { this.cy = ROWS; this.cr = 1; this.cc = 2; }
    cell(x, y) {
      const row = PAGES[this.page].rows[y] || '';
      const ch = [...row][x];
      return ch && ch !== '　' ? ch : null;
    }
    add(ch) {
      if (this.name.length >= this.max) { R.sfx('buzzer'); this.flash('名前は' + this.max + '文字までです。'); return; }
      this.name.push(ch);
      R.sfx('cursor');
      if (this.name.length >= this.max) this.toOk();
    }
    del() {
      if (!this.name.length) return false;
      this.name.pop();
      R.sfx('cancel');
      return true;
    }
    flash(t) { this.msg = t; this.msgT = 150; }
    async keyboard() {
      this.busy = true;
      const v = await keyboardOverlay(this.str, this.o.title || '名前の入力', this.max);
      this.busy = false;
      if (v != null) {
        this.name = [...v];
        this.page = /^[A-Za-z0-9]+$/.test(v) ? 2 : /[ァ-ヺ]/.test(v) ? 1 : 0;
        this.toOk();
      }
    }
    tick() { if (this.msgT > 0) this.msgT--; }
    moveCmd(d) {
      if (d === 'left' || d === 'right') {
        const step = d === 'left' ? 3 : 1;
        do { this.cc = (this.cc + step) % 4; } while (!CMDS[this.cr][this.cc]);
      } else if (d === 'up') {
        if (this.cr === 1) this.cr = 0;
        else { this.cy = ROWS - 1; this.cx = U.clamp(Math.round(this.cc * (COLS - 1) / 3), 0, COLS - 1); }
      } else if (d === 'down') {
        if (this.cr === 0 && CMDS[1][this.cc]) this.cr = 1;
        else if (this.cr === 0) this.cr = 1, this.cc = 2;
        else { this.cy = 0; this.cx = U.clamp(Math.round(this.cc * (COLS - 1) / 3), 0, COLS - 1); }
      }
    }
    update() {
      if (this.busy || this.closed) return;
      const d = In().dirRepeat();
      if (d) {
        R.sfx('cursor');
        if (this.cy < ROWS) {
          const col4 = U.clamp(Math.floor((this.cx * 4) / COLS), 0, 3);
          if (d === 'left') this.cx = (this.cx + COLS - 1) % COLS;
          if (d === 'right') this.cx = (this.cx + 1) % COLS;
          if (d === 'up') { if (this.cy === 0) { this.cy = ROWS; this.cr = 1; this.cc = CMDS[1][col4] ? col4 : 2; } else this.cy--; }
          if (d === 'down') { this.cy++; if (this.cy === ROWS) { this.cr = 0; this.cc = col4; } }
        } else this.moveCmd(d);
        return;
      }
      if (In().pressed('b')) {
        if (!this.del()) { R.sfx('cancel'); this.close({ back: true }); }
        return;
      }
      if (!In().pressed('a')) return;
      if (this.cy < ROWS) {
        const ch = this.cell(this.cx, this.cy);
        if (ch) this.add(ch); else R.sfx('buzzer');
        return;
      }
      const c = CMDS[this.cr][this.cc];
      if (!c) return;
      if (c.id.startsWith('page')) { this.page = +c.id.slice(4); R.sfx('confirm'); }
      else if (c.id === 'auto') {
        this.name = [...omakase(this.gender, this.str)].slice(0, this.max);
        this.page = 1;
        R.sfx('confirm');
      } else if (c.id === 'del') { if (!this.del()) R.sfx('buzzer'); }
      else if (c.id === 'kbd') { R.sfx('confirm'); this.keyboard(); }
      else if (c.id === 'ok') {
        const err = check(this.str, this.max);
        if (err) { R.sfx('buzzer'); this.flash(err); return; }
        R.sfx('confirm');
        this.close({ name: this.str });
      }
    }
    draw() {
      const g = G(), C = g.C, f = R.Engine.frame;
      g.clear('#05060f');
      // header: portrait (×2), title, five name slots, remaining count
      g.window(4, 2, 248, 54);
      const sheet = this.o.spriteKey && R.Gfx.has(this.o.spriteKey) ? R.Gfx.get(this.o.spriteKey) : null;
      const fr = sheet && sheet.down ? sheet.down[Math.floor(f / 16) % 2] : null;
      if (fr) g.draw(fr, 12, 5, { w: 32, h: 48 });
      else silhouette(12, 5);
      g.text(this.o.title || '名前を入れてください', 52, 8, { color: C.cyan });
      if (this.o.step) g.text(this.o.step, 244, 8, { align: 'right', color: '#c8c8d8' });
      const n = this.name.length;
      for (let k = 0; k < this.max; k++) {
        const x = 52 + 14 * k;
        g.rect(x, 39, 10, 1, k < n ? '#f0e8d0' : '#6c7090');
        if (k < n) g.text(this.name[k], x + 5, 26, { align: 'center' });
      }
      const onOk = this.cy === ROWS && CMDS[this.cr][this.cc] && CMDS[this.cr][this.cc].id === 'ok';
      if (n < this.max && Math.floor(f / 16) % 2 === 0) {
        const x = 52 + 14 * n + 2;
        for (let i = 0; i < 3; i++) g.rect(x + i, 21 + i, 7 - i * 2, 1, onOk ? C.gray : C.yellow);
      }
      g.text('あと' + (this.max - n) + '字', 244, 38, { align: 'right', color: '#c8c8d8' });
      // character grid (Crest 10 × 9)
      g.window(4, 58, 248, 126, { title: PAGES[this.page].label });
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const ch = this.cell(x, y);
        const px = CELL_X(x), py = CELL_Y(y);
        if (ch) g.text(ch, px, py);
        if (this.cy === y && this.cx === x) g.cursor(px - 9, py + 1);
      }
      // commands: 2 rows × 4 columns
      g.window(4, 186, 248, 36);
      CMDS.forEach((row, r) => row.forEach((c, col) => {
        if (!c) return;
        const px = CMD_X(col), py = CMD_Y(r);
        const active = c.id === 'page' + this.page;
        g.text(c.label, px, py, { color: c.id === 'ok' ? C.yellow : active ? C.cyan : C.white });
        if (this.cy === ROWS && this.cr === r && this.cc === col) g.cursor(px - 10, py + 1);
      }));
      if (this.msgT > 0) {
        const lines = this.msg.split('\n');
        const w = Math.min(240, Math.ceil(Math.max(...lines.map((l) => g.textWidth(l)))) + 24);
        const h = 12 + lines.length * 14;
        g.window(128 - w / 2, 110 - h / 2, w, h);
        lines.forEach((l, i) => g.text(l, 128, 110 - h / 2 + 7 + i * 14, { align: 'center', color: C.yellow }));
      }
    }
  }
  /** grey stand-in figure while the hero's sprite is not registered */
  function silhouette(x, y) {
    const g = G();
    g.rect(x + 10, y + 4, 12, 12, '#3a3e5c');
    g.rect(x + 8, y + 18, 16, 20, '#3a3e5c');
    g.rect(x + 9, y + 38, 6, 8, '#3a3e5c'); g.rect(x + 17, y + 38, 6, 8, '#3a3e5c');
  }

  // ------------------------------------------- DOM keyboard / IME overlay
  function keyboardOverlay(initial, title, max) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') { resolve(null); return; }
      const cv = document.getElementById('screen');
      const r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: 260 };
      const box = document.createElement('div');
      box.id = 'name-overlay';
      Object.assign(box.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: Math.min(r.height, Math.max(220, r.width * 0.3)) + 'px',
        boxSizing: 'border-box', padding: Math.max(10, r.width * 0.035) + 'px', background: 'rgba(11,16,36,0.97)',
        display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 60, color: '#fff',
        fontFamily: '"DotGothic16", monospace', fontSize: Math.max(14, Math.round(r.width / 26)) + 'px',
        border: '3px solid #f0e8d0', borderRadius: '8px',
      });
      const head = document.createElement('div');
      head.textContent = title;
      head.style.color = '#6fd8ff';
      const hint = document.createElement('div');
      hint.textContent = 'ひらがな・カタカナ・英数字で1〜' + max + '文字（漢字は使えません）';
      hint.style.fontSize = '0.75em';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = initial || '';
      input.maxLength = 16;
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      input.spellcheck = false;
      Object.assign(input.style, {
        font: 'inherit', fontSize: '1.2em', padding: '6px 8px', background: '#10142c', color: '#fff',
        border: '2px solid #6a78c0', borderRadius: '4px', width: '100%', boxSizing: 'border-box',
      });
      const err = document.createElement('div');
      Object.assign(err.style, { fontSize: '0.75em', color: '#ffe45a', minHeight: '1.3em', whiteSpace: 'pre-line' });
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });
      const btn = (label, fn, primary) => {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
          font: 'inherit', fontSize: '0.9em', color: '#fff', background: primary ? '#2a3c9a' : '#2a2a3a',
          border: '2px solid #fff', borderRadius: '6px', padding: '6px 16px', cursor: 'pointer',
        });
        b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
        row.appendChild(b);
      };
      const wasEnabled = R.Input.enabled;
      R.Input.enabled = false;
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        box.remove();
        R.Input.enabled = wasEnabled;
        R.Input.consume();
        resolve(v);
      };
      const submit = () => {
        const v = normalize(input.value);
        const e = check(v, max);
        if (e) { err.textContent = e; input.focus(); return; }
        finish(v);
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); }
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      });
      btn('やめる', () => finish(null));
      btn('決定', submit, true);
      box.append(head, hint, input, err, row);
      document.body.appendChild(box);
      R.Engine.wait(2).then(() => { input.focus(); input.select(); });
    });
  }

  R.NameEntry = {
    MAX, VALID, PAGES, CMDS, check, normalize, omakase,
    /**
     * o: {initial, max = 5, spriteKey, title, gender, step ('4/5' at the top right)}. Resolves the name, or null when B is pressed on an
     * empty name (the caller goes back one step).
     */
    async run(o) {
      const opts = Object.assign({ max: MAX }, typeof o === 'string' ? { initial: o } : o || {});
      const r = await R.Engine.run(new NameLayer(opts));
      return r && r.name ? r.name : null;
    },
    _Layer: NameLayer,
  };
})(window.RPG);
