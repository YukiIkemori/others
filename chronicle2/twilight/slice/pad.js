// Controller support.  The game listens to the keyboard only, so the pad is turned into the same keys:
//   left stick / d-pad -> arrows      bottom face button -> Z (decide, talk)      right face button -> X (menu, back)
//   the other two face buttons and Start -> X      R1 / R2 -> Shift (run) and F (battle speed)      L1 / L2 -> R (repeat in battle)
// On a Nintendo pad decide and back are swapped, so that A decides there too.  The key hints on screen show the pad's own
// names while the pad is in use and go back to the keys as soon as a real key is pressed.
(function () {
  'use strict';
  const DIR = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' }, FIRST = 340, NEXT = 105, DEAD = .5;
  const kind = id => /057e|nintendo|switch|joy-?con|pro controller/i.test(id) ? 'nin' : /054c|sony|dualsense|dualshock|playstation|^wireless controller/i.test(id) ? 'ps' : 'xb';
  const NAMES = { xb: { Z: 'A', X: 'B', Shift: 'RB', R: 'LB', F: 'RB' }, nin: { Z: 'A', X: 'B', Shift: 'R', R: 'L', F: 'R' }, ps: { Z: '×', X: '○', Shift: 'R1', R: 'L1', F: 'R1' } };
  const held = new Map();          // key -> time of the next repeat
  let using = false, type = 'xb', blocked = false, tLabel = 0;
  const send = (name, key, repeat) => window.dispatchEvent(new KeyboardEvent(name, { key, bubbles: true, cancelable: true, repeat: !!repeat }));
  function keysOf(p) {
    const b = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > .5)), want = new Set(), nin = kind(p.id) === 'nin';
    for (const i in DIR) if (b(i)) want.add(DIR[i]);
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (Math.hypot(ax, ay) > DEAD) { if (ax < -.38) want.add('ArrowLeft'); if (ax > .38) want.add('ArrowRight'); if (ay < -.38) want.add('ArrowUp'); if (ay > .38) want.add('ArrowDown'); }
    if (b(nin ? 1 : 0)) want.add('z');
    if (b(nin ? 0 : 1) || b(2) || b(3) || b(9)) want.add('x');
    if (b(5) || b(7)) { want.add('Shift'); want.add('f'); }
    if (b(4) || b(6)) want.add('r');
    return want;
  }
  function label(on) {
    document.body.classList.toggle('pad', on);
    for (const el of document.querySelectorAll('.keycap, #promptKey')) {
      if (el.dataset.k == null) el.dataset.k = el.textContent;
      const k = el.dataset.k, t = on ? (/←/.test(k) ? 'スティック' : NAMES[type][k] || k) : k;
      if (el.textContent !== t) el.textContent = t;
    }
  }
  function tick(now) {
    requestAnimationFrame(tick);
    if (blocked) return;
    let pads; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { blocked = true; console.warn('controller: this page is not allowed to read it', e); return; }
    const want = new Set(); let p0 = null;
    for (const p of pads) if (p && p.connected) { const w = keysOf(p); if (w.size && !p0) p0 = p; for (const k of w) want.add(k); }
    if (want.size && !using) { using = true; type = kind(p0.id); tLabel = 0; }
    for (const k of [...held.keys()]) if (!want.has(k)) { held.delete(k); send('keyup', k); }
    for (const k of want) {
      if (!held.has(k)) { held.set(k, now + FIRST); send('keydown', k); }
      else if (/^Arrow/.test(k) && now >= held.get(k)) { held.set(k, now + NEXT); send('keydown', k, true); }      // menus move on while the stick is held
    }
    if (using && now > tLabel) { tLabel = now + 400; label(true); }      // (new hints appear with every screen)
  }
  addEventListener('keydown', e => { if (e.isTrusted && using) { using = false; label(false); } }, true);
  addEventListener('blur', () => { for (const k of [...held.keys()]) { held.delete(k); send('keyup', k); } });
  requestAnimationFrame(tick);
  window.PAD = { get using() { return using; }, get blocked() { return blocked; } };
})();
