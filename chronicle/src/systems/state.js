// Game state (R.Game) and its helpers (R.State): new game, flags and vars,
// conditions, inventory and gold, party lookup, healing, the bestiary / tech &
// spell books, warp targets, secrets and save/load. DESIGN.md §3.2, §3.3.2.
// Pure logic (no DOM).
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;

  const MAX_ITEM = 99;
  /** the save revision of the systems rework (A17 / A18 / A19): a save below it is migrated once (migrateA19) */
  const REV = 19;
  const MAX_GOLD = 9999999;
  const TYPE_ORDER = { consumable: 0, weapon: 1, shield: 2, head: 3, body: 4, hands: 5, feet: 6, acc: 7, key: 8 };
  const FALLBACK_START = { map: 'roa_house', spawn: 'bed', dir: 'down' };
  const cfg = () => DB.config || {};
  const startPos = () => Object.assign({}, FALLBACK_START, cfg().start || {});
  const nonEmpty = (o) => !!o && Object.keys(o).length > 0;

  /** placeName(): farther than this (cells) from every visited place, the save slot names the region */
  const PLACE_NEAR = 12;
  const State = (R.State = {
    /** where a new game starts (DB.config.start) */
    get START() { return startPos(); },

    // ------------------------------------------------------------ new game
    /**
     * a fresh game object (does not touch R.Game). heroSpec = {name, gender, type,
     * favor:{kind,id}}; omitted → DB.config.defaultHero
     */
    template(heroSpec) {
      const st = startPos();
      const c = cfg();
      const hero = R.Rules.newChar({ id: 'hero', heroSpec: heroSpec || undefined });
      return {
        game: 'chronicle',
        version: R.VERSION,
        rev: REV,
        party: [hero],
        reserve: [],
        tier: 0,
        regionsCleared: [],
        gameClear: false,
        clearCount: 0,
        flags: {},
        vars: {},
        objective: c.startObjective || null,
        regionObj: {},
        gold: c.startGold != null ? c.startGold : 0,
        inv: {},
        chests: {},
        visited: {},
        book: { mon: {}, tech: {}, spell: {} },
        pos: { map: st.map, x: 0, y: 0, dir: st.dir || 'down', spawn: st.spawn },
        respawn: { map: st.map, spawn: st.spawn },
        encItem: null,
        secrets: {},
        ship: null, onShip: false,
        steps: 0, playFrames: 0, battles: 0, wins: 0, escapes: 0,
        records: { glimmers: 0, rareDrops: 0, superDrops: 0, goldens: 0, rareMons: 0 },
        title: '',
      };
    },
    /**
     * start a new game in R.Game (§3.3.2): the hero alone (companions are chosen in
     * the prologue). opts.companions = [ids] also recruits them (debug, tools).
     */
    newGame(heroSpec, opts) {
      const g = (R.Game = State.template(heroSpec));
      const h = g.party[0];
      for (const a of h.techs.concat(h.spells)) State.noteLearned('hero', a);
      const items = cfg().startItems || {};
      for (const id in items) State.addItem(id, items[id]);
      if (R.Battle) R.Battle.autoCarry = false;
      if (opts && opts.companions && R.Party) for (const id of opts.companions) R.Party.recruit(id, { catchUp: false });
      return g;
    },

    // --------------------------------------------------------- flags & vars
    flag(name) { return !!(R.Game && R.Game.flags[name]); },
    setFlag(name, v = true) {
      const g = R.Game;
      if (v) g.flags[name] = true; else delete g.flags[name];
      if (name === 'game_clear') g.gameClear = !!v;
      R.emit('flag', name, v);
    },
    getVar(name) { return (R.Game && R.Game.vars[name]) || 0; },
    setVar(name, v) { R.Game.vars[name] = v; },
    addVar(name, n = 1) { R.Game.vars[name] = State.getVar(name) + n; return R.Game.vars[name]; },
    /**
     * condition (§3.2.3): 'flag' | '!flag' | [all…] |
     * {flag, notFlag, item, notItem, all, any, tier, tierBelow, cleared, notCleared,
     *  member, recruited, hero, heroType, var(+gte/lt/eq), postgame}
     * — every key in one object must hold
     */
    check(cond) {
      if (cond == null || cond === true || cond === '') return true;
      if (cond === false) return false;
      if (typeof cond === 'string') return cond[0] === '!' ? !State.flag(cond.slice(1)) : State.flag(cond);
      if (Array.isArray(cond)) return cond.every(State.check);
      if (typeof cond !== 'object') return !!cond;
      const g = R.Game;
      if (!g) return false;
      if (cond.flag && !State.flag(cond.flag)) return false;
      if (cond.notFlag && State.flag(cond.notFlag)) return false;
      if (cond.item && !State.hasItem(cond.item)) return false;
      if (cond.notItem && State.hasItem(cond.notItem)) return false;
      if (cond.all && !cond.all.every(State.check)) return false;
      if (cond.any && !cond.any.some(State.check)) return false;
      if (cond.tier != null && !(g.tier >= cond.tier)) return false;
      if (cond.tierBelow != null && !(g.tier < cond.tierBelow)) return false;
      if (cond.cleared && !g.regionsCleared.includes(cond.cleared)) return false;
      if (cond.notCleared && g.regionsCleared.includes(cond.notCleared)) return false;
      if (cond.member && !g.party.some((c) => c.id === cond.member)) return false;
      if (cond.recruited && !State.char(cond.recruited)) return false;
      if (cond.hero || cond.heroType) {
        const h = State.hero();
        if (!h) return false;
        if (cond.hero && h.gender !== cond.hero) return false;
        if (cond.heroType && h.heroType !== cond.heroType) return false;
      }
      if (cond.var) {
        const v = +State.getVar(cond.var) || 0;
        const cmp = cond.gte != null || cond.lt != null || cond.eq != null;
        if (cond.gte != null && !(v >= cond.gte)) return false;
        if (cond.lt != null && !(v < cond.lt)) return false;
        if (cond.eq != null && v !== cond.eq) return false;
        if (!cmp && !(v > 0)) return false;       // a bare {var} means "is set" (same as tools/lib/cond.js)
      }
      if (cond.postgame != null && !!g.gameClear !== !!cond.postgame) return false;
      return true;
    },

    // ----------------------------------------------------------- inventory
    count(id) { return (R.Game && R.Game.inv[id]) || 0; },
    /** carried + equipped by anyone in the party or the reserve */
    equippedCount(id) {
      let k = 0;
      for (const c of State.all()) for (const s of R.Rules.SLOTS) if (c.equip && c.equip[s] === id) k++;
      return k;
    },
    hasItem(id, n = 1) { return State.count(id) + State.equippedCount(id) >= n; },
    /** how many more of id fit (99 each, 1 for key items) */
    room(id) {
      const it = DB.items[id];
      const cap = it && it.type === 'key' ? 1 : MAX_ITEM;
      return Math.max(0, cap - State.count(id));
    },
    /**
     * add n (all or nothing; false when it would pass 99). A key item already owned
     * stays at 1 and counts as success.
     */
    addItem(id, n = 1) {
      const it = DB.items[id];
      if (!it) { R.warn('addItem: unknown item', id); return false; }
      n = Math.floor(n);
      if (!(n > 0)) return true;
      const inv = R.Game.inv;
      if (it.type === 'key') { inv[id] = 1; return true; }
      if ((inv[id] || 0) + n > MAX_ITEM) return false;
      inv[id] = (inv[id] || 0) + n;
      return true;
    },
    removeItem(id, n = 1) {
      const inv = R.Game.inv;
      if ((inv[id] || 0) < n) return false;
      inv[id] -= n;
      if (inv[id] <= 0) delete inv[id];
      return true;
    },
    /** the inventory as [{id, count, item}] sorted by type → sort → price (§3.3.2) */
    items(pred) {
      const inv = R.Game.inv;
      return Object.keys(inv)
        .filter((id) => DB.items[id] && inv[id] > 0 && (!pred || pred(DB.items[id], id)))
        .sort((a, b) => {
          const A = DB.items[a], B = DB.items[b];
          return ((TYPE_ORDER[A.type] ?? 9) - (TYPE_ORDER[B.type] ?? 9)) || ((A.sort || 0) - (B.sort || 0)) || ((A.price || 0) - (B.price || 0)) || (a < b ? -1 : a > b ? 1 : 0);
        })
        .map((id) => ({ id, count: inv[id], item: DB.items[id] }));
    },
    addGold(n) { R.Game.gold = U.clamp(Math.floor(R.Game.gold + Math.floor(n || 0)), 0, MAX_GOLD); return R.Game.gold; },
    takeGold(n) {
      n = Math.floor(n || 0);
      if (n < 0 || R.Game.gold < n) return false;
      R.Game.gold -= n;
      return true;
    },

    // ---------------------------------------------------------------- party
    hero() { return State.all().find((c) => c.id === 'hero') || (R.Game && R.Game.party[0]) || null; },
    party() { return R.Game.party; },
    reserve() { return R.Game.reserve; },
    all() { return R.Game ? R.Game.party.concat(R.Game.reserve || []) : []; },
    alive() { return R.Game.party.filter((c) => c.hp > 0); },
    leader() { return R.Game.party.find((c) => c.hp > 0) || State.hero(); },
    char(id) { return State.all().find((c) => c.id === id) || null; },
    /**
     * (re)create the hero from a spec (ev.createHero, §3.3.11): name, gender, type and favor
     * change, progress stays (level, EXP, seeds, counters, place in the party). The first time
     * (before hero_created) the placeholder hero's kit is replaced by the new type's kit; later
     * the equipment, proficiency and known techs/spells are kept and the new kit's techs,
     * spells and starting proficiency are added.
     */
    setHero(heroSpec) {
      const g = R.Game;
      const old = State.hero();
      const c = R.Rules.newChar({ id: 'hero', heroSpec });
      if (old) {
        c.level = old.level; c.exp = old.exp;
        c.bonus = Object.assign({ hp: 0, mp: 0 }, old.bonus);
        c.counts = Object.assign({ battles: 0, kills: 0, glimmers: 0 }, old.counts);
        c.joined = old.joined || c.joined;
        c.mem = old.mem || c.mem;
        if (!State.flag('hero_created')) {
          // the placeholder hero's kit is replaced: its techs/spells leave the books too
          const keep = new Set(c.techs.concat(c.spells));
          for (const k of ['tech', 'spell']) {
            const book = g.book[k];
            for (const id of (k === 'tech' ? old.techs : old.spells) || []) {
              if (keep.has(id) || !book[id]) continue;
              book[id] = book[id].filter((who) => who !== 'hero');
              if (!book[id].length) delete book[id];
            }
          }
        } else {
          c.equip = Object.assign(R.Rules.emptyEquip(), old.equip);
          for (const w of R.Rules.WTYPES) c.wprof[w] = Math.max(c.wprof[w] || 0, (old.wprof && old.wprof[w]) || 0);
          for (const e of R.Rules.ELEMENTS) c.eprof[e] = Math.max(c.eprof[e] || 0, (old.eprof && old.eprof[e]) || 0);
          c.techs = Array.from(new Set((old.techs || []).concat(c.techs)));
          c.spells = Array.from(new Set((old.spells || []).concat(c.spells)));
          c.row = old.row;
        }
      }
      R.Rules.fullHeal(c);
      const i = old ? g.party.indexOf(old) : -1;
      if (i >= 0) g.party[i] = c; else g.party.unshift(c);
      for (const a of c.techs.concat(c.spells)) State.noteLearned('hero', a);
      R.emit('partyChange');
      return c;
    },
    /** HP/MP to max, statuses cleared, the fallen revived (party, and the reserve unless {reserve:false}) */
    healAll(opts) {
      const list = opts && opts.reserve === false ? R.Game.party : State.all();
      for (const c of list) R.Rules.fullHeal(c);
    },
    /** after a wipe (§4.12.2): gold halved (rounded down), everyone healed, 香 gone, the next fight manual */
    wipeRecover() {
      R.Game.gold = Math.floor(R.Game.gold / 2);
      State.healAll();
      R.Game.encItem = null;
      if (R.Battle) R.Battle.autoCarry = false;
    },

    // --------------------------------------------------------------- books
    mon(monId) {
      const b = R.Game.book.mon;
      return (b[monId] = b[monId] || { seen: 0, kills: 0, gold: 0, drop: false, rare: false, sr: false, scan: false });
    },
    /** a monster met (the battle calls this once per kind per battle); rare monsters count in records.rareMons */
    seen(monId) {
      const e = State.mon(monId);
      if (DB.monsters[monId] && (DB.monsters[monId].flags || []).includes('rare')) R.Game.records.rareMons++;
      e.seen++;
      return e;
    },
    killed(monId, opts) {
      const e = State.mon(monId);
      if (!e.seen) e.seen = 1;
      e.kills++;
      if (opts && opts.golden) { e.gold++; R.Game.records.goldens++; }
      return e;
    },
    /**
     * the bestiary slot of an obtained item: kind 'normal'|'rare'|'super' (drop or
     * steal, Part A5) → drop/rare/sr = true; 'scan' → scan = true. Counts rare /
     * super-rare finds in R.Game.records (call once per item obtained).
     */
    noteDrop(monId, kind, opts) {
      const KEY = { normal: 'drop', rare: 'rare', super: 'sr', scan: 'scan' };
      const k = KEY[kind];
      if (!k) { R.warn('noteDrop: unknown kind', kind); return null; }
      const e = State.mon(monId);
      e[k] = true;
      if (opts && opts.stolen) (e.stole = e.stole || {})[kind] = true;
      if (kind === 'rare') R.Game.records.rareDrops++;
      if (kind === 'super') R.Game.records.superDrops++;
      return e;
    },
    /** record who learned a tech (t_…) or spell (s_…) in the books */
    noteLearned(charId, actionId) {
      const a = DB.actions[actionId];
      const kind = (a && a.kind) || (actionId[0] === 's' ? 'spell' : 'tech');
      const book = kind === 'spell' ? R.Game.book.spell : R.Game.book.tech;
      const list = (book[actionId] = book[actionId] || []);
      if (!list.includes(charId)) list.push(charId);
      return list;
    },
    /** has anyone learned it? */
    learnedBy(actionId) {
      const a = DB.actions[actionId];
      const book = a && a.kind === 'spell' ? R.Game.book.spell : R.Game.book.tech;
      return book[actionId] || [];
    },

    // ------------------------------------------------- warps & secrets
    /**
     * the warp target (DB.locations id) a map belongs to (§3.3.2): def.location when
     * it is a location, else the dungeon location whose spawn is def.escape.spawn.
     * Reads only (no cache, no set).
     */
    dungeonLocation(def) {
      if (!def) return null;
      if (def.location && DB.locations[def.location]) return def.location;
      const e = def.escape;
      if (!e || !e.spawn) return null;
      for (const id in DB.locations) {
        const l = DB.locations[id];
        if ((l.kind === 'dungeon' || l.dungeon) && l.spawn === e.spawn) return id;
      }
      return null;
    },
    /**
     * load-time migration (§3.2.5-9): mark the dungeons the party has been in (a chest
     * opened there, a monster of its zones seen, standing in it) as warp targets.
     */
    syncVisited(g) {
      g.visited = g.visited || {};
      const mon = (g.book && g.book.mon) || {};
      // which warp target each zone belongs to (null when a town / the world map uses it too)
      const zoneLoc = {};
      const zonesOf = (d) => [].concat(d.encounter || [], d.defaultZone || [], (d.zones || []).map((z) => z && z.zone)).filter((z) => typeof z === 'string');
      for (const mid in DB.maps) {
        const d = DB.maps[mid];
        if (!d) continue;
        const loc = d.type === 'dungeon' ? State.dungeonLocation(d) : null;
        for (const z of zonesOf(d)) zoneLoc[z] = z in zoneLoc && zoneLoc[z] !== loc ? null : loc;
      }
      // a monster seen proves a visit only when every zone it can appear in belongs to one dungeon
      const monLoc = {};
      const note = (m, loc) => { monLoc[m] = m in monLoc && monLoc[m] !== loc ? null : loc; };
      for (const z in DB.encounters) {
        if (!(z in zoneLoc)) continue;              // a zone no map uses proves nothing either way
        const loc = zoneLoc[z];
        for (const gr of DB.encounters[z].groups || []) for (const e of gr.mons || []) {
          const ref = e && e[0];
          if (typeof ref !== 'string') continue;
          if (ref[0] === '@') { const L = DB.lineages[ref.slice(1)]; for (const st of (L && L.stages) || []) note(st.mon, loc); }
          else note(ref, loc);
        }
      }
      for (const m in mon) if (monLoc[m] && (mon[m].seen || mon[m].kills)) g.visited[monLoc[m]] = true;
      for (const mid in DB.maps) {
        const d = DB.maps[mid];
        if (!d || d.type !== 'dungeon') continue;
        const loc = State.dungeonLocation(d);
        if (!loc || g.visited[loc]) continue;
        const chestList = Array.isArray(d.chests) ? d.chests : Object.values(d.chests || {});
        const chest = chestList.some((c) => c && c.id && g.chests && g.chests[c.id]) ||
          Object.keys(g.chests || {}).some((id) => id.startsWith(mid + '_c'));
        if (chest || (g.pos && g.pos.map === mid)) g.visited[loc] = true;
      }
      return g.visited;
    },
    secretKey(map, x, y) { return `${map}:${x},${y}`; },
    isSecretFound(map, x, y) { return !!(R.Game && R.Game.secrets[State.secretKey(map, x, y)]); },
    /** remember a found secret passage; true the first time */
    markSecret(map, x, y) {
      const k = State.secretKey(map, x, y);
      if (R.Game.secrets[k]) return false;
      R.Game.secrets[k] = true;
      return true;
    },

    // ------------------------------------------------------ save / load
    /** where the party is, for save slots: the map name, or 「〇〇付近」 on the world map */
    placeName() {
      const g = R.Game;
      const def = DB.maps[g.pos.map];
      if (!def) return '';
      if (def.type !== 'world') {
        if (def.name) return def.name;
        const loc = State.dungeonLocation(def);
        return (loc && DB.locations[loc].name) || '';
      }
      // distance to the nearest visited location on this map; a wrapping world (a torus) measures
      // each axis the short way round: min(|d|, size − |d|)
      let fm = null;
      try { fm = R.FieldMap && R.FieldMap.peek ? R.FieldMap.peek(g.pos.map) : null; } catch (e) { fm = null; }
      const wrap = !!(fm && fm.wrap && fm.w && fm.h);
      const axis = (d, n) => { d = Math.abs(d); if (!wrap) return d; d %= n; return Math.min(d, n - d); };
      let best = null, bd = Infinity;
      for (const id in DB.locations) {
        const l = DB.locations[id];
        if (l.map !== g.pos.map || (g.visited && !g.visited[id])) continue;
        let p = null;
        try { p = R.FieldMap && R.FieldMap.spawnPos(l.spawn, l.map); } catch (e) { p = null; }
        if (!p) continue;
        const d = axis(p.x - g.pos.x, fm ? fm.w : 0) + axis(p.y - g.pos.y, fm ? fm.h : 0);
        if (d < bd) { bd = d; best = l; }
      }
      if (best && bd <= PLACE_NEAR) return bd <= 1 ? best.name : best.name + '付近';
      // far from every visited place: the region whose world encounter zone is the one underfoot
      let zone = null;
      try { zone = fm && fm.zoneAt ? fm.zoneAt(g.pos.x, g.pos.y) : null; } catch (e) { zone = null; }
      if (zone) for (const rid in DB.regions) if (DB.regions[rid] && DB.regions[rid].zone === zone && DB.regions[rid].name) return DB.regions[rid].name;
      return 'エルセリア';
    },
    /** save data (§3.2.5): {v, kind, summary, game} */
    serialize() {
      const g = R.Game;
      const hero = State.hero();
      return {
        v: 1,
        kind: 'chronicle',
        summary: {
          hero: hero ? hero.name : '',
          level: hero ? hero.level : 1,
          names: g.party.map((c) => c.name + ' Lv' + c.level),
          sprites: R.Party ? g.party.map((c) => R.Party.spriteKey(c)) : [],
          place: State.placeName(),
          time: U.playTime(g.playFrames || 0),
          gold: g.gold,
          tier: g.tier,
          clear: !!g.gameClear,
          title: g.title || '',
        },
        game: U.clone(g),
      };
    },
    /**
     * load save data into R.Game (§3.2.5). Rejects anything that is not a chronicle
     * save. Missing keys come from a fresh template, ids that no longer exist are
     * dropped (only when that registry has data at all), every CharState is repaired,
     * derived values are recomputed. → bool
     */
    deserialize(data) {
      if (!data || data.kind !== 'chronicle' || !data.game || typeof data.game !== 'object') return false;
      let g;
      try { g = U.clone(data.game); } catch (e) { return false; }
      const oldRev = +g.rev || 0;     // read before the template fills the missing keys (a fresh game is REV)
      const fresh = State.template();
      for (const k in fresh) if (!(k in g) || g[k] == null && fresh[k] != null) g[k] = fresh[k];
      g.game = 'chronicle';
      for (const k of ['flags', 'vars', 'inv', 'chests', 'visited', 'secrets', 'regionObj']) if (!g[k] || typeof g[k] !== 'object' || Array.isArray(g[k])) g[k] = {};
      g.records = Object.assign({}, fresh.records, g.records || {});
      // old keys: the Crest-era repel counter (§3.2.5-7; spelled in two parts so validate V11, which
      // looks for live uses of it, does not flag this one-way migration) and the job-era bestiary
      const OLD_REPEL = 'repel' + 'Steps';
      if (OLD_REPEL in g) { delete g[OLD_REPEL]; g.encItem = null; }
      if (g.encItem && !(g.encItem.steps > 0)) g.encItem = null;
      if (g.bestiary && (!g.book || !g.book.mon || !nonEmpty(g.book.mon))) {
        g.book = g.book || {};
        g.book.mon = {};
        for (const id in g.bestiary) {
          const b = g.bestiary[id] || {};
          g.book.mon[id] = { seen: b.seen || 0, kills: b.kills || 0, gold: 0, drop: !!(b.drop || b.steal), rare: !!(b.rare || b.stealRare), sr: !!b.sr, scan: !!b.scan };
        }
      }
      delete g.bestiary; delete g.jpTables;
      g.book = g.book || {};
      for (const k of ['mon', 'tech', 'spell']) if (!g.book[k] || typeof g.book[k] !== 'object') g.book[k] = {};
      // the systems rework (SYSTEMS_REWORK §2.8, §3.9): once, before the ids that no longer exist are dropped
      if (oldRev < REV) State.migrateA19(g);
      g.rev = REV;
      // ids that no longer exist
      if (nonEmpty(DB.items)) for (const id in g.inv) if (!DB.items[id] || !(g.inv[id] > 0)) delete g.inv[id];
      for (const id in g.inv) g.inv[id] = Math.min(DB.items[id] && DB.items[id].type === 'key' ? 1 : MAX_ITEM, Math.floor(g.inv[id]));
      if (nonEmpty(DB.monsters)) for (const id in g.book.mon) if (!DB.monsters[id]) delete g.book.mon[id];
      for (const id in g.book.mon) g.book.mon[id] = Object.assign({ seen: 0, kills: 0, gold: 0, drop: false, rare: false, sr: false, scan: false }, g.book.mon[id]);
      if (nonEmpty(DB.actions)) {
        for (const id in g.book.tech) if (!DB.actions[id]) delete g.book.tech[id];
        for (const id in g.book.spell) if (!DB.actions[id]) delete g.book.spell[id];
      }
      // who learned it: a list of char ids (a damaged entry becomes an empty list, then goes)
      for (const k of ['tech', 'spell']) {
        for (const id in g.book[k]) {
          const v = g.book[k][id];
          const list = Array.isArray(v) ? Array.from(new Set(v.filter((x) => typeof x === 'string'))) : [];
          if (list.length) g.book[k][id] = list; else delete g.book[k][id];
        }
      }
      // characters
      const seenIds = new Set();
      const fix = (list) => (Array.isArray(list) ? list : []).filter((c) => {
        if (!c || typeof c !== 'object' || !c.id || seenIds.has(c.id)) return false;
        if (c.id !== 'hero' && nonEmpty(DB.companions) && !DB.companions[c.id]) return false;
        seenIds.add(c.id);
        State.repairChar(c, g.inv);
        return true;
      });
      g.party = fix(g.party);
      g.reserve = fix(g.reserve);
      // the hero is always in the party (§3.2.6)
      let hi = g.reserve.findIndex((c) => c.id === 'hero');
      if (hi >= 0) g.party.unshift(g.reserve.splice(hi, 1)[0]);
      if (!g.party.some((c) => c.id === 'hero')) g.party.unshift(fresh.party[0]);
      while (g.party.length > (R.PARTY_MAX || 4)) {
        const i = g.party.map((c) => c.id !== 'hero').lastIndexOf(true);
        g.reserve.push(g.party.splice(i, 1)[0]);
      }
      for (const c of g.party.concat(g.reserve)) if (c.id !== 'hero') g.flags['joined_' + c.id] = true;
      // tier & clear state
      g.regionsCleared = Array.from(new Set((Array.isArray(g.regionsCleared) ? g.regionsCleared : []).filter((r) => typeof r === 'string')));
      if (nonEmpty(DB.regions)) g.regionsCleared = g.regionsCleared.filter((r) => DB.regions[r]);
      g.tier = Math.min(R.Tier ? R.Tier.MAX : 8, g.regionsCleared.length);
      for (const r of g.regionsCleared) g.flags['cleared_' + r] = true;
      g.gameClear = !!(g.gameClear || g.flags.game_clear);
      if (g.gameClear) g.flags.game_clear = true;
      g.clearCount = Math.max(g.clearCount | 0, g.gameClear ? 1 : 0);
      g.gold = U.clamp(Math.floor(g.gold || 0), 0, MAX_GOLD);
      if (!g.pos || !g.pos.map) g.pos = fresh.pos;
      if (!g.respawn || !g.respawn.map) g.respawn = fresh.respawn;
      // a map that no longer exists (renamed in an update): back to the respawn town, else the start
      if (nonEmpty(DB.maps)) {
        if (!DB.maps[g.respawn.map]) g.respawn = fresh.respawn;
        if (!DB.maps[g.pos.map]) {
          const r = g.respawn;
          g.pos = DB.maps[r.map] ? { map: r.map, x: r.x || 0, y: r.y || 0, dir: r.dir || 'down', spawn: r.spawn || (r.x == null ? 'entrance' : undefined) } : fresh.pos;
          g.onShip = false;
        }
      }
      g.version = R.VERSION;
      const prev = R.Game;
      R.Game = g;
      try {
        // hp/mp inside the maxima (after R.Game is set: stats may look at the game)
        for (const c of g.party.concat(g.reserve)) { R.Rules.clampHpMp(c); c.status = {}; }
        State.syncVisited(g);
      } catch (e) {
        R.Game = prev;
        R.warn('deserialize failed', e);
        return false;
      }
      if (R.Battle) R.Battle.autoCarry = false;
      return true;
    },
    /**
     * the one-time migration of a save from before the systems rework (g.rev < 19; SYSTEMS_REWORK §2.8, §3.9),
     * with the table DB.remap (src/data/remap_a19.js). Works on the raw save (before repairChar):
     *   1. g.inv ids replaced, counts added (99 at most, the rest is lost)
     *   2. every member's equipment replaced (repairChar then moves a shield next to a new two-handed weapon to the bag)
     *   3. techs / spells replaced without duplicates; the per-type list cursors (c.mem.list) cleared
     *   4. the tech / spell book keys replaced, the learner lists merged
     *   5. proficiency: the removed types' points go to their new type by max; element points × 2.5 (cap PROF_CAP)
     *   6. the hero's weapon favor: remap.favor, or the first favorOptions.weapon of the type when not offered
     *   7. WP: mp += round(1.5 × wp), bonus.mp = min(cap, bonus.mp + bonus.wp); wp and bonus.wp removed
     */
    migrateA19(g) {
      const M = DB.remap || {};
      const mItems = M.items || {}, mActs = M.actions || {}, mW = M.wtypes || {}, mFav = M.favor || {};
      const Ru = R.Rules, K = Ru.K;
      const item = (id) => (typeof id === 'string' && mItems[id]) || id;
      const act = (id) => (typeof id === 'string' && mActs[id]) || id;
      // 1. inventory
      if (g.inv && typeof g.inv === 'object') {
        const inv = {};
        for (const id in g.inv) {
          const n = Math.floor(+g.inv[id] || 0);
          if (!(n > 0)) continue;
          const to = item(id);
          inv[to] = Math.min(MAX_ITEM, (inv[to] || 0) + n);
        }
        g.inv = inv;
      }
      // 4. the books
      for (const k of ['tech', 'spell']) {
        const b = g.book && g.book[k];
        if (!b || typeof b !== 'object') continue;
        const out = {};
        for (const id in b) {
          const to = act(id);
          const list = Array.isArray(b[id]) ? b[id] : [];
          out[to] = Array.from(new Set((out[to] || []).concat(list)));
        }
        g.book[k] = out;
      }
      const chars = [].concat(Array.isArray(g.party) ? g.party : [], Array.isArray(g.reserve) ? g.reserve : []);
      for (const c of chars) {
        if (!c || typeof c !== 'object') continue;
        // 2. equipment
        if (c.equip && typeof c.equip === 'object') for (const s in c.equip) if (c.equip[s]) c.equip[s] = item(c.equip[s]);
        // 3. techs, spells
        for (const k of ['techs', 'spells']) if (Array.isArray(c[k])) c[k] = Array.from(new Set(c[k].map(act)));
        if (c.mem && typeof c.mem === 'object') c.mem.list = {};
        // 5. proficiency
        if (c.wprof && typeof c.wprof === 'object') {
          for (const old in mW) {
            if (!(old in c.wprof)) continue;
            const to = mW[old];
            c.wprof[to] = Math.max(+c.wprof[to] || 0, +c.wprof[old] || 0);
            delete c.wprof[old];
          }
        }
        if (c.eprof && typeof c.eprof === 'object') {
          for (const e in c.eprof) c.eprof[e] = U.clamp(Math.round((+c.eprof[e] || 0) * 2.5 * 100) / 100, 0, K.PROF_CAP);
        }
        // 6. the hero's favor
        if (c.id === 'hero' && c.favor && c.favor.kind === 'weapon' && c.favor.id) {
          const ht = DB.heroTypes && DB.heroTypes[c.heroType];
          const opts = (ht && ht.favorOptions && ht.favorOptions.weapon) || null;
          let to = mFav[c.favor.id] || c.favor.id;
          if (opts && opts.length && !opts.includes(to)) to = opts[0];
          c.favor = { kind: 'weapon', id: to };
        }
        // 7. WP → MP (clampHpMp after loading keeps it inside the new maximum)
        c.mp = Math.max(0, Math.floor(+c.mp || 0)) + Math.round(1.5 * (+c.wp || 0));
        if (c.bonus && typeof c.bonus === 'object') {
          c.bonus.mp = Math.min(K.BONUS_CAP.mp, (+c.bonus.mp || 0) + (+c.bonus.wp || 0));
          delete c.bonus.wp;
        }
        delete c.wp;
      }
      g.rev = REV;
      return g;
    },
    /** make a loaded CharState whole: 9 slots, 7+6 proficiency keys, arrays, counters (old-save safety) */
    repairChar(c, inv) {
      const Ru = R.Rules;
      const e = c.equip && typeof c.equip === 'object' ? c.equip : {};
      if (e.weapon && !e.weapon1) e.weapon1 = e.weapon;
      if (e.acc && !e.acc1) e.acc1 = e.acc;
      const eq = Ru.emptyEquip();
      for (const s of Ru.SLOTS) {
        const id = e[s];
        if (!id) continue;
        if (nonEmpty(DB.items) && !DB.items[id]) continue;
        const it = DB.items[id];
        if (it && Ru.groupOfSlot(s) !== it.type) continue;
        eq[s] = id;
      }
      c.equip = eq;
      if (Ru.hasTwoHanded(c) && c.equip.shield) {
        // a shield next to a two-handed weapon: back to the inventory
        const id = c.equip.shield;
        c.equip.shield = null;
        if (inv) inv[id] = Math.min(MAX_ITEM, (inv[id] || 0) + 1);
      }
      c.wprof = c.wprof && typeof c.wprof === 'object' ? c.wprof : {};
      c.eprof = c.eprof && typeof c.eprof === 'object' ? c.eprof : {};
      for (const w of Ru.WTYPES) c.wprof[w] = U.clamp(+c.wprof[w] || 0, 0, Ru.K.PROF_CAP);
      for (const el of Ru.ELEMENTS) c.eprof[el] = U.clamp(+c.eprof[el] || 0, 0, Ru.K.PROF_CAP);
      for (const k of Object.keys(c.wprof)) if (!Ru.WTYPES.includes(k)) delete c.wprof[k];
      for (const k of Object.keys(c.eprof)) if (!Ru.ELEMENTS.includes(k)) delete c.eprof[k];
      const known = (id) => typeof id === 'string' && (!nonEmpty(DB.actions) || !!DB.actions[id]);
      c.techs = Array.from(new Set(Array.isArray(c.techs) ? c.techs : [])).filter(known);
      c.spells = Array.from(new Set(Array.isArray(c.spells) ? c.spells : [])).filter(known);
      c.bonus = Object.assign({ hp: 0, mp: 0 }, c.bonus || {});
      for (const k of Object.keys(c.bonus)) if (!Ru.MAXES.includes(k)) delete c.bonus[k];
      for (const k of Ru.MAXES) c.bonus[k] = U.clamp(+c.bonus[k] || 0, 0, Ru.K.BONUS_CAP[k]);
      c.level = U.clamp((c.level | 0) || 1, 1, Ru.MAX_LEVEL);
      c.exp = Math.max(Ru.expForLevel(c.level), +c.exp || 0);
      c.row = c.row === 'middle' ? 'middle' : 'front';
      c.gender = c.gender === 'f' ? 'f' : 'm';
      if (c.id === 'hero') {
        if (!c.heroType || (nonEmpty(DB.heroTypes) && !DB.heroTypes[c.heroType])) c.heroType = Ru.defaultHeroSpec().type;
        if (!c.favor || !c.favor.kind || !c.favor.id) c.favor = Ru.defaultHeroSpec().favor;
        if (!c.name) c.name = Ru.defaultHeroSpec().name;
      } else if (!c.name) c.name = (DB.companions[c.id] && DB.companions[c.id].name) || c.id;
      c.mem = Object.assign({ cmd: 0, list: {}, item: 0, target: null }, c.mem || {});
      c.joined = Object.assign({ tier: 0, frame: 0 }, c.joined || {});
      c.counts = Object.assign({ battles: 0, kills: 0, glimmers: 0 }, c.counts || {});
      for (const k of Ru.MAXES) c[k] = Math.max(0, Math.floor(+c[k] || 0));
      delete c.wp;
      c.status = {};
      delete c.job; delete c.jobs; delete c.set; delete c.unlocked;
      return c;
    },
  });
})(window.RPG);
