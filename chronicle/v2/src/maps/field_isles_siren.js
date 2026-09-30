// 生成物（design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py → fit.py → tomap.py）。手で直さない: 配置は areas_isles.py、当たりは fit.py で作り直す。
// エリア i_siren「人魚の歌う岩」（風が歌う岩の小島、36×28）。エリア切り替えのフィールド（maps/field_00_kit.js、諸島の凡例は field_isles_00_kit.js）。
//   出口: 
//   絵: field/under/i_siren（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("i_siren", {
    name: "人魚の歌う岩", region: "r_isles", outside: "sea",
    legend: R.FieldArea.ISLE_LEGEND, theme: 'field', bgm: 'overworld', bbg: 'isles', propSet: 'isles', propSetBase: 'harbor',
    light: R.FieldArea.ISLE_LIGHT,
    rows: [
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~________~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~__ssssssss__~~~~~~~~~~~~",
      "~~~~~~~~~~~_ss,,,,krrrr__~~~~~~~~~~~",
      "~~~~~~~~~~_sr,,,,,,rrrrss__~~~~~~~~~",
      "~~~~~~~~~~_s,,,,,,,kkkk,,s__~~~~~~~~",
      "~~~~~~~~~_s,,,,,,,,,,,,,,,ss_~~~~~~~",
      "~~~~~~~~_s,,,,,,XXX,,,,,,,,rr~~~~~~~",
      "~~~~~~~_s,,,,,,,XXX,,,,,,,,rs~~~~~~~",
      "~~~~~~_sr,,,,,,,XXX,,,,,,,,r_~~~~~~~",
      "~~~~~~_srr,,r,,,s:::,,,,s,,s_~~~~~~~",
      "~~~~~~_s,,rrrrrrrs,:::::::::::====~~",
      "~~~~~~_s,,rrrrrrrr,sssssssrs_=====~~",
      "~~~~~~_s,rrrrrrrrr,sssssssrs_~~~~~~~",
      "~~~~~~_srrrrrrrrrrssssssssrs_~~~~~~~",
      "~~~~~~~_srrrrrrrrrrsssssssrs_~~~~~~~",
      "~~~~~~~_ssssrrrrrrsssssskrs_~~~~~~~~",
      "~~~~~~~~____ssrrrrssssssr__~~~~~~~~~",
      "~~~~~~~~~~~~__ssrr,ssss___~~~~~~~~~~",
      "~~~~~~~~~~~~~~__rrss____~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~______~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    ],
    objects: [
      {"type":"examine","x":17,"y":13,"event":"isles_siren_rock"},
      {"type":"examine","x":33,"y":15,"event":"isles_boat"},
    ],
    npcs: [

    ],
    spawns: {"boat":{"x":29,"y":14,"dir":"w"}},
    exits: [],
    triggers: [],
    tilePatches: [],
    zones: [{"rect":null,"zone":"zw_isles"}],
    art: {"image":"field/under/i_siren","painted":[]},
    meta: {"sub":"風が歌う岩の小島","worldRect":[560,470,36,28]},
    links: {},
  });
})(window.RPG);
