#!/usr/bin/env node
// 成長の sim（RULES）: レベルの無い成長（STATS_REWORK §9.7 の E1〜E4）を、ゲームの R.Growth.afterBattle そのもので回す。
//   node v2/tools/sim_growth.js [--seed 1] [--runs 20] [--k GROW.slope=0.08]
// 模型（§9.3・§9.5）: 序章 35 戦（Lb 3〜6）＋チュートリアル＋序章のボス → 地方ごと（T0〜T7）95 戦（街道 35 戦 Lb = LZ(T)、
// ダンジョン 1 階 30 戦 LZ、奥 30 戦 LZ+2）、中ボス（奥の前、+2 ＋ボス 4）と地方ボス（最後、+3 ＋ボス 4）。
// 金色 1/40（+1）、レア魔物 1/80（+2）。出撃 4 人（標準のパーティ）＋控え 3 人。数値は R.Rules.K.GROW（調整はそこだけ）。
'use strict';
const R = require('./lib/load')({ quiet: true });
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEED = opt('--seed', '1');
const RUNS = +opt('--runs', 20);
const K = R.Rules.K, G = R.Growth;
// --k GROW.slope=0.08 … 調整の試し（ファイルは変えない）
for (let i = 0; i < argv.length; i++) if (argv[i] === '--k') { const [path, v] = argv[i + 1].split('='); const ks = path.split('.'); let o = K; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = +v; }
const results = [];
let fails = 0;
const check = (ok, msg) => { results.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

function newRun(seed) {
  const rng = R.rng('sim_growth:' + seed);
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 1 });
  const g = R.Game;
  return { rng, g, rnd: () => rng.next() };
}
function battle(run, Lb, o) {
  o = o || {};
  const r = run.rnd();
  const killed = [{}];
  if (!o.boss) { if (r < 1 / 80) killed[0].rare = true; else if (r < 1 / 80 + 1 / 40) killed[0].golden = true; }
  else killed[0].boss = true;
  const party = R.Game.party.slice(), reserve = R.Game.reserve.slice();
  return G.afterBattle(party, reserve, { Lb, killed, boss: !!o.boss, rng: run.rnd, tier: R.Game.tier });
}
const gls = (ids) => ids.map((id) => R.Game.chars[id].gl);

// ------------------------------------------------------------------ 通し
const PRO = [], E1 = [], E1lag = [], E3 = [], E3boss = [], E1b = [], E2 = [], E1c = [], E4 = [];
for (let run = 0; run < RUNS; run++) {
  const S = newRun(SEED + ':' + run);
  const g = S.g;
  g.tier = 0;
  for (const id of ['bartolo', 'marta', 'sylvain']) R.Party.join(id);
  for (const id of ['selma', 'teo', 'noela']) R.Party.join(id, { toReserve: true });
  // 序章: 半島の街道 12 戦（Lb 1〜3）、灯台 23 戦（Lb 3〜5）、チュートリアルと序章のボス（K.BOSS.prologue の lv 8 は魔物の強さ。伸びの E は Lb 5 ＋ ボス 4）
  for (let i = 0; i < 12; i++) battle(S, 1 + Math.floor(i / 4));
  for (let i = 0; i < 23; i++) battle(S, 3 + Math.floor(i / 8));
  battle(S, 5, { boss: true });
  PRO.push(mean(gls(g.party)));
  for (let T = 0; T < 8; T++) {
    g.tier = T;
    const LZ = K.LZ(T);
    for (let i = 0; i < 35; i++) battle(S, LZ);
    for (let i = 0; i < 30; i++) battle(S, LZ);
    // E3: 同じ強さの雑魚戦での伸びる率（出撃 4 人）
    if (T === 2) {
      const before = gls(g.party);
      let n = 0, grow = 0;
      for (let i = 0; i < 40; i++) {
        for (const id of g.party) R.Game.chars[id].gl = Math.max(1, LZ);   // d = 0 に揃える
        const rows = battle(S, LZ);
        n += g.party.length; grow += rows.filter((x) => g.party.includes(x.c.id)).length;
      }
      g.party.forEach((id, k) => { R.Game.chars[id].gl = before[k]; });
      E3.push(grow / n);
    }
    battle(S, LZ + 2, { boss: true });                                   // 中ボス
    for (let i = 0; i < 30; i++) battle(S, LZ + 2);
    const at = mean(gls(g.party));
    E1.push({ T, d: at - LZ });
    // E1b: 地方ボスの前に 100 戦余分に稼ぐ（写しで）
    const snap = JSON.stringify(g.chars);
    const hp0 = R.Rules.stats(g.chars.hero).maxHp;
    for (let i = 0; i < 100; i++) battle(S, LZ + 2);
    E1b.push({ T, add: mean(gls(g.party)) - at });
    if (T >= 2) E2.push({ T, pct: 100 * (R.Rules.stats(g.chars.hero).maxHp / hp0 - 1) });
    g.chars = JSON.parse(snap);
    // 地方ボス（出撃は必ず伸びる）
    const pre = gls(g.party);
    const rows = battle(S, LZ + 3, { boss: true });
    E3boss.push(g.party.every((id, k) => R.Game.chars[id].gl > pre[k] || R.Game.chars[id].gl >= G.cap(T)) ? 1 : 0);
    E1lag.push({ T, lag: mean(gls(g.party)) - mean(gls(g.reserve)) });
    void rows;
    // E4: T4 で途中加入（boden）→ 30 戦で差 ≤ 2
    if (T === 4) {
      const avg = mean(gls(g.party));
      const c = R.Party.join('boden', { toReserve: true });
      const joinGl = c.gl;
      // 出撃に入れ替えて 30 戦
      R.Party.swap('sylvain', 'boden');
      for (let i = 0; i < 30; i++) battle(S, K.LZ(5));
      E4.push({ ratio: joinGl / avg, diff: mean(gls(g.party.filter((x) => x !== 'boden'))) - R.Game.chars.boden.gl });
      R.Party.swap('boden', 'sylvain');
    }
  }
  // E1c: 弱い敵（Lb ≤ gl − 5）で 200 戦 → 伸びない
  const glNow = gls(g.party);
  const weak = Math.floor(Math.min(...glNow)) - 5;
  // 普通の魔物だけ（レア魔物 +2・金色 +1 は §9.3 の式どおり伸びうるので、この検査の外）
  for (let i = 0; i < 200; i++) G.afterBattle(R.Game.party, R.Game.reserve, { Lb: weak, killed: [{}], rng: S.rnd, tier: R.Game.tier });
  E1c.push(mean(gls(g.party)) - mean(glNow));
}

// ------------------------------------------------------------------ 表と合格
const byT = (arr, k) => [0, 1, 2, 3, 4, 5, 6, 7].map((T) => mean(arr.filter((x) => x.T === T).map((x) => x[k])));
const e1 = byT(E1, 'd'), lag = byT(E1lag, 'lag'), e1b = byT(E1b, 'add');
console.log(`prologue end: gl ${mean(PRO).toFixed(2)} (glAt prologue = ${G.glAt(0, 'prologue')})`);
console.log('T      ' + [0, 1, 2, 3, 4, 5, 6, 7].map((T) => ('T' + T).padStart(6)).join(''));
console.log('gl−LZ  ' + e1.map((v) => v.toFixed(2).padStart(6)).join('') + '   (at the region boss; target +2..+5)');
console.log('lag    ' + lag.map((v) => v.toFixed(2).padStart(6)).join('') + '   (party − reserve at the region end; ≤ 3)');
console.log('grind  ' + e1b.map((v) => v.toFixed(2).padStart(6)).join('') + '   (+100 battles before the boss; ≤ +3)');
check(e1.every((d) => d >= 2 && d <= 5), `E1 gl at the region boss = LZ(T) + 2..5 (${e1.map((v) => v.toFixed(1)).join(' ')})`);
check(lag.every((v) => v <= 3), `E1 reserve lag ≤ 3 (max ${Math.max(...lag).toFixed(2)})`);
check(e1b.every((v) => v <= 3), `E1b grinding 100 battles adds ≤ +3 gl (max ${Math.max(...e1b).toFixed(2)})`);
check(E1c.every((v) => v === 0), `E1c weak foes (Lb ≤ gl − 5), 200 battles: +0 (${mean(E1c).toFixed(3)})`);
const e2 = mean(E2.map((x) => x.pct));
check(E2.every((x) => x.pct <= 10), `E2 T2+ grinding 100 battles: max HP +${e2.toFixed(1)}% on average (≤ 10% each, max ${Math.max(...E2.map((x) => x.pct)).toFixed(1)}%)`);
const e3 = mean(E3);
check(e3 >= 0.25 && e3 <= 0.35, `E3 grow rate against same-strength foes ${(100 * e3).toFixed(1)}% (25–35%)`);
check(mean(E3boss) === 1, `E3 after a region boss everyone grows (${(100 * mean(E3boss)).toFixed(0)}%)`);
const e4r = mean(E4.map((x) => x.ratio)), e4d = mean(E4.map((x) => x.diff));
check(Math.abs(e4r - 0.9) < 0.02 && e4d <= 2, `E4 late joiner: gl = ${e4r.toFixed(3)} × average (0.9), 30 battles later gap ${e4d.toFixed(2)} (≤ 2)`);
console.log('\n' + results.join('\n'));
console.log(`\nsim_growth: ${results.length - fails}/${results.length} passed (runs ${RUNS}, seed ${SEED})`);
if (fails) process.exitCode = 1;
