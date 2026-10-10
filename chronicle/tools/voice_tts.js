#!/usr/bin/env node
// Generate the voice lines with Gemini TTS (BRIEF A9 + the owner's 2026-09-26 request) → assets/voice/<id>.ogg
//
//   node tools/voice_tts.js                  every missing line of design/voice/script.csv + the hero's battle voices
//   node tools/voice_tts.js --only v_fine_t1_01,v_rowell_t2_03     these ids      --speaker rowell   one speaker
//   node tools/voice_tts.js --hero           only the hero's battle voices       --no-hero   skip them
//   node tools/voice_tts.js --battle         only battle voices (companions b_<char>_<kind>_<n> from
//                                            design/voice/battle_lines.csv + the hero)   --no-battle  skip the companions'
//                                            --char selma,hagen   only these companions' battle lines
//   node tools/voice_tts.js --story2         only the v2 slice story lines + town barks (design/voice/story_v2_lines.csv,
//                                            tools/story_voice.js)
//   node tools/voice_tts.js --boss           only the boss voices in battle (design/voice/boss_lines.csv, tools/boss_voice.js;
//                                            --bosses b_lazaro,b_zakuro  only these bosses   --no-boss  skip them)
//   node tools/voice_tts.js --force          regenerate files that exist        --dry-run   print prompts only
//   node tools/voice_tts.js --reprocess      redo trim / effects / loudness from the cached raw WAVs (no API)
//   options: --lufs <n> (default -16)  --raw <dir> (default $TMPDIR/voice_raw)  --report <file.json>
//            --direct (one generateContent call per take; --tries <n>, default 4) — default for ≤ 3 lines
//            (--batch forces the Batch API for them, e.g. when the 100 req/day generateContent quota is used up);
//            otherwise the Batch API: --takes <n> per line and round (default 2), --rounds <n> (default 3)
//   --no-listen  skip the listening checks (no STT_MODEL / JUDGE_MODEL calls): a take is kept or retried on the local
//                checks alone (duration vs. the text, silence, clipping)
//
// English version (owner 2026-10-10)  node tools/voice_tts.js --lang en --ids-file design/voice/en_pv_first.txt [--direct]
//   lines   design/voice/en_lines.csv (en_text, direction; tools/voice_en_lines.js), the other fields (speaker, kind, fx)
//           as in Japanese; casting design/voice/casting_en.json (an English voice per speaker; profile / style / fx /
//           pitch from casting.json) → assets/voice/en/<id>.ogg, report design/voice/en_report.json (default --report).
//   cost rules (fixed for --lang en): Gemini only makes the audio — --no-listen is always on; one take per line, at most
//   one retry and only when a local check fails or the answer is empty / an error (an id never gets more than 2 audio
//   requests over all runs: the attempts are kept in the report; --allow-more lifts it); HTTP retries only for a 429
//   rate limit (not billed); the Batch API in chunks of --batch-size (default 100) with takes 1 and at most 2 rounds.
//   Every request is counted (console, report `_usage`, and one JSON line per request in $VOICE_USAGE_LOG, default
//   $TMPDIR/voice_usage.jsonl — outside the repo, never the key).
//   --ids-file <file>  only the ids listed (one per line; any mode)   --verify  re-check every file of the list on disk
//   (exists, duration vs. the English text, not silent, not clipped, loudness) and write the report's `_verify` (no API)
//   --resume-batch <batches/…>  fetch the results of a batch made earlier (no new request)
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
const CASTING_EN = path.join(ROOT, 'design', 'voice', 'casting_en.json');
const EN_LINES = path.join(ROOT, 'design', 'voice', 'en_lines.csv');
const EN_REPORT = path.join(ROOT, 'design', 'voice', 'en_report.json');
const MAX_EN_ATTEMPTS = 2;   // one take + at most one retry per line (owner's cost rule for the English version)

// ------------------------------------------------------------------ the lines
function loadCasting(file) { return JSON.parse(fs.readFileSync(file || CASTING, 'utf8')); }
/** casting.json with the English voices of casting_en.json put in (C.lang = 'en'): profile / style / fx / pitch stay,
 *  except where casting_en.json gives an English profile / style. The Japanese per-line notes and kana readings are dropped. */
function enCasting(C, file) {
  const E = JSON.parse(fs.readFileSync(file || CASTING_EN, 'utf8'));
  const M = JSON.parse(JSON.stringify(C));
  const put = (dst, e) => {
    if (!e || !e.voice) { dst.voice = null; dst.noEnglish = true; return dst; }
    dst.voice = e.voice; dst.type = e.type || 'prebuilt';
    for (const k of ['profile', 'style']) if (e[k]) dst[k] = e[k];
    return dst;
  };
  for (const k of Object.keys(M.speakers || {})) put(M.speakers[k], (E.speakers || {})[k]);
  if (M.hero) for (const g of Object.keys(M.hero.voices)) M.hero.voices[g] = put({}, (E.hero || {})[g]);
  if (M.battle) for (const k of Object.keys(M.battle.cast)) put(M.battle.cast[k], (E.battle || {})[k]);
  if (M.boss) for (const k of Object.keys(M.boss.cast)) if (!M.boss.cast[k].speaker) put(M.boss.cast[k], (E.boss || {})[k]);
  M.lines = {}; M.readings = {};
  M.lang = 'en'; M.accent = E.accent || 'neutral General American';
  return M;
}
/** English: rough spoken seconds (≈ 4.2 syllables / s in game dialogue, plus pauses at "...", dashes and sentence ends) */
function syllables(w) {
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return 0;
  const g = s.replace(/e$/, '').match(/[aeiouy]+/g);
  return Math.max(1, g ? g.length : 1);
}
function estimateEn(t) {
  const words = String(t).match(/[A-Za-z']+/g) || [];
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const pauses = (t.match(/\.\.\./g) || []).length * 0.35 + (t.match(/—/g) || []).length * 0.25 + (t.match(/[^.][.!?](\s|$)/g) || []).length * 0.2 + (t.match(/,/g) || []).length * 0.1;
  return Math.round((syl / 4.2 + pauses + 0.3) * 10) / 10;
}
/** the English lines (en_lines.csv) on top of the Japanese line records (same id, speaker, kind, fx) */
function enLines(C, file) {
  const VE = require('./voice_en_lines');
  const rows = VE.loadRows(file || EN_LINES);
  const base = Object.fromEntries(allLines(C).map((l) => [l.id, l]));
  return rows.map((r) => {
    const b = base[r.id];
    if (!b) throw new Error(`${r.id} (en_lines.csv) is not a voice line`);
    if (!r.en_text) throw new Error(`${r.id}: no en_text in en_lines.csv`);
    const est = estimateEn(r.en_text);
    return Object.assign({}, b, { lang: 'en', text: r.en_text, ja: b.text, direction: r.direction || b.direction, est: b.hero || b.battle ? Math.max(0.5, est) : Math.max(b.bossv ? 0.6 : 0.35, est) });
  });
}
/** the text the actor says (Japanese: no spaces or line breaks; English: single spaces) */
function said(C, line) {
  if (C.lang === 'en') return String(line.text).replace(/\s+/g, ' ').trim();
  return (C.readings || {})[line.id] || spoken(line.text);
}
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
  // v2 slice story lines + town greeting barks (design/voice/story_v2_lines.csv, tools/story_voice.js)
  {
    const SV = require('./story_voice');
    for (const s of SV.loadLines()) {
      const text = SV.plain(s.text);
      out.push({ id: s.id, speaker: s.speaker, story2: s.kind, text, direction: s.direction, scene: s.kind === 'bark' ? 'bark' : s.event, est: SV.estimate(text) });
    }
  }
  if (C.battle) {
    const BV = require('./battle_voice');
    const shoutKinds = C.battle.shoutKinds || ['attack', 'hurt'];
    for (const b of BV.loadLines()) {
      out.push({
        id: b.id, speaker: 'b_' + b.char, battle: b.char, kind: b.kind, text: b.text, direction: b.direction, scene: 'battle',
        est: Math.max(0.5, BV.spokenLen(b.text) / 7 + 0.3), shout: shoutKinds.includes(b.kind),
      });
    }
  }
  // boss voices in battle (start / enrage / ult / defeat; design/voice/boss_lines.csv, tools/boss_voice.js)
  if (C.boss) {
    const BO = require('./boss_voice');
    for (const b of BO.loadLines()) {
      out.push({
        id: b.id, speaker: 'boss_' + b.boss, bossv: b.boss, kind: b.kind, text: b.text, direction: b.direction, scene: 'battle',
        est: Math.max(0.6, BO.spokenLen(b.text) / 7 + (b.text.match(/……/g) || []).length * 0.4 + 0.3),
      });
    }
  }
  return out;
}
function speakerOf(C, line) {
  const sp = speakerOf0(C, line);
  if (C.lang === 'en' && !sp.voice) throw new Error(`no English voice for ${line.speaker} (design/voice/casting_en.json)`);
  return sp;
}
function speakerOf0(C, line) {
  if (line.bossv) {
    const b = require('./boss_voice').castOf(C, line.bossv);
    if (!b) throw new Error('no boss casting for ' + line.bossv);
    return b;
  }
  if (line.battle) {
    const b = C.battle && C.battle.cast[line.battle];
    if (!b) throw new Error('no battle casting for ' + line.battle);
    return b;
  }
  if (line.hero) { const v = C.hero.voices[line.hero]; return Object.assign({ profile: C.hero.profile[line.hero] || C.hero.profile, style: C.hero.style }, v); }
  const s = C.speakers[line.speaker];
  if (!s) throw new Error('no casting for speaker ' + line.speaker);
  return s;
}
/** the text the actor says: no ♪, no line breaks */
function spoken(text) { return text.replace(/♪/g, '').replace(/\s+/g, '').replace(/^「(.*)」$/, '$1').trim(); }
function buildPrompt(C, line) {
  const sp = speakerOf(C, line);
  const en = C.lang === 'en';
  const notes = [
    `Style: ${sp.style}`,
    line.direction ? `This line: ${line.direction}` : '',
    line.shout && line.battle ? 'A short battle shout: one quick burst, well under one and a half seconds, no drawn-out vowels.' : '',
    line.bossv ? `A boss's line in the middle of a battle: keep it tight, about ${Math.max(1.5, Math.round(line.est * 1.2 * 2) / 2)} seconds, no long silences (only a short pause at "${en ? '...' : '……'}").` : '',
    en ? `Language: natural, native English with a ${C.accent} accent, performed by a professional voice actor for the English dub of a fantasy RPG. Pauses at "..." and "—". Say the transcript exactly once, and nothing else. Do not read these notes aloud.`
      : 'Language: natural, native Tokyo-standard Japanese, performed by a professional anime/game voice actor. Pauses at "……" and "――". Do not read these notes aloud; say only the transcript.',
  ].filter(Boolean).join('\n');
  const words = said(C, line); // Japanese: kana reading for words the model misreads
  const scene = line.scene === 'battle' ? 'In the middle of a fantasy RPG battle.'
    : line.scene === 'bark' ? `A townsperson greets the player as a conversation opens, in a ${en ? '' : 'Japanese '}fantasy RPG set in an endless lamplit night. One short natural greeting.`
      : en ? 'A story scene of a fantasy RPG.' : 'A story scene of a Japanese fantasy RPG.';
  const p = `# AUDIO PROFILE: ${sp.profile}\n## SCENE: ${scene}\n## DIRECTOR'S NOTES\n${notes}\n## TRANSCRIPT\n${words}`;
  if (en && /[぀-ヿ㐀-䶿一-鿿＀-￯]|Japanese|Tokyo|anime/i.test(p)) throw new Error(`${line.id}: the English prompt still talks about Japanese (fix casting_en.json / en_lines.csv): ${p.match(/.{0,40}(?:[぀-ヿ㐀-䶿一-鿿＀-￯]|Japanese|Tokyo|anime).{0,40}/i)[0]}`);
  return p;
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
/** fx: a FX table key, or {p, af} (e.g. {p: 1.06} = a plain pitch shift for a battle-cast `pitch`) */
function applyFx(ch, rate, fx) {
  const f = typeof fx === 'object' && fx ? fx : FX[fx];
  if (!f) return ch;
  const tmp = path.join(os.tmpdir(), `lc_fx_${process.pid}_${Date.now()}.wav`);
  const out = tmp.replace(/\.wav$/, '_o.wav');
  GA.encode(ch, rate, tmp);
  const pad = 'apad=pad_dur=0.6';
  const chain = (f.p !== 1 ? [`asetrate=${Math.round(rate * f.p)}`, `aresample=${rate}`, `atempo=${(1 / f.p).toFixed(4)}`] : []).concat([pad]).concat(f.af ? [f.af] : []);
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
  else if (sp.pitch && sp.pitch !== 1) ch = trim(applyFx(ch, d.rate, { p: sp.pitch }), d.rate, 0.03, 0.15);
  ch = GA.limitTo(ch, d.rate, o.lufs, o.limitDb != null ? o.limitDb : -3); // gain to the target, limiter at −3 dBFS (Vorbis overshoots ~2 dB on decode)
  let n = GA.normalise(ch, d.rate, o.lufs, o.ceilDb != null ? o.ceilDb : -1);
  // very short shouts: ebur128 cannot gate < 0.4 s reliably → RMS-based fallback (≈ −16 dBFS RMS)
  // (English lines: ebur128 also reports -70 LUFS = "nothing gated" for clips this short)
  if (!isFinite(n.before.I) || (line.lang === 'en' && n.before.I <= -69)) {
    const x = ch[0]; let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i];
    const rms = Math.sqrt(e / x.length), g = Math.min(Math.pow(10, (o.lufs + 2) / 20) / (rms || 1e-9), Math.pow(10, (o.ceilDb != null ? o.ceilDb : -1) / 20) / (GA.peak(ch) || 1e-9));
    n = { channels: GA.gain(ch, g), gainDb: 20 * Math.log10(g), before: n.before, limited: false };
  }
  return { rate: d.rate, channels: n.channels, gainDb: n.gainDb, rawDur: d.channels[0].length / d.rate };
}
function check(p, line) {
  const dur = p.channels[0].length / p.rate, pk = GA.peak(p.channels);
  const db = GA.rmsDb(p.channels[0], p.rate, 0.05);
  const loudFrames = db.filter((v) => v > -40).length * 0.05;
  const problems = [];
  // companion battle shouts must stay short (≤ ~1.5 s, BRIEF A37: they are cut off by the next voice anyway)
  // English (no listening check): the length is the main sign of a bad take (notes read aloud, a cut-off line), so the range is tighter
  const en = line.lang === 'en';
  const lo = line.shout ? 0.2 : en ? Math.max(0.3, line.est * 0.4) : Math.max(0.35, line.est * 0.35);
  const hi = line.shout ? (line.battle ? 1.6 : 3.5) : en ? Math.max(2.5, line.est * 2.2 + 1.2) : Math.max(3, line.est * 2.6 + 1.5);
  if (dur < lo || dur > hi) problems.push(`duration ${dur.toFixed(2)} s outside ${lo.toFixed(1)}–${hi.toFixed(1)} s`);
  if (loudFrames < Math.min(0.2, dur * 0.3)) problems.push('almost silent');
  if (pk > 0.9995) problems.push('clipped');
  return { dur, peakDb: 20 * Math.log10(pk || 1e-9), problems };
}

// ------------------------------------------------------------------ main
/** the ids of a list file (one per line; blank lines and # comments ignored) */
function readIds(file) { return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((x) => x.replace(/#.*/, '').trim()).filter(Boolean); }
async function main(argv, E) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  if (arg('--lang', 'ja') === 'en') return mainEn(argv, E);
  if (arg('--lang', 'ja') !== 'ja') { console.log(`[voice] --lang ${arg('--lang')}: only ja (default) and en`); return 1; }
  const C = loadCasting(arg('--casting'));
  let lines = allLines(C);
  if (arg('--ids-file')) { const want = new Set(readIds(arg('--ids-file'))); lines = lines.filter((l) => want.has(l.id)); }
  if (argv.includes('--hero')) lines = lines.filter((l) => l.hero);
  if (argv.includes('--no-hero')) lines = lines.filter((l) => !l.hero);
  if (argv.includes('--battle')) lines = lines.filter((l) => l.battle || l.hero);
  if (argv.includes('--no-battle')) lines = lines.filter((l) => !l.battle);
  if (argv.includes('--story2')) lines = lines.filter((l) => l.story2);
  if (argv.includes('--boss')) lines = lines.filter((l) => l.bossv);
  if (argv.includes('--no-boss')) lines = lines.filter((l) => !l.bossv);
  if (arg('--bosses')) { const want = arg('--bosses').split(','); lines = lines.filter((l) => want.includes(l.bossv)); }
  if (arg('--char')) { const want = arg('--char').split(','); lines = lines.filter((l) => want.includes(l.battle)); }
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
  const noListen = argv.includes('--no-listen');
  /** listen to one take → {good, q, heard, sim, note} */
  const evaluate = async (w, l, sp) => {
    if (noListen) { const ck = check(processWav(w, l, sp, o), l); return { good: !ck.problems.length, q: -ck.problems.length * 0.5, heard: '', sim: 0, note: 'local checks only (--no-listen)', why: ck.problems.join('; ') || 'ok' }; }
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

// ------------------------------------------------------------------ the English version (--lang en)
/** casting problems of the English version: a voice for every line, one voice per speaker */
function enCastProblems(C, lines, file) {
  const P = [];
  for (const l of lines) { try { speakerOf(C, l); buildPrompt(C, l); } catch (e) { P.push(e.message); } }
  const E = JSON.parse(fs.readFileSync(file || CASTING_EN, 'utf8'));
  const used = {};
  const add = (v, who) => { if (v) (used[v] = used[v] || []).push(who); };
  for (const [k, s] of Object.entries(E.speakers || {})) add(s.voice, 'story:' + k);
  for (const [k, s] of Object.entries(E.hero || {})) add(s.voice, 'hero:' + k);
  for (const [k, s] of Object.entries(E.battle || {})) add(s.voice, 'battle:' + k);
  for (const [k, s] of Object.entries(E.boss || {})) add(s.voice, 'boss:' + k);
  for (const [v, who] of Object.entries(used)) {
    if (who.length > 1 && !(who.length === 2 && who.every((w) => /^story:(melda|mistwitch)$/.test(w)))) P.push(`English voice ${v} is shared: ${who.join(', ')}`);
    if (/^[a-z]{2}-[a-z]{2}-/.test(v) && !/^en-/.test(v)) P.push(`${who.join(', ')}: ${v} is not an English voice`);
  }
  return P;
}
/** a take, checked on this machine only (no listening): length vs. the text, silence, clipping (also in the raw take) */
function localTake(w, l, sp, o) {
  const d = GA.decode(w, { ext: 'wav' });
  const x = GA.mono(d.channels);
  let full = 0, run = 0, maxRun = 0;
  for (let i = 0; i < x.length; i++) { if (Math.abs(x[i]) >= 0.999) { full++; run++; if (run > maxRun) maxRun = run; } else run = 0; }
  const ck = check(processWav(w, l, sp, o), l);
  if (maxRun >= 4 || full > x.length * 0.0005) ck.problems.push(`clipped in the raw take (${full} samples at full scale)`);
  return { good: !ck.problems.length, q: -ck.problems.length, heard: '', sim: 0, note: 'local checks only', why: ck.problems.join('; ') || 'ok', dur: ck.dur, rawDur: x.length / d.rate };
}
async function mainEn(argv, E) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const C = enCasting(loadCasting(arg('--casting')), arg('--casting-en'));
  let lines = enLines(C, arg('--lines'));
  if (arg('--ids-file')) {
    const want = readIds(arg('--ids-file')), have = new Set(lines.map((l) => l.id));
    const miss = want.filter((id) => !have.has(id));
    if (miss.length) { console.log(`[voice en] ${miss.length} id(s) of ${arg('--ids-file')} have no English line: ${miss.slice(0, 10).join(', ')}`); return 1; }
    const ws = new Set(want); lines = lines.filter((l) => ws.has(l.id));
  }
  if (arg('--only')) { const want = arg('--only').split(','); lines = lines.filter((l) => want.includes(l.id)); }
  if (arg('--speaker')) { const want = arg('--speaker').split(','); lines = lines.filter((l) => want.includes(l.speaker)); }
  const outDir = path.resolve(arg('--out', path.join(OUT, 'en')));
  const rawDir = path.resolve(arg('--raw', path.join(os.tmpdir(), 'voice_en_raw')));
  const repFile = path.resolve(arg('--report', EN_REPORT));
  const o = { lufs: +arg('--lufs', -16) };
  if (argv.includes('--listen')) { console.log('[voice en] the English version has no listening checks (owner\'s cost rule): --listen is not allowed'); return 1; }
  const P = enCastProblems(C, lines, arg('--casting-en'));
  for (const p of P) console.log('  ✗ ' + p);
  if (P.length) { console.log(`[voice en] ${P.length} casting problem(s) — nothing generated`); return 1; }
  if (argv.includes('--dry-run')) {
    for (const l of lines) { console.log(`=== ${l.id}  (est ${l.est} s)`); console.log(JSON.stringify(requestBody(C, l).generationConfig)); console.log(buildPrompt(C, l)); }
    console.log(`[voice en] dry run: ${lines.length} line(s)`);
    return 0;
  }
  if (!GA.ffmpegPath()) { console.log('[voice] ffmpeg not found (PATH, $FFMPEG or `pip install imageio-ffmpeg`).'); return 1; }
  const rep = fs.existsSync(repFile) ? JSON.parse(fs.readFileSync(repFile, 'utf8')) : {};
  const usage = rep._usage = rep._usage || { requests: 0, httpAttempts: 0, rateLimited: 0, retries: 0, batches: [], runs: [] };
  const save = () => {
    rep._readme = 'English voice files (tools/voice_tts.js --lang en). Per id: the take that was kept (seconds, LUFS, peak, local problems) and attempts = audio requests made for it (at most 2). _usage counts every request: requests = audio generation requests (direct calls + Batch API items, retries included), httpAttempts = HTTP requests sent (rate-limit resends included; a 429 answer makes no audio), retries = second requests after a failed local check / an empty or error answer. _verify = the last local check of all files on disk (--verify). stt = an offline open-source speech recognizer (tools/voice_en_stt.py; no API): report-only, except a line said twice (repeated), which counts as a length far off the text and may use the one retry.';
    const ordered = { _readme: rep._readme, _usage: rep._usage, _verify: rep._verify };
    for (const k of Object.keys(rep).filter((x) => !x.startsWith('_')).sort()) ordered[k] = rep[k];
    fs.writeFileSync(repFile, JSON.stringify(ordered, null, 1) + '\n');
  };
  // ---------------------------------------------------------------- --verify: every file of the list, on disk, no API
  if (argv.includes('--verify')) {
    const V = { t: new Date().toISOString(), files: lines.length, ok: 0, missing: [], problems: {}, notes: [] };
    const notes = V.notes;
    for (const l of lines) {
      const f = path.join(outDir, l.id + '.ogg');
      if (!fs.existsSync(f)) { V.missing.push(l.id); continue; }
      const probe = require('child_process').spawnSync(GA.ffmpegPath(), ['-hide_banner', '-i', f], { encoding: 'utf8' }).stderr;
      const pr = [];
      if (!/Audio: vorbis, 24000 Hz, mono/.test(probe)) pr.push('not Ogg Vorbis mono 24 kHz');
      const d = GA.decode(f, { rate: 24000, channels: 1 });
      const ck = check({ rate: d.rate, channels: d.channels }, l);
      pr.push(...ck.problems);
      const L = GA.loudness(d.channels, d.rate);
      const short = !isFinite(L.I) || L.I <= -69;   // < 0.4 s of speech: ebur128 gates everything out (-70)
      const peakLimited = L.I < o.lufs && ck.peakDb > -7.5;   // a peaky shout: the peak ceiling, not the target, set the gain
      if (!short && Math.abs(L.I - o.lufs) > 1.5 && !(peakLimited && L.I > o.lufs - 6)) pr.push(`loudness ${L.I.toFixed(1)} LUFS (target ${o.lufs})`);
      if (!short && Math.abs(L.I - o.lufs) > 1.5 && peakLimited && L.I > o.lufs - 6) notes.push(`${l.id}: ${L.I.toFixed(1)} LUFS (held down by the peak ceiling)`);
      if (short) { const x = d.channels[0]; let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i]; const r = 10 * Math.log10(e / x.length + 1e-12); if (r < o.lufs - 8 || r > o.lufs + 6) pr.push(`short clip RMS ${r.toFixed(1)} dBFS`); }
      rep[l.id] = Object.assign(rep[l.id] || { id: l.id }, { verify: { seconds: Math.round(ck.dur * 100) / 100, estimate: l.est, lufs: short ? null : Math.round(L.I * 10) / 10, peakDb: Math.round(ck.peakDb * 10) / 10, problems: pr } });
      if (pr.length) V.problems[l.id] = pr; else V.ok++;
    }
    rep._verify = V;
    save();
    console.log(`[voice en] verify: ${V.ok} / ${lines.length} files ok, ${V.missing.length} missing, ${Object.keys(V.problems).length} with problems`);
    for (const [id, pr] of Object.entries(V.problems)) console.log(`  ✗ ${id}: ${pr.join('; ')}`);
    if (V.missing.length) console.log('  missing: ' + V.missing.join(', '));
    return V.missing.length || Object.keys(V.problems).length ? 1 : 0;
  }
  const reproc = argv.includes('--reprocess');
  if (!GA.apiKey(E) && !reproc) { console.log('[voice en] GOOGLE_API_KEY is not set — nothing generated (--dry-run shows the prompts).'); return 0; }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  const usageLog = process.env.VOICE_USAGE_LOG || path.join(os.tmpdir(), 'voice_usage.jsonl');
  const run = { t: new Date().toISOString(), mode: '', lines: 0, requests: 0, httpAttempts: 0, rateLimited: 0, retries: 0 };
  usage.runs.push(run);
  const logUse = (r) => { try { fs.appendFileSync(usageLog, JSON.stringify(Object.assign({ t: new Date().toISOString(), tool: 'voice_tts', lang: 'en', model: TTS_MODEL }, r)) + '\n'); } catch (e) { /* the log is optional */ } };
  const onAttempt = (id) => (st) => { run.httpAttempts++; usage.httpAttempts++; if (st === 429) { run.rateLimited++; usage.rateLimited++; } logUse({ purpose: 'tts-http', id, status: st }); };
  const attempts = (l) => (rep[l.id] && rep[l.id].attempts) || 0;
  const allowed = (l) => (argv.includes('--allow-more') ? MAX_EN_ATTEMPTS : MAX_EN_ATTEMPTS - attempts(l));
  const bump = (l) => {
    rep[l.id] = rep[l.id] || { id: l.id };
    rep[l.id].attempts = attempts(l) + 1;
    if (rep[l.id].attempts > 1) { run.retries++; usage.retries++; }
    run.requests++; usage.requests++;
  };
  let fails = 0;
  const finish = (l, sp, wav, ev) => {
    const file = path.join(outDir, l.id + '.ogg'), rawFile = path.join(rawDir, l.id + '.wav');
    if (!reproc) fs.writeFileSync(rawFile, wav);
    // Vorbis can overshoot full scale on decode: when the written file does, encode it again with the limiter 2 dB lower
    let pr, ck, filePeak = 0, o2 = o;
    for (let k = 0; k < 4; k++) {
      o2 = k ? Object.assign({}, o, { limitDb: -3 - 2 * k, ceilDb: -1 - 2 * k }) : o;
      pr = processWav(wav, l, sp, o2); ck = check(pr, l);
      GA.encode(pr.channels, pr.rate, file, { q: 4 });
      filePeak = GA.peak(GA.decode(file, { rate: pr.rate, channels: 1 }).channels);
      if (filePeak <= 0.999) break;
    }
    if (filePeak > 0.999) ck.problems.push(`the Ogg file decodes above full scale (${(20 * Math.log10(filePeak)).toFixed(1)} dBFS)`);
    if (ev && ev.why && /raw take/.test(ev.why)) ck.problems.push(ev.why.match(/clipped in the raw take[^;]*/)[0]);
    const L = GA.loudness(pr.channels, pr.rate);
    rep[l.id] = Object.assign(rep[l.id] || { id: l.id }, { speaker: l.speaker, voice: sp.voice, text: said(C, l), seconds: Math.round(ck.dur * 100) / 100, estimate: l.est, lufs: isFinite(L.I) ? Math.round(L.I * 10) / 10 : null, peakDb: Math.round(ck.peakDb * 10) / 10, problems: ck.problems, bytes: fs.statSync(file).size, limiterDb: o2.limitDb != null ? o2.limitDb : -3, generated: reproc ? (rep[l.id] && rep[l.id].generated) : new Date().toISOString() });
    delete rep[l.id].failed;
    if (ck.problems.length) fails++;
    console.log(`[voice en] ${l.id}: ${ck.dur.toFixed(2)} s (est ${l.est}), ${isFinite(L.I) ? L.I.toFixed(1) + ' LUFS' : 'short'}, ${ck.problems.length ? '✗ ' + ck.problems.join('; ') : 'ok'}`);
  };
  const fail = (l, why) => { fails++; rep[l.id] = Object.assign(rep[l.id] || { id: l.id }, { failed: why }); console.log(`[voice en] ${l.id}: FAILED (${why})`); };
  // ---------------------------------------------------------------- reprocess from the raw takes (no API)
  if (reproc) {
    run.mode = 'reprocess';
    for (const l of lines) {
      const rawFile = path.join(rawDir, l.id + '.wav');
      if (!fs.existsSync(rawFile)) { console.log(`[voice en] ${l.id}: no raw take in ${rawDir}`); continue; }
      run.lines++;
      finish(l, speakerOf(C, l), fs.readFileSync(rawFile), null);
    }
    usage.runs.pop();
    save();
    console.log(`[voice en] reprocessed ${run.lines} line(s), ${fails} with problems`);
    return fails ? 1 : 0;
  }
  const todo = lines.filter((l) => argv.includes('--force') || !fs.existsSync(path.join(outDir, l.id + '.ogg')));
  const open0 = [];
  for (const l of todo) { if (allowed(l) > 0) open0.push(l); else fail(l, `already had ${attempts(l)} audio requests (the limit is ${MAX_EN_ATTEMPTS}; --allow-more to override)`); }
  run.lines = open0.length;
  const direct = argv.includes('--direct') || (open0.length <= 3 && !argv.includes('--batch')) || arg('--resume-batch');
  run.mode = arg('--resume-batch') ? 'resume' : direct ? 'direct' : 'batch';
  console.log(`[voice en] ${lines.length} line(s) listed, ${open0.length} to make (${run.mode}); listening checks off; ${MAX_EN_ATTEMPTS} audio requests per line at most`);
  save();
  if (arg('--resume-batch')) {
    // results of a batch made earlier (keys <id>#<attempt>): no new request
    const res = await GA.batchGenerate(TTS_MODEL, [], { resume: arg('--resume-batch'), log: (x) => console.log('  ' + x) });
    const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
    for (const [key, got] of res) {
      const l = byId[String(key).split('#')[0]];
      if (!l) continue;
      const p = got.json ? GA.partsOf(got.json) : { audio: [] };
      if (!p.audio.length) { console.log(`  ${l.id}: no audio in the batch result`); continue; }
      const sp = speakerOf(C, l);
      finish(l, sp, p.audio[0].bytes, localTake(p.audio[0].bytes, l, sp, o));
    }
    save();
    return fails ? 1 : 0;
  }
  if (direct) {
    // one generateContent call per take (10 / min per model: paced here, a 429 is waited out and resent — no audio is made for it)
    const sent = [];
    const pace = async () => { for (;;) { const now = Date.now(); while (sent.length && now - sent[0] > 61000) sent.shift(); if (sent.length < 9) { sent.push(now); return; } await GA.sleep(61000 - (now - sent[0]) + 200); } };
    for (const l of open0) {
      const sp = speakerOf(C, l);
      let best = null;
      const n = allowed(l);
      for (let t = 0; t < n && !(best && best.ev.good); t++) {
        let p;
        try {
          await pace();
          bump(l); save();
          p = GA.partsOf(await GA.geminiPost(TTS_MODEL, requestBody(C, l), { timeoutSec: 180, retryOn: '429', tries: 12, onAttempt: onAttempt(l.id), log: (x) => process.stdout.write(x.trim() + ' ') }));
        } catch (e) {
          if (e.daily) { rep[l.id].attempts--; run.requests--; usage.requests--; if (rep[l.id].attempts >= 1) { run.retries--; usage.retries--; } save(); console.log(`[voice en] daily request quota reached — stopping (${GA.redact(e.message).slice(0, 160)}); run again later or use the Batch API`); return 1; }
          console.log(`  ${l.id}: request failed: ${GA.redact(e.message || e).slice(0, 200)}`);
          continue;
        }
        if (!p.audio.length) { console.log(`  ${l.id}: no audio (${p.finishReason || p.blocked || p.text})`); continue; }
        const ev = localTake(p.audio[0].bytes, l, sp, o);
        if (!best || ev.q > best.ev.q) best = { w: p.audio[0].bytes, ev };
        if (!ev.good && t + 1 < n) console.log(`  ${l.id}: retry once (${ev.why})`);
      }
      if (best) finish(l, sp, best.w, best.ev); else fail(l, 'no audio');
      save();
    }
  } else {
    // Batch API: chunks of --batch-size requests, 1 take per line; round 2 only for the lines whose take failed a local check
    // or had no audio (and that still have a request left)
    const size = +arg('--batch-size', 100), conc = Math.max(1, +arg('--concurrency', 2));
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const best = new Map();
    let open = open0.slice();
    for (let r = 0; r < MAX_EN_ATTEMPTS && open.length; r++) {
      const chunks = [];
      for (let i = 0; i < open.length; i += size) chunks.push(open.slice(i, i + size));
      console.log(`[voice en] round ${r + 1}: ${open.length} line(s) in ${chunks.length} batch(es)`);
      const results = new Map(), lost = new Set();
      let next = 0;
      const worker = async () => {
        while (next < chunks.length) {
          const ci = next++, chunk = chunks[ci], name = `lc-voice-en-${stamp}-r${r + 1}-c${ci + 1}`;
          const reqs = chunk.map((l) => ({ key: `${l.id}#${attempts(l) + 1}`, request: requestBody(C, l) }));
          const rec = { display: name, requests: reqs.length, t: new Date().toISOString(), name: null, state: 'creating' };
          try {
            const res = await GA.batchGenerate(TTS_MODEL, reqs, {
              name, safe: true, maxWaitMin: 300, log: (x) => console.log(`  [c${ci + 1}] ${x}`), onAttempt: onAttempt('batch:' + name),
              onCreate: (bn) => { rec.name = bn; rec.state = 'created'; usage.batches.push(rec); for (const l of chunk) bump(l); logUse({ purpose: 'tts-batch', batch: bn, requests: reqs.length }); save(); },
            });
            rec.state = 'fetched';
            for (const [k, v] of res) results.set(k, v);
          } catch (e) {
            console.log(`  [c${ci + 1}] batch failed: ${GA.redact(e.message || e).slice(0, 240)}`);
            if (rec.name) { rec.state = 'not fetched (node tools/voice_tts.js --lang en --resume-batch ' + rec.name + ')'; for (const l of chunk) lost.add(l.id); }
            else if (!e.notCreated) { rec.state = 'unknown'; usage.batches.push(rec); for (const l of chunk) { bump(l); lost.add(l.id); } }
            save();
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(conc, chunks.length) }, worker));
      const again = [];
      for (const l of open) {
        if (lost.has(l.id)) { fail(l, 'its batch was not fetched — not requested again (see _usage.batches, --resume-batch)'); continue; }
        const sp = speakerOf(C, l);
        const got = results.get(`${l.id}#${attempts(l)}`);
        let ev = null;
        if (!got || got.error) console.log(`  ${l.id}: ${got ? 'error ' + got.error.slice(0, 120) : 'no answer'}`);
        else {
          const p = GA.partsOf(got.json);
          if (!p.audio.length) console.log(`  ${l.id}: no audio (${p.finishReason || p.blocked || ''})`);
          else {
            try { ev = localTake(p.audio[0].bytes, l, sp, o); } catch (e) { ev = { good: false, q: -9, why: 'cannot decode: ' + e.message }; }
            const b = best.get(l.id);
            if (!b || ev.q > b.ev.q) best.set(l.id, { w: p.audio[0].bytes, ev });
          }
        }
        if (ev && ev.good) { finish(l, sp, best.get(l.id).w, best.get(l.id).ev); continue; }
        if (allowed(l) > 0) { if (ev) console.log(`  ${l.id}: retry once (${ev.why})`); again.push(l); continue; }
        const b = best.get(l.id);
        if (b) finish(l, sp, b.w, b.ev); else fail(l, 'no audio');
      }
      save();
      open = again;
    }
    for (const l of open) { const b = best.get(l.id); if (b) finish(l, speakerOf(C, l), b.w, b.ev); else fail(l, 'no audio'); }
  }
  save();
  console.log(`[voice en] this run: ${run.requests} audio request(s) (${run.retries} retries), ${run.httpAttempts} HTTP request(s) (${run.rateLimited} rate-limited); all runs: ${usage.requests} audio requests, ${usage.retries} retries`);
  console.log(`[voice en] ${run.lines} line(s), ${fails} with problems → ${path.relative(ROOT, repFile)}`);
  return fails ? 1 : 0;
}

module.exports = { judge, transcribe, loadCasting, allLines, buildPrompt, requestBody, similarity, spoken, main, FX, enCasting, enLines, estimateEn, enCastProblems, localTake, readIds, check, processWav, speakerOf, said };
if (require.main === module) main(process.argv.slice(2), process.env).then((c) => { process.exitCode = c; }, (e) => { console.error('[voice] ' + GA.redact(e.message || e)); process.exitCode = 1; });
