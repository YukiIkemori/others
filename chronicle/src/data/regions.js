// The eight regions of エルセリア (DESIGN §10.8.1). Owner: world (A18a).
//   R.DB.regions[id] = { name, chapter:{no, title, summary}, fragment, locations[], bossTroop, hint,
//                        short, n, town, dungeons[], zone }
// Engine-read fields (§3.3.15): name, chapter, fragment (the page key item handed out by
// ev.clearRegion), locations (town ids), bossTroop, hint. The extra fields are for tools and
// other areas: short = the <rs> name used in flags/objectives (forest …), n = the order N
// (= chapter.no, = the regionN_* file number), town = the town the party wakes up in after the
// clear (§10.8.0-3), dungeons = DB.locations ids of the region's dungeon entrances, zone = the
// region's world encounter zone (§10.5.7).
// The object's key order is the official order (N = 1..8). Chapter numbers shown in the
// chronicle are the clear order (R.Game.regionsCleared), not chapter.no (§10.4).
// Summaries are the §10.8 texts, re-broken to at most 12 full-width characters per line for the
// chronicle's right-hand panel (§11.7.10); the words are unchanged. Hints stay exactly as §10.8
// (2 lines, up to 14 characters): the prologue's P10 shows them two per message window.
(function (R) {
  'use strict';
  Object.assign(R.DB.regions, {
    r_forest: {
      name: 'ヴェルダの森', short: 'forest', n: 1,
      chapter: {
        no: 1, title: '千年樹の歌',
        summary: '千年前、森を焼く火から\n森を守った森の主\nエルムは、千年樹に宿って\n眠った。歌を忘れた森は\n人を迷わせ、千年樹は\n朽ちかけていた。\n語り部が歌をつなぐと、\n主は約束を思い出した。',
      },
      fragment: 'k_page_forest',
      locations: ['fern'], dungeons: ['verda_maze'], town: 'fern',
      bossTroop: 'tr_b_rooteater', zone: 'zw_forest',
      hint: '西のヴェルダの森で、\n木こりたちが帰ってこない。',
    },
    r_desert: {
      name: 'ザハラ砂漠', short: 'desert', n: 2,
      chapter: {
        no: 2, title: '名を売った王',
        summary: '大干ばつの年、ハザル王は\n自分の名を砂の精霊に\n差し出し、オアシスの水を\n得た。名を忘れられた王は\n墓から目覚めたが、\n語り部が名を呼ぶと、\n静かな眠りに戻った。',
      },
      fragment: 'k_page_desert',
      locations: ['kasim'], dungeons: ['sand_tomb'], town: 'kasim',
      bossTroop: 'tr_b_sandking', zone: 'zw_desert',
      hint: '南西のザハラ砂漠で、\n砂嵐がやまないという。',
    },
    r_snow: {
      name: 'ノルデン雪原', short: 'snow', n: 3,
      chapter: {
        no: 3, title: '白竜と冬至の火',
        summary: '白竜ネーヴェは吹雪を\n鎮めるかわりに、冬至の\n火と竜の物語を受け取って\nきた。物語が忘れられて\n火が消え、竜の心は\n凍りついた。語り部が\n火と物語を届けると、\n竜は目を覚ました。',
      },
      fragment: 'k_page_snow',
      locations: ['yule'], dungeons: ['frost_peak'], town: 'yule',
      bossTroop: 'tr_b_whitedragon', zone: 'zw_snow',
      hint: '北西のノルデン雪原で、\n春になっても吹雪がやまない。',
    },
    r_marsh: {
      name: 'グレイモア湿原', short: 'marsh', n: 4,
      chapter: {
        no: 4, title: '霧の魔女と七つの鐘',
        summary: '沼の霧から魔物があふれた\nとき、魔女メルダは七つの\n鐘を沈め、その音で霧を\n封じた。鐘の歌が\n忘れられ、霧は魔女の\n姿をまねて子どもたちを\nさらった。語り部が鐘を\n鳴らすと、霧は晴れた。',
      },
      fragment: 'k_page_marsh',
      locations: ['loch'], dungeons: ['mist_manor', 'bell_marsh'], town: 'loch',
      bossTroop: 'tr_b_mistbeast', zone: 'zw_marsh',
      hint: '東のグレイモア湿原で、\n霧の中に子どもが消える。',
    },
    r_isles: {
      name: 'マレア諸島', short: 'isles', n: 5,
      chapter: {
        no: 5, title: '帰らずの船長',
        summary: '六十年前、グレン船長は\n嵐の海へ仲間を救いに\n出て、帰らなかった。\n舟歌が忘れられると、\n船長の船は幽霊船となって\n船を岩礁へ誘った。\n待ち続けたマリナが\n歌うと、船長は約束を\n思い出した。',
      },
      fragment: 'k_page_isles',
      locations: ['coral', 'nerei'], dungeons: ['tide_cave'], town: 'coral',
      bossTroop: 'tr_b_captain', zone: 'zw_isles',
      hint: '南東のマレア諸島で、\n霧の夜に幽霊船が出る。',
    },
    r_mine: {
      name: 'ガルド山地', short: 'mine', n: 6,
      chapter: {
        no: 6, title: '鍛冶神の誓い',
        summary: '鍛冶神は山に火と鉄を\n与え、七の層より下を\n掘るなと誓わせた。\n誓いの歌が忘れられ、\n鉱夫たちは鉄の番人の\n眠りを破った。\n語り部が誓いを唱えると、\n番人はふたたび眠った。',
      },
      fragment: 'k_page_mine',
      locations: ['dovan'], dungeons: ['deep_mine'], town: 'dovan',
      bossTroop: 'tr_b_ironwarden', zone: 'zw_mine',
      hint: '北のガルド山地の鉱山で、\n鉱夫たちが閉じ込められた。',
    },
    r_ash: {
      name: '灰の荒野', short: 'ash', n: 7,
      chapter: {
        no: 7, title: '火の鳥の眠る山',
        summary: '火の鳥は百年ごとに\n灰となり、語り聞かされる\n物語で卵からよみがえる。\n物語が忘れられた百年目、\n卵はかえらず、山の火は\n溶岩の巨獣となった。\n語り部が語ると、火の鳥は\n空へ舞い上がった。',
      },
      fragment: 'k_page_ash',
      locations: ['caldera'], dungeons: ['ash_volcano'], town: 'caldera',
      bossTroop: 'tr_b_lavabeast', zone: 'zw_ash',
      hint: '南の灰の荒野で、\n火山の灰が降りやまない。',
    },
    r_star: {
      name: 'オルビス高原', short: 'star', n: 8,
      chapter: {
        no: 8, title: '星を数えた賢者',
        summary: '二百年前、海の向こうの\nアルカナから来た賢者\nカペラは、星読みの塔を\n建てて、夜空の星に\n名を付けた。\n名が忘れられると、星は\n空から消えた。語り部が\n星の名を読み上げると、\n夜空に星が戻った。',
      },
      fragment: 'k_page_star',
      locations: ['orbis'], dungeons: ['stargaze'], town: 'orbis',
      bossTroop: 'tr_b_stareater', zone: 'zw_star',
      hint: '北東のオルビス高原で、\n夜空から星が消えていく。',
    },
  });
})(window.RPG);
