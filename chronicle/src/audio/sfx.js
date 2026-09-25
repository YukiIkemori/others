// Sound effects (DESIGN §3). Each is a function of the SFX kit S (src/core/audio.js):
//   S.tone({w,n|f,n2|f2,t,d,a,r,vol,decay,sd,lin,lp/hp/bp(+2),q,fd,vib,det})
//   S.noise({t,d,a,r,vol,decay,lp/hp/bp(+2),q,fd,rate,rate2})
//   S.fm({n|f,n2,ratio,index,md,t,d,a,r,vol,decay})
//   S.seq(midiNotes, step, toneOpts)  S.bells(notes, step, fmOpts)  S.drum(key,t,vel)
//   S.wet(echoSend)  S.gain(v)
// Times are seconds from the trigger; n = MIDI note (69 = A4).
(function (R) {
  'use strict';
  const X = {};

  // ---------------------------------------------------------------- UI
  X.cursor = (S) => { S.tone({ w: 'p25', n: 86, n2: 89, sd: 0.012, d: 0.012, r: 0.03, vol: 0.09, lp: 5000 }); };
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
  X.attack = (S) => { S.noise({ d: 0.06, a: 0.02, r: 0.05, vol: 0.28, bp: 900, bp2: 3200, q: 1.2 }); };
  X.hit = (S) => {
    S.noise({ d: 0.015, r: 0.09, vol: 0.55, lp: 3200 });
    S.tone({ w: 'sine', f: 190, f2: 55, sd: 0.1, d: 0.02, r: 0.1, vol: 0.6 });
    S.tone({ w: 'p50', f: 95, f2: 40, sd: 0.06, d: 0.01, r: 0.05, vol: 0.15, lp: 900 });
  };
  X.crit = (S) => {
    S.noise({ d: 0.02, r: 0.16, vol: 0.6, lp: 4500 });
    S.tone({ w: 'sine', f: 220, f2: 45, sd: 0.16, d: 0.03, r: 0.16, vol: 0.75 });
    S.tone({ w: 'p50', f: 120, f2: 35, sd: 0.12, d: 0.02, r: 0.1, vol: 0.2, lp: 1200 });
    S.fm({ n: 96, ratio: 3.01, index: 1.5, md: 0.2, d: 0.01, r: 0.35, vol: 0.14, t: 0.01 });
    S.wet(0.25);
  };
  X.miss = (S) => { S.noise({ d: 0.05, a: 0.02, r: 0.06, vol: 0.18, bp: 2200, bp2: 5500, q: 1.5 }); };
  X.enemy_attack = (S) => {
    S.noise({ d: 0.08, a: 0.02, r: 0.06, vol: 0.3, bp: 450, bp2: 1600, q: 1.1 });
    S.tone({ w: 'sawtooth', f: 110, f2: 70, d: 0.1, r: 0.05, vol: 0.12, lp: 900 });
  };
  X.hurt = (S) => {
    S.tone({ w: 'p50', f: 140, f2: 48, sd: 0.1, d: 0.04, r: 0.12, vol: 0.3, lp: 1100 });
    S.noise({ d: 0.02, r: 0.12, vol: 0.42, lp: 1600 });
    S.tone({ w: 'sine', f: 90, f2: 45, sd: 0.12, d: 0.03, r: 0.12, vol: 0.5 });
  };

  // ---------------------------------------------------------------- battle: magic
  X.magic = (S) => {
    S.seq([72, 76, 79, 84, 88, 91], 0.03, { w: 'p25', d: 0.04, r: 0.08, vol: 0.08, lp: 7000 });
    S.fm({ n: 96, t: 0.18, ratio: 3.5, index: 1.2, md: 0.3, d: 0.02, r: 0.45, vol: 0.1 });
    S.wet(0.45);
  };
  X.fire = (S) => {
    S.noise({ d: 0.18, a: 0.03, r: 0.3, vol: 0.5, lp: 700, lp2: 3800, fd: 0.2, rate: 0.6 });
    S.noise({ t: 0.12, d: 0.12, a: 0.02, r: 0.25, vol: 0.35, lp: 2500, lp2: 600, fd: 0.3, rate: 0.5 });
    S.tone({ w: 'sawtooth', f: 70, f2: 180, sd: 0.25, d: 0.2, r: 0.2, vol: 0.14, lp: 700 });
    for (let i = 0; i < 6; i++) S.noise({ t: 0.05 + i * 0.06, d: 0.004, r: 0.02, vol: 0.2, hp: 3000 });
    S.wet(0.2);
  };
  X.ice = (S) => {
    const notes = [96, 101, 98, 103, 100, 105];
    notes.forEach((n, i) => S.fm({ n, t: i * 0.045, ratio: 3.5, index: 2, md: 0.12, d: 0.005, r: 0.35, vol: 0.09 }));
    S.noise({ d: 0.05, a: 0.02, r: 0.3, vol: 0.14, hp: 6500 });
    S.tone({ w: 'triangle', n: 60, n2: 72, sd: 0.2, d: 0.15, r: 0.15, vol: 0.12 });
    S.wet(0.5);
  };
  X.thunder = (S) => {
    S.noise({ d: 0.02, r: 0.05, vol: 0.6, bp: 2500, q: 0.7 });
    S.noise({ t: 0.03, d: 0.01, r: 0.04, vol: 0.45, bp: 3500, q: 0.8 });
    S.noise({ t: 0.02, d: 0.1, r: 0.9, vol: 0.55, lp: 420, rate: 0.5 });
    S.tone({ w: 'p50', f: 70, f2: 35, sd: 0.4, d: 0.1, r: 0.35, vol: 0.18, lp: 500 });
    S.wet(0.2);
  };
  X.wind = (S) => {
    S.noise({ d: 0.35, a: 0.12, r: 0.25, vol: 0.32, bp: 500, bp2: 2600, fd: 0.35, q: 2.5 });
    S.noise({ t: 0.15, d: 0.3, a: 0.1, r: 0.25, vol: 0.25, bp: 2800, bp2: 700, fd: 0.4, q: 3 });
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
    S.tone({ w: 'sine', f: 70, f2: 32, sd: 0.4, d: 0.1, r: 0.35, vol: 0.55 });
    for (let i = 0; i < 4; i++) S.noise({ t: 0.08 + i * 0.09, d: 0.01, r: 0.06, vol: 0.3, lp: 1400, rate: 0.7 });
    S.wet(0.15);
  };
  X.water = (S) => {
    [72, 79, 76, 84, 81, 88].forEach((n, i) => S.tone({ w: 'sine', n, n2: n + 7, sd: 0.035, t: i * 0.05, d: 0.03, r: 0.04, vol: 0.18 }));
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
    S.wet(0.2);
  };
  X.status = (S) => {
    S.tone({ w: 'p25', n: 76, n2: 70, sd: 0.3, d: 0.3, r: 0.05, vol: 0.1, vib: [14, 60], lp: 3000 });
    S.tone({ w: 'triangle', n: 64, n2: 58, sd: 0.3, d: 0.3, r: 0.05, vol: 0.14, vib: [14, 60] });
    S.wet(0.2);
  };
  X.poison = (S) => {
    S.tone({ w: 'p12', n: 72, t: 0, d: 0.08, r: 0.03, vol: 0.11, vib: [18, 50], lp: 2500 });
    S.tone({ w: 'p12', n: 71, t: 0.11, d: 0.12, r: 0.05, vol: 0.11, vib: [18, 50], lp: 2500 });
    [0.02, 0.09, 0.17].forEach((t, i) => S.tone({ w: 'sine', n: 60 + i * 5, n2: 72 + i * 5, sd: 0.03, t, d: 0.02, r: 0.03, vol: 0.12 }));
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
    S.tone({ w: 'p50', f: 900, f2: 110, sd: 0.28, d: 0.26, r: 0.05, vol: 0.12, lp: 3500 });
    S.noise({ d: 0.12, a: 0.02, r: 0.18, vol: 0.28, lp: 3000, lp2: 400, fd: 0.3 });
    S.wet(0.2);
  };
  X.boss_die = (S) => {
    for (let i = 0; i < 6; i++) {
      S.noise({ t: i * 0.16, d: 0.04, r: 0.35, vol: 0.45 - i * 0.04, lp: 1800 - i * 150, rate: 0.6 });
      S.tone({ w: 'sine', f: 120 - i * 8, f2: 40, sd: 0.3, t: i * 0.16, d: 0.03, r: 0.3, vol: 0.4 });
    }
    S.noise({ t: 0.9, d: 0.2, r: 1.2, vol: 0.4, lp: 500, rate: 0.5 });
    S.tone({ w: 'p50', f: 800, f2: 60, sd: 1.4, d: 1.3, r: 0.2, vol: 0.08, lp: 2000 });
    S.wet(0.3);
  };
  X.escape = (S) => {
    S.seq([84, 81, 77, 74, 72, 69], 0.045, { w: 'p25', d: 0.025, r: 0.03, vol: 0.1, lp: 5000 });
    S.noise({ d: 0.15, a: 0.05, r: 0.15, vol: 0.14, bp: 1500, bp2: 4000, q: 1.3 });
  };

  // ---------------------------------------------------------------- field
  X.stairs = (S) => {
    [0, 0.09, 0.18, 0.27].forEach((t, i) => {
      S.noise({ t, d: 0.01, r: 0.04, vol: 0.25, lp: 1200 });
      S.tone({ w: 'p50', f: 180 - i * 22, t, d: 0.02, r: 0.03, vol: 0.08, lp: 900 });
    });
  };
  X.door = (S) => {
    S.tone({ w: 'sawtooth', f: 160, f2: 260, sd: 0.12, d: 0.12, r: 0.04, vol: 0.08, lp: 1100 });
    S.noise({ t: 0.13, d: 0.02, r: 0.12, vol: 0.4, lp: 900 });
    S.tone({ w: 'sine', f: 110, f2: 70, sd: 0.1, t: 0.13, d: 0.02, r: 0.12, vol: 0.4 });
  };
  X.locked = (S) => {
    [0, 0.07, 0.14].forEach((t) => S.noise({ t, d: 0.008, r: 0.03, vol: 0.3, bp: 2200, q: 2 }));
    S.tone({ w: 'p50', f: 98, t: 0.2, d: 0.1, r: 0.04, vol: 0.12, lp: 1200 });
  };
  X.chest = (S) => {
    S.tone({ w: 'sawtooth', f: 180, f2: 420, sd: 0.18, d: 0.16, r: 0.04, vol: 0.08, lp: 1400 });
    S.noise({ t: 0.18, d: 0.02, r: 0.1, vol: 0.3, lp: 1500 });
    S.bells([88, 93], 0.06, { t: 0.2, ratio: 3.5, index: 1.4, md: 0.2, d: 0.01, r: 0.35, vol: 0.09 });
    S.wet(0.3);
  };
  X.item = (S) => { S.bells([88, 95], 0.06, { ratio: 3.5, index: 1.4, md: 0.15, d: 0.01, r: 0.3, vol: 0.12 }); S.wet(0.3); };
  X.gold = (S) => {
    S.fm({ n: 96, ratio: 2.76, index: 2, md: 0.12, d: 0.01, r: 0.25, vol: 0.11 });
    S.fm({ n: 101, t: 0.07, ratio: 2.76, index: 2, md: 0.12, d: 0.01, r: 0.35, vol: 0.11 });
    S.noise({ d: 0.01, r: 0.05, vol: 0.08, hp: 7000 });
    S.wet(0.3);
  };
  X.step_damage = (S) => {
    S.noise({ d: 0.01, r: 0.06, vol: 0.3, bp: 1800, q: 1 });
    S.tone({ w: 'p50', f: 160, f2: 90, sd: 0.06, d: 0.03, r: 0.04, vol: 0.12, lp: 1400 });
  };
  X.ship = (S) => {
    S.noise({ a: 0.15, d: 0.25, r: 0.4, vol: 0.28, lp: 600, lp2: 1500, fd: 0.3 });
    S.tone({ w: 'sawtooth', n: 45, a: 0.05, d: 0.35, r: 0.2, vol: 0.1, lp: 700 });
    S.tone({ w: 'sawtooth', n: 52, a: 0.05, d: 0.35, r: 0.2, vol: 0.08, lp: 700 });
    S.wet(0.25);
  };
  X.bump = (S) => { S.tone({ w: 'p50', f: 95, f2: 70, sd: 0.05, d: 0.04, r: 0.03, vol: 0.12, lp: 600 }); };
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
  X.jump = (S) => { S.tone({ w: 'p25', f: 220, f2: 900, sd: 0.14, d: 0.13, r: 0.05, vol: 0.12, lp: 4000 }); S.noise({ d: 0.05, a: 0.01, r: 0.05, vol: 0.12, bp: 1500, bp2: 4000 }); };
  X.breath = (S) => {
    S.noise({ a: 0.08, d: 0.55, r: 0.35, vol: 0.45, lp: 500, lp2: 2600, fd: 0.4, rate: 0.7 });
    S.tone({ w: 'sawtooth', f: 65, f2: 50, sd: 0.8, a: 0.05, d: 0.6, r: 0.3, vol: 0.14, lp: 500, vib: [7, 40] });
    S.wet(0.2);
  };
  X.roar = (S) => {
    S.tone({ w: 'sawtooth', f: 95, f2: 60, sd: 0.8, a: 0.06, d: 0.6, r: 0.25, vol: 0.2, lp: 900, vib: [9, 90] });
    S.tone({ w: 'sawtooth', f: 142, f2: 88, sd: 0.8, a: 0.06, d: 0.6, r: 0.25, vol: 0.12, lp: 1100, vib: [8, 70] });
    S.noise({ a: 0.05, d: 0.5, r: 0.3, vol: 0.3, bp: 700, q: 0.8 });
    S.wet(0.25);
  };
  X.shake = (S) => {
    for (let i = 0; i < 8; i++) S.noise({ t: i * 0.1, a: 0.02, d: 0.04, r: 0.1, vol: 0.4 - i * 0.03, lp: 260, rate: 0.5 });
    S.tone({ w: 'sine', f: 48, f2: 38, sd: 0.9, a: 0.05, d: 0.7, r: 0.2, vol: 0.4 });
  };

  // loudness balance (peak targets: UI ≈ -12 dBFS, spells ≈ -9…-6, impacts ≈ -3; tools/render_audio.js)
  const GAIN = {
    cursor: 1.95, confirm: 1.8, cancel: 1.78, menu_open: 1.38, attack: 1.8, hit: 0.68, crit: 0.54,
    miss: 1.64, enemy_attack: 1.46, hurt: 0.76, magic: 1.51, fire: 0.9, ice: 1.41, wind: 1.7,
    water: 1.51, buff: 1.48, debuff: 1.66, status: 1.72, poison: 1.32, sleep: 1.78, escape: 1.53,
    stairs: 1.2, door: 0.83, locked: 1.88, chest: 1.5, item: 2.07, gold: 1.66, bump: 1.26,
    teleport: 1.33, steal: 1.57, jump: 1.53,
  };
  for (const id in GAIN) {
    const fn = X[id], g = GAIN[id];
    X[id] = (S) => { S.gain(g); fn(S); };
  }

  Object.assign(R.DB.sfx, X);
})(window.RPG);
