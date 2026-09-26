#!/usr/bin/env node
// EVENTS のブラウザのテストとスクショ（V2_PLAN §4.4 の EVENTS の行: 手がかり帳の通知・歌あわせ・地方の解決の演出）。
//   node v2/tools/test_events_browser.js [--no-build]
// FIELD の試しのマップ（tools/test_field_fx、dev_test_field_fx.html）を自分の出力先に焼き、tools/test_events_fx/events.js をページに読み込んで動かす。
// 撮る物は v2/design/shots/events/ に 16:9（1920×1080）とスマホ縦（390×844）。撮ったら必ず Read で見る（§2.9）。
// 確かめる物: 通知の札・Y で目印（メニューが開かない）・初めての手がかりの説明の札・歌あわせを遊び切る・地方の解決（tier・pendingTier・章の札）・
// 次の町で story_t1（E17）・各場面の後の不変条件（§2.5.3）・コンソールのエラー 0・外への通信 0。
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const V2 = B.V2;
const OUT = process.env.EVENTS_DIST || path.join(require('os').tmpdir(), 'v2_events_dist');
const SHOTS = path.join(V2, 'design', 'shots', 'events');
const FX = fs.readFileSync(path.join(V2, 'tools', 'test_events_fx', 'events.js'), 'utf8');
const PAGE = 'dev_test_field_fx.html';

const ST = {
  pharos: { desc: 'EVENTS: ファロスの広場', hero: { type: 'warrior', sex: 'm', name: 'アルン' }, party: ['hero', 'selma', 'viola', 'marta'], reserve: [], tier: 0, gl: 'auto', prof: 'auto', flags: {}, vars: {}, items: {}, gold: 120, leads: [], map: { id: 'field_pharos', spawn: 'plaza' } },
  fern: { desc: 'EVENTS: フェルンの広場', hero: { type: 'warrior', sex: 'm', name: 'アルン' }, party: ['hero', 'selma', 'viola', 'marta'], reserve: [], tier: 0, gl: 'auto', prof: 'auto', flags: {}, vars: {}, items: {}, gold: 120, leads: [], map: { id: 'field_fern', spawn: 'square' } },
};

async function openAt(S, st, o) {
  const P = await B.open(S, PAGE, o);
  await P.page.evaluate(FX);
  await P.page.evaluate(async (fx) => {
    const R = window.RPG;
    R.Dev.applyState(fx);
    R.Engine.clear();
    await R.Field.enter(fx.map.id, fx.map.spawn, { fade: 0, noAutosave: true });
  }, st);
  await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='field' && RPG.Engine.fade.a < 0.01", 8000);
  await P.page.waitForTimeout(700);
  return P;
}
const run = (p, id) => p.evaluate((id) => { window.__evDone = false; RPG.Events.run(id, { map: RPG.Field.pos.map }).then(() => { window.__evDone = true; }); }, id);

(async function main() {
  if (!process.argv.includes('--no-build')) {
    execFileSync('node', [path.join(V2, 'tools', 'build.js'), '--with', path.join(V2, 'tools', 'test_field_fx'), '--out', OUT], { stdio: 'inherit' });
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  const S = await B.start({ dist: OUT });
  const shots = [];
  const shot = async (p, name) => { const f = path.join(SHOTS, name + '.png'); await B.shot(p, f); shots.push(path.relative(path.join(V2, '..'), f)); };
  try {
    for (const phone of [false, true]) {
      const tag = phone ? '_phone' : '';
      // ============================================================ 手がかり帳の通知
      section('lead notice' + tag);
      let P = await openAt(S, ST.pharos, { phone });
      await run(P.page, 'ev_rumor');
      await B.waitFor(P.page, 'RPG.UIK.Message.busy()', 4000);
      await B.pressUntil(P.page, 'a', '!!RPG.Game.leads.l_ev_forest_missing', 10);
      await P.page.waitForTimeout(400);
      ok('the lead card waits while the talk is open' + tag, await P.page.evaluate('RPG.Leads._current() === null && RPG.UIK.Message.busy()'));
      await B.pressUntil(P.page, 'a', '!RPG.Events.busy()', 20);
      await B.waitFor(P.page, 'RPG.Leads._current() !== null', 3000);
      await P.page.waitForTimeout(500);
      ok('after the talk: card shown for the first lead' + tag, await P.page.evaluate("RPG.Leads._current().id === 'l_ev_forest_missing'"));
      await shot(P.page, 'lead_notice' + tag);
      await B.press(P.page, 'y');
      await P.page.waitForTimeout(250);
      ok('Y pins it; the menu does not open' + tag, await P.page.evaluate("RPG.Leads.pinned() === 'l_ev_forest_missing' && RPG.Engine.top().id === 'field'"));
      await P.page.waitForTimeout(300);
      await shot(P.page, 'lead_pinned' + tag);
      // 2 本目の札 → 説明の札（MENUS の tip）
      await B.waitFor(P.page, "RPG.Leads._current() && RPG.Leads._current().id === 'l_ev_snow_fire'", 6000);
      await P.page.waitForTimeout(600);
      await shot(P.page, 'lead_second' + tag);
      await B.waitFor(P.page, "RPG.Engine.top().id === 'screen:tip' || !!RPG.Game.flags.tip_leads", 8000);
      await P.page.waitForTimeout(400);
      ok('first lead → tip leads opened once' + tag, await P.page.evaluate('!!RPG.Game.flags.tip_leads'));
      await B.pressUntil(P.page, 'a', "RPG.Engine.top().id === 'field'", 6);
      await P.page.waitForTimeout(300);
      const inv1 = await B.invariants(P.page);
      ok('invariants after the lead event' + tag, inv1.ok, inv1);
      ok('no console errors' + tag, !P.errors.length, P.errors);
      await P.close();

      // ============================================================ 歌あわせ
      section('song' + tag);
      P = await openAt(S, ST.fern, { phone });
      await run(P.page, 'ev_song');
      await B.waitFor(P.page, "RPG.Mini.state() && RPG.Mini.state().phase === 'play' && RPG.Mini.state().lit >= 0", 5000);
      await P.page.waitForTimeout(120);
      await shot(P.page, 'song_listen' + tag);
      const DIR = ['up', 'right', 'down', 'left', 'a'];
      for (let round = 0; round < 3; round++) {
        await B.waitFor(P.page, "RPG.Mini.state() && RPG.Mini.state().phase === 'input'", 12000);
        const seq = await P.page.evaluate('RPG.Mini.state().seq');
        for (let i = 0; i < seq.length; i++) {
          if (round === 1 && i === 2 && !phone) await shot(P.page, 'song_input' + tag);
          // 3 節目の最後だけまちがえる（評価の A を撮る）
          const v = round === 2 && i === seq.length - 1 ? (seq[i] + 1) % 4 : seq[i];
          await B.press(P.page, DIR[v]);
          await P.page.waitForTimeout(60);
        }
        if (round === 0) { await P.page.waitForTimeout(150); await shot(P.page, 'song_ok' + tag); }
      }
      await B.waitFor(P.page, "RPG.Mini.state() && RPG.Mini.state().phase === 'result'", 6000);
      await P.page.waitForTimeout(1100);
      await shot(P.page, 'song_result' + tag);
      await B.press(P.page, 'a');
      await B.waitFor(P.page, 'window.__evDone === true', 4000);
      const song = await P.page.evaluate('window.__evSong');
      ok('song: result {score, rank} (11 of 12)' + tag, song && song.hits === 11 && song.total === 12 && song.rank === 'A', song);
      await P.page.waitForTimeout(300);
      const inv2 = await B.invariants(P.page);
      ok('invariants after the song' + tag, inv2.ok, inv2);
      ok('no console errors' + tag, !P.errors.length, P.errors);
      await P.close();

      // ============================================================ 地方の解決の演出
      section('region clear' + tag);
      P = await openAt(S, ST.fern, { phone });
      await run(P.page, 'ev_clear');
      await B.waitFor(P.page, "RPG.Engine.has('celebrate') && RPG.Engine.fade.a < 0.05", 8000);
      await P.page.waitForTimeout(900);
      await shot(P.page, 'clear_pillar' + tag);
      const s1 = await P.page.evaluate('({tier: RPG.Game.tier, pending: RPG.Game.pendingTier, cleared: !!RPG.Game.cleared.r_forest, chapter: RPG.Game.chapter, page: RPG.Game.items.k_page_forest})');
      ok('clearRegion: tier 1, pendingTier 1, cleared, chapter 1, page' + tag, s1.tier === 1 && s1.pending === 1 && s1.cleared && s1.chapter === 1 && s1.page === 1, s1);
      await B.waitFor(P.page, "RPG.Engine.has('celebrate')", 3000);
      await P.page.waitForTimeout(2000);
      await shot(P.page, 'clear_card' + tag);
      await B.pressUntil(P.page, 'a', "!RPG.Engine.has('celebrate')", 8);
      await B.waitFor(P.page, 'window.__evDone === true', 4000);
      await P.page.waitForTimeout(800);
      const inv3 = await B.invariants(P.page);
      ok('invariants after the clear' + tag, inv3.ok, inv3);
      // E17: 次の町に入る → story_t1
      await P.page.evaluate("RPG.Field.enter('field_pharos', 'plaza')");
      await B.waitFor(P.page, 'window.__evT1 !== undefined', 8000);
      ok('E17: entering a town runs story_t1 once' + tag, await P.page.evaluate("window.__evT1 === 'enter' && RPG.Game.pendingTier === null"));
      await B.pressUntil(P.page, 'a', '!RPG.Events.busy()', 10);
      await P.page.waitForTimeout(500);
      const inv4 = await B.invariants(P.page);
      ok('invariants after story_t1' + tag, inv4.ok, inv4);
      ok('no console errors' + tag, !P.errors.length, P.errors);
      await P.close();
    }
  } finally {
    await B.stop(S);
  }
  console.log('\nshots:\n  ' + shots.join('\n  '));
  done('test_events_browser');
})().catch((e) => { console.error(e); process.exitCode = 1; });
