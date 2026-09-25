// Game state (R.Game) + helpers (R.State): new game, flags, inventory, gold,
// bestiary, serialisation. Pure logic (no DOM).
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;

  const State = (R.State = {
    START: { map: 'regnas_castle', spawn: 'start', dir: 'up' },

    newGame() {
      const g = (R.Game = {
        version: R.VERSION,
        party: R.PARTY_ORDER.map((id) => R.Rules.newChar(id)),
        gold: 50,
        inv: {}, // itemId -> count (includes key items)
        flags: {}, // story flags: name -> true
        vars: {}, // numeric vars
        chests: {}, // chestId -> true once opened
        visited: {}, // location id (R.DB.locations) -> true (teleport list)
        bestiary: {}, // monsterId -> {seen, kills, drop:bool, rare:bool, steal:bool}
        pos: { map: State.START.map, x: 0, y: 0, dir: State.START.dir, spawn: State.START.spawn },
        ship: null, // {map:'world', x, y} once obtained
        onShip: false,
        respawn: { map: 'regnas_castle', spawn: 'start' }, // where you wake after a wipe
        repelSteps: 0, // せいすい
        steps: 0, playFrames: 0, battles: 0, wins: 0, escapes: 0,
        objective: 'obj_start', // key into R.DB.objectives (menu shows current goal)
      });
      // starting items
      State.addItem('herb', 4);
      if (R.Battle) R.Battle.autoCarry = false; // auto battle never carries over a new game / load
      return g;
    },

    // -------------------------------------------------------------- flags
    flag(name) { return !!(R.Game && R.Game.flags[name]); },
    setFlag(name, v = true) {
      if (v) R.Game.flags[name] = true; else delete R.Game.flags[name];
      R.emit('flag', name, v);
    },
    getVar(name) { return (R.Game.vars[name] || 0); },
    setVar(name, v) { R.Game.vars[name] = v; },
    /**
     * Condition check used by maps/NPCs/events:
     *   string 'flag'         → flag set
     *   string '!flag'        → flag NOT set
     *   array  ['a','!b']     → all
     *   object {flag, notFlag, item, notItem, all:[...], any:[...]}
     */
    check(cond) {
      if (cond == null || cond === true) return true;
      if (typeof cond === 'string') return cond[0] === '!' ? !State.flag(cond.slice(1)) : State.flag(cond);
      if (Array.isArray(cond)) return cond.every(State.check);
      if (cond.flag && !State.flag(cond.flag)) return false;
      if (cond.notFlag && State.flag(cond.notFlag)) return false;
      if (cond.item && !State.hasItem(cond.item)) return false;
      if (cond.notItem && State.hasItem(cond.notItem)) return false;
      if (cond.all && !cond.all.every(State.check)) return false;
      if (cond.any && !cond.any.some(State.check)) return false;
      return true;
    },

    // ---------------------------------------------------------- inventory
    count(id) { return (R.Game.inv[id] || 0); },
    hasItem(id, n = 1) {
      if (State.count(id) >= n) return true;
      // equipped items count too for 'has' checks of key-ish gear
      let k = 0;
      for (const c of R.Game.party) for (const s of R.Rules.SLOTS) if (c.equip[s] === id) k++;
      return State.count(id) + k >= n;
    },
    addItem(id, n = 1) {
      if (!DB.items[id]) { R.warn('addItem unknown', id); return false; }
      R.Game.inv[id] = Math.min(99, (R.Game.inv[id] || 0) + n);
      return true;
    },
    removeItem(id, n = 1) {
      if ((R.Game.inv[id] || 0) < n) return false;
      R.Game.inv[id] -= n;
      if (R.Game.inv[id] <= 0) delete R.Game.inv[id];
      return true;
    },
    /** inventory as sorted list [{id,count,item}] filtered by predicate */
    items(pred) {
      const order = { consumable: 0, weapon: 1, shield: 2, head: 3, body: 4, acc: 5, key: 6 };
      return Object.keys(R.Game.inv)
        .filter((id) => DB.items[id] && R.Game.inv[id] > 0 && (!pred || pred(DB.items[id], id)))
        .sort((a, b) => (order[DB.items[a].type] - order[DB.items[b].type]) || ((DB.items[a].sort || 0) - (DB.items[b].sort || 0)) || (DB.items[a].price || 0) - (DB.items[b].price || 0))
        .map((id) => ({ id, count: R.Game.inv[id], item: DB.items[id] }));
    },
    addGold(n) { R.Game.gold = U.clamp(R.Game.gold + Math.floor(n), 0, 9999999); },
    takeGold(n) { if (R.Game.gold < n) return false; R.Game.gold -= n; return true; },

    // -------------------------------------------------------------- party
    alive() { return R.Game.party.filter((c) => c.hp > 0); },
    leader() { return R.Game.party.find((c) => c.hp > 0) || R.Game.party[0]; },
    char(id) { return R.Game.party.find((c) => c.id === id); },
    /** full heal: HP/MP, revive, cure statuses */
    healAll() {
      for (const c of R.Game.party) {
        const s = R.Rules.stats(c);
        c.hp = s.hp; c.mp = s.mp; c.status = {};
      }
    },
    /** after a wipe: revive everyone at full HP (DQ-style), halve gold */
    wipeRecover() {
      R.Game.gold = Math.floor(R.Game.gold / 2);
      State.healAll();
    },

    // ---------------------------------------------------------- bestiary
    seen(monId) {
      const b = (R.Game.bestiary[monId] = R.Game.bestiary[monId] || { seen: 0, kills: 0 });
      b.seen++;
      return b;
    },
    killed(monId) { const b = (R.Game.bestiary[monId] = R.Game.bestiary[monId] || { seen: 1, kills: 0 }); b.kills++; },
    noteDrop(monId, kind) { const b = (R.Game.bestiary[monId] = R.Game.bestiary[monId] || { seen: 1, kills: 0 }); b[kind] = true; },

    // --------------------------------------------------- serialisation
    serialize() {
      const g = R.Game;
      const lead = g.party[0];
      const loc = DB.maps[g.pos.map];
      return {
        v: 1,
        summary: {
          level: lead.level,
          names: g.party.map((c) => c.name + ' Lv' + c.level),
          place: (loc && loc.name) || '',
          time: U.playTime(g.playFrames),
          gold: g.gold,
        },
        game: U.clone(g),
      };
    },
    deserialize(data) {
      if (!data || !data.game) return false;
      const g = U.clone(data.game);
      // forward-compat: fill missing fields from a fresh game
      const fresh = State.newGame();
      for (const k in fresh) if (!(k in g)) g[k] = fresh[k];
      // drop references to content that no longer exists
      for (const id in g.inv) if (!DB.items[id]) delete g.inv[id];
      for (const c of g.party) {
        for (const s of R.Rules.SLOTS) if (c.equip[s] && !DB.items[c.equip[s]]) c.equip[s] = null;
        if (!DB.jobs[c.job]) c.job = DB.chars[c.id].startJob;
        for (const s of R.Rules.SET_SLOTS) if (c.set[s] && !(DB.abilities[c.set[s]] || DB.jobs[c.set[s]])) c.set[s] = null;
      }
      R.Game = g;
      if (R.Battle) R.Battle.autoCarry = false;
      return true;
    },
  });
})(window.RPG);
