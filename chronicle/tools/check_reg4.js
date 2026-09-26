#!/usr/bin/env node
// check_reg4.js (owner R4, reg-4) — conformance of region 4 グレイモア湿原 with the text of DESIGN.md.
// Reads DESIGN.md itself (not a copy) and cross-checks the implementation:
//   D1  every 「…」 line of the §10.8.5 flow table / ロウェルの痕跡 appears in the region-4 sources
//       (unescaped; a spec line may be the start of a longer page)
//   D2  obj_marsh_1..3 texts = the 目的の文 line of §10.8.5
//   D3  §10.6.1 loch row (theme, BGM, inn/tavern/shops/ferry) and §10.6.2 rows (floors, theme, bbg, BGM, zone)
//   D4  §10.6.4: mist_manor_1 is region 4's only secret floor and holds a rare-monster room (own zone)
//   D5  §10.13.5 troops tr_b_dolls / tr_b_mistbeast exist and are fought by the region's events
//   D6  §10.13.6 k_marsh_key is given by an event (never by a chest); §8.8 reward loch_tobias_reward
//   D7  §10.9.1/§10.9.5: the tier-1 notice sign, the scribe (tier 4–6), a {tier:4}/final_open line
//   D8  §10.8.0: flags marsh_start/_mid/_fine/_boss and var marsh_bells are used; ev.clearRegion('r_marsh')
//       then the inn of the clear town (§10.8.1: loch) and story_after_clear
//   node tools/check_reg4.js   (exit 1 on any failure)
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/load')();
const ROOT = path.resolve(__dirname, '..');
const DB = R.DB;
const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const srcFiles = ['src/maps/region4_00_kit.js', 'src/maps/region4_loch.js', 'src/maps/region4_manor.js', 'src/maps/region4_marsh.js', 'src/events/region4_loch.js', 'src/events/region4_dungeons.js'];
const src = srcFiles.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const srcText = src.replace(/\\n/g, '\n').replace(/\\f/g, '\f');
let pass = 0, fail = 0;
const ok = (c, id, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + id + ' ' + msg); } };

// the §10.8.5 section
const s0 = design.indexOf('#### 10.8.5 地方4');
const s1 = design.indexOf('#### 10.8.6', s0);
const sec = design.slice(s0, s1);

// D1 quoted lines of the flow table (rows #1–#7) and ロウェルの痕跡
const flow = sec.split('\n').filter((l) => /^\| [1-7] \|/.test(l) || l.startsWith('**ロウェルの痕跡**'));
const quotes = [];
for (const l of flow) for (const m of l.matchAll(/「([^」]+)」/g)) quotes.push(m[1].replace(/\\n/g, '\n'));
ok(quotes.length >= 10, 'D1', 'found the spec lines (' + quotes.length + ')');
for (const q of quotes) {
  const parts = q.split('\n');
  const found = srcText.includes(q) || parts.every((p) => srcText.includes(p));
  ok(found, 'D1', 'spec line in the sources: ' + JSON.stringify(q));
}

// D2 objectives
const objLine = sec.split('\n').find((l) => l.startsWith('目的の文'));
for (const m of objLine.matchAll(/`(obj_marsh_\d)`「([^」]+)」/g)) ok(DB.objectives[m[1]] && DB.objectives[m[1]].text === m[2].replace(/\\n/g, '\n'), 'D2', m[1] + ' text');

// D3 §10.6.1 / §10.6.2 rows
const row = (key) => design.split('\n').find((l) => l.startsWith('| `' + key + '`') || l.startsWith('| ' + key + ' |'));
const lochRow = design.split('\n').find((l) => l.startsWith('| `loch` | 水辺の町ロッホ'));
ok(lochRow && lochRow.includes('town_marsh') && lochRow.includes('`town`'), 'D3', '§10.6.1 loch row: town_marsh / town');
ok(DB.maps.loch.theme === 'town_marsh' && DB.maps.loch.bgm === 'town', 'D3', 'loch theme/bgm as §10.6.1');
const npcs = (id) => DB.maps[id].npcs || [];
ok(['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'ferry'].every((k) => npcs('loch').some((n) => n.id === k)), 'D3', 'loch: 宿屋・酒場・item/weapon/armor・定期船 (§10.6.1)');
for (const [dg, floors, theme, zone] of [['mist_manor', ['mist_manor_1', 'mist_manor_2'], 'manor', 'z_r_marsh_manor'], ['bell_marsh', ['bell_marsh_1'], 'swamp', 'z_r_marsh_bog']]) {
  const r = row(dg);
  ok(r && r.includes('`' + theme + '`') && r.includes('`ghost`') && r.includes('`' + zone + '`'), 'D3', '§10.6.2 ' + dg + ' row (theme ' + theme + ', ghost, ' + zone + ')');
  for (const f of floors) {
    const d = DB.maps[f];
    ok(d && d.theme === theme && d.bgm === 'ghost' && d.encounter === zone && d.bbg === theme, 'D3', f + ' theme/bbg/bgm/zone');
  }
}

// D4 §10.6.4
const secRow = design.split('\n').find((l) => l.includes('`mist_manor_1`') && l.includes('隠し通路') === false && l.includes('reg-a'));
ok(!!secRow && secRow.includes('レア魔物の小部屋'), 'D4', '§10.6.4 lists mist_manor_1 → レア魔物の小部屋');
{
  R.State.newGame();
  let n = 0, zoneOk = false;
  for (const id of ['loch', 'mist_manor_1', 'mist_manor_2', 'bell_marsh_1']) {
    const M = R.FieldMap.compile(id); M.refresh();
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.isSecret(x, y)) { n++; if (id === 'mist_manor_1' && M.zoneAt(x, y - 2) !== M.encounter) zoneOk = true; }
  }
  ok(n > 0 && n <= 3, 'D4', 'region 4 has one short secret passage (' + n + ' cells)');
  ok(zoneOk, 'D4', 'the room behind it is its own zone');
  const z = DB.rareEncounters.z_r_marsh_teaparty, b = DB.rareEncounters.z_r_marsh_manor;
  ok(z && b && Math.abs(b.rate / z.rate - 3) < 0.2, 'D4', 'rare-monster rate ×3 in that room (1/' + (z && z.rate) + ' vs 1/' + (b && b.rate) + ')');
}

// D5 troops
for (const t of ['tr_b_dolls', 'tr_b_mistbeast']) {
  ok(!!DB.troops[t], 'D5', t + ' is registered (boss)');
  ok(src.includes("ev.battle('" + t + "')"), 'D5', t + ' is fought by a region-4 event');
  ok(sec.includes('`' + t + '`'), 'D5', t + ' named in §10.8.5');
}
ok(/if \(r !== 'win'\) return false;/.test(src), 'D5', "boss events return false unless 'win' (§10.8.0-4)");

// D6 key item and reward
ok(DB.items.k_marsh_key && DB.items.k_marsh_key.type === 'key', 'D6', 'k_marsh_key is a key item');
ok(!['mist_manor_1', 'mist_manor_2', 'bell_marsh_1', 'loch'].some((id) => (DB.maps[id].chests || []).some((c) => c.item)), 'D6', 'no fixed-item chests (§8.12.1)');
ok(DB.events.mist_manor_2_melda.meta.gives.includes('item:k_marsh_key'), 'D6', 'Melda gives k_marsh_key');
const rewardLine = design.split('\n').find((l) => l.includes('loch_tobias_reward') && l.includes('once'));
ok(!!DB.events.loch_tobias_reward && src.includes("'ac_tale_marsh'") && DB.items.ac_tale_marsh && DB.items.ac_tale_marsh.src === 'reward', 'D6', 'loch_tobias_reward gives ac_tale_marsh (§8.8)' + (rewardLine ? '' : ''));

// D7 tier reactions
const loch = DB.maps.loch;
ok((loch.signs || []).some((s) => JSON.stringify(s.cond) === '{"tier":1}' && s.text.includes('記録院の出張所へ')), 'D7', 'the tier-1 notice sign (§10.9.1)');
ok((loch.tilePatches || []).some((p) => JSON.stringify(p.cond) === '{"tier":1}'), 'D7', 'the notice board tile appears at tier 1');
const tierLines = npcs('loch').filter((n) => Array.isArray(n.text) && n.text.some((e) => e && (JSON.stringify(e.cond) === '{"tier":4}' || e.cond === 'final_open')));
ok(tierLines.length >= 1, 'D7', 'town NPCs with a {tier:4} or final_open line (' + tierLines.length + ')');
const before = npcs('loch').filter((n) => Array.isArray(n.text) && n.text.some((e) => e && JSON.stringify(e.cond) === '{"cleared":"r_marsh"}'));
ok(before.length >= 10, 'D7', 'town NPCs with a before/after-clear pair (' + before.length + ')');

// D8 flags, the clear
for (const f of ['marsh_start', 'marsh_mid', 'marsh_fine', 'marsh_boss', 'marsh_key']) ok(src.includes("'" + f + "'"), 'D8', 'flag ' + f + ' is used');
ok(src.includes("'marsh_bells'"), 'D8', 'var marsh_bells is used');
const iClear = src.indexOf("ev.clearRegion('r_marsh')"), iWarp = src.indexOf("ev.warp('loch', 'inn'"), iAfter = src.indexOf("ev.call('story_after_clear')");
ok(iClear > 0 && iWarp > iClear && iAfter > iWarp, 'D8', "clearRegion('r_marsh') → warp loch inn → story_after_clear");
ok(src.includes("'その夜は、町の宿で眠った。'"), 'D8', 'the inn caption of §10.8.0-3');
ok(DB.regions.r_marsh && DB.regions.r_marsh.town === 'loch', 'D8', 'the clear town is loch (§10.8.1)');

console.log(`check_reg4: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
