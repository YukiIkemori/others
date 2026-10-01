#!/usr/bin/env node
// テスター意見 2026-09-30 の戦闘・店・酒場の直し（ブラウザ）。tester_2026-09-30.md の番号:
//   1-5・1-6 全滅して「直前の戦闘からやり直す」でも、その戦闘で閃いた技と読んだ初めての説明（flags.tip_*）は残る
//   1-7  同じラウンドで先の仲間が選んだ道具は、後の仲間の一覧で数が減る（無くなれば出ない）。戻って選び直すと戻る
//   1-13 一行の命令の説明「動いている間は Q か X でやめる」（今の割り当てのボタンの字）
//   2-1  防御はカーソルを覚えない（次のラウンドは先頭）
//   2-3  灰色の「逃げる」に合わせると、わけ（ボス戦では逃げられない）が説明の行に出る
//   1-10 技の一覧の窓は、NEW の付いた名前が切れない幅
//   1-9  まとめ買いの「今すぐ装備する？」はアクセサリ 2 にも付き、もう付けられない人は選べない
//   2-5  店はタブを覚えない（道具屋は毎回「道具」）
//   1-11 最初の仲間選び（候補 20 人 = 7 段）が 1 枚に入る
//   node v2/tools/test_fb_battle_browser.js [--build]
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const D = 'RPG.Battle.debug()';
const start = (setup) => `(() => { window.__r = null; RPG.Battle.start(${JSON.stringify(setup)}).then((r) => { window.__r = r; }); return true; })()`;
const head = `((${D}.head && ${D}.head.sub) || '')`;

async function main() {
  if (process.argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const S = await B.start();
  const P = await B.open(S, 'dev.html?fixture=core_stub_road');
  const p = P.page;
  ok('fixture opens the field', await B.waitFor(p, `${B.TOP}==='field'`, 4000));

  section('1-5・1-6: やり直しで閃きと説明の既読が残る');
  await B.ev(p, "RPG.Settings.set('battleSpeed', 3); RPG.Game.flags = RPG.Game.flags || {}; delete RPG.Game.flags.tip_speed; 0");
  const before = await B.ev(p, 'RPG.Game.chars.hero.techs.slice()');
  await B.ev(p, start({ mons: [['stub_slime', 2]], autoInput: true, glimmerForce: 'hero', bg: 'cave' }));
  ok('battle on top', await B.waitFor(p, `${B.TOP}==='battle'`, 10000));
  await B.ev(p, 'RPG.Game.flags.tip_speed = true; 0');   // 戦闘の中で初めての説明を読んだ（R.Screens.tip が書く印）
  ok('the hero glimmers in battle', await B.waitFor(p, `${D} && ${D}.B && ${D}.B.engine.glimmers.length > 0`, 60000));
  await B.ev(p, `${D}.B.engine.result = 'lose'; 0`);   // その戦闘で全滅した
  ok('party wiped (wipe screen with 3 choices)', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui && ${D}.ui.o.rows.length === 3`, 30000));
  const learned = await B.ev(p, `RPG.Game.chars.hero.techs.filter((t) => !${JSON.stringify(before)}.includes(t))`);
  ok('the hero glimmered a technique in the lost battle', learned.length > 0, learned);
  await B.press(p, 'a');   // 直前の戦闘から
  ok('retry restarts the battle', await B.waitFor(p, `${D} && ${D}.retry === 1 && ${D}.B`, 10000));
  ok('glimmered technique kept after retry (1-5)', await B.ev(p, `${JSON.stringify(learned)}.every((t) => RPG.Game.chars.hero.techs.includes(t))`), await B.ev(p, 'RPG.Game.chars.hero.techs'));
  ok('… and the retried battle has it', await B.ev(p, `(() => { const u = ${D}.B.units.find((x) => x.side === 'party' && String(x.id) === 'hero'); const o = ${D}.B.options(u.uid); const sk = o.find((x) => x.cmd === 'skill'); return !!sk && ${JSON.stringify(learned)}.every((t) => sk.list.some((r) => r.id === t)); })()`));
  ok('tutorial-seen flag kept after retry (1-6)', await B.ev(p, 'RPG.Game.flags.tip_speed === true'));
  await B.waitFor(p, `${D}.phase === 'input' || ${D}.phase === 'play'`, 20000);
  await B.ev(p, `${D}.B.engine.result = 'lose'; 0`);
  ok('wipes again', await B.waitFor(p, `${D} && ${D}.go && ${D}.ui && ${D}.ui.o.rows.length === 3`, 30000));
  await B.press(p, 'down'); await B.press(p, 'a');   // 宿から
  ok('leaves the battle', await B.waitFor(p, 'window.__r', 8000));
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 5000);
  await B.ev(p, "RPG.Settings.set('battleSpeed', 1); RPG.Party.members().forEach((c) => { c.hp = c.maxHp || c.hp; }); 0");

  section('2-3・1-13・1-7・2-1: 命令の窓');
  await B.ev(p, "RPG.Game.items.i_firepot = 3; RPG.Party.members().forEach((c) => { c.hp = 999; }); 0");
  await B.ev(p, start({ mons: [['b_pageeater', 1]], bg: 'cave' }));
  ok('party menu opens', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.key === 'escape')`, 20000));
  const rows = await B.ev(p, `${D}.ui.o.rows.map((r) => r.key + (r.disabled ? '-' : ''))`);
  ok('escape is greyed in a boss battle', rows.includes('escape-'), rows);
  await B.ev(p, `${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'escape'); 0`);
  await p.waitForTimeout(120);
  ok('greyed escape focused: the help line gives the reason (2-3)', await B.ev(p, `${head} === RPG.T('battle.command.partyMenu.escapeWhy.boss')`), await B.ev(p, head));
  await B.ev(p, `${D}.ui.sel = 0; 0`);
  await p.waitForTimeout(120);
  ok('back on 戦う: the normal help line', !(await B.ev(p, `${head} === RPG.T('battle.command.partyMenu.escapeWhy.boss')`)), await B.ev(p, `[${head}, ${D}.ui.sel]`));
  await B.press(p, 'a');   // 戦う
  const pickItem = async () => {
    await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.key === 'item')`, 4000);
    await B.ev(p, `${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'item'); 0`);
    await p.waitForTimeout(60);
    await B.press(p, 'a');
    await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.cmd === 'item')`, 4000);
    return B.ev(p, `${D}.ui.o.rows.map((r) => r.id + ' ' + r.right)`);
  };
  const r1 = await pickItem();
  ok('member 1 sees 3 fire pots', r1.includes('i_firepot ×3'), r1);
  await B.press(p, 'a'); await p.waitForTimeout(80); await B.press(p, 'a');   // 火炎つぼ → ねらい
  const r2 = await pickItem();
  ok('member 2 sees 2 left (1-7)', r2.includes('i_firepot ×2'), r2);
  await B.press(p, 'b'); await p.waitForTimeout(60); await B.press(p, 'b'); await p.waitForTimeout(60);   // 道具の一覧 → 命令 → 1 人目に戻る
  ok('back to member 1', await B.waitFor(p, `${D}.head && ${D}.head.name === RPG.T('battle.command.member.head.name', { name: RPG.Party.members()[0].name })`, 3000), await B.ev(p, `${D}.head`));
  const r1b = await pickItem();
  ok('choosing again: member 1 sees 3 again (own command cancelled)', r1b.includes('i_firepot ×3'), r1b);
  await B.press(p, 'a'); await p.waitForTimeout(80); await B.press(p, 'a');
  await pickItem(); await B.press(p, 'a'); await p.waitForTimeout(80); await B.press(p, 'a');   // 2 人目も火炎つぼ
  const r3 = await pickItem();
  ok('member 3 sees 1 left (two queued)', r3.includes('i_firepot ×1'), r3);
  await B.press(p, 'b'); await p.waitForTimeout(60);
  // 3 人目は防御
  await B.ev(p, `${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'defend'); 0`);
  await p.waitForTimeout(60);
  await B.press(p, 'a');
  // 4 人目は攻撃
  await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.key === 'weapon')`, 3000);
  await B.ev(p, `${D}.ui.sel = 0; 0`); await p.waitForTimeout(60);
  await B.press(p, 'a'); await p.waitForTimeout(60); await B.press(p, 'a'); await p.waitForTimeout(60); await B.press(p, 'a');
  ok('round 1 plays', await B.waitFor(p, `${D}.phase==='play'`, 5000));
  const m3 = await B.ev(p, `RPG.Battle._.cmd.mem(${D}.partyUnits()[2].uid, ${D})`);
  ok('defend is not remembered: member 3 starts on the first command next round (2-1)', !m3.top, m3);
  ok('round 2 party menu', await B.waitFor(p, `${D}.phase==='input' && ${D}.ui && ${D}.partyOpts.includes('repeat')`, 20000));
  const sub = await B.ev(p, head);
  const glyph = await B.ev(p, "[RPG.Input.prompt('l').label, RPG.Input.prompt('b').label]");
  ok('repeat help names the bound keys (1-13)', sub.includes(glyph[0]) && sub.includes(glyph[1]) && !/ B /.test(sub), { sub, glyph });
  ok('bag: two fire pots used', await B.ev(p, `${D}.B.engine.count('i_firepot') === 1`), await B.ev(p, `${D}.B.engine.count('i_firepot')`));
  await B.ev(p, `${D}.B.engine.result = 'win'; 0`);
  await B.press(p, 'a'); await B.press(p, 'a');
  await B.pressUntil(p, 'a', 'window.__r', 60);
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 5000);

  section('1-10: 技の一覧の幅');
  const w = await B.ev(p, `(() => { const C = RPG.Battle._.cmd; return [C.subListWidth([{ label: '武器落とし', isNew: true, right: 'M 3' }], 'アルン › 剣'), C.subListWidth([{ label: '攻撃' }], 'x')]; })()`);
  const need = await B.ev(p, "RPG.Battle._.K.measure('武器落とし', { size: 14 * (RPG.uiScale || 1), weight: 700 }) / (RPG.uiScale || 1)");
  ok('a NEW technique row is wide enough for its whole name', w[0] - 36 - 40 - 52 >= need, { w, need });
  ok('short lists keep the old width', w[1] === 172, w);

  section('1-8: 祈りの杖の説明');
  const pd = await B.ev(p, "[RPG.DB.items.w_staff_prayer_0.desc, RPG.DB.items.w_staff_prayer_0.mag, RPG.DB.items.w_staff_novice.mag]");
  ok('prayer staff (lower magic than the novice staff) no longer claims high magic', pd[1] < pd[2] && !/術力が高/.test(pd[0]) && /術力は控えめ/.test(pd[0]), pd);

  section('1-9・2-5: 店');
  await B.ev(p, "void RPG.Screens.open('shop', { id: 'shop_pharos_items' })");
  ok('item shop opens on the item tab', await B.waitFor(p, "(RPG.Engine.top().view || {}).tabKey && RPG.Engine.top().view.tabKey() === 'item'", 3000));
  await B.press(p, 'l'); await p.waitForTimeout(150);
  ok('switched to the armor tab', await B.ev(p, "RPG.Engine.top().view.tabKey() === 'armor'"));
  const log = await B.ev(p, `(async () => {
    const v = RPG.Engine.top().view, out = [];
    RPG.Game.gold = 99999;
    for (const c of RPG.Screens.party()) { c.equip.acc1 = null; c.equip.acc2 = null; }
    const ask0 = RPG.Screens.ask;
    RPG.Screens.ask = async (view, o) => { out.push({ title: o.title, index: o.index, dis: o.choices.map((c) => !!c.disabled) }); return o.index; };
    try { await v.doBuy('ac_ward_sleep', 9); } finally { RPG.Screens.ask = ask0; }
    return { out, eq: RPG.Screens.party().map((c) => [c.equip.acc1, c.equip.acc2]), bag: RPG.Game.items.ac_ward_sleep || 0 };
  })()`);
  const n = log.eq.length;
  ok('pressing A through the offers fills accessory 2 for everyone (1-9)', log.eq.every((e) => e[0] === 'ac_ward_sleep' && e[1] === 'ac_ward_sleep'), log.eq);
  ok('… offers stop when nobody can take one more', log.out.length === n * 2 && log.bag === 9 - n * 2, { asks: log.out.length, bag: log.bag });
  ok('… members already wearing two are not selectable', log.out[log.out.length - 1].dis.filter(Boolean).length === n - 1, log.out[log.out.length - 1]);
  await B.press(p, 'b'); await B.waitFor(p, `${B.TOP}==='field'`, 3000);
  await B.ev(p, "void RPG.Screens.open('shop', { id: 'shop_pharos_items' })");
  ok('reopened shop starts on the item tab again (2-5)', await B.waitFor(p, "(RPG.Engine.top().view || {}).tabKey && RPG.Engine.top().view.tabKey() === 'item'", 3000), await B.ev(p, "RPG.Engine.top().view && RPG.Engine.top().view.tabKey()"));
  await B.press(p, 'b'); await B.waitFor(p, `${B.TOP}==='field'`, 3000);

  section('1-11: 最初の仲間選び（20 人）');
  await B.ev(p, "(() => { const G = RPG.Game; G.party = ['hero']; G.reserve = []; void RPG.Screens.open('partySelect', { count: 3 }); })()");
  ok('party select opens', await B.waitFor(p, `${B.TOP}==='screen:partySelect'`, 3000));
  await p.waitForTimeout(300);
  const L = await B.ev(p, '(() => { const L = RPG.Engine.top().view.list; return { n: L.rows.length, lines: L.lines, vis: L.visible }; })()');
  ok('all lines fit on one screen (no hidden last line)', L.n === 20 && L.vis >= L.lines, L);

  ok('no console errors', P.errors.length === 0, P.errors.slice(0, 5));
  await B.stop(S);
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
