#!/usr/bin/env node
// CONTENT（雪原）: 戸口を歩いて入る検査とスクショ（V2_PLAN §4.4・§2.9）。
//   node v2/tools/build.js && node v2/tools/test_content_s_shots.js [--doors] [--maps] [--phone] [--bosses] [--only <名前>]
//   --doors   雪原の町・屋内・ダンジョンの出入り口（建物の戸口・扉・階段・出口）すべてに、マップの最初の spawn から
//             本当の入力（R.Input._set の上下左右）で歩いて行き、踏みこんで別のマップに移るかを見る。戸口の手前のマスへ
//             歩いて着けない（建物や物が戸口・道をふさいでいる）のも失敗。動く人に道をふさがれたときだけ、手前のマスへ置き直して踏みこむ（数える）。
//   --maps    tools/fixtures/states/content_s_*.json（通しの遊びの 2 枚を除く）を 1 枚ずつ 1920×1080 で撮る
//   --phone   町・峰・籠城の夜など 6 枚を 390×844 で撮る
//   --bosses  ボスの戦い（tools/fixtures/scenes/battle_s_*.json）の最初と、予告が出たところを 1920×1080 と 390×844 で撮る
//   → v2/design/shots/content_s/*.png（撮ったら必ず Read で見る）
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const OUT = path.join(B.V2, 'design', 'shots', 'content_s');
const args = process.argv.slice(2);
const MODES = ['--doors', '--maps', '--phone', '--bosses'];
const want = (k) => !args.some((a) => MODES.includes(a)) || args.includes(k);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const FIX = fs.readdirSync(path.join(__dirname, 'fixtures', 'states')).filter((f) => /^content_s_/.test(f) && !/route|battle/.test(f)).map((f) => f.replace(/\.json$/, ''));
const READY = "(RPG.Engine.top()||{}).id==='field' && RPG.Engine.fade.a < 0.01";
const DOOR_MAPS = ['world', 'yule', 'yule_hall', 'yule_inn', 'yule_items', 'yule_arms', 'yule_jorn', 'yule_sonja', 'yule_brenda', 'yule_hunter', 'yule_fishhut', 'yule_base', 'yule_branch',
  'pass_inn', 'pass_inn_in', 'snow_woods', 'peak_1', 'peak_top', 'icicle_1', 'icicle_2', 'aurora', 'frost_ship_1', 'frost_ship_2'];

/** 走っている会話・キャプションを A で送り切る */
async function settle(p, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 15000)) {
    const busy = await B.ev(p, "RPG.Events.busy() || RPG.UIK.Message.busy() || (RPG.Engine.top()||{}).id !== 'field'");
    if (!busy) return true;
    await B.press(p, 'a');
    await p.waitForTimeout(120);
  }
  return false;
}

async function doors(S) {
  section('戸口を歩いて入る（本当の入力）');
  const P = await B.open(S, 'dev.html?fixture=content_s_yule_cleared', { size: [960, 540] });
  const p = P.page;
  await B.waitFor(p, READY, 15000);
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'lib', 'maps.js'), 'utf8') });
  await settle(p);
  await p.evaluate(() => {
    const R = window.RPG;
    R.Field.encounter.suppress(1e6);
    window.__M = window.QAMaps ? window.QAMaps.create(R) : null;
  });
  const hasM = await B.ev(p, '!!window.__M');
  if (!hasM) {
    const g = await B.ev(p, "Object.keys(window).filter((k)=>/map/i.test(k)).join(',')");
    ok('tools/lib/maps.js がページで使える', false, g);
    await P.close();
    return;
  }
  for (const mid of DOOR_MAPS) {
    if (only && !mid.includes(only)) continue;
    const list = await p.evaluate((mid) => {
      const M = window.__M, R = window.RPG;
      // ワールドは雪原の範囲（x 8〜93・y 1〜48）の物だけ
      return M.portals(mid).filter((q) => mid !== 'world' || (q.x >= 8 && q.x <= 93 && q.y >= 1 && q.y <= 48)).map((q, i) => ({ i, kind: q.kind, x: q.x, y: q.y, w: q.w, h: q.h, lv: q.lv || 0, to: q.to.map, id: q.id || null }));
    }, mid);
    const res = [];
    for (const q of list) {
      // 1 つの出口の帯（w×h）は真ん中の 1 マスだけ
      const r = await p.evaluate(async ([mid, q]) => {
        const R = window.RPG, M = window.__M, F = R.Field;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const BTN = ['up', 'down', 'left', 'right', 'a', 'b', 'dash'];
        const release = () => { for (const b of BTN) R.Input._set(b, false); };
        const waitIdle = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (R.Engine.top() && R.Engine.top().id === 'field' && R.Engine.fade.a < 0.01 && !R.Events.busy() && !R.UIK.Message.busy()) return true; if (R.Events.busy() || R.UIK.Message.busy()) { R.Input._set('a', true); await sleep(60); R.Input._set('a', false); } await sleep(60); } return false; };
        const map = R.DB.maps[mid];
        const sp = mid === 'world' ? 'yule_w' : Object.keys(map.spawns || {})[0];
        await F.enter(mid, sp, { fade: 0 });
        await waitIdle(8000);
        const tx = q.x + Math.floor((q.w - 1) / 2), ty = q.y + Math.floor((q.h - 1) / 2);
        const start = F.pos;
        const res = M.bfs(map, [{ x: start.x, y: start.y, lv: 0 }], { npcs: false });
        // 戸口の手前のマス: 4 方向の隣で、歩いて着けて、そこから戸口へ入れる物
        const DIRS = [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']];
        let best = null;
        for (const [dx, dy, btn] of DIRS) {
          const ax = tx + dx, ay = ty + dy;
          const d = res.get(ax, ay, q.lv);
          if (d == null) continue;
          if (!best || d < best.d) best = { ax, ay, btn, d };
        }
        if (!best && res.get(tx, ty, q.lv) === 0) best = null;
        if (!best) return { ok: false, why: 'no walkable approach cell next to the door', tx, ty };
        // 歩く（1 マスずつ、方向キーを押して着くまで待つ）
        const path = M.path(res, best.ax, best.ay, q.lv) || [];
        let placed = false, steps = 0;
        for (let k = 1; k < path.length; k++) {
          const c = path[k];
          const t0 = Date.now();
          while (Date.now() - t0 < 2500) {
            const pos = F.pos;
            if (pos.map !== mid) return { ok: false, why: 'left the map while walking (another exit on the way?) → ' + pos.map + ' at step ' + k };
            if (pos.x === c.x && pos.y === c.y) break;
            release();
            if (c.x > pos.x) R.Input._set('right', true); else if (c.x < pos.x) R.Input._set('left', true);
            if (c.y > pos.y) R.Input._set('down', true); else if (c.y < pos.y) R.Input._set('up', true);
            await sleep(40);
            if (R.Events.busy() || R.UIK.Message.busy()) { release(); await waitIdle(6000); }
          }
          release();
          const pos = F.pos;
          if (pos.x !== c.x || pos.y !== c.y) {
            // 人にふさがれた: 手前のマスへ置き直す（数える）
            await F.enter(mid, { x: best.ax, y: best.ay, dir: 's' }, { fade: 0 });
            await waitIdle(4000);
            placed = true;
            break;
          }
          steps++;
        }
        // 踏みこむ
        const t1 = Date.now();
        let went = null;
        while (Date.now() - t1 < 2500) {
          R.Input._set(best.btn, true);
          await sleep(50);
          const pos = F.pos;
          if (pos.map !== mid) { went = pos.map; break; }
          if (R.Events.busy() || R.UIK.Message.busy()) { release(); await waitIdle(6000); if (F.pos.map !== mid) { went = F.pos.map; break; } }
        }
        release();
        await waitIdle(4000);
        if (F.pos.map !== mid && !went) went = F.pos.map;
        return { ok: went === q.to, went, want: q.to, placed, steps, from: [best.ax, best.ay], btn: best.btn };
      }, [mid, q]);
      res.push(Object.assign({ door: `${q.kind}${q.id ? ':' + q.id : ''} ${q.x},${q.y} → ${q.to}` }, r));
    }
    const bad = res.filter((r) => !r.ok);
    const placed = res.filter((r) => r.placed);
    ok(`${mid}: 出入り口 ${res.length} か所に歩いて入れる${placed.length ? `（人を避けて置き直し ${placed.length}）` : ''}`, bad.length === 0 && res.length > 0, bad.map((b) => `${b.door}: ${b.why || 'went ' + b.went}`));
  }
  ok('戸口の検査でエラーなし', P.errors.length === 0, P.errors.slice(0, 3));
  await P.close();
}

async function maps(S, phone) {
  section(phone ? 'マップ（390×844）' : 'マップ（1920×1080）');
  const list = phone ? ['content_s_yule_plaza', 'content_s_yule_night', 'content_s_peak_1', 'content_s_peak_top', 'content_s_woods', 'content_s_world'] : FIX;
  for (const fx of list) {
    if (only && !fx.includes(only)) continue;
    const P = await B.open(S, 'dev.html?fixture=' + fx, phone ? { phone: true } : {});
    await B.waitFor(P.page, READY, 15000);
    await settle(P.page);
    await P.page.waitForTimeout(1800);
    const file = path.join(OUT, (phone ? 'phone_' : 'map_') + fx.replace(/^content_s_/, '') + '.png');
    await B.shot(P.page, file);
    ok(`${fx}: エラーなし`, P.errors.length === 0, P.errors.slice(0, 3));
    await P.close();
  }
}

async function bosses(S) {
  section('ボスの戦い（最初・予告）');
  const SC = fs.readdirSync(path.join(__dirname, 'fixtures', 'scenes')).filter((f) => /^battle_s_/.test(f)).map((f) => f.replace(/\.json$/, ''));
  for (const fx of SC) {
    if (only && !fx.includes(only)) continue;
    for (const phone of [false, true]) {
      const P = await B.open(S, 'dev.html?scene=' + fx, phone ? { phone: true } : {});
      const p = P.page;
      const D = 'RPG.Battle.debug()';
      const up = await B.waitFor(p, `${D} && ${D}.ui && ${D}.phase==='input'`, 15000);
      await p.waitForTimeout(500);
      const tag = fx.replace(/^battle_s_/, '') + (phone ? '_phone' : '');
      await B.shot(p, path.join(OUT, 'boss_' + tag + '.png'));
      // 予告が出るまで「たたかう」を送る（最初の数ラウンド）
      let tele = false;
      if (!/siege/.test(fx)) {
        const t0 = Date.now();
        while (Date.now() - t0 < 60000) {
          if (await B.ev(p, `!!(${D} && ${D}.tele && ${D}.tele.text)`)) { tele = true; break; }
          if (await B.ev(p, `!${D} || !!${D}.result`)) break;
          await B.press(p, 'a');
          await p.waitForTimeout(90);
        }
        if (tele) { await p.waitForTimeout(250); await B.shot(p, path.join(OUT, 'boss_' + tag + '_tele.png')); }
      }
      ok(`${fx}${phone ? '（縦）' : ''}: 開く・${/siege/.test(fx) ? '' : '予告が出る・'}エラーなし`, !!up && (tele || /siege/.test(fx)) && P.errors.length === 0, P.errors.slice(0, 3));
      await P.close();
    }
  }
}

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const S = await B.start();
  try {
    if (want('--doors')) await doors(S);
    if (want('--maps')) await maps(S, false);
    if (want('--phone')) await maps(S, true);
    if (want('--bosses')) await bosses(S);
  } finally {
    await B.stop(S);
  }
  done('test_content_s_shots');
})().catch((e) => { console.error(e); process.exit(2); });
