// MENUS: 店（MODERN_UI §6.13 shop.png、A6・A17・A20。2026-09 に作り直し）。params {id, face?, line?, tab?} → undefined（売り買いは画面の中で R.Game を書く）
//   上: 店の人の顔・店の名前・ひとこと。所持金はいつも見える（横長は右上の札、縦持ちは店の札の右）。
//   タブ: 武器／防具／道具（その店に並ぶ種類だけ。アクセサリは防具）＋売る。L/R（キーボード Q/E）とタップで替える。1 つの建物に 1 つの店のまま。
//   一覧の上の札: 並び（種類順 → 値段順 → 強さ順。X かタップ。下の表示は「並べ方」）、しぼり込み「装備できる物だけ」（一行の誰かが付けられる品。START かタップ。武器・防具のタブ）。
//   一覧の行: アイコン・名前・「装備中」の札・持っている数 ×N・値段（売るタブは売値。お金が足りない値段は灰色、誰も付けられない装備は名前が灰色）。
//   右（縦持ちは下）: 名前・種類・値段・主な値・説明（2 行まで）。装備なら「仲間が付けると」の帯: 一行の全員の顔と増減
//     （▲+n 緑 ／ ▼−n 赤 ／ ±0 灰。付けられない人は顔を薄くして「装備できない」、もう付けている人は「装備中」）。
//     1 人 1 列で、顔 → 名前 → 増減の行を縦に積む（列の幅を測って入れる）ので、顔と数字は重ならない。
//   買う（まとめ買い）: 道具も装備も数を選ぶ札（←→ 1 つ、↑↓ 10 ずつ、L/R で 1 つ・買えるだけ、タップの −10・−1・＋1・＋10）→ 合計と残りの所持金。
//     上限は所持金と持てる数（99）の小さい方で、どちらで止まったかを札に出す。装備は買った数だけ続けて
//     「今すぐ装備する？」（一行の全員。付けられない人は選べない。カーソルは上から見て最初の「付けられて、まだ同じ物を付けていない人」）。
//     「装備しない」を選んだらそこでやめる。品を入れるのは R.State.gain（1 か所）。
//   売る（まとめ売り）: 2 つ以上持っていれば数を選ぶ札。めずらしい品は確かめる。
//   売るタブの START（札のタップも）:「使わない物をまとめて売る」。候補（決まりは shop_junk.js の S.shopJunk）を札に並べ、
//     A で 1 つずつ外す／戻す、「まとめて売る」で合計を受け取る。候補が無ければ知らせるだけ。
//   タッチ・マウス: まだ選んでいない行を押すと選ぶだけ、選んでいる行をもう一度押すと買う／売る（うっかり買わない）。
//   テスト・QA の手がかり: this.tabs [{key, label}]・this.tab・this.tabKey()・this.list・this.qtyPick {id, mode, n, max, cap}・this.sortMode・this.onlyUsable・
//     this.junk {rows:[{id, n, unit, total, why, on}], list}・this.openJunk()・this.sellJunk()
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const EQUIP = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const MAX = 99;
  const TABS = [{ key: 'weapon', label: R.T('ui.shop.TABS.weapon.label') }, { key: 'armor', label: R.T('ui.shop.TABS.armor.label') }, { key: 'item', label: R.T('ui.shop.TABS.item.label') }, { key: 'sell', label: R.T('ui.shop.TABS.sell.label') }];
  const SORTS = R.T('ui.shop.SORTS');
  const pref = { sort: 0, onlyUsable: false };   // 並びとしぼり込みは店を出ても覚えておく（遊んでいる間だけ）

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
    memoTab: false,   // タブは覚えない（開くたびに店の既定のタブ。行の位置は同じタブなら戻す。screens.js の S._recall）
    init(p) {
      this.shop = (R.DB.shops || {})[p.id] || { name: R.T('ui.shop.init.shop.name'), items: [] };
      this.stock = (R.Rules.shopItems ? R.Rules.shopItems(p.id) : this.shop.items || []).filter((id) => S.item(id));
      const has = (k) => this.stock.some((id) => catOf(S.item(id)) === k);
      this.tabs = TABS.filter((t) => (t.key === 'sell' ? this.shop.sell !== false : has(t.key)));
      if (!this.tabs.length) this.tabs = [TABS[2]];
      const want = p.tab || (this.shop.kind === 'item' ? 'item' : this.shop.kind === 'weapon' ? 'weapon' : null);
      this.tab = Math.max(0, this.tabs.findIndex((t) => t.key === want));
      this.sortMode = pref.sort;
      this.onlyUsable = pref.onlyUsable;
      this.qtyPick = null;
      this.junk = null;
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
        if (this.onlyUsable && (key === 'weapon' || key === 'armor')) ids = ids.filter(canAny);
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
    setTab(k) { if (k === this.tab || k < 0 || k >= this.tabs.length) return; this.tab = k; this.qtyPick = null; this.junk = null; this.refresh(false); },
    maxBuy(id) { const p = this.price(id); return Math.max(0, Math.min(MAX - S.count(id), p > 0 ? Math.floor(S.gold() / p) : MAX)); },
    /** 買える数を止めているもの: 'gold'（所持金）か 'stack'（持てる数） */
    buyCap(id) { const p = this.price(id), byGold = p > 0 ? Math.floor(S.gold() / p) : MAX; return byGold < MAX - S.count(id) ? 'gold' : 'stack'; },
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
      if (this.price(id) > S.gold()) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.shop.pick.toast'), { anchor: 'bl' }); return; }
      if (S.count(id) >= MAX) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.shop.pick.toast_2'), { anchor: 'bl' }); return; }
      this.openQty(id, 'buy');
    },
    openQty(id, mode) {
      const max = mode === 'sell' ? S.count(id) : this.maxBuy(id);
      this.qtyPick = { id, mode, n: 1, max: Math.max(1, max), cap: mode === 'sell' ? 'have' : this.buyCap(id), rects: {} };
    },
    async doBuy(id, n) {
      if (this.busy) return;
      const it = S.item(id), total = this.price(id) * n;
      if (total > S.gold()) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.shop.doBuy.toast'), { anchor: 'bl' }); return; }
      if (S.count(id) + n > MAX) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.shop.doBuy.toast_2'), { anchor: 'bl' }); return; }
      this.busy = true;
      try {
        R.Game.gold -= total;
        gain(id, n);
        R.UIK.sfx('coin');
        R.UIK.toast(R.T('ui.shop.doBuy.toast_3', { name: it.name, p1: n > 1 ? ' ×' + n : '' }), { anchor: 'tr', icon: S.iconOf(it) });
        // 装備は買った数だけ続けて聞く（「装備しない」・付けられる人がいない でやめる）
        if (isEquip(id)) for (let i = 0; i < n; i++) if (!(await this.offerEquip(id, n - i))) break;
        this.refresh(true);
      } finally { this.busy = false; }
    },
    async doSell(id, n) {
      if (this.busy) return;
      const it = S.item(id), sp = R.Rules.sellPrice(id) * n;
      this.busy = true;
      try {
        if (it.grade === 'rare' || it.grade === 'super' || it.unique || it.stealOnly) {
          const k = await S.ask(this, { title: it.name, text: R.T('ui.shop.doSell.k.ask.text', { sp: R.UIK.num(sp) }), choices: R.T('ui.shop.doSell.k.ask.choices'), cancel: 1 });
          if (k !== 0) return;
        }
        if (!take(id, n)) { R.UIK.sfx('buzzer'); return; }
        R.Game.gold += sp;
        R.UIK.sfx('coin');
        R.UIK.toast(R.T('ui.shop.doSell.toast', { name: it.name, p1: n > 1 ? ' ×' + n : '', sp: R.UIK.num(sp) }), { anchor: 'bl', icon: 'coin' });
        this.refresh(true);
      } finally { this.busy = false; }
    },
    /** 買った装備を「今すぐ装備する？」: 一行の全員（付けられない人は選べない）。
     *  カーソルは一番上の付けられる人（持ち主 2026-10-04。前はいちばん強くなる人 S.wearPlan）。
     *  left = まだ聞く数（2 つ以上なら題に「あと n 個」）。→ 誰かが付けたら true */
    async offerEquip(id, left) {
      const mem = S.party();
      // 付ける枠: 空いた枠 → 同じ物の入っていない枠（アクセサリは 2 つ目の枠にも）。どの枠にももう同じ物なら null（テスター 2026-09-30 1-9:
      // 全員が 1 つ付けた後、カーソルが 1 人目のアクセサリ 1（同じ物）に戻り、付けたことになって何も変わらなかった）
      const slotFor = (c) => {
        const list = R.Rules.slotsFor(id);
        return list.find((s) => !(c.equip || {})[s]) || list.find((s) => (c.equip || {})[s] !== id) || null;
      };
      const wear = mem.map((c) => canWear(c, id));
      const room = mem.map((c, i) => wear[i] && !!slotFor(c));
      if (!room.some(Boolean) || S.count(id) < 1) return false;
      const plan = S.wearPlan(id, mem);
      // カーソルは一番上の付けられる人から（持ち主 2026-10-04「上から 2 番目のキャラに最初にフォーカスが当たる。一番上から」。
      //   前は付けていちばん強くなる人に置いていた。店の問いは連打で進めるので guard は付けない（持ち主 2026-10-03））
      const first = room.findIndex(Boolean);
      const best = first >= 0 ? first : mem.length;
      const choices = mem.map((c, i) => {
        if (!wear[i]) return { label: c.name, right: R.T('ui.shop.offerEquip.choices.right'), disabled: true };
        if (!room[i]) return { label: c.name, right: R.T('ui.shop.drawStrip.text_4'), disabled: true };
        const d = S.bestDelta(S.statDiff(c, plan.rows[i].slot || slotFor(c), id));
        return { label: c.name, right: d ? `${d.name} ${d.d > 0 ? '+' : '−'}${Math.abs(d.d)}` : '±0' };
      });
      left = Math.min(left, S.count(id));
      const title = left > 1 ? R.T('ui.shop.offerEquip.title', { left }) : R.T('ui.shop.offerEquip.title_2');
      const k = await S.ask(this, { title, text: S.item(id).name, choices: choices.concat([{ label: R.T('ui.shop.offerEquip.choices.0.label') }]), cancel: mem.length, index: best });
      if (k < 0 || k >= mem.length || !room[k]) return false;
      const c = mem[k];
      const r = R.Rules.equip(c, plan.rows[k].slot || slotFor(c), id);
      if (r.ok) { R.UIK.sfx('equip'); R.UIK.toast(R.T('ui.shop.offerEquip.toast', { name: c.name, name2: S.item(id).name }), { anchor: 'bl', icon: 'equip' }); return true; }
      R.UIK.toast(r.reason || R.T('ui.shop.offerEquip.toast_2'), { anchor: 'bl' });
      return false;
    },
    // ---------------------------------------------------------------- 使わない物をまとめて売る
    /** 候補の札を開く（候補が無ければ知らせるだけ）→ 開いたら true */
    openJunk() {
      if (this.busy) return false;
      const rows = S.shopJunk(this.stock).map((r) => Object.assign(r, { on: true }));
      if (!rows.length) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.shop.openJunk.toast'), { anchor: 'bl' }); return false; }
      const list = new R.UIK.List({ rows: rows.map((r) => ({ value: r.id, label: S.item(r.id).name })).concat([{ value: '__ok', label: R.T('ui.shop.ok.label') }, { value: '__cancel', label: R.T('ui.shop.cancel.label') }]), rowH: 38, wrap: true });
      list.onSelect = (row) => {
        if (row.value === '__ok') { this.sellJunk(); return; }
        if (row.value === '__cancel') { this.junk = null; return; }
        const r = rows.find((x) => x.id === row.value);
        if (r) r.on = !r.on;
      };
      list.onCancel = () => { this.junk = null; };
      this.junk = { rows, list };
      R.UIK.sfx('confirm');
      return true;
    },
    junkTotal() { return this.junk ? this.junk.rows.reduce((s, r) => s + (r.on ? r.total : 0), 0) : 0; },
    /** 札で残した品を売る → 受け取った G */
    sellJunk() {
      const j = this.junk;
      if (!j || this.busy) return 0;
      const pick = j.rows.filter((r) => r.on);
      if (!pick.length) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.shop.sellJunk.toast'), { anchor: 'bl' }); return 0; }
      let got = 0, kinds = 0;
      for (const r of pick) if (take(r.id, r.n)) { got += r.unit * r.n; kinds++; }
      this.junk = null;
      R.Game.gold += got;
      R.UIK.sfx('coin');
      R.UIK.toast(R.T('ui.shop.sellJunk.toast_2', { kinds, got: R.UIK.num(got) }), { anchor: 'bl', icon: 'coin' });
      this.refresh(true);
      return got;
    },
    // ---------------------------------------------------------------- 入力
    update() {
      if (this.busy) return;
      if (this.qtyPick) { this.updateQty(); return; }
      if (this.junk) { this.junk.list.update(); return; }
      const I = R.Input;
      const k = S.tabInput(this.tabRects, this.tab, this.tabs.length);
      if (k >= 0) { this.setTab(k); return; }
      if (I.pressed('x') || S.clicked(this.hot.sort)) {
        this.sortMode = pref.sort = (this.sortMode + 1) % SORTS.length;
        R.UIK.sfx('cursor'); this.refresh(true); return;
      }
      if (this.canFilter() && (I.pressed('start') || S.clicked(this.hot.narrow))) {
        this.onlyUsable = pref.onlyUsable = !this.onlyUsable;
        R.UIK.sfx('cursor'); this.refresh(true); return;
      }
      if (this.selling() && (I.pressed('start') || S.clicked(this.hot.junk))) { this.openJunk(); return; }
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
      if (I.pressed('l')) { set(1); return; }
      if (I.pressed('r')) { set(q.max); return; }
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
        R.UIK.text(g, R.T('ui.shop.draw.text'), goldX, hp.y + u(36), { size: u(13), color: C.text2, align: 'right' });
        goldX -= Math.max(aw + u(26), R.UIK.measure(R.T('ui.shop.draw.goldX.measure'), { size: u(13) })) + u(14);
      }
      const nameW = goldX - tx;
      R.UIK.text(g, this.shop.name, tx, hp.y + (tall ? u(10) : u(13)), { size: u(tall ? 17 : 18), weight: 700, color: C.text, maxW: nameW });
      R.UIK.text(g, this.p.line ? '「' + this.p.line + '」' : (this.shop.kind === 'weapon' ? R.T('ui.shop.draw.text_2') : R.T('ui.shop.draw.text_3')), tx, hp.y + (tall ? u(36) : u(42)), { size: u(13), color: C.text2, maxW: nameW });
      if (!tall) {
        const gp = { x: b.x + b.w - gw, y: b.y, w: gw, h: hh };
        R.UIK.panel(g, gp, { frost: true });
        R.UIK.icon(g, 'coin', gp.x + u(14), gp.y + (gp.h - u(17)) / 2, u(17), C.gold);
        R.UIK.text(g, R.T('ui.shop.draw.text'), gp.x + u(40), gp.y + (gp.h - u(13)) / 2, { size: u(13), color: C.text2 });
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
        const msg = sell ? R.T('ui.shop.draw.msg') : this.onlyUsable && this.canFilter() ? R.T('ui.shop.draw.msg_2') : R.T('ui.shop.draw.msg_3');
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
        S.prompts(g, [{ btn: 'a', label: this.qtyPick.mode === 'buy' ? R.T('ui.shop.draw.0.label') : R.T('ui.shop.draw.0.label_2') }, { btn: 'b', label: R.T('ui.shop.draw.1.label') }]);
      } else if (this.junk) {
        this.drawJunk(g);
        const cur = this.junk.list.current(), onItem = cur && cur.value !== '__ok' && cur.value !== '__cancel';
        S.prompts(g, [{ btn: 'a', label: onItem ? R.T('ui.shop.draw.0.label_3') : R.T('ui.shop.draw.0.label_4') }, { btn: 'b', label: R.T('ui.shop.draw.1.label') }]);
      } else if (row) {
        const pr = [{ btn: 'a', label: sell ? R.T('ui.shop.draw.pr.0.label') : R.T('ui.shop.draw.pr.0.label_2') }, { btn: 'b', label: R.T('ui.shop.draw.pr.1.label') }, { btn: 'x', label: R.T('ui.shop.draw.pr.2.label') }, { btn: 'y', label: R.T('ui.shop.draw.pr.3.label') }];
        if (!tall && this.canFilter()) pr.push({ btn: 'start', label: R.T('ui.shop.draw.label') });
        if (!tall && sell) pr.push({ btn: 'start', label: R.T('ui.shop.draw.label_2') });
        S.prompts(g, pr);
      } else S.prompts(g, [{ btn: 'b', label: R.T('ui.shop.draw.0.label_5') }, { btn: 'x', label: R.T('ui.shop.draw.1.label_2') }]);
    },
    /** 一覧の上の札: 並び・しぼり込み（押せる） */
    drawBar(g, lp, barH) {
      const C = T().color, sz = 13, h = R.UIK.chipH(sz);
      const y = lp.y + (barH - h) / 2;
      let x = lp.x + u(16);
      const gw = R.UIK.glyph(g, 'x', x + u(8), y + h / 2, { size: u(12) });
      x += gw + u(6);
      const sLabel = R.T('ui.shop.drawBar.sLabel', { p0: SORTS[this.sortMode] });
      const w1 = R.UIK.chip(g, x, y, sLabel, { kind: 'plain', size: sz });
      this.hot.sort = { x: x - u(6), y: y - u(8), w: w1 + u(12), h: h + u(16) };
      x += w1 + u(16);
      if (this.canFilter()) {
        const on = this.onlyUsable;
        const fLabel = on ? R.T('ui.shop.drawBar.fLabel') : R.T('ui.shop.drawBar.fLabel_2');
        const fw = chipW(fLabel, sz);
        const gx = x;
        const gw2 = S.tall() ? 0 : R.UIK.glyph(g, 'start', gx + u(8), y + h / 2, { size: u(12) }) + u(6);
        if (x + gw2 + fw <= lp.x + lp.w - u(12)) {
          x += gw2;
          const w2 = R.UIK.chip(g, x, y, fLabel, on ? { kind: 'gold', size: sz } : { kind: 'plain', size: sz, color: C.text2 });
          this.hot.narrow = { x: x - u(6), y: y - u(8), w: w2 + u(12), h: h + u(16) };
        }
      } else if (this.selling()) {
        // 売るタブ: 「使わない物をまとめて売る」（START）
        const jLabel = R.T('ui.shop.drawBar.jLabel');
        const fw = chipW(jLabel, sz);
        const gw2 = S.tall() ? 0 : R.UIK.glyph(g, 'start', x + u(8), y + h / 2, { size: u(12) }) + u(6);
        if (x + gw2 + fw <= lp.x + lp.w - u(12)) {
          x += gw2;
          const w2 = R.UIK.chip(g, x, y, jLabel, { kind: 'plain', size: sz, color: C.gold });
          this.hot.junk = { x: x - u(6), y: y - u(8), w: w2 + u(12), h: h + u(16) };
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
        const cw = chipW(R.T('ui.shop.drawRow.cw.chipW'), 11.5);
        R.UIK.chip(g, mx - cw, rect.y + (rect.h - R.UIK.chipH(11.5)) / 2, R.T('ui.shop.drawRow.chip'), { kind: 'plain', size: 11.5 });
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
      const pLine = (sell ? R.T('ui.shop.drawDetail.pLine') : R.T('ui.shop.drawDetail.pLine_2')) + R.UIK.num(pr) + ' G';
      const plw = R.UIK.text(g, pLine, px + pw, y, { size: u(14), weight: 700, color: sell ? C.gold : pr > S.gold() ? C.down : C.gold, align: 'right' });
      R.UIK.text(g, it.slot === 'use' ? R.T('ui.shop.drawDetail.text') : S.kindLine(it), px, y, { size: u(13), color: C.text2, maxW: pw - plw - u(16) });
      y += u(26);
      const df = R.UIK.wrapFit(R.I18n.unwrap(it.desc), pw, 2, { size: u(14), min: Math.max(u(11.5), R.minFont || 0), lh: 22 / 14 });   // 2 行に収める（途中で黙って切らない）
      for (const l of df.lines) { R.UIK.text(g, l, px, y, { size: df.size, color: C.text }); y += u(22); }
      y += u(6); R.UIK.rule(g, px, px + pw, y, 0.14); y += u(12);
      const bagN = S.count(id), eqN = equipped(id);
      const own = (bagN ? R.T('ui.shop.drawDetail.own', { bagN }) : R.T('ui.shop.drawDetail.own_2')) + (eqN ? R.T('ui.shop.drawDetail.own_3', { eqN }) : '');
      if (isEquip(id)) {
        S.label(g, sell ? R.T('ui.shop.drawDetail.label') : R.T('ui.shop.drawDetail.label_2'), px, y);
        y += u(26);
        const stripH = dp.y + dp.h - u(12) - y - (tall ? 0 : u(30));
        this.drawStrip(g, id, px, y, pw, stripH);
        if (!tall) R.UIK.text(g, own, px, dp.y + dp.h - u(34), { size: u(13), color: C.text2, maxW: pw });
      } else {
        if (it.slot === 'use') { R.UIK.text(g, it.use && it.use.field ? (it.use.battle === false ? R.T('ui.shop.drawDetail.text_2') : R.T('ui.shop.drawDetail.text_3')) : R.T('ui.shop.drawDetail.text_4'), px, y, { size: u(13.5), color: C.teal, maxW: pw }); y += u(26); }
        R.UIK.text(g, own, px, y, { size: u(13), color: C.text2, maxW: pw });
      }
    },
    /**
     * 仲間の帯の中身（描くのと同じ数。テストも読む）: 一行の全員について
     * [{id, name, slot, state: 'cant'（装備できない）| 'wearing'（装備中）| 'diff', show: [{k, name, d}]（上から lines 行）}]
     * 行は品ごとに決まり、誰の列でも同じ値が同じ順（S.cmpKeys: 武器は攻撃・術力、防具は守備・術防がいつも上。変わらない値は ±0）。
     *   前は人ごとに変わりの大きい順で、守備と術防の上下が品や人で入れ替わった（オーナー 2026-10-01）
     */
    compare(id, lines) {
      const it = S.item(id);
      if (!it) return [];
      const out = S.party().map((c) => {
        const slot = slotOf(c, id), can = canWear(c, id);
        const o = { id: c.id, name: c.name, slot, state: 'diff', show: [], rows: null };
        if (!can) { o.state = 'cant'; return o; }
        if (c.equip[slot] === id || (it.slot === 'acc' && (c.equip.acc1 === id || c.equip.acc2 === id))) { o.state = 'wearing'; return o; }
        o.rows = S.statDiff(c, slot, id);
        return o;
      });
      const keys = S.cmpKeys(out.filter((o) => o.rows).map((o) => o.rows), it, lines || 2);
      for (const o of out) {
        if (o.rows) {
          o.show = S.cmpRows(o.rows, keys);
          if (!o.show.length) o.show.push({ name: '', d: 0 });
        }
        delete o.rows;
      }
      return out;
    },
    /**
     * 仲間の帯: 一行の全員を 1 人 1 列に。列の中は [顔（丸）] → [名前] → [増減 1〜2 行]（▲+n 緑・▼−n 赤・±0 灰）を縦に積む。
     * 付けられない人は顔を薄くして「装備できない」、もう付けている人は「装備中」。文字は列の幅に入るように測って縮める。
     */
    drawStrip(g, id, x, y, w, h) {
      const C = T().color, tall = S.tall(), mem = S.party();
      const n = Math.max(1, mem.length), gap = u(tall ? 6 : 8), cw = (w - gap * (n - 1)) / n;
      const lh = u(22);
      const extra = tall ? 0 : u(20);   // 横長は名前の下に「いま：…」
      // 増減の行: 縦持ちは 2 行、横長は入るだけ（2〜4 行。主な値がいつも上、続きは決まった順。S.cmpKeys）
      const lines = tall ? 2 : clamp(Math.floor((h - u(8) - u(40) - u(8) - u(21) - extra - u(10)) / lh), 2, 4);
      const r = clamp(Math.min(cw * 0.2, (h - u(18) - u(22) - extra - lines * lh) / 2), u(10), tall ? u(20) : u(24));
      const cmp = this.compare(id, lines);
      mem.forEach((c, i) => {
        const cx0 = x + i * (cw + gap), cx = cx0 + cw / 2;
        const slot = cmp[i].slot, can = cmp[i].state !== 'cant', wearing = cmp[i].state === 'wearing';
        // 列の地
        const cardH = Math.min(h, u(8) + r * 2 + u(8) + u(21) + extra + lines * lh + u(10));
        g.save(); R.UIK.rr(g, cx0, y, cw, Math.max(u(40), cardH), u(8)); g.fillStyle = can ? 'rgba(240,228,200,0.05)' : 'rgba(240,228,200,0.02)'; g.fill(); g.restore();
        S.faceCircle(g, c.look, cx, y + u(8) + r, r, { dim: !can });
        let ty = y + u(8) + r * 2 + u(8);
        R.UIK.text(g, c.name, cx, ty, { size: u(13), weight: 700, color: can ? C.text : C.disabled, align: 'center', maxW: cw - u(8) });
        ty += u(21);
        if (extra) {
          const cur = can ? S.item(c.equip[slot]) : null;
          if (can) R.UIK.text(g, R.T('ui.shop.drawStrip.text', { p0: cur ? cur.name : R.T('ui.shop.drawStrip.text_2') }), cx, ty, { size: u(12), color: C.text2, align: 'center', maxW: cw - u(10) });
          ty += extra;
        }
        if (!can) { R.UIK.text(g, R.T('ui.shop.drawStrip.text_3'), cx, ty, { size: u(13), weight: 700, color: C.disabled, align: 'center', maxW: cw - u(8) }); return; }
        if (wearing) { R.UIK.text(g, R.T('ui.shop.drawStrip.text_4'), cx, ty, { size: u(13), weight: 700, color: C.gold, align: 'center', maxW: cw - u(8) }); return; }
        for (const rr of cmp[i].show) {
          this.deltaLine(g, rr, cx, ty, cw - u(4));
          ty += lh;
        }
      });
    },
    /** 増減の 1 行（中央寄せ）: 「守備 ▲+5」「魔防 ±0」。入らなければ名前の字を縮め、それでも入らなければ名前の末尾を「…」に（名前は落とさない） */
    deltaLine(g, rr, cx, y, maxW) {
      const C = T().color, sz = u(S.tall() ? 14 : 15);
      let ns = u(13);
      const dw = rr.d ? S.deltaW(rr.d, sz) : R.UIK.measure('±0', { size: sz, weight: 700 });
      let name = rr.name || '';
      let nw = name ? R.UIK.measure(name, { size: ns }) + u(4) : 0;
      if (name && nw + dw > maxW) {
        const f = R.UIK.fitSize(name, Math.max(u(8), maxW - dw - u(4)), { size: ns });
        name = f.s; ns = f.size; nw = R.UIK.measure(name, { size: ns }) + u(4);
        if (name === '…') { name = ''; nw = 0; }   // 数字だけでも入らないほど狭いときだけ
      }
      const x0 = cx - (nw + dw) / 2;
      if (nw) R.UIK.text(g, name, x0, y + (sz - ns) / 2, { size: ns, color: rr.d ? C.text2 : C.same });   // 変わらない行は名前も薄く
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
      R.UIK.text(g, buy ? R.T('ui.shop.drawQty.text') : R.T('ui.shop.drawQty.text_2'), px, y + u(18), { size: u(18), weight: 700, color: C.gold });
      S.itemLabel(g, q.id, px, y + u(52), { size: u(15), maxW: pw - u(120) });
      R.UIK.text(g, (buy ? R.T('ui.shop.drawQty.text_3') : R.T('ui.shop.drawQty.text_4')) + R.UIK.num(unit) + ' G', px + pw, y + u(52), { size: u(14), color: C.text2, align: 'right' });
      // −10 −1 [数] ＋1 ＋10
      const ry = y + u(86), bw = Math.min(u(64), (pw - u(90)) / 4);
      const nx = px + pw / 2;
      q.rects.m10 = button(g, { x: px, y: ry, w: bw, h: bh }, '−10', { disabled: q.n <= 1 });
      q.rects.m1 = button(g, { x: px + bw + u(8), y: ry, w: bw, h: bh }, '−1', { disabled: q.n <= 1 });
      q.rects.p1 = button(g, { x: px + pw - bw * 2 - u(8), y: ry, w: bw, h: bh }, R.T('ui.shop.drawQty.p1.button'), { disabled: q.n >= q.max });
      q.rects.p10 = button(g, { x: px + pw - bw, y: ry, w: bw, h: bh }, R.T('ui.shop.drawQty.p10.button'), { disabled: q.n >= q.max });
      R.UIK.text(g, '×' + q.n, nx, ry + (bh - u(28)) / 2, { size: u(28), weight: 700, color: C.goldHi, align: 'center' });
      const capLine = q.n >= q.max ? (q.cap === 'gold' ? R.T('ui.shop.drawQty.capLine') : q.cap === 'stack' ? R.T('ui.shop.drawQty.capLine_2', { MAX }) : R.T('ui.shop.drawQty.capLine_3')) : '';
      R.UIK.text(g, R.T('ui.shop.drawQty.text_5', { capLine }), nx, ry + bh + u(8), { size: u(12.5), color: capLine ? C.text2 : C.text3, align: 'center', maxW: pw });
      // 合計と所持金
      const ty = ry + bh + u(36);
      R.UIK.text(g, (buy ? R.T('ui.shop.drawQty.text_6') : R.T('ui.shop.drawQty.text_7')) + R.UIK.num(total) + ' G', px, ty, { size: u(17), weight: 700, color: C.gold });
      const after = buy ? S.gold() - total : S.gold() + total;
      R.UIK.text(g, R.T('ui.shop.drawQty.text_8', { UIK: R.UIK.num(S.gold()), after: R.UIK.num(after) }), px + pw, ty + u(3), { size: u(13), color: C.text2, align: 'right', maxW: pw * 0.55 });
      // 決める・やめる
      const oy = y + h - bh - u(16), ow = (pw - u(12)) / 2;
      q.rects.ok = button(g, { x: px, y: oy, w: ow, h: bh }, buy ? R.T('ui.shop.drawQty.ok.button') : R.T('ui.shop.drawQty.ok.button_2'), { primary: true, size: 16 });
      q.rects.cancel = button(g, { x: px + ow + u(12), y: oy, w: ow, h: bh }, R.T('ui.shop.drawQty.cancel.button'), { size: 16 });
    },
    /** 「使わない物をまとめて売る」の札: 候補（✓・名前・わけ・×n・売値）→ 合計 → まとめて売る・やめる */
    drawJunk(g) {
      const j = this.junk, C = T().color, L = j.list, rp = L.rowPx();
      const shown = Math.min(L.rows.length, 11);
      const w = Math.min(R.W - u(32), u(640)), h = u(20) + u(34) + u(24) + shown * rp + u(52);
      const x = (R.W - w) / 2, y = Math.max(u(20), (R.H - h) / 2);
      R.UIK.dim(g, 0.5);
      R.UIK.panel(g, { x, y, w, h }, { dense: true, frost: true });
      const px = x + u(24), pw = w - u(48);
      R.UIK.text(g, R.T('ui.shop.drawJunk.text'), px, y + u(18), { size: u(18), weight: 700, color: C.gold });
      R.UIK.text(g, R.T('ui.shop.drawJunk.text_2'), px, y + u(50), { size: u(12.5), color: C.text3, maxW: pw });
      L.render = (gg, row, rect, f) => {
        const cy = rect.y + (rect.h - u(15)) / 2 - u(1);
        if (row.value === '__ok' || row.value === '__cancel') {
          const ok = row.value === '__ok';
          R.UIK.text(gg, row.label, rect.x + u(14), cy, { size: u(15.5), weight: 700, color: ok ? C.goldHi : C.text });
          if (ok) R.UIK.text(gg, R.T('ui.shop.drawJunk.render.text', { UIK: R.UIK.num(this.junkTotal()) }), rect.x + rect.w - u(12), cy, { size: u(15.5), weight: 700, color: C.gold, align: 'right' });
          return;
        }
        const r = j.rows.find((z) => z.id === row.value);
        const on = r && r.on;
        // 売る印（✓）と外した印（空の枠）
        if (on) R.UIK.icon(gg, 'check', rect.x + u(10), rect.y + (rect.h - u(16)) / 2, u(16), C.up);
        else { gg.save(); R.UIK.rr(gg, rect.x + u(11), rect.y + (rect.h - u(14)) / 2, u(14), u(14), u(3)); gg.strokeStyle = C.disabled; gg.lineWidth = 1; gg.stroke(); gg.restore(); }
        const right = rect.x + rect.w - u(12);
        const tw = R.UIK.text(gg, R.UIK.num(r.total) + ' G', right, cy, { size: u(15), weight: 700, color: on ? C.gold : C.disabled, align: 'right' });
        const nw = R.UIK.text(gg, '×' + r.n, right - Math.max(tw, u(84)) - u(12), cy + u(1), { size: u(13.5), color: on ? C.text2 : C.disabled, align: 'right' });
        const ww = R.UIK.text(gg, r.why, right - Math.max(tw, u(84)) - u(12) - nw - u(14), cy + u(2), { size: u(12), color: C.text3, align: 'right' });
        S.itemLabel(gg, r.id, rect.x + u(34), cy, { focused: f, size: u(15), maxW: rect.w - u(34) - (Math.max(tw, u(84)) + nw + ww + u(50)), disabled: !on && !f });
      };
      L.draw(g, { x: x + u(12), y: y + u(78), w: w - u(24), h: shown * rp });
      const got = this.junkTotal();
      R.UIK.text(g, R.T('ui.shop.drawJunk.text_3', { UIK: R.UIK.num(S.gold()), UIK2: R.UIK.num(S.gold() + got) }), px + pw, y + h - u(34), { size: u(13.5), color: C.text2, align: 'right' });
      R.UIK.text(g, R.T('ui.shop.drawJunk.text_4', { length: j.rows.filter((r) => r.on).length, length2: j.rows.length }), px, y + h - u(34), { size: u(13.5), color: C.text2 });
    },
  });
})(window.RPG);
