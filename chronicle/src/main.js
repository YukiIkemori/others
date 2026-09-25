// Boot: wires modules together once every file has loaded.
// Systems register startup work with R.onBoot(fn) (called in order, after the
// engine & fonts are ready, before the title screen).
(function (R) {
  'use strict';

  function isTouch() {
    const s = R.Settings.touchPad;
    if (s === 'on') return true;
    if (s === 'off') return false;
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  }
  R.applyTouchSetting = function () {
    document.getElementById('game').classList.toggle('touch', isTouch());
    fit();
  };

  function fit() {
    const game = document.getElementById('game');
    const cv = document.getElementById('screen');
    const pad = document.getElementById('touchpad');
    let w = window.innerWidth, h = window.innerHeight;
    const touch = game.classList.contains('touch');
    const landscape = w > h;
    if (touch && !landscape && pad) h -= Math.max(170, pad.offsetHeight || 0);
    let s = Math.min(w / R.W, h / R.H);
    if (s >= 2) s = Math.max(2, Math.floor(s * 2) / 2); // prefer clean half-steps when large
    cv.style.width = Math.floor(R.W * s) + 'px';
    cv.style.height = Math.floor(R.H * s) + 'px';
  }
  R.fit = fit;

  R.boot = async function () {
    if (R._booted) return;
    R._booted = true;
    R.Save.loadSettings();
    const game = document.getElementById('game');
    const canvas = document.getElementById('screen');
    R.Input.init(game);
    R.applyTouchSetting();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 200));
    R.Engine.start(canvas);

    // Wait (briefly) for the pixel font so the title never flashes a fallback.
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.race([document.fonts.load('32px "DotGothic16"', 'あア亜A'), new Promise((r) => setTimeout(r, 2500))]);
      }
    } catch (e) { /* offline: fallback font */ }

    // Audio can only start after a user gesture.
    R.Input.onAnyPress(() => { try { R.Audio && R.Audio.init && R.Audio.init(); } catch (e) { console.error(e); } });

    R.runDataHooks();
    for (const fn of R._bootHooks) {
      try { await fn(); } catch (e) { console.error('boot hook failed', e); }
    }
    if (R.loadErrors.length) console.error('LOAD ERRORS:\n' + R.loadErrors.join('\n'));

    if (R.Title && R.Title.start) R.Title.start();
    else {
      // placeholder until the title system exists
      const L = new R.Layer();
      L.opaque = true;
      L.draw = () => { R.Gfx.clear('#000'); R.Gfx.text(R.TITLE, 128, 100, { align: 'center', size: 16 }); };
      R.Engine.push(L);
    }
    R.emit('booted');
  };

  if (document.readyState === 'complete') setTimeout(R.boot, 0);
  else window.addEventListener('load', R.boot);
})(window.RPG);
