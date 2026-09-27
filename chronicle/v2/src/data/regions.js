// CONTENT-P: 地方（R.DB.regions。V2_PLAN §2.4 の id、§3.1、WORLD_REDESIGN §1.3・§4、STORY_BIBLE §7）
//   {name, short, n, chapter:{title, summary}, page, town, dungeons, bossTroop, zone, beacon, slice?:'locked'}
//   name = 地方の名前（手がかり帳の見出し・地図）、short = フラグの <rs>、chapter = 年代記の章（summary は選択の前の基本の文。
//   森の選択で変わる文は CONTENT-F が書く）、page = 地方の解決で渡すページの大事な物（EVENTS の ev.clearRegion）、beacon = 大灯火の名前、beaconAt = 光の柱の場所 {map, x, y}（R.Tier.celebrate が読む）。
//   'prologue' は序章（ファロス半島）。章は「灯台守の歌」、ページも古層も持たない（STORY_BIBLE §9.1）。
(function (R) {
  'use strict';
  R.defs('regions', {
    prologue: {
      name: 'ファロス半島', short: 'prologue', n: 0,
      chapter: { title: '灯台守の歌', summary: '言葉を失った灯台に、\n語り部の見習いが\n守り歌を取り戻した。\n夜の世界で最初の灯りが、\n海を照らした。' },
      town: 'pharos', dungeons: ['lighthouse'], bossTroop: 'tr_b_pageeater', zone: 'zw_peninsula', beacon: 'ファロス灯台', beaconAt: { map: 'world', x: 106, y: 120 },
    },
    r_forest: {
      name: 'ヴェルダの森', short: 'forest', n: 1,
      chapter: { title: '千年樹の歌', summary: '歌を忘れた森は\n人を迷わせた。\n語り部が歌をつなぐと、\n森の主は目を覚まし、\nこずえに歌の灯がともった。' },
      page: 'k_page_forest', town: 'fern', dungeons: ['verda', 'elder'], bossTroop: 'tr_b_rooteater', zone: 'zw_forest', beacon: '千年樹の歌の灯', beaconAt: { map: 'world', x: 24, y: 82 },
    },
    r_desert: {
      name: 'ザハラ砂漠', short: 'desert', n: 2,
      chapter: { title: '名を売った王', summary: '泉が枯れ、隊商は\n出られなくなった。\n語り部が王の名を取り戻すと、\n古い泉の底に\n日輪の火がともった。' },
      page: 'k_page_desert', town: 'kasim', dungeons: ['tomb'], bossTroop: 'tr_b_sandking', zone: 'zw_desert', beacon: '日輪の火', beaconAt: { map: 'desert_camp3', x: 13, y: 8 },
    },
    r_snow: { name: 'ノルデン雪原', short: 'snow', n: 3, chapter: { title: '白竜と冬至の火', summary: '吹雪のやまない冬至に、\nユールの人々は大火祭を開き、\n氷の狼から村を守った。\n冬至の火が峰に届き、\n白竜の心がとけた。' },
      page: 'k_page_snow', town: 'yule', dungeons: ['snow_woods', 'peak'], bossTroop: 'tr_b_whitedragon', zone: 'zw_snow', beacon: '冬至の火', beaconAt: { map: 'world', x: 62, y: 5 } },   // 雪原は開いた（snow_*.js）
    r_marsh: { name: 'グレイモア湿原', short: 'marsh', n: 4, chapter: { title: '霧の魔女と七つの鐘', summary: '' }, page: 'k_page_marsh', town: 'loch', beacon: '七つの鐘楼の灯', slice: 'locked' },
    r_isles: { name: 'マレア諸島', short: 'isles', n: 5, chapter: { title: '帰らずの船長', summary: '' }, page: 'k_page_isles', town: 'coral', beacon: '帰らずの灯', slice: 'locked' },
    r_mine: { name: 'ガルド山地', short: 'mine', n: 6, chapter: { title: '鍛冶神の誓い', summary: '' }, page: 'k_page_mine', town: 'dovan', beacon: '鍛冶神の炉', slice: 'locked' },
    r_ash: { name: '灰の荒野', short: 'ash', n: 7, chapter: { title: '火の鳥の眠る山', summary: '' }, page: 'k_page_ash', town: 'caldera', beacon: '火の鳥', slice: 'locked' },
    r_star: { name: 'オルビス高原', short: 'star', n: 8, chapter: { title: '星を数えた賢者', summary: '' }, page: 'k_page_star', town: 'orbis', beacon: '星', slice: 'locked' },
    world: { name: '世界のうわさ', short: 'world', n: 9, chapter: { title: '', summary: '' } },
  });
})(window.RPG);
