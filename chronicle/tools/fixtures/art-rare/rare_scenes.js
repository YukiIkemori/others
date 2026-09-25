// Fixture (art-rare A15b) for in-game screenshots of the rare monsters: loaded only into
// debug_art-rare.html by `node tools/build.js --with tools/fixtures/art-rare`.
//
//   RPG.artRare.battle('rm_bloom_fawn', {tier: 3})   start a real battle against that rare
//                                                      monster (does not wait for its end)
//   RPG.artRare.group(['rm_bloom_fawn', 'mushroom_1'])  a battle against several monsters
//   RPG.artRare.state()                               where the battle is (for polling)
(function (R) {
  'use strict';
  const ensure = async (o) => {
    if (!R.Game || !R.Game.party || !R.Game.party.length) await R.debug.quickStart(Object.assign({ tier: 3 }, o || {}));
  };
  R.artRare = {
    async battle(rm, o) {
      await ensure(o);
      if (!R.DB.monsters[rm]) return 'no monster ' + rm;
      R.debug.battle({ mons: [rm] });
      return 'started ' + rm;
    },
    async group(ids, o) {
      await ensure(o);
      const miss = ids.filter((id) => !R.DB.monsters[id]);
      if (miss.length) return 'no monster ' + miss.join(' ');
      R.debug.battle({ mons: ids });
      return 'started ' + ids.join(' ');
    },
    state() {
      const s = R.Battle && R.Battle.scene;
      return s ? { mons: (s.eng && s.eng.mons || []).map((m) => m.d && m.d.id) } : null;
    },
  };
})(window.RPG);
