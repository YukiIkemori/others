# Porting note: field & events (Crest → Chronicle)

Scope: `src/systems/{field,field_map,events_runtime,minimap,gameover,ending}.js` and `src/data/tiles.js`.
Right now these are byte-identical to the reference at `/tmp/claude-0/ref/rpg`. The note also covers
how the reference authors maps (`ref/src/maps/*.js`) and events (`ref/src/events/*.js`), and how its tools
work (`ref/tools/gen_world.js`, `progress.js`, `validate.js`, `check_*.js`).
All `file:line` anchors point at the current fork copy (`chronicle/src/...`).

---------------------------------------------------------------------------------------------------
## 0. TL;DR: what must change

| # | What | Where | Why |
|---|---|---|---|
| 1 | Party follower array is fixed at 3 | `field.js:141` `this.P = [0,1,2].map(...)`, `field.js:188` `.slice(0, 3)` | 4-member party. Derive both from `R.PARTY_SIZE` (=4) or `R.Game.party.length`. The rest of the caterpillar code (`place`, `startMove`, `renderPos`, `npcCanEnter`, `drawSprites`) already loops over `P`, so it works for any N. |
| 2 | Party sprite key includes the job | `field.js:580` `'party:' + c.id + ':' + c.job`, `ending.js:86-89` | There is no job system. Use one key builder, e.g. `R.Art.partyKey(c)` → `party:<id>`, or `party:hero_<gender>` for the protagonist. |
| 3 | Start / respawn / ending map ids are hard-coded | `state.js:9,25` (`regnas_castle`/`start`), `ending.js:222,281-283` | These are Crest content. Must come from Chronicle data. |
| 4 | `R.PARTY_ORDER` is not defined in the fork (no `data/chars.js`) | `state.js:14` | `R.State.newGame()` throws right now, so `R.debug.newGameAt`/`Field.start` cannot run until data/chars exists (checked in node: 0 maps, 0 events, `PARTY_ORDER` undefined). |
| 5 | `ending.js` is 100 % Crest content | whole file (3 epilogues by `yuki/non/metem`, credits title `ルミナス・クレスト`, throne room of Regnas) | Rewrite it data-driven: iterate `R.Game.party`, add `© Studio Metem`, and put the post-clear resume point in data. |
| 6 | Auto-respawn on town entry lives in **content**, not in the field | ref `events/story.js:52-75` (`R.Story.autoRespawn` via `R.on('mapload')`) | The fork has no events. Without it, a wipe sends the party to `START` unless an inn/church/save was used. The brief asks for 「直前の町へ」, so port it (preferably into `field.js load()`). |
| 7 | Conditions cannot compare numbers (tier) | `state.js:52-63` `R.State.check`, plus copies in ref `tools/progress.js:20-31` and every `check_*.js` `mkState` | Tier-dependent NPC text, tilePatches, chests and events need e.g. `{tier:n}` (≥) / `{tierBelow:n}`. Every copy of `check()` must get the same change. |
| 8 | Encounters have no tier hook | `field.js:344-359` (`encounterStep`), `field.js:882-893`, battle `buildMons` `battle.js:1146-1153` | Resolve tier inside battle (`DB.encounters[zone].tiers[R.Game.tier]`). The field only needs `DB.encounters[zone]` to exist and read `.bg` from it. |
| 9 | Chests are fixed-item only | `field.js:632-664` `openChest` | A "tier chest" must be resolved at open time. The 99-cap message and the key-item jingle must use the resolved item. |
| 10 | Debug hooks are job-based | `debug.js:33-49,78-88` (`jp`, `setJobLevel`, `learnAll`) | Replace with `tier(n)`, `recruit(id)`, `party([...])`, `learn(charId, techId)`, `mastery(charId, kind, n)`. |
| 11 | QA tools were not copied | `chronicle/tools/` has only `build, shot, render_audio, sheet_*, lib/{load,maps}.js` | `validate.js`, `progress.js`, `gen_world.js`, `check_*.js` and `tools/fixtures/field/*` must be ported and de-Crested (see §9). |
| 12 | Idle "stepping in place" is DQ style | `field.js:445` (`else this.clock += 0.5`), NPC `af + n.seq` `field.js:570` | For the RS1 look, idle party and NPCs should stand on frame 0. Also consider an above-sprite layer (§4.10). |

---------------------------------------------------------------------------------------------------
## 1. Modules and data flow

```
title.js newGame → R.State.newGame() → R.Field.start(START.map, START.spawn)       (field.js:755)
title.js continue → R.State.deserialize() → R.Field.resume() (R.Game.pos)           (field.js:769)

R.DB.maps[id] ──R.FieldMap.compile(id)──► FieldMap M (tiles, npcs, chests, warps, events, signs, decor, indices)
                      field_map.js:167                   │  M.refresh() re-applies tilePatches + conds
FieldLayer L (field.js:137, one opaque layer, always at the BOTTOM of R.Engine.layers, field.js:705)
  update(): input → tryMove / examine / openMenu          tick(): movement, NPC AI, lift, banner, playFrames
  arrival → onArrive(): floors → step event → warp → encounter  (field.js:282)
  scripted work → R.Events.run(...)  (events_runtime.js:346), serialised; the field freezes while busy()
R.Events → ev API → R.UI.say / R.Battle.start / R.Field.warp / R.Shop.* / R.Menu.saveMenu / R.Ending.start
Emits: 'mapload'(id) field.js:736 · 'step'(map,x,y) field.js:295 · 'flag'(name,v) state.js:41 · 'objective'(id) events_runtime.js:226
```

Load-order rule: files only register things at load time. `R.Field`, `R.FieldMap` and `R.Events` are
used at runtime only. Node loading works (`require('./tools/lib/load')()`); `FieldMap.compile` is pure
logic, and the tools use it too.

---------------------------------------------------------------------------------------------------
## 2. Map schema as implemented (`field_map.js`)

`compile(id)` (`field_map.js:167-346`) does the following:
1. It picks the legend: `def.legend || (type==='world' ? 'world' : 'local')` (`:35`). It warns when a mark char is also a legend char; the mark wins (`:174`).
2. `outside` can be a legend char or a tile id. The default is `'sea'` on the world and `'void'` elsewhere (`:177-181`). `tileAt()` returns it beyond the edges, and it is drawn there.
3. Rows: a mark char places its objects and then puts the `under` tile (a legend char **or tile id**, default `'.'`) on the cell (`:261-275`). An unknown char becomes the legend `'.'` tile, with a warning. Rows of unequal length are padded with `outside`.
4. `decor` rows (optional, same size) are read through `R.DB.legends.decor`; `' '` and `'.'` mean nothing (`:285-304`).
5. Explicit lists are merged after the marks: `spawns{}`, `npcs[]`, `chests[]`, `warps[]`, `events[]`, `hidden[]`, `signs[]` (`:310-317`).
6. It checks bounds and unknown events, builds the per-cell indices (`chestIdx`, `warpIdx`, `signIdx` and `hiddenIdx` hold one object per cell, last one wins; `eventIdx` holds a list), then calls `refresh()` (`:330-345`).

**Fields read by the engine.** CREST_DESIGN §7.1 plus the ones that section does not document (marked ★):

| field | notes |
|---|---|
| `name` | Banner on entry (not on the world map); the save-slot place name. |
| `type` | `world` → minimap, `worldTile` art, tile bbg, sea outside. `dungeon` → teleport disabled. Default `town`. |
| `theme` | Art lookup `tile:<theme>:<id>` first for **any** tile id (`field.js:39`); gives the battle bg through `DB.themes[theme].bbg`. |
| `bgm` | Default from `DEFAULT_BGM` (`field_map.js:13`): world/town/castle/dungeon/shrine only (no `village` default). |
| `encounter`, `encRate`, `zones[]`, `defaultZone` | §4.4. The default `encRate` is world 26 / dungeon 22 / else 24 (`:12,43`). |
| `exit` | `{to,spawn,dir}`, **or ★ per direction** `{up:{to,spawn}, left:{...}}` (`exitFor`, `:139-144`). Walking off any edge uses it. |
| `escape` | Target for escape_rope / exit spells (`Field.canExit` `field.js:831`). Also used by minimap `partyWorldPos`. |
| `location` | Entering sets `R.Game.visited[location]=true` (`field.js:730`), which fills the teleport list. |
| `onEnter` | Event run after every load (deferred, `onlyOnMap`, `field.js:743`). The script must check its own flags. |
| `tilePatches[]` | `{cond, x, y, ch}` or ★`{tile}` id, ★`w,h` rectangle (`:147-155`). Re-applied on every `refresh()`. They change **tiles only**; there is no decor patch. |
| ★`bbg` | Forces the battle backdrop on local maps (`field.js:877`). |
| ★`noTeleport` | Overrides the "not in dungeons" teleport rule (`field.js:835`). |
| marks `spawn` | `'name'` or ★`{name, dir}`; the direction falls back to `mk.dir`. |
| npc | `{id, sprite, dir, move:'still'|'wander'|★'spin', text|event, cond, ★fixedDir}`. The sprite gets an `npc:` prefix unless it contains `:` (`:201`). Content-level extras are free keys on the npc object (`talk`, `greet`, `shop`, `price`), read by events through `ev.ctx.npc`. |
| chest | `{id, item, n}` \| `{id, gold}` \| ★`troop` (mimic battle first) \| ★`cond` (chest absent while false). |
| warp | `{to, spawn, dir, ★sfx}`. **No `cond` at runtime** (`warpIdx` is static). progress.js honours `w.cond`, but the game does not. Use a step event with `cond` plus `ev.warp` instead (as the ref world does for the abyss). |
| event | `{id, trigger:'step'|'examine', cond, once}`; a string is shorthand for `{id}`. |
| sign | `{text, ★cond}`; the text may be an array of pages. |
| hidden | Still implemented (`findHidden`, `field.js:665`) but banned by design. `validate.js` warns. Drop it in Chronicle. |

**Ids.** `uniq()` (`:184-190`) suffixes repeated npc ids with `_2`, `_3`, … (separate counters for npcs and
chests+hidden). This covers explicit lists too. `R.Game.chests[id]` is keyed by these ids, so **re-ordering a
map's rows can renumber the ids of duplicate chest marks and break saves**. Give chests explicit, unique ids;
the ref dungeons list chests explicitly with x,y for this reason.

**refresh()** (`:147-162`): rebuilds `tiles` from `base` plus the patches that hold. If anything changed it bumps
`version` and clears `wcache`/`dcache`. Then `npc.present = !hidden && (forced || check(cond))` and
`chest.present = check(cond)`. It runs after every top-level event (`events_runtime.js:334`), on `ev.refresh()`,
`R.Field.refresh()` and `R.debug.flag()`. It does **not** run on a bare `setFlag` from menu or battle code;
call `R.Field.refresh()` there.

**Static helpers** (`:349-372`): `peek(id)` caches a compile per def object (minimap, spawn lookups).
`findWorld(spawnName)` returns the world-type map that holds the spawn, preferring the map id `'world'`.
`spawnPos(name, mapId)`.

---------------------------------------------------------------------------------------------------
## 3. Tiles, legends, themes, decor (`data/tiles.js`, lead-owned)

- Tile props (`tiles.js:7-19`): `pass ship counter damage lock enc bbg themed anim warpIcon flagPass (+shipWhenFlag)`.
  - `walkable` (`field_map.js:79`): a non-`pass` decor blocks; otherwise `t.pass`, or `flagPass && !shipWhenFlag && flag`.
  - `sailable` (`:88`): `t.ship`, or `flagPass && shipWhenFlag && flag`. The `barrier` tile is only ever sailable, and only after `barrier_broken`.
  - `enc` is the terrain encounter multiplier; `undefined` means 1 (every local tile). `warpIcon` tiles have enc 0.
- Legends: `world` (`:108-116`), `local` (`:118-130`), `decor` (`:234-248`). The free mark chars are in
  `R.MARK_CHARS_LOCAL` and `R.MARK_CHARS_WORLD` (`:132-136`). **Update these strings whenever a legend changes**;
  validate.js warns on marks outside them.
- Themes (`:141-154`) carry only a name and a `bbg`. The art (`src/art/tiles_theme.js`) defines `A.THEME_DEFS`;
  a theme missing there renders as `generic`.
- Decor (`:166-249`): props `pass` (default false = blocks), `counter`, `wall`, `anim` (+`animRate`), `tall`
  (up to 16×32, bottom-aligned), `auto` (joins with neighbours through `R.Art.decorAuto[id]`).
- `ANIM_RATE` (`field.js:19`) is keyed by tile id; a new animated tile without an entry animates every 16 frames.
- For RS1-like towns and world you will probably add tiles (road, cliff, ruins, stone bridge, dock, tavern
  sign…). Each new world tile also needs entries in `minimap.js:9-34` (`TERRAIN`/`ICON`, or it draws as grass),
  in `gen_world.js` `WALK`/`ICON` sets (if generated), in the `art/tiles_world.js` `TCLS` class map, and possibly
  in the mark-char strings.

---------------------------------------------------------------------------------------------------
## 4. Field runtime (`field.js`)

### 4.1 Layer and freezing
- `locks` (`:144`) is raised by `runLocked` (`:204`), warps, battles and `ev.battle`. `update()` returns early
  while `locks>0 || R.Events.busy()` (`:406`) or while a move is in flight.
- The menu is **not** a lock: it is pushed on top, so the field `update()` simply stops (`:396-401`).
  `Menu._after` runs the teleport or exit once the menu closes (`menu.js:360`).
- `tick()` (`:432`) runs every frame even under menus and battles: `playFrames++`, movement interpolation, NPC
  walks. NPC AI only runs when the field is top, unlocked and no event is busy (`:446`).

### 4.2 Movement and caterpillar (hard-coded 3)
- Speeds (`:15`): walk 8 f/tile, dash 4, sail 6 / 3. Dash = `alwaysDash XOR Shift` (`:216`). A tap turns
  without moving (`TURN_DELAY 5`, `:16,422-429`). Bump sfx is throttled to every 20 frames.
- `startMove` (`:214-232`): each follower `P[i]` takes `P[i-1]`'s cell (trail). Sailing moves every `P` to the
  ship cell. `place()` stacks all members on one tile (warps, setPos); they fan out again as you walk.
- Drawn order: `members()` (`:186-189`) = first living member, then the rest in `R.Game.party` order, **sliced
  to 3**. Dead members follow at alpha 0.5 (`:581`).
- **Chronicle:** set `P` length = active party size (4) and drop the slice. Reserve members (控え) must **not**
  be in `R.Game.party`: every field helper (`State.alive/leader/healAll`, `fieldMods`) iterates `R.Game.party`.
  Keep the bench in `R.Game.roster` or similar. Note that `State.hasItem` counts equipped items only on
  `R.Game.party` (`state.js:71`), so gear on benched members does not count for key checks. Front/middle
  rows do not affect the field; order = party order.

### 4.3 Arrival pipeline (`onArrive`, `:282-342`), in order
1. `steps++`. On `board` the party gets onto the ship (sea BGM). `savePos()` writes `R.Game.pos`, then `emit('step')`.
2. Off-ship only: `damage` floors hurt every living member (can KO; `noFloorDamage` negates). Poison takes 1 HP
   per step down to a minimum of 1. `walkHeal` (party max) heals. If all are dead → `Field.gameOver()`.
   Then 「○○は力尽きた……」 for the fallen.
3. `repelSteps--`; when it hits 0 the 「魔除けの効果が切れた。」 message is queued.
4. **Step event** (first matching only). **A warp on the same cell is then skipped**, and so is the encounter.
5. Else a **warp**. Else, only if nothing was queued, an **encounter** check. Arriving by `place/load` (spawn,
   warp target) never triggers anything, which is why exits and spawns can share the icon cell.

### 4.4 Encounters
- Zone = first `zones[]` rect containing the cell → `defaultZone` → `encounter` (`field_map.js:134-137`).
  Towns without `encounter` are safe.
- Counter: `encCount = encRate × rf(0.6,1.4)` (`:168`). Each step subtracts `tile.enc × max(0, 1+encounterPct/100)`
  (`:350-354`). `encounterPct` is the party's strongest magnitude, ties toward negative (`fieldMods`, `:170-184`,
  cached for 20 frames).
- Repel (`R.Game.repelSteps`, `Field.repel(steps)` = max, not additive, `:852`) blocks **all** encounters.
  So does `Field.noEncounter`.
- Battle: `Field.encounter(zone)` → `R.Battle.start({zone, bg: battleBg(zone)})`; `'lose'` → `gameOver()`
  (`:882-893`). Backdrop (`:870-880`): world = tile `bbg` → zone `bg` → grass; local = `map.bbg` → theme `bbg`
  → zone `bg` → cave. Rare monsters are swapped in **by battle** from `DB.rareEncounters[zone]`
  (`battle.js:853-857`). `DB.encounters[zone].lv` is metadata only; only the sim tools read it.
- **Tier (Chronicle):** keep the zone ids per area and let battle pick `tiers[R.Game.tier]` (or a `minTier`
  per group) in `buildMons`. The field keeps checking only `DB.encounters[zone]` (`:356`, it warns if missing)
  and `.bg`. Do not invent `zone@tier` ids unless the base id also exists.

### 4.5 A button (`examine`, `:369-389`), in priority order
The NPC in front, or an NPC across a `counter` tile/decor (`counterAt`) → the chest in front → the sign in front →
an `examine` event in front → a hidden item in front → an `examine` event underfoot → a hidden item underfoot.
`talk()` (`:390-395`) turns the NPC to face the player (not `mon:` sprites, not `fixedDir`) and pauses its AI for
90 frames, then calls `R.Events.talk(npc)`: `npc.event`, or its `text` pages (`'……'` if none).

### 4.6 NPC movement
- `wander` (`:472-483`): every 50–170 frames it tries one random step, staying within ±2 tiles of home.
  `npcCanEnter` (`:484-495`) refuses counters, damage floors, warpIcons, doors, stairs, warp pads, warp, chest,
  sign and event cells (**event cells even when the event's cond is false**), other NPCs, every party cell,
  and the ship.
- `spin` rotates every 24–56 frames. `still` stays put.
- Scripted walks: `ev.npc(id).walk('U3L2')` → `Field.walkNpc` (`:902`, `parsePath` `:599` supports repeat
  counts). They ignore collisions, and the new position becomes home. Paths are flushed on map change (`:712`).
- NPCs block the player (`npcAt` also blocks the cell they are leaving, `field_map.js:99`).

### 4.7 Chests (`openChest`, `:632-664`)
- The inventory cap is 99: the chest stays closed and shows 「しかし、これ以上は持てない！」.
- `troop`: mimic battle first; the chest stays shut unless the battle is won.
- `R.Game.chests[id]=true`, then gold, or an item (`keyitem` jingle for `type:'key'`), or 「空っぽだった」.
- Messages are joined by `R.Events.lines` (a phrase-aware line break sized to the message window,
  `events_runtime.js:40`). The currency word **ゴールド is hard-coded** (`:656`, `events_runtime.js:113`). Change it
  if Chronicle renames the currency.
- The opened/closed look comes from `obj:chest` `[closed, open]`.
- **Tier chest (Chronicle):** add `c.tier:'<table>'` → `item = R.Loot.rollChest(c, R.Game.tier)` at open time.
  Store the resolved item if you want to show it later. Keep story key items in fixed chests or events so
  progress.js can see them.

### 4.8 Doors and locks
- A tile id starting with `door` opens when stepped on (sfx `door`). `M.opened` maps the cell to the floor tile
  beyond it (or the floor behind it) **for this visit only** (`openDoor`, `:690-695`).
- An opened door is drawn with the plain `tileGfx` of that floor, **not** the context art (`cellGfx`, `:47`),
  so it can look flat next to autotiled floors.
- `lock:'item'` (door_silver/door_gold): without `R.State.hasItem(lock)` you get 「鍵がかかっている。」 and are
  blocked; the message is not repeated while the direction is held (`:261-267`). The key is never consumed.
- A `lock` on a non-door tile blocks without the key but never "opens".

### 4.9 Warps, exits, escape, teleport, ship
- Warp: `useWarp` (`:360`) plays `w.sfx` or the stairs/warp-pad sfx, then `Field.warp(to, spawn, {dir})`.
  `Field.warp` (`:785`) fades 12 frames, `load()`, fades in, then `afterEnter`.
- `load()` (`:716-738`): compiles a fresh map (so door state, `hide()`/`show()` and NPC positions reset),
  resolves the spawn (name or `{x,y,dir}`; an unknown name falls back to `entrance`, then the first spawn, then
  a walkable cell near the centre), and places the party. It works out `onShip`, sets `visited[location]`,
  resets the encounter counter, sets the BGM, then `savePos` and `emit('mapload')`.
- `afterEnter` (`:740`) shows the name banner if the name changed and runs `onEnter` deferred.
- Edge exit: `tryMove` off-map → `M.exitFor(d)` (`:250-255`).
- Escape: `Field.exitDungeon()` (`:839`) → `M.escape`.
- Teleport: `Field.teleport(locId)` (`:801-826`) → `DB.locations[id]` `{name, map?, spawn, dock?}`, with a lift
  animation. `map` may be any map (for example a town `entrance`), so teleporting straight into towns works.
  The ship moves to `dock` only when owned. `canTeleport` = not `type:'dungeon'` unless `noTeleport` is set
  (`:833`). `teleportList` returns visited locations in `DB.locations` key order.
- Ship: `R.Game.ship {map,x,y,dir}` and `onShip`. Walk onto its cell to board (`:257`). You sail on `sailable`
  cells. You land on any walkable cell with no chest or lock (`:247`); landing on a town icon warps you in at
  once. NPCs block the ship. `ev.giveShip(worldSpawn)` places it (it does **not** set `has_ship`; the ref event
  sets that flag itself). The code costs nothing while `R.Game.ship` is null. The brief's 定期船 (ferries) can
  be plain events (`ev.warp('world', '<dock spawn>')`) with no ship at all.

### 4.10 Camera and rendering
- Camera (`:196-203`): centred on the leader, clamped to the map; maps smaller than the screen are centred.
  There is no wrap.
- Tile pass (`drawTiles`, `:82-125`): a 17×15-cell off-screen buffer (`BW/BH`, sized for 256×224). It redraws
  when the camera crosses a cell or, if anything animates, every 8 frames.
  - Per cell (`cellGfx`, `:44-62`): outside tile → opened door → **`R.Art.worldTile(map,x,y)` on world maps /
    `R.Art.localTile(map,x,y)` elsewhere** (cached per cell in `m.wcache`; errors are logged once) → `tileGfx`
    (`tile:<theme>:<id>` → `tile:<id>`).
  - Decor is a second pass into the same buffer: `R.Art.decorTile` → `decor:<id>`, bottom-aligned, one extra row
    below for tall props.
- The art contract is only `map.tileAt(x,y)` (plus `map.theme`, `map.decorAt`). `worldTile` blends a 3×3
  neighbourhood (`art/tiles_world.js:1-13,766`) and caches by neighbourhood signature. `gen_world.fixDerived`
  exists because hill/mountain colour is derived from plain cells within 2 tiles, so generator and art are
  coupled.
- Sprites (`drawSprites`, `:534-584`): NPCs, the ship and members are y-sorted **above** all tiles and decor.
  - Sheets: `{down:[f..], up, left, right}` or an array or a canvas (`sheetFrame`, `:127`); any frame count
    works; they are bottom-aligned and centred on the tile, so 16×32 RS-style sprites work as they are.
  - `mon:` sprites are drawn as-is (visible bosses).
- **RS1 look:**
  1. Stop idle stepping (`:445` and the `af + n.seq` idle frame at `:570`).
  2. Consider a decor flag `over:true` drawn **after** sprites (roof eaves, tree canopies, arches). There is no
     above-sprite layer today.
  3. Consider decor patches (flag-dependent props, for "the town changes after the region is cleared").
- The banner (`:585-595`) shows the map name for 130 frames. `Field.showCoords` (`?debug=1`) prints the map
  id and x,y.

### 4.11 Respawn, save, game over
- `R.Game.respawn` is set by `Field.setRespawnHere()` (`:853`), which is called from `ev.inn` (after a
  successful stay), `ev.church`, `ev.saveMenu`, `shop.js:263,276` and `ending.js:282`. The ref also sets it from
  content on every town entry (item 6 in §0).
- `Field.respawn()` (`:859`) leaves the ship and warps to `respawn` (`{map,x,y,dir}` or `{map,spawn}`,
  falling back to `START`).
- Save points: there are no save-point objects. Saving happens in the menu anywhere, or through an NPC/examine
  event calling `ev.saveMenu()`. `R.Game.pos` is updated on every step and turn (`savePos`), so a save always
  resumes at the exact cell.
- `gameover.js`: `GameOver.run` (`:51-92`) shows the 「全滅してしまった……」 screen with the jingle (skippable,
  at most about 7 s), then `R.State.wipeRecover()` (gold halved, full heal), `Field.respawn()`, and
  「……{leader}たちは目を覚ました。」 plus the gold-loss line. It works for 4 members as it is; only the wording
  might need STYLE changes.

### 4.12 `R.Field` API (`field.js:747-935`)
`start(map,spawn)` · `resume()` · `warp(map, spawn|{x,y,dir}, {dir,fade,frames})` · `teleport(locId)` ·
`teleportList()` · `canExit()` · `canTeleport()` · `exitDungeon()` · `repel(steps)` · `setRespawnHere()` ·
`respawn()` · `refresh()` · `isBusy()` · `battleBg(zone)` · `encounter(zone)` · `gameOver()` · `npc(id)` ·
`walkNpc(n,path,dur)` · `walkParty(path,dur)` · `facePlayer(dir)` · `setPlayerPos(x,y,dir)` · `pos()` · `front()` ·
`parsePath` · `noEncounter` · `showCoords` · getters `map` (live FieldMap) and `layer`.

---------------------------------------------------------------------------------------------------
## 5. Event runtime (`events_runtime.js`)

- **Serialisation** (`:17-20,346-354`): one promise queue. `busy()` = queued + running.
  - `R.Events.run()` called from inside an event runs **inline** (no deadlock) unless `ctx.defer` is set, which
    queues it after the current one (onEnter after an `ev.warp`).
  - After a top-level event: the message window closes and `Field.refresh()` runs (`:329-334`).
- **`once`** (`:333`): the flag is set automatically when the run finishes normally, returned something other
  than `false`, and no battle in it was escaped.
  - Returning `false` means "not done": the event retries next time (bosses lost or escaped, gate refused).
  - Only map events pass `once` (`field.js:332,383`); NPC talk never does.
- **Abort** (`:15,249-261`):
  - A lost battle without `canLose` runs the game over and throws `ABORT`; the event ends silently.
  - `R.Events.reset()` (title / new game) bumps `gen`, and every `ev.*` call of an older event then throws
    `ABORT`.
- `ctx`: `{self, npc, trigger:'talk'|'step'|'examine'|'enter', once, x, y, onlyOnMap}`. Scripts read the
  talking NPC's own fields through `ev.ctx.npc` (ref `events/story_town.js:12`).

**`ev` API** (`makeEv`, `:61-247`). Documented calls plus the ones CREST_DESIGN omits (★):

| call | line | behaviour / gotcha |
|---|---|---|
| `say(text\|pages[], opts)` | 71 | `keep:true` by default, so consecutive says share one window. `fmt` replaces only `{leader}`; the UI replaces `{yuki}{non}{metem}` (`ui/ui.js:14-32`). Chronicle needs `{hero}` and the like there. |
| `ask(text, choices, opts)` | 75 | → index or −1. |
| `yesno(text)` | 79 | |
| ★`gotItem(text, jingle)` / ★`closeMessage()` | 80-81 | |
| `flag setFlag check var setVar has take gold takeGold` | 84-92 | Sync. `has` counts equipped items. |
| `give(item,n,{silent})` | 95 | Refuses (and says so) past 99; key items play the `keyitem` jingle. |
| `giveGold(n,{silent})` | 109 | |
| `battle(troop\|opts, {canLose,noEscape,bgm,bg})` | 118 | Closes the window. `bg` defaults to troop bg, then `Field.battleBg()`. With `canLose`, dead members are set to 1 HP. |
| `warp(map, spawn, opts)` | 144 | |
| `wait fadeOut fadeIn shake flash` | 145-149 | `shake` and `flash` also wait. |
| `sfx bgm jingle` | 150-156 | `bgm()` with no id restores the map (or sea) BGM. |
| `npc(id)` → `{x,y,dir,visible, face(dir\|'player'), walk(path,frames), hide(), show(), setPos()}` | 158 | `hide/show` last **only until the map reloads**. Persistent changes = flag + NPC `cond` + `refresh()`. |
| `player` → `{x,y,dir, face, walk, setPos}` | 187 | `walk` moves the whole caterpillar, with no triggers or collisions. There is no per-member handle; add `ev.member(i)` if 4-person cutscenes need it. |
| `heal()` | 197 | `State.healAll`. |
| `inn(price)` / `shop(id)` / `church()` / `saveMenu()` | 199-222 | These use `R.Shop.*` / `R.Menu.saveMenu`, with fallbacks (`:264-303`). Inn, church and save set the respawn point. |
| `setObjective(id)` | 223 | Warns if the objective id is unknown. |
| `giveShip(worldSpawn)` | 228 | |
| `refresh()` / `ending()` | 234-240 | |
| ★`call(id)` | 242 | Runs another event inline (shares the window). |
| ★`map`, `self`, `leader`, `ctx` | 66-68 | |

**Chronicle additions** (propose to the lead in DESIGN.md): `ev.tier()`; `ev.clearRegion(id)` (flag + tier++ +
年代記 chapter); `ev.partyMenu()` (tavern swap, menu owner); `ev.recruit(id)`; `ev.member(i)`; and a tier-aware
`check`.

---------------------------------------------------------------------------------------------------
## 6. Minimap and ending

- **Minimap** (`minimap.js`):
  - It works only for the world-type map (`findWorld`); the scale is `floor(min(256/w, 224/h))`, so a
    128×112 world draws at 2 px per tile. A world larger than 256×224 tiles would overflow.
  - Colours come from the `TERRAIN`/`ICON` tables keyed by tile id. Icons are linked to `DB.locations` through
    the spawn on the icon cell, and visited ones are highlighted.
  - The party position inside a town/dungeon is found through escape/exit/location/map-id world spawns
    (`:107-115`).
  - The cache key includes the Crest flag `barrier_broken` (`:62`). Replace it with `m.version` or with the
    flags your tilePatches use.
- **Ending** (`ending.js`): the reusable parts are the `EndingLayer` scene runner (`:92-112`) and the
  narration/epilogue/credits/fin scene builders. Everything else is content:
  - `CREDITS` (`:13-24`), `EPILOGUES` keyed by `yuki/non/metem` (`:26-42`), `throneRoom()` warp to
    `regnas_castle`/`ending` (`:221-240`), the party walk ids (`:184,206`).
  - The clear-save block (`:277-288`): `game_clear`, `clears++`, `pos`/`respawn` = regnas, `obj_postgame`.
  - Chronicle: epilogues from each companion's data for the members in `R.Game.party`, credits with
    `ルミナス・クロニクル` and `© Studio Metem`, and the clear position and objective from data. The brief
    requires "エンディング後にセーブして再開".

---------------------------------------------------------------------------------------------------
## 7. Debug hooks (`systems/debug.js`, field-owned in Crest)

`R.debug.warp(map, spawn|{x,y})` (no fade) · `give` · `flag(name,v)` (+refresh) · `gold` · `level(n,charId)` ·
`jp` ✗ · `noEncounter(bool)` · `heal` · `setJobLevel` ✗ · `newGameAt(map,spawn)` · `pos()` · `battle(zone|troop)` ·
`event(id)` · `ship(spawn)` · `visitAll()` · `teleport(loc)` · `maps()` · `learnAll` ✗ (✗ = job system, remove).
`?debug=1` shows the coordinate overlay. Use them from `tools/shot.js --eval "RPG.debug.newGameAt('x')"`.
Add `tier(n)` and the recruit/party/learn hooks.

---------------------------------------------------------------------------------------------------
## 8. How the reference authors content (patterns worth copying)

- **Map files** (`ref/src/maps/*.js`) are IIFEs doing `R.DB.maps.<id> = {...}`. Each opens with local helpers
  (`town_regnas.js:10-17`): `npc(id, sprite, under, o)`, `say(...)` (npc with `text`),
  `chat(id, sprite, under, talk[], text)` (the `chat` event with `{cond,text}` variants), `shop(...)`,
  `sign(text, under)`, `chest(id,item,n,under)`, `warp(to,spawn,under,dir)`, `spawn(name,dir,under)`.
- Towns: every map has a full `decor` layer. Every interior has `exit` or warps back. `location` is on town,
  castle and house maps, and there is a comment "Contracts:" block for positions other agents rely on (for
  example the `ending` spawn).
- Dungeons (`dungeons_a.js:1-25`):
  - Floor 1 has spawn `entrance` and a warp to the world spawn named after the map; stairs arrive at spawns
    `up`/`down`; `escape:{to:'world', spawn:<floor-1 id>}`; `encounter:'d_<x>N'`; chests are listed
    **explicitly** with x,y and global ids.
  - Visible bosses are NPCs `foe(id,'mon:<sprite>',event,doneFlag)` with `cond:'!done'`.
  - A band of `step` events around the boss (`cond:'!done'`) starts the fight.
  - After the win, `vanish()` (setFlag → refresh) removes the foes, a tilePatch reveals a warp pad, and a step
    event `*_exit_circle` warps to `escape`.
  - Crest/key pickups are NPCs `obj:crest_glow` with `cond:[boss,'!got']`.
- **Events** (`ref/src/events/*.js`) are `R.DB.events.<id> = {meta:{needs,gives,[warp]}, run: async(ev)=>{}}`.
  - Service NPCs `shop/inn/church/chat` read their parameters from the NPC (`story_town.js:15-50`).
  - Intro via the map's `onEnter` plus a flag check (`story.js:112`).
  - `R.Story` in content derives the objective from flags and items on `mapload`/`flag`/`step`
    (`story.js:18-45,71-75`). Chronicle needs an equivalent (tier and region based).
- World: `ref/src/maps/world.js` is **generated** (never hand-edit). Location icons are world warps to
  `entrance`; world spawn = map id (on the icon); docks `<loc>_dock` sit on sea cells. `DB.locations` maps
  teleport ids to those spawns.

---------------------------------------------------------------------------------------------------
## 9. Tools (the reference has them; the Chronicle fork does not yet)

**`gen_world.js`** (940 lines, deterministic, writes `src/maps/world.js`; `--dry`, `--dump f`):
- Noise: `hash` → value noise `vnoise` → `fbm` (`:39-60`). Shapes are signed-distance functions: `ell`, `cap`
  (polyline capsule with radius r0→r1), `union`, `minus`, `ring`, domain `warp` (`:63-115`).
- `LANDS[]` (`:137-276`): per landmass `{id, seed, amp, warp, ground, body:SDF, layers:[[char, SDF,
  {amp,scale,seed,on,dens}]]}`. `MEADOW` sprinkles copses and hills.
- Hand-placed tables: `ICONS` (map id, char, x, y, land, optional `coast` slide), `DOCKS`, `RIVERS` (1-tile
  sea lines plus bridge cells), `LAKES`, `RING` (demon barrier), `REEFS`, `DIVIDER` + `GATE_Y` (the mountain
  wall and the two gate icons), `ABYSS`.
- `generate()` (`:865-892`) pipeline:
  1. paintLands, enforceBorder(3), smoothCoasts, cleanSpecks, checkSeparation (≥2 sea tiles between lands).
  2. paintWaters (lakes, rivers, straight-river bridge check), paintDivider, paintIcons (clears swamp and
     mountains next to towns).
  3. paintRing, paintReefs, repairConnectivity: a Dijkstra per icon group opens the cheapest mountain/magma
     path (cost 6). `PROTECT` cells are never opened; an opened mountain becomes hills or ground.
  4. paintBeaches; placeDocks (opens a shore, then picks a sea cell with ≥4 open neighbours next to reachable
     shore; inside the ring for the demon island); placeAbyss; fixDerived; sealPockets (unreachable walkable
     cells become mountains).
  5. Spawns (icon cells, facing open ground), warps (icon → map `entrance`) and zones. `buildZones`: land
     components get a zone by BFS from the castle and from Porta, else by landmass; a greedy rectangle cover
     follows, plus 2 sea rectangles and `defaultZone w_sea1`.
  6. `emit()` → `rows/spawns/warps/zones/defaultZone/tilePatches/events`.
- Chronicle:
  - Reuse the noise, SDF, painting, repair, dock and zone-rect machinery as-is.
  - Rewrite `LANDS`, `ICONS`, `DOCKS`, `RIVERS`, `RING`, `ZONE_OF_LAND`, the `repairConnectivity` groups,
    `landZoneMap` (it hard-codes `regnas_castle`/`porta_town`/`GATE`), `placeAbyss` and the `emit` name.
  - Zones should be per region (8 regions + hub + finale). The tier is handled by battle, so zones stay static.

**`progress.js`** (176 lines): a fix-point over BFS reachability.
- Each map is parsed with `tools/lib/maps.js parseMap`.
- Walkability accounts for tiles + tilePatches (evaluated against the state), locks (items), decor blockers,
  still NPCs with a true cond (wander NPCs never block), `flagPass`, and the sea once `has_ship` is held.
- Warps (it honours `cond`, the runtime does not), `exit` edges, and step events declaring `meta.warp`.
- Each round it collects chests next to reached cells (also across counters), fires `onEnter`, NPC events and
  map events whose `meta.needs` hold, and adds their `meta.gives`. It repeats until nothing changes, then
  requires `game_clear`.
- Crest assumptions to remove: start item `herb` (`:17`); `'ship'` → `flag:has_ship`; the ship starts at
  `world.porta_dock` (`:41-54`); a synthetic `flag:visited_<loc>` (it does not exist at runtime); the key list
  (`:171`); the map id `world`.
- `ev.warp` calls inside scripts are **not** followed; declare them in `meta.warp`.
- **Chronicle:** add tier state (count region-clear flags) to `check()`, and treat tier chests as non-key.
  The any-order regions work naturally with BFS.

**`validate.js`** (286 lines): cross-reference errors and warnings; exit 1 on errors.
- Items, jobs, abilities and monsters; encounters (≤3 species, ≤8); troops; shops; maps (issues from
  parseMap, bgm/theme/zones, mark chars in the free lists, `entrance` spawn on non-world maps,
  warp/exit/escape targets and spawns, wall decor on walkable cells, furniture on blocked cells, npc on
  furniture or impassable tiles, sprite keys, unique chest ids, a warning for hidden items, event/onEnter/location
  refs); locations and docks on sea.
- It also scans the source text with regexes for `ev.battle/give/take/has/shop/setObjective/warp/giveShip` and
  `sfx/bgm/jingle` literals, and checks gfx registration (`tile:`, `tile:<theme>:`, `bbg:`, `decor:`,
  `party:<c>:<job>`, `npc:`, `obj:`, `icon:`) and the audio registry.
- **Chronicle:** the constant lists at `:21-47` (elements, weapon types, jobs, locations, troops, keys, BGM/SFX)
  and the job/ability blocks are Crest-specific; generate them from DESIGN.md or data.

**`check_*.js`** (one per owner area): 
- Static schema checks.
- BFS reachability per story state; the "each state reaches exactly the next boss and nothing behind it" rule.
- No chest may block a path.
- Event **dry runs** with a stub `ev` (`check_dungeons_b.js:419-460`): battles won, yes to every question; the
  flags and items handed out must equal `meta.gives`.
- Text lint (STYLE_JA: window width with 6-character names, 4 lines per page, no hard-coded hero names,
  full-width space after a mid-line ！/？).
- `--png DIR` renders maps with the real art through Playwright (`check_towns.js:226-300`; `check_world.js`
  writes the PNG with zlib).
- `tools/fixtures/field/` has a node field test (`test_field.js`, driving `R.Engine.step()` with fake input over
  fixture maps) and a browser harness builder. Port both; they are the fastest regression test for §4.

**`tools/lib/maps.js parseMap` ≠ `FieldMap.compile`** (the tools can disagree with the game):
- Spawn marks in object form `{name}` are not supported.
- `under` must be a legend char (not a tile id); unknown chars become `void` (the game uses the `'.'` tile).
- One shared suffix counter for npc/chest/hidden, and different fallback ids (`npc_<ch>`, `chest_<map>_<ch>`).
- Explicit-list ids are not suffixed.
- tilePatches and warp conds are left to each tool.

Either make the tools call `R.FieldMap.compile` (it is node-safe) or keep the two in sync.

---------------------------------------------------------------------------------------------------
## 10. Chronicle feature → field impact

| Feature | Field/event impact |
|---|---|
| 4-member party + bench | §0 #1. Caterpillar of 4. Benched members live outside `R.Game.party`. Tavern swap = event → menu. `members()` needs no other change. |
| Hero with gender, 20 candidates | Sprite key per character (`party:<id>`, hero `party:hero_m/f`). NameEntry/`{yuki}` placeholders → `{hero}` (ui.js). Text uses `{leader}`/`{hero}`, never `3人` (ref events hard-code 「3人を…」). |
| No jobs | Sprite key (§0 #2), `debug.js`, `state.js:151` job fallback, `Rules.fieldActions` (menu) → field-usable techs and spells. The field side only needs `Field.teleport/exitDungeon/repel/canTeleport/canExit`. |
| 閃き techs/spells | None in the field (battle only). Field spells go through the menu. |
| 9 equipment slots | Only indirect: `State.hasItem` loops `R.Rules.SLOTS`; `fieldMods` reads `R.Rules.mods(c).encounterPct/walkHeal/noFloorDamage` (keep these mod names; `treasureSense` can go with the hidden items). |
| Front/middle rows | None in the field. |
| Tier-scaled content | Encounters in battle (§4.4), tier chests (§4.7), a `tier` cond in `State.check` and every tool copy (§0 #7), `R.Game.tier` in the save, `debug.tier(n)`. |
| 8 regions any order, world changes on clear | Gating via flags and NPC conds; `chat` variants; tilePatches (tiles only; add decor patches if needed). progress.js handles any order. check_world's phase list must be rewritten. |
| RS1-like field art | §4.10 (idle frames, above-sprite decor layer, tall sprites OK). New world/local tiles need minimap, gen_world and art class entries (§3). |
| Ferries (定期船) instead of / before a ship | Ferry = event warp between dock spawns; the ship code can stay dormant. Replace `barrier_broken` in minimap.js. |
| Auto-respawn "直前の町" | Port `autoRespawn` (§0 #6). |
| Post-clear save & 裏ダンジョン | Ending sets the clear position and objective (data); a world tilePatch plus a step event with `cond:'game_clear'` and `meta.warp` (the ref abyss pattern, `world.js:272-273`). |

---------------------------------------------------------------------------------------------------
## 11. Gotchas (quick list)

- A step event on a warp cell swallows the warp (§4.3). The encounter check is skipped on steps with any
  queued message (floor KO, repel expiry).
- Warps have no runtime `cond`. `hide()`/`show()`, door state and NPC positions reset on every load.
- Event cells block wandering NPCs even when the event's cond is false. Wander NPCs can plug a 1-wide corridor
  (validators ignore them).
- `R.Field.refresh()` is needed after flag changes made outside events.
- Duplicate chest mark ids get order-dependent suffixes, which can break saves.
- `ev.say` placeholders: only `{leader}` is replaced in events_runtime; the rest is done in UI `R.Text.fmt`,
  where the new placeholders must be added.
- The currency word ゴールド is hard-coded in field.js and events_runtime.js.
- `playFrames` increments in `FieldLayer.tick`, so play time counts only while the field layer exists
  (including under menus and battles).
- The ref `progress.js` currently reports `UNREACHABLE CHESTS: elfin_village:elfin_h1` and validate shows
  9 hidden-item warnings. Do not copy those maps' patterns.
