// Test preload (never shipped): stubs the dungeon maps/events owned by another
// agent so tools/progress.js can prove the town/story half of the game:
//   node -r ./tools/fixtures/towns/preload_dungeon_stubs.js tools/progress.js
// Each stub dungeon is a 5x3 room: entrance ↔ world, and an NPC whose event
// (meta only) hands out the dungeon's reward.
'use strict';
const path = require('path');
const Module = require('module');
const LOAD = path.resolve(__dirname, '..', '..', 'lib', 'load.js');
const origLoad = Module._load;
const STUBS = {
  wind_cave_1: { needs: [], gives: ['item:crest_wind'] },
  bandit_fort_1: { needs: [], gives: ['item:silver_key', 'flag:bandits_defeated'] },
  water_cave_1: { needs: [], gives: ['item:crest_water'] },
  pyramid_1: { needs: ['item:silver_key'], gives: ['item:crest_earth'] },
  ice_cave_1: { needs: [], gives: ['item:gold_key'] },
  volcano_1: { needs: ['item:gold_key'], gives: ['item:crest_fire'] },
  star_tower_1: { needs: ['item:gold_key'], gives: ['item:crest_star'] },
  demon_castle_1: { needs: ['item:light_crest'], gives: ['flag:game_clear'] },
};
Module._load = function (request, parent, isMain) {
  const out = origLoad.apply(this, arguments);
  let resolved = null;
  try { resolved = Module._resolveFilename(request, parent, isMain); } catch (e) { /* ignore */ }
  if (resolved !== LOAD || out.__stubbed) return out;
  const wrapped = function (opts) {
    const R = out(opts);
    for (const id in STUBS) {
      if (R.DB.maps[id]) continue;
      R.DB.maps[id] = {
        name: id, type: 'dungeon', legend: 'local', theme: 'cave',
        rows: ['#####', '<.@.A', '#####'],
        marks: {
          '<': { warp: { to: 'world', spawn: id }, under: '.' },
          '@': { spawn: 'entrance', under: '.' },
          A: { npc: { id: 'boss', sprite: 'npc:demon', event: 'stub_' + id }, under: '.' },
        },
      };
      R.DB.events['stub_' + id] = { meta: STUBS[id], run: async () => {} };
    }
    return R;
  };
  wrapped.__stubbed = true;
  return wrapped;
};
