// src/data/techs_dagger.js — 短剣の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_dagger_vital: {
      kind: 'tech', wtype: 'dagger', name: '急所ねらい', desc: '急所をねらって突く。会心が出やすい。', wp: 1, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.25, critBonus: 15 }],
      fx: 'pierce', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_dagger_filch: {
      kind: 'tech', wtype: 'dagger', name: 'かすめ取り', desc: '斬りつけながら、持ち物を盗む。', wp: 1, target: 'enemy', reach: false, noAuto: true,
      effects: [{ type: 'damage', power: 0.7 }, { type: 'steal' }],
      fx: 'steal', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_dagger_venom: {
      kind: 'tech', wtype: 'dagger', name: '毒の一刺し', desc: '毒を塗った刃で刺す。毒にすることがある。', wp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45 }, { type: 'status', status: 'poison', chance: 0.5 }],
      fx: 'poison', rank: 2, glim: { lv: 2, from: ['t_dagger_vital'] },
    },
    t_dagger_knives: {
      kind: 'tech', wtype: 'dagger', name: '刃つぶて', desc: '小刀を2本投げる。中列からも届く。', wp: 3, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.9, hits: 2 }],
      fx: 'pierce', rank: 3, glim: { lv: 3, from: ['t_dagger_filch'] },
    },
    t_dagger_lull: {
      kind: 'tech', wtype: 'dagger', name: 'まどろみ刺し', desc: '刺した相手を、眠らせることがある。', wp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.8 }, { type: 'status', status: 'sleep', chance: 0.4 }],
      fx: 'sleep', rank: 4, glim: { lv: 4, from: ['t_dagger_venom'] },
    },
    t_dagger_bees: {
      kind: 'tech', wtype: 'dagger', name: '蜂の群れ', desc: '蜂の群れのように、4回すばやく刺す。', wp: 5, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.6, hits: 4 }],
      fx: 'pierce2', rank: 5, glim: { lv: 5, from: ['t_dagger_knives'] },
    },
    t_dagger_gap: {
      kind: 'tech', wtype: 'dagger', name: 'すきま通し', desc: '鎧のすき間を通す一刺し。鋼の敵にも効く。', wp: 4, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.7, sure: true, metalHit: true }],
      fx: 'pierce2', rank: 6, glim: { lv: 6, from: ['t_dagger_vital', 't_dagger_lull'] },
    },
    t_dagger_nape: {
      kind: 'tech', wtype: 'dagger', name: '寝首かき', desc: '動けない敵を刺すと、ダメージが2倍。', wp: 6, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.2, vs: { sleep: 2, paralyze: 2, freeze: 2, stun: 2 } }],
      fx: 'pierce3', rank: 7, glim: { lv: 7, from: ['t_dagger_lull'] },
    },
    t_dagger_shadow: {
      kind: 'tech', wtype: 'dagger', name: '影の一刺し', desc: '影から急所を刺し、一撃で倒すことがある。', wp: 7, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.2 }, { type: 'status', status: 'death', chance: 0.2 }],
      fx: 'pierce3', rank: 8, glim: { lv: 8, from: ['t_dagger_gap', 't_dagger_bees'] },
    },
    t_dagger_dance: {
      kind: 'tech', wtype: 'dagger', name: '影の舞', desc: '影のように舞い、6回すばやく刺す。', wp: 10, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.52, hits: 6, critBonus: 10 }],
      fx: 'pierce3', rank: 9, glim: { lv: 9, from: ['t_dagger_bees', 't_dagger_nape'] },
    },
    t_dagger_nightfall: {
      kind: 'tech', wtype: 'dagger', name: '闇夜の刃', desc: '闇にまぎれて8回刺す。毒にすることも。', wp: 13, target: 'random', reach: false,
      effects: [{ type: 'damage', power: 0.42, hits: 8 }, { type: 'status', status: 'poison', chance: 0.3 }],
      fx: 'dark3', rank: 10, glim: { lv: 10, from: ['t_dagger_dance'] },
    },
  });
})(window.RPG);
