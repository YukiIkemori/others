// Sound effects new in ルミナス・クロニクル (DESIGN §11.10.5, §11.11.4): glimmer golden light
// freeze burn quill page swap bell unlock arrow lash parry secret. Same kit as sfx.js:
//   S.tone S.noise S.fm S.seq S.bells S.drum S.inst S.wet S.gain S.duck (see src/core/audio.js)
// Loudness (peak, tools/render_audio.js render --sfx): UI ≈ -12 dBFS, spells ≈ -9…-6,
// impacts ≈ -3. Each def ends with its own S.gain() (sfx.js's GAIN table is private).
(function (R) {
  'use strict';
  const X = {};

  // 閃き「ピコーン」— a short bright pulse (ピ, D6) and an FM bell an octave up that rings on
  // (コーン, D7, octave-ratio so it rings pure), a breath of air, a long echo. The music dips
  // 6 dB for a third of a second under it so the ring always cuts through the battle BGM.
  X.glimmer = (S) => {
    S.duck(-6, 0.32);
    S.tone({ w: 'p25', n: 86, d: 0.03, r: 0.015, vol: 0.12, lp: 7500 });                          // ピ
    S.tone({ w: 'p12', n: 98, d: 0.012, r: 0.01, vol: 0.05, lp: 9000 });
    S.fm({ n: 98, t: 0.05, ratio: 2, index: 1.8, md: 0.3, d: 0.01, r: 1.0, vol: 0.13 });          // コーン
    S.tone({ w: 'triangle', n: 98, t: 0.05, a: 0.004, d: 0.06, r: 0.8, vol: 0.09, vib: [5.5, 9] });
    S.tone({ w: 'sine', n: 110, t: 0.05, a: 0.004, d: 0.02, r: 0.35, vol: 0.03 });
    S.noise({ t: 0.05, d: 0.02, r: 0.28, vol: 0.05, hp: 7500 });
    S.wet(0.45);
    S.gain(2.05);
  };

  // golden individual appears — five rising glockenspiel sparks, then a small jingle bell
  X.golden = (S) => {
    [83, 88, 92, 95, 100].forEach((n, i) => S.inst('glock', n, i * 0.055, 0.3, 0.9 + i * 0.04));
    for (let k = 0; k < 4; k++) S.fm({ n: 105 - (k % 2) * 2, t: 0.3 + k * 0.045, ratio: 1.41, index: 2.2, md: 0.06, d: 0.005, r: 0.12, vol: 0.05 });
    S.noise({ t: 0.05, a: 0.1, d: 0.2, r: 0.3, vol: 0.05, hp: 8000 });
    S.wet(0.45);
    S.gain(0.6);
  };

  // light spells — a quick triangle major-chord swell (brighter and shorter than holy) and a
  // spray of high bell grains
  X.light = (S) => {
    [84, 88, 91, 96].forEach((n, i) => S.tone({ w: 'triangle', n, t: i * 0.018, a: 0.04, d: 0.16, r: 0.25, vol: 0.1, vib: [7, 10] }));
    S.tone({ w: 'p25', n: 100, t: 0.03, a: 0.02, d: 0.08, r: 0.15, vol: 0.03, lp: 8000 });
    S.bells([100, 103, 96, 105, 103, 100], 0.035, { t: 0.06, ratio: 4, index: 1, md: 0.1, d: 0.005, r: 0.18, vol: 0.06 });
    S.noise({ a: 0.05, d: 0.12, r: 0.18, vol: 0.06, hp: 8000 });
    S.wet(0.5);
    S.gain(1.17);
  };

  // freeze (凍結 status, ice composites) — ice cracking: inharmonic FM snaps, a sharp "piki"
  // click, a thin shimmer settling down
  X.freeze = (S) => {
    S.noise({ d: 0.004, r: 0.02, vol: 0.4, bp: 6500, q: 3 });                                    // ピキッ
    S.noise({ t: 0.05, d: 0.003, r: 0.015, vol: 0.3, bp: 8000, q: 3 });
    [[100, 0], [95, 0.03], [102, 0.07], [98, 0.11]].forEach(([n, t]) => S.fm({ n, t, ratio: 5.07, index: 2.6, md: 0.05, d: 0.004, r: 0.2, vol: 0.08 }));
    S.tone({ w: 'sine', n: 93, n2: 81, sd: 0.4, t: 0.12, a: 0.01, d: 0.3, r: 0.15, vol: 0.05, vib: [11, 25] });
    S.noise({ t: 0.08, a: 0.05, d: 0.15, r: 0.25, vol: 0.08, hp: 7000 });
    S.tone({ w: 'triangle', f: 130, f2: 90, sd: 0.1, d: 0.02, r: 0.08, vol: 0.15 });
    S.wet(0.4);
    S.gain(1.95);
  };

  // burn (やけど status, fire composites) — a short flare of flame and a handful of crackles
  X.burn = (S) => {
    S.noise({ a: 0.02, d: 0.1, r: 0.2, vol: 0.45, lp: 800, lp2: 3400, fd: 0.14, rate: 0.7 });
    S.tone({ w: 'sawtooth', f: 90, f2: 200, sd: 0.15, d: 0.1, r: 0.12, vol: 0.12, lp: 900 });
    [0.08, 0.13, 0.17, 0.24, 0.29, 0.36, 0.42].forEach((t, i) => S.noise({ t, d: 0.003, r: 0.015 + (i % 3) * 0.005, vol: 0.12 - i * 0.008, hp: 2500 + (i % 2) * 1500 }));
    S.wet(0.2);
    S.gain(0.9);
  };

  // quill — a pen scratching across paper three times, then a small bell
  X.quill = (S) => {
    [[0, 3000, 4800], [0.13, 3600, 2600], [0.25, 2800, 5200]].forEach(([t, a, b]) =>
      S.noise({ t, a: 0.012, d: 0.06, r: 0.03, vol: 0.2, bp: a, bp2: b, fd: 0.07, q: 2.4 }));
    S.noise({ t: 0.26, d: 0.008, r: 0.02, vol: 0.12, hp: 6000 });
    S.fm({ n: 93, t: 0.4, ratio: 3.5, index: 1.3, md: 0.2, d: 0.01, r: 0.5, vol: 0.1 });
    S.fm({ n: 100, t: 0.44, ratio: 3.5, index: 1, md: 0.15, d: 0.01, r: 0.4, vol: 0.05 });
    S.wet(0.35);
    S.gain(1.6);
  };

  // page — a page turning: a band-limited "sa" with a small flutter underneath
  X.page = (S) => {
    S.noise({ a: 0.025, d: 0.05, r: 0.08, vol: 0.2, bp: 1700, bp2: 4400, fd: 0.09, q: 1.3 });
    S.noise({ t: 0.02, a: 0.01, d: 0.03, r: 0.04, vol: 0.08, bp: 700, q: 1.5 });
    S.noise({ t: 0.09, d: 0.004, r: 0.02, vol: 0.06, hp: 5000 });
    S.gain(1.75);
  };

  // swap (party order / row) — two light notes trading places (high → low) and a cloth rustle
  X.swap = (S) => {
    S.tone({ w: 'p25', n: 84, d: 0.03, r: 0.02, vol: 0.1, lp: 6000 });
    S.tone({ w: 'p25', n: 77, t: 0.06, d: 0.035, r: 0.05, vol: 0.1, lp: 6000 });
    S.tone({ w: 'triangle', n: 72, t: 0.06, d: 0.02, r: 0.05, vol: 0.1 });
    S.noise({ t: 0.01, a: 0.02, d: 0.05, r: 0.05, vol: 0.09, bp: 2400, bp2: 1400, fd: 0.07, q: 0.9 });
    S.gain(1.2);
  };

  // bell — the homeward bell (脱出): a clear little hand bell rung twice
  X.bell = (S) => {
    [0, 0.3].forEach((t, i) => {
      S.fm({ n: 93 - i * 2, t, ratio: 2.76, index: 1.3, md: 0.45, d: 0.01, r: 1.0, vol: 0.12 });
      S.tone({ w: 'sine', n: 105 - i * 2, t, a: 0.002, d: 0.01, r: 0.5, vol: 0.03 });
      S.noise({ t, d: 0.003, r: 0.015, vol: 0.05, hp: 6000 });
    });
    S.wet(0.45);
    S.gain(1.95);
  };

  // unlock — a sealed way opens (ice melts, vines wither, a stone door grinds): a short low
  // rumble, then bells climbing
  X.unlock = (S) => {
    S.noise({ a: 0.03, d: 0.2, r: 0.25, vol: 0.45, lp: 280, rate: 0.5 });
    S.tone({ w: 'sine', f: 62, f2: 40, sd: 0.4, a: 0.02, d: 0.2, r: 0.2, vol: 0.4 });
    for (let i = 0; i < 3; i++) S.noise({ t: 0.05 + i * 0.07, d: 0.01, r: 0.05, vol: 0.18, lp: 1300, rate: 0.7 });
    S.bells([79, 84, 88, 91, 96], 0.07, { t: 0.3, ratio: 3.5, index: 1.3, md: 0.2, d: 0.01, r: 0.45, vol: 0.08 });
    S.wet(0.35);
    S.gain(0.7);
  };

  // arrow (bows) — the string's twang, air cut, the thunk of the hit
  X.arrow = (S) => {
    S.tone({ w: 'triangle', f: 196, f2: 186, sd: 0.12, d: 0.12, r: 0.05, vol: 0.2, decay: 0.08 });  // びん
    S.tone({ w: 'sawtooth', f: 392, d: 0.06, r: 0.03, vol: 0.05, decay: 0.05, lp: 2400 });
    S.noise({ d: 0.004, r: 0.01, vol: 0.12, bp: 3000, q: 2 });
    S.noise({ t: 0.04, a: 0.03, d: 0.05, r: 0.03, vol: 0.2, bp: 1800, bp2: 6000, fd: 0.08, q: 1.4 }); // 風を切る
    S.noise({ t: 0.15, d: 0.01, r: 0.07, vol: 0.4, lp: 1500 });                                     // 刺さる
    S.tone({ w: 'sine', f: 220, f2: 90, sd: 0.07, t: 0.15, d: 0.01, r: 0.07, vol: 0.35 });
    S.gain(0.9);
  };

  // lash (whips) — a bending swish that snaps into a dry crack
  X.lash = (S) => {
    S.noise({ a: 0.06, d: 0.07, r: 0.02, vol: 0.24, bp: 500, bp2: 3200, fd: 0.13, q: 1.6 });
    S.noise({ t: 0.14, d: 0.003, r: 0.03, vol: 0.55, hp: 1800 });                                   // 破裂
    S.tone({ w: 'p50', f: 1400, f2: 500, sd: 0.02, t: 0.14, d: 0.004, r: 0.02, vol: 0.12 });
    S.noise({ t: 0.145, d: 0.01, r: 0.06, vol: 0.18, bp: 2500, q: 1 });
    S.gain(0.54);
  };

  // parry — steel turning steel: a bright inharmonic ring with a click
  X.parry = (S) => {
    S.noise({ d: 0.004, r: 0.02, vol: 0.4, hp: 3500 });
    S.fm({ n: 91, ratio: 1.414, index: 3, md: 0.12, d: 0.005, r: 0.4, vol: 0.12 });
    S.fm({ n: 98, t: 0.004, ratio: 2.76, index: 1.6, md: 0.08, d: 0.005, r: 0.3, vol: 0.08 });
    S.tone({ w: 'sine', n: 103, a: 0.002, d: 0.01, r: 0.25, vol: 0.03, vib: [30, 20] });
    S.wet(0.3);
    S.gain(1.0);
  };

  // secret — a hidden passage gives way: stone shifting, a curious rising three-note figure
  // with a wobble (「ふしぎ」), a sparkle
  X.secret = (S) => {
    S.noise({ a: 0.02, d: 0.1, r: 0.15, vol: 0.3, lp: 500, rate: 0.6 });
    S.tone({ w: 'sine', f: 110, f2: 70, sd: 0.15, d: 0.05, r: 0.1, vol: 0.25 });
    [[74, 0.12], [78, 0.2], [85, 0.28]].forEach(([n, t]) => S.tone({ w: 'triangle', n, t, a: 0.01, d: 0.06, r: 0.18, vol: 0.12, vib: [9, 18] }));
    S.tone({ w: 'p25', n: 85, n2: 97, sd: 0.25, t: 0.3, a: 0.02, d: 0.2, r: 0.2, vol: 0.035, lp: 6000, vib: [6, 30] });
    S.bells([97, 102], 0.06, { t: 0.42, ratio: 4, index: 1, md: 0.15, d: 0.01, r: 0.35, vol: 0.05 });
    S.wet(0.45);
    S.gain(1.1);
  };

  Object.assign(R.DB.sfx, X);
})(window.RPG);
