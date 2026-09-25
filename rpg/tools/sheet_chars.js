#!/usr/bin/env node
// Contact sheets for the character / NPC / object / icon art (art review tool).
//
//   node tools/sheet_chars.js [--out DIR] [--only a,b,...] [--scale N] [--cols N] [--jobs j1,j2] [--chars c1,c2] [--npcs t1,t2]
//
// Sheets (PNG, nearest-neighbour upscaled, default 4x):
//   party_<char>  every job of one character: down0 down1 left0 left1 right0 right1 up0 up1
//   party_all     (--only all) the given jobs for every character, one row each
//   lineup        all 19 jobs x 3 characters facing down (distinguishability check), plus darkened
//                 silhouettes as the job board shows locked jobs
//   npc           every 'npc:<type>' sheet (8 frames each)
//   objects       chest, ship (4 dirs x 2), sparkle, crest_glow, shadow
//   icons         every 'icon:<type>' at 4x and 1x
//   field         sprites standing on real field tiles at the game's 3x scale (in-context check)
// Loads only core + data + art sources (no game boot), so it works while
// other systems are mid-edit.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/chars'));
const ONLY = opt('only', 'party,lineup,npc,objects,icons,field').split(',');
const SCALE = +opt('scale', 4);
const JOBS = opt('jobs', '');
const CHARS = opt('chars', 'yuki,non,metem');
const NPCS = opt('npcs', '');
const COLS = +opt('cols', 2);

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
  const R = window.RPG, G = R.Gfx, CA = R.Art.Chars;
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#3a3a48'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col) {
    c.font = '12px monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y);
  }
  const FR = [['down', 0], ['down', 1], ['left', 0], ['left', 1], ['right', 0], ['right', 1], ['up', 0], ['up', 1]];
  function frames(sheet) { return FR.map(([d, f]) => sheet && sheet[d] ? sheet[d][f] : null); }
  // checker cell so transparency / outline edges are visible
  function cell(c, x, y, w, h, s) {
    for (let j = 0; j < h; j += 4 * s) for (let i = 0; i < w; i += 4 * s) {
      c.fillStyle = ((i + j) / (4 * s)) % 2 ? '#8ea4b8' : '#9cb2c4';
      c.fillRect(x + i, y + j, Math.min(4 * s, w - i), Math.min(4 * s, h - j));
    }
  }
  function sheetRow(c, sheet, x, y, s) {
    frames(sheet).forEach((f, i) => {
      const fx = x + i * (16 * s + 4);
      cell(c, fx, y, 16 * s, 24 * s, s);
      if (f) c.drawImage(f, fx, y, 16 * s, 24 * s);
    });
  }
  function grid(entries, s, cols) {
    const cw = 8 * (16 * s + 4) + 16, ch = 24 * s + 20;
    const rows = Math.ceil(entries.length / cols);
    const [cv, c] = canvas(cols * cw + 8, rows * ch + 8);
    entries.forEach(([name, key], i) => {
      const x = (i % cols) * cw + 8, y = Math.floor(i / cols) * ch + 4;
      label(c, name, x, y);
      sheetRow(c, G.get(key), x, y + 15, s);
    });
    return cv.toDataURL();
  }
  function party(ch, jobs, s, cols) {
    return grid(jobs.map((j) => [ch + ':' + j + ' ' + ((R.DB.jobs[j] && R.DB.jobs[j].name) || ''), 'party:' + ch + ':' + j]), s, cols);
  }
  function partyAll(chars, jobs, s, cols) {
    const e = [];
    for (const j of jobs) for (const ch of chars) e.push([ch + ':' + j, 'party:' + ch + ':' + j]);
    return grid(e, s, cols);
  }
  function npc(types, s, cols) { return grid(types.map((t) => [t, 'npc:' + t]), s, cols); }
  function lineup(chars, jobs, s) {
    const cw = 16 * s + 6, gw = chars.length * cw + 14;
    const cols = 10, rows = Math.ceil(jobs.length / cols);
    const [cv, c] = canvas(cols * gw + 10, rows * 2 * (24 * s + 22) + 10, '#4a8a4a');
    jobs.forEach((j, i) => {
      const x = (i % cols) * gw + 8, y = Math.floor(i / cols) * 2 * (24 * s + 22) + 4;
      label(c, j, x, y, '#fff');
      chars.forEach((ch, k) => {
        const sh = G.get('party:' + ch + ':' + j);
        const f = sh.down[0];
        c.drawImage(f, x + k * cw, y + 15, 16 * s, 24 * s);
        // darkened (locked job look)
        const t = document.createElement('canvas'); t.width = 16; t.height = 24;
        const tc = t.getContext('2d'); tc.drawImage(f, 0, 0); tc.globalCompositeOperation = 'source-atop';
        tc.fillStyle = 'rgba(0,0,0,0.8)'; tc.fillRect(0, 0, 16, 24);
        c.fillStyle = '#000'; c.fillRect(x + k * cw, y + 24 * s + 17, 16 * s, 24 * s);
        c.drawImage(t, x + k * cw, y + 24 * s + 17, 16 * s, 24 * s);
      });
    });
    return cv.toDataURL();
  }
  function objects(s) {
    const [cv, c] = canvas(40 * 16 * s / 4 + 900, 32 * s * 3 + 120);
    let x = 8, y = 20;
    const put = (img, w, h, name) => {
      cell(c, x, y, w * s, h * s, s); c.drawImage(img, x, y, w * s, h * s);
      if (name) label(c, name, x, y - 15);
      x += w * s + 6;
    };
    const chest = G.get('obj:chest'); put(chest[0], 16, 16, 'chest'); put(chest[1], 16, 16);
    x += 12;
    for (const f of G.get('obj:sparkle')) put(f, 16, 16, f === G.get('obj:sparkle')[0] ? 'sparkle' : '');
    x += 12;
    const cg = G.get('obj:crest_glow'); for (const f of cg) put(f, 16, 16, f === cg[0] ? 'crest_glow' : '');
    x += 12;
    const sh = G.get('obj:shadow'); put(sh, sh.width, sh.height, 'shadow');
    x = 8; y += 32 * s;
    const ship = G.get('obj:ship');
    for (const d of ['down', 'left', 'right', 'up']) for (let f = 0; f < 2; f++) put(ship[d][f], 32, 32, f ? '' : 'ship ' + d);
    // ship on the sea at 1:1 x3 in context
    y += 32 * s + 24; x = 8;
    const sea = G.has('tile:sea') ? G.get('tile:sea') : null;
    for (const d of ['down', 'left', 'right', 'up']) {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        let t = sea; if (Array.isArray(t)) t = t[0];
        if (t) c.drawImage(t, x + i * 48, y + j * 48, 48, 48);
      }
      const im = ship[d][0];
      c.drawImage(im, x + 48 + 24 - 48, y + 48 + 48 - 96 + 12, 96, 96);
      x += 160;
    }
    return cv.toDataURL();
  }
  function icons(s) {
    const types = ['sword', 'knife', 'axe', 'spear', 'staff', 'rod', 'bow', 'claw', 'katana', 'harp', 'shield', 'helm', 'hat', 'heavy', 'light', 'robe', 'acc', 'herb', 'potion', 'key'];
    const cw = 8 * s + 50;
    const [cv, c] = canvas(10 * cw + 10, 2 * (8 * s + 60) + 60, '#000');
    types.forEach((t, i) => {
      const x = (i % 10) * cw + 8, y = Math.floor(i / 10) * (8 * s + 60) + 6;
      label(c, t, x, y);
      c.drawImage(G.get('icon:' + t), x, y + 16, 8 * s, 8 * s);
      c.drawImage(G.get('icon:' + t), x + 8 * s + 6, y + 16);
      c.fillStyle = '#fff'; c.font = '11px monospace'; c.fillText('どうのつるぎ', x + 10, y + 16 + 8 * s + 6);
      c.drawImage(G.get('icon:' + t), x, y + 16 + 8 * s + 6);
    });
    return cv.toDataURL();
  }
  function field(chars, jobs, s, npcs) {
    // a small scene on real field tiles: party in several jobs, NPCs, chest, at game scale
    const tile = (id) => { let t = G.has('tile:' + id) ? G.get('tile:' + id) : null; return Array.isArray(t) ? t[0] : t; };
    const cols = 20, rows = 13;
    const [cv, c] = canvas(cols * 16 * s, rows * 16 * s, '#000');
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const id = y < 6 ? 'grass' : (G.has('tile:town:floor') ? null : 'floor');
      const t = y < 6 ? tile('grass') : (G.has('tile:town:floor') ? (Array.isArray(G.get('tile:town:floor')) ? G.get('tile:town:floor')[0] : G.get('tile:town:floor')) : tile('floor'));
      if (t) c.drawImage(t, x * 16 * s, y * 16 * s, 16 * s, 16 * s);
    }
    const put = (img, tx, ty) => { if (img) c.drawImage(img, (tx * 16 + 8 - img.width / 2) * s, (ty * 16 + 16 - img.height) * s, img.width * s, img.height * s); };
    let tx = 1, ty = 1;
    jobs.forEach((j, i) => {
      chars.forEach((ch, k) => {
        const sh = G.get('party:' + ch + ':' + j);
        const dir = ['down', 'left', 'right', 'up'][(i + k) % 4];
        put(sh[dir][0], tx, ty);
        tx++;
      });
      tx++;
      if (tx > cols - 4) { tx = 1; ty += 2; }
    });
    tx = 1; ty = Math.max(ty + 2, 7);
    npcs.forEach((t) => { put(G.get('npc:' + t).down[0], tx, ty); tx++; if (tx >= cols - 1) { tx = 1; ty += 2; } });
    put(G.get('obj:chest')[0], cols - 2, 1); put(G.get('obj:chest')[1], cols - 2, 3);
    return cv.toDataURL();
  }
  return { party, partyAll, npc, lineup, objects, icons, field };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const page_file = path.join(OUT, '_sheet.html');
  fs.writeFileSync(page_file, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
</body></html>`);

  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + page_file);
  await page.waitForTimeout(200);
  const save = (name, url) => {
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('sheet →', f);
  };
  const t0 = Date.now();
  const run = (js) => page.evaluate(js);
  const allJobs = await run(`RPG.Art.Chars.JOB_IDS`);
  const jobs = JOBS ? JOBS.split(',') : allJobs;
  const chars = CHARS.split(',');
  const npcs = NPCS ? NPCS.split(',') : await run(`RPG.Art.Chars.NPC_TYPES`);
  if (ONLY.includes('party')) for (const ch of chars) save('party_' + ch, await run(`SHEET.party(${JSON.stringify(ch)}, ${JSON.stringify(jobs)}, ${SCALE}, ${COLS})`));
  if (ONLY.includes('all')) save('party_all', await run(`SHEET.partyAll(${JSON.stringify(chars)}, ${JSON.stringify(jobs)}, ${SCALE}, ${COLS})`));
  if (ONLY.includes('lineup')) save('lineup', await run(`SHEET.lineup(${JSON.stringify(chars)}, ${JSON.stringify(jobs)}, ${Math.max(2, SCALE - 1)})`));
  if (ONLY.includes('npc')) save('npc', await run(`SHEET.npc(${JSON.stringify(npcs)}, ${SCALE}, ${COLS})`));
  if (ONLY.includes('objects')) save('objects', await run(`SHEET.objects(${SCALE})`));
  if (ONLY.includes('icons')) save('icons', await run(`SHEET.icons(${SCALE})`));
  if (ONLY.includes('field')) save('field', await run(`SHEET.field(${JSON.stringify(chars)}, ${JSON.stringify(jobs.slice(0, 12))}, 3, ${JSON.stringify(npcs)})`));
  const stats = await run(`(() => { const G = RPG.Gfx; return { defs: Object.keys(G._defs).length, cached: Object.keys(G._cache).length, warned: Object.keys(G._warned) }; })()`);
  console.log('gfx defs', stats.defs, 'built', stats.cached, 'missing', stats.warned.join(' ') || '-', 'in', Date.now() - t0, 'ms');
  for (const e of errors) console.log('[page]', e);
  await browser.close();
  if (errors.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
