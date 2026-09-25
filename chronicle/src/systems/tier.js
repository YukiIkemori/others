// Tier (R.Tier): the number of cleared regions (0–8; 9 after the ending) drives
// enemies, chests, shops and inns so the 8 regions can be played in any order.
// DESIGN.md §3.3.5, §8.11, §8.12. Pure logic (no DOM).
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;

  const Tier = (R.Tier = {
    MAX: 8,
    POST: 9,

    /** R.Game.tier (0 without a game) */
    current() { return (R.Game && R.Game.tier) || 0; },
    /** the tier counted after the ending: 9 once the game is cleared (EXPECT, PEXP, inn prices) */
    effective() { return R.Game && R.Game.gameClear ? Tier.POST : Tier.current(); },
    isCleared(regionId) { return !!(R.Game && R.Game.regionsCleared.includes(regionId)); },
    clearedList() { return R.Game ? R.Game.regionsCleared.slice() : []; },
    /**
     * mark a region cleared (state only; ev.clearRegion plays the scene): appends to
     * regionsCleared, recomputes tier, sets cleared_<id>, emits 'tier'(tier, id).
     * → {tier, first}
     */
    clear(regionId) {
      const g = R.Game;
      if (!regionId) return { tier: Tier.current(), first: false };
      if (g.regionsCleared.includes(regionId)) return { tier: g.tier, first: false };
      g.regionsCleared.push(regionId);
      g.tier = Math.min(Tier.MAX, g.regionsCleared.length);
      R.State.setFlag('cleared_' + regionId);
      R.emit('tier', g.tier, regionId);
      return { tier: g.tier, first: true };
    },
    /**
     * a value by tier: an array → table[min(tier, length−1)]; an object {0:a, 3:b} →
     * the value of the largest key ≤ tier (undefined below every key: {3:b} means
     * "from tier 3 on"). tier defaults to current().
     */
    pick(table, tier) {
      if (table == null) return undefined;
      const t = tier == null ? Tier.current() : tier;
      if (Array.isArray(table)) return table.length ? table[U.clamp(t | 0, 0, table.length - 1)] : undefined;
      if (typeof table !== 'object') return table;
      let best = null;
      for (const k of Object.keys(table)) {
        const n = +k;
        if (!isNaN(n) && n <= t && (best === null || n > best)) best = n;
      }
      return best === null ? undefined : table[best];
    },
    /** one draw from a pool at tier T → {item, n} | {gold} | null (§8.12) */
    rollPool(poolId, T) {
      const pool = DB.pools[poolId];
      if (!pool) { R.warn('rollPool: unknown pool', poolId); return null; }
      const list = Tier.pick(pool.tiers, T == null ? Tier.current() : T) || [];
      const ok = list.filter((e) => e && (e.gold || (e.item && DB.items[e.item])) && (e.w == null || e.w > 0));
      if (!ok.length) return null;
      const e = U.weighted(ok.map((x) => Object.assign({ w: 1 }, x)));
      if (e.gold) return { gold: e.gold };
      return { item: e.item, n: Math.max(1, e.n | 0 || 1) };
    },
    /** the tier of a chest: def.tier → the map's chestTier → R.Game.tier (§8.12.1) */
    chestTier(def, map) {
      let md = map;
      if (typeof md === 'string') md = DB.maps[md];
      else if (md && md.def) md = md.def;
      if (def && def.tier != null) return def.tier;
      if (md && md.chestTier != null) return md.chestTier;
      return Tier.current();
    },
    /** roll a chest's contents without recording them */
    rollChest(def, map) {
      if (!def) return null;
      if (def.gold) return { gold: def.gold };
      if (!def.pool) {
        if (def.item) { R.warn('chest with a fixed item (use a pool):', def.id); return { item: def.item, n: def.n || 1 }; }
        return null;
      }
      return Tier.rollPool(def.pool, Tier.chestTier(def, map));
    },
    /**
     * the contents of a chest (§3.3.5): drawn from its pool at chestTier and recorded
     * in R.Game.chests[id] (an already recorded chest returns its record). Opening is
     * field's job.
     */
    chest(def, map) {
      if (!def) return null;
      const g = R.Game;
      if (def.id && g.chests[def.id] && typeof g.chests[def.id] === 'object') return g.chests[def.id];
      const r = Tier.rollChest(def, map) || { gold: 0 };
      if (def.id) g.chests[def.id] = r;
      return r;
    },
    /**
     * a shop's goods (§8.11.1): the fixed items, then the stock steps with tier ≤
     * current() whose cond holds — all of them (keepOld:true, duplicates dropped) or
     * only the last one in array order (keepOld:false). Unknown ids are skipped.
     */
    shopItems(shopId) {
      const s = DB.shops[shopId];
      if (!s) { R.warn('shopItems: unknown shop', shopId); return []; }
      const t = Tier.current();
      const steps = (s.stock || []).filter((st) => st && (st.tier || 0) <= t && (!st.cond || R.State.check(st.cond)));
      const out = [];
      const push = (id) => { if (DB.items[id] && !out.includes(id)) out.push(id); };
      for (const id of s.items || []) push(id);
      if (s.keepOld === false) { if (steps.length) for (const id of steps[steps.length - 1].items || []) push(id); }
      else for (const st of steps) for (const id of st.items || []) push(id);
      return out;
    },
    /** the inn's price: DB.config.innPrice[effective()] (§4.12.3) */
    innPrice() {
      const t = (DB.config && DB.config.innPrice) || (R.Rules && R.Rules.K.INN) || [10];
      return Tier.pick(t, Tier.effective());
    },
  });
})(window.RPG);
