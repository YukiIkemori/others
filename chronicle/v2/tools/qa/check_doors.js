#!/usr/bin/env node
// QA: 戸口・扉・階段・出口を「本物の入力」で通る（ブラウザ。dist/dev.html が要る = node v2/tools/build.js の後）。
// オーナーの報告「最初の町、自分の家以外、扉が開かない」の再発を止める。ワープやフィクスチャで行き先へ飛ばさず、
// 手前のマス（数歩はなれた所）に立たせてから、キーボード（矢印キー）で 1 歩ずつ歩いて戸口に入り、マップが行き先に変わることを確かめる。
//
//   node v2/tools/qa/check_doors.js [--all] [--map id,…] [--jobs 3] [--fixture content_p_pharos] [--shots]
//
// 対象: check_reach.js と同じ縦切りのマップ（砂漠と雪は --all のときだけ）の、行き先のある物（建物の戸口・扉・階段・出口）。
// cond が今の状態（フィクスチャ）で偽の物は数えるだけ。道は FIELD の当たり（R.Field._canEnter・人）でページの中で引き、押すのは keyboard。
// 書き出し: v2/design/qa/check_doors.json
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('../lib/browser');

const V2 = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ALL = argv.includes('--all');
const ONLY = arg('--map', null);
const JOBS = Math.max(1, +arg('--jobs', 3));
const FIXTURE = arg('--fixture', 'content_p_pharos');
const KEY = { n: 'ArrowUp', s: 'ArrowDown', w: 'ArrowLeft', e: 'ArrowRight' };
const FREE = "((RPG.Engine.top()||{}).id==='field' && !RPG.Events.busy() && !RPG.UIK.Message.busy() && Object.keys(RPG.Field.locks()).length===0 && RPG.Engine.fade.a < 0.02)";

// ---------------------------------------------------------------- ページの中: 出入り口の一覧と、道
const PAGE_LIB = function () {
  const R = window.RPG, F = R.Field;
  const D = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  const isOther = (id, m) => /^(desert_|snow_)/.test(id) || /desert|snow/.test(m.region || '') || /desert|snow/.test(m.theme || '');
  const check = (c) => { if (c == null) return true; try { return !!R.State.check(c); } catch (e) { return false; } };
  window.__enters = 0;
  R.on('map:enter', () => { window.__enters++; });
  window.__doors = {
    list(all, only) {
      const out = [];
      for (const id of Object.keys(R.DB.maps).sort()) {
        const m = R.DB.maps[id];
        if (/^(stub_|field_|t_)/.test(id) || (!all && isOther(id, m)) || (only && !only.includes(id))) continue;
        for (const o of m.objects || []) {
          if (o.type === 'building' && o.door && o.door.to) out.push({ map: id, kind: 'door', id: o.id, cells: [[o.door.x, o.door.y]], lv: o.lv || 0, to: o.door.to.map, cond: o.cond, on: check(o.cond) });
          else if ((o.type === 'door' || o.type === 'stairs') && o.to) out.push({ map: id, kind: o.type, id: o.id || '', cells: [[o.x, o.y]], lv: o.lv || 0, to: o.to.map, cond: o.cond, on: check(o.cond) });
        }
        for (const e of m.exits || []) {
          const cells = [];
          for (let j = 0; j < (e.h || 1); j++) for (let i = 0; i < (e.w || 1); i++) cells.push([e.x + i, e.y + j]);
          out.push({ map: id, kind: 'exit', id: e.x + ',' + e.y, cells, lv: 0, to: e.to.map, cond: e.cond, on: check(e.cond) });
        }
      }
      return out;
    },
    /** (x, y, lv) から 4 方向に歩く BFS（FIELD の当たりと今いる人）。targets のどれかに入る最短の向きの列 */
    path(targets, avoidWarps) {
      const S = F._s, m = S.map, key = (x, y, lv) => x + ',' + y + ',' + lv;
      const tset = new Set(targets.map(([x, y]) => x + ',' + y));
      const prev = new Map(); prev.set(key(S.x, S.y, S.lv || 0), null);
      const q = [[S.x, S.y, S.lv || 0]];
      for (let i = 0; i < q.length; i++) {
        const [x, y, lv] = q[i];
        for (const d of ['n', 's', 'w', 'e']) {
          const nx = x + D[d][0], ny = y + D[d][1];
          if (!F._canEnter(m, x, y, nx, ny, lv, d)) continue;
          const nlv = F._lvAfter(m, x, y, nx, ny, lv), k = key(nx, ny, nlv);
          if (prev.has(k)) continue;
          if (F._npcAt(nx, ny, nlv)) continue;
          prev.set(k, [key(x, y, lv), d]);
          if (tset.has(nx + ',' + ny)) {
            const out = []; let c = k;
            while (prev.get(c)) { out.unshift(prev.get(c)[1]); c = prev.get(c)[0]; }
            return out;
          }
          if (avoidWarps && F._warpAt(m, nx, ny, nlv)) continue;   // ほかの出入り口のマスは通り抜けない（そこで移ってしまう）
          q.push([nx, ny, nlv]);
        }
      }
      return null;
    },
    /** 出入り口から歩いて 4〜6 歩はなれた、立てるマス（ほかの出入り口と人のいない所）→ {x, y, lv, d} | null */
    start(p, want) {
      const map = R.DB.maps[p.map], key = (x, y, lv) => x + ',' + y + ',' + lv;
      const seen = new Map(), q = [];
      // 出入り口の手前のマス（出入り口へ入れるマス）から逆に広げる
      for (const [cx, cy] of p.cells) for (const d of ['n', 's', 'w', 'e']) {
        const fx = cx - D[d][0], fy = cy - D[d][1];
        if (p.cells.some(([a, b]) => a === fx && b === fy)) continue;
        for (const lv of [p.lv, 0, 1]) {
          if (!F._walkable(map, fx, fy, null, lv) || F._warpAt(map, fx, fy, lv) || !F._canEnter(map, fx, fy, cx, cy, lv, d)) continue;
          const k = key(fx, fy, lv); if (seen.has(k)) continue; seen.set(k, 1); q.push([fx, fy, lv, 1]);
        }
      }
      let best = null;
      const npcAt = (x, y) => (map.npcs || []).some((n) => n.x === x && n.y === y && check(n.cond));
      for (let i = 0; i < q.length; i++) {
        const [x, y, lv, d] = q[i];
        if (!npcAt(x, y) && (!best || (d <= want && d > best.d))) best = { x, y, lv, d };
        if (d >= want) continue;
        for (const dd of ['n', 's', 'w', 'e']) {
          const nx = x + D[dd][0], ny = y + D[dd][1];
          if (!F._walkable(map, nx, ny, null, lv) || F._warpAt(map, nx, ny, lv)) continue;
          if (!F._canEnter(map, nx, ny, x, y, lv, ({ n: 's', s: 'n', w: 'e', e: 'w' })[dd])) continue;
          const k = key(nx, ny, lv); if (seen.has(k)) continue; seen.set(k, 1); q.push([nx, ny, lv, d + 1]);
        }
      }
      return best;
    },
  };
};

async function settle(p) {
  for (let i = 0; i < 300; i++) {
    if (await p.evaluate(FREE)) return true;
    const busy = await p.evaluate("RPG.Events.busy() || RPG.UIK.Message.busy() || (RPG.Engine.top()||{}).id!=='field'");
    if (busy) { await p.keyboard.down('KeyZ'); await p.waitForTimeout(50); await p.keyboard.up('KeyZ'); }
    await p.waitForTimeout(120);
  }
  return false;
}
const pos = (p) => p.evaluate(() => { const s = RPG.Field._s; return { m: s.map && s.map.id, x: s.x, y: s.y, lv: s.lv || 0 }; });

/** キーボードで 1 歩ずつ歩いて出入り口に入る → {ok, steps, why?, at} */
async function walkInto(p, portal) {
  const from = await pos(p);
  const enters0 = await p.evaluate(() => window.__enters || 0);
  const entered = async () => (await p.evaluate(() => window.__enters || 0)) > enters0;   // 同じマップへの出口（迷いの森の輪）も数える
  let steps = 0;
  for (let guard = 0; guard < 80; guard++) {
    await settle(p);
    const st = await pos(p);
    if (st.m === from.m && portal.to === from.m && (await entered())) return { ok: true, steps, at: st.m };
    if (st.m !== from.m) return { ok: st.m === portal.to, steps, at: st.m, why: st.m === portal.to ? null : 'went to ' + st.m };
    const route = await p.evaluate(([cells]) => window.__doors.path(cells, true), [portal.cells]);
    if (!route || !route.length) return { ok: false, steps, why: 'no path from ' + st.x + ',' + st.y };
    const d = route[0];
    await p.keyboard.down(KEY[d]);
    let moved = false;
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(20);
      const s2 = await pos(p);
      if (s2.x !== st.x || s2.y !== st.y || s2.m !== st.m) { moved = true; break; }
    }
    await p.keyboard.up(KEY[d]);
    steps++;
    if (!moved) {
      // 人が通り道に来た・場面が開いた: 少し待って引き直す（2 回続けて動けなければ失敗）
      await p.waitForTimeout(400);
      const again = await pos(p);
      if (again.x === st.x && again.y === st.y && again.m === st.m && (await p.evaluate(FREE))) {
        if ((walkInto._stuck = (walkInto._stuck || 0) + 1) >= 3) { walkInto._stuck = 0; return { ok: false, steps, why: `stuck at ${st.x},${st.y} pressing ${d}` }; }
      }
      continue;
    }
    walkInto._stuck = 0;
    // 出入り口に入ったら、移るのを待つ（暗転）
    const s3 = await pos(p);
    if (portal.cells.some(([x, y]) => x === s3.x && y === s3.y) && s3.m === from.m) {
      for (let i = 0; i < 60; i++) { await p.waitForTimeout(100); const s4 = await pos(p); if (s4.m !== from.m || (await entered())) break; }
    }
  }
  return { ok: false, steps, why: 'too many steps' };
}

async function worker(S, jobs, results, shots) {
  const P = await B.open(S, 'dev.html?fixture=' + FIXTURE, { size: [960, 540], timeout: 60000 });
  const p = P.page;
  await p.evaluate(PAGE_LIB);
  await p.evaluate(() => { try { RPG.Settings.set('alwaysDash', true); RPG.Settings.set('textSpeed', 'instant'); } catch (e) { /* */ } });
  await settle(p);
  while (jobs.length) {
    const d = jobs.shift();
    const t0 = Date.now();
    let r;
    try {
      const st = await p.evaluate(([dd]) => window.__doors.start(dd, 4), [d]);
      if (!st) r = { ok: false, why: 'no cell to stand before it' };
      else {
        await p.evaluate(async ([map, x, y, lv]) => {
          await RPG.Field.enter(map, { x, y, dir: 's', lv }, { fade: 0, noAutosave: true });
          RPG.Field.encounter.suppress(100000);
        }, [d.map, st.x, st.y, st.lv]);
        await p.waitForTimeout(250);
        await settle(p);
        const here = await pos(p);
        if (here.m !== d.map) r = { ok: false, why: 'setup: not on ' + d.map + ' (on ' + here.m + ')' };
        else {
          r = await walkInto(p, d);
          r.start = [st.x, st.y];
          if (r.ok && shots && d.kind === 'door') await B.shot(p, path.join(V2, 'design', 'shots', 'qa_doors', `${d.map}_${d.id}.png`));
        }
      }
    } catch (e) { r = { ok: false, why: String(e && e.message || e).slice(0, 200) }; }
    r.ms = Date.now() - t0;
    const line = `${r.ok ? 'pass' : 'FAIL'}  ${d.map} ${d.kind} ${d.id} (${d.cells[0].join(',')}) → ${d.to}${r.ok ? `  ${r.steps} 歩（${r.start.join(',')} から）` : '  ' + r.why}`;
    console.log(line);
    results.push(Object.assign({ map: d.map, kind: d.kind, id: d.id, at: d.cells[0], to: d.to }, r));
  }
  const errs = P.errors.slice();
  await P.close();
  return errs;
}

(async () => {
  const S = await B.start();
  const P0 = await B.open(S, 'dev.html?fixture=' + FIXTURE, { size: [960, 540], timeout: 60000 });
  await P0.page.evaluate(PAGE_LIB);
  const all = await P0.page.evaluate(([a, o]) => window.__doors.list(a, o), [ALL, ONLY ? ONLY.split(',') : null]);
  await P0.close();
  const on = all.filter((d) => d.on), off = all.filter((d) => !d.on);
  console.log(`出入り口 ${all.length}（今の状態で開いている ${on.length}、cond が偽 ${off.length} は数えるだけ）、fixture ${FIXTURE}、${JOBS} 本で歩く`);
  const jobs = on.slice(), results = [];
  const errs = (await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, () => worker(S, jobs, results, argv.includes('--shots'))))).flat();
  await B.stop(S);
  const bad = results.filter((r) => !r.ok);
  const f = path.join(V2, 'design', 'qa', 'check_doors.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ date: new Date().toISOString(), fixture: FIXTURE, walked: results, skipped: off.map((d) => ({ map: d.map, kind: d.kind, id: d.id, to: d.to, cond: d.cond })), errors: errs }, null, 1));
  if (errs.length) console.log('page errors:', errs.slice(0, 5));
  console.log(`\ncheck_doors: ${results.length - bad.length}/${results.length} passed（本物の入力で歩いて入った）${off.length ? `、cond が偽で数えるだけ ${off.length}` : ''}`);
  if (bad.length) { console.log('failed:\n  ' + bad.map((r) => `${r.map} ${r.kind} ${r.id} → ${r.to}: ${r.why}`).join('\n  ')); process.exitCode = 1; }
  if (errs.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
