#!/usr/bin/env node
// Validator for the towns / castles / shrines and the story events
// (src/maps/town*.js, src/events/story*.js, src/data/objectives.js).
//
//   node tools/check_towns.js                 static checks (exit 1 on errors)
//   node tools/check_towns.js --png DIR       also render every town map with the
//                                             real tile art + NPC/chest sprites
//   node tools/check_towns.js --png DIR --flags a,b --items x,y --only regnas_town
//                                             render with story flags / key items set
//
// Checks: equal row lengths, legend/mark chars, `under` tiles, spawns on walkable
// tiles, NPCs on walkable tiles (obj:/mon: sprites and throne sitters excepted),
// sprite keys, event ids + meta, service NPC fields (shop/inn/chat), every NPC /
// chest / hidden item / sign / warp reachable from the entrance (doors open,
// locked doors count as openable, unconditional still NPCs block), interiors
// lead back, warp/exit targets & spawns (dungeon maps owned by another agent that
// are not loaded yet only warn), unique chest ids, objectives used by the story,
// forbidden DQ/FF names and over-wide lines (> 20.5 full-width chars) in dialogue.
'use strict';
const fs = require('fs');
const path = require('path');
const load = require('./lib/load');
const { parseMap } = require('./lib/maps');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const PNG = opt('png', null);
const ONLY = opt('only', null);

const R = load({ quiet: true });
const DB = R.DB;
const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
for (const e of R._nodeLoadErrors) if (/town|story|objectives|ending/.test(e)) E('load: ' + e.split('\n')[0]);

// maps of this area (prefix match) — dungeons belong to another owner
const PREFIX = ['regnas_', 'milt_', 'east_gate', 'porta_', 'elfin_', 'salva_', 'frost_', 'arcana_', 'light_temple', 'edge_shrine'];
const REQUIRED = ['regnas_castle', 'regnas_town', 'milt_village', 'east_gate', 'porta_town', 'elfin_village', 'salva_town',
  'frost_village', 'arcana_city', 'light_temple', 'edge_shrine'];
// maps other agents provide (a warp to them is fine even when not loaded yet)
const OTHER = ['world', 'wind_cave_1', 'bandit_fort_1', 'water_cave_1', 'pyramid_1', 'ice_cave_1', 'volcano_1', 'star_tower_1', 'demon_castle_1'];
const mine = Object.keys(DB.maps).filter((id) => PREFIX.some((p) => id.startsWith(p)));
for (const id of REQUIRED) if (!DB.maps[id]) E(`map ${id} missing`);

const BGM = 'title overworld sea town village castle shrine dungeon cave tower pyramid ice volcano lastdungeon abyss battle boss lastboss ending'.split(' ');
const FORBIDDEN = ['メラ', 'ホイミ', 'ルーラ', 'スライム', 'ケアル', 'ファイガ', 'エスナ', 'レイズ', 'ギラ', 'ベホマ', 'リレミト', 'キメラのつばさ', 'ドラクエ', 'ファイナル', 'チョコボ', 'モーグリ'];
const gfx = (k) => R.Gfx && R.Gfx._defs && Object.prototype.hasOwnProperty.call(R.Gfx._defs, k);
const texts = []; // [where, text]
const addText = (where, t) => { if (Array.isArray(t)) t.forEach((x) => addText(where, x)); else if (t != null) texts.push([where, String(t)]); };

const parsed = {};
for (const id in DB.maps) parsed[id] = parseMap(R, id);
const chestIds = {};
for (const id in parsed) for (const c of parsed[id].chests.concat(parsed[id].hidden)) {
  if (chestIds[c.id] && mine.includes(id)) E(`map ${id}: duplicate chest/hidden id ${c.id} (also ${chestIds[c.id]})`);
  chestIds[c.id] = id;
}

function tileDef(P, x, y) { return DB.tiles[P.tileAt(x, y)]; }

for (const id of mine) {
  const def = DB.maps[id], P = parsed[id], w = `map ${id}`;
  const legend = DB.legends[def.legend || 'local'];
  if (def.legend && def.legend !== 'local') E(`${w}: legend must be local`);
  for (const i of P.issues) E(`${w}: ${i}`);
  const marks = def.marks || {};
  for (const ch in marks) {
    if (legend[ch]) E(`${w}: mark '${ch}' is a legend char`);
    if (!R.MARK_CHARS_LOCAL.includes(ch)) E(`${w}: mark '${ch}' not in R.MARK_CHARS_LOCAL`);
    const u = marks[ch].under;
    if (u != null && !legend[u]) E(`${w}: mark '${ch}' has unknown under '${u}'`);
    const uses = def.rows.reduce((a, r) => a + r.split(ch).length - 1, 0);
    if (!uses) W(`${w}: mark '${ch}' unused`);
    if (uses > 1 && (marks[ch].npc || marks[ch].chest || marks[ch].spawn)) W(`${w}: npc/chest/spawn mark '${ch}' used ${uses} times`);
  }
  if (!def.name) E(`${w}: no name`);
  if (!['town', 'castle', 'shrine'].includes(def.type)) E(`${w}: bad type ${def.type}`);
  if (def.bgm && !BGM.includes(def.bgm)) E(`${w}: bad bgm ${def.bgm}`);
  if (def.theme && !DB.themes[def.theme]) E(`${w}: bad theme ${def.theme}`);
  if (def.outside != null && !legend[def.outside]) E(`${w}: bad outside '${def.outside}'`);
  if (def.location && !DB.locations[def.location]) E(`${w}: unknown location ${def.location}`);
  if (def.onEnter && !(DB.events[def.onEnter] && DB.events[def.onEnter].meta)) E(`${w}: onEnter ${def.onEnter} missing / no meta`);
  if (!P.spawns.entrance) E(`${w}: no entrance spawn`);
  for (const s in P.spawns) {
    const sp = P.spawns[s], t = tileDef(P, sp.x, sp.y);
    if (!t || !t.pass) E(`${w}: spawn ${s} at ${sp.x},${sp.y} not walkable`);
  }

  // reachability from the entrance: doors open, locks openable, still NPCs block
  const block = new Set(P.npcs.filter((n) => (n.move || 'still') !== 'wander' && n.cond == null).map((n) => n.x + ',' + n.y));
  const chestAt = new Set(P.chests.map((c) => c.x + ',' + c.y));
  const seen = new Set();
  const ent = P.spawns.entrance;
  const q = ent ? [[ent.x, ent.y]] : [];
  if (ent) seen.add(ent.x + ',' + ent.y);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= P.w || ny >= P.h) continue;
      const t = tileDef(P, nx, ny);
      if (!t || !t.pass || block.has(k) || chestAt.has(k)) continue;
      const dd = P.decorAt && P.decorAt(nx, ny) && DB.decor[P.decorAt(nx, ny)];
      if (dd && !dd.pass) continue; // furniture blocks
      seen.add(k); q.push([nx, ny]);
    }
  }
  const reach = (x, y) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (seen.has((x + dx) + ',' + (y + dy))) return true;
      const mid = tileDef(P, x + dx, y + dy);
      const md = P.decorAt && P.decorAt(x + dx, y + dy) && DB.decor[P.decorAt(x + dx, y + dy)];
      if (((mid && mid.counter) || (md && md.counter)) && seen.has((x + 2 * dx) + ',' + (y + 2 * dy))) return true;
    }
    return seen.has(x + ',' + y);
  };

  for (const n of P.npcs) {
    const nw = `${w}: npc ${n.id} @${n.x},${n.y}`;
    const sprite = n.sprite ? (String(n.sprite).includes(':') ? n.sprite : 'npc:' + n.sprite) : 'npc:man';
    if (!gfx(sprite)) E(`${nw}: sprite ${sprite} not registered`);
    const t = tileDef(P, n.x, n.y);
    const decor = /^(obj|mon):/.test(sprite) || P.tileAt(n.x, n.y) === 'throne';
    if (!decor && (!t || !t.pass)) E(`${nw}: on impassable tile ${P.tileAt(n.x, n.y)}`);
    if (t && /^door|stairs/.test(P.tileAt(n.x, n.y))) E(`${nw}: stands on a door/stairs`);
    if (P.warps.some((wp) => wp.x === n.x && wp.y === n.y)) E(`${nw}: stands on a warp`);
    if (!n.event && n.text == null) E(`${nw}: no text/event`);
    if (n.event) {
      const ev = DB.events[n.event];
      if (!ev) E(`${nw}: unknown event ${n.event}`);
      else if (!ev.meta) E(`${nw}: event ${n.event} has no meta`);
      if (n.event === 'shop' && !DB.shops[n.shop]) E(`${nw}: shop '${n.shop}' unknown`);
      if (n.event === 'inn' && !(n.price > 0)) E(`${nw}: inn without price`);
      if (n.event === 'chat') {
        if (!Array.isArray(n.talk) || !n.talk.length) E(`${nw}: chat without talk[]`);
        else if (n.talk[n.talk.length - 1].cond != null && n.text == null) W(`${nw}: chat without an unconditional fallback`);
        for (const v of n.talk || []) addText(nw, v.text);
      }
    }
    addText(nw, n.text);
    if (n.move === 'wander') {
      let room = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const tt = tileDef(P, n.x + dx, n.y + dy); if (tt && tt.pass) room++; }
      if (!room) W(`${nw}: wanders but cannot move`);
    }
    if (!decor && !reach(n.x, n.y)) E(`${nw}: cannot be talked to (unreachable)`);
    // shop clerks, innkeepers and priests are served across a counter/altar: the
    // party must not be able to walk up beside or behind them
    if (['shop', 'inn', 'church'].includes(n.event) && !n.open) {
      const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => seen.has((n.x + dx) + ',' + (n.y + dy)));
      if (side.length) W(`${nw}: ${n.event} NPC can be walked up to at ${side.map(([dx, dy]) => (n.x + dx) + ',' + (n.y + dy)).join(' ')}`);
    }
  }
  for (const c of P.chests) {
    if (c.item && !DB.items[c.item]) E(`${w}: chest ${c.id} item ${c.item} unknown`);
    if (!c.item && !c.gold) E(`${w}: chest ${c.id} empty`);
    if (!reach(c.x, c.y)) E(`${w}: chest ${c.id} @${c.x},${c.y} unreachable`);
    if (!c.id || c.id.startsWith('chest_')) W(`${w}: chest @${c.x},${c.y} without explicit id`);
  }
  for (const h of P.hidden) {
    if (h.item && !DB.items[h.item]) E(`${w}: hidden ${h.id} item ${h.item} unknown`);
    if (!h.item && !h.gold) E(`${w}: hidden ${h.id} empty`);
    if (!reach(h.x, h.y)) E(`${w}: hidden ${h.id} @${h.x},${h.y} unreachable`);
  }
  for (const s of P.signs) { addText(`${w}: sign`, s.text); if (!reach(s.x, s.y)) E(`${w}: sign @${s.x},${s.y} unreachable`); }
  const tgt = (o, where) => {
    if (!DB.maps[o.to]) { (OTHER.includes(o.to) ? W : E)(`${w}: ${where} → map ${o.to} not loaded`); return; }
    if (typeof o.spawn === 'string' && !parsed[o.to].spawns[o.spawn]) E(`${w}: ${where} → ${o.to} has no spawn '${o.spawn}'`);
  };
  for (const wp of P.warps) {
    tgt(wp, `warp@${wp.x},${wp.y}`);
    if (!seen.has(wp.x + ',' + wp.y)) E(`${w}: warp @${wp.x},${wp.y} unreachable`);
    // interiors must lead back
    if (DB.maps[wp.to] && mine.includes(wp.to) && wp.to !== id) {
      const back = parsed[wp.to].warps.some((b) => b.to === id) || (DB.maps[wp.to].exit && DB.maps[wp.to].exit.to === id);
      if (!back) E(`${w}: ${wp.to} has no way back to ${id}`);
    }
  }
  if (def.exit) tgt(def.exit, 'exit');
  for (const e of P.events) {
    if (!DB.events[e.id]) E(`${w}: event ${e.id} missing`);
    else if (!DB.events[e.id].meta) E(`${w}: event ${e.id} has no meta`);
  }
  // edge exit must be reachable: some walkable edge cell
  if (def.exit) {
    let edge = false;
    for (const k of seen) { const [x, y] = k.split(',').map(Number); if (x === 0 || y === 0 || x === P.w - 1 || y === P.h - 1) edge = true; }
    if (!edge) E(`${w}: has an exit but no reachable edge cell`);
  }
}

// ------------------------------------------------------------------ events & objectives
const storyEvents = ['shop', 'inn', 'church', 'chat', 'regnas_castle_enter', 'king_talk', 'gate_soldier', 'porta_captain', 'temple_altar'];
for (const id of storyEvents) {
  const ev = DB.events[id];
  if (!ev) { E(`event ${id} missing`); continue; }
  if (typeof ev.run !== 'function') E(`event ${id}: no run()`);
  if (!ev.meta) E(`event ${id}: no meta`);
}
const obj = DB.objectives || {};
if (!Object.keys(obj).length) E('R.DB.objectives empty');
for (const k in obj) { if (!obj[k].text) E(`objective ${k}: no text`); addText('objective ' + k, obj[k].text); addText('king advice ' + k, obj[k].king); }
if (R.Story && R.Story.OBJECTIVES) for (const k of R.Story.OBJECTIVES) if (!obj[k]) E(`objective ${k} (used by R.Story) missing`);
if (!obj.obj_start) E('objective obj_start (R.Game default) missing');
for (const f of fs.readdirSync(path.join(ROOT, 'src/events')).filter((f) => /^story/.test(f))) {
  const src = fs.readFileSync(path.join(ROOT, 'src/events', f), 'utf8');
  let mm; const re = /setObjective\(\s*'([^']+)'/g;
  while ((mm = re.exec(src))) if (!obj[mm[1]]) E(`${f}: objective ${mm[1]} unknown`);
  const rs = /'((?:[^'\\]|\\.)*[ぁ-んァ-ン](?:[^'\\]|\\.)*)'/g;
  while ((mm = rs.exec(src))) addText(f, mm[1].replace(/\\n/g, '\n').replace(/\\f/g, '\f'));
}
if (!R.Ending || typeof R.Ending.start !== 'function') E('R.Ending.start missing');
for (const [where, t] of texts) for (const bad of FORBIDDEN) if (t.includes(bad)) E(`${where}: forbidden name '${bad}' in "${t.slice(0, 30)}…"`);
// line width: the message window fits ~20.6 full-width chars (half-width chars count ½)
const units = (s) => [...s].reduce((a, ch) => a + (ch.codePointAt(0) < 0x2000 ? 0.5 : 1), 0);
for (const [where, t] of texts) {
  const lim = 20.5;
  for (const line of t.replace(/\{leader\}/g, 'ユウキ').split(/[\n\f]/)) {
    if (units(line) > lim) W(`${where}: line too wide (${units(line)}): "${line}"`);
  }
}

// ------------------------------------------------------------------ report
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
const nNpc = mine.reduce((s, id) => s + parsed[id].npcs.length, 0);
console.log(`\ncheck_towns: ${errors.length} error(s), ${warns.length} warning(s). maps ${mine.length}, npcs ${nNpc}, texts ${texts.length}`);
for (const id of mine) {
  const P = parsed[id];
  console.log(`  ${id.padEnd(22)} ${String(P.w).padStart(2)}x${String(P.h).padEnd(2)}  npc ${String(P.npcs.length).padStart(2)}  chest ${P.chests.length}  hidden ${P.hidden.length}  warp ${P.warps.length}`);
}
process.exitCode = errors.length ? 1 : 0;

// ------------------------------------------------------------------ PNG render (playwright)
if (PNG) renderPng().catch((e) => { console.error(e); process.exitCode = 2; });

async function renderPng() {
  let playwright;
  try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
  const out = path.resolve(PNG);
  fs.mkdirSync(out, { recursive: true });
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = [];
  for (const d of ['core', 'ui', 'data', 'art', 'audio', 'maps', 'events', 'systems']) {
    const dir = path.join(ROOT, 'src', d);
    if (!fs.existsSync(dir)) continue;
    let list = walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b));
    if (d === 'core') list = ['ns.js', 'input.js', 'gfx.js', 'engine.js', 'save.js'].map((f) => path.join(dir, f)).concat(list.filter((f) => !/\/(ns|input|gfx|engine|save)\.js$/.test(f)));
    files.push(...list);
  }
  const page = `
window.TOWNPNG = function (id, flags, items) {
  const R = window.RPG, G = R.Gfx;
  R.State.newGame();
  for (const f of flags) if (f) R.Game.flags[f] = true;
  for (const i of items) if (i) R.State.addItem(i, 1);
  const m = R.FieldMap.compile(id);
  const cv = document.createElement('canvas'); cv.width = m.w * 16; cv.height = m.h * 16;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const one = (g) => Array.isArray(g) ? g[0] : g;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    let g = R.Art && R.Art.localTile ? R.Art.localTile(m, x, y) : null;
    if (!g) { const t = m.tileAt(x, y); if (t === 'void') continue; g = m.theme && G.has('tile:' + m.theme + ':' + t) ? G.get('tile:' + m.theme + ':' + t) : G.get('tile:' + t); }
    g = one(g); if (g) c.drawImage(g, x * 16, y * 16);
  }
  // decor layer (second pass: tall props overlap the row above)
  if (m.decor) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const d = m.decorAt(x, y);
    if (!d) continue;
    let g = R.Art && R.Art.decorTile ? R.Art.decorTile(m, x, y) : null;
    if (!g && G.has('decor:' + d)) g = G.get('decor:' + d);
    g = one(g); if (g) c.drawImage(g, x * 16 + ((16 - g.width) >> 1), y * 16 + 16 - g.height);
  }
  const chest = G.get('obj:chest');
  for (const ch of m.chests) if (ch.present) c.drawImage(one(chest), ch.x * 16, ch.y * 16);
  const list = m.npcs.filter((n) => n.present).sort((a, b) => a.y - b.y);
  for (const n of list) {
    let s = G.get(n.sprite);
    if (s && !s.getContext && !Array.isArray(s)) s = s[n.dir] || s.down;
    s = one(s);
    if (s) c.drawImage(s, n.x * 16 + 8 - (s.width >> 1), n.y * 16 + 16 - s.height);
  }
  // markers: warps (cyan), hidden (yellow), spawns (green), events (magenta)
  const box = (x, y, col) => { c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(x * 16 + 1.5, y * 16 + 1.5, 13, 13); };
  for (const w of m.warps) box(w.x, w.y, '#40f0ff');
  for (const h of m.hidden) box(h.x, h.y, '#ffe040');
  for (const k in m.spawns) box(m.spawns[k].x, m.spawns[k].y, '#40ff60');
  for (const e of m.events) box(e.x, e.y, '#ff40ff');
  return cv.toDataURL();
};`;
  fs.writeFileSync(path.join(out, '_page.js'), page);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${files.filter((f) => !f.endsWith('main.js')).map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(out, '_page.js')}"></script></body></html>`;
  fs.writeFileSync(path.join(out, '_page.html'), html);
  const browser = await playwright.chromium.launch();
  const pg = await (await browser.newContext()).newPage();
  pg.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e).split('\n')[0]));
  await pg.goto('file://' + path.join(out, '_page.html'));
  await pg.waitForTimeout(300);
  const flags = (opt('flags', '') || '').split(','), items = (opt('items', '') || '').split(',');
  for (const id of mine) {
    if (ONLY && !ONLY.split(',').includes(id)) continue;
    const url = await pg.evaluate(([i, f, it]) => window.TOWNPNG(i, f, it), [id, flags, items]);
    const f = path.join(out, id + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('png →', f);
  }
  await browser.close();
}
