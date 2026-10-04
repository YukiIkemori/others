// Sound effects (DESIGN §3). Each is a function of the SFX kit S (src/core/audio.js):
//   S.tone({w,n|f,n2|f2,t,d,a,r,vol,decay,sd,lin,lp/hp/bp(+2),q,fd,vib,det})
//   S.noise({t,d,a,r,vol,decay,lp/hp/bp(+2),q,fd,rate,rate2})
//   S.fm({n|f,n2,ratio,index,md,t,d,a,r,vol,decay})
//   S.seq(midiNotes, step, toneOpts)  S.bells(notes, step, fmOpts)  S.drum(key,t,vel)
//   S.wet(echoSend)  S.gain(v)
// Times are seconds from the trigger; n = MIDI note (69 = A4).
// Layering (design/notes/audio.md §SFX redesign): transient (a 3–4 ms click) + body (pitched or
// filtered noise with a falling pitch / closing filter) + tail (a short echo send); frequent sounds
// move a little on every play (rv / st) so repeated hits are never machine-identical.
(function (R) {
  'use strict';
  const X = {};
  // per-play variation: rv(a, b) a value in [a, b); st(s) a frequency factor of up to ±s semitones.
  // The render tools seed Math.random, so offline renders stay reproducible.
  const rv = (a, b) => a + Math.random() * (b - a);
  const st = (s) => Math.pow(2, rv(-s, s) / 12);

  // ---------------------------------------------------------------- UI
  X.cursor = (S) => {
    const det = rv(-8, 8);
    S.tone({ w: 'p25', n: 86, n2: 89, sd: 0.012, d: 0.012, r: 0.03, vol: 0.09, lp: 5000, det });
    S.tone({ w: 'triangle', n: 74, d: 0.01, r: 0.03, vol: 0.03, det });                                    // a rounder floor
  };
  X.confirm = (S) => {
    S.tone({ w: 'p25', n: 79, d: 0.035, r: 0.02, vol: 0.12, lp: 6000 });
    S.tone({ w: 'p25', n: 86, t: 0.045, d: 0.05, r: 0.08, vol: 0.12, lp: 6000 });
    S.wet(0.15);
  };


  X.confirm_soft = (S) => { S.tone({ w: 'triangle', n: 81, d: 0.02, r: 0.05, vol: 0.2 }); S.tone({ w: 'p25', n: 93, d: 0.008, r: 0.02, vol: 0.04 }); };
  X.cancel = (S) => {
    S.tone({ w: 'p25', n: 79, d: 0.03, r: 0.02, vol: 0.11, lp: 5000 });
    S.tone({ w: 'p25', n: 72, t: 0.04, d: 0.04, r: 0.06, vol: 0.11, lp: 5000 });
  };


  X.buzzer = (S) => {
    for (let i = 0; i < 2; i++) {
      S.tone({ w: 'p50', f: 110, t: i * 0.09, d: 0.06, r: 0.02, vol: 0.13, lp: 1600 });
      S.tone({ w: 'p50', f: 117, t: i * 0.09, d: 0.06, r: 0.02, vol: 0.1, lp: 1600 });
    }
  };
  X.menu_open = (S) => { S.seq([84, 88, 91, 96], 0.028, { w: 'p25', d: 0.03, r: 0.05, vol: 0.08, lp: 6000 }); S.wet(0.25); };


  // ---------------------------------------------------------------- battle: physical
  X.attack = (S) => {
    const k = st(1.5);
    S.noise({ a: 0.02, d: 0.05, r: 0.06, vol: 0.26, bp: 850 * k, bp2: 3000 * k, q: 1.3 });             // the blade's arc
    S.noise({ a: 0.02, d: 0.04, r: 0.05, vol: 0.12, bp: 450 * k, bp2: 1200 * k, q: 1.1 });               // the arm's air
  };

  X.hit = (S) => {
    const k = st(1.2);
    S.noise({ d: 0.003, r: 0.012, vol: 0.3, bp: 2600 * k, q: 0.8 });                                     // contact
    S.noise({ d: 0.015, r: 0.1, vol: 0.5, lp: 3600 * k, lp2: 700, fd: 0.1, rate: rv(0.85, 1) });          // crunch, darkening
    S.tone({ w: 'sine', f: 190 * k, f2: 52, sd: 0.1, d: 0.02, r: 0.11, vol: 0.6 });                      // thump
    S.tone({ w: 'triangle', f: 380 * k, f2: 150, sd: 0.04, d: 0.008, r: 0.05, vol: 0.18 });               // smack
    S.tone({ w: 'p50', f: 95 * k, f2: 40, sd: 0.06, d: 0.01, r: 0.05, vol: 0.15, lp: 900 });
    S.wet(0.07);
  };
  X.crit = (S) => {
    const k = st(1);
    S.duck(-3, 0.12);
    S.noise({ d: 0.004, r: 0.015, vol: 0.4, bp: 3000 * k, q: 0.7 });
    S.noise({ d: 0.02, r: 0.18, vol: 0.6, lp: 5000, lp2: 800, fd: 0.18, rate: rv(0.8, 0.95) });
    S.tone({ w: 'sine', f: 220 * k, f2: 45, sd: 0.16, d: 0.03, r: 0.16, vol: 0.75 });
    S.tone({ w: 'p50', f: 120 * k, f2: 35, sd: 0.12, d: 0.02, r: 0.1, vol: 0.2, lp: 1200 });
    S.tone({ w: 'triangle', f: 480 * k, f2: 170, sd: 0.05, d: 0.01, r: 0.07, vol: 0.18 });
    S.fm({ n: 96, ratio: 3.01, index: 1.5, md: 0.2, d: 0.01, r: 0.35, vol: 0.14, t: 0.01, lp: 7000 });
    S.tone({ w: 'sine', f: 62, f2: 34, sd: 0.3, t: 0.01, d: 0.04, r: 0.28, vol: 0.32 });                 // sub tail
    S.wet(0.25);
  };
  X.miss = (S) => { const k = st(2); S.noise({ d: 0.05, a: 0.02, r: 0.06, vol: 0.18, bp: 2200 * k, bp2: 5500 * k, q: 1.5 }); };

  X.enemy_attack = (S) => {
    const k = st(1.5);
    S.noise({ a: 0.02, d: 0.08, r: 0.07, vol: 0.28, bp: 420 * k, bp2: 1500 * k, q: 1.1 });
    S.noise({ a: 0.03, d: 0.07, r: 0.06, vol: 0.2, lp: 380, rate: 0.5 });                                // heavy air
    S.tone({ w: 'sawtooth', f: 110 * k, f2: 68, d: 0.1, r: 0.06, vol: 0.12, lp: 900, lp2: 500 });
    S.tone({ w: 'sawtooth', f: 165 * k, f2: 100, d: 0.09, r: 0.05, vol: 0.05, lp: 1200, det: 8 });       // growl a fifth up
    S.wet(0.1);
  };
  X.hurt = (S) => {
    const k = st(1);
    S.noise({ d: 0.003, r: 0.014, vol: 0.25, bp: 1900 * k, q: 0.9 });
    S.tone({ w: 'p50', f: 140 * k, f2: 48, sd: 0.1, d: 0.04, r: 0.12, vol: 0.3, lp: 1100 });
    S.noise({ d: 0.02, r: 0.13, vol: 0.42, lp: 1800, lp2: 500, fd: 0.12 });
    S.tone({ w: 'sine', f: 90 * k, f2: 42, sd: 0.13, d: 0.03, r: 0.13, vol: 0.5 });
    S.tone({ w: 'triangle', f: 300 * k, f2: 120, sd: 0.06, d: 0.01, r: 0.06, vol: 0.12 });
    S.wet(0.06);
  };

  // ---------------------------------------------------------------- battle: magic
  X.magic = (S) => {
    S.seq([72, 76, 79, 84, 88, 91], 0.03, { w: 'p25', d: 0.04, r: 0.08, vol: 0.08, lp: 7000 });
    S.fm({ n: 96, t: 0.18, ratio: 3.5, index: 1.2, md: 0.3, d: 0.02, r: 0.45, vol: 0.1 });
    S.wet(0.45);
  };


  X.fire = (S) => {
    S.tone({ w: 'sine', f: 95 * st(1), f2: 45, sd: 0.15, d: 0.02, r: 0.15, vol: 0.3 });                   // ignition
    S.noise({ d: 0.18, a: 0.03, r: 0.3, vol: 0.5, lp: 700, lp2: 3800, fd: 0.2, rate: 0.6 });
    S.noise({ t: 0.12, d: 0.12, a: 0.02, r: 0.25, vol: 0.35, lp: 2500, lp2: 600, fd: 0.3, rate: 0.5 });
    S.tone({ w: 'sawtooth', f: 70, f2: 180, sd: 0.25, d: 0.2, r: 0.2, vol: 0.14, lp: 700 });
    for (let i = 0; i < 6; i++) S.noise({ t: 0.05 + i * 0.06 + rv(-0.015, 0.015), d: 0.004, r: rv(0.015, 0.03), vol: rv(0.14, 0.22), bp: rv(3000, 4500), q: 0.8 });
    S.wet(0.2);
  };

  X.ice = (S) => {
    const notes = [96, 101, 98, 103, 100, 105];
    notes.forEach((n, i) => S.fm({ n, t: i * 0.045 + (i ? rv(-0.006, 0.006) : 0), ratio: 3.5, index: 1.5, md: 0.12, d: 0.005, r: 0.35, vol: 0.09 }));
    S.noise({ d: 0.004, r: 0.02, vol: 0.2, bp: 4000, q: 2 });                                              // the first crystal snaps
    S.noise({ a: 0.02, d: 0.05, r: 0.3, vol: 0.14, bp: 5500, q: 0.9 });
    S.tone({ w: 'triangle', n: 60, n2: 72, sd: 0.2, d: 0.15, r: 0.15, vol: 0.12 });
    S.wet(0.5);
  };

  X.thunder = (S) => {
    S.noise({ d: 0.02, r: 0.05, vol: 0.6, bp: 2500 * st(2), q: 0.7 });
    S.noise({ t: 0.03 + rv(0, 0.015), d: 0.01, r: 0.04, vol: 0.45, bp: 3500 * st(2), q: 0.8 });
    S.noise({ t: 0.02, d: 0.1, r: 0.9, vol: 0.55, lp: 420, rate: 0.5 });
    S.tone({ w: 'p50', f: 70, f2: 35, sd: 0.4, d: 0.1, r: 0.35, vol: 0.18, lp: 500 });
    S.wet(0.2);
  };



  X.wind = (S) => {
    S.noise({ d: 0.35, a: 0.12, r: 0.25, vol: 0.32, bp: 500, bp2: 2600, fd: 0.35, q: 2.5 });
    S.noise({ t: 0.15, d: 0.3, a: 0.1, r: 0.25, vol: 0.25, bp: 2800, bp2: 700, fd: 0.4, q: 3 });
    S.noise({ t: 0.05, a: 0.15, d: 0.3, r: 0.3, vol: 0.15, lp: 400, rate: 0.6 });                         // the gust's weight
    S.tone({ w: 'sine', f: 900, f2: 1400, sd: 0.4, t: 0.1, a: 0.1, d: 0.25, r: 0.2, vol: 0.02, vib: [5, 40] }); // a faint whistle
    S.wet(0.3);
  };

  X.holy = (S) => {
    [84, 88, 91, 96].forEach((n, i) => S.tone({ w: 'triangle', n, t: i * 0.04, a: 0.08, d: 0.35, r: 0.4, vol: 0.1, vib: [6, 12] }));
    S.bells([96, 100, 103, 107], 0.07, { t: 0.1, ratio: 4, index: 1.2, md: 0.2, d: 0.01, r: 0.5, vol: 0.07 });
    S.noise({ d: 0.3, a: 0.15, r: 0.3, vol: 0.06, hp: 7000 });
    S.wet(0.55);
  };
  X.dark = (S) => {
    S.tone({ w: 'sawtooth', f: 55, a: 0.18, d: 0.35, r: 0.3, vol: 0.2, lp: 200, lp2: 900, fd: 0.3, det: -12 });
    S.tone({ w: 'sawtooth', f: 58.3, a: 0.18, d: 0.35, r: 0.3, vol: 0.2, lp: 200, lp2: 900, fd: 0.3 });
    S.tone({ w: 'sine', n: 83, n2: 71, t: 0.05, a: 0.1, d: 0.3, r: 0.2, vol: 0.06, vib: [9, 40] });
    S.noise({ a: 0.2, d: 0.2, r: 0.3, vol: 0.15, lp: 500 });
    S.wet(0.4);
  };


  X.earth = (S) => {
    S.noise({ d: 0.15, r: 0.55, vol: 0.55, lp: 320, rate: 0.5 });
    S.tone({ w: 'sine', f: 70 * st(1), f2: 32, sd: 0.4, d: 0.1, r: 0.35, vol: 0.55 });
    S.noise({ a: 0.01, d: 0.06, r: 0.25, vol: 0.25, bp: 650, bp2: 350, q: 1.2, rate: 0.6 });            // rock grinding
    for (let i = 0; i < 4; i++) S.noise({ t: 0.08 + i * 0.09 + rv(-0.02, 0.02), d: 0.01, r: 0.06, vol: rv(0.22, 0.32), lp: rv(1100, 1700), rate: 0.7 });
    S.wet(0.15);
  };

  X.water = (S) => {
    [72, 79, 76, 84, 81, 88].forEach((n, i) => S.tone({ w: 'sine', n: n + rv(-0.3, 0.3), n2: n + 7, sd: 0.035, t: i * 0.05, d: 0.03, r: 0.04, vol: 0.18 }));
    S.noise({ d: 0.2, a: 0.05, r: 0.2, vol: 0.12, bp: 1800, bp2: 700, q: 1.5 });
    S.wet(0.35);
  };



  // ---------------------------------------------------------------- recovery & status
  X.heal = (S) => {
    S.seq([72, 76, 79, 84, 88], 0.05, { w: 'triangle', d: 0.06, r: 0.25, vol: 0.18 });
    S.bells([91, 96], 0.08, { t: 0.22, ratio: 4, index: 1, md: 0.2, d: 0.01, r: 0.4, vol: 0.07 });
    S.wet(0.4);
  };


  X.revive = (S) => {
    S.seq([67, 72, 76, 79, 84, 88, 91, 96], 0.05, { w: 'triangle', d: 0.06, r: 0.3, vol: 0.16 });
    [84, 88, 91].forEach((n) => S.tone({ w: 'p25', n, t: 0.42, a: 0.03, d: 0.3, r: 0.4, vol: 0.06, lp: 5000, vib: [6, 10] }));
    S.bells([96, 103, 105], 0.08, { t: 0.4, ratio: 4, index: 1.2, md: 0.25, d: 0.01, r: 0.5, vol: 0.07 });
    S.wet(0.45);
  };
  X.buff = (S) => {
    S.tone({ w: 'p25', f: 420, f2: 1250, sd: 0.2, d: 0.18, r: 0.06, vol: 0.1, lp: 5000 });
    S.tone({ w: 'p25', f: 630, f2: 1870, sd: 0.2, t: 0.05, d: 0.16, r: 0.06, vol: 0.07, lp: 6000 });
    S.wet(0.3);
  };



  X.debuff = (S) => {
    S.tone({ w: 'p25', f: 900, f2: 240, sd: 0.26, d: 0.24, r: 0.06, vol: 0.1, lp: 4000 });
    S.tone({ w: 'p25', f: 850, f2: 225, sd: 0.26, t: 0.04, d: 0.22, r: 0.06, vol: 0.07, lp: 4000 });
    S.tone({ w: 'triangle', f: 450, f2: 115, sd: 0.28, d: 0.26, r: 0.08, vol: 0.12, vib: [9, 30] });      // sagging body
    S.wet(0.2);
  };

  X.status = (S) => {
    S.tone({ w: 'p25', n: 76, n2: 70, sd: 0.3, d: 0.3, r: 0.05, vol: 0.1, vib: [14, 60], lp: 3000 });
    S.tone({ w: 'triangle', n: 64, n2: 58, sd: 0.3, d: 0.3, r: 0.05, vol: 0.14, vib: [14, 60] });
    S.tone({ w: 'sine', n: 52, n2: 46, sd: 0.3, a: 0.02, d: 0.28, r: 0.08, vol: 0.12, vib: [7, 40] });    // queasy floor
    S.wet(0.2);
  };

  X.poison = (S) => {
    S.tone({ w: 'p12', n: 72, t: 0, d: 0.08, r: 0.03, vol: 0.11, vib: [18, 50], lp: 2500 });
    S.tone({ w: 'p12', n: 71, t: 0.11, d: 0.12, r: 0.05, vol: 0.11, vib: [18, 50], lp: 2500 });
    [0.02, 0.09, 0.17].forEach((t, i) => S.tone({ w: 'sine', n: 60 + i * 5, n2: 72 + i * 5, sd: 0.03, t: t + rv(0, 0.012), d: 0.02, r: 0.03, vol: 0.12 }));
    S.noise({ a: 0.02, d: 0.16, r: 0.08, vol: 0.07, bp: 800, bp2: 500, q: 5 });                          // gurgle
    S.wet(0.2);
  };

  X.sleep = (S) => {
    [88, 84, 81].forEach((n, i) => S.tone({ w: 'sine', n, t: i * 0.14, a: 0.02, d: 0.1, r: 0.2, vol: 0.14, vib: [5, 18] }));
    S.wet(0.4);
  };


  X.death = (S) => {
    S.fm({ n: 45, ratio: 1.41, index: 3, md: 0.8, d: 0.05, r: 1.1, vol: 0.4 });
    S.tone({ w: 'p25', n: 69, n2: 45, sd: 0.6, t: 0.05, d: 0.5, r: 0.2, vol: 0.08, lp: 2000 });
    S.noise({ d: 0.2, a: 0.1, r: 0.5, vol: 0.12, lp: 600 });
    S.wet(0.35);
  };




  // ---------------------------------------------------------------- defeat
  X.enemy_die = (S) => {
    const k = st(1);
    S.tone({ w: 'sine', f: 160 * k, f2: 60, sd: 0.08, d: 0.015, r: 0.08, vol: 0.25 });                     // last blow lands
    S.tone({ w: 'p50', f: 900 * k, f2: 110, sd: 0.28, d: 0.26, r: 0.05, vol: 0.12, lp: 3500, lp2: 900, fd: 0.28 });
    S.tone({ w: 'p25', f: 905 * k, f2: 112, sd: 0.28, t: 0.012, d: 0.24, r: 0.05, vol: 0.05, lp: 3000 });    // a chorus voice
    S.noise({ a: 0.02, d: 0.12, r: 0.18, vol: 0.28, lp: 3000, lp2: 400, fd: 0.3 });
    S.noise({ t: 0.1, a: 0.06, d: 0.12, r: 0.2, vol: 0.06, bp: 3500, bp2: 1500, fd: 0.3, q: 2 });          // dissolving dust
    S.wet(0.22);
  };

  X.boss_die = (S) => {
    for (let i = 0; i < 6; i++) {
      const t = i * 0.16 + (i ? rv(-0.02, 0.02) : 0);
      S.noise({ t, d: 0.04, r: 0.35, vol: 0.45 - i * 0.04, lp: (1800 - i * 150) * st(2), rate: rv(0.5, 0.7) });
      S.tone({ w: 'sine', f: (120 - i * 8) * st(1.5), f2: 40, sd: 0.3, t, d: 0.03, r: 0.3, vol: 0.4 });
    }
    S.noise({ t: 0.9, d: 0.2, r: 1.2, vol: 0.4, lp: 500, rate: 0.5 });
    S.tone({ w: 'p50', f: 800, f2: 60, sd: 1.4, d: 1.3, r: 0.2, vol: 0.08, lp: 2000 });
    S.wet(0.3);
  };

  X.escape = (S) => {
    S.seq([84, 81, 77, 74, 72, 69], 0.045, { w: 'p25', d: 0.025, r: 0.03, vol: 0.1, lp: 5000 });
    S.tone({ w: 'triangle', n: 72, n2: 57, sd: 0.25, a: 0.01, d: 0.24, r: 0.05, vol: 0.07 });             // body under the patter
    S.noise({ a: 0.05, d: 0.15, r: 0.15, vol: 0.14, bp: 1500, bp2: 4000, q: 1.3 });
    S.noise({ t: 0.12, a: 0.04, d: 0.1, r: 0.12, vol: 0.09, bp: 1100, bp2: 450, q: 1 });                   // receding
    S.wet(0.15);
  };


  // ---------------------------------------------------------------- field
  X.stairs = (S) => {
    [0, 0.09, 0.18, 0.27].forEach((t, i) => {
      S.noise({ t, d: 0.01, r: 0.04, vol: 0.25, lp: 1200 });
      S.tone({ w: 'p50', f: 180 - i * 22, t, d: 0.02, r: 0.03, vol: 0.08, lp: 900 });
    });
  };


  X.door = (S) => {
    const k = st(1);
    S.noise({ d: 0.003, r: 0.015, vol: 0.12, bp: 2200, q: 1.5 });                                         // latch
    S.tone({ w: 'sawtooth', f: 160 * k, f2: 260 * k, sd: 0.12, d: 0.12, r: 0.04, vol: 0.08, lp: 1100 });     // creak
    S.noise({ t: 0.13, d: 0.02, r: 0.12, vol: 0.4, lp: 900 });
    S.tone({ w: 'sine', f: 110 * k, f2: 70, sd: 0.1, t: 0.13, d: 0.02, r: 0.12, vol: 0.4 });
    S.tone({ w: 'triangle', f: 240 * k, f2: 190, sd: 0.06, t: 0.13, d: 0.01, r: 0.08, vol: 0.1 });          // the wood
    S.wet(0.1);
  };

  X.locked = (S) => {
    [0, 0.07, 0.14].forEach((t) => {
      S.noise({ t: t + rv(0, 0.01), d: 0.008, r: 0.03, vol: 0.3, bp: 2200 * st(2), q: 2 });
      S.tone({ w: 'sine', f: 300 * st(1), f2: 200, sd: 0.03, t, d: 0.005, r: 0.03, vol: 0.05 });             // the bolt knocks
    });
    S.tone({ w: 'p50', f: 98, t: 0.2, d: 0.1, r: 0.04, vol: 0.12, lp: 1200 });
  };

  X.chest = (S) => {
    S.noise({ d: 0.003, r: 0.015, vol: 0.15, bp: 2500, q: 1.5 });                                         // the latch
    S.tone({ w: 'sawtooth', f: 180, f2: 420, sd: 0.18, d: 0.16, r: 0.04, vol: 0.08, lp: 1400 });
    S.noise({ t: 0.18, d: 0.02, r: 0.1, vol: 0.3, lp: 1500 });
    S.tone({ w: 'sine', f: 140, f2: 70, sd: 0.08, t: 0.18, d: 0.01, r: 0.08, vol: 0.08 });                 // the lid lands
    S.bells([88, 93], 0.06, { t: 0.2, ratio: 3.5, index: 1.4, md: 0.2, d: 0.01, r: 0.35, vol: 0.09 });
    S.wet(0.3);
  };

  X.item = (S) => {
    S.bells([88, 95], 0.06, { ratio: 3.5, index: 1.4, md: 0.15, d: 0.01, r: 0.3, vol: 0.12, lp: 8000 });
    S.seq([76, 83], 0.06, { w: 'triangle', d: 0.01, r: 0.25, vol: 0.04 });                                // warmth under the chime
    S.wet(0.3);
  };
  X.gold = (S) => {
    const k = st(0.4);
    S.fm({ f: 2093 * k, ratio: 2.76, index: 1.6, md: 0.12, d: 0.01, r: 0.25, vol: 0.11 });                   // C7
    S.fm({ f: 2794 * k, t: 0.07, ratio: 2.76, index: 1.6, md: 0.12, d: 0.01, r: 0.35, vol: 0.11 });          // F7
    S.tone({ w: 'triangle', f: 1047 * k, d: 0.005, r: 0.1, vol: 0.05 });                                   // the coin's weight
    S.noise({ d: 0.01, r: 0.05, vol: 0.08, bp: 6000, q: 1 });
    S.wet(0.3);
  };

  X.step_damage = (S) => {
    const k = st(1.5);
    S.noise({ d: 0.01, r: 0.06, vol: 0.3, bp: 1800 * k, q: 1 });
    S.tone({ w: 'p50', f: 160 * k, f2: 90, sd: 0.06, d: 0.03, r: 0.04, vol: 0.12, lp: 1400 });
  };


  X.ship = (S) => {
    S.noise({ a: 0.15, d: 0.25, r: 0.4, vol: 0.28, lp: 600, lp2: 1500, fd: 0.3 });
    S.tone({ w: 'sawtooth', n: 45, a: 0.05, d: 0.35, r: 0.2, vol: 0.1, lp: 700 });
    S.tone({ w: 'sawtooth', n: 52, a: 0.05, d: 0.35, r: 0.2, vol: 0.08, lp: 700 });
    S.wet(0.25);
  };
  X.bump = (S) => { S.tone({ w: 'p50', f: 95 * st(1), f2: 70, sd: 0.05, d: 0.04, r: 0.03, vol: 0.12, lp: 600 }); };

  X.warp = (S) => {
    S.tone({ w: 'sine', f: 300, f2: 2400, sd: 0.55, d: 0.5, r: 0.1, vol: 0.14, vib: [12, 80] });
    S.tone({ w: 'p25', f: 450, f2: 3600, sd: 0.55, d: 0.5, r: 0.1, vol: 0.05, lp: 6000 });
    S.noise({ a: 0.2, d: 0.3, r: 0.2, vol: 0.08, hp: 5000 });
    S.wet(0.45);
  };


  X.teleport = (S) => {
    for (let k = 0; k < 3; k++) S.seq([72, 79, 84, 91], 0.03, { t: k * 0.13, w: 'p25', d: 0.03, r: 0.05, vol: 0.08 - k * 0.015, lp: 6000 });
    S.tone({ w: 'sine', f: 500, f2: 3000, sd: 0.4, d: 0.35, r: 0.15, vol: 0.1 });
    S.wet(0.5);
  };
  X.steal = (S) => {
    S.noise({ d: 0.04, a: 0.01, r: 0.04, vol: 0.18, bp: 3000, bp2: 6000, q: 1.5 });
    S.tone({ w: 'p12', n: 84, t: 0.05, d: 0.03, r: 0.02, vol: 0.12, lp: 6000 });
    S.tone({ w: 'p12', n: 91, t: 0.1, d: 0.05, r: 0.06, vol: 0.12, lp: 6000 });
  };


  X.jump = (S) => { const k = st(1); S.tone({ w: 'p25', f: 220 * k, f2: 900 * k, sd: 0.14, d: 0.13, r: 0.05, vol: 0.12, lp: 4000 }); S.noise({ d: 0.05, a: 0.01, r: 0.05, vol: 0.12, bp: 1500, bp2: 4000 }); };

  X.breath = (S) => {
    S.noise({ a: 0.08, d: 0.55, r: 0.35, vol: 0.45, lp: 500, lp2: 2600, fd: 0.4, rate: 0.7 });
    S.noise({ a: 0.12, d: 0.45, r: 0.35, vol: 0.3, lp: 220, rate: 0.4 });                                 // the lungs behind it
    S.tone({ w: 'sawtooth', f: 65, f2: 50, sd: 0.8, a: 0.05, d: 0.6, r: 0.3, vol: 0.14, lp: 500, vib: [7, 40] });
    S.wet(0.2);
  };

  X.roar = (S) => {
    const k = st(1);
    S.tone({ w: 'sawtooth', f: 95 * k, f2: 60, sd: 0.8, a: 0.06, d: 0.6, r: 0.25, vol: 0.2, lp: 900, vib: [9, 90] });
    S.tone({ w: 'sawtooth', f: 142 * k, f2: 88, sd: 0.8, a: 0.06, d: 0.6, r: 0.25, vol: 0.12, lp: 1100, vib: [8, 70] });
    S.tone({ w: 'p50', f: 63 * k, f2: 42, sd: 0.8, a: 0.08, d: 0.55, r: 0.25, vol: 0.12, lp: 500, vib: [6, 60] });   // chest
    S.noise({ a: 0.05, d: 0.5, r: 0.3, vol: 0.3, bp: 700, q: 0.8 });
    S.noise({ a: 0.08, d: 0.4, r: 0.3, vol: 0.08, bp: 1800, bp2: 1100, q: 1.5 });                          // rasp
    S.wet(0.25);
  };

  X.shake = (S) => {
    for (let i = 0; i < 8; i++) S.noise({ t: i * 0.1, a: 0.02, d: 0.04, r: 0.1, vol: 0.4 - i * 0.03, lp: 260, rate: 0.5 });
    S.tone({ w: 'sine', f: 48, f2: 38, sd: 0.9, a: 0.05, d: 0.7, r: 0.2, vol: 0.4 });
  };



  // loudness balance (peak targets: UI ≈ -12 dBFS, spells ≈ -9…-6, impacts ≈ -3; tools/render_audio.js)
  const GAIN = {
    cursor: 1.55, confirm: 1.8, cancel: 1.78, menu_open: 1.38, attack: 2.0, hit: 0.58, crit: 0.52, miss: 1.64,
    enemy_attack: 1.29, hurt: 0.76, magic: 1.51, fire: 0.9, ice: 1.7, wind: 1.7, water: 1.51, buff: 1.48,
    debuff: 1.12, status: 1.11, poison: 1.32, sleep: 1.78, escape: 1.13, stairs: 1.2, door: 0.75, locked: 1.66,
    chest: 1.37, item: 1.63, gold: 1.59, bump: 1.26, teleport: 1.33, steal: 1.57, jump: 1.53, enemy_die: 0.73,
    boss_die: 1.08, roar: 0.79,
  };
  for (const id in GAIN) {
    const fn = X[id], g = GAIN[id];
    X[id] = (S) => { S.gain(g); fn(S); };
  }

  Object.assign(R.DB.sfx, X);
})(window.RPG);
