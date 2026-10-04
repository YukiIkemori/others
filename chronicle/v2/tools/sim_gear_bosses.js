#!/usr/bin/env node
// sim_gear_bosses（RULES・BATTLE）: 装備の段ごとの、終章の最後のボスとクリア後のボスの勝ち率（持ち主 2026-10-04「装備のティアの見直し」。design/notes/gear_tiers.md）。
//
//   node v2/tools/sim_gear_bosses.js [--n 120] [--seed 20261004] [--troop tr_b_ouroboros] [--case P-d] [--gear] [--check]
//
// 一行は sim_bosses と同じ標準（主人公 戦士・剣 ＋ bartolo・marta・sylvain、gl = glAt(T, 'boss')、そのティアの技と術、台本の AI）。
// 装備だけを段ごとに入れ替える（枠ごとに付けられる品のいちばん強い物。武器は今の系統のまま）:
//   終章 T8（ネムレア 第 1・第 2 形態）
//     F-a 店 8 だけ                F-b 店 8 ＋ レア 9 を 3 枠（武器・体・頭）   F-c レア 9 を全部 ＋ 超レア 10 を 2 枠（武器・体）
//   クリア後 T9（バルザードの残響・円環竜）
//     P-a 店 8 だけ                P-b 店 8 ＋ 通常の落とし物 9（天鋼・天馬革・虹絹…）
//     P-c 本編のいちばん良い物（レア 9・超レア 10 ＋ 通常 9）
//     P-d レア 11 を全部（＋ P-c）   P-e レア 11 ＋ 超レア 12 の落とし物（盗み専用の 12 は無し）   P-f 11・12 を全部
// ★ の伸びる品（grow 'drop'）は手に入れたティアの値（R.Game.uniques。T8 = レア 9・超レア 10）。
// --check: 持ち主の目安（TARGET・TARGET_BY）で判定。外れたら終了コード 1
'use strict';
const PM = require('./lib/party_model');

const ITEMS = { i_salve: 6, i_revive: 2, i_waker: 4, i_antidote: 3, i_clear: 2, i_firepot: 3 };
const MEMBERS = ['hero', 'bartolo', 'marta', 'sylvain'];
const ROWS = { hero: 'front', bartolo: 'front', marta: 'back', sylvain: 'back' };
const ARMOR = ['shield', 'head', 'body', 'hands', 'feet'];
const SLOTS = ['weapon1', 'shield', 'head', 'body', 'hands', 'feet'];

const FIGHTS = {
  'tr_b_nemrea1': { tier: 8, cases: ['F-a', 'F-b', 'F-c'] },
  'tr_b_nemrea2': { tier: 8, cases: ['F-a', 'F-b', 'F-c'] },
  'tr_b_valzard_echo': { tier: 9, cases: ['P-a', 'P-b', 'P-c', 'P-d', 'P-e', 'P-f'] },
  'tr_b_ouroboros': { tier: 9, cases: ['P-a', 'P-b', 'P-c', 'P-d', 'P-e', 'P-f'] },
};
// 持ち主の目安（--check）。[下限, 上限]（台本の勝ち率 %）。最後のボス: 店 8 だけでは負ける・レア 9 で勝てる・超レア 10 で楽。
//   残響（クリア後の門番）: 本編の品では苦しい、レア 11 で勝ち目、超レア 12 で勝てる。円環竜（裏ボス）: 11〜12 をそろえて勝てる
const TARGET = {
  'F-a': [0, 35], 'F-b': [30, 85], 'F-c': [60, 100],
  'P-a': [0, 15], 'P-b': [0, 15], 'P-c': [0, 35], 'P-d': [10, 70], 'P-e': [35, 100], 'P-f': [55, 100],
};
// 持ち主 2026-10-04「中ボスとオウロボラの違いがない」: 魔王の残影はティア 9＋レア・超レアで倒せる中ボス、オウロボラはティア 11〜12 が要る裏ボス
const TARGET_BY = { tr_b_ouroboros: { 'P-c': [0, 15], 'P-d': [0, 40], 'P-e': [35, 85], 'P-f': [50, 100] },
  tr_b_valzard_echo: { 'P-c': [15, 60], 'P-d': [35, 90], 'P-e': [80, 100], 'P-f': [90, 100] } };

function gearPools(R) {
  const DB = R.DB, Ru = R.Rules;
  const all = Object.keys(DB.items).filter((id) => { const it = DB.items[id]; return it && (it.slot === 'weapon' || ARMOR.includes(it.slot)); });
  const shop8 = new Set();
  for (const sid of Object.keys(DB.shops)) for (const id of Ru.shopItems(sid, 8)) { const it = DB.items[id]; if (it && (it.slot === 'weapon' || ARMOR.includes(it.slot)) && (it.grade || 'normal') === 'normal') shop8.add(id); }
  const norm9 = all.filter((id) => DB.items[id].grade === 'normal' && DB.items[id].tier === 9 && DB.items[id].src === 'shop');
  // 本編の ★: レア = 帯のレアのティア 9 の系列（src 'drop'。朝焼けの剣・覇王の鎧…。終章で手に入れて値 9）、
  //   超レア = 超レアの系列（src 'super'、ティア 8〜9。終章で手に入れて値 10）。魔物ごとの一点物（mdrop・steal）は数えない（控えめの見込み）
  const main = (g) => all.filter((id) => { const it = DB.items[id]; return it.grade === g && !it.fixedTier && !it.quirk && (g === 'rare' ? it.src === 'drop' && it.tier === 9 : it.src === 'super' && it.tier >= 8); });
  const post = (t, pred) => all.filter((id) => { const it = DB.items[id]; return it.fixedTier && it.tier === t && (!pred || pred(it)); });
  return { shop8: [...shop8], norm9, rare: main('rare'), super: main('super'), p11: post(11), p12drop: post(12, (it) => !it.stealOnly), p12: post(12) };
}

/** 一行を作り、case の装備を付ける → {party, notes} */
function setup(R, tier, kase, P) {
  const r = PM.build(R, { tier, kind: 'boss', members: MEMBERS, heroType: 'warrior', fav: 'sword', rows: ROWS, gear: 'shop' });
  const party = r.party;
  const G = R.Game;
  const Ru = R.Rules;
  const acq = Math.min(8, tier);   // 本編の ★ は終章（T8）で手に入れた値（レア 9・超レア 10）
  const val = (id) => {
    const it = R.DB.items[id];
    if (it && it.grow === 'drop') { const f = Ru.fillItem(it, { tier: acq }); G.uniques[id] = { tier: acq, atk: f.atk, mag: f.mag, def: f.def, mdef: f.mdef }; }
    return Ru.itemOf(id);
  };
  const score = (c, id) => {
    const it = val(id), m = it.mods || {};
    if (it.slot === 'weapon') {
      const healer = c.id === 'marta';
      const base = it.wtype === 'staff' ? it.mag : it.atk;
      return base * (1 + ((m.physPct || 0) + (m.magicPct || 0) + (healer ? (m.healPct || 0) : 0)) / 200) + (it.crit || 0) * 0.5;
    }
    return (it.def || 0) + (it.mdef || 0) + (m.hpPct || 0) * 2 + (m.takenPct ? -m.takenPct * 3 : 0);
  };
  const pick = (c, slot, list) => {
    const wt = Ru.weaponType(c);
    let best = null, bs = -1;
    for (const id of list) {
      const it = R.DB.items[id];
      if (slot === 'weapon1' && it.wtype !== wt) continue;
      if (slot !== 'weapon1' && it.slot !== slot) continue;
      if (!Ru.canEquip(c, id, slot)) continue;
      const s = score(c, id);
      if (s > bs) { bs = s; best = id; }
    }
    return best;
  };
  const stat = (c) => ({ sword: 'str', greatsword: 'str', dagger: 'dex', bow: 'dex', staff: c.id === 'marta' ? 'mnd' : 'int' }[Ru.weaponType(c)] || 'str');
  const accFor = (c, lvl) => {
    const s = stat(c), has = (id) => !!R.DB.items[id];
    const shop = `ac_${s}_8`, r9 = has(`ac_r9_${s}`) ? `ac_r9_${s}` : shop;
    if (lvl === 'shop') return [shop, shop];
    if (lvl === 'r9') return [r9, shop];
    if (lvl === 'r10') return [r9, has('ac_sr_beastheart') && s === 'str' ? 'ac_sr_beastheart' : r9];
    const phys = s === 'str' || s === 'dex';
    if (lvl === 'p11') return ['ac_p11_ember', phys ? 'ac_p11_compass' : 'ac_p11_letter'];
    if (lvl === 'p12d') return ['ac_p12_morning', phys ? 'ac_p11_compass' : 'ac_p11_letter'];
    return ['ac_p12_morning', 'ac_st_p12_wick'];
  };
  const plan = {
    'F-a': { base: P.shop8, acc: 'shop' },
    'F-b': { base: P.shop8, extra: { slots: ['weapon1', 'body', 'head'], list: P.rare }, acc: 'shop' },
    'F-c': { base: P.shop8.concat(P.rare), extra: { slots: ['weapon1', 'body'], list: P.super }, acc: 'r9' },
    'P-a': { base: P.shop8, acc: 'shop' },
    'P-b': { base: P.shop8.concat(P.norm9), acc: 'shop' },
    'P-c': { base: P.shop8.concat(P.norm9, P.rare, P.super), acc: 'r10' },
    'P-d': { base: P.shop8.concat(P.norm9, P.rare, P.super, P.p11), acc: 'p11' },
    'P-e': { base: P.shop8.concat(P.norm9, P.rare, P.super, P.p11, P.p12drop), acc: 'p12d' },
    'P-f': { base: P.shop8.concat(P.norm9, P.rare, P.super, P.p11, P.p12), acc: 'p12' },
  }[kase];
  for (const c of party) {
    for (const s of SLOTS) {
      if (s === 'shield' && Ru.hasTwoHanded(c)) { c.equip.shield = null; continue; }
      const id = pick(c, s, plan.base);
      if (id) c.equip[s] = id;
    }
    if (plan.extra) for (const s of plan.extra.slots) { const id = pick(c, s, plan.extra.list); if (id) c.equip[s] = id; }
    const [a1, a2] = accFor(c, plan.acc);
    c.equip.acc1 = a1; c.equip.acc2 = a2;
    if (Ru.hasTwoHanded(c)) c.equip.shield = null;
    Ru.fullRestore(c);
  }
  return party;
}

function run(R, troop, kase, n, seed) {
  const cfg = FIGHTS[troop];
  const P = gearPools(R);
  R.State.newGame({ seed: 1 });
  R.Game.tier = Math.min(8, cfg.tier);
  R.Game.uniques = {};
  const party = setup(R, cfg.tier, kase, P);
  let win = 0, rounds = 0, down = 0;
  for (let i = 0; i < n; i++) {
    const ai = R.BattleAI.styleAI('script');
    const s = R.BattleCore.simulate({ party, troop, tier: cfg.tier, seed: `${seed}:${troop}:${kase}:${i}`, inv: ITEMS, maxRounds: 40, ai });
    if (s.result === 'win') win++;
    rounds += s.rounds;
    down += s.eng.party.filter((p) => !p.alive).length;
  }
  return { winPct: 100 * win / n, rounds: rounds / n, down: down / n, party };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const n = +arg('--n', 120), seed = arg('--seed', '20261004');
  const onlyT = arg('--troop', null), onlyC = arg('--case', null);
  const R = require('./lib/load')({ quiet: true });
  console.log(`sim_gear_bosses: n=${n} seed=${seed}（台本の AI。勝ち率 %・ラウンド・倒れる人）`);
  let bad = 0;
  const out = [];
  for (const [troop, cfg] of Object.entries(FIGHTS)) {
    if (onlyT && troop !== onlyT) continue;
    for (const k of cfg.cases) {
      if (onlyC && k !== onlyC) continue;
      const r = run(R, troop, k, n, seed);
      const t = (TARGET_BY[troop] && TARGET_BY[troop][k]) || TARGET[k], ok = r.winPct >= t[0] && r.winPct <= t[1];
      if (!ok) bad++;
      out.push({ troop, kase: k, winPct: r.winPct, rounds: r.rounds, down: r.down });
      console.log(`${troop.padEnd(18)} ${k}  win ${r.winPct.toFixed(0).padStart(3)}%  rounds ${r.rounds.toFixed(1).padStart(4)}  down ${r.down.toFixed(2)}  目安 ${t[0]}〜${t[1]}% ${ok ? 'pass' : 'FAIL'}`);
      if (argv.includes('--gear')) for (const c of r.party) console.log('    ' + c.id.padEnd(8) + ' ' + SLOTS.concat(['acc1', 'acc2']).map((s) => { const it = R.Rules.itemOf(c.equip[s]); return it ? `${it.name}` : '-'; }).join(' / '));
    }
  }
  if (argv.includes('--check') && bad) process.exitCode = 1;
  return out;
}

module.exports = { FIGHTS, TARGET, TARGET_BY, gearPools, setup, run };
if (require.main === module) main();
