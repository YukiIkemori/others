// MENUS: 装備（MODERN_UI §6.6 equip.png、A3・A6・A17・A29）
//   左上: 人の札（L/R で人を替える）。左: 8 枠（武器・盾・頭・体・手・足・アクセ1・アクセ2。両手持ちのとき盾は「両手持ち」で灰色）。
//   中: 選んだ枠の候補（強い順、装備中の札、レアの色と星）。右: 詳しい所（名前・種類・出どころ）、いまの装備 → 付けたときの品の値（▲▼）、説明。
//   下: ほかの仲間が付けたときの増減（付けられない人は灰色）。X で「いちばん強く」（アクセ 2 枠は変えない、確認つき）。Y で詳しく。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const RAW = ['atk', 'mag', 'def', 'mdef', 'hit', 'eva', 'crit'];
  const ABIL = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];

  /** 品の値の比べ（品の値だけ、A17）: 今 slot に付けている物 → id。→ [{k, name, before, after, d}] */
  S.itemDiff = function (c, slot, id) {
    const N = R.Rules.DIFF_NAMES || {};
    const cur = S.item(c && c.equip ? c.equip[slot] : null), it = S.item(id);
    const val = (x, k) => (!x ? 0 : RAW.includes(k) ? x[k] || 0 : (x.stats && x.stats[k]) || 0);
    const keys = [];
    const main = (it || cur || {}).slot === 'weapon' ? ['atk', 'mag', 'hit'] : ['def', 'mdef'];
    for (const k of main) keys.push(k);
    for (const k of RAW.concat(ABIL)) if (!keys.includes(k) && (val(cur, k) || val(it, k))) keys.push(k);
    // 両手の武器は盾を外す（盾の値も下がる）
    const out = keys.map((k) => ({ k, name: N[k] || k, before: val(cur, k), after: val(it, k), d: val(it, k) - val(cur, k) }));
    if (it && slot === 'weapon1' && R.Rules.isTwoHanded(id) && c.equip.shield) {
      const sh = S.item(c.equip.shield);
      for (const r of out) if (!RAW.includes(r.k) || r.k === 'def' || r.k === 'mdef' || r.k === 'eva') { const v = val(sh, r.k); if (v) { r.before += v; r.d -= v; } }
    }
    return out;
  };
  /** いちばん大きな増減 1 つ（ほかの仲間・店の行） */
  S.bestDelta = function (rows) {
    const nz = rows.filter((r) => r.d);
    if (!nz.length) return null;
    return nz.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  };
  function magicUser(c) { const st = S.stats(c); return (st.int || 0) > (st.str || 0); }
  function score(c, slot, id) {
    const rows = S.itemDiff(c, slot, id), g = (k) => { const r = rows.find((x) => x.k === k); return r ? r.after : 0; };
    const m = magicUser(c);
    return (m ? g('mag') * 1 + g('atk') * 0.3 : g('atk') + g('mag') * 0.3) + g('def') * 0.8 + g('mdef') * 0.6 + g('hit') * 0.2 + g('eva') * 0.3 + g('crit') * 0.3
      + ABIL.reduce((s, k) => s + g(k) * 2, 0);
  }

  S.def('equip', {
    init(p) {
      this.ci = 0;
      if (p && p.id) this.ci = Math.max(0, S.party().findIndex((c) => c.id === p.id));
      this.slots = R.Rules.SLOTS || ['weapon1', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
      this.slist = new R.UIK.List({ rows: this.slots.map((s) => ({ value: s, label: s })), rowH: 38 });
      this.slist.onSelect = (row) => this.openSlot(row.value);
      this.slist.onCancel = () => this.close(undefined);
      this.slist.onDetail = (row) => { const c = this.char(); const id = c && c.equip[row.value]; if (id) S.detail({ kind: 'item', id }); };
      this.clist = new R.UIK.List({ rows: [], rowH: 38 });
      this.clist.onSelect = (row) => this.put(row.value);
      this.clist.onCancel = () => { this.mode = 'slot'; };
      this.clist.onDetail = (row) => { if (row.value) S.detail({ kind: 'item', id: row.value }); };
      this.mode = 'slot';
      this.list = this.slist;
      this.busy = false;
    },
    char() { return S.party()[this.ci]; },
    slot() { return this.slots[this.slist.index]; },
    blocked(c, s) { return s === 'shield' && R.Rules.hasTwoHanded(c); },
    candidates(c, s) {
      const grp = R.Rules.groupOfSlot(s);
      const cur = c.equip[s];
      const ids = S.bag().filter((id) => { const it = S.item(id); return it && it.slot === grp && id !== cur && R.Rules.canEquip(c, id, s); });
      if (cur) ids.push(cur);
      ids.sort((a, b) => score(c, s, b) - score(c, s, a) || (a === cur ? -1 : b === cur ? 1 : 0));
      const rows = ids.map((id) => ({ value: id, label: S.item(id).name, cur: id === cur }));
      if (cur) rows.push({ value: null, label: '外す' });
      return rows;
    },
    openSlot(s) {
      const c = this.char();
      if (this.blocked(c, s)) { R.UIK.sfx('buzzer'); return; }
      const rows = this.candidates(c, s);
      if (!rows.length) { R.UIK.sfx('buzzer'); R.UIK.toast('付けられる物を持っていない', { anchor: 'bl' }); return; }
      this.clist.setRows(rows, false);
      const ci = rows.findIndex((r) => r.cur);
      this.clist.focusIndex(Math.max(0, ci));
      this.mode = 'cand';
    },
    put(id) {
      const c = this.char(), s = this.slot();
      if ((c.equip[s] || null) === (id || null)) { this.mode = 'slot'; return; }
      const r = R.Rules.equip(c, s, id);
      if (!r.ok) { R.UIK.sfx('buzzer'); R.UIK.toast(r.reason || '付けられない', { anchor: 'bl' }); return; }
      R.UIK.sfx('equip');
      if (r.shieldRemoved) R.UIK.toast('両手持ちなので盾を外した', { anchor: 'bl', icon: 'shield' });
      this.mode = 'slot';
    },
    async best() {
      const c = this.char();
      const plan = R.Rules.optimize(c, magicUser(c) ? 'magic' : 'phys');
      if (!plan.changes.length) { await S.note(this, { title: 'いちばん強く', lines: ['いまの装備が、いちばん強い。'] }); return; }
      const N = R.Rules.SLOT_NAMES || {};
      const lines = plan.changes.map((ch) => ({ text: `${N[ch.slot] || ch.slot}：${ch.from ? S.item(ch.from).name : 'なし'} → ${ch.to ? S.item(ch.to).name : 'なし'}`, icon: S.iconOf(S.item(ch.to || ch.from)) }));
      const k = await S.ask(this, { title: 'いちばん強く', lines: lines.concat(['アクセサリは変えない。']), choices: ['付け替える', 'やめる'], cancel: 1, w: 520 });
      if (k !== 0) return;
      const r = R.Rules.applyLoadout(c, plan);
      if (r.ok) R.UIK.sfx('equip'); else { R.UIK.sfx('buzzer'); R.UIK.toast(r.reason || '付け替えられなかった', { anchor: 'bl' }); }
    },
    update() {
      if (this.busy) return;
      this.list = this.mode === 'cand' ? this.clist : this.slist;
      if (this.mode === 'slot') {
        const k = S.charInput(this.ci, S.party().length, this.lr);
        if (k >= 0) { this.ci = k; return; }
        if (R.Input.pressed('x')) { this.busy = true; this.best().finally(() => { this.busy = false; }); return; }
        if (S.tall() === false && R.Input.pressed('right')) { this.openSlot(this.slot()); return; }
        this.slist.update();
      } else {
        if (!S.tall() && R.Input.pressed('left')) { this.mode = 'slot'; R.UIK.sfx('cancel'); return; }
        this.clist.update();
      }
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall(), c = this.char();
      if (!c) return;
      const N = R.Rules.SLOT_NAMES || {};
      const lw = tall ? b.w : Math.min(u(320), b.w * 0.33);
      // 人の札
      const hp = { x: b.x, y: b.y, w: lw, h: u(72) };
      R.UIK.panel(g, hp, { frost: true });
      R.UIK.portraitFrame(g, { x: hp.x + u(10), y: hp.y + u(10), w: u(52), h: u(52) }, c.look, {});
      R.UIK.text(g, c.name, hp.x + u(74), hp.y + u(13), { size: u(19), weight: 700, color: C.text, maxW: hp.w - u(170) });
      R.UIK.text(g, S.title(c), hp.x + u(74), hp.y + u(42), { size: u(12.5), color: C.text2 });
      const lx = S.lrChips(g, hp.x + hp.w - u(14), hp.y + u(36));
      this.lr = { l: { x: lx - u(4), y: hp.y, w: u(28), h: hp.h }, r: { x: hp.x + hp.w - u(34), y: hp.y, w: u(34), h: hp.h } };
      // 8 枠
      const showSlots = !tall || this.mode === 'slot';
      const sp = { x: b.x, y: hp.y + hp.h + u(12), w: lw, h: u(46) + this.slots.length * this.slist.rowPx() + u(8) };
      if (!tall) sp.h = b.y + b.h - sp.y;
      const drawSlots = () => {
        R.UIK.panel(g, sp, { frost: true });
        S.label(g, '装備', sp.x + u(20), sp.y + u(16));
        this.slist.active = this.mode === 'slot';
        this.slist.render = (gg, row, rect, f) => {
          const s = row.value, id = c.equip[s], it = S.item(id), blk = this.blocked(c, s), sz = u(15.5);
          const cy = rect.y + (rect.h - sz) / 2 - u(1);
          R.UIK.text(gg, N[s] || s, rect.x + u(14), cy + u(2), { size: u(12.5), color: C.text3 });
          const x0 = rect.x + u(74);
          if (blk) { R.UIK.icon(gg, 'shield', x0, cy, sz * 1.1, C.disabled); R.UIK.text(gg, '両手持ち', x0 + sz * 1.1 + u(9), cy, { size: sz, color: C.disabled }); }
          else if (it) S.itemLabel(gg, id, x0, cy, { focused: f, size: sz, maxW: rect.w - u(80) });
          else { R.UIK.icon(gg, { weapon1: 'sword', shield: 'shield', head: 'helm', body: 'armor', hands: 'glove', feet: 'boots' }[s] || 'ring', x0, cy, sz * 1.1, C.disabled); R.UIK.text(gg, 'なし', x0 + sz * 1.1 + u(9), cy, { size: sz, color: C.disabled }); }
        };
        this.slist.draw(g, { x: sp.x + u(8), y: sp.y + u(46), w: sp.w - u(16), h: this.slots.length * this.slist.rowPx() });
      };
      const s = this.slot();
      // 候補
      const midX = tall ? b.x : sp.x + sp.w + u(16);
      const rightX0 = b.x + b.w;
      const mw = tall ? b.w : Math.min(u(290), (rightX0 - midX) * 0.44);
      const cp = tall ? { x: b.x, y: sp.y, w: b.w, h: sp.h } : { x: midX, y: b.y, w: mw, h: b.h * 0.64 };
      if (showSlots) drawSlots();
      if (!tall || this.mode === 'cand') {
        R.UIK.panel(g, cp, { frost: true });
        S.label(g, (N[s] || s) + ' の候補', cp.x + u(20), cp.y + u(16));
        if (this.mode === 'cand') {
          this.clist.active = true;
          this.clist.render = (gg, row, rect, f) => {
            const sz = u(15.5), cy = rect.y + (rect.h - sz) / 2 - u(1);
            if (!row.value) { R.UIK.icon(gg, 'exit', rect.x + u(14), cy, sz * 1.1, f ? C.gold : C.text3); R.UIK.text(gg, '外す', rect.x + u(14) + sz * 1.1 + u(9), cy, { size: sz, color: f ? C.goldHi : C.text2 }); return; }
            S.itemLabel(gg, row.value, rect.x + u(14), cy, { focused: f, size: sz, maxW: rect.w - u(row.cur ? 90 : 20) });
            if (row.cur) R.UIK.chip(gg, rect.x + rect.w - u(72), rect.y + (rect.h - R.UIK.chipH(10.5)) / 2, '装備中', { kind: 'plain', size: 10.5 });
          };
          this.clist.draw(g, { x: cp.x + u(8), y: cp.y + u(46), w: cp.w - u(16), h: cp.h - u(56) });
        } else {
          const rows = this.blocked(c, s) ? [] : this.candidates(c, s);
          let yy = cp.y + u(50);
          for (const row of rows.slice(0, Math.floor((cp.h - u(60)) / u(36)))) {
            if (row.value) S.itemLabel(g, row.value, cp.x + u(22), yy, { size: u(15), maxW: cp.w - u(90), disabled: false });
            else R.UIK.text(g, '外す', cp.x + u(22) + u(25), yy, { size: u(15), color: C.text3 });
            if (row.cur) R.UIK.chip(g, cp.x + cp.w - u(80), yy - u(2), '装備中', { kind: 'plain', size: 10.5 });
            yy += u(36);
          }
          if (!rows.length) R.UIK.text(g, this.blocked(c, s) ? '両手持ちの武器を持っている。' : '付けられる物を持っていない。', cp.x + u(22), yy, { size: u(14), color: C.text3 });
        }
      }
      // 詳しい所と比べ
      const focusId = this.mode === 'cand' ? (this.clist.current() || {}).value : c.equip[s];
      const dp = tall ? { x: b.x, y: sp.y + sp.h + u(12), w: b.w, h: u(250) } : { x: cp.x + cp.w + u(16), y: b.y, w: rightX0 - (cp.x + cp.w + u(16)), h: cp.h };
      R.UIK.panel(g, dp, { frost: true });
      const it = S.item(focusId);
      let y = dp.y + u(18);
      if (it) {
        const nw = R.UIK.text(g, it.name, dp.x + u(22), y, { size: u(21), weight: 700, color: S.gradeColor(it) || C.goldHi, maxW: dp.w - u(70) });
        R.UIK.stars(g, it.grade, dp.x + u(30) + Math.min(nw, dp.w - u(70)), y + u(4), u(15));
        y += u(34);
        R.UIK.text(g, S.kindLine(it), dp.x + u(22), y, { size: u(13), color: C.text2, maxW: dp.w - u(44) });
        y += u(28);
      } else if (this.mode === 'cand') { R.UIK.text(g, '外す', dp.x + u(22), y, { size: u(21), weight: 700, color: C.text2 }); y += u(62); }
      else { R.UIK.text(g, 'なし', dp.x + u(22), y, { size: u(21), weight: 700, color: C.disabled }); y += u(62); }
      R.UIK.rule(g, dp.x + u(22), dp.x + dp.w - u(22), y, 0.14);
      y += u(12);
      if (this.mode === 'cand') {
        S.label(g, 'いまの装備と比べる', dp.x + u(22), y); y += u(28);
        const rows = S.itemDiff(c, s, focusId || null).slice(0, tall ? 4 : 5);
        for (const r of rows) {
          R.UIK.text(g, r.name, dp.x + u(22), y, { size: u(15), color: C.text });
          const bx = dp.x + dp.w * 0.5;
          R.UIK.text(g, String(r.before), bx, y, { size: u(15), color: C.text2, align: 'right' });
          R.UIK.text(g, '→', bx + u(26), y, { size: u(13), color: C.text3, align: 'center' });
          R.UIK.text(g, String(r.after), bx + u(70), y - u(1), { size: u(16.5), weight: 700, color: r.d > 0 ? C.up : r.d < 0 ? C.down : C.text, align: 'right' });
          S.delta(g, r.d, dp.x + dp.w - u(22), y, { size: u(15) });
          y += u(30);
        }
        y += u(4);
        R.UIK.rule(g, dp.x + u(22), dp.x + dp.w - u(22), y, 0.14); y += u(12);
      }
      if (it) {
        for (const l of R.UIK.wrap(String(it.desc || '').replace(/\n/g, ''), dp.w - u(44), { size: u(14.5) }).slice(0, 2)) { R.UIK.text(g, l, dp.x + u(22), y, { size: u(14.5), color: C.text }); y += u(24); }
        if (it.element) { y += u(4); R.UIK.chip(g, dp.x + u(22), y, S.ename(it.element) + 'の力を帯びる', { kind: 'teal', size: 11 }); }
      }
      // ほかの仲間
      const op = tall ? { x: b.x, y: dp.y + dp.h + u(12), w: b.w, h: b.y + b.h - (dp.y + dp.h + u(12)) } : { x: cp.x, y: cp.y + cp.h + u(14), w: rightX0 - cp.x, h: b.y + b.h - (cp.y + cp.h + u(14)) };
      if (op.h > u(60)) {
        R.UIK.panel(g, op, { frost: true });
        S.label(g, 'ほかの仲間が付けると', op.x + u(20), op.y + u(14));
        const others = S.party().filter((x) => x !== c);
        const cols = tall ? 1 : Math.max(1, others.length);
        const ow = (op.w - u(40)) / cols, oh = tall ? Math.min(u(46), (op.h - u(44)) / Math.max(1, others.length)) : op.h - u(50);
        others.forEach((o, i) => {
          const x = op.x + u(20) + (tall ? 0 : i * ow), yy = op.y + u(42) + (tall ? i * oh : 0);
          const can = focusId && R.Rules.canEquip(o, focusId, R.Rules.defaultSlot(o, focusId));
          S.faceCircle(g, o.look, x + u(20), yy + u(20), u(19), { dim: !can });
          R.UIK.text(g, o.name, x + u(48), yy + (tall ? u(3) : u(2)), { size: u(14.5), weight: 700, color: can ? C.text : C.disabled, maxW: ow - u(56) });
          if (!focusId) return;
          if (!can) { R.UIK.text(g, '付けられない', x + u(48) + (tall ? u(120) : 0), yy + (tall ? u(4) : u(24)), { size: u(13), color: C.disabled }); return; }
          const d = S.bestDelta(S.itemDiff(o, R.Rules.defaultSlot(o, focusId), focusId));
          const tx = x + u(48) + (tall ? u(120) : 0), ty = yy + (tall ? u(3) : u(24));
          if (!d) R.UIK.text(g, '変わらない', tx, ty, { size: u(13), color: C.same });
          else { const w = R.UIK.text(g, d.name, tx, ty, { size: u(13.5), color: d.d > 0 ? C.up : C.down }); S.delta(g, d.d, tx + w + u(60), ty, { size: u(13.5) }); }
        });
      }
      S.prompts(g, this.mode === 'cand' ? [{ btn: 'a', label: '付ける' }, { btn: 'b', label: '戻る' }, { btn: 'y', label: '詳しく' }] : [{ btn: 'a', label: '選ぶ' }, { btn: 'b', label: '戻る' }, { btn: 'x', label: 'いちばん強く' }, { btn: 'r', label: '次の仲間' }]);
    },
  });
})(window.RPG);
