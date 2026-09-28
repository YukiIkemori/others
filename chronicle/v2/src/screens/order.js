// MENUS: 並びと隊列（MODERN_UI §6.9、A15）
//   4 人の札を横に並べ（縦持ちは 2×2）、A で持ち上げて ←→ で動かし、A で置く（R.Party.setOrder）。
//   ↑ で前列・↓ で後列（縦持ちは X で切り替え、R.Party.setRow）。隊列の文字は「前列／後列」。数字は出さない。
//   決めるのは札の下の「これでよい」（A）。持ち主 2026-09-28「B の戻るで決定されるのは分かりづらい。A で決定にするため、これで良い、みたいな項目」:
//     - 後列の札で ↓（縦持ちは下の段で ↓）・START で「これでよい」へ。↑・←→ で札へ戻る
//     - B は取り消し: 持ち上げている間は元の所へ戻す。変えていれば「変えた並びを取り消す？」を聞き、取り消すと開いたときの並びと隊列に戻して閉じる
//     - 変えた並びは画面の中でも見えるように、その場で R.Party に入れる（戦闘の順・フィールドの先頭は閉じるまで使わない）
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  S.def('order', {
    init() {
      this.i = 0; this.held = -1; this.rects = []; this.okRect = null; this.onOk = false; this.busy = false;
      this.orig = this.snap();
      this.liftFrom = null;
    },
    ids() { return (R.Game && R.Game.party) || []; },
    /** 今の並びと隊列 {ids, rows:{id: row}} */
    snap() {
      const rows = {};
      for (const c of S.party()) rows[c.id] = c.row;
      return { ids: this.ids().slice(), rows };
    },
    restore(sn) {
      if (!sn) return;
      R.Party.setOrder(sn.ids.slice());
      for (const c of S.party()) if (sn.rows[c.id] && c.row !== sn.rows[c.id]) R.Party.setRow(c.id, sn.rows[c.id]);
    },
    /** 開いたときから並びか隊列が変わったか */
    changed() {
      const now = this.snap(), o = this.orig;
      if (now.ids.join() !== o.ids.join()) return true;
      return Object.keys(now.rows).some((id) => now.rows[id] !== o.rows[id]);
    },
    swapTo(j) {
      const ids = this.ids().slice();
      if (j < 0 || j >= ids.length || this.held < 0) return;
      const t = ids[this.held]; ids[this.held] = ids[j]; ids[j] = t;
      R.Party.setOrder(ids);
      this.held = j; this.i = j;
      R.UIK.sfx('cursor');
    },
    setRow(row) {
      const c = S.party()[this.i];
      if (!c || c.row === row) return false;
      R.Party.setRow(c.id, row);
      R.UIK.sfx('cursor');
      return true;
    },
    move(d) {
      const n = this.ids().length;
      if (this.onOk) { this.onOk = false; R.UIK.sfx('cursor'); return; }
      const j = (this.i + d + n) % n;
      if (this.held >= 0) this.swapTo(j); else { this.i = j; R.UIK.sfx('cursor'); }
    },
    lift() { this.held = this.i; this.liftFrom = this.ids().slice(); R.UIK.sfx('confirm'); },
    put() { this.held = -1; this.liftFrom = null; R.UIK.sfx('confirm'); },
    /** 持ち上げたのをやめる: 持ち上げる前の並びに戻す */
    unlift() {
      if (this.liftFrom) { const j = this.liftFrom.indexOf(this.ids()[this.held]); R.Party.setOrder(this.liftFrom.slice()); if (j >= 0) this.i = j; }
      this.held = -1; this.liftFrom = null;
      R.UIK.sfx('cancel');
    },
    focusOk() { if (!this.onOk) { this.onOk = true; R.UIK.sfx('cursor'); } },
    /** 「これでよい」: 今の並びで閉じる */
    accept() { R.UIK.sfx('confirm'); this.close(undefined); },
    /** B（持ち上げていないとき）: 変えていなければそのまま閉じる。変えていれば取り消すか聞く */
    async back() {
      if (!this.changed()) { R.UIK.sfx('cancel'); this.close(undefined); return; }
      this.busy = true;
      const k = await S.ask(this, { title: '並びと隊列', text: '変えた並びを取り消して戻る？', choices: ['取り消して戻る', '並べ直しを続ける'], cancel: 1 });
      this.busy = false;
      if (k === 0) { this.restore(this.orig); R.UIK.sfx('cancel'); this.close(undefined); }
    },
    update() {
      if (this.busy) return;
      const I = R.Input, tall = S.tall(), n = this.ids().length;
      if (this.okRect && S.clicked(this.okRect)) { if (this.held >= 0) this.put(); this.accept(); return; }
      for (let k = 0; k < this.rects.length; k++) {
        if (this.tagRects && S.clicked(this.tagRects[k])) { this.onOk = false; this.i = k; this.setRow(S.party()[k].row === 'front' ? 'back' : 'front'); return; }
        if (S.clicked(this.rects[k])) {
          this.onOk = false;
          if (this.held >= 0) { this.swapTo(k); this.put(); } else { this.i = k; this.lift(); }
          return;
        }
      }
      if (this.onOk) {
        if (I.pressed('a') || I.pressed('start')) { this.accept(); return; }
        if (I.pressed('b')) { this.back(); return; }
        if (I.repeat('up') || I.repeat('left') || I.repeat('right')) { this.onOk = false; R.UIK.sfx('cursor'); }
        return;
      }
      if (I.pressed('start') && this.held < 0) { this.focusOk(); return; }
      if (I.repeat('right')) this.move(1);
      else if (I.repeat('left')) this.move(-1);
      else if (tall && I.repeat('down')) { if (this.held < 0 && this.i + 2 >= n) this.focusOk(); else this.move(2); }
      else if (tall && I.repeat('up')) this.move(-2);
      else if (!tall && I.pressed('up')) this.setRow('front');
      else if (!tall && I.pressed('down')) { if (!this.setRow('back') && this.held < 0) this.focusOk(); }   // 後列の札でもう一度 ↓ →「これでよい」
      else if (I.pressed('x')) { const c = S.party()[this.i]; if (c) this.setRow(c.row === 'front' ? 'back' : 'front'); }
      else if (I.pressed('a')) { if (this.held >= 0) this.put(); else this.lift(); }
      else if (I.pressed('b')) { if (this.held >= 0) this.unlift(); else this.back(); }
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      S.heading(g, '並びと隊列', b.x + u(8), b.y + u(6), 0, { size: 15, track: 3 });
      const mem = S.party(), n = mem.length;
      const cols = tall ? 2 : Math.max(1, n), gap = u(14);
      const top = b.y + u(56);
      const cw = (b.w - gap * (cols - 1)) / cols;
      const okH = u(46);
      const ch = tall ? Math.min(u(330), (b.h - u(170) - okH - u(14)) / 2) : Math.min(u(330), b.h - u(150) - okH - u(18));
      this.rects = []; this.tagRects = [];
      let bottom = top;
      mem.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const back = c.row === 'back';
        const lift = i === this.held ? -u(10) : 0;
        const r = { x: b.x + col * (cw + gap), y: top + row * (ch + gap) + (back ? u(26) : 0) + lift, w: cw, h: ch - u(26) };
        bottom = Math.max(bottom, top + row * (ch + gap) + ch);
        this.rects.push(r);
        const f = i === this.i && !this.onOk;
        R.UIK.card(g, r, { focused: f, frost: true });
        if (i === this.held) { g.save(); R.UIK.rr(g, r.x, r.y, r.w, r.h, u(8)); g.strokeStyle = C.teal; g.lineWidth = 1.5; g.stroke(); g.restore(); }
        const tr = { x: r.x + u(12), y: r.y + u(12), w: u(64), h: u(26) };
        this.tagRects.push(tr);
        R.UIK.chip(g, tr.x, tr.y, back ? '後列' : '前列', { size: 12, color: back ? C.back : C.front, bg: back ? 'rgba(169,210,242,0.14)' : 'rgba(242,194,138,0.16)', line: back ? 'rgba(169,210,242,0.5)' : 'rgba(242,194,138,0.55)' });
        R.UIK.text(g, String(i + 1), r.x + r.w - u(14), r.y + u(12), { size: u(13), color: C.text3, align: 'right' });
        const fs = Math.min(r.w - u(40), r.h * 0.46);
        R.UIK.portraitFrame(g, { x: r.x + (r.w - fs) / 2, y: r.y + u(48), w: fs, h: fs }, c.look, { dim: !(c.hp > 0) });
        let y = r.y + u(58) + fs;
        R.UIK.text(g, c.name, r.x + r.w / 2, y, { size: u(17), weight: 700, color: f ? C.goldHi : C.text, align: 'center', maxW: r.w - u(16) }); y += u(26);
        R.UIK.text(g, S.title(c), r.x + r.w / 2, y, { size: u(12.5), color: C.text2, align: 'center', maxW: r.w - u(16) }); y += u(26);
        const wid = c.equip && c.equip.weapon1, it = S.item(wid);
        const reach = wid ? R.Rules.reach(wid) : 'front';
        const wname = it ? it.name : '素手';
        R.UIK.text(g, wname, r.x + r.w / 2, y, { size: u(13), color: C.text, align: 'center', maxW: r.w - u(16) }); y += u(22);
        if (back && reach !== 'any') R.UIK.text(g, '前まで届かない', r.x + r.w / 2, y, { size: u(12), color: C.down, align: 'center', maxW: r.w - u(12) });
        else if (back) R.UIK.text(g, '後ろから届く', r.x + r.w / 2, y, { size: u(12), color: C.teal, align: 'center', maxW: r.w - u(12) });
      });
      // 「これでよい」（札の下の中央。A で決める）
      const ow = Math.min(b.w, u(300)), ok = { x: b.x + (b.w - ow) / 2, y: bottom + u(18), w: ow, h: okH };
      this.okRect = ok;
      const fo = this.onOk || S.over(ok);
      R.UIK.card(g, ok, { focused: fo, frost: true });
      R.UIK.icon(g, 'order', ok.x + u(20), ok.y + ok.h / 2 - u(8), u(16), fo ? C.goldHi : C.text2);
      R.UIK.text(g, 'これでよい', ok.x + ok.w / 2, ok.y + ok.h / 2 - u(10), { size: u(17), weight: 700, color: fo ? C.goldHi : C.text, align: 'center' });
      if (this.changed()) R.UIK.text(g, '変えた並び', ok.x + ok.w - u(14), ok.y + ok.h / 2 - u(7), { size: u(11.5), color: C.teal, align: 'right' });
      const hy = b.y + b.h - u(26);
      R.UIK.icon(g, 'bulb', b.x + u(8), hy, u(15), C.teal);
      R.UIK.text(g, '後列は狙われにくいが、弓と杖のほかは前まで届かない。', b.x + u(30), hy, { size: u(13.5), color: C.text2, maxW: b.w - u(30) });
      const cancel = { btn: 'b', label: this.changed() ? '取り消す' : '戻る' };
      S.prompts(g, this.onOk ? [{ btn: 'a', label: 'これでよい' }, { btn: 'up', label: '札へ戻る' }, cancel]
        : this.held >= 0 ? [{ btn: 'left', label: '動かす' }, { btn: 'a', label: '置く' }, { btn: 'b', label: 'やめる' }]
          : tall ? [{ btn: 'a', label: '持ち上げる' }, { btn: 'x', label: '前列／後列' }, { btn: 'start', label: 'これでよい' }, cancel]
            : [{ btn: 'a', label: '持ち上げる' }, { btn: 'up', label: '前列／後列' }, { btn: 'start', label: 'これでよい' }, cancel]);
    },
  });
})(window.RPG);
