// src/data/techs_club.js — 棍棒の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_club_smash: {
      kind: 'tech', wtype: 'club', name: '強打', desc: '力いっぱい殴る。気絶させることがある。', wp: 1, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.3 }, { type: 'status', status: 'stun', chance: 0.25 }],
      fx: 'strike', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_club_crumble: {
      kind: 'tech', wtype: 'club', name: '打ち崩し', desc: '殴りつけて、敵の守備力を下げる。', wp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.25 }, { type: 'buff', stat: 'def', stages: -1, chance: 0.8 }],
      fx: 'strike', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_club_wrist: {
      kind: 'tech', wtype: 'club', name: '小手打ち', desc: '腕を打ちすえ、敵の攻撃力を下げる。', wp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45 }, { type: 'buff', stat: 'atk', stages: -1, chance: 0.8 }],
      fx: 'strike', rank: 2, glim: { lv: 2, from: ['t_club_crumble'] },
    },
    t_club_tremor: {
      kind: 'tech', wtype: 'club', name: '地揺らし', desc: '地面を打ち、ひと群れの敵を揺さぶる。', wp: 4, target: 'group', reach: false,
      effects: [{ type: 'damage', power: 1.2, element: 'earth' }],
      fx: 'earth', rank: 3, glim: { lv: 3, from: ['t_club_smash'] },
    },
    t_club_bell: {
      kind: 'tech', wtype: 'club', name: '鐘打ち', desc: '鐘を鳴らすように打ち、よく気絶させる。', wp: 4, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.8 }, { type: 'status', status: 'stun', chance: 0.5 }],
      fx: 'strike2', rank: 4, glim: { lv: 4, from: ['t_club_smash'] },
    },
    t_club_strip: {
      kind: 'tech', wtype: 'club', name: 'はがし打ち', desc: '敵にかかった強化を、打ち消す一撃。', wp: 4, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.9 }, { type: 'dispel', side: 'good' }],
      fx: 'strike2', rank: 5, glim: { lv: 5, from: ['t_club_crumble', 't_club_wrist'] },
    },
    t_club_shatter: {
      kind: 'tech', wtype: 'club', name: '鎧くずし', desc: '敵の守備力を、大きく下げる一撃。', wp: 5, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2 }, { type: 'buff', stat: 'def', stages: -2, chance: 0.7 }],
      fx: 'strike3', rank: 6, glim: { lv: 6, from: ['t_club_strip', 't_club_crumble'] },
    },
    t_club_rumble: {
      kind: 'tech', wtype: 'club', name: '山鳴り', desc: '大地を打ち鳴らし、敵全体を揺さぶる。', wp: 7, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.25, element: 'earth' }, { type: 'status', status: 'stun', chance: 0.2 }],
      fx: 'earth2', rank: 7, glim: { lv: 7, from: ['t_club_tremor', 't_club_bell'] },
    },
    t_club_diamond: {
      kind: 'tech', wtype: 'club', name: '金剛打ち', desc: '金剛の一撃。よく気絶させる。', wp: 8, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.4 }, { type: 'status', status: 'stun', chance: 0.5 }],
      fx: 'strike3', rank: 8, glim: { lv: 8, from: ['t_club_bell', 't_club_shatter'] },
    },
    t_club_thunder: {
      kind: 'tech', wtype: 'club', name: '神鳴り打ち', desc: '雷のごとき一撃。気絶させやすい。', wp: 10, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.7 }, { type: 'status', status: 'stun', chance: 0.6 }],
      fx: 'strike3', rank: 9, glim: { lv: 9, from: ['t_club_diamond', 't_club_rumble'] },
    },
    t_club_upheaval: {
      kind: 'tech', wtype: 'club', name: '大鳴動', desc: '大地をゆさぶり、敵全体を打ちのめす。', wp: 13, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.5, element: 'earth' }, { type: 'status', status: 'stun', chance: 0.3 }],
      fx: 'earth3', rank: 10, glim: { lv: 10, from: ['t_club_thunder'] },
    },
  });
})(window.RPG);
