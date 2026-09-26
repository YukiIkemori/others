// Regular monsters' composition table (A14a mons-parts, DESIGN §9.4.6): 211 entries
// R.Art.MON_COMPOSE_MOBS[spriteId] = [base, {hue, sat, bri}, [[part, opts], …], filter?]
// Added into R.Art.MON_COMPOSE one id at a time (never assigned wholesale, so the bosses' table of A15
// survives either load order); an id that is already there is a duplicate (warned, not overwritten).
// Each id registers 'mon:<id>', whose factory calls R.Art.compose at first use (no load-order dependency).
//
// The table is §9.4.6 verbatim, except seven stage-2+ entries that were a pure colour shift of an earlier
// stage (beetle_2, crystal_2..4, frog_3, darkmage_2, darkmage_3). Each got the part its bestiary text
// describes (marked "+ (A14a)"), so every stage of a lineage reads as a different monster, not a recolour.
// Fifteen hue values were corrected (marked "colour (A14a)") where §9.4.6's numbers, applied to the real
// base colours, gave a colour the monster's own name or bestiary text contradicts (紅水晶 came out green,
// ゼリー将軍 "赤いゼリー" green, 砂ヘビ green, 毒ガエル "青と黄色" purple, …). Measured with the dominant hue
// of the recoloured base (tools/check_mons-parts.js, check "colour words").
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const MOBS = (A.MON_COMPOSE_MOBS = {
    // jelly ゼリー
    jelly_1: ['jelly', {}, []],
    jelly_2: ['jelly', { hue: 170 }, [['bubbles', { c: '#c8f0ff' }]]],
    jelly_3: ['jelly', { hue: 110, sat: 1.1, bri: 0.85 }, [['drips', { c: '#a060e0' }], ['skull_mark', { c: '#f0e0ff' }]]],
    jelly_4: ['jelly', { hue: -150, sat: 1.1 }, [['helm', { c: '#9aa0b0', style: 'horned' }], ['sword', { c: '#d8dce8' }]]], // colour (A14a): 赤いゼリー
    jelly_5: ['jelly', {}, [['tiara', { c: '#ffe070', gem: '#ff60c0' }]], 'prism'],
    // rat ネズミ
    rat_1: ['rat', {}, []],
    rat_2: ['rat', { hue: 80, sat: 0.8 }, [['eyes_glow', { c: '#a0ff60' }]]],
    rat_3: ['rat', { sat: 0.3, bri: 0.9 }, [['teeth_iron', { c: '#c8ccd8' }], ['armor_plates', { c: '#8890a0' }]]],
    rat_4: ['rat', { hue: -20, bri: 0.8 }, [['eyepatch'], ['bandana', { c: '#c03030' }], ['sword', { c: '#c0c4d0', size: 's' }]]],
    // bat コウモリ
    bat_1: ['bat', {}, []],
    bat_2: ['bat', { hue: 55, sat: 1.2 }, [['eyes_glow', { c: '#ff4040' }]]], // colour (A14a): 体が赤く染まる
    bat_3: ['bat', { hue: 260 }, [['aura', { c: '#c090ff' }]]],
    bat_4: ['bat', { sat: 0.5, bri: 0.55 }, [['eyes_glow', { c: '#ff3050' }], ['aura', { c: '#502070' }]]],
    bat_5: ['bat', { hue: 330, sat: 1.1, bri: 0.7 }, [['crown', { c: '#e0c050', gem: '#c02040' }], ['cape', { c: '#301020', c2: '#c02030' }]]],
    // paper 虚ろの使い
    paper_1: ['imp', {}, [], 'paper'],
    paper_2: ['wolf', {}, [], 'paper'],
    paper_3: ['armor', {}, [], 'paper'],
    paper_4: ['wyvern', {}, [], 'paper'],
    // crab カニ
    crab_1: ['crab', {}, []],
    crab_2: ['crab', { hue: 200, sat: 0.35 }, [['armor_plates', { c: '#7c8898' }]]],
    crab_3: ['crab', { hue: 190 }, [['bubbles', { c: '#e0ffff' }]]], // colour (A14a): 青いカニ
    crab_4: ['crab', { hue: 30, sat: 0.6, bri: 1.1 }, [['shell_tower', { c: '#d8c8a0' }]]],
    // seabird カモメ
    seabird_1: ['seabird', {}, []],
    seabird_2: ['seabird', { sat: 0.3, bri: 0.75 }, [['storm', { c: '#c0d8f0' }]]],
    seabird_3: ['seabird', { hue: 30, sat: 0.7 }, [['bandana', { c: '#2040a0' }]]],
    seabird_4: ['seabird', { bri: 1.15 }, [['beard', { c: '#f8f8f0' }], ['aura', { c: '#90c0ff' }]]],
    // bee ハチ
    bee_1: ['bee', {}, []],
    bee_2: ['bee', { hue: 250, sat: 0.9 }, [['stinger', { c: '#a040c0' }]]],
    bee_3: ['bee', { hue: 190 }, [['sparks', { c: '#fff080' }]]],
    bee_4: ['bee', { hue: -30, sat: 1.1, bri: 0.8 }, [['spikes', { c: '#302020' }]]],
    bee_5: ['bee', { hue: 15, sat: 1.2 }, [['crown', { c: '#ffd040', gem: '#ff4080' }], ['wings_insect', { c: '#ffe8a0', size: 'l' }]]],
    // mushroom キノコ
    mushroom_1: ['mushroom', {}, []],
    mushroom_2: ['mushroom', { hue: 260 }, [['spots', { c: '#f0e060' }]]],
    mushroom_3: ['mushroom', { hue: 120, sat: 1.2 }, [['spots', { c: '#ff80ff' }], ['aura', { c: '#ffa0ff' }]]],
    mushroom_4: ['mushroom', { hue: 20, sat: 0.5, bri: 1.05 }, [['beard', { c: '#f4f0e0' }], ['staff', { c: '#8a6040', gem: '#80ff80' }]]],
    // plant 人食い花
    plant_1: ['plant', {}, []],
    plant_2: ['plant', { hue: -20, sat: 0.9, bri: 0.85 }, [['thorns', { c: '#2a5020' }]]],
    plant_3: ['plant', { hue: -60, sat: 1.1 }, [['smoke', { c: '#b080e0' }]]], // colour (A14a): 紫の花びら
    plant_4: ['plant', { hue: 230, sat: 0.9, bri: 0.65 }, [['aura', { c: '#8090ff' }]]],
    plant_5: ['plant', { hue: 40, sat: 0.6, bri: 1.2 }, [['halo', { c: '#fff4b0' }], ['flower', { c: '#ffffff' }]]],
    // fairy 妖精
    fairy_1: ['fairy', {}, []],
    fairy_2: ['fairy', { hue: 300 }, [['flower', { c: '#ff90c0' }]]],
    fairy_3: ['fairy', { hue: 180, sat: 0.6, bri: 1.1 }, [['mist', { c: '#d0f0ff' }]]],
    fairy_4: ['fairy', { hue: 40, sat: 0.7, bri: 1.2 }, [['tiara', { c: '#ffe070', gem: '#80e0ff' }], ['wings_feather', { c: '#fff8e0', size: 's' }]]],
    // treant 魔木
    treant_1: ['treant', {}, []],
    treant_2: ['treant', { hue: -30, sat: 0.9, bri: 0.9 }, [['thorns', { c: '#402810' }]]],
    treant_3: ['treant', { hue: 30, sat: 0.8 }, [['moss', { c: '#58a040' }], ['flower', { c: '#ffe080' }]]],
    treant_4: ['treant', { hue: 50, sat: 0.7, bri: 0.9 }, [['moss', { c: '#407838' }], ['crown', { c: '#78c050', style: 'leaf' }], ['eyes_glow', { c: '#ffe070' }]]],
    // scorpion サソリ
    scorpion_1: ['scorpion', {}, []],
    scorpion_2: ['scorpion', { hue: 100 }, [['stinger', { c: '#80e040' }]]],
    scorpion_3: ['scorpion', { sat: 0.25, bri: 0.95 }, [['armor_plates', { c: '#8a94a4' }]]],
    scorpion_4: ['scorpion', { hue: 260, sat: 0.6, bri: 0.6 }, [['skull_mark', { c: '#e0e0e0' }], ['eyes_glow', { c: '#ff2040' }]]],
    scorpion_5: ['scorpion', { hue: 30, sat: 0.8, bri: 0.8 }, [['crown', { c: '#f0c030', gem: '#40c0ff' }], ['armor_plates', { c: '#c09030' }]]],
    // snake ヘビ
    snake_1: ['snake', { hue: -70, sat: 0.7, bri: 1.1 }, []], // colour (A14a): 砂と同じ色
    snake_2: ['snake', { hue: 20, sat: 0.8, bri: 0.85 }, [['rattle', { c: '#e0c080' }]]],
    snake_3: ['snake', { hue: 60, sat: 1.1 }, [['eyes_glow', { c: '#ff3030' }], ['hood', { c: '#5a8030', style: 'cobra' }]]],
    snake_4: ['snake', { hue: -75, sat: 1, bri: 0.8 }, [['horns', { c: '#d8c090', len: 's' }], ['armor_plates', { c: '#a88040' }]]], // colour (A14a): 砂の大蛇
    // mummy ミイラ
    mummy_1: ['mummy', {}, []],
    mummy_2: ['mummy', { hue: 250, sat: 0.4, bri: 0.9 }, [['eyes_glow', { c: '#b040ff' }]]],
    mummy_3: ['mummy', { hue: 20, sat: 0.5 }, [['hood', { c: '#d8b040' }], ['staff', { c: '#c09030', gem: '#40e0c0' }]]],
    mummy_4: ['mummy', { hue: 10, sat: 0.6 }, [['helm', { c: '#d0a830', style: 'plume' }], ['sword', { c: '#e0c060' }], ['shield', { c: '#b08830' }]]],
    mummy_5: ['mummy', { hue: 20, sat: 0.7, bri: 1.05 }, [['crown', { c: '#f0c040', gem: '#30c0a0', style: 'nemes' }], ['cape', { c: '#304080', c2: '#d0b040' }]]],
    // cactus サボテン
    cactus_1: ['cactus', {}, []],
    cactus_2: ['cactus', { hue: -15, sat: 1.1, bri: 0.9 }, [['spikes', { c: '#f0f0d0' }]]],
    cactus_3: ['cactus', { hue: 10 }, [['flower', { c: '#ff4060' }]]],
    cactus_4: ['cactus', { hue: -10, sat: 1.2, bri: 0.85 }, [['beard', { c: '#f0f0e0', style: 'mustache' }], ['spikes', { c: '#ffffe0' }], ['helm', { c: '#d0a030', style: 'kabuto' }]]],
    // sandworm ミミズ
    sandworm_1: ['sandworm', {}, []],
    sandworm_2: ['sandworm', { sat: 0.3, bri: 0.85 }, [['armor_plates', { c: '#7a7060', style: 'rock' }]]],
    sandworm_3: ['sandworm', { hue: -20, sat: 1.1, bri: 0.75 }, [['spikes', { c: '#d0a070' }], ['crystals', { c: '#f0a040' }]]],
    // wolf オオカミ
    wolf_1: ['wolf', { sat: 0.5 }, []],
    wolf_2: ['wolf', { hue: 20, sat: 0.6, bri: 1.15 }, [['frost', { c: '#e8fcff' }]]],
    wolf_3: ['wolf', { sat: 0.2, bri: 1.3 }, [['frost', { c: '#ffffff' }], ['mist', { c: '#e0f0ff' }]]],
    wolf_4: ['wolf', { hue: 40, sat: 0.8, bri: 0.5 }, [['eyes_glow', { c: '#ffe040' }], ['aura', { c: '#303870' }]]],
    wolf_5: ['wolf', { sat: 0.3, bri: 1.2 }, [['crown', { c: '#b0e8ff', style: 'ice' }], ['frost', { c: '#ffffff' }], ['aura', { c: '#80d0ff' }]]],
    // yeti 雪男
    yeti_1: ['yeti', {}, []],
    yeti_2: ['yeti', { hue: 20, sat: 1.2 }, [['crystals', { c: '#a0e0ff' }], ['frost', { c: '#e0ffff' }]]],
    yeti_3: ['yeti', { hue: 20, sat: 0.8, bri: 0.9 }, [['mask', { c: '#e8e0d0', style: 'bone' }], ['horns', { c: '#f0e8d8', len: 'm' }]]],
    // frostling 氷の小鬼
    frostling_1: ['frostling', {}, []],
    frostling_2: ['frostling', { hue: 15 }, [['crystals', { c: '#c0f0ff' }]]],
    frostling_3: ['frostling', { sat: 0.4, bri: 1.2 }, [['mist', { c: '#f0f8ff' }]]],
    frostling_4: ['frostling', { hue: 20, sat: 1.1 }, [['helm', { c: '#c0e8ff', style: 'kabuto' }], ['sword', { c: '#e0f8ff', style: 'ice' }]]],
    frostling_5: ['frostling', { hue: 30, sat: 1.2, bri: 0.9 }, [['helm', { c: '#9ad0ff', style: 'kabuto_big' }], ['cape', { c: '#e0f0ff', c2: '#6090d0' }], ['aura', { c: '#c0e8ff' }]]],
    // owl フクロウ
    owl_1: ['owl', {}, []],
    owl_2: ['owl', { hue: 30, sat: 0.7 }, [['hat', { c: '#6070c0', style: 'night' }]]],
    owl_3: ['owl', { hue: 270, sat: 1.1 }, [['eyes_glow', { c: '#ff80ff', style: 'spiral' }]]],
    owl_4: ['owl', { hue: 200, sat: 0.8 }, [['hat', { c: '#304890', style: 'wizard' }], ['book', { c: '#c04040' }], ['monocle']]],
    // mammoth マンモス
    mammoth_1: ['mammoth', {}, []],
    mammoth_2: ['mammoth', { hue: -10, sat: 0.8, bri: 0.85 }, [['tusks', { c: '#b8c0d0', style: 'iron' }], ['armor_plates', { c: '#7c8494' }]]],
    mammoth_3: ['mammoth', { sat: 0.2, bri: 1.25 }, [['crown', { c: '#e0c050', gem: '#60c0ff' }], ['frost', { c: '#ffffff' }]]],
    // ghost 霊
    ghost_1: ['ghost', {}, []],
    ghost_2: ['ghost', { hue: 20, sat: 1.2 }, [['drips', { c: '#a0d0ff', style: 'tears' }]]],
    ghost_3: ['ghost', { hue: 50, sat: 0.8, bri: 0.8 }, [['eyes_glow', { c: '#ff3050' }], ['chain', { c: '#6a6480' }]]], // colour (A14a): 紫の霊
    ghost_4: ['ghost', { hue: 330, sat: 1.2, bri: 0.7 }, [['chain', { c: '#503040' }], ['aura', { c: '#801030' }]]],
    ghost_5: ['ghost', { hue: 250, sat: 1.2, bri: 0.6 }, [['crown', { c: '#b0a0e0', gem: '#ff4080' }], ['cape', { c: '#201030', c2: '#8040c0' }], ['aura', { c: '#6030a0' }]]],
    // wisp 鬼火
    wisp_1: ['wisp', { hue: -170, sat: 1.2 }, []],
    wisp_2: ['wisp', { hue: -100, sat: 1.2 }, [['eyes_glow', { c: '#ffffff', style: 'face' }]]],
    wisp_3: ['wisp', { sat: 0.4, bri: 1.2 }, [['aura', { c: '#c0e0ff' }]]],
    wisp_4: ['wisp', { hue: 15, sat: 1.2, bri: 0.55 }, [['aura', { c: '#502080' }], ['skull_mark', { c: '#d0c0ff' }]]], // colour (A14a): 青黒い炎
    // frog カエル
    frog_1: ['frog', {}, []],
    frog_2: ['frog', { hue: 125, sat: 1.3 }, [['spots', { c: '#ffd020' }]]], // colour (A14a): 青と黄色のカエル
    frog_3: ['frog', { hue: 40, sat: 0.8, bri: 0.9 }, [['horns', { c: '#a88848', len: 's' }], ['spots', { c: '#503818' }]]], // + (A14a): 角ガエルの大口
    frog_4: ['frog', { hue: 20, sat: 0.7, bri: 0.95 }, [['bell', { c: '#c89040' }]]],
    // doll 人形
    doll_1: ['doll', {}, []],
    doll_2: ['doll', { hue: 300, sat: 0.9 }, [['ribbon', { c: '#ff70a0' }]]],
    doll_3: ['doll', { sat: 0.4, bri: 0.7 }, [['pins', { c: '#d0d0d0' }], ['eyes_glow', { c: '#ff2020' }]]],
    doll_4: ['doll', { hue: 200, sat: 0.8 }, [['hat', { c: '#403060', style: 'lady' }], ['parasol', { c: '#e0d0f0' }]]],
    // lizardman トカゲ兵
    lizardman_1: ['lizardman', {}, []],
    lizardman_2: ['lizardman', { hue: 20 }, [['spear', { c: '#c0c0c8' }], ['helm', { c: '#8a7a50', style: 'cap' }]]],
    lizardman_3: ['lizardman', { hue: 250, sat: 0.8 }, [['hood', { c: '#6040a0' }], ['staff', { c: '#7a5a3a', gem: '#40ffc0' }]]],
    lizardman_4: ['lizardman', { hue: -20, sat: 1.1 }, [['crown', { c: '#e0a040', style: 'feather' }], ['axe', { c: '#c8ccd0' }], ['shield', { c: '#806030' }]]],
    // spider クモ
    spider_1: ['spider', {}, []],
    spider_2: ['spider', { hue: 250, sat: 1.1 }, [['spots', { c: '#80ff40' }]]],
    spider_3: ['spider', { sat: 0.3, bri: 0.4 }, [['eyes_glow', { c: '#ff2020', style: 'many' }]]],
    spider_4: ['spider', { hue: 15, sat: 1.3, bri: 0.9 }, [['eyes_glow', { c: '#ffd040', style: 'many' }], ['spots', { c: '#ffd040', style: 'stripes' }]]], // colour (A14a): 金と黒のしま
    // merman 魚人
    merman_1: ['merman', {}, []],
    merman_2: ['merman', { hue: -30 }, [['helm', { c: '#708090', style: 'fin' }]]],
    merman_3: ['merman', { hue: 90, sat: 0.8 }, [['hood', { c: '#5030a0' }], ['staff', { c: '#e07080', gem: '#ffffff', style: 'coral' }]]],
    merman_4: ['merman', { hue: 190, sat: 0.7 }, [['armor_plates', { c: '#80a0b0' }], ['helm', { c: '#a0b8c8', style: 'fin' }], ['shield', { c: '#6080a0' }]]],
    // kraken タコ
    kraken_1: ['kraken', {}, []],
    kraken_2: ['kraken', { hue: -20, sat: 1.2 }, [['spots', { c: '#ffe0e0', style: 'suckers' }]]],
    kraken_3: ['kraken', { hue: 200, sat: 0.9, bri: 0.8 }, [['storm', { c: '#80c0ff', style: 'whirl' }]]],
    // skeleton 骸骨
    skeleton_1: ['skeleton', {}, [['bandana', { c: '#c03030' }]]],
    skeleton_2: ['skeleton', {}, [['hat', { c: '#302020', style: 'tricorn' }], ['eyepatch']]],
    skeleton_3: ['skeleton', { hue: 20, sat: 0.6 }, [['bandana', { c: '#303030' }], ['cannon', { c: '#404048' }]]],
    skeleton_4: ['skeleton', {}, [['hat', { c: '#203050', style: 'tricorn' }], ['cape', { c: '#203050', c2: '#c0a040' }]]],
    skeleton_5: ['skeleton', {}, [['hat', { c: '#e0c050', style: 'bicorne' }], ['cape', { c: '#302050', c2: '#e0c050' }], ['sword', { c: '#f0d060' }]]],
    // golem 石くれ兵
    golem_1: ['golem', {}, []],
    golem_2: ['golem', { hue: 180, sat: 0.4, bri: 0.8 }, [['armor_plates', { c: '#9a5a40', style: 'rivet' }]]],
    golem_3: ['golem', { hue: 60, sat: 0.8, bri: 1.1 }, [['crystals', { c: '#ff60c0' }], ['runes', { c: '#80ffff' }]]],
    // mole モグラ
    mole_1: ['mole', {}, []],
    mole_2: ['mole', { hue: -10, sat: 0.8 }, [['hat', { c: '#d0a030', style: 'miner' }], ['claws', { c: '#b0b8c8' }]]],
    mole_3: ['mole', { hue: 10, sat: 1.1 }, [['hat', { c: '#d0a030', style: 'miner' }], ['bomb', { c: '#303030' }]]],
    mole_4: ['mole', { hue: 20, sat: 0.7, bri: 0.85 }, [['hat', { c: '#f0c040', style: 'miner' }], ['beard', { c: '#e0e0e0' }], ['pick', { c: '#c0c8d0' }]]],
    // beetle カブト
    beetle_1: ['beetle', {}, []],
    beetle_2: ['beetle', { sat: 0.2, bri: 0.7 }, [['armor_plates', { c: '#8a90a0', style: 'rivet' }]]], // + (A14a): 鉄の殻
    beetle_3: ['beetle', { hue: -40, sat: 1.2 }, [['sparks', { c: '#ffb040' }]]],
    beetle_4: ['beetle', { sat: 0.3, bri: 1.3 }, [['crystals', { c: '#e0f8ff' }]]],
    // crystal 水晶
    crystal_1: ['crystal', {}, []],
    crystal_2: ['crystal', { hue: 150, sat: 1.4 }, [['embers', { c: '#ffb040' }]]], // + (A14a): 中で火がゆれる; colour: 紅水晶: 赤
    crystal_3: ['crystal', { hue: 20, sat: 1.3 }, [['frost', { c: '#e8fcff' }]]], // + (A14a): 指が凍える; colour: 青水晶: 青
    crystal_4: ['crystal', { hue: 80, sat: 1.3, bri: 0.85 }, [['aura', { c: '#7040c0' }], ['runes', { c: '#e0a0ff' }]]], // + (A14a): 闇を吸いこむ; colour: 紫水晶: 紫
    // goblin 小鬼
    goblin_1: ['goblin', {}, []],
    goblin_2: ['goblin', { hue: 20 }, [['axe', { c: '#b8c0c8' }], ['helm', { c: '#807060', style: 'cap' }]]],
    goblin_3: ['goblin', { hue: -40 }, [['bandana', { c: '#e08020' }], ['goggles'], ['bomb', { c: '#303030' }]]],
    goblin_4: ['goblin', { hue: 40, sat: 1.1 }, [['helm', { c: '#a08050', style: 'horned' }], ['sword', { c: '#c0c8d0' }], ['shield', { c: '#806040' }]]],
    goblin_5: ['goblin', { hue: 60, sat: 1.2 }, [['crown', { c: '#f0c030', gem: '#ff3030' }], ['cape', { c: '#802020', c2: '#f0c030' }], ['sword', { c: '#f0d060' }]]],
    // salamander 火トカゲ
    salamander_1: ['salamander', {}, []],
    salamander_2: ['salamander', { hue: 10, sat: 1.1 }, [['flame', { c: '#ffc040', style: 'mouth' }]]],
    salamander_3: ['salamander', { hue: -20, sat: 1.2, bri: 0.7 }, [['embers', { c: '#ff7020' }]]],
    salamander_4: ['salamander', { hue: -10, sat: 1.2 }, [['horns', { c: '#ffa030', len: 'm' }], ['embers', { c: '#ffb040' }]]],
    salamander_5: ['salamander', { hue: -30, sat: 1.2, bri: 0.9 }, [['crown', { c: '#f0c030', gem: '#ff2020' }], ['wings_bat', { c: '#a02010', size: 's' }], ['aura', { c: '#ff6020' }]]],
    // imp 悪魔
    imp_1: ['imp', { sat: 0.2, bri: 0.6 }, []],
    imp_2: ['imp', {}, [['embers', { c: '#ffa040' }]]],
    imp_3: ['imp', { sat: 0.1, bri: 1.1 }, [['smoke', { c: '#a0a0a0' }]]],
    imp_4: ['imp', { hue: 20, sat: 1.2 }, [['horns', { c: '#301010', len: 'l' }], ['flame', { c: '#ff8020' }]]],
    imp_5: ['imp', { hue: 260, sat: 1 }, [['hat', { c: '#302050', style: 'wizard' }], ['book', { c: '#6030a0' }], ['monocle']]],
    // gargoyle 石像鬼
    gargoyle_1: ['gargoyle', {}, []],
    gargoyle_2: ['gargoyle', { sat: 0.3, bri: 0.45 }, [['eyes_glow', { c: '#ff3020' }]]],
    gargoyle_3: ['gargoyle', { hue: 115, sat: 1.3 }, [['embers', { c: '#ff6020' }]]], // colour (A14a): 溶岩で焼き固められた
    gargoyle_4: ['gargoyle', { sat: 0.5, bri: 0.85 }, [['horns', { c: '#606070', len: 'l' }], ['crown', { c: '#a0a0b0' }]]],
    // orc 大鬼
    orc_1: ['orc', { hue: 20, sat: 0.8 }, []],
    orc_2: ['orc', { hue: -30, sat: 0.9 }, [['club_iron', { c: '#505860' }], ['helm', { c: '#706050', style: 'horned' }]]],
    orc_3: ['orc', { hue: -60, sat: 1.1 }, [['horns', { c: '#e8e0d0', len: 'l' }], ['armor_plates', { c: '#604030' }]]],
    // chimera 三頭獣
    chimera_1: ['chimera', { hue: 20, sat: 0.8 }, []],
    chimera_2: ['chimera', { hue: -10, sat: 1.1 }, [['horns', { c: '#e8d8b0', len: 'm' }]]],
    chimera_3: ['chimera', { hue: -30, sat: 1.3, bri: 0.85 }, [['flame', { c: '#ff6020' }], ['horns', { c: '#301010', len: 'l' }]]],
    // eyeball 目玉
    eyeball_1: ['eyeball', {}, []],
    eyeball_2: ['eyeball', { hue: -60, sat: 1.2 }, [['eyes_glow', { c: '#ff2020' }]]],
    eyeball_3: ['eyeball', { hue: 120, sat: 1.2 }, [['eye3', { c: '#ffff80' }]]],
    eyeball_4: ['eyeball', { hue: 200, sat: 1.1, bri: 1.1 }, [['halo', { c: '#fff0a0' }]]],
    eyeball_5: ['eyeball', { hue: 180, sat: 0.6, bri: 1.25 }, [['crown', { c: '#ffe070', gem: '#80c0ff' }], ['wings_feather', { c: '#ffffff', size: 'm' }], ['aura', { c: '#fff0b0' }]]],
    // darkmage 魔術師
    darkmage_1: ['darkmage', { hue: 20, sat: 0.8 }, []],
    darkmage_2: ['darkmage', { hue: 60, sat: 1.2 }, [['embers', { c: '#ffa040' }]]], // + (A14a): 火の雨; colour: 赤い法衣
    darkmage_3: ['darkmage', { hue: -150, sat: 1.1 }, [['storm', { c: '#c8f0d8' }]]], // + (A14a): 風の刃
    darkmage_4: ['darkmage', { hue: 30, sat: 1.1, bri: 0.6 }, [['aura', { c: '#502080' }], ['staff', { c: '#302030', gem: '#c040ff' }]]],
    // automaton からくり
    automaton_1: ['automaton', {}, []],
    automaton_2: ['automaton', { hue: 20, sat: 0.8 }, [['bow', { c: '#a08040' }]]],
    automaton_3: ['automaton', { hue: 160, sat: 0.8 }, [['staff', { c: '#c0a040', gem: '#80e0ff', style: 'coil' }], ['runes', { c: '#80e0ff' }]]],
    automaton_4: ['automaton', { hue: 20, sat: 1.1 }, [['helm', { c: '#d0a030', style: 'kabuto' }], ['sword', { c: '#e0e0e8' }], ['cape', { c: '#a02020', c2: '#d0a030' }]]],
    // armor 鎧
    armor_1: ['armor', { sat: 0.6, bri: 0.9 }, []],
    armor_2: ['armor', { hue: 20 }, [['shield', { c: '#6070a0' }], ['spear', { c: '#c0c4d0' }]]],
    armor_3: ['armor', { hue: 200, sat: 0.8 }, [['helm', { c: '#c0c8e0', style: 'plume' }], ['cape', { c: '#3050a0', c2: '#e0c060' }], ['sword', { c: '#e0e4f0' }]]],
    armor_4: ['armor', { sat: 0.5, bri: 0.45 }, [['horns', { c: '#e0c060', len: 'm' }], ['aura', { c: '#402060' }], ['sword', { c: '#302030', style: 'great' }]]],
    // wyvern 飛竜
    wyvern_1: ['wyvern', {}, []],
    wyvern_2: ['wyvern', { hue: 30, sat: 1.1 }, [['horns', { c: '#e8d890', len: 'm' }]]],
    wyvern_3: ['wyvern', { sat: 0.3, bri: 0.7 }, [['storm', { c: '#c0d0ff' }], ['sparks', { c: '#ffffa0' }]]],
    // scribe 白衣の書記
    scribe_1: ['scribe', {}, []],
    scribe_2: ['scribe', {}, [['book', { c: '#f0f0f0' }], ['quill', { c: '#ffffff' }]]],
    scribe_3: ['scribe', {}, [['hood', { c: '#f0e8c0' }], ['staff', { c: '#d0c080', gem: '#ffffff' }], ['aura', { c: '#fff8d0' }]]],
    // book 魔書
    book_1: ['book', {}, []],
    book_2: ['book', { hue: 250, sat: 1.2, bri: 0.8 }, [['chain', { c: '#808090' }], ['eyes_glow', { c: '#ff40ff' }]]],
    book_3: ['book', { sat: 0, bri: 1.3 }, [['aura', { c: '#ffffff' }]]],
    // mimic 宝箱
    mimic_1: ['mimic', {}, []],
    mimic_2: ['mimic', { hue: 100, sat: 0.8 }, [['drips', { c: '#80e040' }]]],
    mimic_3: ['mimic', { hue: 240, sat: 0.7 }, [['chain', { c: '#707080' }], ['eyes_glow', { c: '#ff40ff' }]]],
    mimic_4: ['mimic', { sat: 0.5, bri: 0.45 }, [['crown', { c: '#e0c050' }], ['aura', { c: '#402060' }]]],
    // void 虚無の騎士
    void_1: ['void_wraith', {}, []],
    void_2: ['void_wraith', {}, [['crown', { c: '#d0c060' }], ['cape', { c: '#100818', c2: '#6040a0' }]]],
    void_3: ['void_wraith', { bri: 0.9 }, [['crown', { c: '#f0e0a0' }], ['cape', { c: '#180c28', c2: '#8060c0' }], ['aura', { c: '#6040a0' }]]],
    // chaos 混沌獣
    chaos_1: ['chaos_beast', {}, []],
    chaos_2: ['chaos_beast', { hue: 40, sat: 1.1 }, [['crown', { c: '#f0c030' }], ['crystals', { c: '#c080ff' }], ['aura', { c: '#8040c0' }]]],
    chaos_3: ['chaos_beast', { hue: 80, sat: 1.2 }, [['crown', { c: '#f04030' }], ['crystals', { c: '#ff6060' }], ['aura', { c: '#c02040' }]]],
    // demon 魔神
    demon_1: ['demon', { sat: 0.6, bri: 0.8 }, []],
    demon_2: ['demon', { hue: 200, sat: 0.8, bri: 0.7 }, [['armor_plates', { c: '#403050' }], ['helm', { c: '#302030', style: 'horned' }], ['sword', { c: '#503060', style: 'great' }]]],
    demon_3: ['demon', { hue: 240, sat: 0.9, bri: 0.65 }, [['crown', { c: '#e0c050', gem: '#ff2040' }], ['eye3', { c: '#ff4040' }], ['aura', { c: '#502070' }]]],
    // quicksilver 白銀ゼリー
    quicksilver_1: ['jelly', {}, [], 'chrome'],
    quicksilver_2: ['jelly', {}, [['tiara', { c: '#e8f0ff' }]], 'chrome'],
    // mirror 鏡カブト
    mirror_1: ['beetle', {}, [], 'mirror'],
    mirror_2: ['beetle', {}, [['horns', { c: '#f0f8ff', len: 'l' }]], 'mirror'],
    // platinum 白金の鬼火
    platinum_1: ['wisp', {}, [], 'platinum'],
    platinum_2: ['wisp', {}, [['crown', { c: '#fff8e0' }]], 'platinum'],
  });
  const pending = [];
  for (const id in MOBS) {
    if (A.MON_COMPOSE && A.MON_COMPOSE[id]) { R.warn('MON_COMPOSE: duplicate', id); continue; }
    (A.MON_COMPOSE = A.MON_COMPOSE || {})[id] = MOBS[id];
    const e = MOBS[id];
    R.Gfx.def('mon:' + id, () => (A.compose ? A.compose(e[0], e[1], e[2], e[3] || null, id) : R.Gfx.get('mon:' + e[0])));
    if (!R.Gfx.has('mon:' + e[0])) pending.push('mon:' + id);
  }
  // bases that are not drawn yet (§11.1.3): the id still works, it shows the placeholder until they land
  if (pending.length) (A.PENDING = A.PENDING || []).push(...pending);
})(window.RPG);
