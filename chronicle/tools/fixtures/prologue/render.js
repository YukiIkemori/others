// A18b prologue fixture: whole-map renderer for visual checks (browser only).
//   RPG.proShowMap(mapId, {flags:[..], tier, scale:2, pad:2, crop:{x,y,w,h}, grid:false, marks:true})
// Pauses the engine, resizes #screen to the map and draws tiles + decor + chests + NPCs
// exactly like the field does (R.Art.localTile / decorTile, bottom-aligned sprites).
// Never overrides anything that exists; it only adds RPG.proShowMap.
(function (R) {
  'use strict';
  const TS = 16;
  function sheetFrame(g, dir, f) {
    if (!g) return null;
    if (g.getContext || g.width) return g;
    if (Array.isArray(g)) return g[f % g.length] || g[0];
    const a = g[dir] || g.down || g[Object.keys(g)[0]];
    if (Array.isArray(a)) return a[f % a.length] || a[0];
    return a || null;
  }
  function fakeGame(o) {
    const flags = {};
    for (const f of o.flags || []) flags[f] = true;
    const inv = {};
    for (const it of o.items || []) inv[it] = 1;
    const g = R.Game && !o.fresh ? R.Game : {};
    g.flags = Object.assign(g.flags || {}, flags);
    g.vars = g.vars || {};
    g.inv = Object.assign(g.inv || {}, inv);
    g.party = g.party || [];
    g.reserve = g.reserve || [];
    g.tier = o.tier || 0;
    g.regionsCleared = g.regionsCleared || [];
    while (g.regionsCleared.length < g.tier) g.regionsCleared.push('r' + g.regionsCleared.length);
    g.chests = g.chests || {};
    g.secrets = g.secrets || {};
    g.visited = g.visited || {};
    g.gameClear = !!o.postgame;
    R.Game = g;
    return g;
  }
  R.proShowMap = function (id, o) {
    o = o || {};
    fakeGame(o);
    R.Engine.paused = true;
    const m = R.FieldMap.compile(id);
    if (!m) return 'no map ' + id;
    m.refresh();
    const pad = o.pad != null ? o.pad : 2;
    const cr = o.crop || { x: -pad, y: -pad, w: m.w + pad * 2, h: m.h + pad * 2 };
    const sc = o.scale || 2;
    const cv = document.getElementById('screen');
    cv.width = cr.w * TS * sc; cv.height = cr.h * TS * sc;
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    const off = R.Gfx.makeCanvas(cr.w * TS, cr.h * TS);
    const c = off.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000'; c.fillRect(0, 0, off.width, off.height);
    const G = R.Gfx;
    const tileGfx = (tid) => {
      if (tid === 'void' && !G.has('tile:void')) return null;
      if (m.theme && G.has('tile:' + m.theme + ':' + tid)) return G.get('tile:' + m.theme + ':' + tid);
      return G.has('tile:' + tid) ? G.get('tile:' + tid) : null;
    };
    const frame0 = (g) => (Array.isArray(g) ? g[0] : g);
    for (let y = cr.y; y < cr.y + cr.h; y++) {
      for (let x = cr.x; x < cr.x + cr.w; x++) {
        let g = null;
        if (!m.inBounds(x, y)) g = tileGfx(m.outside);
        else {
          try { g = R.Art && R.Art.localTile ? R.Art.localTile(m, x, y) : null; } catch (e) { console.warn('localTile', e); }
          if (!g) g = tileGfx(m.tileAt(x, y));
        }
        g = frame0(g);
        if (g) c.drawImage(g, (x - cr.x) * TS, (y - cr.y) * TS);
      }
    }
    if (m.decor) {
      for (let y = cr.y; y < cr.y + cr.h + 2; y++) {
        for (let x = cr.x - 1; x < cr.x + cr.w + 1; x++) {
          if (!m.inBounds(x, y) || !m.decorAt(x, y)) continue;
          let g = null;
          try { g = R.Art.decorTile ? R.Art.decorTile(m, x, y) : null; } catch (e) { console.warn('decorTile', e); }
          if (!g) g = G.get('decor:' + m.decorAt(x, y));
          g = frame0(g);
          if (g) c.drawImage(g, (x - cr.x) * TS + ((TS - g.width) >> 1), (y - cr.y) * TS + TS - g.height);
        }
      }
    }
    // chests
    for (const ch of m.chests) {
      if (!ch.present) continue;
      const key = ch.pool === 'p_rare' && G.has('obj:chest_rare') ? 'obj:chest_rare' : 'obj:chest';
      const g = G.get(key);
      const img = Array.isArray(g) ? g[0] : g;
      if (img) c.drawImage(img, (ch.x - cr.x) * TS, (ch.y - cr.y) * TS);
    }
    // sprites, y-sorted
    const list = m.npcs.filter((n) => n.present).sort((a, b) => a.y - b.y);
    for (const n of list) {
      let img = null;
      try {
        const spr = G.get(n.sprite);
        img = n.sprite.startsWith('mon:') ? (Array.isArray(spr) ? spr[0] : spr) : sheetFrame(spr, n.dir, 0);
      } catch (e) { console.warn('sprite', n.sprite, e); }
      if (!img) continue;
      const sx = (n.x - cr.x) * TS, sy = (n.y - cr.y) * TS;
      const mon = n.sprite.startsWith('mon:');
      const k = mon && img.height > 40 ? 0.5 : 1;
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      c.drawImage(img, sx + 8 - (w >> 1), sy + TS - h + (k === 1 ? 0 : 1), w, h);
    }
    // debug marks: spawns (cyan), warps (magenta), step events (yellow), examine events (orange), signs (green)
    if (o.marks !== false) {
      const box = (x, y, col, inset) => {
        c.strokeStyle = col; c.lineWidth = 1;
        c.strokeRect((x - cr.x) * TS + 0.5 + inset, (y - cr.y) * TS + 0.5 + inset, TS - 1 - inset * 2, TS - 1 - inset * 2);
      };
      for (const k in m.spawns) box(m.spawns[k].x, m.spawns[k].y, '#00ffff', 0);
      for (const w of m.warps) box(w.x, w.y, '#ff00ff', 1);
      for (const e of m.events) box(e.x, e.y, e.trigger === 'examine' ? '#ff9900' : '#ffff00', 2);
      for (const s of m.signs) box(s.x, s.y, '#00ff00', 3);
    }
    if (o.grid) {
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.font = '6px monospace';
      for (let x = Math.max(0, cr.x); x < Math.min(m.w, cr.x + cr.w); x += 5) c.fillText(String(x), (x - cr.x) * TS + 1, 7);
      for (let y = Math.max(0, cr.y); y < Math.min(m.h, cr.y + cr.h); y += 5) c.fillText(String(y), 1, (y - cr.y) * TS + 7);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
    return { w: m.w, h: m.h, npcs: m.npcs.filter((n) => n.present).length, chests: m.chests.length };
  };
})(window.RPG);

// Art fallbacks for keys other owners have not drawn yet (DESIGN §10.15 / §11.2.10 「代わり」).
// Only defines a key when nobody registered it; the real art replaces these automatically.
(function (R) {
  'use strict';
  const G = R.Gfx;
  const used = (R.proFallbacks = []); // the stand-ins actually installed (for the report)
  const alias = (key, to) => { if (!G.has(key) && G.has(to)) { used.push(key + ' → ' + to); G.def(key, () => G.get(to)); } };
  const DEC = {
    bar_shelf: 'wall_shelf', kegs: 'crates', stage: 'dais', scroll_rack: 'wall_shelf', map_wall: 'painting',
    herbs_hang: 'wall_shelf', rug_round: 'rug', net_rack: 'crates', rope_coil: 'straw', spinwheel: 'vase',
    loom: 'dresser', lectern: 'desk', book_pile: 'sacks', laundry: 'plant', signpost: 'sign_item', firewood: 'sacks',
    sign_tavern: 'sign_inn', boat: 'crates', cradle: 'dresser', washtub: 'vase', stump: 'sacks', mast: 'lamp',
    mushrooms: 'flowers_low', ivy: 'plant', cobweb: 'crack', paper_drift: 'crack', palm: 'plant',
  };
  const NPC = {
    berna: 'old_woman', rowell: 'scholar', fine: 'nun', fine_fade: 'nun', lazaro: 'sage', scribe: 'priest',
    bartender: 'innkeeper', bard: 'man', farmer: 'man', miner: 'dwarf', noble: 'minister', fisher: 'sailor',
    teller: 'sage', nomad: 'merchant', priestess: 'nun', sheep: 'dog', chicken: 'cat',
  };
  function install() {
    for (const k in DEC) alias('decor:' + k, 'decor:' + DEC[k]);
    for (const k in NPC) alias('npc:' + k, 'npc:' + NPC[k]);
    alias('obj:lantern', 'decor:candelabra');
    alias('tile:story_stone', 'tile:statue'); alias('tile:story_stone_blank', 'tile:statue');
    alias('tile:lockdoor', 'tile:door_silver'); alias('tile:secret_wall', 'tile:wall');
  }
  if (R.onBoot) R.onBoot(install); else install();
})(window.RPG);

// In-game scenes for screenshots: RPG.proScene(name) → starts a playable game in the prologue
// state the scene needs, puts the party at the spot and (optionally) starts the event. It returns
// right away; drive the rest with shot.js --wait / --keys / --shot.
//   tavern · otto · tutorial · fine · boss · lit · departure · roa · berna · house
(function (R) {
  'use strict';
  const ALL = ['hero_created', 'pro_start', 'pro_berna_sent', 'pro_lute', 'pro_met_rowell', 'pro_party_chosen', 'pro_key', 'pro_tutorial', 'pro_boss', 'prologue_done'];
  const upTo = (last) => ALL.slice(0, ALL.indexOf(last) + 1);
  const SC = {
    tavern:    { flags: upTo('pro_met_rowell'), map: 'lute', at: { x: 20, y: 8, dir: 'up' }, talk: 'tavern_start' },
    otto:      { flags: upTo('pro_party_chosen'), comps: ['hagen', 'ilse', 'titta'], map: 'lute', at: { x: 43, y: 17, dir: 'right' }, talk: 'otto' },
    tutorial:  { flags: upTo('pro_key'), comps: ['hagen', 'ilse', 'titta'], items: ['k_lighthouse_key'], map: 'lighthouse_1', at: { x: 18, y: 22, dir: 'up' }, run: 'lighthouse_1_tutorial' },
    fine:      { flags: upTo('pro_tutorial'), comps: ['hagen', 'ilse', 'titta'], items: ['k_lighthouse_key'], map: 'lighthouse_3', at: { x: 13, y: 18, dir: 'up' }, run: 'lighthouse_3_fine' },
    boss:      { flags: upTo('pro_tutorial').concat(['lighthouse_3_fine']), comps: ['hagen', 'ilse', 'titta'], items: ['k_lighthouse_key'], map: 'lighthouse_3', at: { x: 13, y: 12, dir: 'up' }, run: 'lighthouse_3_boss' },
    lit:       { flags: upTo('pro_boss').concat(['lighthouse_3_fine']), comps: ['hagen', 'ilse', 'titta'], items: ['k_lighthouse_key'], map: 'lighthouse_3', at: { x: 13, y: 11, dir: 'up' } },
    departure: { flags: upTo('pro_boss'), comps: ['hagen', 'ilse', 'titta'], items: ['k_lighthouse_key'], map: 'lute', at: 'inn' }, // lute_arrival → lute_departure
    roa:       { flags: upTo('pro_start'), map: 'roa', at: { x: 22, y: 11, dir: 'down' } },
    berna:     { flags: upTo('pro_start'), map: 'roa_house', at: { x: 9, y: 6, dir: 'up' }, talk: 'berna' },
    house:     { flags: upTo('prologue_done'), comps: ['hagen', 'ilse', 'titta'], map: 'roa_house', at: { x: 9, y: 6, dir: 'up' } },
  };
  R.proScene = async function (name) {
    const s = SC[name];
    if (!s) return 'scenes: ' + Object.keys(SC).join(' ');
    await R.debug.quickStart({ companions: s.comps || [], map: 'lute', spawn: 'inn', noEncounter: true });
    const g = R.Game;
    for (const f of ALL) R.State.setFlag(f, s.flags.includes(f));
    for (const f of s.flags) R.State.setFlag(f, true);
    for (const k of ['k_chronicle', 'k_quill', 'k_bell']) if (!s.flags.includes('prologue_done') && R.State.hasItem(k)) R.State.removeItem(k, 1);
    for (const k of s.items || []) if (!R.State.hasItem(k)) R.State.addItem(k, 1);
    const OBJ = { pro_start: 'obj_p_roa', pro_berna_sent: 'obj_p_to_lute', pro_party_chosen: 'obj_p_keeper', pro_key: 'obj_p_lighthouse', prologue_done: 'obj_regions' };
    g.objective = null;
    for (const f of ALL) if (s.flags.includes(f) && OBJ[f]) g.objective = OBJ[f];
    await R.debug.warp(s.map, s.at);
    R.Field.noEncounter = true;
    R.Field.refresh();
    if (s.talk) { const n = R.Field.npc(s.talk); if (n) R.Events.talk(n); }
    if (s.run) R.Events.run(s.run, { trigger: 'step', once: s.run, self: s.map });
    return R.debug.pos();
  };
})(window.RPG);
