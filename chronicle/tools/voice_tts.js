#!/usr/bin/env node
// Generate the voice lines with Gemini TTS (BRIEF A9 + the owner's 2026-09-26 request) → assets/voice/<id>.ogg
//
//   node tools/voice_tts.js                  every missing line of design/voice/script.csv + the hero's battle voices
//   node tools/voice_tts.js --only v_fine_t1_01,v_rowell_t2_03     these ids      --speaker rowell   one speaker
//   node tools/voice_tts.js --hero           only the hero's battle voices       --no-hero   skip them
//   node tools/voice_tts.js --force          regenerate files that exist        --dry-run   print prompts only
//   node tools/voice_tts.js --reprocess      redo trim / effects / loudness from the cached raw WAVs (no API)
//   options: --lufs <n> (default -16)  --tries <n> (per line, default 4)  --raw <dir> (default $TMPDIR/voice_raw)
//
// Casting, voice ids, per-speaker profile/style, per-line direction and the hero's battle lines live in
// design/voice/casting.json; the lines themselves come from src/ via tools/voice_script.js.
//
// ------------------------------------------------------------------ API (verified 2026-09-26)
//   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent
//   header x-goog-api-key: $GOOGLE_API_KEY          (quota: 10 requests / minute per model → the tool waits)
//   body {"contents":[{"parts":[{"text":"<prompt>"}]}],
//         "generationConfig":{"responseModalities":["AUDIO"],
//           "speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":"ja-jp-storyteller-1"}}}}}
//        custom (replicated) voice from GET /v1beta/voices:  "voiceConfig":{"voice":"voice_akrep1z0wngp"}
//        (prebuiltVoiceConfig.voiceName does NOT take a custom id; systemInstruction is refused by the model)
//   → {"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"audio/wav","data":<base64>}}]}}]}
//        WAV, PCM 16-bit mono 24 kHz.
//   The prompt: "# AUDIO PROFILE … ## DIRECTOR'S NOTES … ## TRANSCRIPT <line>" — with a plain
//   "Say sadly: <line>" prefix the model sometimes reads the direction aloud, so every take is checked:
//   POST …/models/gemini-3.5-transcribe:generateContent  {contents:[{parts:[{inlineData:{mimeType:'audio/wav',
//   data}}, {text:'Transcribe …'}]}]} → parts[].audioTranscription.text, compared with the line.
//
// ------------------------------------------------------------------ post-processing (ffmpeg)
//   trim silence (≤ 60 ms before, 150 ms after), optional per-speaker effect (casting.json `fx`: pitch /
//   echo for giants, golems, ghosts), loudness −16 LUFS integrated (linear gain, sample peak ≤ −1 dBFS),
//   Ogg Vorbis mono 24 kHz (-q 4). Each file is checked: duration vs the text length, not silent, not clipped.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const GA = require('./lib/gemini_audio');

const ROOT = path.resolve(__dirname, '..');
const CASTING = path.join(ROOT, 'design', 'voice', 'casting.json');
const OUT = path.join(ROOT, 'assets', 'voice');
const TTS_MODEL = process.env.TTS_MODEL || 'gemini-3.8-flash-tts';
const STT_MODEL = process.env.STT_MODEL || 'gemini-3.5-transcribe';

// ------------------------------------------------------------------ the lines
function loadCasting(file) { return JSON.parse(fs.readFileSync(file || CASTING, 'utf8')); }
/** every line to voice: script lines (fixed characters) + the hero's battle voices (both genders) */
function allLines(C) {
  const VS = require('./voice_script');
  const { lines } = VS.collect();
  const out = lines.map((l) => ({ id: l.id, speaker: l.speaker, text: l.text, scene: l.event, est: l.seconds, direction: (C.lines || {})[l.id] || '' }));
  const H = C.hero;
  if (H) {
    for (const g of Object.keys(H.voices)) {
      for (const kind of Object.keys(H.lines)) {
        H.lines[kind].forEach((ln, i) => out.push({
          id: `v_hero_${g}_${kind}_${i + 1}`, speaker: 'hero_' + g, hero: g, kind, text: ln.text, direction: ln.note,
          scene: 'battle', est: Math.max(0.5, [...ln.text.replace(/[…！？。、「」―]/g, '')].length / 7 + 0.3), shout: !!H.shoutKinds && H.shoutKinds.includes(kind),
        }));
      }
    }
  }
  return out;
}
function speakerOf(C, line) {
  if (line.hero) { const v = C.hero.voices[line.hero]; return Object.assign({ profile: C.hero.profile[line.hero] || C.hero.profile, style: C.hero.style }, v); }
  const s = C.speakers[line.speaker];
  if (!s) throw new Error('no casting for speaker ' + line.speaker);
  return s;
}
/** the text the actor says: no ♪, no line breaks */
function spoken(text) { return text.replace(/♪/g, '').replace(/\s+/g, '').replace(/^「(.*)」$/, '$1').trim(); }
function buildPrompt(C, line) {
  const sp = speakerOf(C, line);
  const notes = [
    `Style: ${sp.style}`,
    line.direction ? `This line: ${line.direction}` : '',
    'Language: natural, native Tokyo-standard Japanese, performed by a professional anime/game voice actor. Pauses at "……" and "――". Do not read these notes aloud; say only the transcript.',
  ].filter(Boolean).join('\n');
  return `# AUDIO PROFILE: ${sp.profile}\n## SCENE: ${line.scene === 'battle' ? 'In the middle of a fantasy RPG battle.' : 'A story scene of a Japanese fantasy RPG.'}\n## DIRECTOR'S NOTES\n${notes}\n## TRANSCRIPT\n${spoken(line.text)}`;
}
function requestBody(C, line) {
  const sp = speakerOf(C, line);
  const voiceConfig = sp.type === 'custom' ? { voice: sp.voice } : { prebuiltVoiceConfig: { voiceName: sp.voice } };
  return { contents: [{ parts: [{ text: buildPrompt(C, line) }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig } } };
}

// ------------------------------------------------------------------ checks
const norm = (s) => String(s).normalize('NFKC').replace(/[\s、。，．,.!！?？…―ー〜~「」『』（）()・♪:：;；"'“”‘’\-]/g, '').toLowerCase();
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** similarity 0..1 of the transcript to the line (kana-insensitive) */
function similarity(line, heard) {
  const a = kataToHira(norm(spoken(line))), b = kataToHira(norm(heard));
  if (!a.length) return 1;
  return Math.max(0, 1 - lev(a, b) / Math.max(a.length, b.length));
}
async function transcribe(wav) {
  const json = await GA.geminiPost(STT_MODEL, { contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }, { text: 'Transcribe this Japanese speech exactly as spoken. Output only the transcript.' }] }] }, { timeoutSec: 120 });
  return GA.partsOf(json).text.trim();
}

// ------------------------------------------------------------------ audio processing
const FX = {
  // pitch factor p (<1 = lower, tempo kept) and an ffmpeg filter tail
  giant: { p: 0.8, af: 'aecho=0.8:0.7:70|140:0.35|0.2' },
  king: { p: 0.86, af: 'aecho=0.8:0.75:90|200|330:0.35|0.25|0.15' },
  valzard: { p: 0.88, af: 'aecho=0.8:0.7:80|180:0.3|0.2' },
  guardian: { p: 0.84, af: 'aecho=0.8:0.85:9|17:0.45|0.3,aecho=0.8:0.6:120:0.2' },
  sentinel: { p: 1.0, af: 'aecho=0.8:0.9:5|11:0.55|0.45,highpass=f=180' },
  mist: { p: 0.92, af: 'flanger=delay=2:depth=3:speed=0.3,aecho=0.8:0.65:170|340:0.35|0.2' },
  spirit: { p: 1.0, af: 'aecho=0.8:0.6:110|230:0.22|0.12' },
  ghost: { p: 1.0, af: 'aecho=0.8:0.6:140|290:0.25|0.15' },
};
function applyFx(ch, rate, fx) {
  const f = FX[fx];
  if (!f) return ch;
  const tmp = path.join(os.tmpdir(), `lc_fx_${process.pid}_${Date.now()}.wav`);
  const out = tmp.replace(/\.wav$/, '_o.wav');
  GA.encode(ch, rate, tmp);
  const pad = 'apad=pad_dur=0.6';
  const chain = (f.p !== 1 ? [`asetrate=${Math.round(rate * f.p)}`, `aresample=${rate}`, `atempo=${(1 / f.p).toFixed(4)}`] : []).concat([pad, f.af]);
  const { spawnSync } = require('child_process');
  const r = spawnSync(GA.ffmpegPath(), ['-hide_banner', '-y', '-i', tmp, '-af', chain.join(','), '-ar', String(rate), out]);
  if (r.status !== 0) throw new Error('fx ffmpeg: ' + String(r.stderr).slice(-300));
  const d = GA.decode(out, { rate, channels: 1 });
  fs.rmSync(tmp, { force: true }); fs.rmSync(out, { force: true });
  return d.channels;
}
/** trim silence: keep `pre` s before the first and `post` s after the last sample above peak − 42 dB */
function trim(ch, rate, pre, post) {
  const x = ch[0], p = GA.peak(ch), th = Math.max(p * Math.pow(10, -42 / 20), 1e-4);
  const w = Math.round(rate * 0.01);
  const loud = (i) => { let e = 0; for (let k = i; k < Math.min(x.length, i + w); k++) e = Math.max(e, Math.abs(x[k])); return e > th; };
  let a = 0; while (a < x.length && !loud(a)) a += w;
  let b = x.length - w; while (b > a && !loud(b)) b -= w;
  const s = Math.max(0, a - Math.round(pre * rate)), e = Math.min(x.length, b + w + Math.round(post * rate));
  const out = ch.map((c) => c.slice(s, e));
  // 5 ms fades against clicks
  const f = Math.round(rate * 0.005);
  for (const c of out) for (let i = 0; i < f && i < c.length; i++) { c[i] *= i / f; c[c.length - 1 - i] *= i / f; }
  return out;
}
function processWav(wavBytes, line, sp, o) {
  const d = GA.decode(wavBytes, { ext: 'wav' });
  let ch = [GA.mono(d.channels)];
  ch = trim(ch, d.rate, 0.06, 0.15);
  if (sp.fx) ch = trim(applyFx(ch, d.rate, sp.fx), d.rate, 0.03, 0.5);
  let n = GA.normalise(ch, d.rate, o.lufs, -1);
  // very short shouts: ebur128 cannot gate < 0.4 s reliably → RMS-based fallback (≈ −16 dBFS RMS)
  if (!isFinite(n.before.I)) {
    const x = ch[0]; let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i];
    const rms = Math.sqrt(e / x.length), g = Math.min(Math.pow(10, (o.lufs + 2) / 20) / (rms || 1e-9), Math.pow(10, -1 / 20) / (GA.peak(ch) || 1e-9));
    n = { channels: GA.gain(ch, g), gainDb: 20 * Math.log10(g), before: n.before, limited: false };
  }
  return { rate: d.rate, channels: n.channels, gainDb: n.gainDb, rawDur: d.channels[0].length / d.rate };
}
function check(p, line) {
  const dur = p.channels[0].length / p.rate, pk = GA.peak(p.channels);
  const db = GA.rmsDb(p.channels[0], p.rate, 0.05);
  const loudFrames = db.filter((v) => v > -40).length * 0.05;
  const problems = [];
  const lo = line.shout ? 0.2 : Math.max(0.35, line.est * 0.35), hi = line.shout ? 3.5 : Math.max(3, line.est * 2.6 + 1.5);
  if (dur < lo || dur > hi) problems.push(`duration ${dur.toFixed(2)} s outside ${lo.toFixed(1)}–${hi.toFixed(1)} s`);
  if (loudFrames < Math.min(0.2, dur * 0.3)) problems.push('almost silent');
  if (pk > 0.9995) problems.push('clipped');
  return { dur, peakDb: 20 * Math.log10(pk || 1e-9), problems };
}

// ------------------------------------------------------------------ main
async function main(argv, E) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const C = loadCasting(arg('--casting'));
  let lines = allLines(C);
  if (argv.includes('--hero')) lines = lines.filter((l) => l.hero);
  if (argv.includes('--no-hero')) lines = lines.filter((l) => !l.hero);
  if (arg('--only')) { const want = arg('--only').split(','); lines = lines.filter((l) => want.includes(l.id)); }
  if (arg('--speaker')) { const want = arg('--speaker').split(','); lines = lines.filter((l) => want.includes(l.speaker)); }
  const outDir = path.resolve(arg('--out', OUT));
  const rawDir = path.resolve(arg('--raw', path.join(os.tmpdir(), 'voice_raw')));
  const o = { lufs: +arg('--lufs', -16), tries: +arg('--tries', 4) };
  if (argv.includes('--dry-run')) {
    for (const l of lines) { console.log(`=== ${l.id}`); console.log(JSON.stringify(requestBody(C, l).generationConfig)); console.log(buildPrompt(C, l)); }
    console.log(`[voice] dry run: ${lines.length} line(s)`);
    return 0;
  }
  const reproc = argv.includes('--reprocess');
  if (!GA.apiKey(E) && !reproc) { console.log('[voice] GOOGLE_API_KEY is not set — nothing generated. export GOOGLE_API_KEY=<key> and run again (--dry-run shows the prompts).'); return 0; }
  if (!GA.ffmpegPath()) { console.log('[voice] ffmpeg not found (PATH, $FFMPEG or `pip install imageio-ffmpeg`).'); return 1; }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  const report = [];
  let fails = 0;
  for (const l of lines) {
    const file = path.join(outDir, l.id + '.ogg');
    if (fs.existsSync(file) && !argv.includes('--force') && !reproc) continue;
    const sp = speakerOf(C, l);
    const rawFile = path.join(rawDir, l.id + '.wav');
    try {
      let wav = null, heard = '', sim = 0;
      if (reproc) {
        if (!fs.existsSync(rawFile)) throw new Error('no raw take in ' + rawDir);
        wav = fs.readFileSync(rawFile);
        const m = fs.existsSync(rawFile + '.json') ? JSON.parse(fs.readFileSync(rawFile + '.json', 'utf8')) : {};
        heard = m.heard || ''; sim = m.similarity || 0;
      } else {
        let best = null;
        for (let t = 0; t < o.tries; t++) {
          const json = await GA.geminiPost(TTS_MODEL, requestBody(C, l), { timeoutSec: 180, log: (s) => process.stdout.write(s.trim() + ' ') });
          const p = GA.partsOf(json);
          if (!p.audio.length) { console.log(`  ${l.id}: no audio (${p.finishReason || p.blocked || p.text})`); continue; }
          const w = p.audio[0].bytes;
          const h = await transcribe(w);
          const s = similarity(l.text, h);
          const leaked = /[A-Za-z]{4,}/.test(h) && !/[A-Za-z]{4,}/.test(l.text);
          const pr = processWav(w, l, sp, o), ck = check(pr, l);
          const need = l.shout ? 0.0 : l.hero ? 0.4 : 0.72;
          const good = !leaked && s >= need && !ck.problems.length;
          const q = s - (leaked ? 1 : 0) - ck.problems.length * 0.5;
          if (!best || q > best.q) best = { w, h, s, q, good };
          if (good) break;
          console.log(`  ${l.id}: retry (heard "${h}", sim ${s.toFixed(2)}${leaked ? ', direction read aloud' : ''}${ck.problems.length ? ', ' + ck.problems.join('; ') : ''})`);
        }
        if (!best) throw new Error('no audio after ' + o.tries + ' tries');
        wav = best.w; heard = best.h; sim = best.s;
        fs.writeFileSync(rawFile, wav);
        fs.writeFileSync(rawFile + '.json', JSON.stringify({ id: l.id, voice: sp.voice, heard, similarity: sim, prompt: buildPrompt(C, l), generated: new Date().toISOString() }, null, 1));
        if (!best.good) console.log(`  ${l.id}: kept the best take (sim ${sim.toFixed(2)}) — listen to it`);
      }
      const pr = processWav(wav, l, sp, o), ck = check(pr, l);
      GA.encode(pr.channels, pr.rate, file, { q: 4 });
      const L = GA.loudness(pr.channels, pr.rate);
      const row = { id: l.id, speaker: l.speaker, voice: sp.voice, text: spoken(l.text), heard, similarity: Math.round(sim * 100) / 100, seconds: Math.round(ck.dur * 100) / 100, estimate: l.est, lufs: isFinite(L.I) ? L.I : null, peakDb: Math.round(ck.peakDb * 10) / 10, problems: ck.problems, bytes: fs.statSync(file).size };
      report.push(row);
      if (ck.problems.length) fails++;
      console.log(`[voice] ${l.id}: ${ck.dur.toFixed(2)} s, ${isFinite(L.I) ? L.I.toFixed(1) + ' LUFS' : 'short'}, sim ${sim.toFixed(2)}${ck.problems.length ? '  ✗ ' + ck.problems.join('; ') : ''}`);
    } catch (e) {
      fails++;
      console.log(`[voice] ${l.id}: FAILED: ${GA.redact(e.message || e)}`);
      report.push({ id: l.id, speaker: l.speaker, failed: GA.redact(e.message || e) });
    }
  }
  const rp = arg('--report');
  if (rp) {
    const prev = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : {};
    for (const r of report) prev[r.id] = r;
    fs.writeFileSync(rp, JSON.stringify(prev, null, 1));
  }
  console.log(`[voice] ${report.length} processed, ${fails} with problems`);
  return fails ? 1 : 0;
}

module.exports = { loadCasting, allLines, buildPrompt, requestBody, similarity, spoken, main, FX };
if (require.main === module) main(process.argv.slice(2), process.env).then((c) => { process.exitCode = c; }, (e) => { console.error('[voice] ' + GA.redact(e.message || e)); process.exitCode = 1; });
