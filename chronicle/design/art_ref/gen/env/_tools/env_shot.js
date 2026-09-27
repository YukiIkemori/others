#!/usr/bin/env node
// Real-engine screenshots with the generated environment assets injected at runtime (v2/src untouched).
//   node env_shot.js <out.png> <map> <spawnName|x,y> [--theme harbor] [--before] [--phone] [--time ms] [--party] [--hideui]
'use strict';
const path = require('path'), fs = require('fs');
const B = require('/home/user/others/chronicle/v2/tools/lib/browser');
const ENV = '/home/user/others/chronicle/v2/assets/env';
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const [out, mapId, spawnArg] = a;
const before = a.includes('--before'), phone = a.includes('--phone');

function manifest() {
  const m = { base: '/__env/', mat: {}, face: {}, props: {}, bld: {}, matIds: [], faceIds: [], propIds: [], bldIds: [] };
  for (const th of fs.readdirSync(ENV)) {
    for (const dir of ['mat', 'props', 'bld']) {
      const d = path.join(ENV, th, dir);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (!f.endsWith('.json')) continue;
        const j = JSON.parse(fs.readFileSync(path.join(d, f)));
        j.kind_dir = dir; j.theme = th;
        const tab = j.kind === 'face' ? 'face' : dir === 'mat' ? 'mat' : dir;
        const id = j.kind === 'face' ? j.style : j.id;
        m[tab][th + '/' + id] = j;
        const ids = m[{ mat: 'matIds', face: 'faceIds', props: 'propIds', bld: 'bldIds' }[tab]];
        if (ids.indexOf(id) < 0) ids.push(id);
        if (tab === 'bld') m.bld[id] = j;
      }
    }
  }
  return m;
}

(async () => {
  const S = await B.start();
  const P = await B.open(S, 'dev.html?fixture=content_p_pharos', phone ? { phone: true } : {});
  const p = P.page;
  await p.route('**/__env/**', (route) => {
    const u = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/__env\//, ''));
    const f = path.join(ENV, u);
    if (!f.startsWith(ENV) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(f) });
  });
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 10000);
  await B.ev(p, `(() => { RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; return 0; })()`);
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'env_inject.js'), 'utf8') });
  const theme = opt('--theme', null) || (await B.ev(p, `(RPG.Terrain.theme(RPG.DB.maps[${JSON.stringify(mapId)}])||{}).id || RPG.DB.maps[${JSON.stringify(mapId)}].theme`));
  if (!before) {
    const r = await p.evaluate(async ([man, th]) => { try { return await window.__envInstall(man, { theme: th, tiles: [32] }); } catch (e) { return String(e.stack || e); } }, [manifest(), theme]);
    console.log('install', theme, JSON.stringify(r));
  }
  let sp = spawnArg;
  if (/^\d+,\d+/.test(spawnArg)) { const [x, y, d] = spawnArg.split(','); sp = { x: +x, y: +y, dir: d || 's' }; }
  await p.evaluate(async ([id, sp]) => { RPG.Field.chunks.reset(); await RPG.Field.enter(id, sp, { fade: 0, noAutosave: true }); }, [mapId, sp]);
  await p.waitForTimeout(+opt('--wait', 3500));
  if (a.includes('--hideui')) await B.ev(p, `(() => { try { RPG.Field.hud && (RPG.Field.hud.hidden = true); } catch (e) {} return 0; })()`);
  await B.shot(p, out);
  if (P.errors.length) console.log('errors', P.errors.slice(0, 5).join('\n'));
  await B.stop(S);
})().catch((e) => { console.error(e); process.exit(1); });
