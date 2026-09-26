// Field map loader: compiles R.DB.maps[id] (DESIGN §3.3.10, Crest §7.1) into a runtime map.
//   const m = R.FieldMap.compile('lute');
//   m.tileAt(x,y) m.tile(x,y) m.npcAt(x,y) m.chestAt(x,y) m.warpAt(x,y) ...
// Rows → tile ids through the map's legend; mark chars place objects (with an
// `under` tile); explicit object lists are merged; duplicate npc/chest ids get
// _2, _3… suffixes (give chests explicit ids: DESIGN §3.1.4); tilePatches and
// conds are re-applied by refresh(). Pure logic (no DOM): also used by tools
// and the minimap.
//
// Chronicle additions: warp `cond` at runtime, chest `pool`/`tier` (resolved by
// the field when opened), per-map `decorLegend`, `over:true` decor (drawn above
// the sprites by the field), secret passages (`secret_*` tiles), `lvOff`,
// `chestTier`, `region`, `respawnSpawn`/`noRespawn`/`partySwap`, `escape`
// as {to|map, spawn, dir}. Hidden items (`hidden`) are not part of this game
// (DESIGN §1.0 0.20): they are ignored with a warning.
(function (R) {
  'use strict';
  const DB = R.DB;

  const DEFAULT_ENC_RATE = { world: 26, dungeon: 22 };
  const DEFAULT_BGM = { world: 'overworld', town: 'town', village: 'village', castle: 'castle', dungeon: 'dungeon', shrine: 'shrine' };
  /** map types that count as 「町・城・村」 (automatic respawn point, party swap) */
  const TOWN_TYPES = { town: 1, village: 1, castle: 1 };
  const DIRS = { up: 1, down: 1, left: 1, right: 1 };
  // tilePatch changes up to this many cells are patched in place (the renderer redraws just
  // those cells and their neighbours); bigger changes rebuild the whole tile cache
  const DIRTY_MAX = 400;

  const warned = {};
  function warn(mapId, msg) {
    const k = mapId + '|' + msg;
    if (warned[k]) return;
    warned[k] = 1;
    R.warn('map ' + mapId + ': ' + msg);
  }
  const check = (cond) => cond == null || R.State.check(cond);
  /** a secret-passage tile id (DESIGN §3.3.10-11): `secret_*` or a tile with `secret:true` */
  function isSecretTile(id) {
    if (typeof id !== 'string') return false;
    if (id.startsWith('secret_')) return true;
    const t = DB.tiles[id];
    return !!(t && t.secret);
  }
  const secretKey = (mapId, x, y) => mapId + ':' + x + ',' + y;
  function normEscape(e) {
    if (!e) return null;
    const to = e.to || e.map;
    return to ? Object.assign({}, e, { to }) : null;
  }

  let uidSeq = 0;

  class FieldMap {
    constructor(id, def) {
      this.id = id;
      this.def = def;
      this.uid = ++uidSeq; // distinguishes compiles of the same map (render caches)
      this.version = 0; // bumped whenever the drawn tiles change
      this.name = def.name || '';
      this.type = def.type || 'town';
      this.isWorld = this.type === 'world';
      this.isTown = !!TOWN_TYPES[this.type];
      // world maps wrap around (a torus): walking off an edge comes back in at the opposite one.
      // `wrap:false` on a world map turns it off.
      this.wrap = def.wrap != null ? !!def.wrap : this.isWorld;
      this.legendName = def.legend || (this.isWorld ? 'world' : 'local');
      this.legend = DB.legends[this.legendName] || {};
      this.theme = def.theme || null;
      this.bgm = def.bgm || DEFAULT_BGM[this.type] || 'town';
      this.rows = Array.isArray(def.rows) ? def.rows : [];
      this.h = this.rows.length;
      this.w = this.rows.reduce((mx, r) => Math.max(mx, String(r).length), 0);
      this.encounter = def.encounter || null;
      this.encRate = def.encRate || DEFAULT_ENC_RATE[this.type] || 24;
      this.zones = Array.isArray(def.zones) ? def.zones : [];
      this.defaultZone = def.defaultZone || null;
      this.exit = def.exit || null;
      this.escape = normEscape(def.escape);
      this.location = def.location || null;
      this.region = def.region || null;
      this.lvOff = def.lvOff != null ? def.lvOff : null;
      this.chestTier = def.chestTier != null ? def.chestTier : null;
      this.respawnSpawn = def.respawnSpawn || null;
      this.noRespawn = !!def.noRespawn;
      this.onEnter = def.onEnter || null;
      this.bbg = def.bbg || null;
      this.patches = Array.isArray(def.tilePatches) ? def.tilePatches : [];
      this.spawns = {};
      this.npcs = [];
      this.chests = [];
      this.warps = [];
      this.events = [];
      this.hidden = []; // always empty (hidden items are not used)
      this.signs = [];
      this.overCells = []; // cells whose decor has over:true (drawn above the sprites)
      this.opened = new Map(); // door cell -> tile id drawn there once opened (this visit)
      this.dirty = []; // [{v, cells:[[x,y]…]}] cells to redraw for version v
      this.gfx = {}; // render cache: tileId -> canvas | canvas[]
      this.wcache = []; // render cache: cell -> R.Art.worldTile / localTile result
    }

    /** inside the map rows (raw coordinates, ignores wrapping) */
    inMap(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    /** a valid cell? (always, on a wrapping map: coordinates are taken modulo the size) */
    inBounds(x, y) { return this.wrap ? this.w > 0 && this.h > 0 : x >= 0 && y >= 0 && x < this.w && y < this.h; }
    /** wrapped coordinates (identity on non-wrapping maps) */
    wx(x) { return this.wrap ? ((x % this.w) + this.w) % this.w : x; }
    wy(y) { return this.wrap ? ((y % this.h) + this.h) % this.h : y; }
    idx(x, y) { return this.wrap ? this.wy(y) * this.w + this.wx(x) : y * this.w + x; }
    /** tile id at (x,y); the map's outside tile beyond the edges (wrapping maps have no edges) */
    tileAt(x, y) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : this.outside; }
    /** tile definition (never null) */
    tile(x, y) { return DB.tiles[this.tileAt(x, y)] || EMPTY; }
    /** is (x,y) a secret passage (walkable wall)? */
    isSecret(x, y) { return this.inBounds(x, y) && isSecretTile(this.tileAt(x, y)); }

    /** decor id at (x,y) or null (decor layer) */
    decorAt(x, y) { return this.decor && this.inBounds(x, y) ? this.decor[this.idx(x, y)] : null; }
    /** decor definition at (x,y) or null */
    decorDef(x, y) { const d = this.decorAt(x, y); return d ? DB.decor[d] || null : null; }
    /** decor drawn above the sprites (roof eaves, tree canopies, arches) */
    decorOver(x, y) { const d = this.decorDef(x, y); return !!(d && d.over); }
    /** can the player talk across (x,y)? (counter tiles and counter-like furniture) */
    counterAt(x, y) { const d = this.decorDef(x, y); return !!(this.tile(x, y).counter || (d && d.counter)); }

    /** walkable on foot (ignores objects) */
    walkable(x, y) {
      if (!this.inBounds(x, y)) return false;
      const dd = this.decorDef(x, y);
      if (dd && !dd.pass && !dd.over) return false;
      const t = this.tile(x, y);
      if (t.pass) return true;
      return !!(t.flagPass && !t.shipWhenFlag && R.State.flag(t.flagPass));
    }
    /** sailable by ship */
    sailable(x, y) {
      if (!this.inBounds(x, y)) return false;
      const t = this.tile(x, y);
      if (t.ship) return true;
      return !!(t.flagPass && t.shipWhenFlag && R.State.flag(t.flagPass));
    }

    // ------------------------------------------------------------ objects
    npcAt(x, y, except) {
      if (this.wrap) { x = this.wx(x); y = this.wy(y); }
      for (const n of this.npcs) {
        if (!n.present || n === except) continue;
        if ((n.x === x && n.y === y) || (n.mv && n.mv.fx === x && n.mv.fy === y)) return n;
      }
      return null;
    }
    npc(id) { return this.npcs.find((n) => n.id === id) || null; }
    chestAt(x, y) { if (!this.inBounds(x, y)) return null; const c = this.chestIdx.get(this.idx(x, y)); return c && c.present ? c : null; }
    /** the first warp on (x,y) whose cond holds (warps may carry a runtime cond: DESIGN §3.3.10-6) */
    warpAt(x, y) {
      if (!this.inBounds(x, y)) return null;
      const list = this.warpIdx.get(this.idx(x, y));
      if (!list) return null;
      for (const w of list) if (check(w.cond)) return w;
      return null;
    }
    /** is there any warp on (x,y), whatever its cond (NPCs keep off such cells) */
    warpCell(x, y) { return this.inBounds(x, y) && this.warpIdx.has(this.idx(x, y)); }
    signAt(x, y) { const s = this.inBounds(x, y) && this.signIdx.get(this.idx(x, y)); return s && check(s.cond) ? s : null; }
    hiddenAt() { return null; }
    /** events at (x,y) with the given trigger whose cond holds and whose once-flag is unset */
    eventsAt(x, y, trigger) {
      if (!this.inBounds(x, y)) return [];
      const list = this.eventIdx.get(this.idx(x, y));
      if (!list) return [];
      return list.filter((e) => e.trigger === trigger && check(e.cond) && !(e.once && R.State.flag(e.once)));
    }
    /** resolve a spawn name or {x,y,dir} → {x,y,dir} (never null) */
    spawn(s) {
      if (s && typeof s === 'object' && s.x != null) return { x: Math.round(+s.x) || 0, y: Math.round(+s.y) || 0, dir: DIRS[s.dir] ? s.dir : null };
      if (typeof s === 'string' && this.spawns[s]) return Object.assign({}, this.spawns[s]);
      if (s != null) warn(this.id, 'unknown spawn "' + (typeof s === 'string' ? s : JSON.stringify(s)) + '"');
      const fb = this.spawns.entrance || this.spawns[Object.keys(this.spawns)[0]];
      if (fb) return Object.assign({}, fb);
      // no spawns at all: first walkable cell near the centre
      for (let r = 0; r < Math.max(this.w, this.h); r++) {
        for (let y = (this.h >> 1) - r; y <= (this.h >> 1) + r; y++) {
          for (let x = (this.w >> 1) - r; x <= (this.w >> 1) + r; x++) if (this.walkable(x, y)) return { x, y, dir: 'down' };
        }
      }
      return { x: 0, y: 0, dir: 'down' };
    }
    hasSpawn(name) { return typeof name === 'string' && !!this.spawns[name]; }
    /** encounter zone id at (x,y) (zones first match → defaultZone → encounter) */
    zoneAt(x, y) {
      if (this.wrap) { x = this.wx(x); y = this.wy(y); }
      for (const z of this.zones) if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) return z.zone;
      return this.defaultZone || this.encounter || null;
    }
    /** edge exit for leaving the map in direction dir, or null */
    exitFor(dir) {
      const e = this.exit;
      if (!e) return null;
      if (e.to) return check(e.cond) ? e : null;
      return e[dir] && e[dir].to && check(e[dir].cond) ? e[dir] : null;
    }

    /** mark cells for a redraw (doors opened, secrets found): bumps the version, one dirty entry */
    touch(cells) {
      this.version++;
      const out = [];
      for (const [x, y] of cells) {
        if (!this.inBounds(x, y)) continue;
        this.wcache[this.idx(x, y)] = undefined;
        if (this.dcache) this.dcache[this.idx(x, y)] = undefined;
        out.push([x, y]);
      }
      this.dirty.push({ v: this.version, cells: out });
      if (this.dirty.length > 64) this.dirty.splice(0, this.dirty.length - 64);
    }

    /** re-apply tilePatches and object conds (after flags / vars / items change) */
    refresh() {
      const next = this.base.slice();
      for (const p of this.patches) {
        if (!check(p.cond)) continue;
        const id = p.tile || this.legend[p.ch];
        if (!DB.tiles[id]) { warn(this.id, 'tilePatch with unknown tile ' + (p.tile || p.ch)); continue; }
        const pw = p.w || 1, ph = p.h || 1;
        for (let y = p.y; y < p.y + ph; y++) for (let x = p.x; x < p.x + pw; x++) if (this.inMap(x, y)) next[y * this.w + x] = id;
      }
      if (!this.tiles) { this.tiles = next; this.version++; }
      else {
        const changed = [];
        for (let i = 0; i < next.length; i++) if (next[i] !== this.tiles[i]) changed.push(i);
        this.tiles = next;
        if (changed.length > DIRTY_MAX) { this.version++; this.wcache = []; this.dcache = []; }
        else if (changed.length) {
          // context art (autotiling) looks at the 8 neighbours: redraw those too
          const cells = new Map();
          for (const i of changed) {
            const cx = i % this.w, cy = (i / this.w) | 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const x = cx + dx, y = cy + dy;
                if (!this.inBounds(x, y)) continue;
                const k = this.idx(x, y);
                if (!cells.has(k)) cells.set(k, [this.wx(x), this.wy(y)]);
              }
            }
          }
          this.touch([...cells.values()]);
        }
      }
      for (const n of this.npcs) n.present = !n.hidden && (n.forced || check(n.cond));
      for (const c of this.chests) c.present = check(c.cond);
      this.weather = resolveWeather(this.def.weather);
    }
  }
  const WEATHER_KINDS = { snow: 1, blizzard: 1 };
  /** the map's weather (def.weather): a kind string, or [{cond, kind}] where the first entry whose
   *  cond passes wins (an entry without cond always passes). null: clear sky / unknown kind */
  function resolveWeather(w) {
    if (!w) return null;
    if (typeof w === 'string') return WEATHER_KINDS[w] ? w : null;
    if (!Array.isArray(w)) return null;
    for (const e of w) {
      if (!e) continue;
      if (typeof e === 'string') return WEATHER_KINDS[e] ? e : null;
      if (check(e.cond)) return WEATHER_KINDS[e.kind] ? e.kind : null;
    }
    return null;
  }
  const EMPTY = { pass: false };

  // ---------------------------------------------------------- compile
  function compile(id) {
    const def = DB.maps[id];
    if (!def) { warn(id, 'map not found'); return null; }
    const m = new FieldMap(id, def);
    const legend = m.legend;
    if (!DB.legends[m.legendName]) warn(id, 'unknown legend ' + m.legendName);
    const marks = def.marks || {};
    for (const ch in marks) if (ch in legend) warn(id, 'mark char "' + ch + '" is also a legend char (mark wins)');

    // outside tile: legend char, or tile id (required on every local map: DESIGN §3.3.10 / validate V5)
    const outDefault = m.isWorld ? 'sea' : 'void';
    if (def.outside != null) {
      m.outside = legend[def.outside] || (DB.tiles[def.outside] ? def.outside : null);
      if (!m.outside) { warn(id, 'unknown outside tile "' + def.outside + '"'); m.outside = outDefault; }
    } else {
      m.outside = outDefault;
      if (!m.isWorld) warn(id, 'local map without `outside` (DESIGN §3.3.10)');
    }

    const npcIds = {}, chestIds = {};
    const uniq = (used, base) => {
      if (!(base in used)) { used[base] = 1; return base; }
      let n = used[base], out;
      do { n++; out = base + '_' + n; } while (out in used);
      used[base] = n; used[out] = 1;
      return out;
    };
    const dfl = legend['.'] || (m.isWorld ? 'grass' : 'floor');
    const base = new Array(m.w * m.h);
    const bad = {};
    let ragged = false;
    let hiddenSeen = 0;

    const add = {
      npc(o, x, y) {
        const n = Object.assign({}, o);
        n.x = x != null ? x : o.x | 0; n.y = y != null ? y : o.y | 0;
        n.id = uniq(npcIds, o.id || 'npc');
        n.sprite = o.sprite ? (String(o.sprite).includes(':') ? o.sprite : 'npc:' + o.sprite) : 'npc:man';
        n.dir = DIRS[o.dir] ? o.dir : 'down';
        n.dir0 = n.dir;
        n.move = o.move || 'still';
        n.homeX = n.x; n.homeY = n.y;
        n.hidden = false; n.forced = false; n.mv = null; n.path = null;
        n.seq = m.npcs.length;
        m.npcs.push(n);
      },
      chest(o, x, y) {
        const c = Object.assign({}, o);
        c.x = x != null ? x : o.x | 0; c.y = y != null ? y : o.y | 0;
        if (!o.id) warn(id, 'chest without id at ' + c.x + ',' + c.y + ' (give every chest an explicit id)');
        c.id = uniq(chestIds, o.id || id + '_chest_' + c.x + '_' + c.y);
        if (o.item) c.n = o.n || 1;
        if (o.item && !DB.items[o.item]) warn(id, 'chest ' + c.id + ' has unknown item ' + o.item);
        if (o.pool && DB.pools && Object.keys(DB.pools).length && !DB.pools[o.pool]) warn(id, 'chest ' + c.id + ' has unknown pool ' + o.pool);
        m.chests.push(c);
      },
      hidden() { hiddenSeen++; },
      warp(o, x, y) {
        const w = Object.assign({}, o);
        w.x = x != null ? x : o.x | 0; w.y = y != null ? y : o.y | 0;
        if (!w.to) warn(id, 'warp without target at ' + w.x + ',' + w.y);
        else if (!DB.maps[w.to]) warn(id, 'warp to unknown map ' + w.to);
        m.warps.push(w);
      },
      event(o, x, y) {
        const e = typeof o === 'string' ? { id: o } : Object.assign({}, o);
        e.x = x != null ? x : o.x | 0; e.y = y != null ? y : o.y | 0;
        e.trigger = e.trigger || 'step';
        if (!e.id) warn(id, 'event without id at ' + e.x + ',' + e.y);
        m.events.push(e);
      },
      sign(o, x, y) {
        const s = typeof o === 'string' || Array.isArray(o) ? { text: o } : Object.assign({}, o);
        s.x = x != null ? x : o.x | 0; s.y = y != null ? y : o.y | 0;
        m.signs.push(s);
      },
      spawn(name, x, y, dir) {
        if (m.spawns[name]) warn(id, 'duplicate spawn ' + name);
        m.spawns[name] = { x, y, dir: DIRS[dir] ? dir : 'down' };
      },
    };

    // rows
    for (let y = 0; y < m.h; y++) {
      const row = String(m.rows[y]);
      if (row.length !== m.w) ragged = true;
      for (let x = 0; x < m.w; x++) {
        const ch = row[x];
        let t;
        if (ch === undefined) t = m.outside;
        else if (marks[ch]) {
          const mk = marks[ch];
          const under = mk.under != null ? mk.under : '.';
          t = legend[under] || (DB.tiles[under] ? under : null);
          if (!t) { bad['under:' + under] = 1; t = dfl; }
          if (mk.spawn) {
            const sp = typeof mk.spawn === 'string' ? { name: mk.spawn } : mk.spawn;
            add.spawn(sp.name, x, y, sp.dir || mk.dir);
          }
          if (mk.npc) add.npc(mk.npc, x, y);
          if (mk.chest) add.chest(mk.chest, x, y);
          if (mk.warp) add.warp(mk.warp, x, y);
          if (mk.event) add.event(mk.event, x, y);
          if (mk.hidden) add.hidden(mk.hidden, x, y);
          if (mk.sign) add.sign(mk.sign, x, y);
        } else if (legend[ch]) t = legend[ch];
        else { bad[ch] = 1; t = dfl; }
        if (!DB.tiles[t]) { bad['tile:' + t] = 1; }
        base[y * m.w + x] = t;
      }
    }
    if (ragged) warn(id, 'rows have unequal lengths (padded with the outside tile)');

    // decor layer (optional): same size as rows; ' ' and '.' mean nothing.
    // `decorLegend` adds / overrides characters for this map only (DESIGN §11.2.10).
    if (Array.isArray(def.decor) && def.decor.length) {
      const dl = Object.assign({}, DB.legends.decor || {}, def.decorLegend || {});
      const dec = new Array(m.w * m.h).fill(null);
      const dbad = {};
      if (def.decor.length !== m.h) warn(id, 'decor has ' + def.decor.length + ' rows, map has ' + m.h);
      for (let y = 0; y < Math.min(m.h, def.decor.length); y++) {
        const row = String(def.decor[y]);
        if (row.length !== m.w) warn(id, 'decor row ' + y + ' length ' + row.length + ' != ' + m.w);
        for (let x = 0; x < Math.min(m.w, row.length); x++) {
          const ch = row[x];
          if (ch === ' ' || ch === '.') continue;
          const did = dl[ch];
          if (!did || !DB.decor[did]) { dbad[ch] = 1; continue; }
          dec[y * m.w + x] = did;
          if (DB.decor[did].over) m.overCells.push({ x, y });
        }
      }
      const dk = Object.keys(dbad);
      if (dk.length) warn(id, 'unknown decor chars: ' + dk.map((k) => JSON.stringify(k)).join(' '));
      m.decor = dec;
    } else m.decor = null;
    const badKeys = Object.keys(bad);
    if (badKeys.length) warn(id, 'unknown row chars/tiles: ' + badKeys.map((k) => JSON.stringify(k)).join(' '));
    if (!m.h || !m.w) warn(id, 'map has no rows');

    // explicit object lists
    const sp = def.spawns || {};
    for (const name in sp) add.spawn(name, sp[name].x | 0, sp[name].y | 0, sp[name].dir);
    for (const o of def.npcs || []) add.npc(o);
    for (const o of def.chests || []) add.chest(o);
    for (const o of def.warps || []) add.warp(o);
    for (const o of def.events || []) add.event(o);
    for (const o of def.signs || []) add.sign(o);
    if (Array.isArray(def.hidden)) hiddenSeen += def.hidden.length;
    if (hiddenSeen) warn(id, hiddenSeen + ' hidden item(s) ignored: this game has no hidden items (DESIGN §1.0 0.20)');

    // bounds check
    const oob = (kind, o) => { if (!m.inMap(o.x, o.y)) warn(id, kind + ' out of bounds at ' + o.x + ',' + o.y); };
    for (const k of ['npcs', 'chests', 'warps', 'events', 'signs']) for (const o of m[k]) oob(k, o);
    for (const k in m.spawns) oob('spawn ' + k, m.spawns[k]);
    for (const n of m.npcs) {
      if (n.text == null && !n.event && n.sprite.startsWith('npc:')) warn(id, 'npc ' + n.id + ' has neither text nor event');
      if (n.event && !DB.events[n.event]) warn(id, 'npc ' + n.id + ' uses unknown event ' + n.event);
    }
    for (const e of m.events) if (e.id && !DB.events[e.id]) warn(id, 'unknown event ' + e.id);
    if (m.onEnter && !DB.events[m.onEnter]) warn(id, 'unknown onEnter event ' + m.onEnter);

    m.base = base;
    const index = (list) => { const mp = new Map(); for (const o of list) if (m.inMap(o.x, o.y)) mp.set(m.idx(o.x, o.y), o); return mp; };
    m.chestIdx = index(m.chests);
    m.signIdx = index(m.signs);
    m.hiddenIdx = new Map();
    const listIndex = (list) => {
      const mp = new Map();
      for (const o of list) {
        if (!m.inMap(o.x, o.y)) continue;
        const k = m.idx(o.x, o.y);
        if (!mp.has(k)) mp.set(k, []);
        mp.get(k).push(o);
      }
      return mp;
    };
    m.warpIdx = listIndex(m.warps);
    m.eventIdx = listIndex(m.events);
    if (R.Game) m.refresh();
    else { m.tiles = base.slice(); m.version = 1; for (const n of m.npcs) n.present = true; for (const c of m.chests) c.present = true; }
    return m;
  }

  // Cached static compiles (spawn lookups on other maps, minimap). Not the live map.
  const statics = {};
  function peek(id) {
    const def = DB.maps[id];
    if (!def) return null;
    const s = statics[id];
    if (s && s.def === def) return s;
    return (statics[id] = compile(id));
  }
  /** id of the world-type map that has spawn `name` ('world' preferred) */
  function findWorld(name) {
    const has = (id) => { const m = peek(id); return !!(m && (!name || m.spawns[name])); };
    if (DB.maps.world && has('world')) return 'world';
    for (const id in DB.maps) if (DB.maps[id].type === 'world' && has(id)) return id;
    if (DB.maps.world) return 'world';
    for (const id in DB.maps) if (DB.maps[id].type === 'world') return id;
    return null;
  }
  /** coordinates {x,y,dir} of a spawn name on map id (default: the world map holding it) */
  function spawnPos(name, id) {
    const m = peek(id || findWorld(typeof name === 'string' ? name : null));
    if (!m) return null;
    if (typeof name === 'object' && name && name.x != null) return { x: name.x, y: name.y, dir: name.dir || 'down' };
    return m.spawns[name] ? Object.assign({}, m.spawns[name]) : null;
  }

  /** may the party push this NPC aside (DESIGN §2.3, §10.13.10)? Works on compiled NPCs and raw data.
   *  Stays put: `fixed:true`, monsters / objects (non-`npc:` sprites), conditional NPCs (story
   *  blockers) and standing NPCs with an event (shops, inns, the tavern: they keep their post).
   *  `push:true` forces pushable. Wanderers are always pushable. */
  function pushable(n) {
    if (!n || n.fixed) return false;
    if (n.push) return true;
    const s = n.sprite == null ? '' : String(n.sprite);
    if (s.includes(':') && !s.startsWith('npc:')) return false;
    if (n.cond != null) return false;
    return (n.move || 'still') === 'wander' || !n.event;
  }

  // ---------------------------------------------------------- secret passages
  /** secret-passage cells [[x,y]…] of a map (its rows, before tilePatches) */
  function secretCells(id) {
    const m = peek(id);
    if (!m) return [];
    const out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (isSecretTile(m.base[y * m.w + x])) out.push([x, y]);
    return out;
  }
  let secretCache = null;
  /** {total, byMap:{id:n}} over every map (the chronicle screen shows 「隠し通路　n/総数」) */
  function secretStats() {
    const ids = Object.keys(DB.maps);
    const key = ids.length + ':' + ids.map((k) => (DB.maps[k].rows || []).length).join(',');
    if (secretCache && secretCache.key === key) return secretCache;
    const byMap = {};
    let total = 0;
    for (const id of ids) {
      const n = secretCells(id).length;
      if (n) { byMap[id] = n; total += n; }
    }
    return (secretCache = { key, total, byMap });
  }

  R.FieldMap = {
    FieldMap, compile, peek, resolveWeather, spawnPos, findWorld, warn, pushable, DEFAULT_BGM, TOWN_TYPES,
    isSecretTile, secretKey, secretCells, secretStats,
    /** total number of secret-passage cells in the game */
    secretTotal() { return secretStats().total; },
  };
})(window.RPG);
