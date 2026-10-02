// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/rare.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// Rare monsters (めずらしい魔物, 23. DESIGN §9.10). One per zone (rare_encounters.js);
// sprites mon:rare_* by art-rare A15b. A zone's random battle turns into the rare monster
// with p = 1/rate × (1 + rareEncPct/100) × lure (§4.10.3); the battle Lb is the zone's
// Lb + 2. Stats come from R.Mon.fillStats (KIND exp/gold ×5, no K.MOB): `lv` is the
// nominal level at the zone's first tier, `s.hp` 2.8–3.6.
// Rules applied by battle A2 from the 'rare' flag: boss status defaults (§4.8.3),
// no instant death, debuffs ×0.5, flee 25 %/turn from round 2, rank +2 / EF 2.0,
// manual start, BGM rarebattle, sparkles. All three drop slots are exclusive
// (§9.12.7): normal = that species' own item 1/2, rare = relic 1/6, super = relic 1/24
// (the four fixed-tier zones use fixed-tier super items; 夢食いバク 1/2 · 1/4 · 1/12).
// `appear` is the flavour line after 「〈魔物〉が現れた！」 (§11.5.9).
(function (R) {
  'use strict';

  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const DROPS = (item, rl, rs, rates) => ({
    normal: { item, rate: (rates || [2, 6, 24])[0] },
    rare: { item: rl, rate: (rates || [2, 6, 24])[1] },
    super: { item: rs, rate: (rates || [2, 6, 24])[2] },
  });
  const rare = (o) => {
    const d = Object.assign({ fleeRate: 0.25 }, o);
    d.flags = ['rare'].concat(o.flying ? ['flying'] : []);
    d.eva = o.flying ? 20 : 15;                                   // §9.2.3
    d.statusRes = Object.assign({ death: 1 }, o.statusRes || {});  // 即死は効かない
    delete d.flying;
    return d;
  };
  const CONSTRUCT_PHYS = { slash: 0.75, blunt: 1.5, pierce: 0.75 };
  const CONSTRUCT_RES = { poison: 1, sleep: 1, confuse: 1, death: 1 };
  const once = { once: true };

  const LIST = {
    // ------------------------------------------------------------ 序章
    rm_jewel_hare: rare({
      name: R.T('data.rare.LIST.rm_jewel_hare.name'), sprite: 'rare_hare', size: 'm', lv: 5, race: 'beast',
      elem: { fire: 1.25 },
      s: { hp: 3, atk: 0.9, def: 1.3, mdef: 1.3, agi: 1.8 },
      actions: A([['attack', 3], ['eb_hare_kick', 2], ['eb_jewel_shine', 2], ['eb_hop_rest', 1, { hpBelow: 0.5, once: true }]]),
      drops: DROPS('i_jewel_carrot', 'ac_rl_bird', 'ac_rs_bird'),
      appear: R.T('data.rare.LIST.rm_jewel_hare.appear'),
      desc: R.T('data.rare.LIST.rm_jewel_hare.desc'),
    }),
    // ------------------------------------------------------------ 地方1 ヴェルダの森
    rm_bloom_fawn: rare({
      name: R.T('data.rare.LIST.rm_bloom_fawn.name'), sprite: 'rare_fawn', size: 'm', lv: 8, race: 'beast', affinity: 'light',
      elem: { fire: 1.25, light: 0.25, dark: 1.5 },
      s: { hp: 3, atk: 0.9, mag: 1.2, mdef: 1.3, agi: 1.6 },
      actions: A([['attack', 2], ['eb_antler_thrust', 2], ['eb_petal_storm', 2], ['eb_fawn_bloom', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_bloom_nectar', 'ac_rl_bloom', 'ac_rs_bloom'),
      appear: R.T('data.rare.LIST.rm_bloom_fawn.appear'),
      desc: R.T('data.rare.LIST.rm_bloom_fawn.desc'),
    }),
    rm_glass_moth: rare({
      name: R.T('data.rare.LIST.rm_glass_moth.name'), sprite: 'rare_glassmoth', size: 'm', lv: 9, race: 'insect', flying: true,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, statusRes: { poison: 0.5 },
      s: { hp: 2.8, atk: 0.8, mag: 1.3, mdef: 1.2, agi: 1.8 },
      actions: A([['attack', 1], ['eb_glass_scale', 2], ['eb_prism_wing', 3], ['eb_flutter', 1, once]]),
      drops: DROPS('i_glass_dust', 'ac_rl_wind', 'ac_rs_wind'),
      appear: R.T('data.rare.LIST.rm_glass_moth.appear'),
      desc: R.T('data.rare.LIST.rm_glass_moth.desc'),
    }),
    rm_acorn_prince: rare({
      name: R.T('data.rare.LIST.rm_acorn_prince.name'), sprite: 'rare_acorn', size: 's', lv: 9, race: 'plant',
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      s: { hp: 3.2, def: 1.5, agi: 1.4 },
      actions: A([['attack', 2], ['eb_acorn_barrage', 3], ['eb_shell_guard', 1, once]]),
      drops: DROPS('i_golden_acorn', 'ac_rl_peak', 'ac_rs_peak'),
      appear: R.T('data.rare.LIST.rm_acorn_prince.appear'),
      desc: R.T('data.rare.LIST.rm_acorn_prince.desc'),
    }),
    // ------------------------------------------------------------ 地方2 ザハラ砂漠
    rm_diamond_lizard: rare({
      name: R.T('data.rare.LIST.rm_diamond_lizard.name'), sprite: 'rare_lizard', size: 'm', lv: 8, race: 'beast', affinity: 'earth',
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 },
      s: { hp: 3, def: 1.8, mdef: 1.2, agi: 1.5 },
      actions: A([['attack', 3], ['eb_tail_whip', 2], ['eb_jewel_shine', 2], ['eb_diamond_scales', 1, once]]),
      drops: DROPS('i_diamond_dust', 'ac_rl_iron', 'ac_rs_iron'),
      appear: R.T('data.rare.LIST.rm_diamond_lizard.appear'),
      desc: R.T('data.rare.LIST.rm_diamond_lizard.desc'),
    }),
    rm_gold_idol: rare({
      name: R.T('data.rare.LIST.rm_gold_idol.name'), sprite: 'rare_idol', size: 'm', lv: 9, race: 'construct', affinity: 'light',
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 3.2, atk: 0.9, mag: 1.3, def: 1.5, mdef: 1.5, agi: 1.3 },
      actions: A([['attack', 1], ['eb_idol_ray', 3], ['eb_idol_curse', 2], ['eb_idol_ward', 1, once]]),
      drops: DROPS('i_gold_bar', 'ac_rl_gold', 'ac_rs_gold'),
      appear: R.T('data.rare.LIST.rm_gold_idol.appear'),
      desc: R.T('data.rare.LIST.rm_gold_idol.desc'),
    }),
    // ------------------------------------------------------------ 地方3 ノルデン雪原
    rm_aurora_bird: rare({
      name: R.T('data.rare.LIST.rm_aurora_bird.name'), sprite: 'rare_bird', size: 'm', lv: 8, race: 'bird', affinity: 'light', flying: true,
      elem: { wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: { pierce: 1.25 },
      s: { hp: 2.8, atk: 0.9, mag: 1.3, mdef: 1.3, agi: 1.8 },
      actions: A([['attack', 1], ['eb_aurora_ray', 3], ['e_gust', 2], ['eb_aurora_veil', 1, once]]),
      drops: DROPS('i_aurora_feather', 'ac_rl_moon', 'ac_rs_moon'),
      appear: R.T('data.rare.LIST.rm_aurora_bird.appear'),
      desc: R.T('data.rare.LIST.rm_aurora_bird.desc'),
    }),
    rm_icetail_fox: rare({
      name: R.T('data.rare.LIST.rm_icetail_fox.name'), sprite: 'rare_icefox', size: 'm', lv: 9, race: 'beast', affinity: 'water',
      elem: { fire: 1.25, water: 0.25, earth: 1.5 },
      s: { hp: 3, mag: 1.2, agi: 1.8 },
      actions: A([['attack', 2], ['eb_ice_foxfire', 2], ['eb_nine_tails', 2], ['eb_fox_trick', 1]]),
      drops: DROPS('i_fox_icicle', 'ac_rl_frost', 'ac_rs_frost'),
      appear: R.T('data.rare.LIST.rm_icetail_fox.appear'),
      desc: R.T('data.rare.LIST.rm_icetail_fox.desc'),
    }),
    // ------------------------------------------------------------ 地方4 グレイモア湿原
    rm_lotus_sprite: rare({
      name: R.T('data.rare.LIST.rm_lotus_sprite.name'), sprite: 'rare_lotus', size: 's', lv: 8, race: 'fairy', affinity: 'water',
      elem: { water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, statusRes: { confuse: 0.5 },
      s: { hp: 3, atk: 0.8, mag: 1.3, mdef: 1.3, agi: 1.6 },
      actions: A([['attack', 1], ['e_water_bolt', 2], ['eb_lotus_bubble', 2], ['eb_lotus_dew', 1, { hpBelow: 0.6 }]]),
      drops: DROPS('i_lotus_dew', 'ac_rl_sun', 'ac_rs_sun'),
      appear: R.T('data.rare.LIST.rm_lotus_sprite.appear'),
      desc: R.T('data.rare.LIST.rm_lotus_sprite.desc'),
    }),
    rm_ghost_teapot: rare({
      name: R.T('data.rare.LIST.rm_ghost_teapot.name'), sprite: 'rare_teapot', size: 's', lv: 9, race: 'construct',
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 3, atk: 0.9, mag: 1.3, def: 1.3, agi: 1.5 },
      actions: A([['attack', 1], ['eb_hot_tea', 3], ['eb_steam_puff', 2], ['eb_tea_party', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_ghost_tea', 'ac_rl_tide', 'ac_rs_tide'),
      appear: R.T('data.rare.LIST.rm_ghost_teapot.appear'),
      desc: R.T('data.rare.LIST.rm_ghost_teapot.desc'),
    }),
    rm_bell_snail: rare({
      name: R.T('data.rare.LIST.rm_bell_snail.name'), sprite: 'rare_bellsnail', size: 'm', lv: 9, race: 'aquatic',
      elem: { fire: 0.75, water: 0.5, earth: 1.25 },
      s: { hp: 3.4, atk: 0.9, def: 1.6, mdef: 1.4, agi: 1.2 },
      actions: A([['attack', 2], ['eb_bell_toll', 2], ['eb_slime_trail', 2], ['eb_shell_retreat', 1, once]]),
      drops: DROPS('i_snail_bell', 'ac_rl_bell', 'ac_rs_bell'),
      appear: R.T('data.rare.LIST.rm_bell_snail.appear'),
      desc: R.T('data.rare.LIST.rm_bell_snail.desc'),
    }),
    // ------------------------------------------------------------ 地方5 マレア諸島
    rm_star_whale: rare({
      name: R.T('data.rare.LIST.rm_star_whale.name'), sprite: 'rare_whale', size: 'l', lv: 8, race: 'aquatic', affinity: 'light', flying: true,
      elem: { fire: 0.75, water: 0.5, wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 },
      s: { hp: 2.8, atk: 0.9, mag: 1.3, mdef: 1.3, agi: 1.3 },
      actions: A([['attack', 1], ['eb_stardust_spout', 3], ['eb_whale_song', 2], ['eb_star_tide', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_stardust', 'ac_rl_sea', 'ac_rs_sea'),
      appear: R.T('data.rare.LIST.rm_star_whale.appear'),
      desc: R.T('data.rare.LIST.rm_star_whale.desc'),
    }),
    rm_treasure_crab: rare({
      name: R.T('data.rare.LIST.rm_treasure_crab.name'), sprite: 'rare_hermit', size: 'm', lv: 9, race: 'aquatic',
      elem: { fire: 0.75, water: 0.5, earth: 1.25 },
      s: { hp: 3.2, def: 1.7, agi: 1.3 },
      actions: A([['attack', 2], ['eb_coin_toss', 2], ['eb_greed_claw', 2], ['eb_goblet_guard', 1, once]]),
      drops: DROPS('i_gold_coins', 'ac_rl_clover', 'ac_rs_clover'),
      appear: R.T('data.rare.LIST.rm_treasure_crab.appear'),
      desc: R.T('data.rare.LIST.rm_treasure_crab.desc'),
    }),
    // ------------------------------------------------------------ 地方6 ガルド山地
    rm_gem_hedgehog: rare({
      name: R.T('data.rare.LIST.rm_gem_hedgehog.name'), sprite: 'rare_hedgehog', size: 's', lv: 8, race: 'beast', affinity: 'earth',
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 },
      s: { hp: 3, def: 1.6, agi: 1.6 },
      actions: A([['attack', 2], ['eb_gem_quills', 3], ['eb_sparkle', 1], ['eb_curl_up', 1, once]]),
      drops: DROPS('i_gem_quill', 'ac_rl_thorn', 'ac_rs_thorn'),
      appear: R.T('data.rare.LIST.rm_gem_hedgehog.appear'),
      desc: R.T('data.rare.LIST.rm_gem_hedgehog.desc'),
    }),
    rm_prisma: rare({
      name: R.T('data.rare.LIST.rm_prisma.name'), sprite: 'rare_prism', size: 'm', lv: 9, race: 'construct', affinity: 'light',
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 3, atk: 0.8, mag: 1.4, def: 1.4, mdef: 1.5, agi: 1.5 },
      actions: A([['attack', 1], ['eb_prism_beam', 3], ['eb_sparkle', 2], ['eb_refract', 1, once]]),
      drops: DROPS('i_prism_shard', 'ac_rl_prism', 'ac_rs_prism'),
      appear: R.T('data.rare.LIST.rm_prisma.appear'),
      desc: R.T('data.rare.LIST.rm_prisma.desc'),
    }),
    // ------------------------------------------------------------ 地方7 灰の荒野
    rm_spa_monkey: rare({
      name: R.T('data.rare.LIST.rm_spa_monkey.name'), sprite: 'rare_monkey', size: 'm', lv: 8, race: 'beast', affinity: 'water',
      elem: { fire: 1.25, water: 0.25, earth: 1.5 },
      s: { hp: 3.2, mag: 1.1, agi: 1.5 },
      actions: A([['attack', 2], ['eb_hot_splash', 2], ['eb_towel_snap', 2], ['eb_bath_heal', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_spa_egg', 'ac_rl_beast', 'ac_rs_beast'),
      appear: R.T('data.rare.LIST.rm_spa_monkey.appear'),
      desc: R.T('data.rare.LIST.rm_spa_monkey.desc'),
    }),
    rm_volcano_turtle: rare({
      name: R.T('data.rare.LIST.rm_volcano_turtle.name'), sprite: 'rare_turtle', size: 'm', lv: 9, race: 'beast', affinity: 'fire',
      elem: { fire: 0.25, water: 1.5 },
      s: { hp: 3.4, def: 1.8, mdef: 1.3, agi: 1.1 },
      actions: A([['attack', 2], ['eb_shell_eruption', 3], ['eb_lava_bite', 1], ['eb_shell_retreat', 1, once]]),
      drops: DROPS('i_volcano_stone', 'ac_rl_ember', 'ac_rs_ember'),
      appear: R.T('data.rare.LIST.rm_volcano_turtle.appear'),
      desc: R.T('data.rare.LIST.rm_volcano_turtle.desc'),
    }),
    // ------------------------------------------------------------ 地方8 オルビス高原
    rm_moon_sheep: rare({
      name: R.T('data.rare.LIST.rm_moon_sheep.name'), sprite: 'rare_sheep', size: 'm', lv: 8, race: 'beast', affinity: 'light',
      elem: { fire: 1.25, light: 0.25, dark: 1.5 },
      s: { hp: 3.2, atk: 0.8, mag: 1.3, def: 1.3, mdef: 1.3, agi: 1.4 },
      actions: A([['attack', 1], ['eb_moonbeam', 2], ['eb_moon_lullaby', 2], ['eb_wool_puff', 1, once]]),
      drops: DROPS('i_moon_wool', 'ac_rl_dream', 'ac_rs_dream'),
      appear: R.T('data.rare.LIST.rm_moon_sheep.appear'),
      desc: R.T('data.rare.LIST.rm_moon_sheep.desc'),
    }),
    rm_clock_bird: rare({
      name: R.T('data.rare.LIST.rm_clock_bird.name'), sprite: 'rare_clockbird', size: 's', lv: 9, race: 'construct', flying: true,
      elem: { water: 1.25, wind: 1.5, earth: 0.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 2.8, def: 1.4, agi: 1.9 },
      actions: A([['attack', 2], ['eb_gear_peck', 2], ['eb_alarm', 2], ['eb_tick_tock', 1, once]]),
      drops: DROPS('i_spring_key', 'ac_rl_star', 'ac_rs_star'),
      appear: R.T('data.rare.LIST.rm_clock_bird.appear'),
      desc: R.T('data.rare.LIST.rm_clock_bird.desc'),
    }),
    // ------------------------------------------------------------ 終盤 白の大書庫（ティア 8 固定）
    rm_bookworm: rare({
      name: R.T('data.rare.LIST.rm_bookworm.name'), sprite: 'rare_bookworm', size: 's', lv: 57, race: 'insect',
      elem: { fire: 1.5 }, statusRes: { poison: 0.5 },
      s: { hp: 3, atk: 0.9, mag: 1.3, mdef: 1.3, agi: 1.5 },
      actions: A([['attack', 2], ['eb_nibble_page', 2], ['eb_spectacle_glare', 2], ['eb_study', 1, once]]),
      drops: DROPS('i_wisdom_page', 'ac_rl_sage', 'ac_sr_scholar_monocle'),
      appear: R.T('data.rare.LIST.rm_bookworm.appear'),
      desc: R.T('data.rare.LIST.rm_bookworm.desc'),
    }),
    rm_golden_quill: rare({
      name: R.T('data.rare.LIST.rm_golden_quill.name'), sprite: 'rare_quill', size: 's', lv: 58, race: 'construct', affinity: 'light', flying: true,
      elem: { water: 1.25, wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 2.8, atk: 0.8, mag: 1.4, mdef: 1.4, agi: 1.8 },
      actions: A([['attack', 1], ['eb_golden_script', 3], ['eb_ink_blot', 2], ['eb_rewrite_self', 1, { hpBelow: 0.5, once: true }]]),
      drops: DROPS('i_golden_ink', 'ac_rl_tale', 'w_staff_sr_goldquill'),
      appear: R.T('data.rare.LIST.rm_golden_quill.appear'),
      desc: R.T('data.rare.LIST.rm_golden_quill.desc'),
    }),
    // ------------------------------------------------------------ クリア後 忘却の底（ティア 9 固定）
    rm_memory_fish: rare({
      name: R.T('data.rare.LIST.rm_memory_fish.name'), sprite: 'rare_goldfish', size: 's', lv: 62, race: 'aquatic', affinity: 'water',
      elem: { fire: 0.75, water: 0.25, earth: 1.5 },
      s: { hp: 3, atk: 0.9, mag: 1.4, mdef: 1.4, agi: 1.7 },
      actions: A([['attack', 1], ['eb_memory_bubble', 2], ['eb_forget_splash', 2], ['eb_fin_heal', 1, { hpBelow: 0.6 }]]),
      drops: DROPS('i_memory_bubble', 'ac_rl_spirit', 'sh_sr_memory_bowl'),
      appear: R.T('data.rare.LIST.rm_memory_fish.appear'),
      desc: R.T('data.rare.LIST.rm_memory_fish.desc'),
    }),
    // 超レアモンスター（1/200、行動 2 回、ドロップ率が高い、閃きのランク +1）
    rm_dream_tapir: rare({
      name: R.T('data.rare.LIST.rm_dream_tapir.name'), sprite: 'rare_tapir', size: 'l', lv: 64, race: 'beast', actsPerTurn: 2, rankAdd: 1,
      elem: { fire: 1.25 },
      s: { hp: 3.6, atk: 1.1, mag: 1.4, def: 1.3, mdef: 1.4, agi: 1.4 },
      actions: A([['attack', 1], ['eb_dream_eat', 3], ['eb_sleep_mist', 2], ['eb_nightmare', 2],
        ['eb_tapir_nap', 1, { hpBelow: 0.5, once: true }]]),
      drops: DROPS('i_elixir', 'ac_rl_shadow', 'w_sword_sr_dreamcut', [2, 4, 12]),
      appear: R.T('data.rare.LIST.rm_dream_tapir.appear'),
      desc: R.T('data.rare.LIST.rm_dream_tapir.desc'),
    }),
  };
  Object.assign(R.DB.monsters, LIST);
  // port_mons.js: 盗み専用（STATS_REWORK §7.2、率は V2_PLAN §2.6.6）。倒しても落ちない（R.Mon.rollDrops は steal を見ない）
  LIST.rm_jewel_hare.drops = Object.assign({}, LIST.rm_jewel_hare.drops, { steal: { item: 'ft_st_jewel_hare', rate: 12 } });
  LIST.rm_gold_idol.drops = Object.assign({}, LIST.rm_gold_idol.drops, { steal: { item: 'hn_st_gold_idol', rate: 12 } });
  LIST.rm_ghost_teapot.drops = Object.assign({}, LIST.rm_ghost_teapot.drops, { steal: { item: 'ac_st_ghost_teapot', rate: 12 } });
  LIST.rm_star_whale.drops = Object.assign({}, LIST.rm_star_whale.drops, { steal: { item: 'bd_st_star_whale', rate: 12 } });
  LIST.rm_treasure_crab.drops = Object.assign({}, LIST.rm_treasure_crab.drops, { steal: { item: 'sh_st_treasure_crab', rate: 12 } });
  LIST.rm_prisma.drops = Object.assign({}, LIST.rm_prisma.drops, { steal: { item: 'w_staff_st_prisma', rate: 12 } });
  LIST.rm_volcano_turtle.drops = Object.assign({}, LIST.rm_volcano_turtle.drops, { steal: { item: 'sh_st_volcano_turtle', rate: 12 } });
  LIST.rm_clock_bird.drops = Object.assign({}, LIST.rm_clock_bird.drops, { steal: { item: 'ft_st_clock_bird', rate: 12 } });
  LIST.rm_bookworm.drops = Object.assign({}, LIST.rm_bookworm.drops, { steal: { item: 'sh_st_bookworm', rate: 12 } });
  LIST.rm_dream_tapir.drops = Object.assign({}, LIST.rm_dream_tapir.drops, { steal: { item: 'ac_st_dream_tapir', rate: 12 } });
})(window.RPG);
