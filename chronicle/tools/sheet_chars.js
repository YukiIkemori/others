#!/usr/bin/env node
// Contact sheets for the character / NPC / object / icon / face art (art review tool, owner art-chars A13).
//
//   node tools/sheet_chars.js [--out DIR] [--only a,b,...] [--scale N] [--cols N]
//                             [--ids id1,id2] [--npcs t1,t2] [--keys k1,k2]
//
// Sheets (PNG, nearest-neighbour upscaled, default 4x):
//   party     every party sprite (20 companions + 10 hero looks, or --ids): down0 down1 left0 left1 right0 right1 up0 up1
//   lineup    the 30 party sprites facing down at 3x and at 1x, then every town NPC type at the same
//             scale (DESIGN §5.3.7 / §11.3.2 distinguishability check: no two with the same hair part + body,
//             no party member that reads as a townsperson). The duplicate check is also printed.
//   npc       every 'npc:<type>' sheet (8 frames each; --npcs for a subset)
//   objects   obj:* (chest, chest_rare, sparkle, crest_glow, shadow, glimmer, quill, lantern, page, ship)
//   icons     every registered 'icon:<id>' at 4x and 1x, with a menu line of text next to it
//   faces     every registered 'face:<id>' at 2x on the default window colour
//   field     sprites standing on real field tiles at the game's 3x scale (party of 4, NPCs, chests, lantern)
//   zoom      (--keys) the given party:/npc: sheets at 8x for pixel review
// Loads only core + data + art sources (no game boot), so it works while
// other systems are mid-edit. Exit code 1 on any page error or console warning.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/chars'));
const ONLY = opt('only', 'party,lineup,npc,objects,icons,faces,field').split(',');
const SCALE = +opt('scale', 4);
const IDS = opt('ids', '');
const NPCS = opt('npcs', '');
const KEYS = opt('keys', '');
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
  function label(c, s, x, y, col, size) {
    c.font = (size || 12) + 'px monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y);
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
  function nameOf(id) {
    const d = R.DB.companions && R.DB.companions[id];
    if (d && d.name) return d.name;
    const m = /^hero_([mf])_(\w+)$/.exec(id);
    if (m) return '主人公 ' + (m[1] === 'f' ? '女' : '男') + ' ' + ((R.DB.heroTypes && R.DB.heroTypes[m[2]] && R.DB.heroTypes[m[2]].name) || m[2]);
    return '';
  }
  function describe(id) {
    const w = CA.parts.party[id]; if (!w) return '';
    const st = w.style || {};
    const hp = [].concat(w.hairPart).join('+');
    return hp + ' / ' + (st.variant || (w.gender === 'f' && st.bodyF) || st.body) + (st.hat ? ' / ' + st.hat : '') + (st.cape ? ' / ' + st.cape : '');
  }
  function party(ids, s, cols) { return grid(ids.map((id) => [id + ' ' + nameOf(id) + '  (' + describe(id) + ')', 'party:' + id]), s, cols); }
  function npc(types, s, cols) { return grid(types.map((t) => [t, 'npc:' + t]), s, cols); }
  function zoom(keys, s) { return grid(keys.map((k) => [k, k]), s, 1); }
  // everyone facing down on a grass strip at 3x, then the same at 1x (real size)
  function lineup(ids, npcs, s) {
    const cw = 16 * s + 8, per = 10;
    const bands = [['companions', ids.filter((i) => !/^hero_/.test(i))], ['hero', ids.filter((i) => /^hero_/.test(i))], ['npc', npcs]];
    let rows = 0; for (const [, l] of bands) rows += Math.ceil(l.length / per);
    const W = per * cw + 20, H = rows * (24 * s + 34) + bands.length * 20 + 24 * 3 + 60;
    const [cv, c] = canvas(Math.max(W, 60 + ids.length * 18), H + 30, '#4a7a44');
    const tile = G.has('tile:grass') ? G.get('tile:grass') : null;
    const t0 = Array.isArray(tile) ? tile[0] : tile;
    if (t0) for (let y = 0; y < H; y += 16 * s) for (let x = 0; x < cv.width; x += 16 * s) c.drawImage(t0, x, y, 16 * s, 16 * s);
    let y = 6;
    for (const [nm, list] of bands) {
      label(c, nm, 8, y, '#fff', 13); y += 18;
      list.forEach((id, i) => {
        const x = 10 + (i % per) * cw, yy = y + Math.floor(i / per) * (24 * s + 34);
        const key = nm === 'npc' ? 'npc:' + id : 'party:' + id;
        const sh = G.get(key);
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 2 * s, yy + 22 * s, 12 * s, 2 * s);
        c.drawImage(sh.down[0], x, yy, 16 * s, 24 * s);
        c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x - 2, yy + 24 * s + 2, cw - 4, 14);
        label(c, id.replace(/^hero_/, 'h_'), x, yy + 24 * s + 3, '#fff', 11);
      });
      y += Math.ceil(list.length / per) * (24 * s + 34);
    }
    // 1x strip
    label(c, '1x', 8, y + 4, '#fff', 13);
    let x = 40;
    for (const id of ids) { c.drawImage(G.get('party:' + id).down[0], x, y + 4); x += 18; }
    x = 40;
    for (const t of npcs) { c.drawImage(G.get('npc:' + t).down[0], x, y + 32); x += 18; if (x > cv.width - 20) break; }
    return cv.toDataURL();
  }
  function dupes(ids) {
    const seen = {}, out = [];
    for (const id of ids) {
      const w = CA.parts.party[id]; if (!w || w.hero) continue;
      const st = w.style || {};
      const k = [].concat(w.hairPart).join('+') + '|' + (st.variant || (w.gender === 'f' && st.bodyF) || st.body);
      if (seen[k]) out.push(seen[k] + ' = ' + id + ' (' + k + ')'); else seen[k] = id;
    }
    return out;
  }
  function objects(s) {
    const [cv, c] = canvas(1560, 32 * s * 3 + 190);
    let x = 8, y = 20;
    const put = (img, w, h, name) => {
      if (!img) return;
      cell(c, x, y, w * s, h * s, s); c.drawImage(img, x, y, w * s, h * s);
      if (name) label(c, name, x, y - 15);
      x += w * s + 6;
    };
    const frames = (key) => { const v = G.get(key); return Array.isArray(v) ? v : v && v.down ? v.down : [v]; };
    for (const k of ['chest', 'chest_rare']) { frames('obj:' + k).forEach((f, i) => put(f, 16, 16, i ? '' : k)); x += 12; }
    frames('obj:glimmer').forEach((f, i) => put(f, 16, 16, i ? '' : 'glimmer')); x += 12;
    put(frames('obj:quill')[0], 16, 16, 'quill'); x += 12;
    frames('obj:lantern').forEach((f, i) => put(f, 16, 24, i ? '' : 'lantern')); x += 12;
    const sh = G.get('obj:shadow'); put(sh, sh.width, sh.height, 'shadow');
    x = 8; y += 32 * s;
    frames('obj:sparkle').forEach((f, i) => put(f, 16, 16, i ? '' : 'sparkle')); x += 12;
    frames('obj:crest_glow').forEach((f, i) => put(f, 16, 16, i ? '' : 'crest_glow')); x += 12;
    frames('obj:page').forEach((f, i) => put(f, 16, 16, i ? '' : 'page'));
    x = 8; y += 32 * s;
    const ship = G.get('obj:ship');
    for (const d of ['down', 'left', 'right', 'up']) for (let f = 0; f < 2; f++) { if (x > 1300) break; put(ship[d][f], 32, 32, f ? '' : 'ship ' + d); }
    // on floors at 3x: chests on a dungeon floor, lantern on stone
    y += 32 * s + 26; x = 8;
    const floor = (id) => { const t = G.has(id) ? G.get(id) : null; return Array.isArray(t) ? t[0] : t; };
    const fl = floor('tile:cave:floor') || floor('tile:floor');
    for (let j = 0; j < 3; j++) for (let i = 0; i < 16; i++) if (fl) c.drawImage(fl, x + i * 48, y + j * 48, 48, 48);
    const on = (img, tx, ty) => img && c.drawImage(img, x + tx * 48 + 24 - img.width * 1.5, y + ty * 48 + 48 - img.height * 3, img.width * 3, img.height * 3);
    on(frames('obj:chest')[0], 1, 1); on(frames('obj:chest')[1], 3, 1); on(frames('obj:chest_rare')[0], 5, 1); on(frames('obj:chest_rare')[1], 7, 1);
    on(frames('obj:lantern')[0], 9, 1); on(frames('obj:lantern')[1], 11, 1); on(frames('obj:crest_glow')[1], 13, 1);
    return cv.toDataURL();
  }
  function icons(s) {
    const types = Object.keys(G._defs).filter((k) => k.startsWith('icon:')).map((k) => k.slice(5));
    const cw = 8 * s + 150, per = 8;
    const rows = Math.ceil(types.length / per);
    const [cv, c] = canvas(per * cw + 10, rows * (8 * s + 50) + 10, '#16203e');
    types.forEach((t, i) => {
      const x = (i % per) * cw + 8, y = Math.floor(i / per) * (8 * s + 50) + 6;
      label(c, t, x, y);
      const im = G.get('icon:' + t);
      c.drawImage(im, x, y + 16, 8 * s, 8 * s);
      c.drawImage(im, x + 8 * s + 6, y + 16);
      c.drawImage(im, x + 8 * s + 6, y + 30, 16, 16);
      c.fillStyle = '#fff'; c.font = '11px monospace'; c.fillText('鉄の剣', x + 8 * s + 26, y + 32);
    });
    return cv.toDataURL();
  }
  function faces(s) {
    const keys = Object.keys(G._defs).filter((k) => k.startsWith('face:'));
    const per = 10, cw = 32 * s + 10;
    const [cv, c] = canvas(per * cw + 16, Math.ceil(keys.length / per) * (32 * s + 24) + 10, '#0b1024');
    keys.forEach((k, i) => {
      const x = 8 + (i % per) * cw, y = 6 + Math.floor(i / per) * (32 * s + 24);
      c.fillStyle = '#16203e'; c.fillRect(x, y, 32 * s, 32 * s);
      c.drawImage(G.get(k), x, y, 32 * s, 32 * s);
      label(c, k.slice(5).replace(/^hero_/, 'h_'), x, y + 32 * s + 4, '#f0e8d0', 11);
    });
    return cv.toDataURL();
  }
  function field(ids, npcs, s) {
    // a scene on real field tiles at game scale: parties of 4 marching on grass and on a
    // town street, every townsperson on the street, chests and a rest lantern on a dungeon floor
    const tile = (id) => { let t = G.has(id) ? G.get(id) : null; return Array.isArray(t) ? t[0] : t; };
    const cols = 20, rows = 17;
    const [cv, c] = canvas(cols * 16 * s, rows * 16 * s, '#000');
    const grass = tile('tile:grass'), floor = tile('tile:town:floor') || tile('tile:floor'), cave = tile('tile:cave:floor') || floor;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const t = y < 5 ? grass : y < 15 ? floor : cave;
      if (t) c.drawImage(t, x * 16 * s, y * 16 * s, 16 * s, 16 * s);
    }
    const shadow = G.get('obj:shadow');
    const put = (img, tx, ty, sh) => {
      if (!img) return;
      if (sh !== false && shadow) c.drawImage(shadow, (tx * 16 + 1) * s, (ty * 16 + 12) * s, shadow.width * s, shadow.height * s);
      c.drawImage(img, (tx * 16 + 8 - img.width / 2) * s, (ty * 16 + 16 - img.height) * s, img.width * s, img.height * s);
    };
    const dirs = ['right', 'left', 'down', 'up'];
    for (let g = 0; g < 8; g++) {
      const members = ids.slice(g * 4, g * 4 + 4).concat(ids.slice(0, Math.max(0, g * 4 + 4 - ids.length))).slice(0, 4);
      const dir = dirs[g % 4], x0 = (g % 2) * 10 + 1, y0 = 1 + Math.floor(g / 2) * 2;
      members.forEach((id, i) => {
        const sh = G.get('party:' + id), tx = dir === 'right' ? x0 + 3 - i : x0 + i;
        put(sh[dir][i % 2], tx, y0);
      });
    }
    let tx = 1, ty = 9;
    npcs.forEach((t) => { put(G.get('npc:' + t)[['down', 'left', 'right'][tx % 3]][0], tx, ty); tx++; if (tx >= cols - 1) { tx = 1; ty += 2; } });
    const fr = (k) => { const v = G.get(k); return Array.isArray(v) ? v : [v]; };
    put(fr('obj:chest')[0], 2, 16, false); put(fr('obj:chest')[1], 4, 16, false); put(fr('obj:chest_rare')[0], 6, 16, false); put(fr('obj:chest_rare')[1], 8, 16, false);
    put(fr('obj:lantern')[0], 11, 16, false); put(G.get('npc:fine').down[0], 13, 16); put(G.get('npc:fine_fade').down[0], 15, 16, false);
    return cv.toDataURL();
  }
  return { party, npc, zoom, lineup, dupes, objects, icons, faces, field };
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
    const save = (name, url) => {
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log('sheet →', f);
    };
    const t0 = Date.now();
    const run = (js) => page.evaluate(js);
    const ids = IDS ? IDS.split(',') : await run(`RPG.Art.Chars.PARTY_IDS`);
    const npcs = NPCS ? NPCS.split(',') : await run(`RPG.Art.Chars.NPC_TYPES`);
    const J = JSON.stringify;
    if (ONLY.includes('party')) save('party', await run(`SHEET.party(${J(ids)}, ${SCALE}, ${COLS})`));
    if (ONLY.includes('lineup')) {
      save('lineup', await run(`SHEET.lineup(${J(ids)}, ${J(npcs.filter((t) => !['cat', 'dog', 'sheep', 'chicken', 'ghost'].includes(t)))}, 3)`));
      const d = await run(`SHEET.dupes(${J(ids)})`);
      console.log(d.length ? 'SAME hair part + body: ' + d.join(', ') : 'lineup: no two companions share hair part + body');
      if (d.length) errors.push('duplicate looks: ' + d.join(', '));
    }
    if (ONLY.includes('npc')) save('npc', await run(`SHEET.npc(${J(npcs)}, ${SCALE}, ${COLS})`));
    if (ONLY.includes('zoom') && KEYS) save('zoom', await run(`SHEET.zoom(${J(KEYS.split(','))}, ${Math.max(SCALE, 8)})`));
    if (ONLY.includes('objects')) save('objects', await run(`SHEET.objects(${SCALE})`));
    if (ONLY.includes('icons')) save('icons', await run(`SHEET.icons(${SCALE})`));
    if (ONLY.includes('faces')) save('faces', await run(`SHEET.faces(2)`));
    if (ONLY.includes('field')) save('field', await run(`SHEET.field(${J(ids)}, ${J(npcs)}, 3)`));
    const stats = await run(`(() => { const G = RPG.Gfx; return { defs: Object.keys(G._defs).length, cached: Object.keys(G._cache).length, warned: Object.keys(G._warned), pending: (RPG.Art.PENDING || []).filter((k) => /^(party|npc|obj|icon|face):/.test(k)) }; })()`);
    console.log('gfx defs', stats.defs, 'built', stats.cached, 'missing', stats.warned.join(' ') || '-', 'pending(A13)', stats.pending.join(' ') || '-', 'in', Date.now() - t0, 'ms');
    for (const e of errors) console.log('[page]', e);
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
