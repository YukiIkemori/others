#!/usr/bin/env node
// Offline audio verification (owner: audio).
//
//   node tools/render_audio.js lint [ids…]          compile every track in node: bar checks, channel
//                                                    lengths, loop points, instrument ranges, harmony
//                                                    (non-chord tones on strong beats, semitone clashes)
//   node tools/render_audio.js show <id> [ch]        print a track bar by bar: chords + notes of a channel
//   node tools/render_audio.js render [ids…] [--sfx] [--jingles] [--bgm] [--wav] [--suggest] [--seed N]
//                                                    render through an OfflineAudioContext in Chromium,
//                                                    report duration / peak / RMS / clipping / silence gaps,
//                                                    optionally write WAVs to /tmp/claude-0/audio/.
//                                                    Renders are reproducible: noise offsets come from a
//                                                    seeded generator (per id by default, or --seed N)
//   node tools/render_audio.js stems <id>            loudness of each channel alone (mix balance)
//   node tools/render_audio.js spectro <id> [secs]   log-frequency spectrogram PNG (visual timbre check)
//   node tools/render_audio.js inst                  loudness of every instrument (calibration)
//
// Levels are measured pre-limiter at full volume. Targets: BGM ≈ -17 LUFS (K-weighted, ungated),
// jingles ≈ -16, peaks < -1.5 dBFS; --suggest prints the per-track gains that reach them.
// Long render lists are split across fresh browsers (one page holding 100+ s buffers crashes).
//
// require('./render_audio') → { BGM, JINGLES, SFX (the DESIGN §11.11.4 lists, = R.Audio.IDS), RANGE,
//   loadNode, lint, listDrift, render, withPage, PAGE_FN } — used by tools/test_audio.js,
//   tools/check_audio.js and qa's validate.js; main() only runs when executed directly.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/tmp/claude-0/audio';
const FILES = [
  'src/core/ns.js', 'src/core/audio.js',
  ...fs.readdirSync(path.join(ROOT, 'src/audio')).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/audio/' + f),
];
// The normative id lists (DESIGN §11.11.4). src/core/audio.js carries the same lists as R.Audio.IDS;
// `lint` fails if the two drift apart. qa's validate.js can require() this file for them.
const BGM = ('title overworld sea town village castle shrine ending dungeon cave tower pyramid ice volcano ' +
  'lastdungeon battle boss lastboss valzard tavern home rival tension sorrow boss2 rarebattle superboss ' +
  'postgame forest ghost hollowking legend').split(' ');
const JINGLES = 'victory levelup item keyitem inn save gameover rare superrare chapter recruit'.split(' ');
const SFX = ('cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt ' +
  'magic fire ice thunder wind holy dark earth water heal revive buff debuff status poison sleep death ' +
  'enemy_die boss_die escape stairs door locked chest item gold step_damage ship bump warp teleport ' +
  'steal jump breath roar shake glimmer golden light freeze burn quill page swap bell unlock arrow ' +
  'lash parry secret').split(' ');
const TARGET = { bgm: -17, jingle: -16 }; // K-weighted loudness (LUFS, ungated) at full volume
const PEAK_MAX = -1.5; // dBFS pre-limiter

// sane playing ranges (midi) per instrument
const RANGE = {
  bass: [28, 62], tri: [28, 67], synbass: [24, 60], contra: [28, 60], timp: [36, 58],
  strings: [43, 91], violin: [55, 96], pad: [40, 84], choir: [48, 81], organ: [36, 91],
  brass: [46, 82], trumpet: [54, 89], horn: [41, 77],
  flute: [60, 98], oboe: [58, 91], clarinet: [50, 91], square: [48, 96], pulse: [48, 96], thin: [48, 96],
  harp: [36, 96], pizz: [36, 84], harpsi: [41, 89], guitar: [40, 84],
  bell: [60, 100], celesta: [60, 108], marimba: [45, 96], glock: [72, 108],
  musicbox: [60, 98], warpbox: [55, 96], swell: [36, 84],
};
const DECAYING = /^(harp|pizz|guitar|marimba|harpsi|bell|celesta|glock|timp|musicbox|warpbox)$/;
const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'ab', 'a', 'bb', 'b'];
const nn = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);

function loadNode() {
  const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, Math, JSON, Date, Promise };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  return sandbox.RPG;
}

// ------------------------------------------------------------------ lint
function strongBeats(bar) {
  // 4/4 → beats 1 & 3; 3/4 → 1; 6/8 & 12/8 → every dotted quarter; 2/4 → 1
  if (bar === 192) return [0, 96];
  if (bar === 144) return null; // 3/4 or 6/8 decided by meter string
  return [0];
}
function lint(R, ids, verbose) {
  let problems = 0;
  for (const id of ids) {
    const d = R.DB.music[id];
    if (!d) { console.log(`✗ ${id}: missing`); problems++; continue; }
    const s = R.Audio.compile(id);
    const meter = d.meter || '4/4';
    const bar = s.bar;
    let strong = strongBeats(bar);
    if (!strong) strong = meter === '6/8' ? [0, 72] : [0];
    if (meter === '12/8') strong = [0, 144];
    const beat = /\/8$/.test(meter) ? 72 : 48;
    const issues = [...s.warns];
    // ranges
    const rangeBad = {};
    for (const e of s.events) {
      if (e.drum) continue;
      const r = RANGE[e.inst];
      if (!r) continue;
      for (const m of e.notes) if (m < r[0] || m > r[1]) {
        const k = `${e.ch}:${e.inst}`;
        (rangeBad[k] = rangeBad[k] || new Set()).add(nn(m));
      }
    }
    for (const k in rangeBad) issues.push(`range ch${k}: ${[...rangeBad[k]].slice(0, 8).join(' ')}`);
    // harmony
    const spans = s.prog ? s.prog.spans : [];
    const chordAt = (tick) => {
      const T = tick % Math.max(1, s.endTick);
      for (const sp of spans) if (T >= sp.tick && T < sp.tick + sp.len) return sp.chord;
      return null;
    };
    const nct = [];
    const clashes = [];
    if (spans.length) {
      const mel = s.events.filter((e) => !e.drum && d.ch[e.ch].mml != null && !d.ch[e.ch].noLint);
      for (const e of mel) {
        const pos = e.tick % bar;
        if (!strong.includes(pos) || e.len < 24) continue;
        const ch = chordAt(e.tick);
        if (!ch) continue;
        for (const m of e.notes) {
          const pc = m % 12;
          if (ch.pcs.includes(pc) || ch.bass === pc) continue;
          nct.push(`b${Math.floor(e.tick / bar) + 1}:${pos / 48 + 1} ch${e.ch} ${nn(m)} over ${ch.sym}`);
        }
      }
      // semitone clashes on a 16th grid between sustained notes (≥1 note outside the chord)
      const pitched = s.events.filter((e) => !e.drum && !d.ch[e.ch].noLint);
      for (let t = 0; t < s.endTick; t += 12) {
        const snd = [];
        for (const e of pitched) {
          if (e.tick <= t && e.tick + e.len * 0.99 > t && e.tick + e.len - t >= 12) {
            const dec = DECAYING.test(e.inst);
            if (dec && t - e.tick >= 48) continue; // decayed plucks no longer clash
            // a clash matters when a note is struck on a beat, or is long enough to be heard as held
            const pos = e.tick % bar;
            const strongNote = strong.includes(pos) || (e.len >= beat && e.tick % beat === 0) || e.len >= 2 * beat;
            for (const m of e.notes) snd.push({ m, ch: e.ch, on: e.tick === t, strong: e.tick === t && strongNote });
          }
        }
        const ch = chordAt(t);
        for (let a = 0; a < snd.length; a++) for (let b = a + 1; b < snd.length; b++) {
          const x = snd[a], y = snd[b];
          if (x.ch === y.ch) continue;
          const ic = Math.abs(x.m - y.m) % 12;
          if (ic !== 1 && ic !== 11) continue;
          if (!x.on && !y.on) continue;
          const inX = ch && ch.pcs.includes(x.m % 12), inY = ch && ch.pcs.includes(y.m % 12);
          if (inX && inY) continue;
          // the out-of-chord note must be the one struck on a beat (or held); off-beat passing tones are fine
          if (!((!inX && x.strong) || (!inY && y.strong))) continue;
          clashes.push(`b${Math.floor(t / bar) + 1}:${((t % bar) / 48 + 1).toFixed(2)} ${nn(x.m)}(ch${x.ch}) vs ${nn(y.m)}(ch${y.ch})${ch ? ' over ' + ch.sym : ''}`);
        }
      }
    }
    const loopLen = s.loop ? s.endSec - s.loopSec : 0;
    const head = `${id.padEnd(12)} ${s.endSec.toFixed(1).padStart(5)}s  loop ${s.loop ? s.loopSec.toFixed(1) + '→' + s.endSec.toFixed(1) + ' (' + loopLen.toFixed(1) + 's)' : '—'}  bars ${s.endTick / bar}  events ${s.events.length}`;
    const bad = issues.length + clashes.length;
    console.log((bad ? '✗ ' : '✓ ') + head + (nct.length ? `  nct ${nct.length}` : '') + (clashes.length ? `  clashes ${clashes.length}` : ''));
    for (const w of issues) console.log('    ' + w);
    const lim = verbose ? 1e9 : 12;
    if (clashes.length) console.log('    clash: ' + clashes.slice(0, lim).join('\n    clash: '));
    if (nct.length && verbose) console.log('    nct: ' + nct.join('\n    nct: '));
    problems += bad;
  }
  return problems;
}

// the tool's lists must equal R.Audio.IDS (src/core/audio.js)
function listDrift(R) {
  const out = [];
  const I = R.Audio.IDS || {};
  for (const [name, mine, theirs] of [['bgm', BGM, I.bgm], ['jingles', JINGLES, I.jingles], ['sfx', SFX, I.sfx]]) {
    const a = new Set(mine), b = new Set(theirs || []);
    const onlyTool = mine.filter((x) => !b.has(x)), onlyCore = (theirs || []).filter((x) => !a.has(x));
    if (onlyTool.length || onlyCore.length || mine.length !== (theirs || []).length) {
      out.push(`${name}: tool-only [${onlyTool.join(' ')}] core-only [${onlyCore.join(' ')}]`);
    }
  }
  return out;
}

function show(R, id, chIdx) {
  const s = R.Audio.compile(id);
  const d = R.DB.music[id];
  const bar = s.bar;
  const bars = s.endTick / bar;
  const chs = chIdx != null ? [chIdx] : d.ch.map((c, i) => i).filter((i) => d.ch[i].mml != null && d.ch[i].inst !== 'drums');
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, t1 = t0 + bar;
    const chords = (s.prog ? s.prog.spans : []).filter((sp) => sp.tick >= t0 && sp.tick < t1).map((sp) => (sp.chord ? sp.chord.sym : 'x')).join(' ');
    const lines = chs.map((ci) => s.events.filter((e) => e.ch === ci && e.tick >= t0 && e.tick < t1)
      .map((e) => `${e.notes.map(nn).join('+')}${e.tick % 48 ? '' : ''}/${e.len}`).join(' '));
    console.log(`${String(b + 1).padStart(3)}${s.loopTick === t0 ? 'L' : ' '} [${chords.padEnd(16)}] ${lines.join('  ||  ')}`);
  }
}

// ------------------------------------------------------------------ browser rendering
function harness() {
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, 'harness.html');
  fs.writeFileSync(f, `<!DOCTYPE html><meta charset="utf-8"><body>\n${FILES.map((x) => `<script src="file://${path.join(ROOT, x)}"></script>`).join('\n')}\n</body>`);
  return f;
}
async function withPage(fn) {
  let playwright;
  try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext()).newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.stack || e));
  await page.goto('file://' + harness());
  try { return await fn(page); } finally { await browser.close(); }
}

// in-page: render and analyse; returns stats (+ base64 16-bit WAV). `seed` makes the render
// reproducible: the only randomness in the synth is where a noise burst starts reading the noise
// buffer (Mixer.noise → Math.random), which moves the peaks of noisy SFX by ±1 dB between runs.
const PAGE_FN = async (args) => {
  const rnd = Math.random;
  if (args.seed != null) {
    let s = (args.seed >>> 0) || 0x2545f491;
    Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }
  try { return await PAGE_RENDER(args); } finally { Math.random = rnd; }
  async function PAGE_RENDER({ kind, id, sr, wav, inst, midi, dur, only }) {
  const R = window.RPG;
  let info, len;
  if (kind === 'inst') len = dur + 1.5;
  else if (kind === 'sfx') len = 4;
  else {
    const i = R.Audio.info(id);
    len = 0.05 + i.duration + (i.loop ? i.loopEnd - i.loopStart : 0) + 3;
  }
  const ctx = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
  if (kind === 'inst') { R.Audio.renderNote(ctx, inst, midi, dur, 1); info = { start: 0.02, end: 0.02 + dur }; }
  else if (kind === 'sfx') info = R.Audio.renderSfx(ctx, id);
  else info = R.Audio.renderTrack(ctx, id, { passes: 2, only });
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1), N = L.length;
  let peak = 0, clip = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.abs(L[i]), b = Math.abs(Rr[i]);
    if (a > peak) peak = a; if (b > peak) peak = b;
    if (a >= 0.999 || b >= 0.999) clip++;
  }
  const rms = (t0, t1) => {
    const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(N, Math.floor(t1 * sr));
    let s = 0;
    for (let i = i0; i < i1; i++) s += L[i] * L[i] + Rr[i] * Rr[i];
    return Math.sqrt(s / Math.max(1, 2 * (i1 - i0)));
  };
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120);
  // ITU BS.1770 K-weighting (high shelf + high pass, RBJ biquads at this sample rate) → ungated loudness
  const biquad = (x, b0, b1, b2, a1, a2) => {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  };
  const kw = (x) => {
    let A = Math.pow(10, 3.99984 / 40), w = 2 * Math.PI * 1681.97 / sr, al = Math.sin(w) / (2 * 0.70717), c = Math.cos(w);
    let a0 = (A + 1) - (A - 1) * c + 2 * Math.sqrt(A) * al;
    const s1 = biquad(x, A * ((A + 1) + (A - 1) * c + 2 * Math.sqrt(A) * al) / a0, -2 * A * ((A - 1) + (A + 1) * c) / a0,
      A * ((A + 1) + (A - 1) * c - 2 * Math.sqrt(A) * al) / a0, 2 * ((A - 1) - (A + 1) * c) / a0, ((A + 1) - (A - 1) * c - 2 * Math.sqrt(A) * al) / a0);
    w = 2 * Math.PI * 38.1355 / sr; al = Math.sin(w) / (2 * 0.50033); c = Math.cos(w); a0 = 1 + al;
    return biquad(s1, (1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - al) / a0);
  };
  const KL = kw(L), KR = kw(Rr);
  const lufs = (t0, t1) => {
    const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(N, Math.floor(t1 * sr));
    let s = 0;
    for (let i = i0; i < i1; i++) s += KL[i] * KL[i] + KR[i] * KR[i];
    return -0.691 + 10 * Math.log10(Math.max(1e-12, s / Math.max(1, i1 - i0)));
  };
  const a0 = info.loop ? info.loopStart : info.start, a1 = info.loop ? info.loopEnd : info.end;
  const win = 0.4;
  let stMax = 0, stMin = 1;
  for (let t = a0; t + win <= a1; t += win / 2) { const r = rms(t, t + win); stMax = Math.max(stMax, r); stMin = Math.min(stMin, r); }
  // silence gaps (50 ms windows below -55 dBFS) inside the music
  const gaps = [];
  let gs = null;
  let tail = N - 1;
  while (tail > 0 && Math.abs(L[tail]) < 0.001 && Math.abs(Rr[tail]) < 0.001) tail--;
  // one-shots: stop at the point where the sound has faded (a decaying tail is not a gap)
  const endScan = kind === 'bgm' ? info.end - 0.1 : Math.min(a1, tail / sr) - 0.1;
  for (let t = info.start; t < endScan; t += 0.05) {
    const q = rms(t, t + 0.05) < 0.00178;
    if (q && gs == null) gs = t;
    if (!q && gs != null) { if (t - gs >= 0.5) gaps.push([+gs.toFixed(2), +(t - gs).toFixed(2)]); gs = null; }
  }
  if (gs != null && endScan - gs >= 0.5) gaps.push([+gs.toFixed(2), +(endScan - gs).toFixed(2)]);
  const out = {
    peak: db(peak), clip, rms: db(rms(a0, a1)), lufs: lufs(a0, a1), stMax: db(stMax), stMin: db(stMin),
    seamBefore: info.loop ? db(rms(info.loopEnd - 0.5, info.loopEnd)) : null,
    seamAfter: info.loop ? db(rms(info.loopEnd, info.loopEnd + 0.5)) : null,
    gaps, dur: a1 - a0, audible: tail / sr,
  };
  if (wav) {
    const n = Math.min(N, Math.ceil((tail / sr + 0.1) * sr));
    const bytes = new Uint8Array(44 + n * 4);
    const dv = new DataView(bytes.buffer);
    const W = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
    W(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); W(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true);
    dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); W(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true);
    }
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    out.wav = btoa(s);
  }
  return out;
  }
};
// default seed of a render: stable per id, so two runs of the same content measure the same
const seedOf = (kind, id) => { let h = 0x811c9dc5; for (const ch of `${kind}:${id}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };

async function render(ids, opts) {
  const R = loadNode();
  const rows = [];
  // a fresh browser every few long renders: one page accumulating 100+ s offline buffers crashes
  const chunks = [];
  let cur = [], weight = 0;
  for (const it of ids) {
    const w = it[0] === 'bgm' ? 3 : 1;
    if (weight + w > 24 && cur.length) { chunks.push(cur); cur = []; weight = 0; }
    cur.push(it); weight += w;
  }
  if (cur.length) chunks.push(cur);
  for (const chunk of chunks) await withPage(async (page) => {
    for (const [kind, id, seedArg] of chunk) {
      const t = Date.now();
      const seed = seedArg != null ? seedArg : opts.seed != null ? opts.seed : seedOf(kind, id);
      const r = await page.evaluate(PAGE_FN, { kind, id, sr: 32000, wav: opts.wav, seed });
      if (r.wav) { fs.writeFileSync(path.join(OUT, `${kind}_${id}.wav`), Buffer.from(r.wav, 'base64')); delete r.wav; }
      const cur = kind === 'sfx' ? 1 : (R.DB.music[id].gain != null ? R.DB.music[id].gain : 1);
      const target = kind === 'bgm' ? TARGET.bgm : kind === 'jingle' ? TARGET.jingle : null;
      let sug = null;
      if (target != null) {
        sug = cur * Math.pow(10, (target - r.lufs) / 20);
        const pk = r.peak + 20 * Math.log10(sug / cur);
        if (pk > PEAK_MAX) sug *= Math.pow(10, (PEAK_MAX - pk) / 20);
      }
      rows.push({ kind, id, seed, ...r, sug });
      const flag = r.clip || r.peak > -0.5 || r.gaps.length ? '✗' : '✓';
      console.log(`${flag} ${kind.padEnd(6)} ${id.padEnd(13)} dur ${r.dur.toFixed(2).padStart(6)}s  peak ${r.peak.toFixed(1).padStart(6)}  rms ${r.rms.toFixed(1).padStart(6)}  lufs ${r.lufs.toFixed(1).padStart(6)}  st[${r.stMin.toFixed(0)},${r.stMax.toFixed(0)}]` +
        (r.seamBefore != null ? `  seam ${r.seamBefore.toFixed(0)}/${r.seamAfter.toFixed(0)}` : '') +
        `  clip ${r.clip}` + (r.gaps.length ? `  gaps ${JSON.stringify(r.gaps)}` : '') +
        (kind === 'sfx' ? `  audible ${r.audible.toFixed(2)}s` : '') +
        (sug != null ? `  gain ${cur.toFixed(2)}→${sug.toFixed(2)}` : '') + (seedArg != null ? `  seed ${seedArg}` : '') + `  (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    }
  });
  if (opts.suggest) {
    const g = {};
    for (const r of rows) if (r.sug != null) g[r.id] = +r.sug.toFixed(2);
    console.log('\nsuggested gains:\n' + JSON.stringify(g));
  }
  return rows;
}

async function inst() {
  const R = loadNode();
  const names = Object.keys(R.Audio.INST);
  await withPage(async (page) => {
    for (const n of names) {
      const midi = /^(bass|tri|synbass|contra|timp)$/.test(n) ? 40 : /bell|celesta|glock/.test(n) ? 79 : 67;
      const r = await page.evaluate(PAGE_FN, { kind: 'inst', inst: n, midi, dur: 0.8, sr: 32000 });
      console.log(`${n.padEnd(9)} midi ${midi}  peak ${r.peak.toFixed(1).padStart(6)}  rms ${r.rms.toFixed(1).padStart(6)}  st max ${r.stMax.toFixed(1)}`);
    }
    for (const k of 'kshoctmfxzpbgwi') {
      const r = await page.evaluate(PAGE_FN, { kind: 'inst', inst: 'drums', midi: k, dur: 0.3, sr: 32000 });
      console.log(`drum ${k}     peak ${r.peak.toFixed(1).padStart(6)}  rms ${r.rms.toFixed(1).padStart(6)}`);
    }
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'lint';
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const si = argv.indexOf('--seed');
  const seed = si >= 0 ? +argv[si + 1] : undefined;
  const args = argv.slice(1).filter((a, i) => !a.startsWith('--') && !(si >= 0 && i + 1 === si + 1));
  if (cmd === 'lint') {
    const R = loadNode();
    const all = [...BGM, ...JINGLES];
    const ids = args.length ? args : all;
    const missing = all.filter((id) => !R.DB.music[id]);
    const missSfx = SFX.filter((id) => !R.DB.sfx[id]);
    if (missing.length) console.log('missing tracks (served by stand-ins in game): ' + missing.join(' '));
    if (missSfx.length) console.log('missing sfx (served by stand-ins in game): ' + missSfx.join(' '));
    const drift = listDrift(R);
    for (const d of drift) console.log('✗ list drift: ' + d);
    const p = lint(R, ids.filter((id) => R.DB.music[id]), flags.has('--verbose'));
    const total = p + missing.length + missSfx.length + drift.length;
    console.log(total ? `\n${total} problem(s)` : '\nall clean');
    process.exitCode = total ? 1 : 0;
  } else if (cmd === 'show') {
    show(loadNode(), args[0], args[1] != null ? +args[1] : null);
  } else if (cmd === 'render') {
    const R = loadNode();
    let list = [];
    const any = flags.has('--sfx') || flags.has('--bgm') || flags.has('--jingles');
    const asSfx = (id) => R.DB.sfx[id] && (!R.DB.music[id] || flags.has('--sfx'));
    if (args.length) for (const id of args) list.push([asSfx(id) ? 'sfx' : JINGLES.includes(id) ? 'jingle' : 'bgm', id]);
    else {
      if (!any || flags.has('--bgm')) list.push(...BGM.filter((id) => R.DB.music[id]).map((id) => ['bgm', id]));
      if (!any || flags.has('--jingles')) list.push(...JINGLES.filter((id) => R.DB.music[id]).map((id) => ['jingle', id]));
      if (!any || flags.has('--sfx')) list.push(...SFX.filter((id) => R.DB.sfx[id]).map((id) => ['sfx', id]));
    }
    const rows = await render(list, { wav: flags.has('--wav'), suggest: flags.has('--suggest'), seed });
    const bad = rows.filter((r) => r.clip || r.peak > -0.5 || r.gaps.length);
    console.log(bad.length ? `\n${bad.length} with problems` : '\nno clipping, no silence gaps');
    if (flags.has('--wav')) console.log('WAVs in ' + OUT);
  } else if (cmd === 'stems') {
    const R = loadNode();
    const id = args[0];
    const d = R.DB.music[id];
    await withPage(async (page) => {
      for (let i = 0; i < d.ch.length; i++) {
        const r = await page.evaluate(PAGE_FN, { kind: 'bgm', id, sr: 32000, only: [i] });
        const c = d.ch[i];
        console.log(`ch${i} ${String(c.inst).padEnd(9)} vol ${String(c.vol).padEnd(5)} rms ${r.rms.toFixed(1).padStart(6)}  lufs ${r.lufs.toFixed(1).padStart(6)}  st max ${r.stMax.toFixed(1).padStart(6)}  peak ${r.peak.toFixed(1)}`);
      }
    });
  } else if (cmd === 'spectro') {
    // log-frequency spectrogram of the first `secs` seconds → PNG (visual timbre check)
    const id = args[0], secs = +(args[1] || 12);
    const R = loadNode();
    const kind = R.DB.music[id] ? 'bgm' : 'sfx';
    await withPage(async (page) => {
      await page.setViewportSize({ width: 1200, height: 520 });
      const res = await page.evaluate(async ({ id, secs, kind }) => {
        const R = window.RPG, sr = 32000;
        const ctx = new OfflineAudioContext(1, Math.ceil(secs * sr), sr);
        if (kind === 'bgm') R.Audio.renderTrack(ctx, id, { passes: 1 }); else R.Audio.renderSfx(ctx, id);
        const x = (await ctx.startRendering()).getChannelData(0);
        const N = 2048, hop = Math.max(64, Math.floor(x.length / 1100)), W = Math.floor((x.length - N) / hop), H = 440;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H + 60;
        document.body.style.margin = 0; document.body.appendChild(cv);
        const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
        const img = g.createImageData(W, H);
        const re = new Float64Array(N), im = new Float64Array(N), win = new Float64Array(N);
        for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
        const fft = () => {
          for (let i = 1, j = 0; i < N; i++) { let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
          for (let len = 2; len <= N; len <<= 1) {
            const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
            for (let i = 0; i < N; i += len) {
              let cr = 1, ci = 0;
              for (let k = 0; k < len / 2; k++) {
                const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
                re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
                const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
              }
            }
          }
        };
        const fLo = 40, fHi = 16000;
        for (let c = 0; c < W; c++) {
          for (let i = 0; i < N; i++) { re[i] = x[c * hop + i] * win[i]; im[i] = 0; }
          fft();
          for (let r = 0; r < H; r++) {
            const f = fLo * Math.pow(fHi / fLo, 1 - r / H), bin = Math.min(N / 2 - 1, Math.round(f * N / sr));
            const mag = Math.hypot(re[bin], im[bin]) / N * 4;
            const db = 20 * Math.log10(mag + 1e-9), v = Math.max(0, Math.min(1, (db + 90) / 80));
            const o = (r * W + c) * 4;
            img.data[o] = 255 * Math.min(1, v * 1.6); img.data[o + 1] = 255 * Math.max(0, v * 1.6 - 0.6); img.data[o + 2] = 255 * (v < 0.4 ? v * 2 : Math.max(0, 1.4 - v * 1.5)); img.data[o + 3] = 255;
          }
        }
        g.putImageData(img, 0, 0);
        g.fillStyle = '#fff'; g.font = '12px monospace';
        for (const f of [100, 250, 500, 1000, 2000, 4000, 8000]) { const y = H * (1 - Math.log(f / fLo) / Math.log(fHi / fLo)); g.fillRect(0, y, 6, 1); g.fillText(f + 'Hz', 8, y + 4); }
        // waveform envelope strip
        g.fillStyle = '#6cf';
        for (let c = 0; c < W; c++) { let m = 0; for (let i = 0; i < hop; i++) m = Math.max(m, Math.abs(x[c * hop + i] || 0)); g.fillRect(c, H + 58 - m * 56, 1, m * 56); }
        return { W, H: H + 60 };
      }, { id, secs, kind });
      const file = path.join(OUT, `spec_${id}.png`);
      await page.locator('canvas').screenshot({ path: file });
      console.log('spectrogram →', file, res);
    });
  } else if (cmd === 'inst') {
    await inst();
  } else {
    console.log('usage: node tools/render_audio.js lint|show|render|inst …');
  }
}
module.exports = { BGM, JINGLES, SFX, RANGE, TARGET, PEAK_MAX, FILES, loadNode, lint, listDrift, render, withPage, PAGE_FN, seedOf };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
