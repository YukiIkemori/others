// RULES・EVENTS（湿原）: グレイモア湿原の大事な物・一品物（WORLD_REDESIGN §4.4、STORY_BIBLE §7.4）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）。
//   探偵の帽子（一度で正しく名指しした）と、わびの鈴（間違えて名指しした後の町のおわび）は同じ強さの別の品（§3.5-2）。
//   湿原はどのティアでも来られる（T1 から）: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ）。探偵の帽子は「見抜く」守りにした。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  R.defs('items', {
    u_sleuth_hat: U('head', R.T('items.u_sleuth_hat.head'), { weight: 'light', mods: { statusResist: { confuse: 1, blind: 0.5 }, hpPct: 4 }, icon: 'helm',
      desc: R.T('items.u_sleuth_hat.head.desc') }),
    u_apology_bell: U('acc', R.T('items.u_apology_bell.acc'), { mods: { statusResist: { sleep: 1, blind: 0.5 }, hpPct: 4 }, icon: 'ring',
      desc: R.T('items.u_apology_bell.acc.desc') }),
    // 大事な物
    k_bell_key: K(R.T('items.k_bell_key.K'), R.T('items.k_bell_key.K_2'), { icon: 'key' }),
    k_blank_score: K(R.T('items.k_blank_score.K'), R.T('items.k_blank_score.K_2'), { icon: 'book' }),
    k_ink_score: K(R.T('items.k_ink_score.K'), R.T('items.k_ink_score.K_2'), { icon: 'book' }),
    k_lost_cat: K(R.T('items.k_lost_cat.K'), R.T('items.k_lost_cat.K_2'), { icon: 'bag' }),
    k_canal_oil: K(R.T('items.k_canal_oil.K'), R.T('items.k_canal_oil.K_2'), { icon: 'lamp' }),
  });
})(window.RPG);
