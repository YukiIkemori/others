#!/usr/bin/env node
// UIK の node のテスト（V2_PLAN §4.4 の UIK の行）: 契約の名前・トークン・アイコン・折り返し・ふりがな・Layer・List の計算・toast
//   node v2/tools/test_uik.js
// ブラウザで確かめる物（measure のはみ出し・List の入力・Message・uiScale 1.0/1.3）は test_uik_browser.js
'use strict';
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const load = require('./lib/load');

const R = load({ quiet: true });
const U = R.UIK, C = R.Contract;

section('契約（本物だけで、仮の実装に埋めさせない）');
ok('R.Stubs.claim("UIK") を呼んだ', !!(R.Stubs.claimed && R.Stubs.claimed.UIK));
ok('UIK は仮の実装で埋まっていない', !R.Stubs.installed.UIK && !R.Stubs.installed['UIK.Message'], R.Stubs.installed);
const RS = load({ quiet: true, stubs: false });
ok('checkApi UIK（本物だけ）', C.checkApi('UIK', RS.UIK).ok, C.checkApi('UIK', RS.UIK).errors);
ok('checkApi UIK.Message（本物だけ）', C.checkApi('UIK.Message', RS.UIK.Message).ok, C.checkApi('UIK.Message', RS.UIK.Message).errors);
ok('K.uikTokens', C.check('uikTokens', U.T).ok, C.check('uikTokens', U.T).errors);
ok('new List → K.list', C.check('list', new U.List({ rows: [] })).ok);
ok('new Layer → K.layer', C.check('layer', new U.Layer({})).ok, C.check('layer', new U.Layer({})).errors);

section('トークン（MODERN_UI §3）');
ok('色の値は MODERN_UI §3.2', U.T.color.text === '#f6f0e3' && U.T.color.gold === '#ecc97c' && U.T.color.teal === '#8fd6d8' && U.T.color.rare === '#86c8ff' && U.T.color.superRare === '#ffb65e');
ok('動きの値は §3.6', U.T.ms.cursor === 80 && U.T.ms.focus === 120 && U.T.ms.open === 180 && U.T.ms.close === 140 && U.T.ms.screen === 260 && U.T.ms.toast === 2400);
ok('会話の窓は §6.3（幅 760・高さ 150・顔 118・3 行）', U.T.talk.w === 760 && U.T.talk.h === 150 && U.T.talk.face === 118 && U.T.talk.lines === 3);
ok('自動送り 1 字 60 ms ＋ 1.2 秒、ログ 100 行（§5.4）', U.T.auto.perChar === 60 && U.T.auto.base === 1200 && U.T.log === 100);
R.uiScale = 1.3; ok('u(10) = 13 at uiScale 1.3', Math.abs(U.u(10) - 13) < 1e-9); R.uiScale = 1;

section('アイコン（R.Contract.ICONS のすべて）');
const missing = C.ICONS.filter((n) => !U.hasIcon(n));
ok(`ICONS ${C.ICONS.length} 個すべてに絵がある`, missing.length === 0, missing);

section('文字（node では measure = 字数 × 大きさ）');
const o = { size: 10 };
ok('fit: 入る文字はそのまま', U.fit('あいう', 30, o) === 'あいう');
const f = U.fit('あいうえおかきくけこ', 55, o);
ok('fit: 入らなければ … で w 以内', f.endsWith('…') && U.measure(f, o) <= 55, f);
const fs = U.fitSize('あいうえおかきくけこ', 90, o);
ok('fitSize: 0.85 倍までは縮めて入れる', fs.s === 'あいうえおかきくけこ' && fs.size < 10 && fs.size >= 8.5 && U.measure(fs.s, { size: fs.size }) <= 90, fs);
const fs2 = U.fitSize('あいうえおかきくけこ', 50, o);
ok('fitSize: それでも入らなければ …', fs2.s.endsWith('…') && U.measure(fs2.s, { size: fs2.size }) <= 50, fs2);
const w = U.wrap('灯台の灯が消えてから、夜の海はずっと荒れたまま。', 100, o);
ok('wrap: 各行が幅以内（行末の句読点のぶら下げ 1 字は可）', w.every((l) => U.measure(l.replace(/[、。」』）]$/, ''), o) <= 100) && w.join('') === '灯台の灯が消えてから、夜の海はずっと荒れたまま。', w);
ok('wrap: 句読点を行頭に置かない', w.every((l) => !/^[、。」]/.test(l)), w);
ok('wrap: \\n で改行', U.wrap('あ\nい', 100, o).length === 2);
ok('wrap: 英字の語を切らない', U.wrap('ab LUMINOUS', 60, o).every((l) => !/^[A-Z]{1,7}$/.test(l) || l === 'LUMINOUS' || l.length > 0) && U.wrap('ab LUMINOUS', 90, o).indexOf('LUMINOUS') >= 0, U.wrap('ab LUMINOUS', 90, o));
ok('ふりがな {漢字|かんじ} → 本文は漢字だけ', U.Message.plain('{灯台|とうだい}の火') === '灯台の火');
ok('num: 1284 → 1,284', U.num(1284) === '1,284' && U.num(999) === '999');

section('List（計算）');
const L = new U.List({ rows: Array.from({ length: 20 }, (_, i) => ({ label: 'row' + i })), rowH: 34 });
L.rect = { x: 0, y: 0, w: 300, h: 170 };
ok('visible = floor(170 / 34) = 5', L.visible === 5);
L.focusIndex(12);
ok('focusIndex(12) → top が 8〜12', L.top >= 8 && L.top <= 12, L.top);
ok('rowRect(12) が見えている', !!L.rowRect(12) && L.rowRect(12).h === 34);
ok('hitIndex(行 12 の中) = 12', L.hitIndex(10, L.rowRect(12).y + 5) === 12);
ok('hitIndex(外) = -1', L.hitIndex(400, 10) === -1);
const G = new U.List({ rows: Array.from({ length: 10 }, (_, i) => ({ label: 'g' + i })), rowH: 34, cols: 3 });
G.rect = { x: 0, y: 0, w: 300, h: 340 };
ok('cols 3: 段の数 = 4', G.lines === 4);
ok('cols 3: 行 4 は 2 段目・2 列目', G.rowRect(4).y === 34 && Math.round(G.rowRect(4).x) === 100);
R.uiScale = 1.3; ok('uiScale 1.3: 行の高さ 34 × 1.3', Math.abs(L.rowPx() - 44.2) < 1e-6 && L.visible === 3); R.uiScale = 1;

section('Layer（Engine.time で進む）');
(async () => {
  const lay = new U.Layer({});
  let opened = false;
  const p = lay.open().then(() => { opened = true; });
  for (let i = 0; i < 16 && !opened; i++) { R.Engine.advance(16.67); await new Promise((r) => setImmediate(r)); }
  await p;
  await new Promise((r) => setImmediate(r));
  ok('open(): k が 1 になり Promise が解決（180 ms）', lay.k === 1 && opened && lay.isOpen, { k: lay.k, opened });
  let closed = false;
  const q = lay.close().then(() => { closed = true; });
  for (let i = 0; i < 12 && !closed; i++) { R.Engine.advance(16.67); await new Promise((r) => setImmediate(r)); }
  await q;
  ok('close(): k が 0（140 ms）', lay.k === 0 && closed && !lay.isOpen);

  section('toast');
  U.clearToasts();
  U.toast('オートセーブ', { icon: 'save' });
  U.toast('薬草 を 手に入れた', { anchor: 'tr', icon: 'chest' });
  for (let i = 0; i < 6; i++) U.toast('x' + i, { anchor: 'tr' });
  const ts = U.toasts();
  ok('anchor 既定は bl、tr は入手', ts[0].anchor === 'bl' && ts.some((t) => t.anchor === 'tr'));
  ok('同じ角は 4 つまで', ts.filter((t) => t.anchor === 'tr').length === 4 && ts.filter((t) => t.anchor === 'bl').length === 1);
  U.clearToasts();

  section('設定の読み');
  ok('promptsOn: 既定 first2h で最初は出す', U.promptsOn() === true);
  R.Settings.set('prompts', 'never'); ok('promptsOn: never', U.promptsOn() === false); R.Settings.set('prompts', 'first2h');
  done('test_uik');
})();
void path;
