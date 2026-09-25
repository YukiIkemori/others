// Node-only stubs for tools/test_field.js (not loaded by the harness page):
// a stand-in battle that pushes a layer for a few frames and returns
// R.fxBattleResult, and recorders for sound calls.
(function (R) {
  'use strict';
  R.fxBattleLog = [];
  R.fxBattleResult = 'win';
  R.fxBattleFrames = 20;
  class FxBattleLayer extends R.Layer {
    constructor(o) { super(); this.opaque = true; this.o = o; this.t = 0; this.repeating = true; }
    update() { if (++this.t > R.fxBattleFrames) this.close(typeof R.fxBattleResult === 'function' ? R.fxBattleResult(this.o) : R.fxBattleResult); }
  }
  R.fxBattleStart = function (opts) {
    R.fxBattleLog.push(opts);
    return R.Engine.run(new FxBattleLayer(opts)).then((res) => {
      if (res === 'lose') for (const c of R.Game.party) c.hp = 0;
      else for (const c of R.Game.party) if (c.hp > 0) { try { c.hp = R.Rules.stats(c).hp; } catch (e) { /* keep */ } }
      if (R.Battle) R.Battle.last = { result: res, rounds: 1, zone: opts.zone || null, troop: opts.troop || null, killed: [], exp: 0, gold: 0, drops: [], glimmers: [], levelUps: [] };
      return res;
    });
  };
  R.fxSfx = []; R.fxJingles = []; R.fxBgm = [];
  R.Audio = {
    sfx: (id) => R.fxSfx.push(id),
    playBGM: (id) => { R.fxBgm.push(id); R.Audio.current = id; },
    stopBGM: () => { R.Audio.current = null; },
    pushBGM: () => {}, popBGM: () => {},
    playJingle: (id) => { R.fxJingles.push(id); return R.Engine.wait(R.fxJingleFrames || 4); },
    current: null,
  };
})(window.RPG);
