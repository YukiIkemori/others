// 生成物（design/art_ref/gen/env/_tools/under/field_desert/ の areas_desert.py → fit.py → tomap.py）。手で直さない: 配置は areas_desert.py、当たりは fit.py で作り直す。
// エリア d_hollow「砂嵐のくぼ地」（隊商路の近道、44×36）。エリア切り替えのフィールド（maps/field_00_kit.js、砂漠の凡例は field_desert_00_kit.js）。
//   出口: e → d_caravan.hollow, w → d_coast.hollow, 門 → desert_oldcamp.road
//   絵: field/under/d_hollow（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {
  'use strict';
  R.FieldArea.def("d_hollow", {
    name: "砂嵐のくぼ地", region: "r_desert", outside: "rock",
    legend: R.FieldArea.DESERT_LEGEND, theme: 'desert', bgm: 'desert', bbg: 'desert',
    rows: [
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRuuuuuuuuRRRRRRRRRRRRRRuuuuuRRRRRR",
      "uuuuuuuuuuuuuuuuuuuuuuuuuuuussuuuuuuuuuRRRRR",
      "::uuuuuuuuuuuuuuuuuuuuuuuuusssuuuuuuuuuRRRRR",
      "u::::uuuuuuuuuussubbuuuuuuuuuuuuuuuuuuuRRRRR",
      "uuus:::ssssuussbsssuuuuuruuuuuuuuuuuuuuuRRRR",
      "uussss:::sssusssssusuuuuuuuuuuuusuuuuuuuRRRR",
      "uRRssss:::susssssssuuuuusuuuuRRRuuuuuuuuuRRR",
      "RRRuuusus::ursrsuuuuuuuuuuuuuRRRuuuuuuuuuuRR",
      "RRRuuuuuuu:usRRRuuuuuuuuuuuuuRRRuuuuuuuuurRR",
      "RRRuuuuuuu:::RRRuuuuRRRRRuuuuuuuuuuuuubuuRRR",
      "RRRuuuuuuss::RRRuuRRRRRRRRuuuuruuuuuuuuuuRRR",
      "RRRuuuuususs::uuuuRRRRRRRRRuuuuuuuuuuuuuuRRR",
      "RRRuuusssuuus::uuuRRRRRRRRRuuuuuuuuRRuuuuRRR",
      "RRRssssssuuuus:::uuRRRRRRRuuuuruuuuRRRuuuRRR",
      "RRRsrussssuuuss::::::::RRuuuuuuuuuuuRbuuuRRR",
      "RRRuuuusssuruusuuu::::::uuuuuuuuuuuuuruuuRRR",
      "RRRsssssssuuuuuuuuuuuuu::::uuuuuuuuuuuuuuRRR",
      "RRRsssssssuuusursuuuuuuuuu:::::uuuuuuuuuuRRR",
      "RRRssussssuuuuuuuuuuruuuuuuuu::::::uuuubuRRR",
      "RRRusuussssuuussuuuuuuuuuuuuuuuuu:::::uuuRRR",
      "RRRsuususRRRuuussssssssssusuuuusussuu::::RRR",
      "RRRsuusssRRRuuussssusssssssuubusrssbsuuu::::",
      "RRRRuuuuuRRRuusssssssssssssuuuuusssssuuuuu::",
      "RRRRuuuuuuuuuussrsussssssssuuuuuuuuususuuuuu",
      "RRRRuuuuuuuususssssssssssssusuuuuuuusuuuuruu",
      "RRRRRuuuuuuussusssssssssssssuuuuuuuusuussRRR",
      "RRRRRuuuuuusssusssssssssuuuuuuuuuuuuuuussRRR",
      "RRRRRuuuuuusssuuusuuubuuuuuuuuuuuuuuuusRRRRR",
      "RRRRRRuuuuussssussuuuuuuuuuuuuuuuuuusRRRRRRR",
      "RRRRRRRRRRRRRRrsuuuuuuuuuuuuuuuuuRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRuuurRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
      "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
    ],
    objects: [
      {"type":"sign","x":38,"y":23,"text":"砂嵐のくぼ地\n風の音にまぎれて、はぐれないように。"},
      {"type":"prop","id":"bones","x":18,"y":20},
      {"type":"prop","id":"tent","x":25,"y":19},
    ],
    npcs: [

    ],
    spawns: {"caravan":{"x":42,"y":25,"dir":"w"},"coast":{"x":1,"y":5,"dir":"e"},"oldcamp":{"x":22,"y":18,"dir":"s"}},
    exits: [{"x":43,"y":25,"w":1,"h":2,"to":{"map":"d_caravan","spawn":"hollow"}},{"x":0,"y":4,"w":1,"h":3,"to":{"map":"d_coast","spawn":"hollow"}},{"x":22,"y":17,"w":1,"h":1,"to":{"map":"desert_oldcamp","spawn":"road"}}],
    triggers: [{"id":"desert_ambush_3b","x":12,"y":13,"w":5,"h":5,"on":"step","event":"desert_ambush_3","cond":["desert_caravan_on","!desert_ambush_3_done"]}],
    tilePatches: [],
    zones: [{"rect":null,"zone":"zw_desert_storm"}],
    art: {"image":"field/under/d_hollow","painted":[]},
    meta: {"sub":"隊商路の近道","worldRect":[54,436,40,32]},
    links: {"oldcamp":{"map":"d_hollow","spawn":"oldcamp"}},
  });
})(window.RPG);
