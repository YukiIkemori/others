# Audio subsystem — porting note (Crest → Chronicle)

Scope: `src/core/audio.js` (1155 lines: synth, MML + chord/pattern arranger, instruments, echo, BGM/jingle/SFX
control, offline render hooks), `src/audio/{music,music_battle,music_dungeon,music_jingles,sfx}.js` (content), and
`tools/render_audio.js` (lint / render / WAV / stems / spectrogram). Owner in Chronicle: **audio (A17)**.

Status of the fork (checked 2026-09-25): `diff -rq` against `/tmp/claude-0/ref/rpg` is empty for all of these files.
`node tools/render_audio.js lint` → **all clean** (18 BGM + 9 jingles). `render --sfx --jingles` in headless Chromium
→ no clipping, no gaps. Playwright/Chromium works in this container (≈0.2 s per jingle, 3–5 s per BGM).
Line numbers below are for the current fork.

**Headline:** the audio code knows nothing about party size, jobs or status windows. Nothing in `audio.js` needs
to change for 4 members / no jobs / 9 slots / rows. What changes is (a) the **id lists** (kept in 3 places),
(b) how **callers** choose and sequence ids (battle rewards, drops, glimmer), and (c) **new content** (tracks,
jingles, SFX). The owner brief says BGM polish is low priority ("BGMの作り込みは…最低限でよい"): reuse Crest
tracks, add only what the new flow needs.

---------------------------------------------------------------------------------------------------
## 1. Data flow

```
callers ─► R.sfx(id) / R.bgm(id,o) / await R.jingle(id)      ns.js:106-112 (try/catch; no-op / resolved Promise
             │                                                  when R.Audio missing or not yet initialised)
             ▼
 R.Audio  (audio.js:1003)   module state (960-966): cur {id,pos} = what SHOULD play · pb = its Playback
             │               jin {pb,resolve,end,timer} = active jingle · stack[] ≤ 8 (pushBGM) · vols
             │
 compile(id) (408) ── cached per id; recompiles only if the DB.music[id] object is replaced (411)
   chords ─ parseProg (191) ──► spans [{tick,len,chord,sec}]
   ch[i].mml ─ parseMML (66) ──────────────┐
   ch[i].pat/pats ─ genChannel (318) ──────┼─► per-channel {events, loop, end}
   ch[i].harm ─ harmonize (378, 2nd pass) ─┘
   → jingle cut (433) → length/loop warnings (444) → tempo map (448-466) → metric accent (468)
   → song {events sorted by time, endSec, loop, loopSec, loopIdx, channels, echo, gain, warns}
             │
 Playback (813)  schedule() every 25 ms (setInterval in init 1022, TICK_MS 30), look-ahead 0.12 s (LOOKAHEAD 29)
   play(e) (863) → Mixer.voice(INST[e.inst] || INST.pulse) (710)   or   DRUMS[key] (794)
             │
 ch gain(vol) → StereoPanner(pan) → pb.out(gain = song.gain) → mx.music → warm LPF 11.5 kHz ─┐
     └ send(ch.echo) → per-track ping-pong echo (makeEcho 543, track.echo) → pb.out            ├→ master → limiter
 SFX: sfx(id) (1085) → playSfx (944) → Kit S → out(S.gain) → mx.sfxBus ──────────────────────┘  (thr −4 dB, 12:1)
                                            └ send(S.wet) → mx.sfxEcho (0.09 s, fb .3, wet .5, lp 4.5k)  → speakers
 setVolumes(bgm,sfx) (1096): mx.music / mx.sfxBus gain = v^1.5 (volCurve 959), 50 ms ramp
```

Time base: `TPW = 192` ticks per whole note (quarter 48, 8th 24, 16th 12, triplet 8th 16). `tempo` is always
**quarter-note BPM**, also in 6/8 (`sea` is `tempo:108, meter:'6/8'` = ♩=108, ♩.=72).

---------------------------------------------------------------------------------------------------
## 2. Runtime API — exact semantics

| call | line | behaviour | gotchas |
|---|---|---|---|
| `init()` | 1010 | creates AudioContext (first key/touch: `main.js:53` via `R.Input.onAnyPress`), Mixer, reads `R.Settings.bgmVolume/sfxVolume`, starts the 25 ms pump, suspends on `visibilitychange`, compiles all tracks in idle slices | in node there is no AudioContext → returns false; all calls stay no-ops (tests/sim are safe) |
| `playBGM(id,{fade})` | 1040 | `fade` in **frames**: old track fades f s, new one starts after f/2 and fades in f/2 | same id already current → no-op (position kept). Unknown id → one `R.warn`, **current music keeps playing**. Called during a jingle → only `cur` changes; the new track starts when the jingle ends |
| `stopBGM(frames)` | 1049 | `cur = null` + fade | during a jingle → silence after the jingle |
| `pushBGM(id)` / `popBGM()` | 1054 / 1064 | push saves `{id, pos}` of the current track (null if none), pop resumes from `pos` with 0.35 s fade-in and re-sounds held notes (`catchUp` 854) | **push kills an active jingle** (`finishJingle(jin,false)`, its promise resolves). Stack depth 8 |
| `playJingle(id)` | 1071 | saves BGM position, stops it (0.06 s), plays once, **resolves at the written end** (`endSec`), then fades the jingle tail 1.2 s and resumes `cur` with 0.5 s fade-in | a new jingle **cuts the previous one** (0.08 s). Resolves immediately if audio is locked (except 1.5 s grace after init). Safety timer `endSec + 3 s` for starved tabs. Playing a non-jingle track as a jingle plays it once through (61 s for `town`) |
| `sfx(id)` | 1085 | schedules the def 5 ms ahead | same id retriggered < 30 ms → dropped; > 3 live instances of one id → oldest killed (30 ms fade). Unknown id → warn once |
| `setVolumes(b,s)` | 1096 | 0..1; called by `menu_save.js:161` | defaults 0.6 / 0.7 (`save.js:17-18`, also `vols` 965) |
| `current`, `ready`, `context` | 1005 | `current` = logical BGM id (also while a jingle plays) | battle_scene uses `current` as fallback only |
| `debug()` / `info(id)` | 1107 / 1116 | state snapshot / `{duration, loopStart, loopEnd, loop, warns}` without audio | **compile warnings are silent at runtime** — only `info().warns` and `render_audio.js lint` show them |
| `renderTrack/renderSfx/renderNote` | 1123/1143/1149 | schedule into any (Offline)AudioContext, used by the tool | renderTrack plays intro + loop twice (`passes` 2) |
| exports | 1004 | `TPW INST DRUMS Mixer Playback compile playSfx parseMML parseProg parseChord meterTicks` | usable for custom offline checks (see §9.4) |

---------------------------------------------------------------------------------------------------
## 3. Call sites in the fork (Crest systems — all get rewritten, keep the audio behaviour in mind)

| where | what |
|---|---|
| `battle_scene.js:866-884` | BGM choice `o.bgm \|\| troop.bgm \|\| (eng.boss ? 'boss' : 'battle')` → `pushBGM`; `popBGM` in `finally`. Rare-monster fights (`o.rareMon`, 856) still use `'battle'` |
| `battle_scene.js:228/233` | boss intro `sfx('roar')`; rare monster: 2 gold flashes + `jingle('rare')` awaited together with 「めったに出会えない魔物が現れた！」 |
| `battle_scene.js:249` | defeat: `stopBGM(20)` (then GameOver plays `gameover`, `gameover.js:57-59`) |
| `battle_scene.js:317-325` | event `rare` → flash `#fff4b0` + `jingle('rare')` (not awaited); `victory` → `stopBGM(6)` + `jingle('victory')` (not awaited); `jingle` → `R.jingle(ev.id)` (not awaited); `gain` → `sfx(rare ? 'item' : 'steal')` |
| `battle_scene.js:345-380` | dmg on party → `hurt`/`poison` (window shake by `winFx[u.idx]` — visual only), on monster → `hit`; party KO `death`; boss `boss_die`; monster `enemy_die`; `miss`/`crit`/`status`/`buff`/`debuff`/`escape`/`jump`(cover) at 273-308 |
| `battle.js:911, 1076, 1102, 1112, 1124` | engine events: rare steal `{t:'rare'}`, `{t:'victory'}`, per-member `{t:'jingle',id:'levelup'}`, `{t:'jingle',id:'jobup'}`, rare drop `{t:'rare'}` |
| `battle_fx.js:893-901, 936-940` | FX kind → SFX table (`slash/pierce/strike → attack`, `claw/bite → enemy_attack`, element kinds → same-named SFX, `explosion → fire`, `drain/gravity → dark`, `heal/mp/cure/regen → heal`, `smoke → escape`, `grow → item`, …); `ELEM_FX` 895 maps element → kind; breath variants 644-648 |
| `field.js:229, 292, 734`; `field_map.js:13, 38` | map `bgm` (default per type: world→overworld, town→town, castle→castle, dungeon→dungeon, shrine→shrine, else `town`); ship → `sea` |
| `field.js:234, 264, 268, 304, 362-364, 643-685, 812, 845` | bump (every 20 frames), locked, door, step_damage, stairs/warp (`warp.sfx` override), chest + `gotItem(…, key ? 'keyitem' : 'item')`, gold, teleport, warp |
| `events_runtime.js:56-58, 105, 150-156, 272, 300` | `gotItem` = message + jingle in parallel; `give` picks `keyitem`/`item`; `ev.sfx/bgm/jingle` (`ev.bgm()` without id restores the map track); inn/save jingles |
| `shop.js:261`, `menu_save.js:196`, `menu_jobs.js:266`, `title.js:228/333`, `ending.js:224/244`, `postgame_scene.js:533-540` | inn, save, **jobup**, title, ending |
| menus (`menu*.js`, `nameentry.js`, `shop.js`, `title.js`) | `cursor confirm confirm_soft cancel buzzer menu_open item gold heal revive magic buff` |

---------------------------------------------------------------------------------------------------
## 4. Track format (`R.DB.music[id]`)

### 4.1 Track fields
`{ tempo, meter:'4/4'|'3/4'|'6/8'|'12/8'|…, key:'D'|'F#m'|'Bb'…, gain, jingle?:true, loop?:false,
echo:{time, fb, wet, lp}, defs:{name:'mml or chord text'}, chords:'…', ch:[…] }`
* `key` (regex `^[A-G][#b]?m?$`, 374) feeds the diatonic scale for pattern `A` and for harmony fallbacks. Missing →
  C major (wrong accidentals in harmony voices). Modes are not supported: pick the relative major/minor (`pyramid`
  uses `key:'Am'` for its E-phrygian-dominant colour).
* `gain`: per-track loudness trim (set from `render --suggest`, §10). `echo`: per-track ping-pong delay; channels opt
  in with `echo:<send 0..1>`.
* `loop:false` disables looping and silences loop-point warnings for hand-written parts without `L`.

### 4.2 Channel kinds (`ch[i]`, index = channel number used in warnings `id#i`)
| kind | fields | notes |
|---|---|---|
| hand-written | `inst, vol, pan(-1..1), echo, q?, mml` | `inst:'drums'` switches the parser to drum letters |
| arranged | `inst, vol, pan, echo, pat?:'…', pats?:{sec:'…'}, range:[lo,hi] (midi, default [48,72]), voices (3), q (8), v (12)` | follows the chord line; `pat` = initial pattern, `pats[sec]` switch at `@sec` in the chords; a section key missing from `pats` keeps the current pattern; `''` = silent |
| harmony | `inst, vol, pan, echo, harm:<src ch index>, below:[3,9], oct, min, minLen(24), v` | one chord tone 3..9 semitones under each note of the source channel (short notes: ≤5 below or a non-clashing diatonic 3rd); `oct` shifts, `min` raises by octaves; instrument is fixed (ignores the source's `@inst`) |
| any | `noLint:true` | excluded from the tool's harmony checks only |

### 4.3 MML (parseMML 66-173, header 13-19)
`c d e f g a b` + `+`/`#` sharp, `-` flat · `r` rest · length `1 2 3 4 6 8 12 16 24 32 48 64 96 192` (must divide
192, else "odd length") or `%ticks`, dots `.`/`..` · `^len` extends the previous note · `&` tie/legato into the next
note · `o4 > <` octave (`o4 c` = C4 = midi 60) · `l8` default length · `q1-8` gate (default 7 = 7/8 of the length) ·
`v0-15` velocity (default 12; 12 = instrument's calibrated level) · `@inst` switches instrument mid-channel (channel
vol/pan/echo stay) · `k±n` transpose · `t120` tempo change (**global**: merged into one tempo map) ·
`{ceg}4` chord (`> < o` inside are local) · `[ … : … ]n` loop (default 2; the part after `:` is skipped on the last
pass) · `L` loop point · `|` bar check · `;` comment · `$name` macro from `defs`.
Drum channel letters (`DRUM_KEYS` 32, kit 794-810): `k` kick `s` snare `h` hat `o` open hat `c` crash `t m f` toms
(hi/mid/floor) `x` rim `z` shaker `p` clap `b` orchestral bass drum `g` gong `w` woodblock `i` triangle; `{kc}` = hits
together; `v`, `l`, `q`, `r`, `L`, `[ ]`, `$` work; **`o c t k` are drums here, not octave/tempo/transpose**.

### 4.4 Chord line (parseProg 191-218; QUAL 176-182)
Bars separated by `|`, chords inside a bar split it equally or by weights `C*3 G` (¾ + ¼) · `%` repeats the previous
bar · `x` silence · `L` loop point (must start a bar) · `@sec` before a chord switches arranged channels to
`pats[sec]` from that chord on · macros `$CA` work (the title/ending share `THEME_CHORDS`).
Qualities: `'' m 5 7 M7 maj7 m7 mM7 dim dim7 m7b5 aug sus4 sus2 6 m6 add9 madd9 9 m9 M9 7sus4 7b9 69`, slash bass
`D/F#`. Anything else → "bad chord" warning and the span becomes silent.

### 4.5 Patterns (parsePat 219, resolveTok 291)
`R` bass (placed nearest the previous bass inside `[lo, max(lo+11, hi−12)]`) · `T` 3rd `F` 5th `S` 7th/6th (octave
if triad) `N` 9th `O` octave above bass · `A` diatonic approach note into the next chord's bass · `a b c d e f`
voiced chord tones low→high (from a `voices`-note voicing with minimal motion, `voiceChord` 255) · `C` the whole
voicing · `r` rest · `'` / `,` octave up/down · lengths as MML (default 8th), `l`, `q` · `!` accent (+3 velocity).
Patterns cycle through the section; a long token that crosses a chord change re-strikes on the new chord (359).

### 4.6 Compile-time rules (warnings)
Every channel must have the same total length (444: "length X ≠ Y ticks"); every hand-written channel of a looping
track needs `L` at the same tick as the chord line (446); `|` must fall on bar lines; jingles (`jingle:true`) end
where the **hand-written parts** end — arranged/harmony parts are truncated there (433-441) and never loop. The
metric accent multiplies velocity: downbeat 1.08, beat 1.0, off-beat 8th 0.92, else 0.86 (468-469).

---------------------------------------------------------------------------------------------------
## 5. Instruments, drums, echo

`INST` (499-530): `env [a, d, s, r]`, `lp {f, q, env:[peakHz, a, d]}`, `vib [rate, cents, delay]`, `fm [ratio,
index, modDecay]`, `osc [{w, det, mul, vol, dec}]`, `pitch` (timp), `thump`. Waves: `sine square sawtooth triangle`,
pulse `p50 p25 p12` (PULSE 540) and harmonic tables `flute organ harp bass choir clar` (WAVES 532).

| group | instruments (tool range, midi) |
|---|---|
| leads | `square pulse thin` (48-96) chip leads · `flute` (60-98) `oboe` (58-91, p12 + LP) `clarinet` (50-91) · `trumpet` (54-89) `brass` (46-82) `horn` (41-77) · `violin` (55-96) |
| pads | `strings` (43-91) `pad` (40-84) `choir` (48-81) `organ` (36-91) |
| plucked / struck | `harp` `pizz` `harpsi` `guitar` · `bell` (60-100) `celesta` (60-108) `marimba` (45-96) `glock` (72-108) — FM/partials |
| bass / perc | `bass` `tri` (triangle bass) `synbass` `contra` (bowed) `timp` (36-58) · `drums` |

An unknown channel `inst` is **silent at compile time** and plays as `pulse` (867); only `@inst` inside MML warns.
New instrument = add to `INST` (+ `WAVES` for a custom harmonic table), add its range to `RANGE` in
`render_audio.js:39-46`, calibrate `vol` with `node tools/render_audio.js inst` (peak/RMS per instrument).
Drums (`DRUMS` 794) are functions `(mixer, dest, time, vel)` built from `m.tone/m.noise/m.fm` — the same
primitives as SFX.

---------------------------------------------------------------------------------------------------
## 6. SFX engine (Kit 916-943, playSfx 944, content `src/audio/sfx.js`)

`R.DB.sfx[id] = (S) => { … }` (or `{play(S)}`). All times in **seconds from the trigger**; `n` = midi, `f` = Hz.
* `S.tone({w, n|f, n2|f2 (glide target), sd (glide time, default d), lin, t, a (2 ms), d (hold 0.1), r (release 0.04),
  decay (true|ratio → exponential over d), vol (0.3), det (cents), vib:[rate, cents], lp|hp|bp (+ lp2… sweep over
  fd), q})` — `w` any wave name above incl. `p25`, `flute`…
* `S.noise({…same envelope/filters, rate, rate2})` — `rate < 1` = darker (playbackRate of 1.5 s white noise).
* `S.fm({n|f, n2, ratio (2), index (2), md (mod decay 0.3), …envelope})` — bells, chimes, gongs.
* `S.seq(notes, step, toneOpts)`, `S.bells(notes, step, fmOpts)` (null = skip), `S.drum(key, t, vel)`,
  `S.inst('harp', midi, t, dur, vel)` (music instruments in SFX), `S.wet(send)` (default 0), `S.gain(v)` (absolute).
* Loudness: `sfx.js:252-262` wraps listed ids with `S.gain(GAIN[id])`; peak targets (comment 251): UI ≈ −12 dBFS,
  spells ≈ −9…−6, impacts ≈ −3. A new file cannot add to that private table → call `S.gain()` inside the def.
* Layering existing defs works: `R.DB.sfx.ice(S)` inside another def; to delay one, shift `S.t0` temporarily
  (verified, §9.4). The wrapped defs call `S.gain()` too — **call your own `S.gain()` last**.

---------------------------------------------------------------------------------------------------
## 7. Catalogue (what exists now)

### 7.1 BGM (18) — `music.js`, `music_battle.js`, `music_dungeon.js` (def line in brackets)
| id | key · meter · ♩ | length / loop | mood & scoring |
|---|---|---|---|
| `title` [music:26] | D · 4/4 · 88 | 81.8 s, loop 10.9→ | heroic-nostalgic; horn call → Crest main theme 「ひかりの もんしょう」 (THEME 10-20) on violin → flute bridge → trumpet |
| `overworld` [55] | F · 112 | 72.9 s, loop 4.3→ | bright march; trumpet/flute over pizz, strings, snare |
| `sea` [207] | A · 6/8 · 108 | 56.7 s, loop 3.3→ | sailing lilt; harp rolls, flute/oboe/violin |
| `town` [95] | G · 126 | 61.0 s | lively; flute/clarinet/oboe, guitar chops, marimba 3rds, walking bass, shaker/rim |
| `village` [123] | C · 3/4 · 96 | 60.0 s | pastoral waltz; flute/oboe, rolling harp |
| `castle` [151] | B♭ · 84 | 74.3 s, loop 5.7→ | regal; trumpet/horn, harpsichord, timpani, snare ruffs |
| `shrine` [186] | A · 60 | 64.0 s | sacred calm; choir, organ, bells, harp (no drums) |
| `ending` [239] | D · 75→96→84→66 | 89.1 s (loops) | main-theme reprise, tender then triumphant, broad close |
| `dungeon` [dungeon:10] | Dm · 100 | 57.6 s | tense; pizz ostinato, oboe with chromatic neighbours, tom heartbeat |
| `cave` [38] | Em · 72 | 53.3 s | sparse, echoing; flute, celesta/marimba drips, drone, far boom |
| `tower` [63] | Bm · 108 | 53.3 s | mysterious, rising; climbing celesta arps, violin, clock rims |
| `pyramid` [86] | Am (E phrygian dom.) · 96 | 60.0 s | desert; oboe with aug. 2nd, drone, darbuka-like toms |
| `ice` [115] | F♯m · 3/4 · 84 | 51.4 s | crystalline; celesta+glock melody, harp, bells, triangle |
| `volcano` [142] | Cm · 140 | 58.3 s, loop 3.4→ | driving/heavy; synth bass, brass, string stabs, toms |
| `lastdungeon` [181] | Gm · 76 | 75.8 s | dark, grand; organ over chromatic descending bass, choir, gong |
| `battle` [battle:9] | Em · 164 | 49.8 s, loop 2.9→ | normal fight; pulse lead, synbass, string stabs |
| `boss` [54] | Cm · 150 | 57.6 s, loop 6.4→ | intense; trumpet/brass over pounding riff (Neapolitan D♭) |
| `lastboss` [96] | Dm · 158 | 60.8 s, loop 6.1→ | epic 4-section; organ/choir intro, main theme in minor |

### 7.2 Jingles (9) — `music_jingles.js`
| id | line | key · ♩ | dur | description / current use |
|---|---|---|---|---|
| `victory` | 9 | G · 144 | 4.2 s | trumpet fanfare, rising arpeggio + bright close — battle won |
| `levelup` | 24 | B♭ · 160 | 2.3 s | square arpeggio up + snappy turn — each member's level up |
| `jobup` | 39 | D lydian · 112 | 3.2 s | celesta/bells climbing to high F♯ — **Crest job level; Chronicle: remove id or re-purpose** |
| `item` | 54 | C · 140 | 1.7 s | "got it!" flourish — chests, `ev.give` |
| `keyitem` | 68 | E♭ · 116 | 5.2 s | grand brass fanfare — key items |
| `inn` | 84 | F · 3/4 · 88 | 6.1 s | flute/harp lullaby — inn, `ev` inn |
| `save` | 99 | G · 108 | 3.3 s | organ + bell cadence — save |
| `gameover` | 113 | Am · 72 | 6.7 s | falling oboe over dark strings — wipe |
| `rare` | 128 | E · 150 | 2.4 s | glock run + bright chord — rare monster appears, rare drop, rare steal |

### 7.3 SFX (48) — `sfx.js` (audible length from `render --sfx`)
UI: `cursor` 13 tiny rising p25 blip (0.05 s) · `confirm` 14 two-note "pi-pin" G5→D6 (0.4 s) · `confirm_soft` 19
soft triangle tick (0.07 s) · `cancel` 20 falling G5→C5 (0.15 s) · `buzzer` 24 low beating double buzz (0.18 s) ·
`menu_open` 30 4-note rising arpeggio (0.4 s).
Physical: `attack` 33 band-pass swoosh (0.11 s; every party slash/pierce/strike) · `hit` 34 thud + sine drop on a
monster (0.11 s) · `crit` 39 heavier thud + FM ping (0.43 s) · `miss` 46 airy high swoosh · `enemy_attack` 47
lower swoosh + saw growl (claw/bite) · `hurt` 51 square drop + thump on a party member (0.14 s).
Magic: `magic` 58 rising p25 arpeggio + bell (0.6 s; generic/non-elemental, dispel, scan, song) · `fire` 63 roaring
noise whoosh + crackles (0.65 s; also explosion) · `ice` 70 six FM crystal pings + hiss (0.67 s) · `thunder` 77 crack
+ long rumble (≈1 s) · `wind` 84 two band-pass sweeps up/down (0.76 s) · `holy` 89 triangle chord swell + bell
sparkle (0.9 s) · `dark` 95 detuned low saw drone + wobble (0.75 s; also drain/gravity) · `earth` 102 rumble + sine
drop + rock clatter (0.66 s) · `water` 108 rising sine bubbles + wash (0.67 s).
Recovery/status: `heal` 115 triangle arpeggio + 2 bells (0.67 s; heal/mp/cure/regen) · `revive` 120 long arpeggio +
shimmer chord + bells (1.1 s) · `buff` 126 two rising sweeps · `debuff` 131 two falling sweeps · `status` 136
warbling downward pair (paralyze/confuse/silence/blind) · `poison` 141 bubbly p12 wobble · `sleep` 147 three soft
falling sines · `death` 151 low FM toll + falling pulse (0.93 s; KO and instant death).
Defeat: `enemy_die` 159 falling p50 900→110 Hz + noise (0.56 s) · `boss_die` 164 six descending blasts + rumble +
falling whistle (1.9 s) · `escape` 173 falling run + swoosh (party escape, monster flee, smoke).
Field: `stairs` 179 four descending taps · `door` 185 creak + thud · `locked` 190 rattles + clunk · `chest` 194 lid
creak + thud + 2 bells · `item` 200 two FM bells (menu use/buy/equip, rare gain) · `gold` 201 coin pings ·
`step_damage` 207 short zap · `ship` 211 sea swell + low horn fifth · `bump` 217 dull wall bump · `warp` 218 rising
sine glide with vibrato (0.9 s) · `teleport` 224 three arpeggio bursts + glide · `steal` 229 swipe + two high blips ·
`jump` 234 rising pulse glide + swoosh (also cover) · `breath` 235 long filtered-noise roar · `roar` 240 two
vibrato saws + noise (boss intro) · `shake` 246 eight rumble bursts + sub drone (earthquake events).

Id overlaps: `ice` is a BGM **and** an SFX, `item` is a jingle **and** an SFX (the registries are separate;
only the render tool needs `--sfx` to pick the SFX, §10).

---------------------------------------------------------------------------------------------------
## 8. Crest-specific parts and what must change for Chronicle

1. **Id lists live in 3 places**: DESIGN §3 (contract), `tools/render_audio.js:29-34` (`BGM`, `JINGLES`, `SFX` —
   drives `lint`'s "missing" check, the jingle/BGM classification and the default render set) and the ref's
   `tools/validate.js:34-36` (+ source-text checks 254-256, registry checks 273-278; not yet copied to the fork).
   Every id change must touch all three. Draft `design/drafts/01_engine.md` §3.3 already lists the Chronicle ids:
   BGM keep all 18 + new `tavern home rival tension sorrow boss2 rarebattle superboss postgame`; jingles keep
   `victory levelup item keyitem inn save gameover rare`, **drop `jobup`**, new `superrare chapter recruit`; SFX keep
   all 48 + new `glimmer light freeze burn quill page swap golden`.
2. **`jobup`** is job-only: callers `battle.js:1112`, `menu_jobs.js:266` disappear with the job system. Remove the
   id from the lists; keep the definition as material (its bell/celesta climb suits `chapter` or `recruit`: copy it
   under the new id and change the melody, do not alias — two ids with the same music would feel cheap).
3. **Level-up spam with 4 members**: `battle.js:1102` yields one `levelup` jingle per member (each cuts the previous
   one, `playJingle` 1075). With 4 fighters (+ reserves at 60 % EXP) play it **once** before listing all level-ups,
   and never for reserve members.
4. **Victory / drop jingles cut each other**: victory (4.2 s) is not awaited (`battle_scene.js:323`); a fast player
   reaches the drop, whose `rare` jingle cuts the fanfare. `stopBGM(6)` before victory sets `cur = null`, so nothing
   resumes until `popBGM`. For Chronicle's `drop {grade}` event: `normal` → `sfx('item')`, `rare` → `jingle('rare')`,
   `super` → `await jingle('superrare')` (await it: it is the showcase moment) and let the message wait for it.
5. **Glimmer (閃き) is new**: engine event `glimmer {u, id, kind}` (draft §5.7) → scene `R.sfx('glimmer')`, flash
   that member's window, big name banner, **wait ≈ 30–36 frames** before the replaced action's own `fx` event, else
   `attack`/`fire` masks the ピコーン. It is an SFX, not a jingle: battle BGM keeps running. Measured (§9.3): the
   calibrated `glimmer` adds ≈ +2 dB broadband over the `battle` loop at default volumes and its energy sits at 1.3/2.6 kHz,
   at and above the top of the lead line — clearly audible. If play-testing wants more, add a short BGM duck instead of more SFX gain
   (the master limiter at −4 dBFS flattens louder SFX). Duck sketch (audio.js, owner audio): in `Mixer` insert
   `this.duckG = ctx.createGain()` between `this.music` and `warm` (579-581); `R.Audio.duck(db, frames)` =
   `holdParam(g, now); g.linearRampToValueAtTime(10**(db/20), now+0.03); g.setValueAtTime(10**(db/20), now+frames/60);
   g.linearRampToValueAtTime(1, now+frames/60+0.25)`.
6. **Elements**: Chronicle's 6 are 火水風土光闇. `battle_fx.js:895` maps `holy` (not `light`) and the keyword table maps
   'light'→holy. If the element id is `light`, either map it there or register `light` (draft: new SFX `light`,
   fallback `holy`). Draft `elements[el].sfx` should be consulted before `SFX[kind]` in `battle_fx.play` (936).
   Composite spells: reuse `ice` (吹雪), `thunder`, or layer (§9.4); new `freeze`/`burn` for status-adding composites.
7. **Rare / golden encounters**: rare fights currently use `'battle'` (868); draft wants `rarebattle` for rare
   monsters and golden variants → add `o.rareMon || golden ? 'rarebattle'` to the choice. Golden appearance: new
   `golden` SFX (sparkle) at battle start; keep the `rare` jingle for true rare monsters.
8. **Chests / `ev.give` with rarity**: `field.js:659/685` and `events_runtime.js:105` choose `keyitem`/`item` by
   `it.type`; extend to `it.grade` (`super` → `superrare`, `rare` → `rare`, else `item`).
9. **World map music**: one map = one `bgm`. RS1-style regional field themes on a single world map need a
   field-side change (e.g. `zones[].bgm` checked on step; `playBGM` with the same id is a cheap no-op, use
   `{fade:30}`). Otherwise keep `overworld`.
10. **Main theme**: `title`/`ending` are the Crest theme. Chronicle (series #2) may keep them for now; the draft's
    "light connection to Crest" can quote `THEME.TA` (music.js:10) in a legend scene. A new Chronicle main theme is
    a later polish item.
11. **3 party members / 3 windows / 9 slots / rows**: no audio dependency. `winFx[u.idx]` flashes are visual.

---------------------------------------------------------------------------------------------------
## 9. Recipes (all three examples below were compiled, linted and rendered to WAV in a scratch copy)

Put Chronicle content in new files, e.g. `src/audio/music_chronicle.js`, `src/audio/jingles_chronicle.js`,
`src/audio/sfx_chronicle.js`: IIFE, register only (`Object.assign(R.DB.music, M)` / `Object.assign(R.DB.sfx, X)`).
Files in `src/audio` load alphabetically and **a later file silently overwrites an existing id** — never reuse an
id; edit the Crest file in place when rewriting a Crest track. `build.js` picks new files up automatically; a file
with a syntax error is dropped from the build (all its ids become "unknown").

### 9.1 New BGM — `tavern` (酒場・仲間選び)
Order of work: chords first (form, sections, `L`), then the melody with `|` bar checks, then harmony / pads / bass
patterns, then drums. Keep every channel exactly the same length; put `L` in every hand-written channel.
```js
M.tavern = {
  tempo: 116, meter: '6/8', key: 'D', gain: 0.95,            // gain from `render tavern --suggest` (was 0.8)
  echo: { time: 0.26, fb: 0.25, wet: 0.2, lp: 3200 },
  chords: `L D | G/D | D | A7 | D | G | Em7 A7 | D |`,
  defs: { TD: 'k8 z8 z8 x8 z8 z8 |' },                         // 1 bar of 6/8 = 144 ticks
  ch: [
    { inst: 'flute', vol: 1, pan: 0.1, echo: 0.25, mml: `
      L o5 q6 d8 f+8 a8 f+4 d8 | g4. b4 g8 | f+8 a8 d8 f+4 a8 | e4. c+4. |
      d8 f+8 a8 >d4 <a8 | b4 g8 d4 g8 | e8 g8 b8 a8 g8 e8 | f+4. d4. |` },
    { inst: 'clarinet', harm: 0, vol: 0.4, pan: -0.3, echo: 0.2 },                 // harmony under ch0
    { inst: 'guitar', vol: 0.4, pan: 0.35, echo: 0.1, q: 4, range: [55, 71], voices: 3, pat: 'l8 r C C r C C' },
    { inst: 'bass', vol: 0.65, q: 6, range: [36, 55], pat: 'l4. R F,' },
    { inst: 'drums', vol: 0.5, echo: 0.05, mml: 'L [$TD]8' },                     // `]` ends the macro name
  ],
};
```
Result: `✓ tavern 12.4s loop 0.0→12.4 bars 8`, render `lufs −18.5 → gain 0.80→0.95`, seam −22/−19 dB, no clip.
Then: add `tavern` to the 3 lists (§8.1), use it via map `bgm:'tavern'` or `ev.bgm('tavern')` / `ev.bgm()` to
restore. A real track should be 16–32 bars (40–90 s loop) with an A/B contrast (`@A`/`@B` + `pats`).

### 9.2 New jingle — `superrare` (超レア入手 fanfare, ≈3.3 s)
`jingle:true`, no `L`; the hand-written parts define the end, arranged parts are cut there. Keep top notes of `glock`
≤ E7 (its 5.4× partial exceeds 16 kHz in the 32 kHz render and Chromium warns "frequency … clamped").
```js
M.superrare = {
  jingle: true, tempo: 144, key: 'A', gain: 0.85,
  echo: { time: 0.227, fb: 0.35, wet: 0.3, lp: 5000 },
  chords: 'A D/A | E A |',
  ch: [
    { inst: 'trumpet', vol: 1, pan: 0.05, echo: 0.3, mml: 'o4 q7 e8 a8 >c+8 e8 d4 f+4 | e8. d16 c+8 <b8 q8 >c+2 |' },
    { inst: 'horn', harm: 0, oct: -1, min: 48, vol: 0.5, pan: -0.3, echo: 0.25 },
    { inst: 'glock', vol: 0.5, pan: 0.35, echo: 0.4, mml: 'o6 l32 e a >c+ e r8 r4 r2 | o6 r2 l16 c+ e a >c+ e4 |' },
    { inst: 'strings', vol: 0.45, pan: 0.3, echo: 0.25, pat: 'C2', range: [55, 74], voices: 3 },
    { inst: 'bass', vol: 0.75, q: 6, range: [36, 52], pat: 'l4 R R R R' },
    { inst: 'drums', vol: 0.5, echo: 0.15, mml: '{kc}4 r4 s8 s8 s4 | k4 s16 s16 s8 {ic}2 |' },
  ],
};
```
The first draft used `E/A`; `lint` flagged `clash: b2:1.00 ab4(ch3) vs a2(ch4) over E/A` (G♯ against the A bass) —
fixed with `E`. Result: `✓ superrare 3.3s bars 2`, `lufs −16.6`, peak −4.3, suggested gain 0.85.
Add `superrare` to `JINGLES` in `render_audio.js:30` (otherwise the tool treats it as BGM: −17 LUFS target and
BGM gap scan), DESIGN §3 and validate.js. Call: `await R.jingle('superrare')` (battle `drop` grade `super`,
chests with a super-rare item).

### 9.3 New SFX — `glimmer` (閃き「ピコーン」)
Short bright pulse blip = ピ, then a ringing FM bell an octave up = コーン (E6 → E7), air noise, echo send.
```js
X.glimmer = (S) => {
  S.gain(1.9);   // calibrated: peak ≈ −6 dBFS (was −11.7 at gain 1)
  S.tone({ w: 'p25', n: 88, d: 0.035, r: 0.02, vol: 0.12, lp: 7000 });                        // ピ
  S.fm({ n: 100, t: 0.06, ratio: 3.5, index: 1.6, md: 0.25, d: 0.01, r: 0.9, vol: 0.14 });   // コーン
  S.tone({ w: 'triangle', n: 100, t: 0.06, a: 0.005, d: 0.05, r: 0.7, vol: 0.1, vib: [6, 8] });
  S.noise({ t: 0.06, d: 0.02, r: 0.25, vol: 0.05, hp: 8000 });
  S.wet(0.45);
};
```
Result: `✓ sfx glimmer peak −5.9 audible 0.74s`; spectrogram shows the 1.3 kHz blip then a 2.6 kHz ring.
Mixed offline over `battle` at default volumes (bgm 0.6, sfx 0.7): window RMS −22.8 → −20.6 dB.
Make it original, not a copy of RS2's sound: keep your own interval/timbre. Add `glimmer` to the SFX list
(`render_audio.js:31-34`, DESIGN, validate.js).

### 9.4 Composite SFX and custom offline checks
```js
X.blizzard = (S) => { R.DB.sfx.ice(S); const t = S.t0; S.t0 += 0.25; R.DB.sfx.wind(S); S.t0 = t; S.gain(1.2); };
```
(verified: renders 1.0 s, peak −7.1). For a mix test, a page can use the exports directly:
`new R.Audio.Mixer(ctx, ctx.destination, {})`, `new R.Audio.Playback(m, R.Audio.compile('battle'), {dest: m.music,
at: 0.05, pos: 5}).schedule(7, 0)`, `R.Audio.playSfx(m, R.DB.sfx.glimmer, 3)`.
Quick audition in the browser: `debug.html` console → `R.Audio.init(); R.bgm('tavern'); R.sfx('glimmer');
R.jingle('superrare')`; `R.Audio.debug()` shows state.

---------------------------------------------------------------------------------------------------
## 10. `tools/render_audio.js` — checking without ears

Loads only `src/core/ns.js`, `src/core/audio.js`, `src/audio/*.js` (25-28): content defined elsewhere is invisible to
the tool, and audio files must not depend on other modules at load time.

| command | what it does |
|---|---|
| `node tools/render_audio.js lint [ids…] [--verbose]` | node only (vm). Compile warnings, instrument ranges (`RANGE` 39-46), harmony: non-chord tones on strong beats (count; listed with `--verbose`), **semitone clashes between channels (count as problems)**; reports ids of the lists missing from the registries. Exit code 1 on problems. Default = all BGM + jingles |
| `… show <id> [ch]` | bar-by-bar chords + notes (`d5/24` = D5 for 24 ticks), `L` marks the loop bar |
| `… render [ids…] [--bgm] [--jingles] [--sfx] [--wav] [--suggest]` | headless Chromium (Playwright from `require('playwright')` or `/opt/node22/lib/node_modules/playwright`), `OfflineAudioContext` 2 ch **32 kHz**. BGM: intro + 2 loop passes; prints `dur` (loop length) `peak rms lufs st[min,max]` (0.4 s windows) `seam before/after` (loop join) `clip gaps` and `gain cur→suggested` (targets BGM −17 LUFS, jingles −16, peak < −1.5 dBFS pre-limiter). `✗` on clipping, peak > −0.5 or ≥ 0.5 s silence. `--wav` writes 16-bit stereo `/tmp/claude-0/audio/<kind>_<id>.wav` (trimmed to the audible tail + 0.1 s); `--suggest` prints a JSON of gains to paste into `gain` |
| `… stems <id>` | loudness of each channel alone (`only` filter, Playback 864) — mix balance |
| `… spectro <id> [secs]` | log-frequency spectrogram + envelope → `/tmp/claude-0/audio/spec_<id>.png`; **look at it with Read** |
| `… inst` | peak/RMS of every instrument and drum (calibration after editing `INST`) |

Classification of explicit ids (351-352): SFX if it exists in `DB.sfx` and not in `DB.music` (or `--sfx` given);
`jingle` only if listed in `JINGLES`; everything else is treated as BGM. So: `render ice` renders the **BGM**,
`render ice --sfx` the SFX; `render item` the jingle; a new jingle missing from `JINGLES` gets BGM targets.
Output dir `/tmp/claude-0/audio` is hard-coded (24) and shared by parallel agents (same file names overwrite);
the harness page `harness.html` is rewritten on each run (same content). WAVs at 32 kHz lack content above 16 kHz —
fine for checks. Typical workflow for any new id:
`lint <id>` → `show <id> 0` → `render <id> --wav --suggest` → set `gain` → `stems <id>` → `spectro <id> 10` → Read PNG.

---------------------------------------------------------------------------------------------------
## 11. Gotchas (collected)

1. Compile warnings never surface in the game; a wrong bar length just drifts silently → always `lint`.
2. `$name` macros take the longest `[A-Za-z0-9_]+`: `$Xc4` is macro `Xc4` (unknown → silence). End with a space,
   `|` or `]`.
3. In a drum channel `t90` is a tom of length 90 ("odd length"), `o`/`c`/`k` are hats/crash/kick: tempo changes
   and transposes belong in a pitched channel. `t` anywhere is global.
4. Loop: chord line `L` and every hand-written channel's `L` must be at the same tick (`drums` without `L` → warning).
5. Unknown `inst:` → plays as pulse, no warning. Typos in chord qualities → silent span + warning.
6. `@inst` inside a channel keeps that channel's `vol/pan/echo`; INST `vol` values are calibrated so switches stay
   level. The harmony channel ignores the source's instrument switches.
7. `pushBGM` and a new `playJingle` both cut a running jingle and resolve its promise — sequence fanfares with
   `await`. `R.jingle` with audio locked resolves at once (awaiting code never hangs; in node too).
8. `playBGM(sameId)` is a no-op: re-entering a map with the same track does not restart it (intended).
   A battle started while no BGM was playing pushes `null`; `popBGM` then leaves silence.
9. Per-id SFX limits: 30 ms retrigger guard, max 3 overlapping instances; different ids are unlimited.
10. `S.gain()` is absolute and applies to the whole SFX; wrappers from `sfx.js` GAIN set it too → set yours last.
11. The music bus has an 11.5 kHz LPF, SFX do not; everything shares one limiter (−4 dBFS knee): very loud SFX pump
    the music.
12. Render at 32 kHz: oscillator partials > 16 kHz are clamped with a console warning (high `glock`/`celesta`).
13. `ice`/`item` exist in two registries — use `--sfx` in the tool.
14. Chronicle's save/settings prefix change (`luminous_chronicle_`) does not affect audio; volumes still come from
    `R.Settings.bgmVolume/sfxVolume`.

---------------------------------------------------------------------------------------------------
## 12. Checklist

Audio owner (A17):
- [ ] Update id lists in DESIGN §3, `render_audio.js:29-34`, validate.js (drop `jobup`; add the draft ids).
- [ ] Add SFX `glimmer` (§9.3), `light` (or alias `holy`), `golden`, `freeze`, `burn`, `quill`, `page`, `swap`.
- [ ] Add jingles `superrare` (§9.2), `chapter`, `recruit` (can start from `jobup`'s material); keep `rare`.
- [ ] Add BGM `tavern` (§9.1) first (needed at game start), then `home rival tension sorrow boss2 rarebattle
      superboss postgame`; minimal effort per the owner brief; everything `lint`-clean and gain-calibrated.
- [ ] Optional `R.Audio.duck()` (§8.5) if the glimmer needs more presence.

Requests to other owners (they call ids, never edit audio files):
- battle: `glimmer` event → sfx + ≈30-frame gap before the action fx; `drop {grade}` → `item`/`rare`/await
  `superrare`; one `levelup` jingle per victory; `rarebattle` for rare/golden fights (`battle_scene.js:868`);
  element sfx from `DB.elements[el].sfx` in `battle_fx.play` (936); no `jobup`.
- field/events: chest/`give` jingle by item grade (`field.js:659/685`, `events_runtime.js:105`); optional
  zone-based world BGM; `ev.bgm('tavern')` in the tavern; `chapter` + `quill` in `ev.clearRegion`; `recruit` in
  `ev.recruit`.
- menus: `page` when turning 技の書/術の書 pages, `swap` for party/row changes (else `confirm_soft`).

---------------------------------------------------------------------------------------------------
## 13. Recorded media: Lyria BGM files and voice lines (BRIEF Part A9 / A10, 2026-09-26)

The synth stays the default. Recorded files only *override* it when they exist; with no files nothing changes.

| what | where | how it is played |
|---|---|---|
| BGM file | `assets/bgm/<id>.(ogg\|m4a\|mp3\|wav)` (+ `<id>.json` `{loopStart, loopEnd, gain, loop}` s) | `playBGM/pushBGM/popBGM(id)` decode it on first use (`decodeAudioData`, LRU of 6 buffers; `battle` is pre-decoded 1.5 s after `init`) and loop it with an `AudioBufferSourceNode` (`FilePlayback`, same interface as `Playback`). Fades, push/pop position, jingle pause/resume, `stopBGM`, BGM volume, `duck()` all apply unchanged (it goes into `mx.music`). Default level `FILE_GAIN` 0.7 (json `gain` overrides). Decode failure → one warning + the synth track of the same id. Jingles are always synthesised. |
| voice line | `assets/voice/<id>.(ogg\|m4a\|mp3\|wav)`, id `v_<speaker>_<scene>_<nn>` | `ev.say(text, {voice:id})` / `R.UI.say(text, {voice})` → `R.Audio.playVoice(id)` when the say starts, `stopVoice(handle)` when the player advances past it, the window closes or another say replaces it (`voice:[…]` = one id per `\f` page; `noWait` keeps it under the question). Own bus `mx.voiceBus` (setting **ボイスの音量** `voiceVolume`, default 0.8, 0 = off), the music path is held at −9 dB (`mx.voiceDuck`, 0.15 s down / 0.4 s up). Missing file / no audio → silent, no error. |

- **Build**: `tools/build.js` lists the files in `window.RPG_MEDIA` (before the game code). Default: base64 `data:` URLs
  inside dist/index.html. `--bgm external` / `--voice external`: copies to `dist/bgm/`, `dist/voice/` with relative URLs
  (serve dist over http; `file://` cannot fetch them — the game then falls back to the synth). debug.html loads from
  `assets/` by relative URL. `--media <dir> --out <dir>` for tests. Never a URL to another host.
- **Lyria**: `tools/lyria_bgm.js` + `design/bgm/prompts.json` (32 ids, tempo/key copied from the synth tracks). See the
  file header for credentials (Vertex `lyria-002` REST predict ≈30 s clips / Gemini API Lyria RealTime WebSocket), the
  loop crossfade and ffmpeg. `--dry-run` sends nothing; no key → prints setup, exit 0.
- **Voice script**: `node tools/voice_script.js` → `design/voice/script.csv|md` (140 lines, 18 fixed characters; the
  hero and the 20 companions never speak; lines with `{hero}` are not voiced). `--check` for CI.
- **Tests**: `node tools/test_media.js` (fake AudioContext + a real Chromium decode of `tools/fixtures/media/`).

### 13.1 Generated media (2026-09-26, Gemini API)

- **API shapes (verified)** — base `https://generativelanguage.googleapis.com/v1beta`, header `x-goog-api-key`
  (never a `?key=` URL). HTTP code in `tools/lib/gemini_audio.js` only.
  - TTS `models/gemini-3.8-flash-tts:generateContent`, `generationConfig {responseModalities:['AUDIO'], speechConfig:
    {voiceConfig:{prebuiltVoiceConfig:{voiceName:'ja-jp-…'}}}}`; a custom (replicated) voice from `GET /voices` goes in
    `voiceConfig:{voice:'voice_…'}`. → `inlineData audio/wav` (PCM16 mono 24 kHz). `systemInstruction` is refused.
    Prompt = `# AUDIO PROFILE / ## SCENE / ## DIRECTOR'S NOTES / ## TRANSCRIPT` (a bare "Say sadly: …" prefix is
    sometimes read aloud). Quota: 10 req/min and **100 req/day** per model → the tool uses the **Batch API**
    (`:batchGenerateContent` inline requests → poll `GET batches/…`, 2–5 min), and a listening check
    (`gemini-3.8-flash` hears each take and compares it with the line).
  - Lyria `models/lyria-3.5:generateContent` `{contents:[{parts:[{text}]}]}` → a text part (section map) + `inlineData
    audio/mpeg` (MP3 44.1 kHz stereo 192 kbps). Length follows "Duration: N seconds." in the prompt. Random refusals
    (`blockReason: PROHIBITED_CONTENT`) are retried.
- **Voices**: `node tools/voice_tts.js` (casting, profiles, per-line directions, hero lines: `design/voice/casting.json`)
  → `assets/voice/<id>.ogg` (Vorbis mono 24 kHz, trimmed, −16 LUFS, peak ≤ −1 dBFS; effects for giant / king /
  golem / automaton / ghosts). 140 story lines + 24 hero battle clips (`v_hero_<m|f>_<kind>_<n>`).
- **Hero battle voice**: `R.Audio.battleVoice(kind[, gender])`, kinds `attack glimmer spell hurt ko victory`; picks a
  random clip for `R.State.hero().gender`, never the same twice in a row, own voice volume, no BGM duck.
- **BGM**: `node tools/lyria_bgm.js` → `assets/bgm/<id>.ogg` (Vorbis 96 kbps, −18 LUFS) + `<id>.json` whose
  `loopStart/loopEnd` come from an automatic loop search (spectral self-similarity + onset phase + a baked
  crossfade at the seam; `analysis` records the score). Reference vibes: `cave` + `dungeon` = urban-noir funk
  groove, `village` + `home` = warm canyon-village acoustic theme.
- **Build**: everything is embedded by default (24 BGM + 164 voice ≈ 23 MB → dist/index.html ≈ 37 MB; with all 32
  BGM ≈ 44 MB, under the 60 MB limit). If it grows past that: `node tools/build.js --bgm external` (serve dist/ over http).
- **Listening page**: `node tools/audio_preview.js` → `design/audio_preview.html` (players for every file, loop-seam button).
