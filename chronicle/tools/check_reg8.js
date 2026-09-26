#!/usr/bin/env node
// check_reg8.js (owner R8 reg8) — conformance of region 8 r_star オルビス高原 with DESIGN.md itself.
// Reads the spec text (so the check follows DESIGN edits) and compares it with the loaded game data:
//   1. every quoted line of §10.8.9 (the event table, the NPC bullets, the after-clear bullet, the
//      objective texts) appears verbatim in src/maps/region8_*.js or src/events/region8_*.js
//   2. the event ids / flags / objectives / NPC ids + sprites / key item / troops of §10.8.9
//   3. the maps of §10.13.2 (row reg-b, region 8), §10.6.1 (town row) and §10.6.2 (dungeon row):
//      type, theme, BGM, bbg, zone, location, the shops, the secret-passage floor of §10.6.4
//   4. §10.8.0: objectives prefix, the st_* spots, folk_a/folk_b rumors, clearRegion + the inn flow
//
//   node tools/check_reg8.js            exit 1 on any mismatch
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const quiet = console.warn; console.warn = () => {};
const R = require('./lib/load')({ quiet: true });
console.warn = quiet;
const DB = R.DB;

let bad = 0, good = 0;
const out = [];
function ok(c, msg) { if (c) good++; else { bad++; out.push('MISMATCH ' + msg); } }

// ------------------------------------------------------------ the spec section
function section(title) {
  const i = DESIGN.indexOf(title);
  if (i < 0) return '';
  const j = DESIGN.indexOf('\n### ', i + title.length);
  const k = DESIGN.indexOf('\n#### ', i + title.length);
  const end = Math.min(j < 0 ? DESIGN.length : j, k < 0 ? DESIGN.length : k);
  return DESIGN.slice(i, end);
}
const S = section('#### 10.8.9 地方8 `r_star`');
ok(S.length > 500, '§10.8.9 found in DESIGN.md');

// ------------------------------------------------------------ 1. quoted lines
const SRC = ['src/maps', 'src/events'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => /^region8_.*\.js$/.test(f)).map((f) => path.join(ROOT, d, f)));
const src = SRC.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
// quotes inside table cells and bullets: 「…」 (nested 『』 kept); skip the chapter summary / hint rows (world data)
const body = S.split('\n').filter((l) => !/^\| (章の要約|hint|章の題) /.test(l)).join('\n');
const quotes = [];
const re = /「([^「」]+)」/g;
let m;
while ((m = re.exec(body))) quotes.push(m[1]);
// the objective texts are written as 「…」 too; the NPC ids line has no quotes
let found = 0;
for (const q of quotes) {
  // the table writes 〈line〉\n〈line〉 literally, the source has the same escapes
  const hit = src.includes(q) || src.includes(q.replace(/\\n/g, '\\n'));
  if (/^書見台$/.test(q)) continue;
  ok(hit, '§10.8.9 line not found verbatim in region8 sources: 「' + q + '」');
  if (hit) found++;
}

// ------------------------------------------------------------ 2. ids of §10.8.9
const idsIn = (s) => { const set = new Set(); const r = /`([a-z][a-z0-9_]+)`/g; let x; while ((x = r.exec(s))) set.add(x[1]); return set; };
const ids = idsIn(S);
const events = [...ids].filter((i) => /^(orbis|stargaze)_[a-z0-9_]+$/.test(i) && !/^stargaze_[1-4]$/.test(i) && !/^orbis_(item|weapon|armor|magic|a|b)$/.test(i));
for (const e of events) ok(!!DB.events[e], 'event ' + e + ' (§10.8.9) is registered');
for (const f of ['star_start', 'star_chart', 'star_mid', 'star_fine', 'star_boss']) ok(ids.has(f) && src.includes("'" + f + "'"), 'flag ' + f + ' is used');
for (const o of ['obj_star_1', 'obj_star_2']) ok(!!(DB.objectives[o] && DB.objectives[o].text), 'objective ' + o);
const objLine = S.split('\n').find((l) => /^目的の文/.test(l)) || '';
for (const [o, t] of [...objLine.matchAll(/`(obj_star_\d)`「([^」]+)」/g)].map((x) => [x[1], x[2]])) {
  ok(DB.objectives[o] && DB.objectives[o].text === t.replace(/\\n/g, '\n'), 'objective text ' + o + ' = §10.8.9');
}
for (const t of ['tr_b_orrery', 'tr_b_stareater']) ok(ids.has(t) && !!DB.troops[t] && src.includes("'" + t + "'"), 'troop ' + t + ' fought');
ok(ids.has('k_star_chart') && !!DB.items.k_star_chart && /give\('k_star_chart'/.test(src), 'k_star_chart given by an event');
ok(/clearRegion\(REGION\)|clearRegion\('r_star'\)/.test(src), "ev.clearRegion('r_star')");
// NPC ids + sprites of the NPC bullet
const npcLine = S.split('\n').find((l) => /^- \*\*NPC\*\*/.test(l)) || '';
const town = (() => { const w = R.warn; R.warn = () => {}; try { R.State.newGame(); R.Game.flags.star_start = true; return R.FieldMap.compile('orbis'); } finally { R.warn = w; } })();
for (const [, id, spr] of npcLine.matchAll(/`([a-z_]+)`、`(npc:[a-z_]+)`/g)) {
  const n = town.npcs.find((v) => v.id === id);
  ok(n && n.sprite === spr, 'orbis npc ' + id + ' uses ' + spr + (n ? ' (got ' + n.sprite + ')' : ' (missing)'));
}

// ------------------------------------------------------------ 3. maps, town and dungeon rows
const mapsRow = (DESIGN.split('\n').find((l) => /^\| reg-b（A21） \| 5：/.test(l)) || '');
const reg8Maps = ((mapsRow.split('／').find((p) => /^8：/.test(p.trim())) || '').match(/`([a-z0-9_]+)`/g) || []).map((s) => s.replace(/`/g, ''));
ok(reg8Maps.length === 5, '§10.13.2 lists 5 maps for region 8 (' + reg8Maps.join(' ') + ')');
for (const id of reg8Maps) ok(!!DB.maps[id], 'map ' + id + ' (§10.13.2) exists');
const townRow = DESIGN.split('\n').find((l) => /^\| `orbis` \| 学術都市オルビス/.test(l)) || '';
const tc = townRow.split('|').map((c) => c.trim());
if (tc.length > 8) {
  const d = DB.maps.orbis || {};
  ok(d.name === tc[2], 'orbis name ' + tc[2]);
  ok(d.type === tc[4] && d.theme === tc[5] && d.bgm === tc[6].replace(/`/g, ''), 'orbis type/theme/bgm = §10.6.1');
  for (const k of tc[9].split(/\s+/)) ok(!!(DB.shops && DB.shops['orbis_' + k]) && town.npcs.some((n) => n.shop === 'orbis_' + k), 'orbis shop ' + k + ' (§10.6.1) with its NPC');
  ok(town.npcs.some((n) => n.id === 'inn' && n.event === 'common_inn'), 'orbis inn (§10.6.1)');
  ok(town.npcs.some((n) => n.id === 'tavern' && n.event === 'common_tavern'), 'orbis tavern (§10.6.1)');
}
const dunRow = DESIGN.split('\n').find((l) => /^\| stargaze \| 星読みの塔/.test(l)) || '';
const dc = dunRow.split('|').map((c) => c.trim().replace(/`/g, ''));
if (dc.length > 8) {
  for (const id of ['stargaze_1', 'stargaze_2', 'stargaze_3', 'stargaze_4']) {
    const d = DB.maps[id] || {};
    ok(d.theme === dc[5] && d.bbg === dc[6] && d.bgm === dc[7] && d.encounter === dc[8], id + ' theme/bbg/bgm/zone = §10.6.2 (' + [d.theme, d.bbg, d.bgm, d.encounter].join(' ') + ')');
    ok(d.location === 'stargaze' && d.region === 'r_star', id + ' location/region');
  }
}
const secretRow = DESIGN.split('\n').find((l) => /^\| reg-b（A21） \| `tide_cave_1`/.test(l)) || '';
ok(/`stargaze_3`/.test(secretRow), '§10.6.4 names stargaze_3 for the secret passage');
const sec = (id) => { const d = DB.maps[id]; return d ? d.rows.join('').split('%').length - 1 : 0; };
ok(sec('stargaze_3') >= 1 && ['stargaze_1', 'stargaze_2', 'stargaze_4'].every((id) => sec(id) === 0), 'secret passage only on stargaze_3');
ok(DB.locations.orbis && DB.locations.orbis.region === 'r_star' && DB.locations.stargaze && DB.locations.stargaze.spawn === 'stargaze_1', 'DB.locations orbis / stargaze');

// ------------------------------------------------------------ 4. §10.8.0 common rules
ok(Object.keys(DB.objectives).filter((o) => /^obj_star_/.test(o)).length === 2, '§10.8.0 objectives obj_star_1..2 only');
const inn = town.spawns.inn;
for (const [id, dx] of [['st_rival', 0], ['st_fine', 2], ['st_extra', -2]]) {
  const n = town.npcs.find((v) => v.id === id);
  ok(n && n.x === inn.x + dx && n.y === inn.y + 2 && n.dir === 'up' && n.fixed, '§10.8.0-7 ' + id + ' spot');
}
for (const [id, r] of [['folk_a', 'orbis_a'], ['folk_b', 'orbis_b']]) ok(town.npcs.some((n) => n.id === id && n.rumor === r && n.event === 'story_rumor'), '§10.8.0-8 ' + id);
ok(/warp\('orbis', 'inn'/.test(src) && /ev\.heal\(\)/.test(src) && src.includes('その夜は、町の宿で眠った。') && /story_after_clear/.test(src), '§10.8.0-3 the night at the inn + story_after_clear');
ok(/if \(r !== 'win'\) return false;/.test(src), '§10.8.0-4 boss results checked');
ok(/story_fine_star/.test(src), '§10.8.0-5 story_fine_star is called');

console.log(out.join('\n'));
console.log(`check_reg8: ${good} ok, ${bad} mismatch(es); §10.8.9 quoted lines found verbatim: ${found}/${quotes.length}`);
process.exit(bad ? 1 : 0);
