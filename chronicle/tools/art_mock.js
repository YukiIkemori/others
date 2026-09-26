#!/usr/bin/env node
// Render the hi-res prototype mock screens (design/art_proto/proto.html) to PNG with Playwright (BRIEF Part A16).
//
//   node tools/art_mock.js [--styles anime,chibi,storybook] [--scenes battle,town,world,dungeon] [--anim]
// → design/art_proto/mocks/<style>_<scene>.png (1024×896, the real in-game framing)
//   --anim: frames at 30 fps → mocks/anim_<clip>.webp/.gif (ffmpeg) + sheets/anim_strip.png (frames kept with --keep-frames)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'design/art_proto');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const TYPES = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const p = path.join(DIR, decodeURIComponent(q.url.split('?')[0]));
      if (!p.startsWith(DIR) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function main() {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/proto.html`;
  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 896 } })).newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const shot = async (qs, out) => {
    await page.goto(`${base}?${qs}`);
    await page.waitForFunction('window.READY === true', null, { timeout: 30000 });
    await page.locator('#screen').screenshot({ path: out });
  };
  fs.mkdirSync(path.join(DIR, 'mocks'), { recursive: true });
  if (argv.includes('--anim')) {
    const style = arg('--style', 'anime');
    const adir = path.join(DIR, 'mocks/anim');
    fs.rmSync(adir, { recursive: true, force: true }); fs.mkdirSync(adir, { recursive: true });
    const CLIPS = { idle: 1.6, attack: 1.5, hurt: 1.0 };
    const ff = require('./lib/gemini_audio.js').ffmpegPath();
    for (const [clip, len] of Object.entries(CLIPS)) {
      const n = Math.round(len * 30);
      for (let i = 0; i < n; i++) await shot(`scene=anim&style=${style}&clip=${clip}&t=${(i / 30).toFixed(4)}`, path.join(adir, `${clip}_${String(i).padStart(3, '0')}.png`));
      // half-size animated previews (the full-size frames stay for inspection)
      spawnSync(ff, ['-y', '-framerate', '30', '-i', path.join(adir, `${clip}_%03d.png`), '-vf', 'scale=512:-1:flags=lanczos', '-loop', '0', '-quality', '85', path.join(DIR, 'mocks', `anim_${clip}.webp`)]);
      spawnSync(ff, ['-y', '-framerate', '30', '-i', path.join(adir, `${clip}_%03d.png`), '-vf', 'scale=512:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', path.join(DIR, 'mocks', `anim_${clip}.gif`)]);
      console.log(`anim ${clip}: ${n} frames`);
    }
    // the key-frame strip, then drop the 1024×896 frames (≈1 MB each) unless --keep-frames
    spawnSync('python3', [path.join(ROOT, 'tools/art_anim_strip.py'), adir, path.join(DIR, 'sheets/anim_strip.png')], { stdio: 'inherit' });
    if (!argv.includes('--keep-frames')) fs.rmSync(adir, { recursive: true, force: true });
  } else {
    for (const style of arg('--styles', 'anime,chibi,storybook').split(',')) {
      for (const scene of arg('--scenes', 'battle,town,world,dungeon').split(',')) {
        const out = path.join(DIR, 'mocks', `${style}_${scene}.png`);
        await shot(`scene=${scene}&style=${style}`, out);
        console.log('→', path.relative(ROOT, out));
      }
    }
  }
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
