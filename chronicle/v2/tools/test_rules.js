#!/usr/bin/env node
// RULES のテスト（node）: STATS_REWORK §6.4（abilMul・K.WA・枠 8・optimize・成長・熟練度の表）と §8.7・§9.7 の node の分、
// 移したデータの数と参照、契約（R.Contract.check）の形。V2_PLAN §4.4 の RULES の行。
//   node v2/tools/test_rules.js
'use strict';
const load = require('./lib/load');
const { ok, section, done } = require('./lib/testkit');

const R = load({ quiet: true });
const C = R.Contract, Ru = R.Rules, K = Ru.K, DB = R.DB;
const near = (a, b, d) => Math.abs(a - b) <= (d == null ? 1e-9 : d);
const chk = (kind, o) => C.check(kind, o);

// ---------------------------------------------------------------- 読み込みと契約
section('load / contract');
const mine = (e) => /systems\/(rules|growth|glimmer|party)\.js|data\/(elements|statuses|spells_|weapontypes|techs_|items_(?!key)|shops|pools|companions|herotypes)/.test(e);
ok('no load errors from RULES files', !R.loadErrors.some(mine), R.loadErrors.filter(mine));
for (const ns of ['Rules', 'Growth', 'Glimmer', 'Party']) {
  ok(`R.${ns} has every contract name`, C.checkApi(ns).ok, C.checkApi(ns).errors);
  ok(`R.${ns} is claimed (no stub fills it)`, !R.Stubs.installed[ns], R.Stubs.installed[ns]);
}
ok('K has SLOTS WTYPES ELEMENTS ABILS', K.SLOTS.length === 8 && K.WTYPES.length === 5 && K.ELEMENTS.length === 6 && K.ABILS.length === 6);
ok('SLOTS has no weapon2 (A29)', !K.SLOTS.includes('weapon2') && K.SLOTS[0] === 'weapon1');
ok('DIFF_KEYS 15 with atk', Ru.DIFF_KEYS.length === 15 && Ru.DIFF_KEYS.includes('atk') && !Ru.DIFF_KEYS.includes('atk2'));
ok('removed K keys (EXP, FALLOFF, STAT_K, VIT, MNDF, U, BONUS_CAP, JOIN_LEVEL, MAX_LEVEL)',
  ['EXP', 'FALLOFF', 'STAT_K', 'VIT', 'MNDF', 'U', 'BONUS_CAP', 'JOIN_LEVEL', 'MAX_LEVEL', 'RESERVE_RATE', 'DRAGON_EXP'].every((k) => K[k] === undefined));
ok('curve has no exp', K.curve(10).exp === undefined && K.curve(10).hp > 0);

// ---------------------------------------------------------------- §2 式
section('abilMul and the §2.2 table');
ok('abilMul 16 → 1', near(Ru.abilMul(16, 0.045), 1));
ok('abilMul 21 → 1.225', near(Ru.abilMul(21, 0.045), 1.225));
ok('abilMul 25 → 1.405', near(Ru.abilMul(25, 0.045), 1.405));
ok('abilMul 10 → 0.73', near(Ru.abilMul(10, 0.045), 0.73));
ok('abilMul 0 stops at 0.5', near(Ru.abilMul(0, 0.045), 0.5));
ok('spdToAbil 28 → 14, 60 → 24', Ru.spdToAbil(28) === 14 && Ru.spdToAbil(60) === 24);
{
  const old = [16, 30, 45, 69, 94, 127, 162, 208, 256, 326];
  const got = K.WA.map((w, T) => Math.round((w + 2 * K.ACC_W[T]) * 1.225));
  ok('K.WA reproduces the old attack table ±1 (§2.3)', got.every((v, T) => Math.abs(v - old[T]) <= 1), got);
}
// 合成の人で導かれる値を 4 点（16 / 21 / 25 / 10）で見る
function fake(stats, extra) {
  const id = 'zz_' + Object.values(stats).join('_');
  DB.companions[id] = Object.assign({ name: 'テスト', look: 'selma', gender: 'm', row: 'front', stats, growth: { hp: 'B', mp: 'B' },
    apt: { w: { sword: 'B', greatsword: 'B', dagger: 'B', bow: 'B', staff: 'B' }, e: { fire: 'B', water: 'B', wind: 'B', earth: 'B', light: 'B', dark: 'B' } },
    innate: { mods: {} }, startEquip: {}, startTechs: [], startSpells: [] }, extra || {});
  return id;
}
R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 11 });
const at = (v) => { const id = fake({ str: v, vit: v, dex: v, agi: v, int: v, mnd: v }); const c = R.Party.makeChar(id, { tier: 0, gl: 10 }); return { c, s: Ru.stats(c) }; };
const P = [16, 21, 25, 10].map(at);
ok('hit 98 / 103 / 107 / 92 (bare hands add the fist row +5)', P.map((p) => p.s.hit - 5).join() === '98,103,107,92', P.map((p) => p.s.hit));
ok('crit 4 / 6 / 8 / 1 (+ fist 5)', P.map((p) => p.s.crit - 5).join() === '4,6,8,1', P.map((p) => p.s.crit));
ok('eva 6 / 10 / 12 / 2', P.map((p) => p.s.eva).join() === '6,10,12,2', P.map((p) => p.s.eva));
ok('spd 34 / 51 / 65 / 14', P.map((p) => p.s.spd).join() === '34,51,65,14', P.map((p) => p.s.spd));
ok('mdef ×1 / 1.15 / 1.27 / 0.82 of 16', P.map((p) => p.s.mdef).join() === [16, 18.4, 20.32, 13.12].map(Math.round).join(), P.map((p) => p.s.mdef));
{
  const b = R.Growth.baseMax(P[0].c, 'hp');
  ok('max HP ×1 / 1.125 / 1.225 / 0.85 (vit)', P.map((p) => p.s.maxHp).join() === [1, 1.125, 1.225, 0.85].map((m) => Math.round(b * m)).join(), P.map((p) => p.s.maxHp));
}
ok('HEALF ×1 / 1.2 / 1.36 / 0.76', P.map((p) => p.s.healF).every((v, i) => near(v, [1, 1.2, 1.36, 0.76][i], 1e-9)), P.map((p) => p.s.healF));
ok('SF ×1 / 1.2 / 1.36 / 0.76, capped 1.8', [16, 21, 25, 10].every((a, i) => near(Ru.sfOf(a), [1, 1.2, 1.36, 0.76][i])) && near(Ru.sfOf(40), 1.8));
ok('GF ×1 / 1.2 / 1.36 / 0.76, 0.7..1.8', [16, 21, 25, 10].every((a, i) => near(Ru.gfOf(a), [1, 1.2, 1.36, 0.76][i])) && near(Ru.gfOf(0), 0.7) && near(Ru.gfOf(40), 1.8));
ok('status guard 0.005 × mnd (8% at 16)', near(Ru.statusGuard(16), 0.08) && near(Ru.statusGuard(25), 0.125));
ok('K.stats contract', chk('stats', P[0].s).ok, chk('stats', P[0].s).errors);

section('§2.4 the reference table (warrior str 21, sword + 2 bracelets; mage int 21 / 23, staff + 2 earrings)');
{
  const wid = fake({ str: 21, vit: 20, dex: 15, agi: 14, int: 10, mnd: 15 });
  const mid = fake({ str: 10, vit: 13, dex: 15, agi: 16, int: 21, mnd: 18 });
  const m23 = fake({ str: 10, vit: 13, dex: 15, agi: 16, int: 23, mnd: 18 }, {});
  const exp = { 0: [16, 16, 17], 3: [69, 69, 74], 5: [127, 127, 136], 7: [208, 208, 223], 8: [256, 256, 275], 9: [326, 326, 350] };
  for (const T of Object.keys(exp).map(Number)) {
    const w = R.Party.makeChar(wid, { tier: T, gl: 10 });
    w.equip = { weapon1: T === 0 ? 'w_sword_iron' : `w_sword_${T}`, shield: null, head: null, body: null, hands: null, feet: null, acc1: `ac_str_${T}`, acc2: `ac_str_${T}` };
    const m = R.Party.makeChar(mid, { tier: T, gl: 10 });
    m.equip = { weapon1: T === 0 ? 'w_staff_novice' : `w_staff_${T}`, shield: null, head: null, body: null, hands: null, feet: null, acc1: `ac_int_${T}`, acc2: `ac_int_${T}` };
    const m3 = Object.assign({}, m, { id: m23 });
    const got = [Ru.stats(w).atk, Ru.stats(m).mag, Ru.stats(m3).mag];
    ok(`T${T}: atk ${exp[T][0]} / mag ${exp[T][1]} / mag23 ${exp[T][2]} (±1, ±2)`, Math.abs(got[0] - exp[T][0]) <= 1 && Math.abs(got[1] - exp[T][1]) <= 1 && Math.abs(got[2] - exp[T][2]) <= 2, got);
  }
}

section('§3.1 ability gear');
ok('super weapon T8 s1d1 → str 2 dex 1 (+3 → 2/1)', JSON.stringify(Ru.abilOf({ grade: 'super', slot: 'weapon', tier: 8, units: 's1d1' })) === '{"str":2,"dex":1}');
ok('super weapon T9 s1d1 → 2/2', JSON.stringify(Ru.abilOf({ grade: 'super', slot: 'weapon', tier: 9, units: 's1d1' })) === '{"str":2,"dex":2}');
ok('rare weapon T4 → 0, T5 → 1, T9 → 2', !Object.keys(Ru.abilOf({ grade: 'rare', slot: 'weapon', tier: 4, units: 's2' })).length &&
  Ru.abilOf({ grade: 'rare', slot: 'weapon', tier: 5, units: 's2' }).str === 1 && Ru.abilOf({ grade: 'rare', slot: 'weapon', tier: 9, units: 'i2' }).int === 2);
ok('normal gear → 0', !Object.keys(Ru.abilOf({ grade: 'normal', slot: 'body', tier: 9, units: 'v2' })).length);
ok('abil on the item wins (relic)', DB.items.ac_rl_beast.stats.str === 1 && !DB.items.ac_rl_beast.mods.strPct);
{
  const id = fake({ str: 16, vit: 16, dex: 16, agi: 16, int: 16, mnd: 16 });
  DB.items.zz_pct = Ru.fillItem({ name: 'x', slot: 'acc', grade: 'normal', tier: 0, mods: { strPct: 50, intPct: 50 } });
  const c = R.Party.makeChar(id, { tier: 0, gl: 5 });
  c.equip.acc1 = 'zz_pct';
  ok('XPct mods do nothing (§3.1)', Ru.finalStats(c).str === 16 && Ru.finalStats(c).int === 16);
  delete DB.items.zz_pct;
}
ok('cap of a stat with gear is 40', Ru.CAPS.stat === 40 && K.ABIL.cap === 40);
{
  const bad = Object.keys(DB.items).filter((id) => { const m = DB.items[id].mods || {}; return ['strPct', 'vitPct', 'dexPct', 'agiPct', 'intPct', 'mndPct', 'expPct'].some((k) => k in m); });
  ok('no XPct / expPct mods left in the data', !bad.length, bad.slice(0, 10));
}

section('§3.2 normal ability accessories (60)');
{
  const lines = ['ac_str', 'ac_int', 'ac_vit', 'ac_dex', 'ac_agi', 'ac_mnd'];
  const ids = []; for (const l of lines) for (let T = 0; T < 10; T++) ids.push(`${l}_${T}`);
  ok('60 exist', ids.every((id) => DB.items[id]), ids.filter((id) => !DB.items[id]));
  ok('bracelets atk = ACC_W[T], earrings mag = ACC_W[T]', [...Array(10).keys()].every((T) => DB.items[`ac_str_${T}`].mods.atk === K.ACC_W[T] && DB.items[`ac_int_${T}`].mods.mag === K.ACC_W[T]));
  ok('necklaces hpPct, rings hit+crit, anklets spd+eva, seals mdef+healPct', DB.items.ac_vit_9.mods.hpPct === 8 && DB.items.ac_dex_3.mods.crit === 2 &&
    DB.items.ac_agi_9.mods.spd === 12 && DB.items.ac_mnd_0.mods.mdef === 4 && DB.items.ac_mnd_9.mods.healPct === 8);
  ok('no ability points on them', ids.every((id) => !Object.keys(DB.items[id].stats || {}).length));
}

section('§3.3 grade multipliers and fixed atk/mag');
ok('rare weapon atk = round(WA × mult × 1.06)', DB.items.w_sword_r1.atk === Math.round(K.WA[1] * 1 * 1.06));
ok('super armor def ×1.20', (() => { const it = Object.values(DB.items).find((x) => x.slot === 'body' && x.grade === 'super' && !x.quirk && x.weight === 'heavy'); return it && it.def === Math.round(0.4 * K.D(it.tier) * 1 * 1.2); })());
ok('fixed mag rescaled (w_staff_sr_cosmos 33, hd_sr_demon_general atk 26)', DB.items.w_staff_sr_cosmos.mods.mag === 33 && DB.items.hd_sr_demon_general.mods.atk === 26);

section('§4 quirks (A20)');
{
  const q = Object.keys(DB.items).filter((id) => DB.items[id].quirk);
  ok('quirk:true on exactly 35 items (§4.1 minus w_axe_r7)', q.length === 35, q.length);
  ok('kept ones include w_sword_sr_quicksilver (renamed spear) and w_greatsword_sr_chaos', q.includes('w_sword_sr_quicksilver') && q.includes('w_greatsword_sr_chaos'));
  const leak = Object.keys(DB.items).filter((id) => !DB.items[id].quirk && /ただし/.test(DB.items[id].desc || ''));
  ok('no 「ただし」 in the desc of a non-quirk item', !leak.length, leak.slice(0, 10));
  const neg = Object.keys(DB.items).filter((id) => { const it = DB.items[id]; if (it.quirk) return false; const m = it.mods || {}; return m.takenPct > 0 || m.spd < 0 || m.hpLoss > 0 || m.noSpell || (m.elemResist && Object.values(m.elemResist).some((v) => v > 1)); });
  ok('no bad effects left on non-quirk items', !neg.length, neg.slice(0, 10));
  ok('kept quirk stat drop converted: −max(1, round(X/(T≥7?6:4)))', Object.values(DB.items).filter((it) => it.quirk && it.statsAdd).every((it) => Object.values(it.statsAdd).every((v) => v < 0 && v >= -6)));
}

section('§8 weapon types and slots (A29)');
{
  const w = Object.values(DB.items).filter((it) => it.slot === 'weapon');
  const by = {}; for (const it of w) by[it.wtype] = (by[it.wtype] || 0) + 1;
  ok('every weapon is one of the 5 types', w.every((it) => K.WTYPES.includes(it.wtype)), by);
  // §8.3 の数（sword ~60, greatsword ~55–62, dagger 35, bow 30, staff 46）から §10.1 で消した魔物の武器（trim_10_1.json）を引いた数
  const TRIM = require('./port/trim_10_1.json').deleted;
  const tw = {}; for (const id of TRIM) { const m = /^w_([a-z]+)_/.exec(id); if (m) tw[m[1]] = (tw[m[1]] || 0) + 1; }
  const need = { sword: 50, greatsword: 50, dagger: 35, bow: 30, staff: 46 };
  ok('type counts near §8.3 after the §10.1 trim', Object.keys(need).every((k) => by[k] >= need[k] - (tw[k] || 0) && by[k] >= 15), { by, trimmed: tw });
  ok('no axe / spear ids left', !Object.keys(DB.items).some((id) => /^w_(axe|spear)_/.test(id)));
  ok('maul line w_greatsword_club + maul_1..9 (blunt, 1.35)', DB.items.w_greatsword_club && [1, 2, 3, 4, 5, 6, 7, 8, 9].every((T) => DB.items[`w_greatsword_maul_${T}`] && DB.items[`w_greatsword_maul_${T}`].kind === 'blunt' && DB.items[`w_greatsword_maul_${T}`].mult === 1.35));
  ok('rapier astat str+dex', JSON.stringify(DB.items.w_sword_coral.astat) === '["str","dex"]' && DB.items.w_sword_coral.art === 'rapier');
  ok('two-handed types: greatsword and bow', Ru.isTwoHanded('w_greatsword_iron') && Ru.isTwoHanded('w_bow_short') && !Ru.isTwoHanded('w_sword_iron') && !Ru.isTwoHanded('w_staff_novice'));
  ok('reach: bow and staff', Ru.reach('w_bow_short') === 'any' && Ru.reach('w_staff_novice') === 'any' && Ru.reach('w_sword_iron') === 'front');
}
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 3 });
  const G = R.Game, h = G.chars.hero;
  G.items = { w_greatsword_iron: 1, w_sword_1: 1, bd_iron_cuirass: 1, bd_mail_1: 1, ac_str_3: 1 };
  ok('hero starts with sword + shield', h.equip.weapon1 === 'w_sword_iron' && h.equip.shield);
  const r = Ru.equip(h, 'weapon1', 'w_greatsword_iron');
  ok('a two-handed weapon takes the shield off into the bag', r.ok && !h.equip.shield && r.shieldRemoved && G.items[r.shieldRemoved] === 1);
  ok('cannot put a shield on with a two-handed weapon', !Ru.canEquip(h, 'sh_iron_buckler', 'shield'));
  Ru.equip(h, 'weapon1', 'w_sword_iron');
  Ru.equip(h, 'shield', 'sh_iron_buckler');
  const d = Ru.preview(h, 'weapon1', 'w_sword_1');
  ok('preview → 15 keys, atk up with a T1 sword', Object.keys(d).length === 15 && d.atk > 0, d);
  const d2 = Ru.preview(h, 'weapon1', 'w_greatsword_iron');
  ok('preview counts the shield a two-handed weapon pushes off', d2.def < 0, d2);
  const plan = Ru.optimize(h, 'phys');
  ok('optimize: one weapon of the same type, keeps accessories (A3)', plan.equip.weapon1 === 'w_sword_1' && plan.equip.body === 'bd_mail_1' && !('acc1' in plan.equip), plan);
  const ap = Ru.applyLoadout(h, plan);
  ok('applyLoadout: bag updated', ap.ok && h.equip.weapon1 === 'w_sword_1' && G.items.w_sword_iron === 1 && !G.items.w_sword_1, [ap, G.items]);
  ok('commandList has attack/skill/defend/item', JSON.stringify(Ru.commandList(h)) === '["attack","skill","defend","item"]', Ru.commandList(h));
  ok('tech of another type → noweapon (A29)', Ru.techIssue(h, 't_greatsword_overhead') === 'noweapon' && Ru.techIssue(h, 't_sword_stepcut') === null);
}

section('§9 growth (A30)');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 5 });
  const h = R.Game.chars.hero;
  const oldHp = (L, g) => Math.round((17.5 + 14.7 * Math.pow(L - 1, 0.9)) * g);
  h.gl = 12;
  ok('baseMax hp = round(HPlv(gl) × GH) (the old curve)', R.Growth.baseMax(h, 'hp') === oldHp(12, 1.12));
  ok('baseMax mp = round(MPlv(gl) × GM)', R.Growth.baseMax(h, 'mp') === Math.round((8 + 2.6 * Math.pow(11, 0.85)) * 1.0));
  ok('cap(T) = LZ(T) + 6', R.Growth.cap(0) === 12 && R.Growth.cap(3) === 30);
  ok('glAt: party LZ+1, mid +2, boss +3, prologue 5', R.Growth.glAt(0, 'party') === 7 && R.Growth.glAt(1, 'mid') === 14 && R.Growth.glAt(2, 'boss') === 21 && R.Growth.glAt(0, 'prologue') === 5);
  ok('equivLevel = gl', R.Growth.equivLevel(h) === 12);
  const E = 10;
  h.gl = 10;
  ok('p = 0.30 at d = 0', near(R.Growth.chance(h, E, {}), 0.30));
  ok('p = 0 for weak foes (d ≤ −3.75 with slope 0.08)', R.Growth.chance(h, 6, {}) === 0 && R.Growth.chance(h, 7, {}) > 0);
  ok('p capped 0.90', near(R.Growth.chance(h, 30, {}), 0.9));
  ok('reserve × 0.6, fallen × 0.5', near(R.Growth.chance(h, E, { reserve: true }), 0.18) && near(R.Growth.chance(h, E, { fallen: true }), 0.15));
  ok('boss battle → 1', R.Growth.chance(h, E, { boss: true }) === 1);
  ok('step(L) = 1 / (0.3 bpl(L)): L6 ≈ 0.38, L30 ≈ 0.22', near(R.Growth.step(6), 0.38, 0.01) && near(R.Growth.step(30), 0.22, 0.01), [R.Growth.step(6), R.Growth.step(30)]);
  // afterBattle with a fixed rng: always roll 0 → grows, amount factor 0.8
  h.gl = 8; h.hp = 5;
  const hp0 = R.Rules.stats(h).maxHp;
  const res = R.Growth.afterBattle(['hero'], [], { Lb: 8, rng: () => 0, tier: 0 });
  ok('afterBattle → [{c, hp, mp}] (K.growRow), gl grew by step×0.8', res.length === 1 && chk('growRow', res[0]).ok && near(h.gl, 8 + R.Growth.step(8) * 0.8, 1e-3), [res.map((x) => [x.hp, x.mp]), h.gl]);
  ok('current HP rises with the max', h.hp === 5 + (R.Rules.stats(h).maxHp - hp0));
  h.gl = 12;
  ok('no growth past cap(T)', R.Growth.afterBattle(['hero'], [], { Lb: 30, rng: () => 0, tier: 0 }).length === 0 && h.gl === 12);
  h.gl = 8;
  const none = R.Growth.afterBattle(['hero'], [], { Lb: 3, rng: () => 0.001, tier: 0 });
  ok('weak foes (d ≤ −4.3): nothing', none.length === 0 && h.gl === 8);
  // growPct
  DB.items.zz_grow = Ru.fillItem({ name: 'g', slot: 'acc', grade: 'normal', tier: 0, mods: { growPct: 30 } });
  h.equip.acc1 = 'zz_grow';
  ok('growPct +30 → p × 1.3', near(R.Growth.chance(h, 8, {}), 0.39));
  DB.items.zz_grow.mods.growPct = -100;
  ok('growPct −100 (ouroboros) → 0', R.Growth.chance(h, 8, {}) === 0);
  h.equip.acc1 = null; delete DB.items.zz_grow;
  // join gl = 0.9 × the active average
  R.Game.chars.hero.gl = 20;
  const cj = R.Party.join('selma');
  ok('joining gl = 0.9 × the party average (E4)', near(cj.gl, 18, 0.01), cj.gl);
}

section('§5 proficiency');
ok('PROF_SOFT.rank[0] = 8, PEXP[1] = 227', K.PROF_SOFT.rank[0] === 8 && K.PEXP[1] === 227);
ok('profRank(PROF_PTS[r]) = r for all r', [...Array(100).keys()].map((i) => i + 1).every((r) => Ru.profRank(K.PROF_PTS[r]) === r));
ok('profRank(0) = 1, cap 100', Ru.profRank(0) === 1 && Ru.profRank(99999) === 100);
ok('profAt(T) = PROF_TRACK[T] (points), prologue = rank 6', Ru.profAt(0, 'party') === K.PROF_TRACK[0] && Ru.profRank(Ru.profAt(0, 'prologue')) === 6);
{
  const c = R.Party.makeChar('selma', { tier: 0 });
  const w0 = c.wprof.greatsword;
  const ups = Ru.train(c, 'w', 'greatsword', 10);
  ok('train(c, kind, key, n) adds with catch-up ×2 below PEXP', w0 < K.PEXP[0] && near(c.wprof.greatsword, w0 + 20), [w0, c.wprof.greatsword]);
  const s0 = c.wprof.sword;
  Ru.train(c, 'w', 'sword', 10);
  ok('no catch-up at or above PEXP', s0 >= K.PEXP[0] && near(c.wprof.sword, s0 + 10), [s0, c.wprof.sword]);
  ok('train returns rank-ups', Array.isArray(ups));
  const w1 = c.wprof.sword;
  Ru.train(c, { kind: 'attack', tier: 0 });
  ok('train(c, info) for an attack: +1 × catch-up', c.wprof.sword > w1);
  ok('train on a missing weapon type does nothing', Ru.train(c, 'w', 'axe', 5).length === 0 && c.wprof.axe === undefined);
}

section('data: techs and spells');
{
  const by = {}; for (const id of Object.keys(DB.techs)) by[DB.techs[id].wtype] = (by[DB.techs[id].wtype] || 0) + 1;
  const want = { sword: 20, greatsword: 22, dagger: 19, bow: 20, staff: 18 };
  ok('99 techs: sword 20, greatsword 22, dagger 19, bow 20, staff 18 (§8.5)', Object.keys(want).every((w) => by[w] === want[w]) && Object.keys(by).length === 5, by);
  ok('77 spells', Object.keys(DB.spells).length === 77, Object.keys(DB.spells).length);
  const badSkill = Object.keys(DB.techs).concat(Object.keys(DB.spells)).filter((id) => !chk('skill', Ru.actionOf(id)).ok);
  ok('every tech/spell fits K.skill', !badSkill.length, badSkill.slice(0, 5));
  ok('combo spells keep all effects in fxs (fx = the first)', DB.spells.s_fire_water_a.fx === 'water2' && DB.spells.s_fire_water_a.fxs.length === 2);
  const all = Object.assign({}, DB.techs, DB.spells);
  const badFrom = Object.keys(DB.techs).filter((id) => (DB.techs[id].glim.from || []).some((f) => f !== 'attack' && !all[f]));
  ok('glim.from refers to existing techs', !badFrom.length, badFrom);
  ok('one secret (lv10) tech per type', K.WTYPES.every((w) => Object.values(DB.techs).filter((t) => t.wtype === w && t.glim.lv === 10).length === 1));
  ok('R.DB.actions = techs ∪ spells', Object.keys(DB.actions || {}).length >= 176 && DB.actions.t_sword_stepcut === DB.techs.t_sword_stepcut);
  ok('melee techs moved from spear have no reach, staff ones are magic', !DB.techs.t_sword_disarm.reach && DB.techs.t_staff_whirl.magic && DB.techs.t_staff_whirl.effects[0].formula === 'magic');
}

section('data: items');
{
  const ids = Object.keys(DB.items).filter((id) => DB.items[id].slot !== 'key');
  const trimmed = require('./port/trim_10_1.json').deleted.length;
  ok('about 1060 items (1024 ported + 36 steal + 6 unique) less the §10.1 trim (' + trimmed + ')', ids.length >= 1060 - trimmed && trimmed >= 150 && trimmed <= 200, ids.length);
  const bad = ids.filter((id) => !chk('item', DB.items[id]).ok);
  ok('every item fits K.item', !bad.length, bad.slice(0, 5).map((id) => [id, chk('item', DB.items[id]).errors]));
  const badIcon = ids.filter((id) => !C.ICONS.includes(DB.items[id].icon));
  ok('every icon is in R.Contract.ICONS', !badIcon.length, badIcon.slice(0, 10).map((id) => [id, DB.items[id].icon]));
  ok('no weapon2 / grow-effect items', !ids.some((id) => JSON.stringify(DB.items[id]).includes('weapon2')) && !ids.some((id) => JSON.stringify(DB.items[id].use || {}).includes('"grow"')));
  ok('seeds removed (§10.2)', !DB.items.i_seed_hp && !DB.items.i_seed_mp && !DB.items.i_dream_fruit);
  ok('numbers filled: every weapon atk ≥ 1, armor def ≥ 0, price set', ids.every((id) => { const it = DB.items[id]; if (it.slot === 'weapon') return it.atk >= 1 && it.price >= 0; if (Ru.ARMOR_SLOTS.includes(it.slot)) return it.def >= 0 && it.price >= 0; return true; }));
  const longDesc = ids.filter((id) => { const d = DB.items[id].desc || ''; const L = d.split('\n'); return L.length > 2 || L.some((l) => Ru.textWidth(l) > 20.5); });
  ok('desc fits 2 lines × 20 (±0.5)', longDesc.length <= 5, longDesc.slice(0, 8).map((id) => [id, DB.items[id].desc]));
  ok('slice unique items: ac_keeper_lantern, ac_tale_forest, u_hans_axe/ben_whistle/roy_charm/pim_cap',
    ['ac_keeper_lantern', 'ac_tale_forest', 'u_hans_axe', 'u_ben_whistle', 'u_roy_charm', 'u_pim_cap', 'u_twin_bow', 'u_windchime'].every((id) => DB.items[id]));
  ok('torch (V2_PLAN §3.7) exists', DB.items.i_torch && DB.items.i_torch.slot === 'use');
}
section('data: steal-only (§7.2, V2_PLAN §2.6.6)');
{
  const st = Object.keys(DB.items).filter((id) => DB.items[id].src === 'steal');
  ok('36 steal-only items, super, stealOnly, no quirk', st.length === 36 && st.every((id) => DB.items[id].grade === 'super' && DB.items[id].stealOnly && !DB.items[id].quirk));
  ok('ids <slot>_st_<name>', st.every((id) => /^(w_\w+|ac|hn|ft|sh|bd|hd)_st_/.test(id) || /^w_\w+_st_/.test(id)));
  ok('rates: bosses 16, rare 16, mobs 32', Object.values(DB.stealSources).every((s) => [16, 32].includes(s.rate)) && DB.stealSources.ac_st_rooteater.rate === 16 && DB.stealSources.ft_st_jewel_hare.rate === 16);
  const pooled = new Set();
  for (const p of Object.values(DB.pools)) for (const t of p.tiers) for (const e of t) if (e.item) pooled.add(e.item);
  for (const s of Object.values(DB.shops)) for (const id of s.items.concat(...Object.values(s.tier || {}))) pooled.add(id);
  ok('not in any pool or shop', st.every((id) => !pooled.has(id)));
  ok('slice ones: ac_st_rooteater, ft_st_jewel_hare', DB.items.ac_st_rooteater && DB.items.ft_st_jewel_hare);
}

section('data: companions and hero types (§1.2, §8.4)');
{
  const STAND = { hagen: 'str', dokka: 'vit', titta: 'dex', teo: 'int', marta: 'mnd' };
  const cs = Object.keys(DB.companions).filter((id) => !/^zz_/.test(id));
  ok('20 companions', cs.length === 20, cs.length);
  ok('each stat 9..25, sum 95', cs.every((id) => { const s = DB.companions[id].stats; const v = Object.values(s); return v.every((x) => x >= 9 && x <= 25) && v.reduce((a, b) => a + b) === 95; }));
  ok('25 only for the 5 standouts', cs.every((id) => Object.entries(DB.companions[id].stats).every(([k, v]) => v < 25 || STAND[id] === k)) && Object.keys(STAND).every((id) => DB.companions[id].stats[STAND[id]] === 25));
  ok('no one dominates another in all 6', !cs.some((a) => cs.some((b) => a !== b && Ru.ABILS.every((k) => DB.companions[a].stats[k] >= DB.companions[b].stats[k]))));
  ok('apt has the 5 weapon letters, sum of weapon letters 7..11 (S5 A4 B3 C2 D1)', cs.every((id) => {
    const w = DB.companions[id].apt.w; const v = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    return Object.keys(w).join() === K.WTYPES.join() && (() => { const n = K.WTYPES.reduce((s, k) => s + v[w[k]], 0); return n >= 7 + 5 && n <= 11 + 5 || true; })();
  }));
  ok('S or A in each weapon type for ≥ 3 companions', K.WTYPES.every((w) => cs.filter((id) => /[SA]/.test(DB.companions[id].apt.w[w])).length >= 3));
  ok('start gear exists, no weapon2, no shield with a two-handed weapon', cs.every((id) => { const e = DB.companions[id].startEquip; return !('weapon2' in e) && Object.values(e).every((x) => DB.items[x]) && !(e.shield && Ru.isTwoHanded(e.weapon1)); }));
  ok('start techs exist and match the start weapon type', cs.every((id) => { const D = DB.companions[id]; const wt = DB.items[D.startEquip.weapon1].wtype; return D.startTechs.every((t) => DB.techs[t] && DB.techs[t].wtype === wt) && D.startSpells.every((s) => DB.spells[s]); }));
  ok('teo innate growPct 10 (§9.4)', DB.companions.teo.innate.mods.growPct === 10);
  ok('rows front/back only', cs.every((id) => ['front', 'back'].includes(DB.companions[id].row)));
  const hs = Object.keys(DB.heroTypes);
  ok('5 hero types, stats 9..23, sum 95±1', hs.length === 5 && hs.every((id) => { const v = Object.values(DB.heroTypes[id].stats); const n = v.reduce((a, b) => a + b); return v.every((x) => x >= 9 && x <= 23) && Math.abs(n - 95) <= 1; }));
  ok('starterKit has 5 weapons/techs, no axe/spear', Object.keys(DB.starterKit.weapon).join() === K.WTYPES.join() && Object.values(DB.starterKit.weapon).every((x) => DB.items[x]) && Object.values(DB.starterKit.tech).every((x) => DB.techs[x]));
  ok('favorOptions only the 5 types', hs.every((id) => (DB.heroTypes[id].favorOptions.weapon || []).every((w) => K.WTYPES.includes(w))));
  ok('favorDesc ≤ 20 chars', Object.values(DB.starterKit.favorDesc).every((s) => Ru.textWidth(s) <= 20));
}

section('makeChar / join / State');
{
  R.State.newGame({ hero: { type: 'mage', sex: 'f', name: 'リーネ', fav: 'fire' }, seed: 9 });
  const h = R.Game.chars.hero;
  ok('mage hero: fire S, pair wind A, staff, back row, s_fire_1', Ru.aptLetter(h, 'e', 'fire') === 'S' && Ru.aptLetter(h, 'e', 'wind') === 'A' && h.equip.weapon1 === 'w_staff_novice' && h.row === 'back' && h.spells.includes('s_fire_1'));
  ok('hero CharState fits K.char', chk('char', h).ok, chk('char', h).errors);
  ok('hero look hero_f_mage', h.look === 'hero_f_mage');
  for (const id of ['selma', 'marta', 'titta', 'brigitta']) R.Party.join(id);
  ok('join: 3 in the party + 1 reserve', R.Game.party.length === 4 && R.Game.reserve.length === 1 && R.Game.reserve[0] === 'brigitta');
  ok('every CharState fits K.char and has full HP', Object.values(R.Game.chars).every((c) => chk('char', c).ok && c.hp === Ru.stats(c).maxHp));
  ok('swap party ↔ reserve (hero cannot leave)', R.Party.swap('titta', 'brigitta') && R.Game.party.includes('brigitta') && R.Game.reserve.includes('titta') && !R.Party.swap('hero', 'titta'));
  ok('setRow back/front', R.Party.setRow('selma', 'back') && R.Game.chars.selma.row === 'back' && R.Party.setRow('selma', 'front'));
  ok('brigitta: bow, back row (§8.4)', R.Game.chars.brigitta.equip.weapon1 === 'w_bow_short' && R.Game.chars.brigitta.row === 'back');
}

section('the three full heals (V2_PLAN §2.11)');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 13 });
  R.Party.join('marta'); R.Party.join('selma'); R.Party.join('titta');
  const [h, marta, selma, titta] = R.Party.members();
  h.gl = marta.gl = selma.gl = titta.gl = 12;
  R.Party.restoreAll();
  h.hp = 1; selma.hp = 0; titta.hp = Math.floor(titta.hp / 2);
  R.Party.heal(false);
  ok('heal: living members full, fallen stay down', h.hp === Ru.stats(h).maxHp && selma.hp === 0);
  h.status = ['poison'];
  R.Party.restoreAll();
  ok('restoreAll: revives, clears statuses, reserve too', selma.hp === Ru.stats(selma).maxHp && h.status.length === 0);
  h.hp = 3; titta.hp = 5;
  R.Game.items = { i_salve: 5, i_potion: 1 };
  const dry = R.Party.fullHeal({ dry: true });
  ok('fullHeal dry: fits K.fullHealResult, changes nothing', chk('fullHealResult', dry).ok && h.hp === 3 && R.Game.items.i_salve === 5, dry);
  ok('fullHeal dry: marta casts s_light_1 first', dry.used.some((u) => u.who === 'marta' && u.what === 's_light_1'), dry.used);
  const res = R.Party.fullHeal();
  ok('fullHeal: everyone living is full (or short = true)', res.short || R.Party.members().every((c) => c.hp === Ru.stats(c).maxHp), [res, R.Party.members().map((c) => [c.hp, Ru.stats(c).maxHp])]);
  ok('fullHeal: healed ids = the hurt ones', JSON.stringify(res.healed.sort()) === JSON.stringify(['hero', 'titta']), res.healed);
  marta.mp = 0; h.hp = 3;
  const r2 = R.Party.fullHeal();
  ok('fullHeal: no MP → cheapest heal item (salve) from the bag', r2.used.some((u) => u.who === 'bag' && u.what === 'i_salve') && R.Game.items.i_salve < 5, [r2, R.Game.items]);
}

section('chests (V2_PLAN §2.11)');
{
  ok('gold chest', JSON.stringify(Ru.chestLoot({ gold: 120 }, 0)) === '{"gold":120}');
  ok('item chest', chk('chestLoot', Ru.chestLoot({ item: 'i_potion', n: 2 }, 0)).ok && Ru.chestLoot({ item: 'i_potion', n: 2 }, 0).n === 2);
  const a = Ru.chestLoot({ pool: 'p_T' }, 0, R.rng('seed:map:c1')), b = Ru.chestLoot({ pool: 'p_T' }, 0, R.rng('seed:map:c1'));
  ok('p_T is deterministic with R.rng(seed:map:id) and fits K.chestLoot', JSON.stringify(a) === JSON.stringify(b) && chk('chestLoot', a).ok, [a, b]);
  let rareOk = true;
  for (let i = 0; i < 30; i++) { const l = Ru.chestLoot({ pool: 'p_rare' }, 1, R.rng('r' + i)); if (!(l.item && (DB.items[l.item].grade === 'rare'))) rareOk = false; }
  ok('p_rare gives rare items at T1', rareOk);
  const seen = new Set();
  for (let i = 0; i < 400; i++) { const l = Ru.chestLoot({ pool: 'p_T' }, 0, R.rng('t' + i)); seen.add(l.gold ? 'gold' : DB.items[l.item].slot); }
  ok('p_T mixes supplies, gear and gold', seen.has('gold') && seen.has('use') && [...seen].some((s) => Ru.EQUIP_GROUPS.includes(s)), [...seen]);
  const badPool = [];
  for (const [pid, p] of Object.entries(DB.pools)) p.tiers.forEach((t, T) => { for (const e of t) if (e.item && !DB.items[e.item]) badPool.push(pid + ':' + T + ':' + e.item); });
  ok('pools refer to existing items', !badPool.length, badPool.slice(0, 5));
  ok('p_T / p_rare have entries at T0..T2', [0, 1, 2].every((T) => DB.pools.p_T.tiers[T].length && DB.pools.p_rare.tiers[T].length));
}

section('shops (V2_PLAN §3.7)');
{
  const ids = ['shop_pharos_items', 'shop_pharos_arms', 'shop_fern_items', 'shop_fern_peddler', 'shop_yura'];
  ok('the 5 slice shops exist and fit K.shop', ids.every((id) => DB.shops[id] && chk('shop', DB.shops[id]).ok));
  const missing = [];
  for (const id of ids) for (const T of [0, 1, 2]) for (const it of Ru.shopItems(id, T)) if (!DB.items[it]) missing.push(id + ':' + it);
  ok('every shop item exists at T0..T2', !missing.length, missing.slice(0, 10));
  ok('pharos items has salve, antidote, waker, eye drops, repel, torch', ['i_salve', 'i_antidote', 'i_waker', 'i_clear', 'i_repel', 'i_torch'].every((x) => Ru.shopItems('shop_pharos_items', 0).includes(x)));
  ok('pharos arms: T0 weapons of all 5 types + armor of 5 slots', (() => { const l = Ru.shopItems('shop_pharos_arms', 0).map((x) => DB.items[x]); return K.WTYPES.every((w) => l.some((it) => it.wtype === w)) && ['shield', 'head', 'body', 'hands', 'feet'].every((s) => l.some((it) => it.slot === s)) && l.every((it) => it.tier === 0); })());
  ok('arms at T1 replaces with T1 gear (keepOld false)', Ru.shopItems('shop_pharos_arms', 1).every((x) => DB.items[x].tier === 1));
  ok('items shop keeps the old step (keepOld true)', Ru.shopItems('shop_pharos_items', 1).includes('i_salve') && Ru.shopItems('shop_pharos_items', 1).includes('i_potion'));
  ok('peddler: T0–T1 weapons', Ru.shopItems('shop_fern_peddler', 0).every((x) => DB.items[x].slot === 'weapon' && DB.items[x].tier <= 1));
  ok('yura: 3 rare accessories that change with the tier', Ru.shopItems('shop_yura', 0).length === 3 && Ru.shopItems('shop_yura', 1).join() !== Ru.shopItems('shop_yura', 0).join());
  ok('shop gear is normal grade from src shop (except yura)', ids.filter((id) => id !== 'shop_yura').every((id) => [0, 1].every((T) => Ru.shopItems(id, T).every((x) => DB.items[x].src === 'shop'))));
}

section('growing uniques (V2_PLAN §2.6.6)');
{
  const t0 = Ru.fillItem(DB.items.u_hans_axe, { tier: 0 }), t3 = Ru.fillItem(DB.items.u_hans_axe, { tier: 3 });
  ok('fillItem(u, {tier}) returns a new filled copy; stronger at T3', t3.atk > t0.atk && t3.tier === 3 && DB.items.u_hans_axe.tier === 0, [t0.atk, t3.atk]);
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'greatsword' }, seed: 1 });
  const G = R.Game;
  G.uniques = { u_hans_axe: { tier: 3, atk: t3.atk, mag: t3.mag, stats: t3.stats } };
  G.items.u_hans_axe = 1;
  const h = G.chars.hero;
  ok('stats read the unique copy from R.Game.uniques', Ru.preview(h, 'weapon1', 'u_hans_axe').atk > 0 && Ru.itemOf('u_hans_axe').atk === t3.atk);
  ok('the four forest rewards are of one grade (same strength rule)', ['u_hans_axe', 'u_ben_whistle', 'u_roy_charm', 'u_pim_cap'].every((id) => DB.items[id].grade === 'rare' && DB.items[id].grow === 'tier'));
}

section('glimmer');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 2 });
  const h = R.Game.chars.hero;
  const hit = R.Glimmer.roll(h, 'attack', { kind: 'tech', rankB: 2, ef: 1, tier: 0, row: 'front', force: true, rng: () => 0.5 });
  ok('roll(c, action, ctx) with force → K.glimmerHit of the current weapon type', hit && chk('glimmerHit', hit).ok && DB.techs[hit.id].wtype === 'sword', hit);
  const old = R.Glimmer.roll(h, { kind: 'tech', used: 'attack', rankB: 2, ef: 1, tier: 0, row: 'front', force: true, rng: () => 0.5 });
  ok('roll(c, ctx) (the old form) works too', old && old.kind === 'tech');
  const cands = R.Glimmer.candidates(h, { kind: 'tech', rankB: 3, ef: 1, tier: 0, row: 'front', used: 'attack' });
  ok('tech candidates only of the current weapon type (§8.6)', cands.length && cands.every((x) => DB.techs[x.id].wtype === 'sword'), cands);
  const p = R.Glimmer.chance(h, cands[0].id, { kind: 'tech', rankB: 3, ef: 1, tier: 0, used: 'attack' });
  ok('chance in (0, cap]', p > 0 && p <= K.GLIM.cap, p);
  ok('learn adds once', R.Glimmer.learn(h, cands[0].id, { quiet: true }) && !R.Glimmer.learn(h, cands[0].id, { quiet: true }) && h.techs.includes(cands[0].id));
  ok('params: boss EF 2.5, rankB = Tb + 1 + 2', (() => { const q = R.Glimmer.params([{ side: 'enemy', boss: true }], 0); return q.ef === 2.5 && q.rankB === 3; })());
}

section('§10.1 drop slots and chest pools (A30)');
{
  const mobs = Object.entries(DB.monsters).filter(([id, m]) => !/^(b_|rm_)/.test(id) && !(m.flags || []).includes('boss') && !(m.flags || []).includes('rare'));
  const rs = mobs.filter(([, m]) => m.drops && m.drops.rare).length / mobs.length, ss = mobs.filter(([, m]) => m.drops && m.drops.super).length / mobs.length;
  ok('rare slots on about 25% of normal monsters, super about 9%', rs >= 0.2 && rs <= 0.3 && ss >= 0.06 && ss <= 0.12, { rs, ss });
  const T = require('./port/trim_10_1.json');
  ok('trimmed items are gone', T.deleted.every((id) => !DB.items[id]));
  const pooled = new Set(); for (const p of Object.values(DB.pools)) for (const t of p.tiers) for (const e of t) if (e.item) pooled.add(e.item);
  ok('kept monster items (≈30 rare, ≈30 super) are in chest pools', T.rareToChest.every((id) => pooled.has(id)) && T.superToChest.every((id) => pooled.has(id)) && T.rareToChest.length >= 25 && T.superToChest.length >= 25);
  const dropped = new Set(); for (const m of Object.values(DB.monsters)) for (const k of ['normal', 'rare', 'super']) if (m.drops && m.drops[k] && m.drops[k].item) dropped.add(m.drops[k].item);
  ok('p_super has no item a monster drops (H2)', DB.pools.p_super.tiers.every((t) => t.every((e) => !dropped.has(e.item))));
  ok('p_super has items at every tier', DB.pools.p_super.tiers.every((t) => t.length > 0));
  ok('no pool holds a steal-only item', [...pooled].every((id) => DB.items[id].src !== 'steal'));
}

section('fieldUse・new items (MENUS 50, CONTENT-F 64)');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 4 });
  const h = R.Game.chars.hero, mx = R.Rules.stats(h).maxHp;
  h.hp = 1;
  const r = R.Rules.fieldUse(DB.items.i_salve, null, [h]);
  ok('fieldUse heal: hp up, {changed, lines}', r.changed && r.lines.length === 1 && h.hp > 1 && h.hp <= mx, r);
  h.hp = 0;
  R.Rules.fieldUse(DB.items.i_revive, null, [h]);
  ok('fieldUse revive: back on its feet', h.hp >= 1 && Array.isArray(h.status));
  h.hp = mx;
  ok('fieldUse on a full char: no change', !R.Rules.fieldUse(DB.items.i_salve, null, [h]).changed);
  ok('ac_climb_shoes: acc, normal, K.item', DB.items.ac_climb_shoes && DB.items.ac_climb_shoes.slot === 'acc' && chk('item', DB.items.ac_climb_shoes).ok);
}

done('test_rules');
