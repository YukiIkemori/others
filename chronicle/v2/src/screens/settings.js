// MENUS: 設定（MODERN_UI §6.16、V2_PLAN §2.5.18・§3.12）。値は R.Settings.CHOICES、画面の言葉はここ。
//   タブ（L/R）: 遊び方／画面／音／操作／読みやすさ。←→ で値を変え、すぐ後ろの画面に反映（字の大きさはその場で並べ直す）。
//   遊び方のタブの最後に「説明の札を読み直す」（R.Screens.tip(id, {force:true})）。
//   操作のタブの「キーボードの割り当て」「パッドの割り当て」は同じ画面の中の割り当ての表（this.rm）を開く（PC 版）:
//     ↑↓ で操作、←→ でキーの 1 つ目／2 つ目、A で受け付け（次に押したキー・ボタン。Esc でやめる、8 秒で自動でやめる）、X で外す、
//     最後の行で既定に戻す。ぶつかったら入れ替えて、下の行に何を動かしたか出す。形と保存は R.Input（bindKey・bindPad・resetBinds）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const ONOFF = { false: R.T('ui.settings.ONOFF.false'), true: R.T('ui.settings.ONOFF.true') };
  const VOL = (v) => (v === 0 ? R.T('ui.settings.VOL') : String(v));

  const TABS = [
    { label: R.T('ui.settings.TABS.0.label'), items: [
      // 言語（どの言語で見ても分かるように、名前はその言語の字で。A か ←→ で選ぶ窓を開き、選んだら起こし直す）
      { key: 'lang', act: 'lang', name: R.T('ui.settings.lang.name'), names: R.I18n.NATIVE, desc: R.T('ui.settings.lang.desc') },
      { key: 'textSpeed', name: R.T('ui.settings.TABS.textSpeed.name'), names: { slow: R.T('ui.settings.TABS.textSpeed.names.slow'), normal: R.T('ui.settings.TABS.textSpeed.names.normal'), fast: R.T('ui.settings.TABS.textSpeed.names.fast'), instant: R.T('ui.settings.TABS.textSpeed.names.instant') }, desc: R.T('ui.settings.TABS.textSpeed.desc') },
      { key: 'battleSpeed', name: R.T('ui.settings.TABS.battleSpeed.name'), names: { 1: R.T('ui.settings.TABS.battleSpeed.names.1'), 2: R.T('ui.settings.TABS.battleSpeed.names.2'), 3: R.T('ui.settings.TABS.battleSpeed.names.3'), 5: R.T('ui.settings.TABS.battleSpeed.names.5') }, desc: R.T('ui.settings.TABS.battleSpeed.desc') },
      { key: 'alwaysDash', name: R.T('ui.settings.TABS.alwaysDash.name'), names: ONOFF, desc: R.T('ui.settings.TABS.alwaysDash.desc') },
      { key: 'cursorMemory', name: R.T('ui.settings.TABS.cursorMemory.name'), names: { true: R.T('ui.settings.TABS.cursorMemory.names.true'), false: R.T('ui.settings.TABS.cursorMemory.names.false') }, desc: R.T('ui.settings.TABS.cursorMemory.desc') },
      { key: 'fieldZoom', name: R.T('ui.settings.TABS.fieldZoom.name'), names: { near: R.T('ui.settings.TABS.fieldZoom.names.near'), normal: R.T('ui.settings.TABS.fieldZoom.names.normal'), far: R.T('ui.settings.TABS.fieldZoom.names.far') }, desc: R.T('ui.settings.TABS.fieldZoom.desc') },
      // 「フィールドの仲間（後ろに並ぶ）」の設定は無くした（持ち主 2026-09-28「歩くモーションを 20 人分は作っていない」）
      { key: 'fieldMap', name: R.T('ui.settings.TABS.fieldMap.name'), names: { mini: R.T('ui.settings.TABS.fieldMap.names.mini'), big: R.T('ui.settings.TABS.fieldMap.names.big'), off: R.T('ui.settings.TABS.fieldMap.names.off') }, desc: R.T('ui.settings.TABS.fieldMap.desc') },
      // 「全滅したとき」（全滅の札の既定の行）の設定は無くした: 全滅の札のカーソルは毎回「直前の戦闘からやり直す」（持ち主 2026-10-04。テスター R12）
      { act: 'tips', name: R.T('ui.settings.TABS.0.items.7.name'), desc: R.T('ui.settings.TABS.0.items.7.desc') },
    ] },
    { label: R.T('ui.settings.TABS.1.label'), items: [
      { key: 'uiSize', name: R.T('ui.settings.TABS.uiSize.name'), names: { 1: R.T('ui.settings.TABS.uiSize.names.1'), 1.15: R.T('ui.settings.TABS.uiSize.names.1_15'), 1.3: R.T('ui.settings.TABS.uiSize.names.1_3') }, desc: R.T('ui.settings.TABS.uiSize.desc') },
      { key: 'panel', name: R.T('ui.settings.TABS.panel.name'), names: { normal: R.T('ui.settings.TABS.panel.names.normal'), dense: R.T('ui.settings.TABS.panel.names.dense') }, desc: R.T('ui.settings.TABS.panel.desc') },
      { key: 'brightness', name: R.T('ui.settings.TABS.brightness.name'), names: { 0.85: R.T('ui.settings.TABS.brightness.names.0_85'), 1: R.T('ui.settings.TABS.brightness.names.1'), 1.25: R.T('ui.settings.TABS.brightness.names.1_25') }, desc: R.T('ui.settings.TABS.brightness.desc') },
      { key: 'fx', name: R.T('ui.settings.TABS.fx.name'), names: { high: R.T('ui.settings.TABS.fx.names.high'), low: R.T('ui.settings.TABS.fx.names.low'), off: R.T('ui.settings.TABS.fx.names.off') }, desc: R.T('ui.settings.TABS.fx.desc') },
      { key: 'display', name: R.T('ui.settings.TABS.display.name'), names: { window: R.T('ui.settings.TABS.display.names.window'), fullscreen: R.T('ui.settings.TABS.display.names.fullscreen') }, desc: R.T('ui.settings.TABS.display.desc') },
      { key: 'scaleMode', name: R.T('ui.settings.TABS.scaleMode.name'), names: { fit: R.T('ui.settings.TABS.scaleMode.names.fit'), integer: R.T('ui.settings.TABS.scaleMode.names.integer') }, desc: R.T('ui.settings.TABS.scaleMode.desc') },
      { key: 'prompts', name: R.T('ui.settings.TABS.prompts.name'), names: { always: R.T('ui.settings.TABS.prompts.names.always'), first2h: R.T('ui.settings.TABS.prompts.names.first2h'), never: R.T('ui.settings.TABS.prompts.names.never') }, desc: R.T('ui.settings.TABS.prompts.desc') },
    ] },
    { label: R.T('ui.settings.TABS.2.label'), items: [
      { key: 'vol.bgm', name: 'BGM', vol: true, desc: R.T('ui.settings.TABS.vol_bgm.desc') },
      { key: 'vol.sfx', name: R.T('ui.settings.TABS.vol_sfx.name'), vol: true, desc: R.T('ui.settings.TABS.vol_sfx.desc') },
      { key: 'vol.voice', name: R.T('ui.settings.TABS.vol_voice.name'), vol: true, desc: R.T('ui.settings.TABS.vol_voice.desc') },
      { key: 'vol.amb', name: R.T('ui.settings.TABS.vol_amb.name'), vol: true, desc: R.T('ui.settings.TABS.vol_amb.desc') },
      { key: 'battleVoice', name: R.T('ui.settings.TABS.battleVoice.name'), names: { on: R.T('ui.settings.TABS.battleVoice.names.on'), big: R.T('ui.settings.TABS.battleVoice.names.big'), off: R.T('ui.settings.TABS.battleVoice.names.off') }, desc: R.T('ui.settings.TABS.battleVoice.desc') },
    ] },
    { label: R.T('ui.settings.TABS.3.label'), items: [
      { act: 'kb', name: R.T('ui.settings.TABS.3.items.0.name'), desc: R.T('ui.settings.TABS.3.items.0.desc') },
      { act: 'pad', name: R.T('ui.settings.TABS.3.items.1.name'), desc: R.T('ui.settings.TABS.3.items.1.desc') },
      { key: 'confirmButton', name: R.T('ui.settings.TABS.confirmButton.name'), names: { right: R.T('ui.settings.TABS.confirmButton.names.right'), down: R.T('ui.settings.TABS.confirmButton.names.down') }, desc: R.T('ui.settings.TABS.confirmButton.desc') },
      { key: 'padGlyphs', name: R.T('ui.settings.TABS.padGlyphs.name'), names: { auto: R.T('ui.settings.TABS.padGlyphs.names.auto'), xbox: R.T('ui.settings.TABS.padGlyphs.names.xbox'), ps: '○×△□', nintendo: R.T('ui.settings.TABS.padGlyphs.names.nintendo') }, desc: R.T('ui.settings.TABS.padGlyphs.desc') },
      { key: 'touchPad', name: R.T('ui.settings.TABS.touchPad.name'), names: { auto: R.T('ui.settings.TABS.touchPad.names.auto'), on: R.T('ui.settings.TABS.touchPad.names.on'), off: R.T('ui.settings.TABS.touchPad.names.off') }, desc: R.T('ui.settings.TABS.touchPad.desc') },
    ] },
    { label: R.T('ui.settings.TABS.4.label'), items: [
      { key: 'colorAssist', name: R.T('ui.settings.TABS.colorAssist.name'), names: ONOFF, desc: R.T('ui.settings.TABS.colorAssist.desc') },
      { key: 'lessFlash', name: R.T('ui.settings.TABS.lessFlash.name'), names: ONOFF, desc: R.T('ui.settings.TABS.lessFlash.desc') },
      { key: 'shake', name: R.T('ui.settings.TABS.shake.name'), names: { on: R.T('ui.settings.TABS.shake.names.on'), weak: R.T('ui.settings.TABS.shake.names.weak'), off: R.T('ui.settings.TABS.shake.names.off') }, desc: R.T('ui.settings.TABS.shake.desc') },
      { key: 'reduceMotion', name: R.T('ui.settings.TABS.reduceMotion.name'), names: ONOFF, desc: R.T('ui.settings.TABS.reduceMotion.desc') },
      { key: 'ruby', name: R.T('ui.settings.TABS.ruby.name'), names: ONOFF, desc: R.T('ui.settings.TABS.ruby.desc') },
    ] },
  ];

  // 割り当ての表の行（操作の名前）
  const ACT_NAMES = {
    a: R.T('ui.settings.ACT_NAMES.a'), b: R.T('ui.settings.ACT_NAMES.b'), x: R.T('ui.settings.ACT_NAMES.x'), y: R.T('ui.settings.ACT_NAMES.y'), l: R.T('ui.settings.ACT_NAMES.l'), r: R.T('ui.settings.ACT_NAMES.r'), start: R.T('ui.settings.ACT_NAMES.start'),
    up: R.T('ui.settings.ACT_NAMES.up'), down: R.T('ui.settings.ACT_NAMES.down'), left: R.T('ui.settings.ACT_NAMES.left'), right: R.T('ui.settings.ACT_NAMES.right'), dash: R.T('ui.settings.ACT_NAMES.dash'),
  };
  const KB_ROWS = ['a', 'b', 'y', 'x', 'l', 'r', 'start', 'dash', 'up', 'down', 'left', 'right'];
  const PAD_ROWS = ['a', 'b', 'y', 'x', 'l', 'r', 'start', 'dash'];
  const LISTEN_MS = 8000;
  const keyName = (code) => R.Input.keyLabel(code);

  S.def('settings', {
    init() {
      this.tab = 0;
      this.list = new R.UIK.List({ rows: [], rowH: 44 });
      this.list.onSelect = (row) => this.act(row, 1);
      this.list.onCancel = () => this.close(undefined);
      this.refresh(false);
      this.busy = false;
      this.arrows = [];
    },
    refresh(keep) { this.list.setRows(TABS[this.tab].items.map((it) => Object.assign({ value: it.key || it.act, label: it.name }, it)), keep); },
    valueName(it, v) {
      if (it.vol) return VOL(v);
      const n = it.names && it.names[String(v)];
      return n != null ? n : String(v);
    },
    shift(it, d) {
      if (it.act === 'lang') { if (!this.busy) this.act(it, d); return; }
      const ch = R.Settings.CHOICES[it.key];
      if (!ch) return;
      const i = Math.max(0, ch.indexOf(R.Settings.get(it.key)));
      const j = it.vol ? Math.max(0, Math.min(ch.length - 1, i + d)) : (i + d + ch.length) % ch.length;
      if (j === i) { R.UIK.sfx('buzzer'); return; }
      R.Settings.set(it.key, ch[j]);
      R.UIK.sfx('cursor');
    },
    async act(row, d) {
      if (row.act === 'lang') { R.UIK.sfx('confirm'); this.busy = true; try { await this.chooseLang(); } finally { this.busy = false; } return; }
      if (row.act === 'kb' || row.act === 'pad') { R.UIK.sfx('confirm'); this.openRemap(row.act); return; }
      if (row.act === 'tips') { this.busy = true; try { await this.tips(); } finally { this.busy = false; } return; }
      this.shift(row, d);
    },
    /**
     * 言語を選ぶ → 確かめ → 設定に覚えて起こし直す（データの名前は読み込みの時に決まるため。core/i18n.js）。
     * 旅の途中なら中断の記録を作り、起こし直した後にそこから続ける（main.js の R.Flow.langResume）。
     */
    async chooseLang() {
      const L = R.I18n.LANGS, cur = R.I18n.lang();
      const k = await S.ask(this, { title: R.T('ui.settings.lang.title'), choices: L.map((l) => R.I18n.NATIVE[l]).concat([R.T('ui.settings.lang.cancel')]), cancel: L.length, index: Math.max(0, L.indexOf(cur)) });
      if (k < 0 || k >= L.length || L[k] === cur) return;
      const to = L[k];
      const inGame = !!(R.Game && R.Field && R.Engine.has && R.Engine.has('field'));
      const key = inGame ? 'ui.settings.lang.restartGame' : 'ui.settings.lang.restart';
      // 確かめの文は今の言語と選んだ言語の両方で（選んだ言語の訳が無ければ今の言語だけ）
      const there = R.I18n.table(to)[key];
      const text = R.T(key) + (there && there !== R.T(key) ? '\n' + R.I18n.format(there, {}, to) : '');
      const ok = await S.ask(this, { title: R.I18n.NATIVE[to], text, choices: [R.T('ui.settings.lang.yes'), R.T('ui.settings.lang.no')], cancel: 1, index: 0 });
      if (ok !== 0) return;
      R.Settings.set('lang', to);
      if (inGame && R.Save && R.Save.suspend()) { try { window.sessionStorage.setItem(R.SAVE_PREFIX + 'lang_resume', '1'); } catch (e) { /* 起こし直した後はタイトルから */ } }
      if (R.Storage && R.Storage.flush) { try { await R.Storage.flush(); } catch (e) { /* 書けなくても起こし直す */ } }
      R.I18n.restart();
    },
    async tips() {
      const G = R.Game;
      const ids = Object.keys(R.DB.tips || {}).filter((id) => !G || (G.flags && G.flags['tip_' + id]));
      if (!ids.length) { await S.note(this, { title: R.T('ui.settings.tips.title'), lines: [R.T('ui.settings.tips.lines.0')] }); return; }
      for (;;) {
        const k = await S.ask(this, { title: R.T('ui.settings.tips.k.ask.title'), choices: ids.map((id) => R.DB.tips[id].title).concat([R.T('ui.settings.tips.k.ask.choices.0')]), cancel: ids.length });
        if (k < 0 || k >= ids.length) return;
        await S.tip(ids[k], { force: true });
      }
    },
    // ---------------------------------------------------------------- 割り当ての表
    openRemap(kind) {
      const rows = (kind === 'kb' ? KB_ROWS : PAD_ROWS).map((b) => ({ value: b, label: ACT_NAMES[b], btn: b }));
      rows.push({ value: 'reset', label: R.T('ui.settings.reset.label'), act: 'reset' });
      const list = new R.UIK.List({ rows, rowH: 34 });
      this.rm = { kind, list, col: 0, listen: null, msg: null, cells: [] };
      list.onSelect = (row) => this.remapAct(row);
      list.onCancel = () => { this.closeRemap(); };
    },
    closeRemap() { if (R.Input.capturing) R.Input.cancelCapture(); this.rm = null; },
    say(text, bad) { if (this.rm) this.rm.msg = { text, bad: !!bad, t: R.Engine.time }; },
    async remapAct(row) {
      const rm = this.rm;
      if (!rm) return;
      if (row.act === 'reset') {
        this.busy = true;
        let k = -1;
        try { k = await S.ask(this, { title: R.T('ui.settings.remapAct.k.ask.title'), text: R.T('ui.settings.remapAct.k.ask.text', { p0: rm.kind === 'kb' ? R.T('ui.settings.remapAct.k.ask.text_2') : R.T('ui.settings.remapAct.k.ask.text_3') }), choices: R.T('ui.settings.remapAct.k.ask.choices'), cancel: 1, index: 1 }); } finally { this.busy = false; }
        if (k === 0) { R.Input.resetBinds(rm.kind); R.UIK.sfx('confirm'); this.say(R.T('ui.settings.remapAct.say')); }
        return;
      }
      this.listen(row.btn);
    },
    listen(btn) {
      const rm = this.rm;
      const slot = rm.kind === 'kb' ? rm.col : 0;
      rm.listen = { btn, slot, t: R.Engine.time };
      rm.msg = null;
      R.UIK.sfx('cursor');
      R.Input.capture(rm.kind, (e) => {
        if (this.rm !== rm) return;
        rm.listen = null;
        if (e.cancel) { R.UIK.sfx('cancel'); this.say(R.T('ui.settings.listen.say')); return; }
        const res = rm.kind === 'kb' ? R.Input.bindKey(btn, slot, e.code) : R.Input.bindPad(btn, e.index);
        const lab = rm.kind === 'kb' ? keyName(e.code) : R.Input.padLabel(e.index);
        if (!res.ok) {
          R.UIK.sfx('buzzer');
          this.say(res.reason === 'reserved' ? R.T('ui.settings.listen.say_2', { lab }) : res.reason === 'need' ? R.T('ui.settings.listen.say_3', { p0: ACT_NAMES[res.other] || res.other }) : R.T('ui.settings.listen.say_4'), true);
          return;
        }
        R.UIK.sfx('confirm');
        let t = R.T('ui.settings.listen.t', { lab, p1: ACT_NAMES[btn] });
        const mv = res.moved;
        if (mv && mv.btn !== btn) {
          const old = rm.kind === 'kb' ? mv.code : mv.index >= 0 ? mv.index : null;
          const on = old != null ? (rm.kind === 'kb' ? keyName(old) : R.Input.padLabel(old)) : null;
          t += on ? R.T('ui.settings.listen.t_2', { p0: ACT_NAMES[mv.btn], on }) : R.T('ui.settings.listen.t_3', { p0: ACT_NAMES[mv.btn] });
        }
        this.say(t);
      });
    },
    remapUpdate() {
      const rm = this.rm, I = R.Input;
      if (rm.listen) {
        if (R.Engine.time - rm.listen.t > LISTEN_MS) { I.cancelCapture(); }
        return;
      }
      const row = rm.list.current();
      if (rm.kind === 'kb') {
        if (I.repeat('left') || I.repeat('right')) { rm.col = 1 - rm.col; R.UIK.sfx('cursor'); return; }
      }
      for (const c of rm.cells) {
        if (S.clicked(c.r)) { rm.list.focusIndex(c.i); rm.col = c.col; this.listen(rm.list.rows[c.i].btn); return; }
      }
      if (row && row.btn && I.pressed('x')) {
        const res = rm.kind === 'kb' ? R.Input.clearKey(row.btn, rm.col) : R.Input.bindPad(row.btn, -1);
        if (res.ok) { R.UIK.sfx('cancel'); this.say(R.T('ui.settings.remapUpdate.say', { p0: ACT_NAMES[row.btn], p1: rm.kind === 'kb' ? R.T('ui.settings.remapUpdate.say_2', { p0: rm.col ? R.T('ui.settings.remapUpdate.say_3') : R.T('ui.settings.remapUpdate.say_4') }) : R.T('ui.settings.remapUpdate.say_5') })); }
        else { R.UIK.sfx('buzzer'); if (res.reason === 'need') this.say(R.T('ui.settings.remapUpdate.say_6', { p0: ACT_NAMES[row.btn] }), true); }
        return;
      }
      rm.list.update();
    },
    remapDraw(g, p) {
      const rm = this.rm, C = T().color, B = R.Input.bindings();
      const style = R.Input.padStyle();
      const head = u(30);
      const c1 = p.x + p.w * 0.5, c2 = p.x + p.w * 0.75;
      R.UIK.text(g, rm.kind === 'kb' ? R.T('ui.settings.remapDraw.text') : R.T('ui.settings.remapDraw.text_2'), p.x + u(28), p.y + u(12), { size: u(14), weight: 700, color: C.gold, track: u(1.5) });
      if (rm.kind === 'kb') {
        R.UIK.text(g, R.T('ui.settings.remapDraw.text_3'), c1, p.y + u(12), { size: u(13), color: C.text3, align: 'center' });
        R.UIK.text(g, R.T('ui.settings.remapDraw.text_4'), c2, p.y + u(12), { size: u(13), color: C.text3, align: 'center' });
      } else R.UIK.text(g, R.T('ui.settings.remapDraw.text_5'), (c1 + c2) / 2, p.y + u(12), { size: u(13), color: C.text3, align: 'center' });
      rm.cells = [];
      rm.list.render = (gg, row, rect, f) => {
        const sz = u(15), cy = rect.y + (rect.h - sz) / 2 - u(1);
        const i = rm.list.rows.indexOf(row);
        R.UIK.text(gg, row.label, rect.x + u(18), cy, { size: sz, weight: f ? 700 : 500, color: row.act ? (f ? C.goldHi : C.text2) : f ? C.goldHi : C.text, maxW: rect.w * 0.4 });
        if (row.act) return;
        const mid = rect.y + rect.h / 2;
        const cols = rm.kind === 'kb' ? [[c1, 0], [c2, 1]] : [[(c1 + c2) / 2, 0]];
        for (const [cx, col] of cols) {
          const cw = rm.kind === 'kb' ? p.w * 0.22 : p.w * 0.3;
          const r0 = { x: cx - cw / 2, y: rect.y + u(3), w: cw, h: rect.h - u(6) };
          rm.cells.push({ r: r0, i, col });
          const on = f && (rm.kind !== 'kb' || rm.col === col);
          if (on) { gg.save(); R.UIK.rr(gg, r0.x, r0.y, r0.w, r0.h, u(6)); gg.fillStyle = 'rgba(236,201,124,0.16)'; gg.fill(); gg.strokeStyle = 'rgba(236,201,124,0.55)'; gg.lineWidth = 0.75; gg.stroke(); gg.restore(); }
          const L = rm.listen;
          if (L && L.btn === row.btn && L.slot === col) {
            const blink = 0.55 + 0.45 * Math.sin(R.Engine.time / 180);
            R.UIK.text(gg, rm.kind === 'kb' ? R.T('ui.settings.remapDraw.render.text') : R.T('ui.settings.remapDraw.render.text_2'), cx, cy, { size: u(13.5), weight: 700, color: `rgba(236,201,124,${blink.toFixed(2)})`, align: 'center', maxW: cw - u(10) });
            continue;
          }
          if (rm.kind === 'kb') {
            const code = (B.kb[row.btn] || [])[col];
            if (!code) { R.UIK.text(gg, '—', cx, cy, { size: sz, color: C.text3, align: 'center' }); continue; }
            const lab = keyName(code), gs = u(13);
            const gw = R.UIK.glyphWidth ? R.UIK.glyphWidth(row.btn, gs, { kind: 'kb', label: lab }) : gs * 1.6;
            R.UIK.glyph(gg, row.btn, cx - gw / 2 + gs * 0.64, mid, { size: gs, kind: 'kb', label: lab });
          } else {
            const idx = B.pad[row.btn];
            if (!(idx >= 0)) { R.UIK.text(gg, row.btn === 'dash' ? R.T('ui.settings.remapDraw.render.text_3') : '—', cx, cy, { size: u(13.5), color: C.text3, align: 'center' }); continue; }
            const gs = u(14), o = { size: gs, kind: 'pad', label: R.Input.padLabel(idx, style), style, index: idx };
            const gw = R.UIK.glyphWidth ? R.UIK.glyphWidth(row.btn, gs, o) : gs * 1.3;
            R.UIK.glyph(gg, row.btn, cx - gw / 2 + gs * 0.64, mid, o);
          }
        }
      };
      rm.list.draw(g, { x: p.x + u(10), y: p.y + head + u(8), w: p.w - u(20), h: p.h - head - u(18) });
    },
    update() {
      if (this.busy) return;
      if (this.rm) { this.remapUpdate(); return; }
      const I = R.Input;
      const k = S.tabInput(this.tabRects, this.tab, TABS.length);
      if (k >= 0) { this.tab = k; this.refresh(false); return; }
      const row = this.list.current();
      if (row && row.key) {
        if (I.repeat('left')) { this.shift(row, -1); return; }
        if (I.repeat('right')) { this.shift(row, 1); return; }
        for (const a of this.arrows) if (S.clicked(a.r)) { this.list.focusIndex(a.i); this.shift(this.list.rows[a.i], a.d); return; }
      }
      this.list.update();
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const w = Math.min(b.w, u(760)), x = b.x + (tall ? 0 : (b.w - w) / 2);
      S.heading(g, R.T('ui.settings.draw.heading'), x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      // タブ（縦持ちは 2 段になり得るので小さめ）
      this.tabRects = S.tabs(g, TABS.map((t) => t.label), this.tab, x, b.y + u(40), { size: tall ? 13.5 : 15, min: tall ? 60 : 84 });
      const p = { x, y: b.y + u(88), w, h: b.h - u(88) - u(64) };
      R.UIK.panel(g, p, { frost: true });
      if (this.rm) {
        this.remapDraw(g, p);
        const rm = this.rm, dy = p.y + p.h + u(14);
        const m = rm.msg && R.Engine.time - rm.msg.t < 6000 ? rm.msg : null;
        const text = rm.listen ? (rm.kind === 'kb' ? R.T('ui.settings.draw.text') : R.T('ui.settings.draw.text_2'))
          : m ? m.text : rm.kind === 'kb' ? R.T('ui.settings.draw.text_3') : R.T('ui.settings.draw.text_4');
        R.UIK.icon(g, 'bulb', x + u(8), dy, u(15), m && m.bad ? C.down : C.teal);
        R.UIK.text(g, text, x + u(30), dy, { size: u(14), color: m && m.bad ? C.down : C.text2, maxW: w - u(30) });
        if (!rm.listen) S.prompts(g, [{ btn: 'a', label: R.T('ui.settings.draw.0.label') }, { btn: 'x', label: R.T('ui.settings.draw.1.label') }, { btn: 'b', label: R.T('ui.settings.draw.2.label') }]);
        return;
      }
      this.arrows = [];
      this.list.render = (gg, row, rect, f) => {
        const sz = u(15.5), cy = rect.y + (rect.h - sz) / 2 - u(1);
        R.UIK.text(gg, row.name, rect.x + u(18), cy, { size: sz, weight: f ? 700 : 500, color: f ? C.goldHi : C.text, maxW: rect.w * 0.45 });
        if (row.act && row.act !== 'lang') { R.UIK.icon(gg, row.act === 'tips' ? 'book' : 'gear', rect.x + rect.w - u(36), cy, sz, f ? C.gold : C.text2); return; }
        const v = R.Settings.get(row.key);
        const vx = rect.x + rect.w * (tall ? 0.72 : 0.7);
        const i = this.list.rows.indexOf(row);
        if (row.vol) {
          const bw = rect.w * 0.26, bx = vx - bw / 2;
          for (let k = 0; k < 10; k++) {
            g.save(); gg.fillStyle = k < v ? (f ? C.gold : C.text2) : 'rgba(240,228,200,0.12)';
            gg.fillRect(bx + (k * bw) / 10 + u(1), rect.y + rect.h / 2 - u(6), bw / 10 - u(3), u(12)); g.restore();
          }
          R.UIK.text(gg, VOL(v), bx + bw + u(34), cy, { size: sz, weight: 700, color: f ? C.goldHi : C.text, align: 'center' });
        } else R.UIK.text(gg, this.valueName(row, v), vx, cy, { size: sz, weight: 700, color: f ? C.goldHi : C.text, align: 'center', maxW: rect.w * 0.34 });
        const aw = u(26), ay = rect.y + rect.h / 2, off = rect.w * (tall ? 0.22 : 0.2);
        for (const [d, cx0] of [[-1, vx - off], [1, vx + off + (row.vol ? u(20) : 0)]]) {
          const rr = { x: cx0 - aw / 2, y: rect.y, w: aw, h: rect.h };
          this.arrows.push({ r: rr, i, d });
          gg.save(); gg.fillStyle = f ? C.gold : C.text3; gg.beginPath(); const s = u(5);
          if (d < 0) { gg.moveTo(cx0 - s, ay); gg.lineTo(cx0 + s * 0.7, ay - s); gg.lineTo(cx0 + s * 0.7, ay + s); } else { gg.moveTo(cx0 + s, ay); gg.lineTo(cx0 - s * 0.7, ay - s); gg.lineTo(cx0 - s * 0.7, ay + s); }
          gg.closePath(); gg.fill(); gg.restore();
        }
      };
      this.list.draw(g, { x: p.x + u(10), y: p.y + u(10), w: p.w - u(20), h: p.h - u(20) });
      const row = this.list.current();
      if (row) {
        const dy = p.y + p.h + u(14);
        R.UIK.icon(g, 'bulb', x + u(8), dy, u(15), C.teal);
        R.UIK.text(g, row.desc || '', x + u(30), dy, { size: u(14), color: C.text2, maxW: w - u(30) });
      }
      S.prompts(g, [{ btn: 'left', label: R.T('ui.settings.draw.0.label') }, { btn: 'l', label: R.T('ui.settings.draw.1.label_2') }, { btn: 'b', label: R.T('ui.settings.draw.2.label') }]);
    },
  });
})(window.RPG);
