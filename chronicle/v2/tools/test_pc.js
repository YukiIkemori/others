// PC 版（Steam の基本）の node のテスト: 置き場の抽象（ブラウザ／ファイル／メモリ・引っ越し）、キーとボタンの割り当て（保存・ぶつかり・既定）、
// ボタンの印の切り替え（Gamepad.id・設定）、全画面の切り替えのキー、デスクトップ版の store.js
//   node v2/tools/test_pc.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const load = require('./lib/load');

(async function main() {
  // ================================================================ 置き場
  section('storage: browser (localStorage) backend, keys unchanged');
  {
    const R = load({ quiet: true, dev: true, fixtures: true });
    ok('backend is local by default', R.Storage.backend === 'local');
    R.Dev.applyState('core_stub_road');
    ok('save s1', R.Save.save('s1'));
    ok('same key as before (luminous_chronicle_v2_slot_s1)', !!R._localStorage['luminous_chronicle_v2_slot_s1']);
    R.Settings.set('fx', 'low');
    ok('settings under the same key', JSON.parse(R._localStorage['luminous_chronicle_v2_settings']).fx === 'low');
    ok('keys() lists them', R.Storage.keys().includes('slot_s1') && R.Storage.keys().includes('settings'));
  }

  section('storage: a save written by the old code still loads (migration)');
  let oldRaw;
  {
    // 前の版（R.Storage が無かった頃）と同じ書き方: localStorage に直に JSON
    const R0 = load({ quiet: true, dev: true, fixtures: true });
    R0.Dev.applyState('core_stub_road');
    R0.Game.gold = 4321;
    R0.Save.save('s2');
    oldRaw = R0._localStorage['luminous_chronicle_v2_slot_s2'];
    const R = load({ quiet: true, dev: true, fixtures: true });
    R._localStorage['luminous_chronicle_v2_slot_s2'] = oldRaw;
    R._localStorage['luminous_chronicle_v2_last'] = 's2';
    R._localStorage['luminous_chronicle_v2_settings'] = JSON.stringify({ textSpeed: 'fast', confirmButton: 'down' });
    R.Settings.load();
    ok('old settings read', R.Settings.get('textSpeed') === 'fast' && R.Settings.get('confirmButton') === 'down');
    const c = R.Save.cards().find((e) => e.slot === 's2');
    ok('old card readable', c && c.card && !c.card.bad, c);
    ok('old save loads', R.Save.load('s2') && R.Game.gold === 4321);
    ok('lastSlot kept', R.Save.lastSlot() === 's2');
  }

  section('storage: memory fallback when localStorage throws');
  {
    const R = load({ quiet: true, dev: true, fixtures: true, globals: {} });
    // localStorage を投げる物にする（プライベート窓など）
    Object.defineProperty(R._sandbox, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
    R.Storage._reset();
    ok('backend memory', R.Storage.backend === 'memory', R.Storage.backend);
    R.Dev.applyState('core_stub_road');
    ok('save works (memory)', R.Save.save('s1') && !!R.Save.cards().find((e) => e.slot === 's1').card);
    ok('load works (memory)', R.Save.load('s1'));
  }

  section('storage: desktop bridge (sync), first-run migration from localStorage');
  {
    const R = load({ quiet: true, dev: true, fixtures: true });
    R._localStorage['luminous_chronicle_v2_slot_s2'] = oldRaw;
    R._localStorage['luminous_chronicle_v2_settings'] = JSON.stringify({ textSpeed: 'slow' });
    R._localStorage['luminous_chronicle_v2_tester'] = '1';
    const files = {};
    const writes = [];
    const bridge = {
      read: (n) => (n in files ? files[n] : null),
      write: (n, t) => { files[n] = t; writes.push(n); return true; },
      list: () => Object.keys(files),
      remove: (n) => { delete files[n]; return true; },
    };
    await R.Storage.init({ bridge });
    ok('backend desktop', R.Storage.backend === 'desktop');
    ok('migrated the old save + settings into files', files.slot_s2 === oldRaw && JSON.parse(files.settings).textSpeed === 'slow', Object.keys(files));
    ok('tester flag is not migrated', !('tester' in files));
    ok('migration marker written', !!files.storage_meta && JSON.parse(files.storage_meta).n === 2, files.storage_meta);
    R.Settings.load();
    ok('settings come from the file', R.Settings.get('textSpeed') === 'slow');
    ok('old save loads from the file', R.Save.load('s2') && R.Game.gold === 4321);
    R.Dev.applyState('core_stub_road');
    ok('new save goes to a file', R.Save.save('s1') && !!files.slot_s1 && !R._localStorage['luminous_chronicle_v2_slot_s1']);
    R.Save.remove('s2');
    ok('remove deletes the file', !('slot_s2' in files));
    // 2 回目の起動: 消した記録が localStorage からよみがえらない
    const R2 = load({ quiet: true, dev: true, fixtures: true });
    R2._localStorage['luminous_chronicle_v2_slot_s2'] = oldRaw;
    await R2.Storage.init({ bridge });
    ok('second run: no re-migration', !('slot_s2' in files) && R2.Storage.migrated === 0);
    ok('second run reads files', !!R2.Save.cards().find((e) => e.slot === 's1').card);
    ok('bad key refused', R2.Storage.set('../x', '1') === false && !Object.keys(files).some((k) => k.includes('/')));
  }

  section('storage: desktop bridge (async) + write failure falls back to browser storage');
  {
    const R = load({ quiet: true, dev: true, fixtures: true });
    const files = { settings: JSON.stringify({ battleSpeed: 3 }), storage_meta: '{"ver":1}' };
    let fail = false;
    const bridge = {
      read: async (n) => files[n] || null,
      write: async (n, t) => { if (fail) return false; files[n] = t; return true; },
      list: async () => Object.keys(files),
      remove: async (n) => { delete files[n]; return true; },
    };
    await R.Storage.init({ bridge });
    R.Settings.load();
    ok('async read at init', R.Settings.get('battleSpeed') === 3);
    R.Dev.applyState('core_stub_road');
    R.Save.save('s3');
    ok('sync API reads its own write before the file lands', !!R.Save.cards().find((e) => e.slot === 's3').card);
    await R.Storage.flush();
    ok('async write landed', !!files.slot_s3);
    fail = true;
    R.Save.save('s1');
    await R.Storage.flush();
    ok('failed write kept in localStorage', !!R._localStorage['luminous_chronicle_v2_slot_s1'] && !files.slot_s1);
    ok('lastError set', /write/.test(R.Storage.lastError || ''), R.Storage.lastError);
    // 橋の list が落ちたらブラウザの置き場へ
    const R2 = load({ quiet: true });
    await R2.Storage.init({ bridge: { read() {}, write() {}, list() { throw new Error('x'); } } });
    ok('broken bridge → local', R2.Storage.backend === 'local');
  }

  section('desktop/store.js (files on disk)');
  {
    const { makeStore } = require('../desktop/store.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc2store-'));
    try {
      const st = makeStore(path.join(dir, 'saves'));
      ok('write + read', st.write('slot_s1', '{"a":1}') && st.read('slot_s1') === '{"a":1}');
      ok('overwrite keeps .bak', st.write('slot_s1', '{"a":2}') && fs.readFileSync(path.join(dir, 'saves', 'slot_s1.json.bak'), 'utf8') === '{"a":1}');
      fs.writeFileSync(path.join(dir, 'saves', 'slot_s1.json'), '');
      ok('empty file → falls back to .bak', st.read('slot_s1') === '{"a":1}');
      ok('list', JSON.stringify(st.list()) === '["slot_s1"]', st.list());
      ok('path traversal refused', st.write('../evil', 'x') === false && st.read('../etc/passwd') === null && !fs.existsSync(path.join(dir, 'evil.json')));
      ok('remove', st.remove('slot_s1') && st.list().length === 0);
      ok('no temp files left', fs.readdirSync(path.join(dir, 'saves')).every((f) => !/\.tmp$/.test(f)));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  // ================================================================ 割り当て
  section('remap: keyboard, conflicts, persistence');
  {
    const R = load({ quiet: true });
    const I = R.Input;
    const tap = (code) => { I._key(code, true); I.update(16); const r = {}; for (const b of ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'up', 'down', 'left', 'right', 'dash']) r[b] = I.pressed(b); I._key(code, false); I.update(16); return r; };
    ok('default Z → a', tap('KeyZ').a);
    ok('default Escape → b (spare)', tap('Escape').b);
    let res = I.bindKey('a', 0, 'KeyJ');
    ok('bind J to a', res.ok && tap('KeyJ').a && !tap('KeyZ').a);
    res = I.bindKey('dash', 0, 'KeyX');   // X は戻る → 入れ替え（戻るの 1 つ目に Shift）
    ok('conflict swaps: X moves from b to dash, b gets Shift', res.ok && res.moved && res.moved.btn === 'b' && res.moved.code === 'ShiftLeft' && tap('KeyX').dash && tap('ShiftLeft').b, res);
    ok('bindings reflect it', JSON.stringify(I.bindings().kb.b) === '["ShiftLeft","Backspace"]', I.bindings().kb.b);
    res = I.bindKey('x', 0, 'Escape');
    ok('Escape cannot be bound', !res.ok && res.reason === 'reserved');
    res = I.bindKey('x', 0, 'F11');
    ok('F11 cannot be bound', !res.ok && res.reason === 'reserved');
    I.clearKey('b', 1);
    res = I.clearKey('b', 0);
    ok('last key of b cannot be cleared', !res.ok && res.reason === 'need');
    // 1 つしか無い戻るのキーを別の操作が奪うと、戻るが空になる → 断る
    res = I.bindKey('x', 1, 'ShiftLeft');   // x の 2 つ目は空き → 戻るに渡す物が無い
    ok('stealing the only key of b is refused', !res.ok && res.reason === 'need' && res.other === 'b', res);
    ok('prompt kb uses the bound key', I.prompt('a').label === 'J' && I.prompt('dash').label === 'X');
    ok('saved in settings', !!JSON.parse(R._localStorage['luminous_chronicle_v2_settings']).binds.kb);
    // 読み直し（次の起動）
    const saved = R._localStorage['luminous_chronicle_v2_settings'];
    const R2 = load({ quiet: true });
    R2._localStorage['luminous_chronicle_v2_settings'] = saved;
    R2.Settings.load();
    ok('persisted across reload', R2.Input.bindings().kb.a[0] === 'KeyJ' && R2.Input.prompt('a').label === 'J');
    R2.Input.resetBinds('kb');
    ok('reset kb → defaults', R2.Input.bindings().kb.a[0] === 'KeyZ' && !JSON.parse(R2._localStorage['luminous_chronicle_v2_settings']).binds);
    // 壊れた割り当ては無視
    R2._localStorage['luminous_chronicle_v2_settings'] = JSON.stringify({ binds: { kb: { a: 'nope', b: [42, '<script>'] }, pad: { a: 'x', b: 99 } } });
    R2.Settings.load();
    ok('garbage binds ignored safely', R2.Input.bindings().kb.b.every((c) => c === null || typeof c === 'string') && R2.Input.prompt('a').label === 'Z');
    // 同じキーを押したまま同じ操作の別のキーを離しても離れない
    R2.Input.resetBinds();
    R2.Input._key('KeyZ', true); R2.Input._key('Enter', true); R2.Input.update(16); R2.Input._key('Enter', false); R2.Input.update(16);
    ok('two keys on one action: releasing one keeps it held', R2.Input.down('a'));
    R2.Input._key('KeyZ', false); R2.Input.update(16);
  }

  section('prompt: every button × every device returns a label (no throw)');
  {
    const R = load({ quiet: true });
    const I = R.Input;
    let bad = [];
    for (const d of ['kb', 'mouse', 'pad', 'touch']) for (const st of ['auto', 'xbox', 'ps', 'nintendo']) {
      I.lastDevice = d; R.Settings.set('padGlyphs', st);
      for (const b of I.BTN.concat(['dash'])) {
        try { const pr = I.prompt(b); if (!pr || typeof pr.label !== 'string' || !pr.label || !R.Contract.check('prompt', pr).ok) bad.push([d, st, b, pr]); } catch (e) { bad.push([d, st, b, String(e)]); }
      }
    }
    ok('all prompts valid', bad.length === 0, bad.slice(0, 5));
    R.Settings.set('padGlyphs', 'auto'); I.lastDevice = 'kb';
    ok('L stays bindable (field banner uses L)', I.bindKey('l', 1, 'KeyN').ok && I.prompt('l').label === 'Q' && I.bindPad('l', 6).ok);
    I.resetBinds();
  }

  section('remap: capture (listen for the next key)');
  {
    const R = load({ quiet: true });
    const I = R.Input;
    let got = null;
    I.capture('kb', (e) => { got = e; });
    I._key('KeyM', true); I.update(16);
    ok('capture gets the code', got && got.code === 'KeyM');
    ok('the captured key does not leak as a press', !I.pressed('a') && !I.capturing);
    I.bindKey('a', 0, 'KeyM');
    I.update(16);
    ok('held captured key is swallowed until released', !I.pressed('a'));
    I._key('KeyM', false); I.update(16);
    I._key('KeyM', true); I.update(16);
    ok('after release it works', I.pressed('a'));
    I._key('KeyM', false); I.update(16);
    got = null;
    I.capture('kb', (e) => { got = e; });
    I._key('Escape', true); I.update(16); I._key('Escape', false); I.update(16);
    ok('Escape cancels capture', got && got.cancel === true);
    got = null;
    I.capture('kb', (e) => { got = e; });
    I._set('a', true); I.update(16);
    ok('logical input is off while capturing', !I.pressed('a') && !I.down('a'));
    I._set('a', false); I.cancelCapture(); I.update(16);
    ok('cancelCapture reports cancel', got && got.cancel);
  }

  section('remap: gamepad buttons + glyphs by Gamepad.id');
  {
    const R = load({ quiet: true });
    const I = R.Input;
    const pad = (id, pressed) => ({ id, axes: [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })) });
    const XB = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
    const PS = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
    const NS = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';
    ok('styleOf', I.styleOf(XB) === 'xbox' && I.styleOf(PS) === 'ps' && I.styleOf(NS) === 'nintendo' && I.styleOf('Generic USB Joystick') === 'xbox');
    I._pad(pad(PS, [1])); I.update(16);
    ok('PS pad: button 1 (right) = a by default', I.pressed('a') && I.lastDevice === 'pad');
    ok('PS glyphs: a → ○, b → ×', I.padStyle() === 'ps' && I.prompt('a').label === '○' && I.prompt('b').label === '×' && I.prompt('a').index === 1);
    ok('PS L/R/start glyphs', I.prompt('l').label === 'L1' && I.prompt('start').label === 'Options');
    I._pad(pad(PS, [])); I.update(16);
    I._pad(pad(XB, [0])); I.update(16);
    ok('switching to an Xbox pad switches glyphs', I.padStyle() === 'xbox' && I.prompt('a').label === 'B' && I.prompt('b').label === 'A' && I.pressed('b'));
    I._pad(pad(XB, [])); I.update(16);
    I._key('KeyC', true); I.update(16); I._key('KeyC', false); I.update(16);
    ok('keyboard press switches back to key caps', I.lastDevice === 'kb' && I.prompt('y').kind === 'kb' && I.prompt('y').label === 'C');
    I.lastDevice = 'pad';
    R.Settings.set('padGlyphs', 'ps');
    ok('manual override (ps) beats the detected pad', I.padStyle() === 'ps' && I.prompt('y').label === '△');
    R.Settings.set('padGlyphs', 'auto');
    // パッドの割り当て
    let res = I.bindPad('y', 0);   // 0 は戻る → 入れ替え（戻るは 3）
    ok('bindPad swaps with b', res.ok && res.moved && res.moved.btn === 'b' && res.moved.index === 3 && I.bindings().pad.b === 3, res);
    I._pad(pad(XB, [0])); I.update(16);
    ok('button 0 now opens the menu (y)', I.pressed('y') && !I.pressed('b'));
    I._pad(pad(XB, [])); I.update(16);
    ok('prompt follows the pad bind', I.prompt('y').label === 'A' && I.prompt('b').label === 'Y');
    res = I.bindPad('a', -1);
    ok('a cannot be unbound', !res.ok && res.reason === 'need');
    res = I.bindPad('x', 12);
    ok('dpad is not bindable', !res.ok && res.reason === 'reserved');
    res = I.bindPad('dash', 7);
    I._pad(pad(XB, [7])); I.update(16);
    ok('dash on RT', res.ok && I.down('dash') && I.prompt('dash').label === 'RT');
    I._pad(pad(XB, [])); I.update(16);
    // 決定の位置を変えると、自分の割り当ての決定と戻るも入れ替わる
    const a0 = I.bindings().pad.a, b0 = I.bindings().pad.b;
    R.Settings.set('confirmButton', 'down');
    ok('confirmButton swaps custom a/b', I.bindings().pad.a === b0 && I.bindings().pad.b === a0);
    R.Settings.set('confirmButton', 'right');
    // 受け付け（パッド）
    let got = null;
    I.capture('pad', (e) => { got = e; });
    I._pad(pad(XB, [5])); I.update(16);
    ok('pad capture gets the index', got && got.index === 5 && !I.pressed('r'));
    I._pad(pad(XB, [])); I.update(16);
    const saved = R._localStorage['luminous_chronicle_v2_settings'];
    const R2 = load({ quiet: true });
    R2._localStorage['luminous_chronicle_v2_settings'] = saved;
    R2.Settings.load();
    ok('pad binds persisted', R2.Input.bindings().pad.y === 0 && R2.Input.bindings().pad.dash === 7);
    R2.Input.resetBinds('pad');
    ok('reset pad', R2.Input.bindings().pad.y === 3 && R2.Input.bindings().pad.dash === -1);
    R2.Settings.set('confirmButton', 'down');
    ok('default pad follows confirmButton', R2.Input.bindings().pad.a === 0);
  }

  section('display hotkeys');
  {
    const R = load({ quiet: true });
    const I = R.Input;
    let n = 0;
    R.Display.toggle = () => { n++; };
    I._key('F11', true); I.update(16); I._key('F11', false);
    I._key('Enter', true, { altKey: true }); I.update(16);
    ok('F11 and Alt+Enter toggle fullscreen', n === 2);
    ok('Alt+Enter is not a confirm press', !I.pressed('a'));
    I._key('Enter', false); I.update(16);
    ok('display / scaleMode settings exist', R.Settings.CHOICES.display.includes('fullscreen') && R.Settings.CHOICES.scaleMode.includes('integer'));
  }

  done('test_pc');
})().catch((e) => { console.error(e); process.exitCode = 1; });

