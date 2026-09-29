// MENUS: 強さ（MODERN_UI §6.7、A14・A15・A17・A22・A30）。ハブの人の札を選ぶと開く。L/R で人を替える。
//   左: 大きな顔、名前・肩書き・前/後、得意な武器・属性の名前（文字の段は出さない）。
//   右: HP/MP 現在/最大、能力値 6 つ（0〜25、棒）、熟練（系統と属性の名前と段 1〜100。補正の数字は出さない。前に見た後に上がった物は ▲n）、今の装備。
//   出さない物: Lv・経験値・次のレベル・計算値（攻撃力など）・特性・役割・紹介文。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  S.def('status', {
    init(p) {
      this.ci = Math.max(0, S.party().findIndex((c) => c.id === (p && p.id)));
    },
    update() {
      const I = R.Input;
      const k = S.charInput(this.ci, S.party().length, this.lr);
      if (k >= 0) { this.ci = k; return; }
      if (I.repeat('right')) { this.ci = (this.ci + 1) % S.party().length; R.UIK.sfx('cursor'); return; }
      if (I.repeat('left')) { this.ci = (this.ci + S.party().length - 1) % S.party().length; R.UIK.sfx('cursor'); return; }
      if (I.pressed('b') || I.pressed('a')) { R.UIK.sfx('cancel'); this.close(undefined); }
    },
    /** 熟練度の ▲: 初めてこの人を見たとき R.Game.profNew[人] を写して消す（開いている間は ▲ を出したまま。次に開けば消えている） */
    profSeen(c) {
      const seen = (this.seenProf = this.seenProf || {});
      if (!(c.id in seen)) {
        const G = R.Game, m = G && G.profNew && G.profNew[c.id];
        seen[c.id] = m ? Object.assign({}, m) : null;
        if (m) delete G.profNew[c.id];
      }
      return seen[c.id];
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const c = S.party()[this.ci];
      if (!c) return;
      const lw = tall ? b.w : Math.min(u(330), b.w * 0.34);
      const lp = { x: b.x, y: b.y, w: lw, h: tall ? u(176) : b.h };
      R.UIK.panel(g, lp, { frost: true });
      const fs = tall ? u(132) : Math.min(lw - u(48), u(240));
      const fr = tall ? { x: lp.x + u(20), y: lp.y + u(20), w: fs, h: fs } : { x: lp.x + (lw - fs) / 2, y: lp.y + u(24), w: fs, h: fs };
      R.UIK.portraitFrame(g, fr, c.look, { dim: !(c.hp > 0) });
      let x = tall ? fr.x + fs + u(20) : lp.x + u(24), y = tall ? lp.y + u(26) : fr.y + fs + u(20);
      const tw = lp.x + lp.w - u(22) - x;
      const lx = S.lrChips(g, lp.x + lp.w - u(16), lp.y + u(22));
      this.lr = { l: { x: lx - u(4), y: lp.y, w: u(28), h: u(44) }, r: { x: lp.x + lp.w - u(34), y: lp.y, w: u(34), h: u(44) } };
      R.UIK.text(g, c.name, x, y, { size: u(24), weight: 700, color: C.goldHi, maxW: tw - (tall ? u(70) : 0) }); y += u(38);
      const tg = R.UIK.tag(g, c.row, x, y + u(1), u(12));
      R.UIK.text(g, S.title(c), x + tg + u(10), y, { size: u(14), color: C.text2, maxW: tw - tg }); y += u(34);
      const fav = S.favorites(c);
      R.UIK.text(g, R.T('ui.status.draw.text'), x, y, { size: u(12.5), color: C.text3 });
      R.UIK.text(g, fav.w.map(S.wname).join(R.T('ui.status.draw.text.join')) || '―', x + u(96), y - u(1), { size: u(15), weight: 700, color: C.text, maxW: tw - u(96) }); y += u(28);
      R.UIK.text(g, R.T('ui.status.draw.text_2'), x, y, { size: u(12.5), color: C.text3 });
      R.UIK.text(g, fav.e.map(S.ename).join(R.T('ui.status.draw.text.join')) || '―', x + u(96), y - u(1), { size: u(15), weight: 700, color: C.teal, maxW: tw - u(96) });
      // 右
      const rp = tall ? { x: b.x, y: lp.y + lp.h + u(12), w: b.w, h: b.y + b.h - (lp.y + lp.h + u(12)) } : { x: lp.x + lp.w + u(18), y: b.y, w: b.x + b.w - (lp.x + lp.w + u(18)), h: b.h };
      R.UIK.panel(g, rp, { frost: true });
      const px = rp.x + u(24), pw = rp.w - u(48);
      y = rp.y + u(20);
      const st = S.stats(c);
      const half = tall ? pw : (pw - u(28)) / 2;
      // HP・MP
      const hm = (lab, cur, max, kind, xx, yy) => {
        R.UIK.text(g, lab, xx, yy + u(6), { size: u(12), weight: 700, color: C.text3 });
        R.UIK.frac(g, cur, max, xx + half, yy, { size: u(22) });
        R.UIK.gauge(g, { x: xx, y: yy + u(30), w: half, h: u(3) }, cur, max, kind);
      };
      hm('HP', c.hp, st.maxHp, 'hp', px, y);
      if (tall) { y += u(46); hm('MP', c.mp, st.maxMp, 'mp', px, y); } else hm('MP', c.mp, st.maxMp, 'mp', px + half + u(28), y);
      y += u(54);
      R.UIK.rule(g, px, px + pw, y, 0.14); y += u(14);
      S.label(g, R.T('ui.status.draw.label'), px, y); y += u(28);
      y = S.abilBars(g, st, px, y, pw, { cols: 2, lh: 28 }) + u(8);
      R.UIK.rule(g, px, px + pw, y, 0.14); y += u(14);
      S.label(g, R.T('ui.status.draw.label_2'), px, y); y += u(28);
      const Rl = R.Rules;
      const items = [];
      for (const w of Rl.WTYPES || []) items.push({ key: w, name: S.wname(w), icon: w, r: Rl.rankOf(c, 'w', w) });
      for (const e of Rl.ELEMENTS || []) items.push({ key: e, name: S.ename(e), icon: S.elemIcon(e), r: Rl.rankOf(c, 'e', e), el: true });
      const nw = this.profSeen(c);
      const cols = tall ? 2 : 3, cw = (pw - u(18) * (cols - 1)) / cols;
      // 段の数の右端: 列の幅の 6 割か、いちばん長い名前（＋上がった印）と「100」が入る所の遠い方（狭い画面で名前と数字が重ならない）
      const badgeW = (up) => R.UIK.measure('▲' + up, { size: u(10.5), weight: 700 }) + u(16);
      const nameEnd = items.reduce((m, it) => { const up = nw && nw[it.key] != null ? (it.r || 1) - nw[it.key] : 0; return Math.max(m, R.UIK.measure(it.name, { size: u(13.5) }) + (up > 0 ? badgeW(up) : 0)); }, 0);
      const numOff = Math.min(cw - u(24), Math.max(cw * 0.6, u(22) + nameEnd + u(8) + R.UIK.measure('100', { size: u(15), weight: 700 })));
      items.forEach((it, i) => {
        const xx = px + (i % cols) * (cw + u(18)), yy = y + Math.floor(i / cols) * u(28);
        R.UIK.icon(g, it.icon, xx, yy, u(15), it.el ? C.teal : C.text2);
        R.UIK.text(g, it.name, xx + u(22), yy, { size: u(13.5), color: C.text });
        // 前に見た後に上がった物: ▲ と上がった段の数（この画面を開いたら消える＝R.Game.profNew）
        const up = nw && nw[it.key] != null ? (it.r || 1) - nw[it.key] : 0;
        if (up > 0) {
          const bx = xx + u(22) + R.UIK.measure(it.name, { size: u(13.5) }) + u(6), s2 = '▲' + up, bw = R.UIK.measure(s2, { size: u(10.5), weight: 700 }) + u(10);
          g.save(); g.beginPath();
          if (g.roundRect) g.roundRect(bx, yy + u(1), bw, u(16), u(8)); else g.rect(bx, yy + u(1), bw, u(16));
          g.fillStyle = 'rgba(40,90,40,0.85)'; g.fill(); g.strokeStyle = 'rgba(142,224,138,0.8)'; g.lineWidth = 1; g.stroke(); g.restore();
          R.UIK.text(g, s2, bx + bw / 2, yy + u(2.5), { size: u(10.5), weight: 700, color: '#c8f7c0', align: 'center' });
        }
        R.UIK.text(g, String(it.r || 1), xx + numOff, yy - u(1), { size: u(15), weight: 700, color: C.text, align: 'right' });
        R.UIK.gauge(g, { x: xx + numOff + u(8), y: yy + u(7), w: Math.max(u(8), cw - numOff - u(8)), h: u(2) }, it.r || 1, 100, it.el ? ['#3a8a8c', '#8fd6d8'] : ['#8a6a2a', '#f0cf7c']);
      });
      y += Math.ceil(items.length / cols) * u(28) + u(10);
      if (y + u(60) < rp.y + rp.h) {
        R.UIK.rule(g, px, px + pw, y, 0.14); y += u(14);
        S.label(g, R.T('ui.status.draw.label_3'), px, y); y += u(28);
        const N = Rl.SLOT_NAMES || {};
        const slots = Rl.SLOTS || [];
        const ec = 2, ew = (pw - u(18)) / ec;
        slots.forEach((s, i) => {
          const xx = px + (i % ec) * (ew + u(18)), yy = y + Math.floor(i / ec) * u(26);
          if (yy + u(20) > rp.y + rp.h) return;
          R.UIK.text(g, N[s] || s, xx, yy + u(1), { size: u(12), color: C.text3 });
          const id = c.equip[s];
          if (id && tall) R.UIK.text(g, S.item(id).name, xx + u(60), yy, { size: u(14), color: S.gradeColor(S.item(id)) || C.text, maxW: ew - u(60) });
          else if (id) S.itemLabel(g, id, xx + u(60), yy, { size: u(14), maxW: ew - u(60) });
          else R.UIK.text(g, R.T('ui.status.draw.text_3'), xx + u(60), yy, { size: u(14), color: C.disabled });
        });
      }
      S.prompts(g, [{ btn: 'r', label: R.T('ui.status.draw.0.label') }, { btn: 'b', label: R.T('ui.status.draw.1.label') }]);
    },
  });
})(window.RPG);
