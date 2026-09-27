// node dump.js fern out.json : map data for guide/process (node only)
const fs = require('fs');
const R = require('/home/user/others/chronicle/v2/tools/lib/load')({ quiet: true });
R.State.newGame({ hero: { type: 'fighter', sex: 'm', name: 'テスト' }, seed: 1 });
const id = process.argv[2], m = R.DB.maps[id];
const rows = R.MapUtil.grid(m), walk = [];
for (let y = 0; y < m.h; y++) { let s = ''; for (let x = 0; x < m.w; x++) s += R.Field._walkable(m, x, y, null, 0) ? '.' : (R.Field._walkable(m, x, y, null, 1) ? '=' : '#'); walk.push(s); }
fs.writeFileSync(process.argv[3], JSON.stringify({ id, w: m.w, h: m.h, rows, legend: m.legend, objects: m.objects, npcs: m.npcs, spawns: m.spawns, exits: m.exits, walk }, null, 1));
