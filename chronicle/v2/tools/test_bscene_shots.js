#!/usr/bin/env node
// BSCENE: §4.4 の BSCENE の行のスクショ（通常戦闘・ボス 4・閃きの瞬間・術の詠唱・全員の勝利・後列の配置・瀕死と戦闘不能・予告・
// レアを盗んだ・勝利の報酬・全滅）を 16:9（1920×1080）・縦（390×844）・横（844×390）で撮る。見本の戦闘（demo.js）を使う。
//   node v2/tools/test_bscene_shots.js [--build] [--only name,name] [--sizes wide,phone,land]
// 出力は v2/design/shots/bscene/<名前>_<大きさ>.png。撮ったら Read で見る（§2.9）。コンソールのエラーがあれば失敗。
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, done } = require('./lib/testkit');

const OUT = path.join(B.V2, 'design', 'shots', 'bscene');
const D = 'RPG.Battle.debug()';
// [名前, フィクスチャ, 手順]。手順: {keys:[…]} / {until:式} / {wait:ms}
const SHOTS = [
  ['normal', 'bscene_normal', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wait: 500 }]],
  ['command', 'bscene_normal', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wide: ['a'] }, { wait: 400 }]],
  ['techlist', 'bscene_normal', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wide: ['a'] }, { keys: ['a'] }, { wait: 400 }]],
  ['target', 'bscene_normal', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wide: ['a'] }, { keys: ['a', 'down', 'down', 'a'] }, { wait: 400 }]],
  ['glimmer', 'bscene_glimmer', [{ until: `${D} && ${D}.banner && ${D}.pops.some((p)=>p.kind==='crit')`, ms: 15000 }, { wait: 120 }]],
  ['spell', 'bscene_spell', [{ until: `${D} && ${D}.fxs.some((f)=>f.id==='cast' && ${D}.clock - f.t0 > 180)`, ms: 15000 }]],
  ['hitfx', 'bscene_spell', [{ until: `${D} && ${D}.fxs.some((f)=>f.id==='ice' && ${D}.clock - f.t0 > 150)`, ms: 15000 }]],
  ['victory', 'bscene_victory', [{ until: `${D} && ${D}.result && RPG.Engine.time - ${D}.result.t0 > 1100`, ms: 15000 }]],
  ['backrow', 'bscene_backrow', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wait: 400 }]],
  ['hurt', 'bscene_hurt', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wide: ['a'] }, { wait: 400 }]],
  ['tele', 'bscene_tele', [{ until: `${D} && ${D}.tele && RPG.Engine.time - ${D}.tele.t0 > 400`, ms: 15000 }]],
  ['steal', 'bscene_steal', [{ until: `${D} && ${D}.card && RPG.Engine.time - ${D}.card.t0 > 400`, ms: 15000 }]],
  ['wipe_fade', 'bscene_wipe', [{ until: `${D} && ${D}.go && RPG.Engine.time - ${D}.go.t0 > 1200`, ms: 15000 }]],
  ['wipe', 'bscene_wipe', [{ until: `${D} && ${D}.go && ${D}.ui`, ms: 15000 }, { wait: 500 }]],
  ['many', 'bscene_many', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wait: 400 }]],
  ['boss_pageeater', 'bscene_boss_pageeater', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wait: 400 }]],
  ['boss_moth', 'bscene_boss_moth', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wait: 400 }]],
  ['boss_rooteater', 'bscene_boss_rooteater', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wait: 400 }]],
  ['boss_wolflord', 'bscene_boss_wolflord', [{ until: `${D} && ${D}.ui && ${D}.phase==='input'` }, { wait: 400 }]],
];
const SIZES = { wide: { size: [1920, 1080] }, phone: { phone: true }, land: { size: [844, 390], land: true } };

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
  const sizes = argv.includes('--sizes') ? argv[argv.indexOf('--sizes') + 1].split(',') : Object.keys(SIZES);
  const S = await B.start();
  const files = [];
  for (const [name, fx, steps] of SHOTS) {
    if (only && !only.includes(name)) continue;
    for (const sz of sizes) {
      const o = SIZES[sz];
      let P;
      try {
        P = sz === 'land'
          ? await openLand(S, 'dev.html?scene=' + fx)
          : await B.open(S, 'dev.html?scene=' + fx, o);
      } catch (e) { ok(`${name} ${sz}: opens`, false, String(e)); continue; }
      const p = P.page;
      let good = true;
      const tallNow = await B.ev(p, "RPG.layout === 'tall'");
      for (const s of steps) {
        if (s.until) { const r = await B.waitFor(p, s.until, s.ms || 8000); if (!r) { good = false; ok(`${name} ${sz}: ${s.until.slice(0, 60)}`, false); break; } }
        if (s.wait) await p.waitForTimeout(s.wait);
        if (s.keys) for (const k of s.keys) { await B.press(p, k); await p.waitForTimeout(160); }
        if (s.wide && !tallNow) for (const k of s.wide) { await B.press(p, k); await p.waitForTimeout(160); }
      }
      const file = path.join(OUT, `${name}_${sz}.png`);
      await B.shot(p, file);
      files.push(path.relative(path.join(B.V2, '..'), file));
      ok(`${name} ${sz}: shot, 0 errors`, good && P.errors.length === 0, P.errors.slice(0, 3));
      await P.close();
    }
  }
  await B.stop(S);
  console.log(files.join('\n'));
  done('test_bscene_shots');
}
async function openLand(S, page) {
  const ctx = await S.browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  p.on('pageerror', (e) => errors.push('[pageerror] ' + (e.stack || e)));
  await p.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(S.base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue(); errors.push('[outside] ' + u); return route.abort(); });
  await p.goto(S.base + page);
  await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 15000 });
  await p.waitForTimeout(300);
  return { ctx, page: p, errors, close: () => ctx.close() };
}
main().catch((e) => { console.error(e); process.exit(2); });
