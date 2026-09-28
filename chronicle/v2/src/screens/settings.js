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
  const ONOFF = { false: 'オフ', true: 'オン' };
  const VOL = (v) => (v === 0 ? 'オフ' : String(v));

  const TABS = [
    { label: '遊び方', items: [
      { key: 'textSpeed', name: '文字の速さ', names: { slow: 'ゆっくり', normal: 'ふつう', fast: '速い', instant: '一瞬' }, desc: '会話の文字が出る速さ。' },
      { key: 'battleSpeed', name: '戦闘の速さ', names: { 1: '通常', 2: '＋1', 3: '＋2', 5: '＋4' }, desc: '戦闘の演出の速さ。戦闘中もRボタンで「通常→＋1→＋2→＋4」と切り替えられ、次の戦闘も同じ速さで始まる。' },
      { key: 'alwaysDash', name: '常にダッシュ', names: ONOFF, desc: 'オンにすると、B を押している間だけ歩く。' },
      { key: 'cursorMemory', name: 'カーソル記憶', names: { true: 'する', false: 'しない' }, desc: '戦闘で、前に選んだ行動と相手を覚えておく。' },
      { key: 'fieldZoom', name: 'フィールドの広さ', names: { near: 'ちかい', normal: 'ふつう', far: 'ひろい' }, desc: 'フィールドを映す広さ。' },
      // 「フィールドの仲間（後ろに並ぶ）」の設定は無くした（持ち主 2026-09-28「歩くモーションを 20 人分は作っていない」）
      { key: 'fieldMap', name: 'ダンジョンの地図', names: { mini: '小さく', big: '大きく', off: '出さない' }, desc: 'ダンジョンで出す地図。フィールドで X を押しても切り替わる。' },
      { key: 'wipe', name: '全滅したとき', names: { retry: '直前の戦闘から', inn: '最後に泊まった宿から' }, desc: '全滅の画面で先に選んでおく物。' },
      { act: 'tips', name: '説明の札を読み直す', desc: 'これまでに見た、仕組みの説明の札を読み直す。' },
    ] },
    { label: '画面', items: [
      { key: 'uiSize', name: '字の大きさ', names: { 1: '標準', 1.15: '大', 1.3: '特大' }, desc: '文字と窓の大きさ。' },
      { key: 'panel', name: '窓の濃さ', names: { normal: 'ふつう', dense: '濃い' }, desc: '窓の地を濃くして、字を読みやすくする。' },
      { key: 'brightness', name: '明るさ', names: { 0.85: '暗め', 1: 'ふつう', 1.25: '明るめ' }, desc: '画面全体の明るさ。' },
      { key: 'fx', name: '効果', names: { high: '高', low: '低', off: '切' }, desc: '光のにじみなどの仕上げ。重いときは下げる。' },
      { key: 'display', name: '画面の出し方', names: { window: 'ウィンドウ', fullscreen: '全画面' }, desc: 'F11 か Alt+Enter でも切り替わる。' },
      { key: 'scaleMode', name: '拡大のしかた', names: { fit: '画面に合わせる', integer: '整数倍' }, desc: '整数倍は、点がそろう大きさだけで映し、余りは黒い帯にする。' },
      { key: 'prompts', name: '操作の表示', names: { always: '出す', first2h: '最初の2時間', never: '出さない' }, desc: 'フィールドの右下のボタン表示。' },
    ] },
    { label: '音', items: [
      { key: 'vol.bgm', name: 'BGM', vol: true, desc: '音楽の大きさ。0 で消える。' },
      { key: 'vol.sfx', name: '効果音', vol: true, desc: '効果音の大きさ。0 で消える。' },
      { key: 'vol.voice', name: 'ボイス', vol: true, desc: '声の大きさ。0 で消える。' },
      { key: 'battleVoice', name: '戦闘ボイス', names: { on: 'あり', big: '大技だけ', off: 'なし' }, desc: '戦闘で仲間と主人公が話す声。' },
    ] },
    { label: '操作', items: [
      { act: 'kb', name: 'キーボードの割り当て', desc: '操作ごとに、キーボードのキーを 2 つまで決める。' },
      { act: 'pad', name: 'パッドの割り当て', desc: '操作ごとに、パッドのボタンを決める。' },
      { key: 'confirmButton', name: '決定ボタンの位置', names: { right: '右', down: '下' }, desc: 'パッドで決定に使うボタンの位置。' },
      { key: 'padGlyphs', name: 'ボタンの印', names: { auto: '自動', xbox: 'A が下', ps: '○×△□', nintendo: 'A が右' }, desc: '画面に出すパッドのボタンの印。自動は、最後に触ったパッドに合わせる。' },
      { key: 'touchPad', name: 'タッチの操作パッド', names: { auto: '自動', on: '出す', off: '出さない' }, desc: '画面に出すスティックとボタン。' },
    ] },
    { label: '読みやすさ', items: [
      { key: 'colorAssist', name: '色覚の補助', names: ONOFF, desc: 'HP のゲージを青に。上がる／下がるは形でも見分けられる。' },
      { key: 'lessFlash', name: '点滅を減らす', names: ONOFF, desc: '光の点滅と脈動を止める。' },
      { key: 'shake', name: '画面の揺れ', names: { on: 'あり', weak: '弱い', off: 'なし' }, desc: '戦闘などで画面を揺らす強さ。' },
      { key: 'reduceMotion', name: '動きを減らす', names: ONOFF, desc: '窓の動きや弾みを減らす。' },
      { key: 'ruby', name: 'ふりがな', names: ONOFF, desc: '人の名前と地名の初めての所に、ふりがなを付ける。' },
    ] },
  ];

  // 割り当ての表の行（操作の名前）
  const ACT_NAMES = {
    a: '決定・話す', b: '戻る・やめる', x: '地図・サブ', y: 'メニュー・詳しく', l: 'L（前のタブ）', r: 'R（次のタブ）', start: 'スタート',
    up: '上', down: '下', left: '左', right: '右', dash: 'ダッシュ',
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
      const ch = R.Settings.CHOICES[it.key];
      if (!ch) return;
      const i = Math.max(0, ch.indexOf(R.Settings.get(it.key)));
      const j = it.vol ? Math.max(0, Math.min(ch.length - 1, i + d)) : (i + d + ch.length) % ch.length;
      if (j === i) { R.UIK.sfx('buzzer'); return; }
      R.Settings.set(it.key, ch[j]);
      R.UIK.sfx('cursor');
    },
    async act(row, d) {
      if (row.act === 'kb' || row.act === 'pad') { R.UIK.sfx('confirm'); this.openRemap(row.act); return; }
      if (row.act === 'tips') { this.busy = true; try { await this.tips(); } finally { this.busy = false; } return; }
      this.shift(row, d);
    },
    async tips() {
      const G = R.Game;
      const ids = Object.keys(R.DB.tips || {}).filter((id) => !G || (G.flags && G.flags['tip_' + id]));
      if (!ids.length) { await S.note(this, { title: '説明の札', lines: ['まだ見た説明の札はない。'] }); return; }
      for (;;) {
        const k = await S.ask(this, { title: '説明の札を読み直す', choices: ids.map((id) => R.DB.tips[id].title).concat(['やめる']), cancel: ids.length });
        if (k < 0 || k >= ids.length) return;
        await S.tip(ids[k], { force: true });
      }
    },
    // ---------------------------------------------------------------- 割り当ての表
    openRemap(kind) {
      const rows = (kind === 'kb' ? KB_ROWS : PAD_ROWS).map((b) => ({ value: b, label: ACT_NAMES[b], btn: b }));
      rows.push({ value: 'reset', label: '既定に戻す', act: 'reset' });
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
        try { k = await S.ask(this, { title: '既定に戻す', text: (rm.kind === 'kb' ? 'キーボード' : 'パッド') + 'の割り当てを、はじめの形に戻す。', choices: ['戻す', 'やめる'], cancel: 1, index: 1 }); } finally { this.busy = false; }
        if (k === 0) { R.Input.resetBinds(rm.kind); R.UIK.sfx('confirm'); this.say('はじめの割り当てに戻した。'); }
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
        if (e.cancel) { R.UIK.sfx('cancel'); this.say('やめた。'); return; }
        const res = rm.kind === 'kb' ? R.Input.bindKey(btn, slot, e.code) : R.Input.bindPad(btn, e.index);
        const lab = rm.kind === 'kb' ? keyName(e.code) : R.Input.padLabel(e.index);
        if (!res.ok) {
          R.UIK.sfx('buzzer');
          this.say(res.reason === 'reserved' ? `「${lab}」は割り当てられない。` : res.reason === 'need' ? `「${ACT_NAMES[res.other] || res.other}」には 1 つは要る。` : '割り当てられない。', true);
          return;
        }
        R.UIK.sfx('confirm');
        let t = `「${lab}」を「${ACT_NAMES[btn]}」に。`;
        const mv = res.moved;
        if (mv && mv.btn !== btn) {
          const old = rm.kind === 'kb' ? mv.code : mv.index >= 0 ? mv.index : null;
          const on = old != null ? (rm.kind === 'kb' ? keyName(old) : R.Input.padLabel(old)) : null;
          t += on ? `「${ACT_NAMES[mv.btn]}」には「${on}」を回した。` : `「${ACT_NAMES[mv.btn]}」からは外した。`;
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
        if (res.ok) { R.UIK.sfx('cancel'); this.say(`「${ACT_NAMES[row.btn]}」の${rm.kind === 'kb' ? (rm.col ? '2 つ目の' : '1 つ目の') + 'キー' : 'ボタン'}を外した。`); }
        else { R.UIK.sfx('buzzer'); if (res.reason === 'need') this.say(`「${ACT_NAMES[row.btn]}」には 1 つは要る。`, true); }
        return;
      }
      rm.list.update();
    },
    remapDraw(g, p) {
      const rm = this.rm, C = T().color, B = R.Input.bindings();
      const style = R.Input.padStyle();
      const head = u(30);
      const c1 = p.x + p.w * 0.5, c2 = p.x + p.w * 0.75;
      R.UIK.text(g, rm.kind === 'kb' ? 'キーボードの割り当て' : 'パッドの割り当て', p.x + u(28), p.y + u(12), { size: u(14), weight: 700, color: C.gold, track: u(1.5) });
      if (rm.kind === 'kb') {
        R.UIK.text(g, '1 つ目', c1, p.y + u(12), { size: u(13), color: C.text3, align: 'center' });
        R.UIK.text(g, '2 つ目', c2, p.y + u(12), { size: u(13), color: C.text3, align: 'center' });
      } else R.UIK.text(g, 'ボタン', (c1 + c2) / 2, p.y + u(12), { size: u(13), color: C.text3, align: 'center' });
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
            R.UIK.text(gg, rm.kind === 'kb' ? 'キーを押す…' : 'ボタンを押す…', cx, cy, { size: u(13.5), weight: 700, color: `rgba(236,201,124,${blink.toFixed(2)})`, align: 'center' });
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
            if (!(idx >= 0)) { R.UIK.text(gg, row.btn === 'dash' ? 'なし（戻るを押しながら）' : '—', cx, cy, { size: u(13.5), color: C.text3, align: 'center' }); continue; }
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
      S.heading(g, '設定', x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      // タブ（縦持ちは 2 段になり得るので小さめ）
      this.tabRects = S.tabs(g, TABS.map((t) => t.label), this.tab, x, b.y + u(40), { size: tall ? 13.5 : 15, min: tall ? 60 : 84 });
      const p = { x, y: b.y + u(88), w, h: b.h - u(88) - u(64) };
      R.UIK.panel(g, p, { frost: true });
      if (this.rm) {
        this.remapDraw(g, p);
        const rm = this.rm, dy = p.y + p.h + u(14);
        const m = rm.msg && R.Engine.time - rm.msg.t < 6000 ? rm.msg : null;
        const text = rm.listen ? (rm.kind === 'kb' ? '割り当てるキーを押す。Esc でやめる。' : '割り当てるボタンを押す。キーボードの Esc でやめる。')
          : m ? m.text : rm.kind === 'kb' ? 'ぶつかったキーは入れ替わる。Esc と F11 は割り当てられない。' : 'ぶつかったボタンは入れ替わる。十字ボタンとスティックは変えられない。';
        R.UIK.icon(g, 'bulb', x + u(8), dy, u(15), m && m.bad ? C.down : C.teal);
        R.UIK.text(g, text, x + u(30), dy, { size: u(14), color: m && m.bad ? C.down : C.text2, maxW: w - u(30) });
        if (!rm.listen) S.prompts(g, [{ btn: 'a', label: '変える' }, { btn: 'x', label: '外す' }, { btn: 'b', label: '戻る' }]);
        return;
      }
      this.arrows = [];
      this.list.render = (gg, row, rect, f) => {
        const sz = u(15.5), cy = rect.y + (rect.h - sz) / 2 - u(1);
        R.UIK.text(gg, row.name, rect.x + u(18), cy, { size: sz, weight: f ? 700 : 500, color: f ? C.goldHi : C.text, maxW: rect.w * 0.45 });
        if (row.act) { R.UIK.icon(gg, row.act === 'tips' ? 'book' : 'gear', rect.x + rect.w - u(36), cy, sz, f ? C.gold : C.text2); return; }
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
      S.prompts(g, [{ btn: 'left', label: '変える' }, { btn: 'l', label: 'タブ' }, { btn: 'b', label: '戻る' }]);
    },
  });
})(window.RPG);
