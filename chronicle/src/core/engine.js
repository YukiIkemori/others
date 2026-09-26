// Engine: fixed-step main loop, layer stack, fades, waits, screen shake.
//
// LAYERS. Everything on screen is a Layer on R.Engine.layers (bottom→top).
//   - update()  : called only on the TOP layer, once per frame (input lives here)
//   - tick()    : called on EVERY layer every frame (background animation only)
//   - draw()    : drawn bottom→top starting from the highest layer with opaque=true
//   - close(v)  : removes the layer and resolves the promise from Engine.run()
// Async UI:  const v = await R.Engine.run(new SomeLayer())
(function (R) {
  'use strict';

  class Layer {
    constructor() { this.opaque = false; this.closed = false; }
    update() {}
    tick() {}
    draw() {}
    onPush() {}
    onRemove() {}
    /** true while something on this layer moves smoothly between fixed steps
     *  (the engine then renders every display refresh, using Engine.alpha) */
    wantsFrame() { return false; }
    // coversScreen: set true while draw() paints every pixel (the engine then skips its clear)
    /** remove this layer and resolve Engine.run() with value */
    close(value) {
      if (this.closed) return;
      this.closed = true;
      Engine.remove(this);
      R.Input.consume();
      if (this._resolve) { const r = this._resolve; this._resolve = null; r(value); }
    }
  }
  R.Layer = Layer;

  const waits = []; // {frames, resolve}
  let acc = 0, last = 0;

  const Engine = (R.Engine = {
    layers: [],
    frame: 0, // total frames since boot (for blinking/animation)
    fadeAlpha: 0, // 0 = clear, 1 = black
    fadeColor: '#000',
    _fade: null, // {from,to,frames,t,resolve}
    _shake: { frames: 0, mag: 0 },
    flash: { frames: 0, color: '#fff', total: 1 },
    paused: false,
    error: null,
    speed: 1, // debug/test: frames simulated per real frame
    // Render interpolation: fraction (0..1) of a fixed step elapsed since the
    // last simulated frame. Layers that move things (the field) draw positions
    // at t + alpha so motion follows real time on 60/120/144 Hz displays.
    alpha: 0,

    push(layer) { Engine.layers.push(layer); layer.closed = false; layer.onPush(); return layer; },
    remove(layer) {
      const i = Engine.layers.indexOf(layer);
      if (i >= 0) { Engine.layers.splice(i, 1); layer.onRemove(); }
    },
    top() { return Engine.layers[Engine.layers.length - 1] || null; },
    /** push a layer and await its close(value) */
    run(layer) {
      return new Promise((res) => { layer._resolve = res; Engine.push(layer); });
    },
    /** remove every layer (e.g. on game over / return to title) */
    clear() {
      // `clearing`: layers removed here belong to a game that is being thrown away (title / new game /
      // load); their onRemove must not wake code of that game (a message window keeps its say() pending)
      Engine.clearing = true;
      try { for (const l of Engine.layers.slice().reverse()) { l.closed = true; Engine.remove(l); } } finally { Engine.clearing = false; }
    },
    /** resolve after n frames of game time */
    wait(frames) {
      return new Promise((res) => { if (frames <= 0) res(); else waits.push({ frames, resolve: res }); });
    },
    /** fade to black (to=1) or back (to=0) over n frames */
    fade(to, frames = 20, color = '#000') {
      Engine.fadeColor = color;
      if (Engine._fade) { const r = Engine._fade.resolve; Engine._fade = null; r(); }
      return new Promise((res) => {
        if (frames <= 0) { Engine.fadeAlpha = to; res(); return; }
        Engine._fade = { from: Engine.fadeAlpha, to, frames, t: 0, resolve: res };
      });
    },
    fadeOut(frames = 20) { return Engine.fade(1, frames); },
    fadeIn(frames = 20) { return Engine.fade(0, frames); },
    shake(frames = 20, mag = 3) { Engine._shake = { frames, mag }; },
    /** full-screen color flash (e.g. white on spell, red on crit) */
    flashScreen(color = '#fff', frames = 8) { Engine.flash = { frames, total: frames, color }; },

    start(canvas) {
      R.Gfx.init(canvas);
      last = performance.now();
      requestAnimationFrame(loop);
    },

    /** run exactly one simulation frame (also used by tests) */
    step() {
      R.Input.update();
      Engine.frame++;
      // waits
      for (let i = waits.length - 1; i >= 0; i--) {
        if (--waits[i].frames <= 0) { const w = waits[i]; waits.splice(i, 1); w.resolve(); }
      }
      // fade
      const f = Engine._fade;
      if (f) {
        f.t++;
        Engine.fadeAlpha = f.from + (f.to - f.from) * Math.min(1, f.t / f.frames);
        if (f.t >= f.frames) { Engine._fade = null; f.resolve(); }
      }
      if (Engine._shake.frames > 0) Engine._shake.frames--;
      if (Engine.flash.frames > 0) Engine.flash.frames--;
      const top = Engine.top();
      for (const l of Engine.layers.slice()) {
        try { l.tick(); } catch (e) { reportError(e); }
      }
      if (top && !top.closed) {
        try { top.update(); } catch (e) { reportError(e); }
      }
    },

    render() {
      const G = R.Gfx;
      G.reset();
      const c = G.ctx;
      const L = Engine.layers;
      let start = 0;
      for (let i = L.length - 1; i >= 0; i--) if (L[i].opaque) { start = i; break; }
      const shaking = Engine._shake.frames > 0;
      // a bottom layer that paints every pixel (the field's tile cache) makes the clear redundant
      if (shaking || !L[start] || !L[start].coversScreen) G.clear('#000');
      let sx = 0, sy = 0;
      if (shaking) {
        const m = Engine._shake.mag;
        sx = Math.round(R.U.rf(-m, m)); sy = Math.round(R.U.rf(-m, m));
        c.translate(sx, sy);
      }
      for (let i = start; i < L.length; i++) {
        try { c.save(); L[i].draw(); c.restore(); } catch (e) { c.restore(); reportError(e); }
        G.reset(); if (sx || sy) c.translate(sx, sy);
      }
      G.reset();
      if (Engine.flash.frames > 0) {
        c.globalAlpha = Engine.flash.frames / Engine.flash.total * 0.8;
        G.rect(0, 0, R.W, R.H, Engine.flash.color);
        c.globalAlpha = 1;
      }
      if (Engine.fadeAlpha > 0) {
        c.globalAlpha = Math.min(1, Engine.fadeAlpha);
        G.rect(0, 0, R.W, R.H, Engine.fadeColor);
        c.globalAlpha = 1;
      }
      if (Engine.error) drawError();
    },
  });

  // Fixed 60 Hz simulation, rendered on every display refresh that shows
  // something new. rAF timestamps jitter by a millisecond or so (coarse timers
  // in Firefox/Safari); on a 60 Hz display that used to make the accumulator
  // alternate 0 and 2 steps, i.e. a visible stall + jump. Deltas close to a
  // whole number of steps are snapped to it, so a 60 Hz display gets exactly
  // one step per refresh; faster displays (120/144 Hz) get interpolated
  // frames between steps (Engine.alpha) instead of repeated images.
  const MAX_STEPS = 5;
  const SNAP = 1.6; // ms
  function loop(now) {
    requestAnimationFrame(loop);
    if (Engine.paused) { last = now; return; }
    const dt = 1000 / R.FPS;
    let delta = Math.min(250, Math.max(0, now - last));
    last = now;
    const k = Math.round(delta / dt);
    if (k >= 1 && k <= 4 && Math.abs(delta - k * dt) < SNAP) delta = k * dt;
    acc += delta;
    let steps = 0;
    while (acc >= dt && steps < MAX_STEPS) {
      for (let j = 0; j < Engine.speed; j++) Engine.step();
      acc -= dt; steps++;
    }
    if (acc >= dt) acc = 0; // fell far behind (tab switch, long GC): don't spiral
    Engine.alpha = Math.min(0.999, acc / dt);
    if (steps > 0 || wantsFrame()) Engine.render();
  }
  function wantsFrame() {
    const L = Engine.layers;
    for (let i = L.length - 1; i >= 0; i--) {
      try { if (L[i].wantsFrame()) return true; } catch (e) { /* ignore */ }
      if (L[i].opaque) break;
    }
    return false;
  }

  function reportError(e) {
    console.error(e);
    Engine.error = { msg: String((e && e.stack) || e), frame: Engine.frame };
    R.emit('error', e);
  }
  Engine.reportError = reportError;

  // Errors are shown briefly in a corner so a playtester can report them,
  // but the game keeps running.
  function drawError() {
    const e = Engine.error;
    if (Engine.frame - e.frame > 600) { Engine.error = null; return; }
    const G = R.Gfx;
    G.rect(0, 0, R.W, 26, 'rgba(120,0,0,0.85)');
    const lines = e.msg.split('\n').slice(0, 2);
    lines.forEach((l, i) => G.text(l.slice(0, 60), 2, 1 + i * 12, { size: 8, color: '#fff' }));
  }

  window.addEventListener('error', (ev) => reportError(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
})(window.RPG);
