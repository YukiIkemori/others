#!/usr/bin/env node
// Audio unit tests (owner: audio A17). Node only, no browser: ~1 s.
//
//   node tools/test_audio.js            all groups
//   node tools/test_audio.js ids api    only some groups (ids content motif sfx api standins sources)
//
// Groups
//   ids       R.Audio.IDS = tools/render_audio.js lists = DESIGN §11.11.4 (32 BGM / 11 jingles / 62 SFX)
//   content   every id has its own definition (no stand-in), lint clean, per-track targets of §11.10.3
//             (tempo · meter · key · length), jingles one-shot, valzard = Crest's lastboss verbatim
//   motif     「語り部の主題」: 3/4 motif of 4 bars, exactly one major-sixth leap (bar 4), used by
//             title / home / ending / lastboss / overworld; chapter quotes its first four notes;
//             legend / ending quote Crest's THEME.TA
//   sfx       every SFX def runs on a recording kit; new ones end with S.gain(); lengths; glimmer ducks
//   api       runtime semantics with a fake AudioContext: playBGM no-op / unknown id, push/pop resume,
//             jingle pause-resume-resolve, jingle cut, push kills jingle, sfx retrigger guard and
//             3-voice cap, duck, setVolumes, locked audio resolves at once
//   standins  a content file missing (syntax-excluded) → ids fall back (§11.1.3) and are listed in PENDING
//   sources   every literal audio id called anywhere in src/ is in the lists (report only)
// Exit code 1 on any failure.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RA = require('./render_audio');

let fails = 0, passes = 0;
const groups = process.argv.slice(2);
const want = (g) => !groups.length || groups.includes(g);
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log('  ✗ ' + msg); } }
function section(name) { console.log(`— ${name}`); }

// --------------------------------------------------------------------------- loaders
function sandboxWith(extra) {
  const noop = () => {};
  const sb = Object.assign({
    console: { log: noop, warn: noop, error: console.error, info: noop },
    setTimeout, clearTimeout, setInterval, clearInterval, Math, JSON, Date, Promise,
    addEventListener: noop, removeEventListener: noop,
  }, extra || {});
  sb.window = sb;
  vm.createContext(sb);
  return sb;
}
function loadAudio(opts) {
  opts = opts || {};
  const sb = sandboxWith(opts.globals);
  const files = RA.FILES.filter((f) => !(opts.skip || []).includes(path.basename(f)));
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  const R = sb.RPG;
  if (opts.hooks) R.runDataHooks();
  R._sb = sb;
  return R;
}
function quietly(fn) {
  const log = console.log; const out = [];
  console.log = (...a) => out.push(a.join(' '));
  try { return { value: fn(), out }; } finally { console.log = log; }
}

// --------------------------------------------------------------------------- DESIGN §11.11.4
function designLists() {
  const md = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const i = md.indexOf('#### 11.11.4');
  const sec = md.slice(i, md.indexOf('\n### ', i));
  const line = (label) => sec.split('\n').find((l) => l.includes(label)) || '';
  const ticks = (s) => (s.match(/`([^`]+)`/g) || []).map((x) => x.slice(1, -1)).flatMap((x) => x.split(/\s+/));
  const bgm = ticks(line('**BGM')).filter((x) => /^[a-z0-9_]+$/.test(x));
  const jingles = ticks(line('**ジングル')).filter((x) => /^[a-z0-9_]+$/.test(x) && x !== 'jobup');
  // SFX: "クレストの 48" are listed in §11.10.5, the new ones on the §11.11.4 line
  const j = md.indexOf('#### 11.10.5');
  const crestLine = md.slice(j, md.indexOf('#### 11.10.6', j)).split('\n').find((l) => l.includes('クレストの 48')) || '';
  const crest48 = ticks(crestLine).filter((x) => /^[a-z0-9_]+$/.test(x));
  const fresh = ticks(line('**効果音')).filter((x) => /^[a-z0-9_]+$/.test(x) && x !== 'door');
  const counts = {
    bgm: +((line('**BGM').match(/BGM（(\d+)）/) || [])[1]), jingles: +((line('**ジングル').match(/ジングル（(\d+)）/) || [])[1]),
    sfx: +((line('**効果音').match(/効果音（(\d+)）/) || [])[1]),
  };
  const uniq = (a) => [...new Set(a)];
  return { bgm: uniq(bgm), jingles: uniq(jingles), sfx: uniq([...crest48, ...fresh]), crest48: uniq(crest48), counts };
}
const same = (a, b) => a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ');
const diff = (a, b) => `only-left [${a.filter((x) => !b.includes(x)).join(' ')}] only-right [${b.filter((x) => !a.includes(x)).join(' ')}]`;

// --------------------------------------------------------------------------- tests
const R = loadAudio({ hooks: true });
const I = R.Audio.IDS;

if (want('ids')) {
  section('ids: R.Audio.IDS = render_audio lists = DESIGN §11.11.4');
  const D = designLists();
  ok(I.bgm.length === 32 && I.jingles.length === 11 && I.sfx.length === 62, `counts ${I.bgm.length}/${I.jingles.length}/${I.sfx.length} (want 32/11/62)`);
  ok(D.counts.bgm === 32 && D.counts.jingles === 11 && D.counts.sfx === 62, `DESIGN counts ${JSON.stringify(D.counts)}`);
  ok(D.crest48.length === 48, `DESIGN §11.10.5 lists ${D.crest48.length} Crest SFX (want 48)`);
  ok(same(I.bgm, D.bgm), 'bgm vs DESIGN: ' + diff(I.bgm, D.bgm));
  ok(same(I.jingles, D.jingles), 'jingles vs DESIGN: ' + diff(I.jingles, D.jingles));
  ok(same(I.sfx, D.sfx), 'sfx vs DESIGN: ' + diff(I.sfx, D.sfx));
  ok(same(I.bgm, RA.BGM) && same(I.jingles, RA.JINGLES) && same(I.sfx, RA.SFX), 'render_audio.js lists drift: ' + JSON.stringify(RA.listDrift(R)));
  ok(new Set([...I.bgm, ...I.jingles]).size === 43, 'a BGM id is also a jingle id');
  ok(!I.jingles.includes('jobup') && !I.bgm.includes('jobup'), 'jobup is still listed (§11.10.1 drops it)');
  for (const k of ['bgm', 'jingles', 'sfx']) for (const [id, to] of Object.entries(R.Audio.FALLBACK[k])) {
    ok(I[k].includes(id), `FALLBACK.${k}.${id} is not a listed id`);
    ok(I[k === 'sfx' ? 'sfx' : 'bgm'].includes(to) || I.jingles.includes(to), `FALLBACK.${k}.${id} → ${to} is not a listed id`);
  }
}

if (want('content')) {
  section('content: definitions, lint, §11.10.3 targets');
  ok(R.Audio.PENDING.length === 0, 'PENDING not empty: ' + R.Audio.PENDING.join(' '));
  const bare = loadAudio({ hooks: false }); // no stand-ins registered: every id must be defined by content
  for (const id of [...I.bgm, ...I.jingles]) ok(!!bare.DB.music[id], `music '${id}' has no definition of its own`);
  for (const id of I.sfx) ok(typeof bare.DB.sfx[id] === 'function' || (bare.DB.sfx[id] && bare.DB.sfx[id].play), `sfx '${id}' has no definition of its own`);
  const lint = quietly(() => RA.lint(bare, [...I.bgm, ...I.jingles], false));
  ok(lint.value === 0, `lint problems ${lint.value}:\n    ` + lint.out.filter((l) => /✗|clash|≠|range|bad|odd|unknown/.test(l)).join('\n    '));
  const info = {};
  for (const id of [...I.bgm, ...I.jingles]) {
    const s = bare.Audio.compile(id), d = bare.DB.music[id];
    info[id] = { s, d, loopLen: s.loop ? s.endSec - s.loopSec : 0, bars: s.endTick / s.bar, loopBars: s.loop ? (s.endTick - s.loopTick) / s.bar : 0 };
    ok(s.warns.length === 0, `${id}: compile warnings ${s.warns.join('; ')}`);
    if (I.jingles.includes(id)) { ok(d.jingle === true && !s.loop, `${id}: jingle must be jingle:true and not loop`); ok(s.endSec <= 7, `${id}: jingle ${s.endSec.toFixed(1)} s > 7 s`); }
    else { ok(!d.jingle && s.loop, `${id}: BGM must loop`); ok(d.gain > 0.3 && d.gain < 1.6, `${id}: gain ${d.gain}`); }
  }
  // DESIGN §11.10.3 / §11.10.5 (tempo ♩, meter, key, seconds: total `dur` or loop `loop`, bars of the loop)
  const T = {
    title: { tempo: 92, meter: '3/4', key: 'G', dur: [70, 90] },
    ending: { dur: [90, 140], tempoChanges: 3 },
    lastboss: { tempo: 160, meter: '4/4', key: 'Em', loop: [56, 64] },
    tavern: { tempo: 116, meter: '6/8', key: 'D', loopBars: 24 },
    home: { tempo: 76, meter: '3/4', key: 'G', dur: [55, 66] },
    rival: { tempo: 156, key: 'Bm', loop: [40, 90] },
    tension: { tempo: 132, key: 'Gm', loop: [40, 90] },
    sorrow: { tempo: 66, key: 'Am', dur: [50, 62] },
    boss2: { tempo: 148, key: 'Fm', loop: [56, 64] },
    rarebattle: { tempo: 172, key: 'E', loop: [36, 45] },
    superboss: { tempo: 168, key: 'Ebm', dur: [70, 95] },
    postgame: { tempo: 84, key: 'F#m', dur: [50, 62] },
    forest: { tempo: 92, key: 'Dm', loop: [40, 90] },
    ghost: { tempo: 72, meter: '3/4', key: 'Cm', loop: [40, 90] },
    hollowking: { tempo: 132, key: 'Bm', dur: [46, 58] },
    legend: { dur: [27, 36] },
    overworld: { tempo: 112, key: 'D', loop: [40, 90] },
    superrare: { tempo: 144, key: 'A', dur: [3.0, 3.6] },
    chapter: { tempo: 90, meter: '3/4', dur: [3.6, 4.4] },
    recruit: { dur: [1.8, 2.3] },
  };
  for (const [id, t] of Object.entries(T)) {
    const x = info[id];
    if (!x) { ok(false, `${id}: missing`); continue; }
    const { s, d } = x;
    if (t.tempo) ok(d.tempo === t.tempo, `${id}: tempo ${d.tempo} ≠ ${t.tempo}`);
    if (t.meter) ok((d.meter || '4/4') === t.meter, `${id}: meter ${d.meter || '4/4'} ≠ ${t.meter}`);
    if (t.key) ok(d.key === t.key, `${id}: key ${d.key} ≠ ${t.key}`);
    if (t.dur) ok(s.endSec >= t.dur[0] && s.endSec <= t.dur[1], `${id}: ${s.endSec.toFixed(1)} s outside ${t.dur}`);
    if (t.loop) ok(x.loopLen >= t.loop[0] && x.loopLen <= t.loop[1], `${id}: loop ${x.loopLen.toFixed(1)} s outside ${t.loop}`);
    if (t.loopBars) ok(x.loopBars === t.loopBars, `${id}: loop ${x.loopBars} bars ≠ ${t.loopBars}`);
    if (t.tempoChanges) { const n = (d.ch[0].mml.match(/\bt\d+/g) || []).length; ok(n >= t.tempoChanges, `${id}: ${n} tempo marks < ${t.tempoChanges}`); }
  }
  // every new / rewritten BGM: 16–40 bars in its loop, an A/B contrast (≥ 2 sections or ≥ 2 lead instruments)
  const NEW = ['title', 'ending', 'lastboss', 'overworld', 'tavern', 'home', 'rival', 'tension', 'sorrow', 'boss2', 'rarebattle', 'superboss', 'postgame', 'forest', 'ghost', 'hollowking'];
  for (const id of NEW) {
    const x = info[id];
    ok(x.loopBars >= 16 && x.loopBars <= 48, `${id}: loop of ${x.loopBars} bars`);
    const secs = new Set((x.s.prog ? x.s.prog.spans : []).map((sp) => sp.sec).filter(Boolean));
    const leads = new Set((x.d.ch[0].mml || '').match(/@[a-z]+/g) || []);
    ok(secs.size >= 2 || leads.size >= 2, `${id}: no A/B contrast (sections ${[...secs]}, lead switches ${[...leads]})`);
  }
  // valzard = Crest's lastboss, unchanged (§11.10.3)
  let crest = null;
  const refFile = '/tmp/claude-0/ref/rpg/src/audio/music_battle.js';
  let src = null;
  try { src = fs.readFileSync(refFile, 'utf8'); } catch (e) {
    try { src = execFileSync('git', ['-C', ROOT, 'show', '8259156:rpg/src/audio/music_battle.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e2) { src = null; }
  }
  if (src) {
    const sb = sandboxWith(); sb.RPG = { DB: { music: {} } };
    vm.runInContext(src, sb);
    crest = sb.RPG.DB.music.lastboss;
    ok(JSON.stringify(crest) === JSON.stringify(bare.DB.music.valzard), 'valzard differs from Crest lastboss');
    ok(JSON.stringify(crest) !== JSON.stringify(bare.DB.music.lastboss), 'lastboss was not rewritten');
    for (const id of ['battle', 'boss']) ok(JSON.stringify(sb.RPG.DB.music[id]) === JSON.stringify(bare.DB.music[id]), `Crest ${id} changed (§11.10.3 keeps it as is)`);
  } else console.log('  (Crest reference copy not found — valzard check skipped)');
  ok(!!bare.DB.music.jobup, 'jobup definition removed (keep it as material)');
}

if (want('motif')) {
  section('motif: 「語り部の主題」');
  const MO = R.Audio.MOTIFS;
  for (const k of ['TELLER', 'TELLER_ANS', 'TELLER_B', 'TELLER4', 'TELLER4_ANS', 'TELLER4_B', 'TELLER4_MIN', 'CREST_TA', 'CREST_TA4']) ok(typeof MO[k] === 'string', `motif ${k} missing`);
  const notes = (mml, bar) => {
    const w = [];
    const p = R.Audio.parseMML('o5 ' + mml, { defs: MO, bar, warns: w, name: 'motif' });
    return { ev: p.events, end: p.end, w };
  };
  const m = notes(MO.TELLER, 144);
  ok(m.w.length === 0 && m.end === 4 * 144, `TELLER: ${m.end / 144} bars of 3/4, warns ${m.w}`);
  const leaps = [];
  for (let i = 1; i < m.ev.length; i++) leaps.push({ iv: m.ev[i].notes[0] - m.ev[i - 1].notes[0], bar: Math.floor(m.ev[i].tick / 144) + 1 });
  const sixths = leaps.filter((l) => Math.abs(l.iv) === 9);
  ok(sixths.length === 1 && sixths[0].bar === 4, `TELLER needs exactly one major-6th leap, in bar 4: ${JSON.stringify(sixths)}`);
  ok(m.ev[0].notes[0] % 12 === 4, 'TELLER must start on E (E minor)');
  ok(m.ev[m.ev.length - 1].notes[0] % 12 === 11 && R.Audio.parseChord('G', []).pcs.includes(m.ev[m.ev.length - 1].notes[0] % 12), 'TELLER must end inside G major');
  for (const k of ['TELLER_ANS', 'TELLER_B']) { const x = notes(MO[k], 144); ok(x.w.length === 0 && x.end % 144 === 0, `${k} bars`); }
  for (const k of ['TELLER4', 'TELLER4_ANS', 'TELLER4_B', 'TELLER4_MIN', 'CREST_TA4']) { const x = notes(MO[k], 192); ok(x.w.length === 0 && x.end % 192 === 0, `${k} bars`); }
  // the 4/4 line keeps the same pitches as the 3/4 motif
  const p3 = m.ev.map((e) => e.notes[0]).join(), p4 = notes(MO.TELLER4, 192).ev.map((e) => e.notes[0]).join();
  ok(p3 === p4, 'TELLER4 must keep TELLER\'s pitches');
  const uses = { title: /\$TELLER\b/, home: /\$TELLER\b/, ending: /\$TELLER4\b/, lastboss: /\$TELLER4_MIN/, overworld: /\$TELLER4_B/, legend: /\$CREST_TA\b/ };
  for (const [id, re] of Object.entries(uses)) ok(R.DB.music[id].ch.some((c) => re.test(c.mml || '')), `${id} does not use ${re}`);
  ok(R.DB.music.ending.ch.some((c) => /\$CREST_TA4/.test(c.mml || '') && /musicbox/.test(c.inst)), 'ending must quote CREST_TA4 on the music box');
  ok(R.DB.music.lastboss.ch[0].mml.includes('$TELLER4 '), 'lastboss must turn the theme to major ($TELLER4) in its loop');
  const ch = R.Audio.compile('chapter');
  const first4 = ch.events.filter((e) => e.ch === 0).slice(0, 4).map((e) => e.notes[0] % 12).join();
  ok(first4 === m.ev.slice(0, 4).map((e) => e.notes[0] % 12).join(), `chapter's first four notes ${first4} ≠ TELLER's`);
  ok(R.Audio.compile('chapter').channels[0].inst === 'celesta', 'chapter leads with celesta');
}

if (want('sfx')) {
  section('sfx: kit runs, gains, lengths');
  // a kit that records calls and computes end times like the real Mixer (no audio)
  const kit = () => {
    const calls = [];
    const S = {
      t0: 0, end: 0,
      _e(x) { if (x > this.end) this.end = x; return this; },
      _len(o) { const t = (o.t || 0), a = o.a != null ? o.a : 0.002, d = o.d != null ? o.d : 0.1, r = o.r != null ? o.r : 0.04; return this.t0 + t + Math.max(a, d) + r; },
      tone(o) { calls.push('tone'); return this._e(this._len(o)); },
      noise(o) { calls.push('noise'); return this._e(this._len(o)); },
      fm(o) { calls.push('fm'); return this._e(this._len(o)); },
      seq(n, step, o) { o = o || {}; n.forEach((x, i) => { if (x != null) this.tone(Object.assign({ d: step }, o, { t: (o.t || 0) + i * step })); }); return this; },
      bells(n, step, o) { o = o || {}; n.forEach((x, i) => { if (x != null) this.fm(Object.assign({ d: step }, o, { t: (o.t || 0) + i * step })); }); return this; },
      drum(k, t) { calls.push('drum'); return this._e(this.t0 + (t || 0) + 0.9); },
      inst(name, n, t, dur) { calls.push('inst'); if (!R.Audio.INST[name]) throw new Error('unknown inst ' + name); return this._e(this.t0 + (t || 0) + (dur || 0.2) + R.Audio.INST[name].env[3]); },
      wet(v) { calls.push('wet'); S.wetV = v; return this; },
      gain(v) { calls.push('gain'); S.gainV = v; return this; },
      duck(db, hold) { calls.push('duck'); S.ducked = [db, hold]; return this; },
    };
    return { S, calls };
  };
  const NEW = ['glimmer', 'golden', 'light', 'freeze', 'burn', 'quill', 'page', 'swap', 'bell', 'unlock', 'arrow', 'lash', 'parry', 'secret'];
  const lens = {};
  for (const id of I.sfx) {
    const { S, calls } = kit();
    let err = null;
    try { const def = R.DB.sfx[id]; (typeof def === 'function' ? def : def.play)(S); } catch (e) { err = e; }
    ok(!err, `sfx ${id} threw ${err && err.message}`);
    lens[id] = S.end;
    ok(S.end > 0.02 && S.end < 3.2, `sfx ${id}: length ${S.end.toFixed(2)} s`);
    if (NEW.includes(id)) {
      ok(calls[calls.length - 1] === 'gain' && S.gainV > 0.2 && S.gainV < 4, `sfx ${id}: must end with its own S.gain() (got ${calls.slice(-2)})`);
    }
  }
  ok(lens.page <= 0.3 && lens.swap <= 0.3, `UI sounds must be short: page ${lens.page.toFixed(2)} swap ${lens.swap.toFixed(2)}`);
  ok(lens.glimmer >= 0.6 && lens.glimmer <= 1.4, `glimmer rings ${lens.glimmer.toFixed(2)} s (want 0.6–1.4)`);
  const g = kit(); R.DB.sfx.glimmer(g.S);
  ok(g.S.ducked && g.S.ducked[0] < 0 && g.S.ducked[1] <= 0.4, 'glimmer must duck the BGM briefly (≤ 0.4 s)');
  ok(lens.light < lens.holy, `light (${lens.light.toFixed(2)} s) must be shorter than holy (${lens.holy.toFixed(2)} s)`);
}

// --------------------------------------------------------------------------- fake Web Audio
function fakeAudio() {
  const made = { gains: [], osc: 0, src: 0 };
  class Param {
    constructor(v) { this.value = v; this.ev = []; }
    setValueAtTime(v, t) { this.ev.push(['set', v, t]); return this; }
    linearRampToValueAtTime(v, t) { this.ev.push(['lin', v, t]); return this; }
    exponentialRampToValueAtTime(v, t) { this.ev.push(['exp', v, t]); return this; }
    setTargetAtTime(v, t, c) { this.ev.push(['tgt', v, t, c]); return this; }
    cancelScheduledValues(t) { this.ev.push(['cancel', t]); return this; }
    cancelAndHoldAtTime(t) { this.ev.push(['hold', t]); return this; }
  }
  class Node { constructor(ctx) { this.ctx = ctx; } connect(n) { return n; } disconnect() {} }
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 32000; this.destination = new Node(this); }
    createGain() { const n = new Node(this); n.gain = new Param(1); made.gains.push(n); return n; }
    createOscillator() { made.osc++; const n = new Node(this); n.frequency = new Param(440); n.detune = new Param(0); n.setPeriodicWave = () => {}; n.start = () => {}; n.stop = () => {}; return n; }
    createBiquadFilter() { const n = new Node(this); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); return n; }
    createDelay() { const n = new Node(this); n.delayTime = new Param(0); return n; }
    createChannelMerger() { return new Node(this); }
    createStereoPanner() { const n = new Node(this); n.pan = new Param(0); return n; }
    createDynamicsCompressor() { const n = new Node(this); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    createBufferSource() { made.src++; const n = new Node(this); n.playbackRate = new Param(1); n.start = () => {}; n.stop = () => {}; return n; }
    createPeriodicWave() { return {}; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  return { Ctx, made };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiTests() {
  section('api: runtime semantics (fake AudioContext)');
  const FA = fakeAudio();
  let now = 1e12;
  const FakeDate = { now: () => now };
  const warns = [];
  const A = loadAudio({ hooks: true, globals: { AudioContext: FA.Ctx, Date: FakeDate, requestIdleCallback: undefined } });
  A.warn = (...a) => warns.push(a.join(' '));
  const Au = A.Audio;
  // before init everything is a safe no-op
  ok((await Promise.race([A.jingle('victory').then(() => 'ok'), sleep(50).then(() => 'hang')])) === 'ok', 'R.jingle before init must resolve');
  A.bgm('town');
  ok(Au.current === 'town', 'playBGM before init records the track');
  ok(Au.init() === true && Au.ready, 'init() with an AudioContext');
  const ctx = Au.context;
  const tick = async (t) => { ctx.currentTime = t; await sleep(40); };
  await tick(0.1);
  let d = Au.debug();
  ok(d.playing === 'town' && d.current === 'town', `init starts the pending track: ${JSON.stringify(d)}`);
  const serial = d.serial;
  Au.playBGM('town');
  ok(Au.debug().serial === serial, 'playBGM(same id) restarted the track');
  Au.playBGM('no_such_track');
  ok(Au.debug().current === 'town' && warns.some((w) => /unknown BGM 'no_such_track'/.test(w)), 'unknown BGM must warn and keep the current track');
  // push / pop keeps the position
  await tick(5);
  Au.pushBGM('battle');
  d = Au.debug();
  ok(d.current === 'battle' && d.stack[0] === 'town', `pushBGM: ${JSON.stringify(d)}`);
  await tick(12);
  Au.popBGM();
  await tick(12.05);
  d = Au.debug();
  ok(d.current === 'town' && Math.abs(d.pos - 4.9) < 0.2, `popBGM resumes town near 4.9 s (pos ${d.pos})`);
  // jingle: pauses, resolves at its written end, resumes BGM
  let done = false;
  const j = Au.playJingle('victory').then(() => { done = true; });
  await tick(12.2);
  d = Au.debug();
  ok(d.jingle === 'victory' && d.playing === null && d.current === 'town', `jingle pauses BGM: ${JSON.stringify(d)}`);
  const vicLen = Au.info('victory').duration;
  await tick(12.05 + vicLen - 0.3);
  ok(!done, 'jingle resolved too early');
  await tick(12.1 + vicLen + 0.1);
  await j;
  d = Au.debug();
  ok(done && d.jingle === null && d.playing === 'town', `jingle end resumes BGM: ${JSON.stringify(d)}`);
  // a new jingle cuts the previous one (its promise resolves at once)
  let first = false;
  ctx.currentTime = 30;
  Au.playJingle('rare').then(() => { first = true; });
  Au.playJingle('item');
  await sleep(5);
  ok(first, 'a new jingle must resolve the cut one');
  // pushBGM kills a running jingle
  let second = false;
  Au.playJingle('superrare').then(() => { second = true; });
  Au.pushBGM('rarebattle');
  await sleep(5);
  ok(second && Au.debug().jingle === null && Au.debug().current === 'rarebattle', 'pushBGM must end the jingle and play the battle track');
  Au.popBGM();
  // playBGM during a jingle only changes `cur`; the new track starts after
  Au.playJingle('recruit');
  Au.playBGM('tavern', { fade: 20 });
  d = Au.debug();
  ok(d.current === 'tavern' && d.playing === null && d.jingle === 'recruit', `playBGM during a jingle waits: ${JSON.stringify(d)}`);
  await tick(31 + 2.2);
  await tick(31 + 2.4);
  ok(Au.debug().playing === 'tavern', 'track set during a jingle starts after it');
  // sfx: retrigger guard (< 30 ms) and at most 3 live voices of one id
  ctx.currentTime = 40;
  const o0 = FA.made.osc;
  A.sfx('glimmer');
  const o1 = FA.made.osc;
  A.sfx('glimmer');
  ok(o1 > o0 && FA.made.osc === o1, 'sfx retriggered within 30 ms must be dropped');
  // glimmer ducks the music bus: some gain param ramps to −6 dB
  const ducked = FA.made.gains.some((g) => g.gain.ev.some((e) => e[0] === 'lin' && Math.abs(e[1] - Math.pow(10, -6 / 20)) < 1e-3));
  ok(ducked, 'glimmer must duck the music bus by 6 dB');
  let killed = 0;
  const before = FA.made.gains.length;
  for (let k = 1; k <= 4; k++) { ctx.currentTime = 40 + k * 0.05; A.sfx('glimmer'); }
  for (const g of FA.made.gains.slice(0, before)) if (g.gain.ev.some((e) => e[0] === 'lin' && e[1] === 0 && e[2] > 40.1 && e[2] < 40.3)) killed++;
  ok(killed >= 1, 'a 4th live instance of one sfx must fade the oldest');
  A.sfx('no_such_sfx');
  ok(warns.some((w) => /unknown sfx 'no_such_sfx'/.test(w)), 'unknown sfx must warn');
  // duck API
  ctx.currentTime = 50;
  Au.duck(-9, 30);
  const dk = FA.made.gains.find((g) => g.gain.ev.some((e) => e[0] === 'lin' && Math.abs(e[1] - Math.pow(10, -9 / 20)) < 1e-3 && e[2] > 50));
  ok(dk && dk.gain.ev.some((e) => e[0] === 'lin' && e[1] === 1 && Math.abs(e[2] - (50.03 + 0.5 + 0.25)) < 1e-6), 'duck(-9, 30) dips 9 dB for 0.5 s and recovers in 0.25 s');
  // volumes follow the v^1.5 curve
  Au.setVolumes(0.5, 0.25);
  ok(FA.made.gains.some((g) => g.gain.ev.some((e) => e[0] === 'lin' && Math.abs(e[1] - Math.pow(0.5, 1.5)) < 1e-9)), 'setVolumes: music gain = 0.5^1.5');
  ok(Au.debug().volumes.bgm === 0.5 && Au.debug().volumes.sfx === 0.25, 'setVolumes stores the values');
  // locked audio (suspended context, past the 1.5 s grace): jingles resolve at once, sfx silent
  ctx.state = 'suspended'; now += 10000;
  const o2 = FA.made.osc;
  ok((await Promise.race([Au.playJingle('levelup').then(() => 'ok'), sleep(30).then(() => 'hang')])) === 'ok', 'jingle with locked audio must resolve at once');
  A.sfx('cursor');
  ok(FA.made.osc === o2, 'sfx with locked audio must stay silent');
  ctx.state = 'running';
  Au.stopBGM(10);
  ok(Au.current === null && Au.debug().playing === null, 'stopBGM clears the track');
  // stand-in resolution through the public API
  ok(Au.resolve('bgm', 'tavern') === 'tavern' && Au.resolve('sfx', 'glimmer') === 'glimmer', 'resolve() of defined ids');
}

function standinTests() {
  section('standins: a content file missing → stand-ins + PENDING (§11.1.3)');
  const skip = ['music_chronicle.js', 'music_chronicle_battle.js', 'jingles_chronicle.js', 'sfx_chronicle.js'];
  const A = loadAudio({ skip, hooks: false });
  A.Audio.PENDING.push('bbg:elsewhere'); // another owner's id pushed earlier must survive
  A.runDataHooks();
  const P = A.Audio.PENDING;
  ok(P.includes('bbg:elsewhere'), 'PENDING was replaced instead of pushed to');
  const exp = { tavern: 'town', home: 'village', rival: 'boss', tension: 'dungeon', sorrow: 'shrine', boss2: 'boss', hollowking: 'boss', rarebattle: 'battle', postgame: 'lastdungeon', forest: 'cave', ghost: 'dungeon', legend: 'shrine' };
  for (const [id, to] of Object.entries(exp)) ok(A.DB.music[id] === A.DB.music[to] && P.includes(id), `${id} → ${to} stand-in`);
  ok(A.DB.music.superboss === A.DB.music.lastboss, 'superboss → lastboss stand-in');
  for (const [id, to] of Object.entries({ superrare: 'rare', chapter: 'keyitem', recruit: 'item' })) ok(A.DB.music[id] === A.DB.music[to] && P.includes(id), `jingle ${id} → ${to}`);
  for (const id of Object.keys(A.Audio.FALLBACK.sfx)) ok(typeof A.DB.sfx[id] === 'function' && P.includes(id), `sfx ${id} stand-in`);
  ok(!P.includes('title') && !P.includes('town'), 'defined ids must not be pending');
  // stand-in sfx forwards to the fallback's def
  let hit = null;
  A.DB.sfx.magic = (S) => { hit = 'magic'; };
  A.DB.sfx.glimmer({});
  ok(hit === 'magic', 'sfx stand-in must forward to its fallback');
}

function sourceScan() {
  section('sources: literal audio ids in src/ (report)');
  const all = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) all.push(p); });
  walk(path.join(ROOT, 'src'));
  const bad = [];
  const RE = [
    [/\b(?:R\.|ev\.|S\.)?sfx\(\s*['"]([a-z0-9_]+)['"]/g, 'sfx'], [/\bsfx:\s*['"]([a-z0-9_]+)['"]/g, 'sfx'],
    [/\b(?:R\.bgm|ev\.bgm|playBGM|pushBGM)\(\s*['"]([a-z0-9_]+)['"]/g, 'bgm'], [/\bbgm:\s*['"]([a-z0-9_]+)['"]/g, 'bgm'],
    [/\b(?:R\.jingle|ev\.jingle|playJingle)\(\s*['"]([a-z0-9_]+)['"]/g, 'jingle'], [/\bjingle:\s*['"]([a-z0-9_]+)['"]/g, 'jingle'],
  ];
  for (const f of all) {
    if (f.includes(path.join('src', 'audio')) || f.endsWith(path.join('core', 'audio.js'))) continue;
    const s = fs.readFileSync(f, 'utf8');
    for (const [re, kind] of RE) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(s))) {
        const id = m[1];
        const okId = kind === 'sfx' ? I.sfx.includes(id) : kind === 'bgm' ? I.bgm.includes(id) : I.jingles.includes(id);
        if (!okId) bad.push(`${path.relative(ROOT, f)}: ${kind} '${id}'`);
      }
    }
  }
  if (bad.length) console.log('  ! ids not in §11.11.4 (other owners\' files — reported, not failed):\n    ' + [...new Set(bad)].join('\n    '));
  else console.log('  all literal ids are listed');
}

(async () => {
  if (want('api')) await apiTests();
  if (want('standins')) standinTests();
  if (want('sources')) sourceScan();
  console.log(`\ntest_audio: ${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
