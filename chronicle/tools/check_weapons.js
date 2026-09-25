#!/usr/bin/env node
// Spec-conformance check for area A9 (weapons): reads the weapon tables straight out of DESIGN.md and diffs every one of
// the 301 weapons against them (names, types, tiers, effects and quirks, units, numbers, prices, descs, droppers).
//   §8.4.1 (normal 120: names + atk/mag/price), §8.5 (band rare 59), §8.6.5 (hand-made super 10 + assignment),
//   §8.7.2 / §9.12.7 (fixed-tier super 2), §9.12.4 (monster super 79 + §8.6.5 rows), §9.12.5 (monster rare 31),
//   §9.12.6 (counts per weapon type), §9.12.8 (boss super), and every `w_…` id DESIGN.md mentions.
// Exit 1 on any difference that is not a documented deviation (fixtures/weapons/lib/spec.js SPEC_DEVIATIONS).
//
//   node tools/check_weapons.js [-v]
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./fixtures/weapons/lib/spec');

const VERBOSE = process.argv.includes('-v');
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
/** 品から効果の部分だけ（twoHanded は大剣・槍・弓の既定を除く） */
function effectShape(it) {
  const o = {};
  for (const k of S.WEAPON_FIELDS) if (it[k] !== undefined && !(k === 'twoHanded' && S.TWO_HANDED.includes(it.wtype))) o[k] = it[k];
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
/** 表の名前（STYLE_JA に合わせて直した品は直した後の名前。表がもう直っていれば、そのまま） */
function tableName(id, name) {
  const d = S.NAME_DEVIATIONS[id];
  if (!d) return name;
  if (name === d[1]) { console.log(`  note ${id}: DESIGN.md already says ${d[1]}; NAME_DEVIATIONS can drop it`); return name; }
  ok(name === d[0], `${id}: the table name is ${d[0]} as recorded in NAME_DEVIATIONS (${name})`);
  console.log(`  note ${id}: name ${d[0]} → ${d[1]}（${d[2]}）`);
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
  for (const c of nameRows) {
    const line = bt(c[0]).match(/^(w_[a-z_]+)_<T>/)[1];
    const wtype = JA_W[c[1]];
    const L = S.LINES.find((x) => x.line === line);
    for (let T = 0; T <= 9; T++) {
      const id = S.normalId(L, T), it = DB.items[id];
      seen.add(id);
      if (!ok(it, `${id} exists`)) continue;
      const [a, m] = atkRows[T][1 + cols.indexOf(wtype)].split('/').map(Number);
      const price = +atkRows[T][12];
      ok(it.name === c[3 + T] && it.wtype === wtype && it.tier === T && it.grade === 'normal' && it.src === 'shop' && it.line === line,
        `${id} = ${c[3 + T]} ${wtype} T${T} (${it.name} ${it.wtype} T${it.tier})`);
      ok(it.atk === a && it.mag === m && it.price === price, `${id} ${a}/${m} ${price} (${it.atk}/${it.mag} ${it.price})`);
      const st = Object.fromEntries([...it.units.matchAll(/([svdaim])(\d)/g)].map((x) => [{ s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' }[x[1]], x[2]]));
      const ability = c[2];   // 腕力×2 / 腕力・器用さ
      const want = ability.includes('×2') ? { [JA_S[ability.replace('×2', '')]]: '2' } : Object.fromEntries(ability.split('・').map((x) => [JA_S[x], '1']));
      ok(same(st, want), `${id} units ${it.units} match ${ability}`);
    }
  }
}

// ---------------------------------------------------------------- §8.5 帯のレア・§8.6.5 手作りの超レア（同じ列の表）
function checkHandRow(c, grade, src, exclusive) {
  const [idc, name, kind, T, am, ab, fxc, qc, price, desc] = c;
  const id = bt(idc), it = DB.items[id];
  seen.add(id);
  if (!ok(it, `${id} exists`)) return;
  const wtype = JA_W[kind.replace(/（.*?）/, '')];
  ok(it.name === name && it.wtype === wtype && it.tier === +T && it.grade === grade && it.src === src, `${id} = ${name} ${wtype} T${T} ${grade}/${src} (${it.name} ${it.wtype} T${it.tier} ${it.grade}/${it.src})`);
  if (exclusive) ok(it.exclusive === exclusive, `${id} exclusive ${exclusive} (${it.exclusive})`);
  const [a, m] = am.split('/').map(Number);
  ok(it.atk === a && it.mag === m && it.price === +price, `${id} ${a}/${m} ${price} (${it.atk}/${it.mag} ${it.price})`);
  ok(statsEq(it.stats, withAdd(statsFrom(ab), it.statsAdd)), `${id} stats ${ab} (${J(it.stats)})`);
  const fx = fxc === '—' ? {} : frag(fxc), q = qc === '—' ? {} : frag(qc);
  const want = mergeShape(toItemShape(fx), toItemShape(q));
  const dev = S.SPEC_DEVIATIONS[id];
  if (dev) { ok(!same(effectShape(it), want), `${id} documented deviation: ${dev}`); console.log(`  note ${id}: ${dev}`); }
  else ok(same(effectShape(it), want), `${id} effects+quirks ${J(want)} (${J(effectShape(it))})`);
  ok(!!it.quirk === (qc !== '—'), `${id} quirk flag ${qc !== '—'} (${it.quirk})`);
  ok(it.desc === desc.replace(/／/g, '\n'), `${id} desc = table text ${J(desc)} (${J(it.desc)})`);
}
console.log('## §8.5 band rares');
{
  const rows = sectionLines(/^### 8\.5 /, /^### 8\.6 /).filter((l) => /^\| `w_/.test(l)).map(cells);
  ok(rows.length === 59, `§8.5 lists 59 weapons (${rows.length})`);
  for (const c of rows) checkHandRow(c, 'rare', 'drop');
}
console.log('## §8.6.5 hand-made supers');
{
  const sec = sectionLines(/^#### 8\.6\.5 /, /^#### 8\.6\.6 /);
  const assign = {};
  for (const l of sec.filter((x) => x.startsWith('| ') && x.includes('→'))) for (const m of l.matchAll(/`(w_[a-z_]+)` → `([a-z0-9_]+)`/g)) assign[m[1]] = m[2];
  ok(Object.keys(assign).length === 10, `§8.6.5 assigns 10 weapons (${Object.keys(assign).length})`);
  const rows = sec.filter((l) => /^\| `w_/.test(l)).map(cells);
  ok(rows.length === 10, `§8.6.5 lists 10 weapons (${rows.length})`);
  for (const c of rows) checkHandRow(c, 'super', 'super', assign[bt(c[0])]);
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
    const it = DB.items[bt(c[1])];
    if (it) {
      ok(it.units === units, `${bt(c[1])} units ${units} (${it.units})`);
      // §9.12.7 の略記と §8.7.2 の表が同じ品を言っている
      const l = s127.find((x) => x.includes(bt(c[1])));
      const sh = l && l.match(new RegExp(bt(c[1]) + '` [^（]+（[^。]+。([^）]+)）'));
      if (ok(sh, `§9.12.7 has the shorthand of ${bt(c[1])}`)) {
        const [fx, q] = sh[1].split('｜').map((x) => x.replace(/^\s*Q:\s*/, '').trim());
        ok(same(effectShape(it), mergeShape(shorthand(fx, it.tier), shorthand(q, it.tier))), `${bt(c[1])} = §9.12.7 shorthand ${sh[1]}`);
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
    const mon = bt(c[0]), id = bt(c[1]), it = DB.items[id];
    seen.add(id);
    if (!ok(it, `${id} exists`)) continue;
    ok(it.exclusive === mon && it.grade === 'super' && it.src === 'super' && it.tier === +c[4], `${id} exclusive ${mon}, super, T${c[4]} (${it.exclusive} T${it.tier})`);
    const nm = tableName(id, c[2]);
    ok(it.name === nm, `${id} name ${nm} (${it.name})`);
    if (c[3].includes('8.6.5')) continue;
    n08++;
    const wtype = c[3].replace('武器・', '');
    ok(it.wtype === wtype, `${id} wtype ${wtype} (${it.wtype})`);
    const [fx, q] = c[6].split('｜').map((x) => x.replace(/^\s*Q:\s*/, '').trim());
    const want = mergeShape(shorthand(fx, it.tier), shorthand(q, it.tier));
    ok(same(effectShape(it), want), `${id} = ${c[6]} (${J(effectShape(it))})`);
    ok(it.quirk === true, `${id} quirk:true`);
    ok(it.units === S.monsterWeaponUnits(wtype, mon), `${id} units ${S.monsterWeaponUnits(wtype, mon)} by §8.6.2 (${it.units})`);
    const price = Math.round(S.PRICE[it.tier] * 1.6 / 10) * 10 * 6;
    ok(it.price === price, `${id} price ${price} (${it.price})`);
    // desc: 効果・クセのどれも、長い形か短い形で書かれている
    for (const k of fx.split(/\s+/).concat(q.split(/\s+/))) {
      // 1 語の略記 → {key: value} 1 つ（mods の中身も 1 段に出す）→ §8.2.7 の [長い形, 短い形]
      const [key, val] = Object.entries(shorthand(k, it.tier)).flatMap(([kk, vv]) => (kk === 'mods' ? Object.entries(vv) : [[kk, vv]]))[0];
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
    const id = bt(c[0]), it = DB.items[id];
    seen.add(id);
    if (!ok(it, `${id} exists`)) continue;
    const wtype = c[2].replace('武器・', ''), mons = [...c[5].matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]);
    const nm = tableName(id, c[1]);
    ok(it.name === nm && it.wtype === wtype && it.tier === +c[3] && it.grade === 'rare' && it.src === 'mdrop', `${id} = ${nm} ${wtype} T${c[3]} rare/mdrop (${it.name})`);
    ok(same(effectShape(it), shorthand(c[4], it.tier)), `${id} = ${c[4]} (${J(effectShape(it))})`);
    ok(J(WI.MRARE_DROPPERS[id]) === J(mons), `${id} droppers ${mons.join(' ')} (${(WI.MRARE_DROPPERS[id] || []).join(' ')})`);
    ok(it.units === S.monsterWeaponUnits(wtype, mons[0]), `${id} units ${S.monsterWeaponUnits(wtype, mons[0])} (${it.units})`);
    ok(!it.quirk && it.price === Math.round(S.PRICE[it.tier] * 1.6 / 10) * 10 * 3, `${id} no quirk, price ×3 (${it.price})`);
  }
}
console.log('## §9.12.6 counts, §9.12.8 boss super');
{
  const rows = sectionLines(/^#### 9\.12\.6 /, /^#### 9\.12\.7 /).filter((l) => /^\| w:/.test(l)).map(cells);
  ok(rows.length === 11, `§9.12.6 has 11 weapon rows (${rows.length})`);
  for (const c of rows) {
    const w = c[0].slice(2);
    const r = WI.all().filter((id) => DB.items[id].src === 'mdrop' && DB.items[id].wtype === w).length;
    const s = WI.all().filter((id) => DB.items[id].grade === 'super' && DB.items[id].wtype === w && !/^(b_|rm_)/.test(DB.items[id].exclusive)).length;
    ok(r === +c[1] && s === +c[2], `§9.12.6 ${w}: rare ${c[1]} super ${c[2]} (${r} ${s})`);
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
  const missing = [...all].filter((id) => !skip(id) && !DB.items[id]);
  ok(missing.length === 0, `every weapon id DESIGN.md names exists (${all.size} ids; missing: ${missing.join(' ')})`);
  const unchecked = WI.all().filter((id) => !seen.has(id));
  ok(unchecked.length === 0, `every one of the 301 weapons was compared with a DESIGN.md row (${unchecked.join(' ')})`);
}

console.log(`\ncheck_weapons: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:\n  ' + fails.slice(0, 40).join('\n  ')); process.exit(1); }
