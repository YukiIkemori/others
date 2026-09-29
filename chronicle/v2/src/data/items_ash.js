// RULES・EVENTS（灰の荒野）: 灰の荒野の大事な物・一品物（WORLD_REDESIGN §4.7、STORY_BIBLE §7.7）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）。
//   闘士の帯（八百長を断った: 族長ドルガから）と、壁画の残り火（受けた: 巫女カヤから）は同じ強さの別の品（§3.5-2）。
//   灰の荒野は好きな順で来られる（T1 から）: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ）。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  R.defs('items', {
    u_champion_belt: U('acc', R.T('items.u_champion_belt.acc'), { mods: { statusResist: { burn: 1, stun: 0.5 }, hpPct: 5 }, icon: 'ring',
      desc: R.T('items.u_champion_belt.acc.desc') }),
    u_mural_ember: U('acc', R.T('items.u_mural_ember.acc'), { mods: { statusResist: { burn: 1, silence: 0.5 }, hpPct: 5 }, icon: 'ring',
      desc: R.T('items.u_mural_ember.acc.desc') }),
    // 大事な物
    k_arena_token: K(R.T('items.k_arena_token.K'), R.T('items.k_arena_token.K_2'), { icon: 'key' }),
    k_seed_fire: K(R.T('items.k_seed_fire.K'), R.T('items.k_seed_fire.K_2'), { icon: 'lamp' }),
    k_phoenix_plume: K(R.T('items.k_phoenix_plume.K'), R.T('items.k_phoenix_plume.K_2'), { icon: 'fire' }),
    k_spa_salt: K(R.T('items.k_spa_salt.K'), R.T('items.k_spa_salt.K_2'), { icon: 'bag' }),
  });
})(window.RPG);
