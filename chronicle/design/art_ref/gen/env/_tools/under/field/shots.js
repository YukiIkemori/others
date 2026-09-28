// In-game screenshots of the FIELD areas (real engine, built dist/).
// usage: node shots.js <outdir> <plan.json>   plan = [{name, map, spawn | x,y, phone?, walk?: [[key, ms]...], js?: 'code', wait?: ms, battle?: true}]
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('/home/user/others/chronicle/v2/tools/lib/browser');
const [outdir, planFile] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
fs.mkdirSync(outdir, { recursive: true });
(async () => {
  const S = await B.start();
  const pages = {};
  for (const st of plan) {
    const kind = st.phone ? 'phone' : 'pc';
    if (!pages[kind]) {
      pages[kind] = await B.open(S, 'dev.html?fixture=content_p_pharos', { timeout: 120000, phone: !!st.phone });
      await B.waitFor(pages[kind].page, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 60000);
      await B.ev(pages[kind].page, `(() => { RPG.Game.flags.prologue_done = true; return 0; })()`);
    }
    const P = pages[kind], p = P.page;
    const noenc = st.battle ? '' : 'RPG.Mon.encounter = RPG.Mon._enc0 || RPG.Mon.encounter; RPG.Mon._enc0 = RPG.Mon._enc0 || RPG.Mon.encounter; RPG.Mon.encounter = () => null;';
    await B.ev(p, `(() => { ${noenc} ${st.js || ''}; return 0; })()`);
    const sp = st.spawn ? JSON.stringify(st.spawn) : JSON.stringify({ x: st.x, y: st.y, dir: st.dir || 's' });
    if (st.map) {
      await p.evaluate(async ([id, sp]) => { await RPG.Field.enter(id, sp, { fade: 0, noAutosave: true }); }, [st.map, JSON.parse(sp)]);
      await B.waitFor(p, `${B.TOP}==='field'`, 30000);
    }
    await p.waitForTimeout(st.wait || 2500);
    for (const [k, ms] of st.walk || []) { await p.keyboard.down(B.KEY ? B.KEY[k] : k); await p.waitForTimeout(ms); await p.keyboard.up(B.KEY ? B.KEY[k] : k); await p.waitForTimeout(120); }
    if (st.walk) await p.waitForTimeout(st.after || 1500);
    const info = await B.ev(p, `(() => { const s = RPG.Field._s; return { top: ${B.TOP}, map: s.map && s.map.id, x: s.x, y: s.y, art: s.stat && s.stat.artWait }; })()`);
    await B.shot(p, path.join(outdir, st.name + '.png'));
    console.log(st.name, JSON.stringify(info));
  }
  for (const k of Object.keys(pages)) if (pages[k].errors.length) console.log(k, 'errors', pages[k].errors.slice(0, 6).join('\n'));
  await B.stop(S);
})().catch((e) => { console.error(e); process.exit(1); });
