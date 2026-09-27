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
//
// 戸口の形（node だけ。先に必ず動かす。--layout ならここだけ = check_all の速い版）。オーナーの報告
// 「家の出入り口が 2 マスだから、扉は 1 マスなのに、出入りできる判定のエリアと出てきた時の立ち位置とかがずれておかしい」の再発を止める。
// 町の建物の戸口（building の door.to）ごとに:
//  1 外の戸口で移るのは door のマスだけ（左右のマスは移らない）。行き先の屋内から町へ戻る出口は 1 マス（w×h = 1）。
//  2 描いた建物の絵（v2/assets/env/*/bld/<id>.json の door32、描く点 = 敷地の左下からの px、32 px = 1 マス）があれば、
//    扉の絵の中心の下のマスが door のマス（下絵のマップは meta に doors32 [{x, y}]（マップの px）があれば同じく）。
//  3 屋内から出て着くマス（町の spawn）は door の真下（door.y + 1）・下向き・歩ける・出入り口のマスでない（すぐまた移らない）・動かない人がいない。
//  4 屋内に着くマス（door.to.spawn）は屋内の出口のマスの真上・上向き・歩ける・出入り口でない。出口のマスの左右は壁（戸口の隙間 = 1 マス）。
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- 戸口の形（node）
function layoutCheck(all, only) {
  const { ok, section, done } = require('../lib/testkit');
  const R = require('../lib/load')({ quiet: true });
  const F = R.Field;
  R.State.newGame({ hero: { type: 'fighter', sex: 'm', name: 'テスト' }, seed: 1 });
  const ENV = path.join(path.resolve(__dirname, '..', '..'), 'assets', 'env');
  const artMeta = {};
  for (const th of fs.readdirSync(ENV)) {
    const dir = path.join(ENV, th, 'bld');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (/\.json$/.test(f)) { try { artMeta[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { /* */ } }
  }
  const underMeta = (key) => { const [th, , name] = String(key || '').split('/'); const f = path.join(ENV, th || '', 'under', (name || '') + '.json'); try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
  const isOther = (id, m) => /^(desert_|snow_)/.test(id) || /desert|snow/.test(m.region || '') || /desert|snow/.test(m.theme || '');
  const inR = (x, y, e) => x >= e.x && y >= e.y && x < e.x + (e.w || 1) && y < e.y + (e.h || 1);
  const stillNpcAt = (m, x, y) => (m.npcs || []).find((n) => n.x === x && n.y === y && (!n.move || n.move === 'still') && n.cond == null);
  let doors = 0;
  section('戸口の形（外の戸口 1 マス・描いた扉・出て着くマス・中に着くマス）');
  for (const id of Object.keys(R.DB.maps).sort()) {
    const m = R.DB.maps[id];
    if (/^(stub_|field_|t_)/.test(id) || (!all && isOther(id, m)) || (only && !only.includes(id))) continue;
    const under = m.art && m.art.image ? underMeta(m.art.image) : null;
    for (const b of m.objects || []) {
      if (b.type !== 'building' || !b.door || !b.door.to) continue;
      if (!R.DB.maps[b.door.to.map] || R.DB.maps[b.door.to.map].kind !== 'interior') continue;   // 家・店の戸口（ワールドの町・塔の印は別）
      doors++;
      const d = b.door, lv = b.lv || 0, name = `${id} ${b.id} (${d.x},${d.y}) → ${d.to.map}`;
      // 1 外の戸口の幅 = 1
      const side = [-1, 1].filter((s) => F._warpAt(m, d.x + s, d.y, lv)).map((s) => d.x + s);
      ok(`${name}: 移るのは戸口の 1 マスだけ`, F._warpAt(m, d.x, d.y, lv) && !side.length, { side });
      // 2 描いた扉の位置
      const j = artMeta[b.id] || (b.art && artMeta[b.art]);
      if (j && j.door32) {
        const tx = b.x + Math.floor(j.door32.x / 32);
        ok(`${name}: 描いた扉（${j.door32.x}px → x ${tx}）の下のマス`, tx === d.x, { painted: tx, data: d.x });
      }
      const pd = under && Array.isArray(under.doors32) && under.doors32.find((p) => Math.floor(p.x / 32) >= b.x && Math.floor(p.x / 32) < b.x + (b.w || 1) && Math.abs(Math.floor(p.y / 32) - d.y) <= 1);
      if (pd) ok(`${name}: 下絵の扉（${pd.x},${pd.y}px）の下のマス`, Math.floor(pd.x / 32) === d.x, { painted: Math.floor(pd.x / 32), data: d.x });
      // 3・4 屋内
      const inn = R.DB.maps[d.to.map];
      if (!ok(`${name}: 行き先の屋内がある`, !!inn)) continue;
      const back = (inn.exits || []).filter((e) => e.to && e.to.map === id);
      for (const e of back) {
        ok(`${name}: 屋内の出口 ${e.x},${e.y} は 1 マス`, (e.w || 1) * (e.h || 1) === 1, { w: e.w, h: e.h });
        const sp = R.MapUtil.spawn(m, e.to.spawn);
        const bad = [];
        if (sp.x !== d.x || sp.y !== d.y + 1) bad.push(`at ${sp.x},${sp.y} (want ${d.x},${d.y + 1})`);
        if (sp.dir !== 's') bad.push('dir ' + sp.dir);
        if (!F._walkable(m, sp.x, sp.y, null, lv)) bad.push('not walkable');
        if (F._warpAt(m, sp.x, sp.y, lv)) bad.push('re-warps');
        if (stillNpcAt(m, sp.x, sp.y)) bad.push('npc ' + stillNpcAt(m, sp.x, sp.y).id);
        ok(`${name}: 出て着くマス（${e.to.spawn}）は戸口の真下・下向き・歩ける・移らない`, !bad.length, bad);
        // 出口の隙間は 1 マス（左右は壁）
        const gapSide = [-1, 1].filter((s) => F.passable(inn, e.x + s, e.y, null, 0));
        ok(`${name}: 屋内の戸口の隙間（${e.x},${e.y}）は 1 マス`, !gapSide.length, { open: gapSide.map((s) => e.x + s) });
      }
      ok(`${name}: 屋内に町へ戻る出口がある`, back.length > 0);
      const ia = R.MapUtil.spawn(inn, d.to.spawn), bad = [];
      const under1 = back.find((e) => inR(ia.x, ia.y + 1, e));
      if (!under1) bad.push(`no exit below ${ia.x},${ia.y}`);
      if (ia.dir !== 'n') bad.push('dir ' + ia.dir);
      if (!F._walkable(inn, ia.x, ia.y, null, 0)) bad.push('not walkable');
      if (F._warpAt(inn, ia.x, ia.y, 0)) bad.push('re-warps');
      if (stillNpcAt(inn, ia.x, ia.y)) bad.push('npc ' + stillNpcAt(inn, ia.x, ia.y).id);
      ok(`${name}: 中に着くマス（${d.to.spawn} ${ia.x},${ia.y}）は出口の真上・上向き・歩ける・移らない`, !bad.length, bad);
    }
  }
  console.log(`\n町の建物の戸口 ${doors}`);
  return done('check_doors --layout');
}

const LAYOUT_ONLY = process.argv.includes('--layout');
{
  const a = process.argv.slice(2), i = a.indexOf('--map');
  const r = layoutCheck(a.includes('--all'), i >= 0 ? a[i + 1].split(',') : null);
  if (LAYOUT_ONLY) process.exit(r.fail ? 1 : 0);
}
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
          // 屋内から町の建物の戸口へ戻る出口: 着くのは戸口の真下（下向き）
          const tm = R.DB.maps[e.to.map], bd = m.kind === 'interior' && tm && (tm.objects || []).find((o) => o.type === 'building' && o.door && o.door.to && o.door.to.map === id);
          out.push({ map: id, kind: 'exit', id: e.x + ',' + e.y, cells, lv: 0, to: e.to.map, cond: e.cond, on: check(e.cond), arrive: bd ? [bd.door.x, bd.door.y + 1] : null });
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
  const t0 = Date.now();
  for (let guard = 0; guard < 80; guard++) {
    if (Date.now() - t0 > 90000) return { ok: false, steps, why: 'timeout 90 s' };
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
          if (r.ok && d.arrive) {
            // 出て着いたマス: 戸口の真下・下向き。少し待っても同じマップ（すぐまた移らない）
            await p.waitForTimeout(400); await settle(p);
            const a = await p.evaluate(() => { const s = RPG.Field._s; return { m: s.map.id, x: s.x, y: s.y, dir: s.dir }; });
            if (a.m !== d.to || a.x !== d.arrive[0] || a.y !== d.arrive[1] || a.dir !== 's') { r.ok = false; r.why = `arrived at ${a.m} ${a.x},${a.y} ${a.dir} (want ${d.arrive.join(',')} s)`; }
          }
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
  // 人の絵: 縦切りのマップの人が、どれも原画（v2/assets/sprites）で描かれる（手で描く仮の型のままの人がいない）
  const looks = await P0.page.evaluate(([a, o]) => {
    const R = window.RPG, SP = R.Art.cast.sprites, out = [];
    const isOther = (id, m) => /^(desert_|snow_)/.test(id) || /desert|snow/.test(m.region || '') || /desert|snow/.test(m.theme || '');
    for (const id of Object.keys(R.DB.maps).sort()) {
      const m = R.DB.maps[id];
      if (/^(stub_|field_|t_)/.test(id) || (!a && isOther(id, m)) || (o && !o.includes(id))) continue;
      for (const n of m.npcs || []) {
        const art = R.Field._artLook(n.look, m);
        const L = R.DB.looks[art] || {};
        const ok = SP.has(art, 'field') || !!L.animal;
        out.push({ map: id, npc: n.id, look: n.look, art, ok });
      }
    }
    return out;
  }, [ALL, ONLY ? ONLY.split(',') : null]);
  await P0.close();   // 人の絵を調べた後で閉じる（前は閉じたページで調べていた）
  const badLooks = looks.filter((l) => !l.ok);
  for (const l of badLooks) console.log(`FAIL  人の絵 ${l.map}.${l.npc}: ${l.look} → ${l.art} に原画が無い（手で描く仮の絵のまま）`);
  console.log(`人の絵: ${looks.length - badLooks.length}/${looks.length} が原画（町の人の仮の型は地方の原画の型へ: ${looks.filter((l) => l.look !== l.art).length} 人）`);
  const on = all.filter((d) => d.on), off = all.filter((d) => !d.on);
  console.log(`出入り口 ${all.length}（今の状態で開いている ${on.length}、cond が偽 ${off.length} は数えるだけ）、fixture ${FIXTURE}、${JOBS} 本で歩く`);
  const jobs = on.slice(), results = [];
  const errs = (await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, () => worker(S, jobs, results, argv.includes('--shots'))))).flat();
  await B.stop(S);
  const bad = results.filter((r) => !r.ok);
  const f = path.join(V2, 'design', 'qa', 'check_doors.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ date: new Date().toISOString(), fixture: FIXTURE, walked: results, looks, skipped: off.map((d) => ({ map: d.map, kind: d.kind, id: d.id, to: d.to, cond: d.cond })), errors: errs }, null, 1));
  if (errs.length) console.log('page errors:', errs.slice(0, 5));
  console.log(`\ncheck_doors: ${results.length - bad.length}/${results.length} passed（本物の入力で歩いて入った）${off.length ? `、cond が偽で数えるだけ ${off.length}` : ''}`);
  if (bad.length) { console.log('failed:\n  ' + bad.map((r) => `${r.map} ${r.kind} ${r.id} → ${r.to}: ${r.why}`).join('\n  ')); process.exitCode = 1; }
  if (errs.length || badLooks.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
