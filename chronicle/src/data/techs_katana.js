// src/data/techs_katana.js — 刀の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_katana_draw: {
      kind: 'tech', wtype: 'katana', name: '抜き打ち', desc: '刀を抜きざまに斬る。先に動ける。', wp: 1, target: 'enemy', reach: false, quick: true,
      effects: [{ type: 'damage', power: 1.2, critBonus: 10 }],
      fx: 'slash', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_katana_mine: {
      kind: 'tech', wtype: 'katana', name: '峰打ち', desc: '刀の峰で打ち、気絶させることがある。', wp: 1, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.25, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.3 }],
      fx: 'strike', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_katana_fold: {
      kind: 'tech', wtype: 'katana', name: '重ね斬り', desc: '同じ所を、続けて2回斬る。', wp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.9, hits: 2 }],
      fx: 'slash', rank: 2, glim: { lv: 2, from: ['t_katana_draw'] },
    },
    t_katana_riposte: {
      kind: 'tech', wtype: 'katana', name: '後の先', desc: '攻めてきた敵を、鋭く斬り返す構え。', wp: 2, target: 'self', reach: false, quick: true,
      effects: [{ type: 'status', status: 'counter', power: 1.5, critBonus: 20 }],
      fx: 'stance', rank: 3, glim: { lv: 3, from: ['t_katana_mine'] },
    },
    t_katana_haze: {
      kind: 'tech', wtype: 'katana', name: '陽炎斬り', desc: '炎の刃で斬る。やけどさせることがある。', wp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.8, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.35 }],
      fx: 'fire2', rank: 4, glim: { lv: 4, from: ['t_katana_fold'] },
    },
    t_katana_dash: {
      kind: 'tech', wtype: 'katana', name: '駆け抜け', desc: '駆け抜けながら、ひと群れを斬る。', wp: 5, target: 'group', reach: false,
      effects: [{ type: 'damage', power: 1.45 }],
      fx: 'slash2', rank: 5, glim: { lv: 5, from: ['t_katana_draw'] },
    },
    t_katana_steel: {
      kind: 'tech', wtype: 'katana', name: '鋼断ち', desc: '鋼さえ断つ一太刀。鋼の敵にも効く。', wp: 5, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.6, critBonus: 10, metalHit: true }],
      fx: 'slash3', rank: 6, glim: { lv: 6, from: ['t_katana_fold', 't_katana_riposte'] },
    },
    t_katana_void: {
      kind: 'tech', wtype: 'katana', name: '虚空斬り', desc: '見えない刃で斬る。中列からも届く。', wp: 6, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2.2, critBonus: 10 }],
      fx: 'wind2', rank: 7, glim: { lv: 7, from: ['t_katana_dash', 't_katana_steel'] },
    },
    t_katana_lifecut: {
      kind: 'tech', wtype: 'katana', name: '命断ち', desc: '命を断つ一太刀。一撃で倒すことがある。', wp: 7, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.2, critBonus: 10 }, { type: 'status', status: 'death', chance: 0.2 }],
      fx: 'slash3', rank: 8, glim: { lv: 8, from: ['t_katana_riposte', 't_katana_haze'] },
    },
    t_katana_leaves: {
      kind: 'tech', wtype: 'katana', name: '落葉の太刀', desc: '舞う木の葉のように、鋭く3回斬る。', wp: 10, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.95, hits: 3, critBonus: 20 }],
      fx: 'slash3', rank: 9, glim: { lv: 9, from: ['t_katana_fold', 't_katana_lifecut'] },
    },
    t_katana_first: {
      kind: 'tech', wtype: 'katana', name: '一の太刀', desc: 'だれよりも先に、必殺の一太刀を放つ。', wp: 12, target: 'enemy', reach: false, quick: true,
      effects: [{ type: 'damage', power: 2.3, critBonus: 40 }],
      fx: 'slash3', rank: 10, glim: { lv: 10, from: ['t_katana_leaves', 't_katana_void'] },
    },
  });
})(window.RPG);
