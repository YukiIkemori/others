#!/usr/bin/env node
// Monster data review sheets (owner: monsters). Renders the real R.DB.monsters
// (palette variants included) and the encounter groups on their backdrops.
//
//   node tools/fixtures/monsters/sheet.js [--out DIR] [--only base,roster,zones,troops] [--zones a,b] [--scale N]
//
//   base    every base sprite in its default palette
//   roster  every monster: sprite variant at 2x with id, name, level  (one sheet per region)
//   zones   each encounter zone: its groups laid out like the battle scene on the zone's backdrop
//   troops  every boss troop on its backdrop
//   --try '[["jelly",{"hue":60}],...]'   palette candidates side by side (with --only none)
// Loads only core + data + art (no game boot).
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..', '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/monsters'));
const ONLY = opt('only', 'base,roster,zones,troops').split(',');
const ZONES = opt('zones', '') ? opt('zones', '').split(',') : null;
const SCALE = +opt('scale', 2);

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['data', 'art']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  return list;
}

const PAGE = String.raw`
window.SHEET = (function () {
  const R = window.RPG, G = R.Gfx, DB = R.DB;
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#2a2a36'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col, size) {
    c.font = (size || 12) + 'px "IPAGothic", monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y);
  }
  const img = (id) => { const d = DB.monsters[id]; let i = G.variant('mon:' + d.sprite, { hue: d.hue, sat: d.sat, bri: d.bri }); return Array.isArray(i) ? i[0] : i; };
  function base(s) {
    const ids = Object.keys(G._defs).filter((k) => k.startsWith('mon:')).map((k) => k.slice(4));
    const cols = 8, cw = 128 * s / 2 + 10, ch = 112 * s / 2 + 24;
    const [cv, c] = canvas(cols * cw + 10, Math.ceil(ids.length / cols) * ch + 10);
    ids.forEach((id, i) => {
      const x = 10 + (i % cols) * cw, y = 10 + Math.floor(i / cols) * ch;
      let im = G.get('mon:' + id); if (Array.isArray(im)) im = im[0];
      const k = id.startsWith('boss_') ? s / 2 : s;
      c.fillStyle = '#6a8a5a'; c.fillRect(x, y + 16, cw - 10, ch - 26);
      c.drawImage(im, x, y + 16, im.width * k, im.height * k);
      label(c, id, x, y);
    });
    return cv.toDataURL();
  }
  /** monsters sorted by level, grouped in pages of n */
  function roster(ids, s) {
    const cols = 6, cw = 64 * s + 16, ch = 64 * s + 44;
    const [cv, c] = canvas(cols * cw + 10, Math.ceil(ids.length / cols) * ch + 10);
    ids.forEach((id, i) => {
      const d = DB.monsters[id];
      const x = 10 + (i % cols) * cw, y = 10 + Math.floor(i / cols) * ch;
      const im = img(id);
      c.fillStyle = '#44506a'; c.fillRect(x, y + 32, 64 * s, 64 * s);
      c.drawImage(im, x + (64 - im.width) * s / 2, y + 32 + (64 - im.height) * s, im.width * s, im.height * s);
      label(c, id + ' L' + d.lv, x, y, '#b0c0ff', 11);
      label(c, d.name + ((d.flags || []).length ? ' [' + d.flags.join(',') + ']' : ''), x, y + 15, '#ffffff', 13);
    });
    return cv.toDataURL();
  }
  function scene(c, oy, bg, list, s, title) {
    const W = 256, H = 144, GROUND = 130;
    let b = G._defs['bbg:' + bg] ? G.get('bbg:' + bg) : null;
    if (Array.isArray(b)) b = b[0];
    if (b) c.drawImage(b, 0, oy, W * s, H * s);
    else { c.fillStyle = '#5a8a4a'; c.fillRect(0, oy, W * s, H * s); }
    const imgs = list.map(img);
    const total = imgs.reduce((a, i) => a + i.width, 0);
    const gap = imgs.length > 1 ? Math.min(8, (244 - total) / (imgs.length - 1)) : 0;
    let x = 128 - (total + gap * (imgs.length - 1)) / 2;
    imgs.forEach((im) => {
      const feet = GROUND + (im.height > 64 ? Math.min(14, Math.round((im.height - 64) / 3)) : 0);
      c.drawImage(im, Math.round(x) * s, oy + (feet - im.height) * s, im.width * s, im.height * s);
      x += im.width + gap;
    });
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, oy, W * s, 18);
    label(c, title, 4, oy + 3, '#ffffff', 12);
  }
  /** max-size version of each group of a zone */
  function zone(zid, s) {
    const z = DB.encounters[zid];
    const W = 256 * s, H = 144 * s;
    const cols = 2;
    const [cv, c] = canvas(cols * (W + 6), Math.ceil(z.groups.length / cols) * (H + 6));
    z.groups.forEach((g, i) => {
      const list = [];
      for (const [id, a, b] of g.mons) for (let k = 0; k < b; k++) list.push(id);
      c.save(); c.translate((i % cols) * (W + 6), Math.floor(i / cols) * (H + 6));
      scene(c, 0, z.bg, list.slice(0, 8), s, zid + ' #' + i + ' w' + g.w + ' ' + g.mons.map((m) => DB.monsters[m[0]].name + m[1] + '-' + m[2]).join(' '));
      c.restore();
    });
    return cv.toDataURL();
  }
  function troops(s) {
    const ids = Object.keys(DB.troops);
    const W = 256 * s, H = 144 * s, cols = 2;
    const [cv, c] = canvas(cols * (W + 6), Math.ceil(ids.length / cols) * (H + 6));
    ids.forEach((tid, i) => {
      const t = DB.troops[tid];
      const list = [];
      for (const [id, a, b] of t.mons) for (let k = 0; k < (b != null ? b : a != null ? a : 1); k++) list.push(id);
      c.save(); c.translate((i % cols) * (W + 6), Math.floor(i / cols) * (H + 6));
      scene(c, 0, t.bg || 'castle', list, s, tid + ' ' + list.map((m) => DB.monsters[m].name).join(' '));
      c.restore();
    });
    return cv.toDataURL();
  }
  /** candidate palettes: list of [sprite, {hue,sat,bri}] */
  function tryout(list, s) {
    const cols = 6, cw = 64 * s + 16, ch = 64 * s + 30;
    const [cv, c] = canvas(cols * cw + 10, Math.ceil(list.length / cols) * ch + 10);
    list.forEach(([sp, v], i) => {
      const x = 10 + (i % cols) * cw, y = 10 + Math.floor(i / cols) * ch;
      let im = G.variant('mon:' + sp, v); if (Array.isArray(im)) im = im[0];
      c.fillStyle = '#44506a'; c.fillRect(x, y + 18, 64 * s, 64 * s);
      c.drawImage(im, x + (64 - im.width) * s / 2, y + 18 + (64 - im.height) * s, im.width * s, im.height * s);
      label(c, sp + ' ' + JSON.stringify(v), x, y, '#ffffff', 10);
    });
    return cv.toDataURL();
  }
  return { base, roster, zone, troops, tryout, ids: () => Object.keys(DB.monsters), zones: () => Object.keys(DB.encounters), lv: (id) => DB.monsters[id].lv };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const html = path.join(OUT, 'sheet.html');
  fs.writeFileSync(html, '<!doctype html><meta charset="utf-8"><body style="background:#000">' +
    sources().map((f) => `<script src="file://${f}"></script>`).join('\n') + `<script>${PAGE}</script></body>`);
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
  await page.goto('file://' + html);
  const save = async (name, expr) => {
    const url = await page.evaluate(expr);
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('→', f);
  };
  if (ONLY.includes('base')) await save('base', `SHEET.base(${SCALE})`);
  if (ONLY.includes('roster')) {
    const ids = await page.evaluate('SHEET.ids()');
    const lv = {};
    for (const id of ids) lv[id] = await page.evaluate(`SHEET.lv(${JSON.stringify(id)})`);
    ids.sort((a, b) => lv[a] - lv[b]);
    for (let i = 0; i < ids.length; i += 24) await save('roster_' + (i / 24 + 1), `SHEET.roster(${JSON.stringify(ids.slice(i, i + 24))}, ${SCALE})`);
  }
  if (ONLY.includes('zones')) {
    const zs = ZONES || await page.evaluate('SHEET.zones()');
    for (const z of zs) await save('zone_' + z, `SHEET.zone(${JSON.stringify(z)}, ${SCALE})`);
  }
  if (ONLY.includes('troops')) await save('troops', `SHEET.troops(${SCALE})`);
  if (opt('try', null)) await save('try', `SHEET.tryout(${opt('try')}, ${SCALE})`);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
