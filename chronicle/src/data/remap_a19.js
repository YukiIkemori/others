// Old-save id table of the systems rework (BRIEF A17 / A18 / A19; design/build/SYSTEMS_REWORK.md §3.9).
// Owner: rules. Data only: R.State.deserialize applies it once to a save with g.rev < 19 (state.js).
// The table is for saves only — data files refer to the new ids directly.
//   items    old item id → new id (renamed items, and the stand-in for every removed one)
//   actions  old tech id → new id (moved techs, and the stand-in for the 13 removed ones)
//   wtypes   removed weapon type → the type its proficiency points go to (max of the two)
//   favor    removed weapon type → the hero's new favor (the first favorOptions.weapon when not offered)
(function (R) {
  'use strict';
  const items = {
    // 刀 → 剣 (§3.2)
    w_katana_uchi: 'w_sword_uchi',
    w_katana_r1: 'w_sword_r1', w_katana_r3: 'w_sword_r3',
    w_katana_r5: 'w_sword_r5k', w_katana_r7: 'w_sword_r7k', w_katana_r9: 'w_sword_r9k',
    w_katana_sand: 'w_sword_sand', w_katana_moon: 'w_sword_moon', w_katana_tide: 'w_sword_tide', w_katana_ash: 'w_sword_ash',
    w_katana_sr_crimson: 'w_sword_sr_crimson', w_katana_sr_snowgeneral: 'w_sword_sr_snowgeneral',
    w_katana_sr_matsuyoi: 'w_sword_sr_matsuyoi', w_katana_sr_clockwork: 'w_sword_sr_clockwork',
    w_katana_sr_platinum: 'w_sword_sr_platinum', w_katana_sr_dreamcut: 'w_sword_sr_dreamcut',
    // 棍棒 → 斧（打撃のメイス系列）
    w_club_wood: 'w_axe_cudgel',
    w_club_r1: 'w_axe_r1m', w_club_r3: 'w_axe_r3m', w_club_r5: 'w_axe_r5m', w_club_r7: 'w_axe_r7m', w_club_r9: 'w_axe_r9m',
    w_club_ashen: 'w_axe_ashen', w_club_rat: 'w_axe_rat', w_club_forgehammer: 'w_axe_forgehammer',
    w_club_sr_wander: 'w_axe_sr_wander', w_club_sr_goblin: 'w_axe_sr_goblinclub', w_club_sr_toadstool: 'w_axe_sr_toadstool',
    w_club_sr_bullfrog: 'w_axe_sr_bullfrog', w_club_sr_ironore: 'w_axe_sr_ironore', w_club_sr_cactus_king: 'w_axe_sr_cactusking',
    // 体術
    w_fist_leather: 'w_dagger_iron',
    w_fist_r1: 'w_dagger_r1', w_fist_r3: 'w_dagger_r3', w_fist_r5: 'w_dagger_r5', w_fist_r7: 'w_dagger_r7', w_fist_r9: 'w_dagger_r9',
    w_fist_sr_greywolf: 'w_dagger_sr_greywolf', w_fist_sr_icicle_child: 'w_dagger_sr_icicle', w_fist_sr_scorpion: 'w_dagger_sr_scorptail',
    w_fist_sr_ironclaw: 'w_dagger_sr_ironclaw', w_fist_wormtooth: 'w_dagger_wormtooth', w_fist_sr_triple_fang: 'w_dagger_sr_triplefang',
    w_fist_wolfking: 'w_dagger_wolfking',
    w_fist_sr_crabclaw: 'w_axe_sr_crabclaw', w_fist_sr_yeti: 'w_axe_sr_yeti', w_fist_brimstone: 'w_axe_brimstone',
    // 鞭
    w_whip_leather: 'w_dagger_iron',
    w_whip_r1: 'w_dagger_r1', w_whip_r3: 'w_dagger_r3', w_whip_r5: 'w_dagger_r5', w_whip_r7: 'w_dagger_r7', w_whip_r9: 'w_dagger_r9',
    w_whip_sr_vine: 'w_bow_sr_vine', w_whip_snakeskin: 'w_bow_snakeskin', w_whip_sr_spidersilk: 'w_bow_sr_spidersilk',
    w_whip_sr_python: 'w_bow_sr_python',
    w_whip_mist: 'w_spear_mist', w_whip_sr_venomjelly: 'w_spear_sr_venomjelly', w_whip_sr_chain_curse: 'w_spear_sr_chaincurse',
    w_whip_sr_eightarm: 'w_spear_sr_eightarm', w_whip_sr_quicksilver: 'w_spear_sr_quicksilver',
    w_whip_sr_reaper: 'w_dagger_sr_reaper', w_whip_sr_silk: 'w_dagger_sr_silk',
    // 腕章・道具 (§3.8, §2.5)
    ac_badge_katana: 'ac_badge_sword', ac_badge_club: 'ac_badge_axe', ac_badge_fist: 'ac_badge_axe', ac_badge_whip: 'ac_badge_dagger',
    i_tonic: 'i_ether', i_seed_wp: 'i_seed_mp',
  };
  // the normal lines: w_katana_1..9 → w_sword_1..9 (removed), w_club_1..9 → w_axe_mace_1..9 (renamed),
  // w_fist_1..9 / w_whip_1..9 → w_dagger_1..9 (removed)
  for (let i = 1; i <= 9; i++) {
    items['w_katana_' + i] = 'w_sword_' + i;
    items['w_club_' + i] = 'w_axe_mace_' + i;
    items['w_fist_' + i] = 'w_dagger_' + i;
    items['w_whip_' + i] = 'w_dagger_' + i;
  }

  const actions = {
    // moved (§3.4)
    t_katana_draw: 't_sword_draw', t_katana_mine: 't_sword_mine', t_katana_haze: 't_sword_haze',
    t_katana_void: 't_sword_void', t_katana_lifecut: 't_sword_lifecut', t_katana_first: 't_sword_first',
    t_fist_willow: 't_greatsword_parry', t_club_smash: 't_greatsword_helmsplit', t_club_shatter: 't_greatsword_shatter',
    t_club_diamond: 't_greatsword_adamant',
    t_whip_bind: 't_dagger_numb', t_fist_knee: 't_dagger_pommel', t_whip_serpent: 't_dagger_serpent', t_fist_hail: 't_dagger_hail',
    t_club_crumble: 't_axe_crumble', t_club_tremor: 't_axe_tremor', t_club_bell: 't_axe_bell', t_club_strip: 't_axe_strip',
    t_club_thunder: 't_axe_thunder',
    t_whip_disarm: 't_spear_disarm', t_fist_throw: 't_spear_vault', t_whip_coil: 't_spear_whirl', t_whip_net: 't_spear_heavennet',
    t_whip_trip: 't_bow_hobble', t_whip_thorn: 't_bow_venom', t_whip_sparks: 't_bow_firerain', t_whip_twilight: 't_bow_dusk',
    t_club_wrist: 't_staff_weaken', t_fist_breath: 't_staff_calm', t_fist_farstrike: 't_staff_bolt', t_club_rumble: 't_staff_rumble',
    // removed (13) → a stand-in
    t_katana_fold: 't_sword_twin', t_katana_riposte: 't_sword_guard', t_katana_steel: 't_sword_thrust',
    t_katana_leaves: 't_sword_triple', t_katana_dash: 't_sword_wheel',
    t_fist_palm: 't_axe_cleave', t_fist_onetwo: 't_axe_woodcut', t_fist_wolves: 't_dagger_dance', t_fist_eightfold: 't_dagger_dance',
    t_fist_empty: 't_axe_giant',
    t_whip_sweep: 't_spear_skewer', t_whip_snatch: 't_dagger_filch',
    t_club_upheaval: 't_axe_giant',
  };

  R.DB.remap = {
    rev: 19,
    items,
    actions,
    wtypes: { katana: 'sword', club: 'axe', fist: 'axe', whip: 'dagger' },
    favor: { katana: 'sword', club: 'axe', fist: 'axe', whip: 'dagger' },
  };
})(window.RPG);
