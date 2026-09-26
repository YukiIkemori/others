// Boss art roster for the art-boss tools (A15a): sheet_bosses.js, test_art-boss.js,
// check_art-boss.js. Transcribed from DESIGN §9.11.4 (names, sprites, troops,
// backdrops) and §9.11.6 (sizes). CommonJS; not loaded by the game.
(function () {
'use strict';

// sprite id → [backdrop, display name, [w, h], kind, flying]
//   kind: 'new' (drawn in bosses_b.js), 'crest' (bosses.js as is), 'compose' (bosses_compose.js)
const SPRITES = {
  boss_pageeater: ['tower', 'ページ食らい', [80, 64], 'new'],
  boss_moth: ['forest', 'ダストウィング', [96, 80], 'new', true],
  boss_rooteater: ['tree', '根食らい', [96, 80], 'new'],
  boss_root: ['tree', '根の触手', [48, 48], 'new'],
  b_sandworm: ['pyramid', '砂もぐり', [96, 80], 'compose'],
  b_sandking: ['pyramid', '名なき砂の王', [96, 96], 'compose'],
  boss_frost_giant: ['ice', '氷壁の巨人', [96, 96], 'crest'],
  boss_whitedragon: ['snow', '白竜ネーヴェ', [112, 96], 'new', true],
  b_doll_conductor: ['manor', '指揮者人形', [48, 48], 'compose'],
  b_doll_violin: ['manor', '弦ひき人形', [48, 48], 'compose'],
  b_doll_drum: ['manor', '太鼓人形', [48, 48], 'compose'],
  b_doll_flute: ['manor', '笛人形', [48, 48], 'compose'],
  boss_mistbeast: ['swamp', '霧食らい', [96, 96], 'new'],
  b_mist_double: ['swamp', '霧の分身', [48, 48], 'compose'],
  b_octopus: ['watercave', '深みの大ダコ', [64, 64], 'compose'],
  boss_tentacle: ['watercave', '大ダコの足', [48, 48], 'new'],
  b_captain: ['ship', '亡霊船長グレン', [64, 64], 'compose'],
  b_rockeater: ['mine', '岩食らい', [64, 64], 'compose'],
  b_ironwarden: ['mine', '鉄の番人', [96, 96], 'compose'],
  boss_hellhound: ['volcano', '炎の番犬', [96, 80], 'new'],
  boss_flame_lord: ['volcano', '溶岩の巨獣', [96, 96], 'crest'],
  b_lavabeast_cold: ['volcano', '溶岩の巨獣', [96, 96], 'compose'],
  boss_star_guardian: ['tower', '天球の番人', [96, 96], 'crest'],
  boss_stareater: ['tower', '星食らい', [112, 96], 'new'],
  boss_rowell: ['grass', 'ロウェル', [64, 80], 'new'],
  b_rowell2: ['grass', 'ロウェル', [64, 80], 'compose'],
  boss_bookgolem: ['library', '本の巨人', [96, 96], 'new'],
  boss_shade_sword: ['library', '剣の勇者の影', [64, 80], 'new'],
  boss_shade_prayer: ['library', '祈りの勇者の影', [64, 80], 'new'],
  boss_shade_star: ['library', '杖の勇者の影', [64, 80], 'new'],
  boss_lazaro: ['library', '大書記ラザロ', [80, 96], 'new'],
  boss_nemrea1: ['library', '虚ろの王', [128, 112], 'new'],
  boss_nemrea2: ['library', 'ネムレア', [128, 112], 'new'],
  b_valzard_echo: ['oblivion', '魔王の残影', [112, 96], 'compose'],
  boss_ouroboros: ['oblivion', '円環竜オウロボラ', [128, 112], 'new'],
};
// Crest bosses kept registered but not used by any Chronicle troop
const LEGACY = { boss_goblin_chief: 'cave', boss_bandit: 'fort', boss_serpent: 'watercave', boss_sphinx: 'pyramid', boss_general_a: 'demon', boss_general_b: 'demon', boss_demon_king: 'throne', boss_demon_king2: 'throne' };

// boss monster id → [sprite, name]  (§9.11.4)
const BOSSES = {
  b_pageeater: ['boss_pageeater', 'ページ食らい'], b_moth: ['boss_moth', 'ダストウィング'],
  b_rooteater: ['boss_rooteater', '根食らい'], b_root: ['boss_root', '根の触手'],
  b_sandworm: ['b_sandworm', '砂もぐり'], b_sandking: ['b_sandking', '名なき砂の王'],
  b_icegiant: ['boss_frost_giant', '氷壁の巨人'], b_whitedragon: ['boss_whitedragon', '白竜ネーヴェ'],
  b_doll_conductor: ['b_doll_conductor', '指揮者人形'], b_doll_violin: ['b_doll_violin', '弦ひき人形'],
  b_doll_drum: ['b_doll_drum', '太鼓人形'], b_doll_flute: ['b_doll_flute', '笛人形'],
  b_mistbeast: ['boss_mistbeast', '霧食らい'], b_mist_double: ['b_mist_double', '霧の分身'],
  b_octopus: ['b_octopus', '深みの大ダコ'], b_tentacle: ['boss_tentacle', '大ダコの足'],
  b_captain: ['b_captain', '亡霊船長グレン'], b_rockeater: ['b_rockeater', '岩食らい'],
  b_ironwarden: ['b_ironwarden', '鉄の番人'], b_hellhound: ['boss_hellhound', '炎の番犬'],
  b_lavabeast: ['boss_flame_lord', '溶岩の巨獣'], b_orrery: ['boss_star_guardian', '天球の番人'],
  b_stareater: ['boss_stareater', '星食らい'], b_rowell1: ['boss_rowell', 'ロウェル'],
  b_rowell2: ['b_rowell2', 'ロウェル'], b_bookgolem: ['boss_bookgolem', '本の巨人'],
  b_shade_sword: ['boss_shade_sword', '剣の勇者の影'], b_shade_prayer: ['boss_shade_prayer', '祈りの勇者の影'],
  b_shade_star: ['boss_shade_star', '杖の勇者の影'], b_lazaro: ['boss_lazaro', '大書記ラザロ'],
  b_nemrea1: ['boss_nemrea1', '虚ろの王'], b_nemrea2: ['boss_nemrea2', 'ネムレア'],
  b_valzard_echo: ['b_valzard_echo', '魔王の残影'], b_ouroboros: ['boss_ouroboros', '円環竜オウロボラ'],
};

// the 26 troops, left → right (§9.11.4). '@x' = the region's mob of lineage x (base sprite x here)
const TROOPS = {
  tr_b_pageeater: ['tower', ['b_pageeater']],
  tr_b_moth: ['forest', ['b_moth']],
  tr_b_rooteater: ['tree', ['b_root', 'b_rooteater', 'b_root']],
  tr_b_sandworm: ['pyramid', ['b_sandworm']],
  tr_b_sandking: ['pyramid', ['@mummy', 'b_sandking', '@mummy']],
  tr_b_icegiant: ['ice', ['b_icegiant']],
  tr_b_whitedragon: ['snow', ['b_whitedragon']],
  tr_b_dolls: ['manor', ['b_doll_violin', 'b_doll_conductor', 'b_doll_drum', 'b_doll_flute']],
  tr_b_mistbeast: ['swamp', ['b_mistbeast', 'b_mist_double']],
  tr_b_octopus: ['watercave', ['b_tentacle', 'b_octopus', 'b_tentacle']],
  tr_b_captain: ['ship', ['@skeleton', 'b_captain', '@skeleton']],
  tr_b_rockeater: ['mine', ['b_rockeater']],
  tr_b_ironwarden: ['mine', ['b_ironwarden']],
  tr_b_hellhound: ['volcano', ['b_hellhound']],
  tr_b_lavabeast: ['volcano', ['b_lavabeast']],
  tr_b_orrery: ['tower', ['b_orrery']],
  tr_b_stareater: ['tower', ['b_stareater']],
  tr_b_rowell1: ['grass', ['b_rowell1']],
  tr_b_rowell2: ['grass', ['b_rowell2']],
  tr_b_bookgolem: ['library', ['b_bookgolem']],
  tr_b_heroshades: ['library', ['b_shade_sword', 'b_shade_prayer', 'b_shade_star']],
  tr_b_lazaro: ['library', ['b_lazaro']],
  tr_b_nemrea1: ['library', ['b_nemrea1']],
  tr_b_nemrea2: ['library', ['b_nemrea2']],
  tr_b_valzard_echo: ['oblivion', ['b_valzard_echo']],
  tr_b_ouroboros: ['oblivion', ['b_ouroboros']],
};
// the mistbeast troop starts alone; one summoned double is shown in the sheet

// backdrops that may not be drawn yet → their stand-in (§10.15)
const BG_FALLBACK = { tree: 'forest', manor: 'castle', ship: 'sea', mine: 'cave', library: 'castle', oblivion: 'demon', hollow: 'demon', ring: 'demon' };

// ids of the §9.11.6 compose table (normative), for the tests
const COMPOSE_IDS = ['b_sandworm', 'b_sandking', 'b_doll_conductor', 'b_doll_violin', 'b_doll_drum', 'b_doll_flute', 'b_mist_double', 'b_octopus', 'b_captain', 'b_rockeater', 'b_ironwarden', 'b_lavabeast_cold', 'b_rowell2', 'b_valzard_echo'];

const EXPORTS = { SPRITES, LEGACY, BOSSES, TROOPS, BG_FALLBACK, COMPOSE_IDS };
// node tools require() this file; build.js --with may also load it in the page (then it is inert data)
if (typeof module !== 'undefined' && module.exports) module.exports = EXPORTS;
else if (typeof window !== 'undefined' && window.RPG) (window.RPG.artBossFixture = window.RPG.artBossFixture || {}).roster = EXPORTS;
})();
