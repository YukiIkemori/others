// MENUS: 店（MODERN_UI §6.13 shop.png、A6・A17・A20）。params {id, face?, line?} → undefined（売り買いは画面の中で R.Game を書く）
//   左上: 店の人の顔・店の名前・ひとこと。右上: 所持金。タブ: 買う／売る（R・L）。
//   左: 一覧（アイコン・名前・付けられる人の小さな顔 4 つ（付けられない人は薄く）・持っている数・値段。買えない値段は灰色）。
//   右: 選んだ品の名前・種類・主な値・説明、4 人それぞれのいまの装備と増減（▲+n／▼−n、人の切り替えの操作なし）、数量と合計。
//   買うと「装備する？」を、付けられる人の中で一番上がる人を先に選んだ状態で聞く。品を入れるのは R.State.gain（1 か所）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const EQUIP = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const MAX = 99;

  function gain(id, n) {
    if (R.State && R.State.gain) return R.State.gain(id, n);
    R.Game.items[id] = (R.Game.items[id] || 0) + n;
    return { item: id, n };
  }
  function owned(id) {
    let n = S.count(id);
    for (const c of S.party().concat(R.Party.reserve ? R.Party.reserve() : [])) for (const s of Object.keys(c.equip || {})) if (c.equip[s] === id) n++;
    return n;
  }

  S.def('shop', {
    init(p) {
      this.shop = (R.DB.shops || {})[p.id] || { name: '店', items: [] };
      this.tab = 0;
      this.qty = 1;
      this.list = new R.UIK.List({ rows: [], rowH: 38 });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(undefined);
      this.list.onDetail = (row) => { if (row && row.value) S.detail({ kind: 'item', id: row.value }); };
      this.refresh(false);
      this.busy = false;
    },
    price(id) { const it = S.item(id); return (it && it.price) || 0; },
    refresh(keep) {
      if (this.tab === 0) {
        const ids = R.Rules.shopItems ? R.Rules.shopItems(this.p.id) : this.shop.items || [];
        this.list.setRows(ids.filter((id) => S.item(id)).map((id) => ({ value: id, label: S.item(id).name })), keep);
      } else {
        const ids = S.bag().filter((id) => { const it = S.item(id); return it && it.slot !== 'key' && R.Rules.sellPrice(id) > 0; })
          .sort((a, b) => EQUIP.indexOf(S.item(a).slot) - EQUIP.indexOf(S.item(b).slot) || (S.item(a).sort || 0) - (S.item(b).sort || 0));
        this.list.setRows(ids.map((id) => ({ value: id, label: S.item(id).name })), keep);
      }
      this.qty = 1;
    },
    isEquip(id) { const it = S.item(id); return !!(it && EQUIP.includes(it.slot)); },
    maxQty(id) {
      if (this.tab === 1) return Math.max(1, S.count(id));
      const p = this.price(id);
      return Math.max(1, Math.min(MAX - S.count(id), p > 0 ? Math.floor(S.gold() / p) : MAX));
    },
    async pick(row) {
      if (this.busy) return;
      const id = row.value, it = S.item(id);
      if (!it) return;
      this.busy = true;
      try {
        if (this.tab === 0) {
          const total = this.price(id) * this.qty;
          if (total > S.gold()) { R.UIK.sfx('buzzer'); R.UIK.toast('お金が足りない', { anchor: 'bl' }); return; }
          if (S.count(id) + this.qty > MAX) { R.UIK.sfx('buzzer'); R.UIK.toast('これ以上は持てない', { anchor: 'bl' }); return; }
          R.Game.gold -= total;
          gain(id, this.qty);
          R.UIK.sfx('coin');
          R.UIK.toast(`${it.name}${this.qty > 1 ? ' ×' + this.qty : ''} を買った`, { anchor: 'tr', icon: S.iconOf(it) });
          if (this.isEquip(id)) await this.offerEquip(id);
          this.qty = 1;
        } else {
          const sp = R.Rules.sellPrice(id) * this.qty;
          if (it.grade === 'rare' || it.grade === 'super' || it.unique || it.stealOnly) {
            const k = await S.ask(this, { title: it.name, text: `めずらしい品だ。${sp} G で売る？`, choices: ['売る', 'やめる'], cancel: 1 });
            if (k !== 0) return;
          }
          R.Game.items[id] -= this.qty;
          if (R.Game.items[id] <= 0) delete R.Game.items[id];
          R.Game.gold += sp;
          R.UIK.sfx('coin');
          R.UIK.toast(`${it.name} を ${sp} G で売った`, { anchor: 'bl', icon: 'coin' });
          this.refresh(true);
        }
      } finally { this.busy = false; }
    },
    async offerEquip(id) {
      const mem = S.party().filter((c) => R.Rules.canEquip(c, id, R.Rules.defaultSlot(c, id)));
      if (!mem.length) return;
      const gainOf = (c) => S.equipScore(c, R.Rules.defaultSlot(c, id), id) - S.equipScore(c, R.Rules.defaultSlot(c, id), c.equip[R.Rules.defaultSlot(c, id)] || null);
      mem.sort((a, b) => gainOf(b) - gainOf(a));
      const choices = mem.map((c) => { const d = S.bestDelta(S.statDiff(c, R.Rules.defaultSlot(c, id), id)); return { label: c.name, right: d ? `${d.name} ${d.d > 0 ? '+' : '−'}${Math.abs(d.d)}` : '' }; });
      const k = await S.ask(this, { title: '装備する？', text: S.item(id).name, choices: choices.concat([{ label: '装備しない' }]), cancel: mem.length });
      if (k < 0 || k >= mem.length) return;
      const c = mem[k];
      const r = R.Rules.equip(c, R.Rules.defaultSlot(c, id), id);
      if (r.ok) { R.UIK.sfx('equip'); R.UIK.toast(`${c.name} が ${S.item(id).name} を付けた`, { anchor: 'bl', icon: 'equip' }); }
      else R.UIK.toast(r.reason || '付けられない', { anchor: 'bl' });
    },
    update() {
      if (this.busy) return;
      const I = R.Input;
      const k = S.tabInput(this.tabRects, this.tab, 2);
      if (k >= 0) { this.tab = k; this.refresh(false); return; }
      const row = this.list.current();
      if (row && !this.isEquip(row.value) || (row && this.tab === 1)) {
        const mx = this.maxQty(row.value);
        if (I.repeat('right')) { this.qty = Math.min(mx, this.qty + 1); R.UIK.sfx('cursor'); return; }
        if (I.repeat('left')) { this.qty = Math.max(1, this.qty - 1); R.UIK.sfx('cursor'); return; }
      }
      if (I.pressed('x') && row) { S.detail({ kind: 'item', id: row.value }); return; }
      const before = this.list.index;
      this.list.update();
      if (this.list.index !== before) this.qty = 1;
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const lw = tall ? b.w : Math.min(u(420), b.w * 0.44);
      // 店の人
      const hp = { x: b.x, y: b.y, w: tall ? b.w : lw, h: u(72) };
      R.UIK.panel(g, hp, { frost: true });
      const face = this.p.face;
      let tx = hp.x + u(18);
      if (face && R.UIK.hasFace(face)) { R.UIK.portraitFrame(g, { x: hp.x + u(10), y: hp.y + u(10), w: u(52), h: u(52) }, face, {}); tx = hp.x + u(74); }
      else { R.UIK.icon(g, this.shop.kind === 'weapon' ? 'sword' : 'shop', hp.x + u(18), hp.y + u(22), u(26), C.gold); tx = hp.x + u(60); }
      R.UIK.text(g, this.shop.name, tx, hp.y + u(13), { size: u(18), weight: 700, color: C.text, maxW: hp.w - (tx - hp.x) - u(16) });
      R.UIK.text(g, this.p.line ? '「' + this.p.line + '」' : (this.shop.kind === 'weapon' ? '「いい品がそろってるよ」' : '「旅の支度はここで」'), tx, hp.y + u(42), { size: u(12.5), color: C.text2, maxW: hp.w - (tx - hp.x) - u(16) });
      // 所持金
      const gp = tall ? { x: b.x + b.w - u(190), y: hp.y + hp.h + u(8), w: u(190), h: u(40) } : { x: b.x + b.w - u(236), y: b.y + u(8), w: u(236), h: u(52) };
      R.UIK.panel(g, gp, { frost: true });
      R.UIK.icon(g, 'coin', gp.x + u(14), gp.y + (gp.h - u(17)) / 2, u(17), C.gold);
      R.UIK.text(g, '所持金', gp.x + u(40), gp.y + (gp.h - u(13)) / 2, { size: u(13), color: C.text2 });
      R.UIK.text(g, R.UIK.num(S.gold()) + ' G', gp.x + gp.w - u(14), gp.y + (gp.h - u(18)) / 2 - u(1), { size: u(18), weight: 700, color: C.gold, align: 'right' });
      // タブと一覧
      const ty = tall ? hp.y + hp.h + u(8) : hp.y + hp.h + u(12);
      this.tabRects = S.tabs(g, ['買う', '売る'], this.tab, b.x, ty);
      const lp = { x: b.x, y: ty + u(46), w: lw, h: tall ? u(300) : b.y + b.h - (ty + u(46)) };
      R.UIK.panel(g, lp, { frost: true });
      R.UIK.text(g, '品物', lp.x + u(22), lp.y + u(12), { size: u(12), color: C.text3 });
      R.UIK.text(g, '持っている', lp.x + lp.w - u(96), lp.y + u(12), { size: u(12), color: C.text3, align: 'right' });
      R.UIK.text(g, this.tab === 0 ? '値段' : '売値', lp.x + lp.w - u(20), lp.y + u(12), { size: u(12), color: C.text3, align: 'right' });
      const mem = S.party();
      this.list.render = (gg, row, rect, f) => {
        const id = row.value, it = S.item(id), sz = u(15), cy = rect.y + (rect.h - sz) / 2 - u(1);
        const pr = this.tab === 0 ? this.price(id) : R.Rules.sellPrice(id);
        const cant = this.tab === 0 && pr > S.gold();
        const faceW = this.isEquip(id) ? mem.length * u(18) + u(8) : 0;
        S.itemLabel(gg, id, rect.x + u(14), cy, { focused: f, size: sz, maxW: rect.w - u(150) - faceW });
        if (faceW) mem.forEach((c, i) => S.faceCircle(gg, c.look, rect.x + rect.w - u(150) - faceW + u(10) + i * u(18), rect.y + rect.h / 2, u(8), { dim: !R.Rules.canEquip(c, id, R.Rules.defaultSlot(c, id)) }));
        const n = this.tab === 0 ? owned(id) : S.count(id);
        R.UIK.text(gg, n ? String(n) : '―', rect.x + rect.w - u(106), cy + u(1), { size: u(14), color: C.text2, align: 'right' });
        R.UIK.text(gg, R.UIK.num(pr) + ' G', rect.x + rect.w - u(12), cy, { size: sz, weight: 700, color: cant ? C.disabled : C.text, align: 'right' });
        void it;
      };
      this.list.draw(g, { x: lp.x + u(8), y: lp.y + u(34), w: lp.w - u(16), h: lp.h - u(42) });
      if (!this.list.rows.length) R.UIK.text(g, this.tab === 0 ? '並んでいる品がない。' : '売れる物を持っていない。', lp.x + u(22), lp.y + u(44), { size: u(14.5), color: C.text3 });
      // 右
      const dp = tall ? { x: b.x, y: lp.y + lp.h + u(12), w: b.w, h: b.y + b.h - (lp.y + lp.h + u(12)) } : { x: lp.x + lp.w + u(18), y: gp.y + gp.h + u(14), w: b.x + b.w - (lp.x + lp.w + u(18)), h: b.y + b.h - (gp.y + gp.h + u(14)) };
      R.UIK.panel(g, dp, { frost: true });
      const row = this.list.current();
      if (!row) { S.prompts(g, [{ btn: 'b', label: '戻る' }]); return; }
      const id = row.value, it = S.item(id);
      const px = dp.x + u(22), pw = dp.w - u(44);
      let y = dp.y + u(18);
      const nw = R.UIK.text(g, it.name, px, y, { size: u(22), weight: 700, color: S.gradeColor(it) || C.goldHi, maxW: pw * 0.6 });
      R.UIK.stars(g, it.grade, px + Math.min(nw, pw * 0.6) + u(8), y + u(5), u(15));
      const ms = S.mainStats(it);
      ms.slice(0, 2).reverse().forEach((m, i) => {
        const xx = px + pw - i * u(110);
        R.UIK.text(g, String(m.v), xx, y - u(2), { size: u(24), weight: 700, color: C.text, align: 'right' });
        R.UIK.text(g, m.name, xx - u(46), y + u(6), { size: u(12.5), color: C.text2, align: 'right' });
      });
      y += u(36);
      R.UIK.text(g, it.slot === 'use' ? '道具' : S.kindLine(it), px, y, { size: u(13), color: C.text2 }); y += u(28);
      for (const l of R.UIK.wrap(String(it.desc || '').replace(/\n/g, ''), pw, { size: u(14.5) }).slice(0, 2)) { R.UIK.text(g, l, px, y, { size: u(14.5), color: C.text }); y += u(24); }
      y += u(4); R.UIK.rule(g, px, px + pw, y, 0.14); y += u(12);
      if (this.isEquip(id)) {
        S.label(g, 'いまの装備と比べると', px, y); y += u(28);
        const rh = Math.min(u(56), (dp.y + dp.h - u(56) - y) / Math.max(1, mem.length));
        mem.forEach((c) => {
          const slot = R.Rules.defaultSlot(c, id);
          const can = R.Rules.canEquip(c, id, slot);
          S.faceCircle(g, c.look, px + u(20), y + rh / 2, Math.min(u(20), rh / 2 - u(2)), { dim: !can });
          R.UIK.text(g, c.name, px + u(50), y + rh / 2 - (tall ? u(9) : u(17)), { size: u(14.5), weight: 700, color: can ? C.text : C.disabled });
          if (!can) { R.UIK.text(g, '付けられない', tall ? px + pw : px + u(50), tall ? y + rh / 2 - u(8) : y + rh / 2 + u(3), { size: u(12), color: C.disabled, align: tall ? 'right' : 'left' }); y += rh; return; }
          const cur = S.item(c.equip[slot]);
          if (!tall) R.UIK.text(g, 'いま：' + (cur ? cur.name : 'なし'), px + u(50), y + rh / 2 + u(3), { size: u(12), color: C.text2, maxW: pw * 0.4 });
          const rows = S.statDiff(c, slot, id).filter((r) => r.d).sort((a, b2) => Math.abs(b2.d) - Math.abs(a.d)).slice(0, tall ? 1 : 2);
          if (!rows.length) R.UIK.text(g, '変わらない', px + pw, y + rh / 2 - u(8), { size: u(13), color: C.same, align: 'right' });
          rows.forEach((r, i) => {
            const xx = px + pw - i * u(128);
            S.delta(g, r.d, xx, y + rh / 2 - u(10), { size: u(17) });
            R.UIK.text(g, r.name, xx - u(66), y + rh / 2 - u(8), { size: u(13), color: C.text2, align: 'right' });
          });
          y += rh;
        });
      } else if (it.slot === 'use') {
        R.UIK.text(g, it.use && it.use.field ? 'フィールドでも戦闘でも使える。' : '戦闘で使う。', px, y, { size: u(13.5), color: C.teal });
      }
      // 数量と合計
      const qy = dp.y + dp.h - u(40);
      if (!this.isEquip(id) || this.tab === 1) {
        R.UIK.text(g, '数量', px, qy + u(2), { size: u(13), color: C.text2 });
        R.UIK.text(g, '‹  ' + this.qty + '  ›', px + u(70), qy, { size: u(17), weight: 700, color: C.text });
      }
      const unit = this.tab === 0 ? this.price(id) : R.Rules.sellPrice(id);
      R.UIK.text(g, (this.tab === 0 ? '合計 ' : '受け取り ') + R.UIK.num(unit * this.qty) + ' G', px + pw, qy - u(1), { size: u(18), weight: 700, color: this.tab === 0 && unit * this.qty > S.gold() ? C.down : C.gold, align: 'right' });
      S.prompts(g, [{ btn: 'a', label: this.tab === 0 ? '買う' : '売る' }, { btn: 'b', label: '戻る' }, { btn: 'x', label: '詳しく' }, { btn: 'r', label: this.tab === 0 ? '売る' : '買う' }]);
    },
  });
})(window.RPG);
