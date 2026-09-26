#!/usr/bin/env node
// 術と能力値の釣り合いの sim（RULES）: STATS_REWORK §6.5 の D1・D2・D5 と、熟練度の MP の割引（A13b）・術の MP の表を、
// ゲームの R.Rules（stats・mpCost・profMpKind）で数える。戦闘の中の与ダメージ（D6・P5・P10）は BATTLE の engine が要るので
// sim_zones / sim_bosses（BATTLE）の側。
//   node v2/tools/sim_spells.js
//   D1 知力ビルド（T8）: 術力の比 S/N 1.5〜1.8（武器 1 本・能力値・等級・固定値の効果込み、magicPct は含めない）、能力値だけの比 1.18〜1.35（参考）
//   D2 腕力・器用さビルド（T8）: 攻撃力の比 S/N 1.5〜1.8
//   D5 1 点の手応え: 知力 21 と 22 の術力の比 ≥ 1.035、腕力 21 と 25 の攻撃力の比 1.12〜1.17
'use strict';
const R = require('./lib/load')({ quiet: true });
const PM = require('./lib/party_model');
const Ru = R.Rules, DB = R.DB, K = Ru.K;
const results = [];
let fails = 0;
const check = (ok, msg) => { results.push((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
// T8 の一式の比（D1・D2）は縦切りの外（V2_PLAN §3.7: 縦切りで確かめるのはティア 0〜2）。本編の調整（P3、STATS_REWORK §6.2 の順）まで参考として出す
const note = (ok, msg) => results.push((ok ? 'PASS ' : 'NOTE ') + msg);

function fake(stats) {
  const id = 'sim_' + Object.values(stats).join('_');
  DB.companions[id] = { name: '模型', look: 'selma', gender: 'm', row: 'front', stats, growth: { hp: 'B', mp: 'B' },
    apt: { w: { sword: 'B', greatsword: 'B', dagger: 'B', bow: 'B', staff: 'B' }, e: { fire: 'B', water: 'B', wind: 'B', earth: 'B', light: 'B', dark: 'B' } },
    innate: { mods: {} }, startEquip: {}, startTechs: [], startSpells: [] };
  R.State.newGame({ seed: 1 });
  return R.Party.makeChar(id, { tier: 8, gl: 50 });
}
function wear(c, set) { PM.BUILD_SLOTS.forEach((s, i) => { c.equip[s] = set[i] && DB.items[set[i]] ? set[i] : null; }); if (Ru.hasTwoHanded(c)) c.equip.shield = null; return c; }
const S16 = (o) => Object.assign({ str: 16, vit: 16, dex: 16, agi: 16, int: 16, mnd: 15 }, o);

// ------------------------------------------------------------------ D1
{
  const N = wear(fake(S16({ int: 21, str: 10 })), PM.BUILD_SETS.int.N), S = wear(fake(S16({ int: 21, str: 10 })), PM.BUILD_SETS.int.S);
  const n = Ru.stats(N), s = Ru.stats(S);
  const intN = n.int, intS = s.int;
  const ratio = s.mag / n.mag, abil = Ru.abilMul(intS, K.ABIL.mag) / Ru.abilMul(intN, K.ABIL.mag);
  console.log(`D1 int build T8: N mag ${n.mag} (int ${intN}), S mag ${s.mag} (int ${intS}) → S/N ${ratio.toFixed(2)}, abilities only ${abil.toFixed(2)}`);
  note(ratio >= 1.5 && ratio <= 1.8, `D1 (reference) S/N magic power ${ratio.toFixed(3)} (1.5–1.8)`);
  note(abil >= 1.18 && abil <= 1.35, `D1 (reference) abilities only ${abil.toFixed(2)} (1.18–1.35)`);
}
// ------------------------------------------------------------------ D2
for (const [key, st] of [['str', S16({ str: 21 })], ['dex', S16({ dex: 21 })]]) {
  const N = wear(fake(st), PM.BUILD_SETS[key].N), S = wear(fake(st), PM.BUILD_SETS[key].S);
  const n = Ru.stats(N), s = Ru.stats(S);
  const ratio = s.atk / n.atk;
  console.log(`D2 ${key} build T8: N atk ${n.atk} (${key} ${n[key]}), S atk ${s.atk} (${key} ${s[key]}) → S/N ${ratio.toFixed(2)}`);
  note(ratio >= 1.5 && ratio <= 1.8, `D2 (reference) ${key} S/N attack ${ratio.toFixed(2)} (1.5–1.8; the S set's quirk accessories carry no flat attack)`);
}
// ------------------------------------------------------------------ D5
{
  const set = PM.BUILD_SETS.int.N;
  const a = Ru.stats(wear(fake(S16({ int: 21 })), set)).mag, b = Ru.stats(wear(fake(S16({ int: 22 })), set)).mag;
  check(b / a >= 1.035, `D5 int 21 → 22: magic ×${(b / a).toFixed(3)} (≥ 1.035)`);
  const sset = PM.BUILD_SETS.str.N;
  const x = Ru.stats(wear(fake(S16({ str: 21 })), sset)).atk, y = Ru.stats(wear(fake(S16({ str: 25 })), sset)).atk;
  check(y / x >= 1.12 && y / x <= 1.17, `D5 str 21 → 25: attack ×${(y / x).toFixed(3)} (1.12–1.17)`);
}
// ------------------------------------------------------------------ 熟練度の MP の割引（A13b）と術の MP
{
  const c = fake(S16({ int: 21 }));
  c.spells = ['s_fire_1', 's_fire_2'];
  c.eprof.fire = K.PROF_PTS[13];
  const a = Ru.mpCost(c, 's_fire_1');
  c.eprof.fire = K.PROF_PTS[14];
  const b = Ru.mpCost(c, 's_fire_1');
  c.eprof.fire = K.PROF_PTS[32];
  const h = Ru.mpCost(c, 's_fire_2'), full = DB.spells.s_fire_2.mp;
  check(a > 0 && b === 0 && Ru.profMpKind(c, 's_fire_1') === 'free', `rank 14 → the element's step-1 spells cost 0 MP (${a} → ${b})`);
  check(h === Math.max(1, Math.ceil(full / 2)) && Ru.profMpKind(c, 's_fire_2') === 'half', `rank 32 → step-2 spells cost half (${full} → ${h})`);
  const rows = [];
  for (const el of Ru.ELEMENTS) rows.push(el.padEnd(6) + [1, 2, 3, 4, 5].map((st) => { const s = DB.spells[`s_${el}_${st}`]; return s ? String(s.mp).padStart(4) : '   -'; }).join(''));
  console.log('\nMP of the single spells (steps 1–5)\n' + rows.join('\n'));
}
console.log('\n' + results.join('\n'));
console.log(`\nsim_spells: ${results.filter((x) => x.startsWith('PASS')).length}/${results.filter((x) => !x.startsWith('NOTE')).length} passed (notes are reference values outside the slice)`);
if (fails) process.exitCode = 1;
