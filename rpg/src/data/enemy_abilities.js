// Enemy-only abilities (DESIGN §5.3, ids en_*). Same schema as job actions; the
// monster AI (battle_ai.js) picks them by weight/cond from R.DB.monsters[*].actions.
// Balance (tools/sim_balance.js): physical skills scale with the user's atk, spells
// with its mag (monster mag ≈ 0.6·atk), breaths are fixed tiers and ignore mdef:
//   fire  8 → 20 → 42 → 75      ice 10 → 28 → 55      dark 95
// Spells cost MP, so a monster's mp decides how often it can cast.
(function (R) {
  'use strict';

  const phys = (power, o) => Object.assign({ type: 'damage', formula: 'phys', power }, o);
  const magic = (power, scale, element, o) => Object.assign({ type: 'damage', formula: 'magic', power, scale }, element ? { element } : {}, o);
  const breath = (power, element) => Object.assign({ type: 'damage', formula: 'breath', power }, element ? { element } : {});
  const status = (s, chance) => ({ type: 'status', status: s, chance });
  const buff = (stat, stages, chance) => Object.assign({ type: 'buff', stat, stages }, chance != null ? { chance } : {});
  const act = (name, target, effects, fx, o) => Object.assign({ name, kind: 'action', target, effects, fx }, o);
  const spell = (name, mp, target, effects, fx, o) => Object.assign({ name, kind: 'action', mp, magic: true, target, effects, fx }, o);

  Object.assign(R.DB.abilities, {
    // ------------------------------------------------------------ physical
    en_bite: act('噛みつき', 'enemy', [phys(1.35)], 'bite', { msg: '{user}は鋭い牙で噛みついた！' }),
    en_heavy: act('重い一撃', 'enemy', [phys(1.6, { acc: 0.85 })], 'strike2', { msg: '{user}は力いっぱい殴りかかった！' }),
    en_double: act('連続攻撃', 'enemy', [phys(0.8, { hits: 2 })], 'slash', { msg: '{user}は素早く2回攻撃した！' }),
    en_claws: act('切り裂く', 'enemy', [phys(0.75, { hits: 2 })], 'claw', { msg: '{user}は鋭い爪で切り裂いた！' }),
    en_charge: act('体当たり', 'enemy', [phys(1.4, { acc: 0.9 })], 'strike', { msg: '{user}は勢いよく体当たりした！' }),
    en_horn: act('角で突く', 'enemy', [phys(1.45, { critBonus: 10 })], 'pierce', { msg: '{user}は角を突き立てた！' }),
    en_pierce: act('貫く', 'enemy', [phys(1.4, { acc: 0.9 })], 'pierce', { msg: '{user}は矛を鋭く突き出した！' }),
    en_crush: act('押しつぶす', 'enemy', [phys(2.0, { acc: 0.75 })], 'strike3', { msg: '{user}はのしかかって押しつぶそうとした！' }),
    en_sweep: act('大なぎ払い', 'enemies', [phys(0.65)], 'slash2', { msg: '{user}は武器を大きく振り回した！' }),
    en_tail: act('しっぽ打ち', 'enemies', [phys(0.55)], 'strike', { msg: '{user}はしっぽでなぎ払った！' }),
    en_rampage: act('暴れ回る', 'random', [phys(0.7, { hits: [3, 4] })], 'strike', { msg: '{user}はめちゃくちゃに暴れ回った！' }),
    en_needles: act('トゲ飛ばし', 'random', [phys(0.6, { hits: 3 })], 'pierce', { msg: '{user}はトゲを飛ばした！' }),
    en_tentacles: act('足の乱舞', 'random', [phys(0.6, { hits: [3, 5] })], 'strike', { msg: '{user}はたくさんの足で襲いかかった！' }),
    en_stomp: act('踏みつけ', 'enemies', [phys(0.7, { element: 'earth' })], 'earth', { msg: '{user}は大地を踏み鳴らした！' }),
    en_quake: act('地響き', 'enemies', [magic(18, 0.45, 'earth')], 'earth2', { msg: '{user}は地面を揺るがした！' }),
    en_fire_fang: act('炎の牙', 'enemy', [phys(1.3, { element: 'fire' })], 'fire', { msg: '{user}は燃える牙で噛みついた！' }),
    en_frost_fist: act('氷の拳', 'enemy', [phys(1.7, { element: 'ice', acc: 0.9 })], 'ice2', { msg: '{user}は氷の拳を振り下ろした！' }),
    en_lava_blade: act('溶岩の剣', 'enemy', [phys(1.8, { element: 'fire' })], 'fire3', { msg: '{user}は溶岩の剣を振り下ろした！' }),
    en_dark_blade: act('暗黒剣', 'enemy', [phys(1.9, { element: 'dark' })], 'dark2', { msg: '{user}は闇をまとった剣で斬りつけた！' }),
    en_dark_wave: act('暗黒の波', 'enemies', [phys(0.85, { element: 'dark' })], 'dark3', { msg: '{user}は闇の波を放った！' }),
    en_light_blade: act('光の刃', 'enemy', [phys(1.7, { element: 'holy' })], 'holy2', { msg: '{user}は光の刃を放った！' }),
    en_demon_claw: act('魔王の爪', 'enemy', [phys(1.05, { hits: 2, element: 'dark' })], 'claw', { msg: '{user}は闇をまとった爪で切り裂いた！' }),
    en_ruin_blow: act('魔神の一撃', 'enemy', [phys(2.1, { acc: 0.9, critBonus: 5 })], 'strike3', { msg: '{user}はすさまじい一撃を放った！' }),
    en_club_storm: act('こん棒乱舞', 'random', [phys(0.8, { hits: 3 })], 'strike2', { msg: '{user}はこん棒を振り回した！' }),
    en_bite_crush: act('噛み砕く', 'enemy', [phys(1.9, { acc: 0.9 })], 'bite', { msg: '{user}は大きな口で噛み砕いた！' }),

    // ------------------------------------------------------ status attacks
    en_poison_bite: act('毒の牙', 'enemy', [phys(1.0), status('poison', 0.35)], 'bite', { msg: '{user}は毒の牙で噛みついた！' }),
    en_poison_sting: act('毒針', 'enemy', [phys(0.9), status('poison', 0.45)], 'pierce', { msg: '{user}は毒針で刺した！' }),
    en_numb_sting: act('しびれ針', 'enemy', [phys(0.9), status('paralyze', 0.2)], 'pierce', { msg: '{user}はしびれ針で刺した！' }),
    en_poison_blade: act('毒のナイフ', 'enemy', [phys(1.1), status('poison', 0.5)], 'slash', { msg: '{user}は毒を塗ったナイフで切りつけた！' }),
    en_bind: act('締めつけ', 'enemy', [phys(0.8), status('paralyze', 0.3)], 'strike', { msg: '{user}は絡みついて締めつけた！' }),
    en_bandage: act('包帯巻き', 'enemy', [status('paralyze', 0.35)], 'paralyze', { msg: '{user}は包帯を伸ばして巻きついた！' }),
    en_gaze: act('にらみつける', 'enemy', [status('paralyze', 0.35)], 'paralyze', { msg: '{user}はぎょろりとにらみつけた！' }),
    en_evil_eye: act('妖しい眼差し', 'enemies', [status('confuse', 0.25)], 'confuse', { msg: '{user}の目が妖しく光った！' }),
    en_sleep_spore: act('眠りの粉', 'enemy', [status('sleep', 0.4)], 'sleep', { msg: '{user}は眠りの粉をまき散らした！' }),
    en_poison_spore: act('毒の胞子', 'enemies', [status('poison', 0.3)], 'poison', { msg: '{user}は毒の胞子をまき散らした！' }),
    en_confuse_spore: act('惑わしの胞子', 'enemies', [status('confuse', 0.25)], 'confuse', { msg: '{user}は不思議な胞子をまき散らした！' }),
    en_ink: act('墨を吐く', 'enemies', [status('blind', 0.35)], 'blind', { msg: '{user}は真っ黒な墨を吐いた！' }),
    en_sand: act('砂ぼこり', 'enemies', [status('blind', 0.3)], 'smoke', { msg: '{user}は砂ぼこりを巻き上げた！' }),
    en_sleep_song: act('眠りの歌', 'enemies', [status('sleep', 0.3)], 'song', { msg: '{user}は眠りを誘う歌を歌った！' }),
    en_curse: act('呪いの言葉', 'enemy', [status('silence', 0.5)], 'silence', { msg: '{user}は呪いの言葉をつぶやいた！' }),
    en_riddle: act('謎かけ', 'enemies', [status('confuse', 0.3)], 'confuse', { msg: '{user}は不思議な謎をかけてきた！' }),
    en_whisper: act('死のささやき', 'enemy', [status('death', 0.15)], 'death', { msg: '{user}は死の言葉をささやいた！' }),
    en_doom: act('死の宣告', 'enemies', [status('death', 0.12)], 'death', { msg: '{user}は死の宣告を下した！' }),
    en_drain: act('吸血', 'enemy', [phys(0.9, { drain: 0.5 })], 'drain', { msg: '{user}は血を吸おうと噛みついた！' }),
    en_life_suck: act('命吸い', 'enemy', [magic(12, 0.45, 'dark', { drain: 0.6 })], 'drain', { msg: '{user}は命を吸い取ろうとした！' }),
    en_acid: act('溶かす液', 'enemy', [phys(0.8), buff('def', -1, 0.5)], 'poison', { msg: '{user}はねばつく液を吐きかけた！' }),
    en_steal: act('盗み癖', 'enemy', [{ type: 'steal' }], 'steal', { msg: '{user}は素早く懐を狙った！' }),
    en_intimidate: act('威嚇', 'enemies', [buff('atk', -1, 0.45)], 'debuff', { msg: '{user}は恐ろしい声で威嚇した！' }),
    en_gloom: act('絶望の影', 'enemies', [buff('atk', -1, 0.6), buff('def', -1, 0.6)], 'dark', { msg: '{user}は絶望の影を広げた！' }),
    en_null_wave: act('無の波動', 'enemies', [{ type: 'dispel' }], 'dispel', { msg: '{user}はすべてを打ち消す波動を放った！' }),
    en_smoke: act('煙玉', 'enemies', [status('blind', 0.4)], 'smoke', { msg: '{user}は煙玉を投げつけた！' }),

    // --------------------------------------------------------- self / ally
    en_howl: act('群れの叫び', 'allies', [buff('atk', 1)], 'buff', { msg: '{user}は仲間を奮い立たせる叫びを上げた！' }),
    en_shout: act('掛け声', 'allies', [buff('atk', 1)], 'buff', { msg: '{user}は掛け声で手下を奮い立たせた！' }),
    en_focus: act('力ため', 'self', [buff('atk', 2)], 'buff', { msg: '{user}は力をためている！' }),
    en_harden: act('硬くなる', 'self', [buff('def', 2)], 'buff', { msg: '{user}の体が硬くなった！' }),
    en_flame_armor: act('炎の鎧', 'self', [buff('def', 1), buff('mdef', 1)], 'fire', { msg: '{user}は炎をまとった！' }),
    en_herb: act('薬草をかじる', 'self', [{ type: 'heal', pct: 0.2 }], 'heal', { msg: '{user}は薬草をかじった！' }),
    en_regrow: act('再生', 'self', [{ type: 'heal', pct: 0.25 }], 'regen', { msg: '{user}の傷がみるみるふさがっていく！' }),
    en_ancient_heal: act('いにしえの祈り', 'self', [{ type: 'heal', pct: 0.22 }], 'heal', { msg: '{user}はいにしえの祈りを捧げた！' }),
    en_star_heal: act('星の癒やし', 'self', [{ type: 'heal', pct: 0.2 }], 'heal', { msg: '{user}は星の光を浴びた！' }),
    en_dark_heal: act('闇の癒やし', 'self', [{ type: 'heal', pct: 0.18 }], 'dark', { msg: '{user}は闇を吸い込んで傷を癒やした！' }),

    // ---------------------------------------------------------------- spells
    en_fire: spell('ファイアボール', 2, 'enemy', [magic(10, 0.5, 'fire')], 'fire'),
    en_fire2: spell('火炎の渦', 6, 'group', [magic(8, 0.4, 'fire')], 'fire2'),
    en_blast: spell('爆炎', 6, 'enemy', [magic(22, 0.7, 'fire')], 'explosion'),
    en_inferno: spell('インフェルノ', 14, 'enemies', [magic(22, 0.6, 'fire')], 'fire3'),
    en_ice: spell('アイスニードル', 3, 'enemy', [magic(12, 0.55, 'ice')], 'ice'),
    en_ice2: spell('アイスストーム', 6, 'group', [magic(10, 0.4, 'ice')], 'ice2'),
    en_ice3: spell('氷の嵐', 14, 'enemies', [magic(26, 0.6, 'ice')], 'ice3'),
    en_thunder: spell('ライトニング', 3, 'enemy', [magic(12, 0.55, 'thunder')], 'thunder'),
    en_thunder2: spell('雷の雨', 8, 'enemies', [magic(8, 0.4, 'thunder')], 'thunder2'),
    en_thunder3: spell('雷神の怒り', 14, 'enemies', [magic(26, 0.6, 'thunder')], 'thunder3'),
    en_wind: spell('かまいたち', 3, 'group', [magic(8, 0.4, 'wind')], 'wind'),
    en_wind2: spell('竜巻', 8, 'enemies', [magic(18, 0.5, 'wind')], 'wind2'),
    en_water: spell('水鉄砲', 3, 'enemy', [magic(12, 0.55, 'water')], 'water'),
    en_dark: spell('闇の玉', 4, 'enemy', [magic(16, 0.6, 'dark')], 'dark'),
    en_dark2: spell('闇の渦', 10, 'enemies', [magic(16, 0.5, 'dark')], 'dark2'),
    en_stardust: spell('星くずのつぶて', 8, 'random', [magic(10, 0.4, null, { hits: 4 })], 'magic2'),
    en_heal: spell('ヒール', 3, 'ally', [{ type: 'heal', power: 18, scale: 0.6 }], 'heal'),
    en_healing: spell('ヒーリング', 6, 'ally', [{ type: 'heal', power: 50, scale: 0.9 }], 'heal2'),
    en_heal_all: spell('癒やしの輪', 8, 'allies', [{ type: 'heal', power: 30, scale: 0.5 }], 'heal2'),
    en_revive: spell('リバイブ', 12, 'ally_dead', [{ type: 'revive', pct: 0.5 }], 'revive'),
    en_protect: spell('守りの祈り', 3, 'ally', [buff('def', 1)], 'buff'),
    en_slow: spell('減速', 5, 'enemies', [buff('agi', -1, 0.6)], 'debuff'),
    en_sleep: spell('眠りの霧', 3, 'group', [status('sleep', 0.35)], 'sleep'),
    en_silence: spell('しじまの祈り', 3, 'group', [status('silence', 0.45)], 'silence'),
    en_confuse: spell('惑わしの風', 5, 'group', [status('confuse', 0.3)], 'confuse'),
    en_poison_mist: spell('毒の霧', 4, 'group', [status('poison', 0.5)], 'poison'),
    en_blind: spell('暗闇の霧', 3, 'group', [status('blind', 0.45)], 'blind'),
    en_death: spell('魂抜き', 10, 'enemy', [status('death', 0.25)], 'death'),
    en_mp_drain: spell('MP吸い取り', 0, 'enemy', [magic(8, 0.15, null, { mp: true, drain: 1 })], 'mp'),

    // --------------------------------------------------------------- breaths
    en_breath_fire1: act('火の粉の息', 'enemies', [breath(8, 'fire')], 'breath_fire', { msg: '{user}は火の粉を吹きかけた！' }),
    en_breath_fire2: act('炎の息', 'enemies', [breath(20, 'fire')], 'breath_fire', { msg: '{user}は炎を吐いた！' }),
    en_breath_fire3: act('猛火の息', 'enemies', [breath(42, 'fire')], 'breath_fire', { msg: '{user}は猛烈な炎を吐いた！' }),
    en_breath_fire4: act('煉獄の炎', 'enemies', [breath(75, 'fire')], 'breath_fire', { msg: '{user}は煉獄の炎を吐き出した！' }),
    en_breath_ice1: act('霜の息', 'enemies', [breath(10, 'ice')], 'breath_ice', { msg: '{user}は霜の息を吹きかけた！' }),
    en_breath_ice2: act('氷結の息', 'enemies', [breath(28, 'ice')], 'breath_ice', { msg: '{user}は凍りつく息を吐いた！' }),
    en_breath_ice3: act('吹雪の息', 'enemies', [breath(55, 'ice')], 'breath_ice', { msg: '{user}はすさまじい吹雪を吐いた！' }),
    en_breath_poison: act('毒ガス', 'enemies', [breath(6), status('poison', 0.4)], 'breath_poison', { msg: '{user}は毒ガスを吐き出した！' }),
    en_breath_dark: act('闇の息吹', 'enemies', [breath(95, 'dark')], 'breath_dark', { msg: '{user}は闇の息吹を吐き出した！' }),

    // ------------------------------------------------------ boss signatures
    en_tsunami: act('津波', 'enemies', [magic(26, 0.5, 'water')], 'water3', { msg: '{user}は大波を呼び起こした！' }),
    en_sandstorm: act('砂嵐', 'enemies', [magic(20, 0.45, 'earth'), status('blind', 0.25)], 'earth2', { msg: '{user}は砂嵐を巻き起こした！' }),
    en_star_rain: act('流れ星の雨', 'random', [magic(24, 0.5, null, { hits: 5 })], 'explosion2', { msg: '{user}は流れ星を降らせた！' }),
    en_dark_thunder: act('闇の雷', 'enemies', [magic(60, 0.6, 'dark')], 'thunder3', { msg: '{user}は闇の雷を呼び起こした！' }),
    en_despair: act('絶望の闇', 'enemies', [magic(80, 0.65, 'dark')], 'dark3', { msg: '{user}は絶望の闇を解き放った！' }),
    en_ruin_light: act('破壊の光', 'enemies', [magic(80, 0.6)], 'explosion3', { msg: '{user}は破壊の光を放った！' }),
    en_warp: act('時空のゆがみ', 'enemies', [{ type: 'damage', formula: 'percent', power: 0.3 }], 'gravity', { msg: '{user}の周りで時空がゆがんだ！' }),
  });
})(window.RPG);
