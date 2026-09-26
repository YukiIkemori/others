// src/data/techs_spear.js — 槍の技 15個（担当 techs。SYSTEMS_REWORK §3.4 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_spear_upthrust: {
      kind: 'tech', wtype: 'spear', name: '突き上げ', desc: '下から鋭く突き上げる。飛ぶ敵に強い。', mp: 2, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.45, vs: { flying: 1.5 } }],
      fx: 'pierce', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_spear_butt: {
      kind: 'tech', wtype: 'spear', name: '石突き', desc: '石突きで打ち、気絶させることがある。', mp: 2, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.25, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.3 }],
      fx: 'strike', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_spear_skewer: {
      kind: 'tech', wtype: 'spear', name: '穂先払い', desc: 'ひと群れの敵を、まとめて突き払う。', mp: 5, target: 'group', reach: true,
      effects: [{ type: 'damage', power: 1.1 }],
      fx: 'pierce2', rank: 2, glim: { lv: 2, from: ['t_spear_upthrust'] },
    },
    t_spear_disarm: {
      kind: 'tech', wtype: 'spear', name: '武器落とし', desc: '武器をはたき落とし、攻撃力を下げる。', mp: 3, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.45 }, { type: 'buff', stat: 'atk', stages: -1, chance: 0.8 }],
      fx: 'pierce2', rank: 2, glim: { lv: 2, from: ['t_spear_butt'] },
    },
    t_spear_receive: {
      kind: 'tech', wtype: 'spear', name: '迎え槍', desc: '次の手番まで、攻めてきた敵を突き返す。', mp: 3, target: 'self', reach: true, quick: true,
      effects: [{ type: 'status', status: 'counter', power: 1.2 }],
      fx: 'stance', rank: 3, glim: { lv: 3, from: ['t_spear_butt'] },
    },
    t_spear_pierce: {
      kind: 'tech', wtype: 'spear', name: '徹し突き', desc: '守備力を半分無視して、深く突く。', mp: 5, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.75, ignoreDef: 0.5 }],
      fx: 'pierce2', rank: 4, glim: { lv: 4, from: ['t_spear_upthrust', 't_spear_skewer'] },
    },
    t_spear_cloud: {
      kind: 'tech', wtype: 'spear', name: '雲突き', desc: '空へ突き上げる。飛ぶ敵に大きなダメージ。', mp: 6, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2, vs: { flying: 2 } }],
      fx: 'pierce2', rank: 5, glim: { lv: 5, from: ['t_spear_upthrust'] },
    },
    t_spear_vault: {
      kind: 'tech', wtype: 'spear', name: 'かち上げ', desc: '石突きでかち上げ、気絶させることがある。', mp: 8, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2 }, { type: 'status', status: 'stun', chance: 0.4 }],
      fx: 'strike3', rank: 5, glim: { lv: 5, from: ['t_spear_butt', 't_spear_receive'] },
    },
    t_spear_ripple: {
      kind: 'tech', wtype: 'spear', name: 'さざ波突き', desc: 'さざ波のように、3回続けて突く。', mp: 8, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 0.84, hits: 3 }],
      fx: 'pierce2', rank: 6, glim: { lv: 6, from: ['t_spear_skewer', 't_spear_receive'] },
    },
    t_spear_whirl: {
      kind: 'tech', wtype: 'spear', name: '輪舞の槍', desc: '槍を回して敵全体を打ち、素早さを下げる。', mp: 9, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.2 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.5 }],
      fx: 'pierce3', rank: 6, glim: { lv: 6, from: ['t_spear_disarm', 't_spear_skewer'] },
    },
    t_spear_phalanx: {
      kind: 'tech', wtype: 'spear', name: '槍ぶすま', desc: '槍を次々に突き出し、敵全体を打つ。', mp: 11, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.42 }],
      fx: 'pierce3', rank: 7, glim: { lv: 7, from: ['t_spear_ripple'] },
    },
    t_spear_soar: {
      kind: 'tech', wtype: 'spear', name: '天翔ける槍', desc: '空高く跳び、守りを貫いて突き下ろす。', mp: 12, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2.4, ignoreDef: 0.5, vs: { flying: 1.5 } }],
      fx: 'pierce3', rank: 8, glim: { lv: 8, from: ['t_spear_cloud', 't_spear_pierce'] },
    },
    t_spear_heavennet: {
      kind: 'tech', wtype: 'spear', name: '天網の槍', desc: '敵全体を突き、まひさせることがある。', mp: 12, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.3 }, { type: 'status', status: 'paralyze', chance: 0.3 }],
      fx: 'pierce3', rank: 8, glim: { lv: 8, from: ['t_spear_whirl'] },
    },
    t_spear_surge: {
      kind: 'tech', wtype: 'spear', name: '荒波の槍', desc: '荒波のように、5回続けて突き刺す。', mp: 15, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 0.66, hits: 5 }],
      fx: 'pierce3', rank: 9, glim: { lv: 9, from: ['t_spear_ripple', 't_spear_soar'] },
    },
    t_spear_starpierce: {
      kind: 'tech', wtype: 'spear', name: '星貫き', desc: '星まで届く突きで、敵全体の守りを破る。', mp: 20, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.6, ignoreDef: 0.5 }],
      fx: 'pierce3', rank: 10, glim: { lv: 10, from: ['t_spear_surge'] },
    },
  });
})(window.RPG);
