#!/usr/bin/env node
// Recorded sound effects and ambience beds with Google Lyria (Gemini API), the same way tools/lyria_bgm.js
// makes the recorded BGM → assets/sfx/<id>.<k>.ogg + <id>.json, assets/amb/<id>.ogg + <id>.json.
// The game keeps its synthesised sounds (src/audio/sfx*.js, the procedural ambience of core/audio.js) until
// an integration step plays these files instead; nothing here runs in the game.
//
//   node tools/lyria_sfx.js --only hit,crit --listen          these SFX ids (design/sfx/prompts.json)
//   node tools/lyria_sfx.js --all --listen                    every SFX id (62)
//   node tools/lyria_sfx.js --kind amb --all --listen         every ambience bed (design/sfx/ambience.json)
//   node tools/lyria_sfx.js --dry-run --only glimmer          print prompts and requests, send nothing
//   options: --kind sfx|amb (default sfx)   --force (redo ids whose output exists)
//            --takes <n>  raw Lyria takes per round (default sfx 1, amb 2)
//            --rounds <n> rounds per id (default 3): another round (alt prompt, then the prompt again) runs while
//                         fewer than `variants` events reach --min-fit (default 7) / the best bed is under it
//            --listen     a Gemini model hears the candidates and rates them (without it: signal heuristics only)
//            --reuse      use the cached raw takes of an id, generate only what a round still lacks
//            --reprocess  no Lyria call: redo detection / selection / encoding from the cached raw takes
//                         (listener results are cached too; with --listen only unheard candidates are sent)
//            --raw <dir>  raw take cache (default $TMPDIR/lyria_sfx_raw)   --out <dir> (default assets/sfx | assets/amb)
//            --preview    (re)write design/sfx_preview.html from the outputs and exit
//            --clean-raw  delete the cached raw takes of the selected ids that have a finished output, then exit
//
// ------------------------------------------------------------------ API (verified 2026-10-04)
// Same endpoint as the BGM: POST …/v1beta/models/lyria-3.5:generateContent {contents:[{parts:[{text}]}]} → MP3
// 44.1 kHz stereo (tools/lib/gemini_audio.js geminiPost / partsOf; header x-goog-api-key, never in a URL or log).
//   - lyria-3.5 makes non-musical sound when the prompt says so plainly: "A dry close-up foley recording, not
//     music: eight separate short …, separated by two seconds of silence. No melody, no instruments, no rhythm,
//     no background ambience. Duration: 25 seconds." → ~10–15 isolated events (count and length are approximate;
//     a short rumble intro may come first). lyria-3-clip-preview drifts into music: not used.
//   - Prompts with combat words ("sword slash", "sound effects library …") can come back blocked (finishReason
//     OTHER, no audio). Entries are phrased as foley / field recordings; on a block the entry's `alt` is sent.
//   - Every take is judged: Lyria may drift (asked for mountain wind, got a seaside).
// Listener: POST …/models/gemini-3.8-flash:generateContent (LISTEN_MODEL) with the MP3 inline and
// generationConfig.responseMimeType application/json.
// Usage log: one JSON line per API call {t, tool, purpose, id, model, ok, secs, status, bytes} appended to
// $LYRIA_USAGE_LOG (default $TMPDIR/lyria_usage.jsonl — outside the repo; never the key).
// 429: geminiPost waits and retries; a per-day quota stops the run cleanly and prints the ids still to do (exit 2).
//
// ------------------------------------------------------------------ SFX processing
//   1. decode the take (ffmpeg), mono sum for analysis, 30 Hz high-pass;
//   2. events: 5 ms RMS envelope; noise floor = 15th percentile; an event starts above max(floor+14, top−38) dB
//      and runs (hysteresis) while above max(floor+6, top−50, −70) dB; gaps shorter than `merge` (default 80 ms)
//      join; events in the first 0.5 s (the rumble intro) and shorter than minLen are dropped; longer than maxLen
//      → cut at maxLen with a longer fade when ≤ 1.8 × maxLen, else dropped;
//   3. heuristic rank (length near `target`, signal-to-floor) → the best 8 go to the listener, played with
//      1.5 s of silence between them (each at −6 dBFS), twice in opposite orders; fit = the mean of both;
//      flagged (music / human voice) when both say so, or one does and the mean fit < 6;
//   4. keep the best `variants` events (fit ≥ 5, unflagged); trim 3 ms before the onset, 3 ms raised-cosine
//      fade-in, cosine fade-out over the last 20 % (8–120 ms; 30 %, ≤ 250 ms when cut);
//   5. level: linear gain to the entry's `peak` dBFS (= the synth sound's measured peak, so file and synth sit
//      at the same level: UI ≈ −12, spells −9…−6, impacts ≈ −3), lowered when the RMS over the sound would pass
//      `rmsMax` (synth RMS + 4 dB; recorded sounds are denser than the synth);
//   6. Ogg Vorbis q4, mono (stereo when the entry says `stereo`), 44.1 kHz → <id>.<k>.ogg, k = 0…variants−1.
// <id>.json: {id, category, files, durations, peaks, rms, gainDb, keepSynth, source{provider, model, prompt,
// generated, takes, rounds}, picks[{take, at, fit, problem}], analysis{candidates, listened, meanFit}}.
//
// ------------------------------------------------------------------ ambience processing
//   1. decode (stereo), smoothed 1 s level; the body is where the level is within 5 dB of the median (skips a
//      fade-in / fade-out), at most --amb-max (60) s + the crossfade;
//   2. the loop end is the point in the last 10 s of the body whose 2 s level is closest to the body's start;
//   3. equal-power crossfade of the last X = 4 s into the first ones (lyria_bgm.js loopSmooth): the file loops
//      end → 0 seamlessly, so loopStart = 0 and loopEnd = duration (the BGM json keys);
//   4. linear gain to the entry's `lufs` (integrated, EBU R128): the level of the procedural bed at strength 1 /
//      volume 10 (blizzard −33 … heat −43 LUFS), sample peak ≤ −9 dBFS, so a file plays at unity gain on the
//      amb bus; Ogg Vorbis 96 kbps stereo;
//   5. --listen: the whole loop is checked for content and ANY music / tonal pad / rhythm / voice (rejected),
//      and the seam (8 s before the end + 8 s from the start) is rated; best = fit + min(seam, 8)/3 of the clean takes
//      with fit ≥ 5 (none → no file: the procedural bed stays). Rounds go on until fit ≥ --min-fit and seam ≥ 6.
//      Lyria drifts into music (piano, music box, hip-hop beats) for most ambience prompts — about 1 take in 3 is
//      clean, quiet pastoral wordings are worst; "A dry foley recording, not music: …" worked best (2026-10-04).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const GA = require('./lib/gemini_audio');
const BGM = require('./lyria_bgm');

const ROOT = path.resolve(__dirname, '..');
const FILES = { sfx: path.join(ROOT, 'design', 'sfx', 'prompts.json'), amb: path.join(ROOT, 'design', 'sfx', 'ambience.json') };
const OUT = { sfx: path.join(ROOT, 'assets', 'sfx'), amb: path.join(ROOT, 'assets', 'amb') };
const LISTEN_MODEL = process.env.LISTEN_MODEL || 'gemini-3.8-flash';
const USAGE_LOG = process.env.LYRIA_USAGE_LOG || path.join(os.tmpdir(), 'lyria_usage.jsonl');
const WORLD = 'a gentle, melancholic night-time fantasy role-playing game (a world lit by lanterns and beacon fires; warm, hand-crafted sound; magic is shimmering and organic, never sci-fi)';
const redact = GA.redact;
const r1 = (v) => Math.round(v * 10) / 10, r3 = (v) => Math.round(v * 1000) / 1000;
const dbOf = (v) => 20 * Math.log10(Math.max(v, 1e-9));

// ------------------------------------------------------------------ API with a usage log
const stats = { lyria: 0, lyriaSec: 0, listen: 0, listenSec: 0, blocked: 0, failed: 0 };
function usage(rec) {
  try { fs.mkdirSync(path.dirname(USAGE_LOG), { recursive: true }); fs.appendFileSync(USAGE_LOG, JSON.stringify(Object.assign({ t: new Date().toISOString(), tool: 'lyria_sfx' }, rec)) + '\n'); } catch (e) { /* the log is best effort */ }
}
/** one generateContent call, logged. purpose 'sfx' | 'amb' | 'listen' */
async function call(model, body, purpose, id, log) {
  const t0 = Date.now();
  try {
    const json = await GA.geminiPost(model, body, { timeoutSec: purpose === 'listen' ? 240 : 900, tries: 6, log });
    const secs = (Date.now() - t0) / 1000;
    const p = GA.partsOf(json);
    usage({ purpose, id, model, ok: true, secs: r1(secs), bytes: p.audio.reduce((s, a) => s + a.bytes.length, 0), finish: p.finishReason || null });
    if (purpose === 'listen') { stats.listen++; stats.listenSec += secs; } else { stats.lyria++; stats.lyriaSec += secs; }
    return json;
  } catch (e) {
    const secs = (Date.now() - t0) / 1000;
    usage({ purpose, id, model, ok: false, secs: r1(secs), status: e.status || null, daily: !!e.daily, error: redact(e.message || e).slice(0, 160) });
    stats.failed++;
    throw e;
  }
}

// ------------------------------------------------------------------ PCM helpers
/** 2nd-order Butterworth high-pass (RBJ biquad), returns a new array */
function highpass(x, rate, fc) {
  const w = 2 * Math.PI * fc / rate, c = Math.cos(w), al = Math.sin(w) / Math.SQRT2;
  const a0 = 1 + al, b0 = (1 + c) / 2 / a0, b1 = -(1 + c) / a0, b2 = b0, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
function rmsOf(chans, a, b) { let e = 0, n = 0; for (const x of chans) for (let i = a; i < b; i++) { e += x[i] * x[i]; n++; } return Math.sqrt(e / Math.max(1, n)); }
/** PCM → MP3 bytes (for the listener) */
function toMp3(chans, rate, kbps) {
  const tmp = path.join(os.tmpdir(), `lc_sfx_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e6)}.mp3`);
  const n = chans[0].length, ch = chans.length, inter = new Float32Array(n * ch);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) inter[i * ch + c] = chans[c][i];
  const r = spawnSync(GA.ffmpegPath(), ['-hide_banner', '-nostdin', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', String(ch), '-i', '-', '-b:a', (kbps || 128) + 'k', tmp], { input: Buffer.from(inter.buffer), maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('ffmpeg mp3: ' + String(r.stderr).split('\n').slice(-3).join(' '));
  const bytes = fs.readFileSync(tmp); fs.rmSync(tmp, { force: true });
  return bytes;
}
function jsonOf(text) { const t = String(text || ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); return JSON.parse(t.slice(a, b + 1)); }

// ------------------------------------------------------------------ SFX: events
/** take PCM → candidate events [{start, end (samples), dur, cut, peakDb, rmsDb, snr, zcr, attack}] */
function detectEvents(chans, rate, e) {
  const x = highpass(GA.mono(chans), rate, 30);
  const fr = Math.round(0.005 * rate), nF = Math.floor(x.length / fr);
  const env = new Float32Array(nF);
  for (let f = 0; f < nF; f++) { let s = 0; for (let i = f * fr; i < (f + 1) * fr; i++) s += x[i] * x[i]; env[f] = 10 * Math.log10(s / fr + 1e-12); }
  const sorted = Array.from(env).sort((a, b) => a - b);
  // floor: 15th percentile, but never below −90 dB (Lyria pads with digital silence)
  const floor = Math.max(sorted[Math.floor(nF * 0.15)], -90), top = sorted[nF - 1];
  const on = Math.max(floor + 14, top - 38), off0 = Math.max(floor + 6, top - 50, -70);
  const mergeF = Math.max(1, Math.round((e.merge || 0.08) / 0.005));
  const longF = Math.round(e.maxLen * 1.8 / 0.005);
  // runs above `off` inside [a, b) that hold a frame above `trig`; a run longer than 1.8 × maxLen (sounds packed
  // back to back) is split again with `off` 6 dB higher relative to its own maximum, up to 10 dB under it
  const evs = [];
  const runs = (a, b, off, trig, depth) => {
    let f = a, lastEnd = a - 1;
    while (f < b) {
      if (env[f] <= trig) { f++; continue; }
      let s0 = f; while (s0 - 1 > lastEnd && s0 - 1 >= a && env[s0 - 1] > off) s0--;
      let g = f, last = f;
      while (g < b) { if (env[g] > off) last = g; else if (g - last > mergeF) break; g++; }
      const en = last + 1;
      if (en - s0 > longF && depth < 6) {
        let mx = -200; for (let k = s0; k < en; k++) mx = Math.max(mx, env[k]);
        const off2 = Math.max(off + 6, mx - 40);
        if (off2 < mx - 10) runs(s0, en, off2, Math.max(trig, off2 + 6), depth + 1);
      } else evs.push([s0, en]);
      lastEnd = en; f = en;
    }
  };
  runs(0, nF, off0, on, 0);
  const out = [];
  const maxLen = e.maxLen, minLen = e.minLen || 0.03;
  for (const [s, en] of evs) {
    let start = Math.max(0, s * fr - Math.round(0.003 * rate)), end = Math.min(x.length, en * fr + Math.round(0.004 * rate));
    if (start < 0.5 * rate) continue; // the rumble intro of a take
    let dur = (end - start) / rate, cut = false;
    if (dur < minLen) continue;
    if (dur > maxLen) { if (dur > maxLen * 1.8) continue; end = start + Math.round(maxLen * rate); dur = maxLen; cut = true; }
    let pk = 0, pkAt = start, zc = 0, ss = 0;
    for (let i = start; i < end; i++) { const v = Math.abs(x[i]); if (v > pk) { pk = v; pkAt = i; } if (i > start && (x[i] >= 0) !== (x[i - 1] >= 0)) zc++; ss += x[i] * x[i]; }
    let envMax = -200; for (let k = s; k < en; k++) envMax = Math.max(envMax, env[k]);
    let pre = 200; for (let k = Math.max(0, s - 20); k < s; k++) pre = Math.min(pre, env[k]);
    out.push({ start, end, dur, cut, peakDb: dbOf(pk), rmsDb: 10 * Math.log10(ss / (end - start) + 1e-12), snr: envMax - floor, sep: s > 0 ? envMax - pre : 60, zcr: zc / dur, attack: (pkAt - start) / rate });
  }
  return out;
}
function heuristic(c, e) {
  return -1.5 * Math.abs(Math.log(c.dur / (e.target || c.dur))) + Math.min(c.snr, 45) / 15 + Math.min(c.sep, 40) / 20 - (c.cut ? 0.6 : 0) - (c.attack > Math.max(0.15, c.dur * 0.6) ? 0.4 : 0);
}
/** an event → finished PCM (mono unless stereo), trimmed and faded, not yet level-adjusted */
function cutEvent(chans, rate, c, stereo) {
  const src = stereo && chans.length > 1 ? chans : [GA.mono(chans)];
  const n = c.end - c.start;
  const fi = Math.max(2, Math.round(0.003 * rate));
  const foSec = c.cut ? Math.min(0.25, Math.max(0.02, c.dur * 0.3)) : Math.min(0.12, Math.max(0.008, c.dur * 0.2));
  const fo = Math.min(n - fi, Math.round(foSec * rate));
  return src.map((a) => {
    const seg = highpass(a.subarray(Math.max(0, c.start - Math.round(0.05 * rate)), c.end), rate, 30);
    const o = seg.slice(seg.length - n);
    for (let i = 0; i < fi; i++) o[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fi);
    for (let i = 0; i < fo; i++) o[n - fo + i] *= 0.5 + 0.5 * Math.cos(Math.PI * (i + 1) / fo);
    return o;
  });
}
function levelSfx(pcm, e) {
  const pk = GA.peak(pcm), rms = rmsOf(pcm, 0, pcm[0].length);
  let gdb = (e.peak != null ? e.peak : -9) - dbOf(pk);
  let capped = false;
  if (e.rmsMax != null && dbOf(rms) + gdb > e.rmsMax) { gdb = e.rmsMax - dbOf(rms); capped = true; }
  const g = Math.pow(10, gdb / 20);
  return { pcm: GA.gain(pcm, g), gainDb: gdb, peakDb: dbOf(pk) + gdb, rmsDb: dbOf(rms) + gdb, capped };
}

// ------------------------------------------------------------------ listener
/** rate candidate events: cands[{pcm}] → [{fit, music, voice, problem}] (two orderings averaged) */
async function listenSfx(e, cands, log) {
  const rate = 44100;
  const order = async (idx) => {
    const gap = Math.round(1.5 * rate), lead = Math.round(1.0 * rate);
    const parts = idx.map((i) => { const m = GA.mono(cands[i].pcm); const g = Math.pow(10, -6 / 20) / Math.max(GA.peak([m]), 1e-9); return m.map((v) => v * g); });
    const total = lead + parts.reduce((s, p) => s + p.length + gap, 0);
    const clip = new Float32Array(total), starts = [];
    let p = lead;
    for (const q of parts) { starts.push(p / rate); clip.set(q, p); p += q.length + gap; }
    const mp3 = toMp3([clip], rate, 128);
    const q = `You are a sound designer auditioning candidate recordings for one sound effect of ${WORLD}.
Wanted: "${e.role}". Ideal length about ${e.target} s.
The audio holds ${idx.length} candidate sounds separated by silence. Candidate start times: ${starts.map((s, k) => `${k + 1}: ${s.toFixed(2)} s`).join(', ')}.
For EACH candidate judge:
 fit 1-10 (10 = exactly the wanted sound: clean, isolated, right character and length, usable as-is in the game; 1 = wrong sound or unusable),
 music = true if it is or contains music (a melody of several notes, chords, a beat or rhythm, an instrument playing a phrase) — a single chime, bell strike or tonal ping that the wanted description asks for is NOT music,
 voice = true if it contains a human voice (speech, singing, a human grunt or shout),
 problem = a few words ("too long", "two sounds", "muffled", "wrong sound: footsteps", "none").
Reply JSON {"candidates":[{"n":1,"fit":7,"music":false,"voice":false,"problem":"none"}]} with one object per candidate, in order.`;
    const json = await call(LISTEN_MODEL, { contents: [{ parts: [{ inlineData: { mimeType: 'audio/mpeg', data: mp3.toString('base64') } }, { text: q }] }], generationConfig: { responseMimeType: 'application/json' } }, 'listen', e.id, log);
    const j = jsonOf(GA.partsOf(json).text);
    const arr = j.candidates || [];
    return idx.map((ci, k) => { const r = arr.find((a) => +a.n === k + 1) || arr[k] || {}; return { ci, fit: +r.fit || 0, music: !!r.music, voice: !!r.voice, problem: String(r.problem || '') }; });
  };
  const idx = cands.map((_, i) => i);
  const res = cands.map(() => ({ fits: [], music: 0, voice: 0, problems: [] }));
  for (const ord of [idx, idx.slice().reverse()]) {
    try {
      for (const r of await order(ord)) { const t = res[r.ci]; t.fits.push(r.fit); t.music += r.music; t.voice += r.voice; if (r.problem && r.problem !== 'none') t.problems.push(r.problem); }
    } catch (err) { if (err.daily) throw err; log(`    listen failed: ${redact(err.message || err).slice(0, 100)}`); }
  }
  return res.map((t) => {
    if (!t.fits.length) return null;
    const fit = t.fits.reduce((a, b) => a + b, 0) / t.fits.length;
    const both = t.fits.length;
    const flag = (k) => k >= both || (k > 0 && fit < 6);
    return { fit: r1(fit), fits: t.fits, music: flag(t.music), voice: flag(t.voice), problem: [...new Set(t.problems)].join(' / ') || 'none' };
  });
}
async function listenAmb(e, chans, rate, log) {
  const out = { fit: 0, music: false, voice: false, content: '', problem: '', seam: null };
  const mx = Math.min(chans[0].length, Math.round(60 * rate));
  const mp3 = toMp3(chans.map((a) => a.subarray(0, mx)), rate, 96);
  const q = `This recording is meant as a looping background ambience bed for ${WORLD}. Wanted: "${e.desc}".
Listen to all of it carefully. Reply JSON {"fit":<1-10, 10 = exactly this environment, realistic, even, usable as a quiet bed under music>,"music":<true if you hear ANY music: melody, tonal pad or musical drone, instrument, singing, rhythmic beat>,"voice":<true if any human voice>,"content":"<what you actually hear, a few words>","problem":"<a few words or none>"}`;
  const fits = [];
  for (let k = 0; k < 2; k++) {
    try {
      const json = await call(LISTEN_MODEL, { contents: [{ parts: [{ inlineData: { mimeType: 'audio/mpeg', data: mp3.toString('base64') } }, { text: q }] }], generationConfig: { responseMimeType: 'application/json' } }, 'listen', e.id, log);
      const j = jsonOf(GA.partsOf(json).text);
      fits.push(+j.fit || 0); out.music = out.music || !!j.music; out.voice = out.voice || !!j.voice;
      out.content += (out.content ? ' / ' : '') + String(j.content || ''); if (j.problem && j.problem !== 'none') out.problem += (out.problem ? ' / ' : '') + j.problem;
    } catch (err) { if (err.daily) throw err; log(`    listen failed: ${redact(err.message || err).slice(0, 100)}`); }
  }
  out.fit = fits.length ? r1(fits.reduce((a, b) => a + b, 0) / fits.length) : 0;
  out.fits = fits;
  // the seam: 8 s before the loop end + 8 s from the start (the jump at 8.0 s)
  const L = chans[0].length, W = Math.round(8 * rate);
  const seamClip = chans.map((a) => { const o = new Float32Array(2 * W); o.set(a.subarray(L - W, L), 0); o.set(a.subarray(0, W), W); return o; });
  const sq = `This 16-second excerpt is a looping nature ambience: at exactly 8.0 s the playback jumps from the loop end back to the loop start. Listen around 8.0 s. Reply JSON {"seam_smooth":<1-10, 10 = impossible to notice>,"problem":"<what is audible at 8 s: level jump, sudden change, click, or none>"}`;
  try {
    const json = await call(LISTEN_MODEL, { contents: [{ parts: [{ inlineData: { mimeType: 'audio/mpeg', data: toMp3(seamClip, rate, 128).toString('base64') } }, { text: sq }] }], generationConfig: { responseMimeType: 'application/json' } }, 'listen', e.id, log);
    const j = jsonOf(GA.partsOf(json).text);
    out.seam = { seam_smooth: +j.seam_smooth || 0, problem: String(j.problem || '') };
  } catch (err) { if (err.daily) throw err; out.seam = { seam_smooth: 0, problem: 'listen failed' }; }
  return out;
}

// ------------------------------------------------------------------ Lyria takes
function rawFiles(dir, id) {
  if (!fs.existsSync(dir)) return [];
  const re = new RegExp('^' + id.replace(/[^a-z0-9_]/gi, '') + '\\.(\\d+)\\.mp3$');
  return fs.readdirSync(dir).filter((f) => re.test(f)).sort((a, b) => +re.exec(a)[1] - +re.exec(b)[1]).map((f) => {
    const file = path.join(dir, f);
    return { file, meta: fs.existsSync(file + '.json') ? JSON.parse(fs.readFileSync(file + '.json', 'utf8')) : {} };
  });
}
/** one new take for round `round` → {file, meta} | null. Blocked → the other phrasing. */
async function generateTake(kind, e, model, round, dir, log) {
  const texts = (round % 2 === 1 ? [e.alt, e.prompt] : [e.prompt, e.alt]).filter(Boolean);
  if (e.extra && round >= 2) texts.unshift(...[].concat(e.extra));
  for (const text of texts) {
    process.stdout.write(`[lyria] ${e.id}: round ${round + 1} take with ${model}… `);
    const t0 = Date.now();
    let json;
    try { json = await call(model, { contents: [{ parts: [{ text }] }] }, kind, e.id, log); } catch (err) {
      if (err.daily) throw err;
      console.log(`failed (${redact(err.message || err).slice(0, 120)})`);
      continue;
    }
    const p = GA.partsOf(json);
    if (!p.audio.length) { stats.blocked++; console.log(`no audio (${p.finishReason || p.blocked || 'blocked'}) — trying the other phrasing`); continue; }
    const n = rawFiles(dir, e.id).reduce((m, r) => Math.max(m, +/\.(\d+)\.mp3$/.exec(r.file)[1] + 1), 0);
    const file = path.join(dir, `${e.id}.${n}.mp3`);
    fs.writeFileSync(file, p.audio[0].bytes);
    const meta = { provider: 'gemini', model, prompt: text, round, generated: new Date().toISOString() };
    fs.writeFileSync(file + '.json', JSON.stringify(meta, null, 1));
    console.log(`${(p.audio[0].bytes.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    return { file, meta };
  }
  return null;
}

// ------------------------------------------------------------------ SFX id
async function doSfx(e, o) {
  const dir = path.join(o.raw, 'sfx');
  const cacheFile = path.join(dir, e.id + '.listen.json');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  const decoded = new Map();
  const dec = (f) => { if (!decoded.has(f)) decoded.set(f, GA.decode(f)); return decoded.get(f); };
  let takes = (o.reuse || o.reprocess) ? rawFiles(dir, e.id) : [];
  const rounds = o.reprocess ? 1 : o.rounds;
  let pool = [], picks = [], round = 0;
  for (; round < rounds; round++) {
    if (!o.reprocess) {
      const have = takes.filter((t) => (t.meta.round || 0) === round).length;
      for (let k = have; k < o.takes; k++) { const t = await generateTake('sfx', e, o.model, round, dir, o.log); if (t) takes.push(t); }
    }
    // candidates of every take so far
    pool = [];
    for (const t of takes) {
      const { rate, channels } = dec(t.file);
      for (const c of detectEvents(channels, rate, e)) { c.take = t; c.rate = rate; c.key = `${path.basename(t.file)}@${c.start}`; c.h = heuristic(c, e); pool.push(c); }
    }
    pool.sort((a, b) => b.h - a.h);
    // listen to the best unheard ones (up to 8 per round; heard ones keep their cached rating)
    if (o.listen) {
      const unheard = pool.filter((c) => !cache[c.key]).slice(0, 8);
      const heardOk = pool.filter((c) => cache[c.key] && !cache[c.key].music && !cache[c.key].voice && cache[c.key].fit >= o.minFit).length;
      if (unheard.length && !(o.reprocess && heardOk >= e.variants)) {
        for (const c of unheard) c.pcm = cutEvent(dec(c.take.file).channels, c.rate, c, e.stereo);
        const res = await listenSfx(e, unheard, o.log);
        unheard.forEach((c, i) => { if (res[i]) cache[c.key] = res[i]; });
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
      }
    }
    for (const c of pool) c.heard = cache[c.key] || null;
    const ok = pool.filter((c) => c.heard ? !c.heard.music && !c.heard.voice && c.heard.fit >= 5 : !o.listen);
    ok.sort((a, b) => (b.heard ? b.heard.fit : 0) - (a.heard ? a.heard.fit : 0) || b.h - a.h);
    picks = ok.slice(0, e.variants);
    const good = ok.filter((c) => !c.heard || c.heard.fit >= o.minFit).length;
    o.log(`  ${e.id}: ${pool.length} events in ${takes.length} take(s); heard ${pool.filter((c) => c.heard).length}; ` +
      `best ${ok.slice(0, 4).map((c) => (c.heard ? c.heard.fit : '?') + (c.heard && c.heard.problem !== 'none' ? ` (${c.heard.problem.slice(0, 40)})` : '')).join(', ') || '-'}`);
    if (good >= e.variants || !o.listen) break;
    if (round === rounds - 1) break;
  }
  if (!picks.length) throw new Error(`no usable event (${pool.length} candidates${pool.length ? ', all rejected by the listener' : ''})`);
  // outputs
  const outDir = o.out;
  for (const f of fs.readdirSync(outDir).filter((f) => f.startsWith(e.id + '.') && /^[a-z_]+\.\d+\.ogg$/.test(f) && f.split('.')[0] === e.id)) fs.unlinkSync(path.join(outDir, f));
  const files = [], durations = [], peaks = [], rms = [], gains = [], pk = [];
  picks.forEach((c, k) => {
    const pcm = c.pcm || cutEvent(dec(c.take.file).channels, c.rate, c, e.stereo);
    const lv = levelSfx(pcm, e);
    const file = `${e.id}.${k}.ogg`;
    GA.encode(lv.pcm, c.rate, path.join(outDir, file), { q: 4 });
    files.push(file); durations.push(r3(c.dur)); peaks.push(r1(lv.peakDb)); rms.push(r1(lv.rmsDb)); gains.push(r1(lv.gainDb));
    pk.push({ take: path.basename(c.take.file), at: r3(c.start / c.rate), fit: c.heard ? c.heard.fit : null, problem: c.heard ? c.heard.problem : undefined, rmsCapped: lv.capped || undefined, cut: c.cut || undefined });
  });
  const heard = pool.filter((c) => c.heard);
  const usedTakes = [...new Set(picks.map((c) => c.take))];
  const prev = fs.existsSync(path.join(outDir, e.id + '.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, e.id + '.json'), 'utf8')) : {};
  const meanFit = picks.every((c) => c.heard) ? r1(picks.reduce((s, c) => s + c.heard.fit, 0) / picks.length) : null;
  const j = {
    id: e.id, category: e.category, files, durations, peaks, rms, gainDb: gains, channels: e.stereo ? 2 : 1,
    keepSynth: e.keepSynth || undefined,
    weak: meanFit != null && meanFit < o.minFit ? true : undefined,
    source: {
      provider: 'gemini', model: usedTakes[0].meta.model || o.model,
      prompt: usedTakes.length === 1 ? usedTakes[0].meta.prompt : [...new Set(usedTakes.map((t) => t.meta.prompt))],
      generated: usedTakes.map((t) => t.meta.generated).sort().pop(),
      takes: takes.length, rounds: Math.max(...takes.map((t) => (t.meta.round || 0) + 1)),
    },
    picks: pk,
    analysis: { candidates: pool.length, listened: heard.length, listenModel: heard.length ? LISTEN_MODEL : undefined, meanFit, peakTarget: e.peak, rmsMax: e.rmsMax },
    note: prev.note,
  };
  fs.writeFileSync(path.join(outDir, e.id + '.json'), JSON.stringify(j, null, 2) + '\n');
  const kb = files.reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0) / 1024;
  console.log(`[lyria] ${e.id}: ${files.length} file(s) ${durations.map((d) => d.toFixed(2)).join('/')} s, fit ${pk.map((p) => p.fit).join('/')}, ${kb.toFixed(0)} KB`);
  return { id: e.id, fit: meanFit, n: files.length };
}

// ------------------------------------------------------------------ ambience bed
function ambLoop(chans, rate, o) {
  const x = GA.mono(chans), W = rate; // 1 s windows, hop 0.25 s
  const hop = Math.round(rate / 4), lv = [];
  for (let s = 0; s + W <= x.length; s += hop) { let e = 0; for (let i = s; i < s + W; i++) e += x[i] * x[i]; lv.push(10 * Math.log10(e / W + 1e-12)); }
  const med = [...lv].sort((a, b) => a - b)[Math.floor(lv.length / 2)];
  let a = 4; while (a < lv.length / 3 && lv[a] < med - 5) a++;
  let b = lv.length - 3; while (b > lv.length / 2 && lv[b] < med - 5) b--;
  const X = Math.round(o.xfade * rate);
  let A = a * hop, B = Math.min(b * hop + W, A + Math.round(o.max * rate) + X);
  if ((B - A) / rate < 20 + o.xfade) throw new Error(`body too short (${((B - A) / rate).toFixed(1)} s)`);
  // loop end: the point in the last 10 s whose 2 s level is closest to the level of the body start
  const l2 = (s) => { let e = 0; for (let i = s; i < s + 2 * rate; i++) e += x[i] * x[i]; return 10 * Math.log10(e / (2 * rate) + 1e-12); };
  const ref = l2(A);
  let bestB = B, bestD = Infinity;
  for (let s = B; s > B - 10 * rate && s - 2 * rate > A + 20 * rate; s -= Math.round(rate / 4)) { const d = Math.abs(l2(s - 2 * rate) - ref); if (d < bestD) { bestD = d; bestB = s; } }
  const body = chans.map((c) => c.slice(A, bestB));
  return { channels: BGM.loopSmooth(body, rate, o.xfade), from: A / rate, to: bestB / rate, levelDiff: bestD };
}
async function doAmb(e, o) {
  const dir = path.join(o.raw, 'amb');
  const cacheFile = path.join(dir, e.id + '.listen.json');
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  let takes = (o.reuse || o.reprocess) ? rawFiles(dir, e.id) : [];
  const rounds = o.reprocess ? 1 : o.rounds;
  let best = null;
  const results = new Map();
  for (let round = 0; round < rounds; round++) {
    if (!o.reprocess) {
      const have = takes.filter((t) => (t.meta.round || 0) === round).length;
      for (let k = have; k < o.takes; k++) { const t = await generateTake('amb', e, o.model, round, dir, o.log); if (t) takes.push(t); }
    }
    for (const t of takes) {
      if (results.has(t.file)) continue;
      try {
        let { rate, channels } = GA.decode(t.file);
        if (channels.length === 1) channels = [channels[0], channels[0]];
        const lp = ambLoop(channels, rate, o);
        const nm = GA.normalise(lp.channels, rate, e.lufs, -9);
        const r = { take: t, rate, channels: nm.channels, lp, gainDb: nm.gainDb, limited: nm.limited, raw: channels[0].length / rate };
        const key = path.basename(t.file) + '@' + Math.round(lp.from * 4) + '-' + Math.round(lp.to * 4);
        if (o.listen && !cache[key]) { cache[key] = await listenAmb(e, r.channels, rate, o.log); fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1)); }
        r.heard = cache[key] || null;
        r.q = r.heard ? (r.heard.music || r.heard.voice || r.heard.fit < 5 ? -10 : r.heard.fit + (r.heard.seam ? Math.min(r.heard.seam.seam_smooth, 8) / 3 : 0)) : 0;
        o.log(`  ${e.id}: ${path.basename(t.file)} loop ${lp.from.toFixed(1)}–${lp.to.toFixed(1)} s` + (r.heard ? ` → fit ${r.heard.fit}${r.heard.music ? ' MUSIC' : ''}${r.heard.voice ? ' VOICE' : ''} seam ${r.heard.seam ? r.heard.seam.seam_smooth : '-'}: ${r.heard.content.slice(0, 90)}` : ''));
        results.set(t.file, r);
      } catch (err) { if (err.daily) throw err; o.log(`  ${e.id}: ${path.basename(t.file)} unusable: ${redact(err.message || err).slice(0, 100)}`); results.set(t.file, null); }
    }
    best = [...results.values()].filter((r) => r && r.q > 0 || (r && !o.listen)).sort((a, b) => b.q - a.q)[0] || null;
    if (!o.listen && best) break;
    if (best && best.heard && best.heard.fit >= o.minFit && (!best.heard.seam || best.heard.seam.seam_smooth >= 6)) break;
  }
  if (!best) throw new Error('no usable take (all rejected or failed)');
  const file = path.join(o.out, e.id + '.ogg');
  GA.encode(best.channels, best.rate, file, { kbps: 96 });
  const L = GA.loudness(best.channels, best.rate);
  const dur = best.channels[0].length / best.rate;
  const m = /^(\w+)(?:\s*(\{.*\}))?$/.exec(e.bed || e.id);
  let spec = { bed: m ? m[1] : e.id };
  if (m && m[2]) { try { spec = Object.assign(spec, JSON.parse(m[2].replace(/(\w+):/g, '"$1":'))); } catch (err) { /* keep bed */ } }
  const j = {
    loopStart: 0, loopEnd: r3(dur), bed: spec.bed, spec, lufsTarget: e.lufs,
    source: { provider: 'gemini', model: best.take.meta.model || o.model, prompt: best.take.meta.prompt, generated: best.take.meta.generated, rawSeconds: r1(best.raw), takes: takes.length, excerpt: [r1(best.lp.from), r1(best.lp.to)] },
    analysis: {
      loudnessLUFS: r1(L.I), truePeakDb: L.TP, gainDb: r1(best.gainDb), peakLimited: best.limited, xfade: o.xfade, seamLevelDiffDb: r1(best.lp.levelDiff),
      listen: best.heard ? { model: LISTEN_MODEL, fit: best.heard.fit, seam: best.heard.seam, content: best.heard.content, problem: best.heard.problem || 'none' } : undefined,
    },
  };
  fs.writeFileSync(path.join(o.out, e.id + '.json'), JSON.stringify(j, null, 2) + '\n');
  console.log(`[lyria] ${e.id}: ${path.relative(ROOT, file)} ${dur.toFixed(1)} s, ${L.I.toFixed(1)} LUFS, fit ${best.heard ? best.heard.fit : '-'} seam ${best.heard && best.heard.seam ? best.heard.seam.seam_smooth : '-'}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  return { id: e.id, fit: best.heard ? best.heard.fit : null };
}


// ------------------------------------------------------------------ design/sfx_preview.html
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function writePreview() {
  const S = JSON.parse(fs.readFileSync(FILES.sfx, 'utf8')), A = JSON.parse(fs.readFileSync(FILES.amb, 'utf8'));
  const rd = (dir, id) => { const f = path.join(dir, id + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const kb = (dir, files) => files.reduce((s, f) => s + (fs.existsSync(path.join(dir, f)) ? fs.statSync(path.join(dir, f)).size : 0), 0) / 1024;
  let sfxKb = 0, ambKb = 0, nS = 0, nA = 0, nFiles = 0;
  const cats = { ui: 'UI', battle: '戦闘', spell: '魔法・状態', field: 'フィールド' };
  const rows = {};
  for (const e of S.entries) {
    const j = rd(OUT.sfx, e.id);
    let cell = '<i>未生成（合成音のまま）</i>';
    if (j) {
      nS++; nFiles += j.files.length; const k = kb(OUT.sfx, j.files); sfxKb += k;
      cell = j.files.map((f, i) => `<audio controls preload="none" src="../assets/sfx/${esc(f)}"></audio> <small>#${i} ${j.durations[i].toFixed(2)} s · peak ${j.peaks[i]} dBFS · fit ${j.picks[i].fit == null ? '-' : j.picks[i].fit}${j.picks[i].problem && j.picks[i].problem !== 'none' ? ' · ' + esc(j.picks[i].problem) : ''}</small>`).join('<br>') +
        `<br><small>${k.toFixed(0)} KB · ${j.source.takes} take(s)${j.keepSynth ? ' · <b>keepSynth</b>（合成音を使う）' : ''}${j.weak ? ' · <b>weak</b>' : ''}${j.note ? ' · ' + esc(j.note) : ''}</small>`;
    }
    (rows[e.category] = rows[e.category] || []).push(`<tr id="sfx-${e.id}"><td><b>${e.id}</b><br><small>${cats[e.category]} · 合成音 ${e.synth ? e.synth.audible + ' s, peak ' + e.synth.peak : ''}</small></td><td>${cell}</td><td><small>${esc(e.role)}</small><br><details><summary><small>prompt</small></summary><small>${esc(j ? [].concat(j.source.prompt).join(' | ') : e.prompt)}</small></details></td></tr>`);
  }
  const ambRows = A.entries.map((e) => {
    const j = rd(OUT.amb, e.id);
    let cell = '<i>未生成（手続きの環境音のまま）</i>';
    if (j) {
      nA++; const k = kb(OUT.amb, [e.id + '.ogg']); ambKb += k;
      const L = j.analysis.listen;
      cell = `<audio controls preload="none" src="../assets/amb/${e.id}.ogg"></audio><br><button data-seam="../assets/amb/${e.id}.ogg" data-ls="${j.loopStart}" data-le="${j.loopEnd}">loop seam</button> <small>${j.loopEnd.toFixed(1)} s loop · ${j.analysis.loudnessLUFS} LUFS · ${k.toFixed(0)} KB${L ? ` · fit ${L.fit} · seam ${L.seam ? L.seam.seam_smooth : '-'}` : ''}</small>${L ? `<br><small>聞こえたもの: ${esc(L.content)}</small>` : ''}`;
    }
    return `<tr id="amb-${e.id}"><td><b>${e.id}</b><br><small><code>${esc(e.bed)}</code> · ${e.lufs} LUFS</small></td><td>${cell}</td><td><small>${esc(e.desc)}</small></td></tr>`;
  });
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SFX Preview</title>
<style>
:root{--bg:#fbfaf7;--fg:#222;--mute:#666;--line:#ddd;--acc:#2b5d9b}
@media (prefers-color-scheme: dark){:root{--bg:#16171a;--fg:#e6e6e6;--mute:#9a9a9a;--line:#333;--acc:#8db4ea}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px}
h1{font-size:20px}h2{margin-top:32px;border-bottom:2px solid var(--line)}h3{margin:24px 0 4px}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:6px 8px;vertical-align:top}
td:first-child{width:150px}small,i{color:var(--mute)}audio{height:32px;max-width:100%;vertical-align:middle}code{font-size:12px}a{color:var(--acc)}
button{font-size:12px;margin-top:2px}details{margin-top:2px}
</style></head><body>
<h1>ルミナス・クロニクル — 録音の効果音・環境音の試聴</h1>
<p>効果音 ${nS}/${S.entries.length} id（${nFiles} ファイル、${(sfxKb / 1024).toFixed(1)} MB）、環境音 ${nA}/${A.entries.length} 床（${(ambKb / 1024).toFixed(1)} MB）。ファイルは <code>assets/sfx/&lt;id&gt;.&lt;k&gt;.ogg</code> <code>assets/amb/&lt;id&gt;.ogg</code>。
効果音の音量は合成音と同じ山（peak）に揃えてあります。fit は聞き手のモデルの評価（10 点満点）。「loop seam」は環境音のループの継ぎ目（終わり 6 秒 → 先頭）を試聴します。
作り直し: <code>node tools/lyria_sfx.js --only &lt;id&gt; --listen --force</code> / <code>node tools/lyria_sfx.js --kind amb --only &lt;id&gt; --listen --force</code>。この表: <code>node tools/lyria_sfx.js --preview</code>。</p>
<p>${Object.keys(cats).map((c) => `<a href="#${c}">${cats[c]}</a>`).join(' · ')} · <a href="#amb">環境音</a></p>
${Object.keys(cats).map((c) => `<h2 id="${c}">${cats[c]}</h2>\n<table>${(rows[c] || []).join('\n')}</table>`).join('\n')}
<h2 id="amb">環境音</h2>
<table>${ambRows.join('\n')}</table>
<script>
let ac, cur;
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-seam]'); if (!b) return;
  ac = ac || new AudioContext(); if (cur) { try { cur.stop(); } catch (x) {} }
  const buf = await ac.decodeAudioData(await (await fetch(b.dataset.seam)).arrayBuffer());
  const ls = +b.dataset.ls, le = +b.dataset.le || buf.duration;
  const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = ls; s.loopEnd = le; s.connect(ac.destination);
  s.start(0, Math.max(0, le - 6)); s.stop(ac.currentTime + 14); cur = s;
});
</script>
</body></html>
`;
  const out = path.join(ROOT, 'design', 'sfx_preview.html');
  fs.writeFileSync(out, html);
  console.log(`[lyria] ${path.relative(ROOT, out)}: ${nS} sfx id(s), ${nA} bed(s)`);
}

// ------------------------------------------------------------------ main
async function main(argv, E) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  if (argv.includes('--preview')) { writePreview(); return 0; }
  const kind = arg('--kind', 'sfx');
  if (!FILES[kind]) throw new Error('--kind sfx|amb');
  const P = JSON.parse(fs.readFileSync(arg('--prompts', FILES[kind]), 'utf8'));
  let list = P.entries;
  if (!argv.includes('--all')) {
    const want = (arg('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!want.length) { console.log('usage: node tools/lyria_sfx.js [--kind sfx|amb] (--only a,b | --all) [--listen] [--dry-run] [--takes n] [--rounds n] [--reuse] [--reprocess] [--force] [--clean-raw]'); return 1; }
    const bad = want.filter((id) => !list.some((t) => t.id === id));
    if (bad.length) throw new Error(`unknown ${kind} id(s): ${bad.join(', ')}`);
    list = want.map((id) => list.find((t) => t.id === id));
  }
  const o = {
    model: E.LYRIA_MODEL || P.model || 'lyria-3.5',
    raw: path.resolve(arg('--raw', path.join(os.tmpdir(), 'lyria_sfx_raw'))),
    out: path.resolve(arg('--out', OUT[kind])),
    takes: Math.max(1, +arg('--takes', kind === 'amb' ? 2 : 1)), rounds: Math.max(1, +arg('--rounds', 3)), minFit: +arg('--min-fit', 7),
    listen: argv.includes('--listen'), reuse: argv.includes('--reuse'), reprocess: argv.includes('--reprocess'),
    xfade: +arg('--xfade', 4), max: +arg('--amb-max', 60), log: (s) => console.log(s),
  };
  if (argv.includes('--dry-run')) {
    for (const e of list) {
      console.log(`\n=== ${kind} ${e.id}${e.role ? '  (' + e.role + ')' : ''}`);
      console.log('prompt: ' + e.prompt + '\nalt:    ' + e.alt);
      console.log(`POST ${GA.API_BASE}/models/${o.model}:generateContent  {"x-goog-api-key":"<GOOGLE_API_KEY>"}`);
      console.log(JSON.stringify({ contents: [{ parts: [{ text: e.prompt }] }] }));
    }
    return 0;
  }
  if (argv.includes('--clean-raw')) {
    const dir = path.join(o.raw, kind);
    let n = 0;
    for (const e of list) {
      if (!fs.existsSync(path.join(o.out, e.id + '.json'))) continue;
      for (const r of rawFiles(dir, e.id)) { fs.rmSync(r.file, { force: true }); n++; }
    }
    console.log(`[lyria] removed ${n} raw take(s) of finished ids (meta .json and listen caches kept)`);
    return 0;
  }
  if (!GA.apiKey(E) && !o.reprocess) { console.log('[lyria] no GOOGLE_API_KEY — nothing generated (see tools/lyria_bgm.js for the setup).'); return 0; }
  if (!GA.ffmpegPath()) { console.log('[lyria] ffmpeg not found (PATH, $FFMPEG or `pip install imageio-ffmpeg`).'); return 1; }
  fs.mkdirSync(o.out, { recursive: true });
  fs.mkdirSync(path.join(o.raw, kind), { recursive: true });
  const done = [], failed = [], t0 = Date.now();
  let stopped = null;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (fs.existsSync(path.join(o.out, e.id + '.json')) && !argv.includes('--force') && !o.reprocess) { console.log(`[lyria] ${e.id}: exists — skipped (--force to redo)`); continue; }
    try { done.push(await (kind === 'amb' ? doAmb : doSfx)(e, o)); } catch (err) {
      if (err.daily) { stopped = list.slice(i).map((x) => x.id); console.log(`[lyria] daily quota reached: ${redact(err.message).slice(0, 160)}`); break; }
      failed.push(e.id); console.log(`[lyria] ${e.id}: FAILED: ${redact(err.message || err)}`);
    }
  }
  console.log(`\n[lyria] ${kind}: ${done.length} done, ${failed.length} failed${failed.length ? ' (' + failed.join(',') + ')' : ''}; ` +
    `API: lyria ${stats.lyria} call(s) ${Math.round(stats.lyriaSec)} s, listen ${stats.listen} call(s) ${Math.round(stats.listenSec)} s, blocked ${stats.blocked}, errors ${stats.failed}; ${Math.round((Date.now() - t0) / 1000)} s`);
  const weak = done.filter((d) => d.fit != null && d.fit < o.minFit);
  if (weak.length) console.log(`[lyria] below fit ${o.minFit}: ${weak.map((d) => `${d.id} ${d.fit}`).join(', ')}`);
  if (stopped) { console.log(`[lyria] remaining (quota): ${stopped.join(',')}`); return 2; }
  return failed.length ? 1 : 0;
}

module.exports = { writePreview, detectEvents, cutEvent, levelSfx, ambLoop, highpass, main };
if (require.main === module) main(process.argv.slice(2), process.env).then((c) => { process.exitCode = c; }, (e) => { console.error('[lyria] ' + redact(e.message || e)); process.exitCode = 1; });
