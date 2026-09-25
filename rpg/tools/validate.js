#!/usr/bin/env node
// Cross-reference validator for all game data (DESIGN.md is the contract).
//   node tools/validate.js            errors + warnings, exit 1 on errors
//   node tools/validate.js --quiet    errors only
'use strict';
const fs = require('fs');
const path = require('path');
const load = require('./lib/load');
const { parseMap } = require('./lib/maps');

const R = load({ quiet: true });
const DB = R.DB;
const ROOT = path.resolve(__dirname, '..');
const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
for (const e of R._nodeLoadErrors) E('load: ' + e.split('\n')[0]);

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const gfx = (k) => R.Gfx && R.Gfx._defs && has(R.Gfx._defs, k);

const ELEMENTS = ['fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark'];
const STATUSES = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death', 'regen'];
const WTYPES = ['sword', 'knife', 'axe', 'spear', 'staff', 'rod', 'bow', 'claw', 'katana', 'harp'];
const ATYPES = { head: ['helm', 'hat'], body: ['heavy', 'light', 'robe'], shield: ['shield'] };
const TARGETS = ['enemy', 'enemies', 'group', 'random', 'ally', 'allies', 'self', 'ally_dead', 'ally_any'];
const EFFECTS = ['damage', 'heal', 'healMp', 'revive', 'cure', 'status', 'buff', 'dispel', 'steal', 'scan', 'escape', 'regen', 'grow', 'teleport', 'exit', 'repel', 'special'];
const FORMULAS = ['phys', 'magic', 'fixed', 'percent', 'breath'];
const BUFFS = ['atk', 'def', 'mag', 'mdef', 'agi'];
const TRIGGERS = ['hitPhys', 'hitMagic', 'hitAny', 'lowHp', 'allyLowHp', 'ko'];
const REACTS = ['counter', 'heal', 'autoItem', 'buff', 'cover', 'revive', 'mp'];
const MODS = new Set(('hpPct mpPct strPct vitPct agiPct intPct mndPct lukPct atk def mag mdef hit eva crit atkPct defPct magPct mdefPct ' +
  'physPct magicPct healPct itemPct mpCostPct critPct escapePct preemptPct elemBoost elemResist statusImmune startBuffs regen ' +
  'twoSwords unarmed equip expPct jpPct goldPct dropPct rarePct stealPct encounterPct walkHeal noFloorDamage treasureSense').split(' '));
const BGM = 'title overworld sea town village castle shrine dungeon cave tower pyramid ice volcano lastdungeon battle boss lastboss ending'.split(' ');
const JINGLES = 'victory levelup jobup item keyitem inn save gameover rare'.split(' ');
const SFX = ('cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt magic fire ice thunder wind holy dark ' +
  'earth water heal revive buff debuff status poison sleep death enemy_die boss_die escape stairs door locked chest item gold step_damage ship ' +
  'bump warp teleport steal jump breath roar shake').split(' ');
const BBG = 'grass forest hills desert snow swamp wasteland sea cave fort watercave pyramid ice volcano tower shrine castle demon throne'.split(' ');
const NPCS = ('king queen princess minister soldier knight old_man old_woman man woman boy girl merchant innkeeper priest nun sage elder sailor ' +
  'captain bandit elf dwarf scholar dancer spirit demon ghost cat dog').split(' ');
const ICONS = 'sword knife axe spear staff rod bow claw katana harp shield helm hat heavy light robe acc herb potion key'.split(' ');
const JOBS = 'warrior priest mage thief knight monk whitemage blackmage hunter bard alchemist spellblade paladin ninja sage dragoon timemage darkknight hero'.split(' ');
const LOCS = 'regnas milt porta elfin salva frost arcana light_temple edge_shrine'.split(' ');
const SHOP_LOCS = 'regnas milt porta elfin salva frost arcana edge_shrine'.split(' ');
const TROOPS = 'boss_wind boss_fort boss_water boss_pyramid boss_ice boss_volcano boss_star boss_general1 boss_general2 boss_king1 boss_king2'.split(' ');
const KEYS = 'crest_wind crest_water crest_earth crest_fire crest_star light_crest silver_key gold_key'.split(' ');

function checkMods(where, m) {
  if (!m) return;
  for (const k in m) {
    if (!MODS.has(k)) E(`${where}: unknown mod '${k}'`);
    if (k === 'elemBoost' || k === 'elemResist') for (const e in m[k]) if (!ELEMENTS.includes(e)) E(`${where}: bad element ${e} in ${k}`);
    if (k === 'statusImmune') for (const s of m[k]) if (!STATUSES.includes(s)) E(`${where}: bad status ${s}`);
    if (k === 'startBuffs') for (const s in m[k]) if (!BUFFS.includes(s)) E(`${where}: bad buff ${s}`);
    if (k === 'equip') for (const t of m[k]) if (![...WTYPES, 'shield', 'helm', 'hat', 'heavy', 'light', 'robe'].includes(t)) E(`${where}: bad equip type ${t}`);
  }
}
function checkEffects(where, effects, ctx) {
  if (!Array.isArray(effects) || !effects.length) { E(`${where}: effects missing`); return; }
  for (const f of effects) {
    if (!EFFECTS.includes(f.type)) E(`${where}: bad effect type ${f.type}`);
    if (f.type === 'damage') {
      if (!FORMULAS.includes(f.formula)) E(`${where}: bad formula ${f.formula}`);
      if (typeof f.power !== 'number') E(`${where}: damage without power`);
    }
    if (f.element && !ELEMENTS.includes(f.element)) E(`${where}: bad element ${f.element}`);
    if (f.type === 'status' && !STATUSES.includes(f.status)) E(`${where}: bad status ${f.status}`);
    if (f.type === 'cure' && f.statuses !== 'all') for (const s of f.statuses || []) if (!STATUSES.includes(s)) E(`${where}: bad cure status ${s}`);
    if (f.type === 'buff' && !BUFFS.includes(f.stat)) E(`${where}: bad buff stat ${f.stat}`);
    if (f.type === 'grow' && !['hp', 'mp', 'str', 'vit', 'agi', 'int', 'mnd', 'luk'].includes(f.stat)) E(`${where}: bad grow stat ${f.stat}`);
    if (f.type === 'special') W(`${where}: uses special effect '${f.id}' (battle must implement it)`);
  }
}

// ------------------------------------------------------------------ items
const items = DB.items;
for (const id of ['herb', 'copper_sword', 'oak_staff', 'wooden_rod', 'traveler_clothes', 'wing', 'escape_rope', 'holy_water', 'revive_feather', ...KEYS])
  if (!items[id]) E(`items: required id '${id}' missing`);
for (const id in items) {
  const it = items[id], w = `item ${id}`;
  if (!it.name) E(`${w}: no name`);
  if (!['consumable', 'weapon', 'shield', 'head', 'body', 'acc', 'key'].includes(it.type)) E(`${w}: bad type ${it.type}`);
  if (it.type === 'weapon' && !WTYPES.includes(it.wtype)) E(`${w}: bad wtype ${it.wtype}`);
  if (ATYPES[it.type] && !ATYPES[it.type].includes(it.atype)) E(`${w}: bad atype ${it.atype}`);
  if (it.element && !ELEMENTS.includes(it.element)) E(`${w}: bad element`);
  if (it.onHit && !STATUSES.includes(it.onHit.status)) E(`${w}: bad onHit status`);
  checkMods(w, it.mods);
  if (it.type === 'consumable') {
    if (!it.use) E(`${w}: consumable without use`);
    else { if (!TARGETS.includes(it.use.target)) E(`${w}: bad target ${it.use.target}`); checkEffects(w, it.use.effects); }
  }
  if (!it.desc) W(`${w}: no desc`);
}

// ----------------------------------------------------------- jobs/abilities
const jobs = DB.jobs, abil = DB.abilities;
for (const j of JOBS) if (!jobs[j]) E(`jobs: '${j}' missing`);
for (const id in jobs) {
  const j = jobs[id], w = `job ${id}`;
  for (const [rj, lv] of j.req || []) { if (!jobs[rj]) E(`${w}: req unknown job ${rj}`); if (!(lv >= 1 && lv <= 8)) E(`${w}: bad req level`); }
  for (const a of j.abilities || []) { if (!abil[a]) E(`${w}: ability ${a} missing`); else if (abil[a].job !== id) E(`${w}: ability ${a} has job ${abil[a].job}`); }
  for (const t of j.weapons || []) if (!WTYPES.includes(t)) E(`${w}: bad weapon type ${t}`);
  for (const t of j.heads || []) if (!ATYPES.head.includes(t)) E(`${w}: bad head ${t}`);
  for (const t of j.bodies || []) if (!ATYPES.body.includes(t)) E(`${w}: bad body ${t}`);
  if (!j.outfit) E(`${w}: no outfit`);
  if (!j.command) E(`${w}: no command name`);
  checkMods(w + ' innate', j.innate);
}
for (const id in abil) {
  const a = abil[id], w = `ability ${id}`;
  const enemy = id.startsWith('en_');
  if (!enemy && !jobs[a.job]) E(`${w}: unknown job ${a.job}`);
  if (!enemy && !(jobs[a.job] && (jobs[a.job].abilities || []).includes(id))) W(`${w}: not listed in its job`);
  if (!['action', 'reaction', 'support', 'field'].includes(a.kind)) E(`${w}: bad kind ${a.kind}`);
  if (a.kind === 'action') { if (!TARGETS.includes(a.target)) E(`${w}: bad target ${a.target}`); checkEffects(w, a.effects); }
  if (a.kind === 'reaction') {
    if (!TRIGGERS.includes(a.trigger)) E(`${w}: bad trigger ${a.trigger}`);
    if (!a.react || !REACTS.includes(a.react.type)) E(`${w}: bad react`);
  }
  if (a.kind === 'support' || a.kind === 'field') { if (!a.mods) E(`${w}: no mods`); checkMods(w, a.mods); }
  if (!enemy && typeof a.jp !== 'number') E(`${w}: no jp cost`);
}
for (const cid in DB.chars) {
  const c = DB.chars[cid];
  for (const a of c.startLearned || []) if (!abil[a]) E(`char ${cid}: startLearned ${a} missing`);
  for (const s in c.startEquip || {}) if (!items[c.startEquip[s]]) E(`char ${cid}: startEquip ${c.startEquip[s]} missing`);
  if (!jobs[c.startJob]) E(`char ${cid}: startJob missing`);
}

// ---------------------------------------------------------------- monsters
const mons = DB.monsters;
for (const id in mons) {
  const m = mons[id], w = `monster ${id}`;
  if (!gfx('mon:' + m.sprite)) E(`${w}: sprite mon:${m.sprite} not registered`);
  for (const k of ['lv', 'hp', 'atk', 'def', 'agi', 'exp', 'gold', 'jp']) if (typeof m[k] !== 'number') E(`${w}: ${k} missing`);
  for (const a of m.actions || []) if (!['attack', 'defend', 'wait', 'flee'].includes(a.id) && !abil[a.id]) E(`${w}: action ${a.id} missing`);
  if (!(m.actions || []).length) E(`${w}: no actions`);
  for (const k of ['drop', 'rare']) if (m[k] && !items[m[k].item]) E(`${w}: ${k} item ${m[k].item} missing`);
  if (m.steal) { if (m.steal.item && !items[m.steal.item]) E(`${w}: steal item missing`); if (m.steal.rare && !items[m.steal.rare]) E(`${w}: steal rare missing`); }
  for (const e in m.elem || {}) if (!ELEMENTS.includes(e)) E(`${w}: bad element ${e}`);
  for (const s in m.statusRes || {}) if (!STATUSES.includes(s)) E(`${w}: bad status ${s}`);
  if (!m.rare) W(`${w}: no rare drop`);
}
const zonesUsed = new Set();
for (const z in DB.encounters) {
  const e = DB.encounters[z];
  if (!BBG.includes(e.bg)) E(`encounter ${z}: bad bg ${e.bg}`);
  for (const g of e.groups || []) {
    let total = 0; const species = new Set();
    for (const [mid, a, b] of g.mons) { if (!mons[mid]) E(`encounter ${z}: monster ${mid} missing`); total += b; species.add(mid); }
    if (species.size > 3) E(`encounter ${z}: >3 species`);
    if (total > 8) E(`encounter ${z}: >8 monsters`);
  }
}
for (const z in DB.rareEncounters || {}) {
  const r = DB.rareEncounters[z];
  if (!DB.encounters[z]) E(`rareEncounters: unknown zone ${z}`);
  if (!mons[r.mon]) E(`rareEncounters ${z}: monster ${r.mon} missing`);
  if (!(r.rate > 0 && r.rate <= 0.05)) E(`rareEncounters ${z}: rate ${r.rate} out of range`);
}
for (const t of TROOPS) if (!DB.troops[t]) E(`troop ${t} missing`);
for (const t in DB.troops) {
  const tr = DB.troops[t];
  for (const [mid] of tr.mons || []) if (!mons[mid]) E(`troop ${t}: monster ${mid} missing`);
  if (tr.bg && !BBG.includes(tr.bg)) E(`troop ${t}: bad bg ${tr.bg}`);
  if (tr.bgm && !BGM.includes(tr.bgm)) E(`troop ${t}: bad bgm ${tr.bgm}`);
}

// ------------------------------------------------------------------- shops
for (const l of SHOP_LOCS) for (const k of ['item', 'weapon', 'armor']) if (!DB.shops[`${l}_${k}`]) E(`shop ${l}_${k} missing`);
for (const s in DB.shops) for (const i of DB.shops[s].items || []) if (!items[i]) E(`shop ${s}: item ${i} missing`);

// -------------------------------------------------------------------- maps
const parsed = {};
for (const id in DB.maps) parsed[id] = parseMap(R, id);
const allChestIds = {};
const spawnOf = (mapId, spawn) => parsed[mapId] && parsed[mapId].spawns[spawn];
for (const id in parsed) {
  const P = parsed[id], m = P.def, w = `map ${id}`;
  for (const i of P.issues.slice(0, 5)) E(`${w}: ${i}`);
  if (P.issues.length > 5) E(`${w}: …${P.issues.length - 5} more issues`);
  if (m.bgm && !BGM.includes(m.bgm)) E(`${w}: bad bgm ${m.bgm}`);
  if (m.type !== 'world' && m.theme && !DB.themes[m.theme]) E(`${w}: bad theme ${m.theme}`);
  if (m.encounter && !DB.encounters[m.encounter]) E(`${w}: encounter zone ${m.encounter} missing`);
  if (m.encounter) zonesUsed.add(m.encounter);
  const missingZones = new Set();
  for (const z of m.zones || []) { zonesUsed.add(z.zone); if (!DB.encounters[z.zone]) missingZones.add(z.zone); }
  for (const z of missingZones) E(`${w}: zone ${z} missing`);
  if (m.defaultZone) zonesUsed.add(m.defaultZone);
  const chars = m.type === 'world' ? R.MARK_CHARS_WORLD : R.MARK_CHARS_LOCAL;
  for (const ch in m.marks || {}) if (!chars.includes(ch)) W(`${w}: mark char '${ch}' is not in the free list`);
  if (!P.spawns.entrance && m.type !== 'world') E(`${w}: no 'entrance' spawn`);
  const tgt = (o, where) => {
    if (!DB.maps[o.to]) { E(`${w}: ${where} → unknown map ${o.to}`); return; }
    if (typeof o.spawn === 'string' && !spawnOf(o.to, o.spawn)) E(`${w}: ${where} → ${o.to} has no spawn '${o.spawn}'`);
  };
  for (const wp of P.warps) tgt(wp, `warp@${wp.x},${wp.y}`);
  if (m.exit) tgt(m.exit, 'exit');
  if (m.escape) tgt(m.escape, 'escape');
  if (P.decor) for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const d = P.decorAt(x, y);
    if (!d) continue;
    const dd = DB.decor[d];
    if (dd.wall && DB.tiles[P.tileAt(x, y)] && DB.tiles[P.tileAt(x, y)].pass) W(`${w}: wall decor ${d} on walkable tile at ${x},${y}`);
    if (!dd.wall && !dd.pass && !(DB.tiles[P.tileAt(x, y)] || {}).pass) W(`${w}: furniture ${d} on non-walkable tile at ${x},${y}`);
  }
  for (const n of P.npcs) {
    if (P.decorAt(n.x, n.y) && !(DB.decor[P.decorAt(n.x, n.y)] || {}).pass) W(`${w}: npc ${n.id} stands on furniture ${P.decorAt(n.x, n.y)}`);
    if (n.sprite && !gfx(n.sprite)) E(`${w}: npc ${n.id} sprite ${n.sprite} not registered`);
    if (n.event && !DB.events[n.event]) E(`${w}: npc ${n.id} event ${n.event} missing`);
    const t = DB.tiles[P.tileAt(n.x, n.y)];
    const decor = /^(mon|obj|fieldmon):/.test(n.sprite || '') || ['throne', 'pedestal', 'altar'].includes(P.tileAt(n.x, n.y));
    if (t && !t.pass && !decor) W(`${w}: npc ${n.id} on impassable tile ${P.tileAt(n.x, n.y)}`);
  }
  for (const c of P.chests) {
    if (c.item && !items[c.item]) E(`${w}: chest ${c.id} item ${c.item} missing`);
    if (!c.item && !c.gold) E(`${w}: chest ${c.id} empty`);
    if (allChestIds[c.id]) E(`${w}: duplicate chest id ${c.id} (also in ${allChestIds[c.id]})`);
    allChestIds[c.id] = id;
  }
  for (const c of P.hidden) if (!items[c.item]) E(`${w}: hidden ${c.id} item ${c.item} missing`);
  for (const e of P.events) if (!DB.events[e.id]) E(`${w}: event ${e.id} missing`);
  if (m.onEnter && !DB.events[m.onEnter]) E(`${w}: onEnter ${m.onEnter} missing`);
  if (m.location && !DB.locations[m.location]) E(`${w}: location ${m.location} missing`);
}
for (const z in DB.encounters) if (!zonesUsed.has(z)) W(`encounter zone ${z} never used by a map`);
for (const l of LOCS) {
  const L = DB.locations[l];
  if (!L) { E(`location ${l} missing`); continue; }
  if (!spawnOf(L.map, L.spawn)) E(`location ${l}: spawn ${L.spawn} missing on ${L.map}`);
  if (L.dock) { const s = spawnOf(L.map, L.dock); if (!s) E(`location ${l}: dock ${L.dock} missing`); else if (!DB.tiles[parsed[L.map].tileAt(s.x, s.y)].ship) E(`location ${l}: dock not on a sea tile`); }
}
for (const id in DB.events) {
  const ev = DB.events[id];
  if (typeof ev.run !== 'function') E(`event ${id}: no run()`);
  if (!ev.meta) W(`event ${id}: no meta`);
}

// ---------------------------------------------------- source-text references
const srcFiles = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) srcFiles.push(p); } })(path.join(ROOT, 'src'));
for (const f of srcFiles) {
  const src = fs.readFileSync(f, 'utf8'), rel = path.relative(ROOT, f);
  const each = (re, fn) => { let mm; while ((mm = re.exec(src))) fn(mm); };
  each(/\bev\.battle\(\s*'([^']+)'/g, (mm) => { if (!DB.troops[mm[1]]) E(`${rel}: ev.battle('${mm[1]}') unknown troop`); });
  each(/\bev\.(?:give|take|has)\(\s*'([^']+)'/g, (mm) => { if (!items[mm[1]]) E(`${rel}: item '${mm[1]}' unknown`); });
  each(/\bev\.shop\(\s*'([^']+)'/g, (mm) => { if (!DB.shops[mm[1]]) E(`${rel}: shop '${mm[1]}' unknown`); });
  each(/\bev\.setObjective\(\s*'([^']+)'/g, (mm) => { if (DB.objectives && !DB.objectives[mm[1]]) E(`${rel}: objective '${mm[1]}' unknown`); });
  each(/\bev\.warp\(\s*'([^']+)'\s*,\s*'([^']+)'/g, (mm) => { if (!DB.maps[mm[1]]) E(`${rel}: warp map '${mm[1]}' unknown`); else if (!spawnOf(mm[1], mm[2])) E(`${rel}: warp spawn ${mm[1]}:${mm[2]} unknown`); });
  each(/\bev\.giveShip\(\s*'([^']+)'/g, (mm) => { if (!spawnOf('world', mm[1])) E(`${rel}: giveShip spawn '${mm[1]}' unknown`); });
  each(/\bev\.npc\(\s*'([^']+)'/g, () => {});
  each(/\b(?:R\.)?sfx\(\s*'([^']+)'/g, (mm) => { if (!SFX.includes(mm[1])) E(`${rel}: sfx '${mm[1]}' not in DESIGN list`); });
  each(/\b(?:R\.bgm|ev\.bgm|playBGM|pushBGM)\(\s*'([^']+)'/g, (mm) => { if (!BGM.includes(mm[1])) E(`${rel}: bgm '${mm[1]}' not in DESIGN list`); });
  each(/\b(?:R\.jingle|ev\.jingle|playJingle)\(\s*'([^']+)'/g, (mm) => { if (!JINGLES.includes(mm[1])) E(`${rel}: jingle '${mm[1]}' not in DESIGN list`); });
}

// ---------------------------------------------------------------- graphics
for (const t in DB.tiles) {
  const tile = DB.tiles[t];
  if (!gfx('tile:' + t)) (tile.themed ? W : E)(`gfx tile:${t} missing`);
  if (tile.themed) for (const th in DB.themes) if (!gfx(`tile:${th}:${t}`)) W(`gfx tile:${th}:${t} missing (fallback used)`);
}
for (const b of BBG) if (!gfx('bbg:' + b)) E(`gfx bbg:${b} missing`);
for (const d in DB.decor || {}) if (!gfx('decor:' + d) && !(R.Art && R.Art.decorAuto && R.Art.decorAuto[d])) E(`gfx decor:${d} missing`);
for (const c in DB.chars) for (const j of JOBS) if (!gfx(`party:${c}:${j}`) && !(R.Art && R.Art.partySheet)) E(`gfx party:${c}:${j} missing`);
for (const n of NPCS) if (!gfx('npc:' + n)) E(`gfx npc:${n} missing`);
for (const o of ['chest', 'ship', 'sparkle', 'crest_glow', 'shadow']) if (!gfx('obj:' + o)) E(`gfx obj:${o} missing`);
for (const i of ICONS) if (!gfx('icon:' + i)) W(`gfx icon:${i} missing`);

// ------------------------------------------------------------------- audio
const music = Object.keys(DB.music || {});
if (music.length) {
  for (const b of [...BGM, ...JINGLES]) if (!music.includes(b)) E(`music '${b}' missing`);
} else W('R.DB.music empty — audio registry unknown, skipped');
const sfxDb = Object.keys(DB.sfx || {});
if (sfxDb.length) { for (const s of SFX) if (!sfxDb.includes(s)) E(`sfx '${s}' missing`); } else W('R.DB.sfx empty — skipped');

// -------------------------------------------------------------------- report
const quiet = process.argv.includes('--quiet');
if (!quiet) for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`\nvalidate: ${errors.length} error(s), ${warns.length} warning(s). ` +
  `items ${Object.keys(items).length}, jobs ${Object.keys(jobs).length}, abilities ${Object.keys(abil).length}, monsters ${Object.keys(mons).length}, maps ${Object.keys(DB.maps).length}, events ${Object.keys(DB.events).length}`);
process.exitCode = errors.length ? 1 : 0;
