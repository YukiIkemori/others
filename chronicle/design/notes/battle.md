# Battle subsystem — porting note (Crest → Chronicle)

Scope: `src/systems/battle.js` (rules engine, 1230 lines), `battle_ai.js` (monster + party AI, 250),
`battle_fx.js` (animations/digits/icons, 944), `battle_scene.js` (DQ5 scene + `R.Battle.start`, 893), and how
`rules.js` feeds them. The fork copy is byte-identical to `/tmp/claude-0/ref/rpg/src/systems` (checked with `diff -rq`).
Line numbers below are for the current fork. Reference tests: `node tools/test_battle.js` in the ref tree prints
**1173 passed, 0 failed**. The fork has **no** `tools/test_battle.js` and **no** `tools/fixtures/` (they were not copied).

---------------------------------------------------------------------------------------------------
## 1. Architecture in one picture

```
field.js:889 / events_runtime.js:130 / debug.js:61
        │  await R.Battle.start(o)                         (battle_scene.js:850)
        ▼
 buildMons(o) ──► new B.Engine({party:R.Game.party, mons, inv:R.Game.inv, live:true, ...})   (battle.js:159)
        │
        ▼
 BattleScene (R.Layer)  main() :190 ── for (ev of eng.begin() / eng.playRound(cmds) / eng.rewards()) await handle(ev)
        ▲                                   │
        │ commands (player menus or R.BattleAI.partyCommands)                                │ events {t:...}
        └───────────────────────────────────┘
 R.Battle.simulate(o) (battle.js:1182) drains the SAME generators headlessly on cloned party/inv (balance tools).
```

* **The engine is a set of generator functions.** State changes happen exactly when the matching event is yielded,
  so the scene can animate in sync, and `simulate()` runs the same code by draining the stream. **Rule: put every new
  mechanic (glimmer, WP, rows, proficiency) in the engine and have it yield events. The scene only presents them.**
  Then `simulate()` and the balance tools see the mechanic for free.
* Event vocabulary (header comment battle.js:9–13, plus a few extra fields):

| event | fields | produced by | scene reaction (`handle`, scene:256) |
|---|---|---|---|
| `msg` | text | `eng.m()` everywhere | `say()` typewriter |
| `actor` | u (null = party escape) | `turn`, `tryEscape` | clear msg box, raise the acting party window, blink the acting monster for 8f |
| `fx` | fx, user, targets, ab, kind (`attack`/`ability`/`react`) | attack/useAbility/damageEffect/react | `playFx` → `R.BattleFX.play` |
| `dmg` | u, n, crit, mp, kind (`phys`/`magic`/`poison`/`cost`), src | hit/endTurn/useAbility | `onDamage`: popup, shake/flash, sfx |
| `heal` | u, n, mp | restore | green/cyan popup |
| `miss` | u, att | hit/damageEffect | sfx miss, monster dodge, "MISS" popup |
| `crit` | u | hit | sfx crit + white screen flash |
| `die` | u, killer | die | `onDie`: dissolve / boss explosion |
| `revive` | u | effect revive / ko reaction | revive pillar fx |
| `status` | u, s, on | inflict/clearStatus | status puff if not already shown by the spell fx |
| `buff` | u, stat, d, grow? | buff/dispel/grow | buff/debuff sfx |
| `flee` | u | monster runs | slide-out animation |
| `escape` | ok | tryEscape / escape effect | sfx + 24f |
| `cover`/`react` | u (+ally/a) | cover / reactions | raise that window |
| `gain` | item, rare | steal / rewards | sfx (`item` if rare, else `steal`) |
| `rare` | — | rare drop/steal | flash `#fff4b0` + `R.jingle('rare')` |
| `victory` / `jingle` / `pause` / `clear` | id / levels | rewards | stopBGM+victory jingle / jingle / wait key / clear box |

---------------------------------------------------------------------------------------------------
## 2. Entry point `R.Battle.start(o)` (battle_scene.js:850–890)

1. Requires `R.Game`. **Rare swap**: a plain zone encounter (`o.zone`, no troop/mons, no `o.noRare`) becomes
   `mons:[[rr.mon,1]], rareMon` with probability `DB.rareEncounters[zone].rate` (:854–857).
2. `B.buildMons(o)` (battle.js:1146): `o.mons` > `DB.troops[o.troop].mons` > `U.weighted(DB.encounters[zone].groups).mons`;
   each entry `[id,n]` or `[id,min,max]`; **cap 8** monsters; unknown ids warn and are skipped; species are sorted to be
   adjacent (needed for `group` targeting and display groups).
3. `new B.Engine({party:R.Game.party, mons, inv:R.Game.inv, live:true, noEscape: o.noEscape||troop.noEscape,
   surprise:o.surprise, noSurprise:!o.zone})`. Surprise is rolled only for zone battles. `Engine.noEscape` is also
   true whenever any monster has flag `boss`.
4. bg = `o.bg || troop.bg || zone.bg || 'grass'`; bgm = `o.bgm || troop.bgm || (eng.boss ? 'boss' : 'battle')`;
   `R.Audio.pushBGM(bgm)`, and `popBGM()` in `finally`.
5. `R.Game.battles++`. Auto carry-over: `randomFight = zone && !troop && !mons && !canLose && !noEscape && !boss`;
   `autoStart = randomFight && R.Settings.autoKeep !== false && B.autoCarry`. A rare monster sets `mons`, so it always starts manual.
6. `B.current = scene`; `await R.Engine.run(scene)`; then `R.Game.wins++` or `R.Game.escapes++`; `R.emit('battleEnd', res, o)`.
7. Returns `'win'|'lose'|'escape'`. On `'lose'` the party is left as it is. The callers run the game over:
   field.js:890 calls `Field.gameOver()`, and events_runtime.js:132 handles `canLose` (it revives the dead to 1 HP) or runs the game over and throws ABORT.

Engine options (battle.js:156): `{party:[char], mons:[monId], inv, live, noEscape, surprise, noSurprise}`.
`live:true` is the only switch that writes `R.Game`: bestiary seen/killed/noteDrop, gold, and items via `R.State`.

---------------------------------------------------------------------------------------------------
## 3. Units, and how `rules.js` feeds them

`PartyUnit` (battle.js:86) wraps the **live character object**. `hp`/`mp`/`status` are getters/setters on `c`, so
a real battle mutates `R.Game.party` directly (simulate clones first). On construction, all statuses except poison
are wiped (:91).
`this.st = R.Rules.stats(c)` is **cached**. It is refreshed only in the constructor, after `grow`, and after a level-up in
`rewards`. Anything that changes stats mid-battle (equipment swap, a new "stance") must call `u.refresh()`.
`permRegen` is read once from `st.mods.regen` in the constructor.

| what battle reads | source in rules.js | consumed at |
|---|---|---|
| `st.hp/mp` (max), `str vit agi int mnd luk` | `stats()` rules.js:357 (base × job `mult` × `%` mods + item stats) | `u.stat(k)`; agi → initiative/escape/steal; mnd → heal; luk → steal |
| `atk` = str+weapon atk+unarmed+mods.atk (×atkPct) | :388 | phys roll |
| `atk2` = off-hand weapon in **shield slot** | :389 | `dualWield()` battle.js:470, second swing ×`OFFHAND_MULT` 0.6 |
| `def` = vit/2+armor def, `mag` = int+mag, `mdef` = mnd/2+mdef | :390–392 | roll |
| `hit` = 95+…, `eva` = agi/16+…, `crit` = 3+luk/32+crit+critPct | :393–395 | roll |
| `element`, `onHit` (main weapon only) | :376 | phys element, `attack()` onHit status |
| `mods` (merged job innate + reaction/support/field + equipment) | `mods()` :327 | see below |
| MP cost | `Rules.mpCost(c,id)` :222 (recomputes `mods` each call) | `Engine.mpCost` :209 |
| command list | `Rules.commands(c)` :204 | scene `memberMenu` |
| learned actions per job | `Rules.actionList(c, job)` :197 | scene menus, AI `abilityOptions` |
| reaction | `c.set.reaction` + `Rules.learned` | `reactionOf` battle.js:942 |
| level-up / JP | `Rules.gainExp` :60, `gainJp` :126, `expForLevel` | `rewards()` |

Mods that battle consumes: `elemResist elemBoost statusImmune regen startBuffs twoSwords physPct magicPct healPct itemPct stealPct rarePct(steal) expPct jpPct`
per unit (`Engine.pct(u,key)` returns 0 for monsters), and `preemptPct escapePct dropPct rarePct goldPct` **summed over
living members** (`partyMod`, battle.js:208). With 4 members, party sums grow by a third. Rebalance or switch to max().

`MonUnit` (battle.js:115) reads `DB.monsters[id]` into `this.d`. `stat(k)` falls back to these defaults: hit 95, eva 3, crit 1.5,
luk = lv, mnd = mag, int = mag (:132). `mods` is an empty frozen object. `resist(s)` uses `d.statusRes`, and bosses always resist `death`.
Duplicate species get full-width letters `ＡＢＣ…Ｈ` (`LETTERS`, :54, :168).

---------------------------------------------------------------------------------------------------
## 4. Turn flow

* `begin()` :262: one "appeared" line per species group (a single rare monster uses `d.appear`); `R.State.seen`
  once per species; surprise roll `pre = 1/16 + preemptPct/100`, `ambush = next 1/32`, not for bosses or `noSurprise`;
  messages 「しかし魔物たちは、まだこちらに気づいていない！」/「魔物たちがいきなり襲いかかってきた！」;
  `startBuffs` applied.
* `playRound(cmds)` :289. `cmds` is an **array indexed by party idx** of `{type:'attack'|'ability'|'item'|'defend', id, target:Unit}`,
  or `{flee:true}` for the whole party. Round 1 with `pre` means monsters skip it; `ambush` means the party skips it (the scene does not even open
  the menu, scene:196). Initiative = `agi × stageMult(buffs.agi) × rand(0.6..1.0)`; defend gets `+1e6` (it always goes first).
  Monsters add `actsPerTurn` (clamped 1..3) entries. The order is sorted once per round. Dead units are skipped and `checkEnd()` runs between turns.
* `turn(u, cmd)` :327. A party member with no command (revived this round) only gets end-of-turn upkeep. Sleep/paralyze use up the
  turn (the counter decrements, wake-up costs the turn). Confuse → `confusedCommand` (50 % ally, never self). Monster with
  flag `flee` (not boss) → runs with `fleeRate` (default 0.3) **before** choosing an action. Otherwise `R.BattleAI.monster()`.
  After that come `execute`, then `flushReactions`, then `endTurn` (poison 1/12, regen 1/10, timed statuses tick down), then `u.acts++`.
* `execute(u, cmd)` :373 is the **single choke point** for every normal action: `attack`, `defend`, `wait`, `flee`
  (monster), `ability` (a non-action id falls back to attack), and `item` (uses `item.use`). **This is where to hook glimmer (閃き) and proficiency.**

---------------------------------------------------------------------------------------------------
## 5. Command input UI (battle_scene.js:385–518)

Geometry: `BOX = {x:8, y:150, w:240, h:68, lines:4}` (:17). The help strip is `window(BOX.x, 128, BOX.w, 21)` (:808).

* `commandPhase()` :385. In auto mode it returns `R.BattleAI.partyCommands(eng)`. If nobody is commandable it waits 24f and returns `[]`.
  Otherwise it loops over `partyMenu` → `memberCommands`.
* `partyMenu()` :402: `UI.List` at BOX (w 84, rows 3, lineH 16, padY 10, `cancel:false`) with 戦う / オート / 逃げる
  (逃げる is disabled when `noEscape`). The right side shows `drawEnemyList` (groups with counts, max 4 lines, :816).
  Result 1 → auto, 2 → `{flee:true}`.
* `memberCommands()` :412 walks `eng.party.filter(commandable)`. B goes back one member and un-reserves its item.
  `reserved[itemId]` stops two members from queuing the last herb.
* `memberMenu(u)` :442: items come from `R.Rules.commands(c)` (戦う / job command / sub-job command / 防御 / 道具),
  in a List w 154, **2 cols × 3 rows (6 slots)**, titled with `c.name`. It disables a job command with no learned actions and 道具 when there are no items.
  It dispatches on `k.type`: `attack` → `pickTarget('enemy')`, `defend`, `job` → `abilityMenu`, `item` → `itemMenu`.
* `abilityMenu(u,k)` :473: full-width List, 2×3 (scrolls), `right` = the MP cost as a bare number,
  `disabled = !!eng.unusable(u,id)`. The help strip shows `desc` or the reason (`silence`/`mp`/`field`, :494).
* `itemMenu` :501: `battleItems(reserved)` sorts by rare, `sort`, then price, with a ★ prefix for rare items. The count shown already subtracts reservations.
* Cursor memory `MEM[c.id] = {cmd, ab:{[job]:i}, item, target:monsterKey}` (:20) lives for the session only and is ignored when
  `R.Settings.cursorMemory` is false.
* `ask(fn)` (:138) installs a per-frame input poll that `update()` (:599) calls. Returning anything other than `undefined` resolves it.

---------------------------------------------------------------------------------------------------
## 6. Targeting

Engine side (`targets(u, act, chosen)` battle.js:690), per ability `target`:
`enemy` → `pickFoe` (chosen if alive, else same species, else, for monsters, a formation-weighted pick);
`group` → every living foe with the chosen foe's `id` (**monsters' `group` on the party = whole party**);
`enemies`/`random` → all living foes (`random` re-picks per hit in `useAbility`, count from `hits`);
`ally` → chosen if alive, else the lowest HP%; `allies` → living friends (all non-gone friends if the effects contain `revive`);
`self`; `ally_dead` → chosen dead ally or the first dead one; `ally_any` → chosen (alive or dead) or self.
`cover` reaction (:491) can redirect single-target physical hits aimed at an ally below 25 % HP.

Scene side (`pickTarget` :521): `enemy`/`group` → `pickEnemy` (choices sorted by sprite x, left/up = previous, highlighted
by `picking.units`, which gives the down-arrow cursor and a pulsing white tint); `ally`/`ally_any`/`ally_dead` → `pickAlly`
(it raises the window and draws an up-arrow under it, and the help strip shows `name HP a/b MP c/d`); `enemies`/`random`/`allies` → `confirmAll`
(help label 敵全体 / 敵全体にランダム / 味方全員); `self` → `null`.
**`pickAlly` hard-codes 3 members** (:586: `for (n<3) j = (j + step + 3) % 3`). With 4 members the cursor never reaches idx 3.

---------------------------------------------------------------------------------------------------
## 7. Damage, heal and status code paths

* `roll(att, tgt, eff, ctx)` :525 is pure. It returns `{dmg, crit, miss, immune, resisted}`. `ctx.expect` gives the AI mean values
  (no RNG, `dmg × hit`). Formulas match CREST §6:
  phys: hit = `(hit×acc − eva)/100`, blind ×0.5, a sleeping/paralysed target is always hit, clamp 0.05..1; crit =
  `atk×power×rand(.95,1.05)` ignoring def; normal = `(atk×power/2 − def/4) × rand(.875,1.125) × elem × atkStage/defStage × mods`,
  and base<1 gives 0 or 1; metal takes 0–1 (1–3 on a crit).
  magic: `(power + mag×scale(0.6)) × rand(.9,1.1) × 100/(100+mdef) × magStage/mdefStage × (1+magicPct) × elem`.
  breath: `power × rand × elemMult` only. fixed: `power × rand × elem`. percent: `hp×power`, immune for bosses.
  Metal is immune to every non-phys formula except percent. `vs:{flag:mult}`, `itemPct` on item damage.
* `hit(att, tgt, r, info)` :579: miss message → crit message → defend halves → negative = absorb (heal) → `info.mp`
  hits MP instead → 0 = 「ミス！」 → HP loss, `dmg` event, message, `die()` or wake (sleep 50 %) / snap out of confusion (60 %) +
  `triggerReactions`; `drain` heals the attacker. Stats `this.stats.dealt/taken/deaths` feed `simulate()`.
* `die(u, killer)` :626 clears statuses, turns and buffs. Party: 「〜は倒れた！」 + the once-per-battle `ko` revive reaction. Monster:
  pushed to `killed` (the reward list), 「〜を倒した！」.
* `restore(t, n, kind, why)` :651 caps at max. Messages: 回復した / 吸い取った / もう満タンだ.
* `inflict(u, t, s, chance, quiet)` :664: `death` = instant KO; otherwise success `chance×(1−resist)` (regen always
  succeeds), already-afflicted = fail, turns from `TIMED` (:24). Only `poison` persists after battle (`finish()` :1132).
* Status tables that must be kept in sync when you add a status: `TIMED`, `BAD` (cure 'all'), `ST_ON`, `ST_OFF`, `NAMES.status`
  (battle.js:24–52), `canAct()`/`commandable()` (:81), `ICON_ORDER` (scene:21), `ICONS` + `STATUS_FX` (fx:273, :787),
  `DISABLING` (ai:10).
* Reactions: `triggerReactions` :948 queues by trigger `hitAny|hitPhys|hitMagic|lowHp|allyLowHp`. `flushReactions` runs
  after the actor's action, and only for commandable reactors. `react()` :981 handles counter / heal / autoItem / buff / mp. `cover` and `revive` are
  special-cased in `cover()` and `die()`.

---------------------------------------------------------------------------------------------------
## 8. Effects executor

`useAbility(u, id, ab, chosen, item)` :726 runs these steps:
1. Silence check (`ab.magic`), MP check and payment; items: `takeItem` (with `live`, this goes through `R.State.removeItem`).
2. `u.used[id] = true` (feeds AI `once` conds). The announce line is 「〜は○○を唱えた！」 (magic), 「〜の○○！」, or `ab.msg` with `{user}` `{name}`.
3. `hpCost` (max over effects, never kills).
4. `random` target: n hits, each with its own `fx` event and all effects (`ctx.once` = one hit per pick). Otherwise
   one `fx` event for all targets, then for each target each effect in order (it stops on a dead target unless the effect is `revive`).
5. If nothing was said, 「しかし何も起こらなかった！」.

`effect()` :782 handles these types: `damage`
(→ `damageEffect` :867, which covers multi-hit, re-fx per extra hit, cover, immune/resist, mp/drain) `heal healMp revive cure status regen buff
dispel steal scan escape grow teleport|exit|repel` (→ 「ここでは使えない」) `special` (→ `B.specials[id]`, a generator
`function*(eng,u,t,eff,ctx)`). **`BATTLE_EFFECT` (:1142) is a whitelist.** An ability with none of these types is `unusable → 'field'`,
so add new effect types there. `buff` clamps stages to −2..+2 (`STAGES` ×0.5/.75/1/1.5/2, stats `atk def mag mdef agi`).
`steal` (:892): monsters steal gold (live only), party uses `stealChance`/`rareStealChance` (rare monsters 1/64 base).
`scan` writes the bestiary `scan` flag.

---------------------------------------------------------------------------------------------------
## 9. Enemy AI and party AI (battle_ai.js)

* `monster(eng,u)` :76 filters `d.actions` by `w>0`, `condOk` (:15: `hpBelow hpAbove every:[n,k] (on u.acts) once round alone`)
  and `monUsable` (MP, silence). It then weights a random pick. `monCommand` (:44) returns `null` for pointless picks (heal with nobody
  under 60 %, buff at max, revive with nobody dead), and the loop re-picks. The fallback is attack.
  Single-target party picks use `pickPartyTarget` (:39): **`LINE_WEIGHTS = [5,3,2]` by party index**, where a 4th member gets `|| 1`.
  A probe with 4 members gave 45.6 / 27.3 / 18.2 / 8.9 %. This is the formation hook: replace it with row weights.
* Party AI (auto battle, and `simulate`): `partyCommands(eng, opts)` :242 builds one shared `plan` per round and calls, for
  each commandable member, `tryRevive → tryHeal (limit .4, boss .55) → tryCure → tryBuff (boss, round ≤4, 40 %) →
  offense` (expected damage with a 1.35 overkill bonus; MP weight boss .3 / easy fight ∞ (no MP) / low MP 4 / else 1.2; a skill must beat
  the plain attack by 10 %). `abilityOptions` (:91) = actions of `[c.job, c.set.sub]` via `Rules.actionList`, filtered by
  `eng.unusable`. **Auto battle never uses items**, because the scene calls `partyCommands(eng)` with no opts and `items` defaults to off. Only `simulate({items:true})` enables them.

---------------------------------------------------------------------------------------------------
## 10. Auto battle and carry-over

`partyMenu` オート → `scene.auto = true`, `R.Battle.autoCarry = true`, commands from the AI every round.
Pressing B while auto is on sets `autoCancel` (`update()` :600, the badge shows 「オート解除」 in yellow). At the next `commandPhase`, auto and autoCarry are turned off (:387).
If B was pressed during the final round, `main()` clears `autoCarry` (:203). Carry-over applies only to `randomFight` (see §2). Boss, event and rare battles
start manual but **do not clear** `autoCarry`. `R.State.newGame`/`deserialize` reset it (state.js:33, :155).
The badge is `drawAuto` (:826), drawn above the bottom box. In auto mode, message hold time runs ×1.4 faster (tickMsg :184).

## 11. Escape

The party-level 逃げる sends `{flee:true}` → `playRound` → `tryEscape(sure = preemptive round)` :431: 「〜たちは逃げ出した！」, then
`noEscape` → 「しかし逃げられない！」; success sets `result='escape'`; failure 「しかし回り込まれてしまった！」 and the party
loses its actions for the round. `escapeChance()` :450 = `clamp(0.5 + 0.1×attempts + (avgAgi_party − avgAgi_mons)/200, .3, 1) ×
(1+escapePct/100)`. The effect `escape` is guaranteed except against bosses. Monster flight: `flee` flag/command/effect → `gone`.
Everything gone counts as `win` with no rewards (「魔物たちはいなくなった。」).

---------------------------------------------------------------------------------------------------
## 12. Rewards, drops, rare flow and jingles

`computeRewards()` :1054 sums `exp/gold/jp` over `killed`. Each killed monster rolls `drop` (1/rate × (1+dropPct)) and `rare`
(1/rate × (1+rarePct)) independently. Gold gets ×goldPct. `each` = **living** members only, with full EXP (DQ style) × personal expPct, JP × jpPct.
`rewards()` :1074 yields events in this order:
`victory` (scene: stopBGM(6) + `R.jingle('victory')`, **not awaited**) → 「〜をやっつけた！」 → EXP line (「それぞれNポイントの経験値を獲得！」
or one line per member when they differ) → gold (added to `R.Game` here when live) → JP line → `pause` → per member:
level-up (`clear`, `jingle levelup`, 「〜はレベルNに上がった！」, stat gains 3 per line from `LEVEL_STATS`, `pause`), then job-up
(`jingle jobup`, job level / new job lines, `pause`) → per drop: `clear`, (`rare` event + 「★レアアイテム！」), `gain`,
「〜は○○を落としていった！」, `pause`. The scene sets `paged = true` for rewards, so `say()` waits for a key instead of scrolling (:151).
`finish()` :1132 records bestiary kills (live), strips non-poison statuses, sets dead members to 0 HP with no status, and clamps HP/MP. It runs for win, lose and escape.
Rare-monster flow: rare swap in `start()` → scene `intro()` gold flashes ×2, 「めったに出会えない魔物が現れた！」 with
`R.jingle('rare')` awaited → `begin()` uses `d.appear` → sparkles drawn around any monster with flag `rare` (`drawSparkles` :691).
Rare drops and rare steals share the `rare` event (flash + `rare` jingle).
Jingles used: `victory levelup jobup rare`. SFX used: `attack hit crit miss enemy_attack hurt magic fire ice thunder wind
earth water holy dark breath heal revive buff debuff status poison sleep death enemy_die boss_die escape roar jump item steal
warp cursor confirm confirm_soft cancel buzzer`.

---------------------------------------------------------------------------------------------------
## 13. Messages

All battle text is inlined in battle.js as template strings. `NAMES` (:29) holds the Japanese names for elements, buffs, stats and statuses
(`holy:'聖'`, `luk:'運'`). Scene `say(text)` :148 wraps with `wrapPhrases` (:52: phrase-aware kinsoku, width 220 px, runs
`R.Text.fmt` so `{placeholders}` resolve). Keeps ≤4 lines (older lines scroll off). Typewriter rate is `[0.5,1,2,999][msgSpeed] × spd`
(×3 while A is held). After typing it holds 30 frames (`m.wait`) scaled by `spd`. `waitKey()` shows the more-arrow and waits for A or B.
`spd = [1, 1.6, 2.6][battleSpeed]` and `frames(n)` waits `ceil(n/spd)`. Every `actor` event clears the box (DQ style).
`defeat()` :248: 「${party[0].name}たちは全滅した……」 + key, even for `canLose` battles (`o.canLose` is never read by the scene).

---------------------------------------------------------------------------------------------------
## 14. Status windows — exact current layout (3 windows)

```js
const WIN = { xs: [6, 88, 170], y: 6, w: 80, h: 44 }; // battle_scene.js:16  → 6..86, 88..168, 170..250
drawWindows() {                                                      // :754–786
  const C = G().C;
  const theme = G().WINDOW_THEMES[R.Settings.windowColor] || G().WINDOW_THEMES.black;
  this.eng.party.forEach((p, i) => {
    const f = this.winFx[i];                                         // {shake, flash} per member, set in onDamage/onDie
    let x = WIN.xs[i], y = WIN.y;                                    // ← idx 3 → undefined → NaN: 4th window invisible
    if (f.shake > 0) x += Math.round(Math.sin(f.shake * 1.3) * 2);
    const picked = this.picking && (this.picking.ally === p || (this.picking.allies && !p.gone));
    if (this.acting === p || picked) y -= 3;                         // acting/targeted member pops up 3px
    const red = f.flash > 0 && Math.floor(f.flash / 3) % 2 === 0;
    G().window(x, y, WIN.w, WIN.h, { theme: red ? 'red' : undefined });
    const col = p.hp <= 0 ? C.dead : p.hp < p.mhp * 0.25 ? C.yellow : C.white;
    const tw = Math.ceil(G().textWidth(p.name)) + 8;                 // name sits ON the top border
    const tx = x + Math.floor((WIN.w - tw) / 2);
    G().rect(tx, y, tw, 5, red ? G().WINDOW_THEMES.red.fill : theme.fill);
    G().text(p.name, tx + 4, y - 3, { color: col });
    G().text('H', x + 9, y + 8, { color: col });  G().text(String(p.hp), x + WIN.w - 9, y + 8,  { color: col, align: 'right' });
    G().text('M', x + 9, y + 19, { color: col }); G().text(String(p.mp), x + WIN.w - 9, y + 19, { color: col, align: 'right' });
    G().text('Lv', x + 9, y + 30, { color: col }); G().text(String(p.level), x + 30, y + 30, { color: col });
    const icons = ICON_ORDER.filter((s) => p.status[s] || (s === 'regen' && p.permRegen && p.alive));
    if (p.alive) { if (max(buffs) > 0) icons.push('up'); if (min(buffs) < 0) icons.push('down'); }
    icons.slice(0, 3).forEach((s, k) => G().draw(R.BattleFX.get('icon_' + s), x + WIN.w - 16 - k * 9, y + 33)); // 8×8, right side of Lv row
    if (picked && Math.floor(R.Engine.frame / 10) % 3 !== 2) upArrow(x + WIN.w / 2, y + WIN.h + 1);
  });
}
```
Other code that assumes this geometry (update all of it together):
`rectOf(u)` for party units (:126–129, used by every fx, popup and projectile origin); party popups at `r.y + r.h + 2 + same*9` (:142);
the monster popup floor `Math.max(52, …)` (:142) and the enemy cursor floor `Math.max(52, v.y − 9)` (:735), where **52 = WIN.y + WIN.h + 2**;
`FX.breath` sprays toward `y 10..60` with a glow at `0,0,256,70` (fx:652, :662); `FX.earth` top `-10` for party targets (fx:549);
`FX.thunder`/`holy`/`revive`/`water` hit the window bottom `r.y + r.h` for party targets.
Font: `R.Gfx.FS = 10.667`, so a 5-char kana name ≈ 53 px, and on the border it needs `tw = ceil(53.3)+8 = 62` px.

**Chronicle proposal (4 × name/HP/MP/WP):** `WIN = {xs:[3,66,129,192], y:4, w:61, h:48}` (4×61 + 3×2 gaps = 250). Name on the border
with `fitText(name, …, 52)` (the helper already exists at :69 and squashes horizontally), then rows `H`/`M`/`W` at `y+8/+19/+30`, with numbers right-aligned at
`x+w−8` (the "999" half-width ≈ 16 px fits). Drop `Lv` from the window (it only drives HP/MP/WP, so it can live on the つよさ screen). Move status icons
to the bottom border (`y+h−6`, up to 5 icons centred) or show them left of the numbers. Add a row marker (e.g. `前`/`中` 8 px tag, or indent mid-row windows
by +4 px y). Add the glimmer glow as a third `winFx` field (`glow`) with a white or gold theme. Then change the `52`s to `WIN.y+WIN.h+2`.
Screenshot it with `tools/shot.js` using the longest names and the 3-digit values `999/999/999`.

---------------------------------------------------------------------------------------------------
## 15. Monster placement and sprite drawing

`monImg(m)` :101 = `R.Gfx.variant('mon:'+d.sprite, {hue,sat,bri})`. An array uses **frame 0 only** (no idle animation).
`layout()` :107 builds one centred row: `gap = min(8, (244 − Σwidths)/(n−1))`, so **it can go negative (overlap)**: 8×32 px → −1.7,
8×48 → −20, 4×64 → −4. Feet sit at `GROUND = 130`, and sprites taller than 64 sink up to 14 px (`(h−64)/3`) so 96–128 px bosses fit.
Per-sprite state in `this.vis` (Map by unit): `flash shake blink lunge dodge appear die flee gone fly i`. These tick by `spd` in `tick()` :613.
`drawMonsters()` :665 handles fly bob (±2 px), shake, attack lunge (5 px dip), dodge (10 px sidestep), appear fade, flee slide + fade,
tinted flash (hit 0.9 / acting blink 0.55 / targeted pulse 0.18–0.36), and rare sparkles. The backdrop is `bbg:<id>` 256×144 (an animated array
at 16f per frame) or `R.BattleFX.fallbackBg(id)` (gradient, ids in `BBG_COL`, fx:322). The draw order is: backdrop → monsters → fx 'mid' → enemy cursor →
monster popups → windows → fx 'top' → party popups → panel|msg → auto badge.
Chronicle, when monsters exceed the width: either cap the group widths in encounter data, or add a two-row layout (back row at feet −10 px, drawn first).

## 16. Damage popups

`pop(u, n|null, color)` :139 creates a string of 7×9 bitmap glyphs (`GLYPH` 0–9 plus `M I S` for "MISS", fx:240; colours `white green cyan yellow
red purple gray`, fx:255). Each char bounces 7 px, staggered by 1.5 f. Life is 52 f, fading after 40. Stacked popups on the same unit offset by 9 px.
Colours: damage white, crit yellow, poison purple, MP cyan, heal green, miss/HP-cost gray. The glyph set has **no letters for "WP"** or
"閃" (add glyphs if needed).

## 17. Effects and animations (battle_fx.js)

`R.BattleFX.play(scene, id, ctx)` :936 → `resolve(id, ab)` :905 → `FX[kind](scene, ctx, level, variant)` + `R.sfx(SFX[kind])`
(:896). It returns the **number of frames until impact**, which the scene awaits. `ctx = {user:rect, targets:[rect], ab, kind}`.
Instances go into `scene.fxList` with layer `mid` (monster targets) or `top` (party targets, projectiles).
FX ids: `slash pierce strike claw bite · fire ice thunder wind earth water holy dark · explosion breath (variants fire/ice/poison/dark)
drain gravity death · heal mp cure revive regen buff debuff dispel · sleep poison paralyze confuse silence blind · steal scan
smoke song grow magic warp · cast` (the party caster sparkle, auto-played for `ab.magic`). A trailing digit `1–3` sets the level (e.g. `thunder2`).
Resolution order: exact `FX` key → first `KEYWORDS` substring match (:877) → derived from effects (breath → breath, drain → drain,
percent → gravity, element → element fx, fixed → explosion, magic → magic, phys → slash; non-damage by type) → `strike`.
`travel()` :415 fires a projectile from the caster's window to the monster (fire/ice only). Default monster attack fx per base sprite is
`MON_ATTACK_FX` (battle.js:56, or `d.attackFx`). Party weapon fx is `item.fx || WEAPON_FX[wtype]` (battle.js:63). The chronicle
weapon types `greatsword club whip fist` are missing there and fall back to `slash`.
Other exports: `glyphs dissolve (12-frame breakup cached on the canvas) fallbackBg ring get FX SFX icons`.

## 18. Boss and rare entrances

`intro()` :218: two white flashes over the field, then a 16-stripe wipe (22 f, `drawWipe`), then the scene turns opaque and fades in 14 f. **Boss**
(`eng.boss`) → `sfx roar` + `shake(24,2)` + 20 f. **Rare** → two `#ffe890` flashes, the rare jingle and line (see §12). `rareGlow` is set but
never read. Boss death (`onDie` :363): `boss_die`, 70 f of white/red/normal flicker with random fire bursts + shake every 9 f,
then dissolve (4 f per frame), 116 f total, then a white flash. A normal death is a 6 f white tint + a 2 f/frame dissolve.

---------------------------------------------------------------------------------------------------
## 19. Tests and fixtures (reference only — copy into chronicle/tools)

* `tools/test_battle.js` (905 lines) loads `tools/lib/load` plus `fixtures/battle/data.js` (it evaluates `window.RPG`). Sections: phys, metal,
  magic, heal, revive/cure/status, turn statuses, buff/dispel/steal/scan/escape/grow/special, targets, multi-hit/drain/hpCost/mp,
  reactions, supports (dual wield, regen, startBuffs, mpCostPct, onHit), monster AI, rounds/order/defend, escape/surprise, rewards,
  live bestiary/state, party AI, simulate, and "real content" (every non-`tb_` item, ability, monster, troop and zone in `src/data` must not throw).
  Helpers: `mk(o)` (Engine with fixture party, `noSurprise`), `run(gen)`, `said(evs, re)`, `use(e,u,id,target,item)`.
* `fixtures/battle/data.js`: `tb_*` abilities (every effect, target, reaction and support), jobs `tb_fighter/tb_caster/tb_adept`,
  items, monsters (`tb_slime goblin wolf bone metal mage drake boss thief dummy brute`), troop `tb_boss`, zone `tb_zone`,
  `R.fxBattleChar(id, job, lv, learned, equip, set)` and `R.fxBattleParty(lv)` (**3 members yuki/non/metem**; it reads
  `DB.chars[id].name`, and `Rules.baseStat` reads `DB.chars[id].growth`).
* `fixtures/battle/art_stub.js`: stand-in `mon:*` / `bbg:grass|castle|cave` (never overrides). `make_harness.js`: writes
  debug.html + fixtures + `RPG.fxBattle(opts, lv)`, `RPG.fxPlay(fx, side, userIdx, targetIdxs, abId)`, `RPG.fxEvents(fn)`.
  `gallery.js`: a Playwright frame-stepper (`Engine.paused/step/render`, `Input._set`) that builds contact sheets from a JSON script.
* Porting the tests: the fixtures need 4 party chars, no jobs (or a stub), WP and rows. These assertions hard-code 3 members:
  test_battle.js:328 (`=== 3` protect lines), :408, :413 (allies length 3), :619/:682 (3 defend cmds), :635–638 (3 cmds, `actors.length === 5`),
  :833 (`deaths === 3`). JP and job assertions: :716, :719–721, :731. The dual-wield section :519–547 must be deleted or rewritten.

---------------------------------------------------------------------------------------------------
## 20. Hard-coded checklist

| assumption | where | effect with the Chronicle spec |
|---|---|---|
| 3 status windows | scene:16 `WIN.xs`, :754 `drawWindows`, :126 `rectOf` | 4th member invisible, its fx/popups at NaN |
| 3-member ally cursor | scene:586 `% 3` | cannot select the 4th member |
| formation = index weights 5/3/2 | ai:38 | 4th gets weight 1; no rows |
| 52 px = bottom of the windows | scene:142, :735 | cursor/popup under taller windows |
| window band y 10–70 | fx:652/:662 (breath), :549 (earth) | breath misses moved windows |
| fixture party 3, `yuki/non/metem` | fixtures data.js:173 | tests |
| job command + sub command | rules:204 `commands`, scene:442/:464/:473 (`k.type==='job'`, `m.ab[k.job]`) | no jobs |
| actions by job | ai:91 `[c.job, c.set.sub]`, rules:197 `actionList` | techs/spells lists instead |
| reaction slot | battle:942 (`c.set.reaction`, `Rules.learned` by job record) | remove or re-source |
| JP & job levels | battle:1055–1070 (jp), :1089–1092, :1109–1116, monster `d.jp` | remove |
| job stat multipliers / innate / equip rules | rules:341, :358, :236 | removed by the rules owner; battle only sees `stats()` |
| 5 equip slots, off hand in shield slot = dual wield | rules:15, :389; battle:28/:470/:474–487/:1038 | 9 slots; weapon2 ≠ dual wield |
| LEVEL_STATS str..luk | battle:53, :1105 | stats fixed; only HP/MP/WP grow |
| luk | rules:395 (crit), battle:138, :916 (steal) | no 運 in Chronicle (use 器用さ) |
| 8 elements, `holy:'聖'` | battle:30, fx:895 `ELEM_FX` | 6 elements 火水風土光闇, composites |
| 2-tier drops (drop/rare) | battle:1061–1062, bestiary kinds `drop rare steal stealRare scan` | 3 tiers + super-rare |
| party mod sums | battle:208 `partyMod` | ×4/3 with 4 members |

---------------------------------------------------------------------------------------------------
## 21. What must change for ルミナス・クロニクル (by feature, with the hook)

1. **4 members.** Fix the §20 rows 1–4. Engine logic is otherwise N-member safe (arrays by `idx`, `forEach`). Check `partyMod` sums
   and the auto AI thresholds (`many ≥ 2` in tryHeal ai:135).
2. **Rows 前列/中列.** Add `PartyUnit.row` from the character or formation data (not job). In `roll()` phys branch (battle.js:534) multiply
   damage **taken** by mid-row party units (e.g. ×0.7, a data constant). Reach: `unusable(u,id)` should return `'reach'` when `u.row==='mid'` and the
   used weapon is melee (sword, greatsword, dagger, axe, club, katana, fist). Spear, bow and whip reach, and spells always reach. The scene
   `memberMenu` should disable 戦う the same way, and `abilityHelp` should say e.g. 「中列からは届かない。」. The AI `offense()` uses plain attack as its baseline (ai:194), so
   it needs a `defend` fallback. Replace `pickPartyTarget` with row weights ("前列ほど狙われやすい"). It is also used by `pickFoe`
   (battle.js:465). The windows need a row marker.
3. **No jobs → techs (技, WP) and spells (術, MP).** Replace `Rules.commands(c)` with e.g. `[{type:'attack', slot:'weapon'}, {type:'tech',
   slot:'weapon'}, {type:'tech', slot:'weapon2'}, {type:'spell'}, {type:'defend'}, {type:'item'}]` (still ≤6 → the 2×3 list fits).
   In the scene, dispatch on the new `k.type` (:460–470) and keep cursor memory per list key instead of per job. Add `wp/mwp` getters on
   `PartyUnit` (to `c.wp`, `st.wp`), `Engine.wpCost`, `unusable → 'wp'`, and payment in `useAbility` (:733). The List `right` column should show
   the cost with its resource (colour or `W`/`M` suffix). `battle_ai.abilityOptions` should list techs of the equipped weapon types plus known spells, and
   use a combined cost in the scoring (`o.cost`). `announce` already distinguishes 唱えた (`magic:true`) vs の○○！. Keep `magic:true`
   on spells so silence works.
4. **Glimmer 閃き.** Hook it in `Engine.execute` (battle.js:373) for party units before `attack`/`ability`. Call `R.Glimmer.roll(eng, u, cmd)`
   (glimmer owner), which returns a new id or null, using the target (`cmd.target`, which may be null for all-target) for "強い敵ほど". On success:
   mutate `u.c` (the simulate clones are safe), yield `{t:'glimmer', u, id}` + the message, then run the new tech in place of the chosen action
   (RS2 style) through `useAbility`. Counters call `attack()` directly (battle.js:988), so decide whether they can glimmer. Scene: new
   `handle` case → `R.sfx('glimmer')` (new SFX id for the audio owner), `winFx[idx].glow`, and a big centred name banner (a new draw step
   after the windows; `G().text(…, {size})` supports larger sizes). `simulate()` should count glimmers in its result for the balance sims.
5. **Proficiency (熟練度).** Count uses per weapon type and element in `execute`/`useAbility` (engine side), and apply them in `finish()` or
   `rewards()` so `simulate` sees them.
6. **9 slots.** `weaponFx` (battle.js:222) and `st.element/onHit` should follow the weapon used by the command (`cmd.slot`). Remove
   `dualWield`/`OFFHAND_MULT`/`atk2` (battle.js:470–487, :1038; the rules owner removes `atk2`). A tech should roll with the atk of its own slot (pass
   `ctx.atk` to `roll` as `attack()` already does). Add the new wtypes to `WEAPON_FX`.
7. **Stats & formulas.** Map the 6 stats (腕力 str, 体力 vit, 器用さ dex, 素早さ agi, 知力 int, 精神 mnd). Replace `luk` in crit (rules:395), steal
   (battle.js:916) and the monster default (:138) with `dex`. "知力が術に効く" means retuning the magic formula `power + mag×scale` (battle.js:565).
   The scale is per ability, so a stronger global INT curve belongs there. Rename `NAMES.stat`.
8. **Elements.** Use 6 elements (`fire water wind earth light dark`: decide whether to keep the id `holy`). Allow `element: ['fire','wind']` in
   `roll`/`elemFactor` (choose product or max) for composite spells. Add status effects such as `freeze` through the §7 tables. Update
   `NAMES.elem`, `ELEM_FX`, and `KEYWORDS`, and add composite fx (e.g. play two kinds).
9. **Rewards.** Remove JP/job lines. Level-up lines show only 最大HP/MP/WP (`LEVEL_STATS`). Apply EXP reduction per member vs monster level inside
   `computeRewards` (loop killed × members, not a single sum). **Bench members** get 60 % EXP: they are not engine units, so pass
   `o.bench` (chars) into the Engine and apply in `rewards()` with no messages, or with one line. The optional "survivors full HP after battle" goes in `finish()`.
10. **3-tier drops, golden and rare monsters.** Add a third roll (`srare`) in `computeRewards` (:1058) with `{t:'gain', item, tier}` plus a new
    `srare` event, jingle and flash (a new jingle id for the audio owner). Add the bestiary kind `srare` via `R.State.noteDrop`. Golden variants: in `start()`, replace one monster
    with probability p. Either give it a `golden` flag, a `金色の` name and a rare-rate multiplier in `computeRewards`, or make it a data variant. Draw it with
    `Gfx.variant` + sparkles (reuse `drawSparkles`). Rare monsters (20+) keep using `DB.rareEncounters[zone]` and `appear`.
11. **Tier scaling.** Resolve the tier in `buildMons` (e.g. `DB.encounters[zone].tiers[R.Game.tier]` or family tables) or in the `MonUnit`
    constructor (`this.d = R.Tier.monster(id, R.Game.tier)`; keep `this.id` = the bestiary key). Only `MonUnit`, `buildMons`, `start()` (rare check)
    and `rewards()` :1126 (`DB.monsters[d.mon].name`) read `DB.monsters` directly, so a derived `d` in the constructor covers the stats.
12. **Messages & names.** 「〜たちは全滅した……」 uses `party[0]` = the hero (OK). All strings are inline, so follow the Chronicle STYLE guide (e.g. 魔法 → 術
    wording: 「しかし術は封じられている！」, 「〜は術を封じられた！」).

## 22. Gotchas and latent bugs found

* **fx keyword substrings misfire** (checked in node): `jump`/`stomp` → `mp` sparkles (`'mp'` precedes `'jump'` in `KEYWORDS`), `slice`/`dice` → `ice`,
  `uppercut` → `buff`, `sparkle` → `thunder`, `holy_water` → `water`. The second `['dark','blind']` entry is unreachable. **Use exact FX ids in data**
  (e.g. `fx:'pierce'`), or reorder and word-bound the keywords.
* `menu.js:221` calls `R.Battle.healAmount(user, target, eff, {item, field})`, which **does not exist**, so the field menu uses its own copy of
  the formula. Export a `B.healAmount` from the `heal` branch (battle.js:785) to keep field and battle healing identical.
* `R.jingle('victory')`, `levelup` and `rare` (in the `rare` event) are fire-and-forget. Only the rare **intro** jingle is awaited.
* The `gain` sfx is `steal` for normal drops (scene:315). `scene.rareGlow` is dead. `o.canLose` is ignored by the scene.
* `PartyUnit` wipes all non-poison statuses at construction, and `finish()` again after the battle. `status` lives on the char object.
* Initiative is rolled once per round, so a speed buff applies from the next round.
* Monster `every:[n,k]` counts `u.acts`, which increases per action (including multi-act turns), not per round.
* `drawEnemyList` shows at most 4 groups. The encounter rule is ≤3 species.
* A new effect type must be added to `BATTLE_EFFECT` (:1142), or every ability using only that type becomes 「戦闘中は使えない。」.
* Balance tools depend on `R.Battle.simulate` and its result fields (`result rounds partyHpPct partyMpPct deaths damageDealt damageTaken
  killed mons exp gold jp party inv log`). Keep them stable (add `wp`, `glimmers`, `srare`).
