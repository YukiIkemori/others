// Town services (DESIGN §8): shops (かう / うる with equip markers per member and
// stat preview, quantity input, "equip now?"), the inn and the church.
//   await R.Shop.open(shopId)   await R.Shop.inn(price) → bool   await R.Shop.church()
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Shop = (R.Shop = R.Shop || {});

  const EQUIP = { weapon: 1, shield: 1, head: 1, body: 1, acc: 1 };
  const isGear = (it) => !!(it && EQUIP[it.type]);
  const sellPrice = (it) => (it && it.price > 0 && it.type !== 'key' ? Math.floor(it.price / 2) : 0);
  const K = () => R.Menu.kit;
  // explicit flags: a reused message window would otherwise inherit noWait from the last prompt
  const say = (t, o) => R.UI.say(t, Object.assign({ noWait: false, keep: false, auto: 0 }, o));
  const ask = async (t, items, o) => { await say(t, { noWait: true }); return R.UI.choose(items, o || {}); };

  /** the stat a piece of gear is compared on */
  function keyStat(it) {
    if (!it) return 'atk';
    if (it.type === 'weapon') return it.mag > (it.atk || 0) ? 'mag' : 'atk';
    if (it.type === 'acc') {
      const st = it.stats || {};
      const best = ['str', 'vit', 'agi', 'int', 'mnd', 'luk'].sort((a, b) => (st[b] || 0) - (st[a] || 0))[0];
      if (st[best]) return { str: 'atk', vit: 'def', agi: 'agi', int: 'mag', mnd: 'mdef', luk: 'luk' }[best];
      if (it.def) return 'def';
      if (it.mdef) return 'mdef';
      return null;
    }
    return 'def';
  }
  const STAT_SHORT = { atk: 'こうげき', def: 'しゅび', mag: 'まりょく', mdef: 'まぼうぎょ', agi: 'すばやさ', luk: 'うん' };

  /** delta of the key stat if member c equipped item id (null if cannot) */
  function gearDelta(c, id) {
    const it = DB.items[id];
    const slot = R.Rules.itemSlot(id);
    if (!slot || !R.Rules.canEquip(c, id, slot)) return null;
    const k = keyStat(it);
    if (!k) return { stat: null, d: 0, same: c.equip[slot] === id };
    const cur = R.Rules.stats(c);
    const nxt = R.Menu.previewStats ? R.Menu.previewStats(c, slot, id) : cur;
    return { stat: k, d: (nxt[k] || 0) - (cur[k] || 0), same: c.equip[slot] === id };
  }
  Shop.gearDelta = gearDelta;

  // ------------------------------------------------------------ frame (gold window)
  class GoldLayer extends R.Layer {
    draw() {
      G().window(172, 4, 80, 24);
      G().text(R.Game.gold + ' G', 244, 10, { align: 'right', color: G().C.white });
    }
  }

  // ------------------------------------------------------------ buy / sell lists
  const LIST = { x: 4, y: 4, w: 166, rows: 9 };
  class ShopList extends R.Layer {
    /** mode 'buy' | 'sell' */
    constructor(mode, ids, index) {
      super();
      this.mode = mode;
      this.ids = ids;
      this.list = new R.UI.List(Object.assign({}, LIST, {
        items: ids.map((id) => ({ id, disabled: mode === 'sell' && !sellPrice(DB.items[id]) })),
        index: index || 0,
        drawItem: (row, x, y, w) => this.drawRow(row, x, y, w),
      }));
      if (!this.list.rows) this.list.rows = 1;
    }
    update() {
      const r = this.list.update();
      if (r === 'select') this.close(this.list.index);
      else if (r === 'cancel') this.close(-1);
    }
    drawRow(row, x, y, w) {
      const it = DB.items[row.id];
      K().drawIcon(it, x - 2, y + 2);
      const name = it.name + (it.rare ? '★' : '');
      const price = this.mode === 'buy' ? it.price : sellPrice(it);
      const afford = this.mode === 'sell' || R.Game.gold >= price;
      const col = row.disabled ? G().C.gray : it.rare ? G().C.yellow : G().C.white;
      K().fitText(name, x + 9, y, w - 44, { color: col });
      G().text(price ? String(price) : '―', x + w - 4, y, { align: 'right', color: row.disabled ? G().C.gray : afford ? G().C.white : G().C.red });
    }
    draw() {
      this.list.draw();
      const id = this.list.item && this.list.item.id;
      const it = id && DB.items[id];
      // side panel
      G().window(172, 30, 80, 118);
      if (it && isGear(it)) {
        R.Game.party.forEach((c, i) => {
          const y = 36 + i * 36;
          const d = gearDelta(c, id);
          K().drawSprite(c, 186, y + 26, { dark: !d, darkAmt: 0.75, frame: d ? Math.floor(R.Engine.frame / 20) : 0 });
          G().text(c.name, 198, y + 1, { color: d ? G().C.white : G().C.gray });
          if (!d) G().text('×', 244, y + 14, { align: 'right', color: G().C.gray });
          else if (d.same) G().text('E', 244, y + 14, { align: 'right', color: G().C.yellow });
          else if (d.stat) {
            const col = d.d > 0 ? G().C.green : d.d < 0 ? G().C.red : G().C.gray;
            G().text((d.d > 0 ? '+' : '') + d.d, 244, y + 14, { align: 'right', color: col });
          } else G().text('○', 244, y + 14, { align: 'right', color: G().C.white });
        });
      } else if (it) {
        G().text('もっている', 180, 38, { color: G().C.gray });
        G().text(R.State.count(id) + ' こ', 244, 52, { align: 'right' });
        if (this.mode === 'sell' && sellPrice(it)) {
          G().text('うりね', 180, 72, { color: G().C.gray });
          G().text(sellPrice(it) + ' G', 244, 86, { align: 'right', color: G().C.yellow });
        }
      }
      // description (in place of the shopkeeper's message)
      G().window(8, 150, 240, 68);
      if (!it) { G().text(this.mode === 'sell' ? 'うれる ものを もっていない。' : '', 18, 157, { color: G().C.gray }); return; }
      const lines = G().wrap(it.desc || '', 220).slice(0, 3);
      lines.forEach((l, i) => G().text(l, 18, 157 + i * 14));
      if (isGear(it) && lines.length < 3 && R.Menu.gearSummary) {
        const sum = R.Menu.gearSummary(it);
        if (sum) K().fitText(sum, 18, 157 + lines.length * 14, 220, { color: G().C.cyan });
      }
    }
  }

  // ------------------------------------------------------------ flows
  async function buy(shop) {
    const ids = (shop.items || []).filter((id) => DB.items[id]);
    let idx = 0;
    for (;;) {
      R.UI.closeMessage();
      const i = await R.Engine.run(new ShopList('buy', ids, idx));
      if (i < 0) return;
      idx = i;
      const id = ids[i], it = DB.items[id];
      if (R.Game.gold < it.price) { R.sfx('buzzer'); await say('おかねが たりない ようですね。'); continue; }
      if (isGear(it)) await buyGear(id, it);
      else await buyItems(id, it);
    }
  }

  async function buyItems(id, it) {
    const room = 99 - R.State.count(id);
    if (room <= 0) { await say('それいじょう もてない ようですね。'); return; }
    const max = Math.max(1, Math.min(room, Math.floor(R.Game.gold / Math.max(1, it.price))));
    await say(it.name + 'を いくつ おもとめですか？', { noWait: true });
    const n = max > 1 ? await R.UI.number({ min: 1, max, initial: 1, price: it.price, label: it.name.length > 6 ? 'かず' : it.name, w: 132 }) : 1;
    if (n < 1) return;
    const total = it.price * n;
    if (!R.State.takeGold(total)) { R.sfx('buzzer'); await say('おかねが たりない ようですね。'); return; }
    R.State.addItem(id, n);
    R.sfx('gold');
    await say(it.name + (n > 1 ? 'を ' + n + 'こ' : '') + ' まいど ありがとうございます！');
  }

  async function buyGear(id, it) {
    const slot = R.Rules.itemSlot(id);
    const who = R.Game.party.filter((c) => R.Rules.canEquip(c, id));
    if (!who.length && !(await R.UI.yesno('それを そうびできる ひとは いない ようですが……\nそれでも かいますか？'))) return;
    if (!R.State.takeGold(it.price)) { R.sfx('buzzer'); await say('おかねが たりない ようですね。'); return; }
    R.State.addItem(id, 1);
    R.sfx('gold');
    const cand = who.filter((c) => c.equip[slot] !== id);
    if (!cand.length) { await say('まいど ありがとうございます！'); return; }
    if (!(await R.UI.yesno('まいど ありがとうございます！\nいま そうび していきますか？'))) return;
    let c = cand[0];
    if (cand.length > 1) {
      R.UI.closeMessage();
      const k = await R.Menu.pickMember({
        title: 'だれが そうびする？', initial: R.Game.party.indexOf(cand[0]), x: 100, y: 34,
        valid: (m) => cand.includes(m),
      });
      if (k < 0) return;
      c = R.Game.party[k];
    }
    const old = c.equip[slot];
    const w = c.equip.weapon && DB.items[c.equip.weapon];
    const also = slot === 'weapon' && it.twoHanded && c.equip.shield ? c.equip.shield : slot === 'shield' && w && w.twoHanded ? c.equip.weapon : null;
    R.Rules.equip(c, slot, id);
    R.sfx('item');
    await say(c.name + 'は ' + it.name + 'を そうびした！', { keep: true });
    for (const oldId of [old, also].filter(Boolean)) {
      const o = DB.items[oldId];
      const p = sellPrice(o);
      if (!p) continue;
      if (await R.UI.yesno('いままでの ' + o.name + 'を\n' + p + 'ゴールドで かいとりましょうか？')) {
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
      if (!ids.length) { await say('うれる ものを なにも もっていない ようですね。'); return; }
      const i = await R.Engine.run(new ShopList('sell', ids, Math.min(idx, ids.length - 1)));
      if (i < 0) return;
      idx = i;
      const id = ids[i], it = DB.items[id];
      const p = sellPrice(it);
      if (!p) { R.sfx('buzzer'); await say('それを かいとる わけには いきません。'); continue; }
      const have = R.State.count(id);
      let n = 1;
      if (have > 1) {
        await say(it.name + 'を いくつ うりますか？', { noWait: true });
        n = await R.UI.number({ min: 1, max: have, initial: 1, price: p, label: it.name.length > 6 ? 'かず' : it.name, w: 132 });
        if (n < 1) continue;
      }
      if (!(await R.UI.yesno(it.name + (n > 1 ? 'を ' + n + 'こ' : 'を') + '\n' + p * n + 'ゴールドで かいとりましょう。\nよろしいですか？'))) continue;
      R.State.removeItem(id, n);
      R.State.addGold(p * n);
      R.sfx('gold');
      await say('まいど ありがとうございます！');
    }
  }

  let active = null; // GoldLayer of the open shop (a cleared engine never leaves it stuck)
  /** open shop R.DB.shops[shopId] (buy / sell) */
  Shop.open = async function (shopId) {
    const shop = DB.shops[shopId];
    if (!shop) { R.warn('Shop.open: unknown shop', shopId); return; }
    if (active && R.Engine.layers.includes(active)) return;
    const gold = (active = R.Engine.push(new GoldLayer()));
    try {
      let first = true;
      for (;;) {
        const greet = first ? 'いらっしゃい！' + (shop.name ? ' ここは ' + shop.name + 'です。' : '') + '\nなにを おもとめですか？' : 'ほかにも なにか ごようは ありますか？';
        first = false;
        const i = await ask(greet, ['かう', 'うる', 'やめる']);
        if (i === 0) await buy(shop);
        else if (i === 1) await sell();
        else break;
      }
      await say('また どうぞ！');
    } finally {
      R.UI.closeMessage();
      R.Engine.remove(gold);
      if (active === gold) active = null;
    }
  };

  // ------------------------------------------------------------ inn
  /** standard inn dialogue: heal, respawn here. → true if the party stayed */
  Shop.inn = async function (price) {
    price = Math.max(0, price | 0);
    const gold = R.Engine.push(new GoldLayer());
    try {
      if (!(await R.UI.yesno('たびびとの やどやへ ようこそ。\nひとばん ' + price + 'ゴールドですが\nおとまりに なりますか？'))) {
        await say('またの おこしを おまちしております。');
        return false;
      }
      if (!R.State.takeGold(price)) { R.sfx('buzzer'); await say('おや おかねが たりない ようですね。'); return false; }
      await say('では ごゆっくり おやすみください。');
      R.UI.closeMessage();
      R.Engine.remove(gold);
      await R.Engine.fadeOut(40);
      R.State.healAll();
      await R.jingle('inn');
      await R.Engine.wait(30);
      if (R.Field && R.Field.setRespawnHere) R.Field.setRespawnHere();
      await R.Engine.fadeIn(40);
      await say('おはようございます。\nゆうべは よく おやすみに なれましたか？\fでは いってらっしゃいませ。');
      return true;
    } finally {
      R.UI.closeMessage();
      R.Engine.remove(gold);
    }
  };

  // ------------------------------------------------------------ church
  /** church: save (おいのり) / revive / cure poison; sets the respawn point */
  Shop.church = async function () {
    if (R.Field && R.Field.setRespawnHere) R.Field.setRespawnHere();
    const gold = R.Engine.push(new GoldLayer());
    try {
      let text = 'ここは かみの いえ。\nきょうは どんな ごようかな？';
      for (;;) {
        const i = await ask(text, ['おいのりをする', 'いきかえらせる', 'どくの ちりょう', 'やめる']);
        text = 'ほかにも ごようは あるかな？';
        if (i === 0) {
          await say('では かみに これまでの ぼうけんを ほうこく するが よい。');
          R.UI.closeMessage();
          R.Engine.remove(gold);
          const saved = R.Menu && R.Menu.saveScreen ? await R.Menu.saveScreen({ church: true }) : false;
          R.Engine.push(gold);
          if (saved) await say('かみの ごかごが あらんことを。', { keep: true });
        } else if (i === 1 || i === 2) {
          await treat(i === 1);
        } else break;
      }
      await say('あなたに かみの ごかごが ありますように。');
    } finally {
      R.UI.closeMessage();
      R.Engine.remove(gold);
    }
  };

  async function treat(revive) {
    const need = R.Game.party.filter((c) => (revive ? c.hp <= 0 : c.hp > 0 && c.status && c.status.poison));
    if (!need.length) { await say(revive ? 'いきかえらせる ひとは いない ようじゃ。' : 'どくに おかされた ひとは いない ようじゃ。', { keep: true }); return; }
    const priceOf = (c) => (revive ? 10 * c.level : 10);
    let c = need[0];
    if (need.length > 1) {
      await say(revive ? 'だれを いきかえらせるのじゃ？' : 'だれの どくを なおすのじゃ？', { noWait: true });
      const k = await R.UI.choose(need.map((m) => ({ label: m.name, right: priceOf(m) + 'G' })), { w: 118 });
      if (k < 0) return;
      c = need[k];
    }
    const price = priceOf(c);
    if (!(await R.UI.yesno(c.name + 'を ' + (revive ? 'いきかえらせるには' : 'なおすには') + '\n' + price + 'ゴールド いただくが よいかな？'))) return;
    if (!R.State.takeGold(price)) { R.sfx('buzzer'); await say('おかねが たりない ようじゃな。', { keep: true }); return; }
    if (revive) {
      c.hp = R.Rules.stats(c).hp;
      c.status = {};
      R.sfx('revive');
      R.Engine.flashScreen('#ffffff', 10);
      await say('おお かみよ！\n' + c.name + 'に ふたたび いのちの ひかりを！\fなんと ' + c.name + 'が いきかえった！', { keep: true });
    } else {
      delete c.status.poison;
      R.sfx('heal');
      await say(c.name + 'の からだから どくが きえさった。', { keep: true });
    }
  }
})(window.RPG);
