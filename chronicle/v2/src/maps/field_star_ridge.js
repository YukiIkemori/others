// 生成物（design/art_ref/gen/env/_tools/under/field_star/ の areas_star.py → fit.py → tomap.py）。手で直さない: 配置は areas_star.py、当たりは fit.py で作り直す。
// エリア s_ridge「星読みの尾根」（星読みの塔へ続く細い尾根、50×38）。エリア切り替えのフィールド（maps/field_00_kit.js、高原の凡例は field_star_00_kit.js）。
//   出口: s → s_crater.north, w → orbis.gate_e
//   絵: field/under/s_ridge（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("s_ridge", {
    name: R.T('map.field_star_ridge.s_ridge.name'), region: "r_star", outside: "forest_dark",
    legend: R.FieldArea.STAR_LEGEND, theme: 'field', bgm: 'star', bbg: 'star', propSet: 'star', propSetBase: 'village',
    light: R.FieldArea.STAR_LIGHT,
    rows: [
      "FFFFFFFFFFFFFFFFRFFFFFRRRFFFRRRFFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFRRRRRRXXXXXXXXRRRRRFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFRRRRRRXXXXXXXX,rRRRRFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFRRr,,,XXXXXXXX,,rrRRFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFRRrr,,,XXXXXXXXr,,,rRRFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFRRr,,,,XXXXXXXXr,,,rRRFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFRRrr,,,XXXccXXX;,,,,RRFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFRRr,,;;;c.cc;;;;;;;RRFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFRRrr,r;;...c;;;;;;RRFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFRRr,,;;...;;;;;;RRFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFRRr,,,;...;;;;;,RFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,,...;;;;rRRFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,,...,;r;RRFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRrrr,...,;;,RRFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRrTTr...,,,,RRFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRTTTT,..,,,,RRFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRR\"TT,,..;,r,,RFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRR,\",,,..,rTTRRFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRR,r,,,..,rTTTRRFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,,,..,,rTTRRFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,,,..,,,rr,RFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFRRFFRRr,,,,,..,,,,,,RFFFFFFFFFFFFFFFFF",
      "FFFFFFFRRRRRRRRRRr,,,,,,..,,,,,,RFFFFFFFFFFFFFFFFF",
      "RRRRRRRRRRRRrrRRrr........,,,,;RRFFFFFFFFFFFFFFFFF",
      "..rrrrrrrrrr..rrr.........,,,,rRRFFFFFFFFFFFFFFFFF",
      "................,,,,,,,...,,,,;RRFFFFFFFFFFFFFFFFF",
      ".........,,,,,,,,,,,,,,..,,,,,r;RRFFFFFFFFFFFFFFFF",
      "RRRRRRRRR,,,,,\"\"\",,,,,\"..,,,,,,,RRFFFFFFFFFFFFFFFF",
      "FFFFFFFFFRRRRR,,,,,,,\"\"..,,,,,,,,RFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFRRRRRR\"\"\",..,,,r,,,,RFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFFRR\"\",..,,TTTr,,RFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFFRRr\",..;;TTTr,RRFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,;..;;TTTT,RFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,,..\";rrr\",RFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,,..\"\"\"\"\"\",RFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRr,,,..\"\"\"\"\",,FFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFRRRRRR...,,RRRRFFFFFFFFFFFFFFFFFF",
      "FFFFFFFFFFFFFFFFFFRRRRRr.R,RRRRRFFFFFFFFFFFFFFFFFF",
    ],
    objects: [
      {"type":"sign","x":20,"y":27,"text":R.T('map.field_star_ridge.s_ridge.objects.0.text')},
      {"type":"examine","x":25,"y":8,"event":"star_tower_seal"},
      {"type":"waylamp","id":"wl_s_ridge_1","x":27,"y":26,"lit":true},
      {"type":"waylamp","id":"wl_s_ridge_2","x":26,"y":9,"lit":true},
    ],
    npcs: [

    ],
    spawns: {"south":{"x":24,"y":36,"dir":"n"},"west":{"x":1,"y":24,"dir":"e"},"tower":{"x":24,"y":7,"dir":"s"}},
    exits: [{"x":24,"y":37,"w":2,"h":1,"to":{"map":"s_crater","spawn":"north"}},{"x":0,"y":24,"w":1,"h":2,"to":{"map":"orbis","spawn":"gate_e"}}],
    triggers: [],
    tilePatches: [],
    zones: [{"rect":null,"zone":"zw_star"}],
    art: {"image":"field/under/s_ridge","painted":[],"overlay":"field/under/s_ridge_over"},
    meta: {"sub":R.T('map.field_star_ridge.s_ridge.meta.sub'),"worldRect":[636,30,50,38]},
    links: {"startower":{"map":"s_ridge","spawn":"tower"}},
  });
})(window.RPG);
