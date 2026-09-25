// Boss monsters and the eleven boss troops (DESIGN §5.7, §7.4). Troop ids and
// sprites are fixed by the design; the dungeon/story events call ev.battle(id).
// Balanced with tools/sim_balance.js: ≈60–90 % wins for a sensible party at the
// stage's upper level (with healing), 6–15 rounds. Phases use hpBelow conds;
// escorts stand left and right of the boss (species are drawn in list order).
(function (R) {
  'use strict';

  const acts = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const BOSS_RES = { poison: 0.7, sleep: 1, paralyze: 1, confuse: 1, silence: 0.6, blind: 0.6, death: 1 };
  // element families as for regular monsters (monsters.js FAMILIES, DESIGN §5.5): a boss takes its
  // families' weaknesses at ×1.5 instead of ×2; `elem` lists the exceptions.
  const bossElem = (fam, extra) => {
    const e = R.famElem(fam);
    for (const k in e) if (e[k] > 1) e[k] = 1.5;
    return Object.assign(e, extra || {});
  };
  const boss = (o) => Object.assign({ flags: ['boss'], statusRes: BOSS_RES, eva: 2 }, o,
    { actions: acts(o.actions) }, o.fam ? { elem: bossElem(o.fam, o.elem) } : {});

  Object.assign(R.DB.monsters, {
    goblin_chief: boss({
      name: 'ゴブリン親分', sprite: 'boss_goblin_chief', lv: 7,
      hp: 420, mp: 0, atk: 54, def: 15, agi: 14, mag: 8, mdef: 6, exp: 160, gold: 180, jp: 60,
      fam: ['beast'], elem: { fire: 1.5 }, statusRes: Object.assign({}, BOSS_RES, { poison: 0.3, blind: 0.3 }),
      actions: [['attack', 6], ['en_club_storm', 2], ['en_shout', 2, { round: 2 }], ['en_herb', 3, { hpBelow: 0.4, once: true }]],
      drop: { item: 'seed_str', rate: 1 }, rare: { item: 'swallow_sword', rate: 4 },
      desc: '風の紋章の洞窟に居座るゴブリンの親分。\nこん棒を振り回して暴れる。',
    }),
    bandit_chief: boss({
      name: '盗賊頭', sprite: 'boss_bandit', lv: 12, actsPerTurn: 2,
      hp: 820, mp: 0, atk: 60, def: 26, agi: 30, mag: 12, mdef: 12, exp: 520, gold: 600, jp: 110,
      fam: ['human'],
      statusRes: Object.assign({}, BOSS_RES, { poison: 0.4, blind: 0.4, silence: 0.3 }),
      actions: [['attack', 6], ['en_double', 3], ['en_poison_blade', 2], ['en_smoke', 1, { every: [4, 1] }], ['en_steal', 1],
        ['en_focus', 2, { hpBelow: 0.5 }]],
      drop: { item: 'seed_agi', rate: 1 }, rare: { item: 'gold_charm', rate: 4 },
      desc: '港を封鎖した盗賊団の頭。\n素早いナイフさばきで相手を翻弄する。',
    }),
    sea_serpent: boss({
      name: '大海蛇', sprite: 'boss_serpent', lv: 16, actsPerTurn: 2,
      hp: 1400, mp: 0, atk: 88, def: 34, agi: 30, mag: 44, mdef: 18, exp: 1100, gold: 1100, jp: 180,
      fam: ['sea'],
      actions: [['attack', 5], ['en_bite_crush', 2], ['en_bind', 2], ['en_tsunami', 2, { every: [3, 2] }], ['en_breath_ice1', 2]],
      drop: { item: 'seed_hp', rate: 1 }, rare: { item: 'float_shoes', rate: 4 },
      desc: '水の洞窟の奥にすむ海ヘビの主。\n大波を呼び起こす。',
    }),
    sphinx: boss({
      name: 'スフィンクス', sprite: 'boss_sphinx', lv: 19, actsPerTurn: 2,
      hp: 1700, mp: 60, atk: 118, def: 42, agi: 36, mag: 74, mdef: 26, exp: 1900, gold: 1600, jp: 240,
      fam: ['rock'],
      actions: [['attack', 5], ['en_claws', 2], ['en_riddle', 1, { every: [4, 1] }], ['en_sandstorm', 2], ['en_thunder2', 2],
        ['en_ancient_heal', 3, { hpBelow: 0.35, once: true }]],
      drop: { item: 'seed_int', rate: 1 }, rare: { item: 'maneki', rate: 4 },
      desc: 'ピラミッドを守る最後の番人。\n謎に答えられぬ者を食らう。',
    }),
    frost_giant: boss({
      name: '氷河の巨人', sprite: 'boss_frost_giant', lv: 23, actsPerTurn: 2,
      hp: 2500, mp: 0, atk: 160, def: 52, agi: 30, mag: 60, mdef: 26, exp: 2800, gold: 2400, jp: 300,
      fam: ['frost', 'beast'],
      actions: [['attack', 5], ['en_frost_fist', 2], ['en_stomp', 2], ['en_breath_ice2', 2], ['en_breath_ice3', 1, { hpBelow: 0.5 }], ['en_focus', 1, { hpBelow: 0.5 }]],
      drop: { item: 'seed_vit', rate: 1 }, rare: { item: 'glacier_sword', rate: 4 },
      desc: '氷結の洞窟の奥で眠っていた巨人。\n吹雪を吐き、大地を踏み鳴らす。',
    }),
    flame_lord: boss({
      name: '炎魔神', sprite: 'boss_flame_lord', lv: 27, actsPerTurn: 2,
      hp: 2000, mp: 120, atk: 164, def: 60, agi: 44, mag: 100, mdef: 32, exp: 3700, gold: 3200, jp: 360,
      fam: ['flame'],
      actions: [['attack', 5], ['en_lava_blade', 2], ['en_breath_fire4', 2], ['en_inferno', 2, { every: [4, 3] }],
        ['en_flame_armor', 2, { hpBelow: 0.5, once: true }]],
      drop: { item: 'seed_str', rate: 1 }, rare: { item: 'flame_shield', rate: 4 },
      desc: '火山の炎が魔王の力で形を得た魔神。\nすべてを焼き尽くす。',
    }),
    star_guardian: boss({
      name: '星の守護神', sprite: 'boss_star_guardian', lv: 31, actsPerTurn: 2,
      hp: 3300, mp: 200, atk: 190, def: 66, agi: 60, mag: 140, mdef: 44, exp: 4700, gold: 4000, jp: 420,
      fam: ['light'], elem: { holy: 0 },
      actions: [['attack', 4], ['en_light_blade', 2], ['en_stardust', 2], ['en_thunder3', 2], ['en_star_rain', 2, { hpBelow: 0.5 }], ['en_null_wave', 1, { every: [5, 2] }],
        ['en_star_heal', 3, { hpBelow: 0.4, once: true }]],
      drop: { item: 'seed_mnd', rate: 1 }, rare: { item: 'wisdom_ring', rate: 4 },
      desc: '星の紋章を守るいにしえの守護神。\n真の勇者かどうかを試す。',
    }),
    dark_general: boss({
      name: '暗黒将軍', sprite: 'boss_general_a', lv: 36, actsPerTurn: 2,
      hp: 4500, mp: 0, atk: 190, def: 80, agi: 62, mag: 110, mdef: 48, exp: 6000, gold: 5000, jp: 480,
      fam: ['demon'], elem: { dark: -1 },
      actions: [['attack', 5], ['en_dark_blade', 3], ['en_dark_wave', 2], ['en_focus', 1, { hpBelow: 0.6 }], ['en_gloom', 1, { every: [5, 3] }]],
      drop: { item: 'seed_str', rate: 1 }, rare: { item: 'dawn_sword', rate: 8 },
      desc: '魔王軍最強の剣士。\n闇の剣で多くの勇者を葬ってきた。',
    }),
    lich_general: boss({
      name: '闇の大魔導士', sprite: 'boss_general_b', lv: 38, actsPerTurn: 2,
      hp: 5000, mp: 500, atk: 160, def: 72, agi: 70, mag: 260, mdef: 70, exp: 6900, gold: 5500, jp: 520,
      flags: ['boss', 'undead'], fam: ['undead'], elem: { holy: 2 },
      actions: [['attack', 2], ['en_inferno', 2], ['en_ice3', 2], ['en_dark2', 2], ['en_doom', 1, { every: [5, 2] }], ['en_mp_drain', 1],
        ['en_dark_heal', 3, { hpBelow: 0.3, once: true }]],
      drop: { item: 'seed_int', rate: 1 }, rare: { item: 'goddess_lyre', rate: 8 },
      desc: '死を超越した魔王の軍師。\nあらゆる呪文を極めた闇の魔導士。',
    }),
    demon_king: boss({
      name: '魔王ヴァルザード', sprite: 'boss_demon_king', lv: 40, actsPerTurn: 2,
      hp: 7200, mp: 0, atk: 255, def: 88, agi: 72, mag: 215, mdef: 64, exp: 0, gold: 0, jp: 0,
      fam: ['demon'], elem: { dark: -1 },
      drop: { item: 'light_drop', rate: 1 }, rare: { item: 'goddess_tear', rate: 2 },
      actions: [['attack', 4], ['en_demon_claw', 2], ['en_dark_thunder', 2], ['en_breath_fire4', 2], ['en_gloom', 1, { every: [4, 2] }],
        ['en_null_wave', 1, { hpBelow: 0.5 }]],
      desc: '光の紋章に封じられていた魔王。\n100年の時を経てよみがえった。',
    }),
    demon_king2: boss({
      name: '魔神ヴァルザード', sprite: 'boss_demon_king2', lv: 42, actsPerTurn: 2,
      hp: 6600, mp: 0, atk: 205, def: 92, agi: 76, mag: 165, mdef: 70, exp: 0, gold: 0, jp: 0,
      fam: ['demon'], elem: { dark: -1 },
      actions: [['attack', 4], ['en_ruin_blow', 2], ['en_breath_dark', 2], ['en_despair', 2], ['en_warp', 1, { every: [5, 3] }],
        ['en_null_wave', 1, { every: [6, 1] }], ['en_ruin_light', 1, { hpBelow: 0.5 }], ['en_dark_heal', 3, { hpBelow: 0.25, once: true }]],
      drop: { item: 'seed_luk', rate: 1 }, rare: { item: 'golden_maneki', rate: 1 },
      desc: '魔王が真の姿を現した破壊の魔神。\n世界を闇に沈めようとしている。',
    }),
  });

  const T = (mons, bg, bgm) => ({ mons, bg, bgm: bgm || 'boss', noEscape: true });
  Object.assign(R.DB.troops, {
    boss_wind: T([['goblin', 1, 1], ['goblin_chief', 1, 1], ['hob_goblin', 1, 1]], 'cave'),
    boss_fort: T([['banken', 1, 1], ['bandit_chief', 1, 1], ['yatoware_madoushi', 1, 1]], 'fort'),
    boss_water: T([['sea_serpent', 1, 1]], 'watercave'),
    boss_pyramid: T([['mummy', 1, 1], ['sphinx', 1, 1], ['skeleton', 1, 1]], 'pyramid'),
    boss_ice: T([['frost_giant', 1, 1]], 'ice'),
    boss_volcano: T([['onibi', 1, 1], ['flame_lord', 1, 1], ['hinoko_akuma', 1, 1]], 'volcano'),
    boss_star: T([['star_guardian', 1, 1]], 'tower'),
    boss_general1: T([['yami_kishi', 1, 1], ['dark_general', 1, 1], ['yami_kenshi', 1, 1]], 'demon'),
    boss_general2: T([['jigoku_bourei', 1, 1], ['lich_general', 1, 1], ['magan', 1, 1]], 'demon'),
    boss_king1: T([['demon_king', 1, 1]], 'throne', 'lastboss'),
    boss_king2: T([['demon_king2', 1, 1]], 'throne', 'lastboss'),
  });
})(window.RPG);
