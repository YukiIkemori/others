// A12 browser fixture (debug_boss.html: node tools/build.js --with tools/fixtures/boss).
// Helpers to put a boss fight on screen for tools/shot.js:
//   RPG.bossShots.start('tr_b_lavabeast', {tier: 4, level: 40})   quick start at that tier, party level, battle
//   RPG.bossShots.near(0.52)          put the troop's boss at 52 % HP (the next hit crosses a phase line)
//   RPG.bossShots.auto(4)             switch the running battle to オート at engine speed ×4
//   RPG.bossShots.kill('b_root')      knock out the living monsters with that id (summons / revives follow)
//   RPG.bossShots.rare('rm_star_whale', {tier: 4})   start the rare-monster encounter of that monster's zone
//   RPG.bossShots.state()             {round, mons:[{id, hp, mhp}], party:[…]} of the running battle
(function (R) {
  'use strict';
  const S = (R.bossShots = {});
  const eng = () => (R.Battle && R.Battle.current && R.Battle.current.eng) || null;
  S.start = function (troop, o) {
    o = o || {};
    if (R.debug && R.debug.quickStart) R.debug.quickStart({ tier: o.tier != null ? o.tier : 0 });
    if (o.level && R.debug.level) R.debug.level(o.level);
    if (R.debug.heal) R.debug.heal();
    return R.debug.battle(troop);
  };
  S.near = function (frac, id) {
    const e = eng();
    if (!e) return 'no battle';
    const m = e.mons.find((u) => u.alive && (id ? u.id === id : u.d && u.d.bossType && u.d.bossType !== 'add'));
    if (!m) return 'no boss';
    m.hp = Math.max(1, Math.round(m.mhp * frac));
    return { id: m.id, hp: m.hp, mhp: m.mhp };
  };
  S.auto = function (speed) {
    const sc = R.Battle && R.Battle.current;
    if (!sc) return 'no battle';
    sc.auto = true; sc.autoCancel = false;
    if (speed) R.Engine.speed = speed;
    return true;
  };
  S.kill = function (id) {
    const e = eng();
    if (!e) return 'no battle';
    let n = 0;
    for (const m of e.mons) if (m.alive && m.id === id) { m.hp = 1; n++; }
    return n;
  };
  S.rare = function (mon, o) {
    o = o || {};
    if (R.debug && R.debug.quickStart) R.debug.quickStart({ tier: o.tier || 0 });
    const zone = Object.keys(R.DB.rareEncounters).find((z) => R.DB.rareEncounters[z].mon === mon);
    return R.Events.run((ev) => ev.battle({ zone, rare: 'force' }), { self: 'debug' });
  };
  S.state = function () {
    const e = eng();
    if (!e) return null;
    return { round: e.round, mons: e.mons.map((m) => ({ id: m.id, hp: m.hp, mhp: m.mhp, alive: m.alive })), party: e.party.map((p) => ({ hp: p.hp, mhp: p.mhp })) };
  };
})(window.RPG);
