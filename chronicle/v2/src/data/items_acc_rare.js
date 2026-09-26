// items_acc_rare.js — アクセサリのレア 19（RULES。K.item。数値は R.Rules.fillItem が R.onData で埋める）
// 生成: node v2/tools/port/*.js（今の木から移した結果。以後はこのファイルが正）
(function (R) {
  'use strict';
  R.defs('items', {
  ac_r1_int: { name: '朝露の耳飾り', grade: 'rare', tier: 1, units: 'i1', src: 'drop', mods: { mpRegen: 1 }, desc: '戦闘中、MPが少しずつ戻る。', slot: 'acc', icon: 'ring' },
  ac_r1_item: { name: '蜂蜜の小瓶', grade: 'rare', tier: 1, units: 'm1', src: 'drop', mods: { itemPct: 50 }, desc: '回復の道具がよく効く。', slot: 'acc', icon: 'ring' },
  ac_r3_drop: { name: '目利きの首飾り', grade: 'rare', tier: 3, units: 'd1', src: 'drop', mods: { dropPct: 20 }, desc: '魔物がアイテムを落としやすい。', slot: 'acc', icon: 'ring' },
  ac_r3_blind: { name: '夜目の片眼鏡', grade: 'rare', tier: 3, units: 'd1', src: 'drop', mods: { statusImmune: ['blind'] }, desc: '暗闇が効かない。', slot: 'acc', icon: 'ring' },
  ac_r5_gold: { name: '旅芸人の鈴', grade: 'rare', tier: 5, units: 'a1', src: 'drop', mods: { goldPct: 20 }, desc: '手に入るお金が増える。', slot: 'acc', icon: 'ring' },
  ac_r5_int: { name: '月長石のブローチ', grade: 'rare', tier: 5, units: 'i1', src: 'drop', mods: { mag: 9 }, desc: '術力が上がる。', slot: 'acc', icon: 'ring' },
  ac_r5_poison: { name: '蛇よけの腕輪', grade: 'rare', tier: 5, units: 'v1', src: 'drop', mods: { statusImmune: ['poison'] }, desc: '毒が効かない。', slot: 'acc', icon: 'ring' },
  ac_r5_para: {
    name: 'しびれ知らずの環',
    grade: 'rare',
    tier: 5,
    units: 's1',
    src: 'drop',
    mods: { statusImmune: ['paralyze'] },
    desc: 'まひが効かない。',
    slot: 'acc',
    icon: 'ring',
  },
  ac_r5_freeze: { name: '凍え知らずの環', grade: 'rare', tier: 5, units: 'm1', src: 'drop', mods: { statusImmune: ['freeze'] }, desc: '凍結が効かない。', slot: 'acc', icon: 'ring' },
  ac_r5_burn: { name: 'やけど知らずの環', grade: 'rare', tier: 5, units: 'v1', src: 'drop', mods: { statusImmune: ['burn'] }, desc: 'やけどが効かない。', slot: 'acc', icon: 'ring' },
  ac_r7_str: { name: '闘将の腕輪', grade: 'rare', tier: 7, units: 's1', src: 'drop', mods: { hpPct: 10 }, desc: '最大HPが上がる。', slot: 'acc', icon: 'ring' },
  ac_r7_dex: { name: '鷹の目の指輪', grade: 'rare', tier: 7, units: 'd1', src: 'drop', mods: { glimPct: { tech: 15 } }, desc: '技を閃きやすい。', slot: 'acc', icon: 'ring' },
  ac_r7_int: { name: '知恵の紅玉', grade: 'rare', tier: 7, units: 'i1', src: 'drop', mods: { mag: 14 }, desc: '術力が上がる。', slot: 'acc', icon: 'ring' },
  ac_r7_sleep: { name: '覚醒の耳飾り', grade: 'rare', tier: 7, units: 'm1', src: 'drop', mods: { statusImmune: ['sleep'] }, desc: '眠りが効かない。', slot: 'acc', icon: 'ring' },
  ac_r7_confuse: { name: '正気の守り石', grade: 'rare', tier: 7, units: 'm1', src: 'drop', mods: { statusImmune: ['confuse'] }, desc: '混乱が効かない。', slot: 'acc', icon: 'ring' },
  ac_r9_str: { name: '英雄の腕輪', grade: 'rare', tier: 9, units: 's1', src: 'drop', mods: { physPct: 10 }, desc: '物理攻撃の威力が上がる。', slot: 'acc', icon: 'ring' },
  ac_r9_dex: { name: '星見の指輪', grade: 'rare', tier: 9, units: 'd1', src: 'drop', mods: { glimPct: { tech: 15 } }, desc: '技を閃きやすい。', slot: 'acc', icon: 'ring' },
  ac_r9_int: { name: '知恵の虹輪', grade: 'rare', tier: 9, units: 'i1', src: 'drop', mods: { mag: 20 }, desc: '術力が上がる。', slot: 'acc', icon: 'ring' },
  ac_r9_death: { name: '命綱の首飾り', grade: 'rare', tier: 9, units: 'v1', src: 'drop', mods: { statusImmune: ['death'] }, desc: '即死が効かない。', slot: 'acc', icon: 'ring' },
});
})(window.RPG);
