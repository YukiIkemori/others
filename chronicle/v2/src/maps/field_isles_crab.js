// 生成物（design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py → fit.py → tomap.py）。手で直さない: 配置は areas_isles.py、当たりは fit.py で作り直す。
// エリア i_crab「財宝ヤドカリの島」（貝がらの光る小島、40×30）。エリア切り替えのフィールド（maps/field_00_kit.js、諸島の凡例は field_isles_00_kit.js）。
//   出口: 
//   絵: field/under/i_crab（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("i_crab", {
    name: R.T('map.field_isles_crab.i_crab.name'), region: "r_isles", outside: "sea",
    legend: R.FieldArea.ISLE_LEGEND, theme: 'field', bgm: 'overworld', bbg: 'isles', propSet: 'isles', propSetBase: 'harbor',
    light: R.FieldArea.ISLE_LIGHT,
    rows: [
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~__________~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~___,,sssssss______~~~~~~~~~",
      "~~~~~~~~~~~~__,,,,sssssssssssss_~~~~~~~~",
      "~~~~~~~~~~__,,,,ss,ssssssTTsssss_~~~~~~~",
      "~~~~~~~~~_s,,,,,ssssssssssTsssss_~~~~~~~",
      "~~~~~~~~~_ss,s,,ss,sssssssrsssss_~~~~~~~",
      "~~~~~~~~_sssTT,,,,,sssssssssss,,,_~~~~~~",
      "~~~~~~~_ssssrs,,,,,,ssssssssss,,,_~~~~~~",
      "~~~~~~_ssssss,,,,,,,sssssssss,,TT,_~~~~~",
      "~~~~~~_sssssss,,,,,XXsssssss,,,,r,_~~~~~",
      "~~~~~~_ssssssss::::XXsssssss,,,srss_~~~~",
      "~~~===:::::::::::sss,sssssswsssssss_~~~~",
      "~~~=====ssssssssssssssssswwwww,sss_~~~~~",
      "~~~~~~~_s,ssssssssssssssswwwwwssss_~~~~~",
      "~~~~~~~~_,ssssssssssssssswwwwwsss_~~~~~~",
      "~~~~~~~~~_,sssTsssssssssssswwssss_~~~~~~",
      "~~~~~~~~~~_ssssTssssssssssssssss_~~~~~~~",
      "~~~~~~~~~~~_sssrsssss,Tssssssss_~~~~~~~~",
      "~~~~~~~~~~~~___rssssssrssssssss_~~~~~~~~",
      "~~~~~~~~~~~~~~~_ssssssrsssssss_~~~~~~~~~",
      "~~~~~~~~~~~~~~~~______________~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    ],
    objects: [
      {"type":"examine","x":19,"y":15,"event":"isles_crab_nest"},
      {"type":"examine","x":3,"y":16,"event":"isles_boat"},
      {"type":"chest","id":"i_crab_c1","x":30,"y":11,"pool":"p_T"},
    ],
    npcs: [

    ],
    spawns: {"boat":{"x":7,"y":15,"dir":"e"}},
    exits: [],
    triggers: [],
    tilePatches: [],
    zones: [{"rect":null,"zone":"zw_isles"}],
    art: {"image":"field/under/i_crab","painted":[],"overlay":"field/under/i_crab_over"},
    meta: {"sub":R.T('map.field_isles_crab.i_crab.meta.sub'),"worldRect":[676,530,40,30]},
    links: {},
  });
})(window.RPG);
