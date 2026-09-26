// reg-5 (R5) visual tour fixture: jump straight into any マレア諸島 map in a chosen story state, for
// screenshots and hand checks. Loaded only through `node tools/build.js --with tools/fixtures/reg5`
// (→ debug_reg5.html). Examples:
//   node tools/shot.js --html debug_reg5.html --size 1100x960 \
//     --eval "RPG.Reg5Tour.go('nerei', 'pier', 'ship')" --wait 1500 --out /tmp/nerei_ship.png
//   RPG.Reg5Tour.go('coral', {x: 30, y: 22}, 'after', {zoom: 'wider'})
//   RPG.Reg5Tour.scene('night')   // plays nerei_marina_song from the pier state (press A to advance)
//   RPG.Reg5Tour.scene('dawn')    // plays ghost_ship_3_boss with the battle stubbed to a win
// States: 'start' (nothing), 'drake' (isles_start), 'marina' (+ isles_marina), 'mid' (+ isles_mid),
//         'shell' (+ k_shanty), 'ship' (+ isles_ship), 'fine' (+ isles_fine), 'after' (r_isles cleared),
//         'tier4' (after + tier 4: the scribe), 'post' (after + game clear).
(function (R) {
  'use strict';
  const STATES = {
    start: [],
    drake: ['isles_start'],
    marina: ['isles_start', 'isles_marina'],
    mid: ['isles_start', 'isles_marina', 'isles_mid'],
    shell: ['isles_start', 'isles_marina', 'isles_mid', 'isles_shell', 'item:k_shanty'],
    ship: ['isles_start', 'isles_marina', 'isles_mid', 'isles_shell', 'item:k_shanty', 'isles_ship', 'isles_deck'],
    fine: ['isles_start', 'isles_marina', 'isles_mid', 'isles_shell', 'item:k_shanty', 'isles_ship', 'isles_deck', 'isles_fine'],
  };
  function apply(list) {
    for (const f of list) {
      if (f.startsWith('item:')) R.debug.give(f.slice(5), 1);
      else R.debug.flag(f, true);
    }
  }
  R.Reg5Tour = {
    STATES: Object.keys(STATES).concat(['after', 'tier4', 'post']),
    async go(map, spawn, state, o) {
      o = o || {};
      if (o.zoom && R.Settings) R.Settings.fieldZoom = o.zoom;
      const st = state || 'start';
      const tier = st === 'tier4' ? 4 : st === 'after' || st === 'post' ? 1 : 0;
      await R.debug.quickStart({ map: 'lute', spawn: 'inn' }); // flags first, then the map (its onEnter sees them)
      R.debug.noEncounter(true);
      if (tier) {
        // clear r_isles (and, for tier 4, three more regions) without the chapter scene
        const order = ['r_isles', 'r_forest', 'r_desert', 'r_snow'].slice(0, tier);
        for (const id of order) { if (R.Tier && R.Tier.clear) R.Tier.clear(id); }
        apply(STATES.fine.concat(['isles_boss', 'nerei_marina_reward']));
        if (st === 'post') { R.Game.gameClear = true; R.debug.flag('game_clear', true); }
      } else apply(STATES[st] || []);
      await R.debug.warp(map, spawn || 'entrance');
      if (R.Engine) R.Engine.error = null;
      return R.debug.pos();
    },
    async scene(which) {
      if (which === 'night') {
        await R.Reg5Tour.go('nerei', 'inn', 'shell');
        return R.debug.event('nerei_marina_song');
      }
      if (which === 'dawn') {
        await R.Reg5Tour.go('ghost_ship_3', { x: 7, y: 12, dir: 'up' }, 'fine');
        R.Battle.start = async () => 'win';
        return R.debug.event('ghost_ship_3_boss');
      }
      return null;
    },
  };
})(window.RPG);
