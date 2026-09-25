#!/usr/bin/env node
// Self-test for tools/check_world.js: the shipped world passes, and broken
// copies of it (wall hole, open barrier, dock on land, missing zones, land in
// the border, missing gate warp) are each caught.
//   node tools/fixtures/world/test_check_world.js
'use strict';
const R = require('../../lib/load')({ quiet: true });
const { checkWorld } = require('../../check_world');

const base = R.DB.maps.world;
const clone = () => JSON.parse(JSON.stringify(base));
const setCh = (m, x, y, ch) => { const r = m.rows[y]; m.rows[y] = r.slice(0, x) + ch + r.slice(x + 1); };
let fails = 0;
function expect(name, mutate, pattern) {
  const m = clone();
  if (mutate) mutate(m);
  const { errors } = checkWorld(R, m);
  const ok = pattern ? errors.some((e) => pattern.test(e)) : errors.length === 0;
  if (!ok) fails++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  → ' + (errors.slice(0, 4).join(' | ') || 'no errors')));
}

expect('shipped world is clean', null, null);
expect('hole in the mountain wall', (m) => {
  const w = m.spawns.east_gate_w, e = m.spawns.east_gate_e;
  for (let x = w.x + 1; x < e.x; x++) setCh(m, x, w.y, '.');
}, /reachable from regnas_castle without the gate/);
expect('barrier ring opened', (m) => {
  const y = m.spawns.demon_castle_1.y;
  m.rows[y] = m.rows[y].replace(/w/g, '~');
}, /before barrier_broken/);
expect('dock on land', (m) => { m.spawns.salva_dock = Object.assign({}, m.spawns.salva_town, { dir: 'down' }); }, /dock salva_dock not on sea/);
expect('land zones missing', (m) => { m.zones = m.zones.filter((z) => /^w_sea/.test(z.zone)); }, /walkable .* has zone w_sea/);
expect('land in the border', (m) => setCh(m, 1, 1, '.'), /border not sea/);
expect('gate warp missing', (m) => { m.warps = m.warps.filter((w) => w.to !== 'east_gate'); }, /east_gate_w: warp must be/);
expect('icon without warp target', (m) => { m.warps = m.warps.filter((w) => w.to !== 'pyramid_1'); }, /icon pyramid_1: warp/);
expect('unknown row char', (m) => setCh(m, 60, 60, '#'), /unknown chars/);

console.log(fails ? `\n${fails} failure(s)` : '\nall passed');
process.exitCode = fails ? 1 : 0;
