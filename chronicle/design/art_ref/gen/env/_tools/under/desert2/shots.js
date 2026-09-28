// node shots.js <spots.json> : [{map, x, y, out, flags?:{}, size?:[w,h]}] -> in-game screenshots (one browser)
'use strict';
const fs = require('fs');
const B = require('/home/user/others/chronicle/v2/tools/lib/browser');
const spots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  const S = await B.start({ dist: process.env.DIST });
  const P = await B.open(S, 'dev.html?fixture=content_p_pharos', { timeout: 120000, size: [1280, 720] });
  const p = P.page;
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 30000);
  await B.ev(p, `(() => { RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; return 0; })()`);
  for (const s of spots) {
    await p.evaluate(async (s) => {
      const f = RPG.Game.flags; for (const k of Object.keys(s.flags || {})) f[k] = s.flags[k]; if (s.pre) (0, eval)(s.pre);
      RPG.Field.chunks.reset(); await RPG.Field.enter(s.map, { x: s.x, y: s.y, dir: s.dir || 's' }, { fade: 0, noAutosave: true });
    }, s);
    await p.waitForTimeout(s.wait || 3000);
    await B.shot(p, s.out);
    console.log('shot', s.map, s.out);
  }
  if (P.errors.length) console.log('errors', P.errors.slice(0, 8).join('\n'));
  await B.stop(S);
})().catch((e) => { console.error(e); process.exit(1); });
