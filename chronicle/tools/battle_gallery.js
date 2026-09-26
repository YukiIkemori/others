#!/usr/bin/env node
// Battle screen gallery (SV-SCENE, was bui A3): screenshots of every battle presentation without the rest of the game.
// It builds debug_bui.html (src + tools/fixtures/bui), opens it in headless Chromium, pauses the engine and
// runs the scenarios of tools/fixtures/bui/stage.js frame by frame; every shot is the real 4× canvas (1024×896).
//
//   node tools/battle_gallery.js [--out DIR] [--only a,b,c] [--sheet] [--no-build] [--list]
//     --out DIR    where the PNGs go (default: $TMPDIR/bui_gallery)
//     --only       scenario names (see --list)
//     --sheet      also write DIR/sheet.png: every shot at 1× with its label (a contact sheet)
//     --no-build   use the existing debug_bui.html
//     --compare DIR  also write OUT/compare.png: the before shots in DIR (design/shots/before_frontview) beside the
//                  after shots of the same moments (Part A8: 通常戦闘・ボス戦・閃き・術・勝利・後列・瀕死/戦闘不能)
// Exit code 1 when a scenario throws or the page logs an error.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(os.tmpdir(), 'bui_gallery')));
const ONLY = (opt('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SHEET = argv.includes('--sheet');
const COMPARE = opt('--compare', null);
// before (front view) → after (side view): the seven pairs of brief Part A8 「最後に」
const PAIRS = [
  ['通常戦闘', 'command__party_menu.png', 'sv_normal__member_step.png'],
  ['ボス戦', 'boss__boss_tall_112.png', /^sv_boss__boss_\d+\.png$/],
  ['閃きの瞬間', 'glimmer__glimmer_f12.png', 'sv_glimmer__oogi_f12.png'],
  ['術の詠唱', 'fx_chain__fx_chain_8.png', 'sv_cast__cast_circle.png'],
  ['勝利', 'levelup__rewards.png', 'sv_victory__victory_rewards.png'],
  ['後列の配置', 'reach__reach_attack_gray.png', 'sv_middle__middle_three.png'],
  ['瀕死・戦闘不能', 'command__member_menu_hero.png', 'sv_weak_ko__weak_ko_sleep_freeze.png'],
];

(async () => {
  if (!argv.includes('--no-build')) {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--with', path.join(ROOT, 'tools', 'fixtures', 'bui')], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  const html = path.join(ROOT, 'debug_bui.html');
  const browser = await playwright.chromium.launch();
  let failed = false;
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 950 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e.stack || e).split('\n').slice(0, 4).join(' | ')));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 300)); });
    await page.goto('file://' + html);
    await page.waitForFunction(() => window.RPG && window.RPG.bui && window.RPG.Battle && window.RPG.Battle.Scene, null, { timeout: 15000 });
    await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => setTimeout(r, 400)); });
    const le = await page.evaluate(() => (window.RPG.loadErrors || []).map((s) => String(s).split('\n')[0]));
    for (const e of le) console.log('[loadError]', e);
    const all = await page.evaluate(() => window.RPG.bui.list());
    if (argv.includes('--list')) { console.log(all.join('\n')); return; }
    const names = ONLY.length ? ONLY : all;
    fs.mkdirSync(OUT, { recursive: true });
    const sheet = [];
    for (const name of names) {
      if (!all.includes(name)) { console.log('unknown scenario', name); failed = true; continue; }
      const t0 = Date.now();
      const shots = await page.evaluate((n) => window.RPG.bui.run(n), name);
      for (const s of shots) {
        if (s.error) { console.log(`[${name}] ERROR ${s.error.split('\n').slice(0, 5).join(' | ')}`); failed = true; continue; }
        const file = path.join(OUT, `${name}__${s.label}.png`);
        fs.writeFileSync(file, Buffer.from(s.data.split(',')[1], 'base64'));
        sheet.push({ label: `${name}/${s.label}`, data: s.data });
      }
      console.log(`${name}: ${shots.length} shot(s) ${Date.now() - t0}ms`);
    }
    if (SHEET && sheet.length) {
      const data = await page.evaluate(async (list) => {
        const cols = 4, w = 256, h = 224, lh = 14;
        const rows = Math.ceil(list.length / cols);
        const cv = document.createElement('canvas');
        cv.width = cols * (w + 4); cv.height = rows * (h + lh + 4);
        const c = cv.getContext('2d');
        c.fillStyle = '#333'; c.fillRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = true;
        for (let i = 0; i < list.length; i++) {
          const img = new Image();
          await new Promise((r) => { img.onload = r; img.src = list[i].data; });
          const x = (i % cols) * (w + 4), y = Math.floor(i / cols) * (h + lh + 4);
          c.drawImage(img, x, y + lh, w, h);
          c.fillStyle = '#fff'; c.font = '11px monospace'; c.fillText(list[i].label, x + 2, y + 11);
        }
        return cv.toDataURL('image/png');
      }, sheet);
      fs.writeFileSync(path.join(OUT, 'sheet.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log('sheet →', path.join(OUT, 'sheet.png'));
    }
    if (COMPARE) {
      const pick = (dir, want) => { const f = typeof want === 'string' ? want : fs.readdirSync(dir).find((x) => want.test(x)); return f && fs.existsSync(path.join(dir, f)) ? path.join(dir, f) : null; };
      const rows = PAIRS.map(([label, b, a]) => ({ label, b: pick(path.resolve(COMPARE), b), a: pick(OUT, a) })).filter((r) => r.b && r.a);
      const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
      const data = await page.evaluate(async (list) => {
        const w = 512, h = 448, lh = 18, gap = 8;
        const cv = document.createElement('canvas');
        cv.width = w * 2 + gap * 3; cv.height = list.length * (h + lh + gap) + gap + 20;
        const c = cv.getContext('2d');
        c.fillStyle = '#222'; c.fillRect(0, 0, cv.width, cv.height);
        c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif';
        c.fillText('変更前（正面視点）', gap, 16); c.fillText('変更後（サイドビュー。Part A8）', w + gap * 2, 16);
        c.imageSmoothingEnabled = true;
        for (let i = 0; i < list.length; i++) {
          const y = 20 + gap + i * (h + lh + gap);
          c.fillStyle = '#ffd24a'; c.font = 'bold 14px sans-serif'; c.fillText(list[i].label, gap, y + 13);
          for (const [k, src] of [[0, list[i].b], [1, list[i].a]]) {
            const img = new Image();
            await new Promise((r) => { img.onload = r; img.src = src; });
            c.drawImage(img, gap + k * (w + gap), y + lh, w, h);
          }
        }
        return cv.toDataURL('image/png');
      }, rows.map((r) => ({ label: r.label, b: b64(r.b), a: b64(r.a) })));
      fs.writeFileSync(path.join(OUT, 'compare.png'), Buffer.from(data.split(',')[1], 'base64'));
      console.log(`compare → ${path.join(OUT, 'compare.png')} (${rows.length} pairs)`);
    }
    for (const e of errors) { console.log(e); failed = true; }
    console.log(`gallery → ${OUT} (${sheet.length} shots)`);
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
