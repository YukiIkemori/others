#!/usr/bin/env node
// テスター 2026-09-30 の報告（design/feedback/tester_2026-09-30.md）で直した物の戻りの確かめ: node v2/tools/test_feedback_0930.js [--build]
//   node だけ: 4-3 水の術師の最初の術・(a) ひとりの間は出会わない・(d) レア魔物の率・1-4 灯台の岬の地図の位置・4-1 オットーの置き場所・
//              (c) ボスの前のほのめかし（イベントとトリガーがある）
//   ブラウザ: 1-1 問いの窓の名前（潮風亭のマスター・オットーの 2 回目）・1-3 選択肢の出てすぐの決定は受けない／ピムを帰しても根の門で
//             ついてくる・1-2 作成画面の顔の枠（女の主人公が枠に収まる）・1-12 灯台の鍵を開けたらそのまま中へ
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const { ok, section, done } = require('./lib/testkit');
const argv = process.argv.slice(2);
if (argv.includes('--build')) execFileSync('node', [path.join(__dirname, 'build.js')], { stdio: 'inherit' });

(async () => {
  // ---------------------------------------------------------------- node
  const R = require('./lib/load')({ quiet: true });
  section('node');
  {
    const c = R.Party.makeChar('hero', { hero: { type: 'mage', sex: 'f', name: 'リーネ', fav: 'water' } });
    ok('4-3 水の術師は水の刃とせせらぎ（再生と治療）から始める', c.spells.includes('s_water_1') && c.spells.includes('s_water_1h'), c.spells);
    const f = R.Party.makeChar('hero', { hero: { type: 'mage', sex: 'f', name: 'リーネ', fav: 'fire' } });
    ok('4-3 ほかの属性は今まで通り 1 つ', f.spells.length === 1 && f.spells[0] === 's_fire_1', f.spells);
  }
  ok('(d) レア魔物の率の分母は 2 倍（1/80 → 1/160）', R.Mon.K('RARE_SCALE') === 2);
  {
    const L = R.DB.maps.lighthouse_1;
    ok('4-1 灯台 1 階にオットーはいない（港に残る）', !(L.npcs || []).some((n) => n.id === 'otto'));
    ok('4-2 入口の間のネズミは一行で戦う（members なし）', !/members:\s*\['hero'\]/.test(String(R.DB.events.lighthouse_1_tutorial.run)));
  }
  {
    // 灯台の岬（f_cape）の歩けるマスは、地図の一枚絵の岬の四角の中（東の端が海の上に出ない）
    const A = R.WorldMap.areas.f_cape, m = R.DB.maps.f_cape;
    const pharosExit = (m.exits || []).find((e) => e.to && e.to.map === 'pharos') || { x: 48, y: 7 };
    const px = A && A[0] + ((pharosExit.x + 0.5) / m.w) * A[2];
    ok('1-4 灯台の岬に地図の四角がある・ファロス側の端が岬の絵の中（x ≤ 1000）', !!A && px <= 1000, [A, px]);
  }
  ok('(c) 森の羽虫の手前のほのめかし（verda_moth_hint とトリガー）', !!R.DB.events.verda_moth_hint && (R.DB.maps.verda_2.triggers || []).some((t) => t.event === 'verda_moth_hint'));
  ok('(c) 根食らいの前のヒント・狼の群れ頭のヒントの文がある', ['events.elder_pim_home.hint', 'events.verda_camp_talk.hint_roots', 'events.verda_ben.say_2b'].every((k) => R.T(k) !== k));
  ok('(b) ファロスの町の助言（道具屋・魚売り）', ['ev.pharos_people.pharos_shopkeeper.run.advice', 'ev.pharos_people.pharos_fishwife.run.advice'].every((k) => R.T(k) !== k));

  // ---------------------------------------------------------------- ブラウザ
  const B = require('./lib/browser');
  const S = await B.start();
  try {
    section('1-1 問いの窓にも話し手の名前');
    {
      const P = await B.open(S, 'dev.html?fixture=content_p_pharos_tavern');
      const p = P.page;
      await B.waitFor(p, "(RPG.Engine.top()||{}).id==='field' && !RPG.Events.busy()", 15000);
      await p.evaluate(() => { const S = RPG.Field._s; RPG.Events.talk(S.map, S.npcById.master.def); });
      await B.waitFor(p, "RPG.UIK.Message.busy() && !!(RPG.UIK.Message.state()||{}).choiceRect", 8000);
      const st = await p.evaluate(() => { const L = RPG.UIK.Message.log(); return L[L.length - 1]; });
      ok('潮風亭のマスター（2 回目 = 問い）に名前', st && st.name === RPG_NAME(), st);
      // 1-3 選択肢の出てすぐの決定は受けない
      await B.press(p, 'a');
      const still = await p.evaluate(() => RPG.UIK.Message.busy());
      ok('1-3 選択肢が出てすぐの A は受けない', still);
      await p.waitForTimeout(600);
      await B.press(p, 'b');
      await B.waitFor(p, '!RPG.UIK.Message.busy() || !(RPG.UIK.Message.state()||{}).choiceRect', 5000);
      ok('1-3 少し待てば選べる（B = やめる）', !(await p.evaluate(() => !!(RPG.UIK.Message.state() || {}).choiceRect)));
      ok('エラーなし', P.errors.length === 0, P.errors);
      await P.close();
    }
    section('1-3 ピムを帰しても根の門でついてくる');
    {
      const P = await B.open(S, 'dev.html?fixture=content_f_verda_2');
      const p = P.page;
      await B.waitFor(p, "(RPG.Engine.top()||{}).id==='field' && !RPG.Events.busy()", 15000);
      await p.evaluate(() => {
        Object.assign(RPG.Game.flags, { forest_found_pim: true, forest_found_ben: true, forest_found_hans: true, forest_found_roy: true });
        RPG.Game.choices = Object.assign(RPG.Game.choices || {}, { ch_forest_pim: 'send' });
        delete RPG.Game.flags.forest_pim_guest;
        window.__gate = RPG.Events.run('elder_root_gate', { map: 'verda_2' });
      });
      for (let i = 0; i < 40; i++) {
        if (!(await p.evaluate(() => RPG.Events.busy()))) break;
        await p.waitForTimeout(500);
        await B.press(p, 'a');
      }
      const g = await p.evaluate(() => ({ guest: !!RPG.Game.flags.forest_pim_guest, look: RPG.Game.guest && RPG.Game.guest.look }));
      ok('帰したピムが追いかけてきて、ついてくる人になる（抜け穴のスイッチを押せる）', g.guest && g.look === 'npc_pim', g);
      ok('エラーなし', P.errors.length === 0, P.errors);
      await P.close();
    }
    section('1-2 作成画面の顔（女の主人公が枠に収まる）');
    {
      const P = await B.open(S, 'dev.html?scene=menus_charcreate');
      const p = P.page;
      const r = await p.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 400; c.height = 400;
        const g = c.getContext('2d');
        RPG.Portrait.draw(g, 'hero_f_mage', { x: 20, y: 20, w: 170, h: 170 }, { fit: 'fill' });
        const d = g.getImageData(0, 0, 400, 400).data;
        let x0 = 400, x1 = -1, y0 = 400, y1 = -1;
        for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const sh = RPG.Hd.now('hd:face:hero_f_mage'), m = (sh && sh.meta) || {};
        return { w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, bottom: y1, source: m.source, from: m.from || '' };
      });
      // 原画の顔（シート9、胸から上）は縦長なので、縦か横の長い方が枠の 85% 以上なら枠いっぱい（2026-10-01 リーネの顔のシートが入った）
      ok('顔の絵が枠いっぱい（幅か高さが 85% 以上）で、横の真ん中にある', (r.w >= 170 * 0.85 || r.h >= 170 * 0.85) && r.w >= 170 * 0.7 && Math.abs(r.cx - 105) <= 6, r);
      ok('女の主人公の顔は描いた顔のシート（歩きの原画の切り抜きではない）', r.source === 'sprite' && r.from !== 'field', r);
      await P.close();
    }
    section('1-12 灯台の鍵を開けたらそのまま中へ');
    {
      const P = await B.open(S, 'dev.html?fixture=content_p_lighthouse_1');
      const p = P.page;
      await B.waitFor(p, "(RPG.Engine.top()||{}).id==='field' && !RPG.Events.busy()", 15000);
      await p.evaluate(() => { delete RPG.Game.flags.prologue_lh_door; delete RPG.Game.flags.prologue_tutorial; RPG.Game.flags.prologue_key = true; RPG.Events.run('lighthouse_1_door', { map: 'lighthouse_1', x: 17, y: 22 }); });
      for (let i = 0; i < 30; i++) {
        if (!(await p.evaluate(() => RPG.Events.busy()))) break;
        await p.waitForTimeout(400);
        await B.press(p, 'a');
      }
      const pos = await p.evaluate(() => RPG.Field.pos);
      ok('入口の間（y ≤ 20）に入っている', pos.map === 'lighthouse_1' && pos.y <= 20, pos);
      section('(a) ひとりの間は出会わない');
      const solo = await p.evaluate(() => { const G = RPG.Game, keep = G.party.slice(); G.party = ['hero']; const a = RPG.Field.soloNoEncounter(); G.party = keep; return [a, RPG.Field.soloNoEncounter()]; });
      ok('主人公だけ → 出会わない／仲間がいる → 出会う', solo[0] === true && solo[1] === false, solo);
      ok('エラーなし', P.errors.length === 0, P.errors);
      await P.close();
    }
  } finally { await B.stop(S); }
  done();
})();
function RPG_NAME() { return '潮風亭のマスター'; }
