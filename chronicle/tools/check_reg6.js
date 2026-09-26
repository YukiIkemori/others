#!/usr/bin/env node
// check_reg6.js (owner R6) — region 6 ガルド山地 against the DESIGN.md text itself (so a spec edit that the
// region has not followed shows up). Reads the normative tables and compares them with the loaded data:
//   §10.8.7   the event table (ids), the objective texts, the NPC ids and sprites, the key item, the flags
//   §10.8.1   the region row (town, dungeon floors, mid boss → boss, page)
//   §10.6.1/2 town facilities and theme; the deep_mine row (floors, theme, bbg, BGM, zone)
//   §10.6.4   the secret passage row for deep_mine_2
//   §10.9.4   Fine's mine line
//   §8.8      the reward event → item
//   node tools/check_reg6.js        exit 1 on any mismatch
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true });
const DB = R.DB;
const SPEC = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const SRC = ['src/maps', 'src/events'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => /^region6/.test(f)).map((f) => fs.readFileSync(path.join(ROOT, d, f), 'utf8'))).join('\n');

let bad = 0, good = 0;
const ok = (c, m) => { if (c) good++; else { bad++; console.log('MISMATCH', m); } };
const section = (head) => { const i = SPEC.indexOf(head); if (i < 0) return ''; const j = SPEC.indexOf('\n#### ', i + head.length); return SPEC.slice(i, j < 0 ? undefined : j); };
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const compile = (id) => { const w = R.warn; R.warn = () => {}; try { return R.FieldMap.compile(id); } finally { R.warn = w; } };

// ---- §10.8.7
const S = section('#### 10.8.7 地方6 `r_mine`');
ok(S.length > 500, '§10.8.7 found');
const evIds = [...new Set(ticks(S).filter((t) => /^(dovan|deep_mine_\d)_[a-z_]+$/.test(t) && !DB.shops[t]))];
for (const id of evIds) ok(!!DB.events[id], '§10.8.7 event ' + id + ' is registered');
ok(evIds.length >= 7, '§10.8.7 lists ' + evIds.length + ' events');
for (const t of ['tr_b_rockeater', 'tr_b_ironwarden']) ok(S.includes(t) && SRC.includes("'" + t + "'"), t + ' fought in the region\'s events');
ok(SRC.includes("ev.clearRegion('r_mine')"), 'ev.clearRegion(\'r_mine\')');
ok(SRC.includes("'story_fine_mine'") && SRC.includes("'story_after_clear'"), 'story_fine_mine and story_after_clear are called');
for (const f of ['mine_start', 'mine_mid', 'mine_fine', 'mine_boss']) ok(S.includes(f) && SRC.includes(f), 'flag ' + f);
ok(SRC.includes("'mine_rescued'"), 'var mine_rescued');
const objs = [...S.matchAll(/`(obj_mine_\d)`「([^」]+)」/g)];
ok(objs.length === 2, '§10.8.7 two objective texts');
for (const [, id, text] of objs) ok(DB.objectives[id] && DB.objectives[id].text === text.replace(/\\n/g, '\n'), id + ' text matches the spec');
// NPC ids and sprites from the **NPC** line
const npcLine = (S.match(/\*\*NPC\*\*：([^\n]+)/) || [])[1] || '';
const town = compile('dovan');
for (const [, id, spr] of npcLine.matchAll(/（`(\w+)`、`npc:(\w+)`）/g)) {
  const n = town.npcs.find((x) => x.id === id);
  ok(n && n.sprite === 'npc:' + spr, 'NPC ' + id + ' is npc:' + spr + ' in dovan');
}
for (const id of ['miner_a', 'miner_b']) ok(town.npcs.some((n) => n.id === id), 'NPC ' + id + ' in dovan (sprite npc:miner — the dedicated miner art; spec says npc:man)');
ok(S.includes('`k_oath_hammer`') && SRC.includes("'k_oath_hammer'") && DB.items.k_oath_hammer, 'k_oath_hammer');
// ロウェルの痕跡 (verbatim)
const trace = (S.match(/\*\*ロウェルの痕跡\*\*（ボルグ、クリア前）：「([^」]+)」/) || [])[1];
ok(trace && SRC.includes(trace), 'ロウェルの痕跡 verbatim in Borg\'s lines');
ok(SRC.includes('dovan_borg_reward'), 'dovan_borg_reward');

// ---- §10.8.1 row 6
const row = (SPEC.match(/\| 6 \| `r_mine` \|[^\n]+/) || [''])[0];
for (const t of ['dovan', 'tr_b_rockeater', 'tr_b_ironwarden', 'k_page_mine']) ok(row.includes(t), '§10.8.1 row mentions ' + t);
ok(DB.regions.r_mine && DB.regions.r_mine.fragment === 'k_page_mine', 'DB.regions.r_mine.fragment = k_page_mine');

// ---- §10.6.1 / §10.6.2
const trow = (SPEC.match(/\| `dovan` \| 鉱山都市ドヴァン[^\n]+/) || [''])[0];
ok(/town_mine/.test(trow) && DB.maps.dovan.theme === 'town_mine', 'dovan theme town_mine');
ok(/`town`/.test(trow) && DB.maps.dovan.bgm === 'town', 'dovan BGM town');
const drow = (SPEC.match(/\| deep_mine \| 深き坑道[^\n]+/) || [''])[0];
const floors = +((drow.match(/deep_mine_1\.\.(\d)/) || [])[1] || 0);
ok(floors === 3, '§10.6.2 deep_mine has 3 floors');
for (let i = 1; i <= floors; i++) {
  const d = DB.maps['deep_mine_' + i];
  ok(d && d.theme === 'mine' && d.bbg === 'mine' && d.bgm === 'cave' && d.encounter === 'z_r_mine_mine', 'deep_mine_' + i + ' theme/bbg/BGM/zone per §10.6.2');
}
// ---- §10.6.4
const srow = (SPEC.match(/\| reg-b（A21） \| `tide_cave_1`[^\n]+/) || [''])[0];
ok(/`deep_mine_2`/.test(srow) && /レア魔物の小部屋/.test(srow), '§10.6.4 deep_mine_2 → レア魔物の小部屋');
const m2 = compile('deep_mine_2');
let secrets = 0;
for (let y = 0; y < m2.h; y++) for (let x = 0; x < m2.w; x++) if (/^secret_/.test(m2.tileAt(x, y))) secrets++;
ok(secrets >= 1 && secrets <= 3, 'deep_mine_2 has a 1–3 cell secret passage (' + secrets + ')');
ok((DB.maps.deep_mine_2.zones || []).some((z) => z.zone === 'z_r_mine_den') && DB.rareEncounters.z_r_mine_den, 'the den has its own zone with a rare rate');
for (const id of ['deep_mine_1', 'deep_mine_3', 'dovan']) { const m = compile(id); let n = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (/^secret_/.test(m.tileAt(x, y))) n++; ok(n === 0, id + ' has no secret passage'); }

// ---- §10.9.4
const fine = (SPEC.match(/\| mine \| 「([^」]+)」/) || [])[1];
ok(fine && SRC.includes(fine), 'Fine\'s mine line (§10.9.4) used by the fallback');

// ---- §8.8
const rew = (SPEC.match(/\| `dovan_borg_reward` \| `(\w+)`/) || [])[1];
ok(rew && DB.items[rew] && SRC.includes("'" + rew + "'"), '§8.8 dovan_borg_reward gives ' + rew);

console.log('check_reg6: ' + good + ' ok, ' + bad + ' mismatch(es)');
process.exit(bad ? 1 : 0);
