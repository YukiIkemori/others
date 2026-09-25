// Field menu: セーブ (3 slots + 復活の呪文 export), 設定 (all settings,
// applied immediately) and the DOM overlay used to show / enter a 呪文 code
// (also used by the title screen).
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  // ------------------------------------------------------------ slot summaries
  /** draw one save slot window. s: {summary}|null */
  function drawSlot(i, s, x, y, w, h, opts) {
    const o = opts || {};
    G().window(x, y, w, h);
    const dim = o.dim;
    G().text('冒険の書' + (i + 1), x + 16, y + 7, { color: dim ? G().C.gray : G().C.yellow });
    if (!s) { G().text('―― データなし ――', x + w / 2, y + 25, { align: 'center', color: G().C.dark }); return; }
    const m = s.summary || {};
    G().text(m.time || '', x + w - 10, y + 7, { align: 'right', color: dim ? G().C.gray : G().C.white });
    // cleared games show a star, and the post-game 称号 when earned
    if (m.title || m.clear) G().text('★' + (m.title || 'クリア'), x + 80, y + 7, { color: dim ? G().C.gray : G().C.gold });
    Menu.kit.fitText((m.names || []).join('  '), x + 16, y + 21, w - 26, { color: dim ? G().C.gray : G().C.white });
    G().text(m.place || '', x + 16, y + 35, { color: dim ? G().C.gray : G().C.cyan });
    if (m.gold != null) G().text(m.gold + ' G', x + w - 10, y + 35, { align: 'right', color: dim ? G().C.gray : G().C.white });
  }
  Menu.drawSlot = drawSlot;

  // ------------------------------------------------------------ DOM code overlay
  /**
   * Show the 復活の呪文 overlay over the canvas.
   * o: {mode:'export'|'import', code}  → Promise(code string | null)
   */
  Menu.codeOverlay = function (o) {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') { resolve(null); return; }
      const imp = o.mode === 'import';
      const host = document.getElementById('game') || document.body;
      const cv = document.getElementById('screen');
      const r = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      const box = document.createElement('div');
      box.id = 'code-overlay';
      Object.assign(box.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
        boxSizing: 'border-box', padding: Math.max(8, r.width * 0.035) + 'px', background: 'rgba(0,0,12,0.93)',
        display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 50, color: '#fff',
        fontFamily: '"DotGothic16", monospace', fontSize: Math.max(13, Math.round(r.width / 26)) + 'px',
        border: '3px solid #fff', borderRadius: '8px',
      });
      const title = document.createElement('div');
      title.textContent = '復活の呪文';
      title.style.color = '#ffe45a';
      const hint = document.createElement('div');
      hint.textContent = imp ? '呪文を貼り付けて「決定」を押してください。' : '「コピー」で呪文を保存しておけば、別の端末でも続きから遊べます。';
      hint.style.fontSize = '0.8em';
      hint.style.lineHeight = '1.4';
      const ta = document.createElement('textarea');
      ta.value = o.code || '';
      ta.readOnly = !imp;
      ta.spellcheck = false;
      ta.setAttribute('autocapitalize', 'off');
      ta.setAttribute('autocomplete', 'off');
      Object.assign(ta.style, {
        flex: '1 1 auto', minHeight: '40px', width: '100%', boxSizing: 'border-box', resize: 'none',
        background: '#10142c', color: '#e8ecff', border: '2px solid #6a78c0', borderRadius: '4px',
        fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', padding: '6px',
      });
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' });
      const btn = (label, fn, primary) => {
        const b = document.createElement('button');
        b.textContent = label;
        Object.assign(b.style, {
          font: 'inherit', fontSize: '0.9em', color: '#fff', background: primary ? '#2a3c9a' : '#2a2a3a',
          border: '2px solid #fff', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', minWidth: '5em',
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
        R.Input.enabled = wasEnabled;
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
          msg.textContent = ok ? 'コピーしました。' : '呪文を選択してコピーしてください。';
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

  /** export the current game as a code and show it */
  Menu.showCode = async function () {
    let code = null;
    try { code = await R.Save.exportCode(R.State.serialize()); } catch (e) { console.error(e); }
    if (!code) { await Menu.kit.msg('呪文を作れなかった……。'); return; }
    await Menu.codeOverlay({ mode: 'export', code });
  };

  let C = null;
  const cls = () => C || (C = build());
  /** save screen (menu セーブ, church お祈り, events). → true if saved */
  Menu.saveScreen = (o) => R.Engine.run(new (cls().SaveScreen)(o || {}));
  Menu.saveMenu = Menu.saveScreen; // name used by events_runtime (ev.saveMenu)
  /** settings screen (field menu & title) */
  Menu.settings = () => R.Engine.run(new (cls().SettingsScreen)());

  // ------------------------------------------------------------ settings rows
  const SETTINGS = [
    { key: 'msgSpeed', label: 'メッセージ速度', values: [0, 1, 2, 3], names: ['遅い', '普通', '速い', '瞬間'], desc: 'メッセージが表示される速さを選びます。' },
    { key: 'battleSpeed', label: '戦闘速度', values: [0, 1, 2], names: ['普通', '速い', '最速'], desc: '戦闘演出の速さを選びます。' },
    { key: 'bgmVolume', label: 'BGMの音量', vol: true, desc: '音楽の音量を調節します。' },
    { key: 'sfxVolume', label: '効果音の音量', vol: true, desc: '効果音の音量を調節します。' },
    { key: 'alwaysDash', label: '常にダッシュ', values: [true, false], names: ['オン', 'オフ'], desc: 'オンにすると常に走って移動します。\n（Shiftキーを押している間は逆になります）' },
    { key: 'windowColor', label: 'ウインドウの色', values: ['black', 'blue', 'green', 'red'], names: ['黒', '青', '緑', '赤'], desc: 'ウインドウの色を変えます。' },
    { key: 'touchPad', label: 'タッチパッド', values: ['auto', 'on', 'off'], names: ['自動', '表示', '隠す'], desc: '画面上のボタンを表示するか選びます。' },
    { key: 'padConfirm', label: '決定ボタン', values: ['right', 'bottom'], names: ['右', '下'], desc: 'パッドの決定ボタン。右＝○／任天堂のA、\n下＝×／XboxのA。反対側がキャンセルです。' },
    { key: 'autoKeep', label: 'オート継続', values: [true, false], names: ['する', 'しない'], desc: 'オート戦闘を次の戦闘にも引き継ぎます。\nボス戦・イベント戦闘は手動で始まります。' },
    { key: 'cursorMemory', label: 'カーソル記憶', values: [true, false], names: ['オン', 'オフ'], desc: '戦闘で前回選んだコマンドを記憶します。' },
  ];

  function applySetting(key) {
    const S = R.Settings;
    if ((key === 'bgmVolume' || key === 'sfxVolume') && R.Audio && R.Audio.setVolumes) {
      try { R.Audio.setVolumes(S.bgmVolume, S.sfxVolume); } catch (e) { console.error(e); }
    }
    if (key === 'touchPad' && R.applyTouchSetting) { try { R.applyTouchSetting(); } catch (e) { console.error(e); } }
    if (R.Save && R.Save.saveSettings) R.Save.saveSettings();
  }

  function build() {
    const K = Menu.kit;

    // ============================================================ セーブ
    class SaveScreen extends K.Screen {
      constructor(o) {
        super();
        this.o = o;
        this.slots = null;
        this.index = R.Save.lastSlot || 0;
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
        if (this.slots[i] && !(await K.yesno('冒険の書' + n + 'に上書きしますか？'))) return;
        let ok = false;
        try { ok = await R.Save.save(i, R.State.serialize()); } catch (e) { console.error(e); }
        if (!ok) { R.sfx('buzzer'); await K.msg('記録に失敗しました。'); return; }
        this.saved = true;
        await this.load();
        R.jingle('save'); // plays on after the screen closes — input is not held hostage by the jingle
        await K.say('冒険の書' + n + 'に記録しました。');
        this.close(true);
      }
      render() {
        const ys = [4, 62, 120];
        for (let i = 0; i < 3; i++) {
          drawSlot(i, this.slots ? this.slots[i] : null, 4, ys[i], 248, 56);
          if (this.index === i) G().cursor(10, ys[i] + 8, !this.busy);
        }
        if (!this.slots) G().text('読み込み中…', 128, 30, { align: 'center', color: G().C.gray });
        if (!this.o.noCode) {
          G().window(4, 178, 248, 26);
          G().text('復活の呪文を見る', 20, 185, { color: G().C.cyan });
          if (this.index === 3) G().cursor(10, 186, !this.busy);
        }
      }
    }

    // ============================================================ 設定
    class SettingsScreen extends K.Screen {
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
        if (d === 'right' || (In().pressed('a') && !s.vol)) step = 1; // A never touches a volume bar (no wrap to mute)
        if (!step) return;
        const S = R.Settings;
        if (s.vol) {
          const v = Math.round((S[s.key] || 0) * 10);
          const nv = Math.max(0, Math.min(10, v + step));
          if (nv === v) return;
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
        // row pitch shrinks (16 → 14) once the list is long enough that the
        // description window below would drop under two lines
        const LH = Math.max(14, Math.min(16, Math.floor(154 / (SETTINGS.length + 1))));
        const h = 16 + (SETTINGS.length + 1) * LH - 4;
        G().window(4, 4, 248, h, { title: '設定' });
        SETTINGS.forEach((s, i) => {
          const y = 14 + i * LH;
          const sel = i === this.index;
          G().text(s.label, 20, y, { color: sel ? G().C.white : '#c8c8d8' });
          const vx = 196;
          if (s.vol) {
            const v = Math.round((S[s.key] || 0) * 10);
            for (let k = 0; k < 10; k++) G().rect(158 + k * 7, y + 3, 5, 7, k < v ? (sel ? '#ffe45a' : '#c0c0d0') : '#303044');
          } else {
            const k = Math.max(0, s.values.indexOf(S[s.key]));
            G().text(s.names[k], vx, y, { align: 'center', color: sel ? G().C.yellow : G().C.white });
          }
          if (sel && !s.vol) K.lrArrows(vx - 34, vx + 33, y + 2);
          if (sel) G().cursor(8, y + 1, !this.busy);
        });
        const by = 14 + SETTINGS.length * LH;
        G().text('戻る', 20, by, { color: G().C.cyan });
        if (this.index === SETTINGS.length) G().cursor(8, by + 1, !this.busy);
        // description + window colour preview (only as many lines as the window holds)
        const s = SETTINGS[this.index];
        const dh = 224 - h - 12;
        G().window(4, h + 8, 248, dh);
        const text = s ? s.desc : '設定を終えて戻ります。';
        G().wrap(text, 226).slice(0, Math.max(1, Math.floor((dh - 12) / 14))).forEach((l, i) => G().text(l, 14, h + 16 + i * 14));
      }
    }
    return { SaveScreen, SettingsScreen };
  }
})(window.RPG);
