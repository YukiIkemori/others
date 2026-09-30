// 生成物（design/art_ref/gen/env/_tools/under/field_mine/ の areas_mine.py → fit.py → tomap.py）。手で直さない: 配置は areas_mine.py、当たりは fit.py で作り直す。
// エリア g_pass「ガルドの峠道」（雪原から山地へ越える峠、50×36）。エリア切り替えのフィールド（maps/field_00_kit.js、山地の凡例は field_mine_00_kit.js）。
//   出口: w → f_passinn.east, e → g_valley.west
//   絵: field/under/g_pass（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("g_pass", {
    name: R.T('map.field_mine_pass.g_pass.name'), region: "r_mine", outside: "rock",
    legend: R.FieldArea.MINE_LEGEND, theme: 'field', bgm: 'overworld', bbg: 'mine', propSet: 'mine', propSetBase: 'village',
    light: R.FieldArea.MINE_LIGHT,
    rows: [
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRR,,,,,RRRRRRRRRR,,RRRRR,RR,,,",
      "ssRRRRRsssRRRRRRR,,,,,,,,,,RRRRRRRRR,,;RR,,,,,,,R,",
      "ssRRRRRRss,,,,,,,,,,,;;;,,RRR,,,XXX,,,;;;;;TbT,,,,",
      "sssssssTTss,,,,RRTTT;;;;;;,,,,,,,:,,,,;,;rTTTTr,,,",
      "ssTTTTTTTs,,,,,TTTTTr;;;;\",,,,,,,:,,,,,,;;;,,TTT;,",
      "sTTTTTTTTs,,,,,rTTTTT;;;;;,,,,,,,:,,,,,,,,TTTTr,,,",
      "ssTTTTTTsss,,,,rTTTTr;;;;;,,,,,,,:,,,,,,,,,TTTr,,,",
      "sssTTTTsss,,,,,,,TTTr;;;;;;,,,,,,:,,,,,,,,,,,,,,,,",
      "ssssssssss,,,,,,,,TT;;;;;;;,,,,,,:,,,,,,,,,,,,,,,,",
      "sssssssssss,,,,\",,,,;;;;;;;,,,,,,:,,,,,,,,,,,T,,,,",
      "sssssssss,ss,,,.,,,,;;;;;;,,,,,,::,,,,,,,,,,,,,,,,",
      "....sss.............;;;;;;,,,,..::....,,,,,,,,,,,,",
      ".........X................................,,,,,,..",
      "........sXsss,,,,,,;...........,,,,,,.............",
      "sssssssss,ssss,,,,,;;;;...;;;;,;;;;,,,,,,,........",
      "sssssssss,sssssXr;;;;;;;;;;;;;;;;;;,,,,,,,;;;;;;;;",
      "ssssssTTTTsssss;;;;;;;;;;;;;;rr;,,;;;;;;;;;;;;;;;;",
      "ssssssssssTTsss;;;;;;;;;;;rr;T\",,,;;;;;;;;;;;;;;r;",
      "sssssTTTTTTTss;;;;;;;;;r;;,;;;T\",;;;;;;;;;;;TTTTT;",
      "sTssTTTTTTTTTsr;;;;r;;r;;;;rTTTTr;;;;;;;;;;;TTTTTr",
      "TsssTTTTTTTTss;;;;;,;;;;;;;;TTTTT,r;,;;;;;;;;,T,,;",
      "ssssTTTTTTTTs;;,,,,,,,,,,,;;;T,TTr;,,,;;;;;;;;,,rr",
      "sssssTTTTTsss;,,,,,,,r,,,,,r;b;;Tr;,,,;;,,;;;,,rrr",
      "ssssssTTTsssssss,,,,,,,,,,,,,;;;;;,,,,,,,rrRRRRrrr",
      "RRRRRRRRRssTTssss,,,,,,rRRR,,,,,,,,,,,,RRRRRRRRRRR",
      "RRRRRRRRRRRRTssss,,,,RRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRs,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRlllllllllRRRRR",
      "llllllllllllllllllllllllllllllllllllllllllllllllll",
      "llllllllllllllllllllllllllllllllllllllllllllllllll",
    ],
    objects: [
      {"type":"examine","x":9,"y":19,"event":"mine_pass_cairn"},
      {"type":"sign","x":10,"y":21,"text":R.T('map.field_mine_pass.g_pass.objects.1.text')},
      {"type":"chest","id":"g_pass_c1","x":43,"y":24,"item":"i_potion","n":2},
      {"type":"waylamp","id":"wl_g_pass_1","x":20,"y":17,"lit":true},
      {"type":"waylamp","id":"wl_g_pass_2","x":40,"y":21,"lit":true},
    ],
    npcs: [

    ],
    spawns: {"west":{"x":1,"y":18,"dir":"e"},"east":{"x":48,"y":19,"dir":"w"},"tunnel":{"x":33,"y":10,"dir":"s"}},
    exits: [{"x":0,"y":18,"w":1,"h":2,"to":{"map":"f_passinn","spawn":"east"}},{"x":49,"y":19,"w":1,"h":2,"to":{"map":"g_valley","spawn":"west"}}],
    triggers: [],
    tilePatches: [],
    zones: [{"rect":null,"zone":"zw_mine"}],
    art: {"image":"field/under/g_pass","painted":[],"overlay":"field/under/g_pass_over"},
    meta: {"sub":R.T('map.field_mine_pass.g_pass.meta.sub'),"worldRect":[284,78,50,36]},
    links: {},
  });
})(window.RPG);
