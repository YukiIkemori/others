#!/usr/bin/env node
// Generate recorded BGM with Google Lyria (BRIEF Part A10) → assets/bgm/<id>.ogg + <id>.json (loop points).
// The game plays such a file instead of the synthesised track (src/core/audio.js, tools/build.js).
//
//   node tools/lyria_bgm.js                      first batch (prompts.json `batch: 1`: title, overworld, battle,
//                                                boss + the two reference-vibe tracks cave, village)
//   node tools/lyria_bgm.js --only town,sea      these ids        --all   every id in design/bgm/prompts.json
//   node tools/lyria_bgm.js --dry-run            print the prompts and the HTTP requests, send nothing
//   node tools/lyria_bgm.js --reprocess --all    redo loop search / loudness / encoding from the cached raw
//                                                takes (no API call) — e.g. after changing --kbps or --lufs
//   options: --provider gemini|vertex|realtime (default: gemini when GOOGLE_API_KEY is set, else vertex)
//            --force (overwrite existing files)  --takes <n> (generate n takes, keep the best loop; default 1)
//            --kbps <n> (Ogg Vorbis bitrate, default 96)  --lufs <n> (loudness target, default -18)
//            --xfade <s> (loop crossfade, default 0.6)  --no-loop (keep the clip as generated, loop whole file)
//            --out <dir> (default assets/bgm)  --raw <dir> (raw take cache, default $TMPDIR/lyria_raw)
//            --listen (a Gemini model listens to the 3 best loop seams of every take and picks the smoothest)
//            --reuse (use cached raw takes that exist, generate only the missing ones)
//
// With no credentials it prints the setup steps below and exits 0 (nothing is written).
//
// ------------------------------------------------------------------ API (verified 2026-09-26)
// Gemini API, Lyria 3.x, plain REST (the default; tools/lib/gemini_audio.js holds the HTTP code):
//   POST https://generativelanguage.googleapis.com/v1beta/models/lyria-3.5:generateContent
//   header x-goog-api-key: $GOOGLE_API_KEY
//   body  {"contents":[{"parts":[{"text":"<English prompt>"}]}]}       (no generationConfig needed;
//          responseMimeType cannot be audio — the output is always MP3)
//   →     {"candidates":[{"content":{"parts":[{"text":"[[A0]]\n[[B1]]…"},                (section map)
//                                            {"inlineData":{"mimeType":"audio/mpeg","data":<base64>}}]}}]}
//   MP3 44.1 kHz stereo 192 kbps. The length follows the prompt ("Duration: 90 seconds." → ≈ 92 s); one call
//   takes ≈ 20–40 s. Models: lyria-3.5 (default, LYRIA_MODEL), lyria-3-pro-preview (also long pieces),
//   lyria-3-clip-preview (≈ 30 s clips only).
// Vertex AI `lyria-002` (REST predict, ≈ 30 s 48 kHz WAV): VERTEX_PROJECT, VERTEX_LOCATION, VERTEX_ACCESS_TOKEN.
// Gemini Lyria RealTime (`models/lyria-realtime-exp`, WebSocket BidiGenerateMusic, 48 kHz PCM): --provider realtime.
//
// ------------------------------------------------------------------ loop processing
// A generated piece has an intro and an ending; it does not loop by itself. The tool
//   1. decodes the MP3 (ffmpeg), trims leading silence;
//   2. finds the loop: spectral frames (40 log bands, 23 ms hop) are compared at every lag; the best
//      (loopStart s, loopEnd e) is where the ~5 s of music around e sounds most like the ~5 s around s
//      (same bar, same harmony), with e before the ending/fade and the loop at least half the piece;
//      e is then aligned to the sample by waveform cross-correlation;
//   3. bakes an equal-power crossfade into the seam: the last X seconds before e are faded into the X
//      seconds before s, so when the player jumps e → s the waveform continues seamlessly:
//        out[e−X+i] = a[e−X+i]·cos(πi/2X) + a[s−X+i]·sin(πi/2X);  the file ends at e;
//   4. normalises to --lufs (linear gain, sample peak ≤ −1 dBFS) and encodes Ogg Vorbis.
// <id>.json then says {loopStart: s, loopEnd: e} (seconds) plus the source/analysis. Edit it to taste.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const GA = require('./lib/gemini_audio');

const ROOT = path.resolve(__dirname, '..');
const PROMPTS = path.join(ROOT, 'design', 'bgm', 'prompts.json');
const FIRST_BATCH = ['title', 'overworld', 'battle', 'boss'];

// ------------------------------------------------------------------ prompts
function loadPrompts(file) { return JSON.parse(fs.readFileSync(file || PROMPTS, 'utf8')); }
/** the English text prompt of one track (entry.prompt, when set, replaces the generated text) */
function buildPrompt(t, P) {
  if (t.prompt) return t.prompt;
  return [
    P.style_prompt || `${P.style}.`,
    t.desc || `Mood: ${t.mood}.`, // English only (Lyria takes English prompts; `scene` is for people)
    `Tempo ${t.bpm || t.tempo} BPM, ${t.meter} time, key of ${t.key_text || t.key}.`,
    `Instrumentation: ${t.instrumentation}.`,
    t.form ? `Form: ${t.form}.` : `Structure: ${t.loop}.`,
    `Duration: ${t.length_sec} seconds.`,
    P.suffix || 'Instrumental only, no vocals; composed to loop seamlessly as video game background music.',
  ].join(' ');
}
function firstBatch(P) { const b = P.tracks.filter((t) => t.batch === 1).map((t) => t.id); return b.length ? b : FIRST_BATCH; }
function selectTracks(P, argv) {
  const all = P.tracks;
  const i = argv.indexOf('--only');
  if (argv.includes('--all')) return all;
  const want = i >= 0 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : firstBatch(P);
  const bad = want.filter((id) => !all.some((t) => t.id === id));
  if (bad.length) throw new Error('unknown BGM id(s): ' + bad.join(', ') + ' (see design/bgm/prompts.json)');
  return want.map((id) => all.find((t) => t.id === id));
}

// ------------------------------------------------------------------ providers (the whole HTTP / WS layer)
const SCALE = ['C_MAJOR_A_MINOR', 'D_FLAT_MAJOR_B_FLAT_MINOR', 'D_MAJOR_B_MINOR', 'E_FLAT_MAJOR_C_MINOR', 'E_MAJOR_D_FLAT_MINOR',
  'F_MAJOR_D_MINOR', 'G_FLAT_MAJOR_E_FLAT_MINOR', 'G_MAJOR_E_MINOR', 'A_FLAT_MAJOR_F_MINOR', 'A_MAJOR_G_FLAT_MINOR',
  'B_FLAT_MAJOR_G_MINOR', 'B_MAJOR_A_FLAT_MINOR'];
/** 'F#m' → the Lyria RealTime scale enum of its relative major */
function scaleOf(key) {
  const m = /^([A-G])([#b]?)(m?)$/.exec(key || '');
  if (!m) return undefined;
  let pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  if (m[3]) pc += 3;
  return SCALE[((pc % 12) + 12) % 12];
}
function gcloudToken() {
  try { return execFileSync('gcloud', ['auth', 'print-access-token'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null; } catch (e) { return null; }
}
const PROVIDERS = {
  gemini: {
    name: 'Gemini API Lyria 3',
    env: (E) => {
      const key = E.GOOGLE_API_KEY || E.GEMINI_API_KEY;
      return key ? { key, model: E.LYRIA_MODEL || 'lyria-3.5' } : null;
    },
    /** → {method, url, headers, body}; the key goes in a header, never in the URL */
    request(cfg, t, P) {
      return {
        method: 'POST', url: `${GA.API_BASE}/models/${cfg.model}:generateContent`,
        headers: { 'x-goog-api-key': cfg.key, 'Content-Type': 'application/json' },
        body: { contents: [{ parts: [{ text: buildPrompt(t, P) }] }] },
      };
    },
    /** response JSON → {bytes (MP3), mimeType, sections} */
    parse(json) {
      const p = GA.partsOf(json);
      if (!p.audio.length) throw new Error('no audio in the response: ' + (p.blocked || p.text || JSON.stringify(json).slice(0, 300)));
      return { bytes: p.audio[0].bytes, mimeType: p.audio[0].mimeType, sections: p.text };
    },
    async generate(cfg, t, P, o) {
      const rq = this.request(cfg, t, P);
      const json = await GA.geminiPost(cfg.model, rq.body, { key: cfg.key, timeoutSec: 900, log: o && o.log });
      return this.parse(json);
    },
  },
  vertex: {
    name: 'Vertex AI Lyria',
    env: (E) => {
      if (!E.VERTEX_PROJECT) return null;
      const token = E.VERTEX_ACCESS_TOKEN || E.GOOGLE_ACCESS_TOKEN || (E.LYRIA_NO_GCLOUD ? null : gcloudToken());
      return token ? { project: E.VERTEX_PROJECT, location: E.VERTEX_LOCATION || 'us-central1', token, model: E.LYRIA_VERTEX_MODEL || 'lyria-002', url: E.LYRIA_VERTEX_URL } : null;
    },
    /** → {method, url, headers, body} — POST …/publishers/google/models/lyria-002:predict */
    request(cfg, t, P, o) {
      const url = cfg.url || `https://${cfg.location}-aiplatform.googleapis.com/v1/projects/${cfg.project}/locations/${cfg.location}/publishers/google/models/${cfg.model}:predict`;
      const inst = { prompt: buildPrompt(t, P) };
      if (P.negative) inst.negative_prompt = P.negative;
      if (o && o.seed != null) inst.seed = o.seed; // seed and sample_count are mutually exclusive
      return {
        method: 'POST', url,
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: { instances: [inst], parameters: o && o.seed != null ? {} : { sample_count: 1 } },
      };
    },
    /** {predictions:[{audioContent:<base64 wav>, mimeType:'audio/wav'}]} → {bytes, mimeType} */
    parse(json) {
      const p = json && json.predictions && json.predictions[0];
      const b64 = p && (p.audioContent || p.bytesBase64Encoded || (p.audio && p.audio.content));
      if (!b64) throw new Error('no audio in the response: ' + JSON.stringify(json).slice(0, 300));
      return { bytes: Buffer.from(b64, 'base64'), mimeType: 'audio/wav' };
    },
    async generate(cfg, t, P, o) {
      const rq = this.request(cfg, t, P, o);
      const res = await fetch(rq.url, { method: rq.method, headers: rq.headers, body: JSON.stringify(rq.body) });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
      return this.parse(JSON.parse(text));
    },
  },
  realtime: {
    name: 'Gemini API Lyria RealTime',
    env: (E) => {
      const key = E.GOOGLE_API_KEY || E.GEMINI_API_KEY;
      return key ? { key, model: E.LYRIA_REALTIME_MODEL || 'models/lyria-realtime-exp', url: E.LYRIA_REALTIME_URL } : null;
    },
    /** → {url, messages[]}: the WebSocket session. The server streams
     *  {serverContent:{audioChunks:[{data:<base64 PCM16 LE, 48 kHz, stereo>}]}} after PLAY */
    request(cfg, t, P) {
      const url = (cfg.url || 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic') + '?key=' + cfg.key;
      const conf = { bpm: Math.max(60, Math.min(200, t.bpm || t.tempo)), temperature: 1.0, guidance: 4.0 };
      const sc = scaleOf(t.key);
      if (sc) conf.scale = sc;
      return {
        method: 'WEBSOCKET', url, seconds: Math.min(180, t.length_sec + 4),
        messages: [
          { setup: { model: cfg.model } },
          { clientContent: { weightedPrompts: [{ text: buildPrompt(t, P), weight: 1.0 }] } },
          { musicGenerationConfig: conf },
          { playbackControl: 'PLAY' },
        ],
      };
    },
    generate(cfg, t, P) {
      const rq = this.request(cfg, t, P);
      const rate = 48000, ch = 2, want = rate * ch * 2 * rq.seconds;
      return new Promise((resolve, reject) => {
        if (typeof WebSocket !== 'function') { reject(new Error('this Node has no WebSocket (use Node ≥ 22)')); return; }
        const ws = new WebSocket(rq.url);
        ws.binaryType = 'arraybuffer';
        const chunks = [];
        let got = 0, sent = 1, fin = false;
        const done = (err) => {
          if (fin) return; fin = true; clearTimeout(timer);
          try { ws.send(JSON.stringify({ playbackControl: 'STOP' })); ws.close(); } catch (e) { /* ignore */ }
          if (err && !got) reject(err); else resolve({ bytes: pcmToWav(Buffer.concat(chunks).subarray(0, want), rate, ch), mimeType: 'audio/wav' });
        };
        const timer = setTimeout(() => done(new Error('timeout')), (rq.seconds * 3 + 60) * 1000);
        ws.onopen = () => ws.send(JSON.stringify(rq.messages[0]));
        ws.onerror = (e) => done(new Error('WebSocket error ' + (e && e.message || '')));
        ws.onclose = (e) => done(new Error('closed ' + (e && e.code) + ' ' + (e && e.reason || '')));
        ws.onmessage = (ev) => {
          const raw = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
          let m; try { m = JSON.parse(raw); } catch (e) { return; }
          if (m.setupComplete && sent === 1) { for (; sent < rq.messages.length; sent++) ws.send(JSON.stringify(rq.messages[sent])); }
          if (m.filteredPrompt) done(new Error('prompt filtered: ' + JSON.stringify(m.filteredPrompt)));
          const ac = m.serverContent && m.serverContent.audioChunks;
          if (ac) for (const c of ac) { const b = Buffer.from(c.data, 'base64'); chunks.push(b); got += b.length; }
          if (got >= want) done();
        };
      });
    },
  },
};
function pickProvider(E, name) {
  const order = name ? [name] : ['gemini', 'vertex'];
  for (const n of order) {
    if (!PROVIDERS[n]) throw new Error('unknown provider ' + n);
    const cfg = PROVIDERS[n].env(E);
    if (cfg) return { name: n, P: PROVIDERS[n], cfg };
  }
  return null;
}

// ------------------------------------------------------------------ WAV (no dependencies)
function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let off = 12, fmt = null, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    if (off + 8 + size > buf.length) size = buf.length - off - 8; // streamed WAVs may carry a bogus size
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('WAV without fmt/data');
  if (fmt.format === 0xfffe) fmt.format = 1; // WAVE_FORMAT_EXTENSIBLE: integer PCM (float files use format 3)
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.channels));
  const chans = Array.from({ length: fmt.channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      const p = (i * fmt.channels + c) * bps;
      let v;
      if (fmt.format === 3) v = bps === 4 ? data.readFloatLE(p) : data.readDoubleLE(p);
      else if (bps === 2) v = data.readInt16LE(p) / 32768;
      else if (bps === 3) v = data.readIntLE(p, 3) / 8388608;
      else if (bps === 4) v = data.readInt32LE(p) / 2147483648;
      else v = (data[p] - 128) / 128;
      chans[c][i] = v;
    }
  }
  return { rate: fmt.rate, channels: chans };
}
function writeWav(chans, rate) {
  const n = chans[0].length, ch = chans.length, data = Buffer.alloc(n * ch * 2);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * 32767))), (i * ch + c) * 2);
  return Buffer.concat([wavHeader(data.length, rate, ch), data]);
}
function wavHeader(len, rate, ch) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + len, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * ch * 2, 28); h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(len, 40);
  return h;
}
function pcmToWav(pcm, rate, ch) { return Buffer.concat([wavHeader(pcm.length, rate, ch), pcm]); }

// ------------------------------------------------------------------ loop search
/** crossfade the last `sec` seconds into the first ones (equal power) and drop them → loops end → 0 */
function loopSmooth(chans, rate, sec) {
  const L = chans[0].length, X = Math.min(Math.floor(sec * rate), Math.floor(L / 3));
  if (X < 2) return chans;
  return chans.map((a) => {
    const out = new Float32Array(L - X);
    out.set(a.subarray(0, L - X));
    for (let i = 0; i < X; i++) {
      const t = (i / X) * Math.PI / 2;
      out[i] = a[i] * Math.sin(t) + a[L - X + i] * Math.cos(t);
    }
    return out;
  });
}
/** in-place radix-2 complex FFT */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** mono signal → {feat: Float32Array[frames][bands] (z-scored, unit length), hop (s), db[] (frame level)} */
function features(x, rate) {
  // decimate to ≈ 22 kHz (box filter), 2048-point frames, hop 512
  const dec = rate > 30000 ? 2 : 1, sr = rate / dec, n = Math.floor(x.length / dec), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < dec; k++) s += x[i * dec + k]; y[i] = s / dec; }
  const N = 2048, H = 512, B = 40, frames = Math.max(0, Math.floor((n - N) / H) + 1);
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const edges = []; for (let b = 0; b <= B; b++) edges.push(Math.round((50 * Math.pow(10000 / 50, b / B)) / sr * N));
  const F = [], db = [], flux = [];
  const re = new Float64Array(N), im = new Float64Array(N);
  let prevMag = null;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < N; i++) { const v = y[f * H + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    db.push(10 * Math.log10(e / N + 1e-12));
    fft(re, im);
    const mag = new Float32Array(N / 2);
    let fl = 0;
    for (let k = 0; k < N / 2; k++) { mag[k] = Math.log1p(Math.hypot(re[k], im[k]) * 10); if (prevMag) fl += Math.max(0, mag[k] - prevMag[k]); }
    flux.push(fl); prevMag = mag;
    const v = new Float32Array(B);
    for (let b = 0; b < B; b++) {
      let s = 0; const lo = edges[b], hi = Math.max(edges[b + 1], lo + 1);
      for (let k = lo; k < hi; k++) s += re[k] * re[k] + im[k] * im[k];
      v[b] = Math.log(s / (hi - lo) + 1e-9);
    }
    F.push(v);
  }
  // z-score each band over the piece, then unit length per frame (cosine = dot product)
  for (let b = 0; b < B; b++) {
    let m = 0; for (const v of F) m += v[b]; m /= F.length || 1;
    let s = 0; for (const v of F) s += (v[b] - m) ** 2; s = Math.sqrt(s / (F.length || 1)) || 1;
    for (const v of F) v[b] = (v[b] - m) / s;
  }
  for (const v of F) { let s = 0; for (let b = 0; b < B; b++) s += v[b] * v[b]; s = Math.sqrt(s) || 1; for (let b = 0; b < B; b++) v[b] /= s; }
  return { feat: F, hop: H / sr, db, flux };
}
/** best loop (seconds) of a piece: {loopStart, loopEnd, score, bodyEnd}. o: {minLoop, back, fwd} */
function findLoop(chans, rate, o) {
  o = o || {};
  const x = GA.mono(chans), dur = x.length / rate;
  const { feat, hop, db, flux } = features(x, rate);
  const nF = feat.length, back = Math.round((o.back || 2) / hop), fwd = Math.round((o.fwd || 3) / hop);
  // the "body": frames before the final fade / ending (3 s smoothed level ≥ median − 9 dB)
  const sm = Math.round(3 / hop), lvl = db.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - sm); k <= Math.min(nF - 1, i + sm); k++) { s += db[k]; c++; } return s / c; });
  const med = [...lvl].sort((a, b) => a - b)[Math.floor(nF / 2)];
  let bodyEnd = nF - 1; while (bodyEnd > nF / 2 && lvl[bodyEnd] < med - 9) bodyEnd--;
  let bodyStart = 0; while (bodyStart < nF / 4 && lvl[bodyStart] < med - 12) bodyStart++;
  const sMin = Math.max(back, bodyStart, Math.round(1.2 / hop)), sMax = Math.min(Math.round(Math.min(dur * 0.3, 30) / hop), nF - 1);
  const eMax = Math.min(bodyEnd, nF - 1 - fwd);
  const minLag = Math.round(Math.max(o.minLoop || 0, (eMax - sMin) * hop * 0.5, 12) / hop);
  let best = { score: -2 };
  const cands = { list: [], minScore: -2 };
  const W = back + fwd + 1;
  for (let L = minLag; L <= eMax - sMin; L++) {
    // sim[f] = cos(frame f, frame f+L), box-summed over [s-back, s+fwd]
    const lo = Math.max(0, sMin - back), hi = Math.min(sMax + fwd, eMax - L + fwd);
    if (hi <= lo) continue;
    const sim = new Float32Array(hi - lo + 1);
    for (let f = lo; f <= hi; f++) { const a = feat[f], b = feat[f + L]; let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; sim[f - lo] = s; }
    const pre = new Float64Array(sim.length + 1);
    for (let i = 0; i < sim.length; i++) pre[i + 1] = pre[i] + sim[i];
    for (let s = sMin; s <= sMax && s + L <= eMax; s++) {
      const a = s - back, b = s + fwd;
      if (a < lo || b > hi) continue;
      const sum = pre[b - lo + 1] - pre[a - lo];
      const score = sum / W + 0.03 * (L / (eMax - sMin)); // a small bonus for longer loops
      if (score > best.score) best = { score, s, e: s + L, raw: sum / W };
      if (score > cands.minScore || cands.list.length < 40) pushCand(cands, { score, s, e: s + L, raw: sum / W });
    }
  }
  if (!(best.score > -2)) return null;
  if (o.all) {
    // distinct candidates (loop ends ≥ 1.5 s apart or starts ≥ 1.5 s apart), best first
    const out = [], gap = 1.5 / hop;
    for (const c of cands.list.sort((a, b) => b.score - a.score)) {
      if (out.some((d) => Math.abs(d.e - c.e) < gap && Math.abs(d.s - c.s) < gap)) continue;
      out.push(Object.assign(refine(c), { s: c.s, e: c.e }));
      if (out.length >= (o.all || 3)) break;
    }
    return out;
  }
  return refine(best);
  function refine(best) {
  // beat phase: shift e by up to ±8 frames (±190 ms) so the onsets of the 6 s before e line up with
  // the 6 s before s (the crossfade blends exactly these), then align the waveform to the sample
  const Wb = Math.min(Math.round(6 / hop), best.s);
  // (flux with its local mean removed; only moved when clearly better than no shift)
  const on = flux.map((v, i) => { let m = 0, c = 0; for (let k = Math.max(0, i - 8); k <= Math.min(flux.length - 1, i + 8); k++) { m += flux[k]; c++; } return Math.max(0, v - m / c); });
  const corrAt = (k) => {
    const e = best.e + k;
    if (e - Wb < 0 || e >= on.length) return -Infinity;
    let v = 0, a = 0, b = 0; for (let i = 1; i <= Wb; i++) { const p = on[best.s - i], q = on[e - i]; v += p * q; a += p * p; b += q * q; }
    return v / (Math.sqrt(a * b) || 1);
  };
  let bestK = 0, bestV = corrAt(0);
  const c0 = bestV;
  for (let k = -8; k <= 8; k++) { const v = corrAt(k); if (v > bestV) { bestV = v; bestK = k; } }
  if (!(bestV > c0 + 0.1 && bestV > 0.3)) bestK = 0;
  best = Object.assign({}, best, { e: best.e + bestK, onsetCorr: Math.max(bestV, c0) });
  const S = Math.round(best.s * hop * rate), E0 = Math.round(best.e * hop * rate);
  const N = Math.round(0.03 * rate), R = Math.round(0.012 * rate);
  let bestD = 0, bestC = -Infinity;
  for (let d = -R; d <= R; d++) {
    let c = 0, ea = 0, eb = 0;
    for (let i = -N; i < N; i++) { const a = x[S + i] || 0, b = x[E0 + d + i] || 0; c += a * b; ea += a * a; eb += b * b; }
    c /= Math.sqrt(ea * eb) || 1;
    if (c > bestC) { bestC = c; bestD = d; }
  }
  return { start: S, end: E0 + bestD, loopStart: S / rate, loopEnd: (E0 + bestD) / rate, score: best.raw, corr: bestC, bodyEnd: bodyEnd * hop, dur };
  }
}
function pushCand(c, x) {
  c.list.push(x);
  if (c.list.length > 400) { c.list.sort((a, b) => b.score - a.score); c.list.length = 200; c.minScore = c.list[199].score; }
}
/** bake the seam: the X s before `end` fade into the X s before `start`; the result ends at `end` */
function bakeLoop(chans, rate, start, end, xfadeSec) {
  const X = Math.max(2, Math.min(Math.round(xfadeSec * rate), start, Math.floor((end - start) / 4)));
  return {
    xfade: X / rate,
    channels: chans.map((a) => {
      const out = new Float32Array(end);
      out.set(a.subarray(0, end));
      for (let i = 0; i < X; i++) {
        const t = (i / X) * Math.PI / 2;
        out[end - X + i] = a[end - X + i] * Math.cos(t) + a[start - X + i] * Math.sin(t);
      }
      return out;
    }),
  };
}
/** trim leading silence below `db` dBFS (keeps 20 ms) → samples cut */
function leadTrim(chans, rate, db) {
  const th = Math.pow(10, (db != null ? db : -55) / 20);
  const n = chans[0].length;
  let i = 0; outer: for (; i < n; i++) for (const a of chans) if (Math.abs(a[i]) > th) break outer;
  const cut = Math.max(0, i - Math.round(0.02 * rate));
  return { cut, channels: cut ? chans.map((a) => a.slice(cut)) : chans };
}
/** checks of a finished loop: level, silences, seam (spectral distance at the seam vs inside the piece) */
function analyse(chans, rate, loopStart, loopEnd) {
  const x = GA.mono(chans);
  const db = GA.rmsDb(x, rate, 0.05);
  const med = [...db].sort((a, b) => a - b)[Math.floor(db.length / 2)];
  let run = 0, longest = 0;
  for (const d of db) { run = d < -50 ? run + 1 : 0; longest = Math.max(longest, run); }
  // seam: level of the 0.25 s before loopEnd vs the 0.25 s after loopStart
  const lv = (a, b) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return 10 * Math.log10(e / Math.max(1, b - a) + 1e-12); };
  const s = Math.round(loopStart * rate), e = Math.round(loopEnd * rate), q = Math.round(0.25 * rate);
  const seamDb = Math.abs(lv(e - q, e) - lv(s, s + q));
  const jump = Math.abs(x[e - 1] - x[s]);
  let step = 0; for (let i = s; i < s + 2000; i++) step = Math.max(step, Math.abs(x[i + 1] - x[i]));
  return { medianDb: Math.round(med * 10) / 10, longestSilence: Math.round(longest * 0.05 * 10) / 10, seamLevelDiffDb: Math.round(seamDb * 10) / 10, seamJump: Math.round(jump * 1e4) / 1e4, maxStep: Math.round(step * 1e4) / 1e4 };
}

/** --listen: a Gemini model hears 8 s before the loop end + 8 s after the loop start (the jump at 8.0 s)
 *  → {seam_smooth 1–10, problem}. POST …/models/gemini-3.8-flash:generateContent with the MP3 inline. */
async function listenSeam(chans, rate, ls, le) {
  const a = Math.round((le - 8) * rate), b = Math.round(le * rate), c = Math.round(ls * rate), d = Math.round((ls + 8) * rate);
  const clip = chans.map((x) => { const o = new Float32Array((b - a) + (d - c)); o.set(x.subarray(Math.max(0, a), b), Math.max(0, -a)); o.set(x.subarray(c, d), b - a); return o; });
  const tmp = path.join(os.tmpdir(), `lc_seam_${process.pid}_${Date.now()}.mp3`);
  const { spawnSync } = require('child_process');
  const inter = Buffer.from(Float32Array.from({ length: clip[0].length * clip.length }, (_, i) => clip[i % clip.length][Math.floor(i / clip.length)]).buffer);
  spawnSync(GA.ffmpegPath(), ['-hide_banner', '-y', '-f', 'f32le', '-ar', String(rate), '-ac', String(clip.length), '-i', '-', '-b:a', '160k', tmp], { input: inter });
  const bytes = fs.readFileSync(tmp); fs.rmSync(tmp, { force: true });
  const q = 'This 16-second excerpt is a looping video-game track: at exactly 8.0 s the playback jumps from the loop end back to the loop start. Listen carefully around 8.0 s. Reply JSON {"seam_smooth":<1-10, 10 = impossible to notice>,"problem":"<what is audible at 8 s: beat skip, tempo jump, chord clash, sudden instrument change, click, or none>"}';
  try {
    const json = await GA.geminiPost(process.env.LISTEN_MODEL || 'gemini-3.8-flash', { contents: [{ parts: [{ inlineData: { mimeType: 'audio/mpeg', data: bytes.toString('base64') } }, { text: q }] }], generationConfig: { responseMimeType: 'application/json' } }, { timeoutSec: 180 });
    const t = GA.partsOf(json).text;
    const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    return { seam_smooth: +j.seam_smooth || 0, problem: String(j.problem || '') };
  } catch (e) { return { seam_smooth: 0, problem: 'listen failed: ' + GA.redact(e.message || e).slice(0, 80) }; }
}

// ------------------------------------------------------------------ main
const SETUP = `
Lyria BGM: no credentials found — nothing was generated (the game keeps its synthesised BGM).

Set ONE of these and run again (first batch = the prompts.json entries with "batch": 1):

  A) Gemini API (Lyria 3.5, recommended):
       export GOOGLE_API_KEY=<key from https://aistudio.google.com/apikey>
  B) Vertex AI (lyria-002, ≈30 s clips):
       gcloud auth login && gcloud services enable aiplatform.googleapis.com --project <PROJECT>
       export VERTEX_PROJECT=<PROJECT>  VERTEX_LOCATION=us-central1
       export VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token)   # expires after ~1 h

  ffmpeg is needed to decode/encode (PATH, $FFMPEG, or: pip install imageio-ffmpeg).
  node tools/lyria_bgm.js --dry-run         # check the prompts / requests first (sends nothing)
  node tools/lyria_bgm.js                   # first batch → assets/bgm/
  node tools/lyria_bgm.js --only town,sea   # more later (--all: all 32 ids of design/bgm/prompts.json)
  node tools/build.js                       # embed them in dist/index.html (--bgm external: dist/bgm/)
`;
const redact = GA.redact;

/** raw take → finished file + json. → summary */
async function processTake(t, take, o) {
  let { rate, channels } = GA.decode(take.file);
  const lt = leadTrim(channels, rate, -55);
  channels = lt.channels;
  const raw = channels[0].length / rate;
  let loop = null, baked = channels, xf = 0;
  if (!o.noLoop) {
    // candidates best-first by the signal score; with --listen each is heard twice (the model is noisy)
    // and the first with an average seam rating ≥ 6/10 wins, else the best-rated one
    const cands = findLoop(channels, rate, { all: o.listen ? 3 : 1 }) || [];
    loop = null;
    for (const c of cands) {
      const b = bakeLoop(channels, rate, c.start, c.end, o.xfade);
      c.baked = b.channels; c.xf = b.xfade;
      if (!o.listen) { loop = c; break; }
      const h1 = await listenSeam(b.channels, rate, c.loopStart, c.loopEnd), h2 = await listenSeam(b.channels, rate, c.loopStart, c.loopEnd);
      c.heard = { seam_smooth: (h1.seam_smooth + h2.seam_smooth) / 2, problem: [h1.problem, h2.problem].filter((x) => x && x !== 'none').join(' / ') || 'none' };
      o.log(`    loop ${c.loopStart.toFixed(2)}–${c.loopEnd.toFixed(2)} score ${c.score.toFixed(3)} → heard ${h1.seam_smooth}+${h2.seam_smooth} ${c.heard.problem}`);
      if (c.heard.seam_smooth >= 6) { loop = c; break; }
    }
    if (!loop && cands.length) loop = cands.slice().sort((a, b) => (b.heard ? b.heard.seam_smooth : 0) - (a.heard ? a.heard.seam_smooth : 0))[0];
    if (loop) { baked = loop.baked; xf = loop.xf; }
  }
  const nm = GA.normalise(baked, rate, o.lufs, -1);
  const dur = nm.channels[0].length / rate;
  const ls = loop ? loop.loopStart : 0, le = loop ? loop.loopEnd : dur;
  const an = analyse(nm.channels, rate, ls, le);
  const L = GA.loudness(nm.channels, rate);
  return { rate, channels: nm.channels, raw, dur, loop, xf, gainDb: nm.gainDb, limited: nm.limited, L, an, loopStart: ls, loopEnd: le, cut: lt.cut / rate };
}

async function main(argv, E) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const P = loadPrompts(arg('--prompts'));
  const tracks = selectTracks(P, argv);
  const dry = argv.includes('--dry-run');
  const reproc = argv.includes('--reprocess');
  const outDir = path.resolve(arg('--out', path.join(ROOT, 'assets', 'bgm')));
  const rawDir = path.resolve(arg('--raw', path.join(os.tmpdir(), 'lyria_raw')));
  const pv = pickProvider(E, arg('--provider'));
  if (dry) {
    const shown = pv || { name: 'gemini', P: PROVIDERS.gemini, cfg: { key: '<GOOGLE_API_KEY>', model: E.LYRIA_MODEL || 'lyria-3.5' } };
    console.log(`[lyria] dry run — provider ${shown.P.name}${pv ? '' : ' (no credentials: placeholders)'}; ${tracks.length} track(s) → ${path.relative(ROOT, outDir)}/`);
    for (const t of tracks) {
      const rq = shown.P.request(shown.cfg, t, P, {});
      console.log(`\n=== ${t.id}  (${t.scene}; ${t.bpm || t.tempo} BPM ${t.meter} ${t.key}, ~${t.length_sec} s)`);
      console.log('prompt: ' + buildPrompt(t, P));
      console.log(redact(`${rq.method} ${rq.url}`));
      if (rq.headers) console.log(redact(JSON.stringify(rq.headers)));
      console.log(redact(JSON.stringify(rq.body || rq.messages, null, 2)));
    }
    return 0;
  }
  if (!pv && !reproc) { console.log(SETUP); return 0; }
  if (!GA.ffmpegPath()) { console.log('[lyria] ffmpeg not found (PATH, $FFMPEG or `pip install imageio-ffmpeg`) — it is needed to decode the MP3 and encode Ogg.'); return 1; }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  const takes = Math.max(1, +arg('--takes', 1));
  const log = (s) => console.log(s);
  const o = { xfade: +arg('--xfade', 0.6), lufs: +arg('--lufs', -18), kbps: +arg('--kbps', 96), noLoop: argv.includes('--no-loop'), listen: argv.includes('--listen'), log };
  let fails = 0;
  for (const t of tracks) {
    const exists = ['ogg', 'm4a', 'mp3', 'wav'].find((e) => fs.existsSync(path.join(outDir, t.id + '.' + e)));
    if (exists && !argv.includes('--force') && !reproc) { console.log(`[lyria] ${t.id}: ${t.id}.${exists} exists — skipped (--force to replace)`); continue; }
    try {
      // raw takes: cached in rawDir as <id>.<n>.mp3 (+ .json with the prompt)
      const cands = [];
      for (let k = 0; k < takes; k++) {
        const f = path.join(rawDir, `${t.id}.${k}.mp3`);
        if (reproc || (fs.existsSync(f) && argv.includes('--reuse'))) {
          if (fs.existsSync(f)) cands.push({ file: f, meta: fs.existsSync(f + '.json') ? JSON.parse(fs.readFileSync(f + '.json', 'utf8')) : {} });
          continue;
        }
        if (!pv) continue;
        process.stdout.write(`[lyria] ${t.id}: take ${k + 1}/${takes} with ${pv.P.name}… `);
        const t0 = Date.now();
        let g = null;
        for (let r = 0; r < 3 && !g; r++) {
          // a take is sometimes refused at random ({"blockReason":"PROHIBITED_CONTENT"}) — ask again
          try { g = await pv.P.generate(pv.cfg, t, P, { log }); } catch (e) { process.stdout.write(`(${redact(e.message || e).slice(0, 90)}) `); if (r === 2) console.log('gave up on this take'); }
        }
        if (!g) continue;
        const ext = /mpeg|mp3/.test(g.mimeType) ? 'mp3' : 'wav';
        const ff = ext === 'mp3' ? f : f.replace(/\.mp3$/, '.wav');
        fs.writeFileSync(ff, g.bytes);
        const meta = { provider: pv.name, model: pv.cfg.model, prompt: buildPrompt(t, P), sections: g.sections || '', generated: new Date().toISOString() };
        fs.writeFileSync(ff + '.json', JSON.stringify(meta, null, 1));
        console.log(`${(g.bytes.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        cands.push({ file: ff, meta });
      }
      if (!cands.length) throw new Error('no raw take (generate first, or check --raw)');
      let best = null;
      for (const c of cands) {
        const r = await processTake(t, c, o);
        r.take = c;
        const q = r.loop ? (r.loop.heard ? r.loop.heard.seam_smooth * 10 : 0) + r.loop.score : 0;
        r.q = q;
        if (!best || q > best.q) best = r;
      }
      for (const e of ['ogg', 'm4a', 'mp3', 'wav']) { const p = path.join(outDir, t.id + '.' + e); if (fs.existsSync(p)) fs.unlinkSync(p); }
      const file = path.join(outDir, t.id + '.ogg');
      GA.encode(best.channels, best.rate, file, { kbps: o.kbps });
      const r3 = (v) => Math.round(v * 1000) / 1000;
      fs.writeFileSync(path.join(outDir, t.id + '.json'), JSON.stringify({
        loopStart: r3(best.loopStart), loopEnd: r3(best.loopEnd),
        source: Object.assign({}, best.take.meta, { rawSeconds: Math.round(best.raw * 10) / 10, takes: cands.length }),
        analysis: {
          loudnessLUFS: Math.round(best.L.I * 10) / 10, truePeakDb: best.L.TP, gainDb: Math.round(best.gainDb * 10) / 10, peakLimited: best.limited,
          loopScore: best.loop ? Math.round(best.loop.score * 1000) / 1000 : null, seamListen: best.loop && best.loop.heard ? best.loop.heard : undefined, seamCorr: best.loop ? Math.round(best.loop.corr * 1000) / 1000 : null,
          xfade: Math.round(best.xf * 1000) / 1000, ...best.an,
        },
      }, null, 2) + '\n');
      const kb = fs.statSync(file).size / 1024;
      console.log(`[lyria] ${t.id}: ${path.relative(ROOT, file)} ${best.dur.toFixed(1)} s (raw ${best.raw.toFixed(1)}), loop ${best.loopStart.toFixed(2)}–${best.loopEnd.toFixed(2)} s score ${best.loop ? best.loop.score.toFixed(3) : '-'}, ${best.L.I.toFixed(1)} LUFS, ${kb.toFixed(0)} KB`);
    } catch (e) {
      fails++;
      console.log(`[lyria] ${t.id}: FAILED: ` + redact(e.message || e));
    }
  }
  return fails ? 1 : 0;
}

module.exports = { buildPrompt, selectTracks, loadPrompts, PROVIDERS, pickProvider, parseWav, writeWav, loopSmooth, findLoop, bakeLoop, analyse, scaleOf, main, FIRST_BATCH, firstBatch };
if (require.main === module) main(process.argv.slice(2), process.env).then((c) => { process.exitCode = c; }, (e) => { console.error('[lyria] ' + redact(e.message || e)); process.exitCode = 1; });
