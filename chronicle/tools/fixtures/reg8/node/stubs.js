// Node-only stand-ins for tools/test_reg8.js (not part of the browser fixture page; build --with only
// takes the top-level *.js of tools/fixtures/reg8): battles are a short layer whose result comes from a
// script (default 'win'), sounds and jingles are recorded.
(function (R) {
  'use strict';
  const S = (R.fxReg8 = { battles: [], battleScript: [], jingles: [], sfx: [], bgm: [] });
  class FxBattle extends R.Layer {
    constructor(o) { super(); this.opaque = true; this.o = o; this.t = 0; }
    update() { if (++this.t > 12) this.close(S.battleScript.length ? S.battleScript.shift() : 'win'); }
  }
  R.Battle = Object.assign(R.Battle || {}, {
    start(o) {
      S.battles.push(R.U.clone(o));
      return R.Engine.run(new FxBattle(o)).then((res) => {
        if (res === 'lose') for (const c of R.Game.party) c.hp = 0;
        R.Battle.last = { result: res, troop: o.troop || null, zone: o.zone || null, killed: [], glimmers: [] };
        return res;
      });
    },
  });
  R.Audio = {
    sfx: (id) => S.sfx.push(id), playBGM: (id) => S.bgm.push(id), stopBGM() {}, pushBGM() {}, popBGM() {},
    playJingle: (id) => { S.jingles.push(id); return R.Engine.wait(3); }, duck() {}, current: null,
  };
})(window.RPG);
