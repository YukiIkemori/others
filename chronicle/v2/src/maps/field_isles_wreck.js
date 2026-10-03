// 生成物（design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py → fit.py → tomap.py）。手で直さない: 配置は areas_isles.py、当たりは fit.py で作り直す。
// エリア i_wreck「座礁した商船」（岩礁に乗り上げた船、44×32）。エリア切り替えのフィールド（maps/field_00_kit.js、諸島の凡例は field_isles_00_kit.js）。
//   出口: 
//   絵: field/under/i_wreck（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("i_wreck", {
    name: R.T('map.field_isles_wreck.i_wreck.name'), region: "r_isles", outside: "sea",
    legend: R.FieldArea.ISLE_LEGEND, theme: 'field', bgm: 'sea', bbg: 'isles', propSet: 'isles', propSetBase: 'harbor',
    light: R.FieldArea.ISLE_LIGHT,
    rows: [
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~s~s~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~___________~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~_____rrrrrrrr___~~~~~~~~~~~~~~~~",
      "~~~~~~~_______rrrrrrrrrrrr____~~~~~~~~~~~~~~",
      "~~~~~~__rr__rrrrrrrrrrrrrrr_r______~~~~~~~~~",
      "~~~~~__rrrkrrrrrXXXXXXXXXXXXXr_rrr___~~~~~~~",
      "~~~~__rrrrrrXXXXXXXXXXXXXXXXXXXrrrr_____~~~~",
      "~~~~_krrrrXXXXXXXXXXXXXXXXXXXXXXXrrrrr___~~~",
      "~~~__rrrrXXXXXXXXXXXXXXXXXXXXXXXXXrrrrrk_~~~",
      "~~~_krkkXXXXXXXXXXXXXXXXXXXXXXXXXXXXXrrr___~",
      "~~__rsssrXXXXXXXXXXXXXXXXXXXXXXXXXXrrrrrr___",
      "~~_krssskrXXXXXXXXXXXXXXXXXXXXXXXrrrrrrrrr__",
      "~~~_rrsssrrXXXXXXXXXXXXXXXXXXXXXsrrrrrrrrrr_",
      "~~~_kksssrrrrrrXXXXXXXXXXXXXXXrsssrrrrrrrrr_",
      "~~~~__srrrrrrrrrrrrrrrrkssrrssssssrrrrrrrr__",
      "~~~~~__rrrrrrrrrssrrrs:sssssssk.rkrrrrrrrk__",
      "~~~~~~_krrrrrrrr.sssss:ssssssss.ssrrrrrr___~",
      "~~~~~~_krrrrrrrsssssss:rsssssssssssrrrr___~~",
      "~~~~~~_krrrrrrrsssssss:rrsssssss_XXXXX__~~~~",
      "~~~~~~~__krrrrrrrsssss:srssssss_______~~~~~~",
      "~~~~~~~~___kr__rrsrsrs:srrsssrr__~~~~~~~~~~~",
      "~~~~~~~~~~__________rk:srrskrr___~~~~~~~~~~~",
      "~~~~~~~~~~~___________:krkr_____~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~__==_______~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~==_~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    ],
    objects: [
      {"type":"examine","x":23,"y":17,"event":"isles_wreck"},
      {"type":"examine","x":23,"y":30,"event":"isles_boat"},
    ],
    npcs: [

    ],
    spawns: {"boat":{"x":22,"y":26,"dir":"n"}},
    exits: [],
    triggers: [],
    tilePatches: [],
    zones: [{"rect":null,"zone":"zw_isles"}],
    art: {"image":"field/under/i_wreck","painted":[]},
    meta: {"sub":R.T('map.field_isles_wreck.i_wreck.meta.sub'),"worldRect":[612,540,44,32]},
    links: {},
  });
})(window.RPG);
