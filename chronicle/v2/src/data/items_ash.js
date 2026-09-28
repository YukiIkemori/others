// RULES・EVENTS（灰の荒野）: 灰の荒野の大事な物・一品物（WORLD_REDESIGN §4.7、STORY_BIBLE §7.7）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）。
//   闘士の帯（八百長を断った: 族長ドルガから）と、壁画の残り火（受けた: 巫女カヤから）は同じ強さの別の品（§3.5-2）。
//   灰の荒野は好きな順で来られる（T1 から）: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ）。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  R.defs('items', {
    u_champion_belt: U('acc', '闘士の帯', { mods: { statusResist: { burn: 1, stun: 0.5 }, hpPct: 5 }, icon: 'ring',
      desc: 'やけどしない。気絶しにくい。\n最大HPが上がる。炎の試練の勝者の帯。' }),
    u_mural_ember: U('acc', '壁画の残り火', { mods: { statusResist: { burn: 1, silence: 0.5 }, hpPct: 5 }, icon: 'ring',
      desc: 'やけどしない。沈黙しにくい。\n最大HPが上がる。白くならずに済んだ\n壁画の、赤い顔料のかけら。' }),
    // 大事な物
    k_arena_token: K('出場の札', '炎の試練（闘技大会）の出場の札。\n裏に、受付の焼き印。', { icon: 'key' }),
    k_seed_fire: K('神殿の種火', '火の神殿の種火を分けた、\n小さな素焼きの火つぼ。', { icon: 'lamp' }),
    k_phoenix_plume: K('火の鳥の羽', 'かえった火の鳥の、赤金の羽。\n神殿の止まり木で、火の鳥の背に\n乗せてもらえる。', { icon: 'fire' }),
    k_spa_salt: K('湯の花', '湯の郷の岩の割れ目で採れる、\n白い湯の花。', { icon: 'bag' }),
  });
})(window.RPG);
