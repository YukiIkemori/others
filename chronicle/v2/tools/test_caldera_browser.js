#!/usr/bin/env node
// 炎の町カルデラを本物の入力で歩く（ブラウザ。dist/dev.html が要る = tools/build.js の後）。2026-10-01（四角い段の町に描き直した時）
//   1 西の門から、建物の戸口すべてへ道を歩いて入り、屋内の出口から出て、町の戸の前へ戻る
//   2 溶岩の堀・段の崖・岩の縁・湯のとなりのマスから、その向きへ押しても入れない（壁・溶岩を通り抜けない）
//   3 人が歩けるマスに立っている（壁・建物・溶岩の中にいない）
//   node v2/tools/test_caldera_browser.js   → FAIL があれば終了コード 1
'use strict';
const Bw = require('./lib/browser');
let failed = 0, passed = 0;
const ok = (name, cond, info) => { if (cond) { passed++; console.log('pass  ' + name); } else { failed++; console.log('FAIL  ' + name + (info ? '  ' + JSON.stringify(info).slice(0, 300) : '')); } };
(async () => {
  const S = await Bw.start();
  const P = await Bw.open(S, 'dev.html?fixture=content_d_kasim', { size: [960, 540], timeout: +process.env.V2_OPEN_TIMEOUT || 90000 });
  const page = P.page;
  await page.waitForFunction("RPG.Engine.top() && RPG.Engine.top().id==='field' && RPG.Engine.fade.a<0.02", null, { timeout: 60000 });
  await page.evaluate(() => { RPG.DB.config.slice = false; RPG.MapUtil.invalidate && RPG.MapUtil.invalidate(); });
  const enter = (map, x, y, dir) => page.evaluate(async ([map, x, y, dir]) => { await RPG.Field.enter(map, { x, y, dir }, { fade: 0, noAutosave: true }); }, [map, x, y, dir]);
  const pos = () => page.evaluate(() => { const p = RPG.Field.pos || {}; return { map: p.map, x: p.x, y: p.y }; });
  // 会話・説明が出ていたら閉じる
  const settle = async () => { for (let i = 0; i < 20; i++) { const busy = await page.evaluate(() => (RPG.Engine.top() || {}).id !== 'field' || RPG.Events.busy()); if (!busy) return; await Bw.press(page, 'a'); await page.waitForTimeout(120); } };
  // 1 歩: キーを押して、マスが変わる（か、行き先のマップに入る）まで待つ
  const step = async (key) => {
    const a = await pos();
    await page.evaluate((k) => RPG.Input._set(k, true), key);
    let b = a;
    for (let i = 0; i < 25; i++) { await page.waitForTimeout(40); b = await pos(); if (b.map !== a.map || b.x !== a.x || b.y !== a.y) break; }
    await page.evaluate((k) => RPG.Input._set(k, false), key);
    await page.waitForTimeout(60);
    return b;
  };
  const KEY = { '0,-1': 'up', '0,1': 'down', '-1,0': 'left', '1,0': 'right' };
  // 町の当たりで道を探す（人のいるマスはよける）
  const route = (fx, fy, tx, ty) => page.evaluate(([fx, fy, tx, ty]) => {
    const R = RPG, m = R.DB.maps.caldera, F = R.Field, prev = {}, q = [[fx, fy]]; prev[fx + ',' + fy] = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const u = x + dx, v = y + dy, k = u + ',' + v;
        if (k in prev || !F._walkable(m, u, v, null, 0) || F._npcAt(u, v, 0)) continue;
        if ((R.MapUtil.objectsAt(m, u, v, 0) || []).some((o) => o.type === 'building' && !(o.door && o.door.x === u && o.door.y === v))) continue;
        prev[k] = [x, y]; q.push([u, v]);
      }
    }
    if (!((tx + ',' + ty) in prev)) return null;
    const path = []; let c = [tx, ty];
    while (c) { path.unshift(c); c = prev[c[0] + ',' + c[1]]; }
    return path;
  }, [fx, fy, tx, ty]);
  const walkTo = async (tx, ty) => {
    for (let tries = 0; tries < 4; tries++) {
      let p = await pos();
      const path = await route(p.x, p.y, tx, ty);
      if (!path) return false;
      for (let i = 1; i < path.length; i++) {
        const [x, y] = path[i]; p = await pos();
        const k = KEY[(x - p.x) + ',' + (y - p.y)];
        if (!k) break;
        const b = await step(k);
        if (b.x !== x || b.y !== y) { await settle(); break; }   // 人が前に出た・会話: 道を探し直す
      }
      p = await pos();
      if (p.x === tx && p.y === ty) return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- 1 戸口すべて
  const doors = await page.evaluate(() => RPG.DB.maps.caldera.objects.filter((o) => o.type === 'building').map((o) => ({ id: o.id, x: o.door.x, y: o.door.y, to: o.door.to.map })));
  await enter('caldera', 2, 26, 'e'); await page.waitForTimeout(500); await settle();
  for (const d of doors) {
    const got = await walkTo(d.x, d.y + 1);
    if (!got) { ok(`${d.id}: 西の門から戸の前 (${d.x},${d.y + 1}) へ歩ける`, false, await pos()); continue; }
    let b = await step('up');
    for (let i = 0; i < 20 && b.map === 'caldera'; i++) { await page.waitForTimeout(100); b = await pos(); }
    await page.waitForTimeout(400); await settle();
    const inside = (await pos()).map;
    ok(`${d.id}: 戸口 (${d.x},${d.y}) から ${d.to} に入る`, inside === d.to, inside);
    // 屋内の出口から出る（下へ歩く）
    let out = await pos();
    for (let i = 0; i < 16 && out.map !== 'caldera'; i++) { out = await step('down'); if (out.map !== 'caldera') { await page.waitForTimeout(60); out = await pos(); } }
    for (let i = 0; i < 20 && out.map !== 'caldera'; i++) { await page.waitForTimeout(100); out = await pos(); }
    await page.waitForTimeout(400); await settle(); out = await pos();
    ok(`${d.id}: 屋内から出て、町の戸の前 (${d.x},${d.y + 1}) に戻る`, out.map === 'caldera' && out.x === d.x && out.y === d.y + 1, out);
  }

  // ---------------------------------------------------------------- 2 縁から押しても入れない
  const edges = await page.evaluate(() => {
    const R = RPG, m = R.DB.maps.caldera, F = R.Field, out = {};
    const ch = (x, y) => (m.rows[y] || [])[x];
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      if (!F._walkable(m, x, y, null, 0) || (R.MapUtil.objectsAt(m, x, y, 0) || []).length) continue;
      for (const [dx, dy, key] of [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']]) {
        const c = ch(x + dx, y + dy);
        if (!'%FMh'.includes(c) || F._walkable(m, x + dx, y + dy, null, 0)) continue;
        (out[c] = out[c] || []).push({ x, y, key, c });
      }
    }
    // 種類ごとに 12 か所ずつ（散らす）
    const pick = [];
    for (const c of Object.keys(out)) { const L = out[c], n = Math.min(12, L.length); for (let i = 0; i < n; i++) pick.push(L[Math.floor((i * L.length) / n)]); }
    return pick;
  });
  const leak = [];
  for (const e of edges) {
    await enter('caldera', e.x, e.y, 's'); await page.waitForTimeout(150); await settle();
    const b = await step(e.key);
    await page.waitForTimeout(150);
    const c = await pos();
    if (c.x !== e.x || c.y !== e.y) leak.push(Object.assign({ to: [c.x, c.y] }, e));
  }
  ok(`溶岩・崖・岩・湯の縁 ${edges.length} か所から押しても入れない`, edges.length >= 30 && leak.length === 0, leak);

  // ---------------------------------------------------------------- 3 人の立つマス
  const badNpc = await page.evaluate(() => {
    const R = RPG, m = R.DB.maps.caldera, F = R.Field;
    return (m.npcs || []).filter((n) => !R.MapUtil.cell(m, n.x, n.y) || !F.passable(m, n.x, n.y, null, 0) ||
      (R.MapUtil.objectsAt(m, n.x, n.y, 0) || []).some((o) => o.type === 'building')).map((n) => `${n.id} ${n.x},${n.y}`);
  });
  ok('町の人はみな歩けるマスに立つ（壁・建物・溶岩の中にいない）', badNpc.length === 0, badNpc);
  ok('ページのエラー 0', P.errors.length === 0, P.errors.slice(0, 3));
  await Bw.stop(S);
  console.log(`\ntest_caldera_browser: ${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
