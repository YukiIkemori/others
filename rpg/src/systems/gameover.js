// Game over (DESIGN §6 Wipe): black screen 「全滅してしまった……」 + jingle,
// then R.State.wipeRecover() (half gold, full revive) and a warp to R.Game.respawn.
//   await R.GameOver.run()
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const GameOver = (R.GameOver = R.GameOver || {});

  let glow = null;
  function buildGlow() {
    const cv = G().makeCanvas(R.W, 104), c = cv.getContext('2d');
    c.translate(R.W / 2, 52);
    c.scale(1, 0.35);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 120);
    g.addColorStop(0, 'rgba(120,10,24,0.55)');
    g.addColorStop(1, 'rgba(60,0,10,0)');
    c.fillStyle = g;
    c.fillRect(-R.W, -160, R.W * 2, 320);
    return cv;
  }

  class GameOverLayer extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.t = 0;
      this.canSkip = false;
      this.alpha = 1;
    }
    tick() { this.t++; }
    update() {
      if (this.canSkip && (In().pressed('a') || In().pressed('b'))) { this.canSkip = false; if (this.onSkip) this.onSkip(); }
    }
    draw() {
      G().clear('#000000');
      const k = Math.min(1, this.t / 70) * this.alpha;
      if (k <= 0) return;
      // a faint dark-red glow behind the text
      if (!glow) glow = buildGlow();
      G().ctx.globalAlpha = k * 0.8;
      G().draw(glow, 0, 60);
      G().ctx.globalAlpha = k;
      G().text('全滅してしまった……', R.W / 2, 103, { align: 'center', color: '#ffffff', shadow: '#400010' });
      G().ctx.globalAlpha = 1;
    }
  }

  let running = null; // the live GameOverLayer
  /** the whole wipe sequence; resolves once the party wakes up at the respawn point */
  GameOver.run = async function () {
    if (running && R.Engine.layers.includes(running)) return;
    const L = (running = new GameOverLayer());
    if (R.Battle) R.Battle.autoCarry = false; // オート never carries over a game over
    try {
      if (R.UI && R.UI.closeMessage) R.UI.closeMessage();
      R.Engine.fade(0, 0);
      if (R.Audio && R.Audio.stopBGM) { try { R.Audio.stopBGM(20); } catch (e) { /* ignore */ } }
      R.Engine.push(L);
      const jingle = R.jingle('gameover');
      await R.Engine.wait(80);
      // wait for the jingle (A/B skips once it has had a moment), at most ~7 s
      await new Promise((res) => {
        let done = false;
        const fin = () => { if (!done) { done = true; res(); } };
        L.canSkip = true;
        L.onSkip = fin;
        Promise.resolve(jingle).then(() => R.Engine.wait(60)).then(fin);
        R.Engine.wait(420).then(fin);
      });
      L.canSkip = false;
      for (let i = 20; i >= 0; i--) { L.alpha = i / 20; await R.Engine.wait(1); }
      const goldBefore = R.Game.gold;
      R.State.wipeRecover();
      const lost = goldBefore - R.Game.gold;
      await R.Engine.fadeOut(1);
      R.Engine.remove(L);
      if (R.Field && R.Field.respawn) await R.Field.respawn();
      else if (R.Field && R.Field.warp && R.Game.respawn) {
        const r = R.Game.respawn;
        await R.Field.warp(r.map, r.x != null ? { x: r.x, y: r.y, dir: r.dir } : r.spawn || 'entrance');
      } else await R.Engine.fadeIn(20);
      if (R.Engine.fadeAlpha > 0) await R.Engine.fadeIn(20);
      const name = R.State.leader().name;
      let text = '……' + name + 'たちは目を覚ました。';
      if (lost > 0) text += '\nお金が半分になってしまった……。';
      // queued as an event (after the respawn map's onEnter, or after the event whose battle was lost) and
      // not awaited: awaiting it here, while the field is still locked by the lost battle, froze the game
      if (R.Events && R.Events.run) R.Events.run(async (ev) => { await ev.say(text); }, { defer: true, self: 'gameover' });
      else await R.UI.say(text, { noWait: false, keep: false, auto: 0 });
    } finally {
      R.Engine.remove(L);
      if (R.UI && R.UI.closeMessage) R.UI.closeMessage();
      if (running === L) running = null;
    }
  };
})(window.RPG);
