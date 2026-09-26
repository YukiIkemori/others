// MENUS: 名前の入力（五十音表、V2_PLAN §3.8、SCREEN_RESULTS.nameentry: params {value, max: 5, title} → string | null）
//   十字で字を選び A で足す。B で 1 字消す（空なら閉じて null）。X でひらがな／カタカナ。下の段: かな切替・消す・決定。
//   マウスとタッチは字を直に押す。最初は決定の上にカーソル（決めた名前をそのまま使える）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  // 列ごと（上から ア イ ウ エ オ の段）
  const A = ['アイウエオ', 'カキクケコ', 'サシスセソ', 'タチツテト', 'ナニヌネノ', 'ハヒフヘホ', 'マミムメモ', 'ヤ ユ ヨ', 'ラリルレロ', 'ワヲンー '];
  const B = ['ガギグゲゴ', 'ザジズゼゾ', 'ダヂヅデド', 'バビブベボ', 'パピプペポ', 'ァィゥェォ', 'ャュョッヴ'];
  const hira = (ch) => { const c = ch.charCodeAt(0); return c >= 0x30a1 && c <= 0x30f6 && ch !== 'ヴ' ? String.fromCharCode(c - 0x60) : ch; };

  function cells(tall) {
    const out = [];
    const put = (cols, gx0, gy0) => cols.forEach((col, ci) => [...col].forEach((ch, ri) => { if (ch !== ' ') out.push({ ch, gx: gx0 + ci, gy: gy0 + ri, w: 1 }); }));
    if (tall) {
      put(A, 0, 0); put(B, 1.5, 5.4);
      out.push({ act: 'kana', gx: 0, gy: 10.8, w: 3.2 }, { act: 'del', gx: 3.4, gy: 10.8, w: 3.2 }, { act: 'ok', gx: 6.8, gy: 10.8, w: 3.2 });
    } else {
      put(A, 0, 0); put(B, 10.6, 0);
      out.push({ act: 'kana', gx: 0, gy: 5.4, w: 5.6 }, { act: 'del', gx: 5.9, gy: 5.4, w: 5.6 }, { act: 'ok', gx: 11.8, gy: 5.4, w: 5.8 });
    }
    return out;
  }

  S.def('nameentry', {
    opaque: true,
    init(p) {
      this.max = p.max || 5;
      this.value = [...String(p.value || '')].slice(0, this.max);
      this.kata = true;
      this.tall = S.tall();
      this.cells = cells(this.tall);
      this.cur = this.cells.findIndex((c) => c.act === (this.value.length ? 'ok' : 'kana'));
      if (!this.value.length) this.cur = 0;
      this.rects = [];
    },
    layout() { const c = this.cells[this.cur]; this.tall = S.tall(); this.cells = cells(this.tall); this.cur = Math.max(0, this.cells.findIndex((x) => (c.act ? x.act === c.act : x.ch === c.ch))); },
    label(c) {
      if (c.act === 'kana') return this.kata ? 'ひらがなへ' : 'カタカナへ';
      if (c.act === 'del') return '1 字消す';
      if (c.act === 'ok') return '決定';
      return this.kata ? c.ch : hira(c.ch);
    },
    press(c) {
      if (c.act === 'kana') { this.kata = !this.kata; R.UIK.sfx('cursor'); return; }
      if (c.act === 'del') { if (this.value.length) { this.value.pop(); R.UIK.sfx('cancel'); } else R.UIK.sfx('buzzer'); return; }
      if (c.act === 'ok') {
        const s = this.value.join('').trim();
        if (!s) { R.UIK.sfx('buzzer'); return; }
        R.UIK.sfx('confirm'); this.close(s); return;
      }
      if (this.value.length >= this.max) { R.UIK.sfx('buzzer'); return; }
      this.value.push(this.label(c)); R.UIK.sfx('cursor');
      if (this.value.length >= this.max) this.cur = this.cells.findIndex((x) => x.act === 'ok');
    },
    move(dx, dy) {
      const c = this.cells[this.cur];
      const cx = c.gx + c.w / 2, cy = c.gy;
      let best = -1, bd = 1e9;
      this.cells.forEach((o, i) => {
        if (i === this.cur) return;
        const ox = o.gx + o.w / 2, oy = o.gy;
        if (dx) {
          if (Math.abs(oy - cy) > 0.3) return;
          const d = (ox - cx) * dx;
          if (d > 0 && d < bd) { bd = d; best = i; }
        } else {
          const d = (oy - cy) * dy;
          if (d <= 0.3) return;
          const score = d * 10 + Math.abs(ox - cx);
          if (score < bd) { bd = score; best = i; }
        }
      });
      if (best < 0) {   // 端から反対の端へ
        this.cells.forEach((o, i) => {
          const ox = o.gx + o.w / 2, oy = o.gy;
          if (dx && Math.abs(oy - cy) <= 0.3) { const d = -(ox - cx) * dx; if (d > 0 && (best < 0 || d > bd)) { bd = d; best = i; } }
          if (dy) { const d = -(oy - cy) * dy; const score = d * 10 - Math.abs(ox - cx); if (d > 0.3 && (best < 0 || score > bd)) { bd = score; best = i; } }
        });
      }
      if (best >= 0) { this.cur = best; R.UIK.sfx('cursor'); }
    },
    update() {
      const I = R.Input;
      if (I.repeat('left')) this.move(-1, 0);
      else if (I.repeat('right')) this.move(1, 0);
      else if (I.repeat('up')) this.move(0, -1);
      else if (I.repeat('down')) this.move(0, 1);
      for (let i = 0; i < this.rects.length; i++) if (S.clicked(this.rects[i])) { this.cur = i; this.press(this.cells[i]); return; }
      if (I.pressed('x')) { this.kata = !this.kata; R.UIK.sfx('cursor'); }
      if (I.pressed('a')) this.press(this.cells[this.cur]);
      else if (I.pressed('b')) {
        if (this.value.length) { this.value.pop(); R.UIK.sfx('cancel'); } else { R.UIK.sfx('cancel'); this.close(null); }
      }
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const cols = tall ? 10 : 17.6, rows = tall ? 11.8 : 6.4;
      const cell = Math.min((b.w - u(40)) / cols, (b.h - u(170)) / rows, u(tall ? 44 : 46));
      const gw = cell * cols, gh = cell * rows;
      const px = b.x + (b.w - gw) / 2 - u(20);
      const p = { x: px, y: b.y + u(4), w: gw + u(40), h: gh + u(160) };
      R.UIK.panel(g, p, {});
      S.heading(g, this.p.title || '名前の入力', p.x + u(24), p.y + u(20), 0, { size: 15, track: 3 });
      // 名前の枠
      const bw = u(46), bx0 = p.x + (p.w - bw * this.max) / 2, by = p.y + u(58);
      for (let i = 0; i < this.max; i++) {
        const x = bx0 + i * bw;
        R.UIK.rule(g, x + u(6), x + bw - u(6), by + u(44), 0.5, i === this.value.length ? C.gold : undefined);
        if (this.value[i]) R.UIK.text(g, this.value[i], x + bw / 2, by + u(6), { size: u(30), weight: 700, color: C.goldHi, align: 'center' });
        else if (i === this.value.length && Math.floor(R.Engine.time / 500) % 2 === 0) R.UIK.diamond(g, x + bw / 2, by + u(24), u(4), C.gold);
      }
      R.UIK.text(g, `${this.value.length} / ${this.max}`, p.x + p.w - u(24), by + u(22), { size: u(12.5), color: C.text3, align: 'right' });
      // 表
      const gx = p.x + u(20), gy = p.y + u(126);
      this.rects = [];
      this.cells.forEach((c, i) => {
        const r = { x: gx + c.gx * cell, y: gy + c.gy * cell, w: c.w * cell, h: cell };
        this.rects.push(r);
        const f = i === this.cur;
        if (c.act) {
          const rr = { x: r.x + u(3), y: r.y + u(3), w: r.w - u(6), h: r.h - u(6) };
          R.UIK.card(g, rr, { focused: f });
          R.UIK.text(g, this.label(c), rr.x + rr.w / 2, rr.y + (rr.h - u(15)) / 2 - u(1), { size: u(15), weight: 700, color: c.act === 'ok' ? (f ? C.goldHi : C.gold) : f ? C.goldHi : C.text, align: 'center' });
        } else {
          if (f) R.UIK.focus(g, { x: r.x + u(2), y: r.y + u(2), w: r.w - u(4), h: r.h - u(4) }, R.Engine.time, { cursor: false });
          R.UIK.text(g, this.label(c), r.x + r.w / 2, r.y + (r.h - u(20)) / 2 - u(1), { size: u(20), weight: f ? 700 : 500, color: f ? C.goldHi : C.text, align: 'center' });
        }
      });
      S.prompts(g, [{ btn: 'a', label: '入れる' }, { btn: 'b', label: '1 字消す' }, { btn: 'x', label: 'かな／カナ' }]);
    },
  });
})(window.RPG);
