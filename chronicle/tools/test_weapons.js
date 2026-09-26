#!/usr/bin/env node
// Self-check for area A9 (weapons): the 260 weapons of SYSTEMS_REWORK §3.2 (A19: 7 types; the DESIGN §8 tables translated
// with the save remap, spec.js) against DESIGN.md §8.14.1 (1–8) and the rules of §4.3 / §8.1–§8.7 / §9.12. Exit 1 on any failure.
//
//   node tools/test_weapons.js             isolated load (core + weapontypes.js + the 4 weapon files, numbers by the
//                                          local §8.2.9 fill), then the full game load (numbers by R.Rules.fillItem)
//                                          with the cross-area checks. The isolated load is repeated in reverse and
//                                          code-unit file order: the 301 weapons must come out identical (§1.2-2)
//   node tools/test_weapons.js --isolated  only the isolated part
//   node tools/test_weapons.js -v          list every check, not only failures
//
// Cross-area findings that are another owner's to fix (a monster whose drops name another item, a name clash with a
// monster or an action, a missing armor piece of a T8 set) are printed as WARN and do not fail the test.
'use strict';
const S = require('./fixtures/weapons/lib/spec');

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
const unitsOf = (u) => [...String(u || '').matchAll(/([svdaim])(\d)/g)].map((m) => [{ s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' }[m[1]], +m[2]]);
const expectStats = (it) => {
  const st = {};
  for (const [k, n] of unitsOf(it.units)) st[k] = S.gearStat(it.tier, n, it.grade);
  for (const [k, v] of Object.entries(it.statsAdd || {})) st[k] = (st[k] || 0) + v;
  return st;
};
const sameStats = (a, b) => { const ka = Object.keys(a || {}).filter((k) => a[k]), kb = Object.keys(b || {}).filter((k) => b[k]); return ka.length === kb.length && ka.every((k) => a[k] === b[k]); };
const statStr = (st) => Object.entries(st || {}).map(([k, v]) => `${k}:${v}`).join(',');
const parseStatStr = (s) => Object.fromEntries(s.split(',').map((x) => x.split(':')).map(([k, v]) => [k, +v]));

const STYLE = S.styleLists();
const JOYO = S.joyoSet();
const ALLOWED = new Set(STYLE.allowed.filter((t) => !t.includes('（')).map((t) => t[0]));
const ALLOWED_CTX = STYLE.allowed.filter((t) => t.includes('（')).map((t) => ({ ch: t[0], ctx: (t.match(/（(.+?)だけ）/) || [])[1] }));   // 叉（夜叉だけ）

function kanjiProblems(s) {
  if (!JOYO) return [];
  const bad = [];
  [...s].forEach((ch, i) => {
    if (!S.isKanji(ch) || JOYO.has(ch) || ALLOWED.has(ch)) return;
    const c = ALLOWED_CTX.find((a) => a.ch === ch);
    if (c && c.ctx && s.includes(c.ctx)) return;
    bad.push(ch);
  });
  return bad;
}

// =====================================================================================================
function checkWeapons(R, label, full) {
  const DB = R.DB, WI = R.WeaponItems;
  head(`${label}: load`);
  if (!ok(WI && WI.ids, 'R.WeaponItems is registered (the 4 weapon files loaded)')) return;
  const errs = (R._isolatedErrors || R._nodeLoadErrors || []).filter((e) => /items_weapons|weapons:/.test(e));
  ok(errs.length === 0, 'the weapon files load without errors ' + errs.join('; '));
  ok((WI.descProblems || []).length === 0, 'every generated desc fits (WeaponItems.descProblems is empty) ' + J(WI.descProblems));
  const ids = WI.all();
  const items = ids.map((id) => Object.assign({ _id: id }, DB.items[id]));
  const byId = Object.fromEntries(items.map((it) => [it._id, it]));
  const raw = R._raw || {};

  // ---------------------------------------------------------------- 1. 系列・id・数
  head(`${label}: 1 series, ids, counts (§8.1)`);
  for (const [g, n] of Object.entries(S.COUNTS)) if (g !== 'total') ok(WI.ids[g].length === n, `${g}: ${n} weapons (${WI.ids[g].length})`);
  ok(ids.length === S.COUNTS.total && new Set(ids).size === ids.length, `260 distinct weapon ids (${ids.length}, distinct ${new Set(ids).size})`);
  for (const w of S.WTYPES) {
    const of = (f) => items.filter((it) => it.wtype === w && f(it)).length;
    const got = [of((it) => it.grade === 'normal'), of((it) => it.src === 'drop'), of((it) => it.src === 'mdrop'), of((it) => it.grade === 'super')];
    ok(J(got) === J(S.COUNT_32[w]), `§3.2 ${w}: normal / band / mdrop / super = ${J(S.COUNT_32[w])} (${J(got)})`);
  }
  ok(items.every((it) => S.WTYPES.includes(it.wtype)), 'every weapon is one of the 7 types (A19)');
  const uchi = DB.items.w_sword_uchi;
  ok(uchi && uchi.grade === 'normal' && uchi.tier === 0 && uchi.line === 'w_sword_uchi' && uchi.src === 'shop' && uchi.units === 's1d1', 'w_sword_uchi 打ち刀: T0 normal, its own line, s1d1 (§3.2)');
  ok(ids.every((id) => DB.items[id] && DB.items[id].type === 'weapon'), 'every id is in DB.items with type weapon');
  for (const L of S.LINES) {
    for (let T = 0; T <= 9; T++) {
      const id = S.normalId(L, T), it = DB.items[id];
      if (!ok(it && WI.ids.normal.includes(id), `${L.line} T${T} exists as ${id}`)) continue;
      ok(it.name === S.NORMAL_NAMES[L.line][T], `${id} name ${S.NORMAL_NAMES[L.line][T]} (${it.name})`);
      ok(it.grade === 'normal' && it.tier === T && it.wtype === L.wtype && it.units === L.units && it.line === L.line && it.src === 'shop',
        `${id} grade/tier/wtype/units/line/src = normal/${T}/${L.wtype}/${L.units}/${L.line}/shop`);
      if (L.line === 'w_axe_mace') ok(it.kind === 'blunt' && it.art === 'club' && it.mult === 1.05 && it.hit === 10, `${id}: the mace line is blunt, art club, mult 1.05, hit +10 (§3.2)`);
    }
  }
  for (const [id, name] of Object.entries(S.STARTERS)) ok(DB.items[id] && DB.items[id].name === name && DB.items[id].tier === 0, `§5.1.4 starter ${id} = ${name}, T0`);
  if (full) for (const [id, name] of Object.entries(S.STARTERS_ARMOR)) if (!(DB.items[id] && DB.items[id].name === name)) note(`gear-a: §5.1.4 starter ${id} ${name} not in DB.items yet`);
  const idRule = (it) => {
    const id = it._id, w = it.wtype;
    if (it.grade === 'normal') return true;
    if (it.src === 'drop') return new RegExp(`^w_${w}_r[13579][km]?$`).test(id) || ['w_staff_r7b', 'w_staff_r9b', 'w_staff_prayer_r7', 'w_staff_prayer_r9'].includes(id);
    if (it.src === 'mdrop') return new RegExp(`^w_${w}_[a-z]+$`).test(id) && !/_r\d/.test(id) && !/_sr_/.test(id);
    return new RegExp(`^w_${w}_sr_[a-z_]+$`).test(id);
  };
  for (const it of items) ok(idRule(it), `${it._id} follows the §8.1.1 id form for ${it.grade}/${it.src}`);
  for (const T of [1, 3, 5, 7, 9]) {
    for (const w of S.WTYPES) ok(byId[`w_${w}_r${T}`] && byId[`w_${w}_r${T}`].tier === T && byId[`w_${w}_r${T}`].wtype === w, `band T${T} has a ${w} (w_${w}_r${T})`);
    ok(byId[`w_axe_r${T}m`] && byId[`w_axe_r${T}m`].art === 'club', `band T${T} has a mace (w_axe_r${T}m, §3.2)`);
    if (T >= 5) ok(byId[`w_sword_r${T}k`] && byId[`w_sword_r${T}k`].art === 'katana', `band T${T} has a katana sword (w_sword_r${T}k, §3.2)`);
    const n = items.filter((it) => it.src === 'drop' && it.tier === T).length;
    ok(n === S.BAND_PER_TIER[T], `band T${T} has ${S.BAND_PER_TIER[T]} weapons (${n})`);
  }
  for (const it of items) {
    ok(it.sort === it.tier * 100 + S.sortSeries(it) + ({ normal: 0, rare: 50, super: 70 })[it.grade],
      `${it._id} sort = tier×100 + series + grade offset (${it.sort})`);
    const srcOk = { normal: ['shop'], rare: ['drop', 'mdrop'], super: ['super'] }[it.grade];
    ok(srcOk && srcOk.includes(it.src), `${it._id} grade ${it.grade} has src ${it.src}`);
    ok(it.grade === 'super' ? !!it.exclusive : it.exclusive === undefined, `${it._id} exclusive only on super (${it.exclusive})`);
    ok(it.grade === 'normal' ? !!it.line : it.line === undefined, `${it._id} line only on normal`);
    ok(it.unique === undefined && it.only === undefined && it.gender === undefined, `${it._id} has no unique/only/gender`);
  }

  // ---------------------------------------------------------------- 2. 数値
  head(`${label}: 2 numbers after fillItem (§8.4.1, §8.5, §8.6.5, §8.7.2)`);
  for (const id of ids) {
    const r0 = raw[id];
    if (!r0) { ok(false, `${id} raw snapshot exists`); continue; }
    const bad = S.NUMERIC_FILLED.filter((k) => r0[k] !== undefined);
    ok(bad.length === 0, `${id}: the data file does not write ${bad.join(' ') || 'atk mag def mdef eva stats price'}`);
    ok(r0.grade === 'normal' && !(r0.line === 'w_axe_mace') ? r0.desc === undefined : typeof r0.desc === 'string', `${id}: desc ${r0.grade === 'normal' && r0.line !== 'w_axe_mace' ? 'left to fillItem/autoDesc' : 'written in the data'}`);
  }
  for (const it of items) {
    // atk = round(W × mult) with the §3.2 item mult (katana / mace 1.05, claws 0.85, whips on bows / spears 0.95); mag by type
    const e = { atk: Math.round(S.W[it.tier] * S.expectMult(it._id, it.wtype)), mag: S.ATK_TABLE[it.tier][it.wtype === 'staff' ? 'staff' : 'sword'].mag };
    ok(it.atk === e.atk && it.mag === e.mag, `${it._id} atk/mag ${e.atk}/${e.mag} (${it.atk}/${it.mag})`);
    const ov = S.override(it._id);
    if (S.KEPT[it._id]) ok(['mult', 'kind', 'art'].every((k) => ov[k] === undefined || it[k] === ov[k]), `${it._id} (was ${S.KEPT[it._id]}): §3.2 overrides ${J(ov)}`);
    const price = Math.round(S.PRICE[it.tier] * 1.6 / 10) * 10 * S.PRICE_MULT[it.grade];
    ok(it.price === price, `${it._id} price ${price} (${it.price})`);
    if (it.grade === 'normal') ok(it.price === S.ATK_TABLE[it.tier].price, `${it._id} price = §8.4.1 column ${S.ATK_TABLE[it.tier].price}`);
    if (it.grade === 'normal' && S.NORMAL_DESC_OK[it.line]) { ok(S.NORMAL_DESC_OK[it.line].test(it.desc), `${it._id} desc (written for the ${it.line} line) ${J(it.desc)}`); continue; }
    ok(sameStats(it.stats, expectStats(it)), `${it._id} stats ${statStr(expectStats(it))} (${statStr(it.stats)})`);
    if (it.grade === 'normal') {
      const wt = (DB.weaponTypes || {})[it.wtype] || {};
      const names = unitsOf(it.units).map(([k]) => ({ str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' })[k]);
      const want = `${wt.desc}\n${names.join('と')}が上がる。`;
      ok(it.desc === want, `${it._id} desc = weaponTypes desc + stat line (§8.2.7) ${J(it.desc)}`);
    }
  }
  for (const [id, [T, atk, mag, st, price]] of Object.entries(S.HAND_TABLE)) {
    const it = byId[id];
    if (!ok(it, `${id} (spec table) exists`)) continue;
    ok(it.tier === T && it.atk === atk && it.mag === mag && it.price === price && sameStats(it.stats, parseStatStr(st)),
      `${id} = table T${T} ${atk}/${mag} ${st} ${price} (T${it.tier} ${it.atk}/${it.mag} ${statStr(it.stats)} ${it.price})`);
  }
  ok(Object.keys(S.HAND_TABLE).length === 59, `the spec table covers 47 + 10 + 2 = 59 hand-made weapons (the 71 of DESIGN less the 12 merged) (${Object.keys(S.HAND_TABLE).length})`);

  // ---------------------------------------------------------------- 3. units
  head(`${label}: 3 units (§4.3.3, §8.3.2, §8.6.2)`);
  for (const it of items) {
    const us = unitsOf(it.units);
    ok(us.reduce((a, [, n]) => a + n, 0) === 2 && us.length >= 1, `${it._id} units total 2 (${it.units})`);
    const st = S.seriesType(it._id, it.wtype);   // a kept katana / club / fist / whip item keeps its old series (§3.2)
    const offWeight = us.filter(([k]) => !S.WEAPON_STATS[st].includes(k)).map(([k]) => k);
    if (it.grade === 'normal') ok(offWeight.length === 0, `${it._id} normal units only in ${S.WEAPON_STATS[st].join('/')} (${it.units})`);
    else ok(offWeight.length === 0 || it.quirk, `${it._id} off-type stats only with a quirk (${offWeight.join(' ')})`);
    if (it.src === 'mdrop' || (it.grade === 'super' && WI.MSUPER_DROPPER && WI.MSUPER_DROPPER[it._id])) {
      const mon = it.src === 'mdrop' ? (WI.MRARE_DROPPERS[it._id] || [])[0] : it.exclusive;
      const want = S.UNITS_FIX[it._id] || S.monsterWeaponUnits(st, mon);
      ok(it.units === want, `${it._id} §8.6.2 units ${want} from ${st}/${mon}${S.UNITS_FIX[it._id] ? ' (A10a.5 fix)' : ''} (${it.units})`);
    } else if (it.grade !== 'normal') {
      const want = it.wtype === 'staff' && /prayer/.test(it._id) ? 'm2' : S.SERIES_UNITS[st];
      // §8.3.4: 超レアの武器は 2 単位を系列の 1 つの能力値に寄せてよい（例 鞭 d2）
      const packed = it.grade === 'super' ? S.WEAPON_STATS[st].map((k) => ({ str: 's', vit: 'v', dex: 'd', agi: 'a', int: 'i', mnd: 'm' })[k] + '2') : [];
      ok(it.units === want || packed.includes(it.units), `${it._id} units follow the series (${want}${packed.length ? ' or ' + packed.join('/') : ''}) (${it.units})`);
    }
    if (it.statsAdd) {
      ok(Object.values(it.statsAdd).every((v) => v < 0) && it.quirk, `${it._id} statsAdd only negative and only on a quirk item`);
      // A10a.5: a lowered stat has no unit, so the detail never shows 「素早さ+」 next to 「ただし素早さが下がる」
      const onUnit = Object.keys(it.statsAdd).filter((k) => us.some(([u]) => u === k));
      ok(onUnit.length === 0 && Object.keys(it.statsAdd).every((k) => (it.stats || {})[k] < 0), `${it._id} statsAdd ${Object.keys(it.statsAdd).join(' ')} not on a unit and the final stat is negative (${statStr(it.stats)})`);
    }
  }

  // ---------------------------------------------------------------- 4. 特殊効果・クセ
  head(`${label}: 4 effects and quirks (§8.3.2–§8.3.6)`);
  let supers = 0, quirkless = 0;
  for (const it of items) {
    const { effects, quirks } = S.classify(it);
    const ne = Object.keys(effects).filter((k) => !(k === 'twoHanded')).length, nq = Object.keys(quirks).length;
    if (it.grade === 'normal') {
      const adj = S.typeAdjust(it);   // the mace line's hit +10 / 打ち刀's crit +8 are the type change, not effects (§3.2)
      const extra = S.WEAPON_FIELDS.filter((k) => it[k] !== undefined && !(k === 'twoHanded' && S.TWO_HANDED.includes(it.wtype)) && !((k === 'hit' || k === 'crit') && it[k] === adj[k]));
      ok(extra.length === 0 && !it.mods && !it.statsAdd && !it.quirk, `${it._id} normal: no special effect nor quirk ${extra.join(' ')}`);
      continue;
    }
    if (it.grade === 'rare') {
      const max = it.tier === 9 || it.src === 'mdrop' ? 3 : 1;
      ok(ne >= 1 && ne <= max, `${it._id} rare: 1–${max} effect key(s) (${ne}: ${Object.keys(effects).join(' ')})`);
      ok(nq === 1, `${it._id} rare: exactly 1 weak quirk (D3) (${nq}: ${Object.keys(quirks).join(' ')})`);
      ok(/ただし/.test(it.desc) && /ただし[^\n]*$/.test(it.desc) && it.desc.split('ただし').length === 2, `${it._id} rare: the desc ends with one 「ただし〜」 sentence (§8.2.7) ${J(it.desc)}`);
    } else {
      supers++; if (!nq) quirkless++;
      ok(ne >= 1 && ne <= 3, `${it._id} super: 1–3 effect keys (${ne}: ${Object.keys(effects).join(' ')})`);
      if (S.TWO_QUIRKS_OK[it._id]) ok(nq === 2, `${it._id} super: the 2 quirks of the §9.12.4 row (${S.TWO_QUIRKS_OK[it._id]})`);
      else ok(nq <= 1, `${it._id} super: 0–1 quirk (${nq}: ${Object.keys(quirks).join(' ')})`);
    }
    ok(!!it.quirk === nq > 0, `${it._id} quirk:true exactly when it has a quirk (${it.quirk}, ${nq})`);
    const cap = S.CAP[it.grade], qcap = S.QCAP[it.grade];
    for (const [k, v] of Object.entries(effects)) ok(cap[k] && cap[k](v, it), `${it._id} effect ${k}=${J(v)} within the §8.3.5 ${it.grade} cap`);
    for (const [k, v] of Object.entries(quirks)) ok(qcap[k] && qcap[k](v, it), `${it._id} quirk ${k}=${J(v)} is a §8.3.6 ${it.grade} quirk within range`);
  }
  ok(quirkless <= Math.floor(supers * 0.2), `quirk-less super weapons ≤ 20% (${quirkless}/${supers})`);

  // ---------------------------------------------------------------- 5. 両手持ち
  head(`${label}: 5 twoHanded (§8.2.2, §8.3.6)`);
  for (const it of items) {
    if (S.TWO_HANDED.includes(it.wtype)) ok(it.twoHanded === true, `${it._id} (${it.wtype}) twoHanded`);
    else ok(!it.twoHanded || (it.quirk && raw[it._id] && raw[it._id].twoHanded === true), `${it._id} (${it.wtype}) twoHanded only as a quirk`);
  }

  // ---------------------------------------------------------------- 6. 名前・説明
  head(`${label}: 6 names and descs (§1.7, STYLE_JA §1 §2 §4 §7)`);
  const names = new Map();
  for (const it of items) {
    ok(typeof it.name === 'string' && it.name.length > 0 && S.width(it.name) <= 9, `${it._id} name ≤ 9 wide (${it.name} ${S.width(it.name)})`);
    ok(!names.has(it.name), `${it._id} name ${it.name} unique among weapons ${names.get(it.name) || ''}`);
    names.set(it.name, it._id);
    const part = STYLE.partial.find((w) => it.name.includes(w));
    ok(!part, `${it._id} ${it.name} has no STYLE_JA §7.1 word ${part || ''}`);
    ok(!STYLE.exact.includes(it.name), `${it._id} ${it.name} is not a STYLE_JA §7.2 name`);
    const kn = kanjiProblems(it.name + it.desc);
    ok(kn.length === 0, `${it._id} name/desc use only 常用 + STYLE_JA §2 kanji ${kn.join('')}`);
    const lines = String(it.desc || '').split('\n');
    ok(it.desc && lines.length <= 2 && lines.every((l) => S.width(l) <= 20 && l.length > 0), `${it._id} desc 2 lines × 20 (${lines.map((l) => S.width(l)).join('/')}) ${J(it.desc)}`);
    ok(lines.every((l) => /[。！]$/.test(l)), `${it._id} every desc line ends a sentence`);
    ok(!/(眠り|まひ|沈黙|混乱|気絶|凍結|暗闇|やけど)にする|にならない|…(?!…)/.test(it.desc), `${it._id} desc avoids STYLE_JA §4 forbidden forms`);
    ok(!/\s/.test(it.desc.replace(/\n/g, '')), `${it._id} desc has no spaces`);
  }
  if (!JOYO) note('tools/lib/joyo.txt missing: kanji check skipped');

  // ---------------------------------------------------------------- 7. キー
  head(`${label}: 7 keys (§3.3.16, §8.2)`);
  for (const it of items) {
    const top = Object.keys(it).filter((k) => k !== '_id' && !S.ITEM_KEYS.includes(k));
    ok(top.length === 0, `${it._id} has only §8.2 item fields ${top.join(' ')}`);
    const mk = Object.keys(it.mods || {}).filter((k) => !S.MOD_KEYS.includes(k));
    ok(mk.length === 0, `${it._id} mods keys are §3.3.16 keys ${mk.join(' ')}`);
    const m = it.mods || {};
    if (it.element !== undefined) ok(S.ELEMENTS.includes(it.element), `${it._id} element ${it.element}`);
    if (it.onHit) ok(S.STATUSES.includes(it.onHit.status) && typeof it.onHit.chance === 'number' && Object.keys(it.onHit).length === 2, `${it._id} onHit {status, chance} ${J(it.onHit)}`);
    if (it.vs) ok(Object.keys(it.vs).every((k) => S.RACES.includes(k) || S.VS_FLAGS.includes(k)), `${it._id} vs keys are races/flags ${J(it.vs)}`);
    for (const k of ['elemResist', 'elemBoost']) if (m[k]) ok(Object.keys(m[k]).every((e) => S.ELEMENTS.includes(e)), `${it._id} ${k} keys are elements`);
    if (m.statusImmune) ok(Array.isArray(m.statusImmune) && m.statusImmune.every((s) => S.STATUSES.includes(s)), `${it._id} statusImmune`);
    if (m.statusResist) ok(Object.keys(m.statusResist).every((s) => S.STATUSES.includes(s)), `${it._id} statusResist keys`);
    if (m.glimPct) ok(Object.keys(m.glimPct).every((k) => ['tech', 'spell', ...S.WTYPES, ...S.ELEMENTS].includes(k)), `${it._id} glimPct keys`);
    if (m.startBuffs) ok(Object.keys(m.startBuffs).every((k) => S.BUFF_STATS.includes(k)), `${it._id} startBuffs keys ${J(m.startBuffs)}`);
    for (const k of ['drain', 'crit', 'hit']) if (it[k] !== undefined) ok(typeof it[k] === 'number', `${it._id} ${k} is a number`);
    for (const k of ['sealTech', 'metalHit', 'twoHanded']) if (it[k] !== undefined) ok(it[k] === true, `${it._id} ${k} is true`);
    if (full && DB.statuses && Object.keys(DB.statuses).length && it.onHit) ok(DB.statuses[it.onHit.status], `${it._id} onHit status ${it.onHit.status} is in DB.statuses`);
  }

  // ---------------------------------------------------------------- 超レアの一品物・魔物のレア品のティア（§8.6.1）
  head(`${label}: tiers from srTier / band (§8.6.1, §9.12.1)`);
  const excl = new Map();
  for (const it of items.filter((x) => x.grade === 'super')) {
    ok(!excl.has(it.exclusive), `${it._id} exclusive ${it.exclusive} is not shared with ${excl.get(it.exclusive) || ''}`);
    excl.set(it.exclusive, it._id);
    if (S.HAND_EXCLUSIVE[it._id]) ok(it.exclusive === S.HAND_EXCLUSIVE[it._id], `${it._id} exclusive = §8.6.5/§8.7.2 ${S.HAND_EXCLUSIVE[it._id]} (${it.exclusive})`);
    if (/^(b_|rm_)/.test(it.exclusive)) { ok(it.tier === (it.exclusive === 'rm_golden_quill' ? 8 : 9), `${it._id} fixed tier (${it.tier})`); continue; }
    const t = S.srTier(it.exclusive);
    ok(t === it.tier, `${it._id} tier = srTier(${it.exclusive}) ${t} (${it.tier})`);
  }
  for (const it of items.filter((x) => x.src === 'mdrop')) {
    const mons = WI.MRARE_DROPPERS[it._id] || [];
    ok(mons.length >= 1 && mons.length <= 3, `${it._id} dropped by 1–3 monsters (${mons.join(' ')})`);
    for (const m of mons) ok(S.band(S.srTier(m)) === it.tier, `${it._id} tier = band(srTier(${m})) ${S.band(S.srTier(m))} (${it.tier})`);
  }

  // ---------------------------------------------------------------- 8. 一式・倍率
  head(`${label}: 8 T8 super sets, rare bands, §8.13.1 multipliers`);
  for (const [k, set] of Object.entries(S.SETS_T8)) {
    for (const id of [set.w1, set.w2]) {
      const it = byId[id];
      ok(it && it.grade === 'super' && it.tier === 8 && unitsOf(it.units).some(([s]) => s === set.stat), `${k} set weapon ${id}: T8 super on ${set.stat}`);
    }
    if (full) {
      const armor = [set.shield, set.head, set.body, set.hands, set.feet, ...set.acc];
      const slots = ['shield', 'head', 'body', 'hands', 'feet', 'acc', 'acc'];
      const missing = armor.filter((id) => !DB.items[id]);
      if (missing.length) note(`gear-a: ${k} T8 set pieces not in DB.items yet: ${missing.join(' ')}`);
      else armor.forEach((id, i) => ok(DB.items[id].type === slots[i] && DB.items[id].tier === 8 && DB.items[id].grade === 'super', `${k} set ${id} is a T8 super ${slots[i]}`));
    }
    // §8.3.4・§8.0 の 0.9: 1 つの一式の中で physPct + magicPct は +30 まで、mag は +16 まで（武器 2 本 + gear-a の 7 品）
    const pieces = [set.w1, set.w2, set.shield, set.head, set.body, set.hands, set.feet, ...set.acc].map((id) => DB.items[id]).filter(Boolean);
    const sum = (f) => pieces.reduce((a, it) => a + f((it && it.mods) || {}), 0);
    const pm = sum((m) => Math.max(0, m.physPct || 0) + Math.max(0, m.magicPct || 0)), mg = sum((m) => Math.max(0, m.mag || 0));
    ok(pm <= 30 && mg <= 16, `${k} T8 set (${pieces.length}/9 pieces loaded): physPct + magicPct ${pm} ≤ 30, mag ${mg} ≤ 16`);
  }
  const ratio = (k) => {
    const set = S.SETS_T8[k], N = S.SETS_N[k];
    const stOf = (id, fallback) => { const it = DB.items[id]; return it && it.stats ? (it.stats[set.stat] || 0) : fallback; };
    const armorS = [set.shield, set.head, set.body, set.hands, set.feet, ...set.acc].reduce((a, id) => a + stOf(id, id === set.body ? 30 : 15), 0);
    const armorN = [N.shield, N.head, N.body, N.hands, N.feet, N.acc, N.acc].reduce((a, id) => a + stOf(id, id === N.body ? 10 : 5), 0);
    const w1 = byId[set.w1], w2 = byId[set.w2], wn = DB.items[N.w];
    const base = S.BASE_8131[k];
    const sN = base + armorN + 2 * (wn.stats[set.stat] || 0), sS = base + armorS + (w1.stats[set.stat] || 0) + (w2.stats[set.stat] || 0);
    const W = k === 'int' ? Math.max(w1.mag, w2.mag) : w1.atk, Wn = k === 'int' ? wn.mag : wn.atk;
    ok(W === Wn, `${k}: the S weapon power equals the T8 normal weapon (${W} vs ${Wn}; §4.3.2 rarity does not raise W)`);
    return [S.power(Wn, base), S.power(Wn, sN), S.power(W, sS)];
  };
  for (const k of ['int', 'str', 'dex']) {
    const [z, n, s] = ratio(k), e = S.EXPECT_8131[k];
    ok(z === e[0] && n === e[1] && s === e[2], `§8.13.1 ${k}: Z/N/S = ${e.join('/')} (${z}/${n}/${s})`);
    const sz = s / z, sn = s / n;
    ok(sz >= S.RATIO_OK.sz[0] && sz <= S.RATIO_OK.sz[1] && sn >= S.RATIO_OK.sn[0] && sn <= S.RATIO_OK.sn[1], `§4.17.3 D1/D2 ${k}: S/Z ${sz.toFixed(2)} in 2.4–2.7, S/N ${sn.toFixed(2)} in 1.6–1.75`);
    if (VERBOSE || !full) console.log(`  info ${label} §8.13.1 ${k}: Z ${z} / N ${n} / S ${s}  S/Z ${sz.toFixed(3)}  S/N ${sn.toFixed(3)}`);
  }
  return { items, byId };
}

// =====================================================================================================
function crossArea(R, mine) {
  const DB = R.DB, WI = R.WeaponItems;
  head('full: cross-area');
  // 数値: rules の fillItem で埋めた結果が、localFill と同じ（上の 2 で表と比べた）ことの確認に、rules があるかを出す
  console.log(`  info R.Rules.fillItem ${R.Rules && typeof R.Rules.fillItem === 'function' ? 'present (numbers above came from it)' : 'absent (local fill used)'}; R.Rules.autoDesc ${R.Rules && typeof R.Rules.autoDesc === 'function' ? 'present' : 'absent'}`);
  // ほかの担当が武器を作っていない
  const stray = Object.entries(DB.items).filter(([id, it]) => it && it.type === 'weapon' && !mine.byId[id]).map(([id]) => id);
  ok(stray.length === 0, `no weapon in DB.items outside the 260 (${stray.join(' ')})`);
  // 名前の重なり（品どうしは失敗、魔物・行動とは WARN）
  const myNames = new Map(mine.items.map((it) => [it.name, it._id]));
  for (const [id, it] of Object.entries(DB.items)) if (it && !mine.byId[id] && myNames.has(it.name)) ok(false, `item name ${it.name} of ${id} clashes with ${myNames.get(it.name)}`);
  for (const [reg, list] of [['monster', DB.monsters], ['action', DB.actions]]) {
    for (const [id, x] of Object.entries(list || {})) for (const n of [x && x.name, x && x.goldName]) if (n && myNames.has(n)) note(`${reg} ${id} name ${n} clashes with weapon ${myNames.get(n)}`);
  }
  // 魔物のドロップ（§9.12 の割り当ては A11・A12 のデータ）
  const monsters = DB.monsters || {};
  if (!Object.keys(monsters).length) { note('DB.monsters empty: drop cross-check skipped'); return; }
  const refs = {};
  for (const [mid, m] of Object.entries(monsters)) for (const slot of ['normal', 'rare', 'super', 'bonus']) {
    const d = m && m.drops && m.drops[slot];
    if (d && d.item && /^w_/.test(d.item)) (refs[d.item] = refs[d.item] || []).push([mid, slot]);
  }
  for (const [id, at] of Object.entries(refs)) {
    if (!DB.items[id]) note(`monster drops name an unknown weapon ${id} (${at.map((a) => a.join('.')).join(' ')})`);
  }
  let okSuper = 0, okRare = 0;
  for (const it of mine.items) {
    const at = refs[it._id] || [];
    if (it.grade === 'super') {
      const want = it.exclusive;
      if (!monsters[want]) { note(`${it._id}: exclusive monster ${want} not in DB.monsters yet`); continue; }
      const sup = at.filter(([, s]) => s === 'super').map(([m]) => m);
      if (J(sup) === J([want]) && at.length === 1) okSuper++;
      else note(`${it._id}: expected only ${want}.drops.super, found ${at.map((a) => a.join('.')).join(' ') || 'none'}`);
    } else if (it.src === 'mdrop') {
      const want = (WI.MRARE_DROPPERS[it._id] || []).slice().sort();
      const got = at.filter(([, s]) => s === 'rare').map(([m]) => m).sort();
      if (J(want) === J(got) && at.length === got.length) okRare++;
      else note(`${it._id}: expected rare slot of ${want.join(' ')}, found ${at.map((a) => a.join('.')).join(' ') || 'none'}`);
    } else if (at.length) note(`${it._id} (${it.src}) is in a monster drop slot ${at.map((a) => a.join('.')).join(' ')} (§8.14.2-3: band rares and shop items are not monster drops)`);
  }
  console.log(`  info monster drops agree for ${okSuper}/${mine.items.filter((x) => x.grade === 'super').length} super and ${okRare}/${mine.items.filter((x) => x.src === 'mdrop').length} monster-rare weapons`);
  // 系統のデータから srTier を計算し直す（§9.12.1）
  if (DB.lineages && Object.keys(DB.lineages).length) {
    const lin = Object.fromEntries(Object.entries(DB.lineages).map(([k, v]) => [k, (v.stages || []).map((s) => s.tier)]));
    let n = 0;
    for (const it of mine.items) {
      const mons = it.grade === 'super' ? [it.exclusive] : it.src === 'mdrop' ? WI.MRARE_DROPPERS[it._id] : [];
      for (const m of mons) {
        if (/^(b_|rm_)/.test(m)) continue;
        const t = S.srTier(m, lin);
        const want = it.grade === 'super' ? t : S.band(t);
        if (want === it.tier) n++; else note(`${it._id}: DB.lineages gives ${it.grade === 'super' ? 'srTier' : 'band'}(${m}) = ${want}, item tier ${it.tier}`);
      }
    }
    console.log(`  info DB.lineages srTier/band agree for ${n} monster links`);
  }
  // 杖の units（§8.6.2）の元の種族: このファイルの §9.5.1 の表と、魔物のデータの race が同じか
  let nr = 0;
  for (const it of mine.items.filter((x) => x.wtype === 'staff' && (x.src === 'mdrop' || (WI.MSUPER_DROPPER || {})[x._id]))) {
    const mon = it.src === 'mdrop' ? WI.MRARE_DROPPERS[it._id][0] : it.exclusive;
    const race = monsters[mon] && monsters[mon].race;
    if (!race) { note(`${it._id}: ${mon} has no race in DB.monsters yet`); continue; }
    const want = (WI.RACE_STATS[race] || [])[0] === 'mnd' ? 'm2' : 'i2';
    if (want === it.units && race === WI.LINEAGE_RACE[S.lineageOf(mon)]) nr++;
    else note(`${it._id}: DB.monsters.${mon}.race = ${race} gives units ${want}, the item has ${it.units}`);
  }
  console.log(`  info DB.monsters race agrees with the staff units for ${nr} monster staves`);
  // 店とプール（A10b）: 通常品は店、帯のレアは p_rare・p_boss（WARN だけ）
  const pools = DB.pools || {};
  if (pools.p_rare && pools.p_rare.tiers) {
    const inRare = new Set(pools.p_rare.tiers.flat().map((e) => e.item));
    const missing = mine.items.filter((it) => it.src === 'drop' && !inRare.has(it._id)).map((it) => it._id);
    if (missing.length) note(`p_rare lacks band rares ${missing.join(' ')}`); else console.log('  info p_rare has all 47 band-rare weapons');
  }
}

// =====================================================================================================
/** §1.2-2・§8.1.4: 武器は 4 ファイル。どの順で読んでも同じ 260 本になる（読み込み時にほかのファイルのコードを使わない） */
function loadOrder(RI) {
  head('isolated: files and load order (§1.2-2, §8.1.4)');
  const fs = require('fs'), path = require('path');
  const mine = fs.readdirSync(path.join(S.ROOT, 'src', 'data')).filter((f) => /^items_weapons.*\.js$/.test(f)).sort();
  ok(JSON.stringify(mine) === JSON.stringify(S.MY_FILES.slice().sort()), `the weapon data files are the 4 of §8.1.4 (${mine.join(' ')})`);
  const snap = (R) => JSON.stringify(Object.fromEntries(R.WeaponItems.all().map((id) => [id, R.DB.items[id]])));
  const base = snap(RI);
  for (const order of ['reverse', 'codeunit']) {
    const RO = S.loadIsolated({ order });
    const errs = (RO._isolatedErrors || []).filter((e) => /items_weapons|weapons:/.test(e));
    ok(errs.length === 0, `load order ${order}: no load errors ${errs.join('; ')}`);
    ok(RO.WeaponItems && RO.WeaponItems.all().length === 260 && snap(RO) === base, `load order ${order}: the same 260 weapons as the localeCompare order`);
  }
}

const RI = S.loadIsolated();
checkWeapons(RI, 'isolated', false);
loadOrder(RI);
if (!ISOLATED) {
  const RF = S.loadFull();
  const mine = checkWeapons(RF, 'full', true);
  if (mine) crossArea(RF, mine);
}

console.log(`\ntest_weapons: ${pass} passed, ${fail} failed, ${warn} warnings`);
if (fail) { console.log('FAILURES:\n  ' + failures.slice(0, 60).join('\n  ') + (failures.length > 60 ? `\n  … ${failures.length - 60} more` : '')); process.exit(1); }
