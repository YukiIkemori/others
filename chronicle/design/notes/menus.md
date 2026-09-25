# Menus & screens — porting note (Crest → Chronicle)

Scope: `src/systems/menu.js` (620 lines: main menu + shared kit + field effects), `menu_items.js` (229), `menu_equip.js` (194),
`menu_status.js` (370: 強さ / 並び替え / 図鑑), `menu_jobs.js` (462: ジョブ / 覚える / セット), `menu_save.js` (282: セーブ / 設定 /
呪文 overlay), `shop.js` (327: shop / inn / church), `title.js` (380), `nameentry.js` (312), `gameover.js` (93), `src/ui/ui.js` (316),
`src/core/save.js` (115), plus `minimap.js` (174, the 地図 screen; field-owned in Crest).
`diff -rq` against `/tmp/claude-0/ref/rpg/src`: every file here is byte-identical except `save.js:11` (`PREFIX` is already
`'luminous_chronicle_'`). Line numbers are for the fork.
The fork has **no data yet** (`DB.chars` is empty and `R.PARTY_ORDER` is undefined), so `R.State.newGame()` throws, and no menu can be
opened in the fork until chars/items exist. To compare layouts, the screenshots below were taken on the reference build
`/tmp/claude-0/ref/rpg/dist/index.html` with a synthetic 4th member pushed at runtime (see §20 for the command).

---------------------------------------------------------------------------------------------------
## 0. TL;DR — what must change

1. **3 → 4 members.** Four layouts break (screenshot-confirmed): main menu party column (menu.js:575), shop side panel (shop.js:91),
   save-slot name line (menu_save.js:22), and the 道具 gear sprite row (menu_items.js:139). The rest iterates `R.Game.party` and is N-safe.
2. **Jobs go away.** Delete `menu_jobs.js`, **but first move `Menu.kitStar` (menu_jobs.js:461) into menu.js**. The 図鑑 uses it (menu_status.js:265),
   so the book would throw on every row with a rare drop. Remove job/JP text from 6 screens (§17 checklist).
3. **5 → 9 equipment slots + weapon2.** The slot list is copied in 6 places. The code assumes `item.type === slot` in 4 places, and the two-handed
   rule is implemented 3 times. Centralise all of it in rules (§7).
4. **Bestiary → 3 drop tiers** (通常/レア/超レア) + golden individuals + tier-derived stats (§10). The same list+detail screen can be reused for **技の書/術の書**.
5. **Hero creation replaces 3× name entry** (1 hero, gender/type/favoured weapon or element, name 4–5 chars) (§14).
6. **Save/呪文:** the code prefix `LC1:`/`LC0:` is Crest's, so a Crest code would load into Chronicle and crash. Change it and add an app check (§12).
7. New screens: 技・術 (field use, WP/MP), 技の書/術の書, 隊列 (前列/中列), tavern/companion pick, hero creation, 熟練度 page.

---------------------------------------------------------------------------------------------------
## 1. Public API and callers

| API | defined | called from |
|---|---|---|
| `R.Menu.open()` | menu.js:607 | field.js:396 `openMenu()` (B on the field). Guarded against double-open; needs `R.Game` |
| `R.Menu.isOpen()` | menu.js:619 | — |
| `R.Menu.saveScreen(o)` = `saveMenu` | menu_save.js:139–140 | events_runtime.js:219 (`ev.saveMenu`), shop.js:287 (church), ending.js:286 (`{ending:true}`) |
| `R.Menu.settings()` | menu_save.js:142 | main menu, title.js:250 |
| `R.Menu.codeOverlay({mode,code})`, `showCode()` | menu_save.js:33, :129 | save screen, title.js:275 |
| `R.Menu.pickMember(o)` | menu.js:211 | items, abilities, order, shop buyGear |
| `R.Menu.useItem(id)`, `useAbility(c,id)`, `applyFieldEffect(def,user,targets,{item})` | menu.js:387, :454, :261 | item/ability screens |
| `R.Menu.previewStats`, `gearSummary`, `drawSlot`, `drawGold`, `drawParty`, `monsterOrder`, `kit` | various | shop.js:43/:118, title.js:361 |
| `R.Shop.open(id)`, `inn(price)→bool`, `church()` | shop.js:222, :247, :275 | events_runtime.js:200/206/213 |
| `R.Title.start()` | title.js:370 | main.js:60, ending.js:292 |
| `R.NameEntry.run(initial)→names|null`, `apply(names)` | nameentry.js:287, :307 | title.js:256/263 |
| `R.GameOver.run()` | gameover.js:51 | field.js:896 `Field.gameOver()`, used by field.js:890 (random battles) and events_runtime.js:137 (event battles without `canLose`) |
| `R.Minimap.open()`, `canvas()` | minimap.js:165 | main menu 地図 |

Menus depend on rules/state/field only through these calls: `Rules.stats mods canEquip equip optimize itemSlot fieldActions mpCost expToNext
MAX_LEVEL grow` (kept), `jobLevel isMastered isJobUnlocked unlockedJobs jobAbilities learned canLearn learn setSlot slotOptions actionList
changeJob jpToNextLevel` (job-only → drop), `State.items count removeItem addItem takeGold addGold leader alive healAll wipeRecover serialize
deserialize newGame START`, `Field.teleportList teleport canTeleport canExit exitDungeon repel setRespawnHere start resume respawn warp map`.

---------------------------------------------------------------------------------------------------
## 2. UI primitives (`src/ui/ui.js`, lead-owned)

* **Message window** `MSG = {x:8, y:148, w:240, h:72, lines:4, pad:10}` (:10). Text width 220 px ≈ 20 full-width chars per line. `pos:'top'`→y 6,
  `'middle'`→y 78. Typing speed `[0.5,1,2,999][Settings.msgSpeed]` chars/frame (:67); holding B types ×3. `\f` = page break, auto-wrap + 4-line pages.
  `keep:true` leaves it open; `noWait` resolves once typed (implies keep). **A reused window keeps its `pos` only**, so `Menu.kit.say`
  (menu.js:126) and shop.js:16 pass explicit `{noWait:false, keep:false, auto:0}`. Keep that pattern.
* **`R.Text.fmt`** (:17–34): the placeholder regex is hard-coded to `{yuki|non|metem|leader}` (:32), and the `leader` fallback reads `DB.chars.yuki` (:22).
  Chronicle needs `{hero}` (+ `{leader}`; companions are fixed names, so they need no placeholder). Lead change.
* **`R.UI.List`** (:132–218). This widget is not a layer: embed it, then call `update()` → `'select'|'cancel'|'move'|null`, and `draw()`.
  * Options (:134): `x y w h? cols=1 rows lineH=14 cancel=true window=true title wrap=true active=true colW padX=16 padY=8 index onChange(i)
    drawItem(item,x,y,w,i,sel)`. Defaults: `rows = ceil(n/cols)` if not given; `h = padY*2 + rows*lineH − 2` (:137); `colW = (w − padX − 6)/cols` (:138).
    `h` is computed **once**, so `setItems()` never resizes the window.
  * Items: a string, or `{label, disabled, right, color}`. Extra fields are allowed (screens stash `id`, `e`, `value`). `right` is drawn right-aligned at `x+colW−10`.
  * Keys (:158–189): up/down move by `cols`, and left/right move by 1 in grids. **In a 1-column list whose items don't fit, left/right jump a page** (:168).
    Screens that use left/right themselves (member or tab switch) intercept the key before `list.update()`, so they lose page-jump (the 道具 gear
    tab can get very long, §6). `wrap` wraps both ends. A disabled item → buzzer, no select. The list makes its own sfx (`cursor/confirm/cancel/buzzer`).
  * Draw: cursor ▶ at `itemX−10` (solid when active; `draw({showInactiveCursor:true})`), blinking ▲▼ scroll marks at the window's top/bottom centre.
* **`R.UI.choose(items, {x,y,w,cols,rows,title,initial,cancel,onChange})`** (:227/:304): auto width from labels. The default position is right-aligned
  above the message window (`x = 248 − w`, `y = 146 − h`). Returns an index or −1. **`yesno(text)`** = `say(noWait)` + はい/いいえ, and leaves the message
  window open (`Menu.kit.yesno` closes it). **`number({min,max,initial,label,price,x,y,w})`**: ↑↓ ±1 (wraps at the ends), ←→ ±10 (clamps); with `price`, it shows the total.
  **`notice(text,frames)`** auto-closes.

---------------------------------------------------------------------------------------------------
## 3. Window styles and the menu kit

* `R.Gfx.window(x,y,w,h,{theme,alpha,title})` (gfx.js:141): a DQ black box, 2-px rounded corners, a 1-px white border inset by 2. A `title` is printed **on
  the top border**, centred. Themes `WINDOW_THEMES` (gfx.js:23): `black` (flat, alpha 1), `blue`/`green`/`red` (vertical gradient `fill→fill2`,
  alpha 0.96). The theme follows `Settings.windowColor` globally; battle forces `{theme:'red'}` for hurt flashes. For an RS1 look, the lead may add a
  theme and/or make `blue` the default (`save.js:20`). Every screen picks it up automatically.
* `R.Gfx.cursor(x,y,blink)` = ▶ with its tip at (x+6, y+5); `moreArrow` ▼; colours `R.Gfx.C.*` (white gray **dark** black red orange yellow green cyan
  blue purple pink gold hpLow dead). `R.Gfx.FS = 10.667` → a full-width char is ≈10.7 px wide; line pitch 14.
* **`Menu.kit` (`K`, menu.js:32–131)**: label maps `STAT_NAMES` (incl. `luk:'運'`), `ELEM_NAMES` (8 elements), `STATUS_NAMES`, `KIND_*` (job-ability kinds),
  `ELEMS` (8, hard-coded; used by status p3 and book detail2). Name resolvers read `DB.elements/DB.statuses` first. Also `fitText(str,x,y,maxW)`
  (shrinks horizontally, **floor 7 px**), `sprite(c,job,dir,frame)` (key **`party:<charId>:<jobId>`**, :45), `drawSprite` (fallback silhouette coloured
  by `DB.jobs[job].outfit`, :62), `iconKey/drawIcon` (`icon:<wtype|atype|shield|acc|key|herb|potion>`; **a missing icon draws nothing, silently**, :83),
  `itemLabel` (★ if `rare`), `condColor` (dead/low/poison), `statusText`, `gauge`, `labelNum`, `lrArrows`, `frame`, `say/msg/yesno`.
* **`K.Screen`** (:135–150): a menu layer base with `input()` / `render()`, `hidden` (the parent hides itself while a child screen runs), and
  **`flow(asyncFn)`**, which sets `busy`, ignores input until the function resolves, reports errors, then `Input.consume()`. **Classes are built lazily**
  (`let C=null; const cls=()=>C||(C=build())`) because `Menu.kit` comes from another file and the in-directory load order is not guaranteed. New
  screens must do the same. Sub-menus are non-opaque layers: the field still renders underneath.
* **Cursor memory** = module-level `let`s: `lastCmd` (menu.js:519), `lastMember` (equip/items/status/jobs), `lastTab`, `lastPage`, `lastMon`, `lastJob`.
  They are index-based and survive new game/load, so after a party change "the same member" is a different person. That is harmless, but reset them if you add a roster swap.

---------------------------------------------------------------------------------------------------
## 4. Field main menu (menu.js:510–619)

* `COMMANDS` (:510): 道具 アビリティ 装備 ジョブ セット 強さ 並び替え 図鑑 地図 セーブ 設定 (11). `List{x:4,y:4,w:150,cols:2,rows:6}` → 4..102.
  地図 is disabled unless on the world map **and** `R.Minimap` exists (:526), although `Minimap` already computes the party position from inside
  towns and dungeons (minimap.js:107).
* `run(cmd)` (:539): dispatches via the `screens` table (:540), sets `hidden` while the child runs, and closes the whole menu if the child returns `'exit'` or
  `Menu._after` is set.
* `render` (:557): `drawGold(4,104,150)` (ゴールド, プレイ時間, and a `★称号` line when `R.Game.title` is set → height 58, :566), `drawParty(156,4)`,
  `drawObjective(4, titled?164:150, 248)` (`DB.objectives[R.Game.objective].text`, ≤4 lines, titled 次の目的).
* **`drawParty` (:575–589)**: 3 windows 96×46 stacked at pitch 48 (y 4/52/100): name + `Lv`, **job name** (cyan), `H hp  M mp`.
  **4 members: the 4th window is at y 148–194, under the full-width objective window** (screenshot-confirmed).
  *Minimal fix:* keep 4 × 96×46 (y 4/52/100/148, ends 194) and move the objective window into the left column (`x4, w150`; up to 4 lines at y150, 3 if
  titled). Replace the job line with the row tag (前列/中列) + `W wp`. Alternative: a 4 × 61-px top strip identical to battle's proposal
  (battle.md §14) as a shared `K.drawPartyStrip`.
* **Deferred field actions:** teleport/exit found inside a sub-screen set `Menu._after` (afterMenu, :359). `Menu.open` awaits the layer, then runs
  `_after` through `R.Events.run(fn,{self:'menu'})`, so messages and warps happen with the menu fully closed. Keep this for 術-based teleport/exit.
* *Chronicle command proposal (≤12 fits the 2×6 grid):* 道具 / 技・術 / 装備 / 強さ / 隊列 / 技の書 (tabs 技・術) / 図鑑 / 地図 / セーブ / 設定 (+2 spare,
  e.g. 年代記). The companion swap happens at the tavern, not here.

---------------------------------------------------------------------------------------------------
## 5. Party picker and 並び替え

* `PickerLayer` (menu.js:154–209): `w150`, `rowH 30`, `h = 14 + n·30`; default `x = 256−156`, `y 50`. Rows show sprite, name (fitText beside the status label), H cur/max,
  M, and HP/MP gauges. Options: `{title, valid(c), initial, x, y, mark, info(x,y)}` (`info` draws an extra window under it). **N-safe**: 4 rows = 134 px, and
  with 並び替え's `y:40` + 38-px info window it ends at 214 (checked in a screenshot). Five members fit only without the info window (y50 + 164 = 214).
* `orderScreen` (menu_status.js:21–44): pick A, pick B, swap, repeat. The info text hard-codes **「先頭50%・2番目30%・3番目20%」** (:31), the Crest AI weights.
  **Chronicle → 隊列**: a per-member row `c.row = 'front'|'mid'` (recommended on the char so it serialises for free; rules decide min/max per row, e.g.
  "≥1 living in front"). UI: the same picker, where A toggles the row (or swaps the order), and the info text reads 「前列ほど敵に狙われやすい／中列は受ける物理が減る。剣は届かない」.
  Order still matters for the caterpillar, `State.leader()` and the save summary (`party[0]`, state.js:125), so **keep the hero at index 0** or read the hero by id.

---------------------------------------------------------------------------------------------------
## 6. 道具 / アビリティ and field effects

* `ItemScreen` (menu_items.js:42–152): tabs `道具 | 装備品 | 大事なもの` (`TABS` :10; the gear predicate lists the 5 types, :12), ←→ switches tabs, `List{4,30,248,rows:8}`,
  description window 4,158,248,60. A → choose 使う/捨てる or 装備する/捨てる (:74). Discard asks for a count via `number` and confirms. Gear equip (:85) uses
  `Rules.itemSlot(id)` (a **single** slot) → `pickMember(valid canEquip)` → `Rules.equip`. Gear tab footer: `gearSummary` (攻撃力/守備力/魔力/魔法防御 +
  base-stat deltas + element, :19) and **one 16×24 sprite per member, right to left from x 242 at 18-px pitch; dark = cannot equip** (:139–143). With 4 members,
  the leftmost sprite (x 170–186) overlaps the summary text (fitText 15..183). Shrink the summary `maxW` to ~150.
* Equipped items are **not** in `R.Game.inv` (`equip` moves them), so the 装備品 tab and the sell list only show spare copies.
* `AbilityScreen` (:155–226): member header, ←→ member, list of `Rules.fieldActions(c)` with `MP cost` (`Rules.mpCost`), disabled via
  `Menu.abilityBlock` (dead / MP). Chronicle: a **技・術** screen listing field-usable spells (MP) and any field techs (WP), with a cost column showing the resource.
  This needs a generic `Rules.cost(c,id) → {mp,wp}` (and `abilityBlock` → 'WPが足りない').
* `applyFieldEffect` (menu.js:261–337) handles `heal healMp revive cure grow repel`, and reports `teleport`/`exit` back. `affects()` (:235) prevents wasting items.
  Items target via `needsPick` (`ally ally_dead ally_any`), with repeated picking while the stock lasts (:424). The item user is the living member with the highest
  `itemPct` (:373). **Healing formula is duplicated** (:218–232): `R.Battle.healAmount` does not exist (also noted in battle.md §22).
  Chronicle: add `healWp` (effects + `affects`). Probably drop `grow` (stats are fixed by design; the rules owner decides). The "full HP after battle" rule does not affect menus.

---------------------------------------------------------------------------------------------------
## 7. 装備 — the 5-slot model today and the 9-slot change

### 7.1 How 5 slots work now (end to end)
* Char: `c.equip = {weapon, shield, head, body, acc}` → item id | null (rules.js:37), seeded from `DB.chars[id].startEquip` (:41).
* Item `type` **is** the slot name (`weapon shield head body acc`), with sub-types `wtype`/`atype`. `Rules.itemSlot(id)` maps type → slot 1:1 (:230).
* `Rules.canEquip(c,id,slot)` (:236–257): **job** lists `weapons/heads/bodies/shield` + `mods.equip` extras + `only:[charId]`. Dual wield: a one-handed weapon in
  the `shield` slot when `mods.twoSwords`. `if (it.type !== slot) return false` (:247).
* `Rules.equip(c,slot,id)` (:259–278): takes 1 from the inventory and returns the old item. **A two-handed weapon ejects the shield; a shield ejects a 2H weapon**.
  Clamps HP/MP. Returns **bool only** (the displaced item is not reported).
* `Rules.stats(c)` (:355–400) sums `it.stats` over `SLOTS`. The weapon in `weapon` → `atk`/element/onHit; a weapon in `shield` → `atk2` (off hand); non-weapons →
  `def`; all slots → `mag mdef eva`; `hit` from weapons. Equipment `mods` are summed over `SLOTS` in `mods()` (:348).
* `validateEquip` (:156) runs after a job/support change. `optimize` (:290) is greedy per slot by `itemScore` (:280: atk/def/mag/mdef/stat-sum; a
  "caster" is `int > str`).
* **The slot list exists 6 times**: `Rules.SLOTS/SLOT_NAMES` (rules.js:15–16), `menu_equip.js:11–12` (own copy + labels), `menu_status.js:136`
  (own list), `shop.js:11` (`EQUIP` type map), `menu_items.js:12` (gear types), `state.js:87` (`items()` sort order by type). **The two-handed rule exists 3
  times**: `rules.js:267–276`, `menu_equip.js:25–27` (preview), `shop.js:176–177` (buy-back of the displaced piece).

### 7.2 The 装備 screen (menu_equip.js)
Layout: header 4,4,248,40 (sprite, name, Lv, job; while choosing: the item's desc, 2 lines); slot window 4,46,248,96 = 5 slots + **最強装備 as row 5** (`ROWS=6`,
`row===5` → optimize, :70); stats window 4,144,248,74 = 8 values in 2 columns (`SHOW` :13: 攻撃力 守備力 魔力 魔法防御 素早さ 回避 最大HP 最大MP), `cur → next`
(green up / red down). With dual wield, 回避 is replaced by 左手 `atk2` (:169). A on a slot → the candidate `List{4,46,248,rows:6}` over the slot window
(`外す` + `candidates(c,slot)` = inventory items with `it.type===slot` (or a weapon in the shield slot) that `canEquip`), each row: icon, name (yellow if rare), count, ▲/▼ on
**one key stat** (`keyStat` :39: weapons atk or mag; everything else `def`). ←→ switches member. The preview is `previewStats(c,slot,id)` (:22), a **temporary char with only
`{id,level,job,jobs,set,bonus,equip}`** (:23).

### 7.3 What changes for 9 slots
Target (BRIEF B5): 武器1 / 武器2 / 盾 / 頭 / 体 / 手 / 足 / アクセ1 / アクセ2. (Part A says 「8つ」 but lists 9 slots. Use 9.) There are no jobs, so equip
permissions are basically only `only`, the two-handed/shield lock, and whatever DESIGN adds.

Proposed rules surface (**rules owner**; menus then never hard-code slots):
```
SLOTS      = ['weapon','weapon2','shield','head','body','hands','feet','acc1','acc2']
SLOT_TYPE  = {weapon:'weapon', weapon2:'weapon', shield:'shield', head:'head', body:'body', hands:'hands', feet:'feet', acc1:'acc', acc2:'acc'}
SLOT_NAMES = {weapon:'武器1', weapon2:'武器2', shield:'盾', head:'頭', body:'体', hands:'手', feet:'足', acc1:'装飾1', acc2:'装飾2'}
Rules.slotsFor(id)          → ['weapon','weapon2'] | ['acc1','acc2'] | ['head'] ...    (replaces itemSlot for UI)
Rules.defaultSlot(c, id)    → first empty of slotsFor, else the weaker one               (shop "equip now?", 道具→装備する)
Rules.slotLock(c, slot)     → '' | '両手持ち'                                           (UI shows why a slot is empty/locked)
Rules.equip(c, slot, id)    → {ok, removed:[ids]}                                       (menus/shop stop re-implementing 2H logic)
Rules.previewStats(c, slot, id) → stats (pure; clones the WHOLE char)                    (fixes the partial temp char)
Rules.optimize(c, focus)    focus 'phys'|'magic'|'balance' — trade-off gear makes one "best" meaningless (BRIEF: 最強装備が1パターンにならない)
```
* **Decide the 2H + shield rule.** Literal reading of the brief: any two-handed weapon in `weapon` **or** `weapon2` locks the shield. `menu_equip.js:19 twoHanded()`
  checks only the main weapon; switch it to `slotLock`. Battle already needs per-slot attack (`cmd.slot`, battle.md §21.6). Expose e.g. `st.atk` (weapon1) and
  `st.atkSub` (weapon2) and show both in the compare panel. Remove `dual()`/`左手`/`atk2` (twoSwords is gone).
* Every `it.type === slot` test must become `it.type === SLOT_TYPE[slot]`: `menu_equip.js:34`, `rules.js:247`, `rules.js:301`, and the shop's `c.equip[slot] !== id`
  "already equipped" tests (shop.js:41/:162), which must check both slots of a pair.
* New types `hands`/`feet` need: the `state.js:87` sort map (**otherwise `undefined − n = NaN` and inventory order becomes arbitrary**), `menu_items.js:12`, `shop.js:11`,
  `K.iconKey` (menu.js:66) + new `icon:*` art (gloves, boots, and the new wtypes 大剣/棍棒/鞭/体術; today only `sword knife axe spear staff rod bow claw katana
  harp shield helm hat heavy light robe acc herb potion key` are registered — missing ones are **invisible**), `gearSummary`, `STAT_NAMES` (drop 運, add 器用さ `dex` and WP).
* **Layout for 9 slots (10 rows with 最強装備):** the current full-width slot window + stats window cannot hold 10 rows plus a stats window (needs
  46+150+74 > 224). Proposal: header 4,4,248,40 as now; **slots left** `4,46,128,150` (10 rows at 14 px; 2-char labels 武器1…装飾2; names via `fitText` ~70 px);
  **compare right** `134,46,118,174` (攻撃1 攻撃2 守備 術力 術防 + 腕力 体力 器用さ 素早さ 知力 精神 = 11 rows; `cur` right-aligned at +62, `→`, `next` at +110).
  The candidate list replaces the **left** window (same rect, rows 10), so the compare column stays visible. Show **all** changed stats (trade-offs: e.g. 知力+ / 守備−),
  and colour each one green or red.
* Status page 2 needs 9 rows (menu_status.js:134–143) → its own full page (§8). The shop and the 道具 tab must pick a slot for acc/weapon (§6, §15).

---------------------------------------------------------------------------------------------------
## 8. 強さ (status) — menu_status.js:79–211

* `PAGES = ['能力','装備・アビリティ','耐性・特性']` (:79). ←→ member, ↑↓/A page (wraps). Header 4,4,248,40: sprite, name + status label, `Lv`, **job + job Lv, JP**
  (:112–113), page `n/3`.
* p1 (:120): 基本 window 4,46,122,128 (HP MP 力 体力 素早さ 知力 精神 運) + 戦闘 window 130,46,122,128 (攻撃力 [`atk/atk2`] 守備力 魔力 魔法防御 命中 回避 会心 属性),
  EXP window 4,176,248,44 (経験値, 次のレベルまで; `―` at `MAX_LEVEL`).
* p2 (:134): 装備 window (5 rows, own slot list :136) + アビリティ window (コマンド/サブ/リアクション/サポート/フィールド from `c.set` and `DB.jobs[].command`).
* p3 (:159): 8 elements (吸収/無効/半減/弱点, 威力+N from `elemBoost`), 7 status immunities, a trait line from `traits(mods)` (:190, includes JP+%, 盗み+%).
* **Chronicle pages (the array-driven cycling makes adding pages trivial):** header = name, Lv, row tag, hero type/得意, HP/MP/WP (frees the p1 rows) ·
  p1 能力: 腕力 体力 器用さ 素早さ 知力 精神 (base + equipment bonus) | 攻撃1 攻撃2 守備 術力 術防 命中 回避 会心; EXP/next ·
  p2 装備: 9 rows (4,46,248,140) + the traits line · p3 技・術: learned techs by weapon type and spells by element with costs ·
  p4 熟練度: 11 weapon types + 6 elements = 17 rows → 2 columns × 9 in one window, with 得意/不得手 marks from the char's affinities · p5 耐性: 6 elements + statuses.
  Replace `K.ELEMS` (8, menu.js:23) with the Chronicle list (ideally `Object.keys(DB.elements)`), and drop the job/JP text.

---------------------------------------------------------------------------------------------------
## 9. menu_jobs.js (ジョブ board, アビリティを覚える, セット) → remove

All of it is job-system UI (FFT board `tiers()`, JP learn list, set slots `cmd/sub/reaction/support/field`), plus `Menu.changeJob`, `reportUnequip`.
**Before deleting, move the pixel helpers** `star` (**`Menu.kitStar`, used by the bestiary**), `check`, `badge`, `cursorFrame` into menu.js's kit. Two ideas are worth
reusing: the member switch on the title row (`r = −1`), and the "set it now?" prompt after learning (menu_jobs.js:269), which works for a newly glimmered item if techs need slots.

---------------------------------------------------------------------------------------------------
## 10. 図鑑 (bestiary) — menu_status.js:46–366

* **Data:** `R.Game.bestiary[monId] = {seen, kills, drop?, rare?, steal?, stealRare?, scan?}` (state.js:21). Writers: `State.seen/killed/noteDrop(mon, kind)`
  (state.js:114–120), called from battle.js:1122 (`'drop'|'rare'`), :910 (`'steal'|'stealRare'`), and :938 (`'scan'`).
* **Order:** `monsterOrder()` (:48) sorts every `DB.monsters` key (non-boss first, then `lv`, stable). The `N/all` counters count **every** DB entry, including event-only
  phases.
* **List view:** header 見つけた n/all, 倒した n/all; `List{4,46,w150,rows:9}` of `No.### name` (unseen `？？？？？`, seen-not-beaten grey, ★ if `r.rare`); preview
  window 156,46,96,140 with the sprite (scaled by halves to fit) + 倒した数. A opens the detail (only if seen).
* **Detail:** title 4,4,248,26 (`No.`, name, page n/2); sprite panel 4,32,108,104; ←→ = prev/next **seen** monster, ↑↓/A = page.
  p1 (:308): Lv HP 攻撃力 守備力 素早さ + 倒した数 (values `？？？` until killed: `b = !!r.kills`); bottom 4,138,248,82: 経験値/ゴールド/**JP** at y145,
  **ドロップ** y159, **レア** y173 (name once `r.drop`/`r.rare`, else ？？？; `なし` only once beaten), desc 2 lines y190/203.
  p2 (:330): MP 魔力 魔法防御 回避 行動回数; 特徴: 弱点/耐性/効かない/盗める/種族 flags (5 lines max).
* **Chronicle:** remove JP; add **超レア** (`m.srare` + `noteDrop(id,'srare')`, battle.md §21.10): rows 159/173/187, desc 1 line at 201 (or move the desc to p2).
  Use a different mark per tier in the list (★ yellow for rare, a gold/pink mark for super-rare). **Golden individuals**: decide whether they are separate ids (book entries)
  or a flag on the base monster (then record `b.golden` and show a marker). **Tier scaling**: if stats are derived at runtime (battle keeps `this.id` = the book key),
  p1/p2 must show the derived stats (e.g. `R.Tier.monster(id, b.tierMax)`), not the raw `DB.monsters` stats. Record the highest tier met. Sort by family/stage
  (`m.family`, `m.stage`) rather than `lv`, and allow `noBook` to exclude event-only monsters from the counters. `stealRare` and `scan` are recorded but never shown:
  either use them (scan could reveal stats early) or drop them.
* **技の書/術の書** reuse the same pattern: an id list in fixed order, `seen(id)` = discovered by anyone (a global record in `R.Game`, since techs belong to individuals but the book
  is shared), and ？？？ rows. Generalise `BookScreen` into a small catalogue helper `{ids, known(id), name(id), drawPreview, drawDetail}` instead of copying 150 lines.

---------------------------------------------------------------------------------------------------
## 11. 地図 (minimap.js, field-owned)

The world at `s = max(1, min(floor(256/w), floor(224/h)))` px per tile (128×112 → 2 px), per-terrain colour + pattern (`TERRAIN` :9), location icons from `warpIcon`
tiles (`ICON` keyed by `loc_*` tile ids; bright if `R.Game.visited[loc]`), ship marker, blinking party marker (from inside a map via `escape`/`exit`/`location` spawn).
Cached by `map.uid:version:barrier_broken`. Any button closes it. **A world larger than 256×224 tiles overflows at s=1 (negative offset, no panning).** Chronicle: new terrain
ids (RS1 tiles) and `loc_*` icon ids need entries, otherwise they fall back to grass/town colours. Consider enabling 地図 inside towns (main menu :526).

---------------------------------------------------------------------------------------------------
## 12. セーブ, 復活の呪文, slot storage

* `save.js` (lead): `SLOTS = 3` (:10), prefix `luminous_chronicle_` (:11), keys `slot0..2`, `settings`, `lastSlot`. The backend is pluggable (`get/set/del`, async). A
  non-local backend also mirrors to local (:72). `list()` → `[{slot, summary}|null ×3]`.
* `State.serialize()` (state.js:123) → `{v:1, summary:{level (party[0]), names:['name Lv12',…], place, time, gold, title, clear}, game: clone(R.Game)}`.
  `deserialize` fills missing top-level keys from a fresh `newGame()`, drops unknown items/equip, and **re-validates job/set** (state.js:151–152, job-specific).
* `SaveScreen` (menu_save.js:171): 3 × `drawSlot` 248×56 at y 4/62/120 + a 復活の呪文を見る row at y178 (`count = noCode ? 3 : 4`, index 3 = code; the 3 is hard-coded
  at :180/:186/:201–205). Overwrite confirm, save jingle + message in parallel, `close(true)`. The `church`/`ending` options are ignored; `noCode` is never passed.
* `drawSlot` (:12): 冒険の書N, time, ★称号/クリア, **names line = `names.join('  ')` through fitText(222 px)**, place (cyan), gold.
  **4 members × 「name LvNN」 overflow the window even at the 7-px floor** (screenshot-confirmed). Chronicle summary proposal:
  `{hero:{name,level}, members:[names], chapter/tier, place, time, gold, clear, title}`. Draw the hero name + Lv, then the companions without Lv (or 4 mini sprites), and add the
  年代記 chapter count. The title's `SlotPicker` (title.js:337) uses the same `drawSlot` and also hard-codes 3 (`% 3` :346, `i<3` :359, y 36+60i).
* **呪文 (export code):** `exportCode` = JSON → `deflate-raw` (CompressionStream) → base64 with prefix **`LC1:`**, else `LC0:` (uncompressed) (save.js:81–102). These are
  **the same prefixes as Crest**, and `Title.codeGame` only checks `data.game` (title.js:278), so a Crest code "loads" and then fails on `DB.chars.yuki` lookups.
  Use e.g. `LN1:`/`LN0:` and put `app:'chronicle'` + a schema `v` in `serialize`. The code will be several KB (bestiary of 200 monsters, 20-member roster); the overlay
  textarea handles that. `codeOverlay` (menu_save.js:33) is a DOM box over `#screen`: it disables `R.Input`, uses capture-phase keydown (X/Esc/Backspace close; in export mode also Z/Enter),
  and copies via clipboard API → `execCommand` fallback.

---------------------------------------------------------------------------------------------------
## 13. 設定 (menu_save.js:145–279)

Rows (`SETTINGS`): メッセージ速度 `msgSpeed` 0–3 · 戦闘速度 `battleSpeed` 0–2 · BGM/効果音 volume (10-step bars; A at max wraps to 0) · 常にダッシュ · ウインドウの色
(`black blue green red`) · タッチパッド (`auto on off` → `R.applyTouchSetting`) · **決定ボタン `padConfirm` `right|bottom`** (input.js:109 swaps standard buttons
1/0 at poll time; keyboard and touch are unaffected; Start (9) is also B) · **オート継続 `autoKeep`** (read by battle_scene start; its desc says ボス戦・イベント
戦闘 are manual → add レアモンスター戦 for Chronicle) · カーソル記憶 `cursorMemory` (battle only) · 戻る. Each change is applied and saved immediately (`applySetting` :158).
**Capacity:** the row pitch is `max(14, min(16, floor(154/(n+1))))`. At 11 rows the description window drops to 1 line, and at 12+ it becomes 18 px tall and the text overflows.
Beyond 11 settings, split into pages. **Every new key needs a default in `DEFAULT_SETTINGS` (save.js:14)**, otherwise the row displays `names[0]` while the game reads `undefined`.

---------------------------------------------------------------------------------------------------
## 14. 名前入力 → hero creation (nameentry.js)

* Now: `ORDER = ['yuki','non','metem']` (:15). One `NameLayer` per hero (opaque): header 4,2,248,54 (32×48 sprite `party:<id>:<startJob>`, `DB.chars[id].profile`,
  name with 6 underline slots and a caret); grid window 4,58,248,126, `COLS 10 × ROWS 9`, cells `x = 22+22·col (+6 after col 5)`, `y = 67+12.8·row`; pages
  ひらがな / カタカナ (`toKata` = +0x60 on ぁ–ゖ) / 英数字; command window 4,186,248,36 with 2×3 cells ひらがな カタカナ 英数字 / 1字消す キーボード 決定.
  Cursor: ↑ from grid row 0 → bottom command row, ↓ past grid row 8 → top command row (column mapped by thirds). B deletes one char; on an empty name B goes back to the previous hero
  (first hero → `null`, back to the title). The name is full → the cursor jumps to 決定.
* Limits: `MAX_LEN 8`, `MAX_W = 6 full-width chars` (:13–14), `VALID = /^[ぁ-ゖァ-ヺーA-Za-z0-9]+$/`, a kanji-specific error, `normalize` = NFKC + strip spaces.
* **DOM keyboard / IME** (`keyboardOverlay`, :193): a fixed `<div>` over the canvas (appended to `body`), `<input maxLength=16>`, **Enter submits only when not
  `isComposing`** (IME safe), Escape cancels, validation shown inline. It disables `R.Input` while open.
* Confirm: `ConfirmLayer` (3 rows: sprite, name at 16 px, ♂/♀) + `yesno('この名前で冒険を始めますか？')` (:267–304). `apply(names)` writes `c.name` **after**
  `State.newGame()` (title.js:262–263).
* **Chronicle:** 1 hero, **4–5 chars** (BRIEF 「4〜5文字」) → `MAX_LEN 5`, `MAX_W = 5·FS + 1` (≈54 px; this matches battle's 52-px `fitText` name slot), 5 underline slots.
  The sequence becomes gender (2 sprites) → type (戦士系/術師系…) → favoured weapon type or element → name → confirm (sprite, name, type, favourite). The result is
  `{gender, type, fav, name}` → `R.State.newGame(opts)`. Refactor `NameLayer` into `R.NameEntry.run({initial, sprite, label}) → name|null` (reusable) and add
  `R.HeroCreate.run()`. Companions have fixed names and are picked later at the tavern (story event → a new recruit screen, §19). Sprite keys depend on art
  (`party:<id>:<job>` today).

---------------------------------------------------------------------------------------------------
## 15. Shops, inn, church (shop.js)

* `Shop.open(id)` (:222): pushes `GoldLayer` (172,4,80,24), then loops 「いらっしゃいませ！ ここは〇〇です。」 → 買う/売る/やめる. Guarded against double-open. It always removes its
  layers in `finally`.
* **Buy** (:126): `ShopList('buy', shop.items)` = `List{4,4,w166,rows:9}`: icon, name(★) via fitText, price (red if unaffordable). Side panel **172,30,80,118**; for gear, one row per member
  at **`y = 36 + 36·i`**: sprite (dark if `gearDelta` is null), name (**plain `text`, no fitText → 5-char names overflow the panel**), and a marker: `×` cannot / `E` same item equipped /
  `±N` key-stat delta (green/red) / `○` no key stat. Non-gear: 所持数 (+ 売値 when selling). Description window 8,150,240,68: desc ≤3 lines + `gearSummary`.
  **4 members: row 4 starts at y144 and spills into the description window** (screenshot-confirmed). Fix: 28-px rows (sprite 24 + name/marker lines) → 36/64/92/120, ending at 148.
* `gearDelta` (:36) uses **its own `keyStat`** (:20; accessories → best base stat mapped to a derived stat, incl. `luk`), which differs from menu_equip's `keyStat`
  (accessories → `def`). Merge them into one exported helper. With trade-off gear a single ± is misleading. Consider: ↑↓ picks the item and ←→ the focus member, and the description window
  shows that member's full diff.
* Consumables: `buyItems` (:141), room `99 − count`, `number` with price, 「〜ですね。毎度ありがとうございます！」. Gear: `buyGear` (:155): warns if nobody can equip it → takes the gold →
  **equip now?** → pick a member (if >1 candidate) → `Rules.equip(c, itemSlot(id), id)` → offers to buy back the old item and the one displaced by the two-handed rule at half price.
  Chronicle: choose the slot via `Rules.defaultSlot` (or ask メイン/サブ, 装飾1/2), and use `equip().removed` for the buy-back list.
* **Sell** (:193): all non-key inventory, disabled if `price 0`; count via `number`; confirm; `floor(price/2)`.
* **Tier-scaled stock:** `buy()` reads the static `shop.items` (:127). Add one resolver (e.g. `Shop.stock(shop)` → `shop.items` | `shop.tiers[≤R.Game.tier]` union | function) so
  the data owner can choose a format without touching the flow. Rarity labels: `it.rare ? ★ : ''` and `rare ? yellow : white` appear in 6 places. With 通常/レア/超レア,
  add `K.itemLabel/itemColor(it)` (e.g. `rarity 0|1|2`) and use it everywhere.
* **Inn** (`Shop.inn(price)`, :247): yes/no → pay → fade out → `State.healAll()` → `inn` jingle → `Field.setRespawnHere()` → fade in → morning line. Returns bool. `healAll`
  (state.js:101) must also restore **WP** (and the bench, if the bench can be hurt).
* **Church** (`Shop.church()`, :275): sets the respawn point, then お祈りをする (save screen with the gold layer hidden) / 生き返らせる (**price 10×level**, full HP) / 毒の治療 (10 G) / やめる;
  a picker `choose` with prices if several members qualify. It is N-safe. Re-price by tier if levels mean little in Chronicle.

---------------------------------------------------------------------------------------------------
## 16. Title (title.js) and game over (gameover.js)

* Title: opaque `TitleLayer` with cached procedural art: night sky bands + milky way + moon + mountains + **castle silhouette** (`buildBackground` :28), the **crest shield with 5
  gems** (`buildCrest` :99, Crest lore), logo from **`R.TITLE`** (ns.js:10 is still **'ルミナス・クレスト'**) rendered at device resolution (`buildLogo` :148; rebuilt once the
  font is ready), and `SUB = '〜 光の紋章と三人の勇者 〜'` (:11). Twinkling stars and a shooting star. `ver R.VERSION` bottom right. Stage `press` (A/B; the first press starts the BGM)
  → `menu`: `choose` at 76,132,w104 **はじめから / つづきから (disabled without saves) / 復活の呪文 / 設定** (:239); B → back to press.
  `newGame` (:253): NameEntry → stop BGM → fade → `State.newGame()` → `NameEntry.apply` → `Field.start(State.START)`. `continueGame` → `SlotPicker` → `Save.load` → `boot`
  (`State.deserialize` → `Field.resume`). `codeGame` → overlay → `importCode` → `boot`.
  **Chronicle:** set `R.TITLE='ルミナス・クロニクル'` (lead), subtitle 〜八つの伝承〜 (BRIEF B2), **add 「© Studio Metem」** (e.g. centred size 8 at y 206, clear of the menu at
  132–202), replace the castle/crest art with a chronicle/book emblem (8 legends), and route はじめから through hero creation.
* Game over (:51): black + dark-red glow, 「全滅してしまった……」, `gameover` jingle (A/B skip after 80 f, max 420 f), fade the text, `State.wipeRecover()` (half gold, full
  heal), `Field.respawn()`, 「……〈leader name〉たちは目を覚ました。」 + a lost-gold line. BRIEF: 「直前の町へ」. Today the respawn point is set only by inn/church/save/king.
  If "last town" means the last town entered, the field owner should set `R.Game.respawn` on town entry.

---------------------------------------------------------------------------------------------------
## 17. Hard-coded checklist

| assumption | where | Chronicle effect / action |
|---|---|---|
| 3 party windows at pitch 48 | menu.js:575–589 (+ objective at :562) | 4th hidden under 次の目的 → §4 |
| shop panel rows 36 px, h118; names not fitted | shop.js:91–104 | 4th row overflows; 5-char names overflow → 28-px rows + fitText |
| save summary `names` all members + Lv | state.js:131, menu_save.js:22 | overflows at 4 → hero-centred summary |
| gear sprites from x242, 18 px each | menu_items.js:139–143 | overlaps summary → shrink maxW |
| formation text 50/30/20 % | menu_status.js:31 | rows 前列/中列 |
| `ORDER yuki/non/metem`, 3 confirm rows, 6-char names | nameentry.js:13–15, :273 | 1 hero, 5 chars, creation flow |
| `{yuki}{non}{metem}` placeholders, `DB.chars.yuki` fallback | ui.js:22, :32 | `{hero}` (lead) |
| `R.PARTY_ORDER`, `START`, herb start | state.js:9–14, :32 | state/data owners |
| 3 save slots | save.js:10, menu_save.js:180/186/201, title.js:346/359 | read `R.Save.SLOTS` if the count changes |
| subtitle 三人の勇者, R.TITLE Crest | title.js:11, ns.js:10 | new title/subtitle/©. The `names` comment in title.js:255 |
| job name / JP / job Lv shown | menu.js:583 (party), menu_equip.js:145, menu_items.js:213, menu_status.js:112–113/:145–152, menu_jobs.js (all) | row / type / WP instead |
| sprite key `party:<id>:<job>`, outfit fallback from `DB.jobs` | menu.js:45, :62; nameentry.js:155/:274 | art-owner key scheme |
| 5 slots (6 copies), `type===slot` (4), 2H rule (3) | §7.1 | 9 slots via rules helpers |
| `twoSwords`/左手/`atk2` | menu_equip.js:18/:89/:155/:169, menu_status.js:125/:136, rules.js:243/:389 | remove; weapon2 attack instead |
| 8 elements, `luk:'運'` | menu.js:16/:19/:23, shop.js:25–26 (+ unused `STAT_SHORT` :33), menu_items.js:27 | 6 elements; `dex` 器用さ |
| 2 drop rows + JP in book | menu_status.js:317–327 | 3 tiers, no JP |
| mpCost only | menu.js:449/:457, menu_items.js:204 | MP + WP costs |
| optimize = one score | rules.js:280–309, menu_equip.js:116 | focus modes |

---------------------------------------------------------------------------------------------------
## 18. Gotchas and latent bugs

* **`Menu.kitStar` lives in menu_jobs.js** (:461). Deleting the file makes `BookScreen.drawRow` throw for any monster with `r.rare`.
* **`previewStats` builds a partial char** (menu_equip.js:23). Any new char field that `stats()`/`mods()` reads (fixed base stats, row, glimmered techs, proficiency…) is missing →
  wrong previews in 装備 **and** the shop. Clone the whole char (`Object.assign({}, c, {equip:{...c.equip}})`) or move this into rules.
* Two different `keyStat`s (menu_equip.js:39 vs shop.js:20): the arrow in 装備 and the ± in the shop disagree for accessories.
* `R.Battle.healAmount` does not exist → the field heal formula is duplicated (menu.js:227–231).
* The `LC1:`/`LC0:` 呪文 prefix is shared with Crest (save.js:87/:89), and there is no app check (title.js:278).
* `State.addItem` clamps at 99 **silently** (state.js:76). `buyGear` doesn't check room, so the 100th copy is paid for and lost. Drops beyond 99 vanish too.
* `state.js:87` has no entry for a new item type → NaN sort. `K.drawIcon` draws nothing for unregistered icons (no warning).
* The 道具 list's left/right are taken by tabs, so there is no page-jump. With 300+ gear items, add type sub-tabs or a page key.
* Settings rows past 11 break the description window, and a new setting without a default shows the wrong value (§13).
* The main menu 地図 is disabled off the world map for no technical reason. A world larger than 256×224 tiles overflows the minimap.
* The bestiary counts every `DB.monsters` entry, and `stealRare`/`scan` are recorded but never displayed.
* The church and the inn set the respawn point twice (events_runtime.js:212 + shop.js:276, events_runtime.js:201 + shop.js:263), which is harmless. `ev.saveMenu` also sets it (events_runtime.js:217), so any event save point becomes a respawn point. The `SaveScreen` options `church`/`ending`/`noCode` are unused.
* `ShopList` `if (!this.list.rows) this.list.rows = 1` (shop.js:69) is a no-op (the List constructor already guarantees ≥1).
* Two different overlays attach to different parents (`codeOverlay` → `#game`, `keyboardOverlay` → `body`). Both size themselves from `#screen`'s rect **once** (a resize or rotation while open misplaces them).

---------------------------------------------------------------------------------------------------
## 19. New screens Chronicle needs (not in Crest)

| screen | base it on | notes |
|---|---|---|
| Hero creation (gender, type, favourite, name) | NameLayer + `choose` + ConfirmLayer | §14 |
| Companion pick (20 → 3) and tavern swap | BookScreen list+detail, PickerLayer | profile, 得手不得手 (weapon/element affinity), join line; the hero cannot be benched; decide whether gear stays on benched members (simplest: yes) |
| 技・術 (field use) | AbilityScreen | MP/WP cost, `Menu.useAbility` generalised |
| 技の書 / 術の書 | BookScreen (catalogue helper) | ？？？ for unknown; per-member "who knows it" marks |
| 隊列 | PickerLayer / orderScreen | row toggle + order |
| 強さ 熟練度 page | status p1 two-column window | 17 rows |

---------------------------------------------------------------------------------------------------
## 20. How to check layouts

Reference build (has data), 4th member injected, long names:
```
cd /tmp/claude-0/ref/rpg && node tools/shot.js --wait 1500 --eval "(async()=>{const R=RPG; R.State.newGame();
  const c=R.Rules.newChar('non'); R.Game.party.push(c);
  R.Game.party.forEach((p,i)=>p.name=['ユウキナナ','ノンノンノ','メテムメテ','ヨンメイナ'][i]);
  await R.Field.start('regnas_town','entrance'); await R.Engine.wait(20); R.Menu.open(); return 1})()" \
  --wait 800 --shot /tmp/x_menu.png --keys "b" --eval "(()=>{RPG.Shop.open('regnas_weapon');return 1})()" --keys a --wait 600 --out /tmp/x_shop.png
```
(The main-menu grid has 2 columns: `down*2,a` opens セット, not 装備.) In the fork, the same works once chars/items exist. Menu logic that has no canvas
(`applyFieldEffect`, `affects`, rules helpers) can be tested in node with `require('./tools/lib/load')()`.

---------------------------------------------------------------------------------------------------
## 21. Requests to other owners (files the menu owner does not own)

* **lead** — `ui.js` placeholders `{hero}`; `ns.js` `R.TITLE`; `save.js` code prefix + `DEFAULT_SETTINGS` for any new setting (+ optional default `windowColor:'blue'` / new theme in gfx.js).
* **rules** — `SLOTS/SLOT_TYPE/SLOT_NAMES`, `slotsFor`, `defaultSlot`, `slotLock`, `equip → {ok, removed}`, `previewStats`, `optimize(c, focus)`, `cost(c,id) → {mp,wp}`,
  per-slot attack (`atk`/`atkSub`), and one shared `keyStat`.
* **state** — `items()` order for the new types; WP in `healAll`; serialize `app` id + a hero-centred `summary`; `c.row`; roster/bench; glimmer book record; `bestiary[id].srare/golden/tierMax`.
* **art** — `icon:*` for the new wtypes and hands/feet; the party sprite key scheme without jobs (hero m/f + 20 companions).
* **battle** — `noteDrop(id,'srare')`; export `R.Battle.healAmount`.
* **field** — minimap terrain/icon ids for the RS1 tiles; respawn on town entry if that is what 「直前の町」 means.
