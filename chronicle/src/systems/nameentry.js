// Name entry: the player names the three heroes at the start of a new game.
// Only hiragana, katakana and ASCII letters/digits are allowed (no kanji).
// Gender, personality and looks are fixed — only the display name changes.
//
//   const names = await R.NameEntry.run();   // {yuki, non, metem} or null (cancelled)
//   R.NameEntry.apply(names);                // write into R.Game.party
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const U = R.U;

  const MAX_LEN = 8; // characters (full-width names are also limited by width)
  const MAX_W = 6 * (32 / 3) + 1; // width of six full-width characters
  const ORDER = ['yuki', 'non', 'metem'];

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
  // command row under the grid
  const CMDS = [
    { id: 'page0', label: 'ひらがな' }, { id: 'page1', label: 'カタカナ' }, { id: 'page2', label: '英数字' },
    { id: 'del', label: '1字消す' }, { id: 'kbd', label: 'キーボード' }, { id: 'ok', label: '決定' },
  ];

  /** allowed: hiragana, katakana (incl. ー ヴ), ASCII letters & digits */
  const VALID = /^[ぁ-ゖァ-ヺーA-Za-z0-9]+$/;
  function normalize(s) {
    // full-width alnum → half-width, half-width kana → full-width, trim spaces
    return String(s || '').normalize('NFKC').replace(/\s+/g, '');
  }
  function check(name) {
    if (!name) return '名前を入力してください。';
    if (!VALID.test(name)) return /[一-鿿㐀-䶿]/.test(name)
      ? '漢字は使えません。ひらがな・カタカナ・英数字で入力してください。'
      : '使えない文字が含まれています。ひらがな・カタカナ・英数字のみ使えます。';
    if (name.length > MAX_LEN || G().textWidth(name) > MAX_W) return '名前が長すぎます。';
    return null;
  }

  // ------------------------------------------------------------ the layer
  class NameLayer extends R.Layer {
    constructor(charId, initial) {
      super();
      this.opaque = true;
      this.id = charId;
      this.name = [...(initial || '')];
      this.page = /^[A-Za-z0-9]+$/.test(initial || '') ? 2 : /[ァ-ヺ]/.test(initial || '') ? 1 : 0;
      this.cx = 0; this.cy = 0; // cursor: cy === ROWS means the command rows
      this.cmd = 0;
      this.msg = '';
      this.msgT = 0;
      this.busy = false;
    }
    get str() { return this.name.join(''); }
    cell(x, y) {
      const row = PAGES[this.page].rows[y] || '';
      const ch = [...row][x];
      return ch && ch !== '　' ? ch : null;
    }
    add(ch) {
      const next = this.str + ch;
      if (this.name.length >= MAX_LEN || G().textWidth(next) > MAX_W) { R.sfx('buzzer'); this.flash('これ以上入力できません。'); return; }
      this.name.push(ch);
      R.sfx('cursor');
      if (this.name.length >= MAX_LEN || G().textWidth(this.str + 'ア') > MAX_W) { this.cy = ROWS; this.cmd = 5; }
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
      const v = await keyboardOverlay(this.str, R.DB.chars[this.id].profile);
      this.busy = false;
      if (v != null) { this.name = [...v]; this.cy = ROWS; this.cmd = 5; }
    }
    tick() { if (this.msgT > 0) this.msgT--; }
    update() {
      if (this.busy) return;
      const d = In().dirRepeat();
      if (d) {
        R.sfx('cursor');
        if (this.cy < ROWS) {
          if (d === 'left') this.cx = (this.cx + COLS - 1) % COLS;
          if (d === 'right') this.cx = (this.cx + 1) % COLS;
          const col3 = U.clamp(Math.floor((this.cx * 3) / COLS), 0, 2);
          if (d === 'up') { if (this.cy === 0) { this.cy = ROWS; this.cmd = 3 + col3; } else this.cy--; }
          if (d === 'down') { this.cy++; if (this.cy === ROWS) this.cmd = col3; }
        } else {
          const row = this.cmd < 3 ? 0 : 1, col = this.cmd % 3;
          if (d === 'left') this.cmd = row * 3 + (col + 2) % 3;
          if (d === 'right') this.cmd = row * 3 + (col + 1) % 3;
          if (d === 'up') { if (row === 1) this.cmd -= 3; else { this.cy = ROWS - 1; } }
          if (d === 'down') { if (row === 0) this.cmd += 3; else { this.cy = 0; } }
        }
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
      const c = CMDS[this.cmd].id;
      if (c.startsWith('page')) { this.page = +c.slice(4); R.sfx('confirm'); }
      else if (c === 'del') { if (!this.del()) R.sfx('buzzer'); }
      else if (c === 'kbd') { R.sfx('confirm'); this.keyboard(); }
      else if (c === 'ok') {
        const err = check(this.str);
        if (err) { R.sfx('buzzer'); this.flash(err); return; }
        R.sfx('confirm');
        this.close({ name: this.str });
      }
    }
    draw() {
      const g = G(), C = g.C;
      g.clear('#000010');
      // header: portrait + profile + name slots
      g.window(4, 2, 248, 54);
      const sheet = R.Gfx.get('party:' + this.id + ':' + R.DB.chars[this.id].startJob);
      const f = sheet && sheet.down ? sheet.down[Math.floor(R.Engine.frame / 24) % 2] : null;
      if (f) g.draw(f, 14, 5, { w: 32, h: 48 });
      g.text(R.DB.chars[this.id].profile, 54, 9, { color: C.cyan });
      g.text('名前', 54, 28);
      const x0 = 84;
      let x = x0;
      for (let i = 0; i < 6; i++) g.rect(x0 + i * 13, 41, 11, 1, C.gray);
      for (const ch of this.name) { g.text(ch, x, 28); x += g.textWidth(ch) + 1; }
      if (this.cy < ROWS || CMDS[this.cmd].id !== 'ok') {
        if (Math.floor(R.Engine.frame / 16) % 2 === 0) g.rect(x + 1, 29, 1, 11, C.white);
      }
      // grid
      g.window(4, 58, 248, 126, { title: PAGES[this.page].label });
      for (let y = 0; y < ROWS; y++) for (let xx = 0; xx < COLS; xx++) {
        const ch = this.cell(xx, y);
        const px = 22 + xx * 22 + (xx >= 5 ? 6 : 0), py = 67 + y * 12.8;
        if (ch) g.text(ch, px, py);
        if (this.cy === y && this.cx === xx) g.cursor(px - 9, py + 1);
      }
      // commands
      g.window(4, 186, 248, 36);
      CMDS.forEach((c, i) => {
        const px = 22 + (i % 3) * 78, py = 192 + Math.floor(i / 3) * 13;
        const on = this.cy === ROWS && this.cmd === i;
        const active = c.id === 'page' + this.page;
        g.text(c.label, px, py, { color: c.id === 'ok' ? C.yellow : active ? C.cyan : C.white });
        if (on) g.cursor(px - 10, py + 1);
      });
      if (this.msgT > 0) {
        const w = Math.min(240, g.textWidth(this.msg) + 16);
        g.window(128 - w / 2, 96, w, 26);
        g.text(this.msg, 128, 103, { align: 'center', color: C.yellow });
      }
    }
  }

  // ------------------------------------------- DOM keyboard / IME overlay
  function keyboardOverlay(initial, profile) {
    return new Promise((resolve) => {
      const cv = document.getElementById('screen');
      const r = cv.getBoundingClientRect();
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: Math.min(r.height, 260) + 'px',
        boxSizing: 'border-box', padding: Math.max(10, r.width * 0.035) + 'px', background: 'rgba(0,0,16,0.95)',
        display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 60, color: '#fff',
        fontFamily: '"DotGothic16", monospace', fontSize: Math.max(14, Math.round(r.width / 26)) + 'px',
        border: '3px solid #fff', borderRadius: '8px',
      });
      const title = document.createElement('div');
      title.textContent = profile + 'の名前';
      title.style.color = '#6fd8ff';
      const hint = document.createElement('div');
      hint.textContent = 'ひらがな・カタカナ・英数字で入力してください（漢字は使えません）';
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
      Object.assign(err.style, { fontSize: '0.75em', color: '#ffe45a', minHeight: '1.3em' });
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
        const e = check(v);
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
      box.append(title, hint, input, err, row);
      document.body.appendChild(box);
      setTimeout(() => { input.focus(); input.select(); }, 30);
    });
  }

  // ------------------------------------------------------------ confirm
  class ConfirmLayer extends R.Layer {
    constructor(names) { super(); this.opaque = true; this.names = names; }
    draw() {
      const g = G();
      g.clear('#000010');
      g.window(28, 6, 200, 96, { title: 'この名前でよろしいですか？' });
      ORDER.forEach((id, i) => {
        const sheet = R.Gfx.get('party:' + id + ':' + R.DB.chars[id].startJob);
        const f = sheet && sheet.down ? sheet.down[Math.floor(R.Engine.frame / 24) % 2] : null;
        const y = 18 + i * 28; // kept above the はい/いいえ window
        if (f) g.draw(f, 46, y);
        g.text(this.names[id], 72, y + 6, { size: 16 });
        g.text(R.DB.chars[id].gender === 'm' ? '♂' : '♀', 200, y + 8, { color: R.DB.chars[id].gender === 'm' ? g.C.cyan : g.C.pink });
      });
    }
  }

  const NameEntry = (R.NameEntry = {
    VALID, check, normalize,
    /** run the three name screens + confirmation. Resolves {yuki,non,metem} or null. */
    async run(initial) {
      const names = Object.assign({}, ...ORDER.map((id) => ({ [id]: R.DB.chars[id].name })), initial || {});
      for (;;) {
        let i = 0;
        while (i < ORDER.length) {
          const id = ORDER[i];
          const r = await R.Engine.run(new NameLayer(id, names[id]));
          if (r && r.back) { if (i === 0) return null; i--; continue; }
          names[id] = r.name;
          i++;
        }
        const conf = new ConfirmLayer(names);
        R.Engine.push(conf);
        const ok = await R.UI.yesno('この名前で冒険を始めますか？');
        R.UI.closeMessage();
        conf.close();
        if (ok) return names;
      }
    },
    /** write names into the live party */
    apply(names) {
      if (!names || !R.Game) return;
      for (const c of R.Game.party) if (names[c.id]) c.name = names[c.id];
    },
  });
})(window.RPG);
