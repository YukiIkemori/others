// 雪原（ユール・白竜の峰・寄り道）の品（RULES の形。WORLD_REDESIGN §4.3・§2.7 #11・#13、STORY_BIBLE §7.3）
//   伸びる一品物 u_*: 数値はもらったときのティア（items_unique.js と同じ決め方）。竜の牙の剣と竜の鱗のお守りは同じ強さの別の品（§3.5-2）。
//   大事な物 k_*: 支度の 3 つ・籠城・峰の火種・寄り道の依頼で使う。
(function (R) {
  'use strict';
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  R.defs('items', {
    // 竜と戦う／語る（どちらを選んでも同じ強さ）
    u_dragon_fang: U('weapon', R.T('items.u_dragon_fang.weapon'), { wtype: 'sword', units: 's2', mult: 1.25, crit: 3, vs: { dragon: 1.5 }, icon: 'sword',
      desc: R.T('items.u_dragon_fang.weapon.desc') }),
    u_dragon_scale: U('acc', R.T('items.u_dragon_scale.acc'), { mods: { elemResist: { water: 0.5, wind: 0.5 }, hpPct: 6 }, icon: 'ring',
      desc: R.T('items.u_dragon_scale.acc.desc') }),
    // つららの回廊（#11）・氷に閉じた帆船（#13）
    u_icicle_spear: U('weapon', R.T('items.u_icicle_spear.weapon'), { wtype: 'sword', units: 's2', mult: 1.15, hit: 6, element: 'water', icon: 'sword',
      desc: R.T('items.u_icicle_spear.weapon.desc') }),
    // 雪原は序盤〜中盤の手前。先制・レアの率・落とす率の品は置かない（持ち主の決まり）
    u_frost_compass: U('acc', R.T('items.u_frost_compass.acc'), { mods: { hpPct: 5, statusResist: { freeze: 1 }, elemResist: { water: 0.5 } }, icon: 'ring',
      desc: R.T('items.u_frost_compass.acc.desc') }),
    // 釣り大会の一等（段位ごとの品のいちばん上）
    u_ice_rod_charm: U('acc', R.T('items.u_ice_rod_charm.acc'), { mods: { elemResist: { water: 0.75 }, goldPct: 10 }, icon: 'ring',
      desc: R.T('items.u_ice_rod_charm.acc.desc') }),
    // 大事な物
    k_yule_logs: K(R.T('items.k_yule_logs.K'), R.T('items.k_yule_logs.K_2'), { icon: 'fire' }),
    k_ice_saw: K(R.T('items.k_ice_saw.K'), R.T('items.k_ice_saw.K_2'), { icon: 'key' }),
    k_ice_blocks: K(R.T('items.k_ice_blocks.K'), R.T('items.k_ice_blocks.K_2'), { icon: 'gem' }),
    k_blank_book: K(R.T('items.k_blank_book.K'), R.T('items.k_blank_book.K_2'), { icon: 'book' }),
    k_yule_ember: K(R.T('items.k_yule_ember.K'), R.T('items.k_yule_ember.K_2'), { icon: 'lamp' }),
    k_hotspring_key: K(R.T('items.k_hotspring_key.K'), R.T('items.k_hotspring_key.K_2'), { icon: 'key' }),
    k_fox_charm: K(R.T('items.k_fox_charm.K'), R.T('items.k_fox_charm.K_2'), { icon: 'search' }),
  });
})(window.RPG);
