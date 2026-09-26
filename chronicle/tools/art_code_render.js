#!/usr/bin/env node
// Render every output of the code-only art prototype (no image API, no network):
//   mocks (1024×896): battle / town / dungeon, pose sheets, monster sheet, hero attack GIF + WebP.
//   node tools/art_code_render.js [--only battle,town,...]
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'design/art_proto/code');
const OUT = path.join(DIR, 'out');
const PAGE = 'file://' + path.join(DIR, 'index.html');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (k) => !only.length || only.includes(k);

async function withPage(b, q, fn) {
  const page = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.stack || e));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto(PAGE + '?' + q);
  await page.waitForFunction(() => document.title === 'done' || document.title === 'err', null, { timeout: 180000 });
  await fn(page); await page.context().close();
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await playwright.chromium.launch();
  const shots = [
    ['battle2', 'view=battle2', 'mock2_battle.png'],
    ['town2', 'view=town2', 'mock2_town.png'],
    ['battle', 'view=battle', 'mock_battle.png'],
    ['battle', 'view=battle&smooth=1', 'mock_battle_smooth.png'],
    ['town', 'view=town&t=0.3', 'mock_town.png'],
    ['dungeon', 'view=dungeon&t=0.2', 'mock_dungeon.png'],
    ['sheet', 'view=sheet&z=3&cw=150&rh=200', 'sheet_party_poses.png'],
    ['sheet', 'view=sheet&z=6&cw=280&rh=400&who=arun&poses=idle,slash,cast,hurt,victory&bg=%23586a60', 'sheet_hero_zoom.png'],
    ['sheet', 'view=sheet&scale=4&z=3&cw=150&rh=200&who=arun,viola', 'sheet_smooth_variant.png'],
    ['mons', 'view=mons', 'sheet_monsters.png'],
  ];
  for (const [k, q, f] of shots) {
    if (!want(k)) continue;
    const t0 = Date.now();
    await withPage(b, q, async (p) => { await p.locator('#screen').screenshot({ path: path.join(OUT, f) }); });
    console.log('→', f, Date.now() - t0 + 'ms');
  }
  for (const [key, view, name, crop] of [['anim', 'battle', 'anim_hero_attack', [200, 170, 640, 400]], ['anim2', 'battle2', 'anim2_hero_attack', [150, 330, 720, 450]]]) {
    if (!want(key)) continue;
    const fdir = path.join(OUT, 'frames'); fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir);
    await withPage(b, 'view=' + view + '&noUI=1', async (p) => {
      const N = 54, fps = 24;
      for (let i = 0; i < N; i++) {
        const t = i / fps;
        const data = await p.evaluate(async ([t, view, cr]) => {
          await SCENES[view]({ t, act: 'attack', noUI: true });
          const c = document.getElementById('screen'), o = document.createElement('canvas'); o.width = cr[2]; o.height = cr[3];
          o.getContext('2d').drawImage(c, cr[0], cr[1], cr[2], cr[3], 0, 0, cr[2], cr[3]); return o.toDataURL('image/png');
        }, [t, view, crop]);
        fs.writeFileSync(path.join(fdir, `f${String(i).padStart(3, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
      }
    });
    const ff = require(path.join(ROOT, 'tools/lib/gemini_audio.js')).ffmpegPath();
    const inp = path.join(fdir, 'f%03d.png');
    cp.execFileSync(ff, ['-y', '-loglevel', 'error', '-framerate', '24', '-i', inp, '-vf', 'split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a', '-loop', '0', path.join(OUT, name + '.gif')]);
    cp.execFileSync(ff, ['-y', '-loglevel', 'error', '-framerate', '24', '-i', inp, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '90', '-loop', '0', path.join(OUT, name + '.webp')]);
    // contact strip of every 3rd frame
    cp.execFileSync(ff, ['-y', '-loglevel', 'error', '-framerate', '24', '-i', inp, '-vf', "select='not(mod(n\\,3))',scale=320:-1,tile=6x3", '-frames:v', '1', path.join(OUT, name + '_strip.png')]);
    console.log('→', name, '.gif/.webp + strip');
  }
  await b.close();
})();
