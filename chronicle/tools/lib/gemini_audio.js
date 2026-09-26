// Shared helpers for the recorded-media tools (tools/lyria_bgm.js, tools/voice_tts.js).
//
// 1) Gemini API over HTTPS (the ONLY network code of the media tools; nothing here runs in the game):
//      base   https://generativelanguage.googleapis.com/v1beta   (override: GEMINI_API_BASE)
//      auth   header `x-goog-api-key: <key>` — the key comes from GOOGLE_API_KEY (or GEMINI_API_KEY) and is
//             never put in a URL, a file or a log line (`redact()` scrubs error text anyway).
//      call   POST /models/<model>:generateContent  {contents, generationConfig}
//      → {candidates:[{content:{parts:[{text}|{inlineData:{mimeType, data:<base64>}}]}}]}
//      429 / 5xx are retried; a 429 body says "Please retry in 52.4s" (per-model quota, e.g. TTS 10 req/min).
// 2) ffmpeg (decode / encode / loudness). Looked up as $FFMPEG, then `ffmpeg` on PATH, then the binary of
//      the Python package imageio-ffmpeg (`pip install imageio-ffmpeg`), which bundles libvorbis.
// 3) small PCM helpers (Float32Array per channel).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function apiKey(E) { E = E || process.env; return E.GOOGLE_API_KEY || E.GEMINI_API_KEY || null; }
/** scrub anything that looks like a credential out of a message */
function redact(s) {
  let t = String(s).replace(/(key=)[^&\s"]+/g, '$1<GOOGLE_API_KEY>').replace(/(Bearer )[^\s"]+/g, '$1<ACCESS_TOKEN>').replace(/AIza[0-9A-Za-z_-]{20,}/g, '<GOOGLE_API_KEY>');
  const k = apiKey();
  if (k) t = t.split(k).join('<GOOGLE_API_KEY>');
  return t;
}

/** POST <API_BASE>/models/<model>:<method> with retries. → parsed JSON. Throws Error(redacted text). */
async function geminiPost(model, body, o) {
  o = o || {};
  const key = o.key || apiKey();
  if (!key) throw new Error('no GOOGLE_API_KEY');
  const url = `${API_BASE}/models/${model.replace(/^models\//, '')}:${o.method || 'generateContent'}`;
  const tries = o.tries || 8;
  let last;
  for (let t = 0; t < tries; t++) {
    let res, text;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), (o.timeoutSec || 600) * 1000);
      res = await fetch(url, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      text = await res.text();
      clearTimeout(timer);
    } catch (e) {
      last = new Error('network: ' + redact(e.message || e));
      await sleep(5000 * (t + 1));
      continue;
    }
    if (res.ok) return JSON.parse(text);
    last = new Error(`HTTP ${res.status}: ${redact(text).slice(0, 600)}`);
    last.status = res.status;
    // a per-day quota ("generate_requests_per_model_per_day", "retry in 11h57m…") will not clear by waiting
    if (res.status === 429 && (/per_day|PerDay/.test(text) || /retry in \d+h/i.test(text))) { last.daily = true; throw last; }
    if (res.status === 429 || res.status >= 500) {
      const m = /retry in ([0-9.]+)s/i.exec(text);
      const wait = m ? (+m[1] + 1.5) * 1000 : Math.min(120000, 15000 * (t + 1));
      if (o.log) o.log(`  (HTTP ${res.status}, waiting ${Math.round(wait / 1000)} s)`);
      await sleep(wait);
      continue;
    }
    throw last;
  }
  throw last;
}
/** GET <API_BASE>/<name> (e.g. batches/xyz) → JSON */
async function geminiGet(name, o) {
  o = o || {};
  const key = o.key || apiKey();
  for (let t = 0; ; t++) {
    try {
      const res = await fetch(`${API_BASE}/${name}`, { headers: { 'x-goog-api-key': key } });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      if (t >= 5 || (res.status < 500 && res.status !== 429)) throw new Error(`HTTP ${res.status}: ${redact(text).slice(0, 300)}`);
    } catch (e) { if (t >= 5) throw new Error(redact(e.message || e)); }
    await sleep(10000 * (t + 1));
  }
}
/** Batch API (separate quota from the per-day request limit of generateContent; typically done in 2–10 min):
 *  POST /models/<m>:batchGenerateContent {batch:{display_name, input_config:{requests:{requests:[{request, metadata:{key}}]}}}}
 *  → operation {name:'batches/…', metadata:{state}}; poll GET /v1beta/batches/… until BATCH_STATE_SUCCEEDED;
 *  results in response.inlinedResponses.inlinedResponses[] = {response | error, metadata:{key}}.
 *  reqs: [{key, request}] → Map key → {json} | {error} */
async function batchGenerate(model, reqs, o) {
  o = o || {};
  const log = o.log || (() => {});
  const op = await geminiPost(model, { batch: { display_name: o.name || 'lc-batch', input_config: { requests: { requests: reqs.map((r) => ({ request: r.request, metadata: { key: r.key } })) } } } }, { method: 'batchGenerateContent', tries: 4 });
  const name = op.name;
  log(`batch ${name}: ${reqs.length} request(s) queued`);
  const t0 = Date.now();
  let d = op;
  for (;;) {
    const st = d.metadata && d.metadata.state;
    if (d.done || /SUCCEEDED|FAILED|CANCELLED|EXPIRED/.test(st || '')) break;
    if (Date.now() - t0 > (o.maxWaitMin || 180) * 60000) throw new Error(`batch ${name} still ${st} after ${o.maxWaitMin || 180} min`);
    await sleep(o.pollMs || 20000);
    d = await geminiGet(name);
    const bs = (d.metadata && d.metadata.batchStats) || {};
    log(`batch ${name}: ${d.metadata && d.metadata.state} (${Math.round((Date.now() - t0) / 1000)} s; ok ${bs.successfulRequestCount || 0}, pending ${bs.pendingRequestCount || 0})`);
  }
  const outp = (d.response && d.response.inlinedResponses) || (d.metadata && d.metadata.output && d.metadata.output.inlinedResponses) || {};
  const list = outp.inlinedResponses || [];
  const res = new Map();
  for (const r of list) res.set(r.metadata && r.metadata.key, r.error ? { error: JSON.stringify(r.error) } : { json: r.response });
  if (!list.length) throw new Error(`batch ${name} ended ${d.metadata && d.metadata.state} without results: ${redact(JSON.stringify(d.error || '')).slice(0, 300)}`);
  return res;
}
/** the parts of the first candidate → {text, audio:[{mimeType, bytes}]} */
function partsOf(json) {
  const c = json && json.candidates && json.candidates[0];
  const parts = (c && c.content && c.content.parts) || [];
  const out = { text: '', audio: [], finishReason: c && c.finishReason };
  for (const p of parts) {
    if (p.text) out.text += p.text;
    if (p.audioTranscription && p.audioTranscription.text) out.text += p.audioTranscription.text;
    if (p.inlineData && p.inlineData.data) out.audio.push({ mimeType: p.inlineData.mimeType, bytes: Buffer.from(p.inlineData.data, 'base64') });
  }
  if (!parts.length && json && json.promptFeedback) out.blocked = JSON.stringify(json.promptFeedback);
  return out;
}

// ------------------------------------------------------------------ ffmpeg
let ffCache;
function ffmpegPath() {
  if (ffCache !== undefined) return ffCache;
  const cands = [process.env.FFMPEG, 'ffmpeg'];
  try {
    const p = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (p) cands.push(p);
  } catch (e) { /* no python package */ }
  for (const c of cands) {
    if (!c) continue;
    try { execFileSync(c, ['-hide_banner', '-version'], { stdio: 'ignore' }); ffCache = c; return c; } catch (e) { /* next */ }
  }
  ffCache = null;
  return null;
}
function ff(args, input) {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-nostdin', ...args], { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr).split('\n').slice(-4).join(' '));
  return r;
}
/** any audio file (or bytes) → {rate, channels:[Float32Array]} */
function decode(src, o) {
  o = o || {};
  let file = src, tmp = null;
  if (Buffer.isBuffer(src)) { tmp = path.join(os.tmpdir(), `lc_dec_${process.pid}_${Date.now()}.${o.ext || 'bin'}`); fs.writeFileSync(tmp, src); file = tmp; }
  try {
    const probe = spawnSync(ffmpegPath(), ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
    const m = /Audio: .*?, (\d+) Hz, (mono|stereo|(\d+) channels)/.exec(probe);
    const rate = o.rate || (m ? +m[1] : 44100);
    const ch = o.channels || (m ? (m[2] === 'mono' ? 1 : m[2] === 'stereo' ? 2 : +m[3]) : 2);
    const r = ff(['-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', String(ch), '-ar', String(rate), '-']);
    const buf = r.stdout, n = Math.floor(buf.length / 4 / ch);
    const all = new Float32Array(buf.buffer, buf.byteOffset, n * ch);
    const channels = Array.from({ length: ch }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) channels[c][i] = all[i * ch + c];
    return { rate, channels };
  } finally { if (tmp) fs.rmSync(tmp, { force: true }); }
}
function interleave(channels) {
  const ch = channels.length, n = channels[0].length, out = new Float32Array(n * ch);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[i * ch + c] = channels[c][i];
  return Buffer.from(out.buffer);
}
/** PCM → file. fmt 'ogg' (Vorbis, `kbps` or `q`) | 'wav' (16-bit) */
function encode(channels, rate, outFile, o) {
  o = o || {};
  const ch = String(channels.length);
  const codec = /\.wav$/.test(outFile) ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libvorbis', ...(o.kbps ? ['-b:a', o.kbps + 'k'] : ['-q:a', String(o.q != null ? o.q : 4)])];
  ff(['-y', '-f', 'f32le', '-ar', String(rate), '-ac', ch, '-i', '-', ...codec, '-map_metadata', '-1', outFile], interleave(channels));
  return outFile;
}
/** EBU R128 of PCM: {I (LUFS), LRA, TP (dBTP)} via ffmpeg's ebur128 filter */
function loudness(channels, rate) {
  const r = ff(['-f', 'f32le', '-ar', String(rate), '-ac', String(channels.length), '-i', '-', '-af', 'ebur128=peak=true', '-f', 'null', '-'], interleave(channels));
  const s = String(r.stderr);
  const tail = s.slice(s.lastIndexOf('Summary:'));
  const num = (re) => { const m = re.exec(tail); return m ? +m[1] : NaN; };
  return { I: num(/I:\s+(-?[0-9.]+|-inf) LUFS/), LRA: num(/LRA:\s+(-?[0-9.]+) LU/), TP: num(/Peak:\s+(-?[0-9.]+|-inf) dBFS/) };
}

// ------------------------------------------------------------------ PCM helpers
function peak(channels) { let p = 0; for (const a of channels) for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > p) p = v; } return p; }
function gain(channels, g) { return channels.map((a) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] * g; return o; }); }
function mono(channels) { if (channels.length === 1) return channels[0]; const n = channels[0].length, o = new Float32Array(n); for (const a of channels) for (let i = 0; i < n; i++) o[i] += a[i] / channels.length; return o; }
/** frame RMS in dBFS (frame `sec`) */
function rmsDb(x, rate, sec) {
  const fr = Math.max(1, Math.round(rate * (sec || 0.02))), out = [];
  for (let s = 0; s + fr <= x.length; s += fr) { let e = 0; for (let i = s; i < s + fr; i++) e += x[i] * x[i]; out.push(10 * Math.log10(e / fr + 1e-12)); }
  return out;
}
/** loudness-normalise: linear gain to `target` LUFS, but never above `ceil` dBFS sample peak */
function normalise(channels, rate, target, ceil) {
  const L = loudness(channels, rate);
  const p = peak(channels);
  let g = isFinite(L.I) ? Math.pow(10, (target - L.I) / 20) : 1;
  const maxG = Math.pow(10, (ceil != null ? ceil : -1) / 20) / Math.max(p, 1e-9);
  const limited = g > maxG;
  if (limited) g = maxG;
  return { channels: gain(channels, g), gainDb: 20 * Math.log10(g), before: L, limited };
}

/** gain towards `target` LUFS and a look-ahead limiter at `ceilDb` (ffmpeg alimiter) so peaky speech reaches it */
function limitTo(channels, rate, target, ceilDb) {
  const L = loudness(channels, rate);
  if (!isFinite(L.I)) return channels;
  const g = Math.pow(10, (target - L.I) / 20), ceil = Math.pow(10, (ceilDb != null ? ceilDb : -1.5) / 20);
  const x = gain(channels, g);
  if (peak(x) <= ceil) return x;
  const r = ff(['-f', 'f32le', '-ar', String(rate), '-ac', String(x.length), '-i', '-', '-af', `alimiter=limit=${ceil.toFixed(4)}:attack=2:release=40:level=disabled`, '-f', 'f32le', '-'], interleave(x));
  const buf = r.stdout, ch = x.length, n = Math.floor(buf.length / 4 / ch);
  const all = new Float32Array(buf.buffer, buf.byteOffset, n * ch);
  const out = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c][i] = all[i * ch + c];
  return out;
}

module.exports = { limitTo, geminiGet, batchGenerate, API_BASE, apiKey, redact, geminiPost, partsOf, ffmpegPath, decode, encode, loudness, peak, gain, mono, rmsDb, normalise, sleep };
