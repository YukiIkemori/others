// Field menu: セーブ (DESIGN §11.7.14: 記録1〜3 + 冒険の合言葉), 設定 (§11.7.15: 12 rows, applied at
// once) and the DOM overlay that shows / takes a 冒険の合言葉 (also used by the title screen).
//   R.Menu.saveScreen(o) / saveMenu(o) → Promise<bool saved>   R.Menu.settings()   R.Menu.codeOverlay({mode, code})
//   R.Menu.drawSlot(i, slot, x, y, w, h, {dim})   R.Menu.SETTINGS (rows)
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});
  const K = () => Menu.kit;

  // ------------------------------------------------------------ slot summaries
  /** 第N章 of a save summary (序章 at tier 0, クリア after the ending) */
  function slotChapter(m) {
    if (m.clear) return 'クリア';
    const t = m.tier != null ? m.tier : 0;
    return t > 0 ? '年代記 第' + t + '章' : '年代記 序章';
  }
  /** one 記録 window (§11.7.14). s: {summary} | null */
  function drawSlot(i, s, x, y, w, h, opts) {
    const o = opts || {};
    const C = G().C;
    G().window(x, y, w, h);
    const dim = !!o.dim;
    G().text('記録' + (i + 1), x + 8, y + 6, { color: dim ? K().COL.gray : C.yellow });
    if (!s) { G().text('――　空き　――', x + w / 2, y + 24, { align: 'center', color: K().COL.gray }); return; }
    const m = s.summary || {};
    const hero = m.hero || (m.names && m.names[0] ? String(m.names[0]).replace(/\s*Lv\d+$/, '') : '');
    K().fitText(hero, x + 48, y + 6, 64, { color: dim ? K().COL.gray : '#ffffff' });
    G().text('Lv' + (m.level || 1), x + 116, y + 6, { color: dim ? K().COL.gray : '#ffffff' });
    G().text(m.time || '', x + w - 8, y + 6, { align: 'right', color: dim ? K().COL.gray : '#ffffff' });
    (m.sprites || []).slice(0, 4).forEach((key, k) => {
      const sx = x + 8 + 18 * k, sy = y + 24;
      let img = null;
      if (key && G().has(key)) {
        const v = G().get(key);
        img = v && v.down ? (Array.isArray(v.down) ? v.down[0] : v.down) : Array.isArray(v) ? v[0] : v;
      }
      if (img) G().draw(img, sx + Math.round((16 - img.width) / 2), sy + 24 - img.height, dim ? { alpha: 0.5 } : null);
      else { G().rect(sx + 5, sy + 3, 6, 6, '#8a90a8'); G().rect(sx + 3, sy + 10, 10, 12, '#5a6080'); }
    });
    K().fitText(m.place || '', x + 90, y + 22, w - 98, { color: dim ? K().COL.gray : C.cyan });
    G().text(m.clear ? 'クリア' + (m.title ? '　' + m.title : '') : slotChapter(m), x + 90, y + 36, { color: dim ? K().COL.gray : m.clear ? C.gold : K().COL.sub });
    if (m.gold != null) G().text(m.gold + 'ゴールド', x + w - 8, y + 36, { align: 'right', color: dim ? K().COL.gray : '#ffffff' });
  }
  Menu.drawSlot = drawSlot;

  // ------------------------------------------------------------ DOM code overlay
  /**
   * The 冒険の合言葉 overlay over the canvas. o: {mode:'export'|'import', code} → Promise(string | null)
   * (import: the text typed in; export / cancel: null). Game input is off while it is open. null in node.
   */
  Menu.codeOverlay = function (o) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') { resolve(null); return; }
      const imp = o && o.mode === 'import';
      const host = document.getElementById('game') || document.body;
      const cv = document.getElementById('screen');
      const r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const box = document.createElement('div');
      box.id = 'code-overlay';
      Object.assign(box.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
        boxSizing: 'border-box', padding: Math.max(8, r.width * 0.035) + 'px', background: 'rgba(11,16,36,0.96)',
        display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 50, color: '#f0e8d0',
        fontFamily: '"DotGothic16", monospace', fontSize: Math.max(13, Math.round(r.width / 26)) + 'px',
        border: '3px solid #f0e8d0', borderRadius: '8px',
      });
      const title = document.createElement('div');
      title.textContent = '冒険の合言葉';
      title.style.color = '#ffe45a';
      const hint = document.createElement('div');
      hint.textContent = imp ? '合言葉の入力：貼り付けて「決定」を押す。' : '「コピー」で写せば、別の端末でも遊べる。';
      hint.style.fontSize = '0.8em';
      hint.style.lineHeight = '1.4';
      const ta = document.createElement('textarea');
      ta.value = (o && o.code) || '';
      ta.readOnly = !imp;
      ta.spellcheck = false;
      ta.setAttribute('autocapitalize', 'off');
      ta.setAttribute('autocomplete', 'off');
      Object.assign(ta.style, {
        flex: '1 1 auto', minHeight: '40px', width: '100%', boxSizing: 'border-box', resize: 'none',
        background: '#16203e', color: '#f0e8d0', border: '2px solid #6a78c0', borderRadius: '4px',
        fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', padding: '6px',
      });
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' });
      const btn = (label, fn, primary) => {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
          font: 'inherit', fontSize: '0.9em', color: '#fff', background: primary ? '#2a3c9a' : '#2a2a3a',
          border: '2px solid #f0e8d0', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', minWidth: '5em',
        });
        b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(b); });
        row.appendChild(b);
        return b;
      };
      const msg = document.createElement('div');
      Object.assign(msg.style, { fontSize: '0.8em', color: '#6ee07a', minHeight: '1.2em' });

      const wasEnabled = R.Input.enabled;
      R.Input.enabled = false;
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey, true);
        box.remove();
        R.Input.enabled = wasEnabled !== false;
        R.Input.consume();
        try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* ignore */ }
        resolve(v);
      };
      // keys typed into the textarea must not reach the game's key handler
      ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); finish(null); } });
      const onKey = (e) => {
        if (e.target === ta) return;
        if (e.key === 'Escape' || e.code === 'KeyX' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); finish(null); }
        else if (!imp && (e.code === 'KeyZ' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); finish(null); }
      };
      document.addEventListener('keydown', onKey, true);

      if (imp) {
        btn('やめる', () => finish(null));
        btn('決定', () => finish(ta.value.trim() || null), true);
      } else {
        btn('コピー', async (b) => {
          let ok = false;
          try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(ta.value); ok = true; } } catch (e) { ok = false; }
          if (!ok) {
            try { ta.focus(); ta.select(); ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; }
          }
          msg.textContent = ok ? 'コピーした。' : '合言葉を選んで、写しておいてください。';
          msg.style.color = ok ? '#6ee07a' : '#ffb03c';
          if (!ok) { ta.focus(); ta.select(); }
          b.blur();
        }, true);
        btn('閉じる', () => finish(null));
      }
      box.appendChild(title); box.appendChild(hint); box.appendChild(ta); box.appendChild(msg); box.appendChild(row);
      host.appendChild(box);
      if (imp) setTimeout(() => { try { ta.focus(); } catch (e) { /* ignore */ } }, 50);
    });
  };

  /** export the current game as a 冒険の合言葉 and show it */
  Menu.showCode = async function () {
    let code = null;
    try { code = await R.Save.exportCode(R.State.serialize()); } catch (e) { console.error(e); }
    if (!code) { R.sfx('buzzer'); await K().msg('合言葉を作れなかった。'); return; }
    await Menu.codeOverlay({ mode: 'export', code });
  };

  let C = null;
  const cls = () => C || (C = build());
  /** save screen (menu セーブ, events, the ending). → true if saved */
  Menu.saveScreen = (o) => R.Engine.run(new (cls().SaveScreen)(o || {}));
  Menu.saveMenu = Menu.saveScreen; // the name events_runtime uses (ev.saveMenu)
  /** settings screen (field menu & title) */
  Menu.settings = () => R.Engine.run(new (cls().SettingsScreen)());

  // ------------------------------------------------------------ settings rows (§11.7.15, STYLE_JA §8)
  const onOff = [true, false];
  const SETTINGS = [
    { key: 'msgSpeed', label: 'メッセージ速度', values: [0, 1, 2, 3], names: ['遅い', 'ふつう', '速い', '一瞬'], desc: 'メッセージが出る速さを選ぶ。' },
    { key: 'battleSpeed', label: '戦闘速度', values: [0, 1, 2], names: ['ふつう', '速い', 'とても速い'], desc: '戦闘の演出の速さを選ぶ。' },
    { key: 'bgmVolume', label: 'BGM', vol: true, desc: '音楽の大きさ。←→で変える。' },
    { key: 'sfxVolume', label: '効果音', vol: true, desc: '効果音の大きさ。←→で変える。' },
    { key: 'alwaysDash', label: '常にダッシュ', values: onOff, names: ['する', 'しない'], desc: 'するなら、Bを押している間だけ歩く。' },
    { key: 'fieldZoom', label: 'フィールドの広さ', values: ['normal', 'wide', 'wider'], names: ['ふつう', 'ひろい', 'もっとひろい'], desc: 'マップに映す広さ。すぐに変わる。' },
    { key: 'windowColor', label: 'ウインドウの色', values: ['ink', 'black', 'blue', 'green', 'red'], names: ['紺', '黒', '青', '緑', '赤'], desc: 'ウインドウの色を変える。' },
    { key: 'touchPad', label: 'タッチパッド', values: ['auto', 'on', 'off'], names: ['自動', '出す', '出さない'], desc: '画面のボタンを出すかどうか。' },
    { key: 'padConfirm', label: '決定ボタン', values: ['right', 'bottom'], names: ['右', '下'], desc: 'パッドの決定ボタンの位置。' },
    { key: 'autoKeep', label: 'オート継続', values: onOff, names: ['する', 'しない'], desc: '次の戦闘もオートで始める（ボス戦は手動）' },
    { key: 'cursorMemory', label: 'カーソル記憶', values: onOff, names: ['する', 'しない'], desc: '戦闘のコマンドの位置を覚えておく。' },
  ];
  Menu.SETTINGS = SETTINGS;

  function applySetting(key) {
    const S = R.Settings;
    if ((key === 'bgmVolume' || key === 'sfxVolume') && R.Audio && R.Audio.setVolumes) {
      try { R.Audio.setVolumes(S.bgmVolume, S.sfxVolume); } catch (e) { console.error(e); }
    }
    if (key === 'touchPad' && R.applyTouchSetting) { try { R.applyTouchSetting(); } catch (e) { console.error(e); } }
    if (key === 'fieldZoom' && R.Field && typeof R.Field.view === 'function') { try { R.Field.view(); } catch (e) { /* the field redraws itself */ } }
    if (R.Save && R.Save.saveSettings) R.Save.saveSettings();
  }
  Menu.applySetting = applySetting;

  function build() {
    const Kt = K();

    // ============================================================ セーブ
    class SaveScreen extends Kt.Screen {
      constructor(o) {
        super();
        this.o = o;
        this.slots = null;
        this.index = R.Save.lastSlot || 0;
        if (this.index >= 3) this.index = 0;
        this.flow(() => this.load());
      }
      async load() { this.slots = await R.Save.list(); }
      get count() { return this.o.noCode ? 3 : 4; }
      input() {
        if (!this.slots) return;
        const d = In().dirRepeat();
        if (d === 'up' || d === 'down') { this.index = (this.index + (d === 'up' ? this.count - 1 : 1)) % this.count; R.sfx('cursor'); }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(this.saved || false); return; }
        if (In().pressed('a')) { R.sfx('confirm'); this.flow(() => (this.index === 3 ? Menu.showCode() : this.save(this.index))); }
      }
      async save(i) {
        const n = i + 1;
        if (this.slots[i] && !(await Kt.yesno('記録' + n + 'に上書きしますか？'))) return;
        let ok = false;
        try { ok = await R.Save.save(i, R.State.serialize()); } catch (e) { console.error(e); }
        if (!ok) { R.sfx('buzzer'); await Kt.msg('記録に失敗した。'); return; }
        this.saved = true;
        await this.load();
        R.jingle('save');
        await Kt.say('記録' + n + 'に書き記した。');
        this.close(true);
      }
      render() {
        for (let i = 0; i < 3; i++) {
          const y = 4 + 58 * i;
          drawSlot(i, this.slots ? this.slots[i] : null, 4, y, 248, 56);
          if (this.index === i) G().cursor(0, y + 7, !this.busy);
        }
        if (!this.slots) G().text('読み込んでいる……', 128, 30, { align: 'center', color: Kt.COL.gray });
        if (!this.o.noCode) {
          G().window(4, 178, 248, 20);
          G().text('冒険の合言葉を見る', 20, 182, { color: G().C.cyan });
          if (this.index === 3) G().cursor(8, 183, !this.busy);
        }
        G().window(4, 200, 248, 20);
        G().text(this.index === 3 ? '今の冒険を、文字の合言葉にして写しておく。' : 'どの記録に書き記しますか？', 14, 204, { color: Kt.COL.sub, size: 8 });
      }
    }

    // ============================================================ 設定
    const LH = 14;
    class SettingsScreen extends Kt.Screen {
      constructor() {
        super();
        this.index = 0;
        this.n = SETTINGS.length + 1; // + 戻る
      }
      input() {
        const d = In().dirRepeat();
        if (d === 'up' || d === 'down') { this.index = (this.index + (d === 'up' ? this.n - 1 : 1)) % this.n; R.sfx('cursor'); }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); return; }
        if (this.index === SETTINGS.length) { if (In().pressed('a')) { R.sfx('confirm'); this.close(); } return; }
        const s = SETTINGS[this.index];
        let step = 0;
        if (d === 'left') step = -1;
        if (d === 'right' || (In().pressed('a') && !s.vol)) step = 1; // A never touches a volume bar (no wrap to silence)
        if (!step) return;
        const S = R.Settings;
        if (s.vol) {
          const v = Math.round((S[s.key] || 0) * 10);
          const nv = Math.max(0, Math.min(10, v + step));
          if (nv === v) { R.sfx('buzzer'); return; }
          S[s.key] = nv / 10;
        } else {
          let k = s.values.indexOf(S[s.key]);
          if (k < 0) k = 0;
          k = (k + step + s.values.length) % s.values.length;
          S[s.key] = s.values[k];
        }
        applySetting(s.key);
        R.sfx('cursor');
      }
      render() {
        const S = R.Settings;
        const h = 12 * LH + 16; // 184
        G().window(4, 4, 248, h, { title: '設定' });
        SETTINGS.forEach((s, i) => {
          const y = 12 + i * LH;
          const sel = i === this.index;
          G().text(s.label, 20, y, { color: sel ? '#ffffff' : Kt.COL.sub });
          if (s.vol) {
            const v = Math.round((S[s.key] || 0) * 10);
            for (let k = 0; k < 10; k++) G().rect(160 + k * 7, y + 3, 5, 7, k < v ? (sel ? G().C.yellow : '#c0c0d0') : '#2a3050');
          } else {
            const k = Math.max(0, s.values.indexOf(S[s.key]));
            Kt.fitText(s.names[k], 196, y, 70, { align: 'center', color: sel ? G().C.yellow : '#ffffff' });
            if (sel) {
              G().text('◀', 150, y, { color: Kt.COL.gray });
              G().text('▶', 242, y, { align: 'right', color: Kt.COL.gray });
            }
          }
          if (sel) G().cursor(8, y + 1, !this.busy);
        });
        const by = 12 + SETTINGS.length * LH;
        G().text('戻る', 20, by, { color: G().C.cyan });
        if (this.index === SETTINGS.length) G().cursor(8, by + 1, !this.busy);
        G().window(4, h + 6, 248, 224 - h - 10);
        const s = SETTINGS[this.index];
        Kt.fitText(s ? s.desc : '設定を終えて戻る。', 14, h + 12, 228);
      }
    }
    return { SaveScreen, SettingsScreen };
  }
})(window.RPG);
