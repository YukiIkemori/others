// ブラウザのテストの小道具（CORE、版 2。各担当の test_<担当>*.js がブラウザで確かめるときに使う）
//
//   const B = require('./lib/browser');
//   const S = await B.start();                                   // dist/ を 127.0.0.1 で出し、Chromium を起こす
//   const P = await B.open(S, 'dev.html?scene=core_battle');     // 1920×1080。{phone: true} で 390×844・DPR 3・タッチ
//   await B.press(P.page, 'a'); await B.pressUntil(P.page, 'a', "(RPG.Engine.top()||{}).id==='field'");
//   await B.waitFor(P.page, 'RPG.Engine.time > 1000');
//   const inv = await B.invariants(P.page);                     // §2.5.3 の不変条件（R.Dev が無い index.html でも読める）
//   await B.shot(P.page, 'v2/design/shots/<担当>/x.png');        // 撮ったら必ず Read で見る（§2.9）
//   P.errors                                                     // コンソールのエラー・pageerror・外への通信（0 であること）
//   await B.stop(S);
//
// 外への通信はすべて止めて P.errors に積む（実行時の外部通信なし、の確かめ）。ビルドは呼ぶ側で（node v2/tools/build.js）。
'use strict';
const fs = require('fs');
const path = require('path');
const { serve } = require('../shot.js');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

const V2 = path.resolve(__dirname, '..', '..');
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX', x: 'KeyV', y: 'KeyC', l: 'KeyQ', r: 'KeyE', start: 'KeyP', dash: 'ShiftLeft' };
const TOP = '(RPG.Engine.top()||{}).id';

async function start(o) {
  o = o || {};
  const root = path.resolve(o.dist || path.join(V2, 'dist'));
  const srv = await serve(root);
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  return { srv, base, browser };
}
async function open(S, page, o) {
  o = o || {};
  const vp = o.phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: (o.size && o.size[0]) || 1920, height: (o.size && o.size[1]) || 1080 } };
  const ctx = await S.browser.newContext(vp);
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  p.on('pageerror', (e) => errors.push('[pageerror] ' + (e.stack || e)));
  await p.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(S.base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    errors.push('[outside request] ' + u);
    return route.abort();
  });
  await p.goto(S.base + page);
  await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: o.timeout || 15000 });
  await p.waitForTimeout(300);
  return { ctx, page: p, errors, close: () => ctx.close() };
}
const ev = (p, js) => p.evaluate(js);
async function press(p, b, ms) { await p.keyboard.down(KEY[b]); await p.waitForTimeout(ms || 60); await p.keyboard.up(KEY[b]); await p.waitForTimeout(90); }
async function pressUntil(p, b, cond, max) {
  for (let i = 0; i < (max || 40); i++) {
    if (await ev(p, cond)) return true;
    await press(p, b);
    await p.waitForTimeout(140);
  }
  return !!(await ev(p, cond));
}
async function waitFor(p, cond, ms) { try { await p.waitForFunction(cond, null, { timeout: ms || 5000 }); return true; } catch (e) { return false; } }
async function invariants(p) {
  return ev(p, `(() => { const t = RPG.Engine.top(); const r = {top: t && t.id, locks: Object.keys(RPG.Field.locks ? RPG.Field.locks() : {}), busy: RPG.Events.busy(), fade: RPG.Engine.fade.a, input: RPG.Input.enabled, msg: RPG.UIK.Message.busy()};
    r.ok = r.top === 'field' && r.locks.length === 0 && !r.busy && r.fade < 0.01 && r.input && !r.msg; return r; })()`);
}
async function shot(p, file) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); await p.screenshot({ path: file }); return file; }
async function stop(S) { await S.browser.close(); S.srv.close(); }

module.exports = { start, open, ev, press, pressUntil, waitFor, invariants, shot, stop, TOP, KEY, V2 };
