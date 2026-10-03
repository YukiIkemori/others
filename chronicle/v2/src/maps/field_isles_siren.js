// 生成物（design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py → fit.py → tomap.py）。手で直さない: 配置は areas_isles.py、当たりは fit.py で作り直す。
// エリア i_siren「人魚の歌う岩」（風が歌う岩の小島、36×28）。エリア切り替えのフィールド（maps/field_00_kit.js、諸島の凡例は field_isles_00_kit.js）。
//   出口: 
//   絵: field/under/i_siren（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("i_siren", {
    name: R.T('map.field_isles_siren.i_siren.name'), region: "r_isles", outside: "sea",
    legend: R.FieldArea.ISLE_LEGEND, theme: 'field', bgm: 'sea', bbg: 'isles', propSet: 'isles', propSetBase: 'harbor',
    light: R.FieldArea.ISLE_LIGHT,
    rows: [
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~____~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~_________~~~~~~~~~~~~~~~",
      "~~~~~~~~_________rr_______~~~~~~~~~~",
      "~~~~~~~____rrrXXXXXXrr_____~~~~~~~~~",
      "~~~~~~___rrk,,XXXXXXkkr;;;__~~~~~~~~",
      "~~~~___rrkkk,,XXXXXXkk;;;;;__~~~~~~~",
      "~~~~__r,rrk,,,XXXXXXk;;;;;;;___~~~~~",
      "~~~~__r,rrr,,,XXXXXX,;;;;;;;;__~~~~~",
      "~~~__r,,r,,,,,XXXXXX,;;;;;;;;___~~~~",
      "~~~__r,,,,ww,,XXXXXX,,,;;;;,,r__~~~~",
      "~~~__r,kkkww,,XXXXXX,,,,,,,,,,r__~~~",
      "~~___r,kkkwwkk,,,:::::::,,,,,,,r__~~",
      "~~__r,,,\"\"kkkkkkk,,,,:::::::::====~~",
      "~~__r,,,\"kkkkkkkkk,,,,,wwkkk,=====~~",
      "~~__r,,,kkkkkkkkkk,,,,,ww,kk\"rr__~~~",
      "~~__r,kkkkkkwwkkkkk,,,,,,kkkr____~~~",
      "~~~__rrkkkkkwwksssssss,,,kkkr___~~~~",
      "~~~~___rrkkksssssssssssskkrrr__~~~~~",
      "~~~~~____rssssssssssssssskrrr__~~~~~",
      "~~~~~~_____ssssssssssssssssr__~~~~~~",
      "~~~~~~~~______ssssss__ssssr___~~~~~~",
      "~~~~~~~~~~__________________~~~~~~~~",
      "~~~~~~~~~~~~~~_____________~~~~~~~~~",
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
    art: {"image":"field/under/i_siren","painted":[],"overlay":"field/under/i_siren_over"},
    meta: {"sub":R.T('map.field_isles_siren.i_siren.meta.sub'),"worldRect":[570,450,36,28]},
    links: {},
  });
})(window.RPG);
