// Music new in ルミナス・クロニクル (DESIGN §11.10): the main theme 「語り部の主題」 and the
// field / story tracks tavern home sorrow forest ghost postgame legend. Battle tracks new in
// Chronicle are in music_chronicle_battle.js; rewritten Crest tracks stay in their own files
// (title / ending / overworld in music.js, lastboss / valzard in music_battle.js).
// Original compositions; MML / chord / pattern format documented at the top of src/core/audio.js.
(function (R) {
  'use strict';
  const M = {};

  // ================================================================ 語り部の主題 (the storyteller's theme)
  // DESIGN §11.10.2: E minor brightening to G major, 3/4, ♩≈92. Bar 1 carries the harp's rising
  // "page turn"; the sung line (flute / oboe) has one major-sixth leap, in bar 4 (D → B).
  // Written once here and shared with every track through R.Audio.MOTIFS ($TELLER …): title,
  // ending, lastboss, home, overworld (B strain), the chapter jingle (first four notes).
  // Octave-neutral (every > has its <): the caller sets o5 / k±n before the macro.
  const TELLER = {
    TELLER: 'e4. f+8 g8 b8 | >c4. <b8 a4 | f+4. g8 a8 f+8 | d4 b2 |',            // motif, 4 bars
    TELLER_ANS: 'e4. f+8 g8 b8 | >e4. d8 c4< | b4 a8 g8 a8 f+8 | g2. |',          // answer, 4 bars
    TELLER_B: 'e4. g8 >c4< | a4. f+8 d4 | f+4. a8 >d4< | b2. | a4 >c4 e4< | >d4. c8< a4 | b4 g4 >c4< | a4. g8 f+4 |',
    // the same lines in 4/4 (lastboss, overworld, ending)
    TELLER4: 'e4. f+8 g4 b4 | >c4. <b8 a2 | f+4. g8 a4 f+4 | d4 b2. |',
    TELLER4_ANS: 'e4. f+8 g4 b4 | >e4. d8 c2< | b4 a8 g8 a4 f+4 | g1 |',
    TELLER4_B: 'e4. g8 >c2< | a4. f+8 d2 | f+4. a8 >d2< | b1 | a4 >c4 e2< | >d4. c8< a2 | b4 g4 >c2< | a4. g8 f+2 |',
    // minor turn of the motif (harmonic E minor, the leap narrowed to a minor sixth) — lastboss
    TELLER4_MIN: 'e4. f+8 g4 b4 | >c4. <b8 a2 | d+4. e8 f+4 d+4 | <b4 >g2. |',
    // chords (G major / E minor); the 4/4 lines take the same bars
    TC: 'Em | C | D | G |',
    TCA: 'Em | C | G/D*2 D7 | G |',
    TCA4: 'Em | C | G/D D7 | G |',
    TCB: 'C | D | Bm | Em | Am | D/F# | G*2 C | Dsus4*2 D |',
    TCB4: 'C | D | Bm | Em | Am | D/F# | G C | Dsus4 D |',
    TCM: 'Em | Am/C | B7 | Em |',
  };
  Object.assign(R.Audio.MOTIFS, TELLER);
  // the rising harp figure of bar 1 ("a page turns"), as an arranged pattern for 3/4
  const PAGE = "l8 R F O T' F' O'";

  // ================================================================ tavern 酒場・仲間選び
  // D major 6/8 (♩=116): a jig for the lamp-lit tavern. Flute tune, clarinet under it, guitar
  // chops, bass on the dotted beats, foot-stomp drum. Vamp 2 + A (8) B (8) A' (8).
  M.tavern = {
    tempo: 116, meter: '6/8', key: 'D', gain: 0.87,
    echo: { time: 0.26, fb: 0.25, wet: 0.2, lp: 3200 },
    chords: `
      @I D | A7 |
      L @A D | G/D | D | A7 | D | G | Em7 A7 | D |
      @B G | A | F#m | Bm | G | A/G | F#m7 B7 | Em7 A7 |
      @A D | G/D | D | A7 | D | G | Em7 A7 | D |`,
    defs: {
      A7B: 'a8 f+8 a8 d4 f+8 | g8 b8 >d8< b4 g8 | f+8 a8 >d8< a8 f+8 d8 | e4. c+4 <a8> | a8 f+8 a8 >d4 c+8< | b4 g8 d8 e8 g8 | g8 f+8 e8 g8 e8 c+8 |',
      A: '$A7B d4. d8 e8 f+8 |',
      A2: '$A7B d4. r4. |',
      B: 'b4. >d4.< | >c+4. <a4. | a4. f+4. | f+4 e8 d4 f+8 | g4. b4. | a4. >c+4.< | >c+8 <b8 a8 b8 a8 f+8 | g4. e8 f+8 g8 |',
      TD: 'k8 z8 z8 {kx}8 z8 z8 |',
      TB: 'k8 z8 p8 k8 z8 p8 |',
      TF: 'k8 x8 x8 k16 k16 x8 x8 |',
    },
    ch: [
      { inst: 'flute', vol: 1, pan: 0.1, echo: 0.25, mml: `
        o5 q6 r2. | r2. |
        L @flute $A @clarinet q7 $B @flute q6 $A2` },
      { inst: 'clarinet', harm: 0, vol: 0.4, pan: -0.3, echo: 0.2 },
      { inst: 'guitar', vol: 0.4, pan: 0.35, echo: 0.1, q: 4, range: [55, 71], voices: 3,
        pats: { I: 'l8 C r C C r C', A: 'l8 r C C r C C', B: 'l8 C r C r C C' } },
      { inst: 'strings', vol: 0.2, pan: -0.15, echo: 0.2, range: [57, 74], voices: 3, pats: { I: '', A: '', B: 'C2.' } },
      { inst: 'bass', vol: 0.66, q: 6, range: [36, 55], pats: { I: 'l4. R F,', A: 'l4. R F,', B: 'l8 R r F R r A' } },
      { inst: 'drums', vol: 0.55, echo: 0.05, mml: `
        k8 r8 r8 k8 r8 r8 | $TF
        L [$TD]7 $TF [$TB]7 $TF [$TD]7 $TF` },
    ],
  };

  // ================================================================ home ロアの里・師匠の家
  // G major 3/4, ♩=76: the storyteller's theme as a keepsake — music box and harp, thin
  // strings. Harp page-turn 2 + A (music box: motif + answer, 8) B (flute: B strain, 8)
  // A' (music box with flute, 8). Loop 24 bars.
  M.home = {
    tempo: 76, meter: '3/4', key: 'G', gain: 1.17,
    echo: { time: 0.395, fb: 0.38, wet: 0.32, lp: 3200 },
    chords: `
      @I G | Dsus4*2 D |
      L @A $TC $TCA
      @B $TCB
      @A $TC $TCA`,
    ch: [
      { inst: 'musicbox', vol: 1, pan: 0.15, echo: 0.4, mml: `
        o5 q8 r2. | r2. |
        L $TELLER $TELLER_ANS
        r2. | r2. | r2. | r2. | r2. | r2. | r2. | r2. |
        $TELLER $TELLER_ANS` },
      { inst: 'flute', vol: 0.62, pan: -0.15, echo: 0.3, mml: `
        o5 q7 r2. | r2. |
        L r2. | r2. | r2. | r2. | r2. | r2. | r2. | r2. |
        $TELLER_B
        o4 b2. | >e2. | d2. | <g2. | b2. | >c2. | d2 c4 | <b2. |` },
      { inst: 'harp', vol: 0.5, pan: 0.3, echo: 0.35, range: [43, 60], pats: { I: PAGE, A: "l8 R F O T' O F", B: PAGE } },
      { inst: 'strings', vol: 0.2, pan: -0.25, echo: 0.3, pat: 'C2.', range: [55, 72], voices: 3 },
      { inst: 'contra', vol: 0.5, range: [31, 50], pat: 'R2.' },
      { inst: 'drums', vol: 0.4, echo: 0.4, mml: `
        r2. | r2. |
        L i2. | [r2. |]7 i2. | [r2. |]7 i2. | [r2. |]7` },
    ],
  };

  // ================================================================ sorrow ビブリア・悲しい場面
  // A minor, ♩=66: oboe over strings, the harp breaking each chord upward; the violin takes
  // the second strain toward C major and falls back. A (8) B (8), no drums.
  M.sorrow = {
    tempo: 66, key: 'Am', gain: 0.96,
    echo: { time: 0.455, fb: 0.4, wet: 0.34, lp: 2600 },
    chords: `
      L @A Am | F | Dm | E | Am | F | Dm6 E7 | Am |
      @B F | G | Em | Am | Dm | G | Cmaj7 F | Bm7b5 E7 |`,
    ch: [
      { inst: 'oboe', vol: 1, pan: 0.05, echo: 0.35, mml: `
        L o5 q7 c4. <b8 a4 e4> | f4. e8 c2 | d4. e8 f4 a4 | g+2. e4 |
        a4. g+8 a4 >c4< | >c4 <a4 f4 a4 | b4 a4 g+4 b4 | a1 |
        @violin a2 >c2< | b2 >d2< | b4. a8 g4 e4 | a2. r4 |
        f4. g8 a4 >d4< | >d4 <b4 g4 b4 | >c2 <a2 | a2 g+2 |` },
      { inst: 'strings', harm: 0, vol: 0.34, pan: -0.3, echo: 0.3 },
      { inst: 'harp', vol: 0.5, pan: 0.3, echo: 0.4, range: [45, 60], pat: "l8 R F O T' O' T' O F" },
      { inst: 'strings', vol: 0.3, pan: -0.1, echo: 0.35, pat: 'C1', range: [52, 69], voices: 3 },
      { inst: 'contra', vol: 0.6, range: [28, 45], pats: { A: 'R1', B: 'l2 R F' } },
    ],
  };

  // ================================================================ forest 迷いの森・千年樹
  // D dorian (key Dm, B natural), ♩=92: flute and harp in the old wood, marimba seeds
  // dropping, woodblock and shaker underfoot. A (8) B (clarinet, 8) A' (8).
  M.forest = {
    tempo: 92, key: 'Dm', gain: 0.85,
    echo: { time: 0.391, fb: 0.4, wet: 0.34, lp: 2800 },
    chords: `
      L @A Dm | G/D | Dm | C | Dm | G/D | Bbmaj7 | A |
      @B Bb | F | Gm | Dm | Bb | C | A7sus4 | A7 |
      @A Dm | G/D | Dm | C | Dm | G/D | Bbmaj7 | A |`,
    defs: {
      A: 'a4. g8 f4 d4 | b4. a8 g4 d4 | f4 a4 >d4 c4< | e2 g4 e4 | d4. e8 f4 a4 | b4 >d4 d8 c8 <b4 | a4. f8 d4 f4 | e2 c+2 |',
      B: 'd2 f2 | c2 <a4 f4> | g4. a8 b-4 g4 | f2. r4 | f4 b-4 >d4 c4< | >c2< g2 | a4 g4 e4 d4 | c+2 e2 |',
      FD: 'w8 r8 z8 r8 f8 r8 z8 r8 | w8 r8 z8 w8 r8 r8 z8 r8 |',
    },
    ch: [
      { inst: 'flute', vol: 1, pan: 0.1, echo: 0.4, mml: `
        L o5 q7 @flute $A @clarinet $B @flute $A` },
      { inst: 'flute', harm: 0, vol: 0.3, pan: -0.3, echo: 0.35 },
      { inst: 'harp', vol: 0.48, pan: 0.3, echo: 0.35, range: [45, 60], pats: { A: "l8 R F O T' O' T' O F", B: "l8 R O F' O R O T' O" } },
      { inst: 'marimba', vol: 0.34, pan: -0.4, echo: 0.55, range: [62, 79], voices: 3,
        pats: { A: 'l16 r r c r r r a r r b r r r r a r', B: 'l16 a r r r c r r b r r r r a r r r' } },
      { inst: 'pad', vol: 0.3, pan: 0, echo: 0.3, pat: 'C1', range: [50, 65], voices: 3 },
      { inst: 'contra', vol: 0.55, range: [29, 45], pat: 'R1' },
      { inst: 'drums', vol: 0.45, echo: 0.25, mml: `L [$FD]12` },
    ],
  };

  // ================================================================ ghost 霧の館・鐘沈みの沼・幽霊船
  // C minor 3/4, ♩=72: a clarinet waltz with harpsichord, a music box that has run down
  // (warped pitch) in the middle strain, a far bell, a clock that ticks unevenly.
  // A (8) B (music box, 8) A' (8).
  M.ghost = {
    tempo: 72, meter: '3/4', key: 'Cm', gain: 1,
    echo: { time: 0.417, fb: 0.42, wet: 0.36, lp: 2500 },
    chords: `
      L @A Cm | G7/B | Cm | Ab | Fm | Cm/G | Dm7b5*2 G7 | Cm |
      @B Ab | Eb/G | Fm | Cm | Db | Ab/C | G7sus4*2 G7 | G7 |
      @A Cm | G7/B | Cm | Ab | Fm | Cm/G | Dm7b5*2 G7 | Cm |`,
    defs: {
      A: 'g4. f8 e-4 | d4. c8 <b4> | c4 e-4 g4 | a-2. | a-4. g8 f4 | e-2 c4 | f4 a-4 g4 | c2. |',
      B: 'c4. e-8 a-4 | g2 b-4 | a-4. g8 f4 | e-2. | f4. e-8 d-4 | c4 e-4 a-4 | g4 f4 d4 | <b2.> |',
      CL: 'w4 r4 w4 | r4 w8 r8 r4 |',
    },
    ch: [
      { inst: 'clarinet', vol: 1, pan: 0.1, echo: 0.35, mml: `
        L o5 q7 $A @warpbox q8 $B @clarinet q7 $A` },
      { inst: 'oboe', harm: 0, vol: 0.28, pan: -0.3, echo: 0.35 },
      { inst: 'harpsi', vol: 0.4, pan: 0.35, echo: 0.3, q: 6, range: [48, 64], pats: { A: "l8 R T F T O T", B: "l8 R F O r O F" } },
      { inst: 'strings', vol: 0.24, pan: -0.15, echo: 0.35, pat: 'C2.', range: [52, 67], voices: 3 },
      { inst: 'bell', vol: 0.3, pan: -0.45, echo: 0.6, mml: `
        L o5 [c2. | r2. | r2. | r2. |]2 [a-2. | r2. | r2. | r2. |]2 [c2. | r2. | r2. | r2. |]2` },
      { inst: 'contra', vol: 0.55, range: [28, 44], pat: 'R2.' },
      { inst: 'drums', vol: 0.42, echo: 0.4, mml: `L [$CL]12` },
    ],
  };

  // ================================================================ postgame 忘却の底
  // F-sharp minor, ♩=84: the bottom of oblivion. A hollow pad, a line that swells in like
  // tape run backwards and stops dead, far bells, a slow gong. A (8) B (8) C (4).
  M.postgame = {
    tempo: 84, key: 'F#m', gain: 1.15,
    echo: { time: 0.536, fb: 0.5, wet: 0.45, lp: 2200 },
    chords: `
      L @A F#m | Dmaj7 | F#m/C# | Bm7 | F#m | Dmaj7 | Bm7 | C#7sus4 C#7 |
      @B Dmaj7 | E | C#m7 | F#m | Bm7 | E | Dmaj7 | C#7 |
      @C F#m | Dmaj7 | Bm7 | C#7 |`,
    ch: [
      { inst: 'swell', vol: 1, pan: 0.05, echo: 0.5, q: 8, mml: `
        L o5 c+2 <a2> | f+1 | c+2 f+2 | d1 | a2 f+2 | c+1 | d2 f+2 | f+2 e+2 |
        a1 | g+2 b2 | g+2 e2 | f+1 | d2 a2 | g+1 | f+2 c+2 | e+1 |
        c+1 | <a1 | b1 | g+1> |` },
      { inst: 'swell', harm: 0, vol: 0.45, pan: -0.35, echo: 0.5, below: [5, 9] },
      { inst: 'pad', vol: 0.34, pan: 0.15, echo: 0.45, pat: 'C1', range: [49, 64], voices: 3 },
      { inst: 'bell', vol: 0.26, pan: 0.45, echo: 0.7, mml: `
        L o6 r2 c+2 | r1 | r1 | r2. <f+4> | r1 | r2 c+2 | r1 | r1 |
        r2 e2 | r1 | r1 | r2. c+4 | r1 | r2 <b2> | r1 | r1 |
        r2 f+2 | r1 | r1 | r1 |` },
      { inst: 'celesta', vol: 0.3, pan: -0.45, echo: 0.7, mml: `
        L o6 r1 | r2 a8 r8 r4 | r1 | r4 f+8 r8 r2 | r1 | r2. e8 r8 | r1 | r4 g+8 r8 r2 |
        r1 | r2 b8 r8 r4 | r1 | r4 a8 r8 r2 | r1 | r2. g+8 r8 | r1 | r4 e+8 r8 r2 |
        r1 | r2 a8 r8 r4 | r1 | r1 |` },
      { inst: 'contra', vol: 0.6, range: [30, 45], pat: 'R1' },
      { inst: 'drums', vol: 0.5, echo: 0.5, mml: `L g1 | [r1 |]7 b1 | [r1 |]7 g1 | r1 | r1 | r1 |` },
    ],
  };

  // ================================================================ legend 伝説を語る場面
  // The first theme of the Luminous series (Crest's 「ひかりの もんしょう」, THEME.TA — a studio
  // theme, quoted by permission of §11.10.1) told again on a music box, as a bard would.
  // D major, ♩=66: harp roll 1 + theme 8.
  M.legend = {
    tempo: 66, key: 'D', gain: 1.42,
    echo: { time: 0.455, fb: 0.42, wet: 0.36, lp: 3200 },
    chords: `@I D | L @A $CREST_CA`,
    ch: [
      { inst: 'musicbox', vol: 1, pan: 0.1, echo: 0.45, q: 8, mml: `o5 r1 | L $CREST_TA` },
      { inst: 'celesta', harm: 0, vol: 0.3, pan: -0.3, echo: 0.45, below: [3, 5] },
      { inst: 'harp', vol: 0.45, pan: 0.3, echo: 0.4, range: [45, 60], pat: "l8 R F O T' O' T' O F" },
      { inst: 'strings', vol: 0.2, pan: -0.2, echo: 0.35, pat: 'C1', range: [55, 72], voices: 3 },
      { inst: 'contra', vol: 0.45, range: [33, 50], pat: 'R1' },
    ],
  };

  Object.assign(R.DB.music, M);
})(window.RPG);
