#!/usr/bin/env node
// クリア後のテスターの報告（2026-10-07）を本物の入力で（ブラウザ。dist/dev.html が要る = tools/build.js の後）。node の確かめは test_postclear_fixes_1007.js
//   Z1 ビブリアの白紙堂の中: メニュー → ワープ → ロアの里 → 飛ぶ → ロアに着く。いまいる所（ビブリア）の行は選ぶとわけが出て、一覧は閉じない
//   Z2 忘却の底 2 階の下り階段の前で ↓ を押したまま → 3 階に着いて、すぐ後ろの上り階段で 2 階へ戻らない。離してもう一度 ↓ なら戻れる
//   Z8 短剣の主人公で「かすめ取り」を選び、L でリピート → 次のラウンドから手で選ばずにかすめ取りが続く
//   node v2/tools/test_postclear_fixes_1007_browser.js [--shots dir]
'use strict';
const path = require('path');
const Bw = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
const D = 'RPG.Battle.debug()';

(async () => {
  const S = await Bw.start();
  const P = await Bw.open(S, 'dev.html?fixture=content_d_kasim', { size: [1280, 720], timeout: +process.env.V2_OPEN_TIMEOUT || 120000 });
  const page = P.page;
  const shot = async (n) => { if (SHOTS) await Bw.shot(page, path.join(SHOTS, n + '.png')); };
  await page.waitForFunction("RPG.Engine.top() && RPG.Engine.top().id==='field' && RPG.Engine.fade.a<0.02", null, { timeout: 90000 });
  await page.evaluate(() => {
    const R = RPG;
    R.DB.config.slice = false;
    Object.assign(R.Game.flags, { prologue_done: true, final_arrived: true, final_archive_seen: true, final_clear: true, story_t8: true, final_roa: true, final_open: true, final_sailed: true, oblivion_2_arrive: true, oblivion_3_arrive: true, oblivion_echo: true });
    R.Game.tier = 8; R.Game.pendingTier = null;
    for (const id of ['roa', 'pharos', 'biblia', 'archive', 'oblivion']) R.Game.warps[id] = true;
    R.Field._encounterStep = () => null;
  });
  const pos = () => page.evaluate(() => { const p = RPG.Field.pos; return { map: p.map, x: p.x, y: p.y }; });
  const enter = (map, spawn) => page.evaluate(async ([m, s]) => { await RPG.Field.enter(m, s, { fade: 0, noAutosave: true }); }, [map, spawn]);
  const listOf = () => page.evaluate(() => { const t = RPG.Engine.top(); return t && t.list ? { id: t.id, i: t.list.index, rows: t.list.rows.map((r) => String(r.value)) } : { id: t && t.id }; });
  const goTo = async (val) => { for (let k = 0; k < 24; k++) { const L = await listOf(); if (!L.rows) return false; if (L.rows[L.i] === val) return true; await Bw.press(page, 'down'); } return false; };
  const fieldIdle = "(() => { const t = RPG.Engine.top(); return !!t && t.id === 'field' && !RPG.Events.busy() && RPG.Engine.fade.a < 0.01 && Object.keys(RPG.Field.locks()).length === 0; })()";

  // ================================================================ Z1
  section('Z1 白紙堂の中からワープ（本物のメニュー）');
  for (let round = 0; round < 2; round++) {
    await enter('biblia_shop', await page.evaluate(() => Object.keys(RPG.DB.maps.biblia_shop.spawns)[0]));
    await Bw.waitFor(page, fieldIdle, 5000);
    await Bw.press(page, 'y');
    ok('menu opens', await Bw.waitFor(page, "(RPG.Engine.top()||{}).id === 'screen:menu'", 5000));
    ok('menu has ワープ', await goTo('warp'));
    await Bw.press(page, 'a');
    ok('warp list opens', await Bw.waitFor(page, "(RPG.Engine.top()||{}).id === 'screen:warp'", 5000));
    if (round === 0) {
      // いまいる所（ビブリア）の行: わけが出て、一覧は閉じない
      ok('Biblia (here) row is in the list', await goTo('biblia'));
      await Bw.press(page, 'a');
      ok('greyed row → a reason is shown (not silent)', await Bw.waitFor(page, `(() => { const v = RPG.Engine.top().view; return !!(v && v.modal && v.modal.o && v.modal.o.text === RPG.T('sys.field.warp.fail.here')); })()`, 3000));
      await shot('z1_here_reason');
      await Bw.press(page, 'a');
      ok('… the list stays open and takes input again', await Bw.waitFor(page, "(() => { const t = RPG.Engine.top(); return t.id === 'screen:warp' && !t.view.modal && !t.view.busy; })()", 3000));
    }
    ok('ロアの里 in the list', await goTo('roa'));
    await Bw.press(page, 'a');
    ok('confirm asks', await Bw.waitFor(page, '!!(RPG.Engine.top().view && RPG.Engine.top().view.modal)', 3000));
    await shot('z1_confirm_' + round);
    await Bw.press(page, 'a');
    ok('arrives in Roa (round ' + (round + 1) + ')', await Bw.waitFor(page, "RPG.Field.pos.map === 'roa' && RPG.Engine.fade.a < 0.01", 15000), await pos());
    await shot('z1_roa_' + round);
    for (let i = 0; i < 20 && !(await page.evaluate(fieldIdle)); i++) { await Bw.press(page, 'a'); await page.waitForTimeout(200); }
  }

  // ================================================================ Z2
  section('Z2 階段で ↓ を押したまま');
  {
    const st = await page.evaluate(() => { const o = RPG.DB.maps.oblivion_2.objects.find((x) => x.type === 'stairs' && x.to && x.to.map === 'oblivion_3'); return { x: o.x, y: o.y }; });
    await page.evaluate(async ([x, y]) => { await RPG.Field.enter('oblivion_2', { x, y: y - 1, dir: 's' }, { fade: 0, noAutosave: true }); }, [st.x, st.y]);
    await Bw.waitFor(page, fieldIdle, 5000);
    await page.keyboard.down('ArrowDown');
    ok('holding ↓ onto the down stairs → floor 3', await Bw.waitFor(page, "RPG.Field.pos.map === 'oblivion_3'", 10000));
    await page.waitForTimeout(2500);
    const p3 = await pos();
    await shot('z2_held_on_floor3');
    await page.keyboard.up('ArrowDown');
    ok('still holding ↓ for 2.5 s → stays on floor 3 (not back up the stairs)', p3.map === 'oblivion_3', p3);
    await page.waitForTimeout(300);
    await page.keyboard.down('ArrowDown');
    ok('released and pressed ↓ again → the up stairs work (deliberate)', await Bw.waitFor(page, "RPG.Field.pos.map === 'oblivion_2'", 10000), await pos());
    await page.keyboard.up('ArrowDown');
    await Bw.waitFor(page, fieldIdle, 5000);
  }

  // ================================================================ Z8
  section('Z8 リピートで盗む（かすめ取り）');
  {
    await page.evaluate(() => {
      const R = RPG, h = R.Game.chars.hero;
      h.equip.weapon1 = 'w_dagger_1'; h.equip.shield = null;
      if (!h.techs.includes('t_dagger_filch')) h.techs.push('t_dagger_filch');
      h.mp = 999;
      R.Settings.set('battleSpeed', 5);
      R.Battle.repeatMemory().on = false; R.Battle.repeatMemory().cmds = null;
      if (R.Game.battle && R.Game.battle.cursor) R.Game.battle.cursor = {};
      window.__r = null;
      // 倒れない・倒さない（ラウンドを重ねる）: 敵の HP を大きく、味方は毎ラウンド全快
      const real = R.BattleCore.create;
      R.BattleCore.create = function (setup) {
        const B = real.apply(this, arguments);
        for (const m of B.engine.mons) { m.hp = 99999; try { m.mhp = 99999; } catch (e) { /* */ } }
        const round = B.round;
        B.round = function () { for (const p of B.engine.party) { if (p.alive) p.hp = p.mhp; p.mp = 999; } return round.apply(this, arguments); };
        return B;
      };
      R.Battle.start({ mons: [['rat_1', 2]], lv: 7 }).then((r) => { window.__r = r; });
    });
    const rowsNow = `(() => { const d = ${D}; if (!d || !d.ui || !d.ui.o || d.phase !== 'input') return null; return { sel: d.ui.sel, rows: d.ui.o.rows.map((r) => r.key || r.id || r.uid || r.label), uid: d.activeUid }; })()`;
    /** 命令の窓を進める: 人ごとに want(uid) の行（'fight' → 'weapon' → 技の id → 相手）を選ぶ */
    const choose = async (want) => {
      for (let i = 0; i < 80; i++) {
        const r = await page.evaluate(rowsNow);
        if (!r) {
          const ph = await page.evaluate(`${D} ? ${D}.phase : null`);
          if (ph === 'play') return true;
          if (ph === 'input') await Bw.press(page, 'a');   // 相手を選ぶ（窓の一覧ではない）: 決定
          await page.waitForTimeout(120);
          continue;
        }
        const w = want.find((k) => r.rows.includes(k));
        const target = w ? r.rows.indexOf(w) : -1;
        if (target >= 0 && target !== r.sel) { await Bw.press(page, r.sel < target ? 'down' : 'up'); continue; }
        await Bw.press(page, 'a');
        await page.waitForTimeout(80);
      }
      return false;
    };
    ok('battle waits for input', await Bw.waitFor(page, `${D} && ${D}.phase === 'input' && !!${D}.ui`, 30000));
    ok('round 1: chose かすめ取り by hand (others attack)', await choose(['fight', 'weapon', 't_dagger_filch', 'attack']));
    ok('round 2 offers repeat', await Bw.waitFor(page, `${D} && ${D}.phase === 'input' && ${D}.partyOpts.includes('repeat') && !!${D}.ui`, 60000));
    await Bw.press(page, 'l');
    ok('L turns repeat on', await Bw.waitFor(page, `${D} && ${D}.B.repeatOn`, 3000));
    // 2 ラウンド分、手で何も選ばずに流れる（各ラウンドの後の B.lastCommands() の主人公がかすめ取り）
    let n = 0;
    const seen = [];
    for (let i = 0; i < 160 && n < 2; i++) {
      await page.waitForTimeout(250);
      const cmds = await page.evaluate(`(() => { const d = ${D}; return d && d.B && d.B.lastCommands ? d.B.lastCommands() : null; })()`);
      const rnd = await page.evaluate(`${D} ? ${D}.B.engine.round : -1`);
      if (cmds && rnd >= 2 && !seen.includes(rnd)) { seen.push(rnd); if (cmds.hero && cmds.hero.id === 't_dagger_filch') n++; }
      if (await page.evaluate(`!!(${D} && ${D}.phase === 'input' && ${D}.ui && !${D}.B.repeatOn)`)) break;
    }
    ok('repeat keeps using かすめ取り with no input (2 rounds)', n >= 2, { n, seen });
    await shot('z8_repeat');
    ok('no command window opened while repeating', await page.evaluate(`${D} && ${D}.B.repeatOn`));
    // 片づけ: 止めて逃げる
    await page.evaluate(() => { const d = RPG.Battle.debug(); if (d && d.B) d.B.setRepeat(false); RPG.Battle.repeatMemory().on = false; });
  }
  const errs = P.errors.filter((e) => !/favicon/.test(e));
  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  await Bw.stop(S);
  done();
})().catch((e) => { console.error(e); process.exit(1); });
