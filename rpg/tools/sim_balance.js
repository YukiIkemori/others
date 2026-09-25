#!/usr/bin/env node
// Balance simulator (owner: monsters). Plays the real battle engine
// (R.Battle.simulate: same resolution code and AI as the game) with a party
// built the way a player would have it at each point of the game.
//
//   node tools/sim_balance.js                 everything (≈1 min)
//   node tools/sim_balance.js --only party,zones,bosses,crawl,campaign,loot
//   node tools/sim_balance.js --zones w_start,d_wind1 --n 300 --boss boss_wind --seed 7
//   options: --both (zones also at the leave level) --verbose (every group) --grind (campaign fights until the plan level)
//
// Party model (per stage of DESIGN §7.4): level = the stage's level, JP earned ≈
// 12·Lv² (the jobs checker's pacing model) spread along a sensible job plan per
// character, abilities bought in a player's priority order, the best shop equipment
// of the towns visited so far, band consumables in the bag.
// Sections: party (the model) · zones (every encounter group at the arrival level) ·
// bosses (±2 levels) · crawl (a dungeon floor / whole dungeon without resting) ·
// campaign (a natural playthrough: levels, JP, gold vs shop prices) · loot (rare drops).
// Targets: zones win ≈100 %, 2–5 rounds, 5–25 % party HP lost (a bit more late);
// bosses 60–90 % at the stage's upper level with healing, 6–15 rounds;
// campaign: 20–40 fights per band, ≈1 job level per 6–10 fights early.
// The simulated party uses the game's own battle AI (R.BattleAI), which spends MP
// freely; the crawl section replays it with a thriftier player instead.
'use strict';
const R = require('./lib/load')({ quiet: true });
R.warn = () => {};
const { DB, U, Rules, State } = R;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = arg('only', 'party,zones,bosses,campaign,crawl,loot').split(',');
const N = +arg('n', 200);
const SEED = +arg('seed', 1234);
const ZONE_FILTER = arg('zones', null) ? arg('zones').split(',') : null;
const BOSS_FILTER = arg('boss', null) ? arg('boss').split(',') : null;
const VERBOSE = argv.includes('--verbose');
const GRIND = argv.includes('--grind'); // campaign: keep fighting until the stage's leave level

// --------------------------------------------------------------- stages
// towns: shops available (cumulative). lv: [arrive, leave]. boss fought at bossLv.
const STAGES = [
  { id: 'regnas', zones: ['w_start'], towns: ['regnas'], lv: [1, 3], fights: 9 },
  { id: 'milt', zones: ['w_start'], towns: ['milt'], lv: [3, 4], fights: 9 },
  { id: 'wind', zones: ['d_wind1', 'd_wind2'], towns: [], lv: [4, 6], boss: ['boss_wind'], bossLv: 6, fights: 14 },
  { id: 'east', zones: ['w_east'], towns: ['porta'], lv: [6, 8], fights: 9 },
  { id: 'fort', zones: ['d_fort1', 'd_fort2'], towns: [], lv: [8, 11], boss: ['boss_fort'], bossLv: 11, fights: 14 },
  { id: 'forest', zones: ['w_sea1', 'w_forest'], towns: ['elfin'], lv: [11, 13], fights: 9 },
  { id: 'water', zones: ['d_water1', 'd_water2'], towns: [], lv: [13, 15], boss: ['boss_water'], bossLv: 15, fights: 14 },
  { id: 'desert', zones: ['w_desert'], towns: ['salva'], lv: [15, 16], fights: 9 },
  { id: 'pyramid', zones: ['d_pyr1', 'd_pyr2', 'd_pyr3'], towns: [], lv: [16, 18], boss: ['boss_pyramid'], bossLv: 18, fights: 18 },
  { id: 'snow', zones: ['w_sea2', 'w_snow'], towns: ['frost'], lv: [18, 20], fights: 9 },
  { id: 'ice', zones: ['d_ice1', 'd_ice2'], towns: [], lv: [20, 22], boss: ['boss_ice'], bossLv: 22, fights: 14 },
  { id: 'volcano_w', zones: ['w_volcano'], towns: [], lv: [22, 24], fights: 9 },
  { id: 'volcano', zones: ['d_vol1', 'd_vol2'], towns: [], lv: [24, 26], boss: ['boss_volcano'], bossLv: 26, fights: 14 },
  { id: 'arcana', zones: ['w_arcana'], towns: ['arcana'], lv: [26, 27], fights: 9 },
  { id: 'star', zones: ['d_star1', 'd_star2', 'd_star3', 'd_star4'], towns: [], lv: [27, 30], boss: ['boss_star'], bossLv: 30, fights: 22 },
  { id: 'sea3', zones: ['w_sea3'], towns: ['edge_shrine'], lv: [30, 32], fights: 9 },
  { id: 'demon_isle', zones: ['w_demon'], towns: [], lv: [32, 33], fights: 9 },
  { id: 'demon1', zones: ['d_demon1', 'd_demon2'], towns: [], lv: [33, 35], boss: ['boss_general1'], bossLv: 35, fights: 14 },
  { id: 'demon2', zones: ['d_demon3', 'd_demon4'], towns: [], lv: [35, 38], boss: ['boss_general2'], bossLv: 38, fights: 14 },
  { id: 'demon3', zones: ['d_demon5'], towns: [], lv: [38, 40], boss: ['boss_king1', 'boss_king2'], bossLv: 40, fights: 8 },
];
const townsUpTo = (i) => STAGES.slice(0, i + 1).flatMap((s) => s.towns);

// ------------------------------------------------------------ job plans
// [job, target job level, main?]  main jobs are the ones the character fights in;
// the others are detours for unlocks (their JP is earned, the char is shown in the main job).
const PLANS = {
  yuki: {
    steps: [['warrior', 3, 1], ['knight', 5, 1], ['priest', 3], ['whitemage', 4], ['paladin', 5, 1], ['mage', 3], ['blackmage', 3], ['spellblade', 5], ['hero', 8, 1], ['paladin', 8]],
    sub: { warrior: null, knight: 'warrior', paladin: 'knight', hero: 'paladin' },
    reaction: ['paladin_last_stand', 'warrior_counter', 'knight_iron_wall', 'warrior_brace'],
    support: ['hero_heart', 'warrior_hp_up', 'warrior_crit_up', 'knight_guard_stance'],
  },
  non: {
    steps: [['priest', 3, 1], ['whitemage', 6, 1], ['mage', 3], ['blackmage', 5], ['sage', 8, 1], ['whitemage', 8]],
    sub: { priest: null, whitemage: 'priest', sage: 'whitemage' },
    reaction: ['whitemage_mending_hand', 'sage_mana_return', 'priest_mp_regain'],
    support: ['whitemage_heal_up', 'sage_half_mp', 'priest_mnd_up', 'mage_mp_up'],
  },
  metem: {
    steps: [['mage', 3, 1], ['blackmage', 5, 1], ['priest', 2], ['thief', 2], ['bard', 3], ['timemage', 5], ['blackmage', 8, 1], ['timemage', 8]],
    sub: { mage: null, blackmage: 'mage' },
    subLate: 'timemage',
    reaction: ['blackmage_awaken', 'mage_ward'],
    support: ['blackmage_magic_up', 'mage_int_up', 'mage_mp_up', 'mage_mp_save'],
  },
};
// JP earned ≈ 12·Lv²; plans advance at 1/1.5 of it (the rest goes into abilities bought on the way)
const jpBudget = (L) => 12 * L * L / 1.5;
// what a player buys first in each job (the rest follows in menu order)
const PRIORITY = {
  warrior: ['warrior_power_slash', 'warrior_double', 'warrior_sweep', 'warrior_hp_up', 'warrior_counter'],
  knight: ['knight_full_power', 'knight_bash', 'knight_oath'],
  priest: ['priest_heal', 'priest_heal_all', 'priest_revive', 'priest_cure', 'priest_awaken'],
  whitemage: ['whitemage_healing', 'whitemage_heal_wind', 'whitemage_resurrect', 'whitemage_esuna', 'whitemage_heal_up', 'whitemage_mending_hand'],
  mage: ['mage_fire', 'mage_ice', 'mage_thunder', 'mage_wind', 'mage_missile'],
  blackmage: ['blackmage_fire2', 'blackmage_ice2', 'blackmage_thunder2', 'blackmage_blast', 'blackmage_inferno', 'blackmage_magic_up'],
  paladin: ['paladin_holy_blade', 'paladin_heal', 'paladin_cross', 'paladin_wave'],
  sage: ['sage_full_heal', 'sage_blessed_rain', 'sage_mother', 'sage_prominence', 'sage_zero', 'sage_stardust'],
  timemage: ['timemage_haste', 'timemage_haste_all', 'timemage_meteor'],
  hero: ['hero_radiant', 'hero_verdict', 'hero_courage', 'hero_heart', 'hero_luminous', 'hero_hope'],
};

// band consumables carried into a stage (counts)
function bagFor(si) {
  const b = {};
  const add = (id, n) => { if (DB.items[id]) b[id] = (b[id] || 0) + n; };
  if (si <= 2) { add('herb', 6); add('antidote', 2); }
  else if (si <= 6) { add('herb', 4); add('healing_grass', 4); add('revive_feather', 1); add('antidote', 2); }
  else if (si <= 10) { add('healing_grass', 6); add('revive_feather', 2); add('mana_drop', 2); add('all_cure', 2); }
  else { add('nectar', 5); add('healing_grass', 4); add('revive_feather', 3); add('mana_drop', 3); add('all_cure', 3); }
  return b;
}

/** character c at level L following its plan */
function buildChar(id, L) {
  const c = Rules.newChar(id);
  c.level = L; c.exp = Rules.expForLevel(L);
  const plan = PLANS[id];
  let budget = jpBudget(L);
  const mains = [];
  for (const [job, lv, isMain] of plan.steps) {
    if (budget <= 0) break;
    if (!Rules.isJobUnlocked(c, job)) break;
    const rec = Rules.jobRec(c, job);
    const need = Math.max(0, Rules.JP_TABLE[lv - 1] - rec.total);
    const put = Math.min(need, budget);
    rec.total += put; rec.jp += put; budget -= put;
    if (isMain && !mains.includes(job)) mains.push(job);
  }
  // leftover JP goes to the last main job
  if (budget > 0) { const r = Rules.jobRec(c, mains[mains.length - 1]); r.total += budget; r.jp += budget; }
  // buy abilities: the player's priority first, then menu order
  for (const job in c.jobs) {
    const rec = c.jobs[job];
    const order = (PRIORITY[job] || []).filter((a) => DB.abilities[a]).concat(Rules.jobAbilities(job));
    for (const a of order) {
      if (rec.learned.includes(a) || DB.abilities[a].job !== job) continue;
      const cost = DB.abilities[a].jp || 0;
      if (cost <= rec.jp) { rec.jp -= cost; rec.learned.push(a); }
    }
  }
  // a sensible player fights in a new main job once it has a couple of abilities
  let main = mains[0];
  for (const j of mains) if (Rules.actionList(c, j).length >= 2 || Rules.jobLevel(c, j) >= 5) main = j;
  c.job = main;
  let sub = (plan.sub && plan.sub[main]) || null;
  if (main === 'blackmage' && plan.subLate && Rules.isJobUnlocked(c, plan.subLate) && Rules.actionList(c, plan.subLate).length >= 3) sub = plan.subLate;
  if (sub && (!Rules.isJobUnlocked(c, sub) || !Rules.actionList(c, sub).length)) sub = null;
  c.set.sub = sub;
  const pickLearned = (list) => list.find((a) => DB.abilities[a] && Rules.learned(c, a)) || null;
  c.set.reaction = pickLearned(plan.reaction);
  c.set.support = pickLearned(plan.support);
  return c;
}

function equipParty(party, towns) {
  R.Game.inv = {};
  for (const t of towns) for (const k of ['weapon', 'armor']) {
    const sh = DB.shops[t + '_' + k];
    if (sh) for (const it of sh.items) if (DB.items[it] && !DB.items[it].rare) R.Game.inv[it] = 3;
  }
  for (const c of party) {
    if (!towns.length) { const st = Rules.stats(c); c.hp = st.hp; c.mp = st.mp; continue; }
    for (const s of Rules.SLOTS) c.equip[s] = null;
    Rules.optimize(c);
    const st = Rules.stats(c);
    c.hp = st.hp; c.mp = st.mp; c.status = {};
  }
  R.Game.inv = {};
}

const partyCache = {};
function buildParty(si, L) {
  const key = si + ':' + L;
  if (partyCache[key]) return partyCache[key].map((c) => U.clone(c));
  State.newGame();
  // the very first fights happen in the starting clothes
  const towns = si === 0 && L <= 1 ? [] : townsUpTo(si);
  const party = R.PARTY_ORDER.map((id) => buildChar(id, L));
  R.Game.party = party;
  equipParty(party, towns);
  partyCache[key] = party.map((c) => U.clone(c));
  return party;
}

// --------------------------------------------------------------- output
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += /[\u3000-\uffff]/.test(ch) ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const padL = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const f0 = (x) => String(Math.round(x));
const warns = [];
const W = (m) => warns.push(m);

function describeChar(c) {
  const st = Rules.stats(c);
  const jl = Rules.jobLevel(c, c.job);
  return `${pad(c.name, 7)} ${pad(DB.jobs[c.job].name + jl, 16)} HP${padL(st.hp, 4)} MP${padL(st.mp, 4)} atk${padL(st.atk, 4)} def${padL(st.def, 4)} mag${padL(st.mag, 4)} mdf${padL(st.mdef, 4)} agi${padL(st.agi, 4)} | ` +
    `${Rules.SLOTS.map((s) => (c.equip[s] ? DB.items[c.equip[s]].name : '-')).join(' ')} | sub ${c.set.sub || '-'} ` +
    `acts ${Rules.actionList(c, c.job).length}${c.set.sub ? '+' + Rules.actionList(c, c.set.sub).length : ''}`;
}

// ================================================================ party
if (ONLY.includes('party')) {
  console.log('=== PARTY MODEL ===');
  STAGES.forEach((s, si) => {
    for (const L of [s.lv[0], s.bossLv || s.lv[1]].filter((v, i, a) => a.indexOf(v) === i)) {
      const p = buildParty(si, L);
      console.log(`-- ${s.id} Lv${L}`);
      for (const c of p) console.log('  ' + describeChar(c));
    }
  });
}

// ================================================================ zones
function runGroup(party, inv, mons, n, o) {
  const acc = { n: 0, win: 0, rounds: 0, hpLost: 0, mpUsed: 0, deaths: 0, exp: 0, gold: 0, jp: 0, lose: 0 };
  const mp0 = party.reduce((s, c) => s + c.mp, 0);
  const mpMax = party.reduce((s, c) => s + Rules.stats(c).mp, 0);
  for (let i = 0; i < n; i++) {
    const r = R.Battle.simulate(Object.assign({ party, inv, mons, items: false, seed: SEED * 7919 + i * 31 + 17 }, o || {}));
    acc.n++;
    if (r.result === 'win') acc.win++;
    if (r.result === 'lose') acc.lose++;
    acc.rounds += r.rounds;
    acc.hpLost += 100 - r.partyHpPct;
    acc.mpUsed += mpMax ? (100 * (mp0 - r.party.reduce((s, c) => s + c.mp, 0))) / mpMax : 0;
    acc.deaths += r.deaths;
    acc.exp += r.exp; acc.gold += r.gold; acc.jp += r.jp;
  }
  for (const k of ['rounds', 'hpLost', 'mpUsed', 'deaths', 'exp', 'gold', 'jp']) acc[k] /= acc.n;
  acc.winPct = (100 * acc.win) / acc.n;
  return acc;
}
const groupLabel = (grp) => grp.mons.map(([id, a, b]) => `${DB.monsters[id] ? DB.monsters[id].name : '??' + id}${a === b ? a : a + '-' + b}`).join(' ');
const groupWidth = (grp) => grp.mons.reduce((s, [id, a, b]) => {
  const m = DB.monsters[id];
  const w = { s: 32, m: 48, l: 64 }[({ jelly: 's', bat: 's', rat: 's', mushroom: 's', bee: 's', wisp: 's', imp: 's', mimic: 's', eyeball: 's', orc: 'l', golem: 'l', wyvern: 'l', chimera: 'l', yeti: 'l', kraken: 'l', demon: 'l', sandworm: 'l', minotaur: 'l' })[m && m.sprite] || 'm'];
  return s + w * b;
}, 0);

function zoneReport(z, si, L, verbose) {
  const e = DB.encounters[z];
  if (!e) { W(`zone ${z} missing`); return null; }
  const party = buildParty(si, L);
  const inv = bagFor(si);
  const totalW = e.groups.reduce((s, g) => s + g.w, 0);
  const avg = { winPct: 0, rounds: 0, hpLost: 0, mpUsed: 0, deaths: 0, exp: 0, gold: 0, jp: 0 };
  const rows = [];
  e.groups.forEach((grp, gi) => {
    const metal = grp.mons.every(([id]) => (DB.monsters[id].flags || []).includes('metal'));
    const r = runGroup(party, inv, grp.mons, metal ? Math.max(40, N / 2) : N);
    for (const k in avg) avg[k] += (r[k] * grp.w) / totalW;
    rows.push({ gi, grp, r, metal });
    if (groupWidth(grp) > 260) W(`${z} #${gi}: group ${groupLabel(grp)} is ${groupWidth(grp)} px wide`);
    if (!metal) {
      if (r.winPct < 97) W(`${z}@Lv${L} #${gi} ${groupLabel(grp)}: win ${f0(r.winPct)}%`);
      if (r.hpLost > 45) W(`${z}@Lv${L} #${gi} ${groupLabel(grp)}: loses ${f0(r.hpLost)}% HP`);
      if (r.rounds > 6) W(`${z}@Lv${L} #${gi} ${groupLabel(grp)}: ${f1(r.rounds)} rounds`);
    }
  });
  if (verbose) for (const { gi, grp, r, metal } of rows) {
    verbose.push(`    #${gi} w${padL(grp.w, 2)} ${pad(groupLabel(grp), 44)} win${padL(f0(r.winPct), 4)}%  rnd ${f1(r.rounds)}  hp-${padL(f0(r.hpLost), 3)}%  mp-${padL(f0(r.mpUsed), 3)}%  dead ${f1(r.deaths)}  exp ${padL(f0(r.exp), 5)} jp ${padL(f0(r.jp), 3)} g ${padL(f0(r.gold), 4)}${metal ? '  (metal)' : ''}`);
  }
  return avg;
}

if (ONLY.includes('zones')) {
  console.log('\n=== ZONES ===  (party at the zone\'s arrival level; weighted over groups; hp-/mp- = party HP/MP spent per fight)');
  const seen = new Set();
  STAGES.forEach((s, si) => {
    for (const z of s.zones) {
      if (ZONE_FILTER && !ZONE_FILTER.includes(z)) continue;
      const key = z + si;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const L of argv.includes('--both') ? [s.lv[0], s.lv[1]] : [s.lv[0]]) {
        const rows = [];
        const a = zoneReport(z, si, L, rows);
        if (!a) continue;
        console.log(`${pad(z, 10)} ${pad(s.id, 10)} Lv${padL(L, 2)}  win ${padL(f0(a.winPct), 3)}%  rounds ${f1(a.rounds)}  hp-${padL(f0(a.hpLost), 3)}%  mp-${padL(f0(a.mpUsed), 3)}%  deaths ${f1(a.deaths)}  exp ${padL(f0(a.exp), 5)}  jp ${padL(f0(a.jp), 3)}  gold ${padL(f0(a.gold), 4)}`);
        if (VERBOSE || ZONE_FILTER) for (const l of rows) console.log(l);
      }
    }
  });
}

// ================================================================ bosses
function bossReport(tid, si, L, n) {
  const party = buildParty(si, L);
  const inv = bagFor(si);
  const acc = { win: 0, rounds: 0, deaths: 0, hpLeft: 0, roundsWin: 0 };
  for (let i = 0; i < n; i++) {
    const r = R.Battle.simulate({ party, inv, troop: tid, items: true, maxRounds: 40, seed: SEED * 104729 + i * 13 + 5 });
    if (r.result === 'win') { acc.win++; acc.roundsWin += r.rounds; acc.hpLeft += r.partyHpPct; }
    acc.rounds += r.rounds; acc.deaths += r.deaths;
  }
  return { winPct: (100 * acc.win) / n, rounds: acc.rounds / n, roundsWin: acc.win ? acc.roundsWin / acc.win : 0, deaths: acc.deaths / n, hpLeft: acc.win ? acc.hpLeft / acc.win : 0 };
}
if (ONLY.includes('bosses')) {
  console.log('\n=== BOSSES ===  (items allowed; target 60–90 % at the stage\'s upper level, 6–15 rounds)');
  STAGES.forEach((s, si) => {
    for (const tid of s.boss || []) {
      if (BOSS_FILTER && !BOSS_FILTER.includes(tid)) continue;
      const line = [];
      for (const L of [s.bossLv - 2, s.bossLv, s.bossLv + 2]) {
        const r = bossReport(tid, si, L, L === s.bossLv ? Math.max(N, 200) : Math.max(60, N / 2));
        line.push(`Lv${L}: ${padL(f0(r.winPct), 3)}% ${f1(r.roundsWin)}r d${f1(r.deaths)} hp${padL(f0(r.hpLeft), 3)}%`);
        if (L === s.bossLv) {
          if (r.winPct < 55 || r.winPct > 93) W(`${tid} @Lv${L}: win ${f0(r.winPct)}% (target 60–90)`);
          if (r.roundsWin && (r.roundsWin < 5.5 || r.roundsWin > 15.5)) W(`${tid} @Lv${L}: ${f1(r.roundsWin)} rounds (target 6–15)`);
        }
      }
      console.log(`${pad(tid, 14)} ${line.join('   ')}`);
    }
    // the last two bosses are fought back to back: king2 with whatever king1 left
    if ((s.boss || []).length > 1 && !BOSS_FILTER) {
      const n = Math.max(N, 200);
      let win = 0;
      for (let i = 0; i < n; i++) {
        let party = buildParty(si, s.bossLv), inv = bagFor(si), ok = true;
        for (const tid of s.boss) {
          const r = R.Battle.simulate({ party, inv, troop: tid, items: true, maxRounds: 40, seed: SEED * 31 + i * 7 + tid.length });
          if (r.result !== 'win') { ok = false; break; }
          party = r.party; inv = r.inv;
        }
        if (ok) win++;
      }
      console.log(`${pad(s.boss.join('→'), 14)} back to back at Lv${s.bossLv} WITHOUT a rest in between: ${f0((100 * win) / n)}%  (the final event must restore the party before ${s.boss[s.boss.length - 1]})`);
    }
  });
}

// ================================================================= crawl
/**
 * Like R.Battle.simulate, but the party plays like a careful player in random fights:
 * damage spells/skills that cost MP only while the caster has plenty of MP left (or when
 * they hit several foes and it still has a fair amount); heals, revives and cures always.
 */
function simulateThrifty(o) {
  const B = R.Battle;
  const party = o.party.map((c) => U.clone(c));
  const inv = U.clone(o.inv || {});
  const eng = new B.Engine({ party, mons: B.buildMons(o), inv, live: false });
  B.drain(eng.begin());
  while (!eng.result && eng.round < 40) {
    const cmds = R.BattleAI.partyCommands(eng, { items: true });
    for (const u of eng.party) {
      const cmd = cmds[u.idx];
      if (!cmd || cmd.type !== 'ability') continue;
      const ab = DB.abilities[cmd.id];
      if (!ab || !ab.effects.some((e) => e.type === 'damage')) continue;
      const cost = eng.mpCost(u, cmd.id, ab);
      if (!cost) continue;
      const mpRate = u.mp / Math.max(1, u.mmp);
      const multi = ['group', 'enemies', 'random'].includes(ab.target) && eng.living('mon').length >= 2;
      // casters live on their spells; fighters keep MP for heals and bosses
      const caster = u.stat('mag') > u.stat('atk');
      const floor = caster ? (multi ? 0.1 : 0.2) : (multi ? 0.35 : 0.6);
      if (mpRate < floor) cmds[u.idx] = { type: 'attack', target: cmd.target && !cmd.target.isParty ? cmd.target : eng.living('mon')[0] };
    }
    B.drain(eng.playRound(cmds));
  }
  eng.finish();
  return { result: eng.result || 'timeout', rounds: eng.round, party, inv };
}
// A dungeon in one go: its fights back to back, healing between fights with the
// party's own field heals (MP) and herbs like a player would; reports how much is left.
function fieldHeal(party, inv) {
  const bestHeal = (c, hurt) => {
    let best = null;
    for (const job of [c.job, c.set.sub]) {
      if (!job) continue;
      for (const id of Rules.actionList(c, job)) {
        const ab = DB.abilities[id];
        const h = ab.effects.find((e) => e.type === 'heal');
        if (!h || !['ally', 'allies'].includes(ab.target)) continue;
        const cost = Rules.mpCost(c, id);
        if (cost > c.mp) continue;
        const amt = h.pct ? 999 : (h.power || 0) + Rules.stats(c).mnd * (h.scale != null ? h.scale : 0.6);
        // value = HP actually restored (all hurt members for group heals) per MP
        const tg = ab.target === 'allies' ? party.filter((x) => x.hp > 0) : [hurt];
        const val = tg.reduce((a, t) => a + Math.min(amt, Rules.stats(t).hp - t.hp), 0);
        const eff = val / Math.max(1, cost);
        if (!best || eff > best.eff) best = { id, ab, cost, amt, eff };
      }
    }
    return best;
  };
  for (let guard = 0; guard < 30; guard++) {
    const hurt = party.filter((c) => c.hp > 0).sort((a, b) => a.hp / Rules.stats(a).hp - b.hp / Rules.stats(b).hp)[0];
    if (!hurt || hurt.hp / Rules.stats(hurt).hp >= 0.7) break;
    const healer = party.filter((c) => c.hp > 0).map((c) => ({ c, h: bestHeal(c, hurt) })).filter((x) => x.h).sort((a, b) => b.h.eff - a.h.eff)[0];
    if (healer) {
      healer.c.mp -= healer.h.cost;
      const targets = healer.h.ab.target === 'allies' ? party.filter((c) => c.hp > 0) : [hurt];
      for (const t of targets) t.hp = Math.min(Rules.stats(t).hp, t.hp + Math.round(healer.h.amt));
    } else {
      const herb = ['nectar', 'healing_grass', 'herb'].find((id) => inv[id] > 0);
      if (!herb) break;
      inv[herb]--;
      hurt.hp = Math.min(Rules.stats(hurt).hp, hurt.hp + DB.items[herb].use.effects[0].power);
    }
  }
  for (const c of party) if (c.hp <= 0 && inv.revive_feather > 0) { inv.revive_feather--; c.hp = Math.floor(Rules.stats(c).hp / 2); }
  // spellcasters drink an MP potion when nearly dry
  for (const c of party.filter((x) => x.hp > 0).sort((a, b) => Rules.stats(b).mp - Rules.stats(a).mp)) {
    const st = Rules.stats(c);
    if (st.mp < 40 || c.mp >= st.mp * 0.2) continue;
    const pot = ['mana_crystal', 'mana_drop'].find((id) => inv[id] > 0);
    if (pot) { inv[pot]--; c.mp = Math.min(st.mp, c.mp + DB.items[pot].use.effects[0].power); }
  }
}
/** what a prepared player carries into a dungeon: a dozen of the best herb the shops sell, feathers, MP potions */
function crawlBag(si) {
  const b = bagFor(si);
  const towns = townsUpTo(si);
  const sold = new Set(towns.flatMap((t) => (DB.shops[t + '_item'] ? DB.shops[t + '_item'].items : [])));
  const herb = ['nectar', 'healing_grass', 'herb'].find((id) => sold.has(id));
  if (herb) b[herb] = (b[herb] || 0) + 10;
  if (sold.has('revive_feather')) b.revive_feather = Math.max(b.revive_feather || 0, 3);
  const pot = ['mana_crystal', 'mana_drop'].find((id) => sold.has(id));
  if (pot) b[pot] = Math.max(b[pot] || 0, 4);
  return b;
}
if (ONLY.includes('crawl')) {
  console.log('\n=== DUNGEON CRAWL ===  (a careful player: MP damage skills only while MP lasts; prepared bag; field heals, herbs & MP potions between fights)');
  const crawl = (s, si, zones, fights) => {
    const n = Math.max(40, N / 4);
    let wipes = 0, hp = 0, mp = 0, herbs = 0;
    for (let i = 0; i < n; i++) {
      let party = buildParty(si, s.lv[0]), inv = crawlBag(si);
      const herbs0 = (inv.herb || 0) + (inv.healing_grass || 0) + (inv.nectar || 0);
      let dead = false;
      for (let k = 0; k < fights; k++) {
        const z = zones[Math.floor((k * zones.length) / fights)];
        U.seed(SEED * 17 + i * 101 + k);
        const grp = U.weighted(DB.encounters[z].groups);
        const r = simulateThrifty({ party, inv, mons: grp.mons });
        if (r.result === 'lose') { dead = true; break; }
        party = r.party; inv = r.inv;
        fieldHeal(party, inv);
      }
      if (dead) { wipes++; continue; }
      const st = party.map((c) => Rules.stats(c));
      hp += (100 * party.reduce((a, c) => a + c.hp, 0)) / st.reduce((a, x) => a + x.hp, 0);
      mp += (100 * party.reduce((a, c) => a + c.mp, 0)) / st.reduce((a, x) => a + x.mp, 0);
      herbs += herbs0 - ((inv.herb || 0) + (inv.healing_grass || 0) + (inv.nectar || 0));
    }
    const ok = n - wipes;
    return { ok: (100 * ok) / n, hp: hp / Math.max(1, ok), mp: mp / Math.max(1, ok), herbs: herbs / Math.max(1, ok) };
  };
  STAGES.forEach((s, si) => {
    if (!s.boss) return;
    const whole = crawl(s, si, s.zones, s.fights);
    const floors = s.zones.map((z) => crawl(s, si, [z], Math.round(s.fights / s.zones.length)));
    const worst = floors.reduce((a, b) => (b.ok < a.ok ? b : a));
    console.log(`${pad(s.id, 10)} Lv${padL(s.lv[0], 2)}  one floor (${Math.round(s.fights / s.zones.length)} fights): survived ${floors.map((f) => padL(f0(f.ok), 3) + '%').join(' ')}  MP left ${floors.map((f) => padL(f0(f.mp), 2) + '%').join(' ')}` +
      `  |  whole dungeon (${s.fights}): ${padL(f0(whole.ok), 3)}%  HP ${padL(f0(whole.hp), 3)}%  MP ${padL(f0(whole.mp), 3)}%  herbs ${f1(whole.herbs)}`);
    if (worst.ok < 75) W(`crawl ${s.id}: a single floor is survived only ${f0(worst.ok)}% of the time`);
  });
}

// ============================================================== campaign
// A whole playthrough: the natural number of fights of each stage (STAGES.fights;
// --grind keeps fighting until the stage's leave level), rewards applied, bosses once.
/** price of the best gear the stage's town sells for the whole party */
function kitCost(si) {
  const own = new Set();
  for (const t of STAGES[si].towns) for (const k of ['weapon', 'armor']) { const sh = DB.shops[t + '_' + k]; if (sh) sh.items.forEach((i) => own.add(i)); }
  if (!own.size) return 0;
  const p = buildParty(si, STAGES[si].lv[0]);
  let cost = 0;
  for (const c of p) for (const sl of Rules.SLOTS) if (c.equip[sl] && own.has(c.equip[sl])) cost += DB.items[c.equip[sl]].price || 0;
  return cost;
}
/** one playthrough → per stage {L0, L, fights, rounds, jp, gold since the last town} */
function campaign(seed) {
  U.seed(seed);
  let L = 1, exp = 0, jpTotal = 0, fightsTotal = 0, goldBank = 0;
  const firstJob = [];
  const out = [];
  STAGES.forEach((s, si) => {
    if (s.towns.length) goldBank = 0;
    const L0 = L;
    let fights = 0, rounds = 0;
    while ((fights < s.fights || (GRIND && L < s.lv[1])) && fights < 200) {
      const grp = U.weighted(DB.encounters[s.zones[fights % s.zones.length]].groups);
      const r = R.Battle.simulate({ party: buildParty(si, L), inv: bagFor(si), mons: grp.mons, seed: seed * 7 + fightsTotal * 13 + 3 });
      fights++; fightsTotal++; rounds += r.rounds;
      if (r.result !== 'win') continue;
      exp += r.exp; jpTotal += r.jp; goldBank += r.gold;
      while (exp >= Rules.expForLevel(L + 1)) L++;
      for (let k = firstJob.length; k < 3 && jpTotal >= Rules.JP_TABLE[k + 1]; k++) firstJob.push(fightsTotal);
    }
    for (const tid of s.boss || []) {
      for (const [id, a] of DB.troops[tid].mons) { const m = DB.monsters[id]; exp += m.exp * a; jpTotal += m.jp * a; goldBank += m.gold * a; }
      while (exp >= Rules.expForLevel(L + 1)) L++;
    }
    out.push({ L0, L, fights, fightsTotal, rounds: rounds / Math.max(1, fights), jp: jpTotal, gold: goldBank });
  });
  return { stages: out, firstJob };
}
if (ONLY.includes('campaign')) {
  const RUNS = 12;
  console.log(`\n=== CAMPAIGN ===  (${RUNS} natural playthroughs averaged; boss EXP/JP/gold added; JP vs the 12·Lv² model; gold vs each town\'s full gear)`);
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(campaign(SEED + i * 1009));
  const avg = (si, k) => runs.reduce((a, r) => a + r.stages[si][k], 0) / RUNS;
  let pendingKit = null;
  STAGES.forEach((s, si) => {
    const kit = kitCost(si);
    const Lf = avg(si, 'L');
    const lvStr = (x) => { const lo = Math.min(...runs.map((r) => r.stages[si][x])), hi = Math.max(...runs.map((r) => r.stages[si][x])); return lo === hi ? padL(lo, 2) : `${lo}-${hi}`; };
    console.log(`${pad(s.id, 11)} ${pad(s.zones.join(','), 36)} Lv${lvStr('L0').padStart(5)}→${lvStr('L').padEnd(5)} avg ${f1(Lf).padStart(4)} (plan ${s.lv[1]})  fights ${padL(s.fights, 2)} (total ${padL(runs[0].stages[si].fightsTotal, 3)})  rnd ${f1(avg(si, 'rounds'))}  JP ${padL(f0(avg(si, 'jp')), 6)} vs 12Lv² ${padL(f0(12 * Lf * Lf), 6)}`);
    if (!GRIND && Math.abs(Lf - s.lv[1]) > 1) W(`campaign: after ${s.id} the party is Lv${f1(Lf)} on average (plan ${s.lv[1]})`);
    const next = STAGES.findIndex((x, j) => j > si && x.towns.length);
    if (kit) pendingKit = { town: s.towns.join('+'), kit };
    if (pendingKit && (next === si + 1 || (next < 0 && si === STAGES.length - 1))) {
      const gold = avg(si, 'gold');
      console.log(`      gold earned from ${pendingKit.town} until the next town (or the end): ${f0(gold)} vs its full gear ${pendingKit.kit} → ${f0((100 * gold) / pendingKit.kit)}%`);
      pendingKit = null;
    }
  });
  const fj = [0, 1, 2].map((k) => f1(runs.reduce((a, r) => a + (r.firstJob[k] || 0), 0) / RUNS));
  console.log(`first job levels (Lv2, Lv3, Lv4 of the first job) after fights: ${fj.join(', ')}`);
}

// ================================================================== loot
if (ONLY.includes('loot')) {
  console.log('\n=== LOOT ===  (rare pool coverage; chance of a ★ drop per fight; metal/gold jelly kill rate)');
  const sources = {};
  const addSrc = (item, what) => { (sources[item] = sources[item] || []).push(what); };
  for (const id in DB.monsters) {
    const m = DB.monsters[id];
    if (m.drop) addSrc(m.drop.item, `${id} drop 1/${m.drop.rate}`);
    if (m.rare) addSrc(m.rare.item, `${id} rare 1/${m.rare.rate}`);
    if (m.steal && m.steal.rare) addSrc(m.steal.rare, `${id} steal★`);
    if (m.steal && m.steal.item) addSrc(m.steal.item, `${id} steal`);
  }
  const pool = R.ITEM_RARE || {};
  for (const band in pool) {
    const missing = pool[band].filter((it) => !sources[it]);
    console.log(`${pad(band, 6)} ${pool[band].length} items, ${pool[band].length - missing.length} dropped/stolen by monsters${missing.length ? '  — not from monsters: ' + missing.join(' ') : ''}`);
    if (missing.length && band !== 'band6') W(`loot: ${band} items only in chests/events: ${missing.join(' ')}`);
  }
  for (const id in DB.monsters) {
    const m = DB.monsters[id], it = m.rare && DB.items[m.rare.item];
    if (it && !it.rare && !(m.flags || []).includes('boss')) W(`loot: ${id} rare slot holds a shop item ${m.rare.item}`);
  }
  // expected ★ per fight per zone (all monsters killed; metal kills estimated from the sim)
  const line = [];
  for (const z in DB.encounters) {
    const e = DB.encounters[z]; const Wt = e.groups.reduce((a, g) => a + g.w, 0);
    let p = 0;
    for (const grp of e.groups) for (const [id, a, b] of grp.mons) { const m = DB.monsters[id]; if (m.rare) p += (grp.w / Wt) * ((a + b) / 2) / m.rare.rate; }
    line.push(`${z} 1/${f0(1 / p)}`);
  }
  console.log('★ per fight: ' + line.join('  '));
  for (const [id, si, L] of [['hagane_jelly', 8, 16], ['hagane_jelly', 14, 27], ['kogane_jelly', 16, 32]]) {
    const r = runGroup(buildParty(si, L), bagFor(si), [[id, 1, 1]], 300);
    console.log(`${id} at Lv${L}: killed ${f0((100 * r.exp) / DB.monsters[id].exp)}% of encounters (avg EXP ${f0(r.exp)}, rounds ${f1(r.rounds)})`);
  }
}

// ================================================================ report
console.log('');
for (const w of warns) console.log('WARN ' + w);
console.log(`sim_balance: ${warns.length} warning(s)`);
