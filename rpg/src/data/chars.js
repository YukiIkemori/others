// The three fixed party members.
// Base stat at level L = base + growth * (L - 1)   (then × job multiplier)
(function (R) {
  'use strict';
  Object.assign(R.DB.chars, {
    yuki: {
      name: 'ユウキ', gender: 'm', startJob: 'warrior',
      desc: '剣士の家系に生まれた まっすぐな少年。力と体力に優れる。',
      growth: {
        hp: [32, 9.2], mp: [4, 2.4], str: [13, 2.55], vit: [11, 2.2],
        agi: [9, 1.95], int: [5, 1.55], mnd: [7, 1.7], luk: [8, 1.5],
      },
      startLearned: ['warrior_power_slash'],
      startEquip: { weapon: 'copper_sword', body: 'traveler_clothes' },
    },
    non: {
      name: 'ノン', gender: 'f', startJob: 'priest',
      desc: '神殿で育った 心やさしい少女。回復の才と すばやさを持つ。',
      growth: {
        hp: [26, 7.7], mp: [11, 3.5], str: [9, 1.85], vit: [9, 1.8],
        agi: [11, 2.3], int: [8, 2.0], mnd: [13, 2.8], luk: [10, 1.9],
      },
      startLearned: ['priest_heal'],
      startEquip: { weapon: 'oak_staff', body: 'traveler_clothes' },
    },
    metem: {
      name: 'メテム', gender: 'f', startJob: 'mage',
      desc: '魔法学院はじまって以来の天才少女。魔力は高いが 体は弱い。',
      growth: {
        hp: [22, 6.7], mp: [13, 4.1], str: [7, 1.5], vit: [7, 1.5],
        agi: [10, 2.4], int: [14, 3.0], mnd: [10, 2.2], luk: [9, 1.7],
      },
      startLearned: ['mage_fire'],
      startEquip: { weapon: 'wooden_rod', body: 'traveler_clothes' },
    },
  });
  R.PARTY_ORDER = ['yuki', 'non', 'metem'];
})(window.RPG);
