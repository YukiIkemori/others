// OB (oblivion) fixture: in-game scenes of 忘却の底 for screenshots (browser only; build with
//   node tools/build.js --with tools/fixtures/oblivion  → debug_oblivion.html).
//   RPG.obScene(name) → starts a post-game party (Lv 64, tier-9 gear) at the spot the scene needs and, for the
//   event scenes, starts the event; returns at once — drive the rest with shot.js --wait / --keys / --shot.
//   f1 f2 f2sand f2snow f3 f4 f4den f5          field views of each floor (no event)
//   arrive1  echo  seal  loop  dragon  won     event scenes
//   den_battle                                 a random battle in the 4F den with the rare monster forced
(function (R) {
  'use strict';
  const COMPS = ['brigitta', 'marta', 'sylvain'];
  const SC = {
    f1: { map: 'oblivion_1', at: { x: 12, y: 6, dir: 'down' }, flags: ['oblivion_1_arrival'] },
    f2: { map: 'oblivion_2', at: { x: 27, y: 12, dir: 'down' }, flags: ['oblivion_2_arrival'] },
    f2sand: { map: 'oblivion_2', at: { x: 13, y: 30, dir: 'down' }, flags: ['oblivion_2_arrival'] },
    f2snow: { map: 'oblivion_2', at: { x: 41, y: 33, dir: 'down' }, flags: ['oblivion_2_arrival'] },
    f3: { map: 'oblivion_3', at: { x: 20, y: 14, dir: 'up' }, flags: ['oblivion_3_arrival'] },
    f4: { map: 'oblivion_4', at: { x: 12, y: 16, dir: 'right' }, flags: ['oblivion_4_arrival'] },
    f4den: { map: 'oblivion_4', at: { x: 27, y: 4, dir: 'right' }, flags: ['oblivion_4_arrival'] },
    f5: { map: 'oblivion_5', at: { x: 20, y: 10, dir: 'down' }, flags: ['oblivion_5_arrival'] },
    f5ring: { map: 'oblivion_5', at: { x: 8, y: 22, dir: 'down' }, flags: ['oblivion_5_arrival'] },
    arrive1: { map: 'oblivion_1', at: { x: 10, y: 3, dir: 'down' }, run: 'oblivion_1_arrival' },
    echo: { map: 'oblivion_3', at: { x: 20, y: 10, dir: 'up' }, flags: ['oblivion_3_arrival'], run: 'oblivion_3_echo' },
    seal: { map: 'oblivion_3', at: { x: 30, y: 4, dir: 'right' }, flags: ['oblivion_3_arrival'], run: 'oblivion_3_seal' },
    opened: { map: 'oblivion_3', at: { x: 28, y: 5, dir: 'right' }, flags: ['oblivion_3_arrival', 'pg_echo'] },
    loop: { map: 'oblivion_4', at: { x: 16, y: 19, dir: 'right' }, flags: ['oblivion_4_arrival'], run: 'oblivion_4_loop' },
    dragon: { map: 'oblivion_5', at: { x: 20, y: 13, dir: 'down' }, flags: ['oblivion_5_arrival'], run: 'oblivion_5_ouroboros' },
    won: { map: 'oblivion_5', at: { x: 20, y: 17, dir: 'down' }, flags: ['oblivion_5_arrival', 'pg_ouroboros'], run: 'oblivion_5_ouroboros' },
    den_battle: { map: 'oblivion_4', at: { x: 29, y: 4, dir: 'right' }, flags: ['oblivion_4_arrival'], battle: { zone: 'z_postgame_oblivion_den', rare: 'force' } },
  };
  R.obScene = async function (name, o) {
    const s = SC[name];
    if (!s) return 'scenes: ' + Object.keys(SC).join(' ');
    o = o || {};
    await R.debug.quickStart({ companions: COMPS, tier: 8, postgame: true, level: 64, gear: 'tier', noEncounter: true });
    for (const f of s.flags || []) R.State.setFlag(f, true);
    if (o.zoom != null && R.Settings) R.Settings.fieldZoom = o.zoom;
    await R.debug.warp(s.map, s.at);
    R.Field.noEncounter = true;
    R.Field.refresh();
    if (s.run) R.Events.run(s.run, { trigger: 'step', self: s.map });
    if (s.battle) R.Battle.start(Object.assign({ bg: R.Field.battleBg(s.battle.zone) }, s.battle));
    return R.debug.pos();
  };
})(window.RPG);
