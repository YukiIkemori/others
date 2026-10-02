// 宝箱とボスのプール（R.DB.pools。RULES）。今の木の src/data/pools.js を v2 の品の形（slot）に移した。
//   R.DB.pools[id] = { tiers: [ [ {item, w, n?} | {gold, w}, … ] × 10 段（ティア 0〜9） ] }
//   宝箱の中身は R.Rules.chestLoot(chest, tier, rng)（→ K.chestLoot）が引く。chest.pool:
//     'p_T'    ティア宝箱（開けたときのティア。道具・装備・お金を混ぜた表。V2_PLAN §3.7）
//     'p_rare' レアの箱（帯のレア品。各ダンジョン 1〜2 箱）
//     ほかに p_supply p_gold p_stone p_gear p_weapon p_armor p_acc p_boss p_boss_mid p_super p_heal
// - 装備のプールは品の line・tier・grade・src から R.onData で作る（品の数値を埋める順に依らない）。
// - プールには盗み専用（src 'steal'）・一品物（'unique'）・報酬・遺物・魔物の品（'mdrop'）を入れない。
// - §10.1（STATS_REWORK）: 魔物の枠を失った品の行き先。tools/port/trim_drops.js が残す品を選び、ほかは消した。
//   p_rare は帯のレア（'drop'）＋どの魔物も落とさなくなった魔物のレア（'mdrop'、約 30）、
//   p_super・p_boss はどの魔物も落とさない超レア（*_super.js の帯の品＋魔物の超レアから移した約 30）。
//   魔物がまだ落とす品は入れない（H2: 魔物から落ちる超レアは 1 体だけ）。
(function (R) {
  'use strict';
  const RB = [1, 1, 3, 3, 5, 5, 7, 7, 9, 9];                                   // ティア → レアの帯
  // 武器のレアの帯（持ち主 2026-10-02「レアの箱の品は同じ時点の店の品よりはっきり強く」。P29: 砂の王の墓の ★朝露の弓 < カシムの弓）。
  //   カシムの屋台・フェルンの行商・鷹団の店は T+1 の武器を並べるので、武器は T+1 以上の帯（奇数のティア T は次の帯）。防具・アクセサリは RB のまま
  const WB = [1, 3, 3, 5, 5, 7, 7, 9, 9, 9];
  const GOLD = [60, 130, 230, 360, 530, 720, 960, 1200, 1520, 2080];            // 1 つの宝箱のお金
  const S0 = [['i_salve', 6, 2], ['i_revive', 3], ['i_antidote', 2], ['i_clear', 1], ['i_waker', 2], ['i_repel', 1], ['i_firepot', 2], ['i_smoke', 1], ['i_torch', 1]];
  const S1 = [...S0, ['i_potion', 4], ['i_ether', 3], ['i_numb', 1], ['i_throat', 1], ['i_lure', 1], ['i_lens', 1]];
  const S2 = [...S1, ['i_incense', 2], ['i_thaw', 1], ['i_bomb', 2], ['i_horn', 1], ['i_censer', 1]];
  // 全回復の品（霊水・命のしずく・よみがえりの花・天の恵み）は終盤（ティア LATE 以上）から（オーナー 2026-09-28「全回復系は基本終盤から」）。
  //   地方はどの順番でも回れる（灰の荒野もティア 1 から）ので、地方ではなくティアで分ける。LATE = 5: 縦切りの後の 6 地方のうち最後の 1 つ
  const LATE = 5;
  // 回復の品は決まった量の段（items_use.js）: 中盤（ティア MID から）は 癒やしの清水 HP150・魔力の霊水 MP40
  const MID = 3;
  const S3 = [...S2, ['i_potion2', 3], ['i_ether2', 1], ['i_panacea', 1]];
  const S5 = [...S3, ['i_elixir', 2]];
  const S6 = [...S5, ['i_lifedew', 1]];
  const SUPPLY = [S0, S1, S2, S3, S3, S5, S6, S6, S6, S6];
  const STONES = ['fire', 'water', 'wind', 'earth', 'light', 'dark'].map((e) => `i_stone_${e}`);
  const E = (list) => list.map(([item, w, n]) => (n ? { item, w, n } : { item, w }));
  const EQ = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const ARMOR = ['shield', 'head', 'body', 'hands', 'feet'];
  const TIERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  // ティア宝箱 p_T の混ぜ方（重みの合計）: 道具 55・装備 25・お金 20
  const MIX = { supply: 55, gear: 25, gold: 20 };

  R.Pools = { RB: RB.slice(), WB: WB.slice(), GOLD: GOLD.slice(), MIX: Object.assign({}, MIX), LATE, MID };

  R.onData(function buildPools() {
    const all = Object.entries(R.DB.items);
    const ids = (pred) => all.filter(([, it]) => it && pred(it)).map(([id]) => id);
    const normal = (T, slots) => ids((it) => it.src === 'shop' && it.tier === T && it.line && !String(it.line).startsWith('charm_') && slots.includes(it.slot));
    // 魔物がドロップで落とす品（steal を除く）
    const dropped = new Set();
    for (const m of Object.values(R.DB.monsters || {})) {
      const d = (m && m.drops) || {};
      for (const k of ['normal', 'rare', 'super']) if (d[k] && d[k].item) dropped.add(d[k].item);
    }
    const free = (id) => !dropped.has(id);
    const band = (it, T) => (it.slot === 'weapon' ? WB[T] : RB[T]);
    const rare = (T) => ids((it) => it.src === 'drop' && it.grade === 'rare' && EQ.includes(it.slot) && it.tier === band(it, T));
    const mrare = (T) => ids((it) => it.src === 'mdrop' && it.grade === 'rare' && EQ.includes(it.slot) && (it.slot === 'weapon' ? it.tier === WB[T] : it.tier === T || it.tier === RB[T])).filter(free);
    // 超レアの武器も T+1 の段（無ければ T。ティア 9 の上は無い）
    const sup = (T) => ids((it) => (it.src === 'mdrop' || it.src === 'super') && it.grade === 'super' && EQ.includes(it.slot) && it.tier === (it.slot === 'weapon' ? Math.min(9, T + 1) : T)).filter(free);
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
      p_rare: P((T) => [...W1(rare(T), 2), ...W1(mrare(T), 1), ...(T >= LATE ? E([['i_lifedew', 2], ['i_phoenix', 2], ['i_grace', 1]]) : [])]),
      // 大きな回復の 1 品（地方ボスの確定の 2 つ目・中盤のダンジョンの決まった宝箱）: 序盤は癒やしの水 2 つ、中盤（MID）から癒やしの清水 2 つ、終盤から癒やしの霊水
      p_heal: P((T) => (T >= LATE ? [{ item: 'i_elixir', w: 1 }] : T >= MID ? [{ item: 'i_potion2', w: 1, n: 2 }] : [{ item: 'i_potion', w: 1, n: 2 }])),
      p_boss: P((T) => [...W1(rare(T), 3), ...W1(sup(T), 1)]),
      p_boss_mid: P((T) => W1(normal(T, EQ))),
      // 空のティアは近いティア（下を先に）の品で埋める（深い階の 1 箱が空にならないように）
      p_super: P((T) => { for (let d = 0; d < 10; d++) for (const t of [T - d, T + d]) { if (t < 0 || t > 9) continue; const l = sup(t); if (l.length) return W1(l); } return []; }),
    };
    pools.p_T = P((T) => [...scale(pools.p_supply.tiers[T], MIX.supply), ...scale(pools.p_gear.tiers[T], MIX.gear), ...scale(pools.p_gold.tiers[T], MIX.gold)]);
    for (const id of Object.keys(pools)) R.def('pools', id, pools[id]);
  });
})(window.RPG);
