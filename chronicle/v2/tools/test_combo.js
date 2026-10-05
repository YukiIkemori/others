#!/usr/bin/env node
// BATTLE（w_combo 2026-10-01）: 敵の合体技（DB.enemyCombos）と雑魚の手の幅のテスト
//   node v2/tools/test_combo.js
// 合体技: 仲間がそろって動けるときだけ出る・仲間の手番を使う・待ち（cd）と回数（max）・眠り/まひ/凍り/気絶/混乱/予告中/倒れた仲間がいると出ない・
// 2 段（加勢して殴る）・全員（群れ狩り）・合体（ゼリー）。データ: 仲間の id・系統・行動・演出の行・5 言語の文。魔物の構え（打ち返し）・ねらい（aim）。
'use strict';
const load = require('./lib/load');
const { ok, section, done } = require('./lib/testkit');

const R = load({ quiet: true });
const DB = R.DB;
const BC = R.BattleCore;
const AI = R.BattleAI;
const SZ = require('./sim_zones.js');

const party0 = SZ.buildParty(R, { tier: 2, kind: 'party', members: SZ.STD, seed: 7 });
const clone = (x) => JSON.parse(JSON.stringify(x));
/** 戦闘を作る（不意打ちなし）。tweak(eng) で状態を変えてから回す */
function mk(mons, o) {
  o = o || {};
  const eng = new BC.Engine({ party: party0.map(clone), mons, tier: o.tier != null ? o.tier : 2, lv: o.lv || 20, seed: o.seed || 'combo', noSurprise: true });
  return eng;
}
/** 1 ラウンド（味方はみな守る）→ 中の出来事 */
function round(eng, cmds) {
  const evs = [];
  for (const ev of eng.playRound(cmds || eng.party.map(() => ({ type: 'defend' })))) evs.push(ev);
  return evs;
}
/** 合体技 id の確率を 1 に（テストの間だけ） */
function force(id, extra) {
  const C = DB.enemyCombos[id];
  const save = Object.assign({}, C);
  Object.assign(C, { chance: 1 }, extra || {});
  return () => { for (const k of Object.keys(C)) delete C[k]; Object.assign(C, save); };
}
const comboFx = (evs) => evs.filter((e) => e.t === 'fx' && e.combo);
const actsOf = (evs, u) => evs.filter((e) => e.t === 'fx' && e.user === u && !e.again);

// ---------------------------------------------------------------- 1. そろったら出る・手番を使う
section('1. 合体技が出る・仲間の手番を使う');
{
  const undo = force('c_fire_tornado');
  const eng = mk(['salamander_2', 'imp_2'], { tier: 2 });
  const [sal, imp] = eng.mons;
  const evs = round(eng);
  const cf = comboFx(evs);
  ok('炎の竜巻が 1 回出る', eng.stats.combos === 1 && cf.length === 1 && cf[0].combo.id === 'c_fire_tornado', cf.map((e) => e.combo && e.combo.id));
  ok('出来事に合体技の印（first・2 体の uid）と演出の seq', cf[0] && cf[0].combo.first === true && cf[0].combo.uids.length === 2 && cf[0].seq === 'sq:s_fire_wind_b');
  const lead = cf[0] && cf[0].user;
  const other = lead === sal ? imp : sal;
  ok('仲間は自分の行動をしない（手番を使った）', actsOf(evs, other).length === 0, actsOf(evs, other).map((e) => e.id));
  ok('仲間の手番も数える（acts）', sal.acts === 1 && imp.acts === 1, [sal.acts, imp.acts]);
  const ce = []; for (const ev of evs) BC.toEvents(ev, 'hero', ce, eng);
  const act = ce.find((e) => e.t === 'act' && e.combo);
  ok('契約の act に combo と seq が乗り、形が通る', !!act && act.seq === 'sq:s_fire_wind_b' && R.Contract.check('battleEvent', act).ok);
  ok('知らせの文（「…が力を合わせた！」）', evs.some((e) => e.t === 'msg' && /力を合わせた/.test(e.text)));
  undo();
}
{
  const undo = force('c_fire_tornado');
  const eng = mk(['salamander_2'], { tier: 2 });
  round(eng);
  ok('仲間がいなければ出ない', eng.stats.combos === undefined || eng.stats.combos === 0);
  const eng2 = mk(['salamander_2', 'imp_2'], { tier: 0 });
  round(eng2);
  ok('tierMin より前のティアでは出ない', !eng2.stats.combos);
  undo();
}

// ---------------------------------------------------------------- 2. 動けない仲間
section('2. 眠り・まひ・凍り・気絶・混乱・予告中・倒れた仲間がいると出ない');
for (const st of ['sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'reserved', 'dead']) {
  const undo = force('c_fire_tornado');
  const eng = mk(['salamander_2', 'imp_2'], { tier: 2 });
  const imp = eng.mons[1];
  if (st === 'dead') imp.hp = 0;
  else if (st === 'reserved') imp.reserved = { id: 'e_fire_rain', round: 99 };
  else { imp.status[st] = true; imp.turns[st] = 5; }
  round(eng);
  ok(`仲間が ${st} → 合体技なし`, !eng.stats.combos, eng.stats.combos);
  undo();
}
{
  // 本人が混乱（u.status.confuse）でも出ない
  const undo = force('c_fire_tornado');
  const eng = mk(['salamander_2', 'imp_2'], { tier: 2 });
  for (const m of eng.mons) { m.status.confuse = true; m.turns.confuse = 5; }
  round(eng);
  ok('2 体とも混乱 → 合体技なし', !eng.stats.combos);
  undo();
}
{
  // 先に動いた仲間（手番が残っていない）は加われない
  const undo = force('c_fire_tornado');
  const eng = mk(['salamander_2', 'imp_2'], { tier: 2 });
  const [sal, imp] = eng.mons;
  eng.slots = [{ u: sal, done: true }, { u: imp, done: true }];
  ok('手番の残っていない仲間とは組まない', AI.comboFor(eng, sal) === null);
  eng.slots = [{ u: sal, done: true }, { u: imp, done: false }];
  const cp = AI.comboFor(eng, sal);
  ok('手番の残っている仲間とは組む', !!cp && cp.units.includes(imp));
  eng.slots = null;
  undo();
}

// ---------------------------------------------------------------- 3. 待ち・回数
section('3. 待ち（cd）と回数（max）');
{
  const undo = force('c_fire_tornado', { cd: 3, max: undefined });
  delete DB.enemyCombos.c_fire_tornado.max;
  const eng = mk(['salamander_2', 'imp_2'], { tier: 2 });
  for (const m of eng.mons) m.hp = m.mhp = 99999;
  const rounds = [];
  for (let r = 1; r <= 7; r++) { const n0 = eng.stats.combos || 0; round(eng); if ((eng.stats.combos || 0) > n0) rounds.push(r); }
  ok('cd 3: 1・4・7 ラウンドに出る', JSON.stringify(rounds) === '[1,4,7]', rounds);
  undo();
  const undo2 = force('c_fire_tornado', { max: 1 });
  const eng2 = mk(['salamander_2', 'imp_2'], { tier: 2 });
  for (const m of eng2.mons) m.hp = m.mhp = 99999;
  for (let r = 1; r <= 6; r++) round(eng2);
  ok('max 1: 1 戦に 1 回だけ', eng2.stats.combos === 1, eng2.stats.combos);
  undo2();
  const undo3 = force('c_fire_tornado', { round: 3 });
  const eng3 = mk(['salamander_2', 'imp_2'], { tier: 2 });
  for (const m of eng3.mons) m.hp = m.mhp = 99999;
  round(eng3); round(eng3);
  const before = eng3.stats.combos || 0;
  round(eng3);
  ok('round 3: 3 ラウンドから', before === 0 && eng3.stats.combos === 1);
  undo3();
}

// ---------------------------------------------------------------- 4. 2 段・全員・合体
section('4. 加勢して殴る・群れ狩り・ゼリー合体');
{
  const undo = force('c_war_cry');
  const eng = mk(['imp_2', 'orc_2'], { tier: 4 });
  const [imp, orc] = eng.mons;
  const evs = round(eng);
  const cf = comboFx(evs);
  ok('2 段: 小鬼の加護 → 大鬼の一撃（同じ合体技の 2 つの行動）', cf.length === 2 && cf[0].user === imp && cf[0].id === 'ec_dark_blessing' && cf[1].user === orc && cf[1].id === 'ec_brute_smash', cf.map((e) => e.id));
  ok('加護は大鬼に（攻撃 +2）', orc.buffs.atk === 2, orc.buffs.atk);
  ok('帯は 1 段目だけ（first）', cf[0].combo.first && !cf[1].combo.first);
  undo();
}
{
  const undo = force('c_pack_hunt');
  const eng = mk(['wolf_2', 'wolf_2', 'wolf_2'], { tier: 2 });
  const evs = round(eng);
  const cf = comboFx(evs);
  const tg = cf.map((e) => e.targets[0] && e.targets[0].uid);
  ok('群れ狩り: 2 匹が同じ的へ', cf.length === 2 && tg[0] && tg[0] === tg[1], tg);
  ok('3 匹目は自分の手番で動く', eng.mons.filter((m) => m.acts === 1).length === 3);
  undo();
}
{
  const undo = force('c_jelly_merge', { round: 1 });
  const eng = mk(['jelly_1', 'jelly_1', 'jelly_1', 'jelly_1'], { tier: 0, lv: 8 });
  const evs = round(eng);
  const big = eng.mons.find((m) => m.id === 'jelly_big');
  ok('ゼリー合体: 3 匹が消えて、がったいゼリーが現れる', !!big && big.alive && eng.mons.filter((m) => m.gone).length === 3, eng.mons.map((m) => m.id + (m.gone ? '-' : '')));
  ok('合体の出来事（flee 3・summon 1）', evs.filter((e) => e.t === 'flee').length === 3 && evs.filter((e) => e.t === 'summon').length === 1);
  ok('4 匹目は残る', eng.mons.filter((m) => m.id === 'jelly_1' && m.alive).length === 1);
  undo();
}
{
  // 持ち主 2026-10-05: 合体で元の魔物の落とし物が消えて損 → いちばん強い元の魔物の枠を引き継ぎ、率は 2 倍
  const undo = force('c_jelly_merge', { round: 1 });
  const eng = mk(['jelly_5', 'jelly_5', 'jelly_5'], { tier: 9, lv: 60 });
  round(eng);
  const big = eng.mons.find((m) => m.id === 'jelly_big');
  const src = DB.monsters.jelly_5.drops, dr = big && big.d.drops;
  ok('虹ゼリーの合体: がったいゼリーが虹ゼリーのレア・超レア・盗みを持つ', !!dr && dr.rare && dr.rare.item === src.rare.item && dr.super && dr.super.item === src.super.item && dr.steal && dr.steal.item === src.steal.item, dr);
  ok('率は 2 倍（rate が半分）', !!dr && dr.rare.rate === src.rare.rate / 2 && dr.super.rate === src.super.rate / 2 && dr.steal.rate === src.steal.rate / 2, [dr && dr.rare.rate, src.rare.rate]);
  ok('ほかのがったいゼリー（定義）は変えない', DB.monsters.jelly_big.drops.normal.item === 'i_potion' && !DB.monsters.jelly_big.drops.rare);
  undo();
}

// ---------------------------------------------------------------- 5. 手の幅（構え・ねらい）
section('5. 魔物の構え（打ち返し）・ねらい');
{
  const eng = mk(['armor_3'], { tier: 4 });
  const m = eng.mons[0];
  m.hp = m.mhp = 99999;
  m.status.counter = { power: 1 }; m.turns.counter = 'next';
  const hero = eng.party[0];
  const hp0 = hero.hp;
  const evs = [];
  for (const ev of eng.attack(hero, m, {})) evs.push(ev);
  for (const ev of eng.flushReactions()) evs.push(ev);
  ok('構えた魔物は打ち返す', evs.some((e) => e.t === 'react' && e.u === m) && evs.some((e) => e.t === 'fx' && e.user === m && e.kind === 'counter'), hp0);
}
{
  const eng = mk(['owl_3'], { tier: 4 });
  const healer = eng.party.find((p) => (p.c.spells || []).some((id) => { const a = BC.ACT(id); return a && (a.effects || []).some((e) => e.type === 'heal'); }));
  const picks = new Set();
  for (let i = 0; i < 20; i++) picks.add(AI.pickPartyTarget(eng, 'healer'));
  ok('aim healer: 回復の術を持つ人だけをねらう', !!healer && [...picks].every((p) => (p.c.spells || []).some((id) => { const a = BC.ACT(id); return a && (a.effects || []).some((e) => e.type === 'heal'); })), [...picks].map((p) => p.name));
  const back = new Set();
  for (let i = 0; i < 20; i++) back.add(AI.pickPartyTarget(eng, 'back'));
  ok('aim back: 後列の人だけ', [...back].every((p) => eng.effRow(p) === 'back'), [...back].map((p) => p.name));
}
{
  const eng = mk(['crystal_3'], { tier: 4 });
  const m = eng.mons[0];
  const evs = [];
  for (const ev of BC.specials.elem_shift(eng, m)) evs.push(ev);
  const w = Object.entries(m.d.elem).filter(([, v]) => v >= 1.5).map(([k]) => k);
  ok('色変わり: 攻撃の属性が変わり、その反対に弱くなる', !!m.d.shifted && m.d.element === m.d.shifted && w.length >= 1 && DB.monsters.crystal_3.element === undefined, { el: m.d.element, w });
}

// ---------------------------------------------------------------- 6. データ
section('6. データ（仲間・行動・演出・文）');
{
  const bad = [];
  const S = R.BFX && R.BFX.seq;
  const ids = Object.keys(DB.enemyCombos);
  for (const [id, C] of Object.entries(DB.enemyCombos)) {
    for (const sp of C.members || []) {
      for (const m of [].concat(sp.mon || [])) if (!DB.monsters[m]) bad.push(`${id}: mon ${m}`);
      for (const l of [].concat(sp.lin || [])) if (!DB.lineages[l]) bad.push(`${id}: lin ${l}`);
    }
    for (const st of C.steps || []) {
      if (!BC.ACT(st.act)) bad.push(`${id}: act ${st.act}`);
      if (st.seq && !(S && S.has(st.seq))) bad.push(`${id}: seq ${st.seq}`);
    }
    if (C.merge && !DB.monsters[C.merge.mon]) bad.push(`${id}: merge ${C.merge.mon}`);
    if (!C.steps && !C.merge) bad.push(`${id}: no steps`);
  }
  ok(`合体技 ${ids.length} 個: 仲間・行動・合体・演出の行がある`, !bad.length && ids.length >= 15, bad);
  const regular = ids.filter((id) => (DB.enemyCombos[id].members || []).every((sp) => sp.lin || /^desert_hawk/.test([].concat(sp.mon)[0] || '')));
  ok('雑魚の合体技は 15〜26 個', regular.length >= 15 && regular.length <= 26, regular.length);
  ok('序盤（tierMin なし・0）は 3〜4 個だけ、ティア 3 から増える', regular.filter((id) => !DB.enemyCombos[id].tierMin).length <= 4 && regular.filter((id) => (DB.enemyCombos[id].tierMin || 0) >= 3).length >= 8);
}
{
  // 出現表に仲間の組が実際にある（少なくとも 1 つの表のどれかの組で全員そろう）
  const groupsOf = [];
  for (const [z, t] of Object.entries(DB.encounters)) for (const g of t.groups || []) groupsOf.push(g.mons.map((m) => ({ ref: m[0], max: m[2] })));
  // ボスの合体技は編成（troops）でそろう
  for (const t of Object.values(DB.troops)) if (t.mons) groupsOf.push(t.mons.map((m) => (Array.isArray(m) ? { ref: m[0], max: m[1] != null ? m[1] : 1 } : { ref: m, max: 1 })));
  const linOf = (ref) => (ref[0] === '@' ? ref.slice(1) : (DB.monsters[ref] || {}).lineage);
  // 戦闘の中で呼ばれる魔物（summon の mon）は、編成に無くてもそろう
  const summoned = new Set();
  for (const t of [DB.enemyActions, DB.bossActions || {}]) for (const a of Object.values(t)) for (const e of a.effects || []) if (e.type === 'summon' && e.mon) summoned.add(e.mon);
  const missing = [];
  for (const [id, C] of Object.entries(DB.enemyCombos)) {
    if (!(C.members || []).every((sp) => sp.lin || sp.mon)) continue;
    const okAny = groupsOf.some((g) => (C.members || []).every((sp) => {
      const need = sp.n || 1;
      if (sp.mon && [].concat(sp.mon).every((m) => summoned.has(m))) return true;
      const have = g.filter((x) => (sp.lin ? [].concat(sp.lin).includes(linOf(x.ref)) : [].concat(sp.mon).includes(x.ref))).reduce((s, x) => s + x.max, 0);
      return have >= need;
    }));
    if (!okAny) missing.push(id);
  }
  ok('どの合体技も出現表の組でそろう', !missing.length, missing);
}
{
  const langs = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];
  const tbl = R.I18n && R.I18n.tables ? R.I18n.tables : null;
  const keys = [];
  for (const id of Object.keys(DB.enemyCombos)) keys.push('enemyCombos.' + id + '.name');
  for (const id of Object.keys(DB.enemyActions)) if (/^ec_|^e_(guard_stance|snipe|ambush|finish|weaken|armor_melt|war_dance|last_stand|elem_shift)$/.test(id)) keys.push('enemyActions.' + id + '.name', 'enemyActions.' + id + '.msg');
  keys.push('sys.battle_core.combo.m', 'sys.battle_core.combo.join', 'sys.battle_core.combo.merge', 'sys.battle_core.elem_shift.m', 'battle.playback.combo.head', 'battle.playback.combo.sub', 'monsters.jelly_big.name', 'monsters.jelly_big.desc');
  const miss = [];
  for (const lang of langs) for (const k of keys) if (!(R.I18n.has ? R.I18n.has(k, lang) : (tbl && tbl[lang] && tbl[lang][k] != null))) miss.push(lang + ':' + k);
  ok(`文 ${keys.length} 個 × 5 言語`, !miss.length, miss.slice(0, 10));
}
{
  // sim: 合体技が出ても全滅しない（森・ティア 0 の群れ狩りとゼリー合体）
  let combos = 0, lose = 0;
  for (let i = 0; i < 150; i++) {
    const s = BC.simulate({ party: SZ.buildParty(R, { tier: 0, kind: 'party', members: SZ.STD, seed: 7 }), zone: 'z_verda', tier: 0, seed: 'tc:' + i, maxRounds: 30 });
    combos += s.combos || 0; if (s.result === 'lose') lose++;
  }
  ok('ヴェルダの森（ティア 0）: 合体技が出て、全滅しない', combos > 0 && lose === 0, { combos, lose });
}
done('test_combo');
