// QA fixture (A22, node only): a three-map world for progress.js (tools/test_qa.js swaps DB.config.start to it).
//   qa_p_start  start room; its east wall has a secret passage (%) into a side room where an NPC gives flag qa_key;
//               the stairs (S) to qa_p_goal open only with qa_key (a warp cond); onEnter qa_p_start_enter calls
//               qa_p_start_called (needs flag:qa_key → gives flag qa_called)
//   qa_p_goal   an NPC gives flag qa_goal; a tilePatch closes the door back (cond qa_goal) — exits stay open via S
// Expected: everything is reached with secrets passable; with secrets closed, qa_key (and so qa_goal) is lost,
// which progress.js reports as "only reachable through a secret passage" (Part A4).
(function (R) {
  'use strict';
  const DB = R.DB;
  DB.maps.qa_p_start = {
    name: '検査の部屋', type: 'dungeon', theme: 'cave', bgm: 'dungeon', outside: '#', location: 'lighthouse',
    onEnter: 'qa_p_start_enter',
    rows: [
      '##############',
      '#.....#......#',
      '#.....%......#',
      '#.....#......#',
      '#S....########',
      '##############',
    ],
    spawns: { entrance: { x: 2, y: 2, dir: 'down' }, from_next: { x: 2, y: 3, dir: 'down' } },
    npcs: [{ id: 'qa_keeper', sprite: 'npc:old_man', x: 11, y: 2, dir: 'left', event: 'qa_p_start_keeper', fixed: true }],
    warps: [{ x: 1, y: 4, to: 'qa_p_goal', spawn: 'entrance', cond: 'qa_key' }],
  };
  DB.maps.qa_p_goal = {
    name: '検査の奥', type: 'dungeon', theme: 'cave', bgm: 'dungeon', outside: '#', location: 'lighthouse',
    rows: [
      '##########',
      '#........#',
      '#........#',
      '##########',
    ],
    spawns: { entrance: { x: 1, y: 1, dir: 'down' } },
    npcs: [{ id: 'qa_sage', sprite: 'npc:old_man', x: 7, y: 1, dir: 'left', event: 'qa_p_goal_sage', fixed: true }],
  };
  DB.events.qa_p_start_enter = { meta: { needs: [], gives: [], calls: ['qa_p_start_called'] }, run: async () => {} };
  DB.events.qa_p_start_called = { meta: { needs: ['flag:qa_key'], gives: ['flag:qa_called'] }, run: async (ev) => { ev.setFlag('qa_called'); } };
  DB.events.qa_p_start_keeper = { meta: { needs: [], gives: ['flag:qa_key'] }, run: async (ev) => { ev.setFlag('qa_key'); } };
  DB.events.qa_p_goal_sage = { meta: { needs: ['flag:qa_key'], gives: ['flag:qa_goal'] }, run: async (ev) => { ev.setFlag('qa_goal'); } };
})(window.RPG);
