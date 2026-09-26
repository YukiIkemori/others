// MENUS: セーブ・ロード（MODERN_UI §6.15、V2_PLAN §2.5.3・§3.13）
//   'save': 記録 3 枠＋「中断してタイトルへ」＋冒険の合言葉。上書きは確かめる。→ undefined（中断したときはハブが {title:true} で閉じる）
//   'load': オートセーブ・中断・記録 3 枠。→ {slot}（読み込み済み）| null
//   札: 場所・章（クリアした地方の数）・プレイ時間・日時・4 人の顔（Lv は出さない）。版の違う記録は「前の版のセーブのため読めません」。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  function cardOf(slot) { const e = R.Save.cards().find((x) => x.slot === slot); return e ? e.card : null; }
  /** 記録の札（一覧の行） */
  S.saveCard = function (g, slot, card, rect, f, o) {
    o = o || {};
    const C = T().color;
    const r = { x: rect.x + u(4), y: rect.y + u(4), w: rect.w - u(8), h: rect.h - u(8) };
    R.UIK.card(g, r, { focused: f, frost: true });
    const icon = slot === 'auto' ? 'clock' : slot === 'suspend' ? 'exit' : 'save';
    R.UIK.icon(g, icon, r.x + u(16), r.y + u(14), u(16), f ? C.gold : C.text2);
    R.UIK.text(g, o.label || S.slotName(slot), r.x + u(42), r.y + u(13), { size: u(14), weight: 700, color: f ? C.goldHi : C.gold });
    if (!card) { R.UIK.text(g, o.empty || '（空き）', r.x + u(42), r.y + u(42), { size: u(15), color: C.text3 }); return; }
    if (card.bad) { R.UIK.text(g, '前の版のセーブのため読めません', r.x + u(42), r.y + u(42), { size: u(14), color: C.disabled }); return; }
    const tall = S.tall();
    R.UIK.text(g, R.U.date(card.date), r.x + r.w - u(16), r.y + u(14), { size: u(12), color: C.text3, align: 'right' });
    R.UIK.text(g, card.place || '', r.x + u(42), r.y + u(38), { size: u(17), weight: 700, color: C.text, maxW: r.w * (tall ? 0.8 : 0.45) });
    R.UIK.text(g, `${card.chapter ? '第' + card.chapter + '章' : '序章'}　・　${S.playTimeJa(card.playMs)}`, tall ? r.x + u(42) : r.x + r.w * 0.52, tall ? r.y + u(64) : r.y + u(41), { size: u(13.5), color: C.text2 });
    const faces = card.faces || [];
    faces.slice(0, 4).forEach((look, i) => S.faceCircle(g, look, r.x + r.w - u(26) - (faces.length - 1 - i) * u(34), r.y + r.h - u(24), u(14)));
  };

  S.def('save', {
    init() {
      this.list = new R.UIK.List({ rows: this.rows(), rowH: 76 });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(undefined);
      this.busy = false;
    },
    rows() {
      return ['s1', 's2', 's3'].map((s) => ({ value: s, label: S.slotName(s) }))
        .concat([{ value: 'suspend', label: '中断してタイトルへ', kind: 'act' }, { value: 'passphrase', label: '冒険の合言葉', kind: 'act' }]);
    },
    async pick(row) {
      if (this.busy) return;
      this.busy = true;
      try {
        if (row.value === 'passphrase') { await S.open('passphrase', { mode: 'show' }); return; }
        if (row.value === 'suspend') {
          const k = await S.ask(this, { title: '中断', text: '旅を中断して、タイトルへ戻る？\n（次に「つづきから」で、ここから始められる）', choices: ['中断する', 'やめる'], cancel: 1 });
          if (k !== 0) return;
          if (R.Save.suspend()) { S._toTitle = true; this.close(undefined); } else R.UIK.sfx('buzzer');
          return;
        }
        const c = cardOf(row.value);
        if (c) {
          const k = await S.ask(this, { title: S.slotName(row.value), text: 'この記録に上書きする？', choices: ['上書きする', 'やめる'], cancel: 1 });
          if (k !== 0) return;
        }
        if (R.Save.save(row.value)) { R.UIK.sfx('save'); R.UIK.toast('セーブしました', { anchor: 'bl', icon: 'save' }); }
        else { R.UIK.sfx('buzzer'); R.UIK.toast('ここではセーブできない', { anchor: 'bl' }); }
        this.list.setRows(this.rows(), true);
      } finally { this.busy = false; }
    },
    update() { if (!this.busy) this.list.update(); },
    draw(g) {
      const b = S.box(), C = T().color;
      const w = Math.min(b.w, u(700)), x = b.x + (b.w - w) / 2;
      S.heading(g, 'セーブ', x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      const p = { x, y: b.y + u(44), w, h: b.h - u(44) };
      R.UIK.panel(g, p, { frost: true });
      const lr = { x: p.x + u(10), y: p.y + u(10), w: p.w - u(20), h: p.h - u(20) };
      this.list.render = (gg, row, rect, f) => {
        if (row.kind === 'act') {
          const r = { x: rect.x + u(4), y: rect.y + u(4), w: rect.w - u(8), h: rect.h - u(8) };
          R.UIK.card(gg, r, { focused: f, frost: true });
          R.UIK.icon(gg, row.value === 'suspend' ? 'exit' : 'key', r.x + u(16), r.y + (r.h - u(18)) / 2, u(18), f ? C.gold : C.text2);
          R.UIK.text(gg, row.label, r.x + u(46), r.y + (r.h - u(16)) / 2 - u(1), { size: u(16), weight: 700, color: f ? C.goldHi : C.text });
          const sub = row.value === 'suspend' ? '読み込むと消える一時の記録' : '今の旅を 1 行の文字にする';
          R.UIK.text(gg, sub, r.x + r.w - u(16), r.y + (r.h - u(13)) / 2, { size: u(12.5), color: C.text3, align: 'right' });
          return;
        }
        S.saveCard(gg, row.value, cardOf(row.value), rect, f);
      };
      this.list.draw(g, lr);
      S.prompts(g, [{ btn: 'a', label: 'セーブ' }, { btn: 'b', label: '戻る' }]);
    },
  });

  S.def('load', {
    init() {
      const rows = ['auto', 'suspend', 's1', 's2', 's3'].map((s) => { const c = cardOf(s); return { value: s, disabled: !c || !!c.bad }; });
      this.list = new R.UIK.List({ rows, rowH: 76 });
      const last = R.Save.lastSlot && R.Save.lastSlot();
      const li = rows.findIndex((r) => r.value === last && !r.disabled);
      this.list.focusIndex(li >= 0 ? li : Math.max(0, rows.findIndex((r) => !r.disabled)));
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(null);
      this.busy = false;
    },
    async pick(row) {
      if (this.busy) return;
      if (R.Game) {
        this.busy = true;
        const k = await S.ask(this, { title: S.slotName(row.value), text: 'この記録を読み込む？\n今の旅の、記録していない所は消える。', choices: ['読み込む', 'やめる'], cancel: 1 });
        this.busy = false;
        if (k !== 0) return;
      }
      if (R.Save.load(row.value)) this.close({ slot: row.value });
      else { R.UIK.sfx('buzzer'); R.UIK.toast('読み込めなかった', { anchor: 'bl' }); }
    },
    update() { if (!this.busy) this.list.update(); },
    draw(g) {
      const b = S.box();
      const w = Math.min(b.w, u(700)), x = b.x + (b.w - w) / 2;
      S.heading(g, 'ロード', x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      const p = { x, y: b.y + u(44), w, h: b.h - u(44) };
      R.UIK.panel(g, p, { frost: true });
      this.list.render = (gg, row, rect, f) => S.saveCard(gg, row.value, cardOf(row.value), rect, f && !row.disabled, { empty: row.value === 'suspend' ? '（中断した記録はない）' : '（空き）' });
      this.list.draw(g, { x: p.x + u(10), y: p.y + u(10), w: p.w - u(20), h: p.h - u(20) });
      S.prompts(g, [{ btn: 'a', label: '読み込む' }, { btn: 'b', label: '戻る' }]);
    },
  });
})(window.RPG);
