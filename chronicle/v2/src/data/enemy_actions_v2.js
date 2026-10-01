// v2（BATTLE、2026-10-01 w_combo）: 雑魚の行動を増やした分（オーナー「もっともっとバリュエーション作ってよ」）。
//   e_ … 系統ごとの手の幅（構え〔打ち返し〕・ねらい〔回復役・後列・弱った人〕・捨て身・属性の色変わり・力を奪う 等）
//   ec_ … 合体技（DB.enemyCombos の steps が使う。2 体以上の手番を使うので、1 体の技より強い）
//   aim（行動のねらい。R.BattleAI.pickPartyTarget）: 'low' 弱った人・'healer' 回復の術を持つ人・'back' 後列・'caster' 魔力の高い人・'strong' 攻撃力の高い人
//   seq: 演出の表（R.BFX.seq）の id 'sq:<行>'。合体技の演出の行は enemy_combos.js が R.onData で足す
(function (R) {
  'use strict';
  const T = (id) => ({ name: R.T('enemyActions.' + id + '.name'), msg: R.T('enemyActions.' + id + '.msg') });
  const A = (id, o) => Object.assign({ kind: 'enemy' }, T(id), o);
  Object.assign(R.DB.enemyActions, {
    // ---------------------------------------------------------------- 手の幅（雑魚）
    e_guard_stance: A('e_guard_stance', { target: 'self', effects: [{ type: 'status', status: 'counter', power: 0.9 }], fx: 'buff' }),
    e_snipe: A('e_snipe', { target: 'enemy', aim: 'healer', effects: [{ type: 'damage', formula: 'phys', power: 1.25, kind: 'pierce' }], fx: 'pierce' }),
    e_ambush: A('e_ambush', { target: 'enemy', aim: 'back', effects: [{ type: 'damage', formula: 'phys', power: 1.25 }], fx: 'claw' }),
    e_finish: A('e_finish', { target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.15, critBonus: 10 }], fx: 'bite' }),
    e_weaken: A('e_weaken', { target: 'enemy', aim: 'strong', effects: [{ type: 'damage', formula: 'magic', power: 0.6, element: 'dark' }, { type: 'buff', stat: 'atk', stages: -1, chance: 0.7 }], fx: 'dark' }),
    e_armor_melt: A('e_armor_melt', { target: 'enemies', effects: [{ type: 'buff', stat: 'def', stages: -1, chance: 0.4 }], fx: 'debuff' }),
    e_war_dance: A('e_war_dance', { target: 'allies', effects: [{ type: 'buff', stat: 'atk', stages: 1 }, { type: 'buff', stat: 'agi', stages: 1 }], fx: 'buff' }),
    e_last_stand: A('e_last_stand', { target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 2 }, { type: 'buff', stat: 'def', stages: -1 }], fx: 'buff' }),
    e_elem_shift: A('e_elem_shift', { target: 'self', effects: [{ type: 'special', id: 'elem_shift' }], fx: 'buff' }),

    // ---------------------------------------------------------------- 合体技の行動（ec_）
    ec_pack_fang: A('ec_pack_fang', { target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.05, critBonus: 6 }], fx: 'bite' }),
    ec_root_snare: A('ec_root_snare', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.7 }, { type: 'status', status: 'paralyze', chance: 0.4 }], fx: 'strike' }),
    ec_thorn_bite: A('ec_thorn_bite', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.4 }, { type: 'status', status: 'poison', chance: 0.5 }], fx: 'bite' }),
    ec_bee_storm: A('ec_bee_storm', { target: 'random', effects: [{ type: 'damage', formula: 'phys', power: 0.45, hits: 6, kind: 'pierce' }, { type: 'status', status: 'poison', chance: 0.15 }], fx: 'pierce' }),
    ec_spore_dance: A('ec_spore_dance', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.45, element: 'wind' }, { type: 'status', status: 'sleep', chance: 0.22 }], fx: 'wind' }),
    ec_coil: A('ec_coil', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.8 }, { type: 'status', status: 'paralyze', chance: 0.3 }], fx: 'strike' }),
    ec_venom_tail: A('ec_venom_tail', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.3, kind: 'pierce' }, { type: 'status', status: 'poison', chance: 0.6 }], fx: 'pierce' }),
    ec_quicksand: A('ec_quicksand', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.7, element: 'earth' }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.6 }], fx: 'earth' }),
    ec_pin_arrow: A('ec_pin_arrow', { target: 'enemy', aim: 'back', effects: [{ type: 'damage', formula: 'phys', power: 1.0, kind: 'pierce' }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.7 }], fx: 'arrow' }),
    ec_hawk_slash: A('ec_hawk_slash', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'slash', critBonus: 15 }], fx: 'slash' }),
    ec_snow_veil: A('ec_snow_veil', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.45, element: 'water' }, { type: 'status', status: 'freeze', chance: 0.08 }], fx: 'ice' }),
    ec_ice_fang: A('ec_ice_fang', { target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.4, element: 'water' }], fx: 'ice' }),
    ec_avalanche: A('ec_avalanche', { target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 0.95, element: 'water' }, { type: 'status', status: 'stun', chance: 0.12 }], fx: 'ice2' }),
    ec_lull_song: A('ec_lull_song', { target: 'enemy', aim: 'strong', effects: [{ type: 'status', status: 'sleep', chance: 0.6 }], fx: 'song' }),
    ec_crushing_stomp: A('ec_crushing_stomp', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.9, acc: 1 }], fx: 'strike3' }),
    ec_tongue_grab: A('ec_tongue_grab', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.7, acc: 1.1 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.8 }], fx: 'strike' }),
    ec_pinned_thrust: A('ec_pinned_thrust', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'pierce', critBonus: 12 }], fx: 'pierce' }),
    ec_wisp_parade: A('ec_wisp_parade', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.75, element: 'dark' }, { type: 'status', status: 'burn', chance: 0.2 }], fx: 'dark2' }),
    ec_puppet_strings: A('ec_puppet_strings', { target: 'enemy', aim: 'strong', effects: [{ type: 'damage', formula: 'magic', power: 0.8, element: 'dark' }, { type: 'status', status: 'confuse', chance: 0.6 }], fx: 'dark' }),
    ec_whirlpool: A('ec_whirlpool', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.8, element: 'water' }, { type: 'status', status: 'blind', chance: 0.15 }], fx: 'water2' }),
    ec_grapple: A('ec_grapple', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.7 }, { type: 'status', status: 'paralyze', chance: 0.4 }], fx: 'strike' }),
    ec_point_blank: A('ec_point_blank', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.7, element: 'fire' }], fx: 'explosion' }),
    ec_goblin_cannon: A('ec_goblin_cannon', { target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 0.85, element: 'fire' }], fx: 'explosion' }),
    ec_tunnel: A('ec_tunnel', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.4, element: 'earth' }, { type: 'status', status: 'blind', chance: 0.2 }], fx: 'earth' }),
    ec_upthrust: A('ec_upthrust', { target: 'enemy', aim: 'back', effects: [{ type: 'damage', formula: 'phys', power: 1.7, kind: 'pierce', critBonus: 15 }], fx: 'pierce' }),
    ec_fire_tornado: A('ec_fire_tornado', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.85, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.2 }], fx: 'fire2' }),
    ec_dark_blessing: A('ec_dark_blessing', { target: 'ally', effects: [{ type: 'buff', stat: 'atk', stages: 2 }], fx: 'buff' }),
    ec_brute_smash: A('ec_brute_smash', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.8, acc: 0.95 }], fx: 'strike3' }),
    ec_hellfire: A('ec_hellfire', { target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 0.95, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.3 }], fx: 'breath_fire' }),
    ec_cross_slash: A('ec_cross_slash', { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 2.1, kind: 'slash', critBonus: 10 }], fx: 'slash' }),
    ec_charge_core: A('ec_charge_core', { target: 'ally', effects: [{ type: 'buff', stat: 'mag', stages: 2 }], fx: 'buff' }),
    ec_mana_cannon: A('ec_mana_cannon', { target: 'enemy', aim: 'caster', effects: [{ type: 'damage', formula: 'magic', power: 1.9, element: 'light' }], fx: 'holy2' }),
    ec_blank_page: A('ec_blank_page', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.6, mp: true }, { type: 'dispel', side: 'good' }, { type: 'status', status: 'silence', chance: 0.25 }], fx: 'dispel' }),
    ec_void_chaos: A('ec_void_chaos', { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 1.0, element: 'dark' }, { type: 'buff', stat: 'def', stages: -1, chance: 0.3 }], fx: 'dark3' }),
  });
})(window.RPG);
