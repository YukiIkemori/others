// Fixture (art-rare A15b) for in-game screenshots of the rare monsters: loaded only into
// debug_art-rare.html by `node tools/build.js --with tools/fixtures/art-rare`.
//
//   RPG.artRare.battle('rm_bloom_fawn', {tier: 3, bg})  start a real battle against that rare
//                                                      monster on its zone's backdrop (the
//                                                      encounter table's bg, else the world
//                                                      terrain of that region; `bg` overrides)
//                                                      — does not wait for its end
//   RPG.artRare.group(['rm_bloom_fawn', 'mushroom_1'], {bg})  a battle against several monsters
//   RPG.artRare.zoneOf('rm_bloom_fawn')               → the zone id it appears in
//   RPG.artRare.state()                               where the battle is (for polling)
(function (R) {
  'use strict';
  // the world zones have no bg in DB.encounters (the world tile decides it): the usual terrain
  const WORLD_BG = { zw_prologue: 'grass', zw_forest: 'forest', zw_desert: 'desert', zw_snow: 'snow', zw_marsh: 'swamp', zw_isles: 'beach', zw_mine: 'hills', zw_ash: 'ashland', zw_star: 'grass' };
  const ensure = async (o) => {
    if (!R.Game || !R.Game.party || !R.Game.party.length) await R.debug.quickStart(Object.assign({ tier: 3 }, o || {}));
  };
  const zoneOf = (rm) => {
    const re = R.DB.rareEncounters || {};
    for (const z in re) if (re[z] && re[z].mon === rm) return z;
    return null;
  };
  const bgOf = (rm) => {
    const z = zoneOf(rm);
    const enc = z && R.DB.encounters && R.DB.encounters[z];
    return (enc && enc.bg) || WORLD_BG[z] || 'grass';
  };
  R.artRare = {
    zoneOf,
    async battle(rm, o) {
      await ensure(o);
      if (!R.DB.monsters[rm]) return 'no monster ' + rm;
      const bg = (o && o.bg) || bgOf(rm);
      R.debug.battle({ mons: [rm], bg });
      return 'started ' + rm + ' on ' + bg;
    },
    async group(ids, o) {
      await ensure(o);
      const miss = ids.filter((id) => !R.DB.monsters[id]);
      if (miss.length) return 'no monster ' + miss.join(' ');
      const rm = ids.find((id) => /^rm_/.test(id));
      const bg = (o && o.bg) || (rm ? bgOf(rm) : 'grass');
      R.debug.battle({ mons: ids, bg });
      return 'started ' + ids.join(' ') + ' on ' + bg;
    },
    state() {
      const s = R.Battle && R.Battle.scene;
      return s ? { mons: (s.eng && s.eng.mons || []).map((m) => m.d && m.d.id) } : null;
    },
  };
})(window.RPG);
