// QA fixture (A22, node only — tools/test_qa.js loads it through validate.run({with})): content that breaks the
// §12.2 rules on purpose, one fault per entry, so test_qa.js can check that validate.js reports each of them.
// Every id starts with qa_ / carries "qa" so the findings are easy to pick out of the real game's report.
(function (R) {
  'use strict';
  const DB = R.DB;
  const pool = Object.keys(DB.pools || {})[0] || 'p_supply';
  const room = [
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '##########',
  ];
  // V5 (no outside, hidden, a chest with a fixed item) · V14 (no location) · V2 (duplicate / missing chest id)
  // · V5 warning (npc with neither fixed nor push)
  DB.maps.qa_bad_town = {
    name: '検査の町', type: 'town', theme: 'town', bgm: 'town', rows: room,
    spawns: { entrance: { x: 1, y: 1, dir: 'down' } },
    hidden: [{ x: 2, y: 2, item: 'i_herb' }],
    chests: [
      { id: 'qa_bad_town_c1', x: 2, y: 3, pool, tier: 0 },
      { id: 'qa_bad_town_c1', x: 3, y: 3, pool, tier: 0 },
      { id: 'qa_bad_town_c2', x: 4, y: 3, item: 'i_herb' },
      { x: 5, y: 3, pool, tier: 0 },
    ],
    npcs: [{ id: 'qa_walker', sprite: 'npc:man', x: 5, y: 5, text: 'やあ。' }],
  };
  // V5 (a small dungeon floor whose outside is floor, not wall) · V14 (location not in DB.locations)
  DB.maps.qa_bad_floor = {
    name: '検査の洞窟', type: 'dungeon', theme: 'cave', bgm: 'dungeon', rows: room, outside: '.', location: 'qa_nowhere',
    spawns: { entrance: { x: 1, y: 1, dir: 'down' } },
    warps: [{ x: 8, y: 6, to: 'qa_no_such_map', spawn: 'entrance' }],
  };
  // V1 (an event whose meta.warp goes to an unknown map)
  DB.events.qa_bad_floor_gate = { meta: { needs: [], gives: [], warp: { to: 'qa_no_such_map', spawn: 'entrance' } }, run: async () => {} };
  // V3 (a name over the §1.7 length) · V4 (a mods key that is not in §3.3.16)
  DB.items.ac_qa_long = { type: 'acc', name: 'ながいながいながいなまえのおまもり', tier: 1, grade: 'normal', src: 'shop', price: 10, mods: { qaNoSuchKey: 5 }, desc: '検査用。' };
  // V10 (glim.lv outside 1–10)
  DB.actions.t_sword_qa = { kind: 'tech', wtype: 'sword', name: 'けんさぎり', desc: '検査用の技。', wp: 3, target: 'enemy', effects: [{ type: 'damage', power: 1 }], rank: 12, glim: { lv: 12, from: ['attack'] } };
})(window.RPG);
