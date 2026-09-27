// MENUS: 設定（MODERN_UI §6.16、V2_PLAN §2.5.18・§3.12）。値は R.Settings.CHOICES、画面の言葉はここ。
//   タブ（L/R）: 遊び方／画面／音／操作／読みやすさ。←→ で値を変え、すぐ後ろの画面に反映（字の大きさはその場で並べ直す）。
//   遊び方のタブの最後に「説明の札を読み直す」（R.Screens.tip(id, {force:true})）。キーの割り当ての変更は縦切りの外。
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
      { key: 'battleSpeed', name: '戦闘の速さ', names: { 1: '×1', 2: '×2', 3: '×3' }, desc: '戦闘の演出の速さ。戦闘中も R で切り替えられる。' },
      { key: 'alwaysDash', name: '常にダッシュ', names: ONOFF, desc: 'オンにすると、B を押している間だけ歩く。' },
      { key: 'cursorMemory', name: 'カーソル記憶', names: { true: 'する', false: 'しない' }, desc: '戦闘で、前に選んだ行動と相手を覚えておく。' },
      { key: 'fieldZoom', name: 'フィールドの広さ', names: { near: 'ちかい', normal: 'ふつう', far: 'ひろい' }, desc: 'フィールドを映す広さ。' },
      { key: 'wipe', name: '全滅したとき', names: { retry: '直前の戦闘から', inn: '最後に泊まった宿から' }, desc: '全滅の画面で先に選んでおく物。' },
      { act: 'tips', name: '説明の札を読み直す', desc: 'これまでに見た、仕組みの説明の札を読み直す。' },
    ] },
    { label: '画面', items: [
      { key: 'uiSize', name: '字の大きさ', names: { 1: '標準', 1.15: '大', 1.3: '特大' }, desc: '文字と窓の大きさ。' },
      { key: 'panel', name: '窓の濃さ', names: { normal: 'ふつう', dense: '濃い' }, desc: '窓の地を濃くして、字を読みやすくする。' },
      { key: 'brightness', name: '明るさ', names: { 0.85: '暗め', 1: 'ふつう', 1.25: '明るめ' }, desc: '画面全体の明るさ。' },
      { key: 'fx', name: '効果', names: { high: '高', low: '低', off: '切' }, desc: '光のにじみなどの仕上げ。重いときは下げる。' },
      { key: 'prompts', name: '操作の表示', names: { always: '出す', first2h: '最初の2時間', never: '出さない' }, desc: 'フィールドの右下のボタン表示。' },
    ] },
    { label: '音', items: [
      { key: 'vol.bgm', name: 'BGM', vol: true, desc: '音楽の大きさ。0 で消える。' },
      { key: 'vol.sfx', name: '効果音', vol: true, desc: '効果音の大きさ。0 で消える。' },
      { key: 'vol.voice', name: 'ボイス', vol: true, desc: '声の大きさ。0 で消える。' },
      { key: 'battleVoice', name: '戦闘ボイス', names: { on: 'あり', big: '大技だけ', off: 'なし' }, desc: '戦闘で仲間と主人公が話す声。' },
    ] },
    { label: '操作', items: [
      { key: 'confirmButton', name: '決定ボタンの位置', names: { right: '右', down: '下' }, desc: 'パッドで決定に使うボタンの位置。' },
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
    update() {
      if (this.busy) return;
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
      this.arrows = [];
      this.list.render = (gg, row, rect, f) => {
        const sz = u(15.5), cy = rect.y + (rect.h - sz) / 2 - u(1);
        R.UIK.text(gg, row.name, rect.x + u(18), cy, { size: sz, weight: f ? 700 : 500, color: f ? C.goldHi : C.text, maxW: rect.w * 0.45 });
        if (row.act) { R.UIK.icon(gg, 'book', rect.x + rect.w - u(36), cy, sz, f ? C.gold : C.text2); return; }
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
