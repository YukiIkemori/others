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

  section('全種類の出来事（倍速 ×3 ＋ A の早送り）');
  await B.ev(p, "RPG.Settings.set('battleSpeed', 3)");
  await B.ev(p, start({ demo: 'all', autoInput: true, mons: [['x', 1]] }));
  ok('battle scene on top, opaque', await B.waitFor(p, `${B.TOP}==='battle' && RPG.Engine.top().opaque`, 3000));
  await p.keyboard.down('KeyZ');   // 早送りを押し続ける
  ok('all rounds played to the victory', await B.waitFor(p, `${D} && ${D}.result`, 30000));
  await p.keyboard.up('KeyZ');
  const log = await B.ev(p, `${D}.log`);
  const kinds = await B.ev(p, 'Object.keys(RPG.Contract.BATTLE_EVENTS)');
  const seen = new Set(log.map((l) => l.t));
  ok('every event kind was played', kinds.every((k) => seen.has(k)), kinds.filter((k) => !seen.has(k)));
  const gl = log.find((l) => l.t === 'glimmer-name');
  ok('glimmer name shown ≥ 0.9 s even at ×3 + fast-forward', gl && gl.ms >= 880, gl);
  const card = log.find((l) => l.t === 'card');
  ok('rare card shown ≥ 0.6 s with A held (A12)', card && card.ms >= 590, card);
  ok('victory panel opens', await B.waitFor(p, `${D} && ${D}.result && ${D}.next`, 6000));
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

  section('コマンド・カーソル記憶・NEW・リピート');
  await B.ev(p, start({ demo: 'tele', mons: [['x', 1]], bg: 'tower' }));
  ok('party menu (一行の命令) opens', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui`, 8000));
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
  ok('repeat does not carry to the next battle', await (async () => { await B.ev(p, start({ demo: 'normal', mons: [['x', 1]] })); const r = await B.waitFor(p, `${D} && ${D}.phase==='input'`, 6000); const on = await B.ev(p, `${D}.B.repeatOn`); return r && !on; })());

  section('逃げる');
  // 一行の命令: 戦う・リピート（1 ラウンド目は使えない）・逃げる
  await B.press(p, 'down'); await B.press(p, 'down'); await B.press(p, 'a');
  ok('escape waits for confirm (run-off, ▼)', await B.waitFor(p, `${D} && ${D}.next && ${D}.head && /逃げ/.test(${D}.head.name)`, 8000) && !(await B.ev(p, 'window.__r')));
  ok('escape resolves with result escape', await B.pressUntil(p, 'a', "window.__r && window.__r.result === 'escape'", 20), await B.ev(p, 'window.__r'));
  ok('invariants after escape', await B.waitFor(p, INV, 3000));

  section('全滅: 直前の戦闘から（既定・失う物なし）');
  await B.ev(p, 'RPG.Game.gold = 101');
  await B.ev(p, start({ demo: 'wipe', autoInput: true, mons: [['x', 1]], bg: 'cave' }));
  ok('wipe screen (灯が消えた) with 3 choices', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui && ${D}.ui.o.rows.length === 3`, 15000));
  ok('default row follows setting wipe (retry = 0)', (await B.ev(p, `${D}.ui.sel`)) === 0);
  ok('promise not resolved yet', !(await B.ev(p, 'window.__r')));
  await B.press(p, 'a');
  ok('retry restarts the same battle (retry = 1) and it can be won', await B.waitFor(p, `${D} && ${D}.retry === 1`, 4000) && await B.pressUntil(p, 'a', 'window.__r', 60));
  ok('retry: win, gold unchanged (no loss)', (await B.ev(p, "window.__r.result === 'win' && RPG.Game.gold === 101")), await B.ev(p, '[window.__r, RPG.Game.gold]'));
  ok('invariants after retry + win', await B.waitFor(p, INV, 3000));

  section('全滅: 最後に泊まった宿から（所持金半分）');
  await B.ev(p, "RPG.Game.gold = 101; RPG.Game.lastInn = {map: 'stub_road', x: 10, y: 5, dir: 's'}");
  await B.ev(p, start({ demo: 'wipe', autoInput: true, mons: [['x', 1]] }));
  ok('wipe screen', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui`, 15000));
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
  ok("canLose: '力尽きた' waits for confirm (no wipe screen)", await B.waitFor(p, `${D} && ${D}.next && !${D}.go`, 15000));
  ok("resolves 'lose' after confirm", await B.pressUntil(p, 'a', "window.__r && window.__r.result === 'lose'", 20));
  ok('invariants after canLose', await B.waitFor(p, INV, 3000));

  section('戦闘ボイス（ファイルのある主人公の声）');
  ok('hero glimmer clip is picked from the media list (v_hero_m_glimmer_n)', await B.ev(p, "(() => { const id = RPG.Battle._.voice.play({id:'hero', uid:'p0', look:'hero_m_warrior'}, 'glimmer', {force:true}); return /^v_hero_m_glimmer_\\d+$/.test(id); })()"));
  ok('missing companion clips are a silent no-op', await B.ev(p, "RPG.Battle._.voice.play({id:'nobody_x', uid:'p1'}, 'bigtech') === null"));
  ok('companion clips b_<id>_<kind>_<n> are used when present', await B.ev(p, "(() => { const ids = Object.keys(RPG.Media.table().voice).filter((k) => /^b_[a-z]+_bigtech_\\d+$/.test(k)); if (!ids.length) return true; const who = ids[0].split('_')[1]; const id = RPG.Battle._.voice.play({id: who, uid:'p1'}, 'bigtech'); return id && id.startsWith('b_' + who + '_bigtech_'); })()"));

  section('本物（か仮）の BattleCore で');
  await B.ev(p, start({ troop: 'tr_stub' }));
  ok('battle with the core ends (press A)', await B.pressUntil(p, 'a', 'window.__r', 80), await B.ev(p, `${D} && [${D}.phase, ${D}.log.slice(-3)]`));
  ok('invariants after the real-core battle', await B.waitFor(p, INV, 3000));

  section('全滅: タイトルへ');
  await B.ev(p, start({ demo: 'wipe', autoInput: true, mons: [['x', 1]] }));
  ok('wipe screen', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui`, 15000));
  await B.press(p, 'down'); await B.press(p, 'down'); await B.press(p, 'a');
  ok('"title" opens the title screen', await B.waitFor(p, `${B.TOP}==='screen:title'`, 5000));
  ok('0 console errors / outside requests', P.errors.length === 0, P.errors.slice(0, 5));
  await P.close();
  await B.stop(S);
  done('test_bscene_flow');
}
main().catch((e) => { console.error(e); process.exit(2); });
