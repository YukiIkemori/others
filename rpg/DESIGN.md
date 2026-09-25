# ルミナス・クレスト — Design & Engineering Contract

This document is the single source of truth for everyone building the game.
If code and this document disagree, fix one of them — never silently diverge.

## 0. The product

A complete, polished, browser-playable **Japanese command RPG**:

* **Presentation**: Super Famicom *Dragon Quest V* quality — 256×224 logical screen, 16×16 tiles,
  detailed pixel art with shading, animated water, DQ-style black windows with white rounded borders,
  front-view battles with large shaded monster sprites over a terrain backdrop, chiptune/SFC-style music.
* **Scope**: FC *Dragon Quest II* volume — one overworld with several continents, a ship, ~9 towns/shrines,
  ~8 dungeons (22 floors), 5 crests to collect, a final castle, ~85 regular monsters, 11 boss fights,
  6–8 hours to clear. **Simple story** (DQ2-level), **no side quests**.
* **Party**: exactly three, fixed, together from the first second: **ユウキ** (m), **ノン** (f), **メテム** (f).
* **Growth**: *Final Fantasy Tactics*-style **job system**: JP per job, job levels 1–8, job trees with combined
  prerequisites, abilities bought with JP, and ability slots
  (**job command + サブアクション + リアクション + サポート + フィールド**).
* **Loot**: every monster has a normal drop and a **rare drop**; a monster book (ずかん) tracks what you found.
* **Modern QoL**: always-dash (toggle), save anywhere outside battle, auto-battle, fast messages, battle
  speed, optimize equipment, visible next objective, teleport to visited towns, dungeon escape, world map,
  no lost EXP on a wipe (only half the gold), generous escape rates, encounter-control abilities.
* **Language**: all in-game text is Japanese for adult players: **natural modern kanji-kana mixed text**, no
  DQ-style inter-phrase spaces. Follow **STYLE_JA.md** (rules + glossary of canonical terms) exactly.
* **Player-named heroes**: the player names the three heroes at the start (hiragana/katakana/ASCII only).
  Never hard-code ユウキ/ノン/メテム in text: use `{yuki}` `{non}` `{metem}` `{leader}` (resolved by `R.Text.fmt`,
  applied automatically by `R.Gfx.text`, `textWidth`, `wrap` and every message window). Code uses `c.name`.
* **Originality**: nothing copied from Dragon Quest / Final Fantasy: no DQ/FF-specific names
  (メラ/ホイミ/ルーラ/スライム/ケアル/ファイガ/エスナ/レイズ…), no copied melodies, no copied sprites.
  Generic fantasy vocabulary is fine (ファイアボール, ヒール, ゴブリン, スケルトン, ドラゴン…).

## 1. Tech & conventions

* Plain browser JavaScript, no dependencies, no network at runtime. Everything is drawn procedurally on a
  canvas; the only binary asset is the DotGothic16 font (OFL), subset & embedded by the build.
* Every file is an IIFE: `(function (R) { 'use strict'; ... })(window.RPG);`
* **At load time a file may only register things** (`Object.assign(R.DB.items, {...})`,
  `R.Gfx.def(...)`, `R.MySystem = {...}`, `R.onBoot(fn)`). No DOM access, no reading other modules'
  runtime state, no dependence on load order within a directory. Cross-module wiring happens at runtime.
* Load order: `src/core` (ns, input, gfx, engine, save, then alphabetical) → `src/ui` → `src/data` →
  `src/art` → `src/audio` → `src/maps` → `src/events` → `src/systems` → `src/main.js`.
* Build: `node tools/build.js` → `dist/index.html` (single self-contained file) + `debug.html`
  (loads each source file separately — use it for readable stack traces).
  Files with syntax errors are excluded from the build with a warning.
* Visual check: `node tools/shot.js --out /tmp/x.png --eval "..." --keys "..."` (see header of the file).
  **Look at your screenshots** with the Read tool — this is how you verify visual quality.
* Node logic tests: `const R = require('./tools/lib/load')()` loads all sources in node (no DOM).
* Test fixtures go in `tools/fixtures/` — never ship test content in `src/`.
* Style: 2-space indent, semicolons, single quotes, small focused functions, comments only where they help.
* Ids are `snake_case` ASCII. Display names are Japanese.

### File ownership (build phase)

| Area | Files | Owner |
|---|---|---|
| Core engine | `src/core/{ns,input,gfx,engine,save}.js`, `src/ui/ui.js`, `src/main.js`, `tools/build.js`, `tools/shot.js`, `tools/lib/load.js` | lead (ask; don't edit) |
| Rules/state | `src/systems/rules.js`, `src/systems/state.js`, `src/data/chars.js`, `src/data/tiles.js` | lead |
| Audio | `src/core/audio.js`, `src/audio/*.js` | audio |
| Field | `src/systems/field*.js`, `src/systems/events_runtime.js`, `src/systems/minimap.js` | field |
| Battle | `src/systems/battle*.js` | battle |
| Menus | `src/systems/menu*.js`, `src/systems/shop.js`, `src/systems/title.js`, `src/systems/gameover.js` | menu |
| Jobs & abilities | `src/data/jobs.js`, `src/data/abilities*.js` | jobs |
| Items & shops | `src/data/items.js`, `src/data/shops.js` | items |
| Monsters | `src/data/monsters.js`, `src/data/encounters.js`, `src/data/troops.js`, `src/data/enemy_abilities.js` | monsters |
| Tile/backdrop art | `src/art/tiles*.js`, `src/art/battlebg.js` | art-tiles |
| Character art | `src/art/chars.js`, `src/art/objects.js` | art-chars |
| Monster art | `src/art/monsters*.js` | art-monsters |
| Boss art | `src/art/bosses.js` | art-bosses |
| World & towns & story | `src/maps/world.js`, `src/maps/towns*.js`, `src/events/story*.js`, `src/data/locations.js`, `src/data/objectives.js`, `src/systems/ending.js`, `tools/gen_world.js` | story |
| Dungeons | `src/maps/dungeons*.js`, `src/events/dungeons*.js` | dungeons |

If you need a change in a file you do not own, work around it and **report the needed change in your
final answer** (exact file, what, why). Other agents are editing their own files at the same time; if the
build breaks because of someone else's file, ignore it and test your part in isolation.

## 2. Core runtime API (implemented)

### R namespace (`src/core/ns.js`)
`R.W=256, R.H=224, R.TILE=16, R.SCALE=3`. `R.DB.*` data registries. `R.U` utils:
`r() rf(a,b) ri(a,b) chance(p) oneIn(n) pick shuffle weighted(arr,'w') clamp lerp clone DX DY opposite padL playTime seed(n)`.
Event bus `R.on/off/emit`. Audio-safe wrappers `R.sfx(id)`, `R.bgm(id,opts)`, `await R.jingle(id)`.
`R.onBoot(fn)` — run after engine/fonts are ready, before the title screen.

### Engine & layers (`src/core/engine.js`)
Everything on screen is an `R.Layer` on `R.Engine.layers`:
* `update()` — **top layer only**, once per frame; read input here.
* `tick()` — every layer, every frame; background animation only (no input).
* `draw()` — drawn bottom→top from the highest layer with `opaque = true`.
* `close(value)` — removes the layer and resolves `await R.Engine.run(layer)`.

`R.Engine.push(layer)`, `remove`, `top()`, `run(layer)→Promise`, `clear()`, `wait(frames)`,
`fade(to,frames)`, `fadeOut(f)`, `fadeIn(f)`, `shake(frames,mag)`, `flashScreen(color,frames)`,
`R.Engine.frame` (global frame counter). 60 fps fixed step.

### Input (`src/core/input.js`)
Virtual buttons `up down left right a b dash`. Keyboard: arrows/WASD, **A = Z/Enter/Space**, **B = X/Esc/Backspace**,
dash = Shift. Touch pad (D-pad + A/B) and gamepads map to the same buttons.
`R.Input.down(b) pressed(b) repeat(b) released(b) dir() dirRepeat() consume()`.
**Field: A = talk/examine/open, B = open menu.** Menus: A = confirm, B = back.

### Graphics (`src/core/gfx.js`)
All coordinates are logical pixels. `R.Gfx.clear rect strokeRect draw(img,x,y,{flip,alpha,sx,sy,sw,sh,w,h}) drawTinted
text(str,x,y,{color,size,align,shadow}) textWidth wrap window(x,y,w,h,{title}) cursor(x,y) moreArrow bar`.
Default font size `R.Gfx.FS` (≈10.7 px; one full-width char ≈ 10.7 px wide), line height 14.
Colors: `R.Gfx.C.white gray red orange yellow green cyan blue purple gold hpLow dead`.

Sprite registry: `R.Gfx.def(key, factory)`; `R.Gfx.get(key)` builds lazily & caches (missing → magenta
placeholder + one warning). `R.Gfx.variant(key,{hue,sat,bri,pal})` cached color variant.
Builders: `R.Gfx.fromGrid(rows, pal)`, `R.Gfx.pix(w,h)` → **Pix** (`set rect hline vline ellipse circle
shadeEllipse(cx,cy,rx,ry,ramp,{light,dither}) line(x0,y0,x1,y1,c,thick) poly(pts,c) grid(ox,oy,rows,pal)
mirrorX outline(c,{diag}) replace each blit toCanvas`), `recolor(canvas,map)`, `mapColors`, `hsvShift`,
`flipH`, `shade(hex,amt)`, `ramp(hex,n,spread)`, `mix(a,b,t)`, `makeCanvas(w,h)`.

### UI (`src/ui/ui.js`)
* `await R.UI.say(text, {keep, noWait, pos, auto, speed})` — message window with typewriter.
  `\n` newline, `\f` page break; auto wrap + pagination (4 lines). `keep:true` leaves the window open for
  the next say; `R.UI.closeMessage()` closes it.
* `await R.UI.choose(items, {x,y,w,cols,rows,title,initial,cancel,onChange})` → index or −1.
* `await R.UI.yesno(text)` → bool. `await R.UI.number({min,max,initial,label,price})` → n or −1.
* `await R.UI.notice(text, frames)`.
* `new R.UI.List({x,y,w,items,rows,cols,...})` — reusable cursor list; `update()` returns
  `'select'|'cancel'|'move'|null`; `draw()`. Items: string or `{label,disabled,right,color}`; `drawItem` hook.

### Save & settings (`src/core/save.js`)
`R.Settings` = `{msgSpeed 0-3, battleSpeed 0-2, bgmVolume, sfxVolume, alwaysDash, windowColor, touchPad, cursorMemory}`;
`R.Save.saveSettings()`. Slots (async): `R.Save.list() load(slot) save(slot,data) remove(slot)`,
`exportCode(data)`/`importCode(str)` (ふっかつのじゅもん). 3 slots.

### Rules (`src/systems/rules.js`) and State (`src/systems/state.js`)
See the source; key functions:
`R.Rules.stats(c) mods(c) commands(c) actionList(c,job) fieldActions(c) mpCost(c,ab) jobLevel(c,job)
jpToNextLevel isJobUnlocked unlockedJobs isMastered learned canLearn learn gainJp gainExp expForLevel expToNext
changeJob canEquip equip optimize itemSlot slotOptions(c,kind) setSlot validateEquip clampHpMp`.
`R.State.newGame() flag setFlag check(cond) getVar setVar count hasItem addItem removeItem items(pred)
addGold takeGold alive leader char healAll wipeRecover seen killed noteDrop serialize deserialize`.
`R.Game` holds the live state (see state.js `newGame`).

## 3. Audio contract (`R.Audio`, owner: audio)

```
R.Audio.init()                         // create AudioContext on first user gesture (main.js calls it)
R.Audio.playBGM(id, {fade})            // loop a track; same id already playing → no-op
R.Audio.stopBGM(fadeFrames)
R.Audio.pushBGM(id) / popBGM()         // battle: push 'battle', pop resumes the field track (from its position)
await R.Audio.playJingle(id)           // pauses BGM, plays a one-shot, resumes BGM, resolves at end
R.Audio.sfx(id)
R.Audio.setVolumes(bgm, sfx)           // 0..1 (also read from R.Settings on init)
R.Audio.current                        // current BGM id
```
Everyone else calls the safe wrappers `R.sfx`, `R.bgm`, `R.jingle`.

**BGM ids**: `title overworld sea town village castle shrine dungeon cave tower pyramid ice volcano
lastdungeon battle boss lastboss ending`.
**Jingle ids**: `victory levelup jobup item keyitem inn save gameover rare`.
**SFX ids**: `cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt
magic fire ice thunder wind holy dark earth water heal revive buff debuff status poison sleep death
enemy_die boss_die escape stairs door locked chest item gold step_damage ship bump warp teleport
steal jump breath roar shake`.

## 4. Graphics contract (keys for `R.Gfx.get`)

| Key | Returns | Owner |
|---|---|---|
| `tile:<tileId>` / `tile:<theme>:<tileId>` | canvas 16×16, or array of canvases if the tile has `anim` | art-tiles |
| `bbg:<id>` | canvas 256×144 battle backdrop (sky/horizon/ground; monsters stand on ground ≈ y 124–132) | art-tiles |
| `party:<charId>:<jobId>` | `{down:[f0,f1], up:[..], left:[..], right:[..]}` frames 16×24 | art-chars |
| `npc:<type>` | same sheet format, 16×24 | art-chars |
| `obj:<name>` | objects: `chest` (`[closed, open]` 16×16), `ship` (sheet 32×32 4 dirs `{down,up,left,right}` 2 frames), `sparkle` (4 frames 16×16), `crest_glow` (4 frames 16×16), `shadow` | art-chars |
| `mon:<spriteId>` | canvas (sizes below) | art-monsters / art-bosses |
| `icon:<type>` | 8×8 menu icons for item types: `sword knife axe spear staff rod bow claw katana harp shield helm hat heavy light robe acc herb potion key` | art-chars |

Party sprites wear **job outfits**: each job defines `outfit:{main,sub,trim}` colours; the art module
recolours the character's clothing per job (hair/skin/eyes stay). 16×24 frames, 2-frame walk per
direction, bottom-aligned on the tile (the top 8 px overlap the tile above).

Field sprites are drawn bottom-aligned: sprite top = tileY×16 − 8.

### Tiles and themes
`src/data/tiles.js` defines every tile id, its passability and the two legends (`world`, `local`).
Themed tiles (`floor wall wall_torch door door_silver door_gold pillar stairs_up stairs_down rock`) need
art per theme: `town castle house cave fort pyramid water ice volcano tower shrine demon`, plus a
generic fallback `tile:<id>`. Animated tiles return arrays (sea/water 4 frames, lava 2, torch 2, warp pad 4, barrier 4, poison 2, seal 2).
World tiles blend: the art module may pre-compute edge/corner transitions (e.g. shoreline) by exposing
`R.Art.worldTile(map, x, y)` returning the canvas for that cell — the field renderer calls it for world maps when defined.

### Battle backdrop ids (`bbg:`)
`grass forest hills desert snow swamp wasteland sea cave fort watercave pyramid ice volcano tower shrine castle demon throne`.

### NPC types (`npc:`)
`king queen princess minister soldier knight old_man old_woman man woman boy girl merchant innkeeper
priest nun sage elder sailor captain bandit elf dwarf scholar dancer spirit demon ghost cat dog`.

### Monster sprite roster (`mon:`) — sizes are canvas sizes; draw centred, feet on the bottom row
Small 32×32: `jelly bat rat mushroom bee wisp imp mimic eyeball`
Medium 48×48: `goblin snake wolf plant skeleton ghost lizardman scorpion mummy crab merman harpy
darkmage armor gargoyle salamander cactus frostling`
Large 64×64: `orc golem wyvern chimera yeti kraken demon sandworm minotaur`
Bosses: `boss_goblin_chief 64×64`, `boss_bandit 64×64`, `boss_serpent 96×80`, `boss_sphinx 96×80`,
`boss_frost_giant 96×96`, `boss_flame_lord 96×96`, `boss_star_guardian 96×96`, `boss_general_a 96×96`
(dark knight), `boss_general_b 96×96` (lich sorcerer), `boss_demon_king 112×96`, `boss_demon_king2 128×112`.
Rare monsters (one per region, unique designs): `rare_hare 48`, `rare_lizard 48`, `rare_bird 48`, `rare_whale 64`,
`rare_idol 48`. Post-game: `boss_abyss 128×112` (superboss アビスロード), `rare_prism 48`, `void_wraith 48`, `chaos_beast 64`.
Regular monsters reuse a base sprite with palette variants (`hue`, `sat`, `bri`) — like classic DQ.
Base sprites must look good in their **default** palette and still read well hue-shifted.

## 5. Data schemas

### 5.1 Items (`R.DB.items[id]`)
```
{ name, type:'consumable'|'weapon'|'shield'|'head'|'body'|'acc'|'key',
  price, (sell = floor(price/2); price 0 = cannot sell), desc, sort?, rare?:true (shown ★ in lists),
  // weapons
  wtype:'sword'|'knife'|'axe'|'spear'|'staff'|'rod'|'bow'|'claw'|'katana'|'harp', atk, mag?, hit?, twoHanded?,
  element?:'fire'|'ice'|'thunder'|'wind'|'earth'|'water'|'holy'|'dark', onHit?:{status,chance},
  // armor
  atype:'helm'|'hat' (head) | 'heavy'|'light'|'robe' (body) | 'shield', def, mdef?, eva?,
  // any equipment
  stats?:{str,vit,agi,int,mnd,luk,hp,mp}, mods?:{...see 5.4},
  only?:['yuki'] (character restriction, rarely used),
  // consumables (same shape as an action ability)
  use?:{ target, effects:[...], fx, battle:true, field:true },
}
```
Required ids: `herb` (薬草, start ×4), start gear `copper_sword oak_staff wooden_rod traveler_clothes`,
key items `crest_wind crest_water crest_earth crest_fire crest_star light_crest silver_key gold_key`.
Utility consumables (exact ids): `wing` (teleport to a visited town), `escape_rope` (leave dungeon),
`holy_water` (repel 150 steps), `phoenix_down`-equivalent must be named originally (id `revive_feather`).

### 5.2 Jobs (`R.DB.jobs[id]`)
```
{ name, tier:1..4, desc, command:'battle command name',
  mult:{hp,mp,str,vit,agi,int,mnd,luk},        // 0.6..1.4 multipliers on base stats
  weapons:[wtypes], shield:bool, heads:['helm','hat'], bodies:['heavy','light','robe'],
  abilities:[abilityIds in menu order],
  req:[[jobId, jobLevel], ...],                // all must be met by the same character
  innate?:{mods},                              // always-on while in this job
  outfit:{main:'#hex', sub:'#hex', trim:'#hex'}, // party sprite clothing colours
}
```
JP table (cumulative JP earned in the job): Lv1 0, Lv2 100, Lv3 250, Lv4 450, Lv5 700, Lv6 1000, Lv7 1400, Lv8 2000.
Mastered (★) = all abilities of the job learned.

**Job tree (ids fixed):**
| Tier | id | name | requirements |
|---|---|---|---|
|1| warrior | 戦士 | — |
|1| priest | 僧侶 | — |
|1| mage | 魔法使い | — |
|1| thief | 盗賊 | — |
|2| knight | ナイト | warrior 3 |
|2| monk | 武闘家 | warrior 2, priest 2 |
|2| whitemage | 白魔術師 | priest 3 |
|2| blackmage | 黒魔術師 | mage 3 |
|2| hunter | 狩人 | thief 3 |
|2| bard | 吟遊詩人 | priest 2, thief 2 |
|2| alchemist | 薬師 | mage 2, thief 2 |
|3| spellblade | 魔法剣士 | knight 3, blackmage 3 |
|3| paladin | パラディン | knight 5, whitemage 4 |
|3| ninja | 忍者 | hunter 4, monk 3 |
|3| sage | 賢者 | whitemage 5, blackmage 5 |
|3| dragoon | 竜騎士 | knight 4, hunter 4 |
|3| timemage | 時空術師 | blackmage 4, bard 3 |
|3| darkknight | 暗黒騎士 | warrior 6, blackmage 4 |
|4| hero | 勇者 | paladin 5, spellblade 5 |

Start: ユウキ warrior (knows `warrior_power_slash`), ノン priest (`priest_heal`), メテム mage (`mage_fire`).

### 5.3 Abilities (`R.DB.abilities[id]`), ids `<job>_<name>` (enemy-only: `en_<name>`)
```
{ name, job, kind:'action'|'reaction'|'support'|'field', jp, desc,
  // action
  mp?, magic?:bool (silence blocks it; MP cost mods apply), target, effects:[...], fx, fieldUse?:bool,
  // reaction
  trigger:'hitPhys'|'hitMagic'|'hitAny'|'lowHp'|'allyLowHp'|'ko', chance:0..1, react:{...},
  // support / field
  mods:{...},
}
```
**target**: `enemy` (one) · `enemies` (all) · `group` (every enemy of the chosen target's species) ·
`random` (effects repeat on random enemies; use `hits`) · `ally` · `allies` · `self` · `ally_dead` · `ally_any`.

**effects** (applied in order to each target):
| type | fields | meaning |
|---|---|---|
| `damage` | `formula:'phys'|'magic'|'fixed'|'percent'|'breath'`, `power`, `scale?`, `element?`, `hits?` (n or [min,max]), `ignoreDef?`, `drain?` (0..1 of dmg healed to user), `mp?` (damage MP instead), `critBonus?`, `acc?` (hit multiplier), `vs?:{undead:2,dragon:2,flying:2,...}`, `hpCost?` (fraction of user's max HP paid) | see §6 |
| `heal` | `power`, `scale?` (× user mnd), `pct?` (fraction of max HP; 1 = full) | |
| `healMp` | `power` | |
| `revive` | `pct` (HP fraction on revive) | |
| `cure` | `statuses:[...]|'all'` | |
| `status` | `status`, `chance` | inflict (resistable) |
| `buff` | `stat:'atk'|'def'|'mag'|'mdef'|'agi'`, `stages` (+/−) | stages clamp −2..+2 |
| `dispel` | — | clear buffs |
| `steal` | `rareBonus?` | take the monster's steal item |
| `scan` | — | show HP/weakness, register bestiary |
| `escape` | — | guaranteed flee (not bosses) |
| `regen` | — | give regen status |
| `grow` | `stat`, `n` | permanent stat gain (seeds) via `R.Rules.grow(c, stat, n)`; usable in field and battle |
| `teleport` | — | field only: choose visited town |
| `exit` | — | field only: leave dungeon (map.escape) |
| `repel` | `steps` | field only |
| `special` | `id` | escape hatch — avoid; if used, battle must implement it |

**reaction `react`**: `{type:'counter'}` (normal attack back at the attacker) · `{type:'heal', pct}` (self) ·
`{type:'autoItem'}` (drink the best healing consumable from inventory) · `{type:'buff', stat, stages}` ·
`{type:'cover'}` (take a physical hit meant for an ally under 25 % HP) · `{type:'revive', pct}` (once per battle on KO) ·
`{type:'mp', power}` (restore MP).

### 5.4 Mods (support/field abilities, job `innate`, equipment `mods`)
Numbers add up; lists concatenate; `elemResist` keeps the minimum multiplier.
```
hpPct mpPct strPct vitPct agiPct intPct mndPct lukPct   // % on base stats
atk def mag mdef hit eva crit                          // flat on derived stats
atkPct defPct magPct mdefPct                           // % on derived stats
physPct magicPct healPct itemPct                       // % more damage dealt / healing done / item effect
mpCostPct                                              // e.g. -50
critPct escapePct preemptPct
elemBoost:{fire:25}  elemResist:{fire:0.5} (0 = immune, <0 = absorb)
statusImmune:['poison','sleep',...]
startBuffs:{agi:1, def:1}   regen:true   twoSwords:true   unarmed:N (flat atk bonus when no weapon)
equip:['sword','heavy','shield','helm',...]            // extra equip permissions
expPct jpPct goldPct dropPct rarePct stealPct          // rewards
// field-only (effective from the フィールド slot or equipment)
encounterPct (−50 halves, +100 doubles)  walkHeal:N (HP per step)  noFloorDamage:true
```

### 5.5 Statuses & elements
Statuses: `poison` (lose 1/12 max HP each turn end & 1 HP/step on the field; persists), `sleep` (no action;
50 % wake when hit; 1–4 turns), `paralyze` (no action, 1–3 turns), `confuse` (random target; 60 % recover when
hit; 2–4 turns), `silence` (no `magic` abilities, 3–5 turns), `blind` (physical hit ×0.5, 3–5 turns),
`death` (instant KO effect), `regen` (+1/10 max HP per turn, 5 turns). Only `poison` persists after battle.
Elements: `fire ice thunder wind earth water holy dark`.

#### Element policy (weaknesses by family — `node tools/check_elements.js`)
A monster's weaknesses follow **what it looks like**, so a player who has seen one bat knows every bat.
Each monster lists its families in `fam` (data-only field; the game reads `elem`); `elem` = the families'
profiles merged left to right (a later family overrides an element) + a few listed exceptions. The table
lives in `monsters.js` as `R.ELEM_FAMILIES` (merge helper `R.famElem`). Values: weak ×2, resist ×0.5,
immune 0, absorb −1. **Bosses** use the same families with weaknesses at ×1.5 (`troops.js` `bossElem`);
rare monsters also use ×1.5.

| family | who | weak | resist / immune / absorb |
|---|---|---|---|
| `wing` 翼で飛ぶ敵 | bats, bees, harpies, dragons, chimeras, gargoyles, imps | 風 | 大地 immune |
| `float` 宙に浮かぶ敵 | ghosts, will-o'-wisps, eyes, spirits | — | 大地 ×0.5 |
| `beast` 地を駆ける獣・亜人 | rats, wolves, goblins, orcs, minotaurs, yeti, frost giant | 大地 | — |
| `rock` 岩・石・ゴーレム | rock jelly, golems, gargoyles, rock crab, stone sphinx | 水・大地 | 炎 ×0.5 |
| `sand` 砂漠の生き物 | scorpions, sandworms | 水 (氷 ×1.5) | — |
| `plant` 植物・キノコ | mushrooms, man-eating flowers, cactus | 炎 | 水 ×0.5 |
| `bug` 虫 | bees | 炎 | — |
| `reptile` ヘビ・トカゲ・竜 | snakes, lizardmen, dragons, chimeras (snake tail) | 氷 | — |
| `sea` 海の生き物 | water jellies, octopuses | 雷 | 水 absorb |
| `shore` 水辺の生き物 | mermen, crabs, sea snakes | 雷 | 水 ×0.5 |
| `metal` 鎧・金属 | living armor, golden idol | 雷 | — |
| `flame` 炎の体 | salamander, magma jelly/golem, fire wisps, fire imp | 氷・水 | 炎 absorb |
| `frost` 氷の体 | snow/ice spirits, ice jelly, ice armor/golem | 炎 | 氷 absorb |
| `snow` 雪国の獣 | furred snow beasts, icicle bat, ice dragon | — | 氷 ×0.5 |
| `gale` 風の体 | wind spirit | — | 風 absorb |
| `undead` アンデッド | skeletons, mummies, ghosts, lich (flag `undead`) | 聖 (炎 ×1.5) | 闇 absorb |
| `demon` 悪魔・闇の者 | demons, imps, dark priests, the demon eye, cursed armor, demon king | 聖 | 闇 immune |
| `shade` 闇に染まった魔物 | 「闇」「黒」 variants (keep their base family) | — | 闇 ×0.5 |
| `light` 光・星・精霊 | star-tower monsters, spirits, fox fire, star guardian | 闇 | 聖 ×0.5 |
| `eye` 目玉 | eyes (darkness blinds them) | 闇 | — |
| `human` 人間 | hired mage, star mage, bandit chief | 闇 | — |
| `plain` 弱点なし | plain jelly, mimics | — | — |

Rules: **absorb only where the body *is* the element** (water jelly/octopus, lava/fire wisp, ice/snow spirit,
ghost/undead, wind spirit) — 21 regular absorbers. `flying` flag ⇔ `wing`/`float` family. Exceptions are
few and visible in the data (mummy burns ×2; ice armor/golem are immune to ice instead of absorbing; the
fire imp and flame breathers resist fire). Target: **12–20 regular monsters weak to each element**
(now 炎20 氷18 雷16 風16 大地18 水14 聖13 闇12). Bosses rotate the element that matters: 大地 goblin chief,
闇 bandit chief, 雷 sea serpent, 水/大地 stone sphinx, 炎/大地 frost giant, 氷/水 flame lord, 闇 star
guardian, 聖 generals and demon king.
Player side: every element has weapons across the bands (大地: 岩砕きの爪★ b3, 巨人の斧 b4, 地竜の斧★ b6;
風: 風切りの槍★ … 天つ風★; 闇: 影縫いの短剣★ b4, 朧月の太刀 b5 …; 水: 時雨の太刀, 水竜の槍★, 水神の爪★)
and skills of the same power as fire/ice/thunder at the same tier (大地: 地ならし, 岩石落とし (黒魔術師 T2
single, = old 爆炎); 風: かまいたち, 旋風脚, 風切り; 闇: 暗黒騎士). Shop elemental stock should match
the next dungeon's weaknesses.

### 5.6 Monsters (`R.DB.monsters[id]`)
```
{ name, sprite:'jelly', hue?, sat?, bri?,               // palette variant of a base sprite
  lv, hp, mp, atk, def, agi, mag, mdef, eva?,           // eva % (default 3)
  exp, gold, jp,
  elem?:{fire:2, ice:0.5, holy:0, dark:-1},             // damage multipliers (2 weak, 0.5 resist, 0 immune, <0 absorb)
  fam?:['wing','reptile'],                              // element families (§5.5 Element policy), data-only
  statusRes?:{sleep:0.5, death:1},                      // chance to resist (1 = immune); bosses resist most
  actions:[{id:'attack', w:6}, {id:'en_fireball', w:2, cond?:{hpBelow:0.5, every:[3,0], once:true}}],
  actsPerTurn?:1|2|3,
  drop?:{item, rate:8},                                 // 1 in rate
  rare?:{item, rate:64},                                // 1 in rate (independent roll)
  steal?:{item, rare?:item},
  flags?:['boss','metal','undead','flying','dragon','flee'],  // metal: takes 0-1 phys dmg, immune to most magic; flee: may run away
  desc:'図鑑の説明',
}
```

### 5.7 Encounters, troops, shops, locations, objectives
```
R.DB.encounters[zoneId] = { lv:[min,max], bg:'grass', groups:[{w:10, mons:[['monId',min,max], ...]}] }
  // ≤ 3 distinct species per group, ≤ 8 monsters total (≤ 4 of a large 64px species, bosses alone)
R.DB.troops[id] = { mons:[['monId',min,max],...], bg, bgm:'boss'|'lastboss', noEscape:true }
R.DB.rareEncounters[zoneId] = { mon:'rare_x', rate:0.015 } // a plain random encounter in that zone is replaced by the
  // rare monster with this chance (golden flashes + 'rare' jingle + 「めったに出会えない魔物が現れた！」, sparkles,
  // always starts manual even with auto carry-over). Rare monsters: flags ['rare','flee'], fleeRate, optional `appear`
  // (entrance line) and `attackFx`; their exclusive item (`exclusive:<monId>` on the item) drops at 1/64–1/128 and a rare
  // steal of it is ~1/64 (never from shared pools / chests).
R.DB.shops[id]  = { name?, items:[itemIds] }
R.DB.locations[id] = { name, map:'world', spawn:'<world spawn name>', dock?:'<world spawn on sea>' }  // teleport targets
R.DB.objectives[id] = { text:'つぎの もくてき …' }
```

## 6. Battle rules (owner: battle; data owners balance against these)

* **Rounds** (DQ): choose commands for all living members, then everyone (party + monsters) acts in order of
  `agi × rand(0.6..1.0)` (+ agi buff multiplier). Defend halves damage for that round and acts first.
* **Physical** per hit: `base = atk×power/2 − def/4` (power default 1). If `base < 1`: 0 or 1 at random.
  `dmg = base × rand(0.875..1.125)` × element × buffs × mods. Hit chance = `hit − target.eva` %, blind ×0.5.
  **Critical** (会心/痛恨): chance `crit %`: dmg = `atk × rand(0.95..1.05)` ignoring def.
  Monsters use the same formula with their `atk`/`def`.
* **二刀流** (mod `twoSwords`: 忍者 innate, support `ninja_two_swords`): with a one-handed weapon in the shield
  slot (左手), 戦う — and a counter — swings twice: main hand (`atk`), then off hand (`atk2` = str + off-hand
  weapon atk). Each swing rolls hit/crit on its own; the off-hand swing's damage is ×0.6 (`OFFHAND_MULT` in
  battle.js); element and onHit come from the main-hand weapon. Shield or empty off hand → one swing.
  Abilities always strike once with the main hand. Balance (`node tools/sim_dualwield.js`): dual wield ≈ 1.6×
  a one-handed 戦う for 0 MP; the strong single-target skills of the same period (power ≥ 1.6–1.8, e.g.
  全力斬り・忍び討ち・十字斬り) still beat it by ≈1.2–1.4×, and group/all skills keep their niche.
* **Magic**: `dmg = (power + mag × scale) × rand(0.9..1.1) × 100/(100 + mdef) × element × mods`. Default scale 0.6.
* **Fixed**: `power × rand(0.9..1.1)` (items like bombs). **Breath**: fixed, reduced only by elemResist.
  **Percent**: `targetHP × power` (fails on bosses).
* **Heal**: `(power + mnd × scale) × rand(0.95..1.05) × (1 + healPct/100)`; `pct` heals a fraction of max HP.
* **Element multipliers**: product of monster `elem[e]` (or party `elemResist`) and 1 + `elemBoost`/100.
* Buff stage multipliers: −2 ×0.5, −1 ×0.75, 0 ×1, +1 ×1.5, +2 ×2.
* Status success: `chance × (1 − resist)`; immunities from `statusImmune`/accessories.
* **Metal** monsters: physical damage 0–1 (critical still hits for 1–3), immune to all magic except `percent`.
* **Escape**: chance `0.5 + 0.1 × attempts + (partyAvgAgi − enemyAvgAgi)/200`, clamp 0.3–1; bosses/`noEscape` impossible.
* **Preemptive** 1/16 (+preemptPct), **ambush** 1/32.
* **Rewards**: EXP and gold summed over defeated monsters, EXP split to *every living member in full*
  (DQ-style party EXP, not divided). JP likewise to each living member's current job. Mods
  `expPct/jpPct/goldPct` apply per character/party. Drops: each defeated monster rolls `drop` (1/rate × (1+dropPct/100))
  and `rare` (1/rate × (1+rarePct/100)) independently; bosses usually drop a guaranteed item via their troop event.
* **Wipe**: game over screen → `R.State.wipeRecover()` (half gold, full revive) → warp to `R.Game.respawn`.
  Nothing else lost. Event battles may pass `canLose` (story continues).
* **Level curve**: `R.Rules.expForLevel(L) = round(8·(L−1)^2.6 + 10·(L−1))` → L10 ≈ 2.5k, L20 ≈ 17k, L30 ≈ 51k, L40 ≈ 112k.

### Battle entry point
```
const result = await R.Battle.start({
  zone:'w_start',            // random encounter: pick a group from R.DB.encounters[zone]
  troop:'boss_wind',         // OR a fixed troop
  mons:[['jelly',3]],        // OR explicit monsters (tests)
  bg:'grass', bgm:'battle', canLose:false, noEscape:false,
});                          // → 'win' | 'lose' | 'escape'
```
The battle layer is opaque, pushes/pops BGM itself, applies rewards, and on `'lose'` returns without
recovering; the **caller** (field / event runtime) then runs `await R.GameOver.run()` (unless `canLose`),
which shows the game-over screen, calls `R.State.wipeRecover()` and warps to `R.Game.respawn`.
Battle layout (DQ5): three party status windows across the top (name, HP, MP, status mark; the window
flashes/shakes when that member is hurt), backdrop `bbg:*` 256×144 at the top of the screen, monsters
centred on the ground line, bottom window for commands and messages (DQ wording:
「ユウキの こうげき！」「ゴブリンに 12の ダメージ！」「ゴブリンを たおした！」). Damage numbers also pop up briefly.

## 7. Maps, field & events

### 7.1 Map schema (`R.DB.maps[id]`)
```
{ name, type:'world'|'town'|'castle'|'dungeon'|'shrine', legend:'world'|'local', theme, bgm,
  rows:['####...', ...],                  // equal-length strings; char → tile via legend
  marks:{ '@':{spawn:'start', dir:'up', under:'+'},
          'A':{npc:{id:'king', sprite:'npc:king', dir:'down', event:'king_talk'}, under:'+'},
          '$':{chest:{id:'regnas_c1', item:'herb', n:2}},
          '>':{warp:{to:'world', spawn:'regnas_castle'}, under:'s'},
          '!':{event:{id:'evt_x', trigger:'step', once:'flag_name'}},
          '%':{sign:{text:'...'}, under:'m'} },   // `under` = tile char placed at the mark (default '.' local / '.' world)
  // objects may also be listed explicitly with coordinates:
  spawns:{name:{x,y,dir}}, npcs:[{id,x,y,sprite,dir,move:'still'|'wander'|'spin',text|event,cond}],
  chests:[{id,x,y,item,n}|{id,x,y,gold}], warps:[{x,y,to,spawn,dir}], events:[{x,y,id,trigger:'step'|'examine',cond,once}],
  signs:[{x,y,text}],
  decor?:['..b..', ...]                  // optional overlay layer, same size as rows (see below)
  exit?:{to:'world', spawn}               // walking off the map edge
  outside?:'<legend char>'               // tile drawn beyond the map edge (default: void for local maps, sea for world)
  encounter?:'zoneId', encRate?:24       // avg steps between fights (dungeon default 22, world 26)
  onEnter?:'eventId'                     // every time the map loads (event checks its own flags)
  tilePatches?:[{cond:'flag', x, y, ch}] // applied whenever cond holds (e.g. a seal disappears)
  escape?:{to, spawn}                    // destination of exit ability / escape_rope (dungeons)
  location?:'regnas'                     // entering marks R.Game.visited[location]
  zones?:[{x,y,w,h,zone}], defaultZone?  // world: encounter zone rectangles, first match wins
}
```
**Decor layer.** `decor` rows use `R.DB.legends.decor` (src/data/tiles.js) to place props ON TOP of the base tile:
wall hangings (banners, tapestries, windows, sconces, paintings, emblems — on wall tiles), floor overlays (rugs,
dais steps, cracks, alternate tiles, straw…), furniture (fireplace, stove, cupboard, wardrobe, desks, tables,
plants, sacks, crates, armor stands, treasure…) and town props (flowerbeds, hedges, lamps, shop signs, stalls,
fountains, carts…). `' '`/`'.'` = nothing. Non-`pass` decor blocks movement; `counter` decor lets you talk across.
Art: `decor:<id>` (16×16, or up to 16×32 for `tall`, bottom-aligned) or `R.Art.decorAuto[id](map,x,y)` for pieces
that join with neighbours. Use decor to make towns/castles/houses dense and lived-in (target: SFC DQ5 density).

Mark chars must not be legend chars (`R.MARK_CHARS_LOCAL` / `R.MARK_CHARS_WORLD` list the free ones).
A mark char may appear several times (warps/events); npc/chest ids get `_2`, `_3`… suffixes.
NPC `cond` uses `R.State.check` syntax (`'flag'`, `'!flag'`, `{item:'x'}`, …); NPCs whose cond fails are absent.
NPC `sprite` is any Gfx key (`npc:*` sheets animate; `mon:*` draws the monster sprite standing on the tile, for
visible bosses). NPCs block movement. Talking to an NPC across a `counter` tile works.

### 7.2 Field behaviour (owner: field)
* Tile movement, 8 frames per tile walking, 4 dashing (always-dash on by default; Shift inverts).
* Party caterpillar: the other two members follow the leader's trail (dead members still follow, like DQ ghosts are not needed).
* Camera centred on the leader, clamped to map edges (small maps centred). Overworld does **not** wrap.
* Doors open when stepped on (sfx `door`); locked doors (`lock`) open automatically if the key item is held,
  otherwise "かぎが かかっている。" and block.
* Damage floors (`damage`) hurt every living member per step (flash red, sfx `step_damage`), negated by `noFloorDamage`.
  Poisoned members lose 1 HP/step (min 1 HP).
* Encounters: step counter `encRate × rand(0.6..1.4) × terrain.enc`, modified by `encounterPct`, `holy_water`.
  Battle background = tile `bbg` on the world, theme `bbg` in dungeons, or encounter table `bg`.
* Chests (`obj:chest`), signs, NPC talk (NPC turns to face). **No hidden items**: every treasure in the game is a
  visible chest (the old examine-to-find `hidden` objects were abolished — tools/validate.js flags any left).
* Ship: owned when `R.Game.ship` is set. Walk onto it to board; sail on `ship` tiles; stepping onto land leaves the ship there.
  `barrier` tiles become sailable when flag `barrier_broken` is set.
* Menu: B opens the field menu (owner: menu → `R.Menu.open()`).
* Teleport (ability/`wing`): list of `R.Game.visited` locations → warp to `locations[id].spawn` on the world;
  if the party owns the ship and the location has a `dock`, the ship moves to that dock.
* Exit (ability/`escape_rope`): only in maps with `escape`.
* Respawn: set `R.Game.respawn` when resting at an inn or saving at a church/king.
* `R.Field.start(mapId, spawnName)` is the entry point after title/new game; `R.Field.warp(mapId, spawn, opts)`.
* Debug hooks on `R.debug` (field): `warp(map,spawn|{x,y})`, `give(item,n)`, `flag(name)`, `level(n)`,
  `noEncounter(bool)`, `setJobLevel(charId, job, lv)`.

### 7.3 Event scripts (`R.DB.events[id]`)
```
R.DB.events.king_intro = {
  meta:{ needs:['flag:x'], gives:['flag:intro_done','item:herb'] },   // static info for tools/progress.js
  run: async (ev) => { ... },
};
```
`ev` API (implemented by field in `events_runtime.js`; all may be awaited):
```
ev.say(text, opts)               // consecutive says share one window; closed automatically at the end / before battles, warps, shops
ev.ask(text, choices)            // → index or -1
ev.yesno(text)                   // → bool
ev.flag(name) setFlag(name,v=true) check(cond) var(name) setVar(name,n)        (sync)
ev.has(item,n) take(item,n) gold() takeGold(n)                                  (sync)
ev.give(item,n=1,{silent})       // "〇〇は ✕✕を てにいれた！" + jingle ('keyitem' for key items)
ev.giveGold(n)
ev.battle(troopId, {canLose, noEscape, bgm, bg}) // → 'win' | 'lose' | 'escape'
ev.warp(map, spawn|{x,y}, {dir, fade=true})
ev.wait(frames) fadeOut(f) fadeIn(f) shake(f,mag) flash(color,f)
ev.sfx(id) bgm(id) jingle(id)
ev.npc(id) → {face(dir), walk('UUL'), hide(), show(), setPos(x,y)}   ev.player → {face(dir), walk('DD')}
ev.heal()                        // full restore party
ev.inn(price)                    // standard inn dialogue; sets respawn; → bool
ev.shop(shopId)                  // opens R.Shop (menu owner) and awaits
ev.church()                      // save / revive / cure menu; sets respawn
ev.saveMenu()                    // open save screen
ev.setObjective(id)
ev.giveShip(worldSpawnName)      // ship appears at that world spawn (a sea tile)
ev.refresh()                     // re-evaluate NPC conds / tilePatches now
ev.ending()                      // R.Ending.start() (story owner)
ev.map                           // current map id;  ev.self → id of the npc/object that triggered
```

### 7.4 Content plan — world, locations, progression

Story (DQ2-simple): 100 年前、魔王ヴァルザードは「光の紋章」によって封じられた。紋章は五つに分かたれ、
世界各地に祀られた。封印が弱まり魔物があふれる。レグナス王は、紋章の光を宿して生まれた三人 —
剣士の家系のユウキ、神殿のノン、魔法学院の天才メテム — を呼び寄せる。五つの紋章を集め、光の神殿で
光の紋章をよみがえらせ、魔の渦に守られた魔王島へ渡り、魔王を倒す。ending: 平和が戻る、3人の短い後日談。

| # | Location (map ids) | Lv band | Gate / reward |
|---|---|---|---|
| 1 | レグナス城 `regnas_castle` + 城下町 `regnas_town` (start continent, west) | 1–3 | intro; king; shops |
| 2 | ミルトの村 `milt_village` | 2–5 | village north-east of castle |
| 3 | かぜの洞くつ `wind_cave_1..2` (boss `boss_wind`) | 3–6 | → `crest_wind` |
| 4 | 東の関所 `east_gate` (small map with two world exits) | – | soldier lets you pass once you hold `crest_wind` |
| 5 | 港町ポルタ `porta_town` (east region) | 6–9 | captain: bandits blockade the port |
| 6 | 盗賊のとりで `bandit_fort_1..2` (boss `boss_fort`) | 7–11 | → `silver_key` + flag `bandits_defeated` → captain gives the ship (`giveShip('porta_dock')`) |
| 7 | 森の村エルフィン `elfin_village` + 水の洞くつ `water_cave_1..2` (boss `boss_water`) | 11–15 | → `crest_water` |
| 8 | 砂漠の町サルバ `salva_town` + ピラミッド `pyramid_1..3` (silver doors inside, boss `boss_pyramid`) | 14–18 | → `crest_earth` |
| 9 | 雪の村フロスト `frost_village` + ひょうけつの洞くつ `ice_cave_1..2` (boss `boss_ice`) | 18–22 | → `gold_key` |
|10 | ほのおの火山 `volcano_1..2` (gold door at the entrance, boss `boss_volcano`) | 22–26 | → `crest_fire` |
|11 | 魔法都市アルカナ `arcana_city` + 星見の塔 `star_tower_1..4` (gold door, boss `boss_star`) | 25–30 | → `crest_star` |
|12 | 光の神殿 `light_temple` (island) | – | with 5 crests → `light_crest`, flag `barrier_broken` |
|13 | さいはてのほこら `edge_shrine` (inn, church, shop) | 31+ | last safe spot |
|14 | 魔王城 `demon_castle_1..5` (bosses `boss_general1`, `boss_general2`, `boss_king1` → `boss_king2`) | 32–40 | → flag `game_clear` → ending |

Conventions:
* Every map's main entry spawn is named `entrance`. World warps into a location target spawn `entrance`.
  Leaving a location/dungeon to the world targets the world spawn named after the location/dungeon map id
  (e.g. `{to:'world', spawn:'wind_cave_1'}`), which sits on that location's world icon.
* Dungeon floors connect with stairs warps; name floor spawns `up`/`down` (arrive from the floor above/below).
* Shops ids: `<location>_item`, `<location>_weapon`, `<location>_armor` for every location in
  `regnas milt porta elfin salva frost arcana edge_shrine` (items owner creates all 24; story owner places them).
* Boss troops (monsters owner) and the sprite each uses: `boss_wind`→`boss_goblin_chief`, `boss_fort`→`boss_bandit`,
  `boss_water`→`boss_serpent`, `boss_pyramid`→`boss_sphinx`, `boss_ice`→`boss_frost_giant`, `boss_volcano`→`boss_flame_lord`,
  `boss_star`→`boss_star_guardian`, `boss_general1`→`boss_general_a`, `boss_general2`→`boss_general_b`,
  `boss_king1`→`boss_demon_king`, `boss_king2`→`boss_demon_king2`.
* Story owner writes the town/castle/world events (king, gate soldier, captain + ship, light temple, ending scene).
  Dungeons owner writes dungeon maps and their events (boss battles, crest/key chests, demon castle, final boss →
  `ev.setFlag('game_clear')` → `ev.ending()`). The flag `bandits_defeated` is set by the fort boss event;
  the captain event (story) checks it.

World map: exactly **128 columns × 112 rows** (the ちず screen draws it at 2 px/tile), ringed by ≥ 3 tiles of sea.

Encounter zone ids (world rectangles): `w_start w_east w_sea1 w_forest w_desert w_sea2 w_snow w_volcano w_arcana w_sea3 w_demon`.
Dungeon zone ids: `d_wind1 d_wind2 d_fort1 d_fort2 d_water1 d_water2 d_pyr1 d_pyr2 d_pyr3 d_ice1 d_ice2
d_vol1 d_vol2 d_star1 d_star2 d_star3 d_star4 d_demon1 d_demon2 d_demon3 d_demon4 d_demon5`.
Location ids (teleport): `regnas milt porta elfin salva frost arcana light_temple edge_shrine`.
World spawn names: one per location/dungeon entrance = the map id (e.g. `regnas_castle`, `wind_cave_1`),
`east_gate_w`, `east_gate_e`, and ship docks `porta_dock elfin_dock salva_dock frost_dock arcana_dock light_temple_dock edge_shrine_dock volcano_dock`.

Metal/rare monsters: `jelly` metal variant from mid-game (high EXP/JP, flees) and a gold variant late game;
they are the main "rare drop" targets together with every monster's `rare` slot.

### 7.5 Progression checker metadata
`tools/progress.js` (QA) proves the game is completable by BFS over maps using tile passability, locks,
ship, flags, chests and event `meta` (`needs`/`gives`). Keep `meta` accurate for every story event.

## 8. Menus (owner: menu)

Field menu (B): **どうぐ / アビリティ / そうび / ジョブ / セット / つよさ / ならびかえ / ずかん / ちず(overworld only) / セーブ / せってい**,
with a gold + playtime + next-objective window. Details:
* **どうぐ**: consumables usable in the field, equipment list, だいじなもの tab; use / すてる.
* **アビリティ**: field-usable action abilities (heal, cure, revive, teleport, exit, repel).
* **そうび**: per character, per slot; shows stat changes (↑ green / ↓ red) for candidates; **さいきょう** (optimize) and **はずす**.
* **ジョブ**: FFT-style job board: every job in a grid with state (locked shows requirements), job level and ★ mastered;
  change job; **アビリティをおぼえる** (spend that job's JP on its abilities; shows cost, JP available, kind, desc).
* **セット**: サブアクション (another unlocked job's command), リアクション, サポート, フィールド (learned from any job).
* **つよさ**: stats, EXP to next level, job level/JP of current job, equipment, set abilities, resistances.
* **ずかん**: monsters seen/defeated, sprite, stats once defeated, drop & rare drop names once obtained (else ？？？).
* **ちず**: overworld map with party and ship markers.
* **セーブ**: 3 slots + ふっかつのじゅもん export; **せってい**: settings (message speed, battle speed, volumes,
  always dash, window color, touch pad).
Shops (buy/sell with equip-ability markers per character and stat preview), inn, church (save / revive / cure poison),
title screen (はじめから / つづきから / ふっかつのじゅもん / せってい), game over.
New game → **name entry** (`R.NameEntry.run()`, src/systems/nameentry.js): grid of ひらがな/カタカナ/英数字 plus a
DOM keyboard/IME input; no kanji; confirmation screen. Settings also include `padConfirm` ('right' default = ○ /
Nintendo A confirms; 'bottom') and `autoKeep` (auto battle carries over to the next random encounter; boss/event
battles always start manual; B cancels and returns to manual; never saved).
Global `R.Menu.open()`, `R.Shop.open(shopId)`, `R.Shop.inn(price)`, `R.Shop.church()`, `R.Title.start()`, `R.GameOver.run()`.

## 9. QA tools (QA phase)
`tools/validate.js` (every reference resolves, rows equal length, marks legal, NPCs/chests on sensible tiles,
every warp target & spawn exists, every sprite/bgm/sfx/bbg key registered…), `tools/progress.js` (completable),
`tools/sim.js` (battle balance per zone & boss at the intended level band), `tools/smoke.js` (Playwright scripted play).
