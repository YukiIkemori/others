// World map screen (ちず): the overworld at 2 px per tile (128x112 → 256x224),
// terrain colours, location icons (visited towns highlighted), a blinking
// party marker and the ship. Any button closes.   await R.Minimap.open()
(function (R) {
  'use strict';
  const DB = R.DB;

  // terrain → [colour a, colour b, pattern]; patterns: check | peak | speck | flat
  const TERRAIN = {
    sea: ['#1c48b0', '#3a6ad0', 'speck'],
    reef: ['#1c48b0', '#8aa0c8', 'check'],
    barrier: ['#5a1c86', '#a040d0', 'check'],
    grass: ['#3e9c34', '#52b040', 'speck'],
    plain: ['#7cb848', '#90c858', 'speck'],
    forest: ['#1a6424', '#2c8434', 'check'],
    hills: ['#6e9032', '#9ab450', 'peak'],
    mountain: ['#6e5638', '#b89c74', 'peak'],
    desert: ['#dcb866', '#ecd088', 'speck'],
    snow: ['#e4ecfa', '#ffffff', 'speck'],
    snowforest: ['#6a94a4', '#8ab0bc', 'check'],
    swamp: ['#4e2c6e', '#6e4890', 'check'],
    beach: ['#e8d898', '#f4e8b0', 'speck'],
    wasteland: ['#7e6040', '#98785a', 'speck'],
    magma: ['#d03c10', '#ff8a2c', 'check'],
    bridge_h: ['#9a6a3a', '#c89060', 'flat'],
    bridge_v: ['#9a6a3a', '#c89060', 'flat'],
  };
  // icon colours by location tile: [inner (visited), inner (unvisited)]
  const ICON = {
    loc_castle: ['#ffe45a', '#b0b0b0'], loc_town: ['#ffe45a', '#b0b0b0'], loc_village: ['#ffe45a', '#b0b0b0'],
    loc_shrine: ['#6fd8ff', '#7c9aa8'], loc_temple: ['#6fd8ff', '#7c9aa8'],
    loc_cave: ['#ff6a4a', '#b05040'], loc_tower: ['#ff6a4a', '#b05040'], loc_pyramid: ['#ff6a4a', '#b05040'],
    loc_volcano: ['#ff6a4a', '#b05040'], loc_demon: ['#d070ff', '#8a4ab0'],
  };
  const rgbCache = {};
  const rgb = (hex) => rgbCache[hex] || (rgbCache[hex] = R.Gfx.hexToRgb(hex));

  let cache = null; // {key, canvas, s, ox, oy, icons}

  function worldMap() {
    const cur = R.Field && R.Field.map;
    if (cur && cur.isWorld) return R.FieldMap.peek(cur.id);
    const id = R.FieldMap.findWorld(null);
    return id ? R.FieldMap.peek(id) : null;
  }

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

  function build(m) {
    m.refresh();
    const broken = R.State.flag('barrier_broken');
    const key = m.uid + ':' + m.version + ':' + broken;
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
            }
            const k = ((y * s + j) * w + x * s + i) * 4;
            d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
          }
        }
      }
    }
    c.putImageData(img, 0, 0);
    // which icon belongs to which teleport location
    const locAt = {};
    for (const id in DB.locations) {
      const loc = DB.locations[id];
      if ((loc.map || 'world') !== m.id && !(loc.map == null && m.spawns[loc.spawn])) continue;
      const p = m.spawns[loc.spawn];
      if (p) locAt[p.x + ',' + p.y] = id;
    }
    for (const ic of icons) ic.loc = locAt[ic.x + ',' + ic.y] || null;
    cache = { key, canvas: cv, s, ox: Math.floor((R.W - w) / 2), oy: Math.floor((R.H - h) / 2), icons };
    return cache;
  }

  /** where the party is on the world map (also from inside a town/dungeon) */
  function partyWorldPos(m) {
    const cur = R.Field && R.Field.map;
    if (cur && cur.id === m.id) return R.Field.pos();
    if (!cur) return null;
    const via = (cur.escape && cur.escape.to === m.id && cur.escape.spawn) || (cur.exit && cur.exit.to === m.id && cur.exit.spawn);
    if (via) return R.FieldMap.spawnPos(via, m.id);
    if (cur.location && DB.locations[cur.location]) return R.FieldMap.spawnPos(DB.locations[cur.location].spawn, m.id);
    return R.FieldMap.spawnPos(cur.id, m.id);
  }

  class MinimapLayer extends R.Layer {
    constructor(m) {
      super();
      this.opaque = true;
      this.m = m;
      this.c = build(m);
      this.pp = partyWorldPos(m);
      this.t = 0;
    }
    update() {
      this.t++;
      const In = R.Input;
      if (this.t > 6 && ['a', 'b', 'up', 'down', 'left', 'right'].some((b) => In.pressed(b))) {
        R.sfx('cancel');
        this.close();
      }
    }
    draw() {
      const G = R.Gfx, c = this.c, s = c.s;
      G.clear('#000');
      G.draw(c.canvas, c.ox, c.oy);
      const cx = (x) => c.ox + x * s + (s >> 1), cy = (y) => c.oy + y * s + (s >> 1);
      const r = Math.max(3, s + 1);
      for (const ic of c.icons) {
        const col = ICON[ic.id] || ICON.loc_town;
        const visited = ic.loc ? !!R.Game.visited[ic.loc] : true;
        const x = cx(ic.x) - (r >> 1) - 1, y = cy(ic.y) - (r >> 1) - 1;
        G.rect(x, y, r + 2, r + 2, visited && ic.loc ? '#ffffff' : '#101018');
        G.rect(x + 1, y + 1, r, r, visited ? col[0] : col[1]);
      }
      const g = R.Game;
      if (g.ship && g.ship.map === this.m.id && !g.onShip) {
        const x = cx(g.ship.x), y = cy(g.ship.y);
        G.rect(x - 3, y - 1, 6, 3, '#101018');
        G.rect(x - 2, y - 1, 4, 2, '#b07838');
        G.rect(x, y - 4, 1, 3, '#ffffff');
      }
      if (this.pp && Math.floor(R.Engine.frame / 12) % 3 !== 2) {
        const x = cx(this.pp.x), y = cy(this.pp.y);
        G.rect(x - 3, y - 3, 7, 7, '#101018');
        G.rect(x - 2, y - 2, 5, 5, '#ffffff');
        G.rect(x - 1, y - 1, 3, 3, g.onShip ? '#b07838' : '#ff3c3c');
      }
    }
  }

  R.Minimap = {
    /** open the world map; resolves when closed */
    open() {
      const m = worldMap();
      if (!m) { R.warn('minimap: no world map'); return Promise.resolve(); }
      R.sfx('menu_open');
      return R.Engine.run(new MinimapLayer(m));
    },
    /** 1:1 terrain canvas of the world (e.g. for a menu thumbnail) */
    canvas() { const m = worldMap(); return m ? build(m).canvas : null; },
  };
})(window.RPG);
