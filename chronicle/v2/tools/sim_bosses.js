#!/usr/bin/env node
// sim_bosses（BATTLE）: ボスの 3 本立て（WORLD_REDESIGN §4.10 の 6、V2_PLAN §3.6 の表・§3.16 の 7）。
//
//   node v2/tools/sim_bosses.js [--n 300] [--troop tr_b_moth] [--seed 20260926] [--log]   （--log: 各ボスの台本の 1 戦の出来事の列を書き出す）
//
// 3 本: 「たたかう」だけ（全員が通常攻撃）／「リピート」だけ（1 ラウンド目に強い技をそろえ、あとはリピート。回復も予告への対処もしない）／
// 台本（予告を見て守る・狙いを変える・属性を変える・HP が半分を切ったら回復）。一行は sim_zones の buildParty（gl = glAt(T, kind)、
// そのティアの店の品）、道具は店の回復・状態の品。ラウンド数と倒れる人は台本で数える（STATS_REWORK §6.5 B1）。
'use strict';
const path = require('path');
const fs = require('fs');
const { buildParty, STD } = require('./sim_zones');

const ITEMS = { i_salve: 6, i_revive: 2, i_waker: 4, i_antidote: 3, i_clear: 2, i_firepot: 3 };
/** V2_PLAN §3.6 の表 */
const BOSSES = {
  tr_tutorial: { tier: 0, kind: 'start', members: [], gl: 2, gear: 'start', glimmerForce: 'hero', note: '閃きの教え（負けても続く）', script: 100 },
  tr_b_pageeater: { tier: 0, kind: 'prologue', members: STD, fight: 50, repeat: 50, script: 95, rounds: [6, 11], note: '序章。紙を吸いこむ → 紙吹雪（防御で半分）' },
  tr_a21_forest_wolves: { tier: 0, kind: 'mid', members: STD, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [5, 7], note: '遠吠えで狼が増える → 頭を先に' },
  tr_b_moth: { tier: 0, kind: 'mid', members: STD, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [5, 7], note: '羽が光る → 眠りのりん粉（風で吹き飛ぶ・目覚まし）' },
  tr_b_rooteater: { tier: 0, kind: 'boss', members: STD, fight: 20, repeat: 30, script: 90, diff: 50, rounds: [8, 11], note: '根がもぐる → 前列へ突き上げ（守る）、火で根を焼く' },
};
// 砂漠（ザハラ砂漠、src/data/bosses_desert.js）。地方は好きな順に遊ぶので、ティア 0・1・3 で測る。
// 砂もぐりの答えの土は、カシムの道具屋の土の魔石（台本の道具に足す）
{
  const DITEMS = Object.assign({}, ITEMS, { i_stone_earth: 4 });
  for (const T of [0, 1, 3]) {
    const k = T === 0 ? '' : '@' + T;
    BOSSES['tr_b_hawkchief' + k] = { troop: 'tr_b_hawkchief', tier: T, kind: 'mid', members: STD, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [5, 9], note: '弓兵に守られた頭 → 弓兵を先に。砂を巻き上げる → 守る（守らないと最大 HP の 9 割）' };
    BOSSES['tr_b_sandworm' + k] = { troop: 'tr_b_sandworm', tier: T, kind: 'mid', members: STD, items: DITEMS, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [5, 10], note: '身を沈める → もぐったら守る（守らないと倒れる）、もぐっている間は土と突きだけ効く' };
    BOSSES['tr_b_sandking' + k] = { troop: 'tr_b_sandking', tier: T, kind: 'boss', members: STD, fight: 20, repeat: 30, script: 90, diff: 50, rounds: [8, 13], note: '日と月の玉を先に割る、杖を掲げたら守る（火で砂を焼き固めてもよい）' };
  }
  BOSSES['tr_b_hawkhold@3'] = { troop: 'tr_b_hawkhold', tier: 3, kind: 'mid', members: STD, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [6, 10], note: 'アジトの奥（弓兵 3 人）' };
}
// 雪原（ノルデン雪原、src/data/bosses_snow.js）。好きな順に遊ぶので、ティア 0・1・3 で測る。
// 氷の巨人の答えの火は、ユールの道具屋の火炎つぼ（i_firepot。峰の前に買い足す前提で 6 個）
const SITEMS = Object.assign({}, ITEMS, { i_firepot: 6 });
for (const T of [0, 1, 3]) {
  const k = T === 0 ? '' : '@' + T;
  // ティア 0（森を解く前に北へ来た一行）は籠城の山場として重め: 台本 65%・倒れる 1.6 人・12 ラウンドまで（宿で整え直せる）
  BOSSES['tr_b_blizzardwolf_0' + k] = { troop: 'tr_b_blizzardwolf_0', tier: T, kind: 'mid', members: STD, fight: 35, repeat: 30, script: T ? 90 : 65, down: T ? 1.0 : 1.6, diff: 50, rounds: T ? [5, 8] : [5, 12], note: '籠城の最後の波。遠吠え → 吹雪（守る）、手下を呼ぶ → 頭を先に' };
  BOSSES['tr_b_icegiant' + k] = { troop: 'tr_b_icegiant', tier: T, kind: 'mid', members: STD, items: SITEMS, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [5, 8], note: '白く光る → 氷の鎧（火で消す・張っても火でとける）' };
  BOSSES['tr_b_whitedragon' + k] = { troop: 'tr_b_whitedragon', tier: T, kind: 'boss', members: STD, fight: 20, repeat: 30, script: 90, diff: 50, rounds: [8, 12], note: '息を吸う → 白い息（守る）。半分で思い出す間' };
}
BOSSES['tr_b_frost_admiral@6'] = { troop: 'tr_b_frost_admiral', tier: 6, kind: 'boss', members: STD, fight: 20, repeat: 30, script: 85, diff: 40, rounds: [8, 13], note: '氷に閉じた帆船（隠しボス。ティア 6 から）' };
// 湿原（グレイモア湿原、src/data/bosses_marsh.js）。好きな順に遊ぶので、ティア 1・3 で測る（湿原は縦切りの後）
for (const T of [1, 3]) {
  const k = '@' + T;
  BOSSES['tr_b_dolls' + k] = { troop: 'tr_b_dolls', tier: T, kind: 'mid', members: STD, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [5, 9], note: '指揮者を先に（楽士を起こす）、棒を掲げたら守る' };
  BOSSES['tr_b_mistbeast' + k] = { troop: 'tr_b_mistbeast', tier: T, kind: 'boss', members: STD, fight: 20, repeat: 30, script: 90, diff: 50, rounds: [8, 13], note: '霧を集めたら守る、分身は後回し、半分を切ったら物理で押す' };
}
// 灰の荒野（src/data/bosses_ash.js）。好きな順に遊ぶので、ティア 1・3 で測る。大会の 1〜4 回戦は間に全快の連戦（負けてもその回から）
for (const T of [1, 3]) {
  const k = '@' + T;
  BOSSES['tr_ash_r2' + k] = { troop: 'tr_ash_r2', tier: T, kind: 'mid', members: STD, fight: 60, repeat: 60, script: 95, rounds: [4, 8], note: '獣使いを先に（獣が座る）、口笛が鳴ったら守る' };
  BOSSES['tr_ash_r3' + k] = { troop: 'tr_ash_r3', tier: T, kind: 'mid', members: STD, fight: 60, repeat: 60, script: 95, rounds: [4, 8], note: '姉を先に（妹を起こす）、妹の詠唱が来たら守る' };
  BOSSES['tr_ash_r4' + k] = { troop: 'tr_ash_r4', tier: T, kind: 'mid', members: STD, fight: 50, repeat: 50, script: 92, rounds: [5, 9], note: '硬い。振りかぶったら守る' };
  BOSSES['tr_b_zakuro' + k] = { troop: 'tr_b_zakuro', tier: T, kind: 'mid', members: STD, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [6, 10], note: '大会の決勝。居合の構え（「構えな」）→ 守る。半分で二本目' };
  BOSSES['tr_b_hellhound' + k] = { troop: 'tr_b_hellhound', tier: T, kind: 'mid', members: STD, fight: 35, repeat: 30, script: 90, diff: 50, rounds: [5, 9], note: '二つの頭が息を吸ったら守る。水に弱い' };
  BOSSES['tr_b_lavabeast' + k] = { troop: 'tr_b_lavabeast', tier: T, kind: 'boss', members: STD, fight: 20, repeat: 30, script: 90, diff: 50, rounds: [8, 13], note: '背の火口がふくれたら守る。半分で冷えて硬くなる' };
}

function loadR() { return require('./lib/load')({ quiet: true }); }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

function runStyle(R, troop, style, n, seed, cfg) {
  const ITEMS = cfg.items || module.exports.ITEMS;
  troop = cfg.troop || troop;
  const party = buildParty(R, Object.assign({ seed: 5, items: ITEMS }, cfg));
  const out = { win: 0, rounds: [], down: [], tele: 0, answered: 0 };
  let sample = null;
  for (let i = 0; i < n; i++) {
    const ai = R.BattleAI.styleAI(style);
    const s = R.BattleCore.simulate({ party, troop, tier: cfg.tier, seed: `${seed}:${troop}:${style}:${i}`, inv: ITEMS, maxRounds: 40, glimmerForce: cfg.glimmerForce, ai, events: style === 'script' && i === 0, log: style === 'script' && i === 0 });
    if (s.result === 'win') out.win++;
    out.rounds.push(s.rounds);
    out.down.push(s.eng.party.filter((p) => !p.alive).length + 0 * s.deaths);
    if (!sample && s.events) sample = s;
  }
  return { winPct: (100 * out.win) / n, rounds: mean(out.rounds), down: mean(out.down), sample, party };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const n = +arg('--n', argv.includes('--quick') ? 80 : 300);
  const seed = arg('--seed', '20260926');
  const only = arg('--troop', null);
  const R = loadR();
  console.log(`sim_bosses: n=${n} seed=${seed}（fight = たたかうだけ、repeat = リピートだけ、script = 正しく対処する台本）`);
  console.log('troop                  fight%  repeat%  script%  差    rounds  倒れる  判定');
  const rows = [];
  let failed = false;
  for (const t of only ? [only] : Object.keys(BOSSES)) {
    const cfg = BOSSES[t];
    const f = cfg.members.length || t !== 'tr_tutorial' ? runStyle(R, t, 'fight', n, seed, cfg) : null;
    const rp = cfg.members.length ? runStyle(R, t, 'repeat', n, seed, cfg) : null;
    const sc = runStyle(R, t, 'script', n, seed, cfg);
    const fail = [];
    if (cfg.fight != null && f && f.winPct > cfg.fight) fail.push(`fight ${f.winPct.toFixed(0)} > ${cfg.fight}`);
    if (cfg.repeat != null && rp && rp.winPct > cfg.repeat) fail.push(`repeat ${rp.winPct.toFixed(0)} > ${cfg.repeat}`);
    if (cfg.script != null && sc.winPct < cfg.script) fail.push(`script ${sc.winPct.toFixed(0)} < ${cfg.script}`);
    const diff = rp ? sc.winPct - rp.winPct : 0;
    if (cfg.diff != null && diff < cfg.diff) fail.push(`diff ${diff.toFixed(0)} < ${cfg.diff}`);
    if (cfg.rounds && (sc.rounds < cfg.rounds[0] || sc.rounds > cfg.rounds[1])) fail.push(`rounds ${sc.rounds.toFixed(1)} ∉ ${cfg.rounds.join('–')}`);
    if (cfg.members.length && sc.down > (cfg.down || 1.0)) fail.push(`down ${sc.down.toFixed(2)} > ${cfg.down || 1.0}`);
    failed = failed || fail.length > 0;
    rows.push({ troop: t, fight: f && f.winPct, repeat: rp && rp.winPct, script: sc.winPct, diff, rounds: sc.rounds, down: sc.down, fail });
    const p = (v) => (v == null ? '   —' : v.toFixed(0).padStart(4));
    console.log(`${t.padEnd(22)} ${p(f && f.winPct)}    ${p(rp && rp.winPct)}     ${p(sc.winPct)}  ${p(rp ? diff : null)}  ${sc.rounds.toFixed(1).padStart(5)}  ${sc.down.toFixed(2).padStart(5)}  ${fail.length ? 'FAIL ' + fail.join('; ') : 'pass'}`);
    if (argv.includes('--log') && sc.sample) {
      const dir = path.join(__dirname, '..', 'design', 'shots', 'battle');
      fs.mkdirSync(dir, { recursive: true });
      const lines = [`# ${t}（${cfg.note}）台本の 1 戦目。seed ${seed}:${t}:script:0 → ${sc.sample.result} / ${sc.sample.rounds} ラウンド`,
        `# 一行: ${sc.party.map((c) => `${c.name}(${c.id}, gl ${c.gl}, ${R.Rules.weaponType(c)}, ${c.row})`).join(' / ')}`, ''];
      for (const e of sc.sample.events) lines.push(JSON.stringify(e));
      fs.writeFileSync(path.join(dir, `events_${t}.txt`), lines.join('\n') + '\n');
    }
  }
  if (argv.includes('--log')) console.log('events written to v2/design/shots/battle/events_<troop>.txt');
  if (failed && !argv.includes('--no-exit')) process.exitCode = 1;
  return rows;
}

module.exports = { BOSSES, ITEMS, runStyle };
if (require.main === module) main();
