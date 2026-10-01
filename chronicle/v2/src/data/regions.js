// CONTENT-P: 地方（R.DB.regions。V2_PLAN §2.4 の id、§3.1、WORLD_REDESIGN §1.3・§4、STORY_BIBLE §7）
//   {name, short, n, chapter:{title, summary}, page, town, dungeons, bossTroop, zone, beacon, slice?:'locked'}
//   name = 地方の名前（手がかり帳の見出し・地図）、short = フラグの <rs>、chapter = 年代記の章（summary は選択の前の基本の文。
//   森の選択で変わる文は CONTENT-F が書く）、page = 地方の解決で渡すページの大事な物（EVENTS の ev.clearRegion）、beacon = 大灯火の名前、beaconAt = 光の柱の場所 {map, x, y}（R.Tier.celebrate が読む）。
//   'prologue' は序章（ファロス半島）。章は「灯台守の歌」、ページも古層も持たない（STORY_BIBLE §9.1）。
(function (R) {
  'use strict';
  // beaconAt の world の場所は論理の座標 L（lx, ly。tools/gen_world*.js と同じ座標）。W の x, y は R.WorldXform.fill がデータの後処理で足す（WORLD v3）
  // beaconAt は ev.clearRegion を呼ぶ時に一行がいるマップに置く（R.Tier.celebrate はマップが同じ時だけ使う）。x, y はマス（小数でよい）で、
  // 柱の根元は (x + 0.5, y + 0.8) マスに落ちる: 灯す物の描いた見た目の中心 (vx, vy) なら x = vx − 0.5、y = vy − 0.8（tools/test_beacon.js）
  R.defs('regions', {
    prologue: {
      name: R.T('regions.prologue.name'), short: 'prologue', n: 0,
      chapter: { title: R.T('regions.prologue.chapter.title'), summary: R.T('regions.prologue.chapter.summary') },
      town: 'pharos', dungeons: ['lighthouse'], bossTroop: 'tr_b_pageeater', zone: 'zw_peninsula', beacon: R.T('regions.prologue.beacon'), beaconAt: { map: 'world', x: 319, y: 368.85 },   // ファロス灯台の灯室（ワールドの w_lighthouse の塔の上）。塔の上の段は帯のすき間で L の整数のマスでは指せないので W で書く。序章は clearRegion を通らない（柱は出ない）
    },
    r_forest: {
      name: R.T('regions.r_forest.name'), short: 'forest', n: 1,
      chapter: { title: R.T('regions.r_forest.chapter.title'), summary: R.T('regions.r_forest.chapter.summary') },
      page: 'k_page_forest', town: 'fern', dungeons: ['verda', 'elder'], bossTroop: 'tr_b_rooteater', zone: 'zw_forest', beacon: R.T('regions.r_forest.beacon'), beaconAt: { map: 'verda_1', x: 30, y: 22 },   // 解決は野営地（forest_finale が verda_1 へ移す）。こずえの歌の灯（beacon の物 (30, 23)）の火の籠
    },
    r_desert: {
      name: R.T('regions.r_desert.name'), short: 'desert', n: 2,
      chapter: { title: R.T('regions.r_desert.chapter.title'), summary: R.T('regions.r_desert.chapter.summary') },
      page: 'k_page_desert', town: 'kasim', dungeons: ['tomb'], bossTroop: 'tr_b_sandking', zone: 'zw_desert', beacon: R.T('regions.r_desert.beacon'), beaconAt: { map: 'desert_camp3', x: 13, y: 7 },   // 日輪の火（beacon の物 (13, 8)）の火の籠
    },
    r_snow: { name: R.T('regions.r_snow.name'), short: 'snow', n: 3, chapter: { title: R.T('regions.r_snow.chapter.title'), summary: R.T('regions.r_snow.chapter.summary') },
      page: 'k_page_snow', town: 'yule', dungeons: ['snow_woods', 'peak'], bossTroop: 'tr_b_whitedragon', zone: 'zw_snow', beacon: R.T('regions.r_snow.beacon'), beaconAt: { map: 'peak_top', x: 20, y: 6 } },   // 雪原は開いた（snow_*.js）。解決は頂（snow_finale）。冬至の火（beacon の物 (20, 7)）の火の籠
    r_marsh: { name: R.T('regions.r_marsh.name'), short: 'marsh', n: 4, chapter: { title: R.T('regions.r_marsh.chapter.title'), summary: R.T('regions.r_marsh.chapter.summary') },
      page: 'k_page_marsh', town: 'loch', dungeons: ['manor', 'bog'], bossTroop: 'tr_b_mistbeast', zone: 'zw_marsh', beacon: R.T('regions.r_marsh.beacon'), beaconAt: { map: 'marsh_bog', x: 30.35, y: 4.95 } },   // 湿原は開いた（marsh_*.js）。解決は沼のまん中（bog_mistbeast → marsh_finale）。柱は北の沈んだ鐘楼の頭（三つ目の鐘）の鐘
    r_isles: { name: R.T('regions.r_isles.name'), short: 'isles', n: 5, chapter: { title: R.T('regions.r_isles.chapter.title'), summary: R.T('regions.r_isles.chapter.summary') },
      page: 'k_page_isles', town: 'coral', dungeons: ['tidecave', 'ghostship'], bossTroop: 'tr_b_captain', zone: 'zw_isles', beacon: R.T('regions.r_isles.beacon'), beaconAt: { map: 'nerei', x: 20.95, y: 1.8 }, slice: 'locked' },   // 諸島は作った（isles_*.js）。解決はネレイの桟橋（isles_dawn）。柱は岬の石の灯（マリナが灯し、沖の灯台島と呼びあう灯）の灯の窓。体験版の錠は持ち主の決まりで残す（slice: 'locked'）
    r_mine: { name: R.T('regions.r_mine.name'), short: 'mine', n: 6, chapter: { title: R.T('regions.r_mine.chapter.title'), summary: R.T('regions.r_mine.chapter.summary') },
      page: 'k_page_mine', town: 'dovan', dungeons: ['deepmine'], bossTroop: 'tr_b_ironwarden', zone: 'zw_mine', beacon: R.T('regions.r_mine.beacon'), beaconAt: { map: 'dovan', x: 21.7, y: 4.85 }, slice: 'locked' },   // 山地は作った（mine_*.js・field_mine_*.js）。柱は誓いの碑（描いた石の板）の金床の紋。体験版の錠は持ち主の決まりで残す（slice: 'locked'）
    r_ash: { name: R.T('regions.r_ash.name'), short: 'ash', n: 7, chapter: { title: R.T('regions.r_ash.chapter.title'), summary: R.T('regions.r_ash.chapter.summary') },
      page: 'k_page_ash', town: 'caldera', dungeons: ['volcano'], bossTroop: 'tr_b_lavabeast', zone: 'zw_ash_plain', beacon: R.T('regions.r_ash.beacon'), beaconAt: { map: 'ash_volcano_2', x: 21.15, y: 16.4 } },   // 灰の荒野は開いた（ash_*.js）。光の柱は火口の卵の上（大灯火は火口で灯る）
    r_star: { name: R.T('regions.r_star.name'), short: 'star', n: 8, chapter: { title: R.T('regions.r_star.chapter.title'), summary: R.T('regions.r_star.chapter.summary') }, page: 'k_page_star', town: 'orbis',
      dungeons: ['academy', 'startower'], bossTroop: 'tr_b_stareater', zone: 'zw_star', beacon: R.T('regions.r_star.beacon'), beaconAt: { map: 'orbis', x: 28.9, y: 29.1 }, slice: 'locked' },   // 高原は作った（star_*.js・field_star_*.js）。解決はオルビスの広場（star_dawn）。柱は星の噴水の天球儀。体験版の錠は持ち主の決まりで残す（slice: 'locked'）
    world: { name: R.T('regions.world.name'), short: 'world', n: 9, chapter: { title: '', summary: '' } },
  });
})(window.RPG);
