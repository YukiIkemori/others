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
    en_bite: act('かみつき', 'enemy', [phys(1.35)], 'bite', { msg: '{user}は するどい きばで かみついた！' }),
    en_heavy: act('おもいいちげき', 'enemy', [phys(1.6, { acc: 0.85 })], 'strike2', { msg: '{user}は ちからいっぱい なぐりかかった！' }),
    en_double: act('れんぞくこうげき', 'enemy', [phys(0.8, { hits: 2 })], 'slash', { msg: '{user}は すばやく 2かい こうげきした！' }),
    en_claws: act('きりさく', 'enemy', [phys(0.75, { hits: 2 })], 'claw', { msg: '{user}は するどい つめで きりさいた！' }),
    en_charge: act('たいあたり', 'enemy', [phys(1.4, { acc: 0.9 })], 'strike', { msg: '{user}は いきおいよく たいあたりした！' }),
    en_horn: act('つのでつく', 'enemy', [phys(1.45, { critBonus: 10 })], 'pierce', { msg: '{user}は ツノを つきたてた！' }),
    en_pierce: act('つらぬく', 'enemy', [phys(1.4, { acc: 0.9 })], 'pierce', { msg: '{user}は ほこを するどく つきだした！' }),
    en_crush: act('おしつぶす', 'enemy', [phys(2.0, { acc: 0.75 })], 'strike3', { msg: '{user}は のしかかって おしつぶそうとした！' }),
    en_sweep: act('おおなぎ', 'enemies', [phys(0.65)], 'slash2', { msg: '{user}は ぶきを おおきく ふりまわした！' }),
    en_tail: act('しっぽうち', 'enemies', [phys(0.55)], 'strike', { msg: '{user}は しっぽで なぎはらった！' }),
    en_rampage: act('あばれまわる', 'random', [phys(0.7, { hits: [3, 4] })], 'strike', { msg: '{user}は めちゃくちゃに あばれまわった！' }),
    en_needles: act('はりとばし', 'random', [phys(0.6, { hits: 3 })], 'pierce', { msg: '{user}は トゲを はなった！' }),
    en_tentacles: act('あしのらんぶ', 'random', [phys(0.6, { hits: [3, 5] })], 'strike', { msg: '{user}は たくさんの あしで おそいかかった！' }),
    en_stomp: act('ふみつけ', 'enemies', [phys(0.7, { element: 'earth' })], 'earth', { msg: '{user}は だいちを ふみならした！' }),
    en_quake: act('じひびき', 'enemies', [magic(18, 0.45, 'earth')], 'earth2', { msg: '{user}は じめんを ゆるがした！' }),
    en_fire_fang: act('ほのおのきば', 'enemy', [phys(1.3, { element: 'fire' })], 'fire', { msg: '{user}は もえる きばで かみついた！' }),
    en_frost_fist: act('こおりのこぶし', 'enemy', [phys(1.7, { element: 'ice', acc: 0.9 })], 'ice2', { msg: '{user}は こおりの こぶしを ふりおろした！' }),
    en_lava_blade: act('ようがんのけん', 'enemy', [phys(1.8, { element: 'fire' })], 'fire3', { msg: '{user}は ようがんの けんを ふりおろした！' }),
    en_dark_blade: act('あんこくけん', 'enemy', [phys(1.9, { element: 'dark' })], 'dark2', { msg: '{user}は やみを まとった けんで きりつけた！' }),
    en_dark_wave: act('あんこくのなみ', 'enemies', [phys(0.85, { element: 'dark' })], 'dark3', { msg: '{user}は やみの なみを はなった！' }),
    en_light_blade: act('ひかりのやいば', 'enemy', [phys(1.7, { element: 'holy' })], 'holy2', { msg: '{user}は ひかりの やいばを はなった！' }),
    en_demon_claw: act('まおうのつめ', 'enemy', [phys(1.05, { hits: 2, element: 'dark' })], 'claw', { msg: '{user}は するどい つめで きりさいた！' }),
    en_ruin_blow: act('まじんのいちげき', 'enemy', [phys(2.1, { acc: 0.9, critBonus: 5 })], 'strike3', { msg: '{user}は すさまじい いちげきを はなった！' }),
    en_club_storm: act('こんぼうらんぶ', 'random', [phys(0.8, { hits: 3 })], 'strike2', { msg: '{user}は こんぼうを ふりまわした！' }),
    en_bite_crush: act('かみくだく', 'enemy', [phys(1.9, { acc: 0.9 })], 'bite', { msg: '{user}は おおきな くちで かみくだいた！' }),

    // ------------------------------------------------------ status attacks
    en_poison_bite: act('どくのきば', 'enemy', [phys(1.0), status('poison', 0.35)], 'bite', { msg: '{user}は どくのきばで かみついた！' }),
    en_poison_sting: act('どくばり', 'enemy', [phys(0.9), status('poison', 0.45)], 'pierce', { msg: '{user}は どくばりで さした！' }),
    en_numb_sting: act('しびればり', 'enemy', [phys(0.9), status('paralyze', 0.2)], 'pierce', { msg: '{user}は しびればりで さした！' }),
    en_poison_blade: act('どくのナイフ', 'enemy', [phys(1.1), status('poison', 0.5)], 'slash', { msg: '{user}は どくを ぬった ナイフで きりつけた！' }),
    en_bind: act('しめつけ', 'enemy', [phys(0.8), status('paralyze', 0.3)], 'strike', { msg: '{user}は からみついて しめつけた！' }),
    en_bandage: act('ほうたいまき', 'enemy', [status('paralyze', 0.35)], 'paralyze', { msg: '{user}は ほうたいを のばして まきついた！' }),
    en_gaze: act('にらみつける', 'enemy', [status('paralyze', 0.35)], 'paralyze', { msg: '{user}は ぎょろりと にらみつけた！' }),
    en_evil_eye: act('あやしいまなざし', 'enemies', [status('confuse', 0.25)], 'confuse', { msg: '{user}の めが あやしく ひかった！' }),
    en_sleep_spore: act('ねむりのこな', 'enemy', [status('sleep', 0.4)], 'sleep', { msg: '{user}は ねむりのこなを まきちらした！' }),
    en_poison_spore: act('どくのほうし', 'enemies', [status('poison', 0.3)], 'poison', { msg: '{user}は どくの ほうしを まきちらした！' }),
    en_confuse_spore: act('まどわしのほうし', 'enemies', [status('confuse', 0.25)], 'confuse', { msg: '{user}は ふしぎな ほうしを まきちらした！' }),
    en_ink: act('すみをはく', 'enemies', [status('blind', 0.35)], 'blind', { msg: '{user}は まっくろな すみを はいた！' }),
    en_sand: act('すなぼこり', 'enemies', [status('blind', 0.3)], 'smoke', { msg: '{user}は すなぼこりを まきあげた！' }),
    en_sleep_song: act('ねむりのうた', 'enemies', [status('sleep', 0.3)], 'song', { msg: '{user}は ねむりを さそう うたを うたった！' }),
    en_curse: act('のろいのことば', 'enemy', [status('silence', 0.5)], 'silence', { msg: '{user}は のろいの ことばを つぶやいた！' }),
    en_riddle: act('なぞかけ', 'enemies', [status('confuse', 0.3)], 'confuse', { msg: '{user}は ふしぎな なぞを かけてきた！' }),
    en_whisper: act('しのささやき', 'enemy', [status('death', 0.15)], 'death', { msg: '{user}は しの ことばを ささやいた！' }),
    en_doom: act('しのせんこく', 'enemies', [status('death', 0.12)], 'death', { msg: '{user}は しの せんこくを くだした！' }),
    en_drain: act('きゅうけつ', 'enemy', [phys(0.9, { drain: 0.5 })], 'drain', { msg: '{user}は ちを すいとろうと かみついた！' }),
    en_life_suck: act('いのちすい', 'enemy', [magic(12, 0.45, 'dark', { drain: 0.6 })], 'drain', { msg: '{user}は いのちを すいとろうとした！' }),
    en_acid: act('とかすえき', 'enemy', [phys(0.8), buff('def', -1, 0.5)], 'poison', { msg: '{user}は ねばつく えきを はきかけた！' }),
    en_steal: act('ぬすみぐせ', 'enemy', [{ type: 'steal' }], 'steal', { msg: '{user}は すばやく ふところを ねらった！' }),
    en_intimidate: act('いかく', 'enemies', [buff('atk', -1, 0.45)], 'debuff', { msg: '{user}は おそろしい こえで いかくした！' }),
    en_gloom: act('ぜつぼうのかげ', 'enemies', [buff('atk', -1, 0.6), buff('def', -1, 0.6)], 'dark', { msg: '{user}は ぜつぼうの かげを ひろげた！' }),
    en_null_wave: act('むのはどう', 'enemies', [{ type: 'dispel' }], 'dispel', { msg: '{user}は すべてを うちけす はどうを はなった！' }),
    en_smoke: act('けむりだま', 'enemies', [status('blind', 0.4)], 'smoke', { msg: '{user}は けむりだまを なげつけた！' }),

    // --------------------------------------------------------- self / ally
    en_howl: act('むれのさけび', 'allies', [buff('atk', 1)], 'buff', { msg: '{user}は なかまを ふるいたたせる さけびを あげた！' }),
    en_shout: act('かけごえ', 'allies', [buff('atk', 1)], 'buff', { msg: '{user}は かけごえで てしたを ふるいたたせた！' }),
    en_focus: act('ちからこめ', 'self', [buff('atk', 2)], 'buff', { msg: '{user}は ちからを こめている！' }),
    en_harden: act('かたくなる', 'self', [buff('def', 2)], 'buff', { msg: '{user}の からだが かたくなった！' }),
    en_flame_armor: act('ほのおのよろい', 'self', [buff('def', 1), buff('mdef', 1)], 'fire', { msg: '{user}は ほのおを まとった！' }),
    en_herb: act('やくそうをかじる', 'self', [{ type: 'heal', pct: 0.2 }], 'heal', { msg: '{user}は やくそうを かじった！' }),
    en_regrow: act('さいせい', 'self', [{ type: 'heal', pct: 0.25 }], 'regen', { msg: '{user}の きずが みるみる ふさがっていく！' }),
    en_ancient_heal: act('いにしえのいのり', 'self', [{ type: 'heal', pct: 0.22 }], 'heal', { msg: '{user}は いにしえの いのりを ささげた！' }),
    en_star_heal: act('ほしのいやし', 'self', [{ type: 'heal', pct: 0.2 }], 'heal', { msg: '{user}は ほしの ひかりを あびた！' }),
    en_dark_heal: act('やみのいやし', 'self', [{ type: 'heal', pct: 0.18 }], 'dark', { msg: '{user}は やみを すいこんで きずを いやした！' }),

    // ---------------------------------------------------------------- spells
    en_fire: spell('ファイアボール', 2, 'enemy', [magic(10, 0.5, 'fire')], 'fire'),
    en_fire2: spell('かえんのうず', 6, 'group', [magic(8, 0.4, 'fire')], 'fire2'),
    en_blast: spell('ばくえん', 6, 'enemy', [magic(22, 0.7, 'fire')], 'explosion'),
    en_inferno: spell('インフェルノ', 14, 'enemies', [magic(22, 0.6, 'fire')], 'fire3'),
    en_ice: spell('アイスニードル', 3, 'enemy', [magic(12, 0.55, 'ice')], 'ice'),
    en_ice2: spell('アイスストーム', 6, 'group', [magic(10, 0.4, 'ice')], 'ice2'),
    en_ice3: spell('こおりのあらし', 14, 'enemies', [magic(26, 0.6, 'ice')], 'ice3'),
    en_thunder: spell('ライトニング', 3, 'enemy', [magic(12, 0.55, 'thunder')], 'thunder'),
    en_thunder2: spell('いかずちのあめ', 8, 'enemies', [magic(8, 0.4, 'thunder')], 'thunder2'),
    en_thunder3: spell('らいじんのいかり', 14, 'enemies', [magic(26, 0.6, 'thunder')], 'thunder3'),
    en_wind: spell('かまいたち', 3, 'group', [magic(8, 0.4, 'wind')], 'wind'),
    en_wind2: spell('たつまき', 8, 'enemies', [magic(18, 0.5, 'wind')], 'wind2'),
    en_water: spell('みずでっぽう', 3, 'enemy', [magic(12, 0.55, 'water')], 'water'),
    en_dark: spell('やみのたま', 4, 'enemy', [magic(16, 0.6, 'dark')], 'dark'),
    en_dark2: spell('やみのうず', 10, 'enemies', [magic(16, 0.5, 'dark')], 'dark2'),
    en_stardust: spell('ほしくずのつぶて', 8, 'random', [magic(10, 0.4, null, { hits: 4 })], 'magic2'),
    en_heal: spell('ヒール', 3, 'ally', [{ type: 'heal', power: 18, scale: 0.6 }], 'heal'),
    en_healing: spell('ヒーリング', 6, 'ally', [{ type: 'heal', power: 50, scale: 0.9 }], 'heal2'),
    en_heal_all: spell('いやしのわ', 8, 'allies', [{ type: 'heal', power: 30, scale: 0.5 }], 'heal2'),
    en_revive: spell('リバイブ', 12, 'ally_dead', [{ type: 'revive', pct: 0.5 }], 'revive'),
    en_protect: spell('まもりのいのり', 3, 'ally', [buff('def', 1)], 'buff'),
    en_slow: spell('げんそく', 5, 'enemies', [buff('agi', -1, 0.6)], 'debuff'),
    en_sleep: spell('ねむりのきり', 3, 'group', [status('sleep', 0.35)], 'sleep'),
    en_silence: spell('しじまのいのり', 3, 'group', [status('silence', 0.45)], 'silence'),
    en_confuse: spell('まどわしのかぜ', 5, 'group', [status('confuse', 0.3)], 'confuse'),
    en_poison_mist: spell('どくのきり', 4, 'group', [status('poison', 0.5)], 'poison'),
    en_blind: spell('くらやみのきり', 3, 'group', [status('blind', 0.45)], 'blind'),
    en_death: spell('たましいぬき', 10, 'enemy', [status('death', 0.25)], 'death'),
    en_mp_drain: spell('MPすいとり', 0, 'enemy', [magic(8, 0.15, null, { mp: true, drain: 1 })], 'mp'),

    // --------------------------------------------------------------- breaths
    en_breath_fire1: act('ひのこのいき', 'enemies', [breath(8, 'fire')], 'breath_fire', { msg: '{user}は ひのこを ふきかけた！' }),
    en_breath_fire2: act('ほのおのいき', 'enemies', [breath(20, 'fire')], 'breath_fire', { msg: '{user}は ほのおを はいた！' }),
    en_breath_fire3: act('もうかのいき', 'enemies', [breath(42, 'fire')], 'breath_fire', { msg: '{user}は もうれつな ほのおを はいた！' }),
    en_breath_fire4: act('れんごくのほのお', 'enemies', [breath(75, 'fire')], 'breath_fire', { msg: '{user}は れんごくの ほのおを はきだした！' }),
    en_breath_ice1: act('しものいき', 'enemies', [breath(10, 'ice')], 'breath_ice', { msg: '{user}は しもの いきを ふきかけた！' }),
    en_breath_ice2: act('ひょうけつのいき', 'enemies', [breath(28, 'ice')], 'breath_ice', { msg: '{user}は こおりつく いきを はいた！' }),
    en_breath_ice3: act('ふぶきのいき', 'enemies', [breath(55, 'ice')], 'breath_ice', { msg: '{user}は すさまじい ふぶきを はいた！' }),
    en_breath_poison: act('どくガス', 'enemies', [breath(6), status('poison', 0.4)], 'breath_poison', { msg: '{user}は どくガスを はきだした！' }),
    en_breath_dark: act('やみのいぶき', 'enemies', [breath(95, 'dark')], 'breath_dark', { msg: '{user}は やみの いぶきを はきだした！' }),

    // ------------------------------------------------------ boss signatures
    en_tsunami: act('つなみ', 'enemies', [magic(26, 0.5, 'water')], 'water3', { msg: '{user}は おおなみを よびおこした！' }),
    en_sandstorm: act('すなあらし', 'enemies', [magic(20, 0.45, 'earth'), status('blind', 0.25)], 'earth2', { msg: '{user}は すなあらしを まきおこした！' }),
    en_star_rain: act('ながれぼしのあめ', 'random', [magic(24, 0.5, null, { hits: 5 })], 'explosion2', { msg: '{user}は ながれぼしを ふらせた！' }),
    en_dark_thunder: act('やみのいかずち', 'enemies', [magic(60, 0.6, 'dark')], 'thunder3', { msg: '{user}は やみの いかずちを よびおこした！' }),
    en_despair: act('ぜつぼうのやみ', 'enemies', [magic(80, 0.65, 'dark')], 'dark3', { msg: '{user}は ぜつぼうの やみを ときはなった！' }),
    en_ruin_light: act('はかいのひかり', 'enemies', [magic(80, 0.6)], 'explosion3', { msg: '{user}は はかいの ひかりを はなった！' }),
    en_warp: act('じくうのゆがみ', 'enemies', [{ type: 'damage', formula: 'percent', power: 0.3 }], 'gravity', { msg: '{user}の まわりで じくうが ゆがんだ！' }),
  });
})(window.RPG);
