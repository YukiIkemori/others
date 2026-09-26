#!/usr/bin/env node
// check_reg1 (owner R1): region 1 ヴェルダの森 against the text of DESIGN.md itself (exit 1 on a mismatch).
// test_reg1.js checks behaviour; this tool reads the normative tables and sentences and checks that the data says
// the same thing:
//   §10.8.2  every quoted line of the event table (#1–#10), the Rowell trace, the objective texts, the NPC list
//            (id + sprite), the troops, the flags / var named in the table
//   §10.6.1  fern: type / theme / BGM / shops (item weapon armor)          §10.6.2  the two dungeons' floors,
//            theme / battle backdrop / BGM / zone                           §10.6.3  location of every floor
//   §10.6.4  the floors with a secret passage                              §10.13.5 where each boss troop is fought
//   §8 reward table: fern_hanna_reward → the item the table names
//   node tools/check_reg1.js [--verbose]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const verbose = process.argv.includes('--verbose');
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true });
const DB = R.DB;
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const SRC = ['src/events/region1_forest.js', ...fs.readdirSync(path.join(ROOT, 'src/maps')).filter((f) => /^region1_/.test(f)).map((f) => 'src/maps/' + f)]
  .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; if (verbose) console.log('  ok  ', m); } else { fails++; console.log('  FAIL', m); } };

/** the section of DESIGN.md that starts with `head` and ends before the next heading of the same level */
function section(head) {
  const i = DESIGN.indexOf(head);
  if (i < 0) return '';
  const lvl = head.match(/^#+/)[0];
  const rest = DESIGN.slice(i + head.length);
  const j = rest.search(new RegExp('\\n' + lvl + ' '));
  return head + (j < 0 ? rest : rest.slice(0, j));
}
/** every string literal in our sources, unescaped, with the line breaks and the ♪ spacing taken out */
const norm = (s) => s.replace(/\\n|\n/g, '').replace(/♪[ 　]*/g, '♪').replace(/\s+/g, '');
const literals = [];
{ const re = /'((?:[^'\\\n]|\\.)*)'/g; let m; while ((m = re.exec(SRC))) literals.push(norm(m[1])); }
const joined = literals.join('|');
const inSource = (q) => { const n = norm(q); return literals.some((l) => l.includes(n)) || joined.includes(n); };

// ------------------------------------------------------------ §10.8.2
const S82 = section('#### 10.8.2 地方1 `r_forest`');
ok(S82.length > 500, '§10.8.2 found');
{
  const table = S82.split('\n').filter((l) => /^\| (\d+) \|/.test(l));
  ok(table.length === 10, '§10.8.2 event table has 10 rows (' + table.length + ')');
  for (const row of table) {
    const n = row.match(/^\| (\d+)/)[1];
    const quotes = [...row.matchAll(/「([^」]+)」/g)].map((m) => m[1]);
    for (const q of quotes) ok(inSource(q), '#' + n + ' line in the source: 「' + q.replace(/\\n/g, '⏎') + '」');
    for (const id of [...row.matchAll(/`((?:fern|verda_maze|elder_tree)_[a-z0-9_]+|story_fine_forest|tr_b_[a-z]+|obj_forest_\d|forest_[a-z]+|npc:[a-z]+)`/g)].map((m) => m[1])) {
      if (/^(fern|verda_maze|elder_tree)_/.test(id)) {
        const isMap = !!DB.maps[id];
        ok(isMap || !!DB.events[id], '#' + n + ' id ' + id + ' exists (map or event)');
      } else if (/^tr_b_/.test(id)) ok(!!DB.troops[id] && SRC.includes("'" + id + "'"), '#' + n + ' troop ' + id + ' fought here');
      else if (/^obj_forest_/.test(id)) ok(!!DB.objectives[id] && SRC.includes("'" + id + "'"), '#' + n + ' objective ' + id + ' set here');
      else if (/^forest_/.test(id)) ok(SRC.includes("'" + id + "'") || SRC.includes('flag:' + id) || SRC.includes('var:' + id), '#' + n + ' flag/var ' + id + ' used here');
      else if (/^npc:/.test(id)) ok(SRC.includes("'" + id.slice(4) + "'"), '#' + n + ' sprite ' + id + ' used here');
      else if (id === 'story_fine_forest') ok(SRC.includes("'story_fine_forest'"), '#' + n + ' the story\'s story_fine_forest is called');
    }
  }
  // the objective texts
  const objLine = S82.split('\n').find((l) => l.startsWith('目的の文'));
  for (const m of objLine.matchAll(/`(obj_forest_\d)`「([^」]+)」/g)) ok(DB.objectives[m[1]] && DB.objectives[m[1]].text === m[2].replace(/\\n/g, '\n'), 'objective ' + m[1] + ' text is the §10.8.2 text');
  // the NPC list
  const npcLine = S82.split('\n').find((l) => l.startsWith('**NPC**'));
  for (const m of npcLine.matchAll(/（`([a-z]+)`、`npc:([a-z_]+)`/g)) {
    const [, id, spr] = m;
    const where = ['fern', 'verda_maze_1', 'elder_tree_2'].map((mid) => (DB.maps[mid].npcs || []).find((n) => n.id === id)).filter(Boolean);
    ok(where.length > 0 && where.every((n) => n.sprite === 'npc:' + spr || n.sprite === spr), 'NPC ' + id + ' uses npc:' + spr);
  }
  ok(/cond `'forest_dan'` でフェルンに出る/.test(npcLine) && (DB.maps.fern.npcs || []).some((n) => /dan/.test(n.id) && JSON.stringify(n.cond || '').includes('forest_dan')), 'Dan is in fern once forest_dan');
  // the Rowell trace and the after-clear list
  const trace = S82.split('\n').find((l) => l.startsWith('**ロウェルの痕跡**'));
  for (const m of trace.matchAll(/「([^」]+)」/g)) ok(inSource(m[1]), 'the Rowell trace line is Rita\'s');
  const after = S82.split('\n').find((l) => l.startsWith('**クリア後**'));
  ok(/fern_hanna_reward/.test(after) && !!DB.events.fern_hanna_reward, 'fern_hanna_reward exists (the region reward)');
  // the chapter (world owns DB.regions; checked here because the clear scene shows it)
  const title = (S82.match(/\| 章の題 \| ([^|]+) \|/) || [])[1];
  ok(DB.regions.r_forest && DB.regions.r_forest.chapter.title === (title || '').trim(), 'the chapter title is 「' + (title || '').trim() + '」');
  const zu = S82.match(/\| ダンジョン \| `fern`?[^|]*\|/);
  ok(!zu, '(table sanity)');
}

// ------------------------------------------------------------ §10.6.1 / §10.6.2 / §10.6.3
{
  const row = DESIGN.split('\n').find((l) => /^\| `fern` \| 森の村フェルン \|/.test(l));
  const cols = row.split('|').map((s) => s.trim());
  const d = DB.maps.fern;
  ok(d.type === cols[4] && d.theme === cols[5] && d.bgm === cols[6].replace(/`/g, ''), '§10.6.1 fern type / theme / BGM');
  for (const s of cols[9].split(/\s+/)) ok((d.npcs || []).some((n) => n.shop === 'fern_' + s), '§10.6.1 fern has the ' + s + ' shop');
  ok((d.npcs || []).some((n) => n.id === 'inn' && n.event === 'common_inn'), '§10.6.1 fern has an inn');
  ok((d.npcs || []).some((n) => n.id === 'tavern' && n.event === 'common_tavern'), '§10.6.1 fern has a tavern');
  for (const dn of ['verda_maze', 'elder_tree']) {
    const r2 = DESIGN.split('\n').find((l) => new RegExp('^\\| ' + dn + ' \\|').test(l));
    const c = r2.split('|').map((s) => s.trim().replace(/`|（新）|\(新\)/g, '').trim());
    const floors = c[4].match(/_(\d)\.\.(\d)/);
    for (let f = +floors[1]; f <= +floors[2]; f++) {
      const id = dn + '_' + f;
      const m = DB.maps[id];
      ok(!!m, '§10.6.2 floor ' + id + ' exists');
      if (!m) continue;
      ok(m.theme === c[5] && m.bbg === c[6] && m.bgm === c[7] && m.encounter === c[8], '§10.6.2 ' + id + ' theme/bbg/bgm/zone = ' + c.slice(5, 9).join('/'));
      ok(m.location === 'verda_maze', '§10.6.3 ' + id + ' location verda_maze');
    }
    ok(!DB.maps[dn + '_' + (+floors[2] + 1)], '§10.6.2 ' + dn + ' has exactly ' + floors[2] + ' floors');
  }
}
// ------------------------------------------------------------ §10.6.4 secret passages
{
  const row = DESIGN.split('\n').find((l) => /^\| reg-a（A20） \| `verda_maze_2`/.test(l));
  const floors = [...row.split('|')[2].matchAll(/`([a-z_0-9]+)`/g)].map((m) => m[1]).filter((f) => /^(verda|elder)/.test(f));
  const has = (id) => DB.maps[id].rows.some((r) => r.includes('%'));
  for (const f of floors) ok(has(f), '§10.6.4 ' + f + ' has a secret passage');
  for (const f of ['fern', 'verda_maze_1', 'verda_maze_2', 'elder_tree_1', 'elder_tree_2']) if (!floors.includes(f)) ok(!has(f), '§10.6.4 ' + f + ' has none');
}
// ------------------------------------------------------------ §10.13.5 boss troops and their floors
for (const [tr, map] of [['tr_b_moth', 'verda_maze_2'], ['tr_b_rooteater', 'elder_tree_2']]) {
  const rows = DESIGN.split('\n').filter((l) => l.startsWith('| `' + tr + '` |'));
  ok(rows.some((row) => row.includes('`' + map + '`')), '§10.13.5 ' + tr + ' is fought on ' + map);
  const ev = Object.keys(DB.events).find((k) => k.startsWith(map + '_boss'));
  ok(ev && String(DB.events[ev].run).includes("'" + tr + "'"), '§10.13.5 ' + map + ' event ' + ev + ' starts ' + tr);
}
// ------------------------------------------------------------ the reward table (§8)
{
  const row = DESIGN.split('\n').find((l) => l.startsWith('| `fern_hanna_reward` |'));
  const item = row && (row.match(/\| `(ac_[a-z_]+)` \|/) || [])[1];
  ok(item && DB.items[item] && DB.events.fern_hanna_reward.meta.gives.includes('item:' + item) && String(DB.events.fern_hanna_reward.run).includes("'" + item + "'"), 'fern_hanna_reward gives ' + item + ' (the reward table)');
}
// ------------------------------------------------------------ §10.8.0 common rules (the data side)
{
  const d = DB.maps.fern;
  ok(d.onEnter && DB.events[d.onEnter], '§10.8.0-3 fern onEnter learns of the incident');
  const boss = String(DB.events.elder_tree_2_boss.run);
  ok(/r !== 'win'\) return false/.test(boss), '§10.8.0-4 a lost or fled boss fight returns false');
  ok(/clearRegion\(REGION\)/.test(boss) && /ev\.warp\('fern', 'inn'/.test(boss) && /ev\.heal\(\)/.test(boss) && /その夜は、町の宿で眠った。/.test(boss) && /story_after_clear/.test(boss), '§10.8.0-3 clear → the inn → heal → caption → story_after_clear');
  ok(/r !== 'win'\) return false/.test(String(DB.events.verda_maze_2_boss.run)), '§10.8.0-4 the mid boss too');
}

console.log(`check_reg1: ${passes} ok, ${fails} failed`);
process.exit(fails ? 1 : 0);
