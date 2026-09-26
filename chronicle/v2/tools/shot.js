#!/usr/bin/env node
// v2 のスクショ・台本の道具（CORE、V2_PLAN §2.9）。Playwright の Chromium（/opt/pw-browsers）で開く。
//
//   node v2/tools/shot.js --query "fixture=core_stub_road" --out x.png
//   node v2/tools/shot.js --phone --touch "stick:right:600,tap:a" --out p.png
//
// ページは手元だけの小さな http（127.0.0.1、ページのディレクトリを配る）で開く（外に通信しない。
// file:// では外に置いた BGM・ボイスを読めないため）。
//
// オプション（--wait・--eval・--keys・--touch・--until・--shot は書いた順に実行）:
//   --html <file>        開くページ（既定 v2/dist/dev.html）
//   --query <qs>         ?qs（例 "fixture=core_stub_road"、"scene=core_battle"）
//   --size WxH           画面の大きさ（既定 1920x1080、DPR 1）
//   --dpr <n>            デバイスの画素比
//   --phone              390×844・DPR 3・縦持ち・タッチ（isMobile）
//   --phone-land         844×390・DPR 3・横持ち・タッチ
//   --time <ms>          撮るときだけ R.Engine.time をこの値に固定（きらめき・ゆらぎを止めて比べる）。撮った後は元に戻す
//   --cpu <rate>         CPU を遅くする（CDP Emulation.setCPUThrottlingRate。perf 用）
//   --wait <ms>          実時間で待つ（起動の後は既定で 600 ms 待つ）
//   --until <js>         式が真になるまで待つ（10 秒で失敗）
//   --eval <js>          ページで式を評価（await 可）して結果を出す
//   --keys <seq>         論理ボタンの台本（キーボード）: a b x y l r start up down left right dash を「,」でつなぐ
//                          hold:<btn>:<ms> 押し続ける / wait:<ms> / <btn>*<n> n 回
//   --touch <seq>        タッチの台本（操作パッドとタップ）: tap:a|b|y（操作パッドのボタン）/ tap:<x>:<y>（論理座標）/
//                          stick:<up|down|left|right|ul|ur|dl|dr>:<ms>（スティックを倒し続ける）/ hold:<a|b|y>:<ms> / long:<x>:<y> / wait:<ms>
//   --shot <file>        今撮る / --out <file> 最後に撮る。--canvas でキャンバスだけ（既定は画面全体＝帯も入る）
// コンソールのエラー・ページのエラー・R.loadErrors・R.Engine.error があれば終了コード 1。警告は表示だけ。
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

const V2 = path.resolve(__dirname, '..');
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX', x: 'KeyV', y: 'KeyC', l: 'KeyQ', r: 'KeyE', start: 'KeyP', dash: 'ShiftLeft' };
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], ul: [-0.7, -0.7], ur: [0.7, -0.7], dl: [-0.7, 0.7], dr: [0.7, 0.7] };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = path.join(root, path.normalize(u).replace(/^([/\\])+/, ''));
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('not found'); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

function parse(argv) {
  const o = { html: path.join(V2, 'dist', 'dev.html'), query: '', size: [1920, 1080], dpr: 1, mobile: false, touch: false, time: null, cpu: 1, canvas: false, out: null, steps: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--html') { o.html = path.resolve(v); i++; }
    else if (a === '--query') { o.query = v; i++; }
    else if (a === '--size') { o.size = v.split('x').map(Number); i++; }
    else if (a === '--dpr') { o.dpr = +v; i++; }
    else if (a === '--phone') { o.size = [390, 844]; o.dpr = 3; o.mobile = true; o.touch = true; }
    else if (a === '--phone-land') { o.size = [844, 390]; o.dpr = 3; o.mobile = true; o.touch = true; }
    else if (a === '--time') { o.time = +v; i++; }
    else if (a === '--cpu') { o.cpu = +v; i++; }
    else if (a === '--canvas') o.canvas = true;
    else if (a === '--out') { o.out = v; i++; }
    else if (['--wait', '--eval', '--keys', '--touch', '--until', '--shot'].includes(a)) { o.steps.push([a.slice(2), v]); i++; }
    else { console.error('unknown option ' + a); process.exit(2); }
  }
  return o;
}

async function run(o) {
  const root = path.dirname(o.html);
  const srv = await serve(root);
  const url = `http://127.0.0.1:${srv.address().port}/${path.basename(o.html)}${o.query ? '?' + o.query : ''}`;
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: o.size[0], height: o.size[1] }, deviceScaleFactor: o.dpr, isMobile: o.mobile, hasTouch: o.touch });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (o.cpu && o.cpu !== 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
  const errors = [];
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') { const s = `[console.${t}] ${m.text()}`; console.log(s); if (t === 'error') errors.push(s); }
  });
  page.on('pageerror', (e) => { const s = `[pageerror] ${e.stack || e}`; console.log(s); errors.push(s); });
  // 外への通信は無いはず。あれば記録して止める（実行時に外へ出ない約束の確かめ）
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://127.0.0.1:${srv.address().port}/`) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    errors.push('[network] blocked outside request ' + u); console.log('[network] blocked ' + u); return route.abort();
  });
  await page.goto(url);
  try { await page.waitForFunction('window.RPG && window.RPG.Engine && window.RPG.Engine.running', null, { timeout: 15000 }); }
  catch (e) { errors.push('[boot] the engine did not start in 15 s'); }
  await page.waitForTimeout(600);

  const shot = async (file) => {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    let saved = null;
    if (o.time != null) saved = await page.evaluate((t) => { const E = window.RPG.Engine; const s = E.time; E.setTime(t, { freeze: true }); return s; }, o.time);
    if (o.canvas) await page.locator('#screen').screenshot({ path: file });
    else await page.screenshot({ path: file });
    if (saved != null) await page.evaluate((s) => { window.RPG.Engine.setTime(s, { freeze: false }); }, saved);
    console.log('screenshot →', file);
  };
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id != null ? p.id : i + 1 })) });
  const spot = (name) => page.evaluate((n) => window.RPG.Input.touchSpot(n), name);
  const logical = (x, y) => page.evaluate(([lx, ly]) => { const c = document.getElementById('screen').getBoundingClientRect(); const R = window.RPG; return { x: c.left + lx / R.W * c.width, y: c.top + ly / R.H * c.height }; }, [x, y]);

  for (const [kind, v] of o.steps) {
    if (kind === 'wait') await page.waitForTimeout(+v);
    else if (kind === 'shot') await shot(v);
    else if (kind === 'until') {
      try { await page.waitForFunction(v, null, { timeout: 10000 }); } catch (e) { const s = `[until] timed out: ${v}`; console.log(s); errors.push(s); }
    } else if (kind === 'eval') {
      try {
        const r = await page.evaluate(`(async()=>{ return (${v}); })()`);
        if (r !== undefined) console.log('eval →', typeof r === 'string' ? r : JSON.stringify(r).slice(0, 4000));
      } catch (e) { const s = '[eval error] ' + e.message; console.log(s); errors.push(s); }
    } else if (kind === 'keys') {
      for (let tok of v.split(',').map((s) => s.trim()).filter(Boolean)) {
        let n = 1;
        const m = tok.match(/^(.*)\*(\d+)$/);
        if (m) { tok = m[1]; n = +m[2]; }
        for (let k = 0; k < n; k++) {
          if (tok.startsWith('wait:')) await page.waitForTimeout(+tok.slice(5));
          else if (tok.startsWith('hold:')) {
            const [, b, ms] = tok.split(':');
            await page.keyboard.down(KEY[b]); await page.waitForTimeout(+ms); await page.keyboard.up(KEY[b]); await page.waitForTimeout(60);
          } else if (KEY[tok]) {
            await page.keyboard.down(KEY[tok]); await page.waitForTimeout(60); await page.keyboard.up(KEY[tok]); await page.waitForTimeout(100);
          } else console.log('unknown key token', tok);
        }
      }
    } else if (kind === 'touch') {
      for (const tok of v.split(',').map((s) => s.trim()).filter(Boolean)) {
        const p = tok.split(':');
        if (p[0] === 'wait') { await page.waitForTimeout(+p[1]); continue; }
        if (p[0] === 'tap' && p.length === 3) {
          const q = await logical(+p[1], +p[2]);
          await touch('touchStart', [q]); await page.waitForTimeout(60); await touch('touchEnd', []); await page.waitForTimeout(120); continue;
        }
        if (p[0] === 'long') {
          const q = await logical(+p[1], +p[2]);
          await touch('touchStart', [q]); await page.waitForTimeout(650); await touch('touchEnd', []); await page.waitForTimeout(120); continue;
        }
        if (p[0] === 'tap' || p[0] === 'hold') {
          const s = await spot(p[1]);
          if (!s) { console.log(`[touch] no touch-pad button '${p[1]}' (is the touch pad shown?)`); continue; }
          await touch('touchStart', [s]); await page.waitForTimeout(p[0] === 'hold' ? +p[2] : 70); await touch('touchEnd', []); await page.waitForTimeout(120); continue;
        }
        if (p[0] === 'stick') {
          const s = await spot('stick'), d = DIRV[p[1]];
          if (!s || !d) { console.log(`[touch] stick not shown or bad direction '${p[1]}'`); continue; }
          await touch('touchStart', [{ x: s.x, y: s.y }]);
          const steps = 4;
          for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: s.x + d[0] * s.r * 0.9 * i / steps, y: s.y + d[1] * s.r * 0.9 * i / steps }]); await page.waitForTimeout(16); }
          await page.waitForTimeout(+p[2] || 300);
          await touch('touchEnd', []); await page.waitForTimeout(80); continue;
        }
        console.log('unknown touch token', tok);
      }
    }
  }
  if (o.out) await shot(o.out);
  const tail = await page.evaluate(() => { const R = window.RPG || {}; return { le: R.loadErrors || [], eng: R.Engine && R.Engine.error ? R.Engine.error.msg : null }; }).catch(() => ({ le: [], eng: null }));
  for (const e of tail.le) { console.log('[loadError]', e); errors.push(e); }
  if (tail.eng) { console.log('[engine error]', tail.eng); errors.push(tail.eng); }
  await browser.close();
  srv.close();
  if (errors.length) { console.log(`\n${errors.length} error(s)`); process.exitCode = 1; }
  return errors;
}

module.exports = { run, parse, serve };
if (require.main === module) run(parse(process.argv.slice(2))).catch((e) => { console.error(e); process.exit(2); });
