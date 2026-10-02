// Input（CORE）: キーボード・パッド・タッチ・マウスを論理ボタンにまとめる（V2_PLAN §2.5.2、MODERN_UI §1.3・§3.8・§8.4）
//
// R.Input.BTN = ['a','b','x','y','l','r','start','up','down','left','right']（＋内部の 'dash'）
// キーボード（既定）: Z/Enter＝A、X/Backspace＝B、C/Tab＝Y（メニュー）、V＝X、Q/E＝L/R、P＝start、
//            矢印・WASD＝十字、Shift＝ダッシュ（B を押しながら移動も可、A2。どちらにするかは FIELD）
//            割り当てに無いときだけ効く予備: Space・テンキーの Enter＝A、Esc＝B（Esc は割り当てられない。戻れなくならない）、矢印＝十字
// パッド（標準配置、既定）: 決定は右（ボタン 1、既定）か下（ボタン 0、設定 confirmButton）、Y＝3、X＝2、L/R＝4/5、start＝9、十字＝12〜15、左スティック
// 割り当ての変更（PC 版）: bindKey / clearKey / bindPad / resetBinds。保存は R.Settings.setBinds（設定の 'binds'）。
//   ぶつかったら入れ替える（前にその キー／ボタン を持っていた操作に、変える前の物を渡す）。決定・戻る・十字は 1 つは残す。
//   capture(kind, cb): 次に押した キー／ボタン を cb へ（設定の画面が使う。その間は論理ボタンを全部止める。Esc でやめる）
// ボタンの印: prompt(btn) = {kind, label, style?, index?}。パッドは最後に触ったパッドの名前（Gamepad.id）で
//   'xbox'（A が下）／'ps'（×○□△）／'nintendo'（A が右）を選ぶ。設定 padGlyphs で固定もできる。描くのは uik/prompts.js
// 全画面: F11 か Alt+Enter で R.Display.toggle()（core/display.js。論理ボタンには流さない）
// タッチ: キャンバスの上に操作パッドを描く（R.Input.touchLayout('field'|'menu'|'battle'|'none')）。
//         'field' はスティック（左下）＋A/B（右下）＋メニュー（右上）、'menu'・'battle' は「戻る」だけ（ほかは直接タップ）
// マウス: 論理座標のポインタ、右クリック＝B、ホイール
(function (R) {
  'use strict';
  const BTN = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'up', 'down', 'left', 'right'];
  const ALL = BTN.concat(['dash']);
  // 既定のキーの割り当て（操作ごとに 2 つまで。null は空き）
  const KB_DEFAULT = {
    a: ['KeyZ', 'Enter'], b: ['KeyX', 'Backspace'], x: ['KeyV', null], y: ['KeyC', 'Tab'],
    l: ['KeyQ', null], r: ['KeyE', null], start: ['KeyP', null],
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    dash: ['ShiftLeft', 'ShiftRight'],
  };
  // 割り当てのどこにも無いときだけ効く予備
  const KB_SPARE = { Space: 'a', NumpadEnter: 'a', Enter: 'a', Escape: 'b', Backspace: 'b', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  // 割り当てられないキー（Esc は受け付けのやめ、F11 は全画面、F9 はテスト用メニュー、Alt・OS のキー）
  const KB_RESERVED = ['Escape', 'F11', 'F9', 'F12', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu', 'PrintScreen', 'Pause'];
  const KB_NEED = ['a', 'b', 'up', 'down', 'left', 'right'];
  // パッド: 変えられるのは面・肩・start・ダッシュ。十字（12〜15）とホーム（16）は変えない。-1 は割り当てなし
  const PAD_REMAP = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'dash'];
  const PAD_DPAD = { up: 12, down: 13, left: 14, right: 15 };
  const PAD_RESERVED = [12, 13, 14, 15, 16];
  const PAD_NEED = ['a', 'b'];
  function padDefault() {
    const down = R.Settings && R.Settings.get && R.Settings.get('confirmButton') === 'down';
    return { a: down ? 0 : 1, b: down ? 1 : 0, x: 2, y: 3, l: 4, r: 5, start: 9, dash: -1 };
  }
  // パッドの印の字（標準配置のボタンの番号ごと）。ps の 0〜3 は字でなく形で描く（uik/prompts.js）
  const PAD_NAMES = {
    xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→', 'Guide'],
    ps: ['×', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'],
    nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', R.T('ui.input.PAD_NAMES.nintendo.9'), 'LS', 'RS', '↑', '↓', '←', '→', 'Home'],
  };
  const KEYNAME = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', NumpadEnter: 'Enter', Space: 'Space', Escape: 'Esc',
    Backspace: 'BS', Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: R.T('ui.input.KEYNAME.ShiftRight'), ControlLeft: 'Ctrl', ControlRight: R.T('ui.input.KEYNAME.ControlRight'), CapsLock: 'Caps',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backquote: '`', IntlRo: R.T('ui.input.KEYNAME.IntlRo'), IntlYen: '¥', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
    Convert: R.T('ui.input.KEYNAME.Convert'), NonConvert: R.T('ui.input.KEYNAME.NonConvert'), KanaMode: R.T('ui.input.KEYNAME.KanaMode'), NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadDecimal: 'Num.',
  };
  function keyLabel(code) {
    if (!code) return '—';
    if (KEYNAME[code]) return KEYNAME[code];
    let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit([0-9])$/.exec(code); if (m) return m[1];
    m = /^Numpad([0-9])$/.exec(code); if (m) return 'Num' + m[1];
    if (/^F[0-9]{1,2}$/.test(code)) return code;
    return code.length > 6 ? code.slice(0, 6) : code;
  }
  /** Gamepad.id から印の系統（取れなければ 'xbox'。Steam の既定もこれ） */
  function styleOf(id) {
    const s = String(id || '').toLowerCase();
    if (/045e|xbox|xinput/.test(s)) return 'xbox';
    if (/054c|playstation|dualshock|dualsense|wireless controller|\bps[345]\b/.test(s)) return 'ps';
    if (/057e|nintendo|pro controller|joy-con/.test(s)) return 'nintendo';
    return 'xbox';
  }
  let kbMap = null, padMap = null, KEYMAP = {};
  let capture = null;                 // {kind, cb, t}
  const swallowKey = new Set(), swallowPad = new Set();
  let padPrevRaw = [];
  let padStyleSeen = null, padIdSeen = '';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  /** 保存された割り当て（R.Settings.getBinds）から、効く表を作り直す */
  function rebuild() {
    const b = (R.Settings && R.Settings.getBinds && R.Settings.getBinds()) || {};
    kbMap = clone(KB_DEFAULT);
    if (b.kb) {
      const used = new Set();
      for (const k of ALL) if (b.kb[k]) { kbMap[k] = [b.kb[k][0] || null, b.kb[k][1] || null]; kbMap[k].forEach((c) => c && used.add(c)); }
      // 後の版で増えた操作（保存に無い物）は既定のうち空いているキーだけ
      for (const k of ALL) if (!b.kb[k]) kbMap[k] = KB_DEFAULT[k].map((c) => (c && !used.has(c) ? c : null));
    }
    padMap = padDefault();
    if (b.pad) for (const k of PAD_REMAP) if (Number.isInteger(b.pad[k])) padMap[k] = b.pad[k];
    KEYMAP = {};
    for (const k of ALL) for (const c of kbMap[k]) if (c && !KEYMAP[c]) KEYMAP[c] = k;
    for (const c of Object.keys(KB_SPARE)) if (!KEYMAP[c]) KEYMAP[c] = KB_SPARE[c];
  }
  function saveBinds(kind) {
    const b = (R.Settings.getBinds && R.Settings.getBinds()) || {};
    if (kind === 'kb') b.kb = JSON.stringify(kbMap) === JSON.stringify(KB_DEFAULT) ? undefined : clone(kbMap);
    if (kind === 'pad') b.pad = JSON.stringify(padMap) === JSON.stringify(padDefault()) ? undefined : clone(padMap);
    if (!b.kb) delete b.kb;
    if (!b.pad) delete b.pad;
    R.Settings.setBinds(b.kb || b.pad ? b : null);
    rebuild();
  }
  const TOUCH_LABEL = { a: R.T('ui.input.TOUCH_LABEL.a'), b: R.T('ui.input.TOUCH_LABEL.b'), y: R.T('ui.input.TOUCH_LABEL.y'), x: R.T('ui.input.TOUCH_LABEL.x'), l: 'L', r: 'R', start: R.T('ui.input.TOUCH_LABEL.start'), up: '↑', down: '↓', left: '←', right: '→', dash: R.T('ui.input.TOUCH_LABEL.dash') };
  const REPEAT_DELAY = 260, REPEAT_RATE = 70, LONG_MS = 450;

  const src = { key: {}, keyCodes: {}, pad: {}, touch: {}, test: {}, pulse: {} };
  const held = {}, prev = {}, heldMs = {}, repAt = {}, repNow = {};
  const consumed = {};
  let stick = { x: 0, y: 0 }; // パッドのスティックとタッチのスティック（-1〜1）
  let padStick = { x: 0, y: 0 }, touchStick = { x: 0, y: 0 }, testStick = { x: 0, y: 0 };
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
    /** ボタン表示: {kind:'pad'|'kb'|'touch', label, style?, index?}。パッドは今の割り当てのボタンを、パッドの系統（padStyle）の字で */
    prompt(btn) {
      const d = Input.lastDevice;
      if (!kbMap) rebuild();
      if (d === 'pad') {
        const style = Input.padStyle();
        let idx = PAD_DPAD[btn] != null ? PAD_DPAD[btn] : padMap[btn];
        if (btn === 'dash' && !(idx >= 0)) idx = padMap.b;   // ダッシュが空きなら「B を押しながら」
        if (!(idx >= 0)) return { kind: 'pad', label: '—', style, index: -1 };
        return { kind: 'pad', label: PAD_NAMES[style][idx] || String(idx), style, index: idx };
      }
      if (d === 'touch') return { kind: 'touch', label: TOUCH_LABEL[btn] || btn };
      const ks = kbMap[btn] || [];
      const code = ks[0] || ks[1] || null;
      return { kind: 'kb', label: code ? keyLabel(code) : String(btn).toUpperCase(), code };
    },
    /** 今のパッドの印の系統: 'xbox'|'ps'|'nintendo'（設定 padGlyphs が 'auto' なら最後に触ったパッドの名前から） */
    padStyle() {
      const s = R.Settings && R.Settings.get ? R.Settings.get('padGlyphs') : 'auto';
      if (s && s !== 'auto' && PAD_NAMES[s]) return s;
      return padStyleSeen || 'xbox';
    },
    styleOf,
    keyLabel,
    padLabel(index, style) { return (PAD_NAMES[style || Input.padStyle()] || PAD_NAMES.xbox)[index] || (index >= 0 ? String(index) : '—'); },
    get padId() { return padIdSeen; },
    KB_DEFAULT, PAD_REMAP, KB_RESERVED,
    /** 今の割り当て {kb:{btn:[code|null, code|null]}, pad:{btn:index}}（写し） */
    bindings() { if (!kbMap) rebuild(); return { kb: clone(kbMap), pad: clone(padMap) }; },
    /** キーを割り当てる。→ {ok, reason?:'reserved'|'need'|'bad', moved?:{btn, slot, code}}（moved = 入れ替えで前の物を渡した先） */
    bindKey(btn, slot, code) {
      if (!kbMap) rebuild();
      if (!kbMap[btn] || (slot !== 0 && slot !== 1) || typeof code !== 'string' || !/^[A-Za-z0-9]{1,24}$/.test(code)) return { ok: false, reason: 'bad' };
      if (KB_RESERVED.includes(code)) return { ok: false, reason: 'reserved' };
      if (kbMap[btn][slot] === code) return { ok: true };
      const old = kbMap[btn][slot];
      let moved = null;
      for (const k of ALL) {
        const j = kbMap[k].indexOf(code);
        if (j < 0) continue;
        if (k === btn) { kbMap[btn][j] = old; moved = old ? { btn, slot: j, code: old } : null; break; }
        const next = kbMap[k].slice(); next[j] = old;
        if (KB_NEED.includes(k) && !next.some(Boolean)) { rebuild(); return { ok: false, reason: 'need', other: k }; }
        kbMap[k] = next;
        moved = { btn: k, slot: j, code: old };
        break;
      }
      kbMap[btn][slot] = code;
      saveBinds('kb');
      return { ok: true, moved };
    },
    /** キーを外す（決定・戻る・十字は最後の 1 つを外せない） */
    clearKey(btn, slot) {
      if (!kbMap) rebuild();
      if (!kbMap[btn] || !kbMap[btn][slot]) return { ok: false, reason: 'bad' };
      const next = kbMap[btn].slice(); next[slot] = null;
      if (KB_NEED.includes(btn) && !next.some(Boolean)) return { ok: false, reason: 'need', other: btn };
      kbMap[btn] = next;
      saveBinds('kb');
      return { ok: true };
    },
    /** パッドのボタンを割り当てる（index -1 で外す）。→ {ok, reason?, moved?:{btn, index}} */
    bindPad(btn, index) {
      if (!kbMap) rebuild();
      if (!PAD_REMAP.includes(btn) || !Number.isInteger(index) || index < -1 || index > 31) return { ok: false, reason: 'bad' };
      if (PAD_RESERVED.includes(index)) return { ok: false, reason: 'reserved' };
      const old = padMap[btn];
      if (old === index) return { ok: true };
      if (index < 0 && PAD_NEED.includes(btn)) return { ok: false, reason: 'need', other: btn };
      let moved = null;
      if (index >= 0) {
        for (const k of PAD_REMAP) {
          if (k === btn || padMap[k] !== index) continue;
          if (PAD_NEED.includes(k) && !(old >= 0)) return { ok: false, reason: 'need', other: k };
          padMap[k] = old; moved = { btn: k, index: old };
        }
      }
      padMap[btn] = index;
      saveBinds('pad');
      return { ok: true, moved };
    },
    /** 既定に戻す。kind = 'kb' | 'pad' | 省略（両方） */
    resetBinds(kind) {
      if (!kind || kind === 'kb') kbMap = clone(KB_DEFAULT);
      if (!kind || kind === 'pad') padMap = padDefault();
      const b = (R.Settings.getBinds && R.Settings.getBinds()) || {};
      if (!kind || kind === 'kb') delete b.kb;
      if (!kind || kind === 'pad') delete b.pad;
      R.Settings.setBinds(b.kb || b.pad ? b : null);
      rebuild();
    },
    /** 次に押した物を cb へ: kind 'kb' → {code}、'pad' → {index}、Esc（とパッドの受け付けで B 相当のキー）→ {cancel:true}。その間、論理ボタンは止まる */
    capture(kind, cb) { capture = { kind, cb, t: R.Engine ? R.Engine.time : 0 }; src.key = {}; src.keyCodes = {}; },
    cancelCapture() { const c = capture; capture = null; if (c) try { c.cb({ cancel: true }); } catch (e) { console.error(e); } },
    get capturing() { return capture ? capture.kind : null; },
    /** テスト用: キーの押下を入れる（本物の keydown と同じ道） */
    _key(code, down, mods) { onKey(Object.assign({ code, type: down ? 'keydown' : 'keyup', target: null, preventDefault() {}, repeat: false }, mods || {})); },
    /** テスト用: パッドを差す（null で外す）。{id, buttons:[bool…], axes:[…]} */
    _pad(p) { testPad = p; },
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
    _stick(x, y) { testStick = { x, y }; },

    update(dt) {
      pollPad();
      stick = Math.hypot(touchStick.x, touchStick.y) > Math.hypot(padStick.x, padStick.y) ? touchStick : padStick;
      if (Math.hypot(testStick.x, testStick.y) > Math.hypot(stick.x, stick.y)) stick = testStick;
      for (const b of ALL) {
        prev[b] = held[b];
        held[b] = Input.enabled && !capture && !!(src.key[b] || src.pad[b] || src.touch[b] || src.test[b] || src.pulse[b]);
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
      rebuild();
      window.addEventListener('keydown', (e) => { if (!isField(e.target)) onKey(e); });
      window.addEventListener('keyup', (e) => { if (!isField(e.target)) onKey(e); });
      window.addEventListener('blur', () => { src.key = {}; src.keyCodes = {}; swallowKey.clear(); src.touch = {}; tp.active.clear(); touchStick = { x: 0, y: 0 }; });
      const toLogical = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * R.W, y: (e.clientY - r.top) / r.height * R.H };
      };
      const target = document;
      target.addEventListener('pointerdown', (e) => {
        // 文字の欄（合言葉の textarea など）の上の押しはゲームに流さない（右クリックが B＝戻るになり、貼り付けようとして画面が閉じた。テスター 2026-10-02 P1）
        if (isField(e.target)) return;
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
      target.addEventListener('contextmenu', (e) => { if (!isField(e.target)) e.preventDefault(); });   // 文字の欄では右クリックの「貼り付け」を使える
      target.addEventListener('wheel', (e) => { pev.wheel += e.deltaY; }, { passive: true });
      if (R.Engine && R.Engine.overlay) R.Engine.overlay('touchpad', drawTouch, 90);
    },
  });

  // 割り当てが変わったら表を作り直す（node のテストでも効くよう、読み込み時に登録だけ）
  R.on('settings', (e) => {
    if (!e) return;
    if (e.key === 'confirmButton') {
      // 自分で変えたパッドの割り当てがあれば、決定と戻るを入れ替える（無ければ既定が決定の位置に付いてくる）
      const b = R.Settings.getBinds && R.Settings.getBinds();
      if (b && b.pad) { const t = b.pad.a; b.pad.a = b.pad.b; b.pad.b = t; R.Settings.setBinds(b); }
    }
    if (e.key === 'binds' || e.key === 'confirmButton' || e.key === '*') rebuild();
  });
  let testPad = null;
  function onKey(e) {
    if (!kbMap) rebuild();
    const down = e.type === 'keydown';
    if (down) { fireAny(); setDevice('kb'); }
    if (capture && capture.kind === 'kb' && down) {
      if (e.preventDefault) e.preventDefault();
      if (e.repeat) return;
      const c = capture;
      if (e.code === 'Escape') { capture = null; c.cb({ cancel: true }); return; }
      if (KB_RESERVED.includes(e.code) || !e.code) return;
      capture = null; swallowKey.add(e.code);
      try { c.cb({ code: e.code }); } catch (err) { console.error(err); }
      return;
    }
    if (capture && capture.kind === 'pad' && down) {
      if (e.preventDefault) e.preventDefault();
      if (e.code === 'Escape' || KEYMAP[e.code] === 'b') { const c = capture; capture = null; swallowKey.add(e.code); c.cb({ cancel: true }); }
      return;
    }
    // 全画面の切り替え（論理ボタンには流さない）
    if (down && (e.code === 'F11' || (e.altKey && (e.code === 'Enter' || e.code === 'NumpadEnter')))) {
      if (e.preventDefault) e.preventDefault();
      if (!e.repeat && R.Display && R.Display.toggle) R.Display.toggle();
      return;
    }
    if (!down) swallowKey.delete(e.code);
    else if (swallowKey.has(e.code)) { if (e.preventDefault) e.preventDefault(); return; }
    if (e.altKey && down) return;   // Alt と一緒の物は OS・ブラウザの物
    const b = KEYMAP[e.code];
    if (!b) return;
    if (down) {
      src.key[b] = true;
      // 1 フレームより短い押下（重いフレームの間に押して離した）も落とさない: 次の update で 1 フレームだけ押した扱い
      if (!e.repeat) src.pulse[b] = true;
      (src.keyCodes[b] = src.keyCodes[b] || new Set()).add(e.code);
    } else {
      // 同じ操作の別のキーを押したままなら離さない
      const set = src.keyCodes[b];
      if (set) set.delete(e.code);
      if (!set || !set.size) src.key[b] = false;
    }
    if (e.preventDefault) e.preventDefault();
  }
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
        g.fillText(k === 'y' ? '≡' : k === 'b' && layoutName !== 'field' ? R.T('ui.input.drawTouch.fillText') : k.toUpperCase(), s.x, s.y + 1);
      }
    }
    g.restore();
  }

  function pollPad() {
    src.pad = {};
    padStick = { x: 0, y: 0 };
    if (!padMap) rebuild();
    let pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    if (testPad) pads = [testPad];
    let pi = -1;
    for (const p of pads || []) {
      pi++;
      if (!p) continue;
      const bt = (i) => i >= 0 && p.buttons[i] && (p.buttons[i].pressed || p.buttons[i] === true);
      const ax = p.axes || [];
      const prevRaw = padPrevRaw[pi] || [];
      const raw = [];
      let anyRaw = false;
      for (let i = 0; i < (p.buttons || []).length; i++) { raw[i] = !!bt(i); if (raw[i]) anyRaw = true; if (!raw[i]) swallowPad.delete(pi + ':' + i); }
      padPrevRaw[pi] = raw;
      if (anyRaw || Math.hypot(ax[0] || 0, ax[1] || 0) > 0.5) {
        if (p.id !== padIdSeen) { padIdSeen = p.id || ''; padStyleSeen = styleOf(p.id); if (Input.lastDevice === 'pad') R.emit('device', 'pad'); }
      }
      if (capture && capture.kind === 'pad') {
        for (let i = 0; i < raw.length; i++) {
          if (!raw[i] || prevRaw[i] || PAD_RESERVED.includes(i)) continue;
          const c = capture; capture = null; swallowPad.add(pi + ':' + i);
          fireAny(); setDevice('pad');
          try { c.cb({ index: i, id: p.id }); } catch (e) { console.error(e); }
          break;
        }
        continue;
      }
      const on = (i) => bt(i) && !swallowPad.has(pi + ':' + i);
      for (const k of PAD_REMAP) if (padMap[k] >= 0 && on(padMap[k])) src.pad[k] = true;
      for (const k of Object.keys(PAD_DPAD)) if (on(PAD_DPAD[k])) src.pad[k] = true;
      const x = ax[0] || 0, y = ax[1] || 0;
      if (Math.hypot(x, y) > 0.3) padStick = { x, y };
      if (Object.keys(src.pad).length || Math.hypot(x, y) > 0.5) { fireAny(); setDevice('pad'); }
    }
  }
})(window.RPG);
