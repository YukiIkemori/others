// MENUS: 酒場の仲間の入れ替え（ファロスの潮風亭だけ、A17。MODERN_UI §6.14）
//   左: 仲間 20 人の札（↑↓ 行・←→ 列、A15）。右: 選んだ人の顔・名前・肩書き・得意な武器/属性・能力値（A14）。下: 今の 4 人。
//   A で仲間を選ぶ → 下の 4 人から相手を選んで A で交代（R.Party.swap。まだ加わっていない人は R.Party.join してから）。主人公は控えに行かない。
//   params {swap}（false なら見るだけ）→ undefined
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  S.def('tavern', {
    opaque: true,
    init(p) {
      this.canSwap = p.swap !== false;
      this.ids = R.Party.candidates ? R.Party.candidates() : Object.keys(R.DB.companions);
      this.list = new R.UIK.List({ rows: this.ids.map((id) => ({ label: id, value: id })), rowH: 58, cols: S.tall() ? 2 : 4 });
      this.list.onSelect = (row) => this.choose(row.value);
      this.list.onCancel = () => this.close(undefined);
      this.mode = 'pick';
      this.mi = 1;
      this.mrects = [];
      this.busy = false;
    },
    layout() { this.list.cols = S.tall() ? 2 : 4; },
    state(id) {
      const G = R.Game;
      if (G.party.includes(id)) return 'party';
      if (G.reserve.includes(id)) return 'reserve';
      return 'none';
    },
    choose(id) {
      if (!this.canSwap) { R.UIK.sfx('buzzer'); return; }
      if (this.state(id) === 'party') { R.UIK.sfx('buzzer'); R.UIK.toast('もう一緒に旅をしている', { anchor: 'bl' }); return; }
      this.mode = 'swap'; this.pick = id;
      const mem = S.party();
      this.mi = Math.max(0, mem.findIndex((c) => c.id !== 'hero'));
    },
    doSwap(member) {
      if (!member || member.id === 'hero') { R.UIK.sfx('buzzer'); return; }
      const id = this.pick;
      try {
        if (!R.Party.isRecruited(id)) R.Party.join(id, { joinFrom: 'tavern' });
        R.Party.swap(member.id, id);
        R.UIK.sfx('confirm');
        R.UIK.toast(`${member.name} と ${S.char(id).name} が入れ替わった`, { anchor: 'bl', icon: 'person' });
      } catch (e) { console.error(e); R.UIK.sfx('buzzer'); }
      this.mode = 'pick';
    },
    update() {
      const I = R.Input;
      if (this.mode === 'swap') {
        const mem = S.party(), n = mem.length;
        if (I.repeat('right')) { this.mi = (this.mi + 1) % n; R.UIK.sfx('cursor'); }
        if (I.repeat('left')) { this.mi = (this.mi + n - 1) % n; R.UIK.sfx('cursor'); }
        for (let i = 0; i < this.mrects.length; i++) if (S.clicked(this.mrects[i])) { this.mi = i; this.doSwap(mem[i]); return; }
        if (I.pressed('a')) this.doSwap(mem[this.mi]);
        else if (I.pressed('b')) { this.mode = 'pick'; R.UIK.sfx('cancel'); }
        return;
      }
      this.list.update();
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      S.heading(g, '仲間の入れ替え', b.x + u(8), b.y + u(6), 0, { size: 15, track: 3 });
      R.UIK.text(g, '潮風亭', b.x + b.w - u(8), b.y + u(6), { size: u(14), color: C.text2, align: 'right' });
      const top = b.y + u(46), memH = u(88);
      let gr, dp, mp;
      if (tall) {
        dp = { x: b.x, y: top, w: b.w, h: u(318) };
        mp = { x: b.x, y: dp.y + dp.h + u(10), w: b.w, h: memH };
        gr = { x: b.x, y: mp.y + mp.h + u(10), w: b.w, h: b.y + b.h - (mp.y + mp.h + u(10)) };
      } else {
        const gw = Math.min(b.w * 0.62, u(640));
        gr = { x: b.x, y: top, w: gw, h: b.h - (top - b.y) - memH - u(12) };
        mp = { x: b.x, y: gr.y + gr.h + u(12), w: gw, h: memH };
        dp = { x: b.x + gw + u(20), y: top, w: b.w - gw - u(20), h: b.h - (top - b.y) };
      }
      const rh = this.list.rowPx();
      gr.h = Math.max(rh, Math.floor(gr.h / rh) * rh);
      this.list.active = this.mode === 'pick';
      this.list.render = (gg, row, rect, f) => {
        const id = row.value, st = this.state(id);
        S.companionCard(gg, S.companion(id), { x: rect.x + u(3), y: rect.y + u(3), w: rect.w - u(6), h: rect.h - u(6) },
          { focused: f && this.mode === 'pick', picked: this.mode === 'swap' && this.pick === id, chip: st === 'party' ? '出撃中' : st === 'reserve' ? '控え' : null, chipKind: st === 'party' ? 'gold' : 'teal' });
      };
      this.list.draw(g, gr);
      const cur = this.mode === 'swap' ? this.pick : this.ids[this.list.index];
      if (cur) S.companionDetail(g, S.companion(cur), dp);
      // 今の 4 人
      R.UIK.panel(g, mp, { frost: true });
      const mem = S.party(), n = Math.max(1, mem.length), cw = (mp.w - u(20)) / n;
      R.UIK.text(g, this.mode === 'swap' ? '誰と入れ替える？' : 'いまの仲間', mp.x + u(14), mp.y + u(8), { size: u(12), weight: 700, color: C.gold, track: u(1) });
      this.mrects = [];
      mem.forEach((c, i) => {
        const r = { x: mp.x + u(10) + i * cw, y: mp.y + u(28), w: cw - u(6), h: mp.h - u(36) };
        this.mrects.push(r);
        const f = this.mode === 'swap' && i === this.mi;
        if (f) R.UIK.focus(g, r, R.Engine.time, { cursor: false });
        S.faceCircle(g, c.look, r.x + u(24), r.y + r.h / 2, u(20), { dim: this.mode === 'swap' && c.id === 'hero' });
        if (!tall) R.UIK.text(g, c.name, r.x + u(52), r.y + r.h / 2 - u(9), { size: u(14), weight: 700, color: c.id === 'hero' && this.mode === 'swap' ? C.disabled : f ? C.goldHi : C.text, maxW: r.w - u(56) });
      });
      S.prompts(g, this.mode === 'swap' ? [{ btn: 'a', label: '交代' }, { btn: 'b', label: 'やめる' }] : [{ btn: 'a', label: '選ぶ' }, { btn: 'b', label: '出る' }]);
    },
  });
})(window.RPG);
