// A2 browser fixture (debug_battle_live.html: node tools/build.js --with tools/fixtures/battle/battle_live).
// Real engine + real scene + real data, for tools/shot.js checks of what the engine produces:
//   RPG.battleShots.zone('zw_verda', {tier: 3, level: 25, golden: 'force'})   quick start, then a zone battle
//   RPG.battleShots.metal({tier: 5})            a metal-only zone battle (the first zone group with a metal monster)
//   RPG.battleShots.glimmer('zw_verda', {…})    glimmerForce 'hero': the hero's first action glimmers
//   RPG.battleShots.drops(['normal','rare','super'])  the next victory drops one item of each listed grade
//   RPG.battleShots.finish()                    every monster at 1 HP (the next hit wins)
//   RPG.battleShots.auto(speed)                 switch the running battle to オート
//   RPG.battleShots.state()                     {round, result, mons, party, last}
(function (R) {
  'use strict';
  const S = (R.battleShots = {});
  const DB = R.DB;
  const eng = () => (R.Battle && R.Battle.current && R.Battle.current.eng) || null;
  async function boot(o) {
    await R.debug.quickStart({ tier: o.tier != null ? o.tier : 3, level: o.level || 6 + 6 * (o.tier != null ? o.tier : 3) + 1, gear: 'tier', companions: o.companions, noEncounter: true });
    if (R.debug.heal) R.debug.heal();
    if (o.middle != null && R.Game.party[o.middle]) R.Game.party[o.middle].row = 'middle';
    if (o.names) R.Game.party.forEach((c, i) => { if (o.names[i]) c.name = o.names[i]; });
  }
  S.zone = async function (zone, o) {
    o = o || {};
    await boot(o);
    if (o.seed != null) R.U.seed(o.seed);
    R.Events.run((ev) => ev.battle(Object.assign({ zone, noRare: o.rare !== 'force', noGolden: !o.golden, golden: o.golden, rare: o.rare, glimmerForce: o.glimmerForce, surprise: null }, o.battle || {})), { self: 'debug' });
    if (o.auto) autoWhenReady(o.speed);
    return zone;
  };
  /** turn オート on as soon as the scene exists (before its first command phase) */
  function autoWhenReady(speed) {
    let n = 0;
    const t = setInterval(() => {
      const sc = R.Battle && R.Battle.current;
      if (sc) { sc.auto = true; sc.autoCancel = false; if (speed) R.Engine.speed = speed; clearInterval(t); }
      else if (++n > 200) clearInterval(t);
    }, 10);
  }
  S.glimmer = function (zone, o) { return S.zone(zone, Object.assign({}, o, { glimmerForce: 'hero' })); };
  S.metal = async function (o) {
    o = o || {};
    const T = o.tier != null ? o.tier : 5;
    const metal = (id) => DB.monsters[id] && (DB.monsters[id].flags || []).includes('metal');
    for (const z in DB.encounters) {
      const zd = DB.encounters[z];
      if (typeof zd.tier === 'number' && zd.tier !== T) continue;
      const g = (R.Mon.zoneGroups ? R.Mon.zoneGroups(z, T) : zd.groups).find((x) => x.mons.every((e) => metal(R.Mon.resolve(Array.isArray(e) ? e[0] : e, T))));
      if (!g) continue;
      await boot(Object.assign({}, o, { tier: T }));
      R.Events.run((ev) => ev.battle({ mons: g.mons, tier: T, bg: zd.bg, surprise: null }), { self: 'debug' });
      return z;
    }
    return 'no metal group';
  };
  /** the next rewards drop one item per grade (the real items of the first killed monster when it has them) */
  S.drops = function (grades) {
    grades = grades || ['normal', 'rare', 'super'];
    const orig = R.Mon.rollDrops;
    R.Mon.rollDrops = function (def, opts) {
      R.Mon.rollDrops = orig;
      const dr = def.drops || {};
      const pick = (g) => {
        const s = dr[g];
        if (s && s.item && DB.items[s.item]) return s.item;
        const any = Object.keys(DB.items).find((id) => DB.items[id].grade === (g === 'normal' ? 'normal' : g) && DB.items[id].type !== 'key');
        return any;
      };
      return grades.map((g) => ({ item: pick(g), grade: g, n: 1, slot: g }));
    };
    return grades;
  };
  S.finish = function () {
    const e = eng();
    if (!e) return 'no battle';
    for (const m of e.mons) if (m.alive) m.hp = 1;
    return e.mons.length;
  };
  S.auto = function (speed) {
    const sc = R.Battle && R.Battle.current;
    if (!sc) return 'no battle';
    sc.auto = true; sc.autoCancel = false;
    if (speed) R.Engine.speed = speed;
    return true;
  };
  S.state = function () {
    const e = eng();
    return {
      last: R.Battle.last,
      battle: e ? { round: e.round, result: e.result, mons: e.mons.map((m) => ({ id: m.id, name: m.name, hp: m.hp, mhp: m.mhp, golden: m.golden })), party: e.party.map((p) => ({ name: p.name, hp: p.hp, mhp: p.mhp, row: p.row })) } : null,
    };
  };
})(window.RPG);
