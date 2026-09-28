// node fullmap.js <mapsDir> <mapId> [<mapId> ...] -> <mapsDir>/<mapId>/layout_*   (copy of ../dungeon/fullmap.js, several maps per browser)
'use strict';
const fs = require('fs');
const B = require('/home/user/others/chronicle/v2/tools/lib/browser');
const [root, ...ids] = process.argv.slice(2);
(async () => {
  const S = await B.start({ dist: process.env.DIST });
  const P = await B.open(S, 'dev.html?fixture=content_p_pharos', { timeout: 120000 });
  const p = P.page;
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 15000);
  await B.ev(p, `(() => { RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; return 0; })()`);
  for (const mapId of ids) {
  const out = root + '/' + mapId + '/layout'; fs.mkdirSync(root + '/' + mapId, { recursive: true });
  await p.evaluate(async (id) => { RPG.Field.chunks.reset(); await RPG.Field.enter(id, 'warp', { fade: 0, noAutosave: true }); }, mapId);
  await p.waitForTimeout(1500);
  const res = await p.evaluate(async ([id, lightFlag]) => {
    const R = RPG, T = R.Terrain, map = R.DB.maps[id], t = 32, C = T.CHUNK;
    const W = map.w * t, H = map.h * t;
    const out = {};
    for (const light of [false, true]) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
      const ov = document.createElement('canvas'); ov.width = W; ov.height = H; const og = ov.getContext('2d');
      for (let cy = 0; cy < Math.ceil(map.h / C); cy++) for (let cx = 0; cx < Math.ceil(map.w / C); cx++) {
        const j = T.bakeChunk(map, cx, cy, { tile: t, noLight: !light });
        let n = 0; while (!j.step(50) && n++ < 2000) await new Promise((r) => setTimeout(r, 0));
        const r = j.result;
        if (r.base) g.drawImage(r.base, r.x, r.y);
        if (r.over) og.drawImage(r.over, r.x, r.y);
        for (const pr of r.props || []) { try { const sh = R.Hd.now(pr.key, pr.opts); const fr = T._frameOf(sh, pr.frame); g.drawImage(fr.c, Math.round(pr.x - fr.ox), Math.round(pr.y - fr.oy)); } catch (e) {} }
      }
      g.drawImage(ov, 0, 0);
      out[light ? 'lit' : 'albedo'] = cv.toDataURL('image/png');
      out[light ? 'lit_over' : 'over'] = ov.toDataURL('image/png');
    }
    // data
    const rows = R.MapUtil.grid(map);
    const walk = [];
    for (let y = 0; y < map.h; y++) { let s = ''; for (let x = 0; x < map.w; x++) s += R.Field._walkable(map, x, y, null, 0) ? '.' : '#'; walk.push(s); }
    out.data = { id, w: map.w, h: map.h, rows, legend: map.legend, objects: map.objects, npcs: map.npcs, spawns: map.spawns, exits: map.exits, walk, props: Object.fromEntries(Object.keys(R.DB.props || {}).map((k) => [k, R.DB.props[k]])),
      tilePatches: map.tilePatches || [], oneway: map.oneway || [], dark: map.dark || null, light: map.light, theme: map.theme, outside: map.outside,
      areas: (R.MapUtil.secretAreas(map) || []).map((a) => ({ gate: a.gate, cells: a.cells, parent: a.parent })),
      mats: Object.fromEntries(Object.values(map.legend).map((e) => e.mat).concat([map.outside]).map((m) => [m, T._matInfo(m)])) };
    return out;
  }, [mapId]);
  for (const k of ['albedo', 'lit', 'over', 'lit_over']) fs.writeFileSync(out + '_' + k + '.png', Buffer.from(res[k].split(',')[1], 'base64'));
  fs.writeFileSync(out + '_data.json', JSON.stringify(res.data, null, 1));
  console.log('dumped', mapId);
  }
  if (P.errors.length) console.log('errors', P.errors.slice(0, 5).join('\n'));
  await B.stop(S);
})().catch((e) => { console.error(e); process.exit(1); });
