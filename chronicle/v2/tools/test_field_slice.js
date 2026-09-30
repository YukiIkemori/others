#!/usr/bin/env node
// FIELD（P2 の組み込み、V2_PLAN §3.2・§4.3・§2.10）: 縦切りの本物のマップ（CONTENT-P・CONTENT-F）を FIELD の当たりで歩けるか、
// FIELD で入れるか（暗転 260 ms の中に隠れるか）、次のマップのチャンクを先に焼けているか、を確かめ、全マップを撮る。
//   node v2/tools/test_field_slice.js                 node の到達（FIELD の _canEnter・_lvAfter）とブラウザの一周（入る・歩く・撮る）
//   node v2/tools/test_field_slice.js --node          node だけ
//   node v2/tools/test_field_slice.js --no-shots      撮らない
//   node v2/tools/test_field_slice.js --only fern     id に fern を含むマップだけ
// ブラウザは dist/dev.html（node v2/tools/build.js を先に）。撮った PNG は v2/design/shots/field/slice/ に。必ず Read で見る（§2.9）。
'use strict';
const path = require('path');
const fs = require('fs');
const { ok, section, done } = require('./lib/testkit');

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const NODE_ONLY = argv.includes('--node');
const SHOTS = !argv.includes('--no-shots');
const V2 = path.resolve(__dirname, '..');
const OUT = path.join(V2, 'design', 'shots', 'field', 'slice');

/** 縦切りのマップ（仮・FIELD のテスト用を除く） */
function sliceMaps(R) {
  return Object.keys(R.DB.maps).filter((id) => !/^(stub_|field_|t_)/.test(id) && (!only || id.includes(only))).sort();
}

// ================================================================ node: FIELD の当たりでの到達
const DIR8 = [[0, 1, 's'], [0, -1, 'n'], [1, 0, 'e'], [-1, 0, 'w'], [1, 1, 'se'], [-1, 1, 'sw'], [1, -1, 'ne'], [-1, -1, 'nw']];
/** from の spawn から FIELD の歩き方（斜めは両隣が通れるときだけ・高さ・一方通行・物の当たり）で行けるマス（'x,y,lv'） */
function reach(R, map, starts) {
  const F = R.Field, seen = new Set(), q = [];
  for (const s of starts) { const k = s.x + ',' + s.y + ',' + (s.lv || 0); if (!seen.has(k)) { seen.add(k); q.push([s.x, s.y, s.lv || 0]); } }
  const can = (x, y, lv, dx, dy, dn) => {
    if (!F._canEnter(map, x, y, x + dx, y + dy, lv, dn)) return -1;
    return F._lvAfter(map, x, y, x + dx, y + dy, lv);
  };
  // q.shift() はワールド（672×576）で 2 乗の遅さになるので、読む位置を進める
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y, lv] = q[qi];
    for (const [dx, dy, dn] of DIR8) {
      let to = can(x, y, lv, dx, dy, dn);
      if (to < 0) continue;
      if (dx && dy && (can(x, y, lv, dx, 0, dx > 0 ? 'e' : 'w') < 0 || can(x, y, lv, 0, dy, dy > 0 ? 's' : 'n') < 0)) continue;
      const k = (x + dx) + ',' + (y + dy) + ',' + to;
      if (!seen.has(k)) { seen.add(k); q.push([x + dx, y + dy, to]); }
    }
  }
  return seen;
}
/** tilePatches を「全部外す」／「全部当てる」／「全部当てて条件つきの物を除く」の 3 つの形と、開く扉の形（条件の組み合わせのどれかで行ければよい） */
function variants(map) {
  const on = Object.assign({}, map, { id: map.id + '__on', tilePatches: (map.tilePatches || []).map((p) => Object.assign({}, p, { cond: null })) });
  const off = Object.assign({}, map, { id: map.id + '__off', tilePatches: [] });
  // 条件つきの物（倒木・つるなど、筋で消える物）が無い形
  const open = Object.assign({}, on, { id: map.id + '__open', objects: (map.objects || []).filter((o) => o.cond == null || o.type === 'trail') });
  // 開く扉の形: 閉じた扉（行き先の無い type:'door'。鍵・仕掛けの locked / unlock）の上に、cond つきの行き先のある扉が重なる所
  //   （灯台の塔の扉＝鍵で開く・砂漠の封じの扉＝紋がそろうと開く）は、cond が真になった後の形（閉じた扉を除き、開いた扉の cond を外す）。
  //   cond がいつか真になることは qa/progress.js の 4 が見る
  const objs = map.objects || [];
  const opens = objs.filter((o) => o.type === 'door' && o.to && o.cond != null);
  const covers = (a, b) => b.x >= a.x && b.x < a.x + (a.w || 1) && b.y >= a.y && b.y < a.y + (a.h || 1) && (a.lv || 0) === (b.lv || 0);
  const shut = objs.filter((o) => o.type === 'door' && !o.to && opens.some((d) => covers(o, d)));
  // 開いた後の形: tilePatches を外し、条件つきの物（封じの札・倒木）を除き、条件つきの行き先のある扉は開いた扉に
  //   （鍛冶衆の村の石段: 札 cond '!mine_volk_open' と扉 cond 'mine_volk_open' が同じマス。2026-09-30）
  const after = Object.assign({}, off, { id: map.id + '__after', objects: objs.filter((o) => o.cond == null || o.type === 'trail' || opens.includes(o)).map((o) => (opens.includes(o) ? Object.assign({}, o, { cond: null }) : o)) });
  if (!shut.length) return opens.length ? [off, on, open, after] : [off, on, open];
  const unlocked = Object.assign({}, on, { id: map.id + '__unlocked', objects: objs.filter((o) => !shut.includes(o)).map((o) => (opens.includes(o) ? Object.assign({}, o, { cond: null }) : o)) });
  return opens.length ? [off, on, open, unlocked, after] : [off, on, open, unlocked];
}

function nodePart() {
  const R = require('./lib/load')({ quiet: true });
  R.State.newGame({ seed: 7 });
  const F = R.Field;
  const ids = sliceMaps(R);
  section(`node: 縦切りのマップ ${ids.length} 枚を FIELD の当たりで歩く`);
  ok('縦切りのマップが 28 枚以上（§3.2）', only || ids.length >= 28, ids.length);
  // 物の索引（lib/maps.js の withIndex）: ワールドのような大きなマップで MapUtil.objectsAt が全部の物を毎回なめない
  const MX = require('./lib/maps').create(R);
  for (const id of ids) MX.withIndex(() => {
    const m = R.DB.maps[id];
    const bad = [];
    const c = R.Contract.check('map', m);
    if (!c.ok) bad.push('contract: ' + c.errors.slice(0, 2).join('; '));
    // spawn が歩けるマスの上
    const sp = Object.keys(m.spawns || {});
    if (!sp.length) bad.push('no spawns');
    for (const k of sp) {
      const s = m.spawns[k];
      if (!F._walkable(m, s.x, s.y, null, s.lv || 0) && !variants(m).some((v) => F._walkable(v, s.x, s.y, null, s.lv || 0))) bad.push(`spawn ${k} (${s.x},${s.y}) is blocked`);
    }
    // 到達（形の和）
    const R0 = new Set();
    for (const v of variants(m)) for (const k of reach(R, v, sp.map((k) => m.spawns[k]))) R0.add(k);
    const at = (x, y, lv) => R0.has(x + ',' + y + ',' + (lv || 0));
    const near = (x, y, lv, w, h) => {
      for (let yy = y - 1; yy <= y + (h || 1); yy++) for (let xx = x - 1; xx <= x + (w || 1); xx++) {
        const inside = xx >= x && yy >= y && xx < x + (w || 1) && yy < y + (h || 1);
        const orth = (xx >= x && xx < x + (w || 1)) || (yy >= y && yy < y + (h || 1));
        if ((inside || orth) && at(xx, yy, lv)) return true;
      }
      return false;
    };
    // 行き先の確かめ
    const dest = (to, what) => {
      if (!to) return;
      const t = R.DB.maps[to.map];
      if (!t) bad.push(`${what} → unknown map ${to.map}`);
      else if (typeof to.spawn === 'string' && !(t.spawns || {})[to.spawn]) bad.push(`${what} → ${to.map} has no spawn ${to.spawn}`);
    };
    for (const e of m.exits || []) {
      dest(e.to, `exit ${e.x},${e.y}`);
      let hit = false;
      for (let yy = e.y; yy < e.y + (e.h || 1) && !hit; yy++) for (let xx = e.x; xx < e.x + (e.w || 1) && !hit; xx++) hit = at(xx, yy, 0);
      if (!hit) bad.push(`exit (${e.x},${e.y},${e.w || 1}x${e.h || 1}) → ${e.to && e.to.map} unreachable`);
    }
    for (const o of m.objects || []) {
      if (o.x == null) continue;
      const lv = o.lv || 0;
      if (o.type === 'stairs' || o.type === 'door') { dest(o.to, `${o.type} ${o.x},${o.y}`); if (o.to && !at(o.x, o.y, lv)) bad.push(`${o.type} (${o.x},${o.y}) → ${o.to.map} unreachable`); }
      else if (o.type === 'building' && o.door && o.door.to) { dest(o.door.to, `building ${o.id}`); if (!at(o.door.x, o.door.y, lv)) bad.push(`door of ${o.id || 'building'} (${o.door.x},${o.door.y}) unreachable`); }
      // はじめから燃えている火（brazier の on: true）は、ともす用が無いので届かなくてよい（炉の石に囲まれた火など）
      else if (/^(chest|spring|sign|examine|waylamp)$/.test(o.type) || (o.type === 'brazier' && o.on !== true) || (o.type === 'switch' && o.look !== 'plate' && o.by !== 'guest')) {
        const w = o.type === 'spring' ? 2 : 1;
        if (!near(o.x, o.y, lv, w, w)) bad.push(`${o.type} ${o.id || ''} (${o.x},${o.y}) cannot be reached to examine`);
      }
    }
    // NPC の足もと（押してもどかない人が道をふさいでいないか・話しかけられるか）
    for (const n of m.npcs || []) {
      if (n.x == null) continue;
      // 店の台の向こうの人（台 1 マスを挟んで話せる。FIELD の話しかけ・lib/maps.js の talkSpots と同じ）
      const lv = n.lv || 0;
      const across = [[0, 2], [0, -2], [2, 0], [-2, 0]].some(([dx, dy]) => F._objBlocks && F._objBlocks(m, n.x + dx / 2, n.y + dy / 2, lv) && at(n.x + dx, n.y + dy, lv));
      if (!near(n.x, n.y, lv, 1, 1) && !at(n.x, n.y, lv) && !across) bad.push(`npc ${n.id} (${n.x},${n.y}) cannot be reached`);
    }
    ok(`${id}: FIELD で歩ける（spawn・出口・扉・階段・宝箱・泉・調べる物・人に届く）`, bad.length === 0, bad.slice(0, 6));
  });
}

// ================================================================ ブラウザ: 入る（暗転 260 ms）・歩く・撮る
async function browserPart() {
  const B = require('./lib/browser');
  const R = require('./lib/load')({ quiet: true });
  const ids = tourOrder(R, sliceMaps(R));
  const spawnOf = (id) => {
    const m = R.DB.maps[id], sp = m.spawns || {};
    // 撮る場所: 町は広場・門、屋内は扉、ダンジョンは入口（名前の順で最初に合う物）
    for (const k of ['plaza', 'warp', 'square', 'center', 'south', 'gate', 'gate_s', 'door', 'entry', 'bed']) if (sp[k]) return k;
    return Object.keys(sp)[0];
  };
  fs.mkdirSync(OUT, { recursive: true });
  const S = await B.start();
  const enterMs = {};
  let soft = false;   // 描画が CPU（SwiftShader。GPU の無いヘッドレス）か
  try {
    for (const phone of [false, true]) {
      if (phone && !SHOTS) break;
      section(`ブラウザ: 縦切りのマップに入って歩く（${phone ? 'スマホ縦 390×844' : '1920×1080'}）`);
      const P = await B.open(S, 'dev.html?fixture=content_p_pharos', phone ? { phone: true } : {});
      const p = P.page;
      await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 8000);
      if (!phone) soft = await B.ev(p, `(() => { try { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return /SwiftShader|llvmpipe|software/i.test(e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''); } catch (x) { return false; } })()`);
      // 入るときのイベント（onEnter）と出現は止める（ここでは地図と動きだけを見る。イベントは CONTENT のテストが通す）
      await B.ev(p, `(() => { window.__run = RPG.Events.run; RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; return 0; })()`);
      for (const id of ids) {
        const sp = spawnOf(id);
        const r = await B.ev(p, `(async () => {
          const t0 = performance.now();
          const f0 = RPG.Engine.frame;
          await RPG.Field.enter(${JSON.stringify(id)}, ${JSON.stringify(sp)});
          return {wall: performance.now() - t0, frames: RPG.Engine.frame - f0, st: RPG.Field.chunks.stats(), pos: RPG.Field.pos};
        })()`);
        enterMs[id] = enterMs[id] || [];
        enterMs[id].push(r.st.enterMs);
        ok(`${id}${phone ? '（縦）' : ''}: 入った（${sp}）— 暗転の中の焼き ${r.st.enterMs.toFixed(0)} ms・全体 ${r.wall.toFixed(0)} ms`, r.pos.map === id, r);
        // 歩く: FIELD の当たりで 6 歩先のマスを探し、キーで歩く
        const findPath = (margin) => B.ev(p, `((margin) => {
          const F = RPG.Field, S = F._s, m = S.map, D = {s:[0,1],n:[0,-1],e:[1,0],w:[-1,0]};
          const objsNear = (x, y) => RPG.MapUtil.objectsAt(m, x, y).some((o) => o.type === 'stairs' || o.type === 'door' || (o.type === 'building' && o.door && o.door.x === x && o.door.y === y))
            || (m.exits || []).some((e) => RPG.MapUtil.inRect(x, y, e)) || (m.triggers || []).some((t) => t.on === 'step' && RPG.MapUtil.inRect(x, y, t));
          const q = [[S.x, S.y, S.lv, []]], seen = new Set([S.x + ',' + S.y]);
          let best = null;
          while (q.length) {
            const [x, y, lv, pth] = q.shift();
            if (pth.length >= 6) { best = pth; break; }
            if (!best || pth.length > best.length) best = pth;
            for (const d of ['s','e','w','n']) {
              const nx = x + D[d][0], ny = y + D[d][1];
              if (seen.has(nx + ',' + ny)) continue;
              if (!F._canEnter(m, x, y, nx, ny, lv, d) || F._npcAt(nx, ny, F._lvAfter(m, x, y, nx, ny, lv))) continue;
              // 出口・扉・階段・建物の入口・トリガーは踏まない（キーを離すのが遅れて 1 歩余分に進んでも踏まないよう、隣も避ける）
              let near = false;
              for (let yy = ny - 1; yy <= ny + 1 && !near; yy++) for (let xx = nx - 1; xx <= nx + 1 && !near; xx++) {
                const objs = RPG.MapUtil.objectsAt(m, xx, yy);
                if (objs.some((o) => o.type === 'stairs' || o.type === 'door' || (o.type === 'building' && o.door && o.door.x === xx && o.door.y === yy))) near = true;
                if ((m.exits || []).some((e) => RPG.MapUtil.inRect(xx, yy, e)) || (m.triggers || []).some((t) => t.on === 'step' && RPG.MapUtil.inRect(xx, yy, t))) near = true;
              }
              if (near && (margin || objsNear(nx, ny))) continue;
              seen.add(nx + ',' + ny);
              q.push([nx, ny, F._lvAfter(m, x, y, nx, ny, lv), pth.concat(d)]);
            }
          }
          return best || [];
        })(${margin})`);
        let path = await findPath(true);
        if (path.length < 3) path = await findPath(false);   // 入口が階段のすぐ横（灯台 3 階）: 隣を避けずに、踏むのだけ避ける
        const K = { s: 'down', n: 'up', e: 'right', w: 'left' };
        const before = await B.ev(p, 'RPG.Field.pos');
        for (const d of path) {
          await p.keyboard.down(B.KEY[K[d]]);
          await B.waitFor(p, `!!RPG.Field._s.mv`, 800);
          await p.keyboard.up(B.KEY[K[d]]);
          await B.waitFor(p, `!RPG.Field._s.mv`, 800);
        }
        await p.waitForTimeout(120);
        const after = await B.ev(p, 'RPG.Field.pos');
        const missNow = await B.ev(p, 'RPG.Field.chunks.stats().miss');
        if (missNow !== (P.miss0 || 0)) console.log(`      ${id}: 焼けていないチャンクが画面に ${missNow - (P.miss0 || 0)} 回（その場で焼いた）`);
        P.miss0 = missNow;
        const moved = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
        await p.waitForTimeout(1200);   // 歩き回る時間（つながったマップの下焼きが列の余りで進む）
        ok(`${id}${phone ? '（縦）' : ''}: キーで ${path.length} 歩歩けた`, path.length >= 3 && after.map === id && moved >= Math.min(2, path.length), { path, before, after });
        if (SHOTS) {
          await p.waitForTimeout(700);
          await B.shot(p, path_(id, phone));
        }
      }
      ok(`コンソールのエラー・外への通信 0${phone ? '（縦）' : ''}`, P.errors.length === 0, P.errors.slice(0, 4));
      const miss = await B.ev(p, 'RPG.Field.chunks.stats().miss');
      console.log(`      焼けていないチャンクが画面に出た回数: ${miss}`);
      await P.close();
    }

    section('次のマップのチャンクを歩いている間に先に焼く（§2.10 マップに入る）');
    {
      const P = await B.open(S, 'dev.html?fixture=content_p_pharos');
      const p = P.page;
      await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 8000);
      await B.ev(p, `(() => { RPG.Events.run = () => Promise.resolve(); RPG.Mon.encounter = () => null; RPG.Game.flags.prologue_done = true; return 0; })()`);
      // ファロスの宿の扉の前へ（建物の扉の 1 つ下）→ 先に焼く → 入る
      const door = await B.ev(p, `(() => { const b = RPG.DB.maps.pharos.objects.find((o) => o.type === 'building' && o.door && o.door.to && o.door.to.map === 'pharos_inn'); return b && {x: b.door.x, y: b.door.y, to: b.door.to}; })()`);
      ok('ファロスに宿の扉がある', !!door, door);
      if (door) {
        await B.ev(p, `RPG.Field.enter('pharos', {x: ${door.x}, y: ${door.y + 3}, dir: 'n'}, {fade: 0, noAutosave: true})`);
        await B.press(p, 'up', 200);
        await B.waitFor(p, `(() => { const s = RPG.Field.chunks.preStats(); return s && s.ready === s.n && s.prewarm; })()`, 20000);   // 入った直後は人の絵（prio 90）が先
        const pre = await B.ev(p, 'RPG.Field.chunks.preStats()');
        ok('扉に近づくと宿のチャンクを先に焼く', pre && pre.map === 'pharos_inn' && pre.ready >= 1, pre);
        const r = await B.ev(p, `(async () => { await RPG.Field.enter('pharos_inn', ${JSON.stringify(door.to.spawn)}); return RPG.Field.chunks.stats(); })()`);
        ok(`先に焼いた後は暗転の中の焼きが短い（${r.enterMs.toFixed(0)} ms ≤ 60 ms、使い回し ${r.adopted}）`, r.enterMs <= 60 && r.adopted > 0, r);
      }
      ok('エラー 0', P.errors.length === 0, P.errors.slice(0, 4));
      await P.close();
    }
  } finally { await B.stop(S); }
  const all = Object.values(enterMs).map((a) => a[0]).sort((a, b) => a - b);
  if (all.length) console.log(`      暗転の中の焼き（1920×1080）: 中央値 ${all[all.length >> 1].toFixed(0)} ms・最大 ${all[all.length - 1].toFixed(0)} ms`);
  // 予算は GPU のあるデスクトップで 150 ms（§3.16）。GPU の無いヘッドレス（SwiftShader）では canvas の描き込みと読み出しが CPU で、
  // 1024 角の縮めた drawImage 1 回が約 3.5 ms（GPU では 0.3 ms 未満）。暗転の中の時間の大半はこの描き込み（2026-09-30 の CPU の記録で
  // 自前の JS は 1 割未満）。ほかの仕事と CPU を分け合うと町で 100〜306 ms だったので、ソフトの描画では 400 ms で見る。ワールド（高さの場のチャンク 35 枚）だけは 1200 ms:
  // 遊ぶときは端へ歩く間に CK.lookAhead が先に焼く（f_cross から歩いて入ると 15 枚を使い回して 413 ms）が、ここは歩かずに直に入る
  const budget = (id) => (!soft ? 150 : id === 'world' ? 1200 : 400);
  const over = Object.keys(enterMs).filter((id) => enterMs[id][0] > budget(id));
  ok(`どのマップも暗転の中の焼きが予算 ${soft ? '400 ms（ソフトの描画。ワールドは 1200 ms）' : '150 ms'} 以内（§3.16 性能、デスクトップ）`, over.length === 0, over.length ? over.map((id) => id + ' ' + enterMs[id][0].toFixed(0)) : enterMs);
}
/** つながりの順（roa_house から出口・扉・階段をたどる幅優先）。実際に歩く順に近い形で入る（隣のマップの下焼きが効くか） */
function tourOrder(R, ids) {
  const want = new Set(ids), out = [], seen = new Set();
  const q = [R.DB.maps.roa_house ? 'roa_house' : ids[0]];
  while (q.length) {
    const id = q.shift();
    if (seen.has(id) || !R.DB.maps[id]) continue;
    seen.add(id);
    if (want.has(id)) out.push(id);
    const m = R.DB.maps[id], to = [];
    for (const e of m.exits || []) to.push(e.to);
    for (const o of m.objects || []) { if (o.to) to.push(o.to); if (o.door && o.door.to) to.push(o.door.to); }
    for (const t of to) if (t && t.map && !seen.has(t.map)) q.push(t.map);
  }
  for (const id of ids) if (!seen.has(id)) out.push(id);
  return out;
}
function path_(id, phone) { return path.join(OUT, `${id}${phone ? '_phone' : ''}.png`); }

(async () => {
  nodePart();
  if (!NODE_ONLY) await browserPart();
  done('test_field_slice');
})().catch((e) => { console.error(e); process.exitCode = 1; });
