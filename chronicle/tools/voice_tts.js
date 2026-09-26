#!/usr/bin/env node
// Generate the voice lines with Gemini TTS (BRIEF A9 + the owner's 2026-09-26 request) → assets/voice/<id>.ogg
//
//   node tools/voice_tts.js                  every missing line of design/voice/script.csv + the hero's battle voices
//   node tools/voice_tts.js --only v_fine_t1_01,v_rowell_t2_03     these ids      --speaker rowell   one speaker
//   node tools/voice_tts.js --hero           only the hero's battle voices       --no-hero   skip them
//   node tools/voice_tts.js --force          regenerate files that exist        --dry-run   print prompts only
//   node tools/voice_tts.js --reprocess      redo trim / effects / loudness from the cached raw WAVs (no API)
//   options: --lufs <n> (default -16)  --raw <dir> (default $TMPDIR/voice_raw)  --report <file.json>
//            --direct (one generateContent call per take; --tries <n>, default 4) — default for ≤ 3 lines
//            (--batch forces the Batch API for them, e.g. when the 100 req/day generateContent quota is used up);
//            otherwise the Batch API: --takes <n> per line and round (default 2), --rounds <n> (default 3)
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
//   POST …/models/gemini-3.8-flash:generateContent {contents:[{parts:[{inlineData:{mimeType:'audio/wav',data}},
//   {text:'<the line> … reply JSON {heard, match, extra}'}]}]} — a listening check that allows kanji/kana
//   variants (gemini-3.5-transcribe → parts[].audioTranscription.text also works, but spells differently).
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
const JUDGE_MODEL = process.env.JUDGE_MODEL || 'gemini-3.8-flash';

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
  const said = (C.readings || {})[line.id] || spoken(line.text); // kana reading for words the model misreads
  return `# AUDIO PROFILE: ${sp.profile}\n## SCENE: ${line.scene === 'battle' ? 'In the middle of a fantasy RPG battle.' : 'A story scene of a Japanese fantasy RPG.'}\n## DIRECTOR'S NOTES\n${notes}\n## TRANSCRIPT\n${said}`;
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
/** listen to a take: does it say exactly the line (spelling variants allowed) and nothing else?
 *  → {match, heard, extra, note}. JUDGE_MODEL (gemini-3.8-flash) hears the audio. */
async function judge(wav, line) {
  const q = 'You check voice-over takes for a Japanese game. The script line is:\n「' + spoken(line.text) + '」\n' +
    'Listen to the audio. Reply ONLY JSON: {"heard":"<what is said, in Japanese>","match":true|false,"extra":"<any words said that are not in the line, e.g. English stage directions, else empty>","note":"<max 12 words on delivery>"}. ' +
    'match = the audio says the whole line and nothing else; different kanji/kana spelling of the same words, katakana robot speech read as normal words, pauses, breaths and the omission of "……" are fine.';
  const json = await GA.geminiPost(JUDGE_MODEL, { contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }, { text: q }] }], generationConfig: { responseMimeType: 'application/json' } }, { timeoutSec: 120 });
  const t = GA.partsOf(json).text;
  try { const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); return { match: !!j.match, heard: String(j.heard || ''), extra: String(j.extra || ''), note: String(j.note || '') }; } catch (e) { return { match: false, heard: t.slice(0, 80), extra: '', note: 'unparsable judge reply' }; }
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
  ch = GA.limitTo(ch, d.rate, o.lufs, -3); // gain to the target, limiter at −3 dBFS (Vorbis overshoots ~2 dB on decode)
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
  const todo = lines.filter((l) => reproc || argv.includes('--force') || !fs.existsSync(path.join(outDir, l.id + '.ogg')));
  let judgeOff = false; // the judge model hit its daily quota → fall back to the transcription model
  /** listen to one take → {good, q, heard, sim, note} */
  const evaluate = async (w, l, sp) => {
    let jd;
    if (!judgeOff) {
      try { jd = await judge(w, l); } catch (e) { if (!e.daily) throw e; judgeOff = true; console.log('  (judge model: daily quota reached — using the transcription model from now on)'); }
    }
    if (!jd) { const h = await transcribe(w); jd = { heard: h, match: similarity(l.text, h) >= 0.72, extra: '', note: 'transcription check' }; }
    const h = jd.heard, sim0 = similarity(l.text, h);
    const leaked = (/[A-Za-z]{4,}/.test(h) && !/[A-Za-z]{4,}/.test(l.text)) || /[A-Za-z]{4,}/.test(jd.extra);
    const ck = check(processWav(w, l, sp, o), l);
    const ok = l.shout ? !leaked : (jd.match && !leaked);
    return { good: ok && !ck.problems.length, q: (ok ? 1 : 0) + sim0 * 0.5 - (leaked ? 1 : 0) - ck.problems.length * 0.5, heard: h, sim: ok ? Math.max(sim0, 0.9) : sim0, note: jd.note, why: `heard "${h}"${jd.extra ? ', extra "' + jd.extra + '"' : ''}${ck.problems.length ? ', ' + ck.problems.join('; ') : ''}` };
  };
  /** write the chosen take: raw cache + ogg + report row */
  const finish = (l, sp, wav, ev) => {
    const file = path.join(outDir, l.id + '.ogg'), rawFile = path.join(rawDir, l.id + '.wav');
    if (!reproc) {
      fs.writeFileSync(rawFile, wav);
      fs.writeFileSync(rawFile + '.json', JSON.stringify({ id: l.id, voice: sp.voice, heard: ev.heard, similarity: ev.sim, note: ev.note, matched: ev.good, prompt: buildPrompt(C, l), generated: new Date().toISOString() }, null, 1));
      if (!ev.good) console.log(`  ${l.id}: kept the best take (${ev.why}) — listen to it`);
    }
    const pr = processWav(wav, l, sp, o), ck = check(pr, l);
    GA.encode(pr.channels, pr.rate, file, { q: 4 });
    const L = GA.loudness(pr.channels, pr.rate);
    report.push({ id: l.id, speaker: l.speaker, voice: sp.voice, text: spoken(l.text), heard: ev.heard, matched: ev.good, similarity: Math.round(ev.sim * 100) / 100, note: ev.note, seconds: Math.round(ck.dur * 100) / 100, estimate: l.est, lufs: isFinite(L.I) ? L.I : null, peakDb: Math.round(ck.peakDb * 10) / 10, problems: ck.problems, bytes: fs.statSync(file).size });
    if (ck.problems.length || !ev.good) fails++;
    console.log(`[voice] ${l.id}: ${ck.dur.toFixed(2)} s, ${isFinite(L.I) ? L.I.toFixed(1) + ' LUFS' : 'short'}, ${ev.good ? 'ok' : 'CHECK'} "${ev.heard}"${ck.problems.length ? '  ✗ ' + ck.problems.join('; ') : ''}`);
  };
  if (reproc) {
    for (const l of todo) {
      const sp = speakerOf(C, l), rawFile = path.join(rawDir, l.id + '.wav');
      if (!fs.existsSync(rawFile)) { console.log(`[voice] ${l.id}: no raw take in ${rawDir}`); fails++; continue; }
      const m = fs.existsSync(rawFile + '.json') ? JSON.parse(fs.readFileSync(rawFile + '.json', 'utf8')) : {};
      finish(l, sp, fs.readFileSync(rawFile), { heard: m.heard || '', sim: m.similarity || 0, note: m.note || '', good: m.matched !== false, why: '' });
    }
  } else if (argv.includes('--direct') || (todo.length <= 3 && !argv.includes('--batch'))) {
    // one request per take (generateContent; 10 / min and 100 / day per model)
    for (const l of todo) {
      const sp = speakerOf(C, l);
      try {
        let best = null;
        for (let t = 0; t < o.tries && !(best && best.ev.good); t++) {
          const p = GA.partsOf(await GA.geminiPost(TTS_MODEL, requestBody(C, l), { timeoutSec: 180, log: (x) => process.stdout.write(x.trim() + ' ') }));
          if (!p.audio.length) { console.log(`  ${l.id}: no audio (${p.finishReason || p.blocked || p.text})`); continue; }
          const ev = await evaluate(p.audio[0].bytes, l, sp);
          if (!best || ev.q > best.ev.q) best = { w: p.audio[0].bytes, ev };
          if (!ev.good) console.log(`  ${l.id}: retry (${ev.why})`);
        }
        if (!best) throw new Error('no audio after ' + o.tries + ' tries');
        finish(l, sp, best.w, best.ev);
      } catch (e) { fails++; console.log(`[voice] ${l.id}: FAILED: ${GA.redact(e.message || e)}`); report.push({ id: l.id, speaker: l.speaker, failed: GA.redact(e.message || e) }); }
    }
  } else {
    // Batch API rounds: `--takes` takes of every open line per round (default 2), listen, keep the first good one;
    // the lines without a good take go into the next round (up to --rounds, default 3)
    const takes = +arg('--takes', 2), rounds = +arg('--rounds', 3);
    const best = new Map();
    let open = todo.slice();
    for (let r = 0; r < rounds && open.length; r++) {
      console.log(`[voice] round ${r + 1}: ${open.length} line(s) × ${takes} take(s) via the Batch API`);
      const reqs = [];
      for (const l of open) for (let k = 0; k < takes; k++) reqs.push({ key: `${l.id}#${r}.${k}`, request: requestBody(C, l) });
      let res;
      try { res = await GA.batchGenerate(TTS_MODEL, reqs, { name: 'lc-voice-r' + (r + 1), log: (x) => console.log('  ' + x) }); } catch (e) {
        // out of quota / credits: stop asking, keep the best takes so far (below)
        console.log(`[voice] round ${r + 1} failed: ${GA.redact(e.message || e).slice(0, 200)}`);
        break;
      }
      const next = [];
      for (const l of open) {
        const sp = speakerOf(C, l);
        for (let k = 0; k < takes; k++) {
          const got = res.get(`${l.id}#${r}.${k}`);
          if (!got || got.error) { console.log(`  ${l.id}: take ${k + 1} failed ${got ? got.error.slice(0, 120) : '(missing)'}`); continue; }
          const p = GA.partsOf(got.json);
          if (!p.audio.length) { console.log(`  ${l.id}: take ${k + 1} without audio (${p.finishReason || p.blocked || ''})`); continue; }
          try {
            const ev = await evaluate(p.audio[0].bytes, l, sp);
            const b = best.get(l.id);
            if (!b || ev.q > b.ev.q) best.set(l.id, { w: p.audio[0].bytes, ev });
            if (ev.good) break;
            console.log(`  ${l.id}: take ${k + 1} rejected (${ev.why})`);
          } catch (e) {
            console.log(`  ${l.id}: take ${k + 1} check failed: ${GA.redact(e.message || e).slice(0, 160)}`);
            if (!best.get(l.id)) best.set(l.id, { w: p.audio[0].bytes, ev: { good: false, q: -1, heard: '', sim: 0, note: 'not checked', why: 'not checked' } });
          }
        }
        const b = best.get(l.id);
        if (b && b.ev.good) finish(l, sp, b.w, b.ev); else next.push(l);
      }
      open = next;
    }
    for (const l of open) {
      const b = best.get(l.id);
      if (b) finish(l, speakerOf(C, l), b.w, b.ev);
      else { fails++; console.log(`[voice] ${l.id}: FAILED (no take)`); report.push({ id: l.id, speaker: l.speaker, failed: 'no take' }); }
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

module.exports = { judge, transcribe, loadCasting, allLines, buildPrompt, requestBody, similarity, spoken, main, FX };
if (require.main === module) main(process.argv.slice(2), process.env).then((c) => { process.exitCode = c; }, (e) => { console.error('[voice] ' + GA.redact(e.message || e)); process.exitCode = 1; });
