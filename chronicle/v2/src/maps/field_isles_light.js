// 生成物（design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py → fit.py → tomap.py）。手で直さない: 配置は areas_isles.py、当たりは fit.py で作り直す。
// エリア i_light「灯台島」（灯台守のいない灯台、40×32）。エリア切り替えのフィールド（maps/field_00_kit.js、諸島の凡例は field_isles_00_kit.js）。
//   出口: 門 → isles_lamproom.door
//   絵: field/under/i_light（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("i_light", {
    name: R.T('map.field_isles_light.i_light.name'), region: "r_isles", outside: "sea",
    legend: R.FieldArea.ISLE_LEGEND, theme: 'field', bgm: 'overworld', bbg: 'isles', propSet: 'isles', propSetBase: 'harbor',
    light: R.FieldArea.ISLE_LIGHT,
    rows: [
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~rrr~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~rrrrrrrrrrrrr~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~rrrrrrrrrrrrrr~~~~~~~~~~~",
      "~~~~~~~~~~~~~rrrrrrXXXXRRRRrrr~~~~~~~~~~",
      "~~~~~~~~~~~rrrrrrrrXXXXrrr,,,rrr~~~~~~~~",
      "~~~~~~~~~~rr,,rrrrrXXXXrrrrr,,rr~~~~~~~~",
      "~~~~~~~~~r,,,,rrrrrXXXXrrrrr,,,_r~~~~~~~",
      "~~~~~~~~~rr,,rrrrrrX:XXrkrrrr,,,rr~~~~~~",
      "~~~~~~~~r,,,krrrrrrr:krkkkrr,,,,,_r~~~~~",
      "~~~~~~~rr,,,,r,,,,,,:,,,,,,,,,,,,_rr~~~~",
      "~~~~~~~r,,,,,,,,,,,,:,,,,,XXXX,,,,_r~~~~",
      "~~~~~~rr,,,,,,,,,,;::,,,,,XXXXr,,,rr~~~~",
      "~~~~~rr,,,,,,,,,,;;:;,,,,,XXXXr,,_rr~~~~",
      "~~~~~r,,,,;,,,,,;;;:;;,,,,,r,rrr,rrr~~~~",
      "~~~~rr,,,;,;;;;;;;::;;,,,,;;;;;;_rr~~~~~",
      "~~~~~r,,,,rr;;;;;;:;;,,,,;;;;;;;_rr~~~~~",
      "~~~~~r,,,;;;;;;;;;:;;;;;,;;;;;;;,rr~~~~~",
      "~~~~~rr,,;;;;;;;;::;;;;;,;;;;rrrrrr~~~~~",
      "~~~~~~r,,,;;;;;,,::;;;;,,,;;;rrRRrr~~~~~",
      "~~~~~~rr,,,;;,,,,::,,,,,,,,;;;_rrr~~~~~~",
      "~~~~~~rrr,,,,,,,,::,,,,,,,,,,,_rr~~~~~~~",
      "~~~~~~rr,,,,,,,,,::,,,,,,,,,;_rr~~~~~~~~",
      "~~~~~~~rr,,,;,,,,::,,,,,,,,,_rr~~~~~~~~~",
      "~~~~~~~~rr,,,,,,,,:,,,,,,,r_rr~~~~~~~~~~",
      "~~~~~~~~~rrrrR.Rrr::rrrrrrrrr~~~~~~~~~~~",
      "~~~~~~~~~~~rrrrrrr==rrrr~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~==r~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~",
    ],
    objects: [
      {"type":"examine","x":19,"y":31,"event":"isles_boat"},
      {"type":"examine","x":24,"y":10,"event":"isles_light_plaque"},
      {"type":"chest","id":"i_light_c1","x":28,"y":16,"item":"i_ether","n":1},
    ],
    npcs: [

    ],
    spawns: {"boat":{"x":18,"y":28,"dir":"n"},"lamproom":{"x":20,"y":10,"dir":"s"}},
    exits: [{"x":20,"y":9,"w":1,"h":1,"to":{"map":"isles_lamproom","spawn":"door"}}],
    triggers: [],
    tilePatches: [],
    zones: [{"rect":null,"zone":"zw_isles","cond":"!isles_light_lit"}],
    art: {"image":"field/under/i_light","painted":[],"overlay":"field/under/i_light_over"},
    meta: {"sub":R.T('map.field_isles_light.i_light.meta.sub'),"worldRect":[560,540,40,32]},
    links: {},
  });
})(window.RPG);
