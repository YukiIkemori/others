// R1 (reg1) fixture: in-game scenes of region 1 for screenshots (browser only; debug_reg1.html).
//   RPG.reg1Scene(name) → starts a playable game in the state the scene needs, puts the party at the
//   spot and (optionally) starts the event. Returns right away; drive the rest with shot.js --wait/--keys.
//   Scenes: intro · rita · hanna · stone1 · dan · moth · vine · stone3 · fine · boss · after · reward ·
//           elm · plaza · deck · maze1 · maze2 · tree1 · tree2 · secret2 · secret1
(function (R) {
  'use strict';
  const COMPS = ['brigitta', 'marta', 'sylvain'];
  const BASE = ['forest_start', 'fern_rita'];
  const SC = {
    intro:   { flags: [], map: 'fern', at: 'entrance', enter: true },
    rita:    { flags: ['forest_start'], map: 'fern', at: { x: 42, y: 37, dir: 'up' }, talk: 'rita' },
    hanna:   { flags: BASE.concat(['forest_dan']), map: 'fern', at: { x: 44, y: 16, dir: 'up' }, talk: 'hanna' },
    plaza:   { flags: BASE, map: 'fern', at: { x: 22, y: 18, dir: 'down' } },
    deck:    { flags: BASE, map: 'fern', at: { x: 43, y: 37, dir: 'up' } },
    maze1:   { flags: BASE, map: 'verda_maze_1', at: 'entrance' },
    stone1:  { flags: BASE, map: 'verda_maze_1', at: { x: 21, y: 20, dir: 'up' }, exam: 'verda_maze_1_stone' },
    dan:     { flags: BASE, map: 'verda_maze_1', at: { x: 39, y: 6, dir: 'up' }, talk: 'dan' },
    maze2:   { flags: BASE.concat(['forest_dan']), map: 'verda_maze_2', at: 'from_prev' },
    moth:    { flags: BASE.concat(['forest_dan']), map: 'verda_maze_2', at: { x: 24, y: 17, dir: 'up' }, run: 'verda_maze_2_boss' },
    vine:    { flags: BASE.concat(['forest_dan', 'forest_mid']), vars: { forest_verses: 1 }, map: 'verda_maze_2', at: { x: 34, y: 2, dir: 'right' }, exam: 'verda_maze_2_vine' },
    stone3:  { flags: BASE.concat(['forest_dan', 'forest_mid', 'verda_maze_1_stone', 'verda_maze_2_stone_a']), vars: { forest_verses: 2 }, map: 'verda_maze_2', at: { x: 21, y: 2, dir: 'up' }, exam: 'verda_maze_2_stone_b' },
    secret2: { flags: BASE, map: 'verda_maze_2', at: { x: 6, y: 5, dir: 'up' } },
    tree1:   { flags: BASE.concat(['forest_dan', 'forest_mid']), vars: { forest_verses: 3 }, map: 'elder_tree_1', at: 'entrance' },
    secret1: { flags: BASE, vars: { forest_verses: 3 }, map: 'elder_tree_1', at: { x: 4, y: 16, dir: 'right' } },
    tree2:   { flags: BASE.concat(['forest_dan', 'forest_mid']), vars: { forest_verses: 3 }, map: 'elder_tree_2', at: 'from_prev' },
    fine:    { flags: BASE.concat(['forest_dan', 'forest_mid']), vars: { forest_verses: 3 }, map: 'elder_tree_2', at: { x: 14, y: 17, dir: 'right' }, run: 'elder_tree_2_fine', once: 'forest_fine' },
    boss:    { flags: BASE.concat(['forest_dan', 'forest_mid', 'forest_fine']), vars: { forest_verses: 3 }, map: 'elder_tree_2', at: { x: 22, y: 22, dir: 'up' }, run: 'elder_tree_2_boss' },
    after:   { flags: BASE.concat(['forest_dan', 'forest_mid', 'forest_fine', 'forest_boss']), vars: { forest_verses: 3 }, map: 'elder_tree_2', at: { x: 22, y: 25, dir: 'up' }, run: 'elder_tree_2_boss' },
    reward:  { clear: true, flags: BASE.concat(['forest_dan', 'forest_mid', 'forest_fine', 'forest_boss']), map: 'fern', at: { x: 44, y: 16, dir: 'up' }, talk: 'hanna' },
    elm:     { clear: true, flags: BASE.concat(['forest_dan', 'forest_mid', 'forest_fine', 'forest_boss']), map: 'elder_tree_2', at: { x: 22, y: 28, dir: 'down' } },
    festival: { clear: true, flags: BASE.concat(['forest_dan', 'forest_mid', 'forest_fine', 'forest_boss']), map: 'fern', at: { x: 42, y: 9, dir: 'up' } },
  };
  R.reg1Scene = async function (name, o) {
    const s = SC[name];
    if (!s) return 'scenes: ' + Object.keys(SC).join(' ');
    o = o || {};
    await R.debug.quickStart({ companions: COMPS, map: 'lute', spawn: 'inn', noEncounter: true, level: o.level || 12, gear: 'tier' });
    for (const f of s.flags) R.State.setFlag(f, true);
    for (const k in s.vars || {}) R.State.setVar(k, s.vars[k]);
    if (s.clear) R.debug.clearRegion('r_forest');
    if (!s.enter) R.State.setFlag('forest_start', s.flags.includes('forest_start') || !!s.clear);
    if (o.tier != null) R.debug.tier(o.tier);
    await R.debug.warp(s.map, s.at);
    R.Field.noEncounter = true;
    R.Field.refresh();
    if (s.talk) { const n = R.Field.npc(s.talk); if (n) R.Events.talk(n); }
    if (s.exam) R.Events.run(s.exam, { self: s.exam, trigger: 'examine' });
    if (s.run) R.Events.run(s.run, { trigger: 'step', once: s.once, self: s.map });
    return R.debug.pos();
  };
  /** win the running battle at once (screenshots of the after-battle flow) */
  R.reg1WinBattle = function () {
    const B = R.Battle;
    if (!B || !B.state) return 'no battle';
    for (const m of B.state.enemies || B.state.mons || []) m.hp = 0;
    return 'ok';
  };
})(window.RPG);
