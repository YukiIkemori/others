// items_acc_rare.js — アクセサリのレア 19（RULES。K.item。数値は R.Rules.fillItem が R.onData で埋める）
// 生成: node v2/tools/port/*.js（今の木から移した結果。以後はこのファイルが正）
(function (R) {
  'use strict';
  R.defs('items', {
  ac_r1_int: { name: R.T('items.ac_r1_int.name'), grade: 'rare', tier: 1, units: 'i1', src: 'drop', mods: { mpRegen: 1 }, desc: R.T('items.ac_r1_int.desc'), slot: 'acc', icon: 'ring' },
  ac_r1_item: { name: R.T('items.ac_r1_item.name'), grade: 'rare', tier: 1, units: 'm1', src: 'drop', mods: { itemPct: 50 }, desc: R.T('items.ac_r1_item.desc'), slot: 'acc', icon: 'ring' },
  ac_r3_drop: { name: R.T('items.ac_r3_drop.name'), grade: 'rare', tier: 3, units: 'd1', src: 'drop', mods: { dropPct: 20 }, desc: R.T('items.ac_r3_drop.desc'), slot: 'acc', icon: 'ring' },
  ac_r3_blind: { name: R.T('items.ac_r3_blind.name'), grade: 'rare', tier: 3, units: 'd1', src: 'drop', mods: { statusImmune: ['blind'] }, desc: R.T('items.ac_r3_blind.desc'), slot: 'acc', icon: 'ring' },
  ac_r5_gold: { name: R.T('items.ac_r5_gold.name'), grade: 'rare', tier: 5, units: 'a1', src: 'drop', mods: { goldPct: 20 }, desc: R.T('items.ac_r5_gold.desc'), slot: 'acc', icon: 'ring' },
  ac_r5_int: { name: R.T('items.ac_r5_int.name'), grade: 'rare', tier: 5, units: 'i1', src: 'drop', mods: { mag: 9 }, desc: R.T('items.ac_r5_int.desc'), slot: 'acc', icon: 'ring' },
  ac_r5_poison: { name: R.T('items.ac_r5_poison.name'), grade: 'rare', tier: 5, units: 'v1', src: 'drop', mods: { statusImmune: ['poison'] }, desc: R.T('items.ac_r5_poison.desc'), slot: 'acc', icon: 'ring' },
  ac_r5_para: {
    name: R.T('items.ac_r5_para.name'),
    grade: 'rare',
    tier: 5,
    units: 's1',
    src: 'drop',
    mods: { statusImmune: ['paralyze'] },
    desc: R.T('items.ac_r5_para.desc'),
    slot: 'acc',
    icon: 'ring',
  },
  ac_r5_freeze: { name: R.T('items.ac_r5_freeze.name'), grade: 'rare', tier: 5, units: 'm1', src: 'drop', mods: { statusImmune: ['freeze'] }, desc: R.T('items.ac_r5_freeze.desc'), slot: 'acc', icon: 'ring' },
  ac_r5_burn: { name: R.T('items.ac_r5_burn.name'), grade: 'rare', tier: 5, units: 'v1', src: 'drop', mods: { statusImmune: ['burn'] }, desc: R.T('items.ac_r5_burn.desc'), slot: 'acc', icon: 'ring' },
  ac_r7_str: { name: R.T('items.ac_r7_str.name'), grade: 'rare', tier: 7, units: 's1', src: 'drop', mods: { hpPct: 10 }, desc: R.T('items.ac_r7_str.desc'), slot: 'acc', icon: 'ring' },
  ac_r7_dex: { name: R.T('items.ac_r7_dex.name'), grade: 'rare', tier: 7, units: 'd1', src: 'drop', mods: { glimPct: { tech: 15 } }, desc: R.T('items.ac_r7_dex.desc'), slot: 'acc', icon: 'ring' },
  ac_r7_int: { name: R.T('items.ac_r7_int.name'), grade: 'rare', tier: 7, units: 'i1', src: 'drop', mods: { mag: 14 }, desc: R.T('items.ac_r7_int.desc'), slot: 'acc', icon: 'ring' },
  ac_r7_sleep: { name: R.T('items.ac_r7_sleep.name'), grade: 'rare', tier: 7, units: 'm1', src: 'drop', mods: { statusImmune: ['sleep'] }, desc: R.T('items.ac_r7_sleep.desc'), slot: 'acc', icon: 'ring' },
  ac_r7_confuse: { name: R.T('items.ac_r7_confuse.name'), grade: 'rare', tier: 7, units: 'm1', src: 'drop', mods: { statusImmune: ['confuse'] }, desc: R.T('items.ac_r7_confuse.desc'), slot: 'acc', icon: 'ring' },
  ac_r9_str: { name: R.T('items.ac_r9_str.name'), grade: 'rare', tier: 9, units: 's1', src: 'drop', mods: { physPct: 10 }, desc: R.T('items.ac_r9_str.desc'), slot: 'acc', icon: 'ring' },
  ac_r9_dex: { name: R.T('items.ac_r9_dex.name'), grade: 'rare', tier: 9, units: 'd1', src: 'drop', mods: { glimPct: { tech: 15 } }, desc: R.T('items.ac_r9_dex.desc'), slot: 'acc', icon: 'ring' },
  ac_r9_int: { name: R.T('items.ac_r9_int.name'), grade: 'rare', tier: 9, units: 'i1', src: 'drop', mods: { mag: 20 }, desc: R.T('items.ac_r9_int.desc'), slot: 'acc', icon: 'ring' },
  ac_r9_death: { name: R.T('items.ac_r9_death.name'), grade: 'rare', tier: 9, units: 'v1', src: 'drop', mods: { statusImmune: ['death'] }, desc: R.T('items.ac_r9_death.desc'), slot: 'acc', icon: 'ring' },
});
})(window.RPG);
