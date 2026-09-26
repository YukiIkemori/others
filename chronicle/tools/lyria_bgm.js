#!/usr/bin/env node
// Generate recorded BGM with Google Lyria (BRIEF Part A10) → assets/bgm/<id>.(ogg|wav) + <id>.json.
// The game plays such a file instead of the synthesised track (src/core/audio.js, tools/build.js).
//
//   node tools/lyria_bgm.js                      first batch: title, overworld, battle, boss
//   node tools/lyria_bgm.js --only town,sea      these ids        --all   every id in design/bgm/prompts.json
//   node tools/lyria_bgm.js --dry-run            print the prompts and the HTTP requests, send nothing
//   options: --provider vertex|gemini (default: whichever has credentials, Vertex first)
//            --force (overwrite existing files)  --seed <n>  --xfade <s> (loop crossfade, default 2)
//            --no-loop (keep the clip as generated)  --out <dir> (default assets/bgm)
//
// With no credentials it prints the setup steps below and exits 0 (nothing is written).
//
// ------------------------------------------------------------------ credentials (environment)
// Vertex AI (model `lyria-002`, REST predict; one request = one ≈30 s 48 kHz WAV clip):
//   VERTEX_PROJECT=<gcp project id>   VERTEX_LOCATION=us-central1 (default)
//   VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token)   (or GOOGLE_ACCESS_TOKEN; if neither is set and
//   `gcloud` is on PATH the tool asks gcloud itself). The project needs the Vertex AI API enabled.
// Gemini API (model `models/lyria-realtime-exp`, Lyria RealTime over a WebSocket; streams as long as we
//   listen, so the clip gets the track's target length):  GOOGLE_API_KEY=<key> (or GEMINI_API_KEY)
// Overrides: LYRIA_MODEL (Vertex model id), LYRIA_GEMINI_MODEL, LYRIA_VERTEX_URL / LYRIA_GEMINI_URL (full
// endpoint URLs, in case Google moves them). The API shapes below were written from documentation known
// in 2025–26 and are isolated in PROVIDERS (request building + response parsing) — adjust there only.
//
// ------------------------------------------------------------------ loop smoothing (--xfade, default 2 s)
// A generated clip does not loop by itself. The tool crossfades the clip's last X seconds into its first
// X seconds (equal-power) and drops the tail, so the file loops end → start without a click or a jump:
//   out[i] = clip[i]·sin(πi/2X) + clip[L−X+i]·cos(πi/2X)  for i < X;  out[i] = clip[i] for X ≤ i < L−X.
// <id>.json then says {loopStart: 0, loopEnd: <length>}; edit it to loop only a later part (keep an intro).
// If `ffmpeg` is on PATH the WAV is encoded to Ogg Vorbis (q5, ~10× smaller: matters because the build
// embeds the files in dist/index.html); otherwise the WAV is kept. No other tool is needed.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROMPTS = path.join(ROOT, 'design', 'bgm', 'prompts.json');
const FIRST_BATCH = ['title', 'overworld', 'battle', 'boss'];

// ------------------------------------------------------------------ prompts
function loadPrompts(file) { return JSON.parse(fs.readFileSync(file || PROMPTS, 'utf8')); }
/** the English text prompt of one track (entry.prompt, when set, replaces the generated text) */
function buildPrompt(t, P) {
  if (t.prompt) return t.prompt;
  return [
    `${P.style}.`,
    `Mood: ${t.mood}.`, // English only (Lyria takes US-English prompts; `scene` is for people)
    `Tempo ${t.tempo} BPM, ${t.meter} time, key of ${t.key_text || t.key}.`,
    `Instrumentation: ${t.instrumentation}.`,
    `Structure: about ${t.length_sec} seconds, ${t.loop}; composed to loop seamlessly as video game background music.`,
  ].join(' ');
}
function selectTracks(P, argv) {
  const all = P.tracks;
  const i = argv.indexOf('--only');
  if (argv.includes('--all')) return all;
  const want = i >= 0 && argv[i + 1] ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : FIRST_BATCH;
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
  vertex: {
    name: 'Vertex AI Lyria',
    env: (E) => {
      if (!E.VERTEX_PROJECT) return null;
      const token = E.VERTEX_ACCESS_TOKEN || E.GOOGLE_ACCESS_TOKEN || (E.LYRIA_NO_GCLOUD ? null : gcloudToken());
      return token ? { project: E.VERTEX_PROJECT, location: E.VERTEX_LOCATION || 'us-central1', token, model: E.LYRIA_MODEL || 'lyria-002', url: E.LYRIA_VERTEX_URL } : null;
    },
    /** → {method, url, headers, body} — POST …/publishers/google/models/lyria-002:predict */
    request(cfg, t, P, o) {
      const url = cfg.url || `https://${cfg.location}-aiplatform.googleapis.com/v1/projects/${cfg.project}/locations/${cfg.location}/publishers/google/models/${cfg.model}:predict`;
      const inst = { prompt: buildPrompt(t, P) };
      if (P.negative) inst.negative_prompt = P.negative;
      if (o.seed != null) inst.seed = o.seed; // seed and sample_count are mutually exclusive
      return {
        method: 'POST', url,
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: { instances: [inst], parameters: o.seed != null ? {} : { sample_count: 1 } },
      };
    },
    /** response JSON → WAV bytes: {predictions:[{audioContent:<base64 wav>, mimeType:'audio/wav'}]} */
    parse(json) {
      const p = json && json.predictions && json.predictions[0];
      const b64 = p && (p.audioContent || p.bytesBase64Encoded || (p.audio && p.audio.content));
      if (!b64) throw new Error('no audio in the response: ' + JSON.stringify(json).slice(0, 300));
      return Buffer.from(b64, 'base64');
    },
    async generate(cfg, t, P, o) {
      const rq = this.request(cfg, t, P, o);
      const res = await fetch(rq.url, { method: rq.method, headers: rq.headers, body: JSON.stringify(rq.body) });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
      return this.parse(JSON.parse(text));
    },
  },
  gemini: {
    name: 'Gemini API Lyria RealTime',
    env: (E) => {
      const key = E.GOOGLE_API_KEY || E.GEMINI_API_KEY;
      return key ? { key, model: E.LYRIA_GEMINI_MODEL || 'models/lyria-realtime-exp', url: E.LYRIA_GEMINI_URL } : null;
    },
    /** → {url, messages[]}: the WebSocket session. The server streams
     *  {serverContent:{audioChunks:[{data:<base64 PCM16 LE, 48 kHz, stereo>}]}} after PLAY */
    request(cfg, t, P) {
      const url = (cfg.url || 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic') + '?key=' + cfg.key;
      const conf = { bpm: Math.max(60, Math.min(200, t.tempo)), temperature: 1.0, guidance: 4.0 };
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
          if (err && !got) reject(err); else resolve(pcmToWav(Buffer.concat(chunks).subarray(0, want), rate, ch));
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
  const order = name ? [name] : ['vertex', 'gemini'];
  for (const n of order) {
    if (!PROVIDERS[n]) throw new Error('unknown provider ' + n);
    const cfg = PROVIDERS[n].env(E);
    if (cfg) return { name: n, P: PROVIDERS[n], cfg };
  }
  return null;
}

// ------------------------------------------------------------------ WAV + loop smoothing (no dependencies)
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
/** crossfade the last `sec` seconds into the first ones (equal power) and drop them → a seamless loop */
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
function hasFfmpeg() { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } }

// ------------------------------------------------------------------ main
const SETUP = `
Lyria BGM: no credentials found — nothing was generated (the game keeps its synthesised BGM).

Set ONE of these and run again (first batch = ${FIRST_BATCH.join(', ')}):

  A) Vertex AI (lyria-002):
       gcloud auth login && gcloud services enable aiplatform.googleapis.com --project <PROJECT>
       export VERTEX_PROJECT=<PROJECT>  VERTEX_LOCATION=us-central1
       export VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token)   # expires after ~1 h
  B) Gemini API (Lyria RealTime):
       export GOOGLE_API_KEY=<key from https://aistudio.google.com/apikey>

  node tools/lyria_bgm.js --dry-run         # check the prompts / requests first (sends nothing)
  node tools/lyria_bgm.js                   # title, overworld, battle, boss → assets/bgm/
  node tools/lyria_bgm.js --only town,sea   # more later (--all: all 32 ids of design/bgm/prompts.json)
  node tools/build.js                       # embed them in dist/index.html (--bgm external: dist/bgm/)
`;
const redact = (s) => String(s).replace(/(key=)[^&\s"]+/g, '$1<GOOGLE_API_KEY>').replace(/(Bearer )[^\s"]+/g, '$1<ACCESS_TOKEN>');

async function main(argv, E) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const P = loadPrompts(arg('--prompts'));
  const tracks = selectTracks(P, argv);
  const dry = argv.includes('--dry-run');
  const seed = argv.includes('--seed') ? +arg('--seed') : null;
  const outDir = path.resolve(arg('--out', path.join(ROOT, 'assets', 'bgm')));
  const pv = pickProvider(E, arg('--provider'));
  if (dry) {
    // without credentials show the Vertex request with placeholders
    const shown = pv || { name: 'vertex', P: PROVIDERS.vertex, cfg: { project: '<VERTEX_PROJECT>', location: E.VERTEX_LOCATION || 'us-central1', token: '<ACCESS_TOKEN>', model: E.LYRIA_MODEL || 'lyria-002' } };
    console.log(`[lyria] dry run — provider ${shown.P.name}${pv ? '' : ' (no credentials: placeholders)'}; ${tracks.length} track(s) → ${path.relative(ROOT, outDir)}/`);
    for (const t of tracks) {
      const rq = shown.P.request(shown.cfg, t, P, { seed });
      console.log(`\n=== ${t.id}  (${t.scene}; ${t.tempo} BPM ${t.meter} ${t.key}, ~${t.length_sec} s)`);
      console.log('prompt: ' + buildPrompt(t, P));
      console.log(redact(`${rq.method} ${rq.url}`));
      if (rq.headers) console.log(redact(JSON.stringify(rq.headers)));
      console.log(JSON.stringify(rq.body || rq.messages, null, 2));
    }
    return 0;
  }
  if (!pv) { console.log(SETUP); return 0; }
  fs.mkdirSync(outDir, { recursive: true });
  const ff = hasFfmpeg();
  const xfade = argv.includes('--no-loop') ? 0 : +arg('--xfade', 2);
  let fails = 0;
  for (const t of tracks) {
    const exists = ['ogg', 'm4a', 'mp3', 'wav'].find((e) => fs.existsSync(path.join(outDir, t.id + '.' + e)));
    if (exists && !argv.includes('--force')) { console.log(`[lyria] ${t.id}: ${t.id}.${exists} exists — skipped (--force to replace)`); continue; }
    process.stdout.write(`[lyria] ${t.id}: generating with ${pv.P.name}… `);
    try {
      const wav = await pv.P.generate(pv.cfg, t, P, { seed });
      let { rate, channels } = parseWav(wav);
      const raw = channels[0].length / rate;
      if (xfade > 0) channels = loopSmooth(channels, rate, xfade);
      const dur = channels[0].length / rate;
      const wavPath = path.join(outDir, t.id + '.wav');
      for (const e of ['ogg', 'm4a', 'mp3', 'wav']) { const p = path.join(outDir, t.id + '.' + e); if (fs.existsSync(p)) fs.unlinkSync(p); }
      fs.writeFileSync(wavPath, writeWav(channels, rate));
      let file = wavPath;
      if (ff) {
        const ogg = path.join(outDir, t.id + '.ogg');
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-c:a', 'libvorbis', '-q:a', '5', ogg]);
        fs.unlinkSync(wavPath); file = ogg;
      }
      fs.writeFileSync(path.join(outDir, t.id + '.json'), JSON.stringify({
        loopStart: 0, loopEnd: Math.round(dur * 1000) / 1000,
        source: { provider: pv.name, model: pv.cfg.model, prompt: buildPrompt(t, P), seed, generated: new Date().toISOString(), rawSeconds: Math.round(raw * 10) / 10, xfade },
      }, null, 2) + '\n');
      console.log(`${path.relative(ROOT, file)} (${dur.toFixed(1)} s${xfade ? ', loop-smoothed' : ''})`);
    } catch (e) {
      fails++;
      console.log('FAILED: ' + redact(e.message || e));
    }
  }
  if (!ff) console.log('[lyria] ffmpeg not found: kept WAV files (large when embedded — encode to .ogg later or build with --bgm external)');
  return fails ? 1 : 0;
}

module.exports = { buildPrompt, selectTracks, loadPrompts, PROVIDERS, pickProvider, parseWav, writeWav, loopSmooth, scaleOf, main, FIRST_BATCH };
if (require.main === module) main(process.argv.slice(2), process.env).then((c) => { process.exitCode = c; }, (e) => { console.error('[lyria] ' + redact(e.message || e)); process.exitCode = 1; });
