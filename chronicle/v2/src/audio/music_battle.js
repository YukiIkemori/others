// Music (battles): battle, boss, lastboss (Chronicle), valzard (Crest's lastboss). Original compositions; format
// documented at the top of src/core/audio.js.
(function (R) {
  'use strict';
  const M = {};

  // ================================================================ battle
  // E minor, 164 bpm. Intro hits + run (2), A A' (16), heroic B (8), driving C (8).
  M.battle = {
    tempo: 164, key: 'Em', gain: 0.74,
    echo: { time: 0.183, fb: 0.22, wet: 0.16, lp: 3000 },
    chords: `
      @I Em | B7 |
      L @A Em | D | C | B7 | Em | Am | F#m7b5 B7 | Em |
      Em | D | C | B7 | Em | Am | Am B7 | Em |
      @B C | D | Bm | Em | C | D | B7sus4 B7 | B7 |
      @C Em | F | Em7 | F | Am | G#dim7 | B7 | B7 |`,
    defs: {
      A6: 'o5 e4. f+8 g4 b4 | a4. g8 f+2 | g4. a8 >c4 e4< | >d+2. r8 <b8 | >e4. d8 <b4 g4 | >c4. <b8 a4 e4 |',
      A: '$A6 f+4 a4 b4 >d+4< | >e2.< r4 |',
      A2: '$A6 >c4 <b4 a4 f+4 | e2. r4 |',
      B: 'o5 e2 g4 >c4< | >d2< a4 f+4 | b2. f+4 | g2 e2 | e4 g4 >c4 e4< | >d4 c4 <a4 f+4 | >e2 d+2< | b4 a4 f+4 d+4 |',
      C: 'o5 e8 f+8 g8 a8 b4 g4 | a8 g8 f8 e8 f4 c4 | g8 a8 b8 >c8 d4 <b4 | >c8 <b8 a8 g8 a4 f4 | a8 b8 >c8 d8 e4 c4 | <b8 >c8 d8 e8 f4 d4< | d+8 e8 f+8 g8 a4 f+4 | b8 r8 b8 r8 b4 r4 |',
      DA: '{kc}8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 s16 s16 s8 s8 |',
      DB: '{kc}8 h8 s8 h8 k8 h8 s8 h8 | k8 h8 s8 h8 k8 h8 s8 k8 | k8 h8 s8 h8 k8 h8 s8 h8 | k8 h8 s8 k8 s16 s16 t16 t16 m16 m16 f16 f16 |',
      DC: '{kc}8 k8 s8 k8 k8 k8 s8 k8 | k8 k8 s8 k8 k8 k8 s8 k8 | k8 k8 s8 k8 k8 k8 s8 k8 | k8 k8 s8 k8 k8 s16 s16 t16 t16 m16 m16 |',
      DC2: '{kc}8 k8 s8 k8 k8 k8 s8 k8 | k8 k8 s8 k8 k8 k8 s8 k8 | l16 s s s s t t t t m m m m f f f f | l8 {kc}8 r8 {ks}8 r8 {ks}8 r8 s16 s16 s16 s16 |',
    },
    ch: [
      { inst: 'pulse', vol: 1, pan: 0.05, echo: 0.25, mml: `
        o5 q6 e8 r8 e8 r8 e8 e8 r4 | l16 <b >c d+ e f+ g a b l8 >d+4 <b4 |
        L q7 $A $A2 @square $B @pulse $C` },
      { inst: 'brass', harm: 0, oct: -1, min: 46, vol: 0.5, pan: -0.3, echo: 0.2 },
      { inst: 'strings', vol: 0.63, pan: 0.3, echo: 0.15, q: 3, range: [55, 72], voices: 3,
        pats: { I: 'l8 C r C r C C r4', A: 'l8 C r r C r C r r', B: 'q8 C1', C: 'l8 q3 C r C r r C r C' } },
      { inst: 'thin', vol: 0.2, pan: -0.4, echo: 0.3, q: 4, range: [64, 76], voices: 3,
        pats: { I: '', A: 'l16 a b c b a b c b', B: "l16 a b c a' b' c' b' c" } },
      { inst: 'synbass', vol: 0.75, q: 6, range: [28, 47],
        pats: { I: 'l8 R r R r R R r4', A: 'l8 !R R O R R O R O', B: 'l8 !R R R R !R R R R', C: 'l8 !R O R O R O R O' } },
      { inst: 'timp', vol: 0.6, echo: 0.1, mml: `
        o2 e8 r8 e8 r8 e8 e8 r4 | b8 r8 b8 r8 [b16]8 |
        L [e4 r2. | r1 | r1 | b4 r4 b4 b4 | e4 r2. | r1 | r1 | e4 r2. |]2
        c4 r2. | d4 r2. | b4 r2. | e4 r2. | c4 r2. | d4 r2. | b4 r2. | [b16]8 b4 b4 |
        e4 r2. | f4 r2. | e4 r2. | f4 r2. | a4 r2. | r1 | b4 r2. | b8 r8 b8 r8 b4 r4 |` },
      { inst: 'drums', vol: 0.42, echo: 0.06, mml: `
        {kc}8 r8 {ks}8 r8 {ks}8 {ks}8 r4 | l16 s s s s s s s s s s s s l8 {kc}8 s8 |
        L $DA $DA $DA $DA $DB $DB $DC $DC2` },
    ],
  };

  // ================================================================ boss
  // C minor, 150 bpm, intense: menacing intro, brass theme over a pounding
  // riff with Neapolitan D-flat, desperate string bridge, chromatic run section.
  M.boss = {
    tempo: 150, key: 'Cm', gain: 0.79,
    echo: { time: 0.2, fb: 0.25, wet: 0.18, lp: 2600 },
    chords: `
      @I Cm | Cm | Ab | G7 |
      L @A Cm | Ab Fm | Cm | Db | Cm | Ab | Fm | G7 |
      Cm | Ab Fm | Cm | Db | Fm | Db | G7sus4 | G7 |
      @B Ab | Bb | Gm7 | Cm | Ab | Bb | Db | G7 |
      @C Fm | G | Ab | Bdim7 | Fm | Db | Dm7b5 G7 | G7 |`,
    defs: {
      A4: 'o5 c4. c8 e-4 g4 | a-4. g8 f4 e-4 | g4. g8 >c4 <g4 | >d-4. c8 <a-4 f4 |',
      A: '$A4 g2 e-4 c4 | e-4. d8 c4 <a-4> | f2 a-4 >c4< | <b2 >d4 f4 |',
      A2: '$A4 a-2 f4 c4 | f4. e-8 d-4 f4 | c2 d4 g4 | <b2 >d2 |',
      B: 'o4 e-2 a-4 >c4 | d2 <b-4 f4 | g2 b-4 >d4 | e-2 c4 <g4 | a-2 >c4 e-4 | f2 d4 <b-4 | >f2 a-4 >d-4< | d2 <b2 |',
      C: 'o5 f8 g8 a-8 b-8 >c4 <a-4 | b8 a-8 g8 f8 g4 d4 | a-8 b-8 >c8 d-8 c4 <a-4 | >d8 c8 <b8 a-8 f4 d4 | >c8 <b-8 a-8 g8 a-4 f4 | f8 e-8 d-8 c8 d-4 a-4 | a-4 f4 g4 b4 | >d8 r8 d8 r8 d4 <b4 |',
      DA: '{kc}8 h8 s8 k8 k8 h8 s8 h8 | k8 h8 s8 k8 k8 h8 s8 h8 | k8 h8 s8 k8 k8 h8 s8 h8 | k8 h8 s8 k8 k8 s16 s16 t16 t16 f16 f16 |',
      DC: '{kc}8 k8 s8 k8 k8 k8 s8 k8 | k8 k8 s8 k8 k8 k8 s8 k8 | k8 k8 s8 k8 k8 k8 s8 k8 | l16 s s t t m m f f s s t t m m f f l8 |',
    },
    ch: [
      { inst: 'trumpet', vol: 1, pan: 0.05, echo: 0.22, mml: `
        o4 q7 c4 r4 c4 d-8 c8 | c4 r4 c4 <g4> | a-2 e-2 | g1 |
        L $A $A2 @violin $B @trumpet $C` },
      { inst: 'brass', harm: 0, oct: -1, min: 46, vol: 0.5, pan: -0.3, echo: 0.2 },
      { inst: 'strings', vol: 0.63, pan: 0.3, echo: 0.15, q: 3, range: [53, 70], voices: 3,
        pats: { I: 'q8 C1', A: 'l8 C r C r r C r C', B: 'q8 C2 C2', C: 'l8 C r r C r r C r' } },
      { inst: 'organ', vol: 0.28, pan: -0.2, echo: 0.2, pat: 'C1', range: [48, 64], voices: 3 },
      { inst: 'synbass', vol: 0.65, q: 6, range: [28, 46],
        pats: { I: 'l4 R R R R', A: 'l8 !R R O R R R O F', B: 'l8 !R R R R !R R R R', C: 'l8 !R O R O R O R O' } },
      { inst: 'timp', vol: 0.53, echo: 0.1, mml: `
        o2 c4 r4 c4 r4 | c4 r4 c4 r4 | a-4 r4 a-4 r4 | [g16]8 g4 g4 |
        L [c4 r2. | a-4 r4 f4 r4 | c4 r2. | d-4 r2. | c4 r2. | a-4 r2. | f4 r2. | g4 r4 g8 g8 g4 |]2
        a-4 r2. | b-4 r2. | g4 r2. | c4 r2. | a-4 r2. | b-4 r2. | d-4 r2. | [g16]8 g4 g4 |
        f4 r2. | g4 r2. | a-4 r2. | b4 r2. | f4 r2. | d-4 r2. | d4 r4 g4 r4 | g8 r8 g8 r8 g4 r4 |` },
      { inst: 'drums', vol: 0.37, echo: 0.06, mml: `
        {bc}1 | b2 b2 | b2 b4 b4 | l16 s s s s t t t t m m m m f f f f l8 |
        L $DA $DA $DA $DA $DA $DA $DC $DC` },
    ],
  };

  // ================================================================ valzard 魔王の残影
  // Crest's final battle, moved here unchanged (DESIGN §11.10.3: "今のクレストの lastboss の
  // 定義をそのまま"). D minor, 158 bpm, epic & multi-section: organ/choir intro, driving A,
  // dark lyrical B, Crest's main theme turned minor (C), chromatic diminished climb (D).
  M.valzard = {
    tempo: 158, key: 'Dm', gain: 0.72,
    echo: { time: 0.19, fb: 0.25, wet: 0.2, lp: 2800 },
    chords: `
      @I Dm | Bb | Gm | A7 |
      L @A Dm | Dm | Bb | C | Dm | Dm | Gm | A7 |
      Dm | Dm | Bb | C | Gm | Bb | A7sus4 | A7 |
      @B Bb | C | Am | Dm | Gm | C | F | A7 |
      @C Dm | C | Bb | A | Dm | Bb | A7 | A7 |
      @D Bb | Bdim7 | C | C#dim7 |`,
    defs: {
      A4: 'o5 d8 d8 a8 d8 >d4 <a4 | f8 e8 d8 e8 f4 a4 | b-8 b-8 f8 b-8 >d4 <b-4 | >c8 <b-8 a8 b-8 g4 e4 |',
      A: '$A4 d8 d8 a8 d8 f4 a4 | >d8 c8 <a8 >c8 d4 <a4 | b-8 a8 g8 a8 b-4 >d4< | >c+2 <a2 |',
      A2: '$A4 g8 g8 >d8 <g8 b-4 >d4< | >d8 c8 <b-8 a8 b-4 f4 | >d2 <a4 >d4< | >c+2 <a4 e4 |',
      B: 'o5 d2 f4 b-4 | >c2 <g4 e4 | a2 >c4 e4< | >d2. <a4 | b-2 >d4 <b-4 | >c2 e4 g4< | >f2 c4 <a4 | >e2 c+2< |',
      C: 'o5 d4. e8 a2 | g4. f8 e4 d4 | <b-4. >c8 d4 f4 | e1 | d4. e8 a2 | b-4. >c8 d2< | >c+4. <b-8 a4 g4 | c+4 e4 g4 a4 |',
      D: 'o4 b-2 >d2< | b2 >d2< | >c2 e2< | >c+2 e2< |',
      DA: '{kc}8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 s16 s16 t16 t16 m16 m16 |',
      DB: '{kc}4 h8 h8 s4 h8 k8 | k4 h8 h8 s4 h8 h8 | k4 h8 h8 s4 h8 k8 | k4 h8 h8 s8 s8 t8 m8 |',
    },
    ch: [
      { inst: 'organ', vol: 1, pan: 0.05, echo: 0.25, mml: `
        o4 q8 d2. a4 | b-2. f4 | g2. b-4 | a1 |
        L q7 @trumpet $A $A2 @violin $B @trumpet $C @brass $D` },
      { inst: 'brass', harm: 0, oct: -1, min: 46, vol: 0.45, pan: -0.3, echo: 0.2 },
      { inst: 'organ', vol: 0.3, pan: -0.2, echo: 0.25, pat: 'C1', range: [50, 65], voices: 3 },
      { inst: 'choir', vol: 0.4, pan: 0.25, echo: 0.3, range: [57, 72], voices: 3, pats: { I: 'C1', A: '', B: 'C1', D: 'C2 C2' } },
      { inst: 'strings', vol: 0.55, pan: 0.35, echo: 0.15, q: 3, range: [55, 72], voices: 3,
        pats: { I: '', A: 'l8 C r C r r C r C', B: 'q8 C2 C2', C: 'l8 C r r C r C r r', D: 'l8 C C C C C C C C' } },
      { inst: 'harpsi', vol: 0.3, pan: -0.4, echo: 0.2, q: 5, range: [62, 74], voices: 3,
        pats: { I: '', A: '', C: 'l16 a b c b a b c b', D: "l16 a b c a' b' c' b' a'" } },
      { inst: 'synbass', vol: 0.69, q: 6, range: [28, 46],
        pats: { I: 'R1', A: 'l8 !R R O R R O R O', B: 'l4 R R R R', C: 'l8 !R R R R !R R R R', D: 'l8 R R R R R R R R' } },
      { inst: 'timp', vol: 0.47, echo: 0.1, mml: `
        o2 d4 r2. | b-4 r2. | g4 r2. | [a16]8 a4 a4 |
        L d4 r2. | d4 r4 a4 r4 | b-4 r2. | c4 r2. | d4 r2. | d4 r4 a4 r4 | g4 r2. | a4 r4 a8 a8 a4 |
        d4 r2. | d4 r4 a4 r4 | b-4 r2. | c4 r2. | g4 r2. | b-4 r2. | a4 r2. | [a16]8 a4 a4 |
        b-4 r2. | c4 r2. | a4 r2. | d4 r2. | g4 r2. | c4 r2. | f4 r2. | a4 r4 a8 a8 a4 |
        d4 r2. | c4 r2. | b-4 r2. | a4 r2. | d4 r2. | b-4 r2. | a4 r2. | [a16]8 a4 a4 |
        b-4 r4 b-8 b-8 b-4 | b4 r4 b8 b8 b4 | c4 r4 c8 c8 c4 | [c+16]16 |` },
      { inst: 'drums', vol: 0.45, echo: 0.06, mml: `
        {gc}1 | b1 | b2 b2 | l16 s s s s t t t t m m m m f f f f l8 |
        L $DA $DA $DA $DA $DB $DB $DA $DA
        {kc}8 k8 s8 k8 {kc}8 k8 s8 k8 | {kc}8 k8 s8 k8 {kc}8 k8 s8 k8 | {kc}8 k8 s8 k8 {kc}8 k8 s8 k8 | l16 s s s s t t t t m m m m f f f f l8 |` },
    ],
  };

  // ================================================================ lastboss ネムレア
  // 「語り部の主題」 in E minor, 4/4, ♩=160 (DESIGN §11.10.3): organ and choir prelude on the
  // motif head → the motif turned minor over driving strings (A) → a trumpet charge (A2) → horn
  // and choir (B) → the theme in G major on trumpet, "the name given back" (C) → a diminished
  // climb back to B7 (D). Intro 4 + loop 40 bars = 60 s.
  M.lastboss = {
    tempo: 160, key: 'Em', gain: 0.71,
    echo: { time: 0.188, fb: 0.25, wet: 0.2, lp: 2800 },
    chords: `
      @I Em*3 D | Em/D | Cmaj7 | B7 |
      L @A $TCM Em | C | Am6 B7 | Em |
      @A2 Em | D | C | B7 | Em | D | C Am | B7 |
      @B C | D | G | Em | Am | F#m7b5 | B7sus4 | B7 |
      @C Cmaj7 | Am | D | G | Cmaj7 | Am | G/D D7 | G |
      @D Em | C | Am | F#m7b5 | Cmaj7 | C#dim7 | B7sus4 | B7 |`,
    defs: {
      MIN_ANS: 'o5 e4. f+8 g4 b4 | o6 e4. d8 c2 | o6 c4 o5 b8 a8 b4 o6 d+4 | o6 e1 |',
      CHARGE: `o4 b4 o5 e4 d8 e8 f+8 g8 | o5 f+4. e8 d4 o4 a4 | o5 e4 d8 c8 o4 g4 o5 c4 | o4 b4. a8 f+4 d+4 |
               o4 e8 f+8 g8 a8 b4 o5 e4 | o5 d4. c8 o4 b4 a4 | o4 g4 e4 a4 o5 c4 | o4 b2 o5 d+2 |`,
      HORN: 'o4 e2 g2 | o4 f+2 a2 | o4 g2 b2 | o4 b1 | o4 a2 o5 c2 | o4 a2 f+2 | o4 e2 f+2 | o4 d+1 |',
      CLIMB: 'o5 g2 b2 | o6 c2 e2 | o6 c2 o5 a2 | o5 a1 | o5 g2 b2 | o5 a+2 g2 | o5 e1 | o5 d+1 |',
      LA: '{kc}8 h8 s8 h8 k8 k8 s8 h8 | k8 h8 s8 h8 k8 s16 s16 t16 t16 m16 m16 |',
      FILL: 'l16 s s s s t t t t m m m m f f f f l8 |',
    },
    ch: [
      { inst: 'organ', vol: 1, pan: 0.05, echo: 0.25, mml: `
        o4 q8 e2. f+4 | g2 b2 | >c1< | b1 |
        L q7 @violin o5 $TELLER4_MIN $MIN_ANS
        @trumpet $CHARGE
        q8 @horn $HORN
        q7 @trumpet o5 $TELLER4 $TELLER4_ANS
        @violin $CLIMB` },
      { inst: 'brass', harm: 0, oct: -1, min: 46, vol: 0.45, pan: -0.3, echo: 0.2 },
      { inst: 'organ', vol: 0.3, pan: -0.2, echo: 0.25, range: [50, 65], voices: 3, pats: { I: 'C1', A2: '', B: 'C1' } },
      { inst: 'choir', vol: 0.4, pan: 0.25, echo: 0.3, range: [57, 72], voices: 3, pats: { I: 'C1', A: '', B: 'C2 C2', C: 'C1' } },
      { inst: 'strings', vol: 0.55, pan: 0.35, echo: 0.15, q: 3, range: [55, 72], voices: 3,
        pats: { I: '', A: 'l8 C C C C C C C C', A2: 'l8 C r C r r C r C', B: 'q8 C2 C2', C: 'l8 C r r C r C r r', D: 'l16 a b c b a b c b a b c b a b c b' } },
      { inst: 'synbass', vol: 0.68, q: 6, range: [28, 47],
        pats: { I: 'R1', A: 'l8 !R R O R R O R O', A2: 'l8 !R R R R !R R R R', B: 'l4 R R R R', C: 'l8 !R O R O R O R O', D: 'l8 R R R R R R R R' } },
      { inst: 'timp', vol: 0.5, echo: 0.1, range: [36, 50],
        pats: { I: 'l4 R r r r', A: 'l4 R r R r', A2: 'l4 R r r r', B: 'l2 R R', C: 'l4 R r R R', D: 'l8 R R l4 R r R' } },
      { inst: 'drums', vol: 0.44, echo: 0.06, mml: `
        {gc}1 | b1 | b2 b2 | $FILL
        L [$LA]4 [$LA]4
        [{kc}4 h8 h8 s4 h8 k8 | k4 h8 h8 s4 h8 h8 |]3 {kc}4 h8 h8 s4 h8 k8 | k4 h8 h8 s8 s8 t8 m8 |
        {kc}8 h8 s8. s16 k8 h8 s8 h8 | [k8 h8 s8. s16 k8 h8 s8 h8 |]5 k8 h8 s8. s16 k8 k8 s16 s16 s8 | {kc}8 k8 s8 k8 {kc}8 k8 s8 k8 |
        [{kc}8 k8 s8 k8 k8 k8 s8 k8 |]6 l16 s s t t m m f f s s t t m m f f l8 | $FILL` },
    ],
  };

  Object.assign(R.DB.music, M);
})(window.RPG);
