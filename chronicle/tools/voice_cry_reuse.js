#!/usr/bin/env node
// Which voice lines are pure cries? → design/voice/cry_reuse.txt   (owner 2026-10-10: "叫び声は日本語でも英語でも中国語でも同じ")
//
//   node tools/voice_cry_reuse.js           (re)write design/voice/cry_reuse.txt
//   node tools/voice_cry_reuse.js --check   only check that the file is current (exit 1 if not)
//
// A pure cry has no real words: grunts, kiai and screams such as 「はっ！」「ぐっ……」「うわあっ！」「せいっ！」.
// The Mandarin and Korean versions do not record these: the game plays the Japanese file in every language (an explicit alias
// in the runtime, see v2/src/core/media.js and v2/tools/build.js: RPG_MEDIA.voice_zh / voice_ko = {alias: 'voice'}).
// English keeps its own recordings of them (made before the rule).
//
// Classification by the Japanese text (design/voice/en_lines.csv, ja_text):
//   1. candidate  = no kanji, only hiragana / katakana and punctuation, at most 6 kana after the punctuation and the small っ
//   2. a candidate is a cry only when its kana (without punctuation and っ) is in CRY_CORES below: interjection kana only.
//      Every other candidate is a short real word or phrase (そこじゃ "right there", くらえ "take this", いたっ "ouch" = 痛い,
//      はいっ "yes", ステップ "step", ミラ a name …): it is NOT reused, the Mandarin / Korean actor says its translation.
//      They are listed as comments at the end of the file so that the owner can move one into CRY_CORES if wanted.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'design', 'voice', 'cry_reuse.txt');
const EN_CSV = path.join(ROOT, 'design', 'voice', 'en_lines.csv');

const PUNCT = /[！？!?…。、，,．.・ー―～〜♪\s「」『』（）()]/g;
const KANJI = /[一-鿿㐀-䶿]/;
const KANA_ONLY = /^[぀-ヿ]+$/;
// the interjection kana of the game's shouts (grunts, kiai, screams, a soft laugh); written without っ and punctuation
const CRY_CORES = new Set([
  'あわわ', 'うあ', 'うう', 'うぐ', 'うわあ', 'うわ', 'えい', 'えいや', 'おう', 'おらぁ', 'おりゃあ', 'きゃあ', 'きゃ', 'くう', 'く',
  'ぐお', 'ぐ', 'ぐぬ', 'ぐは', 'せい', 'せいや', 'せや', 'そりゃあ', 'たあ', 'ち', 'つ', 'てい', 'でりゃ', 'とう', 'とりゃ',
  'ぬう', 'ぬん', 'はあ', 'は', 'ひゃ', 'ふ', 'ふふ', 'ふん', 'やあ', 'や', 'む',
]);
const MAX_KANA = 6;

function core(ja) { return String(ja).replace(PUNCT, '').replace(/[っッ]/g, ''); }
/** → {candidate, cry} for a Japanese line */
function classify(ja) {
  const t = String(ja);
  const stripped = t.replace(PUNCT, '');
  const candidate = !KANJI.test(t) && KANA_ONLY.test(stripped) && stripped.length <= MAX_KANA;
  return { candidate, cry: candidate && CRY_CORES.has(core(t)) };
}
function rows() {
  const { loadRows } = require('./voice_en_lines');
  return loadRows(EN_CSV);
}
function build() {
  const R = rows();
  const cries = [], words = [];
  for (const r of R) {
    const c = classify(r.ja_text);
    if (c.cry) cries.push(r);
    else if (c.candidate) words.push(r);
  }
  const ids = cries.map((r) => r.id).sort();
  const lines = [
    '# Pure cries of the voice set (tools/voice_cry_reuse.js): no recording in the Mandarin (zh) and Korean (ko) versions —',
    '# the game plays the Japanese file in every language (RPG_MEDIA.voice_zh / voice_ko = {alias: "voice"}). English has its own files.',
    `# ${ids.length} ids of ${R.length}. Rule: no kanji, at most ${MAX_KANA} kana, only interjection kana (grunts, kiai, screams); see tools/voice_cry_reuse.js.`,
    ...ids,
    '',
    `# Not reused: ${words.length} kana-only short lines that are real words (they are voiced in zh / ko). To reuse one, add its kana to CRY_CORES.`,
    ...words.sort((a, b) => a.id.localeCompare(b.id)).map((r) => `# ${r.id}  ${r.ja_text}  (${r.en_text})`),
  ];
  return { text: lines.join('\n') + '\n', ids, words };
}
function main(argv) {
  const { text, ids, words } = build();
  if (argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    const ok = cur === text;
    console.log(`[voice_cry_reuse] ${ids.length} cries, ${words.length} kana-only words; ${path.relative(ROOT, OUT)} ${ok ? 'is current' : 'is NOT current (run node tools/voice_cry_reuse.js)'}`);
    return ok ? 0 : 1;
  }
  fs.writeFileSync(OUT, text);
  console.log(`[voice_cry_reuse] ${path.relative(ROOT, OUT)}: ${ids.length} cries reused, ${words.length} kana-only words voiced`);
  return 0;
}
module.exports = { classify, build, CRY_CORES, OUT };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
