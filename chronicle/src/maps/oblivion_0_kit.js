// 忘却の底 (oblivion_1..5): shared helpers and constants for the post-game dungeon.
// Owner: OB (oblivion). DESIGN §10.12, §10.6.2, §10.6.4, §8.12.4. Loaded before oblivion_1..5.js
// ('0' sorts before the digits 1–5), and before src/events/oblivion.js (maps load before events).
//
// Every object on the floors (NPCs, signs, chests, spawns, events, warps) is listed explicitly
// with x,y, so no mark chars are used and chest ids never depend on row order (§3.1.4).
//
//   const K = R.Oblivion;
//   K.base(name, o)                    common floor keys (type/theme/bgm/bbg/location/region/escape/chestTier)
//   K.npc(id, sprite, x, y, o)         NPC ('npc:' prefix added unless the key has ':')
//   K.rest(x, y)                       休息の灯 (NPC rest, obj:lantern, common_rest, fixed)
//   K.sign(x, y, text, cond)           sign (examine)
//   K.chest(id, x, y, pool)            tier chest {id, x, y, pool} (chestTier 9 comes from the map)
//   K.step(id, x, y, o) / K.exam(id, x, y, o) / K.band(id, x0, y0, x1, y1, o)   map events
//   K.warp(x, y, to, spawn, o)
//   K.checkRows(id, def)               row / decor widths
//
// Data this file adds (all ids owned by OB):
//   DB.encounters.z_postgame_oblivion_den      the 4F rare-monster den (§10.6.4 「レア魔物の小部屋」):
//   DB.rareEncounters.z_postgame_oblivion_den  a copy of z_postgame_oblivion_hi whose rare monster
//                                              (夢食いバク) comes 3× as often (rate ÷ 3)
(function (R) {
  'use strict';
  const K = (R.Oblivion = R.Oblivion || {});

  K.MAPS = ['oblivion_1', 'oblivion_2', 'oblivion_3', 'oblivion_4', 'oblivion_5'];
  K.ZONE_LO = 'z_postgame_oblivion_lo'; // 1–2F (§10.6.2)
  K.ZONE_HI = 'z_postgame_oblivion_hi'; // 3–5F
  K.ZONE_DEN = 'z_postgame_oblivion_den'; // the 4F den behind the secret passage (rare ×3)
  K.DEN_MUL = 3;
  K.ESC = { to: 'world', spawn: 'archive_1' }; // §10.6.2-3: 大書庫と忘却の底は archive_1
  /** the spawn on archive_1 next to its post-game down stairs (story A19 is asked to add it);
   *  while archive_1 has no such spawn the up stairs lead to its entrance instead (see the hook below) */
  K.ARCHIVE_SPAWN = 'from_oblivion';

  K.base = function (name, o) {
    return Object.assign({
      name, type: 'dungeon', theme: 'oblivion', bgm: 'postgame', bbg: 'oblivion',
      location: 'archive', region: 'postgame', escape: K.ESC, chestTier: 9, outside: '#',
    }, o || {});
  };

  K.npc = function (id, sprite, x, y, o) {
    const s = String(sprite || 'man');
    return Object.assign({ id, sprite: s.includes(':') ? s : 'npc:' + s, x, y, dir: 'down' }, o || {});
  };
  K.rest = function (x, y) { return K.npc('rest', 'obj:lantern', x, y, { event: 'common_rest', fixed: true }); };
  K.sign = function (x, y, text, cond) { const s = { x, y, text }; if (cond != null) s.cond = cond; return s; };
  K.chest = function (id, x, y, pool) { return { id, x, y, pool: pool || 'p_supply' }; };
  K.step = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'step' }, o || {}); };
  K.exam = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'examine' }, o || {}); };
  K.band = function (id, x0, y0, x1, y1, o) {
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(K.step(id, x, y, o));
    return out;
  };
  K.warp = function (x, y, to, spawn, o) { return Object.assign({ x, y, to, spawn }, o || {}); };

  /** every row (and decor row) of a def has the same width; warns once per map */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('oblivion map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('oblivion map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('oblivion map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  // ------------------------------------------------------------ data hooks
  function registerDen() {
    const DB = R.DB;
    const hi = DB.encounters && DB.encounters[K.ZONE_HI];
    if (hi && !DB.encounters[K.ZONE_DEN]) DB.encounters[K.ZONE_DEN] = Object.assign({}, hi, { den: true });
    const rr = DB.rareEncounters && DB.rareEncounters[K.ZONE_HI];
    if (rr && !DB.rareEncounters[K.ZONE_DEN]) DB.rareEncounters[K.ZONE_DEN] = { mon: rr.mon, rate: Math.max(1, Math.round(rr.rate / K.DEN_MUL)) };
  }
  /** point the up stairs of 1F at archive_1's post-game stairs, or at its entrance while that spawn is missing */
  function archiveReturn() {
    const a = R.DB.maps.archive_1, f1 = R.DB.maps.oblivion_1;
    if (!f1 || !f1.warps) return;
    let has = false;
    if (a) {
      if (a.spawns && a.spawns[K.ARCHIVE_SPAWN]) has = true;
      else if (a.marks) for (const k in a.marks) { const s = a.marks[k] && a.marks[k].spawn; if (s === K.ARCHIVE_SPAWN || (s && s.name === K.ARCHIVE_SPAWN)) has = true; }
    }
    for (const w of f1.warps) if (w.to === 'archive_1') w.spawn = has ? K.ARCHIVE_SPAWN : 'entrance';
  }
  K.hooks = { registerDen, archiveReturn };
  if (R.onData) { R.onData(registerDen); R.onData(archiveReturn); }

  // ------------------------------------------------------------ theme areas (2F 継ぎはぎの森)
  // R.Art.localTile returns null for a plain cell (no shading, no variant) and the field then draws
  // 'tile:<map.theme>:<id>', i.e. white paper in the middle of the forest / sand / snow patches.
  // Until the tiler or the field resolves that per cell (requested from art-local A16b / field A4),
  // answer those cells with the art of the cell's own theme. Only maps with def.themeAreas are
  // touched, and only when the tiler itself had nothing to say.
  function patchAreas() {
    const A = R.Art, G = R.Gfx;
    if (!A || typeof A.localTile !== 'function' || A.localTile._obAreas || !A.themeAt) return;
    const orig = A.localTile;
    const wrapped = function (map, x, y) {
      const g = orig.apply(this, arguments);
      if (g || !map || !map.def || !map.def.themeAreas) return g;
      const th = A.themeAt(map, x, y), base = A.themeOf ? A.themeOf(map.theme) : map.theme;
      if (!th || th === base) return g;
      const key = 'tile:' + th + ':' + map.tileAt(x, y);
      return G && G.has(key) ? G.get(key) : g;
    };
    for (const k of Object.keys(orig)) wrapped[k] = orig[k];
    wrapped._obAreas = true;
    A.localTile = wrapped;
  }
  K.patchAreas = patchAreas;
  if (R.onBoot) R.onBoot(patchAreas);
})(window.RPG);
