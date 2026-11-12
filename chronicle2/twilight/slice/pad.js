// Controller support, laid out as in the old game (chronicle/v2/src/core/input.js).
// The game listens to the keyboard only, so the pad is turned into the same keys:
//   d-pad / left stick -> arrows
//   right face button (1) -> Z: decide, talk        bottom face button (0) -> X: back, and held while walking: run
//       (PAD.confirm = 'down' swaps the two: the setting "決定ボタンの位置")
//   top face button (3) and Start (9) -> C: menu     left face button (2) -> V (the old game's map; nothing here yet)
//   L (4) -> Q: repeat on / off in battle            R (5) -> E: the battle's speed
// The key hints on screen show the pad's own names while the pad is in use and go back to the keys as soon as a real
// key is pressed.
(function () {
  'use strict';
  const DIR = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight' }, FIRST = 260, NEXT = 70, DEAD = .3;
  const OCT = [['ArrowRight'], ['ArrowRight', 'ArrowDown'], ['ArrowDown'], ['ArrowLeft', 'ArrowDown'], ['ArrowLeft'], ['ArrowLeft', 'ArrowUp'], ['ArrowUp'], ['ArrowRight', 'ArrowUp']];
  // which family of names a pad shows (from Gamepad.id; unknown pads count as Xbox)
  const kind = id => { const s = String(id || '').toLowerCase(); return /045e|xbox|xinput/.test(s) ? 'xb' : /054c|playstation|dualshock|dualsense|wireless controller|\bps[345]\b/.test(s) ? 'ps' : /057e|nintendo|pro controller|joy-con/.test(s) ? 'nin' : 'xb'; };
  const NAMES = { xb: ['A', 'B', 'X', 'Y', 'LB', 'RB'], ps: ['×', '○', '□', '△', 'L1', 'R1'], nin: ['B', 'A', 'Y', 'X', 'L', 'R'] };
  const SAVE = 'twilight.pad.confirm';
  let confirm = 'right'; try { if (localStorage.getItem(SAVE) === 'down') confirm = 'down'; } catch (e) {}
  const held = new Map();          // key -> time of the next repeat
  let using = false, type = 'xb', blocked = false, tLabel = 0;
  const send = (name, key, repeat) => window.dispatchEvent(new KeyboardEvent(name, { key, bubbles: true, cancelable: true, repeat: !!repeat }));
  const okBtn = () => (confirm === 'down' ? 0 : 1), backBtn = () => (confirm === 'down' ? 1 : 0);
  function keysOf(p) {
    const b = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > .5)), want = new Set();
    for (const i in DIR) if (b(i)) want.add(DIR[i]);
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (!want.size && Math.hypot(ax, ay) > DEAD) for (const k of OCT[(Math.round(Math.atan2(ay, ax) / (Math.PI / 4)) + 8) % 8]) want.add(k);
    if (b(okBtn())) want.add('z');
    if (b(backBtn())) want.add('x');
    if (b(3) || b(9)) want.add('c');
    if (b(2)) want.add('v');
    if (b(4)) want.add('q');
    if (b(5)) want.add('e');
    return want;
  }
  function label(on) {
    document.body.classList.toggle('pad', on);
    const n = NAMES[type], map = { Z: n[okBtn()], X: n[backBtn()], C: n[3], V: n[2], Q: n[4], E: n[5] };
    for (const el of document.querySelectorAll('.keycap, #promptKey')) {
      if (el.dataset.k == null) el.dataset.k = el.textContent;
      const k = el.dataset.k, t = on ? (/←/.test(k) ? 'スティック' : map[k] || k) : k;
      if (el.textContent !== t) el.textContent = t;
    }
  }
  function tick(now) {
    requestAnimationFrame(tick);
    if (blocked) return;
    let pads; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { blocked = true; console.warn('controller: this page is not allowed to read it', e); return; }
    const want = new Set(); let p0 = null;
    for (const p of pads) if (p && p.connected) { const w = keysOf(p); if (w.size && !p0) p0 = p; for (const k of w) want.add(k); }
    if (want.size && (!using || kind(p0.id) !== type)) { using = true; type = kind(p0.id); tLabel = 0; }
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
  window.PAD = { get using() { return using; }, get blocked() { return blocked; },
    get confirm() { return confirm; }, set confirm(v) { confirm = v === 'down' ? 'down' : 'right'; try { localStorage.setItem(SAVE, confirm); } catch (e) {} tLabel = 0; } };
})();
