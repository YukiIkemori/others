// ティア宝箱のプール 10（R.DB.pools）。担当 gear-b（A10b）。正本は DESIGN.md §8.12.5（一覧 §8.12.2、ボス §8.12.3）。
//
// プールの形（§3.3.5）: DB.pools[id] = { tiers: [ [ {item, w, n?} | {gold, w}, … ], …10 段（ティア 0〜9） ] }
//   宝箱: R.Tier.chest(def, map) … T = def.tier ?? map.chestTier ?? R.Game.tier で段を引き、重み w で 1 つ（n 既定 1）。
//   ボス: drops.normal = {pool:'p_boss'|'p_boss_mid', rate:1} … R.Mon.rollDrops が戦闘のティア Tb で段を引く。
// - 装備のプール（p_gear p_weapon p_armor p_acc p_rare p_boss p_boss_mid）は、品の id・line・tier・grade・src から
//   R.onData で作る（数値を埋める順番に依らない。§8.2.9）。pools.js は items_*.js より後に読まれるので、
//   ほかの担当の onData（品を作るもの）はこの前に済んでいる。
// - プールには超レア・遺物・報酬・魔物のレア品（src:'mdrop'）・レア魔物の道具を入れない（§8.14.2-5）。
// - 固定の中身の宝箱（item を直に書いた宝箱）は作らない。chest_rare の絵は pool:'p_rare' の宝箱だけ（§8.12.1）。
(function (R) {
  'use strict';
  const RB = [1, 1, 3, 3, 5, 5, 7, 7, 9, 9];                                   // ティア → レアの帯
  const GOLD = [60, 130, 230, 360, 530, 720, 960, 1200, 1520, 2080];            // 1 つの宝箱のお金
  // p_supply（品・重み・個数。段が上がると前の段に足す）
  const S0 = [['i_salve', 6, 2], ['i_revive', 3], ['i_antidote', 2], ['i_clear', 1], ['i_waker', 2], ['i_repel', 1], ['i_firepot', 2], ['i_smoke', 1]];
  const S1 = [...S0, ['i_potion', 4], ['i_ether', 3], ['i_numb', 1], ['i_throat', 1], ['i_lure', 1], ['i_lens', 1]];
  const S2 = [...S1, ['i_incense', 2], ['i_thaw', 1], ['i_bomb', 2], ['i_horn', 1], ['i_censer', 1]];
  const S3 = [...S2, ['i_elixir', 2], ['i_ether2', 1], ['i_panacea', 1]];
  const S6 = [...S3, ['i_lifedew', 1]];
  const SUPPLY = [S0, S1, S2, S3, S3, S3, S6, S6, S6, S6];
  const STONES = ['fire', 'water', 'wind', 'earth', 'light', 'dark'].map((e) => `i_stone_${e}`);
  const E = (list) => list.map(([item, w, n]) => (n ? { item, w, n } : { item, w }));
  const EQ = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const ARMOR_T = ['shield', 'head', 'body', 'hands', 'feet'];
  const TIERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // 公開: 帯と宝箱のお金（ほかの担当・ツールの表示と検算用）
  R.Pools = { RB: RB.slice(), GOLD: GOLD.slice() };

  R.onData(() => {
    const all = Object.entries(R.DB.items);
    const ids = (pred) => all.filter(([, it]) => it && pred(it)).map(([id]) => id);
    // その T の通常の装備（系列の品。補助のアクセサリ charm_* は入れない）
    const normal = (T, types) => ids((it) => it.src === 'shop' && it.tier === T && it.line && !String(it.line).startsWith('charm_') && types.includes(it.type));
    // 帯のレア品だけ（魔物のレア品 src:'mdrop' と、道具の src:'drop' は入れない）
    const rare = (T) => ids((it) => it.src === 'drop' && it.grade === 'rare' && EQ.includes(it.type) && it.tier === RB[T]);
    const P = (fn) => ({ tiers: TIERS.map(fn) });
    const W1 = (list, w = 1) => list.map((item) => ({ item, w }));
    Object.assign(R.DB.pools, {
      p_supply: P((T) => E(SUPPLY[T])),
      p_gold: P((T) => [{ gold: GOLD[T], w: 1 }]),
      p_stone: P(() => STONES.map((item) => ({ item, w: 1, n: 2 }))),
      p_gear: P((T) => W1(normal(T, EQ))),
      p_weapon: P((T) => W1(normal(T, ['weapon']))),
      p_armor: P((T) => W1(normal(T, ARMOR_T))),
      p_acc: P((T) => W1(normal(T, ['acc']))),
      p_rare: P((T) => [...W1(rare(T), 2), ...(T >= 4 ? E([['i_lifedew', 2], ['i_phoenix', 2], ['i_grace', 1], ['i_seed_hp', 2], ['i_seed_mp', 2]]) : [])]),
      p_boss: P((T) => W1(rare(T))),
      p_boss_mid: P((T) => W1(normal(T, EQ))),
    });
  });
})(window.RPG);
