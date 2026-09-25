# Porting note — tools & testing (build, shot, node loader, QA tools)

Scope: `chronicle/tools/{build,shot}.js`, `tools/lib/{load,maps}.js`, the debug hooks they drive
(`src/systems/debug.js`), and the reference-only QA tools in `/tmp/claude-0/ref/rpg/tools`
(`validate`, `progress`, `sim_*`, `test_battle`, `check_*`, `gen_world`, `fixtures/`).
`build/shot/render_audio/sheet_*/lib/*` in the fork are byte-identical to the reference (`cmp`).
The only src difference is `core/save.js:11`, where PREFIX is `luminous_chronicle_`.
Anchors are `file:line` in the fork unless they say `ref:`. Everything below was run on 2026-09-25.
The run log with exact commands is in §8.

---------------------------------------------------------------------------------------------------
## 0. TL;DR

* **The fork builds**: `node tools/build.js` → `[build] 55 files → dist/index.html (1454 KB), debug.html`, exit 0.
  `--check` also exits 0. The title screen renders (still the Crest logo and text).
  **Any real flow crashes** because `src/data` has only `tiles.js`:
  * はじめから → `TypeError … reading 'name'` at `systems/nameentry.js:288` (`R.DB.chars[id]` is undefined).
  * `R.State.newGame()` → `… reading 'map'` at `systems/state.js:14`. `R.PARTY_ORDER` used to be defined in the
    deleted `data/chars.js`.
  * `R.Battle.start` with unknown monsters → warnings only ("no monsters"), no scene.
* **Fonts are not embedded here**: `pyftsubset` (fonttools) is not installed, so `build.js:112-115` falls back to a
  Google Fonts `<link>`. The proxy blocks that link (`ERR_CERT_AUTHORITY_INVALID`). The effects:
  1. Screenshots use a system fallback font, so text widths are wrong for layout checks.
  2. `shot.js` exits 1 on every run, because of that console error.
  3. The rule "no network at runtime" is broken.

  Fix: `python3 -m venv /tmp/claude-0/ftvenv && /tmp/claude-0/ftvenv/bin/pip install -q fonttools brotli`, then
  build with `PATH=/tmp/claude-0/ftvenv/bin:$PATH node tools/build.js`. The fork then builds at 1543 KB (a 68 KB
  woff2), and `shot.js` exits 0. Better: the lead installs fonttools once for the whole machine in Phase 0.
* **The reference toolchain works end-to-end** in a copy (`/tmp/claude-0/refbuild`).
  * With fonttools on PATH, the build is **byte-identical** to the committed `rpg/dist/index.html` and
    `debug.html` (md5 `cd76879…`, `f31fdf6…`).
  * Screenshots taken: title, name entry, field, menu and battle (§8).
  * QA tools pass, except for 2 known failures in the reference itself (§7).
* **4-party smoke test on the fork** (a minimal fixture injected with `--eval`, no files edited, §8.3):
  the battle scene draws **only 3 status windows**, and the 4th member is not drawn at all. The cause is
  `systems/battle_scene.js:16`, `WIN = { xs: [6, 88, 170], … }`.
* **Every reference QA tool is Crest-specific** (ids, jobs, 3 heroes, 5 equip slots, ship). Run against the fork
  (in a scratch copy), they either crash on `R.PARTY_ORDER` / `DB.chars` or report dozens of missing Crest ids
  (§7.2). Port their *frameworks*, not their contents.

---------------------------------------------------------------------------------------------------
## 1. Inventory

| Tool | In fork? | What it is | Crest-specific parts | Action for Chronicle |
|---|---|---|---|---|
| `tools/build.js` | yes | concat → `dist/index.html` + `debug.html`, font subset | HTML `<title>` `'ルミナス・クレスト'` at `:155`, `:157` | lead: fix the title, make the font failure loud, add `--with` (§2.4) |
| `tools/shot.js` | yes | Playwright screenshot / driver | none (key map `:29` only) | lead: eval timeout, `--eval-file`, `--speed`, `--frames` (§3.4) |
| `tools/lib/load.js` | yes | node vm loader (no DOM) | none | lead: `extra` fixtures, text-width stub, data hooks (§4.3) |
| `tools/lib/maps.js` | yes | static map parser for the QA tools | `hidden` objects (abolished) | keep it in sync with `FieldMap.compile`, or replace it (§5) |
| `src/systems/debug.js` | yes | `R.debug.*` hooks | jobs/JP (`:33-49`, `:79-88`), `battle()` returns a promise | rewrite for Chronicle (§6) |
| `tools/render_audio.js` | yes | audio lint/render | see `notes/audio.md` | audio |
| `tools/sheet_*.js` | yes | art contact sheets | 3 windows, Crest ids, `JOB_IDS` (see `notes/art.md` #11–12) | art owners |
| `validate.js` | ref only | cross-reference validator (0.2 s) | every id list `ref:validate.js:21-47` | port first, as a Chronicle skeleton (§7.1) |
| `progress.js` | ref only | completability BFS (0.9 s) | `herb`, `porta_dock` ship, 8 key items, `game_clear` | port with a region/tier model |
| `test_battle.js` + `fixtures/battle/*` | ref only | 1173 engine assertions (0.9 s) | 224 hero refs, jobs/JP, 5 slots | rewrite the fixtures, keep the structure |
| `sim_balance.js` | ref only | balance through `R.Battle.simulate` (31 s full) | STAGES, job PLANS, PRIORITY, shops `weapon/armor` | rewrite: tiers × party combinations × glimmer stats |
| `sim_dualwield.js`, `sim_postgame.js` | ref only | special-purpose sims | ninja/dual wield, abyss | reference only |
| `check_{items,jobs,rare,towns,world,dungeons_a,dungeons_b,abyss}.js` | ref only | per-owner checkers | fully content-specific | use as templates (§7.3) |
| `gen_world.js` | ref only | seeded world generator → `src/maps/world.js` | Crest geography, 128×112 | story/field decide (see `notes/field.md`) |
| `fixtures/**` | ref only | harness makers, art/battle stubs, node tests, Playwright flows | party/job fixtures | copy the generic ones (§7.4) |

---------------------------------------------------------------------------------------------------
## 2. `tools/build.js`

### 2.1 Data flow
1. **File list** (`listFiles`, `:23-41`) walks `DIRS = core ui data art audio maps events systems` (`:20`)
   recursively. It keeps `.js` files only and adds `src/main.js` last. `core` files come first in the order of
   `CORE_FIRST = ns input gfx engine save` (`:21`). Every other file is sorted by **full-path `localeCompare`**.
2. **Syntax check** (`check`, `:51-59`) compiles each file with `new vm.Script` and **excludes** the ones that
   fail, printing the first 6 stack lines. With `--check` (`:145`) it exits here with 0 or 1 and writes nothing.
3. **Font** (`fontCss`, `:88-116`) builds the glyph set:
   * ASCII, U+3000–30FF (punctuation, hiragana, katakana), full-width forms, and the symbols at `:97`;
   * every character that appears in the **included src files** (`:98`).

   Then it runs `pyftsubset --flavor=woff2`. The result is cached in `dist/.fontcache/<sha1-12>.woff2`, and other
   hashes are deleted (`:101-109`). The font is embedded as a base64 `@font-face`. On any failure it warns and
   returns the Google Fonts link (`:112-115`). The failure leaves a stray `<hash>.txt` in the cache.
4. **Bundle** (`:148-153`): each file is wrapped in `try{…}catch(e){RPG.loadErrors.push(rel+': '+stack)}`, and
   `</script` is escaped.
5. **Outputs**:
   * `dist/index.html`, the bundle, with title `'ルミナス・クレスト'` (`:155`);
   * `debug.html` (`:156-157`): the same head with one `<script src="src/…">` per file, which gives readable
     stacks;
   * the canvas is fixed at `768×672` (`:131`, = 256×224 × `R.SCALE` 3), and CSS scaling is done by
     `main.js fit()`.
   * If files were excluded, it still writes both outputs but sets exit code 1 (`:160`).

### 2.2 Gotchas
* **Font subset = src text only.** Characters that appear only in `tools/fixtures/*`, in `--eval` strings, or are
  computed at runtime (`String.fromCharCode`) are **not** in the font, so they render in the fallback font.
  All shipped Japanese must appear literally in `src/`.
* **Load order trap**: `localeCompare` sorts `_` before `.`, and ignores case. Measured:
  `monsters_a.js < Monsters_b.js < monsters.js < monsters/x.js`. So `items_weapons.js` loads **before**
  `items.js`. A "base" data file that defines helpers used at load time by its `_suffix` siblings will break.
  Put shared helpers in `src/core` or `src/ui`, or register lazily.
* **debug.html has no try/catch wrapper**. A load-time exception becomes an uncaught `pageerror`, and
  `RPG.loadErrors` stays empty. In `dist/index.html` the same error lands in `RPG.loadErrors`. `shot.js` reports
  both.
* `DIRS`/`CORE_FIRST`/sort are **duplicated** in `tools/lib/load.js:16-31`. Change both, or share a
  `tools/lib/files.js`.
* A file in `src/` that is not under one of the 8 dirs (other than `main.js`) is silently ignored.
* `chronicle/.gitignore` does not list `dist/` or `debug.html`. The reference *commits* `rpg/dist/index.html` and
  `rpg/debug.html`. After my build run, `git status` shows `?? chronicle/dist/` and `?? chronicle/debug.html`.
  The lead must decide: ignore them during development and commit them only at release.
* Build time: 0.2 s without a font, 1.6 s with a new subset, and cached after that.

### 2.3 With the current (empty) data
The build itself is fine (55 files, 0 excluded). What fails is **runtime**:

| Step | Error | Needed |
|---|---|---|
| title → はじめから | `nameentry.js:288` `R.DB.chars[id].name` | new character creation (menus) + `DB.chars` |
| `R.State.newGame()` | `state.js:14` `R.PARTY_ORDER.map` | party model: hero + 3 chosen of 20 (lead: rules/state) |
| `R.State.START` | `{map:'regnas_castle', spawn:'start'}` (`state.js:9`), a map that does not exist | Chronicle start map |
| menu | `objective: 'obj_start'` (`state.js:28`) is missing from `DB.objectives` | objectives |
| battle | `DB.monsters`/`encounters`/`troops` are empty | monsters owner |
| name/confirm screens | `party:<id>:<startJob>` sprites (`art/chars.js:290` registers them for the Crest `JOB_IDS`, and `:291` for `DB.jobs` at boot) | art-chars: jobless party sheets |

The fastest way to unblock screenshots **before** real data exists is a shared boot fixture (§8.3), loaded with
the proposed `build.js --with`.

### 2.4 Proposed changes (lead, Phase 0)
1. Take the `<title>` from `R.TITLE`: regex `R.TITLE = '…'` in `src/core/ns.js`. Otherwise use
   `'ルミナス・クロニクル'`.
2. Font: when `pyftsubset` is missing, print a **loud** error and exit 1, unless `--font-link` is given. The
   link fallback silently changes every text width. Delete the stray `.txt` on failure.
3. `--with <file|dir>[,…]` writes `debug_<name>.html`:
   * the fixture scripts go after `src/`, before `main.js`;
   * add `<base href="file://ROOT/">`;
   * include the fixture text in that page's glyph set.

   This replaces the four copy-pasted `fixtures/*/make_harness.js` (ref), which all read `debug.html` and
   string-replace `<script src="src/main.js"></script>`.
4. Share the file list with `lib/load.js`.
5. Optional: `--out <dir>` for parallel agents who want private outputs.

---------------------------------------------------------------------------------------------------
## 3. `tools/shot.js`

### 3.1 Options (the header at `:4-21` is accurate)
| Option | Kind | Semantics (verified) |
|---|---|---|
| `--html <file>` | setting | default `dist/index.html`. `path.resolve`d against **cwd**. Opened as `file://` |
| `--query <qs>` | setting | e.g. `debug=1` → `R.Field.showCoords` (map id + x,y overlay, `debug.js:91-95`) |
| `--size WxH` | setting | viewport, default 800×700 |
| `--touch` | setting | 390×844 @2×, `isMobile`, `hasTouch` → `#game.touch`, touch pad visible (checked: canvas 390 px wide) |
| `--full` | setting | page screenshot instead of the `#screen` locator (use it with `--touch` to see the pad) |
| `--out <file>` | setting | taken **after all steps**, wherever it appears on the command line |
| `--wait <ms>` | step | sleeps. **Always** preceded by a fixed 1500 ms after `goto` (`:55`) = frame ≈ 90 |
| `--eval <js>` | step | `page.evaluate('(async()=>{ return (JS); })()')` (`:67`) → prints the result (JSON, 4000 chars) |
| `--keys <seq>` | step | comma tokens: `up down left right a b dash` (50 ms down + 90 ms gap), `hold:<btn>:<ms>`, `wait:<ms>`, `<tok>*<n>` |
| `--shot <file>` | step | screenshot now |

* Key map (`:29`): `a=KeyZ`, `b=KeyX`, `dash=ShiftLeft`, arrows. If Chronicle adds buttons (for example a
  row-swap or page button), extend `KEY` **and** `core/input.js`.
* Exit code: 1 if any `console.error`, `pageerror`, eval error or `RPG.loadErrors`; 2 on a crash.
  **`console.warning` is printed but does not fail**. That includes the missing-sprite warning from
  `R.Gfx.get` (magenta placeholder) and `[RPG] battle: unknown monster`. Grep the output for them.
* Each run gets a fresh browser context: no localStorage, so no saves, so the title menu starts on はじめから.
  With a save present the cursor starts on つづきから (`title.js:245`). Key scripts depend on this state,
  so prefer `--eval` hooks.
* Playwright is resolved from `require('playwright')` or `/opt/node22/lib/node_modules/playwright` (1.56.1,
  browsers in `/opt/pw-browsers`). The Google Fonts request is the only network call, and it fails.

### 3.2 Gotchas (verified)
* **`--eval` must be one expression.** `--eval "RPG.x=1; 2"` → `SyntaxError: Unexpected token ';'`.
  Use `(a, b)` or an IIFE `(() => { …; return x; })()`.
* **Never return a long-lived promise.** The eval is awaited. `--eval "RPG.debug.battle('w_start')"` hung until my
  25 s `timeout` killed it: the battle promise only resolves when the battle ends. Use
  `--eval "(RPG.debug.battle('w_start'), 1)"`.
  `RPG.debug.newGameAt(...)` is fine: `Field.start` resolves once the map is up.
* Timing is wall-clock ms at 60 fps. For long sequences:
  * speed up with `RPG.Engine.speed = 8` (frames simulated per rendered frame, `core/engine.js:43,151`);
  * for exact frames, pause and step: `RPG.Engine.paused = true; RPG.Engine.step(); RPG.Engine.render()`.
    The ref `fixtures/battle/gallery.js` pastes stepped frames into a contact sheet.
* To press a button without keyboard events: `RPG.Input._set('a', true)` … `_set('a', false)`
  (`core/input.js:68`).
* Harness pages bake `ROOT` into `<base href>`. Regenerate them per checkout: `refbuild` vs `chronicle`.
* **Look at every PNG** with the Read tool. Exit 0 does not mean the screen is right. The fork's 4th party member
  was invisible with exit 0.

### 3.3 Recipes
```sh
# title (after a build)
node tools/shot.js --out /tmp/claude-0/x_title.png
# title → はじめから → Crest name entry (defaults kept: up,right,right = 決定) → yes → field
node tools/shot.js --keys "a,wait:400,a,wait:600" --shot /tmp/claude-0/x_name.png \
  --keys "up,right,right,a,wait:400,up,right,right,a,wait:400,up,right,right,a,wait:600,a,wait:3000" --out /tmp/claude-0/x_field.png
# skip the title: fresh game on a world spawn, open the field menu, then force a random battle
node tools/shot.js --eval "RPG.debug.newGameAt('world','regnas_castle')" --wait 600 --keys "b,wait:500" --shot /tmp/claude-0/x_menu.png \
  --keys "b,wait:300" --eval "(RPG.debug.battle('w_start'), 1)" --wait 2500 --out /tmp/claude-0/x_battle.png
# boss troop instead of a zone: RPG.debug.battle('boss_wind'); fixed monsters: (RPG.Battle.start({mons:[['goblin',3]],bg:'grass'}), 1)
# state probe
--eval "JSON.stringify({top:RPG.Engine.top().constructor.name, pos:RPG.debug.pos(), party:RPG.Game.party.map(c=>c.name)})"
```
Chronicle's title flow will be different: character creation, then a tavern pick of 3 of 20. So define
`RPG.debug.quickStart(...)` (§6) and write recipes against it, not key sequences.

### 3.4 Proposed changes (lead)
* `--eval-timeout <ms>` (default about 15000): wrap each evaluate in `Promise.race` and fail loudly, not hang.
* `--eval-file <path>` for fixtures and smoke scripts. Today the ref uses `--eval "$(cat file)"`, which quotes
  badly.
* `--speed <n>` → `RPG.Engine.speed`. `--frames <n>` → wait until `RPG.Engine.frame` advanced by n (deterministic).
* `--seed <n>` → `RPG.U.seed(n)` after load, for reproducible encounter groups and damage in screenshots.
* `--strict` → also fail on `console.warning` (missing gfx keys, unknown ids).

---------------------------------------------------------------------------------------------------
## 4. `tools/lib/load.js` (node, no DOM)

### 4.1 What it does
* It uses the same file walk as build.js (`:16-31`), but **without `main.js`**. So `R.boot()` never runs, and
  neither do the **`R.onBoot` hooks**. In the fork those hooks are:
  * `art/chars.js:291`, `party:*` per job;
  * `art/tiles_local.js:1058`, the neutral-floor fallback for tiles without art;
  * `tiles_local.js:1087`, `installExterior` (also called directly);
  * `systems/debug.js:91`.

  **Consequence:** node validators can disagree with the game. For example, validate reports `gfx tile:X missing`
  where the browser shows a neutral floor.
* The sandbox (`:33-43`) has:
  * `window = sandbox`, `console` (quiet: only `error`), timers, `performance.now = Date.now`, no-op
    `requestAnimationFrame`/`addEventListener`, `navigator.getGamepads = []`;
  * a **localStorage stub that stores nothing**, so `R.Save.list()` → `[null,null,null]`;
  * `TextEncoder/Decoder` and `btoa/atob`.

  There is no `document` and no canvas.
* Errors go into `R._nodeLoadErrors` (`:51`) and are printed unless `quiet`.

### 4.2 Works vs throws in node (probed on the fork)
| Works | Throws |
|---|---|
| `R.Engine.step()` (update only), all `R.DB`, `R.Rules`, `R.State` (once data exists), `R.Battle.Engine` / `simulate` / `buildMons`, `R.BattleAI`, `R.FieldMap.compile(id)`, `R.Gfx.has/_defs` (679 keys), `R.Text.fmt` | `R.Gfx.get(key)` (the factory needs `document`), **`R.Gfx.textWidth`** (`Cannot set properties of null (setting 'font')`), anything that draws |

* Idiom for node UI tests (ref `fixtures/field/test_field.js:12-50`):
  * stub `R.Gfx.textWidth = s => s.length*10.7` and `R.Audio = {sfx, playBGM, playJingle}`;
  * set `R.Battle/Shop/Menu = null` to isolate a system;
  * step frames with `R.Engine.step(); await new Promise(r => setImmediate(r))`;
  * press with `R.Input._set(b, true/false)`;
  * read messages from `R.UI._msg.pages`.
* Loading fixtures in node (ref `test_battle.js:11`):
  `new Function('window', fs.readFileSync(fixture,'utf8'))({ RPG: R })`.
* `R.Gfx.textWidth` is unavailable, so every ref checker re-implements a width estimate. For example
  `ref:check_dungeons_a.js:353-356` uses full-width 11 px, half-width 5.34 px, and 220 px per message line.

### 4.3 Proposed changes (lead)
* `load({extra:[paths]})`: fixture files run after `src/`, in the same sandbox.
* `load({gfxStub:true})`: `textWidth` = DotGothic16 metrics (full 10.67 / half 5.34).
* If Chronicle adds derived-data hooks (`R.onData`), `load` must run them. Do not derive data in `onBoot`, because
  node never sees it.

---------------------------------------------------------------------------------------------------
## 5. `tools/lib/maps.js` — `parseMap(R, id)`
* It mirrors DESIGN §7.1 statically:
  * legend by `m.legend` or type (`:7`); mark chars → objects with `_2`, `_3` id suffixes (`:19`);
  * `under` defaults to `'.'` for both world and local (`:26`, the ternary is redundant);
  * the `hidden` objects, which were abolished, are still parsed (`:32`, `:63`);
  * decor layer checks (`:44-60`); explicit `spawns/npcs/chests/warps/events/hidden/signs` appended (`:62-63`).
* Returns `{w,h,grid,legend,issues,spawns,npcs,chests,warps,events,hidden,signs,decor,decorAt,tileAt}`.
* `tileAt` ignores `tilePatches`. `progress.js:56-60` applies them itself.
* **Check:** `R.FieldMap.compile(id)` works in node. On all 50 reference maps it gives the same tiles and the same
  npc/chest/warp counts as `parseMap`. **Recommendation**: build the Chronicle QA tools on `R.FieldMap.compile`,
  the runtime's own parser, so new map features cannot drift. For example, if the field owner adds layers or
  RS1-style overlays, the tools see them. Keep `parseMap` only as a thin adapter, or delete it.

---------------------------------------------------------------------------------------------------
## 6. Debug hooks `R.debug` (`src/systems/debug.js`) — what the tools drive
| Hook | Line | Chronicle status |
|---|---|---|
| `warp(map, spawn\|{x,y})`, `give`, `flag`, `gold`, `heal`, `noEncounter`, `pos`, `maps`, `event`, `teleport`, `visitAll` | 12-20, 37-38, 58, 65, 75-77 | keep |
| `level(n, charId)` | 22-31 | keep, but HP/MP/WP growth changes |
| `jp`, `setJobLevel`, `learnAll` | 33-36, 40-49, 79-88 | **remove** (no jobs). Replace with `mastery(charId, wtype\|elem, n)`, `learn(charId, id)`, `glimmerAll(charId?)` |
| `newGameAt(map, spawn)` | 51-55 | keep. Needs `R.State.START` for Chronicle |
| `battle(zone\|troop)` | 60-64 | **returns the battle promise**, which hangs `shot.js`. Return `'started'` and put the promise in `R.debug.last` |
| `ship(spawn)` | 67-74 | drop, or change to ferry travel |

Proposed additions for Chronicle (owned by the lead, used by every agent):
* `quickStart({gender, type, fav, companions:[id×3], tier, level, map, spawn})` skips creation and the tavern.
* `setTier(n)` / `clearRegion(id)`.
* `equip(charId, slot, itemId)` for the 9 slots.
* `row(charId, 'front'|'middle')`.
* `giveAll(kind)` to fill the item and book screens.
* `battle({mons|zone|troop, tier})`.

---------------------------------------------------------------------------------------------------
## 7. Reference-only QA tools

### 7.1 What each one does, and what is hard-coded
* **`validate.js`** (286 lines).
  * Hard-coded constant lists (`ref:validate.js:21-47`):
    * ELEMENTS (8, with `ice thunder holy`); STATUSES; **WTYPES (10)**; **ATYPES (head/body/shield only)**;
      TARGETS; EFFECTS; FORMULAS; BUFFS; TRIGGERS; REACTS; MODS;
    * BGM/JINGLES/SFX (these must equal the DESIGN lists); BBG; NPC types; ICONS;
    * **JOBS (19)**; LOCS; SHOP_LOCS; TROOPS (11); KEYS.
  * Sections:
    * required items (`:78`);
    * jobs/abilities/chars, using `startJob`, `startLearned` and `jp` (`:97-129`);
    * monsters: `jp` is a required number (`:136`), plus drop/rare/steal;
    * encounters: ≤3 species, ≤8 monsters (`:146-155`); rareEncounters rate ≤ 0.05; troops; shops
      `<loc>_{item,weapon,armor}` (`:171`);
    * maps via `parseMap`: spawns `entrance`, warps/exit/escape targets, decor sanity, npc sprite/event, unique
      chest ids, hidden → warn (`:175-227`);
    * locations with docks on sea tiles (`:229-234`); events have `run` and `meta`;
    * **source-text regexes** for `ev.battle/give/take/has/shop/setObjective/warp/giveShip` and
      `sfx/bgm/jingle` ids (`:242-257`);
    * gfx keys, including `party:${c}:${j}` for every JOB (`:267`), and obj `chest ship sparkle crest_glow shadow`
      (`:269`);
    * music/sfx registry vs the lists (`:273-278`).
  * Crest result: 0 errors, 9 warnings (hidden items).
  * **Port:** keep the whole framework, and drive the lists from DESIGN.md constants in one shared module:
    `tools/lib/contract.js`, or better `R.CONTRACT` in src so the runtime and tools share it. Replace the jobs
    section with tech/spell/glimmer checks. Add 9 slots, 11 wtypes, 6 elements, rows, tiers, 3-tier drops and
    companions.
* **`progress.js`** (176 lines).
  * A fixpoint BFS over all maps: passability, locks, still-NPC blockers, tilePatches, decor, counters.
    * Warps fire on step. Step events with `meta.warp` are followed (`:108-111`).
    * Chests and NPC/step events whose `meta.needs` hold add their `meta.gives`.
  * Hard-coded:
    * start inventory `herb` (`:17`);
    * ship = flag `has_ship` spawned at `porta_dock` (`:42-54`);
    * `R.State.START` (`:89-93`);
    * the key list (`:171`); success = flag `game_clear` + no unreached maps (`:174-176`).
  * **Port:**
    * no ship: follow `meta.warp` on **NPC** events too, for ferries and coaches;
    * express "8 regions in any order" as `needs:['count:region_clear>=8']` or `tier:8`;
    * drop `hidden`;
    * tier chests do not affect reachability, only their contents.
* **`sim_balance.js`** (569 lines).
  * STAGES with Crest zones, towns and level bands (`:40-61`).
  * **Job PLANS / PRIORITY / jpBudget** (`:67-104`).
  * `bagFor` Crest consumables (`:105`).
  * `buildChar` spends JP along the plans (`:116`).
  * `equipParty` = the best items from `DB.shops[t+'_weapon'|'_armor']` (`:157-172`).
  * `buildParty` uses `R.PARTY_ORDER` (`:180`).
  * Sections: party / zones / bosses (±2 Lv) / crawl (thrifty AI, `simulateThrifty` `:340`, `fieldHeal` `:369`) /
    campaign (`:478`) / loot (hagane/kogane jelly `:560`). Full run: 31 s, 0 warnings.
  * **Port:**
    * stages = **tier 0..8** × regions;
    * parties = the hero types × **companion triples**. Sample stratified, or run all C(20,3)=1140 at low n, to
      prove "any combination can clear";
    * gear = the tier chest pools + shops over 9 slots;
    * report glimmers per battle and first-glimmer battle counts per wtype/element;
    * report rare 1/32 and super-rare 1/256 rates, and MP/WP economy;
    * model post-battle HP recovery if DESIGN adopts it;
    * model front/middle rows.
  * Make the party model a real module, `tools/lib/party_model.js`. `ref:check_rare.js:262-268` currently
    `eval`s sim_balance.js source between comment markers, which is fragile.
* **`test_battle.js`** (905 lines, 1173 assertions, 0.9 s).
  * It loads `fixtures/battle/data.js`: `tb_*` jobs, abilities, items, monsters, a troop and a zone.
  * `R.fxBattleChar(id, job, lv, learned, equip, set)` (`ref:fixtures/battle/data.js:155-172`) hard-codes
    `DB.chars[id].name`, `jobs`, the equip `{weapon,shield,head,body,acc}` and the set
    `{sub,reaction,support,field}`.
  * `R.fxBattleParty` = yuki/non/metem (`:173-180`).
  * Sections: phys, metal, magic, heal, statuses, buffs, targets, multi-hit, reactions, supports, monster AI,
    rounds, escape, rewards (EXP/**JP**/job-level messages `:699-757`), live bestiary, party AI (indexes `[1]` =
    healer, `[2]` = caster), simulate, real content (every item, ability and monster in `src/data` goes through
    the engine).
  * **Port:**
    * fixtures with their own `fx_*` chars, so tests do not depend on real `DB.chars`;
    * 4 members, 9 slots, rows, WP;
    * techs/spells replace job abilities; glimmer tests seeded with `U.seed`;
    * keep the "real content" sweep, the most valuable part.
* **`check_*.js`** (content checkers, ≤ 0.6 s each; `check_rare` 4 s with sim).
  * Reusable patterns:
    * **event dry runs** with a stub `ev`: battles won, yes to every question, gives compared to `meta.gives`
      (`ref:check_dungeons_a.js:362-410`);
    * **STYLE_JA text checks**: forbidden names, hard-coded hero names, placeholder whitelist, DQ spacing,
      full-width space after a mid-line ！/？, ≤4 lines/page, width with long names (`:340-359`);
    * **per-story-state BFS** (`check_dungeons_b`, `check_abyss`);
    * **`--png DIR` map renders**: Playwright + `dist/index.html` + `R.FieldMap.compile` + `R.Art.localTile`
      (`:445-500`), with objects, spawns and warps marked;
    * `check_world --png` at 4 px/tile.
  * The text checker and the PNG renderer are copy-pasted into 4–5 files. Factor them into
    `tools/lib/{text,evstub,render_map}.js` before 20 agents copy them again.
  * Chronicle placeholders: `{hero}` `{leader}`. The hero name is 4–5 characters, so width tests should
    substitute 5 full-width chars. Crest used 6.
* **`gen_world.js`**: seeded value noise over hand-placed ellipses/capsules. It then repairs connectivity, places
  docks, and splits the world into encounter-zone rectangles. The ちず screen assumes 128×112 at 2 px/tile.
  Useful as a template for the RS1-like world (field/story owners).

### 7.2 Results
**Reference** (`/tmp/claude-0/refbuild`):
* 0 errors: `validate`, `progress` (COMPLETABLE), `test_battle` (1173/0), `check_items`, `check_jobs`, `check_rare`,
  `check_world`, `check_dungeons_a/b`, `check_abyss`, `sim_balance`.
* fixtures pass: `field/test_field` 156/0, `jobs/test_jobs` 620/0, `menu/test_menu` 59/0, `items/test_items`,
  `world/test_check_world`; `menu/flows.js` (Playwright) 35/0 in 102 s.
* **Known failures in the reference itself:**
  * `check_towns` exit 1: `elfin_village: chest elfin_h1 @19,1 unreachable`;
  * `fixtures/towns/test_story.js` exit 1: `clear → obj_clear (got obj_postgame)`, a stale expectation.

**The same tools on the fork** (scratch copy `/tmp/claude-0/tools/chron_scratch`, fork src + ref tools):
* `validate`: 81 errors (missing Crest ids; also `src/systems/ending.js: warp map 'regnas_castle' unknown`);
* `progress`: NOT COMPLETABLE;
* `check_world`: "no world map"; `check_towns`: 22 errors;
* crashes:
  * `test_battle`: `fxBattleChar` needs `DB.chars.yuki`;
  * `sim_balance` / `check_items`: `R.PARTY_ORDER`;
  * `check_jobs`: `Rules.newChar`.

### 7.3 Port priority (suggested owners)
| # | What | Why first |
|---|---|---|
| 1 | build/shot/load changes (§2.4, §3.4, §4.3) + boot fixture + `quickStart` | every agent needs a screenshot from day 1 |
| 2 | `validate.js` skeleton on shared contract constants | catches cross-owner id drift in parallel development |
| 3 | `test_battle.js` + fixtures (battle owner) | the engine is rewritten for 4 members, rows, WP and glimmer |
| 4 | `lib/text.js` STYLE_JA checker + `lib/evstub.js` + `lib/render_map.js` | shared by the story, dungeon and town checkers |
| 5 | `progress.js` (region/tier model) | completability with free region order |
| 6 | `sim_balance.js` rewrite + `lib/party_model.js` | tier balance, companion combos, glimmer and rare rates |

### 7.4 Fixtures worth copying (generic, and "never override an existing key")
* Harness makers: `battle/make_harness.js`, `field/make_harness.js`, `menu/make_harness.js`,
  `jobs/make_harness.js`. The jobs one should be dropped, and `build --with` replaces all four.
* Stubs: `battle/art_stub.js`, `field/art_stub.js` (hard-codes yuki/non/metem × jobs at `:70-72`),
  `field/battle_stub.js`.
* Tools: `battle/gallery.js` (frame-stepped contact sheets), `menu/flows.js` (Playwright UI flow asserts, env
  `HARNESS`/`OUT`), `towns/smoke_npcs.js` (talk to every NPC per story stage; Crest map regex and flags at
  `:15-22`).
* Art support: `tiles/samples.js` (needed by `sheet_tiles`, see `notes/art.md` #12), `monsters/sheet.js`,
  `chars/check_parts.js`.
* **Use private output paths.** The harness defaults write to `/tmp/claude-0/{battle,field,menu,jobs}/`, and 20
  parallel agents will overwrite each other's files.

---------------------------------------------------------------------------------------------------
## 8. Run log (exact commands that worked)

### 8.1 Reference build + screenshots
```sh
cp -r /tmp/claude-0/ref/rpg /tmp/claude-0/refbuild          # never touch /tmp/claude-0/ref/rpg
python3 -m venv $V && $V/bin/pip install -q fonttools brotli   # $V = any venv dir (I used my scratchpad)
cd /tmp/claude-0/refbuild && PATH=$V/bin:$PATH node tools/build.js
#   [build] 87 files → dist/index.html (2157 KB), debug.html      (identical to the committed files)
#   without pyftsubset: "font subset failed, using Google Fonts link" → 2016 KB, fallback font in shots
node tools/shot.js --wait 1500 --out /tmp/claude-0/ref_title.png                                   # exit 0
node tools/shot.js --eval "RPG.debug.newGameAt('world','regnas_castle')" --wait 600 --keys "b,wait:500" \
  --shot /tmp/claude-0/ref_menu.png --keys "b,wait:300" --eval "(RPG.debug.battle('w_start'), 1)" --wait 2500 \
  --shot /tmp/claude-0/ref_battle_world.png --keys "a,wait:300,a,wait:300,a,wait:300,a,wait:300" \
  --shot /tmp/claude-0/ref_battle_cmd.png                                                          # exit 0, ≈13 s
node tools/shot.js --keys "a,wait:400,a,wait:600" --shot /tmp/claude-0/ref_nameentry.png \
  --keys "up,right,right,a,wait:400,up,right,right,a,wait:400,up,right,right,a,wait:600" \
  --shot /tmp/claude-0/ref_nameconfirm.png --keys "a,wait:3000" --out /tmp/claude-0/ref_newgame.png  # exit 0
node tools/fixtures/battle/make_harness.js /tmp/claude-0/tools/ref_bh.html && node tools/shot.js \
  --html /tmp/claude-0/tools/ref_bh.html --eval "RPG.fxBattle({mons:[['tb_goblin',3]]})" --wait 2500 \
  --out /tmp/claude-0/tools/ref_harness_battle.png                                                 # exit 0
```
PNGs:
* `/tmp/claude-0/ref_title.png` (title, DotGothic16);
* `/tmp/claude-0/ref_battle_world.png` (2 goblins on the grass backdrop, 3 status windows);
* `/tmp/claude-0/ref_battle_cmd.png` (command and target windows);
* `/tmp/claude-0/ref_menu.png`, `/tmp/claude-0/ref_nameentry.png`, `/tmp/claude-0/ref_nameconfirm.png`,
  `/tmp/claude-0/ref_newgame.png`;
* `/tmp/claude-0/ref_battle.png`: a battle forced during the castle intro. It works, but it opens over the
  king's message. Use a world spawn instead.

### 8.2 Fork build
```sh
cd /home/user/others/chronicle && node tools/build.js       # 55 files, 1454 KB, font link fallback, exit 0
node tools/build.js --check                                 # exit 0
node tools/shot.js --out /tmp/claude-0/tools/fork_title.png # Crest title renders; exit 1 (fonts.googleapis cert)
node tools/shot.js --html debug.html --wait 500 --keys "a,wait:800,a,wait:800" --out /tmp/claude-0/tools/fork_newgame.png
#   TypeError … reading 'name' at nameentry.js:288 (DB.chars empty); R.State.newGame → state.js:14
PATH=$V/bin:$PATH node tools/build.js                       # 1543 KB with the embedded 68 KB woff2 → shot exit 0
```
`chronicle/dist/` and `chronicle/debug.html` now exist from these runs. They are untracked build outputs (§2.2).

### 8.3 Fork 4-member smoke test (nothing written to the repo)
The file was saved outside the repo and passed with `--eval "$(cat file)"` to
`node tools/shot.js --html debug.html … --wait 2500 --out /tmp/claude-0/tools/fork_battle_4p_font.png`.
Result: exit 0.
```js
(() => { const R = RPG, DB = R.DB;
  const g = (hp, mp, s) => ({ hp:[hp,8], mp:[mp,3], str:[s,2], vit:[10,2], agi:[10,2], int:[10,2], mnd:[10,2], luk:[8,1.5] });
  Object.assign(DB.chars, { hero:{name:'カタリ',gender:'m',startJob:'none',profile:'テスト',growth:g(30,6,12)},
    p1:{name:'アルバ',gender:'m',startJob:'none',profile:'テスト',growth:g(34,2,14)},
    p2:{name:'シエラ',gender:'f',startJob:'none',profile:'テスト',growth:g(24,12,8)},
    p3:{name:'ミルテ',gender:'f',startJob:'none',profile:'テスト',growth:g(22,14,7)} });
  R.PARTY_ORDER = ['hero','p1','p2','p3'];
  DB.items.herb = { name:'薬草', type:'consumable', price:8, desc:'テスト', use:{ target:'ally', effects:[{type:'heal',power:30}], fx:'heal', battle:true, field:true } };
  DB.monsters.fx_goblin = { name:'ゴブリン', sprite:'goblin', lv:1, hp:30, mp:0, atk:12, def:4, agi:8, mag:2, mdef:2, exp:5, gold:5, jp:1, desc:'テスト', actions:[{id:'attack',w:1}] };
  R.Engine.clear(); R.State.newGame();
  const L = new R.Layer(); L.opaque = true; L.draw = () => R.Gfx.clear('#203020'); R.Engine.push(L);
  R.Battle.start({ mons:[['fx_goblin',3]], bg:'grass' }).then((r) => { R.fxResult = r; });
  return R.Game.party.map((c) => c.name + ' HP' + c.hp).join(', '); })()
```
Screens:
* `/tmp/claude-0/tools/fork_battle_4p_font.png`: 3 windows (カタリ/アルバ/シエラ). **ミルテ is missing**
  (`battle_scene.js:16`).
* `/tmp/claude-0/tools/fork_battle_4p_cmd.png`: after 2×A, カタリ's command window shows 戦う / 特技 (greyed,
  no job) / 防御 / 道具.

Turn this into `tools/fixtures/boot/min.js`, loaded with `build --with`, so every owner has a working boot before
the real data lands.

---------------------------------------------------------------------------------------------------
## 9. Hard-coded Crest assumptions that break Chronicle tooling (checklist)
| Assumption | Where (tools/testing side) |
|---|---|
| 3 heroes `yuki non metem`, fixed | `R.PARTY_ORDER` (the deleted `data/chars.js:37`), `nameentry.js:15` `ORDER`, `ref:fixtures/battle/data.js:173-180`, `ref:test_battle.js` (224 refs), `ref:sim_balance.js:67-88,180`, `ref:fixtures/field/art_stub.js:70-72`, text checkers' `{yuki}{non}{metem}` whitelist (`ref:check_dungeons_a.js:336-343`) |
| Jobs / JP / job levels | `debug.js:33-49,79-88`, `rules.js:20` `JP_TABLE`, `ref:validate.js:43,97-129,267`, `ref:sim_balance.js:67-104,116-156`, `ref:check_jobs.js`, `ref:test_battle.js:699-757`, `art/chars.js:290-291` (`party:<id>:<job>` keys, 57 registered for Crest jobs) |
| 3 status windows | `battle_scene.js:16` `WIN.xs:[6,88,170]` (verified: 4th member not drawn), `sheet_{bosses,rare,postgame,tiles}.js` (see art.md #11) |
| 5 equip slots `weapon shield head body acc` + set slots | `rules.js:15` `SLOTS`, `ref:fixtures/battle/data.js:159-160`, `ref:validate.js:24`, `ref:fixtures/items/test_items.js:54` |
| 8 elements with `ice thunder holy`, 10 wtypes | `ref:validate.js:21-23` |
| Ship at `porta_dock` | `ref:progress.js:42-54`, `debug.js:67-74`, `ref:validate.js:233` |
| Crest ids (items, keys, troops, locations, shops, zones, bgm/sfx lists) | `ref:validate.js:34-47,78,162,171,229`, `ref:progress.js:17,171`, `ref:sim_balance.js:40-61,105-114`, `ref:fixtures/towns/smoke_npcs.js:15-22` |
| HTML title | `build.js:155,157` |
| Start map `regnas_castle` / `obj_start` | `state.js:9,22,25,28`, `systems/ending.js:222,281-282` (the warp is flagged by validate) |
