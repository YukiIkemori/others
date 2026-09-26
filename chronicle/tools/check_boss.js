#!/usr/bin/env node
// A12 conformance check: the boss / rare-monster / troop data against the normative DESIGN tables.
//   §9.11.4 (34 bosses, troop table), §9.11.5 (eb_ 191, the code block), §9.11.7 (tutorial troop),
//   §9.10.2 (23 rare monsters), §9.7.3 (rareEncounters block), §9.12.7 / §9.12.8 (drops).
// Every table cell is parsed from DESIGN.md and compared field by field with R.DB.
//   node tools/check_boss.js        exit 1 on any difference
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB;
/** SYSTEMS_REWORK (A18 §2.5, A19 §3.2): DESIGN's drop ids through the save remap (i_seed_wp → i_seed_mp, w_katana_* → w_sword_*) */
const a19 = (dr) => { const o = JSON.parse(JSON.stringify(dr || {})); const M = (DB.remap && DB.remap.items) || {}; for (const k in o) if (o[k] && o[k].item && M[o[k].item]) o[k].item = M[o[k].item]; return o; };
const DESIGN = fs.readFileSync(path.join(__dirname, '..', 'DESIGN.md'), 'utf8');
const lines = DESIGN.split('\n');

let errors = 0, checked = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortObj = (o) => { if (!o || typeof o !== 'object' || Array.isArray(o)) return o; const r = {}; for (const k of Object.keys(o).sort()) r[k] = sortObj(o[k]); return r; };
const same = (what, a, b) => { checked++; if (!eq(sortObj(a), sortObj(b))) err(`${what}: data ${JSON.stringify(sortObj(a))} ≠ DESIGN ${JSON.stringify(sortObj(b))}`); };

const sectionLines = (head) => {
  const i = lines.findIndex((l) => l.startsWith(head));
  if (i < 0) throw new Error('section not found: ' + head);
  const out = [];
  for (let j = i + 1; j < lines.length && !/^#{2,4} /.test(lines[j]); j++) out.push(lines[j]);
  return out;
};
const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
const tick = (s) => (/`([^`]+)`/.exec(s) || [])[1];

const EL = { 火: 'fire', 水: 'water', 風: 'wind', 土: 'earth', 光: 'light', 闇: 'dark' };
const KIND = { 斬: 'slash', 打: 'blunt', 突: 'pierce' };
const ST = { 毒: 'poison', 死: 'death', 気: 'stun', 眠: 'sleep', 混: 'confuse', 麻: 'paralyze', 凍: 'freeze', 黙: 'silence', 暗: 'blind', 焼: 'burn' };
const RACE = { 霊体: 'spirit', 虫: 'insect', 植物: 'plant', 獣: 'beast', 不死: 'undead', 人型: 'humanoid', 竜: 'dragon', 魔造: 'construct', 水生: 'aquatic', 魔族: 'demon', 鳥: 'bird', 妖精: 'fairy', 軟体: 'slime' };
const num = (s) => (s === '吸収' ? -1 : +(s.startsWith('.') ? '0' + s : s));
function parseMap(s, dict) {
  const o = {};
  if (!s || s === '—') return o;
  for (const tok of s.split(/\s+/)) {
    const m = /^([^\d.吸]+)(吸収|[\d.]+)$/.exec(tok);
    if (!m || !dict[m[1]]) { err('cannot parse token ' + tok + ' in ' + s); continue; }
    o[dict[m[1]]] = num(m[2]);
  }
  return o;
}
// the scheduled moves of bosses.js (their table weight × 100 in the data)
const SCHEDULED = new Set((/const SCHEDULED = new Set\(\[([^\]]*)\]/.exec(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'bosses.js'), 'utf8')) || ['', ''])[1].match(/eb_\w+/g) || []);
// deliberate differences from the §9.11.4 table (reported to the lead)
const DEVIATIONS = [
  { mon: 'b_octopus', action: 'eb_regrow', cond: { every: [3, 2] }, why: 'DESIGN 4手ごと@3 gives one chance in a 6-round fight; X3 asks for a regrowth in every battle' },
];
function parseActions(s) {
  return s.split(' · ').map((t) => {
    const m = /^(攻撃|[a-z_]+?)(\d+(?:\.\d+)?)(?:\[(.+)\])?$/.exec(t.trim());
    if (!m) { err('cannot parse action ' + t); return null; }
    const a = { id: m[1] === '攻撃' ? 'attack' : m[1], w: +m[2] };
    if (m[3]) {
      const c = {};
      for (const part of m[3].split(',')) {
        let mm;
        if ((mm = /^(\d+)手ごと@(\d+)$/.exec(part))) c.every = [+mm[1], +mm[2]];
        else if ((mm = /^HP<(\d+)%$/.exec(part))) c.hpBelow = +mm[1] / 100;
        else if ((mm = /^HP>(\d+)%$/.exec(part))) c.hpAbove = +mm[1] / 100;
        else if (part === '1回') c.once = true;
        else if ((mm = /^数<(\d+)$/.exec(part))) c.countBelow = +mm[1];
        else if (part === '倒れた仲間あり') c.allyDown = true;
        else err('cannot parse cond ' + part);
      }
      a.cond = c;
      if (c.every && SCHEDULED.has(a.id)) a.w *= 100; // bosses.js SCHED: scheduled moves dominate on their turn
    }
    return a;
  }).filter(Boolean);
}
const jsish = (s) => JSON.parse(s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":').replace(/:\s*(?!true\b|false\b|null\b)([a-zA-Z_]\w*)(?=\s*[,}])/g, ':"$1"'));
function parsePhases(s) {
  if (!s || s === '—') return undefined;
  return s.split('<br>').map((p) => {
    const m = /^HP<(\d+)%:「(.+)」→ (\{.*\})$/.exec(p.trim());
    if (!m) { err('cannot parse phase ' + p); return null; }
    return { hpBelow: +m[1] / 100, msg: m[2], set: jsish(m[3]) };
  });
}
function parseDrops(s) {
  const d = {};
  if (!s || s === '—') return d;
  const parts = s.split('<br>').map((x) => x.trim());
  const slots = ['normal', 'rare', 'super'];
  let slot = 0;
  for (const p of parts) {
    let m;
    if ((m = /^＋確定 (i_seed_\w+)$/.exec(p))) { d.bonus = { item: m[1], rate: 1 }; continue; }
    if ((m = /^(p_\w+) 1\/1$/.exec(p))) { d.normal = { pool: m[1], rate: 1 }; slot = 1; continue; }
    if ((m = /^(\w+) 1\/(\d+)$/.exec(p))) { d[slots[slot++]] = { item: m[1], rate: +m[2] }; continue; }
    err('cannot parse drop ' + p);
  }
  return d;
}

// ------------------------------------------------------------------ §9.11.4 bosses
console.log('§9.11.4 bosses');
const bossRows = sectionLines('#### 9.11.4').filter((l) => /^\| `b_/.test(l)).map(cells);
same('boss count', Object.keys(DB.monsters).filter((k) => k.startsWith('b_')).length, bossRows.length);
for (const c of bossRows) {
  const id = tick(c[0]), d = DB.monsters[id];
  if (!d) { err('missing boss ' + id); continue; }
  same(id + '.name', d.name, c[1]);
  same(id + '.sprite', d.sprite, tick(c[4]));
  const [race, fly] = c[5].split('・');
  same(id + '.race', d.race, RACE[race]);
  same(id + '.flying', (d.flags || []).includes('flying'), fly === '飛');
  same(id + '.boss flag', (d.flags || []).includes('boss'), true);
  same(id + '.elem', d.elem || {}, parseMap(c[6], EL));
  const [ph, rs] = c[7].split(' / ');
  same(id + '.phys', d.phys || {}, parseMap(ph, KIND));
  same(id + '.statusRes', d.statusRes || {}, parseMap(rs, ST));
  const acts = parseActions(c[8]);
  for (const dv of DEVIATIONS) if (dv.mon === id) { const a = acts.find((x) => x.id === dv.action); if (a) { Object.assign(a.cond, dv.cond); console.log(`  (known deviation) ${id} ${dv.action} ${JSON.stringify(dv.cond)}: ${dv.why}`); } }
  same(id + '.actions', d.actions, acts);
  const flatP = (ps) => ps && ps.map((p) => Object.assign({}, p, { msg: p.msg.replace(/\n|　/g, '') }));
  same(id + '.phases', flatP(d.phases), flatP(parsePhases(c[9])));
  same(id + '.drops', d.drops || {}, a19(parseDrops(c[10])));
  const share = /HP の取り分 ([\d.]+)/.exec(c[2]);
  if (share) same(id + '.hpShare', d.hpShare, +share[1]);
  if (/行動1回/.test(c[2])) same(id + '.actsPerTurn', d.actsPerTurn, 1);
  if (/行動2回/.test(c[2])) same(id + '.actsPerTurn', d.actsPerTurn, 2);
  if (/行動3回/.test(c[2])) same(id + '.actsPerTurn', d.actsPerTurn, 3);
  const typ = { 序章: 'prologue', 中ボス: 'mid', 地方ボス: 'region', お供: 'add', ライバル: 'rival', 終盤の中ボス: 'fmid', ラスボス1: 'last1', ラスボス2: 'last2', 裏の中ボス: 'echo', 裏ボス: 'super' };
  const t0 = Object.keys(typ).sort((a, b) => b.length - a.length).find((k) => c[2].startsWith(k));
  same(id + '.bossType', d.bossType, typ[t0]);
  // the troop holds it (or it is summoned into it)
  const tr = DB.troops[tick(c[3])];
  const inTroop = tr && (tr.mons.some(([m]) => m === id) || Object.values(DB.monsters).some((m) => tr.mons.some(([x]) => x === m.sprite) && false));
  const summoned = Object.values(DB.actions).some((a) => a.effects && a.effects.some((e) => e.type === 'summon' && e.mon === id));
  checked++; if (!inTroop && !summoned) err(id + ' not in ' + tick(c[3]));
}

// §9.11.2 levels (tier-scaled troops: LZ(0)+lvOff; fixed: LZ(T)+lvOff; prologue lv 8)
console.log('§9.11.2 levels');
const LZ = (T) => 6 + 6 * T;
for (const [tid, tr] of Object.entries(DB.troops)) {
  if (!/^tr_b_/.test(tid)) continue;
  const lb = tr.lv != null ? tr.lv : LZ(tr.scale === 'tier' ? 0 : tr.tier) + tr.lvOff;
  for (const [m] of tr.mons) if (DB.monsters[m] && (DB.monsters[m].flags || []).includes('boss')) same(m + '.lv (' + tid + ')', DB.monsters[m].lv, lb);
}

// ------------------------------------------------------------------ troop table
console.log('§9.11.4 troops / §9.11.7 tutorial');
const troopRows = sectionLines('#### 9.11.4').filter((l) => /^\| `tr_/.test(l)).map(cells);
same('boss troop count', Object.keys(DB.troops).filter((k) => /^tr_b_/.test(k)).length, troopRows.length);
for (const c of troopRows) {
  const id = tick(c[0]), t = DB.troops[id];
  if (!t) { err('missing troop ' + id); continue; }
  const want = c[1].match(/`([^`]+)`/g).map((x) => x.slice(1, -1));
  same(id + '.mons', t.mons.flatMap(([m, n]) => Array(n).fill(m)), want);
  if (/scale:'tier'/.test(c[2])) { same(id + '.scale', t.scale, 'tier'); same(id + '.lvOff', t.lvOff, +c[3].replace('+', '')); }
  else {
    same(id + '.tier', t.tier, +(/^(\d+)/.exec(c[2]) || [])[1]);
    if (/^lv /.test(c[3])) same(id + '.lv', t.lv, +c[3].slice(3)); else same(id + '.lvOff', t.lvOff, +c[3].replace('+', ''));
  }
  // §11.0 0.17 / §11.13: the P2 tunes and backdrops replace these once they exist (troops.js onData)
  const P2 = { tr_b_nemrea1: { bgm: 'hollowking', bg: 'hollow' }, tr_b_nemrea2: { bg: 'hollow' }, tr_b_valzard_echo: { bgm: 'valzard' }, tr_b_ouroboros: { bg: 'ring' } }[id] || {};
  if (P2.bg && t.bg === P2.bg) c[4] = '`' + P2.bg + '`';
  // R3.1: the dragon fights on the summit (frost_peak_3 bbg 'peak', §11.2.12; `peak` falls back to `snow`)
  if (id === 'tr_b_whitedragon' && t.bg === 'peak' && tick(c[4]) === 'snow') c[4] = '`peak`';
  if (P2.bgm && t.bgm === P2.bgm) c[5] = '`' + P2.bgm + '`';
  same(id + '.bgm', t.bgm, tick(c[5]));
  same(id + '.bg', t.bg || null, tick(c[4]) || null);
  same(id + '.noEscape', t.noEscape, true);
}
const tut = /`tr_tutorial: (\{.*\})`/.exec(DESIGN);
same('tr_tutorial', DB.troops.tr_tutorial, jsish(tut[1].replace(/'/g, '"').replace(/"(\w+)"/g, '"$1"')));

// ------------------------------------------------------------------ §9.11.5 eb_ actions (code block)
console.log('§9.11.5 eb_ actions');
{
  const i = lines.findIndex((l) => l.startsWith('#### 9.11.5'));
  const a = lines.indexOf('```js', i), b = lines.indexOf('```', a + 1);
  const code = lines.slice(a + 1, b).join('\n');
  const sandbox = { R: { DB: { actions: {} } } };
  new Function('R', code)(sandbox.R);
  const spec = sandbox.R.DB.actions;
  const mine = Object.fromEntries(Object.entries(DB.actions).filter(([k]) => k.startsWith('eb_')));
  same('eb_ count', Object.keys(mine).length, Object.keys(spec).length);
  same('eb_ order', Object.keys(mine), Object.keys(spec));
  // STYLE_JA §1 (one message line ≤ 20, {user} = 5) is the authority for text: the data breaks the longer
  // messages with \n (and drops the full-width space before a break); compare the text without the breaks
  const flat = (a) => a && Object.assign({}, a, { msg: typeof a.msg === 'string' ? a.msg.replace(/\n|　/g, '') : a.msg });
  for (const k in spec) same(k, flat(mine[k]), flat(spec[k]));
}

// ------------------------------------------------------------------ §9.10.2 rare monsters
console.log('§9.10.2 rare monsters');
const rareRows = sectionLines('#### 9.10.2').filter((l) => /^\| `rm_/.test(l)).map(cells).filter((c) => c.length >= 11);
same('rare count', Object.keys(DB.monsters).filter((k) => k.startsWith('rm_')).length, rareRows.length);
const S_KEYS = { hp: 'hp', atk: 'atk', mag: 'mag', def: 'def', mdef: 'mdef', agi: 'agi' };
for (const c of rareRows) {
  const id = tick(c[0]), d = DB.monsters[id];
  if (!d) { err('missing rare ' + id); continue; }
  same(id + '.name', d.name, c[1]);
  const sp = /`(\w+)`（([sml])）/.exec(c[2]);
  same(id + '.sprite', d.sprite, sp[1]);
  same(id + '.size', d.size, sp[2]);
  const [race, fly] = c[3].split('・');
  same(id + '.race', d.race, RACE[race]);
  same(id + '.flying', (d.flags || []).includes('flying'), fly === '飛');
  same(id + '.rare flag', (d.flags || []).includes('rare'), true);
  const z = /`(\w+)` 1\/(\d+)/.exec(c[4]);
  same(id + ' zone', DB.rareEncounters[z[1]], { mon: id, rate: +z[2] });
  same(id + '.elem', d.elem || {}, parseMap(c[5], EL));
  const [ph, rs] = c[6].split(' / ');
  same(id + '.phys', d.phys || {}, parseMap(ph, KIND));
  const res = Object.assign({}, d.statusRes || {});
  if (res.death === 1 && !/死1/.test(rs)) delete res.death;       // 即死 immunity is written explicitly (§9.10.1)
  same(id + '.statusRes', res, parseMap(rs, ST));
  const [sPart, acts2] = c[7].split('・');
  const s = {};
  for (const tok of sPart.split(/\s+/)) { const m = /^([a-z]+)([\d.]+)$/.exec(tok); if (m && S_KEYS[m[1]]) s[m[1]] = num(m[2]); }
  same(id + '.s', d.s, s);
  same(id + '.actsPerTurn', d.actsPerTurn || 1, acts2 === '行動2回' ? 2 : 1);
  same(id + '.actions', d.actions, parseActions(c[8]));
  same(id + '.drops', d.drops, a19(parseDrops(c[9])));
  same(id + '.desc', d.desc, c[10].replace('<br>', '\n'));
  same(id + '.fleeRate', d.fleeRate, 0.25);
}
// HP examples (§9.10.2 second table: curve × size × s.hp at the zone's Lb + 2)
{
  const hpc = (L) => 6 + 2.6 * L + 0.1 * L * L;
  const SZ = { s: 0.7, m: 1, l: 2 };
  const rows = sectionLines('#### 9.10.2').filter((l) => /^\| `rm_/.test(l)).map(cells).filter((c) => c.length === 4);
  for (const c of rows) {
    const id = tick(c[0]), d = DB.monsters[id];
    for (const m of c[2].matchAll(/Lb(\d+) HP(\d+)/g)) same(`${id} HP at Lb${m[1]}`, Math.round(hpc(+m[1]) * SZ[d.size] * d.s.hp), +m[2]);
    const first = /Lb(\d+)/.exec(c[2]);
    same(id + '.lv (first Lb)', d.lv, +first[1]);
  }
}

// ------------------------------------------------------------------ §9.7.3 rareEncounters block
console.log('§9.7.3 rareEncounters');
{
  const i = DESIGN.indexOf('Object.assign(R.DB.rareEncounters, {');
  const j = DESIGN.indexOf('});', i);
  const sandbox = { rareEncounters: {} };
  new Function('R', DESIGN.slice(i, j + 3))({ DB: sandbox });
  // rows other owners derive for the §10.6.4 rare-monster rooms (a copy of a zone with the rate ÷ 3) are not A12's
  const mine = {};
  for (const [z, r] of Object.entries(DB.rareEncounters)) {
    const base = Object.entries(sandbox.rareEncounters).find(([bz, b]) => bz !== z && b.mon === r.mon);
    if (sandbox.rareEncounters[z] || !base) mine[z] = r;
    else same('rare room ' + z + ' (copy of ' + base[0] + ', rate ÷ 3)', r, { mon: base[1].mon, rate: Math.max(1, Math.ceil(base[1].rate / 3)) });
  }
  same('rareEncounters', mine, sandbox.rareEncounters);
}

// ------------------------------------------------------------------ §9.12.7 / §9.12.8 drops
console.log('§9.12.7 / §9.12.8 drops');
for (const c of sectionLines('#### 9.12.7').filter((l) => /^\| `rm_/.test(l)).map(cells)) {
  const id = tick(c[0]), d = DB.monsters[id];
  const n = /`(\w+)` 1\/(\d+)/.exec(c[3]), r = /`(\w+)` .* 1\/(\d+)/.exec(c[4]), s = /`(\w+)`.* 1\/(\d+)$/.exec(c[5]);
  same(id + ' drops (§9.12.7)', d.drops, a19({ normal: { item: n[1], rate: +n[2] }, rare: { item: r[1], rate: +r[2] }, super: { item: s[1], rate: +s[2] } }));
}
{
  const seeds = {};
  for (const [id, d] of Object.entries(DB.monsters)) if (/^b_/.test(id) && d.drops && d.drops.bonus) seeds[d.drops.bonus.item] = (seeds[d.drops.bonus.item] || 0) + 1;
  same('seed counts (§9.12.8; A18: the 5 WP seeds are MP seeds, SYSTEMS_REWORK §2.5)', seeds, { i_seed_hp: 9, i_seed_mp: 11 });
  const rs = Object.entries(DB.monsters).filter(([id, d]) => /^b_/.test(id) && d.drops && (d.drops.rare || d.drops.super)).map(([id]) => id).sort();
  same('bosses with rare/super slots', rs, ['b_ouroboros', 'b_valzard_echo']);
}

console.log(`\ncheck_boss: ${checked} comparisons, ${errors} difference(s)`);
process.exit(errors ? 1 : 0);
