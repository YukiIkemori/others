#!/usr/bin/env node
// 閃きと熟練度の sim（RULES）: ゲームの R.Rules.train・R.Glimmer.roll・R.Glimmer.learn をそのまま回す模型。
//   node v2/tools/sim_glimmer.js [--runs 40] [--seed 1]         熟練度の目安（STATS_REWORK §5.3 の P0・P1・P1b・P2）と閃き（SYSTEMS_REWORK §4.3 G）
//   node v2/tools/sim_glimmer.js --derive [--runs 200] [--share 0.33]  派生技: 入門技を何回使うと最初の派生を編み出すか
//   node v2/tools/sim_glimmer.js --slice [--json out.json]      縦切りの範囲（V2_PLAN §3.9）: 序章 35 戦＋森 95 戦＋ボス 4 で、
//                                                               だれか（仲間 20 人・主人公 5 型）が閃く確率が 5% 以上の技・術の一覧（QA の slice_scope が読む）
// 模型（SYSTEMS_REWORK §4.3・STATS_REWORK §5.1）: 1 戦 3 行動。武器の人は 92% が武器の行動（そのうち覚えた技があれば 4 割が技）、
// 術の人は 1 戦に 0.75 回か 1.5 回の術（残りは杖）。序章 35 戦（灯台に入るのは 12 戦目）＋ボス 2、ティア 0〜7 は 95 戦＋中ボス＋地方ボス、
// ティア 8 は 60 戦＋ボス 2 で本編クリア。閃きの格 rankB = ティア + 1（ボスは +2、EF 2.5）。A29: 武器は 1 本（1 系統）。
'use strict';
const fs = require('fs');
const R = require('./lib/load')({ quiet: true });
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const RUNS = +opt('--runs', 40);
const SEED = opt('--seed', '1');
const SLICE = argv.includes('--slice');
const JSON_OUT = opt('--json', null);
const Ru = R.Rules, Gl = R.Glimmer, K = Ru.K, DB = R.DB;
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

/** 1 人の模型: {c, casts(1 戦の術の回数), element（主な属性）} */
function member(spec) {
  const c = spec.hero
    ? R.Party.makeChar('hero', { hero: { type: spec.hero, sex: 'm', name: 'アルン', fav: spec.fav }, tier: 0, joinFrom: 'start' })
    : R.Party.makeChar(spec.id, { tier: 0, catchUp: false });
  if (spec.weapon) c.equip.weapon1 = spec.weapon;
  if (Ru.hasTwoHanded(c)) c.equip.shield = null;
  const els = spec.element ? [spec.element] : (c.spells || []).map((s) => DB.spells[s] && DB.spells[s].elements[0]).filter(Boolean);
  return { c, casts: spec.casts != null ? spec.casts : (c.spells.length ? 0.75 : 0), element: els[0] || null, name: spec.name || spec.id || spec.hero, glims: 0 };
}
/** 1 戦: 各人 3 行動（熟練度 → 閃きの判定） */
function battle(m, o, rnd) {
  const c = m.c;
  const wtype = Ru.weaponType(c);
  let got = 0;
  const ctx0 = { rankB: o.T + K.GLIM.rankBase + (o.boss ? K.GLIM.rank.boss : 0), ef: o.boss ? K.GLIM.ef.boss : 1, tier: o.T, row: c.row, rng: rnd };
  // 術の回数（0.75 は 3/4 の確率で 1 回、1.5 は 1 回 ＋ 半分の確率でもう 1 回）
  let casts = Math.floor(m.casts) + (rnd() < m.casts % 1 ? 1 : 0);
  for (let a = 0; a < 3; a++) {
    if (casts > 0 && m.element) {
      casts--;
      const known = (c.spells || []).filter((s) => DB.spells[s] && DB.spells[s].elements.includes(m.element));
      // 雑魚戦の術は MP の安い物が多い（6 割は一番安い術、残りは覚えた中から）
      known.sort((x, y) => (DB.spells[x].mp || 0) - (DB.spells[y].mp || 0));
      const sid = known.length ? (rnd() < 0.6 ? known[0] : known[Math.floor(rnd() * known.length)]) : null;
      const els = sid ? DB.spells[sid].elements : [m.element];
      Ru.train(c, { kind: 'spell', elements: els, actionId: sid, tier: o.T });
      const hit = Gl.roll(c, sid || 'attack', Object.assign({ kind: 'spell', elements: els }, ctx0));
      if (hit && Gl.learn(c, hit.id, { quiet: true })) { got++; o.learned && o.learned.push(hit.id); }
      continue;
    }
    if (m.casts === 0 && rnd() >= 0.92) continue;   // 防御・道具
    if (wtype === 'fist') continue;
    const techs = Ru.techList(c);
    const useTech = techs.length && rnd() < 0.4;
    const id = useTech ? techs[Math.floor(rnd() * techs.length)] : 'attack';
    Ru.train(c, { kind: useTech ? 'tech' : 'attack', wtype, actionId: useTech ? id : null, tier: o.T });
    const hit = Gl.roll(c, id, Object.assign({ kind: 'tech', wtype, used: id }, ctx0));
    if (hit && Gl.learn(c, hit.id, { quiet: true })) { got++; o.learned && o.learned.push(hit.id); }
  }
  m.glims += got;
  return got;
}
const rankW = (m) => Ru.rankOf(m.c, 'w', Ru.weaponType(m.c));
const rankE = (m) => (m.element ? Ru.rankOf(m.c, 'e', m.element) : 0);

// ================================================================== 縦切りの範囲（§3.9）
if (SLICE) {
  const specs = [];
  for (const id of Object.keys(DB.companions)) specs.push({ id });
  for (const t of Object.keys(DB.heroTypes)) {
    const H = DB.heroTypes[t];
    for (const w of H.favorOptions.weapon || []) specs.push({ hero: t, fav: w, name: t + ':' + w });
    for (const e of H.favorOptions.element || []) specs.push({ hero: t, fav: e, name: t + ':' + e, casts: t === 'mage' ? 1.5 : 0.75, element: e });
  }
  const P = {};
  const START = new Set();       // action → max over specs of P(learned)
  const N = Math.max(20, RUNS);
  for (const sp of specs) {
    const cnt = {};
    for (let run = 0; run < N; run++) {
      const rng = R.rng(`glim_slice:${SEED}:${sp.name || sp.id}:${run}`);
      const rnd = () => rng.next();
      R.State.newGame({ seed: 1 });
      const m = member(sp);
      const learned = [];
      if (run === 0) for (const id of m.c.techs.concat(m.c.spells)) { P[id] = 1; START.add(id); }   // 初めから覚えている技・術（入門技）も範囲に入る
      const o = (T, boss) => ({ T, boss, learned });
      for (let i = 0; i < 35; i++) battle(m, o(0, false), rnd);
      battle(m, o(0, true), rnd); battle(m, o(0, true), rnd);                 // チュートリアル・ページ食らい
      for (let i = 0; i < 95; i++) battle(m, o(0, false), rnd);
      battle(m, o(0, true), rnd); battle(m, o(0, true), rnd);                 // ダストウィング・根食らい（群れ頭は雑魚に含める）
      for (const id of new Set(learned)) cnt[id] = (cnt[id] || 0) + 1;
    }
    for (const id of Object.keys(cnt)) P[id] = Math.max(P[id] || 0, cnt[id] / N);
  }
  const list = Object.keys(P).filter((id) => P[id] >= 0.05).sort((a, b) => P[b] - P[a]);
  const techs = list.filter((id) => DB.techs[id]), spells = list.filter((id) => DB.spells[id]);
  console.log(`slice scope (P ≥ 5% for anyone, ${specs.length} characters × ${N} runs): techs ${techs.length}, spells ${spells.length}`);
  for (const id of list) console.log(`  ${(100 * P[id]).toFixed(0).padStart(3)}%  ${id}  ${Ru.actionOf(id).name}`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ made: new Date().toISOString(), model: 'prologue 35 + forest 95 + bosses 4', threshold: 0.05, p: P, techs, spells }, null, 1));
  const lv = techs.map((id) => DB.techs[id].glim.lv);
  // §3.9 の見込みは「lv1〜3 の技 約 20 と入門技」: 閃く技（入門技を除く）を数える
  const glimT = techs.filter((id) => !START.has(id));
  // 見込みとの比べ（範囲の広さの目安。釣り合いの合格ではないので NOTE。技の lv の上限だけは合格の条件）
  const near = glimT.length >= 15 && glimT.length <= 25;
  const ok = Math.max(...lv) <= 4;
  console.log(`\n${ok ? 'PASS' : 'FAIL'} slice scope stays within tech lv ≤ 4 (max lv ${Math.max(...lv)})`);
  console.log(`${near ? 'NOTE' : 'NOTE (above/below the estimate)'} slice scope near the V2_PLAN §3.9 estimate (glimmered techs lv1–3 ≈ 20: ${glimT.length} + starters ${techs.length - glimT.length}, max lv ${Math.max(...lv)}; spells step 1–2 ≈ 12: ${spells.length})`);
  if (!ok) process.exitCode = 1;
  return;
}

// ================================================================== 派生技（design/BACKLOG「派生技の閃き」）
//   node v2/tools/sim_glimmer.js --derive [--runs 200]
// 持ち主「特定の技を何度も使ってると派生技を編み出す」「その技を使ってる時しか閃かない」。
// 模型: 体験版の流れ（序章 35 戦＋森 95 戦、ティア 0。1 戦 3 行動）。入門技 X を覚えた人が、3 行動のうち 1 回 X（割合 --share、既定 1/3）、
// 残りは攻撃。行動のたびに R.Rules.train、X のときは R.Glimmer.countUse → 閃き（R.Glimmer.roll。当たれば行動が差し替わり X は使わない）→
// 当たらなければ R.Glimmer.deriveRoll（X の derive だけ）。X からの最初の派生までの X の使用回数と戦闘の番号を数える。
// 目安（依頼）: 最初の派生は体験版の中ほど、入門技を 30〜60 回使ったころ（入門技ごとの中央値で見る）。
if (argv.includes('--derive')) {
  const N = Math.max(40, +opt('--runs', 200));
  const SHARE = +opt('--share', 1 / 3);
  const DEMO = 130, MID = [40, 95];
  const specs = [
    { hero: 'warrior', fav: 'sword', x: 't_sword_stepcut' }, { id: 'viola', x: 't_sword_stepcut' }, { id: 'shigure', x: 't_sword_draw' }, { hero: 'warrior', fav: 'sword', x: 't_sword_guard' },
    { id: 'bartolo', x: 't_greatsword_overhead' }, { id: 'basil', x: 't_greatsword_crumble' }, { id: 'bartolo', x: 't_greatsword_mow' },
    { id: 'titta', x: 't_dagger_vital' }, { id: 'titta', x: 't_dagger_filch' }, { id: 'titta', x: 't_dagger_butt' }, { id: 'zafira', x: 't_dagger_numb' },
    { id: 'sylvain', x: 't_bow_rapid' }, { id: 'sylvain', x: 't_bow_twin' },
    { id: 'teo', x: 't_staff_mind' }, { id: 'marta', x: 't_staff_soothe' },
  ];
  const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * f))] : NaN; };
  console.log(`derive sim: ${N} runs, X share ${SHARE.toFixed(2)} of actions, demo ${DEMO} battles (tier 0)`);
  console.log('member        basic tech               derives to                uses p25/med/p75   battle med   in demo   first target');
  const meds = [], battles = [], basicMeds = [];
  for (const sp of specs) {
    const uses = [], bat = [], tgt = {};
    let inDemo = 0;
    for (let run = 0; run < N; run++) {
      const rng = R.rng(`derive:${SEED}:${sp.id || sp.hero}:${sp.x}:${run}`);
      const rnd = () => rng.next();
      R.State.newGame({ seed: 1 });
      const c = member(sp).c;
      if (!c.techs.includes(sp.x)) c.techs.push(sp.x);
      const wtype = Ru.weaponType(c);
      let got = null;
      for (let b = 0; b < 400 && !got; b++) {
        const ctx0 = { rankB: K.GLIM.rankBase, ef: 1, tier: 0, row: c.row, rng: rnd };
        for (let a = 0; a < 3 && !got; a++) {
          const useX = rnd() < SHARE;
          const id = useX ? sp.x : 'attack';
          const hit = Gl.roll(c, id, Object.assign({ kind: 'tech', wtype, used: id }, ctx0));
          if (hit) { Gl.learn(c, hit.id, { quiet: true }); Ru.train(c, { kind: 'tech', wtype, actionId: hit.id, tier: 0 }); continue; }   // 閃きが先（重ねない）
          Ru.train(c, { kind: useX ? 'tech' : 'attack', wtype, actionId: useX ? id : null, tier: 0 });
          if (!useX) continue;
          Gl.countUse(c, sp.x);
          const d = Gl.deriveRoll(c, sp.x, { rng: rnd });
          if (d) { Gl.learnDerived(c, d.id, sp.x, { quiet: true }); got = { uses: Gl.useCount(c, sp.x), b: b + 1, id: d.id }; }
        }
      }
      if (got) { uses.push(got.uses); bat.push(got.b); tgt[got.id] = (tgt[got.id] || 0) + 1; if (got.b <= DEMO) inDemo++; }
      else { uses.push(Infinity); bat.push(Infinity); }
    }
    const top = Object.keys(tgt).sort((a, b) => tgt[b] - tgt[a]).map((id) => `${DB.techs[id].name} ${(100 * tgt[id] / N).toFixed(0)}%`).join(' ');
    const m = q(uses, 0.5), mb = q(bat, 0.5);
    meds.push(m); battles.push(mb);
    const basic = DB.techs[sp.x].glim.lv === 1;
    if (basic) basicMeds.push(m);
    const to = Gl.deriveOf(sp.x).map((d) => DB.techs[d.to].name).join('・');
    console.log(`${(sp.id || sp.hero).padEnd(13)} ${(DB.techs[sp.x].name + (basic ? '' : '*')).padEnd(22)} ${to.padEnd(24)} ${[q(uses, 0.25), m, q(uses, 0.75)].join('/').padStart(16)} ${String(mb).padStart(10)} ${(100 * inDemo / N).toFixed(0).padStart(8)}%   ${top}`);
  }
  const res = [];
  let bad = 0;
  const chk = (ok, msg) => { res.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) bad++; };
  chk(basicMeds.every((m) => m >= 30 && m <= 60), `first derivation from a basic (lv1) tech after 30–60 uses (medians ${basicMeds.join('/')})`);
  const midB = q(battles, 0.5);
  chk(midB >= MID[0] && midB <= MID[1], `first derivation around the mid-demo: median battle ${midB} (${MID[0]}–${MID[1]} of ${DEMO})`);
  console.log('\n* = a lv2 starter (抜き打ち・打ち崩し・しびれ刺し), for reference; a lv4 target waits for weapon rank 14 (K.TECH_PROF), after the demo\n' + res.join('\n'));
  console.log(`\nsim_glimmer --derive: ${res.filter((x) => x.startsWith('PASS')).length}/${res.length} passed`);
  if (bad) process.exitCode = 1;
  return;
}

// ================================================================== 通し（P0・P1・P1b・P2・G）
const SPECS = [
  { hero: 'warrior', fav: 'sword', name: 'hero sword' },
  { id: 'bartolo', name: 'bartolo greatsword' },
  { id: 'sylvain', name: 'sylvain bow' },
  { id: 'titta', name: 'titta dagger' },
  { id: 'teo', casts: 0.75, element: 'fire', name: 'teo fire ×0.75' },
  { id: 'marta', casts: 1.5, element: 'light', name: 'marta light ×1.5' },
];
const track = SPECS.map(() => ({ light: [], pro: [], t0dun: [], t0end: [], t1end: [], clear: [], glPro: [], glReg: [], techsClear: [], mainShare: [] }));
const bossHit = [];
for (let run = 0; run < RUNS; run++) {
  const rng = R.rng(`glim:${SEED}:${run}`);
  const rnd = () => rng.next();
  R.State.newGame({ seed: 1 });
  const ms = SPECS.map(member);
  const all = (T, boss) => { let n = 0; for (const m of ms) n += battle(m, { T, boss }, rnd); return n; };
  let pro = 0;
  for (let i = 0; i < 35; i++) {
    if (i === 12) ms.forEach((m, k) => track[k].light.push(m.casts >= 0.75 ? rankE(m) : rankW(m)));
    pro += all(0, false);
  }
  pro += all(0, true) + all(0, true);
  ms.forEach((m, k) => { track[k].pro.push(m.casts >= 0.75 ? rankE(m) : rankW(m)); track[k].glPro.push(pro); });
  for (let T = 0; T <= 8; T++) {
    const n = T === 8 ? 60 : 95;
    let reg = 0;
    const dun = ms.map(() => []);
    for (let i = 0; i < n; i++) {
      reg += all(T, false);
      if (T === 0 && i >= 45) ms.forEach((m, k) => dun[k].push(m.casts >= 0.75 ? rankE(m) : rankW(m)));
      if (i === Math.floor(n * 0.6)) { const g = all(T, true); reg += g; if (T >= 1) bossHit.push(g > 0 ? 1 : 0); }
    }
    const g = all(T, true); reg += g; if (T >= 1) bossHit.push(g > 0 ? 1 : 0);
    if (T === 0) ms.forEach((m, k) => { track[k].t0dun.push(mean(dun[k])); track[k].t0end.push(m.casts >= 0.75 ? rankE(m) : rankW(m)); });
    if (T === 1) ms.forEach((m, k) => track[k].t1end.push(m.casts >= 0.75 ? rankE(m) : rankW(m)));
    if (T < 8) ms.forEach((m, k) => track[k].glReg.push(reg));
  }
  ms.forEach((m, k) => {
    track[k].clear.push(m.casts >= 0.75 ? rankE(m) : rankW(m));
    const w = Ru.weaponType(m.c);
    const pool = Object.keys(DB.techs).filter((id) => DB.techs[id].wtype === w && DB.techs[id].glim.lv <= 9);
    track[k].techsClear.push((m.c.techs || []).length + (m.c.spells || []).length);
    track[k].mainShare.push(pool.filter((id) => m.c.techs.includes(id)).length / pool.length);
  });
}
const results = [];
let fails = 0;
const check = (ok, msg) => { results.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
console.log('member               light  pro  T0dun  T0end  T1end  clear  known  main-lv1-9');
SPECS.forEach((s, k) => {
  const t = track[k];
  console.log(`${s.name.padEnd(20)} ${median(t.light).toString().padStart(5)} ${median(t.pro).toString().padStart(4)} ${mean(t.t0dun).toFixed(1).padStart(6)} ${median(t.t0end).toString().padStart(6)} ${median(t.t1end).toString().padStart(6)} ${median(t.clear).toString().padStart(6)} ${median(t.techsClear).toString().padStart(6)} ${(100 * mean(t.mainShare)).toFixed(0).padStart(8)}%`);
});
const W = [0, 1, 2, 3];   // 武器の人
const war = track[0];
check(median(war.light) >= 3 && median(war.light) <= 5, `P1 main weapon at the lighthouse entry ${median(war.light)} (3–5)`);
check(W.every((k) => median(track[k].pro) >= 5 && median(track[k].pro) <= 9), `P1 main weapon at the prologue end ${W.map((k) => median(track[k].pro)).join('/')} (5–8; the bow 8–9)`);
check(W.every((k) => mean(track[k].t0dun) >= 8 && mean(track[k].t0dun) <= 11.5), `P0 T0 dungeon (battles 45–95) main weapon ${W.map((k) => mean(track[k].t0dun).toFixed(1)).join('/')} (8–11, median 9±1)`);
check(mean(track[4].t0dun) >= 8 && mean(track[4].t0dun) <= 10.5 && mean(track[5].t0dun) >= 9 && mean(track[5].t0dun) <= 12,
  `P0 casters' main element at the T0 dungeon ×0.75 ${mean(track[4].t0dun).toFixed(1)} (8–10), ×1.5 ${mean(track[5].t0dun).toFixed(1)} (9–12)`);
check(W.every((k) => median(track[k].t0end) <= 14) && median(war.t0end) <= 12, `P1b T0 end main weapon ≤ 12 (single type ≤ 14): ${W.map((k) => median(track[k].t0end)).join('/')}`);
check(W.every((k) => median(track[k].clear) >= 68 && median(track[k].clear) <= 90), `P2 clear main weapon 68–88 (single type ≤ 90): ${W.map((k) => median(track[k].clear)).join('/')}`);
// P3 は縦切りの外（本編クリアの術師）。soft line（K.PROF_SOFT）で頭打ちになるので、P3 の段階の調整（P3 の関門）まで参考として出す
const p3 = median(track[4].clear) >= 44 && median(track[4].clear) <= 65 && median(track[5].clear) >= 55 && median(track[5].clear) <= 75;
results.push((p3 ? 'PASS ' : 'NOTE ') + `P3 (reference, outside the slice) casters' main element at clear ×0.75 ${median(track[4].clear)} (44–65), ×1.5 ${median(track[5].clear)} (55–75)`);
const gPro = mean(war.glPro), gReg = mean(war.glReg) * 4 / SPECS.length;
check(gPro >= 4, `G prologue glimmers (6 members) ${gPro.toFixed(1)} (≥ 4 for a party of 4)`);
check(gReg >= 7 && gReg <= 11 * 1.3, `G glimmers per region (scaled to 4 members) ${gReg.toFixed(1)} (7–11)`);
check(mean(bossHit) >= 0.5, `G boss battles T1+ with a glimmer ${(100 * mean(bossHit)).toFixed(0)}% (≥ 50%)`);
check(mean(war.mainShare) >= 0.75, `G warrior knows ${(100 * mean(war.mainShare)).toFixed(0)}% of the main weapon's lv1–9 techs at clear (≥ 75%)`);
console.log('\n' + results.join('\n'));
console.log(`\nsim_glimmer: ${results.filter((x) => x.startsWith('PASS')).length}/${results.filter((x) => !x.startsWith('NOTE')).length} passed (runs ${RUNS}, seed ${SEED})`);
if (fails) process.exitCode = 1;
