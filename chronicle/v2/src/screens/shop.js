// MENUS: 店（MODERN_UI §6.13 shop.png、A6・A17・A20。2026-09 に作り直し）。params {id, face?, line?, tab?} → undefined（売り買いは画面の中で R.Game を書く）
//   上: 店の人の顔・店の名前・ひとこと。所持金はいつも見える（横長は右上の札、縦持ちは店の札の右）。
//   タブ: 武器／防具／道具（その店に並ぶ種類だけ。アクセサリは防具）＋売る。L/R（キーボード Q/E）とタップで替える。1 つの建物に 1 つの店のまま。
//   一覧の上の札: 並び（種類順 → 値段順 → 強さ順。X かタップ）、しぼり込み「装備できる物だけ」（一行の誰かが付けられる品。START かタップ。武器・防具のタブ）。
//   一覧の行: アイコン・名前・「装備中」の札・持っている数 ×N・値段（売るタブは売値。お金が足りない値段は灰色、誰も付けられない装備は名前が灰色）。
//   右（縦持ちは下）: 名前・種類・値段・主な値・説明（2 行まで）。装備なら「仲間が付けると」の帯: 一行の全員の顔と増減
//     （▲+n 緑 ／ ▼−n 赤 ／ ±0 灰。付けられない人は顔を薄くして「装備不可」、もう付けている人は「装備中」）。
//     1 人 1 列で、顔 → 名前 → 増減の行を縦に積む（列の幅を測って入れる）ので、顔と数字は重ならない。
//   買う: 道具は数を選ぶ札（←→ 1 つ、↑↓ 10 ずつ、タップの −10・−1・＋1・＋10）→ 合計と残りの所持金。装備は 1 つ買って
//     「今すぐ装備する？」（一行の全員。付けられない人は選べない。いちばん上がる人にカーソル）。品を入れるのは R.State.gain（1 か所）。
//   売る: 2 つ以上持っていれば数を選ぶ札。めずらしい品は確かめる。
//   タッチ・マウス: まだ選んでいない行を押すと選ぶだけ、選んでいる行をもう一度押すと買う／売る（うっかり買わない）。
//   テスト・QA の手がかり: this.tabs [{key, label}]・this.tab・this.tabKey()・this.list・this.qtyPick {id, mode, n, max}・this.sortMode・this.filter
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const EQUIP = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const MAX = 99;
  const TABS = [{ key: 'weapon', label: '武器' }, { key: 'armor', label: '防具' }, { key: 'item', label: '道具' }, { key: 'sell', label: '売る' }];
  const SORTS = ['種類順', '値段順', '強さ順'];
  const pref = { sort: 0, filter: false };   // 並びとしぼり込みは店を出ても覚えておく（遊んでいる間だけ）

  const catOf = (it) => (!it ? 'item' : it.slot === 'weapon' ? 'weapon' : EQUIP.includes(it.slot) ? 'armor' : 'item');
  const isEquip = (id) => { const it = S.item(id); return !!(it && EQUIP.includes(it.slot)); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function gain(id, n) {
    if (R.State && R.State.gain) return R.State.gain(id, n);
    R.Game.items[id] = (R.Game.items[id] || 0) + n;
    return { item: id, n };
  }
  function take(id, n) {
    if (R.State && R.State.take) return R.State.take(id, n);
    if ((R.Game.items[id] || 0) < n) return false;
    R.Game.items[id] -= n;
    if (R.Game.items[id] <= 0) delete R.Game.items[id];
    return true;
  }
  /** 一行と控えが付けている数 */
  function equipped(id) {
    let n = 0;
    for (const c of S.party().concat(R.Party && R.Party.reserve ? R.Party.reserve() : [])) for (const s of Object.keys(c.equip || {})) if (c.equip[s] === id) n++;
    return n;
  }
  const slotOf = (c, id) => R.Rules.defaultSlot(c, id);
  const canWear = (c, id) => !!c && R.Rules.canEquip(c, id, slotOf(c, id));
  const canAny = (id) => S.party().some((c) => canWear(c, id));
  /** 強さ順の値（武器は攻撃と術の強い方、防具は守備＋魔防＋回避＋能力値、道具は値段） */
  function power(it) {
    if (!it) return 0;
    if (it.slot === 'weapon') return Math.max(it.atk || 0, it.mag || 0);
    if (!EQUIP.includes(it.slot)) return it.price || 0;
    let p = (it.def || 0) + (it.mdef || 0) + (it.eva || 0);
    if (it.stats) for (const k of Object.keys(it.stats)) p += (it.stats[k] || 0) * 8;
    return p;
  }
  /** 札（R.UIK.chip）の幅 */
  const chipW = (t, sz) => R.UIK.measure(t, { size: u(sz), weight: 700 }) + u(14);
  /** 押せる札（丸い枠・文字）。→ rect */
  function button(g, r, label, o) {
    o = o || {};
    const C = T().color;
    g.save();
    R.UIK.rr(g, r.x, r.y, r.w, r.h, Math.min(r.h / 2, u(10)));
    g.fillStyle = o.primary ? 'rgba(236,201,124,0.22)' : 'rgba(240,228,200,0.07)'; g.fill();
    g.strokeStyle = o.primary ? 'rgba(236,201,124,0.7)' : 'rgba(240,228,200,0.28)'; g.lineWidth = 0.75; g.stroke();
    g.restore();
    const sz = u(o.size || 15);
    R.UIK.text(g, label, r.x + r.w / 2, r.y + (r.h - sz) / 2 - u(0.5), { size: sz, weight: 700, color: o.disabled ? C.disabled : o.primary ? C.goldHi : C.text, align: 'center', maxW: r.w - u(8) });
    return r;
  }

  S.def('shop', {
    init(p) {
      this.shop = (R.DB.shops || {})[p.id] || { name: '店', items: [] };
      this.stock = (R.Rules.shopItems ? R.Rules.shopItems(p.id) : this.shop.items || []).filter((id) => S.item(id));
      const has = (k) => this.stock.some((id) => catOf(S.item(id)) === k);
      this.tabs = TABS.filter((t) => (t.key === 'sell' ? this.shop.sell !== false : has(t.key)));
      if (!this.tabs.length) this.tabs = [TABS[2]];
      const want = p.tab || (this.shop.kind === 'item' ? 'item' : this.shop.kind === 'weapon' ? 'weapon' : null);
      this.tab = Math.max(0, this.tabs.findIndex((t) => t.key === want));
      this.sortMode = pref.sort;
      this.filter = pref.filter;
      this.qtyPick = null;
      this.hot = {};
      this.busy = false;
      this.list = new R.UIK.List({ rows: [], rowH: 40 });
      this.list.onSelect = (row) => this.onRow(row);
      this.list.onCancel = () => this.close(undefined);
      this.list.onDetail = (row) => { if (row && row.value) S.detail({ kind: 'item', id: row.value }); };
      this.refresh(false);
    },
    tabKey() { return (this.tabs[this.tab] || TABS[2]).key; },
    selling() { return this.tabKey() === 'sell'; },
    canFilter() { const k = this.tabKey(); return k === 'weapon' || k === 'armor'; },
    isEquip(id) { return isEquip(id); },
    price(id) {
      const it = S.item(id), base = (it && it.price) || 0;
      // 店ごとの値の倍率（shop.priceMul: 数か関数。値切り・割引・闇市の高値）
      const pm = this.shop.priceMul, m = typeof pm === 'function' ? pm() : (pm || 1);
      return base > 0 && m !== 1 ? Math.max(1, Math.round(base * m)) : base;
    },
    unitPrice(id) { return this.selling() ? R.Rules.sellPrice(id) : this.price(id); },
    /** タブ key の一覧の id（しぼり込み・並びの後） */
    idsFor(key) {
      let ids;
      if (key === 'sell') {
        ids = S.bag().filter((id) => { const it = S.item(id); return it && it.slot !== 'key' && R.Rules.sellPrice(id) > 0; });
        const cat = (id) => { const it = S.item(id); const i = EQUIP.indexOf(it.slot); return i < 0 ? 99 : i; };
        ids.sort((a, b) => cat(a) - cat(b) || (S.item(a).sort || 0) - (S.item(b).sort || 0));
      } else {
        ids = this.stock.filter((id) => catOf(S.item(id)) === key);
        if (this.filter && (key === 'weapon' || key === 'armor')) ids = ids.filter(canAny);
      }
      const at = new Map(ids.map((id, i) => [id, i]));
      if (this.sortMode === 1) ids.sort((a, b) => (key === 'sell' ? R.Rules.sellPrice(b) - R.Rules.sellPrice(a) : this.price(a) - this.price(b)) || at.get(a) - at.get(b));
      else if (this.sortMode === 2) ids.sort((a, b) => power(S.item(b)) - power(S.item(a)) || at.get(a) - at.get(b));
      return ids;
    },
    refresh(keep) {
      const cur = keep && this.list.current() ? this.list.current().value : null;
      const rows = this.idsFor(this.tabKey()).map((id) => ({ value: id, label: S.item(id).name }));
      this.list.setRows(rows, !!keep);
      if (cur) { const i = rows.findIndex((r) => r.value === cur); if (i >= 0) this.list.focusIndex(i); }
    },
    setTab(k) { if (k === this.tab || k < 0 || k >= this.tabs.length) return; this.tab = k; this.qtyPick = null; this.refresh(false); },
    maxBuy(id) { const p = this.price(id); return Math.max(0, Math.min(MAX - S.count(id), p > 0 ? Math.floor(S.gold() / p) : MAX)); },
    // ---------------------------------------------------------------- 売り買い
    onRow(row) {
      // タッチ・マウスで、まだ選んでいなかった行を押したときは選ぶだけ（もう一度押すと買う・売る）
      if (!R.Input.pressed('a') && this._prevIndex != null && this._prevIndex !== this.list.index) return;
      this.pick(row);
    },
    pick(row) {
      if (this.busy || !row) return;
      const id = row.value, it = S.item(id);
      if (!it) return;
      if (this.selling()) {
        if (S.count(id) > 1) { this.openQty(id, 'sell'); return; }
        this.doSell(id, 1);
        return;
      }
      if (this.price(id) > S.gold()) { R.UIK.sfx('buzzer'); R.UIK.toast('お金が足りない', { anchor: 'bl' }); return; }
      if (S.count(id) >= MAX) { R.UIK.sfx('buzzer'); R.UIK.toast('これ以上は持てない', { anchor: 'bl' }); return; }
      if (!isEquip(id)) { this.openQty(id, 'buy'); return; }
      this.doBuy(id, 1);
    },
    openQty(id, mode) {
      const max = mode === 'sell' ? S.count(id) : this.maxBuy(id);
      this.qtyPick = { id, mode, n: 1, max: Math.max(1, max), rects: {} };
    },
    async doBuy(id, n) {
      if (this.busy) return;
      const it = S.item(id), total = this.price(id) * n;
      if (total > S.gold()) { R.UIK.sfx('buzzer'); R.UIK.toast('お金が足りない', { anchor: 'bl' }); return; }
      if (S.count(id) + n > MAX) { R.UIK.sfx('buzzer'); R.UIK.toast('これ以上は持てない', { anchor: 'bl' }); return; }
      this.busy = true;
      try {
        R.Game.gold -= total;
        gain(id, n);
        R.UIK.sfx('coin');
        R.UIK.toast(`${it.name}${n > 1 ? ' ×' + n : ''} を買った`, { anchor: 'tr', icon: S.iconOf(it) });
        if (isEquip(id)) await this.offerEquip(id);
        this.refresh(true);
      } finally { this.busy = false; }
    },
    async doSell(id, n) {
      if (this.busy) return;
      const it = S.item(id), sp = R.Rules.sellPrice(id) * n;
      this.busy = true;
      try {
        if (it.grade === 'rare' || it.grade === 'super' || it.unique || it.stealOnly) {
          const k = await S.ask(this, { title: it.name, text: `めずらしい品だ。${R.UIK.num(sp)} G で売る？`, choices: ['売る', 'やめる'], cancel: 1 });
          if (k !== 0) return;
        }
        if (!take(id, n)) { R.UIK.sfx('buzzer'); return; }
        R.Game.gold += sp;
        R.UIK.sfx('coin');
        R.UIK.toast(`${it.name}${n > 1 ? ' ×' + n : ''} を ${R.UIK.num(sp)} G で売った`, { anchor: 'bl', icon: 'coin' });
        this.refresh(true);
      } finally { this.busy = false; }
    },
    /** 買った装備を「今すぐ装備する？」: 一行の全員（付けられない人は選べない）、いちばん上がる人にカーソル */
    async offerEquip(id) {
      const mem = S.party();
      const can = mem.map((c) => canWear(c, id));
      if (!can.some(Boolean)) return;
      const gainOf = (c) => S.equipScore(c, slotOf(c, id), id) - S.equipScore(c, slotOf(c, id), c.equip[slotOf(c, id)] || null);
      let best = can.indexOf(true), bv = -Infinity;
      mem.forEach((c, i) => { if (!can[i]) return; const v = gainOf(c); if (v > bv) { bv = v; best = i; } });
      const choices = mem.map((c, i) => {
        if (!can[i]) return { label: c.name, right: '装備不可', disabled: true };
        const d = S.bestDelta(S.statDiff(c, slotOf(c, id), id));
        return { label: c.name, right: d ? `${d.name} ${d.d > 0 ? '+' : '−'}${Math.abs(d.d)}` : '±0' };
      });
      const k = await S.ask(this, { title: '今すぐ装備する？', text: S.item(id).name, choices: choices.concat([{ label: '装備しない' }]), cancel: mem.length, index: best });
      if (k < 0 || k >= mem.length || !can[k]) return;
      const c = mem[k];
      const r = R.Rules.equip(c, slotOf(c, id), id);
      if (r.ok) { R.UIK.sfx('equip'); R.UIK.toast(`${c.name} が ${S.item(id).name} を付けた`, { anchor: 'bl', icon: 'equip' }); }
      else R.UIK.toast(r.reason || '付けられない', { anchor: 'bl' });
    },
    // ---------------------------------------------------------------- 入力
    update() {
      if (this.busy) return;
      if (this.qtyPick) { this.updateQty(); return; }
      const I = R.Input;
      const k = S.tabInput(this.tabRects, this.tab, this.tabs.length);
      if (k >= 0) { this.setTab(k); return; }
      if (I.pressed('x') || S.clicked(this.hot.sort)) {
        this.sortMode = pref.sort = (this.sortMode + 1) % SORTS.length;
        R.UIK.sfx('cursor'); this.refresh(true); return;
      }
      if (this.canFilter() && (I.pressed('start') || S.clicked(this.hot.filter))) {
        this.filter = pref.filter = !this.filter;
        R.UIK.sfx('cursor'); this.refresh(true); return;
      }
      this._prevIndex = this.list.index;
      this.list.update();
    },
    updateQty() {
      const q = this.qtyPick, I = R.Input, rc = q.rects;
      const set = (n) => { n = clamp(n, 1, q.max); if (n !== q.n) { q.n = n; R.UIK.sfx('cursor'); } else R.UIK.sfx('buzzer'); };
      if (I.repeat('right') || S.clicked(rc.p1)) { set(q.n + 1); return; }
      if (I.repeat('left') || S.clicked(rc.m1)) { set(q.n - 1); return; }
      if (I.repeat('up') || S.clicked(rc.p10)) { set(q.n + 10); return; }
      if (I.repeat('down') || S.clicked(rc.m10)) { set(q.n - 10); return; }
      if (I.pressed('a') || S.clicked(rc.ok)) {
        R.UIK.sfx('confirm');
        this.qtyPick = null;
        if (q.mode === 'buy') this.doBuy(q.id, q.n); else this.doSell(q.id, q.n);
        return;
      }
      if (I.pressed('b') || S.clicked(rc.cancel) || (I.pointer.pressed && q.panel && !S.hit(q.panel, I.pointer.x, I.pointer.y))) { R.UIK.sfx('cancel'); this.qtyPick = null; }
    },
    // ---------------------------------------------------------------- 描く
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      this.hot = {};
      // 上: 店の人と所持金（所持金はいつも見える）
      const hh = tall ? u(64) : u(72);
      const gw = tall ? 0 : u(236);
      const hp = { x: b.x, y: b.y, w: tall ? b.w : b.w - gw - u(16), h: hh };
      R.UIK.panel(g, hp, { frost: true });
      const face = this.p.face, fs = hh - u(20);
      let tx;
      if (face && R.UIK.hasFace(face)) { R.UIK.portraitFrame(g, { x: hp.x + u(10), y: hp.y + u(10), w: fs, h: fs }, face, {}); tx = hp.x + fs + u(22); }
      else { R.UIK.icon(g, this.shop.kind === 'weapon' ? 'sword' : 'shop', hp.x + u(18), hp.y + (hh - u(26)) / 2, u(26), C.gold); tx = hp.x + u(58); }
      let goldX = hp.x + hp.w - u(16);
      if (tall) {
        // 所持金を店の札の右に
        const gs = u(17), amt = R.UIK.num(S.gold()) + ' G';
        const aw = R.UIK.text(g, amt, goldX, hp.y + u(12), { size: gs, weight: 700, color: C.gold, align: 'right' });
        R.UIK.icon(g, 'coin', goldX - aw - u(22), hp.y + u(13), u(16), C.gold);
        R.UIK.text(g, '所持金', goldX, hp.y + u(36), { size: u(13), color: C.text2, align: 'right' });
        goldX -= Math.max(aw + u(26), R.UIK.measure('所持金', { size: u(13) })) + u(14);
      }
      const nameW = goldX - tx;
      R.UIK.text(g, this.shop.name, tx, hp.y + (tall ? u(10) : u(13)), { size: u(tall ? 17 : 18), weight: 700, color: C.text, maxW: nameW });
      R.UIK.text(g, this.p.line ? '「' + this.p.line + '」' : (this.shop.kind === 'weapon' ? '「いい品がそろってるよ」' : '「旅の支度はここで」'), tx, hp.y + (tall ? u(36) : u(42)), { size: u(13), color: C.text2, maxW: nameW });
      if (!tall) {
        const gp = { x: b.x + b.w - gw, y: b.y, w: gw, h: hh };
        R.UIK.panel(g, gp, { frost: true });
        R.UIK.icon(g, 'coin', gp.x + u(14), gp.y + (gp.h - u(17)) / 2, u(17), C.gold);
        R.UIK.text(g, '所持金', gp.x + u(40), gp.y + (gp.h - u(13)) / 2, { size: u(13), color: C.text2 });
        R.UIK.text(g, R.UIK.num(S.gold()) + ' G', gp.x + gp.w - u(14), gp.y + (gp.h - u(18)) / 2 - u(1), { size: u(18), weight: 700, color: C.gold, align: 'right' });
      }
      // タブ（L/R・Q/E・タップ）
      const lw = tall ? b.w : Math.min(u(540), b.w * 0.46);
      const ty = hp.y + hp.h + u(12), tabH = u(15) + u(18);
      let tabX = b.x;
      const multi = this.tabs.length > 1;
      if (multi) tabX += R.UIK.glyph(g, 'l', b.x + u(10), ty + tabH / 2, { size: u(12) }) + u(8);
      this.tabRects = S.tabs(g, this.tabs.map((t) => t.label), this.tab, tabX, ty, { min: tall ? 70 : 84 });
      const lastTab = this.tabRects[this.tabRects.length - 1];
      if (multi && lastTab) R.UIK.glyph(g, 'r', lastTab.x + lastTab.w + u(18), ty + tabH / 2, { size: u(12) });
      // 一覧（上に並び・しぼり込みの札）
      const lpY = ty + tabH + u(10);
      const barH = R.UIK.chipH(13) + u(20);
      const rowPx = this.list.rowPx();
      let lpH;
      if (tall) {
        const detailMin = u(300);
        const n = clamp(Math.floor((b.y + b.h - lpY - u(10) - detailMin - barH - u(8)) / rowPx), 3, 7);
        lpH = barH + n * rowPx + u(8);
      } else lpH = b.y + b.h - lpY;
      const lp = { x: b.x, y: lpY, w: lw, h: lpH };
      R.UIK.panel(g, lp, { frost: true });
      this.drawBar(g, lp, barH);
      const sell = this.selling();
      this.list.render = (gg, row, rect, f) => this.drawRow(gg, row, rect, f, sell);
      this.list.draw(g, { x: lp.x + u(8), y: lp.y + barH, w: lp.w - u(16), h: lp.h - barH - u(8) });
      if (!this.list.rows.length) {
        const msg = sell ? '売れる物を持っていない。' : this.filter && this.canFilter() ? '一行の誰も付けられる品がない。' : '並んでいる品がない。';
        R.UIK.text(g, msg, lp.x + u(22), lp.y + barH + u(10), { size: u(14.5), color: C.text3, maxW: lp.w - u(44) });
      }
      // 詳しい所
      const dp = tall ? { x: b.x, y: lp.y + lp.h + u(10), w: b.w, h: b.y + b.h - (lp.y + lp.h + u(10)) } : { x: lp.x + lp.w + u(16), y: hp.y + hp.h + u(12), w: b.x + b.w - (lp.x + lp.w + u(16)), h: b.y + b.h - (hp.y + hp.h + u(12)) };
      R.UIK.panel(g, dp, { frost: true });
      const row = this.list.current();
      if (row) this.drawDetail(g, dp, row.value);
      // 下のボタン表示
      if (this.qtyPick) {
        this.drawQty(g);
        S.prompts(g, [{ btn: 'a', label: this.qtyPick.mode === 'buy' ? '買う' : '売る' }, { btn: 'b', label: 'やめる' }]);
      } else if (row) {
        const pr = [{ btn: 'a', label: sell ? '売る' : '買う' }, { btn: 'b', label: '戻る' }, { btn: 'x', label: '並び替え' }, { btn: 'y', label: '詳しく' }];
        if (!tall && this.canFilter()) pr.push({ btn: 'start', label: 'しぼり込み' });
        S.prompts(g, pr);
      } else S.prompts(g, [{ btn: 'b', label: '戻る' }, { btn: 'x', label: '並び替え' }]);
    },
    /** 一覧の上の札: 並び・しぼり込み（押せる） */
    drawBar(g, lp, barH) {
      const C = T().color, sz = 13, h = R.UIK.chipH(sz);
      const y = lp.y + (barH - h) / 2;
      let x = lp.x + u(16);
      const gw = R.UIK.glyph(g, 'x', x + u(8), y + h / 2, { size: u(12) });
      x += gw + u(6);
      const sLabel = '並び：' + SORTS[this.sortMode];
      const w1 = R.UIK.chip(g, x, y, sLabel, { kind: 'plain', size: sz });
      this.hot.sort = { x: x - u(6), y: y - u(8), w: w1 + u(12), h: h + u(16) };
      x += w1 + u(16);
      if (this.canFilter()) {
        const on = this.filter;
        const fLabel = on ? '装備できる物だけ' : '全部の品';
        const fw = chipW(fLabel, sz);
        const gx = x;
        const gw2 = S.tall() ? 0 : R.UIK.glyph(g, 'start', gx + u(8), y + h / 2, { size: u(12) }) + u(6);
        if (x + gw2 + fw <= lp.x + lp.w - u(12)) {
          x += gw2;
          const w2 = R.UIK.chip(g, x, y, fLabel, on ? { kind: 'gold', size: sz } : { kind: 'plain', size: sz, color: C.text2 });
          this.hot.filter = { x: x - u(6), y: y - u(8), w: w2 + u(12), h: h + u(16) };
        }
      }
    },
    /** 一覧の 1 行: アイコン・名前 … 装備中・×N ・値段 */
    drawRow(g, row, rect, f, sell) {
      const C = T().color, id = row.value, sz = u(15), cy = rect.y + (rect.h - sz) / 2 - u(1);
      const pr = sell ? R.Rules.sellPrice(id) : this.price(id);
      const cant = !sell && pr > S.gold();
      const bagN = S.count(id), eqN = sell ? 0 : equipped(id);
      const nobody = !sell && isEquip(id) && !canAny(id);
      const right = rect.x + rect.w - u(12);
      const pw = R.UIK.text(g, R.UIK.num(pr) + ' G', right, cy, { size: sz, weight: 700, color: cant ? C.disabled : sell ? C.gold : C.text, align: 'right' });
      let mx = right - Math.max(pw, u(S.tall() ? 64 : 76)) - u(14);
      if (bagN) {
        const s = '×' + bagN, sw = R.UIK.text(g, s, mx, cy + u(1), { size: u(13.5), color: C.text2, align: 'right' });
        mx -= sw + u(10);
      }
      if (eqN) {
        const cw = chipW('装備中', 11.5);
        R.UIK.chip(g, mx - cw, rect.y + (rect.h - R.UIK.chipH(11.5)) / 2, '装備中', { kind: 'plain', size: 11.5 });
        mx -= cw + u(10);
      }
      S.itemLabel(g, id, rect.x + u(12), cy, { focused: f, size: sz, maxW: mx - rect.x - u(4), disabled: nobody && !f });
    },
    /** 詳しい所: 名前・種類・値段・主な値・説明、装備なら仲間の帯 */
    drawDetail(g, dp, id) {
      const C = T().color, tall = S.tall(), it = S.item(id);
      if (!it) return;
      const sell = this.selling();
      const px = dp.x + u(20), pw = dp.w - u(40);
      let y = dp.y + u(16);
      // 主な値（右寄せ、右から並べる）
      let rx = px + pw;
      for (const m of S.mainStats(it).slice(0, 2).reverse()) {
        const vw = R.UIK.text(g, String(m.v), rx, y - u(2), { size: u(22), weight: 700, color: C.text, align: 'right' });
        const nw = R.UIK.text(g, m.name, rx - vw - u(6), y + u(5), { size: u(13), color: C.text2, align: 'right' });
        rx -= vw + u(6) + nw + u(18);
      }
      const nmW = Math.max(u(60), rx - px - u(24));
      const nw = R.UIK.text(g, it.name, px, y, { size: u(20), weight: 700, color: S.gradeColor(it) || C.goldHi, maxW: nmW });
      R.UIK.stars(g, it.grade, px + Math.min(nw, nmW) + u(8), y + u(4), u(14));
      y += u(32);
      const pr = sell ? R.Rules.sellPrice(id) : this.price(id);
      const pLine = (sell ? '売値 ' : '値段 ') + R.UIK.num(pr) + ' G';
      const plw = R.UIK.text(g, pLine, px + pw, y, { size: u(14), weight: 700, color: sell ? C.gold : pr > S.gold() ? C.down : C.gold, align: 'right' });
      R.UIK.text(g, it.slot === 'use' ? '道具' : S.kindLine(it), px, y, { size: u(13), color: C.text2, maxW: pw - plw - u(16) });
      y += u(26);
      const dl = R.UIK.wrap(String(it.desc || '').replace(/\n/g, ''), pw, { size: u(14) }).slice(0, 2);
      for (const l of dl) { R.UIK.text(g, l, px, y, { size: u(14), color: C.text }); y += u(22); }
      y += u(6); R.UIK.rule(g, px, px + pw, y, 0.14); y += u(12);
      const bagN = S.count(id), eqN = equipped(id);
      const own = (bagN ? '持っている ×' + bagN : '持っていない') + (eqN ? '（装備中 ' + eqN + '）' : '');
      if (isEquip(id)) {
        S.label(g, sell ? '仲間が付けると（売る前に）' : '仲間が付けると', px, y);
        y += u(26);
        const stripH = dp.y + dp.h - u(12) - y - (tall ? 0 : u(30));
        this.drawStrip(g, id, px, y, pw, stripH);
        if (!tall) R.UIK.text(g, own, px, dp.y + dp.h - u(34), { size: u(13), color: C.text2, maxW: pw });
      } else {
        if (it.slot === 'use') { R.UIK.text(g, it.use && it.use.field ? 'フィールドでも戦闘でも使える。' : '戦闘で使う。', px, y, { size: u(13.5), color: C.teal, maxW: pw }); y += u(26); }
        R.UIK.text(g, own, px, y, { size: u(13), color: C.text2, maxW: pw });
      }
    },
    /**
     * 仲間の帯: 一行の全員を 1 人 1 列に。列の中は [顔（丸）] → [名前] → [増減 1〜2 行]（▲+n 緑・▼−n 赤・±0 灰）を縦に積む。
     * 付けられない人は顔を薄くして「装備不可」、もう付けている人は「装備中」。文字は列の幅に入るように測って縮める。
     */
    drawStrip(g, id, x, y, w, h) {
      const C = T().color, tall = S.tall(), mem = S.party();
      const n = Math.max(1, mem.length), gap = u(tall ? 6 : 8), cw = (w - gap * (n - 1)) / n;
      const lines = 2, lh = u(22);
      const extra = tall ? 0 : u(20);   // 横長は名前の下に「いま：…」
      const r = clamp(Math.min(cw * 0.2, (h - u(18) - u(22) - extra - lines * lh) / 2), u(10), tall ? u(20) : u(24));
      const it = S.item(id);
      const mainKeys = it.slot === 'weapon' ? ['atk', 'mag'] : it.slot === 'acc' ? [] : ['def', 'mdef'];
      mem.forEach((c, i) => {
        const cx0 = x + i * (cw + gap), cx = cx0 + cw / 2;
        const slot = slotOf(c, id), can = canWear(c, id);
        const wearing = can && (c.equip[slot] === id || (it.slot === 'acc' && (c.equip.acc1 === id || c.equip.acc2 === id)));
        // 列の地
        const cardH = Math.min(h, u(8) + r * 2 + u(8) + u(21) + extra + lines * lh + u(10));
        g.save(); R.UIK.rr(g, cx0, y, cw, Math.max(u(40), cardH), u(8)); g.fillStyle = can ? 'rgba(240,228,200,0.05)' : 'rgba(240,228,200,0.02)'; g.fill(); g.restore();
        S.faceCircle(g, c.look, cx, y + u(8) + r, r, { dim: !can });
        let ty = y + u(8) + r * 2 + u(8);
        R.UIK.text(g, c.name, cx, ty, { size: u(13), weight: 700, color: can ? C.text : C.disabled, align: 'center', maxW: cw - u(8) });
        ty += u(21);
        if (extra) {
          const cur = can ? S.item(c.equip[slot]) : null;
          if (can) R.UIK.text(g, 'いま：' + (cur ? cur.name : 'なし'), cx, ty, { size: u(12), color: C.text2, align: 'center', maxW: cw - u(10) });
          ty += extra;
        }
        if (!can) { R.UIK.text(g, '装備不可', cx, ty, { size: u(13), weight: 700, color: C.disabled, align: 'center', maxW: cw - u(8) }); return; }
        if (wearing) { R.UIK.text(g, '装備中', cx, ty, { size: u(13), weight: 700, color: C.gold, align: 'center', maxW: cw - u(8) }); return; }
        const rows = S.statDiff(c, slot, id);
        const main = rows.filter((rr) => mainKeys.includes(rr.k)).sort((a, b2) => Math.abs(b2.d) - Math.abs(a.d))[0] || null;
        const rest = rows.filter((rr) => rr !== main && rr.d).sort((a, b2) => Math.abs(b2.d) - Math.abs(a.d) || (b2.d > 0) - (a.d > 0));
        const show = (main ? [main] : []).concat(rest).slice(0, lines);
        if (!show.length) show.push({ name: '', d: 0 });
        for (const rr of show) {
          this.deltaLine(g, rr, cx, ty, cw - u(4));
          ty += lh;
        }
      });
    },
    /** 増減の 1 行（中央寄せ）: 「守備 ▲+5」「魔防 ±0」。入らなければ名前を落として数字だけ */
    deltaLine(g, rr, cx, y, maxW) {
      const C = T().color, sz = u(S.tall() ? 14 : 15), ns = u(13);
      const dw = rr.d ? S.deltaW(rr.d, sz) : R.UIK.measure('±0', { size: sz, weight: 700 });
      let nw = rr.name ? R.UIK.measure(rr.name, { size: ns }) + u(4) : 0;
      if (nw + dw > maxW) nw = 0;
      const x0 = cx - (nw + dw) / 2;
      if (nw) R.UIK.text(g, rr.name, x0, y + (sz - ns) / 2, { size: ns, color: C.text2 });
      if (rr.d) S.delta(g, rr.d, x0 + nw + dw, y, { size: sz });
      else R.UIK.text(g, '±0', x0 + nw + dw, y, { size: sz, weight: 700, color: C.same, align: 'right' });
    },
    /** 数を選ぶ札（道具を買う・2 つ以上を売る） */
    drawQty(g) {
      const q = this.qtyPick, C = T().color, it = S.item(q.id);
      if (!it) return;
      const buy = q.mode === 'buy';
      const unit = buy ? this.price(q.id) : R.Rules.sellPrice(q.id), total = unit * q.n;
      const bh = Math.max(u(44), R.minTouch || 0);
      const w = Math.min(R.W - u(32), u(460)), h = u(150) + bh * 2 + u(34);
      const x = (R.W - w) / 2, y = Math.max(u(20), (R.H - h) / 2);
      R.UIK.dim(g, 0.5);
      q.panel = { x, y, w, h };
      R.UIK.panel(g, q.panel, { dense: true, frost: true });
      const px = x + u(24), pw = w - u(48);
      R.UIK.text(g, buy ? 'いくつ買う？' : 'いくつ売る？', px, y + u(18), { size: u(18), weight: 700, color: C.gold });
      S.itemLabel(g, q.id, px, y + u(52), { size: u(15), maxW: pw - u(120) });
      R.UIK.text(g, (buy ? '1 つ ' : '売値 ') + R.UIK.num(unit) + ' G', px + pw, y + u(52), { size: u(14), color: C.text2, align: 'right' });
      // −10 −1 [数] ＋1 ＋10
      const ry = y + u(86), bw = Math.min(u(64), (pw - u(90)) / 4);
      const nx = px + pw / 2;
      q.rects.m10 = button(g, { x: px, y: ry, w: bw, h: bh }, '−10', { disabled: q.n <= 1 });
      q.rects.m1 = button(g, { x: px + bw + u(8), y: ry, w: bw, h: bh }, '−1', { disabled: q.n <= 1 });
      q.rects.p1 = button(g, { x: px + pw - bw * 2 - u(8), y: ry, w: bw, h: bh }, '＋1', { disabled: q.n >= q.max });
      q.rects.p10 = button(g, { x: px + pw - bw, y: ry, w: bw, h: bh }, '＋10', { disabled: q.n >= q.max });
      R.UIK.text(g, '×' + q.n, nx, ry + (bh - u(28)) / 2, { size: u(28), weight: 700, color: C.goldHi, align: 'center' });
      R.UIK.text(g, '←→ 1 つ ・ ↑↓ 10 ずつ', nx, ry + bh + u(8), { size: u(12.5), color: C.text3, align: 'center', maxW: pw });
      // 合計と所持金
      const ty = ry + bh + u(36);
      R.UIK.text(g, (buy ? '合計 ' : '受け取り ') + R.UIK.num(total) + ' G', px, ty, { size: u(17), weight: 700, color: C.gold });
      const after = buy ? S.gold() - total : S.gold() + total;
      R.UIK.text(g, '所持金 ' + R.UIK.num(S.gold()) + ' → ' + R.UIK.num(after) + ' G', px + pw, ty + u(3), { size: u(13), color: C.text2, align: 'right', maxW: pw * 0.55 });
      // 決める・やめる
      const oy = y + h - bh - u(16), ow = (pw - u(12)) / 2;
      q.rects.ok = button(g, { x: px, y: oy, w: ow, h: bh }, buy ? '買う' : '売る', { primary: true, size: 16 });
      q.rects.cancel = button(g, { x: px + ow + u(12), y: oy, w: ow, h: bh }, 'やめる', { size: 16 });
    },
  });
})(window.RPG);
