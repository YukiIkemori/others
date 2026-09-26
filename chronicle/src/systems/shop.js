// Town services (DESIGN §11.7.16): shops (買う / 売る with the tier stock of R.Tier.shopItems, the side
// panel of the 4 members — × cannot / E wearing / ▲▼ strength change / ○ no numbers — ←→ to pick the
// member whose full stat change is shown, L/R to narrow long gear lists by kind, Y for the detail popup,
// "equip now?" with buy-back of what comes off) and the inn (everyone, the reserve too, healed and raised).
//   await R.Shop.open(shopId)   await R.Shop.inn(price) → bool
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Shop = (R.Shop = R.Shop || {});
  const K = () => R.Menu.kit;

  const GEAR = { weapon: 1, shield: 1, head: 1, body: 1, hands: 1, feet: 1, acc: 1 };
  const isGear = (it) => !!(it && GEAR[it.type]);
  const sellable = (it) => !!(it && it.type !== 'key' && (it.price || 0) > 0 && !it.unique);
  const sellPrice = (it) => (sellable(it) ? Math.floor(it.price / 2) : 0);
  Shop.sellPrice = sellPrice;
  // explicit flags: a reused message window would otherwise inherit noWait from the last prompt
  const say = (t, o) => R.UI.say(t, Object.assign({ noWait: false, keep: false, auto: 0 }, o));
  const ask = async (t, items, o) => { await say(t, { noWait: true }); return K().choose(items, o || {}); };
  const yesno = (t) => R.UI.yesno(t);

  /** the goods of a shop: R.Tier.shopItems (tier stock, §8.11.1), else its fixed items */
  function stock(shopId) {
    const shop = DB.shops[shopId];
    const ids = R.Tier && R.Tier.shopItems ? R.Tier.shopItems(shopId) : (shop && shop.items) || [];
    return ids.filter((id) => DB.items[id]);
  }
  Shop.stock = stock;

  /** the slot a bought piece would go to for member c (the first empty fitting slot, else the weaker one) */
  function slotFor(c, id) {
    const Kt = K();
    const list = Kt.slotsFor(id).filter((s) => Kt.canEquip(c, id, s));
    if (!list.length) return null;
    const empty = list.find((s) => !c.equip[s]);
    if (empty) return empty;
    if (list.length === 1) return list[0];
    // both filled: the one where the new piece gains the most
    let best = list[0], bv = -Infinity;
    for (const s of list) { const v = R.Menu.candScore(Kt.previewDiff(c, s, id), s, R.Menu.gearStyle(c)); if (v > bv) { bv = v; best = s; } }
    return best;
  }
  Shop.slotFor = slotFor;

  /**
   * the side-panel mark of gear `id` for member c (§11.7.16): {mark:'×'|'E'|'▲'|'▼'|'○'|'―', n, slot, diff}
   * ▲▼ are the candidate score of the equipment list (max(Δ攻,Δ術)+Δ守+floor(Δ術防/2)).
   */
  function gearMark(c, id) {
    const Kt = K();
    const it = DB.items[id];
    const slots = Kt.slotsFor(id);
    if (slots.some((s) => c.equip[s] === id)) return { mark: 'E', slot: slots.find((s) => c.equip[s] === id) };
    const slot = slotFor(c, id);
    if (!slot) return { mark: '×' };
    const diff = Kt.previewDiff(c, slot, id);
    const n = Math.round(R.Menu.candScore(diff, slot, R.Menu.gearStyle(c)));
    const numbers = it.type === 'weapon' || it.type !== 'acc' || Object.keys(it.stats || {}).some((k) => it.stats[k]);
    if (!numbers) return { mark: '○', slot, diff, n: 0 };
    return { mark: n > 0 ? '▲' : n < 0 ? '▼' : '―', n: Math.abs(n), slot, diff };
  }
  Shop.gearMark = gearMark;

  // ------------------------------------------------------------ gold window
  class GoldLayer extends R.Layer {
    draw() {
      G().window(172, 4, 80, 24);
      G().text('G', 180, 10, { color: '#c8c8d8' });
      R.Menu.kit.fitText(String(R.Game.gold), 244, 10, 56, { align: 'right' });
    }
  }

  // ------------------------------------------------------------ buy / sell lists
  const FILTERS = [null, 'weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const FILTER_NAMES = ['全部', '武器', '盾', '頭', '体', '手', '足', 'アクセサリ'];
  const state = { member: 0, filter: 0 };
  class ShopList extends R.Layer {
    /** mode 'buy' | 'sell' */
    constructor(mode, ids, index) {
      super();
      this.mode = mode;
      this.all = ids;
      this.member = Math.min(state.member, R.Game.party.length - 1);
      // L/R narrows the list by kind only when it holds gear of several kinds and does not fit (§8.16-2)
      const kinds = new Set(ids.map((id) => DB.items[id].type).filter((t) => GEAR[t]));
      this.canFilter = kinds.size > 1 && ids.length > 9;
      this.filter = this.canFilter ? state.filter : 0;
      this.list = new R.UI.List({ x: 4, y: 4, w: 166, rows: 9, items: [], drawItem: (row, x, y, w) => this.drawRow(row, x, y, w) });
      this.apply(index || 0);
    }
    apply(index) {
      const f = FILTERS[this.filter];
      this.ids = f ? this.all.filter((id) => DB.items[id].type === f) : this.all.slice();
      if (!this.ids.length) { this.filter = 0; this.ids = this.all.slice(); }
      this.list.setItems(this.ids.map((id) => ({ id, disabled: this.mode === 'sell' && !sellable(DB.items[id]) })), false);
      this.list.index = Math.min(index || 0, Math.max(0, this.ids.length - 1));
      this.list.scrollTo();
      this.list.title = this.canFilter ? FILTER_NAMES[this.filter] : undefined;
    }
    update() {
      const cur = this.list.item && this.list.item.id;
      const party = R.Game.party;
      if (In().pressed('y') && cur) { R.Menu.itemDetail(cur, { member: party[this.member] }); return; }
      const lr = K().memberStep();
      if (lr && this.canFilter) {
        this.filter = (this.filter + (lr < 0 ? FILTERS.length - 1 : 1)) % FILTERS.length;
        state.filter = this.filter;
        R.sfx('page');
        this.apply(0);
        return;
      }
      const d = In().dirRepeat();
      if (d === 'left' || d === 'right') {
        this.member = K().cycle(this.member, d === 'left' ? -1 : 1, party.length);
        state.member = this.member;
        R.sfx('cursor');
        return;
      }
      const r = this.list.update();
      if (r === 'select') this.close(this.list.item.id);
      else if (r === 'cancel') this.close(null);
    }
    drawRow(row, x, y, w) {
      const Kt = K();
      const it = DB.items[row.id];
      Kt.drawIcon(it, x - 2, y + 2);
      const price = this.mode === 'buy' ? it.price || 0 : sellPrice(it);
      const afford = this.mode === 'sell' || R.Game.gold >= price;
      Kt.fitText(Kt.itemLabel(row.id), x + 9, y, w - 46, { color: row.disabled ? Kt.COL.gray : Kt.itemColor(row.id) });
      G().text(price ? String(price) : '―', x + w - 2, y, { align: 'right', color: row.disabled ? Kt.COL.gray : afford ? '#ffffff' : G().C.red });
    }
    draw() {
      const Kt = K();
      this.list.draw();
      if (this.canFilter) {
        // small plates flanking the title plate on the top border: L◀ 全部 ▶R
        const L = this.list, th = Kt.theme();
        const tw = Math.ceil(G().textWidth(L.title || '')) + 8;
        const tx = L.x + Math.floor((L.w - tw) / 2);
        const py = Math.max(0, L.y - 3);
        G().rect(tx - 16, py, 16, 8, th.fill);
        G().text('L◀', tx - 2, L.y - 2, { align: 'right', color: Kt.COL.sub, size: 8 });
        G().rect(tx + tw, py, 16, 8, th.fill);
        G().text('▶R', tx + tw + 2, L.y - 2, { color: Kt.COL.sub, size: 8 });
      }
      const id = this.list.item && this.list.item.id;
      const it = id && DB.items[id];
      const party = R.Game.party;
      G().window(172, 30, 80, 118);
      if (it && isGear(it)) {
        party.forEach((c, i) => {
          const y = 36 + 28 * i;
          const mk = gearMark(c, id);
          const sel = i === this.member;
          if (sel) G().rect(175, y - 2, 74, 27, Kt.blink(20) ? '#2a3a74' : '#243266');
          Kt.drawSpriteAt(c, 176, y, { dark: mk.mark === '×', darkAmt: 0.7, frame: mk.mark !== '×' && sel ? Math.floor(R.Engine.frame / 20) : 0 });
          Kt.fitText(c.name, 194, y + 1, 54, { color: mk.mark === '×' ? Kt.COL.gray : '#ffffff' });
          const my = y + 13;
          if (mk.mark === '×') G().text('×', 194, my, { color: Kt.COL.gray });
          else if (mk.mark === 'E') G().text('E', 194, my, { color: G().C.cyan });
          else if (mk.mark === '○') G().text('○', 194, my);
          else if (mk.mark === '―') G().text('―', 194, my, { color: Kt.COL.zero });
          else G().text(mk.mark + mk.n, 194, my, { color: mk.mark === '▲' ? G().C.green : G().C.red });
        });
      } else if (it) {
        G().text('持っている数', 180, 38, { color: Kt.COL.sub, size: 8 });
        G().text(R.State.count(id) + '個', 244, 52, { align: 'right' });
        if (this.mode === 'sell') {
          G().text('売値', 180, 72, { color: Kt.COL.sub, size: 8 });
          G().text(sellable(it) ? sellPrice(it) + 'ゴールド' : '―', 244, 86, { align: 'right', color: sellable(it) ? G().C.yellow : Kt.COL.gray });
        } else if (it.use) {
          G().text(it.use.battle && it.use.field ? 'いつでも' : it.use.field ? '移動中' : it.use.battle ? '戦闘中' : '', 244, 110, { align: 'right', color: Kt.COL.sub, size: 8 });
        }
      }
      // description (in place of the shopkeeper's message)
      G().window(8, 150, 240, 68, it ? { title: 'Y：詳細' } : undefined);
      if (!it) { G().text(this.mode === 'sell' ? '売れる物を持っていない。' : '', 18, 157, { color: Kt.COL.gray }); return; }
      String(it.desc || '').split('\n').slice(0, 2).forEach((l, i) => Kt.fitText(l, 18, 156 + i * 14, 220));
      if (isGear(it)) {
        const c = party[this.member];
        const mk = gearMark(c, id);
        if (mk.diff) {
          const segs = [{ text: c.name + '：', color: Kt.COL.sub }];
          let any = false;
          const KEYS = ['atk1', 'atk2', 'mag', 'def', 'mdef', 'hit', 'eva', 'crit', 'str', 'vit', 'dex', 'agi', 'int', 'mnd'];
          for (const k of KEYS) {
            const v = mk.diff[k];
            if (!v) continue;
            if (any) segs.push({ text: '　' });
            segs.push({ text: Kt.STAT_NAMES[k] + Kt.signed(v), color: v > 0 ? G().C.green : G().C.red });
            any = true;
          }
          if (!any) segs.push({ text: '変わる能力はない', color: Kt.COL.gray });
          Kt.drawSegs(segs, 18, 184, 220);
        } else {
          Kt.fitText(c.name + '：' + (mk.mark === 'E' ? '装備している' : '装備できない'), 18, 184, 220, { color: Kt.COL.gray });
        }
        G().text('←→：人を選ぶ', 18, 200, { color: Kt.COL.gray, size: 8 });
      } else if (it.use) G().text(R.Menu.effectPhrases ? R.Menu.effectPhrases(it.use.effects).map((p) => p.text).join('　') : '', 18, 184, { color: G().C.cyan, size: 8 });
    }
  }

  // ------------------------------------------------------------ flows
  async function buy(shopId) {
    const ids = stock(shopId);
    if (!ids.length) { await say('あいにく、今は品切れでして……。'); return; }
    let idx = 0;
    for (;;) {
      R.UI.closeMessage();
      const L = new ShopList('buy', ids, idx);
      const id = await R.Engine.run(L);
      if (!id) return;
      idx = Math.max(0, L.ids.indexOf(id));
      const it = DB.items[id];
      if (R.Game.gold < (it.price || 0)) { R.sfx('buzzer'); await say('お金が足りないようですね。'); continue; }
      if (isGear(it)) await buyGear(id, it, R.Game.party[L.member]);
      else await buyItems(id, it);
    }
  }

  async function buyItems(id, it) {
    const room = R.State.room ? R.State.room(id) : 99 - R.State.count(id);
    if (room <= 0) { await say('それ以上は持てないようですね。'); return; }
    const max = Math.max(1, Math.min(room, Math.floor(R.Game.gold / Math.max(1, it.price || 1))));
    await say(it.name + 'ですね。\nいくつお求めですか？', { noWait: true });
    const n = await K().number({ min: 1, max, initial: 1, price: it.price, label: it.name.length > 6 ? '個数' : it.name, w: 132 });
    if (n < 1) return;
    const total = (it.price || 0) * n;
    if (!R.State.takeGold(total)) { R.sfx('buzzer'); await say('お金が足りないようですね。'); return; }
    R.State.addItem(id, n);
    R.sfx('gold');
    await say(it.name + 'を' + n + '個ですね。\n毎度ありがとうございます！');
  }

  async function buyGear(id, it, focus) {
    const Kt = K();
    const party = R.Game.party;
    const can = (c) => !!slotFor(c, id);
    const who = party.filter(can);
    if (!who.length && !(await yesno(it.name + 'を装備できる方は\nいらっしゃらないようですが、\nそれでもお買いになりますか？'))) return;
    if (who.length && !(await yesno(it.name + 'ですね。\n' + it.price + 'ゴールドになりますが、\nよろしいですか？'))) return;
    if ((R.State.room ? R.State.room(id) : 99 - R.State.count(id)) <= 0) { await say('それ以上は持てないようですね。'); return; }
    if (!R.State.takeGold(it.price || 0)) { R.sfx('buzzer'); await say('お金が足りないようですね。'); return; }
    R.State.addItem(id, 1);
    R.sfx('gold');
    const cand = who.filter((c) => !Kt.slotsFor(id).some((s) => c.equip[s] === id) || R.State.count(id) > 0);
    if (!cand.length) { await say('毎度ありがとうございます！'); return; }
    if (!(await yesno('毎度ありがとうございます！\nこのまま装備していかれますか？'))) return;
    let c = cand.includes(focus) ? focus : cand[0];
    if (cand.length > 1) {
      R.UI.closeMessage();
      const k = await R.Menu.pickMember({ title: '誰が装備する？', initial: party.indexOf(c), x: 100, y: 34, valid: (m) => cand.includes(m) });
      if (k < 0) return;
      c = party[k];
    }
    let slot = slotFor(c, id);
    const slots = Kt.slotsFor(id).filter((s) => Kt.canEquip(c, id, s));
    if (slots.length > 1 && slots.every((s) => c.equip[s])) {
      R.UI.closeMessage();
      const j = await Kt.choose(slots.map((s) => ({ label: Kt.slotName(s), right: Kt.itemName(c.equip[s]) })), { x: 76, y: 60, w: 172, title: 'どこに付ける？', initial: Math.max(0, slots.indexOf(slot)) });
      if (j < 0) return;
      slot = slots[j];
    }
    const r = Kt.equip(c, slot, id);
    if (!r.ok) { R.sfx('buzzer'); await say(r.reason || '装備できないようですね。'); return; }
    R.sfx('item');
    const shieldOff = slot !== 'shield' && r.removed.some((x) => DB.items[x] && DB.items[x].type === 'shield');
    await say(c.name + 'は' + it.name + 'を装備した！' + (shieldOff ? '\n盾を外した。' : ''), { keep: true });
    for (const oldId of r.removed) {
      const o = DB.items[oldId];
      const p = sellPrice(o);
      if (!p || R.State.count(oldId) <= 0) continue;
      if (await yesno('今までの' + o.name + 'を\n' + p + 'ゴールドで買い取りましょうか？')) {
        R.State.removeItem(oldId, 1);
        R.State.addGold(p);
        R.sfx('gold');
      }
    }
  }

  async function sell() {
    let idx = 0;
    for (;;) {
      R.UI.closeMessage();
      const ids = R.State.items((it) => it.type !== 'key').map((e) => e.id);
      if (!ids.length) { await say('お売りいただける物を\nお持ちでないようですね。'); return; }
      const L = new ShopList('sell', ids, Math.min(idx, ids.length - 1));
      const id = await R.Engine.run(L);
      if (!id) return;
      idx = Math.max(0, ids.indexOf(id));
      const it = DB.items[id];
      const p = sellPrice(it);
      if (!p) { R.sfx('buzzer'); await say('これは売れない。'); continue; }
      const have = R.State.count(id);
      let n = 1;
      if (have > 1) {
        await say(it.name + 'ですね。\nいくつお売りになりますか？', { noWait: true });
        n = await K().number({ min: 1, max: have, initial: 1, price: p, label: it.name.length > 6 ? '個数' : it.name, w: 132 });
        if (n < 1) continue;
      }
      if (!(await yesno(it.name + (n > 1 ? 'を' + n + '個' : '') + 'なら\n' + p * n + 'ゴールドで買い取りましょう。\nよろしいですか？'))) continue;
      R.State.removeItem(id, n);
      R.State.addGold(p * n);
      R.sfx('gold');
      await say('毎度ありがとうございます！');
    }
  }

  let active = null; // GoldLayer of the open shop (a cleared engine never leaves it stuck)
  /** open shop R.DB.shops[shopId] (買う / 売る) */
  Shop.open = async function (shopId) {
    const shop = DB.shops[shopId];
    if (!shop) { R.warn('Shop.open: unknown shop', shopId); return; }
    if (active && R.Engine.layers.includes(active)) return;
    const gold = (active = R.Engine.push(new GoldLayer()));
    try {
      let first = true, last = 0;
      for (;;) {
        const greet = first ? 'いらっしゃいませ！　何をお求めですか？' : 'ほかにも何かご用はありますか？';
        first = false;
        const i = await ask(greet, ['買う', '売る', 'やめる'], { initial: last });
        if (i >= 0) last = i;
        if (i === 0) await buy(shopId);
        else if (i === 1) await sell();
        else break;
      }
      await say('またのお越しをお待ちしております。');
    } finally {
      R.UI.closeMessage();
      R.Engine.remove(gold);
      if (active === gold) active = null;
    }
  };

  // ------------------------------------------------------------ inn (§4.12.3)
  /** the inn: everyone in the party and the reserve healed and raised. → true if the party stayed */
  Shop.inn = async function (price) {
    if (price == null) price = R.Tier && R.Tier.innPrice ? R.Tier.innPrice() : 10;
    price = Math.max(0, price | 0);
    const gold = R.Engine.push(new GoldLayer());
    try {
      if (!(await yesno('ひと晩' + price + 'ゴールドです。\nお泊まりになりますか？'))) {
        await say('またのお越しをお待ちしております。');
        return false;
      }
      if (!R.State.takeGold(price)) { R.sfx('buzzer'); await say('おや、お金が足りないようですね。'); return false; }
      await say('では、ごゆっくりお休みください。');
      R.UI.closeMessage();
      R.Engine.remove(gold);
      await R.Engine.fadeOut(40);
      if (R.State.healAll) R.State.healAll({ reserve: true });
      for (const c of R.State.all ? R.State.all() : R.Game.party) c.status = {};
      await R.jingle('inn');
      await R.Engine.wait(30);
      if (R.Field && R.Field.setRespawnHere) R.Field.setRespawnHere();
      await R.Engine.fadeIn(40);
      await say('おはようございます。\nいってらっしゃいませ。');
      return true;
    } finally {
      R.UI.closeMessage();
      R.Engine.remove(gold);
      if (R.Engine.fadeAlpha > 0 && !R.Engine._fade) R.Engine.fade(0, 0);
    }
  };
})(window.RPG);
