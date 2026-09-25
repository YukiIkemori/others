// Post-game (クリア後のやりこみ): 「深淵の迷宮」 abyss_1..4 and its master アビスロード.
// Unlocked by the flag 'game_clear' (maps/events: another owner). This file holds only data:
//   items      pg_*            strongest-class gear (abyss chests, rare drops, the boss rewards)
//   abilities  en_pg_*         the abyss monsters' and the superboss's actions
//   monsters   pg_* (13), rare_prism (dedicated rare monster), abyss_lord (superboss)
//   encounters d_abyss1..4 (Lv45–60) · rareEncounters rare_prism 1.5 % · troop boss_abyss
//   objectives obj_postgame, obj_abyss_clear
// Everything is a normal R.DB entry, so the bestiary (ずかん) lists and counts it.
//
// Balance — tools/sim_postgame.js (real battle engine; see its header for the party models):
//   abyss regulars: a prepared Lv50 party wins every fight and loses ≈25 % HP per fight
//     (23–28 % by floor; the healer tops up at 40 %); a party fresh from the demon king
//     (Lv42, shop gear) wins ≈90 % of the fights on floors 1–2.
//   abyss_lord: prepared Lv55 (mastered jobs, abyss/rare gear, 明鏡の護符, かいじゅ,
//     ふくつのちかい) wins ≈65–70 % in ≈23 rounds (Lv52 ≈40 %, Lv58 ≈87 %); a Lv65
//     "levels only" party wins 0 % (still 0 % at Lv99, and at Lv80 with the amulets).
//     Taking away one piece of the preparation: no status immunity 0 %, only two members
//     immune ≈37 %, no revive-on-KO ≈49 %, never dispelling ≈52 % (32 rounds), no elemental
//     resistance ≈46 %, shop weapons ≈48 %. 魔王 (boss_king2) is beaten 100 % by the same parties.
//
// abyss_lord's pattern (actsPerTurn 3; `every` counts its own actions, 3 per round):
//   round 1, 4, 7 …  混沌の瞳      mass confusion 75 %      → confusion immunity
//   round 2, 5, 8 …  滅びの宣告    certain death on one     → death immunity / revive-on-KO
//                    始原の鱗      def & mdef +2 (3rd act)  → dispel (かいじゅ) or break skills
//   round 3, 6, 9 …  虚無の波動 → 終焉の咆哮   party buffs erased, then a heavy blast
//   phase 1 (HP > 50 %): its 3rd action is 様子をうかがう → 2 real actions a round
//   phase 2 (HP ≤ 50 %): 3 real actions a round, 虚無の吐息 joins the elemental breaths
//   phase 3 (HP < 25 %): 混沌の再生 once (heals 12 %)
//   free actions: claw, tail sweep, fire / ice breaths (fixed damage only elemResist reduces),
//   mass sleep, mass paralysis. It absorbs dark, halves fire / ice / thunder and is a dragon
//   (竜騎士 skills ×1.5).
(function (R) {
  'use strict';

  // ------------------------------------------------------------ curve (= monsters.js)
  // inlined: data files never depend on each other
  const expFor = (L) => (L <= 1 ? 0 : 8 * Math.pow(L - 1, 2.6) + 10 * (L - 1));
  const late = (L) => { const t = Math.min(1, Math.max(0, (L - 16) / 14)); return t * t * (3 - 2 * t); };
  const curve = (L) => ({
    hp: (7 + 5 * L + 0.28 * L * L) * (1 + 0.15 * late(L)),
    atk: (10 + 3.8 * L) * (1 + 0.12 * late(L)),
    def: 1 + 2.1 * L,
    mdef: L,
    agi: 4 + 1.8 * L,
    mag: 5 + 2.4 * L,
    // monsters.js' reward factor is frozen at Lv45 (it would explode past the main game)
    exp: ((expFor(L + 2.5) - expFor(L + 1.5)) / 14.4) * Math.exp(0.1 - 2 * (Math.min(L, 45) / 40) + 1.8 * Math.pow(Math.min(L, 45) / 40, 2)),
    jp: 5 + 1.15 * L,
    gold: 6 + 8 * L + 0.3 * L * L,
  });
  const SIZE = { eyeball: 's', mimic: 's', jelly: 's', golem: 'l', wyvern: 'l', chimera: 'l', demon: 'l', chaos_beast: 'l' };
  const SZ = {
    s: { hp: 0.72, atk: 0.9, def: 0.9, rw: 0.75, jp: 0.9 },
    m: { hp: 1, atk: 1, def: 1, rw: 1, jp: 1 },
    l: { hp: 2, atk: 1.15, def: 1.1, rw: 1.8, jp: 1.6 },
  };
  const nice = (n) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

  /**
   * name, sprite, lv, o: s:{hp,atk,def,mdef,agi,mag} multipliers · x:{exp,gold,jp} reward multipliers ·
   * a:[[id, w, cond?]] · drop/rare:[item, rate] · steal:[item, rare] · everything else copied.
   */
  function pgMon(name, sprite, lv, o) {
    const c = curve(lv), sz = SZ[o.size || SIZE[sprite] || 'm'], s = o.s || {}, x = o.x || {};
    const k = (key) => (s[key] != null ? s[key] : 1);
    const d = {
      name, sprite, lv,
      hp: Math.round(c.hp * sz.hp * k('hp')),
      mp: o.mp || 0,
      atk: Math.round(c.atk * sz.atk * k('atk')),
      def: Math.round(c.def * sz.def * k('def')),
      agi: Math.round(c.agi * k('agi')),
      mag: Math.round(c.mag * k('mag')),
      mdef: Math.round(c.mdef * k('mdef')),
      exp: nice(c.exp * sz.rw * (x.exp || 1)),
      gold: nice(c.gold * sz.rw * (x.gold || 1)),
      jp: Math.round(c.jp * sz.jp * (x.jp || 1)),
      actions: o.a.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w })),
    };
    for (const key of ['hue', 'sat', 'bri', 'eva', 'elem', 'statusRes', 'flags', 'fleeRate', 'attackFx', 'actsPerTurn', 'appear', 'desc']) {
      if (o[key] != null) d[key] = o[key];
    }
    d.drop = { item: o.drop[0], rate: o.drop[1] };
    d.rare = { item: o.rare[0], rate: o.rare[1] };
    if (o.steal) d.steal = o.steal[1] ? { item: o.steal[0], rare: o.steal[1] } : { item: o.steal[0] };
    return d;
  }

  // ------------------------------------------------------------------ items
  // rare:true → never sold, shown with ★; price 0 = cannot be sold. band 6 (the top band of the item tools)
  // + postgame:true. `exclusive` names the single source of each item (a monster's rare drop, the abyss
  // chests, or the reward for beating abyss_lord), which keeps them out of the shared R.ITEM_RARE pools.
  const ALL_ELEM = (v) => ({ fire: v, ice: v, thunder: v, wind: v, earth: v, water: v, holy: v, dark: v });
  const ALL_STATUS = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death'];
  const PG = { rare: true, price: 0, band: 6, postgame: true };
  const W = (name, wtype, atk, desc, o) => Object.assign({ name, type: 'weapon', wtype, atk, desc }, PG, o);
  const HEAD = { helm: 'head', hat: 'head', heavy: 'body', light: 'body', robe: 'body', shield: 'shield' };
  const A = (name, atype, def, desc, o) => Object.assign({ name, type: HEAD[atype], atype, def, desc }, PG, o);
  const X = (name, desc, o) => Object.assign({ name, type: 'acc', desc }, PG, o);

  const items = {
    // weapons — the chests of the abyss and its monsters' rare drops
    pg_chaos_sword:   W('混沌の剣',   'sword',  124, '深淵の底で眠っていた漆黒の剣。\n刃の奥で七色の光が渦を巻く。', { stats: { str: 8, agi: 4 } , exclusive: 'abyss_chest' }),
    pg_dragon_lance:  W('竜神の槍',   'spear',  126, '古の竜神のひげを穂先に鍛えた槍。', { stats: { str: 6, agi: 6 } , exclusive: 'abyss_chest' }),
    pg_void_katana:   W('虚空の太刀', 'katana', 128, '空間ごと断ち切るという妖刀。\n会心の一撃が出やすい。', { stats: { agi: 8 }, mods: { crit: 10 } , exclusive: 'pg_chaos_chimera' }),
    pg_ruin_axe:      W('崩界の斧',   'axe',    140, '世界の果てを砕いたと伝わる大斧。', { hit: -5, stats: { str: 10 } , exclusive: 'pg_chaos_beast' }),
    pg_star_dagger:   W('星霜の短剣', 'knife',   90, '幾千の星霜を経て輝く短剣。\n素早さと運が大きく上がる。', { hit: 10, stats: { agi: 16, luk: 10 }, mods: { crit: 6 } , exclusive: 'pg_doom_box' }),
    pg_nova_claw:     W('新星の爪',   'claw',   108, '生まれたての星のように燃える爪。', { element: 'fire', stats: { str: 8, agi: 10 } , exclusive: 'pg_hell_hound' }),
    pg_heaven_bow:    W('天穹の弓',   'bow',    120, '天の弧をかたどった大弓。\n放った矢は決して外れない。', { twoHanded: true, hit: 15, mods: { crit: 6 } , exclusive: 'pg_void_dragon' }),
    pg_origin_rod:    W('始原のロッド', 'rod',   28, '世界の始まりの光を封じたロッド。\n魔法の威力が大きく上がる。', { mag: 64, stats: { int: 10 }, mods: { magicPct: 15 } , exclusive: 'abyss_chest' }),
    pg_aurora_staff:  W('極光の杖',   'staff',   44, 'オーロラの光を宿す杖。\n回復の力が大きく増す。', { mag: 32, stats: { mnd: 30 }, mods: { healPct: 20 } , exclusive: 'abyss_chest' }),
    pg_genesis_harp:  W('創世の竪琴', 'harp',    72, '世界が生まれた日の調べを奏でる。\n聴いた者を惑わせる。', { stats: { mnd: 16, int: 12 }, onHit: { status: 'confuse', chance: 0.2 } , exclusive: 'pg_arch_demon' }),

    // armor
    pg_abyss_mail:    A('深淵の鎧',   'heavy',  90, '深淵の闇を鍛えて固めた鎧。\n闇・炎・氷に強い。', { mdef: 20, stats: { vit: 8 }, mods: { elemResist: { dark: 0.5, fire: 0.75, ice: 0.75 } } , exclusive: 'abyss_chest' }),
    pg_starlight_garb: A('星光の衣',  'light',  68, '星の光を織り込んだ軽い衣。\n氷と雷に強い。', { mdef: 18, eva: 8, stats: { agi: 14 }, mods: { elemResist: { ice: 0.5, thunder: 0.5 } } , exclusive: 'pg_aurora_harpy' }),
    pg_aurora_robe:   A('極光のローブ', 'robe', 56, 'オーロラの糸で縫ったローブ。\n沈黙を防ぎ、炎・氷・雷を和らげる。', { mdef: 46, stats: { int: 12, mnd: 12 }, mods: { statusImmune: ['silence'], elemResist: { fire: 0.75, ice: 0.75, thunder: 0.75 } } , exclusive: 'abyss_chest' }),
    pg_chaos_helm:    A('混沌の兜',   'helm',   44, '混沌の力を封じた兜。\n眠りと麻痺を防ぐ。', { mdef: 14, mods: { statusImmune: ['sleep', 'paralyze'] } , exclusive: 'pg_abyss_knight' }),
    pg_halo:          A('天輪の冠',   'hat',    32, '天使の輪をかたどった冠。\n眠りと混乱を防ぐ。', { mdef: 26, stats: { int: 10, mnd: 10 }, mods: { statusImmune: ['sleep', 'confuse'] } , exclusive: 'pg_prism_eye' }),
    pg_void_shield:   A('虚空の盾',   'shield', 48, '虚空を映す盾。\n炎・氷・雷・闇の力を和らげる。', { eva: 12, mdef: 16, mods: { elemResist: { fire: 0.6, ice: 0.6, thunder: 0.6, dark: 0.6 } } , exclusive: 'abyss_chest' }),

    // accessories — the preparation the superboss asks for
    pg_clarity_amulet: X('明鏡の護符', '心を曇りなき鏡のように保つ護符。\n眠り・麻痺・混乱を受けつけない。', { mods: { statusImmune: ['sleep', 'paralyze', 'confuse'] } , exclusive: 'abyss_chest' }),
    pg_soul_bell:     X('魂鎮めの鈴', '魂を体につなぎとめる澄んだ鈴。\n即死・毒・暗闇を防ぎ、最大HPが増える。', { mods: { statusImmune: ['death', 'poison', 'blind'], hpPct: 10 } , exclusive: 'pg_void_wraith' }),
    pg_prism_ring:    X('虹晶の指輪', 'プリズマの結晶から削り出した指輪。\nあらゆる属性の攻撃を半分にする。', { stats: { luk: 10 }, mods: { elemResist: ALL_ELEM(0.5) }, exclusive: 'rare_prism' }),

    // rewards for defeating abyss_lord (given by the boss event)
    pg_genesis_sword: W('開闢の剣',   'sword',  160, '天地が分かれた時に生まれたという剣。\n深淵の主を討った者だけが手にできる。', { element: 'holy', stats: { str: 15, vit: 10, agi: 10 }, mods: { crit: 8 } , exclusive: 'abyss_lord' }),
    pg_abyss_crest:   X('深淵の紋章', '深淵を越えた証。すべての能力が上がり、\nあらゆる状態異常を防ぎ、属性も和らげる。', {
      stats: { str: 12, vit: 12, agi: 12, int: 12, mnd: 12, luk: 12 }, mods: { hpPct: 15, mpPct: 15, statusImmune: ALL_STATUS, elemResist: ALL_ELEM(0.75) },
      exclusive: 'abyss_lord',
    }),
  };
  let sort = 1100;
  for (const id in items) items[id].sort = sort++;
  Object.assign(R.DB.items, items);

  // ------------------------------------------------------------ abilities
  const phys = (power, o) => Object.assign({ type: 'damage', formula: 'phys', power }, o);
  const magic = (power, scale, element, o) => Object.assign({ type: 'damage', formula: 'magic', power, scale }, element ? { element } : {}, o);
  const breath = (power, element) => Object.assign({ type: 'damage', formula: 'breath', power }, element ? { element } : {});
  const status = (s, chance) => ({ type: 'status', status: s, chance });
  const buff = (stat, stages, chance) => Object.assign({ type: 'buff', stat, stages }, chance != null ? { chance } : {});
  const act = (name, target, effects, fx, msg, o) => Object.assign({ name, kind: 'action', target, effects, fx, msg }, o);

  Object.assign(R.DB.abilities, {
    // ---- abyss regulars
    en_pg_hellfire_fang: act('獄炎の牙', 'enemy', [phys(1.6, { element: 'fire' })], 'fire', '{user}は燃え盛る牙で噛みついた！'),
    en_pg_howl:        act('冥府の遠吠え', 'enemies', [breath(45, 'fire'), buff('def', -1, 0.3)], 'fire2', '{user}は冥府の炎が混じった遠吠えを上げた！'),
    en_pg_madness_gaze: act('狂気の眼光', 'enemies', [status('confuse', 0.3)], 'confuse', '{user}の目が七色に妖しく光った！'),
    en_pg_prism_beam:  act('虹色の光線', 'enemy', [magic(90, 1.0)], 'holy2', '{user}は虹色の光線を放った！'),
    en_pg_soul_drain:  act('魂吸い', 'enemy', [magic(90, 1.0, 'dark', { drain: 0.5 })], 'drain', '{user}は魂を吸い取ろうとした！'),
    en_pg_lament:      act('静寂の嘆き', 'enemies', [status('silence', 0.4)], 'silence', '{user}は悲しげな声で嘆いた！'),
    en_pg_death_touch: act('死者の手招き', 'enemy', [status('death', 0.2)], 'death', '{user}は冷たい手で手招きした！'),
    en_pg_abyss_slash: act('深淵斬り', 'enemy', [phys(1.9, { element: 'dark' })], 'dark2', '{user}は闇をまとった剣で斬りつけた！'),
    en_pg_guard:       act('鉄壁の構え', 'self', [buff('def', 2)], 'buff', '{user}は盾を構えて身を固めた！'),
    en_pg_rampage:     act('混沌の暴走', 'random', [phys(0.75, { hits: [3, 5] })], 'strike3', '{user}は手当たり次第に暴れ回った！'),
    en_pg_chaos_roar:  act('混沌の雄叫び', 'enemies', [buff('atk', -1, 0.5), buff('mag', -1, 0.5)], 'debuff', '{user}は耳をつんざく雄叫びを上げた！'),
    en_pg_star_crush:  act('星砕き', 'enemy', [phys(2.2, { acc: 0.85 })], 'strike3', '{user}は巨大な拳を振り下ろした！'),
    en_pg_meteor_quake: act('隕鉄の地鳴り', 'enemies', [magic(60, 0.5, 'earth')], 'earth3', '{user}は大地を激しく踏み鳴らした！'),
    en_pg_chaos_flare: act('カオスフレア', 'enemies', [magic(60, 0.6)], 'explosion2', '{user}は混沌の炎を解き放った！', { mp: 16, magic: true }),
    en_pg_abyss_ice:   act('深淵の吹雪', 'enemies', [magic(50, 0.6, 'ice')], 'ice3', '{user}は凍てつく吹雪を呼んだ！', { mp: 14, magic: true }),
    en_pg_sleep_mist:  act('眠りの霧', 'group', [status('sleep', 0.45)], 'sleep', '{user}は甘い香りの霧を放った！', { mp: 4, magic: true }),
    en_pg_dispel:      act('打ち消しの波動', 'enemies', [{ type: 'dispel' }], 'dispel', '{user}はすべてを打ち消す波動を放った！', { mp: 6, magic: true }),
    en_pg_aurora_song: act('極光の歌', 'enemies', [status('sleep', 0.3)], 'song', '{user}はオーロラのように揺らめく歌を歌った！'),
    en_pg_gale:        act('極光の竜巻', 'enemies', [magic(50, 0.55, 'wind')], 'wind3', '{user}は七色の竜巻を巻き起こした！'),
    en_pg_void_breath: act('虚無の息', 'enemies', [breath(140, 'dark')], 'breath_dark', '{user}は虚無の息を吐き出した！'),
    en_pg_frost_breath: act('凍てつく息吹', 'enemies', [breath(140, 'ice')], 'breath_ice', '{user}は凍てつく息吹を吐き出した！'),
    en_pg_flame_breath: act('獄炎の息', 'enemies', [breath(140, 'fire')], 'breath_fire', '{user}は獄炎の息を吐き出した！'),
    en_pg_doom_bite:   act('死神の牙', 'enemy', [phys(1.0), status('death', 0.2)], 'bite', '{user}は死神のような牙で噛みついた！'),
    en_pg_greed:       act('むさぼる', 'enemy', [phys(1.4, { drain: 0.5 })], 'bite', '{user}は大きな口でむさぼり食おうとした！'),
    en_pg_dark_nova:   act('暗黒新星', 'enemies', [magic(70, 0.6, 'dark')], 'dark3', '{user}は暗黒の星を炸裂させた！', { mp: 18, magic: true }),
    en_pg_demon_claw:  act('魔将の爪', 'enemy', [phys(1.1, { hits: 2, element: 'dark' })], 'claw', '{user}は鋭い爪で二度切り裂いた！'),
    en_pg_stone_gaze:  act('石の眼差し', 'enemies', [status('paralyze', 0.3)], 'paralyze', '{user}は石のように冷たい目でにらんだ！'),
    en_pg_dive:        act('急降下', 'enemy', [phys(1.7, { acc: 0.9 })], 'claw', '{user}は急降下して襲いかかった！'),

    // ---- rare_prism
    en_pg_prism_flash: act('プリズムフラッシュ', 'enemies', [magic(40, 0.4), status('blind', 0.3)], 'holy2', '{user}の体がまばゆい虹色に輝いた！'),
    en_pg_refract:     act('乱反射', 'self', [buff('def', 2), buff('mdef', 2)], 'buff', '{user}の結晶が光を乱反射させている！'),

    // ---- abyss_lord
    en_pg_lord_claw:   act('始原の爪', 'enemy', [phys(1.9, { critBonus: 5 })], 'claw3', '{user}は始原の爪を振り下ろした！'),
    en_pg_lord_tail:   act('天地崩し', 'enemies', [phys(0.85)], 'strike3', '{user}は巨大な尾で天地を薙ぎ払った！'),
    en_pg_lord_flame:  act('創世の業火', 'enemies', [breath(200, 'fire')], 'breath_fire', '{user}は創世の業火を吐き出した！'),
    en_pg_lord_frost:  act('終末の凍気', 'enemies', [breath(200, 'ice')], 'breath_ice', '{user}は終末の凍気を吐き出した！'),
    en_pg_lord_void:   act('虚無の吐息', 'enemies', [breath(220, 'dark')], 'breath_dark', '{user}はすべてを呑み込む虚無の吐息を吐いた！'),
    en_pg_lord_madness: act('混沌の瞳', 'enemies', [status('confuse', 0.75)], 'confuse', '{user}の無数の瞳が七色に揺らめいた！'),
    en_pg_lord_lullaby: act('深淵の子守歌', 'enemies', [status('sleep', 0.7)], 'sleep', '{user}は深淵の底から響く子守歌を歌った！'),
    en_pg_lord_bind:   act('重力の鎖', 'enemies', [status('paralyze', 0.6)], 'gravity', '{user}は重力の鎖で縛りつけた！'),
    en_pg_lord_doom:   act('滅びの宣告', 'enemy', [status('death', 1)], 'death', '{user}は滅びの宣告を下した！'),
    en_pg_lord_null:   act('虚無の波動', 'enemies', [{ type: 'dispel' }], 'dispel', '{user}はすべてを無に帰す波動を放った！'),
    en_pg_lord_roar:   act('終焉の咆哮', 'enemies', [magic(130, 0.7)], 'explosion3', '{user}は世界の終わりを告げる咆哮を上げた！'),
    en_pg_lord_scales: act('始原の鱗', 'self', [buff('def', 2), buff('mdef', 2)], 'buff', '{user}の鱗が黄金色に輝き、固く閉じた！'),
    en_pg_lord_rebirth: act('混沌の再生', 'self', [{ type: 'heal', pct: 0.12 }], 'regen', '{user}の傷口から混沌があふれ、体を再生させた！'),
  });

  // ------------------------------------------------------------ monsters
  const UNDEAD_RES = { poison: 1, death: 1, sleep: 1, confuse: 0.5 };
  const HARD_RES = { poison: 0.5, sleep: 0.5, paralyze: 0.5, confuse: 0.5, death: 0.8 };
  const GOLEM_RES = { poison: 1, sleep: 0.6, confuse: 1, death: 1, blind: 0.5 };
  const BOSS_RES = { poison: 1, sleep: 1, paralyze: 1, confuse: 1, silence: 1, blind: 1, death: 1 };
  const RARE_RES = { death: 1, sleep: 0.5, paralyze: 0.5, confuse: 0.5 };
  const X_REG = { exp: 0.8, gold: 1, jp: 1.5 }; // post-game JP is generous: it is where jobs get mastered

  Object.assign(R.DB.monsters, {
    // ================================================= 地下1階 (Lv45–48)
    pg_hell_hound: pgMon('冥府の番犬', 'wolf', 46, {
      s: { hp: 1.75, atk: 1.7, def: 1.1, agi: 1.5 }, x: X_REG, hue: 120, sat: 2.5, bri: 0.85, eva: 8,
      elem: { fire: 0.5, ice: 1.5, holy: 1.5 }, statusRes: HARD_RES,
      a: [['attack', 4], ['en_pg_hellfire_fang', 3], ['en_pg_howl', 2]],
      drop: ['nectar', 8], rare: ['pg_nova_claw', 96], steal: ['nectar', 'seed_agi'],
      desc: '深淵の入り口を守る冥府の番犬。\n燃える牙で侵入者を焼き噛みにする。',
    }),
    pg_prism_eye: pgMon('虹の魔眼', 'eyeball', 46, {
      s: { hp: 2.0, atk: 1.5, mag: 1.8, mdef: 1.6, agi: 1.2 }, x: X_REG, hue: 150, sat: 1.8, bri: 1.1, mp: 40,
      flags: ['flying'], elem: { wind: 1.5, earth: 0.5 }, statusRes: { confuse: 1, blind: 1, sleep: 0.5 },
      a: [['attack', 3], ['en_pg_madness_gaze', 2], ['en_pg_prism_beam', 3]],
      drop: ['pg_clarity_amulet', 32], rare: ['pg_halo', 128], steal: ['all_cure', 'pg_clarity_amulet'],
      desc: '七色に光る瞳で人の心を惑わす魔眼。\n見つめられると正気を失う。',
    }),
    pg_void_wraith: pgMon('虚無の亡霊', 'void_wraith', 47, {
      s: { hp: 2.1, atk: 1.6, mag: 1.8, mdef: 1.5, agi: 1.1 }, x: X_REG, mp: 60,
      flags: ['undead', 'flying'], elem: { holy: 2, dark: -1, ice: 0.5 }, statusRes: UNDEAD_RES, eva: 10,
      a: [['attack', 3], ['en_pg_soul_drain', 3], ['en_pg_lament', 2], ['en_pg_death_touch', 1]],
      drop: ['mana_crystal', 10], rare: ['pg_soul_bell', 128], steal: ['mana_crystal', 'pg_soul_bell'],
      desc: '深淵に呑まれた者たちの成れの果て。\n声なき嘆きで生者の言葉を奪う。',
    }),
    pg_abyss_knight: pgMon('深淵の騎士', 'armor', 48, {
      s: { hp: 1.95, atk: 1.75, def: 1.7, mdef: 1.1, agi: 0.9 }, x: X_REG, hue: -60, sat: 2.5, bri: 0.6,
      elem: { holy: 1.5, thunder: 1.5, dark: 0 }, statusRes: { poison: 1, death: 1, sleep: 0.5, confuse: 0.5 },
      a: [['attack', 4], ['en_pg_abyss_slash', 3], ['en_pg_guard', 1]],
      drop: ['nectar', 8], rare: ['pg_chaos_helm', 128], steal: ['nectar', 'seed_vit'],
      desc: '主を失ってなお深淵をさまよう騎士。\n闇をまとった剣は鎧ごと断ち切る。',
    }),

    // ================================================= 地下2階 (Lv48–52)
    pg_chaos_beast: pgMon('カオスビースト', 'chaos_beast', 50, {
      s: { hp: 1.4, atk: 1.35, def: 1.1, agi: 1.0 }, x: X_REG,
      elem: { holy: 1.5 }, statusRes: HARD_RES,
      a: [['attack', 4], ['en_pg_rampage', 3], ['en_pg_chaos_roar', 1]],
      drop: ['seed_str', 16], rare: ['pg_ruin_axe', 128], steal: ['nectar', 'seed_str'],
      desc: 'いくつもの獣が混沌の中で溶け合った怪物。\n理性はなく、ただ暴れ回る。',
    }),
    pg_star_golem: pgMon('星鋼の巨兵', 'golem', 50, {
      s: { hp: 1.54, atk: 1.45, def: 1.9, mdef: 1.2, agi: 0.6 }, x: X_REG, sat: 0.2, bri: 1.3,
      elem: { thunder: 1.5, earth: 0.5, dark: 0.5 }, statusRes: GOLEM_RES,
      a: [['attack', 4], ['en_pg_star_crush', 3], ['en_pg_meteor_quake', 2]],
      drop: ['mega_bomb', 12], rare: ['dawn_armor', 96], steal: ['mega_bomb', 'seed_hp'],
      desc: '星から落ちた鋼で造られた巨兵。\n数千年の間、深淵の門を守り続けている。',
    }),
    pg_abyss_sorcerer: pgMon('深淵の魔導師', 'darkmage', 50, {
      s: { hp: 1.33, atk: 1.1, mag: 1.5, mdef: 1.6, agi: 1.2 }, x: X_REG, hue: -100, sat: 1.4, bri: 0.7, mp: 90,
      elem: { holy: 1.5, dark: 0.5 }, statusRes: { sleep: 0.5, silence: 0.5, confuse: 0.5, death: 0.8 },
      a: [['attack', 2], ['en_pg_chaos_flare', 3], ['en_pg_abyss_ice', 2], ['en_pg_sleep_mist', 2], ['en_pg_dispel', 1]],
      drop: ['mana_crystal', 8], rare: ['goddess_robe', 96], steal: ['mana_crystal', 'seed_int'],
      desc: '禁じられた混沌の魔法を求めて\n深淵に降りた魔導師。もはや人ではない。',
    }),
    pg_aurora_harpy: pgMon('極光のハーピー', 'harpy', 49, {
      s: { hp: 1.4, atk: 1.15, mag: 1.2, agi: 1.5 }, x: X_REG, hue: 160, sat: 1.6, bri: 1.1, eva: 10,
      flags: ['flying'], elem: { thunder: 1.5, wind: 0.5, earth: 0.5 }, statusRes: HARD_RES,
      a: [['attack', 3], ['en_pg_dive', 3], ['en_pg_aurora_song', 2], ['en_pg_gale', 2]],
      drop: ['goddess_tear', 24], rare: ['pg_starlight_garb', 128], steal: ['nectar', 'seed_agi'],
      desc: 'オーロラ色の翼を持つ魔鳥。\nその歌を聴いた者は二度と目覚めないという。',
    }),

    // ================================================= 地下3階 (Lv52–56)
    pg_void_dragon: pgMon('虚竜', 'wyvern', 54, {
      s: { hp: 1.33, atk: 1.25, def: 1.2, agi: 1.1 }, x: X_REG, sat: 0.25, bri: 1.35,
      flags: ['flying', 'dragon'], elem: { holy: 1.5, dark: -1, earth: 0.5 }, statusRes: HARD_RES,
      a: [['attack', 4], ['en_pg_void_breath', 2], ['en_pg_frost_breath', 2], ['en_pg_greed', 2]],
      drop: ['light_drop', 16], rare: ['pg_heaven_bow', 128], steal: ['nectar', 'light_drop'],
      desc: '虚無を喰らって生きる竜。\n吐く息はあらゆるものを無に帰す。',
    }),
    pg_chaos_chimera: pgMon('混沌キマイラ', 'chimera', 54, {
      s: { hp: 1.4, atk: 1.4, def: 1.1, agi: 1.2 }, x: X_REG, hue: -60, sat: 1.8, bri: 0.9,
      flags: ['flying'], elem: { ice: 1.5, fire: 0.5 }, statusRes: HARD_RES,
      a: [['attack', 5], ['en_pg_flame_breath', 2], ['en_pg_greed', 2], ['en_pg_howl', 1]],
      drop: ['nectar', 8], rare: ['pg_void_katana', 128], steal: ['nectar', 'seed_str'],
      desc: '獅子と竜と蛇が混沌のうちに結びついた獣。\n三つの口から獄炎を吐く。',
    }),
    pg_doom_box: pgMon('滅びの箱', 'mimic', 55, {
      s: { hp: 2.8, atk: 1.6, def: 1.3, mdef: 1.3, agi: 1.1 }, x: { exp: 1.1, gold: 3, jp: 1.5 }, sat: 0.15, bri: 0.4,
      statusRes: { death: 1, sleep: 0.5, confuse: 0.5, paralyze: 0.5 },
      a: [['attack', 3], ['en_pg_doom_bite', 3], ['en_pg_greed', 2]],
      drop: ['seed_luk', 8], rare: ['pg_star_dagger', 64], steal: ['goddess_tear', 'pg_star_dagger'],
      desc: '深淵に置き去りにされた宝箱に\n死神が棲みついたもの。噛まれれば命はない。',
    }),
    pg_arch_demon: pgMon('深淵の魔将', 'demon', 56, {
      s: { hp: 1.26, atk: 1.35, mag: 1.3, mdef: 1.2, agi: 1.1 }, x: X_REG, hue: 50, sat: 1.6, bri: 0.8, mp: 80,
      elem: { holy: 2, dark: -1, ice: 0.5 }, statusRes: HARD_RES,
      a: [['attack', 3], ['en_pg_demon_claw', 3], ['en_pg_dark_nova', 2], ['en_pg_chaos_flare', 1]],
      drop: ['mana_crystal', 8], rare: ['pg_genesis_harp', 128], steal: ['mana_crystal', 'seed_mnd'],
      desc: '深淵の主に仕える魔族の将。\n魔王ヴァルザードさえ恐れたという。',
    }),

    // ================================================= 地下4階 (Lv56–60)
    pg_abyss_gargoyle: pgMon('深淵のガーゴイル', 'gargoyle', 57, {
      s: { hp: 1.3, atk: 1.3, def: 1.6, mdef: 1.3, agi: 1.2 }, x: X_REG, hue: -40, sat: 3, bri: 0.8,
      flags: ['flying'], elem: { thunder: 1.5, earth: 0.5, dark: 0.5 }, statusRes: GOLEM_RES,
      a: [['attack', 4], ['en_pg_dive', 3], ['en_pg_stone_gaze', 2]],
      drop: ['seed_hp', 12], rare: ['goddess_charm', 128], steal: ['nectar', 'seed_hp'],
      desc: '最深部へ続く回廊を見張る石の魔物。\nその眼差しは体を石のようにこわばらせる。',
    }),

    // ================================================= レアモンスター
    rare_prism: pgMon('プリズマ', 'rare_prism', 55, {
      s: { hp: 1.2, atk: 1.0, def: 1.8, mdef: 1.8, agi: 1.5, mag: 1.2 }, x: { exp: 6, gold: 8, jp: 5 }, mp: 40,
      eva: 10, flags: ['rare', 'flee'], fleeRate: 0.35, attackFx: 'strike',
      elem: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 0.5, earth: 0.5, water: 0.5, holy: 0.5, dark: 0.5 }, statusRes: RARE_RES,
      a: [['attack', 3], ['en_pg_prism_flash', 3], ['en_pg_refract', 1, { once: true }], ['wait', 2]],
      drop: ['goddess_tear', 6], rare: ['pg_prism_ring', 32], steal: ['seed_luk', 'pg_prism_ring'],
      appear: '虹色の光が弾け、プリズマが現れた！',
      desc: '深淵の結晶が命を得たという生き物。\n体の中で虹が絶えず生まれては消える。',
    }),

    // ================================================= 裏ボス
    abyss_lord: {
      name: 'アビスロード', sprite: 'boss_abyss', lv: 70, actsPerTurn: 3,
      hp: 8400, mp: 0, atk: 360, def: 180, agi: 110, mag: 260, mdef: 110, eva: 2,
      exp: 60000, gold: 30000, jp: 3000,
      flags: ['boss', 'dragon'], statusRes: BOSS_RES,
      elem: { dark: -1, fire: 0.5, ice: 0.5, thunder: 0.5 },
      actions: [
        // fixed schedule (3 actions a round; see the header)
        { id: 'en_pg_lord_madness', w: 10000, cond: { every: [9, 0] } },
        { id: 'en_pg_lord_doom', w: 10000, cond: { every: [9, 3] } },
        { id: 'en_pg_lord_null', w: 10000, cond: { every: [9, 6] } },
        { id: 'en_pg_lord_roar', w: 10000, cond: { every: [9, 7] } },
        { id: 'en_pg_lord_scales', w: 10000, cond: { every: [9, 5] } },
        { id: 'wait', w: 10000, cond: { every: [9, 2], hpAbove: 0.5 } },
        { id: 'wait', w: 10000, cond: { every: [9, 8], hpAbove: 0.5 } },
        { id: 'en_pg_lord_rebirth', w: 10000, cond: { hpBelow: 0.25, once: true } },
        // free actions
        { id: 'attack', w: 3 },
        { id: 'en_pg_lord_claw', w: 3 },
        { id: 'en_pg_lord_tail', w: 2 },
        { id: 'en_pg_lord_flame', w: 2 },
        { id: 'en_pg_lord_frost', w: 2 },
        { id: 'en_pg_lord_lullaby', w: 1 },
        { id: 'en_pg_lord_bind', w: 1 },
        { id: 'en_pg_lord_void', w: 2, cond: { hpBelow: 0.5 } },
      ],
      drop: { item: 'goddess_tear', rate: 1 }, rare: { item: 'light_drop', rate: 1 },
      desc: '天地が生まれる前から深淵に在る混沌の竜神。\n魔王の力さえ、そのかけらに過ぎないという。',
    },
  });

  // ------------------------------------------------------------ encounters
  const g = (w, ...mons) => ({ w, mons });
  const Z = (lv, groups) => ({ lv, bg: 'demon', groups });
  Object.assign(R.DB.encounters, {
    d_abyss1: Z([45, 48], [
      g(8, ['pg_hell_hound', 2, 3]),
      g(7, ['pg_prism_eye', 2, 3], ['pg_hell_hound', 1, 1]),
      g(7, ['pg_void_wraith', 2, 3]),
      g(6, ['pg_abyss_knight', 1, 2], ['pg_prism_eye', 1, 1]),
      g(5, ['pg_void_wraith', 1, 2], ['pg_abyss_knight', 1, 1]),
    ]),
    d_abyss2: Z([48, 52], [
      g(8, ['pg_chaos_beast', 1, 2]),
      g(7, ['pg_star_golem', 1, 1], ['pg_abyss_sorcerer', 1, 1]),
      g(7, ['pg_aurora_harpy', 2, 3]),
      g(6, ['pg_abyss_sorcerer', 2, 2], ['pg_abyss_knight', 1, 1]),
      g(5, ['pg_chaos_beast', 1, 1], ['pg_aurora_harpy', 1, 2]),
      g(4, ['pg_void_wraith', 2, 2], ['pg_abyss_sorcerer', 1, 1]),
    ]),
    d_abyss3: Z([52, 56], [
      g(8, ['pg_void_dragon', 1, 2]),
      g(7, ['pg_chaos_chimera', 1, 2]),
      g(7, ['pg_arch_demon', 1, 1], ['pg_abyss_sorcerer', 1, 1]),
      g(6, ['pg_chaos_beast', 1, 1], ['pg_aurora_harpy', 2, 2]),
      g(4, ['pg_doom_box', 1, 1]),
    ]),
    d_abyss4: Z([56, 60], [
      g(8, ['pg_abyss_gargoyle', 2, 3]),
      g(7, ['pg_arch_demon', 1, 1], ['pg_abyss_gargoyle', 1, 1]),
      g(7, ['pg_void_dragon', 1, 1], ['pg_chaos_chimera', 1, 1]),
      g(6, ['pg_star_golem', 1, 1], ['pg_arch_demon', 1, 1]),
      g(4, ['pg_doom_box', 1, 1], ['pg_abyss_gargoyle', 1, 1]),
    ]),
  });
  Object.assign(R.DB.rareEncounters, {
    d_abyss1: { mon: 'rare_prism', rate: 0.015 },
    d_abyss2: { mon: 'rare_prism', rate: 0.015 },
    d_abyss3: { mon: 'rare_prism', rate: 0.015 },
    d_abyss4: { mon: 'rare_prism', rate: 0.015 },
  });
  Object.assign(R.DB.troops, {
    boss_abyss: { mons: [['abyss_lord', 1, 1]], bg: 'demon', bgm: 'lastboss', noEscape: true },
  });

  // ------------------------------------------------------------ objectives
  R.DB.objectives = R.DB.objectives || {};
  Object.assign(R.DB.objectives, {
    obj_postgame: {
      text: '海に浮かぶ小島に現れた\n「深淵の迷宮」の\n最深部を目指そう。',
      king: '魔王を倒したそなたたちに\n伝えねばならぬことがある。\f海に浮かぶ小さな島に、見知らぬ\n迷宮が口を開けたというのじゃ。\f底知れぬ闇の気配……。\nくれぐれも、備えを怠るでないぞ。',
    },
    obj_abyss_clear: {
      text: '深淵の主を打ち倒した！\n真の平和が訪れた。\nおつかれさま！',
      king: 'なんと、深淵の主までも\n打ち倒したと申すか！\fそなたたちこそ、まことの勇者。\nレグナスの、いや世界の誇りじゃ！',
    },
  });
})(window.RPG);
