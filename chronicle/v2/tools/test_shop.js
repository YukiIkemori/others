// 店（src/screens/shop.js・shop_junk.js）の node のテスト（持ち主 2026-09-28 の店の手直し）
//   node v2/tools/test_shop.js
//   仲間の帯の増減（S.statDiff と同じ数・装備できない・装備中）・まとめ買い（所持金と 99 で止まる・装備は続けて「今すぐ装備する？」）・
//   まとめ売り・「使わない物をまとめて売る」の決まり（売るための品・全員の装備より弱い物だけ。大事な物・めずらしい物・薬・付けている物は売らない）。
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true, dev: true, fixtures: true });
const S = R.Screens;

// 画面を node で作る（描かない。R.UIK の音と知らせは黙らせる）
R.UIK.sfx = () => {};
R.UIK.toast = () => {};
function mk(p) {
  const v = Object.assign(Object.create(null), S._defs.shop);
  v.p = p; v.closed = []; v.close = (r) => v.closed.push(r);
  v.init(p);
  return v;
}

(async () => {
  section('仲間の帯: 一行の全員の増減（▲▼）・装備できない・装備中');
  {
    R.Dev.applyState('menus_party');
    const v = mk({ id: 'shop_pharos_arms' });
    const mem = S.party();
    const cmp = v.compare('w_sword_2', 2);
    ok('compare lists every party member in order', cmp.length === mem.length && cmp.every((c, i) => c.id === mem[i].id));
    const hero = mem.find((c) => c.id === 'hero');
    const h = cmp.find((c) => c.id === 'hero');
    const atk = h.show.find((r) => r.k === 'atk');
    const sd = S.statDiff(hero, R.Rules.defaultSlot(hero, 'w_sword_2'), 'w_sword_2').find((r) => r.k === 'atk');
    ok('hero: 黒鋼の剣 shows the same atk delta as S.statDiff, and it goes up', h.state === 'diff' && atk && sd && atk.d === sd.d && atk.d > 0, { atk, sd });
    const wearing = v.compare('w_sword_iron', 2).find((c) => c.id === 'hero');
    ok('hero already wears 鉄の剣 → 装備中', wearing.state === 'wearing' && !wearing.show.length);
    const bowCmp = v.compare('w_staff_1', 2);
    const cant = mem.filter((c) => !R.Rules.canEquip(c, 'w_staff_1', R.Rules.defaultSlot(c, 'w_staff_1')));
    ok('members who cannot wear it → 装備できない (state cant)', bowCmp.filter((c) => c.state === 'cant').length === cant.length);
    const worse = v.compare('hd_helm_0', 2).concat(v.compare('bd_hemp_robe', 2)).filter((c) => c.state === 'diff');
    ok('downgrades show negative numbers (▼)', worse.some((c) => c.show.some((r) => r.d < 0)), worse.map((c) => c.show));
    ok('no member ever gets more than 2 lines', mem.length && ['w_sword_2', 'bd_mail_1', 'sh_buckler_1', 'ft_boots_1'].every((id) => v.compare(id, 2).every((c) => c.show.length <= 2)));
  }

  // オーナー 2026-10-01「『仲間がつけると』で守備と術防が入れ替わる。上と下の表示は固定で」: 行は品ごとに決まり、誰の列でも同じ順（変わらない値は ±0）
  section('仲間の帯: 行の順が決まっている（守備・術防、攻撃・術力が入れ替わらない）');
  {
    R.Dev.applyState('menus_party');
    const v = mk({ id: 'shop_pharos_arms' });
    const armor = Object.keys(R.DB.items).filter((id) => { const it = R.DB.items[id]; return it.slot && it.slot !== 'weapon' && it.slot !== 'acc' && it.slot !== 'use' && it.slot !== 'key' && (it.def || it.mdef); });
    const weapons = Object.keys(R.DB.items).filter((id) => R.DB.items[id].slot === 'weapon');
    const accs = Object.keys(R.DB.items).filter((id) => R.DB.items[id].slot === 'acc');
    const keysOf = (c) => c.show.map((r) => r.k).join(',');
    const bad = [];
    for (const [ids, head] of [[armor, ['def', 'mdef']], [weapons, ['atk', 'mag']], [accs, []]]) {
      for (const id of ids) for (const lines of [2, 4]) {
        const diff = v.compare(id, lines).filter((c) => c.state === 'diff');
        if (!diff.length) continue;
        const k0 = keysOf(diff[0]);
        // 主な値が頭に決まった順で・どの人も同じ行・lines を超えない
        if (head.length && !diff.every((c) => head.every((k, i) => c.show[i] && c.show[i].k === k))) bad.push([id, lines, 'head', diff.map(keysOf)]);
        else if (!diff.every((c) => keysOf(c) === k0 && c.show.length <= lines)) bad.push([id, lines, 'same', diff.map(keysOf)]);
      }
    }
    ok(`防具 ${armor.length}・武器 ${weapons.length}・アクセ ${accs.length}: 行の順はいつも同じ（防具は守備 → 術防、武器は攻撃 → 術力が頭。人で変わらない）`, !bad.length, bad.slice(0, 4));
    // 守備が下がって術防が上がる品（綿の頭巾など）でも、守備が上で術防が下
    const swap = armor.find((id) => v.compare(id, 2).some((c) => c.state === 'diff' && Math.abs(c.show[1].d) > Math.abs(c.show[0].d)));
    ok('術防の変わりの方が大きい防具でも 守備 → 術防 の順', !!swap && v.compare(swap, 2).filter((c) => c.state === 'diff').every((c) => c.show[0].k === 'def' && c.show[1].k === 'mdef'), swap);
    const zero = S.cmpRows([{ k: 'def', name: '守備', d: 3 }], ['def', 'mdef']);
    ok('変わらない値も ±0 の行で残す（行を落とさない）', zero.length === 2 && zero[1].k === 'mdef' && zero[1].d === 0 && !!zero[1].name, zero);
  }

  section('まとめ買い（道具・装備とも数を選ぶ札）');
  {
    R.Dev.applyState('menus_party');
    const G = R.Game;
    const v = mk({ id: 'shop_pharos_items' });
    G.gold = 1000; G.items.i_salve = 6;
    v.pick({ value: 'i_salve' });
    ok('A on a consumable → picker n=1', v.qtyPick && v.qtyPick.mode === 'buy' && v.qtyPick.n === 1);
    ok('max = min(gold / price, 99 − have); cap is the one that binds', v.qtyPick.max === Math.min(Math.floor(1000 / v.price('i_salve')), 99 - 6) && v.qtyPick.cap === (Math.floor(1000 / v.price('i_salve')) < 93 ? 'gold' : 'stack'), v.qtyPick);
    G.gold = 1e6;
    v.openQty('i_salve', 'buy');
    ok('rich: the stack limit binds (99 − 6 = 93)', v.qtyPick.max === 93 && v.qtyPick.cap === 'stack');
    const g0 = G.gold;
    await v.doBuy('i_salve', 12);
    ok('buy ×12 → +12 items, −12 × price', G.items.i_salve === 18 && G.gold === g0 - 12 * v.price('i_salve'));
    await v.doBuy('i_salve', 90);
    ok('buying past 99 is refused, nothing changes', G.items.i_salve === 18 && G.gold === g0 - 12 * v.price('i_salve'));
    G.gold = v.price('i_salve') * 3 + 1;
    ok('poor: gold binds (3)', v.maxBuy('i_salve') === 3 && v.buyCap('i_salve') === 'gold');

    // 装備: 数を選んで買い、買った数だけ「今すぐ装備する？」
    R.Dev.applyState('menus_party');
    const va = mk({ id: 'shop_pharos_arms' });
    const G2 = R.Game; G2.gold = 1e5;
    va.pick({ value: 'hn_glove_0' });
    ok('A on equipment → picker too (まとめ買い)', va.qtyPick && va.qtyPick.id === 'hn_glove_0');
    va.qtyPick = null;
    const ask0 = S.ask, seen = [];
    S.ask = async (view, o) => { seen.push({ title: o.title, index: o.index }); return o.index; };
    try {
      const mem = S.party();
      const wearers = mem.filter((c) => R.Rules.canEquip(c, 'hn_glove_0', R.Rules.defaultSlot(c, 'hn_glove_0')));
      await va.doBuy('hn_glove_0', 2);
      ok('buy ×2 gear → asks twice (あと 2 個 → 今すぐ)', seen.length === 2 && /あと 2 個/.test(seen[0].title) && seen[1].title === '今すぐ装備する？', seen);
      const first = mem.findIndex((c) => R.Rules.canEquip(c, 'hn_glove_0', R.Rules.defaultSlot(c, 'hn_glove_0')));
      ok('1st ask: cursor on the first member who can wear it', seen[0].index === first, seen);
      ok('2nd ask: cursor moves on to the next member not wearing it yet', wearers.length < 2 || seen[1].index !== seen[0].index, seen);
      ok('two members now wear the gloves, bag back to 0', mem.filter((c) => c.equip.hands === 'hn_glove_0').length === Math.min(2, wearers.length) && (G2.items.hn_glove_0 || 0) === 2 - Math.min(2, wearers.length));
      seen.length = 0;
      S.ask = async (view, o) => { seen.push(o.title); return S.party().length; };   // 装備しない
      await va.doBuy('hd_wool_hood', 3);
      ok('「装備しない」 stops asking at once', seen.length === 1 && R.Game.items.hd_wool_hood === 3);
    } finally { S.ask = ask0; }
  }

  section('まとめ売り');
  {
    R.Dev.applyState('menus_party');
    const G = R.Game;
    const v = mk({ id: 'shop_pharos_items', tab: 'sell' });
    G.items.i_salve = 7;
    ok('opens on 売る with tab: sell', v.selling());
    v.pick({ value: 'i_salve' });
    ok('A on a stack → sell picker, max = have', v.qtyPick && v.qtyPick.mode === 'sell' && v.qtyPick.max === 7 && v.qtyPick.cap === 'have');
    v.qtyPick = null;
    const g0 = G.gold;
    await v.doSell('i_salve', 5);
    ok('sell ×5 → 2 left, gold + 5 × sell price', G.items.i_salve === 2 && G.gold === g0 + 5 * R.Rules.sellPrice('i_salve'));
  }

  section('使わない物をまとめて売る（S.shopJunk の決まり）');
  {
    R.Dev.applyState('menus_party');
    const G = R.Game, mem = S.party(), roster = mem.concat(R.Party.reserve());
    // 一行と控えの剣の使い手に 黒鋼の剣 を付け、袋に 鉄の剣 を置く → 鉄の剣 は全員より弱い
    G.items = {};
    for (const c of roster) {
      if (R.Rules.canEquip(c, 'w_sword_2', 'weapon1')) { c.equip.weapon1 = 'w_sword_2'; if (!c.equip.shield) c.equip.shield = 'sh_iron_buckler'; }
    }
    const swordUsers = roster.filter((c) => R.Rules.canEquip(c, 'w_sword_iron', 'weapon1'));
    ok('setup: every sword-capable member (party + reserve) wields 黒鋼の剣', swordUsers.length > 0 && swordUsers.every((c) => c.equip.weapon1 === 'w_sword_2'));
    Object.assign(G.items, {
      w_sword_iron: 3,         // 全員の装備より弱い・この店で買い直せる → 全部
      i_golden_acorn: 1,       // 売るための品 → 全部
      i_gold_coins: 2,
      i_salve: 9,              // 薬 → 売らない
      w_sword_coral: 1,        // めずらしい装備 → 売らない
      hd_helm_1: 1,            // 今の兜より強い → 売らない
      w_staff_1: 1,            // 効き目（mods）がある → 売らない
      w_sword_2: 1,            // 付けている物と同じ（弱くない）→ 売らない
    });
    const key = Object.keys(R.DB.items).find((id) => R.DB.items[id].slot === 'key');
    if (key) G.items[key] = 1;
    const armsStock = ['w_sword_iron'];   // 鉄の剣を買い直せる店（ファロスの武具屋は品が上がると並ばなくなる）
    const junk = S.shopJunk(armsStock), by = Object.fromEntries(junk.map((r) => [r.id, r]));
    ok('sell-only treasure (黄金のどんぐり・古い金貨の袋) → all copies', by.i_golden_acorn && by.i_golden_acorn.n === 1 && by.i_gold_coins && by.i_gold_coins.n === 2 && by.i_gold_coins.why === '売るための品');
    ok('鉄の剣 (worse for every sword user, rebuyable here) → all 3', by.w_sword_iron && by.w_sword_iron.n === 3, junk);
    ok('never: consumables, rare gear, stronger gear, gear with mods, same-as-worn gear, key items', ['i_salve', 'w_sword_coral', 'hd_helm_1', 'w_staff_1', 'w_sword_2', key].every((id) => !by[id]), junk.map((r) => r.id));
    ok('totals = sell price × n', junk.every((r) => r.total === R.Rules.sellPrice(r.id) * r.n && r.unit === R.Rules.sellPrice(r.id)));
    ok('never more than you have', junk.every((r) => r.n <= G.items[r.id]));
    const junk2 = S.shopJunk([]);
    const iron2 = junk2.find((r) => r.id === 'w_sword_iron');
    ok('not rebuyable in this shop → keep the last one (3 → sell 2)', iron2 && iron2.n === 2 && /1 つ残す/.test(iron2.why), iron2);
    G.items.w_sword_iron = 1;
    ok('not rebuyable and only 1 → not listed', !S.shopJunk([]).some((r) => r.id === 'w_sword_iron'));
    G.items.w_sword_iron = 3;
    // 誰か 1 人でも空き枠・別の型なら売らない
    const hero = G.chars.hero, w0 = hero.equip.weapon1;
    hero.equip.weapon1 = 'w_greatsword_iron';
    ok('one sword-capable member uses another weapon type → 鉄の剣 not junk', !S.isWorseForAll('w_sword_iron') || !R.Rules.canEquip(hero, 'w_sword_iron', 'weapon1'));
    hero.equip.weapon1 = w0;
    const hd0 = hero.equip.head;
    hero.equip.head = null; G.items.hd_helm_0 = 1;
    ok('someone has an empty slot → not junk', !S.isWorseForAll('hd_helm_0'));
    hero.equip.head = hd0;
    // 画面: START → 札 → 1 つ外して売る
    const v = mk({ id: 'shop_pharos_arms', tab: 'sell' });
    ok('arms shop opens on 売る', v.selling());
    ok('openJunk → panel with candidates + まとめて売る + やめる', v.openJunk() && v.junk.rows.length === junk.length && v.junk.list.rows.length === junk.length + 2);
    const skip = v.junk.rows.find((r) => r.id === 'i_gold_coins');
    v.junk.list.onSelect(v.junk.list.rows.find((r) => r.value === 'i_gold_coins'));
    ok('A on a row → unchecked, total drops', skip && !skip.on && v.junkTotal() === v.junk.rows.reduce((s, r) => s + r.total, 0) - skip.total);
    const g0 = G.gold, expect = v.junkTotal();
    v.junk.list.onSelect(v.junk.list.rows.find((r) => r.value === '__ok'));
    ok('まとめて売る → gold + total, checked items gone, unchecked kept', G.gold === g0 + expect && !G.items.i_golden_acorn && G.items.i_gold_coins === 2 && !v.junk);
    ok('untouched: salve, coral, key item', G.items.i_salve === 9 && G.items.w_sword_coral === 1 && (!key || G.items[key] === 1));
    ok('nothing left to sell → openJunk says so (false)', (() => { G.items = { i_salve: 3 }; return v.openJunk() === false && !v.junk; })());
    // すべての品で: 決まりが売ってよいと言うのは、ふつうの店の装備か売るための品だけ
    const bad = Object.keys(R.DB.items).filter((id) => { const it = R.DB.items[id]; return (S.isWorseForAll(id) && (it.grade !== 'normal' || it.unique || it.slot === 'key' || it.slot === 'acc')) || (S.isSellOnly(it) && (it.use || it.slot !== 'use')); });
    ok('rule never admits rare/unique/key/accessory gear over the whole item DB', bad.length === 0, bad.slice(0, 5));
  }
  done('test_shop');
})().catch((e) => { console.error(e); process.exit(1); });
