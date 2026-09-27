// CONTENT-P: ファロスの屋内 6 つ（V2_PLAN §3.2）。どれも「上の 2 行が壁、下の中ほどに戸口」の箱（R.ContentP.kit.room）。
//   pharos_inn       宿（16×12）         宿の主人 → ev.inn
//   pharos_tavern    潮風亭（20×14）     マスター（P6 の仲間選び・入れ替え）、うわさの 3 人、吟遊詩人、旅の剣士
//   pharos_shop      道具屋（14×10）     shop_pharos_items
//   pharos_smith     武具屋（14×10）     shop_pharos_arms
//   pharos_record    記録院の出張所（14×10）  P5 の若い記録官、写し取り済みの掲示（lo_ev_prologue）、白紙の束
//   pharos_shipyard  造船所の小屋（16×12）   職人と見習い（q_pharos_delivery）。小舟は縦切りでは出ない
//   spawn: どれも door（戸口の内側）。出口は pharos の <名>_door へ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const P = K.prop, PS = K.props;
    const LIGHT = { ambient: '#8a6a58', k: 0.85, mood: 'interior' };

    function room(id, name, w, h, back, o) {
      const { g, door } = K.room(w, h, o);
      if (o && o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      K.def(id, Object.assign({
        name, kind: 'interior', region: 'prologue', location: 'pharos',
        legend: K.ROOM_LEGEND(o && o.wall, o && o.floor), rows: g, outside: (o && o.wall) || 'wall_wood',
        spawns: { door: { x: door.x, y: door.y - 1, dir: 'n' } },
        exits: [{ x: door.x, y: door.y, w: 2, h: 1, to: { map: 'pharos', spawn: back } }],
        light: LIGHT, bgm: 'town', meta: { minimap: false },
      }, o && o.map));
    }

    // ---------------------------------------------------------------- 宿（16×12）
    room('pharos_inn', 'ファロスの宿', 16, 12, 'inn_door', {
      carpet: [6, 5, 4, 5],
      map: {
        objects: [
          ...PS('counter', [[1, 4], [2, 4], [3, 4], [4, 4]]), P('bookshelf', 2, 2), P('barrel', 4, 2),
          P('bed', 11, 3), P('bed', 13, 3), P('bed', 11, 6), P('bed', 13, 6),
          P('table', 12, 9), P('chair', 11, 9), P('chair', 13, 9), P('lantern', 14, 2), P('lantern', 9, 2),
          P('planter', 1, 9), P('flower_pot', 14, 9), P('stove', 7, 2),
        ],
        npcs: [{ id: 'innkeeper', look: 'npc_woman_4', name: '宿のおかみ', x: 2, y: 3, dir: 's', move: 'still', pushable: false, talk: 'pharos_innkeeper' }],
        bgm: 'town',
      },
    });

    // ---------------------------------------------------------------- 潮風亭（20×14）
    room('pharos_tavern', '酒場「潮風亭」', 20, 14, 'tavern_door', {
      carpet: [9, 7, 3, 5], floor: 'wood_floor',
      map: {
        objects: [
          ...PS('counter', [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5]]),
          ...PS('bookshelf', [[2, 2], [3, 2], [4, 2], [5, 2]]), P('barrel', 7, 2), P('barrel', 8, 2), P('stove', 16, 2),
          P('table', 12, 4), P('chair', 11, 4), P('chair', 13, 4),
          P('table', 16, 6), P('chair', 15, 6), P('chair', 17, 6),
          P('table', 3, 9), P('chair', 2, 9), P('chair', 4, 9),
          P('table', 15, 10), P('chair', 14, 10), P('chair', 16, 10),
          P('lantern', 10, 2), P('lantern', 18, 9), P('crate', 1, 11), P('sack', 18, 11), P('flower_pot', 1, 7),
        ],
        npcs: [
          { id: 'master', look: 'npc_merchant_2', name: '潮風亭のマスター', x: 4, y: 4, dir: 's', move: 'still', pushable: false, talk: 'pharos_tavern_master', key: 'pharos_master' },
          { id: 'gossip', look: 'npc_woman_3', name: 'うわさ好きのおかみ', x: 11, y: 5, dir: 'e', move: 'still', talk: 'pharos_rumor_gossip', reward: 'lead', key: 'pharos_gossip' },
          { id: 'bard', look: 'npc_bard_1', name: '吟遊詩人', x: 17, y: 4, dir: 's', move: 'still', talk: 'pharos_rumor_bard', reward: 'lead', key: 'pharos_bard' },
          { id: 'trader', look: 'npc_merchant_3', name: '旅の商人', x: 14, y: 11, dir: 'e', move: 'still', talk: 'pharos_rumor_trader', reward: 'lead', key: 'pharos_trader' },
          { id: 'swordsman', look: 'npc_man_3', name: '旅の剣士', x: 2, y: 10, dir: 'e', move: 'still', talk: 'pharos_swordsman', reward: 'boss', key: 'pharos_swordsman' },
        ],
        bgm: 'tavern',
      },
    });

    // ---------------------------------------------------------------- 道具屋（14×10）
    room('pharos_shop', 'ファロスの道具屋', 14, 10, 'shop_door', {
      map: {
        objects: [
          ...PS('counter', [[3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4]]),
          ...PS('bookshelf', [[2, 2], [3, 2], [9, 2], [10, 2]]), P('barrel', 11, 2), P('barrel', 12, 3), P('sack', 1, 3), P('sack', 1, 4),
          P('crate', 11, 7), P('crate', 12, 7), P('lantern', 7, 2), P('flower_pot', 1, 8), P('hay', 12, 8),
        ],
        npcs: [{ id: 'shopkeeper', look: 'npc_merchant_1', name: '道具屋の主人', x: 5, y: 3, dir: 's', move: 'still', pushable: false, talk: 'pharos_shopkeeper' }],
      },
    });

    // ---------------------------------------------------------------- 武具屋（14×10）
    room('pharos_smith', 'ファロスの武具屋', 14, 10, 'smith_door', {
      wall: 'wall_brick', floor: 'stone_floor',
      map: {
        objects: [
          ...PS('counter', [[3, 4], [4, 4], [5, 4], [6, 4], [7, 4]]),
          P('stove', 10, 2), P('barrel', 9, 3), P('crate', 11, 3), P('crate', 12, 4), P('bookshelf', 2, 2), P('bookshelf', 3, 2),
          P('table', 11, 7), P('lantern', 6, 2), P('sack', 1, 7), P('barrel', 1, 8),
        ],
        npcs: [{ id: 'smith', look: 'npc_man_4', name: '武具屋の親方', x: 5, y: 3, dir: 's', move: 'still', pushable: false, talk: 'pharos_smithy' }],
      },
    });

    // ---------------------------------------------------------------- 記録院の出張所（14×10）
    room('pharos_record', '記録院ファロス出張所', 14, 10, 'record_door', {
      wall: 'wall_stone', floor: 'stone_floor', carpet: [4, 5, 6, 3],
      map: {
        objects: [
          ...PS('bookshelf', [[3, 2], [4, 2], [5, 2], [8, 2], [9, 2], [10, 2]]),
          P('table', 6, 4), P('table', 7, 4),         // 若い記録官の机（白紙の束）
          P('chair', 7, 3), P('board', 1, 3),           // 掲示
          P('table', 11, 6), P('chair', 12, 6), P('crate', 12, 2), P('lantern', 11, 2), P('sack', 1, 8), P('flower_pot', 12, 8),
          K.exam(1, 3, 'pharos_record_notice'),
          K.exam(6, 4, 'pharos_record_papers'),
        ],
        npcs: [
          { id: 'rowell', look: 'rowell', name: '若い記録官', x: 7, y: 5, dir: 's', move: 'still', pushable: false, talk: 'pharos_rowell', key: 'pharos_rowell' },
          { id: 'clerk', look: 'npc_man_2', name: '書記', x: 11, y: 5, dir: 'w', move: 'still', talk: 'pharos_clerk', reward: 'news', key: 'pharos_clerk' },
        ],
      },
    });

    // ---------------------------------------------------------------- 造船所の小屋（16×12）
    room('pharos_shipyard', '造船所の小屋', 16, 12, 'shipyard_door', {
      floor: 'plank',
      map: {
        objects: [
          P('rowboat', 6, 5), P('rowboat', 9, 5),   // 台の上の小舟（修理中）
          ...PS('log', [[2, 3], [3, 3], [12, 3]]), P('crate', 13, 3), P('crate', 13, 4), P('barrel', 1, 5), P('net', 14, 7),
          P('table', 11, 8), P('chair', 12, 8), P('lantern', 8, 2), P('sack', 2, 9), P('hay', 14, 9),
        ],
        npcs: [
          { id: 'shipwright', look: 'npc_old_m_3', name: '造船所の職人', x: 7, y: 7, dir: 's', move: 'still', pushable: false, talk: 'pharos_shipwright', reward: 'news', key: 'pharos_shipwright' },
          { id: 'apprentice', look: 'npc_man_1', name: '見習い', x: 3, y: 7, dir: 'e', move: 'still', talk: 'pharos_apprentice', reward: 'side', key: 'pharos_apprentice' },
        ],
      },
    });
  });
})(window.RPG);
