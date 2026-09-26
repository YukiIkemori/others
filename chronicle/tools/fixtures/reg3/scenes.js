// R3 fixture: in-game scenes for screenshots. RPG.r3Scene(name) → a playable game in the state the
// scene needs, the party at the spot (drive the rest with shot.js --keys / --wait / --shot).
//   gate · hall · hall_lit · town_after · peak1 · ice · peak2 · giant · secret · rare · peak3 · fine · dragon · summit_after
(function (R) {
  'use strict';
  const S = {
    gate: { flags: [], map: 'yule', at: 'entrance' },
    hall: { flags: ['snow_start'], map: 'yule', at: { x: 26, y: 6, dir: 'up' } },
    hall_lit: { flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'], map: 'yule', at: { x: 26, y: 7, dir: 'up' } },
    town_after: { flags: ['snow_start', 'snow_flame', 'snow_mid', 'snow_fine', 'snow_boss'], items: ['k_winter_flame'], clear: true, map: 'yule', at: 'inn' },
    peak1: { flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'], map: 'frost_peak_1', at: 'entrance' },
    ice: { flags: ['snow_start'], map: 'frost_peak_1', at: { x: 22, y: 23, dir: 'up' } },
    peak2: { flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'], map: 'frost_peak_2', at: 'from_prev' },
    giant: { flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'], map: 'frost_peak_2', at: { x: 38, y: 10, dir: 'up' } },
    secret: { flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'], map: 'frost_peak_2', at: { x: 8, y: 24, dir: 'right' } },
    rare: { flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'], map: 'frost_peak_2', at: { x: 38, y: 27, dir: 'right' } },
    peak3: { flags: ['snow_start', 'snow_flame', 'snow_mid'], items: ['k_winter_flame'], map: 'frost_peak_3', at: 'from_prev' },
    fine: { flags: ['snow_start', 'snow_flame', 'snow_mid'], items: ['k_winter_flame'], map: 'frost_peak_3', at: { x: 18, y: 12, dir: 'right' } },
    dragon: { flags: ['snow_start', 'snow_flame', 'snow_mid', 'snow_fine'], items: ['k_winter_flame'], map: 'frost_peak_3', at: { x: 23, y: 7, dir: 'up' } },
    summit_after: { flags: ['snow_start', 'snow_flame', 'snow_mid', 'snow_fine', 'snow_boss'], items: ['k_winter_flame'], clear: true, map: 'frost_peak_3', at: { x: 23, y: 5, dir: 'up' } },
  };
  R.r3Scene = async function (name, o) {
    const s = S[name];
    if (!s) return 'scenes: ' + Object.keys(S).join(' ');
    o = o || {};
    await R.debug.quickStart({ tier: o.tier || 0, level: o.level || 12, map: 'lute', spawn: 'inn', noEncounter: true });
    for (const f of s.flags) R.State.setFlag(f, true);
    for (const k of s.items || []) if (!R.State.hasItem(k)) R.State.addItem(k, 1);
    if (s.clear) R.debug.clearRegion('r_snow');
    if (o.tier != null) R.debug.tier(o.tier);
    await R.debug.warp(s.map, s.at);
    R.Field.noEncounter = true;
    R.Field.refresh();
    return R.debug.pos();
  };
})(window.RPG);
