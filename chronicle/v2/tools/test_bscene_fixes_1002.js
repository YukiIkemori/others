#!/usr/bin/env node
// BSCENE（ブラウザ）: テスター 2026-10-01・10-02 の戦闘の直し
//   P3・P26・P33  縦長の PC の窓（800×885 = 4:3 の横持ち、520×800 = 低めの縦持ち）: 敵が画面の中、術の一覧が画面の中に収まる
//   P20  地の文（キャプション）が出ている間は入る移りを待つ
//   P34  沈黙のとき「術」は灰色で入れない（わけは説明の行）
//   P39  縦持ちの横一列の行動の札は ←→ で動く
//   P15  逃げきったとき、倒れた仲間の絵も消える
//   Q11  術の一覧は「すべて」のタブから開き、←→ の案内が出る
//   node v2/tools/test_bscene_fixes_1002.js [--build]
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const D = 'RPG.Battle.debug()';
const start = (setup) => `(() => { window.__r = null; RPG.Battle.start(${JSON.stringify(setup)}).then((r) => { window.__r = r; }); return true; })()`;
// 終盤のヴィオラ（術がたくさん）を先頭に
const LATE = `(() => {
  const G = RPG.Game, S = RPG.DB.spells;
  RPG.DB.config.slice = false; G.tier = 6;
  const v = G.chars.viola;
  v.spells = Object.keys(S).filter((id) => S[id].elements.length === 1 && S[id].step <= 4);
  G.party = ['viola', 'hero', 'selma', 'sylvain'];
  for (const id of G.party) G.chars[id].gl = 60;
  RPG.Party.restoreAll();
  RPG.Settings.set('battleSpeed', 1);
  return v.spells.length;
})()`;
const pickSpell = `(${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'spell'), 1)`;
const win = async (p) => { await B.ev(p, `${D}.B.engine.result = 'win'; 0`); for (let i = 0; i < 4; i++) await B.press(p, 'b'); return B.pressUntil(p, 'a', 'window.__r', 80); };

async function main() {
  if (process.argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const S = await B.start();

  section('800×885（4:3 の横持ち）: 5 匹の敵が画面の中、術の一覧が画面の中、「すべて」と ←→ の案内');
  let P = await B.open(S, 'dev.html?fixture=menus_party', { size: [800, 885] });
  let p = P.page;
  ok('fixture opens the field', await B.waitFor(p, `${B.TOP}==='field'`, 20000));
  await B.ev(p, LATE);
  // P20: キャプションが出ている間は入る移りを始めない
  await B.ev(p, `(() => { RPG.UIK.Message.caption('門へ走った。', { ms: 1200 }); return 1; })()`);
  await B.ev(p, start({ mons: [['stub_slime', 5]], bg: 'snow' }));
  await p.waitForTimeout(500);
  ok('P20: the battle-entry effect waits while a caption is up', await B.ev(p, `!RPG.Battle._.trans.state && RPG.Engine.stack.some((s) => s.id === 'caption')`));
  ok('P20: … and starts after the caption closes', await B.waitFor(p, `!RPG.Engine.stack.some((s) => s.id === 'caption') && (!!RPG.Battle._.trans.state || (${D} && ${D}.phase !== 'intro'))`, 6000));
  ok('party menu', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui`, 30000));
  const lay = await B.ev(p, `(() => { const d = ${D}; return { W: RPG.W, H: RPG.H, foes: d.actors.filter((a) => a.side === 'enemy').map((a) => [a.x, a.y, Math.round(RPG.Battle._.actors.height(a))]) }; })()`);
  ok('P3: all 5 foes (and their name tags) are inside the screen', lay.foes.length === 5 && lay.foes.every(([x, y, h]) => x - 40 >= 0 && x + 40 <= lay.W && y - h >= 0 && y + 20 <= lay.H), lay);
  await B.press(p, 'a');   // 戦う
  await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows.some((r) => r.key === 'spell')`, 4000);
  await B.ev(p, pickSpell); await p.waitForTimeout(60);
  await B.press(p, 'a');
  ok('Q11: spell list opens on すべて', await B.waitFor(p, `${D}.ui && ${D}.ui.tabbed && ${D}.ui.o.tabs.groups[${D}.ui.o.tabs.index].id === 'spell:all'`, 4000));
  for (let i = 0; i < 12; i++) await B.press(p, 'down');
  await p.waitForTimeout(200);
  const lr = await B.ev(p, `(() => { const u = ${D}.ui; const rs = u.rects; const last = rs[rs.length - 1]; return { H: RPG.H, bottom: last.y + last.h, top: rs[0].y, tabs: u.tabRects.length }; })()`);
  ok('P26/P33: the spell list rows stay inside the screen (scrolled)', lr.bottom <= lr.H && lr.top >= 0, lr);
  ok('win closes the battle', await win(p));
  ok('no page errors (800×885)', P.errors.length === 0, P.errors.slice(0, 5));
  await P.close();

  section('520×800（低めの縦持ち）: ←→ の行動の札、沈黙、一覧が下の札の上に収まる、逃げると倒れた仲間も消える');
  P = await B.open(S, 'dev.html?fixture=menus_party', { size: [520, 800] });
  p = P.page;
  ok('fixture opens the field', await B.waitFor(p, `${B.TOP}==='field'`, 20000));
  await B.ev(p, LATE);
  await B.ev(p, start({ mons: [['stub_slime', 5]], bg: 'snow' }));
  ok('command cards (tall)', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui && ${D}.ui.o.rows.some((r) => r.key === 'spell') && ${D}.L.tall`, 30000));
  const tl = await B.ev(p, `(() => { const d = ${D}; return { L: { cardsY: d.L.cardsY, chipsY: d.L.chipsY, k: d.L.k, H: RPG.H }, foes: d.actors.filter((a) => a.side === 'enemy').map((a) => [a.x, a.y]) }; })()`);
  ok('P3: foes stand above the party cards', tl.foes.every(([x, y]) => x > 0 && x < 540 && y < tl.L.cardsY), tl);
  ok('chips row is on the screen, below the commands', tl.L.chipsY + 22 * tl.L.k <= tl.L.H, tl.L);
  const s0 = await B.ev(p, `${D}.ui.sel`);
  await B.press(p, 'right');
  ok('P39: → moves along the horizontal command row', (await B.ev(p, `${D}.ui.sel`)) === (s0 + 1) % (await B.ev(p, `${D}.ui.o.rows.length`)));
  await B.press(p, 'left');
  ok('P39: ← moves back', (await B.ev(p, `${D}.ui.sel`)) === s0);
  await B.ev(p, pickSpell); await p.waitForTimeout(60);
  await B.press(p, 'a');
  ok('spell list (tall)', await B.waitFor(p, `${D}.ui && ${D}.ui.tabbed`, 4000));
  await B.press(p, 'right');
  ok('Q11: → switches the tab inside the list (火)', await B.waitFor(p, `${D}.ui.o.tabs.groups[${D}.ui.o.tabs.index].id === 'spell:fire'`, 1500));
  await B.press(p, 'left');
  for (let i = 0; i < 12; i++) await B.press(p, 'down');
  await p.waitForTimeout(200);
  const tr = await B.ev(p, `(() => { const u = ${D}.ui, rs = u.rects, last = rs[rs.length - 1]; return { bottom: last.y + last.h, chipsY: ${D}.L.chipsY, top: rs[0].y }; })()`);
  ok('P26/P33: the tall spell list ends above the chips row', tr.bottom <= tr.chipsY && tr.top > 0, tr);
  await B.press(p, 'b');   // 一覧を閉じて行動の札へ
  await B.waitFor(p, `${D}.ui && !${D}.ui.tabbed && ${D}.ui.o.rows.some((r) => r.key === 'spell')`, 2000);
  // P34: 沈黙 → 術の札は灰色、決定しても入らない。B の options を読み直させるため、防御で 2 人目へ進めてから戻る
  await B.ev(p, `(() => { const d = ${D}; d.B.engine.party.find((x) => x.c.id === 'viola').status.silence = 3; return 1; })()`);
  await B.ev(p, `${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'defend'); 0`); await p.waitForTimeout(60);
  await B.press(p, 'a');
  await p.waitForTimeout(200);
  await B.press(p, 'b');
  ok('back on viola', await B.waitFor(p, `${D}.ui && ${D}.unit(${D}.activeUid).id === 'viola' && ${D}.ui.o.rows.some((r) => r.key === 'spell')`, 3000));
  const sil = await B.ev(p, `(() => { const u = ${D}.ui; const r = u.o.rows.find((x) => x.key === 'spell'); return { disabled: r.disabled, why: r.why, desc: u.o.desc(u.o.rows.indexOf(r)).text }; })()`);
  ok('P34: silenced → 術 is greyed with the reason', sil.disabled && sil.why && sil.desc === sil.why, sil);
  await B.ev(p, pickSpell); await p.waitForTimeout(60);
  await B.press(p, 'a');
  await p.waitForTimeout(250);
  ok('P34: confirming 術 does not enter a list', await B.ev(p, `!!${D}.ui && !${D}.ui.tabbed && ${D}.ui.o.rows.some((r) => r.key === 'spell')`));
  // P15: 逃げきった後、倒れた仲間の絵も消える
  await B.ev(p, `(() => { const d = ${D}; const u = d.partyUnits().find((x) => x.id === 'selma'); d.vis[u.uid].alive = false; d.vis[u.uid].pose = 'ko'; d.ui = null; window.__selma = u.uid; RPG.Battle._.result.escape(d); return 1; })()`);
  await p.waitForTimeout(2200);
  const ap = await B.ev(p, `${D}.vis[window.__selma].appear`);
  ok('P15: the fallen ally fades out with the escape', ap < 0.05, ap);
  ok('no page errors (520×800)', P.errors.length === 0, P.errors.slice(0, 5));
  await P.close();
  await B.stop(S);
  done('test_bscene_fixes_1002');
}
main().catch((e) => { console.error(e); process.exit(2); });
