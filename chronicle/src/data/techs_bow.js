// src/data/techs_bow.js — 弓の技 15個（担当 techs。SYSTEMS_REWORK §3.4 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_bow_rapid: {
      kind: 'tech', wtype: 'bow', name: '速射', desc: 'すばやく射る。だれよりも先に動ける。', mp: 2, target: 'enemy', reach: true, quick: true,
      effects: [{ type: 'damage', power: 1.35 }],
      fx: 'arrow', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_bow_twin: {
      kind: 'tech', wtype: 'bow', name: '二つ矢', desc: '2本の矢を放ち、敵のだれかに当てる。', mp: 3, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.83, hits: 2 }],
      fx: 'arrow', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_bow_hobble: {
      kind: 'tech', wtype: 'bow', name: '足止めの矢', desc: '足をねらい、素早さを下げることがある。', mp: 3, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.35 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.5 }],
      fx: 'arrow', rank: 2, glim: { lv: 2, from: ['t_bow_rapid'] },
    },
    t_bow_blind: {
      kind: 'tech', wtype: 'bow', name: '目つぶしの矢', desc: '目をねらい、目をくらませることがある。', mp: 3, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.45 }, { type: 'status', status: 'blind', chance: 0.5 }],
      fx: 'arrow', rank: 2, glim: { lv: 2, from: ['t_bow_rapid'] },
    },
    t_bow_rain: {
      kind: 'tech', wtype: 'bow', name: '矢しぐれ', desc: '矢を雨のように降らせ、敵全体を射る。', mp: 6, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.05 }],
      fx: 'arrow2', rank: 3, glim: { lv: 3, from: ['t_bow_twin'] },
    },
    t_bow_hush: {
      kind: 'tech', wtype: 'bow', name: '静寂の矢', desc: '術を封じる矢。術を封じることがある。', mp: 5, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.8 }, { type: 'status', status: 'silence', chance: 0.5 }],
      fx: 'arrow2', rank: 4, glim: { lv: 4, from: ['t_bow_blind'] },
    },
    t_bow_venom: {
      kind: 'tech', wtype: 'bow', name: '毒矢', desc: '毒を塗った矢。毒にすることがある。', mp: 6, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.8 }, { type: 'status', status: 'poison', chance: 0.5 }],
      fx: 'arrow', rank: 4, glim: { lv: 4, from: ['t_bow_hobble'] },
    },
    t_bow_hawk: {
      kind: 'tech', wtype: 'bow', name: '鷹の一矢', desc: '必ず当たる。飛ぶ敵に大きなダメージ。', mp: 6, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.9, sure: true, vs: { flying: 2 } }],
      fx: 'arrow2', rank: 5, glim: { lv: 5, from: ['t_bow_rapid'] },
    },
    t_bow_pin: {
      kind: 'tech', wtype: 'bow', name: '射すくめ', desc: '射すくめて、まひさせることがある。', mp: 8, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2 }, { type: 'status', status: 'paralyze', chance: 0.4 }],
      fx: 'arrow2', rank: 6, glim: { lv: 6, from: ['t_bow_hush'] },
    },
    t_bow_volley: {
      kind: 'tech', wtype: 'bow', name: 'つるべ射ち', desc: '矢を次々に放ち、敵に4回当てる。', mp: 9, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.72, hits: 4 }],
      fx: 'arrow3', rank: 7, glim: { lv: 7, from: ['t_bow_twin', 't_bow_rain'] },
    },
    t_bow_firerain: {
      kind: 'tech', wtype: 'bow', name: '火矢の雨', desc: '火矢を降らせ、敵に4回当てる。', mp: 11, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.72, hits: 4, element: 'fire' }],
      fx: 'fire2', rank: 7, glim: { lv: 7, from: ['t_bow_venom', 't_bow_rain'] },
    },
    t_bow_gale: {
      kind: 'tech', wtype: 'bow', name: '大風の矢', desc: '風をまとう矢で、敵全体を射る。', mp: 12, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.5, element: 'wind' }],
      fx: 'wind3', rank: 8, glim: { lv: 8, from: ['t_bow_rain', 't_bow_hawk'] },
    },
    t_bow_dusk: {
      kind: 'tech', wtype: 'bow', name: '宵闇の矢', desc: '敵全体を射て、素早さと攻撃力を下げる。', mp: 12, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.2 }, { type: 'buff', stat: 'agi', stages: -1, chance: 1 }, { type: 'buff', stat: 'atk', stages: -1, chance: 0.5 }],
      fx: 'arrow3', rank: 8, glim: { lv: 8, from: ['t_bow_pin', 't_bow_hobble'] },
    },
    t_bow_starrain: {
      kind: 'tech', wtype: 'bow', name: '星しぐれ', desc: '星が降るように、矢を6本放つ。必中。', mp: 15, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.55, hits: 6, sure: true }],
      fx: 'arrow3', rank: 9, glim: { lv: 9, from: ['t_bow_volley', 't_bow_rain'] },
    },
    t_bow_rainbow: {
      kind: 'tech', wtype: 'bow', name: '虹の矢', desc: '虹を描く矢が、敵全体に必ず当たる。', mp: 20, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.7, sure: true }],
      fx: 'holy3', rank: 10, glim: { lv: 10, from: ['t_bow_starrain'] },
    },
  });
})(window.RPG);
