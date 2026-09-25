// Random encounter tables (DESIGN §5.7, zone ids of §7.4). lv = the party level
// band the zone is meant for; bg = backdrop when the map gives none (world maps use
// the tile's backdrop). Each group: ≤ 3 species, ≤ 8 monsters, ≤ 4 large; groups
// are also kept narrow enough to stand side by side on the 256 px battle line.
// The metal jelly (鋼ゼリー) shows up from the desert on, the gold one on the
// demon island; mimics lurk in the fort, the pyramid, the tower and the castle.
(function (R) {
  'use strict';

  // g(w, [id, min, max], ...)
  const g = (w, ...mons) => ({ w, mons });
  const Z = (lv, bg, groups) => ({ lv, bg, groups });

  Object.assign(R.DB.encounters, {
    // ------------------------------------------------ start continent
    w_start: Z([1, 4], 'grass', [
      g(10, ['puchi_jelly', 2, 4]),
      g(8, ['chibi_bat', 2, 3]),
      g(8, ['puchi_jelly', 1, 2], ['chibi_bat', 1, 2]),
      g(8, ['kajiri_rat', 1, 3]),
      g(7, ['kusa_hebi', 1, 2]),
      g(6, ['warai_take', 1, 2], ['puchi_jelly', 1, 2]),
      g(5, ['goblin', 1, 2]),
      g(5, ['hari_bachi', 2, 3]),
    ]),
    d_wind1: Z([3, 5], 'cave', [
      g(8, ['hora_bat', 2, 3]),
      g(8, ['iwa_jelly', 1, 2], ['hora_bat', 1, 2]),
      g(7, ['kaze_kodama', 2, 3]),
      g(6, ['goblin', 2, 3]),
      g(6, ['doku_take', 1, 2], ['goblin', 1, 1]),
      g(5, ['kaze_kodama', 1, 2], ['iwa_jelly', 1, 1]),
    ]),
    d_wind2: Z([4, 6], 'cave', [
      g(8, ['hob_goblin', 1, 2], ['goblin', 1, 2]),
      g(7, ['koakuma', 2, 3]),
      g(7, ['kaze_kodama', 2, 2], ['doku_take', 1, 2]),
      g(6, ['iwa_jelly', 2, 3]),
      g(6, ['hora_bat', 2, 3], ['koakuma', 1, 1]),
      g(5, ['hob_goblin', 2, 3]),
    ]),

    // ------------------------------------------------ east region
    w_east: Z([6, 9], 'grass', [
      g(8, ['nora_wolf', 2, 3]),
      g(7, ['shizuku_jelly', 1, 2], ['nora_wolf', 1, 2]),
      g(7, ['kuitsuki_sou', 1, 2]),
      g(7, ['kuma_bachi', 2, 3]),
      g(6, ['madara_hebi', 1, 2], ['kuma_bachi', 1, 1]),
      g(5, ['koakuma', 2, 3]),
      g(5, ['orc', 1, 1]),
      g(4, ['orc', 1, 1], ['nora_wolf', 1, 2]),
    ]),
    d_fort1: Z([7, 10], 'fort', [
      g(8, ['banken', 2, 3]),
      g(7, ['dobu_nezumi', 2, 4]),
      g(7, ['hob_goblin', 2, 3]),
      g(6, ['sabi_yoroi', 1, 2]),
      g(6, ['yatoware_madoushi', 1, 2], ['banken', 1, 2]),
      g(4, ['orc', 1, 1], ['hob_goblin', 1, 2]),
    ]),
    d_fort2: Z([8, 11], 'fort', [
      g(8, ['sabi_yoroi', 2, 2]),
      g(7, ['yatoware_madoushi', 2, 2], ['sabi_yoroi', 1, 1]),
      g(7, ['banken', 2, 2], ['dobu_nezumi', 1, 2]),
      g(6, ['orc', 1, 2]),
      g(5, ['hob_goblin', 2, 2], ['yatoware_madoushi', 1, 1]),
      g(3, ['takara_modoki', 1, 1]),
      g(2, ['takara_modoki', 1, 1], ['dobu_nezumi', 2, 2]),
    ]),

    // ------------------------------------------------ first sea, forest, water cave
    w_sea1: Z([10, 13], 'sea', [
      g(8, ['umi_jelly', 2, 4]),
      g(7, ['oobasami', 1, 3]),
      g(7, ['gyojin_hei', 1, 2], ['umi_jelly', 1, 2]),
      g(6, ['umi_hebi', 2, 3]),
      g(5, ['oodako', 1, 1], ['umi_jelly', 1, 2]),
      g(4, ['gyojin_hei', 2, 2], ['oobasami', 1, 1]),
    ]),
    w_forest: Z([11, 14], 'forest', [
      g(8, ['mori_ookami', 2, 3]),
      g(7, ['madowashi_take', 2, 3]),
      g(7, ['harpy', 1, 3]),
      g(6, ['doku_bana', 1, 2], ['madowashi_take', 1, 1]),
      g(6, ['kitsunebi', 2, 3]),
      g(5, ['harpy', 1, 1], ['mori_ookami', 2, 2]),
    ]),
    d_water1: Z([12, 15], 'watercave', [
      g(8, ['lizardman', 2, 3]),
      g(7, ['iwa_gani', 2, 3]),
      g(7, ['mizu_bourei', 2, 3]),
      g(6, ['umi_jelly', 2, 3], ['gyojin_hei', 1, 1]),
      g(5, ['doku_mizuchi', 1, 2], ['umi_hebi', 1, 1]),
    ]),
    d_water2: Z([13, 16], 'watercave', [
      g(8, ['lizardman', 2, 2], ['mizu_bourei', 1, 1]),
      g(7, ['doku_mizuchi', 2, 3]),
      g(6, ['iwa_gani', 2, 2], ['lizardman', 1, 1]),
      g(6, ['mizu_bourei', 2, 3], ['umi_jelly', 1, 1]),
      g(5, ['gyojin_hei', 2, 3]),
      g(3, ['oodako', 1, 1], ['gyojin_hei', 1, 1]),
    ]),

    // ------------------------------------------------ desert & pyramid
    w_desert: Z([14, 17], 'desert', [
      g(8, ['suna_sasori', 2, 3]),
      g(7, ['togebouzu', 1, 3]),
      g(6, ['mummy', 1, 2], ['suna_sasori', 1, 1]),
      g(5, ['suna_mogura', 1, 1]),
      g(5, ['togebouzu', 1, 1], ['suna_sasori', 2, 2]),
      g(2, ['hagane_jelly', 1, 2]),
    ]),
    d_pyr1: Z([15, 17], 'pyramid', [
      g(8, ['skeleton', 2, 4]),
      g(7, ['mummy', 2, 3]),
      g(6, ['akuryou', 2, 3]),
      g(6, ['suna_sasori', 2, 2], ['skeleton', 1, 1]),
      g(2, ['hagane_jelly', 1, 2]),
    ]),
    d_pyr2: Z([16, 18], 'pyramid', [
      g(8, ['mummy', 1, 2], ['skeleton', 1, 2]),
      g(7, ['noroi_hitomi', 2, 3]),
      g(7, ['kuro_sasori', 2, 3]),
      g(6, ['akuryou', 2, 2], ['hakamori', 1, 1]),
      g(5, ['hakamori', 2, 2]),
      g(2, ['hagane_jelly', 1, 2]),
    ]),
    d_pyr3: Z([17, 19], 'pyramid', [
      g(8, ['hakamori', 1, 1], ['mummy', 2, 2]),
      g(7, ['kuro_sasori', 2, 2], ['noroi_hitomi', 1, 2]),
      g(6, ['skeleton', 3, 3]),
      g(6, ['akuryou', 2, 3], ['noroi_hitomi', 1, 1]),
      g(3, ['houmotsu_modoki', 1, 1]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),

    // ------------------------------------------------ northern sea, snow, ice cave
    w_sea2: Z([17, 20], 'sea', [
      g(8, ['hyouga_ni', 2, 3]),
      g(7, ['daiou_dako', 1, 1]),
      g(6, ['koori_jelly', 2, 3]),
      g(6, ['hyouga_ni', 1, 2], ['koori_jelly', 1, 2]),
      g(5, ['daiou_dako', 1, 1], ['hyouga_ni', 1, 1]),
    ]),
    w_snow: Z([18, 21], 'snow', [
      g(8, ['yukinko', 2, 3]),
      g(7, ['yuki_ookami', 2, 3]),
      g(7, ['koori_jelly', 2, 4]),
      g(6, ['yeti', 1, 1]),
      g(5, ['yeti', 1, 1], ['yukinko', 2, 2]),
      g(5, ['yuki_ookami', 2, 2], ['koori_jelly', 1, 1]),
      g(2, ['hagane_jelly', 1, 2]),
    ]),
    d_ice1: Z([19, 22], 'ice', [
      g(8, ['tsurara_koumori', 2, 4]),
      g(7, ['hyou_seirei', 1, 2]),
      g(7, ['koori_yoroi', 1, 2]),
      g(6, ['yuki_ookami', 2, 2], ['tsurara_koumori', 1, 1]),
      g(5, ['koori_jelly', 2, 2], ['hyou_seirei', 1, 1]),
      g(2, ['hagane_jelly', 1, 2]),
    ]),
    d_ice2: Z([20, 23], 'ice', [
      g(8, ['koori_yoroi', 2, 2]),
      g(7, ['fubuki_seirei', 2, 3]),
      g(6, ['hyouseki_hei', 1, 1]),
      g(6, ['hyou_seirei', 2, 2], ['tsurara_koumori', 1, 1]),
      g(5, ['hyouseki_hei', 1, 1], ['fubuki_seirei', 1, 2]),
      g(5, ['yeti', 1, 1], ['koori_yoroi', 1, 1]),
      g(2, ['hagane_jelly', 1, 2]),
    ]),

    // ------------------------------------------------ volcano
    w_volcano: Z([22, 25], 'volcano', [
      g(8, ['salamander', 1, 2]),
      g(7, ['magma_jelly', 2, 4]),
      g(6, ['wyvern', 1, 1]),
      g(6, ['magma_orc', 1, 1], ['magma_jelly', 1, 2]),
      g(5, ['hinoko_akuma', 2, 3]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),
    d_vol1: Z([23, 26], 'volcano', [
      g(8, ['hitokage_hei', 2, 3]),
      g(7, ['hinoko_akuma', 3, 4]),
      g(7, ['salamander', 2, 3]),
      g(6, ['magma_jelly', 2, 2], ['hitokage_hei', 1, 1]),
      g(5, ['onibi', 2, 3]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),
    d_vol2: Z([24, 27], 'volcano', [
      g(8, ['magma_golem', 1, 1]),
      g(7, ['onibi', 2, 2], ['hinoko_akuma', 1, 1]),
      g(7, ['hitokage_hei', 2, 2], ['salamander', 1, 1]),
      g(6, ['magma_orc', 1, 1], ['hitokage_hei', 1, 2]),
      g(5, ['magma_golem', 1, 1], ['onibi', 1, 2]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),

    // ------------------------------------------------ arcana & star tower
    w_arcana: Z([25, 28], 'grass', [
      g(8, ['kimaira', 1, 1]),
      g(7, ['arashi_harpy', 2, 3]),
      g(6, ['minotauros', 1, 1]),
      g(6, ['hiryuu', 1, 1]),
      g(5, ['arashi_harpy', 1, 2], ['kimaira', 1, 1]),
      g(5, ['minotauros', 1, 1], ['arashi_harpy', 1, 1]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),
    d_star1: Z([26, 28], 'tower', [
      g(8, ['gargoyle', 2, 4]),
      g(7, ['hoshi_hitomi', 2, 3]),
      g(6, ['nagareboshi', 2, 3]),
      g(6, ['gargoyle', 1, 1], ['hoshi_hitomi', 2, 2]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),
    d_star2: Z([27, 29], 'tower', [
      g(8, ['hoshi_madoushi', 1, 2], ['gargoyle', 1, 1]),
      g(7, ['nagareboshi', 2, 3], ['hoshi_hitomi', 1, 1]),
      g(7, ['gargoyle', 2, 3]),
      g(5, ['hoshi_banpei', 1, 2]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),
    d_star3: Z([28, 30], 'tower', [
      g(8, ['hoshi_banpei', 2, 2]),
      g(7, ['hoshi_madoushi', 2, 2], ['nagareboshi', 1, 1]),
      g(6, ['gargoyle', 2, 2], ['hoshi_banpei', 1, 1]),
      g(6, ['hoshi_hitomi', 2, 3], ['hoshi_madoushi', 1, 1]),
      g(3, ['hoshi_modoki', 1, 1]),
      g(2, ['hagane_jelly', 2, 3]),
    ]),
    d_star4: Z([29, 31], 'tower', [
      g(8, ['hoshi_banpei', 2, 2], ['hoshi_madoushi', 1, 1]),
      g(7, ['nagareboshi', 3, 3]),
      g(6, ['gargoyle', 2, 2], ['hoshi_hitomi', 2, 2]),
      g(5, ['hoshi_madoushi', 2, 2], ['hoshi_banpei', 1, 1]),
      g(3, ['hoshi_modoki', 1, 1], ['gargoyle', 1, 1]),
      g(2, ['hagane_jelly', 3, 4]),
    ]),

    // ------------------------------------------------ outer sea & demon island
    w_sea3: Z([28, 32], 'sea', [
      g(8, ['yoroi_gani', 2, 3]),
      g(7, ['kaijin_shougun', 1, 2]),
      g(6, ['fukami_nushi', 1, 1]),
      g(6, ['kaijin_shougun', 1, 1], ['yoroi_gani', 2, 2]),
      g(4, ['fukami_nushi', 1, 1], ['kaijin_shougun', 1, 1]),
    ]),
    w_demon: Z([31, 34], 'wasteland', [
      g(8, ['demon_hei', 2, 2]),
      g(7, ['jigoku_mushi', 1, 1], ['demon_hei', 1, 1]),
      g(6, ['yami_kimaira', 1, 2]),
      g(6, ['kuro_minotauros', 1, 1], ['yami_kimaira', 1, 1]),
      g(5, ['kuro_minotauros', 2, 2]),
      g(2, ['kogane_jelly', 1, 1]),
    ]),

    // ------------------------------------------------ demon castle
    d_demon1: Z([32, 34], 'demon', [
      g(8, ['yami_kenshi', 2, 3]),
      g(7, ['jigoku_bourei', 2, 3]),
      g(7, ['yami_kishi', 1, 2]),
      g(6, ['magan', 2, 2], ['yami_kenshi', 1, 1]),
      g(5, ['demon_hei', 1, 1], ['jigoku_bourei', 1, 1]),
      g(1, ['kogane_jelly', 1, 1]),
    ]),
    d_demon2: Z([33, 35], 'demon', [
      g(8, ['yami_kishi', 2, 2]),
      g(7, ['yami_shisai', 1, 1], ['yami_kenshi', 2, 2]),
      g(7, ['yami_gargoyle', 2, 3]),
      g(6, ['magan', 2, 3]),
      g(5, ['jigoku_bourei', 2, 2], ['yami_shisai', 1, 1]),
      g(1, ['kogane_jelly', 1, 2]),
    ]),
    d_demon3: Z([34, 36], 'demon', [
      g(8, ['kokuryuu', 1, 1]),
      g(7, ['yami_gargoyle', 2, 2], ['magan', 1, 1]),
      g(7, ['yami_shisai', 1, 1], ['yami_kishi', 2, 2]),
      g(6, ['yami_kenshi', 3, 3]),
      g(4, ['shi_no_hako', 1, 1]),
      g(1, ['kogane_jelly', 1, 2]),
    ]),
    d_demon4: Z([35, 37], 'castle', [
      g(8, ['madou_hei', 1, 1]),
      g(7, ['akuma_kishi', 1, 1], ['yami_kishi', 1, 1]),
      g(7, ['kokuryuu', 1, 1], ['yami_gargoyle', 1, 1]),
      g(6, ['yami_shisai', 2, 2]),
      g(4, ['shi_no_hako', 1, 1], ['magan', 1, 1]),
      g(1, ['kogane_jelly', 1, 2]),
    ]),
    d_demon5: Z([36, 40], 'demon', [
      g(8, ['akuma_kishi', 1, 1], ['yami_kenshi', 1, 2]),
      g(7, ['kokuryuu', 1, 1], ['magan', 1, 1]),
      g(7, ['yami_kishi', 2, 2], ['magan', 1, 1]),
      g(6, ['madou_hei', 1, 1], ['yami_shisai', 1, 1]),
      g(4, ['akuma_kishi', 2, 2]),
      g(4, ['shi_no_hako', 1, 1], ['yami_kenshi', 2, 2]),
      g(1, ['kogane_jelly', 2, 2]),
    ]),
  });
})(window.RPG);
