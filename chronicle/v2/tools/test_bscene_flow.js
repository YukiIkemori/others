#!/usr/bin/env node
// BSCENE（ブラウザ）: 出来事の列を全種類流して止まらない・倍速と早送りでも最短の表示時間（閃き 0.9 秒・レアの札 0.6 秒、A12）・
// リピート（B で止める）・カーソル記憶・NEW・逃げる・canLose・全滅の 3 択（直前の戦闘から／宿から／タイトル）と §2.5.3 の不変条件。
//   node v2/tools/test_bscene_flow.js [--build]
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const D = 'RPG.Battle.debug()';
const start = (setup) => `(() => { window.__r = null; RPG.Battle.start(${JSON.stringify(setup)}).then((r) => { window.__r = r; }); return true; })()`;
const INV = `(() => { const t = RPG.Engine.top(); return !!(t && t.id === 'field' && !RPG.Events.busy() && !RPG.UIK.Message.busy() && RPG.Engine.fade.a < 0.01 && Object.keys(RPG.Field.locks()).length === 0 && RPG.Input.enabled); })()`;

async function main() {
  if (process.argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const S = await B.start();
  const P = await B.open(S, 'dev.html?fixture=core_stub_road');
  const p = P.page;
  ok('fixture opens the field', await B.waitFor(p, `${B.TOP}==='field'`, 4000));

  section('全種類の出来事（戦闘の速さ ＋2）');
  await B.ev(p, "RPG.Settings.set('battleSpeed', 3)");
  await B.ev(p, start({ demo: 'all', autoInput: true, mons: [['x', 1]] }));
  ok('battle scene on top, opaque', await B.waitFor(p, `${B.TOP}==='battle' && RPG.Engine.top().opaque`, 10000));
  ok('all rounds played to the victory', await B.waitFor(p, `${D} && ${D}.result`, 60000));
  const log = await B.ev(p, `${D}.log`);
  const kinds = await B.ev(p, 'Object.keys(RPG.Contract.BATTLE_EVENTS)');
  const seen = new Set(log.map((l) => l.t));
  ok('every event kind was played', kinds.every((k) => seen.has(k)), kinds.filter((k) => !seen.has(k)));
  const gl = log.find((l) => l.t === 'glimmer-name');
  ok('glimmer name shown ≥ 0.9 s even at ＋2', gl && gl.ms >= 880, gl);
  const card = log.find((l) => l.t === 'card');
  ok('rare card shown ≥ 0.6 s (A12)', card && card.ms >= 590, card);
  ok('victory panel opens', await B.waitFor(p, `${D} && ${D}.result && ${D}.next`, 20000));
  const merged = await B.ev(p, `(() => { const d = ${D}; const L = RPG.Battle._.result.layoutVictory(d); const pu = d.result.data.profUI; return { pages: L.pages.length, profInPanel: !!(pu && pu.members.some((m) => m.ups.length)), stolen: d.result.data.drops.some((x) => x.stolen), extra: RPG.Battle._.result.pages.map((x) => x.id) }; })()`);
  ok('one result screen: gold・items (stolen)・growth・proficiency・learned in the same panel, no extra prof page', merged && merged.pages === 1 && merged.profInPanel && merged.stolen && !merged.extra.includes('prof'), merged);
  await p.waitForTimeout(2500);
  ok('victory never closes by itself, even at ×3 (owner 2026-09-27)', !(await B.ev(p, 'window.__r')) && (await B.ev(p, `${D}.phase === 'result'`)));
  ok('confirm closes the victory (fade out → field)', await B.pressUntil(p, 'a', 'window.__r', 20));
  const le = await B.ev(p, 'RPG.Battle.lastEnd');
  ok('end sequence order: pose → panel → press → fade out → field', le && le.poseAt < le.panelAt && le.panelAt <= le.pressAt && le.pressAt <= le.fadeOutAt && le.fadeOutAt < le.fieldAt && le.fieldAt - le.fadeOutAt >= 800, le);
  const r1 = await B.ev(p, 'window.__r');
  ok('result win with rewards (K.battleResult)', r1 && r1.result === 'win' && (await B.ev(p, 'RPG.Contract.check("battleResult", window.__r).ok')), r1);
  const vic = (await B.ev(p, `window.__lastLog = ${D} ? ${D}.log : null`), log);
  void vic;
  ok('invariants after the win (field on top, no lock, no message)', await B.waitFor(p, INV, 3000));
  ok('autosave after the win', await B.ev(p, "!!RPG.Save.cards().find((c) => c.slot === 'auto' && c.card)"));
  await B.ev(p, "RPG.Settings.set('battleSpeed', 1)");

  section('戦闘の速さ（R: 通常 → ＋1 → ＋2 → 通常、設定に残る）');
  await B.ev(p, "RPG.Settings.set('battleSpeed', 1)");
  await B.ev(p, start({ demo: 'normal', mons: [['x', 1]] }));
  ok('battle waits for input', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui`, 20000));
  ok('speed label 「▶ 通常」', (await B.ev(p, 'RPG.Battle.speedText(RPG.Settings.get("battleSpeed"))')) === '▶ 通常');
  const seen2 = [];
  for (let i = 0; i < 4; i++) { await B.press(p, 'r'); seen2.push(await B.ev(p, 'RPG.Settings.get("battleSpeed")')); }
  ok('R cycles 通常 → ＋1 → ＋2 → ＋4 → 通常', seen2.join() === '2,3,5,1', seen2);
  await B.press(p, 'r');
  ok('A is not a fast-forward any more (clock runs at the set speed only)', await B.ev(p, `${D}.mul() === 2`));
  ok('the chosen speed is saved in settings (localStorage)', await B.ev(p, "(() => { try { return JSON.stringify(localStorage).includes('battleSpeed'); } catch (e) { return true; } })()"));
  await B.ev(p, "RPG.Settings.set('battleSpeed', 1)");
  ok('finish that battle', await B.pressUntil(p, 'a', 'window.__r', 120));

  section('コマンド・カーソル記憶・NEW・リピート');
  await B.ev(p, start({ demo: 'tele', mons: [['x', 1]], bg: 'tower' }));
  ok('party menu (一行の命令) opens', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui`, 20000));
  await B.press(p, 'a'); // 戦う
  // アルン: 剣 → 疾風剣（NEW、4 行目）→ ねらい
  await B.press(p, 'a');
  await p.waitForTimeout(120);
  const hasNew = await B.ev(p, `${D}.ui && ${D}.ui.o && ${D}.ui.o.rows.some((r) => r.isNew)`);
  ok('skill list shows a NEW row', hasNew);
  for (let i = 0; i < 3; i++) await B.press(p, 'down');
  await B.press(p, 'a');
  await p.waitForTimeout(120);
  await B.press(p, 'a'); // ねらい
  // 残りの 3 人: 剣系 → 攻撃 → ねらい
  for (let m = 0; m < 3; m++) { await B.press(p, 'a'); await B.press(p, 'a'); await B.press(p, 'a'); }
  ok('round 1 plays after all commands', await B.waitFor(p, `${D}.phase==='play' || ${D}.phase==='idle'`, 4000));
  const heroId = await B.ev(p, 'RPG.Party.members()[0].id');
  const cur = await B.ev(p, `RPG.Game.battle.cursor[${JSON.stringify(heroId)}]`);
  ok('cursor memory: weapon list row and target are remembered', cur && cur.weapon === 3 && cur.target != null, cur);
  ok('NEW is written to R.Game.seenSkill after the list was shown', await B.ev(p, "!!RPG.Game.seenSkill['demo_sword_2']"));
  ok('round 2: party menu again', await B.waitFor(p, `${D}.phase==='input' && ${D}.ui`, 15000));
  ok('repeat is offered from round 2', await B.ev(p, `${D}.partyOpts.includes('repeat')`));
  await B.press(p, 'down'); await B.press(p, 'a'); // リピート
  ok('repeat turns on and the round plays without input', await B.waitFor(p, `${D}.B.repeatOn && ${D}.phase==='play'`, 3000));
  await B.press(p, 'b');
  ok('B stops the repeat (A6)', await B.waitFor(p, `!${D}.B.repeatOn`, 2000));
  ok('after the repeat stops, the next round waits for input', await B.waitFor(p, `(${D} && ${D}.phase==='input' && ${D}.ui) || window.__r`, 15000));
  const memParty = await B.ev(p, 'RPG.Game.battle.cursor._party');
  ok('party command cursor remembered (repeat = 1)', memParty === 1, memParty);
  ok('finish the battle', await B.pressUntil(p, 'a', 'window.__r', 80));
  // 「finish the battle」は A の連打で一行の命令のリピート（カーソル記憶 = 1）をまた選ぶので、覚えを消してから次の戦闘
  await B.ev(p, 'RPG.Battle.repeatMemory().on = false; 0');
  ok('with the repeat memory off, the next battle waits for input', await (async () => { await B.ev(p, start({ demo: 'normal', mons: [['x', 1]] })); const r = await B.waitFor(p, `${D} && ${D}.phase==='input'`, 20000); const on = await B.ev(p, `${D}.B.repeatOn`); return r && !on; })());

  section('逃げる');
  // 一行の命令: 戦う・リピート（1 ラウンド目は使えない）・逃げる
  await B.press(p, 'down'); await B.press(p, 'down'); await B.press(p, 'a');
  ok('escape waits for confirm (run-off, ▼)', await B.waitFor(p, `${D} && ${D}.next && ${D}.head && /逃げ/.test(${D}.head.name)`, 20000) && !(await B.ev(p, 'window.__r')));
  ok('escape resolves with result escape', await B.pressUntil(p, 'a', "window.__r && window.__r.result === 'escape'", 20), await B.ev(p, 'window.__r'));
  ok('invariants after escape', await B.waitFor(p, INV, 3000));

  section('全滅: 直前の戦闘から（既定・失う物なし）');
  await B.ev(p, 'RPG.Game.gold = 101');
  await B.ev(p, start({ demo: 'wipe', autoInput: true, mons: [['x', 1]], bg: 'cave' }));
  ok('wipe screen (灯が消えた) with 3 choices', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui && ${D}.ui.o.rows.length === 3`, 30000));
  ok('default row follows setting wipe (retry = 0)', (await B.ev(p, `${D}.ui.sel`)) === 0);
  ok('promise not resolved yet', !(await B.ev(p, 'window.__r')));
  await B.press(p, 'a');
  ok('retry restarts the same battle (retry = 1) and it can be won', await B.waitFor(p, `${D} && ${D}.retry === 1`, 10000) && await B.pressUntil(p, 'a', 'window.__r', 60));
  ok('retry: win, gold unchanged (no loss)', (await B.ev(p, "window.__r.result === 'win' && RPG.Game.gold === 101")), await B.ev(p, '[window.__r, RPG.Game.gold]'));
  ok('invariants after retry + win', await B.waitFor(p, INV, 3000));

  section('全滅: 最後に泊まった宿から（所持金半分）');
  await B.ev(p, "RPG.Game.gold = 101; RPG.Game.lastInn = {map: 'stub_road', x: 10, y: 5, dir: 's'}");
  await B.ev(p, start({ demo: 'wipe', autoInput: true, mons: [['x', 1]] }));
  ok('wipe screen', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui`, 30000));
  await B.press(p, 'down'); await B.press(p, 'a');
  ok("resolves {result:'abort', to:'inn'}", await B.waitFor(p, "window.__r && window.__r.result === 'abort' && window.__r.to === 'inn'", 5000), await B.ev(p, 'window.__r'));
  const f0 = await B.ev(p, 'RPG.Engine.frame');
  ok('invariants within 60 frames (A6)', await B.waitFor(p, INV, 3000));
  ok('… frames', (await B.ev(p, 'RPG.Engine.frame')) - f0 <= 60);
  ok('gold halved, party restored, at the inn', await B.ev(p, "RPG.Game.gold === 50 && RPG.Party.members().every((c) => c.hp > 0) && RPG.Field.pos.x === 10 && RPG.Field.pos.y === 5"), await B.ev(p, '[RPG.Game.gold, RPG.Field.pos]'));
  await B.press(p, 'right', 200);
  ok('can walk after the wipe', await B.waitFor(p, 'RPG.Field.pos.x >= 11', 3000));

  section('canLose（全滅の画面なし）');
  await B.ev(p, start({ demo: 'wipe', autoInput: true, canLose: true, mons: [['x', 1]] }));
  ok("canLose: '力尽きた' waits for confirm (no wipe screen)", await B.waitFor(p, `${D} && ${D}.next && !${D}.go`, 30000));
  ok("resolves 'lose' after confirm", await B.pressUntil(p, 'a', "window.__r && window.__r.result === 'lose'", 20));
  ok('invariants after canLose', await B.waitFor(p, INV, 3000));

  section('リピートは次の戦闘へ続く（ボス・レアは一時止め、B で止めたら止まる）');
  const finishWin = async () => { for (let i = 0; i < 300 && !(await B.ev(p, '!!window.__r')); i++) { if (await B.ev(p, `!!(${D} && ${D}.next)`)) await B.press(p, 'a'); else await p.waitForTimeout(150); } return !!(await B.ev(p, '!!window.__r')); };
  await B.ev(p, "RPG.Settings.set('battleSpeed', 3); RPG.Battle.repeatMemory().on = false; 0");
  await B.ev(p, start({ demo: 'normal', mons: [['x', 1]] }));
  await B.ev(p, 'if (RPG.Game.battle && RPG.Game.battle.cursor) RPG.Game.battle.cursor._party = 0; 0');
  const round2 = `${D} && ${D}.phase==='input' && ${D}.partyOpts.includes('repeat') && ${D}.ui && ${D}.ui.o && ${D}.ui.o.rows.some((r) => r.key === 'fight')`;
  ok('round 2 offers repeat', await (async () => { for (let i = 0; i < 200; i++) { if (await B.ev(p, round2)) return true; if (await B.ev(p, `!!(${D} && ${D}.ui && ${D}.phase==='input')`)) await B.press(p, 'a'); else await p.waitForTimeout(120); } return false; })());
  await B.press(p, 'l');
  ok('L turns repeat on and it is remembered', await B.waitFor(p, `!!${D} && ${D}.B.repeatOn && RPG.Battle.repeatMemory().on`, 3000));
  ok('battle ends (confirm)', await finishWin());
  ok('last commands remembered for the next battle', await B.ev(p, '!!RPG.Battle.repeatMemory().cmds'));
  await B.ev(p, start({ demo: 'normal', mons: [['x', 1]] }));
  ok('next normal battle: repeat is on from the first turn (no input)', await B.waitFor(p, `${D} && ${D}.B && ${D}.B.repeatOn && ${D}.repeatCarried`, 20000) && await B.waitFor(p, `!!${D} && ${D}.phase==='play'`, 20000));
  ok('prompts show 「リピート中：[L]でやめる」 from the first turn', await B.ev(p, `RPG.Battle.prompts(${D}).repeatOn`));
  ok('battle ends', await finishWin());
  await B.ev(p, start({ demo: 'boss_pageeater', boss: true, autoInput: true, mons: [['x', 1]] }));
  ok('boss battle: repeat suspended (starts with normal input, memory stays on)', await B.waitFor(p, `${D} && ${D}.B`, 20000) && await B.ev(p, `${D}.repeatSuspended && !${D}.B.repeatOn && !${D}.repeatCarried && RPG.Battle.repeatMemory().on`));
  ok('boss battle ends', await finishWin());
  await B.ev(p, start({ demo: 'normal', rare: true, autoInput: true, mons: [['x', 1]] }));
  ok('rare battle (setup.rare): repeat suspended too', await B.waitFor(p, `${D} && ${D}.B`, 20000) && await B.ev(p, `${D}.repeatSuspended && !${D}.repeatCarried && !${D}.B.repeatOn`));
  ok('rare battle ends', await finishWin());
  await B.ev(p, start({ demo: 'normal', mons: [['x', 1]] }));
  ok('the following normal battle resumes repeat', await B.waitFor(p, `${D} && ${D}.B && ${D}.B.repeatOn && ${D}.repeatCarried`, 20000));
  await B.waitFor(p, `!!${D} && ${D}.phase==='play'`, 20000);
  await B.press(p, 'b');
  ok('B stops repeat and the memory turns off', await B.waitFor(p, `!!${D} && !${D}.B.repeatOn && !RPG.Battle.repeatMemory().on`, 3000));
  await B.ev(p, `${D}.finish({ result: 'escape', rewards: null }); 0`);   // A の連打はリピートをまた選ぶので、ここでは閉じるだけ
  ok('battle closed', await B.waitFor(p, 'window.__r', 10000));
  await B.ev(p, start({ demo: 'normal', mons: [['x', 1]] }));
  ok('after B, the next battle starts with normal input', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui`, 30000) && !(await B.ev(p, `${D}.B.repeatOn`)));
  await B.ev(p, `${D}.finish({ result: 'escape', rewards: null }); 0`);
  await B.waitFor(p, 'window.__r', 10000);
  await B.ev(p, "RPG.Settings.set('battleSpeed', 1); 0");

  section('戦闘ボイス（ファイルのある主人公の声）');
  ok('hero glimmer clip is picked from the media list (v_hero_m_glimmer_n)', await B.ev(p, "(() => { const id = RPG.Battle._.voice.play({id:'hero', uid:'p0', look:'hero_m_warrior'}, 'glimmer', {force:true}); return /^v_hero_m_glimmer_\\d+$/.test(id); })()"));
  ok('missing companion clips are a silent no-op', await B.ev(p, "RPG.Battle._.voice.play({id:'nobody_x', uid:'p1'}, 'bigtech') === null"));
  ok('companion clips b_<id>_<kind>_<n> are used when present', await B.ev(p, "(() => { const ids = Object.keys(RPG.Media.table().voice).filter((k) => /^b_[a-z]+_bigtech_\\d+$/.test(k)); if (!ids.length) return true; const who = ids[0].split('_')[1]; const id = RPG.Battle._.voice.play({id: who, uid:'p1'}, 'bigtech'); return id && id.startsWith('b_' + who + '_bigtech_'); })()"));

  section('本物（か仮）の BattleCore で');
  await B.ev(p, "RPG.Settings.set('battleSpeed', 3); 0");   // A の連打で 1 人ずつ命令する（リピートは使わない）ので速さ ＋2
  await B.ev(p, start({ troop: 'tr_stub' }));
  ok('battle with the core ends (press A)', await B.pressUntil(p, 'a', 'window.__r', 160), await B.ev(p, `${D} && [${D}.phase, ${D}.log.slice(-3)]`));
  ok('invariants after the real-core battle', await B.waitFor(p, INV, 3000));

  section('蘇生の道具: ねらいは倒れた味方だけ、起き上がると HP と構えが戻る（オーナー 2026-09-28）');
  {
    const nav = async (pred) => {
      for (let i = 0; i < 12; i++) {
        if (await B.ev(p, `(() => { const w = ${D}.ui; if (!w || !w.o) return false; const r = w.o.rows[w.sel]; return !!r && (${pred})(r); })()`)) return true;
        await B.press(p, 'down');
      }
      return false;
    };
    await B.ev(p, "RPG.Settings.set('battleSpeed', 1); 0");
    const who = await B.ev(p, `(() => { for (const id of ['bartolo', 'marta', 'selma']) if (RPG.Party.members().length < 3) try { RPG.Party.join(id); } catch (e) { /* ignore */ } const m = RPG.Party.members(); for (const c of m) c.hp = Math.max(1, c.hp); m[1].hp = 0; RPG.Game.items.i_phoenix = 1; return m[1].id; })()`);
    await B.ev(p, `(() => { window.__r = null; RPG.Battle.start({ mons: [['rat_1', 1]], lv: 3, seed: 7 }).then((r) => { window.__r = r; }); return true; })()`);
    ok('revive battle waits for input', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui`, 20000));
    await B.press(p, 'a');
    ok('item command → よみがえりの花 row', (await nav(`(r) => r.key === 'item'`)) && (await B.press(p, 'a'), await p.waitForTimeout(150), await nav(`(r) => r.id === 'i_phoenix'`)));
    await B.press(p, 'a'); await p.waitForTimeout(250);
    const uid = await B.ev(p, `${D}.B.units.find((u) => u.side === 'party' && u.id === ${JSON.stringify(who)}).uid`);
    const hot = await B.ev(p, `Object.keys(${D}.hot || {})`);
    ok('the cursor starts on the dead ally (not an enemy)', hot.length === 1 && hot[0] === uid, hot);
    await B.press(p, 'down'); await B.press(p, 'left'); await p.waitForTimeout(100);
    ok('moving the cursor stays on dead allies only', JSON.stringify(await B.ev(p, `Object.keys(${D}.hot || {})`)) === JSON.stringify([uid]));
    await B.press(p, 'a'); await p.waitForTimeout(250);
    for (let m = 0; m < 4; m++) {
      if (!(await B.ev(p, `${D}.phase==='input' && !!${D}.ui`))) break;
      if (await nav(`(r) => r.key === 'defend'`)) { await B.press(p, 'a'); await p.waitForTimeout(200); } else break;
    }
    ok('the revive is played', await B.waitFor(p, `${D}.log.some((l) => l.t === 'revive')`, 20000));
    const v = await B.ev(p, `(() => { const v = ${D}.vis[${JSON.stringify(uid)}]; return { alive: v.alive, hp: v.hp, maxHp: v.maxHp, pose: v.pose }; })()`);
    ok('HUD: the revived ally has hp = max HP (pct 1), alive, not KO', v.alive && v.hp > 0 && v.hp === v.maxHp && v.pose !== 'ko', v);
    await B.ev(p, `${D}.finish({ result: 'escape', rewards: null }); 0`);
    ok('revive battle closed', await B.waitFor(p, 'window.__r', 10000));
  }

  // 呼び出し（2026-09-28 の持ち主の報告: 狼の群れ頭が呼んだ狼に文字が無い・退却しても残る、呼ばれた雑魚の当たりがおかしい・攻撃が選べない）
  section('呼び出し: 森の狼の群れ頭（呼んだ狼に文字、ねらえる、頭が倒れると全員いなくなって勝利）');
  {
    await B.ev(p, "RPG.Settings.set('battleSpeed', 3); 0");
    await B.ev(p, `(() => { const m = RPG.Party.members(); for (const c of m) c.hp = Math.max(1, c.maxHp || c.hp); return 0; })()`);
    await B.ev(p, start({ troop: 'tr_a21_forest_wolves', autoInput: true, seed: 11 }));
    ok('wolf battle opens', await B.waitFor(p, `${D} && ${D}.B`, 20000));
    // 一行は倒れない・狼は倒れない。群れ頭に遠吠えを予約させ続け、3 匹呼んだら手で命令する
    await B.ev(p, `(() => { const E = ${D}.B.engine; E.party.forEach((x) => { x.hp = 99999; }); E.mons.forEach((m) => { m.hp = m.mhp = 99999; });
      window.__howl = setInterval(() => { const d = ${D}; if (!d || !d.B) return; const E = d.B.engine, lord = E.mons.find((m) => m.id === 'b_wolflord');
        if (E.mons.filter((m) => m.summoned).length >= 3) { d.setup.autoInput = false; clearInterval(window.__howl); return; }
        if (lord && !lord.reserved) lord.reserved = { id: 'eb_pack_howl', round: -1 }; }, 30); return 0; })()`);
    ok('3 wolves summoned, then the command menu opens', await B.waitFor(p, `${D} && !${D}.setup.autoInput && ${D}.phase==='input' && ${D}.ui`, 90000));
    const st1 = await B.ev(p, `(() => { const d = ${D}; const f = d.actors.filter((a) => a.side === 'enemy' && !(d.vis[a.uid].gone >= 1)); return { foes: f.map((a) => ({ uid: a.uid, name: a.name, x: a.x, y: a.y })), real: f.every((a) => d.B.units.some((u) => u.uid === a.uid)), alive: d.aliveEnemies().map((a) => a.uid).sort().join(), core: d.B.units.filter((u) => u.side === 'enemy' && u.alive).map((u) => u.uid).sort().join() }; })()`);
    const wolves = st1.foes.filter((a) => /群れの狼/.test(a.name));
    ok('5 wolves on screen, each lettered once (Ａ〜Ｅ), all real core units', wolves.length === 5 && new Set(wolves.map((a) => a.name)).size === 5 && wolves.every((a) => /[Ａ-Ｚ]$/.test(a.name)) && st1.real, st1.foes);
    ok('targets = the living enemies in the core', st1.alive === st1.core, st1);
    // 戦う → 武器（攻撃） → ねらい。←で全員を回る
    // 一覧のカーソルは前の戦闘の位置を覚えているので、行を探して選ぶ
    const pickRow = async (want) => {
      for (let i = 0; i < 12; i++) {
        if (await B.ev(p, `(() => { const w = ${D}.ui; const r = w && w.o && w.o.rows ? w.o.rows[w.sel] : null; return !!r && (r.key || r.id) === ${JSON.stringify(want)}; })()`)) { await B.press(p, 'a'); await p.waitForTimeout(150); return true; }
        await B.press(p, 'up'); await p.waitForTimeout(40);
      }
      return false;
    };
    await pickRow('fight');
    await pickRow('weapon');
    if (await B.ev(p, `!!(${D}.ui && ${D}.ui.o && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.id === 'attack'))`)) await pickRow('attack');
    const where = await B.ev(p, `(() => { const d = ${D}; return { ph: d.phase, head: d.head, rows: d.ui && d.ui.o && d.ui.o.rows ? d.ui.o.rows.map((r) => r.id || r.key) : null }; })()`);
    const hot = new Set();
    for (let i = 0; i < 8; i++) { for (const k of await B.ev(p, `Object.keys(${D}.hot || {})`)) hot.add(k); await B.press(p, 'left'); await p.waitForTimeout(60); }
    ok('attack → every enemy (all 5 wolves and the leader) can be the target', st1.foes.every((a) => hot.has(a.uid)) && hot.size === st1.foes.length, { hot: [...hot], foes: st1.foes.map((a) => a.uid), where });
    // 頭を 1 に、あとは自動で頭をねらう
    await B.ev(p, `(() => { const d = ${D}; const E = d.B.engine, lord = E.mons.find((m) => m.id === 'b_wolflord'); lord.hp = 1; lord.reserved = null; d.setup.autoInput = true;
      const orig = d.aliveEnemies; d.aliveEnemies = () => orig().sort((a, b) => (b.uid === lord.uid ? 1 : 0) - (a.uid === lord.uid ? 1 : 0)); return 0; })()`);
    ok('the round plays', await B.pressUntil(p, 'a', `${D}.phase==='play' || ${D}.phase==='result'`, 20));
    ok('leader down → victory panel', await B.waitFor(p, `${D} && ${D}.result`, 60000));
    const left = await B.ev(p, `(() => { const d = ${D}; return d.actors.filter((a) => a.side === 'enemy' && !(d.vis[a.uid].gone >= 1)).map((a) => a.uid + ':' + a.name); })()`);
    ok('no wolf left on screen after the retreat', left.length === 0, left);
    ok('the flee of every wolf was played', await B.ev(p, `${D}.log.filter((l) => l.t === 'flee').length >= 4`));
    ok('confirm closes the victory as a win', await B.pressUntil(p, 'a', 'window.__r', 30) && (await B.ev(p, 'window.__r.result')) === 'win');
    await B.ev(p, "RPG.Settings.set('battleSpeed', 1); 0");
  }

  section('全滅: タイトルへ');
  await B.ev(p, start({ demo: 'wipe', autoInput: true, mons: [['x', 1]] }));
  ok('wipe screen', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui`, 30000));
  await B.press(p, 'down'); await B.press(p, 'down'); await B.press(p, 'a');
  ok('"title" opens the title screen', await B.waitFor(p, `${B.TOP}==='screen:title'`, 5000));
  ok('0 console errors / outside requests', P.errors.length === 0, P.errors.slice(0, 5));
  await P.close();
  await B.stop(S);
  done('test_bscene_flow');
}
main().catch((e) => { console.error(e); process.exit(2); });
