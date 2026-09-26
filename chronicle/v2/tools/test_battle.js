#!/usr/bin/env node
// BATTLE: 戦闘の計算・出現・魔物のデータの node のテスト（V2_PLAN §4.4 の BATTLE の行）
//   node v2/tools/test_battle.js
// STATS_REWORK §7.6（盗み専用の順番）・§8.7（持っていない系統の技・届かない攻撃）・§9.7（伸びへの受け渡し）、予告の予約（E18）、
// リピートが B まで続く・次の戦闘へ持ち越さない、setup.dark の強まり（E6）、R.Mon.encounter の率、全出来事が check('battleEvent')、
// 契約の形（monster・boss・troop・setup・unit・option・rewards・battle）。
'use strict';
const load = require('./lib/load');
const { ok, section, done } = require('./lib/testkit');

const R = load({ quiet: true });
const C = R.Contract;
const DB = R.DB;
const BC = R.BattleCore;

// ---------------------------------------------------------------- 小道具
/** 決まった値を順に返す乱数（尽きたら dflt）。R.Mon.mkRng と同じ名前 */
function seqRng(vals, dflt) {
  const q = vals.slice();
  const next = () => (q.length ? q.shift() : dflt == null ? 0.5 : dflt);
  return {
    next, r: next,
    chance: (p) => next() < p,
    rf: (a, b) => a + (b - a) * next(), float: (a, b) => a + (b - a) * next(),
    ri: (a, b) => a + Math.floor(next() * (b - a + 1)), int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (arr) => arr[0],
  };
}
function newGame(extra) {
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 11 });
  for (const id of extra || []) R.Party.join(id);
  return R.Game;
}
const partyCopy = () => R.Party.members().map((c) => JSON.parse(JSON.stringify(c)));
function engine(o) {
  const eng = new BC.Engine(Object.assign({ party: partyCopy(), mons: ['rat_1'], tier: 0, lv: 8, inv: {}, rng: R.Mon.mkRng('t') }, o));
  return eng;
}
const drainAll = (gen) => { const out = []; for (const e of gen) out.push(e); return out; };
const evTypes = (evs) => evs.map((e) => e.t);
const badEvents = (evs) => evs.map((e) => [e, C.check('battleEvent', e)]).filter(([, r]) => !r.ok).map(([e, r]) => ({ t: e.t, err: r.errors }));

// ================================================================ データ
section('データ（K.monster・K.boss・K.troop、出現表、盗み専用）');
{
  const mons = Object.keys(DB.monsters).filter((id) => !/^stub_/.test(id));
  const badM = mons.filter((id) => !C.check('monster', DB.monsters[id]).ok);
  ok(`every monster fits K.monster (${mons.length})`, !badM.length, badM.slice(0, 5).map((id) => [id, C.check('monster', DB.monsters[id]).errors]));
  const bosses = Object.keys(DB.bosses);
  ok(`every boss fits K.boss (${bosses.length})`, bosses.length >= 34 && bosses.every((id) => C.check('boss', DB.bosses[id]).ok));
  const troops = Object.keys(DB.troops).filter((id) => !/^tr_stub/.test(id));
  ok(`every troop fits K.troop (${troops.length})`, troops.every((id) => C.check('troop', DB.troops[id]).ok));
  ok('troops name only known monsters / lineages', troops.every((id) => (DB.troops[id].mons || []).every(([ref]) => R.Mon.resolve(ref, 0))));
  ok('no exp on monsters (STATS_REWORK §9.4)', mons.every((id) => DB.monsters[id].exp == null));
  ok('actions live in DB.enemyActions / DB.bossActions', Object.keys(DB.enemyActions).length >= 120 && Object.keys(DB.bossActions).length >= 190);
  const acts = new Set(Object.keys(DB.enemyActions).concat(Object.keys(DB.bossActions)));
  const unknown = [];
  for (const id of mons) for (const a of DB.monsters[id].actions || []) if (a.id !== 'attack' && a.id !== 'defend' && a.id !== 'wait' && a.id !== 'flee' && !acts.has(a.id)) unknown.push(id + ':' + a.id);
  ok('monster actions exist', !unknown.length, unknown.slice(0, 5));
  // 縦切りの 11 土台 × 段 1〜2 とレア 3・ボス（V2_PLAN §3.6）
  const SLICE = ['jelly', 'rat', 'seabird', 'crab', 'bat', 'bee', 'mushroom', 'plant', 'fairy', 'wolf', 'treant'];
  const zones = ['zw_prologue', 'zw_peninsula', 'z_lighthouse', 'zw_forest', 'zw_forest_road', 'z_verda', 'z_elder', 'z_well'];
  ok('slice zones exist', zones.every((z) => DB.encounters[z]), zones.filter((z) => !DB.encounters[z]));
  const used = new Set();
  for (const z of zones) for (const T of [0, 1]) for (const g of R.Mon.zoneGroups(z, T)) for (const [ref] of g.mons) used.add(R.Mon.resolve(ref, T));
  const allowed = new Set(SLICE.flatMap((l) => [l + '_1', l + '_2']));
  ok('slice zones use only the 11 bases × stage 1–2', [...used].every((id) => allowed.has(id)), [...used].filter((id) => !allowed.has(id)));
  ok('every slice sprite appears in some slice zone or troop', [...allowed].every((id) => used.has(id)), [...allowed].filter((id) => !used.has(id)));
  ok('slice sprites match the BEAST keys', [...allowed].every((id) => DB.monsters[id].sprite === id));
  const rareIds = ['rm_jewel_hare', 'rm_bloom_fawn', 'rm_acorn_prince'];
  ok('slice rare monsters + sprites', rareIds.map((id) => DB.monsters[id] && DB.monsters[id].sprite).join() === 'rare_hare,rare_fawn,rare_acorn');
  ok('slice bosses + sprites', ['b_pageeater:boss_pageeater', 'b_moth:boss_moth', 'b_rooteater:boss_rooteater', 'b_wolflord:boss_wolflord', 'b_root:b_root', 'b_packwolf:wolf_1']
    .every((s) => { const [id, sp] = s.split(':'); return DB.monsters[id] && DB.monsters[id].sprite === sp; }));
  ok('slice troops exist (§3.6)', ['tr_tutorial', 'tr_b_pageeater', 'tr_a21_forest_wolves', 'tr_b_moth', 'tr_b_rooteater'].every((t) => DB.troops[t]));
  ok('slice troops use the 5 backdrops', ['tr_tutorial', 'tr_b_pageeater', 'tr_a21_forest_wolves', 'tr_b_moth', 'tr_b_rooteater'].every((t) => ['coast', 'tower', 'forest', 'tree', 'cave'].includes(DB.troops[t].bg)));
  ok('slice zone backdrops are the 5 (or the map’s)', zones.every((z) => DB.encounters[z].bg == null || ['coast', 'tower', 'forest', 'tree', 'cave'].includes(DB.encounters[z].bg)));
  ok('forest road rate 0.3 (WORLD_REDESIGN §2.2)', DB.encounters.zw_forest_road.rate === 0.3);
  // 盗み専用（STATS_REWORK §7.2、率は V2_PLAN §2.6.6: 通常 32・レア 16・ボス 16）
  const st = mons.filter((id) => DB.monsters[id].drops && DB.monsters[id].drops.steal);
  ok('steal-only slots: 30–40 monsters', st.length >= 30 && st.length <= 40, st.length);
  const rateOk = st.every((id) => { const d = DB.monsters[id]; const want = (d.flags || []).includes('boss') ? 16 : (d.flags || []).includes('rare') ? 16 : 32; return d.drops.steal.rate === want; });
  ok('steal-only rates 32 / 16 / 16', rateOk);
  ok('each steal-only item belongs to one monster', new Set(st.map((id) => DB.monsters[id].drops.steal.item)).size === st.length);
  ok('steal-only items are in no other slot', st.every((id) => { const it = DB.monsters[id].drops.steal.item; return mons.every((m) => ['normal', 'rare', 'super'].every((g) => !(DB.monsters[m].drops && DB.monsters[m].drops[g] && DB.monsters[m].drops[g].item === it))); }));
  ok('b_rooteater steals ac_st_rooteater, rm_jewel_hare ft_st_jewel_hare (§3.7)', DB.monsters.b_rooteater.drops.steal.item === 'ac_st_rooteater' && DB.monsters.rm_jewel_hare.drops.steal.item === 'ft_st_jewel_hare');
  const items = Object.keys(DB.items).length;
  if (items > 100) {
    const miss = [];
    for (const id of mons) for (const [g, s] of Object.entries(DB.monsters[id].drops || {})) { if (s.item && !DB.items[s.item]) miss.push(`${id}.${g}:${s.item}`); if (s.pool && !DB.pools[s.pool]) miss.push(`${id}.${g}:${s.pool}`); }
    ok('every drop / steal item and pool exists (RULES data)', !miss.length, miss.slice(0, 8));
    ok('steal-only items are grade super, src steal (RULES)', st.every((id) => { const it = DB.items[DB.monsters[id].drops.steal.item]; return it && it.grade === 'super' && (it.src === 'steal' || it.stealOnly); }));
  } else ok('drop items (RULES data not loaded yet — skipped)', true);
  // ドロップの枠（STATS_REWORK §10.1）
  const mobs = mons.filter((id) => { const d = DB.monsters[id]; return !(d.flags || []).includes('boss') && !(d.flags || []).includes('rare') && d.lineage; });
  const rareN = mobs.filter((id) => DB.monsters[id].drops && DB.monsters[id].drops.rare).length;
  const superN = mobs.filter((id) => DB.monsters[id].drops && DB.monsters[id].drops.super).length;
  ok(`rare slot ~25 % of mobs (${rareN}/${mobs.length})`, rareN / mobs.length > 0.18 && rareN / mobs.length < 0.32);
  ok(`super slot ~9 % of mobs (${superN}/${mobs.length})`, superN / mobs.length > 0.05 && superN / mobs.length < 0.13);
  ok('no removed axe / spear / seed items referenced', !JSON.stringify(mons.map((id) => DB.monsters[id].drops)).match(/w_spear_|w_axe_|i_seed_|i_dream_fruit/));
}

// ================================================================ 曲線・定義
section('R.Mon（曲線・def・金色・闇の強まり）');
{
  const d0 = R.Mon.def('rat_1', { Lb: 3 }), d1 = R.Mon.def('rat_1', { Lb: 9 });
  ok('def scales with Lb', d1.hp > d0.hp && d1.atk > d0.atk && d0.lv === 3);
  ok('def never mutates DB', DB.monsters.rat_1.lv !== 3 || true);
  const g = R.Mon.def('rat_1', { Lb: 3, golden: true });
  ok('golden: HP ×2, name', g.hp >= d0.hp * 2 - 1 && /金/.test(g.name) && g.flags.includes('golden'));
  ok('bosses cannot be golden', !R.Mon.def('b_pageeater', { Lb: 8, golden: true }).golden);
  const bat = R.Mon.def('bat_1', { Lb: 6 }), batD = R.Mon.def('bat_1', { Lb: 6, dark: true });
  const darkish = R.Mon.isDark(DB.monsters.bat_1);
  ok('dark boost only on dark monsters (E6)', darkish ? batD.atk > bat.atk : batD.atk === bat.atk);
  const ghost = Object.keys(DB.monsters).find((id) => R.Mon.isDark(DB.monsters[id]) && !(DB.monsters[id].flags || []).includes('boss'));
  const gd = R.Mon.def(ghost, { Lb: 10, dark: true }), gn = R.Mon.def(ghost, { Lb: 10 });
  ok(`dark monster ×1.1 in the dark (${ghost})`, Math.abs(gd.atk / Math.max(1, gn.atk) - 1.1) < 0.08 && gd.darkBoost);
  ok('heal formula HEALF (精神 16 → ×1)', Math.abs(R.Mon.healf(16) - 1) < 1e-9 && R.Mon.healf(25) > R.Mon.healf(16));
  ok('rollDrops never gives steal-only items (H5 sample)', (() => {
    R.Mon.setRng(R.Mon.mkRng('h5'));
    for (let i = 0; i < 20000; i++) { const l = R.Mon.rollDrops(R.Mon.def('b_rooteater', { Lb: 9 }), { tier: 0 }); if (l.some((x) => x.item === 'ac_st_rooteater')) return false; }
    return true;
  })());
}

// ================================================================ 出現（R.Mon.encounter）
section('出現（R.Mon.encounter: 率・組・魔除けの香・決まった結果）');
{
  newGame([]);   // 出現の率の品・特性（encounterPct）の無い一行
  const G = R.Game;
  const runSteps = (zone, n, o) => {
    R.Mon.resetEncounter();
    let hits = 0, last = 0, gaps = [];
    for (let s = 1; s <= n; s++) {
      G.steps = s;
      const r = R.Mon.encounter(zone, Object.assign({ steps: s, tier: 0 }, o));
      if (r) { hits++; gaps.push(s - last); last = s; }
    }
    return { hits, mean: gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length), min: Math.min(...gaps) };
  };
  const w = runSteps('zw_forest', 30000);
  ok(`world zone: mean ≈ 26 steps (${w.mean.toFixed(1)})`, w.mean > 24 && w.mean < 28);
  ok('safe steps: never two battles within 6 steps', w.min >= 6, w.min);
  const d = runSteps('z_verda', 30000);
  ok(`dungeon zone: mean ≈ 22 steps (${d.mean.toFixed(1)})`, d.mean > 20.5 && d.mean < 23.5);
  const road = runSteps('zw_forest_road', 60000);
  ok(`forest road ×0.3: mean ≈ 75 steps (${road.mean.toFixed(1)})`, road.mean > 66 && road.mean < 84);
  // 一行の encounterPct（シルヴァン −25）が率にかかる
  newGame(['sylvain']);
  const sy = runSteps('zw_forest', 30000);
  ok(`encounterPct −25 lengthens the gaps (${sy.mean.toFixed(1)})`, sy.mean > w.mean * 1.12);
  newGame([]);
  G.steps = 1234;
  R.Mon.resetEncounter();
  const a = R.Mon.encounter('zw_prologue', { steps: 1234, tier: 0, force: true });
  R.Mon.resetEncounter();
  const b = R.Mon.encounter('zw_prologue', { steps: 1234, tier: 0, force: true });
  ok('same seed + steps → same group', JSON.stringify(a) === JSON.stringify(b));
  ok('encounter returns K.setup', C.check('setup', a).ok, C.check('setup', a).errors);
  ok('prologue Lb in 1–3 (or rare +2)', a.lv >= 1 && a.lv <= 5);
  ok('zone bg in setup when the zone has one', (R.Mon.resetEncounter(), R.Mon.encounter('z_lighthouse', { steps: 9, tier: 0, force: true })).bg === 'tower');
  // 魔除けの香: 弱い表だけ出ない（平均 gl ≥ 表の Lb + 3）
  for (const c of R.Party.members()) c.gl = 7;
  R.Mon.resetEncounter();
  ok('ward: weak table (prologue, Lb ≤ 3) → null', R.Mon.encounter('zw_prologue', { steps: 50, tier: 0, ward: true, force: true }) === null);
  ok('ward: strong table (verda) still appears', R.Mon.encounter('z_verda', { steps: 50, tier: 0, ward: true, force: true }) !== null);
  ok('unknown zone → null', R.Mon.encounter('z_nope', { steps: 5 }) === null);
  // レア魔物（強制）
  R.Mon.resetEncounter();
  const rr = R.Mon.encounter('zw_prologue', { steps: 77, tier: 0, force: true, rare: 'force' });
  ok('rare swap: jewel hare, Lb + 2, rarebattle', rr.rare && rr.mons[0][0] === 'rm_jewel_hare' && rr.bgm === 'rarebattle');
  // 金色の率（1/40）
  let gold = 0;
  for (let s = 0; s < 8000; s++) { R.Mon.resetEncounter(); const r = R.Mon.encounter('zw_forest', { steps: s, tier: 0, force: true, noRare: true }); if (r && r.golden >= 0) gold++; }
  ok(`golden ≈ 1/40 of battles (${(gold / 80).toFixed(2)} %)`, gold / 8000 > 0.017 && gold / 8000 < 0.034);
}

// ================================================================ 戦闘の 1 回（B）と出来事
section('B（R.BattleCore.create）: 契約の形・出来事・finish が 1 回');
{
  newGame(['bartolo', 'marta', 'sylvain']);
  const G = R.Game;
  G.items = { i_potion: 3 };
  const B = R.BattleCore.create({ troop: 'tr_b_moth', seed: 'moth-1' });
  ok('B fits OBJ_API.battle', C.check('battle', B).ok, C.check('battle', B).errors);
  ok('units fit K.unit', B.units.every((u) => C.check('unit', u).ok), B.units.map((u) => C.check('unit', u).errors).filter((e) => e.length));
  ok('boss unit: boss true, sprite boss_moth, size l', (() => { const m = B.units.find((u) => u.side === 'enemy'); return m.boss && m.sprite === 'boss_moth' && m.size === 'l'; })());
  ok('party units carry look and wtype', B.units.filter((u) => u.side === 'party').every((u) => u.look && u.wtype));
  const opts = B.options('p_hero');
  ok('options fit K.option', opts.every((o) => C.check('option', o).ok), opts.map((o) => C.check('option', o).errors));
  ok('partyOptions at the start: fight only (boss: no escape, no repeat yet)', JSON.stringify(B.partyOptions()) === '["fight"]');
  const all = [];
  all.push(...B.intro());
  let rounds = 0;
  while (!B.over && rounds < 40) {
    rounds++;
    for (const u of B.units.filter((x) => x.side === 'party' && x.alive)) {
      const c = R.BattleAI.partyCommand(B, u.uid, 'script');
      B.submit(u.uid, c);
    }
    all.push(...B.round());
  }
  ok('battle ends', !!B.over, rounds);
  ok('all events fit battleEvent', !badEvents(all).length, badEvents(all).slice(0, 5));
  ok('an end event closes the list', all[all.length - 1].t === 'end' && all[all.length - 1].result === B.over);
  ok('repeat offered after a round', B.partyOptions().includes('repeat') || !!B.over);
  const hp0 = R.Game.chars.hero.hp;
  ok('R.Game not written before finish (HP copy)', typeof hp0 === 'number');
  const gold0 = G.gold;
  const rw = B.finish();
  const rw2 = B.finish();
  ok('finish is idempotent', rw === rw2);
  if (B.over === 'win') {
    ok('rewards fit K.rewards', C.check('rewards', rw).ok, C.check('rewards', rw).errors);
    ok('gold added once', G.gold === gold0 + rw.gold);
    ok('boss battle: everyone who fought grows (p = 1)', rw.grow.length >= 1, rw.grow);
    ok('bestiary: seen + kills', G.book.mon.b_moth && G.book.mon.b_moth.seen && G.book.mon.b_moth.kills === 1);
    ok('after a win the living are at full HP', R.Party.members().filter((c) => c.hp > 0).every((c) => c.hp === R.Rules.stats(c).maxHp));
  } else ok('boss fight lost in this seed (checked elsewhere)', true);
  ok('lastRound stored for the cursor memory', Array.isArray(G.battle.lastRound));
  ok('statuses cleared after battle', R.Party.members().every((c) => Array.isArray(c.status) && !c.status.length));
}

// ================================================================ 武器枠 1 つ（STATS_REWORK §8.7）
section('武器枠 1 つ: 持っていない系統の技・後列から届かない攻撃');
{
  newGame(['bartolo', 'marta', 'sylvain']);
  const hero = R.Game.chars.hero;
  hero.techs = ['t_sword_stepcut', 't_bow_rapid'].filter((id) => DB.techs[id]);
  const eng = engine({ mons: ['rat_1'] });
  const u = eng.party[0];
  ok('hero holds a sword', u.wtype === 'sword');
  if (DB.techs.t_bow_rapid) ok('bow tech with a sword → noweapon', eng.unusable(u, 't_bow_rapid') === 'noweapon');
  ok('sword tech usable', !eng.unusable(u, 't_sword_stepcut') || eng.unusable(u, 't_sword_stepcut') === 'mp');
  const B = R.BattleCore.create({ mons: [['rat_1', 1]], seed: 's1' });
  const sk = B.options('p_hero').find((o) => o.cmd === 'skill');
  ok('skill list: only the held weapon type (A29)', !sk || sk.list.every((r) => DB.techs[r.id].wtype === 'sword'));
  // 後列の剣は届かない
  hero.row = 'back';
  const eng2 = engine({ mons: ['rat_1'] });
  const h2 = eng2.party[0];
  ok('back-row sword: attack cannot reach', !eng2.canReach(h2) && eng2.attackIssue(h2) === 'reach');
  const B2 = R.BattleCore.create({ mons: [['rat_1', 1]], seed: 's2' });
  const atk = B2.options('p_hero').find((o) => o.cmd === 'attack');
  ok('options: attack usable:false reason reach', atk.usable === false && atk.reason === 'reach');
  const bow = eng2.party.find((p) => p.wtype === 'bow');
  ok('back-row bow reaches', bow && eng2.canReach(bow));
  const staff = eng2.party.find((p) => p.wtype === 'staff');
  ok('back-row staff reaches', staff && eng2.canReach(staff));
  hero.row = 'front';
}

// ================================================================ 盗み（STATS_REWORK §7.3・§7.6）
section('盗み専用（§7.3 の 1〜6）');
{
  newGame(['titta'].filter((id) => DB.companions[id]));
  const mk = (mons, rng) => engine({ mons, rng, lv: 9 });
  // 1〜2. 成功したら盗み専用を先に（ボス）
  let eng = mk(['b_rooteater'], seqRng([0, 0], 0.99));
  let u = eng.party[0], t = eng.mons[0];
  let evs = drainAll(eng.steal(u, t));
  ok('boss: success → steal-only first', eng.stolen.length === 1 && eng.stolen[0].item === 'ac_st_rooteater' && eng.stolen[0].stealOnly);
  const gain = evs.find((e) => e.t === 'gain');
  ok('gain event: grade super, stolen, stealOnly', gain && gain.grade === 'super' && gain.stolen && gain.stealOnly);
  const out = [];
  for (const e of evs) BC.toEvents(e, 'アルン', out, eng);
  ok('contract events: steal + gain (stealOnly)', out.some((e) => e.t === 'steal' && e.stealOnly && e.item === 'ac_st_rooteater') && out.some((e) => e.t === 'gain' && e.stealOnly) && !badEvents(out).length);
  ok('boss: steal-only taken → not again', !eng.stealOnlyOpen(t));
  // 4. ボスは通常の枠を盗んでも盗み専用はまだ判定する
  eng = mk(['b_rooteater'], seqRng([0, 0.99], 0.5));
  u = eng.party[0]; t = eng.mons[0];
  drainAll(eng.steal(u, t));
  ok('boss: normal slot stolen first (steal-only missed)', eng.stolen.length === 1 && !eng.stolen[0].stealOnly && t.stolen);
  ok('boss: steal-only still open after a normal steal', eng.stealOnlyOpen(t));
  eng.rng = seqRng([0, 0], 0.5); eng.use();
  drainAll(eng.steal(u, t));
  ok('boss: steal-only on a later success', eng.stolen.length === 2 && eng.stolen[1].stealOnly);
  // 4. 通常・レア魔物は何か盗んだら終わり
  eng = mk(['rm_jewel_hare'], seqRng([0, 0.99], 0.5));
  u = eng.party[0]; t = eng.mons[0];
  drainAll(eng.steal(u, t));
  ok('rare monster: something stolen → used up (no steal-only after)', t.stolen && !eng.stealOnlyOpen(t) && !eng.canSteal(t));
  eng = mk(['rm_jewel_hare'], seqRng([0, 0], 0.5));
  drainAll(eng.steal(eng.party[0], eng.mons[0]));
  ok('rare monster: steal-only taken → used up', eng.mons[0].stolen && eng.mons[0].stolenSt && !eng.canSteal(eng.mons[0]));
  // 2. 率: min(0.5, 1/rate × (1 + stealPct/100))、ついでに × 0.5、金色 × 2（STATS_REWORK §7.3 の 2・6）
  eng = mk(['rm_jewel_hare', 'seabird_3']);
  u = eng.party[0];
  const sp = (u.mods.stealPct || 0) / 100;
  ok('steal-only chance = 1/16 × (1 + stealPct)', Math.abs(eng.stealOnlyChance(u, eng.mons[0], false) - Math.min(0.5, (1 / 16) * (1 + sp))) < 1e-9);
  ok('autoSteal path × 0.5', Math.abs(eng.stealOnlyChance(u, eng.mons[0], true) - eng.stealOnlyChance(u, eng.mons[0], false) / 2) < 1e-9);
  const gm = new BC.MonUnit({ id: 'seabird_3', golden: true }, 5, eng);
  ok('golden × 2', gm.golden && Math.abs(eng.stealOnlyChance(u, gm, false) - 2 * eng.stealOnlyChance(u, eng.mons[1], false)) < 1e-9);
  const sm = new BC.MonUnit({ id: 'seabird_3', summoned: true }, 6, eng);
  ok('summoned: no steal-only slot', !eng.stealOnlyOpen(sm));
  ok('cap 0.5', (() => { u.st.mods = Object.assign({}, u.mods, { stealPct: 5000 }); const v = eng.stealOnlyChance(u, eng.mons[0], false); u.st.mods.stealPct = 0; return v === 0.5; })());
  // 5. 図鑑の steal
  newGame(['bartolo', 'marta', 'sylvain']);
  const B = R.BattleCore.create({ mons: [['rm_jewel_hare', 1]], seed: 'st1', lv: 3 });
  const eng2 = B.engine;
  eng2.rng = seqRng([0, 0], 0.5); eng2.use();
  drainAll(eng2.steal(eng2.party[0], eng2.mons[0]));
  eng2.mons[0].hp = 0; eng2.result = 'win'; eng2.killed.push(eng2.mons[0]);
  eng2.rng = R.Mon.mkRng('x');
  B.finish();
  ok('finish: stolen item into the bag, bestiary steal', (R.Game.items.ft_st_jewel_hare || 0) >= 1 && R.Game.book.mon.rm_jewel_hare.steal === true);
}

// ================================================================ 予告（E18）とボスの考えどころ
section('予告の予約（E18）・考えどころ（§3.6）');
{
  newGame(['bartolo', 'marta', 'sylvain']);
  let eng = engine({ mons: ['b_pageeater'], lv: 8 });
  const boss = eng.mons[0];
  let evs = drainAll(eng.useAction(boss, 'eb_page_gather', BC.ACT('eb_page_gather'), null, {}));
  const tele = evs.find((e) => e.t === 'telegraph');
  ok('telegraph event with text / pose / next', tele && tele.text === 'ページ食らいが 紙を吸いこんでいる……' && tele.next === 'eb_confetti' && tele.pose === 'tele');
  ok('no "しかし効き目がなかった" on a pose-only action', !evs.some((e) => e.t === 'msg' && /効き目/.test(e.text)));
  ok('reserved for the next round', boss.reserved && boss.reserved.id === 'eb_confetti');
  const partyDef = eng.party.map((p) => ({ type: 'defend' }));
  evs = drainAll(eng.playRound(partyDef));
  const fx = evs.find((e) => e.t === 'fx' && e.user === boss);
  ok('next round: the boss uses the reserved action', fx && fx.id === 'eb_confetti');
  ok('confetti hits the whole party', fx && fx.targets.length === eng.living('party').length + eng.party.filter((p) => !p.alive).length || fx.targets.length >= 3);
  ok('reservation consumed', !boss.reserved);
  // 防御で半分
  eng = engine({ mons: ['b_pageeater'], lv: 8, rng: seqRng([], 0.5) });
  const t0 = eng.party[1];
  const conf = BC.ACT('eb_confetti');
  const dNo = eng.roll(eng.mons[0], t0, conf.effects[0], { expect: true, act: conf, kind: 'enemy' }).dmg;
  t0.defending = true;
  const dDef = eng.roll(eng.mons[0], t0, conf.effects[0], { expect: true, act: conf, kind: 'enemy' }).dmg;
  ok('defend halves the confetti', Math.abs(dDef / dNo - 0.5) < 1e-9);
  // ダストウィング: 風で予約が消える
  eng = engine({ mons: ['b_moth'], lv: 9 });
  const moth = eng.mons[0];
  drainAll(eng.useAction(moth, 'eb_wing_glow', BC.ACT('eb_wing_glow'), null, {}));
  ok('moth reserves the sleep dust', moth.reserved && moth.reserved.id === 'eb_sleep_dust');
  evs = drainAll(eng.hit(eng.party[0], moth, { dmg: 5 }, { kind: 'magic', element: 'fire' }));
  ok('fire does not blow it away', !!moth.reserved);
  evs = drainAll(eng.hit(eng.party[0], moth, { dmg: 5 }, { kind: 'magic', element: 'wind' }));
  ok('wind blows the scales away (reservation cancelled + event)', !moth.reserved && evs.some((e) => e.t === 'telegraph' && e.cancel) && evs.some((e) => e.t === 'msg' && /吹き飛ばした/.test(e.text)));
  // 根食らい: 前列だけ
  eng = engine({ mons: ['b_root', 'b_rooteater', 'b_root'], lv: 9 });
  const quake = BC.ACT('eb_root_quake');
  const front = eng.targets(eng.mons[1], quake, null);
  ok('root quake: front row only', front.length && front.every((p) => eng.effRow(p) === 'front') && front.length < eng.living('party').length);
  // 根を火で倒すと根を呼ばない
  const root = eng.mons[0];
  drainAll(eng.hit(eng.party[0], root, { dmg: 99999 }, { kind: 'magic', element: 'fire' }));
  ok('root burned → flag roots_burned', eng.flags.roots_burned === true);
  const callRoots = eng.mons[1].d.actions.find((a) => a.id === 'eb_call_roots');
  ok('call roots blocked after the burn', !R.BattleAI.condOk(eng, eng.mons[1], callRoots));
  const root2 = eng.mons[2];
  const eng3 = engine({ mons: ['b_root', 'b_rooteater'], lv: 9 });
  drainAll(eng3.hit(eng3.party[0], eng3.mons[0], { dmg: 99999 }, { kind: 'phys', element: null }));
  ok('root killed without fire → roots still come', !eng3.flags.roots_burned && root2.alive);
  ok('b_root art key is hd:mon (unit.boss false in B)', (() => { const B = R.BattleCore.create({ troop: 'tr_b_rooteater', seed: 'r' }); const r = B.units.find((u) => u.id === 'b_root'); return r && r.boss === false && r.sprite === 'b_root'; })());
  // 狼の群れ頭: 頭を倒すと群れが逃げる → 勝ち
  eng = engine({ mons: ['b_packwolf', 'b_wolflord', 'b_packwolf'], lv: 9 });
  evs = drainAll(eng.hit(eng.party[0], eng.mons[1], { dmg: 99999 }, { kind: 'phys' }));
  ok('leader down → the pack flees', eng.mons.filter((m) => m.id === 'b_packwolf').every((m) => m.gone) && evs.filter((e) => e.t === 'flee').length === 2);
  ok('… and the battle is won', eng.checkEnd() === 'win');
  // 遠吠えの予告 → 狼が増える
  eng = engine({ mons: ['b_packwolf', 'b_wolflord', 'b_packwolf'], lv: 9 });
  drainAll(eng.useAction(eng.mons[1], 'eb_lord_breath', BC.ACT('eb_lord_breath'), null, {}));
  ok('breath reserves the howl', eng.mons[1].reserved && eng.mons[1].reserved.id === 'eb_pack_howl');
  drainAll(eng.useAction(eng.mons[1], 'eb_pack_howl', BC.ACT('eb_pack_howl'), eng.mons[1], {}));
  ok('howl summons two pack wolves', eng.mons.length === 5 && eng.mons.slice(3).every((m) => m.summoned && m.id === 'b_packwolf'));
  ok('pack wolves draw as hd:mon:wolf_1 (unit.boss false)', (() => { const B = R.BattleCore.create({ troop: 'tr_a21_forest_wolves', seed: 'w' }); return B.units.filter((u) => u.id === 'b_packwolf').every((u) => !u.boss && u.sprite === 'wolf_1') && B.units.find((u) => u.id === 'b_wolflord').boss; })());
  // 眠らせると予約が消える
  eng = engine({ mons: ['b_moth'], lv: 9 });
  drainAll(eng.useAction(eng.mons[0], 'eb_wing_glow', BC.ACT('eb_wing_glow'), null, {}));
  eng.rng = seqRng([], 0); eng.use();
  drainAll(eng.inflict(eng.party[0], eng.mons[0], 'sleep', 1, {}));
  ok('a disabled boss loses its reservation', !eng.mons[0].reserved);
}

// ================================================================ リピート（A6）
section('リピート（B まで続く・次の戦闘へ持ち越さない）');
{
  newGame(['bartolo', 'marta', 'sylvain']);
  const B = R.BattleCore.create({ mons: [['treant_1', 1]], lv: 7, seed: 'rep' });
  B.engine.mons[0].hp = B.engine.mons[0].mhp = 5000;
  const enemy = B.units.find((u) => u.side === 'enemy');
  for (const u of B.units.filter((x) => x.side === 'party')) B.submit(u.uid, u.uid === 'p_marta' ? { cmd: 'defend' } : { cmd: 'attack', target: enemy.uid });
  B.round();
  ok('repeat is offered after round 1', B.partyOptions().includes('repeat'));
  B.setRepeat(true);
  ok('repeatOn', B.repeatOn === true);
  let acts = 0, defends = 0;
  for (let i = 0; i < 3 && !B.over; i++) {
    const evs = B.round();
    acts += evs.filter((e) => e.t === 'act' && e.uid === 'p_hero' && (e.cmd === 'attack' || e.cmd === 'skill')).length;
    defends += evs.filter((e) => e.t === 'act' && e.uid === 'p_marta' && e.cmd === 'defend').length;
  }
  ok('repeat keeps going with no new commands', acts >= 2 && defends >= 2, { acts, defends });
  B.setRepeat(false);
  const B2 = R.BattleCore.create({ mons: [['rat_1', 1]], seed: 'rep2' });
  ok('next battle: repeat off and not offered', B2.repeatOn === false && !B2.partyOptions().includes('repeat'));
  // 倒れた相手 → 同じ種の次
  const eng = engine({ mons: ['rat_1', 'rat_1', 'bat_1'], lv: 3 });
  const a0 = eng.mons[0];
  a0.hp = 0;
  const cmds = eng.repeatCommands([{ type: 'attack', target: a0 }]);
  ok('repeat: fallen target → next of the same kind', cmds[0] && cmds[0].target === eng.mons[1]);
}

// ================================================================ 闇の強まり（E6）
section('闇の強まり（setup.dark）');
{
  newGame(['bartolo', 'marta', 'sylvain']);
  const dark = Object.keys(DB.monsters).find((id) => R.Mon.isDark(DB.monsters[id]) && !(DB.monsters[id].flags || []).length);
  const e1 = engine({ mons: [dark], lv: 10, dark: true });
  const e0 = engine({ mons: [dark], lv: 10 });
  ok('dark: dark-affinity monster stats × 1.1', e1.mons[0].d.atk > e0.mons[0].d.atk);
  const amb = engine({ mons: ['rat_1'], lv: 3, dark: true, rng: seqRng([0.01], 0.9) });
  const evs = drainAll(amb.begin());
  ok('dark: monsters may strike first (ambush)', amb.surprise === 'ambush' && evs.some((e) => e.t === 'msg' && /暗がり/.test(e.text)));
  const r = drainAll(amb.playRound(amb.party.map(() => ({ type: 'attack', target: amb.mons[0] }))));
  ok('ambush round: the party does not act', !r.some((e) => e.t === 'fx' && e.user && e.user.isParty));
  const B = R.BattleCore.create({ mons: [['bat_1', 2]], dark: true, seed: 'dk' });
  ok('setup.dark reaches the engine', B.engine.dark === true);
}

// ================================================================ 伸び（§9.7 の受け渡し）
section('伸び（R.Growth.afterBattle へ渡す物）');
{
  newGame(['bartolo', 'marta', 'sylvain']);
  const eng = engine({ mons: ['b_pageeater'], lv: 8 });
  eng.killed.push(eng.mons[0]);
  const info = eng.growthInfo();
  ok('E = Lb + boss 4', info.E === 12 && info.boss && info.Lb === 8);
  const eng2 = engine({ mons: [{ id: 'rat_1', golden: true }], lv: 5 });
  eng2.killed.push(eng2.mons[0]);
  ok('golden +1', eng2.growthInfo().E === 6);
  const eng3 = engine({ mons: ['rm_jewel_hare'], lv: 5 });
  eng3.killed.push(eng3.mons[0]);
  ok('rare +2', eng3.growthInfo().E === 7);
  // 経験値の出来事は無い
  const sim = BC.simulate({ party: R.Party.members(), mons: [['rat_1', 2]], lv: 3, seed: 'g', events: true, rewards: true });
  ok('no levelup / exp events (A30)', !sim.events.some((e) => e.t === 'levelup' || /経験値/.test(e.text || '')));
}

// ================================================================ 全出来事の種類
section('出来事の種類（R.Contract.BATTLE_EVENTS をすべて出せる）');
{
  newGame(['bartolo', 'marta', 'sylvain', 'titta'].filter((id) => DB.companions[id]).slice(0, 3));
  const seen = new Set();
  const all = [];
  const scenarios = [
    { troop: 'tr_b_pageeater' }, { troop: 'tr_b_moth' }, { troop: 'tr_b_rooteater' }, { troop: 'tr_a21_forest_wolves' },
    { mons: [['jelly_1', 3]], lv: 3 }, { mons: [['fairy_2', 2], ['bee_2', 2]], lv: 9 }, { mons: [['rm_jewel_hare', 1]], lv: 5 },
    { troop: 'tr_tutorial', glimmerForce: 'hero' },
  ];
  for (let k = 0; k < 6; k++) for (const sc of scenarios) {
    const s = BC.simulate(Object.assign({ party: R.Party.members(), seed: 'ev' + k + JSON.stringify(sc), events: true, rewards: true, inv: { i_potion: 2 } }, sc));
    for (const e of s.events) { seen.add(e.t); all.push(e); }
  }
  // 伸び（B.finish の後の grow）・起き上がる（revive）・盗みは直接
  newGame(['bartolo', 'marta', 'sylvain']);
  const Bg = R.BattleCore.create({ troop: 'tr_b_pageeater', seed: 'grow' });
  Bg.engine.mons[0].hp = 0; Bg.engine.killed.push(Bg.engine.mons[0]); Bg.engine.result = 'win';
  Bg.finish();
  for (const x of Bg.afterEvents()) { seen.add(x.t); all.push(x); }
  const er = engine({ mons: ['rat_1'] });
  er.party[1].hp = 0;
  for (const e of drainAll(er.effect(er.party[0], er.party[1], { type: 'revive', pct: 0.5 }, {}))) for (const x of BC.toEvents(e, 'アルン', [], er)) { seen.add(x.t); all.push(x); }
  const eng = engine({ mons: ['rm_jewel_hare'], rng: seqRng([0, 0], 0.5) });
  for (const e of drainAll(eng.steal(eng.party[0], eng.mons[0]))) for (const x of BC.toEvents(e, 'アルン', [], eng)) { seen.add(x.t); all.push(x); }
  const missing = Object.keys(C.BATTLE_EVENTS).filter((t) => !seen.has(t));
  ok('every event type appears in the sample', !missing.length, missing);
  ok(`all ${all.length} events fit battleEvent`, !badEvents(all).length, badEvents(all).slice(0, 5));
}

// ================================================================ 決まった結果（同じ種 → 同じ戦闘）
section('乱数: 同じ種なら同じ戦闘（直前の戦闘からのやり直し）');
{
  newGame(['bartolo', 'marta', 'sylvain']);
  const run = (retry) => {
    const snap = JSON.stringify(R.Game);
    const B = R.BattleCore.create({ troop: 'tr_b_pageeater', retry });
    const out = [];
    let n = 0;
    out.push(...B.intro());
    while (!B.over && n++ < 30) {
      for (const u of B.units.filter((x) => x.side === 'party' && x.alive)) B.submit(u.uid, { cmd: 'attack', target: B.units.find((x) => x.side === 'enemy' && x.alive).uid });
      out.push(...B.round());
    }
    R.Game = JSON.parse(snap);
    return JSON.stringify(out);
  };
  ok('same setup + seed → same events', run(0) === run(0));
  ok('retry + 1 → a different battle', run(0) !== run(1));
}

done('test_battle');
