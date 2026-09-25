// src/data/techs_staff.js — 杖の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_staff_mind: {
      kind: 'tech', wtype: 'staff', name: '念じ打ち', desc: '術力で打つ念の一撃。中列からも届く。', wp: 1, target: 'enemy', reach: true, magic: true,
      effects: [{ type: 'damage', formula: 'magic', power: 1.2 }],
      fx: 'magic', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_staff_soothe: {
      kind: 'tech', wtype: 'staff', name: 'いたわり', desc: '杖に祈りをこめ、仲間1人のHPを回復。', wp: 2, target: 'ally', reach: true, magic: true,
      effects: [{ type: 'heal', pct: 0.25 }],
      fx: 'heal', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_staff_seal: {
      kind: 'tech', wtype: 'staff', name: '封じの印', desc: '術を封じる念。術を封じることがある。', wp: 2, target: 'enemy', reach: true, magic: true,
      effects: [{ type: 'damage', formula: 'magic', power: 1.2 }, { type: 'status', status: 'silence', chance: 0.45 }],
      fx: 'silence', rank: 2, glim: { lv: 2, from: ['t_staff_mind'] },
    },
    t_staff_unward: {
      kind: 'tech', wtype: 'staff', name: '守りほどき', desc: '念を放ち、敵の術防を下げる。', wp: 3, target: 'enemy', reach: true, magic: true,
      effects: [{ type: 'damage', formula: 'magic', power: 1.5 }, { type: 'buff', stat: 'mdef', stages: -1, chance: 0.8 }],
      fx: 'debuff', rank: 3, glim: { lv: 3, from: ['t_staff_mind'] },
    },
    t_staff_share: {
      kind: 'tech', wtype: 'staff', name: '魔力分け', desc: 'WPを使い、仲間1人のMPを回復する。', wp: 4, target: 'ally', reach: true, magic: true, noAuto: true,
      effects: [{ type: 'healMp', pct: 0.15 }],
      fx: 'mp', rank: 4, glim: { lv: 4, from: ['t_staff_soothe'] },
    },
    t_staff_wave: {
      kind: 'tech', wtype: 'staff', name: '念の波', desc: '念の波を広げ、敵全体を打つ。', wp: 5, target: 'enemies', reach: true, magic: true,
      effects: [{ type: 'damage', formula: 'magic', power: 1.25 }],
      fx: 'magic2', rank: 5, glim: { lv: 5, from: ['t_staff_mind', 't_staff_unward'] },
    },
    t_staff_clarity: {
      kind: 'tech', wtype: 'staff', name: '心澄まし', desc: '心を澄まし、術力と術防を上げる。', wp: 4, target: 'self', reach: true, quick: true, magic: true,
      effects: [{ type: 'buff', stat: 'mag', stages: 1 }, { type: 'buff', stat: 'mdef', stages: 1 }],
      fx: 'buff', rank: 6, glim: { lv: 6, from: ['t_staff_share'] },
    },
    t_staff_aegis: {
      kind: 'tech', wtype: 'staff', name: '術よけの輪', desc: '味方全員の術防を上げる。', wp: 5, target: 'allies', reach: true, magic: true,
      effects: [{ type: 'buff', stat: 'mdef', stages: 1 }],
      fx: 'buff', rank: 7, glim: { lv: 7, from: ['t_staff_soothe', 't_staff_clarity'] },
    },
    t_staff_drain: {
      kind: 'tech', wtype: 'staff', name: '生気吸い', desc: '敵の生気を吸い、自分のHPにする。', wp: 7, target: 'enemy', reach: true, magic: true,
      effects: [{ type: 'damage', formula: 'magic', power: 2.6, drain: 0.5 }],
      fx: 'drain', rank: 8, glim: { lv: 8, from: ['t_staff_seal', 't_staff_wave'] },
    },
    t_staff_oracle: {
      kind: 'tech', wtype: 'staff', name: '天啓の杖', desc: '天の声を杖に受け、敵全体を打つ。沈黙も。', wp: 10, target: 'enemies', reach: true, magic: true,
      effects: [{ type: 'damage', formula: 'magic', power: 1.65 }, { type: 'status', status: 'silence', chance: 0.3 }],
      fx: 'magic3', rank: 9, glim: { lv: 9, from: ['t_staff_wave', 't_staff_drain'] },
    },
    t_staff_prayer: {
      kind: 'tech', wtype: 'staff', name: '千年の祈り', desc: '味方全員のHPとMPを回復する。', wp: 13, target: 'allies', reach: true, magic: true,
      effects: [{ type: 'heal', pct: 0.4 }, { type: 'healMp', pct: 0.1 }],
      fx: 'heal3', rank: 10, glim: { lv: 10, from: ['t_staff_aegis', 't_staff_oracle'] },
    },
  });
})(window.RPG);
