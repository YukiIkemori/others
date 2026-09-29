// CONTENT-P: 地方（R.DB.regions。V2_PLAN §2.4 の id、§3.1、WORLD_REDESIGN §1.3・§4、STORY_BIBLE §7）
//   {name, short, n, chapter:{title, summary}, page, town, dungeons, bossTroop, zone, beacon, slice?:'locked'}
//   name = 地方の名前（手がかり帳の見出し・地図）、short = フラグの <rs>、chapter = 年代記の章（summary は選択の前の基本の文。
//   森の選択で変わる文は CONTENT-F が書く）、page = 地方の解決で渡すページの大事な物（EVENTS の ev.clearRegion）、beacon = 大灯火の名前、beaconAt = 光の柱の場所 {map, x, y}（R.Tier.celebrate が読む）。
//   'prologue' は序章（ファロス半島）。章は「灯台守の歌」、ページも古層も持たない（STORY_BIBLE §9.1）。
(function (R) {
  'use strict';
  // beaconAt の world の場所は論理の座標 L（lx, ly。tools/gen_world*.js と同じ座標）。W の x, y は R.WorldXform.fill がデータの後処理で足す（WORLD v3）
  R.defs('regions', {
    prologue: {
      name: R.T('regions.prologue.name'), short: 'prologue', n: 0,
      chapter: { title: R.T('regions.prologue.chapter.title'), summary: R.T('regions.prologue.chapter.summary') },
      town: 'pharos', dungeons: ['lighthouse'], bossTroop: 'tr_b_pageeater', zone: 'zw_peninsula', beacon: R.T('regions.prologue.beacon'), beaconAt: { map: 'world', lx: 106, ly: 120 },
    },
    r_forest: {
      name: R.T('regions.r_forest.name'), short: 'forest', n: 1,
      chapter: { title: R.T('regions.r_forest.chapter.title'), summary: R.T('regions.r_forest.chapter.summary') },
      page: 'k_page_forest', town: 'fern', dungeons: ['verda', 'elder'], bossTroop: 'tr_b_rooteater', zone: 'zw_forest', beacon: R.T('regions.r_forest.beacon'), beaconAt: { map: 'world', lx: 24, ly: 82 },
    },
    r_desert: {
      name: R.T('regions.r_desert.name'), short: 'desert', n: 2,
      chapter: { title: R.T('regions.r_desert.chapter.title'), summary: R.T('regions.r_desert.chapter.summary') },
      page: 'k_page_desert', town: 'kasim', dungeons: ['tomb'], bossTroop: 'tr_b_sandking', zone: 'zw_desert', beacon: R.T('regions.r_desert.beacon'), beaconAt: { map: 'desert_camp3', x: 13, y: 8 },
    },
    r_snow: { name: R.T('regions.r_snow.name'), short: 'snow', n: 3, chapter: { title: R.T('regions.r_snow.chapter.title'), summary: R.T('regions.r_snow.chapter.summary') },
      page: 'k_page_snow', town: 'yule', dungeons: ['snow_woods', 'peak'], bossTroop: 'tr_b_whitedragon', zone: 'zw_snow', beacon: R.T('regions.r_snow.beacon'), beaconAt: { map: 'world', lx: 62, ly: 5 } },   // 雪原は開いた（snow_*.js）
    r_marsh: { name: R.T('regions.r_marsh.name'), short: 'marsh', n: 4, chapter: { title: R.T('regions.r_marsh.chapter.title'), summary: R.T('regions.r_marsh.chapter.summary') },
      page: 'k_page_marsh', town: 'loch', dungeons: ['manor', 'bog'], bossTroop: 'tr_b_mistbeast', zone: 'zw_marsh', beacon: R.T('regions.r_marsh.beacon'), beaconAt: { map: 'world', lx: 183, ly: 69 } },   // 湿原は開いた（marsh_*.js）
    r_isles: { name: R.T('regions.r_isles.name'), short: 'isles', n: 5, chapter: { title: R.T('regions.r_isles.chapter.title'), summary: '' }, page: 'k_page_isles', town: 'coral', beacon: R.T('regions.r_isles.beacon'), slice: 'locked' },
    r_mine: { name: R.T('regions.r_mine.name'), short: 'mine', n: 6, chapter: { title: R.T('regions.r_mine.chapter.title'), summary: '' }, page: 'k_page_mine', town: 'dovan', beacon: R.T('regions.r_mine.beacon'), slice: 'locked' },
    r_ash: { name: R.T('regions.r_ash.name'), short: 'ash', n: 7, chapter: { title: R.T('regions.r_ash.chapter.title'), summary: R.T('regions.r_ash.chapter.summary') },
      page: 'k_page_ash', town: 'caldera', dungeons: ['volcano'], bossTroop: 'tr_b_lavabeast', zone: 'zw_ash_plain', beacon: R.T('regions.r_ash.beacon'), beaconAt: { map: 'world', x: 193, y: 136 } },   // 灰の荒野は開いた（ash_*.js）
    r_star: { name: R.T('regions.r_star.name'), short: 'star', n: 8, chapter: { title: R.T('regions.r_star.chapter.title'), summary: '' }, page: 'k_page_star', town: 'orbis', beacon: R.T('regions.r_star.beacon'), slice: 'locked' },
    world: { name: R.T('regions.world.name'), short: 'world', n: 9, chapter: { title: '', summary: '' } },
  });
})(window.RPG);
