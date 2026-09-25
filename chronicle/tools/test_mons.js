#!/usr/bin/env node
// tools/test_mons.js — A11 mons: unit tests for lineages / regular monsters / enemy actions / encounter tables /
// loot assignment (DESIGN.md §9.1–§9.9, §9.12, §9.13.4, §4.7, §4.10, STYLE_JA §2・§7).
//
//   node tools/test_mons.js            run everything (exit 1 on failure)
//   node tools/test_mons.js -v         also list passes per group
//
// Checks that need other owners' data (items, techs, spells, sprites, battle backgrounds) are reported as
// WARN while that data is missing, and become hard checks once it has landed.
'use strict';
const fs = require('fs');
const path = require('path');
const CM = require('./check_mons');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB;
const D = CM.parseDesign();

let pass = 0, fail = 0;
const fails = [], warns = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } return !!cond; }
function warn(msg) { warns.push(msg); }
function group(name, fn) {
  const f0 = fail, p0 = pass;
  try { fn(); } catch (e) { fail++; fails.push(name + ': threw ' + (e.stack || e)); }
  if (VERBOSE || fail > f0) console.log(`${fail > f0 ? '✗' : '✓'} ${name}  (${pass - p0} ok${fail > f0 ? ', ' + (fail - f0) + ' failed' : ''})`);
}

// ---------------------------------------------------------------- constants (spec)
const RACES = ['beast', 'bird', 'insect', 'plant', 'aquatic', 'dragon', 'undead', 'demon', 'spirit', 'construct', 'slime', 'humanoid', 'fairy'];
const ELS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const WEAK = { fire: 'water', water: 'earth', earth: 'wind', wind: 'fire', light: 'dark', dark: 'light' }; // §4.7.2
const KINDS = ['slash', 'blunt', 'pierce'];
const MULTS = [2, 1.5, 1.25, 1, 0.75, 0.5, 0.25, 0, -1]; // §4.7.1
const BAD = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind'];
const MON_STATUS = [...BAD, 'death', 'regen', 'veil']; // §9.14.2 spells: the only statuses monsters use
const COND_KEYS = ['hpBelow', 'hpAbove', 'every', 'once', 'round', 'alone', 'countBelow', 'allyDown']; // §9.1.7
const TARGETS = ['enemy', 'enemies', 'random', 'self', 'ally', 'allies', 'ally_dead']; // §9.1.6
const EFFECTS = ['damage', 'status', 'buff', 'heal', 'revive', 'dispel', 'summon'];
const BUFF_STATS = ['atk', 'def', 'mag', 'mdef', 'agi'];
const NORMAL_ITEMS = ['i_salve', 'i_potion', 'i_elixir', 'i_ether', 'i_panacea', 'i_antidote', 'i_ether2', 'i_stone_fire', 'i_clear',
  'i_phoenix', 'i_stone_water', 'i_stone_dark', 'i_revive', 'i_stone_wind', 'i_stone_earth', 'i_firepot', 'i_stone_light']; // §9.12.3
const ZONES = ['zw_prologue', 'zw_forest', 'zw_desert', 'zw_snow', 'zw_mine', 'zw_star', 'zw_marsh', 'zw_ash', 'zw_isles', 'zw_center',
  'z_prologue_lighthouse', 'z_r_forest_maze', 'z_r_forest_tree', 'z_r_desert_tomb', 'z_r_snow_peak', 'z_r_marsh_manor', 'z_r_marsh_bog',
  'z_r_isles_cave', 'z_r_isles_ship', 'z_r_mine_mine', 'z_r_ash_volcano', 'z_r_star_tower', 'z_finale_archive_lo', 'z_finale_archive_hi',
  'z_postgame_oblivion_lo', 'z_postgame_oblivion_hi']; // §10.13.4
const REGIONS = ['prologue', 'finale', 'postgame', 'r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
const SIZE_W = { s: 0.7, m: 1, l: 1.8 }, SIZE_PX = { s: 32, m: 48, l: 64 };
const COLOR_WORDS = ['灰色', '赤', '紅', '青', '紫', '黒', '白', '虹', '金']; // §9.8
// §8.6.5: the 27 species carrying the T8 build sets (super rate 1/128)
const T8_SET = ['book_1', 'book_2', 'book_3', 'scribe_1', 'scribe_2', 'imp_5', 'ghost_5', 'frostling_5', 'owl_4',
  'bat_5', 'spider_4', 'eyeball_5', 'bee_5', 'jelly_5', 'mummy_5', 'scorpion_5', 'wyvern_3', 'scribe_3',
  'goblin_5', 'golem_3', 'armor_4', 'orc_3', 'salamander_5', 'yeti_3', 'mammoth_3', 'wolf_5', 'demon_1'];

// ---------------------------------------------------------------- helpers
const regular = Object.keys(DB.monsters).filter((id) => DB.monsters[id] && DB.monsters[id].lineage);
function width(s) { let w = 0; for (const ch of s) w += ch.charCodeAt(0) < 0x100 || (ch >= '｡' && ch <= 'ﾟ') ? 0.5 : 1; return w; }
function resolve(ref, T) {
  if (ref[0] !== '@') return ref;
  const L = DB.lineages[ref.slice(1)];
  if (!L) return undefined;
  let r = null;
  for (const s of L.stages) if (s.tier <= T) r = s.mon;
  return r;
}
function zoneTiers(z) { return z.tier === 'dyn' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [z.tier]; }
function eligible(z, T) {
  const out = [];
  for (const g of z.groups) {
    if (g.tierMin != null && T < g.tierMin) continue;
    if (g.tierMax != null && T > g.tierMax) continue;
    const ms = g.mons.map(([r, a, b]) => [resolve(r, T), a, b]);
    if (ms.some((x) => !x[0])) continue;
    out.push({ g, ms });
  }
  return out;
}
const isMetal = (id) => ((DB.monsters[id] || {}).flags || []).includes('metal');
function goldenName(m) { return m.goldName || (width(m.name) <= 5 ? '金色の' + m.name : '金の' + m.name); }

// STYLE_JA §7.1 / §7.2 banned names and §2 allowed kanji
const STYLE = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
function sectionLines(re, stop) {
  const L = STYLE.split('\n');
  const a = L.findIndex((l) => re.test(l));
  const b = L.findIndex((l, i) => i > a && stop.test(l));
  return L.slice(a + 1, b);
}
const PARTIAL = sectionLines(/^### 7\.1 /, /^### 7\.2 /).flatMap((l) => (l.match(/`([^`]+)`/g) || []).flatMap((c) => c.slice(1, -1).split(/\s+/))).filter(Boolean);
const EXACT = sectionLines(/^### 7\.2 /, /^### 7\.3 /).filter((l) => l.startsWith('`')).flatMap((l) => (l.match(/`([^`]+)`/g) || []).flatMap((c) => c.slice(1, -1).split(/\s+/))).filter(Boolean);
const EXTRA_KANJI = (STYLE.match(/\*\*使ってよい常用外の字\*\*: ([^\n]+)/) || [, ''])[1].replace(/（[^）]*）/g, '').replace(/\s+/g, '');
const JOYO = fs.existsSync(path.join(ROOT, 'tools/lib/joyo.txt')) ? fs.readFileSync(path.join(ROOT, 'tools/lib/joyo.txt'), 'utf8').trim() : '';
const KANJI_OK = new Set([...JOYO, ...EXTRA_KANJI]);
function badKanji(s) {
  const out = [];
  for (const ch of s) if (/\p{Script=Han}/u.test(ch) && ch !== '々' && !KANJI_OK.has(ch)) out.push(ch);
  return out;
}

// ================================================================ tests
group('conformance with DESIGN §9 (check_mons)', () => {
  const errs = CM.check(R);
  ok(errs.length === 0, 'check_mons: ' + errs.slice(0, 5).join(' | '));
});

group('counts (§9.0 0.1, §9.6, §10.13.4)', () => {
  ok(Object.keys(DB.lineages).length === 54, 'lineages 54, got ' + Object.keys(DB.lineages).length);
  ok(regular.length === 211, 'regular monsters 211, got ' + regular.length);
  const eActs = Object.keys(DB.actions).filter((k) => k.startsWith('e_'));
  ok(eActs.length === 124, 'e_ actions 124, got ' + eActs.length);
  ok(ZONES.every((z) => DB.encounters[z]) && Object.keys(DB.encounters).length === 26, 'zones = §10.13.4 (26)');
  ok(regular.filter(isMetal).length === 6, 'metal species 6');
  ok(regular.filter((id) => DB.monsters[id].flags.includes('flying')).length === 30, 'flying regulars 30 (§9.14.2)');
});

group('lineages (§9.1.3, V8)', () => {
  const owner = {};
  for (const [lid, L] of Object.entries(DB.lineages)) {
    ok(typeof L.name === 'string' && L.name.length > 0, lid + ' name');
    const n = L.stages.length;
    if (L.family) {
      ok(n === 2, lid + ' family branch has 2 stages');
      ok(DB.lineages[L.family] && !DB.lineages[L.family].family, lid + ' family ' + L.family + ' is a base lineage');
      ok(L.stages.every((s) => isMetal(s.mon)), lid + ' family branch = metal');
    } else ok(n >= 3 && n <= 5, lid + ' has 3..5 stages (' + n + ')');
    let prev = -1;
    L.stages.forEach((s, i) => {
      const m = DB.monsters[s.mon];
      if (!ok(m, lid + ' stage ' + s.mon + ' exists')) return;
      ok(m.lineage === lid && m.stage === i + 1, s.mon + ' lineage/stage fields');
      ok(s.mon === lid + '_' + (i + 1), s.mon + ' id = <lineage>_<n>');
      ok(s.tier >= prev && s.tier >= 0 && s.tier <= 9, s.mon + ' tier non-decreasing 0..9');
      ok(m.lv === 7 + 6 * s.tier, s.mon + ' lv = 7 + 6T (' + m.lv + ')');
      ok(!owner[s.mon], s.mon + ' belongs to one lineage');
      owner[s.mon] = lid;
      prev = s.tier;
    });
  }
  ok(regular.every((id) => owner[id]), 'every regular monster is a lineage stage');
  // §9.0 0.2 stage tiers
  const pat = { 5: [0, 2, 4, 6, 8], 4: [0, 2, 4, 6], 3: [0, 3, 6] };
  const special = ['paper', 'scribe', 'book', 'void', 'chaos', 'demon', 'quicksilver', 'mirror', 'platinum'];
  for (const [lid, L] of Object.entries(DB.lineages)) {
    if (special.includes(lid)) continue;
    ok(CM.stable(L.stages.map((s) => s.tier)) === CM.stable(pat[L.stages.length]), lid + ' stage tiers follow §9.0 0.2');
  }
});

group('monster fields (§9.1.1, §9.2.3, §9.3)', () => {
  for (const id of regular) {
    const m = DB.monsters[id];
    ok(m.sprite === id, id + ' sprite = own id (§9.4.6)');
    ok(RACES.includes(m.race), id + ' race ' + m.race);
    ok(['s', 'm', 'l'].includes(m.size), id + ' size');
    ok(m.affinity == null || ELS.includes(m.affinity), id + ' affinity');
    ok(Array.isArray(m.flags) && m.flags.every((f) => ['flying', 'metal'].includes(f)), id + ' flags ⊂ flying/metal');
    ok(!('hue' in m) && !('sat' in m) && !('bri' in m) && !('pal' in m), id + ' has no hue/sat/bri/pal (§9.0 0.6)');
    for (const [k, v] of Object.entries(m.s || {})) ok(CM.SKEYS.includes(k) && v >= 0.5 && v <= 2.5, id + ' s.' + k + '=' + v + ' in 0.5..2.5');
    for (const k of Object.keys(m.rw || {})) ok(['exp', 'gold'].includes(k), id + ' rw.' + k);
    const metal = m.flags.includes('metal');
    ok(metal === (m.hpFixed != null), id + ' hpFixed only on metal');
    if (metal) {
      ok(m.hpFixed >= 6 && m.hpFixed <= 12, id + ' hpFixed 6..12');
      ok(m.fleeRate === 0.5 && (m.s.agi || 1) === 2.5, id + ' metal fleeRate 0.5 / agi 2.5');
    }
    ok(m.eva === CM.evaRule(m), id + ' eva follows §9.2.3 (' + m.eva + ')');
    for (const [k, v] of Object.entries(m.elem || {})) ok(ELS.includes(k) && MULTS.includes(v), id + ' elem.' + k + '=' + v);
    for (const [k, v] of Object.entries(m.phys || {})) ok(KINDS.includes(k) && MULTS.includes(v), id + ' phys.' + k + '=' + v);
    for (const [k, v] of Object.entries(m.statusRes || {})) ok([...BAD, 'death'].includes(k) && v >= 0 && v <= 1, id + ' statusRes.' + k + '=' + v);
    const e = (el) => (m.elem && m.elem[el] != null ? m.elem[el] : 1);
    // flying: wind 1.5 / earth 0.5, unless the affinity step (§9.3.1-4) overrides that element afterwards
    const affSet = m.affinity ? [m.affinity, WEAK[m.affinity]] : [];
    if (m.flags.includes('flying')) ok((affSet.includes('wind') || e('wind') >= 1.5) && (affSet.includes('earth') || e('earth') <= 0.5), id + ' flying: wind ≥1.5, earth ≤0.5 (§9.3.1-2)');
    if (m.affinity) ok(e(m.affinity) <= 0.25 && e(WEAK[m.affinity]) >= 1.5, id + ' affinity ' + m.affinity + ' → own ≤0.25, ' + WEAK[m.affinity] + ' ≥1.5 (§9.3.1-4)');
    if (DB.elements && DB.elements[m.affinity] && DB.elements[m.affinity].weakTo) ok(DB.elements[m.affinity].weakTo === WEAK[m.affinity], id + ' DB.elements weakTo agrees');
    ok(typeof m.desc === 'string', id + ' desc');
  }
});

group('actions referenced by monsters (§9.1.6, §9.1.7, V5)', () => {
  const used = new Set();
  for (const id of regular) {
    const m = DB.monsters[id];
    ok(Array.isArray(m.actions) && m.actions.length > 0, id + ' has actions');
    ok(m.actions.some((a) => a.id === 'attack'), id + ' can attack');
    for (const a of m.actions) {
      used.add(a.id);
      ok(a.id === 'attack' || (a.id.startsWith('e_') && DB.actions[a.id]), id + ' action ' + a.id + ' exists (e_ only)');
      ok(a.w > 0, id + ' ' + a.id + ' weight > 0');
      for (const k of Object.keys(a.cond || {})) ok(COND_KEYS.includes(k), id + ' cond key ' + k);
      if (a.cond && a.cond.every) ok(a.cond.every.length === 2 && a.cond.every[1] < a.cond.every[0], id + ' every [n,k] with k<n');
      const act = DB.actions[a.id];
      if (act && act.effects.some((f) => f.type === 'summon')) ok(a.cond && a.cond.countBelow, id + ' summon action guarded by countBelow');
      if (act && act.effects.some((f) => f.type === 'revive')) ok(a.cond && a.cond.allyDown, id + ' revive action guarded by allyDown');
    }
  }
  const unused = Object.keys(DB.actions).filter((k) => k.startsWith('e_') && !used.has(k));
  if (unused.length) warn('e_ actions used by no regular monster (may be used by rare monsters): ' + unused.join(' '));
});

group('enemy actions (§9.6, §9.1.6)', () => {
  const eActs = Object.entries(DB.actions).filter(([k]) => k.startsWith('e_'));
  for (const [id, a] of eActs) {
    ok(a.kind === 'enemy', id + ' kind enemy');
    ok(typeof a.name === 'string' && width(a.name) <= 8, id + ' name ≤ 8 (' + a.name + ')');
    ok(TARGETS.includes(a.target), id + ' target ' + a.target);
    ok(typeof a.fx === 'string' && a.fx, id + ' fx');
    ok(typeof a.msg === 'string' && a.msg.includes('{user}'), id + ' msg has {user}');
    ok(!a.glim, id + ' has no glim (not glimmerable)');
    ok(a.aim == null || ['middle', 'low', 'rand'].includes(a.aim), id + ' aim');
    ok(Array.isArray(a.effects) && a.effects.length > 0, id + ' effects');
    if (a.elements) ok(a.elements.every((e) => ELS.includes(e)), id + ' elements');
    const group = a.target === 'enemies';
    for (const f of a.effects) {
      ok(EFFECTS.includes(f.type), id + ' effect type ' + f.type);
      if (f.type === 'damage') {
        ok(['phys', 'magic', 'breath'].includes(f.formula), id + ' formula ' + f.formula);
        ok(f.power > 0 && f.power <= 2, id + ' power 0..2 (' + f.power + ')');
        ok(f.element == null || ELS.includes(f.element), id + ' element');
        ok(f.kind == null || KINDS.includes(f.kind), id + ' kind');
        ok(f.hits == null || (f.hits >= 2 && f.hits <= 4), id + ' hits 2..4');
      }
      if (f.type === 'status') {
        ok(MON_STATUS.includes(f.status), id + ' status ' + f.status + ' allowed for monsters');
        const bad = BAD.includes(f.status) || f.status === 'death';
        if (bad) {
          ok(f.chance > 0, id + ' bad status has chance');
          if (f.status === 'death') ok(a.target === 'enemy' && f.chance <= 0.12, id + ' death: single target, ≤12%');
          else if (group) ok(f.chance <= 0.30, id + ' group status ≤30% (' + f.chance + ')');
          else ok(f.chance <= 0.60, id + ' single status ≤60% (' + f.chance + ')');
        } else ok(f.chance == null, id + ' good status always succeeds');
      }
      if (f.type === 'buff') {
        ok(BUFF_STATS.includes(f.stat) && Math.abs(f.stages) >= 1 && Math.abs(f.stages) <= 2, id + ' buff stat/stages');
        if (f.stages < 0) ok(f.chance > 0 && f.chance <= (group ? 0.6 : 0.6), id + ' debuff chance');
      }
      if (f.type === 'heal' || f.type === 'revive') ok(f.pct > 0 && f.pct <= 0.5, id + ' pct');
      if (f.type === 'dispel') ok(f.side === 'good', id + ' dispel side good');
      if (f.type === 'summon') {
        ok(['same', 'lower'].includes(f.mon) || DB.monsters[f.mon] || (f.mon[0] === '@' && DB.lineages[f.mon.slice(1)]), id + ' summon mon');
        ok(f.n >= 1 && f.max >= 2 && f.max <= 8, id + ' summon n/max');
      }
    }
  }
  // names must not collide with techs (t_) / spells (s_) (§9.6.1)
  const other = Object.entries(DB.actions).filter(([k]) => /^(t_|s_)/.test(k));
  if (!other.length) warn('techs/spells not loaded: name collision check skipped');
  const names = new Map(other.map(([k, a]) => [a.name, k]));
  for (const [id, a] of eActs) ok(!names.has(a.name), id + ' name ' + a.name + ' collides with ' + names.get(a.name));
  const seen = {};
  for (const [id, a] of eActs) { ok(!seen[a.name], id + ' name unique among e_ (' + a.name + ' = ' + seen[a.name] + ')'); seen[a.name] = id; }
});

group('drops & loot assignment (§9.12, §4.10.1, V7/V11)', () => {
  const superOwner = {}, rareUsers = {};
  for (const id of regular) {
    const m = DB.monsters[id];
    const d = m.drops || {};
    if (!ok(d.normal && d.rare && d.super, id + ' has 3 drop slots')) continue;
    for (const k of ['normal', 'rare', 'super']) ok(Number.isInteger(d[k].rate) && typeof d[k].item === 'string', id + ' ' + k + ' item/rate');
    ok(!d.bonus, id + ' regular has no bonus slot');
    ok(NORMAL_ITEMS.includes(d.normal.item), id + ' normal item from §9.12.3 (' + d.normal.item + ')');
    ok(/(^|_)sr_/.test(d.super.item), id + ' super id has sr_ (' + d.super.item + ')');
    ok(!/(^|_)sr_/.test(d.rare.item) && !/_r\d_/.test(d.rare.item), id + ' rare id is a monster-rare id (' + d.rare.item + ')');
    const metal = m.flags.includes('metal'), mimic = m.lineage === 'mimic', t8 = T8_SET.includes(id);
    const want = metal ? [4, 16, 128] : mimic ? [8, 16, 128] : [8, 32, t8 ? 128 : 256];
    ok(d.normal.rate === want[0] && d.rare.rate === want[1] && d.super.rate === want[2], id + ' rates ' + [d.normal.rate, d.rare.rate, d.super.rate] + ' want ' + want);
    ok(!superOwner[d.super.item], id + ' super ' + d.super.item + ' is one-of-a-kind (also on ' + superOwner[d.super.item] + ')');
    superOwner[d.super.item] = id;
    (rareUsers[d.rare.item] = rareUsers[d.rare.item] || []).push(id);
  }
  ok(Object.keys(superOwner).length === 211, 'super items 211');
  ok(Object.keys(rareUsers).length === 111, 'monster rare items on regulars 111 (+2 postgame bosses = 113), got ' + Object.keys(rareUsers).length);
  ok(T8_SET.every((id) => DB.monsters[id] && DB.monsters[id].drops.super.rate === 128), 'T8 set species use 1/128');
  // srTier / band (§9.12.1)
  for (const [item, users] of Object.entries(rareUsers)) {
    ok(users.length <= 3, item + ' shared by ≤3 species (' + users.join(',') + ')');
    const bands = [...new Set(users.map((u) => CM.band(CM.srTier(DB.lineages, u))))];
    ok(bands.length === 1, item + ' users share one band (' + bands + ')');
    if (D.rareTable[item]) ok(D.rareTable[item].T === bands[0], item + ' band = §9.12.5 T');
  }
  for (const id of regular) {
    const t = CM.srTier(DB.lineages, id);
    if (D.superTable[id]) ok(D.superTable[id].T === t, id + ' srTier ' + t + ' = §9.12.4 T ' + D.superTable[id].T);
  }
  // supers must not be sold / found elsewhere (V7 / H2)
  for (const [mid, m] of Object.entries(DB.monsters)) {
    if (!m || m.lineage) continue;
    const ds = m.drops || {};
    for (const k of ['normal', 'rare', 'bonus']) if (ds[k] && ds[k].item && superOwner[ds[k].item]) ok(false, mid + ' ' + k + ' uses regular super ' + ds[k].item);
    if (ds.super && superOwner[ds.super.item]) ok(false, mid + ' super duplicates regular super ' + ds.super.item);
  }
  const shopItems = new Set(Object.values(DB.shops || {}).flatMap((s) => (s.stock || s.items || []).flatMap((x) => (typeof x === 'string' ? [x] : x.items || (x.id ? [x.id] : [])))));
  const poolItems = new Set(Object.values(DB.pools || {}).flatMap((p) => JSON.stringify(p).match(/"[a-z]{1,2}_[a-z0-9_]+"/g) || []).map((s) => s.slice(1, -1)));
  for (const it of Object.keys(superOwner)) ok(!shopItems.has(it) && !poolItems.has(it), it + ' super not in shops/pools');
  // item definitions (A9 weapons / A10a gear / A10b consumables) — hard once any item of that class exists
  const have = (pre) => Object.keys(DB.items || {}).some((k) => k.startsWith(pre));
  const missing = { normal: [], rare: [], super: [] };
  for (const id of regular) {
    const d = DB.monsters[id].drops;
    for (const k of ['normal', 'rare', 'super']) {
      const it = d[k].item, def = (DB.items || {})[it];
      const pre = it.split('_')[0] + '_';
      if (!def) { if (have(pre)) missing[k].push(it); continue; }
      if (k === 'super') {
        ok(def.grade === 'super', it + ' grade super');
        ok(def.tier == null || def.tier === CM.srTier(DB.lineages, id), it + ' tier = srTier(' + id + ')=' + CM.srTier(DB.lineages, id) + ', got ' + def.tier);
      } else if (k === 'rare') {
        ok(def.grade === 'rare', it + ' grade rare');
        ok(def.tier == null || def.tier === CM.band(CM.srTier(DB.lineages, id)), it + ' tier = band ' + CM.band(CM.srTier(DB.lineages, id)) + ', got ' + def.tier);
      } else ok(def.type === 'consumable', it + ' normal slot is a consumable');
    }
  }
  for (const k of ['normal', 'rare', 'super']) if (missing[k].length) warn(`${missing[k].length} ${k}-slot item(s) not defined yet: ` + [...new Set(missing[k])].slice(0, 12).join(' ') + (missing[k].length > 12 ? ' …' : ''));
});

group('names & text (§1.7, §9.8, STYLE_JA §2・§7)', () => {
  const names = {};
  for (const [id, m] of Object.entries(DB.monsters)) {
    if (!m) continue;
    const mine = !!m.lineage;
    if (mine) ok(width(m.name) <= 8, id + ' name ≤ 8 (' + m.name + ')');
    if (names[m.name] && !(m.name === 'ロウェル')) ok(false, id + ' name ' + m.name + ' duplicates ' + names[m.name]);
    names[m.name] = id;
    if (!mine) continue;
    const golden = !m.flags.includes('metal');
    if (golden && COLOR_WORDS.some((c) => m.name.startsWith(c))) ok(!!m.goldName, id + ' ' + m.name + ' starts with a colour word → goldName');
    if (golden) ok(width(goldenName(m)) <= 10, id + ' golden name ≤ 10 (' + goldenName(m) + ')');
    const lines = m.desc.split('\n');
    ok(lines.length <= 2 && lines.every((l) => width(l) <= 20), id + ' desc 20×2 (' + lines.map(width).join('/') + ')');
    for (const s of [m.name, m.goldName || '', m.desc]) {
      const bk = JOYO ? badKanji(s) : [];
      ok(bk.length === 0, id + ' non-jōyō kanji ' + bk.join(''));
    }
  }
  if (!JOYO) warn('tools/lib/joyo.txt missing: kanji check skipped');
  // banned names (§7.1 partial, §7.2 exact) — monster names, goldNames, enemy action names
  ok(PARTIAL.length > 100 && EXACT.length > 30, 'STYLE_JA banned lists parsed (' + PARTIAL.length + '/' + EXACT.length + ')');
  const subjects = [];
  for (const id of regular) { subjects.push([id, DB.monsters[id].name]); if (DB.monsters[id].goldName) subjects.push([id + '.goldName', DB.monsters[id].goldName]); }
  for (const [id, a] of Object.entries(DB.actions)) if (id.startsWith('e_')) subjects.push([id, a.name]);
  for (const [id, s] of subjects) {
    const p = PARTIAL.find((w) => s.includes(w));
    ok(!p, id + ' ' + s + ' contains banned "' + p + '"');
    ok(!EXACT.includes(s), id + ' ' + s + ' is a banned exact name');
    ok(!/[ 　]/.test(s), id + ' ' + s + ' has no spaces');
  }
  // STYLE_JA §7.3 words anywhere in my text
  const banned73 = ['冒険の書', '復活の呪文', '呪文', '痛恨', '会心の一撃', 'やっつけた', '回り込まれて', '息の根を止めた', '何も起こらなかった',
    'ポイントの経験値', '身を守っている', '様子をうかがっている', 'を落としていった', 'リジェネ', 'ジョブ', 'アビリティ', '麻痺', '魔法防御', '蘇生', '魔剣士', '秘奥義', '頁'];
  for (const [id, a] of Object.entries(DB.actions)) {
    if (!id.startsWith('e_')) continue;
    for (const w of banned73) ok(!a.msg.includes(w) && !a.name.includes(w), id + ' uses STYLE_JA §7.3 word ' + w);
    const bk = JOYO ? badKanji(a.name + a.msg) : [];
    ok(bk.length === 0, id + ' non-jōyō kanji ' + bk.join(''));
    ok(!a.msg.includes('…') || a.msg.includes('……'), id + ' three-dot leader doubled');
  }
});

group('encounter tables (§9.1.4, §9.7.2, M5)', () => {
  const appears = new Set();
  for (const zid of ZONES) {
    const z = DB.encounters[zid];
    if (!ok(z, zid + ' exists')) continue;
    ok(REGIONS.includes(z.region), zid + ' region ' + z.region);
    ok(z.tier === 'dyn' || (Number.isInteger(z.tier) && z.tier >= 0 && z.tier <= 9), zid + ' tier');
    ok(z.region === 'prologue' ? Array.isArray(z.lv) && z.lv.length === 2 && z.tier === 0 : typeof z.lvOff === 'number' && z.lv == null, zid + ' lv (prologue) / lvOff (others)');
    ok(z.bg === null || typeof z.bg === 'string', zid + ' bg');
    if (z.bg && R.Gfx && R.Gfx.has && Object.keys(R.Gfx._defs || {}).some((k) => k.startsWith('bbg:')) && !R.Gfx.has('bbg:' + z.bg)) warn(zid + ' battle background bbg:' + z.bg + ' not registered (A16a)');
    ok(z.tier === 'dyn' ? REGIONS.slice(3).includes(z.region) : true, zid + ' dyn only for mid regions');
    for (const g of z.groups) {
      ok(g.w > 0 && Array.isArray(g.mons) && g.mons.length >= 1 && g.mons.length <= 3, zid + ' group w>0, 1..3 species');
      for (const [ref, a, b] of g.mons) ok(Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= a, zid + ' ' + ref + ' min/max');
      const fixedRefs = g.mons.every(([r]) => r[0] !== '@');
      if (z.tier !== 'dyn') ok(fixedRefs, zid + ' fixed-tier zone uses stage ids (§9.0 0.3)');
      if (z.tier === 'dyn') ok(g.mons.every(([r]) => r[0] === '@'), zid + ' dyn zone uses @lineage refs');
      const everResolves = zoneTiers(z).some((T) => eligible(z, T).some((e) => e.g === g));
      ok(everResolves, zid + ' group ' + JSON.stringify(g.mons) + ' can appear at some tier');
    }
    let sumAvg = 0;
    for (const T of zoneTiers(z)) {
      const el = eligible(z, T);
      ok(el.length >= 4, zid + ' T' + T + ' has ≥4 eligible groups (' + el.length + ')');
      let tw = 0, ts = 0;
      for (const { g, ms } of el) {
        for (const [id] of ms) appears.add(id);
        ok(ms.every(([id]) => DB.monsters[id]), zid + ' refs resolve to monsters');
        const px = ms.reduce((s, [id, , b]) => s + SIZE_PX[DB.monsters[id].size] * b, 0);
        const cnt = ms.reduce((s, [, , b]) => s + b, 0);
        ok(px <= 256 && cnt <= 8, zid + ' T' + T + ' ' + JSON.stringify(g.mons) + ' fits 8 bodies/256px (' + cnt + '/' + px + ')');
        const metal = ms.some(([id]) => isMetal(id));
        if (metal) ok(ms.length === 1 && ms[0][1] >= 1 && ms[0][2] <= 2, zid + ' metal group: one metal species 1..2');
        if (ms.some(([id]) => DB.monsters[id].lineage === 'mimic')) ok(g.solo === true && ms.length === 1 && ms[0][2] === 1, zid + ' mimic group is solo 1');
        if (g.solo || metal) continue;
        const st = ms.reduce((s, [id, a, b]) => s + SIZE_W[DB.monsters[id].size] * (a + b) / 2, 0);
        const [lo, hi] = zid === 'zw_prologue' ? [1, 2] : zid === 'z_prologue_lighthouse' ? [1.5, 2.5] : [2.2, 4.8];
        ok(st >= lo - 1e-9 && st <= hi + 1e-9, zid + ' T' + T + ' ' + JSON.stringify(g.mons) + ' strength ' + st.toFixed(2) + ' in ' + lo + '..' + hi);
        tw += g.w; ts += g.w * st;
      }
      const avg = ts / tw;
      sumAvg += avg;
      const [lo, hi] = zid === 'zw_prologue' ? [1, 2] : zid === 'z_prologue_lighthouse' ? [1.5, 2.5] : [3.0, 3.4];
      ok(avg >= lo && avg <= hi + 1e-9, zid + ' T' + T + ' average strength ' + avg.toFixed(2) + ' in ' + lo + '..' + hi);
      // metal share 2..3% (§4.10.5) where a metal group is eligible in a mid zone
      const wAll = el.reduce((s, e) => s + e.g.w, 0), wMetal = el.filter((e) => e.ms.some(([id]) => isMetal(id))).reduce((s, e) => s + e.g.w, 0);
      if (wMetal && z.tier === 'dyn') ok(wMetal / wAll >= 0.02 && wMetal / wAll <= 0.035, zid + ' T' + T + ' metal weight share ' + (100 * wMetal / wAll).toFixed(1) + '%');
    }
  }
  const never = regular.filter((id) => !appears.has(id));
  ok(never.length === 0, 'every regular monster appears in some zone/tier; missing: ' + never.join(' '));
  // paper (虚ろの使い) in every mid zone from T2 (§10.9.1)
  for (const zid of ZONES) {
    const z = DB.encounters[zid];
    if (z.tier !== 'dyn') continue;
    ok([2, 4, 6, 8].every((T) => eligible(z, T).some((e) => e.ms.some(([id]) => DB.monsters[id].lineage === 'paper'))), zid + ' has 虚ろの使い at T2+');
    ok(eligible(z, 1).every((e) => e.ms.every(([id]) => DB.monsters[id].lineage !== 'paper')), zid + ' no 虚ろの使い before T2');
    const world = zid.startsWith('zw_');
    const metalL = world ? 'quicksilver' : 'mirror';
    const from = world ? 2 : 5;
    ok(eligible(z, from).some((e) => e.ms.some(([id]) => DB.monsters[id].lineage === metalL)) &&
      !eligible(z, from - 1).some((e) => e.ms.some(([id]) => DB.monsters[id].lineage === metalL)), zid + ' ' + metalL + ' from T' + from + ' (§9.7.1)');
  }
});

group('T8 build-set species encounter rate (§9.13.3 L6)', () => {
  // L6: with superPct +100 (rate 1/64) a 9-item set must take ≤ 900 battles when each item is hunted in the zone×tier
  // where its species is met most; the rule of thumb (and our target) is ≥ 0.65 met per battle for every species.
  const SETS = { int: T8_SET.slice(0, 9), dex: T8_SET.slice(9, 18), str: T8_SET.slice(18) };
  const best = {};
  for (const id of T8_SET) {
    let b = 0, where = '';
    for (const zid of ZONES) {
      const z = DB.encounters[zid];
      for (const T of zoneTiers(z)) { const v = CM.perBattle(DB, z, T, id); if (v > b) { b = v; where = zid + '@T' + T; } }
    }
    best[id] = b;
    ok(b >= 0.65, id + ' best zone ' + where + ' gives ' + b.toFixed(2) + ' per battle (≥0.65)');
  }
  for (const [k, ids] of Object.entries(SETS)) {
    const battles = ids.reduce((s, id) => s + 64 / Math.max(1e-6, best[id]), 0);
    ok(battles <= 900, 'L6 ' + k + ' set: expected ' + battles.toFixed(0) + ' battles ≤ 900');
    if (VERBOSE) console.log(`   L6 ${k} set: ${battles.toFixed(0)} battles`);
  }
});

group('weakness bias (§9.3.2, §4.7.3-I)', () => {
  const non = regular.filter((id) => !isMetal(id));
  ok(non.length === 205, 'non-metal regulars 205');
  const e = (m, el) => (m.elem && m.elem[el] != null ? m.elem[el] : 1);
  const p = (m, k) => (m.phys && m.phys[k] != null ? m.phys[k] : 1);
  const lines = [];
  for (const el of ELS) {
    const sp = non.filter((id) => e(DB.monsters[id], el) >= 1.5).length / non.length;
    const lins = Object.entries(DB.lineages).filter(([, L]) => !L.family);
    const ln = lins.filter(([, L]) => L.stages.filter((s) => e(DB.monsters[s.mon], el) >= 1.5).length * 2 >= L.stages.length).length / lins.length;
    lines.push(el + ' ' + (100 * sp).toFixed(1) + '%/' + (100 * ln).toFixed(1) + '%');
    ok(sp >= 0.12 && sp <= 0.25, 'species weak to ' + el + ' ' + (100 * sp).toFixed(1) + '% in 12..25%');
    ok(ln >= 0.12 && ln <= 0.25, 'lineages weak to ' + el + ' ' + (100 * ln).toFixed(1) + '% in 12..25%');
  }
  for (const k of KINDS) {
    const sp = non.filter((id) => p(DB.monsters[id], k) >= 1.25).length / non.length;
    lines.push(k + ' ' + (100 * sp).toFixed(1) + '%');
    ok(sp >= 0.10, 'species weak to ' + k + ' ' + (100 * sp).toFixed(1) + '% ≥ 10%');
  }
  if (VERBOSE) console.log('   weakness share (species/lineages): ' + lines.join('  '));
  // absorption only for bodies of that element (A2 element policy): affinity X or undead dark / lava fire
  for (const id of regular) {
    const m = DB.monsters[id];
    for (const [el, v] of Object.entries(m.elem || {})) if (v < 0) ok(m.affinity === el || (m.race === 'undead' && el === 'dark'), id + ' absorbs ' + el + ' only if its body is ' + el);
  }
});

group('races & flags for techs (§6.10, §9.14.2)', () => {
  const cnt = {};
  for (const id of regular) cnt[DB.monsters[id].race] = (cnt[DB.monsters[id].race] || 0) + 1;
  ok(Object.values(cnt).reduce((a, b) => a + b, 0) === 211, 'race total 211');
  for (const r of ['plant', 'beast', 'undead', 'demon', 'construct', 'slime']) ok(cnt[r] > 0, 'race ' + r + ' present');
  if (VERBOSE) console.log('   races: ' + JSON.stringify(cnt));
  // the lineage heading race/flying agree with every stage
  for (const [lid, info] of Object.entries(D.lineageInfo)) {
    for (const s of DB.lineages[lid].stages) {
      const m = DB.monsters[s.mon];
      ok(m.race === info.race, s.mon + ' race = lineage race');
      if (info.flying) ok(m.flags.includes('flying'), s.mon + ' flying like its lineage');
    }
  }
  // 強化を使う魔物を各地方に 1〜2 体 (§7.14) — per mid region, some regular uses a self/ally buff
  const buffActs = Object.keys(DB.actions).filter((k) => k.startsWith('e_') && DB.actions[k].effects.some((f) => f.type === 'buff' && f.stages > 0));
  for (const reg of REGIONS.slice(3)) {
    const ids = new Set();
    for (const zid of ZONES.filter((z) => DB.encounters[z].region === reg)) {
      for (let T = 0; T <= 8; T++) for (const e of eligible(DB.encounters[zid], T)) for (const [id] of e.ms) ids.add(id);
    }
    ok([...ids].some((id) => DB.monsters[id].actions.some((a) => buffActs.includes(a.id))), reg + ' has a buffing regular monster (§7.14 / §6.10)');
  }
});

group('fillStats / runtime hooks (A2) — when present', () => {
  if (!(R.Mon && R.Mon.def)) { warn('R.Mon.def not available yet (battle A2): runtime resolve checks skipped'); return; }
  for (const id of ['jelly_1', 'wolf_3', 'quicksilver_1', 'treant_4']) {
    let d = null;
    try { d = R.Mon.def(id, { tier: 4 }); } catch (e) { ok(false, 'R.Mon.def(' + id + ') threw ' + e.message); continue; }
    ok(d && d.hp > 0 && d.atk > 0, id + ' R.Mon.def gives hp/atk');
    if (id === 'quicksilver_1') ok(d.hp === 8, 'metal hp stays hpFixed');
  }
  if (R.Mon.resolve) {
    ok(R.Mon.resolve('@wolf', 5) === 'wolf_3' && R.Mon.resolve('@wolf', 8) === 'wolf_5' && R.Mon.resolve('@paper', 1) === null, 'R.Mon.resolve per §9.1.3');
    ok(R.Mon.resolve('@mirror', 6) === 'mirror_1' && R.Mon.resolve('@sandworm', 2) === 'sandworm_1', 'R.Mon.resolve metal/3-stage');
  }
});

// ---------------------------------------------------------------- report
for (const w of warns) console.log('  WARN ' + w);
if (R._nodeLoadErrors && R._nodeLoadErrors.length) {
  const mine = R._nodeLoadErrors.filter((e) => /(lineages|monsters_|enemy_actions|encounters)/.test(e.split(':')[0]));
  ok(mine.length === 0, 'my files load without errors: ' + mine.join(' | '));
  console.log(`  (note: ${R._nodeLoadErrors.length} load error(s) in other owners' files ignored)`);
}
for (const f of fails.slice(0, 80)) console.log('  ✗ ' + f);
if (fails.length > 80) console.log(`  … ${fails.length - 80} more`);
console.log(`[test_mons] ${pass} passed, ${fail} failed, ${warns.length} warning(s)`);
process.exit(fail ? 1 : 0);
