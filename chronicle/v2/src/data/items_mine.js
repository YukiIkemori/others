// RULES・EVENTS（ガルド山地）: 山地の大事な物・一品物（WORLD_REDESIGN §4.6・§2.7 #15、STORY_BIBLE §7.6）。
//   大事な物 k_*（1 つだけ・売れない）: 坑夫の灯油（坑夫のカンテラの依頼）・碑文の古い写し（隠者の庵。鍛冶衆の仕事）。
//     誓いのハンマー k_oath_hammer は items_key.js（前からある）。
//   伸びる一品物 u_*（数値は手に入れたときのティア）: 選んだ道の礼（どれも同じ強さの別の品。§3.5-2）
//     組合 = 組合のつるはし・鍛冶衆 = 誓いの槌・仲裁 = 和解の指輪。
//     隠者の問答の礼 = 隠者の数珠（閃きやすさを少し上げる）・坑夫のカンテラの礼 = 坑夫の守り灯。
//   山地は好きな順で来られる: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ）。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  let n = 0;
  const KEYS = {
    k_mine_oil: K(R.T('data.items_mine.KEYS.k_mine_oil.K'), R.T('data.items_mine.KEYS.k_mine_oil.K_2'), { icon: 'lamp' }),
    k_oath_copy: K(R.T('data.items_mine.KEYS.k_oath_copy.K'), R.T('data.items_mine.KEYS.k_oath_copy.K_2'), { icon: 'journal' }),
  };
  for (const id of Object.keys(KEYS)) { KEYS[id].sort = 9600 + n++; R.def('items', id, KEYS[id]); }

  R.defs('items', {
    // 選んだ道の礼（同じ強さの別の品）
    u_guild_pick: U('weapon', R.T('items.u_guild_pick.weapon'), { wtype: 'greatsword', units: 's1v1', kind: 'pierce', art: 'club', mult: 1.3, crit: 4, vs: { construct: 1.5 }, icon: 'greatsword',
      desc: R.T('items.u_guild_pick.weapon.desc') }),
    u_oath_hammer: U('weapon', R.T('items.u_oath_hammer.weapon'), { wtype: 'greatsword', units: 's1v1', kind: 'blunt', art: 'club', mult: 1.3, hit: 6, mods: { elemBoost: { fire: 15 } }, icon: 'greatsword',
      desc: R.T('items.u_oath_hammer.weapon.desc') }),
    u_accord_ring: U('acc', R.T('items.u_accord_ring.acc'), { mods: { hpPct: 6, mpPct: 6, statusResist: { confuse: 0.5 } }, icon: 'ring',
      desc: R.T('items.u_accord_ring.acc.desc') }),
    // 山の隠者の庵（#15）の問答
    u_hermit_beads: U('acc', R.T('items.u_hermit_beads.acc'), { mods: { glimPct: { tech: 8, spell: 8 } }, icon: 'ring',
      desc: R.T('items.u_hermit_beads.acc.desc') }),
    // 坑夫のカンテラ（灯りを守る）の礼
    u_miner_lamp: U('acc', R.T('items.u_miner_lamp.acc'), { mods: { encounterPct: -10, statusResist: { blind: 1 } }, icon: 'ring',
      desc: R.T('items.u_miner_lamp.acc.desc') }),
  });
})(window.RPG);
