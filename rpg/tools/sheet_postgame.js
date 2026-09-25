#!/usr/bin/env node
// Contact sheets for the post-game art (src/art/postgame.js) and screenshots of
// the bonus scene (src/systems/postgame_scene.js). Art review tool.
//
//   node tools/sheet_postgame.js [--out DIR] [--only zoom,context,variants,check,scene]
//                                [--ids a,b,...] [--scale N] [--crop x,y,w,h]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   zoom        each sprite at --scale (default 4) on a checker cell (--crop x,y,w,h limits it
//               to that sprite-pixel rectangle; use with --ids for close inspection)
//   context     each sprite alone on bbg:demon and bbg:throne at the game's 3x scale, placed
//               like battle_scene.js (feet on the ground line y=130, big sprites sink up to
//               14 px), party windows on top, hit-flash / target tints in the message box;
//               the superboss is shown beside boss_demon_king2 for comparison, the regular
//               sprites in a group of three like a real encounter
//   variants    the two regular base sprites in their default palette and hue-shifted
//               (the pg_* monsters reuse them with palette variants)
//   check       size / bbox / bottom row / colour count; exit 1 on a size or feet problem
//   scene       boots the built game (debug.html), sets up a cleared party and plays
//               R.Postgame.bonusScene(), taking screenshots while it fades in, while the
//               text is shown and at 「おしまい」 (run `node tools/build.js` first)
// Sprite sheets load only core + data + art sources (no game boot).
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/postgame'));
const ONLY = opt('only', 'zoom,context,variants,check').split(',');
const SCALE = +opt('scale', 4);
const CROP = opt('crop', '') ? opt('crop', '').split(',').map(Number) : null;
// sprite id → expected size
const SPRITES = { boss_abyss: [128, 112], rare_prism: [48, 48], void_wraith: [48, 48], chaos_beast: [64, 64] };
const IDS = opt('ids', '') ? opt('ids', '').split(',') : Object.keys(SPRITES);
const VARIANTS = [{ hue: 0 }, { hue: 70 }, { hue: 150 }, { hue: -110 }, { hue: 30, sat: 0.7, bri: 0.85 }];

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['data', 'art']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  return list;
}

// ---------------------------------------------------------------- page code
const PAGE = String.raw`
window.SHEET = (function () {
  const R = window.RPG, G = R.Gfx;
  const times = {};
  function img(id, v) {
    const t0 = performance.now();
    let im = v ? G.variant('mon:' + id, v) : G.get('mon:' + id);
    if (!(id in times)) times[id] = Math.round(performance.now() - t0);
    return Array.isArray(im) ? im[0] : im;
  }
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    if (bg !== null) { c.fillStyle = bg || '#3a3a48'; c.fillRect(0, 0, w, h); }
    return [cv, c];
  }
  function label(c, s, x, y, col) {
    c.font = '12px monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y);
  }
  function cell(c, x, y, w, h, s) {
    for (let j = 0; j < h; j += 4 * s) for (let i = 0; i < w; i += 4 * s) {
      c.fillStyle = ((i + j) / (4 * s)) % 2 ? '#8ea4b8' : '#9cb2c4';
      c.fillRect(x + i, y + j, Math.min(4 * s, w - i), Math.min(4 * s, h - j));
    }
  }
  function colours(im) {
    const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data, set = new Set();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return set.size;
  }
  function zoom(ids, s, crop) {
    const imgs = ids.map((id) => img(id));
    if (crop) {
      const [cx, cy, cw, ch] = crop;
      const [cv, c] = canvas(ids.length * (cw * s + 8) + 8, ch * s + 28);
      imgs.forEach((im, k) => {
        const x = 8 + k * (cw * s + 8);
        label(c, ids[k] + ' [' + crop.join(',') + ']', x, 4);
        cell(c, x, 20, cw * s, ch * s, s);
        c.drawImage(im, cx, cy, cw, ch, x, 20, cw * s, ch * s);
      });
      return cv.toDataURL();
    }
    let w = 8;
    const pos = imgs.map((im) => { const x = w; w += im.width * s + 8; return x; });
    const mh = Math.max(...imgs.map((i) => i.height));
    const [cv, c] = canvas(w, mh * s + 28);
    imgs.forEach((im, k) => {
      label(c, ids[k] + ' ' + im.width + 'x' + im.height + ' ' + colours(im) + 'c ' + times[ids[k]] + 'ms', pos[k], 4);
      cell(c, pos[k], 20, im.width * s, im.height * s, s);
      c.drawImage(im, pos[k], 20 + (mh - im.height) * s, im.width * s, im.height * s);
    });
    return cv.toDataURL();
  }
  function window_(c, x, y, w, h, s) {
    c.fillStyle = '#000'; c.fillRect((x + 2) * s, y * s, (w - 4) * s, h * s); c.fillRect(x * s, (y + 2) * s, w * s, (h - 4) * s);
    c.fillStyle = '#fff';
    c.fillRect((x + 4) * s, (y + 2) * s, (w - 8) * s, s); c.fillRect((x + 4) * s, (y + h - 3) * s, (w - 8) * s, s);
    c.fillRect((x + 2) * s, (y + 4) * s, s, (h - 8) * s); c.fillRect((x + w - 3) * s, (y + 4) * s, s, (h - 8) * s);
  }
  function tinted(im, color, amt) {
    const [t, tc] = canvas(im.width, im.height, null);
    tc.drawImage(im, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = color; tc.fillRect(0, 0, im.width, im.height);
    const [o, oc] = canvas(im.width, im.height, null);
    oc.drawImage(im, 0, 0); oc.globalAlpha = amt; oc.drawImage(t, 0, 0);
    return o;
  }
  /** one battle screen: sprites [{id, v}] laid out like battle_scene.js */
  function screen(c, list, bg, s, title) {
    const W = 256, H = 224, GROUND = 130;
    c.fillStyle = '#000'; c.fillRect(0, 0, W * s, H * s);
    let b = G.has('bbg:' + bg) ? G.get('bbg:' + bg) : null;
    if (Array.isArray(b)) b = b[0];
    if (b) c.drawImage(b, 0, 0, W * s, 144 * s);
    const ims = list.map((e) => img(e.id, e.v));
    const gap = 4, total = ims.reduce((a, im) => a + im.width, 0) + gap * (ims.length - 1);
    let x = Math.round(128 - total / 2);
    ims.forEach((im) => {
      const feet = GROUND + (im.height > 64 ? Math.min(14, Math.round((im.height - 64) / 3)) : 0);
      c.drawImage(im, x * s, (feet - im.height) * s, im.width * s, im.height * s);
      x += im.width + gap;
    });
    for (const wx of [6, 88, 170]) window_(c, wx, 6, 80, 44, s);
    window_(c, 8, 150, 240, 68, s);
    label(c, title, 24 * s, 158 * s);
    const im = ims[0];
    c.drawImage(tinted(im, '#ffffff', 0.9), 24 * s, 172 * s);
    c.drawImage(tinted(im, '#ff4030', 0.6), 24 * s + im.width + 8, 172 * s);
    c.drawImage(im, 24 * s + (im.width + 8) * 2, 172 * s);
  }
  function context(scenes, s) {
    const W = 256, H = 224;
    const [cv, c] = canvas(2 * (W * s + 6), Math.ceil(scenes.length / 2) * (H * s + 6), '#000');
    scenes.forEach((sc, k) => {
      c.save(); c.translate((k % 2) * (W * s + 6), Math.floor(k / 2) * (H * s + 6));
      screen(c, sc.list, sc.bg, s, sc.title);
      c.restore();
    });
    return cv.toDataURL();
  }
  function variants(ids, vs, s) {
    const rows = ids.map((id) => vs.map((v) => img(id, v)));
    const cw = Math.max(...rows.flat().map((i) => i.width)) * s + 8;
    const rh = rows.map((r) => r[0].height * s + 30);
    const [cv, c] = canvas(vs.length * cw + 8, rh.reduce((a, b) => a + b, 0) + 8);
    let y = 4;
    rows.forEach((r, k) => {
      r.forEach((im, j) => {
        const x = 8 + j * cw;
        label(c, ids[k] + ' ' + JSON.stringify(vs[j]), x, y);
        c.fillStyle = j % 2 ? '#1a1424' : '#2c2638'; c.fillRect(x, y + 16, im.width * s, im.height * s);
        c.drawImage(im, x, y + 16, im.width * s, im.height * s);
      });
      y += rh[k];
    });
    return cv.toDataURL();
  }
  function check(ids, sizes) {
    return ids.map((id) => {
      const im = img(id), d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data;
      let x0 = im.width, y0 = im.height, x1 = -1, y1 = -1, semi = 0;
      for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
        const a = d[(y * im.width + x) * 4 + 3];
        if (!a) continue;
        if (a < 255) semi++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      // lowest non-outline pixel: the outline sits on the last row
      const want = sizes[id] || [im.width, im.height];
      const probs = [];
      if (im.width !== want[0] || im.height !== want[1]) probs.push('size ' + im.width + 'x' + im.height + ' (want ' + want.join('x') + ')');
      if (y1 !== im.height - 1) probs.push('feet: lowest row ' + y1);
      if (semi) probs.push(semi + ' semi-transparent px');
      return { id, size: im.width + 'x' + im.height, bbox: [x0, y0, x1, y1], colours: colours(im), ms: times[id], probs };
    });
  }
  return { zoom, context, variants, check, times };
})();
`;

async function sprites(browser) {
  const src = sources();
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const pageFile = path.join(OUT, '_sheet.html');
  fs.writeFileSync(pageFile, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
</body></html>`);
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + pageFile);
  await page.waitForTimeout(200);
  const run = (js) => page.evaluate(js);
  const ids = JSON.stringify(IDS);
  let bad = false;
  if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${ids}, ${SCALE}, ${JSON.stringify(CROP)})`));
  if (ONLY.includes('context')) {
    const scenes = [];
    for (const id of IDS) {
      for (const bg of ['demon', 'throne']) {
        if (id === 'void_wraith' || id === 'chaos_beast') {
          scenes.push({ bg, title: id + ' x3 on bbg:' + bg, list: [{ id }, { id, v: { hue: 150 } }, { id, v: { hue: -110 } }].slice(0, id === 'chaos_beast' ? 3 : 3) });
        } else scenes.push({ bg, title: id + ' on bbg:' + bg, list: [{ id }] });
      }
      if (id === 'boss_abyss') scenes.push({ bg: 'throne', title: 'compare: boss_demon_king2', list: [{ id: 'boss_demon_king2' }] });
      if (id === 'boss_abyss') scenes.push({ bg: 'demon', title: 'regulars: void_wraith + chaos_beast + rare_prism', list: [{ id: 'void_wraith' }, { id: 'chaos_beast' }, { id: 'rare_prism' }] });
    }
    for (let i = 0; i < scenes.length; i += 4) save('context_' + (i / 4 + 1), await run(`SHEET.context(${JSON.stringify(scenes.slice(i, i + 4))}, 3)`));
  }
  if (ONLY.includes('variants')) {
    const vids = IDS.filter((id) => id === 'void_wraith' || id === 'chaos_beast');
    if (vids.length) save('variants', await run(`SHEET.variants(${JSON.stringify(vids)}, ${JSON.stringify(VARIANTS)}, 3)`));
  }
  if (ONLY.includes('check')) {
    const res = await run(`SHEET.check(${ids}, ${JSON.stringify(SPRITES)})`);
    for (const r of res) {
      console.log(`${r.id.padEnd(12)} ${r.size.padEnd(8)} bbox ${r.bbox.join(',').padEnd(14)} ${String(r.colours).padStart(3)} colours ${r.ms}ms ${r.probs.length ? 'PROBLEM: ' + r.probs.join('; ') : 'ok'}`);
      if (r.probs.length) bad = true;
    }
  }
  const info = await run(`(() => ({ warned: Object.keys(RPG.Gfx._warned) }))()`);
  console.log('missing:', info.warned.join(' ') || '-');
  for (const e of errors) console.log('[page]', e);
  return !bad && !errors.length && !info.warned.length;
}

/** boot the game, set up a cleared party and play the bonus scene */
async function scene(browser) {
  const html = path.join(ROOT, 'debug.html');
  const page = await (await browser.newContext({ viewport: { width: 800, height: 700 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + html);
  await page.waitForTimeout(2500);
  const setup = await page.evaluate(`(async () => {
    const R = window.RPG;
    R.Engine.clear();
    R.State.newGame();
    const jobs = { yuki: 'hero', non: 'sage', metem: 'timemage' };
    for (const c of R.Game.party) { if (R.DB.jobs[jobs[c.id]]) c.job = jobs[c.id]; }
    R.Game.party[0].name = 'アレン';
    R.Game.title = '深淵を越えし者';
    R.Game.flags.game_clear = true; R.Game.flags.abyss_clear = true;
    if (R.Field && R.Field.start) { try { await R.Field.start('regnas_castle', 'start'); } catch (e) { return 'field: ' + e.message; } }
    window.__done = false;
    R.Postgame.bonusScene().then(() => { window.__done = true; });
    return 'ok';
  })()`);
  console.log('setup:', setup);
  const shot = async (name) => { const f = path.join(OUT, name + '.png'); await page.locator('#screen').screenshot({ path: f }); console.log('shot →', f); };
  const press = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(60); await page.keyboard.up(k); };
  await page.waitForTimeout(700); await shot('scene_1_fadein');
  await page.waitForTimeout(2500); await shot('scene_2_panel');
  await page.waitForTimeout(6000); await shot('scene_3_text');
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate('window.RPG.Postgame._state && window.RPG.Postgame._state()');
    if (st === 'end') break;
    await press('KeyZ'); await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2500); await shot('scene_4_end');
  await press('KeyZ'); await page.waitForTimeout(2500);
  const done = await page.evaluate('window.__done');
  await shot('scene_5_after');
  const bgm = await page.evaluate('window.RPG.Audio && window.RPG.Audio.current');
  console.log('closed:', done, 'bgm after:', bgm);
  for (const e of errors) console.log('[page]', e);
  return done && !errors.length;
}

function save(name, url) {
  const f = path.join(OUT, name + '.png');
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log('sheet →', f);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let ok = true;
  if (ONLY.some((k) => ['zoom', 'context', 'variants', 'check'].includes(k))) ok = (await sprites(browser)) && ok;
  if (ONLY.includes('scene')) ok = (await scene(browser)) && ok;
  await browser.close();
  if (!ok) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
