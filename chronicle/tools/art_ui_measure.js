#!/usr/bin/env node
// Measure night-scene tone targets (STYLE_REFERENCE §5.2 / §9) on rendered mocks.
//   node tools/art_ui_measure.js [png …]   (default: the field/battle mocks in design/art_proto/ui/out)
// Each image is shrunk to 320×180 (area average) like the reference measurement; the UI is NOT
// excluded, so run it on the *_noui renders for the art-only numbers (art_ui_shot.js "<view>&noui").
'use strict';
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'design/art_proto/ui/out');
(async () => {
  let files = process.argv.slice(2);
  if (!files.length) files = ['town_noui', 'field_noui', 'dungeon_noui', 'battle_noui', 'town', 'field', 'dungeon', 'battle', 'title'].map((n) => path.join(OUT, n + '.png'));
  const b = await playwright.chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await (await b.newContext()).newPage();
  await page.goto('file://' + path.join(OUT, '..', 'index.html') + '?view=none');
  for (const f of files) {
    const r = await page.evaluate(async (url) => {
      const img = new Image(); img.src = url; await img.decode().catch(() => null);
      if (!img.width) return null;
      const W = 320, H = img.height > img.width ? 569 : 180;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data, n = W * H;
      const L = new Float32Array(n), hs = [];
      const lin = (v) => v / 255;
      for (let i = 0; i < n; i++) {
        const r = lin(d[i * 4]), g = lin(d[i * 4 + 1]), bb = lin(d[i * 4 + 2]);
        L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * bb;
        const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb), s = mx ? (mx - mn) / mx : 0;
        let h = 0; if (mx !== mn) { if (mx === r) h = ((g - bb) / (mx - mn)) % 6; else if (mx === g) h = (bb - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
        hs.push([L[i], h, s]);
      }
      const sorted = Array.from(L).sort((a, b2) => a - b2);
      const q = (p) => sorted[Math.floor(p * (n - 1))];
      const mean = sorted.reduce((a, v) => a + v, 0) / n;
      const bright = sorted.filter((v) => v > 0.75).length / n;
      const dark = hs.slice().sort((a, b2) => a[0] - b2[0]).slice(0, Math.floor(n * 0.3));
      let sx = 0, sy = 0, sw = 0, ss = 0; for (const [, h, s] of dark) { sx += Math.cos(h * Math.PI / 180) * s; sy += Math.sin(h * Math.PI / 180) * s; sw += s; ss += s; }
      let dh = Math.atan2(sy, sx) * 180 / Math.PI; if (dh < 0) dh += 360;
      const box = (x0, y0, w, h) => { let t = 0, k = 0; for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) { t += L[yy * W + xx]; k++; } return t / k; };
      const cw = Math.floor(W * 0.15), ch = Math.floor(H * 0.15);
      const corners = (box(0, 0, cw, ch) + box(W - cw, 0, cw, ch) + box(0, H - ch, cw, ch) + box(W - cw, H - ch, cw, ch)) / 4;
      const center = box(Math.floor(W * 0.35), Math.floor(H * 0.35), Math.floor(W * 0.3), Math.floor(H * 0.3));
      return { mean, p5: q(0.05), p95: q(0.95), bright, darkHue: dh, darkSat: ss / dark.length, vig: corners / center };
    }, 'file://' + path.resolve(f));
    const name = path.basename(f);
    if (!r) { console.log(name, 'not found'); continue; }
    const ok = (v, a, b2) => (v >= a && v <= b2 ? 'ok' : 'NG');
    console.log(`${name.padEnd(20)} mean ${r.mean.toFixed(3)} ${ok(r.mean, 0.14, 0.22)} | p5 ${r.p5.toFixed(3)} ${ok(r.p5, 0.02, 0.05)} | p95 ${r.p95.toFixed(3)} ${ok(r.p95, 0.35, 0.6)} | >.75 ${(r.bright * 100).toFixed(1)}% ${ok(r.bright, 0.01, 0.07)} | dark hue ${r.darkHue.toFixed(0)}° ${ok(r.darkHue, 250, 295)} sat ${r.darkSat.toFixed(2)} ${r.darkSat >= 0.45 ? 'ok' : 'NG'} | corner/center ${r.vig.toFixed(2)}`);
  }
  await b.close();
})();
