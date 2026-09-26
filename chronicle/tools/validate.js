#!/usr/bin/env node
// validate.js (owner qa A22) — the one-pass data validator of DESIGN §12.2 (V1–V14) with every chapter's
// "validate に足す検査" (§4.18.3 · §5.7 · §6.9.2 · §7.13 · §8.14.2 · §9.13.4 · §11.12.1). Errors → exit 1,
// warnings are counted. Every finding is attributed to the owner area of §13 / §13.1 (from the file that
// registered the id, or from the id's prefix when the id is missing), so each owner can filter its own.
//
//   node tools/validate.js                    everything (errors + warnings), exit 1 on any error
//   node tools/validate.js --owner A9         only findings of one owner (exit code follows the filter); several: --owner A9,A10a
//   node tools/validate.js --only V1,V5,CH8   only some checks (V1…V14, CH4 CH5 CH6 CH7 CH8 CH9 CH12)
//   node tools/validate.js --quiet            errors only      --summary   counts per check and per owner only
//   node tools/validate.js --json out.json    machine-readable findings  --with <dir>  load fixture files after src/
//   node tools/validate.js --strict           treat "pending" (content not landed yet: empty registries) as errors too
//   node tools/validate.js --full             also run the QA sweep (SWEEP below: check_battle A2, check_mons-base A14b; BRIEF
//                                             A2.4 / A14b.3) as child processes; any non-zero exit is an error of that owner
//                                             (check SWEEP) and makes validate exit 1. --sweep-only runs just the sweep;
//                                             --sweep-extra a.js,b.js adds more tools to it (owner '?').
//
// "pending" findings: a registry the spec requires that is still completely empty (e.g. no maps yet) is reported
// once as PENDING instead of hundreds of errors. PENDING counts as an error for the exit code unless --partial.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Cond = require('./lib/cond');
const M = require('./lib/maps');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// =====================================================================================================
// CONTRACT (DESIGN ids and value sets; § in the comments)
// =====================================================================================================
const C = {};
C.STATS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];                                             // §3.1.1
C.SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
C.ITEM_TYPES = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc', 'consumable', 'key'];
C.WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
C.TWO_HANDED = ['greatsword', 'spear', 'bow'];
C.REACH = ['spear', 'bow', 'whip'];
C.ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
C.GRADES = ['normal', 'rare', 'super'];
C.ROWS = ['front', 'middle'];
C.BAD = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind'];
C.GOOD = ['regen', 'veil', 'counter', 'nimble', 'cover'];
C.BUFFS = ['atk', 'def', 'mag', 'mdef', 'agi'];
C.TARGETS = ['enemy', 'enemies', 'group', 'random', 'ally', 'allies', 'self', 'ally_dead', 'ally_any', 'party'];
C.EFFECTS = ['damage', 'heal', 'healMp', 'healWp', 'revive', 'cure', 'status', 'buff', 'dispel', 'steal', 'scan', 'escape', 'grow',
  'teleport', 'exit', 'encounter', 'cover', 'summon', 'special'];
C.FORMULAS = ['phys', 'magic', 'breath', 'tier', 'fixed', 'percent'];
C.MON_COND = ['hpBelow', 'hpAbove', 'every', 'once', 'round', 'alone', 'countBelow', 'allyDown'];            // §9.1.7
C.RACES = ['beast', 'bird', 'insect', 'plant', 'aquatic', 'dragon', 'undead', 'demon', 'spirit', 'construct', 'slime', 'humanoid', 'fairy'];
C.MON_FLAGS = ['boss', 'rare', 'metal', 'flying'];
C.SIZES = ['s', 'm', 'l'];
C.ELEM_VALUES = [2, 1.5, 1.25, 1, 0.75, 0.5, 0.25, 0, -1];                                          // §4.7.1
C.KINDS = ['slash', 'blunt', 'pierce'];
C.WEAPON_FIELDS = ['wtype', 'atk', 'mag', 'hit', 'crit', 'element', 'onHit', 'twoHanded', 'vs', 'drain', 'sealTech', 'metalHit'];
C.ITEM_FIELDS = ['name', 'type', 'grade', 'tier', 'desc', 'price', 'units', 'line', 'src', 'exclusive', 'unique', 'quirk', 'sort', 'icon',
  'stats', 'statsAdd', 'mods', 'weight', 'def', 'mdef', 'eva', 'use', 'stone', 'only', 'gender', ...['wtype', 'atk', 'mag', 'hit', 'crit', 'element',
    'onHit', 'twoHanded', 'vs', 'drain', 'sealTech', 'metalHit']];
C.SRC = ['shop', 'drop', 'mdrop', 'super', 'relic', 'reward'];
C.WEIGHTS = ['heavy', 'light', 'cloth'];
// §3.3.16 mods keys → value type
C.MODS = {
  atk: 'n', def: 'n', mdef: 'n', hit: 'n', eva: 'n', crit: 'n', spd: 'n', mag: 'n',
  strPct: 'n', vitPct: 'n', dexPct: 'n', agiPct: 'n', intPct: 'n', mndPct: 'n', hpPct: 'n', mpPct: 'n', wpPct: 'n', defPct: 'n', mdefPct: 'n',
  physPct: 'n', magicPct: 'n', healPct: 'n', itemPct: 'n', takenPct: 'n', mpCostPct: 'n', wpCostPct: 'n',
  elemBoost: 'emap', elemResist: 'emap', statusImmune: 'slist', statusResist: 'smap', profPct: 'pmap', glimPct: 'gmap', expPct: 'n',
  goldPct: 'n', dropPct: 'n', rarePct: 'n', superPct: 'n', rareEncPct: 'n', goldenPct: 'n', preemptPct: 'n', escapePct: 'n',
  stealPct: 'n', autoSteal: 'n', encounterPct: 'n', regen: 'b', mpRegen: 'n', wpRegen: 'n', startBuffs: 'bmap', noSpell: 'b', hpLoss: 'n',
  autoRevive: 'n', autoCounter: 'n', walkHeal: 'n', noFloorDamage: 'b',
};
// §11.11.4 sound ids
C.BGM = ('title overworld sea town village castle shrine ending dungeon cave tower pyramid ice volcano lastdungeon battle boss lastboss ' +
  'valzard tavern home rival tension sorrow boss2 rarebattle superboss postgame forest ghost hollowking legend').split(' ');
C.JINGLES = 'victory levelup item keyitem inn save gameover rare superrare chapter recruit'.split(' ');
C.SFX = ('cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt magic fire ice thunder wind holy dark ' +
  'earth water heal revive buff debuff status poison sleep death enemy_die boss_die escape stairs door locked chest item gold step_damage ship ' +
  'bump warp teleport steal jump breath roar shake glimmer golden light freeze burn quill page swap bell unlock arrow lash parry secret').split(' ');
// §5.1.1
C.HERO_TYPES = ['warrior', 'ranger', 'mage', 'spellblade', 'wanderer'];
C.COMPANIONS = ['selma', 'hagen', 'dokka', 'basil', 'bartolo', 'viola', 'shigure', 'rouga', 'titta', 'brigitta', 'sylvain', 'zafira', 'ferno',
  'belladonna', 'boden', 'teo', 'ilse', 'morga', 'marta', 'noela'];
// §6.1.2
C.TECHS = {
  sword: 'stepcut guard twin thrust wheel bulwark purify bladewind triple dawn crest', greatsword: 'overhead mow flat whirl desperate rend quake crush tempest skyfall rivers',
  dagger: 'vital filch venom knives lull bees gap nape shadow dance nightfall', axe: 'cleave woodcut throw rage reckless whirl cliff twostroke storm earthsplit giant',
  spear: 'upthrust butt skewer receive pierce cloud ripple phalanx soar surge starpierce', bow: 'rapid twin blind rain hush hawk pin volley gale starrain rainbow',
  club: 'smash crumble wrist tremor bell strip shatter rumble diamond thunder upheaval', staff: 'mind soothe seal unward share wave clarity aegis drain oracle prayer',
  katana: 'draw mine fold riposte haze dash steel void lifecut leaves first', fist: 'palm onetwo willow knee breath hail farstrike throw wolves eightfold empty',
  whip: 'trip sweep bind disarm snatch serpent thorn sparks coil net twilight',
};
C.TECH_IDS = Object.entries(C.TECHS).flatMap(([w, s]) => s.split(' ').map((n) => `t_${w}_${n}`));
C.TECH_LV = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];                                                      // §6.9.1-2
C.TECH_WP = { 1: [1, 2], 2: [2, 3], 3: [2, 4], 4: [3, 4], 5: [3, 5], 6: [4, 6], 7: [5, 7], 8: [6, 8], 9: [10, 11], 10: [12, 14] };   // §6.4.1
// §7.2.1
C.PAIRS = [];
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) C.PAIRS.push([C.ELEMENTS[i], C.ELEMENTS[j]]);
C.TRIPLES = [];
for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) C.TRIPLES.push([C.ELEMENTS[i], C.ELEMENTS[j], C.ELEMENTS[k]]);
C.SINGLE_STEPS = { fire: [1, 2, 3, 4, 5], water: [1, 2, 3, 5], wind: [1, 2, 3, 5], earth: [1, 2, 3, 5], light: [1, 2, 3, 4, 5], dark: [1, 2, 3, 4, 5] };
C.SPELL_IDS = [].concat(
  ...C.ELEMENTS.map((e) => C.SINGLE_STEPS[e].map((s) => `s_${e}_${s}`)),
  ...C.PAIRS.map(([a, b]) => [`s_${a}_${b}_a`, `s_${a}_${b}_b`]),
  C.TRIPLES.map((t) => 's_' + t.join('_')));
// §7.1.3: cls → {lv, prof, mp:[min,max]}
C.SPELL_CLS = { 1: { lv: 1, prof: 0, mp: [2, 3] }, 2: { lv: 2, prof: 2, mp: [3, 5] }, 3: { lv: 3, prof: 4, mp: [5, 7] }, 4: { lv: 5, prof: 6, mp: [7, 9] },
  5: { lv: 7, prof: 8, mp: [11, 12] }, comboA: { lv: 4, prof: 5, mp: [7, 9] }, comboB: { lv: 6, prof: 7, mp: [10, 13] }, triple: { lv: 8, prof: 8, mp: [15, 20] } };
// §8.9 · §8.10 · §8.11 · §8.12
C.CONSUMABLES = ('i_antidote i_aurora_feather i_bloom_nectar i_bomb i_censer i_clear i_diamond_dust i_dream_fruit i_elixir i_ether2 i_ether i_firepot ' +
  'i_fox_icicle i_gem_quill i_ghost_tea i_glass_dust i_gold_bar i_gold_coins i_golden_acorn i_golden_ink i_grace i_horn i_incense i_jewel_carrot ' +
  'i_lens i_lifedew i_lotus_dew i_lure i_memory_bubble i_moon_wool i_numb i_panacea i_phoenix i_potion i_prism_shard i_repel i_revive i_salve ' +
  'i_seed_hp i_seed_mp i_seed_wp i_smoke i_snail_bell i_spa_egg i_spring_key i_stardust i_stone_dark i_stone_earth i_stone_fire i_stone_light ' +
  'i_stone_water i_stone_wind i_thaw i_throat i_tonic i_volcano_stone i_waker i_wisdom_page').split(' ');
C.KEYS = ('k_chronicle k_quill k_bell k_lighthouse_key k_page_forest k_page_desert k_page_snow k_page_marsh k_page_isles k_page_mine k_page_ash ' +
  'k_page_star k_winter_flame k_marsh_key k_shanty k_oath_hammer k_star_chart k_rowell_note').split(' ');
C.SHOPS = ['roa_item', 'lute_item', 'lute_weapon', 'lute_armor', ...['fern', 'kasim', 'yule', 'loch', 'coral', 'dovan', 'caldera', 'orbis', 'biblia']
  .flatMap((t) => [`${t}_item`, `${t}_weapon`, `${t}_armor`]), 'nerei_item', 'orbis_magic', 'coral_regnas'];
C.POOLS = ['p_supply', 'p_gold', 'p_stone', 'p_gear', 'p_weapon', 'p_armor', 'p_acc', 'p_rare', 'p_boss', 'p_boss_mid'];
C.ITEM_COUNTS = { weapon: 301, armor: 480, acc: 265, consumable: 58, key: 18 };                     // §8.1.3
// §10.13
C.REGIONS = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
C.RS = { r_forest: 'forest', r_desert: 'desert', r_snow: 'snow', r_marsh: 'marsh', r_isles: 'isles', r_mine: 'mine', r_ash: 'ash', r_star: 'star' };
C.REGION_VALUES = [...C.REGIONS, 'prologue', 'finale', 'postgame'];
C.LOCATIONS = {                                                                                     // §10.6.3 (order = warp list order)
  roa: ['roa', 'prologue', 'town'], lute: ['lute', 'prologue', 'town'], lighthouse: ['lighthouse_1', 'prologue', 'dungeon'],
  fern: ['fern', 'r_forest', 'town'], verda_maze: ['verda_maze_1', 'r_forest', 'dungeon'], kasim: ['kasim', 'r_desert', 'town'],
  sand_tomb: ['sand_tomb_1', 'r_desert', 'dungeon'], yule: ['yule', 'r_snow', 'town'], frost_peak: ['frost_peak_1', 'r_snow', 'dungeon'],
  loch: ['loch', 'r_marsh', 'town'], mist_manor: ['mist_manor_1', 'r_marsh', 'dungeon'], bell_marsh: ['bell_marsh_1', 'r_marsh', 'dungeon'],
  coral: ['coral', 'r_isles', 'town'], nerei: ['nerei', 'r_isles', 'town'], tide_cave: ['tide_cave_1', 'r_isles', 'dungeon'],
  dovan: ['dovan', 'r_mine', 'town'], deep_mine: ['deep_mine_1', 'r_mine', 'dungeon'], caldera: ['caldera', 'r_ash', 'town'],
  ash_volcano: ['ash_volcano_1', 'r_ash', 'dungeon'], orbis: ['orbis', 'r_star', 'town'], stargaze: ['stargaze_1', 'r_star', 'dungeon'],
  biblia: ['biblia', 'finale', 'town'], archive: ['archive_1', 'finale', 'dungeon'],
};
// dungeon → floors, location of those floors (§10.6.2 · §10.6.3)
C.DUNGEONS = {
  lighthouse: { floors: 3, loc: 'lighthouse', owner: 'A18b' }, verda_maze: { floors: 2, loc: 'verda_maze', owner: 'R1' }, elder_tree: { floors: 2, loc: 'verda_maze', owner: 'R1' },
  sand_tomb: { floors: 3, loc: 'sand_tomb', owner: 'R2' }, frost_peak: { floors: 3, loc: 'frost_peak', owner: 'R3' }, mist_manor: { floors: 2, loc: 'mist_manor', owner: 'R4' },
  bell_marsh: { floors: 1, loc: 'bell_marsh', owner: 'R4' }, tide_cave: { floors: 1, loc: 'tide_cave', owner: 'R5' }, ghost_ship: { floors: 3, loc: 'nerei', owner: 'R5' },
  deep_mine: { floors: 3, loc: 'deep_mine', owner: 'R6' }, ash_volcano: { floors: 3, loc: 'ash_volcano', owner: 'R7' }, stargaze: { floors: 4, loc: 'stargaze', owner: 'R8' },
  archive: { floors: 6, loc: 'archive', owner: 'A19' }, oblivion: { floors: 5, loc: 'archive', owner: 'OB' },
};
C.TOWNS = { roa: 'A18b', lute: 'A18b', fern: 'R1', kasim: 'R2', yule: 'R3', loch: 'R4', coral: 'R5', nerei: 'R5', dovan: 'R6', caldera: 'R7', orbis: 'R8', biblia: 'A19' };
C.MAPS = ['world', 'roa', 'roa_house', 'lute', ...Object.keys(C.TOWNS).filter((t) => !['roa', 'lute'].includes(t)),
  ...Object.entries(C.DUNGEONS).flatMap(([d, o]) => Array.from({ length: o.floors }, (_, i) => `${d}_${i + 1}`))];
C.SECRET_FLOORS = ['lighthouse_2', 'verda_maze_2', 'elder_tree_1', 'sand_tomb_2', 'frost_peak_2', 'mist_manor_1', 'tide_cave_1', 'ghost_ship_2',
  'deep_mine_2', 'ash_volcano_2', 'stargaze_3', 'archive_2', 'archive_4', 'oblivion_2', 'oblivion_4'];                     // §10.6.4
C.ZONES = ['zw_prologue', 'zw_forest', 'zw_desert', 'zw_snow', 'zw_mine', 'zw_star', 'zw_marsh', 'zw_ash', 'zw_isles', 'zw_center',
  'z_prologue_lighthouse', 'z_r_forest_maze', 'z_r_forest_tree', 'z_r_desert_tomb', 'z_r_snow_peak', 'z_r_marsh_manor', 'z_r_marsh_bog', 'z_r_isles_cave',
  'z_r_isles_ship', 'z_r_mine_mine', 'z_r_ash_volcano', 'z_r_star_tower', 'z_finale_archive_lo', 'z_finale_archive_hi', 'z_postgame_oblivion_lo', 'z_postgame_oblivion_hi'];
C.TROOPS = ['tr_tutorial', 'tr_b_pageeater', 'tr_b_moth', 'tr_b_rooteater', 'tr_b_sandworm', 'tr_b_sandking', 'tr_b_icegiant', 'tr_b_whitedragon', 'tr_b_dolls',
  'tr_b_mistbeast', 'tr_b_octopus', 'tr_b_captain', 'tr_b_rockeater', 'tr_b_ironwarden', 'tr_b_hellhound', 'tr_b_lavabeast', 'tr_b_orrery', 'tr_b_stareater',
  'tr_b_rowell1', 'tr_b_rowell2', 'tr_b_bookgolem', 'tr_b_heroshades', 'tr_b_lazaro', 'tr_b_nemrea1', 'tr_b_nemrea2', 'tr_b_valzard_echo', 'tr_b_ouroboros'];
C.RARE_MONS = ('rm_acorn_prince rm_aurora_bird rm_bell_snail rm_bloom_fawn rm_bookworm rm_clock_bird rm_diamond_lizard rm_dream_tapir rm_gem_hedgehog ' +
  'rm_ghost_teapot rm_glass_moth rm_gold_idol rm_golden_quill rm_icetail_fox rm_jewel_hare rm_lotus_sprite rm_memory_fish rm_moon_sheep rm_prisma ' +
  'rm_spa_monkey rm_star_whale rm_treasure_crab rm_volcano_turtle').split(' ');
C.LINEAGES = ('jelly rat bat paper crab seabird bee mushroom plant fairy treant scorpion snake mummy cactus sandworm wolf yeti frostling owl mammoth ghost ' +
  'wisp frog doll lizardman spider merman kraken skeleton golem mole beetle crystal goblin salamander imp gargoyle orc chimera eyeball darkmage ' +
  'automaton armor wyvern scribe book mimic void chaos demon quicksilver mirror platinum').split(' ');                   // §9.1.3 (54)
C.OBJECTIVES = ['obj_w_roa', 'obj_w_to_lute', 'obj_w_keeper', 'obj_w_lighthouse', 'obj_regions', 'obj_s_t6_home', 'obj_s_final_roa', 'obj_s_final_ferry',
  'obj_s_final_archive', 'obj_s_postgame', 'obj_s_pg_clear', ...Object.entries({ forest: 3, desert: 3, snow: 2, marsh: 3, isles: 4, mine: 2, ash: 3, star: 2 })
    .flatMap(([rs, n]) => Array.from({ length: n }, (_, i) => `obj_${rs}_${i + 1}`))];
C.EVENTS = {                                                                                        // §10.13.9 (ids other owners call)
  A18a: ['common_inn', 'common_tavern', 'common_shop', 'common_ferry', 'common_rest', 'world_bridge_closed'],
  A18b: ['roa_house_intro', 'roa_stone', 'roa_berna', 'roa_gate', 'lute_arrival', 'lute_rowell', 'lute_tavern_start', 'lute_otto', 'lute_otto_reward',
    'lighthouse_1_tutorial', 'lighthouse_3_fine', 'lighthouse_3_boss', 'lute_departure'],
  A19: ['story_after_clear', 'story_home_t6', 'story_rumor', ...Object.values(C.RS).map((rs) => 'story_fine_' + rs), 'story_final_roa', 'biblia_arrival',
    'archive_3_rowell', 'archive_5_lazaro', 'archive_6_boss'],
};
C.NPC_FIXED = ['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'shop_magic', 'ferry', 'rest', 'boss', 'fine', 'berna', 'st_rival', 'st_fine', 'st_extra', 'otto_door'];
C.COLOR_WORDS = ['灰色', '赤', '紅', '青', '紫', '黒', '白', '虹', '金'];                             // §9.8
C.FX_TECH = ['slash', 'slash2', 'slash3', 'pierce', 'pierce2', 'pierce3', 'strike', 'strike2', 'strike3', 'claw3', 'arrow', 'arrow2', 'arrow3', 'lash', 'lash2',
  'lash3', 'stance', 'holy', 'holy2', 'holy3', 'earth', 'earth2', 'earth3', 'fire', 'fire2', 'wind', 'wind2', 'wind3', 'dark3', 'magic', 'magic2', 'magic3', 'drain',
  'silence', 'debuff', 'buff', 'heal', 'heal3', 'mp', 'poison', 'sleep', 'steal'];                                          // §6.2.6
C.FX_ALL = new Set([...C.FX_TECH, 'arrow', 'bite', 'bite2', 'breath', 'breath_fire', 'breath_ice', 'breath_poison', 'breath_dark', 'claw', 'confuse', 'dark', 'dark2',
  'death', 'dispel', 'earth', 'explosion', 'explosion2', 'fire3', 'ice', 'ice2', 'ice3', 'paralyze', 'regen', 'revive', 'smoke', 'song', 'thunder', 'thunder2', 'thunder3',
  'warp', 'water', 'water2', 'water3', 'cure', 'gravity', 'light', 'holy', 'wind3', 'buff2', 'debuff2']);                      // §9.14 · §7.3.4-7
// §8.3.5 caps (beneficial direction) per class: n = normal (補助), r = rare, s = super, lr / ls = relic·reward rare / super. null = not allowed.
const X = null;
C.CAPS = {
  crit: [X, 20, 20, 10, 10], hit: [X, 15, 15, 20, 20], atk: [X, 10, 20, X, X], def: [X, 10, 20, X, X], mdef: [X, 10, 20, X, X],
  elemBoost: [10, 20, 30, 20, 30], hpPct: [X, 15, 20, 15, 20], mpPct: [X, 20, 25, 15, 20], wpPct: [X, 20, 25, 15, 20],
  strPct: [X, X, X, 20, 20], vitPct: [X, X, X, 20, 20], dexPct: [X, X, X, 20, 20], agiPct: [X, X, X, 20, 20], intPct: [X, X, X, 20, 20], mndPct: [X, X, X, 20, 20],
  mpRegen: [X, 3, 3, 1, 2], wpRegen: [X, 3, 3, 1, 2], physPct: [10, 15, 25, 15, 25], magicPct: [10, 15, 25, 15, 25], healPct: [20, 35, 50, 35, 35],
  itemPct: [30, 50, 50, 30, 30], mpCostPct: [15, 25, 35, 15, 35], wpCostPct: [15, 25, 35, 15, 35], glimPct: [10, 15, 25, 15, 20], profPct: [20, 35, 50, X, X],
  dropPct: [10, 20, 30, 20, 30], rarePct: [10, 20, 30, 20, 30], superPct: [X, 20, 30, 20, 30], goldPct: [10, 20, 30, 20, 30], expPct: [10, 15, 20, 15, 15],
  encounterPct: [50, 50, 50, 50, 50], rareEncPct: [X, 20, 30, 20, 30], goldenPct: [X, 20, 30, 20, 30], stealPct: [50, 50, 50, 50, 50], escapePct: [50, 50, 50, 50, 50],
  preemptPct: [5, 5, 10, 10, 10], autoSteal: [50, 75, 100, X, X], spd: [X, 20, 30, 15, 30], eva: [X, 10, 15, 15, 15], defPct: [X, X, 25, 15, 25], mdefPct: [X, X, 25, 15, 25],
  autoRevive: [X, X, 0.3, X, 0.25], autoCounter: [X, X, 0.3, X, 0.25], takenPct: [X, X, X, X, X], hpLoss: [X, X, X, X, X], walkHeal: [5, 5, 5, 5, 5],
};
// §8.3.6 quirk caps (penalty direction): [rare, super]
C.QUIRK = { defPct: [25, 50], mdefPct: [25, 50], takenPct: [15, 30], hpPct: [10, 30], spd: [15, 30], eva: [10, 20], hit: [10, 20], expPct: [25, 100], goldPct: [25, 100],
  encounterPct: [50, 50], mpCostPct: [25, 50], wpCostPct: [25, 50], glimPct: [50, 100], hpLoss: [0, 5], mpPct: [10, 30], wpPct: [10, 30], atk: [10, 20], def: [10, 20], mdef: [10, 20], crit: [10, 20] };
C.PENALTY_UP = new Set(['takenPct', 'mpCostPct', 'wpCostPct', 'hpLoss']);   // larger = worse

// =====================================================================================================
// OWNERS (§13 · §13.1) — file → area
// =====================================================================================================
const OWNER_RULES = [
  [/^src\/core\/audio\.js$|^src\/audio\//, 'A17'], [/^src\/core\/|^src\/ui\/|^src\/main\.js$/, 'A0'],
  [/^src\/systems\/(state|rules|party|tier)\.js$/, 'A1'], [/^src\/systems\/(battle|battle_ai|mon)\.js$/, 'A2'], [/^src\/systems\/(battle_scene|battle_fx)\.js$/, 'A3'],
  [/^src\/systems\/(field|field_map|events_runtime|minimap|debug)\.js$/, 'A4'], [/^src\/systems\/(menu[^/]*|shop|gameover)\.js$/, 'A5'],
  [/^src\/systems\/(title|charcreate|nameentry|tavern)\.js$|^src\/data\/(herotypes|companions[^/]*)\.js$/, 'A6'],
  [/^src\/data\/(weapontypes|techs_[^/]*)\.js$/, 'A7'], [/^src\/data\/(elements|statuses|spells_[^/]*)\.js$|^src\/systems\/glimmer\.js$/, 'A8'],
  [/^src\/data\/items_weapons[^/]*\.js$/, 'A9'], [/^src\/data\/items_(armor|acc)[^/]*\.js$/, 'A10a'], [/^src\/data\/(items_use|items_key|shops|pools)[^/]*\.js$/, 'A10b'],
  [/^src\/data\/(lineages|monsters_|enemy_actions|encounters)[^/]*\.js$/, 'A11'], [/^src\/data\/(bosses|troops|rare)[^/]*\.js$/, 'A12'],
  [/^src\/art\/(chars|faces)[^/]*\.js$|^src\/art\/objects\.js$/, 'A13'], [/^src\/art\/monsters_(parts|compose)[^/]*\.js$/, 'A14a'], [/^src\/art\/monsters_[abc]\.js$/, 'A14b'],
  [/^src\/art\/bosses[^/]*\.js$/, 'A15a'], [/^src\/art\/(rare_monsters[^/]*|postgame)\.js$/, 'A15b'],
  [/^src\/data\/tiles_world\.js$|^src\/art\/(tiles_world|battlebg)[^/]*\.js$/, 'A16a'], [/^src\/data\/tiles\.js$|^src\/art\/(tiles|tiles_auto|tiles_local[^/]*|tiles_theme[^/]*|decor[^/]*)\.js$/, 'A16b'],
  [/^src\/maps\/world[^/]*\.js$|^src\/events\/world[^/]*\.js$|^src\/data\/(regions|locations|objectives|config)\.js$/, 'A18a'], [/^src\/(maps|events)\/prologue[^/]*\.js$/, 'A18b'],
  [/^src\/(maps|events)\/region([1-8])_/, (m) => 'R' + m[2]], [/^src\/(maps|events)\/oblivion[^/]*\.js$/, 'OB'],
  [/^src\/events\/story[^/]*\.js$|^src\/(maps|events)\/final[^/]*\.js$|^src\/systems\/(ending|postgame_scene)\.js$/, 'A19'],
  [/^tools\/fixtures\/qa\/|^tools\/(validate|progress|check_text|smoke|playthrough|shots|sim_balance|check_density)\.js$|^tools\/lib\/(maps|cond|party_model)\.js$/, 'A22'],
];
function ownerOfFile(rel) {
  if (!rel) return '?';
  rel = rel.replace(/\\/g, '/');
  for (const [re, o] of OWNER_RULES) { const m = rel.match(re); if (m) return typeof o === 'function' ? o(m) : o; }
  return 'A0';
}
const REGION_OWNER = { r_forest: 'R1', r_desert: 'R2', r_snow: 'R3', r_marsh: 'R4', r_isles: 'R5', r_mine: 'R6', r_ash: 'R7', r_star: 'R8' };
function expectedMapOwner(id) {
  if (id === 'world') return 'A18a';
  if (id === 'roa' || id === 'roa_house' || id === 'lute' || /^lighthouse_/.test(id)) return 'A18b';
  for (const t in C.TOWNS) if (id === t || id.startsWith(t + '_house')) return C.TOWNS[t];
  for (const d in C.DUNGEONS) if (id.startsWith(d + '_')) return C.DUNGEONS[d].owner;
  return null;
}
/** expected owner of an id of registry `reg` (used when the id is missing or unregistered) */
function expectedOwner(reg, id) {
  id = String(id || '');
  switch (reg) {
    case 'actions': return /^t_/.test(id) ? 'A7' : /^s_/.test(id) ? 'A8' : /^eb_/.test(id) ? 'A12' : 'A11';
    case 'items': return /^w_/.test(id) ? 'A9' : /^(sh|hd|bd|hn|ft|ac)_/.test(id) ? 'A10a' : 'A10b';
    case 'monsters': return /^(rm_|b_)/.test(id) ? 'A12' : 'A11';
    case 'lineages': case 'encounters': return 'A11';
    case 'troops': case 'rareEncounters': return 'A12';
    case 'shops': case 'pools': return 'A10b';
    case 'heroTypes': case 'companions': case 'starterKit': return 'A6';
    case 'weaponTypes': return 'A7';
    case 'elements': case 'statuses': return 'A8';
    case 'regions': case 'locations': case 'config': return 'A18a';
    case 'objectives': return /^obj_s_/.test(id) ? 'A19' : /^obj_p_/.test(id) ? 'A18b' : /^obj_(w_|regions)/.test(id) ? 'A18a'
      : (() => { const m = id.match(/^obj_([a-z]+)_/); const r = m && Object.keys(C.RS).find((k) => C.RS[k] === m[1]); return r ? REGION_OWNER[r] : 'A18a'; })();
    case 'maps': return expectedMapOwner(id) || 'A18a';
    case 'events': {
      if (/^story_/.test(id)) return 'A19';
      if (/^(common_|world_)/.test(id)) return 'A18a';
      for (const k in C.EVENTS) if (C.EVENTS[k].includes(id)) return k;
      const mp = Object.keys(C.TOWNS).concat(Object.keys(C.DUNGEONS), ['roa_house']).find((m) => id.startsWith(m + '_'));
      if (mp) return expectedMapOwner(C.DUNGEONS[mp] ? mp + '_1' : mp) || 'A18a';
      return 'A18a';
    }
    case 'rumors': return 'A19';
    case 'music': case 'sfx': return 'A17';
    case 'tiles': case 'themes': case 'decor': case 'legends': return 'A16b';
    case 'gfx': {
      if (/^(party|npc|face|obj|icon):/.test(id)) return 'A13';
      if (/^bbg:/.test(id)) return 'A16a';
      if (/^bfx:/.test(id)) return 'A3';
      if (/^mon:(rm_|rare_)/.test(id)) return 'A15b';
      if (/^mon:(b_|boss_)/.test(id)) return 'A15a';
      if (/^mon:/.test(id)) return 'A14a';
      if (/^tile:(world|road|marsh|ash|fog|sandstorm|marsh_fog|secret_forest|secret_rock|loc_)/.test(id)) return 'A16a';
      return 'A16b';
    }
    default: return 'A0';
  }
}

// =====================================================================================================
// LOADING with provenance (same file walk and sandbox as tools/lib/load.js, but remembers which file
// registered each id so findings can be attributed to their owner)
// =====================================================================================================
function listFiles(extraDirs) {
  const DIRS = ['core', 'ui', 'data', 'art', 'audio', 'maps', 'events', 'systems'];
  const CORE_FIRST = ['ns.js', 'input.js', 'gfx.js', 'engine.js', 'save.js'];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = [];
  for (const d of DIRS) {
    const dir = path.join(SRC, d);
    if (!fs.existsSync(dir)) continue;
    files.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => {
      if (d === 'core') {
        const ia = CORE_FIRST.indexOf(path.basename(a)), ib = CORE_FIRST.indexOf(path.basename(b));
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.localeCompare(b);
    }));
  }
  const extra = [];
  for (const x of extraDirs || []) {
    const p = path.resolve(x);
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) extra.push(...walk(p).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
    else extra.push(p);
  }
  return { files, extra };
}

function loadTracked(opts) {
  opts = opts || {};
  const { files, extra } = listFiles(opts.with);
  const noop = () => {};
  const sandbox = {
    console: { log: noop, warn: noop, error: noop, info: noop },
    setTimeout, clearTimeout, setInterval, clearInterval, Promise, Math, JSON, Date,
    performance: { now: () => Date.now() }, requestAnimationFrame: noop, addEventListener: noop, removeEventListener: noop,
    navigator: { getGamepads: () => [] }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    TextEncoder, TextDecoder, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const prov = {};                   // reg → id → rel file
  const gfxProv = {};                // gfx key → rel file
  const loadErrors = [];
  const snap = (R) => {
    const s = {};
    if (!R || !R.DB) return s;
    for (const reg of Object.keys(R.DB)) s[reg] = new Set(Object.keys(R.DB[reg] || {}));
    return s;
  };
  let hooksByFile = [];
  const diff = (R, before, rel) => {
    if (!R || !R.DB) return;
    for (const reg of Object.keys(R.DB)) {
      const b = before[reg] || new Set();
      for (const id of Object.keys(R.DB[reg] || {})) if (!b.has(id)) { (prov[reg] = prov[reg] || {})[id] = (prov[reg] || {})[id] || rel; }
    }
  };
  const gfxKeys = (R) => new Set(R && R.Gfx && R.Gfx._defs ? Object.keys(R.Gfx._defs) : []);
  for (const f of files.concat(extra)) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const R0 = sandbox.RPG;
    const before = snap(R0), gb = gfxKeys(R0);
    // wrap R.onData so the hooks remember their file
    if (R0 && R0.onData && !R0.__qaWrapped) {
      const orig = R0.onData;
      R0.onData = function (fn) { hooksByFile.push({ fn, rel: sandbox.__qaFile }); return orig.call(R0, fn); };
      R0.__qaWrapped = true;
    }
    sandbox.__qaFile = rel;
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
    catch (e) { loadErrors.push({ rel, msg: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); }
    const R = sandbox.RPG;
    if (R && R.onData && !R.__qaWrapped) {   // ns.js just defined R: wrap for the following files
      const orig = R.onData;
      R.onData = function (fn) { hooksByFile.push({ fn, rel: sandbox.__qaFile }); return orig.call(R, fn); };
      R.__qaWrapped = true;
    }
    diff(R, before, rel);
    for (const k of gfxKeys(R)) if (!gb.has(k) && !gfxProv[k]) gfxProv[k] = rel;
  }
  const R = sandbox.RPG;
  // data hooks one by one (same order as R.runDataHooks), attributing what each one adds
  if (R && R._dataHooks && opts.dataHooks !== false && !R._dataHooksRan) {
    R._dataHooksRan = true;
    const relOf = new Map(hooksByFile.map((h) => [h.fn, h.rel]));
    for (const fn of R._dataHooks) {
      const rel = relOf.get(fn) || 'src/?';
      const before = snap(R), gb = gfxKeys(R);
      try { fn(R); } catch (e) { loadErrors.push({ rel, msg: 'onData hook: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); }
      diff(R, before, rel);
      for (const k of gfxKeys(R)) if (!gb.has(k) && !gfxProv[k]) gfxProv[k] = rel;
    }
  }
  for (const e of (R && R.loadErrors) || []) if (!loadErrors.some((x) => String(e).includes(x.msg.slice(0, 40)))) loadErrors.push({ rel: '?', msg: String(e).split('\n')[0] });
  if (R) R._nodeLoadErrors = loadErrors.map((e) => e.rel + ': ' + e.msg);
  return { R, prov, gfxProv, files: files.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')), extra, loadErrors };
}

// =====================================================================================================
// REPORT
// =====================================================================================================
class Report {
  constructor() { this.items = []; }
  add(level, check, owner, msg) { this.items.push({ level, check, owner: owner || '?', msg }); }
}

// =====================================================================================================
// helpers
// =====================================================================================================
const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const isNum = (v) => typeof v === 'number' && isFinite(v);
function textWidth(R, s) {               // full-width units (1 = 全角 1 字); {hero} counts as 5
  s = String(s == null ? '' : s).replace(/\{hero\}|\{leader\}|\{name\}|\{user\}|\{ally\}/g, '＊＊＊＊＊').replace(/\{g:([^|}]*)\|([^}]*)\}/g, (m, a, b) => (a.length > b.length ? a : b));
  if (R && R.Text && R.Text.approxWidth) {
    const saved = R.Text.fmt;
    try { R.Text.fmt = (x) => String(x == null ? '' : x); return R.Text.approxWidth(s) / (32 / 3); } catch (e) { /* fall through */ } finally { R.Text.fmt = saved; }
  }
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) < 0x2000 || (ch >= '｡' && ch <= 'ﾟ') ? 0.5 : 1;
  return w;
}
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += n || ''; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') q = c;
    out += c; i++;
  }
  return out;
}
const srTierOf = (DB, monId) => {
  const m = DB.monsters[monId];
  if (!m || !m.lineage || !DB.lineages[m.lineage]) return null;
  const st = DB.lineages[m.lineage].stages || [];
  const k = st.findIndex((s) => s.mon === monId);
  if (k < 0) return null;
  const t = st[k].tier;
  if (t === 9) return 9;
  if (k === st.length - 1) return 8;
  return Math.max(t, st[k + 1].tier - 1);
};
const band = (t) => (t === 9 ? 9 : t === 8 ? 7 : t % 2 === 1 ? t : t - 1);
const gearStat = (U, T, units, grade) => Math.max(1, Math.round(units * U[T])) * ({ normal: 1, rare: 2, super: 3 }[grade || 'normal'] || 1);
const RB = [1, 1, 3, 3, 5, 5, 7, 7, 9, 9];

// =====================================================================================================
// CHECKS
// =====================================================================================================
function run(opts) {
  opts = opts || {};
  const L = loadTracked({ with: opts.with });
  const R = L.R;
  const rep = new Report();
  if (!R || !R.DB) { rep.add('error', 'LOAD', 'A0', 'the game namespace did not load (src/core/ns.js)'); return { rep, R, L }; }
  const DB = R.DB;
  const warnSink = [];
  R.warn = (...a) => warnSink.push(a.join(' '));
  const provOf = (reg, id) => (L.prov[reg] && L.prov[reg][id]) || null;
  const own = (reg, id) => { const f = provOf(reg, id); return f ? ownerOfFile(f) : expectedOwner(reg, id); };
  const E = (check, owner, msg) => rep.add('error', check, owner, msg);
  const W = (check, owner, msg) => rep.add('warn', check, owner, msg);
  const P = (check, owner, msg) => rep.add('pending', check, owner, msg);
  const gfx = (k) => !!(R.Gfx && R.Gfx._defs && has(R.Gfx._defs, k));
  const K = (R.Rules && R.Rules.K) || {};
  const U = K.U || [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
  const Wt = K.W || [8, 14, 21, 30, 40, 51, 64, 78, 94, 112];
  const Df = typeof K.D === 'function' ? K.D : (T) => 70 + 30 * T;
  const n = (reg) => Object.keys(DB[reg] || {}).length;
  const empty = (reg) => n(reg) === 0;
  const on = (ck) => !opts.only || opts.only.includes(ck);

  // ------------------------------------------------------------------ LOAD
  for (const e of L.loadErrors) E('LOAD', ownerOfFile(e.rel), `${e.rel}: load error ${e.msg}`);

  const items = DB.items, actions = DB.actions, mons = DB.monsters;
  const techs = Object.keys(actions).filter((id) => /^t_/.test(id) || (actions[id] && actions[id].kind === 'tech'));
  const spells = Object.keys(actions).filter((id) => /^s_/.test(id) || (actions[id] && actions[id].kind === 'spell'));
  const enemyActs = Object.keys(actions).filter((id) => /^eb?_/.test(id) || (actions[id] && actions[id].kind === 'enemy'));
  const isMob = (id) => { const m = mons[id]; return !!(m && m.lineage && !/^(rm_|b_)/.test(id)); };
  const flagsOf = (m) => (m && m.flags) || [];
  const isBoss = (id) => flagsOf(mons[id]).includes('boss') || /^b_/.test(id);
  const isRareMon = (id) => flagsOf(mons[id]).includes('rare') || /^rm_/.test(id);
  const isMetal = (id) => flagsOf(mons[id]).includes('metal');
  const monRef = (ref) => (typeof ref === 'string' && ref[0] === '@' ? (DB.lineages[ref.slice(1)] ? ref : null) : mons[ref] ? ref : null);

  // compiled maps
  const maps = {};
  for (const id of Object.keys(DB.maps)) maps[id] = M.parseMap(R, id);
  const spawnOf = (mapId, spawn) => { const P2 = maps[mapId]; if (!P2) return null; return typeof spawn === 'object' && spawn ? spawn : P2.spawns[spawn] || null; };

  // ================================================================== PENDING registries
  const REQUIRED = { heroTypes: 'A6', companions: 'A6', starterKit: 'A6', weaponTypes: 'A7', elements: 'A8', statuses: 'A8', items: 'A9', shops: 'A10b', pools: 'A10b',
    monsters: 'A11', lineages: 'A11', encounters: 'A11', troops: 'A12', rareEncounters: 'A12', regions: 'A18a', locations: 'A18a', objectives: 'A18a',
    maps: 'A18a', events: 'A18a', music: 'A17', sfx: 'A17', rumors: 'A19', tiles: 'A16b', themes: 'A16b', decor: 'A16b' };
  for (const [reg, o] of Object.entries(REQUIRED)) if (empty(reg)) P('PENDING', o, `DB.${reg} is empty (content not landed yet)`);
  if (!techs.length) P('PENDING', 'A7', 'no techs (t_*) in DB.actions');
  if (!spells.length) P('PENDING', 'A8', 'no spells (s_*) in DB.actions');
  if (!enemyActs.length) P('PENDING', 'A11', 'no enemy actions (e_*) in DB.actions');

  // ================================================================== V1 references
  if (on('V1')) {
    const V = 'V1';
    const refItem = (id, owner, where) => { if (!items[id]) E(V, owner, `${where}: item '${id}' is not registered`); };
    const refAct = (id, owner, where) => { if (!actions[id]) E(V, owner, `${where}: action '${id}' is not registered`); };
    // heroTypes / companions / starterKit
    for (const [id, h] of Object.entries(DB.heroTypes)) {
      const o = own('heroTypes', id);
      if (h.defaultWeapon) refItem(h.defaultWeapon, o, `heroTypes.${id}.defaultWeapon`);
      for (const s in h.startEquip || {}) refItem(h.startEquip[s], o, `heroTypes.${id}.startEquip.${s}`);
      for (const k of ['weapon', 'element']) for (const a of [].concat(((h.onFavor || {})[k] || {}).techs || [], ((h.onFavor || {})[k] || {}).spells || [])) refAct(a, o, `heroTypes.${id}.onFavor.${k}`);
    }
    for (const [id, c] of Object.entries(DB.companions)) {
      const o = own('companions', id);
      for (const s in c.startEquip || {}) refItem(c.startEquip[s], o, `companions.${id}.startEquip.${s}`);
      for (const a of [].concat(c.startTechs || [], c.startSpells || [])) refAct(a, o, `companions.${id}`);
    }
    const kit = DB.starterKit || {};
    for (const w of C.WTYPES) {
      if (kit.weapon && !kit.weapon[w]) E(V, 'A6', `starterKit.weapon.${w} missing`); else if (kit.weapon) refItem(kit.weapon[w], 'A6', `starterKit.weapon.${w}`);
      if (kit.tech && !kit.tech[w]) E(V, 'A6', `starterKit.tech.${w} missing`); else if (kit.tech) refAct(kit.tech[w], 'A6', `starterKit.tech.${w}`);
    }
    for (const el of C.ELEMENTS) { if (kit.spell && !kit.spell[el]) E(V, 'A6', `starterKit.spell.${el} missing`); else if (kit.spell) refAct(kit.spell[el], 'A6', `starterKit.spell.${el}`); }
    // monsters
    for (const [id, m] of Object.entries(mons)) {
      const o = own('monsters', id);
      for (const a of m.actions || []) { const aid = typeof a === 'string' ? a : a.id; if (!['attack', 'defend', 'wait', 'flee'].includes(aid) && !actions[aid]) E(V, o, `monster ${id}: action '${aid}' is not registered`); }
      for (const slot of ['normal', 'rare', 'super', 'bonus']) {
        const d = m.drops && m.drops[slot];
        if (!d) continue;
        if (d.pool) { if (!DB.pools[d.pool]) E(V, o, `monster ${id}: drops.${slot} pool '${d.pool}' is not registered`); }
        else if (d.item) refItem(d.item, o, `monster ${id} drops.${slot}`);
        else E(V, o, `monster ${id}: drops.${slot} has neither item nor pool`);
      }
      if (m.lineage && !DB.lineages[m.lineage]) E(V, o, `monster ${id}: lineage '${m.lineage}' is not registered`);
      for (const ph of m.phases || []) for (const a of ((ph.set || {}).actions || [])) { const aid = typeof a === 'string' ? a : a.id; if (aid !== 'attack' && !actions[aid]) E(V, o, `monster ${id}: phase action '${aid}' missing`); }
    }
    for (const [id, l] of Object.entries(DB.lineages)) {
      const o = own('lineages', id);
      for (const s of l.stages || []) if (!mons[s.mon]) E(V, o, `lineage ${id}: stage monster '${s.mon}' is not registered`);
      if (l.family && !DB.lineages[l.family]) E(V, o, `lineage ${id}: family '${l.family}' is not registered`);
    }
    for (const [z, e] of Object.entries(DB.encounters)) {
      const o = own('encounters', z);
      if (e.region && !C.REGION_VALUES.includes(e.region)) E(V, o, `encounters.${z}: region '${e.region}' unknown`);
      if (e.bg && !gfx('bbg:' + e.bg)) E(V, expectedOwner('gfx', 'bbg:' + e.bg), `encounters.${z}: bg 'bbg:${e.bg}' is not registered`);
      for (const [gi, g] of (e.groups || []).entries()) for (const r of g.mons || []) if (!monRef(r[0])) E(V, o, `encounters.${z} group ${gi}: monster ref '${r[0]}' unknown`);
    }
    for (const [z, r] of Object.entries(DB.rareEncounters)) {
      const o = own('rareEncounters', z);
      if (!DB.encounters[z]) E(V, o, `rareEncounters.${z}: zone is not registered`);
      if (!mons[r.mon]) E(V, o, `rareEncounters.${z}: monster '${r.mon}' is not registered`);
    }
    for (const [t, tr] of Object.entries(DB.troops)) {
      const o = own('troops', t);
      for (const r of tr.mons || []) if (!monRef(r[0])) E(V, o, `troop ${t}: monster ref '${r[0]}' unknown`);
      if (tr.bg && !gfx('bbg:' + tr.bg)) E(V, expectedOwner('gfx', 'bbg:' + tr.bg), `troop ${t}: bg 'bbg:${tr.bg}' is not registered`);
      if (tr.bgm && !C.BGM.includes(tr.bgm)) E(V, o, `troop ${t}: bgm '${tr.bgm}' is not in §11.11.4`);
    }
    for (const t of C.TROOPS) if (!empty('troops') && !DB.troops[t]) E(V, 'A12', `troop ${t} (§10.13.5) is not registered`);
    // shops / pools
    for (const [s, sh] of Object.entries(DB.shops)) {
      const o = own('shops', s);
      for (const i of sh.items || []) refItem(i, o, `shop ${s}`);
      for (const st of sh.stock || []) { for (const i of st.items || []) refItem(i, o, `shop ${s} stock T${st.tier}`); for (const p of Cond.validate(st.cond, { items, regions: DB.regions })) E(V, o, `shop ${s}: ${p}`); }
    }
    for (const [p, pl] of Object.entries(DB.pools)) {
      const o = own('pools', p);
      for (const [T, tier] of (pl.tiers || []).entries()) for (const e of tier || []) if (e.item) refItem(e.item, o, `pool ${p} T${T}`);
    }
    // regions / locations / objectives / config
    for (const [r, g] of Object.entries(DB.regions)) {
      const o = own('regions', r);
      if (g.fragment) refItem(g.fragment, o, `regions.${r}.fragment`);
      for (const l of g.locations || []) if (!DB.locations[l]) E(V, o, `regions.${r}: location '${l}' unknown`);
      if (g.bossTroop && !DB.troops[g.bossTroop]) E(V, o, `regions.${r}: bossTroop '${g.bossTroop}' unknown`);
    }
    const cfg = DB.config || {};
    if (cfg.start) { if (!DB.maps[cfg.start.map]) E(V, 'A18a', `config.start map '${cfg.start.map}' unknown`); else if (!spawnOf(cfg.start.map, cfg.start.spawn)) E(V, 'A18a', `config.start spawn '${cfg.start.spawn}' not on ${cfg.start.map}`); }
    if (cfg.postgameStart) { if (!DB.maps[cfg.postgameStart.map]) E(V, 'A18a', `config.postgameStart map '${cfg.postgameStart.map}' unknown`); else if (!spawnOf(cfg.postgameStart.map, cfg.postgameStart.spawn)) E(V, 'A18a', `config.postgameStart spawn '${cfg.postgameStart.spawn}' missing`); }
    if (cfg.startObjective && !DB.objectives[cfg.startObjective]) E(V, 'A18a', `config.startObjective '${cfg.startObjective}' unknown`);
    for (const i in cfg.startItems || {}) refItem(i, 'A18a', 'config.startItems');
    if (cfg.defaultHero && !empty('heroTypes') && !DB.heroTypes[cfg.defaultHero.type]) E(V, 'A18a', `config.defaultHero.type '${cfg.defaultHero.type}' unknown`);
    // items: icons, use effects
    for (const [id, it] of Object.entries(items)) {
      if (it.icon && !gfx(it.icon.includes(':') ? it.icon : 'icon:' + it.icon)) E(V, 'A13', `item ${id}: icon '${it.icon}' is not registered`);
      if (it.exclusive && !mons[it.exclusive]) E(V, own('items', id), `item ${id}: exclusive monster '${it.exclusive}' unknown`);
    }
    // statuses referenced by effects/mods
    const statusOk = (s) => C.BAD.includes(s) || C.GOOD.includes(s) || s === 'death' || !!DB.statuses[s];
    for (const [id, a] of Object.entries(actions)) {
      const o = own('actions', id);
      for (const e of a.effects || []) {
        if (e.type === 'status' && !statusOk(e.status)) E(V, o, `action ${id}: status '${e.status}' unknown`);
        if (e.type === 'summon' && e.mon && !['same', 'lower'].includes(e.mon) && !monRef(e.mon)) E(V, o, `action ${id}: summon '${e.mon}' unknown`);
      }
    }
    // maps (the per-map structural checks are V5; here only the references)
    for (const [id, P2] of Object.entries(maps)) {
      const d = P2.def, o = own('maps', id), w = `map ${id}`;
      const tgt = (t, where) => {
        if (!t || !t.to) return;
        if (!DB.maps[t.to]) { E(V, o, `${w}: ${where} → unknown map '${t.to}'`); return; }
        if (t.spawn != null && typeof t.spawn === 'string' && !spawnOf(t.to, t.spawn)) E(V, o, `${w}: ${where} → ${t.to} has no spawn '${t.spawn}'`);
      };
      for (const wp of P2.warps) tgt(wp, `warp@${wp.x},${wp.y}`);
      if (d.exit) { if (d.exit.to) tgt(d.exit, 'exit'); else for (const k in d.exit) tgt(d.exit[k], 'exit.' + k); }
      if (d.escape) tgt(d.escape, 'escape');
      if (d.encounter && !DB.encounters[d.encounter]) E(V, o, `${w}: encounter zone '${d.encounter}' unknown`);
      if (d.defaultZone && !DB.encounters[d.defaultZone]) E(V, o, `${w}: defaultZone '${d.defaultZone}' unknown`);
      const zs = new Set(); for (const z of P2.zones) if (!DB.encounters[z.zone]) zs.add(z.zone);
      for (const z of zs) E(V, o, `${w}: zone '${z}' unknown`);
      if (d.onEnter && !DB.events[d.onEnter]) E(V, o, `${w}: onEnter '${d.onEnter}' unknown`);
      if (d.theme && !DB.themes[d.theme]) E(V, o, `${w}: theme '${d.theme}' unknown`);
      if (d.bgm && !C.BGM.includes(d.bgm)) E(V, o, `${w}: bgm '${d.bgm}' is not in §11.11.4`);
      if (d.region && !C.REGION_VALUES.includes(d.region)) E(V, o, `${w}: region '${d.region}' unknown`);
      for (const nn of P2.npcs) {
        if (nn.event && !DB.events[nn.event]) E(V, o, `${w}: npc ${nn.id} event '${nn.event}' unknown`);
        if (nn.shop && !DB.shops[nn.shop]) E(V, o, `${w}: npc ${nn.id} shop '${nn.shop}' unknown`);
        if (nn.rumor && !(DB.rumors || {})[nn.rumor]) E(V, o, `${w}: npc ${nn.id} rumor '${nn.rumor}' unknown (DB.rumors, A19)`);
        if (nn.ferryFrom && !DB.maps[nn.ferryFrom] && !DB.locations[nn.ferryFrom]) E(V, o, `${w}: npc ${nn.id} ferryFrom '${nn.ferryFrom}' unknown`);
        if (nn.sprite && !gfx(nn.sprite)) E(V, expectedOwner('gfx', nn.sprite), `${w}: npc ${nn.id} sprite '${nn.sprite}' is not registered`);
        for (const pb of Cond.validate(nn.cond, { items, regions: DB.regions, companions: DB.companions, heroTypes: DB.heroTypes })) E(V, o, `${w}: npc ${nn.id} ${pb}`);
      }
      for (const e of P2.events) if (e.id && !DB.events[e.id]) E(V, o, `${w}: event '${e.id}' @${e.x},${e.y} unknown`);
      for (const c of P2.chests) if (c.pool && !DB.pools[c.pool]) E(V, o, `${w}: chest ${c.id} pool '${c.pool}' unknown`);
      for (const tp of P2.patches) {
        const tid = tp.tile || P2.legend[tp.ch];
        if (!tid || !DB.tiles[tid]) E(V, o, `${w}: tilePatch @${tp.x},${tp.y} tile '${tp.tile || tp.ch}' unknown`);
        for (const pb of Cond.validate(tp.cond, { items, regions: DB.regions })) E(V, o, `${w}: tilePatch ${pb}`);
      }
      for (const wp of P2.warps) for (const pb of Cond.validate(wp.cond, { items, regions: DB.regions })) E(V, o, `${w}: warp ${pb}`);
    }
    // events: run + meta tokens
    for (const [id, ev] of Object.entries(DB.events)) {
      const o = own('events', id);
      if (typeof ev.run !== 'function') E(V, o, `event ${id}: no run()`);
      if (!ev.meta) { W(V, o, `event ${id}: no meta (progress.js cannot see what it needs/gives)`); continue; }
      for (const tok of [].concat(ev.meta.needs || [], ev.meta.gives || [])) {
        const m = String(tok).match(/^(flag|item|region|recruit|var|tier|postgame):(.+)$/);
        if (!m) { E(V, o, `event ${id}: meta token '${tok}' is not flag:/item:/region:/recruit: (or var:/tier:)`); continue; }
        const [, k, v] = m;
        if (k === 'item' && !items[v]) E(V, o, `event ${id}: meta ${tok} → item unknown`);
        if (k === 'region' && !DB.regions[v] && !empty('regions')) E(V, o, `event ${id}: meta ${tok} → region unknown`);
        if (k === 'recruit' && !DB.companions[v] && !empty('companions')) E(V, o, `event ${id}: meta ${tok} → companion unknown`);
        if (k === 'flag' && !/^[a-z0-9_]+$/.test(v)) E('V2', o, `event ${id}: flag '${v}' is not snake_case`);
      }
      if (ev.meta.warp) {
        const wt = ev.meta.warp;
        for (const x of Array.isArray(wt) ? wt : [wt]) if (!DB.maps[x.to]) E(V, o, `event ${id}: meta.warp → unknown map '${x.to}'`);
          else if (x.spawn && !spawnOf(x.to, x.spawn)) E(V, o, `event ${id}: meta.warp → ${x.to} has no spawn '${x.spawn}'`);
      }
    }
    for (const [area, list] of Object.entries(C.EVENTS)) for (const id of list) if (!empty('events') && !DB.events[id]) E(V, area, `event '${id}' (§10.13.9) is not registered`);
    for (const id of C.OBJECTIVES) if (!empty('objectives') && !DB.objectives[id]) E(V, expectedOwner('objectives', id), `objective '${id}' (§10.13.8) is not registered`);
    for (const [id, ob] of Object.entries(DB.objectives)) if (!ob || !ob.text) E(V, own('objectives', id), `objective ${id}: no text`);
  }

  // ------------------------------------------------ source-text references (V1 + V12-2 + V11)
  const srcTexts = [];
  for (const rel of L.files) {
    const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    srcTexts.push({ rel, owner: ownerOfFile(rel), code: stripComments(txt) });
  }
  if (on('V1') || on('V12')) {
    for (const { rel, owner, code } of srcTexts) {
      const each = (re, fn) => { let mm; re.lastIndex = 0; while ((mm = re.exec(code))) fn(mm); };
      if (on('V1')) {
        each(/\bev\.battle\(\s*'([^']+)'/g, (mm) => { if (!DB.troops[mm[1]] && !empty('troops')) E('V1', owner, `${rel}: ev.battle('${mm[1]}') unknown troop`); });
        each(/\btroop\s*:\s*'([^']+)'/g, (mm) => { if (/^tr_/.test(mm[1]) && !DB.troops[mm[1]] && !empty('troops')) E('V1', owner, `${rel}: troop '${mm[1]}' unknown`); });
        each(/\bev\.(?:give|take|has)\(\s*'([^']+)'/g, (mm) => { if (!items[mm[1]]) E('V1', owner, `${rel}: item '${mm[1]}' unknown`); });
        each(/\bev\.shop\(\s*'([^']+)'/g, (mm) => { if (!DB.shops[mm[1]]) E('V1', owner, `${rel}: shop '${mm[1]}' unknown`); });
        each(/\bev\.setObjective\(\s*'([^']+)'/g, (mm) => { if (!DB.objectives[mm[1]]) E('V1', owner, `${rel}: objective '${mm[1]}' unknown`); });
        each(/\bev\.(?:clearRegion|cleared)\(\s*'([^']+)'/g, (mm) => { if (!DB.regions[mm[1]] && !empty('regions')) E('V1', owner, `${rel}: region '${mm[1]}' unknown`); });
        each(/\bev\.(?:recruit|inParty|recruited)\(\s*'([^']+)'/g, (mm) => { if (!DB.companions[mm[1]] && !empty('companions')) E('V1', owner, `${rel}: companion '${mm[1]}' unknown`); });
        each(/\bev\.call\(\s*'([^']+)'/g, (mm) => { if (!DB.events[mm[1]]) E('V1', owner, `${rel}: ev.call('${mm[1]}') unknown event`); });
        each(/\bev\.warp\(\s*'([^']+)'\s*,\s*'([^']+)'/g, (mm) => {
          if (!DB.maps[mm[1]]) { if (!empty('maps')) E('V1', owner, `${rel}: ev.warp map '${mm[1]}' unknown`); } else if (!spawnOf(mm[1], mm[2])) E('V1', owner, `${rel}: ev.warp spawn ${mm[1]}:${mm[2]} unknown`);
        });
      }
      if (on('V12')) {
        each(/\b(?:R\.sfx|ev\.sfx|R\.Audio\.sfx)\(\s*'([^']+)'/g, (mm) => { if (!C.SFX.includes(mm[1])) E('V12', owner, `${rel}: sfx '${mm[1]}' is not in §11.11.4`); });
        each(/\b(?:R\.bgm|ev\.bgm|playBGM|pushBGM)\(\s*'([^']+)'/g, (mm) => { if (!C.BGM.includes(mm[1])) E('V12', owner, `${rel}: bgm '${mm[1]}' is not in §11.11.4`); });
        each(/\b(?:R\.jingle|ev\.jingle|playJingle)\(\s*'([^']+)'/g, (mm) => { if (!C.JINGLES.includes(mm[1])) E('V12', owner, `${rel}: jingle '${mm[1]}' is not in §11.11.4`); });
      }
    }
  }

  // ================================================================== V2 id forms
  if (on('V2')) {
    const V = 'V2';
    const PREFIX = { weapon: 'w_', shield: 'sh_', head: 'hd_', body: 'bd_', hands: 'hn_', feet: 'ft_', acc: 'ac_', consumable: 'i_', key: 'k_' };
    for (const [id, it] of Object.entries(items)) {
      if (/^pmz__/.test(id)) continue;
      const o = own('items', id);
      if (!C.ITEM_TYPES.includes(it.type)) { E(V, o, `item ${id}: type '${it.type}' unknown`); continue; }
      if (!id.startsWith(PREFIX[it.type])) E(V, o, `item ${id}: a ${it.type} id must start with '${PREFIX[it.type]}'`);
      if (it.type === 'weapon' && !id.startsWith(`w_${it.wtype}_`)) E(V, o, `item ${id}: weapon id must be w_${it.wtype}_…`);
    }
    for (const [id, a] of Object.entries(actions)) {
      const o = own('actions', id);
      if (a.kind === 'tech') { if (!new RegExp(`^t_${a.wtype}_[a-z0-9_]+$`).test(id)) E(V, o, `tech ${id}: id must be t_<wtype>_… with wtype '${a.wtype}'`); }
      else if (a.kind === 'spell') {
        const els = a.elements || [];
        const want = els.length === 1 ? new RegExp(`^s_${els[0]}_[1-5]$`) : els.length === 2 ? new RegExp(`^s_${els[0]}_${els[1]}_[ab]$`) : new RegExp(`^s_${els.join('_')}$`);
        if (!want.test(id)) E(V, o, `spell ${id}: id does not match elements [${els}] (§7.0 の 0.2)`);
      } else if (a.kind === 'enemy') { if (!/^eb?_[a-z0-9_]+$/.test(id)) E(V, o, `enemy action ${id}: id must be e_… or eb_…`); }
      else E(V, o, `action ${id}: kind '${a.kind}' must be tech / spell / enemy`);
      if (/^t_/.test(id) && a.kind !== 'tech') E(V, o, `action ${id}: t_ id with kind '${a.kind}'`);
      if (/^s_/.test(id) && a.kind !== 'spell') E(V, o, `action ${id}: s_ id with kind '${a.kind}'`);
      if (/^eb?_/.test(id) && a.kind !== 'enemy') E(V, o, `action ${id}: e_ id with kind '${a.kind}'`);
    }
    for (const [id, m] of Object.entries(mons)) {
      const o = own('monsters', id);
      if (/^rm_/.test(id) || /^b_/.test(id)) continue;
      if (!m.lineage) { E(V, o, `monster ${id}: not rm_/b_ and no lineage`); continue; }
      if (id !== `${m.lineage}_${m.stage}`) E(V, o, `monster ${id}: id must be <lineage>_<stage> (${m.lineage}_${m.stage})`);
    }
    for (const id of Object.keys(DB.lineages)) if (!/^[a-z][a-z0-9_]*$/.test(id)) E(V, own('lineages', id), `lineage ${id}: not snake_case`);
    for (const id of Object.keys(DB.troops)) if (!/^tr_[a-z0-9_]+$/.test(id)) E(V, own('troops', id), `troop ${id}: must be tr_…`);
    for (const [id, e] of Object.entries(DB.encounters)) {
      const o = own('encounters', id);
      if (/^zw_/.test(id)) continue;
      const m = id.match(/^z_(r_[a-z]+|prologue|finale|postgame)_[a-z0-9_]+$/);
      if (!m) E(V, o, `zone ${id}: must be z_<regionId>_… or zw_…`);
      else if (e.region && e.region !== m[1]) E(V, o, `zone ${id}: region '${e.region}' differs from the id's '${m[1]}'`);
    }
    for (const id of Object.keys(DB.pools)) if (!/^p_[a-z0-9_]+$/.test(id)) E(V, own('pools', id), `pool ${id}: must be p_…`);
    for (const id of Object.keys(DB.shops)) {
      const m = id.match(/^([a-z0-9_]+)_(item|weapon|armor|magic)$/);
      if (id !== 'coral_regnas' && (!m || (!empty('locations') && !DB.locations[m[1]]))) E(V, own('shops', id), `shop ${id}: must be <town locationId>_<item|weapon|armor|magic>`);
    }
    for (const id of Object.keys(DB.objectives)) if (!/^obj_(w_[a-z0-9_]+|regions|s_[a-z0-9_]+|p_[a-z0-9_]+|(forest|desert|snow|marsh|isles|mine|ash|star)_\d+)$/.test(id)) E(V, own('objectives', id), `objective ${id}: prefix not in §10.13.8`);
    // events <mapid>_<name> | story_ | common_
    const mapIds = Object.keys(DB.maps).sort((a, b) => b.length - a.length);
    for (const id of Object.keys(DB.events)) {
      if (/^(story|common)_[a-z0-9_]+$/.test(id)) continue;
      if (!mapIds.some((m) => id.startsWith(m + '_')) && !C.MAPS.some((m) => id.startsWith(m + '_')) && !/^(roa_house|oblivion_\d|archive_\d)_/.test(id)) W(V, own('events', id), `event ${id}: id should be <mapId>_<name> or story_/common_`);
    }
    // chest ids: explicit, <mapid>_c<n>, unique
    const seen = {};
    for (const [id, P2] of Object.entries(maps)) {
      const o = own('maps', id), d = P2.def;
      const raw = [];
      for (const ch in d.marks || {}) if (d.marks[ch].chest) raw.push({ where: `mark '${ch}'`, id: d.marks[ch].chest.id, n: (d.rows || []).join('').split(ch).length - 1 });
      for (const c of d.chests || []) raw.push({ where: `chest @${c.x},${c.y}`, id: c.id, n: 1 });
      const inMap = {};
      for (const r of raw) {
        if (r.id && inMap[r.id]) E(V, o, `map ${id}: duplicate chest id ${r.id} (${inMap[r.id]} and ${r.where})`);
        if (r.id) inMap[r.id] = r.where;
        if (!r.id) E(V, o, `map ${id}: ${r.where} has no explicit chest id (§3.1.4)`);
        else if (!new RegExp(`^${id}_c\\d+$`).test(r.id)) E(V, o, `map ${id}: chest id '${r.id}' must be ${id}_c<n>`);
        if (r.id && r.n > 1) E(V, o, `map ${id}: chest mark '${r.id}' is used ${r.n} times (auto-numbered ids break saves)`);
      }
      for (const c of P2.chests) {
        if (seen[c.id] && seen[c.id] !== id) E(V, o, `map ${id}: duplicate chest id ${c.id} (also on ${seen[c.id]})`);
        seen[c.id] = id;
      }
    }
    // flags & vars in conds: snake_case
    const badFlag = new Set();
    const scanCond = (cond, o, where) => { const r = Cond.refs(cond); for (const f of r.flags) if (!/^[a-z0-9_]+$/.test(f) && !badFlag.has(f)) { badFlag.add(f); E(V, o, `${where}: flag '${f}' is not snake_case`); } };
    for (const [id, P2] of Object.entries(maps)) {
      const o = own('maps', id);
      for (const x of [].concat(P2.npcs, P2.events, P2.chests, P2.warps, P2.patches, P2.signs)) scanCond(x.cond, o, `map ${id}`);
    }
  }

  // ================================================================== V3 names
  if (on('V3')) {
    const V = 'V3';
    const lim = (w, max, o, what) => { if (w > max + 1e-9) E(V, o, `${what} is ${w} wide (max ${max})`); };
    const dh = (DB.config || {}).defaultHero;
    if (dh && dh.name) lim(textWidth(R, dh.name), 5, 'A18a', `config.defaultHero.name '${dh.name}'`);
    for (const [id, c] of Object.entries(DB.companions)) if (c.name) lim(textWidth(R, c.name), 5, own('companions', id), `companion ${id} name '${c.name}'`);
    for (const id of techs.concat(spells)) {
      const a = actions[id], o = own('actions', id);
      if (!a.name) { E(V, o, `${id}: no name`); continue; }
      lim(textWidth(R, a.name), 8, o, `${id} name '${a.name}'`);
      if (!a.desc) E(V, o, `${id}: no desc`); else { if (/\n/.test(a.desc)) E(V, o, `${id}: desc must be 1 line`); lim(textWidth(R, a.desc), 20, o, `${id} desc`); }
    }
    for (const [id, it] of Object.entries(items)) {
      if (/^pmz__/.test(id)) continue;
      const o = own('items', id);
      if (!it.name) { E(V, o, `item ${id}: no name`); continue; }
      lim(textWidth(R, it.name), 9, o, `item ${id} name '${it.name}'`);
      if (!it.desc) E(V, o, `item ${id}: no desc`);
      else { const ls = String(it.desc).split('\n'); if (ls.length > 2) E(V, o, `item ${id}: desc has ${ls.length} lines (max 2)`); ls.forEach((l, i) => lim(textWidth(R, l), 20, o, `item ${id} desc line ${i + 1}`)); }
    }
    for (const [id, m] of Object.entries(mons)) {
      const o = own('monsters', id);
      if (!m.name) { E(V, o, `monster ${id}: no name`); continue; }
      lim(textWidth(R, m.name), 8, o, `monster ${id} name '${m.name}'`);
      if (!isBoss(id) && !isRareMon(id) && !isMetal(id)) {
        let gn = m.goldName;
        if (!gn) gn = (R.Mon && R.Mon.goldenName) ? (() => { try { return R.Mon.goldenName(m); } catch (e) { return null; } })() : null;
        if (!gn) gn = (textWidth(R, m.name) <= 5 ? '金色の' : '金の') + m.name;
        lim(textWidth(R, gn), 10, o, `monster ${id} golden name '${gn}'`);
      }
      if (m.desc) { const ls = String(m.desc).split('\n'); if (ls.length > 2) E(V, o, `monster ${id}: desc has ${ls.length} lines`); ls.forEach((l, i) => lim(textWidth(R, l), 20, o, `monster ${id} desc line ${i + 1}`)); }
    }
    for (const [id, r] of Object.entries(DB.regions)) if (r.name) lim(textWidth(R, r.name), 10, own('regions', id), `region ${id} name '${r.name}'`);
    for (const [id, l] of Object.entries(DB.locations)) if (l.name) lim(textWidth(R, l.name), 10, own('locations', id), `location ${id} name '${l.name}'`);
    for (const [id, P2] of Object.entries(maps)) if (P2.def.name) lim(textWidth(R, P2.def.name), 10, own('maps', id), `map ${id} name '${P2.def.name}'`);
    // overlapping display names across categories (Rowell excepted; enemy spells may reuse 1–3段 single spell names, §7.0 の 0.13)
    const byName = {};
    const addName = (name, cat, id) => { if (!name) return; (byName[name] = byName[name] || []).push({ cat, id }); };
    for (const [id, it] of Object.entries(items)) if (!/^pmz__/.test(id)) addName(it.name, 'item', id);
    for (const [id, m] of Object.entries(mons)) addName(m.name, 'monster', id);
    for (const id of techs) addName(actions[id].name, 'tech', id);
    for (const id of spells) addName(actions[id].name, 'spell', id);
    for (const id of enemyActs) addName(actions[id].name, 'enemy', id);
    const lowSpell = new Set(spells.filter((id) => /^s_[a-z]+_[123]$/.test(id)).map((id) => actions[id].name));
    for (const [name, list] of Object.entries(byName)) {
      if (list.length < 2) continue;
      const cats = new Set(list.map((x) => x.cat));
      let bad = list;
      if (cats.size === 1 && cats.has('enemy')) continue;                                 // one enemy move shared by several ids
      if (cats.size === 1 && cats.has('monster') && list.every((x) => /^b_rowell/.test(x.id))) continue;
      bad = list.filter((x) => !(x.cat === 'enemy' && lowSpell.has(name)) && !(x.cat === 'monster' && /^b_rowell/.test(x.id)));
      const cats2 = new Set(bad.map((x) => x.cat));
      const dupSame = bad.length > 1 && cats2.size === 1 && !cats2.has('enemy');
      if (cats2.size > 1 || dupSame) {
        const first = bad[0];
        const reg = first.cat === 'item' ? 'items' : first.cat === 'monster' ? 'monsters' : 'actions';
        E(V, own(reg, first.id), `display name '${name}' is used by ${bad.map((x) => x.cat + ' ' + x.id).join(', ')}`);
      }
    }
  }

  // ================================================================== V4 mods
  if (on('V4')) {
    const V = 'V4';
    const checkModsShape = (mods, o, where) => {
      if (!mods) return;
      if (typeof mods !== 'object') { E(V, o, `${where}: mods is not an object`); return; }
      for (const [k, v] of Object.entries(mods)) {
        const t = C.MODS[k];
        if (!t) { E(V, o, `${where}: mods key '${k}' is not in §3.3.16`); continue; }
        const bad = (m) => E(V, o, `${where}: mods.${k} ${m}`);
        if (t === 'n' && !isNum(v)) bad('must be a number');
        if (t === 'b' && v !== true) bad('must be true');
        if (t === 'emap') { if (typeof v !== 'object') bad('must be {element: value}'); else for (const e in v) { if (!C.ELEMENTS.includes(e)) bad(`element '${e}' unknown`); if (!isNum(v[e])) bad(`${e} must be a number`); if (k === 'elemResist' && !C.ELEM_VALUES.includes(v[e])) bad(`${e} ${v[e]} is not one of ${C.ELEM_VALUES.join('/')}`); } }
        if (t === 'slist') { if (!Array.isArray(v)) bad('must be an array'); else for (const s of v) if (![...C.BAD, 'death'].includes(s)) bad(`status '${s}' unknown`); }
        if (t === 'smap') { if (typeof v !== 'object') bad('must be {status: 0..1}'); else for (const s in v) { if (![...C.BAD, 'death'].includes(s)) bad(`status '${s}' unknown`); if (!isNum(v[s]) || v[s] < -1 || v[s] > 1) bad(`${s} must be −1..1`); } }
        if (t === 'pmap' || t === 'gmap') { if (typeof v !== 'object') bad('must be a map'); else for (const q in v) if (![...C.WTYPES, ...C.ELEMENTS, ...(t === 'gmap' ? ['tech', 'spell'] : [])].includes(q)) bad(`key '${q}' unknown`); }
        if (t === 'bmap') { if (typeof v !== 'object') bad('must be {stat: stages}'); else for (const s in v) { if (!C.BUFFS.includes(s)) bad(`stat '${s}' unknown`); if (![-2, -1, 1, 2].includes(v[s])) bad(`${s} must be ±1..2`); } }
      }
    };
    const classOf = (it) => {
      if (it.src === 'relic' || it.src === 'reward') return it.grade === 'super' ? 4 : 3;
      if (it.grade === 'super') return 2;
      if (it.grade === 'rare') return 1;
      return 0;
    };
    const CLASS_NAME = ['normal', 'rare', 'super', 'relic/reward (rare)', 'relic/reward (super)'];
    for (const [id, it] of Object.entries(items)) {
      if (/^pmz__/.test(id)) continue;
      const o = own('items', id);
      checkModsShape(it.mods, o, `item ${id}`);
      if (!it.mods || it.type === 'consumable' || it.type === 'key') continue;
      const cl = classOf(it), qi = cl === 2 || cl === 4 ? 1 : 0;
      const T = it.tier || 0;
      for (const [k, v] of Object.entries(it.mods)) {
        if (!C.MODS[k]) continue;
        if (k === 'physPct' && id === 'w_greatsword_sr_frenzy' && v <= 50) continue;                   // §8.3.5 exception
        const caps = C.CAPS[k];
        const over = (msg) => E(V, o, `item ${id} (${CLASS_NAME[cl]}): mods.${k} ${msg} (§8.3.5)`);
        if (k === 'elemResist') {
          const vals = Object.values(v || {});
          const good = vals.filter((x) => x < 1), badv = vals.filter((x) => x > 1);
          const min = good.length ? Math.min(...good) : 1;
          // tiers of strength with a count limit each (a stronger value also counts toward the weaker tiers)
          const RULES = { 0: [[0.5, 1]], 1: [[0.75, 4], [0.5, 2], [0, 1]], 2: [[0.5, 4], [0, 2], [-1, 1]], 3: [[0.5, 4], [-1, 1]], 4: [[0.5, 4], [-1, 1]] }[cl];
          const floor = RULES[RULES.length - 1][0];
          if (good.some((x) => x < floor)) over(`${Math.min(...good)} is stronger than ${floor}`);
          for (const [lim, cnt] of RULES) { const k2 = good.filter((x) => x <= lim).length; if (k2 > cnt) over(`${k2} element(s) at ≤ ${lim} (max ${cnt})`); }
          for (const b of badv) if (b > [1.25, 1.25, 2, 1.25, 2][cl]) over(`weakness ${b} is beyond the quirk table`);
          continue;
        }
        if (k === 'statusImmune') { const cnt = (v || []).length; const cap = it.src === 'reward' ? 2 : [0, 1, 3, 1, 2][cl]; if (cnt > cap) over(`${cnt} statuses (max ${cap})`); continue; }
        if (k === 'statusResist') {
          const vals = Object.values(v || {}); const pos = vals.filter((x) => x > 0);
          const capV = [0.5, 0.5, 0.6, 0.5, 0.6][cl], capN = [1, 3, 3, 3, 3][cl];
          if (pos.some((x) => x > capV + 1e-9) || pos.length > capN) over(`${pos.length}×≤${Math.max(0, ...pos)} (max ${capN}×${capV})`);
          if (vals.some((x) => x < -[0.25, 0.25, 0.5, 0.25, 0.5][cl] - 1e-9)) over('negative beyond the quirk table');
          continue;
        }
        if (k === 'startBuffs') { const cnt = Object.keys(v || {}).length; const cap = [0, 1, 2, 0, 2][cl]; if (cnt > cap || Object.values(v || {}).some((x) => x > 1)) over(`${cnt} buff(s) (max ${cap} × +1)`); continue; }
        if (k === 'regen' || k === 'noFloorDamage' || k === 'noSpell') { if (k === 'regen' && cl === 0) over('not allowed on normal items'); continue; }
        if (k === 'profPct' || k === 'glimPct' || k === 'elemBoost') {
          for (const [q, x] of Object.entries(v || {})) {
            if (x < 0) { const qc = k === 'glimPct' ? C.QUIRK.glimPct[qi] : 0; if (-x > qc) over(`${q} ${x} beyond the quirk table`); continue; }
            let cap = caps && caps[cl];
            if (k === 'glimPct' && cl === 2 && T < 9) cap = 20;
            if (cap == null) over(`not used for this class`); else if (x > cap) over(`${q} +${x} > ${cap}`);
          }
          continue;
        }
        if (!isNum(v)) continue;
        const penaltyUp = C.PENALTY_UP.has(k);
        const beneficial = k === 'encounterPct' ? true : penaltyUp ? v < 0 : v > 0;
        if (beneficial) {
          let cap = caps ? caps[cl] : undefined;
          if (k === 'mag') cap = cl === 1 ? T : cl === 2 ? 2 * T : null;
          if (k === 'encounterPct' && cl > 0 && v > 0) { if (v > C.QUIRK.encounterPct[qi]) over(`+${v} > quirk cap`); continue; }
          if (cap == null) { over(`${v} — this key is not used for ${CLASS_NAME[cl]} items`); continue; }
          if (Math.abs(v) > cap + 1e-9) over(`${v} beyond ±${cap}`);
        } else {
          const q = C.QUIRK[k];
          if (!q) { over(`${v}: a penalty with no quirk rule`); continue; }
          if (Math.abs(v) > q[qi] + 1e-9) over(`${v} beyond the quirk cap ${q[qi]}`);
          if (!it.quirk) W(V, o, `item ${id}: mods.${k} ${v} is a quirk but the item has no quirk:true`);
        }
      }
      if (it.grade === 'normal' && it.src === 'shop' && !(it.type === 'acc' && !it.units)) E(V, o, `item ${id}: normal equipment must not have mods (§8.3.2)`);
    }
    for (const [id, c] of Object.entries(DB.companions)) checkModsShape(c.innate && c.innate.mods, own('companions', id), `companion ${id} innate`);
    for (const [id, h] of Object.entries(DB.heroTypes)) checkModsShape(h.mods, own('heroTypes', id), `heroType ${id}`);
  }

  // ================================================================== V5 maps
  if (on('V5')) {
    const V = 'V5';
    const isWallTile = (tid) => { const t = DB.tiles[tid]; return !!(t && !t.pass && tid !== 'void' && !t.ship); };
    for (const [id, P2] of Object.entries(maps)) {
      const d = P2.def, o = own('maps', id), w = `map ${id}`;
      const kind = M.kindOf(P2);
      for (const iss of [...new Set(P2.issues)]) {
        if (/warp to unknown map|unknown event|unknown onEnter|uses unknown event|has unknown item|chest without id/.test(iss)) continue;   // reported by V1 / V2
        (/unknown|out of bounds|unequal|no rows|not found|threw|duplicate spawn/.test(iss) ? E : W)(V, o, `${w}: ${iss}`);
      }
      if (d.type !== 'world') {
        if (d.outside == null) E(V, o, `${w}: no 'outside' (required on every local map, §3.3.10)`);
        const small = kind === 'dungeon' ? P2.w < 34 || P2.h < 30 : P2.w < 40 || P2.h < 32;
        if (small && d.outside != null && !isWallTile(P2.outside)) E(V, o, `${w}: ${P2.w}×${P2.h} is below the ${kind === 'dungeon' ? '34×30' : '40×32'} minimum, so 'outside' must be a wall (is '${P2.outside}')`);
        else if (small && kind === 'town') W(V, o, `${w}: town map ${P2.w}×${P2.h} is below 40×32 (fine only for a boss floor or a house)`);
        if (!['town', 'dungeon', 'castle', 'village', 'house'].includes(d.type || 'town')) W(V, o, `${w}: type '${d.type}'`);
      }
      if (P2.hidden.length || (Array.isArray(d.hidden) && d.hidden.length) || Object.values(d.marks || {}).some((mk) => mk.hidden)) E(V, o, `${w}: 'hidden' items are abolished (§1.0 の 0.20): use a visible chest`);
      for (const c of P2.chests) {
        if (c.item) E(V, o, `${w}: chest ${c.id} has a fixed item '${c.item}' (chests use pool only, §8.12.1)`);
        if (!c.pool && !c.item) E(V, o, `${w}: chest ${c.id} has no pool`);
        if (c.gold != null && !c.pool) E(V, o, `${w}: chest ${c.id} has fixed gold (use p_gold)`);
        if (!P2.inMap(c.x, c.y)) E(V, o, `${w}: chest ${c.id} out of bounds`);
        else { const t = DB.tiles[P2.tileAt(c.x, c.y)]; if (t && !t.pass && !t.counter) W(V, o, `${w}: chest ${c.id} on impassable tile ${P2.tileAt(c.x, c.y)}`); }
      }
      for (const nn of P2.npcs) {
        const raw = nn;
        if (!raw.fixed && !raw.push && !/^(mon|obj):/.test(nn.sprite || '')) W(V, o, `${w}: npc ${nn.id} has neither fixed nor push (§10.13.10)`);
        if (C.NPC_FIXED.includes(String(nn.id).replace(/_\d+$/, '')) && !raw.fixed) E(V, o, `${w}: npc ${nn.id} must be fixed:true (§10.13.10)`);
        if (['folk_a', 'folk_b', 'scribe'].includes(nn.id) && !raw.push) W(V, o, `${w}: npc ${nn.id} should be push:true (§10.13.10)`);
        if (!P2.inMap(nn.x, nn.y)) continue;
        const t = DB.tiles[P2.tileAt(nn.x, nn.y)], dd = P2.decorDef(nn.x, nn.y);
        const obj = /^(mon|obj|fieldmon):/.test(nn.sprite || '');
        if (t && !t.pass && !obj && !t.counter) W(V, o, `${w}: npc ${nn.id} stands on impassable tile ${P2.tileAt(nn.x, nn.y)}`);
        if (dd && !dd.pass && !obj) W(V, o, `${w}: npc ${nn.id} stands on furniture ${P2.decorAt(nn.x, nn.y)}`);
      }
      for (const wp of P2.warps) if (!P2.inMap(wp.x, wp.y)) E(V, o, `${w}: warp out of bounds @${wp.x},${wp.y}`);
      // doors and warp cells must be enterable: furniture (without pass/over) in front of a door walls a building off
      if (d.type !== 'world') {
        const free = (x, y) => {
          if (!P2.inMap(x, y)) return false;
          const t = DB.tiles[P2.tileAt(x, y)], dd = P2.decorDef(x, y);
          return !!(t && (t.pass || t.lock || t.closed) && !(dd && !dd.pass && !dd.over));
        };
        const blockedBy = (x, y) => { const dd = P2.decorDef(x, y); const t = DB.tiles[P2.tileAt(x, y)]; return dd && !dd.pass && !dd.over && t && t.pass ? `${P2.decorAt(x, y)}@${x},${y}` : null; };
        const cells = new Map();
        for (let y = 0; y < P2.h; y++) for (let x = 0; x < P2.w; x++) { const tid = P2.tileAt(x, y); if (/^door/.test(tid) || (DB.tiles[tid] || {}).door) cells.set(y * P2.w + x, [x, y, 2, tid]); }
        for (const wp of P2.warps) if (P2.inMap(wp.x, wp.y)) { const k = wp.y * P2.w + wp.x; cells.set(k, [wp.x, wp.y, 1, (cells.has(k) ? 'door ' : '') + 'warp→' + wp.to]); }
        for (const [x, y, need, what] of cells.values()) {
          // a door is a corridor between two sides: an error when nothing around it is walkable, or when one
          // side is floor walled off by furniture while the other side is open (a facade door with a roof
          // behind it is fine; a warp cell needs one open side)
          const onEdge = x === 0 || y === 0 || x === P2.w - 1 || y === P2.h - 1;
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          const nFree = nb.filter(([dx, dy]) => free(x + dx, y + dy)).length;
          const walled = nb.filter(([dx, dy]) => blockedBy(x + dx, y + dy) && (free(x - dx, y - dy) || need === 1)).map(([dx, dy]) => blockedBy(x + dx, y + dy));
          if (walled.length && nFree < 2) E(V, o, `${w}: ${what} at ${x},${y} is walled off by decor ${walled.join(', ')} (furniture must not stand in front of a door)`);
          else if (!nFree && !onEdge) E(V, o, `${w}: ${what} at ${x},${y} has no walkable neighbour`);
        }
      }
      if (d.type === 'town' || d.type === 'village' || d.type === 'castle') {
        if (!P2.spawns.entrance && kind !== 'house') E(V, o, `${w}: town map without spawn 'entrance'`);
        if (kind === 'town' && C.TOWNS[id] && id !== 'roa' && !P2.spawns.inn) E(V, o, `${w}: town map without spawn 'inn' (§10.6.1)`);
        if (['lute', 'loch', 'coral', 'biblia'].includes(id) && !P2.spawns.dock) E(V, o, `${w}: port town without spawn 'dock'`);
        if (id === 'nerei' && !P2.spawns.pier) E(V, o, `${w}: nerei without spawn 'pier'`);
      }
      if (d.type === 'dungeon') {
        const m = id.match(/^(.*)_(\d+)$/);
        if (m && m[2] === '1' && !P2.spawns.entrance) E(V, o, `${w}: first floor without spawn 'entrance'`);
        if (!d.escape) E(V, o, `${w}: dungeon floor without 'escape' (§10.6.2-3)`);
        if (!d.encounter && !P2.zones.length && !/_boss$/.test(id)) W(V, o, `${w}: dungeon floor without encounter zone`);
        if (m && +m[2] >= 2 && d.lvOff == null && !(DB.events[d.onEnter] || P2.events.some((e) => /boss/.test(e.id || '')))) W(V, o, `${w}: floor ${m[2]} has no lvOff:2 (§10.6.2-9; boss floors leave it out)`);
        if (/^oblivion_/.test(id) && d.chestTier !== 9) E(V, o, `${w}: oblivion floors need chestTier:9`);
        if (/^archive_/.test(id) && d.chestTier !== 8) E(V, o, `${w}: archive floors need chestTier:8`);
      }
      if (d.decorLegend) {
        const glob = DB.legends.decor || {};
        for (const ch in d.decorLegend) { if (has(glob, ch) && glob[ch] !== d.decorLegend[ch]) E('V12', o, `${w}: decorLegend char '${ch}' overrides the global decor legend (${glob[ch]})`); if (!DB.decor[d.decorLegend[ch]]) E(V, o, `${w}: decorLegend '${ch}' → decor '${d.decorLegend[ch]}' unknown`); }
      }
      for (const z of P2.zones) if (z.x < 0 || z.y < 0 || z.x + z.w > P2.w || z.y + z.h > P2.h) W(V, o, `${w}: zone rect ${z.zone} leaves the map`);
    }
    for (const id of C.MAPS) if (!empty('maps') && !DB.maps[id]) E(V, expectedMapOwner(id) || 'A18a', `map '${id}' (§10.13.2) is not registered`);
  }

  // ================================================================== V6 world
  if (on('V6')) {
    const V = 'V6';
    const P2 = maps.world;
    if (!P2) { if (!empty('maps')) E(V, 'A18a', 'no world map'); else P('PENDING', 'A18a', 'no world map yet'); }
    else {
      if (P2.def.wrap === false) E(V, 'A18a', 'world: wrap is false (the world must loop, §10.5.1)');
      else if (P2.def.wrap !== true) W(V, 'A18a', 'world: wrap not written (engine default true; write wrap:true)');
      if (P2.w !== 128 || P2.h !== 112) W(V, 'A18a', `world: ${P2.w}×${P2.h} (spec 128×112)`);
      const sea = (tid) => { const t = DB.tiles[tid]; return !!(t && (t.ship || /sea|ocean|deep|fog/.test(tid))) ; };
      let land = 0; const ex = [];
      for (let y = 0; y < P2.h; y++) for (let x = 0; x < P2.w; x++) {
        if (!(x < 3 || y < 3 || x >= P2.w - 3 || y >= P2.h - 3)) continue;
        if (!sea(P2.tileAt(x, y))) { land++; if (ex.length < 5) ex.push(`${x},${y}:${P2.tileAt(x, y)}`); }
      }
      if (land) E(V, 'A18a', `world: ${land} non-sea tile(s) within 3 of the edge (e.g. ${ex.join(' ')})`);
      for (const [lid, [sp]] of Object.entries(C.LOCATIONS)) if (!P2.spawns[sp]) E(V, 'A18a', `world: spawn '${sp}' (§10.5.3) missing`);
    }
  }

  // ================================================================== V7 secret passages
  const secretCells = {};
  for (const [id, P2] of Object.entries(maps)) {
    let nn = 0;
    for (let y = 0; y < P2.h; y++) for (let x = 0; x < P2.w; x++) if (M.isSecret(R, P2.tileAt(x, y))) nn++;
    for (const tp of P2.patches) if (M.isSecret(R, tp.tile || P2.legend[tp.ch])) nn += (tp.w || 1) * (tp.h || 1);
    if (nn) secretCells[id] = nn;
  }
  if (on('V7')) {
    const V = 'V7';
    const floorsWith = Object.keys(secretCells).filter((id) => DB.maps[id].type !== 'world');
    for (const f of C.SECRET_FLOORS) if (DB.maps[f] && !secretCells[f]) W(V, own('maps', f), `map ${f}: no secret passage (§10.6.4 puts one here)`);
    for (const f of floorsWith) if (!C.SECRET_FLOORS.includes(f)) W(V, own('maps', f), `map ${f}: secret passage on a floor not in §10.6.4`);
    const perDungeon = {};
    for (const f of floorsWith) { const d = Object.keys(C.DUNGEONS).find((k) => f.startsWith(k + '_')); if (d) perDungeon[d] = (perDungeon[d] || 0) + 1; }
    for (const d of Object.keys(C.DUNGEONS)) {
      const want = C.SECRET_FLOORS.filter((f) => f.startsWith(d + '_')).length, got = perDungeon[d] || 0;
      if (want !== got && Object.keys(DB.maps).some((m) => m.startsWith(d + '_'))) W(V, C.DUNGEONS[d].owner, `dungeon ${d}: ${got} floor(s) with secret passages (§10.6.4: ${want})`);
    }
    const dungeonFloors = Object.keys(DB.maps).filter((id) => DB.maps[id].type === 'dungeon').length;
    if (floorsWith.length < 13) (dungeonFloors >= 30 ? E : P)(dungeonFloors >= 30 ? V : 'PENDING', 'A22', `secret passages on ${floorsWith.length} floor(s) (need ≥ 13 of 41; ${dungeonFloors} dungeon floors registered)`);
    if (maps.world) {
      let nw = 0;
      const P2 = maps.world, seen = new Set();
      for (let y = 0; y < P2.h; y++) for (let x = 0; x < P2.w; x++) if (M.isSecret(R, P2.tileAt(x, y)) && !seen.has(x + ',' + y)) {
        nw++; const q = [[x, y]]; seen.add(x + ',' + y);
        while (q.length) { const [cx, cy] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (cx + dx) + ',' + (cy + dy); if (!seen.has(k) && M.isSecret(R, P2.tileAt(cx + dx, cy + dy))) { seen.add(k); q.push([cx + dx, cy + dy]); } } }
      }
      if (nw !== 3) W(V, 'A18a', `world: ${nw} secret passage(s) (§10.6.4: 3)`);
    }
  }

  // ================================================================== V8 monsters
  if (on('V8')) {
    const V = 'V8';
    for (const [id, m] of Object.entries(mons)) {
      const o = own('monsters', id);
      for (const k of ['hue', 'sat', 'bri', 'pal']) if (has(m, k)) E(V, o, `monster ${id}: '${k}' must not be written (colour variants are MON_COMPOSE, §3.1.2)`);
      if (m.race && !C.RACES.includes(m.race)) E(V, o, `monster ${id}: race '${m.race}' unknown`);
      if (m.size && !C.SIZES.includes(m.size)) E(V, o, `monster ${id}: size '${m.size}' unknown`);
      for (const f of flagsOf(m)) if (!C.MON_FLAGS.includes(f)) E(V, o, `monster ${id}: flag '${f}' unknown`);
      if (!isBoss(id) && !isRareMon(id) && !isMetal(id) && C.COLOR_WORDS.some((cw) => String(m.name || '').startsWith(cw)) && !m.goldName) E(V, o, `monster ${id} '${m.name}': a name starting with a colour word needs goldName (§9.8)`);
      // K.MOB on mobs only
      if (R.Mon && R.Mon.curve && isNum(m.atk) && isNum(m.lv)) {
        let cv = null; try { cv = R.Mon.curve(m.lv); } catch (e) { cv = null; }
        if (cv && isNum(cv.atk)) {
          const size = { s: 0.9, m: 1, l: 1.15 }[m.size || 'm'] || 1;
          const sa = (m.s && m.s.atk) || 1;
          const full = cv.atk * size * sa;
          if (full > 8) {
            const ratio = m.atk / full;
            const mob = isMob(id) && !isMetal(id) && !isBoss(id) && !isRareMon(id);
            if (mob && ratio > 0.8) E(V, o, `monster ${id}: atk ${m.atk} ≈ curve ×${ratio.toFixed(2)} — K.MOB (×0.6) not applied (§9.13.4-12)`);
            if (!mob && !isBoss(id) && ratio < 0.7 && (isRareMon(id) || isMetal(id))) E(V, o, `monster ${id}: atk ${m.atk} ≈ curve ×${ratio.toFixed(2)} — K.MOB must not apply to rare/metal`);
          }
        }
      } else if (isMob(id) && !isNum(m.atk)) W(V, 'A2', `monster ${id}: no filled stats (R.Mon.fillStats has not run)`);
    }
    const A = (R.Art || {});
    const mobC = A.MON_COMPOSE_MOBS || {}, bossC = A.MON_COMPOSE_BOSSES || {};
    for (const id of Object.keys(mobC)) if (has(bossC, id)) E(V, 'A15a', `MON_COMPOSE: '${id}' is in both MON_COMPOSE_MOBS and MON_COMPOSE_BOSSES (§9.4.6)`);
    for (const [id, l] of Object.entries(DB.lineages)) {
      const o = own('lineages', id);
      const nS = (l.stages || []).length;
      if (l.family) { if (nS !== 2) E(V, o, `lineage ${id} (family ${l.family}): ${nS} stages (a family branch has 2)`); }
      else if (nS < 3 || nS > 5) E(V, o, `lineage ${id}: ${nS} stages (3–5)`);
      (l.stages || []).forEach((s, k) => {
        const m = mons[s.mon];
        if (m && (m.lineage !== id || m.stage !== k + 1)) E(V, own('monsters', s.mon), `monster ${s.mon}: lineage/stage ${m.lineage}/${m.stage} ≠ ${id}/${k + 1}`);
        if (k > 0 && s.tier < l.stages[k - 1].tier) E(V, o, `lineage ${id}: stage tiers not ascending`);
      });
    }
    if (!empty('lineages')) for (const l of C.LINEAGES) if (!DB.lineages[l]) E(V, 'A11', `lineage '${l}' (§9.1.3) is not registered`);
    if (!empty('monsters')) for (const r of C.RARE_MONS) if (!mons[r]) E(V, 'A12', `rare monster '${r}' (§9.10) is not registered`);
    // appear-somewhere (§9.13.4-6)
    const appears = new Set();
    const addRef = (r) => { if (typeof r !== 'string') return; if (r[0] === '@') { const l = DB.lineages[r.slice(1)]; for (const s of (l && l.stages) || []) appears.add(s.mon); } else appears.add(r); };
    for (const e of Object.values(DB.encounters)) for (const g of e.groups || []) for (const r of g.mons || []) addRef(r[0]);
    for (const tr of Object.values(DB.troops)) for (const r of tr.mons || []) addRef(r[0]);
    for (const r of Object.values(DB.rareEncounters)) appears.add(r.mon);
    for (const a of Object.values(actions)) for (const e of a.effects || []) if (e.type === 'summon' && typeof e.mon === 'string' && !['same', 'lower'].includes(e.mon)) addRef(e.mon);
    for (const m of Object.values(mons)) for (const ph of m.phases || []) if (ph.set && ph.set.summon) addRef(ph.set.summon);
    if (!empty('encounters')) for (const id of Object.keys(mons)) if (!appears.has(id) && !isBoss(id)) W(V, own('monsters', id), `monster ${id}: never appears (no zone, troop or rare encounter)`);
    // groups (§9.1.4) and rare rates
    const W_OF = { s: 32, m: 48, l: 64 };
    for (const [z, e] of Object.entries(DB.encounters)) {
      const o = own('encounters', z);
      for (const [gi, g] of (e.groups || []).entries()) {
        const sp = new Set(); let tot = 0, px = 0;
        for (const [ref, a, b] of g.mons || []) {
          const mid = ref && ref[0] === '@' ? ((DB.lineages[ref.slice(1)] || { stages: [] }).stages.slice(-1)[0] || {}).mon : ref;
          sp.add(ref); tot += b != null ? b : a; px += (W_OF[(mons[mid] || {}).size || 'm'] || 48) * (b != null ? b : a);
          if (a > (b != null ? b : a)) E('V8', o, `encounters.${z} group ${gi}: min ${a} > max ${b}`);
        }
        if (sp.size > 3) E(V, o, `encounters.${z} group ${gi}: ${sp.size} species (max 3)`);
        if (tot > 8) E(V, o, `encounters.${z} group ${gi}: up to ${tot} monsters (max 8)`);
        if (px > 256) E(V, o, `encounters.${z} group ${gi}: ${px}px wide at the maximum (max 256)`);
        if (!isNum(g.w) || g.w <= 0) E(V, o, `encounters.${z} group ${gi}: weight w missing`);
      }
      if (!(e.tier === 'dyn' || (isNum(e.tier) && e.tier >= 0 && e.tier <= 9))) E(V, o, `encounters.${z}: tier must be 'dyn' or 0..9`);
    }
    for (const [z, r] of Object.entries(DB.rareEncounters)) if (!(isNum(r.rate) && r.rate >= 1)) E(V, own('rareEncounters', z), `rareEncounters.${z}: rate ${r.rate} must be a denominator ≥ 1 (§9.0 の 0.18)`);
    // actions of monsters (§9.13.4-5)
    for (const [id, m] of Object.entries(mons)) {
      const o = own('monsters', id);
      for (const a of m.actions || []) {
        const aid = typeof a === 'string' ? a : a.id;
        if (/^s_/.test(aid)) E(V, o, `monster ${id}: uses spell '${aid}' (monsters use e_/eb_ only, §7.0 の 0.13)`);
        if (isMob(id) && /^eb_/.test(aid)) E(V, o, `monster ${id}: a mob uses boss action '${aid}'`);
        if (a && a.cond) for (const k of Object.keys(a.cond)) if (!C.MON_COND.includes(k)) E(V, o, `monster ${id}: action cond key '${k}' unknown (§9.1.7)`);
      }
      for (const [k, v] of Object.entries(m.elem || {})) { if (!C.ELEMENTS.includes(k)) E(V, o, `monster ${id}: elem '${k}' unknown`); else if (!C.ELEM_VALUES.includes(v)) E(V, o, `monster ${id}: elem.${k} ${v} not in ${C.ELEM_VALUES.join('/')}`); }
      for (const [k, v] of Object.entries(m.phys || {})) { if (!C.KINDS.includes(k)) E(V, o, `monster ${id}: phys '${k}' unknown`); else if (!C.ELEM_VALUES.includes(v)) E(V, o, `monster ${id}: phys.${k} ${v} not allowed`); }
      for (const [k, v] of Object.entries(m.statusRes || {})) { if (![...C.BAD, 'death'].includes(k)) E(V, o, `monster ${id}: statusRes '${k}' unknown`); else if (!(v >= 0 && v <= 1)) E(V, o, `monster ${id}: statusRes.${k} ${v} must be 0..1`); }
    }
    for (const id of enemyActs) {
      const a = actions[id], o = own('actions', id);
      const wide = ['enemies', 'allies', 'random', 'party'].includes(a.target);
      for (const e of a.effects || []) if (e.type === 'status' && C.BAD.includes(e.status) || (e.type === 'status' && e.status === 'death')) {
        const ch = e.chance == null ? 1 : e.chance;
        if (e.status === 'death' && (wide || ch > 0.12)) E(V, o, `enemy action ${id}: instant death ${wide ? 'on many' : ch} (single target ≤ 12%)`);
        else if (wide && ch > 0.3) E(V, o, `enemy action ${id}: ${e.status} ${ch} on many (≤ 30%)`);
        else if (!wide && ch > 0.6) E(V, o, `enemy action ${id}: ${e.status} ${ch} single (≤ 60%)`);
      }
    }
    // weakness balance (§4.7.3 · §9.3.2)
    const mobIds = Object.keys(mons).filter((id) => isMob(id) && !isMetal(id));
    if (mobIds.length >= 20) {
      for (const el of C.ELEMENTS) {
        const sp = mobIds.filter((id) => ((mons[id].elem || {})[el] || 1) >= 1.5).length / mobIds.length;
        const lins = Object.entries(DB.lineages).filter(([, l]) => !l.family);
        const lw = lins.filter(([, l]) => { const st = (l.stages || []).map((s) => mons[s.mon]).filter(Boolean); return st.length && st.filter((m) => ((m.elem || {})[el] || 1) >= 1.5).length * 2 >= st.length; }).length / Math.max(1, lins.length);
        if (sp < 0.12 || sp > 0.25) E(V, 'A11', `weakness ${el}: ${(100 * sp).toFixed(1)}% of mobs (12–25%, §4.7.3)`);
        if (lw < 0.12 || lw > 0.25) W(V, 'A11', `weakness ${el}: ${(100 * lw).toFixed(1)}% of lineages (12–25%)`);
      }
      for (const k of C.KINDS) { const sp = mobIds.filter((id) => ((mons[id].phys || {})[k] || 1) >= 1.25).length / mobIds.length; if (sp < 0.10) E(V, 'A11', `weakness ${k}: ${(100 * sp).toFixed(1)}% of mobs (≥ 10%)`); }
    }
    // sprites (§9.13.4-1)
    for (const [id, m] of Object.entries(mons)) {
      const key = 'mon:' + (m.sprite || id);
      if (!gfx(key)) E('V12', expectedOwner('gfx', isBoss(id) ? 'mon:b_' : isRareMon(id) ? 'mon:rm_' : key), `monster ${id}: sprite '${key}' is not registered`);
      if (isMob(id) && m.sprite && m.sprite !== id) E(V, own('monsters', id), `monster ${id}: a mob's sprite must be its own id (is '${m.sprite}')`);
      if (isMob(id) && Object.keys(mobC).length && !mobC[m.sprite || id]) E('V12', 'A14a', `monster ${id}: not in MON_COMPOSE_MOBS`);
    }
    const PARTS = A.PARTS || A.MON_PARTS, FILTERS = A.FILTERS || A.MON_FILTERS;
    const missP = {}, missF = {}, missB = {};
    for (const [tbl, own2] of [[mobC, 'A14a'], [bossC, 'A15a']]) for (const [id, e] of Object.entries(tbl)) {
      if (!Array.isArray(e)) { E('V12', own2, `MON_COMPOSE.${id}: entry is not [base, hsb, parts, filter?]`); continue; }
      const [base, , parts, filter] = e;
      if (base && !gfx('mon:' + base) && !((A.BASES || A.MON_BASES || {})[base])) (missB[base] = missB[base] || []).push(id);
      if (PARTS) for (const p of parts || []) { const pid = Array.isArray(p) ? p[0] : p; if (!PARTS[pid]) (missP[pid] = missP[pid] || []).push(id); }
      if (FILTERS && filter && !FILTERS[filter]) (missF[filter] = missF[filter] || []).push(id);
    }
    const users = (l) => `${l.slice(0, 6).join(' ')}${l.length > 6 ? ` … (${l.length})` : ''}`;
    for (const [p, l] of Object.entries(missP)) E('V12', 'A14a', `MON_COMPOSE part '${p}' is not in R.Art.PARTS (used by ${users(l)})`);
    for (const [f, l] of Object.entries(missF)) E('V12', 'A14a', `MON_COMPOSE filter '${f}' is not in R.Art.FILTERS (used by ${users(l)})`);
    for (const [b, l] of Object.entries(missB)) W('V12', 'A14b', `MON_COMPOSE base '${b}' has no art mon:${b} (used by ${users(l)})`);
  }

  // ================================================================== V9 drops (§8.14.2 · §9.13.4-7/11)
  if (on('V9') || on('CH8')) {
    const V = 'V9';
    const superAt = {};      // item → [mon]
    const mdropAt = {};
    for (const [id, m] of Object.entries(mons)) {
      const d = m.drops || {};
      if (d.super && d.super.item) (superAt[d.super.item] = superAt[d.super.item] || []).push(id);
      if (d.rare && d.rare.item) (mdropAt[d.rare.item] = mdropAt[d.rare.item] || []).push(id);
    }
    const inPools = new Set(), inShops = new Set();
    for (const pl of Object.values(DB.pools)) for (const tier of pl.tiers || []) for (const e of tier || []) if (e.item) inPools.add(e.item);
    for (const sh of Object.values(DB.shops)) { for (const i of sh.items || []) inShops.add(i); for (const st of sh.stock || []) for (const i of st.items || []) inShops.add(i); }
    const rewardGiven = new Set();
    for (const ev of Object.values(DB.events)) for (const g of ((ev.meta || {}).gives || [])) if (/^item:/.test(g)) rewardGiven.add(g.slice(5));
    for (const [id, it] of Object.entries(items)) {
      if (/^pmz__/.test(id)) continue;
      const o = own('items', id);
      if (it.src === 'super') {
        const at = superAt[id] || [];
        if (at.length !== 1 && !empty('monsters')) E(V, o, `super-rare ${id}: in the super slot of ${at.length} monster(s) ${at.join(' ')} (exactly 1, §8.14.2-1)`);
        if (at.length === 1) {
          if (it.exclusive !== at[0]) E(V, o, `super-rare ${id}: exclusive '${it.exclusive}' ≠ the monster '${at[0]}'`);
          const sr = srTierOf(DB, at[0]);
          if (sr != null && it.tier !== sr) E(V, o, `super-rare ${id}: tier ${it.tier} ≠ srTier(${at[0]}) ${sr}`);
        }
        if (inPools.has(id) || inShops.has(id) || rewardGiven.has(id)) E(V, o, `super-rare ${id}: also sold / in a pool / given by an event`);
        if (mdropAt[id]) E(V, o, `super-rare ${id}: in a rare slot`);
      }
      if (it.src === 'mdrop') {
        const at = mdropAt[id] || [];
        if (!at.length && !empty('monsters')) E(V, o, `monster rare ${id}: no monster's rare slot has it`);
        if (at.length > 3) E(V, o, `monster rare ${id}: on ${at.length} monsters (max 3)`);
        for (const mon of at) { const sr = srTierOf(DB, mon); if (sr != null && it.tier !== band(sr)) E(V, o, `monster rare ${id}: tier ${it.tier} ≠ band(srTier(${mon})) ${band(sr)}`); }
        if (inPools.has(id) || inShops.has(id)) E(V, o, `monster rare ${id}: also in a shop/pool`);
      }
      if (it.src === 'drop' && C.ITEM_TYPES.slice(0, 7).includes(it.type) && mdropAt[id]) E(V, o, `band rare ${id}: must not be in a monster rare slot (§8.3.3)`);
      if (it.src === 'relic' && it.type !== 'consumable' && !Object.values(mons).some((m) => Object.values(m.drops || {}).some((d) => d && d.item === id))) E(V, o, `relic ${id}: no rare monster drops it`);
    }
    // every zone monster has one super; rare monsters' slots (§8.14.2-2)
    for (const [id, m] of Object.entries(mons)) {
      const o = own('monsters', id), d = m.drops || {};
      if (isMob(id)) {
        if (!d.super || !d.super.item) E(V, o, `monster ${id}: no super-rare slot`);
        else { const it = items[d.super.item]; if (it && it.src !== 'super') E(V, o, `monster ${id}: super slot item ${d.super.item} has src '${it.src}'`); if (!/(^|_)sr_/.test(d.super.item)) E(V, o, `monster ${id}: super item id '${d.super.item}' does not follow *sr_* (§9.13.4-11)`); }
        if (!d.rare || !d.rare.item) E(V, o, `monster ${id}: no rare slot`);
        else { const it = items[d.rare.item]; if (it && it.src !== 'mdrop') E(V, o, `monster ${id}: rare slot item ${d.rare.item} is src '${it.src}' (mdrop)`); }
        if (!d.normal) E(V, o, `monster ${id}: no normal slot`);
        const rate = (s) => d[s] && d[s].rate;
        const rs = [rate('normal'), rate('rare'), rate('super')];
        const metal = isMetal(id), mimic = m.lineage === 'mimic';
        if (rs[0] && !(rs[0] >= 4 && rs[0] <= 16)) W(V, o, `monster ${id}: normal rate 1/${rs[0]} outside 1/4–1/16`);
        if (rs[1] && !(rs[1] >= 16 && rs[1] <= 64)) W(V, o, `monster ${id}: rare rate 1/${rs[1]} outside 1/16–1/64`);
        if (rs[2] && !(rs[2] >= 128 && rs[2] <= 512)) W(V, o, `monster ${id}: super rate 1/${rs[2]} outside 1/128–1/512`);
        if ((metal || mimic) && rs[2] && rs[2] !== 128) W(V, o, `monster ${id}: ${metal ? 'metal' : 'mimic'} super rate should be 1/128`);
      }
      if (isRareMon(id)) {
        const r = d.rare && d.rare.item, s = d.super && d.super.item, nn = d.normal && d.normal.item;
        if (!r || !/^ac_rl_/.test(r)) E(V, o, `rare monster ${id}: rare slot must be its relic ac_rl_* (is ${r})`);
        if (!s) E(V, o, `rare monster ${id}: no super slot`);
        else if (!/^ac_rs_/.test(s) && !(items[s] && items[s].src === 'super')) E(V, o, `rare monster ${id}: super slot ${s} must be ac_rs_* or a fixed-tier super item`);
        if (!nn || !(items[nn] && items[nn].type === 'consumable')) E(V, o, `rare monster ${id}: normal slot must be its own consumable (§8.9.2)`);
      }
      if (isBoss(id) && d && Object.keys(d).length) {
        const okBoss = (!d.normal || (d.normal.pool && ['p_boss', 'p_boss_mid'].includes(d.normal.pool) && d.normal.rate === 1)) && (!d.bonus || (/^i_seed_/.test(d.bonus.item || '') && d.bonus.rate === 1));
        const extra = ['b_valzard_echo', 'b_ouroboros'].includes(id);
        if (!okBoss) E(V, o, `boss ${id}: drops must be normal:{pool:'p_boss'|'p_boss_mid', rate:1} and bonus:{item:'i_seed_*', rate:1} (§8.12.3)`);
        if (!extra && (d.rare || d.super)) E(V, o, `boss ${id}: only the two postgame bosses have rare/super slots`);
        if (extra && (!d.rare || !d.super || d.rare.rate !== 4 || d.super.rate !== 4)) E(V, o, `boss ${id}: rare/super slots at 1/4 expected (§8.12.3)`);
      }
    }
    // relic keys unique
    const keys = {};
    for (const id of Object.keys(items)) { const m = id.match(/^ac_r[ls]_([a-z0-9_]+)$/); if (m) { const k = m[1] + (id[4] === 'l' ? ':l' : ':s'); if (keys[k]) E(V, own('items', id), `relic key '${m[1]}' used twice`); keys[k] = 1; } }
  }

  // ================================================================== V10 techs / spells glim, MP
  if (on('V10')) {
    const V = 'V10';
    for (const id of techs) {
      const a = actions[id], o = own('actions', id);
      if (!a.glim || !isNum(a.glim.lv) || a.glim.lv < 1 || a.glim.lv > 10) E(V, o, `tech ${id}: glim.lv ${a.glim && a.glim.lv} outside 1–10`);
      else {
        if (a.rank !== a.glim.lv) E(V, o, `tech ${id}: rank ${a.rank} ≠ glim.lv ${a.glim.lv}`);
        const r = C.TECH_WP[a.glim.lv];
        if (r && !(a.wp >= r[0] && a.wp <= r[1])) E(V, o, `tech ${id}: wp ${a.wp} outside ${r[0]}–${r[1]} for lv ${a.glim.lv} (§6.4.1)`);
      }
    }
    for (const id of spells) {
      const a = actions[id], o = own('actions', id);
      const els = a.elements || [];
      if (!a.glim || !isNum(a.glim.lv) || a.glim.lv < 1 || a.glim.lv > 8) { E(V, o, `spell ${id}: glim.lv ${a.glim && a.glim.lv} outside 1–8`); continue; }
      const cls = els.length === 1 ? String((id.match(/_(\d)$/) || [])[1]) : els.length === 2 ? (/_a$/.test(id) ? 'comboA' : 'comboB') : 'triple';
      const want = C.SPELL_CLS[cls];
      if (!want) { E(V, o, `spell ${id}: cannot tell its class`); continue; }
      if (a.glim.lv !== want.lv) E(V, o, `spell ${id}: glim.lv ${a.glim.lv} ≠ ${want.lv} (§7.1.3)`);
      if (a.glim.prof !== want.prof) E(V, o, `spell ${id}: glim.prof ${a.glim.prof} ≠ ${want.prof}`);
      if (a.rank !== a.glim.lv) E(V, o, `spell ${id}: rank ${a.rank} ≠ glim.lv`);
      if (!(a.mp >= want.mp[0] && a.mp <= want.mp[1])) E(V, o, `spell ${id}: mp ${a.mp} outside ${want.mp[0]}–${want.mp[1]} (§7.1.3)`);
    }
  }

  // ================================================================== V11 status carry-over & repelSteps
  if (on('V11')) {
    const V = 'V11';
    const battleFiles = /^src\/systems\/(battle|battle_ai|battle_scene|battle_fx|mon|glimmer)\.js$|^src\/data\/statuses\.js$/;
    for (const { rel, owner, code } of srcTexts) {
      // a property read/write of the old counter; `delete x.repelSteps` (the one-way save migration of §3.2.5-7) is allowed
      const reRep = /(\bdelete\s+)?[\w$\])]\s*(?:\.\s*(repel(?:Steps|Blocks))\b|\[\s*['"](repel(?:Steps|Blocks))['"]\s*\])/g;
      let mr;
      while ((mr = reRep.exec(code))) if (!mr[1]) { E(V, owner, `${rel}: R.Game.${mr[2] || mr[3]} is still read or written (use R.Game.encItem, §0.16)`); break; }
      if (battleFiles.test(rel)) continue;
      const re = /\bstatus\s*(?:\.\s*(poison|burn|sleep|paralyze|freeze|stun|confuse|silence|blind)|\[\s*'(poison|burn|sleep|paralyze|freeze|stun|confuse|silence|blind)'\s*\])\s*=(?!=)\s*([^;\n]*)/g;
      let mm;
      while ((mm = re.exec(code))) if (!/^\s*(undefined|null|0|false)\b/.test(mm[3])) E(V, owner, `${rel}: sets status.${mm[1] || mm[2]} outside battle (status is always {} outside battle, §3.2.6)`);
      const re2 = /\bstatus\s*=\s*\{\s*(poison|burn|sleep|paralyze|freeze|stun|confuse|silence|blind)\s*:/g;
      while ((mm = re2.exec(code))) E(V, owner, `${rel}: builds a non-empty status {${mm[1]}:…} outside battle`);
    }
  }

  // ================================================================== V12 art & sound (§11.12.1)
  if (on('V12')) {
    const V = 'V12';
    // 1. keys used by data
    const need = new Map();   // key → [where, owner]
    const want = (key, where, owner) => { if (!need.has(key)) need.set(key, [where, owner]); };
    const themedOk = (theme, tid) => gfx(`tile:${theme}:${tid}`) || gfx('tile:' + tid) || !!(R.Art && R.Art.themeOf);
    for (const [id, P2] of Object.entries(maps)) {
      const used = new Set();
      for (let y = 0; y < P2.h; y++) for (let x = 0; x < P2.w; x++) { used.add(P2.tileAt(x, y)); const dd = P2.decorAt(x, y); if (dd) want('decor:' + dd, `map ${id}`, 'A16b'); }
      for (const tp of P2.patches) used.add(tp.tile || P2.legend[tp.ch]);
      used.add(P2.outside);
      for (const tid of used) {
        if (!tid) continue;
        const t = DB.tiles[tid];
        if (!t) continue;
        if (t.themed && P2.def.theme) { if (!themedOk(P2.def.theme, tid)) E(V, 'A16b', `map ${id}: tile:${P2.def.theme}:${tid} has no art and no fallback`); }
        else if (P2.def.type === 'world') { if (!gfx('tile:' + tid) && !(R.Art && (R.Art.worldTile || R.Art.worldTiles))) want('tile:' + tid, `map ${id}`, 'A16a'); }
        else want('tile:' + tid, `map ${id}`, 'A16b');
      }
      for (const c of P2.chests) want(c.pool === 'p_rare' ? 'obj:chest_rare' : 'obj:chest', `map ${id}`, 'A13');
    }
    for (const [tid, t] of Object.entries(DB.tiles)) if (t.bbg) want('bbg:' + t.bbg, `tile ${tid}`, 'A16a');
    for (const [th, t] of Object.entries(DB.themes)) if (t && t.bbg) want('bbg:' + t.bbg, `theme ${th}`, 'A16a');
    const ICON_DEF = { shield: 'icon:shield', head: 'icon:head', body: 'icon:body', hands: 'icon:hands', feet: 'icon:feet', acc: 'icon:acc', key: 'icon:key' };
    for (const [id, it] of Object.entries(items)) {
      if (/^pmz__/.test(id)) continue;
      let key = it.icon ? (it.icon.includes(':') ? it.icon : 'icon:' + it.icon) : it.type === 'weapon' ? 'icon:' + it.wtype : ICON_DEF[it.type] || (it.stone ? 'icon:el_' + it.stone : null);
      if (key) want(key, `item ${id}`, 'A13');
    }
    for (const c of C.COMPANIONS) if (DB.companions[c]) want('party:' + (DB.companions[c].sprite || c), `companion ${c}`, 'A13');
    for (const t of C.HERO_TYPES) for (const g of ['m', 'f']) want(`party:hero_${g}_${t}`, 'hero sprites', 'A13');
    for (const o2 of ['chest', 'chest_rare', 'sparkle', 'shadow', 'glimmer', 'quill', 'lantern', 'page']) want('obj:' + o2, '§3.1.2 · §11.11.1', 'A13');
    for (const [key, [where, owner]] of need) if (!gfx(key)) E(V, owner || expectedOwner('gfx', key), `${where}: '${key}' is not registered`);
    // 2. sound ids
    for (const [el, e] of Object.entries(DB.elements)) if (e.sfx && !C.SFX.includes(e.sfx)) E(V, own('elements', el), `elements.${el}.sfx '${e.sfx}' is not in §11.11.4`);
    const ra = path.join(ROOT, 'tools', 'render_audio.js');
    if (fs.existsSync(ra)) {
      const src = fs.readFileSync(ra, 'utf8');
      const grab = (name) => { const m = src.match(new RegExp(`const ${name}\\s*=\\s*\\(?((?:'[^']*'\\s*\\+?\\s*)+)\\)?\\.split`)); return m ? m[1].replace(/'\s*\+\s*'/g, '').replace(/'/g, '').trim().split(/\s+/) : null; };
      for (const [name, list] of [['BGM', C.BGM], ['JINGLES', C.JINGLES], ['SFX', C.SFX]]) {
        const got = grab(name);
        if (!got) { W(V, 'A17', `render_audio.js: cannot read the ${name} list`); continue; }
        const miss = list.filter((x) => !got.includes(x)), extra = got.filter((x) => !list.includes(x));
        if (miss.length || extra.length) E(V, 'A17', `render_audio.js ${name} ≠ §11.11.4 (missing ${miss.join(' ') || '-'}; extra ${extra.join(' ') || '-'})`);
      }
    }
    const music = Object.keys(DB.music), sfxDb = Object.keys(DB.sfx);
    if (music.length) for (const b of [...C.BGM, ...C.JINGLES]) if (!music.includes(b)) E(V, 'A17', `DB.music['${b}'] missing`);
    if (sfxDb.length) for (const s of C.SFX) if (!sfxDb.includes(s)) E(V, 'A17', `DB.sfx['${s}'] missing`);
    for (const b of music) if (![...C.BGM, ...C.JINGLES, 'jobup'].includes(b)) W(V, 'A17', `DB.music['${b}'] is not in §11.11.4`);
    // 3. legend character overlaps
    const lg = DB.legends || {};
    const freeLocal = String(R.MARK_CHARS_LOCAL || ''), freeWorld = String(R.MARK_CHARS_WORLD || '');
    for (const ch of Object.keys(lg.local || {})) if (freeLocal.includes(ch)) E(V, 'A16b', `legend char '${ch}' (local ${lg.local[ch]}) is also in R.MARK_CHARS_LOCAL`);
    for (const ch of Object.keys(lg.world || {})) if (freeWorld.includes(ch)) E(V, 'A16a', `legend char '${ch}' (world ${lg.world[ch]}) is also in R.MARK_CHARS_WORLD`);
    for (const [id, P2] of Object.entries(maps)) for (const ch in P2.def.marks || {}) {
      const free = P2.def.type === 'world' ? freeWorld : freeLocal;
      if (free && !free.includes(ch)) W(V, own('maps', id), `map ${id}: mark char '${ch}' is not a free mark char`);
    }
    // 4. PENDING art/audio (warnings)
    const pa = (R.Art && R.Art.PENDING) || [], pu = (R.Audio && R.Audio.PENDING) || [];
    if (pa.length) W(V, 'A0', `R.Art.PENDING: ${pa.length} id(s) still drawn with a stand-in (${[...new Set(pa)].slice(0, 12).join(' ')}${pa.length > 12 ? ' …' : ''})`);
    if (pu.length) W(V, 'A17', `R.Audio.PENDING: ${pu.length} id(s) still use a stand-in (${[...new Set(pu)].slice(0, 12).join(' ')}${pu.length > 12 ? ' …' : ''})`);
  }

  // ================================================================== V13 text (STYLE_JA §10 via check_text.js)
  if (on('V13')) {
    try {
      const CT = require('./check_text');
      const res = CT.run({ R, prov: L.prov, files: L.files });
      for (const f of res.findings) if (f.level === 'error') E('V13', f.owner, f.msg);
      const w = res.findings.filter((f) => f.level === 'warn').length;
      if (w) W('V13', 'A22', `check_text: ${w} warning(s) (run node tools/check_text.js for the list)`);
    } catch (e) { W('V13', 'A22', 'check_text.js not runnable: ' + (e && e.message)); }
  }

  // ================================================================== V14 warp targets (Part A6)
  if (on('V14')) {
    const V = 'V14';
    for (const [id, P2] of Object.entries(maps)) {
      const d = P2.def, o = own('maps', id);
      if (d.type === 'world') { if (d.location) E(V, o, `map ${id}: the world map must not have 'location'`); continue; }
      const kind = M.kindOf(P2);
      const needs = kind === 'dungeon' || kind === 'town' || kind === 'house' || ['town', 'village', 'castle', 'dungeon'].includes(d.type);
      if (needs && !d.location) { E(V, o, `map ${id}: no 'location' (§10.6.3, V14)`); continue; }
      if (d.location && !DB.locations[d.location]) { E(V, o, `map ${id}: location '${d.location}' is not in DB.locations`); continue; }
      // §10.6.3 mapping
      let expect = null;
      for (const t of Object.keys(C.TOWNS)) if (id === t || id.startsWith(t + '_house')) expect = t;
      if (id === 'roa_house') expect = 'roa';
      for (const [dg, info] of Object.entries(C.DUNGEONS)) if (new RegExp(`^${dg}_\\d+$`).test(id)) expect = info.loc;
      if (expect && d.location !== expect) E(V, o, `map ${id}: location '${d.location}' ≠ '${expect}' (§10.6.3)`);
    }
    const locIds = Object.keys(DB.locations);
    if (locIds.length) {
      if (locIds.length !== 23) E(V, 'A18a', `DB.locations has ${locIds.length} entries (23)`);
      const order = Object.keys(C.LOCATIONS);
      if (locIds.join(' ') !== order.join(' ')) W(V, 'A18a', 'DB.locations order differs from §10.6.3 (the warp list order)');
      for (const [id, l] of Object.entries(DB.locations)) {
        const exp = C.LOCATIONS[id];
        if (!exp) { E(V, 'A18a', `location ${id}: not in §10.6.3`); continue; }
        if (!['town', 'dungeon'].includes(l.kind)) E(V, 'A18a', `location ${id}: kind '${l.kind}' (town|dungeon)`);
        else if (l.kind !== exp[2]) E(V, 'A18a', `location ${id}: kind '${l.kind}' ≠ ${exp[2]}`);
        if (!l.region) E(V, 'A18a', `location ${id}: no region`); else if (l.region !== exp[1]) E(V, 'A18a', `location ${id}: region '${l.region}' ≠ ${exp[1]}`);
        if (l.spawn !== exp[0]) E(V, 'A18a', `location ${id}: spawn '${l.spawn}' ≠ ${exp[0]}`);
        if (maps.world && !maps.world.spawns[l.spawn]) E(V, 'A18a', `location ${id}: spawn '${l.spawn}' is not a world spawn`);
        if (l.dock) W(V, 'A18a', `location ${id}: 'dock' is not used in this game (§10.6.3)`);
      }
    }
  }

  // ================================================================== CH4 (§4.18.3) + CH5 (§5.7)
  const aptSum = (apt, keys) => keys.reduce((s, k) => s + ({ S: 4, A: 3, B: 2, C: 1, D: 0 }[(apt || {})[k]] ?? NaN), 0);
  if (on('CH5') || on('CH4')) {
    const V = 'CH5';
    const comp = Object.keys(DB.companions);
    if (comp.length) {
      if (comp.join(' ') !== C.COMPANIONS.join(' ')) E(V, 'A6', `DB.companions ids/order ≠ §5.1.1 (${comp.length}: ${comp.join(' ')})`);
      const hts = Object.keys(DB.heroTypes);
      if (hts.join(' ') !== C.HERO_TYPES.join(' ')) E(V, 'A6', `DB.heroTypes ≠ ${C.HERO_TYPES.join(' ')} (${hts.join(' ')})`);
      let healers = 0;
      const statRows = [];
      for (const [id, c] of Object.entries(DB.companions)) {
        const o = own('companions', id);
        const st = c.stats || {};
        const sum = C.STATS.reduce((s, k) => s + (st[k] || 0), 0);
        if (sum !== 200) E(V, o, `companion ${id}: stats sum ${sum} (200)`);
        for (const k of C.STATS) if (!(st[k] >= 10 && st[k] <= 60)) E(V, o, `companion ${id}: ${k} ${st[k]} outside 10–60`);
        statRows.push([id, st]);
        const a = c.apt || {};
        for (const w of C.WTYPES) if (!'SABCD'.includes((a.w || {})[w] || '?')) E(V, o, `companion ${id}: apt.w.${w} missing/invalid`);
        for (const e of C.ELEMENTS) if (!'SABCD'.includes((a.e || {})[e] || '?')) E(V, o, `companion ${id}: apt.e.${e} missing/invalid`);
        const sw = aptSum(a.w, C.WTYPES), se = aptSum(a.e, C.ELEMENTS);
        if (!(sw >= 15 && sw <= 19)) E(V, o, `companion ${id}: weapon aptitude sum ${sw} (15–19)`);
        if (!(se >= 8 && se <= 12)) E(V, o, `companion ${id}: element aptitude sum ${se} (8–12)`);
        if (sw + se !== 27) E(V, o, `companion ${id}: aptitude total ${sw + se} (27)`);
        const gs = aptSum(c.growth, ['hp', 'mp', 'wp']);
        if (gs !== 6) E(V, o, `companion ${id}: growth sum ${gs} (6)`);
        const lw = Math.max(({ S: 4, A: 3, B: 2, C: 1, D: 0 })[(a.e || {}).light] || 0, ({ S: 4, A: 3, B: 2, C: 1, D: 0 })[(a.e || {}).water] || 0);
        if (lw < 1) E(V, o, `companion ${id}: light and water both below C`);
        if (lw >= 3) healers++;
        // §5.7-4 start gear / techs
        const eq = c.startEquip || {};
        const wts = ['weapon1', 'weapon2'].map((s) => eq[s] && items[eq[s]] && items[eq[s]].wtype).filter(Boolean);
        for (const t of c.startTechs || []) { const ta = actions[t]; if (ta && !wts.includes(ta.wtype)) E('CH6', o, `companion ${id}: start tech ${t} (${ta.wtype}) without a ${ta.wtype} weapon`); }
        for (const s of c.startSpells || []) { const sa = actions[s]; if (sa && !/^s_[a-z]+_1$/.test(s)) E('CH7', o, `companion ${id}: start spell ${s} is not a 1st-step spell`); }
        const two = ['weapon1', 'weapon2'].some((s) => eq[s] && items[eq[s]] && (items[eq[s]].twoHanded || C.TWO_HANDED.includes(items[eq[s]].wtype)));
        if (two && eq.shield) E(V, o, `companion ${id}: shield together with a two-handed weapon`);
        // §5.7-5 text lengths
        if (c.title && textWidth(R, c.title) > 6) E(V, o, `companion ${id}: title '${c.title}' wider than 6`);
        if (c.innate) { if (c.innate.name && textWidth(R, c.innate.name) > 7) E(V, o, `companion ${id}: innate name wider than 7`); if (c.innate.desc && textWidth(R, c.innate.desc) > 20) E(V, o, `companion ${id}: innate desc wider than 20`); }
        for (const [k, maxL] of [['profile', 3], ['joinLine', 2], ['leaveLine', 1], ['rejoinLine', 1], ['epilogue', 2]]) {
          if (!c[k]) { E(V, o, `companion ${id}: no ${k}`); continue; }
          const ls = String(c[k]).split('\n');
          if (ls.length > maxL) E(V, o, `companion ${id}: ${k} has ${ls.length} lines (max ${maxL})`);
          ls.forEach((l, i) => { if (textWidth(R, l) > 20) E(V, o, `companion ${id}: ${k} line ${i + 1} wider than 20`); });
        }
      }
      if (healers < 8) E(V, 'A6', `only ${healers} companions have light or water ≥ A (≥ 8)`);
      for (let i = 0; i < statRows.length; i++) for (let j = 0; j < statRows.length; j++) {
        if (i === j) continue;
        const [a, sa] = statRows[i], [b, sb] = statRows[j];
        if (C.STATS.every((k) => (sa[k] || 0) >= (sb[k] || 0))) E(V, 'A6', `companion ${a} matches or beats ${b} in all six stats (§5.4.1-3)`);
      }
      for (const w of C.WTYPES) { const nn = Object.values(DB.companions).filter((c) => 'SA'.includes(((c.apt || {}).w || {})[w])).length; if (nn < 3) E(V, 'A6', `weapon ${w}: ${nn} companion(s) at S/A (≥ 3)`); }
      for (const e of C.ELEMENTS) { const nn = Object.values(DB.companions).filter((c) => 'SA'.includes(((c.apt || {}).e || {})[e])).length; if (nn < 3) E(V, 'A6', `element ${e}: ${nn} companion(s) at S/A (≥ 3)`); }
    }
    // hero types × favour (§5.7-3, §4.2.1)
    const kit = DB.starterKit || {};
    for (const [id, h] of Object.entries(DB.heroTypes)) {
      const o = own('heroTypes', id);
      const st = h.stats || {};
      const sum = C.STATS.reduce((s, k) => s + (st[k] || 0), 0);
      if (Math.abs(sum - 200) > 10) E('CH4', o, `heroType ${id}: stats sum ${sum} (200 ± 10)`);
      for (const k of C.STATS) if (!(st[k] >= 10 && st[k] <= 60)) E('CH4', o, `heroType ${id}: ${k} ${st[k]} outside 10–60`);
      const gs = aptSum(h.growth, ['hp', 'mp', 'wp']);
      if (Math.abs(gs - 6) > 1) E('CH4', o, `heroType ${id}: growth sum ${gs} (6 ± 1)`);
      const opts2 = [];
      const fo = h.favorOptions || {};
      if (h.favorKind === 'weapon' || h.favorKind === 'any') for (const w of fo.weapon || C.WTYPES) opts2.push({ kind: 'weapon', id: w });
      if (h.favorKind === 'element' || h.favorKind === 'any') for (const e of fo.element || C.ELEMENTS) opts2.push({ kind: 'element', id: e });
      for (const f of opts2) {
        const apt = JSON.parse(JSON.stringify(h.apt || { w: {}, e: {} }));
        apt[f.kind === 'weapon' ? 'w' : 'e'][f.id] = 'S';
        if (h.pairElement && f.kind === 'element' && kit.pair && kit.pair[f.id]) apt.e[kit.pair[f.id]] = 'A';
        const sw = aptSum(apt.w, C.WTYPES), se = aptSum(apt.e, C.ELEMENTS);
        if (!(sw >= 15 && sw <= 19)) E(V, o, `hero ${id} × ${f.kind}:${f.id}: weapon aptitude ${sw} (15–19)`);
        if (!(se >= 8 && se <= 12)) E(V, o, `hero ${id} × ${f.kind}:${f.id}: element aptitude ${se} (8–12)`);
      }
    }
    // starterKit 11 + 11 + 6 (§5.7-4)
    if (!empty('heroTypes')) for (const k of ['weapon', 'tech', 'spell']) if (!kit[k]) E(V, 'A6', `DB.starterKit.${k} missing`);
  }

  // ================================================================== CH4 gear tables (§4.18.3)
  if (on('CH4')) {
    const V = 'CH4';
    const WT = K.WTYPE || {};
    const SH = K.SLOT_SHARE || { shield: 0.20, head: 0.15, body: 0.40, hands: 0.10, feet: 0.15 };
    const WG = K.WEIGHT || { heavy: { def: 1, mdef: 0.2 }, light: { def: 0.65, mdef: 0.35 }, cloth: { def: 0.4, mdef: 0.6 } };
    const MULT = { sword: 1, greatsword: 1.4, dagger: 0.75, axe: 1.15, spear: 1.25, bow: 1.1, club: 1.05, staff: 0.6, katana: 1.05, fist: 0.9, whip: 0.8 };
    const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
    let unfilled = 0;
    for (const [id, it] of Object.entries(items)) {
      if (/^pmz__/.test(id) || !C.ITEM_TYPES.slice(0, 7).includes(it.type)) continue;
      const o = own('items', id), T = it.tier;
      if (!isNum(T) || T < 0 || T > 9) { E(V, o, `item ${id}: tier ${T} (0–9)`); continue; }
      if (it.units) {
        // §4.3.3: the unit budget of the slot (rare ×2 / super ×3 are applied to the value, not to the units)
        const SU = K.SLOT_UNITS || { weapon: 2, shield: 1, head: 1, body: 2, hands: 1, feet: 1, acc: 1 };
        const us = [...String(it.units).matchAll(/([svdaim])(\d)/g)].reduce((a2, m) => a2 + +m[2], 0);
        if (!/^([svdaim]\d)+$/.test(String(it.units))) E(V, o, `item ${id}: units '${it.units}' (letters s v d a i m + digits, §4.3.3)`);
        else if (SU[it.type] != null && us !== SU[it.type]) E(V, o, `item ${id}: ${us} stat unit(s) on a ${it.type} (§4.3.3: ${SU[it.type]})`);
        if (!it.stats) { unfilled++; continue; }
        const exp = {};
        for (const m of String(it.units).matchAll(/([svdaim])(\d)/g)) exp[SK[m[1]]] = gearStat(U, T, +m[2], it.grade);
        for (const [k, v] of Object.entries(it.statsAdd || {})) exp[k] = (exp[k] || 0) + v;
        for (const k of C.STATS) if ((exp[k] || 0) !== (it.stats[k] || 0)) { E(V, o, `item ${id}: stats.${k} ${it.stats[k] || 0} ≠ gearStat ${exp[k] || 0} (units ${it.units}, ${it.grade}, §4.3.2)`); break; }
      }
      if (it.type === 'weapon' && isNum(it.atk) && it.grade === 'normal' && it.src === 'shop') {
        const want = Wt[T] * ((WT[it.wtype] && WT[it.wtype].mult) || MULT[it.wtype] || 1);
        if (Math.abs(it.atk - want) > 0.1 * want + 0.5) E(V, o, `item ${id}: atk ${it.atk} vs W(${T})×${(want / Wt[T]).toFixed(2)} = ${want.toFixed(1)} (±10%)`);
      }
      if (SH[it.type] != null && isNum(it.def) && it.grade === 'normal' && it.src === 'shop' && WG[it.weight]) {
        const want = SH[it.type] * Df(T) * WG[it.weight].def;
        if (Math.abs(it.def - want) > 0.1 * want + 0.5) E(V, o, `item ${id}: def ${it.def} vs ${want.toFixed(1)} (share×D(T)×weight ±10%)`);
      }
      if (C.ITEM_TYPES.slice(1, 6).includes(it.type) && !C.WEIGHTS.includes(it.weight)) E(V, o, `item ${id}: weight '${it.weight}' (heavy|light|cloth)`);
      if (!C.GRADES.includes(it.grade)) E(V, o, `item ${id}: grade '${it.grade}'`);
      if (!C.SRC.includes(it.src)) E(V, o, `item ${id}: src '${it.src}'`);
      for (const k of Object.keys(it)) if (!C.ITEM_FIELDS.includes(k)) W(V, o, `item ${id}: unknown field '${k}'`);
      if (it.type !== 'weapon') for (const k of C.WEAPON_FIELDS) if (has(it, k) && !['atk', 'mag', 'hit', 'crit'].includes(k)) E(V, o, `item ${id}: weapon field '${k}' on a ${it.type}`);
      if (it.type === 'weapon') {
        if (!C.WTYPES.includes(it.wtype)) E(V, o, `item ${id}: wtype '${it.wtype}'`);
        if (it.element && !C.ELEMENTS.includes(it.element)) E(V, o, `item ${id}: element '${it.element}'`);
        if (it.onHit && ![...C.BAD, 'death'].includes(it.onHit.status)) E(V, o, `item ${id}: onHit status '${it.onHit.status}'`);
        if (C.TWO_HANDED.includes(it.wtype) && !it.twoHanded && isNum(it.atk)) E(V, o, `item ${id}: ${it.wtype} must be twoHanded`);
        if (it.twoHanded && !C.TWO_HANDED.includes(it.wtype) && !it.quirk) E(V, o, `item ${id}: twoHanded on a ${it.wtype} without quirk:true`);
      }
    }
    if (unfilled) W(V, 'A1', `${unfilled} item(s) with units but no stats (R.Rules.fillItem has not run on them)`);
    const cnt = { weapon: 0, armor: 0, acc: 0, consumable: 0, key: 0 };
    for (const [id, it] of Object.entries(items)) { if (/^pmz__/.test(id)) continue; const k = it.type === 'weapon' ? 'weapon' : ['shield', 'head', 'body', 'hands', 'feet'].includes(it.type) ? 'armor' : it.type; if (has(cnt, k)) cnt[k]++; }
    const ownerOfCount = { weapon: 'A9', armor: 'A10a', acc: 'A10a', consumable: 'A10b', key: 'A10b' };
    for (const [k, want] of Object.entries(C.ITEM_COUNTS)) if (cnt[k] !== want) (cnt[k] ? E : P)(cnt[k] ? V : 'PENDING', ownerOfCount[k], `${k}: ${cnt[k]} item(s) registered (§8.1.3: ${want})`);
  }

  // ================================================================== CH6 techs (§6.9.2 + counts)
  if (on('CH6')) {
    const V = 'CH6';
    if (techs.length) {
      const missing = C.TECH_IDS.filter((id) => !actions[id]), extra = techs.filter((id) => !C.TECH_IDS.includes(id));
      if (missing.length) E(V, 'A7', `${missing.length} tech id(s) of §6.1.2 missing: ${missing.slice(0, 10).join(' ')}${missing.length > 10 ? ' …' : ''}`);
      if (extra.length) E(V, 'A7', `tech id(s) not in §6.1.2: ${extra.slice(0, 10).join(' ')}`);
      for (const w of C.WTYPES) {
        const lv = C.TECHS[w].split(' ').map((n2) => actions[`t_${w}_${n2}`]).filter(Boolean).map((a) => a.glim && a.glim.lv);
        if (lv.length === 11 && lv.join(',') !== C.TECH_LV.join(',')) E(V, 'A7', `${w}: glim.lv order ${lv.join(',')} (§6.9.1: ${C.TECH_LV.join(',')})`);
      }
      for (const id of techs) {
        const a = actions[id], o = own('actions', id);
        if (a.fx != null) for (const f of [].concat(a.fx)) if (!C.FX_TECH.includes(f) && !C.FX_ALL.has(f)) E(V, o, `tech ${id}: fx '${f}' is not in §6.2.6`);
        if (typeof a.reach !== 'boolean') E(V, o, `tech ${id}: reach must be true/false`);
        if (C.REACH.includes(a.wtype) && a.reach !== true) E(V, o, `tech ${id}: ${a.wtype} techs are reach:true`);
        if (!C.TARGETS.includes(a.target)) E(V, o, `tech ${id}: target '${a.target}'`);
        // §6.3 / §6.9.1-5: lv 1 comes from 'attack'; lv ≥ 2 from 1–2 lower techs of the same weapon type
        const g = a.glim || {}, from = Array.isArray(g.from) ? g.from : [];
        if (g.lv === 1) { if (from.join() !== 'attack') E(V, o, `tech ${id}: lv 1 glim.from must be ['attack'] (got [${from}])`); }
        else if (isNum(g.lv)) {
          if (from.length < 1 || from.length > 2) E(V, o, `tech ${id}: glim.from has ${from.length} id(s) (1–2 lower techs, §6.3)`);
          for (const f of from) { const fa = actions[f]; if (!fa || !/^t_/.test(f) || fa.wtype !== a.wtype || !(fa.glim && fa.glim.lv < g.lv)) E(V, o, `tech ${id}: glim.from '${f}' is not a lower ${a.wtype} tech (§6.3)`); }
        }
        checkEffects(a, o, `tech ${id}`, V);
      }
      for (const [id, h] of Object.entries(DB.heroTypes)) for (const k of ['weapon', 'element']) for (const t of (((h.onFavor || {})[k] || {}).techs || [])) if (!actions[t]) E(V, own('heroTypes', id), `heroType ${id}: onFavor tech ${t} missing`);
    }
    if (!empty('weaponTypes')) { const wt = Object.keys(DB.weaponTypes); if (wt.join(' ') !== C.WTYPES.join(' ')) E(V, 'A7', `DB.weaponTypes ≠ the 11 types in order (${wt.join(' ')})`); for (const w of C.WTYPES) { const d = DB.weaponTypes[w]; if (d && !!d.twoHanded !== C.TWO_HANDED.includes(w)) E(V, 'A7', `weaponTypes.${w}.twoHanded ${d.twoHanded}`); } }
  }
  function checkEffects(a, o, where, V) {
    for (const e of a.effects || []) {
      if (!C.EFFECTS.includes(e.type)) { E(V, o, `${where}: effect type '${e.type}' unknown`); continue; }
      if (e.type === 'damage') {
        if (e.formula != null && !C.FORMULAS.includes(e.formula)) E(V, o, `${where}: formula '${e.formula}'`);
        if (!isNum(e.power)) E(V, o, `${where}: damage without power`);
        if (e.hits != null && !(Number.isInteger(e.hits) && e.hits >= 2 && e.hits <= 8)) E(V, o, `${where}: hits ${e.hits} (integer 2–8)`);
        if (e.ignoreDef != null && !(isNum(e.ignoreDef) && e.ignoreDef >= 0 && e.ignoreDef <= 1)) E(V, o, `${where}: ignoreDef must be a number 0–1`);
        if (e.kind != null && !C.KINDS.includes(e.kind)) E(V, o, `${where}: kind '${e.kind}'`);
        if (e.element != null && !C.ELEMENTS.includes(e.element)) E(V, o, `${where}: element '${e.element}'`);
      }
      if (e.type === 'status' && e.status !== 'counter') {
        const good = C.GOOD.includes(e.status);
        if (good && e.chance != null) E(V, o, `${where}: a good status (${e.status}) must not have chance`);
        if (!good && e.status !== 'death' && a.kind === 'tech') {
          const wide = ['enemies', 'random', 'group'].includes(a.target);
          if (!(e.chance >= 0.2 && e.chance <= (wide ? 0.3 : 0.6))) E(V, o, `${where}: ${e.status} chance ${e.chance} (0.2–${wide ? 0.3 : 0.6}, §6.2.5)`);
        }
        if (e.status === 'death' && a.kind === 'tech' && !(e.chance <= 0.2)) E(V, o, `${where}: instant death chance ${e.chance} (≤ 0.2)`);
      }
      if (e.type === 'buff') {
        if (!C.BUFFS.includes(e.stat)) E(V, o, `${where}: buff stat '${e.stat}'`);
        if (![-2, -1, 1, 2].includes(e.stages)) E(V, o, `${where}: buff stages ${e.stages} (−2..+2)`);
        if (e.stages < 0 && e.chance != null && !(e.chance >= 0.5 && e.chance <= 1) && a.kind === 'tech') E(V, o, `${where}: debuff chance ${e.chance} (0.5–1)`);
      }
      if (e.type === 'dispel' && e.side != null && !['good', 'bad'].includes(e.side)) E(V, o, `${where}: dispel side '${e.side}'`);
      if (e.on != null && !['allies', 'self'].includes(e.on)) E(V, o, `${where}: on '${e.on}'`);
      if (e.type === 'cure' && e.statuses !== 'all' && !Array.isArray(e.statuses)) E(V, o, `${where}: cure statuses must be 'all' or a list`);
    }
  }

  // ================================================================== CH7 spells (§7.13)
  if (on('CH7')) {
    const V = 'CH7';
    if (spells.length) {
      const missing = C.SPELL_IDS.filter((id) => !actions[id]), extra = spells.filter((id) => !C.SPELL_IDS.includes(id));
      if (missing.length) E(V, 'A8', `${missing.length} spell id(s) of §7.2.1 missing: ${missing.slice(0, 10).join(' ')}${missing.length > 10 ? ' …' : ''}`);
      if (extra.length) E(V, 'A8', `spell id(s) not in §7.2.1: ${extra.join(' ')}`);
      for (const id of spells) {
        const a = actions[id], o = own('actions', id);
        const els = a.elements || [];
        const sorted = els.slice().sort((x, y) => C.ELEMENTS.indexOf(x) - C.ELEMENTS.indexOf(y));
        if (!els.length || els.join() !== sorted.join() || new Set(els).size !== els.length || els.some((x) => !C.ELEMENTS.includes(x))) E(V, o, `spell ${id}: elements [${els}] must be 1–3 distinct in canonical order`);
        if (a.magic !== true) E(V, o, `spell ${id}: magic must be true`);
        if (!C.TARGETS.includes(a.target)) E(V, o, `spell ${id}: target '${a.target}'`);
        if (a.target === 'random' && !(a.effects || []).some((e) => e.type === 'damage' && e.hits)) E(V, o, `spell ${id}: target random needs damage.hits`);
        for (const k of ['scale', 'element', 'metalHit', 'escape']) if (has(a, k)) E(V, o, `spell ${id}: must not have '${k}' (§7.0 の 0.3・0.10・0.11; elements[] and power only)`);
        for (const e of a.effects || []) {
          for (const k of ['scale', 'element', 'metalHit']) if (has(e, k)) E(V, o, `spell ${id}: effect must not have '${k}' (§7.0)`);
          if (e.type === 'escape') E(V, o, `spell ${id}: escape on a spell (§7.0 の 0.10)`);
          if (e.type === 'status' && !(C.BAD.includes(e.status) || C.GOOD.includes(e.status) || e.status === 'death' || DB.statuses[e.status])) E(V, o, `spell ${id}: status '${e.status}' not in DB.statuses`);
        }
        if (a.field === true) {
          const fe = a.fieldEffects || (a.effects || []).filter((e) => ['heal', 'revive', 'healWp', 'cure'].includes(e.type));
          if (!fe.length) E(V, o, `spell ${id}: field:true without a field-usable effect (§7.3.5)`);
        }
        if (a.fx != null) for (const f of [].concat(a.fx)) if (!C.FX_ALL.has(String(f).replace(/[123]$/, '')) && !C.FX_ALL.has(f)) W(V, o, `spell ${id}: fx '${f}' is not a known fx id`);
        checkEffects(a, o, `spell ${id}`, V);
      }
      for (const [id, h] of Object.entries(DB.heroTypes)) for (const k of ['weapon', 'element']) for (const s of (((h.onFavor || {})[k] || {}).spells || [])) if (!/^s_[a-z]+_1$/.test(s)) E(V, own('heroTypes', id), `heroType ${id}: start spell ${s} is not 1st-step`);
    }
  }

  // ================================================================== CH8 items / shops / pools (§8.14.2 4–10)
  if (on('CH8')) {
    const V = 'CH8';
    if (!empty('shops')) {
      for (const s of C.SHOPS) if (!DB.shops[s]) E(V, 'A10b', `shop '${s}' (§10.6.1) is not registered`);
      for (const [s, sh] of Object.entries(DB.shops)) {
        const all = [].concat(sh.items || [], ...(sh.stock || []).map((x) => x.items || []));
        for (const i of all) { const it = items[i]; if (it && !(it.src === 'shop' && (it.grade || 'normal') === 'normal') && s !== 'coral_regnas') E(V, own('shops', s), `shop ${s}: '${i}' is src '${it.src}' grade '${it.grade}' (shops sell src:'shop' only)`); }
      }
    }
    if (!empty('pools')) {
      for (const p of C.POOLS) if (!DB.pools[p]) E(V, 'A10b', `pool '${p}' (§8.12.2) is not registered`);
      for (const [p, pl] of Object.entries(DB.pools)) {
        const o = own('pools', p);
        if (!Array.isArray(pl.tiers) || pl.tiers.length !== 10) { E(V, o, `pool ${p}: ${pl.tiers ? pl.tiers.length : 0} tiers (10)`); continue; }
        pl.tiers.forEach((tier, T) => {
          if (!tier || !tier.length) E(V, o, `pool ${p}: tier ${T} is empty`);
          for (const e of tier || []) { const it = e.item && items[e.item]; if (it && ['super', 'relic', 'reward', 'mdrop'].includes(it.src)) E(V, o, `pool ${p} T${T}: '${e.item}' is src '${it.src}'`); if (!isNum(e.w) || e.w <= 0) E(V, o, `pool ${p} T${T}: weight missing`); }
        });
      }
    }
    // every item obtainable (§8.14.2-8)
    const source = new Set();
    for (const pl of Object.values(DB.pools)) for (const tier of pl.tiers || []) for (const e of tier || []) if (e.item) source.add(e.item);
    for (const sh of Object.values(DB.shops)) { for (const i of sh.items || []) source.add(i); for (const st of sh.stock || []) for (const i of st.items || []) source.add(i); }
    for (const m of Object.values(mons)) for (const d of Object.values(m.drops || {})) if (d && d.item) source.add(d.item);
    for (const ev of Object.values(DB.events)) for (const g of ((ev.meta || {}).gives || [])) if (/^item:/.test(g)) source.add(g.slice(5));
    for (const { code } of srcTexts) { const re = /\bev\.give\(\s*'([^']+)'/g; let mm; while ((mm = re.exec(code))) source.add(mm[1]); }
    for (const h of Object.values(DB.heroTypes)) { for (const s in h.startEquip || {}) source.add(h.startEquip[s]); if (h.defaultWeapon) source.add(h.defaultWeapon); }
    for (const c of Object.values(DB.companions)) for (const s in c.startEquip || {}) source.add(c.startEquip[s]);
    for (const w of Object.values((DB.starterKit || {}).weapon || {})) source.add(w);
    for (const i in (DB.config || {}).startItems || {}) source.add(i);
    for (const r of Object.values(DB.regions)) if (r.fragment) source.add(r.fragment);
    const sourcesReady = !empty('pools') && !empty('shops') && !empty('monsters') && !empty('events');
    // a key item / story reward that nobody gives is the giver's error (the event that must ev.give it), not the item owner's
    // (DESIGN §10.13.6 手に入る所, §8.8 / §10.13.9 rewards)
    const GIVER = { k_winter_flame: 'R3', k_marsh_key: 'R4', k_shanty: 'R5', k_oath_hammer: 'R6', k_star_chart: 'R8', k_rowell_note: 'A19',
      ac_tale_forest: 'R1', ac_tale_desert: 'R2', ac_tale_snow: 'R3', ac_tale_marsh: 'R4', ac_tale_isles: 'R5', ac_tale_mine: 'R6', ac_tale_ash: 'R7', ac_tale_star: 'R8',
      ac_rival_pen: 'A19', hn_rival_bracer: 'A19', ac_berna_charm: 'A19', ac_otto_lantern: 'A18b' };
    const giver = (id) => GIVER[id] || own('items', id);
    if (sourcesReady) for (const [id, it] of Object.entries(items)) if (!/^pmz__/.test(id) && !source.has(id)) E(V, giver(id), `item ${id}: no way to obtain it (shop · pool · monster · event)`);
    // rewards (§8.14.2-7)
    for (const [id, it] of Object.entries(items)) if (it.src === 'reward' && sourcesReady && !Object.values(DB.events).some((ev) => ((ev.meta || {}).gives || []).includes('item:' + id))) E(V, giver(id), `reward ${id}: no event meta.gives item:${id}`);
    // consumables / keys ids
    if (!empty('items')) {
      for (const i of C.CONSUMABLES) if (!items[i]) E(V, 'A10b', `consumable '${i}' (§8.9) is not registered`);
      for (const k of C.KEYS) if (!items[k]) E(V, 'A10b', `key item '${k}' (§10.13.6) is not registered`);
      for (const [id, it] of Object.entries(items)) if (it.type === 'consumable') {
        const o = own('items', id);
        if (!it.use) { if (!(it.price > 0)) E(V, o, `consumable ${id}: no use and no price (a treasure to sell needs a price)`); continue; }
        if (!C.TARGETS.includes(it.use.target)) E(V, o, `consumable ${id}: target '${it.use.target}'`);
        checkEffects({ kind: 'item', target: it.use.target, effects: it.use.effects }, o, `consumable ${id}`, V);
        for (const e of it.use.effects || []) if (e.type === 'grow' && !['hp', 'mp', 'wp'].includes(e.stat)) E(V, o, `consumable ${id}: grow stat '${e.stat}' (hp|mp|wp)`);
      } else if (it.type === 'key') {
        const o = own('items', id);
        if (it.price !== 0 && it.price != null) E(V, o, `key ${id}: price must be 0`);
        if (it.use && !['k_quill', 'k_bell'].includes(id)) E(V, o, `key ${id}: only k_quill and k_bell have use`);
      }
    }
  }

  // ================================================================== CH12 misc (regions, counts)
  if (on('CH12')) {
    const V = 'CH12';
    if (!empty('regions')) {
      const rg = Object.keys(DB.regions);
      if (rg.join(' ') !== C.REGIONS.join(' ')) E(V, 'A18a', `DB.regions ≠ ${C.REGIONS.join(' ')} (${rg.join(' ')})`);
      for (const [id, r] of Object.entries(DB.regions)) {
        if (!r.chapter || !r.chapter.title) E(V, 'A18a', `regions.${id}: chapter.title missing`);
        if (r.fragment !== 'k_page_' + C.RS[id]) E(V, 'A18a', `regions.${id}: fragment '${r.fragment}' ≠ k_page_${C.RS[id]}`);
      }
    }
    if (!empty('encounters')) for (const z of C.ZONES) if (!DB.encounters[z]) E(V, 'A11', `zone '${z}' (§10.13.4) is not registered`);
    const nMob = Object.keys(mons).filter(isMob).length, nRare = Object.keys(mons).filter(isRareMon).length, nBoss = Object.keys(mons).filter(isBoss).length;
    if (nMob && nMob !== 211) E(V, 'A11', `${nMob} mobs registered (§9.0: 211)`);
    if (nRare && nRare !== 23) E(V, 'A12', `${nRare} rare monsters (23)`);
    if (nBoss && nBoss !== 34) W(V, 'A12', `${nBoss} boss monsters (34 bodies)`);
    if (!empty('rareEncounters')) {
      // §9.7.3: the 23 zones and their rare monster are fixed; a rare monster may also appear in an extra zone (warning)
      const RARE_ZONES = { zw_prologue: 'rm_jewel_hare', zw_forest: 'rm_bloom_fawn', z_r_forest_maze: 'rm_glass_moth', z_r_forest_tree: 'rm_acorn_prince',
        zw_desert: 'rm_diamond_lizard', z_r_desert_tomb: 'rm_gold_idol', zw_snow: 'rm_aurora_bird', z_r_snow_peak: 'rm_icetail_fox', zw_marsh: 'rm_lotus_sprite',
        z_r_marsh_manor: 'rm_ghost_teapot', z_r_marsh_bog: 'rm_bell_snail', zw_isles: 'rm_star_whale', z_r_isles_ship: 'rm_treasure_crab', zw_mine: 'rm_gem_hedgehog',
        z_r_mine_mine: 'rm_prisma', zw_ash: 'rm_spa_monkey', z_r_ash_volcano: 'rm_volcano_turtle', zw_star: 'rm_moon_sheep', z_r_star_tower: 'rm_clock_bird',
        z_finale_archive_lo: 'rm_bookworm', z_finale_archive_hi: 'rm_golden_quill', z_postgame_oblivion_lo: 'rm_memory_fish', z_postgame_oblivion_hi: 'rm_dream_tapir' };
      for (const [z, m] of Object.entries(RARE_ZONES)) {
        const r = DB.rareEncounters[z];
        if (!r) E(V, 'A12', `rareEncounters.${z} (§9.7.3: ${m}) is missing`);
        else if (r.mon !== m) E(V, 'A12', `rareEncounters.${z}: ${r.mon} (§9.7.3: ${m})`);
      }
      // A12.4 / R4.3: the 23 rows are the ones src/data/rare_encounters.js registers; count only those
      const RARE_FILE = 'src/data/rare_encounters.js';
      const fromFile = Object.keys(DB.rareEncounters).filter((z) => provOf('rareEncounters', z) === RARE_FILE);
      if (fromFile.length !== 23) E(V, 'A12', `${RARE_FILE} registers ${fromFile.length} rare encounter row(s) (§9.7.3: 23)`);
      for (const z of fromFile) if (!RARE_ZONES[z]) E(V, 'A12', `${RARE_FILE}: rareEncounters.${z} is not one of the 23 zones of §9.7.3`);
      // §10.6.4 「レア魔物の小部屋」: a room zone derived from a parent zone (same groups), same rare monster, rate = ⌈parent / 3⌉
      const RARE_ROOMS = { z_r_marsh_teaparty: 'z_r_marsh_manor', z_r_mine_den: 'z_r_mine_mine', z_postgame_oblivion_den: 'z_postgame_oblivion_hi' };
      const extra = [];
      for (const z of Object.keys(DB.rareEncounters)) {
        if (fromFile.includes(z)) continue;
        const r = DB.rareEncounters[z], o = own('rareEncounters', z), parent = RARE_ROOMS[z], pr = parent && DB.rareEncounters[parent];
        if (!parent) { extra.push(z); continue; }
        if (!pr) { E(V, o, `rareEncounters.${z}: parent zone ${parent} (§10.6.4) has no rare row`); continue; }
        if (r.mon !== pr.mon) E(V, o, `rareEncounters.${z}: ${r.mon} ≠ ${pr.mon} of ${parent} (§10.6.4: same rare monster)`);
        const want = Math.max(1, Math.ceil(pr.rate / 3));
        if (r.rate !== want) E(V, o, `rareEncounters.${z}: rate 1/${r.rate} ≠ ⌈${pr.rate}/3⌉ = 1/${want} (§10.6.4: rare rate ×3 of ${parent})`);
        const ez = DB.encounters[z], ep = DB.encounters[parent];
        if (ez && ep && JSON.stringify(ez.groups) !== JSON.stringify(ep.groups)) E(V, o, `encounters.${z}: groups differ from ${parent} (§10.6.4: the room zone copies its parent)`);
      }
      if (extra.length) W(V, 'A12', `${extra.length} rare encounter zone(s) beyond the 23 of §9.7.3 and the §10.6.4 rooms: ${extra.map((z) => z + '→' + DB.rareEncounters[z].mon + ' (' + (provOf('rareEncounters', z) || '?') + ')').join(' ')}`);
    }
    if (techs.length && techs.length !== 121) E(V, 'A7', `${techs.length} techs (121)`);
    if (spells.length && spells.length !== 77) E(V, 'A8', `${spells.length} spells (77)`);
    if (!empty('statuses')) for (const s of [...C.BAD, ...C.GOOD]) if (!DB.statuses[s]) E(V, 'A8', `DB.statuses.${s} missing`);
    if (!empty('elements')) for (const e of C.ELEMENTS) if (!DB.elements[e]) E(V, 'A8', `DB.elements.${e} missing`);
  }

  R.warn = () => {};
  return { rep, R, L, maps, secretCells, warnSink };
}

// =====================================================================================================
// CLI
// =====================================================================================================
function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  const owners = arg('owner') ? arg('owner').split(',') : null;
  const only = arg('only') ? arg('only').split(',') : null;
  const withDirs = arg('with') ? arg('with').split(',') : null;
  const quiet = argv.includes('--quiet'), summary = argv.includes('--summary'), partial = argv.includes('--partial');
  const t0 = Date.now();
  const full = argv.includes('--full'), sweepOnly = argv.includes('--sweep-only');
  const { rep, R } = sweepOnly ? { rep: new Report(), R: null } : run({ only, with: withDirs });
  if (full || sweepOnly) {
    const res = runSweep({ extra: arg('sweep-extra') ? arg('sweep-extra').split(',') : [] });
    for (const x of res) console.log(`sweep ${x.rc === 0 ? 'ok  ' : 'FAIL'} ${path.isAbsolute(x.tool) ? path.relative(ROOT, x.tool) : 'tools/' + x.tool} [${x.owner}] rc=${x.rc} ${(x.ms / 1000).toFixed(1)}s — ${x.tail.split('\n').slice(-1)[0]}`);
    rep.items.push(...sweepFindings(res));
    console.log('');
  }
  let list = rep.items;
  if (owners) list = list.filter((x) => owners.includes(x.owner));
  const errs = list.filter((x) => x.level === 'error'), warns = list.filter((x) => x.level === 'warn'), pend = list.filter((x) => x.level === 'pending');
  const fmt = (x) => `${x.level === 'error' ? 'ERROR' : x.level === 'warn' ? 'WARN ' : 'PEND '} [${x.check}][${x.owner}] ${x.msg}`;
  if (!summary) {
    for (const x of pend) console.log(fmt(x));
    if (!quiet) for (const x of warns) console.log(fmt(x));
    for (const x of errs) console.log(fmt(x));
  }
  const byCheck = {}, byOwner = {};
  for (const x of list) {
    const k = x.check; byCheck[k] = byCheck[k] || { error: 0, warn: 0, pending: 0 }; byCheck[k][x.level]++;
    const o = x.owner; byOwner[o] = byOwner[o] || { error: 0, warn: 0, pending: 0 }; byOwner[o][x.level]++;
  }
  const line = (o) => Object.entries(o).sort().map(([k, v]) => `${k} ${v.error}/${v.warn}${v.pending ? '/' + v.pending + 'p' : ''}`).join('  ');
  console.log('\nby check (errors/warnings): ' + line(byCheck));
  console.log('by owner (errors/warnings): ' + line(byOwner));
  const DB = R && R.DB || {};
  const nn = (r) => Object.keys(DB[r] || {}).length;
  console.log(`\nvalidate: ${errs.length} error(s), ${warns.length} warning(s), ${pend.length} pending${owners ? ' (owner ' + owners.join(',') + ')' : ''}. ` +
    `items ${nn('items')}, actions ${nn('actions')}, monsters ${nn('monsters')}, maps ${nn('maps')}, events ${nn('events')}, encounters ${nn('encounters')} — ${Date.now() - t0} ms`);
  const jsonOut = arg('json');
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(list, null, 1));
  process.exitCode = errs.length || (pend.length && !partial) ? 1 : 0;
}

// =====================================================================================================
// QA SWEEP (--full): conformance tools of other owners that the one-pass validation must include
// (BRIEF A2.4 check_battle, A14b.3 check_mons-base). Each runs in its own process; exit ≠ 0 → error.
// =====================================================================================================
const SWEEP = [
  { tool: 'check_battle.js', owner: 'A2', why: 'BRIEF A2.4 (battle formulas vs DESIGN §4 / §9)', timeout: 300 },
  { tool: 'check_mons-base.js', owner: 'A14b', why: 'BRIEF A14b.3 (monster base sprites, headless Chromium)', timeout: 600 },
];
/** runs every SWEEP tool; returns [{tool, owner, rc, ms, tail}] (rc null = could not start / timed out) */
function runSweep(opts) {
  opts = opts || {};
  const { spawnSync } = require('child_process');
  const out = [];
  const list = SWEEP.concat((opts.extra || []).map((f) => ({ tool: path.resolve(f), owner: opts.extraOwner || '?', why: 'extra sweep tool', timeout: 600 })));
  for (const s of list) {
    const file = path.isAbsolute(s.tool) ? s.tool : path.join(__dirname, s.tool);
    const t0 = Date.now();
    if (!fs.existsSync(file)) { out.push({ ...s, rc: null, ms: 0, tail: 'tools/' + s.tool + ' is missing' }); continue; }
    const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8', timeout: s.timeout * 1000, maxBuffer: 64 << 20 });
    const text = ((r.stdout || '') + (r.stderr || '')).trim();
    const tail = text.split('\n').slice(-(opts.tailLines || 4)).join('\n');
    const rc = r.error ? null : r.status;
    out.push({ ...s, rc, ms: Date.now() - t0, tail: r.error ? String(r.error.code || r.error.message) + (tail ? '\n' + tail : '') : tail, signal: r.signal || null });
  }
  return out;
}
function sweepFindings(results) {
  return results.filter((x) => x.rc !== 0).map((x) => ({ level: 'error', check: 'SWEEP', owner: x.owner,
    msg: `${path.isAbsolute(x.tool) ? path.relative(ROOT, x.tool) : 'tools/' + x.tool} ${x.rc == null ? 'did not finish (' + (x.signal || 'error') + ')' : 'exit ' + x.rc} — ${x.why}: ${x.tail.split('\n').slice(-2).join(' | ')}` }));
}

module.exports = { SWEEP, runSweep, sweepFindings, run, loadTracked, ownerOfFile, expectedOwner, expectedMapOwner, textWidth, stripComments, CONTRACT: C, srTierOf, band };
if (require.main === module) main();
