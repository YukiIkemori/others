// MENUS: 道具（MODERN_UI §6.5、A2・A6）
//   タブ（L/R）: 使う物／装備品／大事な物。一覧はアイコン・名前・個数。右: 説明（数字の効果は出さない）と「使う → 誰に」の人の札。
//   移動中に使えない物は灰色。使った後も相手の選択は開いたまま（A で続けて使う、B で戻る、カーソルは使った物に残る。A2）。Y で詳しく（A6）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const TABS = [{ label: '使う物', slots: ['use'] }, { label: '装備品', slots: ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'] }, { label: '大事な物', slots: ['key'] }];

  // ---------------------------------------------------------------- 相手を選ぶ（道具と術の共通）
  /** 相手選びを始める。v.tgt = {a, caster, kind, i}。a は品か術の定義 */
  S.targetStart = function (v, a, caster, id) {
    const mem = S.party();
    const kind = S.targetKind(a);
    let i = mem.findIndex((c) => S.canTarget(a, c));
    if (i < 0) i = 0;
    v.tgt = { a, caster, kind, i, id };
  };
  /** 相手選びの入力。use(targets) を呼ぶ。→ true なら入力を使った */
  S.targetUpdate = function (v, use, rects) {
    const t = v.tgt, I = R.Input, mem = S.party(), n = mem.length;
    if (!t) return false;
    if (t.kind === 'one') {
      if (I.repeat('down') || I.repeat('right')) { t.i = (t.i + 1) % n; R.UIK.sfx('cursor'); }
      else if (I.repeat('up') || I.repeat('left')) { t.i = (t.i + n - 1) % n; R.UIK.sfx('cursor'); }
    }
    for (let i = 0; i < (rects || []).length; i++) if (S.clicked(rects[i])) { t.i = i; use(t.kind === 'one' ? [mem[i]] : mem.slice()); return true; }
    if (I.pressed('a')) use(t.kind === 'one' ? [mem[t.i]] : mem.slice());
    else if (I.pressed('b')) { v.tgt = null; R.UIK.sfx('cancel'); }
    return true;
  };
  /** 人の札の列（相手選びのとき光る）。→ rects */
  S.memberCards = function (v, g, p) {
    const mem = S.party(), tall = S.tall();
    const rects = [];
    const gap = u(8);
    const cols = tall ? 2 : 1, rowsN = Math.ceil(mem.length / cols);
    const cw = (p.w - gap * (cols - 1)) / cols, ch = Math.min(u(tall ? 104 : 78), (p.h - gap * (rowsN - 1)) / rowsN);
    mem.forEach((c, i) => {
      const r = { x: p.x + (i % cols) * (cw + gap), y: p.y + Math.floor(i / cols) * (ch + gap), w: cw, h: ch };
      rects.push(r);
      const t = v.tgt;
      const on = t && (t.kind === 'all' ? S.canTarget(t.a, c) : t.i === i);
      const can = !t || S.canTarget(t.a, c);
      const note = t ? S.targetReason(t.a, c) : '';   // 魔石: 「もう覚えている」「術を使えない」
      if (tall) S.tallCard(g, c, r, !!on, { dim: t && !can, note });
      else S.charCard(g, c, r, { focused: !!on, compact: true, face: ch - u(16), dim: t && !can, note });
    });
    return rects;
  };

  S.def('items', {
    init() {
      this.tab = 0;
      this.list = new R.UIK.List({ rows: [], rowH: 34 });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(undefined);
      this.list.onDetail = (row) => { if (row && row.value) S.detail({ kind: 'item', id: row.value }); };
      this.refresh(false);
      this.tgt = null;
      this.cards = [];
    },
    refresh(keep) {
      const slots = TABS[this.tab].slots;
      const ids = S.bag().filter((id) => { const it = S.item(id); return it && slots.includes(it.slot); })
        .sort((a, b) => ((S.item(a).sort || 0) - (S.item(b).sort || 0)) || (a < b ? -1 : 1));
      this.list.setRows(ids.map((id) => {
        const it = S.item(id);
        return { value: id, label: it.name, disabled: it.slot === 'use' ? !S.fieldUsable(it) : it.slot !== 'key' };
      }), keep);
    },
    pick(row) {
      const it = S.item(row.value);
      if (!it || it.slot !== 'use' || !S.fieldUsable(it)) { R.UIK.sfx('buzzer'); return; }
      if (S.targetKind(it) === 'none') { this.use([]); return; }
      S.targetStart(this, it, null, row.value);
    },
    use(targets) {
      const id = this.tgt ? this.tgt.id : (this.list.current() || {}).value;
      const it = S.item(id);
      if (!it || S.count(id) <= 0) { this.tgt = null; return; }
      const ok = targets.filter((c) => S.canTarget(it, c));
      if (targets.length && !ok.length) {
        R.UIK.sfx('buzzer');
        const why = S.targetReason(it, targets[0]);   // 魔石: 使えないわけを出す（品は減らない）
        if (why) R.UIK.toast(`${targets[0].name}は ${why}`, { anchor: 'bl' });
        return;
      }
      const res = S.applyField(it, null, ok);
      if (!res.changed) { R.UIK.sfx('buzzer'); R.UIK.toast('効き目がなかった', { anchor: 'bl' }); return; }
      R.Game.items[id]--;
      if (R.Game.items[id] <= 0) delete R.Game.items[id];
      const learned = (it.use.effects || []).some((e) => e.type === 'learnSpell');
      R.UIK.sfx(learned ? 'glimmer' : 'heal');
      for (const l of res.lines.slice(0, 2)) R.UIK.toast(l, { anchor: 'bl', icon: learned ? 'star' : 'heal' });
      if (S.count(id) <= 0) this.tgt = null;
      this.refresh(true);
    },
    update() {
      if (this.tgt) { S.targetUpdate(this, (t) => this.use(t), this.cards); return; }
      const k = S.tabInput(this.tabRects, this.tab, TABS.length);
      if (k >= 0) { this.tab = k; this.refresh(false); return; }
      this.list.update();
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const lw = tall ? b.w : Math.min(u(420), b.w * 0.46);
      this.tabRects = S.tabs(g, TABS.map((t) => t.label), this.tab, b.x + u(4), b.y + u(4));
      const lp = { x: b.x, y: b.y + u(48), w: lw, h: tall ? b.h * 0.4 : b.h - u(48) };
      R.UIK.panel(g, lp, { frost: true });
      const lr = { x: lp.x + u(8), y: lp.y + u(12), w: lp.w - u(16), h: lp.h - u(24) };
      this.list.active = !this.tgt;
      this.list.render = (gg, row, rect, f) => {
        const sz = u(15);
        S.itemLabel(gg, row.value, rect.x + u(16), rect.y + (rect.h - sz) / 2 - u(1), { focused: f, disabled: row.disabled, maxW: rect.w - u(70) });
        R.UIK.text(gg, '× ' + S.count(row.value), rect.x + rect.w - u(14), rect.y + (rect.h - sz) / 2, { size: sz, color: row.disabled ? C.disabled : C.text2, align: 'right' });
      };
      this.list.draw(g, lr);
      if (!this.list.rows.length) R.UIK.text(g, '何も持っていない。', lr.x + u(16), lr.y + u(8), { size: u(15), color: C.text3 });
      // 右（縦持ちは下）: 説明と人の札
      const rx = tall ? b.x : lp.x + lp.w + u(18), rw = tall ? b.w : b.x + b.w - rx;
      const dy = tall ? lp.y + lp.h + u(10) : b.y + u(4);
      const dp = { x: rx, y: dy, w: rw, h: u(tall ? 118 : 132) };
      R.UIK.panel(g, dp, { frost: true });
      const cur = this.tgt ? this.tgt.id : (this.list.current() || {}).value;
      const it = S.item(cur);
      if (it) {
        R.UIK.text(g, it.name, dp.x + u(20), dp.y + u(16), { size: u(19), weight: 700, color: S.gradeColor(it) || C.goldHi, maxW: dp.w - u(40) });
        const kind = it.slot === 'use' ? (it.use && it.use.field ? (S.fieldUsable(it) ? 'フィールドで使える' : '戦闘で使う') : '戦闘で使う') : it.slot === 'key' ? '大事な物' : S.kindLine(it);
        R.UIK.text(g, kind, dp.x + dp.w - u(20), dp.y + u(20), { size: u(12.5), color: C.text3, align: 'right' });
        let yy = dp.y + u(50);
        for (const l of R.UIK.wrap(String(it.desc || '').replace(/\n/g, ''), dp.w - u(40), { size: u(14.5) }).slice(0, 3)) { R.UIK.text(g, l, dp.x + u(20), yy, { size: u(14.5), color: C.text }); yy += u(24); }
      }
      const cp = { x: rx, y: dp.y + dp.h + u(12), w: rw, h: b.y + b.h - (dp.y + dp.h + u(12)) };
      if (this.tgt) R.UIK.text(g, this.tgt.kind === 'all' ? 'みんなに使う' : '誰に使う？', cp.x + u(4), cp.y - u(2), { size: u(13), weight: 700, color: C.gold });
      this.cards = S.memberCards(this, g, { x: cp.x, y: cp.y + (this.tgt ? u(20) : 0), w: cp.w, h: cp.h - (this.tgt ? u(20) : 0) });
      S.prompts(g, this.tgt ? [{ btn: 'a', label: '使う' }, { btn: 'b', label: '戻る' }] : [{ btn: 'a', label: '使う' }, { btn: 'y', label: '詳しく' }, { btn: 'l', label: '種類' }, { btn: 'b', label: '戻る' }]);
    },
  });
})(window.RPG);
