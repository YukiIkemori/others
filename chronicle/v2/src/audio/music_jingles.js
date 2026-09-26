// Jingles (one-shot fanfares, DESIGN §3): victory levelup jobup item keyitem
// inn save gameover rare. Original; format documented in src/core/audio.js.
// A jingle ends with its hand-written parts (arranged parts are cut there).
(function (R) {
  'use strict';
  const M = {};

  // victory — G major trumpet fanfare, rising arpeggio then a bright close (~4 s)
  M.victory = {
    jingle: true, tempo: 144, key: 'G', gain: 0.77,
    echo: { time: 0.208, fb: 0.28, wet: 0.25, lp: 3500 },
    chords: 'G | C D | G |',
    ch: [
      { inst: 'trumpet', vol: 1, pan: 0.05, echo: 0.3, mml: 'o5 q7 d8. d16 g8. g16 b4 >d4< | >c8 <b8 a8 g8 f+4 a4 | q8 b2' },
      { inst: 'horn', harm: 0, oct: -1, min: 48, vol: 0.55, pan: -0.3, echo: 0.25 },
      { inst: 'strings', vol: 0.5, pan: 0.3, echo: 0.2, q: 6, range: [55, 74], voices: 3, pat: 'l4 C C C C' },
      { inst: 'bass', vol: 0.8, q: 6, range: [36, 55], pat: 'l4 R R R R' },
      { inst: 'timp', vol: 0.6, mml: 'o2 g4 r4 d4 r4 | c4 r4 d4 d4 | g2' },
      { inst: 'drums', vol: 0.6, echo: 0.1, mml: '{kc}4 s8. s16 s4 s8 s8 | k4 s8. s16 k4 s4 | {kc}2' },
    ],
  };

  // levelup — B-flat: sparkling arpeggio up, a snappy turn, landing on the fifth (~2.4 s)
  M.levelup = {
    jingle: true, tempo: 160, key: 'Bb', gain: 0.84,
    echo: { time: 0.188, fb: 0.3, wet: 0.25, lp: 4000 },
    chords: 'Bb Eb/Bb | Bb |',
    ch: [
      { inst: 'square', vol: 1, pan: 0.05, echo: 0.3, mml: 'o4 q7 l16 f b- >d f b- f d <b- >e-8 f8 g8. f16 | q8 f2' },
      { inst: 'brass', harm: 0, vol: 0.5, pan: -0.3, echo: 0.2 },
      { inst: 'glock', vol: 0.35, pan: 0.4, echo: 0.3, mml: 'o6 l16 r4 d f b- >d< r2 | f2' },
      { inst: 'strings', vol: 0.45, pan: 0.3, echo: 0.2, q: 5, range: [55, 72], voices: 3, pat: 'l4 C r C C' },
      { inst: 'bass', vol: 0.8, q: 5, range: [34, 53], pat: 'l4 R r R R' },
      { inst: 'drums', vol: 0.55, echo: 0.1, mml: '{kc}8 r8 s8 r8 k8 s16 s16 s8 s16 s16 | {kc}2' },
    ],
  };

  // jobup — D lydian bells & celesta climbing into a shimmering high F-sharp (~3 s)
  M.jobup = {
    jingle: true, tempo: 112, key: 'D', gain: 0.86,
    echo: { time: 0.268, fb: 0.4, wet: 0.35, lp: 5000 },
    chords: 'D E/D D*2 | D |',
    ch: [
      { inst: 'celesta', vol: 1, pan: 0.1, echo: 0.4, mml: 'o5 q8 l16 d f+ a >d< e g+ b >e f+2 | a2' },
      { inst: 'bell', harm: 0, vol: 0.4, pan: -0.3, echo: 0.45 },
      { inst: 'harp', vol: 0.45, pan: 0.35, echo: 0.35, range: [50, 66], voices: 4, pat: "l16 a b c d a' b' c' d'" },
      { inst: 'strings', vol: 0.4, pan: -0.15, echo: 0.3, pat: 'C1', range: [57, 74], voices: 4 },
      { inst: 'tri', vol: 0.7, range: [38, 50], pat: 'R1' },
      { inst: 'drums', vol: 0.5, echo: 0.3, mml: 'i2 r4 i4 | {ic}2' },
    ],
  };

  // item — C major "got it!" flourish (~1.7 s)
  M.item = {
    jingle: true, tempo: 140, key: 'C', gain: 0.9,
    echo: { time: 0.214, fb: 0.28, wet: 0.25, lp: 4000 },
    chords: 'C*2 G C |',
    ch: [
      { inst: 'square', vol: 1, pan: 0.05, echo: 0.3, mml: 'o5 q7 c8 e8 g8 >c8 <b8 q8 >c4.< |' },
      { inst: 'glock', harm: 0, min: 72, vol: 0.4, pan: 0.35, echo: 0.35 },
      { inst: 'strings', vol: 0.45, pan: -0.3, echo: 0.2, q: 6, range: [55, 72], voices: 3, pat: 'l4 C C C C' },
      { inst: 'bass', vol: 0.75, q: 6, range: [36, 52], pat: 'l4 R R R R' },
      { inst: 'drums', vol: 0.5, echo: 0.1, mml: 'k4 s8 s8 {ks}8 s8 {kc}4 |' },
    ],
  };

  // keyitem — E-flat brass fanfare, grander, rising to the high tonic (~5 s)
  M.keyitem = {
    jingle: true, tempo: 116, key: 'Eb', gain: 0.73,
    echo: { time: 0.259, fb: 0.32, wet: 0.28, lp: 3500 },
    chords: 'Eb | Ab Bb7 | Eb |',
    ch: [
      { inst: 'trumpet', vol: 1, pan: 0.05, echo: 0.3, mml: 'o4 q7 g8. b-16 >e-8. g16 b-4. a-8 | a-4 >c4 <b-4 >d4 | q8 e-2<' },
      { inst: 'horn', harm: 0, oct: -1, min: 48, vol: 0.55, pan: -0.3, echo: 0.25 },
      { inst: 'strings', vol: 0.5, pan: 0.3, echo: 0.25, pat: 'C2 C2', range: [55, 74], voices: 4 },
      { inst: 'harp', vol: 0.4, pan: -0.4, echo: 0.3, range: [51, 63], pat: "l16 R F O T' F' T' O F" },
      { inst: 'contra', vol: 0.8, range: [36, 51], pat: 'R2 R2' },
      { inst: 'timp', vol: 0.6, mml: 'o2 e-4 r4 b-4 r4 | a-4 r4 b-8 b-8 b-4 | [e-32]8 e-4' },
      { inst: 'drums', vol: 0.55, echo: 0.15, mml: '{kc}1 | r2 s16 s16 s16 s16 s8 s8 | {kc}2' },
    ],
  };

  // inn — F major 3/4 lullaby on flute and harp (~6 s)
  M.inn = {
    jingle: true, tempo: 88, meter: '3/4', key: 'F', gain: 0.89,
    echo: { time: 0.341, fb: 0.35, wet: 0.32, lp: 3000 },
    chords: 'F | C7 | F |',
    ch: [
      { inst: 'flute', vol: 1, pan: 0.05, echo: 0.35, mml: 'o6 q7 c4. <a8 f4 | g4. e8 c4 | q8 f2. |' },
      { inst: 'clarinet', harm: 0, vol: 0.4, pan: -0.3, echo: 0.3 },
      { inst: 'harp', vol: 0.55, pan: 0.3, echo: 0.35, range: [48, 60], pat: "l8 R F O T' O F" },
      { inst: 'strings', vol: 0.3, pan: -0.15, echo: 0.3, pat: 'C2.', range: [55, 72], voices: 3 },
      { inst: 'bell', vol: 0.25, pan: 0.4, echo: 0.5, mml: 'o6 r2. | r2. | f2. |' },
      { inst: 'tri', vol: 0.7, range: [36, 53], pat: 'R2.' },
    ],
  };

  // save — calm organ & bell cadence (~3.3 s)
  M.save = {
    jingle: true, tempo: 108, key: 'G', gain: 0.92,
    echo: { time: 0.278, fb: 0.35, wet: 0.3, lp: 3500 },
    chords: 'C D/C | G/B |',
    ch: [
      { inst: 'bell', vol: 1, pan: 0.05, echo: 0.4, mml: 'o5 q8 g4 e4 a4 f+4 | g2' },
      { inst: 'celesta', harm: 0, vol: 0.45, pan: -0.3, echo: 0.4 },
      { inst: 'organ', vol: 0.4, pan: 0.2, echo: 0.3, pat: 'C2', range: [55, 72], voices: 4 },
      { inst: 'harp', vol: 0.4, pan: 0.35, echo: 0.35, range: [47, 60], pat: "l8 R F O T'" },
      { inst: 'contra', vol: 0.7, range: [35, 50], pat: 'R2' },
    ],
  };

  // gameover — A minor, a falling oboe line over dark strings (~6.7 s)
  M.gameover = {
    jingle: true, tempo: 72, key: 'Am', gain: 0.93,
    echo: { time: 0.417, fb: 0.4, wet: 0.35, lp: 2200 },
    chords: 'Am F | E7 Am |',
    ch: [
      { inst: 'oboe', vol: 1, pan: 0.05, echo: 0.35, mml: 'o5 q7 e4. d8 c4 <a4 | b4. g+8 q8 a2 |' },
      { inst: 'clarinet', harm: 0, vol: 0.4, pan: -0.3, echo: 0.3 },
      { inst: 'strings', vol: 0.5, pan: 0.25, echo: 0.35, pat: 'C2', range: [52, 69], voices: 4 },
      { inst: 'harp', vol: 0.35, pan: -0.35, echo: 0.4, range: [45, 57], pat: "l8 R F O T'" },
      { inst: 'contra', vol: 0.8, range: [33, 48], pat: 'R2' },
      { inst: 'timp', vol: 0.45, mml: 'o2 a4 r2. | e4 r4 a2 |' },
    ],
  };

  // rare — glittering glockenspiel run and a bright E major chord (~2 s)
  M.rare = {
    jingle: true, tempo: 150, key: 'E', gain: 0.79,
    echo: { time: 0.2, fb: 0.4, wet: 0.35, lp: 6000 },
    chords: 'E | B7 E x*2 |',
    ch: [
      { inst: 'glock', vol: 1, pan: 0.05, echo: 0.4, mml: 'o5 q8 l32 e g+ b >e g+ b >e <b l8 >e <g+ e4 <b4 | >d+8 f+8 e4' },
      { inst: 'celesta', harm: 0, vol: 0.45, pan: -0.3, echo: 0.4 },
      { inst: 'strings', vol: 0.45, pan: 0.3, echo: 0.3, pat: 'C1', range: [56, 71], voices: 3 },
      { inst: 'bass', vol: 0.7, q: 6, range: [35, 52], pat: 'l4 R R R R' },
      { inst: 'drums', vol: 0.5, echo: 0.3, mml: '{ic}4 r4 r2 | i8 i8 {ic}4' },
    ],
  };

  Object.assign(R.DB.music, M);
})(window.RPG);
