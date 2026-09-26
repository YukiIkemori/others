// R8 reg8 fixture: in-game scenes for screenshots (browser only; built into debug_reg8.html).
//   RPG.reg8Scene(name, {win, tier, level, zoom}) → starts a playable game in the state the scene needs,
//   puts the party at the spot and (optionally) starts the event. Returns right away; drive the rest with
//   shot.js --wait / --keys / --shot.
//   arrive · octavia · chart · tower1 · tower2 · tower3 · orrery · door · fine · boss · clear · after · roof
//   {win:true} replaces the battle by an instant win (to see the scenes after a boss).
(function (R) {
  'use strict';
  const PRO = ['hero_created', 'pro_start', 'pro_berna_sent', 'pro_lute', 'pro_met_rowell', 'pro_party_chosen', 'pro_key', 'pro_tutorial', 'pro_boss', 'prologue_done'];
  const SC = {
    arrive:  { flags: [], map: 'orbis', at: 'entrance' },
    octavia: { flags: ['star_start'], map: 'orbis', at: { x: 42, y: 7, dir: 'up' }, talk: 'octavia' },
    chart:   { flags: ['star_start'], map: 'orbis', at: { x: 10, y: 19, dir: 'up' }, talk: 'chart' },
    library: { flags: ['star_start'], map: 'orbis', at: { x: 10, y: 22, dir: 'up' } },
    plaza:   { flags: ['star_start'], map: 'orbis', at: { x: 25, y: 24, dir: 'up' } },
    observatory: { flags: ['star_start'], map: 'orbis', at: { x: 42, y: 23, dir: 'up' } },
    shops:   { flags: ['star_start'], map: 'orbis', at: { x: 27, y: 36, dir: 'up' } },
    tower1:  { flags: ['star_start', 'star_chart'], items: ['k_star_chart'], map: 'stargaze_1', at: 'entrance' },
    hall1:   { flags: ['star_start', 'star_chart'], items: ['k_star_chart'], map: 'stargaze_1', at: { x: 19, y: 22, dir: 'up' } },
    tower2:  { flags: ['star_start', 'star_chart'], items: ['k_star_chart'], map: 'stargaze_2', at: { x: 18, y: 19, dir: 'up' } },
    tower3:  { flags: ['star_start', 'star_chart'], items: ['k_star_chart'], map: 'stargaze_3', at: { x: 21, y: 16, dir: 'up' } },
    secret:  { flags: ['star_start', 'star_chart'], items: ['k_star_chart'], map: 'stargaze_3', at: { x: 3, y: 13, dir: 'up' } },
    orrery:  { flags: ['star_start', 'star_chart'], items: ['k_star_chart'], map: 'stargaze_3', at: { x: 21, y: 11, dir: 'up' }, run: 'stargaze_3_boss' },
    door:    { flags: ['star_start', 'star_mid'], items: [], map: 'stargaze_3', at: { x: 21, y: 7, dir: 'up' }, run: 'stargaze_3_door', trigger: 'examine' },
    fine:    { flags: ['star_start', 'star_chart', 'star_mid'], items: ['k_star_chart'], map: 'stargaze_4', at: { x: 16, y: 25, dir: 'up' }, run: 'stargaze_4_fine', once: 'star_fine' },
    boss:    { flags: ['star_start', 'star_chart', 'star_mid', 'star_fine'], items: ['k_star_chart'], map: 'stargaze_4', at: { x: 16, y: 14, dir: 'up' }, run: 'stargaze_4_boss' },
    roof:    { flags: ['star_start', 'star_chart', 'star_mid', 'star_fine'], items: ['k_star_chart'], map: 'stargaze_4', at: { x: 16, y: 17, dir: 'up' } },
    after:   { flags: ['star_start', 'star_chart', 'star_mid', 'star_fine', 'star_boss'], items: ['k_star_chart'], star: true, map: 'orbis', at: 'inn' },
    reward:  { flags: ['star_start', 'star_chart', 'star_mid', 'star_fine', 'star_boss'], items: ['k_star_chart'], star: true, map: 'orbis', at: { x: 42, y: 7, dir: 'up' }, talk: 'octavia' },
  };
  R.reg8Scene = async function (name, o) {
    o = o || {};
    const s = SC[name];
    if (!s) return 'scenes: ' + Object.keys(SC).join(' ');
    if (o.zoom != null && R.debug.zoom) R.debug.zoom(o.zoom);
    await R.debug.quickStart({ tier: o.tier || 0, level: o.level || 20, gear: 'tier', map: 'lute', spawn: 'inn', noEncounter: true });
    const g = R.Game;
    for (const f of PRO) R.State.setFlag(f, true);
    for (const f of s.flags) R.State.setFlag(f, true);
    for (const k of s.items || []) if (!R.State.hasItem(k)) R.State.addItem(k, 1);
    if (s.star) { R.debug.clearRegion('r_star'); }
    if (s.flags.includes('star_start')) { g.regionObj = g.regionObj || {}; g.regionObj.r_star = s.flags.includes('star_chart') ? 'obj_star_2' : 'obj_star_1'; }
    if (o.win) {
      R.Battle.start = function (opts) { R.Battle.last = { result: 'win', troop: opts && opts.troop }; return Promise.resolve('win'); };
    }
    await R.debug.warp(s.map, s.at);
    R.Field.noEncounter = true;
    R.Field.refresh();
    if (s.talk) { const n = R.Field.npc(s.talk); if (n) R.Events.talk(n); }
    if (s.run) R.Events.run(s.run, { trigger: s.trigger || 'step', once: s.once, self: s.map });
    return R.debug.pos();
  };
})(window.RPG);
