// 主人公のタイプ 5 つ（DB.heroTypes）と最初の持ち物の組（DB.starterKit）。担当 newgame（A6）。
// 正は DESIGN.md §5.2.10（表は §5.2.3〜§5.2.6）。数値の式は rules（R.Rules.newChar・aptitude・stats）。
//   heroTypes[id] = {name, desc, stats{6}, growth{hp,mp,wp}（S〜D）, apt{w,e}（S〜D。得意分野で上書きする前）,
//                    favorKind:'weapon'|'element'|'any', favorOptions, pairElement, defaultWeapon, startEquip,
//                    onFavor:{weapon:{techs,spells}, element:{techs,spells}}, row:'front'|'middle'|'auto'}
//   starterKit = {weapon, tech, spell（得意分野 → 初期の武器・入門技・1段の術）, pair（術師の組の属性）,
//                 prof（S 15・A 5）, heroNames（おまかせの名前 8 つ × 性別）, favorDesc（§5.2.5 の 1 行説明）}
(function (R) {
  'use strict';
  const A = (w, e) => ({
    w: { sword: w[0], greatsword: w[1], dagger: w[2], axe: w[3], spear: w[4], bow: w[5], club: w[6], staff: w[7], katana: w[8], fist: w[9], whip: w[10] },
    e: { fire: e[0], water: e[1], wind: e[2], earth: e[3], light: e[4], dark: e[5] },
  });
  const ST = (s) => ({ str: s[0], vit: s[1], dex: s[2], agi: s[3], int: s[4], mnd: s[5] });
  const GR = (g) => ({ hp: g[0], mp: g[1], wp: g[2] });
  const ALLW = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
  const ALLE = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const none = { techs: [], spells: [] };
  Object.assign(R.DB.heroTypes, {
    warrior: {
      name: '戦士', desc: '腕力と体力にすぐれ、前に立って戦う。\n得意な武器を1つ選べる。',
      stats: ST([52, 46, 30, 26, 16, 30]), growth: GR('ACB'), apt: A('BBCBBCBDBBC', 'BCCBCC'),
      favorKind: 'weapon', favorOptions: { weapon: ['sword', 'greatsword', 'axe', 'spear', 'club', 'katana', 'fist'] },
      pairElement: false, defaultWeapon: 'w_sword_iron',
      startEquip: { body: 'bd_iron_cuirass', head: 'hd_iron_band', shield: 'sh_iron_buckler' },
      onFavor: { weapon: none, element: none }, row: 'front',
    },
    ranger: {
      name: '狩人', desc: '器用さと素早さで、急所をねらう。\n得意な武器を1つ選べる。',
      stats: ST([28, 30, 54, 46, 18, 24]), growth: GR('BCA'), apt: A('CDBCBBCCBBB', 'CCACCB'),
      favorKind: 'weapon', favorOptions: { weapon: ['dagger', 'spear', 'bow', 'katana', 'fist', 'whip'] },
      pairElement: false, defaultWeapon: 'w_dagger_iron',
      startEquip: { body: 'bd_leather_vest', head: 'hd_leather_cap', shield: 'sh_leather' },
      onFavor: { weapon: none, element: none }, row: 'auto',
    },
    mage: {
      name: '術師', desc: '知力と精神にすぐれ、術で戦う。\n得意な属性を1つ選べる。',
      stats: ST([14, 24, 30, 32, 58, 42]), growth: GR('CSC'), apt: A('BDBDCBBACCB', 'CCCCCC'),
      favorKind: 'element', favorOptions: { element: ALLE },
      pairElement: true, defaultWeapon: 'w_staff_novice',
      startEquip: { body: 'bd_hemp_robe', head: 'hd_wool_hood', shield: 'sh_primer' },
      onFavor: { weapon: none, element: { techs: ['t_staff_mind'], spells: [] } }, row: 'middle',
    },
    spellblade: {
      name: '術剣士', desc: '武器と術の両方をこなす。\n得意な武器か属性を1つ選べる。',
      stats: ST([42, 36, 30, 28, 42, 22]), growth: GR('BBB'), apt: A('BCBCBCCBBDC', 'BCBCBC'),
      favorKind: 'any', favorOptions: { weapon: ['sword', 'greatsword', 'spear', 'staff', 'katana'], element: ALLE },
      pairElement: false, defaultWeapon: 'w_sword_iron',
      startEquip: { body: 'bd_iron_cuirass', head: 'hd_leather_cap', shield: 'sh_iron_buckler' },
      onFavor: { weapon: { techs: [], spells: ['s_fire_1'] }, element: { techs: ['t_sword_stepcut'], spells: [] } }, row: 'front',
    },
    wanderer: {
      name: '旅人', desc: 'どの能力も平均的で、何でもこなす。\n得意な武器か属性を1つ選べる。',
      stats: ST([34, 34, 34, 33, 33, 32]), growth: GR('BBB'), apt: A('BCBCBBCCCCC', 'CBBCBC'),
      favorKind: 'any', favorOptions: { weapon: ALLW, element: ALLE },
      pairElement: false, defaultWeapon: 'w_dagger_iron',
      startEquip: { body: 'bd_leather_vest', head: 'hd_leather_cap', shield: 'sh_leather' },
      onFavor: { weapon: none, element: none }, row: 'auto',
    },
  });
  // 初期装備・入門技・1段の術・熟練度・名前の候補（herotypes.js が登録する。ns.js に無いので自分で作る）
  Object.assign(R.DB.starterKit = R.DB.starterKit || {}, {
    weapon: { sword: 'w_sword_iron', greatsword: 'w_greatsword_iron', dagger: 'w_dagger_iron', axe: 'w_axe_hand', spear: 'w_spear_iron',
      bow: 'w_bow_short', club: 'w_club_wood', staff: 'w_staff_novice', katana: 'w_katana_uchi', fist: 'w_fist_leather', whip: 'w_whip_leather' },
    tech: { sword: 't_sword_stepcut', greatsword: 't_greatsword_overhead', dagger: 't_dagger_vital', axe: 't_axe_cleave', spear: 't_spear_upthrust',
      bow: 't_bow_rapid', club: 't_club_smash', staff: 't_staff_mind', katana: 't_katana_draw', fist: 't_fist_palm', whip: 't_whip_trip' },
    spell: { fire: 's_fire_1', water: 's_water_1', wind: 's_wind_1', earth: 's_earth_1', light: 's_light_1', dark: 's_dark_1' },
    pair: { fire: 'wind', wind: 'fire', water: 'light', light: 'water', earth: 'dark', dark: 'earth' },
    prof: { S: 15, A: 5 },
    heroNames: {
      m: ['アルン', 'ラーク', 'ハルト', 'カミル', 'ニール', 'ベイル', 'ロイス', 'オルト'],
      f: ['リーネ', 'コトハ', 'エルナ', 'オリエ', 'マリカ', 'ルチア', 'アンナ', 'ミーシャ'],
    },
    // 得意分野を選ぶ画面の下の窓に出す 1 行説明（§5.2.5。1 行 20 字まで）
    favorDesc: {
      sword: '片手持ち。盾と合わせて攻守に強い。',
      greatsword: '両手持ち。重い一撃で敵をなぎ倒す。',
      dagger: '器用さで戦う。会心が出やすい。',
      axe: '命中は低いが、一撃の威力が高い。',
      spear: '両手持ち。後列からでも届く。',
      bow: '両手持ち。後列から確実に射る。',
      club: '打撃で、硬い敵や骨の敵に強い。',
      staff: '術の威力を高める。杖の技は術に近い。',
      katana: '腕力と器用さで戦う。会心が出やすい。',
      fist: '拳で戦う。腕力と素早さが大事。',
      whip: '後列から届き、敵の動きを乱す。',
      fire: '威力の高い攻めの術と、やけど。',
      water: '再生と治療。風と合わせて凍らせる。',
      wind: '素早さを上げ、何度も当たる術。沈黙。',
      earth: '守りを固める術と、気絶・毒。',
      light: '回復と生き返り。不死や魔族に強い。',
      dark: '吸収と弱体。眠り・混乱・即死。',
    },
  });
})(window.RPG);
