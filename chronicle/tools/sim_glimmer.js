#!/usr/bin/env node
// 閃きの頻度のシミュレーター（担当 A8。DESIGN §4.9.5・§7.12.2・§6.9.4・§12.3 の G）。
//
//   node tools/sim_glimmer.js [--runs 24] [--seed 1] [--rules auto|shim|real] [--json out.json] [-q]
//                             [--acts 3] [--boss-acts 9] [--k fkSlope=0.6,fkMax=6] [--no-engine] [--catchup-only]
//     --acts / --boss-acts  1 戦の 1 人の行動の数（感度を見る用）  --k  K.GLIM をこの sandbox の中だけで変えて比べる
//     --no-engine           本物の戦闘エンジン（R.Battle.simulate）での確かめ（参考の節）を飛ばす
//
// 閃きの判定・候補・確率・習得は R.Glimmer の本物の関数、熟練度の加算は R.Rules.train（新しい rules が無ければ
// harness の §4.9.1 の写し）を使う。戦闘の中身（ダメージ・勝敗）は使わず、行動の配分だけをモデルにする。
//
// モデル（§4.9.5 の注: 1 地方 95 戦＋ボス 2、4 人、1 戦に 1 人 3 回の行動、ボス戦は 9 回）:
//   序章   T0: 主人公 1 人で 2 戦 → 酒場で 3 人 → チュートリアル（主人公 1 人・glimmerForce）→ 33 戦 → ボス（Tb 0）
//   地方   T0〜T7 の 8 つ: 95 戦（金色 1/40・めずらしい魔物 1/80）＋ 中ボス・地方ボス（Tb = T）、T2・T5 にライバル戦
//   終盤   T8: 60 戦 ＋ ボス 5（Tb 8）                     クリア後 T9: 忘却の底 50 戦（§6.9.4 の極意）
//   rank（§4.9.2）= Tb + 1、ボス +2・めずらしい魔物 +2・金色 +1。EF はボス 2.5・めずらしい魔物 2・金色 1.5。ctx.tier = その時のティア。
//   行動: 武器は枠の配分（主な武器 62%・2 つ目 30%・残りは防御など）、雑魚は 25%・ボスは 60% を覚えた技で（残りは「攻撃」）。
//   術師（§4.9.5 の型 G4b）: 杖だけ・念じ打ち（starterKit.tech.staff）で始める。武器の行動は 92%（戦士と同じ。残りは防御・道具）。
//   術師: 雑魚戦で 1 戦に casts 回（§4.13.2-d: 候補の開いている属性の一番安い術）、ボス戦は行動の 65% を術（一番格の高い術）。
//   術師の 2・3 つ目の属性は、魔石（§4.9.6。1 戦に 1 個）で最初の術を閃くまで始める。中列では届かない武器の「攻撃」はしない。
// 判定（PASS/FAIL、exit 1）は §4.9.5 の表と §6.9.4 の極意。§7.12.2 の追加の項目（X1・X2）と参考の型（G4c・G4d）は目安（warn）。
// エンジンがあれば、モデルの通しの「地方 T の直前」の状態の標準のパーティで、T の雑魚 95 戦を R.Battle.simulate（オート）で戦い、
// モデルの同じ 95 戦の閃きの数と比べる（参考。判定には使わない）。
'use strict';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const RUNS = +opt('runs', 24), SEED = +opt('seed', 1), QUIET = args.includes('-q');
const ZAKO_ACTS = +opt('acts', 3), BOSS_ACTS = +opt('boss-acts', 9);   // 1 戦の 1 人の行動の数（§4.9.5 のモデル: 雑魚 3・ボス 9）
const JSON_OUT = opt('json', null);
const H = require('./fixtures/spells/lib/harness')({ rules: opt('rules', 'auto') });
const R = H.R, DB = R.DB, G = R.Glimmer, U = R.U;
// --k fkMax=5,fkSlope=0.5 … R.Rules.K.GLIM をこの sandbox の中だけで変えて比べる（調整の検討用）
if (opt('k', null)) {
  for (const kv of opt('k').split(',')) { const [k, v] = kv.split('='); R.Rules.K.GLIM[k] = +v; }
  R.Glimmer.reindex();
}
const t0 = Date.now();

const log = (...a) => { if (!QUIET) console.log(...a); };
const results = [];
function crit(id, label, value, ok, detail, guide) {
  results.push({ id, label, value, ok, detail, guide: !!guide });
  const tag = guide ? (ok ? 'ok  ' : 'warn') : (ok ? 'PASS' : 'FAIL');
  console.log(`${tag}  ${id.padEnd(5)} ${label}: ${value}${detail ? '  (' + detail + (guide ? '・目安' : '') + ')' : ''}`);
}
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const median = (a) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const pctile = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), f2 = (x) => x.toFixed(2);

const TECHS = {};
for (const id in DB.actions) { const a = DB.actions[id]; if (a.kind === 'tech') (TECHS[a.wtype] = TECHS[a.wtype] || []).push(id); }
const K = R.Rules.K;
const PEXP = K.PEXP || [15, 40, 70, 100, 135, 175, 220, 270, 330, 400];

// ---------------------------------------------------------------- 人の作り方
function simChar(id, base, patch) {
  H.defineSimChar(id, base, {});
  const d = DB.companions[id];
  if (patch.stats) Object.assign(d.stats, patch.stats);
  if (patch.w) Object.assign(d.apt.w, patch.w);
  if (patch.e) Object.assign(d.apt.e, patch.e);
  return id;
}
// §4.9.5 の型（シミュレーター専用の仮の仲間。sandbox の DB にだけ足す）
simChar('_sim_warrior', 'selma', { stats: { str: 50, vit: 44, dex: 30, agi: 28, int: 18, mnd: 30 }, w: { sword: 'A', axe: 'B' } });
simChar('_sim_mage', 'teo', { stats: { str: 18, vit: 24, dex: 30, agi: 34, int: 52, mnd: 42 },
  w: { staff: 'A', whip: 'B' }, e: { fire: 'A', water: 'C', wind: 'A', earth: 'B', light: 'C', dark: 'C' } });
for (const L of ['S', 'A', 'B', 'C', 'D']) simChar('_sim_one_' + L, 'selma', { stats: { str: 50, vit: 44, dex: 30, agi: 28, int: 18, mnd: 30 }, w: { sword: L } });
for (const L of ['S', 'A', 'B', 'C', 'D']) simChar('_sim_stone_' + L, 'selma', { stats: { str: 34, vit: 34, dex: 34, agi: 33, int: 30, mnd: 32 }, e: { light: L } });
simChar('_sim_recruit', 'hagen', { stats: { str: 50, vit: 44, dex: 30, agi: 28, int: 18, mnd: 30 }, w: { greatsword: 'B', axe: 'B' } });

const W = (slot, w, share) => ({ slot, w, share });
const PROFILES = {
  hero: { weapons: [W('weapon1', 'sword', 0.62), W('weapon2', 'axe', 0.30)], row: 'front' },
  brigitta: { weapons: [W('weapon1', 'spear', 0.62), W('weapon2', 'bow', 0.30)], row: 'middle' },
  sylvain: { weapons: [W('weapon1', 'bow', 0.62), W('weapon2', 'dagger', 0.30)], row: 'middle' },
  marta: { weapons: [W('weapon1', 'staff', 0.5), W('weapon2', 'whip', 0.5)], row: 'middle', elements: ['water', 'light', 'wind'], casts: 0.9, bossSpell: 0.7, stones: true },
  warrior: { weapons: [W('weapon1', 'sword', 0.62), W('weapon2', 'axe', 0.30)], row: 'front' },
  mage: { weapons: [W('weapon1', 'staff', 0.6), W('weapon2', 'whip', 0.4)], row: 'middle', elements: ['fire', 'wind', 'earth'], casts: 0.75, bossSpell: 0.65, stones: true },
  one: { weapons: [W('weapon1', 'sword', 0.92)], row: 'front' },
  recruit: { weapons: [W('weapon1', 'greatsword', 0.65), W('weapon2', 'axe', 0.35)], row: 'front' },   // 候補の開いている人は「攻撃」（§4.13.2-d）
};
const TECH_USE = { zako: 0.25, boss: 0.6 };

function member(key, charSpec, prof, over) {
  const c = H.makeChar(charSpec);
  const p = Object.assign({}, PROFILES[prof], over || {});
  c.row = p.row;
  return { key, c, p, hero: c.id === 'hero', learnedAt: [], forcedDone: false };
}

// ---------------------------------------------------------------- 行動のモデル
function usableTech(c, id, row) { const a = DB.actions[id]; return a && (row !== 'middle' || a.reach); }
function knownTechs(c, w, row) { return (c.techs || []).filter((id) => DB.actions[id] && DB.actions[id].wtype === w && usableTech(c, id, row)); }
function weaponAction(m, boss) {
  const { c, p } = m;
  const reachOf = (w) => !!(DB.weaponTypes[w] && DB.weaponTypes[w].reach);
  const tot = p.weapons.reduce((s, x) => s + x.share, 0);
  let r = U.r() * Math.max(1, tot), pick = null;
  for (const x of p.weapons) { r -= x.share; if (r < 0) { pick = x; break; } }
  if (!pick) return null;                                   // 防御・道具など（判定なし）
  const useTech = U.r() < (boss ? TECH_USE.boss : TECH_USE.zako);
  const tryWeapon = (x, tech) => {
    const kts = knownTechs(c, x.w, p.row);
    const canAttack = p.row !== 'middle' || reachOf(x.w);
    if (tech && kts.length) {
      let id;
      if (boss) { kts.sort((a, b) => DB.actions[b].glim.lv - DB.actions[a].glim.lv); id = U.r() < 0.7 ? kts[0] : kts[Math.floor(U.r() * kts.length)]; }
      else id = kts[Math.floor(U.r() * kts.length)];
      return { kind: 'tech', wtype: x.w, slot: x.slot, used: id, actionId: id };
    }
    if (canAttack) return { kind: 'attack', wtype: x.w, slot: x.slot, used: 'attack', actionId: 'attack' };
    return null;
  };
  // 中列で届かない武器は、技を使うときだけ使う。そうでなければ届く武器の「攻撃」に替える（§4.13.2 の「届かなければ武器2」）
  return tryWeapon(pick, useTech) || p.weapons.map((x) => tryWeapon(x, false)).find(Boolean) || p.weapons.map((x) => tryWeapon(x, true)).find(Boolean) || null;
}
function spellsWith(c, e) { return (c.spells || []).filter((id) => DB.actions[id] && DB.actions[id].elements.includes(e)); }
function spellAction(m, b, boss) {
  const { c, p } = m;
  const els = (p.elements || []).filter((e) => spellsWith(c, e).length);
  if (!els.length) return null;
  let e;
  if (!boss) {
    const open = els.filter((x) => G.candidates(c, { kind: 'spell', elements: [x], rankB: b.rankB, ef: b.ef, tier: b.T, row: p.row, silenced: false }).length > 0);
    const pool = open.length ? open : els;
    e = pool[Math.floor(U.r() * pool.length)];
    const list = spellsWith(c, e).sort((x, y) => DB.actions[x].mp - DB.actions[y].mp || DB.actions[x].order - DB.actions[y].order);
    const id = list[0];
    return { kind: 'spell', elements: DB.actions[id].elements, used: id, actionId: id };
  }
  e = els[Math.floor(U.r() * els.length)];
  const list = spellsWith(c, e).sort((x, y) => DB.actions[y].glim.lv - DB.actions[x].glim.lv);
  const id = U.r() < 0.7 ? list[0] : list[Math.floor(U.r() * list.length)];
  return { kind: 'spell', elements: DB.actions[id].elements, used: id, actionId: id };
}
function stoneAction(m) {
  const { c, p } = m;
  if (!p.stones) return null;
  const miss = (p.elements || []).filter((e) => !spellsWith(c, e).length);
  if (!miss.length) return null;
  const e = miss[0];
  return { kind: 'spell', elements: [e], used: 'i_stone_' + e, stone: true, actionId: 'i_stone_' + e };
}
function planBattle(m, b) {
  const n = b.boss ? BOSS_ACTS : ZAKO_ACTS;
  const acts = [];
  const { p } = m;
  let casts = 0;
  if (p.elements) {
    if (b.boss) { for (let i = 0; i < n; i++) if (U.r() < p.bossSpell) casts++; }
    else casts = Math.floor(p.casts) + (U.r() < p.casts - Math.floor(p.casts) ? 1 : 0);
  }
  for (let i = 0; i < n; i++) {
    let a = null;
    if (i === 0 && !b.boss) a = stoneAction(m);
    if (!a && i < casts + (acts.length && acts[0] && acts[0].stone ? 1 : 0)) a = spellAction(m, b, b.boss);
    if (!a) a = weaponAction(m, b.boss);
    acts.push(a);
  }
  return acts;
}

function doAction(m, b, act, stats) {
  const { c, p } = m;
  if (!act) return null;
  const ctx = {
    kind: act.kind === 'attack' ? 'tech' : act.kind, wtype: act.wtype, elements: act.elements, used: act.used, stone: !!act.stone,
    rankB: b.rankB, ef: b.ef, tier: b.T, row: p.row, silenced: false,
  };
  if (b.force && m.hero && !m.forcedDone) { ctx.force = true; m.forcedDone = true; ctx.fallbackWtype = p.weapons[0].w; }
  const res = G.roll(c, ctx);
  let done = act;
  if (res) {
    G.learn(c, res.id, { record: false });
    m.learnedAt.push({ id: res.id, phase: b.phase, T: b.T, boss: !!b.boss, n: b.n });
    const a = DB.actions[res.id];
    done = a.kind === 'tech' ? { kind: 'tech', wtype: a.wtype, actionId: res.id } : { kind: 'spell', elements: a.elements, actionId: res.id };
    if (stats) stats.glim++;
  }
  const info = done.stone ? { kind: 'item', stone: true, elements: done.elements, actionId: done.actionId, tier: b.T }
    : { kind: done.kind, wtype: done.wtype, slot: done.slot, elements: done.elements, actionId: done.actionId === 'attack' ? null : done.actionId, tier: b.T };
  R.Rules.train(c, info);
  return res;
}
function battle(party, b) {
  if (R.Game) { R.Game.tier = Math.min(8, b.T); R.Game.gameClear = b.T >= 9; }
  let glim = 0;
  const st = { glim: 0 };
  for (const m of party) {
    if (b.only && !b.only.includes(m.key)) continue;
    for (const act of planBattle(m, b)) doAction(m, b, act, st);
  }
  glim = st.glim;
  return glim;
}
function zakoBattle(T, Tb, phase, n, noRare) {
  const b = { T, Tb, phase, n, rankB: Tb + 1, ef: 1 };
  if (!noRare) {
    const r = U.r();
    if (r < 1 / 80) { b.rankB = Tb + 3; b.ef = 2; b.rare = true; }
    else if (r < 1 / 80 + 1 / 40) { b.rankB = Tb + 2; b.ef = 1.5; b.golden = true; }
  }
  return b;
}
const bossBattle = (T, Tb, phase, n) => ({ T, Tb, phase, n, boss: true, rankB: Tb + 3, ef: 2.5 });

// ---------------------------------------------------------------- 1 回の通し
function career(party, o) {
  o = o || {};
  const rec = { phase: {}, zako: {}, boss: [], snap: {} };
  const count = (ph, g, zako) => { rec.phase[ph] = (rec.phase[ph] || 0) + g; if (zako) rec.zako[ph] = (rec.zako[ph] || 0) + g; };
  const snap = (name) => { rec.snap[name] = party.map((m) => ({ key: m.key, techs: m.c.techs.slice(), spells: m.c.spells.slice(), wprof: Object.assign({}, m.c.wprof), eprof: Object.assign({}, m.c.eprof) })); };
  R.Game = { tier: 0, gameClear: false, flags: {}, book: { mon: {}, tech: {}, spell: {} }, records: {} };
  const heroKey = party.find((m) => m.hero) ? party.find((m) => m.hero).key : party[0].key;
  // 序章
  let n = 0;
  for (let i = 0; i < 2; i++) count('prologue', battle(party, Object.assign(zakoBattle(0, 0, 'prologue', n++, true), { only: [heroKey] })));
  count('prologue', battle(party, { T: 0, Tb: 0, phase: 'prologue', n: n++, rankB: 1, ef: 1, force: true, only: [heroKey], tutorial: true }));
  for (let i = 0; i < 33; i++) count('prologue', battle(party, zakoBattle(0, 0, 'prologue', n++, true)));
  { const g = battle(party, bossBattle(0, 0, 'prologue', n++)); count('prologue', g); rec.boss.push({ T: 0, g }); }
  snap('prologue');
  // 地方 T0..T7
  for (let T = 0; T <= 7; T++) {
    const ph = 'r' + T;
    const bosses = [95 * 0.55 | 0, 95];
    for (let i = 0; i < 95; i++) {
      count(ph, battle(party, zakoBattle(T, T, ph, n++)), true);
      if (i + 1 === bosses[0]) { const g = battle(party, bossBattle(T, T, ph, n++)); count(ph, g); rec.boss.push({ T, g }); }
      if ((T === 2 || T === 5) && i === 70) { const g = battle(party, bossBattle(T, T, ph, n++)); count(ph, g); rec.boss.push({ T, g, rival: true }); }
    }
    const g = battle(party, bossBattle(T, T, ph, n++)); count(ph, g); rec.boss.push({ T, g });
    snap(ph);
  }
  // 終盤 T8
  for (let i = 0; i < 60; i++) {
    count('final', battle(party, zakoBattle(8, 8, 'final', n++)));
    if (i === 15 || i === 35 || i === 50) { const g = battle(party, bossBattle(8, 8, 'final', n++)); count('final', g); rec.boss.push({ T: 8, g }); }
  }
  for (let k = 0; k < 2; k++) { const g = battle(party, bossBattle(8, 8, 'final', n++)); count('final', g); rec.boss.push({ T: 8, g }); }
  snap('clear');
  if (o.post) {
    for (let i = 0; i < 50; i++) count('post', battle(party, zakoBattle(9, 9, 'post', n++)));
    snap('post');
  }
  return rec;
}

function standardParty() {
  return [
    member('hero', { heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, techs: ['t_sword_stepcut'] }, 'hero'),
    member('brigitta', { id: 'brigitta', techs: DB.companions.brigitta.startTechs, spells: DB.companions.brigitta.startSpells }, 'brigitta'),
    member('marta', { id: 'marta', techs: DB.companions.marta.startTechs, spells: DB.companions.marta.startSpells }, 'marta'),
    member('sylvain', { id: 'sylvain', techs: DB.companions.sylvain.startTechs, spells: DB.companions.sylvain.startSpells }, 'sylvain'),
  ];
}
function archetypeParty(o) {
  o = o || {};
  const mageTechs = o.staffStart ? ['t_staff_mind'] : [];
  return [
    member('hero', { heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, techs: ['t_sword_stepcut'] }, 'hero'),
    member('warrior', { id: '_sim_warrior', techs: ['t_sword_stepcut'] }, 'warrior'),
    member('mage', { id: '_sim_mage', spells: ['s_fire_1'], techs: mageTechs }, 'mage',
      Object.assign({}, o.mageRow ? { row: o.mageRow } : {}, o.staffOnly ? { weapons: [W('weapon1', 'staff', 0.92)] } : {})),
    member('mage15', { id: '_sim_mage', spells: ['s_fire_1'], techs: mageTechs }, 'mage', Object.assign({ casts: 1.5 }, o.mageRow ? { row: o.mageRow } : {})),
  ];
}

// ---------------------------------------------------------------- 実行
console.log(`sim_glimmer: runs=${RUNS} seed=${SEED} rules=${H.info.rules}${H.info.specData.length ? ' specData=' + H.info.specData.join(',') : ''}`);
U.seed(SEED);

const lv19 = (id) => DB.actions[id] && DB.actions[id].glim.lv <= 9;
const cls = (id) => { const a = DB.actions[id]; return a.kind === 'tech' ? 'tech' : a.cls; };
// §6.9.4: §4.9.5 の閃きの目標は技の lv 1〜9（110 個）で数える。lv 10（極意）は本編の目標の外なので数えない（secret に別に数える）。
function countBy(snap, key) {
  const s = snap.find((x) => x.key === key);
  const techs = s.techs.filter(lv19);
  const out = { total: techs.length + s.spells.length, techs: techs.length, spells: s.spells.length, secret: s.techs.length - techs.length, byW: {}, single: 0, comboA: 0, comboB: 0, triple: 0 };
  for (const id of techs) { const w = DB.actions[id].wtype; out.byW[w] = (out.byW[w] || 0) + 1; }
  for (const id of s.spells) out[cls(id)]++;
  return out;
}

if (args.includes('--catchup-only')) {   // G7 だけを速く見る（--k と組み合わせて K.GLIM の感度を見る）
  const x = catchUp();
  console.log(`G7 追いつき: 5 個 ${median(x.to5)} 戦・7 個 ${median(x.to7)} 戦（中央値）`);
  return;
}
// A. 標準のパーティ（§4.17.1）: 序章・地方ごと・ボス戦・技の書と術の書・クリア後の極意
const stdRecs = [];
for (let r = 0; r < RUNS; r++) {
  const party = standardParty();
  const rec = career(party, { post: true });
  rec.party = party;
  stdRecs.push(rec);
}
log('\n## 標準のパーティ（主人公 戦士・剣 S ＋ ブリギッタ・マルタ・シルヴァン）');
const prol = stdRecs.map((r) => r.phase.prologue || 0);
log(`序章の閃き（パーティ）: 平均 ${f1(mean(prol))}、中央値 ${median(prol)}、最小 ${Math.min(...prol)}`);
const perT = [];
for (let T = 0; T <= 7; T++) perT.push(mean(stdRecs.map((r) => r.phase['r' + T] || 0)));
log('地方ごとの閃き（パーティ・平均）: ' + perT.map((x, T) => `T${T} ${f1(x)}`).join('  '));
log(`終盤 T8: ${f1(mean(stdRecs.map((r) => r.phase.final || 0)))}   クリア後 50 戦: ${f1(mean(stdRecs.map((r) => r.phase.post || 0)))}`);
const allRegion = [];
for (const r of stdRecs) for (let T = 0; T <= 7; T++) allRegion.push(r.phase['r' + T] || 0);
const bossT1 = [];
for (const r of stdRecs) for (const b of r.boss) if (b.T >= 1) bossT1.push(b.g > 0 ? 1 : 0);
const bossByT = [];
for (let T = 0; T <= 8; T++) { const x = []; for (const r of stdRecs) for (const b of r.boss) if (b.T === T) x.push(b.g > 0 ? 1 : 0); bossByT.push(mean(x)); }
log('ボス戦で誰かが閃く確率: ' + bossByT.map((x, T) => `T${T} ${Math.round(x * 100)}%`).join('  '));
for (const key of ['hero', 'brigitta', 'marta', 'sylvain']) {
  const cs = stdRecs.map((r) => countBy(r.snap.clear, key));
  const byW = {};
  for (const c of cs) for (const w in c.byW) byW[w] = (byW[w] || 0) + c.byW[w] / cs.length;
  log(`  クリア時 ${key.padEnd(8)} 計 ${f1(mean(cs.map((c) => c.total)))}  技 ${f1(mean(cs.map((c) => c.techs)))}（${Object.entries(byW).map(([w, v]) => w + ' ' + f1(v)).join('・')}）  術 ${f1(mean(cs.map((c) => c.spells)))}（単 ${f1(mean(cs.map((c) => c.single)))}・A ${f1(mean(cs.map((c) => c.comboA)))}・B ${f1(mean(cs.map((c) => c.comboB)))}・三 ${f1(mean(cs.map((c) => c.triple)))}）`);
}
const bookT = [], bookS = [];
for (const r of stdRecs) {
  const t = new Set(), s = new Set();
  for (const x of r.snap.clear) { for (const id of x.techs) if (lv19(id)) t.add(id); for (const id of x.spells) s.add(id); }
  bookT.push(t.size / 110); bookS.push(s.size / 77);
}
log(`技の書（lv1〜9 の 110）: ${Math.round(mean(bookT) * 100)}%   術の書（77）: ${Math.round(mean(bookS) * 100)}%`);
// §6.9.4: クリア後 50 戦で、主な武器（段階 9 以上）の極意を閃く人が 1 人以上
const MAINW = { hero: 'sword', brigitta: 'spear', sylvain: 'bow' };
const lv10Of = (w) => TECHS[w].find((id) => DB.actions[id].glim.lv === 10);
// クリア後 50 戦の終わりに、主な武器の極意を持っている人が 1 人以上（終盤のボス戦で閃いた人も含む。§6.4.2）
const secretHit = stdRecs.map((r) => (Object.keys(MAINW).some((k) => r.snap.post.find((x) => x.key === k).techs.includes(lv10Of(MAINW[k]))) ? 1 : 0));
const secretAtClear = mean(stdRecs.map((r) => Object.keys(MAINW).filter((k) => r.snap.clear.find((x) => x.key === k).techs.includes(lv10Of(MAINW[k]))).length));
const secretPost = mean(stdRecs.map((r) => Object.keys(MAINW).filter((k) => r.snap.post.find((x) => x.key === k).techs.includes(lv10Of(MAINW[k]))).length));
const rank9 = mean(stdRecs.map((r) => Object.keys(MAINW).filter((k) => R.Rules.profRank(r.snap.clear.find((x) => x.key === k).wprof[MAINW[k]]) >= 9).length));

// B. §4.9.5 の型（戦士型 A/B・術師型 A/A/B を 0.75 回と 1.5 回）
function archRuns(o, only) {
  const recs = [];
    for (let r = 0; r < RUNS; r++) {
    let party = archetypeParty(o);
    if (only) party = party.filter((m) => only.includes(m.key));
    const rec = career(party, { post: true }); rec.party = party; recs.push(rec);
  }
  return recs;
}
const arch = archRuns({});                                               // 仲間の術師のいまの形（杖＋鞭、杖の技なし。§5.0 の 0.9）と 1.5 回の術師
const archSpec = archRuns({ staffStart: true, staffOnly: true }, ['mage']); // §4.9.5 の型: 杖で戦う術師（念じ打ち = starterKit.tech.staff から）
const archFix = archRuns({ staffStart: true }, ['mage']);                 // 杖＋鞭で念じ打ちを持って始める
function archSummary(recs, key, label) {
  const cs = recs.map((r) => countBy(r.snap.clear, key));
  const byW = {};
  for (const c of cs) for (const w in c.byW) byW[w] = (byW[w] || 0) + c.byW[w] / cs.length;
  log(`  ${label.padEnd(26)} 計 ${f1(mean(cs.map((c) => c.total)))}  技 ${f1(mean(cs.map((c) => c.techs)))}（${Object.entries(byW).map(([w, v]) => w + ' ' + f1(v)).join('・')}）  術 ${f1(mean(cs.map((c) => c.spells)))}（単 ${f1(mean(cs.map((c) => c.single)))}・A ${f1(mean(cs.map((c) => c.comboA)))}・B ${f1(mean(cs.map((c) => c.comboB)))}・三 ${f1(mean(cs.map((c) => c.triple)))}）`);
  return { cs, byW };
}
log('\n## §4.9.5 の型（クリア時）');
const aw = archSummary(arch, 'warrior', '戦士型（剣 A・斧 B）');
const amSpec = archSummary(archSpec, 'mage', '術師型 杖・念じ打ち（0.75 回）');
const am = archSummary(arch, 'mage', '仲間の術師 杖＋鞭・杖の技なし');
const am2 = archSummary(archFix, 'mage', '杖＋鞭・念じ打ちあり');
const am15 = archSummary(arch, 'mage15', '術師型 中列（1.5 回）');
function firstTier(recs, key, pred) {
  return recs.map((r) => { const m = r.party.find((x) => x.key === key); const e = m.learnedAt.find((x) => pred(x.id) && x.phase !== 'post'); return e ? e.T : 99; });
}
const fA = firstTier(arch, 'mage15', (id) => DB.actions[id].cls === 'comboA');
const fT = firstTier(arch, 'mage15', (id) => DB.actions[id].cls === 'triple');
const postTriples = arch.map((r) => countBy(r.snap.post, 'mage15').triple);
log(`  術師型（1.5 回）: 合成A を最初に閃くティア 中央値 T${median(fA)}（${f1(mean(fA.filter((x) => x < 99)))}）、3属性 中央値 ${median(fT) >= 99 ? 'なし' : 'T' + median(fT)}（本編で閃いた ${Math.round(mean(fT.map((x) => x < 99 ? 1 : 0)) * 100)}%）、クリア後 50 戦の後の 3属性 ${f1(mean(postTriples))}`);

// C. 得手不得手の差（1 系統だけ、T4 の終わり）
function oneWeapon(L) {
  const xs = [];
  for (let r = 0; r < 200; r++) {
    const m = member('one', { id: '_sim_one_' + L, techs: ['t_sword_stepcut'] }, 'one');
    const party = [m];
    R.Game = { tier: 0, gameClear: false };
    let n = 0;
    for (let i = 0; i < 35; i++) battle(party, zakoBattle(0, 0, 'p', n++, true));
    battle(party, bossBattle(0, 0, 'p', n++));
    for (let T = 0; T <= 4; T++) { for (let i = 0; i < 95; i++) battle(party, zakoBattle(T, T, 'r', n++)); battle(party, bossBattle(T, T, 'r', n++)); battle(party, bossBattle(T, T, 'r', n++)); }
    xs.push(m.c.techs.length);
  }
  return xs;
}
const one = {};
for (const L of ['S', 'A', 'B', 'C', 'D']) one[L] = mean(oneWeapon(L));
log('\n## 1 系統だけを使う人の T4 の終わりの技の数: ' + Object.entries(one).map(([L, v]) => `${L} ${f1(v)}`).join('  '));

// D. 知力の差（T8、1 回の判定の確率）
const pInt = [0, 60, 180].map((add) => {
  const c = H.makeChar({ id: '_sim_mage', add: { int: add } });
  c.spells = Object.keys(DB.actions).filter((k) => k.startsWith('s_') && DB.actions[k].elements.every((e) => e !== 'fire')).slice(0, 17);
  return G.chance(c, 's_fire_5', { kind: 'spell', elements: ['fire'], rankB: 9, ef: 1, tier: 8 });
});
log(`\n## 知力の差（T8・火 A・格 7 の候補）: 知力 52 ${(pInt[0] * 100).toFixed(2)}%  112 ${(pInt[1] * 100).toFixed(2)}%  232 ${(pInt[2] * 100).toFixed(2)}%`);

// E. 入れ替えた仲間の追いつき（T4 で技も術も 0、武器 2 系統 B）
function catchUp() {
  const to5 = [], to7 = [];
for (let r = 0; r < 400; r++) {
  // 器用さは T4 の装備の分を足す（§4.9.4 の例の「ティア 4 … 器用さ 49」と同じ条件）
  const m = member('recruit', { id: '_sim_recruit', techs: [], add: { dex: 19 } }, 'recruit');
  if (typeof R.Rules.catchUpProf === 'function') R.Rules.catchUpProf(m.c, 4);
  else for (const w of H.WT) m.c.wprof[w] = Math.max(m.c.wprof[w] || 0, Math.round(PEXP[4] * ({ S: 0.8, A: 0.7, B: 0.5, C: 0.3, D: 0.1 })[R.Rules.aptLetter ? R.Rules.aptLetter(m.c, 'w', w) : 'B']));
  m.c.techs = []; m.c.spells = [];
  R.Game = { tier: 4, gameClear: false };
  let n5 = null, n7 = null;
  // 地方 T4 のどこで加わるかは一様（career と同じく 95 戦の 52 戦目の後に中ボス、95 戦目の後に地方ボス。ボス戦も 1 戦と数える）
  const REG = 95, MID = REG * 0.55 | 0;
  let pos = Math.floor(U.r() * REG), pend = 0;
  for (let i = 1; i <= 200 && n7 == null; i++) {
    if (pend) { battle([m], bossBattle(4, 4, 'r4', i)); pend--; }
    else { battle([m], zakoBattle(4, 4, 'r4', i)); pos++; if (pos % REG === MID || pos % REG === 0) pend = 1; }
    const k = m.c.techs.length + m.c.spells.length;
    if (n5 == null && k >= 5) n5 = i;
    if (n7 == null && k >= 7) n7 = i;
  }
  to5.push(n5 == null ? 999 : n5); to7.push(n7 == null ? 999 : n7);
}
  return { to5, to7 };
}
const { to5, to7 } = catchUp();
log(`\n## 入れ替えた仲間（T4・0 個・武器 2 系統 B）: 5 個まで 中央値 ${median(to5)} 戦、7 個まで 中央値 ${median(to7)} 戦`);

// F. 魔石の入口（術 0 の人が魔石を使い続ける。T0 の普通の戦闘・覚えている技 1）
const stones = {};
for (const L of ['S', 'A', 'B', 'C', 'D']) {
  const xs = [];
  for (let r = 0; r < 2000; r++) {
    const c = H.makeChar({ id: '_sim_stone_' + L, techs: ['t_sword_stepcut'] });
    let k = 0;
    while (k < 200) {
      k++;
      const res = G.roll(c, { kind: 'spell', elements: ['light'], used: 'i_stone_light', stone: true, rankB: 1, ef: 1, tier: 0, row: 'front', silenced: false });
      R.Rules.train(c, { kind: 'item', stone: true, elements: ['light'], tier: 0 });
      if (res) break;
    }
    xs.push(k);
  }
  // 1 個あたりの確率は熟練度に左右されない（1段の術は熟練 0・格 1）ので、中央値は p から決まる（抽選の揺れを除いた値）
  const c0 = H.makeChar({ id: '_sim_stone_' + L, techs: ['t_sword_stepcut'] });
  const p0 = G.chance(c0, 's_light_1', { kind: 'spell', elements: ['light'], used: 'i_stone_light', stone: true, rankB: 1, ef: 1, tier: 0, row: 'front', silenced: false });
  stones[L] = { median: median(xs), mean: mean(xs), p: p0, exact: Math.ceil(Math.log(0.5) / Math.log(1 - p0)) };
}
log('\n## 魔石で最初の術を閃くまでの個数（光・T0）: ' + Object.entries(stones).map(([L, v]) => `${L} 1 個 ${(v.p * 100).toFixed(1)}%・中央値 ${v.exact}（抽選 ${v.median}）・平均 ${f1(v.mean)}`).join('  '));

// G. 本物の戦闘エンジン（R.Battle.simulate・オート）での確かめ（参考。エンジンがあるときだけ）
//    PM.standard の標準のパーティ（その T の想定の数を覚えた状態）で、T のゾーンの雑魚戦 95 回を続けて戦い、閃きを数える。
const engineCheck = [];
{
  let ready = false;
  try { ready = !!(R.Battle && R.Battle.simulate && /Glimmer/.test(String(R.Battle.Engine))); } catch (e) { ready = false; }
  if (ready && !args.includes('--no-engine')) {
    const PM = require('./lib/party_model');
    const zones = Object.keys(DB.encounters || {}).filter((z) => DB.encounters[z].tier === 'dyn');
    const REP = Math.min(4, stdRecs.length);
    for (const T of [1, 3, 5, 7]) {
      let glim = 0, casts = 0, techUse = 0, weaponActs = 0, n = 0, rolls = 0;
      const k0 = [], k1 = [];
      for (let rep = 0; rep < REP; rep++) {
        const P0 = PM.standard(R, T, {});
        const party = P0.party;
        // 覚えている技・術と熟練度は、モデルの通しの「地方 T の直前」の状態を写す（装備は PM の T の一式）
        const snap = stdRecs[rep].snap[T === 0 ? 'prologue' : 'r' + (T - 1)];
        for (const c of party) {
          const x = snap.find((y) => y.key === (c.id === 'hero' ? 'hero' : c.id));
          if (!x) continue;
          c.techs = x.techs.slice(); c.spells = x.spells.slice(); c.wprof = Object.assign({}, x.wprof); c.eprof = Object.assign({}, x.eprof);
        }
        for (const c of party) c.mp = Math.round(R.Rules.stats(c).mp * 0.6);
        k0.push(party.reduce((s2, c) => s2 + c.techs.length + c.spells.length, 0));
        const roll0 = G.roll;
        G.roll = function (c, ctx) { rolls++; return roll0.call(this, c, ctx); };
        try {
          for (let i = 0; i < 95; i++) {
            const r = PM.runBattle(R, { party, inv: P0.inv, zone: zones[Math.floor(U.r() * zones.length)], tier: T, seed: Math.floor(U.r() * 1e9) });
            if (!r) break;
            n++;
            glim += (r.glimmers || []).length;
            casts += r.casts.reduce((x, y) => x + y, 0); techUse += r.techs.reduce((x, y) => x + y, 0); weaponActs += r.attacks.reduce((x, y) => x + y, 0) + r.techs.reduce((x, y) => x + y, 0);
            const end = r.party || [];
            for (let k = 0; k < party.length; k++) {
              const e = end[k];
              if (!e) continue;
              party[k].techs = e.techs.slice(); party[k].spells = e.spells.slice();
              party[k].wprof = Object.assign({}, e.wprof); party[k].eprof = Object.assign({}, e.eprof);
              party[k].hp = e.hp; party[k].mp = e.mp; party[k].wp = e.wp;
            }
            PM.afterBattle(R, party, r.result === 'lose' ? 'lose' : 'win');
            for (const c of party) if (c.hp <= 0) c.hp = R.Rules.stats(c).hp;
          }
        } finally { G.roll = roll0; }
        k1.push(party.reduce((s2, c) => s2 + c.techs.length + c.spells.length, 0));
      }
      const per = glim / REP, model = mean(stdRecs.slice(0, REP).map((r) => r.zako['r' + T] || 0));
      engineCheck.push({ T, battles: n, glimPer95: per, model, rollsPerMember: rolls / Math.max(1, n) / 4, casts: casts / Math.max(1, n), techShare: techUse / Math.max(1, weaponActs) });
      log(`エンジン T${T}: 雑魚 95 戦 × ${REP} で閃き 平均 ${f1(per)}（モデルの同じ 95 戦 ${f1(model)}）・判定 ${f2(rolls / Math.max(1, n) / 4)} 回/人/戦（モデル ${f2(ZAKO_ACTS * 0.95)}）・詠唱 ${f2(casts / Math.max(1, n))}/戦・武器の行動のうち技 ${Math.round(100 * techUse / Math.max(1, weaponActs))}%`);
    }
  }
}

// ---------------------------------------------------------------- 判定（§4.9.5・§7.12.2・§6.9.4）
console.log('\n## 判定');
crit('G1', '序章（約 35 戦）のパーティの閃き', `平均 ${f1(mean(prol))}・${Math.round(mean(prol.map((x) => (x >= 4 ? 1 : 0))) * 100)}% の通しで 4 回以上`, mean(prol) >= 4, '4 回以上（チュートリアルを含む）');
crit('G2a', '地方ごとの閃き（パーティ）の平均', f1(mean(allRegion)), mean(allRegion) >= 7 && mean(allRegion) <= 11, '7〜11');
crit('G2b', '1 つの地方の閃き（ティアごとの平均）', perT.map(f1).join(' / '), perT.every((x) => x >= 3 && x <= 16), 'どの地方も 3〜16');
crit('G3', 'ボス戦（T1 以降）で誰かが閃く確率', `${Math.round(mean(bossT1) * 100)}%`, mean(bossT1) >= 0.5, '50% 以上');
{
  const t = mean(aw.cs.map((c) => c.total)), main = aw.byW.sword || 0, sec = aw.byW.axe || 0;
  crit('G4a', '戦士型（武器 2 系統）のクリア時の数', `計 ${f1(t)}（主 ${f1(main)}・2 つ目 ${f1(sec)}）`, t >= 17 && t <= 22 && main >= 9.5 && main <= 11 && sec >= 6 && sec <= 10, '計 17〜22、主 10〜11（lv1〜9 で数えると 10 が全部。平均 9.5 以上）、2 つ目 6〜10');
}
function mageCrit(id, s, label, guide) {
  const t = mean(s.cs.map((c) => c.total)), si = mean(s.cs.map((c) => c.single)), a = mean(s.cs.map((c) => c.comboA)), b = mean(s.cs.map((c) => c.comboB)), tr = mean(s.cs.map((c) => c.triple)), st = s.byW.staff || 0;
  const ok = t >= 24 && t <= 32 && si >= 9 && si <= 14 && a >= 1 && a <= 3 && b >= 0 && b <= 3 && tr <= 1 && st >= 4 && st <= 10;
  crit(id, label, `計 ${f1(t)}（単 ${f1(si)}・A ${f1(a)}・B ${f1(b)}・三 ${f1(tr)}・杖 ${f1(st)}・ほかの技 ${f1(mean(s.cs.map((c) => c.techs)) - st)}）`, ok, '計 24〜32、単 9〜14、A 1〜3、B 0〜3、三 0〜1、杖 4〜10', guide);
}
mageCrit('G4b', amSpec, '術師型（杖・中列・0.75 回・念じ打ちで始める）のクリア時の数');
mageCrit('G4c', am, '参考: いまの仲間の術師（杖＋鞭・杖の技なしで始める）', true);
mageCrit('G4d', am2, '参考: 杖＋鞭で念じ打ちを持って始める', true);
crit('G5', '得手不得手の差（1 系統、T4 の終わり）A ÷ D', `${f2(one.A / one.D)}（A ${f1(one.A)}・D ${f1(one.D)}）`, one.A >= 1.2 * one.D, '1.2 以上');
crit('G6', '知力の差（1 回の判定）S/Z・S/N', `${f2(pInt[2] / pInt[0])}・${f2(pInt[2] / pInt[1])}`, pInt[2] / pInt[0] >= 1.8 && pInt[2] / pInt[1] >= 1.35, 'S/Z 1.8 以上・S/N 1.35 以上');
crit('G7', '入れ替えた仲間の追いつき（T4・0 個）', `5 個 ${median(to5)} 戦・7 個 ${median(to7)} 戦（中央値）`, median(to5) <= 30 && median(to7) <= 50, '5 個 30 戦以内・7 個 50 戦以内');
crit('G8', '最初の 3 人で本編クリア: 技の書・術の書', `技 ${Math.round(mean(bookT) * 100)}%・術 ${Math.round(mean(bookS) * 100)}%`, mean(bookT) >= 0.35 && mean(bookT) <= 0.5 && mean(bookS) >= 0.2 && mean(bookS) <= 0.45, '技 35〜50%・術 20〜45%');
crit('X1a', '術師型（1.5 回）が合成A を最初に閃くティア', `中央値 T${median(fA)}`, median(fA) >= 3 && median(fA) <= 4, 'T3〜T4', true);
crit('X1b', '術師型（1.5 回）が 3属性を最初に閃くティア', median(fT) >= 99 ? '本編では閃かない' : `中央値 T${median(fT)}`, (median(fT) >= 7 && median(fT) <= 8) || (median(fT) >= 99 && mean(postTriples) >= 1), 'T7〜T8（クリア後なら 1〜3 個）', true);
crit('X1c', '術師型（1.5 回）のクリア後 50 戦の後の 3属性', f1(mean(postTriples)), mean(postTriples) <= 3, '1〜3 個まで（目安）', true);
{
  const si = mean(am15.cs.map((c) => c.single));
  crit('X1d', '術師型（1.5 回）が本編で閃く単属性の数', f1(si), si >= 9 && si <= 14, '9〜14', true);
}
crit('X2', '魔石で最初の術を閃くまで（B の人の中央値）', `${stones.B.exact} 個（1 個 ${(stones.B.p * 100).toFixed(1)}%・抽選 2000 回の中央値 ${stones.B.median}・A ${stones.A.exact}）`, stones.B.exact >= 4 && stones.B.exact <= 5, '4〜5 個', true);
crit('X3', 'クリア後 50 戦の後、主な武器の極意を持つ人がいる', `${Math.round(mean(secretHit) * 100)}%（主な武器 3 人のうち 段階 9 以上 ${f1(rank9)}・極意 クリア時 ${f1(secretAtClear)} → 50 戦後 ${f1(secretPost)}）`, mean(secretHit) >= 0.6, '60% 以上（§6.9.4）');

const failed = results.filter((r) => !r.ok && !r.guide);
const warned = results.filter((r) => !r.ok && r.guide);
console.log(`\n${results.filter((r) => !r.guide).length - failed.length}/${results.filter((r) => !r.guide).length} passed, ${warned.length} guideline warning(s)  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (JSON_OUT) require('fs').writeFileSync(JSON_OUT, JSON.stringify({ runs: RUNS, seed: SEED, rules: H.info.rules, results, perT, prologue: mean(prol), bossByT, stones, one, to5: median(to5), to7: median(to7) }, null, 1));
process.exitCode = failed.length ? 1 : 0;
