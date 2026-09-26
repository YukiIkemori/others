// src/data/techs_sword.js — 剣の技 17個（担当 techs。SYSTEMS_REWORK §3.4 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_sword_stepcut: {
      kind: 'tech', wtype: 'sword', name: '踏み込み斬り', desc: '一歩踏み込み、力強く斬りつける。', mp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.5 }],
      fx: 'slash', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_sword_guard: {
      kind: 'tech', wtype: 'sword', name: '受け太刀', desc: '敵の攻撃を受け流し、斬り返す構え。', mp: 3, target: 'self', reach: false, quick: true,
      effects: [{ type: 'status', status: 'counter', power: 0.8, parry: 0.35 }],
      fx: 'stance', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_sword_draw: {
      kind: 'tech', wtype: 'sword', name: '抜き打ち', desc: '抜きざまに斬りつける。先に動ける。', mp: 3, target: 'enemy', reach: false, quick: true,
      effects: [{ type: 'damage', power: 1.4, critBonus: 10 }],
      fx: 'slash', rank: 2, glim: { lv: 2, from: ['attack'] },
    },
    t_sword_twin: {
      kind: 'tech', wtype: 'sword', name: '連ね斬り', desc: 'すばやく2回、続けて斬りつける。', mp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.9, hits: 2 }],
      fx: 'slash', rank: 2, glim: { lv: 2, from: ['t_sword_stepcut'] },
    },
    t_sword_mine: {
      kind: 'tech', wtype: 'sword', name: '峰打ち', desc: '刃の峰で打ち、気絶させることがある。', mp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.5, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.3 }],
      fx: 'strike', rank: 3, glim: { lv: 3, from: ['t_sword_draw'] },
    },
    t_sword_thrust: {
      kind: 'tech', wtype: 'sword', name: '刺し貫き', desc: '剣先で深く刺し貫く。突きの一撃。', mp: 5, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.9, kind: 'pierce' }],
      fx: 'pierce', rank: 3, glim: { lv: 3, from: ['t_sword_stepcut'] },
    },
    t_sword_wheel: {
      kind: 'tech', wtype: 'sword', name: '風車斬り', desc: 'ひと群れの敵を、まとめて斬り払う。', mp: 6, target: 'group', reach: false,
      effects: [{ type: 'damage', power: 1.35 }],
      fx: 'slash2', rank: 4, glim: { lv: 4, from: ['t_sword_twin'] },
    },
    t_sword_haze: {
      kind: 'tech', wtype: 'sword', name: '陽炎斬り', desc: '炎の刃で斬る。やけどさせることがある。', mp: 5, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.8, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.35 }],
      fx: 'fire2', rank: 4, glim: { lv: 4, from: ['t_sword_mine'] },
    },
    t_sword_bulwark: {
      kind: 'tech', wtype: 'sword', name: '城壁の構え', desc: '次の手番まで、仲間への攻撃を引き受ける。', mp: 5, target: 'self', reach: false, quick: true,
      effects: [{ type: 'cover', mul: 0.6 }],
      fx: 'stance', rank: 5, glim: { lv: 5, from: ['t_sword_guard'] },
    },
    t_sword_purify: {
      kind: 'tech', wtype: 'sword', name: '清めの剣', desc: '光を宿した刃で斬る。不死や魔族に強い。', mp: 8, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.3, element: 'light' }],
      fx: 'holy2', rank: 6, glim: { lv: 6, from: ['t_sword_thrust', 't_sword_bulwark'] },
    },
    t_sword_void: {
      kind: 'tech', wtype: 'sword', name: '虚空斬り', desc: '見えない刃で斬る。後列からも届く。', mp: 9, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2.2, critBonus: 10 }],
      fx: 'wind2', rank: 6, glim: { lv: 6, from: ['t_sword_haze', 't_sword_wheel'] },
    },
    t_sword_bladewind: {
      kind: 'tech', wtype: 'sword', name: '刃風', desc: '刃の風で敵全体を斬る。後列からも届く。', mp: 11, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.2 }],
      fx: 'wind2', rank: 7, glim: { lv: 7, from: ['t_sword_wheel'] },
    },
    t_sword_lifecut: {
      kind: 'tech', wtype: 'sword', name: '命断ち', desc: '命を断つ一太刀。一撃で倒すことがある。', mp: 11, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.2, critBonus: 10 }, { type: 'status', status: 'death', chance: 0.2 }],
      fx: 'slash3', rank: 7, glim: { lv: 7, from: ['t_sword_void'] },
    },
    t_sword_triple: {
      kind: 'tech', wtype: 'sword', name: '三つ星斬り', desc: '星をなぞるように、3回斬りつける。', mp: 12, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 0.98, hits: 3 }],
      fx: 'slash3', rank: 8, glim: { lv: 8, from: ['t_sword_twin', 't_sword_purify'] },
    },
    t_sword_first: {
      kind: 'tech', wtype: 'sword', name: '一の太刀', desc: 'だれよりも先に、必殺の一太刀を放つ。', mp: 15, target: 'enemy', reach: false, quick: true,
      effects: [{ type: 'damage', power: 2.6, critBonus: 40 }],
      fx: 'slash3', rank: 9, glim: { lv: 9, from: ['t_sword_lifecut', 't_sword_draw'] },
    },
    t_sword_dawn: {
      kind: 'tech', wtype: 'sword', name: '日の出の剣', desc: '夜明けの光のような、鋭い一撃。', mp: 15, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.9, critBonus: 15 }],
      fx: 'slash3', rank: 9, glim: { lv: 9, from: ['t_sword_triple', 't_sword_bladewind'] },
    },
    t_sword_crest: {
      kind: 'tech', wtype: 'sword', name: '光紋剣', desc: '伝説の勇者の剣技。光の紋章を刻む。', mp: 20, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.95, element: 'light' }],
      fx: 'holy3', rank: 10, glim: { lv: 10, from: ['t_sword_dawn'] },
    },
  });
})(window.RPG);
