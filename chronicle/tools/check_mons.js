#!/usr/bin/env node
// tools/check_mons.js — A11 mons: data conformance against DESIGN.md §9 (normative tables).
//
//   node tools/check_mons.js            compare src/data (lineages, monsters_*, enemy_actions, encounters)
//                                       with DESIGN.md §9.1.3 / §9.5.2 / §9.6.2 / §9.7.3 / §9.8 / §9.12.4-5
//   node tools/check_mons.js --json     print the parsed DESIGN data as JSON (debugging)
//   node tools/check_mons.js --write    (re)generate those src/data files from DESIGN ⊕ the tuning overlay
//
// Exit 1 on any mismatch. Deliberate, documented balance deviations from the DESIGN tables live in
// tools/fixtures/mons/tuning.json (found with tools/sim_zones.js; each entry has a "why"); the data must equal
// DESIGN ⊕ that overlay exactly.
//
// The DESIGN parser is exported (require('./check_mons').parseDesign()) so test_mons.js and the
// simulators read the same numbers.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DESIGN = path.join(ROOT, 'DESIGN.md');

const RACE = { 獣: 'beast', 鳥: 'bird', 虫: 'insect', 植物: 'plant', 水生: 'aquatic', 竜: 'dragon', 不死: 'undead',
  魔族: 'demon', 霊体: 'spirit', 魔造: 'construct', 軟体: 'slime', 人型: 'humanoid', 妖精: 'fairy' };
const ELEM = { 火: 'fire', 水: 'water', 風: 'wind', 土: 'earth', 光: 'light', 闇: 'dark' };
const PHYS = { 斬: 'slash', 打: 'blunt', 突: 'pierce' };
const STAT = { 毒: 'poison', 焼: 'burn', 眠: 'sleep', 麻: 'paralyze', 凍: 'freeze', 気: 'stun', 混: 'confuse', 黙: 'silence', 暗: 'blind', 死: 'death' };
const SKEYS = ['hp', 'atk', 'mag', 'def', 'mdef', 'agi'];

// §9.8 goldName table (names that start with a colour word must carry one)
const GOLD_NAMES = {
  jelly_5: '金色ゼリー', paper_1: '金紙の小鬼', paper_2: '金紙の獣', paper_3: '金紙の騎士', paper_4: '金紙の竜',
  scorpion_1: '金色サソリ', wolf_1: '金色オオカミ', beetle_4: '黄金カブト',
  crystal_2: '金色水晶', crystal_3: '金の青晶', crystal_4: '金の紫晶', gargoyle_2: '金色の石像鬼', armor_4: '金色の鎧',
  scribe_1: '金衣の書記', scribe_2: '金衣の写本師', scribe_3: '金衣の司書長', book_3: '金紙の書',
};

// Balance overlay (tools/fixtures/mons/tuning.json): monsters.<id>.<field> / encounters.<zone>.groups replace DESIGN.
const TUNING_FILE = path.join(ROOT, 'tools', 'fixtures', 'mons', 'tuning.json');
function loadTuning() {
  try { return JSON.parse(fs.readFileSync(TUNING_FILE, 'utf8')); } catch (e) { return { monsters: {}, encounters: {} }; }
}
const TUNED = {}; // 'monId.field' / 'zone.groups' → why (filled by expected())

function num(s) { return s === '吸収' ? -1 : Number(s.startsWith('.') ? '0' + s : s); }

function codeBlockAfter(lines, headingRe) {
  const i = lines.findIndex((l) => headingRe.test(l));
  if (i < 0) throw new Error('DESIGN: heading not found ' + headingRe);
  let a = i + 1;
  while (!lines[a].startsWith('```')) a++;
  let b = a + 1;
  while (!lines[b].startsWith('```')) b++;
  return lines.slice(a + 1, b).join('\n');
}

function evalAssign(code, reg) {
  const R = { DB: { [reg]: {}, rareEncounters: {} } };
  // the DESIGN blocks are plain `Object.assign(R.DB.<reg>, {...});`
  new Function('R', code)(R); // eslint-disable-line no-new-func
  return R.DB[reg];
}

function parseElems(cell) {
  const out = { elem: {}, affinity: null };
  const aff = cell.match(/（親和(.)）/);
  if (aff) out.affinity = ELEM[aff[1]];
  const clean = cell.replace(/（[^）]*）/g, '').trim();
  if (clean === '—' || clean === '') return out;
  for (const tok of clean.split(/\s+/)) {
    const m = tok.match(/^([火水風土光闇])(吸収|[0-9.]+)$/);
    if (!m) throw new Error('elem token ' + tok);
    out.elem[ELEM[m[1]]] = num(m[2]);
  }
  return out;
}
function parseMap(cell, table) {
  const o = {};
  const clean = cell.trim();
  if (clean === '—' || clean === '') return o;
  for (const tok of clean.split(/\s+/)) {
    const m = tok.match(/^(.)([0-9.]+)$/);
    if (!m || !table[m[1]]) throw new Error('token ' + tok);
    o[table[m[1]]] = num(m[2]);
  }
  return o;
}
function parseS(cell) {
  const out = { s: {}, flags: [], rw: {}, hpFixed: null };
  const parts = cell.split('・').map((x) => x.trim());
  for (const tok of parts[0].split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^(hp|atk|mag|def|mdef|agi)([0-9.]+)$/);
    if (!m) throw new Error('s token ' + tok);
    out.s[m[1]] = num(m[2]);
  }
  for (const p of parts.slice(1)) {
    for (const tok of p.split(/\s+/)) {
      if (tok === '飛') out.flags.push('flying');
      else if (tok === '鋼') out.flags.push('metal');
      else if (/^HP固定\d+$/.test(tok)) out.hpFixed = Number(tok.slice(4));
      else if (/^お金×[0-9.]+$/.test(tok)) out.rw.gold = Number(tok.slice(3));
      else throw new Error('s flag ' + tok);
    }
  }
  return out;
}
function parseCond(c) {
  const o = {};
  for (const t of c.split(',')) {
    let m;
    if (t === '1回') o.once = true;
    else if ((m = t.match(/^(\d)手ごと@(\d)$/))) o.every = [Number(m[1]), Number(m[2])];
    else if ((m = t.match(/^HP<(\d+)%$/))) o.hpBelow = Number(m[1]) / 100;
    else if ((m = t.match(/^HP>(\d+)%$/))) o.hpAbove = Number(m[1]) / 100;
    else if ((m = t.match(/^数<(\d+)$/))) o.countBelow = Number(m[1]);
    else if (t === '倒れた仲間あり') o.allyDown = true;
    else throw new Error('cond ' + t);
  }
  return o;
}
function parseActions(cell) {
  return cell.split('·').map((x) => x.trim()).filter(Boolean).map((tok) => {
    const m = tok.match(/^(攻撃|e_[a-z_]+?)(\d+(?:\.\d+)?)(?:\[(.+)\])?$/);
    if (!m) throw new Error('action token ' + tok);
    const a = { id: m[1] === '攻撃' ? 'attack' : m[1], w: Number(m[2]) };
    if (m[3]) a.cond = parseCond(m[3]);
    return a;
  });
}
function parseDrops(cell) {
  const rows = cell.split('<br>').map((x) => x.trim());
  if (rows.length !== 3) throw new Error('drops ' + cell);
  const slot = (t) => { const m = t.match(/^([a-z0-9_]+) 1\/(\d+)$/); if (!m) throw new Error('drop ' + t); return { item: m[1], rate: Number(m[2]) }; };
  return { normal: slot(rows[0]), rare: slot(rows[1]), super: slot(rows[2]) };
}

let CACHE = null;
function parseDesign() {
  if (CACHE) return CACHE;
  const text = fs.readFileSync(DESIGN, 'utf8');
  const lines = text.split('\n');
  const lineages = evalAssign(codeBlockAfter(lines, /^#### 9\.1\.3 /), 'lineages');
  const actions = evalAssign(codeBlockAfter(lines, /^#### 9\.6\.2 /), 'actions');
  const encounters = evalAssign(codeBlockAfter(lines, /^#### 9\.7\.3 /), 'encounters');
  const rareEncounters = (() => { // same block; owned by A12 (rare_encounters.js) — read for the simulators only
    const R = { DB: { encounters: {}, rareEncounters: {} } };
    new Function('R', codeBlockAfter(lines, /^#### 9\.7\.3 /))(R); // eslint-disable-line no-new-func
    return R.DB.rareEncounters;
  })();

  // §9.5.2 lineage tables
  const start = lines.findIndex((l) => /^#### 9\.5\.2 /.test(l));
  const end = lines.findIndex((l, i) => i > start && /^### 9\.6 /.test(l));
  const mons = {};
  const lineageInfo = {};
  let cur = null;
  for (let i = start; i < end; i++) {
    const l = lines[i];
    let m;
    if ((m = l.match(/^##### `([a-z_]+)` (\S+?)（(.+)）$/))) {
      const bits = m[3].split('・');
      cur = { id: m[1], name: m[2], race: RACE[bits[0]], size: bits[1], flying: bits.includes('飛ぶ'), metal: bits.includes('鋼'),
        note: (lines[i + 1] || '').trim() };
      if (!cur.race) throw new Error('race ' + l);
      lineageInfo[cur.id] = cur;
      continue;
    }
    if (!cur || !/^\| `[a-z_]+_\d` \|/.test(l)) continue;
    const c = l.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length !== 11) throw new Error('row columns ' + l.slice(0, 60));
    const id = c[0].replace(/`/g, '');
    const tl = c[2].match(/^T(\d) \/ (\d+)(?:（([sml])）)?$/);
    if (!tl) throw new Error('tier/lv ' + c[2]);
    const el = parseElems(c[4]);
    const sx = parseS(c[7]);
    const stage = Number(id.split('_').pop());
    const mon = {
      name: c[1], sprite: id, lineage: cur.id, stage, lv: Number(tl[2]), tier: Number(tl[1]),
      size: tl[3] || cur.size, race: cur.race, affinity: el.affinity,
      s: sx.s, rw: sx.rw, hpFixed: sx.hpFixed, flags: sx.flags,
      elem: el.elem, phys: parseMap(c[5], PHYS), statusRes: parseMap(c[6], STAT),
      actions: parseActions(c[8]), drops: parseDrops(c[9]), desc: c[10].replace(/<br>/g, '\n'),
      art: c[3],
    };
    if (GOLD_NAMES[id]) mon.goldName = GOLD_NAMES[id];
    mons[id] = mon;
  }

  // §9.12.4 super table: monster → {item, name, kind, T, rate}
  const superTable = {};
  {
    const a = lines.findIndex((l) => /^#### 9\.12\.4 /.test(l));
    const b = lines.findIndex((l, i) => i > a && /^#### 9\.12\.5 /.test(l));
    for (let i = a; i < b; i++) {
      const m = lines[i].match(/^\| `([a-z_0-9]+)` \| `([a-z_0-9]+)` \| ([^|]+) \| ([^|]+) \| (\d) \| 1\/(\d+) \| (.*) \|$/);
      if (m) superTable[m[1]] = { item: m[2], name: m[3].trim(), kind: m[4].trim(), T: Number(m[5]), rate: Number(m[6]), fx: m[7].trim() };
    }
  }
  // §9.12.5 rare table: item → {name, kind, T, fx, mons[]}
  const rareTable = {};
  {
    const a = lines.findIndex((l) => /^#### 9\.12\.5 /.test(l));
    const b = lines.findIndex((l, i) => i > a && /^#### 9\.12\.6 /.test(l));
    for (let i = a; i < b; i++) {
      const m = lines[i].match(/^\| `([a-z_0-9]+)` \| ([^|]+) \| ([^|]+) \| (\d) \| ([^|]*) \| (.*) \|$/);
      if (m) rareTable[m[1]] = { name: m[2].trim(), kind: m[3].trim(), T: Number(m[4]), fx: m[5].trim(), mons: (m[6].match(/`([a-z_0-9]+)`/g) || []).map((x) => x.replace(/`/g, '')) };
    }
  }
  // §9.7.2 group-strength table (M5 reference numbers)
  const strengthTable = {};
  {
    const a = lines.findIndex((l) => /^#### 9\.7\.2 /.test(l));
    const b = lines.findIndex((l, i) => i > a && /^#### 9\.7\.3 /.test(l));
    for (let i = a; i < b; i++) {
      const m = lines[i].match(/^\| `([a-z_0-9]+)` \| ([0-9.\s/]+) \|$/);
      if (m) strengthTable[m[1]] = m[2].split('/').map((x) => Number(x.trim()));
    }
  }
  // §9.7.1 zone → rare monster (A12 owns rare_encounters, used here for sims only)
  const zoneRare = {};
  {
    const a = lines.findIndex((l) => /^#### 9\.7\.1 /.test(l));
    const b = lines.findIndex((l, i) => i > a && /^#### 9\.7\.2 /.test(l));
    for (let i = a; i < b; i++) {
      const m = lines[i].match(/^\| `[a-z_]+` \| `([a-z_0-9]+)` \| [^|]+ \| (?:`(rm_[a-z_]+)`|—) \|/);
      if (m) zoneRare[m[1]] = m[2] || null;
    }
  }
  CACHE = { lineages, actions, encounters, rareEncounters, mons, lineageInfo, superTable, rareTable, strengthTable, zoneRare };
  return CACHE;
}

/** DESIGN data with the tuning overlay applied (deep copies) */
function expected() {
  const D = parseDesign();
  const T = loadTuning();
  const mons = JSON.parse(JSON.stringify(D.mons));
  const encounters = JSON.parse(JSON.stringify(D.encounters));
  for (const [id, o] of Object.entries(T.monsters || {})) {
    if (!mons[id]) throw new Error('tuning: unknown monster ' + id);
    for (const [k, v] of Object.entries(o)) { if (k === 'why') continue; mons[id][k] = v; TUNED[id + '.' + k] = o.why || '?'; }
  }
  for (const [z, o] of Object.entries(T.encounters || {})) {
    if (!encounters[z]) throw new Error('tuning: unknown zone ' + z);
    for (const [k, v] of Object.entries(o)) { if (k === 'why') continue; encounters[z][k] = v; TUNED['zone.' + z + '.' + k] = o.why || '?'; }
  }
  const actions = JSON.parse(JSON.stringify(D.actions));
  for (const [id, o] of Object.entries(T.actions || {})) {
    if (!actions[id]) throw new Error('tuning: unknown action ' + id);
    for (const [k, v] of Object.entries(o)) { if (k === 'why') continue; actions[id][k] = v; TUNED[id + '.' + k] = o.why || '?'; }
  }
  return Object.assign({}, D, { mons, encounters, actions, tuning: T });
}

// ---------------------------------------------------------------- rules shared with tests / sims
/** §9.12.1 srTier of a regular monster (needs DB.lineages) */
function srTier(lineages, monId) {
  for (const L of Object.values(lineages)) {
    const i = L.stages.findIndex((s) => s.mon === monId);
    if (i < 0) continue;
    const st = L.stages[i];
    if (st.tier >= 9) return 9;
    if (i === L.stages.length - 1) return 8;
    return Math.max(st.tier, L.stages[i + 1].tier - 1);
  }
  return null;
}
function band(t) { return t >= 9 ? 9 : t === 8 ? 7 : t % 2 === 1 ? t : t - 1; }
/** §9.2.3 evasion rule */
function evaRule(m) {
  const f = m.flags || [];
  if (f.includes('metal')) return 30;
  let e = 5;
  if (f.includes('flying')) e = 12;
  if (((m.s && m.s.agi) || 1) >= 1.3) e = Math.max(e, 15);
  return e;
}

// ---------------------------------------------------------------- encounter helpers (§9.1.3 / §9.1.4 / §9.7.2)
const SIZE_W = { s: 0.7, m: 1, l: 1.8 }, SIZE_PX = { s: 32, m: 48, l: 64 };
/** R.Mon.resolve('@<lineage>', T) semantics: last stage with tier ≤ T, or null; plain ids pass through */
function resolveRef(DB, ref, T) {
  if (ref[0] !== '@') return ref;
  const L = DB.lineages[ref.slice(1)];
  if (!L) return undefined;
  let r = null;
  for (const s of L.stages) if (s.tier <= T) r = s.mon;
  return r;
}
function zoneTiers(z) { return z.tier === 'dyn' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [z.tier]; }
/** groups that can be rolled at tier T: [{g, ms:[[monId,min,max]…]}] */
function eligibleGroups(DB, z, T) {
  const out = [];
  for (const g of z.groups) {
    if (g.tierMin != null && T < g.tierMin) continue;
    if (g.tierMax != null && T > g.tierMax) continue;
    const ms = g.mons.map(([r, a, b]) => [resolveRef(DB, r, T), a, b]);
    if (ms.some((x) => !x[0] || !DB.monsters[x[0]])) continue;
    out.push({ g, ms });
  }
  return out;
}
/** strength in standard monsters (s 0.7, m 1, l 1.8) at the mean count */
function groupStrength(DB, ms) { return ms.reduce((s, [id, a, b]) => s + SIZE_W[DB.monsters[id].size] * (a + b) / 2, 0); }
function isMetalGroup(DB, ms) { return ms.some(([id]) => (DB.monsters[id].flags || []).includes('metal')); }
/** zone average strength at T (solo and metal groups excluded, like §9.7.2) */
function zoneStrength(DB, z, T) {
  let tw = 0, ts = 0;
  for (const { g, ms } of eligibleGroups(DB, z, T)) {
    if (g.solo || isMetalGroup(DB, ms)) continue;
    tw += g.w; ts += g.w * groupStrength(DB, ms);
  }
  return tw ? ts / tw : 0;
}
/** expected number of monster `id` met per battle in zone z at tier T (§9.13.3 L6) */
function perBattle(DB, z, T, id) {
  const el = eligibleGroups(DB, z, T);
  const tw = el.reduce((s, e) => s + e.g.w, 0);
  let n = 0;
  for (const { g, ms } of el) for (const [mid, a, b] of ms) if (mid === id) n += g.w * (a + b) / 2;
  return tw ? n / tw : 0;
}

// ---------------------------------------------------------------- comparison
function stable(o) {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
  return JSON.stringify(o);
}
function norm(o) { // drop empty maps/nulls so {} and missing compare equal
  if (Array.isArray(o)) return o.map(norm);
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      if (v == null) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      r[k] = norm(v);
    }
    return r;
  }
  return o;
}

/** a zone another owner derives from a DESIGN zone (same groups, e.g. OB's z_postgame_oblivion_den = copy of
 *  z_postgame_oblivion_hi with a denser rare monster) → the DESIGN zone id, else null */
function derivedFrom(DB, D, z) {
  const e = DB.encounters[z];
  if (!e || D.encounters[z]) return null;
  const g = stable(norm(e.groups));
  return Object.keys(D.encounters).find((k) => stable(norm(D.encounters[k].groups)) === g) || null;
}

function check(R) {
  const D = expected();
  const errs = [];
  const err = (k, msg) => { errs.push(k + ': ' + msg); };
  const DB = R.DB;
  // lineages
  for (const [id, L] of Object.entries(D.lineages)) {
    const got = DB.lineages[id];
    if (!got) { err('lineage.' + id, 'missing'); continue; }
    if (got.name !== L.name) err('lineage.' + id, 'name ' + got.name + ' != ' + L.name);
    if ((got.family || null) !== (L.family || null)) err('lineage.' + id, 'family');
    if (stable(got.stages) !== stable(L.stages)) err('lineage.' + id, 'stages ' + stable(got.stages));
  }
  for (const id of Object.keys(DB.lineages)) if (!D.lineages[id]) err('lineage.' + id, 'not in DESIGN');
  // monsters
  const FIELDS = ['name', 'sprite', 'lineage', 'stage', 'lv', 'size', 'race', 'affinity', 's', 'rw', 'hpFixed', 'elem', 'phys', 'statusRes', 'actions', 'drops', 'desc', 'goldName'];
  for (const [id, m] of Object.entries(D.mons)) {
    const got = DB.monsters[id];
    if (!got) { err(id, 'missing'); continue; }
    for (const f of FIELDS) {
      const a = stable(norm({ v: got[f] })), b = stable(norm({ v: m[f] }));
      if (a !== b) err(id + '.' + f, 'data ' + a + ' != DESIGN ' + b);
    }
    const fl = (got.flags || []).slice().sort().join(','), dfl = m.flags.slice().sort().join(',');
    if (fl !== dfl) err(id + '.flags', fl + ' != ' + dfl);
    if (got.eva !== undefined && got.eva !== evaRule(m)) err(id + '.eva', got.eva + ' != rule ' + evaRule(m));
    if (m.flags.includes('metal') && got.fleeRate !== 0.5) err(id + '.fleeRate', 'metal needs 0.5');
  }
  // actions
  for (const [id, a] of Object.entries(D.actions)) {
    const got = DB.actions[id];
    if (!got) { err(id, 'missing action'); continue; }
    if (stable(norm(got)) !== stable(norm(a))) err(id, 'action differs: ' + stable(norm(got)));
  }
  // encounters
  for (const [z, e] of Object.entries(D.encounters)) {
    const got = DB.encounters[z];
    if (!got) { err('zone.' + z, 'missing'); continue; }
    if (stable(norm(got)) !== stable(norm(e))) err('zone.' + z, 'zone differs');
  }
  for (const z of Object.keys(DB.encounters)) if (!D.encounters[z] && !derivedFrom(DB, D, z)) err('zone.' + z, 'not in DESIGN');
  return errs;
}

// ---------------------------------------------------------------- generator (--write)
function writeData() {
  const D = expected();
  const lines = fs.readFileSync(DESIGN, 'utf8').split('\n');
  const written = [];
  const write = (rel, text) => { fs.writeFileSync(path.join(ROOT, rel), text); written.push(rel); };
  const FILES = {
    common: { title: '共通の系統（ゼリー・ネズミ・コウモリ・虚ろの使い・カニ・カモメ・宝箱）と鋼の 3 系統（白銀ゼリー・鏡カブト・白金の鬼火）',
      lin: ['jelly', 'rat', 'bat', 'paper', 'crab', 'seabird', 'mimic', 'quicksilver', 'mirror', 'platinum'] },
    forest: { title: '地方1 ヴェルダの森（ハチ・キノコ・人食い花・妖精・魔木）', lin: ['bee', 'mushroom', 'plant', 'fairy', 'treant'] },
    desert: { title: '地方2 ザハラ砂漠（サソリ・ヘビ・ミイラ・サボテン・ミミズ）', lin: ['scorpion', 'snake', 'mummy', 'cactus', 'sandworm'] },
    snow: { title: '地方3 ノルデン雪原（オオカミ・雪男・氷の小鬼・フクロウ・マンモス）', lin: ['wolf', 'yeti', 'frostling', 'owl', 'mammoth'] },
    marsh: { title: '地方4 グレイモア湿原（霊・鬼火・カエル・人形・トカゲ兵・クモ）', lin: ['ghost', 'wisp', 'frog', 'doll', 'lizardman', 'spider'] },
    isles: { title: '地方5 マレア諸島（魚人・タコ・骸骨）', lin: ['merman', 'kraken', 'skeleton'] },
    mine: { title: '地方6 ガルド山地（石くれ兵・モグラ・カブト・水晶・小鬼）', lin: ['golem', 'mole', 'beetle', 'crystal', 'goblin'] },
    ash: { title: '地方7 灰の荒野（火トカゲ・悪魔・石像鬼・大鬼・三頭獣）', lin: ['salamander', 'imp', 'gargoyle', 'orc', 'chimera'] },
    star: { title: '地方8 オルビス高原（目玉・魔術師・からくり・鎧・飛竜）', lin: ['eyeball', 'darkmage', 'automaton', 'armor', 'wyvern'] },
    finale: { title: '終盤 ビブリア島と白の大書庫（白衣の書記・魔書・魔神）', lin: ['scribe', 'book', 'demon'] },
    postgame: { title: 'クリア後 忘却の底（虚無の騎士・混沌獣）', lin: ['void', 'chaos'] },
  };
  { // sanity: every lineage in exactly one file
    const all = Object.values(FILES).flatMap((f) => f.lin);
    const want = Object.keys(D.lineages);
    if (all.length !== want.length || want.some((l) => !all.includes(l))) throw new Error('file split does not cover lineages');
  }

  const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  function lit(v) {
    if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
    if (v && typeof v === 'object') {
      const ks = Object.keys(v);
      if (!ks.length) return '{}';
      return '{ ' + ks.map((k) => (/^[a-z_][a-z0-9_]*$/i.test(k) ? k : q(k)) + ': ' + lit(v[k])).join(', ') + ' }';
    }
    if (typeof v === 'string') return q(v);
    return String(v);
  }
  const RACE_JA = Object.fromEntries(Object.entries(RACE).map(([a, b]) => [b, a]));

  function monEntry(id, m) {
    const o = [];
    const head = [['name', m.name]];
    if (m.goldName) head.push(['goldName', m.goldName]);
    head.push(['sprite', m.sprite], ['lineage', m.lineage], ['stage', m.stage], ['lv', m.lv], ['size', m.size], ['race', m.race]);
    if (m.affinity) head.push(['affinity', m.affinity]);
    o.push(head.map(([k, v]) => k + ': ' + lit(v)).join(', ') + ',');
    const st = [['flags', m.flags], ['s', m.s]];
    if (Object.keys(m.rw).length) st.push(['rw', m.rw]);
    if (m.hpFixed != null) st.push(['hpFixed', m.hpFixed]);
    if (m.flags.includes('metal')) st.push(['fleeRate', 0.5]);
    st.push(['eva', evaRule(m)]);
    o.push(st.map(([k, v]) => k + ': ' + lit(v)).join(', ') + ',');
    o.push('elem: ' + lit(m.elem) + ', phys: ' + lit(m.phys) + ', statusRes: ' + lit(m.statusRes) + ',');
    o.push('actions: ' + lit(m.actions) + ',');
    o.push('drops: { normal: ' + lit(m.drops.normal) + ', rare: ' + lit(m.drops.rare) + ', super: ' + lit(m.drops.super) + ' },');
    o.push('desc: ' + q(m.desc) + ',');
    return '    ' + id + ': {\n' + o.map((x) => '      ' + x).join('\n') + '\n    },';
  }

  for (const [key, f] of Object.entries(FILES)) {
    const out = [];
    out.push(`// ルミナス・クロニクル — 雑魚の魔物: ${f.title}`);
    out.push('// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。');
    out.push('// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で');
    out.push('// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。');
    out.push('// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。');
    out.push('(function (R) {');
    out.push("  'use strict';");
    out.push('  Object.assign(R.DB.monsters, {');
    for (const lid of f.lin) {
      const info = D.lineageInfo[lid];
      const L = D.lineages[lid];
      const tags = [RACE_JA[info.race], info.size === 'var' ? '大きさは段ごと' : info.size];
      if (info.flying) tags.push('飛ぶ');
      if (info.metal) tags.push('鋼');
      if (L.family) tags.push(L.family + ' の分岐');
      out.push(`    // ---- ${lid} ${info.name}（${tags.join('・')}）: ${info.note}`);
      for (const st of L.stages) out.push(monEntry(st.mon, D.mons[st.mon]));
    }
    out.push('  });');
    out.push('})(window.RPG);');
    write('src/data/monsters_' + key + '.js', out.join('\n') + '\n');
  }

  // lineages.js
  {
    const out = [];
    out.push('// ルミナス・クロニクル — 魔物の系統 54（雑魚の段と、その段が出始めるティア）');
    out.push('// 担当 A11 mons。正は DESIGN.md §9.1.3・§9.5.1。R.Mon.resolve(\'@<系統>\', T) は tier ≤ T の段のうち最後のもの。');
    out.push('// family: その系統がどの系統の分岐か（鋼の 3 系統だけ。図鑑では元の系統の最後の段の直後に並ぶ。§9.9）。');
    out.push('(function (R) {');
    out.push("  'use strict';");
    out.push('  Object.assign(R.DB.lineages, {');
    for (const [id, L] of Object.entries(D.lineages)) {
      if (L.family && !out.some((l) => l.includes('鋼の分岐'))) out.push('    // 鋼の分岐（family = 元の系統。出現表は \'@quicksilver\' などで引く）');
      const parts = ['name: ' + q(L.name)];
      if (L.family) parts.push('family: ' + q(L.family));
      parts.push('stages: [' + L.stages.map((s) => `{ mon: ${q(s.mon)}, tier: ${s.tier} }`).join(', ') + ']');
      out.push(`    ${id}: { ${parts.join(', ')} },`);
    }
    out.push('  });');
    out.push('})(window.RPG);');
    write('src/data/lineages.js', out.join('\n') + '\n');
  }

  function blockAfter(re) {
    const i = lines.findIndex((l) => re.test(l));
    let a = i + 1; while (!lines[a].startsWith('```')) a++;
    let b = a + 1; while (!lines[b].startsWith('```')) b++;
    return lines.slice(a + 1, b);
  }
  // enemy_actions.js (verbatim §9.6.2)
  {
    const TA = D.tuning.actions || {};
    const body = blockAfter(/^#### 9\.6\.2 /).map((l) => {
      // text overlay (tuning.json actions.<id>.<field>: STYLE_JA fixes of name / msg); every action is one line
      const m = /^\s*(e_[a-z0-9_]+):/.exec(l);
      const o = m && TA[m[1]];
      if (!o) return '  ' + l;
      let t = l;
      for (const [k, v] of Object.entries(o)) {
        if (k === 'why') continue;
        const re = new RegExp('(\\b' + k + ": ')([^']*)(')");
        if (!re.test(t)) throw new Error('tuning: ' + m[1] + '.' + k + ' not found in the §9.6.2 line');
        t = t.replace(re, (_, a, __, c) => a + v + c);
      }
      return '  ' + t + ' // A11: ' + o.why;
    });
    const out = [
      '// ルミナス・クロニクル — 雑魚の行動 e_ 124（ボス・レア魔物の eb_ は boss の bosses_actions.js）',
      '// 担当 A11 mons。正は DESIGN.md §9.6（そのまま写した）。効果の読み方は §9.1.6、条件 cond は §9.1.7（battle_ai）。',
      '// 並び: 物理の単体 32 → 物理の全体・ランダム 10 → 状態異常 39 → 術 23 → 息 6 → 自分・仲間への行動 14。',
      '// {user} は使った魔物の名前。s_ の術は使わない（§7.0 の 0.13）。閃きの対象にならない（glim を持たない）。',
      '(function (R) {', "  'use strict';", ...body, '})(window.RPG);'];
    write('src/data/enemy_actions.js', out.join('\n') + '\n');
  }
  // encounters.js — DESIGN §9.7.3 verbatim when untuned; zones changed by the overlay are re-emitted with a comment
  {
    const blk = blockAfter(/^#### 9\.7\.3 /);
    const cut = blk.findIndex((l) => l.startsWith('Object.assign(R.DB.rareEncounters'));
    let body = blk.slice(0, cut);
    for (const [z, o] of Object.entries(D.tuning.encounters || {})) {
      const i0 = body.findIndex((l) => l.startsWith('  ' + z + ': {'));
      let i1 = i0 + 1; while (!body[i1].startsWith('  ] },')) i1++;
      const zone = D.encounters[z];
      const head = Object.entries(zone).filter(([k]) => k !== 'groups').map(([k, v]) => k + ': ' + lit(v)).join(', ');
      const rows = ['  // A11 tuning (tools/fixtures/mons/tuning.json): ' + o.why, '  ' + z + ': { ' + head + ', groups: ['];
      for (const g of zone.groups) rows.push('    ' + lit(g) + ',');
      rows.push('  ] },');
      body = [...body.slice(0, i0), ...rows, ...body.slice(i1 + 1)];
    }
    body = body.map((l) => '  ' + l);
    const out = [
      '// ルミナス・クロニクル — 出現表 26 ゾーン（地方 × ティア）',
      '// 担当 A11 mons。正は DESIGN.md §9.7.3（そのまま写した。バランスで変えたゾーンは tools/fixtures/mons/tuning.json に理由つき）。形は §9.1.4:',
      "//   { region, tier:'dyn'|0..9, lv?:[min,max]（序章だけ）, lvOff?, bg, groups:[{ w, mons:[[ref, min, max]…], tierMin?, tierMax?, solo? }] }",
      "//   ref は '@<系統>'（その戦闘のティアで段を選ぶ）か、固定ティアのゾーンでは段の id。Lb = LZ(Tb) + (map.lvOff ?? lvOff)。",
      '// 1 つの組は 3 種・8 体・横幅 256px まで。組の強さ（小 0.7・中 1・大 1.8）はゾーンの平均 3.0〜3.4（tools/sim_zones.js の M5）。',
      '// 生成: node tools/check_mons.js --write。レア魔物の差し替え DB.rareEncounters は boss（A12）の rare_encounters.js。',
      '(function (R) {', "  'use strict';", ...body, '})(window.RPG);'];
    write('src/data/encounters.js', out.join('\n') + '\n');
  }

  return written;
}

module.exports = { parseDesign, expected, derivedFrom, writeData, loadTuning, TUNING_FILE, srTier, band, evaRule, check, stable, norm, TUNED, GOLD_NAMES, RACE, ELEM, PHYS, STAT, SKEYS,
  SIZE_W, SIZE_PX, resolveRef, zoneTiers, eligibleGroups, groupStrength, isMetalGroup, zoneStrength, perBattle };

if (require.main === module) {
  if (process.argv.includes('--json')) { console.log(JSON.stringify(parseDesign(), null, 1)); process.exit(0); }
  if (process.argv.includes('--write')) { const w = writeData(); console.log('[check_mons] wrote ' + w.join(' ')); }
  const R = require('./lib/load')({ quiet: true });
  const errs = check(R);
  const D = parseDesign();
  console.log(`[check_mons] DESIGN: ${Object.keys(D.lineages).length} lineages, ${Object.keys(D.mons).length} monsters, ` +
    `${Object.keys(D.actions).length} e_ actions, ${Object.keys(D.encounters).length} zones`);
  const tk = Object.keys(TUNED);
  if (tk.length) console.log(`[check_mons] ${tk.length} documented deviation(s) from DESIGN (tools/fixtures/mons/tuning.json): ` + tk.join(' ') + (process.argv.includes('-v') ? '\n' + tk.map((k) => '    ' + k + ': ' + TUNED[k]).join('\n') : ''));
  for (const e of errs.slice(0, 60)) console.log('  ✗ ' + e);
  if (errs.length > 60) console.log(`  … ${errs.length - 60} more`);
  console.log(errs.length ? `[check_mons] FAIL ${errs.length}` : '[check_mons] OK: data matches DESIGN §9');
  process.exit(errs.length ? 1 : 0);
}
