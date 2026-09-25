#!/usr/bin/env node
// 二刀流 check (owner: battle). Does a dual-wielding normal attack (MP 0) make the physical
// skills pointless? Measured with the real battle engine: each command runs through the engine's
// own attack / useAbility (hit roll, crits, def, elements, buffs, the dual swings with
// OFFHAND_MULT) against every monster of the stage with its HP raised out of reach, averaging
// --n (default 2000) trials per action and monster.
//
//   node tools/sim_dualwield.js                        all checkpoints (Lv15 20 25 30 35 40 55), ≈1 min
//   node tools/sim_dualwield.js --levels 20,30 --n 3000 --seed 7 --all   (--all: every phys skill, not the top 3)
//
// Builds (all ユウキ, the party's fighter, so the base stats are identical):
//   忍者          beeline warrior2 priest2 thief3 monk3 hunter4 → ninja (innate 二刀流); JP = sim_balance's
//                 model (8·Lv² along the plan); sub = the prerequisite job with the strongest phys skill.
//   計画職 (盾)   the job tools/sim_balance.js PLANS gives ユウキ at that level (ナイト/パラディン/勇者),
//                 weapon + shield.
//   計画職+二刀流 the same with 二刀流 (ninja_two_swords) in its support slot (instead of its usual
//                 support) and two one-handed weapons. Its ninja detour costs ≈1850 JP on top of the plan
//                 (printed per level), so this row is a "what if" until ≈Lv30.
//   Skills: the learned physical-damage actions of the job and of every job it could set as its sub
//   (tagged 〈job〉 — the player picks the sub the stage calls for). Skills always swing once (main hand).
// Gear: the best by the game's own score (Rules.itemScore = さいきょうそうび) among the shops of the
// towns visited so far (sim_balance STAGES) + the chest pools R.ITEM_TIERS of the level bands reached
// (chest-only items: one copy); the main hand avoids an element the stage resists (it applies to both
// swings). Lv55 = the post-game model of tools/sim_postgame.js (mastered jobs, abyss/legendary gear;
// 勇者+二刀流 is exactly its prepared ユウキ).
// Columns: MP · mean damage per use vs the stage's regular monsters (species averaged; metal/rare
// excluded) · vs its boss(es) · ×atk = vs the build's own 戦う. Group/all skills: damage per target
// with 3 foes present; random-target skills (手裏剣 …) count as single-target (all hits on a lone foe).
// SUMMARY: best single-target skill ÷ the 二刀流 戦う of the same build, and how many skills reach it.
// Target: 二刀流 is a solid MP-free option, but the good physical skills of the same period beat it
// per turn (「わざを使うほうが強い」), and multi-target skills keep their niche.
'use strict';
const R = require('./lib/load')({ quiet: true });
R.warn = () => {};
const { DB, U, Rules, State } = R;
const B = R.Battle;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Math.max(1, +arg('n', 2000));
const SEED = +arg('seed', 2024);
const LEVELS = arg('levels', '15,20,25,30,35,40,55').split(',').map(Number);
const ALL = argv.includes('--all');

// ------------------------------------------------------ stages (= tools/sim_balance.js)
const STAGES = [
  { id: 'regnas', zones: ['w_start'], towns: ['regnas'], lv: [1, 3] },
  { id: 'milt', zones: ['w_start'], towns: ['milt'], lv: [3, 4] },
  { id: 'wind', zones: ['d_wind1', 'd_wind2'], towns: [], lv: [4, 6], boss: ['boss_wind'], bossLv: 6 },
  { id: 'east', zones: ['w_east'], towns: ['porta'], lv: [6, 8] },
  { id: 'fort', zones: ['d_fort1', 'd_fort2'], towns: [], lv: [8, 11], boss: ['boss_fort'], bossLv: 11 },
  { id: 'forest', zones: ['w_sea1', 'w_forest'], towns: ['elfin'], lv: [11, 13] },
  { id: 'water', zones: ['d_water1', 'd_water2'], towns: [], lv: [13, 15], boss: ['boss_water'], bossLv: 15 },
  { id: 'desert', zones: ['w_desert'], towns: ['salva'], lv: [15, 16] },
  { id: 'pyramid', zones: ['d_pyr1', 'd_pyr2', 'd_pyr3'], towns: [], lv: [16, 18], boss: ['boss_pyramid'], bossLv: 18 },
  { id: 'snow', zones: ['w_sea2', 'w_snow'], towns: ['frost'], lv: [18, 20] },
  { id: 'ice', zones: ['d_ice1', 'd_ice2'], towns: [], lv: [20, 22], boss: ['boss_ice'], bossLv: 22 },
  { id: 'volcano_w', zones: ['w_volcano'], towns: [], lv: [22, 24] },
  { id: 'volcano', zones: ['d_vol1', 'd_vol2'], towns: [], lv: [24, 26], boss: ['boss_volcano'], bossLv: 26 },
  { id: 'arcana', zones: ['w_arcana'], towns: ['arcana'], lv: [26, 27] },
  { id: 'star', zones: ['d_star1', 'd_star2', 'd_star3', 'd_star4'], towns: [], lv: [27, 30], boss: ['boss_star'], bossLv: 30 },
  { id: 'sea3', zones: ['w_sea3'], towns: ['edge_shrine'], lv: [30, 32] },
  { id: 'demon_isle', zones: ['w_demon'], towns: [], lv: [32, 33] },
  { id: 'demon1', zones: ['d_demon1', 'd_demon2'], towns: [], lv: [33, 35], boss: ['boss_general1'], bossLv: 35 },
  { id: 'demon2', zones: ['d_demon3', 'd_demon4'], towns: [], lv: [35, 38], boss: ['boss_general2'], bossLv: 38 },
  { id: 'demon3', zones: ['d_demon5'], towns: [], lv: [38, 40], boss: ['boss_king1', 'boss_king2'], bossLv: 40 },
];
const POST = { id: 'abyss', zones: ['d_abyss1', 'd_abyss2', 'd_abyss3', 'd_abyss4'], towns: [], boss: ['boss_abyss'] };
const townsUpTo = (i) => STAGES.slice(0, i + 1).flatMap((s) => s.towns);
/** the dungeon stage a level is fought in (its boss level or the stage it starts) */
function stageAt(L) {
  if (L > 40) return -1;
  let si = STAGES.findIndex((s) => s.boss && L >= s.lv[0] && L <= s.bossLv);
  if (si < 0) si = STAGES.findIndex((s) => L >= s.lv[0] && L <= s.lv[1]);
  return si;
}
// item bands (items.js): 1 = Lv1-5, 2 = 6-11, 3 = 12-18, 4 = 19-26, 5 = 27-32, 6 = 33-40
const bandOf = (L) => { const top = [5, 11, 18, 26, 32]; const i = top.findIndex((t) => L <= t); return i < 0 ? 6 : i + 1; };

// ------------------------------------------------------ characters (adapted from sim_balance.js)
const PLAN_YUKI = {
  steps: [['warrior', 3, 1], ['knight', 5, 1], ['priest', 3], ['whitemage', 4], ['paladin', 5, 1], ['mage', 3], ['blackmage', 3], ['spellblade', 5], ['hero', 8, 1], ['paladin', 8]],
  sub: { warrior: null, knight: 'warrior', paladin: 'knight', hero: 'paladin' },
  reaction: ['paladin_last_stand', 'warrior_counter', 'knight_iron_wall', 'warrior_brace'],
  support: ['hero_heart', 'warrior_hp_up', 'warrior_crit_up', 'knight_guard_stance'],
};
// the shortest way to 忍者: its requirements (hunter 4 ← thief 3; monk 3 ← warrior 2 + priest 2)
const PLAN_NINJA = {
  steps: [['warrior', 2], ['priest', 2], ['thief', 3], ['monk', 3], ['hunter', 4], ['ninja', 8, 1]],
  sub: {}, // picked below: the prerequisite job with the strongest physical skill
  reaction: ['ninja_retaliate', 'warrior_counter'],
  support: ['dragoon_might', 'darkknight_power', 'hero_heart', 'warrior_crit_up'],
};
const jpBudget = (L) => 12 * L * L / 1.5;
const PRIORITY = {
  warrior: ['warrior_power_slash', 'warrior_double', 'warrior_sweep', 'warrior_hp_up', 'warrior_counter'],
  knight: ['knight_full_power', 'knight_bash', 'knight_oath'],
  priest: ['priest_heal', 'priest_heal_all', 'priest_revive', 'priest_cure', 'priest_awaken'],
  whitemage: ['whitemage_healing', 'whitemage_heal_wind', 'whitemage_resurrect', 'whitemage_esuna', 'whitemage_heal_up', 'whitemage_mending_hand'],
  mage: ['mage_fire', 'mage_ice', 'mage_thunder', 'mage_wind', 'mage_missile'],
  blackmage: ['blackmage_fire2', 'blackmage_ice2', 'blackmage_thunder2', 'blackmage_blast', 'blackmage_inferno', 'blackmage_magic_up'],
  paladin: ['paladin_holy_blade', 'paladin_heal', 'paladin_cross', 'paladin_wave'],
  hero: ['hero_radiant', 'hero_verdict', 'hero_courage', 'hero_heart', 'hero_luminous', 'hero_hope'],
  thief: ['thief_quick', 'thief_steal'],
  hunter: ['hunter_aim', 'hunter_double', 'hunter_rain'],
  ninja: ['ninja_shuriken', 'ninja_assassin', 'ninja_flame'],
};

function buildChar(id, L, plan) {
  const c = Rules.newChar(id);
  c.level = L; c.exp = Rules.expForLevel(L);
  let budget = jpBudget(L);
  const mains = [];
  for (const [job, lv, isMain] of plan.steps) {
    if (budget <= 0) break;
    if (!Rules.isJobUnlocked(c, job)) break;
    const rec = Rules.jobRec(c, job);
    const need = Math.max(0, Rules.jpForJobLevel(job, lv) - rec.total);
    const put = Math.min(need, budget);
    rec.total += put; rec.jp += put; budget -= put;
    if (isMain && !mains.includes(job)) mains.push(job);
  }
  if (!mains.length) return null; // the main job is out of reach at this level
  if (budget > 0) { const r = Rules.jobRec(c, mains[mains.length - 1]); r.total += budget; r.jp += budget; }
  for (const job in c.jobs) {
    const rec = c.jobs[job];
    const order = (PRIORITY[job] || []).filter((a) => DB.abilities[a]).concat(Rules.jobAbilities(job));
    for (const a of order) {
      if (rec.learned.includes(a) || DB.abilities[a].job !== job) continue;
      const cost = DB.abilities[a].jp || 0;
      if (cost <= rec.jp) { rec.jp -= cost; rec.learned.push(a); }
    }
  }
  let main = mains[0];
  for (const j of mains) if (Rules.actionList(c, j).length >= 2 || Rules.jobLevel(c, j) >= 5) main = j;
  c.job = main;
  let sub = (plan.sub && plan.sub[main]) || null;
  if (!sub && main === 'ninja') sub = bestPhysJob(c, ['monk', 'hunter', 'warrior', 'thief']);
  if (sub && (!Rules.isJobUnlocked(c, sub) || !Rules.actionList(c, sub).length)) sub = null;
  c.set.sub = sub;
  const pickLearned = (list) => list.find((a) => DB.abilities[a] && Rules.learned(c, a)) || null;
  c.set.reaction = pickLearned(plan.reaction);
  c.set.support = pickLearned(plan.support);
  return c;
}
/** strongest physical single-target power among the learned actions of these jobs */
function physPower(ab) {
  const d = (ab.effects || []).find((e) => e.type === 'damage' && (e.formula || 'phys') === 'phys');
  if (!d || !['enemy', 'random'].includes(ab.target)) return 0;
  const hits = Array.isArray(d.hits) ? (d.hits[0] + d.hits[1]) / 2 : d.hits || 1;
  return (d.power || 1) * hits;
}
function bestPhysJob(c, jobs) {
  let best = null, bp = 0;
  for (const j of jobs) for (const a of Rules.actionList(c, j)) { const p = physPower(DB.abilities[a]); if (p > bp) { bp = p; best = j; } }
  return best;
}
/** JP still needed for the ninja_two_swords detour (requirements + 900 in ninja) */
function detourJp(c) {
  let n = 0;
  for (const [job, lv] of [['warrior', 2], ['priest', 2], ['thief', 3], ['monk', 3], ['hunter', 4]]) {
    n += Math.max(0, Rules.jpForJobLevel(job, lv) - ((c.jobs[job] && c.jobs[job].total) || 0));
  }
  return n + (DB.abilities.ninja_two_swords.jp || 0);
}
function withTwoSwords(c0) {
  const c = U.clone(c0);
  const rec = Rules.jobRec(c, 'ninja');
  if (!rec.learned.includes('ninja_two_swords')) rec.learned.push('ninja_two_swords');
  c.set.support = 'ninja_two_swords';
  return c;
}

// ------------------------------------------------------ gear
const EQUIP_TYPES = { weapon: 1, shield: 1, head: 1, body: 1, acc: 1 };
function gearPool(si, L) {
  const pool = {};
  for (const t of townsUpTo(si)) for (const k of ['weapon', 'armor']) {
    const sh = DB.shops[t + '_' + k];
    if (sh) for (const it of sh.items) if (DB.items[it] && !DB.items[it].rare) pool[it] = 9;
  }
  for (let b = 1; b <= bandOf(L); b++) {
    for (const it of (R.ITEM_TIERS && R.ITEM_TIERS['band' + b]) || []) {
      if (DB.items[it] && EQUIP_TYPES[DB.items[it].type] && !pool[it]) pool[it] = 1;
    }
  }
  return pool;
}
/** mean element multiplier of a weapon against the stage's monsters (absorb counts as −1) */
function elemFit(id, tg) {
  const el = DB.items[id].element;
  const ms = tg ? tg.regs.concat(tg.bosses) : [];
  if (!el || !ms.length) return 1;
  return ms.reduce((s, m) => { const e = DB.monsters[m].elem; return s + Math.max(-1, e && e[el] != null ? e[el] : 1); }, 0) / ms.length;
}
/**
 * best weapon(s) by the game's score (a player also avoids a main-hand element the stage's
 * monsters resist; the main hand's element applies to both swings, the off hand's to none);
 * the rest of the slots by Rules.optimize (さいきょうそうび)
 */
function equipBuild(c, pool, dual, tg) {
  for (const s of Rules.SLOTS) c.equip[s] = null;
  const ws = Object.keys(pool).filter((id) => DB.items[id].type === 'weapon' && Rules.canEquip(c, id, 'weapon') && (!dual || !DB.items[id].twoHanded));
  const main = ws.slice().sort((a, b) => Rules.itemScore(c, b) * elemFit(b, tg) - Rules.itemScore(c, a) * elemFit(a, tg) || a.localeCompare(b));
  c.equip.weapon = main[0] || null;
  if (dual) {
    const off = ws.slice().sort((a, b) => Rules.itemScore(c, b) - Rules.itemScore(c, a) || a.localeCompare(b));
    c.equip.shield = off.find((id) => id !== main[0] || pool[id] > 1) || null;
  }
  State.newGame();
  R.Game.inv = {};
  for (const id in pool) {
    const t = DB.items[id].type;
    if (t !== 'weapon' && !(dual && t === 'shield')) R.Game.inv[id] = pool[id];
  }
  Rules.optimize(c);
  R.Game.inv = {};
  return ready(c);
}
function ready(c) { const st = Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.status = {}; return c; }

// post-game (tools/sim_postgame.js PREPARED ユウキ): mastered jobs, abyss/legendary gear
const T1 = ['warrior', 'priest', 'mage', 'thief'];
const PG_MASTER = [...T1, 'knight', 'monk', 'whitemage', 'blackmage', 'hunter', 'spellblade', 'paladin', 'ninja', 'dragoon', 'hero'];
function makeMastered(L, spec) {
  const c = Rules.newChar('yuki');
  c.level = L; c.exp = Rules.expForLevel(L);
  for (const job of PG_MASTER) {
    const rec = Rules.jobRec(c, job);
    rec.total = Rules.jpForJobLevel(job, 8); rec.jp = 0;
    rec.learned = Rules.jobAbilities(job).slice();
  }
  c.job = spec.job;
  Object.assign(c.set, { sub: spec.sub, reaction: 'paladin_last_stand', support: spec.support });
  for (const s of Rules.SLOTS) {
    const it = spec.equip[s] || null;
    c.equip[s] = it && Rules.canEquip(c, it, s) ? it : null;
    if (it && !c.equip[s]) console.log(`  (warning: ${spec.job} cannot equip ${it} in ${s})`);
  }
  return ready(c);
}
function postBuilds(L) {
  const acc = 'pg_clarity_amulet';
  return [
    { key: 'ninja', label: '忍者 (二刀流)', c: makeMastered(L, { job: 'ninja', sub: 'dragoon', support: 'dragoon_might', equip: { weapon: 'pg_void_katana', shield: 'amatsukaze', head: 'pg_halo', body: 'pg_starlight_garb', acc } }) },
    { key: 'plan', label: '勇者 (盾)', c: makeMastered(L, { job: 'hero', sub: 'dragoon', support: 'hero_heart', equip: { weapon: 'pg_chaos_sword', shield: 'pg_void_shield', head: 'pg_chaos_helm', body: 'pg_abyss_mail', acc } }) },
    { key: 'dual', label: '勇者+二刀流', c: makeMastered(L, { job: 'hero', sub: 'dragoon', support: 'ninja_two_swords', equip: { weapon: 'pg_chaos_sword', shield: 'dawn_sword', head: 'pg_chaos_helm', body: 'pg_abyss_mail', acc } }) },
  ];
}
function stageBuilds(si, L, tg) {
  const pool = gearPool(si, L);
  const out = [];
  const nin = buildChar('yuki', L, PLAN_NINJA);
  if (nin && nin.job === 'ninja') out.push({ key: 'ninja', label: `忍者${Rules.jobLevel(nin, 'ninja')} (二刀流)`, c: equipBuild(nin, pool, true, tg) });
  const plan = buildChar('yuki', L, PLAN_YUKI);
  const jn = DB.jobs[plan.job].name + Rules.jobLevel(plan, plan.job);
  out.push({ key: 'plan', label: `${jn} (盾)`, c: equipBuild(U.clone(plan), pool, false, tg) });
  const dual = withTwoSwords(plan);
  out.push({ key: 'dual', label: `${jn}+二刀流`, c: equipBuild(dual, pool, true, tg), detour: detourJp(plan) });
  return out;
}

// ------------------------------------------------------ measurement (the real engine)
const HUGE = 1e7;
const ZERO_BUFFS = () => ({ atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 });
/**
 * mean damage dealt per use of abId (null = 戦う, else an ability id) by c on nFoes copies of monId.
 * Every trial starts fresh (full HP/MP, no buffs/statuses); damage = the engine's own dealt counter.
 */
function measure(c, abId, monId, nFoes) {
  const eng = new B.Engine({ party: [U.clone(c)], mons: Array(nFoes).fill(monId), inv: {}, live: false, noSurprise: true });
  const u = eng.party[0];
  const tgt = eng.mons[0];
  const ab = abId && DB.abilities[abId];
  let dealt = 0;
  for (let i = 0; i < N; i++) {
    for (const m of eng.mons) { m.hp = m.mhp = HUGE; m.buffs = ZERO_BUFFS(); m.status = {}; m.turns = {}; m.defending = false; }
    u.hp = u.mhp; u.mp = u.mmp; u.buffs = ZERO_BUFFS(); u.status = {}; u.turns = {};
    eng.reactQ = []; eng.result = null; eng.killed = [];
    const d0 = eng.stats.dealt;
    B.drain(abId ? eng.useAbility(u, abId, ab, tgt, null) : eng.attack(u, tgt, false));
    dealt += eng.stats.dealt - d0;
  }
  return dealt / N;
}
function isPhysDamage(ab) { return ab && ab.kind === 'action' && (ab.effects || []).some((e) => e.type === 'damage' && (e.formula || 'phys') === 'phys'); }
const MULTI = { group: 1, enemies: 1 };

function stageTargets(st) {
  const regs = new Set();
  for (const z of st.zones) for (const g of (DB.encounters[z] || { groups: [] }).groups) for (const [id] of g.mons) {
    const f = DB.monsters[id].flags || [];
    if (!f.includes('metal') && !f.includes('rare') && !f.includes('boss')) regs.add(id);
  }
  const bosses = [];
  for (const t of st.boss || []) for (const [id] of DB.troops[t].mons) if ((DB.monsters[id].flags || []).includes('boss') && !bosses.includes(id)) bosses.push(id);
  return { regs: [...regs], bosses };
}

/**
 * every row of one build: 戦う + the learned physical skills of its job and of every job it could set
 * as its sub (tagged 〈job〉: the player picks the sub that holds the skill the stage calls for)
 */
function buildRows(b, tg) {
  const c = b.c;
  const ids = [[null, null]];
  const jobs = [c.job, ...Object.keys(c.jobs).filter((j) => j !== c.job && Rules.isJobUnlocked(c, j))];
  for (const job of jobs) for (const a of Rules.actionList(c, job)) if (isPhysDamage(DB.abilities[a])) ids.push([a, job === c.job ? null : job]);
  const dual = c.set.support === 'ninja_two_swords' || (DB.jobs[c.job].innate || {}).twoSwords;
  const rows = [];
  for (const [id, sub] of ids) {
    const ab = id && DB.abilities[id];
    const multi = !!(ab && MULTI[ab.target]);
    const n = multi ? 3 : 1;
    const reg = tg.regs.reduce((s, m) => s + measure(c, id, m, n) / n, 0) / Math.max(1, tg.regs.length);
    const boss = tg.bosses.length ? tg.bosses.reduce((s, m) => s + measure(c, id, m, 1), 0) / tg.bosses.length : null;
    const name = ab ? ab.name + (sub ? `〈${DB.jobs[sub].name}〉` : '') : dual ? '戦う(二刀流)' : '戦う';
    rows.push({ id, name, sub, mp: id ? Rules.mpCost(c, id) : 0, multi, target: ab ? ab.target : 'enemy', reg, boss });
  }
  return rows;
}

// ------------------------------------------------------ output
const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += /[　-￿]/.test(ch) ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const padL = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; };
const f0 = (x) => (x == null ? '-' : String(Math.round(x)));
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const wname = (id) => (id ? DB.items[id].name + (DB.items[id].atk ? DB.items[id].atk : '') : '-');

console.log(`=== 二刀流 vs 物理わざ ===  (real engine, ${N} trials per action × monster; seed ${SEED})`);
const summary = [];
for (const L of LEVELS) {
  U.seed(SEED + L * 101);
  const si = stageAt(L);
  const st = si < 0 ? POST : STAGES[si];
  const tg = stageTargets(st);
  const builds = si < 0 ? postBuilds(L) : stageBuilds(si, L, tg);
  const defs = tg.regs.map((m) => DB.monsters[m].def);
  console.log(`\n--- Lv${L}  ${st.id}  (${st.zones.join(',')}; boss ${tg.bosses.join('+') || '-'})  regular def ${Math.min(...defs)}–${Math.max(...defs)} (avg ${f0(defs.reduce((a, b) => a + b, 0) / defs.length)}), ${tg.regs.length} species`);
  console.log(`    ${pad('build', 22)} ${pad('weapons', 30)} ${pad('atk/atk2', 9)} ${pad('action', 28)} ${padL('MP', 3)} ${padL('vs regs', 8)} ${padL('vs boss', 8)} ${padL('×atk', 5)}`);
  const res = {};
  for (const b of builds) {
    const st2 = Rules.stats(b.c);
    const rows = buildRows(b, tg);
    const atk = rows[0];
    const singles = rows.slice(1).filter((r) => !r.multi).sort((a, b2) => b2.reg - a.reg);
    const multis = rows.slice(1).filter((r) => r.multi).sort((a, b2) => b2.reg - a.reg);
    const shown = ALL ? [atk, ...singles, ...multis] : [atk, ...singles.slice(0, 3), ...multis.slice(0, 1)];
    shown.forEach((r, i) => {
      const head = i === 0
        ? `    ${pad(b.label, 22)} ${pad(wname(b.c.equip.weapon) + (st2.atk2 ? '+' + wname(b.c.equip.shield) : b.c.equip.shield ? '/' + wname(b.c.equip.shield) : ''), 30)} ${pad(st2.atk + (st2.atk2 ? '/' + st2.atk2 : ''), 9)}`
        : `    ${pad('', 22)} ${pad('', 30)} ${pad('', 9)}`;
      const nm = r.name + (r.multi ? (r.target === 'group' ? ' [群/体]' : ' [全/体]') : r.target === 'random' ? ' [乱]' : '');
      console.log(`${head} ${pad(nm, 28)} ${padL(r.mp, 3)} ${padL(f0(r.reg), 8)} ${padL(f0(r.boss), 8)} ${padL(f2(r.reg / Math.max(1e-9, atk.reg)), 5)}`);
    });
    if (b.detour != null) console.log(`    ${pad('', 22)} (二刀流 detour ≈${b.detour} JP more than the plan; budget 8·Lv² = ${jpBudget(L)})`);
    res[b.key] = { atk, singles, best: singles[0] || null, multi: multis[0] || null, label: b.label };
  }
  summary.push({ L, st: st.id, res });
}

console.log('\n=== SUMMARY ===  (mean damage per turn vs the stage\'s regular monsters / vs its boss; skills: single-target physical ones)');
console.log(`${pad('Lv', 3)} ${pad('stage', 8)}| ${pad('忍者 二刀流', 10)} ${pad('忍者の最強わざ (MP) ×二刀流', 44)}| ${pad('計画職 戦う', 10)} ${pad('+二刀流', 9)} ${pad('計画職の最強わざ (MP) ×二刀流', 40)} ${pad('わざ≥二刀流', 11)}`);
for (const s of summary) {
  const n = s.res.ninja, p = s.res.plan, d = s.res.dual;
  const vs = (x) => (x ? `${padL(f0(x.reg), 4)}/${padL(f0(x.boss), 4)}` : '    -    ');
  const skill = (b, ref) => (b ? `${pad(b.name, 20)} ${vs(b)} (${padL(b.mp, 2)}) ${f2(b.reg / ref.reg)}×` : '-');
  const beat = (list, ref) => `${list.filter((r) => r.reg >= ref.reg).length}/${list.length}`;
  console.log(`${pad(s.L, 3)} ${pad(s.st, 8)}| ${pad(vs(n && n.atk), 10)} ${pad(n ? skill(n.best, n.atk) + '  ' + beat(n.singles, n.atk) : '-', 44)}| ${pad(vs(p.atk), 10)} ${pad(vs(d.atk), 9)} ${pad(skill(p.best, d.atk), 40)} ${pad(beat(p.singles, d.atk), 11)}`);
}

// the rule itself: no off-hand weapon → one swing
{
  const c = withTwoSwords(buildChar('yuki', 30, PLAN_YUKI));
  equipBuild(c, gearPool(stageAt(30), 30), false, stageTargets(STAGES[stageAt(30)]));
  const eng = new B.Engine({ party: [c], mons: ['yami_kishi'], inv: {}, live: false, noSurprise: true });
  eng.mons[0].hp = eng.mons[0].mhp = HUGE;
  const swings = [...eng.attack(eng.party[0], eng.mons[0], false)].filter((e) => e.t === 'fx').length;
  console.log(`\ncheck: 二刀流 support with a shield (${wname(c.equip.shield)}) → ${swings} swing(s) per 戦う (want 1)`);
}
