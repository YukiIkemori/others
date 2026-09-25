// items_acc_rare.js — gear-a (A10a). Band-rare accessories (19).
// Numbers (def mdef eva stats price) are filled by R.Rules.fillItem in R.onData (DESIGN §8.2.9); the data
// only carries tier / grade / units / weight. Spec: DESIGN §8 (definitions) and §9.12 (monster → item).
(function (R) {
  'use strict';
  // Band-rare accessories (DESIGN §8.5): 'p_rare' chests and 'p_boss' only. Stats ×2 + one special effect.
  // Status wards of the band: 暗闇 ac_r3_blind, 毒 ac_r5_poison, まひ ac_r5_para, 凍結 ac_r5_freeze, やけど ac_r5_burn,
  // 眠り ac_r7_sleep, 混乱 ac_r7_confuse, 即死 ac_r9_death (§8.13.3).
  const ITEMS = {
    // ---------------------------------------------------------------- band T1
    ac_r1_int: { name: '朝露の耳飾り', type: 'acc', grade: 'rare', tier: 1, units: 'i1', src: 'drop',
      mods: { mpRegen: 1 },
      desc: '戦闘中、MPが少しずつ戻る。' },
    ac_r1_item: { name: '蜂蜜の小瓶', type: 'acc', grade: 'rare', tier: 1, units: 'm1', src: 'drop',
      mods: { itemPct: 50 },
      desc: '回復の道具がよく効く。' },
    // ---------------------------------------------------------------- band T3
    ac_r3_drop: { name: '目利きの首飾り', type: 'acc', grade: 'rare', tier: 3, units: 'd1', src: 'drop',
      mods: { dropPct: 20 },
      desc: '魔物が品を落としやすい。' },
    ac_r3_blind: { name: '夜目の片眼鏡', type: 'acc', grade: 'rare', tier: 3, units: 'd1', src: 'drop',
      mods: { statusImmune: ['blind'] },
      desc: '暗闇が効かない。' },
    // ---------------------------------------------------------------- band T5
    ac_r5_gold: { name: '旅芸人の鈴', type: 'acc', grade: 'rare', tier: 5, units: 'a1', src: 'drop',
      mods: { goldPct: 20 },
      desc: '手に入るお金が増える。' },
    ac_r5_int: { name: '月長石のブローチ', type: 'acc', grade: 'rare', tier: 5, units: 'i1', src: 'drop',
      mods: { mag: 5 },
      desc: '術力が上がる。' },
    ac_r5_poison: { name: '蛇よけの腕輪', type: 'acc', grade: 'rare', tier: 5, units: 'v1', src: 'drop',
      mods: { statusImmune: ['poison'] },
      desc: '毒が効かない。' },
    ac_r5_para: { name: 'しびれ知らずの環', type: 'acc', grade: 'rare', tier: 5, units: 's1', src: 'drop',
      mods: { statusImmune: ['paralyze'] },
      desc: 'まひが効かない。' },
    ac_r5_freeze: { name: '凍え知らずの環', type: 'acc', grade: 'rare', tier: 5, units: 'm1', src: 'drop',
      mods: { statusImmune: ['freeze'] },
      desc: '凍結が効かない。' },
    ac_r5_burn: { name: 'やけど知らずの環', type: 'acc', grade: 'rare', tier: 5, units: 'v1', src: 'drop',
      mods: { statusImmune: ['burn'] },
      desc: 'やけどが効かない。' },
    // ---------------------------------------------------------------- band T7
    ac_r7_str: { name: '闘将の腕輪', type: 'acc', grade: 'rare', tier: 7, units: 's1', src: 'drop',
      mods: { hpPct: 10 },
      desc: '最大HPが上がる。' },
    ac_r7_dex: { name: '鷹の目の指輪', type: 'acc', grade: 'rare', tier: 7, units: 'd1', src: 'drop',
      mods: { glimPct: { tech: 15 } },
      desc: '技を閃きやすい。' },
    ac_r7_int: { name: '知恵の紅玉', type: 'acc', grade: 'rare', tier: 7, units: 'i1', src: 'drop',
      mods: { mag: 7 },
      desc: '術力が上がる。' },
    ac_r7_sleep: { name: '覚醒の耳飾り', type: 'acc', grade: 'rare', tier: 7, units: 'm1', src: 'drop',
      mods: { statusImmune: ['sleep'] },
      desc: '眠りが効かない。' },
    ac_r7_confuse: { name: '正気の守り石', type: 'acc', grade: 'rare', tier: 7, units: 'm1', src: 'drop',
      mods: { statusImmune: ['confuse'] },
      desc: '混乱が効かない。' },
    // ---------------------------------------------------------------- band T9
    ac_r9_str: { name: '英雄の腕輪', type: 'acc', grade: 'rare', tier: 9, units: 's1', src: 'drop',
      mods: { physPct: 10 },
      desc: '物理攻撃の威力が上がる。' },
    ac_r9_dex: { name: '星見の指輪', type: 'acc', grade: 'rare', tier: 9, units: 'd1', src: 'drop',
      mods: { glimPct: { tech: 15 } },
      desc: '技を閃きやすい。' },
    ac_r9_int: { name: '知恵の虹輪', type: 'acc', grade: 'rare', tier: 9, units: 'i1', src: 'drop',
      mods: { mag: 9 },
      desc: '術力が上がる。' },
    ac_r9_death: { name: '命綱の首飾り', type: 'acc', grade: 'rare', tier: 9, units: 'v1', src: 'drop',
      mods: { statusImmune: ['death'] },
      desc: '即死が効かない。' },
  };

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_acc_rare: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => {
    if (!R.GearA || !R.GearA.finish) { R.loadErrors.push('items_acc_rare: items_armor.js (R.GearA) did not load'); return; }
    R.GearA.finish(Object.keys(ITEMS), 'rare');
  });
})(window.RPG);
