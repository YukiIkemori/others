#!/usr/bin/env node
// Tests for the world area (A18a): src/data/{regions,locations,objectives,config}.js,
// src/maps/world.js (tools/gen_world.js), src/events/world*.js. Node only; exit 1 on failure.
//
//   node tools/test_world.js            all tests (includes tools/check_world.js and a generator run)
//   node tools/test_world.js --fast     skip the generator re-run
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { checkWorld, loadGame } = require('./check_world');

const ROOT = path.resolve(__dirname, '..');
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; failures.push(msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
const width = (s) => [...String(s).replace(/\{hero\}/g, '＿＿＿＿＿')].reduce((n, ch) => n + (ch.charCodeAt(0) < 0x100 ? 0.5 : 1), 0);
const lines = (s) => String(s).split('\n');

const R = loadGame();
const DB = R.DB;
ok(!R._nodeLoadErrors.some((e) => /src[\\/](data[\\/](regions|locations|objectives|config)|maps[\\/]world|events[\\/]world)/.test(e)), 'world files load without errors: ' + R._nodeLoadErrors.join(' | '));

// ============================================================ spec blocks from DESIGN.md
/** the ```js block right after a heading */
function block(heading) {
  const i = DESIGN.indexOf(heading);
  if (i < 0) return null;
  const a = DESIGN.indexOf('```js', i), b = DESIGN.indexOf('```', a + 5);
  return DESIGN.slice(a + 5, b);
}
function evalSpec(code) {
  const sandbox = { R: { DB: { config: {}, locations: {} } } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return JSON.parse(JSON.stringify(sandbox.R.DB));
}
// §10.4.1 chronicle
{
  const spec = evalSpec(block('#### 10.4.1'));
  eq(DB.config.chronicle, spec.config.chronicle, '§10.4.1 DB.config.chronicle');
}
// §10.13.11 config (the chronicle placeholder aside)
{
  const code = block('#### 10.13.11').replace(/chronicle: \{ \/\* §10\.4\.1 \*\/ \},/, '');
  const spec = evalSpec(code).config;
  for (const k of Object.keys(spec)) eq(DB.config[k], spec[k], `§10.13.11 DB.config.${k}`);
  for (const k of Object.keys(DB.config)) ok(k in spec || k === 'chronicle', `DB.config.${k} is not in §10.13.11`);
}
// §10.6.3 locations (values and order)
{
  const spec = evalSpec(block('#### 10.6.3')).locations;
  eq(Object.keys(DB.locations), Object.keys(spec), '§10.6.3 DB.locations order');
  for (const id in spec) eq(DB.locations[id], spec[id], `§10.6.3 DB.locations.${id}`);
}

// ============================================================ regions (§10.8)
const REG = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
eq(Object.keys(DB.regions), REG, 'DB.regions ids and order (§10.13.1)');
{
  // the §10.8.1 table
  const rows = DESIGN.split('\n').filter((l) => /^\| [1-8] \| `r_/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
  eq(rows.length, 8, '§10.8.1 has 8 rows');
  const RS = { r_forest: 'forest', r_desert: 'desert', r_snow: 'snow', r_marsh: 'marsh', r_isles: 'isles', r_mine: 'mine', r_ash: 'ash', r_star: 'star' };
  for (const c of rows) {
    const n = +c[1], id = c[2].replace(/`/g, ''), r = DB.regions[id];
    ok(!!r, `region ${id} exists`);
    if (!r) continue;
    eq(r.name, c[3], `${id}.name`);
    eq(r.chapter.no, n, `${id}.chapter.no`);
    eq(r.n, n, `${id}.n`);
    eq(r.short, RS[id], `${id}.short`);
    eq(r.locations, c[5].match(/`([a-z_]+)`/g).map((s) => s.replace(/`/g, '')), `${id}.locations`);
    eq(r.bossTroop, c[7].split('→')[1].trim().replace(/`/g, ''), `${id}.bossTroop`);
    eq(r.fragment, c[8].replace(/`/g, ''), `${id}.fragment`);
    eq(r.town, c[9].replace(/`/g, ''), `${id}.town`);
    // the region's own section: 章の題 / 章の要約 / hint
    const sec = DESIGN.indexOf('`' + id + '` ' + r.name + '（担当');
    ok(sec > 0, `§10.8 section of ${id}`);
    const part = DESIGN.slice(sec, sec + 4000);
    const cell = (label) => { const m = part.match(new RegExp('^\\| ' + label + ' \\| (.*) \\|$', 'm')); return m ? m[1] : null; };
    eq(r.chapter.title, cell('章の題'), `${id}.chapter.title`);
    eq(r.chapter.summary.replace(/\n/g, ''), cell('章の要約').replace(/\\n/g, ''), `${id}.chapter.summary (same words as §10.8)`);
    eq(r.hint, cell('hint').replace(/\\n/g, '\n'), `${id}.hint`);
    for (const l of lines(r.chapter.summary)) ok(width(l) <= 12, `${id} summary line over 12: ${l}`);
    ok(lines(r.chapter.summary).length <= 9, `${id} summary has at most 9 lines`);
    for (const l of lines(r.hint)) ok(width(l) <= 14, `${id} hint line over 14: ${l}`);
    ok(lines(r.hint).length === 2, `${id} hint has 2 lines (P10 shows two hints per message window)`);
    ok(width(r.name) <= 10, `${id}.name within 10`);
    ok(r.zone === 'zw_' + RS[id], `${id}.zone`);
    for (const d of r.dungeons) ok(DB.locations[d] && DB.locations[d].kind === 'dungeon' && DB.locations[d].region === id, `${id}.dungeons ${d}`);
    for (const t of r.locations) ok(DB.locations[t] && DB.locations[t].kind === 'town' && DB.locations[t].region === id, `${id}.locations ${t}`);
  }
  // every dungeon entrance of a region is listed in its region
  for (const [lid, L] of Object.entries(DB.locations)) if (L.kind === 'dungeon' && DB.regions[L.region]) ok(DB.regions[L.region].dungeons.includes(lid), `${lid} in its region's dungeons`);
}
// the pages exist once the key items are there (gear-b)
if (Object.keys(DB.items || {}).length) for (const id of REG) ok(!!DB.items[DB.regions[id].fragment], `page ${DB.regions[id].fragment} defined`);
if (Object.keys(DB.troops || {}).length) for (const id of REG) ok(!!DB.troops[DB.regions[id].bossTroop], `troop ${DB.regions[id].bossTroop} defined`);

// ============================================================ objectives (§10.13.8)
{
  const rows = DESIGN.split('\n').filter((l) => /^\| `obj_(w_|regions)/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
  eq(rows.length, 5, '§10.13.8 world objectives');
  for (const c of rows) {
    const id = c[1].replace(/`/g, '');
    ok(!!DB.objectives[id], `objective ${id}`);
    if (!DB.objectives[id]) continue;
    eq(DB.objectives[id].text, c[2].replace(/\\n/g, '\n'), `objective ${id} text`);
    for (const l of lines(DB.objectives[id].text)) ok(width(l.replace('{left}', '8')) <= 20, `${id} line over 20`);
  }
  const mine = Object.keys(DB.objectives).filter((k) => k.startsWith('obj_w_') || k === 'obj_regions');
  eq(mine.sort(), rows.map((c) => c[1].replace(/`/g, '')).sort(), 'only the §10.13.8 world objectives use the world prefixes');
  ok(DB.objectives[DB.config.startObjective], 'startObjective exists');
}

// ============================================================ config details
{
  const c = DB.config;
  ok(c.defaultHero.name === 'アルン' && width(c.defaultHero.name) <= 5, 'defaultHero name');
  if (DB.heroTypes && Object.keys(DB.heroTypes).length) ok(!!DB.heroTypes[c.defaultHero.type], 'defaultHero type exists');
  if (DB.weaponTypes && Object.keys(DB.weaponTypes).length) ok(!!DB.weaponTypes[c.defaultHero.favor.id], 'defaultHero favour exists');
  eq(c.innPrice.length, 10, 'innPrice has tiers 0..9');
  ok(c.innPrice.every((p, i) => i === 0 || p > c.innPrice[i - 1]), 'innPrice rises');
  for (const k of ['prologue', 'finale', 'side']) for (const l of lines(c.chronicle[k].summary)) ok(width(l) <= 12, `chronicle ${k} line over 12: ${l}`);
  ok(Object.keys(c.warpGroups).sort().join() === 'finale,prologue', 'warpGroups names the non-region groups');
  for (const [lid, L] of Object.entries(DB.locations)) ok(!!(c.warpGroups[L.region] || (DB.regions[L.region] && DB.regions[L.region].name)), `warp group name for ${lid}`);
}

// ============================================================ text rules on the world area's own strings (STYLE_JA §7.3, §10)
{
  const files = ['src/data/regions.js', 'src/data/locations.js', 'src/data/objectives.js', 'src/data/config.js', 'src/events/world.js', 'src/events/world_common.js'];
  const BANNED = ['冒険の書', '復活の呪文', 'ふっかつのじゅもん', '呪文', '痛恨', '会心の一撃', 'やっつけた', '回り込まれて', '何も起こらなかった', 'ジョブ', 'アビリティ', '麻痺', '魔法防御', '並び替え', '酒場の主人', '頁', '蘇生'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const strings = [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((s) => /[぀-ヿ一-鿿]/.test(s));
    for (const s of strings) {
      for (const b of BANNED) ok(!s.includes(b), `${f}: banned word ${b} in ${s}`);
      ok(!/…(?!…)/.test(s.replace(/……/g, '')), `${f}: single … in ${s}`);
      ok(!/[！？](?![　」』）！？]|\\n|$)/.test(s), `${f}: a sentence goes on after ！？ without a full-width space: ${s}`);
      for (const l of s.split('\\n')) ok(width(l) <= 20 || /summary/.test(f), `${f}: line over 20: ${l}`);
      ok(!s.includes('アルン') || f.endsWith('config.js'), `${f}: hero name written out`);
    }
  }
}

// ============================================================ world map through the engine
{
  const res = checkWorld(R);
  ok(res.errors.length === 0, 'check_world: ' + res.errors.join(' | '));
  const M = R.FieldMap.compile('world');
  ok(M && M.wrap && M.w === 128 && M.h === 112, 'FieldMap.compile(world): 128×112, wraps');
  ok(M.tileAt(-1, 0) === M.tileAt(127, 0) && M.tileAt(128, 5) === M.tileAt(0, 5), 'the world wraps both ways');
  const sp = M.spawn('lute');
  eq([sp.x, sp.y], [46, 58], 'spawn lute on the icon');
  eq(M.zoneAt(sp.x, sp.y + 2), 'zw_prologue', 'zone south of ファロス');
  eq(M.zoneAt(42, 36), 'zw_forest', 'zone at the crossroads');
  // the patches follow the story (R.State.check through the game)
  if (R.State && R.State.newGame) {
    let okNew = true;
    try { R.State.newGame(); } catch (e) { okNew = false; }
    if (okNew && R.Game) {
      M.refresh();
      eq(M.tileAt(42, 41), 'sea', 'the drawbridge is up at the start');
      // the first sea cell west of 書の都ビブリア's island is fogged
      const bx = M.spawn('biblia');
      let fx = bx.x;
      while (fx > 50 && R.DB.legends.world[R.DB.maps.world.rows[bx.y][fx]] !== 'sea') fx--;
      eq(M.tileAt(fx, bx.y), 'fog', 'fog around ビブリア島 at the start');
      R.Game.flags.prologue_done = true;
      M.refresh();
      eq(M.tileAt(42, 41), 'bridge_v', 'the drawbridge comes down with prologue_done');
      const tomb = M.spawn('sand_tomb_1');
      const near = [[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].map(([dx, dy]) => M.tileAt(tomb.x + dx, tomb.y + dy));
      ok(near.includes('sandstorm'), 'sandstorm round 砂の王墓 before r_desert');
      R.Game.flags.cleared_r_desert = true;
      if (!R.Game.regionsCleared.includes('r_desert')) R.Game.regionsCleared.push('r_desert');
      R.Game.tier = R.Game.regionsCleared.length;
      M.refresh();
      const after = [[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].map(([dx, dy]) => M.tileAt(tomb.x + dx, tomb.y + dy));
      ok(!after.includes('sandstorm'), 'the sandstorm is gone after r_desert');
      R.Game.flags.cleared_r_mine = true;
      R.Game.regionsCleared.push('r_mine');
      R.Game.tier = R.Game.regionsCleared.length;
      M.refresh();
      eq(M.tileAt(75, 20), 'road', 'ドヴァンの抜け道 opens after r_mine');
      const ch = M.chests.find((c) => c.id === 'world_c3');
      ok(ch && ch.pool === 'p_rare', 'world_c3 is a p_rare chest');
    }
  }
}

// ============================================================ events (dry runs with a stub ev)
function stubEv(o) {
  const log = [];
  const flags = new Set(o.flags || []);
  const ev = {
    ctx: { npc: o.npc || {} }, self: o.npc ? o.npc.id : null, map: o.map || 'lute',
    async say(t) { log.push(['say', t]); },
    async ask(t, choices) { log.push(['ask', t, choices]); return o.pick != null ? o.pick : choices.length - 1; },
    flag: (f) => flags.has(f),
    async warp(m, s, op) { log.push(['warp', m, s, op && op.sfx]); },
    async inn(p) { log.push(['inn', p]); },
    async shop(id) { log.push(['shop', id]); },
    async tavern(op) { log.push(['tavern', op]); },
    async rest() { log.push(['rest']); },
    closeMessage() {}, sfx(id) { log.push(['sfx', id]); }, heal() { log.push(['heal']); },
    async flash() {},
  };
  return { ev, log, flags };
}
async function events() {
  const E = DB.events;
  for (const id of ['common_inn', 'common_tavern', 'common_shop', 'common_ferry', 'common_rest', 'world_bridge_closed']) {
    ok(E[id] && typeof E[id].run === 'function' && E[id].meta, `event ${id} with meta and run`);
  }
  // 宿屋: the NPC's price or the tier price
  { const { ev, log } = stubEv({ npc: { id: 'inn' } }); await E.common_inn.run(ev); eq(log, [['inn', undefined]], 'common_inn → ev.inn()'); }
  { const { ev, log } = stubEv({ npc: { id: 'inn', price: 0, greet: 'ようこそ。' } }); await E.common_inn.run(ev); eq(log, [['say', 'ようこそ。'], ['inn', 0]], 'common_inn greet + price'); }
  // 酒場
  { const { ev, log } = stubEv({ npc: { id: 'tavern' } }); await E.common_tavern.run(ev); eq(log, [['tavern', { recruit: true }]], 'common_tavern → ev.tavern({recruit:true})'); }
  { const { ev, log } = stubEv({ npc: { id: 'tavern', recruit: false } }); await E.common_tavern.run(ev); eq(log, [['tavern', { recruit: false }]], 'common_tavern recruit:false'); }
  // 店
  {
    const shopId = Object.keys(DB.shops || {})[0];
    if (shopId) { const { ev, log } = stubEv({ npc: { id: 'shop_item', shop: shopId } }); await E.common_shop.run(ev); eq(log, [['shop', shopId]], 'common_shop → ev.shop(npc.shop)'); }
    const warn = R.warn; R.warn = () => {};
    const { ev, log } = stubEv({ npc: { id: 'shop_item', shop: 'no_such_shop' } }); await E.common_shop.run(ev);
    R.warn = warn;
    ok(log.length === 1 && log[0][0] === 'say', 'common_shop with an unknown shop only talks');
  }
  // 休息の灯
  { const { ev, log } = stubEv({ npc: { id: 'rest' } }); await E.common_rest.run(ev); eq(log, [['rest']], 'common_rest → ev.rest()'); }
  {
    const { ev, log } = stubEv({ npc: { id: 'rest' } }); delete ev.rest; await E.common_rest.run(ev);
    ok(log.some((l) => l[0] === 'heal') && log.some((l) => l[0] === 'say' && l[1] === '灯の光に包まれて、\n疲れが消えていく……。'), 'common_rest fallback heals with the fixed line');
  }
  // world_bridge_closed
  { const { ev, log } = stubEv({}); await E.world_bridge_closed.run(ev); eq(log, [['say', '跳ね橋が上がっている。']], 'world_bridge_closed line'); }
  // 定期船 (§10.5.5): routes by flags, the chosen port's dock, the sfx
  const SPEC = { lute: [['coral', 'loch'], ['coral', 'loch', 'biblia']], loch: [['lute', 'coral']], coral: [['lute', 'loch']], biblia: [['lute']] };
  const hadGame = !!R.Game;
  if (!hadGame) { try { R.State.newGame(); } catch (e) { /* no rules yet */ } }
  const g = R.Game;
  if (g) {
    const setFlags = (fs) => { g.flags = {}; for (const f of fs) g.flags[f] = true; };
    setFlags([]);
    { const { ev, log } = stubEv({ npc: { id: 'ferry', ferryFrom: 'lute' } }); await E.common_ferry.run(ev); eq(log, [['say', '灯台の火が消えているうちは、\n船は出せないんです。']], 'ferry at ファロス before prologue_done'); }
    for (const from of Object.keys(SPEC)) {
      for (const [k, st] of [[0, ['prologue_done']], [1, ['prologue_done', 'final_open']]]) {
        setFlags(st);
        const want = SPEC[from][k] || SPEC[from][0];
        const names = want.map((t) => DB.locations[t].name);
        { const { ev, log } = stubEv({ npc: { id: 'ferry', ferryFrom: from } }); await E.common_ferry.run(ev);
          eq(log[0], ['ask', '定期船は、いつでも出せますよ。\nどちらへ？', names.concat(['やめる'])], `ferry from ${from} (${st.join(' ')}) offers ${want.join(' ')}`);
          eq(log[1], ['say', 'またいつでもどうぞ。'], `ferry from ${from}: やめる`); }
        for (let i = 0; i < want.length; i++) {
          const { ev, log } = stubEv({ npc: { id: 'ferry', ferryFrom: from }, pick: i }); await E.common_ferry.run(ev);
          eq(log.slice(1), [['say', 'では、出航！'], ['warp', want[i], 'dock', 'ship']], `ferry ${from} → ${want[i]}`);
        }
      }
    }
    // meta.warp matches the table (progress.js follows it)
    const mw = E.common_ferry.meta.warp.map((w) => `${w.from}>${w.to}:${w.spawn}:${w.needs.join('+')}`).sort();
    eq(mw, ['biblia>lute:dock:', 'coral>loch:dock:', 'coral>lute:dock:', 'loch>coral:dock:', 'loch>lute:dock:', 'lute>biblia:dock:flag:final_open', 'lute>coral:dock:flag:prologue_done', 'lute>loch:dock:flag:prologue_done'], 'common_ferry meta.warp = §10.5.5');
    setFlags([]);
  }
}

// ============================================================ the generator reproduces src/maps/world.js
function generatorSync() {
  if (process.argv.includes('--fast')) return;
  const tmp = path.join(os.tmpdir(), 'world_gen_' + process.pid + '.js');
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'gen_world.js'), '--quiet', '--out', tmp], { stdio: 'pipe' });
    const a = fs.readFileSync(tmp, 'utf8'), b = fs.readFileSync(path.join(ROOT, 'src', 'maps', 'world.js'), 'utf8');
    ok(a === b, 'src/maps/world.js is the output of tools/gen_world.js (re-run the generator)');
  } catch (e) { ok(false, 'gen_world.js failed: ' + (e.stderr ? e.stderr.toString() : e.message)); }
  finally { try { fs.unlinkSync(tmp); } catch (e) { /* gone */ } }
}

(async () => {
  await events();
  generatorSync();
  for (const f of failures) console.log('FAIL', f);
  console.log(`test_world: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
