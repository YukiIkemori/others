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
      name: '宝石ウサギ', sprite: 'rare_hare', size: 'm', lv: 5, race: 'beast',
      elem: { fire: 1.25 },
      s: { hp: 3, atk: 0.9, def: 1.3, mdef: 1.3, agi: 1.8 },
      actions: A([['attack', 3], ['eb_hare_kick', 2], ['eb_jewel_shine', 2], ['eb_hop_rest', 1, { hpBelow: 0.5, once: true }]]),
      drops: DROPS('i_jewel_carrot', 'ac_rl_bird', 'ac_rs_bird'),
      appear: '額のサファイアが、きらりと光った！',
      desc: '額にサファイアを光らせる金色の\nウサギ。すぐに跳ねて逃げる。',
    }),
    // ------------------------------------------------------------ 地方1 ヴェルダの森
    rm_bloom_fawn: rare({
      name: '花角の小鹿', sprite: 'rare_fawn', size: 'm', lv: 8, race: 'beast', affinity: 'light',
      elem: { fire: 1.25, light: 0.25, dark: 1.5 },
      s: { hp: 3, atk: 0.9, mag: 1.2, mdef: 1.3, agi: 1.6 },
      actions: A([['attack', 2], ['eb_antler_thrust', 2], ['eb_petal_storm', 2], ['eb_fawn_bloom', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_bloom_nectar', 'ac_rl_bloom', 'ac_rs_bloom'),
      appear: 'どこからか、花の香りがただよってきた。',
      desc: '角に花を咲かせた子鹿。\n森の主の使いだという。',
    }),
    rm_glass_moth: rare({
      name: 'ガラスアゲハ', sprite: 'rare_glassmoth', size: 'm', lv: 9, race: 'insect', flying: true,
      elem: { fire: 1.5, wind: 1.5, earth: 0.5 }, statusRes: { poison: 0.5 },
      s: { hp: 2.8, atk: 0.8, mag: 1.3, mdef: 1.2, agi: 1.8 },
      actions: A([['attack', 1], ['eb_glass_scale', 2], ['eb_prism_wing', 3], ['eb_flutter', 1, once]]),
      drops: DROPS('i_glass_dust', 'ac_rl_wind', 'ac_rs_wind'),
      appear: '光のかけらが、ひらひらと舞い落ちた。',
      desc: '羽がステンドグラスのように\n光るチョウ。森の奥で舞っている。',
    }),
    rm_acorn_prince: rare({
      name: 'どんぐり王子', sprite: 'rare_acorn', size: 's', lv: 9, race: 'plant',
      elem: { fire: 1.5, water: 0.5, earth: 0.75 }, phys: { slash: 1.25 }, statusRes: { sleep: 0.5, poison: 0.5 },
      s: { hp: 3.2, def: 1.5, agi: 1.4 },
      actions: A([['attack', 2], ['eb_acorn_barrage', 3], ['eb_shell_guard', 1, once]]),
      drops: DROPS('i_golden_acorn', 'ac_rl_peak', 'ac_rs_peak'),
      appear: 'どんぐりが、ころころと転がってきた。',
      desc: '千年樹の根もとで生まれた\nどんぐりの王子さま。',
    }),
    // ------------------------------------------------------------ 地方2 ザハラ砂漠
    rm_diamond_lizard: rare({
      name: '金剛トカゲ', sprite: 'rare_lizard', size: 'm', lv: 8, race: 'beast', affinity: 'earth',
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 },
      s: { hp: 3, def: 1.8, mdef: 1.2, agi: 1.5 },
      actions: A([['attack', 3], ['eb_tail_whip', 2], ['eb_jewel_shine', 2], ['eb_diamond_scales', 1, once]]),
      drops: DROPS('i_diamond_dust', 'ac_rl_iron', 'ac_rs_iron'),
      appear: '岩かげで、うろこが虹色にきらめいた！',
      desc: '背中に金剛石のうろこが並ぶ\nトカゲ。砂漠の岩場にひそむ。',
    }),
    rm_gold_idol: rare({
      name: '黄金の守護像', sprite: 'rare_idol', size: 'm', lv: 9, race: 'construct', affinity: 'light',
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 3.2, atk: 0.9, mag: 1.3, def: 1.5, mdef: 1.5, agi: 1.3 },
      actions: A([['attack', 1], ['eb_idol_ray', 3], ['eb_idol_curse', 2], ['eb_idol_ward', 1, once]]),
      drops: DROPS('i_gold_bar', 'ac_rl_gold', 'ac_rs_gold'),
      appear: '金色の光が、王墓の闇を照らした！',
      desc: '王墓の奥で宙に浮かぶ黄金の像。\n墓の宝を守り続けている。',
    }),
    // ------------------------------------------------------------ 地方3 ノルデン雪原
    rm_aurora_bird: rare({
      name: 'オーロラ鳥', sprite: 'rare_bird', size: 'm', lv: 8, race: 'bird', affinity: 'light', flying: true,
      elem: { wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: { pierce: 1.25 },
      s: { hp: 2.8, atk: 0.9, mag: 1.3, mdef: 1.3, agi: 1.8 },
      actions: A([['attack', 1], ['eb_aurora_ray', 3], ['e_gust', 2], ['eb_aurora_veil', 1, once]]),
      drops: DROPS('i_aurora_feather', 'ac_rl_moon', 'ac_rs_moon'),
      appear: '夜空が、オーロラの色に染まった……！',
      desc: '吹雪がやんだ夜にだけ飛ぶ、\nオーロラ色の翼の鳥。',
    }),
    rm_icetail_fox: rare({
      name: '氷尾ギツネ', sprite: 'rare_icefox', size: 'm', lv: 9, race: 'beast', affinity: 'water',
      elem: { fire: 1.25, water: 0.25, earth: 1.5 },
      s: { hp: 3, mag: 1.2, agi: 1.8 },
      actions: A([['attack', 2], ['eb_ice_foxfire', 2], ['eb_nine_tails', 2], ['eb_fox_trick', 1]]),
      drops: DROPS('i_fox_icicle', 'ac_rl_frost', 'ac_rs_frost'),
      appear: '青いきつね火が、ふたつ浮かんだ。',
      desc: '五本の氷の尾をもつキツネ。\n旅人を化かして遊ぶ。',
    }),
    // ------------------------------------------------------------ 地方4 グレイモア湿原
    rm_lotus_sprite: rare({
      name: 'はすの精', sprite: 'rare_lotus', size: 's', lv: 8, race: 'fairy', affinity: 'water',
      elem: { water: 0.25, earth: 1.5, light: 0.5, dark: 1.5 }, statusRes: { confuse: 0.5 },
      s: { hp: 3, atk: 0.8, mag: 1.3, mdef: 1.3, agi: 1.6 },
      actions: A([['attack', 1], ['e_water_bolt', 2], ['eb_lotus_bubble', 2], ['eb_lotus_dew', 1, { hpBelow: 0.6 }]]),
      drops: DROPS('i_lotus_dew', 'ac_rl_sun', 'ac_rs_sun'),
      appear: '霧の中で、はすの花がそっと開いた。',
      desc: '湿原のはすの花に住む精。\n霧の朝にだけ顔を出す。',
    }),
    rm_ghost_teapot: rare({
      name: 'おばけ茶器', sprite: 'rare_teapot', size: 's', lv: 9, race: 'construct',
      elem: { water: 1.25, wind: 0.75 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 3, atk: 0.9, mag: 1.3, def: 1.3, agi: 1.5 },
      actions: A([['attack', 1], ['eb_hot_tea', 3], ['eb_steam_puff', 2], ['eb_tea_party', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_ghost_tea', 'ac_rl_tide', 'ac_rs_tide'),
      appear: 'どこからか、紅茶の香りがしてきた。',
      desc: '館で一人お茶会を続ける茶器。\n誰かを待っているらしい。',
    }),
    rm_bell_snail: rare({
      name: '鐘カタツムリ', sprite: 'rare_bellsnail', size: 'm', lv: 9, race: 'aquatic',
      elem: { fire: 0.75, water: 0.5, earth: 1.25 },
      s: { hp: 3.4, atk: 0.9, def: 1.6, mdef: 1.4, agi: 1.2 },
      actions: A([['attack', 2], ['eb_bell_toll', 2], ['eb_slime_trail', 2], ['eb_shell_retreat', 1, once]]),
      drops: DROPS('i_snail_bell', 'ac_rl_bell', 'ac_rs_bell'),
      appear: '沼の底から、かすかに鐘の音がした。',
      desc: '鐘を背負ったカタツムリ。\n沈んだ鐘の一つだといううわさも。',
    }),
    // ------------------------------------------------------------ 地方5 マレア諸島
    rm_star_whale: rare({
      name: '星くじら', sprite: 'rare_whale', size: 'l', lv: 8, race: 'aquatic', affinity: 'light', flying: true,
      elem: { fire: 0.75, water: 0.5, wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 },
      s: { hp: 2.8, atk: 0.9, mag: 1.3, mdef: 1.3, agi: 1.3 },
      actions: A([['attack', 1], ['eb_stardust_spout', 3], ['eb_whale_song', 2], ['eb_star_tide', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_stardust', 'ac_rl_sea', 'ac_rs_sea'),
      appear: '波の上に、星くずの潮が吹き上がった！',
      desc: '夜の海の上を泳ぐ小さな空の\nくじら。背中に星がまたたく。',
    }),
    rm_treasure_crab: rare({
      name: '財宝ヤドカリ', sprite: 'rare_hermit', size: 'm', lv: 9, race: 'aquatic',
      elem: { fire: 0.75, water: 0.5, earth: 1.25 },
      s: { hp: 3.2, def: 1.7, agi: 1.3 },
      actions: A([['attack', 2], ['eb_coin_toss', 2], ['eb_greed_claw', 2], ['eb_goblet_guard', 1, once]]),
      drops: DROPS('i_gold_coins', 'ac_rl_clover', 'ac_rs_clover'),
      appear: '船底で、金貨がじゃらりと鳴った。',
      desc: '沈没船の宝の杯を背負った\nヤドカリ。金貨を投げてくる。',
    }),
    // ------------------------------------------------------------ 地方6 ガルド山地
    rm_gem_hedgehog: rare({
      name: '宝石ハリネズミ', sprite: 'rare_hedgehog', size: 's', lv: 8, race: 'beast', affinity: 'earth',
      elem: { fire: 1.25, wind: 1.5, earth: 0.25 },
      s: { hp: 3, def: 1.6, agi: 1.6 },
      actions: A([['attack', 2], ['eb_gem_quills', 3], ['eb_sparkle', 1], ['eb_curl_up', 1, once]]),
      drops: DROPS('i_gem_quill', 'ac_rl_thorn', 'ac_rs_thorn'),
      appear: '岩のすき間で、宝石の針がきらめいた！',
      desc: '背中の針が宝石のハリネズミ。\n鉱夫たちのあこがれ。',
    }),
    rm_prisma: rare({
      name: 'プリズマ', sprite: 'rare_prism', size: 'm', lv: 9, race: 'construct', affinity: 'light',
      elem: { water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 3, atk: 0.8, mag: 1.4, def: 1.4, mdef: 1.5, agi: 1.5 },
      actions: A([['attack', 1], ['eb_prism_beam', 3], ['eb_sparkle', 2], ['eb_refract', 1, once]]),
      drops: DROPS('i_prism_shard', 'ac_rl_prism', 'ac_rs_prism'),
      appear: '坑道の壁に、七色の光があふれた！',
      desc: '坑道の奥で生まれた生きた結晶。\n光を七色に割って放つ。',
    }),
    // ------------------------------------------------------------ 地方7 灰の荒野
    rm_spa_monkey: rare({
      name: '湯けむり猿', sprite: 'rare_monkey', size: 'm', lv: 8, race: 'beast', affinity: 'water',
      elem: { fire: 1.25, water: 0.25, earth: 1.5 },
      s: { hp: 3.2, mag: 1.1, agi: 1.5 },
      actions: A([['attack', 2], ['eb_hot_splash', 2], ['eb_towel_snap', 2], ['eb_bath_heal', 1, { hpBelow: 0.6, once: true }]]),
      drops: DROPS('i_spa_egg', 'ac_rl_beast', 'ac_rs_beast'),
      appear: 'もうもうと、湯けむりが立ちこめた。',
      desc: 'カルデラの温泉が大好きな猿。\n湯おけごと現れる。',
    }),
    rm_volcano_turtle: rare({
      name: '火山ガメ', sprite: 'rare_turtle', size: 'm', lv: 9, race: 'beast', affinity: 'fire',
      elem: { fire: 0.25, water: 1.5 },
      s: { hp: 3.4, def: 1.8, mdef: 1.3, agi: 1.1 },
      actions: A([['attack', 2], ['eb_shell_eruption', 3], ['eb_lava_bite', 1], ['eb_shell_retreat', 1, once]]),
      drops: DROPS('i_volcano_stone', 'ac_rl_ember', 'ac_rs_ember'),
      appear: '地面が揺れて、小さな火山が現れた！',
      desc: '背中の火山で卵を温めるカメ。\n百年に一度しか姿を見せない。',
    }),
    // ------------------------------------------------------------ 地方8 オルビス高原
    rm_moon_sheep: rare({
      name: '月見ヒツジ', sprite: 'rare_sheep', size: 'm', lv: 8, race: 'beast', affinity: 'light',
      elem: { fire: 1.25, light: 0.25, dark: 1.5 },
      s: { hp: 3.2, atk: 0.8, mag: 1.3, def: 1.3, mdef: 1.3, agi: 1.4 },
      actions: A([['attack', 1], ['eb_moonbeam', 2], ['eb_moon_lullaby', 2], ['eb_wool_puff', 1, once]]),
      drops: DROPS('i_moon_wool', 'ac_rl_dream', 'ac_rs_dream'),
      appear: '月明かりの中を、毛玉がただよってきた。',
      desc: '月の夜に高原をただよう羊。\n毛の中に星をためている。',
    }),
    rm_clock_bird: rare({
      name: 'ぜんまい鳥', sprite: 'rare_clockbird', size: 's', lv: 9, race: 'construct', flying: true,
      elem: { water: 1.25, wind: 1.5, earth: 0.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 2.8, def: 1.4, agi: 1.9 },
      actions: A([['attack', 2], ['eb_gear_peck', 2], ['eb_alarm', 2], ['eb_tick_tock', 1, once]]),
      drops: DROPS('i_spring_key', 'ac_rl_star', 'ac_rs_star'),
      appear: 'チクタク、チクタク……。歯車の音がする。',
      desc: '賢者カペラが作ったといわれる\nからくりの小鳥。',
    }),
    // ------------------------------------------------------------ 終盤 白の大書庫（ティア 8 固定）
    rm_bookworm: rare({
      name: '本の虫', sprite: 'rare_bookworm', size: 's', lv: 57, race: 'insect',
      elem: { fire: 1.5 }, statusRes: { poison: 0.5 },
      s: { hp: 3, atk: 0.9, mag: 1.3, mdef: 1.3, agi: 1.5 },
      actions: A([['attack', 2], ['eb_nibble_page', 2], ['eb_spectacle_glare', 2], ['eb_study', 1, once]]),
      drops: DROPS('i_wisdom_page', 'ac_rl_sage', 'ac_sr_scholar_monocle'),
      appear: '書架の奥で、紙をかじる音がする……。',
      desc: '大書庫の本を食べて育った虫。\n物知りだが、眼鏡が手放せない。',
    }),
    rm_golden_quill: rare({
      name: '黄金の羽ペン', sprite: 'rare_quill', size: 's', lv: 58, race: 'construct', affinity: 'light', flying: true,
      elem: { water: 1.25, wind: 1.5, earth: 0.5, light: 0.25, dark: 1.5 }, phys: CONSTRUCT_PHYS, statusRes: CONSTRUCT_RES,
      s: { hp: 2.8, atk: 0.8, mag: 1.4, mdef: 1.4, agi: 1.8 },
      actions: A([['attack', 1], ['eb_golden_script', 3], ['eb_ink_blot', 2], ['eb_rewrite_self', 1, { hpBelow: 0.5, once: true }]]),
      drops: DROPS('i_golden_ink', 'ac_rl_tale', 'w_staff_sr_goldquill'),
      appear: '宙に、金色の文字がひとりでに浮かんだ！',
      desc: '最初の語り部が使ったという\n伝説の羽ペン。ひとりでに書く。',
    }),
    // ------------------------------------------------------------ クリア後 忘却の底（ティア 9 固定）
    rm_memory_fish: rare({
      name: '記憶の金魚', sprite: 'rare_goldfish', size: 's', lv: 62, race: 'aquatic', affinity: 'water',
      elem: { fire: 0.75, water: 0.25, earth: 1.5 },
      s: { hp: 3, atk: 0.9, mag: 1.4, mdef: 1.4, agi: 1.7 },
      actions: A([['attack', 1], ['eb_memory_bubble', 2], ['eb_forget_splash', 2], ['eb_fin_heal', 1, { hpBelow: 0.6 }]]),
      drops: DROPS('i_memory_bubble', 'ac_rl_spirit', 'sh_sr_memory_bowl'),
      appear: '泡の中に、なつかしい景色がうつった。',
      desc: '忘れられた思い出を泡に\nとじこめて泳ぐ金魚。',
    }),
    // 超レアモンスター（1/200、行動 2 回、ドロップ率が高い、閃きのランク +1）
    rm_dream_tapir: rare({
      name: '夢食いバク', sprite: 'rare_tapir', size: 'l', lv: 64, race: 'beast', actsPerTurn: 2, rankAdd: 1,
      elem: { fire: 1.25 },
      s: { hp: 3.6, atk: 1.1, mag: 1.4, def: 1.3, mdef: 1.4, agi: 1.4 },
      actions: A([['attack', 1], ['eb_dream_eat', 3], ['eb_sleep_mist', 2], ['eb_nightmare', 2],
        ['eb_tapir_nap', 1, { hpBelow: 0.5, once: true }]]),
      drops: DROPS('i_dream_fruit', 'ac_rl_shadow', 'w_katana_sr_dreamcut', [2, 4, 12]),
      appear: '七色の夢の泡が、ふわりと浮かんだ……。',
      desc: '忘却の底で、忘れられた夢を\n食べて生きるという幻の獣。',
    }),
  };
  Object.assign(R.DB.monsters, LIST);
})(window.RPG);
