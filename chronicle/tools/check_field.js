#!/usr/bin/env node
// Field-side map check (owner A4): compiles every map with the game's own
// R.FieldMap.compile (so tools and the game read maps the same way) and reports
// what the field would trip over at runtime. Region / world / story owners can run
// it on their maps; validate.js (qa) does the cross-data checks.
//   node tools/check_field.js            all maps
//   node tools/check_field.js lute roa   only these maps
//   --fixtures                           also the tools/fixtures/field maps
// Errors (exit 1): unknown warp / exit / escape targets or spawns, NPCs / chests /
// spawns on blocked tiles or outside the rows, towns / dungeon floors without a
// `location` known to DB.locations, local maps without `outside`, a respawn spawn
// that does not exist, hidden items. Warnings: NPCs without `fixed` / `push`,
// chests without an explicit id or pool, compile warnings, secret passages that
// lead nowhere walkable.
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const withFx = args.includes('--fixtures');
const only = args.filter((a) => !a.startsWith('--'));

const warns = [];
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true, extra: withFx ? [path.join(ROOT, 'tools/fixtures/field/fx_maps.js')] : [] });
R.warn = (...a) => warns.push(a.join(' '));
R.State.newGame();
const DB = R.DB;

const errSet = new Set(), warnSet = new Set();
const E = (map, msg) => errSet.add(map + ': ' + msg);
const W = (map, msg) => warnSet.add(map + ': ' + msg);

const ids = Object.keys(DB.maps).filter((id) => (only.length ? only.includes(id) : withFx || !id.startsWith('fx_')));
const compiled = {};
for (const id of ids) {
  warns.length = 0;
  const m = R.FieldMap.compile(id);
  compiled[id] = m;
  for (const w of warns) W(id, 'compile: ' + w.replace(/^map \S+: /, ''));
}
const peek = (id) => compiled[id] || R.FieldMap.peek(id);

function targetOk(from, what, to, spawn) {
  if (!to) { E(from, what + ' without a target map'); return; }
  const t = peek(to);
  if (!t) { E(from, what + ' → unknown map ' + to); return; }
  if (spawn == null) return;
  if (typeof spawn === 'object') {
    if (!t.inBounds(spawn.x, spawn.y) || !t.walkable(spawn.x, spawn.y)) E(from, what + ' → ' + to + ' at ' + spawn.x + ',' + spawn.y + ' is not walkable');
    return;
  }
  if (!t.spawns[spawn]) E(from, what + ' → ' + to + ' has no spawn "' + spawn + '"');
}

let stats = { maps: 0, npcs: 0, chests: 0, warps: 0, secrets: 0 };
for (const id of ids) {
  const m = compiled[id];
  if (!m) continue;
  const d = m.def;
  stats.maps++;
  const local = !m.isWorld;
  if (local && d.outside == null) E(id, 'no `outside` (DESIGN §3.3.10)');
  if (Array.isArray(d.hidden) && d.hidden.length) E(id, 'hidden items are not used in this game (`hidden`)');
  if (d.marks && Object.values(d.marks).some((mk) => mk && mk.hidden)) E(id, 'hidden items are not used in this game (mark `hidden`)');
  // location (V14 / W1): towns, houses and every dungeon floor
  if ((m.isTown || m.type === 'dungeon' || m.type === 'house') && (!d.location || !DB.locations[d.location])) E(id, 'no `location` known to DB.locations (' + (d.location || '-') + ')');
  if (m.isTown && !d.noRespawn) {
    const rs = d.respawnSpawn || 'entrance';
    if (!m.spawns[rs]) E(id, 'respawn spawn "' + rs + '" does not exist (towns set the wipe return point on entry)');
  }
  if (!m.isWorld && !m.spawns.entrance && !m.spawns.from_prev) W(id, 'no `entrance` (or `from_prev`) spawn');
  for (const k in m.spawns) {
    const s = m.spawns[k];
    if (!m.inMap(s.x, s.y)) E(id, 'spawn ' + k + ' outside the rows');
    else if (!m.walkable(s.x, s.y) && !m.sailable(s.x, s.y)) E(id, 'spawn ' + k + ' at ' + s.x + ',' + s.y + ' is on a blocked tile (' + m.tileAt(s.x, s.y) + ')');
  }
  // warps, exits, escape
  for (const w of m.warps) {
    stats.warps++;
    targetOk(id, 'warp at ' + w.x + ',' + w.y, w.to, w.spawn);
    if (m.inMap(w.x, w.y) && !m.walkable(w.x, w.y)) W(id, 'warp at ' + w.x + ',' + w.y + ' is on a blocked tile (' + m.tileAt(w.x, w.y) + ')');
  }
  if (d.exit) {
    if (d.exit.to) targetOk(id, 'exit', d.exit.to, d.exit.spawn);
    else for (const dir of ['up', 'down', 'left', 'right']) if (d.exit[dir]) targetOk(id, 'exit ' + dir, d.exit[dir].to, d.exit[dir].spawn);
  }
  if (d.escape) targetOk(id, 'escape', d.escape.to || d.escape.map, d.escape.spawn);
  if (m.type === 'dungeon' && !d.escape && !d.noEscapeOk) W(id, 'dungeon floor without `escape` (the menu 「脱出」 is greyed out here)');
  // NPCs
  for (const n of m.npcs) {
    stats.npcs++;
    if (!m.inMap(n.x, n.y)) { E(id, 'npc ' + n.id + ' outside the rows'); continue; }
    const t = m.tile(n.x, n.y);
    if (!t.pass && !t.counter && n.sprite.startsWith('npc:')) {
      // people stand on floor; props shown as NPCs (boats, lanterns, visible bosses) may sit anywhere
      E(id, 'npc ' + n.id + ' at ' + n.x + ',' + n.y + ' stands on a blocked tile (' + m.tileAt(n.x, n.y) + ')');
    }
    if (n.fixed == null && n.push == null) W(id, 'npc ' + n.id + ' has neither fixed nor push (§10.13.10)');
    if (n.move === 'wander' && n.fixed) W(id, 'npc ' + n.id + ' wanders but is fixed');
    if (m.warpCell(n.x, n.y)) W(id, 'npc ' + n.id + ' stands on a warp');
  }
  // chests
  const seen = {};
  for (const c of m.chests) {
    stats.chests++;
    if (!c.id || c.id.includes('_chest_')) W(id, 'chest at ' + c.x + ',' + c.y + ' without an explicit id');
    if (seen[c.id]) E(id, 'duplicate chest id ' + c.id);
    seen[c.id] = 1;
    if (!c.pool && !c.gold) W(id, 'chest ' + c.id + ' without a pool (fixed contents are not used: §8.12.1)');
    if (c.pool && !DB.pools[c.pool]) E(id, 'chest ' + c.id + ' uses unknown pool ' + c.pool);
    if (m.inMap(c.x, c.y) && !m.walkable(c.x, c.y) && !m.tile(c.x, c.y).counter) E(id, 'chest ' + c.id + ' on a blocked tile (' + m.tileAt(c.x, c.y) + ')');
  }
  // events and onEnter
  for (const e of m.events) if (e.id && !DB.events[e.id]) E(id, 'unknown event ' + e.id);
  if (d.onEnter && !DB.events[d.onEnter]) E(id, 'unknown onEnter ' + d.onEnter);
  for (const n of m.npcs) if (n.event && !DB.events[n.event]) E(id, 'npc ' + n.id + ' uses unknown event ' + n.event);
  // secret passages: each run must connect two walkable cells
  const cells = R.FieldMap.secretCells(id);
  stats.secrets += cells.length;
  for (const [x, y] of cells) {
    let open = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = x + dx, ty = y + dy;
      if (m.inBounds(tx, ty) && m.walkable(tx, ty) && !m.isSecret(tx, ty)) open++;
    }
    if (!open && !cells.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) === 1)) W(id, 'secret passage cell ' + x + ',' + y + ' touches no walkable floor');
  }
}

const errors = [...errSet], warnings = [...warnSet];
console.log(`check_field: ${stats.maps} maps, ${stats.npcs} NPCs, ${stats.chests} chests, ${stats.warps} warps, ${stats.secrets} secret cells`);
if (warnings.length) console.log(`warnings (${warnings.length}):\n  ` + warnings.slice(0, 60).join('\n  ') + (warnings.length > 60 ? '\n  …' : ''));
if (errors.length) console.log(`ERRORS (${errors.length}):\n  ` + errors.join('\n  '));
else console.log('no errors');
process.exit(errors.length ? 1 : 0);
