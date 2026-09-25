// Battle music new in ルミナス・クロニクル (DESIGN §11.10.3 / §9.11.4): rival tension boss2
// rarebattle superboss hollowking. (lastboss and valzard stay in music_battle.js.)
// Original compositions; MML / chord / pattern format documented at the top of src/core/audio.js.
(function (R) {
  'use strict';
  const M = {};
  const FILL = 'l16 s s s s t t t t m m m m f f f f l8 |';

  // ================================================================ rival ロウェル戦
  // B minor, ♩=156. Rowell's motif — three falling notes, F#–E–D, long-short-long — opens
  // every phrase of the sharp violin line; pizzicato ostinato and a snare that never rests.
  // Roll 2 + A (16) B (8, the violin climbs) C (8, the motif sequenced down).
  M.rival = {
    tempo: 156, key: 'Bm', gain: 0.81,
    echo: { time: 0.192, fb: 0.24, wet: 0.18, lp: 3000 },
    chords: `
      @I Bm | F#7 |
      L @A Bm | G | Em | F# | Bm | G | Em7 F#7 | Bm |
      Bm | G | Em | F# | Bm | G | Em7 F#7 | Bm |
      @B D | A/C# | Bm | F#m | G | D/F# | Em7 | F#7 |
      @C Bm | A | G | F# | Em | D/F# | G F#7 | F#7 |`,
    defs: {
      ROWELL: 'f+4. e8 d4', // the motif (3 falling notes)
      RA7: 'o5 $ROWELL <b4> | d8 e8 f+8 g8 b4 g4 | g4. f+8 e4 b4 | a+2 f+2 | $ROWELL f+4 | g8 f+8 g8 a8 b4 >d4< | b4 g4 a+4 >c+4< |',
      RA: '$RA7 b2 r4 f+8 f+8 |',
      RA2: '$RA7 b2. r4 |',
      RB: 'o5 a2 o6 d2 | o6 c+2 e2 | o6 d2 o5 b2 | o5 a1 | o5 b2 o6 d2 | o6 d2 o5 a2 | o5 g2 b2 | o5 a+2 o6 c+2 |',
      RC: 'o5 $ROWELL f+4 | o5 e4. d8 c+4 e4 | o5 d4. c+8 <b4 >d4 | o5 c+2 <a+2> | o5 b4. a8 g4 b4 | o5 a4. g8 f+4 a4 | o5 g4 b4 a+4 >c+4< | o5 f+2 e2 |',
      DA: 'k8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 s16 s16 s8 s8 |',
      DB: 'k4 s16 s16 s8 k4 s16 s16 s8 |',
      DC: 'k8 s16 s16 s8 k8 k8 s16 s16 s8 s8 |',
    },
    ch: [
      { inst: 'violin', vol: 1, pan: 0.05, echo: 0.22, mml: `
        o5 q7 r1 | r1 |
        L q6 $RA $RA2 q7 $RB q6 $RC` },
      { inst: 'strings', harm: 0, vol: 0.34, pan: -0.3, echo: 0.2 },
      { inst: 'pizz', vol: 0.5, pan: 0.35, echo: 0.15, q: 4, range: [42, 57],
        pats: { I: 'l8 R F O F R F O F', B: 'l8 R O F O R O F O', C: 'l8 R F O F R F O F' } },
      { inst: 'strings', vol: 0.5, pan: 0.25, echo: 0.15, q: 3, range: [55, 72], voices: 3,
        pats: { I: 'q8 C1', A: 'l8 C r r C r C r r', B: 'q8 C2 C2', C: 'l8 C r C r r C r C' } },
      { inst: 'bass', vol: 0.62, q: 5, range: [35, 52], pats: { I: 'l8 R R R R R R R R', A: 'l8 R R O R R R O R', B: 'l4 R R R R', C: 'l8 R R O R R R O R' } },
      { inst: 'drums', vol: 0.42, echo: 0.06, mml: `
        l16 v6 [s]8 v8 [s]8 | v10 [s]8 v13 [s]4 {kc}4 l8 v12 |
        L [$DA]7 k8 h8 s8 h8 k8 k8 s8 h8 | ${FILL} [$DB]7 ${FILL} [$DC]7 ${FILL}` },
    ],
  };

  // ================================================================ tension 緊迫・ラザロ戦
  // G minor, ♩=132: sixteenth-note strings and a low repeated bass under long horn notes,
  // with a clear kick/snare beat so it can carry a battle. Pulse 2 + A (8) B (8) A' (8, a high
  // pulse ostinato joins).
  M.tension = {
    tempo: 132, key: 'Gm', gain: 0.81,
    echo: { time: 0.227, fb: 0.28, wet: 0.2, lp: 2800 },
    chords: `
      @I Gm | Gm |
      L @A Gm | Eb/G | Gm | D/F# | Gm | Cm/G | Eb | D |
      @B Cm | Gm | Bb | F | Eb | Bb/D | Cm7 | D7 |
      @A2 Gm | Eb/G | Gm | D/F# | Gm | Cm/G | Eb | D |`,
    defs: {
      HA: 'o4 d1 | e-1 | d2 b-2 | a1 | g1 | g2 >c2< | >e-2 <b-2 | f+2 a2 |',
      HB: 'o4 g2 >c2< | >d2 <b-2 | >d2 f2< | >c1< | b-2 >e-2< | >d2 <b-2 | >c2 e-2< | >d1< |',
      TA: 'k8 h8 s8 h8 k8 k8 s8 h8 |',
      TB: '{kc}8 h8 s8 h8 k8 h8 s8 k8 |',
    },
    ch: [
      { inst: 'horn', vol: 1, pan: 0.05, echo: 0.3, mml: `
        o4 q8 r1 | r1 |
        L $HA $HB $HA` },
      { inst: 'horn', harm: 0, vol: 0.4, pan: -0.3, echo: 0.25, oct: -1, min: 43 },
      { inst: 'strings', vol: 0.5, pan: 0.3, echo: 0.12, q: 4, range: [55, 70], voices: 3,
        pat: 'l16 a b c b a b c b a b c b a b c b' },
      { inst: 'thin', vol: 0.22, pan: -0.4, echo: 0.3, q: 3, range: [67, 82], voices: 3,
        pats: { I: '', A2: "l8 c b a b c b a b" } },
      { inst: 'synbass', vol: 0.66, q: 5, range: [31, 50], pats: { I: 'l8 R R R R R R R R', A: 'l8 !R R R R !R R R R', B: 'l8 !R R O R !R R O R', A2: 'l8 !R R R R !R R R R' } },
      { inst: 'timp', vol: 0.5, echo: 0.1, range: [36, 50], pats: { I: 'l4 R r r r', A: 'l4 R r R r', B: 'l2 R R', A2: 'l4 R r R r' } },
      { inst: 'drums', vol: 0.45, echo: 0.06, mml: `
        k8 r8 r4 k8 k8 r4 | k8 r8 r4 l16 s s s s s s s s l8 |
        L [$TA]7 ${FILL} [$TB]7 ${FILL} [$TA]7 ${FILL}` },
    ],
  };

  // ================================================================ boss2 地方ボス・終盤の中ボス
  // F minor, ♩=148 — heavier than boss: brass chords over a bass that sinks by half steps
  // (F E E♭ D), timpani, a Neapolitan G♭, a running trumpet section.
  // Intro 4 + A (8) A' (8) B (8) C (8) D (4) — loop 36 bars ≈ 58 s.
  M.boss2 = {
    tempo: 148, key: 'Fm', gain: 0.72,
    echo: { time: 0.203, fb: 0.25, wet: 0.18, lp: 2600 },
    chords: `
      @I Fm | Fm | Db | C7 |
      L @A Fm | FmM7/E | Fm7/Eb | Fm6/D | Db | Bbm/Db | C7sus4 | C7 |
      Fm | FmM7/E | Fm7/Eb | Fm6/D | Db | Gb | C7 | Fm |
      @B Db | Eb | Cm | Fm | Bbm | Eb7 | Ab | C7 |
      @C Fm | Db | Bbm | C | Fm | Db | Bbm C7 | C7 |
      @D Db | Bdim7 | C7sus4 | C7 |`,
    defs: {
      A: 'o4 f4. f8 a-4 o5 c4 | o5 c2 o4 a-4 f4 | o5 e-4. d-8 c4 o4 a-4 | o4 f2 d4 f4 | o4 a-4. a-8 o5 d-4 f4 | o5 f2 d-4 o4 b-4 | o5 c4 f4 g4 b-4 | o5 e2 c2 |',
      A2: 'o4 f4. f8 a-4 o5 c4 | o5 c4 e4 f4 a-4 | o6 c2 o5 b-4 a-4 | o5 a-2 f2 | o5 f4. e-8 d-4 f4 | o5 g-2 b-4 o6 d-4 | o6 c4 o5 b-4 g4 e4 | o5 f1 |',
      B: 'o4 f2 a-2 | o4 g2 b-2 | o4 g2 o5 c2 | o4 a-1 | o4 b-2 o5 d-2 | o5 d-2 o4 b-4 g4 | o5 c2 e-2 | o5 e2 g2 |',
      C: `o5 f8 e-8 c8 e-8 f8 a-8 g8 f8 | o5 f8 e-8 d-8 c8 d-8 f8 a-8 f8 | o5 f8 e-8 d-8 e-8 f8 b-8 a-8 f8 | o5 e8 f8 g8 f8 e8 d8 c8 o4 b8 |
          o5 c8 f8 a-8 f8 o6 c8 o5 a-8 f8 a-8 | o5 d-8 f8 a-8 f8 o6 d-8 o5 a-8 f8 a-8 | o5 b-8 a-8 f8 d-8 e8 g8 b-8 o6 c8 | o6 c4 o5 b-4 g4 e4 |`,
      D: 'o5 a-2 f2 | o5 f2 d2 | o5 f2 g2 | o5 e1 |',
      BD: '{kc}8 h8 s8 k8 k8 h8 s8 h8 | k8 h8 s8 k8 k8 h8 s8 h8 | k8 h8 s8 k8 k8 h8 s8 h8 | k8 h8 s8 k8 k8 s16 s16 t16 t16 f16 f16 |',
      BC: '{kc}8 k8 s8 k8 k8 k8 s8 k8 |',
    },
    ch: [
      { inst: 'trumpet', vol: 1, pan: 0.05, echo: 0.22, mml: `
        o4 q6 f8 r8 f8 r8 f8 f8 r4 | f8 r8 f8 r8 a-8 g8 f8 e8 | q8 d-2 f2 | e2 g2 |
        L q7 $A $A2 @brass $B @trumpet q6 $C q8 @brass $D @trumpet` },
      { inst: 'brass', harm: 0, oct: -1, min: 46, vol: 0.5, pan: -0.3, echo: 0.2 },
      { inst: 'horn', vol: 0.45, pan: 0.3, echo: 0.2, range: [50, 67], voices: 3,
        pats: { I: 'q6 C2 C2', A: 'q7 C2 C2', B: 'C1', C: 'l4 C r C r', D: 'C1' } },
      { inst: 'strings', vol: 0.55, pan: 0.35, echo: 0.15, q: 3, range: [55, 72], voices: 3,
        pats: { I: 'q8 C1', A: 'l8 C r C r r C r C', B: 'q8 C2 C2', C: 'l16 a b c b a b c b a b c b a b c b', D: 'l8 C C C C C C C C' } },
      { inst: 'synbass', vol: 0.66, q: 6, range: [28, 46],
        pats: { I: 'l4 R R R R', A: 'l8 !R R O R R R O R', B: 'l8 !R R R R !R R R R', C: 'l8 !R O R O R O R O', D: 'l8 R R R R R R R R' } },
      { inst: 'timp', vol: 0.55, echo: 0.1, range: [36, 50],
        pats: { I: 'l4 R r R r', A: 'l4 R r R r', B: 'l2 R R', C: 'l4 R r r r', D: 'l8 R R l4 R r R' } },
      { inst: 'drums', vol: 0.4, echo: 0.06, mml: `
        {bc}4 r4 b4 r4 | b4 r4 b4 b4 | {bc}4 r4 b8 b8 b4 | ${FILL}
        L [$BD]4 [{kc}4 h8 h8 s4 h8 k8 | k4 h8 h8 s4 h8 h8 |]4 [$BC]7 l16 s s t t m m f f s s t t m m f f l8 |
        {kc}4 r4 b4 r4 | b4 r4 b4 r4 | b4 b4 b4 b4 | ${FILL}` },
    ],
  };

  // ================================================================ rarebattle 金色・レア魔物・鋼
  // E major, ♩=172: "don't let it get away!" — a bright pulse tune doubled by glockenspiel on
  // the repeat, a bass that hops octaves, off-beat string skank, woodblock in the chase.
  // Intro 2 + A (8) A' (8, glock) B (8) C (4, stop-time) — loop 28 bars ≈ 39 s.
  M.rarebattle = {
    tempo: 172, key: 'E', gain: 0.96,
    echo: { time: 0.174, fb: 0.25, wet: 0.2, lp: 4000 },
    chords: `
      @I B7 | B7 |
      L @A E | A | E | B7 | E | A | F#m7 B7 | E |
      @A2 E | A | E | B7 | E | A | F#m7 B7 | E |
      @B C#m | A | E | B | C#m | A | F#7 | B7 |
      @C E | A | B7 | B7 |`,
    defs: {
      RA: `o5 e8 g+8 b8 g+8 o6 e4 o5 b4 | o5 a8 o6 c+8 e8 c+8 o5 a4 e4 | o5 g+8 a8 b8 o6 c+8 e4 c+4 | o5 b4 a4 f+4 d+4 |
           o5 e8 g+8 b8 g+8 o6 e4 o5 b4 | o6 c+8 d8 e8 c+8 o5 a4 o6 c+4 | o5 a8 g+8 f+8 e8 d+8 f+8 a8 b8 | o6 e4 o5 b4 e2 |`,
      RB: `o5 g+4 g+8 g+8 e4 g+4 | o5 a4 a8 a8 e4 c+4 | o5 b4 b8 b8 g+4 e4 | o5 f+4 d+4 f+4 b4 |
           o6 c+4 o5 b8 o6 c+8 e4 c+4 | o6 c+4 o5 a4 e4 a4 | o5 a+4 o6 c+4 e4 o5 a+4 | o5 b4 r4 d+8 e8 f+8 a8 |`,
      RC: 'o5 e8 r8 e8 r8 g+8 r8 b8 r8 | o5 a8 r8 a8 r8 o6 c+8 r8 e8 r8 | o5 b8 o6 d+8 f+8 a8 o5 b8 a8 f+8 d+8 | o5 b4 r4 {b>d+}4 r4 |',
      DA: 'k8 h8 s8 h8 k8 h8 s8 h8 |',
      DF: 'k8 h8 s8 h8 s16 s16 s16 s16 s8 s8 |',
      DB: 'k8 w8 s8 w8 k8 k8 s8 w8 |',
    },
    ch: [
      { inst: 'pulse', vol: 1, pan: 0.05, echo: 0.22, mml: `
        o5 q5 b8 r8 b8 r8 b8 b8 r4 | l16 d+ e f+ g+ a b >c+ d+ l8 d+4 r4< |
        L q5 $RA $RA q6 $RB q4 $RC` },
      { inst: 'square', harm: 0, vol: 0.34, pan: -0.3, echo: 0.2 },
      { inst: 'glock', vol: 0.36, pan: 0.35, echo: 0.3, mml: `
        r1 | r1 |
        L [r1 |]8 k12 $RA k0 [r1 |]8 [r1 |]4` },
      { inst: 'strings', vol: 0.42, pan: 0.3, echo: 0.12, q: 3, range: [56, 72], voices: 3,
        pats: { I: 'l8 C r C r C C r4', A: 'l8 r C r C r C r C', B: 'l8 C r r C r C r r', C: 'l8 C r C r C r C r' } },
      { inst: 'bass', vol: 0.66, q: 4, range: [36, 55],
        pats: { I: 'l8 R r R r R R r4', A: 'l8 R O R O R O R O', B: "l8 R O F O R O F O", C: 'l8 R r O r R r O r' } },
      { inst: 'drums', vol: 0.42, echo: 0.06, mml: `
        {kc}8 r8 {ks}8 r8 {ks}8 {ks}8 r4 | l16 s s s s s s s s l8 {kc}8 s8 s8 s8 |
        L [$DA]7 $DF [$DA]7 $DF [$DB]7 $DF
        k8 r8 k8 r8 k8 r8 k8 r8 | k8 r8 k8 r8 s8 r8 s8 r8 | l16 [s]16 l8 | {kc}4 r4 l16 s s t t m m f f l8 |` },
    ],
  };

  // ================================================================ superboss 円環竜オウロボラ
  // E-flat minor, ♩=168, five parts: prelude (organ, choir, gong) · main (brass theme A B A')
  // · a quiet middle (choir with celesta, heartbeat drums) · the rise (sixteenth strings,
  // climbing trumpet) · the loop turn (brass calls on C♭ / B♭7, A°7). Intro 4 + loop 48 ≈ 74 s.
  M.superboss = {
    tempo: 168, key: 'Ebm', gain: 0.73,
    echo: { time: 0.179, fb: 0.26, wet: 0.2, lp: 2800 },
    chords: `
      @I Ebm | Cb | Abm | Bb7 |
      L @A Ebm | Ebm | Cb | Bb7 | Ebm | Ebm | Abm | Bb7 |
      @B Gb | Db | Ebm | Bbm | Cb | Gb/Bb | Abm7 | Bb7 |
      @A Ebm | Ebm | Cb | Bb7 | Ebm | Gb | Abm Bb7 | Ebm |
      @Q Ebm | Cb | Gb | Db | Ebm | Cb | Abm | Bb7sus4 Bb7 |
      @U Cb | Db | Ebm | Ebm7/Db | Cb | Db | Ebm/Bb | Bb7 |
      @Z Cb | Bb7 | Cb | Bb7 | Ebm | Cb | Adim7 | Bb7 |`,
    defs: {
      A5: 'o4 b-4 b-8 b-8 o5 e-4 o4 b-4 | o5 g-4. f8 e-4 d-4 | o5 e-2 g-4 e-4 | o5 d2 f2 | o4 b-4 b-8 b-8 o5 e-4 g-4 |',
      A: '$A5 o5 b-4. a-8 g-4 e-4 | o5 c-4 e-4 a-4 g-4 | o5 f2 d2 |',
      A2: '$A5 o5 b-4. a-8 g-4 e-4 | o5 c-4 e-4 d4 f4 | o5 e-1 |',
      B: 'o5 b-2 o6 d-2 | o5 a-2 f2 | o5 g-4. f8 e-2 | o5 f1 | o5 g-2 b2 | o5 b-2 o6 d-2 | o5 b2 a-2 | o5 a-2 d2 |',
      Q: 'o5 g-1 | o5 g-1 | o5 d-1 | o5 f1 | o5 g-2 e-2 | o5 e-2 g-2 | o5 e-2 c-2 | o5 e-2 d2 |',
      U: 'o4 g-2 b2 | o5 d-2 f2 | o5 e-2 g-2 | o5 b-2 o6 d-2 | o5 b2 o6 e-2 | o6 d-2 f2 | o6 e-2 o5 b-2 | o6 d1 |',
      Z: 'o5 e-2 g-2 | o5 f2 d2 | o5 g-2 b2 | o5 a-2 f2 | o5 b-1 | o5 b1 | o6 c2 e-2 | o5 b-2 o6 d2 |',
      SA: '{kc}8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 s16 s16 s8 h8 |',
    },
    ch: [
      { inst: 'organ', vol: 1, pan: 0.05, echo: 0.25, mml: `
        o4 q8 b-1 | o4 b1 | o5 e-1 | o5 d1 |
        L q7 @trumpet $A $B $A2 q8 @choir $Q q7 @trumpet $U $Z` },
      { inst: 'brass', harm: 0, oct: -1, min: 46, vol: 0.45, pan: -0.3, echo: 0.2 },
      { inst: 'organ', vol: 0.3, pan: -0.2, echo: 0.25, range: [51, 66], voices: 3, pats: { I: 'C1', U: 'C2 C2', Z: 'C1' } },
      { inst: 'choir', vol: 0.38, pan: 0.25, echo: 0.3, range: [56, 72], voices: 3, pats: { I: 'C1', A: '', B: 'C1', Q: '', U: 'C1', Z: 'C2 C2' } },
      { inst: 'strings', vol: 0.52, pan: 0.35, echo: 0.15, q: 3, range: [55, 72], voices: 3,
        pats: { I: '', A: 'l8 C r C r r C r C', B: 'q8 C2 C2', Q: '', U: 'l16 a b c b a b c b a b c b a b c b', Z: 'l8 C C C C C C C C' } },
      { inst: 'celesta', vol: 0.3, pan: -0.4, echo: 0.45, range: [63, 79], voices: 3, pats: { I: '', Q: "l8 a c b c a' c b c", U: '' } },
      { inst: 'synbass', vol: 0.66, q: 6, range: [27, 46],
        pats: { I: 'R1', A: 'l8 !R R O R R O R O', B: 'l8 !R R R R !R R R R', Q: 'R1', U: 'l8 R R R R R R R R', Z: 'l8 !R O R O R O R O' } },
      { inst: 'timp', vol: 0.5, echo: 0.1, range: [36, 50],
        pats: { I: 'l4 R r r r', A: 'l4 R r R r', B: 'l2 R R', Q: 'R1', U: 'l4 R R R R', Z: 'l4 R r R R' } },
      { inst: 'drums', vol: 0.42, echo: 0.06, mml: `
        {gc}1 | b1 | b2 b2 | ${FILL}
        L [$SA]4
        [{kc}4 h8 h8 s4 h8 k8 | k4 h8 h8 s4 h8 h8 |]3 {kc}4 h8 h8 s4 h8 k8 | ${FILL}
        [$SA]4
        [b4 r4 b8 r8 r4 |]7 b4 r4 l16 s s s s s s s s l8 |
        [k8 k8 s8 k8 k8 k8 s8 k8 |]6 ${FILL} {kc}4 r4 {kc}4 r4 |
        [{kc}8 h8 s8 h8 k8 k8 s8 h8 |]6 k8 k8 s8 k8 k8 k8 s8 k8 | ${FILL}` },
    ],
  };

  // ================================================================ hollowking 虚ろの王
  // B minor, ♩=132: grains of dissonant celesta and bell (clusters, left out of the harmony
  // lint on purpose), low drums, an oboe line; then four bars where everything falls away but
  // a pad and one far bell — a blank page — before the violin comes back.
  // Intro 2 + A (8) B (8) blank (4) C (8) — loop 28 bars ≈ 51 s.
  M.hollowking = {
    tempo: 132, key: 'Bm', gain: 0.84,
    echo: { time: 0.341, fb: 0.4, wet: 0.3, lp: 2600 },
    chords: `
      @I Bm | Bm |
      L @A Bm | Bm | G | F#7 | Bm | Bm7 | C | F#7 |
      @B G | Em | C | B7 | Em | C | F#7 | F#7 |
      @W Bm | Bm | G | F#7 |
      @C Bm | G | Em | F#7 | Bm | G | C | F#7 |`,
    defs: {
      A: 'o5 f+2 d2 | o4 b2. r4 | o5 d2 o4 b2 | o4 a+2 o5 c+2 | o5 f+2 b2 | o5 a2 f+2 | o5 g2 e2 | o5 e2 c+2 |',
      B: 'o5 d4. e8 d2 | o5 b4. a8 g2 | o5 e4. f+8 g2 | o5 f+1 | o5 g4. f+8 e2 | o5 e4. d8 c2 | o5 c+2 e2 | o4 a+1 |',
      C: 'o5 b4 a+8 b8 o6 d4 f+4 | o6 d2 o5 b2 | o5 g4 b4 o6 e4 o5 b4 | o5 a+2 o6 c+2 | o5 f+4 b4 o6 d4 f+4 | o6 g2 d2 | o6 e2 c2 | o5 a+2 o6 c+2 |',
      GR: 'o6 {bc}8 r8 r8 {f+g}8 r4 {c+d}8 r8 | r8 {ef}8 r4 {a+b}8 r8 r4 |',
      BL: 'o5 {fb}2 r2 | r1 | o5 {gc+}2 r2 | r1 |',
      HD: 'b4 r8 f8 r4 f8 f8 |',
    },
    ch: [
      { inst: 'oboe', vol: 1, pan: 0.05, echo: 0.35, mml: `
        o5 q7 r1 | r1 |
        L $A $B [r1 |]4 @violin $C @oboe` },
      { inst: 'clarinet', harm: 0, vol: 0.3, pan: -0.3, echo: 0.3 },
      { inst: 'celesta', vol: 0.36, pan: 0.4, echo: 0.5, noLint: true, mml: `
        $GR
        L [$GR]4 [$GR]4 [r1 |]4 [$GR]4` },
      { inst: 'bell', vol: 0.3, pan: -0.45, echo: 0.6, noLint: true, mml: `
        r1 | r1 |
        L [$BL]2 [o5 {eb-}2 r2 | r1 | r1 | r1 |]2 o5 {bf}1 | r1 | r1 | r1 | [$BL]2` },
      { inst: 'pad', vol: 0.3, pan: 0, echo: 0.35, pat: 'C1', range: [50, 65], voices: 3 },
      { inst: 'strings', vol: 0.36, pan: 0.25, echo: 0.2, q: 3, range: [54, 70], voices: 3,
        pats: { I: '', B: 'C2 C2', W: '', C: 'l8 C r C r C r C r' } },
      { inst: 'contra', vol: 0.62, range: [28, 45], pats: { I: 'R1', A: 'l2 R R', B: 'R1', W: 'R1', C: 'l4 R R R R' } },
      { inst: 'drums', vol: 0.5, echo: 0.2, mml: `
        b2 r2 | b4 r4 f8 f8 f8 f8 |
        L [$HD]16 [r1 |]3 l16 v4 f f f f v6 f f f f v8 f f f f v10 f f f f l8 v12 | [$HD]8` },
    ],
  };

  Object.assign(R.DB.music, M);
})(window.RPG);
