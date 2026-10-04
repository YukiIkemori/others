// v2（CORE）: 今のゲームの src/core/audio.js を移した物（V2_PLAN §1.2「そのまま」）。直した所:
//   - 媒体の一覧は R.Media（core/media.js）から読む（外に置いた版・--single の埋め込みの両方。初めて鳴らすときに解く）
//   - 音量は R.Settings の vol.bgm / vol.sfx / vol.voice（0〜10）
//   - ボイスの間の BGM は 0.6 倍（§2.5.4）
//   - 契約の名前（§2.5.4）を足した: bgm(id,{fade ms}) pushBgm popBgm stopBgm(ms) sfx(id,{vol,pan}) jingle(id) voice(id)→Promise stopVoice()
//   - 起動時に録音を先読みしない（'battle' の先読みをやめた。§2.10「起動からタイトルまでに解く音 0」）
//   - 今のボイスの id は voiceId（voice は関数の名前にした）
//   - endJingle(fadeMs): 鳴っているジングルを途中で閉じて BGM を戻す（宿の眠りを飛ばす。'ended' を待たない）/ jingleId
// Audio: SFC-flavoured Web Audio synth — instruments, MML sequencer, chord
// arranger, BGM / jingle / SFX control (DESIGN §3). No samples: every sound is
// synthesised (pulse waves via PeriodicWave, filtered saws, FM bells, noise
// drums) and sent through a ping-pong echo for the SFC sheen.
//
// TRACKS (src/audio/music.js):
//   R.DB.music.id = { tempo, meter:'4/4', gain, jingle?, echo:{time,fb,wet,lp},
//     defs:{name:'mml or chords'}, chords:'C | G/B | Am F | ...',
//     ch:[ {inst, vol, pan, echo, mml:'...'}                          // hand-written
//        | {inst, vol, pan, echo, pat:'...', pats:{sec:'...'}, range:[lo,hi], voices}   // arranged
//        | {inst, vol, pan, echo, harm:chIndex, below:[3,9], oct, min} ] }            // harmony voice
//   A jingle (jingle:true) plays once and ends with its hand-written parts.
// MML:  c d e f g a b (+/# sharp, - flat)  r rest  length 1..192 or %ticks, dots
//       ^len tie · & legato/tie to next · o4 > < octave · l8 default length · q1-8 gate
//       v0-15 velocity · @inst · k±n transpose · t120 tempo · {ceg}4 chord
//       [ ... : ... ]n loop (':' = leave on the last pass) · L loop point · | bar check
//       ; comment · $name macro (end the name with a space)
// Drums (inst 'drums'): k kick s snare h hat o open hat c crash t m f toms x rim
//       z shaker p clap b bass drum g gong w woodblock i triangle
// Chords: 'C Am/E F#m7b5 Bb9' per bar split by |, C*3 G weights, % repeat bar,
//       x silence, L loop point, @sec switches arranged channels to pats[sec].
// Patterns: R bass  T 3rd  F 5th  S 7th/6th  N 9th  O octave  A approach to the
//       next bass · a-f voiced chord notes (low→high) · C whole voicing · r rest
//       ' up / , down an octave · lengths like MML · l8 · q1-8 gate · ! accent.
// Shared motifs: R.Audio.MOTIFS = {name: 'mml'} are macros every track can use
//       ($TELLER …); a track's own defs win over a motif of the same name.
//
// Chronicle (DESIGN §11.10 / §11.11.4):
//   R.Audio.IDS      = {bgm[32], jingles[11], sfx[62]} — the normative id lists
//   R.Audio.FALLBACK = {bgm, jingles, sfx}: id → stand-in used while an id has no
//                      definition (a content file failed to load); R.Audio.PENDING
//                      lists the ids currently served by a stand-in (push only)
//   R.Audio.duck(db, frames) — dip the music bus briefly (glimmer ピコーン)
//
// Recorded media (BRIEF A9/A10, design/notes/audio.md §13): window.RPG_MEDIA (written by tools/build.js
// from assets/bgm/ and assets/voice/) = {bgm:{id:{src,loopStart,loopEnd,gain,loop}}, voice:{id:{src}}}.
//   playBGM/pushBGM/popBGM(id) play assets/bgm/<id>.* instead of the synth track when listed (decoded on
//   first use, looped between loopStart/loopEnd s; decode failure → synth). Jingles stay synthesised.
//   R.Audio.playVoice(id) → handle|null, stopVoice(handle?) — own bus (Settings.voiceVolume), BGM −9 dB
//   R.Audio.preloadVoice(ids) → Promise — fetch + decode voice lines ahead (the opening; packed voice/pack_NN.ogg).
//   while a line plays. setVolumes(bgm, sfx, voice).
//   R.Audio.battleVoiceId(id) — any battle clip by id (no duck, replaces only the previous battle voice).
//   R.Audio.battleVoice(kind[, gender]) — the hero's battle shout v_hero_<m|f>_<kind>_<n> (random clip, no duck;
//   kinds attack glimmer spell hurt ko victory; gender from R.State.hero().gender). Missing → silent.
(function (R) {
  'use strict';
  const DB = R.DB;
  const TPW = 192; // ticks per whole note (quarter 48, 8th 24, triplet 8th 16)
  const MOTIFS = {}; // shared MML / chord macros (filled by src/audio/*.js)

  // ============================================================ id lists (DESIGN §11.11.4)
  const words = (s) => s.trim().split(/\s+/);
  const IDS = {
    bgm: words(`title overworld sea town village castle shrine ending dungeon cave tower pyramid ice
      volcano lastdungeon battle boss lastboss valzard tavern home rival tension sorrow boss2 rarebattle
      superboss postgame forest ghost hollowking legend`),
    jingles: words('victory levelup item keyitem inn save gameover rare superrare chapter recruit'),
    sfx: words(`cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt
      magic fire ice thunder wind holy dark earth water heal revive buff debuff status poison sleep death
      enemy_die boss_die escape stairs door locked chest item gold step_damage ship bump warp teleport
      steal jump breath roar shake glimmer golden light freeze burn quill page swap bell unlock arrow
      lash parry secret`),
  };
  // stand-ins (DESIGN §11.10.3 / §11.10.5 「代わり」); chains resolve (valzard → boss2 → boss)
  const FALLBACK = {
    bgm: {
      valzard: 'boss2', hollowking: 'boss2', tavern: 'town', home: 'village', rival: 'boss', tension: 'dungeon',
      sorrow: 'shrine', boss2: 'boss', rarebattle: 'battle', superboss: 'lastboss', postgame: 'lastdungeon',
      forest: 'cave', ghost: 'dungeon', legend: 'shrine',
      lostwood: 'forest', eldertree: 'shrine', dawn: 'title', fine_theme: 'shrine',   // 2026-09-27 の新しい録音の曲（design/bgm_changes.md）。omen は無ければ鳴らさない
      lastboss2: 'lastboss', regionboss: 'boss2', chapterboss: 'boss',   // 2026-10-03 ボスの曲の 3 分け（最後・地方・章）
      marsh: 'town', isles: 'town', mine: 'town', ash: 'town', star: 'town', sea: 'overworld',   // 同じ日の地方の曲（湿原・諸島・山地・灰の荒野・高原）
    },
    jingles: { superrare: 'rare', chapter: 'keyitem', recruit: 'item' },
    sfx: {
      glimmer: 'magic', golden: 'item', light: 'holy', freeze: 'ice', burn: 'fire', quill: 'item', page: 'cursor',
      swap: 'confirm_soft', bell: 'warp', unlock: 'door', arrow: 'attack', lash: 'attack', parry: 'crit', secret: 'door',
    },
  };
  function standIn(table, reg, id) {
    for (let k = 0, x = id; k < 6; k++) {
      x = table[x];
      if (!x) return null;
      if (reg[x]) return x;
    }
    return null;
  }
  const LOOKAHEAD = 0.12;
  const TICK_MS = 25;
  const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const DRUM_KEYS = 'kshoctmfxzpbgwi';
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ============================================================ text helpers
  function stripComments(s) { return String(s).replace(/;[^\n]*/g, ' '); }
  function expandMacros(s, defs, warns, depth) {
    return s.replace(/\$([A-Za-z0-9_]+)/g, (m, name) => {
      if (!defs || !(name in defs)) { warns.push(`unknown macro $${name}`); return ' '; }
      if ((depth || 0) > 8) { warns.push('macro recursion'); return ' '; }
      return ' ' + expandMacros(stripComments(defs[name]), defs, warns, (depth || 0) + 1) + ' ';
    });
  }
  function expandLoops(s, warns) {
    const re = /\[([^[\]]*)\](\d*)/;
    let guard = 0;
    while (re.test(s)) {
      if (guard++ > 2000) { warns.push('loop expansion overflow'); break; }
      s = s.replace(re, (m, body, n) => {
        n = n === '' ? 2 : +n;
        const k = body.indexOf(':');
        let out = '';
        for (let i = 0; i < n; i++) out += ' ' + (k >= 0 ? (i === n - 1 ? body.slice(0, k) : body.slice(0, k) + ' ' + body.slice(k + 1)) : body) + ' ';
        return out;
      });
    }
    if (/[[\]]/.test(s)) warns.push('unbalanced [ ]');
    return s;
  }
  function meterTicks(m) {
    const [a, b] = String(m || '4/4').split('/').map(Number);
    return a * (TPW / b);
  }

  // ============================================================ MML parser
  function parseMML(src, o) {
    const warns = o.warns;
    const s = expandLoops(expandMacros(stripComments(src), o.defs, warns), warns);
    const drum = !!o.drum, bar = o.bar;
    const out = { events: [], tempos: [], loop: null, end: 0 };
    const n = s.length;
    const NUM = /-?\d+/y, NAME = /[a-z0-9_]+/y;
    let i = 0, pos = 0, oct = 4, len = 48, q = o.q || 7, vel = 12, tr = 0, inst = o.inst;
    let last = null, tie = false;
    const w = (msg) => warns.push(`${o.name}: ${msg} (bar ${bar ? Math.floor(pos / bar) + 1 : '?'})`);
    function int(def) {
      NUM.lastIndex = i;
      const m = NUM.exec(s);
      if (!m) return def;
      i = NUM.lastIndex;
      return +m[0];
    }
    function length(def) {
      let t;
      if (s[i] === '%') { i++; t = int(null); if (t == null) { w('bad %length'); t = def; } }
      else {
        const v = int(null);
        if (v == null) t = def;
        else { if (v <= 0 || TPW % v) w(`odd length ${v}`); t = TPW / Math.max(1, v); }
      }
      let add = t;
      while (s[i] === '.') { add /= 2; t += add; i++; }
      return t;
    }
    function acc() {
      let a = 0;
      for (;;) {
        const c = s[i];
        if (c === '+' || c === '#') a++;
        else if (c === '-') a--;
        else break;
        i++;
      }
      return a;
    }
    const same = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
    function note(notes, L) {
      const adj = last && last.tick + last.len === pos;
      if (tie && adj && same(last.notes, notes)) {
        last.len += L;
        last.gate = last.len - L * (8 - q) / 8;
      } else {
        if (tie && adj) last.gate = last.len;
        last = { tick: pos, len: L, gate: L * q / 8, notes, vel, inst, drum };
        out.events.push(last);
      }
      tie = false;
      pos += L;
    }
    while (i < n) {
      const c = s[i++];
      if (c <= ' ') continue;
      if (c === '|') { if (bar && pos % bar) w(`bar check off by ${pos % bar} ticks`); continue; }
      if (c === 'L') { out.loop = pos; continue; }
      if (c === 'l') { len = length(len); continue; }
      if (c === 'v') { vel = int(vel); continue; }
      if (c === 'q') { q = Math.max(1, Math.min(8, int(q))); continue; }
      if (c === '&') { tie = true; continue; }
      if (c === '^') {
        const L = length(len);
        if (last && last.tick + last.len === pos) { last.len += L; last.gate = last.len - L * (8 - q) / 8; }
        pos += L;
        continue;
      }
      if (c === 'r') { pos += length(len); last = null; tie = false; continue; }
      if (c === '{') {
        const notes = [];
        let o2 = oct;
        while (i < n && s[i] !== '}') {
          const d = s[i++];
          if (d <= ' ') continue;
          if (drum) { if (DRUM_KEYS.includes(d)) notes.push(d); else w(`bad drum '${d}'`); continue; }
          if (d === '>') o2++;
          else if (d === '<') o2--;
          else if (d === 'o') o2 = int(o2);
          else if (d in PC) notes.push((o2 + 1) * 12 + PC[d] + acc() + tr);
          else w(`unexpected '${d}' in chord`);
        }
        i++;
        if (notes.length) note(notes, length(len)); else pos += length(len);
        continue;
      }
      if (drum) {
        if (DRUM_KEYS.includes(c)) { note([c], length(len)); continue; }
      } else {
        if (c in PC) { const m = (oct + 1) * 12 + PC[c] + acc() + tr; note([m], length(len)); continue; }
        if (c === 'o') { oct = int(oct); continue; }
        if (c === '>') { oct++; continue; }
        if (c === '<') { oct--; continue; }
        if (c === 't') { out.tempos.push({ tick: pos, bpm: int(120) }); continue; }
        if (c === 'k') { tr = int(0); continue; }
        if (c === '@') {
          NAME.lastIndex = i;
          const m = NAME.exec(s);
          if (m) { i = NAME.lastIndex; inst = m[0]; if (!INST[inst]) w(`unknown instrument @${inst}`); }
          continue;
        }
      }
      w(`unexpected '${c}'`);
    }
    out.end = pos;
    return out;
  }

  // ============================================================ chords & arranger
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], 7: [0, 4, 7, 10], M7: [0, 4, 7, 11], maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10], mM7: [0, 3, 7, 11], dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10],
    aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14],
    M9: [0, 4, 7, 11, 14], '7sus4': [0, 5, 7, 10], '7b9': [0, 4, 7, 10, 13], 69: [0, 4, 7, 9, 14],
  };
  const pcOf = (l, a) => (PC[l.toLowerCase()] + (a === '#' ? 1 : a === 'b' ? -1 : 0) + 12) % 12;
  function parseChord(sym, warns) {
    const m = /^([A-G])([#b]?)([A-Za-z0-9]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
    if (!m || !QUAL[m[3]]) { warns.push(`bad chord '${sym}'`); return null; }
    const root = pcOf(m[1], m[2]);
    const ivs = QUAL[m[3]];
    return { sym, root, ivs, bass: m[4] ? pcOf(m[4], m[5]) : root, pcs: ivs.map((v) => (root + v) % 12) };
  }
  function parseProg(src, bar, defs, warns) {
    const s = expandLoops(expandMacros(stripComments(src), defs, warns), warns).replace(/\|/g, ' | ');
    const spans = [];
    let pos = 0, loop = null, cur = [], prev = null, sec = null;
    const flush = () => {
      if (!cur.length) return;
      const tot = cur.reduce((a, c) => a + c.w, 0);
      let t = pos;
      cur.forEach((c, k) => {
        const L = k === cur.length - 1 ? pos + bar - t : Math.round(bar * c.w / tot);
        spans.push({ tick: t, len: L, chord: c.chord, sec: c.sec });
        t += L;
      });
      prev = cur; cur = []; pos += bar;
    };
    for (const tk of s.split(/\s+/)) {
      if (!tk) continue;
      if (tk === '|') { flush(); continue; }
      if (tk === 'L') { if (cur.length) warns.push('chords: L must start a bar'); loop = pos; continue; }
      if (tk[0] === '@') { sec = tk.slice(1); continue; }
      if (tk === '%') { if (prev) prev.forEach((c) => cur.push({ chord: c.chord, w: c.w, sec: null })); continue; }
      const [sym, wt] = tk.split('*');
      cur.push({ chord: sym === 'x' ? null : parseChord(sym, warns), w: wt ? +wt : 1, sec });
      sec = null;
    }
    flush();
    return { spans, loop, end: pos };
  }
  function parsePat(src, warns) {
    const s = stripComments(src);
    const toks = [];
    let i = 0, len = 24, total = 0, gate = 0;
    const NUM = /\d+/y;
    const int = () => { NUM.lastIndex = i; const m = NUM.exec(s); if (!m) return null; i = NUM.lastIndex; return +m[0]; };
    const length = (def) => {
      let t = def;
      if (s[i] === '%') { i++; t = int() || def; } else { const v = int(); if (v) t = TPW / v; }
      let add = t;
      while (s[i] === '.') { add /= 2; t += add; i++; }
      return t;
    };
    while (i < s.length) {
      let c = s[i++];
      if (c <= ' ' || c === '|') continue;
      if (c === 'l') { len = length(len); continue; }
      if (c === 'q') { gate = Math.max(0, Math.min(8, int() || 0)); continue; }
      let accent = false;
      if (c === '!') { accent = true; c = s[i++]; }
      if (!/[RTFSNOACrabcdef]/.test(c)) { warns.push(`pattern: unexpected '${c}'`); continue; }
      let oc = 0;
      while (s[i] === "'" || s[i] === ',') { oc += s[i] === "'" ? 1 : -1; i++; }
      const L = length(len);
      toks.push({ k: c, oc, len: L, acc: accent, q: gate });
      total += L;
    }
    return { toks, len: total };
  }
  function placeBass(pc, lo, hi, prev) {
    const c = [];
    for (let m = lo; m <= Math.max(lo + 11, hi - 12); m++) if (((m % 12) + 12) % 12 === pc) c.push(m);
    const ref = prev == null ? lo + 5 : prev;
    c.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref) || a - b);
    return c[0];
  }
  function voiceChord(ch, n, lo, hi, prev) {
    let pcs = [];
    for (const v of ch.ivs) { const p = (ch.root + v) % 12; if (!pcs.includes(p)) pcs.push(p); }
    if (pcs.length > n) pcs = pcs.filter((p) => p !== ch.root);
    if (pcs.length > n) pcs = pcs.filter((p) => p !== (ch.root + 7) % 12);
    pcs = pcs.slice(0, n);
    // double root, fifth, third — only tones that fit in the range more than once
    const inRange = (p) => { let k = 0; for (let m = lo; m <= hi; m++) if (m % 12 === p) k++; return k; };
    const dbl = [ch.root, (ch.root + (ch.ivs[2] != null ? ch.ivs[2] : 7)) % 12, (ch.root + ch.ivs[1]) % 12];
    for (let k = 0; pcs.length < n && k < 9; k++) {
      const p = dbl[k % 3];
      if (inRange(p) > pcs.filter((x) => x === p).length) pcs.push(p);
    }
    const cands = pcs.map((p) => { const a = []; for (let m = lo; m <= hi; m++) if (m % 12 === p) a.push(m); return a; });
    const maxSpread = n <= 3 ? 12 : n === 4 ? 16 : 20;
    const mid = (lo + hi) / 2;
    let best = null, bestCost = Infinity;
    const cur = [];
    (function rec(k) {
      if (k === pcs.length) {
        const v = cur.slice().sort((a, b) => a - b);
        for (let j = 1; j < v.length; j++) if (v[j] === v[j - 1]) return;
        const spread = v[v.length - 1] - v[0];
        if (spread > maxSpread) return;
        const avg = v.reduce((a, b) => a + b, 0) / v.length;
        let cost = spread * 0.05 + Math.abs(avg - mid) * 0.15;
        if (prev && prev.length === v.length) for (let j = 0; j < v.length; j++) cost += Math.abs(v[j] - prev[j]);
        else cost += Math.abs(avg - mid) * v.length;
        if (cost < bestCost) { bestCost = cost; best = v; }
        return;
      }
      for (const m of cands[k]) { cur.push(m); rec(k + 1); cur.pop(); }
    })(0);
    return best || [...new Set(pcs.map((p) => lo + ((p - lo % 12 + 12) % 12)))].sort((a, b) => a - b);
  }
  function above(base, pc) { return base + (((pc - base) % 12 + 12) % 12 || 12); }
  function resolveTok(tk, st, next, scale) {
    const ch = st.chord, b = st.bass, sh = tk.oc * 12;
    const iv = (k) => (ch.root + (ch.ivs[k] != null ? ch.ivs[k] : ch.ivs[ch.ivs.length - 1])) % 12;
    switch (tk.k) {
      case 'R': return [b + sh];
      case 'O': return [b + 12 + sh];
      case 'T': return [above(b, iv(1)) + sh];
      case 'F': return [above(b, iv(2)) + sh];
      case 'S': return [ch.ivs.length > 3 ? above(b, iv(3)) + sh : b + 12 + sh];
      case 'N': return [above(b, (ch.root + 2) % 12) + sh];
      case 'A': { // diatonic neighbour leading into the next bass note
        if (!next) return [above(b, iv(2)) + sh];
        const nb = next.bass, P = (x) => ((x % 12) + 12) % 12;
        const ok = (x) => scale.includes(P(x)) && P(x) !== P(b) && !ch.pcs.some((c) => { const d = Math.abs(P(x) - c); return d === 1 || d === 11; });
        let x = nb - 1;
        while (!scale.includes(P(x)) && x > nb - 3) x--;
        if (!ok(x)) { x = nb + 1; while (!scale.includes(P(x)) && x < nb + 3) x++; }
        if (!ok(x)) x = above(b, iv(1)); // fall back to the chord's third
        return [x + sh];
      }
      case 'C': return st.vo.map((m) => m + sh);
      default: {
        const k = 'abcdef'.indexOf(tk.k), v = st.vo;
        return [v[k % v.length] + 12 * Math.floor(k / v.length) + sh];
      }
    }
  }
  function genChannel(prog, c, warns, scale) {
    const range = c.range || [48, 72];
    const lo = range[0], hi = range[1];
    const n = c.voices || 3, q = c.q || 8, vel = c.v || 12;
    const spans = prog.spans;
    const st = [];
    let pb = null, pv = null;
    for (const sp of spans) {
      if (!sp.chord) { st.push(null); continue; }
      const bass = placeBass(sp.chord.bass, lo, hi, pb);
      const vo = voiceChord(sp.chord, n, lo, hi, pv);
      pb = bass; pv = vo;
      st.push({ bass, vo, chord: sp.chord });
    }
    const pats = {};
    for (const k in c.pats || {}) pats[k] = parsePat(c.pats[k], warns);
    let cur = c.pat != null ? parsePat(c.pat, warns) : null;
    const segs = [];
    let seg = { start: 0, pat: cur };
    for (const sp of spans) {
      if (sp.sec == null) continue;
      if (sp.sec in pats) cur = pats[sp.sec];
      if (sp.tick === seg.start) { seg.pat = cur; continue; }
      seg.end = sp.tick; segs.push(seg);
      seg = { start: sp.tick, pat: cur };
    }
    seg.end = prog.end; segs.push(seg);
    const events = [];
    for (const sg of segs) {
      const P = sg.pat;
      if (!P || !P.len) continue;
      let t = sg.start, k = 0, si = 0;
      while (t < sg.end) {
        const tk = P.toks[k++ % P.toks.length];
        const tEnd = Math.min(t + tk.len, sg.end);
        if (tk.k !== 'r') {
          while (si < spans.length && spans[si].tick + spans[si].len <= t) si++;
          for (let j = si; j < spans.length && spans[j].tick < tEnd; j++) {
            const sp = spans[j];
            const a = Math.max(t, sp.tick), b = Math.min(tEnd, sp.tick + sp.len);
            if (b <= a || !st[j]) continue;
            if (a !== t && (tk.len < 24 || b - a < 12)) continue;
            let nx = null;
            for (let h = j + 1; h < st.length && !nx; h++) nx = st[h];
            events.push({ tick: a, len: b - a, gate: (b - a) * (tk.q || q) / 8, notes: resolveTok(tk, st[j], nx, scale), vel: vel + (tk.acc ? 3 : 0), inst: c.inst, drum: false });
          }
        }
        t += tk.len;
      }
    }
    return { events, tempos: [], loop: prog.loop, end: prog.end };
  }

  // harmony voice: a chord tone 3-9 semitones under each note of another channel
  // (channel options: harm: srcIndex, below:[3,9], oct, min, minLen)
  function keyScale(key) {
    const m = /^([A-G])([#b]?)(m?)$/.exec(key || 'C') || ['', 'C', '', ''];
    const root = pcOf(m[1], m[2]);
    return (m[3] ? [0, 2, 3, 5, 7, 8, 10, 11] : [0, 2, 4, 5, 7, 9, 11]).map((v) => (root + v) % 12);
  }
  function harmonize(src, c, prog, scale) {
    const [lo, hi] = c.below || [3, 9];
    const shift = (c.oct || 0) * 12, minLen = c.minLen || 24;
    const spans = prog ? prog.spans : [];
    const pc = (x) => ((x % 12) + 12) % 12;
    let si = 0;
    const events = [];
    for (const e of src.events) {
      if (e.drum) continue;
      while (si > 0 && spans[si].tick > e.tick) si--;
      while (si < spans.length - 1 && spans[si].tick + spans[si].len <= e.tick) si++;
      const ch = spans[si] && spans[si].chord;
      const m = Math.max.apply(null, e.notes);
      const clash = (x) => ch && ch.pcs.some((q) => { const d = Math.abs(pc(x) - q); return d === 1 || d === 11; });
      let p = null;
      // long notes: nearest chord tone 3..9 below; short notes: a chord tone a 3rd/4th below,
      // else a scale 3rd that does not rub against the chord; otherwise leave the note alone
      const deep = e.len >= minLen ? hi : 5;
      if (ch) for (let x = m - lo; x >= m - deep && p == null; x--) if (ch.pcs.includes(pc(x))) p = x;
      if (p == null) for (let x = m - 3; x >= m - 4 && p == null; x--) if (scale.includes(pc(x)) && !clash(x)) p = x;
      if (p == null) continue;
      p += shift;
      while (c.min && p < c.min) p += 12;
      events.push({ tick: e.tick, len: e.len, gate: e.gate, notes: [p], vel: c.v || e.vel, inst: c.inst, drum: false });
    }
    return { events, tempos: [], loop: src.loop, end: src.end };
  }

  // ============================================================ compile a track
  const cache = {};
  function compile(id) {
    const d = DB.music[id] || DB.music[standIn(FALLBACK.bgm, DB.music, id) || standIn(FALLBACK.jingles, DB.music, id)];
    if (!d) return null;
    if (cache[id] && cache[id].src === d) return cache[id];
    const warns = [];
    const bar = meterTicks(d.meter);
    const defs = Object.assign({}, MOTIFS, d.defs || {});
    const prog = d.chords ? parseProg(d.chords, bar, defs, warns) : null;
    const scale = keyScale(d.key);
    const parts = d.ch.map((c, ci) => {
      const name = `${id}#${ci}`;
      if (c.mml != null) return parseMML(c.mml, { defs, drum: c.inst === 'drums', bar, inst: c.inst, q: c.q, warns, name });
      if (prog && (c.pat != null || c.pats)) return genChannel(prog, c, warns, scale);
      if (c.harm != null) return null;
      warns.push(`${name}: no mml/pattern`);
      return { events: [], tempos: [], loop: null, end: 0 };
    });
    d.ch.forEach((c, ci) => {
      if (c.harm == null) return;
      const src = parts[c.harm];
      parts[ci] = src ? harmonize(src, c, prog, scale) : { events: [], tempos: [], loop: null, end: 0 };
    });
    const isJingle = !!d.jingle;
    let endTick = prog && !isJingle ? prog.end : 0;
    for (const p of parts) endTick = Math.max(endTick, p.end);
    if (isJingle) { // a fanfare ends with its written parts; arranged parts are cut there
      const mml = parts.filter((p, ci) => d.ch[ci].mml != null);
      if (mml.length) endTick = Math.max.apply(null, mml.map((p) => p.end));
      for (const p of parts) {
        p.events = p.events.filter((e) => e.tick < endTick);
        for (const e of p.events) if (e.tick + e.len > endTick) { e.len = endTick - e.tick; e.gate = Math.min(e.gate, e.len); }
        p.end = endTick;
      }
    }
    let loopTick = prog ? prog.loop : null;
    if (loopTick == null) for (const p of parts) if (p.loop != null) { loopTick = p.loop; break; }
    parts.forEach((p, ci) => {
      if (p.end !== endTick) warns.push(`${id}#${ci}: length ${p.end} ≠ ${endTick} ticks (${(p.end - endTick) / bar} bars)`);
      if (!isJingle && d.ch[ci].mml != null && p.loop !== loopTick && !(p.loop == null && d.loop === false)) warns.push(`${id}#${ci}: loop point ${p.loop} ≠ ${loopTick}`);
    });
    // tempo map
    const tm = [{ tick: 0, bpm: d.tempo || 120 }];
    for (const p of parts) for (const t of p.tempos) tm.push(t);
    tm.sort((a, b) => a.tick - b.tick);
    const segs = [];
    for (const t of tm) {
      if (segs.length && segs[segs.length - 1].tick === t.tick) segs[segs.length - 1].bpm = t.bpm;
      else segs.push({ tick: t.tick, bpm: t.bpm });
    }
    let acc = 0;
    segs.forEach((s, k) => {
      if (k) acc += (s.tick - segs[k - 1].tick) * 60 / (segs[k - 1].bpm * 48);
      s.sec = acc;
    });
    const sec = (tick) => {
      let s = segs[0];
      for (let k = 1; k < segs.length && segs[k].tick <= tick; k++) s = segs[k];
      return s.sec + (tick - s.tick) * 60 / (s.bpm * 48);
    };
    // light metric accent so grooves breathe: downbeat > beat > off-beat 8th > 16th
    const beat = /\/8$/.test(d.meter || '') ? 72 : 48;
    const accent = (tick) => (tick % bar === 0 ? 1.08 : tick % beat === 0 ? 1 : tick % (beat / 2) === 0 ? 0.92 : 0.86);
    const events = [];
    parts.forEach((p, ci) => {
      for (const e of p.events) {
        const time = sec(e.tick);
        events.push({ time, dur: Math.max(0.01, sec(e.tick + e.gate) - time), tick: e.tick, len: e.len, notes: e.notes, vel: e.vel * accent(e.tick), inst: e.inst, drum: e.drum, ch: ci });
      }
    });
    events.sort((a, b) => a.time - b.time || a.ch - b.ch);
    const endSec = sec(endTick);
    const loop = !isJingle && d.loop !== false && loopTick != null && loopTick < endTick;
    const loopSec = loopTick != null ? sec(loopTick) : 0;
    const out = {
      id, src: d, events, endSec, loop, loopSec: loop ? loopSec : 0, loopIdx: lowerBound(events, loop ? loopSec : 0),
      endTick, loopTick, bar, prog, sec,
      channels: d.ch.map((c) => ({ inst: c.inst, vol: c.vol != null ? c.vol : 1, pan: c.pan || 0, echo: c.echo || 0 })),
      echo: d.echo || null, gain: d.gain != null ? d.gain : 1, warns,
    };
    cache[id] = out;
    return out;
  }
  function lowerBound(ev, t) {
    let a = 0, b = ev.length;
    while (a < b) { const m = (a + b) >> 1; if (ev[m].time < t - 1e-6) a = m + 1; else b = m; }
    return a;
  }

  // ============================================================ instruments
  // env [attack, decay, sustain 0..1, release] (s); lp {f, q, env:[peakHz, a, d]};
  // vib [rate Hz, depth cents, delay s]; fm [ratio, index, decay s]; osc {w, det, mul, vol, dec}
  const INST = {
    // leads
    square: { osc: [{ w: 'p50' }], env: [0.004, 0.2, 0.75, 0.05], vol: 0.167, vib: [5.5, 8, 0.25] },
    pulse: { osc: [{ w: 'p25' }], env: [0.004, 0.2, 0.75, 0.06], vol: 0.276, vib: [5.5, 10, 0.22] },
    thin: { osc: [{ w: 'p12' }], env: [0.004, 0.2, 0.7, 0.06], vol: 0.444, vib: [5.5, 10, 0.22] },
    flute: { osc: [{ w: 'flute' }], env: [0.04, 0.25, 0.85, 0.1], vol: 0.214, vib: [5, 14, 0.18] },
    oboe: { osc: [{ w: 'p12' }], lp: { f: 2200, q: 2.2 }, env: [0.02, 0.25, 0.8, 0.08], vol: 0.363, vib: [5.5, 12, 0.18] },
    clarinet: { osc: [{ w: 'clar' }], lp: { f: 2600, q: 0.8 }, env: [0.03, 0.25, 0.85, 0.08], vol: 0.207, vib: [5, 9, 0.25] },
    brass: { osc: [{ w: 'sawtooth' }, { w: 'sawtooth', det: 9 }], lp: { f: 900, q: 1.2, env: [3400, 0.06, 0.35] }, env: [0.025, 0.3, 0.8, 0.09], vol: 0.2, vib: [5, 9, 0.3] },
    trumpet: { osc: [{ w: 'sawtooth' }, { w: 'p25', det: -6, vol: 0.5 }], lp: { f: 1400, q: 1.6, env: [4600, 0.04, 0.3] }, env: [0.018, 0.25, 0.8, 0.08], vol: 0.21, vib: [5.5, 10, 0.25] },
    horn: { osc: [{ w: 'sawtooth' }, { w: 'triangle', det: -5 }], lp: { f: 650, q: 0.8, env: [1500, 0.08, 0.4] }, env: [0.05, 0.3, 0.85, 0.15], vol: 0.18, vib: [4.5, 7, 0.35] },
    strings: { osc: [{ w: 'sawtooth', det: -8 }, { w: 'sawtooth', det: 8 }], lp: { f: 2500, q: 0.6 }, env: [0.1, 0.4, 0.85, 0.3], vol: 0.138, vib: [5, 7, 0.35] },
    violin: { osc: [{ w: 'sawtooth' }, { w: 'sawtooth', det: 5, vol: 0.6 }], lp: { f: 3200, q: 1 }, env: [0.06, 0.3, 0.85, 0.2], vol: 0.229, vib: [5.5, 16, 0.2] },
    pad: { osc: [{ w: 'sawtooth', det: -12 }, { w: 'sawtooth', det: 12 }], lp: { f: 1100, q: 0.5 }, env: [0.3, 0.5, 0.9, 0.6], vol: 0.14, vib: [4, 5, 0.5] },
    choir: { osc: [{ w: 'choir' }, { w: 'choir', det: 11 }], lp: { f: 2000, q: 1 }, env: [0.18, 0.4, 0.9, 0.5], vol: 0.146, vib: [4.5, 12, 0.3] },
    organ: { osc: [{ w: 'organ' }, { w: 'organ', det: 4, vol: 0.5 }], env: [0.012, 0.1, 0.9, 0.1], vol: 0.16 },
    // plucked / struck
    harp: { osc: [{ w: 'harp' }], lp: { f: 1800, q: 0.7, env: [5200, 0.002, 0.35] }, env: [0.002, 1.3, 0, 0.9], vol: 0.29 },
    pizz: { osc: [{ w: 'sawtooth' }, { w: 'triangle', vol: 0.8 }], lp: { f: 1200, q: 1, env: [3000, 0.004, 0.1] }, env: [0.002, 0.24, 0, 0.12], vol: 0.43 },
    harpsi: { osc: [{ w: 'p25' }, { w: 'p12', mul: 2, vol: 0.35 }], lp: { f: 5000, q: 0.5 }, env: [0.001, 0.7, 0, 0.1], vol: 0.38 },
    guitar: { osc: [{ w: 'sawtooth' }], lp: { f: 800, q: 1, env: [4200, 0.003, 0.25] }, env: [0.002, 1.1, 0, 0.25], vol: 0.4 },
    bell: { fm: [3.5, 4, 0.7], env: [0.002, 2.2, 0, 1.2], vol: 0.2 },
    celesta: { fm: [4, 1.6, 0.25], env: [0.002, 1.1, 0, 0.6], vol: 0.25 },
    marimba: { osc: [{ w: 'sine' }, { w: 'sine', mul: 4, vol: 0.4, dec: 0.05 }], env: [0.002, 0.55, 0, 0.18], vol: 0.37 },
    glock: { osc: [{ w: 'sine' }, { w: 'sine', mul: 2.76, vol: 0.35, dec: 0.3 }, { w: 'sine', mul: 5.4, vol: 0.2, dec: 0.1 }], env: [0.001, 1.5, 0, 0.8], vol: 0.22 },
    // music box (オルゴール): a comb tine — pure fundamental with a slow beat, a quick
    // metallic partial; warpbox = the same box wound down (slow pitch wobble)
    musicbox: { osc: [{ w: 'sine' }, { w: 'sine', det: 6, vol: 0.55 }, { w: 'sine', mul: 3, vol: 0.28, dec: 0.1 }, { w: 'sine', mul: 5.8, vol: 0.1, dec: 0.035 }], env: [0.001, 1.3, 0, 0.55], vol: 0.2 },
    warpbox: { osc: [{ w: 'sine' }, { w: 'sine', det: -9, vol: 0.6 }, { w: 'sine', mul: 3, vol: 0.25, dec: 0.12 }], env: [0.001, 1.5, 0, 0.6], vol: 0.21, vib: [2.6, 28, 0] },
    // swell: a pad that fades in over the whole note and stops dead (tape played backwards)
    swell: { osc: [{ w: 'sawtooth', det: -7 }, { w: 'triangle', det: 7, vol: 0.9 }], lp: { f: 1500, q: 0.6 }, env: [0.85, 0.1, 1, 0.03], vol: 0.13 },
    // bass
    bass: { osc: [{ w: 'bass' }], lp: { f: 800, q: 1.4, env: [2400, 0.004, 0.14] }, env: [0.004, 0.4, 0.6, 0.06], vol: 0.24 },
    tri: { osc: [{ w: 'triangle' }], env: [0.004, 0.2, 0.85, 0.05], vol: 0.2 },
    synbass: { osc: [{ w: 'sawtooth' }, { w: 'p50', mul: 0.5, vol: 0.45 }], lp: { f: 480, q: 4, env: [2600, 0.004, 0.15] }, env: [0.003, 0.25, 0.7, 0.05], vol: 0.2 },
    contra: { osc: [{ w: 'sawtooth', det: -6 }, { w: 'sawtooth', det: 6 }], lp: { f: 520, q: 0.8 }, env: [0.06, 0.3, 0.85, 0.2], vol: 0.13 },
    timp: { osc: [{ w: 'sine' }, { w: 'triangle', mul: 1.505, vol: 0.3, dec: 0.25 }], pitch: [0.7, 0.07], env: [0.002, 1.1, 0, 0.7], vol: 0.4, thump: 0.18 },
  };

  const WAVES = {
    flute: [0, 1, 0.3, 0.12, 0.05, 0.02],
    organ: [0, 1, 0.75, 0.5, 0.35, 0, 0.25, 0, 0.18],
    harp: [0, 1, 0.45, 0.25, 0.13, 0.08, 0.04, 0.02],
    bass: [0, 1, 0.6, 0.35, 0.2, 0.12, 0.08, 0.05, 0.03],
    choir: [0, 0.7, 1, 0.55, 0.6, 0.35, 0.2, 0.12, 0.08, 0.05],
    clar: [0, 1, 0, 0.55, 0, 0.35, 0, 0.2, 0, 0.1, 0, 0.05],
  };
  const PULSE = { p50: 0.5, p25: 0.25, p12: 0.125 };

  // ============================================================ mixer (one per AudioContext)
  function makeEcho(ctx, out, e) {
    const inp = ctx.createGain();
    const pre = ctx.createBiquadFilter(); pre.type = 'lowpass'; pre.frequency.value = e.lp || 3000;
    const dl = ctx.createDelay(2), dr = ctx.createDelay(2);
    dl.delayTime.value = dr.delayTime.value = e.time || 0.25;
    const fl = ctx.createGain(), fr = ctx.createGain();
    fl.gain.value = fr.gain.value = e.fb != null ? e.fb : 0.35;
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = (e.lp || 3000) * 0.85;
    const merger = ctx.createChannelMerger(2);
    const wet = ctx.createGain(); wet.gain.value = e.wet != null ? e.wet : 0.3;
    inp.connect(pre); pre.connect(dl);
    dl.connect(merger, 0, 0); dr.connect(merger, 0, 1);
    dl.connect(fl); fl.connect(damp); damp.connect(dr); dr.connect(fr); fr.connect(dl);
    merger.connect(wet); wet.connect(out);
    return { input: inp, nodes: [inp, pre, dl, dr, fl, fr, damp, merger, wet] };
  }
  function kRate(p) { try { if ('automationRate' in p) p.automationRate = 'k-rate'; } catch (e) { /* ignore */ } }
  function holdParam(p, t) {
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
    else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
  }

  class Mixer {
    constructor(ctx, dest, opts) {
      opts = opts || {};
      this.ctx = ctx;
      this.live = !!opts.live;
      this.waves = {};
      this._noise = null;
      this.master = ctx.createGain();
      if (opts.limiter !== false && ctx.createDynamicsCompressor) {
        const L = (this.limiter = ctx.createDynamicsCompressor());
        L.threshold.value = -4; L.knee.value = 4; L.ratio.value = 12; L.attack.value = 0.002; L.release.value = 0.15;
        this.master.connect(L); L.connect(dest);
      } else this.master.connect(dest);
      this.music = ctx.createGain();
      this.duckG = ctx.createGain(); // R.Audio.duck(): short dips under a showcase SFX
      this.voiceDuck = ctx.createGain(); // held lower while a voice line plays (R.Audio.playVoice)
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass'; warm.frequency.value = 11500; warm.Q.value = 0.5;
      this.music.connect(this.duckG); this.duckG.connect(this.voiceDuck); this.voiceDuck.connect(warm); warm.connect(this.master);
      this.voiceBus = ctx.createGain(); // voice lines: own volume, not ducked, not echoed
      this.voiceBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.sfxEcho = makeEcho(ctx, this.sfxBus, { time: 0.09, fb: 0.3, wet: 0.5, lp: 4500 });
    }
    /** dip the music by `db` (negative) for `hold` s from `t`, recovering over 0.25 s */
    duck(db, hold, t) {
      const g = this.duckG.gain, now = this.ctx.currentTime, at = Math.max(now, t != null ? t : now);
      const lv = Math.pow(10, Math.min(0, db) / 20);
      holdParam(g, at);
      g.linearRampToValueAtTime(lv, at + 0.03);
      g.setValueAtTime(lv, at + 0.03 + Math.max(0, hold));
      g.linearRampToValueAtTime(1, at + 0.03 + Math.max(0, hold) + 0.25);
    }
    setWave(osc, w) {
      if (w === 'sine' || w === 'square' || w === 'sawtooth' || w === 'triangle') { osc.type = w; return; }
      let pw = this.waves[w];
      if (!pw) {
        const N = 48;
        const re = new Float32Array(N), im = new Float32Array(N);
        if (PULSE[w]) { const d = PULSE[w]; for (let k = 1; k < N; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d); }
        else if (WAVES[w]) WAVES[w].forEach((v, k) => { if (k < N) im[k] = v; });
        else { osc.type = 'square'; return; }
        pw = this.waves[w] = this.ctx.createPeriodicWave(re, im);
      }
      osc.setPeriodicWave(pw);
    }
    noiseBuf() {
      if (!this._noise) {
        const c = this.ctx, n = Math.floor(c.sampleRate * 1.5);
        const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
        let s = 0x2545f491;
        for (let i = 0; i < n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
        this._noise = b;
      }
      return this._noise;
    }
    // envelope for one-shot sounds: attack a, hold d (or exponential decay), release r
    shape(p, t, o, vol) {
      const a = o.a != null ? o.a : 0.002, d = o.d != null ? o.d : 0.1, r = o.r != null ? o.r : 0.04;
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(vol, t + a);
      let end = t + Math.max(a, d);
      if (o.decay) {
        const lv = Math.max(0.0001, vol * (typeof o.decay === 'number' ? o.decay : 0.001));
        p.exponentialRampToValueAtTime(lv, end);
        if (lv > 0.0002) { p.exponentialRampToValueAtTime(0.0001, end + r); end += r; }
      } else {
        p.setValueAtTime(vol, end);
        p.exponentialRampToValueAtTime(0.0001, end + r);
        end += r;
      }
      return end;
    }
    filters(o, t, out) {
      let node = out;
      for (const [k, type] of [['lp', 'lowpass'], ['hp', 'highpass'], ['bp', 'bandpass']]) {
        if (!o[k]) continue;
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.Q.value = o.q != null ? o.q : type === 'bandpass' ? 1 : 0.7;
        f.frequency.setValueAtTime(o[k], t);
        if (o[k + '2']) f.frequency.exponentialRampToValueAtTime(o[k + '2'], t + (o.fd || o.d || 0.1));
        f.connect(node);
        node = f;
      }
      return node;
    }
    vibrato(o, t, end, oscs) {
      if (!o.vib) return;
      const c = this.ctx, lfo = c.createOscillator(), g = c.createGain();
      lfo.frequency.value = o.vib[0];
      g.gain.value = o.vib[1];
      lfo.connect(g);
      for (const x of oscs) g.connect(x.detune);
      lfo.start(t); lfo.stop(end);
    }
    /** one-shot oscillator: {t,w,f|n,f2|n2,sd,lin,d,a,r,vol,decay,det,vib,lp/hp/bp(+2),q,fd} */
    tone(dest, o, t0) {
      const c = this.ctx, t = t0 + (o.t || 0);
      const f = o.f || mtof(o.n != null ? o.n : 69);
      const f2 = o.f2 || (o.n2 != null ? mtof(o.n2) : 0);
      const osc = c.createOscillator();
      this.setWave(osc, o.w || 'p50');
      osc.frequency.setValueAtTime(f, t);
      if (f2) {
        const te = t + (o.sd != null ? o.sd : o.d != null ? o.d : 0.1);
        if (o.lin) osc.frequency.linearRampToValueAtTime(f2, te);
        else osc.frequency.exponentialRampToValueAtTime(f2, te);
      }
      if (o.det) osc.detune.value = o.det;
      const g = c.createGain();
      const end = this.shape(g.gain, t, o, o.vol != null ? o.vol : 0.3);
      g.connect(dest);
      osc.connect(this.filters(o, t, g));
      this.vibrato(o, t, end, [osc]);
      osc.start(t); osc.stop(end + 0.01);
      osc.onended = () => g.disconnect();
      return end;
    }
    /** filtered noise burst: same envelope/filter options as tone, plus rate (darker when < 1) */
    noise(dest, o, t0) {
      const c = this.ctx, t = t0 + (o.t || 0);
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf();
      src.loop = true;
      if (o.rate) src.playbackRate.setValueAtTime(o.rate, t);
      if (o.rate2) src.playbackRate.exponentialRampToValueAtTime(o.rate2, t + (o.fd || o.d || 0.1));
      const g = c.createGain();
      const end = this.shape(g.gain, t, o, o.vol != null ? o.vol : 0.3);
      g.connect(dest);
      src.connect(this.filters(o, t, g));
      src.start(t, Math.random() * 1.2);
      src.stop(end + 0.01);
      src.onended = () => g.disconnect();
      return end;
    }
    /** 2-operator FM tone (bells, chimes): {n|f, n2, ratio, index, md (mod decay), d, a, r, vol, decay} */
    fm(dest, o, t0) {
      const c = this.ctx, t = t0 + (o.t || 0);
      const f = o.f || mtof(o.n != null ? o.n : 69);
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.setValueAtTime(f, t);
      const f2 = o.f2 || (o.n2 != null ? mtof(o.n2) : 0);
      if (f2) car.frequency.exponentialRampToValueAtTime(f2, t + (o.sd || o.d || 0.1));
      const ratio = o.ratio || 2;
      mod.frequency.value = f * ratio;
      const dev = (o.index != null ? o.index : 2) * f * ratio;
      mg.gain.setValueAtTime(dev, t);
      mg.gain.exponentialRampToValueAtTime(Math.max(0.5, dev * 0.03), t + (o.md || 0.3));
      const end = this.shape(g.gain, t, o, o.vol != null ? o.vol : 0.3);
      mod.connect(mg); mg.connect(car.frequency);
      car.connect(this.filters(o, t, g)); g.connect(dest);
      car.start(t); mod.start(t); car.stop(end + 0.01); mod.stop(end + 0.01);
      car.onended = () => g.disconnect();
      return end;
    }
    /** one sequenced note of an instrument */
    voice(inst, dest, midi, t, dur, vel) {
      const c = this.ctx, f = mtof(midi), e = inst.env;
      const g = c.createGain();
      const P = g.gain, peak = inst.vol * vel;
      const a = e[0], d = e[1], s = e[2];
      const end = t + Math.max(0.005, dur);
      let v;
      P.setValueAtTime(0, t);
      if (end <= t + a) { v = peak * (end - t) / a; P.linearRampToValueAtTime(v, end); }
      else {
        P.linearRampToValueAtTime(peak, t + a);
        if (s >= 1 || d <= 0) { v = peak * Math.min(1, s); P.setValueAtTime(v, end); }
        else {
          const tau = d / 3;
          P.setTargetAtTime(peak * s, t + a, tau);
          v = peak * s + peak * (1 - s) * Math.exp(-(end - t - a) / tau);
          P.setValueAtTime(v, end);
        }
      }
      const stop = end + Math.max(0.02, e[3]);
      if (v > 0.0002) P.exponentialRampToValueAtTime(0.0001, stop); else P.linearRampToValueAtTime(0, stop);
      g.connect(dest);
      let head = g;
      if (inst.lp) {
        const L = inst.lp, flt = c.createBiquadFilter();
        flt.type = 'lowpass'; flt.Q.value = L.q || 0.7;
        const base = Math.min(16000, L.f * (L.track ? f / 262 : 1));
        if (L.env) {
          flt.frequency.setValueAtTime(base, t);
          flt.frequency.exponentialRampToValueAtTime(L.env[0], t + L.env[1]);
          flt.frequency.setTargetAtTime(base, t + L.env[1], L.env[2] / 3);
        } else flt.frequency.value = base;
        flt.connect(g);
        head = flt;
      }
      const oscs = [];
      if (inst.fm) {
        const [ratio, index, md] = inst.fm;
        const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
        car.frequency.value = f; mod.frequency.value = f * ratio;
        const dev = index * f * ratio;
        mg.gain.setValueAtTime(dev, t);
        mg.gain.exponentialRampToValueAtTime(Math.max(0.5, dev * 0.04), t + md);
        mod.connect(mg); mg.connect(car.frequency); car.connect(head);
        mod.start(t); mod.stop(stop);
        oscs.push(car);
      } else {
        for (const o of inst.osc) {
          const osc = c.createOscillator();
          this.setWave(osc, o.w);
          const fo = f * (o.mul || 1);
          if (inst.pitch) {
            osc.frequency.setValueAtTime(fo * Math.pow(2, inst.pitch[0] / 12), t);
            osc.frequency.exponentialRampToValueAtTime(fo, t + inst.pitch[1]);
          } else osc.frequency.value = fo;
          if (o.det) osc.detune.value = o.det;
          let dst = head;
          if (o.dec || (o.vol != null && o.vol !== 1)) {
            const og = c.createGain(), ov = o.vol != null ? o.vol : 1;
            if (o.dec) { og.gain.setValueAtTime(ov, t); og.gain.setTargetAtTime(0, t, o.dec / 3); } else og.gain.value = ov;
            og.connect(head); dst = og;
          }
          osc.connect(dst);
          oscs.push(osc);
        }
      }
      if (inst.vib && dur > inst.vib[2] + 0.12) {
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = inst.vib[0];
        lg.gain.setValueAtTime(0, t);
        lg.gain.setValueAtTime(0, t + inst.vib[2]);
        lg.gain.linearRampToValueAtTime(inst.vib[1], t + inst.vib[2] + 0.3);
        lfo.connect(lg);
        for (const o of oscs) lg.connect(o.detune);
        lfo.start(t); lfo.stop(stop);
      }
      if (inst.thump) this.noise(dest, { d: 0.005, r: 0.05, vol: inst.thump * vel, lp: 700 }, t);
      for (const o of oscs) { o.start(t); o.stop(stop + 0.01); }
      oscs[0].onended = () => g.disconnect();
      return stop;
    }
  }

  // drum kit: (mixer, dest, time, velocity) → schedules the hit
  const DRUMS = {
    k(m, d, t, v) { m.tone(d, { w: 'sine', f: 150, f2: 44, sd: 0.11, d: 0.03, r: 0.26, vol: 0.66 * v }, t); m.noise(d, { d: 0.003, r: 0.012, vol: 0.15 * v, lp: 2800 }, t); },
    s(m, d, t, v) { m.noise(d, { d: 0.01, r: 0.15, vol: 0.26 * v, hp: 1100, lp: 8500 }, t); m.tone(d, { w: 'triangle', f: 205, f2: 150, sd: 0.05, d: 0.02, r: 0.07, vol: 0.33 * v }, t); },
    h(m, d, t, v) { m.noise(d, { d: 0.004, r: 0.04, vol: 0.13 * v, hp: 7500 }, t); },
    o(m, d, t, v) { m.noise(d, { d: 0.05, r: 0.24, vol: 0.12 * v, hp: 6500 }, t); },
    c(m, d, t, v) { m.noise(d, { d: 0.03, r: 1.4, vol: 0.2 * v, hp: 3200 }, t); m.noise(d, { d: 0.02, r: 0.5, vol: 0.12 * v, bp: 7500, q: 0.8 }, t); },
    t(m, d, t, v) { m.tone(d, { w: 'sine', f: 230, f2: 175, sd: 0.2, d: 0.02, r: 0.3, vol: 0.48 * v }, t); m.noise(d, { d: 0.004, r: 0.03, vol: 0.15 * v, lp: 1800 }, t); },
    m(m, d, t, v) { m.tone(d, { w: 'sine', f: 170, f2: 128, sd: 0.2, d: 0.02, r: 0.34, vol: 0.5 * v }, t); m.noise(d, { d: 0.004, r: 0.03, vol: 0.15 * v, lp: 1500 }, t); },
    f(m, d, t, v) { m.tone(d, { w: 'sine', f: 120, f2: 88, sd: 0.25, d: 0.02, r: 0.4, vol: 0.53 * v }, t); m.noise(d, { d: 0.004, r: 0.04, vol: 0.15 * v, lp: 1200 }, t); },
    x(m, d, t, v) { m.tone(d, { w: 'triangle', f: 1750, d: 0.003, r: 0.025, vol: 0.28 * v }, t); m.noise(d, { d: 0.003, r: 0.02, vol: 0.2 * v, bp: 2600, q: 2 }, t); },
    z(m, d, t, v) { m.noise(d, { a: 0.012, d: 0.015, r: 0.05, vol: 0.13 * v, bp: 6500, q: 1.2 }, t); },
    p(m, d, t, v) { for (let k = 0; k < 3; k++) m.noise(d, { t: k * 0.011, d: 0.003, r: 0.012, vol: 0.3 * v, bp: 1300, q: 1.4 }, t); m.noise(d, { t: 0.033, d: 0.004, r: 0.13, vol: 0.28 * v, bp: 1200, q: 1.2 }, t); },
    b(m, d, t, v) { m.tone(d, { w: 'sine', f: 78, f2: 46, sd: 0.3, d: 0.03, r: 0.9, vol: 0.7 * v }, t); m.noise(d, { d: 0.01, r: 0.35, vol: 0.28 * v, lp: 320 }, t); },
    g(m, d, t, v) { m.fm(d, { f: 88, ratio: 1.41, index: 3, md: 1.2, d: 0.05, r: 2.6, vol: 0.32 * v }, t); m.noise(d, { d: 0.05, r: 1.6, vol: 0.1 * v, bp: 900, q: 0.7 }, t); },
    w(m, d, t, v) { m.tone(d, { w: 'sine', f: 1150, f2: 1000, sd: 0.04, d: 0.004, r: 0.06, vol: 0.4 * v }, t); m.tone(d, { w: 'sine', f: 1900, d: 0.002, r: 0.025, vol: 0.15 * v }, t); },
    i(m, d, t, v) { m.tone(d, { w: 'sine', f: 4200, d: 0.004, r: 1.0, vol: 0.07 * v }, t); m.tone(d, { w: 'sine', f: 6150, d: 0.004, r: 0.6, vol: 0.04 * v }, t); },
  };

  // ============================================================ playback of one track
  class Playback {
    constructor(mx, song, o) {
      const c = mx.ctx;
      this.mx = mx; this.song = song; this.id = song.id; this.serial = ++Playback.count;
      this.loop = song.loop && o.loop !== false;
      this.passes = o.passes || Infinity;
      this.pass = 1;
      this.offset = 0;
      this.stopped = false;
      const at = o.at, pos = Math.max(0, Math.min(o.pos || 0, song.endSec));
      this.t0 = at - pos;
      // 速さの倍率（setTempo。音の高さは変えない: 合成なので、音を置く時刻と長さだけを縮める）
      // 曲の時間 u（ループで巻き戻さない通しの秒）と context の時刻: ctx = aT + (u − aU) / rate
      this.rate = o.rate > 0 ? +o.rate : 1;
      this.aT = at; this.aU = pos; this.until = at;
      this.out = c.createGain();
      const G = this.out.gain;
      G.value = o.fadeIn ? 0 : song.gain; // also the value if stopped before `at`
      if (o.fadeIn) { G.setValueAtTime(0, at); G.linearRampToValueAtTime(song.gain, at + o.fadeIn); }
      else G.setValueAtTime(song.gain, at);
      this.out.connect(o.dest);
      this.echo = song.echo ? makeEcho(c, this.out, song.echo) : null;
      this.nodes = [this.out];
      this.chans = song.channels.map((ch) => {
        const g = c.createGain();
        g.gain.value = ch.vol;
        this.nodes.push(g);
        if (ch.pan && c.createStereoPanner) {
          const p = c.createStereoPanner();
          p.pan.value = ch.pan;
          g.connect(p); p.connect(this.out);
          this.nodes.push(p);
        } else g.connect(this.out);
        if (this.echo && ch.echo) {
          const s = c.createGain();
          s.gain.value = ch.echo;
          g.connect(s); s.connect(this.echo.input);
          this.nodes.push(s);
        }
        return g;
      });
      this.idx = lowerBound(song.events, pos);
      if (pos > 0.05) this.catchUp(pos, at);
    }
    /** re-sound notes that were still held at the resume position */
    catchUp(pos, at) {
      const ev = this.song.events;
      for (let k = 0; k < this.idx; k++) {
        const e = ev[k];
        const left = (e.time + e.dur - pos) / this.rate;
        if (e.drum || left < 0.15) continue;
        this.play(e, at, left);
      }
    }
    play(e, t, dur) {
      if (this.only && !this.only.includes(e.ch)) return;
      const dest = this.chans[e.ch], vel = e.vel / 12, mx = this.mx;
      if (e.drum) { for (const k of e.notes) if (DRUMS[k]) DRUMS[k](mx, dest, t, vel); return; }
      const inst = INST[e.inst] || INST.pulse;
      for (const m of e.notes) mx.voice(inst, dest, m, t, dur != null ? dur : e.dur / this.rate, vel);
    }
    /** 曲の通しの時間 u → context の時刻 */
    ctxAt(u) { return this.aT + (u - this.aU) / this.rate; }
    /** context の時刻 → 曲の通しの時間 u */
    songAt(now) { return this.aU + (now - this.aT) * this.rate; }
    /** 速さの倍率を変える（高さはそのまま）。もう置いた音（先読みの until まで）はそのまま、その先から新しい速さ */
    setRate(r, now) {
      r = r > 0 ? +r : 1;
      if (r === this.rate) return;
      const a = Math.max(now, this.until || now);
      this.aU = this.songAt(a); this.aT = a; this.rate = r;
    }
    schedule(until, now) {
      const S = this.song, ev = S.events;
      if (until > this.until) this.until = until;
      while (!this.stopped) {
        if (this.idx >= ev.length) {
          if (this.loop && this.pass < this.passes && S.endSec - S.loopSec > 0.1) {
            this.pass++;
            this.offset += S.endSec - S.loopSec;
            this.idx = S.loopIdx;
          } else { this.done = true; break; }
        }
        const e = ev[this.idx], t = this.ctxAt(this.offset + e.time);
        if (t >= until) break;
        this.idx++;
        if (t < now - 0.08) continue; // hopelessly late (tab stalled): skip
        this.play(e, Math.max(t, now));
      }
    }
    /** song-relative position (s) at context time `now` */
    position(now) {
      const S = this.song, raw = this.songAt(now);
      if (raw < 0) return 0;
      if (!this.loop || raw < S.endSec) return Math.min(raw, S.endSec);
      const L = S.endSec - S.loopSec;
      return L > 0.1 ? S.loopSec + ((raw - S.loopSec) % L) : S.endSec;
    }
    /** context time at which the (non-looping) song ends */
    get endTime() { return this.ctxAt(this.song.endSec); }
    stop(fade) {
      if (this.stopped) return;
      this.stopped = true;
      const now = this.mx.ctx.currentTime, G = this.out.gain;
      fade = Math.max(0.02, fade || 0);
      holdParam(G, now);
      G.linearRampToValueAtTime(0, now + fade);
      if (this.mx.live) setTimeout(() => this.dispose(), (fade + 0.4) * 1000);
    }
    dispose() {
      for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
      if (this.echo) for (const n of this.echo.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    }
  }

  Playback.count = 0;

  // ============================================================ recorded BGM (BRIEF A10)
  // assets/bgm/<id>.(ogg|mp3|m4a|wav) → tools/build.js lists it in window.RPG_MEDIA.bgm[id] =
  // {src, loopStart?, loopEnd?, gain?, loop?}. A FilePlayback has the Playback interface the
  // controller uses (id serial file position() endTime stop() schedule() dispose()), so push/pop,
  // jingles, fades, volume and ducking behave exactly as for a synthesised track.
  const FILE_GAIN = 0.7; // mastered files are far louder than the synth tracks (gain ≈ 0.8–1 on −18 LUFS)
  class FilePlayback {
    constructor(mx, id, buf, meta, o) {
      const c = mx.ctx;
      meta = meta || {};
      this.mx = mx; this.id = id; this.file = true; this.serial = ++Playback.count; this.stopped = false;
      const dur = buf.duration;
      let ls = Math.max(0, +meta.loopStart || 0), le = +meta.loopEnd || dur;
      if (!(le <= dur)) le = dur;
      if (!(le > ls + 0.1)) { ls = 0; le = dur; }
      this.dur = dur; this.loopStart = ls; this.loopEnd = le;
      this.loop = meta.loop !== false && o.loop !== false;
      let pos = Math.max(0, o.pos || 0);
      if (this.loop && pos >= le) pos = ls + ((pos - ls) % (le - ls));
      if (!this.loop) pos = Math.min(pos, dur);
      const at = o.at, gain = meta.gain != null ? +meta.gain : FILE_GAIN;
      this.t0 = at - pos;
      this.out = c.createGain();
      const G = this.out.gain;
      G.value = o.fadeIn ? 0 : gain;
      if (o.fadeIn) { G.setValueAtTime(0, at); G.linearRampToValueAtTime(gain, at + o.fadeIn); }
      else G.setValueAtTime(gain, at);
      this.out.connect(o.dest);
      const s = (this.src = c.createBufferSource());
      s.buffer = buf;
      s.loop = this.loop;
      if (this.loop) { s.loopStart = ls; s.loopEnd = le; }
      s.connect(this.out);
      s.start(at, pos);
      this.nodes = [s, this.out];
    }
    schedule() { /* the buffer source plays by itself */ }
    position(now) {
      const raw = now - this.t0;
      if (raw < 0) return 0;
      if (!this.loop) return Math.min(raw, this.dur);
      if (raw < this.loopEnd) return raw;
      return this.loopStart + ((raw - this.loopStart) % (this.loopEnd - this.loopStart));
    }
    get endTime() { return this.t0 + this.dur; }
    stop(fade) {
      if (this.stopped) return;
      this.stopped = true;
      const now = this.mx.ctx.currentTime, G = this.out.gain;
      fade = Math.max(0.02, fade || 0);
      holdParam(G, now);
      G.linearRampToValueAtTime(0, now + fade);
      try { this.src.stop(now + fade + 0.05); } catch (e) { /* not started yet */ }
      if (this.mx.live) setTimeout(() => this.dispose(), (fade + 0.4) * 1000);
    }
    dispose() { for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } }
  }

  // ============================================================ 録音の BGM を高さを保って速める（暴走など。setTempo）
  // AudioBufferSourceNode の playbackRate は高さも変わるので、<audio> の preservesPitch（ブラウザの時間の伸び縮み）で鳴らす。
  // 使えない所（preservesPitch が無い・埋め込みの束の一部）では作らない（canStretch）→ 速さは変えない。
  // ループは pump（25 ms ごと）が loopEnd を越えたら loopStart へ戻す。Playback と同じ口（id serial file position endTime stop schedule dispose setRate）
  function canStretch(id) {
    try {
      const e = mediaEntry('bgm', id);
      if (!e || typeof e.len === 'number' || !ctx || !ctx.createMediaElementSource || typeof Audio === 'undefined') return false;
      if (window.location && window.location.protocol === 'file:') return false;   // file:// は別の生まれ扱いで <audio> の音が 0 になることがある
      const P = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      return !!P && ('preservesPitch' in P || 'webkitPreservesPitch' in P || 'mozPreservesPitch' in P);
    } catch (e) { return false; }
  }
  class StretchPlayback {
    constructor(mx, id, meta, o) {
      const c = mx.ctx;
      meta = meta || {};
      this.mx = mx; this.id = id; this.file = true; this.stretch = true; this.serial = ++Playback.count; this.stopped = false;
      this.rate = o.rate > 0 ? +o.rate : 1;
      this.loop = meta.loop !== false && o.loop !== false;
      this.loopStart = Math.max(0, +meta.loopStart || 0); this.loopEnd = +meta.loopEnd || 0;
      this.pos0 = Math.max(0, o.pos || 0);
      const el = (this.el = new Audio());
      el.preload = 'auto';
      el.preservesPitch = true; el.webkitPreservesPitch = true; el.mozPreservesPitch = true;
      el.src = R.Media.url('bgm', id);
      this.gain = meta.gain != null ? +meta.gain : FILE_GAIN;
      this.out = c.createGain();
      this.out.gain.value = 0;
      this.out.connect(o.dest);
      this.node = c.createMediaElementSource(el);
      this.node.connect(this.out);
      this.nodes = [this.node, this.out];
      this.ready = new Promise((res) => {
        const go = () => {
          if (this.stopped) return res(false);
          const d = el.duration || 0;
          if (!(this.loopEnd > this.loopStart + 0.1) || this.loopEnd > d) { this.loopStart = Math.min(this.loopStart, Math.max(0, d - 0.2)); this.loopEnd = d; }
          let p = typeof o.posAt === 'function' ? o.posAt() : this.pos0;
          if (this.loop && this.loopEnd > this.loopStart + 0.1 && p >= this.loopEnd) p = this.loopStart + ((p - this.loopStart) % (this.loopEnd - this.loopStart));
          try { el.currentTime = Math.min(p, Math.max(0, d - 0.05)); } catch (e) { /* ignore */ }
          el.playbackRate = this.rate;
          const pr = el.play();
          const on = () => {
            if (this.stopped) return res(false);
            const now = c.currentTime, G = this.out.gain, f = o.fadeIn || 0.05;
            holdParam(G, now); G.setValueAtTime(0, now); G.linearRampToValueAtTime(this.gain, now + f);
            res(true);
          };
          if (pr && pr.then) pr.then(on, () => res(false)); else on();
        };
        if (el.readyState >= 1) go(); else { el.addEventListener('loadedmetadata', go, { once: true }); el.addEventListener('error', () => res(false), { once: true }); }
      });
    }
    schedule() {
      // ループ: loopEnd の手前 10 ms を越えたら loopStart へ（ずれた分をそのまま足して戻す。手前なら loopStart の少し前＝継ぎ目の
      // クロスフェードで loopEnd の手前と同じ音の所。loopEnd の後ろに続きの尾がある曲（BGM 生成の道具の --tail）は越えても切れない）
      const el = this.el;
      if (this.stopped || !el || !this.loop || !(this.loopEnd > this.loopStart + 0.1)) return;
      if (el.ended || el.currentTime >= this.loopEnd - 0.01) {
        try { el.currentTime = Math.max(0, this.loopStart + (el.ended ? 0 : el.currentTime - this.loopEnd)); if (el.paused) el.play(); } catch (e) { /* ignore */ }
      }
    }
    position() { return this.el ? this.el.currentTime || this.pos0 : this.pos0; }
    get endTime() { return this.mx.ctx.currentTime + Math.max(0, ((this.el && this.el.duration) || 0) - this.position()) / this.rate; }
    setRate(r) { this.rate = r > 0 ? +r : 1; if (this.el) this.el.playbackRate = this.rate; }
    pause(on) { try { if (on) this.el.pause(); else if (!this.stopped) this.el.play(); } catch (e) { /* ignore */ } }
    stop(fade) {
      if (this.stopped) return;
      this.stopped = true;
      const now = this.mx.ctx.currentTime, G = this.out.gain;
      fade = Math.max(0.02, fade || 0);
      holdParam(G, now);
      G.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => this.dispose(), (fade + 0.2) * 1000);
    }
    dispose() {
      try { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); } catch (e) { /* ignore */ }
      for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    }
  }

  // ============================================================ SFX kit
  // R.DB.sfx.id = function (S) { S.tone({...}); S.noise({...}); } — times in seconds from now.
  class Kit {
    constructor(mx, out, send, t0) { this.mx = mx; this.out = out; this.send = send; this.t0 = t0; this.end = t0; }
    _e(x) { if (x > this.end) this.end = x; return this; }
    tone(o) { return this._e(this.mx.tone(this.out, o, this.t0)); }
    noise(o) { return this._e(this.mx.noise(this.out, o, this.t0)); }
    fm(o) { return this._e(this.mx.fm(this.out, o, this.t0)); }
    /** notes (midi, null = skip) one after another every `step` seconds */
    seq(notes, step, o) {
      o = o || {};
      notes.forEach((n, i) => { if (n != null) this.tone(Object.assign({ d: step }, o, { n, t: (o.t || 0) + i * step })); });
      return this;
    }
    /** same as seq but with FM bells */
    bells(notes, step, o) {
      o = o || {};
      notes.forEach((n, i) => { if (n != null) this.fm(Object.assign({ d: step }, o, { n, t: (o.t || 0) + i * step })); });
      return this;
    }
    drum(k, t, v) { if (DRUMS[k]) DRUMS[k](this.mx, this.out, this.t0 + (t || 0), v == null ? 1 : v); return this._e(this.t0 + (t || 0) + (k === 'g' ? 2.8 : k === 'c' ? 1.5 : 0.9)); }
    /** instrument note: S.inst('harp', 72, t, dur, vel) */
    inst(name, n, t, dur, vel) {
      const I = INST[name];
      if (I) this._e(this.mx.voice(I, this.out, n, this.t0 + (t || 0), dur || 0.2, vel == null ? 1 : vel));
      return this;
    }
    wet(v) { this.send.gain.value = v; return this; }
    gain(v) { this.out.gain.value = v; return this; }
    /** dip the music under this sound: S.duck(db, holdSeconds, t) */
    duck(db, hold, t) { this.mx.duck(db, hold, this.t0 + (t || 0)); return this; }
  }
  function playSfx(mx, def, t) {
    const c = mx.ctx, out = c.createGain(), send = c.createGain();
    send.gain.value = 0;
    out.connect(mx.sfxBus); out.connect(send); send.connect(mx.sfxEcho.input);
    const S = new Kit(mx, out, send, t);
    try { (typeof def === 'function' ? def : def.play)(S); } catch (e) { console.error('[audio] sfx', e); }
    const inst = {
      out, end: S.end,
      kill(now) { holdParam(out.gain, now); out.gain.linearRampToValueAtTime(0, now + 0.03); },
    };
    if (mx.live) setTimeout(() => { try { out.disconnect(); send.disconnect(); } catch (e) { /* ignore */ } }, (S.end - c.currentTime + 1.5) * 1000);
    return inst;
  }

  // ============================================================ public API
  const volCurve = (v) => { v = Math.max(0, Math.min(1, +v || 0)); return Math.pow(v, 1.5); };
  let ctx = null, mx = null, initAt = 0;
  let cur = null;        // logical BGM {id, pos}: what should be playing (also while a jingle plays)
  let pb = null;         // Playback of cur (null while paused by a jingle / not unlocked)
  let jin = null;        // active jingle {pb, resolve, end}
  const stack = [];      // pushBGM stack of {id, pos}
  const vols = { bgm: 0.6, sfx: 0.7, voice: 0.8, amb: 0.7 };   // amb: 環境音（下の ambience の節）
  const liveSfx = {}, lastSfx = {}, warned = {};

  // ------------------------------------------------ recorded media (BGM files, voice lines)
  // window.RPG_MEDIA = {bgm:{id:{src,...}}, voice:{id:{src}}} is written by tools/build.js (data: URLs
  // when embedded, relative URLs with --bgm external / in debug.html). Missing → nothing changes.
  const MEDIA_KEEP = { bgm: 6, voice: 24 }; // decoded buffers kept (PCM is ≈ 21 MB per stereo minute)
  const VOICE_DUCK_DB = 20 * Math.log10(0.6); // BGM level under a voice line (×0.6, V2_PLAN §2.5.4)
  const bufs = { bgm: new Map(), voice: new Map() };
  let useSerial = 0;
  let voice = null;                         // the voice line playing {id, src, out, stopped}
  function mediaEntry(kind, id) {
    return (id && R.Media && R.Media.entry(kind, id)) || null;
  }
  let oneShotPrev = null;   // 1 回だけ鳴る曲の前に鳴っていた曲
  let tempo = null;         // BGM の速さの倍率 {id, mul}（setTempo。その id の曲にだけ効く。戦闘の暴走など）
  function oneShot(id) { const e = mediaEntry('bgm', id); return !!(e && e.loop === false); }
  function decodeBuf(ab) {
    return new Promise((res, rej) => {
      try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
    });
  }
  /** drop the least recently used decoded buffers beyond MEDIA_KEEP (never the ones in use) */
  function trimBufs(kind) {
    const cache = bufs[kind], keep = MEDIA_KEEP[kind];
    const busy = new Set([cur && cur.id, voice && voice.id, ...stack.map((e) => e && e.id)]);
    const done = [...cache.entries()].filter(([id, c]) => c.state === 'ok' && !busy.has(id)).sort((a, b) => a[1].used - b[1].used);
    while (done.length > keep) cache.delete(done.shift()[0]);
  }
  /** {state:'loading'|'ok'|'fail', buf, p} for a listed file (decoding starts on the first call) */
  function loadBuffer(kind, id) {
    const e = mediaEntry(kind, id);
    if (!e || !ctx) return null;
    const cache = bufs[kind];
    let c = cache.get(id);
    if (c) { c.used = ++useSerial; return c; }
    c = { state: 'loading', buf: null, used: ++useSerial };
    cache.set(id, c);
    c.p = R.Media.bytes(kind, id).then(decodeBuf).then(
      (buf) => { c.buf = buf; c.state = 'ok'; trimBufs(kind); return c; },
      (err) => { c.state = 'fail'; warnOnce(kind + 'file:' + id, `audio: cannot decode ${kind} file '${id}' (${err && err.message || err})` + (kind === 'bgm' ? ' — using the synth track' : '')); return c; });
    return c;
  }
  function voiceDuck(on) {
    if (!mx) return;
    const g = mx.voiceDuck.gain, now = ctx.currentTime;
    holdParam(g, now);
    g.linearRampToValueAtTime(on ? Math.pow(10, VOICE_DUCK_DB / 20) : 1, now + (on ? 0.15 : 0.4));
  }
  function endVoice(h, fade) {
    if (!h || h.stopped) return;
    h.stopped = true;
    if (voice === h) voice = null;
    if (h.src) {
      const now = ctx.currentTime;
      holdParam(h.out.gain, now);
      h.out.gain.linearRampToValueAtTime(0, now + (fade || 0.08));
      try { h.src.stop(now + (fade || 0.08) + 0.03); } catch (e) { /* ignore */ }
      if (mx.live) setTimeout(() => { try { h.src.disconnect(); h.out.disconnect(); } catch (e) { /* ignore */ } }, 600);
    }
    if (!voice) voiceDuck(false);
  }

  let bv = null;           // the hero's battle voice playing (R.Audio.battleVoice)
  const bvLast = {};       // kind+gender → last clip id (no immediate repeat)
  function endBattleVoice(h) {
    if (!h || h.stopped) return;
    h.stopped = true;
    if (bv === h) bv = null;
    if (h.src) {
      const now = ctx.currentTime;
      holdParam(h.out.gain, now);
      h.out.gain.linearRampToValueAtTime(0, now + 0.05);
      try { h.src.stop(now + 0.08); } catch (e) { /* ignore */ }
    }
  }
  function warnOnce(k, msg) { if (!warned[k]) { warned[k] = 1; R.warn(msg); } }
  function running() { return !!(ctx && ctx.state === 'running'); }
  function startCur(o) {
    o = o || {};
    if (!mx || !cur) return;
    const fe = mediaEntry('bgm', cur.id);
    if (fe) {
      const c = loadBuffer('bgm', cur.id);
      // 速めている曲（setTempo）: 高さを保って速められるなら <audio> で（ジングルの後に戻るときなど）
      if (tempo && tempo.id === cur.id && canStretch(cur.id)) {
        pb = new StretchPlayback(mx, cur.id, fe, { dest: mx.music, pos: cur.pos || 0, fadeIn: Math.max(0.05, o.fadeIn || 0), rate: tempo.mul });
        return;
      }
      if (c && c.state === 'ok') {
        pb = new FilePlayback(mx, cur.id, c.buf, fe, { dest: mx.music, at: ctx.currentTime + (o.delay || 0.03), pos: cur.pos || 0, fadeIn: o.fadeIn });
        return;
      }
      if (c && c.state === 'loading') {
        // start once decoded — unless the track changed meanwhile (the same `cur` object survives jingles)
        const want = cur;
        c.p.then(() => { if (cur === want && !pb && !jin && mx) startCur({ fadeIn: Math.max(0.05, o.fadeIn || 0) }); });
        return;
      }
      // decode failed → the synthesised track (if there is one)
    }
    const song = compile(cur.id);
    if (!song) { warnOnce('bgm:' + cur.id, `audio: unknown BGM '${cur.id}'`); return; }
    pb = new Playback(mx, song, { dest: mx.music, at: ctx.currentTime + (o.delay || 0.03), pos: cur.pos || 0, fadeIn: o.fadeIn, rate: tempo && tempo.id === cur.id ? tempo.mul : 1 });
    pump();
  }
  function stopPb(fade) { if (pb) { pb.stop(fade); pb = null; } }
  function finishJingle(j, resume, fade) {
    if (!j || jin !== j) return;
    jin = null;
    clearTimeout(j.timer);
    // fade（秒）: 途中で閉じるとき（endJingle）はジングルを短く消し、その半ばから BGM を戻す
    j.pb.stop(fade != null ? fade : resume ? 1.2 : 0.08);
    if (resume && cur && !pb) startCur(fade != null ? { delay: fade * 0.5, fadeIn: Math.max(0.3, fade) } : { fadeIn: 0.5 });
    j.resolve();
  }
  function pump() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (ctx.state !== 'running') return;
    const until = now + LOOKAHEAD;
    if (pb) pb.schedule(until, now);
    ambPump(now);   // 環境音の粒と揺れ（ambience の節）
    if (jin) {
      jin.pb.schedule(until, now);
      if (now >= jin.end) finishJingle(jin, true);
    }
  }
  function unlock() {
    if (!ctx) return;
    if (ctx.state !== 'running' && ctx.state !== 'closed') { try { ctx.resume(); } catch (e) { /* ignore */ } }
  }

  const known = (id) => !!(mediaEntry('bgm', id) || DB.music[id] || standIn(FALLBACK.bgm, DB.music, id) || standIn(FALLBACK.jingles, DB.music, id));
  const sfxDef = (id) => DB.sfx[id] || DB.sfx[standIn(FALLBACK.sfx, DB.sfx, id)];
  const prevA = R.Audio; // keep ids other files pushed onto PENDING before this file ran
  const A = (R.Audio = {
    TPW, INST, DRUMS, Mixer, Playback, compile, playSfx, parseMML, parseProg, parseChord, meterTicks,
    IDS, FALLBACK, MOTIFS,
    PENDING: (prevA && prevA.PENDING) || [],
    /** the id that actually sounds for `id` (itself, its stand-in, or null) */
    resolve(kind, id) {
      const reg = kind === 'sfx' ? DB.sfx : DB.music;
      if (reg[id]) return id;
      return standIn(kind === 'sfx' ? FALLBACK.sfx : kind === 'jingle' || kind === 'jingles' ? FALLBACK.jingles : FALLBACK.bgm, reg, id);
    },
    get current() { return cur ? cur.id : null; },
    get ready() { return !!mx; },
    get context() { return ctx; },

    /** create the AudioContext (call from a user gesture; safe to call repeatedly) */
    init() {
      if (ctx) { unlock(); return true; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC({ latencyHint: 'interactive' });
      } catch (e) { console.error('[audio] no AudioContext', e); ctx = null; return false; }
      initAt = Date.now();
      mx = new Mixer(ctx, ctx.destination, { live: true });
      const S = R.Settings && R.Settings.get ? R.Settings : null;
      if (S) A.setVolumes(S.get('vol.bgm') / 10, S.get('vol.sfx') / 10, S.get('vol.voice') / 10, S.get('vol.amb') / 10);
      else A.setVolumes(vols.bgm, vols.sfx, vols.voice, vols.amb);
      unlock();
      setInterval(() => { try { pump(); } catch (e) { console.error('[audio]', e); } }, TICK_MS);
      try {
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch (e) { /* ignore */ }
          if (pb && pb.stretch) pb.pause(document.hidden);   // <audio> は context を止めても進むので一緒に止める
        });
        for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, { passive: true });
      } catch (e) { /* no DOM (tests) */ }
      if (cur && !pb && !jin) startCur({ fadeIn: 0.05 });
      ambInit();   // init の前に頼まれていた環境音を鳴らし始める
      // the battle track is pushed often: decode its recorded version early (no-op without a file)
      // compile the remaining tracks in idle slices so the first battle never hitches
      const ids = Object.keys(DB.music);
      const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 1000 }) : (f) => setTimeout(f, 120);
      const next = () => { const id = ids.shift(); if (id) { try { compile(id); } catch (e) { console.error('[audio]', id, e); } idle(next); } };
      idle(next);
      return true;
    },

    /** loop a track; the same id already current → no-op. opts.fade (frames) crossfades */
    playBGM(id, opts) {
      if (!id) { A.stopBGM(opts && opts.fade); return; }
      if (!known(id)) { warnOnce('bgm:' + id, `audio: unknown BGM '${id}'`); return; }
      if (cur && cur.id === id) { if (mx && !pb && !jin) startCur(); return; }
      const f = opts && opts.fade ? opts.fade / 60 : 0;
      stopPb(f || 0.06);
      // 1 回だけ鳴る曲（omen など loop:false）: 前の曲を覚えておき、戦闘の popBgm で無音に戻らないようにする
      if (oneShot(id)) oneShotPrev = cur && !oneShot(cur.id) ? cur.id : oneShotPrev;
      cur = { id, pos: 0 };
      if (mx && !jin) startCur(f ? { delay: f * 0.5, fadeIn: f * 0.5 } : {});
    },
    stopBGM(fadeFrames) {
      cur = null;
      stopPb((fadeFrames || 0) / 60 || 0.04);
    },
    /**
     * 今の BGM の速さの倍率（1 = もと。高さは変えない）。合成の曲だけ: 録音の曲（ogg 等）は高さを保って速められないので何もしない。
     * 倍率はその曲の id に付く（ジングルの後に戻る・同じ曲を鳴らし直すときも続く。別の曲には効かない）。戻すのは setTempo(1)
     * → 合成の曲に効いた（または効く）なら true
     */
    setTempo(mul) {
      mul = mul > 0 ? +mul : 1;
      const id = cur ? cur.id : null;
      const file = !!id && !!mediaEntry('bgm', id), stretch = file && canStretch(id);
      tempo = mul === 1 || !id || (file && !stretch && !!ctx) ? null : { id, mul };
      if (!pb || pb.id !== id || !ctx) return !!tempo || mul === 1;
      if (!pb.file || pb.stretch) { pb.setRate(mul, ctx.currentTime); return true; }
      // 録音の曲: <audio> で高さを保って速め、鳴りだしたら元の音を消す（同じ位置から。間は短い重ね）
      if (mul === 1 || !stretch) return mul === 1;
      const old = pb, fe = mediaEntry('bgm', id);
      const np = new StretchPlayback(mx, id, fe, { dest: mx.music, posAt: () => old.position(ctx.currentTime), fadeIn: 0.3, rate: mul });
      np.ready.then((ok) => {
        if (pb !== old || !ok) { if (!ok && !np.stopped) np.stop(0.05); return; }
        pb = np;
        old.stop(0.3);
      });
      return true;
    },
    /** 今の BGM に効いている速さの倍率（無ければ 1） */
    get tempo() { return tempo && cur && tempo.id === cur.id ? tempo.mul : 1; },
    /** 鳴っている BGM の種類（'synth' | 'file' | 'stretch'（録音を <audio> で速めている）| null）。テスト用 */
    get bgmKind() { return !pb ? null : pb.stretch ? 'stretch' : pb.file ? 'file' : 'synth'; },
    /** pause the current track (remembering its position) and play another (battle) */
    pushBGM(id) {
      if (jin) finishJingle(jin, false);
      const pos = pb && ctx ? pb.position(ctx.currentTime) : cur ? cur.pos : 0;
      stack.push(cur ? { id: cur.id, pos } : null);
      if (stack.length > 8) stack.shift();
      stopPb(0.05);
      cur = null;
      A.playBGM(id);
    },
    /** stop the pushed track and resume the previous one from where it paused */
    popBGM() {
      stopPb(0.1);
      let e = stack.pop();
      if (e && oneShot(e.id)) e = oneShotPrev ? { id: oneShotPrev, pos: 0 } : null;   // 鳴り終わった予告の曲には戻らない
      cur = e ? { id: e.id, pos: e.pos } : null;
      if (cur && mx && !jin) startCur({ delay: 0.05, fadeIn: 0.35 });
    },
    /** fanfare: pauses BGM, plays once, resumes BGM; resolves when it ends */
    playJingle(id) {
      if (!mx || !known(id) || !(running() || Date.now() - initAt < 1500)) return Promise.resolve();
      const song = compile(id);
      if (!song) return Promise.resolve();
      if (jin) finishJingle(jin, false);
      if (pb) { if (cur) cur.pos = pb.position(ctx.currentTime); stopPb(0.06); }
      const p = new Playback(mx, song, { dest: mx.music, at: ctx.currentTime + 0.04, loop: false });
      return new Promise((resolve) => {
        const j = (jin = { pb: p, resolve, end: p.endTime });
        // safety net if the scheduler is starved (background tab)
        j.timer = setTimeout(() => finishJingle(j, true), (song.endSec + 3) * 1000);
        pump();
      });
    },
    /** 鳴っているジングルを途中で閉じる（宿の眠りを飛ばしたとき）: fadeMs で消し、止めていた BGM を戻す。
     *  ジングルの Promise もここで解決する（'ended' を待たない）。鳴っていなければ何もしない → 閉じたら true */
    endJingle(fadeMs) {
      if (!jin) return false;
      finishJingle(jin, true, Math.max(0.05, (fadeMs == null ? 500 : +fadeMs || 0) / 1000));
      return true;
    },
    /** 鳴っているジングルの id（無ければ null） */
    get jingleId() { return jin ? jin.pb.id : null; },
    sfx(id) {
      if (!mx || !(running() || Date.now() - initAt < 1500)) return;
      const def = sfxDef(id);
      if (!def) { warnOnce('sfx:' + id, `audio: unknown sfx '${id}'`); return; }
      const now = ctx.currentTime;
      if (lastSfx[id] != null && now - lastSfx[id] < 0.03 && now >= lastSfx[id]) return;
      lastSfx[id] = now;
      const list = (liveSfx[id] = (liveSfx[id] || []).filter((x) => x.end > now));
      if (list.length >= 3) list.shift().kill(now);
      list.push(playSfx(mx, def, now + 0.005));
    },
    /** dip the BGM by `db` (e.g. -6) for `frames` (60 fps), then recover in 0.25 s. No-op when locked */
    duck(db, frames) {
      if (!mx || !running()) return;
      mx.duck(db != null ? +db : -6, (frames != null ? +frames : 18) / 60);
    },
    // ------------------------------------------------ voice lines (BRIEF A9)
    /** play assets/voice/<id>.* (stops the previous line, ducks the BGM). → handle | null (no file,
     *  volume 0, locked audio). Never throws; a missing / broken file is silent. */
    playVoice(id) {
      if (voice) endVoice(voice);
      if (!mx || !id || !(vols.voice > 0) || !(running() || Date.now() - initAt < 1500)) return null;
      if (!mediaEntry('voice', id)) return null;
      const h = { id, stopped: false, src: null, out: null };
      voice = h;
      const c = loadBuffer('voice', id);
      const go = () => {
        if (h.stopped || voice !== h || !c || c.state !== 'ok') { if (voice === h && c && c.state === 'fail') endVoice(h); return; }
        const now = ctx.currentTime;
        h.out = ctx.createGain();
        h.out.connect(mx.voiceBus);
        h.src = ctx.createBufferSource();
        h.src.buffer = c.buf;
        h.src.connect(h.out);
        h.src.onended = () => { if (!h.stopped) { h.src = null; endVoice(h); } };
        h.src.start(now + 0.01);
        voiceDuck(true);
      };
      if (!c) return null;
      if (c.state === 'ok') go(); else if (c.state === 'loading') c.p.then(go);
      return h;
    },
    /** stop the voice line (only `h` when given: an older say never stops a newer line) */
    stopVoice(h) {
      if (h && h !== voice) { h.stopped = true; return; }
      if (voice) endVoice(voice);
    },
    /** the hero's battle voice (owner 2026-09-26): kind 'attack'|'glimmer'|'spell'|'hurt'|'ko'|'victory'.
     *  Plays a random embedded clip v_hero_<g>_<kind>_<n> (g = R.State.hero().gender 'm'|'f', or `gender`),
     *  never the same clip twice in a row. Own voice volume, no BGM duck, does not stop a story line; a new
     *  battle voice replaces the previous one. → handle | null (no clip / volume 0 / locked). Never throws. */
    battleVoice(kind, gender) {
      try {
        if (!mx || !kind || !(vols.voice > 0) || !running()) return null;
        let g = gender;
        if (g !== 'm' && g !== 'f') { const h = R.State && R.State.hero && R.State.hero(); g = h && h.gender === 'f' ? 'f' : 'm'; }
        const M = R.Media ? R.Media.table() : null;
        const pre = `v_hero_${g}_${kind}_`;
        const ids = M && M.voice ? Object.keys(M.voice).filter((k) => k.startsWith(pre) && /^\d+$/.test(k.slice(pre.length))).sort() : [];
        if (!ids.length) return null;
        const pool = ids.length > 1 ? ids.filter((k) => k !== bvLast[kind + g]) : ids;
        const id = pool[Math.floor(Math.random() * pool.length)];
        bvLast[kind + g] = id;
        return A.battleVoiceId(id);
      } catch (e) { return null; }
    },
    /** a battle voice clip by id (companions' and the hero's shouts, BSCENE): own voice volume, no BGM duck,
     *  does not stop a story line (R.Audio.voice), replaces only the previous battle voice. → handle | null. Never throws. */
    battleVoiceId(id) {
      try {
        if (!mx || !id || !(vols.voice > 0) || !running()) return null;
        if (!mediaEntry('voice', id)) return null;
        if (bv) endBattleVoice(bv);
        const h = (bv = { id, stopped: false, src: null, out: null });
        const c = loadBuffer('voice', id);
        if (!c) { bv = null; return null; }
        const go = () => {
          if (h.stopped || bv !== h || c.state !== 'ok') { if (bv === h && c.state === 'fail') bv = null; return; }
          h.out = ctx.createGain();
          h.out.connect(mx.voiceBus);
          h.src = ctx.createBufferSource();
          h.src.buffer = c.buf;
          h.src.connect(h.out);
          h.src.onended = () => { if (bv === h) bv = null; h.stopped = true; };
          h.src.start(ctx.currentTime + 0.005);
        };
        if (c.state === 'ok') go(); else if (c.state === 'loading') c.p.then(go);
        return h;
      } catch (e) { return null; }
    },
    get voiceId() { return voice && !voice.stopped ? voice.id : null; },

    // ------------------------------------------------ v2 の契約の名前（V2_PLAN §2.5.4）
    /** BGM を鳴らす。o.fade はミリ秒（切り替えのクロスフェード） */
    bgm(id, o) { A.playBGM(id, o && o.fade ? { fade: o.fade * 60 / 1000 } : undefined); },
    pushBgm(id) { A.pushBGM(id); },
    popBgm() { A.popBGM(); },
    stopBgm(fadeMs) { A.stopBGM((fadeMs || 0) * 60 / 1000); },
    /** ジングル（BGM を止めて 1 回鳴らし、終わったら戻す）→ 終わりで解決 */
    jingle(id) { return A.playJingle(id); },
    /** ボイスを鳴らす → 鳴り終わり（止められた・無いときはすぐ）で解決。エラーにしない。鳴っている間は BGM を 0.6 倍 */
    voice(id) {
      let h = null;
      try { h = A.playVoice(id); } catch (e) { h = null; }
      if (!h) return Promise.resolve();
      return R.until ? R.until(() => h.stopped) : Promise.resolve();
    },
    /** 先読み（2026-09-27）: これから鳴らすボイスを読んで解いておく → 読み終わり（無い・失敗も）で解決。エラーにしない。
     *  まとめた版（voice/pack_NN.ogg）は初めのボイスで 2.5 MB の束を読むので、先読みしないと冒頭の声が送りに間に合わない。
     *  音がまだ起きていない（ctx なし）ときは束・ファイルの読み込みだけ温める */
    preloadVoice(ids) {
      const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => mediaEntry('voice', id));
      return Promise.all(list.map((id) => {
        try {
          const c = ctx ? loadBuffer('voice', id) : null;
          if (c) return c.state === 'loading' ? c.p : c;
          return R.Media && R.Media.bytes ? R.Media.bytes('voice', id).catch(() => null) : null;
        } catch (e) { return null; }
      })).then(() => undefined, () => undefined);
    },
    /** is there a recorded file for this id? kind 'bgm' | 'voice' */
    hasFile(kind, id) { return !!mediaEntry(kind, id); },
    VOICE_DUCK_DB, FILE_GAIN, FilePlayback,
    _mxVoiceDuck() { return mx ? mx.voiceDuck : null; }, // tests

    setVolumes(bgm, sfx, vo, am) {
      if (bgm != null) vols.bgm = +bgm;
      if (am != null) vols.amb = +am;   // 環境音（4 つ目。無ければ変えない）
      if (sfx != null) vols.sfx = +sfx;
      if (vo != null) { vols.voice = +vo; if (!(vols.voice > 0) && voice) endVoice(voice); }
      if (!mx) return;
      const now = ctx.currentTime;
      for (const [node, v] of [[mx.music, vols.bgm], [mx.sfxBus, vols.sfx], [mx.voiceBus, vols.voice]]) {
        holdParam(node.gain, now);
        node.gain.linearRampToValueAtTime(volCurve(v), now + 0.05);
      }
      ambVol();
    },
    /** snapshot of the player state (QA / debug overlay) */
    debug() {
      const now = ctx ? ctx.currentTime : 0;
      return {
        ctx: ctx ? ctx.state : 'none', current: cur ? cur.id : null, playing: pb ? pb.id : null, file: !!(pb && pb.file),
        voice: voice && !voice.stopped ? voice.id : null,
        serial: pb ? pb.serial : 0, pos: +(pb ? pb.position(now) : cur ? cur.pos : 0).toFixed(2),
        jingle: jin ? jin.pb.id : null, stack: stack.map((e) => e && e.id), volumes: Object.assign({}, vols), ambience: A.ambienceInfo(),
      };
    },
    /** {duration, loopStart, loopEnd, loop} of a track (no audio needed) */
    info(id) {
      const s = compile(id);
      return s && { duration: s.endSec, loopStart: s.loopSec, loopEnd: s.endSec, loop: s.loop, warns: s.warns.slice() };
    },

    // ------------------------------------------------ offline rendering (tools/render_audio.js)
    /** schedule a whole track into any (Offline)AudioContext; returns the render length (s) */
    renderTrack(octx, id, o) {
      o = o || {};
      const m = new Mixer(octx, octx.destination, { limiter: !!o.limiter });
      m.music.gain.value = o.volume != null ? o.volume : 1;
      const song = compile(id);
      const p = new Playback(m, song, { dest: m.music, at: 0.05, passes: o.passes || 2 });
      if (o.only) p.only = o.only;
      const body = song.loop ? (song.endSec - song.loopSec) * ((o.passes || 2) - 1) : 0;
      const end = 0.05 + song.endSec + body;
      // progressive scheduling (like the live look-ahead) keeps the graph small
      const step = 0.5;
      if (octx.suspend) {
        for (let t = step; t < end + 1; t += step) {
          const at = t;
          octx.suspend(at).then(() => { p.schedule(at + step + 0.1, at); octx.resume(); });
        }
        p.schedule(step + 0.1, 0);
      } else p.schedule(Infinity, 0);
      return { start: 0.05, end, loopStart: 0.05 + song.loopSec, loopEnd: 0.05 + song.endSec, loop: song.loop };
    },
    renderSfx(octx, id, o) {
      o = o || {};
      const m = new Mixer(octx, octx.destination, { limiter: !!o.limiter });
      m.sfxBus.gain.value = o.volume != null ? o.volume : 1;
      return { start: 0.02, end: playSfx(m, sfxDef(id), 0.02).end };
    },
    renderNote(octx, inst, midi, dur, vel) {
      const m = new Mixer(octx, octx.destination, { limiter: false });
      if (inst === 'drums') { DRUMS[midi](m, m.music, 0.02, vel || 1); return; }
      m.voice(INST[inst], m.music, midi, 0.02, dur, vel || 1);
    },
  });

  // After every file has loaded (main.js / tools call R.runDataHooks): give every listed id
  // that still has no definition its stand-in (the same object / a forwarding SFX) and list it
  // in PENDING, so callers never hit silence and qa can count what is left (DESIGN §11.1.3).
  function registerStandIns() {
    const add = (kind, list, reg, table) => {
      for (const id of list) {
        if (reg[id]) continue;
        const to = standIn(table, reg, id);
        if (!to) continue;
        if (kind === 'sfx') reg[id] = (S) => reg[to](S); else reg[id] = reg[to];
        if (!A.PENDING.includes(id)) A.PENDING.push(id);
      }
    };
    add('bgm', IDS.bgm, DB.music, FALLBACK.bgm);
    add('jingle', IDS.jingles, DB.music, FALLBACK.jingles);
    add('sfx', IDS.sfx, DB.sfx, FALLBACK.sfx);
  }
  A.registerStandIns = registerStandIns;
  if (R.onData) R.onData(registerStandIns);

  // ============================================================ ambience（環境音。2026-10-04、design/notes/audio.md §14）
  // R.Audio.ambience(spec | null, {fade: 秒（既定 1.2）}) — 天気と場所の環境音の床を 1 つだけ鳴らす。前の床とは fade 秒で入れ替える。
  //   spec = '床の名前' | {bed, i（強さ 0〜1、既定 1）, night（夜の深さ 0〜1。森の鳥 ↔ 虫）, surf（岸の波を足す 0〜1）,
  //          dry（洞窟の雫なし）, muffled（船の中: 波をこもらせる）, seed（乱数の種。テスト用）}。同じ spec ならなにもしない
  //   床: wind snow mist breeze highwind blizzard sandstorm heat rain sea marsh ash forest cave volcano（下の AMB）
  //   作り: ステレオの桃色ノイズ 6 秒（初めて使うときに 1 回だけ作る。継ぎ目は交差）を、層ごとにずらした位置と少し違う速さで回し、
  //         フィルタ＋ゆっくりした乱数の揺れ（突風・波）＋まばらな粒（雫・鳥・虫・蛙・火の粉）で作る。録音は使わない。
  //   出口は自分のバス（master の下。音量は設定の vol.amb = setVolumes の 4 つ目）。強さ 1・音量 10 で山が −20 dBFS ほど（BGM が主）。
  //   AudioContext が無い間は覚えておくだけ（init で鳴らし始める）。タブを隠すと context ごと止まる（上の visibilitychange）。
  //   粒と揺れは pump（25 ms ごと、context が動いている間だけ）が AMB_LEAD 秒先まで置く。
  // R.Audio.ambienceMod(v 0〜1 | null) — 床の突風の強さを外から合わせる（砂嵐の絵の「風の帯」と同じうねり）。null で床自身の揺れに戻す
  // R.Audio.ambienceInfo() → {bed, i, alive, nodes, srcs} | null（テスト・QA）
  // R.Audio.renderAmbience(octx, spec, {dur, volume, at, to, fade}) — オフラインで鳴らす（at 秒で to へ入れ替え。to: null は消すだけ）→ {beds}
  const AMB_FADE = 1.2;
  const AMB_LEAD = 0.6;
  const AMB_PEAK = 0.1;   // 強さ 1・音量 10 の山の目安（−20 dBFS）。床ごとの差は AMB_TRIM で揃える（tools/test_ambience.js で測る）
  // 床ごとの音量の揃え（強さ 1・音量 10 の積分ラウドネスで 吹雪 −33・砂嵐 −34・海 −36・雨 −37・森 −41・陽炎 −43 LUFS ほど。2026-10-04 に測った）
  const AMB_TRIM = { blizzard: 1.00, sandstorm: 1.25, rain: 1.30, ash: 1.15, volcano: 1.10, breeze: 1.00, highwind: 0.79, mist: 1.51, marsh: 1.29, forest: 1.25, cave: 0.71, heat: 0.48 };
  function ambRng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 桃色ノイズ（左右は別の乱数。RMS 0.25）。Mixer ごとに 1 回 */
  function ambNoise(m) {
    if (m._ambNoise) return m._ambNoise;
    const c = m.ctx, sr = c.sampleRate, n = Math.floor(sr * 6), F = Math.floor(sr * 0.08);
    const b = c.createBuffer(2, n, sr), rnd = ambRng(0x51f15e);
    for (let ch = 0; ch < 2; ch++) {
      const x = new Float32Array(n + F);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, e = 0;
      for (let i = 0; i < n + F; i++) {
        const w = rnd() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        x[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
        e += x[i] * x[i];
      }
      const k = 0.25 / Math.sqrt(e / (n + F)), d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = x[i] * k;
      // 継ぎ目: 終わりの続き（n〜n+F）を頭に重ねる（同じ力の交差）。回したとき d[n-1] → d[0] がつながる
      for (let i = 0; i < F; i++) { const w = i / F; d[i] = (x[i] * Math.sqrt(w) + x[n + i] * Math.sqrt(1 - w)) * k; }
    }
    return (m._ambNoise = b);
  }
  /** 洞窟の響きの形: 2.4 秒、指数で減り、時間とともに高い所から先に消える（左右は別のノイズ） */
  function ambVerbIR(m) {
    if (m._ambIR) return m._ambIR;
    const c = m.ctx, sr = c.sampleRate, n = Math.floor(sr * 2.4), b = c.createBuffer(2, n, sr), rnd = ambRng(0xc0ffee);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, k = 0.85 - 0.75 * Math.min(1, t / 1.6);   // 1 段の低域通過: 進むほど暗く
        y += k * ((rnd() * 2 - 1) - y);
        d[i] = y * Math.exp(-t / 0.55) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    return (m._ambIR = b);
  }
  function ambBus(m) {
    if (!m._ambBus) { m._ambBus = m.ctx.createGain(); m._ambBus.connect(m.master); }
    return m._ambBus;
  }

  /** 鳴っている床 1 つ。層は bus（強さと AMB_TRIM の音量）→ out（入り・抜けの fade）→ 環境音のバス */
  class AmbBed {
    constructor(m, dest, spec, at, fade) {
      const c = (this.c = m.ctx);
      this.m = m; this.spec = spec; this.name = spec.bed; this.t0 = at;
      this.i = Math.max(0, Math.min(1, spec.i == null ? 1 : +spec.i || 0));
      this.night = Math.max(0, Math.min(1, spec.night == null ? 0 : +spec.night || 0));
      this.r = ambRng(spec.seed != null ? spec.seed : (Math.random() * 4294967296) >>> 0);
      this.srcs = []; this.nodes = []; this.walks = []; this.evs = [];
      this.alive = true; this.stopAt = null; this.gust = null;
      this.out = this.node(c.createGain());
      this.out.gain.setValueAtTime(0, at);
      this.out.gain.linearRampToValueAtTime(1, at + Math.max(0.02, fade || 0));
      this.out.connect(dest);
      this.bus = this.gain(AMB_PEAK * (AMB_TRIM[this.name] || 1) * (0.35 + 0.65 * this.i));
      this.chain(this.bus, this.filt('highpass', 45, 0.6), this.out);   // 聞こえない低い所は BGM の低音を濁すだけなので切る
      this.ev = this.bus;   // 粒の行き先（洞窟は響きも通す）
      AMB[this.name](this, this.i);
    }
    rr(a, b) { return a + (b - a) * this.r(); }
    node(n) { this.nodes.push(n); return n; }
    gain(v) { const g = this.node(this.c.createGain()); g.gain.value = v; return g; }
    filt(type, f, q) { const x = this.node(this.c.createBiquadFilter()); x.type = type; x.frequency.value = f; if (q != null) x.Q.value = q; return x; }
    pan(p) {
      if (!this.c.createStereoPanner) return this.gain(1);
      const x = this.node(this.c.createStereoPanner()); x.pan.value = Math.max(-1, Math.min(1, p)); return x;
    }
    chain() { for (let k = 0; k < arguments.length - 1; k++) arguments[k].connect(arguments[k + 1]); return arguments[arguments.length - 1]; }
    /** 洞の響き（ConvolverNode。響きの形は Mixer ごとに 1 回作る）→ 入口の gain（出口は bus） */
    verb(wet) {
      const c = this.c;
      if (!c.createConvolver) return null;
      const cv = this.node(c.createConvolver());
      cv.buffer = ambVerbIR(this.m);
      const inp = this.gain(1);
      this.chain(inp, cv, this.gain(wet), this.bus);
      return inp;
    }
    /** 回り続けるノイズ（層ごとに位置と速さを少し違える） */
    src(rate) {
      const s = this.node(this.c.createBufferSource());
      s.buffer = ambNoise(this.m); s.loop = true;
      s.playbackRate.value = (rate || 1) * this.rr(0.93, 1.07);
      s.start(this.t0, this.rr(0, 5.9));
      this.srcs.push(s);
      return s;
    }
    /** 回り続ける音（虫の声など） */
    osc(type, f) {
      const o = this.node(this.c.createOscillator());
      o.type = type; o.frequency.value = f; o.start(this.t0);
      this.srcs.push(o);
      return o;
    }
    /** 乱数の揺れ: every [a, b] 秒ごとに lo〜hi のどこかへ tc 秒の時定数で寄る（p は 1 つか、同じ値で動かす配列） */
    walk(p, lo, hi, every, tc) {
      const ps = Array.isArray(p) ? p : [p];
      const v = this.rr(lo, hi);
      for (const q of ps) q.setValueAtTime(v, this.t0);
      const w = { ps, lo, hi, every, tc, next: this.t0 + this.rr(0, every[0]), held: false };
      this.walks.push(w);
      return w;
    }
    /** まばらな粒: [a, b] 秒おきに fn(t) */
    every(range, fn, first) {
      this.evs.push({ range, fn, next: this.t0 + (first != null ? first : this.rr(0.2, 1) * range[0]) });
    }
    schedule(until) {
      if (!this.alive) return;
      const now = this.c.currentTime;
      for (const w of this.walks) {
        if (w.next < now) w.next = now;
        while (w.next < until) {
          if (!w.held) {
            const k = this.r(), v = w.lo + k * (w.hi - w.lo);
            for (const q of w.ps) q.setTargetAtTime(v, w.next, w.tc);
            if (w.with) for (const [q, lo, hi] of w.with) q.setTargetAtTime(lo + k * (hi - lo), w.next, w.tc);   // 同じ揺れで動く物（突風が強いほど風の音が高い）
          }
          w.next += this.rr(w.every[0], w.every[1]);
        }
      }
      for (const e of this.evs) {
        if (e.next < now) e.next = now + this.r() * 0.1;
        while (e.next < until) {
          try { e.fn(e.next); } catch (err) { console.error('[audio] ambience', err); }
          e.next += this.rr(e.range[0], e.range[1]);
        }
      }
    }
    /** 突風の強さを外から（0〜1）。null で自分の揺れに戻す */
    mod(v) {
      const w = this.gust;
      if (!w) return;
      w.held = v != null;
      if (v != null) {
        const k = Math.max(0, Math.min(1, +v || 0)), x = w.lo + k * (w.hi - w.lo), now = this.c.currentTime;
        for (const q of w.ps) q.setTargetAtTime(x, now, 0.35);
        if (w.with) for (const [q, lo, hi] of w.with) q.setTargetAtTime(lo + k * (hi - lo), now, 0.35);
      }
    }
    stop(fade, now) {
      if (!this.alive) return;
      this.alive = false;
      const end = now + Math.max(0.02, fade);
      holdParam(this.out.gain, now);
      this.out.gain.linearRampToValueAtTime(0, end);
      this.stopAt = end + 0.05;
      for (const s of this.srcs) { try { s.stop(this.stopAt); s._stopAt = this.stopAt; } catch (e) { /* ignore */ } }
      if (this.m.live) {
        const nodes = this.nodes;
        setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } }, (end - now + 0.4) * 1000);
      }
    }
    // ---- 粒（1 回だけ鳴って消える。nodes に積まない）
    /** ノイズの切れ端: {f, q, type, vol, a, pan, rate} を dur 秒 */
    burst(t, dur, o) {
      const c = this.c, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = ambNoise(this.m); s.playbackRate.value = o.rate || 1;
      f.type = o.type || 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q != null ? o.q : 1;
      const a = o.a || 0.001;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.002, dur));
      s.connect(f); f.connect(g);
      if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(o.to || this.ev); } else g.connect(o.to || this.ev);
      s.start(t, this.rr(0, 5.9)); s.stop(t + dur + 0.02);
    }
    /** 正弦の短い音: {f, f2（行き先の高さ）, dur, vol, a, pan, fm（揺れの速さ）, fmd（揺れの深さ、高さの比）} */
    tone(t, o) {
      const c = this.c, s = c.createOscillator(), g = c.createGain();
      s.type = o.type || 'sine';
      s.frequency.setValueAtTime(o.f, t);
      if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
      const a = o.a || Math.min(0.012, o.dur * 0.25);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      s.connect(g);
      let m = null;
      if (o.fm) { m = c.createOscillator(); const mg = c.createGain(); m.frequency.value = o.fm; mg.gain.value = o.f * (o.fmd || 0.03); m.connect(mg); mg.connect(s.frequency); m.start(t); m.stop(t + o.dur + 0.02); }
      if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(o.to || this.ev); } else g.connect(o.to || this.ev);
      s.start(t); s.stop(t + o.dur + 0.02);
      if (o.click) this.burst(t, 0.006, { f: o.f * 2, q: 1, vol: o.click, pan: o.pan, to: o.to });   // 当たりの小さな擦れ（雫）
    }
  }

  // ---- 層（床の部品）
  /** 風: 帯域のノイズ（中心が揺れる）＋低い胴 → 突風の揺れ（B.gust。ambienceMod が掴む）。o = {f:[lo,hi], q, lp, g:[lo,hi], ge, gtc, body, fe, ftc} */
  function lWind(B, o) {
    const G = B.gain(0);
    G.connect(o.to || B.bus);
    const s = B.src(o.rate || 1), bp = B.filt('bandpass', o.f[0], o.q || 0.8), lp = B.filt('lowpass', o.lp || o.f[1] * 2.2, 0.5);
    B.chain(s, bp, lp, B.gain(o.lvl != null ? o.lvl : 1), G);
    if (!o.couple) B.walk([bp.frequency], o.f[0], o.f[1], o.fe || [1.5, 4], o.ftc || 1.2);
    if (o.body) { const s2 = B.src(0.5), l2 = B.filt('lowpass', o.bodyF || 240, 0.6); B.chain(s2, l2, B.gain(o.body), G); }
    const w = B.walk(G.gain, o.g[0], o.g[1], o.ge || [1.2, 4], o.gtc || 0.9);
    if (o.couple) { w.with = [[bp.frequency, o.f[0], o.f[1]], [lp.frequency, o.f[0] * 1.6, o.f[1] * 2.4]]; bp.frequency.setValueAtTime(o.f[0], B.t0); }
    if (!B.gust) B.gust = w;
    return G;
  }
  /** 鳴る風（吹雪のひゅう）: 鋭い帯域を 2 段、中心がゆっくり上下 */
  function lWhistle(B, o) {
    const s = B.src(1), b1 = B.filt('bandpass', o.f[0], o.q || 20), b2 = B.filt('bandpass', o.f[0], o.q || 20), g = B.gain(0), p = B.pan(o.pan || 0);
    B.chain(s, b1, b2, g, p, o.to || B.bus);
    B.walk([b1.frequency, b2.frequency], o.f[0], o.f[1], o.fe || [1.5, 3.5], o.ftc || 0.9);
    // ときどき膨らんで消える（鳴りっぱなしにしない）
    B.every(o.swell || [3, 8], (t) => {
      const up = B.rr(0.5, 1.4);
      g.gain.setTargetAtTime(o.lvl * B.rr(0.35, 1), t, up / 3);
      g.gain.setTargetAtTime(0, t + up + B.rr(0.3, 1.5), B.rr(0.5, 1.2));
    });
  }
  /** 高い擦れ（雨・砂・葉）: ノイズを hp〜lp に。o.am で細かく粒立てる（低いノイズで音量を揺らす） */
  function lHiss(B, o) {
    const s = B.src(o.rate || 1), hp = B.filt('highpass', o.hp, 0.5), lp = B.filt('lowpass', o.lp || 9000, 0.5), g = B.gain(o.lvl);
    B.chain(s, hp, lp, g, o.to || B.bus);
    if (o.am) { const a = B.src(1), l = B.filt('lowpass', o.amF || 35, 0.7); B.chain(a, l, B.gain(o.am), g.gain); }
    if (o.walk) B.walk(g.gain, o.lvl * o.walk[0], o.lvl * o.walk[1], o.we || [0.4, 1.4], o.wtc || 0.25);
    return g;
  }
  /** 低い唸り（火山・地鳴り・洞窟の部屋の音） */
  function lRumble(B, o) {
    const s = B.src(o.rate || 0.4), l1 = B.filt('lowpass', o.f || 110, 0.7), l2 = B.filt('lowpass', (o.f || 110) * 1.7, 0.5), g = B.gain(0);
    B.chain(s, l1, l2, g, o.to || B.bus);
    B.walk(g.gain, o.lvl * (o.lo != null ? o.lo : 0.5), o.lvl, o.ge || [2, 6], o.gtc || 1.8);
  }
  /** 岸の波: 左右に 1 つずつ、寄せる（低いノイズが開いて大きく）→ 崩れて泡（高い擦れ、細かく粒立つ）→ 引く */
  function lSurf(B, o) {
    for (const side of [-0.4, 0.45]) {
      const p = B.pan(side);
      p.connect(B.bus);
      const s = B.src(0.8), lp = B.filt('lowpass', 350, 0.5), g = B.gain(0.0001);
      B.chain(s, lp, g, p);
      const s2 = B.src(1), hp = B.filt('highpass', 2800, 0.5), sh = B.filt('lowpass', 7000, 0.5), g2 = B.gain(0.0001), fz = B.gain(1);
      B.chain(s2, hp, sh, fz, g2, p);
      const a = B.src(1), al = B.filt('lowpass', 45, 0.7); B.chain(a, al, B.gain(2.5), fz.gain);   // 泡のはじける粒
      const top = o.muffled ? 650 : 1800;
      B.every(o.period, (t) => {
        const pk = o.lvl * B.rr(0.5, 1), rise = B.rr(1.8, 3.2), fall = B.rr(2.6, 4.5);
        g.gain.setTargetAtTime(pk, t, rise / 3); g.gain.setTargetAtTime(pk * 0.15, t + rise, fall / 3);
        lp.frequency.setTargetAtTime(top * B.rr(0.75, 1.2), t, rise / 3); lp.frequency.setTargetAtTime(320, t + rise, fall / 3);
        if (!o.muffled) { g2.gain.setTargetAtTime(pk * 0.5, t + rise * 0.85, 0.3); g2.gain.setTargetAtTime(0.0001, t + rise + 0.6, fall / 2.5); }
      }, side < 0 ? 0.05 : B.rr(2.5, 4.5));
    }
  }
  /** 雨: 細かい擦れ（高い所は落とす）＋地の胴＋雫（ノイズの粒、ときどき小さな「ぴちょ」） */
  function lRain(B, o) {
    lHiss(B, { hp: 2000, lp: 6500, lvl: o.lvl, walk: [0.7, 1.1], we: [1.5, 4], wtc: 1 });
    const s = B.src(0.9), bp = B.filt('bandpass', 700, 0.6);
    B.chain(s, bp, B.gain(o.lvl * 0.5), B.bus);
    const d = o.dens;
    B.every([0.2 / d, 1.8 / d], (t) => {
      const v = o.tick * (0.15 + 0.85 * Math.pow(B.r(), 2.5));
      if (B.r() < 0.1) B.tone(t, { f: B.rr(1700, 3000), f2: B.rr(1200, 1900), dur: B.rr(0.025, 0.05), vol: v * 0.4, pan: B.rr(-0.8, 0.8), a: 0.002 });
      else B.burst(t, B.rr(0.008, 0.03), { f: B.rr(1200, 3800), q: B.rr(1.2, 3), vol: v, pan: B.rr(-0.85, 0.85), a: 0.0015 });
    });
  }
  /** 火の粉のはぜる音: 2〜6 粒のかたまり（鋭い立ち上がり） */
  function lCrackle(B, o) {
    B.every(o.every, (t) => {
      const n = 2 + Math.floor(B.r() * 5), pan = B.rr(-0.7, 0.7), far = B.rr(0.4, 1);
      for (let k = 0; k < n; k++) B.burst(t + B.rr(0, 0.5) * (k ? 1 : 0), B.rr(0.008, 0.025), { f: B.rr(900, 2600), q: 0.8, vol: o.lvl * far * B.rr(0.3, 1), pan: pan + B.rr(-0.1, 0.1), a: 0.0008, to: o.to });
    });
  }
  /** 煮える溶岩のごぼっ: 下がる低い正弦（火山の中） */
  function lBloop(B, o) {
    B.every(o.every, (t) => {
      const f = B.rr(110, 200);
      B.tone(t, { f, f2: f * B.rr(0.45, 0.6), dur: B.rr(0.12, 0.22), vol: o.lvl * B.rr(0.5, 1), pan: B.rr(-0.5, 0.5), a: 0.01 });
    });
  }
  /** 鳥（昼）: 3 つの鳴き方を遠近・左右を変えてまばらに */
  function lBirds(B, o) {
    B.every(o.every, (t) => {
      const k = B.r(), pan = B.rr(-0.85, 0.85), v = o.lvl * B.rr(0.3, 1), base = B.rr(2400, 4300);
      if (k < 0.4) {   // さえずり: 下がる短い口笛 3〜6 音
        const n = 3 + Math.floor(B.r() * 4), step = B.rr(0.085, 0.15);
        for (let j = 0; j < n; j++) B.tone(t + j * step, { f: base * B.rr(1, 1.08), f2: base * B.rr(0.6, 0.82), dur: step * 0.75, vol: v * (1 - j * 0.08), pan, fm: B.rr(35, 60), fmd: 0.015 });
      } else if (k < 0.72) {   // 2 音の呼び（高い → 低い）を 1〜2 回
        let t0 = t;
        for (let r = 0, n = B.r() < 0.5 ? 2 : 1; r < n; r++, t0 += B.rr(0.6, 0.9)) {
          B.tone(t0, { f: base, f2: base * 1.06, dur: 0.17, vol: v, pan });
          B.tone(t0 + 0.24, { f: base * 0.8, f2: base * 0.75, dur: 0.22, vol: v * 0.85, pan });
        }
      } else {   // ふるえ声: 速く上がる短い音の連なり
        const n = 6 + Math.floor(B.r() * 7), step = B.rr(0.045, 0.07);
        for (let j = 0; j < n; j++) B.tone(t + j * step, { f: base * 0.9, f2: base * 1.25, dur: step * 0.6, vol: v * 0.65 * (j < 2 ? 0.6 : 1), pan });
      }
    });
  }
  /** 虫（夜）: 声ごとに 1 本の正弦を鳴らしっぱなし（音量 0）にして、パルスの組で鳴く。歌う ↔ 休むを繰り返す */
  function lCrickets(B, o) {
    for (let k = 0; k < o.n; k++) {
      const s = B.osc('sine', B.rr(4200, 5400)), g = B.gain(0), p = B.pan(B.rr(-0.8, 0.8));
      B.chain(s, g, p, B.bus);
      const v = o.lvl * B.rr(0.45, 1), pulses = 3 + Math.floor(B.r() * 3), pw = B.rr(0.018, 0.026), gap = B.rr(0.012, 0.02), period = B.rr(0.42, 0.85);
      const st = { on: false, until: B.t0 + B.rr(0, 3) };
      B.evs.push({ range: [period * 0.9, period * 1.3], next: B.t0 + B.rr(0, period), fn: (t) => {
        if (t > st.until) { st.on = !st.on; st.until = t + (st.on ? B.rr(1.5, 5) : B.rr(3, 10) / (o.dens || 1)); }
        if (!st.on) return;
        for (let j = 0; j < pulses; j++) {
          const a = t + j * (pw + gap);
          g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(v, a + pw * 0.35); g.gain.setTargetAtTime(0, a + pw * 0.6, pw * 0.25);
        }
      } });
    }
  }
  /** 遠くの蛙: のこぎり波を 2 つの声の帯（≈450 Hz・1.2 kHz）に通し、短いパルスの連なりで（ときどき 2 回） */
  function lFrogs(B, o) {
    B.every(o.every, (t) => {
      const c = B.c, f0 = B.rr(95, 150), pan = B.rr(-0.8, 0.8), v = o.lvl * B.rr(0.35, 1), n = 3 + Math.floor(B.r() * 5), rate = B.rr(11, 18);
      const f1 = B.rr(380, 520), f2 = B.rr(1000, 1400);
      let t0 = t;
      for (let r = 0, reps = B.r() < 0.5 ? 2 : 1; r < reps; r++) {
        const s = c.createOscillator(), b1 = c.createBiquadFilter(), b2 = c.createBiquadFilter(), g = c.createGain();
        s.type = 'sawtooth';
        s.frequency.setValueAtTime(f0, t0); s.frequency.linearRampToValueAtTime(f0 * 0.9, t0 + n / rate);
        b1.type = 'bandpass'; b1.frequency.value = f1; b1.Q.value = 5;
        b2.type = 'bandpass'; b2.frequency.value = f2; b2.Q.value = 6;
        g.gain.setValueAtTime(0, t0);
        for (let j = 0; j < n; j++) { const a = t0 + j / rate; g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(v, a + 0.01); g.gain.setTargetAtTime(0, a + 0.018, 0.014); }
        s.connect(b1); s.connect(b2); b1.connect(g); b2.connect(g);
        if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(B.ev); } else g.connect(B.ev);
        s.start(t0); s.stop(t0 + n / rate + 0.15);
        t0 += n / rate + B.rr(0.5, 1.1);
      }
    });
  }
  /** 水の音（泡・滴り）: 上がる短い正弦（当たりに小さな擦れ） */
  function lPlop(B, o) {
    B.every(o.every, (t) => {
      const f = B.rr(o.f[0], o.f[1]), pan = B.rr(-0.75, 0.75);
      B.tone(t, { f, f2: f * B.rr(1.5, 2.3), dur: B.rr(0.035, 0.07), vol: o.lvl * B.rr(0.35, 1), pan, a: 0.002, to: o.to, click: o.click ? o.lvl * o.click : 0 });
      if (B.r() < (o.twice || 0)) { const f2 = f * B.rr(0.8, 1.25); B.tone(t + B.rr(0.3, 1.4), { f: f2, f2: f2 * B.rr(1.4, 2), dur: 0.05, vol: o.lvl * B.rr(0.25, 0.6), pan: pan + B.rr(-0.2, 0.2), a: 0.002, to: o.to }); }
    });
  }
  /** 夜の深さで昼の鳥と夜の虫を分ける（どちらも i で密度） */
  function lLife(B, i, birdLvl, cricketLvl, sparse) {
    const day = 1 - B.night;
    if (day > 0.15) lBirds(B, { lvl: birdLvl, every: [3.5 / (day * (0.4 + 0.6 * i)) * sparse, 11 / (day * (0.4 + 0.6 * i)) * sparse] });
    if (B.night > 0.3) lCrickets(B, { lvl: cricketLvl * Math.min(1, B.night), n: B.night > 0.7 ? 2 : 1, dens: (0.4 + 0.6 * i) / sparse });
  }

  // ---- 床（spec.bed → 組み立て）。B.i = 強さ（音量は B.bus で済んでいる。ここでは密度・揺れの幅に使う）
  const AMB = {
    wind(B, i) { lWind(B, { f: [350, 900], g: [0.3, 1], ge: [1.2, 4], body: 0.5 }); },
    snow(B, i) { lWind(B, { f: [280, 650], lp: 1000, g: [0.3, 0.85], ge: [2, 6], gtc: 1.8, body: 0.2 }); },
    mist(B, i) {
      lWind(B, { f: [300, 700], lp: 1100, g: [0.25, 0.7], ge: [2.5, 6], gtc: 2, body: 0.35, lvl: 0.8 });
      lSurf(B, { lvl: 0.4, period: [7, 12], muffled: true });
    },
    breeze(B, i) {   // 風の木の葉: 風＋葉ずれ（突風に乗る、細かく粒立つ）、昼はまばらな鳥・夜はまばらな虫
      const vb = B.verb(0.5); if (vb) { const ev = B.gain(1); ev.connect(B.bus); ev.connect(vb); B.ev = ev; }   // 鳥・虫に野の響きを少し
      const G = lWind(B, { f: [300, 1100], g: [0.06, 1], ge: [1.4, 4.5], gtc: 0.9, body: 0.35, lvl: 0.85, couple: true });
      lHiss(B, { hp: 2200, lp: 4200, lvl: 0.05, am: 1.2, amF: 30, walk: [0, 1], we: [0.25, 0.9], wtc: 0.15, to: G });
      lLife(B, i, 1.1, 0.16, 1.4);
    },
    highwind(B, i) {   // 高地の夜空: 高く細い風（ゆっくり）と、遠いひゅう
      const s = B.filt('highpass', 220, 0.6);
      s.connect(B.bus);
      lWind(B, { f: [600, 1400], q: 0.6, lp: 2600, g: [0.2, 0.85], ge: [3, 7], gtc: 2.2, to: s });
      lWhistle(B, { f: [900, 1800], q: 7, lvl: 2, swell: [5, 11], pan: 0.3 });
    },
    blizzard(B, i) {   // 吹雪: 強く乱れる風＋雪の当たる粒立った擦れ（突風に乗る）＋ひゅうと鳴る 2 本＋重い胴
      const G = lWind(B, { f: [300, 1100], q: 0.7, g: [0.3, 1], ge: [0.45, 1.5], gtc: 0.3, body: 1.1, bodyF: 320, fe: [0.6, 2], ftc: 0.5 });
      lHiss(B, { hp: 3500, lp: 7000, lvl: 0.5, am: 5, amF: 70, to: G });
      lWhistle(B, { f: [450, 1000], q: 6, lvl: 5 * (0.5 + 0.5 * i), swell: [2, 5], fe: [0.8, 2], ftc: 0.6, pan: -0.45 });
      lWhistle(B, { f: [700, 1500], q: 6, lvl: 4 * (0.5 + 0.5 * i), swell: [2.5, 6], fe: [0.8, 2.2], ftc: 0.7, pan: 0.5 });
    },
    sandstorm(B, i) {   // 砂嵐: 風＋ざらつく砂の擦れ（どちらも突風に乗る。絵の風の帯と ambienceMod で合わせる）
      const G = lWind(B, { f: [220, 900], q: 0.7, g: [0.1, 1], ge: [1, 3], gtc: 0.7, body: 0.8, couple: true });
      lHiss(B, { hp: 1500, lp: 3400, lvl: 0.1, am: 4, amF: 45, to: G });
    },
    heat(B, i) {   // 陽炎: ほとんど聞こえない、ゆるく揺れる暖かい空気と、薄い高い気配
      const s = B.src(0.7), bp = B.filt('bandpass', 450, 0.5), g = B.gain(0);
      B.chain(s, bp, g, B.bus);
      B.walk(g.gain, 0.7, 1, [4, 9], 3);
      lHiss(B, { hp: 5000, lp: 8000, lvl: 0.08, walk: [0.4, 1], we: [4, 8], wtc: 3 });
    },
    rain(B, i) {   // 霧雨（島は岸の波を足す）
      lRain(B, { lvl: 0.4, tick: 1.4, dens: 12 + 20 * i });
      if (B.spec.surf) lSurf(B, { lvl: 0.9 * B.spec.surf, period: [6.5, 11] });
    },
    sea(B, i) {   // 海辺・船: 波（船の中はこもらせる）＋弱い風
      lSurf(B, { lvl: 1.2, period: [5.5, 11], muffled: !!B.spec.muffled });
      lWind(B, { f: [300, 800], g: [0.1, 0.4], ge: [2, 6], gtc: 1.6, lvl: 0.6, lp: B.spec.muffled ? 600 : null });
    },
    marsh(B, i) {   // 沼の霧: とても静かな低い空気＋遠い蛙・水の音、夜は虫を少し
      lRumble(B, { f: 320, rate: 0.6, lvl: 0.5, lo: 0.5, ge: [3, 7], gtc: 2.5 });
      lFrogs(B, { lvl: 1.4, every: [4 / (0.4 + 0.6 * i), 11 / (0.4 + 0.6 * i)] });
      lPlop(B, { lvl: 0.5, f: [500, 750], every: [5, 13], twice: 0.25 });
      if (B.night > 0.3) lCrickets(B, { lvl: 0.04, n: 2, dens: 0.5 });
    },
    ash(B, i) {   // 灰の荒野: 地鳴り＋弱い風＋舞う灰の薄い擦れ＋はぜる火の粉
      lRumble(B, { f: 140, rate: 0.4, lvl: 0.8, lo: 0.45, ge: [2, 5], gtc: 1.6 });
      const G = lWind(B, { f: [300, 800], g: [0.2, 0.65], ge: [2, 5], gtc: 1.4, lvl: 0.7 });
      lHiss(B, { hp: 3500, lp: 7000, lvl: 0.1, to: G });
      lCrackle(B, { lvl: 2.5, every: [0.6 / (0.3 + 0.7 * i), 9 / (0.3 + 0.7 * i)] });
    },
    forest(B, i) {   // 木漏れ日の森: そよ風＋葉ずれ、昼は鳥・夜は虫
      const vb = B.verb(0.6); if (vb) { const ev = B.gain(1); ev.connect(B.bus); ev.connect(vb); B.ev = ev; }
      const G = lWind(B, { f: [280, 900], g: [0.06, 0.6], ge: [2, 5.5], gtc: 1.4, lvl: 0.7, body: 0.3, couple: true });
      lHiss(B, { hp: 2200, lp: 5000, lvl: 0.06, am: 1, amF: 25, walk: [0, 1], we: [0.4, 1.2], wtc: 0.25, to: G });
      lLife(B, i, 1.3, 0.14, 0.7);
    },
    cave(B, i) {   // 洞窟・坑道: 低い部屋の音＋よく響く雫（まばら・不規則。墓は雫なし）
      const vb = B.verb(1.6), ev = B.gain(0.7);
      ev.connect(B.bus); if (vb) ev.connect(vb); B.ev = ev;
      lRumble(B, { f: 180, rate: 0.45, lvl: 1.2, lo: 0.6, ge: [3, 7], gtc: 2.5 });
      if (!B.spec.dry) lPlop(B, { lvl: 0.35, f: [700, 1900], every: [1.2 / (0.4 + 0.6 * i), 10 / (0.4 + 0.6 * i)], twice: 0.12, click: 0.5 });
    },
    volcano(B, i) {   // 火山の中: 深い地鳴り（ゆっくり膨らむ）＋まばらな火の粉と溶岩のごぼっ
      lRumble(B, { f: 85, rate: 0.3, lvl: 1.4, lo: 0.35, ge: [2.5, 6], gtc: 2 });
      lRumble(B, { f: 240, rate: 0.5, lvl: 0.35, lo: 0.3, ge: [3, 7], gtc: 2.5 });
      const vb = B.verb(1.2), ev = B.gain(1);
      ev.connect(B.bus); if (vb) ev.connect(vb); B.ev = ev;
      lCrackle(B, { lvl: 3, every: [2.5, 8] });
      lBloop(B, { lvl: 1.2, every: [5, 14] });
    },
  };

  const AS = { cur: null, want: null, key: '', mod: null };
  function ambSpec(spec) {
    if (!spec) return null;
    if (typeof spec === 'string') spec = { bed: spec };
    if (!AMB[spec.bed]) { warnOnce('amb:' + spec.bed, `audio: unknown ambience '${spec.bed}'`); return null; }
    return spec;
  }
  function ambKey(s) {
    if (!s) return '';
    const n = (v) => (v == null ? '' : (+v).toFixed(2));
    return [s.bed, n(s.i == null ? 1 : s.i), n(s.night), n(s.surf), s.dry ? 1 : 0, s.muffled ? 1 : 0, s.seed == null ? '' : s.seed].join('|');
  }
  function ambStart(fade) {
    if (!mx || !AS.want) return;
    AS.cur = new AmbBed(mx, ambBus(mx), AS.want, ctx.currentTime + 0.03, fade);
    if (AS.mod != null) AS.cur.mod(AS.mod);
    if (running()) AS.cur.schedule(ctx.currentTime + AMB_LEAD);
  }
  function ambPump(now) { if (AS.cur) AS.cur.schedule(now + AMB_LEAD); }
  function ambVol() {
    if (!mx) return;
    const g = ambBus(mx).gain, now = ctx.currentTime;
    holdParam(g, now);
    g.linearRampToValueAtTime(volCurve(vols.amb), now + 0.05);
  }
  function ambInit() { ambVol(); if (AS.want && !AS.cur) ambStart(1.5); }
  A.ambience = function (spec, o) {
    spec = ambSpec(spec);
    const key = ambKey(spec);
    if (key === AS.key) return false;
    AS.key = key; AS.want = spec;
    const fade = o && o.fade != null ? Math.max(0.02, +o.fade || 0) : AMB_FADE;
    if (!mx) return true;
    if (AS.cur) { AS.cur.stop(fade, ctx.currentTime); AS.cur = null; }
    if (spec) ambStart(fade);
    return true;
  };
  A.ambienceMod = function (v) {
    AS.mod = v == null ? null : +v;
    if (AS.cur) AS.cur.mod(AS.mod);
  };
  A.ambienceInfo = function () {
    const b = AS.cur;
    if (!b) return AS.want ? { bed: AS.want.bed, i: AS.want.i == null ? 1 : AS.want.i, alive: false, nodes: 0, srcs: 0 } : null;
    return { bed: b.name, i: b.i, alive: b.alive, nodes: b.nodes.length, srcs: b.srcs.length };
  };
  A.AMB_BEDS = Object.keys(AMB);
  A.AMB_TRIM = AMB_TRIM;
  A.renderAmbience = function (octx, spec, o) {
    o = o || {};
    const m = new Mixer(octx, octx.destination, { limiter: !!o.limiter });
    const bus = ambBus(m);
    bus.gain.value = o.volume != null ? o.volume : 1;
    const dur = o.dur || octx.length / octx.sampleRate, fade = o.fade != null ? o.fade : AMB_FADE;
    const a = new AmbBed(m, bus, ambSpec(spec), 0.02, o.fadeIn != null ? o.fadeIn : 0.05);
    const beds = [a];
    if (o.mod != null) a.mod(o.mod);
    if (o.at != null) {
      a.schedule(o.at);
      a.stop(fade, o.at);
      const s2 = ambSpec(o.to);
      if (s2) { const b = new AmbBed(m, bus, s2, o.at, fade); b.schedule(dur); beds.push(b); }
    } else a.schedule(dur);
    return { beds };
  };
})(window.RPG);
