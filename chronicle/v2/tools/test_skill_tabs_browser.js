#!/usr/bin/env node
// 技・術の一覧の種類のタブと MP の並び（持ち主 2026-10-01「剣なら剣、火なら火で分けて左右か LR で切り替え。MP の少ない順に」）。ブラウザ
//   - R.SkillTabs: 技は武器の系統、術は属性（2・3 属性は「合成」）に分ける。持っている種類だけ。中は MP の少ない順 → 覚えた順 → id
//   - メニューの技・術: ←→ と札のクリックでタブ、L/R は人の切り替えのまま。タブは人ごとに覚える（閉じて開いても）
//   - 戦闘の術: ←→・札のクリックでタブ。L/R はタブに使わず、一覧の中でもリピート・速さのまま（持ち主 2026-10-01）。
//     戻って開き直しても、次の戦闘でも覚えている
//   - 戦闘の技（今の武器の系統だけ）: タブなし、「攻撃」の後は MP の少ない順
//   node v2/tools/test_skill_tabs_browser.js [--build] [--shots <dir>]
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const D = 'RPG.Battle.debug()';
const V = '(RPG.Engine.top() || {}).view';
const argShots = process.argv.indexOf('--shots');
const SHOTS = argShots > 0 ? process.argv[argShots + 1] : null;

// 終盤の 2 人: アルン（剣・短剣・大剣・弓の技をたくさん。覚えた順は MP 順でない）とヴィオラ（6 属性と合成の術をたくさん）
const LATE = `(() => {
  const G = RPG.Game, T = RPG.DB.techs, S = RPG.DB.spells;
  RPG.DB.config.slice = false; G.tier = 6;
  const techs = (w, n) => Object.keys(T).filter((id) => T[id].wtype === w && !T[id].derived).slice(0, n);
  const hero = G.chars.hero;
  hero.techs = techs('sword', 7).reverse().concat(techs('dagger', 4).reverse(), techs('greatsword', 3), techs('bow', 3).reverse());
  const v = G.chars.viola;
  const singles = Object.keys(S).filter((id) => S[id].elements.length === 1 && S[id].step <= 4);
  const combos = Object.keys(S).filter((id) => S[id].elements.length === 2).slice(0, 5).concat(Object.keys(S).filter((id) => S[id].elements.length === 3).slice(0, 3));
  v.spells = singles.reverse().concat(combos.reverse());
  G.party = ['viola', 'hero', 'selma', 'sylvain'];
  for (const id of G.party) { const c = G.chars[id]; c.gl = 60; }
  RPG.Party.restoreAll();
  v.mp = 12;   // 高い術は MP が足りない（灰色が残ることも見る）
  return [hero.techs.length, v.spells.length];
})()`;

async function main() {
  if (process.argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const S = await B.start();
  const P = await B.open(S, 'dev.html?fixture=menus_party');
  const p = P.page;
  ok('fixture opens the field', await B.waitFor(p, `${B.TOP}==='field'`, 20000));
  const n = await B.ev(p, LATE);
  ok('late-game party set up (many techniques and spells)', n[0] >= 15 && n[1] >= 25, n);
  const shot = async (name) => { if (SHOTS) await B.shot(p, path.join(SHOTS, name)); };
  // 論理座標（R.W × R.H）をクリック
  const click = async (r) => {
    const xy = await B.ev(p, `(() => { const c = document.querySelector('canvas'); const b = c.getBoundingClientRect(); const r = ${JSON.stringify(r)}; return [b.left + (r.x + r.w / 2) / RPG.W * b.width, b.top + (r.y + r.h / 2) / RPG.H * b.height]; })()`);
    await p.mouse.move(xy[0], xy[1]); await p.waitForTimeout(50);
    await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up(); await p.waitForTimeout(120);
  };

  section('R.SkillTabs: 分け方と MP の並び');
  const g = await B.ev(p, `(() => {
    const ST = RPG.SkillTabs, c = RPG.Game.chars.viola, h = RPG.Game.chars.hero;
    const sp = ST.group(c, c.spells.map((id) => ({ id, kind: 'spell' })));
    const te = ST.group(h, h.techs.map((id) => ({ id, kind: 'tech' })));
    const mp = (cc, id) => RPG.Rules.mpCost(cc, id);
    return {
      sp: sp.map((gr) => gr.id), te: te.map((gr) => gr.id), spLabels: sp.map((gr) => gr.label), teLabels: te.map((gr) => gr.label),
      spSorted: sp.every((gr) => gr.items.every((it, i) => !i || mp(c, gr.items[i - 1].id) <= mp(c, it.id))),
      teSorted: te.every((gr) => gr.items.every((it, i) => !i || mp(h, gr.items[i - 1].id) <= mp(h, it.id))),
      spCount: sp.reduce((s, gr) => s + gr.items.length, 0), teCount: te.reduce((s, gr) => s + gr.items.length, 0),
      combo: (sp.find((gr) => gr.key === 'combo') || { items: [] }).items.every((it) => RPG.DB.spells[it.id].elements.length > 1),
      single: sp.filter((gr) => gr.key !== 'combo').every((gr) => gr.items.every((it) => RPG.DB.spells[it.id].elements[0] === gr.key && RPG.DB.spells[it.id].elements.length === 1)),
      tie: ST.sortIds({ spells: ['s_b', 's_a', 's_c'] }, ['s_a', 's_b', 's_c', 's_z', 's_y'], () => 5),
      tie2: ST.sortIds({ spells: ['x', 'y'] }, ['y', 'x', 'w'], (id) => ({ x: 3, y: 1, w: 1 })[id]),
      one: ST.group(RPG.Game.chars.selma, RPG.Game.chars.selma.techs.map((id) => ({ id, kind: 'tech' }))).length,
    };
  })()`);
  ok('spells grouped by element in the official order, then 合成', JSON.stringify(g.sp) === JSON.stringify(['spell:fire', 'spell:water', 'spell:wind', 'spell:earth', 'spell:light', 'spell:dark', 'spell:combo']), g.sp);
  ok('spell tab names: element names and 合成', g.spLabels.join(',') === '火,水,風,土,光,闇,合成', g.spLabels);
  ok('techniques grouped by weapon type (only the types known, in weapon order)', JSON.stringify(g.te) === JSON.stringify(['tech:sword', 'tech:greatsword', 'tech:dagger', 'tech:bow']), g.te);
  ok('tech tab names are the weapon type names', g.teLabels.join(',') === '剣,大剣,短剣,弓', g.teLabels);
  ok('nothing lost or duplicated', g.spCount === n[1] && g.teCount === n[0], [g.spCount, g.teCount]);
  ok('single-element spells under their element, 2-3 element spells under 合成', g.single && g.combo);
  ok('within each tab: MP ascending (spells)', g.spSorted);
  ok('within each tab: MP ascending (techniques)', g.teSorted);
  ok('MP ties: learn order, then id (stable)', JSON.stringify(g.tie) === JSON.stringify(['s_b', 's_a', 's_c', 's_y', 's_z']), g.tie);
  ok('lower MP first even if learned later', JSON.stringify(g.tie2) === JSON.stringify(['y', 'w', 'x']), g.tie2);
  ok('a character with one category gets one group (no tab bar)', g.one === 1, g.one);

  section('メニューの技・術: ←→ でタブ、L/R で人、クリック、覚える');
  await B.ev(p, "void RPG.Screens.open('skills', { id: 'hero' })");
  ok('skills screen opens for アルン', await B.waitFor(p, `${V} && ${V}.groups && ${V}.char().id === 'hero'`, 4000));
  const f0 = await B.ev(p, `(() => { const v = ${V}; return { ids: v.groups.map((gr) => gr.id), tab: v.tab, rows: v.list.rows.map((r) => r.value) }; })()`);
  ok('field: hero tabs = 4 weapon types (no spells known)', f0.ids.length === 4, f0.ids);
  ok('field: starts on the equipped weapon type (剣)', f0.ids[f0.tab] === 'tech:sword', f0);
  const curRows = `${V}.list.rows.map((r) => r.value)`;
  const allInTab = await B.ev(p, `${V}.list.rows.every((r) => r.a.wtype === 'sword') && ${V}.list.rows.every((r, i, a) => !i || RPG.Rules.mpCost(${V}.char(), a[i - 1].value) <= RPG.Rules.mpCost(${V}.char(), r.value))`);
  ok('field: 剣 tab lists sword techniques, MP ascending', allInTab, await B.ev(p, curRows));
  await shot('field_hero_sword.png');
  await B.press(p, 'right');
  ok('field: → goes to the next tab (大剣)', await B.ev(p, `${V}.groups[${V}.tab].id === 'tech:greatsword' && ${V}.list.rows.every((r) => r.a.wtype === 'greatsword')`), await B.ev(p, `${V}.tab`));
  await B.press(p, 'left'); await B.press(p, 'left');
  ok('field: ← wraps to the last tab (弓)', await B.ev(p, `${V}.groups[${V}.tab].id === 'tech:bow'`), await B.ev(p, `${V}.tab`));
  const tr = await B.ev(p, `${V}.tabRects.find((r) => r.i === 2)`);
  await click(tr);
  ok('field: clicking a tab switches to it (短剣)', await B.ev(p, `${V}.groups[${V}.tab].id === 'tech:dagger'`), await B.ev(p, `${V}.tab`));
  await shot('field_hero_dagger.png');
  await B.press(p, 'r');
  ok('field: R still switches the character', await B.ev(p, `${V}.char().id !== 'hero'`), await B.ev(p, `${V}.char().id`));
  await B.ev(p, `(() => { const v = ${V}; v.ci = RPG.Screens.party().findIndex((c) => c.id === 'viola'); v.refresh(false); })()`);
  const vf = await B.ev(p, `(() => { const v = ${V}; return { ids: v.groups.map((gr) => gr.id), tab: v.tab }; })()`);
  ok('field: caster tabs = her weapon type + 6 elements + 合成', vf.ids.length === 8 && vf.ids[0] === 'tech:sword' && vf.ids[7] === 'spell:combo', vf.ids);
  await B.press(p, 'right'); await B.press(p, 'right');
  ok('field: caster on 水', await B.ev(p, `${V}.groups[${V}.tab].id === 'spell:water'`));
  const dim = await B.ev(p, `${V}.list.rows.map((r) => [r.value, RPG.Rules.mpCost(${V}.char(), r.value), r.disabled])`);
  ok('field: water spells MP ascending', dim.every((r, i, a) => !i || a[i - 1][1] <= r[1]), dim);
  await shot('field_viola_water.png');
  await B.ev(p, `(() => { const v = ${V}; v.markSeen(); v.ci = RPG.Screens.party().findIndex((c) => c.id === 'hero'); v.refresh(false); })()`);
  ok('field: back to アルン — his last tab (短剣) is remembered', await B.ev(p, `${V}.groups[${V}.tab].id === 'tech:dagger'`), await B.ev(p, `${V}.tab`));
  await B.press(p, 'b');
  await B.waitFor(p, `${B.TOP} === 'field'`, 3000);
  await B.ev(p, "void RPG.Screens.open('skills', { id: 'viola' })");
  ok('field: reopened for ヴィオラ — on 水 again (remembered for the session)', await B.waitFor(p, `${V} && ${V}.groups && ${V}.char().id === 'viola' && ${V}.groups[${V}.tab].id === 'spell:water'`, 4000), await B.ev(p, `${V} && ${V}.tab`));
  await B.press(p, 'b');
  await B.waitFor(p, `${B.TOP} === 'field'`, 3000);

  section('戦闘の術: ←→・クリックでタブ、L/R はリピート・速さ、覚える');
  await B.ev(p, "RPG.Settings.set('battleSpeed', 1); 0");
  const startBattle = async () => {
    await B.ev(p, `(() => { window.__r = null; RPG.Battle.start({ mons: [['stub_slime', 2]], bg: 'cave' }).then((r) => { window.__r = r; }); return true; })()`);
    ok('party menu', await B.waitFor(p, `${D} && ${D}.phase==='input' && ${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.key === 'escape')`, 20000));
    await B.press(p, 'a');   // 戦う
    await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.key === 'spell')`, 4000);
  };
  const openSpells = async () => {
    await B.ev(p, `${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'spell'); 0`);
    await p.waitForTimeout(60);
    await B.press(p, 'a');
    return B.waitFor(p, `${D}.ui && ${D}.ui.o.tabs && ${D}.ui.tabbed`, 4000);
  };
  const bt = `(${D}.ui && ${D}.ui.o.tabs ? ${D}.ui.o.tabs.groups[${D}.ui.o.tabs.index].id : null)`;
  await startBattle();
  ok('battle: spell list opens with tabs', await openSpells());
  const b0 = await B.ev(p, `(() => { const o = ${D}.ui.o; return { ids: o.tabs.groups.map((gr) => gr.id), rows: o.rows.map((r) => [r.id, r.mp, r.disabled]) }; })()`);
  ok('battle: element tabs + 合成', b0.ids.join(',') === 'spell:fire,spell:water,spell:wind,spell:earth,spell:light,spell:dark,spell:combo', b0.ids);
  ok('battle: first tab is 火 with fire spells, MP ascending', b0.rows.length > 0 && b0.rows.every((r) => /^s_fire_/.test(r[0])) && b0.rows.every((r, i, a) => !i || a[i - 1][1] <= r[1]), b0.rows);
  const speed0 = await B.ev(p, "RPG.Settings.get('battleSpeed')");
  const rep0 = await B.ev(p, `${D}.B.repeatOn`);
  await B.press(p, 'right');
  ok('battle: → next tab (水)', await B.waitFor(p, `${bt} === 'spell:water'`, 1500), await B.ev(p, bt));
  ok('battle: list follows the tab (water spells)', await B.ev(p, `${D}.ui.o.rows.every((r) => RPG.DB.spells[r.id].elements[0] === 'water' && RPG.DB.spells[r.id].elements.length === 1)`));
  // R: 速さ（タブは動かない）
  await B.press(p, 'r');
  ok('battle: R in the spell list cycles speed', await B.waitFor(p, `RPG.Settings.get('battleSpeed') !== ${JSON.stringify(speed0)}`, 1500), await B.ev(p, "RPG.Settings.get('battleSpeed')"));
  ok('battle: R does not switch tabs (still 水, list open)', await B.ev(p, `${bt} === 'spell:water' && !!${D}.ui.tabbed`), await B.ev(p, bt));
  for (let i = 1; i < (await B.ev(p, 'RPG.Battle.SPEEDS.length')); i++) await B.press(p, 'r');   // 一回りで元へ
  ok('battle: speed back to where it was after a full cycle', (await B.ev(p, "RPG.Settings.get('battleSpeed')")) === speed0, await B.ev(p, "RPG.Settings.get('battleSpeed')"));
  // L: リピートの切り替え（タブは動かない）
  await B.press(p, 'l');
  ok('battle: L in the spell list toggles repeat', await B.waitFor(p, `${D}.B.repeatOn !== ${rep0}`, 1500), await B.ev(p, `${D}.B.repeatOn`));
  ok('battle: L does not switch tabs (still 水)', await B.ev(p, `${bt} === 'spell:water' && !!${D}.ui.tabbed`), await B.ev(p, bt));
  await B.press(p, 'l');
  ok('battle: L again toggles repeat back', await B.waitFor(p, `${D}.B.repeatOn === ${rep0}`, 1500), await B.ev(p, `${D}.B.repeatOn`));
  ok('battle: still in the spell list on 水', await B.ev(p, `${bt} === 'spell:water'`), await B.ev(p, bt));
  await B.press(p, 'left'); await B.press(p, 'left');
  ok('battle: ← ← wraps to 合成', await B.waitFor(p, `${bt} === 'spell:combo'`, 1500), await B.ev(p, bt));
  const comboRows = await B.ev(p, `${D}.ui.o.rows.map((r) => [r.id, r.mp, r.disabled])`);
  ok('battle: 合成 tab MP ascending, unaffordable ones still greyed', comboRows.every((r, i, a) => !i || a[i - 1][1] <= r[1]) && comboRows.some((r) => r[2]), comboRows);
  await p.waitForTimeout(3500);   // 速さ・リピートの知らせが消えてから撮る
  await shot('battle_viola_combo.png');
  const btr = await B.ev(p, `${D}.ui.tabRects.find((r) => r.i === 4)`);
  await click(btr);
  ok('battle: clicking a tab switches to it (光)', await B.waitFor(p, `${bt} === 'spell:light'`, 1500), await B.ev(p, bt));
  await B.press(p, 'down');
  await p.waitForTimeout(200);
  await shot('battle_viola_light.png');
  await B.press(p, 'b');
  ok('battle: back to the command menu', await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows.some((r) => r.key === 'spell') && !${D}.ui.tabbed`, 2000));
  ok('battle: prompts show speed (R) outside the tabbed list', await B.ev(p, `RPG.Battle.prompts(${D}).list.some((x) => x.btn === 'r')`));
  await openSpells();
  ok('battle: reopened — still on 光', await B.ev(p, `${bt} === 'spell:light'`), await B.ev(p, `[${bt}, ${D}.ui.sel]`));
  ok('battle: prompts show speed (R) and repeat (L) inside the tabbed list too', await B.ev(p, `(() => { const l = RPG.Battle.prompts(${D}).list; return l.some((x) => x.btn === 'r') && l.some((x) => x.btn === 'l'); })()`));
  await B.press(p, 'b');
  // ヴィオラは防御 → アルンの技（今の武器の系統だけ。タブなし、攻撃の後は MP の少ない順）
  await B.ev(p, `${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'defend'); 0`); await p.waitForTimeout(60);
  await B.press(p, 'a');
  await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.key === 'weapon') && ${D}.activeUid != null && ${D}.unit(${D}.activeUid).id === 'hero'`, 4000);
  await B.ev(p, `${D}.ui.sel = ${D}.ui.o.rows.findIndex((r) => r.key === 'weapon'); 0`); await p.waitForTimeout(60);
  await B.press(p, 'a');
  await B.waitFor(p, `${D}.ui && ${D}.ui.o.rows && ${D}.ui.o.rows.some((r) => r.cmd === 'attack')`, 4000);
  const wr = await B.ev(p, `(() => { const u = ${D}; return { tabs: !!u.ui.tabbed, rows: u.ui.o.rows.map((r) => [r.id, r.cmd === 'attack' ? -1 : Number(String(r.right).replace(/[^0-9]/g, ''))]) }; })()`);
  ok('battle weapon list: no tab bar (one weapon type in battle)', !wr.tabs);
  ok('battle weapon list: 攻撃 first, then techniques MP ascending', wr.rows[0][0] === 'attack' && wr.rows.slice(1).every((r, i, a) => !i || a[i - 1][1] <= r[1]) && wr.rows.length >= 7, wr.rows);
  await p.waitForTimeout(200);
  await shot('battle_hero_sword.png');
  // 戦闘を終えて次の戦闘でも、術のタブは覚えている
  await B.ev(p, `${D}.B.engine.result = 'win'; 0`);
  await B.pressUntil(p, 'a', 'window.__r', 80);
  await B.waitFor(p, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 8000);
  await B.ev(p, 'RPG.Game.chars.viola.mp = 12; 0');
  await startBattle();
  await openSpells();
  ok('next battle: ヴィオラ opens on 光 (remembered tab)', await B.ev(p, `${bt} === 'spell:light'`), await B.ev(p, bt));
  await B.ev(p, `${D}.B.engine.result = 'win'; 0`);
  await B.press(p, 'b');
  await B.pressUntil(p, 'a', 'window.__r', 80);

  ok('no page errors', P.errors.length === 0, P.errors.slice(0, 5));
  await B.stop(S);
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
