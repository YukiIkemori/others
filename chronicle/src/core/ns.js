// ルミナス・クロニクル — core namespace & utilities.
// Every source file is wrapped in an IIFE and only *registers* things on RPG at
// load time. Nothing may touch the DOM or another module's runtime state at
// load time; cross-module wiring happens in RPG.boot() (src/main.js).
(function () {
  'use strict';
  const R = (window.RPG = window.RPG || {});

  R.VERSION = '0.1.0';
  R.TITLE = 'ルミナス・クロニクル';
  R.SUBTITLE = '〜八つの伝承〜'; // final wording: DESIGN.md §10
  R.COPYRIGHT = '© Studio Metem';
  R.PARTY_MAX = 4;
  R.W = 256; // logical screen width (SFC)
  R.H = 224; // logical screen height (SFC)
  R.TILE = 16;
  // Backing canvas = 1024x896 (4 device px per logical px). UI layers draw
  // with a 4x transform; the field picks its own integer scale (4/3/2 device
  // px per map px, Settings.fieldZoom) so it can show more of the world.
  R.SCALE = 4;
  R.FPS = 60;

  // Central data registry. Data/art/audio/map/event files fill these with
  // Object.assign(R.DB.xxx, {...}). See DESIGN.md for every schema.
  R.DB = R.DB || {};
  for (const k of [
    'tiles', 'legends', 'themes', 'decor', 'config', 'heroTypes', 'companions', 'weaponTypes',
    'elements', 'statuses', 'actions', 'items', 'pools', 'shops', 'monsters', 'lineages',
    'encounters', 'troops', 'rareEncounters', 'regions', 'locations', 'objectives', 'maps',
    'events', 'music', 'sfx', 'battlebg', 'rumors', 'starterKit',
  ]) R.DB[k] = R.DB[k] || {};

  // Load-time error collection (build.js wraps every file in try/catch).
  R.loadErrors = R.loadErrors || [];

  // ---------------------------------------------------------------- RNG
  // Math.random by default; tools/sim can call R.U.seed(n) for determinism.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const U = (R.U = {
    rng: Math.random,
    seed(n) { U.rng = mulberry32(n >>> 0); },
    unseed() { U.rng = Math.random; },
    /** float in [0,1) */
    r() { return U.rng(); },
    /** float in [a,b) */
    rf(a, b) { return a + (b - a) * U.rng(); },
    /** int in [a,b] inclusive */
    ri(a, b) { return a + Math.floor(U.rng() * (b - a + 1)); },
    /** true with probability p (0..1) */
    chance(p) { return U.rng() < p; },
    /** 1 in n */
    oneIn(n) { return n <= 1 || U.rng() * n < 1; },
    pick(arr) { return arr[Math.floor(U.rng() * arr.length)]; },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(U.rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    /** pick from [{w:number,...}] (or key given) by weight */
    weighted(arr, key = 'w') {
      let total = 0;
      for (const e of arr) total += e[key] || 0;
      let x = U.rng() * total;
      for (const e of arr) { x -= e[key] || 0; if (x < 0) return e; }
      return arr[arr.length - 1];
    },
    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); },
    /** direction helpers: 'up'|'down'|'left'|'right' */
    DIRS: ['down', 'left', 'right', 'up'],
    DX: { up: 0, down: 0, left: -1, right: 1 },
    DY: { up: -1, down: 1, left: 0, right: 0 },
    opposite(d) { return { up: 'down', down: 'up', left: 'right', right: 'left' }[d]; },
    /** pad/format helpers for UI */
    padL(s, n, ch = ' ') { s = String(s); while (s.length < n) s = ch + s; return s; },
    /** Japanese-style number with 全角-free digits */
    num(n) { return String(Math.floor(n)); },
    /** frames -> "hh:mm" */
    playTime(frames) {
      const m = Math.floor(frames / 3600);
      return `${Math.floor(m / 60)}:${U.padL(m % 60, 2, '0')}`;
    },
  });

  // Small event bus for loose coupling (e.g. 'flag', 'mapload', 'battleEnd').
  const listeners = {};
  R.on = function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); };
  R.off = function (name, fn) {
    const l = listeners[name]; if (!l) return;
    const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  };
  R.emit = function (name, ...args) {
    const l = listeners[name]; if (!l) return;
    for (const fn of l.slice()) {
      try { fn(...args); } catch (e) { console.error('[emit ' + name + ']', e); }
    }
  };

  R.warn = function (...a) { console.warn('[RPG]', ...a); };

  // Safe audio wrappers — usable before/without the audio module.
  R.sfx = function (id) { try { if (R.Audio && R.Audio.sfx) R.Audio.sfx(id); } catch (e) { /* ignore */ } };
  R.bgm = function (id, opts) { try { if (R.Audio && R.Audio.playBGM) R.Audio.playBGM(id, opts); } catch (e) { /* ignore */ } };
  /** play a jingle (fanfare) and resolve when it ends (BGM resumes automatically) */
  R.jingle = function (id) {
    try { if (R.Audio && R.Audio.playJingle) return Promise.resolve(R.Audio.playJingle(id)); } catch (e) { /* ignore */ }
    return Promise.resolve();
  };

  // Boot hooks (see main.js)
  R._bootHooks = R._bootHooks || [];
  R.onBoot = function (fn) { R._bootHooks.push(fn); };

  // Data post-processing hooks: derive tables from registered data (e.g. expand
  // lineages into monsters). Run exactly once, after every file has loaded, both
  // in the browser (main.js, before onBoot) and in node tools (tools/lib/load.js),
  // so tools and the game always see the same data. Must not touch the DOM.
  R._dataHooks = R._dataHooks || [];
  R.onData = function (fn) { R._dataHooks.push(fn); };
  R.runDataHooks = function () {
    if (R._dataHooksRan) return;
    R._dataHooksRan = true;
    for (const fn of R._dataHooks) {
      try { fn(R); } catch (e) { R.loadErrors.push('onData hook: ' + (e && e.stack || e)); console.error('data hook failed', e); }
    }
  };
})();
