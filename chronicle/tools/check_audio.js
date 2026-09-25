#!/usr/bin/env node
// Audio conformance check (owner: audio A17): renders every id of DESIGN §11.11.4 offline in
// headless Chromium and checks the measured levels against the targets. ~3 min for everything.
//
//   node tools/check_audio.js               lint + render all 32 BGM, 11 jingles, 62 SFX + mix test
//   node tools/check_audio.js --quick       lint + node-side checks only (no browser)
//   node tools/check_audio.js <ids…>        only these ids (SFX ids are picked by --sfx or by name)
//   node tools/check_audio.js --browser     play every id in the real build (debug_audio.html, see
//                                           tools/fixtures/audio/soundtest.js); console errors fail
//
// Targets (pre-limiter, full volume, 32 kHz render — tools/render_audio.js conventions):
//   BGM      clip 0 · peak ≤ -1.0 dBFS · loudness -17 ± 1.5 LUFS · no ≥0.5 s gap · loop seam jump ≤ 9 dB
//   jingles  clip 0 · peak ≤ -1.0 · loudness -16 ± 2 LUFS · no gap
//   SFX      clip 0 · peak ≤ -0.5 and ≥ -18; the new ones by kind (DESIGN §11.10.5): UI -14…-9,
//            spells -9…-4.5, field -12…-5, weapon/impact -10…-3
//   mix      glimmer over the battle BGM at default volumes (bgm 0.6, sfx 0.7): its duck dips the music
//            ≥ 3 dB, and in 3.05–3.6 s the glimmer alone is ≥ the ducked music in 1–3.5 kHz and ≥ -6 dB
//            broadband (the ピコーン must cut through the fight)
// Exit code 1 on any failure.
'use strict';
const RA = require('./render_audio');

const NEW_SFX = {
  ui: ['page', 'swap'],
  spell: ['glimmer', 'golden', 'light', 'freeze', 'burn'],
  field: ['quill', 'bell', 'unlock', 'secret'],
  impact: ['arrow', 'lash', 'parry'],
};
const SFX_RANGE = { ui: [-14, -9], spell: [-9, -4.5], field: [-12, -5], impact: [-10, -3] };
const kindOf = (id) => Object.keys(NEW_SFX).find((k) => NEW_SFX[k].includes(id));

async function main() {
  const argv = process.argv.slice(2);
  const quick = argv.includes('--quick');
  const only = argv.filter((a) => !a.startsWith('--'));
  const R = RA.loadNode();
  const I = R.Audio.IDS;
  let fails = 0;
  const F = (msg) => { fails++; console.log('  ✗ ' + msg); };

  // ---- node side
  const drift = RA.listDrift(R);
  for (const d of drift) F('list drift ' + d);
  const log = console.log; const out = [];
  console.log = (...a) => out.push(a.join(' '));
  let lintProblems;
  try { lintProblems = RA.lint(R, [...I.bgm, ...I.jingles], false); } finally { console.log = log; }
  if (lintProblems) { F(`lint: ${lintProblems} problem(s)`); for (const l of out.filter((x) => x.startsWith('✗') || /^\s+/.test(x))) console.log('    ' + l); }
  else console.log(`✓ lint: ${I.bgm.length} BGM + ${I.jingles.length} jingles clean`);
  const missing = [...I.bgm, ...I.jingles].filter((id) => !R.DB.music[id]).concat(I.sfx.filter((id) => !R.DB.sfx[id]));
  if (missing.length) F('no definition (stand-in in game): ' + missing.join(' '));
  if (quick) { console.log(fails ? `\ncheck_audio --quick: ${fails} failure(s)` : '\ncheck_audio --quick: ok'); process.exit(fails ? 1 : 0); }
  if (argv.includes('--browser')) { fails += await browserCheck(I); console.log(fails ? `\ncheck_audio --browser: ${fails} failure(s)` : '\ncheck_audio --browser: ok'); process.exit(fails ? 1 : 0); }

  // ---- browser renders
  const list = [];
  const pick = (id) => !only.length || only.includes(id);
  for (const id of I.bgm) if (pick(id) && !argv.includes('--sfx')) list.push(['bgm', id]);
  for (const id of I.jingles) if (pick(id) && !argv.includes('--sfx')) list.push(['jingle', id]);
  for (const id of I.sfx) if (pick(id) && (argv.includes('--sfx') || !only.length || !R.DB.music[id])) list.push(['sfx', id]);
  const rows = list.length ? await RA.render(list, {}) : [];
  console.log('');
  for (const r of rows) {
    const tag = `${r.kind} ${r.id}`;
    if (r.clip) F(`${tag}: ${r.clip} clipped samples`);
    if (r.gaps.length) F(`${tag}: silence gaps ${JSON.stringify(r.gaps)}`);
    if (r.kind === 'bgm') {
      if (r.peak > -1.0) F(`${tag}: peak ${r.peak.toFixed(1)} dBFS > -1.0`);
      if (Math.abs(r.lufs - RA.TARGET.bgm) > 1.5) F(`${tag}: loudness ${r.lufs.toFixed(1)} LUFS (target ${RA.TARGET.bgm} ± 1.5)`);
      if (r.seamBefore != null && Math.abs(r.seamBefore - r.seamAfter) > 9) F(`${tag}: loop seam jump ${r.seamBefore.toFixed(0)} → ${r.seamAfter.toFixed(0)} dB`);
    } else if (r.kind === 'jingle') {
      if (r.peak > -1.0) F(`${tag}: peak ${r.peak.toFixed(1)} dBFS > -1.0`);
      if (Math.abs(r.lufs - RA.TARGET.jingle) > 2) F(`${tag}: loudness ${r.lufs.toFixed(1)} LUFS (target ${RA.TARGET.jingle} ± 2)`);
    } else {
      if (r.peak > -0.5 || r.peak < -18) F(`${tag}: peak ${r.peak.toFixed(1)} dBFS outside [-18, -0.5]`);
      const k = kindOf(r.id);
      if (k) { const [lo, hi] = SFX_RANGE[k]; if (r.peak < lo - 0.01 || r.peak > hi + 0.01) F(`${tag}: peak ${r.peak.toFixed(1)} outside ${k} range [${lo}, ${hi}]`); }
    }
  }
  // summary numbers
  const stat = (kind, key) => { const v = rows.filter((r) => r.kind === kind).map((r) => r[key]); return v.length ? `${Math.min(...v).toFixed(1)}…${Math.max(...v).toFixed(1)}` : '—'; };
  if (rows.length) {
    console.log(`BGM     n=${rows.filter((r) => r.kind === 'bgm').length}  lufs ${stat('bgm', 'lufs')}  peak ${stat('bgm', 'peak')}`);
    console.log(`jingles n=${rows.filter((r) => r.kind === 'jingle').length}  lufs ${stat('jingle', 'lufs')}  peak ${stat('jingle', 'peak')}`);
    console.log(`SFX     n=${rows.filter((r) => r.kind === 'sfx').length}  peak ${stat('sfx', 'peak')}`);
  }

  // ---- mix: glimmer over the battle loop
  if (!only.length || only.includes('glimmer') || only.includes('mix')) {
    const res = await RA.withPage((page) => page.evaluate(async () => {
      const R = window.RPG, sr = 32000;
      // sfx: null = none, 'duck' = only the glimmer's duck (the music as heard under it), 'solo' = glimmer without music
      const run = async (mode) => {
        const ctx = new OfflineAudioContext(2, sr * 5, sr);
        const m = new R.Audio.Mixer(ctx, ctx.destination, {});
        m.music.gain.value = Math.pow(0.6, 1.5); m.sfxBus.gain.value = Math.pow(0.7, 1.5);
        if (mode !== 'solo') new R.Audio.Playback(m, R.Audio.compile('battle'), { dest: m.music, at: 0.05, pos: 5 }).schedule(6, 0);
        if (mode === 'mix' || mode === 'solo') R.Audio.playSfx(m, R.DB.sfx.glimmer, 3);
        if (mode === 'duck') R.Audio.playSfx(m, (S) => S.duck(-6, 0.32), 3);
        const b = await ctx.startRendering();
        return [b.getChannelData(0), b.getChannelData(1)];
      };
      const band = (x, lo, hi) => {
        const y = new Float32Array(x.length); let l1 = 0, l2 = 0;
        const al = 1 - Math.exp(-2 * Math.PI * hi / sr), ah = 1 - Math.exp(-2 * Math.PI * lo / sr);
        for (let i = 0; i < x.length; i++) { l1 += al * (x[i] - l1); l2 += ah * (l1 - l2); y[i] = l1 - l2; }
        return y;
      };
      const rms = (ch, t0, t1) => { let s = 0, n = 0; for (const x of ch) for (let i = Math.floor(t0 * sr); i < Math.floor(t1 * sr); i++) { s += x[i] * x[i]; n++; } return 10 * Math.log10(s / n + 1e-12); };
      const bgm = await run('bgm'), duck = await run('duck'), solo = await run('solo');
      const B = (c) => c.map((x) => band(x, 1000, 3500));
      const w0 = 3.05, w1 = 3.6;
      return {
        bgm: rms(bgm, w0, w1), ducked: rms(duck, w0, w1), solo: rms(solo, w0, w1),
        bandBgm: rms(B(bgm), w0, w1), bandDucked: rms(B(duck), w0, w1), bandSolo: rms(B(solo), w0, w1),
      };
    }));
    const snr = res.solo - res.ducked, snrBand = res.bandSolo - res.bandDucked, dip = res.bgm - res.ducked;
    console.log(`mix     glimmer over battle (bgm 0.6 / sfx 0.7), window 3.05–3.6 s: music ${res.bgm.toFixed(1)} → ducked ${res.ducked.toFixed(1)} dB (−${dip.toFixed(1)}), ` +
      `glimmer ${res.solo.toFixed(1)} dB → S/M ${snr >= 0 ? '+' : ''}${snr.toFixed(1)} dB broadband, ${snrBand >= 0 ? '+' : ''}${snrBand.toFixed(1)} dB in 1–3.5 kHz`);
    if (snrBand < 0) F(`glimmer is ${snrBand.toFixed(1)} dB under the ducked battle music in 1–3.5 kHz (want ≥ 0)`);
    if (snr < -6) F(`glimmer is ${snr.toFixed(1)} dB under the ducked battle music broadband (want ≥ -6)`);
    if (dip < 3) F(`the glimmer duck dips the music only ${dip.toFixed(1)} dB (want ≥ 3)`);
  }
  console.log(fails ? `\ncheck_audio: ${fails} failure(s)` : `\ncheck_audio: all ${rows.length} renders within targets`);
  process.exit(fails ? 1 : 0);
}
// the real build: debug_audio.html (node tools/build.js --with tools/fixtures/audio). A key press
// unlocks audio, then every id is played through the live AudioContext; console errors fail.
async function browserCheck(I) {
  const fs = require('fs'), path = require('path');
  const html = path.join(__dirname, '..', 'debug_audio.html');
  if (!fs.existsSync(html)) { console.log('  ✗ debug_audio.html missing — run: node tools/build.js --with tools/fixtures/audio'); return 1; }
  let playwright;
  try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let bad = 0;
  try {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /audio/.test(m.text()))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('file://' + html);
    await page.waitForTimeout(1500);
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(300);
    const res = await page.evaluate(async (I) => {
      const R = window.RPG, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = { ctx: R.Audio.context && R.Audio.context.state, bgm: [], jingles: [], sfx: 0, pending: R.Audio.PENDING.slice(), loadErrors: (R.loadErrors || []).filter((e) => /audio/.test(e)) };
      for (const id of I.bgm) { R.bgm(id); await wait(120); const d = R.Audio.debug(); if (d.playing !== id) out.bgm.push(`${id}: playing ${d.playing}`); }
      R.bgm('town'); await wait(100);
      for (const id of I.jingles) {
        const p = R.jingle(id); await wait(80); const d = R.Audio.debug();
        if (d.jingle !== id || d.current !== 'town') out.jingles.push(`${id}: ${JSON.stringify(d)}`);
        void p;
      }
      R.Audio.pushBGM('battle'); await wait(60); R.Audio.popBGM(); await wait(200);
      if (R.Audio.debug().playing !== 'town') out.jingles.push('push/pop did not resume town');
      for (const id of I.sfx) { R.sfx(id); out.sfx++; await wait(35); }
      R.Audio.duck(-6, 18);
      await wait(300);
      R.Audio.stopBGM(10);
      return out;
    }, I);
    await page.waitForTimeout(300);
    console.log(`browser: context ${res.ctx}, ${I.bgm.length} BGM, ${I.jingles.length} jingles, ${res.sfx} SFX played; PENDING [${res.pending.join(' ')}]`);
    if (res.ctx !== 'running') { console.log('  ✗ AudioContext not running'); bad++; }
    for (const x of [...res.bgm, ...res.jingles]) { console.log('  ✗ ' + x); bad++; }
    if (res.pending.length) { console.log('  ✗ stand-ins in use: ' + res.pending.join(' ')); bad++; }
    for (const e of res.loadErrors) { console.log('  ✗ load error ' + e); bad++; }
    const audioErrors = errors.filter((e) => /audio|Audio|sfx|BGM/.test(e));
    for (const e of audioErrors) { console.log('  ✗ console: ' + e); bad++; }
    if (errors.length > audioErrors.length) console.log(`  (${errors.length - audioErrors.length} console error(s) from other modules ignored)`);
  } finally { await browser.close(); }
  return bad;
}

main().catch((e) => { console.error(e); process.exit(2); });
