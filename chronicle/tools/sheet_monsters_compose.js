#!/usr/bin/env node
// Contact sheets and pixel checks for the composed regular monsters (A14a mons-parts, DESIGN §9.4.3–§9.4.6).
//
//   node tools/sheet_monsters_compose.js [--out DIR] [--only MODES] [--ids a,b] [--bases a,b]
//                                        [--scale N] [--with DIR] [--json FILE]
//
// Modes (comma separated, default "sheet,lineage,context"):
//   sheet     every id of R.Art.MON_COMPOSE_MOBS, 48 per page (8 × 6), 2× on a checker cell, with the
//             id and the monster's name (R.DB.monsters) → sheet_1.png … sheet_5.png
//   lineage   one row per lineage (all stages side by side, 3×) → lineage_1.png …
//   context   stages standing on real battle backdrops at 2×, with the 4 party windows of §11.5.1 → context_*.png
//   zoom      --ids at --scale (default 6) → zoom.png
//   anchors   --bases (default: every base in MON_ANCHORS) at 8× with a pixel grid and the anchor markers
//   parts     every part id of R.Art.PARTS on three reference bases (s / m / l) → parts_*.png
//   filters   the six filters on reference bases → filters.png
//   check     pixel checks, printed as JSON (see check() below; tools/check_mons-parts.js uses it)
// --with DIR loads every .js in DIR after src/ (fixtures, e.g. tools/fixtures/mons-parts).
// Loads core(ns,input,gfx) + data + art only (no boot), so it works while other systems are mid-edit.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/monsters_compose'));
const ONLY = opt('only', 'sheet,lineage,context').split(',');
const IDS = opt('ids', '') ? opt('ids', '').split(',') : null;
const BASES = opt('bases', '') ? opt('bases', '').split(',') : null;
const SCALE = +opt('scale', 0);
const WITH = opt('with', '');
const JSON_OUT = opt('json', '');

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['data', 'art']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  if (WITH) {
    const dir = path.resolve(WITH);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js') && !/^(test|check)_/.test(path.basename(f))).sort((a, b) => a.localeCompare(b)));
  }
  return list;
}

// ---------------------------------------------------------------- page code
const PAGE = String.raw`
window.SHEET = (function () {
  const R = window.RPG, G = R.Gfx, A = R.Art;
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 };
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#2c2c3a'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col, px) {
    c.font = (px || 12) + 'px monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y);
  }
  let DARK = false;
  function cell(c, x, y, w, h, s) {
    const q = Math.max(4, 4 * s);
    for (let j = 0; j < h; j += q) for (let i = 0; i < w; i += q) {
      c.fillStyle = DARK ? (((i + j) / q) % 2 ? '#3c4250' : '#444a5a') : ((i + j) / q) % 2 ? '#8ea4b8' : '#9cb2c4';
      c.fillRect(x + i, y + j, Math.min(q, w - i), Math.min(q, h - j));
    }
  }
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  const img = (id) => one(G.get('mon:' + id));
  const nameOf = (id) => (R.DB && R.DB.monsters && R.DB.monsters[id] ? R.DB.monsters[id].name : '');
  const mobIds = () => Object.keys(A.MON_COMPOSE_MOBS || {});

  /** 48 per page: 8 columns × 6 rows, each sprite at 2× in a 64×64 slot (cell 136 × 158) */
  function sheet(ids, perPage, s) {
    const pages = [];
    const cols = 8, cw = 64 * s + 8, ch = 64 * s + 30;
    for (let p = 0; p * perPage < ids.length; p++) {
      const list = ids.slice(p * perPage, (p + 1) * perPage);
      const rows = Math.ceil(list.length / cols);
      const [cv, c] = canvas(cols * cw + 8, rows * ch + 8);
      list.forEach((id, k) => {
        const x = 8 + (k % cols) * cw, y = 4 + Math.floor(k / cols) * ch;
        const im = img(id);
        cell(c, x, y + 26, 64 * s, 64 * s, 1);
        c.drawImage(im, x + ((64 - im.width) * s) / 2, y + 26 + (64 - im.height) * s, im.width * s, im.height * s);
        label(c, id, x, y, '#f0e8a0', 11);
        label(c, nameOf(id), x, y + 13, '#e8e8f0', 11);
      });
      pages.push(cv.toDataURL());
    }
    return pages;
  }
  /** one row per lineage (id prefix before the last _n), all stages side by side */
  function lineage(ids, s, perPage) {
    const groups = {};
    for (const id of ids) { const k = id.replace(/_\d+$/, ''); (groups[k] = groups[k] || []).push(id); }
    const keys = Object.keys(groups), out = [];
    const cw = 64 * s + 10, ch = 64 * s + 18;
    for (let p = 0; p * perPage < keys.length; p++) {
      const list = keys.slice(p * perPage, (p + 1) * perPage);
      const [cv, c] = canvas(110 + 5 * cw, list.length * ch + 8);
      list.forEach((k, r) => {
        const y = 4 + r * ch;
        label(c, k, 6, y + 30, '#f0e8a0', 14);
        groups[k].forEach((id, j) => {
          const x = 110 + j * cw, im = img(id);
          cell(c, x, y + 14, 64 * s, 64 * s, 1);
          c.drawImage(im, x + ((64 - im.width) * s) / 2, y + 14 + (64 - im.height) * s, im.width * s, im.height * s);
          label(c, id + ' ' + nameOf(id), x, y, '#e8e8f0', 11);
        });
      });
      out.push(cv.toDataURL());
    }
    return out;
  }
  function windows(c, s, oy) {
    for (const x of WIN.xs) {
      c.fillStyle = 'rgba(16,24,72,0.92)'; c.fillRect(x * s, oy + WIN.y * s, WIN.w * s, WIN.h * s);
      c.strokeStyle = '#e8e8f0'; c.lineWidth = s; c.strokeRect(x * s + 2 * s, oy + (WIN.y + 2) * s, (WIN.w - 4) * s, (WIN.h - 4) * s);
    }
  }
  /** battle-scene layout on a backdrop (feet on GROUND=130), with the 4 party windows */
  function context(scenes, s) {
    const W = 256, H = 144, GROUND = 130;
    const [cv, c] = canvas(W * s, scenes.length * (H * s + 6), '#000');
    scenes.forEach((sc, gi) => {
      const oy = gi * (H * s + 6);
      let b = G.has('bbg:' + sc.bg) ? G.get('bbg:' + sc.bg) : null;
      b = one(b);
      if (b) c.drawImage(b, 0, oy, W * s, H * s); else { c.fillStyle = '#5a8a4a'; c.fillRect(0, oy, W * s, H * s); }
      const ims = sc.ids.map((m) => (m.slice(0, 5) === 'gold:' ? G.variant('mon:' + m.slice(5), { tint: '#ffd24a' }) : img(m)));
      const total = ims.reduce((a, i) => a + i.width, 0);
      const gap = ims.length > 1 ? Math.min(8, (244 - total) / (ims.length - 1)) : 0;
      let x = 128 - (total + gap * (ims.length - 1)) / 2;
      ims.forEach((im) => { c.drawImage(im, Math.round(x) * s, oy + (GROUND - im.height) * s, im.width * s, im.height * s); x += im.width + gap; });
      windows(c, s, oy);
      label(c, sc.bg + ': ' + sc.ids.join(' '), 6, oy + H * s - 16, '#ffffff', 12);
    });
    return cv.toDataURL();
  }
  /** ids in rows of cols, each in a 64×64 slot at scale s (close review of many ids) */
  function grid(ids, s, cols) {
    const cw = 64 * s + 8, ch = 64 * s + 20;
    const rows = Math.ceil(ids.length / cols);
    const [cv, c] = canvas(cols * cw + 8, rows * ch + 8);
    ids.forEach((id, k) => {
      const x = 8 + (k % cols) * cw, y = 4 + Math.floor(k / cols) * ch;
      const im = img(id);
      const q = Math.max(1, Math.floor((64 * s) / Math.max(im.width, im.height))); // fill the slot
      cell(c, x, y + 16, 64 * s, 64 * s, s);
      c.drawImage(im, x + (64 * s - im.width * q) / 2, y + 16 + (64 * s - im.height * q), im.width * q, im.height * q);
      label(c, id + ' ' + nameOf(id), x, y, '#f0e8a0', 13);
    });
    return cv.toDataURL();
  }
  function zoom(ids, s) {
    const ims = ids.map(img);
    const mw = Math.max(...ims.map((i) => i.width)), mh = Math.max(...ims.map((i) => i.height));
    const [cv, c] = canvas(ids.length * (mw * s + 8) + 8, mh * s + 28);
    ims.forEach((im, k) => {
      const x = 8 + k * (mw * s + 8);
      label(c, ids[k], x, 4);
      cell(c, x, 20, mw * s, mh * s, s);
      c.drawImage(im, x + ((mw - im.width) * s) / 2, 20 + (mh - im.height) * s, im.width * s, im.height * s);
    });
    return cv.toDataURL();
  }
  const MARK = { head: '#ff4040', brow: '#ff9030', eyes: '#40ff40', mouth: '#ff40ff', neck: '#40c0ff', back: '#ffff40',
    body: '#ffffff', hand: '#40ffff', hand2: '#4080ff', tail: '#c080ff', feet: '#ff80a0' };
  /** bases at scale s with a pixel grid, coordinate ticks and the anchor markers */
  function anchors(bases, s) {
    const out = [];
    for (const b of bases) {
      const im = one(G.get('mon:' + b));
      const W = im.width, H = im.height;
      const [cv, c] = canvas(W * s + 150, H * s + 40, '#20202a');
      const ox = 24, oy = 24;
      cell(c, ox, oy, W * s, H * s, 2);
      c.drawImage(im, ox, oy, W * s, H * s);
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1;
      for (let i = 0; i <= W; i++) { c.beginPath(); c.moveTo(ox + i * s + 0.5, oy); c.lineTo(ox + i * s + 0.5, oy + H * s); c.stroke(); }
      for (let j = 0; j <= H; j++) { c.beginPath(); c.moveTo(ox, oy + j * s + 0.5); c.lineTo(ox + W * s, oy + j * s + 0.5); c.stroke(); }
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      for (let i = 0; i <= W; i += 4) { c.beginPath(); c.moveTo(ox + i * s + 0.5, oy); c.lineTo(ox + i * s + 0.5, oy + H * s); c.stroke(); if (i % 8 === 0) label(c, String(i), ox + i * s - 4, 6, '#c0c0d0', 11); }
      for (let j = 0; j <= H; j += 4) { c.beginPath(); c.moveTo(ox, oy + j * s + 0.5); c.lineTo(ox + W * s, oy + j * s + 0.5); c.stroke(); if (j % 8 === 0) label(c, String(j), 2, oy + j * s - 5, '#c0c0d0', 11); }
      const an = A.monAnchors ? A.monAnchors(b) : A.MON_ANCHORS && A.MON_ANCHORS[b];
      let ly = oy;
      label(c, b + ' ' + W + 'x' + H, ox + W * s + 8, ly, '#ffffff', 13); ly += 18;
      if (an) {
        for (const k in MARK) {
          const v = an[k];
          if (!v) continue;
          const pts = k === 'eyes' ? v : [v];
          for (const p of pts) {
            c.strokeStyle = MARK[k]; c.lineWidth = 2;
            c.strokeRect(ox + p[0] * s + 1, oy + p[1] * s + 1, s - 2, s - 2);
            c.beginPath(); c.moveTo(ox + p[0] * s + s / 2, oy + p[1] * s - s); c.lineTo(ox + p[0] * s + s / 2, oy + p[1] * s + 2 * s); c.stroke();
          }
          label(c, k + ' ' + JSON.stringify(v), ox + W * s + 8, ly, MARK[k], 11); ly += 14;
        }
        if (an.headW) { label(c, 'headW ' + an.headW, ox + W * s + 8, ly, '#ffffff', 11); ly += 14; }
      }
      out.push([b, cv.toDataURL()]);
    }
    return out;
  }
  /** every part on reference bases (one row per part) */
  function parts(refs, s, perPage, ids) {
    const pids = ids || Object.keys(A.PARTS || {});
    const out = [];
    const cw = 64 * s + 8, ch = 64 * s + 18;
    for (let p = 0; p * perPage < pids.length; p++) {
      const list = pids.slice(p * perPage, (p + 1) * perPage);
      const [cv, c] = canvas(120 + refs.length * cw, list.length * ch + 8);
      list.forEach((pid, r) => {
        const y = 4 + r * ch;
        label(c, pid, 6, y + 30, '#f0e8a0', 13);
        refs.forEach((ref, j) => {
          const x = 120 + j * cw;
          const opts = Object.assign({}, (ref.opts && ref.opts[pid]) || {});
          let im;
          try { im = A.compose(ref.base, ref.hsb || {}, [[pid, opts]], null, 'parts:' + pid + ':' + ref.base); } catch (e) { im = G.placeholder(16, 16); console.error(pid, ref.base, e); }
          cell(c, x, y + 14, 64 * s, 64 * s, 1);
          c.drawImage(im, x + ((64 - im.width) * s) / 2, y + 14 + (64 - im.height) * s, im.width * s, im.height * s);
          label(c, ref.base, x, y, '#c0c0d0', 11);
        });
      });
      out.push(cv.toDataURL());
    }
    return out;
  }
  function filters(refs, s) {
    const fl = Object.keys(A.FILTERS || {});
    const cw = 64 * s + 8, ch = 64 * s + 18;
    const [cv, c] = canvas(90 + refs.length * cw, (fl.length + 1) * ch + 8);
    ['(none)'].concat(fl).forEach((f, r) => {
      const y = 4 + r * ch;
      label(c, f, 6, y + 30, '#f0e8a0', 13);
      refs.forEach((b, j) => {
        const x = 90 + j * cw;
        const im = A.compose(b, {}, [], f === '(none)' ? null : f, 'filters:' + f + ':' + b);
        cell(c, x, y + 14, 64 * s, 64 * s, 1);
        c.drawImage(im, x + ((64 - im.width) * s) / 2, y + 14 + (64 - im.height) * s, im.width * s, im.height * s);
        label(c, b, x, y, '#c0c0d0', 11);
      });
    });
    return cv.toDataURL();
  }
  /** pixel checks for every MON_COMPOSE_MOBS id (numbers for the tests) */
  function check() {
    const ids = mobIds(), res = { ids: ids.length, items: {}, errors: [], warnings: [], ms: 0 };
    const t0 = performance.now();
    const hashes = {};
    for (const id of ids) {
      const e = A.MON_COMPOSE_MOBS[id];
      const t1 = performance.now();
      const cv = img(id);
      const ms = performance.now() - t1;
      const base = one(G.get('mon:' + e[0]));
      const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
      let semi = 0, opaque = 0, bottom = -1, top = H, hash = 2166136261;
      const mask = [];
      for (let i = 0; i < W * H; i++) {
        const a = d[i * 4 + 3];
        if (a && a < 255) semi++;
        if (a) { opaque++; const y = Math.floor(i / W); if (y > bottom) bottom = y; if (y < top) top = y; }
        mask.push(a ? 1 : 0);
        hash = Math.imul(hash ^ (a ? (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2] : 0x1000001), 16777619) >>> 0;
      }
      const st = cv._compose || {};
      const item = { base: e[0], w: W, h: H, bw: base.width, bh: base.height, semi, opaque, top, bottom, ms: Math.round(ms * 10) / 10,
        hash: hash.toString(16), partPx: st.partPx || 0, filter: e[3] || null, parts: (e[2] || []).map((p) => p[0]), missing: st.missing || [] };
      res.items[id] = item;
      (hashes[item.hash] = hashes[item.hash] || []).push(id);
      item.mask = mask.join('');
    }
    // lineage distinctness: mask XOR against every other stage of the same lineage (+ filter / part pixels)
    const groups = {};
    for (const id of ids) { const k = id.replace(/_\d+$/, ''); (groups[k] = groups[k] || []).push(id); }
    for (const k in groups) {
      const g = groups[k];
      for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        const a = res.items[g[i]], b = res.items[g[j]];
        let x = 0;
        if (a.mask.length === b.mask.length) { for (let q = 0; q < a.mask.length; q++) if (a.mask[q] !== b.mask[q]) x++; } else x = -1;
        (a.xor = a.xor || {})[g[j]] = x; (b.xor = b.xor || {})[g[i]] = x;
      }
    }
    for (const id of ids) delete res.items[id].mask;
    res.dupes = Object.values(hashes).filter((l) => l.length > 1);
    res.ms = Math.round(performance.now() - t0);
    res.warned = Object.keys(G._warned);
    return res;
  }
  return { sheet, lineage, context, zoom, grid, anchors, parts, filters, check, mobIds, dark: (v) => { DARK = !!v; } };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const pageFile = path.join(OUT, '_sheet.html');
  fs.writeFileSync(pageFile, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
</body></html>`);

  const browser = await playwright.chromium.launch();
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text())) errors.push(m.text()); });
    await page.goto('file://' + pageFile);
    await page.waitForTimeout(150);
    const save = (name, url) => {
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log('sheet →', f);
    };
    const run = (js) => page.evaluate(js);
    const t0 = Date.now();
    const ids = IDS || (await run('SHEET.mobIds()'));
    if (args.includes('--dark')) await run('SHEET.dark(true)');
    if (ONLY.includes('sheet')) (await run(`SHEET.sheet(${JSON.stringify(ids)}, 48, ${SCALE || 2})`)).forEach((u, i) => save('sheet_' + (i + 1), u));
    if (ONLY.includes('lineage')) (await run(`SHEET.lineage(${JSON.stringify(ids)}, ${SCALE || 2}, 14)`)).forEach((u, i) => save('lineage_' + (i + 1), u));
    if (ONLY.includes('context')) {
      const scenes = [
        { bg: 'grass', ids: ['jelly_1', 'jelly_2', 'jelly_4', 'gold:jelly_3', 'jelly_5'] },
        { bg: 'forest', ids: ['bee_5', 'plant_5', 'fairy_4', 'treant_4'] },
        { bg: 'cave', ids: ['skeleton_3', 'skeleton_5', 'goblin_4', 'goblin_5'] },
        { bg: 'desert', ids: ['scorpion_5', 'mummy_5', 'cactus_4', 'snake_3'] },
        { bg: 'snow', ids: ['wolf_5', 'frostling_5', 'yeti_3'] },
        { bg: 'volcano', ids: ['salamander_5', 'imp_4', 'chimera_3'] },
        { bg: 'tower', ids: ['eyeball_5', 'armor_3', 'demon_3'] },
        { bg: 'shrine', ids: ['quicksilver_2', 'mirror_2', 'platinum_2', 'paper_3'] },
      ];
      const pick = IDS ? [{ bg: opt('bg', 'grass'), ids: IDS.slice(0, 5) }] : scenes;
      for (let i = 0; i < pick.length; i += 4) save('context_' + (i / 4 + 1), await run(`SHEET.context(${JSON.stringify(pick.slice(i, i + 4))}, 2)`));
    }
    if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${JSON.stringify(ids)}, ${SCALE || 6})`));
    if (ONLY.includes('grid')) save('grid', await run(`SHEET.grid(${JSON.stringify(ids)}, ${SCALE || 4}, ${+opt('cols', 4)})`));
    if (ONLY.includes('anchors')) {
      const bases = BASES || (await run('Object.keys(RPG.Art.MON_ANCHORS || {})'));
      for (const [b, u] of await run(`SHEET.anchors(${JSON.stringify(bases)}, ${SCALE || 8})`)) save('anchors_' + b, u);
    }
    if (ONLY.includes('parts')) {
      const refs = JSON.parse(opt('refs', 'null')) || [{ base: 'jelly' }, { base: 'goblin' }, { base: 'orc' }];
      const pids = opt('pids', '') ? opt('pids', '').split(',') : null;
      (await run(`SHEET.parts(${JSON.stringify(refs)}, ${SCALE || 2}, 12, ${JSON.stringify(pids)})`)).forEach((u, i) => save('parts_' + (i + 1), u));
    }
    if (ONLY.includes('filters')) save('filters', await run(`SHEET.filters(${JSON.stringify(BASES || ['jelly', 'beetle', 'wisp', 'wolf', 'ghost'])}, ${SCALE || 2})`));
    if (ONLY.includes('check')) {
      const res = await run('SHEET.check()');
      const txt = JSON.stringify(res);
      if (JSON_OUT) fs.writeFileSync(JSON_OUT, txt); else console.log(txt);
    }
    const stats = await run(`(() => ({ warned: Object.keys(RPG.Gfx._warned) }))()`);
    console.log('built in', Date.now() - t0, 'ms; missing:', stats.warned.join(' ') || '-');
  } finally {
    await browser.close();
  }
  for (const e of errors) console.log('[page]', e);
  if (errors.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
