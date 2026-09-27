// CONTENT（砂漠）: ザハラ砂漠の場所（R.DB.locations、K.location。V2_PLAN §2.6.1）。ワープの一覧と地図の名前。
//   町: カシム・宿場「砂の縁」。ダンジョンの入口: 王墓（王墓のオアシスの古い泉のそば）・鷹団のアジト・金剛トカゲの岩場・沈んだ神殿。
//   野営地・しんきろうの市・古い野営跡・井戸の小部屋は「場所」（ワープの一覧には出さない）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    kasim: { name: 'オアシスの町カシム', region: 'r_desert', kind: 'town', map: 'kasim', spawn: 'warp', warp: W },
    sandedge: { name: '宿場「砂の縁」', region: 'r_desert', kind: 'town', map: 'sandedge', spawn: 'gate', warp: W },
    tomb: { name: '砂の王墓', region: 'r_desert', kind: 'dungeon', map: 'desert_tomb_1', spawn: 'entrance', warp: W },
    hawks: { name: '砂の鷹団のアジト', region: 'r_desert', kind: 'dungeon', map: 'desert_hawks_1', spawn: 'mouth', warp: W },
    rocks: { name: '金剛トカゲの岩場', region: 'r_desert', kind: 'dungeon', map: 'desert_rocks', spawn: 'mouth', warp: W },
    temple: { name: '砂に沈んだ神殿', region: 'r_desert', kind: 'dungeon', map: 'desert_temple_1', spawn: 'entrance', warp: W },
    camp1: { name: '野営地「岩の井戸」', region: 'r_desert', kind: 'place', map: 'desert_camp1', spawn: 'road', warp: W },
    camp2: { name: '野営地「星の石」', region: 'r_desert', kind: 'place', map: 'desert_camp2', spawn: 'road', warp: W },
    oasis: { name: '王墓のオアシス', region: 'r_desert', kind: 'place', map: 'desert_camp3', spawn: 'road', warp: W },
    mirage: { name: 'しんきろうの市', region: 'r_desert', kind: 'place', map: 'desert_mirage', spawn: 'road', warp: W },
  });
})(window.RPG);
