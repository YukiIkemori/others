// Map access shared by the QA tools (validate.js, progress.js, check_density.js, playthrough.js and the
// per-owner check_*.js). Built on the game's own parser R.FieldMap.compile (DESIGN §1.8: the tools must not
// re-interpret maps), so new map features (outside, wrap, decor layers, marks, explicit objects) are read
// exactly the way the field reads them. Compile warnings (R.warn) are captured as `issues`.
//
//   const M = require('./lib/maps');
//   const P = M.parseMap(R, id)        → view of one map (below); null if the map does not exist
//   const all = M.compileAll(R)       → {id: P}
//   M.isSecret(R, tileId)             → true for the secret-passage tiles (secret_wall / secret_forest / secret_rock)
//   M.rooms(R, P, opts)               → floor regions bounded by walls (check_density.js)
//   M.kindOf(P)                       → 'world' | 'town' | 'house' | 'dungeon' | 'other'
//
// P = { id, def, w, h, wrap, type, legend, outside, issues[], spawns{}, npcs[], chests[], warps[], events[],
//       signs[], hidden[], zones[], decor(bool), tileAt(x,y), baseAt(x,y), decorAt(x,y), tileDef(x,y), decorDef(x,y),
//       patchedAt(x,y, checkFn), inMap(x,y), wx(x), wy(y), fm (the compiled R.FieldMap object) }
// tileAt/baseAt are the unpatched tiles; patchedAt applies tilePatches whose cond passes checkFn(cond).
'use strict';

const SECRET = new Set(['secret_wall', 'secret_forest', 'secret_rock']);

function isSecret(R, tid) {
  if (!tid) return false;
  if (SECRET.has(tid)) return true;
  const t = R.DB.tiles && R.DB.tiles[tid];
  return !!(t && (t.secret || /^secret_/.test(tid)));
}

function withoutGame(R, fn) {
  // compile() applies conds when R.Game exists; the tools want the static map
  const g = R.Game;
  try { R.Game = null; return fn(); } finally { R.Game = g; }
}

function captureWarn(R, fn) {
  const issues = [];
  const w = R.warn;
  R.warn = (...a) => { issues.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
  try { return { value: fn(), issues }; } finally { R.warn = w; }
}

function parseMap(R, id) {
  const DB = R.DB;
  const def = DB.maps && DB.maps[id];
  if (!def) return null;
  let fm = null, issues = [];
  if (R.FieldMap && R.FieldMap.compile) {
    const r = captureWarn(R, () => withoutGame(R, () => {
      try { return R.FieldMap.compile(id); } catch (e) { issues.push('compile threw: ' + (e && e.message)); return null; }
    }));
    fm = r.value; issues = issues.concat(r.issues.map((s) => s.replace(/^map [^:]+: /, '')));
  }
  if (!fm) fm = fallbackCompile(R, id, issues);
  const P = {
    id, def, fm, issues,
    w: fm.w, h: fm.h, wrap: !!fm.wrap, type: def.type || 'town',
    legend: fm.legend || {}, outside: fm.outside,
    spawns: fm.spawns || {}, npcs: fm.npcs || [], chests: fm.chests || [], warps: fm.warps || [],
    events: fm.events || [], signs: fm.signs || [], hidden: fm.hidden || [],
    zones: Array.isArray(def.zones) ? def.zones : [],
    decor: !!fm.decor,
  };
  const base = fm.base || fm.tiles || [];
  P.wx = (x) => (P.wrap ? ((x % P.w) + P.w) % P.w : x);
  P.wy = (y) => (P.wrap ? ((y % P.h) + P.h) % P.h : y);
  P.inMap = (x, y) => x >= 0 && y >= 0 && x < P.w && y < P.h;
  P.inBounds = (x, y) => (P.wrap ? P.w > 0 && P.h > 0 : P.inMap(x, y));
  P.baseAt = (x, y) => (P.inBounds(x, y) ? base[P.wy(y) * P.w + P.wx(x)] : P.outside);
  P.tileAt = P.baseAt;
  P.decorAt = (x, y) => (fm.decor && P.inBounds(x, y) ? fm.decor[P.wy(y) * P.w + P.wx(x)] : null);
  P.tileDef = (x, y) => (DB.tiles && DB.tiles[P.tileAt(x, y)]) || null;
  P.decorDef = (x, y) => { const d = P.decorAt(x, y); return d ? (DB.decor && DB.decor[d]) || null : null; };
  const patches = Array.isArray(def.tilePatches) ? def.tilePatches : [];
  P.patches = patches;
  // index patches by cell for fast lookup
  const pidx = new Map();
  for (const p of patches) {
    const pw = p.w || 1, ph = p.h || 1;
    for (let y = p.y; y < p.y + ph; y++) for (let x = p.x; x < p.x + pw; x++) {
      if (!P.inBounds(x, y)) continue;
      const k = P.wy(y) * P.w + P.wx(x);
      if (!pidx.has(k)) pidx.set(k, []);
      pidx.get(k).push(p);
    }
  }
  P.patchedAt = (x, y, checkFn) => {
    if (!P.inBounds(x, y)) return P.outside;
    const k = P.wy(y) * P.w + P.wx(x);
    let t = base[k];
    const list = pidx.get(k);
    if (list) for (const p of list) if (!checkFn || checkFn(p.cond)) t = p.tile || P.legend[p.ch] || t;
    return t;
  };
  P.hasPatch = (x, y) => P.inBounds(x, y) && pidx.has(P.wy(y) * P.w + P.wx(x));
  return P;
}

/** minimal static compile used only when R.FieldMap is unavailable (e.g. field_map.js excluded by a syntax error) */
function fallbackCompile(R, id, issues) {
  const DB = R.DB, def = DB.maps[id];
  const isWorld = def.type === 'world';
  const legend = DB.legends[def.legend || (isWorld ? 'world' : 'local')] || {};
  const rows = Array.isArray(def.rows) ? def.rows : [];
  const h = rows.length, w = rows.reduce((a, r) => Math.max(a, String(r).length), 0);
  const outside = def.outside != null ? legend[def.outside] || def.outside : (isWorld ? 'sea' : 'void');
  const m = { w, h, wrap: def.wrap != null ? !!def.wrap : isWorld, legend, outside, spawns: {}, npcs: [], chests: [], warps: [], events: [], signs: [], hidden: [], decor: null };
  const base = new Array(w * h);
  const marks = def.marks || {};
  for (let y = 0; y < h; y++) {
    const row = String(rows[y]);
    if (row.length !== w) issues.push('rows have unequal lengths (padded with the outside tile)');
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      let t;
      if (ch === undefined) t = outside;
      else if (marks[ch]) {
        const mk = marks[ch];
        t = legend[mk.under != null ? mk.under : '.'] || mk.under;
        if (mk.spawn) { const sp = typeof mk.spawn === 'string' ? { name: mk.spawn } : mk.spawn; m.spawns[sp.name] = { x, y, dir: sp.dir || mk.dir || 'down' }; }
        for (const k of ['npc', 'chest', 'warp', 'event', 'sign', 'hidden']) if (mk[k]) m[k === 'hidden' ? 'hidden' : k + 's'].push(Object.assign({}, typeof mk[k] === 'string' ? { id: mk[k] } : mk[k], { x, y }));
      } else t = legend[ch];
      if (!t) issues.push(`unknown row char ${JSON.stringify(ch)}`);
      base[y * w + x] = t;
    }
  }
  for (const n in def.spawns || {}) m.spawns[n] = def.spawns[n];
  for (const k of ['npcs', 'chests', 'warps', 'events', 'signs', 'hidden']) for (const o of def[k] || []) m[k].push(Object.assign({}, o));
  for (const e of m.events) e.trigger = e.trigger || 'step';
  if (Array.isArray(def.decor) && def.decor.length) {
    const dl = DB.legends.decor || {};
    m.decor = new Array(w * h).fill(null);
    for (let y = 0; y < Math.min(h, def.decor.length); y++) {
      const row = String(def.decor[y]);
      for (let x = 0; x < Math.min(w, row.length); x++) { const ch = row[x]; if (ch !== ' ' && ch !== '.' && dl[ch]) m.decor[y * w + x] = dl[ch]; }
    }
  }
  m.base = base;
  issues.push('R.FieldMap.compile unavailable: static fallback parser used');
  return m;
}

function compileAll(R) {
  const out = {};
  for (const id in (R.DB.maps || {})) out[id] = parseMap(R, id);
  return out;
}

/** map kind for the size / outside / density rules (§10.6.1・§10.6.2) */
function kindOf(P) {
  const d = P.def || {};
  if (d.type === 'world') return 'world';
  if (d.type === 'dungeon') return 'dungeon';
  if (/_house\d*$/.test(P.id) || d.house || d.interior) return 'house';
  if (d.type === 'town' || d.type === 'castle' || d.type === 'village') return 'town';
  return 'other';
}

/** Is the tile at (x,y) a wall for room segmentation? (impassable tile that is not furniture/counter) */
function isWallCell(R, P, x, y) {
  const t = R.DB.tiles[P.tileAt(x, y)];
  if (!t) return true;
  if (t.pass) return false;
  if (t.counter || t.furniture || t.decorLike) return false;
  if (/door|stairs|warp/.test(P.tileAt(x, y))) return true;
  return true;
}

/**
 * Rooms: 4-connected regions of non-wall cells (floor, counters, furniture tiles), split by doors.
 * Returns [{cells:[[x,y]…], size, bbox}]. opts.minSize filters tiny closets.
 */
function rooms(R, P, opts) {
  opts = opts || {};
  const seen = new Uint8Array(P.w * P.h);
  const out = [];
  const isDoor = (x, y) => { const id = P.tileAt(x, y) || ''; return /door|gate|arch/.test(id) || P.warps.some((w) => w.x === x && w.y === y); };
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const k = y * P.w + x;
    if (seen[k] || isWallCell(R, P, x, y) && !R.DB.tiles[P.tileAt(x, y)]?.counter || isDoor(x, y)) { seen[k] = 1; continue; }
    const cells = [];
    const q = [[x, y]];
    seen[k] = 1;
    let x0 = x, x1 = x, y0 = y, y1 = y;
    while (q.length) {
      const [cx, cy] = q.pop();
      cells.push([cx, cy]);
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!P.inMap(nx, ny)) continue;
        const nk = ny * P.w + nx;
        if (seen[nk]) continue;
        const t = R.DB.tiles[P.tileAt(nx, ny)];
        if (isDoor(nx, ny) || (!t || (!t.pass && !t.counter && !t.furniture))) { continue; }
        seen[nk] = 1;
        q.push([nx, ny]);
      }
    }
    if (cells.length >= (opts.minSize || 1)) out.push({ cells, size: cells.length, bbox: { x0, y0, x1, y1 } });
  }
  return out;
}

module.exports = { parseMap, compileAll, isSecret, kindOf, rooms, SECRET };
