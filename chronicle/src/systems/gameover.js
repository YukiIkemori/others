// Game over (DESIGN §11.7.17, §4.12.2): a black screen where twelve scraps of white paper drift down
// (the 「白紙」 mood), 「{hero}たちは全滅した……。」 in the middle and the gameover jingle (A/B skips after
// 80 frames, at most 420). Then R.State.wipeRecover() (half the gold, everyone healed), the warp to the
// last town (R.Field.respawn) and 「{hero}たちは目を覚ました。」「所持金が半分になった。」 (the second line
// only when there was gold). When run() resolves the §4.12.2 invariants hold (no layer of ours, no
// message window, no fade, input on, auto off, 香 gone).
//   await R.GameOver.run()
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const GameOver = (R.GameOver = R.GameOver || {});

  const TEXT = '{hero}たちは全滅した……。';
  const PIECES = 12;
  // a tiny local generator: the scraps must not consume the game's seeded R.U random numbers
  function scraps() {
    let s = 20250925;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const out = [];
    for (let i = 0; i < PIECES; i++) {
      out.push({
        x: 12 + (i * 232) / PIECES + rnd() * 14,
        y: -8 + rnd() * 200, // already drifting all over the screen when the text fades in
        v: 0.18 + rnd() * 0.22, // px per frame
        amp: 3 + rnd() * 6,
        ph: rnd() * Math.PI * 2,
        w: 0.018 + rnd() * 0.02, // sway speed
        tw: rnd() < 0.5, // a scrap that turns shows 1px tall now and then
      });
    }
    return out;
  }
  GameOver.scraps = scraps;

  class GameOverLayer extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.t = 0;
      this.canSkip = false;
      this.alpha = 1;
      this.pieces = scraps();
    }
    tick() {
      this.t++;
      for (const p of this.pieces) {
        p.y += p.v;
        if (p.y > R.H + 4) { p.y = -6; p.ph += 1.7; }
      }
    }
    update() {
      if (this.canSkip && (In().pressed('a') || In().pressed('b'))) { this.canSkip = false; if (this.onSkip) this.onSkip(); }
    }
    draw() {
      G().clear('#000000');
      const c = G().ctx;
      // the paper scraps (2×2, white 60%)
      c.globalAlpha = 0.6 * Math.min(1, this.t / 40);
      for (const p of this.pieces) {
        const x = Math.round(p.x + Math.sin(this.t * p.w + p.ph) * p.amp);
        const flat = p.tw && Math.sin(this.t * p.w * 2 + p.ph) > 0.7;
        G().rect(x, Math.round(p.y), 2, flat ? 1 : 2, '#ffffff');
      }
      const k = Math.min(1, this.t / 60) * this.alpha;
      c.globalAlpha = k;
      G().text(TEXT, R.W / 2, 100, { align: 'center', color: '#ffffff' });
      c.globalAlpha = 1;
    }
  }
  GameOver.Layer = GameOverLayer;

  let running = null; // the live GameOverLayer
  /**
   * R.UI.say that also resolves when someone else closes the window (an onEnter event of the
   * respawn map when run() is called outside Field's wipe flow) — run() must never hang (§4.12.2).
   * → true when the player read it and closed it, false when it was closed or replaced by someone else.
   */
  function sayGuarded(text) {
    return new Promise((res) => {
      let done = false;
      let m = null;
      const fin = (read) => { if (!done) { done = true; res(read); } };
      // read = the say settled and its own window closed (A/B); a say that settles while the window
      // stays open was replaced by another say (UI.say settles a superseded say)
      R.UI.say(text, { noWait: false, keep: false, auto: 0 }).then(() => fin(!m || (!!m.closed && R.UI.msgSettled(m))), () => fin(false));
      m = R.UI.msgOpen();
      const poll = () => {
        if (done) return;
        // a window its reader closed has settled its say (finish() clears resolveText before close());
        // one closed from outside (closeMessage) released it unread (msgSettled → false)
        if (!m || m.closed || !R.Engine.layers.includes(m)) { fin(!!(m && m.closed && R.UI.msgSettled(m))); return; }
        R.Engine.wait(1).then(poll);
      };
      R.Engine.wait(1).then(poll);
    });
  }
  const eventsBusy = () => !!(R.Events && typeof R.Events.busy === 'function' && R.Events.busy());
  /**
   * the wake-up lines must be seen (STYLE_JA §9): when an event of the respawn map closes or replaces
   * them (run() called outside Field's wipe flow), they are shown once more after that event is over
   */
  async function wakeUp(text) {
    if (await sayGuarded(text)) return;
    for (let f = 0; f < 3600 && eventsBusy(); f++) await R.Engine.wait(1);
    if (R.UI && R.UI.closeMessage && R.UI.msgOpen() && R.UI.msgSettled()) R.UI.closeMessage();
    await sayGuarded(text);
  }
  GameOver._wakeUp = wakeUp;
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
      // wait for the jingle (A/B skips once it has had a moment), at most 420 frames in all
      await new Promise((res) => {
        let done = false;
        const fin = () => { if (!done) { done = true; res(); } };
        L.canSkip = true;
        L.onSkip = fin;
        Promise.resolve(jingle).then(() => R.Engine.wait(60)).then(fin);
        R.Engine.wait(340).then(fin);
      });
      L.canSkip = false;
      for (let i = 20; i >= 0; i--) { L.alpha = i / 20; await R.Engine.wait(1); }
      const goldBefore = R.Game.gold;
      R.State.wipeRecover();
      R.Game.encItem = null;
      await R.Engine.fadeOut(1);
      R.Engine.remove(L);
      if (R.Field && R.Field.respawn) await R.Field.respawn();
      else if (R.Field && R.Field.warp && R.Game.respawn) {
        const r = R.Game.respawn;
        await R.Field.warp(r.map, r.x != null ? { x: r.x, y: r.y, dir: r.dir } : r.spawn || 'entrance');
      }
      if (R.Engine.fadeAlpha > 0) await R.Engine.fadeIn(20);
      let text = '{hero}たちは目を覚ました。';
      if (goldBefore > 0) text += '\n所持金が半分になった。';
      await wakeUp(text);
    } finally {
      R.Engine.remove(L);
      if (R.UI && R.UI.closeMessage) R.UI.closeMessage();
      if (R.Engine.fadeAlpha > 0 && !R.Engine._fade) R.Engine.fade(0, 0);
      R.Engine.paused = false;
      if (R.Input) R.Input.enabled = true;
      if (R.Battle) R.Battle.autoCarry = false;
      if (R.Game) R.Game.encItem = null;
      if (running === L) running = null;
    }
  };
  GameOver.isRunning = () => !!(running && R.Engine.layers.includes(running));
})(window.RPG);
