// Sound of the slice: recorded music (bgm/<id>.ogg with loop points in <id>.json) and small synthesised effects.
// Nothing sounds before the first key or tap (browsers ask for that).
window.SND = (function () {
  'use strict';
  let ac = null, master, musicBus, sfxBus, cur = null, want = null, vol = { bgm: .7, sfx: .8 };
  const cache = new Map();
  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = vol.bgm; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  async function load(id) {
    if (cache.has(id)) return cache.get(id);
    const p = (async () => {
      const [buf, meta] = await Promise.all([
        fetch('bgm/' + id + '.ogg').then(r => { if (!r.ok) throw new Error('bgm ' + id); return r.arrayBuffer(); }).then(b => new Promise((res, rej) => ac.decodeAudioData(b, res, rej))),
        fetch('bgm/' + id + '.json').then(r => r.ok ? r.json() : {}).catch(() => ({})) ]);
      return { buf, meta };
    })().catch(e => { console.warn('music missing', id, e); return null; });
    cache.set(id, p); return p;
  }
  function stopCur(fade) {
    if (!cur) return; const c = cur; cur = null;
    try { c.g.gain.cancelScheduledValues(ac.currentTime); c.g.gain.setValueAtTime(c.g.gain.value, ac.currentTime); c.g.gain.linearRampToValueAtTime(0, ac.currentTime + fade); c.src.stop(ac.currentTime + fade + .05); } catch (e) {}
  }
  // plays a looped track; the same id keeps playing.  opt.once: a jingle, played one time
  async function bgm(id, opt) {
    opt = opt || {}; want = id;
    if (!ctx()) return;
    if (!id) { stopCur(opt.fade == null ? .6 : opt.fade); return; }
    if (cur && cur.id === id && !opt.restart) return;
    const t = await load(id); if (want !== id) return;
    stopCur(opt.fade == null ? .5 : opt.fade);
    if (!t) return;
    const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = t.buf;
    const once = opt.once || t.meta.loop === false;
    if (!once) { src.loop = true; src.loopStart = t.meta.loopStart || 0; src.loopEnd = Math.min(t.meta.loopEnd || t.buf.duration, t.buf.duration); }
    g.gain.value = 0; g.gain.linearRampToValueAtTime(opt.gain == null ? 1 : opt.gain, ac.currentTime + (opt.in == null ? .4 : opt.in));
    src.connect(g); g.connect(musicBus); src.start();
    cur = { id, src, g };
    if (once) src.onended = () => { if (cur && cur.src === src) cur = null; };
  }
  // ---- synthesised effects
  function env(g, t, a, d, peak) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function tone(type, f0, f1, dur, peak, when, a) {
    const t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, a || .005, dur, peak); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + .1);
  }
  let nbuf = null;
  function noise(dur, peak, f0, f1, q, when, type) {
    if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + (when || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true; f.type = type || 'bandpass'; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    env(g, t, .004, dur, peak); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + .1);
  }
  const FX = {
    cursor: () => tone('triangle', 880, 880, .05, .12),
    ok: () => { tone('triangle', 660, 660, .07, .16); tone('triangle', 990, 990, .1, .14, .05); },
    cancel: () => tone('triangle', 420, 300, .1, .14),
    buzz: () => tone('square', 140, 120, .14, .08),
    open: () => { tone('sine', 520, 780, .12, .14); },
    step: () => noise(.05, .05, 500, 300, 1.2),
    slash: () => { noise(.14, .34, 5200, 1400, 1.4); tone('sawtooth', 900, 240, .08, .05); },
    heavy: () => { noise(.22, .46, 4200, 700, 1.1); tone('sawtooth', 320, 70, .2, .16); },
    hit: () => { noise(.1, .4, 1400, 300, .8); tone('sine', 180, 60, .12, .34); },
    bite: () => { noise(.06, .36, 2600, 900, 2); noise(.08, .36, 2000, 500, 2, .07); },
    claw: () => { noise(.07, .28, 6000, 2500, 2); noise(.07, .28, 6000, 2500, 2, .06); noise(.07, .28, 6000, 2500, 2, .12); },
    thrust: () => { noise(.09, .32, 7000, 2000, 2.5); tone('sine', 240, 90, .09, .2, .03); },
    thud: () => { tone('sine', 150, 46, .2, .5); noise(.12, .22, 700, 160, .7); },
    miss: () => noise(.16, .12, 3000, 6000, 3),
    crit: () => { noise(.25, .5, 5000, 500, .9); tone('square', 520, 130, .18, .12); tone('sine', 120, 40, .25, .5); },
    fire: () => { noise(.5, .3, 500, 2400, .6); noise(.3, .4, 1800, 300, .7, .28); tone('sine', 220, 60, .3, .3, .28); },
    water: () => { tone('sine', 900, 320, .18, .2); tone('sine', 1300, 420, .16, .16, .08); noise(.3, .3, 2400, 600, 1.2, .2); },
    earth: () => { noise(.12, .3, 900, 200, .8); noise(.14, .34, 700, 160, .8, .12); tone('sine', 110, 40, .3, .5, .2); noise(.35, .2, 400, 120, .6, .22); },
    wind: () => { noise(.35, .28, 1200, 5200, 2.2); noise(.3, .24, 5200, 1500, 2.2, .14); },
    light: () => { tone('sine', 1320, 1760, .3, .14); tone('sine', 1980, 2640, .4, .1, .08); tone('triangle', 660, 660, .5, .1, .22); noise(.2, .1, 7000, 9000, 4, .22); },
    heal: () => { [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, f, .32, .12, i * .07, .02)); },
    steal: () => { noise(.08, .2, 5000, 8000, 3); tone('triangle', 1200, 1800, .08, .14, .05); },
    coin: () => { tone('triangle', 1568, 1568, .08, .16); tone('triangle', 2093, 2093, .22, .16, .07); },
    web: () => { noise(.4, .16, 4000, 7000, 5); tone('sine', 1500, 600, .3, .06); },
    split: () => { tone('sine', 300, 620, .14, .2); tone('sine', 280, 560, .14, .2, .12); },
    down: () => { tone('sine', 330, 60, .5, .26); noise(.4, .16, 600, 100, .7, .1); },
    edie: () => { noise(.45, .3, 2600, 200, .8); tone('sine', 220, 50, .4, .2); },
    flee: () => { for (let i = 0; i < 5; i++) noise(.05, .16, 700, 400, 1.2, i * .07); },
    encounter: () => { tone('sawtooth', 180, 720, .22, .12); tone('sawtooth', 190, 760, .22, .12, .16); noise(.5, .3, 600, 6000, .8, .1); },
    chest: () => { tone('square', 150, 110, .16, .05); noise(.1, .2, 500, 300, 2, .22); tone('sine', 660, 990, .3, .1, .3); },
    glint: () => { tone('sine', 2093, 2093, .12, .1); tone('sine', 3136, 3136, .3, .08, .06); },
    get: () => { [784, 988, 1175].forEach((f, i) => tone('triangle', f, f, .16, .14, i * .08)); },
    rare: () => { [659, 784, 988, 1319, 1568].forEach((f, i) => tone('triangle', f, f, .3, .14, i * .09, .01)); noise(.8, .08, 6000, 9000, 6, .3); },
    levelup: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, .22, .15, i * .09)); },
    save: () => { [587, 740, 880].forEach((f, i) => tone('sine', f, f, .5, .14, i * .16, .02)); },
    quill: () => { noise(.06, .14, 5000, 3000, 4); noise(.08, .14, 4500, 2500, 4, .09); },
    rest: () => { [392, 494, 587, 784].forEach((f, i) => tone('sine', f, f, .9, .1, i * .32, .05)); },
    buff: () => { tone('sine', 440, 880, .3, .12); },
    debuff: () => { tone('sine', 520, 200, .3, .14); },
    lose: () => { [392, 349, 294, 220].forEach((f, i) => tone('sine', f, f, 1.1, .14, i * .5, .05)); },
    door: () => { tone('square', 120, 90, .12, .06); noise(.08, .14, 400, 200, 2, .1); },
  };
  function sfx(name, when) { if (!ctx() || !FX[name]) return; try { if (when) setTimeout(FX[name], when * 1000); else FX[name](); } catch (e) {} }
  function volume(kind, v) { vol[kind] = v; if (ac) (kind === 'bgm' ? musicBus : sfxBus).gain.value = v; }
  const unlock = () => { ctx(); if (want && !cur) bgm(want); };
  addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);
  return { bgm, sfx, volume, get vol() { return vol; }, get current() { return cur && cur.id; } };
})();
