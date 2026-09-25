#!/usr/bin/env node
// Checker for the rare monsters (src/data/rare.js): references + battle simulation.
//
//   node tools/check_rare.js                 checks + sim (300 fights per row)
//   node tools/check_rare.js --n 1000 --seed 7
//   node tools/check_rare.js --no-sim        reference checks only
//
// References: the fixed spec below (ids, names, levels, zones) · every rare zone exists and
// maps to its monster at 1.2–2 % · sprite key mon:<id> registered · flags rare+flee, fleeRate
// 0.35–0.5 · 2–4 actions that exist · drop 1/4–1/8, rare drop = its exclusive rx_* item at
// 1/64–1/128, steal = a seed + the exclusive item · exclusive items: rare, unsellable, DESIGN
// §5.1/§5.4 schema, menu-width names/descs, found nowhere else (other monsters, shops, chests,
// hidden spots, events, R.ITEM_TIERS/R.ITEM_RARE) · rewards vs regular monsters of the level.
// Sim: R.Battle.simulate with the party model of tools/sim_balance.js (its stage table and
// party builder are loaded from that file, so both tools always agree) at the arrival level
// of every stage whose zones hold the monster, plus the monster's own level:
//   stay  = a copy of the monster that never runs: win %, rounds, party HP lost, deaths
//   real  = the monster as shipped: how often it is beaten, average round it runs away
// Targets: at its own level the party wins ≥ 97 % of 'stay' fights losing ≤ 45 % HP; the monster
// is beaten in 25–70 % of real encounters (it is meant to slip away often).
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/load')({ quiet: true });
R.warn = () => {};
const { DB, U, Rules, State } = R;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = +arg('n', 300);
const SEED = +arg('seed', 4242);
const SIM = !argv.includes('--no-sim');

const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
for (const e of R._nodeLoadErrors) E('load: ' + e.split('\n')[0]);

// ------------------------------------------------------------------ the spec
const SPEC = [
  { id: 'rare_hare', name: '宝石ウサギ', size: 48, lv: 8, zones: 'w_start w_east d_wind1 d_wind2 d_fort1 d_fort2' },
  { id: 'rare_lizard', name: '金剛トカゲ', size: 48, lv: 16, zones: 'w_sea1 w_forest w_desert d_water1 d_water2 d_pyr1 d_pyr2 d_pyr3' },
  { id: 'rare_bird', name: 'オーロラ鳥', size: 48, lv: 23, zones: 'w_sea2 w_snow w_volcano d_ice1 d_ice2 d_vol1 d_vol2' },
  { id: 'rare_whale', name: '星くじら', size: 64, lv: 28, zones: 'w_sea3 w_arcana d_star1 d_star2 d_star3 d_star4' },
  { id: 'rare_idol', name: '黄金の守護像', size: 48, lv: 36, zones: 'w_demon d_demon1 d_demon2 d_demon3 d_demon4 d_demon5' },
  { id: 'rare_prism', name: 'プリズマ', size: 48, lv: 55, zones: 'd_abyss1 d_abyss2 d_abyss3 d_abyss4', postgame: true },
].map((s) => Object.assign(s, { zones: s.zones.split(' ') }));
const RARE_IDS = SPEC.map((s) => s.id);
const MAIN = SPEC.filter((s) => !s.postgame); // post-game rare: balanced by tools/sim_postgame.js

const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);
const ELEMENTS = ['fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark'];
const STATUSES = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death', 'regen'];
const STATS = ['str', 'vit', 'agi', 'int', 'mnd', 'luk', 'hp', 'mp'];
const TARGETS = ['enemy', 'enemies', 'group', 'random', 'ally', 'allies', 'self', 'ally_dead', 'ally_any'];
const EFFECTS = ['damage', 'heal', 'healMp', 'revive', 'cure', 'status', 'buff', 'dispel', 'steal', 'scan', 'escape', 'regen', 'grow'];
const BUFFS = ['atk', 'def', 'mag', 'mdef', 'agi'];
const MODS = new Set(('hpPct mpPct strPct vitPct agiPct intPct mndPct lukPct atk def mag mdef hit eva crit atkPct defPct magPct mdefPct ' +
  'physPct magicPct healPct itemPct mpCostPct critPct escapePct preemptPct elemBoost elemResist statusImmune startBuffs regen ' +
  'twoSwords unarmed equip expPct jpPct goldPct dropPct rarePct stealPct autoSteal encounterPct walkHeal noFloorDamage treasureSense').split(' '));
const SLOT_OF = { helm: 'head', hat: 'head', heavy: 'body', light: 'body', robe: 'body', shield: 'shield' };
const WTYPES = ['sword', 'knife', 'axe', 'spear', 'staff', 'rod', 'bow', 'claw', 'katana', 'harp'];
const BUILTIN_ACTS = ['attack', 'defend', 'wait', 'flee'];
const SEEDS = ['seed_str', 'seed_vit', 'seed_agi', 'seed_int', 'seed_mnd', 'seed_luk', 'seed_hp', 'seed_mp'];
const LARGE_SPRITES = ['orc', 'golem', 'wyvern', 'chimera', 'yeti', 'kraken', 'demon', 'sandworm', 'minotaur'];
const SMALL_SPRITES = ['jelly', 'bat', 'rat', 'mushroom', 'bee', 'wisp', 'imp', 'mimic', 'eyeball'];

// text widths as the menus measure them (≈11 px per full-width char, 220–226 px boxes)
const width = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x80 ? 0.5 : 1), 0);
function wrapLines(str, units) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && width(line + ch) > units) {
        if ('、。」』）！？…ー'.includes(ch)) { line += ch; continue; }
        out.push(line); line = ch;
      } else line += ch;
    }
    out.push(line);
  }
  return out;
}
const JA = '[\\u3000-\\u30ff\\u4e00-\\u9fff\\uff01-\\uff5e]';
const DQ_SPACE = new RegExp(`${JA} | ${JA}|(^|[^！？])\u3000`);
const HERO_NAMES = /ユウキ|メテム|(^|[^ァ-ヶー])ノン/;
function checkText(where, text, maxLines, units) {
  if (!text || typeof text !== 'string') { E(`${where}: missing text`); return; }
  const lines = wrapLines(text, units);
  if (lines.length > maxLines) E(`${where}: needs ${lines.length} lines (max ${maxLines}): ${text}`);
  if (lines.length > 1 && !text.includes('\n')) W(`${where}: wraps mid-phrase, add a \\n: ${text}`);
  if (DQ_SPACE.test(text)) E(`${where}: DQ-style space: ${text}`);
  if (HERO_NAMES.test(text)) E(`${where}: hard-coded hero name`);
  if (!/[一-鿿]/.test(text)) W(`${where}: no kanji (old all-kana style?): ${text}`);
}
function checkMods(where, m) {
  for (const k in m || {}) {
    if (!MODS.has(k)) E(`${where}: mod '${k}' is not in DESIGN §5.4`);
    if ((k === 'elemResist' || k === 'elemBoost')) for (const e in m[k]) if (!ELEMENTS.includes(e)) E(`${where}: bad element ${e}`);
    if (k === 'statusImmune') for (const s of m[k]) if (!STATUSES.includes(s)) E(`${where}: bad status ${s}`);
    if (k === 'startBuffs') for (const s in m[k]) if (!BUFFS.includes(s)) E(`${where}: bad buff ${s}`);
  }
}
function checkEffects(where, effects) {
  if (!Array.isArray(effects) || !effects.length) { E(`${where}: no effects`); return; }
  for (const f of effects) {
    if (!EFFECTS.includes(f.type)) E(`${where}: effect '${f.type}' not usable in battle`);
    if (f.type === 'damage' && (!['phys', 'magic', 'fixed', 'percent', 'breath'].includes(f.formula) || typeof f.power !== 'number')) E(`${where}: bad damage effect`);
    if (f.element && !ELEMENTS.includes(f.element)) E(`${where}: bad element ${f.element}`);
    if (f.type === 'status' && (!STATUSES.includes(f.status) || !(f.chance > 0 && f.chance <= 1))) E(`${where}: bad status effect`);
    if (f.type === 'buff' && (!BUFFS.includes(f.stat) || !Number.isInteger(f.stages))) E(`${where}: bad buff effect`);
  }
}

// ------------------------------------------------------------ references
const items = DB.items, mons = DB.monsters, rareEnc = DB.rareEncounters || {};
const exclusive = {}; // item id → monster id
for (const s of MAIN) {
  const m = mons[s.id], w = `monster ${s.id}`;
  if (!m) { E(`${w}: missing`); continue; }
  if (m.name !== s.name) E(`${w}: name ${m.name} (spec ${s.name})`);
  if (m.lv !== s.lv) E(`${w}: lv ${m.lv} (spec ${s.lv})`);
  if (m.sprite !== s.id) E(`${w}: sprite must be '${s.id}' (is ${m.sprite})`);
  if (m.hue || m.sat != null || m.bri != null) E(`${w}: palette variant fields on a dedicated sprite`);
  if (!(R.Gfx && R.Gfx._defs && has(R.Gfx._defs, 'mon:' + m.sprite))) E(`${w}: sprite mon:${m.sprite} not registered (art)`);
  for (const k of ['hp', 'mp', 'atk', 'def', 'agi', 'mag', 'mdef', 'exp', 'gold', 'jp']) if (!Number.isFinite(m[k]) || m[k] < 0) E(`${w}: bad ${k}`);
  const flags = m.flags || [];
  for (const f of ['rare', 'flee']) if (!flags.includes(f)) E(`${w}: flag '${f}' missing`);
  if (flags.includes('boss') || flags.includes('metal')) E(`${w}: must not be boss/metal`);
  if (!(m.fleeRate >= 0.35 && m.fleeRate <= 0.5)) E(`${w}: fleeRate ${m.fleeRate} outside 0.35–0.5`);
  const acts = m.actions || [];
  if (acts.length < 2 || acts.length > 4) E(`${w}: ${acts.length} actions (2–4)`);
  for (const a of acts) {
    if (BUILTIN_ACTS.includes(a.id)) continue;
    const ab = DB.abilities[a.id];
    if (!ab) { E(`${w}: action ${a.id} missing`); continue; }
    if (!a.id.startsWith('en_')) E(`${w}: action ${a.id} is not an enemy ability`);
    if (ab.kind !== 'action') E(`${w}: action ${a.id} is not kind 'action'`);
    if ((ab.mp || 0) > (m.mp || 0)) E(`${w}: cannot afford ${a.id} (${ab.mp} MP, has ${m.mp || 0})`);
  }
  for (const e in m.elem || {}) if (!ELEMENTS.includes(e)) E(`${w}: bad element ${e}`);
  for (const st in m.statusRes || {}) if (!STATUSES.includes(st)) E(`${w}: bad status ${st}`);
  if (!m.statusRes || m.statusRes.death !== 1) W(`${w}: not immune to instant death`);
  // loot
  if (!m.drop || !items[m.drop.item]) E(`${w}: drop item missing`);
  else if (!(m.drop.rate >= 4 && m.drop.rate <= 8)) E(`${w}: drop rate 1/${m.drop.rate} outside 1/4–1/8`);
  if (!m.rare || !items[m.rare.item]) E(`${w}: rare item missing`);
  else {
    if (!(m.rare.rate >= 64 && m.rare.rate <= 128)) E(`${w}: rare rate 1/${m.rare.rate} outside 1/64–1/128`);
    if (!/^(rx|pg)_/.test(m.rare.item)) E(`${w}: rare item ${m.rare.item} is not an exclusive rx_/pg_ item`);
    if (exclusive[m.rare.item]) E(`${w}: rare item ${m.rare.item} also used by ${exclusive[m.rare.item]}`);
    exclusive[m.rare.item] = s.id;
  }
  if (!m.steal || !SEEDS.includes(m.steal.item)) E(`${w}: steal item must be a seed`);
  if (!m.steal || !m.rare || m.steal.rare !== m.rare.item) E(`${w}: rare steal must be the exclusive item`);
  checkText(`${w} desc`, m.desc, 2, 226 / 11);
  // battle messages: one line of the 220 px battle window
  if (m.appear) checkText(`${w} appear`, m.appear, 1, 20);
  for (const a of acts) {
    const ab = DB.abilities[a.id];
    if (a.id.startsWith('en_rx_') && ab) {
      if (!ab.msg) E(`ability ${a.id}: no msg`);
      else checkText(`ability ${a.id} msg`, ab.msg.replace(/\{user\}/g, m.name), 1, 20);
      checkEffects(`ability ${a.id}`, ab.effects);
      if (!TARGETS.includes(ab.target)) E(`ability ${a.id}: bad target ${ab.target}`);
    }
  }
  // zones
  for (const z of s.zones) {
    const r = rareEnc[z];
    if (!DB.encounters[z]) E(`${w}: zone ${z} has no encounter table`);
    if (!r) E(`rareEncounters: zone ${z} missing`);
    else {
      if (r.mon !== s.id) E(`rareEncounters ${z}: ${r.mon} (spec ${s.id})`);
      if (!(r.rate >= 0.012 && r.rate <= 0.02)) E(`rareEncounters ${z}: rate ${r.rate} outside 0.012–0.02`);
    }
  }
}
for (const z in rareEnc) if (!SPEC.some((s) => s.zones.includes(z))) E(`rareEncounters: zone ${z} is not in the spec`);
for (const id in DB.abilities) {
  if (id.startsWith('en_rx_') && !RARE_IDS.some((mid) => mons[mid] && (mons[mid].actions || []).some((a) => a.id === id))) W(`ability ${id}: used by no rare monster`);
}
for (const id in mons) if (!RARE_IDS.includes(id) && (mons[id].flags || []).includes('rare')) W(`monster ${id}: flag 'rare' but not in the spec`);

// exclusive items
for (const id in items) if (id.startsWith('rx_') && !exclusive[id]) E(`item ${id}: rx_ item carried by no rare monster`);
const names = {};
for (const id in items) names[items[id].name] = (names[items[id].name] || 0) + 1;
for (const id in exclusive) {
  const it = items[id], w = `item ${id}`;
  if (!it.rare) E(`${w}: must be rare:true`);
  if (it.price !== 0) W(`${w}: price ${it.price} (exclusive items are unsellable: price 0)`);
  if (it.exclusive !== exclusive[id]) E(`${w}: exclusive '${it.exclusive}' but dropped by ${exclusive[id]}`);
  if (!['weapon', 'shield', 'head', 'body', 'acc'].includes(it.type)) E(`${w}: exclusive items are equipment (type ${it.type})`);
  if (it.type === 'weapon' && (!WTYPES.includes(it.wtype) || !(it.atk > 0))) E(`${w}: bad weapon fields`);
  if (SLOT_OF[it.atype] && SLOT_OF[it.atype] !== it.type) E(`${w}: atype ${it.atype} does not fit type ${it.type}`);
  if (['shield', 'head', 'body'].includes(it.type) && !(it.def > 0)) E(`${w}: armour without def`);
  if (it.type === 'acc' && !it.stats && !it.mods) E(`${w}: accessory does nothing`);
  for (const k in it.stats || {}) if (!STATS.includes(k)) E(`${w}: bad stat ${k}`);
  checkMods(w, it.mods);
  if (!Number.isInteger(it.sort)) E(`${w}: no sort`);
  if (!(it.band >= 1 && it.band <= 6)) E(`${w}: band 1–6`);
  if (!it.name || width(it.name) > 9) E(`${w}: name '${it.name}' wider than 9`);
  if (names[it.name] > 1) E(`${w}: duplicate name ${it.name}`);
  checkText(`${w} desc`, it.desc, 2, 20);
}
// found nowhere else
for (const mid in mons) {
  if (RARE_IDS.includes(mid)) continue;
  const m = mons[mid];
  for (const [slot, id] of [['drop', m.drop && m.drop.item], ['rare', m.rare && m.rare.item], ['steal', m.steal && m.steal.item], ['steal★', m.steal && m.steal.rare]])
    if (exclusive[id]) E(`monster ${mid}.${slot}: exclusive item ${id} (belongs to ${exclusive[id]})`);
}
for (const sid in DB.shops) for (const id of DB.shops[sid].items || []) if (exclusive[id]) E(`shop ${sid} sells exclusive ${id}`);
for (const [pool, obj] of [['ITEM_TIERS', R.ITEM_TIERS], ['ITEM_RARE', R.ITEM_RARE]]) for (const k in obj || {}) for (const id of obj[k]) if (exclusive[id]) E(`R.${pool}.${k} lists exclusive ${id}`);
for (const mapId in DB.maps) {
  const map = DB.maps[mapId];
  const spots = [...(map.chests || []), ...(map.hidden || [])];
  for (const k in map.marks || {}) { const mk = map.marks[k]; if (mk.chest) spots.push(mk.chest); if (mk.hidden) spots.push(mk.hidden); }
  for (const c of spots) if (exclusive[c.item]) E(`map ${mapId}: chest/hidden ${c.id} holds exclusive ${c.item}`);
}
for (const eid in DB.events) for (const g of (DB.events[eid].meta || {}).gives || []) if (typeof g === 'string' && exclusive[g.replace(/^item:/, '')]) E(`event ${eid} gives exclusive ${g}`);
const srcDir = path.join(__dirname, '..', 'src');
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.js') || p.endsWith(path.join('data', 'rare.js'))) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const id in exclusive) if (src.includes(`'${id}'`)) E(`${path.relative(path.join(srcDir, '..'), p)}: mentions exclusive ${id}`);
  }
})(srcDir);

// ------------------------------------------------------------ rewards vs regular monsters
const sizeOf = (m) => (LARGE_SPRITES.includes(m.sprite) ? 'l' : SMALL_SPRITES.includes(m.sprite) ? 's' : 'm');
const regular = Object.keys(mons).filter((id) => {
  const m = mons[id], f = m.flags || [];
  return !RARE_IDS.includes(id) && !f.includes('boss') && !f.includes('metal') && !f.includes('rare') && sizeOf(m) === 'm' && /^[a-z]/.test(id) && !id.includes('__');
});
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
function peers(lv) {
  for (const d of [0, 1, 2, 3]) {
    const list = regular.filter((id) => Math.abs(mons[id].lv - lv) <= d).map((id) => mons[id]);
    if (list.length >= 2) return list;
  }
  return [];
}
const rewardRows = [];
for (const s of MAIN) {
  const m = mons[s.id];
  if (!m) continue;
  const p = peers(s.lv);
  const ref = { exp: median(p.map((x) => x.exp)), gold: median(p.map((x) => x.gold)), jp: median(p.map((x) => x.jp)), hp: median(p.map((x) => x.hp)), atk: median(p.map((x) => x.atk)), def: median(p.map((x) => x.def)) };
  const rx = (k) => (ref[k] ? m[k] / ref[k] : 0);
  rewardRows.push({ s, m, ref, rx });
  if (rx('exp') < 4.5 || rx('exp') > 9.5) W(`${s.id}: EXP ${m.exp} is ×${rx('exp').toFixed(1)} a regular Lv${s.lv} monster (${ref.exp}); aim ×5–8`);
  if (rx('gold') < 4.5 || rx('gold') > 11) W(`${s.id}: gold ${m.gold} is ×${rx('gold').toFixed(1)} a regular Lv${s.lv} monster (${ref.gold}); aim ×5–10`);
  if (rx('jp') < 3) W(`${s.id}: JP ${m.jp} is only ×${rx('jp').toFixed(1)} a regular monster`);
}

// ------------------------------------------------------------ battle sim
// party model: tools/sim_balance.js' stage table + party builder, evaluated in this process
function loadPartyModel() {
  const src = fs.readFileSync(path.join(__dirname, 'sim_balance.js'), 'utf8');
  const a = src.indexOf('// --------------------------------------------------------------- stages');
  const b = src.indexOf('// --------------------------------------------------------------- output');
  if (a < 0 || b < a) throw new Error('tools/sim_balance.js: stage/party section markers not found');
  // eslint-disable-next-line no-new-func
  return new Function('R', 'DB', 'U', 'Rules', 'State', src.slice(a, b) + '\nreturn { STAGES, buildParty, bagFor };')(R, DB, U, Rules, State);
}

const pad = (s, n) => { s = String(s); let w = 0; for (const ch of s) w += /[\u3000-\uffff]/.test(ch) ? 2 : 1; return s + ' '.repeat(Math.max(0, n - w)); };
const padL = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; };
const f0 = (x) => String(Math.round(x));
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

function runMany(party, inv, monId, n, salt) {
  const acc = { n, win: 0, lose: 0, kill: 0, fled: 0, rounds: 0, fleeRound: 0, hpLost: 0, deaths: 0 };
  for (let i = 0; i < n; i++) {
    const r = R.Battle.simulate({ party, inv, mons: [[monId, 1]], items: false, seed: SEED * 7919 + i * 31 + salt });
    if (r.result === 'lose') acc.lose++;
    if (r.result === 'win') acc.win++;
    if (r.killed) acc.kill++;
    else if (r.result === 'win') { acc.fled++; acc.fleeRound += r.rounds; }
    acc.rounds += r.rounds;
    acc.hpLost += 100 - r.partyHpPct;
    acc.deaths += r.deaths;
  }
  return {
    winPct: (100 * acc.win) / n, losePct: (100 * acc.lose) / n, killPct: (100 * acc.kill) / n, fledPct: (100 * acc.fled) / n,
    rounds: acc.rounds / n, fleeRound: acc.fled ? acc.fleeRound / acc.fled : 0, hpLost: acc.hpLost / n, deaths: acc.deaths / n,
  };
}

const simRows = [];
let model = null;
if (SIM) {
  try { model = loadPartyModel(); } catch (e) { E('party model: ' + e.message); }
  if (model) {
    for (const s of MAIN) {
      const m = mons[s.id];
      if (!m) continue;
      // a copy that never runs away (same stats, same AI)
      const stayId = s.id + '__stay';
      DB.monsters[stayId] = Object.assign({}, m, { flags: (m.flags || []).filter((f) => f !== 'flee') });
      const stages = model.STAGES.map((st, si) => ({ st, si })).filter(({ st }) => st.zones.some((z) => s.zones.includes(z)));
      const points = stages.map(({ st, si }) => ({ si, L: st.lv[0], label: st.id }));
      const own = stages.find(({ st }) => s.lv >= st.lv[0] && s.lv <= st.lv[1]) || stages[stages.length - 1];
      if (own && !points.some((p) => p.si === own.si && p.L === s.lv)) points.push({ si: own.si, L: s.lv, label: own.st.id, own: true });
      else if (own) points.find((p) => p.si === own.si && p.L === s.lv).own = true;
      points.sort((a, b) => a.L - b.L || a.si - b.si);
      for (const p of points) {
        const party = model.buildParty(p.si, p.L), inv = model.bagFor(p.si);
        const stay = runMany(party, inv, stayId, N, 17);
        const real = runMany(party, inv, s.id, N, 29);
        simRows.push({ s, p, stay, real });
        const tag = `${s.id} @${p.label} Lv${p.L}`;
        if (p.own) {
          if (stay.winPct < 97) W(`${tag}: party wins only ${f0(stay.winPct)}% when it does not flee (target ≥ 97%)`);
          if (stay.hpLost > 45) W(`${tag}: party loses ${f0(stay.hpLost)}% HP when it does not flee (target ≤ 45%)`);
          if (real.killPct < 25 || real.killPct > 70) W(`${tag}: beaten in ${f0(real.killPct)}% of encounters (target 25–70%)`);
        } else if (p.L >= s.lv - 8 && stay.winPct < 85) W(`${tag}: party wins only ${f0(stay.winPct)}% when it does not flee`);
        if (real.losePct > 3) W(`${tag}: party wiped in ${f1(real.losePct)}% of real encounters`);
      }
      delete DB.monsters[stayId];
    }
  }
}

// ------------------------------------------------------------ report
console.log('=== RARE MONSTERS ===');
for (const { s, m, ref, rx } of rewardRows) {
  const zr = s.zones.map((z) => (rareEnc[z] ? rareEnc[z].rate : 0));
  console.log(`${pad(m.name, 14)} ${pad(s.id, 12)} Lv${padL(s.lv, 2)} ${s.size}px  HP${padL(m.hp, 4)} atk${padL(m.atk, 4)} def${padL(m.def, 4)} ` +
    `mag${padL(m.mag, 4)} mdf${padL(m.mdef, 3)} agi${padL(m.agi, 3)} eva${padL(m.eva != null ? m.eva : 3, 3)}  flee ${Math.round(m.fleeRate * 100)}%/turn  ` +
    `rate ${(Math.min(...zr) * 100).toFixed(1)}–${(Math.max(...zr) * 100).toFixed(1)}% of ${s.zones.length} zones`);
  console.log(`${' '.repeat(28)}vs regular Lv${s.lv} (median): HP ×${f1(rx('hp'))} atk ×${f1(rx('atk'))} def ×${f1(rx('def'))} | ` +
    `EXP ${m.exp} (×${f1(rx('exp'))}) G ${m.gold} (×${f1(rx('gold'))}) JP ${m.jp} (×${f1(rx('jp'))})`);
  const it = items[m.rare && m.rare.item] || {};
  console.log(`${' '.repeat(28)}drop ${(items[m.drop.item] || {}).name} 1/${m.drop.rate} · ★${it.name} 1/${m.rare.rate} · steal ${(items[m.steal.item] || {}).name}/★${it.name}`);
}
if (simRows.length) {
  console.log(`\n=== SIM (${N} fights per row; stay = the monster never runs, real = as shipped) ===`);
  console.log(`${pad('monster', 12)} ${pad('stage', 11)} Lv  | stay: win  rnd  hp-  dead | real: beaten  fled  flee@rnd  wiped | ★ per encounter`);
  for (const { s, p, stay, real } of simRows) {
    const m = mons[s.id];
    const perEnc = (real.killPct / 100) / m.rare.rate;
    console.log(`${pad(s.id, 12)} ${pad(p.label + (p.own ? '*' : ''), 11)} ${padL(p.L, 2)}  |  ${padL(f0(stay.winPct), 4)}% ${padL(f1(stay.rounds), 4)} ${padL(f0(stay.hpLost), 3)}% ${padL(f1(stay.deaths), 4)} |` +
      `  ${padL(f0(real.killPct), 5)}%  ${padL(f0(real.fledPct), 3)}%  ${padL(f1(real.fleeRound), 7)}  ${padL(f1(real.losePct), 5)}% | 1/${f0(1 / Math.max(1e-9, perEnc))}`);
  }
  console.log('(* = the monster\'s own level; ★ per encounter = beaten% × rare-drop rate, before rarePct and steals)');
  // rough odds for a thief (battle.js stealChance/rareStealChance): one steal attempt at the monster's
  // own level with the party's best agi/luk; plain steal (12.5 % rare) and the best rareBonus ability
  let bonus = 0;
  for (const id in DB.abilities) for (const f of DB.abilities[id].effects || []) if (f.type === 'steal' && f.rareBonus > bonus) bonus = f.rareBonus;
  console.log(`\nsteal: one attempt at the own level (best agi/luk of the party, no stealPct/rarePct) → ★ exclusive item` +
    ` (rare monsters: 1/64 of successes, best ability +${f1(bonus * 4)} % — battle.js rareStealChance)`);
  for (const s of MAIN) {
    const m = mons[s.id], row = simRows.find((r) => r.s === s && r.p.own);
    if (!m || !row) continue;
    const party = model.buildParty(row.p.si, row.p.L).map((c) => Rules.stats(c));
    const agi = Math.max(...party.map((x) => x.agi)), luk = Math.max(...party.map((x) => x.luk));
    const p = U.clamp(0.4 + (agi - m.agi) / 200 + luk / 400, 0.1, 0.9);
    console.log(`  ${pad(m.name, 14)} success ${padL(f0(p * 100), 2)}% → ★ ${f1(p * 100 / 64)}% per attempt, ${f1(p * (100 / 64 + bonus * 4))}% with the ability` +
      `  (drop route: 1/${m.rare.rate} per kill)`);
  }
}
console.log('');
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`check_rare: ${errors.length} error(s), ${warns.length} warning(s)`);
process.exitCode = errors.length ? 1 : 0;
