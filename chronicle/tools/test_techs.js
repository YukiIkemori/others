#!/usr/bin/env node
// Self-check for area A7 (techs): the 11 weapon types and the 121 techs against
// DESIGN.md §6 (the checks of §6.9.1 1–9, plus §6.1–§6.7). Exit 1 on any failure.
//
//   node tools/test_techs.js             schema checks on an isolated load (core + A7 files only),
//                                        then cross-area checks on the full game load
//   node tools/test_techs.js --isolated  only the isolated part (other owners' files are not loaded)
//   node tools/test_techs.js -v          list every check, not only failures
//   node tools/test_techs.js --no-battle skip the battle-engine probe (fixtures/techs/lib/battle_probe.js)
//
// Cross-area findings that are another owner's to fix (a name clash with a new item,
// a companion's startTechs typo…) are printed as WARN and do not fail the test,
// except the clashes §6.9.1-3 makes this area responsible for (tech vs spell / enemy action names).
'use strict';
const path = require('path');
const S = require('./fixtures/techs/lib/spec');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('-v') || argv.includes('--verbose');
const ISOLATED = argv.includes('--isolated');

let pass = 0, fail = 0, warn = 0;
const failures = [];
let section = '';
function head(name) { section = name; if (VERBOSE) console.log('\n## ' + name); }
function ok(cond, msg) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok   ' + msg); }
  else { fail++; failures.push(`[${section}] ${msg}`); console.log('  FAIL ' + `[${section}] ${msg}`); }
  return !!cond;
}
function note(msg) { warn++; console.log('  WARN ' + msg); }
const J = (v) => JSON.stringify(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);

// ---------------------------------------------------------------- load (isolated)
const R = S.loadIsolated();
head('load');
ok(R && R.DB && R._isolatedErrors.length === 0, 'core + weapontypes.js + techs_*.js load without errors ' + (R._isolatedErrors.join('; ') || ''));
const DB = R.DB;
const WT = DB.weaponTypes;
const techs = S.techList(R);
const byId = Object.fromEntries(techs.map((t) => [t.id, t]));

// ---------------------------------------------------------------- 1. weapon types
head('1 weaponTypes (§6.1.1, §6.8.1)');
ok(J(Object.keys(WT)) === J(S.WTYPES), `DB.weaponTypes has exactly the 11 types in the official order (got ${Object.keys(WT).join(' ')})`);
S.WTYPES.forEach((w, i) => {
  const t = WT[w] || {}, e = S.WT_EXPECT[w];
  ok(t.name === e.name, `${w}.name = ${e.name} (${t.name})`);
  ok(t.order === i, `${w}.order = ${i} (${t.order})`);
  ok(t.twoHanded === e.twoHanded, `${w}.twoHanded = ${e.twoHanded}`);
  ok(t.reach === e.reach, `${w}.reach = ${e.reach}`);
  ok(t.kind === e.kind, `${w}.kind = ${e.kind} (${t.kind})`);
  ok(t.icon === 'icon:' + w, `${w}.icon = icon:${w} (${t.icon})`);
  ok(t.fx === e.fx && S.FX.includes(t.fx), `${w}.fx = ${e.fx} (${t.fx})`);
  ok(typeof t.desc === 'string' && t.desc.length > 0 && S.width(t.desc) <= 20 && !t.desc.includes('\n'), `${w}.desc is one line of ≤ 20 (${S.width(t.desc || '')})`);
  const extra = Object.keys(t).filter((k) => !['name', 'order', 'twoHanded', 'reach', 'kind', 'icon', 'fx', 'desc'].includes(k));
  ok(extra.length === 0, `${w} has no fields outside §6.8.1 ${extra.join(' ')}`);
});

// ---------------------------------------------------------------- 2. count, lv sequence, rank
head('2 count / lv / rank (§6.0 0.2)');
ok(techs.length === 121, `121 actions with kind:'tech' (${techs.length})`);
ok(J(techs.map((t) => t.id)) === J(S.ALL_IDS), 'tech ids and their order are exactly §6.1.2 (weapon-type order → lv order)');
for (const w of S.WTYPES) {
  const list = techs.filter((t) => t.wtype === w);
  ok(list.length === 11, `${w}: 11 techs (${list.length})`);
  ok(J(list.map((t) => t.glim && t.glim.lv)) === J(S.LV_SEQ), `${w}: glim.lv sequence 1,1,2,…,10 (${list.map((t) => t.glim && t.glim.lv).join(',')})`);
}
for (const t of techs) ok(t.rank === (t.glim && t.glim.lv), `${t.id}: rank === glim.lv (${t.rank}/${t.glim && t.glim.lv})`);
ok(techs.filter((t) => t.glim.lv <= 9).length === 110 && techs.filter((t) => t.glim.lv === 10).length === 11, '110 main-story techs (lv 1–9) + 11 極意 (lv 10)');
const tIds = Object.keys(DB.actions).filter((k) => k.startsWith('t_'));
ok(tIds.every((k) => DB.actions[k].kind === 'tech'), 'every t_ action is kind:\'tech\'');

// ---------------------------------------------------------------- 3. ids and names
head('3 ids / names (§6.9.1-3)');
const names = new Map();
for (const t of techs) {
  ok(S.WTYPES.includes(t.wtype), `${t.id}: wtype is one of the 11 (${t.wtype})`);
  ok(t.id.startsWith(`t_${t.wtype}_`), `${t.id}: id starts with t_${t.wtype}_`);
  ok(/^t_[a-z]+_[a-z0-9]+$/.test(t.id), `${t.id}: id is lower-case ascii`);
  ok(!names.has(t.name), `${t.id}: name 「${t.name}」 is unique among techs${names.has(t.name) ? ' (also ' + names.get(t.name) + ')' : ''}`);
  names.set(t.name, t.id);
}

// ---------------------------------------------------------------- 4. widths / text
head('4 name / desc width and style (§1.7, STYLE_JA §1–§4)');
const style = S.styleLists();
const joyo = S.joyoSet();
if (!joyo) note('tools/lib/joyo.txt missing: kanji check skipped');
const badKanji = (s) => joyo ? [...s].filter((c) => /[㐀-鿿豈-﫿]/.test(c) && !joyo.has(c) && !style.allowed.has(c)) : [];
for (const t of techs) {
  ok(typeof t.name === 'string' && t.name.length > 0 && S.width(t.name) <= 8, `${t.id}: name width ≤ 8 (${S.width(t.name)} 「${t.name}」)`);
  ok(typeof t.desc === 'string' && S.width(t.desc) <= 20, `${t.id}: desc width ≤ 20 (${S.width(t.desc)} 「${t.desc}」)`);
  ok(!/[\n\f]/.test(t.desc), `${t.id}: desc is one line`);
  ok(/。$/.test(t.desc), `${t.id}: desc ends with 「。」`);
  ok(!/[０-９Ａ-Ｚａ-ｚ]/.test(t.name + t.desc), `${t.id}: digits and latin letters are half-width`);
  ok(!/[ 　]/.test(t.name + t.desc), `${t.id}: no spaces (no 分かち書き)`);
  ok(!/(眠り|まひ|沈黙|混乱|暗闇|気絶|凍結|やけど)にする|にならない/.test(t.desc), `${t.id}: no 「(状態)にする」「〇にならない」 (STYLE_JA §4)`);
  ok(!/…/.test(t.desc) || /……/.test(t.desc), `${t.id}: three-dot leader is doubled`);
  // 「魔力」 only as the MP alias of names (STYLE_JA §7.4: 魔力の水); never as the stat (= 術力)
  ok(!/魔法|呪文|麻痺|蘇生/.test(t.name + t.desc) && !/魔力/.test(t.desc), `${t.id}: uses this game's terms (術・術力・まひ…)`);
  if (/魔力/.test(t.name)) ok(t.effects.some((e) => e.type === 'healMp'), `${t.id}: 「魔力」 in a name only for an MP tech (MP alias, STYLE_JA §7.4)`);
  const bk = badKanji(t.name + t.desc);
  ok(bk.length === 0, `${t.id}: only jōyō kanji + STYLE_JA §2 list ${bk.join('')}`);
}
for (const w of S.WTYPES) {
  const bk = badKanji(WT[w].name + WT[w].desc);
  ok(bk.length === 0, `${w}: weapon type text uses allowed kanji ${bk.join('')}`);
}

// ---------------------------------------------------------------- 5. glim.from
head('5 glim.from (§6.4.3)');
for (const t of techs) {
  const g = t.glim || {};
  ok(J(Object.keys(g).sort()) === J(['from', 'lv']), `${t.id}: glim has exactly {lv, from}`);
  ok(isInt(g.lv) && g.lv >= 1 && g.lv <= 10, `${t.id}: glim.lv is 1–10`);
  ok(Array.isArray(g.from), `${t.id}: glim.from is an array`);
  if (!Array.isArray(g.from)) continue;
  if (g.lv === 1) ok(J(g.from) === J(['attack']), `${t.id}: lv 1 → from ['attack'] (${J(g.from)})`);
  else {
    ok(g.from.length >= 1 && g.from.length <= 2, `${t.id}: 1–2 parents (${g.from.length})`);
    ok(new Set(g.from).size === g.from.length, `${t.id}: parents are distinct`);
    for (const p of g.from) {
      const pt = byId[p];
      ok(pt && pt.wtype === t.wtype && pt.glim.lv < g.lv, `${t.id}: parent ${p} is a lower-lv ${t.wtype} tech`);
    }
  }
}
// every tech hangs off 'attack' through its first parent (the tree of §6.6)
for (const t of techs) {
  let cur = t, guard = 0;
  while (cur && cur.glim.from[0] !== 'attack' && guard++ < 12) cur = byId[cur.glim.from[0]];
  ok(cur && cur.glim.from[0] === 'attack', `${t.id}: first-parent chain reaches 攻撃`);
}

// ---------------------------------------------------------------- 6. wp / reach / staff
head('6 wp / reach / magic (§6.4.1, §6.3.4, §6.0 0.5–0.6)');
for (const t of techs) {
  const [lo, hi] = S.WP_RANGE[t.glim.lv] || [NaN, NaN];
  ok(isInt(t.wp) && t.wp >= lo && t.wp <= hi, `${t.id}: wp ${t.wp} in lv ${t.glim.lv} range ${lo}–${hi}`);
  ok(Object.prototype.hasOwnProperty.call(t, 'reach') && typeof t.reach === 'boolean', `${t.id}: reach is written as a boolean`);
  ok(t.quick === undefined || t.quick === true, `${t.id}: quick is true or absent`);
  ok(t.magic === undefined || t.magic === true, `${t.id}: magic is true or absent`);
  ok(t.noAuto === undefined || t.noAuto === true, `${t.id}: noAuto is true or absent`);
}
ok(techs.every((t) => t.wp > 0), 'no WP 0 tech (§6.0 0.4)');
for (const w of ['spear', 'bow', 'whip']) ok(techs.filter((t) => t.wtype === w).every((t) => t.reach === true), `${w}: every tech reach:true`);
const staff = techs.filter((t) => t.wtype === 'staff');
ok(staff.every((t) => t.reach === true && t.magic === true), 'staff: every tech reach:true and magic:true');
ok(staff.every((t) => t.effects.filter((e) => e.type === 'damage').every((e) => e.formula === 'magic')), "staff: every damage is formula:'magic'");
ok(staff.every((t) => t.effects.filter((e) => e.type === 'damage').every((e) => !e.element && !e.kind)), 'staff: damage takes no element/kind (術扱い・無属性)');
ok(techs.filter((t) => t.wtype !== 'staff').every((t) => !t.magic && t.effects.every((e) => e.formula === undefined)), "only staff techs are magic / formula:'magic'");
for (const [w, list] of Object.entries(S.REACH_TRUE)) {
  const got = techs.filter((t) => t.wtype === w && t.reach).map((t) => t.id);
  ok(J(got) === J(list), `${w}: middle-row techs are exactly §6.3.4 (${got.join(' ') || 'none'})`);
}
ok(J(techs.filter((t) => t.noAuto).map((t) => t.id).sort()) === J(S.NO_AUTO.slice().sort()), 'noAuto exactly on filch / snatch / share (§6.0 0.13)');
for (const w of S.WTYPES) {
  const [id, name] = S.STARTERS[w];
  ok(byId[id] && byId[id].name === name && byId[id].glim.lv === 1 && byId[id].target === 'enemy' && S.damageOf(byId[id]),
    `starter ${id} 「${name}」: lv 1 single-target damage (§6.1.3)`);
}
ok(techs.some((t) => (t.wtype === 'dagger' || t.wtype === 'whip') && t.glim.lv <= 2 && t.effects.some((e) => e.type === 'steal')),
  'a dagger/whip lv 1–2 tech steals (§5.8)');

// ---------------------------------------------------------------- 7. fields and effects
head('7 fields / effects (§6.2)');
for (const t of techs) {
  const keys = Object.keys(t).filter((k) => k !== 'id');
  const missing = S.TOP_REQUIRED.filter((k) => !keys.includes(k));
  const unknown = keys.filter((k) => !S.TOP_REQUIRED.includes(k) && !S.TOP_OPTIONAL.includes(k));
  ok(missing.length === 0, `${t.id}: has every required field ${missing.join(' ')}`);
  ok(unknown.length === 0, `${t.id}: no field outside §6.2.1 ${unknown.join(' ')}`);
  ok(S.TOP_FORBIDDEN.every((k) => !(k in t)), `${t.id}: no mp/field/msg/element on the tech itself`);
  ok(S.TARGETS.includes(t.target), `${t.id}: target ${t.target} is valid`);
  ok(S.FX.includes(t.fx), `${t.id}: fx ${t.fx} is in the §6.2.6 list`);
  ok(Array.isArray(t.effects) && t.effects.length >= 1 && t.effects.length <= 3, `${t.id}: 1–3 effects`);
  if (!Array.isArray(t.effects)) continue;
  const dmgs = t.effects.filter((e) => e.type === 'damage');
  const enemySide = S.ENEMY_SIDE.includes(t.target);
  ok(dmgs.length <= 1, `${t.id}: at most one damage effect`);
  if (dmgs.length) ok(t.effects[0].type === 'damage', `${t.id}: damage comes first (§6.2.5)`);
  ok(enemySide === (dmgs.length === 1), `${t.id}: enemy-side target ⇔ has damage (${t.target})`);
  let buffs = 0;
  for (const e of t.effects) {
    const allowed = S.EFFECT_FIELDS[e.type];
    ok(!!allowed, `${t.id}: effect type ${e.type} is one techs use`);
    if (!allowed) continue;
    const extra = Object.keys(e).filter((k) => k !== 'type' && !allowed.includes(k));
    ok(extra.length === 0, `${t.id}: ${e.type} has no unknown field ${extra.join(' ')}`);
    if (e.type === 'damage') {
      ok(num(e.power) && e.power > 0 && e.power <= 4, `${t.id}: power ${e.power} is a positive number`);
      ok(e.hits === undefined || (isInt(e.hits) && e.hits >= 2 && e.hits <= 8), `${t.id}: hits is an integer 2–8 (${e.hits})`);
      ok(e.hits === undefined || t.target === 'enemy' || t.target === 'random', `${t.id}: hits only with enemy/random`);
      ok(t.target !== 'random' || isInt(e.hits), `${t.id}: random target has hits`);
      ok(e.formula === undefined || e.formula === 'magic', `${t.id}: formula is omitted or 'magic'`);
      ok(e.kind === undefined || S.KINDS.includes(e.kind), `${t.id}: kind ${e.kind} valid`);
      ok(e.element === undefined || S.ELEMENTS.includes(e.element), `${t.id}: element ${e.element} valid`);
      ok(e.critBonus === undefined || (isInt(e.critBonus) && e.critBonus > 0 && e.critBonus <= 50), `${t.id}: critBonus ${e.critBonus} in +1..50`);
      ok(e.acc === undefined || (num(e.acc) && e.acc > 0 && e.acc < 1), `${t.id}: acc ${e.acc} in (0,1)`);
      ok(e.sure === undefined || e.sure === true, `${t.id}: sure true or absent`);
      ok(!(e.sure && e.acc != null), `${t.id}: not both sure and acc`);
      ok(e.ignoreDef === undefined || (num(e.ignoreDef) && e.ignoreDef > 0 && e.ignoreDef <= 1), `${t.id}: ignoreDef is a number 0–1 (${e.ignoreDef})`);
      ok(e.metalHit === undefined || e.metalHit === true, `${t.id}: metalHit true or absent`);
      ok(e.drain === undefined || (num(e.drain) && e.drain > 0 && e.drain <= 1), `${t.id}: drain 0–1`);
      ok(e.hpCost === undefined || (num(e.hpCost) && e.hpCost > 0 && e.hpCost < 1), `${t.id}: hpCost 0–1`);
      if (e.vs !== undefined) {
        const ks = Object.keys(e.vs);
        ok(ks.length > 0 && ks.every((k) => S.RACES.includes(k) || S.FLAGS.includes(k) || S.BAD_STATUSES.includes(k)), `${t.id}: vs keys are races / flags / status ids (${ks.join(' ')})`);
        ok(Object.values(e.vs).every((m) => num(m) && m > 1 && m <= 2), `${t.id}: vs multipliers in (1,2]`);
      }
    } else if (e.type === 'status' && e.status === 'counter') {
      ok(t.target === 'self', `${t.id}: counter stance targets self`);
      ok(num(e.power) && e.power >= 0.5 && e.power <= 2, `${t.id}: counter power ${e.power} in 0.5–2`);
      ok(e.parry === undefined || (num(e.parry) && e.parry > 0 && e.parry <= 0.5), `${t.id}: counter parry ${e.parry} in (0,0.5]`);
      ok(e.critBonus === undefined || (isInt(e.critBonus) && e.critBonus > 0 && e.critBonus <= 50), `${t.id}: counter critBonus`);
      ok(e.chance === undefined, `${t.id}: counter always succeeds (no chance)`);
    } else if (e.type === 'status') {
      ok(S.BAD_STATUSES.includes(e.status) || e.status === 'death', `${t.id}: status ${e.status} is a bad status or death`);
      ok(e.power === undefined && e.parry === undefined && e.critBonus === undefined, `${t.id}: power/parry/critBonus only on counter`);
      const cap = e.status === 'death' ? 0.2 : S.MULTI.includes(t.target) ? 0.3 : 0.6;
      ok(num(e.chance) && e.chance >= 0.2 && e.chance <= cap, `${t.id}: ${e.status} chance ${e.chance} in 0.2–${cap} (§6.2.5)`);
      ok(dmgs.length === 1, `${t.id}: status rides on damage (§6.2.4-C)`);
    } else if (e.type === 'buff') {
      buffs++;
      ok(S.BUFF_STATS.includes(e.stat), `${t.id}: buff stat ${e.stat} valid`);
      ok([-2, -1, 1, 2].includes(e.stages), `${t.id}: stages ${e.stages} is ±1/±2`);
      if (e.stages < 0 && enemySide) ok(e.chance === undefined || (num(e.chance) && e.chance >= 0.5 && e.chance <= 1), `${t.id}: debuff chance ${e.chance} in 0.5–1`);
      if (e.stages > 0) ok(!enemySide, `${t.id}: positive buff only on own side`);
      if (!enemySide) ok(e.chance === undefined, `${t.id}: own-side buff always succeeds`);
    } else if (e.type === 'cover') {
      ok(t.target === 'self' && num(e.mul) && e.mul > 0 && e.mul < 1, `${t.id}: cover on self with mul in (0,1) (${e.mul})`);
    } else if (e.type === 'heal' || e.type === 'healMp') {
      ok(!enemySide && num(e.pct) && e.pct > 0 && e.pct <= 1, `${t.id}: ${e.type} pct ${e.pct} on own side`);
    } else if (e.type === 'cure') {
      ok(!enemySide && Array.isArray(e.statuses) && e.statuses.length && e.statuses.every((s) => S.BAD_STATUSES.includes(s)), `${t.id}: cure lists bad statuses`);
    } else if (e.type === 'steal') {
      ok(enemySide && dmgs.length === 1, `${t.id}: steal rides on damage`);
    } else if (e.type === 'dispel') {
      ok(e.side === 'good' && enemySide, `${t.id}: dispel side:'good' on an enemy`);
    }
  }
  ok(buffs <= 2, `${t.id}: at most 2 buffs/debuffs (${buffs})`);
  // one tech never works on both sides (§6.2.5): own-side techs have no enemy effect and vice versa
  if (!enemySide) ok(t.effects.every((e) => !['damage', 'steal', 'dispel'].includes(e.type) && !(e.type === 'status' && e.status !== 'counter')), `${t.id}: own-side tech has only own-side effects`);
  else ok(t.effects.every((e) => !['heal', 'healMp', 'cure', 'cover'].includes(e.type) && !(e.type === 'status' && e.status === 'counter') && !(e.type === 'buff' && e.stages > 0)), `${t.id}: enemy tech has only enemy-side effects`);
  // stances and cover act first (§6.6: ［先制］)
  if (t.effects.some((e) => e.type === 'cover' || (e.type === 'status' && e.status === 'counter'))) ok(t.quick === true, `${t.id}: stance/cover is quick`);
  // stances and cover stand in front: reach:false on non-reaching types (§6.3.4)
  if (t.effects.some((e) => e.type === 'cover' || (e.type === 'status' && e.status === 'counter'))) ok(t.reach === WT[t.wtype].reach, `${t.id}: stance reach follows the weapon type`);
}
ok(techs.filter((t) => t.effects.some((e) => e.type === 'cover')).map((t) => t.id).join() === 't_sword_bulwark', 'cover exists once: 城壁の構え (§6.0 0.9)');

// ---------------------------------------------------------------- 8. §6.5 ratio
head('8 power ratio (§6.5)');
const ratios = [];
for (const t of techs) {
  const r = S.ratio(t, WT);
  if (!r) continue;
  const [lo, hi] = S.RATIO_BAND(t.glim.lv);
  ratios.push({ t, r: r.ratio });
  ok(r.ratio >= lo - 1e-9 && r.ratio <= hi + 1e-9, `${t.id}: ratio ${r.ratio.toFixed(3)} in ${lo}–${hi} (${r.parts.join(' ')} / G ${r.G})`);
}
const mean = ratios.reduce((a, x) => a + x.r, 0) / ratios.length;
const rmin = Math.min(...ratios.map((x) => x.r)), rmax = Math.max(...ratios.map((x) => x.r));
ok(ratios.length === 109, `109 techs with damage (${ratios.length}), 12 without (${techs.length - ratios.length})`);
ok(Math.abs(mean - 1.02) < 0.006 && Math.abs(rmin - 0.93) < 0.006 && Math.abs(rmax - 1.14) < 0.006,
  `ratio mean ${mean.toFixed(3)} / min ${rmin.toFixed(3)} / max ${rmax.toFixed(3)} = §6.5 (1.02 / 0.93 / 1.14)`);

// ---------------------------------------------------------------- §6.7.1 summary
head('§6.7.1 summary per weapon type');
// [total, single, multi, riders, support, reach, wpMin, wpMax, avgRatio]
const SUMMARY = {
  sword: [11, 6, 3, 0, 2, 1, 1, 13, 1.02], greatsword: [11, 6, 5, 4, 0, 1, 2, 14, 1.02], dagger: [11, 9, 2, 4, 0, 1, 1, 13, 1.02],
  axe: [11, 6, 4, 1, 1, 3, 1, 14, 1.02], spear: [11, 7, 3, 1, 1, 11, 1, 13, 1.02], bow: [11, 5, 6, 3, 0, 11, 1, 13, 1.01],
  club: [11, 8, 3, 10, 0, 0, 1, 13, 1.02], staff: [11, 4, 2, 3, 5, 11, 1, 13, 1.01], katana: [11, 9, 1, 3, 1, 1, 1, 12, 1.05],
  fist: [11, 8, 1, 2, 2, 2, 1, 12, 1.02], whip: [11, 6, 5, 8, 0, 11, 1, 13, 1.00],
};
const tot = [0, 0, 0, 0, 0, 0];
for (const w of S.WTYPES) {
  const list = techs.filter((t) => t.wtype === w);
  const c = list.map(S.classify);
  const rs = ratios.filter((x) => x.t.wtype === w).map((x) => x.r);
  const got = [list.length, c.filter((x) => x.single).length, c.filter((x) => x.multi).length, c.filter((x) => x.riders).length,
    c.filter((x) => x.support).length, c.filter((x) => x.reach).length, Math.min(...list.map((t) => t.wp)), Math.max(...list.map((t) => t.wp)),
    +(rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(2)];
  got.slice(0, 6).forEach((v, i) => { tot[i] += v; });
  ok(J(got) === J(SUMMARY[w]), `${w}: ${J(got)} = §6.7.1 ${J(SUMMARY[w])}`);
}
ok(J(tot) === J([121, 74, 35, 39, 12, 53]), `totals ${J(tot)} = §6.7.1 [121,74,35,39,12,53]`);

// ---------------------------------------------------------------- 9. banned names
head('9 banned names (STYLE_JA §7)');
ok(style.partial.length > 150 && style.exact.length > 30, `STYLE_JA §7 lists parsed (${style.partial.length} partial, ${style.exact.length} exact)`);
for (const t of techs) {
  const hitP = style.partial.filter((b) => t.name.includes(b));
  const hitE = style.exact.filter((b) => t.name === b);
  ok(hitP.length === 0 && hitE.length === 0, `${t.id}: 「${t.name}」 is not on the banned lists ${hitP.concat(hitE).join(' ')}`);
}
for (const w of S.WTYPES) ok(!style.exact.includes(WT[w].name) && !style.partial.some((b) => WT[w].name.includes(b)), `${w}: type name not banned`);

// ---------------------------------------------------------------- cross-area (full load)
if (!ISOLATED) {
  head('cross-area (full game load)');
  const F = require('./lib/load')({ quiet: true });
  const loadErr = (F._nodeLoadErrors || []).concat(F.loadErrors || []);
  if (loadErr.length) note(`${loadErr.length} load error(s) in other files (not A7): ` + loadErr.map((s) => String(s).split('\n')[0].split(':')[0]).join(', '));
  const FT = S.techList(F);
  ok(FT.length === 121 && J(FT.map((t) => t.id)) === J(S.ALL_IDS), 'full load: the 121 techs are intact and registered in the §6.1.2 order (weapontypes.js onData hook)');
  ok(FT.every((t) => J(t) === J(Object.assign({ id: t.id }, R.DB.actions[t.id]))), 'full load: every tech is identical to the isolated load (no other file touches t_ ids)');
  ok(J(Object.keys(F.DB.weaponTypes)) === J(S.WTYPES), 'full load: weaponTypes intact');
  // names: techs vs spells / enemy actions (this area's rule, §6.9.1-3 and §7.x request)
  const other = Object.entries(F.DB.actions).filter(([, a]) => a && a.kind !== 'tech');
  const techNames = new Map(FT.map((t) => [t.name, t.id]));
  const clashes = other.filter(([, a]) => techNames.has(a.name)).map(([id, a]) => `${techNames.get(a.name)}「${a.name}」= ${id}`);
  ok(clashes.length === 0, `tech names differ from spell / enemy action names (${other.length} other actions) ${clashes.join(', ')}`);
  // names vs items / monsters (validate V3, other owners' data: warn)
  const itemClash = Object.entries(F.DB.items || {}).filter(([, i]) => i && techNames.has(i.name)).map(([id, i]) => `${techNames.get(i.name)}「${i.name}」= item ${id}`);
  const monClash = Object.entries(F.DB.monsters || {}).filter(([, m]) => m && (techNames.has(m.name) || techNames.has(m.goldName))).map(([id, m]) => `monster ${id}「${m.name}」`);
  if (itemClash.length || monClash.length) note('name clash with items/monsters (validate V3): ' + itemClash.concat(monClash).join(', '));
  else ok(true, `no tech name equals an item (${Object.keys(F.DB.items || {}).length}) or monster (${Object.keys(F.DB.monsters || {}).length}) name`);
  // references to t_<wtype>_* ids from other areas
  const TRE = new RegExp('^t_(' + S.WTYPES.join('|') + ')_');
  const refs = [];
  const walk = (o, where, depth) => {
    if (depth > 6 || o == null) return;
    if (typeof o === 'string') { if (TRE.test(o)) refs.push([o, where]); return; }
    if (typeof o !== 'object') return;
    for (const k of Object.keys(o)) walk(o[k], where + '.' + k, depth + 1);
  };
  for (const reg of ['companions', 'heroTypes', 'starterKit', 'items', 'monsters', 'events', 'config']) walk(F.DB[reg], reg, 0);
  const missing = refs.filter(([id]) => !F.DB.actions[id] || F.DB.actions[id].kind !== 'tech');
  if (missing.length) note('other data refers to unknown tech ids: ' + missing.map(([id, w]) => `${id} @ ${w}`).join(', '));
  else ok(true, `${refs.length} references to t_* ids from other registries all resolve`);
  // starterKit.tech (newgame) = §6.1.3
  const sk = F.DB.starterKit && F.DB.starterKit.tech;
  if (sk && Object.keys(sk).length) {
    const bad = S.WTYPES.filter((w) => sk[w] !== S.STARTERS[w][0]);
    if (bad.length) note('DB.starterKit.tech differs from §6.1.3 for: ' + bad.map((w) => `${w}=${sk[w]}`).join(', '));
    else ok(true, 'DB.starterKit.tech maps each weapon type to its §6.1.3 starter');
  } else note('DB.starterKit.tech not loaded yet (newgame): starter mapping not checked');
  // companions' startTechs: the weapon type is equipped (§5.7-4, §6.9.2)
  const comps = F.DB.companions || {};
  const noWeapon = [];
  let unresolved = 0;
  for (const [cid, c] of Object.entries(comps)) {
    for (const tid of c.startTechs || []) {
      const t = F.DB.actions[tid];
      if (!t || t.kind !== 'tech') continue;
      const eq = c.startEquip || {};
      const slots = ['weapon1', 'weapon2'].filter((s) => eq[s]);
      if (slots.some((s) => !F.DB.items[eq[s]])) { unresolved++; continue; } // items not landed yet (validate V1)
      const wts = slots.map((s) => F.DB.items[eq[s]].wtype);
      if (!(wts.includes(t.wtype) || (!slots.length && t.wtype === 'fist'))) noWeapon.push(`${cid}:${tid}`);
    }
  }
  if (noWeapon.length) note('companion startTechs without a weapon of that type equipped (§5.7-4): ' + noWeapon.join(', '));
  else if (Object.keys(comps).length) ok(true, `companions' startTechs match their equipped weapon types (${unresolved} not checkable yet: weapon items not registered)`);
  // fx ids exist in the battle fx module once bui registers them (warn only)
  const FXM = F.BattleFX && (F.BattleFX.FX || null);
  if (FXM) {
    // an fx id is "kind + level digit" (slash3 = slash at level 3, battle_fx resolve())
    const used = [...new Set(FT.map((t) => t.fx).concat(S.WTYPES.map((w) => F.DB.weaponTypes[w].fx)))];
    const miss = used.filter((id) => !(id.replace(/\d+$/, '') in FXM));
    if (miss.length) note(`fx kinds not yet in R.BattleFX.FX (bui, §6.2.6 new ids; resolve() falls back to pierce/strike/buff): ${miss.join(' ')}`);
    else ok(true, `all ${used.length} fx ids used by techs resolve to an R.BattleFX.FX kind`);
  }
  // statuses / elements the techs name (spells A8: §6.10 asks for the good status `cover`)
  const ST = F.DB.statuses || {};
  if (Object.keys(ST).length) {
    const used = [...new Set(FT.flatMap((t) => t.effects.flatMap((e) => (e.type === 'status' ? [e.status] : e.type === 'cure' ? e.statuses : [])
      .concat(e.type === 'cover' ? ['cover'] : []))))].filter((s) => s !== 'death' || ST.death);
    const miss = used.filter((s) => !ST[s]);
    if (miss.length) note('statuses used by techs missing from DB.statuses (A8): ' + miss.join(' '));
    else ok(true, `every status the techs use is in DB.statuses (${used.join(' ')})`);
    if (ST.cover) ok(ST.cover.bad === false && ST.cover.turns === 'next', "DB.statuses.cover is a good status lasting to the next turn (§6.10)");
  } else note('DB.statuses not loaded yet (A8)');
  const EL = F.DB.elements || {};
  if (Object.keys(EL).length) {
    const used = [...new Set(FT.map((t) => (S.damageOf(t) || {}).element).filter(Boolean))];
    ok(used.every((e) => EL[e]), `damage elements are registered in DB.elements (${used.join(' ')})`);
  }
  // vs keys that name a race / flag find their monsters (mons A11 / boss A12: §6.10 asks for the flags)
  const MONS = Object.values(F.DB.monsters || {});
  if (MONS.length) {
    const keys = [...new Set(FT.flatMap((t) => Object.keys((S.damageOf(t) || {}).vs || {})))].filter((k) => !S.BAD_STATUSES.includes(k));
    const counts = keys.map((k) => [k, MONS.filter((m) => m.race === k || (m.flags || []).includes(k)).length]);
    const none = counts.filter(([, n]) => n === 0).map(([k]) => k);
    if (none.length) note('vs keys with no monster to hit yet: ' + none.join(' '));
    else ok(true, 'every race/flag vs key hits some monsters (' + counts.map(([k, n]) => `${k} ${n}`).join(', ') + ` of ${MONS.length})`);
  }
  // icons (art-chars)
  if (F.Gfx && F.Gfx.has) {
    const miss = S.WTYPES.filter((w) => !F.Gfx.has(F.DB.weaponTypes[w].icon));
    if (miss.length) note('weapon type icons not registered yet (art-chars §3.1.2): ' + miss.map((w) => 'icon:' + w).join(' '));
    else ok(true, 'all 11 icon:<wtype> graphics are registered');
  }
  // every tech used once in the real battle engine (A2's R.Battle; §6.2.4 / §6.3 / §6.9.1-10 as seen from the data)
  if (!argv.includes('--no-battle')) {
    let r;
    try { r = require('./fixtures/techs/lib/battle_probe').run(F, S, { trials: 16 }); } catch (e) { r = { skipped: 'battle probe threw: ' + String(e && e.stack || e).split('\n')[0], results: [] }; }
    if (r.skipped) note('battle probe skipped: ' + r.skipped);
    else {
      const bad = r.results.filter((x) => !x.ok);
      for (const x of bad) note(`battle (A2) ${x.id}: ${x.msg}`);
      if (VERBOSE) for (const x of r.results.filter((y) => y.ok)) console.log(`  ok   battle ${x.id}: ${x.msg}`);
      if (!bad.length) ok(true, `battle: all ${r.results.length} probes pass — each of the ${r.techs} techs works in R.Battle.Engine (targets, hits, WP, riders, stances, cover, heals, reach, silence, noAuto)`);
    }
  }
}

// ---------------------------------------------------------------- summary
console.log(`\ntest_techs: ${pass} passed, ${fail} failed, ${warn} warning(s)` +
  `  |  ${techs.length} techs, ${Object.keys(WT).length} weapon types, ratio mean ${mean.toFixed(3)} (min ${rmin.toFixed(3)}, max ${rmax.toFixed(3)})`);
if (fail) { console.log('\nFAILURES:\n' + failures.map((f) => '  ' + f).join('\n')); process.exitCode = 1; }
