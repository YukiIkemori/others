#!/usr/bin/env node
// Jobs & abilities behaviour tests (node, no DOM). Drives every job ability,
// reaction and support of src/data/jobs.js + abilities*.js through the real
// rules (R.Rules) and battle engine (R.Battle.Engine / simulate) and checks
// that each one does what its description says.
//   node tools/fixtures/jobs/test_jobs.js          (exit 1 on failure)
// Test monsters/abilities below are registered only inside this node sandbox.
'use strict';
const path = require('path');
const R = require(path.join(__dirname, '..', '..', 'lib', 'load'))({ quiet: true });
R.warn = () => {};
const { U, DB } = R;
const B = R.Battle;

let passes = 0, fails = 0, section = '';
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log(`  FAIL [${section}] ${msg}`); } };
const sec = (n) => { section = n; };
if (!B || !B.Engine) { console.log('R.Battle.Engine missing — battle.js not loaded'); process.exit(1); }

// ------------------------------------------------------------ fixtures
const mon = (id, o) => { DB.monsters[id] = Object.assign({ name: 'ダミー', sprite: 'jelly', lv: 20, hp: 9000, mp: 50, atk: 60, def: 44, agi: 30, mag: 40, mdef: 20, exp: 10, gold: 10, jp: 5, actions: [{ id: 'attack', w: 1 }] }, o); };
mon('jb_dummy', {});
mon('jb_weak', { name: 'ザコ', hp: 60, atk: 30, def: 10, lv: 5 });
mon('jb_undead', { name: 'ホネ', flags: ['undead'] });
mon('jb_flyer', { name: 'トリ', flags: ['flying'] });
mon('jb_boss', { name: 'ボス', flags: ['boss'] });
mon('jb_metal', { name: 'メタル', hp: 8, def: 999, flags: ['metal'] });
mon('jb_thief', { name: 'カモ', steal: { item: 'herb', rare: 'seed_luk' } });
mon('jb_hitter', { name: 'ゴロツキ', atk: 400, hit: 999 });
mon('jb_band', { name: 'まもの', lv: 1, hp: 30, atk: 12, def: 2, mag: 5, mdef: 1, agi: 8, actions: [{ id: 'attack', w: 3 }, { id: 'en_jb_bolt', w: 1 }] });
DB.abilities.en_jb_bolt = { name: 'でんげき', kind: 'action', mp: 0, magic: true, target: 'enemy', effects: [{ type: 'damage', formula: 'magic', power: 30, scale: 0.5 }], fx: 'thunder' };
DB.abilities.en_jb_buff = { name: 'きあい', kind: 'action', mp: 0, target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 2 }], fx: 'buff' };

R.State.newGame();
const BAND_LV = [5, 11, 18, 26, 32, 40];
const bandOf = (L) => { for (let b = 0; b < BAND_LV.length; b++) if (L <= BAND_LV[b]) return b + 1; return 6; };
function bestWeapon(job, L) {
  let best = null, bv = -1;
  for (const id in DB.items) {
    const it = DB.items[id];
    if (it.type !== 'weapon' || it.rare || !(DB.jobs[job].weapons || []).includes(it.wtype) || (it.band || 1) > bandOf(L)) continue;
    const v = (it.atk || 0) + (it.mag || 0);
    if (v > bv) { best = id; bv = v; }
  }
  return best;
}
/** a character with every job open (Lv8 everywhere), in `job`, knowing `learned` (default: the whole job) */
function member(cid, job, L, learned, set) {
  const c = R.Rules.newChar(cid);
  c.level = L; c.exp = R.Rules.expForLevel(L);
  for (const j in DB.jobs) R.Rules.jobRec(c, j).total = 2000;
  c.job = job;
  const setIds = Object.values(set || {}).filter((a) => DB.abilities[a]);
  for (const a of learned || R.Rules.jobAbilities(job).concat(setIds)) {
    const rec = R.Rules.jobRec(c, DB.abilities[a].job);
    if (!rec.learned.includes(a)) rec.learned.push(a);
  }
  Object.assign(c.set, set || {});
  for (const s of R.Rules.SLOTS) c.equip[s] = null;
  c.equip.weapon = bestWeapon(job, L);
  const st = R.Rules.stats(c);
  c.hp = st.hp; c.mp = st.mp; c.status = {};
  return c;
}
/** forget one ability of c's job (not keep) so the job is not mastered — no signature ability */
function unmaster(c, keep) {
  const rec = c.jobs[c.job];
  const drop = rec.learned.find((a) => a !== keep && DB.abilities[a].job === c.job && DB.abilities[a].kind === 'action');
  if (drop) rec.learned.splice(rec.learned.indexOf(drop), 1);
  return c;
}
function engine(party, mons, o) {
  return new B.Engine(Object.assign({ party, mons, inv: {}, live: false, noSurprise: true }, o || {}));
}
const run = (gen) => { const out = []; for (const ev of gen) out.push(ev); return out; };
const texts = (evs) => evs.filter((e) => e.t === 'msg').map((e) => e.text);
const said = (evs, s) => texts(evs).some((t) => t.includes(s));
const has = (ab, t) => ab.effects.some((e) => e.type === t);
const eff = (ab, t) => ab.effects.find((e) => e.type === t);
const jobIds = Object.keys(DB.jobs);
const allAbilities = jobIds.flatMap((j) => R.Rules.jobAbilities(j));
U.seed(777);

// ================================================================ data sanity
sec('data');
ok(jobIds.length === 19, '19 jobs');
ok(DB.abilities.warrior_power_slash && DB.abilities.priest_heal && DB.abilities.mage_fire, 'start abilities exist');
for (const cid of R.PARTY_ORDER) {
  const c = R.Rules.newChar(cid);
  const cmds = R.Rules.commands(c);
  ok(cmds[1].type === 'job' && R.Rules.actionList(c, c.job).length === 1, `${cid}: start job command has its start ability`);
  ok(R.Rules.canEquip(c, c.equip.weapon, 'weapon') && R.Rules.canEquip(c, c.equip.body, 'body'), `${cid}: start gear allowed in start job`);
}

// ================================================================ job tree via real JP gain
sec('tree');
{
  const c = R.Rules.newChar('yuki');
  ok(R.Rules.unlockedJobs(c).sort().join() === 'mage,priest,thief,warrior', 'fresh character: only tier 1 open');
  const path = [['warrior', 3], ['priest', 3], ['mage', 3], ['knight', 5], ['whitemage', 4], ['blackmage', 3], ['paladin', 5], ['spellblade', 5]];
  const unlocked = [];
  for (const [job, lv] of path) {
    ok(R.Rules.changeJob(c, job) != null, `can change to ${job} when its turn comes`);
    const r = R.Rules.gainJp(c, R.Rules.jpForJobLevel(job, lv));
    unlocked.push(...r.unlocked);
    ok(R.Rules.jobLevel(c, job) === lv, `${job} reaches job Lv${lv} with its tier's table`);
  }
  ok(R.Rules.isJobUnlocked(c, 'hero'), 'hero unlocked by the minimum path (paladin 5 + spellblade 5)');
  ok(unlocked.includes('hero') && unlocked.includes('paladin') && unlocked.includes('spellblade'), 'gainJp reports newly unlocked jobs');
  ok(!R.Rules.isJobUnlocked(c, 'ninja') && !R.Rules.isJobUnlocked(c, 'darkknight'), 'unrelated tier-3 jobs stay locked');
  const d = member('non', 'priest', 1);
  for (const j of jobIds) {
    const removed = R.Rules.changeJob(d, j);
    ok(removed != null && d.job === j, `changeJob → ${j}`);
    ok(R.Rules.commands(d).some((k) => k.type === 'job' && k.job === j && k.name === DB.jobs[j].command), `${j}: battle command ${DB.jobs[j].command}`);
  }
}

// ================================================================ JP tables by tier
sec('jp tables');
{
  const T = (j) => R.Rules.jpTable(j);
  ok(T('warrior').join() === R.Rules.JP_TABLE.join(), 'tier 1 uses the base table');
  for (const [j, t] of [['knight', 2], ['paladin', 3], ['hero', 4]]) {
    const m = R.Rules.JP_TIER_MULT[t];
    ok(T(j).length === 8 && T(j).every((v, i) => Math.abs(v - R.Rules.JP_TABLE[i] * m) <= 5), `${j}: tier ${t} table = base ×${m}`);
    ok(T(j)[7] > T('warrior')[7], `${j}: Lv8 costs more JP than a tier-1 job`);
  }
  const c = R.Rules.newChar('yuki');
  R.Rules.jobRec(c, 'knight').total = R.Rules.JP_TABLE[4]; // 700: old knight Lv5, new knight Lv3
  ok(R.Rules.jobLevel(c, 'knight') === 3 && R.Rules.jpToNextLevel(c, 'knight') === T('knight')[3] - 700, 'jobLevel / jpToNextLevel read the tier table');
  ok(R.Rules.jpForJobLevel('hero', 8) === T('hero')[7] && R.Rules.jpForJobLevel('hero', 99) === T('hero')[7], 'jpForJobLevel clamps');
}

// ================================================================ permanent unlocks & old saves
sec('unlocks');
{
  // an unlock stays even if the requirement is no longer met (e.g. after a JP table change)
  const c = R.Rules.newChar('yuki');
  R.Rules.changeJob(c, 'thief'); R.Rules.gainJp(c, R.Rules.jpForJobLevel('thief', 3));
  R.Rules.changeJob(c, 'warrior'); R.Rules.gainJp(c, R.Rules.jpForJobLevel('warrior', 2));
  R.Rules.changeJob(c, 'priest'); R.Rules.gainJp(c, R.Rules.jpForJobLevel('priest', 2));
  ok(R.Rules.isJobUnlocked(c, 'hunter') && R.Rules.isJobUnlocked(c, 'monk') && c.unlocked.hunter && c.unlocked.monk, 'gainJp records unlocks in c.unlocked');
  R.Rules.changeJob(c, 'hunter'); R.Rules.gainJp(c, R.Rules.jpForJobLevel('hunter', 4));
  R.Rules.changeJob(c, 'monk'); R.Rules.gainJp(c, R.Rules.jpForJobLevel('monk', 3));
  ok(R.Rules.isJobUnlocked(c, 'ninja') && c.unlocked.ninja, 'ninja unlocked (hunter 4 + monk 3)');
  R.Rules.changeJob(c, 'ninja');
  c.jobs.hunter.total = 10; c.jobs.monk.total = 10; // requirements no longer met
  ok(!R.Rules.meetsJobReq(c, 'ninja') && R.Rules.isJobUnlocked(c, 'ninja'), 'unlocked job stays open when its requirements drop');
  R.Rules.jobRec(c, 'ninja').jp = 9999;
  ok(R.Rules.canLearn(c, 'ninja_two_swords').ok, 'abilities of a permanently unlocked job can be learned');
  ok(R.Rules.slotOptions(c, 'sub').length >= 0 && R.Rules.changeJob(c, 'warrior') && R.Rules.changeJob(c, 'ninja') != null, 'can leave and come back to it');
  // a job the character already has JP in (old save without c.unlocked) counts as open
  const d = R.Rules.newChar('non');
  delete d.unlocked;
  d.jobs.sage = { jp: 50, total: 300, learned: [] };
  ok(R.Rules.isJobUnlocked(d, 'sage') && !R.Rules.meetsJobReq(d, 'sage'), 'old save: a job with JP in it is open');
  d.job = 'darkknight';
  ok(R.Rules.isJobUnlocked(d, 'darkknight'), 'old save: the current job is open');
  // save from before the tier tables: job levels are kept, unlocks survive a save/load
  R.State.newGame();
  const y = R.Game.party[0];
  const old = { warrior: 1000, knight: 700, whitemage: 450, paladin: 700, hunter: 2400 }; // old table: Lv6, 5, 4, 5 and Lv8+400
  for (const j in old) y.jobs[j] = { jp: 30, total: old[j], learned: [] };
  y.job = 'paladin'; delete y.unlocked;
  const save = R.State.serialize();
  delete save.game.jpTables;
  ok(R.State.deserialize(JSON.parse(JSON.stringify(save))), 'old save loads');
  const y2 = R.Game.party[0];
  ok(R.Rules.jobLevel(y2, 'warrior') === 6 && R.Rules.jobLevel(y2, 'knight') === 5 && R.Rules.jobLevel(y2, 'whitemage') === 4 && R.Rules.jobLevel(y2, 'paladin') === 5,
    'old save: job levels are the same after migration');
  ok(R.Rules.jobLevel(y2, 'hunter') === 8 && y2.jobs.hunter.total === R.Rules.jpForJobLevel('hunter', 8) + 400, 'old save: JP beyond Lv8 is kept');
  ok(y2.jobs.knight.jp === 30, 'old save: spendable JP untouched');
  ok(y2.unlocked && y2.unlocked.paladin && y2.unlocked.knight && R.Rules.isJobUnlocked(y2, 'paladin'), 'old save: unlocks recorded on load');
  ok(R.Game.jpTables === 2, 'migrated game is marked');
  const again = R.State.serialize();
  ok(R.State.deserialize(JSON.parse(JSON.stringify(again))) && R.Game.party[0].jobs.knight.total === y2.jobs.knight.total, 'a migrated save is not migrated twice');
  R.State.newGame();
}

// ================================================================ mastery bonus
sec('mastery');
{
  for (const j of jobIds) {
    const mb = DB.jobs[j].masterBonus;
    ok(mb && Object.keys(mb).length && Object.keys(mb).every((k) => R.Rules.STATS.includes(k) && mb[k] > 0), `${j}: masterBonus is a stat map`);
    ok(R.Rules.masterBonusText(j).length > 0, `${j}: masterBonusText`);
  }
  const c = R.Rules.newChar('yuki');
  c.level = 20; c.exp = R.Rules.expForLevel(20);
  const st = (x) => R.Rules.stats(x);
  const rec = R.Rules.jobRec(c, 'mage');
  rec.jp = 99999; rec.total = 99999;
  const s0 = st(c);
  const list = R.Rules.jobAbilities('mage');
  for (const a of list.slice(0, -1)) R.Rules.learn(c, a);
  ok(st(c).int === s0.int && st(c).mp === s0.mp, 'no bonus before the job is mastered');
  const mp0 = c.mp;
  R.Rules.learn(c, list[list.length - 1]);
  ok(R.Rules.isMastered(c, 'mage'), 'mage mastered');
  const mb = DB.jobs.mage.masterBonus;
  // (知力 also gets the mage's signature 知力アップ +15 %, always on once mastered)
  ok(st(c).int >= s0.int + (mb.int || 0) && st(c).mp === s0.mp + (mb.mp || 0), 'mastery bonus added (warrior job, mage mastered)');
  ok(R.Rules.signatures(c).includes('mage_int_up') && (R.Rules.mods(c).intPct || 0) === 15, 'mastered mage: 知力アップ always on without a slot');
  ok(c.mp === Math.min(st(c).mp, mp0 + (mb.mp || 0)), 'current MP rises with the bonus');
  R.Rules.changeJob(c, 'thief');
  const t = st(c); c.jobs.mage.learned = [];
  ok(t.int - st(c).int >= (mb.int || 0) && !R.Rules.signatures(c).length, 'the bonus applies in every job');
}

// ================================================================ every action ability
sec('actions');
const ROLE = (ab) => (has(ab, 'heal') || has(ab, 'revive') || ab.job === 'priest' || ab.job === 'whitemage' ? 'non' : ab.magic ? 'metem' : 'yuki');
function tryUse(id, setup, check, tries) {
  const ab = DB.abilities[id];
  for (let i = 0; i < (tries || 12); i++) {
    const c = member(ROLE(ab), ab.job, 25);
    const ally = member('non', 'priest', 25), ally2 = member('metem', 'mage', 25);
    const e = engine([c, ally, ally2], setup.mons || ['jb_dummy', 'jb_dummy']);
    const u = e.party[0];
    u.mp = 999;
    const ctx = { e, u, ab, foe: e.mons[0], ally: e.party[1] };
    if (setup.pre) setup.pre(ctx);
    const target = setup.target ? setup.target(ctx) : ['enemy', 'group', 'random', 'enemies'].includes(ab.target) ? ctx.foe : ab.target === 'ally_dead' ? ctx.ally : ab.target === 'self' ? u : ctx.ally;
    ctx.before = { fhp: ctx.foe.hp, ahp: ctx.ally.hp, amp: ctx.ally.mp, uhp: u.hp, ump: u.mp, fbuf: Object.assign({}, ctx.foe.buffs), abuf: Object.assign({}, ctx.ally.buffs), ubuf: Object.assign({}, u.buffs) };
    const cost = e.mpCost(u, id, ab);
    ctx.ev = run(e.useAbility(u, id, ab, target, null));
    ctx.cost = cost;
    if (check(ctx)) return true;
  }
  return false;
}
let used = 0;
for (const id of allAbilities) {
  const ab = DB.abilities[id];
  if (ab.kind !== 'action') continue;
  used++;
  const n = ab.name;
  // field-only abilities are refused in battle
  if (ab.effects.every((f) => ['teleport', 'exit', 'repel'].includes(f.type))) {
    const e = engine([member('metem', ab.job, 20)], ['jb_dummy']);
    ok(e.unusable(e.party[0], id) === 'field', `${n}: not selectable in battle`);
    continue;
  }
  const selfMp = has(ab, 'healMp') || ab.effects.some((f) => f.mp);
  const announced = (x) => said(x.ev, n) || (!!ab.msg && said(x.ev, ab.msg.replace(/\{user\}/g, x.u.name).replace(/\{name\}/g, n)));
  ok(tryUse(id, {}, (x) => announced(x) && (selfMp || x.u.mp === 999 - x.cost), 1), `${n}: announced and costs ${ab.mp} MP`);
  const dm = eff(ab, 'damage');
  if (dm && dm.formula === 'percent') {
    ok(tryUse(id, {}, (x) => x.foe.hp < x.before.fhp, 40), `${n}: percent damage lands on a normal foe`);
    ok(tryUse(id, { mons: ['jb_metal'] }, (x) => x.foe.hp < x.before.fhp, 40), `${n}: works on metal foes`);
    ok(tryUse(id, { mons: ['jb_boss'] }, (x) => x.foe.hp === x.before.fhp && said(x.ev, '効かなかった'), 3), `${n}: no effect on bosses`);
  } else if (dm && dm.mp) {
    ok(tryUse(id, { pre: (x) => { x.u.mp = 0; } }, (x) => x.foe.mp < 50 && x.u.mp > 0), `${n}: drains the foe's MP`);
  } else if (dm) {
    ok(tryUse(id, {}, (x) => x.foe.hp < x.before.fhp), `${n}: deals damage`);
    if (dm.vs && dm.vs.undead) {
      const plain = [], und = [];
      for (let i = 0; i < 40; i++) {
        tryUse(id, {}, (x) => { plain.push(x.before.fhp - x.foe.hp); return true; }, 1);
        tryUse(id, { mons: ['jb_undead'] }, (x) => { und.push(x.before.fhp - x.foe.hp); return true; }, 1);
      }
      const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      ok(avg(und) > avg(plain) * 1.3, `${n}: stronger against undead (${avg(und).toFixed(0)} vs ${avg(plain).toFixed(0)})`);
    }
    if (dm.hpCost) ok(tryUse(id, {}, (x) => x.u.hp < x.before.uhp && x.u.hp >= x.before.uhp - Math.ceil(x.u.mhp * dm.hpCost)), `${n}: costs ${dm.hpCost * 100}% HP`);
    if (dm.drain) ok(tryUse(id, { pre: (x) => { x.u.hp = 1; } }, (x) => x.u.hp > 1), `${n}: drains HP`);
    if (ab.target === 'enemies' || ab.target === 'group') ok(tryUse(id, {}, (x) => x.e.mons.every((m) => m.hp < 9000)), `${n}: hits every target`);
  }
  if (has(ab, 'heal')) ok(tryUse(id, { pre: (x) => { x.ally.hp = 1; x.u.hp = Math.max(1, x.u.hp - 5); }, target: (x) => (ab.target === 'self' ? x.u : x.ally) }, (x) => (ab.target === 'self' ? x.u.hp > x.before.uhp : x.ally.hp > 1)), `${n}: heals`);
  if (has(ab, 'healMp')) ok(tryUse(id, { pre: (x) => { x.ally.mp = 0; } }, (x) => x.ally.mp > 0), `${n}: restores MP`);
  if (has(ab, 'revive')) {
    ok(tryUse(id, { pre: (x) => run(x.e.die(x.ally, null)) }, (x) => x.ally.hp > 0 && said(x.ev, '生き返った')), `${n}: revives`);
  }
  if (has(ab, 'cure')) {
    const cu = eff(ab, 'cure');
    const list = cu.statuses === 'all' ? ['poison', 'blind', 'silence', 'sleep'] : cu.statuses;
    ok(tryUse(id, { pre: (x) => { const t = ab.target === 'self' ? x.u : x.ally; for (const s of list) { t.status[s] = true; t.turns[s] = 3; } }, target: (x) => (ab.target === 'self' ? x.u : x.ally) },
      (x) => { const t = ab.target === 'self' ? x.u : x.ally; return list.every((s) => !t.status[s]); }, 1), `${n}: cures ${list.join('/')}`);
  }
  if (has(ab, 'status')) {
    const s = eff(ab, 'status').status;
    ok(tryUse(id, {}, (x) => (s === 'death' ? x.foe.hp === 0 : !!x.foe.status[s]), 60), `${n}: can inflict ${s}`);
  }
  if (has(ab, 'regen')) ok(tryUse(id, {}, (x) => !!(ab.target === 'allies' ? x.u : x.ally).status.regen), `${n}: gives regen`);
  if (has(ab, 'buff')) {
    for (const b of ab.effects.filter((f) => f.type === 'buff')) {
      const who = (x) => (ab.target === 'self' ? x.u : ['enemy', 'group', 'enemies', 'random'].includes(ab.target) ? x.foe : ab.target === 'allies' ? x.u : x.ally);
      ok(tryUse(id, {}, (x) => Math.sign(who(x).buffs[b.stat]) === Math.sign(b.stages), 30), `${n}: ${b.stat} ${b.stages > 0 ? '+' : ''}${b.stages}`);
    }
  }
  if (has(ab, 'dispel')) ok(tryUse(id, { pre: (x) => { x.foe.buffs.atk = 2; x.foe.buffs.def = 1; } }, (x) => x.foe.buffs.atk === 0 && x.foe.buffs.def === 0), `${n}: removes buffs`);
  if (has(ab, 'steal')) ok(tryUse(id, { mons: ['jb_thief'] }, (x) => x.e.stolen.length === 1 && x.foe.stolen, 30), `${n}: steals`);
  if (has(ab, 'scan')) ok(tryUse(id, {}, (x) => said(x.ev, 'レベル')), `${n}: shows the foe's data`);
  if (has(ab, 'escape')) {
    ok(tryUse(id, {}, (x) => x.e.result === 'escape', 1), `${n}: guaranteed escape`);
    ok(tryUse(id, { mons: ['jb_boss'] }, (x) => x.e.result !== 'escape', 1), `${n}: not from bosses`);
  }
  if (ab.effects.some((f) => f.hpCost) && !dm) ok(tryUse(id, {}, (x) => x.u.hp < x.before.uhp), `${n}: costs HP`);
}
{ // rare steal bonus and ability-driven rare steals
  let rare = 0, plain = 0;
  for (let i = 0; i < 300; i++) {
    tryUse('thief_steal_rare', { mons: ['jb_thief'] }, (x) => { if (x.e.stolen[0] && x.e.stolen[0].rare) rare++; return true; }, 1);
    tryUse('thief_steal', { mons: ['jb_thief'] }, (x) => { if (x.e.stolen[0] && x.e.stolen[0].rare) plain++; return true; }, 1);
  }
  ok(rare > plain * 1.8, `大物狙い steals rares more often (${rare} vs ${plain})`);
}

// ================================================================ field use (menu)
sec('field');
if (R.Menu && R.Menu.applyFieldEffect) {
  for (const id of allAbilities) {
    const ab = DB.abilities[id];
    if (ab.kind !== 'action' || !ab.fieldUse) continue;
    const t = ab.effects.map((f) => f.type);
    if (t.includes('teleport') || t.includes('exit')) { ok(R.Menu.applyFieldEffect(ab, member('metem', ab.job, 20), [], {})[t.includes('exit') ? 'exit' : 'teleport'], `${ab.name}: field ${t.join('/')}`); continue; }
    if (t.includes('repel')) { R.Game.repelSteps = 0; R.Menu.applyFieldEffect(ab, member('yuki', ab.job, 20), [], {}); ok(R.Game.repelSteps > 0 || (R.Field && R.Field.repel), `${ab.name}: repels monsters`); continue; }
    const user = member('non', ab.job, 20), tgt = member('yuki', 'warrior', 20);
    if (t.includes('revive')) tgt.hp = 0; else { tgt.hp = 1; tgt.status = { poison: true, blind: true, sleep: true, silence: true }; }
    if (ab.target === 'self') user.hp = 1;
    const r = R.Menu.applyFieldEffect(ab, user, [ab.target === 'self' ? user : tgt], {});
    ok(r.changed, `${ab.name}: works from the field menu`);
  }
} else console.log('  (skip field: R.Menu.applyFieldEffect not loaded)');

// ================================================================ reactions
sec('reactions');
function reactTest(id, arrange, expect, tries) {
  const ra = DB.abilities[id];
  for (let i = 0; i < (tries || 40); i++) {
    const c = member('yuki', ra.job, 25, null, { reaction: id });
    const ally = member('non', 'priest', 25), ally2 = member('metem', 'mage', 25);
    const e = engine([c, ally, ally2], ['jb_hitter', 'jb_dummy'], { inv: { herb: 5, healing_grass: 5 } });
    const x = { e, u: e.party[0], ally: e.party[1], foe: e.mons[0] };
    const ev = arrange(x);
    run(e.flushReactions()).forEach((v) => ev.push(v));
    x.ev = ev;
    if (expect(x)) return true;
  }
  return false;
}
const hitWith = (x, who, kind) => (kind === 'magic'
  ? run(x.e.useAbility(x.e.mons[1], 'en_jb_bolt', DB.abilities.en_jb_bolt, who, null))
  : run(x.e.attack(x.e.mons[1], who, false)));
for (const id of allAbilities) {
  const ra = DB.abilities[id];
  if (ra.kind !== 'reaction') continue;
  const n = ra.name, t = ra.react.type;
  // this reaction itself (a mastered job's trait, e.g. 戦士's 反撃, may react on its own)
  const reacted = (x) => x.ev.some((v) => v.t === 'react' && v.u === x.u && v.a === ra) || x.ev.some((v) => v.t === 'cover' && v.u === x.u);
  switch (ra.trigger) {
    case 'hitPhys': case 'hitAny': case 'hitMagic': {
      const kind = ra.trigger === 'hitMagic' ? 'magic' : 'phys';
      ok(reactTest(id, (x) => hitWith(x, x.u, kind), reacted), `${n}: fires when hit (${ra.trigger})`);
      if (ra.trigger !== 'hitAny') ok(!reactTest(id, (x) => hitWith(x, x.u, kind === 'magic' ? 'phys' : 'magic'), reacted, 25), `${n}: ignores the other damage kind`);
      break;
    }
    case 'lowHp':
      ok(reactTest(id, (x) => { x.u.hp = Math.floor(x.u.mhp * 0.2); x.e.triggerReactions(x.foe, x.u, 'phys'); return []; }, reacted), `${n}: fires at low HP`);
      ok(!reactTest(id, (x) => { x.u.hp = Math.floor(x.u.mhp * 0.6); x.e.triggerReactions(x.foe, x.u, 'phys'); return []; }, reacted, 20), `${n}: quiet while HP is high`);
      break;
    case 'allyLowHp':
      if (t === 'cover') ok(reactTest(id, (x) => { x.ally.hp = 5; return run(x.e.attack(x.e.mons[1], x.ally, false)); }, reacted), `${n}: covers a weak ally`);
      else ok(reactTest(id, (x) => { x.ally.hp = Math.floor(x.ally.mhp * 0.2); x.e.triggerReactions(x.foe, x.ally, 'phys'); return []; }, reacted), `${n}: helps an ally in danger`);
      break;
    case 'ko':
      ok(reactTest(id, (x) => run(x.e.die(x.u, x.foe)), (x) => x.u.hp > 0 && said(x.ev, '立ち上がった'), 3), `${n}: gets back up once`);
      ok(reactTest(id, (x) => { run(x.e.die(x.u, x.foe)); return run(x.e.die(x.u, x.foe)); }, (x) => x.u.hp === 0, 3), `${n}: only once per battle`);
      break;
  }
  if (t === 'autoItem') ok(reactTest(id, (x) => { const who = ra.trigger === 'allyLowHp' ? x.ally : x.u; who.hp = Math.floor(who.mhp * 0.2); x.hp0 = who.hp; x.who = who; x.e.triggerReactions(x.foe, who, 'phys'); return []; }, (x) => (x.e.inv.herb || 0) + (x.e.inv.healing_grass || 0) < 10 && x.who.hp > x.hp0), `${n}: uses a healing item`);
  if (t === 'heal') ok(reactTest(id, (x) => { const who = ra.trigger === 'allyLowHp' ? x.ally : x.u; who.hp = Math.floor(who.mhp * 0.2); x.hp0 = who.hp; x.who = who; x.e.triggerReactions(x.foe, who, 'phys'); return []; }, (x) => x.who.hp >= x.hp0 + Math.floor(x.who.mhp * ra.react.pct) - 1), `${n}: heals ${ra.react.pct * 100}%`);
}

// ================================================================ supports / field mods / innate
sec('supports');
for (const id of allAbilities) {
  const a = DB.abilities[id];
  if (a.kind !== 'support' && a.kind !== 'field') continue;
  // a mage that has NOT mastered mage (its signature 知力アップ would be on in both)
  const c = unmaster(member('metem', 'mage', 20, null, { [a.kind]: id }), id);
  const without = unmaster(member('metem', 'mage', 20), id);
  const m = R.Rules.mods(c);
  ok(Object.keys(a.mods).every((k) => m[k] != null), `${a.name}: mods active when set`);
  const learnedNot = member('metem', 'mage', 20, [], { [a.kind]: id });
  ok(Object.keys(a.mods).every((k) => R.Rules.mods(learnedNot)[k] == null), `${a.name}: inactive unless learned`);
  for (const t of a.mods.equip || []) {
    const item = Object.keys(DB.items).find((i) => DB.items[i].wtype === t || DB.items[i].atype === t);
    const slot = R.Rules.itemSlot(item);
    ok(R.Rules.canEquip(c, item, slot) && !R.Rules.canEquip(without, item, slot), `${a.name}: mage can equip ${t}`);
  }
  for (const k of ['hpPct', 'mpPct', 'strPct', 'intPct', 'mndPct']) if (a.mods[k]) {
    const s = k.replace('Pct', '');
    ok(R.Rules.stats(c)[s] > R.Rules.stats(without)[s], `${a.name}: raises ${s}`);
  }
  if (a.mods.mpCostPct) ok(R.Rules.mpCost(c, 'mage_missile') < R.Rules.mpCost(without, 'mage_missile'), `${a.name}: cheaper spells`);
}
{ // 二刀流: a knight wields two swords and swings twice
  const k = member('yuki', 'knight', 25, null, { support: 'ninja_two_swords' });
  ok(R.Rules.canEquip(k, 'iron_sword', 'shield'), '二刀流: sword in the shield hand');
  k.equip.shield = 'iron_sword';
  const e = engine([k], ['jb_dummy']);
  const ev = run(e.attack(e.party[0], e.mons[0], false));
  ok(ev.filter((v) => v.t === 'fx').length === 2, '二刀流: two swings');
  const nj = member('yuki', 'ninja', 25);
  ok(R.Rules.canEquip(nj, 'wakizashi', 'shield'), 'ninja: dual wields by nature');
}
{ // start buffs, regen, unarmed, rewards
  const t = member('metem', 'mage', 20, null, { support: 'timemage_swift' });
  const e = engine([t], ['jb_dummy']);
  run(e.begin());
  ok(e.party[0].buffs.agi === 1, '俊足: haste at battle start');
  const g = member('yuki', 'warrior', 20, null, { support: 'knight_guard_stance' });
  const e2 = engine([g], ['jb_dummy']); run(e2.begin());
  ok(e2.party[0].buffs.def === 1, '守りの構え: defense up at battle start');
  const p = engine([member('yuki', 'warrior', 20, null, { support: 'paladin_life' })], ['jb_dummy']);
  ok(p.party[0].permRegen, '聖なる命: permanent regen');
  const monk = member('yuki', 'monk', 20); monk.equip.weapon = null;
  const war = member('yuki', 'warrior', 20); war.equip.weapon = null;
  const brawl = member('yuki', 'warrior', 20, null, { support: 'monk_brawler' }); brawl.equip.weapon = null;
  ok(R.Rules.stats(monk).atk > R.Rules.stats(war).atk + 10, '武闘家: strong bare hands');
  ok(R.Rules.stats(brawl).atk >= R.Rules.stats(war).atk + 30, '素手の心得: bare hands for any job');
  const rw = (sup) => {
    const e3 = engine([member('yuki', 'warrior', 20, null, sup)], ['jb_dummy']);
    e3.killed = [e3.mons[0]];
    return e3.computeRewards().each[0];
  };
  ok(rw({ support: 'monk_training' }).exp === Math.round(10 * 1.2), '修行: +20% EXP');
  ok(rw({ support: 'bard_learning' }).jp === Math.round(5 * 1.2), '学びの心: +20% JP');
  const ex = engine([member('yuki', 'thief', 20, null, { support: 'thief_rare_hunter' })], ['jb_thief']);
  ok(ex.rareStealChance(ex.party[0], {}) > 0.2, 'レアハンター: better rare steals');
  const whm = engine([unmaster(member('non', 'whitemage', 20, null, { support: 'whitemage_heal_up' }), 'whitemage_heal_up')], ['jb_dummy']);
  const wh0 = engine([unmaster(member('non', 'whitemage', 20), 'whitemage_heal_up')], ['jb_dummy']);
  ok(whm.expectHeal(whm.party[0], DB.abilities.whitemage_healing, whm.party[0]) > wh0.expectHeal(wh0.party[0], DB.abilities.whitemage_healing, wh0.party[0]) * 1.25, '回復アップ: +30% healing');
  const bm = engine([member('metem', 'blackmage', 20, null, { support: 'blackmage_magic_up' })], ['jb_dummy']);
  const bm0 = engine([member('metem', 'blackmage', 20)], ['jb_dummy']);
  ok(bm.expectDamage(bm.party[0], DB.abilities.blackmage_blast, bm.mons[0]) > bm0.expectDamage(bm0.party[0], DB.abilities.blackmage_blast, bm0.mons[0]) * 1.2, '魔法アップ: +25% spell damage');
  const alc = member('yuki', 'alchemist', 20);
  ok((R.Rules.mods(unmaster(alc)).itemPct || 0) === 25, '薬師: innate item mastery');
  ok((R.Rules.mods(member('yuki', 'alchemist', 20)).itemPct || 0) === 25 + DB.abilities.alchemist_item_lore.mods.itemPct, '薬師 mastered: + its signature 道具の知識');
  const hero = engine([member('yuki', 'hero', 30)], ['jb_dummy']);
  ok(hero.party[0].resist('death') === 1, '勇者: immune to death');
}

// ================================================================ simulated battles (party AI with real kits)
sec('simulate');
const builds = [
  { L: 3, jobs: [['yuki', 'warrior'], ['non', 'priest'], ['metem', 'mage']], mon: { lv: 3, hp: 22, atk: 16, def: 6, mag: 8, mdef: 3, agi: 10 }, n: 3 },
  { L: 12, jobs: [['yuki', 'knight'], ['non', 'whitemage'], ['metem', 'blackmage']], mon: { lv: 12, hp: 110, atk: 58, def: 26, mag: 30, mdef: 12, agi: 28 }, n: 3 },
  { L: 20, jobs: [['yuki', 'monk'], ['non', 'bard'], ['metem', 'alchemist']], mon: { lv: 20, hp: 200, atk: 90, def: 44, mag: 50, mdef: 20, agi: 40 }, n: 3 },
  { L: 26, jobs: [['yuki', 'dragoon'], ['non', 'paladin'], ['metem', 'timemage']], mon: { lv: 26, hp: 300, atk: 120, def: 57, mag: 70, mdef: 26, agi: 50 }, n: 3 },
  { L: 32, jobs: [['yuki', 'ninja'], ['non', 'sage'], ['metem', 'darkknight']], mon: { lv: 32, hp: 420, atk: 160, def: 70, mag: 90, mdef: 32, agi: 60 }, n: 3 },
  { L: 38, jobs: [['yuki', 'hero'], ['non', 'sage'], ['metem', 'spellblade']], mon: { lv: 38, hp: 520, atk: 190, def: 84, mag: 110, mdef: 38, agi: 70 }, n: 3 },
];
for (const b of builds) {
  mon('jb_band', Object.assign({ name: 'まもの', actions: [{ id: 'attack', w: 3 }, { id: 'en_jb_bolt', w: 1 }], exp: 1, gold: 1, jp: 1 }, b.mon));
  const party = b.jobs.map(([cid, job]) => member(cid, job, b.L));
  const usedIds = {};
  let wins = 0, rounds = 0;
  const N = 30;
  for (let i = 0; i < N; i++) {
    let r;
    try { r = B.simulate({ party, mons: [['jb_band', b.n]], seed: 900 + i, log: true, maxRounds: 40 }); }
    catch (err) { ok(false, `Lv${b.L} simulate threw: ${err.message}`); break; }
    if (r.result === 'win') wins++;
    rounds += r.rounds;
    for (const line of r.log) for (const [cid, job] of b.jobs) for (const a of R.Rules.jobAbilities(job)) if (line.includes(DB.abilities[a].name)) usedIds[a] = 1;
  }
  const kinds = Object.keys(usedIds).length;
  console.log(`  Lv${b.L} ${b.jobs.map((j) => j[1]).join('/')}: ${wins}/${N} wins, ${(rounds / N).toFixed(1)} rounds avg, ${kinds} different job abilities used by the AI`);
  ok(wins >= N * 0.8, `Lv${b.L} party beats ${b.n} same-level foes (${wins}/${N})`);
  ok(kinds >= 3, `Lv${b.L}: the auto-battle AI uses several job abilities (${kinds})`);
}

console.log(`\njob tests: ${passes} passed, ${fails} failed  (${used} action abilities exercised)`);
process.exit(fails ? 1 : 0);
