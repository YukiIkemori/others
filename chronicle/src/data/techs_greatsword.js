// src/data/techs_greatsword.js — 大剣の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_greatsword_overhead: {
      kind: 'tech', wtype: 'greatsword', name: '大上段', desc: '大きく振りかぶり、真っ向から斬る。', wp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.7, acc: 0.9 }],
      fx: 'slash2', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_greatsword_mow: {
      kind: 'tech', wtype: 'greatsword', name: 'なぎ倒し', desc: 'ひと群れの敵を、まとめてなぎ倒す。', wp: 2, target: 'group', reach: false,
      effects: [{ type: 'damage', power: 1 }],
      fx: 'slash2', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_greatsword_flat: {
      kind: 'tech', wtype: 'greatsword', name: '平打ち', desc: '刃の腹でたたき、気絶させることがある。', wp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.35 }],
      fx: 'strike2', rank: 2, glim: { lv: 2, from: ['t_greatsword_overhead'] },
    },
    t_greatsword_whirl: {
      kind: 'tech', wtype: 'greatsword', name: '渦巻き斬り', desc: '大剣を振り回し、敵全体を斬る。', wp: 4, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.05 }],
      fx: 'slash2', rank: 3, glim: { lv: 3, from: ['t_greatsword_mow'] },
    },
    t_greatsword_desperate: {
      kind: 'tech', wtype: 'greatsword', name: '決死斬り', desc: '自分のHPを削り、全力で斬りつける。', wp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.5, hpCost: 0.1 }],
      fx: 'slash3', rank: 4, glim: { lv: 4, from: ['t_greatsword_overhead'] },
    },
    t_greatsword_rend: {
      kind: 'tech', wtype: 'greatsword', name: '鎧断ち', desc: '鎧ごと断ち切る。守備力を半分無視する。', wp: 4, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.8, ignoreDef: 0.5 }],
      fx: 'slash3', rank: 5, glim: { lv: 5, from: ['t_greatsword_flat'] },
    },
    t_greatsword_quake: {
      kind: 'tech', wtype: 'greatsword', name: '地割り', desc: '土の衝撃で敵全体を打つ。後列からも届く。', wp: 6, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.15, element: 'earth' }],
      fx: 'earth2', rank: 6, glim: { lv: 6, from: ['t_greatsword_whirl', 't_greatsword_desperate'] },
    },
    t_greatsword_crush: {
      kind: 'tech', wtype: 'greatsword', name: '鉄砕き', desc: '重い一撃で、敵の守備力を下げる。', wp: 6, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.2 }, { type: 'buff', stat: 'def', stages: -1, chance: 0.8 }],
      fx: 'slash3', rank: 7, glim: { lv: 7, from: ['t_greatsword_rend'] },
    },
    t_greatsword_tempest: {
      kind: 'tech', wtype: 'greatsword', name: '大嵐斬り', desc: '嵐のように振り回し、敵全体を斬る。', wp: 8, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.55 }],
      fx: 'slash3', rank: 8, glim: { lv: 8, from: ['t_greatsword_whirl', 't_greatsword_quake'] },
    },
    t_greatsword_skyfall: {
      kind: 'tech', wtype: 'greatsword', name: '天崩し', desc: '天をも崩す一撃。気絶させることがある。', wp: 11, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.9 }, { type: 'status', status: 'stun', chance: 0.4 }],
      fx: 'slash3', rank: 9, glim: { lv: 9, from: ['t_greatsword_crush', 't_greatsword_desperate'] },
    },
    t_greatsword_rivers: {
      kind: 'tech', wtype: 'greatsword', name: '山河断ち', desc: '敵全体を斬り、気絶させることがある。', wp: 14, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.65 }, { type: 'status', status: 'stun', chance: 0.25 }],
      fx: 'earth3', rank: 10, glim: { lv: 10, from: ['t_greatsword_skyfall', 't_greatsword_tempest'] },
    },
  });
})(window.RPG);
