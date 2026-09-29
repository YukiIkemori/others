// MENUS: 並びと隊列（MODERN_UI §6.9、A15）
//   4 人の札を横に並べ（縦持ちは 2×2）、A で持ち上げて ←→ で動かし、A で置く（R.Party.setOrder）。
//   ↑ で前列・↓ で後列（縦持ちは X で切り替え、R.Party.setRow）。隊列の文字は「前列／後列」。数字は出さない。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  S.def('order', {
    init() { this.i = 0; this.held = -1; this.rects = []; },
    ids() { return (R.Game && R.Game.party) || []; },
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
      if (!c || c.row === row) return;
      R.Party.setRow(c.id, row);
      R.UIK.sfx('cursor');
    },
    move(d) {
      const n = this.ids().length;
      const j = (this.i + d + n) % n;
      if (this.held >= 0) this.swapTo(j); else { this.i = j; R.UIK.sfx('cursor'); }
    },
    update() {
      const I = R.Input, tall = S.tall();
      for (let k = 0; k < this.rects.length; k++) {
        if (this.tagRects && S.clicked(this.tagRects[k])) { this.i = k; this.setRow(S.party()[k].row === 'front' ? 'back' : 'front'); return; }
        if (S.clicked(this.rects[k])) {
          if (this.held >= 0) { this.swapTo(k); this.held = -1; R.UIK.sfx('confirm'); } else { this.i = k; this.held = k; R.UIK.sfx('confirm'); }
          return;
        }
      }
      if (I.repeat('right')) this.move(1);
      else if (I.repeat('left')) this.move(-1);
      else if (tall && I.repeat('down')) this.move(2);
      else if (tall && I.repeat('up')) this.move(-2);
      else if (!tall && I.pressed('up')) this.setRow('front');
      else if (!tall && I.pressed('down')) this.setRow('back');
      else if (I.pressed('x')) { const c = S.party()[this.i]; if (c) this.setRow(c.row === 'front' ? 'back' : 'front'); }
      else if (I.pressed('a')) { if (this.held >= 0) { this.held = -1; R.UIK.sfx('confirm'); } else { this.held = this.i; R.UIK.sfx('confirm'); } }
      else if (I.pressed('b')) { if (this.held >= 0) { this.held = -1; R.UIK.sfx('cancel'); } else { R.UIK.sfx('cancel'); this.close(undefined); } }
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      S.heading(g, R.T('ui.order.draw.heading'), b.x + u(8), b.y + u(6), 0, { size: 15, track: 3 });
      const mem = S.party(), n = mem.length;
      const cols = tall ? 2 : Math.max(1, n), gap = u(14);
      const top = b.y + u(56);
      const cw = (b.w - gap * (cols - 1)) / cols;
      const ch = tall ? Math.min(u(330), (b.h - u(170)) / 2) : Math.min(u(330), b.h - u(150));
      this.rects = []; this.tagRects = [];
      mem.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const back = c.row === 'back';
        const lift = i === this.held ? -u(10) : 0;
        const r = { x: b.x + col * (cw + gap), y: top + row * (ch + gap) + (back ? u(26) : 0) + lift, w: cw, h: ch - u(26) };
        this.rects.push(r);
        const f = i === this.i;
        R.UIK.card(g, r, { focused: f, frost: true });
        if (i === this.held) { g.save(); R.UIK.rr(g, r.x, r.y, r.w, r.h, u(8)); g.strokeStyle = C.teal; g.lineWidth = 1.5; g.stroke(); g.restore(); }
        const tr = { x: r.x + u(12), y: r.y + u(12), w: u(64), h: u(26) };
        this.tagRects.push(tr);
        R.UIK.chip(g, tr.x, tr.y, back ? R.T('ui.order.draw.chip') : R.T('ui.order.draw.chip_2'), { size: 12, color: back ? C.back : C.front, bg: back ? 'rgba(169,210,242,0.14)' : 'rgba(242,194,138,0.16)', line: back ? 'rgba(169,210,242,0.5)' : 'rgba(242,194,138,0.55)' });
        R.UIK.text(g, String(i + 1), r.x + r.w - u(14), r.y + u(12), { size: u(13), color: C.text3, align: 'right' });
        const fs = Math.min(r.w - u(40), r.h * 0.46);
        R.UIK.portraitFrame(g, { x: r.x + (r.w - fs) / 2, y: r.y + u(48), w: fs, h: fs }, c.look, { dim: !(c.hp > 0) });
        let y = r.y + u(58) + fs;
        R.UIK.text(g, c.name, r.x + r.w / 2, y, { size: u(17), weight: 700, color: f ? C.goldHi : C.text, align: 'center', maxW: r.w - u(16) }); y += u(26);
        R.UIK.text(g, S.title(c), r.x + r.w / 2, y, { size: u(12.5), color: C.text2, align: 'center', maxW: r.w - u(16) }); y += u(26);
        const wid = c.equip && c.equip.weapon1, it = S.item(wid);
        const reach = wid ? R.Rules.reach(wid) : 'front';
        const wname = it ? it.name : R.T('ui.order.draw.wname');
        R.UIK.text(g, wname, r.x + r.w / 2, y, { size: u(13), color: C.text, align: 'center', maxW: r.w - u(16) }); y += u(22);
        if (back && reach !== 'any') R.UIK.text(g, R.T('ui.order.draw.text'), r.x + r.w / 2, y, { size: u(12), color: C.down, align: 'center', maxW: r.w - u(12) });
        else if (back) R.UIK.text(g, R.T('ui.order.draw.text_2'), r.x + r.w / 2, y, { size: u(12), color: C.teal, align: 'center', maxW: r.w - u(12) });
      });
      const hy = b.y + b.h - u(26);
      R.UIK.icon(g, 'bulb', b.x + u(8), hy, u(15), C.teal);
      R.UIK.text(g, R.T('ui.order.draw.text_3'), b.x + u(30), hy, { size: u(13.5), color: C.text2, maxW: b.w - u(30) });
      S.prompts(g, this.held >= 0 ? [{ btn: 'left', label: R.T('ui.order.draw.0.label') }, { btn: 'a', label: R.T('ui.order.draw.1.label') }] : tall ? [{ btn: 'a', label: R.T('ui.order.draw.0.label_2') }, { btn: 'x', label: R.T('ui.order.draw.1.label_2') }, { btn: 'b', label: R.T('ui.order.draw.2.label') }] : [{ btn: 'a', label: R.T('ui.order.draw.0.label_2') }, { btn: 'up', label: R.T('ui.order.draw.1.label_2') }, { btn: 'b', label: R.T('ui.order.draw.2.label') }]);
    },
  });
})(window.RPG);
