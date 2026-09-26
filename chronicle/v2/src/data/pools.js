// 宝箱とボスのプール（R.DB.pools。RULES）。今の木の src/data/pools.js を v2 の品の形（slot）に移した。
//   R.DB.pools[id] = { tiers: [ [ {item, w, n?} | {gold, w}, … ] × 10 段（ティア 0〜9） ] }
//   宝箱の中身は R.Rules.chestLoot(chest, tier, rng)（→ K.chestLoot）が引く。chest.pool:
//     'p_T'    ティア宝箱（開けたときのティア。道具・装備・お金を混ぜた表。V2_PLAN §3.7）
//     'p_rare' レアの箱（帯のレア品。各ダンジョン 1〜2 箱）
//     ほかに p_supply p_gold p_stone p_gear p_weapon p_armor p_acc p_boss p_boss_mid p_super
// - 装備のプールは品の line・tier・grade・src から R.onData で作る（品の数値を埋める順に依らない）。
// - プールには盗み専用（src 'steal'）・一品物（'unique'）・報酬・遺物・魔物の品（'mdrop'）を入れない。
//   p_super（ダンジョンの奥の箱・ボス。STATS_REWORK §10.1）は魔物の超レアの枠から外れる品の行き先で、
//   どの品を移すかは BATTLE の魔物の drops（§10.1）が決まってから絞る。今は同じティアの魔物の超レア（'mdrop'／'super'）を入れておく。
(function (R) {
  'use strict';
  const RB = [1, 1, 3, 3, 5, 5, 7, 7, 9, 9];                                   // ティア → レアの帯
  const GOLD = [60, 130, 230, 360, 530, 720, 960, 1200, 1520, 2080];            // 1 つの宝箱のお金
  const S0 = [['i_salve', 6, 2], ['i_revive', 3], ['i_antidote', 2], ['i_clear', 1], ['i_waker', 2], ['i_repel', 1], ['i_firepot', 2], ['i_smoke', 1], ['i_torch', 1]];
  const S1 = [...S0, ['i_potion', 4], ['i_ether', 3], ['i_numb', 1], ['i_throat', 1], ['i_lure', 1], ['i_lens', 1]];
  const S2 = [...S1, ['i_incense', 2], ['i_thaw', 1], ['i_bomb', 2], ['i_horn', 1], ['i_censer', 1]];
  const S3 = [...S2, ['i_elixir', 2], ['i_ether2', 1], ['i_panacea', 1]];
  const S6 = [...S3, ['i_lifedew', 1]];
  const SUPPLY = [S0, S1, S2, S3, S3, S3, S6, S6, S6, S6];
  const STONES = ['fire', 'water', 'wind', 'earth', 'light', 'dark'].map((e) => `i_stone_${e}`);
  const E = (list) => list.map(([item, w, n]) => (n ? { item, w, n } : { item, w }));
  const EQ = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const ARMOR = ['shield', 'head', 'body', 'hands', 'feet'];
  const TIERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  // ティア宝箱 p_T の混ぜ方（重みの合計）: 道具 55・装備 25・お金 20
  const MIX = { supply: 55, gear: 25, gold: 20 };

  R.Pools = { RB: RB.slice(), GOLD: GOLD.slice(), MIX: Object.assign({}, MIX) };

  R.onData(function buildPools() {
    const all = Object.entries(R.DB.items);
    const ids = (pred) => all.filter(([, it]) => it && pred(it)).map(([id]) => id);
    const normal = (T, slots) => ids((it) => it.src === 'shop' && it.tier === T && it.line && !String(it.line).startsWith('charm_') && slots.includes(it.slot));
    const rare = (T) => ids((it) => it.src === 'drop' && it.grade === 'rare' && EQ.includes(it.slot) && it.tier === RB[T]);
    const sup = (T) => ids((it) => (it.src === 'mdrop' || it.src === 'super') && it.grade === 'super' && EQ.includes(it.slot) && it.tier === T);
    const P = (fn) => ({ tiers: TIERS.map(fn) });
    const W1 = (list, w) => list.map((item) => ({ item, w: w || 1 }));
    // 表の中の重みを合計 total にならす（p_T の混ぜ方）
    const scale = (list, total) => { const s = list.reduce((a, x) => a + x.w, 0) || 1; return list.map((x) => Object.assign({}, x, { w: x.w * total / s })); };
    const pools = {
      p_supply: P((T) => E(SUPPLY[T])),
      p_gold: P((T) => [{ gold: GOLD[T], w: 1 }]),
      p_stone: P(() => STONES.map((item) => ({ item, w: 1, n: 2 }))),
      p_gear: P((T) => W1(normal(T, EQ))),
      p_weapon: P((T) => W1(normal(T, ['weapon']))),
      p_armor: P((T) => W1(normal(T, ARMOR))),
      p_acc: P((T) => W1(normal(T, ['acc']))),
      p_rare: P((T) => [...W1(rare(T), 2), ...(T >= 4 ? E([['i_lifedew', 2], ['i_phoenix', 2], ['i_grace', 1]]) : [])]),
      p_boss: P((T) => W1(rare(T))),
      p_boss_mid: P((T) => W1(normal(T, EQ))),
      p_super: P((T) => W1(sup(T))),
    };
    pools.p_T = P((T) => [...scale(pools.p_supply.tiers[T], MIX.supply), ...scale(pools.p_gear.tiers[T], MIX.gear), ...scale(pools.p_gold.tiers[T], MIX.gold)]);
    for (const id of Object.keys(pools)) R.def('pools', id, pools[id]);
  });
})(window.RPG);
