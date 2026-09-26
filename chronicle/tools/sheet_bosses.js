#!/usr/bin/env node
// Contact sheets for the boss sprites (art review tool, owner art-boss A15a).
//
//   node tools/sheet_bosses.js [--out DIR] [--only sheet,context,troops,zoom,legacy]
//                              [--ids a,b,...] [--scale N] [--crop x,y,w,h] [--guide] [--big]
//
// Sheets (PNG, nearest-neighbour):
//   sheet     every Chronicle boss sprite (DESIGN §9.11.4/§9.11.6) at --scale (default 2) on a
//             checker cell, with a 1x copy on black and on a field tone; label = size (✔ when it
//             matches §9.11.6), kind (new / crest / compose), build time, colour count
//   context   each sprite alone on its troop's backdrop in a mock of the real battle screen:
//             R.Gfx.window / text with DotGothic16, the four party windows of §11.5.1
//             (WIN xs 3·66·129·192, y 5, 61×46, name plates, H/M/W, row tags), the command and
//             enemy-name windows, and the §11.4.2 sink feet = 130 + clamp(round((h−64)/2.4), 0, 20).
//             Four scenes per PNG at 2× (--big: one scene per PNG at the game's 4×)
//   troops    the 26 boss troops of §9.11.4 in the same battle mock (all members, the battle's
//             left-to-right layout, total width ≤ 244, gap ≤ 8)
//   zoom      --ids at --scale (default 6); --crop x,y,w,h limits it to that sprite rectangle
//   legacy    the Crest bosses no Chronicle troop uses (kept registered)
//   --guide   draw the window band's lower edge (y 56, magenta) and the sprite's 20-px face
//             line (cyan) on the battle mocks
//   --with f  extra scripts loaded after the art (comma separated; e.g. trial sprites in a fixture)
// Ids may be sprite ids (boss_moth, b_sandworm) or boss ids (b_moth). Loads only core + data +
// art sources (no game boot), so it works while other systems are mid-edit. New backdrops that
// are not drawn yet use their §10.15 stand-in (noted in the label).
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROSTER = require('./fixtures/art-boss/roster');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);
const OUT = path.resolve(opt('out', '/tmp/claude-0/bosses'));
const ONLY = opt('only', 'sheet,context,troops').split(',');
const CROP = opt('crop', '') ? opt('crop', '').split(',').map(Number) : null;
const toSprite = (id) => (ROSTER.BOSSES[id] ? ROSTER.BOSSES[id][0] : id);
const IDS = opt('ids', '') ? opt('ids', '').split(',').map(toSprite) : Object.keys(ROSTER.SPRITES);
const SCALE = +opt('scale', ONLY.length === 1 && ONLY[0] === 'zoom' ? 6 : 2);

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['data', 'art']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  for (const f of opt('with', '') ? opt('with', '').split(',') : []) list.push(path.resolve(f));
  return list;
}

// ---------------------------------------------------------------- page code
const PAGE = String.raw`
window.SHEET = (function () {
  const R = window.RPG, G = R.Gfx;
  const times = {};
  let ROSTER = null;
  const setRoster = (r) => { ROSTER = r; };
  function img(id) {
    const t0 = performance.now();
    const v = G.get('mon:' + id);
    if (!(id in times)) times[id] = Math.round(performance.now() - t0);
    return Array.isArray(v) ? v[0] : v;
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
    const q = Math.max(4, 4 * s);
    for (let j = 0; j < h; j += q) for (let i = 0; i < w; i += q) {
      c.fillStyle = ((i + j) / q) % 2 ? '#8ea4b8' : '#9cb2c4';
      c.fillRect(x + i, y + j, Math.min(q, w - i), Math.min(q, h - j));
    }
  }
  function colours(im) {
    const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data, set = new Set();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return set.size;
  }
  /** two sprites per row at scale s, each followed by 1x copies */
  function sheet(ids, s) {
    const cols = 2, cw = 128 * s + 150, ch = Math.max(112 * s, 2 * 112 + 20) + 28;
    const rows = Math.ceil(ids.length / cols);
    const [cv, c] = canvas(cols * cw + 8, rows * ch + 8);
    ids.forEach((id, k) => {
      const im = img(id);
      const x = 8 + (k % cols) * cw, y = 4 + Math.floor(k / cols) * ch;
      const r = ROSTER.SPRITES[id];
      const ok = r ? im.width === r[2][0] && im.height === r[2][1] : true;
      label(c, id + '  ' + im.width + 'x' + im.height + (r ? (ok ? ' ok' : ' WANT ' + r[2].join('x')) : '') + '  ' + (r ? r[3] : 'legacy') + '  ' + times[id] + 'ms  ' + colours(im) + 'c', x, y, ok ? null : '#ff8080');
      cell(c, x, y + 16, im.width * s, im.height * s, s);
      c.drawImage(im, x, y + 16, im.width * s, im.height * s);
      const bx = x + 128 * s + 8;
      c.fillStyle = '#000'; c.fillRect(bx, y + 16, im.width + 8, im.height + 8);
      c.drawImage(im, bx + 4, y + 20);
      c.fillStyle = '#5a6a4a'; c.fillRect(bx, y + 28 + im.height, im.width + 8, im.height + 8);
      c.drawImage(im, bx + 4, y + 32 + im.height);
    });
    return cv.toDataURL();
  }

  // ------------------------------------------------ battle mock (DESIGN §11.5.1 / §11.4.2)
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, WIN_BOTTOM = 56, GROUND = 130;
  const PARTY = [
    { name: 'アルン', hp: 212, mp: 18, wp: 24, row: '前' },
    { name: 'ブリギッタ', hp: 187, mp: 6, wp: 31, row: '前' },
    { name: 'マルタ', hp: 141, mp: 45, wp: 9, row: '後' },
    { name: 'シルヴァン', hp: 96, mp: 99, wp: 18, row: '後' },
  ];
  const sink = (h) => Math.max(0, Math.min(20, Math.round((h - 64) / 2.4)));
  function backdrop(bg) {
    if (G.has('bbg:' + bg)) return [bg, ''];
    const f = ROSTER.BG_FALLBACK[bg];
    if (f && G.has('bbg:' + f)) return [f, ' (stand-in for ' + bg + ')'];
    return [null, ' (no bbg:' + bg + ')'];
  }
  /** one battle screen (1024x896, the game's 4x) with sprites ids (left→right) and enemy names */
  function scene(ids, names, bg, o) {
    o = o || {};
    const cv = document.createElement('canvas');
    G.init(cv);
    const c = G.ctx;
    G.clear('#000');
    const [bk, note] = backdrop(bg);
    if (bk) { let b = G.get('bbg:' + bk); if (Array.isArray(b)) b = b[0]; G.draw(b, 0, 0); }
    else G.rect(0, 0, 256, 144, '#3a3a4a');
    const imgs = ids.map(img);
    const total = imgs.reduce((s, i) => s + i.width, 0);
    const gap = ids.length > 1 ? Math.min(8, (244 - total) / (ids.length - 1)) : 0;
    let x = 128 - (total + gap * (ids.length - 1)) / 2;
    const placed = [];
    imgs.forEach((im, i) => {
      const feet = GROUND + sink(im.height);
      const y = feet - im.height;
      placed.push({ im, x: Math.round(x), y, id: ids[i] });
      x += im.width + gap;
    });
    for (const p of placed) G.draw(p.im, p.x, p.y);
    // party windows
    const th = G.WINDOW_THEMES.ink;
    PARTY.forEach((m, i) => {
      const wx = WIN.xs[i], wy = WIN.y;
      G.window(wx, wy, WIN.w, WIN.h);
      const tw = Math.min(52, G.textWidth(m.name)) + 8, tx = wx + Math.floor((WIN.w - tw) / 2);
      G.rect(tx, wy, tw, 5, th.fill);
      G.fitText(m.name, tx + 4, wy - 3, 52);
      [['H', m.hp], ['M', m.mp], ['W', m.wp]].forEach(([k, v], j) => {
        G.text(k, wx + 6, wy + 6 + j * 11);
        G.text(String(v), wx + 54, wy + 6 + j * 11, { align: 'right' });
      });
      G.rect(wx + 4, wy + 39, 15, 8, th.fill2);
      G.text(m.row, wx + 6, wy + 38, { color: m.row === '前' ? G.C.orange : G.C.cyan });
    });
    // command window + enemy names
    G.window(8, 150, 128, 68);
    [['戦う', 0, 0], ['リピート', 1, 0], ['オート', 0, 1], ['逃げる', 1, 1]].forEach(([s, cx, cy]) => {
      G.text(s, 8 + 16 + cx * 56, 150 + 10 + cy * 16, { color: s === '逃げる' ? G.C.gray : G.C.white });
    });
    G.cursor(8 + 6, 150 + 10, false);
    G.window(138, 150, 110, 68);
    const groups = [];
    names.forEach((n) => { const g = groups.find((q) => q[0] === n); if (g) g[1]++; else groups.push([n, 1]); });
    groups.slice(0, 4).forEach(([n, k], i) => {
      G.fitText(n, 138 + 9, 150 + 8 + i * 14, 110 - 22 - 8);
      G.text(String(k), 138 + 101, 150 + 8 + i * 14, { align: 'right' });
    });
    if (o.guide) {
      G.rect(0, WIN_BOTTOM, 256, 1 / 4, '#ff40ff');
      for (const p of placed) G.rect(p.x, p.y + 20, p.im.width, 1 / 4, '#40ffff');
    }
    if (o.caption) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.font = '20px monospace'; c.textBaseline = 'top'; c.textAlign = 'left';
      const s = o.caption + note;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 578, c.measureText(s).width + 16, 26);
      c.fillStyle = '#ffe890'; c.fillText(s, 8, 581);
      c.restore();
    }
    G.reset();
    return cv;
  }
  /** n scenes → one PNG: big = each at 4x alone; else 2x2 at 2x */
  function scenes(list, big, guide) {
    const cvs = list.map((q) => scene(q.ids, q.names, q.bg, { caption: q.caption, guide }));
    if (big) return cvs.map((c) => c.toDataURL());
    const out = [];
    for (let i = 0; i < cvs.length; i += 4) {
      const part = cvs.slice(i, i + 4);
      const [cv, c] = canvas(1024 + 8, 896 + 8, '#101014');
      part.forEach((s, k) => c.drawImage(s, (k % 2) * 516, Math.floor(k / 2) * 452, 512, 448));
      out.push(cv.toDataURL());
    }
    return out;
  }
  function zoom(ids, s, crop) {
    const imgs = ids.map(img);
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
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const [cv, c] = canvas(ids.length * (mw * s + 8) + 8, mh * s + 28);
    imgs.forEach((im, k) => {
      const x = 8 + k * (mw * s + 8);
      label(c, ids[k] + ' ' + im.width + 'x' + im.height + ' ' + colours(im) + 'c', x, 4);
      cell(c, x, 20, mw * s, mh * s, s);
      c.drawImage(im, x + Math.round((mw - im.width) / 2) * s, 20 + (mh - im.height) * s, im.width * s, im.height * s);
    });
    return cv.toDataURL();
  }
  return { setRoster, sheet, scenes, zoom, times };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const pageFile = path.join(OUT, '_sheet.html');
  const font = path.join(ROOT, 'assets/fonts/DotGothic16-Regular.ttf');
  fs.writeFileSync(pageFile, `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>@font-face{font-family:"DotGothic16";src:url("file://${font}") format("truetype");}</style></head><body>
<div style="font-family:DotGothic16">あ</div>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
</body></html>`);

  const browser = await playwright.chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text())) errors.push(m.text()); });
    await page.goto('file://' + pageFile);
    await page.evaluate(() => document.fonts.load('16px DotGothic16'));
    await page.evaluate((r) => window.SHEET.setRoster(r), ROSTER);
    const save = (name, url) => {
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log('sheet →', f);
    };
    const saveAll = (prefix, urls) => urls.forEach((u, i) => save(prefix + '_' + (i + 1), u));
    const big = flag('big'), guide = flag('guide');
    if (ONLY.includes('sheet')) save('sheet', await page.evaluate(([ids, s]) => SHEET.sheet(ids, s), [IDS, SCALE]));
    if (ONLY.includes('legacy')) save('legacy', await page.evaluate(([ids, s]) => SHEET.sheet(ids, s), [Object.keys(ROSTER.LEGACY), SCALE]));
    if (ONLY.includes('zoom')) save('zoom', await page.evaluate(([ids, s, c]) => SHEET.zoom(ids, s, c), [IDS, SCALE, CROP]));
    if (ONLY.includes('context')) {
      const list = IDS.map((id) => {
        const r = ROSTER.SPRITES[id] || [ROSTER.LEGACY[id] || 'cave', id];
        return { ids: [id], names: [r[1]], bg: r[0], caption: id + ' on bbg:' + r[0] };
      });
      saveAll('context', await page.evaluate(([l, b, g]) => SHEET.scenes(l, b, g), [list, big, guide]));
    }
    if (ONLY.includes('troops')) {
      const want = opt('ids', '') ? new Set(IDS) : null;
      const list = [];
      for (const [tid, [bg, mons]] of Object.entries(ROSTER.TROOPS)) {
        const sprites = mons.map((m) => (m[0] === '@' ? m.slice(1) : ROSTER.BOSSES[m][0]));
        if (want && !sprites.some((s) => want.has(s))) continue;
        const names = mons.map((m) => (m[0] === '@' ? { mummy: 'ミイラ', skeleton: '骸骨の水夫' }[m.slice(1)] || m : ROSTER.BOSSES[m][1]));
        list.push({ ids: sprites, names, bg, caption: tid + ' on bbg:' + bg });
      }
      saveAll('troops', await page.evaluate(([l, b, g]) => SHEET.scenes(l, b, g), [list, big, guide]));
    }
    const info = await page.evaluate(() => ({ times: SHEET.times, warned: Object.keys(RPG.Gfx._warned), pending: RPG.Art.PENDING || [] }));
    console.log('build ms:', Object.entries(info.times).map(([k, v]) => k + ' ' + v).join(', '));
    console.log('missing:', info.warned.join(' ') || '-');
    if (info.pending.length) console.log('stand-ins (R.Art.PENDING):', info.pending.join(' '));
    // errors from other owners' files (edited concurrently) are reported but do not fail the run
    const mine = (e) => /bosses|sheet_bosses|_sheet_page|mon:/.test(e) || !/\/src\//.test(e);
    for (const e of errors) console.log(mine(e) ? '[page]' : '[page, other owner]', e);
    const bossWarn = info.warned.filter((k) => IDS.includes(k.replace(/^mon:/, '')));
    if (errors.some(mine) || bossWarn.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
