// src/data/techs_axe.js — 斧の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_axe_cleave: {
      kind: 'tech', wtype: 'axe', name: 'たたき割り', desc: '力任せにたたき割る。守備力を少し無視。', wp: 1, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45, ignoreDef: 0.25 }],
      fx: 'slash2', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_axe_woodcut: {
      kind: 'tech', wtype: 'axe', name: '木こり割り', desc: '木も獣もたたき割る。植物や獣に強い。', wp: 1, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45, vs: { plant: 1.5, beast: 1.25 } }],
      fx: 'slash2', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_axe_throw: {
      kind: 'tech', wtype: 'axe', name: '回し投げ', desc: '斧を投げて2回当てる。後列からも届く。', wp: 3, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.8, hits: 2 }],
      fx: 'slash', rank: 2, glim: { lv: 2, from: ['t_axe_cleave'] },
    },
    t_axe_rage: {
      kind: 'tech', wtype: 'axe', name: '荒ぶる心', desc: '攻撃力が上がり、守備力が下がる。', wp: 2, target: 'self', reach: true, quick: true,
      effects: [{ type: 'buff', stat: 'atk', stages: 1 }, { type: 'buff', stat: 'def', stages: -1 }],
      fx: 'buff', rank: 3, glim: { lv: 3, from: ['t_axe_woodcut'] },
    },
    t_axe_reckless: {
      kind: 'tech', wtype: 'axe', name: '荒くれ割り', desc: 'HPを削り、力の限りたたき割る。', wp: 3, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.5, hpCost: 0.1 }],
      fx: 'slash3', rank: 4, glim: { lv: 4, from: ['t_axe_cleave', 't_axe_rage'] },
    },
    t_axe_whirl: {
      kind: 'tech', wtype: 'axe', name: '旋風の斧', desc: '斧を振り回し、敵全体を切り裂く。', wp: 5, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.24 }],
      fx: 'slash2', rank: 5, glim: { lv: 5, from: ['t_axe_throw'] },
    },
    t_axe_cliff: {
      kind: 'tech', wtype: 'axe', name: '断崖落とし', desc: '当たりにくいが、とても重い一撃。', wp: 6, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 3.1, acc: 0.8 }],
      fx: 'slash3', rank: 6, glim: { lv: 6, from: ['t_axe_reckless'] },
    },
    t_axe_twostroke: {
      kind: 'tech', wtype: 'axe', name: '鬼の二振り', desc: '鬼のような力で、2回たたき割る。', wp: 6, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 1.45, hits: 2, acc: 0.9 }],
      fx: 'slash3', rank: 7, glim: { lv: 7, from: ['t_axe_woodcut', 't_axe_cliff'] },
    },
    t_axe_storm: {
      kind: 'tech', wtype: 'axe', name: '嵐投げ', desc: '斧を4回投げつける。後列からも届く。', wp: 8, target: 'random', reach: true,
      effects: [{ type: 'damage', power: 0.65, hits: 4 }],
      fx: 'slash2', rank: 8, glim: { lv: 8, from: ['t_axe_throw', 't_axe_whirl'] },
    },
    t_axe_earthsplit: {
      kind: 'tech', wtype: 'axe', name: '大地割り', desc: '大地まで割る一撃。守備力を半分無視。', wp: 10, target: 'enemy', reach: false,
      effects: [{ type: 'damage', power: 2.8, ignoreDef: 0.5 }],
      fx: 'earth3', rank: 9, glim: { lv: 9, from: ['t_axe_cliff', 't_axe_twostroke'] },
    },
    t_axe_giant: {
      kind: 'tech', wtype: 'axe', name: '巨人の一振り', desc: 'HPを削り、守りごと敵全体を砕く。', wp: 14, target: 'enemies', reach: false,
      effects: [{ type: 'damage', power: 1.9, ignoreDef: 0.5, hpCost: 0.1 }],
      fx: 'slash3', rank: 10, glim: { lv: 10, from: ['t_axe_earthsplit'] },
    },
  });
})(window.RPG);
