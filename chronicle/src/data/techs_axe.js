// src/data/techs_axe.js — 斧の技 16個（担当 techs。SYSTEMS_REWORK §3.4 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_axe_cleave: {
      kind: 'tech', wtype: 'axe', name: 'たたき割り', desc: '力任せにたたき割る。守備力を少し無視。', mp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45, ignoreDef: 0.25 }],
      fx: 'slash2', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_axe_woodcut: {
      kind: 'tech', wtype: 'axe', name: '木こり割り', desc: '木も獣もたたき割る。植物や獣に強い。', mp: 2, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45, vs: { plant: 1.5, beast: 1.25 } }],
      fx: 'slash2', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_axe_crumble: {
      kind: 'tech', wtype: 'axe', name: '打ち崩し', desc: '殴りつけて、敵の守備力を下げる。', mp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.4, kind: 'blunt' }, { type: 'buff', stat: 'def', stages: -1, chance: 0.8 }],
      fx: 'strike', rank: 2, glim: { lv: 2, from: ['attack'] },
    },
    t_axe_throw: {
      kind: 'tech', wtype: 'axe', name: '回し投げ', desc: '斧を投げて2回当てる。後列からも届く。', mp: 5, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.8, hits: 2 }],
      fx: 'slash', rank: 2, glim: { lv: 2, from: ['t_axe_cleave'] },
    },
    t_axe_rage: {
      kind: 'tech', wtype: 'axe', name: '荒ぶる心', desc: '攻撃力が上がり、守備力が下がる。', mp: 3, target: 'self', reach: true, quick: true,
      effects: [{ type: 'buff', stat: 'atk', stages: 1 }, { type: 'buff', stat: 'def', stages: -1 }],
      fx: 'buff', rank: 3, glim: { lv: 3, from: ['t_axe_woodcut'] },
    },
    t_axe_tremor: {
      kind: 'tech', wtype: 'axe', name: '地揺らし', desc: '地面を打ち、ひと群れの敵を揺さぶる。', mp: 6, target: 'group', reach: false,
      effects: [{ type: 'damage', power: 1.2, element: 'earth', kind: 'blunt' }],
      fx: 'earth', rank: 3, glim: { lv: 3, from: ['t_axe_crumble'] },
    },
    t_axe_reckless: {
      kind: 'tech', wtype: 'axe', name: '荒くれ割り', desc: 'HPを削り、力の限りたたき割る。', mp: 5, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.5, hpCost: 0.1 }],
      fx: 'slash3', rank: 4, glim: { lv: 4, from: ['t_axe_cleave', 't_axe_rage'] },
    },
    t_axe_bell: {
      kind: 'tech', wtype: 'axe', name: '鐘打ち', desc: '鐘を鳴らすように打ち、よく気絶させる。', mp: 6, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.8, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.5 }],
      fx: 'strike2', rank: 4, glim: { lv: 4, from: ['t_axe_crumble'] },
    },
    t_axe_whirl: {
      kind: 'tech', wtype: 'axe', name: '旋風の斧', desc: '斧を振り回し、敵全体を切り裂く。', mp: 8, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.24 }],
      fx: 'slash2', rank: 5, glim: { lv: 5, from: ['t_axe_throw'] },
    },
    t_axe_strip: {
      kind: 'tech', wtype: 'axe', name: 'はがし打ち', desc: '敵にかかった強化を、打ち消す一撃。', mp: 6, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.9, kind: 'blunt' }, { type: 'dispel', side: 'good' }],
      fx: 'strike2', rank: 5, glim: { lv: 5, from: ['t_axe_bell'] },
    },
    t_axe_cliff: {
      kind: 'tech', wtype: 'axe', name: '断崖落とし', desc: '当たりにくいが、とても重い一撃。', mp: 9, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 3.1, acc: 0.8 }],
      fx: 'slash3', rank: 6, glim: { lv: 6, from: ['t_axe_reckless'] },
    },
    t_axe_twostroke: {
      kind: 'tech', wtype: 'axe', name: '鬼の二振り', desc: '鬼のような力で、2回たたき割る。', mp: 9, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45, hits: 2, acc: 0.9 }],
      fx: 'slash3', rank: 7, glim: { lv: 7, from: ['t_axe_woodcut', 't_axe_cliff'] },
    },
    t_axe_storm: {
      kind: 'tech', wtype: 'axe', name: '嵐投げ', desc: '斧を4回投げつける。後列からも届く。', mp: 12, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.65, hits: 4 }],
      fx: 'slash2', rank: 8, glim: { lv: 8, from: ['t_axe_throw', 't_axe_whirl'] },
    },
    t_axe_earthsplit: {
      kind: 'tech', wtype: 'axe', name: '大地割り', desc: '大地まで割る一撃。守備力を半分無視。', mp: 15, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.8, ignoreDef: 0.5 }],
      fx: 'earth3', rank: 9, glim: { lv: 9, from: ['t_axe_cliff', 't_axe_twostroke'] },
    },
    t_axe_thunder: {
      kind: 'tech', wtype: 'axe', name: '神鳴り打ち', desc: '雷のごとき一撃。気絶させやすい。', mp: 15, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.7, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.6 }],
      fx: 'strike3', rank: 9, glim: { lv: 9, from: ['t_axe_bell', 't_axe_strip'] },
    },
    t_axe_giant: {
      kind: 'tech', wtype: 'axe', name: '巨人の一振り', desc: 'HPを削り、守りごと敵全体を砕く。', mp: 21, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.9, ignoreDef: 0.5, hpCost: 0.1 }],
      fx: 'slash3', rank: 10, glim: { lv: 10, from: ['t_axe_earthsplit'] },
    },
  });
})(window.RPG);
