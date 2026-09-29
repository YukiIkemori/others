// PV（宣伝の動画）の撮影の道具。ゲームの時計を 1 フレームずつ手で進めて撮る（負荷のある機械でもコマ落ちしない）。
//   ゲームのコードは変えない: R.Engine.pause() で rAF のループを止め、R.Engine.advance(1000/60) で 1 フレーム進め、
//   キャンバスを JPEG（質 0.95）にして手元の http へ POST し、そのまま ffmpeg の標準入力へ流す（PNG の連番をディスクに書かない）。
//   音はここでは鳴らさない: R.Audio の呼び出しを「何フレーム目に何が鳴ったか」の記録に差し替える（あとで ffmpeg で混ぜる）。
//
//   const C = require('./cap');
//   const S = await C.start({site});                 // site = dev.html と媒体（dist へのリンク）を置いたディレクトリ
//   const P = await C.open(S, 'dev.html?tester=1');  // 1920×1080。開いたら時計を止める
//   await C.run(P, 'R.Dev.fixture("content_p_roa")');
//   await C.idle(P, 120);                            // 撮らずに 120 フレーム進める（絵を焼く・読み込みを待つ）
//   await C.rec(P, 'out.mp4', 300, (i) => i === 0 ? 'R.Input._set("right", true)' : null);
//   P.audio()                                         // [{f, fn, id}]（rec の 0 フレーム目からの番号）
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

const FF = process.env.FFMPEG || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const FPS = 60;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.css': 'text/css' };
// 手元だけの http: 静的なファイル＋ POST /__pv（ページが送る 1 フレームの JPEG をそのまま今の ffmpeg へ。生の RGBA は fetch が遅すぎた）
function serve(root) {
  const S = { sink: null };
  S.srv = http.createServer((req, rsp) => {
    if (req.method === 'POST' && req.url.startsWith('/__pv')) {
      // 1 コマを全部受け取ってから書く（途中で切れた送りは捨てる。ページはもう一度送る）
      const sink = S.sink, parts = [];
      req.on('data', (c) => parts.push(c));
      req.on('end', () => {
        const done = () => { rsp.writeHead(200); rsp.end('ok'); };
        if (sink && !sink.write(Buffer.concat(parts))) sink.once('drain', done); else done();
      });
      return;
    }
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, path.normalize(u).replace(/^([/\\])+/, ''));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('not found'); return; }
    rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(rsp);
  });
  return new Promise((res) => S.srv.listen(0, '127.0.0.1', () => res(S)));
}

async function start(o) {
  const S0 = await serve(path.resolve(o.site));
  const srv = S0.srv;
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  return { srv, base, browser, S0 };
}
async function stop(S) { await S.browser.close(); S.srv.close(); }

// 音の呼び出しを記録に差し替える（ゲームのファイルは変えない。ページの中の関数を包むだけ）
const AUDIO_HOOK = `(() => {
  const R = window.RPG, A = R.Audio;
  window.__pvLog = [];
  const log = (fn, id, x) => window.__pvLog.push({ f: R.Engine.frame, fn, id: id == null ? null : String(id), x: x || null });
  const wrap = (name, ret) => { A[name] = function (id, o) { log(name, id, o && typeof o === 'object' ? JSON.stringify(o) : o); return ret ? ret() : undefined; }; };
  ['playBGM', 'stopBGM', 'pushBGM', 'popBGM', 'sfx', 'duck', 'bgm', 'pushBgm', 'popBgm', 'stopBgm', 'endJingle'].forEach((n) => wrap(n));
  wrap('playJingle', () => Promise.resolve()); wrap('jingle', () => Promise.resolve());
  wrap('playVoice', () => null); wrap('voice', () => Promise.resolve());
  wrap('battleVoice', () => null); wrap('battleVoiceId', () => null); wrap('stopVoice');
  A.preloadVoice = () => Promise.resolve();
  if (R.UIK && R.UIK.sfx) { const s = R.UIK.sfx; R.UIK.sfx = function (id) { log('uisfx', id); }; }
  return true;
})()`;

async function open(S, url, o) {
  o = o || {};
  const ctx = await S.browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + (e.stack || e)));
  if (o.init) await page.addInitScript(o.init);
  await page.goto(S.base + url);
  await page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 60000 });
  await page.waitForTimeout(o.settle || 500);
  await page.evaluate('window.R = window.RPG; RPG.Engine.pause(); true');
  await page.evaluate(AUDIO_HOOK);
  const cdp = await ctx.newCDPSession(page);
  const P = { S, ctx, page, cdp, errors, recFrame0: 0 };
  P.audio = async () => {
    const L = await page.evaluate('window.__pvLog');
    return L.filter((e) => e.f >= P.recFrame0).map((e) => Object.assign({}, e, { f: e.f - P.recFrame0 }));
  };
  P.close = () => ctx.close();
  return P;
}

const ev = (P, js) => P.page.evaluate(js);
/** 式を評価（Promise なら待たない。ゲームの時計が止まっているので await すると進まない物がある） */
async function run(P, js) { return P.page.evaluate(`(() => { const r = (0, eval)(${JSON.stringify(js)}); return r && typeof r.then === 'function' ? '[promise]' : r; })()`); }
/** 撮らずに n フレーム進める。途中で each(i) の式を毎フレームの前に評価 */
async function idle(P, n, each) {
  for (let i = 0; i < n; i++) {
    const js = each ? each(i) : null;
    await P.page.evaluate(`${js ? js + ';' : ''}RPG.Engine.advance(1000/60); RPG.Engine.frame`);
  }
}
/** 条件が真になるまで進める（最大 max フレーム）→ かかったフレーム数 */
async function until(P, cond, max, each) {
  for (let i = 0; i < (max || 600); i++) {
    if (await P.page.evaluate(`!!(${cond})`)) return i;
    const js = each ? each(i) : null;
    await P.page.evaluate(`${js ? js + ';' : ''}RPG.Engine.advance(1000/60); 1`);
  }
  return -1;
}
async function grab(P, q) {
  const r = await P.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: q || 94, optimizeForSpeed: true, captureBeyondViewport: false });
  return Buffer.from(r.data, 'base64');
}
/** n フレーム撮って out（mp4）に書く。each(i) → 毎フレームの前に評価する式（null で何もしない）。
 *  中間の動画は x264 の crf 14（あとで合成して書き直すので高めの質） */
async function rec(P, out, n, each, o) {
  o = o || {};
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(o.crf || 14), '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  P.recFrame0 = await P.page.evaluate('RPG.Engine.frame + 1');
  const t0 = Date.now();
  P.S.S0.sink = ff.stdin;
  for (let i = 0; i < n; i++) {
    const js = each ? each(i) : null;
    await P.page.evaluate(`(async () => { ${js ? js + ';' : ''}RPG.Engine.advance(1000/60);
      const b = await new Promise((r) => document.querySelector('canvas').toBlob(r, 'image/jpeg', ${o.q || 0.95}));
      for (let k = 0; ; k++) { try { await fetch('/__pv', { method: 'POST', body: b }); break; } catch (e) { if (k >= 4) throw e; await new Promise((r) => setTimeout(r, 200)); } } return 1; })()`);
  }
  P.S.S0.sink = null;
  ff.stdin.end();
  await done;
  const log = await P.audio();
  fs.writeFileSync(out.replace(/\.mp4$/, '.audio.json'), JSON.stringify(log));
  if (!o.quiet) console.log(`[pv] ${path.basename(out)}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s, audio events ${log.length}, errors ${P.errors.length}`);
  return log;
}
/** 1 枚だけ JPEG で保存（確かめ用） */
async function still(P, file) { fs.writeFileSync(file, await grab(P, 90)); return file; }

module.exports = { start, stop, open, ev, run, idle, until, rec, still, grab, FF, FPS };
