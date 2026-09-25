// Music (field & story): title, overworld, sea, town, village, castle, shrine,
// ending. Original compositions in the MML / chord-pattern format documented at
// the top of src/core/audio.js. Each track states its key; the chord line drives
// the arranged bass / pads / arpeggios and the harmony voices (harm:).
(function (R) {
  'use strict';
  const M = {};

  // Main theme 「ひかりの もんしょう」 (D major) — shared by title and ending.
  const TA6 = 'd4. e8 a2 | g4. f+8 e4 d4 | <b4. >c+8 d4 f+4 | e1 | d4. e8 a2 | b4. >c+8 d2< |';
  const THEME = {
    TA: TA6 + ' >c+4. <b8 a4 g4 | f+2. r4 |',
    TB: 'f+4 b4 >d4. c+8< | >c+2< a2 | b4 g4 >d4.< b8 | a2. f+4 | g4 b4 >e4. d8< | >c+4.< b8 a4 g4 | f+4 a4 g+4 b4 | d2 c+2 |',
    TA2: TA6 + ' >d4 <b4 >c+4 <a4 | >d4 <a4 b4 g4 | g4 b4 a4 >c+4< | >d1< |',
  };
  const THEME_CHORDS = {
    CA: 'D | Em7 | Bm | A | D | G | A7 | D |',
    CB: 'Bm | F#m/A | G | D/F# | Em7 | A/C# | Bm7 E7 | Asus4 A |',
    CA2: 'D | Em7 | Bm | A | D | G | Em7 A7 | Bm G | Em7 A7 | D |',
  };
  const HARP_ROLL = "l8 R F O T' F' T' O F";

  // ================================================================ title
  // D major, 88 bpm. Horn call (4) → theme on violin (8) → bridge on flute (8)
  // → theme on trumpet with a rising close (10). Loops to the violin theme.
  M.title = {
    tempo: 88, key: 'D', gain: 0.75,
    echo: { time: 0.34, fb: 0.35, wet: 0.3, lp: 3000 },
    chords: `@I D | G/D | G*3 D/F# | Asus4 A |
      L @A $CA @B $CB @A2 $CA2`,
    defs: Object.assign({}, THEME, THEME_CHORDS),
    ch: [
      { inst: 'horn', vol: 1, pan: 0.05, echo: 0.3, mml: `
        o4 q7 d4. e8 a2 | b4. >c+8 d2< | b4 a4 g4 f+4 | e1 |
        L o5 @violin $TA @flute $TB @trumpet $TA2` },
      { inst: 'horn', harm: 0, oct: -1, vol: 0.5, pan: -0.3, echo: 0.25 },
      { inst: 'strings', vol: 0.36, pan: -0.15, echo: 0.3, pat: 'C1', range: [55, 76], voices: 4 },
      { inst: 'harp', vol: 0.5, pan: 0.3, echo: 0.3, range: [50, 62], pats: { I: '', A: HARP_ROLL } },
      { inst: 'contra', vol: 0.75, range: [36, 55], pats: { I: 'R1', A: 'l2 R R', A2: "l4 R R F, R" } },
      { inst: 'timp', vol: 0.5, echo: 0.1, mml: `
        o2 v11 d4 r4 a4 r4 | d4 r4 d8 d8 d4 | g4 r4 g8 g8 f+4 | v8 [a32]16 v11 [a32]8 v14 a4 |
        L v12 d4 r2. | r1 | r1 | a4 r2. | d4 r2. | g4 r2. | a4 r4 a8 a8 a4 | d4 r2. |
        v10 b4 r2. | r1 | g4 r2. | r1 | e4 r2. | r1 | r1 | v8 [a32]16 v11 [a32]8 v14 a4 |
        v13 d4 r2. | r1 | b4 r2. | a4 r2. | d4 r2. | g4 r2. | e4 r4 a8 a8 a4 | b4 r4 g4 r4 | e4 r4 a8 a8 a4 | d2 r2 |` },
      { inst: 'drums', vol: 0.55, echo: 0.15, mml: `
        {bc}1 | r1 | r1 | l16 v6 [s]4 v8 [s]4 v10 [s]4 v13 [s]4 l8 v12 |
        L {bc}1 | r1 | r1 | r1 | b4 r2. | r1 | r1 | r1 |
        c1 | r1 | r1 | r1 | c1 | r1 | r1 | l16 v6 [s]4 v8 [s]4 v10 [s]4 v13 [s]4 l8 v12 |
        {bc}1 | r1 | r1 | r1 | {bc}1 | r1 | b4 r2. | b4 r2. | b4 r4 b4 r4 | {bc}1 |` },
    ],
  };

  // ================================================================ overworld
  // F major march, 112 bpm. Intro 2 bars, then A A' B A' (32 bars, loop).
  M.overworld = {
    tempo: 112, key: 'F', gain: 0.83,
    echo: { time: 0.268, fb: 0.28, wet: 0.22, lp: 3200 },
    chords: `
      @I F | C7 |
      L @A F | C/E | Dm | Bb C7 | F/A | Bb Gm | Dm Gm7 | C7sus4 C7 |
      F | C/E | Dm | Bb C7 | Dm | Bb | Gm7 C7 | F |
      @B Bb | F/A | Gm | Dm | Eb | Bb/D | Csus4 | C7 |
      @A F | C/E | Dm | Bb C7 | Dm | Bb | Gm7 C7 | F |`,
    defs: {
      P1: 'c4. f8 a4 f4 | g8 f8 e8 d8 c4. c8 | d4. f8 a4 >d4< | >d4 c4< b-4',
      AE: 'g4 | a4. g8 f4 a4 | b-4. a8 g4 b-4 | a4. f8 d4 f4 | g2 e4 r4 |',
      AF: '>c4< | >d4. c8 <a4 >d4< | >d4. c8 <b-4 f4 | b-4. a8 g4 e4 | f2. r4 |',
      DA: '{kc}8 h8 s8. s16 k8 h8 s8 h8 | k8 h8 s8. s16 k8 k8 s8 h8 | k8 h8 s8. s16 k8 h8 s8 h8 | k8 h8 s8. s16 k8 k8 s16 s16 s8 |',
      DA2: '{kc}8 h8 s8. s16 k8 h8 s8 h8 | k8 h8 s8. s16 k8 k8 s8 h8 | k8 h8 s8. s16 k8 h8 s8 h8 | k8 s16 s16 s8 s16 s16 k8 s16 s16 s8 s8 |',
      DB: '{kc}4 h8 h8 x4 h8 h8 | k4 h8 h8 x4 h8 k8 | k4 h8 h8 x4 h8 h8 | k4 h8 h8 x4 h8 k8 |',
      DB2: 'k4 h8 h8 x4 h8 h8 | k4 h8 h8 x4 h8 k8 | k4 h8 h8 x4 h8 h8 | l16 v8 s s s s v10 s s s s v12 s s s s v14 s s s s v12 l8 |',
    },
    ch: [
      { inst: 'trumpet', vol: 1, pan: 0.1, echo: 0.3, mml: `
        o5 l8 q7
        c8. c16 f8. f16 a4 >c4< | b-8 a8 g8 e8 c4 r4 |
        L $P1 $AE $P1 $AF
        @flute d4 f4 b-4. a8 | a4. g8 f4 c4 | d4 g4 b-4. a8 | a4. g8 f4 d4 |
        e-4 g4 b-4. >c8< | >d4. c8< b-4 f4 | g4 f4 g4 >c4< | >c2< b-4 g4 |
        @trumpet $P1 $AF` },
      { inst: 'horn', harm: 0, oct: -1, vol: 0.47, pan: -0.3, echo: 0.25 },
      { inst: 'strings', vol: 0.38, pan: -0.15, echo: 0.2, pat: 'C1', range: [53, 74], voices: 3 },
      { inst: 'pizz', vol: 0.33, pan: 0.35, echo: 0.15, q: 4, range: [55, 72], voices: 3,
        pats: { I: '', A: 'l8 r C r C r C r C', B: 'l8 a b c b a b c b' } },
      { inst: 'bass', vol: 0.66, q: 6, range: [36, 58], pats: { I: 'l4 R r R r', A: 'l4 R F, R F,', B: 'l4 R F O A' } },
      { inst: 'drums', vol: 0.5, echo: 0.08, mml: `
        l16 v7 [s]8 v9 [s]8 | v11 [s]8 v14 [s]4 r4 | v12 l8
        L $DA $DA2 $DA $DA2 $DB $DB2 $DA $DA2` },
    ],
  };

  // ================================================================ town
  // G major, 126 bpm, warm & lively: flute / clarinet / oboe over guitar chops,
  // marimba thirds, walking bass, shaker & rim. A A B A (32 bars).
  M.town = {
    tempo: 126, key: 'G', gain: 0.8,
    echo: { time: 0.238, fb: 0.22, wet: 0.18, lp: 3500 },
    chords: `
      L @A G | Em | C | D7 | G | Em | Am7 D7 | G |
      G | Em | C | D7 | G | Em | Am7 D7 | G |
      @B C | D/C | Bm7 | Em | Am7 | D7 | G Em | Am7 D7 |
      @A G | Em | C | D7 | G | Em | Am7 D7 | G |`,
    defs: {
      A: 'g4 b8 >d8 g4. f+8 | e4 d8 <b8 >e4. d8 | c4 <a8 >c8 e4. d8 | c4 <b8 a8 f+2 | g4 b8 >d8 g4. a8 | b4 a8 g8 e4. d8 | c4 e8 d8 c4 <a4 | g2. r4 |',
      B: 'e2 g4 e4 | f+2 a4 f+4 | d4 f+4 a4. g8 | g2. <b4> | c4 e4 a4. g8 | f+4 a4 >c4 <a4 | b4 g4 e4 g4 | a2 f+4 d4 |',
      TD: 'k8 z8 x8 z8 k8 k8 x8 z8 | k8 z8 x8 z8 k8 z8 x8 z8 | k8 z8 x8 z8 k8 k8 x8 z8 | k8 z8 x8 z8 k8 x16 x16 x8 x8 |',
      TB: 'k4 z8 z8 x4 z8 z8 | k4 z8 z8 x4 z8 k8 | k4 z8 z8 x4 z8 z8 | k4 z8 z8 x4 z8 k8 |',
    },
    ch: [
      { inst: 'flute', vol: 1, pan: 0.1, echo: 0.25, mml: `
        L o4 l8 q6 @flute $A o4 @clarinet $A o5 q7 @oboe $B o4 q6 @flute $A` },
      { inst: 'marimba', harm: 0, vol: 0.55, pan: -0.35, echo: 0.2 },
      { inst: 'guitar', vol: 0.4, pan: 0.35, echo: 0.1, q: 5, range: [55, 71], voices: 3,
        pats: { A: 'l8 r4 C r r4 C C', B: 'l8 C4 r C r C C4' } },
      { inst: 'strings', vol: 0.25, pan: -0.1, echo: 0.2, pat: 'C1', range: [55, 74], voices: 3 },
      { inst: 'bass', vol: 0.62, q: 6, range: [36, 57], pats: { A: 'l4 R F O F', B: 'l4 R O F A' } },
      { inst: 'drums', vol: 0.55, echo: 0.05, mml: `L l8 $TD $TD $TD $TD $TB $TB $TD $TD` },
    ],
  };

  // ================================================================ village
  // C major 3/4, 96 bpm, pastoral: flute & oboe, rolling harp, soft strings.
  M.village = {
    tempo: 96, meter: '3/4', key: 'C', gain: 0.83,
    echo: { time: 0.312, fb: 0.3, wet: 0.25, lp: 2800 },
    chords: `
      L @A C | G/B | Am | Em/G | F | C/E | Dm7*2 G7 | C |
      C | G/B | Am | Em/G | F | C/E | Dm7*2 G7 | C |
      @B Am | Em | F | C | Dm | Am | F | G7 |
      @A C | G/B | Am | Em/G | F | C/E | Dm7*2 G7 | C |`,
    defs: {
      A1: 'e4. d8 c4 | d2 <b4> | c4. <b8 a4> | <b2.> | <a4> c4 f4 | e4. d8 c4 | d4 f4 <b4> | c2. |',
      A2: 'e4. d8 c4 | d2 <b4> | c4. <b8 a4> | <b2.> | <a4> c4 f4 | g2 e4 | f4 d4 <b4> | c2. |',
      B: 'a2 g8 e8 | g4. e8 g4 | a2 f4 | g2. | f4. e8 d4 | e2 c4 | c4 f4 a4 | g2 f4 |',
      VD: 'i4 z4 z4 | r4 z4 z4 |',
    },
    ch: [
      { inst: 'flute', vol: 1, pan: 0.1, echo: 0.3, mml: `
        L o5 q7 @flute $A1 @oboe $A2 @flute $B @oboe $A2` },
      { inst: 'clarinet', harm: 0, vol: 0.4, pan: -0.3, echo: 0.25 },
      { inst: 'harp', vol: 0.49, pan: 0.3, echo: 0.3, range: [48, 60], pat: "l8 R F O T' O F" },
      { inst: 'strings', vol: 0.28, pan: -0.15, echo: 0.3, pat: 'C2.', range: [55, 74], voices: 3 },
      { inst: 'tri', vol: 0.65, range: [36, 55], pats: { A: 'R2.', B: 'l4 R2 F' } },
      { inst: 'drums', vol: 0.8, echo: 0.2, mml: `L l4 [$VD]16` },
    ],
  };

  // ================================================================ castle
  // B-flat major, 84 bpm, regal: trumpet fanfare phrases, horn solo bridge,
  // harpsichord arpeggios, timpani and snare ruffs. Intro 2 + A B A (24).
  M.castle = {
    tempo: 84, key: 'Bb', gain: 0.78,
    echo: { time: 0.357, fb: 0.3, wet: 0.26, lp: 3000 },
    chords: `
      @I Bb | F |
      L @A Bb | F/A | Gm | Eb F | Bb/D | Eb | Cm7 F7 | Bb |
      @B Gm | Dm/F | Eb | Bb/D | Cm | F7 | Dm7 Gm | Cm7 F7 |
      @A Bb | F/A | Gm | Eb F | Bb/D | Eb | Cm7 F7 | Bb |`,
    defs: {
      A: 'o4 b-4. f8 b-4 >d4 | c4. <a8 f4 >c4 | d4. c8 <b-4 >d4 | e-4 d8 e-8 f2 | f4. e-8 d4 f4 | g4. f8 e-4 g4 | g4 e-4 f4 a4 | b-2. r4 |',
      B: 'o4 b-2. a8 g8 | a2 f4 d4 | g2 f4 e-4 | f2. r4 | e-4 g4 >c4. <b-8 | a2 f4 >c4 | d4 c4 <b-4 g4 | g2 a2 |',
      CD: '{kc}4 r4 s16 s16 s8 r4 | k4 r4 s16 s16 s8 r4 | k4 r4 s16 s16 s8 r4 | k4 r4 s8 s16 s16 s8 s8 |',
    },
    ch: [
      { inst: 'trumpet', vol: 1, pan: 0.1, echo: 0.3, mml: `
        o4 b-8. b-16 >d8. d16 f4 d4 | c8. c16 f8. f16 a2 |
        L @trumpet $A @horn $B @trumpet $A` },
      { inst: 'brass', harm: 0, vol: 0.42, pan: -0.3, echo: 0.25 },
      { inst: 'harpsi', vol: 0.45, pan: 0.35, echo: 0.2, q: 6, range: [55, 72], voices: 3,
        pats: { I: 'l8 C r C r C r C r', A: 'l8 a b c b a b c b', B: 'l8 a c b c a c b c' } },
      { inst: 'strings', vol: 0.35, pan: -0.15, echo: 0.25, pat: 'C1', range: [53, 74], voices: 3 },
      { inst: 'bass', vol: 0.59, q: 7, range: [34, 55], pats: { I: 'l4 R r R r', A: 'l4 R F O F', B: 'l2 R R' } },
      { inst: 'timp', vol: 0.55, echo: 0.1, mml: `
        o2 b-4 r4 f4 r4 | f8 f8 f4 [f32]8 f4 |
        L b-4 r2. | r1 | g4 r2. | e-4 r4 f4 r4 | r1 | e-4 r2. | c4 r4 f8 f8 f4 | b-4 r2. |
        g4 r2. | r1 | e-4 r2. | r1 | c4 r2. | f4 r2. | d4 r4 g4 r4 | c4 r4 [f32]8 f4 |
        b-4 r2. | r1 | g4 r2. | e-4 r4 f4 r4 | r1 | e-4 r2. | c4 r4 f8 f8 f4 | b-4 r2. |` },
      { inst: 'drums', vol: 0.5, echo: 0.12, mml: `
        l16 v8 [s]8 v11 [s]8 | v13 [s]8 l8 v12 {kc}4 r4 |
        L $CD $CD c1 | r1 | r1 | r1 | b1 | r1 | r1 | l16 v8 [s]8 v11 [s]8 l8 v12 | $CD $CD` },
    ],
  };

  // ================================================================ shrine
  // A major, 60 bpm, sacred & calm: choir chant, organ, bells and a flowing harp.
  M.shrine = {
    tempo: 60, key: 'A', gain: 0.78,
    echo: { time: 0.5, fb: 0.4, wet: 0.35, lp: 2500 },
    chords: `
      L A | D/A | A | Esus4 E | F#m | D | Bm7 | Esus4 E |
      A | D/A | A | C#m | D | Bm7 | Esus4 E7 | A |`,
    ch: [
      { inst: 'choir', vol: 1, echo: 0.4, q: 8, mml: `
        L o5 c+2 e2 | f+2. e4 | c+1 | <b2 g+2> | <a2> c+2 | d2. f+4 | f+2 d2 | e1 |
        c+2 e2 | f+2. a4 | a2 e2 | g+2 e2 | f+2. e4 | d2 f+2 | e2 d2 | c+1 |` },
      { inst: 'choir', harm: 0, vol: 0.45, pan: -0.25, echo: 0.4 },
      { inst: 'organ', vol: 0.34, pan: 0.2, echo: 0.35, pat: 'C1', range: [52, 72], voices: 4 },
      { inst: 'bell', vol: 0.45, pan: 0.4, echo: 0.5, range: [64, 80], voices: 3, pat: "l2 c' a'" },
      { inst: 'harp', vol: 0.35, pan: -0.35, echo: 0.4, range: [45, 57], pat: HARP_ROLL },
      { inst: 'contra', vol: 0.7, range: [33, 50], pat: 'R1' },
    ],
  };

  // ================================================================ sea
  // A major 6/8 (♩=108), sailing swell: rolling harp, lilting melody passed between
  // flute, oboe and violin.  Intro 2 + A A' B A' (34 bars).
  M.sea = {
    tempo: 108, meter: '6/8', key: 'A', gain: 0.81,
    echo: { time: 0.278, fb: 0.3, wet: 0.25, lp: 3000 },
    chords: `
      @I A | E/G# |
      L @A A | D/A | A | E | F#m | D | Bm7 E7 | A |
      A | D/A | A | E | F#m | D | Bm7 E7 | A |
      @B D | E/D | C#m7 | F#m | Bm7 | E | D/F# E/G# | E7 |
      @A A | D/A | A | E | F#m | D | Bm7 E7 | A |`,
    defs: {
      A6: 'c+4. e8 d8 c+8 | d4 f+8 a4. | a4 g+8 a8 e8 c+8 | <b4. >e4. | c+4. f+8 e8 c+8 | d4 f+8 a4 f+8 |',
      A: '$A6 d4 c+8 <b4 g+8 | a4. r4.> |',
      A2: '$A6 d4 f+8 e4 g+8 | a4. r4. |',
      B: 'f+4. a4. | g+4. b4. | >c+4 <b8 g+4. | a4. f+4. | d4 e8 f+4 a8 | g+4. e4. | f+4. g+4. | b4 a8 g+8 f+8 e8 |',
      SD: 'k4 z8 x4 z8 |',
      SB: 'k4 z8 x8 z8 z8 |',
    },
    ch: [
      { inst: 'flute', vol: 1, pan: 0.1, echo: 0.3, mml: `
        o5 q7 r2. | r2. |
        L o5 @flute $A o5 @oboe $A2 o5 @violin $B o5 @flute $A2` },
      { inst: 'clarinet', harm: 0, vol: 0.42, pan: -0.3, echo: 0.25 },
      { inst: 'harp', vol: 0.47, pan: 0.3, echo: 0.3, range: [45, 57], pat: "l8 R F O T' O F" },
      { inst: 'strings', vol: 0.32, pan: -0.15, echo: 0.3, pat: 'C2.', range: [55, 72], voices: 3 },
      { inst: 'bass', vol: 0.7, q: 7, range: [36, 55], pat: 'l4. R F,' },
      { inst: 'drums', vol: 0.45, echo: 0.1, mml: `r2. | r2. | L [$SD]16 [$SB]8 [$SD]8` },
    ],
  };

  // ================================================================ ending
  // Reprise of the main theme: tender (♩=75: harp intro, flute theme, violin
  // bridge), then triumphant (♩=96: trumpet theme with march drums), broad close.
  M.ending = {
    tempo: 75, key: 'D', gain: 0.75,
    echo: { time: 0.417, fb: 0.35, wet: 0.3, lp: 3000 },
    chords: `
      L @I D | G/D |
      @A $CA @B $CB @A2 $CA2
      @F G/D | D |`,
    defs: Object.assign({}, THEME, THEME_CHORDS, {
      DA: '{kc}8 h8 s8. s16 k8 h8 s8 h8 | k8 h8 s8. s16 k8 k8 s8 h8 | k8 h8 s8. s16 k8 h8 s8 h8 | k8 h8 s8. s16 k8 k8 s16 s16 s8 |',
    }),
    ch: [
      { inst: 'flute', vol: 1, pan: 0.05, echo: 0.35, mml: `
        L t75 o5 q7 r1 | r1 |
        @flute $TA @violin $TB t96 @trumpet $TA2 t84 >d1 | t66 d1< |` },
      { inst: 'horn', harm: 0, oct: -1, vol: 0.45, pan: -0.3, echo: 0.25 },
      { inst: 'strings', vol: 0.34, pan: -0.15, echo: 0.3, pat: 'C1', range: [55, 76], voices: 4 },
      { inst: 'harp', vol: 0.5, pan: 0.3, echo: 0.35, range: [50, 62], pats: { I: HARP_ROLL, F: 'C1' } },
      { inst: 'bass', vol: 0.68, q: 7, range: [36, 55], pats: { I: 'R1', A: 'l2 R R', A2: 'l4 R F, R F,', F: 'R1' } },
      { inst: 'timp', vol: 0.52, echo: 0.1, mml: `
        L o2 r1 | r1 | [r1 |]16
        v13 d4 r2. | r1 | b4 r2. | a4 r2. | d4 r2. | g4 r2. | e4 r4 a8 a8 a4 | b4 r4 g4 r4 | e4 r4 a8 a8 a4 | d2 r2 |
        v9 [d32]16 v11 [d32]8 v13 d4 | v14 d2 r2 |` },
      { inst: 'drums', vol: 0.45, echo: 0.1, mml: `
        L r1 | r1 | [r1 |]16 $DA $DA {kc}4 r2. | r1 | {bc}1 | r1 |` },
    ],
  };

  Object.assign(R.DB.music, M);
})(window.RPG);
