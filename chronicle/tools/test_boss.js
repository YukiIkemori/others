#!/usr/bin/env node
// A12 unit tests: bosses, rare monsters, eb_ actions, troops, rare encounter rows.
// Rules from DESIGN §9.1, §9.10, §9.11, §9.12, §1.7 and STYLE_JA §2–§7 (text), plus a battle smoke
// run of every troop in the A12 model (tools/fixtures/boss/lib/model.js) and, when the Chronicle
// battle engine is present, in R.Battle.simulate. Exit 1 on failure.
//   node tools/test_boss.js [-v]
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB;
const VERBOSE = process.argv.includes('-v');
let pass = 0, fail = 0, warnN = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  FAIL ' + msg); } };
const warn = (msg) => { warnN++; if (VERBOSE) console.log('  warn ' + msg); };
const section = (s) => console.log(s);

const BOSSES = Object.keys(DB.monsters).filter((k) => k.startsWith('b_'));
const RARES = Object.keys(DB.monsters).filter((k) => k.startsWith('rm_'));
const EB = Object.keys(DB.actions).filter((k) => k.startsWith('eb_'));
const TROOPS = Object.keys(DB.troops);
const MINE = BOSSES.concat(RARES);

// width in full-width units (half-width = 0.5; {hero} = 5, {user}/{name} ignored as they are not in my text)
const fw = (s) => { let n = 0; for (const ch of s.replace(/\{hero\}/g, '＿＿＿＿＿')) n += /[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1; return n; };

// ------------------------------------------------------------------ counts
section('counts');
ok(BOSSES.length === 34, `34 bosses (got ${BOSSES.length})`);
ok(RARES.length === 23, `23 rare monsters (got ${RARES.length})`);
ok(EB.length === 191, `191 eb_ actions (got ${EB.length})`);
ok(TROOPS.filter((t) => /^tr_b_/.test(t)).length === 26, '26 boss troops');
ok(!!DB.troops.tr_tutorial, 'tutorial troop');
ok(Object.keys(DB.rareEncounters).length === 23, '23 rare encounter rows');
ok(EB.slice(0, 64).every((id) => RARES.some((r) => DB.monsters[r].actions.some((a) => a.id === id))), 'first 64 eb_ are rare-monster actions');

// ------------------------------------------------------------------ monster shape
section('monsters (§9.1.1)');
const RACES = 'beast bird insect plant aquatic dragon undead demon spirit construct slime humanoid fairy'.split(' ');
const ELS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const ELV = [2, 1.5, 1.25, 1, 0.75, 0.5, 0.25, 0, -1];
const STS = 'poison burn sleep paralyze freeze stun confuse silence blind death'.split(' ');
const BTYPES = 'prologue mid region rival fmid last1 last2 echo super add'.split(' ');
const COND_KEYS = ['hpBelow', 'hpAbove', 'every', 'once', 'round', 'alone', 'countBelow', 'allyDown'];
const names = {};
for (const id of MINE) {
  const d = DB.monsters[id];
  const boss = id.startsWith('b_');
  ok(typeof d.name === 'string' && fw(d.name) <= 8, `${id} name ≤ 8 (${d.name})`);
  (names[d.name] = names[d.name] || []).push(id);
  ok(typeof d.sprite === 'string' && d.sprite.length > 0, `${id} sprite`);
  ok(RACES.includes(d.race), `${id} race ${d.race}`);
  ok(typeof d.lv === 'number' && d.lv >= 1 && d.lv <= 99, `${id} lv`);
  ok(!('hue' in d) && !('sat' in d) && !('bri' in d) && !('pal' in d), `${id} has no hue/sat/bri (§9.0 0.6)`);
  for (const k of ['hp', 'atk', 'mag', 'def', 'mdef', 'agi']) if (d['_abs_' + k]) ok(false, `${id} absolute ${k}`);
  for (const [k, v] of Object.entries(d.elem || {})) ok(ELS.includes(k) && ELV.includes(v), `${id} elem ${k}:${v}`);
  for (const [k, v] of Object.entries(d.phys || {})) ok(['slash', 'blunt', 'pierce'].includes(k) && ELV.includes(v), `${id} phys ${k}:${v}`);
  for (const [k, v] of Object.entries(d.statusRes || {})) ok(STS.includes(k) && v >= 0 && v <= 1, `${id} statusRes ${k}:${v}`);
  ok(Array.isArray(d.flags) && d.flags.includes(boss ? 'boss' : 'rare'), `${id} flag ${boss ? 'boss' : 'rare'}`);
  ok(!d.flags.includes('metal'), `${id} not metal`);
  if (d.affinity) ok(ELS.includes(d.affinity) && d.elem[d.affinity] <= 0.25, `${id} affinity ${d.affinity} matches elem`);
  ok(d.eva === (d.flags.includes('flying') ? (boss ? 10 : 20) : (boss ? 5 : 15)), `${id} eva per §9.2.3 (${d.eva})`);
  ok(typeof d.desc === 'string' && d.desc.split('\n').length <= 2 && d.desc.split('\n').every((l) => fw(l) <= 20), `${id} desc 20×2 (${JSON.stringify(d.desc)})`);
  ok(d.actsPerTurn >= 1 && d.actsPerTurn <= 3 || (!boss && d.actsPerTurn == null), `${id} actsPerTurn`);
  // actions
  ok(Array.isArray(d.actions) && d.actions.length >= 2, `${id} actions`);
  for (const a of d.actions) {
    ok(a.id === 'attack' || !!DB.actions[a.id], `${id} action ${a.id} exists`);
    ok(a.w > 0, `${id} ${a.id} weight`);
    ok(!/^s_/.test(a.id) && !/^t_/.test(a.id), `${id} uses no s_/t_ (§7.0 0.13)`);
    if (a.cond) for (const k in a.cond) ok(COND_KEYS.includes(k), `${id} cond key ${k}`);
    if (a.cond && a.cond.every) ok(a.cond.every[1] < a.cond.every[0], `${id} ${a.id} every [n,k] k<n`);
  }
  ok(d.actions.some((a) => a.id === 'attack'), `${id} has a plain attack`);
  // phases
  if (d.phases) {
    let last = 1;
    for (const p of d.phases) {
      ok(p.hpBelow > 0 && p.hpBelow < last, `${id} phase hpBelow order`);
      last = p.hpBelow;
      ok(typeof p.msg === 'string' && p.msg.length > 0 && fw(p.msg) <= 40, `${id} phase msg`);
      for (const k in p.set) ok(['actsPerTurn', 'elem', 'phys', 'buffs', 'sprite'].includes(k), `${id} phase set key ${k}`);
      if (p.set.elem) for (const [k, v] of Object.entries(p.set.elem)) ok(ELS.includes(k) && ELV.includes(v), `${id} phase elem ${k}:${v}`);
      if (p.set.buffs) for (const [k, v] of Object.entries(p.set.buffs)) ok(['atk', 'def', 'mag', 'mdef', 'agi'].includes(k) && Math.abs(v) <= 2, `${id} phase buff ${k}:${v}`);
      if (p.set.sprite) { if (R.Gfx && R.Gfx.has) { if (!R.Gfx.has('mon:' + p.set.sprite)) warn(`${id} phase sprite mon:${p.set.sprite} not registered yet (art-boss)`); } }
    }
  }
  // sprites (art owners): warn only
  if (R.Gfx && R.Gfx.has && !R.Gfx.has('mon:' + d.sprite)) warn(`${id} sprite mon:${d.sprite} not registered yet (art-boss / art-rare)`);
}
for (const [n, ids] of Object.entries(names)) ok(ids.length === 1 || (n === 'ロウェル' && ids.length === 2), `unique name ${n} (${ids.join(',')})`);
const moNames = Object.entries(DB.monsters).filter(([k]) => !MINE.includes(k)).map(([, d]) => d.name);
for (const id of MINE) ok(!moNames.includes(DB.monsters[id].name), `${id} name not shared with a mob`);

section('bosses (§9.11)');
for (const id of BOSSES) {
  const d = DB.monsters[id];
  ok(BTYPES.includes(d.bossType), `${id} bossType ${d.bossType}`);
  if (d.bossType === 'add') ok(!!DB.monsters[d.addOf] && DB.monsters[d.addOf].bossType !== 'add', `${id} addOf ${d.addOf}`);
  if (d.hpShare != null) ok(d.hpShare > 0 && d.hpShare <= 20, `${id} hpShare`);
  ok(!d.statusRes || !('death' in d.statusRes) || d.statusRes.death >= 0.8, `${id} death res (boss default 1 applies otherwise)`);
  if (d.s) for (const [k, v] of Object.entries(d.s)) ok(['hp', 'atk', 'mag', 'def', 'mdef', 'agi'].includes(k) && v >= 0.4 && v <= 2.5, `${id} s.${k} ${v}`);
}
// troop hp shares add up to the bossType multiplier (§9.11.2)
const HPMUL = { mid: 10, region: 18, fmid: 20 };
for (const [tr, want] of [['tr_b_rooteater', 18], ['tr_b_dolls', 10], ['tr_b_octopus', 10], ['tr_b_heroshades', 20]]) {
  const sum = DB.troops[tr].mons.reduce((s, [m, n]) => s + (DB.monsters[m].hpShare || HPMUL[DB.monsters[m].bossType] || 0) * n, 0);
  ok(Math.abs(sum - want) < 1e-9, `${tr} hp shares sum to ${want} (${sum})`);
}
// drops §9.12.8
const MIDB = ['b_pageeater', 'b_moth', 'b_sandworm', 'b_icegiant', 'b_doll_conductor', 'b_octopus', 'b_rockeater', 'b_hellhound', 'b_orrery'];
const REGB = ['b_rooteater', 'b_sandking', 'b_whitedragon', 'b_mistbeast', 'b_captain', 'b_ironwarden', 'b_lavabeast', 'b_stareater'];
for (const id of MIDB) ok(DB.monsters[id].drops.normal && DB.monsters[id].drops.normal.pool === 'p_boss_mid' && /^i_seed_(wp|mp)$/.test(DB.monsters[id].drops.bonus.item), `${id} p_boss_mid + wp/mp seed`);
for (const id of REGB) ok(DB.monsters[id].drops.normal.pool === 'p_boss' && DB.monsters[id].drops.bonus.item === 'i_seed_hp', `${id} p_boss + i_seed_hp`);
for (const id of ['b_rowell1', 'b_rowell2', 'b_nemrea1', 'b_nemrea2', 'b_root', 'b_doll_violin', 'b_doll_drum', 'b_doll_flute', 'b_mist_double', 'b_tentacle', 'b_shade_star']) ok(Object.keys(DB.monsters[id].drops).length === 0, `${id} drops nothing`);

section('rare monsters (§9.10)');
const zonesOf = {};
for (const [z, r] of Object.entries(DB.rareEncounters)) { (zonesOf[r.mon] = zonesOf[r.mon] || []).push(z); ok(r.rate >= 1 && Number.isInteger(r.rate), `${z} rate is a denominator`); }
for (const id of RARES) {
  const d = DB.monsters[id];
  ok((zonesOf[id] || []).length === 1, `${id} in exactly one zone (${zonesOf[id]})`);
  ok(d.fleeRate === 0.25, `${id} fleeRate 0.25`);
  ok(d.s && d.s.hp >= 2.8 && d.s.hp <= 3.6, `${id} s.hp 2.8–3.6`);
  ok(['s', 'm', 'l'].includes(d.size), `${id} size`);
  ok(d.statusRes.death === 1, `${id} immune to instant death`);
  ok(typeof d.appear === 'string' && fw(d.appear) <= 20, `${id} appear line ≤ 20 (${d.appear})`);
  const dr = d.drops;
  const tapir = id === 'rm_dream_tapir';
  ok(dr.normal.rate === 2 && dr.rare.rate === (tapir ? 4 : 6) && dr.super.rate === (tapir ? 12 : 24), `${id} rates 2/6/24 (tapir 2/4/12)`);
  ok(/^ac_rl_/.test(dr.rare.item), `${id} rare slot is a relic`);
  ok(/^ac_rs_/.test(dr.super.item) || /sr_/.test(dr.super.item), `${id} super slot relic / fixed-tier super`);
  ok(/^i_/.test(dr.normal.item), `${id} normal slot is its own item`);
}
ok(DB.rareEncounters.z_postgame_oblivion_hi.rate === 200 && DB.monsters.rm_dream_tapir.actsPerTurn === 2 && DB.monsters.rm_dream_tapir.rankAdd === 1, 'dream tapir is the super-rare monster (1/200, 2 acts, rankAdd 1)');
const encZones = Object.keys(DB.encounters || {});
if (encZones.length) for (const z of Object.keys(DB.rareEncounters)) ok(encZones.includes(z), `rare zone ${z} exists in DB.encounters`);
else warn('DB.encounters empty (mons A11) — zone ids not checked');
// exclusive items: each rare-monster item on exactly one monster
const itemUse = {};
for (const [id, d] of Object.entries(DB.monsters)) for (const slot of ['normal', 'rare', 'super']) { const it = d.drops && d.drops[slot] && d.drops[slot].item; if (it) (itemUse[it] = itemUse[it] || []).push(id + ':' + slot); }
for (const id of RARES) for (const slot of ['normal', 'rare', 'super']) { const it = DB.monsters[id].drops[slot].item; ok(itemUse[it].length === 1, `${id} ${slot} item ${it} exclusive (${itemUse[it]})`); }
for (const id of ['b_valzard_echo', 'b_ouroboros']) ok(itemUse[DB.monsters[id].drops.super.item].length === 1, `${id} super item exclusive`);
// items exist (other owners; warn until they land)
const allItems = new Set();
for (const id of MINE) for (const slot of ['normal', 'rare', 'super', 'bonus']) { const e = DB.monsters[id].drops[slot]; if (e && e.item) allItems.add(e.item); if (e && e.pool) ok(!Object.keys(DB.pools || {}).length || !!DB.pools[e.pool], `${id} pool ${e.pool} exists`); }
const missing = [...allItems].filter((it) => !DB.items[it]);
if (missing.length) warn(`${missing.length} drop items not defined yet: ${missing.slice(0, 12).join(' ')}${missing.length > 12 ? ' …' : ''}`);
for (const it of allItems) if (DB.items[it] && DB.items[it].exclusive) ok(MINE.includes(DB.items[it].exclusive) || /^b_|^rm_/.test(DB.items[it].exclusive), `${it} exclusive → ${DB.items[it].exclusive}`);

// ------------------------------------------------------------------ actions
section('eb_ actions (§9.1.6)');
const TARGETS = ['enemy', 'enemies', 'random', 'self', 'ally', 'allies', 'ally_dead', 'group'];
const EFFECTS = ['damage', 'status', 'buff', 'heal', 'revive', 'dispel', 'summon'];
const MON_STATUSES = 'poison burn sleep paralyze freeze stun confuse silence blind death regen veil'.split(' ');
const techSpellNames = new Set(Object.values(DB.actions).filter((a) => a.kind === 'tech' || a.kind === 'spell').map((a) => a.name));
const ebNames = {};
const used = new Set();
for (const id of MINE) for (const a of DB.monsters[id].actions) used.add(a.id);
for (const id of EB) {
  const a = DB.actions[id];
  ok(a.kind === 'enemy', `${id} kind enemy`);
  ok(fw(a.name) <= 8, `${id} name ≤ 8`);
  ok(!techSpellNames.has(a.name), `${id} name ${a.name} not a tech/spell name`);
  (ebNames[a.name] = ebNames[a.name] || []).push(id);
  ok(TARGETS.includes(a.target), `${id} target ${a.target}`);
  ok(!a.glim && !a.mp && !a.wp, `${id} has no glim/mp/wp`);
  ok(typeof a.fx === 'string' && a.fx.length > 0, `${id} fx`);
  ok(typeof a.msg === 'string' && fw(a.msg.replace(/\{user\}/g, '')) <= 40, `${id} msg`);
  ok(used.has(id), `${id} is used by a boss or rare monster`);
  if (a.aim) ok(a.aim === 'middle' || a.aim === 'low', `${id} aim`);
  if (a.elements) ok(a.elements.every((e) => ELS.includes(e)), `${id} elements`);
  const aoe = a.target === 'enemies' || a.target === 'random' || a.target === 'group';
  for (const e of a.effects) {
    ok(EFFECTS.includes(e.type), `${id} effect ${e.type}`);
    if (e.type === 'damage') { ok(['phys', 'magic', 'breath'].includes(e.formula), `${id} formula`); ok(e.power > 0 && e.power <= 2.5, `${id} power`); if (e.element) ok(ELS.includes(e.element), `${id} element`); if (e.kind) ok(['slash', 'blunt', 'pierce'].includes(e.kind), `${id} kind`); }
    if (e.type === 'status') {
      ok(MON_STATUSES.includes(e.status), `${id} status ${e.status} is one of §9.14.2`);
      const good = e.status === 'regen' || e.status === 'veil';
      if (!good) ok(e.chance > 0 && e.chance <= (e.status === 'death' ? 0.12 : aoe ? 0.30 : 0.60), `${id} ${e.status} chance ${e.chance} within §9.1.6 caps`);
      if (e.status === 'death') ok(!aoe, `${id} instant death single target only`);
    }
    if (e.type === 'buff') ok(['atk', 'def', 'mag', 'mdef', 'agi'].includes(e.stat) && Math.abs(e.stages) <= 2, `${id} buff`);
    if (e.type === 'summon') {
      ok(a.target === 'self', `${id} summon targets self`);
      ok(e.max >= 2 && e.max <= 8 && e.n >= 1, `${id} summon n/max`);
      ok(e.mon === 'same' || e.mon === 'lower' || !!DB.monsters[e.mon] || (e.mon[0] === '@' && (!Object.keys(DB.lineages).length || !!DB.lineages[e.mon.slice(1)])), `${id} summon ${e.mon} resolves`);
      if (DB.monsters[e.mon] && /^b_/.test(e.mon)) ok(DB.monsters[e.mon].bossType === 'add', `${id} summons an add`);
    }
    if (e.on) ok(e.on === 'self', `${id} on:'self'`);
  }
  ok(/[！。…]$/.test(a.msg) || /……。$/.test(a.msg), `${id} msg ends with ！ or 。`);
}
for (const [n, ids] of Object.entries(ebNames)) ok(ids.length === 1, `unique action name ${n} (${ids})`);
const eNames = Object.entries(DB.actions).filter(([k]) => k.startsWith('e_')).map(([, a]) => a.name);
for (const id of EB) if (eNames.includes(DB.actions[id].name)) ok(false, `${id} name ${DB.actions[id].name} also used by an e_ action`);

// ------------------------------------------------------------------ troops
section('troops (§9.1.5)');
const SPRITE_W = { boss_pageeater: 80, boss_moth: 96, boss_rooteater: 96, boss_root: 48, b_sandworm: 96, b_sandking: 96, boss_frost_giant: 96, boss_whitedragon: 112, b_doll_conductor: 48, b_doll_violin: 48, b_doll_drum: 48, b_doll_flute: 48, boss_mistbeast: 96, b_mist_double: 48, b_octopus: 64, boss_tentacle: 48, b_captain: 96, b_rockeater: 64, b_ironwarden: 96, boss_hellhound: 96, boss_flame_lord: 112, boss_star_guardian: 96, boss_stareater: 112, boss_rowell: 64, b_rowell2: 64, boss_bookgolem: 96, boss_shade_sword: 64, boss_shade_prayer: 64, boss_shade_star: 64, boss_lazaro: 80, boss_nemrea1: 128, boss_nemrea2: 128, b_valzard_echo: 128, boss_ouroboros: 128 };
const LZ = (T) => 6 + 6 * T;
for (const id of TROOPS) {
  const t = DB.troops[id];
  ok(Array.isArray(t.mons) && t.mons.length >= 1, `${id} mons`);
  let width = 0, count = 0;
  for (const [ref, n] of t.mons) {
    ok(n >= 1 && Number.isInteger(n), `${id} count`);
    count += n;
    if (ref[0] === '@') { const lin = DB.lineages[ref.slice(1)]; ok(!Object.keys(DB.lineages).length || !!lin, `${id} lineage ${ref}`); width += 48 * n; }
    else { ok(!!DB.monsters[ref], `${id} member ${ref} exists`); const d = DB.monsters[ref]; width += (d && (SPRITE_W[d.sprite] || { s: 32, m: 48, l: 64 }[d.size] || 48)) * n; }
  }
  ok(count <= 8 && width <= 256, `${id} fits 8 monsters / 256 px (${count}, ${width}px)`);
  ok(t.noEscape === true, `${id} noEscape`);
  ok(typeof t.bgm === 'string', `${id} bgm`);
  if (t.scale === 'tier') ok(t.tier == null && t.lvOff >= 1, `${id} scale:tier with lvOff`);
  else ok(Number.isInteger(t.tier) && t.tier >= 0 && t.tier <= 9, `${id} fixed tier`);
  if (/^tr_b_/.test(id) && !/rowell/.test(id)) ok(typeof t.bg === 'string', `${id} bg`);
  if (/rowell/.test(id)) ok(!t.bg, `${id} uses the town backdrop (no bg)`);
  const main = t.mons.map(([m]) => DB.monsters[m]).find((d) => d && d.bossType && d.bossType !== 'add');
  if (main) ok(main.lv === (t.lv != null ? t.lv : LZ(t.scale === 'tier' ? 0 : t.tier) + t.lvOff), `${id} boss lv = Lb`);
}
ok(DB.troops.tr_tutorial.mons[0][0] === 'rat_1' && DB.troops.tr_tutorial.mons[0][1] === 2 && DB.troops.tr_tutorial.tier === 0 && DB.troops.tr_tutorial.lv === 2, 'tutorial = 2 rats, tier 0, lv 2');
const reg = DB.regions || {};
for (const [rid, r] of Object.entries(reg)) if (r.bossTroop) ok(!!DB.troops[r.bossTroop], `region ${rid} bossTroop ${r.bossTroop} exists`);

// ------------------------------------------------------------------ text (STYLE_JA)
section('text (STYLE_JA)');
const STYLE = fs.readFileSync(path.join(__dirname, '..', 'STYLE_JA.md'), 'utf8');
const listAfter = (head) => { const i = STYLE.indexOf(head); const seg = STYLE.slice(i, STYLE.indexOf('\n\n', i + head.length + 1) > 0 ? STYLE.indexOf('\n###', i + 5) : undefined); return [...seg.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((w) => !/^[a-z_]+$/.test(w)); };
const PART = [];
for (const line of STYLE.split('\n')) if (/^- (ロマサガ|ドラクエ|ファイナル|ほかの作品)/.test(line)) for (const m of line.matchAll(/`([^`]+)`/g)) PART.push(...m[1].split(/\s+/));
const FULL = [];
{ const i = STYLE.indexOf('### 7.2'); const line = STYLE.slice(i).split('\n').find((l) => l.startsWith('`')); FULL.push(...line.replace(/`/g, '').split(/\s+/).filter(Boolean)); }
const SRCBAN = [];
{ const i = STYLE.indexOf('### 7.3'); const line = STYLE.slice(i).split('\n').find((l) => l.startsWith('`')); for (const m of line.matchAll(/`([^`]+)`/g)) SRCBAN.push(m[1]); }
ok(PART.length > 100 && FULL.length > 30 && SRCBAN.length > 20, `banned lists parsed (${PART.length}/${FULL.length}/${SRCBAN.length})`);
const texts = [];
for (const id of MINE) { const d = DB.monsters[id]; texts.push([id + '.name', d.name, 'name'], [id + '.desc', d.desc, 'text']); if (d.appear) texts.push([id + '.appear', d.appear, 'text']); for (const p of d.phases || []) texts.push([id + '.phase', p.msg, 'text']); }
for (const id of EB) texts.push([id + '.name', DB.actions[id].name, 'name'], [id + '.msg', DB.actions[id].msg, 'text']);
const JOYO = fs.existsSync(path.join(__dirname, 'lib', 'joyo.txt')) ? new Set([...fs.readFileSync(path.join(__dirname, 'lib', 'joyo.txt'), 'utf8').trim()]) : null;
const EXTRA = new Set([...'杖槍斧鞭鎧兜棍閃狼巫砦傭鷹槌吠沌翔淵獅鷲狐樺蓮凪叉']);
for (const [where, s, kind] of texts) {
  if (kind === 'name') {
    for (const w of PART) if (w && s.includes(w)) ok(false, `${where} ${s} contains banned ${w} (STYLE §7.1)`);
    ok(!FULL.includes(s), `${where} ${s} not a banned full name (STYLE §7.2)`);
  }
  for (const w of SRCBAN) if (s.includes(w)) ok(false, `${where} contains ${w} (STYLE §7.3)`);
  ok(!/…/.test(s.replace(/……/g, '')), `${where} ellipsis is ……`);
  ok(!/[０-９]/.test(s), `${where} no full-width digits`);
  ok(!/\.\.\./.test(s), `${where} no ASCII ...`);
  ok(!/　/.test(s) || /[！？]　/.test(s), `${where} full-width space only after ！/？`);
  if (JOYO) for (const ch of s) if (/[一-鿿]/.test(ch)) ok(JOYO.has(ch) || EXTRA.has(ch), `${where} kanji ${ch} is 常用 or allowed (STYLE §2)`);
  for (const l of s.split('\n')) ok(fw(l.replace(/\{user\}/g, '＿＿＿＿＿')) <= 20, `${where} line ≤ 20 ({user} = 5, STYLE §1): ${l}`);
}
// the ellipsis at the end of a sentence must be followed by 。！？」 (STYLE §3)
for (const [where, s] of texts) if (/……$/.test(s)) ok(false, `${where} ends with …… without 。/！/？`);

// ------------------------------------------------------------------ battle smoke (model; real engine when present)
section('battle smoke');
const M = require('./fixtures/boss/lib/model.js')(R);
for (const id of TROOPS) {
  const t = DB.troops[id];
  const tiers = t.scale === 'tier' ? [0, 4, 7] : [t.tier];
  for (const T of tiers) {
    let res = null;
    try {
      const tier = t.scale === 'tier' ? T : t.tier;
      const level = id === 'tr_tutorial' ? 3 : id === 'tr_b_pageeater' ? 5 : Math.min(70, LZ(tier) + 3);
      const party = M.makeParty({ tier, level, members: id === 'tr_tutorial' ? ['hero'] : ['hero', 'brigitta:front', 'marta', 'sylvain'] });
      res = M.fightTroop(id, party, { tier: T, maxRounds: 80 });
    } catch (e) { ok(false, `${id} T${T} model battle threw: ${e.message}`); continue; }
    ok(res && res.rounds > 0, `${id} T${T} model battle runs (${res.win ? 'win' : 'lose'} in ${res.rounds})`);
  }
}
const src = ['battle.js', 'battle_ai.js', 'mon.js'].map((f) => { try { return fs.readFileSync(path.join(__dirname, '..', 'src', 'systems', f), 'utf8'); } catch (e) { return ''; } }).join('\n');
const realReady = R.Battle && R.Battle.simulate && R.Mon && R.Mon.fillStats && /summon/.test(src) && /phases/.test(src) && !/DB\.abilities/.test(src) && fs.existsSync(path.join(__dirname, 'lib', 'party_model.js'));
if (realReady) {
  const PM = require('./lib/party_model');
  for (const id of TROOPS) {
    const t = DB.troops[id];
    const tier = t.scale === 'tier' ? 3 : t.tier;
    try {
      const { party, inv } = PM.build(R, { tier, members: ['hero', 'brigitta', 'marta', 'sylvain'], heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, build: 'balanced', gear: 'shop' });
      const r = R.Battle.simulate({ party, inv, troop: id, tier, items: true, maxRounds: 60 });
      ok(r && (r.result === 'win' || r.result === 'lose' || r.result === 'draw'), `${id} real engine simulate (${r && r.result})`);
    } catch (e) { ok(false, `${id} real engine threw: ${e.message}`); }
    // stats filled by R.Mon.fillStats
  }
  for (const id of MINE) ok(DB.monsters[id].hp > 0 && DB.monsters[id].atk > 0, `${id} stats filled by R.Mon.fillStats`);
} else warn('Chronicle battle engine not detected — real-engine smoke skipped');

console.log(`\ntest_boss: ${pass} passed, ${fail} failed` + (warnN ? `, ${warnN} warnings${VERBOSE ? '' : ' (-v to list)'}` : ''));
process.exit(fail ? 1 : 0);
