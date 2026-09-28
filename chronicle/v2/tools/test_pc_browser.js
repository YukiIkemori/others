// PC 版（Steam の基本）のブラウザのテスト: 画面の大きさ（1280×720・1920×1080・2560×1440・3840×2160 で実キャンバスと帯）、
// 設定の割り当ての表（キーを受け付けて変える → 読み直しても残る）、パッドの印の切り替え（Gamepad.id）、
// デスクトップの橋（window.chronicleDesktop）での保存と localStorage からの引っ越し、F11 の全画面。
//   node v2/tools/build.js && node v2/tools/test_pc_browser.js [--no-shots]
//   撮った PNG は scratch か v2/design/shots/pc/（--out <dir>）。必ず見る
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const args = process.argv.slice(2);
const noShots = args.includes('--no-shots');
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(B.V2, 'design', 'shots', 'pc');
const TOP = B.TOP;
const PAGE = 'dev.html?fixture=menus_party';

async function openScreen(p, id, params) {
  await B.ev(p, `(() => { RPG.Screens.open(${JSON.stringify(id)}, ${JSON.stringify(params || {})}); return true; })()`);
  return B.waitFor(p, `${TOP}==='screen:${id}'`, 3000);
}
const fakePad = (id, pressed) => `(() => {
  const pad = { id: ${JSON.stringify(id)}, index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: ${JSON.stringify(pressed)}.includes(i), value: ${JSON.stringify(pressed)}.includes(i) ? 1 : 0 })) };
  navigator.getGamepads = () => [pad];
  return true;
})()`;
const PS = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const XB = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
async function padTap(p, id, i) {
  await B.ev(p, fakePad(id, [i])); await p.waitForTimeout(120);
  await B.ev(p, fakePad(id, [])); await p.waitForTimeout(120);
}

(async () => {
  const S = await B.start();
  try {
    // ------------------------------------------------ 画面の大きさ
    section('display sizes (backing = device px, bars on whole px)');
    for (const [w, h] of [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]]) {
      const P = await B.open(S, PAGE, { size: [w, h], timeout: 90000 });
      const p = P.page;
      await B.waitFor(p, `${TOP}==='field'`, 8000);
      await p.waitForTimeout(600);
      const info = await B.ev(p, `(() => { const c = RPG.Gfx.canvas, r = c.getBoundingClientRect(); return { bw: c.width, bh: c.height, x: r.left, y: r.top, w: r.width, h: r.height, S: RPG.SCALE, crisp: RPG.fitInfo.crisp, W: RPG.W, H: RPG.H }; })()`);
      const want = h >= 1080 ? [w, h] : [1920, 1080];
      ok(`${w}x${h}: logical 960x540, backing ${want.join('x')}`, info.W === 960 && info.H === 540 && info.bw === want[0] && info.bh === want[1], info);
      ok(`${w}x${h}: canvas fills the screen on whole px`, info.w === w && info.h === h && info.x === 0 && info.y === 0, info);
      if (h >= 1080) ok(`${w}x${h}: 1:1 with device px (no browser resampling)`, info.crisp && Math.abs(info.S - h / 540) < 1e-6, info);
      if (!noShots) await B.shot(p, path.join(OUT, `field_${w}x${h}.png`));
      // 設定の画面（パッドの印: ○×△□）
      await B.ev(p, `RPG.Settings.set('padGlyphs', 'ps')`);
      await padTap(p, PS, 12);
      await openScreen(p, 'settings');
      await p.waitForTimeout(400);
      if (!noShots && (w === 2560 || w === 3840)) await B.shot(p, path.join(OUT, `settings_ps_${w}x${h}.png`));
      await B.ev(p, `RPG.Settings.set('padGlyphs', 'auto')`);
      if (w === 2560) {
        // 整数倍: 2560×1440 は 2 倍（1920×1080 を真ん中に）
        await B.ev(p, `RPG.Settings.set('scaleMode', 'integer')`);
        await p.waitForTimeout(300);
        const iv = await B.ev(p, `(() => { const c = RPG.Gfx.canvas, r = c.getBoundingClientRect(); return { bw: c.width, x: r.left, y: r.top, w: r.width }; })()`);
        ok('integer mode at 2560x1440: 1920x1080 centered', iv.bw === 1920 && iv.w === 1920 && iv.x === 320 && iv.y === 180, iv);
        if (!noShots) await B.shot(p, path.join(OUT, `settings_integer_2560x1440.png`));
        await B.ev(p, `RPG.Settings.set('scaleMode', 'fit')`);
      }
      ok(`${w}x${h}: 0 console errors`, P.errors.length === 0, P.errors.slice(0, 5));
      await P.close();
    }

    // ------------------------------------------------ 割り当ての表
    section('settings: key remap (listen → bind → persists after reload)');
    {
      const P = await B.open(S, PAGE, { timeout: 90000 });
      const p = P.page;
      await B.waitFor(p, `${TOP}==='field'`, 8000);
      await openScreen(p, 'settings');
      await p.waitForTimeout(300);
      for (let i = 0; i < 3; i++) await B.press(p, 'r');
      ok('操作 tab', (await B.ev(p, 'RPG.Engine.top().view.tab')) === 3);
      ok('first row is the keyboard remap', (await B.ev(p, 'RPG.Engine.top().view.list.current().act')) === 'kb');
      await B.press(p, 'a');
      ok('remap table opens', await B.waitFor(p, '!!RPG.Engine.top().view.rm', 1500));
      await p.waitForTimeout(250);
      if (!noShots) await B.shot(p, path.join(OUT, 'remap_kb_1920.png'));
      await B.press(p, 'a');
      ok('listening', await B.waitFor(p, `RPG.Input.capturing === 'kb'`, 1000));
      if (!noShots) await B.shot(p, path.join(OUT, 'remap_kb_listen_1920.png'));
      await p.keyboard.down('KeyJ'); await p.waitForTimeout(80); await p.keyboard.up('KeyJ'); await p.waitForTimeout(150);
      ok('J bound to a', (await B.ev(p, 'RPG.Input.bindings().kb.a[0]')) === 'KeyJ');
      ok('J did not also confirm (no re-listen)', !(await B.ev(p, 'RPG.Input.capturing')));
      // ぶつかり: 2 つ目の欄で X（戻る）を押す
      await B.press(p, 'right');
      await p.keyboard.press('Enter');   // 決定の 2 つ目（Z は J に替えた）
      await p.waitForTimeout(120);
      await p.keyboard.down('KeyX'); await p.waitForTimeout(80); await p.keyboard.up('KeyX'); await p.waitForTimeout(150);
      const bd = await B.ev(p, 'RPG.Input.bindings().kb');
      ok('conflict: X moved to a, b got Enter (swap)', bd.a[1] === 'KeyX' && bd.b[0] === 'Enter', bd);
      ok('message says what moved', /回した/.test(await B.ev(p, 'RPG.Engine.top().view.rm.msg.text')), await B.ev(p, 'RPG.Engine.top().view.rm.msg'));
      if (!noShots) await B.shot(p, path.join(OUT, 'remap_kb_conflict_1920.png'));
      // 読み直し
      await p.reload();
      await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 90000 });
      await B.waitFor(p, `${TOP}==='field'`, 8000);
      const bd2 = await B.ev(p, 'RPG.Input.bindings().kb');
      ok('binds persisted across reload', bd2.a[0] === 'KeyJ' && bd2.a[1] === 'KeyX' && bd2.b[0] === 'Enter', bd2);
      await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(60); await p.keyboard.up('ShiftLeft'); await p.waitForTimeout(60);
      ok('field prompts use the new key (a → J)', (await B.ev(p, 'RPG.Input.prompt("a").label')) === 'J');
      // パッドの表
      await openScreen(p, 'settings');
      await p.waitForTimeout(250);
      await B.ev(p, `(() => { const v = RPG.Engine.top().view; v.tab = 3; v.refresh(false); v.openRemap('pad'); return true; })()`);
      await padTap(p, XB, 12);
      await p.waitForTimeout(250);
      ok('pad table shows Xbox glyphs (a → B)', (await B.ev(p, 'RPG.Input.padStyle()')) === 'xbox' && (await B.ev(p, 'RPG.Input.prompt("a").label')) === 'B');
      if (!noShots) await B.shot(p, path.join(OUT, 'remap_pad_xbox_1920.png'));
      await B.ev(p, `RPG.Engine.top().view.listen('dash')`);
      await padTap(p, XB, 7);
      ok('pad: dash bound to RT', (await B.ev(p, 'RPG.Input.bindings().pad.dash')) === 7);
      await padTap(p, PS, 13);
      await p.waitForTimeout(200);
      ok('switch to a PS pad → PS glyphs', (await B.ev(p, 'RPG.Input.padStyle()')) === 'ps' && (await B.ev(p, 'RPG.Input.prompt("a").label')) === '○' && (await B.ev(p, 'RPG.Input.prompt("dash").label')) === 'R2');
      if (!noShots) await B.shot(p, path.join(OUT, 'remap_pad_ps_1920.png'));
      // 既定に戻す（最後の行 → 札で「戻す」）
      await B.ev(p, `(() => { const l = RPG.Engine.top().view.rm.list; l.focusIndex(l.rows.length - 1); return true; })()`);
      await p.keyboard.down('KeyJ'); await p.waitForTimeout(60); await p.keyboard.up('KeyJ'); await p.waitForTimeout(200);   // 今の決定は J
      await B.waitFor(p, '!!RPG.Engine.top().view.modal', 1000);
      await B.press(p, 'up');
      await p.keyboard.down('KeyJ'); await p.waitForTimeout(60); await p.keyboard.up('KeyJ'); await p.waitForTimeout(300);
      ok('reset pad binds', (await B.ev(p, 'RPG.Input.bindings().pad.dash')) === -1);
      await B.ev(p, `(() => { RPG.Input.resetBinds(); return true; })()`);
      // 戻る（B = Esc も効く）
      await p.keyboard.down('Escape'); await p.waitForTimeout(60); await p.keyboard.up('Escape'); await p.waitForTimeout(200);
      ok('B leaves the remap table', !(await B.ev(p, 'RPG.Engine.top().view.rm')));
      // キーボードで触ると、ボタン表示はキー帽子に戻る
      await B.press(p, 'down');
      ok('keyboard again → key caps', (await B.ev(p, 'RPG.Input.lastDevice')) === 'kb' && (await B.ev(p, 'RPG.Input.prompt("a").kind')) === 'kb');
      ok('0 console errors (remap)', P.errors.length === 0, P.errors.slice(0, 5));
      await P.close();
    }

    // ------------------------------------------------ デスクトップの橋
    section('desktop bridge: files, migration from localStorage, F11');
    {
      const P = await B.open(S, PAGE, { timeout: 90000 });
      const p = P.page;
      await B.waitFor(p, `${TOP}==='field'`, 8000);
      // ブラウザ版で記録を作る（前からある記録）
      await B.ev(p, `(() => { RPG.Game.gold = 777; RPG.Save.save('s2'); RPG.Settings.set('textSpeed', 'fast'); return true; })()`);
      ok('browser build: backend local', (await B.ev(p, 'RPG.Storage.backend')) === 'local');
      await P.ctx.addInitScript(() => {
        const files = JSON.parse(sessionStorage.getItem('__files') || '{}');
        const put = () => sessionStorage.setItem('__files', JSON.stringify(files));
        window.__fs = { full: false, calls: [] };
        window.chronicleDesktop = {
          read: async (n) => (n in files ? files[n] : null),
          write: async (n, t) => { files[n] = t; put(); return true; },
          list: async () => Object.keys(files),
          remove: async (n) => { delete files[n]; put(); return true; },
          setFullscreen: async (v) => { window.__fs.full = !!v; window.__fs.calls.push(!!v); return true; },
          isFullscreen: async () => window.__fs.full,
        };
        window.__files = files;
      });
      await p.reload();
      await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 90000 });
      await B.waitFor(p, `${TOP}==='field'`, 8000);
      ok('backend desktop', (await B.ev(p, 'RPG.Storage.backend')) === 'desktop');
      ok('old browser save migrated to a file', await B.ev(p, `!!window.__files.slot_s2 && !!window.__files.storage_meta && RPG.Storage.migrated >= 2`), await B.ev(p, 'Object.keys(window.__files)'));
      ok('settings from the file', (await B.ev(p, `RPG.Settings.get('textSpeed')`)) === 'fast');
      // localStorage を消しても、ファイルから読める
      await B.ev(p, `(() => { localStorage.clear(); return true; })()`);
      await p.reload();
      await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 90000 });
      await B.waitFor(p, `${TOP}==='field'`, 8000);
      ok('after clearing localStorage: save still loads from file', await B.ev(p, `RPG.Save.load('s2') && RPG.Game.gold === 777`));
      await B.ev(p, `(() => { RPG.Save.save('s3'); return true; })()`);
      await p.waitForTimeout(100);
      ok('new save written to a file only', await B.ev(p, `!!window.__files.slot_s3 && !localStorage.getItem('luminous_chronicle_v2_slot_s3')`));
      await p.keyboard.press('F11');
      await p.waitForTimeout(200);
      ok('F11 → desktop fullscreen', await B.ev(p, `window.__fs.full === true && RPG.Settings.get('display') === 'fullscreen'`), await B.ev(p, 'window.__fs'));
      await p.keyboard.down('Alt'); await p.keyboard.press('Enter'); await p.keyboard.up('Alt');
      await p.waitForTimeout(200);
      ok('Alt+Enter → back to window', await B.ev(p, `window.__fs.full === false && RPG.Settings.get('display') === 'window'`), await B.ev(p, 'window.__fs'));
      ok('Alt+Enter did not open anything', (await B.ev(p, TOP)) === 'field');
      ok('0 console errors (desktop)', P.errors.length === 0, P.errors.slice(0, 5));
      await P.close();
    }

    // ------------------------------------------------ ブラウザの全画面（押した直後なので許される）
    section('browser fullscreen via F11');
    {
      const P = await B.open(S, PAGE, { timeout: 90000 });
      const p = P.page;
      await B.waitFor(p, `${TOP}==='field'`, 8000);
      await p.keyboard.press('F11');
      await p.waitForTimeout(400);
      const full = await B.ev(p, '!!document.fullscreenElement');
      ok('F11 enters fullscreen (or is refused and the setting stays in sync)', full ? (await B.ev(p, `RPG.Settings.get('display')`)) === 'fullscreen' : (await B.ev(p, `RPG.Settings.get('display')`)) === 'window');
      if (full) {
        await p.keyboard.press('F11');
        await p.waitForTimeout(400);
        ok('F11 again leaves fullscreen', !(await B.ev(p, '!!document.fullscreenElement')) && (await B.ev(p, `RPG.Settings.get('display')`)) === 'window');
      }
      ok('0 console errors (fullscreen)', P.errors.length === 0, P.errors.slice(0, 5));
      await P.close();
    }
  } finally {
    await B.stop(S);
  }
  done('test_pc_browser');
})().catch((e) => { console.error(e); process.exitCode = 1; });
