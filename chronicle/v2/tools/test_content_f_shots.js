#!/usr/bin/env node
// CONTENT-F: スクショ（V2_PLAN §4.4: 自分の全マップを 1 画面ずつ（町は 4 か所以上）・全イベントの会話の 1 枚目）
//   node v2/tools/build.js && node v2/tools/test_content_f_shots.js [--maps] [--events] [--phone] [--only <名前>]
//   → v2/design/shots/content_f/map_<fixture>.png・ev_<event>.png（撮ったら必ず Read で見る）
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const OUT = path.join(B.V2, 'design', 'shots', 'content_f');
const args = process.argv.slice(2);
const want = (k) => !args.some((a) => a === '--maps' || a === '--events') || args.includes(k);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const FIX = fs.readdirSync(path.join(__dirname, 'fixtures', 'states')).filter((f) => /^content_f_/.test(f)).map((f) => f.replace(/\.json$/, ''));

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const S = await B.start();
  try {
    if (want('--maps')) {
      section('マップ（1920×1080）');
      for (const fx of FIX) {
        if (only && !fx.includes(only)) continue;
        const P = await B.open(S, 'dev.html?fixture=' + fx);
        await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='field' && RPG.Engine.fade.a < 0.01", 8000);
        await P.page.waitForTimeout(1600);
        const file = path.join(OUT, 'map_' + fx.replace(/^content_f_/, '') + '.png');
        await B.shot(P.page, file);
        ok(`${fx}: エラーなし`, P.errors.length === 0, P.errors.slice(0, 3));
        await P.close();
      }
      if (args.includes('--phone')) {
        for (const fx of ['content_f_fern_plaza', 'content_f_verda_1', 'content_f_elder_1', 'content_f_yura']) {
          const P = await B.open(S, 'dev.html?fixture=' + fx, { phone: true });
          await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='field' && RPG.Engine.fade.a < 0.01", 8000);
          await P.page.waitForTimeout(1600);
          await B.shot(P.page, path.join(OUT, 'phone_' + fx.replace(/^content_f_/, '') + '.png'));
          ok(`${fx}（縦）: エラーなし`, P.errors.length === 0, P.errors.slice(0, 3));
          await P.close();
        }
      }
    }
    if (want('--events')) {
      section('イベントの会話の 1 枚目');
      const P = await B.open(S, 'dev.html?fixture=content_f_fern_plaza');
      await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='field' && RPG.Engine.fade.a < 0.01", 8000);
      // 自分のイベントと、それを呼ぶ所（マップ・人・物）
      const list = await P.page.evaluate(() => {
        const R = window.RPG;
        const out = [];
        const mine = /^(fern_|verda_|elder_|forest_|yura_|hut_)/;
        const where = {};
        for (const [mid, m] of Object.entries(R.DB.maps)) {
          for (const n of m.npcs || []) if (typeof n.talk === 'string' && !where[n.talk]) where[n.talk] = { map: mid, npc: n.id, x: n.x, y: n.y, lv: n.lv || 0 };
          for (const o of m.objects || []) if (o.event && !where[o.event]) where[o.event] = { map: mid, x: o.x, y: o.y, lv: o.lv || 0 };
          for (const t of m.triggers || []) if (!where[t.event]) where[t.event] = { map: mid, x: t.x != null ? t.x : (m.spawns[Object.keys(m.spawns)[0]] || {}).x, y: t.y != null ? t.y : (m.spawns[Object.keys(m.spawns)[0]] || {}).y, trigger: t.id };
        }
        for (const id of Object.keys(R.DB.events)) if (mine.test(id)) out.push(Object.assign({ id }, where[id] || { map: 'fern', x: 29, y: 35 }));
        return out;
      });
      const BASE = { forest_start: true, prologue_done: true };
      // 1 枚目が出るための状態（何も無い状態で黙るイベント）
      const PRE = {
        fern_hanna_reward: { flags: { forest_finale_done: true } }, fern_yura_miller: { flags: { yura_miller_home: true } },
        fern_pim_after: { flags: { cleared_r_forest: true } }, verda_fawn_after: { flags: { cleared_r_forest: true } },
        elder_elm: { flags: { forest_boss: true } }, elder_pim_home: { flags: { forest_pim_guest: true } },
        verda_camp_talk: { flags: { forest_found_hans: true }, npc: 'camp_hans' }, verda_stone_c: { flags: { forest_moth: true } },
        forest_finale: { flags: { forest_boss: true } }, fern_after: { flags: { forest_found_hans: true } }, verda_hollow: {},
        fern_deck: { npc: 'deck_1' }, forest_waylamp: { map: 'world' },
      };
      for (const e of list) {
        if (only && !e.id.includes(only)) continue;
        const pre = PRE[e.id] || {};
        const r = await P.page.evaluate(async ([e, pre, BASE]) => {
          const R = window.RPG;
          if (R.Events.busy()) R.Events.abort();
          const G = R.Game;
          for (const k of Object.keys(G.flags)) delete G.flags[k];
          Object.assign(G.flags, BASE, pre.flags || {});
          G.vars = {}; G.choices = {}; G.guest = null;
          const mapId = pre.map || e.map;
          const m = R.DB.maps[mapId];
          if (!m) return 'no map ' + mapId;
          const npcId = pre.npc || e.npc;
          const n = npcId && (m.npcs || []).find((q) => q.id === npcId);
          const spot = n || e;
          let sx = spot.x, sy = spot.y + 1;
          if (!R.Field.passable(m, sx, sy, null, spot.lv || 0)) sy = spot.y - 1;
          await R.Field.enter(mapId, { x: sx, y: sy, dir: 'n', lv: spot.lv || 0 }, { fade: 0, noAutosave: true });
          while (R.Events.busy()) { R.Events.abort(); await R.wait(50); }
          if (n) R.Events.talk(m, n); else R.Events.run(e.id, { map: mapId, x: e.x, y: e.y, npc: npcId, trigger: e.trigger });
          const t0 = performance.now();
          while (performance.now() - t0 < 4000) {
            const top = (R.Engine.top() || {}).id;
            if (top === 'message' || top === 'caption' || /^screen:/.test(top || '')) { await new Promise((res) => setTimeout(res, 900)); return 'ok:' + top; }
            await new Promise((res) => setTimeout(res, 60));
          }
          return 'none';
        }, [e, pre, BASE]);
        const file = path.join(OUT, 'ev_' + e.id + '.png');
        if (/^ok/.test(r)) await B.shot(P.page, file);
        ok(`${e.id}: 会話の 1 枚目（${r}）`, /^ok/.test(r) || e.id === 'fern_arrival' || e.id === 'verda_mist', r);
        await P.page.evaluate(async () => { const R = window.RPG; R.Events.abort(); if (R.UIK.Message.busy()) R.UIK.Message.close(); await R.wait(80); });
      }
      ok('イベントの間のエラーなし', P.errors.length === 0, P.errors.slice(0, 5));
      await P.close();
    }
  } finally { await B.stop(S); }
  done('CONTENT-F shots');
})();
