#!/usr/bin/env node
// Recorded media tests (BRIEF A9 voice, A10 Lyria BGM files). Node; the `browser` group uses Playwright.
//
//   node tools/test_media.js                 all groups
//   node tools/test_media.js audio ui        some groups: audio ui settings build voice lyria browser
//
//   audio     R.Audio with a fake AudioContext: a listed file overrides the synth track (decoded buffer,
//             loop points), synth fallback without a file / when decoding fails, push/pop resumes the
//             file position, jingle pause + resume, stopBGM, playVoice/stopVoice + BGM duck, voice volume 0
//   ui        R.UI message window: voice starts with the say, stops on advance / close / a new say,
//             per-page voices, noWait keeps it; ev.say passes opts.voice (arrays split per text)
//   settings  voiceVolume default 0.8, settingsVer 4 migration, the settings row, setVolumes gets it
//   build     tools/build.js --media tools/fixtures/media: embedded data: URLs + loop json; --bgm external
//             copies to <out>/bgm/; no media → no RPG_MEDIA script
//   voice     tools/voice_script.js: 80–150 lines, fixed characters only, unique ids, no problems, CSV/MD
//   lyria     tools/lyria_bgm.js: prompts.json covers every BGM id, first batch, request shapes, dry run
//             and no-credential run exit 0 without writing, WAV round trip, loop smoothing is seamless
//   browser   the built fixture page in headless Chromium really decodes the WAV and plays it / the voice
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(ROOT, 'tools', 'fixtures', 'media');
const RA = require('./render_audio');

let fails = 0, passes = 0;
const groups = process.argv.slice(2);
const want = (g) => !groups.length || groups.includes(g);
function ok(cond, msg, extra) { if (cond) passes++; else { fails++; console.log('  ✗ ' + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); } }
function section(name) { console.log('— ' + name); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (f) => fs.readFileSync(f).toString('base64');

// --------------------------------------------------------------------------- fake Web Audio
function fakeAudio(opts) {
  opts = opts || {};
  const made = { sources: [], decoded: 0 };
  class Param {
    constructor(v) { this.value = v; this.ev = []; }
    setValueAtTime(v, t) { this.ev.push(['set', v, t]); return this; }
    linearRampToValueAtTime(v, t) { this.ev.push(['lin', v, t]); this.value = v; return this; }
    exponentialRampToValueAtTime(v, t) { this.ev.push(['exp', v, t]); return this; }
    setTargetAtTime(v, t, c) { this.ev.push(['tgt', v, t, c]); return this; }
    cancelScheduledValues(t) { this.ev.push(['cancel', t]); return this; }
    cancelAndHoldAtTime(t) { this.ev.push(['hold', t]); return this; }
  }
  class Node { constructor(ctx) { this.ctx = ctx; this.to = []; } connect(n) { this.to.push(n); return n; } disconnect() { this.to = []; } }
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 32000; this.destination = new Node(this); }
    createGain() { const n = new Node(this); n.gain = new Param(1); return n; }
    createOscillator() { const n = new Node(this); n.frequency = new Param(440); n.detune = new Param(0); n.setPeriodicWave = () => {}; n.start = () => {}; n.stop = () => {}; return n; }
    createBiquadFilter() { const n = new Node(this); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); return n; }
    createDelay() { const n = new Node(this); n.delayTime = new Param(0); return n; }
    createChannelMerger() { return new Node(this); }
    createStereoPanner() { const n = new Node(this); n.pan = new Param(0); return n; }
    createDynamicsCompressor() { const n = new Node(this); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    createBufferSource() {
      const n = new Node(this);
      n.playbackRate = new Param(1);
      n.started = null; n.stopped = null;
      n.start = (at, off) => { n.started = { at, off: off || 0 }; };
      n.stop = (t) => { n.stopped = t; };
      if (n.buffer === undefined) n.buffer = null;
      made.sources.push(n);
      return n;
    }
    createPeriodicWave() { return {}; }
    /** a WAV header is enough to know the duration; anything else fails like a real decoder */
    decodeAudioData(ab, ok, fail) {
      const buf = Buffer.from(ab);
      return new Promise((res, rej) => {
        setTimeout(() => {
          if (buf.toString('ascii', 0, 4) !== 'RIFF') { const e = new Error('EncodingError'); if (fail) fail(e); rej(e); return; }
          made.decoded++;
          const rate = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34), len = buf.readUInt32LE(40);
          const b = { duration: len / (rate * ch * bits / 8), sampleRate: rate, numberOfChannels: ch };
          if (ok) ok(b); res(b);
        }, opts.decodeMs || 1);
      });
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  return { Ctx, made };
}
function loadAudio(globals) {
  const noop = () => {};
  const sb = Object.assign({
    console: { log: noop, warn: noop, error: console.error, info: noop },
    setTimeout, clearTimeout, setInterval, clearInterval, Math, JSON, Date, Promise,
    addEventListener: noop, removeEventListener: noop,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  }, globals || {});
  sb.window = sb;
  vm.createContext(sb);
  for (const f of RA.FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  sb.RPG.runDataHooks();
  return sb.RPG;
}
const MEDIA = () => ({
  bgm: { title: { src: 'data:audio/wav;base64,' + b64(path.join(FIX, 'bgm', 'title.wav')), loopStart: 0.1, loopEnd: 0.4 },
    broken: { src: 'data:audio/ogg;base64,' + Buffer.from('not audio at all').toString('base64') } },
  voice: { v_fine_t1_01: { src: 'data:audio/wav;base64,' + b64(path.join(FIX, 'voice', 'v_fine_t1_01.wav')) } },
});

// =========================================================================== audio
async function audioTests() {
  section('audio: file override, fallback, push/pop, jingle, voice (fake AudioContext)');
  const FA = fakeAudio();
  let now = 1e12;
  const warns = [];
  const R = loadAudio({ AudioContext: FA.Ctx, Date: { now: () => now }, requestIdleCallback: undefined, RPG_MEDIA: MEDIA() });
  R.warn = (...a) => warns.push(a.join(' '));
  const A = R.Audio;
  ok(A.hasFile('bgm', 'title') && !A.hasFile('bgm', 'town') && A.hasFile('voice', 'v_fine_t1_01'), 'hasFile reads window.RPG_MEDIA');
  ok(A.playVoice('v_fine_t1_01') === null, 'playVoice before init is a silent no-op');
  A.playBGM('title');
  ok(A.current === 'title', 'playBGM before init records the track');
  ok(A.init() === true, 'init');
  const ctx = A.context;
  const tick = async (t) => { ctx.currentTime = t; await sleep(40); };
  await tick(0.1);
  let d = A.debug();
  ok(d.playing === 'title' && d.file === true, 'a listed file overrides the synth track', d);
  const src = FA.made.sources.filter((s) => s.buffer && Math.abs(s.buffer.duration - 0.5) < 0.01).pop();
  ok(src && src.loop === true && Math.abs(src.loopStart - 0.1) < 1e-9 && Math.abs(src.loopEnd - 0.4) < 1e-9, 'buffer source loops between loopStart/loopEnd of <id>.json', src && [src.loop, src.loopStart, src.loopEnd]);
  // position wraps inside the loop
  await tick(0.1 + 0.03 + 0.95); // 0.95 s into the song: 0.1 + (0.85 % 0.3) = 0.35
  ok(Math.abs(A.debug().pos - 0.35) < 0.02, 'position wraps between the loop points', A.debug().pos);
  // synth fallback
  A.playBGM('town');
  await tick(1.2);
  d = A.debug();
  ok(d.playing === 'town' && d.file === false, 'no file → the synthesised track', d);
  // push / pop keep the file position (battle resumes the field track)
  A.playBGM('title');
  await tick(2);
  const t0 = 2.03;
  await tick(t0 + 0.25);
  const before = A.debug().pos;
  A.pushBGM('battle');
  d = A.debug();
  ok(d.current === 'battle' && d.stack[0] === 'title' && d.file === false, 'pushBGM plays the (synth) battle track over the file', d);
  await tick(5);
  A.popBGM();
  await tick(5.01);
  d = A.debug();
  const popped = FA.made.sources[FA.made.sources.length - 1];
  ok(d.playing === 'title' && d.file && Math.abs(popped.started.off - before) < 0.02, `popBGM resumes the file at ${before.toFixed(2)} s`, [d, popped.started]);
  // jingle pauses and resumes the file
  let done = false;
  const j = A.playJingle('item').then(() => { done = true; });
  await tick(5.2);
  d = A.debug();
  ok(d.jingle === 'item' && d.playing === null && d.current === 'title', 'a jingle pauses the file BGM', d);
  const len = A.info('item').duration;
  await tick(5.25 + len + 0.2);
  await j;
  d = A.debug();
  ok(done && d.playing === 'title' && d.file, 'the jingle end resumes the file BGM', d);
  // stopBGM stops the source (fade)
  const live = FA.made.sources[FA.made.sources.length - 1];
  A.stopBGM(12);
  ok(A.debug().playing === null && live.stopped != null && live.stopped > ctx.currentTime + 0.15, 'stopBGM fades and stops the buffer source', live.stopped);
  // decode failure → warning + synth fallback (the id `broken` has no synth: stays silent, no throw)
  A.playBGM('broken');
  await tick(6);
  await sleep(20);
  ok(warns.some((w) => /cannot decode bgm file 'broken'/.test(w)), 'a broken file warns once', warns);
  ok(A.debug().playing === null, 'a broken file without a synth track stays silent');
  // a file for an id that has a synth track but fails → synth
  const FB = fakeAudio();
  const R2 = loadAudio({ AudioContext: FB.Ctx, Date: { now: () => now }, requestIdleCallback: undefined, RPG_MEDIA: { bgm: { town: { src: 'data:audio/ogg;base64,AAAA' } } } });
  R2.warn = () => {};
  R2.Audio.init();
  R2.Audio.playBGM('town');
  await sleep(40); R2.Audio.context.currentTime = 0.5; await sleep(40);
  ok(R2.Audio.debug().playing === 'town' && !R2.Audio.debug().file, 'decode failure → the synth track of the same id', R2.Audio.debug());
  // file-only id counts as known; a track change while decoding wins
  const FC = fakeAudio({ decodeMs: 30 });
  const R3 = loadAudio({ AudioContext: FC.Ctx, Date: { now: () => now }, requestIdleCallback: undefined, RPG_MEDIA: MEDIA() });
  R3.warn = () => {};
  R3.Audio.init();
  R3.Audio.playBGM('title');
  R3.Audio.playBGM('town');
  await sleep(80); R3.Audio.context.currentTime = 0.2; await sleep(40);
  ok(R3.Audio.debug().playing === 'town', 'switching tracks while a file decodes does not start the old file', R3.Audio.debug());

  // ---------------------------------------------------------------- voice
  A.playBGM('title');
  await tick(7);
  const h = A.playVoice('v_fine_t1_01');
  await sleep(20);
  ok(h && A.voice === 'v_fine_t1_01' && A.debug().voice === 'v_fine_t1_01', 'playVoice plays a listed line');
  const vsrc = FA.made.sources[FA.made.sources.length - 1];
  ok(vsrc.buffer && Math.abs(vsrc.buffer.duration - 0.3) < 0.01 && vsrc.started, 'the voice buffer source started');
  // the duck gain of the music path goes down
  const mx = findMixerDuck(A);
  ok(mx != null && mx < 0.5, 'the BGM is ducked while a voice plays (−9 dB)', mx);
  A.stopVoice(h);
  ok(A.voice === null && vsrc.stopped != null, 'stopVoice stops it');
  ok(findMixerDuck(A) === 1, 'the duck recovers after the voice');
  ok(A.playVoice('v_nobody_x_01') === null, 'a missing voice file is silent (null, no error)');
  const h2 = A.playVoice('v_fine_t1_01');
  await sleep(10);
  const h3 = A.playVoice('v_fine_t1_01');
  ok(h2.stopped && !h3.stopped, 'a new line stops the previous one');
  A.stopVoice(h2);
  ok(A.voice === 'v_fine_t1_01', 'stopVoice(old handle) does not stop a newer line');
  A.setVolumes(null, null, 0);
  ok(A.voice === null && A.playVoice('v_fine_t1_01') === null, 'voice volume 0 = off (stops and refuses)');
  A.setVolumes(0.6, 0.7, 0.8);
  ok(A.debug().volumes.voice === 0.8, 'setVolumes(bgm, sfx, voice)');
}
/** the last ramp target of the music path's voice-duck gain (via the debug handle of the mixer) */
function findMixerDuck(A) {
  const g = A._mxVoiceDuck ? A._mxVoiceDuck() : null;
  if (!g) return null;
  const ev = g.gain.ev.filter((e) => e[0] === 'lin');
  return ev.length ? ev[ev.length - 1][1] : 1;
}

// =========================================================================== ui
async function uiTests() {
  section('ui: message window drives the voice; ev.say passes opts.voice');
  const R = require('./lib/load')({ quiet: true });
  R.Gfx.textWidth = (str) => String(str).length * 10; // no canvas in node
  const calls = [];
  let serial = 0;
  R.Audio.playVoice = (id) => { const h = { id, n: ++serial }; calls.push(['play', id]); return h; };
  R.Audio.stopVoice = (h) => { calls.push(['stop', h && h.id]); };
  const M = R.UI.MessageLayer;
  const m = new M({});
  let resolved = 0;
  m.setText('ロウェル「……待ってくれ。」', { voice: 'v_rowell_t7_01', keep: true }, () => resolved++);
  ok(calls.length === 1 && calls[0][1] === 'v_rowell_t7_01', 'the voice starts with the say', calls);
  m.shown = m.pageLen();
  m.advance();
  ok(resolved === 1 && calls[1] && calls[1][0] === 'stop' && calls[1][1] === 'v_rowell_t7_01', 'advancing past the text stops the voice', calls);
  // a new say supersedes the previous one's voice
  calls.length = 0;
  m.setText('一行目', { voice: 'a' }, () => {});
  m.setText('二行目', { voice: 'b' }, () => {});
  ok(JSON.stringify(calls) === JSON.stringify([['play', 'a'], ['stop', 'a'], ['play', 'b']]), 'a new say stops the old voice and starts its own', calls);
  // close (e.g. the event closes the window) stops it
  calls.length = 0;
  m.onRemove();
  ok(calls.length === 1 && calls[0][0] === 'stop', 'closing the window stops the voice', calls);
  // per-page voices
  calls.length = 0;
  m.setText('一枚目\f二枚目', { voice: ['p1', 'p2'] }, () => {});
  m.shown = m.pageLen(); m.advance();
  ok(JSON.stringify(calls) === JSON.stringify([['play', 'p1'], ['stop', 'p1'], ['play', 'p2']]), 'voice arrays play one line per page', calls);
  m.shown = m.pageLen(); m.advance();
  ok(calls[calls.length - 1][0] === 'stop', 'the last page stops its line');
  // a single id on a multi-page say plays once and keeps playing across its pages
  calls.length = 0;
  m.setText('一枚目\f二枚目', { voice: 'whole' }, () => {});
  m.shown = m.pageLen(); m.advance();
  ok(calls.length === 1, 'one id = one line for the whole say (not restarted per page)', calls);
  m.shown = m.pageLen(); m.advance();
  ok(calls.length === 2 && calls[1][0] === 'stop', 'stopped when the say ends');
  // noWait (question follows): keeps playing
  calls.length = 0;
  m.setText('どうする？', { voice: 'q', noWait: true, keep: true }, () => {});
  m.shown = m.pageLen(); m.finish();
  ok(calls.length === 1, 'noWait keeps the line under the question', calls);
  // no voice → nothing
  calls.length = 0;
  m.setText('ただの文', {}, () => {});
  ok(calls.filter((c) => c[0] === 'play').length === 0, 'no opts.voice → no voice call');
  // missing R.Audio entirely: must not throw
  const keep = R.Audio; R.Audio = null;
  let threw = false;
  try { const m2 = new M({}); m2.setText('x', { voice: 'v' }, () => {}); m2.onRemove(); } catch (e) { threw = true; }
  R.Audio = keep;
  ok(!threw, 'no audio module → silent, no error');

  // ev.say → R.UI.say opts
  const seen = [];
  R.UI.say = (t, o) => { seen.push([t, o && o.voice]); return Promise.resolve(); };
  try {
    await R.Events.run(async (ev) => {
      await ev.say('一', { voice: 'v_a_x_01' });
      await ev.say(['二', '三'], { voice: ['v_a_x_02', 'v_a_x_03'] });
      await ev.say(['四', '五'], { voice: 'v_a_x_04' });
    }, {});
  } catch (e) { console.log('  (events.run: ' + e.message + ')'); }
  ok(JSON.stringify(seen) === JSON.stringify([['一', 'v_a_x_01'], ['二', 'v_a_x_02'], ['三', 'v_a_x_03'], ['四', 'v_a_x_04'], ['五', null]]), 'ev.say passes voice (array: one per text; single id: first text only)', seen);
  // every voiced event line reaches R.UI.say with its id (story_after_clear T7 runs in node)
}

// =========================================================================== settings
function settingsTests() {
  section('settings: voiceVolume + migration');
  const R = require('./lib/load')({ quiet: true });
  ok(R.DEFAULT_SETTINGS.voiceVolume === 0.8 && R.Settings.voiceVolume === 0.8, 'voiceVolume default 0.8');
  ok(R.DEFAULT_SETTINGS.settingsVer >= 4, 'settingsVer bumped to 4 (5 since Part A11 menuSize)');
  const old = { settingsVer: 3, bgmVolume: 0.3, windowColor: 'blue' };
  const changed = R.Save.migrateSettings(old);
  ok(changed && old.voiceVolume === 0.8 && old.settingsVer === R.DEFAULT_SETTINGS.settingsVer && old.bgmVolume === 0.3 && old.windowColor === 'blue', 'v3 settings gain voiceVolume 0.8, keep the rest', old);
  const cur = { settingsVer: 4, voiceVolume: 0 };
  R.Save.migrateSettings(cur);
  ok(cur.voiceVolume === 0, 'v4 settings keep voiceVolume 0 (off)');
  const bad = { settingsVer: 3, voiceVolume: 'x' };
  R.Save.migrateSettings(bad);
  ok(bad.voiceVolume === 0.8, 'a junk value is repaired');
  const row = R.Menu.SETTINGS.find((s) => s.key === 'voiceVolume');
  ok(row && row.label === 'ボイスの音量' && row.vol === true, 'settings row ボイスの音量 (10-step bar)', row);
  ok(R.Menu.SETTINGS.indexOf(row) === R.Menu.SETTINGS.findIndex((s) => s.key === 'sfxVolume') + 1, 'placed right after 効果音');
  ok([...row.desc].length <= 20, 'help ≤ 20 chars');
  let got = null;
  R.Audio.setVolumes = (...a) => { got = a; };
  R.Settings.voiceVolume = 0.5;
  R.Menu.applySetting('voiceVolume');
  ok(got && got[2] === 0.5, 'changing it calls R.Audio.setVolumes(bgm, sfx, voice)', got);
}

// =========================================================================== build
function buildTests() {
  section('build: embedding and --bgm external');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_media_'));
  const run = (...a) => { try { return execFileSync('node', [path.join(ROOT, 'tools', 'build.js'), ...a], { cwd: ROOT, stdio: 'pipe' }).toString(); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
  const media = (html) => { const m = /<script>window\.RPG_MEDIA=(\{[\s\S]*?\});<\/script>/.exec(html); return m ? JSON.parse(m[1]) : null; };
  const o1 = path.join(tmp, 'embed');
  const log1 = run('--media', FIX, '--out', o1);
  const h1 = fs.readFileSync(path.join(o1, 'index.html'), 'utf8');
  const M1 = media(h1);
  ok(M1 && M1.bgm.title && M1.bgm.title.src.startsWith('data:audio/wav;base64,'), 'BGM embedded as a data: URL', log1.split('\n').slice(-2));
  ok(M1 && Buffer.from(M1.bgm.title.src.split(',')[1], 'base64').equals(fs.readFileSync(path.join(FIX, 'bgm', 'title.wav'))), 'the embedded bytes are the file');
  ok(M1 && M1.bgm.title.loopStart === 0.1 && M1.bgm.title.loopEnd === 0.4, 'loop points from title.json', M1 && M1.bgm.title);
  ok(M1 && M1.voice.v_fine_t1_01 && M1.voice.v_fine_t1_01.src.startsWith('data:audio/wav;base64,'), 'voice embedded');
  ok(h1.indexOf('window.RPG_MEDIA=') < h1.indexOf('// ==== src/core/ns.js'), 'the media table comes before the game code');
  ok(!/https?:\/\/(?!fonts\.g)[a-z]/i.test(h1.slice(0, h1.indexOf('// ==== src/core/ns.js'))), 'no URL to another host in the head');
  ok(!fs.existsSync(path.join(o1, 'bgm')), 'embed mode leaves no dist/bgm');
  const o2 = path.join(tmp, 'ext');
  run('--media', FIX, '--out', o2, '--bgm', 'external');
  const M2 = media(fs.readFileSync(path.join(o2, 'index.html'), 'utf8'));
  ok(M2 && M2.bgm.title.src === 'bgm/title.wav' && M2.bgm.title.loopEnd === 0.4, '--bgm external: relative URL', M2 && M2.bgm.title);
  ok(fs.existsSync(path.join(o2, 'bgm', 'title.wav')) && fs.readFileSync(path.join(o2, 'bgm', 'title.wav')).equals(fs.readFileSync(path.join(FIX, 'bgm', 'title.wav'))), '--bgm external copies the file to <out>/bgm/');
  ok(M2 && M2.voice.v_fine_t1_01.src.startsWith('data:'), '--bgm external keeps voices embedded');
  run('--media', FIX, '--out', o2, '--voice', 'external');
  const M3 = media(fs.readFileSync(path.join(o2, 'index.html'), 'utf8'));
  ok(M3 && M3.voice.v_fine_t1_01.src === 'voice/v_fine_t1_01.wav' && fs.existsSync(path.join(o2, 'voice', 'v_fine_t1_01.wav')) && !fs.existsSync(path.join(o2, 'bgm')), '--voice external (and bgm back to embedded, stale dist/bgm removed)');
  const empty = path.join(tmp, 'none');
  fs.mkdirSync(empty);
  const o4 = path.join(tmp, 'plain');
  run('--media', empty, '--out', o4);
  ok(!/window\.RPG_MEDIA=/.test(fs.readFileSync(path.join(o4, 'index.html'), 'utf8')), 'no media files → no RPG_MEDIA script');
  const bad = run('--media', FIX, '--out', o4, '--bgm', 'cloud');
  ok(/must be embed or external/.test(bad), 'a bad --bgm value is refused');
  fs.rmSync(tmp, { recursive: true, force: true });
}

// =========================================================================== voice script
function voiceTests() {
  section('voice: voiced lines and tools/voice_script.js');
  const V = require('./voice_script');
  const { lines, problems } = V.collect();
  ok(problems.length === 0, 'no problems in the voiced lines', problems.slice(0, 5));
  ok(lines.length >= 80 && lines.length <= 150, `80–150 voiced lines (${lines.length})`);
  const R = require('./lib/load')({ quiet: true });
  const comp = new Set(Object.keys(R.DB.companions || {}));
  ok(lines.every((l) => V.SPEAKERS[l.speaker] && l.speaker !== 'hero' && !comp.has(l.speaker)), 'only fixed story characters speak (no hero, no companion)');
  ok(new Set(lines.map((l) => l.id)).size === lines.length, 'ids are unique');
  ok(lines.every((l) => /^v_[a-z]+_[a-z0-9]+_\d{2}$/.test(l.id)), 'ids are v_<speaker>_<scene>_<nn>');
  ok(lines.every((l) => !/\{hero\}|\{leader\}/.test(l.text) && l.text.length > 0), 'no {hero} in voiced text');
  for (const sp of ['fine', 'rowell', 'berna', 'noa', 'lazaro', 'king', 'nemrea']) ok(lines.some((l) => l.speaker === sp), 'voiced: ' + sp);
  for (const f of ['story.js', 'final_archive.js', 'final_roa.js', 'ending.js', 'oblivion.js', 'prologue_roa.js', 'region1_forest.js', 'region5_isles.js']) ok(lines.some((l) => l.file.endsWith(f)), 'key scenes of ' + f + ' are voiced');
  const t7 = lines.find((l) => l.id === 'v_rowell_t7_05');
  ok(t7 && t7.text === 'おれは、自分の母の顔を思い出せない。自分の日記を、白の書に写したからだ。' && t7.event === 't7', 'text / event of a known line', t7);
  const noa = lines.find((l) => l.id === 'v_noa_biblia_01');
  ok(noa && !noa.text.startsWith('ノア「'), 'the name prefix 名「…」 is not part of the spoken text', noa && noa.text);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_voice_'));
  execFileSync('node', [path.join(ROOT, 'tools', 'voice_script.js'), '--out', tmp], { stdio: 'pipe' });
  const csv = fs.readFileSync(path.join(tmp, 'script.csv'), 'utf8').replace(/^﻿/, '').trim().split('\n');
  ok(csv[0] === 'id,speaker,name,scene,event,file,line,text,chars,seconds,recorded' && csv.length === lines.length + 1, 'script.csv: header + one row per line', csv[0]);
  const md = fs.readFileSync(path.join(tmp, 'script.md'), 'utf8');
  ok(md.includes('# ルミナス・クロニクル　ボイス収録台本') && md.includes('`v_rowell_t7_05`') && md.includes('## ロウェル'), 'script.md: the recording script by speaker');
  const committed = path.join(ROOT, 'design', 'voice', 'script.csv');
  ok(fs.existsSync(committed) && fs.readFileSync(committed, 'utf8') === fs.readFileSync(path.join(tmp, 'script.csv'), 'utf8'), 'design/voice/script.csv is up to date (run node tools/voice_script.js)');
  fs.rmSync(tmp, { recursive: true, force: true });
}

// =========================================================================== lyria
async function lyriaTests() {
  section('lyria: prompts, requests, no-key run, loop smoothing');
  const L = require('./lyria_bgm');
  const P = L.loadPrompts();
  const R = require('./lib/load')({ quiet: true });
  const ids = P.tracks.map((t) => t.id);
  ok(JSON.stringify([...ids].sort()) === JSON.stringify([...R.Audio.IDS.bgm].sort()), 'prompts.json has one entry per BGM id (32)', ids.length);
  ok(P.tracks.every((t) => t.scene && t.mood && t.tempo && t.key && t.instrumentation && /SNES\/SFC RPG style, original melody/.test(t.style) && t.length_sec > 0 && t.loop), 'every entry: scene mood tempo key instrumentation style length loop');
  ok(P.tracks.every((t) => t.tempo === R.DB.music[t.id].tempo && t.key === R.DB.music[t.id].key), 'tempo / key match the synth tracks');
  ok(L.selectTracks(P, []).map((t) => t.id).join() === 'title,overworld,battle,boss', 'default = first batch title,overworld,battle,boss');
  ok(L.selectTracks(P, ['--only', 'town,sea']).map((t) => t.id).join() === 'town,sea' && L.selectTracks(P, ['--all']).length === 32, '--only / --all');
  let threw = false; try { L.selectTracks(P, ['--only', 'nope']); } catch (e) { threw = true; }
  ok(threw, '--only with an unknown id is refused');
  const t = P.tracks.find((x) => x.id === 'battle');
  const pr = L.buildPrompt(t, P);
  ok(/164 BPM/.test(pr) && /E minor/.test(pr) && /SNES/.test(pr) && !/[ぁ-んァ-ン一-龯]/.test(pr), 'prompt: tempo, key, style, English only', pr);
  const rq = L.PROVIDERS.vertex.request({ project: 'p', location: 'us-central1', token: 'T', model: 'lyria-002' }, t, P, {});
  ok(rq.url === 'https://us-central1-aiplatform.googleapis.com/v1/projects/p/locations/us-central1/publishers/google/models/lyria-002:predict' && rq.headers.Authorization === 'Bearer T' && rq.body.instances[0].prompt === pr && rq.body.instances[0].negative_prompt && rq.body.parameters.sample_count === 1, 'Vertex predict request shape');
  const wav = L.writeWav([new Float32Array([0, 0.5, -0.5])], 48000);
  ok(L.PROVIDERS.vertex.parse({ predictions: [{ audioContent: wav.toString('base64'), mimeType: 'audio/wav' }] }).equals(wav), 'Vertex response → WAV bytes');
  const g = L.PROVIDERS.gemini.request({ key: 'K', model: 'models/lyria-realtime-exp' }, t, P);
  ok(g.url.startsWith('wss://generativelanguage.googleapis.com/') && g.url.endsWith('?key=K') && g.messages[0].setup.model === 'models/lyria-realtime-exp' && g.messages[2].musicGenerationConfig.bpm === 164 && g.messages[3].playbackControl === 'PLAY', 'Gemini Lyria RealTime session shape');
  ok(L.scaleOf('F#m') === 'A_MAJOR_G_FLAT_MINOR' && L.scaleOf('Em') === 'G_MAJOR_E_MINOR' && L.scaleOf('Bb') === 'B_FLAT_MAJOR_G_MINOR', 'key → scale enum');
  ok(L.pickProvider({}, null) === null && L.pickProvider({ GOOGLE_API_KEY: 'k' }, null).name === 'gemini' && L.pickProvider({ VERTEX_PROJECT: 'p', VERTEX_ACCESS_TOKEN: 't', GOOGLE_API_KEY: 'k' }, null).name === 'vertex', 'provider choice from the environment');
  // no key: setup text, exit 0, nothing written; dry run prints requests, exit 0
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_lyria_'));
  const env = Object.assign({}, process.env, { LYRIA_NO_GCLOUD: '1' });
  for (const k of ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'VERTEX_PROJECT', 'VERTEX_ACCESS_TOKEN', 'GOOGLE_ACCESS_TOKEN']) delete env[k];
  const out1 = execFileSync('node', [path.join(ROOT, 'tools', 'lyria_bgm.js'), '--out', tmp], { env, stdio: 'pipe' }).toString();
  ok(/no credentials found/.test(out1) && /VERTEX_PROJECT/.test(out1) && /GOOGLE_API_KEY/.test(out1) && fs.readdirSync(tmp).length === 0, 'no credentials → setup steps, exit 0, nothing written');
  const out2 = execFileSync('node', [path.join(ROOT, 'tools', 'lyria_bgm.js'), '--dry-run', '--out', tmp], { env: Object.assign({}, env, { GOOGLE_API_KEY: 'SECRET123' }), stdio: 'pipe' }).toString();
  ok((out2.match(/^=== /gm) || []).length === 4 && /title/.test(out2) && /BidiGenerateMusic/.test(out2) && !out2.includes('SECRET123') && fs.readdirSync(tmp).length === 0, 'dry run: 4 prompts + requests, key redacted, nothing written');
  fs.rmSync(tmp, { recursive: true, force: true });
  // WAV + loop smoothing
  const rate = 8000, n = rate * 3, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = 0.5 * Math.sin(2 * Math.PI * 3.1 * i / rate) + 0.2 * Math.sin(2 * Math.PI * 57 * i / rate);
  const back = L.parseWav(L.writeWav([a, a], rate));
  ok(back.rate === rate && back.channels.length === 2 && Math.abs(back.channels[1][1234] - a[1234]) < 1e-4, 'WAV write/parse round trip');
  const sm = L.loopSmooth([a], rate, 0.5)[0];
  ok(sm.length === n - rate * 0.5, 'loop smoothing drops the crossfaded tail');
  const jumpRaw = Math.abs(a[n - 1] - a[0]), jumpLoop = Math.abs(sm[sm.length - 1] - sm[0]);
  const step = Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(a[i + 1] - a[i])));
  ok(jumpRaw > 0.2 && jumpLoop <= step * 1.5, `the loop seam is as smooth as the music (raw jump ${jumpRaw.toFixed(3)}, looped ${jumpLoop.toFixed(4)}, step ${step.toFixed(4)})`);
  const x = rate * 0.5;
  ok(Math.abs(sm[x] - a[x]) < 1e-6 && Math.abs(sm[x - 1] - a[x - 1]) < 0.01, 'the crossfade ends on the original signal');
}

// =========================================================================== browser
async function browserTests() {
  section('browser: the built fixture page decodes and plays the files (Chromium)');
  let pw;
  try { pw = require('playwright'); } catch (e) { try { pw = require('/opt/node22/lib/node_modules/playwright'); } catch (e2) { console.log('  (playwright not available — skipped)'); return; } }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_media_b_'));
  try { execFileSync('node', [path.join(ROOT, 'tools', 'build.js'), '--media', FIX, '--out', tmp], { cwd: ROOT, stdio: 'pipe' }); } catch (e) { /* a syntax-excluded file of another owner sets exit 1 */ }
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto('file://' + path.join(tmp, 'index.html'));
    await page.waitForTimeout(800);
    const r = await page.evaluate(async () => {
      const A = window.RPG.Audio;
      A.init();
      await A.context.resume();
      A.playBGM('title');
      await new Promise((res) => setTimeout(res, 600));
      const d1 = A.debug();
      A.pushBGM('battle');
      await new Promise((res) => setTimeout(res, 200));
      const d2 = A.debug();
      A.popBGM();
      await new Promise((res) => setTimeout(res, 200));
      const d3 = A.debug();
      A.setVolumes(null, null, 0.8);
      const h = A.playVoice('v_fine_t1_01');
      await new Promise((res) => setTimeout(res, 150));
      const v1 = A.voice;
      A.stopVoice(h);
      const v2 = A.voice;
      return { d1, d2, d3, v1, v2, ctx: A.context.state };
    });
    ok(r.d1.playing === 'title' && r.d1.file === true, 'Chromium decodes the embedded WAV and loops it', r.d1);
    ok(r.d2.current === 'battle' && !r.d2.file && r.d3.playing === 'title' && r.d3.file, 'push (synth battle) / pop (file) in the browser', [r.d2, r.d3]);
    ok(r.v1 === 'v_fine_t1_01' && r.v2 === null, 'voice plays and stops in the browser', [r.v1, r.v2]);
    ok(!errs.length, 'no page errors', errs);
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  if (want('audio')) await audioTests();
  if (want('ui')) await uiTests();
  if (want('settings')) settingsTests();
  if (want('build')) buildTests();
  if (want('voice')) voiceTests();
  if (want('lyria')) await lyriaTests();
  if (want('browser')) await browserTests();
  console.log(`\ntest_media: ${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
