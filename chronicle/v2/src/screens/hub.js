// MENUS: メインメニュー（ハブ、MODERN_UI §6.4 menu.png・menu_tall.png、V2_PLAN §2.5.15）
//   命令: 道具／技・術／装備／並びと隊列／図鑑／年代記・手がかり／地図／セーブ／設定（＋ワープ、ダンジョンでは脱出）。
//   「強さ」は置かない（人の札を選ぶと開く、A15）。人の札は HP・MP の 現在/最大（Lv・経験値は出さない、A30）。X で満タン（A2）。
//   結果: undefined | {warp: locId} | {escape: true} | {title: true}（FIELD が閉じた後に動く。自分では呼ばない）
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };   // 読み込み順に依らない登録
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  // 並び（持ち主の決まり 2026-09-27）: 道具・装備・技・術・隊列・ワープ（脱出）・図鑑・年代記・手がかり・設定・セーブ。地図はフィールドの X で開く
  const CMDS = [
    { value: 'items', label: R.T('ui.hub.CMDS.items.label'), icon: 'bag', desc: R.T('ui.hub.CMDS.items.desc') },
    { value: 'equip', label: R.T('ui.hub.CMDS.equip.label'), icon: 'equip', desc: R.T('ui.hub.CMDS.equip.desc') },
    { value: 'skills', label: R.T('ui.hub.CMDS.skills.label'), icon: 'arts', desc: R.T('ui.hub.CMDS.skills.desc') },
    { value: 'order', label: R.T('ui.hub.CMDS.order.label'), short: R.T('ui.hub.CMDS.order.short'), icon: 'order', desc: R.T('ui.hub.CMDS.order.desc') },
    { value: 'bestiary', label: R.T('ui.hub.CMDS.bestiary.label'), icon: 'beast', desc: R.T('ui.hub.CMDS.bestiary.desc') },
    { value: 'chronicle', label: R.T('ui.hub.CMDS.chronicle.label'), short: R.T('ui.hub.CMDS.chronicle.short'), icon: 'journal', desc: R.T('ui.hub.CMDS.chronicle.desc') },
    { value: 'settings', label: R.T('ui.hub.CMDS.settings.label'), icon: 'gear', desc: R.T('ui.hub.CMDS.settings.desc') },
    { value: 'save', label: R.T('ui.hub.CMDS.save.label'), icon: 'save', desc: R.T('ui.hub.CMDS.save.desc') },
  ];
  const WARP = { value: 'warp', label: R.T('ui.hub.WARP.warp.label'), icon: 'warp', desc: R.T('ui.hub.WARP.warp.desc') };
  const ESCAPE = { value: 'escape', label: R.T('ui.hub.ESCAPE.escape.label'), icon: 'exit', desc: R.T('ui.hub.ESCAPE.escape.desc') };

  function commands() {
    const rows = CMDS.map((c) => Object.assign({}, c));
    const G = R.Game || {};
    const map = R.Field && R.Field.pos && R.DB.maps[R.Field.pos.map];
    let warps = [];
    try { warps = R.Field.warpList ? R.Field.warpList() : []; } catch (e) { warps = []; }
    // ワープ・脱出は隊列の次（図鑑の前）に入れる
    const at = rows.findIndex((r) => r.value === 'bestiary');
    const extra = [];
    if (warps.length && G.flags && G.flags.prologue_done) extra.push(Object.assign({}, WARP));   // 序章の間はワープを出さない
    if (map && map.kind === 'dungeon') extra.push(Object.assign({}, ESCAPE));
    rows.splice(at < 0 ? rows.length : at, 0, ...extra);
    return rows;
  }

  S.def('menu', {
    init() {
      this.rows = commands();
      this.focus = 'cmd';
      this.ci = 0;
      this.list = new R.UIK.List({ rows: this.rows, rowH: 36, tall: false });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(undefined);
      this.busy = false;
      this.cards = [];
    },
    async pick(row) {
      if (this.busy) return;
      const id = row.value;
      if (id === 'escape') {
        const i = await S.ask(this, { title: R.T('ui.hub.menu.pick.i.ask.title'), text: R.T('ui.hub.menu.pick.i.ask.text'), choices: R.T('ui.hub.menu.pick.i.ask.choices'), cancel: 1 });
        if (i === 0) this.close({ escape: true });
        return;
      }
      this.busy = true;
      try {
        if (id === 'warp') {
          const r = await S.open('warp');
          if (r && r.warp) { this.close({ warp: r.warp }); return; }
        } else {
          await S.open(id);
          if (S._toTitle) { S._toTitle = false; this.close({ title: true }); return; }
        }
        this.rows = commands();
        this.list.setRows(this.rows, true);
      } finally { this.busy = false; }
    },
    async status(i) {
      const c = S.party()[i];
      if (!c || this.busy) return;
      this.busy = true;
      try { await S.open('status', { id: c.id }); } finally { this.busy = false; }
    },
    async fullHeal() {
      const P = R.Party;
      if (!P || !P.fullHeal) return;
      let plan;
      try { plan = P.fullHeal({ dry: true }); } catch (e) { console.error(e); return; }
      if (!plan.healed.length) { R.UIK.sfx('buzzer'); await S.note(this, { title: R.T('ui.hub.menu.fullHeal.title'), lines: [R.T('ui.hub.menu.fullHeal.lines.0')] }); return; }
      const nameOf = (id) => { if (id === 'bag') return R.T('ui.hub.menu.fullHeal.nameOf.ret'); const c = S.char(id); return c ? c.name : id; };
      const what = (id) => { const a = (R.DB.spells || {})[id] || (R.DB.techs || {})[id] || (R.DB.items || {})[id]; return a ? a.name : id; };
      const usesItems = plan.used.some((x) => x.who === 'bag');
      if (!plan.used.length) { R.UIK.sfx('buzzer'); await S.note(this, { title: R.T('ui.hub.menu.fullHeal.title'), lines: [R.T('ui.hub.menu.fullHeal.lines.0_2')] }); return; }
      if (usesItems) {
        const lines = plan.used.map((x) => ({ text: (x.who === 'bag' ? '' : R.T('ui.hub.menu.fullHeal.lines.text', { nameOf: nameOf(x.who) })) + what(x.what), right: '× ' + x.n, icon: x.who === 'bag' ? 'potion' : 'arts', color: x.who === 'bag' ? T().color.gold : undefined }));
        const i = await S.ask(this, { title: R.T('ui.hub.menu.fullHeal.i.ask.title'), lines: [R.T('ui.hub.menu.ask.lines.0')].concat(lines), choices: R.T('ui.hub.menu.fullHeal.i.ask.choices'), cancel: 1 });
        if (i !== 0) return;
      }
      const res = P.fullHeal();
      R.UIK.sfx('heal');
      const lines = res.used.map((x) => ({ text: (x.who === 'bag' ? '' : R.T('ui.hub.menu.fullHeal.lines.text', { nameOf: nameOf(x.who) })) + what(x.what), right: '× ' + x.n, icon: x.who === 'bag' ? 'potion' : 'arts' }));
      lines.push({ text: R.T('ui.hub.menu.fullHeal.text', { join: res.healed.map(nameOf).join(R.T('ui.hub.menu.fullHeal.text.join')) }), icon: 'heal', color: T().color.up });
      if (res.short) lines.push({ text: R.T('ui.hub.menu.fullHeal.text_2'), color: T().color.gold });
      await S.note(this, { title: R.T('ui.hub.menu.fullHeal.title'), lines });
    },
    update() {
      const I = R.Input, n = S.party().length;
      if (this.busy) return;
      if (I.pressed('x')) { this.fullHeal(); return; }
      if (this.closeRect && S.clicked(this.closeRect)) { R.UIK.sfx('cancel'); this.close(undefined); return; }
      // 人の札をポインタで
      for (let i = 0; i < this.cards.length; i++) if (S.clicked(this.cards[i])) { this.focus = 'card'; this.ci = i; R.UIK.sfx('confirm'); this.status(i); return; }
      if (this.focus === 'card') {
        if (I.repeat('down') && n) { this.ci = (this.ci + 1) % n; R.UIK.sfx('cursor'); }
        else if (I.repeat('up') && n) { this.ci = (this.ci + n - 1) % n; R.UIK.sfx('cursor'); }
        if ((!S.tall() && I.pressed('left')) || I.pressed('b')) { this.focus = 'cmd'; R.UIK.sfx('cancel'); return; }
        if (S.tall() && I.pressed('right') && n) { this.ci = (this.ci + 1) % n; R.UIK.sfx('cursor'); }
        if (I.pressed('a')) { R.UIK.sfx('confirm'); this.status(this.ci); }
        return;
      }
      if (!S.tall() && I.pressed('right') && n) { this.focus = 'card'; this.ci = Math.min(this.ci, n - 1); R.UIK.sfx('cursor'); return; }
      this.list.update();
    },
    draw(g) {
      if (S.tall()) this.drawTall(g); else this.drawWide(g);
    },
    drawWide(g) {
      this.closeRect = null;
      const b = S.box(), C = T().color;
      const lw = Math.min(u(230), b.w * 0.24);
      const lx = b.x + u(8);
      let y = S.heading(g, R.T('ui.hub.menu.drawWide.y.heading'), lx + u(10), b.y + u(14), lw - u(20));
      // 縦持ちの drawTall は同じ一覧を 3 列・行 76 にする。窓の大きさを変えて横に戻ったら 1 列・行 36 に戻す（戻さないと 3 列のままで名前が「…」）
      this.list.cols = 1; this.list.rowH = 36; this.list.tall = false;
      const lr = { x: lx, y: y + u(4), w: lw, h: this.rows.length * this.list.rowPx() };
      this.list.active = this.focus === 'cmd';
      this.list.render = (gg, row, rect, f) => {
        const sz = u(17.5);
        R.UIK.icon(gg, row.icon, rect.x + u(14), rect.y + (rect.h - sz) / 2, sz, f ? C.gold : C.text2);
        // 狭い横持ち（4:3 の 720 幅）で入らない名前は短い名前（縦持ちの札と同じ「年代記」など）に
        const lab = row.short && R.UIK.measure(row.label, { size: sz, weight: 700 }) > rect.w - u(52) ? row.short : row.label;
        R.UIK.text(gg, lab, rect.x + u(46), rect.y + (rect.h - sz) / 2 - u(1), { size: sz, weight: f ? 700 : 500, color: f ? C.goldHi : C.text, maxW: rect.w - u(52) });
      };
      this.list.draw(g, lr);
      const cur = this.rows[this.list.index];
      if (cur && this.focus === 'cmd') {
        let dy = lr.y + lr.h + u(18);
        for (const l of R.UIK.wrap(cur.desc, lw, { size: u(13) })) { R.UIK.text(g, l, lx + u(2), dy, { size: u(13), color: C.text2 }); dy += u(21); }
      }
      // 人の札
      const cx = lx + lw + u(26);
      const rx0 = b.x + b.w;
      const cw = Math.min(u(372), (rx0 - cx) * 0.54);
      const mem = S.party();
      // 上: 次にやること（人の札と右の欄の上に 1 行。オーナーの依頼 2026-09-28）
      const gh = u(48);
      const hasGoal = S.goalBar(g, { x: cx, y: b.y + u(8), w: rx0 - cx, h: gh });
      const top = b.y + u(8) + (hasGoal ? gh + u(12) : 0);
      const ch = Math.min(u(92), (b.y + b.h - top - u(10) * 3) / 4);
      this.cards = [];
      mem.forEach((c, i) => {
        const r = { x: cx, y: top + i * (ch + u(10)), w: cw, h: ch };
        this.cards.push(r);
        S.charCard(g, c, r, { focused: this.focus === 'card' && this.ci === i });
      });
      // 右: お金・時間・場所、目印の手がかり
      const rx = cx + cw + u(22), rw = rx0 - rx;
      const G = R.Game || {};
      const pr = { x: rx, y: top, w: rw, h: u(128) };
      R.UIK.panel(g, pr, { frost: true });
      const rowsR = [
        ['coin', R.T('ui.hub.menu.drawWide.rowsR.0.1'), R.UIK.num(G.gold || 0) + ' G', C.gold],
        ['clock', R.T('ui.hub.menu.drawWide.rowsR.1'), R.U.playTime(G.playMs || 0), C.text],
        ['pin', R.T('ui.hub.menu.drawWide.rowsR.2.1'), S.placeName(), C.text],
      ];
      rowsR.forEach(([ic, lab, val, col], i) => {
        const yy = pr.y + u(18) + i * u(36);
        R.UIK.icon(g, ic, pr.x + u(18), yy, u(17), C.text2);
        const lw2 = R.UIK.text(g, lab, pr.x + u(46), yy, { size: u(14), color: C.text2 });
        // 値の幅は見出しの右から（狭い画面で「12,345…」にしない。それでも入らなければ字を縮める）
        R.UIK.text(g, val, pr.x + pr.w - u(18), yy - u(2), { size: u(i === 2 ? 16 : 17), weight: 700, color: col, align: 'right', maxW: Math.max(pr.w - u(150), pr.w - u(46) - lw2 - u(30)) });
      });
      S.leadCard(g, { x: rx, y: pr.y + pr.h + u(14), w: rw, h: u(110) });
      const pp = [{ btn: 'a', label: R.T('ui.hub.menu.drawWide.pp.0.label') }, { btn: 'b', label: R.T('ui.hub.menu.drawWide.pp.1.label') }, { btn: 'x', label: R.T('ui.hub.menu.drawWide.pp.2.label') }];
      if (this.focus === 'cmd') pp.push({ btn: 'right', label: R.T('ui.hub.menu.drawWide.label') });
      S.prompts(g, pp);
    },
    drawTall(g) {
      const b = S.box(), C = T().color, G = R.Game || {};
      let y = b.y + u(4);
      S.heading(g, R.T('ui.hub.menu.drawTall.heading'), b.x + u(4), y, 0);
      // 右上に「閉じる」（縦持ちはボタン表示の行が無いので、押せる札で。44 CSS px 以上）
      const cs = u(14), cwid = R.UIK.measure(R.T('ui.hub.menu.drawTall.cwid.measure'), { size: cs, weight: 700 }) + u(26), chh = Math.max(u(30), R.minTouch || 0);
      this.closeRect = { x: b.x + b.w - cwid, y: y + u(10) - chh / 2, w: cwid, h: chh };
      R.UIK.card(g, this.closeRect, { frost: true });
      R.UIK.text(g, R.T('ui.hub.menu.drawTall.text'), this.closeRect.x + cwid / 2, this.closeRect.y + (chh - cs) / 2, { size: cs, weight: 700, color: C.text, align: 'center' });
      R.UIK.text(g, R.T('ui.hub.menu.drawTall.text_2', { UIK: R.UIK.num(G.gold || 0), playTime: R.U.playTime(G.playMs || 0) }), this.closeRect.x - u(12), y + u(1), { size: u(14), color: C.text2, align: 'right' });
      y += u(34);
      if (S.goalBar(g, { x: b.x, y, w: b.w, h: u(40) }, { compact: true })) y += u(48);
      const mem = S.party();
      const gap = u(10), cw = (b.w - gap) / 2, ch = u(146);
      this.cards = [];
      mem.forEach((c, i) => {
        const r = { x: b.x + (i % 2) * (cw + gap), y: y + Math.floor(i / 2) * (ch + gap), w: cw, h: ch };
        this.cards.push(r);
        S.tallCard(g, c, r, this.focus === 'card' && this.ci === i);
      });
      y += Math.ceil(Math.max(1, mem.length) / 2) * (ch + gap) + u(2);
      const lead = S.leadCard(g, { x: b.x, y, w: b.w, h: u(72) }, { compact: true });
      if (lead) y += u(72) + gap;
      // 命令の大きな札（3 列）
      const cols = 3, n = this.rows.length, lines = Math.ceil(n / cols);
      this.list.cols = cols;
      this.list.rowH = 76;
      this.list.tall = false;
      const rh = this.list.rowPx();
      const gh = lines * rh;
      const gy = Math.max(y + u(8), b.y + b.h - gh - u(24));
      const gr = { x: b.x, y: gy, w: b.w, h: gh };
      this.list.rect = gr;
      this.list.active = this.focus === 'cmd';
      for (let i = 0; i < n; i++) {
        const rr = this.list.rowRect(i);
        if (!rr) continue;
        const row = this.rows[i], f = this.focus === 'cmd' && i === this.list.index;
        const r = { x: rr.x + u(4), y: rr.y + u(4), w: rr.w - u(8), h: rr.h - u(8) };
        R.UIK.card(g, r, { focused: f, frost: true });
        const isz = u(24);
        R.UIK.icon(g, row.icon, r.x + (r.w - isz) / 2, r.y + r.h * 0.2, isz, f ? C.gold : C.text2);
        R.UIK.text(g, row.short || row.label, r.x + r.w / 2, r.y + r.h * 0.62, { size: u(15), weight: 700, color: f ? C.goldHi : C.text, align: 'center', maxW: r.w - u(8) });
      }
      R.UIK.text(g, R.T('ui.hub.menu.drawTall.text_3'), R.W / 2, b.y + b.h + u(2), { size: u(13), color: C.text3, align: 'center' });
    },
  });

  /** 縦持ちの人の札（2×2）。o = {dim（選べない人を暗く）, note（右上に出す短いわけ。例「もう覚えている」）} */
  S.tallCard = function (g, c, r, focused, o) {
    o = o || {};
    const C = T().color;
    R.UIK.card(g, r, { focused, frost: true });
    // 低い札（道具の相手選びなど、u(130) 未満）は顔を小さく・肩書きなしで HP/MP が札に収まるように（字の最小 12 CSS px で行が高くなった）
    const compact = r.h < u(130);
    const pad = u(9), fs = compact ? u(34) : u(50);
    const dead = !(c.hp > 0);
    R.UIK.portraitFrame(g, { x: r.x + pad, y: r.y + pad, w: fs, h: fs }, c.look, { dim: dead || o.dim });
    const x = r.x + pad * 2 + fs;
    const tw = R.UIK.tag(g, c.row, x, r.y + pad + u(2), u(11));
    R.UIK.text(g, c.name, x + tw + u(6), r.y + pad, { size: u(15), weight: 700, color: dead ? C.disabled : focused ? C.goldHi : C.text, maxW: r.x + r.w - x - tw - u(12) });
    if (!compact) R.UIK.text(g, S.title(c), x, r.y + pad + u(26), { size: u(12), color: C.text2, maxW: r.x + r.w - x - pad });
    S.hpmp(g, c, r.x + pad, r.y + pad + fs + u(4), r.w - pad * 2, { size: 13.5, stack: true });
    if (o.note) R.UIK.text(g, o.note, r.x + r.w - pad, r.y + pad + (compact ? u(20) : u(44)), { size: u(12), color: C.text3, align: 'right', maxW: r.x + r.w - x - pad });
  };

  /** 次にやること（R.Leads.goal()）の 1 行の札。無ければ描かずに false。o.compact は縦持ち（見出しの字を小さく） */
  S.goalBar = function (g, r, o) {
    o = o || {};
    const goal = R.Leads && R.Leads.goal ? R.Leads.goal() : null;
    if (!goal) return false;
    const C = T().color;
    R.UIK.panel(g, r, { frost: true });
    // 左の琥珀の細い帯（手がかりの通知の札と同じ印）
    g.fillStyle = 'rgba(236,201,124,0.85)';
    g.fillRect(r.x + u(1), r.y + u(10), u(2), r.h - u(20));
    const isz = u(16), my = r.y + r.h / 2;
    R.UIK.icon(g, 'star', r.x + u(16), my - isz / 2, isz, C.gold);
    const lab = R.T('ui.hub.goalBar.lab'), ls = u(o.compact ? 11 : 12);
    R.UIK.text(g, lab, r.x + u(40), my - ls / 2 - u(1), { size: ls, weight: 700, color: C.gold, track: u(1.5) });
    const lx = r.x + u(40) + R.UIK.measure(lab, { size: ls, weight: 700 }) + u(1.5) * lab.length + u(18);
    const ts = u(o.compact ? 14 : 16.5);
    R.UIK.text(g, goal.text, lx, my - ts / 2 - u(1), { size: ts, weight: 700, color: C.text, maxW: r.x + r.w - lx - u(16) });
    return true;
  };

  /** 今いる所の名前 */
  S.placeName = function () {
    const pos = (R.Field && R.Field.pos) || (R.Game && R.Game.pos) || {};
    const map = R.DB.maps[pos.map];
    if (!map) return '';
    const loc = map.location && R.DB.locations && R.DB.locations[map.location];
    return map.name || (loc && loc.name) || '';
  };
  /** 目印を付けた手がかりの札（無ければ描かずに false） */
  S.leadCard = function (g, r, o) {
    o = o || {};
    const id = R.Leads && R.Leads.pinned ? R.Leads.pinned() : null;
    if (!id) return false;
    const C = T().color;
    const L = (R.DB.leads || {})[id] || { title: id };
    R.UIK.panel(g, r, { frost: true });
    if (o.compact) {
      R.UIK.icon(g, 'pin', r.x + u(14), r.y + u(14), u(16), C.gold);
      R.UIK.text(g, L.title, r.x + u(38), r.y + u(12), { size: u(16), weight: 700, color: C.text, maxW: r.w * 0.62 });
      const where = [L.dir, S.locName(L.place)].filter(Boolean).join(R.T('ui.hub.leadCard.where.join'));
      if (where) R.UIK.text(g, where, r.x + r.w - u(14), r.y + u(15), { size: u(13), color: C.text2, align: 'right' });
      if (L.from) R.UIK.text(g, R.T('ui.hub.leadCard.text', { locName: S.locName(L.from) }), r.x + u(38), r.y + u(40), { size: u(12.5), color: C.text3, maxW: r.w - u(52) });
      return true;
    }
    R.UIK.icon(g, 'pin', r.x + u(18), r.y + u(18), u(16), C.gold);
    R.UIK.text(g, R.T('ui.hub.leadCard.text_2'), r.x + u(44), r.y + u(18), { size: u(13), weight: 700, color: C.gold, track: u(1) });
    R.UIK.text(g, L.title, r.x + u(18), r.y + u(48), { size: u(18), weight: 700, color: C.text, maxW: r.w - u(36) });
    const sub = [L.from ? R.T('ui.hub.leadCard.sub.0', { locName: S.locName(L.from) }) : '', L.dir || ''].filter(Boolean).join(R.T('ui.hub.leadCard.sub.join'));
    if (sub) R.UIK.text(g, sub, r.x + u(18), r.y + u(80), { size: u(13), color: C.text2, maxW: r.w - u(36) });
    return true;
  };
  /** 場所の id → 名前（R.DB.locations か地図の名前。無ければそのまま） */
  S.locName = function (id) {
    if (!id) return '';
    const L = R.DB.locations && R.DB.locations[id];
    if (L && L.name) return L.name;
    const m = R.DB.maps[id];
    return (m && m.name) || id;
  };
})(window.RPG);
