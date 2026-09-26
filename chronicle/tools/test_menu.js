#!/usr/bin/env node
// Unit tests of the menu area (A5): DESIGN §0.7 T1–T8 (the Y detail popup, the strongest-first
// equipment list, the bestiary page 1) plus the menu logic that runs without a canvas: field effects,
// repeat-use targets, 満タン, the warp list, the main menu conditions, settings, the save summary,
// shop marks, the chronicle entries, the 技の書 / 術の書 pages and the screen texts.
//   node tools/test_menu.js [-v]          exit 1 on any failure
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const R = require('./lib/load')({ quiet: true, extra: [path.join(__dirname, 'fixtures/menu/menu_fixture.js')] });
const DB = R.DB;
const V = process.argv.includes('-v');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, info) {
  if (cond) { pass++; if (V) console.log('  ok  ' + name); return true; }
  fail++; fails.push(name + (info !== undefined ? '  → ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''));
  return false;
}
function section(t) { if (V) console.log('\n# ' + t); }
const W = (s) => R.Text.approxWidth(s);
const M = R.Menu;

if (R._nodeLoadErrors.length) {
  const mine = R._nodeLoadErrors.filter((e) => /systems\/(menu|shop|gameover)|fixtures\/menu/.test(e));
  ok(!mine.length, 'my files load without errors', mine.map((e) => e.split('\n')[0]));
}

// ------------------------------------------------------------------ a game to work on
function freshGame(o) {
  o = o || {};
  R.State.newGame(o.hero || null);
  const g = R.Game;
  for (const f of ['hero_created', 'prologue_done']) R.State.setFlag(f);
  for (const id of o.companions || ['brigitta', 'marta', 'sylvain']) if (R.Party && R.Party.recruit) R.Party.recruit(id);
  return g;
}
const hero = () => R.State.hero();

// ================================================================== T1–T3: the detail popup
section('T1 detail lines for every item');
{
  freshGame();
  const member = R.Game.party[1];
  let bad = 0, maxW = 0, worst = '', worstLine = '';
  const ids = Object.keys(DB.items);
  for (const id of ids) {
    let lines;
    try { lines = M.detailLines(id, { member }); } catch (e) { bad++; if (bad < 4) ok(false, 'T1 detailLines throws for ' + id, String(e.stack || e).split('\n')[0]); continue; }
    if (!Array.isArray(lines) || lines.length > 12 || lines.length < 1) { bad++; ok(false, 'T1 12 rows or fewer: ' + id, lines && lines.length); continue; }
    for (const l of lines) {
      const w = W((l && l.text) || '') + (l && l.icon ? 12 : 0);
      if (w > maxW) { maxW = w; worst = id; worstLine = l.text; }
    }
  }
  ok(bad === 0, 'T1 every item (' + ids.length + ') gives ≤ 12 rows without an exception', bad);
  ok(maxW <= 341, 'T1 every row ≤ 341px (7px/char floor of the 224px fit): widest ' + Math.round(maxW) + 'px', worst + ' 「' + worstLine + '」');
  ok(ids.length >= 1000, 'T1 ran over the real item registry (' + ids.length + ' items)');
  // the rows follow the §11.7.18 layout
  const sw = ids.find((id) => DB.items[id].type === 'weapon' && DB.items[id].grade === 'super');
  if (sw) {
    const L = M.detailLines(sw, { member });
    ok(L.length === 12, 'T1 gear popup has the 12 rows', L.length);
    ok(/^★/.test(L[0].text) && L[0].right === '超レア★★', 'T1 row 0 = ★name + 超レア★★ (BRIEF A6)', [L[0].text, L[0].right]);
    ok(/(片手持ち|両手持ち)$/.test(L[1].text), 'T1 row 1 = type and hands', L[1].text);
    ok(/^攻撃力 \d+　術力 \d+/.test(L[2].text), 'T1 row 2 = 攻撃力 n　術力 n', L[2].text);
    ok(/^装備：/.test(L[8].text) && L[8].segs[1].text === member.name, 'T1 row 8 = 装備： with the member first', L[8].text);
    ok(/^入手：/.test(L[9].text), 'T1 row 9 = 入手', L[9].text);
  }
  const salve = DB.items.i_salve && M.detailLines('i_salve');
  if (salve) {
    ok(salve[1].text === '戦闘中・移動中に使える' && salve[2].text === '対象：味方1人' && /^持っている数：/.test(salve[3].text), 'T1 consumable rows 1–3', salve.slice(1, 4).map((l) => l.text));
    ok(salve[4].text === 'HPを35%回復', 'T1 consumable effect phrase', salve[4].text);
  }
  // all techs and spells too
  let abad = 0, aw = 0, aworst = '';
  for (const id of Object.keys(DB.actions)) {
    const a = DB.actions[id];
    if (a.kind !== 'tech' && a.kind !== 'spell') continue;
    try {
      const L = M.detailLines(id, { member: hero() });
      // 7 rows; 8 with the member's 「熟練の補正」 row (Part A13) under 威力 for a damage / heal action
      if (L.length !== ((a.effects || []).some((e) => e.type === 'damage' || e.type === 'heal') || R.Rules.profMpKind(hero(), id) ? 8 : 7)) abad++;
      for (const l of L) { const w = W(l.text || ''); if (w > aw) { aw = w; aworst = id + ' 「' + l.text + '」'; } }
    } catch (e) { abad++; }
  }
  ok(abad === 0, 'T1 every tech / spell gives the 7 rows (8 with 熟練の補正)', abad);
  {
    // Part A13 / A13b: the member's proficiency bonus and the MP cut on the Y popup
    const h = hero();
    const keep = JSON.parse(JSON.stringify(h.eprof || {}));
    h.eprof = Object.assign({}, h.eprof, { fire: R.Rules.K.PROF_PTS[5] });
    const L = DB.actions.s_fire_1 && M.detailLines('s_fire_1', { member: h });
    if (L) {
      ok(L.length === 8 && /^熟練の補正 \+15%（火）　熟練でMP0$/.test(L[4].text), 'A13 row 4 = 熟練の補正 +15%（火）　熟練でMP0', L[4].text);
      ok(L[0].right === 'M 0' && L[0].rightColor === R.Gfx.C.cyan, 'A13b MP 0 in cyan on row 0', [L[0].right, L[0].rightColor]);
      ok(L[7].text === String(DB.actions.s_fire_1.desc || '').split('\n')[0], 'A13 the description stays the last row', L[7].text);
    }
    const L0 = DB.actions.s_fire_1 && M.detailLines('s_fire_1', {});
    if (L0) ok(L0.length === 7 && !/熟練/.test(L0.map((l) => l.text).join('')), 'A13 no member → the 7 rows, no bonus row', L0.length);
    h.eprof = keep;
  }
  ok(aw <= 341, 'T1 tech / spell rows ≤ 341px: widest ' + Math.round(aw) + 'px', aworst);
  const pairSpell = Object.keys(DB.actions).find((id) => DB.actions[id].kind === 'spell' && (DB.actions[id].elements || []).length === 2);
  if (pairSpell) {
    const L = M.detailLines(pairSpell, {});
    ok(/^合成術　.+＋.+$/.test(L[1].text), 'T1 pair spell row 1 = 合成術　火＋風', L[1].text);
    ok(L[0].right === 'M ' + DB.actions[pairSpell].mp, 'T1 spell cost on row 0', L[0].right);
  }
  const t9 = Object.keys(DB.actions).find((id) => DB.actions[id].kind === 'tech' && DB.actions[id].glim && DB.actions[id].glim.lv === 9);
  if (t9) ok(/格9（奥義）$/.test(M.detailLines(t9)[1].text), 'T1 格9 → 格9（奥義）', M.detailLines(t9)[1].text);
  const t10 = Object.keys(DB.actions).find((id) => DB.actions[id].kind === 'tech' && DB.actions[id].glim && DB.actions[id].glim.lv === 10);
  if (t10) ok(/格10（極意）$/.test(M.detailLines(t10)[1].text), 'T1 格10 → 格10（極意）', M.detailLines(t10)[1].text);
}

section('T2 every mods key and weapon field has a phrase');
{
  const MODKEYS = ['atk', 'def', 'mdef', 'hit', 'eva', 'crit', 'spd', 'mag', 'strPct', 'vitPct', 'dexPct', 'agiPct', 'intPct', 'mndPct', 'hpPct', 'mpPct', 'wpPct',
    'defPct', 'mdefPct', 'physPct', 'magicPct', 'healPct', 'itemPct', 'takenPct', 'mpCostPct', 'wpCostPct', 'elemBoost', 'elemResist', 'statusImmune', 'statusResist',
    'profPct', 'glimPct', 'expPct', 'goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct', 'preemptPct', 'escapePct', 'stealPct', 'autoSteal',
    'encounterPct', 'regen', 'mpRegen', 'wpRegen', 'startBuffs', 'noSpell', 'hpLoss', 'autoRevive', 'autoCounter', 'walkHeal', 'noFloorDamage'];
  const SAMPLE = {
    elemBoost: { fire: 25 }, elemResist: { water: 0.5, dark: 0, light: -1, earth: 1.5, wind: 0.7 }, statusImmune: ['sleep', 'poison'], statusResist: { paralyze: 0.5 },
    profPct: { sword: 20, fire: 20 }, glimPct: { tech: 10, spell: 10, bow: 15, water: 15 }, startBuffs: { atk: 1, def: -1 }, regen: true, noSpell: true, walkHeal: 2, noFloorDamage: true,
    autoRevive: 0.5, autoCounter: 0.3, hpLoss: 5,
  };
  const missingPhrase = [];
  for (const k of MODKEYS) {
    const it = { type: 'acc', mods: { [k]: SAMPLE[k] !== undefined ? SAMPLE[k] : 10 } };
    const ph = M.modPhrases(it.mods, it);
    if (!ph.length || ph.some((p) => p.unknown)) missingPhrase.push(k);
  }
  ok(!missingPhrase.length, 'T2 all ' + MODKEYS.length + ' §3.3.16 mods keys have a phrase', missingPhrase);
  ok(MODKEYS.every((k) => M.MOD_KEYS.includes(k)) && M.MOD_KEYS.length === MODKEYS.length, 'T2 the popup key order is the §3.3.16 table', M.MOD_KEYS.length);
  const wfields = { element: 'fire', onHit: { status: 'sleep', chance: 0.15 }, vs: { undead: 2, flying: 1.5 }, drain: 0.2, sealTech: true, metalHit: true };
  const wmiss = [];
  for (const k of Object.keys(wfields)) {
    const it = { type: 'weapon', wtype: 'sword', [k]: wfields[k] };
    if (!M.modPhrases({}, it).length) wmiss.push(k);
  }
  ok(!wmiss.length, 'T2 weapon fields element onHit vs drain sealTech metalHit have phrases', wmiss);
  // the phrases of §11.7.18
  const phr = (mods, it) => M.modPhrases(mods, it || { type: 'acc' }).map((p) => p.text);
  ok(phr({ rarePct: 10 })[0] === 'レア率+10%', 'T2 rarePct → レア率+10%', phr({ rarePct: 10 }));
  ok(phr({ intPct: -5 })[0] === '知力-5%', 'T2 intPct → 知力-5%', phr({ intPct: -5 }));
  ok(phr({ statusImmune: ['poison', 'sleep'] })[0] === '毒・眠りが効かない', 'T2 statusImmune → 毒・眠りが効かない', phr({ statusImmune: ['poison', 'sleep'] }));
  ok(phr({ statusResist: { paralyze: 0.5 } })[0] === 'まひにかかりにくい', 'T2 statusResist → まひにかかりにくい');
  ok(phr({ glimPct: { tech: 10 } })[0] === '技の閃き+10%' && phr({ glimPct: { spell: 10 } })[0] === '術の閃き+10%', 'T2 glimPct tech / spell');
  ok(phr({ profPct: { fire: 20 } })[0] === '火の熟練度の伸び+20%', 'T2 profPct', phr({ profPct: { fire: 20 } }));
  ok(phr({ autoSteal: 50 })[0] === '攻撃でついでに盗む50%', 'T2 autoSteal', phr({ autoSteal: 50 }));
  ok(phr({}, { type: 'weapon', wtype: 'sword', onHit: { status: 'sleep', chance: 0.15 } })[0] === '攻撃で眠り15%', 'T2 onHit → 攻撃で眠り15%');
  ok(phr({}, { type: 'weapon', element: 'fire' })[0] === '火の属性', 'T2 element → 火の属性');
  const er = phr({ elemResist: { water: 0.5, dark: 0, light: -1, earth: 1.5 } });
  ok(er.join('/') === '水に強い/闇が効かない/光を吸う/土に弱い', 'T2 elemResist words', er);
  // red for the quirks
  const red = (mods, it) => M.modPhrases(mods, it || { type: 'acc' })[0].color === '#ff5a4a';
  ok(red({ takenPct: 10 }) && !red({ takenPct: -10 }), 'T2 takenPct + is red, − is not');
  ok(red({ mpCostPct: 10 }) && !red({ mpCostPct: -10 }), 'T2 mpCostPct + is red');
  ok(red({ defPct: -10 }) && !red({ defPct: 10 }), 'T2 a negative % is red');
  ok(red({ noSpell: true }) && red({ hpLoss: 5 }), 'T2 noSpell / hpLoss red');
  ok(red({ elemResist: { earth: 1.5 } }), 'T2 elemResist over 1 red');
  ok(red({ encounterPct: 20 }, { type: 'acc', quirk: true }) && !red({ encounterPct: 20 }, { type: 'acc' }), 'T2 encounterPct red only on a quirk item');
  ok(M.modPhrases({}, { type: 'weapon', sealTech: true })[0].color === '#ff5a4a', 'T2 sealTech red');
  // every real item: no unknown key comes out raw
  const raw = [];
  for (const id of Object.keys(DB.items)) {
    const it = DB.items[id];
    if (!it.mods) continue;
    for (const p of M.modPhrases(it.mods, it)) if (p.unknown) raw.push(id + ':' + p.text);
  }
  ok(!raw.length, 'T2 no item has a mods key without a phrase', raw.slice(0, 8));
}

section('T3 the source line of a super rare');
{
  freshGame();
  const supers = Object.keys(DB.items).filter((id) => DB.items[id].src === 'super');
  ok(supers.length >= 150, 'T3 there are super-rare items to check (' + supers.length + ')');
  let badUnseen = 0, badSeen = 0;
  for (const id of supers) {
    const it = DB.items[id];
    const mon = it.exclusive || Object.keys(DB.monsters).find((m) => DB.monsters[m].drops && DB.monsters[m].drops.super && DB.monsters[m].drops.super.item === id);
    if (M.sourceLine(it, id) !== '入手：？？？だけが落とす') badUnseen++;
    if (mon) {
      R.State.seen(mon);
      if (M.sourceLine(it, id) !== '入手：' + DB.monsters[mon].name + 'だけが落とす') badSeen++;
    }
  }
  ok(badUnseen === 0, 'T3 unseen monster → 「入手：？？？だけが落とす」', badUnseen);
  ok(badSeen === 0, 'T3 seen monster → 「入手：〈名前〉だけが落とす」', badSeen);
  const shopIt = Object.keys(DB.items).find((id) => DB.items[id].src === 'shop' && DB.items[id].type === 'weapon');
  ok(M.sourceLine(DB.items[shopIt], shopIt) === '入手：店で買える', 'T3 shop → 入手：店で買える');
  const rew = Object.keys(DB.items).find((id) => DB.items[id].src === 'reward');
  if (rew) ok(M.sourceLine(DB.items[rew], rew) === '入手：物語のお礼の一品物', 'T3 reward → 入手：物語のお礼の一品物');
  const drop = Object.keys(DB.items).find((id) => DB.items[id].src === 'drop' && DB.items[id].type === 'body');
  if (drop) ok(M.sourceLine(DB.items[drop], drop) === '入手：宝箱・ボス', 'T3 drop gear → 入手：宝箱・ボス');
  const dropUse = Object.keys(DB.items).find((id) => DB.items[id].src === 'drop' && DB.items[id].type === 'consumable');
  if (dropUse) ok(M.sourceLine(DB.items[dropUse], dropUse) === '入手：宝箱・魔物', 'T3 drop consumable → 入手：宝箱・魔物');
  const md = Object.keys(DB.items).find((id) => DB.items[id].src === 'mdrop');
  if (md) ok(/^入手：.+が落とす（レア）$/.test(M.sourceLine(DB.items[md], md)), 'T3 mdrop → 〈魔物〉が落とす（レア）', M.sourceLine(DB.items[md], md));
  const rl = Object.keys(DB.items).find((id) => DB.items[id].src === 'relic');
  if (rl) ok(/^入手：めずらしい魔物.+が落とす$/.test(M.sourceLine(DB.items[rl], rl)), 'T3 relic → めずらしい魔物〈名〉が落とす', M.sourceLine(DB.items[rl], rl));
}

// ================================================================== T4–T6: candidates strongest first
section('T4–T6 the equipment candidate list');
{
  freshGame({ hero: { name: 'リーネ', gender: 'f', type: 'mage', favor: { kind: 'element', id: 'fire' } }, companions: [] });
  const c = hero();
  const T = 3;
  const staff = Object.keys(DB.items).find((id) => DB.items[id].type === 'weapon' && DB.items[id].wtype === 'staff' && DB.items[id].tier === T && DB.items[id].src === 'shop');
  R.State.addItem(staff, 1); R.Rules.equip(c, 'weapon1', staff);
  const hat = Object.keys(DB.items).find((id) => DB.items[id].type === 'head' && DB.items[id].tier === T && DB.items[id].src === 'shop' && DB.items[id].stats && DB.items[id].stats.int);
  const helm = Object.keys(DB.items).find((id) => DB.items[id].type === 'head' && DB.items[id].tier === T && DB.items[id].src === 'shop' && DB.items[id].weight === 'heavy');
  R.State.addItem(hat, 1); R.State.addItem(helm, 1);
  let rows = M.candidateRows(c, 'head');
  const ih = rows.findIndex((r) => r.id === hat), im = rows.findIndex((r) => r.id === helm);
  ok(M.gearStyle(c) === 'magic', 'T4 a mage ranks gear as a caster', M.gearStyle(c));
  ok(R.Rules.previewStats(c, 'head', hat).mag > 0, 'T4 the 知力 hat raises 術力 (Δ術 > 0)', R.Rules.previewStats(c, 'head', hat).mag);
  ok(ih > 0 && im > 0 && ih < im, 'T4 the 知力 hat comes before the 守備 helm for a mage', { hat: [hat, ih], helm: [helm, im] });
  // a synthetic helm with only defence (守備だけの兜)
  DB.items.hd_test_defonly = { name: '試しの兜', type: 'head', grade: 'normal', tier: T, weight: 'heavy', def: 20, mdef: 0, stats: {}, price: 100, src: 'shop' };
  R.State.addItem('hd_test_defonly', 1);
  rows = M.candidateRows(c, 'head');
  ok(rows.findIndex((r) => r.id === hat) < rows.findIndex((r) => r.id === 'hd_test_defonly'), 'T4 … and before a helm with defence only');
  ok(rows[0].id === null, 'T4 the list starts with 外す');
  // a warrior ranks the helm first (plain formula)
  freshGame({ companions: [] });
  const w = hero();
  R.State.addItem(hat, 1); R.State.addItem(helm, 1);
  const wr = M.candidateRows(w, 'head');
  ok(M.gearStyle(w) === 'phys' && wr.findIndex((r) => r.id === helm) < wr.findIndex((r) => r.id === hat), 'T4 a warrior ranks the 守備 helm first');
  const d = R.Rules.previewStats(w, 'head', helm);
  ok(wr.find((r) => r.id === helm).score === Math.max(d.atk1, d.mag) + d.def + Math.floor(d.mdef / 2), 'T4 fighters use max(Δ攻, Δ術) + Δ守 + floor(Δ術防/2)');
  ok(M.candScore({ atk1: -4, mag: 0, def: 0, mdef: 0 }, 'weapon1', 'phys') === -4, 'T4 a weaker weapon scores its loss (Δ攻 −4, Δ術 0 → −4)');
  ok(M.candScore({ atk1: -20, mag: 30, def: 0, mdef: 0 }, 'weapon1', 'phys') === 30, 'T4 … and the better gain when one of them gains');
  // T5: equal score → id order
  DB.items.hd_test_b = { name: '試しの帽子B', type: 'head', grade: 'normal', tier: 1, weight: 'light', def: 7, mdef: 2, stats: {}, price: 50, src: 'shop' };
  DB.items.hd_test_a = { name: '試しの帽子A', type: 'head', grade: 'normal', tier: 1, weight: 'light', def: 7, mdef: 2, stats: {}, price: 50, src: 'shop' };
  R.State.addItem('hd_test_b', 1); R.State.addItem('hd_test_a', 1);
  const t5 = M.candidateRows(w, 'head');
  const ia = t5.findIndex((r) => r.id === 'hd_test_a'), ib = t5.findIndex((r) => r.id === 'hd_test_b');
  ok(t5[ia].score === t5[ib].score && ia < ib && ib === ia + 1, 'T5 equal scores are in id order', [ia, ib]);
  // T6: the worn item has E and sits at its score
  R.Rules.equip(w, 'head', 'hd_test_a');
  const t6 = M.candidateRows(w, 'head');
  const worn = t6.findIndex((r) => r.worn);
  ok(worn > 0 && t6[worn].id === 'hd_test_a', 'T6 the worn item is marked (E)', worn);
  ok(t6.slice(1).every((r, i, a) => i === 0 || a[i - 1].score > r.score || (a[i - 1].score === r.score && a[i - 1].id < r.id)), 'T6 the whole list (with the worn one) is in score order');
  ok(worn !== 1, 'T6 the worn item is not simply second (it is placed by its score)', worn);
  ok(t6[worn].score === 0 && t6[0].score < 0, 'T6 worn = 0, 外す < 0', [t6[worn].score, t6[0].score]);
  // weapon2 uses atk2
  const sw = Object.keys(DB.items).find((id) => DB.items[id].type === 'weapon' && DB.items[id].wtype === 'sword' && DB.items[id].tier === 2 && DB.items[id].src === 'shop');
  R.State.addItem(sw, 1);
  const w2 = M.candidateRows(w, 'weapon2').find((r) => r.id === sw);
  ok(w2 && w2.diff.atk2 > 0, 'T6 weapon2 candidates show 攻 from atk2', w2 && w2.diff);
  // 付けると lists every other change (not the 3 of the row)
  const oc = M.otherChanges({ atk1: 5, atk2: 0, mag: 3, def: 2, mdef: 4, hit: 1, eva: 0, crit: 0, str: 2, vit: 0, dex: -1, agi: 0, int: 0, mnd: 0, hp: 10, mp: 0, wp: 0 }, 'weapon1').map((p) => p.text);
  ok(oc.join('　') === '術防+4　命中+1　腕力+2　器用さ-1　最大HP+10', 'T6 付けると excludes 攻・術・守 and keeps the order', oc);
  for (const k of ['hd_test_defonly', 'hd_test_a', 'hd_test_b']) delete DB.items[k];
}

// ================================================================== T7–T8: bestiary page 1
section('T7–T8 the bestiary table');
{
  freshGame();
  const mob = M.monsterOrder().find((id) => { const d = DB.monsters[id].drops || {}; return d.normal && d.normal.item && d.rare && d.rare.item && d.super && d.super.item && !(DB.monsters[id].flags || []).includes('boss'); });
  ok(!!mob, 'T7 a regular monster with three slots exists', mob);
  const d = DB.monsters[mob].drops;
  R.State.seen(mob);
  let rows = M.bookDropRows(mob);
  ok(rows.map((r) => r.text).join('/') === '？？？/？？？/？？？', 'T7 nothing obtained → ？？？ ×3', rows.map((r) => r.text));
  R.State.noteDrop(mob, 'rare', { stolen: true });
  rows = M.bookDropRows(mob);
  ok(R.State.mon(mob).kills === 0 && rows[1].text === '★' + DB.items[d.rare.item].name, 'T7 stolen before the first kill → ★名前 (Part A5)', rows[1].text);
  ok(rows[1].color === M.kit.itemColor(d.rare.item), 'T7 the name has the item colour');
  R.State.noteDrop(mob, 'normal'); R.State.noteDrop(mob, 'super');
  rows = M.bookDropRows(mob);
  ok(rows[0].text === '★' + DB.items[d.normal.item].name && rows[2].text === '★' + DB.items[d.super.item].name, 'T7 drop / sr true → ★名前', rows.map((r) => r.text));
  ok(rows[0].drop === '○' && rows[1].drop === '○' && rows[2].drop === '○', 'T8 落とす ○ for each slot the monster has');
  ok(rows[0].steal === '○' && rows[1].steal === '○' && rows[2].steal === '―', 'T8 盗む: ○ ○ ― (super rares cannot be stolen)', rows.map((r) => r.steal));
  R.State.noteDrop(mob, 'scan');
  const mob2 = M.monsterOrder().find((id) => id !== mob && (DB.monsters[id].drops || {}).rare && !(DB.monsters[id].flags || []).includes('boss'));
  R.State.noteDrop(mob2, 'scan');
  ok(M.bookDropRows(mob2).every((r) => r.text === '？？？' || r.text === '―'), 'T7 scanning never reveals the item names');
  ok(M.bookKnown(mob2), 'T7 … but it shows the stats (見破る)');
  const boss = M.monsterOrder().find((id) => (DB.monsters[id].flags || []).includes('boss') && DB.monsters[id].drops && DB.monsters[id].drops.normal && !DB.monsters[id].drops.rare);
  if (boss) {
    const br = M.bookDropRows(boss);
    ok(br[1].text === '―' && br[2].text === '―' && br[1].drop === '―' && br[2].steal === '―', 'T8 a boss (normal slot only): レア・超レア rows are ―', br.map((r) => r.text + r.drop + r.steal));
    ok(br[0].steal === '○', 'T8 a boss can still be stolen from (×0.5)');
    R.State.noteDrop(boss, 'normal');
    ok(/^★/.test(M.bookDropRows(boss)[0].text), 'T8 the boss pool drop shows once obtained', M.bookDropRows(boss)[0].text);
  }
  const post = ['b_valzard_echo', 'b_ouroboros'].filter((id) => DB.monsters[id]);
  for (const id of post) ok(M.bookDropRows(id)[1].text === '？？？' && M.bookDropRows(id)[2].text === '？？？', 'T8 ' + id + ' has rare / super slots (？？？)');
  // order: lineages → stages, steel branches right after their base, rare monsters, bosses
  const order = M.monsterOrder();
  ok(order.length === 268, 'T8 the book has 268 entries', order.length);
  const firstRare = order.findIndex((id) => (DB.monsters[id].flags || []).includes('rare'));
  const firstBoss = order.findIndex((id) => (DB.monsters[id].flags || []).includes('boss'));
  ok(firstRare > 0 && firstBoss > firstRare && order.slice(firstBoss).every((id) => (DB.monsters[id].flags || []).includes('boss')), 'T8 mobs → rare monsters → bosses', [firstRare, firstBoss]);
  for (const lid of Object.keys(DB.lineages)) {
    const fam = DB.lineages[lid].family;
    if (!fam) continue;
    const baseLast = Math.max(...DB.lineages[fam].stages.map((s) => order.indexOf(s.mon)));
    const branchFirst = Math.min(...DB.lineages[lid].stages.map((s) => order.indexOf(s.mon)));
    ok(branchFirst === baseLast + 1, 'T8 the steel branch ' + lid + ' follows ' + fam, [baseLast, branchFirst]);
  }
  const slots = M.bookSlots(mob);
  ok(slots.every((s) => s.has) && slots.every((s) => s.got), 'T8 the list dots: 3 slots, all obtained');
}

// ================================================================== field effects
section('field effects, repeat targets, 満タン');
{
  freshGame();
  const [h, b, m] = R.Game.party;
  const st = (c) => R.Rules.stats(c);
  b.hp = 10;
  const r = M.applyFieldEffect(DB.items.i_salve.use, h, [b], { item: true });
  const want = R.Mon && R.Mon.healAmount ? R.Mon.healAmount(h, b, { type: 'heal', pct: 0.35 }, { item: true, field: true }) : Math.round(st(b).hp * 0.35);
  ok(r.changed && b.hp === Math.min(st(b).hp, 10 + want), 'heal uses R.Mon.healAmount (' + want + ')', b.hp);
  ok(r.lines[0] === b.name + 'のHPが' + (b.hp - 10) + '回復した！', 'heal line', r.lines);
  m.hp = 0;
  M.applyFieldEffect(DB.items.i_revive.use, h, [m], { item: true });
  ok(m.hp === Math.max(1, Math.floor(st(m).hp * 0.35)), 'revive 35%', m.hp);
  ok(!M.affects(DB.items.i_revive.use.effects, h), 'a living member is not a revive target');
  const before = h.bonus ? h.bonus.hp || 0 : 0;
  M.applyFieldEffect(DB.items.i_seed_hp.use, h, [h], { item: true });
  ok(h.bonus.hp === before + 10, 'grow: the seed adds to bonus.hp', h.bonus);
  h.bonus.hp = 200;
  ok(!M.affects(DB.items.i_seed_hp.use.effects, h), 'grow: at the cap (200) the seed is not used');
  const enc = M.applyFieldEffect(DB.items.i_repel.use, h, [], { item: true, id: 'i_repel' });
  ok(R.Game.encItem && R.Game.encItem.pct === -100 && R.Game.encItem.steps === 100 && R.Game.encItem.weakOnly && R.Game.encItem.id === 'i_repel', 'encounter → R.Game.encItem', R.Game.encItem);
  ok(enc.lines[0] === '魔物の気配が遠のいた。', 'repel line (STYLE_JA §9)', enc.lines);
  const lure = M.applyFieldEffect(DB.items.i_lure.use, h, [], { item: true, id: 'i_lure' });
  ok(lure.lines[0] === '魔物の気配が近づいてきた……。', 'lure line', lure.lines);
  // mp / wp items
  h.mp = 0; h.wp = 0;
  M.applyFieldEffect(DB.items.i_ether.use, h, [h], { item: true });
  M.applyFieldEffect(DB.items.i_tonic.use, h, [h], { item: true });
  ok(h.mp === Math.ceil(st(h).mp * 0.3) && h.wp === Math.ceil(st(h).wp * 0.3), 'healMp / healWp by % of the maximum', [h.mp, h.wp]);
  // spells: fieldEffects / effects filter
  const fe = M.fieldEffects(DB.actions.s_fire_dark_a || {});
  if (DB.actions.s_fire_dark_a) ok(fe.length === 1 && fe[0].type === 'encounter' && fe[0].pct === 100, '誘い火 uses its fieldEffects', fe);
  if (DB.actions.s_light_1) ok(M.fieldEffects(DB.actions.s_light_1).every((e) => ['heal', 'revive', 'healWp', 'cure'].includes(e.type)), 'field spells keep only heal/revive/healWp/cure');
  const fieldSpells = Object.keys(DB.actions).filter((id) => DB.actions[id].kind === 'spell' && DB.actions[id].field);
  ok(fieldSpells.length === 15, 'there are 15 field spells (§7.8.3)', fieldSpells.length);
  ok(fieldSpells.every((id) => M.fieldEffects(DB.actions[id]).length > 0), 'every field spell does something outside battle');
  // spellBlock
  const healer = R.Game.party.find((c) => (c.spells || []).includes('s_light_1')) || m;
  if (!(healer.spells || []).includes('s_light_1')) healer.spells = (healer.spells || []).concat(['s_light_1']);
  healer.mp = 0;
  ok(M.spellBlock(healer, 's_light_1') === 'MPが足りない！', 'spellBlock: MP', M.spellBlock(healer, 's_light_1'));
  healer.mp = st(healer).mp;
  ok(M.spellBlock(healer, 's_light_1') === '', 'spellBlock: usable');
  const battleOnly = Object.keys(DB.actions).find((id) => DB.actions[id].kind === 'spell' && !DB.actions[id].field);
  ok(M.spellBlock(healer, battleOnly) === '今は使えない。', 'spellBlock: battle-only spell → 今は使えない。');
}
{
  // 満タン: spells by MP efficiency first, items only when asked, never rare / all-party items
  freshGame();
  const party = R.Game.party;
  const healer = party[2];
  healer.spells = ['s_light_1', 's_light_3'].filter((id) => DB.actions[id]);
  for (const c of party) { const s = R.Rules.stats(c); c.hp = Math.max(1, Math.floor(s.hp * 0.3)); c.mp = s.mp; }
  const mp0 = healer.mp;
  const log = M.autoHeal();
  ok(Object.keys(log.spells).length > 0 && healer.mp < mp0, '満タン casts heal spells', log.spells);
  const full = party.every((c) => c.hp >= R.Rules.stats(c).hp);
  ok(full || healer.mp < 3, '満タン heals everyone or runs out of MP', party.map((c) => c.hp + '/' + R.Rules.stats(c).hp));
  const lines = M.mantanLines(log);
  ok(lines.lines.every((l) => /　×\d+（MP \d+）$/.test(l.text)), '満タン result rows 「ひだまり　×3（MP 9）」', lines.lines.map((l) => l.text));
  // items phase: cheap single-target heals only
  freshGame();
  R.Game.inv = {};
  R.State.addItem('i_salve', 5); R.State.addItem('i_potion', 5); R.State.addItem('i_incense', 5); R.State.addItem('i_lifedew', 2); R.State.addItem('i_revive', 2);
  for (const c of R.Game.party) { c.spells = []; c.hp = Math.max(1, Math.floor(R.Rules.stats(c).hp * 0.5)); }
  R.Game.party[3].hp = 0;
  const log2 = M.autoHeal({ items: true });
  ok(!log2.items.i_incense && !log2.items.i_lifedew, '満タン never uses rare or all-party items', log2.items);
  ok(log2.items.i_revive === 1 && R.Game.party[3].hp > 0, '満タン raises the fallen with the cheap revive item', log2.items);
  ok(R.Game.party.every((c) => c.hp >= R.Rules.stats(c).hp), '満タン with items heals everyone', R.Game.party.map((c) => c.hp));
  ok(M.mantanLines(log2).last.text === '全員元気になった。', '満タン last line when done', M.mantanLines(log2).last);
  R.Game.party[1].hp = 1;
  ok(/^まだ傷ついている人：/.test(M.mantanLines({ spells: {}, items: {}, revived: [] }).last.text), '満タン last line when someone is still hurt');
}

// ================================================================== warp list, main menu, objective
section('warp list and the main menu');
{
  freshGame();
  R.Game.visited = {};
  for (const id of ['roa', 'lute', 'lighthouse', 'fern', 'verda_maze', 'loch', 'mist_manor', 'archive']) if (DB.locations[id]) R.Game.visited[id] = true;
  R.Field.teleportList = R.Field.teleportList || (() => []);
  const list = M.warpList();
  const locOrder = Object.keys(DB.locations);
  ok(list.length === Object.keys(R.Game.visited).length, 'warp list = the visited locations', list.map((l) => l.id));
  ok(list.every((l, i) => i === 0 || locOrder.indexOf(list[i - 1].id) < locOrder.indexOf(l.id)), 'warp list keeps the DB.locations order (region → town → dungeon)');
  ok(M.warpLabel({ name: '迷いの森', kind: 'dungeon' }) === '迷いの森の入口' && M.warpLabel({ name: '港町ファロス', kind: 'town' }) === '港町ファロス', 'dungeon rows read 〈名前〉の入口');
  ok(M.warpGroupName('prologue') === 'ファロス半島' && M.warpGroupName('r_forest') === DB.regions.r_forest.name && M.warpGroupName('finale') === 'ビブリア島', 'group names from DB.config.warpGroups / DB.regions');
  ok(M.COMMANDS.length === 16 && M.COMMANDS.map((c) => c.label).join(' ') === '道具 技・術 満タン 装備 強さ 並びと隊列 技の書 術の書 図鑑 年代記 地図 ワープ 脱出 仲間 セーブ 設定', 'the 16 commands in §11.7.1 order');
  // conditions
  const saveField = { canTeleport: R.Field.canTeleport, canExit: R.Field.canExit };
  R.Game.flags.prologue_done = false;
  R.Field.canTeleport = () => true; R.Field.canExit = () => true;
  ok(!M.commandOk('warp') && !M.commandOk('escape'), 'ワープ・脱出 grey before prologue_done');
  R.Game.flags.prologue_done = true;
  ok(M.commandOk('warp') && M.commandOk('escape'), 'ワープ・脱出 usable after prologue_done');
  R.Field.canTeleport = () => false; R.Field.canExit = () => false;
  ok(!M.commandOk('warp') && !M.commandOk('escape'), 'ワープ grey inside a dungeon, 脱出 without an escape');
  Object.assign(R.Field, saveField);
  R.Game.inv = {};
  ok(!M.commandOk('chronicle'), '年代記 grey without k_chronicle');
  R.State.addItem('k_chronicle', 1);
  ok(M.commandOk('chronicle'), '年代記 with k_chronicle');
  for (const c of R.Game.party) { c.techs = []; c.spells = []; }
  ok(!M.commandOk('arts'), '技・術 grey when nobody knows a tech or spell');
  R.Game.party[1].techs = [Object.keys(DB.actions).find((id) => DB.actions[id].kind === 'tech')];
  ok(M.commandOk('arts'), '技・術 once someone knows one');
  // chapter label and objective text
  R.Game.regionsCleared = []; R.Game.tier = 0; R.Game.gameClear = false; R.Game.flags.game_clear = false;
  ok(M.chapterLabel() === '序章', '年代記 序章 at tier 0');
  R.Game.tier = 5;
  ok(M.chapterLabel() === '第5章', '年代記 第5章 at tier 5');
  R.Game.gameClear = true;
  ok(M.chapterLabel() === '終章', '年代記 終章 after the ending');
  R.Game.gameClear = false;
  R.Game.objective = 'obj_regions';
  ok(M.objectiveText('obj_regions').includes('残り3地方'), '{left} = 8 − tier', M.objectiveText('obj_regions'));
}

// ================================================================== settings, save summary, shop
section('settings, save, shop, chronicle, books');
{
  const S = M.SETTINGS;
  ok(S.length === 13, '13 settings + 戻る = 14 rows (§11.7.15, メニューの表示 added by Part A11)', S.length);
  ok(S.map((s) => s.label).join(' ') === 'メッセージ速度 戦闘速度 BGM 効果音 ボイスの音量 常にダッシュ フィールドの広さ ウインドウの色 メニューの表示 タッチパッド 決定ボタン オート継続 カーソル記憶', 'setting labels (STYLE_JA §8)', S.map((s) => s.label));
  ok(S.every((s) => s.key in R.DEFAULT_SETTINGS), 'every setting has a default (save.js)', S.filter((s) => !(s.key in R.DEFAULT_SETTINGS)).map((s) => s.key));
  ok(S.every((s) => s.vol || s.values.includes(R.DEFAULT_SETTINGS[s.key])), 'every default is one of the values');
  ok(S.every((s) => s.vol || s.values.length === s.names.length), 'values and names match');
  const fz = S.find((s) => s.key === 'fieldZoom');
  ok(fz.names.join('/') === 'ふつう/ひろい/もっとひろい' && fz.values.join('/') === 'normal/wide/wider', 'フィールドの広さ ふつう/ひろい/もっとひろい');
  const wc = S.find((s) => s.key === 'windowColor');
  ok(wc.values[0] === 'ink' && wc.names[0] === '紺', 'ウインドウの色 starts with 紺 (ink)');
  ok(S.find((s) => s.key === 'autoKeep').desc === '次の戦闘もオートで始める（ボス戦は手動）', 'オート継続 description');
  ok(S.every((s) => W(s.desc) <= 228), 'setting descriptions fit one line (228px)', S.filter((s) => W(s.desc) > 228).map((s) => s.desc));
  ok(S.every((s) => s.vol || s.names.every((n) => W(n) <= 70)), 'value names fit 70px');
  ok((S.length + 1) * 13 + 16 === 198, 'the settings window is 198 tall (pitch 13) + the 20-tall help window = 220 ≤ 224');
  ok(R.DEFAULT_SETTINGS.voiceVolume === 0.8 && R.DEFAULT_SETTINGS.settingsVer === 5, 'voiceVolume 0.8, settingsVer 5');
  const ms = S.find((s) => s.key === 'menuSize');
  ok(ms && ms.values.join('/') === 'compact/large' && ms.names.join('/') === 'コンパクト/大きく' && R.DEFAULT_SETTINGS.menuSize === 'compact', 'メニューの表示 コンパクト（既定）/大きく (Part A11)');
  // settingsVer 4 → 5 gives existing players the compact menus; a stored choice is kept
  const old4 = { settingsVer: 4, windowColor: 'ink', voiceVolume: 0.5 };
  ok(R.Save.migrateSettings(old4) && old4.menuSize === 'compact' && old4.settingsVer === 5 && old4.voiceVolume === 0.5, 'migration v4 → v5 adds menuSize compact', old4);
  const kept = { settingsVer: 5, menuSize: 'large' };
  ok(!R.Save.migrateSettings(kept) && kept.menuSize === 'large', 'a stored 大きく is kept');
  // UI scale: compact = 0.75 (32 device px text, ≥ 12 CSS px on a 390px-wide phone), large = 1
  const saveMS = R.Settings.menuSize;
  R.Settings.menuSize = 'compact';
  const k = M.kit;
  ok(k.S() === 0.75 && k.frame().scale === 0.75 && 32 / 3 * k.S() * R.SCALE === 32, 'compact: scale 0.75 → default text 32 device px');
  ok(32 * 390 / (R.W * R.SCALE) >= 12, 'compact text ≥ 12 CSS px on a 390px phone', 32 * 390 / (R.W * R.SCALE));
  R.Settings.menuSize = 'large';
  ok(k.S() === 1 && k.frame().scale === 1 && !k.frame().ox, 'large: scale 1, no offset (the old layout)');
  R.Settings.menuSize = saveMS;
  ok(typeof R.Gfx.pushScale === 'function' && typeof R.Gfx.popScale === 'function' && typeof R.UI.inFrame === 'function', 'R.Gfx.pushScale / popScale, R.UI.inFrame');
}
{
  freshGame();
  const data = R.State.serialize();
  ok(data.summary && data.summary.hero && Array.isArray(data.summary.sprites) && data.summary.sprites.length === R.Game.party.length, 'save summary has the hero and the 4 sprites', data.summary);
  ok(data.summary.tier === R.Game.tier, 'save summary has the tier');
}
{
  freshGame();
  const sh = Object.keys(DB.shops).find((id) => /_weapon$/.test(id));
  const st = R.Shop.stock(sh);
  ok(st.length > 0 && st.every((id) => DB.items[id]), 'shop stock comes from R.Tier.shopItems (' + sh + ': ' + st.length + ')');
  const c = hero();
  const wpn = st.find((id) => DB.items[id].type === 'weapon' && DB.items[id].wtype === DB.items[c.equip.weapon1].wtype) || st[0];
  const mk = R.Shop.gearMark(c, wpn);
  ok(['▲', '▼', '―', '○', 'E', '×'].includes(mk.mark), 'shop mark for the hero', mk);
  const acc = Object.keys(DB.items).find((id) => DB.items[id].type === 'acc' && !Object.keys(DB.items[id].stats || {}).length);
  if (acc) ok(R.Shop.gearMark(c, acc).mark === '○', 'shop mark ○ for gear without numbers', R.Shop.gearMark(c, acc));
  const worn = c.equip.body;
  if (worn) ok(R.Shop.gearMark(c, worn).mark === 'E', 'shop mark E for what the member wears');
  const uni = Object.keys(DB.items).find((id) => DB.items[id].unique);
  ok(R.Shop.sellPrice(DB.items[uni]) === 0 && R.Shop.sellPrice(DB.items.i_salve) === Math.floor(DB.items.i_salve.price / 2), 'unique items do not sell; others at half price');
}
{
  freshGame();
  R.Game.regionsCleared = ['r_snow', 'r_forest']; R.Game.tier = 2;
  R.State.addItem('k_page_snow', 1);
  const e = M.chronicleEntries();
  const kinds = e.map((x) => x.kind + ':' + x.label);
  ok(e[0].kind === 'prologue' && e[1].label === '第1章' && e[1].region === 'r_snow' && e[2].region === 'r_forest', 'chapters are numbered by clear order', kinds.slice(0, 3));
  ok(e.filter((x) => x.kind === 'region').length === 6, 'the 6 regions still to visit are listed');
  const pages = e.filter((x) => x.kind === 'page');
  ok(pages.length === 8 && pages.filter((p) => p.got).length === 1 && pages.filter((p) => !p.got).every((p) => p.label === '？？？'), '8 pages, unobtained ones ？？？');
  ok(!e.some((x) => x.kind === 'finale') && !e.some((x) => x.kind === 'side'), '終章・外伝 hidden before their flags');
  R.Game.flags.final_open = true; R.Game.flags.pg_clear = true;
  ok(M.chronicleEntries().some((x) => x.kind === 'finale') && M.chronicleEntries().some((x) => x.kind === 'side'), '終章・外伝 once final_open / pg_clear');
  ok(typeof M.secretCounts().total === 'number', 'secret counts');
  // A4.1: an old save may name cells that are no longer secret passages; found never exceeds the total
  R.Game.secrets = { 'no_such_map:1,1': true, 'roa:0,0': true, 'old:3,4': true };
  const sc = M.secretCounts();
  ok(sc.found <= sc.total && sc.found === (R.Field && R.Field.secretsFound ? Math.min(R.Field.secretsFound(), sc.total) : 0), 'secret counts: stale keys of an old save are not counted', sc);
  R.Game.secrets = {};
}
{
  freshGame();
  const tb = M.bookEntries('tech');
  ok(tb.length === 11 && tb.every((p) => p.ids.length === 11), '技の書: 11 types × 11 techs', tb.map((p) => p.ids.length));
  ok(tb.reduce((a, p) => a + p.ids.length, 0) === 121, '技の書: 121 techs');
  const sb = M.bookEntries('spell');
  ok(sb.map((p) => p.tab).join(' ') === '火 水 風 土 光 闇 合成 1/3 合成 2/3 合成 3/3 三属 1/2 三属 2/2', '術の書 tabs 火 水 風 土 光 闇 合成×3 三属×2', sb.map((p) => p.tab));
  ok(sb.reduce((a, p) => a + p.ids.length, 0) === 77, '術の書: 77 spells');
  ok(sb.every((p) => p.ids.every((id, i) => i === 0 || DB.actions[p.ids[i - 1]].order < DB.actions[id].order)), '術の書 pages in `order`');
  ok(!M.bookFound('tech', tb[0].ids[5]), 'an unlearned tech is not found');
  R.State.noteLearned('hero', tb[0].ids[5]);
  ok(M.bookFound('tech', tb[0].ids[5]), 'noteLearned makes it found');
}

// ================================================================== game over (node, stubbed field)
section('game over');
{
  freshGame();
  R.Game.gold = 1001;
  for (const c of R.Game.party) c.hp = 0;
  R.Game.encItem = { id: 'i_lure', pct: 100, steps: 50 };
  if (R.Battle) R.Battle.autoCarry = true;
  const said = [];
  const realSay = R.UI.say;
  R.UI.say = (t) => { said.push(R.Text.fmt(t)); return Promise.resolve(); };
  const oldField = R.Field;
  let warped = null;
  R.Field = { respawn: () => { warped = R.Game.respawn || 'start'; return Promise.resolve(true); } };
  R.jingle = () => Promise.resolve();
  let done = false, err = null;
  R.GameOver.run().then(() => { done = true; }, (e) => { err = e; done = true; });
  for (let i = 0; i < 2000 && !done; i++) R.Engine.step();
  const settle = () => new Promise((r) => setImmediate(r));
  (async () => {
    for (let i = 0; i < 400 && !done; i++) { R.Engine.step(); await settle(); }
    ok(done && !err, 'GameOver.run resolves', err && String(err));
    ok(R.Game.gold === 500, 'gold halved (rounded down)', R.Game.gold);
    ok(R.State.all().every((c) => c.hp === R.Rules.stats(c).hp && c.mp === R.Rules.stats(c).mp && c.wp === R.Rules.stats(c).wp), 'everyone (reserve too) back to full');
    ok(R.Game.encItem === null && (!R.Battle || R.Battle.autoCarry === false), 'encItem null, autoCarry false');
    ok(!R.Engine.layers.some((l) => l instanceof R.GameOver.Layer), 'the game over layer is gone');
    ok(R.Engine.fadeAlpha === 0 && R.Input.enabled === true && R.Engine.paused === false, 'no fade left, input on, not paused');
    ok(warped !== null, 'the party is sent to the respawn point');
    ok(said.length === 1 && said[0] === hero().name + 'たちは目を覚ました。\n所持金が半分になった。', 'wake-up lines (STYLE_JA §9)', said);
    // with no gold the second line is left out
    R.Game.gold = 0; said.length = 0; done = false; err = null;
    R.GameOver.run().then(() => { done = true; }, (e) => { err = e; done = true; });
    for (let i = 0; i < 800 && !done; i++) { R.Engine.step(); await settle(); }
    ok(done && said[0] === hero().name + 'たちは目を覚ました。', 'no gold → no 所持金 line', said);
    // an onEnter event of the respawn map closes the wake-up window before it is read: run() must still end (§4.12.2)
    // (the window is closed from outside: closed, its say still pending) — and the lines are shown once more
    let shown = 0;
    R.UI.say = () => { shown++; R.UI._msg = { closed: true, resolveText: () => {} }; return new Promise(() => {}); };
    done = false; err = null;
    R.GameOver.run().then(() => { done = true; }, (e) => { err = e; done = true; });
    for (let i = 0; i < 800 && !done; i++) { R.Engine.step(); await settle(); }
    ok(done && !err, 'GameOver.run ends when someone else closes its message window', err && String(err));
    ok(shown === 2, 'wake-up lines closed from outside are shown once more (the player must see them)', shown);
    R.UI._msg = null;
    // A5.1: the public message-window accessors GameOver uses
    ok(R.UI.msgOpen() === null && R.UI.msgSettled() === true, 'msgOpen / msgSettled with no window');
    const fakeM = { closed: false, resolveText: () => {} };
    R.UI._msg = fakeM;
    ok(R.UI.msgOpen() === fakeM && R.UI.msgSettled() === false, 'msgOpen / msgSettled with a window waiting for its reader');
    fakeM.resolveText = null; fakeM.closed = true;
    ok(R.UI.msgOpen() === null && R.UI.msgSettled(fakeM) === true, 'a window its reader closed has settled');
    R.UI._msg = null;
    // every race the bestiary prints has a Japanese name (図鑑 page 2)
    const races = [...new Set(Object.values(DB.monsters).map((m) => m.race).filter(Boolean))];
    const raw = races.filter((r) => M.kit.raceName(r) === r || !M.kit.raceName(r));
    ok(!raw.length, 'every monster race (' + races.length + ') has a display name', raw);
    R.UI.say = realSay;
    R.Field = oldField;
    finish();
  })();
}

// ================================================================== screen texts (STYLE_JA §7.3, §10)
function textChecks() {
  section('screen texts');
  const files = fs.readdirSync(path.join(ROOT, 'src/systems')).filter((f) => /^(menu.*|shop|gameover)\.js$/.test(f));
  const BANNED = ['冒険の書', '復活の呪文', 'ふっかつのじゅもん', '呪文', '痛恨', '会心の一撃', 'やっつけた', '回り込まれて', '息の根を止めた', '何も起こらなかった', 'ポイントの経験値',
    '身を守っている', '様子をうかがっている', 'を落としていった', 'リジェネ', 'ジョブ', 'アビリティ', 'JP', '麻痺', '魔法防御', '並び替え', '酒場の主人', 'すべて袋に', '頁', '秘奥義', '魔剣士', '蘇生', '大切なもの', '魔力', '魔法', 'アクセサリー', '教会'];
  const bad = [];
  let strings = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, 'src/systems', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"])\/\/.*$/, '$1')).join('\n');
    const lits = src.match(/'(?:[^'\\\n]|\\.)*'/g) || [];
    for (const lit of lits) {
      const s = lit.slice(1, -1);
      if (!/[぀-ヿ一-鿿]/.test(s)) continue;
      strings++;
      for (const b of BANNED) if (s.includes(b)) bad.push(f + ': ' + b + ' in ' + lit);
      if (/[^…]…[^…]|^…[^…]|[^…]…$|^…$/.test(s)) bad.push(f + ': single … in ' + lit);
      for (const line of s.split('\\n')) if (W(line.replace(/\{hero\}/g, 'アルンハル')) > 228 + 1) bad.push(f + ': line over 228px ' + line);
    }
  }
  ok(strings > 200, 'scanned the screen strings of my files (' + strings + ')');
  ok(!bad.length, 'no banned words, no single …, no line over one window width', bad.slice(0, 12));
}

function finish() {
  textChecks();
  console.log('test_menu: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) { for (const f of fails) console.log('  FAIL ' + f); process.exit(1); }
  process.exit(0);
}
