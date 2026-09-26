// MENUS: 仲間選び（潮風亭の 20 人から 3 人、V2_PLAN §3.3 P6・§3.11、MODERN_UI §6.14、A14・A15・A17）
//   ↑↓ で行・←→ で列。札に出すのは 名前・肩書き・得意武器/得意属性の名前・能力値だけ（紹介文・特性・役割・文字の段は出さない）。
//   A で選ぶ／外す、B で最後に選んだ人を外す。人数がそろったら確かめて、id の配列を返す（加入は呼ぶ側の ev.chooseCompanions）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  /** 仲間のデータから、画面に出す物（加入していなくても出せる形） */
  S.companion = function (id) {
    const cp = R.DB.companions[id] || {};
    const c = S.char(id);
    const fake = { id, name: cp.name || id, look: cp.look || id, fav: null, equip: {} };
    const fav = S.favorites(c || fake);
    let st = null;
    try { st = R.Rules.baseStats(c || fake); } catch (e) { st = cp.stats || {}; }
    return { id, name: cp.name || id, title: cp.title || '', look: cp.look || id, row: cp.row || 'front', fav, stats: st || cp.stats || {}, c };
  };
  /** 小さな札（顔・名前・肩書き） */
  S.companionCard = function (g, info, r, o) {
    o = o || {};
    const C = T().color;
    R.UIK.card(g, r, { focused: o.focused, frost: true });
    if (o.picked) { g.save(); R.UIK.rr(g, r.x, r.y, r.w, r.h, u(8)); g.strokeStyle = C.teal; g.lineWidth = 1.5; g.stroke(); g.restore(); }
    const fs = r.h - u(12);
    R.UIK.portraitFrame(g, { x: r.x + u(6), y: r.y + u(6), w: fs, h: fs }, info.look, { dim: o.dim });
    const x = r.x + fs + u(14), w = r.x + r.w - x - u(6);
    R.UIK.text(g, info.name, x, r.y + u(9), { size: u(15), weight: 700, color: o.dim ? C.disabled : o.focused ? C.goldHi : C.text, maxW: w });
    R.UIK.text(g, info.title, x, r.y + u(31), { size: u(12), color: o.dim ? C.disabled : C.text2, maxW: w });
    if (o.chip) R.UIK.chip(g, r.x + r.w - u(6) - R.UIK.measure(o.chip, { size: u(10), weight: 700 }) - u(16), r.y + r.h - u(22), o.chip, { kind: o.chipKind || 'teal', size: 10 });
  };
  /** 詳しい札（顔・名前・肩書き・得意・能力値） */
  S.companionDetail = function (g, info, p) {
    const C = T().color, tall = S.tall();
    R.UIK.panel(g, p, { frost: true });
    const fs = Math.min(u(tall ? 96 : 150), p.w * 0.38);
    R.UIK.portraitFrame(g, { x: p.x + u(22), y: p.y + u(22), w: fs, h: fs }, info.look, {});
    const tx = p.x + fs + u(40), tw = p.x + p.w - u(22) - tx;
    let y = p.y + u(26);
    R.UIK.text(g, info.name, tx, y, { size: u(24), weight: 700, color: C.goldHi, maxW: tw }); y += u(38);
    R.UIK.text(g, info.title, tx, y, { size: u(14.5), color: C.text2, maxW: tw }); y += u(28);
    R.UIK.tag(g, info.row, tx, y, u(12));
    R.UIK.text(g, info.row === 'back' ? '後列が得意' : '前列が得意', tx + u(26), y, { size: u(12.5), color: C.text3 });
    y = Math.max(y + u(30), p.y + u(22) + fs + u(18));
    const fw = info.fav.w.map(S.wname).join('・') || '―', fe = info.fav.e.map(S.ename).join('・') || '―';
    R.UIK.text(g, '得意な武器', p.x + u(22), y, { size: u(13), color: C.text2 });
    R.UIK.text(g, fw, p.x + u(132), y - u(1), { size: u(15), weight: 700, color: C.text, maxW: p.w - u(154) }); y += u(28);
    R.UIK.text(g, '得意な属性', p.x + u(22), y, { size: u(13), color: C.text2 });
    R.UIK.text(g, fe, p.x + u(132), y - u(1), { size: u(15), weight: 700, color: C.teal, maxW: p.w - u(154) }); y += u(34);
    R.UIK.rule(g, p.x + u(22), p.x + p.w - u(22), y - u(8), 0.14);
    S.label(g, '能力値', p.x + u(22), y + u(2));
    S.abilBars(g, info.stats, p.x + u(22), y + u(30), p.w - u(44), { cols: 2, lh: 26 });
  };

  S.def('partySelect', {
    opaque: true,
    init(p) {
      this.count = p.count || 3;
      this.ids = (R.Party.candidates ? R.Party.candidates() : Object.keys(R.DB.companions)).filter((id) => !(R.Game && R.Game.party && R.Game.party.includes(id)));
      this.info = {};
      for (const id of this.ids) this.info[id] = S.companion(id);
      this.picks = [];
      this.list = new R.UIK.List({ rows: this.ids.map((id) => ({ label: this.info[id].name, value: id })), rowH: 58, cols: S.tall() ? 2 : 4 });
      this.list.onSelect = (row) => this.toggle(row.value);
      this.list.onCancel = () => { if (this.picks.length) { this.picks.pop(); } else R.UIK.sfx('buzzer'); };
      this.busy = false;
    },
    layout() { this.list.cols = S.tall() ? 2 : 4; },
    async toggle(id) {
      if (this.busy) return;
      const i = this.picks.indexOf(id);
      if (i >= 0) { this.picks.splice(i, 1); return; }
      if (this.picks.length >= this.count) { R.UIK.sfx('buzzer'); return; }
      this.picks.push(id);
      if (this.picks.length === this.count) {
        this.busy = true;
        const names = this.picks.map((x) => this.info[x].name).join('・');
        const k = await S.ask(this, { title: '旅の仲間', text: names + '　の ' + this.count + ' 人で旅立つ？', choices: ['旅立つ', '選び直す'], cancel: 1 });
        this.busy = false;
        if (k === 0) this.close(this.picks.slice());
        else this.picks.pop();
      }
    },
    update() { if (!this.busy) this.list.update(); },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const cur = this.ids[this.list.index];
      // 上: 見出しと選んだ人
      S.heading(g, '仲間を選ぶ', b.x + u(8), b.y + u(6), 0, { size: 15, track: 3 });
      const hx = b.x + b.w;
      for (let i = this.count - 1; i >= 0; i--) {
        const id = this.picks[i], cx = hx - u(22) - (this.count - 1 - i) * u(48);
        if (id) S.faceCircle(g, this.info[id].look, cx, b.y + u(16), u(18), { ring: C.teal });
        else { g.save(); g.beginPath(); g.arc(cx, b.y + u(16), u(18), 0, Math.PI * 2); g.setLineDash([u(3), u(3)]); g.strokeStyle = 'rgba(240,228,200,0.3)'; g.stroke(); g.restore(); }
      }
      R.UIK.text(g, `あと ${this.count - this.picks.length} 人`, hx - u(22) - this.count * u(48) + u(4), b.y + u(8), { size: u(14), color: C.text2, align: 'right' });
      const top = b.y + u(48);
      let gr, dp;
      if (tall) {
        dp = { x: b.x, y: top, w: b.w, h: u(300) };
        gr = { x: b.x, y: dp.y + dp.h + u(12), w: b.w, h: b.y + b.h - (dp.y + dp.h + u(12)) };
      } else {
        const gw = Math.min(b.w * 0.62, u(640));
        gr = { x: b.x, y: top, w: gw, h: b.h - (top - b.y) };
        dp = { x: b.x + gw + u(20), y: top, w: b.w - gw - u(20), h: gr.h };
      }
      const rh = this.list.rowPx();
      gr.h = Math.floor(gr.h / rh) * rh;
      this.list.render = (gg, row, rect, f) => {
        const id = row.value, k = this.picks.indexOf(id);
        S.companionCard(gg, this.info[id], { x: rect.x + u(3), y: rect.y + u(3), w: rect.w - u(6), h: rect.h - u(6) }, { focused: f, picked: k >= 0, chip: k >= 0 ? `${k + 1} 人目` : null });
      };
      this.list.draw(g, gr);
      if (cur) S.companionDetail(g, this.info[cur], dp);
      S.prompts(g, [{ btn: 'a', label: this.picks.includes(cur) ? '外す' : '選ぶ' }, { btn: 'b', label: '1 人戻す' }]);
    },
  });
})(window.RPG);
