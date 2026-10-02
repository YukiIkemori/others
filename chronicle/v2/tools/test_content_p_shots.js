#!/usr/bin/env node
// CONTENT-P の撮影（ブラウザ。V2_PLAN §4.4 の CONTENT-P の行: 自分の全マップを 1 画面ずつ、全イベントの会話の 1 枚目）
//   node v2/tools/build.js && node v2/tools/test_content_p_shots.js [--maps] [--events] [--only <name>]
//   → v2/design/shots/content_p/map_<fixture>_{1920,phone}.png ・ ev_<event>.png
//   撮りながら、コンソールのエラー・外への通信・R.loadErrors が 0 であること、イベントを流して会話の窓が開くことを確かめる。撮った PNG は必ず Read で見る。
'use strict';
const path = require('path');
const fs = require('fs');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');
const OUT = path.join(__dirname, '..', 'design', 'shots', 'content_p');
fs.mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const doMaps = !argv.includes('--events') || argv.includes('--maps');
const doEvents = !argv.includes('--maps') || argv.includes('--events');

const MAPS = ['roa', 'roa_gate', 'roa_house', 'pharos', 'pharos_gate', 'pharos_harbor', 'pharos_inn', 'pharos_tavern', 'pharos_shop', 'pharos_smith', 'pharos_record',
  'pharos_shipyard', 'lighthouse_1', 'lighthouse_2', 'lighthouse_3', 'well', 'world_roa', 'world_pharos', 'world_bridge', 'world_forest', 'world_fern', 'world_lighthouse'];
const PRO = { prologue_start: true, prologue_berna: true };
const PARTY = Object.assign({}, PRO, { prologue_party: true });
const MORNING = Object.assign({}, PARTY, { prologue_key: true, prologue_tutorial: true, prologue_fine: true, prologue_boss: true });
const DONE = Object.assign({}, MORNING, { prologue_done: true });
// [イベント, フィクスチャ, ctx, 立てるフラグ, 消すフラグ]
const EVENTS = [
  ['roa_house_intro', 'roa_house', {}, {}, ['prologue_start']],
  ['roa_berna', 'roa_house', { npc: 'berna_desk' }, {}, []],
  ['roa_lectern', 'roa_house', {}, {}, []], ['roa_seat', 'roa_house', {}, {}, []], ['roa_shelf', 'roa_house', {}, {}, []],
  ['roa_stone', 'roa', {}, {}, []], ['roa_hall', 'roa', {}, {}, []], ['roa_gate', 'roa_gate', {}, {}, []], ['roa_gatewoman', 'roa', {}, {}, []],
  ['roa_children', 'roa', {}, {}, []], ['roa_elder', 'roa', {}, {}, []], ['roa_farmer', 'roa', {}, {}, []], ['roa_weaver', 'roa', {}, {}, []], ['roa_youth', 'roa', {}, {}, []],
  ['world_pen_lamp', 'world_roa', { x: 89, y: 96 }, {}, []], ['world_bridge_guard', 'world_bridge', {}, {}, []],
  ['world_traveler_plains', 'world_bridge', {}, {}, []], ['world_woodcutter', 'world_forest', {}, {}, []], ['world_shepherd', 'world_bridge', {}, {}, []],
  ['windhill_notes', 'world_forest', {}, DONE, []],
  ['pharos_arrival', 'pharos_gate', {}, {}, ['prologue_pharos']],
  ['pharos_gateguard', 'pharos', {}, {}, []], ['pharos_ship_sailor', 'pharos', {}, {}, []], ['pharos_plaza_woman', 'pharos', {}, {}, []],
  ['pharos_bench_old', 'pharos', {}, {}, []], ['pharos_merchant', 'pharos', {}, {}, []], ['pharos_kid_pier', 'pharos', {}, {}, []],
  ['pharos_yena', 'pharos', {}, {}, []], ['pharos_tract', 'pharos', {}, {}, []], ['pharos_oilboard', 'pharos', {}, {}, []], ['pharos_board', 'pharos', {}, {}, []],
  ['pharos_fishwife', 'pharos', {}, {}, []], ['pharos_old_sailor', 'pharos', {}, {}, []], ['pharos_well_child', 'pharos', {}, {}, []],
  ['pharos_tadeo', 'pharos', {}, DONE, []], ['pharos_otto', 'pharos_harbor', {}, {}, []],
  ['pharos_otto_reward', 'pharos_harbor', {}, MORNING, []], ['pharos_departure', 'pharos', {}, MORNING, []],
  ['pharos_tavern_master', 'pharos_tavern', { npc: 'master' }, PRO, ['prologue_party']],
  ['pharos_rumor_gossip', 'pharos_tavern', { npc: 'gossip' }, DONE, []], ['pharos_rumor_bard', 'pharos_tavern', { npc: 'bard' }, DONE, []],
  ['pharos_rumor_trader', 'pharos_tavern', { npc: 'trader' }, DONE, []], ['pharos_swordsman', 'pharos_tavern', {}, {}, []],
  ['pharos_innkeeper', 'pharos_inn', {}, {}, []], ['pharos_shopkeeper', 'pharos_shop', {}, {}, []], ['pharos_smithy', 'pharos_smith', {}, {}, []],
  ['pharos_rowell', 'pharos_record', {}, {}, ['prologue_rowell']], ['pharos_record_notice', 'pharos_record', {}, {}, []], ['pharos_record_papers', 'pharos_record', {}, {}, []],
  ['pharos_clerk', 'pharos_record', {}, {}, []], ['pharos_shipwright', 'pharos_shipyard', {}, {}, []], ['pharos_apprentice', 'pharos_shipyard', {}, DONE, []],
  ['lighthouse_1_door', 'lighthouse_1', {}, {}, ['prologue_tutorial', 'prologue_lh_door']], ['lighthouse_1_tutorial', 'lighthouse_1', {}, {}, ['prologue_tutorial']],
  ['lighthouse_3_fine', 'lighthouse_3', {}, {}, ['prologue_fine']], ['lighthouse_3_boss', 'lighthouse_3', {}, {}, []], ['lighthouse_3_lamp', 'lighthouse_3', {}, {}, []],
  ['story_t1', 'pharos', {}, DONE, []], ['well_nest', 'well', {}, {}, []], ['well_grave', 'well', {}, {}, []],
];

(async () => {
  const S = await B.start();
  try {
    if (doMaps) {
      section('マップ（1920×1080 とスマホ縦）');
      for (const fx of MAPS) {
        if (only && fx !== only) continue;
        for (const phone of [false, true]) {
          const P = await B.open(S, 'dev.html?fixture=content_p_' + fx, { phone });
          await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='field' && RPG.Engine.time > 1800", 20000).catch(() => {});
          await P.page.waitForTimeout(900);
          const le = await P.page.evaluate('RPG.loadErrors.length');
          await B.shot(P.page, path.join(OUT, `map_${fx}_${phone ? 'phone' : '1920'}.png`));
          ok(`map ${fx}${phone ? '（縦）' : ''}: エラーなし`, P.errors.length === 0 && le === 0, P.errors.slice(0, 3));
          await P.close();
        }
      }
    }
    if (doEvents) {
      section('イベントの会話の 1 枚目（1920×1080）');
      for (const [id, fx, ctx, set, unset] of EVENTS) {
        if (only && id !== only) continue;
        const P = await B.open(S, 'dev.html?fixture=content_p_' + fx);
        await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='field'", 20000).catch(() => {});
        await P.page.waitForTimeout(400);
        await P.page.evaluate(([id, ctx, set, unset]) => {
          const G = RPG.Game;
          Object.assign(G.flags, set);
          for (const f of unset) delete G.flags[f];
          delete G.flags['ev_' + id];
          RPG.MapUtil.invalidate();
          ctx.map = RPG.Field.pos.map;
          window.__cp_ev = RPG.Events.run(id, ctx);
        }, [id, ctx, set || {}, unset || []]);
        const opened = await B.waitFor(P.page, "RPG.UIK.Message.busy() || ['caption','message'].includes((RPG.Engine.top()||{}).id) || String((RPG.Engine.top()||{}).id).indexOf('screen:')===0", 8000); 
        await P.page.waitForTimeout(1500);
        await B.shot(P.page, path.join(OUT, `ev_${id}.png`));
        ok(`${id}: 会話の窓が開く・エラーなし`, opened && P.errors.length === 0, P.errors.slice(0, 3));
        await P.close();
      }
    }
  } finally { await B.stop(S); }
  done('test_content_p_shots');
})().catch((e) => { console.error(e); process.exitCode = 1; });
