// v2（BATTLE、2026-10-01 w_combo）: 雑魚の行動を増やした分（オーナー「もっともっとバリュエーション作ってよ」）。
//   e_ … 系統ごとの手の幅（構え〔打ち返し〕・ねらい〔回復役・後列・弱った人〕・捨て身・属性の色変わり・力を奪う 等）
//   ec_ … 合体技（DB.enemyCombos の steps が使う。2 体以上の手番を使うので、1 体の技より強い）
//   aim（行動のねらい。R.BattleAI.pickPartyTarget）: 'low' 弱った人・'healer' 回復の術を持つ人・'back' 後列・'caster' 魔力の高い人・'strong' 攻撃力の高い人
//   seq: 演出の表（R.BFX.seq）の id 'sq:<行>'。合体技の演出の行は enemy_combos.js が R.onData で足す
(function (R) {
  'use strict';
  const A = (name, msg, o) => Object.assign({ kind: 'enemy', name, msg }, o);
  Object.assign(R.DB.enemyActions, {
    // ---------------------------------------------------------------- 手の幅（雑魚）
    e_guard_stance: A(R.T('enemyActions.e_guard_stance.name'), R.T('enemyActions.e_guard_stance.msg'), { target: 'self', effects: [{ type: 'status', status: 'counter', power: 0.9 }], fx: 'buff' }),
    e_snipe: A(R.T('enemyActions.e_snipe.name'), R.T('enemyActions.e_snipe.msg'), { target: 'enemy', aim: 'healer', effects: [{ type: 'damage', formula: 'phys', power: 1.25, kind: 'pierce' }], fx: 'pierce' }),
    e_ambush: A(R.T('enemyActions.e_ambush.name'), R.T('enemyActions.e_ambush.msg'), { target: 'enemy', aim: 'back', effects: [{ type: 'damage', formula: 'phys', power: 1.25 }], fx: 'claw' }),
    e_finish: A(R.T('enemyActions.e_finish.name'), R.T('enemyActions.e_finish.msg'), { target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.15, critBonus: 10 }], fx: 'bite' }),
    e_weaken: A(R.T('enemyActions.e_weaken.name'), R.T('enemyActions.e_weaken.msg'), { target: 'enemy', aim: 'strong', effects: [{ type: 'damage', formula: 'magic', power: 0.6, element: 'dark' }, { type: 'buff', stat: 'atk', stages: -1, chance: 0.7 }], fx: 'dark' }),
    e_armor_melt: A(R.T('enemyActions.e_armor_melt.name'), R.T('enemyActions.e_armor_melt.msg'), { target: 'enemies', effects: [{ type: 'buff', stat: 'def', stages: -1, chance: 0.4 }], fx: 'debuff' }),
    e_war_dance: A(R.T('enemyActions.e_war_dance.name'), R.T('enemyActions.e_war_dance.msg'), { target: 'allies', effects: [{ type: 'buff', stat: 'atk', stages: 1 }, { type: 'buff', stat: 'agi', stages: 1 }], fx: 'buff' }),
    e_last_stand: A(R.T('enemyActions.e_last_stand.name'), R.T('enemyActions.e_last_stand.msg'), { target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 2 }, { type: 'buff', stat: 'def', stages: -1 }], fx: 'buff' }),
    e_elem_shift: A(R.T('enemyActions.e_elem_shift.name'), R.T('enemyActions.e_elem_shift.msg'), { target: 'self', effects: [{ type: 'special', id: 'elem_shift' }], fx: 'buff' }),

    // ---------------------------------------------------------------- 合体技の行動（ec_）
    ec_pack_fang: A(R.T('enemyActions.ec_pack_fang.name'), R.T('enemyActions.ec_pack_fang.msg'), { target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.05, critBonus: 6 }], fx: 'bite' }),
    ec_root_snare: A(R.T('enemyActions.ec_root_snare.name'), R.T('enemyActions.ec_root_snare.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.7 }, { type: 'status', status: 'paralyze', chance: 0.4 }], fx: 'strike' }),
    ec_thorn_bite: A(R.T('enemyActions.ec_thorn_bite.name'), R.T('enemyActions.ec_thorn_bite.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.4 }, { type: 'status', status: 'poison', chance: 0.5 }], fx: 'bite' }),
    ec_bee_storm: A(R.T('enemyActions.ec_bee_storm.name'), R.T('enemyActions.ec_bee_storm.msg'), { target: 'random', effects: [{ type: 'damage', formula: 'phys', power: 0.45, hits: 6, kind: 'pierce' }, { type: 'status', status: 'poison', chance: 0.15 }], fx: 'pierce' }),
    ec_spore_dance: A(R.T('enemyActions.ec_spore_dance.name'), R.T('enemyActions.ec_spore_dance.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.45, element: 'wind' }, { type: 'status', status: 'sleep', chance: 0.22 }], fx: 'wind' }),
    ec_coil: A(R.T('enemyActions.ec_coil.name'), R.T('enemyActions.ec_coil.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.8 }, { type: 'status', status: 'paralyze', chance: 0.3 }], fx: 'strike' }),
    ec_venom_tail: A(R.T('enemyActions.ec_venom_tail.name'), R.T('enemyActions.ec_venom_tail.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.3, kind: 'pierce' }, { type: 'status', status: 'poison', chance: 0.6 }], fx: 'pierce' }),
    ec_quicksand: A(R.T('enemyActions.ec_quicksand.name'), R.T('enemyActions.ec_quicksand.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.7, element: 'earth' }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.6 }], fx: 'earth' }),
    ec_pin_arrow: A(R.T('enemyActions.ec_pin_arrow.name'), R.T('enemyActions.ec_pin_arrow.msg'), { target: 'enemy', aim: 'back', effects: [{ type: 'damage', formula: 'phys', power: 1.0, kind: 'pierce' }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.7 }], fx: 'arrow' }),
    ec_hawk_slash: A(R.T('enemyActions.ec_hawk_slash.name'), R.T('enemyActions.ec_hawk_slash.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'slash', critBonus: 15 }], fx: 'slash' }),
    ec_snow_veil: A(R.T('enemyActions.ec_snow_veil.name'), R.T('enemyActions.ec_snow_veil.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.45, element: 'water' }, { type: 'status', status: 'freeze', chance: 0.08 }], fx: 'ice' }),
    ec_ice_fang: A(R.T('enemyActions.ec_ice_fang.name'), R.T('enemyActions.ec_ice_fang.msg'), { target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.4, element: 'water' }], fx: 'ice' }),
    ec_avalanche: A(R.T('enemyActions.ec_avalanche.name'), R.T('enemyActions.ec_avalanche.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 0.95, element: 'water' }, { type: 'status', status: 'stun', chance: 0.12 }], fx: 'ice2' }),
    ec_lull_song: A(R.T('enemyActions.ec_lull_song.name'), R.T('enemyActions.ec_lull_song.msg'), { target: 'enemy', aim: 'strong', effects: [{ type: 'status', status: 'sleep', chance: 0.6 }], fx: 'song' }),
    ec_crushing_stomp: A(R.T('enemyActions.ec_crushing_stomp.name'), R.T('enemyActions.ec_crushing_stomp.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.9, acc: 1 }], fx: 'strike3' }),
    ec_tongue_grab: A(R.T('enemyActions.ec_tongue_grab.name'), R.T('enemyActions.ec_tongue_grab.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.7, acc: 1.1 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.8 }], fx: 'strike' }),
    ec_pinned_thrust: A(R.T('enemyActions.ec_pinned_thrust.name'), R.T('enemyActions.ec_pinned_thrust.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'pierce', critBonus: 12 }], fx: 'pierce' }),
    ec_wisp_parade: A(R.T('enemyActions.ec_wisp_parade.name'), R.T('enemyActions.ec_wisp_parade.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.75, element: 'dark' }, { type: 'status', status: 'burn', chance: 0.2 }], fx: 'dark2' }),
    ec_puppet_strings: A(R.T('enemyActions.ec_puppet_strings.name'), R.T('enemyActions.ec_puppet_strings.msg'), { target: 'enemy', aim: 'strong', effects: [{ type: 'damage', formula: 'magic', power: 0.8, element: 'dark' }, { type: 'status', status: 'confuse', chance: 0.6 }], fx: 'dark' }),
    ec_whirlpool: A(R.T('enemyActions.ec_whirlpool.name'), R.T('enemyActions.ec_whirlpool.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.8, element: 'water' }, { type: 'status', status: 'blind', chance: 0.15 }], fx: 'water2' }),
    ec_grapple: A(R.T('enemyActions.ec_grapple.name'), R.T('enemyActions.ec_grapple.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 0.7 }, { type: 'status', status: 'paralyze', chance: 0.4 }], fx: 'strike' }),
    ec_point_blank: A(R.T('enemyActions.ec_point_blank.name'), R.T('enemyActions.ec_point_blank.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.7, element: 'fire' }], fx: 'explosion' }),
    ec_goblin_cannon: A(R.T('enemyActions.ec_goblin_cannon.name'), R.T('enemyActions.ec_goblin_cannon.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 0.85, element: 'fire' }], fx: 'explosion' }),
    ec_tunnel: A(R.T('enemyActions.ec_tunnel.name'), R.T('enemyActions.ec_tunnel.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.4, element: 'earth' }, { type: 'status', status: 'blind', chance: 0.2 }], fx: 'earth' }),
    ec_upthrust: A(R.T('enemyActions.ec_upthrust.name'), R.T('enemyActions.ec_upthrust.msg'), { target: 'enemy', aim: 'back', effects: [{ type: 'damage', formula: 'phys', power: 1.7, kind: 'pierce', critBonus: 15 }], fx: 'pierce' }),
    ec_fire_tornado: A(R.T('enemyActions.ec_fire_tornado.name'), R.T('enemyActions.ec_fire_tornado.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.85, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.2 }], fx: 'fire2' }),
    ec_dark_blessing: A(R.T('enemyActions.ec_dark_blessing.name'), R.T('enemyActions.ec_dark_blessing.msg'), { target: 'ally', effects: [{ type: 'buff', stat: 'atk', stages: 2 }], fx: 'buff' }),
    ec_brute_smash: A(R.T('enemyActions.ec_brute_smash.name'), R.T('enemyActions.ec_brute_smash.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.8, acc: 0.95 }], fx: 'strike3' }),
    ec_hellfire: A(R.T('enemyActions.ec_hellfire.name'), R.T('enemyActions.ec_hellfire.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 0.8, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.25 }], fx: 'breath_fire' }),
    ec_cross_slash: A(R.T('enemyActions.ec_cross_slash.name'), R.T('enemyActions.ec_cross_slash.msg'), { target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 2.1, kind: 'slash', critBonus: 10 }], fx: 'slash' }),
    ec_charge_core: A(R.T('enemyActions.ec_charge_core.name'), R.T('enemyActions.ec_charge_core.msg'), { target: 'ally', effects: [{ type: 'buff', stat: 'mag', stages: 2 }], fx: 'buff' }),
    ec_mana_cannon: A(R.T('enemyActions.ec_mana_cannon.name'), R.T('enemyActions.ec_mana_cannon.msg'), { target: 'enemy', aim: 'caster', effects: [{ type: 'damage', formula: 'magic', power: 1.9, element: 'light' }], fx: 'holy2' }),
    ec_blank_page: A(R.T('enemyActions.ec_blank_page.name'), R.T('enemyActions.ec_blank_page.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.5, element: 'light' }, { type: 'dispel', side: 'good' }], fx: 'dispel' }),
    ec_void_chaos: A(R.T('enemyActions.ec_void_chaos.name'), R.T('enemyActions.ec_void_chaos.msg'), { target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 1.0, element: 'dark' }, { type: 'buff', stat: 'def', stages: -1, chance: 0.3 }], fx: 'dark3' }),
  });
})(window.RPG);
