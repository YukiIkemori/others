#!/usr/bin/env node
// sim_zones（BATTLE）: 雑魚戦の釣り合い（V2_PLAN §3.16 の 6、STATS_REWORK §6.5 の A2）。縦切りの出現表ごとに、標準の一行で n 回戦う。
//
//   node v2/tools/sim_zones.js [--n 400] [--zone zw_forest] [--seed 20260926] [--json] [--quick]
//
// 合格: 勝率 ≥ 99.5%、平均 2.5〜3.5 ラウンド、HP の減り平均 8〜12%（どの表も 5〜15%）、p95 ≤ 20%、誰か倒れる ≤ 3%、全滅 ≤ 0.1%。
// 一行（STATS_REWORK §8.4 の標準: 主人公 戦士・剣 ＋ バルトロ・マルタ・シルヴァン）は tools/lib/party_model.js（RULES）があればそれ、
// 無ければ下の buildParty（gl = R.Growth.glAt、熟練 = R.Rules.profAt、装備 = その時のティアの店の品で R.Rules.optimize、
// 技と術 = 熟練の段階で閃けるもののうち glim.lv ≤ ティア+2）。味方の AI は R.BattleAI.partyCommands（thrift、道具は 'auto'）。
// 「泉から泉の区間を MP 3 割以上残して」（--segments）は QA の tools/lib/maps.js が来てから（区間ごとの戦闘数が要る）。
'use strict';
const path = require('path');
const fs = require('fs');

const STD = ['bartolo', 'marta', 'sylvain'];
/** 縦切りの出現表と、その表で戦う一行（§3.1 の筋） */
const ZONES = {
  zw_prologue: { tier: 0, kind: 'start', members: [], gl: 2, solo: true, gear: 'start', note: '主人公 1 人（仲間を選ぶ前、初めの装備）' },
  zw_peninsula: { tier: 0, kind: 'prologue', members: STD },
  z_lighthouse: { tier: 0, kind: 'prologue', members: STD },
  z_well: { tier: 0, kind: 'prologue', members: STD },
  zw_forest_road: { tier: 0, kind: 'party', members: STD },
  zw_forest: { tier: 0, kind: 'party', members: STD },
  z_verda: { tier: 0, kind: 'party', members: STD },
  z_elder: { tier: 0, kind: 'mid', members: STD },
};
const TARGET = { win: 99.5, roundsLo: 2.5, roundsHi: 3.5, hpLo: 8, hpHi: 12, hpZoneLo: 5, hpZoneHi: 15, p95: 20, down: 3, wipe: 0.1 };

function loadR() { return require('./lib/load')({ quiet: true }); }

/**
 * 標準の一行を作る（R.Game を新しく作る）。o: {tier, kind, members, gl?, hero?, seed?, gear?: 'shop'|'start', items?}
 * → CharState の配列（R.Game の人そのもの）
 */
function buildParty(R, o) {
  o = o || {};
  const T = o.tier || 0;
  let pm = null;
  try { pm = require('./lib/party_model'); } catch (e) { pm = null; }
  if (pm && typeof pm.build === 'function' && !o.local) {
    try { const p = pm.build(R, Object.assign({}, o)); if (p && p.length) return p; } catch (e) { /* 下の予備 */ }
  }
  R.State.newGame({ hero: o.hero || { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: o.seed || 1 });
  for (const id of o.members || []) R.Party.join(id, { tier: T });
  const G = R.Game;
  const gl = o.gl != null ? o.gl : R.Growth.glAt(T, o.kind || 'party');
  const K = R.Rules.K;
  const pts = R.Rules.profAt(T, o.kind === 'prologue' ? 'prologue' : o.kind === 'start' ? 'start' : 'main');
  const rank = R.Rules.profRank(pts);
  const lvCap = Math.min(T + 2, (K.TECH_PROF || [0, 1, 3, 8]).reduce((m, need, lv) => (lv > 0 && need <= rank ? lv : m), 1));
  const inv = {};
  if (o.gear !== 'start') {
    for (const sid of Object.keys(R.DB.shops)) for (const id of R.Rules.shopItems(sid, T)) { const it = R.DB.items[id]; if (it && it.slot !== 'use' && it.slot !== 'key' && (it.tier == null || it.tier <= T) && (it.grade || 'normal') === 'normal') inv[id] = (inv[id] || 0) + 4; }
  }
  for (const c of R.Party.members()) {
    c.gl = gl;
    const wt = R.Rules.weaponType(c);
    c.wprof = c.wprof || {}; c.eprof = c.eprof || {};
    if (wt && wt !== 'fist') c.wprof[wt] = Math.max(c.wprof[wt] || 0, pts);
    const els = new Set();
    for (const id of c.spells || []) for (const e of (R.DB.spells[id] && R.DB.spells[id].elements) || []) els.add(e);
    for (const e of els) c.eprof[e] = Math.max(c.eprof[e] || 0, pts);
    // 技: 今の系統で glim.lv ≤ lvCap（閃いた見込み）。術: 知っている属性の単独の術で glim.lv ≤ lvCap
    const techs = new Set(c.techs || []);
    for (const id in R.DB.techs) { const a = R.DB.techs[id]; if (a.wtype === wt && a.glim && a.glim.lv <= lvCap) techs.add(id); }
    c.techs = [...techs];
    const spells = new Set(c.spells || []);
    for (const id in R.DB.spells) { const a = R.DB.spells[id]; if ((a.elements || []).length === 1 && els.has(a.elements[0]) && a.glim && a.glim.lv <= lvCap) spells.add(id); }
    c.spells = [...spells];
    if (Object.keys(inv).length) {
      const plan = R.Rules.optimize(c, R.Rules.K && c.spells.length > 1 && wt === 'staff' ? 'magic' : 'phys', { inv });
      R.Rules.applyLoadout(c, plan, { inv });
    }
    const st = R.Rules.stats(c);
    c.hp = st.maxHp; c.mp = st.maxMp; c.status = [];
  }
  G.items = Object.assign({}, o.items || {});
  G.tier = T;
  return R.Party.members();
}

function pctile(arr, p) { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; }
function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }

/** 1 つの表を n 回。一行は戦闘ごとに作り直す（HP・MP 満タン: 雑魚戦の 1 回の手応えを測る） */
function runZone(R, zone, n, seed) {
  const z = ZONES[zone] || { tier: 0, kind: 'party', members: STD };
  const party = buildParty(R, Object.assign({ seed: 7 }, z));
  const items = { i_potion: 5, i_antidote: 2 };
  const res = { zone, n, win: 0, rounds: [], hp: [], down: 0, wipe: 0, timeout: 0, mp: [], groups: {} };
  // 雑魚戦は MP 6 割で始める（旧の §9.13.1 と同じ。道中で MP は減っていく）
  for (const c of party) c.mp = Math.round(R.Rules.stats(c).maxMp * 0.6);
  for (let i = 0; i < n; i++) {
    const s = R.BattleCore.simulate({ party, zone, tier: z.tier, seed: `${seed}:${zone}:${i}`, inv: items, maxRounds: 30 });
    if (s.result === 'none') continue;
    if (s.result === 'win') res.win++;
    if (s.result === 'lose') res.wipe++;
    if (s.result === 'timeout') res.timeout++;
    if (s.down > 0 || s.deaths > 0) res.down++;
    res.rounds.push(s.rounds);
    res.hp.push(s.hpLossPct);
    res.mp.push(s.mpUsed);
    const key = [...new Set(s.mons)].join('+');
    const g = (res.groups[key] = res.groups[key] || { n: 0, hp: 0, rounds: 0 });
    g.n++; g.hp += s.hpLossPct; g.rounds += s.rounds;
  }
  const N = res.rounds.length || 1;
  return {
    zone, n: res.rounds.length, winPct: (100 * res.win) / N, rounds: mean(res.rounds), hpLoss: mean(res.hp), p95: pctile(res.hp, 0.95),
    downPct: (100 * res.down) / N, wipePct: (100 * res.wipe) / N, timeout: res.timeout, mpUsed: mean(res.mp),
    groups: Object.entries(res.groups).map(([k, g]) => ({ group: k, n: g.n, hp: g.hp / g.n, rounds: g.rounds / g.n })).sort((a, b) => b.hp - a.hp),
    party: party.map((c) => `${c.id}(gl ${c.gl}, HP ${R.Rules.stats(c).maxHp}, ${R.Rules.weaponType(c)})`).join(' '),
  };
}

function judge(r) {
  const f = [];
  // 主人公 1 人の表（仲間を選ぶ前）: 勝率 97% 以上だけ（旧の M4）。ほかの数字は参考
  if ((ZONES[r.zone] || {}).solo) { if (r.winPct < 97) f.push(`solo win ${r.winPct.toFixed(1)} < 97`); return f; }
  if (r.winPct < TARGET.win) f.push(`win ${r.winPct.toFixed(1)} < ${TARGET.win}`);
  if (r.rounds < TARGET.roundsLo || r.rounds > TARGET.roundsHi) f.push(`rounds ${r.rounds.toFixed(2)} ∉ ${TARGET.roundsLo}–${TARGET.roundsHi}`);
  if (r.hpLoss < TARGET.hpZoneLo || r.hpLoss > TARGET.hpZoneHi) f.push(`HP loss ${r.hpLoss.toFixed(1)} ∉ ${TARGET.hpZoneLo}–${TARGET.hpZoneHi}`);
  if (r.p95 > TARGET.p95) f.push(`p95 ${r.p95.toFixed(1)} > ${TARGET.p95}`);
  if (r.downPct > TARGET.down) f.push(`down ${r.downPct.toFixed(1)} > ${TARGET.down}`);
  if (r.wipePct > TARGET.wipe) f.push(`wipe ${r.wipePct.toFixed(2)} > ${TARGET.wipe}`);
  return f;
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const n = +arg('--n', argv.includes('--quick') ? 120 : 400);
  const seed = arg('--seed', '20260926');
  const only = arg('--zone', null);
  const R = loadR();
  const zones = only ? [only] : Object.keys(ZONES);
  const out = [];
  console.log(`sim_zones: n=${n} seed=${seed}（標準の一行、雑魚戦 1 回ごとに HP・MP 満タン）`);
  console.log('zone             win%   rounds  HP%   p95   down%  wipe%  MP/戦  判定');
  for (const z of zones) {
    const r = runZone(R, z, n, seed);
    r.fail = judge(r);
    out.push(r);
    console.log(`${z.padEnd(16)} ${r.winPct.toFixed(1).padStart(5)}  ${r.rounds.toFixed(2).padStart(5)}  ${r.hpLoss.toFixed(1).padStart(5)} ${r.p95.toFixed(1).padStart(5)}  ${r.downPct.toFixed(1).padStart(5)}  ${r.wipePct.toFixed(2).padStart(5)}  ${r.mpUsed.toFixed(1).padStart(5)}  ${r.fail.length ? 'FAIL ' + r.fail.join('; ') : 'pass'}`);
    if (argv.includes('--groups')) for (const g of r.groups.slice(0, 6)) console.log(`    ${g.group.padEnd(34)} n=${g.n} HP ${g.hp.toFixed(1)}% rounds ${g.rounds.toFixed(2)}`);
  }
  const all = out.filter((r) => r.n && !(ZONES[r.zone] || {}).solo);   // 主人公 1 人の表は平均に入れない
  const avgHp = mean(all.map((r) => r.hpLoss)), avgRounds = mean(all.map((r) => r.rounds));
  const overall = [];
  if (avgHp < TARGET.hpLo || avgHp > TARGET.hpHi) overall.push(`mean HP loss ${avgHp.toFixed(1)} ∉ ${TARGET.hpLo}–${TARGET.hpHi}`);
  console.log(`all zones: HP loss ${avgHp.toFixed(1)}%, rounds ${avgRounds.toFixed(2)} ${overall.length ? 'FAIL ' + overall.join('; ') : 'pass'}`);
  console.log(`party: ${all[all.length - 1] ? all[all.length - 1].party : ''}`);
  if (argv.includes('--json')) {
    const file = path.join(__dirname, '..', 'design', 'shots', 'battle', 'sim_zones.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ n, seed, zones: out, avgHp, avgRounds }, null, 1));
    console.log('wrote', path.relative(process.cwd(), file));
  }
  const failed = out.some((r) => r.fail.length) || overall.length;
  if (failed && !argv.includes('--no-exit')) process.exitCode = 1;
  return { out, failed };
}

module.exports = { buildParty, runZone, judge, ZONES, STD, TARGET };
if (require.main === module) main();
