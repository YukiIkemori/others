#!/usr/bin/env node
// Contact sheets for the party battle sprites (Part A8, DESIGN §11.4.4.7; owner SV-ART).
//
//   node tools/sheet_battlers.js [--out DIR] [--only a,b,...] [--look ID] [--wtype W] [--looks a,b] [--scale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   lineup    all 30 looks: the field sprite (down[0], left[0]) at 2x next to the battle idle
//             frame 0 at 2x — do they read as the same person?
//   idle      all 30 looks, idle frames 0/1 and walk at 3x on a mid-grey
//   poses     one look (--look, default hero_m_warrior, --wtype sword): every pose and frame
//             at 3x, once plain and once with the anchors (head yellow, hand green, tip red,
//             cast cyan, box magenta, feet white)
//   weapons   the 11 weapon families on hero_m_warrior / hero_f_warrior (idle + the family's
//             attack frames), and every weapon's 8 directions
//   scene     backdrops grass and castle with 4 party members at the side-view positions
//             (front 192, middle 216, feet y 100/116/132/148; one weak, one ko) at 3x
//   grid      (--look, --wtype) every frame at 6x for pixel review
//   zoom      --looks at 8x: idle 0, the family's impact frame, weak 0, ko
// Loads only core + data + art (no game boot). Exit 1 on page errors / warnings.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/battlers'));
const ONLY = opt('only', 'lineup,idle,poses,weapons,scene').split(',');
const LOOKID = opt('look', 'hero_m_warrior');
const WTYPE = opt('wtype', 'sword');
const LOOKS = opt('looks', '');
const SCALE = +opt('scale', 3);

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
  const R = window.RPG, G = R.Gfx, A = R.Art, B = A.BATTLER;
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#3a3a48'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col, size) { c.font = (size || 12) + 'px monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y); }
  function cell(c, x, y, w, h, s, a, b) {
    for (let j = 0; j < h; j += 8 * s) for (let i = 0; i < w; i += 8 * s) {
      c.fillStyle = ((i + j) / (8 * s)) % 2 ? (a || '#8ea4b8') : (b || '#9cb2c4');
      c.fillRect(x + i, y + j, Math.min(8 * s, w - i), Math.min(8 * s, h - j));
    }
  }
  const put = (c, img, x, y, s) => c.drawImage(img, x, y, img.width * s, img.height * s);
  function anchors(c, f, x, y, s) {
    const dotp = (p, col) => { c.fillStyle = col; c.fillRect(x + p[0] * s, y + p[1] * s, s, s); };
    c.strokeStyle = '#ff40ff'; c.lineWidth = 1; c.strokeRect(x + f.box.x * s + 0.5, y + f.box.y * s + 0.5, f.box.w * s - 1, f.box.h * s - 1);
    dotp(f.feet, '#ffffff'); dotp(f.head, '#ffe020'); dotp(f.hit, '#ff9020'); dotp(f.hand, '#30e040'); dotp(f.tip, '#ff2020'); dotp(f.cast, '#20e0ff');
  }
  function lineup(ids) {
    const s = 2, cw = 16 * s * 2 + 48 * s + 24, ch = 48 * s + 22, cols = 5;
    const [cv, c] = canvas(cols * cw + 8, Math.ceil(ids.length / cols) * ch + 8);
    ids.forEach((id, k) => {
      const x = 8 + (k % cols) * cw, y = 6 + Math.floor(k / cols) * ch;
      const fs = G.get('party:' + id);
      cell(c, x, y + 14, cw - 12, 80 * 1 + 2, s);
      put(c, fs.down[0], x + 2, y + 14 + 32, s);
      put(c, fs.left[0], x + 2 + 34, y + 14 + 32, s);
      const sh = A.battler(id, { wtype: B.LOOK[id] ? defW(id) : 'sword' });
      put(c, sh.poses.idle.frames[0].img, x + 72, y + 14, s);
      label(c, id + (sh.pending ? ' PENDING' : ''), x, y, sh.pending ? '#ff8080' : '#f0e8d0', 11);
    });
    return cv.toDataURL();
  }
  // a plausible weapon per look for the lineup (their starting weapon family)
  const DEFW = { selma: 'sword', hagen: 'axe', dokka: 'club', basil: 'staff', bartolo: 'spear', viola: 'whip', shigure: 'katana',
    rouga: 'fist', titta: 'dagger', brigitta: 'greatsword', sylvain: 'bow', zafira: 'dagger', ferno: 'bow', belladonna: 'whip',
    boden: 'club', teo: 'staff', ilse: 'staff', morga: 'staff', marta: 'staff', noela: 'bow' };
  const HT = { warrior: 'sword', ranger: 'bow', mage: 'staff', spellblade: 'sword', wanderer: 'dagger' };
  function defW(id) { if (DEFW[id]) return DEFW[id]; const m = /hero_[mf]_(\w+)/.exec(id); return m ? HT[m[1]] : 'sword'; }
  function idle(ids) {
    const s = 3, cw = 48 * s * 4 + 20, ch = 40 * s + 22, cols = 2;
    const [cv, c] = canvas(cols * cw + 8, Math.ceil(ids.length / cols) * ch + 8, '#505060');
    ids.forEach((id, k) => {
      const x = 8 + (k % cols) * cw, y = 6 + Math.floor(k / cols) * ch;
      const sh = A.battler(id, { wtype: defW(id) });
      label(c, id + ' / ' + sh.wtype + ' (' + A.BATTLER.LOOK[id].build + (A.BATTLER.LOOK[id].height ? ' ' + A.BATTLER.LOOK[id].height : '') + ')', x, y, '#f0e8d0', 11);
      const fr = [sh.poses.idle.frames[0], sh.poses.idle.frames[1], sh.poses.walk.frames[0], sh.poses.walk.frames[1]];
      fr.forEach((f, i) => { cell(c, x + i * 48 * s, y + 14, 48 * s, 40 * s, s, '#6a7484', '#727c8c'); put(c, f.img, x + i * 48 * s, y + 14, s); });
    });
    return cv.toDataURL();
  }
  function poses(look, wtype, withAnchors) {
    const s = 3, sh = A.battler(look, { wtype });
    const cw = 48 * s + 6, ch = 40 * s + 18;
    const [cv, c] = canvas(8 + 80 + 3 * cw, 8 + B.POSES.length * ch, '#404050');
    B.POSES.forEach((p, r) => {
      const P = sh.poses[p], y = 6 + r * ch;
      label(c, p, 8, y + 40, '#f0e8d0', 13);
      label(c, 'hold ' + P.hold.join(',') + (P.impact != null ? ' imp ' + P.impact : ''), 8, y + 58, '#a0a0b0', 10);
      P.frames.forEach((f, i) => {
        const x = 88 + i * cw;
        cell(c, x, y, 48 * s, 40 * s, s, '#6a7484', '#727c8c');
        put(c, f.img, x, y, s);
        if (withAnchors) anchors(c, f, x, y, s);
      });
    });
    label(c, look + ' / ' + wtype, 8, 2, '#ffe080', 12);
    return cv.toDataURL();
  }
  function weapons(looks) {
    const s = 2, fam = B.FAMILY, cw = 48 * s + 4, ch = 40 * s + 6;
    const ws = Object.keys(fam);
    const [cv, c] = canvas(8 + 90 + looks.length * 5 * cw + 20, 8 + ws.length * ch + 11 * 60, '#404050');
    ws.forEach((w, r) => {
      const y = 6 + r * ch;
      label(c, w + ' → ' + fam[w], 6, y + 30, '#f0e8d0', 11);
      looks.forEach((look, li) => {
        const sh = A.battler(look, { wtype: w });
        const fr = [sh.poses.idle.frames[0]].concat(sh.poses[fam[w]].frames).concat([sh.poses.victory.frames[0]]);
        fr.forEach((f, i) => { const x = 96 + li * (5 * cw + 20) + i * cw; cell(c, x, y, 48 * s, 40 * s, s, '#6a7484', '#727c8c'); put(c, f.img, x, y, s); });
      });
    });
    // every weapon in its 8 directions (grids at 4x, grip marked)
    const BT = R.Art._Battlers, pal = BT.weaponPal(R.Art.Chars.partyPalette(R.Art.Chars.parts.party.hero_m_warrior), 'normal');
    let y = 12 + ws.length * ch;
    ws.filter((w) => w !== 'fist').forEach((w) => {
      let x = 96;
      label(c, w, 6, y + 4, '#f0e8d0', 11);
      BT.DIRS.forEach((d) => {
        const g = BT.weaponGrid(w, d);
        for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { const ch2 = g.g[j][i]; if (ch2 !== '.') { c.fillStyle = pal[ch2]; c.fillRect(x + i * 2, y + j * 2, 2, 2); } }
        c.fillStyle = '#30e040'; c.fillRect(x + g.grip[0] * 2, y + g.grip[1] * 2, 2, 2);
        if (g.tip) { c.fillStyle = '#ff2020'; c.fillRect(x + g.tip[0] * 2, y + g.tip[1] * 2, 2, 2); }
        x += g.w * 2 + 8;
      });
      y += 60;
    });
    return cv.toDataURL();
  }
  function scene(ids, bgs) {
    const s = 3;
    const [cv, c] = canvas(256 * s, bgs.length * (152 * s + 8), '#000');
    bgs.forEach((bg, bi) => {
      const [fc, fx] = canvas(256, 152, '#000');
      const img = G.get('bbg:' + bg);
      fx.drawImage(img, 0, 0);
      for (let y = 144; y < 152; y++) fx.drawImage(img, 0, 143, 256, 1, 0, y, 256, 1);
      const ys = [100, 116, 132, 148], xs = [192, 216, 192, 216], zig = [0, 4, 0, 4];
      ids.slice(bi * 4, bi * 4 + 4).forEach((id, i) => {
        const sh = A.battler(id, { wtype: defW(id) });
        const pose = i === 2 && bi === 0 ? 'weak' : i === 3 && bi === 0 ? 'ko' : i === 1 && bi === 1 ? 'victory' : 'idle';
        const f = sh.poses[pose].frames[0];
        const X = xs[i] + zig[i], Y = ys[i];
        // shadow: box.w wide, 3 high, 50% checker
        fx.fillStyle = '#000';
        for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < f.box.w; xx++) {
          const dx = xx - f.box.w / 2 + 0.5, dy = yy - 1;
          if ((dx * dx) / ((f.box.w / 2) * (f.box.w / 2)) + (dy * dy) / 2.2 > 1) continue;
          if ((xx + yy) % 2) fx.fillRect(X - Math.floor(f.box.w / 2) + xx, Y - 1 + yy, 1, 1);
        }
        fx.drawImage(f.img, X - 24, Y - 39);
      });
      // a monster on the left for scale
      if (G.has('mon:slime')) { const m = G.get('mon:slime'); fx.drawImage(Array.isArray(m) ? m[0] : m, 70, 100); }
      c.drawImage(fc, 0, bi * (152 * s + 8), 256 * s, 152 * s);
    });
    return cv.toDataURL();
  }
  function zoom(looks) {
    const s = 8, cw = 48 * s + 8, ch = 40 * s + 20;
    const [cv, c] = canvas(8 + 4 * cw, 8 + looks.length * ch, '#404050');
    looks.forEach((spec, r) => {
      const [look, w] = spec.split(':');
      const sh = A.battler(look, { wtype: w || defW(look) });
      const fam = sh.family;
      const fr = [sh.poses.idle.frames[0], sh.poses[fam].frames[sh.poses[fam].impact], sh.poses.weak.frames[0], sh.poses.ko.frames[0]];
      label(c, look + ' / ' + sh.wtype, 8, 4 + r * ch, '#ffe080', 12);
      fr.forEach((f, i) => { const x = 8 + i * cw, y = 18 + r * ch; cell(c, x, y, 48 * s, 40 * s, s, '#6a7484', '#727c8c'); put(c, f.img, x, y, s); });
    });
    return cv.toDataURL();
  }
  // every frame of one look at 6x in a grid (pixel review)
  function grid(look, wtype) {
    const s = 6, sh = A.battler(look, { wtype }), fr = [];
    B.POSES.forEach((p) => sh.poses[p].frames.forEach((f, i) => fr.push([p + i, f])));
    const cols = 6, cw = 48 * s + 6, ch = 40 * s + 18;
    const [cv, c] = canvas(8 + cols * cw, 8 + Math.ceil(fr.length / cols) * ch, '#404050');
    fr.forEach(([n, f], k) => { const x = 8 + (k % cols) * cw, y = 4 + Math.floor(k / cols) * ch; label(c, n, x, y, '#ffe080', 12); cell(c, x, y + 14, 48 * s, 40 * s, s, '#6a7484', '#727c8c'); put(c, f.img, x, y + 14, s); });
    return cv.toDataURL();
  }
  return { lineup, idle, poses, weapons, scene, zoom, grid, defW };
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
  try {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto('file://' + page_file);
    await page.waitForTimeout(200);
    const save = (name, url) => { const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('sheet →', f); };
    const run = (js) => page.evaluate(js);
    const J = JSON.stringify;
    const t0 = Date.now();
    const ids = await run('RPG.Art.Chars.PARTY_IDS');
    if (ONLY.includes('lineup')) save('lineup', await run(`SHEET.lineup(${J(ids)})`));
    if (ONLY.includes('idle')) save('idle', await run(`SHEET.idle(${J(ids)})`));
    if (ONLY.includes('poses')) {
      save('poses_' + LOOKID + '_' + WTYPE, await run(`SHEET.poses(${J(LOOKID)}, ${J(WTYPE)}, false)`));
      save('poses_' + LOOKID + '_' + WTYPE + '_anchors', await run(`SHEET.poses(${J(LOOKID)}, ${J(WTYPE)}, true)`));
    }
    if (ONLY.includes('weapons')) save('weapons', await run(`SHEET.weapons(['hero_m_warrior', 'hero_f_warrior'])`));
    if (ONLY.includes('scene')) save('scene', await run(`SHEET.scene(${J(LOOKS ? LOOKS.split(',') : ['hero_m_warrior', 'selma', 'hagen', 'ilse', 'hero_f_mage', 'rouga', 'dokka', 'noela'])}, ['grass', 'castle'])`));
    if (ONLY.includes('grid')) save('grid_' + LOOKID + '_' + WTYPE, await run(`SHEET.grid(${J(LOOKID)}, ${J(WTYPE)})`));
    if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${J(LOOKS ? LOOKS.split(',') : ['hero_m_warrior', 'selma', 'dokka'])})`));
    const st = await run(`(() => ({ pending: (RPG.Art.PENDING || []).filter((k) => /^btl:/.test(k)), warned: Object.keys(RPG.Gfx._warned) }))()`);
    console.log('pending(btl)', st.pending.join(' ') || '-', 'missing', st.warned.join(' ') || '-', 'in', Date.now() - t0, 'ms');
    if (st.pending.length) errors.push('pending battlers: ' + st.pending.join(' '));
    for (const e of errors) console.log('[page]', e);
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
