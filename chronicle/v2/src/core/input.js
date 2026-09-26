// Input（CORE）: キーボード・パッド・タッチ・マウスを論理ボタンにまとめる（V2_PLAN §2.5.2、MODERN_UI §1.3・§3.8・§8.4）
//
// R.Input.BTN = ['a','b','x','y','l','r','start','up','down','left','right']（＋内部の 'dash'）
// キーボード: Z/Enter/Space＝A、X/Esc/Backspace＝B、C/Tab＝Y（メニュー）、V＝X、Q/E＝L/R、P＝start、
//            矢印・WASD＝十字、Shift＝ダッシュ（B を押しながら移動も可、A2。どちらにするかは FIELD）
// パッド（標準配置）: 決定は右（ボタン 1、既定）か下（ボタン 0、設定 confirmButton）、Y＝3、X＝2、L/R＝4/5、start＝9、十字＝12〜15、左スティック
// タッチ: キャンバスの上に操作パッドを描く（R.Input.touchLayout('field'|'menu'|'battle'|'none')）。
//         'field' はスティック（左下）＋A/B（右下）＋メニュー（右上）、'menu'・'battle' は「戻る」だけ（ほかは直接タップ）
// マウス: 論理座標のポインタ、右クリック＝B、ホイール
(function (R) {
  'use strict';
  const BTN = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'up', 'down', 'left', 'right'];
  const ALL = BTN.concat(['dash']);
  const KEYMAP = {
    KeyZ: 'a', Enter: 'a', NumpadEnter: 'a', Space: 'a',
    KeyX: 'b', Escape: 'b', Backspace: 'b',
    KeyC: 'y', Tab: 'y', KeyV: 'x', KeyQ: 'l', KeyE: 'r', KeyP: 'start',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    ShiftLeft: 'dash', ShiftRight: 'dash',
  };
  const KB_LABEL = { a: 'Z', b: 'X', x: 'V', y: 'C', l: 'Q', r: 'E', start: 'P', up: '↑', down: '↓', left: '←', right: '→', dash: 'Shift' };
  const PAD_LABEL = { x: 'X', y: 'Y', l: 'L', r: 'R', start: '＋', up: '↑', down: '↓', left: '←', right: '→', dash: 'B' };
  const TOUCH_LABEL = { a: 'タップ', b: '戻る', y: 'メニュー', x: '長押し', l: 'L', r: 'R', start: 'メニュー', up: '↑', down: '↓', left: '←', right: '→', dash: '長押し' };
  const REPEAT_DELAY = 260, REPEAT_RATE = 70, LONG_MS = 450;

  const src = { key: {}, pad: {}, touch: {}, test: {}, pulse: {} };
  const held = {}, prev = {}, heldMs = {}, repAt = {}, repNow = {};
  const consumed = {};
  let stick = { x: 0, y: 0 }; // パッドのスティックとタッチのスティック（-1〜1）
  let padStick = { x: 0, y: 0 }, touchStick = { x: 0, y: 0 };
  let anyCbs = [];
  let layoutName = 'none';
  const ptr = { x: 0, y: 0, down: false, pressed: false, released: false, longPress: false, wheel: 0, type: 'mouse' };
  const pev = { down: false, up: false, wheel: 0, x: 0, y: 0, downAt: 0, sx: 0, sy: 0, longFired: false, moved: false, id: null };
  const tp = { active: new Map() }; // pointerId → 'stick'|'a'|'b'|'y'

  const Input = (R.Input = {
    BTN,
    enabled: true,
    lastDevice: 'kb',
    pointer: ptr,
    down(b) { return !!held[b]; },
    pressed(b) { return !!held[b] && !prev[b] && !consumed[b]; },
    released(b) { return !held[b] && !!prev[b]; },
    /** 押した瞬間と、260 ms 後から 70 ms ごと */
    repeat(b) { return Input.pressed(b) || !!repNow[b]; },
    /** -1/0/1 の {dx, dy}。十字・スティック・タッチのスティック */
    dir8() {
      let dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (!dx && !dy && (stick.x || stick.y)) {
        const m = Math.hypot(stick.x, stick.y);
        if (m > 0.3) {
          const ang = Math.atan2(stick.y, stick.x);
          const oct = Math.round(ang / (Math.PI / 4));
          const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
          [dx, dy] = dirs[(oct + 8) % 8];
        }
      }
      return { dx, dy };
    },
    /** 押したままの物も含めて、このフレームの押下を飲み込む（閉じた窓の A が下の場面に漏れない）。btn を渡すとそれだけ */
    consume(btn) {
      if (btn) { consumed[btn] = true; repNow[btn] = false; return; }
      for (const b of ALL) { if (held[b]) consumed[b] = true; repNow[b] = false; }
      ptr.pressed = false; ptr.longPress = false;
    },
    /** ボタン表示: {kind:'pad'|'kb'|'touch', label}。パッドは決定ボタンの設定で A/B の文字を入れ替える（位置を合わせる） */
    prompt(btn) {
      const d = Input.lastDevice;
      if (d === 'pad') {
        const down = R.Settings && R.Settings.get && R.Settings.get('confirmButton') === 'down';
        if (btn === 'a') return { kind: 'pad', label: down ? 'B' : 'A' };
        if (btn === 'b') return { kind: 'pad', label: down ? 'A' : 'B' };
        return { kind: 'pad', label: PAD_LABEL[btn] || btn };
      }
      if (d === 'touch') return { kind: 'touch', label: TOUCH_LABEL[btn] || btn };
      return { kind: 'kb', label: KB_LABEL[btn] || btn };
    },
    /** タッチの操作パッドの形。'field'|'menu'|'battle'|'none' */
    touchLayout(name) { layoutName = name || 'none'; tp.active.clear(); src.touch = {}; touchStick = { x: 0, y: 0 }; },
    get layoutName() { return layoutName; },
    /** 操作パッドを出すか（設定 touchPad: auto はタッチで触ったら・粗いポインタの端末なら） */
    touchVisible() {
      const s = R.Settings && R.Settings.get ? R.Settings.get('touchPad') : 'auto';
      if (s === 'off' || layoutName === 'none') return false;
      if (s === 'on') return true;
      return Input.lastDevice === 'touch' || !!(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches && Input.lastDevice !== 'kb' && Input.lastDevice !== 'pad');
    },
    /** 操作パッドの部品の位置（論理座標） */
    touchSpots() {
      const u = R.uiScale || 1, s = R.safe || { l: 0, t: 0, r: 0, b: 0 }, W = R.W, H = R.H;
      if (layoutName === 'field') {
        return {
          stick: { x: s.l + 100 * u, y: H - s.b - 110 * u, r: 58 * u },
          a: { x: W - s.r - 64 * u, y: H - s.b - 124 * u, r: 36 * u },
          b: { x: W - s.r - 146 * u, y: H - s.b - 72 * u, r: 32 * u },
          y: { x: W - s.r - 48 * u, y: s.t + 48 * u, r: 26 * u },
        };
      }
      if (layoutName === 'menu' || layoutName === 'battle') return { b: { x: s.l + 44 * u, y: H - s.b - 44 * u, r: 26 * u } };
      return {};
    },
    /** 部品の位置を CSS のクライアント座標で（shot.js の --touch 台本が使う） */
    touchSpot(name) {
      const sp = Input.touchSpots()[name];
      const cv = R.Gfx && R.Gfx.canvas;
      if (!sp || !cv) return null;
      const r = cv.getBoundingClientRect(), k = r.width / R.W;
      return { x: r.left + sp.x * k, y: r.top + sp.y * k, r: sp.r * k };
    },
    /** 次の物理的な押下で一度だけ呼ぶ（音の解錠） */
    onAnyPress(cb) { anyCbs.push(cb); },
    /** テスト用: ボタンの状態を決める */
    _set(b, v) { src.test[b] = !!v; },
    _stick(x, y) { padStick = { x, y }; },

    update(dt) {
      pollPad();
      stick = Math.hypot(touchStick.x, touchStick.y) > Math.hypot(padStick.x, padStick.y) ? touchStick : padStick;
      for (const b of ALL) {
        prev[b] = held[b];
        held[b] = Input.enabled && !!(src.key[b] || src.pad[b] || src.touch[b] || src.test[b] || src.pulse[b]);
        if (!held[b]) consumed[b] = false;
        repNow[b] = false;
        if (held[b]) {
          heldMs[b] = prev[b] ? (heldMs[b] || 0) + dt : 0;
          if (!prev[b]) repAt[b] = REPEAT_DELAY;
          else if (heldMs[b] >= repAt[b]) { repNow[b] = !consumed[b]; repAt[b] += REPEAT_RATE; }
        } else heldMs[b] = 0;
      }
      src.pulse = {};
      // ポインタ
      ptr.pressed = pev.down; ptr.released = pev.up; ptr.wheel = pev.wheel;
      pev.down = false; pev.up = false; pev.wheel = 0;
      ptr.x = pev.x; ptr.y = pev.y;
      ptr.longPress = false;
      if (ptr.down && !pev.longFired && !pev.moved && R.Engine && R.Engine.time - pev.downAt >= LONG_MS) { pev.longFired = true; ptr.longPress = true; }
    },

    init(canvas) {
      const isField = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      window.addEventListener('keydown', (e) => {
        if (isField(e.target)) return;
        fireAny(); setDevice('kb');
        const b = KEYMAP[e.code];
        if (!b) return;
        src.key[b] = true;
        e.preventDefault();
      });
      window.addEventListener('keyup', (e) => {
        if (isField(e.target)) return;
        const b = KEYMAP[e.code];
        if (!b) return;
        src.key[b] = false;
        e.preventDefault();
      });
      window.addEventListener('blur', () => { src.key = {}; src.touch = {}; tp.active.clear(); touchStick = { x: 0, y: 0 }; });
      const toLogical = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * R.W, y: (e.clientY - r.top) / r.height * R.H };
      };
      const target = document;
      target.addEventListener('pointerdown', (e) => {
        fireAny();
        setDevice(e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse');
        const p = toLogical(e);
        if (e.pointerType === 'mouse' && e.button === 2) { src.pulse.b = true; return; }
        const hit = Input.touchVisible() ? hitSpot(p) : null;
        if (hit) { tp.active.set(e.pointerId, hit); applyTouch(e.pointerId, p); e.preventDefault(); return; }
        pev.down = true; pev.x = p.x; pev.y = p.y; pev.sx = p.x; pev.sy = p.y; pev.downAt = R.Engine ? R.Engine.time : 0;
        pev.longFired = false; pev.moved = false; pev.id = e.pointerId; ptr.down = true; ptr.type = e.pointerType;
      }, { passive: false });
      target.addEventListener('pointermove', (e) => {
        const p = toLogical(e);
        if (tp.active.has(e.pointerId)) { applyTouch(e.pointerId, p); return; }
        if (e.pointerType === 'mouse' && Input.lastDevice !== 'mouse' && Math.hypot(p.x - pev.x, p.y - pev.y) > 2) setDevice('mouse');
        pev.x = p.x; pev.y = p.y;
        if (ptr.down && Math.hypot(p.x - pev.sx, p.y - pev.sy) > 8) pev.moved = true;
      });
      const up = (e) => {
        if (tp.active.has(e.pointerId)) { tp.active.delete(e.pointerId); refreshTouch(); return; }
        if (pev.id === e.pointerId || e.pointerType === 'mouse') { if (ptr.down) pev.up = true; ptr.down = false; }
      };
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
      target.addEventListener('contextmenu', (e) => e.preventDefault());
      target.addEventListener('wheel', (e) => { pev.wheel += e.deltaY; }, { passive: true });
      if (R.Engine && R.Engine.overlay) R.Engine.overlay('touchpad', drawTouch, 90);
    },
  });

  function setDevice(d) {
    if (Input.lastDevice === d) return;
    Input.lastDevice = d;
    R.emit('device', d);
  }
  function fireAny() {
    if (!anyCbs.length) return;
    const l = anyCbs; anyCbs = [];
    for (const cb of l) { try { cb(); } catch (e) { console.error(e); } }
  }
  function hitSpot(p) {
    const sp = Input.touchSpots();
    for (const k of Object.keys(sp)) {
      const s = sp[k], r = k === 'stick' ? s.r * 1.7 : s.r * 1.25;
      if (Math.hypot(p.x - s.x, p.y - s.y) <= r) return k;
    }
    return null;
  }
  function applyTouch(id, p) {
    const k = tp.active.get(id);
    if (k === 'stick') {
      const s = Input.touchSpots().stick;
      if (!s) return;
      let x = (p.x - s.x) / s.r, y = (p.y - s.y) / s.r;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      touchStick = { x, y };
    }
    refreshTouch();
  }
  function refreshTouch() {
    src.touch = {};
    let st = false;
    for (const k of tp.active.values()) { if (k === 'stick') st = true; else src.touch[k] = true; }
    if (!st) touchStick = { x: 0, y: 0 };
  }
  function drawTouch(g) {
    if (!Input.touchVisible()) return;
    const sp = Input.touchSpots();
    const on = (k) => [...tp.active.values()].includes(k);
    g.save();
    for (const k of Object.keys(sp)) {
      const s = sp[k];
      g.globalAlpha = on(k) ? 0.62 : 0.4;
      g.fillStyle = 'rgba(14,16,28,0.8)';
      g.strokeStyle = 'rgba(240,228,200,0.55)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.globalAlpha = 0.9;
      if (k === 'stick') {
        g.fillStyle = 'rgba(236,201,124,0.75)';
        g.beginPath(); g.arc(s.x + touchStick.x * s.r * 0.55, s.y + touchStick.y * s.r * 0.55, s.r * 0.42, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#f6f0e3';
        g.font = `700 ${Math.round(s.r * 0.62)}px ${R.Gfx.FONT.jp}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(k === 'y' ? '≡' : k === 'b' && layoutName !== 'field' ? '戻' : k.toUpperCase(), s.x, s.y + 1);
      }
    }
    g.restore();
  }

  function pollPad() {
    src.pad = {};
    padStick = { x: 0, y: 0 };
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads || []) {
      if (!p) continue;
      const bt = (i) => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes || [];
      const confirm = R.Settings && R.Settings.get && R.Settings.get('confirmButton') === 'down' ? 0 : 1;
      if (bt(confirm)) src.pad.a = true;
      if (bt(1 - confirm)) src.pad.b = true;
      if (bt(2)) src.pad.x = true;
      if (bt(3)) src.pad.y = true;
      if (bt(4)) src.pad.l = true;
      if (bt(5)) src.pad.r = true;
      if (bt(9)) src.pad.start = true;
      if (bt(12)) src.pad.up = true;
      if (bt(13)) src.pad.down = true;
      if (bt(14)) src.pad.left = true;
      if (bt(15)) src.pad.right = true;
      const x = ax[0] || 0, y = ax[1] || 0;
      if (Math.hypot(x, y) > 0.3) padStick = { x, y };
      if (Object.keys(src.pad).length || Math.hypot(x, y) > 0.5) { fireAny(); setDevice('pad'); }
    }
  }
})(window.RPG);
