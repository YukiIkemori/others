// 生成物（design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py → fit.py → tomap.py）。手で直さない: 配置は areas_isles.py、当たりは fit.py で作り直す。
// エリア i_wreck「座礁した商船」（岩礁に乗り上げた船、44×32）。エリア切り替えのフィールド（maps/field_00_kit.js、諸島の凡例は field_isles_00_kit.js）。
//   出口: 
//   絵: field/under/i_wreck（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("i_wreck", {
    name: R.T('map.field_isles_wreck.i_wreck.name'), region: "r_isles", outside: "sea",
    legend: R.FieldArea.ISLE_LEGEND, theme: 'field', bgm: 'overworld', bbg: 'isles', propSet: 'isles', propSetBase: 'harbor',
    light: R.FieldArea.ISLE_LIGHT,
    rows: [
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~s~~~~~~~ssssssss~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~sssssssss_______ss~~~~~~~~~~~",
      "~~~~~~~~~~~~~ss_________________sssss~~~~~~~",
      "~~~~~~~~~~~ss___kkkkkkk_sssssss_____ss~~~~~~",
      "~~~~~~~~~ss___kkkkkkkkkssssskrskkkkk_ss~~~~~",
      "~~~~~~~~s___kkkkkkkkkkkssssskkskkkkkk_s~~~~~",
      "~~~~~~~s__kkkkkkkkXXXXXXXXXXXrskkkkkk__s~~~~",
      "~~~~~~s__kkkkkkXXXXXXXXXXXXXXXXkkkkkkk_s~~~~",
      "~~~~~s__kkkkkkXXXXXXXXXXXXXXXXXXXkkkkk__~~~~",
      "~~~~~__skkkkkkXXXXXXXXXXXXXXXXXXkkkkkk__~~~~",
      "~~~~~__skkkkkkkkXXXXXXXXXXXXXXkksskrkk__~~~~",
      "~~~~s__skkkkkkkkkkkkXXXXXXXXsskkkkrrrk__~~~~",
      "~~~~__skkrrrkkkkkkkksssssssssskkkkkrkk__~~~~",
      "~~~~__skkrrkkkkkkkkkks:ssssssskkkkkkkk__~~~~",
      "~~~~~_skkkkkkksskkkkkkkksssskkkkkkkkkk__~~~~",
      "~~~~~~sskkkkkkssskkkkkkssssskkrkkkkkk__~~~~~",
      "~~~~~~~_skkkkkkkkkkkkkkssssskrrrkkkkk_~~~~~~",
      "~~~~~~~~__kkkkkkkkkkkkksssskkkkks_____~~~~~~",
      "~~~~~~~~~~~ssssssskkskkskskkk____~~~~~~~~~~~",
      "~~~~~~~~~~~__ssssssssk:kkkk___~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~_____s_sk:=___~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~____==__~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~_==~~~~~~~~~~~~~~~~~~~~",
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
