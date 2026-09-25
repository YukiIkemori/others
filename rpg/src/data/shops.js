// Shops: <location>_item / _weapon / _armor for every town (DESIGN §7.4).
// Inventories follow each location's level band (see the band notes in items.js):
//   regnas 1-3 · milt 2-5 · porta 6-9 · elfin 11-15 · salva 14-18 · frost 18-22 · arcana 25-30 · edge_shrine 31+
// Elemental stock is chosen for the next dungeon: elfin → thunder (water cave),
// salva → fire (pyramid undead), frost → ice/fire guards (ice cave, volcano),
// edge_shrine → holy silver (demon castle). rare:true items are never sold.
(function (R) {
  'use strict';
  const ITEM = '道具屋', WEAPON = '武器屋', ARMOR = '防具屋';

  Object.assign(R.DB.shops, {
    // regnas — castle town (Lv1-3)
    regnas_item: { name: ITEM, items: ['herb', 'antidote', 'smoke_bomb', 'holy_water', 'wing', 'escape_rope'] },
    regnas_weapon: { name: WEAPON, items: ['copper_sword', 'copper_spear', 'copper_knife', 'oak_staff', 'wooden_rod', 'apprentice_rod'] },
    regnas_armor: { name: ARMOR, items: ['bronze_armor', 'leather_vest', 'traveler_clothes', 'cloth_robe', 'bronze_helm', 'cloth_hat', 'oak_shield'] },

    // milt — village (Lv2-5)
    milt_item: { name: ITEM, items: ['herb', 'antidote', 'eye_drop', 'smelling_salts', 'fire_bomb', 'smoke_bomb', 'holy_water', 'wing', 'escape_rope'] },
    milt_weapon: { name: WEAPON, items: ['iron_sword', 'hand_axe', 'iron_spear', 'dagger', 'beast_claw', 'short_bow', 'copper_staff', 'wood_harp'] },
    milt_armor: { name: ARMOR, items: ['chain_mail', 'hard_leather', 'apprentice_robe', 'iron_helm', 'leather_hood', 'bronze_shield'] },

    // porta — port town (Lv6-9)
    porta_item: { name: ITEM, items: ['herb', 'healing_grass', 'mana_drop', 'antidote', 'smelling_salts', 'numb_cure', 'revive_feather', 'fire_bomb', 'sleep_powder', 'holy_water', 'wing', 'escape_rope'] },
    porta_weapon: { name: WEAPON, items: ['bastard_sword', 'battle_axe', 'partisan', 'viper_knife', 'iron_knuckle', 'long_bow', 'priest_staff', 'opal_rod', 'sleep_harp'] },
    porta_armor: { name: ARMOR, items: ['iron_armor', 'kenpo_gi', 'silk_robe', 'knight_helm', 'pointy_hat', 'iron_shield', 'power_bracer', 'magic_ring', 'escape_shoes', 'poison_bell'] },

    // elfin — forest village (Lv11-15)
    elfin_item: { name: ITEM, items: ['herb', 'healing_grass', 'mana_drop', 'antidote', 'throat_drop', 'all_cure', 'revive_feather', 'ice_bomb', 'sleep_powder', 'holy_water', 'wing', 'escape_rope'] },
    elfin_weapon: { name: WEAPON, items: ['silver_sword', 'great_axe', 'thunder_spear', 'silver_dagger', 'wakizashi', 'silver_claw', 'silver_bow', 'silver_staff', 'topaz_rod', 'fairy_harp'] },
    elfin_armor: { name: ARMOR, items: ['silver_armor', 'forest_garb', 'fairy_robe', 'silver_helm', 'circlet', 'silver_shield', 'iron_ring', 'wake_brooch', 'thief_glove', 'vigor_shoes'] },

    // salva — desert town (Lv14-18)
    salva_item: { name: ITEM, items: ['healing_grass', 'healing_aroma', 'mana_drop', 'antidote', 'all_cure', 'revive_feather', 'ice_bomb', 'courage_flute', 'guard_bell', 'holy_water', 'wing', 'escape_rope'] },
    salva_weapon: { name: WEAPON, items: ['flamberge', 'whirl_axe', 'halberd', 'slumber_dagger', 'shigure', 'tiger_claw', 'flame_bow', 'sun_staff', 'ruby_rod', 'bewilder_harp'] },
    salva_armor: { name: ARMOR, items: ['knight_armor', 'sand_mantle', 'moon_robe', 'great_helm', 'turban', 'kite_shield', 'rosary', 'tiger_fang', 'free_bracelet', 'mana_pierce'] },

    // frost — snow village (Lv18-22)
    frost_item: { name: ITEM, items: ['healing_grass', 'nectar', 'healing_aroma', 'mana_drop', 'all_cure', 'revive_feather', 'thunder_bomb', 'courage_flute', 'guard_bell', 'holy_water', 'wing', 'escape_rope'] },
    frost_weapon: { name: WEAPON, items: ['platinum_sword', 'giant_axe', 'platinum_spear', 'platinum_dagger', 'kogarashi', 'flame_claw', 'platinum_bow', 'platinum_staff', 'diamond_rod', 'platinum_harp'] },
    frost_armor: { name: ARMOR, items: ['platinum_armor', 'silk_coat', 'glacier_robe', 'platinum_helm', 'fur_hat', 'platinum_shield', 'glacier_shield', 'frost_ring', 'fire_ring', 'life_belt', 'wind_bracelet'] },

    // arcana — city of magic (Lv25-30)
    arcana_item: { name: ITEM, items: ['nectar', 'healing_aroma', 'mana_drop', 'mana_crystal', 'all_cure', 'revive_feather', 'thunder_bomb', 'mega_bomb', 'courage_flute', 'guard_bell', 'holy_water', 'wing', 'escape_rope'] },
    arcana_weapon: { name: WEAPON, items: ['stardust_sword', 'thunder_axe', 'stardust_spear', 'stardust_dagger', 'oborozuki', 'raijin_claw', 'stardust_bow', 'starseer_staff', 'stardust_rod', 'star_harp'] },
    arcana_armor: { name: ARMOR, items: ['stardust_armor', 'gale_garb', 'starseer_robe', 'stardust_helm', 'star_crown', 'stardust_shield', 'star_earring', 'barrier_charm', 'thunder_ring', 'calm_ring', 'voice_bell', 'eagle_eye'] },

    // edge_shrine — shrine at the world's end (Lv31+), last safe spot before the demon castle
    edge_shrine_item: { name: ITEM, items: ['nectar', 'healing_aroma', 'mana_crystal', 'all_cure', 'revive_feather', 'mega_bomb', 'courage_flute', 'guard_bell', 'holy_water', 'wing', 'escape_rope'] },
    edge_shrine_weapon: { name: WEAPON, items: ['holy_sword', 'crimson_axe', 'holy_spear', 'holy_dagger', 'izayoi', 'holy_claw', 'holy_bow', 'saint_staff', 'mystic_rod', 'holy_harp'] },
    edge_shrine_armor: { name: ARMOR, items: ['holy_armor', 'holy_vest', 'holy_robe', 'holy_helm', 'light_crown', 'holy_shield', 'ward_ring', 'life_charm'] },
  });
})(window.RPG);
