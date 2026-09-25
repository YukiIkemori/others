#!/usr/bin/env node
// Live R.Audio API test in Chromium with a real AudioContext (owner: audio).
//   node tools/fixtures/audio/test_live.js
// Loads only ns.js + the audio files (harness written by tools/render_audio.js conventions).
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..', '..', '..');
const files = ['src/core/ns.js', 'src/core/audio.js',
  ...fs.readdirSync(path.join(ROOT, 'src/audio')).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/audio/' + f)];
const dir = '/tmp/claude-0/audio';
fs.mkdirSync(dir, { recursive: true });
const html = path.join(dir, 'live.html');
fs.writeFileSync(html, `<!DOCTYPE html><meta charset="utf-8"><body>${files.map((f) => `<script src="file://${path.join(ROOT, f)}"></script>`).join('')}</body>`);

(async () => {
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + html);
  const out = await page.evaluate(async () => {
    const R = window.RPG, A = R.Audio, log = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ok = (cond, msg) => log.push((cond ? 'ok   ' : 'FAIL ') + msg);
    // before init: queue, never throw
    A.playBGM('town');
    ok(A.current === 'town' && !A.ready, 'playBGM before init queues the track');
    A.sfx('cursor');
    await A.playJingle('item');
    ok(true, 'playJingle before init resolves');
    // init starts the queued track
    A.init(); A.init();
    await sleep(400);
    let d = A.debug();
    ok(d.ctx === 'running' && d.playing === 'town', 'init() (twice) starts queued BGM: ' + JSON.stringify(d));
    const serial = d.serial;
    A.playBGM('town');
    ok(A.debug().serial === serial, 'playBGM same id is a no-op');
    await sleep(1500);
    const before = A.debug().pos;
    A.pushBGM('battle');
    await sleep(100);
    d = A.debug();
    ok(d.current === 'battle' && d.playing === 'battle' && d.stack[0] === 'town', 'pushBGM plays battle, remembers town');
    await sleep(1200);
    A.popBGM();
    await sleep(150);
    d = A.debug();
    ok(d.current === 'town' && d.playing === 'town' && Math.abs(d.pos - before - 0.2) < 0.4, `popBGM resumes town near ${before}s → ${d.pos}s`);
    // jingle pauses and resumes
    const p0 = A.debug().pos;
    const jp = A.playJingle('item');
    await sleep(200);
    d = A.debug();
    ok(d.jingle === 'item' && d.playing === null && d.current === 'town', 'jingle pauses BGM: ' + JSON.stringify(d));
    const t0 = performance.now();
    await jp;
    const dt = (performance.now() - t0) / 1000;
    await sleep(100);
    d = A.debug();
    ok(dt > 1.2 && dt < 2.4, `jingle resolved after ${dt.toFixed(2)}s (item ≈ 1.7s)`);
    ok(d.playing === 'town' && Math.abs(d.pos - p0) < 0.6, `BGM resumed after jingle at ${d.pos}s (paused at ${p0}s)`);
    // BGM change during a jingle is deferred; a second jingle ends the first
    const j1 = A.playJingle('victory');
    let j1done = false; j1.then(() => { j1done = true; });
    await sleep(100);
    A.playBGM('overworld');
    d = A.debug();
    ok(d.current === 'overworld' && d.playing === null && d.jingle === 'victory', 'playBGM during jingle is deferred');
    const j2 = A.playJingle('levelup');
    await sleep(50);
    ok(j1done, 'starting a new jingle resolves the previous one');
    await j2;
    await sleep(150);
    d = A.debug();
    ok(d.playing === 'overworld' && d.pos < 1, 'deferred BGM starts after the jingle: ' + JSON.stringify(d));
    // battle victory flow: stopBGM + jingle + popBGM during jingle → field resumes after jingle
    A.pushBGM('battle'); await sleep(300);
    A.stopBGM(6); const jv = A.playJingle('victory'); await sleep(200);
    A.popBGM();
    d = A.debug();
    ok(d.current === 'overworld' && d.playing === null && d.jingle === 'victory', 'popBGM during victory jingle waits for it');
    await jv; await sleep(150);
    ok(A.debug().playing === 'overworld', 'field BGM back after victory jingle');
    // stop, volumes, unknown ids, all sfx
    A.stopBGM(30);
    ok(A.current === null && A.debug().playing === null, 'stopBGM clears current');
    A.setVolumes(0.3, 0.9);
    ok(A.debug().volumes.bgm === 0.3, 'setVolumes');
    A.playBGM('no_such_track'); A.sfx('no_such_sfx');
    ok(A.current === null, 'unknown ids are ignored');
    let threw = null;
    for (const id of Object.keys(R.DB.sfx)) { try { A.sfx(id); } catch (e) { threw = id; } }
    ok(!threw, 'all ' + Object.keys(R.DB.sfx).length + ' sfx play without throwing');
    // every track starts
    for (const id of Object.keys(R.DB.music)) { try { A.playBGM(id); } catch (e) { threw = id; } }
    ok(!threw, 'every track starts without throwing');
    A.stopBGM(0);
    // tab visibility
    A.playBGM('title'); await sleep(200);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(300);
    ok(A.context.state === 'suspended', 'hidden tab suspends the context');
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await sleep(300);
    ok(A.context.state === 'running' && A.debug().playing === 'title', 'visible tab resumes');
    // a resumed track that is stopped before it starts stays silent (battle lost → game over)
    {
      const octx = new OfflineAudioContext(2, 32000, 32000);
      const m = new A.Mixer(octx, octx.destination, { limiter: false });
      const p = new A.Playback(m, A.compile('overworld'), { dest: m.music, at: 0.05, pos: 3, fadeIn: 0.35 });
      p.schedule(1, 0);
      p.stop(0.33);
      const buf = await octx.startRendering();
      let peak = 0;
      for (const v of buf.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
      ok(peak < 0.01, 'stop before a fade-in starts is silent (peak ' + peak.toFixed(4) + ')');
    }
    // R.* safe wrappers
    R.bgm('cave'); R.sfx('hit'); await R.jingle('rare');
    ok(A.current === 'cave', 'R.bgm / R.sfx / R.jingle wrappers');
    return log;
  });
  console.log(out.join('\n'));
  if (errors.length) console.log('page errors:\n' + errors.join('\n'));
  const fails = out.filter((l) => l.startsWith('FAIL')).length + errors.length;
  console.log(fails ? `\n${fails} failure(s)` : '\nall passed');
  await browser.close();
  process.exitCode = fails ? 1 : 0;
})();
