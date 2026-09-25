// World map screen (地図, DESIGN §11.7.11): the overworld at 2 px per tile
// (128×112 → 256×224). The world wraps around (§10.5.1), so the map is drawn
// rolled with the party in the middle and a dotted grey line marks the seam
// (x = 0 / y = 0). Terrain colours (§11.2.5), location marks (visited ones bright),
// a blinking white party mark (from inside a town / dungeon: its location or
// exit on the world) and the place name. Any button closes.
//   await R.Minimap.open()
(function (R) {
  'use strict';
  const DB = R.DB;

  // terrain → [colour a, colour b, pattern]; patterns: check | peak | speck | flat | alt
  const TERRAIN = {
    sea: ['#1d3458', '#28466c', 'speck'],
    reef: ['#1d3458', '#6a88a8', 'check'],
    barrier: ['#3a1c56', '#6a3a90', 'check'],
    grass: ['#547a34', '#6c8e44', 'speck'],
    plain: ['#7c8442', '#949a54', 'speck'],
    forest: ['#2c4a26', '#3c5e30', 'check'],
    hills: ['#6c8e44', '#8ca45e', 'peak'],
    mountain: ['#5e4e3a', '#968466', 'peak'],
    desert: ['#b89860', '#c8aa74', 'speck'],
    snow: ['#cad0da', '#e8ecf0', 'speck'],
    snowforest: ['#6a7488', '#8a94a8', 'check'],
    swamp: ['#3a2a44', '#4c3a56', 'check'],
    beach: ['#c8b282', '#dac49a', 'speck'],
    wasteland: ['#645040', '#7c6652', 'speck'],
    magma: ['#a83410', '#d85a1c', 'check'],
    bridge_h: ['#8a6a48', '#a88660', 'flat'],
    bridge_v: ['#8a6a48', '#a88660', 'flat'],
    // Chronicle world tiles (§11.2.3 / §11.2.5)
    road: ['#a08c64', '#8e7452', 'flat'],
    marsh: ['#4c5838', '#3a462c', 'speck'],
    ash: ['#5c5450', '#504846', 'speck'],
    fog: ['#dcdee8', '#c4c6d0', 'speck'],
    sandstorm: ['#c8aa74', '#b89860', 'alt'],
    marsh_fog: ['#7a8470', '#6a7460', 'speck'],
    jungle: ['#2e6030', '#204a26', 'check'],
    deadforest: ['#5a5040', '#4a4234', 'check'],
    river: ['#3c5e86', '#6a88a8', 'flat'],
    cliff: ['#6a5a48', '#54463a', 'peak'],
    ruins: ['#8c8878', '#6c6a5e', 'check'],
  };
  // secret passages look like what they hide in (the map never gives them away)
  TERRAIN.secret_forest = TERRAIN.forest;
  TERRAIN.secret_rock = TERRAIN.mountain;
  // location marks: [inner (visited), inner (not yet)]
  const TOWN = ['#ffe45a', '#8c8c8c'], CAVE = ['#ff6a4a', '#9a4838'], HOLY = ['#6fd8ff', '#6a8a98'];
  const ICON = {
    loc_castle: TOWN, loc_town: TOWN, loc_village: TOWN, loc_port: TOWN,
    loc_shrine: HOLY, loc_temple: HOLY,
    loc_cave: CAVE, loc_tower: CAVE, loc_pyramid: CAVE, loc_volcano: CAVE, loc_mine: CAVE,
    loc_forest: ['#58a040', '#3e6a34'], loc_manor: ['#c0a0d0', '#7a6a86'], loc_library: ['#f0f0f8', '#9a9aa6'],
    loc_demon: ['#d070ff', '#8a4ab0'],
  };
  const rgbCache = {};
  const rgb = (hex) => rgbCache[hex] || (rgbCache[hex] = R.Gfx.hexToRgb(hex));
  const mod = (v, n) => ((v % n) + n) % n;

  let cache = null; // {key, canvas, s, w, h, icons}

  function worldMap() {
    const cur = R.Field && R.Field.map;
    if (cur && cur.isWorld) return R.FieldMap.peek(cur.id);
    const id = R.FieldMap.findWorld(null);
    return id ? R.FieldMap.peek(id) : null;
  }

  /** the ground an icon stands on (the most common neighbouring terrain) */
  function iconBase(m, x, y) {
    const count = {};
    let best = 'grass', bn = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const id = m.tileAt(x + dx, y + dy);
      const t = DB.tiles[id];
      if (!t || t.warpIcon || !TERRAIN[id] || id === 'sea') continue;
      count[id] = (count[id] || 0) + 1;
      if (count[id] > bn) { bn = count[id]; best = id; }
    }
    return best;
  }

  /** the terrain picture (cached by map compile + version: tilePatches such as the fog ring show) */
  function build(m) {
    m.refresh();
    const key = m.uid + ':' + m.version;
    if (cache && cache.key === key) return cache;
    const s = Math.max(1, Math.min(Math.floor(R.W / m.w), Math.floor(R.H / m.h)));
    const w = m.w * s, h = m.h * s;
    const cv = R.Gfx.makeCanvas(w, h), c = cv.getContext('2d');
    const img = c.createImageData(w, h), d = img.data;
    const icons = [];
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        let id = m.tileAt(x, y);
        const t = DB.tiles[id] || {};
        if (t.warpIcon) { icons.push({ x, y, id }); id = iconBase(m, x, y); }
        const pal = TERRAIN[id] || TERRAIN.grass;
        const a = rgb(pal[0]), b = rgb(pal[1]);
        const hash = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
        for (let j = 0; j < s; j++) {
          for (let i = 0; i < s; i++) {
            let col = a;
            switch (pal[2]) {
              case 'check': col = (i + j + x + y) % 2 ? b : a; break;
              case 'peak': col = i === 0 && j === 0 ? b : a; break;
              case 'speck': col = hash % 9 === 0 && i === (hash >> 4) % s && j === (hash >> 6) % s ? b : a; break;
              case 'alt': col = (x + y) % 2 ? b : a; break;
              default: break;
            }
            const k = ((y * s + j) * w + x * s + i) * 4;
            d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
          }
        }
      }
    }
    c.putImageData(img, 0, 0);
    // which icon belongs to which ワープ location (by the world spawn on its cell)
    const locAt = {};
    for (const id in DB.locations) {
      const loc = DB.locations[id];
      if ((loc.map || 'world') !== m.id && !(loc.map == null && m.spawns[loc.spawn])) continue;
      const p = m.spawns[loc.spawn];
      if (p) locAt[p.x + ',' + p.y] = id;
    }
    for (const ic of icons) ic.loc = locAt[ic.x + ',' + ic.y] || null;
    cache = { key, canvas: cv, s, w, h, icons };
    return cache;
  }

  /** where the party is on the world map (also from inside a town / dungeon) */
  function partyWorldPos(m) {
    const cur = R.Field && R.Field.map;
    if (cur && cur.id === m.id) return R.Field.pos();
    if (!cur) return null;
    const ex = cur.exit && cur.exit.to ? cur.exit : null;
    const via = (cur.escape && cur.escape.to === m.id && cur.escape.spawn) || (ex && ex.to === m.id && ex.spawn);
    if (via) { const p = R.FieldMap.spawnPos(via, m.id); if (p) return p; }
    if (cur.location && DB.locations[cur.location]) { const p = R.FieldMap.spawnPos(DB.locations[cur.location].spawn, m.id); if (p) return p; }
    return R.FieldMap.spawnPos(cur.id, m.id);
  }
  /** the name shown under the map */
  function placeName() {
    const cur = R.Field && R.Field.map;
    try { if (R.State.placeName) { const n = R.State.placeName(); if (n) return n; } } catch (e) { /* partial state */ }
    return cur ? cur.name || '' : '';
  }

  class MinimapLayer extends R.Layer {
    constructor(m) {
      super();
      this.opaque = true;
      this.m = m;
      this.c = build(m);
      this.pp = partyWorldPos(m);
      this.name = placeName();
      this.t = 0;
      // wrap: roll the picture so the party sits in the middle; else centre the whole map
      const c = this.c, s = c.s;
      if (m.wrap && this.pp) {
        this.ox = Math.round(R.W / 2 - (this.pp.x * s + s / 2));
        this.oy = Math.round(R.H / 2 - (this.pp.y * s + s / 2));
      } else {
        this.ox = Math.floor((R.W - c.w) / 2);
        this.oy = Math.floor((R.H - c.h) / 2);
      }
    }
    update() {
      this.t++;
      const In = R.Input;
      if (this.t > 6 && ['a', 'b', 'y', 'up', 'down', 'left', 'right', 'l', 'r'].some((b) => In.pressed(b))) {
        R.sfx('cancel');
        this.close();
      }
    }
    /** screen position of a map cell's centre (the copy on screen, when the map wraps) */
    at(x, y) {
      const c = this.c, s = c.s;
      let sx = this.ox + x * s + (s >> 1), sy = this.oy + y * s + (s >> 1);
      if (this.m.wrap) { sx = mod(sx, c.w); sy = mod(sy, c.h); }
      return { x: sx, y: sy };
    }
    draw() {
      const G = R.Gfx, c = this.c, s = c.s;
      G.clear('#000');
      if (this.m.wrap) {
        const x0 = mod(this.ox, c.w) - c.w, y0 = mod(this.oy, c.h) - c.h;
        for (let y = y0; y < R.H; y += c.h) for (let x = x0; x < R.W; x += c.w) G.draw(c.canvas, x, y);
        // the seam (x = 0 column / y = 0 row edges): a dotted grey 1px line (§11.7.11)
        for (let x = mod(this.ox, c.w); x < R.W; x += c.w) for (let y = 0; y < R.H; y += 2) G.rect(x, y, 1, 1, '#9a9aa6');
        for (let y = mod(this.oy, c.h); y < R.H; y += c.h) for (let x = 0; x < R.W; x += 2) G.rect(x, y, 1, 1, '#9a9aa6');
      } else G.draw(c.canvas, this.ox, this.oy);
      const r = Math.max(3, s + 1);
      for (const ic of c.icons) {
        const col = ICON[ic.id] || TOWN;
        const visited = ic.loc ? !!(R.Game.visited && R.Game.visited[ic.loc]) : true;
        const p = this.at(ic.x, ic.y);
        const x = p.x - (r >> 1) - 1, y = p.y - (r >> 1) - 1;
        G.rect(x, y, r + 2, r + 2, visited && ic.loc ? '#ffffff' : '#101018');
        G.rect(x + 1, y + 1, r, r, visited ? col[0] : col[1]);
      }
      const g = R.Game;
      if (g.ship && g.ship.map === this.m.id && !g.onShip) {
        const p = this.at(g.ship.x, g.ship.y);
        G.rect(p.x - 3, p.y - 1, 6, 3, '#101018');
        G.rect(p.x - 2, p.y - 1, 4, 2, '#b07838');
        G.rect(p.x, p.y - 4, 1, 3, '#ffffff');
      }
      if (this.pp && Math.floor(R.Engine.frame / 12) % 3 !== 2) {
        const p = this.at(this.pp.x, this.pp.y);
        G.rect(p.x - 3, p.y - 3, 7, 7, '#101018');
        G.rect(p.x - 2, p.y - 2, 5, 5, '#ffffff');
      }
      if (this.name) {
        const w = Math.ceil(G.textWidth(this.name)) + 20;
        G.window(4, R.H - 26, w, 22, { alpha: 0.85 });
        G.text(this.name, 14, R.H - 21);
      }
    }
  }

  R.Minimap = {
    TERRAIN, ICON,
    /** open the world map; resolves when closed */
    open() {
      const m = worldMap();
      if (!m) { R.warn('minimap: no world map'); return Promise.resolve(); }
      R.sfx('menu_open');
      return R.Engine.run(new MinimapLayer(m));
    },
    /** 1:1 terrain canvas of the world (e.g. for a menu thumbnail) */
    canvas() { const m = worldMap(); return m ? build(m).canvas : null; },
    /** where the party is on the world map {x,y} (tools / menu) */
    partyPos() { const m = worldMap(); return m ? partyWorldPos(m) : null; },
  };
})(window.RPG);
