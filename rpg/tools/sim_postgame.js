#!/usr/bin/env node
// Post-game balance (src/data/postgame.js): the 深淵の迷宮 regulars, the rare monster
// プリズマ and the superboss アビスロード, played with the real battle engine
// (R.Battle.Engine + R.BattleAI — the same code as the game).
//
//   node tools/sim_postgame.js                       everything
//   node tools/sim_postgame.js --only text,party,zones,boss,ablation,king,rare,rewards
//   node tools/sim_postgame.js --n 300 --seed 7 --verbose
//
// Party models (built directly: jobs mastered = JP 2000 and every ability learned):
//   prepared   Lv55 — ユウキ 勇者 (sub 竜騎士: the boss is a dragon; 二刀流; ふくつのちかい),
//              ノン 賢者 (sub 白魔術師, はじゃのこころ, ふくつのちかい), メテム 時空術師 (sub 賢者 —
//              かいじゅ, りゅうせいう; MP半減, ふくつのちかい); 14/9/10 jobs mastered. Gear only from
//              the abyss chests (混沌の剣 + 竜神の槍 in the off hand, 深淵の鎧, 極光の杖/ローブ,
//              始原のロッド, 明鏡の護符 ×2) and shops — no rare drop needed. Status cover:
//              ユウキ 明鏡の護符 + the hero's death immunity, ノン はじゃのこころ (poison/sleep/
//              paralysis/confusion) + 命のお守り (death), メテム 明鏡の護符.
//   arrival    Lv42 — the same jobs with 最果ての祠 shop gear (info rows for the dungeon entrance).
//   levels     Lv65 — basic jobs only (ナイト / 白魔術師 / 黒魔術師 + their tier-1 jobs mastered),
//              the best shop gear of 最果ての祠, no status protection, no dispel, no revive-on-KO.
//   Both carry the same bag (shop consumables, which the AI uses).
// The player side is the game's auto-battle AI (R.BattleAI.partyAction) plus two things a
// player does: the healers decide first (so the attacker keeps attacking), and when the boss
// has raised its stats someone who knows かいじゅ (dispel) dispels it (the auto AI never does).
// Targets: regulars — prepared Lv50 wins 100 %, loses 25–45 % HP per fight;
//          abyss_lord — prepared Lv55 wins 50–75 % in 12–25 rounds, levels-only Lv65 < 10 %;
//          boss_king2 (魔王) clearly easier than abyss_lord for the same parties.
'use strict';
const R = require('./lib/load')({ quiet: true });
R.warn = () => {};
const { DB, U, Rules, State } = R;
const B = R.Battle;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = arg('only', 'text,party,zones,boss,ablation,king,rare,rewards').split(',');
const N = +arg('n', 200);
const SEED = +arg('seed', 4242);
const VERBOSE = argv.includes('--verbose');

const warns = [];
const W = (m) => warns.push(m);
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += /[　-￿]/.test(ch) ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const padL = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; };
const f0 = (x) => String(Math.round(x));
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

// ------------------------------------------------------------------ parties
/**
 * spec: {master:[jobs] (JP 2000, all abilities), job, sub, reaction, support,
 *        equip:{weapon,shield,head,body,acc}, bonus:{stat:n} (seeds)}
 */
function makeChar(id, L, spec) {
  const c = Rules.newChar(id);
  c.level = L; c.exp = Rules.expForLevel(L);
  for (const job of spec.master) {
    const rec = Rules.jobRec(c, job);
    rec.total = Rules.JP_TABLE[7]; rec.jp = 0;
    rec.learned = Rules.jobAbilities(job).slice();
  }
  if (!Rules.isJobUnlocked(c, spec.job)) W(`${id}: job ${spec.job} is locked by the plan`);
  c.job = spec.job;
  for (const k of ['sub', 'reaction', 'support']) {
    const v = spec[k] || null;
    if (k === 'sub' && v && !Rules.isJobUnlocked(c, v)) W(`${id}: sub ${v} locked`);
    if (k !== 'sub' && v && !Rules.learned(c, v)) W(`${id}: ${k} ${v} not learned`);
    c.set[k] = v;
  }
  for (const s of Rules.SLOTS) {
    const it = spec.equip[s] || null;
    c.equip[s] = null;
    if (!it) continue;
    if (!DB.items[it]) { W(`${id}: item ${it} missing`); continue; }
    if (!Rules.canEquip(c, it, s)) W(`${id}: cannot equip ${it} in ${s} as ${c.job}`);
    c.equip[s] = it;
  }
  if (spec.bonus) c.bonus = Object.assign({}, spec.bonus);
  const st = Rules.stats(c);
  c.hp = st.hp; c.mp = st.mp; c.status = {};
  return c;
}

const T1 = ['warrior', 'priest', 'mage', 'thief'];
const PREPARED = {
  yuki: {
    master: [...T1, 'knight', 'monk', 'whitemage', 'blackmage', 'hunter', 'spellblade', 'paladin', 'ninja', 'dragoon', 'hero'],
    job: 'hero', sub: 'dragoon', reaction: 'paladin_last_stand', support: 'ninja_two_swords',
    equip: { weapon: 'pg_chaos_sword', shield: 'pg_dragon_lance', head: 'holy_helm', body: 'pg_abyss_mail', acc: 'pg_clarity_amulet' },
  },
  non: {
    master: ['priest', 'mage', 'warrior', 'whitemage', 'blackmage', 'knight', 'sage', 'paladin', 'bard'],
    job: 'sage', sub: 'whitemage', reaction: 'paladin_last_stand', support: 'paladin_ward',
    equip: { weapon: 'pg_aurora_staff', head: 'light_crown', body: 'pg_aurora_robe', acc: 'life_charm' },
  },
  metem: {
    master: [...T1, 'blackmage', 'whitemage', 'bard', 'knight', 'timemage', 'sage', 'paladin'],
    job: 'timemage', sub: 'sage', reaction: 'paladin_last_stand', support: 'sage_half_mp',
    equip: { weapon: 'pg_origin_rod', head: 'light_crown', body: 'holy_robe', acc: 'pg_clarity_amulet' },
  },
};
const LEVELS_ONLY = {
  yuki: {
    master: ['warrior', 'knight'], job: 'knight', sub: 'warrior', reaction: 'warrior_counter', support: 'warrior_hp_up',
    equip: { weapon: 'holy_sword', shield: 'holy_shield', head: 'holy_helm', body: 'holy_armor', acc: 'iron_ring' },
  },
  non: {
    master: ['priest', 'whitemage'], job: 'whitemage', sub: 'priest', reaction: 'whitemage_mending_hand', support: 'whitemage_heal_up',
    equip: { weapon: 'saint_staff', head: 'light_crown', body: 'holy_robe', acc: 'rosary' },
  },
  metem: {
    master: ['mage', 'blackmage'], job: 'blackmage', sub: 'mage', reaction: 'blackmage_awaken', support: 'blackmage_magic_up',
    equip: { weapon: 'mystic_rod', head: 'light_crown', body: 'holy_robe', acc: 'star_earring' },
  },
};
/** a party fresh from the final boss: the prepared jobs, but 最果ての祠 shop gear and no abyss items */
const ARRIVAL = {
  yuki: { support: 'hero_heart', equip: { weapon: 'holy_sword', shield: 'holy_shield', head: 'holy_helm', body: 'holy_armor', acc: 'life_charm' } },
  non: { equip: { weapon: 'saint_staff', head: 'light_crown', body: 'holy_robe', acc: 'rosary' } },
  metem: { equip: { weapon: 'mystic_rod', head: 'light_crown', body: 'holy_robe', acc: 'star_earring' } },
};
/** shop consumables both parties carry (the AI heals, revives and cures with them) */
const BAG = { nectar: 10, healing_aroma: 4, revive_feather: 6, all_cure: 6, mana_crystal: 4 };

function party(model, L, patch) {
  State.newGame();
  const p = R.PARTY_ORDER.map((id) => {
    const spec = U.clone(model[id]);
    if (patch && patch[id]) {
      const pt = patch[id];
      for (const k in pt) if (k === 'equip') Object.assign(spec.equip, pt.equip); else spec[k] = pt[k];
    }
    return makeChar(id, L, spec);
  });
  R.Game.party = p;
  return p;
}

// --------------------------------------------------------------- the player
/** heal/revive actions a member can use right now (the party's healers plan their turn first) */
function healerScore(eng, u) {
  return R.BattleAI.abilityOptions(eng, u).filter((o) => o.ab.effects.some((e) => e.type === 'heal' || e.type === 'revive') && o.ab.target !== 'self').length;
}
/**
 * The auto-battle AI's decisions (R.BattleAI.partyAction) with two things a player does here:
 * the healers take their turn's decision first (the auto AI plans in party order, so the
 * front-line attacker ends up spending its turns on herbs while the healer attacks), and when
 * the boss has raised its stats someone who knows かいじゅ dispels it.
 */
function playerCommands(eng, opts) {
  const plan = R.BattleAI.newPlan();
  const cmds = [];
  const order = eng.party.filter((u) => u.commandable()).sort((a, b) => healerScore(eng, b) - healerScore(eng, a) || a.idx - b.idx);
  for (const u of order) cmds[u.idx] = R.BattleAI.partyAction(eng, u, plan, opts);
  if (!opts.dispel) return cmds;
  const boss = eng.living('mon').find((m) => m.boss);
  if (!boss) return cmds;
  // 始原の鱗 (def/mdef) is always worth erasing; a raised atk/mag once it has stacked
  const guard = boss.buffs.def > 0 || boss.buffs.mdef > 0;
  const power = boss.buffs.atk + boss.buffs.mag >= 2;
  if (!guard && !power) return cmds;
  for (const u of eng.party) {
    if (!u.commandable()) continue;
    const cmd = cmds[u.idx];
    if (cmd && (cmd.type === 'ability' && DB.abilities[cmd.id] && DB.abilities[cmd.id].effects.some((e) => e.type === 'revive' || e.type === 'heal'))) continue;
    if (cmd && cmd.type === 'item') continue;
    const opts2 = R.BattleAI.abilityOptions(eng, u);
    const d = opts2.find((o) => o.ab.effects.some((e) => e.type === 'dispel') && ['enemy', 'group'].includes(o.ab.target));
    if (d) { cmds[u.idx] = { type: 'ability', id: d.id, target: boss }; break; }
  }
  return cmds;
}

/** one battle; → {result, rounds, hpPct (left), deaths, log?} */
function fight(p, o) {
  const saved = U.rng;
  U.seed(o.seed);
  try {
    const partyC = p.map((c) => U.clone(c));
    const inv = U.clone(o.inv || {});
    const troop = o.troop && DB.troops[o.troop];
    const eng = new B.Engine({ party: partyC, mons: B.buildMons(o), inv, live: false, noEscape: !!(troop && troop.noEscape), surprise: o.surprise });
    const log = o.log ? [] : null;
    const sink = log ? (ev) => { if (ev.t === 'msg') log.push(`[${eng.round}] ${ev.text}`); } : null;
    B.drain(eng.begin(), sink);
    while (!eng.result && eng.round < (o.maxRounds || 60)) B.drain(eng.playRound(playerCommands(eng, o)), sink);
    const rw = eng.computeRewards();
    eng.finish();
    const st = partyC.map((c) => Rules.stats(c));
    const hpPct = (100 * partyC.reduce((s, c) => s + Math.max(0, c.hp), 0)) / st.reduce((s, x) => s + x.hp, 0);
    const boss = eng.mons.find((m) => m.boss);
    return { result: eng.result || 'timeout', rounds: eng.round, hpPct, deaths: eng.stats.deaths, bossHp: boss ? boss.hp / boss.mhp : 0, exp: rw.exp, gold: rw.gold, jp: rw.jp, killed: eng.killed.length, dealt: eng.stats.dealt, taken: eng.stats.taken, log };
  } finally { U.rng = saved; }
}

function runMany(p, o, n) {
  const acc = { n, win: 0, lose: 0, timeout: 0, escape: 0, rounds: 0, roundsWin: 0, hpLeft: 0, hpLost: 0, deaths: 0, bossHp: 0, exp: 0, gold: 0, jp: 0, dealt: 0, taken: 0 };
  for (let i = 0; i < n; i++) {
    const r = fight(p, Object.assign({}, o, { seed: SEED * 7919 + i * 131 + (o.salt || 0) }));
    acc[r.result]++;
    acc.rounds += r.rounds; acc.deaths += r.deaths; acc.hpLost += 100 - r.hpPct;
    acc.dealt += r.dealt / Math.max(1, r.rounds); acc.taken += r.taken / Math.max(1, r.rounds);
    if (r.result === 'win') { acc.roundsWin += r.rounds; acc.hpLeft += r.hpPct; acc.exp += r.exp; acc.gold += r.gold; acc.jp += r.jp; }
    else acc.bossHp += r.bossHp;
  }
  const out = {
    winPct: (100 * acc.win) / n, losePct: (100 * acc.lose) / n, timeoutPct: (100 * acc.timeout) / n, escapePct: (100 * acc.escape) / n,
    rounds: acc.rounds / n, roundsWin: acc.win ? acc.roundsWin / acc.win : 0, hpLeft: acc.win ? acc.hpLeft / acc.win : 0,
    hpLost: acc.hpLost / n, deaths: acc.deaths / n, bossLeft: n - acc.win ? (100 * acc.bossHp) / (n - acc.win) : 0,
    exp: acc.win ? acc.exp / acc.win : 0, gold: acc.win ? acc.gold / acc.win : 0, jp: acc.win ? acc.jp / acc.win : 0,
    dealt: acc.dealt / n, taken: acc.taken / n,
  };
  return out;
}

// used as a module (diagnostics): export the models and stop here
if (require.main !== module) {
  module.exports = { party, fight, runMany, playerCommands, PREPARED, LEVELS_ONLY, BAG, R };
  return;
}

function describe(c) {
  const st = Rules.stats(c);
  const imm = (st.mods.statusImmune || []).filter((v, i, a) => a.indexOf(v) === i).join('/') || '-';
  const res = Object.entries(st.mods.elemResist || {}).map(([e, v]) => e + v).join(' ') || '-';
  return `${pad(c.name, 7)} Lv${c.level} ${pad(DB.jobs[c.job].name, 10)} HP${padL(st.hp, 4)} MP${padL(st.mp, 4)} atk${padL(st.atk, 4)}${st.atk2 ? '+' + st.atk2 : ''} def${padL(st.def, 4)} mag${padL(st.mag, 4)} mdf${padL(st.mdef, 4)} agi${padL(st.agi, 4)} ` +
    `| immune ${imm} | resist ${res} | ${Rules.SLOTS.map((s) => (c.equip[s] ? DB.items[c.equip[s]].name : '-')).join(' ')}`;
}

// ====================================================================== text
// the post-game strings, measured like tools/check_items.js: DotGothic16 ≈ 11 px per full-width
// character, item and bestiary description boxes hold 2 lines of ≈ 220–226 px (20 units)
const width = (str) => [...str].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x80 ? 0.5 : 1), 0);
function wrapLines(str, units) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && width(line + ch) > units) {
        if ('、。」』）！？…ー'.includes(ch)) { line += ch; continue; }
        out.push(line); line = ch;
      } else line += ch;
    }
    out.push(line);
  }
  return out;
}
const JA = '[\\u3000-\\u30ff\\u4e00-\\u9fff\\uff01-\\uff5e]';
const DQ_SPACE = new RegExp(`${JA} | ${JA}|(^|[^！？])\u3000`);
const HERO = /ユウキ|メテム|(^|[^ァ-ヶー])ノン/;
if (ONLY.includes('text')) {
  const PG = (id) => id.startsWith('pg_') || id.startsWith('en_pg_') || id === 'rare_prism' || id === 'abyss_lord';
  const texts = [];
  for (const id in DB.items) if (PG(id)) texts.push([`item ${id} desc`, DB.items[id].desc, 2], [`item ${id} name`, DB.items[id].name, 1]);
  for (const id in DB.monsters) if (PG(id)) texts.push([`monster ${id} desc`, DB.monsters[id].desc, 2], [`monster ${id} name`, DB.monsters[id].name, 1]);
  for (const id in DB.abilities) if (PG(id)) texts.push([`ability ${id} msg`, (DB.abilities[id].msg || '').replace(/\{user\}/g, 'アビスロード'), 2], [`ability ${id} name`, DB.abilities[id].name, 1]);
  for (const id of ['obj_postgame', 'obj_abyss_clear']) {
    const o = DB.objectives[id];
    if (!o) { W(`objective ${id} missing`); continue; }
    texts.push([`objective ${id} text`, o.text, 3]);
    for (const [k, page] of (o.king || '').split('\f').entries()) texts.push([`objective ${id} king p${k + 1}`, page, 4]);
  }
  let n = 0;
  for (const [where, str, maxLines] of texts) {
    if (!str) { W(`${where}: empty`); continue; }
    n++;
    const lines = wrapLines(str, where.includes('king') || where.includes('msg') ? 21 : 20);
    if (lines.length > maxLines) W(`${where}: ${lines.length} lines (max ${maxLines}): ${str.replace(/\n/g, '⏎')}`);
    if (DQ_SPACE.test(str)) W(`${where}: DQ-style space: ${str}`);
    if (HERO.test(str)) W(`${where}: hard-coded hero name: ${str}`);
  }
  console.log(`=== TEXT ===  ${n} post-game strings checked (line fit, spacing, hero names)`);
}

// ===================================================================== party
if (ONLY.includes('party')) {
  console.log('=== PARTY MODELS ===');
  for (const [label, model, L] of [['prepared', PREPARED, 50], ['prepared', PREPARED, 55], ['levels only', LEVELS_ONLY, 65]]) {
    console.log(`-- ${label} Lv${L}`);
    for (const c of party(model, L)) console.log('  ' + describe(c));
  }
}

// ===================================================================== zones
const ZONES = ['d_abyss1', 'd_abyss2', 'd_abyss3', 'd_abyss4'];
const groupLabel = (grp) => grp.mons.map(([id, a, b]) => `${DB.monsters[id] ? DB.monsters[id].name : '??' + id}${a === b ? a : a + '-' + b}`).join(' ');
const SPRITE_W = { s: 32, m: 48, l: 64 };
const SIZE_OF = { eyeball: 's', mimic: 's', jelly: 's', golem: 'l', wyvern: 'l', chimera: 'l', demon: 'l', chaos_beast: 'l' };
const groupWidth = (grp) => grp.mons.reduce((s, [id, , b]) => s + SPRITE_W[SIZE_OF[DB.monsters[id].sprite] || 'm'] * b, 0);

if (ONLY.includes('zones')) {
  console.log('\n=== ABYSS REGULARS ===  (prepared party, no items; target: win 100 %, HP lost 25–45 % per fight)');
  for (const z of ZONES) {
    const e = DB.encounters[z];
    if (!e) { W(`zone ${z} missing`); continue; }
    for (const L of [50, e.lv[0]]) {
      const p = party(PREPARED, L);
      const tw = e.groups.reduce((s, g) => s + g.w, 0);
      const avg = { winPct: 0, rounds: 0, hpLost: 0, deaths: 0, exp: 0, gold: 0, jp: 0 };
      const rows = [];
      e.groups.forEach((grp, gi) => {
        const r = runMany(p, { mons: grp.mons, inv: {}, dispel: true, salt: gi * 17 + L }, L === 50 ? N : Math.max(60, N / 2));
        for (const k in avg) avg[k] += (r[k] * grp.w) / tw;
        rows.push(`    #${gi} w${padL(grp.w, 2)} ${pad(groupLabel(grp), 40)} ${padL(groupWidth(grp), 3)}px  win${padL(f0(r.winPct), 4)}%  rnd ${f1(r.rounds)}  hp-${padL(f0(r.hpLost), 3)}%  dead ${f1(r.deaths)}  exp ${padL(f0(r.exp), 5)} jp ${padL(f0(r.jp), 4)} g ${padL(f0(r.gold), 5)}`);
        if (groupWidth(grp) > 256) W(`${z} #${gi}: group ${groupLabel(grp)} is ${groupWidth(grp)} px wide`);
        if (L === 50 && r.winPct < 98) W(`${z}@Lv50 #${gi} ${groupLabel(grp)}: win ${f1(r.winPct)}%`);
      });
      console.log(`${pad(z, 9)} Lv${L}  win ${padL(f0(avg.winPct), 3)}%  rounds ${f1(avg.rounds)}  hp-${padL(f0(avg.hpLost), 3)}%  deaths ${f1(avg.deaths)}  exp ${padL(f0(avg.exp), 6)}  jp ${padL(f0(avg.jp), 4)}  gold ${padL(f0(avg.gold), 5)}`);
      if (L === 50 && (avg.hpLost < 25 || avg.hpLost > 45)) W(`${z}@Lv50: party loses ${f0(avg.hpLost)}% HP per fight (target 25–45)`);
      if (VERBOSE || L === 50) for (const l of rows) console.log(l);
    }
  }
}

if (ONLY.includes('zones')) {
  console.log('-- a party fresh from the demon king (Lv42, advanced jobs, shop gear, no abyss items; info only)');
  for (const z of ZONES) {
    const e = DB.encounters[z], tw = e.groups.reduce((s, g) => s + g.w, 0), p = party(PREPARED, 42, ARRIVAL);
    let win = 0, hp = 0;
    e.groups.forEach((grp, gi) => { const r = runMany(p, { mons: grp.mons, inv: {}, dispel: true, salt: gi * 5 }, Math.max(60, N / 2)); win += (r.winPct * grp.w) / tw; hp += (r.hpLost * grp.w) / tw; });
    console.log(`${pad(z, 9)} Lv42  win ${padL(f0(win), 3)}%  hp-${padL(f0(hp), 3)}%`);
  }
}

// ===================================================================== boss
function bossLine(label, p, troop, o, n) {
  const r = runMany(p, Object.assign({ troop, inv: BAG, items: true, dispel: true, maxRounds: 60 }, o || {}), n);
  console.log(`${pad(label, 44)} win ${padL(f0(r.winPct), 3)}%  (lose ${padL(f0(r.losePct), 3)}% timeout ${padL(f0(r.timeoutPct), 2)}%)  rounds(win) ${padL(f1(r.roundsWin), 4)}  hp left ${padL(f0(r.hpLeft), 3)}%  deaths ${padL(f1(r.deaths), 4)}  boss HP left when lost ${padL(f0(r.bossLeft), 3)}%  dealt/rnd ${padL(f0(r.dealt), 4)} taken/rnd ${padL(f0(r.taken), 4)}`);
  return r;
}
if (ONLY.includes('boss')) {
  console.log('\n=== アビスロード (boss_abyss) ===  (items allowed; target prepared Lv55 50–75 % in 12–25 rounds, levels-only Lv65 < 10 %)');
  const nB = Math.max(N, 200);
  for (const L of [52, 55, 58]) {
    const r = bossLine(`prepared Lv${L}`, party(PREPARED, L), 'boss_abyss', null, L === 55 ? nB : Math.max(80, N / 2));
    if (L === 55) {
      if (r.winPct < 50 || r.winPct > 75) W(`abyss_lord prepared Lv55: win ${f0(r.winPct)}% (target 50–75)`);
      if (r.roundsWin && (r.roundsWin < 12 || r.roundsWin > 25)) W(`abyss_lord prepared Lv55: ${f1(r.roundsWin)} rounds (target 12–25)`);
    }
  }
  for (const L of [65, 75, 99]) {
    const r = bossLine(`levels only Lv${L}`, party(LEVELS_ONLY, L), 'boss_abyss', null, L === 65 ? nB : Math.max(80, N / 2));
    if (L === 65 && r.winPct >= 10) W(`abyss_lord levels-only Lv65: win ${f0(r.winPct)}% (target < 10)`);
  }
  if (VERBOSE) {
    const r = fight(party(PREPARED, 55), { troop: 'boss_abyss', inv: BAG, items: true, dispel: true, seed: SEED, log: true });
    console.log(`\n-- sample log (prepared Lv55): ${r.result} in ${r.rounds} rounds`);
    console.log(r.log.slice(0, 160).map((l) => '   ' + l).join('\n'));
  }
}

// ================================================================== ablation
if (ONLY.includes('ablation')) {
  console.log('\n=== WHAT THE PREPARATION IS WORTH ===  (prepared Lv55 with one thing taken away)');
  const n = Math.max(100, N / 2);
  const cases = [
    ['full preparation', null, {}],
    ['no sleep/paralysis/confusion immunity', { yuki: { equip: { acc: 'iron_ring' } }, non: { support: 'sage_half_mp' }, metem: { equip: { acc: 'star_earring' } } }, {}],
    ['メテム without 明鏡の護符 (2 of 3 protected)', { metem: { equip: { acc: 'star_earring' } } }, {}],
    ['ノン without 命のお守り (no death immunity)', { non: { equip: { acc: 'rosary' } } }, {}],
    ['no ふくつのちかい (revive-on-KO)', { yuki: { reaction: 'warrior_counter' }, non: { reaction: 'whitemage_mending_hand' }, metem: { reaction: 'sage_mana_return' } }, {}],
    ['player never dispels the boss', null, { dispel: false }],
    ['no elemental resistance gear', { yuki: { equip: { body: 'holy_vest' } }, non: { equip: { body: 'holy_robe' } } }, {}],
    ['no MP半減 on メテム (魔法アップ)', { metem: { support: 'blackmage_magic_up' } }, {}],
    ['no 二刀流 (虚空の盾 + 竜の力)', { yuki: { support: 'dragoon_might', equip: { shield: 'pg_void_shield' } } }, {}],
    ['shop weapons instead of the abyss ones', { yuki: { equip: { weapon: 'holy_sword', shield: 'holy_sword' } }, non: { equip: { weapon: 'saint_staff' } }, metem: { equip: { weapon: 'mystic_rod' } } }, {}],
    ['+ rare drops (天輪の冠 + 魂鎮めの鈴, MP半減 on ノン)', { non: { support: 'sage_half_mp', equip: { head: 'pg_halo', acc: 'pg_soul_bell' } } }, {}],
  ];
  for (const [label, patch, o] of cases) bossLine(label, party(PREPARED, 55, patch), 'boss_abyss', o, n);
  const amulets = { yuki: { equip: { acc: 'pg_clarity_amulet' } }, non: { equip: { acc: 'pg_clarity_amulet' } }, metem: { equip: { acc: 'pg_clarity_amulet' } } };
  bossLine('levels only Lv65 + 明鏡の護符 ×3', party(LEVELS_ONLY, 65, amulets), 'boss_abyss', {}, n);
  bossLine('levels only Lv80 + 明鏡の護符 ×3', party(LEVELS_ONLY, 80, amulets), 'boss_abyss', {}, n);
}

// ====================================================================== king
if (ONLY.includes('king')) {
  console.log('\n=== 魔王 vs アビスロード ===  (same parties; boss_king2 = まじん ヴァルザード, the final boss)');
  const n = Math.max(100, N / 2);
  for (const [label, model, L] of [['prepared', PREPARED, 55], ['levels only', LEVELS_ONLY, 65], ['prepared', PREPARED, 45]]) {
    const p = party(model, L);
    const k = bossLine(`${label} Lv${L} vs boss_king2`, p, 'boss_king2', null, n);
    const a = bossLine(`${label} Lv${L} vs boss_abyss`, p, 'boss_abyss', null, n);
    if (k.winPct < a.winPct + 25) W(`${label} Lv${L}: king2 ${f0(k.winPct)}% is not clearly easier than abyss_lord ${f0(a.winPct)}%`);
  }
  const k2 = DB.monsters.demon_king2, al = DB.monsters.abyss_lord;
  console.log(`stats  king2: HP ${k2.hp} atk ${k2.atk} def ${k2.def} mag ${k2.mag} mdef ${k2.mdef} agi ${k2.agi} acts ${k2.actsPerTurn}` +
    `   abyss_lord: HP ${al.hp} atk ${al.atk} def ${al.def} mag ${al.mag} mdef ${al.mdef} agi ${al.agi} acts ${al.actsPerTurn}`);
}

// ====================================================================== rare
if (ONLY.includes('rare')) {
  console.log('\n=== プリズマ (rare_prism) ===  (prepared party, no items)');
  // a monster that runs away also ends the battle as 'win' (nothing left on the field): count kills
  for (const L of [46, 50, 55]) {
    const p = party(PREPARED, L), n = Math.max(200, N);
    let killed = 0, lost = 0, rounds = 0;
    for (let i = 0; i < n; i++) {
      const r = fight(p, { mons: [['rare_prism', 1]], inv: {}, seed: SEED * 31 + i * 7 + L });
      if (r.killed) killed++; if (r.result === 'lose') lost++; rounds += r.rounds;
    }
    console.log(`prepared Lv${L}: beaten ${padL(f0((100 * killed) / n), 3)}%  fled ${padL(f0((100 * (n - killed - lost)) / n), 3)}%  party lost ${f0((100 * lost) / n)}%  rounds ${f1(rounds / n)}`);
    if (L === 50 && (killed / n < 0.3 || killed / n > 0.6)) W(`rare_prism beaten ${f0((100 * killed) / n)}% at Lv50 (target 30–60, like the main-game rare monsters)`);
  }
  const rp = DB.monsters.rare_prism;
  const zoneRates = ZONES.map((z) => (DB.rareEncounters[z] ? DB.rareEncounters[z].rate : 0));
  console.log(`encounter share ${zoneRates.map((x) => (x * 100).toFixed(1) + '%').join(' / ')}  drop ${DB.items[rp.drop.item].name} 1/${rp.drop.rate}  rare ${DB.items[rp.rare.item].name} 1/${rp.rare.rate} (exclusive)  steal ${rp.steal.item}/${rp.steal.rare}`);
  if (zoneRates.some((x) => !x)) W('rare_prism missing from an abyss zone');
}

// =================================================================== rewards
if (ONLY.includes('rewards')) {
  console.log('\n=== REWARDS ===  (per random fight in each zone; fights per level for a party at the zone\'s lower level)');
  for (const z of ZONES) {
    const e = DB.encounters[z];
    const tw = e.groups.reduce((s, g) => s + g.w, 0);
    let exp = 0, jp = 0, gold = 0;
    for (const grp of e.groups) {
      let ge = 0, gj = 0, gg = 0;
      for (const [id, a, b] of grp.mons) { const m = DB.monsters[id]; const k = (a + b) / 2; ge += m.exp * k; gj += m.jp * k; gg += m.gold * k; }
      exp += (ge * grp.w) / tw; jp += (gj * grp.w) / tw; gold += (gg * grp.w) / tw;
    }
    const L = e.lv[0];
    const need = Rules.expForLevel(L + 1) - Rules.expForLevel(L);
    console.log(`${pad(z, 9)} Lv${e.lv[0]}-${e.lv[1]}  exp ${padL(f0(exp), 6)}  jp ${padL(f0(jp), 4)}  gold ${padL(f0(gold), 5)}   → ${f1(need / exp)} fights per level at Lv${L}, ${f1(Rules.JP_TABLE[7] / jp)} fights per mastered-job's 2000 JP`);
  }
  // a party arriving from the final boss: fights needed to reach Lv55 on the floor matching its level
  {
    let L = 42, exp = Rules.expForLevel(42), fights = 0;
    const per = {};
    for (const z of ZONES) {
      const e = DB.encounters[z], tw = e.groups.reduce((s, g) => s + g.w, 0);
      per[z] = e.groups.reduce((s, grp) => s + (grp.w / tw) * grp.mons.reduce((t, [id, a, b]) => t + DB.monsters[id].exp * (a + b) / 2, 0), 0);
    }
    const trail = [];
    while (L < 55 && fights < 999) {
      const z = L < 48 ? 'd_abyss1' : L < 52 ? 'd_abyss2' : 'd_abyss3';
      exp += per[z]; fights++;
      while (exp >= Rules.expForLevel(L + 1)) { L++; if (L % 3 === 0 || L === 55) trail.push(`Lv${L}@${fights}`); }
    }
    console.log(`from Lv42 (after the demon king) to Lv55: ${fights} random fights (${trail.join(' ')})`);
  }
  const al = DB.monsters.abyss_lord;
  console.log(`abyss_lord: exp ${al.exp} gold ${al.gold} jp ${al.jp}; rewards pg_genesis_sword + pg_abyss_crest via the boss event`);
  // every pg_ item must be obtainable somewhere in this file's data (drops/steals) or be a chest/reward item
  const fromMon = new Set();
  for (const id in DB.monsters) { const m = DB.monsters[id]; for (const x of [m.drop && m.drop.item, m.rare && m.rare.item, m.steal && m.steal.item, m.steal && m.steal.rare]) if (x) fromMon.add(x); }
  const pg = Object.keys(DB.items).filter((i) => i.startsWith('pg_'));
  console.log(`pg_ items: ${pg.length}; dropped/stolen: ${pg.filter((i) => fromMon.has(i)).join(' ')}`);
  console.log(`           chest / reward only: ${pg.filter((i) => !fromMon.has(i)).join(' ')}`);
}

console.log(`\nsim_postgame: ${warns.length} warning(s)`);
for (const w of warns) console.log('  WARN ' + w);
