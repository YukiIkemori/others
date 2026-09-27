#!/usr/bin/env node
// 砂漠の戸口・出口・階段を本物の入力で通る（ブラウザ。dist/dev.html が要る = tools/build.js の後）。
//   node v2/tools/test_desert_doors_browser.js   → 行き先のマップに入れたら ok、入れなければ FAIL（終了コード 1）

const path = require('path');
const Bw = require('./lib/browser');
let failed = 0;
const log = (l) => { if (/^FAIL/.test(l)) failed++; console.log(l); };
(async () => {
  const S = await Bw.start();
  const P = await Bw.open(S, 'dev.html?fixture=content_d_kasim', { size: [960, 540], timeout: 60000 });
  const page = P.page;
  await page.waitForFunction("RPG.Engine.top() && RPG.Engine.top().id==='field' && RPG.Engine.fade.a<0.02", null, { timeout: 60000 });
  const list = await page.evaluate(() => {
    const R = window.RPG, out = [];
    for (const id of ['kasim', 'sandedge', 'world']) {
      const m = R.DB.maps[id];
      for (const o of m.objects || []) {
        const d = o.type === 'building' ? o.door : o.type === 'door' ? o : null;
        if (!d || !d.to) continue;
        if (id === 'world' && !(d.x >= 8 && d.x <= 95 && d.y >= 118 && d.y <= 166)) continue;
        out.push({ map: id, x: d.x, y: d.y, to: d.to.map, back: true });
      }
    }
    return out;
  });
  const res = [];
  const walk = async (map, x, y, dir, key, want) => {
    await page.evaluate(async ([map, x, y, dir]) => { const R = window.RPG; R.Engine.clear && 0; await R.Field.enter(map, { x, y, dir }, { fade: 0, noAutosave: true }); }, [map, x, y, dir]);
    await page.waitForTimeout(300);
    await page.evaluate((k) => window.RPG.Input._set(k, true), key);
    let ok = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(100);
      const cur = await page.evaluate(() => { const R = window.RPG; if (R.Events.busy()) R.Input._set('a', !R.Input._aa), R.Input._aa = !R.Input._aa; return R.Field.pos && R.Field.pos.map; });
      if (cur === want) { ok = true; break; }
    }
    await page.evaluate((k) => { window.RPG.Input._set(k, false); window.RPG.Input._set('a', false); }, key);
    await page.waitForTimeout(400);
    return ok;
  };
  const ex = await page.evaluate(() => {
    const R = window.RPG, out = [];
    for (const [id, m] of Object.entries(R.DB.maps)) {
      if (!/^(desert_|kasim|sandedge|world$)/.test(id)) continue;
      for (const e of m.exits || []) {
        if (id === 'world' && !(e.x >= 8 && e.x <= 95 && e.y >= 118 && e.y <= 166)) continue;
        if (e.cond && !R.State.check(e.cond)) continue;
        // 出口の隣の歩けるマス（出口へ向かう向き）
        let st = null;
        for (const [dx, dy, dir, key] of [[0, -1, 's', 'down'], [0, 1, 'n', 'up'], [-1, 0, 'e', 'right'], [1, 0, 'w', 'left']]) {
          const x = e.x + dx, y = e.y + dy;
          const inExit = x >= e.x && x < e.x + (e.w || 1) && y >= e.y && y < e.y + (e.h || 1);
          if (!inExit && R.Field._walkable(m, x, y, null, 0) && !(R.MapUtil.objectsAt(m, x, y, 0) || []).some((o) => o.type !== 'prop' || (R.DB.props[o.id] || {}).solid !== false)) { st = { x, y, dir, key }; break; }
        }
        out.push({ map: id, x: e.x, y: e.y, to: e.to.map, st });
      }
    }
    return out;
  });
  for (const e of ex) {
    if (!e.st) { log(`FAIL ${e.map} exit ${e.x},${e.y} → ${e.to}: no walkable cell next to it`); continue; }
    const ok = await walk(e.map, e.st.x, e.st.y, e.st.dir, e.st.key, e.to);
    log(`${ok ? 'ok  ' : 'FAIL'} ${e.map} exit ${e.x},${e.y} → ${e.to}`);
  }
  const stairs = await page.evaluate(() => {
    const R = window.RPG, G = R.Game, out = [];
    Object.assign(G.flags, { desert_camp3_done: true, cleared_r_desert: true, desert_worm: true, desert_t1_sw_w: true, desert_t1_sw_e: true });
    R.MapUtil.invalidate && R.MapUtil.invalidate();
    for (const [id, m] of Object.entries(R.DB.maps)) {
      if (!/^(desert_|world$)/.test(id)) continue;
      for (const o of m.objects || []) {
        if (o.type !== 'stairs' || !o.to) continue;
        if (id === 'world' && !(o.x >= 8 && o.x <= 95 && o.y >= 118 && o.y <= 166)) continue;
        if (o.cond && !R.State.check(o.cond)) continue;
        let st = null;
        for (const [dx, dy, dir, key] of [[0, 1, 'n', 'up'], [0, -1, 's', 'down'], [-1, 0, 'e', 'right'], [1, 0, 'w', 'left']]) {
          const x = o.x + dx, y = o.y + dy;
          if (R.Field._walkable(m, x, y, null, 0) && !(R.MapUtil.objectsAt(m, x, y, 0) || []).length) { st = { x, y, dir, key }; break; }
        }
        out.push({ map: id, x: o.x, y: o.y, to: o.to.map, st });
      }
    }
    return out;
  });
  for (const e of stairs) {
    if (!e.st) { log(`FAIL ${e.map} stairs ${e.x},${e.y} → ${e.to}: no free cell next to it`); continue; }
    const ok = await walk(e.map, e.st.x, e.st.y, e.st.dir, e.st.key, e.to);
    log(`${ok ? 'ok  ' : 'FAIL'} ${e.map} stairs ${e.x},${e.y} → ${e.to}`);
  }
  for (const d of list) {
    const ok = await walk(d.map, d.x, d.y + 1, 'n', 'up', d.to);
    let back = null;
    if (ok && d.to !== 'world') {
      const sp = await page.evaluate((to) => { const m = window.RPG.DB.maps[to]; const s = m.spawns.door || m.spawns.gate || Object.values(m.spawns)[0]; return { x: s.x, y: s.y }; }, d.to);
      back = await walk(d.to, sp.x, sp.y, 's', 'down', d.map);
    }
    res.push(`${ok ? 'ok  ' : 'FAIL'} ${d.map} door ${d.x},${d.y} → ${d.to}${back == null ? '' : back ? ' (and back out)' : ' (BACK FAILED)'}`);
    log(res[res.length - 1]);
  }
  console.log('errors', P.errors.slice(0, 5));
  await P.close();
  await Bw.stop(S);
  console.log(`\ntest_desert_doors_browser: ${failed ? failed + ' failed' : 'all passed'}`);
  if (failed || P.errors.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
