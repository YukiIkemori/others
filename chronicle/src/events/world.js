// Events on the world map エルセリア (src/maps/world.js). Owner: world (A18a). DESIGN §10.5.6.
// The world has no NPCs. Its tilePatches (raised drawbridge, the fog round ビブリア島, the
// sandstorm, the marsh fog, the thaw, the forest road, Dovan's 抜け道, the ash turning to grass)
// are plain data in the map; the hidden passages are tiles (secret_forest / secret_rock).
(function (R) {
  'use strict';
  const E = R.DB.events;

  // the step in front of the raised drawbridge (42,44) while the prologue runs (cond '!prologue_done')
  E.world_bridge_closed = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('跳ね橋が上がっている。');
    },
  };
})(window.RPG);
