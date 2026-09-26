#!/usr/bin/env node
// sim_loot（BATTLE）: 盗みとドロップ（STATS_REWORK §7.6 の H4・H5・H6、V2_PLAN §3.16 の 10）。
//
//   node v2/tools/sim_loot.js [--n 100000] [--seed 20260926]
//
// H4: 「盗みの成功」n 回で、盗み専用の当たりが式（1/rate × (1 + stealPct/100)、ついでに × 0.5、金色 × 2、上限 0.5）の ±10%。
// H5: n 体を倒して R.Mon.rollDrops に盗み専用の品が 1 度も出ない（倒しても落ちない）。
// H6（参考）: stealPct +50 の盗み手が毎戦 1 回盗むとき、通常の魔物の盗み専用を取るまでの戦闘数の中央値（目安 30〜60）と、
//             ボス（根食らい）で 1 戦（10 回の盗み）のうちに取れる率（目安 35〜55%、V2_PLAN の率 16 で読み替え）。
'use strict';

function loadR() { return require('./lib/load')({ quiet: true }); }

/** 盗み手 1 人（主人公）と魔物 1 体の Engine。stealPct は盗み手の mods に直に入れる */
function mkEngine(R, mon, o) {
  o = o || {};
  R.State.newGame({ hero: { type: 'ranger', sex: 'f', name: 'テスト', fav: 'dagger' }, seed: 3 });
  const hero = JSON.parse(JSON.stringify(R.Game.chars.hero));
  const eng = new R.BattleCore.Engine({ party: [hero], mons: [{ id: mon, golden: !!o.golden, summoned: !!o.summoned }], lv: o.lv || 9, tier: 0, inv: {}, rng: R.Mon.mkRng(o.seed || 'loot') });
  const u = eng.party[0];
  u.st.mods = Object.assign({}, u.st.mods, { stealPct: o.stealPct || 0 });
  return { eng, u, t: eng.mons[0] };
}

/** H4: 成功の後の判定だけを n 回（pickOnSuccess）。盗み専用の枠は毎回開き直す */
function h4(R, n, seed) {
  const rows = [];
  const cases = [
    { mon: 'seabird_3', stealPct: 0 }, { mon: 'seabird_3', stealPct: 50 }, { mon: 'seabird_3', stealPct: 100 },
    { mon: 'seabird_3', stealPct: 0, auto: true }, { mon: 'seabird_3', stealPct: 0, golden: true },
    { mon: 'rm_jewel_hare', stealPct: 50 }, { mon: 'b_rooteater', stealPct: 0 }, { mon: 'b_rooteater', stealPct: 5000 },
  ];
  for (const c of cases) {
    const { eng, u, t } = mkEngine(R, c.mon, { stealPct: c.stealPct, golden: c.golden, seed: `${seed}:${c.mon}:${c.stealPct}:${c.auto}:${c.golden}` });
    const rate = t.d.drops.steal.rate;
    const O = { cap: 0.5, autoMul: 0.5, golden: 2 };
    const want = Math.min(O.cap, (1 / rate) * (1 + c.stealPct / 100) * (c.auto ? O.autoMul : 1) * (c.golden && t.golden ? O.golden : 1));
    let hit = 0;
    eng.use();
    for (let i = 0; i < n; i++) {
      t.stolen = false; t.stolenSt = false;
      const r = eng.pickOnSuccess(u, t, !!c.auto);
      if (r && r.only) hit++;
    }
    const got = hit / n;
    const ok = Math.abs(got - want) <= want * 0.1 && got <= O.cap + 1e-9;
    rows.push({ case: `${c.mon} stealPct ${c.stealPct}${c.auto ? ' auto' : ''}${c.golden ? ' golden' : ''}`, want, got, ok });
  }
  return rows;
}

/** H5: n 体を倒してドロップを振り、盗み専用の品が出ないこと */
function h5(R, n, seed) {
  const DB = R.DB;
  const ids = Object.keys(DB.monsters).filter((id) => DB.monsters[id].drops && DB.monsters[id].drops.steal);
  const only = new Set(ids.map((id) => DB.monsters[id].drops.steal.item));
  R.Mon.setRng(R.Mon.mkRng(`${seed}:h5`));
  let bad = 0, kills = 0;
  for (let i = 0; i < n; i++) {
    const id = ids[i % ids.length];
    const d = R.Mon.def(id, { Lb: 9, golden: i % 7 === 0 });
    for (const x of R.Mon.rollDrops(d, { tier: 0, mods: { dropPct: 150, rarePct: 150, superPct: 150 } })) if (only.has(x.item)) bad++;
    kills++;
  }
  return { kills, bad, ok: bad === 0 };
}

/** H6: 毎戦 1 回盗む（stealPct +50）。通常の魔物は取るまでの戦闘数、ボスは 1 戦 10 回で取れる率 */
function h6(R, trials, seed) {
  const battles = [];
  for (let k = 0; k < trials; k++) {
    let n = 0;
    for (;;) {
      n++;
      const { eng, u, t } = mkEngine(R, 'seabird_3', { stealPct: 50, seed: `${seed}:h6:${k}:${n}` });
      for (const _ of eng.steal(u, t)) { /* 流す */ }
      if (eng.stolen.some((s) => s.stealOnly)) break;
      if (n > 2000) break;
    }
    battles.push(n);
  }
  battles.sort((a, b) => a - b);
  let got = 0;
  for (let k = 0; k < trials; k++) {
    const { eng, u, t } = mkEngine(R, 'b_rooteater', { stealPct: 50, seed: `${seed}:h6b:${k}` });
    for (let i = 0; i < 10; i++) for (const _ of eng.steal(u, t)) { /* 流す */ }
    if (eng.stolen.some((s) => s.stealOnly)) got++;
  }
  return { median: battles[Math.floor(battles.length / 2)], bossPct: (100 * got) / trials };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const n = +arg('--n', 100000);
  const seed = arg('--seed', '20260926');
  const R = loadR();
  let failed = false;
  console.log(`sim_loot: n=${n} seed=${seed}`);
  console.log('H4 盗み専用の当たり（成功の後）: 式との差 ±10%、上限 0.5');
  for (const r of h4(R, n, seed)) {
    console.log(`  ${r.case.padEnd(36)} want ${(100 * r.want).toFixed(2).padStart(6)}%  got ${(100 * r.got).toFixed(2).padStart(6)}%  ${r.ok ? 'pass' : 'FAIL'}`);
    failed = failed || !r.ok;
  }
  const r5 = h5(R, n, seed);
  console.log(`H5 倒しても落ちない: ${r5.kills} 体、盗み専用のドロップ ${r5.bad}  ${r5.ok ? 'pass' : 'FAIL'}`);
  failed = failed || !r5.ok;
  const r6 = h6(R, argv.includes('--quick') ? 100 : 400, seed);
  console.log(`H6（参考）stealPct +50: 通常の魔物（ぬすみカモメ）を取るまで 中央値 ${r6.median} 戦（目安 30〜60）、根食らい 1 戦 10 回で ${r6.bossPct.toFixed(1)}%（率 16 の読み替えで目安 35〜55）`);
  if (failed) process.exitCode = 1;
}

module.exports = { h4, h5, h6 };
if (require.main === module) main();
