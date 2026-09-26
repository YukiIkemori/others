#!/usr/bin/env node
// Spec-conformance check for area A9 (weapons): reads the weapon tables straight out of DESIGN.md and diffs every one of
// the 260 weapons against them (names, types, tiers, effects and quirks, units, numbers, prices, descs, droppers).
// SYSTEMS_REWORK §3.2 (A19) is applied to every row: a katana / club / fist / whip row names its new id (the save remap,
// src/data/remap_a19.js); a merged row's item must be gone; a kept row takes its §3.2 type, name, mult / kind / art and the
// crit / hit its type change adds, WP keys become their MP keys (§2.5), and its old series keeps deciding the units.
//   §8.4.1 (normal 120: names + atk/mag/price), §8.5 (band rare 59), §8.6.5 (hand-made super 10 + assignment),
//   §8.7.2 / §9.12.7 (fixed-tier super 2), §9.12.4 (monster super 79 + §8.6.5 rows), §9.12.5 (monster rare 31),
//   §9.12.6 (counts per weapon type), §9.12.8 (boss super), and every `w_…` id DESIGN.md mentions.
// Exit 1 on any difference that is not a documented deviation (fixtures/weapons/lib/spec.js SPEC_DEVIATIONS).
//
// D3 (every rare carries exactly 1 weak quirk): until DESIGN.md §8.5 / §9.12.5 carry the quirks, a rare whose table row
// has no quirk is accepted when its effects equal the row, it has exactly 1 §8.3.6 weak quirk and its desc is the table
// text + 「ただし〜」. `--rows` prints those rows in the table form for the DESIGN.md update.
//
//   node tools/check_weapons.js [-v] [--rows]
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./fixtures/weapons/lib/spec');

const VERBOSE = process.argv.includes('-v');
const ROWS = process.argv.includes('--rows');
const dev = { spec: [], name: [], d3: [], units: [] };   // deviations in effect (DESIGN.md not yet updated)
const d3Rows = [];
const MD = fs.readFileSync(path.join(S.ROOT, 'DESIGN.md'), 'utf8').split('\n');
let pass = 0, fail = 0;
const fails = [];
const ok = (c, m) => { if (c) { pass++; if (VERBOSE) console.log('  ok   ' + m); } else { fail++; fails.push(m); console.log('  FAIL ' + m); } return c; };
const J = (v) => JSON.stringify(v);
const canon = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? v.map(canon).sort() : Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))) : v);
const same = (a, b) => J(canon(a)) === J(canon(b));

const R = S.loadIsolated();
const DB = R.DB, WI = R.WeaponItems;
if (!WI) { console.log('R.WeaponItems missing'); process.exit(1); }

// ---------------------------------------------------------------- helpers
const JA_W = { 剣: 'sword', 大剣: 'greatsword', 短剣: 'dagger', 斧: 'axe', 槍: 'spear', 弓: 'bow', 棍棒: 'club', 杖: 'staff', 刀: 'katana', 体術: 'fist', 鞭: 'whip' };
const JA_S = { 腕力: 'str', 体力: 'vit', 器用さ: 'dex', 素早さ: 'agi', 知力: 'int', 精神: 'mnd' };
const cells = (l) => l.split('|').slice(1, -1).map((s) => s.trim());
const bt = (s) => s.replace(/`/g, '');
function sectionLines(startRe, endRe) {
  const a = MD.findIndex((l) => startRe.test(l));
  let b = MD.findIndex((l, i) => i > a && endRe.test(l));
  if (b < 0) b = MD.length;
  return MD.slice(a, b);
}
/** §8.5 の「`element:'wind'` `crit:10`」→ {element:'wind', crit:10}（— は {}） */
function frag(s) {
  const parts = [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const o = {};
  for (const p of parts) Object.assign(o, Function(`return ({${p}})`)());
  return o;
}
/** §9.12.2 の略記（独立に読む。items_weapons_monster.js の parse とは別の実装） */
function shorthand(str, T) {
  const o = {};
  const mods = () => (o.mods = o.mods || {});
  const mapPut = (k, sub, v) => { mods()[k] = Object.assign(mods()[k] || {}, { [sub]: v }); };
  for (const tok of String(str).trim().split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^el:(\w+)$/.exec(tok))) o.element = m[1];
    else if ((m = /^onHit:([a-z]+)(\d+)$/.exec(tok))) o.onHit = { status: m[1], chance: m[2] / 100 };
    else if (tok === 'metalHit') o.metalHit = true;
    else if ((m = /^boost:([a-z]+)(\d+)$/.exec(tok))) mapPut('elemBoost', m[1], +m[2]);
    else if ((m = /^res:([a-z]+)([\d.-]+)$/.exec(tok))) mapPut('elemResist', m[1], +m[2]);
    else if ((m = /^sres:([a-z]+)(\d+)$/.exec(tok))) mapPut('statusResist', m[1], m[2] / 100);
    else if ((m = /^glim:([a-z]+)(\d+)$/.exec(tok))) mapPut('glimPct', m[1], +m[2]);
    else if ((m = /^buff:([a-z]+)\+(\d)$/.exec(tok))) mapPut('startBuffs', m[1], +m[2]);
    else if ((m = /^imm:([a-z]+)$/.exec(tok))) mods().statusImmune = (mods().statusImmune || []).concat(m[1]);
    else if ((m = /^stat:([a-z]+)-(\d)u$/.exec(tok))) o.statsAdd = Object.assign(o.statsAdd || {}, { [m[1]]: -S.gearStat(T, +m[2]) });
    else if ((m = /^(crit|hit)([+-]\d+)$/.exec(tok))) o[m[1]] = +m[2];
    else if ((m = /^([a-zA-Z]+)([+-]\d+)$/.exec(tok))) mods()[m[1]] = +m[2];
    else throw new Error('unknown shorthand ' + tok);
  }
  return o;
}
/** §8.5 の書き方の組を品の形（武器の項目は品、ほかは mods）にする */
function toItemShape(fx) {
  const o = {};
  for (const [k, v] of Object.entries(fx)) {
    if (S.WEAPON_FIELDS.includes(k)) o[k] = v;
    else if (k === 'statsAdd') o.statsAdd = Object.assign(o.statsAdd || {}, v);
    else { o.mods = o.mods || {}; o.mods[k] = typeof v === 'object' && !Array.isArray(v) ? Object.assign(o.mods[k] || {}, v) : v; }
  }
  return o;
}
const mergeShape = (a, b) => {
  const o = JSON.parse(JSON.stringify(a));
  for (const [k, v] of Object.entries(b)) {
    if (k === 'mods') { o.mods = o.mods || {}; for (const [mk, mv] of Object.entries(v)) o.mods[mk] = typeof mv === 'object' && !Array.isArray(mv) ? Object.assign(o.mods[mk] || {}, mv) : Array.isArray(mv) ? [...new Set([...(o.mods[mk] || []), ...mv])] : mv; }
    else if (k === 'statsAdd') o.statsAdd = Object.assign(o.statsAdd || {}, v);
    else o[k] = v;
  }
  return o;
};
/** 品から効果の部分だけ（twoHanded は大剣・槍・弓の既定を除く。§3.2 の系統の変更で付いた crit / hit は除く） */
function effectShape(it) {
  const o = {};
  const adj = S.typeAdjust(it);
  for (const k of S.WEAPON_FIELDS) {
    if (it[k] === undefined || (k === 'twoHanded' && (S.TWO_HANDED.includes(it.wtype) || (S.KEPT[it._id] && S.TWO_HANDED.includes(it.wtype))))) continue;
    const v = (k === 'crit' || k === 'hit') && adj[k] ? it[k] - adj[k] : it[k];
    if (!((k === 'crit' || k === 'hit') && v === 0)) o[k] = v;
  }
  if (it.mods && Object.keys(it.mods).length) o.mods = it.mods;
  if (it.statsAdd) o.statsAdd = it.statsAdd;
  return o;
}
const statsFrom = (s) => {
  const o = {};
  for (const m of s.replace(/（.*?）/g, '').matchAll(/(腕力|体力|器用さ|素早さ|知力|精神)\+(\d+)/g)) o[JA_S[m[1]]] = +m[2];
  return o;
};
const withAdd = (st, add) => { const o = Object.assign({}, st); for (const [k, v] of Object.entries(add || {})) o[k] = (o[k] || 0) + v; return o; };
const statsEq = (a, b) => same(Object.fromEntries(Object.entries(a || {}).filter(([, v]) => v)), Object.fromEntries(Object.entries(b || {}).filter(([, v]) => v)));
const seen = new Set();
/** A19: the DESIGN row's id → the item now (merged rows: the item must be gone → null) */
const merged = [];
function nowOf(id) {
  const to = S.NOW(id);
  if (to === null) { ok(!DB.items[id], `${id}: merged by SYSTEMS_REWORK §3.2 (→ ${S.REMAP[id]}), gone`); merged.push(id); return null; }
  return to;
}
/** a table's effect shape after A18 (wpCostPct → techCostPct …) */
function a18(shape) {
  const o = JSON.parse(JSON.stringify(shape));
  if (o.mods) for (const [k, to] of Object.entries(S.A18_KEY)) if (k in o.mods) { o.mods[to] = o.mods[k]; delete o.mods[k]; }
  return o;
}
/** a table desc that SYSTEMS_REWORK §2.5 / §3.2 rewrote (WP, the removed types' words, 「術／技のMP」) */
const reworded = (desc) => /WP|鞭|爪|拳|MPの消費/.test(desc);
const typeOfNow = (id, tableW) => (S.KEPT[id] ? S.oldType(id) : tableW);
/** 表の名前（STYLE_JA に合わせて直した品は直した後の名前。表がもう直っていれば、そのまま） */
function tableName(id, name) {
  const d = S.NAME_DEVIATIONS[id];
  if (!d) return name;
  if (name === d[1]) { console.log(`  note ${id}: DESIGN.md already says ${d[1]}; NAME_DEVIATIONS can drop it`); return name; }
  ok(name === d[0], `${id}: the table name is ${d[0]} as recorded in NAME_DEVIATIONS (${name})`);
  console.log(`  note ${id}: name ${d[0]} → ${d[1]}（${d[2]}）`);
  dev.name.push(id);
  return d[1];
}

// ---------------------------------------------------------------- §8.4.1 通常品
console.log('## §8.4.1 normal weapons');
{
  const sec = sectionLines(/^#### 8\.4\.1 /, /^#### 8\.4\.2 /);
  const atkRows = sec.filter((l) => /^\| \d \| \d+\/\d+ \|/.test(l)).map(cells);
  ok(atkRows.length === 10, `§8.4.1 atk/mag table has 10 rows (${atkRows.length})`);
  const cols = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
  const nameRows = sec.filter((l) => /^\| `w_[a-z_]+_<T>`/.test(l)).map(cells);
  ok(nameRows.length === 12, `§8.4.1 name table has 12 series (${nameRows.length})`);
  const NEWLINE = { w_club: 'w_axe_mace' };   // §3.3: the club line is the axe's mace line; katana / fist / whip lines are merged
  for (const c of nameRows) {
    const oline = bt(c[0]).match(/^(w_[a-z_]+)_<T>/)[1];
    const owtype = JA_W[c[1]];
    const line = NEWLINE[oline] || oline;
    const L = S.LINES.find((x) => x.line === line);
    for (let T = 0; T <= 9; T++) {
      let id;
      if (!L) {   // katana / fist / whip: T0 打ち刀 is kept on its own line, the rest merged
        const oid = T === 0 ? { w_katana: 'w_katana_uchi', w_fist: 'w_fist_leather', w_whip: 'w_whip_leather' }[oline] : `${oline}_${T}`;
        id = nowOf(oid);
        if (!id) continue;
      } else id = S.normalId(L, T);
      const it = DB.items[id];
      seen.add(id);
      if (!ok(it, `${id} exists`)) continue;
      const wtype = it.wtype === owtype || S.KEPT[id] ? it.wtype : owtype;
      const [, m] = atkRows[T][1 + cols.indexOf(owtype)].split('/').map(Number);
      const a = Math.round(S.W[T] * S.expectMult(id, it.wtype));
      const price = +atkRows[T][12];
      ok(it.name === c[3 + T] && it.wtype === wtype && it.tier === T && it.grade === 'normal' && it.src === 'shop' && it.line === (L ? line : id),
        `${id} = ${c[3 + T]} ${wtype} T${T} (${it.name} ${it.wtype} T${it.tier} line ${it.line})`);
      ok(it.atk === a && it.mag === m && it.price === price, `${id} ${a}/${m} ${price} (${it.atk}/${it.mag} ${it.price})`);
      const st = Object.fromEntries([...it.units.matchAll(/([svdaim])(\d)/g)].map((x) => [{ s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' }[x[1]], x[2]]));
      const ability = c[2];   // 腕力×2 / 腕力・器用さ
      const want = ability.includes('×2') ? { [JA_S[ability.replace('×2', '')]]: '2' } : Object.fromEntries(ability.split('・').map((x) => [JA_S[x], '1']));
      ok(same(st, want), `${id} units ${it.units} match ${ability}`);
    }
  }
}

// ---------------------------------------------------------------- D3: 表にまだ無いレアのクセ
/** 表のクセが「—」のレア: 効果は表のとおり・§8.3.6 の弱いクセがちょうど 1 つ・desc は表の文 ＋「ただし〜」 */
function d3Pending(id, it, tableFx, tableDesc) {
  const { quirks } = S.classify(it);
  const qk = Object.keys(quirks);
  // the item without its quirk keys (quirk and effect never share a key on a rare)
  const eff = effectShape(it);
  for (const k of qk) {
    if (eff.mods && eff.mods[k] !== undefined) delete eff.mods[k];
    else delete eff[k];
  }
  if (eff.mods && !Object.keys(eff.mods).length) delete eff.mods;
  ok(same(eff, tableFx), `${id} D3: effects = table ${J(tableFx)} (${J(eff)})`);
  ok(qk.length === 1 && S.QCAP.rare[qk[0]] && S.QCAP.rare[qk[0]](quirks[qk[0]], it), `${id} D3: exactly 1 §8.3.6 weak quirk (${J(quirks)})`);
  if (tableDesc) {
    const flat = it.desc.replace('\n', ''), base = tableDesc.replace(/／/g, '');
    ok(flat.startsWith(base) && /^ただし[^。]+。$/.test(flat.slice(base.length)), `${id} D3: desc = table text + 「ただし〜」 (${J(it.desc)})`);
  }
  dev.d3.push(id);
  return quirks;
}
/** §8.5 の書き方（`key:value`）でクセを書く */
const fragOf = (q) => Object.entries(q).map(([k, v]) => '`' + k + ':' + (typeof v === 'object' ? JSON.stringify(v).replace(/"(\w+)":/g, '$1:') : v) + '`').join(' ');
const shortOf = (q) => Object.entries(q).map(([k, v]) => k === 'elemResist' ? Object.entries(v).map(([e, x]) => `res:${e}${x}`).join(' ')
  : k === 'statsAdd' ? Object.keys(v).map((x) => `stat:${x}-1u`).join(' ') : k === 'glimPct' ? Object.entries(v).map(([e, x]) => `glim:${e}${x}`).join(' ')
  : k === 'twoHanded' ? 'twoHanded' : `${k}${v > 0 ? '+' : ''}${v}`).join(' ');

// ---------------------------------------------------------------- §8.5 帯のレア・§8.6.5 手作りの超レア（同じ列の表）
function checkHandRow(c, grade, src, exclusive) {
  const [idc, name0, kind, T, am, ab, fxc, qc, price, desc] = c;
  const id = nowOf(bt(idc));
  if (!id) return;
  const it = DB.items[id];
  seen.add(id);
  if (!ok(it, `${id} exists`)) return;
  const name = S.NEW_NAMES[id] || name0;
  const wtype = S.KEPT[id] ? it.wtype : JA_W[kind.replace(/（.*?）/, '')];
  ok(it.name === name && it.wtype === wtype && it.tier === +T && it.grade === grade && it.src === src, `${id} = ${name} ${wtype} T${T} ${grade}/${src} (${it.name} ${it.wtype} T${it.tier} ${it.grade}/${it.src})`);
  if (exclusive) ok(it.exclusive === exclusive, `${id} exclusive ${exclusive} (${it.exclusive})`);
  const [a0, m] = am.split('/').map(Number);
  const a = S.KEPT[id] ? Math.round(S.W[+T] * S.expectMult(id, it.wtype)) : a0;
  ok(it.atk === a && it.mag === m && it.price === +price, `${id} ${a}/${m} ${price} (${it.atk}/${it.mag} ${it.price})`);
  ok(statsEq(it.stats, withAdd(statsFrom(ab), it.statsAdd)), `${id} stats ${ab} (${J(it.stats)})`);
  const fx = fxc === '—' ? {} : frag(fxc), q = qc === '—' ? {} : frag(qc);
  const want = a18(mergeShape(toItemShape(fx), toItemShape(q)));
  const sd = S.SPEC_DEVIATIONS[id];
  if (grade === 'rare' && qc === '—' && it.quirk) {
    // D3: the table has no quirk yet (the effect part still has to equal the table, with the §8.5 onHit fix of SPEC_DEVIATIONS)
    const tfx = toItemShape(fx);
    if (sd && tfx.onHit) tfx.onHit = it.onHit;
    const qq = d3Pending(id, it, tfx, desc);
    if (sd) { console.log(`  note ${id}: ${sd}`); dev.spec.push(id); }
    const fxOut = sd && it.onHit ? fxc.replace(/chance:[\d.]+/, 'chance:' + it.onHit.chance) : fxc;   // the row as the data has it (§8.3.5 fix)
    d3Rows.push(`| \`${id}\` | ${name} | ${kind} | ${T} | ${am} | ${ab} | ${fxOut} | ${fragOf(qq)} | ${price} | ${it.desc.replace('\n', '／')} |`);
    return;
  }
  if (sd && !same(effectShape(it), want)) { ok(true, `${id} documented deviation: ${sd}`); console.log(`  note ${id}: ${sd}`); dev.spec.push(id); }
  else {
    if (sd) console.log(`  note ${id}: DESIGN.md already matches; SPEC_DEVIATIONS can drop it`);
    ok(same(effectShape(it), want), `${id} effects+quirks ${J(want)} (${J(effectShape(it))})`);
  }
  ok(!!it.quirk === (qc !== '—'), `${id} quirk flag ${qc !== '—'} (${it.quirk})`);
  if (reworded(desc) && it.desc !== desc.replace(/／/g, '\n')) { ok(!/WP|鞭/.test(it.desc), `${id} desc reworded by SYSTEMS_REWORK §2.5 / §3.2, no WP / 鞭 (${J(it.desc)})`); dev.a19 = (dev.a19 || []).concat(id); }
  else ok(it.desc === desc.replace(/／/g, '\n'), `${id} desc = table text ${J(desc)} (${J(it.desc)})`);
}
console.log('## §8.5 band rares');
{
  const rows = sectionLines(/^### 8\.5 /, /^### 8\.6 /).filter((l) => /^\| `w_/.test(l)).map(cells);
  ok(rows.length === 59, `§8.5 lists 59 weapons (${rows.length}; 12 merged by §3.2)`);
  for (const c of rows) checkHandRow(c, 'rare', 'drop');
}
console.log('## §8.6.5 hand-made supers');
{
  const sec = sectionLines(/^#### 8\.6\.5 /, /^#### 8\.6\.6 /);
  const assign = {};
  for (const l of sec.filter((x) => x.startsWith('| ') && x.includes('→'))) for (const m of l.matchAll(/`(w_[a-z_]+)` → `([a-z0-9_]+)`/g)) assign[S.NOW(m[1]) || m[1]] = m[2];
  ok(Object.keys(assign).length === 10, `§8.6.5 assigns 10 weapons (${Object.keys(assign).length})`);
  const rows = sec.filter((l) => /^\| `w_/.test(l)).map(cells);
  ok(rows.length === 10, `§8.6.5 lists 10 weapons (${rows.length})`);
  for (const c of rows) checkHandRow(c, 'super', 'super', assign[S.NOW(bt(c[0])) || bt(c[0])]);
}
console.log('## §8.7.2 / §9.12.7 fixed-tier supers');
{
  const rows = sectionLines(/^#### 8\.7\.2 /, /^### 8\.8 /).filter((l) => /\| `w_/.test(l)).map(cells);
  ok(rows.length === 2, `§8.7.2 lists 2 weapons (${rows.length})`);
  const s127 = sectionLines(/^#### 9\.12\.7 /, /^#### 9\.12\.8 /);
  for (const c of rows) {
    const mon = bt(c[0]).split(' ')[0];
    const units = (c[6].match(/`([svdaim\d]+)`/) || [])[1];
    const row = [c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10]];
    checkHandRow(row, 'super', 'super', mon);
    const it = DB.items[S.NOW(bt(c[1]))];
    if (it) {
      ok(it.units === units, `${bt(c[1])} units ${units} (${it.units})`);
      // §9.12.7 の略記と §8.7.2 の表が同じ品を言っている
      const l = s127.find((x) => x.includes(bt(c[1])));
      const sh = l && l.match(new RegExp(bt(c[1]) + '` [^（]+（[^。]+。([^）]+)）'));
      if (ok(sh, `§9.12.7 has the shorthand of ${bt(c[1])}`)) {
        const [fx, q] = sh[1].split('｜').map((x) => x.replace(/^\s*Q:\s*/, '').trim());
        ok(same(effectShape(it), a18(mergeShape(shorthand(fx, it.tier), shorthand(q, it.tier)))), `${bt(c[1])} = §9.12.7 shorthand ${sh[1]}`);
      }
    }
  }
}

// ---------------------------------------------------------------- §9.12.4・§9.12.5
console.log('## §9.12.4 monster supers');
{
  const rows = sectionLines(/^#### 9\.12\.4 /, /^#### 9\.12\.5 /).filter((l) => /^\| `[a-z0-9_]+` \| `w_/.test(l)).map(cells);
  ok(rows.length === 88, `§9.12.4 has 88 weapon rows (79 + 9 of §8.6.5) (${rows.length})`);
  let n08 = 0;
  for (const c of rows) {
    const mon = bt(c[0]), id = nowOf(bt(c[1]));
    if (!id) continue;
    const it = DB.items[id];
    seen.add(id);
    if (!ok(it, `${id} exists`)) continue;
    ok(it.exclusive === mon && it.grade === 'super' && it.src === 'super' && it.tier === +c[4], `${id} exclusive ${mon}, super, T${c[4]} (${it.exclusive} T${it.tier})`);
    const nm = S.NEW_NAMES[id] || tableName(id, c[2]);
    ok(it.name === nm, `${id} name ${nm} (${it.name})`);
    if (c[3].includes('8.6.5')) continue;
    n08++;
    const owtype = c[3].replace('武器・', ''), wtype = S.KEPT[id] ? S.oldType(id) : owtype;
    ok(S.KEPT[id] ? S.oldType(S.KEPT[id]) === owtype : it.wtype === owtype, `${id} wtype ${owtype}${S.KEPT[id] ? ' → ' + it.wtype + ' (§3.2)' : ''} (${it.wtype})`);
    const [fx, q] = c[6].split('｜').map((x) => x.replace(/^\s*Q:\s*/, '').trim());
    const want = a18(mergeShape(shorthand(fx, it.tier), shorthand(q, it.tier)));
    ok(same(effectShape(it), want), `${id} = ${c[6]} (${J(effectShape(it))})`);
    ok(it.quirk === true, `${id} quirk:true`);
    if (S.UNITS_FIX[id]) {
      ok(it.units === S.UNITS_FIX[id] && it.units !== S.monsterWeaponUnits(owtype, mon), `${id} units ${S.UNITS_FIX[id]} (A10a.5: off the stat its quirk lowers; §8.6.2 gives ${S.monsterWeaponUnits(wtype, mon)}) (${it.units})`);
      console.log(`  note ${id}: units ${S.monsterWeaponUnits(owtype, mon)} → ${S.UNITS_FIX[id]}（A10a.5）`);
      dev.units.push(id);
    } else ok(it.units === S.monsterWeaponUnits(owtype, mon), `${id} units ${S.monsterWeaponUnits(owtype, mon)} by §8.6.2 (${it.units})`);
    void wtype;
    const price = Math.round(S.PRICE[it.tier] * 1.6 / 10) * 10 * 6;
    ok(it.price === price, `${id} price ${price} (${it.price})`);
    // desc: 効果・クセのどれも、長い形か短い形で書かれている
    for (const k of fx.split(/\s+/).concat(q.split(/\s+/))) {
      // 1 語の略記 → {key: value} 1 つ（mods の中身も 1 段に出す）→ §8.2.7 の [長い形, 短い形]
      let [key, val] = Object.entries(shorthand(k, it.tier)).flatMap(([kk, vv]) => (kk === 'mods' ? Object.entries(vv) : [[kk, vv]]))[0];
      key = S.A18_KEY[key] || key;
      const p = WI.phrase({ [key]: val }, false);
      const flat = it.desc.replace('\n', '');
      ok(flat.includes(p[0]) || flat.includes(p[1]), `${id} desc says「${p[0]}」for ${k} (${J(it.desc)})`);
    }
  }
  ok(n08 === 79, `79 of them are 08 items (${n08})`);
}
console.log('## §9.12.5 monster rares');
{
  const rows = sectionLines(/^#### 9\.12\.5 /, /^#### 9\.12\.6 /).filter((l) => /^\| `w_/.test(l)).map(cells);
  ok(rows.length === 31, `§9.12.5 has 31 weapon rows (${rows.length})`);
  for (const c of rows) {
    const id = nowOf(bt(c[0]));
    if (!id) continue;
    const it = DB.items[id];
    seen.add(id);
    if (!ok(it, `${id} exists`)) continue;
    const owtype = c[2].replace('武器・', ''), wtype = S.KEPT[id] ? it.wtype : owtype, mons = [...c[5].matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]);
    const nm = S.NEW_NAMES[id] || tableName(id, c[1]);
    ok(it.name === nm && it.wtype === wtype && it.tier === +c[3] && it.grade === 'rare' && it.src === 'mdrop', `${id} = ${nm} ${wtype} T${c[3]} rare/mdrop (${it.name})`);
    const [rfx, rq] = c[4].split('｜').map((x) => x.replace(/^\s*Q:\s*/, '').trim());
    if (!rq && it.quirk) {
      const qq = d3Pending(id, it, shorthand(rfx, it.tier), '');
      // desc: the effect sentences (long or short form) and the quirk, like §9.12.4
      for (const k of rfx.split(/\s+/).concat(shortOf(qq).split(/\s+/))) {
        const [key, val] = Object.entries(shorthand(k, it.tier)).flatMap(([kk, vv]) => (kk === 'mods' ? Object.entries(vv) : [[kk, vv]]))[0];
        const p = WI.phrase({ [key]: val });
        ok(it.desc.replace('\n', '').includes(p[0]) || it.desc.replace('\n', '').includes(p[1]), `${id} desc says「${p[0]}」for ${k} (${J(it.desc)})`);
      }
      d3Rows.push(`| \`${id}\` | ${c[1]} | ${c[2]} | ${c[3]} | ${rfx} ｜ Q: ${shortOf(qq)} | ${c[5]} |`);
    } else {
      ok(same(effectShape(it), a18(mergeShape(shorthand(rfx, it.tier), rq ? shorthand(rq, it.tier) : {}))), `${id} = ${c[4]} (${J(effectShape(it))})`);
      ok(!!it.quirk === !!rq, `${id} quirk flag ${!!rq} (${it.quirk})`);
    }
    ok(J(WI.MRARE_DROPPERS[id]) === J(mons), `${id} droppers ${mons.join(' ')} (${(WI.MRARE_DROPPERS[id] || []).join(' ')})`);
    ok(it.units === S.monsterWeaponUnits(owtype, mons[0]), `${id} units ${S.monsterWeaponUnits(owtype, mons[0])} (${it.units})`);
    ok(it.price === Math.round(S.PRICE[it.tier] * 1.6 / 10) * 10 * 3, `${id} price ×3 (${it.price})`);
  }
}
console.log('## §9.12.6 counts, §9.12.8 boss super');
{
  // §9.12.6's per-type counts → SYSTEMS_REWORK §3.2's table (normal / band rare / mdrop / super per type, 260)
  for (const [w, want] of Object.entries(S.COUNT_32)) {
    const of = (f) => WI.all().filter((id) => DB.items[id].wtype === w && f(DB.items[id])).length;
    const got = [of((it) => it.grade === 'normal'), of((it) => it.src === 'drop'), of((it) => it.src === 'mdrop'), of((it) => it.grade === 'super')];
    ok(J(got) === J(want), `§3.2 ${w}: ${J(want)} (${J(got)})`);
  }
  const b = sectionLines(/^#### 9\.12\.8 /, /^### 9\.13 /).find((l) => l.includes('w_sword_sr_echo'));
  ok(b && b.includes('b_valzard_echo') && DB.items.w_sword_sr_echo.exclusive === 'b_valzard_echo', '§9.12.8 w_sword_sr_echo is the super of b_valzard_echo');
}

// ---------------------------------------------------------------- DESIGN.md のすべての w_ id
console.log('## every w_ id in DESIGN.md');
{
  const all = new Set();
  for (const l of MD) for (const m of l.matchAll(/`(w_[a-z0-9_]+)`/g)) all.add(m[1]);
  const skip = (id) => /_$/.test(id) || /^w_(sword|greatsword|dagger|axe|spear|bow|club|staff|staff_prayer|katana|fist|whip)$/.test(id);
  const missing = [...all].filter((id) => !skip(id) && S.NOW(id) !== null && !DB.items[S.NOW(id)]);
  ok(missing.length === 0, `every weapon id DESIGN.md names exists under its SYSTEMS_REWORK §3.2 id (${all.size} ids; missing: ${missing.join(' ')})`);
  const unchecked = WI.all().filter((id) => !seen.has(id));
  ok(unchecked.length === 0, `every one of the 260 weapons was compared with a DESIGN.md row (${unchecked.join(' ')})`);
  console.log(`  info ${merged.length} DESIGN rows merged by §3.2; ${Object.keys(S.KEPT).length} katana / club / fist / whip weapons kept under new ids; ${(dev.a19 || []).length} descs reworded by §2.5 / §3.2`);
}

if (ROWS && d3Rows.length) console.log('\n## D3 rows for DESIGN.md (§8.5 then §9.12.5)\n' + d3Rows.join('\n'));
const nDev = dev.spec.length + dev.name.length + dev.d3.length;
console.log(`\ndeviations from DESIGN.md in effect: ${nDev} (SPEC_DEVIATIONS ${dev.spec.length}${dev.spec.length ? ' ' + dev.spec.join(' ') : ''}; NAME_DEVIATIONS ${dev.name.length}${dev.name.length ? ' ' + dev.name.join(' ') : ''}; D3 quirks not yet in the tables ${dev.d3.length}); A10a.5 units fixes ${dev.units.length}${dev.units.length ? ' ' + dev.units.join(' ') : ''}`);
console.log(`check_weapons: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:\n  ' + fails.slice(0, 40).join('\n  ')); process.exit(1); }
