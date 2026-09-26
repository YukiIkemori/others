// Music (dungeons): dungeon, cave, tower, pyramid, ice, volcano, lastdungeon (+ Crest's abyss as material).
// Original compositions; format documented at the top of src/core/audio.js.
(function (R) {
  'use strict';
  const M = {};

  // ================================================================ dungeon
  // D minor, 100 bpm, tense: pizzicato ostinato, oboe line with chromatic
  // neighbours, lament bass in the bridge, low tom heartbeat. A B A' (24 bars).
  M.dungeon = {
    tempo: 100, key: 'Dm', gain: 0.83,
    echo: { time: 0.3, fb: 0.35, wet: 0.28, lp: 2400 },
    chords: `
      L @A Dm | Bb/D | Gm/D | A7/C# | Dm | Bb | Em7b5 | A7 |
      @B Dm | Dm/C | Bm7b5 | Bbmaj7 | Gm7 | A7 | Dm | A7 |
      @A Dm | Bb/D | Gm/D | A7/C# | Dm | Bb | Gm6 | A7 |`,
    defs: {
      A6: 'o4 a4. g+8 a2 | b-2. f4 | g4. f+8 g2 | a2 e2 | d4 f4 a4 >d4 | d4 c4 <b-2 |',
      B: 'o5 f4. e8 f4 a4 | a4. g8 f4 c4 | d4. c8 <b4 >d4 | f2. a4 | b-4. a8 g4 f4 | e4. f8 e4 c+4 | d4 a4 f4 d4 | e2. r4 |',
      DR: 'f4 r4 r8 f8 f4 | f4 r4 m8 r8 f4 |',
    },
    ch: [
      { inst: 'oboe', vol: 1, pan: 0.1, echo: 0.3, mml: `
        L q7 $A6 b-4 g4 e2 | c+2. r4 | $B $A6 b-4 g4 e4 g4 | c+2. r4 |` },
      { inst: 'clarinet', harm: 0, vol: 0.38, pan: -0.3, echo: 0.25 },
      { inst: 'pizz', vol: 0.52, pan: 0.3, echo: 0.2, q: 5, range: [38, 52], pat: 'l8 R R F R O R F R' },
      { inst: 'strings', vol: 0.4, pan: -0.15, echo: 0.3, pat: 'C1', range: [50, 67], voices: 3 },
      { inst: 'contra', vol: 0.6, range: [28, 45], pats: { A: 'R1', B: 'l2 R R' } },
      { inst: 'thin', vol: 0.4, pan: 0.45, echo: 0.4, q: 3, range: [74, 86], voices: 3,
        pats: { A: 'l8 r4 c r r4 c r', B: 'l8 r4 b r r4 c r' } },
      { inst: 'drums', vol: 0.6, echo: 0.2, mml: `L l8 [$DR]4 [$DR]4 [$DR]4` },
    ],
  };

  // ================================================================ cave
  // E minor, 72 bpm, echoing & sparse: low drone, dark pad, flute phrases,
  // marimba / celesta drips in a long echo, a distant boom.
  M.cave = {
    tempo: 72, key: 'Em', gain: 1.01,
    echo: { time: 0.42, fb: 0.5, wet: 0.45, lp: 2200 },
    chords: `
      L Em | D/E | Cmaj7 | Bsus4 B | Em | D/E | Am7 | B7 |
      Em | D/E | Cmaj7 | Bsus4 B | Am7 | C/G | F#m7b5 | B7 |`,
    ch: [
      { inst: 'flute', vol: 1, pan: 0.05, echo: 0.5, mml: `
        L o4 q7 b2. r4 | a4. f+8 d2 | g2. e4 | f+2 d+2 | e2 r4 b4 | a2. r4 | >c2 <a4 e4 | d+2. r4 |
        b2. r4 | a4. b8 >d2 | e2. <b4 | >e2 d+2 | c2 <a2 | g2 e2 | f+2 a2 | f+2 d+2 |` },
      { inst: 'celesta', vol: 0.58, pan: 0.45, echo: 0.7, mml: `
        L o6 r4 b8 r8 r2 | r2. f+8 r8 | r4 r8 e8 r2 | r1 | r2 g8 r8 r4 | r4 a8 r8 r2 | r2. c8 r8 | r4 d+8 r8 r2 |
        r4 e8 r8 r2 | r2 d8 r8 r4 | r1 | r4 f+8 r8 r2 | r2. a8 r8 | r4 g8 r8 r2 | r2 c8 r8 r4 | r1 |` },
      { inst: 'marimba', vol: 0.52, pan: -0.45, echo: 0.6, mml: `
        L o5 r1 | r4 d8 r8 r2 | r2 b8 r8 r4 | r2. f+8 r8 | r1 | r2. e8 r8 | r4 e8 r8 r2 | r2 b8 r8 r4 |
        r1 | r4 a8 r8 r2 | r2. g8 r8 | r2 b8 r8 r4 | r4 c8 r8 r2 | r2. e8 r8 | r4 a8 r8 r2 | r2. f+8 r8 |` },
      { inst: 'pad', vol: 0.38, pan: -0.1, echo: 0.4, pat: 'C1', range: [52, 67], voices: 3 },
      { inst: 'contra', vol: 0.6, range: [28, 43], pat: 'R1' },
      { inst: 'drums', vol: 0.5, echo: 0.6, mml: `L [b4 r2. | r1 | r1 | r1 |]4` },
    ],
  };

  // ================================================================ tower
  // B minor, 108 bpm, mysterious & rising: celesta arpeggios climbing an octave
  // per bar, a slow melody that keeps stepping upward, clock-like rims.
  M.tower = {
    tempo: 108, key: 'Bm', gain: 0.8,
    echo: { time: 0.278, fb: 0.38, wet: 0.3, lp: 3500 },
    chords: `
      L Bm | A/C# | D | Em | F#sus4 | F# | Gmaj7 | F#7 |
      Bm | C#m7b5 | D | E | Gmaj7 | A | Bm/F# | F#7 |
      G | A | F#m | Bm | Em7 | A | Dmaj7 | F#7 |`,
    ch: [
      { inst: 'violin', vol: 1, pan: 0.05, echo: 0.35, mml: `
        L o5 q8 d2 f+2 | e2 a2 | f+2 a4 >d4< | g2 b2 | b2 >c+2< | a+1 | b2 f+2 | e2 c+2 |
        f+2 b2 | g2 e2 | a2 >d2< | b2 >e2< | >f+2 d2< | >e2 c+2< | >d2< b2 | a+2 f+2 |
        q7 b4 a4 g4 b4 | >c+4 <b4 a4 >c+4< | >c+2 <a4 f+4 | b2. r4 | g4 b4 >d4 e4< | >c+2 e4 c+4< | >d2 c+4 <a4 | q8 a+2 >c+2< |` },
      { inst: 'flute', harm: 0, vol: 0.4, pan: -0.3, echo: 0.3 },
      { inst: 'celesta', vol: 0.32, pan: 0.35, echo: 0.35, range: [60, 72], voices: 3, pat: "l16 a b c a' b' c' b' a'" },
      { inst: 'strings', vol: 0.35, pan: -0.2, echo: 0.3, pat: 'C1', range: [50, 67], voices: 3 },
      { inst: 'bass', vol: 0.7, q: 7, range: [35, 54], pat: 'l4 R R O R' },
      { inst: 'drums', vol: 0.45, echo: 0.3, mml: `L l8 [k8 r8 x8 r8 z8 r8 x8 r8 |]23 k8 r8 x8 r8 x16 x16 x8 x8 x8 |` },
    ],
  };

  // ================================================================ pyramid
  // E phrygian dominant (the "Hijaz" colour of A harmonic minor), 96 bpm:
  // reed melody with the augmented second, drone, darbuka-style toms.
  M.pyramid = {
    tempo: 96, key: 'Am', gain: 0.89,
    echo: { time: 0.312, fb: 0.35, wet: 0.28, lp: 2800 },
    chords: `
      L E | F | E | F E | Am | Dm | F E | E |
      Am | Dm | E | F | Dm | F | E | E7 |
      Dm | Bb | Gm | A | Dm | Bb | F | E |`,
    defs: {
      DR: 'f8. x16 t8 x8 f8 f8 t8 x8 |',
      DR2: 'f8. x16 t8 x8 f8 x16 x16 t16 t16 x16 x16 |',
    },
    ch: [
      { inst: 'oboe', vol: 1, pan: 0.1, echo: 0.3, mml: `
        L o5 q7 e4 f8 g+8 b4 a8 g+8 | a4 g+8 f8 a4 >c4< | b4 a8 g+8 e4 g+4 | a4 f4 e2 |
        >c4< b8 a8 e4 a4 | f4 e8 d8 a4 f4 | a4 g+8 f8 g+4 b4 | e2. r4 |
        a4. b8 >c4 e4< | >d4. c8 <a4 f4 | g+4. a8 b4 g+4 | a4. g+8 f4 c4 |
        f4 e8 d8 a4 >d4< | >c4. <b8 a4 f4 | g+4 f8 e8 g+4 b4 | >d2 <b2 |
        d4. e8 f4 a4 | b-4. a8 f4 d4 | g4. a8 b-4 >d4< | >c+4 <b-8 a8 e4 a4 | a4. g8 f4 d4 | d4 f4 b-4 f4 | a4 g+8 a8 >c4 <f4 | g+4 f8 e8 b4 e4 |` },
      { inst: 'thin', harm: 0, oct: -1, vol: 0.35, pan: -0.35, echo: 0.3 },
      { inst: 'pizz', vol: 0.5, pan: 0.35, echo: 0.2, q: 5, range: [40, 55], pat: 'l8 R r F r R R F r' },
      { inst: 'organ', vol: 0.3, pan: -0.15, echo: 0.3, pat: 'C1', range: [52, 67], voices: 3 },
      { inst: 'contra', vol: 0.55, range: [28, 45], pat: 'R1' },
      { inst: 'drums', vol: 0.56, echo: 0.15, mml: `L l8 [$DR $DR $DR $DR2]6` },
    ],
  };

  // ================================================================ ice
  // F-sharp minor 3/4, 84 bpm, crystalline: celesta & glockenspiel melody in
  // parallel, harp, bells on the downbeats, triangle, bright echo.
  M.ice = {
    tempo: 84, meter: '3/4', key: 'F#m', gain: 1.02,
    echo: { time: 0.357, fb: 0.4, wet: 0.35, lp: 5000 },
    chords: `
      L F#m | D | Bm | C#7 | F#m | D | E | C#7 |
      D | E | C#m | F#m | Bm | E | A | C#7 |
      A | E/G# | F#m | C#m/E | D | A/C# | Bm7 | C#7 |`,
    defs: {
      MEL: `o6 q8 c+4 <a4 f+4 | a4. f+8 d4 | b4 >d4 f+4 | f2. | c+4 <a4 f+4 | >d4 <a4 f+4 | g+4 b4 >e4 | <g+2. |
        f+4 a4 >d4 | e2 <b4 | >c+4 e4 <g+4 | a2. | b4 >d4 f+4 | e2 <b4 | >c+2 <a4 | g+2 e+4 |
        o5 e4 a4 >c+4< | b2 g+4 | a4 >c+4 f+4< | >e2.< | >d4 <a4 f+4 | e4 c+4 <a4> | d4 f+4 a4 | g+2 e+4 |`,
    },
    ch: [
      { inst: 'celesta', vol: 1, pan: 0.1, echo: 0.4, mml: 'L $MEL' },
      { inst: 'glock', vol: 0.26, pan: -0.3, echo: 0.4, mml: 'L k12 $MEL' },
      { inst: 'flute', harm: 0, vol: 0.32, pan: -0.2, echo: 0.35 },
      { inst: 'harp', vol: 0.41, pan: 0.35, echo: 0.35, range: [42, 54], pat: "l8 R F O T' O F" },
      { inst: 'bell', vol: 0.33, pan: -0.4, echo: 0.5, range: [66, 78], voices: 3, pat: "c'2." },
      { inst: 'strings', vol: 0.3, pan: -0.1, echo: 0.3, pat: 'C2.', range: [54, 69], voices: 3 },
      { inst: 'tri', vol: 0.54, range: [33, 50], pat: 'R2.' },
      { inst: 'drums', vol: 0.45, echo: 0.4, mml: `L [i2. | r2. |]12` },
    ],
  };

  // ================================================================ volcano
  // C minor, 140 bpm, driving & heavy: pumping synth bass, brass melody, string
  // stabs, toms. Intro 2 + A A' B A' (34 bars).
  M.volcano = {
    tempo: 140, key: 'Cm', gain: 0.8,
    echo: { time: 0.214, fb: 0.25, wet: 0.18, lp: 2600 },
    chords: `
      @I Cm | Cm |
      L @A Cm | Cm | Ab | Bb | Cm | Cm | Fm | G7 |
      Cm | Cm | Ab | Bb | Cm | Cm | Fm G7 | Cm |
      @B Ab | Bb | Gm | Cm | Ab | Bb | G | G7 |
      @A Cm | Cm | Ab | Bb | Cm | Cm | Fm G7 | Cm |`,
    defs: {
      A6: 'o4 c4 c8 d8 e-4 g4 | g8 f8 e-8 d8 c2 | c4 c8 d8 e-4 a-4 | b-8 a-8 g8 a-8 f2 | g4 g8 a-8 g4 >c4 | e-8 d8 c8 <b-8 g2 |',
      A: '$A6 a-4 g8 f8 c4 f4 | g4 f4 d4 <b4> |',
      A2: '$A6 a-4 f4 g4 b4 | >c2.< r4 |',
      B: 'o4 e-2 a-4 >c4 | d2 <b-4 f4 | g2 b-4 >d4 | e-2 c4 <g4 | a-2 >c4 e-4 | f2 d4 <b-4 | >d2 <b4 g4 | f2 d4 <b4> |',
      DA: '{kc}8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 s16 s16 t16 t16 m16 m16 |',
      DB: '{kc}8 h8 s8 h8 k8 h8 s8 k8 | k8 h8 s8 h8 k8 h8 s8 k8 | k8 h8 s8 h8 k8 h8 s8 k8 | k8 s8 t8 t8 m8 m8 f8 f8 |',
    },
    ch: [
      { inst: 'brass', vol: 1, pan: 0.05, echo: 0.2, mml: `
        o4 q7 c8 r8 c8 r8 c8 c8 r4 | c8 r8 c8 r8 <g8 a-8 g8 b8> |
        L $A $A2 $B $A2` },
      { inst: 'horn', harm: 0, vol: 0.5, pan: -0.3, echo: 0.2 },
      { inst: 'strings', vol: 0.7, pan: 0.3, echo: 0.15, q: 3, range: [55, 72], voices: 3,
        pats: { I: 'l8 C r C r C C r4', A: 'l8 C r r C r r C r', B: 'l8 C r C r r C r C' } },
      { inst: 'synbass', vol: 0.7, q: 6, range: [31, 50], pat: 'l8 !R R R R !R R O R' },
      { inst: 'timp', vol: 0.6, echo: 0.1, mml: `
        o2 c8 r8 c8 r8 c8 c8 r4 | c8 r8 c8 r8 [g16]8 |
        L [c4 r2. | r1 | a-4 r2. | b-4 r2. | c4 r2. | r1 | f4 r2. | g4 r4 g8 g8 g4 |]2
        a-4 r2. | b-4 r2. | g4 r2. | c4 r2. | a-4 r2. | b-4 r2. | g4 r2. | [g16]8 g4 g4 |
        c4 r2. | r1 | a-4 r2. | b-4 r2. | c4 r2. | r1 | f4 r4 g4 r4 | c4 r2. |` },
      { inst: 'drums', vol: 0.44, echo: 0.08, mml: `
        {kc}8 r8 {ks}8 r8 {ks}8 {ks}8 r4 | {ks}8 r8 {ks}8 r8 l16 t t m m f f f f l8 |
        L $DA $DA $DA $DA $DB $DB $DA $DA` },
    ],
  };

  // ================================================================ lastdungeon
  // G minor, 76 bpm, dark & grand: organ theme over a chromatic descending bass,
  // choir bridge, brass harmony, timpani and gong. A A' B (24 bars).
  M.lastdungeon = {
    tempo: 76, key: 'Gm', gain: 0.84,
    echo: { time: 0.395, fb: 0.4, wet: 0.35, lp: 2400 },
    chords: `
      L @A Gm | GmM7/F# | Gm7/F | Em7b5 | Ebmaj7 | Cm/Eb | Dsus4 | D7 |
      Gm | GmM7/F# | Gm7/F | Em7b5 | Eb | Cm | Am7b5 D7 | Gm |
      @B Cm | F | Bb | Eb | Am7b5 | D7 | Gm | D7 |`,
    ch: [
      { inst: 'organ', vol: 1, pan: 0.05, echo: 0.35, mml: `
        L o5 q8 d2 g2 | b-1 | d2 f2 | e2 g2 | g4. f8 e-4 d4 | c2 e-4 g4 | g2 a2 | f+1 |
        d2 g2 | b-1 | d2 f2 | e2 g2 | g4 b-4 >e-4 <b-4 | >c2 <g4 e-4 | e-4 c4 f+4 a4 | g1 |
        @violin e-4. d8 c4 g4 | a2 f4 c4 | b-4. a8 b-4 >d4 | e-2 <b-4 g4 | >c2 e-2 | d2 c4 <a4 | b-2 g2 | f+2 a2 |` },
      { inst: 'brass', harm: 0, oct: -1, vol: 0.45, pan: -0.3, echo: 0.3 },
      { inst: 'choir', vol: 0.4, pan: 0.25, echo: 0.4, pat: 'C1', range: [55, 72], voices: 3 },
      { inst: 'strings', vol: 0.5, pan: -0.2, echo: 0.3, range: [50, 64], voices: 3, pats: { A: 'l4 a b c b', B: 'l8 a b c b a b c b' } },
      { inst: 'contra', vol: 0.8, range: [28, 50], pat: 'l2 R R' },
      { inst: 'timp', vol: 0.55, echo: 0.2, mml: `
        L o2 g4 r2. | r1 | r1 | e4 r2. | e-4 r2. | r1 | d4 r4 d8 d8 d4 | d4 r4 [d32]8 d4 |
        g4 r2. | r1 | r1 | e4 r2. | e-4 r2. | c4 r2. | a4 r4 d4 r4 | g4 r2. |
        c4 r2. | f4 r2. | b-4 r2. | e-4 r2. | a4 r2. | d4 r2. | g4 r2. | d8 d8 d4 [d32]8 d4 |` },
      { inst: 'drums', vol: 0.5, echo: 0.4, mml: `
        L g1 | r1 | r1 | r1 | b1 | r1 | r1 | r1 | g1 | r1 | r1 | r1 | b1 | r1 | r1 | r1 |
        {gc}1 | r1 | r1 | r1 | b1 | r1 | r1 | b4 r4 b4 b4 |` },
    ],
  };

  // ================================================================ abyss (Crest's post-game) — material only
  // Chronicle has no `abyss` id (DESIGN §11.11.4; its post-game is `postgame`), so this track
  // is kept unregistered as material in R.Audio.MATERIAL (like jobup's melody: reusable, never
  // called). F minor, 66 bpm, vast and cold: a slow heartbeat, a choir drone, a celesta
  // line that keeps sinking by half steps, a low horn answer. A (16) B (8).
  const ABYSS = {
    tempo: 66, key: 'Fm', gain: 0.86,
    echo: { time: 0.455, fb: 0.5, wet: 0.42, lp: 2000 },
    chords: `
      L @A Fm | Dbmaj7 | Eb | Fm | Bbm | Gbmaj7 | C7 | C7 |
      Fm | Dbmaj7 | Ab | Dbmaj7 | Bbm7 | Bbm | Fm C7 | Fm |
      @B Db | Cm | Bbm | Ab | Bbm | Fm | G7b9 | C7 |`,
    ch: [
      { inst: 'celesta', vol: 0.9, pan: 0.15, echo: 0.5, mml: `
        L o5 q6 c4. <b8 >c2 | e-4 d-4 c2 | <b-4. a-8 g2 | f2 a-4 >c4 |
        d-4. c8 <b-2 | a-4 g-4 f2 | g2 e4 g4 | e1 |
        >c4. <b8 >c2 | f4 e-4 d-2 | c4. <b-8 a-2 | f2 >c4 f4 |
        f4. e-8 d-2 | d-2 <b-2 | a-4 f4 e4 g4 | f1 |
        @violin o5 a-4. g8 f4 a-4 | g2 e-4 g4 | f4. e-8 d-4 f4 | e-2 c4 e-4 |
        d-4. c8 <b-4 >d-4 | c2 <a-4 f4 | a-4 b4 >d4 f4 | e2 <b-4 g4 |` },
      { inst: 'horn', harm: 0, vol: 0.35, pan: -0.3, echo: 0.35 },
      { inst: 'choir', vol: 0.45, pan: -0.1, echo: 0.5, pat: 'C1', range: [53, 70], voices: 3 },
      { inst: 'strings', vol: 0.32, pan: 0.3, echo: 0.4, range: [60, 76], voices: 3, pats: { A: 'l2 a c', B: 'l4 a b c b' } },
      { inst: 'contra', vol: 0.75, range: [28, 45], pats: { A: 'R1', B: 'l2 R F' } },
      { inst: 'drums', vol: 0.55, echo: 0.35, mml: `
        L [b8 r8 b4 r2]7 g1 | [b8 r8 b4 r2]7 g1 |
        [b8 r8 b4 r4 i4]6 b8 b8 b4 r2 | g1 |` },
    ],
  };

  Object.assign(R.DB.music, M);
  R.Audio.MATERIAL = Object.assign(R.Audio.MATERIAL || {}, { abyss: ABYSS });
})(window.RPG);
