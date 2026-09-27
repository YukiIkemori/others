// CONTENT-P: ファロスの屋内 6 つ（V2_PLAN §3.2）。どれも「上の 2 行が壁、下の中ほどに戸口」の箱（R.ContentP.kit.room）。
//   外の建物に合わせた小さめの部屋に、家具を K.furnish（文字の絵）で詰めて置く。灯り = 暖炉・燭台・壁の燭台・卓のろうそく・ランタン
//   pharos_inn       宿（13×10）         宿の主人 → ev.inn
//   pharos_tavern    潮風亭（16×11）     マスター（P6 の仲間選び・入れ替え）、うわさの 3 人、吟遊詩人、旅の剣士
//   pharos_shop      道具屋（11×9）      shop_pharos_items
//   pharos_smith     武具屋（11×9）      shop_pharos_arms
//   pharos_record    記録院の出張所（12×9）  P5 の若い記録官、写し取り済みの掲示（lo_ev_prologue）、白紙の束
//   pharos_shipyard  造船所の小屋（12×9）   職人と見習い（q_pharos_delivery）。小舟は縦切りでは出ない
//   spawn: どれも door（戸口の内側）。出口は pharos の <名>_door へ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const P = K.prop;
    const LIGHT = { ambient: '#7c5e4e', k: 0.82, mood: 'interior' };

    function room(id, name, w, h, back, o) {
      const { g, door } = K.room(w, h, o);
      if (o && o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      K.def(id, Object.assign({
        name, kind: 'interior', region: 'prologue', location: 'pharos',
        legend: K.ROOM_LEGEND(o && o.wall, o && o.floor), rows: g, outside: (o && o.wall) || 'wall_wood',
        spawns: { door: { x: door.x, y: door.y - 1, dir: 'n' } },
        exits: [{ x: door.x, y: door.y, w: 1, h: 1, to: { map: 'pharos', spawn: back } }],
        light: LIGHT, bgm: 'town', meta: { minimap: false },
      }, o && o.map));
    }

    // ---------------------------------------------------------------- 宿（13×10）: 受付の台・寝台 4 つ・暖炉・食卓
    room('pharos_inn', 'ファロスの宿', 13, 10, 'inn_door', {
      carpet: [5, 3, 3, 6],
      map: {
        objects: [
          ...K.furnish([
            'KJ.C.F-.B.B',
            '...........',
            'N-N-....B.B',
            '...........',
            'cL-c......P',
            '...........',
            'Vb.l..e...b'], '..s.c..w.w.'),
        ],
        npcs: [{ id: 'innkeeper', look: 'npc_woman_4', name: '宿のおかみ', x: 2, y: 3, dir: 's', move: 'still', pushable: false, talk: 'pharos_innkeeper' }],
        bgm: 'town',
      },
    });

    // ---------------------------------------------------------------- 潮風亭（16×11）: 酒樽の台と酒瓶の棚・長い台・卓 3 つ・暖炉
    room('pharos_tavern', '酒場「潮風亭」', 16, 11, 'tavern_door', {
      carpet: [7, 5, 4, 3], floor: 'wood_floor',
      map: {
        objects: [
          ...K.furnish([
            'OG-J.b..C.F-.b',
            '..............',
            'N-N-N-........',
            '.......cTc....',
            'b............b',
            'cTc.......cL-c',
            'C.............',
            'bx........e.bk'], '....y..w.c..c.'),
        ],
        npcs: [
          { id: 'master', look: 'npc_merchant_2', name: '潮風亭のマスター', x: 3, y: 3, dir: 's', move: 'still', pushable: false, talk: 'pharos_tavern_master', key: 'pharos_master', bark: 'v_master_greet_01' },
          { id: 'gossip', look: 'npc_woman_3', name: 'うわさ好きのおかみ', x: 7, y: 5, dir: 'e', move: 'still', talk: 'pharos_rumor_gossip', reward: 'lead', key: 'pharos_gossip' },
          { id: 'bard', look: 'npc_bard_1', name: '吟遊詩人', x: 13, y: 3, dir: 's', move: 'still', talk: 'pharos_rumor_bard', reward: 'lead', key: 'pharos_bard' },
          { id: 'trader', look: 'npc_merchant_3', name: '旅の商人', x: 12, y: 6, dir: 's', move: 'still', talk: 'pharos_rumor_trader', reward: 'lead', key: 'pharos_trader' },
          { id: 'swordsman', look: 'npc_man_3', name: '旅の剣士', x: 4, y: 7, dir: 'w', move: 'still', talk: 'pharos_swordsman', reward: 'boss', key: 'pharos_swordsman' },
        ],
        bgm: 'tavern',
      },
    });

    // ---------------------------------------------------------------- 道具屋（11×9）: 薬瓶の棚・台・品物のかご
    room('pharos_shop', 'ファロスの道具屋', 11, 9, 'shop_door', {
      carpet: [3, 5, 4, 2],
      map: {
        objects: [
          ...K.furnish([
            'OJO.l.OJK',
            '.........',
            '..N-N-...',
            '........x',
            'bk.....VY',
            'px.....bb'], '...w.h...'),
        ],
        npcs: [{ id: 'shopkeeper', look: 'npc_merchant_1', name: '道具屋の主人', x: 5, y: 3, dir: 's', move: 'still', pushable: false, talk: 'pharos_shopkeeper' }],
      },
    });

    // ---------------------------------------------------------------- 武具屋（11×9）: 武器の棚・鎧の人台・盾の棚・炉
    room('pharos_smith', 'ファロスの武具屋', 11, 9, 'smith_door', {
      wall: 'wall_brick', floor: 'stone_floor',
      map: {
        objects: [
          ...K.furnish([
            'WZ-A.F-.W',
            '........A',
            '..N-N-...',
            'A.......b',
            'A.......x',
            'Z-.....bk'], '....o..t.'),
        ],
        npcs: [{ id: 'smith', look: 'npc_man_4', name: '武具屋の親方', x: 5, y: 3, dir: 's', move: 'still', pushable: false, talk: 'pharos_smithy' }],
      },
    });

    // ---------------------------------------------------------------- 記録院の出張所（12×9）: 本棚・掲示・書き物机
    room('pharos_record', '記録院ファロス出張所', 12, 9, 'record_door', {
      wall: 'wall_stone', floor: 'stone_floor', carpet: [4, 3, 4, 4],
      map: {
        objects: [
          ...K.furnish([
            'SS.q.C.SSK',
            '..........',
            '..sEE.....',
            '.......Es.',
            'k.........',
            'xb.......p'], '..y.w.c...'),
          K.exam(4, 2, 'pharos_record_notice'),   // 掲示
          K.exam(4, 4, 'pharos_record_papers'),   // 若い記録官の机（白紙の束）
        ],
        npcs: [
          { id: 'rowell', look: 'rowell', name: '若い記録官', x: 4, y: 5, dir: 's', move: 'still', pushable: false, talk: 'pharos_rowell', key: 'pharos_rowell' },
          { id: 'clerk', look: 'npc_man_2', name: '書記', x: 10, y: 5, dir: 'w', move: 'still', talk: 'pharos_clerk', reward: 'news', key: 'pharos_clerk' },
        ],
      },
    });

    // ---------------------------------------------------------------- 造船所の小屋（12×9、板の間）: 台の上の小舟・材木・道具
    room('pharos_shipyard', '造船所の小屋', 12, 9, 'shipyard_door', {
      floor: 'plank',
      map: {
        objects: [
          P('rowboat', 2, 4), P('rowboat', 8, 4),   // 台の上の小舟（修理中）
          ...K.furnish([
            'gg.xl..bbx',
            'x........x',
            '..........',
            '..........',
            'E.......m.',
            'kh......xl'], 'o...v..m..'),
        ],
        npcs: [
          { id: 'shipwright', look: 'npc_old_m_3', name: '造船所の職人', x: 5, y: 5, dir: 's', move: 'still', pushable: false, talk: 'pharos_shipwright', reward: 'news', key: 'pharos_shipwright' },
          { id: 'apprentice', look: 'npc_man_1', name: '見習い', x: 2, y: 6, dir: 'e', move: 'still', talk: 'pharos_apprentice', reward: 'side', key: 'pharos_apprentice' },
        ],
      },
    });
  });
})(window.RPG);
