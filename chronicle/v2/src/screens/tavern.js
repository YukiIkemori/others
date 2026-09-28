// MENUS: 酒場の仲間の入れ替え（ファロスの潮風亭だけ、A17。MODERN_UI §6.14）
//   左: 仲間 20 人の札（↑↓ 行・←→ 列、A15）。右: 選んだ人の顔・名前・肩書き・得意な武器/属性・能力値（A14）。下: 今の 4 人。
//   A で仲間を選ぶ → 下の 4 人から相手を選んで A で交代。主人公は控えに行かない。
//   持ち主 2026-09-28「入れ替えたかどうか B でキャンセルしないと決定できなかった」: 交代はこの画面の中の下書き（this.cur）で、
//   決めるのは「これでよい」（A。交代のすぐ後はそこにカーソルが来る。START でも）。そのときに順に R.Party.join（まだの人）→ R.Party.swap。
//   B は取り消し: 交代していれば「入れ替えを取り消して戻る？」を聞き、取り消すと何も変えずに閉じる。交代していなければそのまま閉じる。
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
      const gd = S.companionGrid();
      this.list = new R.UIK.List({ rows: this.ids.map((id) => ({ label: id, value: id })), rowH: gd.rowH, cols: gd.cols });
      this.list.onSelect = (row) => this.choose(row.value);
      this.list.onCancel = () => this.back();
      this.mode = 'pick';
      this.mi = 1;
      this.mrects = [];
      this.okRect = null; this.onOk = false;
      this.busy = false;
      const G = R.Game;
      this.cur = { party: G.party.slice(), reserve: G.reserve.slice() };   // 下書きの出撃と控え
      this.ops = [];   // 決めるときに順に行う交代 [{out, in}]
    },
    layout() { const gd = S.companionGrid(); this.list.cols = gd.cols; this.list.rowH = gd.rowH; },
    state(id) {
      if (this.cur.party.includes(id)) return 'party';
      if (this.cur.reserve.includes(id)) return 'reserve';
      return 'none';
    },
    /** 下書きの 4 人（加わっていない人は仲間のデータから） */
    members() { return this.cur.party.map((id) => S.char(id) || S.companion(id)); },
    changed() { return this.cur.party.join() !== R.Game.party.join(); },
    choose(id) {
      if (!this.canSwap) { R.UIK.sfx('buzzer'); return; }
      if (this.state(id) === 'party') { R.UIK.sfx('buzzer'); R.UIK.toast('もう一緒に旅をしている', { anchor: 'bl' }); return; }
      this.mode = 'swap'; this.pick = id;
      const mem = this.cur.party;
      this.mi = Math.max(0, mem.findIndex((x) => x !== 'hero'));
    },
    doSwap(member) {
      if (!member || member.id === 'hero') { R.UIK.sfx('buzzer'); return; }
      const id = this.pick, P = this.cur;
      P.party[P.party.indexOf(member.id)] = id;
      const k = P.reserve.indexOf(id);
      if (k >= 0) P.reserve.splice(k, 1);
      P.reserve.push(member.id);
      this.ops.push({ out: member.id, in: id });
      R.UIK.sfx('confirm');
      R.UIK.toast(`${member.name} と ${S.companion(id).name} を入れ替えます（「これでよい」で決定）`, { anchor: 'bl', icon: 'person' });
      this.mode = 'pick';
      this.onOk = true;   // 交代の後は「これでよい」へ（A でそのまま決まる）
    },
    /** 「これでよい」: 下書きの交代を順に行って閉じる */
    accept() {
      for (const op of this.ops) {
        try {
          if (!R.Party.isRecruited(op.in)) R.Party.join(op.in, { joinFrom: 'tavern' });
          R.Party.swap(op.out, op.in);
        } catch (e) { console.error(e); }
      }
      this.ops = [];
      R.UIK.sfx('confirm');
      this.close(undefined);
    },
    /** B: 交代していれば取り消すか聞く */
    async back() {
      if (this.busy) return;
      if (!this.ops.length) { this.close(undefined); return; }
      this.busy = true;
      const k = await S.ask(this, { title: '仲間の入れ替え', text: '入れ替えを取り消して戻る？', choices: ['取り消して戻る', '入れ替えを続ける'], cancel: 1 });
      this.busy = false;
      if (k === 0) { this.ops = []; this.close(undefined); }
    },
    update() {
      if (this.busy) return;
      const I = R.Input;
      if (this.okRect && S.clicked(this.okRect) && this.mode === 'pick') { this.accept(); return; }
      if (this.mode === 'swap') {
        const mem = this.members(), n = mem.length;
        if (I.repeat('right')) { this.mi = (this.mi + 1) % n; R.UIK.sfx('cursor'); }
        if (I.repeat('left')) { this.mi = (this.mi + n - 1) % n; R.UIK.sfx('cursor'); }
        for (let i = 0; i < this.mrects.length; i++) if (S.clicked(this.mrects[i])) { this.mi = i; this.doSwap(mem[i]); return; }
        if (I.pressed('a')) this.doSwap(mem[this.mi]);
        else if (I.pressed('b')) { this.mode = 'pick'; R.UIK.sfx('cancel'); }
        return;
      }
      if (this.onOk) {
        if (I.pressed('a') || I.pressed('start')) { this.accept(); return; }
        if (I.pressed('b')) { R.UIK.sfx('cancel'); this.back(); return; }
        if (I.repeat('up') || I.repeat('left') || I.repeat('right') || I.repeat('down')) { this.onOk = false; R.UIK.sfx('cursor'); }
        return;
      }
      if (I.pressed('start')) { this.onOk = true; R.UIK.sfx('cursor'); return; }
      this.list.update();
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      S.heading(g, '仲間の入れ替え', b.x + u(8), b.y + u(6), 0, { size: 15, track: 3 });
      R.UIK.text(g, '潮風亭', b.x + b.w - u(8), b.y + u(6), { size: u(14), color: C.text2, align: 'right' });
      const top = b.y + u(46), memH = u(88);
      let gr, dp, mp;
      if (tall) {
        dp = { x: b.x, y: top, w: b.w, h: S.companionDetailH() };
        mp = { x: b.x, y: dp.y + dp.h + u(10), w: b.w, h: memH };
        gr = { x: b.x, y: mp.y + mp.h + u(10), w: b.w, h: b.y + b.h - (mp.y + mp.h + u(10)) };
      } else {
        const gw = Math.min(b.w * 0.6, u(600));
        gr = { x: b.x, y: top, w: gw, h: b.h - (top - b.y) - memH - u(12) };
        mp = { x: b.x, y: gr.y + gr.h + u(12), w: gw, h: memH };
        dp = { x: b.x + gw + u(20), y: top, w: b.w - gw - u(20), h: b.h - (top - b.y) };
      }
      // 「これでよい」は下の 4 人の札の右端（縦持ちは右上に小さく）
      const okW = tall ? u(144) : Math.round(mp.w * 0.16);
      const ok = tall ? { x: mp.x + mp.w - okW - u(6), y: mp.y + u(4), w: okW, h: u(24) } : { x: mp.x + mp.w - okW - u(10), y: mp.y + u(12), w: okW, h: mp.h - u(24) };
      const rh = this.list.rowPx();
      gr.h = Math.max(rh, Math.floor(gr.h / rh) * rh);
      this.list.active = this.mode === 'pick' && !this.onOk;
      this.list.render = (gg, row, rect, f) => {
        const id = row.value, st = this.state(id);
        S.companionCard(gg, S.companion(id), { x: rect.x + u(3), y: rect.y + u(3), w: rect.w - u(6), h: rect.h - u(6) },
          { focused: f && this.mode === 'pick' && !this.onOk, picked: this.mode === 'swap' && this.pick === id, chip: st === 'party' ? '出撃中' : st === 'reserve' ? '控え' : null, chipKind: st === 'party' ? 'gold' : 'teal' });
      };
      this.list.draw(g, gr);
      const cur = this.mode === 'swap' ? this.pick : this.ids[this.list.index];
      if (cur) S.companionDetail(g, S.companion(cur), dp);
      // 今の 4 人
      R.UIK.panel(g, mp, { frost: true });
      const mem = this.members(), n = Math.max(1, mem.length), cw = (mp.w - u(20) - (tall ? 0 : okW + u(10))) / n;
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
      this.okRect = S.okButton(g, ok, { focused: this.onOk || (this.mode === 'pick' && S.over(ok)) });
      S.prompts(g, this.mode === 'swap' ? [{ btn: 'a', label: '交代' }, { btn: 'b', label: '戻る' }]
        : this.onOk ? [{ btn: 'a', label: 'これでよい' }, { btn: 'up', label: '札へ戻る' }, { btn: 'b', label: this.ops.length ? '取り消す' : '戻る' }]
          : [{ btn: 'a', label: '選ぶ' }, { btn: 'start', label: 'これでよい' }, { btn: 'b', label: this.ops.length ? '取り消す' : '戻る' }]);
    },
  });
})(window.RPG);
