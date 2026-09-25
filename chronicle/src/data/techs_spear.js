// src/data/techs_spear.js — 槍の技 11個（担当 techs。§6.8 の正本）
(function (R) {
  'use strict';
  Object.assign(R.DB.actions, {
    t_spear_upthrust: {
      kind: 'tech', wtype: 'spear', name: '突き上げ', desc: '下から鋭く突き上げる。飛ぶ敵に強い。', wp: 1, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.45, vs: { flying: 1.5 } }],
      fx: 'pierce', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_spear_butt: {
      kind: 'tech', wtype: 'spear', name: '石突き', desc: '石突きで打ち、気絶させることがある。', wp: 1, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.25, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.3 }],
      fx: 'strike', rank: 1, glim: { lv: 1, from: ['attack'] },
    },
    t_spear_skewer: {
      kind: 'tech', wtype: 'spear', name: '穂先払い', desc: 'ひと群れの敵を、まとめて突き払う。', wp: 3, target: 'group', reach: true,
      effects: [{ type: 'damage', power: 1.1 }],
      fx: 'pierce2', rank: 2, glim: { lv: 2, from: ['t_spear_upthrust'] },
    },
    t_spear_receive: {
      kind: 'tech', wtype: 'spear', name: '迎え槍', desc: '次の手番まで、攻めてきた敵を突き返す。', wp: 2, target: 'self', reach: true, quick: true,
      effects: [{ type: 'status', status: 'counter', power: 1.2 }],
      fx: 'stance', rank: 3, glim: { lv: 3, from: ['t_spear_butt'] },
    },
    t_spear_pierce: {
      kind: 'tech', wtype: 'spear', name: '徹し突き', desc: '守備力を半分無視して、深く突く。', wp: 3, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 1.75, ignoreDef: 0.5 }],
      fx: 'pierce2', rank: 4, glim: { lv: 4, from: ['t_spear_upthrust', 't_spear_skewer'] },
    },
    t_spear_cloud: {
      kind: 'tech', wtype: 'spear', name: '雲突き', desc: '空へ突き上げる。飛ぶ敵に大きなダメージ。', wp: 4, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2, vs: { flying: 2 } }],
      fx: 'pierce2', rank: 5, glim: { lv: 5, from: ['t_spear_upthrust'] },
    },
    t_spear_ripple: {
      kind: 'tech', wtype: 'spear', name: 'さざ波突き', desc: 'さざ波のように、3回続けて突く。', wp: 5, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 0.84, hits: 3 }],
      fx: 'pierce2', rank: 6, glim: { lv: 6, from: ['t_spear_skewer', 't_spear_receive'] },
    },
    t_spear_phalanx: {
      kind: 'tech', wtype: 'spear', name: '槍ぶすま', desc: '槍を次々に突き出し、敵全体を打つ。', wp: 7, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.42 }],
      fx: 'pierce3', rank: 7, glim: { lv: 7, from: ['t_spear_ripple'] },
    },
    t_spear_soar: {
      kind: 'tech', wtype: 'spear', name: '天翔ける槍', desc: '空高く跳び、守りを貫いて突き下ろす。', wp: 8, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 2.4, ignoreDef: 0.5, vs: { flying: 1.5 } }],
      fx: 'pierce3', rank: 8, glim: { lv: 8, from: ['t_spear_cloud', 't_spear_pierce'] },
    },
    t_spear_surge: {
      kind: 'tech', wtype: 'spear', name: '荒波の槍', desc: '荒波のように、5回続けて突き刺す。', wp: 10, target: 'enemy', reach: true,
      effects: [{ type: 'damage', power: 0.66, hits: 5 }],
      fx: 'pierce3', rank: 9, glim: { lv: 9, from: ['t_spear_ripple', 't_spear_soar'] },
    },
    t_spear_starpierce: {
      kind: 'tech', wtype: 'spear', name: '星貫き', desc: '星まで届く突きで、敵全体の守りを破る。', wp: 13, target: 'enemies', reach: true,
      effects: [{ type: 'damage', power: 1.6, ignoreDef: 0.5 }],
      fx: 'pierce3', rank: 10, glim: { lv: 10, from: ['t_spear_surge'] },
    },
  });
})(window.RPG);
