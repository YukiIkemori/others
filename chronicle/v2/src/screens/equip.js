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
    const sh = it && slot === 'weapon1' && R.Rules.isTwoHanded(id) && c.equip.shield ? S.item(c.equip.shield) : null;
    if (sh) for (const k of RAW.concat(ABIL)) if (!keys.includes(k) && val(sh, k)) keys.push(k);
    return keys.map((k) => {
      const before = val(cur, k) + (sh ? val(sh, k) : 0), after = val(it, k);
      return { k, name: N[k] || k, before, after, d: after - before };
    });
  };
  /** 人の能力の値（R.Rules.stats の結果）の 1 つ。攻撃・命中・会心は今の武器の値、hp/mp は最大 */
  S.statVal = function (st, k) {
    if (!st) return 0;
    const w = st.w && (st.w.weapon1 || st.w.fist);
    if ((k === 'atk' || k === 'hit' || k === 'crit') && w && w[k] != null) return w[k];
    if (k === 'hp') return st.maxHp || 0;
    if (k === 'mp') return st.maxMp || 0;
    return st[k] || 0;
  };
  /**
   * 付け替えたときの人の値の増減（R.Rules.preview。両手の武器が押し出す盾・熟練も込み）: slot に id（null は外す）。
   * → [{k, name, before, after, d}]（枠の主な値＋増減のある値。DIFF_KEYS の順）。o.all で 0 の行も
   */
  S.statDiff = function (c, slot, id, o) {
    o = o || {};
    if (!c) return [];
    const N = R.Rules.DIFF_NAMES || {}, KEYS = R.Rules.DIFF_KEYS || RAW.concat(ABIL);
    slot = R.Rules.charSlot ? R.Rules.charSlot(slot, c, id) : slot;
    let d;
    try { d = R.Rules.preview(c, slot, id || null); } catch (e) { return []; }
    const st = S.stats(c);
    const it = S.item(id) || S.item(c.equip && c.equip[slot]) || {};
    const main = it.slot === 'weapon' ? ['atk', 'hit', 'crit'] : it.slot === 'acc' ? [] : ['def', 'mdef'];
    const keys = main.slice();
    for (const k of KEYS) if (!keys.includes(k) && (o.all || d[k])) keys.push(k);
    return keys.map((k) => { const before = S.statVal(st, k); return { k, name: N[k] || k, before, after: before + (d[k] || 0), d: d[k] || 0 }; });
  };
  /** 候補の強さ（最強装備の点 R.Rules.loadoutScore ＋ 能力値・最大 HP/MP・回避など）。高いほど上に並べる */
  S.equipScore = function (c, slot, id) {
    const rows = S.statDiff(c, slot, id, { all: true }), g = (k) => { const r = rows.find((x) => x.k === k); return r ? r.after : 0; };
    const after = { atk: g('atk'), mag: g('mag'), def: g('def'), mdef: g('mdef') };
    const base = R.Rules.loadoutScore ? R.Rules.loadoutScore(after, magicUser(c) ? 'magic' : 'phys') : after.atk + after.def;
    return base + ABIL.reduce((s, k) => s + g(k) * 1.5, 0) + g('eva') * 0.3 + g('hit') * 0.1 + g('crit') * 0.2 + (g('hp') + g('mp')) * 0.05;
  };
  /** いちばん大きな増減 1 つ（ほかの仲間・店の行） */
  S.bestDelta = function (rows) {
    const nz = rows.filter((r) => r.d);
    if (!nz.length) return null;
    return nz.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  };
  /** S.delta で描く「▲+n」の幅（論理 px） */
  S.deltaW = function (d, sz) {
    if (!d) return 0;
    return R.UIK.measure((d > 0 ? '+' : '−') + Math.abs(d), { size: sz, weight: 700 }) + u(6) + sz * 0.6;
  };
  /**
   * 増減の札を横に並べる（ほかの仲間・店の行）: 「値の名前 ▲+n」を左から、w に入る分だけ。札の幅を測って置くので重ならない。
   * rows = [{name, d}]（大事な順）。o = {size, nameSize, nameColor, align:'left'|'right', gap, lines（行の数、既定 1）, lh（行の間）, cy（縦の中心。無ければ y が 1 行目の上）}。
   * → 描いた数
   */
  S.deltaCells = function (g, rows, x, y, w, o) {
    o = o || {};
    const C = T().color, sz = o.size || u(13.5), ns = o.nameSize || sz, gap = o.gap || u(16), inner = u(8);
    const maxLines = o.lines || 1, lh = o.lh || sz + u(8);
    const ncol = (r) => o.nameColor || (r.d > 0 ? C.up : r.d < 0 ? C.down : C.same);
    // 並べ方を先に決める（行ごとに入るだけ）
    const lines = [[]], lw = [0];
    for (const r of rows) {
      const cw = R.UIK.measure(r.name, { size: ns }) + inner + S.deltaW(r.d, sz);
      let L = lines.length - 1;
      const add = (lines[L].length ? gap : 0) + cw;
      if (lw[L] + add > w) {
        if (!lines[L].length || lines.length >= maxLines) break;
        lines.push([]); lw.push(0); L++;
        if (cw > w) break;
        lines[L].push({ r, cw }); lw[L] = cw;
      } else { lines[L].push({ r, cw }); lw[L] += add; }
    }
    if (!lines[lines.length - 1].length) { lines.pop(); lw.pop(); }
    const n = lines.length;
    const y0 = o.cy != null ? o.cy - ((Math.max(1, n) - 1) * lh + sz) / 2 : y;
    // 1 つも入らないときは、名前を縮めて（…）最初の 1 つだけ
    if (!n && rows.length) {
      const r = rows[0], dw = S.deltaW(r.d, sz);
      R.UIK.text(g, r.name, x, y0 + (sz - ns) / 2, { size: ns, color: ncol(r), maxW: Math.max(u(14), w - dw - inner) });
      S.delta(g, r.d, x + w, y0, { size: sz });
      return 1;
    }
    let count = 0;
    lines.forEach((cells, L) => {
      const ly = y0 + L * lh;
      let cx = o.align === 'right' ? x + w - lw[L] : x;
      for (const c of cells) {
        R.UIK.text(g, c.r.name, cx, ly + (sz - ns) / 2, { size: ns, color: ncol(c.r) });   // 名前と数字の縦の中心をそろえる
        S.delta(g, c.r.d, cx + c.cw, ly, { size: sz });
        cx += c.cw + gap; count++;
      }
    });
    return count;
  };
  function magicUser(c) { const st = S.stats(c); return (st.int || 0) > (st.str || 0); }
  const score = (c, slot, id) => S.equipScore(c, slot, id);

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
          R.UIK.text(gg, N[s] || s, rect.x + u(14), cy + u(2), { size: u(12.5), color: f ? C.text2 : C.text3 });
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
      // 縦持ちの候補は、下の「ほかの仲間」に 1 人 u(36) の行が残る分だけ（2〜6 行）。小さな画面は比べる行を 3 つにして詳しい所を低く
      const nOthers = Math.max(1, S.party().length - 1);
      const candRows = (dpH) => Math.floor((b.y + b.h - sp.y - u(56) - u(12) - dpH - u(12) - (u(46) + nOthers * u(36))) / this.clist.rowPx());
      const dpCandH = [u(300), u(270), u(240)].find((h) => candRows(h) >= 2) || u(240);   // 比べる行 4・3・2
      const cRows = Math.max(2, Math.min(6, candRows(dpCandH)));
      const cp = tall ? { x: b.x, y: sp.y, w: b.w, h: this.mode === 'cand' ? u(56) + Math.min(cRows, this.clist.rows.length) * this.clist.rowPx() : sp.h } :{ x: midX, y: b.y, w: mw, h: b.h * 0.64 };
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
      const dp = tall ? { x: b.x, y: (this.mode === 'cand' ? cp.y + cp.h : sp.y + sp.h) + u(12), w: b.w, h: this.mode === 'cand' ? dpCandH : u(170) } : { x: cp.x + cp.w + u(16), y: b.y, w: rightX0 - (cp.x + cp.w + u(16)), h: cp.h };
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
      if (this.mode !== 'cand' && it) {
        const ms = S.itemDiff(c, s, focusId).filter((r) => r.after);
        ms.slice(0, 4).forEach((r, i) => {
          const xx = dp.x + u(22) + (i % 2) * ((dp.w - u(44)) / 2), yy = y + Math.floor(i / 2) * u(28);
          R.UIK.text(g, r.name, xx, yy, { size: u(14), color: C.text2 });
          R.UIK.text(g, String(r.after), xx + (dp.w - u(44)) / 2 - u(24), yy - u(1), { size: u(16), weight: 700, color: C.text, align: 'right' });
        });
        y += Math.ceil(Math.min(4, ms.length) / 2) * u(28) + u(4);
        R.UIK.rule(g, dp.x + u(22), dp.x + dp.w - u(22), y, 0.14); y += u(12);
      }
      if (this.mode === 'cand') {
        S.label(g, 'いまの装備と比べる', dp.x + u(22), y); y += u(28);
        // 行の数は詳しい所の高さに入るだけ（説明 1 行の分を残す）
        const all = S.statDiff(c, s, focusId || null), same = !all.some((r) => r.d);
        const fit = Math.floor((dp.y + dp.h - u(12) - u(28) - (same ? u(30) : 0) - y) / u(30));
        const rows = all.slice(0, Math.max(1, Math.min(tall ? Math.round((dpCandH - u(180)) / u(30)) : 5, fit)));
        if (same) { R.UIK.text(g, '変わらない', dp.x + u(22), y, { size: u(15), color: C.same }); y += u(30); }
        // 列は右から測って置く: 増減（いちばん広い物の幅）→ 後の値 → → → 前の値。狭い画面でも数字が重ならない
        const rx = dp.x + dp.w - u(22);
        const dcw = rows.reduce((m, r) => Math.max(m, S.deltaW(r.d, u(15))), 0);
        const ax = rx - (dcw ? dcw + u(14) : 0), arx = ax - Math.max(u(44), rows.reduce((m, r) => Math.max(m, R.UIK.measure(String(r.after), { size: u(16.5), weight: 700 })), 0) + u(14));
        const bx = Math.min(dp.x + dp.w * 0.5, arx - u(32));
        for (const r of rows) {
          R.UIK.text(g, r.name, dp.x + u(22), y, { size: u(15), color: C.text, maxW: Math.max(u(30), bx - u(30) - (dp.x + u(22))) });
          R.UIK.text(g, String(r.before), bx, y, { size: u(15), color: C.text2, align: 'right' });
          R.UIK.text(g, '→', bx + (arx - bx) / 2 + u(2), y, { size: u(13), color: C.text3, align: 'center' });
          R.UIK.text(g, String(r.after), ax, y - u(1), { size: u(16.5), weight: 700, color: r.d > 0 ? C.up : r.d < 0 ? C.down : C.text, align: 'right' });
          S.delta(g, r.d, rx, y, { size: u(15) });
          y += u(30);
        }
        y += u(4);
        R.UIK.rule(g, dp.x + u(22), dp.x + dp.w - u(22), y, 0.14); y += u(12);
      }
      if (it) {
        for (const l of R.UIK.wrap(String(it.desc || '').replace(/\n/g, ''), dp.w - u(44), { size: u(14.5) }).slice(0, 2)) { if (y + u(20) > dp.y + dp.h - u(6)) break; R.UIK.text(g, l, dp.x + u(22), y, { size: u(14.5), color: C.text }); y += u(24); }   // 詳しい所からはみ出さない
        if (it.element && y + u(28) <= dp.y + dp.h - u(6)) { y += u(4); R.UIK.chip(g, dp.x + u(22), y, S.ename(it.element) + 'の力を帯びる', { kind: 'teal', size: 11 }); }
      }
      // ほかの仲間
      const op = tall ? { x: b.x, y: dp.y + dp.h + u(12), w: b.w, h: b.y + b.h - (dp.y + dp.h + u(12)) } : { x: cp.x, y: cp.y + cp.h + u(14), w: rightX0 - cp.x, h: b.y + b.h - (cp.y + cp.h + u(14)) };
      if (op.h >= u(40) + Math.max(1, S.party().length - 1) * u(28)) {   // 1 人 u(28) の行が入らない高さなら出さない（重ねない）
        R.UIK.panel(g, op, { frost: true });
        S.label(g, 'ほかの仲間が付けると', op.x + u(20), op.y + u(14));
        // 1 人 1 行: [顔（決まった幅）][名前（決まった幅）][増減の札を入るだけ]。札は S.deltaCells が幅を測って並べるので重ならない
        const others = S.party().filter((x) => x !== c);
        const top = op.y + u(40), oh = Math.min(u(46), (op.y + op.h - u(8) - top) / Math.max(1, others.length));
        const ICON = u(44), x = op.x + u(20), rx = op.x + op.w - u(20);
        const NW = Math.min(u(112), (rx - x - ICON) * 0.32);
        const tx = x + ICON + NW + u(12), tw = rx - tx;
        others.forEach((o, i) => {
          const cy = top + i * oh + oh / 2;
          const can = focusId && R.Rules.canEquip(o, focusId, R.Rules.defaultSlot(o, focusId));
          S.faceCircle(g, o.look, x + u(19), cy, Math.min(u(19), oh / 2 - u(2)), { dim: !can });
          R.UIK.text(g, o.name, x + ICON, cy - u(14.5) / 2 - u(1), { size: u(14.5), weight: 700, color: can ? C.text : C.disabled, maxW: NW });
          if (!focusId) return;
          const ty = cy - u(13.5) / 2 - u(1);
          if (!can) { R.UIK.text(g, '付けられない', tx, ty, { size: u(13), color: C.disabled }); return; }
          const ds = S.statDiff(o, R.Rules.defaultSlot(o, focusId), focusId).filter((r) => r.d).sort((a, b2) => Math.abs(b2.d) - Math.abs(a.d) || (b2.d > 0) - (a.d > 0));
          if (!ds.length) R.UIK.text(g, '変わらない', tx, ty, { size: u(13), color: C.same });
          else S.deltaCells(g, ds, tx, 0, tw, { size: u(13.5), cy, lines: oh >= u(44) ? 2 : 1, lh: u(19) });
        });
      }
      S.prompts(g, this.mode === 'cand' ? [{ btn: 'a', label: '付ける' }, { btn: 'b', label: '戻る' }, { btn: 'y', label: '詳しく' }] : (S.tall() ? [{ btn: 'a', label: '選ぶ' }, { btn: 'b', label: '戻る' }, { btn: 'r', label: '次の仲間' }] : [{ btn: 'a', label: '選ぶ' }, { btn: 'b', label: '戻る' }, { btn: 'x', label: 'いちばん強く' }, { btn: 'r', label: '次の仲間' }]));
    },
  });
})(window.RPG);
