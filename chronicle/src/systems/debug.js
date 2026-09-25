// Debug hooks (DESIGN §7.2): R.debug.* from the browser console / tools/shot.js.
// ?debug=1 also shows the map id and tile coordinates in the corner.
(function (R) {
  'use strict';
  const DB = R.DB;

  function need() { if (!R.Game) R.State.newGame(); return R.Game; }
  function chars(charId) { return charId ? [R.State.char(charId)].filter(Boolean) : R.Game.party; }

  R.debug = {
    /** warp(map, spawnName | {x,y}) */
    warp(map, spawn) { need(); return R.Field.warp(map, spawn, { fade: false }); },
    give(item, n = 1) {
      need();
      if (!DB.items[item]) return 'unknown item ' + item;
      R.State.addItem(item, n);
      return item + ' ×' + R.State.count(item);
    },
    flag(name, v = true) { need(); R.State.setFlag(name, v); R.Field.refresh(); return R.State.flag(name); },
    gold(n) { need(); R.State.addGold(n); return R.Game.gold; },
    /** set every member (or one) to level n, full HP/MP */
    level(n, charId) {
      need();
      for (const c of chars(charId)) {
        c.level = R.U.clamp(n | 0, 1, R.Rules.MAX_LEVEL);
        c.exp = R.Rules.expForLevel(c.level);
        const s = R.Rules.stats(c);
        c.hp = s.hp; c.mp = s.mp;
      }
      return R.Game.party.map((c) => c.name + ' Lv' + c.level);
    },
    /** give n JP to each member's current job (or one member's) */
    jp(n, charId) {
      need();
      return chars(charId).map((c) => { R.Rules.gainJp(c, n); return c.name + ' ' + c.job + ' Lv' + R.Rules.jobLevel(c, c.job); });
    },
    noEncounter(v = true) { R.Field.noEncounter = !!v; return R.Field.noEncounter; },
    heal() { need(); R.State.healAll(); return true; },
    /** set a job's level directly (JP total = table value, spendable JP raised by the difference) */
    setJobLevel(charId, job, lv) {
      need();
      const c = R.State.char(charId);
      if (!c) return 'unknown char ' + charId;
      const rec = R.Rules.jobRec(c, job);
      const total = R.Rules.jpForJobLevel(job, lv);
      if (total > rec.total) rec.jp += total - rec.total;
      rec.total = total;
      return c.name + ' ' + job + ' Lv' + R.Rules.jobLevel(c, job);
    },
    /** fresh game started directly at map/spawn (skips the title) */
    newGameAt(map, spawn) {
      R.Engine.clear();
      R.State.newGame();
      return R.Field.start(map || R.State.START.map, spawn != null ? spawn : map ? 'entrance' : R.State.START.spawn);
    },

    // ---- extras
    pos() { const p = R.Field.pos(); return p && Object.assign({ map: R.Field.map && R.Field.map.id }, p, { exact: R.Field.exactPos() }); },
    /** battle(zoneId | troopId) */
    battle(id) {
      if (!R.Battle || !R.Battle.start) return 'no battle system';
      if (DB.troops[id]) return R.Events.run((ev) => ev.battle(id));
      return R.Field.encounter(id);
    },
    event(id) { return R.Events.run(id, { self: 'debug' }); },
    /** put the ship at a world spawn (or {x,y}) */
    ship(spawn) {
      need();
      const wid = R.Field.map && R.Field.map.isWorld && typeof spawn === 'object' ? R.Field.map.id : R.FieldMap.findWorld(typeof spawn === 'string' ? spawn : null);
      const p = wid && R.FieldMap.spawnPos(spawn, wid);
      if (!p) return 'unknown spawn';
      R.Game.ship = { map: wid, x: p.x, y: p.y, dir: p.dir || 'down' };
      return R.Game.ship;
    },
    visitAll() { need(); for (const id in DB.locations) R.Game.visited[id] = true; return Object.keys(R.Game.visited); },
    teleport(loc) { return R.Field.teleport(loc); },
    maps() { return Object.keys(DB.maps); },
    /** learn every ability of every unlocked job (all members) */
    learnAll() {
      need();
      for (const c of R.Game.party) {
        for (const j of R.Rules.unlockedJobs(c)) {
          const rec = R.Rules.jobRec(c, j);
          for (const a of R.Rules.jobAbilities(j)) if (!rec.learned.includes(a)) rec.learned.push(a);
        }
      }
      return true;
    },
  };

  R.onBoot(() => {
    try {
      if (/[?&]debug=1\b/.test(window.location.search || '')) R.Field.showCoords = true;
    } catch (e) { /* no location (tools) */ }
  });
})(window.RPG);
