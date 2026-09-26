#!/usr/bin/env node
// Side-by-side before/after sheet (Part A8 「最後に」): left column = before shot, right column = after shot,
// one row per scene, with a small label (前/後 + scene name) over each image. Composited on a canvas in
// headless Chromium; the 1024×896 shots are drawn at 1/2 (= 2× logical, nearest neighbour, so pixels stay crisp).
//
//   node tools/compare_shots.js --out FILE [--scale 0.5] [--title TEXT] "場面|before.png|after.png" ...
//   node tools/compare_shots.js --a8        (the default A8 set → design/shots/compare_before_after.png)
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'design', 'shots');
const B = (f) => path.join(SHOTS, 'before_frontview', f);
const A = (f) => path.join(SHOTS, 'after_sideview', f);
const A8 = [
  ['通常戦闘', B('command__party_menu.png'), A('A8_01_normal_real.png')],
  ['ボス戦', B('boss__boss_tall_112.png'), A('A8_02b_boss_112.png')],
  ['閃きの瞬間', B('glimmer__glimmer_f12.png'), A('A8_03_glimmer_bulb.png')],
  ['術の詠唱', B('fx_chain__fx_chain_8.png'), A('A8_04b_cast_fireball.png')],
  ['勝利', B('levelup__rewards.png'), A('A8_05b_victory_rewards.png')],
];

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
let out = opt('--out', null);
const scale = +opt('--scale', 0.5);
const title = opt('--title', '戦闘画面 変更前（正面視点）→ 変更後（サイドビュー）');
let pairs = argv.filter((a, i) => a.includes('|') && !['--out', '--scale', '--title'].includes(argv[i - 1])).map((s) => s.split('|'));
if (argv.includes('--a8') || !pairs.length) { pairs = A8; out = out || path.join(SHOTS, 'compare_before_after.png'); }
if (!out) { console.error('need --out'); process.exit(2); }
for (const [, b, a] of pairs) for (const f of [b, a]) if (!fs.existsSync(f)) { console.error('missing', f); process.exit(2); }

(async () => {
  const browser = await playwright.chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    const font = 'data:font/ttf;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'DotGothic16-Regular.ttf')).toString('base64');
    await page.setContent(`<style>@font-face{font-family:Dot;src:url('${font}')}</style><div style="font-family:Dot">あ</div>`);
    await page.evaluate(async () => { await document.fonts.load('16px Dot'); await document.fonts.ready; });
    const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
    const data = await page.evaluate(async ({ rows, scale, title }) => {
      const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
      const imgs = [];
      for (const r of rows) imgs.push([await load(r.b), await load(r.a)]);
      const w = Math.round(imgs[0][0].width * scale), h = Math.round(imgs[0][0].height * scale);
      const gap = 12, lh = 22, th = 40;
      const cv = document.createElement('canvas');
      cv.width = gap * 3 + w * 2; cv.height = th + rows.length * (lh + h + gap) + gap;
      const c = cv.getContext('2d');
      c.fillStyle = '#1b1d24'; c.fillRect(0, 0, cv.width, cv.height);
      c.imageSmoothingEnabled = false;
      c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.font = '20px Dot'; c.fillText(title, gap, th / 2 + 2);
      const tag = (x, y, t, bg) => {
        c.font = '16px Dot';
        const tw = c.measureText(t).width + 12;
        c.fillStyle = bg; c.fillRect(x, y, tw, lh - 4);
        c.fillStyle = '#fff'; c.fillText(t, x + 6, y + (lh - 4) / 2 + 1);
      };
      rows.forEach((r, i) => {
        const y = th + i * (lh + h + gap);
        for (let k = 0; k < 2; k++) {
          const x = gap + k * (w + gap);
          tag(x, y, (k ? '後　' : '前　') + r.label, k ? '#2d7a4a' : '#6a4a2a');
          c.drawImage(imgs[i][k], x, y + lh, w, h);
          c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(x - 1, y + lh - 1, w + 2, h + 2);
        }
      });
      return cv.toDataURL('image/png');
    }, { rows: pairs.map(([label, b, a]) => ({ label, b: b64(b), a: b64(a) })), scale, title });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`compare → ${out} (${pairs.length} rows)`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
