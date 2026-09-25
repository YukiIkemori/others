// Field test harness only: a stand-in R.Battle when the battle system is absent.
// Shows the zone/troop for ~40 frames and returns RPG.fxBattleResult ('win' default).
(function (R) {
  'use strict';
  if (R.Battle && R.Battle.start) return;
  R.fxBattleLog = [];
  R.Battle = {
    start(opts) {
      R.fxBattleLog.push(opts);
      const L = new R.Layer();
      L.opaque = true;
      let t = 0;
      L.update = () => { if (++t > 40) L.close(R.fxBattleResult || 'win'); };
      L.draw = () => {
        R.Gfx.clear('#200010');
        R.Gfx.text('BATTLE ' + (opts.troop || opts.zone) + ' bg:' + opts.bg, 20, 100);
      };
      return R.Engine.run(L).then((res) => {
        if (res === 'lose') for (const c of R.Game.party) c.hp = 0;
        return res;
      });
    },
  };
})(window.RPG);
