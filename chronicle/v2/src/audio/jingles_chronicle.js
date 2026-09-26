// Jingles new in ルミナス・クロニクル (DESIGN §11.10.5): superrare chapter recruit.
// One-shot fanfares (jingle:true): a jingle ends with its hand-written parts; arranged parts
// are cut there. Original; format documented at the top of src/core/audio.js.
(function (R) {
  'use strict';
  const M = {};

  // superrare — a one-of-a-kind item (drop / steal / chest). A major, ♩=144, ≈3.3 s: the
  // trumpet leaps up the triad to the high A while the glockenspiel throws sparks, horns and
  // choir swell underneath, and it lands broad on the tonic with a bell. Grander than `rare`.
  M.superrare = {
    jingle: true, tempo: 144, key: 'A', gain: 0.75,
    echo: { time: 0.2, fb: 0.36, wet: 0.3, lp: 5000 },
    chords: 'A*2 D | E7sus4 E7 A*2 |',
    ch: [
      { inst: 'trumpet', vol: 1, pan: 0.05, echo: 0.3, mml: 'o4 q7 e8. a16 >c+8. e16 a4 f+4 | e8 a8 g+8 b8 q8 a2 |' },
      { inst: 'horn', harm: 0, oct: -1, min: 48, vol: 0.5, pan: -0.3, echo: 0.25 },
      { inst: 'glock', vol: 0.5, pan: 0.35, echo: 0.4, mml: 'o6 l32 e a >c+ e< r8 r4 r4 r4 | r2 l16 c+ e a >c+ e4< |' },
      { inst: 'bell', vol: 0.35, pan: -0.4, echo: 0.5, mml: 'o5 r1 | r2 a2 |' },
      { inst: 'choir', vol: 0.3, pan: 0.2, echo: 0.3, pat: 'C2 C2', range: [57, 74], voices: 3 },
      { inst: 'strings', vol: 0.42, pan: 0.3, echo: 0.25, q: 7, pat: 'l4 C C C C', range: [55, 74], voices: 3 },
      { inst: 'bass', vol: 0.75, q: 6, range: [36, 52], pat: 'l4 R R R R' },
      { inst: 'timp', vol: 0.55, mml: 'o2 a4 r4 a4 d4 | e4 e4 a2 |' },
      { inst: 'drums', vol: 0.5, echo: 0.15, mml: '{kc}4 r4 s8 s8 s4 | k8 s16 s16 s8 s8 {ic}2 |' },
    ],
  };

  // chapter — a chapter is written into the chronicle. E minor → G, 3/4, ♩=90, ≈4 s: the
  // celesta sings the first four notes of 「語り部の主題」 (E F# G B) over the harp's page turn,
  // then climbs a scale into G; bells answer, low strings hold it up.
  M.chapter = {
    jingle: true, tempo: 90, meter: '3/4', key: 'G', gain: 0.97,
    echo: { time: 0.3, fb: 0.42, wet: 0.36, lp: 5000 },
    chords: 'Em | C D G |',
    ch: [
      { inst: 'celesta', vol: 1, pan: 0.1, echo: 0.45, mml: 'o5 q8 e4. f+8 g8 b8 | >c8 d8 e8 f+8 g4< |' },
      { inst: 'bell', vol: 0.45, pan: -0.3, echo: 0.5, mml: 'o6 r4 r8 g8 r8 b8 | r4 r4 {g>d}4 |' },
      { inst: 'harp', vol: 0.5, pan: 0.35, echo: 0.4, range: [40, 55], pat: "l8 R F O T' F' O'" },
      { inst: 'strings', vol: 0.4, pan: -0.15, echo: 0.3, pat: 'C2.', range: [43, 60], voices: 3 },
      { inst: 'contra', vol: 0.7, range: [28, 43], pat: 'R2.' },
      { inst: 'drums', vol: 0.45, echo: 0.4, mml: 'r2. | r4 r4 i4 |' },
    ],
  };

  // recruit — someone joins the party. D major 2/4, ♩=120, ≈2 s: two warm bars, flute over
  // rolling harp, a friendly turn home.
  M.recruit = {
    jingle: true, tempo: 120, meter: '2/4', key: 'D', gain: 0.85,
    echo: { time: 0.25, fb: 0.3, wet: 0.28, lp: 4000 },
    chords: 'D | A7 D |',
    ch: [
      { inst: 'flute', vol: 1, pan: 0.05, echo: 0.3, mml: 'o5 q7 d8 f+8 a8 >d8 | c+8 <a8 q8 >d4< |' },
      { inst: 'flute', harm: 0, vol: 0.35, pan: -0.3, echo: 0.3 },
      { inst: 'harp', vol: 0.55, pan: 0.3, echo: 0.35, range: [45, 60], pat: "l16 R F O T' F' T' O F" },
      { inst: 'strings', vol: 0.3, pan: -0.15, echo: 0.3, pat: 'C4 C4', range: [55, 72], voices: 3 },
      { inst: 'bass', vol: 0.6, q: 6, range: [36, 52], pat: 'l4 R R' },
      { inst: 'drums', vol: 0.4, echo: 0.3, mml: 'r4 r4 | r4 i4 |' },
    ],
  };

  Object.assign(R.DB.music, M);
})(window.RPG);
