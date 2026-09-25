// Input: keyboard + on-screen touch pad + gamepad, folded into virtual buttons.
// Buttons: up down left right a b dash
// Gamepad: confirm on the RIGHT face button by default (R.Settings.padConfirm = 'right'|'bottom')
//   a    = Z / Enter / Space      (confirm, talk, examine)
//   b    = X / Esc / Backspace    (cancel; on the field opens the menu)
//   dash = Shift (held)           (inverts the "always dash" setting)
(function (R) {
  'use strict';
  const BTNS = ['up', 'down', 'left', 'right', 'a', 'b', 'dash'];
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyZ: 'a', Enter: 'a', Space: 'a', NumpadEnter: 'a',
    KeyX: 'b', Escape: 'b', Backspace: 'b',
    ShiftLeft: 'dash', ShiftRight: 'dash',
  };
  const REPEAT_DELAY = 16; // frames before auto-repeat
  const REPEAT_RATE = 4; // frames between repeats

  const src = { key: {}, touch: {}, pad: {} }; // raw held state per source
  const held = {}; // merged held state this frame
  const prev = {};
  const heldFrames = {};
  let dirOrder = []; // most recently pressed direction last
  let anyPressedCb = null;

  const Input = (R.Input = {
    enabled: true,
    /** true while held */
    down(b) { return !!held[b]; },
    /** true on the frame the button went down */
    pressed(b) { return !!held[b] && !prev[b]; },
    /** pressed, or auto-repeating while held (menus) */
    repeat(b) {
      if (!held[b]) return false;
      if (!prev[b]) return true;
      const f = heldFrames[b];
      return f >= REPEAT_DELAY && (f - REPEAT_DELAY) % REPEAT_RATE === 0;
    },
    released(b) { return !held[b] && !!prev[b]; },
    /** currently held direction (last pressed wins) or null */
    dir() {
      for (let i = dirOrder.length - 1; i >= 0; i--) if (held[dirOrder[i]]) return dirOrder[i];
      return null;
    },
    /** direction pressed/repeated this frame (menus) or null */
    dirRepeat() {
      for (const d of ['up', 'down', 'left', 'right']) if (Input.repeat(d)) return d;
      return null;
    },
    /** Swallow current presses so a closing window's "A" does not leak into the layer below. */
    consume() { for (const b of BTNS) prev[b] = held[b]; },
    /** Called once per frame by the engine before update(). */
    update() {
      pollGamepad();
      for (const b of BTNS) {
        prev[b] = held[b];
        held[b] = Input.enabled && !!(src.key[b] || src.touch[b] || src.pad[b]);
        heldFrames[b] = held[b] ? (heldFrames[b] || 0) + 1 : 0;
        if (held[b] && !prev[b] && (b === 'up' || b === 'down' || b === 'left' || b === 'right')) {
          dirOrder = dirOrder.filter((d) => d !== b); dirOrder.push(b);
        }
      }
    },
    /** one-shot callback on the next physical key/tap (used to unlock audio) */
    onAnyPress(cb) { anyPressedCb = cb; },
    /** For tests/bots: force a button state. */
    _set(b, v) { src.key[b] = !!v; },
    init(container) {
      // keys typed into DOM text fields (name entry, ふっかつのじゅもん) never reach the game
      const isField = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      window.addEventListener('keydown', (e) => {
        if (isField(e.target)) return;
        fireAny();
        const b = KEYMAP[e.code] || KEYMAP[e.key];
        if (!b) return;
        src.key[b] = true;
        e.preventDefault();
      });
      window.addEventListener('keyup', (e) => {
        if (isField(e.target)) return;
        const b = KEYMAP[e.code] || KEYMAP[e.key];
        if (!b) return;
        src.key[b] = false;
        e.preventDefault();
      });
      window.addEventListener('blur', () => { src.key = {}; src.touch = {}; });
      buildTouchPad(container);
    },
  });

  function fireAny() {
    if (anyPressedCb) { const cb = anyPressedCb; anyPressedCb = null; try { cb(); } catch (e) { console.error(e); } }
  }

  function pollGamepad() {
    src.pad = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const bt = (i) => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes || [];
      if (bt(12) || ax[1] < -0.5) src.pad.up = true;
      if (bt(13) || ax[1] > 0.5) src.pad.down = true;
      if (bt(14) || ax[0] < -0.5) src.pad.left = true;
      if (bt(15) || ax[0] > 0.5) src.pad.right = true;
      // Standard mapping: 0 = bottom face, 1 = right face. Default: RIGHT confirms
      // (○ / Nintendo A, Japanese style); the setting can swap to bottom (× / Xbox A).
      const confirmBtn = R.Settings && R.Settings.padConfirm === 'bottom' ? 0 : 1;
      if (bt(confirmBtn)) src.pad.a = true;
      if (bt(1 - confirmBtn) || bt(9)) src.pad.b = true;
      if (bt(2) || bt(5)) src.pad.dash = true;
      if (Object.keys(src.pad).length) fireAny();
    }
  }

  // ------------------------------------------------------------ touch pad
  function buildTouchPad(container) {
    const pad = document.createElement('div');
    pad.id = 'touchpad';
    pad.innerHTML = `
      <div class="tp-dpad">
        <div class="tp-btn tp-up" data-b="up"></div>
        <div class="tp-btn tp-left" data-b="left"></div>
        <div class="tp-center"></div>
        <div class="tp-btn tp-right" data-b="right"></div>
        <div class="tp-btn tp-down" data-b="down"></div>
      </div>
      <div class="tp-ab">
        <div class="tp-btn tp-b" data-b="b">B</div>
        <div class="tp-btn tp-a" data-b="a">A</div>
      </div>`;
    container.appendChild(pad);
    const dpad = pad.querySelector('.tp-dpad');
    const active = new Map(); // pointerId -> button

    function btnAt(x, y) {
      // D-pad: pick by angle from its center so sliding the thumb works.
      const r = dpad.getBoundingClientRect();
      if (x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 20 && y <= r.bottom + 20) {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = x - cx, dy = y - cy;
        if (Math.hypot(dx, dy) < r.width * 0.12) return null;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      }
      const el = document.elementFromPoint(x, y);
      return el && el.dataset && el.dataset.b && (el.dataset.b === 'a' || el.dataset.b === 'b') ? el.dataset.b : null;
    }
    function refresh() {
      src.touch = {};
      for (const b of active.values()) if (b) src.touch[b] = true;
      pad.querySelectorAll('.tp-btn').forEach((el) => el.classList.toggle('on', !!src.touch[el.dataset.b]));
    }
    pad.addEventListener('pointerdown', (e) => {
      fireAny();
      e.preventDefault();
      pad.setPointerCapture && pad.setPointerCapture(e.pointerId);
      active.set(e.pointerId, btnAt(e.clientX, e.clientY));
      refresh();
    });
    pad.addEventListener('pointermove', (e) => {
      if (!active.has(e.pointerId)) return;
      const cur = active.get(e.pointerId);
      // only directions slide; A/B stay latched until release
      if (cur === 'a' || cur === 'b') return;
      active.set(e.pointerId, btnAt(e.clientX, e.clientY));
      refresh();
    });
    const up = (e) => { active.delete(e.pointerId); refresh(); };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    // Tapping the canvas itself counts as "any press" (audio unlock) and as A on title.
    container.addEventListener('pointerdown', () => fireAny());
  }
})(window.RPG);
