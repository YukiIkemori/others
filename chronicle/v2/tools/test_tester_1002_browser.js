#!/usr/bin/env node
// テスター 2026-10-02（雪の籠城まで）の「事故・詰み」の直し（ブラウザ）:
//   P22 選択肢が出てすぐの決定は受けない（連打・押しっぱなしでも。離して一息おけば選べる）。画面の S.ask の guard も同じ
//   P23・P24 祭を始める前に「夜明けまで村を出られない」の念押し。籠城の夜に全滅 →「ひと息ついて立て直す」（所持金そのまま・大かまどの前で全快）
//   P14 「直前の戦闘からやり直す」は、その戦闘の始まりの状態（HP）と同じ編成で始まる（籠城 3 波目の大狼）
//   Q10 報酬のアクセサリを手に入れたら「誰かに付けますか？」（いちばん強くなる人が既定・「あとで」）
//   Q5  味方をねらう術: 押した味方の体・一覧の行の人に決まる（後ろの人を押して手前の人に入らない）
//   P1・P2 冒険の合言葉: 文字の欄の右クリックで画面が閉じない・「貼り付ける」が読めないときは欄を選んで Ctrl+V（paste）で入る・1 回目で続きへ
//   node v2/tools/test_tester_1002_browser.js [--build]   スクショは design/shots/tester_1002/
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const D = 'RPG.Battle.debug()';
const SHOTS = process.env.SHOTS_DIR || path.join(B.V2, 'design', 'shots', 'tester_1002');
const MS = 'RPG.UIK.Message.state()';

async function main() {
  if (process.argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });
  fs.mkdirSync(SHOTS, { recursive: true });
  const S = await B.start();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 会話・字幕・勝利の札を A で送り、cond が真になるまで（選択肢が出たら 'choice'）。→ true | 'choice' | false */
  async function advance(p, cond, max) {
    for (let i = 0; i < (max || 200); i++) {
      if (await p.evaluate(cond)) return true;
      const st = await p.evaluate(`(() => { const s = ${MS}; return s && s.choiceRect && s.full && s.page === s.pages - 1 ? 'choice' : ''; })()`);
      if (st === 'choice') return 'choice';
      await B.press(p, 'a');
    }
    return false;
  }
  /** 選択肢の i 番を選ぶ（カーソルを動かし、決定を受けるようになってから A） */
  async function choose(p, i) {
    await B.waitFor(p, `${MS} && ${MS}.choiceRect && ${MS}.full && ${MS}.page === ${MS}.pages - 1`, 8000);
    const cur = await p.evaluate(`${MS}.choice`);
    for (let k = cur; k < i; k++) await B.press(p, 'down');
    for (let k = cur; k > i; k--) await B.press(p, 'up');
    await B.waitFor(p, `${MS} && ${MS}.armed`, 4000);
    await B.press(p, 'a');
    await sleep(150);
  }

  // ------------------------------------------------------------------ P22
  section('P22: 選択肢が出てすぐの決定は受けない');
  {
    const P = await B.open(S, 'dev.html?fixture=core_stub_road');
    const p = P.page;
    await B.waitFor(p, `${B.TOP}==='field'`, 8000);
    await p.evaluate(`window.__r = 'none', RPG.UIK.Message.say({ text: '第3の波。どの門を守る？', choices: ['北の門を守る', '東の門を守る', '西の門を守る'] }).then((v) => { __r = v; }), true`);
    // 会話を送る勢いで A を連打（2.4 秒・150 ms ごと）: 前は 1.5 秒で 1 つ目に決まった
    for (let i = 0; i < 16; i++) { await p.keyboard.down('KeyZ'); await sleep(40); await p.keyboard.up('KeyZ'); await sleep(110); }
    ok('mashing A for 2.4 s does not pick a choice', (await B.ev(p, '__r')) === 'none' && (await B.ev(p, `${MS}.armed`)) === false);
    await p.keyboard.down('KeyZ'); await sleep(2200);
    ok('holding A for 2.2 s does not pick a choice', (await B.ev(p, '__r')) === 'none');
    await p.keyboard.up('KeyZ');
    await B.press(p, 'down');
    ok('the cursor can still move while guarded', (await B.ev(p, `${MS}.choice`)) === 1);
    await sleep(450);
    ok('after letting go for a moment the choice is armed', await B.ev(p, `${MS}.armed`));
    await B.press(p, 'a'); await sleep(100);
    ok('then A picks the choice under the cursor (1)', (await B.ev(p, '__r')) === 1, await B.ev(p, '__r'));
    // 画面の選択の札（S.ask の guard）: 店の「今すぐ装備する？」
    await p.evaluate(`(async () => { window.__sv = null; RPG.Screens.open('shop', { id: 'shop_pharos_arms' }); })()`);
    await B.waitFor(p, `${B.TOP}==='screen:shop'`, 5000);
    await sleep(300);
    await p.evaluate(`(() => { const v = RPG.Engine.top().view; window.__ask = 'none'; RPG.Screens.ask(v, { title: '今すぐ装備する？', choices: ['甲', '乙', '装備しない'], index: 1, guard: true }).then((k) => { __ask = k; }); })()`);
    await B.press(p, 'a'); await sleep(80); await B.press(p, 'a'); await sleep(80);
    ok('S.ask {guard}: A right after it opens is ignored', (await B.ev(p, '__ask')) === 'none');
    await sleep(500);
    await B.press(p, 'a'); await sleep(250);
    ok('S.ask {guard}: a deliberate A picks the default row (1)', (await B.ev(p, '__ask')) === 1, await B.ev(p, '__ask'));
    ok('no console errors', P.errors.length === 0, P.errors);
    await P.close();
  }

  // ------------------------------------------------------------------ P23・P24 祭の念押し
  section('P23・P24: 祭を始める前の念押し');
  {
    const P = await B.open(S, 'dev.html?fixture=content_s_yule_plaza');
    const p = P.page;
    await B.waitFor(p, `${B.TOP}==='field' && !RPG.Events.busy()`, 15000);
    await p.evaluate(() => { const f = RPG.Game.flags; f.snow_jorn_talked = true; f.snow_logs_done = true; f.snow_tales_done = true; f.snow_ice_done = true; f.snow_tale_dragon = true; f.snow_tale_hunter = true; f.snow_tale_fire_child = true; RPG.Events.run('yule_jorn', { map: 'yule', npc: 'jorn' }); });
    ok('Jorn asks to start the festival', (await advance(p, 'false', 20)) === 'choice');
    await choose(p, 0);
    ok('a second question appears (the confirmation)', (await advance(p, 'false', 20)) === 'choice');
    const log = await p.evaluate(() => RPG.UIK.Message.log().slice(-2).map((l) => l.text).join(' '));
    ok('… it says you cannot leave the village until dawn', /出られん/.test(log) && /夜が明ける/.test(log), log);
    await B.waitFor(p, `${MS}.armed`, 3000);
    await B.shot(p, path.join(SHOTS, 'festival_confirm_1920.png'));
    await choose(p, 1);
    await advance(p, '!RPG.Events.busy()', 20);
    ok('「まだ支度をする」 → the festival does not start', !(await p.evaluate('!!RPG.Game.flags.snow_festival_lit')));
    ok('no console errors', P.errors.length === 0, P.errors);
    await P.close();
  }

  // ------------------------------------------------------------------ P14・P23 籠城 3 波目の大狼
  section('P14: 3 波目の大狼 — やり直しは戦闘の始まりの HP と同じ編成で / 全滅 → 大かまどで立て直す');
  {
    const P = await B.open(S, 'dev.html?fixture=content_s_yule_night');
    const p = P.page;
    await B.waitFor(p, `${B.TOP}==='field' && !RPG.Events.busy()`, 15000);
    await p.evaluate(() => {
      RPG.Settings.set('battleSpeed', 5);
      const G = RPG.Game; G.vars.snow_wave = 2; G.choices.ch_snow_gate_1 = 'n'; G.choices.ch_snow_gate_2 = 'e'; G.choices.ch_snow_tale = 'dragon'; G.gold = 777;
      RPG.Events.run('snow_siege_wave', { map: 'yule_night' });
    });
    ok('wave 3 asks which gate', (await advance(p, 'false', 20)) === 'choice' && /第3の波/.test(await p.evaluate(() => RPG.UIK.Message.log().slice(-1)[0].text)));
    await choose(p, 0);   // 北の門（大狼は守らなかった西の門 → 読み外し）
    ok('wrong gate → the gate battle starts', (await advance(p, `${B.TOP}==='battle' && ${D} && ${D}.B && ${D}.phase === 'input'`, 60)) === true);
    // 門の戦いで弱った: 一行の HP を 1/3 にして勝つ
    await p.evaluate(`(() => { const e = ${D}.B.engine; for (const u of e.party) u.hp = Math.max(1, Math.floor(u.mhp / 3)); e.result = 'win'; })()`);
    ok('the boss battle (blizzard wolf) starts', (await advance(p, `${B.TOP}==='battle' && ${D} && ${D}.setup && /blizzardwolf/.test(${D}.setup.troop || '') && ${D}.phase === 'input'`, 120)) === true);
    const start0 = await p.evaluate(`({ troop: ${D}.setup.troop, foes: ${D}.B.units.filter((u) => u.side === 'enemy').map((u) => u.id), hp: ${D}.B.units.filter((u) => u.side === 'party').map((u) => [u.id, u.hp]) })`);
    ok('the boss battle begins with the party weakened by the gate battle (chained fight)', start0.hp.every(([, hp]) => hp > 0) && start0.hp.some(([id, hp]) => hp < 100000), start0);
    // 大狼が狼を呼ぶ・一行が削られる → 全滅
    const WIPED = `${D} && ${D}.go && ${D}.ui && ${D}.ui.o.rows.length === 3`;
    await p.evaluate(`(() => { const e = ${D}.B.engine; for (const u of e.party) u.hp = 1; e.result = 'lose'; })()`);
    ok('party wiped (3 choices)', (await advance(p, `${D} && !!${D}.go`, 80)) === true && await B.waitFor(p, WIPED, 15000));
    const rows = await p.evaluate(`${D}.ui.o.rows.map((r) => r.label)`);
    ok('in the siege the 2nd row is 「ひと息ついて立て直す」 (no gold loss)', rows[1] === 'ひと息ついて立て直す', rows);
    await B.shot(p, path.join(SHOTS, 'siege_wipe_menu_1920.png'));
    await B.press(p, 'a');   // 直前の戦闘から
    ok('retry restarts the boss battle', await B.waitFor(p, `${D} && ${D}.retry === 1 && ${D}.B && ${D}.phase === 'input'`, 20000));
    const start1 = await p.evaluate(`({ troop: ${D}.setup.troop, foes: ${D}.B.units.filter((u) => u.side === 'enemy').map((u) => u.id), hp: ${D}.B.units.filter((u) => u.side === 'party').map((u) => [u.id, u.hp]) })`);
    ok('retry: same troop and the same enemies as at the start (no extra summoned wolf)', start1.troop === start0.troop && JSON.stringify(start1.foes) === JSON.stringify(start0.foes), { start0, start1 });
    ok('retry: party HP equals the HP at the START of the boss battle (not the wiped end state)', JSON.stringify(start1.hp) === JSON.stringify(start0.hp), { start0: start0.hp, start1: start1.hp });
    await p.evaluate(`(() => { const e = ${D}.B.engine; for (const u of e.party) u.hp = 1; e.result = 'lose'; })()`);
    ok('wipes again', (await advance(p, `${D} && !!${D}.go`, 80)) === true && await B.waitFor(p, WIPED, 15000));
    await B.press(p, 'down'); await B.press(p, 'a');   // ひと息ついて立て直す
    ok('wakes at the hearth with a caption (talk to the chief to try again)', await B.waitFor(p, `${B.TOP}==='caption' || (RPG.Engine.has('caption') && RPG.Field._s.map.id === 'yule_night')`, 15000));
    await sleep(1200);
    await B.shot(p, path.join(SHOTS, 'siege_regroup_1920.png'));
    ok('back on the siege night map', await B.waitFor(p, `${B.TOP}==='field' && RPG.Field._s.map.id === 'yule_night' && !RPG.Events.busy() && RPG.Engine.fade.a < 0.01`, 15000), await p.evaluate(() => [RPG.Engine.top().id, RPG.Field._s && RPG.Field._s.map && RPG.Field._s.map.id]));
    const after = await p.evaluate(() => ({ gold: RPG.Game.gold, full: RPG.Party.members().every((c) => c.hp > 0 && c.hp === RPG.Rules.stats(c).maxHp), wave: RPG.Game.vars.snow_wave, done: !!RPG.Game.flags.snow_siege_done }));
    ok('gold is NOT halved, everyone fully healed, still wave 3 (can try again via Jorn)', after.gold === 777 && after.full && after.wave === 2 && !after.done, after);
    await p.evaluate(() => { RPG.Events.run('yule_siege_jorn', { map: 'yule_night', npc: 'jorn' }); });
    ok('talking to Jorn starts wave 3 again (gate choice)', (await advance(p, 'false', 20)) === 'choice' && /第3の波/.test(await p.evaluate(() => RPG.UIK.Message.log().slice(-1)[0].text)));
    ok('no console errors', P.errors.length === 0, P.errors);
    await P.close();
  }

  // ------------------------------------------------------------------ Q10 報酬のアクセサリ
  section('Q10: 報酬のアクセサリを付けるか聞く');
  {
    const P = await B.open(S, 'dev.html?fixture=content_s_yule_plaza');
    const p = P.page;
    await B.waitFor(p, `${B.TOP}==='field' && !RPG.Events.busy()`, 15000);
    await p.evaluate(() => {
      delete RPG.Game.items.ac_tale_snow;
      RPG.DB.events.t_reward = { run: async (ev) => { await ev.say(null, '村長から、首飾りを受け取った。'); ev.item('ac_tale_snow', 1); await ev.say(null, '大事にしてくれ。'); } };
      RPG.Events.run('t_reward', { map: 'yule' });
    });
    ok('after the event, a choice asks who should wear it', (await advance(p, 'false', 20)) === 'choice');
    const q = await p.evaluate(() => ({ text: RPG.UIK.Message.log().slice(-1)[0].text, st: RPG.UIK.Message.state() }));
    const plan = await p.evaluate(() => { const pl = RPG.Screens.wearPlan('ac_tale_snow'); return { best: pl.best, ids: pl.rows.map((r) => r.c.id), gains: pl.rows.map((r) => r.gain) }; });
    ok('… 「…を、だれかに付けますか？」', /だれかに付けますか/.test(q.text), q.text);
    ok('… cursor starts on the member who gains most', q.st.choice === plan.best, { choice: q.st.choice, plan });
    await B.waitFor(p, `${MS}.armed`, 3000);
    await B.shot(p, path.join(SHOTS, 'reward_wear_1920.png'));
    await B.press(p, 'a');
    await advance(p, '!RPG.Events.busy()', 10);
    const wore = await p.evaluate((id) => { const c = RPG.Game.chars[id]; return c.equip.acc1 === 'ac_tale_snow' || c.equip.acc2 === 'ac_tale_snow'; }, plan.ids[plan.best]);
    ok('A → that member wears it', wore);
    // 「あとで」
    await p.evaluate(() => { RPG.DB.events.t_reward2 = { run: async (ev) => { ev.item('ac_tale_desert', 1); } }; RPG.Events.run('t_reward2', { map: 'yule' }); });
    ok('second reward asks too', (await advance(p, 'false', 10)) === 'choice');
    const n = await p.evaluate(`${MS}.choiceRect && RPG.UIK.Message.state() && 0`);
    void n;
    await B.waitFor(p, `${MS}.armed`, 3000);
    await B.press(p, 'b'); await sleep(200);
    await advance(p, '!RPG.Events.busy()', 10);
    ok('B (= あとで) keeps it in the bag', await p.evaluate(() => (RPG.Game.items.ac_tale_desert || 0) === 1));
    ok('no console errors', P.errors.length === 0, P.errors);
    await P.close();
  }

  // ------------------------------------------------------------------ Q5 味方をねらう
  section('Q5: 味方をねらうクリックは押した人に決まる');
  // 幅の狭い窓（900×1080）では前列・後列の絵の当たりが重なり、前は後ろの人の胸から下を押すと手前の人に入った
  for (const size of [[1920, 1080], [900, 1080]]) {
    const P = await B.open(S, 'dev.html?fixture=content_s_yule_plaza', { size });
    const p = P.page;
    await B.waitFor(p, `${B.TOP}==='field' && !RPG.Events.busy()`, 15000);
    await p.evaluate(`(() => { window.__r = null; RPG.Battle.start({ mons: [['stub_slime', 2]], bg: 'snow' }).then((r) => { window.__r = r; }); return true; })()`);
    ok('battle on top', await B.waitFor(p, `${D} && ${D}.B && ${D}.phase === 'input'`, 20000));
    const res = await p.evaluate(`(() => {
      const st = ${D}, _ = RPG.Battle._;
      const list = st.actors.filter((a) => a.side === 'party');
      const out = [];
      for (const a of list) {
        const h = _.actors.height(a);
        for (const fy of [0.25, 0.45, 0.7]) {
          const q = { x: a.x, y: a.y - h * fy };
          const hit = _.target.hitAt(st, list, q, null);
          out.push([a.uid, fy, hit && hit.uid]);
        }
      }
      const rects = _.hud.partyRects(st), units = st.partyUnits();
      const rowHits = units.map((u, i) => { const r = rects[i]; const hit = _.target.hitAt(st, list, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, rects); return [u.uid, hit && hit.uid]; });
      return { out, rowHits };
    })()`);
    const miss = res.out.filter(([u, , h]) => u !== h);
    ok(`${size.join('x')}: clicking the body of each ally (head/chest/legs) picks that ally`, miss.length === 0, miss);
    ok(`${size.join('x')}: clicking each ally row in the party list picks that ally`, res.rowHits.every(([u, h]) => u === h), res.rowHits);
    ok('no console errors', P.errors.length === 0, P.errors);
    await P.close();
  }

  // ------------------------------------------------------------------ P1・P2 冒険の合言葉
  section('P1・P2: 冒険の合言葉（遊ぶ版の 1 回目）');
  {
    const ctx = await S.browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
    p.on('pageerror', (e) => errors.push('[pageerror] ' + e));
    await p.goto(S.base + 'index.html');
    // 起動の先読みを待たない（タイトルが出たらすぐ）
    await p.waitForFunction(`${B.TOP}==='screen:title'`, null, { timeout: 60000 });
    const code = await p.evaluate(() => { RPG.State.newGame({ hero: { type: 'mage', sex: 'f', name: 'リーネ' } }); const s = RPG.DB.config.start; RPG.Game.pos = { map: s.map, x: 5, y: 5, dir: 's' }; const c = RPG.Save.passphrase(); RPG.Game = null; return c; });
    await p.evaluate(() => { RPG.Engine.top().view.pick({ value: 'passphrase' }); });
    ok('passphrase screen opens', await B.waitFor(p, `${B.TOP}==='screen:passphrase'`, 5000));
    await sleep(400);
    const box = await p.evaluate(() => { const r = document.querySelector('textarea').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.click(box.x, box.y, { button: 'right' });
    await sleep(300);
    ok('right-click on the text field does not close the screen (was B = back)', await p.evaluate(`${B.TOP}==='screen:passphrase'`));
    await p.keyboard.press('Escape');   // 文字の欄の外へ（ゲームの画面は Esc では戻らない: 欄に入っているので）
    // 「貼り付ける」: ヘッドレスは写し取りの許可が無い → 欄を選んで Ctrl+V の案内
    await p.evaluate(() => { RPG.Engine.top().view.act('paste'); });
    await B.waitFor(p, '/Ctrl/.test(RPG.Engine.top().view.msg || "")', 5000);
    const m = await p.evaluate(() => ({ msg: RPG.Engine.top().view.msg, focus: document.activeElement && document.activeElement.tagName }));
    ok('paste without clipboard permission → the field is focused and Ctrl+V is explained', /Ctrl\+V/.test(m.msg) && m.focus === 'TEXTAREA', m);
    await B.shot(p, path.join(SHOTS, 'passphrase_paste_1920.png'));
    // 欄の外（ゲームの画面）で Ctrl+V → document の paste で欄に入る
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.evaluate((c) => { const dt = new DataTransfer(); dt.setData('text/plain', c + '\n'); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, code);
    ok('a paste event outside the field fills the field', (await p.evaluate(() => document.querySelector('textarea').value)) === code);
    await p.evaluate(() => { RPG.Engine.top().view.act('load'); });
    ok('the first load goes on to the field (not back to the title)', await B.waitFor(p, `${B.TOP}==='field' && !!RPG.Game`, 30000), await p.evaluate(() => RPG.Engine.stack.map((s) => s.id)));
    ok('no console errors', errors.length === 0, errors);
    await ctx.close();
  }

  await B.stop(S);
  done('test_tester_1002_browser');
}
main().catch((e) => { console.error(e); process.exit(2); });
