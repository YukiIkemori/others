// CONTENT（終盤）: ほかの担当のマップへの小さな差し込み（終盤の場面の人・spawn）と、エンディングの朝の写し。
//   roa（ロアの里）: 終盤のロアの場面の人（語り石の前のベルナ・フィーネ・ロウェル）と spawn fin_stone。
//                    エンディングの人（語り石の前で子どもに語るベルナ・子ども 2 人）は朝の写し roa_dawn に置く。
//   pharos（ファロス）: 桟橋の記録院の船（ロウェル → のちに船乗り）と spawn fin_pier。
//   朝の写し（K.dawnCopy。同じ当たりと下絵で、光だけ朝）: biblia_dawn（E6 ビブリアの朝）・roa_dawn（E8・E9・E11 ロアの丘）・roa_house_dawn（E8 朝の席。ベルナが立つ）。
//   pharos の fin_yena: 終盤のファロスの桟橋に来る静夜会のイェナ（final_ferry の場面の間だけ。旗 final_yena_scene）。
//   どれも region 'finale'（体験版では閉じている）。差し込みは 2 段目の onData（マップの登録の後）。
(function (R) {
  'use strict';
  R.onData(function () {
    R.onData(function () {
      const K = R.ContentF.kit, FK = R.Final.kit, L = K.L;
      // ---------------------------------------------------------------- ロアの里（終盤のロアの場面）
      const roa = R.DB.maps.roa;
      if (roa) {
        roa.spawns.fin_stone = { x: 21, y: 19, dir: 'n' };
        roa.npcs.push(
          K.npc('fin_berna', 'berna', 21, 18, { name: R.T('map.final_links.fin_berna.name'), dir: 's', talk: [L('……。')], reward: null, pushable: false, cond: ['story_t8', '!final_roa'] }),
          K.npc('fin_fine', 'fine', 22, 18, { name: R.T('map.final_links.fin_fine.name'), dir: 'w', talk: [L('……。')], reward: null, pushable: false, cond: 'final_roa_scene' }),
          K.npc('fin_rowell', 'rowell', 23, 18, { name: R.T('map.final_links.fin_rowell.name'), dir: 'w', talk: [L('……。')], reward: null, pushable: false, cond: 'final_roa_scene' }),
        );
      }
      // ---------------------------------------------------------------- ファロス（桟橋の記録院の船）
      const ph = R.DB.maps.pharos;
      if (ph) {
        ph.spawns.fin_pier = { x: 23, y: 40, dir: 's' };
        ph.npcs.push(
          K.npc('fin_rowell_pier', 'rowell', 24, 41, { name: R.T('map.final_links.fin_rowell_pier.name'), dir: 'w', talk: 'final_ferry', reward: 'lead', pushable: false, cond: ['final_open', '!final_sailed'] }),
          K.npc('fin_ship_hand', 'npc_sailor_1', 24, 41, { name: R.T('map.final_links.fin_ship_hand.name'), dir: 'w', talk: 'final_ferry', reward: null, pushable: false, cond: 'final_sailed' }),
          // 静夜会のイェナ（船に乗る前に桟橋へ来る。final_ferry の場面の間だけ）
          K.npc('fin_yena', 'npc_yena', 22, 41, { name: R.T('map.final_links.fin_yena.name'), title: R.T('map.final_links.fin_yena.title'), dir: 'e', talk: [L(R.T('map.final_links.fin_yena.talk'))], reward: null, pushable: false, cond: ['final_yena_scene', '!final_sailed'] }),
        );
      }
      // ---------------------------------------------------------------- エンディングの朝の写し
      FK.dawnCopy('biblia', 'biblia_dawn', {
        sub: R.T('map.final_links.biblia.sub'),
        npcs: [
          K.npc('e_noa', 'noa', 27, 26, { name: R.T('map.final_links.biblia.npcs.0.e_noa.name'), dir: 's', talk: [L('……。')], reward: null, pushable: false }),
          K.npc('e_mother', 'npc_woman_2', 24, 27, { name: R.T('map.final_links.biblia.npcs.1.e_mother.name'), dir: 'e', talk: [L('……。')], reward: null }),
          K.npc('e_boy', 'npc_child_3', 25, 27, { name: R.T('map.final_links.biblia.npcs.2.e_boy.name'), dir: 'w', talk: [L('……。')], reward: null }),
          K.npc('e_old', 'npc_old_m_1', 31, 27, { name: R.T('map.final_links.biblia.npcs.3.e_old.name'), dir: 'n', talk: [L('……。')], reward: null }),
          K.npc('e_woman', 'npc_woman_1', 32, 26, { name: R.T('map.final_links.biblia.npcs.4.e_woman.name'), dir: 'n', talk: [L('……。')], reward: null }),
          K.npc('e_yena', 'npc_yena', 23, 25, { name: R.T('map.final_links.biblia.npcs.5.e_yena.name'), dir: 'e', talk: [L('……。')], reward: null }),
        ],
      });
      FK.dawnCopy('roa', 'roa_dawn', {
        sub: R.T('map.final_links.roa.sub'),
        spawns: { e_hill: { x: 27, y: 19, dir: 'w' }, e_stone: { x: 21, y: 19, dir: 'n' } },
        npcs: [
          K.npc('e_berna', 'berna', 21, 17, { name: R.T('map.final_links.roa.npcs.0.e_berna.name'), dir: 'n', talk: [L('……。')], reward: null, pushable: false }),
          K.npc('e_child_a', 'npc_child_1', 20, 18, { name: R.T('map.final_links.roa.npcs.1.e_child_a.name'), dir: 'n', talk: [L('……。')], reward: null }),
          K.npc('e_child_b', 'npc_child_3', 22, 18, { name: R.T('map.final_links.roa.npcs.2.e_child_b.name'), dir: 'n', talk: [L('……。')], reward: null }),
        ],
      });
      // 朝の席（E8。テスター 2026-10-04 R23）: ベルナが席の布を外し、杯を置く。東の窓からの光は R.Ending.beam
      FK.dawnCopy('roa_house', 'roa_house_dawn', {
        sub: R.T('map.final_links.roa_house.sub'), light: FK.LIGHT_DAWN_ROOM,
        spawns: { e_seat: { x: 6, y: 8, dir: 'n' } },
        npcs: [
          K.npc('e_berna_house', 'berna', 6, 5, { name: R.T('map.final_links.roa.npcs.0.e_berna.name'), dir: 'e', talk: [L('……。')], reward: null, pushable: false }),
        ],
      });
    });
  });
})(window.RPG);
