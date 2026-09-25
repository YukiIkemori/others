// src/data/techs_whip.js — 鞭の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_whip_trip: {
      kind: 'tech', wtype: 'whip', name: '足からめ', desc: '足にからめて、素早さを下げる。', wp: 1, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.25 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.5 }],
      fx: 'lash', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_whip_sweep: {
      kind: 'tech', wtype: 'whip', name: 'しなり打ち', desc: '鞭をしならせ、ひと群れを打つ。', wp: 2, target: 'group', reach: true,
      effects: [{ type: 'damage', power: 1 }],
      fx: 'lash', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_whip_bind: {
      kind: 'tech', wtype: 'whip', name: '締め上げ', desc: '巻きつけて締め、まひさせることがある。', wp: 2, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.45 }, { type: 'status', status: 'paralyze', chance: 0.4 }],
      fx: 'lash', rank: 2, glim: { lv: 2, from: ['t_whip_trip'] },
    },
    t_whip_disarm: {
      kind: 'tech', wtype: 'whip', name: '武器はたき', desc: '武器をはたき落とし、攻撃力を下げる。', wp: 3, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.6 }, { type: 'buff', stat: 'atk', stages: -1, chance: 0.8 }],
      fx: 'lash2', rank: 3, glim: { lv: 3, from: ['t_whip_trip'] },
    },
    t_whip_snatch: {
      kind: 'tech', wtype: 'whip', name: '絡め取り', desc: '鞭で絡め取り、持ち物を奪う。', wp: 3, target: 'enemy', reach: true, noAuto: true,
      effects: [{ type: 'damage', power: 1 }, { type: 'steal' }],
      fx: 'steal', rank: 4, glim: { lv: 4, from: ['t_whip_bind'] },
    },
    t_whip_serpent: {
      kind: 'tech', wtype: 'whip', name: '蛇の舞', desc: '蛇のようにうねり、混乱させることがある。', wp: 4, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.9 }, { type: 'status', status: 'confuse', chance: 0.4 }],
      fx: 'lash2', rank: 5, glim: { lv: 5, from: ['t_whip_sweep', 't_whip_disarm'] },
    },
    t_whip_thorn: {
      kind: 'tech', wtype: 'whip', name: 'とげ打ち', desc: 'とげで打ち、毒にすることがある。', wp: 5, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2.05 }, { type: 'status', status: 'poison', chance: 0.5 }],
      fx: 'poison', rank: 6, glim: { lv: 6, from: ['t_whip_bind'] },
    },
    t_whip_sparks: {
      kind: 'tech', wtype: 'whip', name: '火花散らし', desc: '火花を散らして、敵に4回打ちかかる。', wp: 6, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.72, hits: 4 }],
      fx: 'lash3', rank: 7, glim: { lv: 7, from: ['t_whip_sweep', 't_whip_serpent'] },
    },
    t_whip_coil: {
      kind: 'tech', wtype: 'whip', name: '大蛇の輪', desc: '敵全体を打ち、素早さを下げることがある。', wp: 8, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.3 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.5 }],
      fx: 'lash3', rank: 8, glim: { lv: 8, from: ['t_whip_sparks', 't_whip_thorn'] },
    },
    t_whip_net: {
      kind: 'tech', wtype: 'whip', name: '天の網', desc: '敵全体に絡みつき、まひさせることがある。', wp: 11, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.45 }, { type: 'status', status: 'paralyze', chance: 0.3 }],
      fx: 'lash3', rank: 9, glim: { lv: 9, from: ['t_whip_coil', 't_whip_bind'] },
    },
    t_whip_twilight: {
      kind: 'tech', wtype: 'whip', name: '宵闇の舞', desc: '敵全体を打ち、素早さと攻撃力を下げる。', wp: 13, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.35 }, { type: 'buff', stat: 'agi', stages: -1, chance: 1 }, { type: 'buff', stat: 'atk', stages: -1, chance: 0.5 }],
      fx: 'lash3', rank: 10, glim: { lv: 10, from: ['t_whip_net'] },
    },
  });
})(window.RPG);
