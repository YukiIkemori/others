// node dump.js <outdir> <mapId> [<mapId> ...]  -> <outdir>/<map>_{albedo,lit,over}.png + <map>_data.json (tile 32; props drawn in albedo/lit)
// env NOPROPS=1: albedo without prop sprites (terrain only). FLAGS='{"flag":true}' sets game flags before rendering.
'use strict';
const fs = require('fs');
const B = require('/home/user/others/chronicle/v2/tools/lib/browser');
const [out, ...ids] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const S = await B.start({ dist: process.env.DIST });
  const P = await B.open(S, 'dev.html?fixture=content_p_pharos', { timeout: 120000 });
  const p = P.page;
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 30000);
  await B.ev(p, `(() => { RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; Object.assign(RPG.Game.flags, ${process.env.FLAGS || '{}'}); return 0; })()`);
  for (const mapId of ids) {
    await p.evaluate(async (id) => { RPG.Field.chunks.reset(); await RPG.Field.enter(id, 'warp', { fade: 0, noAutosave: true }); }, mapId);
    await p.waitForTimeout(1500);
    const res = await p.evaluate(async ([id, noProps]) => {
      const R = RPG, T = R.Terrain, map = R.DB.maps[id], t = 32, C = T.CHUNK;
      const W = map.w * t, H = map.h * t;
      const out = {};
      for (const light of [false, true]) {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
        const ov = document.createElement('canvas'); ov.width = W; ov.height = H; const og = ov.getContext('2d');
        for (let cy = 0; cy < Math.ceil(map.h / C); cy++) for (let cx = 0; cx < Math.ceil(map.w / C); cx++) {
          const j = T.bakeChunk(map, cx, cy, { tile: t, noLight: !light, noUnder: !!window.__noUnder });
          let n = 0; while (!j.step(50) && n++ < 4000) await new Promise((r) => setTimeout(r, 0));
          const r = j.result;
          if (r.base) g.drawImage(r.base, r.x, r.y);
          if (r.over) og.drawImage(r.over, r.x, r.y);
          if (!(noProps && !light)) for (const pr of r.props || []) { try { const sh = R.Hd.now(pr.key, pr.opts); const fr = T._frameOf(sh, pr.frame); g.drawImage(fr.c, Math.round(pr.x - fr.ox), Math.round(pr.y - fr.oy)); } catch (e) {} }
        }
        g.drawImage(ov, 0, 0);
        out[light ? 'lit' : 'albedo'] = cv.toDataURL('image/png');
        if (!light) out.over = ov.toDataURL('image/png');
      }
      const rows = R.MapUtil.grid(map);
      const walk = [];
      for (let y = 0; y < map.h; y++) { let s = ''; for (let x = 0; x < map.w; x++) s += R.Field._walkable(map, x, y, null, 0) ? '.' : '#'; walk.push(s); }
      const lg = {}; for (const [k, v] of Object.entries(map.legend || {})) lg[k] = { mat: v.mat, solid: !!v.solid, walk: v.walk, rise: v.rise, secret: !!v.secret, name: v.name };
      out.data = { id, w: map.w, h: map.h, kind: map.kind, rows, legend: lg, objects: map.objects, npcs: map.npcs, spawns: map.spawns, exits: map.exits, triggers: map.triggers, tilePatches: map.tilePatches, walk, dark: map.dark, outside: map.outside };
      return out;
    }, [mapId, !!process.env.NOPROPS]);
    for (const k of ['albedo', 'lit', 'over']) fs.writeFileSync(`${out}/${mapId}_${k}.png`, Buffer.from(res[k].split(',')[1], 'base64'));
    fs.writeFileSync(`${out}/${mapId}_data.json`, JSON.stringify(res.data, null, 1));
    console.log('dumped', mapId, res.data.w, res.data.h);
  }
  if (P.errors.length) console.log('errors', P.errors.slice(0, 5).join('\n'));
  await B.stop(S);
})().catch((e) => { console.error(e); process.exit(1); });
