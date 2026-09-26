// src/data/techs_fist.js — 体術の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_fist_palm: {
      kind: 'tech', wtype: 'fist', name: '掌打', desc: '手のひらで、鋭く打ち込む。', wp: 1, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.5 }],
      fx: 'strike', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_fist_onetwo: {
      kind: 'tech', wtype: 'fist', name: '左右打ち', desc: '左右の拳で、2回続けて打つ。', wp: 1, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.79, hits: 2 }],
      fx: 'strike', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_fist_willow: {
      kind: 'tech', wtype: 'fist', name: '柳の構え', desc: '受け流して打ち返す、柔らかな構え。', wp: 2, target: 'self', reach: false, quick: true,
      effects: [{ type: 'status', status: 'counter', power: 1.1, parry: 0.3 }],
      fx: 'stance', rank: 2, glim: { lv: 2, from: ['t_fist_palm'] },
    },
    t_fist_knee: {
      kind: 'tech', wtype: 'fist', name: '飛び膝蹴り', desc: '跳んで膝で打つ。気絶させることがある。', wp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.6 }, { type: 'status', status: 'stun', chance: 0.35 }],
      fx: 'strike2', rank: 3, glim: { lv: 3, from: ['t_fist_onetwo'] },
    },
    t_fist_breath: {
      kind: 'tech', wtype: 'fist', name: '調息', desc: '息を整え、HPと毒・暗闇・やけどを治す。', wp: 3, target: 'self', reach: true,
      effects: [{ type: 'heal', pct: 0.3 }, { type: 'cure', statuses: ['poison', 'blind', 'burn'] }],
      fx: 'heal', rank: 4, glim: { lv: 4, from: ['t_fist_willow'] },
    },
    t_fist_hail: {
      kind: 'tech', wtype: 'fist', name: '雨あられ', desc: '雨あられと拳を浴びせ、5回打つ。', wp: 5, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.47, hits: 5 }],
      fx: 'strike2', rank: 5, glim: { lv: 5, from: ['t_fist_onetwo', 't_fist_knee'] },
    },
    t_fist_farstrike: {
      kind: 'tech', wtype: 'fist', name: '遠当て', desc: '気を放って打つ。後列からも届く。', wp: 5, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2 }],
      fx: 'wind2', rank: 6, glim: { lv: 6, from: ['t_fist_palm', 't_fist_breath'] },
    },
    t_fist_throw: {
      kind: 'tech', wtype: 'fist', name: '背負い投げ', desc: '背負って投げ、気絶させることがある。', wp: 6, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.25 }, { type: 'status', status: 'stun', chance: 0.4 }],
      fx: 'strike3', rank: 7, glim: { lv: 7, from: ['t_fist_knee', 't_fist_willow'] },
    },
    t_fist_wolves: {
      kind: 'tech', wtype: 'fist', name: '群狼拳', desc: '狼の群れのように、敵に6回襲いかかる。', wp: 8, target: 'random', reach: false,
      effects: [{ type: 'damage', power: 0.51, hits: 6 }],
      fx: 'claw3', rank: 8, glim: { lv: 8, from: ['t_fist_hail'] },
    },
    t_fist_eightfold: {
      kind: 'tech', wtype: 'fist', name: '八重の拳', desc: '八重に重ねた拳を、1体に打ち込む。', wp: 10, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.42, hits: 8 }],
      fx: 'strike3', rank: 9, glim: { lv: 9, from: ['t_fist_wolves', 't_fist_throw'] },
    },
    t_fist_empty: {
      kind: 'tech', wtype: 'fist', name: '空の拳', desc: '守りを完全に無視する、空の一撃。', wp: 12, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.4, ignoreDef: 1 }],
      fx: 'strike3', rank: 10, glim: { lv: 10, from: ['t_fist_eightfold', 't_fist_farstrike'] },
    },
  });
})(window.RPG);
