// node shot.js out.png x,y,dir [--phone] [--walk "right:600,up:300"] [--noart]
'use strict';
const B = require('/home/user/others/chronicle/v2/tools/lib/browser');
const a = process.argv.slice(2);
const [out, spawnArg] = a;
const MAP = process.env.MAP || 'pharos';
const phone = a.includes('--phone');
const opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
(async () => {
  const S = await B.start({ dist: process.env.DIST });
  const P = await B.open(S, 'dev.html?fixture=content_p_pharos', Object.assign({ timeout: 90000 }, phone ? { phone: true } : {}));
  const p = P.page;
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 20000);
  await B.ev(p, `(() => { RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; RPG.Game.flags.prologue_berna = true; return 0; })()`);
  if (a.includes('--noart')) await p.evaluate((m) => { RPG.DB.maps[m].art = null; }, MAP);
  const [x, y, d] = spawnArg.split(',');
  await p.evaluate(async ([sp, m]) => { RPG.Field.chunks.reset(); await RPG.Field.enter(m, sp, { fade: 0, noAutosave: true }); }, [{ x: +x, y: +y, dir: d || 's' }, MAP]);
  await p.waitForTimeout(2500);
  const walk = opt('--walk', '');
  for (const st of walk.split(',').filter(Boolean)) {
    const [k, ms] = st.split(':');
    await p.keyboard.down(B.KEY[k]); await p.waitForTimeout(+ms); await p.keyboard.up(B.KEY[k]);
  }
  await p.waitForTimeout(+opt('--post', 1800));
  const pos = await B.ev(p, `(() => { const s = RPG.Field._s; return [s.map && s.map.id, s.x, s.y]; })()`);
  console.log('at', JSON.stringify(pos));
  await B.shot(p, out);
  if (P.errors.length) console.log('errors', P.errors.slice(0, 5).join('\n'));
  await B.stop(S);
})().catch((e) => { console.error(e); process.exit(1); });
