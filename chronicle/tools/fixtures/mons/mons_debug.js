// A11 mons — visual-check helpers (fixture only: node tools/build.js --with tools/fixtures/mons → debug_mons.html).
//   RPG.monsDebug.party(T)                       quick game at tier T with the standard party (tier gear, LZ(T)+1)
//   RPG.monsDebug.group(zone, T, i, {max, golden}) start a battle with group #i of `zone` at tier T (counts at max)
//   RPG.monsDebug.widest()                        the group with the most pixels / bodies over all zones × tiers
//   RPG.monsDebug.longestNames()                  the longest names (normal + golden) among the regular monsters
(function (R) {
  'use strict';
  const DB = R.DB;
  const PX = { s: 32, m: 48, l: 64 };
  function resolve(ref, T) {
    if (ref[0] !== '@') return ref;
    const L = DB.lineages[ref.slice(1)];
    let r = null;
    for (const s of L.stages) if (s.tier <= T) r = s.mon;
    return r;
  }
  function eligible(z, T) {
    return z.groups.filter((g) => !(g.tierMin != null && T < g.tierMin) && !(g.tierMax != null && T > g.tierMax) &&
      g.mons.every(([r]) => resolve(r, T)));
  }
  // §11 region table: the world backdrop of each region (zones with bg:null use the field's terrain in play)
  const WORLD_BG = { prologue: 'grass', r_forest: 'forest', r_desert: 'desert', r_snow: 'snow', r_marsh: 'swamp', r_isles: 'beach',
    r_mine: 'hills', r_ash: 'ashland', r_star: 'grass', finale: 'grass', postgame: 'oblivion' };
  function bgOf(z) { return z.bg || WORLD_BG[z.region] || 'grass'; }
  function width(s) { let w = 0; for (const ch of s) w += ch.charCodeAt(0) < 0x100 ? 0.5 : 1; return w; }
  function goldenName(m) { return m.goldName || (width(m.name) <= 5 ? '金色の' + m.name : '金の' + m.name); }
  R.monsDebug = {
    async party(T) {
      const LZ = 6 + 6 * T;
      await R.debug.quickStart({ tier: T, level: LZ + 1, gear: 'tier', companions: ['brigitta', 'marta', 'sylvain'], noEncounter: true });
      R.debug.heal();
      return R.Game.party.map((c) => c.name + ' Lv' + c.level);
    },
    /** zone group #i at tier T; o.max (default true) = every count at its maximum; o.golden = first monster golden */
    group(zone, T, i, o) {
      o = o || {};
      const z = DB.encounters[zone];
      const g = eligible(z, T)[i];
      if (!g) return 'no group ' + i;
      const mons = g.mons.map(([r, a, b]) => [resolve(r, T), o.max === false ? a : b]);
      // the engine rolls golden individuals only in zone battles → search a seed whose zone battle leads with this species
      if (o.golden) return this.goldenZone(zone, T, mons[0][0]);
      R.Battle.start({ mons, tier: z.tier === 'dyn' ? T : z.tier, lvOff: z.lvOff || 0, bg: bgOf(z), noRare: true, noGolden: true });
      return JSON.stringify(mons);
    },
    /** zone battle whose first monster is `want`, made golden (golden:'force'); seeds are searched so it is reproducible */
    goldenZone(zone, T, want) {
      for (let seed = 1; seed < 400; seed++) {
        R.U.seed(seed);
        const g = R.Mon.zoneGroup(zone, T);
        const ids = g ? R.Mon.buildList(g.mons, T) : [];
        if (ids[0] === want) { R.U.seed(seed); R.Battle.start({ zone, tier: T, golden: 'force', noRare: true }); R.U.unseed(); return seed; }
      }
      return 'not found';
    },
    /** battle with explicit monsters (for name / layout worst cases) */
    mons(list, T, bg) { R.Battle.start({ mons: list, tier: T == null ? 4 : T, bg: bg || 'grass', noRare: true, noGolden: true }); return JSON.stringify(list); },
    widest() {
      let best = null;
      for (const [zid, z] of Object.entries(DB.encounters)) {
        const Ts = z.tier === 'dyn' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [z.tier];
        for (const T of Ts) eligible(z, T).forEach((g, i) => {
          const ms = g.mons.map(([r, , b]) => [resolve(r, T), b]);
          const px = ms.reduce((s, [id, n]) => s + PX[DB.monsters[id].size] * n, 0);
          const n = ms.reduce((s, [, k]) => s + k, 0);
          if (!best || px * 10 + n > best.px * 10 + best.n) best = { zone: zid, T, i, px, n, ms };
        });
      }
      return best;
    },
    longestNames() {
      const reg = Object.entries(DB.monsters).filter(([, m]) => m && m.lineage);
      const byName = reg.slice().sort((a, b) => width(b[1].name) - width(a[1].name)).slice(0, 4).map(([id, m]) => [id, m.name]);
      const byGold = reg.filter(([, m]) => !(m.flags || []).includes('metal')).sort((a, b) => width(goldenName(b[1])) - width(goldenName(a[1]))).slice(0, 4).map(([id, m]) => [id, goldenName(m)]);
      return { byName, byGold };
    },
  };
})(window.RPG);
