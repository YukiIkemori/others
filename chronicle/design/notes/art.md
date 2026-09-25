# Porting note: art authoring (Crest → Chronicle)

Scope: `src/core/gfx.js` and every file in `src/art/` (monsters, bosses, rare, post-game, characters/NPCs,
objects/icons, world + local tiles, themes, decor, battle backdrops), plus the `tools/sheet_*.js` contact-sheet
tools. The fork is **byte-identical** to `/tmp/claude-0/ref/rpg` for `src/art/`, `src/core/gfx.js` and all
`tools/sheet_*.js` (checked with `diff -rq`). All `file:line` anchors point at the fork (`chronicle/...`).
Everything below was read in the source or run in this container (see §11 for the tool runs).

---------------------------------------------------------------------------------------------------
## 0. TL;DR: what must change

| # | What | Where | Why / what to do |
|---|---|---|---|
| 1 | Party sprites are **per job**: key `party:<char>:<job>`, 3 chars × 19 jobs = 57 keys | `chars.js:213-291` (`JOB_IDS`, `CHAR_IDS=['yuki','non','metem']`, `DEFAULT_OUTFIT`, `outfitOf`, `partySheet`, `defParty`, onBoot over `DB.jobs`), `chars_parts.js:1413-1467` (`P.party`, `P.jobs`) | There are no jobs. Give each character its own `style` (body/hat/cape/colour hooks) and `outfit {main,sub,trim}`, and register `party:<id>`. §7.4 has a tested recipe. |
| 2 | Code that reads party keys | `field.js:580`, `menu.js:44-60` (its fallback also reads `DB.jobs[..].outfit`), `nameentry.js:155,274`, `ending.js:88`, `postgame_scene.js:263`, `menu_jobs.js` (whole file) | Switch them all to one helper, e.g. `R.Art.partyKey(c)` → `'party:' + c.id` (the hero: `hero_m` / `hero_f`, plus a type suffix if the hero's look depends on the chosen type). |
| 3 | Only 3 party heads/hairs exist (`hairYuki/Non/Metem`, 3 faces) | `chars_parts.js:45-208` | 1 hero (m/f) + 20 companions must be easy to tell apart at 16×24. Add about 10 hair parts and 2–3 faces. Right now any two NPC-style companions look like townsfolk. |
| 4 | NPC key registration uses a **fixed list** | `chars.js:301-304` `CA.NPC_TYPES` | A new `CA.npcs.<type>` does **not** register `npc:<type>` by itself. Add the type to the list or call `R.Gfx.def('npc:<type>', …)` yourself (§7.5). |
| 5 | Icons cover Crest weapon/armour types only | `objects.js:247-449` (20 icons), `menu.js:66-80` `iconKey` | Chronicle has 11 weapon families and 9 slots. Missing: `greatsword club whip glove boots` (maybe `fist`), and 6 element icons (火水風土光闇) for 術の書. `iconKey` needs `hand`/`feet` cases. |
| 6 | There is **no** parts-overlay or gold-variant system | — | Only `hue/sat/bri/pal` recolours exist (`gfx.js:215`). The brief wants lineages (3–5 stages), part swaps, and a 金色 version of every lineage. §5 has a tested `compose()` / `goldify()`. |
| 7 | The battle ignores `pal` | `battle_scene.js:103` passes only `{hue,sat,bri}`; ずかん passes `pal` too (`menu_status.js:59`) | Pass `pal` in the battle as well, or never use `pal` in monster data. |
| 8 | Roster counts vs targets | §3.3 | Regular bases **38**, rare designs **6**, bosses **12**. Targets: about 45–50 lineages, rare ≥ 22 (**16+ new**), bosses 24–28 (**12–16 new**). |
| 9 | World-tile cache key breaks with ≥ 10 ground classes | `tiles_world.js:702` `c9.join('')` | Class ids 10+ make signatures ambiguous (`1,0` vs `10`). Change to `c9.join(',')` **before** adding a class (RS1 roads, rivers, cliffs). |
| 10 | New themes silently render as `generic` | `tiles_auto.js:319`, `tiles_local.js:1069` (theme must be in `A.THEME_DEFS` = `TH`, `tiles_theme.js:14-28,360`) | Adding a theme only to `R.DB.themes` gives generic art. Add a `TH` row (§9.3). |
| 11 | Contact-sheet tools hard-code Crest | 3 status windows `[6,88,170]` w80 h44: `sheet_bosses.js:130`, `sheet_rare.js:147`, `sheet_postgame.js:137`, `sheet_tiles.js:165`. Id lists: `sheet_monsters_a.js:27-28`, `sheet_monsters_b.js:29-30`, `sheet_bosses.js:31`, `sheet_rare.js:33`. `sheet_chars.js:30,215` (`yuki,non,metem`, `JOB_IDS`), `sheet_postgame.js:277` | Update them to the 4-window battle layout and Chronicle ids. `sheet_chars` breaks as soon as `JOB_IDS` is removed. |
| 12 | Missing fixtures | `sheet_tiles.js:182` loads `tools/fixtures/tiles/samples.js` (not copied) | Copy it from `/tmp/claude-0/ref/rpg/tools/fixtures/tiles/`. Also worth copying: `fixtures/monsters/sheet.js` (roster/zone sheets from real `DB.monsters`, `--try` palette candidates) and `fixtures/chars/check_parts.js` (part-grid linter). |
| 13 | Crest-only art | `obj:crest_glow`, `obj:ship` (`objects.js:163-230`); world `barrier` tile and `loc_pyramid`/`loc_demon`; bbg `demon`/`throne`/`pyramid`; `ending.js:27-39` bbg per yuki/non/metem | Reuse these where they fit (crest_glow → 伝承の断片 on a pedestal) or drop them. Keep the keys until nothing references them. |

---------------------------------------------------------------------------------------------------
## 1. Modules, load order, registry

```
src/core/gfx.js      R.Gfx: registry (def/get/variant), Pix buffer, colour helpers, text/windows
src/art/tiles.js     R.Art.TK: Int32 Buf + noise + master palette PAL  (tiles, themes, decor, backdrops use it)
src/art/monsters_a.js R.Art.MonTK: mask/bevel shading toolkit (exported)       + 18 mon: sprites
src/art/monsters_b.js private Scene (z-buffer) toolkit (NOT exported)          + 18 mon: sprites
src/art/bosses.js / rare_monsters.js / postgame.js   each carries its own private copy of the helpers
src/art/chars*.js    R.Art.Chars (CA): ASCII-layer figure engine, parts library, NPC table
src/art/objects.js   obj:* and icon:*
src/art/tiles_world.js / tiles_auto.js / tiles_local.js / tiles_theme.js   tile:*, R.Art.worldTile/localTile
src/art/decor*.js    decor:*, R.Art.decorAuto / decorTile
src/art/battlebg.js  bbg:*
```
* **Load order is `localeCompare` over full paths** (`tools/build.js:23-40`, `tools/lib/load.js:15-30`, and the
  sheet tools' `sources()` use the same sort). Underscore files sort **before** the base name:
  `chars_npc < chars_parts < chars`, `tiles_auto < … < tiles_world < tiles`, `decor_exterior < decor_interior < decor`,
  and `mon_*.js < monsters_a.js`. So **`R.Art.TK` and `R.Art.MonTK` must only be looked up inside factories**,
  never at load time (every existing file uses `const tk = () => A.TK`). Namespaces are created defensively
  (`R.Art = R.Art || {}`, `CA.parts = CA.parts || {}`) for the same reason.
* `R.Gfx.def(key, factory)` only stores the factory (`gfx.js:196`, and it drops any cached value, so re-def is safe).
  `get(key)` builds on first use and caches (`:198`). If the key is missing you get a 16×16 magenta placeholder
  plus one `R.warn`; if the factory throws you get the placeholder plus `console.error` (`:202-207`).
  **The placeholder is 16×16 even for `mon:`**, so a typo shows up as a tiny square in battle.
* Registered keys right now (counted in node): 679 = `tile` 381, `decor` 58, `party` 57, `mon` 56, `bfx` 53
  (battle_fx, not in this note), `npc` 30, `icon` 20, `bbg` 19, `obj` 5.
* Node (`require('./tools/lib/load')()`) can **register** art but cannot **build** it (factories need `document`).
  Pixel checks need Playwright (§11).
* **Boot hooks do not run in the sheet tools.** Keys registered in `R.onBoot` (`chars.js:291` extra jobs,
  `tiles_local.js:1058` neutral fallback for unknown tile ids, `:1087` exterior tiler) are missing from contact
  sheets. Register art keys at load time.

---------------------------------------------------------------------------------------------------
## 2. `src/core/gfx.js`: the parts art code uses

| API | Line | Notes / gotchas |
|---|---|---|
| `def / has / get` | 196-210 | See §1. `has()` is only "registered", not "built". |
| `variant(key,{hue,sat,bri,pal})` | 215-225 | Cached under `key|JSON(opts)`. `pal` (exact-RGB swap via `recolor`) runs first, then `hsvShift`. **If the base is an array, only frame 0 is used.** All-undefined opts return the base. |
| `hsvShift(cv,deg,sat,bri)` | 227-240 | Hue rotates **every** pixel. Saturation is multiplied only when s > 0.12, so near-grey outlines and eye whites keep their saturation. `bri` multiplies everything, including the outline. |
| `recolor(cv,{'#from':'#to'})` / `mapColors(cv,fn)` / `flipH` | 268-302 | Work on canvases. `mapColors` is the hook for gold/metal/petrify looks (§5). |
| `shade(hex,amt)` `ramp(hex,n,spread)` `mix(a,b,t)` `hexToRgb` `rgbToHex` | 304-319 | These are the generic RGB-lerp ramps. The sprite files use their own **hue-shifted** ramps instead (shadows → violet, lights → warm). |
| `fromGrid(rows,pal)` / `pix(w,h)` | 259-266 | In `grid`, `.` and space are transparent unless they are in `pal`. **Unknown chars are skipped silently** (`:413-415`), so a typo just disappears. |
| **Pix** `set get rect hline vline ellipse circle shadeEllipse line poly grid mirrorX outline replace each blit toCanvas` | 341-474 | Colours are `'#rrggbb'`, or `'#rrggbbaa'` for alpha (only `toCanvas` honours alpha). `null` = transparent. Everything clips. `outline(c,{diag})` adds a 1-px ring outside opaque pixels (4-neighbour by default). `mirrorX` copies the left half onto the right. `each(fn)` returns a new colour, or `null` to erase. There is no canvas→Pix converter (§5 adds `toPix`). |

---------------------------------------------------------------------------------------------------
## 3. Monster art

### 3.1 Two authoring toolkits
**A: mask + bevel ("pillow") shading.** `monsters_a.js`, exported as `R.Art.MonTK` (`:1369`). This is the only
monster toolkit other files can reuse.
* Masks: `mask(w,h)`, `capsule(p,x0,y0,x1,y1,r0,r1,c)` `:63`, `tube(p,[a,ctrl,b],r0,r1,c)` (quadratic bezier) `:76`,
  `arc(...)` `:91`. Plus the Pix primitives (`ellipse`, `poly`, `rect`).
* `ramp(base,n,{dark,light,shift,mid})` `:39`: hue-shifted n-step ramp around a mid tone.
* `shade(mask, ramp, {depth, light:[x,y,z], amb, bias, global, normal:sphereN(cx,cy,rx,ry), blend, trans, rim})`
  `:206`: bevel height from the distance field, smoothed, then lit. `part(w,h,fn,ramp,o)` `:213` builds and shades in one call.
* `put(dst, src, line)` `:218`: layers `src` over `dst`. `line='dark'` (or a colour) draws the inner contour where `src`'s
  edge crosses pixels already in `dst`. That contour is what makes parts read as separate SFC forms.
  `clip(p,mask)`, `bump(p,ramp,fn)` (shift ramp steps: glow, crease), `stamp(p,x,y,rows,pal)` (hand-drawn eyes/teeth).
* `finish(p,{center,float,post})` `:251`: fits the sprite inside a 1-px margin, puts the lowest pixel on row H−2
  (unless `float`), adds the `OUT` outline, then `post(q)` paints un-outlined extras (sparkles, bubbles).
* Colours: `OUT '#120c16'`, `INK '#1c1420'`, `WHITE '#f8f8f4'`. They are near-neutral so hue variants keep them.

**B: 2.5-D z-buffer Scene.** `monsters_b.js:131-376`, **private** (the export at `:1524` has only ids/sizes).
* `mat(base,{n,dark,light,shift,bias,contrast,spec,dith,tex,rim,line,flat,glow})` `:101` is a material.
  Textures: `texScales texFur texStone` `:76-91`.
* `new Scene(w,h)`, then `.ell(cx,cy,rx,ry,{m,g,z,rz,k})` `.cap(...)` `.tube([[x,y,r,z],...],o)` (Catmull-Rom)
  `.shape(maskPix,{bevel,n,slope})` `.poly(pts,o)` `.region(fn,m,g)` `.mark(x,y,d)` `.carve(pts,d)` `.cut(fn)`, then
  `.render({depth,ground,bias})` → Pix. Parts in one group `g` blend smoothly. Different groups get a contour on the
  part behind (or a darker step if `soft`).
* After rendering: `stamp/stampM` (mirrored), `shadeLine`, `finish(p, post)` `:419` (outline + `shave`), and the
  emissive helpers `flame`/`paintFlame`.
* To reuse B from another file, the monsters_b owner should export
  `A.MonScene = {Scene, mat, ramp, mix, darken, stamp, stampM, shadeLine, finish, flame, paintFlame, texScales, texFur, texStone, sym, OUT, INK, WHITE}`.

**Bosses / rare / post-game** (`bosses.js`, `rare_monsters.js`, `postgame.js`) each carry private copies of
the A- or B-style helpers with their own `OUT`. Bosses add `edt` (exact distance transform), `glow`, `cracks`,
`scales`, `edgeLight`, and shared ramps `GOLD STEEL EYE_RED FIRE` (`bosses.js:387-390`). Post-game adds an
iridescent "abyss" material. Outline colours: A `#120c16`, B `#140e18`, bosses `#0c0810`, rare `#100a14`,
post-game `#08060e`.

### 3.2 Contract for any `mon:` sprite (from the code that draws them)
* Front view, drawn centred, **feet on the bottom row**: lowest body pixel on row H−2, outline on H−1.
  `battle_scene.js:106-122`: sprites are laid out left to right with total width ≤ 244 px (gap = min(8, …)), so
  more than 3–4 large 64-px sprites overlap. Feet sit at `GROUND=130` (`:18`). Sprites taller than 64 px sink
  `min(14, (h−64)/3)` px. Flyers (`flag 'flying'`) bob ±2 px.
* Big bosses already reach the party-window band. For example a 96-tall boss has its top at y≈44, while Crest windows
  are y 6–50. **A taller 4-window layout will overlap more**: keep boss heads readable, or have the battle owner
  move the windows.
* **Opaque pixels only** (`sheet_rare --only check` fails on semi-transparency). Keep a near-black outline so
  `hsvShift` leaves it alone. Base sprites must look good in their default palette **and** hue-shifted (the variant
  sheets check this).
* The ずかん (`menu_status.js:63-73`) halves the size until it fits the panel. Field NPCs with `sprite:'mon:x'`
  draw the canvas as-is with no variant (`field.js:570`). **A recoloured visible boss therefore needs its own key.**

### 3.3 Base-sprite roster (id → canvas size, file:line of the factory)
* Small 32×32 (`monsters_a.js`): `jelly :280` `bat :319` `rat :369` `mushroom :418` `bee :458` `wisp :509`
  `imp :540` `mimic :594` `eyeball :643`
* Medium 48×48 (`monsters_a.js`): `goblin :693` `snake :774` `wolf :845` `plant :938` `skeleton :1007`
  `lizardman :1087` `scorpion :1166` `ghost :1236` `mummy :1288`
* Medium 48×48 (`monsters_b.js`): `crab :467` `merman :608` `harpy :668` `darkmage :728` `armor :777`
  `gargoyle :841` `salamander :900` `cactus :951` `frostling :997`
* Large 64×64 (`monsters_b.js`): `orc :536` `golem :1048` `wyvern :1096` `chimera :1153` `yeti :1227`
  `kraken :1272` `demon :1317` `sandworm :1389` `minotaur :1456`
* Post-game regulars (`postgame.js`): `void_wraith 48 :789`, `chaos_beast 64 :889`
* Rare (`rare_monsters.js`): `rare_hare 48 :475` `rare_lizard 48 :589` `rare_bird 48 :708` `rare_whale 64 :771`
  `rare_idol 48 :839`. In `postgame.js`: `rare_prism 48 :703`
* Bosses (`bosses.js`): `boss_goblin_chief 64×64 :398` `boss_bandit 64×64 :580` `boss_serpent 96×80 :739`
  `boss_sphinx 96×80 :902` `boss_frost_giant 96×96 :1086` `boss_flame_lord 96×96 :1259`
  `boss_star_guardian 96×96 :1427` `boss_general_a 96×96 :1575` `boss_general_b 96×96 :1717`
  `boss_demon_king 112×96 :1886` `boss_demon_king2 128×112 :2085`. In `postgame.js`: `boss_abyss 128×112 :437`.
* Crest's data (`/tmp/claude-0/ref/rpg/src/data/monsters.js:16-24`) keeps a separate `SIZE` table (s/m/l) that
  scales stats. Chronicle's data needs one for any new base. Crest also makes its metal/gold jellies with plain hue
  data (`hue:70,sat:0.25,bri:0.8` / `hue:-100,sat:1.3,bri:1.15`). That only works per base, which is why §5 adds `goldify`.

### 3.4 Adding a new monster base sprite (tested in a scratch copy)
Put new bases in a **new file** (e.g. `src/art/monsters_c.js`, which loads after a/b) rather than growing a/b:
```js
(function (R) {
  'use strict';
  const S = {};
  S.treant = () => {                                   // 48x48 medium
    const T = R.Art.MonTK, W = 48, H = 48;              // look the toolkit up lazily
    const bark = T.ramp('#7a5a3a', 6, { dark: 0.7 }), leaf = T.ramp('#4a9a3a', 5);
    const p = R.Gfx.pix(W, H);
    const trunk = T.mask(W, H); T.capsule(trunk, 24, 44, 24, 18, 7, 5, 1);
    T.put(p, T.shade(trunk, bark, { depth: 4, rim: 1 }));                      // back to front
    T.put(p, T.part(W, H, (m) => m.ellipse(24, 14, 14, 10, 1), leaf,
      { depth: 5, normal: T.sphereN(22, 12, 15, 11), blend: 0.4 }), 'dark');   // inner contour
    T.stamp(p, 19, 28, ['kk..kk', 'kw..wk'], { k: T.INK, w: T.WHITE });        // hand details
    return T.finish(p);                                // feet on row H-2 + outline
  };
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  (R.Art = R.Art || {}).monstersC = { ids: Object.keys(S), sizes: { treant: 48 } };
})(window.RPG);
```
Checklist: the size is 32/48/64 (bosses free up to 128×112). Sprite looks right at 1× on `bbg:grass` and `bbg:cave`.
Check hue +110/−120 and a desaturated variant (`node tools/sheet_monsters_a.js --only zoom --ids treant`, then add
the id to the tool's lists for variant rows). Colour count stays around 25–60 (see the `check` output). Add the base
to the data `SIZE` table. Build time is 2–40 ms per sprite; everything is lazy and cached.

---------------------------------------------------------------------------------------------------
## 4. Palette variants (what exists)
* Data fields `hue` (deg), `sat` (mult), `bri` (mult), `pal` ({'#from':'#to'}) → `R.Gfx.variant('mon:'+sprite, …)`.
  The battle ignores `pal` (§0 #7).
* Good hue ranges come from Crest: ±60–180 hue, sat 0.25–3, bri 0.5–1.25. Low sat plus lower bri gives metal/stone.
  Very high sat (2–3) plus low bri gives dark "elite" versions.
* Lineage rule of thumb for Chronicle: stage 1 is the default palette, stages 2–3 are hue/sat/bri steps (vary by
  region/element), and stages 4–5 add a parts overlay (§5) plus a stronger palette. Every lineage also gets `@gold`.

---------------------------------------------------------------------------------------------------
## 5. Parts-overlay and gold variants (new, prototype tested)
Nothing like this exists yet. Below is a verified recipe (horns on `goblin`, crown on `jelly`, gold `wolf`/`jelly`
rendered correctly in a scratch copy). Suggested file: `src/art/mon_variants.js`. It loads *before* monsters_a,
so everything is looked up lazily.
```js
const G = () => R.Gfx, TK = () => R.Art.MonTK;
function toPix(cv) {                                   // canvas → Pix (opaque only; alpha < 128 dropped)
  const p = G().pix(cv.width, cv.height), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 0; i < p.d.length; i++) if (d[i * 4 + 3] > 127) p.d[i] = G().rgbToHex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  return p;
}
function stripOutline(p) {                             // remove the outer 1-px ring, return its colour
  const lum = (h) => { const [r, g, b] = G().hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const s = p.d.slice(), w = p.w, h = p.h, cnt = {};
  const empty = (x, y) => x < 0 || y < 0 || x >= w || y >= h || s[y * w + x] == null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = s[y * w + x];
    if (c == null || lum(c) > 0.1) continue;
    if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) { p.d[y * w + x] = null; cnt[c] = (cnt[c] || 0) + 1; }
  }
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || '#120c16';
}
/** layers: [{draw(ov, T), behind?}] — each draws into a Pix the size of the base */
function compose(baseCv, layers) {
  const T = TK(), p = toPix(baseCv), out = stripOutline(p);
  for (const L of layers) {
    const ov = G().pix(p.w, p.h); L.draw(ov, T);
    if (L.behind) { const q = G().pix(p.w, p.h); q.blit(ov, 0, 0); T.put(q, p, 'dark'); p.d = q.d; }
    else T.put(p, ov, 'dark');                         // inner contour where the part crosses the body
  }
  p.outline(out);                                      // one clean outline around the new silhouette
  return p.toCanvas();
}
const GOLD = ['#3c1c0c', '#6a3410', '#a2601a', '#d09028', '#f0c040', '#fae078', '#fff8d0'];
function goldify(cv) {                                 // luminance → gold ramp, any base hue
  return G().mapColors(cv, (r, g, b) => {
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (l < 0.09) return [r, g, b];                    // keep outline / ink
    return G().hexToRgb(GOLD[Math.min(GOLD.length - 1, Math.floor(Math.pow(l, 0.8) * GOLD.length))]);
  });
}
const horns = (cx, top, spread) => ({ draw(ov, T) {
  ov.blit(T.part(ov.w, ov.h, (m) => {
    T.tube(m, [[cx - 3, top + 4], [cx - spread, top], [cx - spread - 2, top - 6]], 1.8, 0.5, 1);
    T.tube(m, [[cx + 3, top + 4], [cx + spread, top], [cx + spread + 2, top - 6]], 1.8, 0.5, 1);
  }, T.ramp('#d8c8a0', 5), { depth: 1.5 }), 0, 0);
} });
R.Gfx.def('mon:goblin+horns', () => compose(G().get('mon:goblin'), [horns(22, 6, 7)]));
R.Gfx.def('mon:goblin+horns@hue-60', () => compose(G().variant('mon:goblin', { hue: -60 }), [horns(22, 6, 7)]));
R.Gfx.def('mon:wolf@gold', () => goldify(G().get('mon:wolf')));
```
Rules and gotchas:
* **Keys are ordinary `mon:` ids.** Data uses `sprite:'goblin+horns'` and the battle, ずかん and validators need no
  changes. Use one naming scheme (`<base>+<part>[+<part>]`, `@gold`, `@metal`) and **predefine** every key used by
  data, because a validator checks `R.Gfx.has`. To auto-define `@gold` for every lineage, iterate over an explicit
  base list, or put it in a file that sorts after all `mon` files (e.g. `zz_mon_gold.js`). An `onBoot` hook would be
  missed by the sheet tools.
* `variant()` runs **after** composition, so data `hue` on a composite recolours the crown too. For a gold crown on a
  shifted body, compose on `G().variant(base,{hue})` (as in the second key above) and set no `hue` in data.
* Overlays must stay inside the base canvas (1-px margin for the outline). Small sprites have headroom (jelly
  top ≈ y10), but tall 48/64 sprites touch the top, so put horns and crowns lower or at the sides. Keep a per-base
  anchor table (head top/centre, hand, back) next to the overlay defs. Take anchors from the factory code (e.g.
  goblin head `ellipse(22.5,15,8.8,7.8)` at `monsters_a.js:740`) or from the zoom sheet.
* `goldify` also turns the eyes gold. Re-stamp eyes if needed. For `@metal` use `mapColors` onto a steel ramp
  (`bosses.js:388` `STEEL`).
* Good cheap part set: horns, crown, wings (behind), extra eyes, armour plates, weapon swap (draw over the old weapon
  after `p.each` erases a rectangle), aura (behind, soft).

---------------------------------------------------------------------------------------------------
## 6. Bosses, rare, post-game (what Chronicle gets)
* 12 bosses. Their themes follow the Crest plot (goblin chief, bandit, sea serpent, sphinx, frost giant, flame lord,
  star guardian, two generals, a two-form demon king, abyss lord). Reuse them as regional bosses where the story fits,
  and a recolour + overlay is fine for mid-bosses. Chronicle needs 12–16 more (24–28 total, including the
  post-clear boss).
* 6 rare designs. The rules (`rare_monsters.js:1-12`): gold/gems/iridescence, a faceted jewel with a white glint, a
  few loose sparkle pixels, and it must read as "special" at a glance. Chronicle needs ≥ 22, so **16+ new**. Rare
  sprites are unique designs, not palette variants. The separate "金色の○○" individuals are `@gold` variants of
  normal lineages (§5).
* The sheet tools map each rare/boss to a backdrop through a hard-coded table (`sheet_rare.js:33`,
  `sheet_bosses.js:31`). Add new ids there.

---------------------------------------------------------------------------------------------------
## 7. Characters: `chars.js`, `chars_parts.js`, `chars_npc.js`

### 7.1 Engine (`chars.js`)
* Frame 16×24 (`:23`, module constants; a 16×32 body would need a new parts set). A sheet is
  `{down:[f0,f1], up:[..], left:[..], right:[..]}`. `left` = `flipH(right)` (`:148-156`).
* **Semantic palette letters** (header `:4-12`, `BASE_PAL :55`): `k` outline, `w` white, `e` eye, `m` blush/mouth,
  `s d t` skin mid/dark/light, `1-4` hair dark→light, `ABC` main, `DEF` sub, `GHI` trim, `LMN` leather, `XYZ` steel,
  `PQR` accent, `UVW` accent 2 (often trousers), `i j` bone/cream, `o O` red gem, and `x` erases lower layers.
  An unknown letter warns once (`:110`).
* `palette({main,sub,trim,leather,steel,acc,acc2,hair:[4],skin:[3],eye,extra})` `:72`. Each group goes through the
  3-step SFC `ramp(base)` `:39` (cool shadow, warm light, lifted darks). **Outfit recolour = passing different
  `main/sub/trim`.** Hair, skin and eyes stay.
* A layer is `{y, x?, g:[rows ≤16]}`. A part is `{down, up, right}`, each either a layer or `[f0,f1]`, with optional
  flags: `walk:true` (a single down/up layer is mirrored for frame 1), `dy`, `still`, `map` (letter remap, e.g. a cape
  in trim colours), `clipY` (drop rows above y), `pal`. `CA.use(part, opts)` adds options without copying (`:178`).
* A figure spec has slots `capeBack body cape head hair beard hat over`, plus `dy` and `bob:[f0,f1]`.
  The draw order per direction is in `ORDER :159`. `frame()` adds the 1-px outline around the whole figure (`:134`),
  so **parts never draw the silhouette outline**.
* Hats may set `hairClip` (hair rows above it are removed before the hat is drawn; `0` means no clip because it is
  falsy) and `bow` anchors (Metem's ribbon shows through, `:265-270`).

### 7.2 Parts library (reusable for 21 party characters and NPCs)
* `P.head` (`chars_parts.js:11`). Faces `P.face.boy/gentle/sharp` (`:45`).
* Hair: `hairYuki hairNon hairMetem ribbon` (`:62-208`), plus `hairShort tuft hairBald hairBun hairLong hairPig hairWild`
  (`chars_npc.js:15-240`). Beards: `beard beardShort mustache`.
* Bodies: `fighter robe armor light lightF fighterF gi coat ninja` (`chars_parts.js:213-735`), plus
  `dress apron shop sailor vest kid kidF dwarf` (`chars_npc.js:559-986`).
* Capes: `long crest mantle`. Hats: `horned plume winged dragon dark circlet mitre hood witch wide bandana headband
  feather beret goggles ninja turban tophat` (`chars_parts.js:836-1411`), plus `crown tiara kettle veil sailor tricorn
  scholar official cap circletVeil horns` (`chars_npc.js:281-558`).
* Over: `spear cane staff glasses elfEars mask` (`chars_npc.js:987-1162`).
* Crest job styles (`chars_parts.js:1446-1467`) are good starting looks for Chronicle character types, e.g. `fighter`
  + `horned` (warrior), `robe` + `witch` (mage), `light` + `feather` (hunter), `gi` + `headband` (monk).

### 7.3 NPC types (`npc:<type>`, 30)
`king queen princess minister soldier knight old_man old_woman man woman boy girl merchant innkeeper priest nun sage
elder sailor captain bandit elf dwarf scholar dancer spirit demon ghost cat dog`.
`chars_npc.js:1185-1271`: `def(type, spec, pal)` for humans. `spirit`/`ghost` (`ghostly`, `:1332`) and `cat`/`dog`
(`animal`, `:1569`) have custom builders. The kid/dwarf height offset is `KID=3` (`kidPart`).
Chronicle will want more types, e.g. `bartender` (the 酒場 is where the party is swapped), `storyteller`/語り部
master, rival, mysterious figure, `farmer`, `hunter`, `noble`, `pirate`, `monk_npc`, `gypsy`.

### 7.4 A new party character (tested; renders 8 frames correctly)
```js
// in chars_parts.js (or a new chars_party.js — any file sorting before chars.js is fine; use P lazily)
P.party.lia = {
  gender: 'f', hair: ['#1c3c2c', '#2c6a44', '#48a060', '#88d090'], skin: ['#dc9c78', '#f8d0b0', '#fff0e0'], eye: '#1c3020',
  head: [P.head, P.face.gentle], hairPart: P.hairLong,          // or [P.hairX, P.ribbon] (+ acc / bow)
  style: { body: 'light', bodyF: 'lightF', hat: 'feather', colors: () => ({ acc2: '#4a4030' }) }, // same shape as a Crest job style
  outfit: { main: '#b8402c', sub: '#e8dcb8', trim: '#f0c030' },
};
// in chars.js (replaces partySheet/defParty/JOB_IDS/CHAR_IDS/DEFAULT_OUTFIT)
function charSheet(id) {
  const who = CA.parts.party[id], st = who.style, o = who.outfit;
  const cols = Object.assign({ main: o.main, sub: o.sub, trim: o.trim }, st.colors ? st.colors(o) : null);
  const pal = palette(Object.assign({ leather: '#8a5a34', steel: '#9ca4b8', acc2: '#44405c' }, cols,
    { hair: who.hair, skin: who.skin, acc: who.acc, eye: who.eye }));
  return sheet(CA.partySpec(who, st), pal);
}
for (const id in CA.parts.party) R.Gfx.def('party:' + id, () => charSheet(id));
```
`partySpec` (`chars.js:255`) already handles `bodyF` for `gender:'f'`, `hairClip` and `bow`, so it can stay.
For the hero, define `hero_m` and `hero_f` (and one style per creation type if the look should follow the type).
Validate part grids with a port of ref `tools/fixtures/chars/check_parts.js` (rows exactly 16 wide, known letters,
inside the frame).

### 7.5 A new NPC type (tested)
```js
CA.npcs.bartender = { spec: () => ({ body: P.body.shop, head: [P.head, P.face.boy], hair: P.hairShort, beard: P.mustache }),
  pal: { main: '#6a2a30', sub: '#f4f0e4', trim: '#c8a868', hair: [...4], skin: [...3], acc2: '#3c3834' } };
R.Gfx.def('npc:bartender', () => CA.npcSheet('bartender'));   // or add 'bartender' to CA.NPC_TYPES (chars.js:301)
```

---------------------------------------------------------------------------------------------------
## 8. `objects.js`: `obj:*` and `icon:*`
* `obj:chest` `[closed, open]` 16×16 (`:54`), recolourable through `CHEST_PAL :22`, e.g. a blue ティア宝箱 vs a red fixed
  chest. `obj:ship` 32×32 4 dirs × 2 (`:163`), `obj:sparkle` 4f (`:180`), `obj:crest_glow` 4f (`:206`), `obj:shadow`
  14×5 (`:232`).
* Icons are 8×8 `fromGrid` with palette `IP :240`: `sword knife axe spear staff rod bow claw katana harp shield helm hat
  heavy light robe acc herb potion key` (`:247-448`, registered `:449`). To add one, add an 8-row grid to `ICONS`
  using `IP` letters and map it in `menu.js:66-80`. Chronicle additions are in §0 #5; 閃き might also want a
  lightbulb/spark icon.

---------------------------------------------------------------------------------------------------
## 9. Tiles

### 9.1 Toolkit `R.Art.TK` (`tiles.js`)
`Buf` (`:82`) is an Int32 0xRRGGBB image with −1 = transparent. It has `set get wget wset (wrapped) fill rect hline
vline line ellipse shadeEllipse poly each outline blit(src,x,y,{wrap,flip,alpha}) shadowOf tint crop toCanvas`.
Helpers: `c mix shade mul ramp hex`, seeded `hash rng vnoise fnoise` (periodic, so seamless), `bayer pickRamp`
(ordered dither), `stamp(floor, draw, o)` (object layer + outline + drop shadow), `frames(n, fn)` (animation →
canvas[]), `tex speckle`. **Master palette `PAL`** (`:252-279`): grass tgrass plain forest trunk sea shallow foam
sand desert snow swamp waste magma crust rock grey wood red gold silver purple blue skin leaf.
All tile art is deterministic and seeded. There are no image files anywhere.

### 9.2 World map (`tiles_world.js`): `R.Art.worldTile(map,x,y)`
* Pass 1 (ground): each tile id maps to a **class** (`TCLS :24`). Classes: `SEA BARRIER GRASS PLAIN DESERT SNOW SWAMP
  BEACH WASTE MAGMA`. `forest/snowforest` sit on grass/snow. `hills`, `mountain` and `loc_*` are DERIVED: they take
  the most common land class within 2 cells (`resolveClass :596`). A disc-kernel blend of the 3×3 classes plus
  per-class noise (`AMP :32`) gives rounded coasts. The margin to the second class drives foam, shallows, sand rims
  and the cliff lip (`basePixel :222`). Textures per class are in `textures() :97-220` (sea 4 frames, barrier 4,
  magma 2).
* Pass 2 (sprites): `descriptor :621` → `placements :641` → tree/pine/hill/mountain/bridge/reef/icon sprites,
  including neighbours' overhangs, y-sorted, with drop shadows.
* Location icons live in `ICONS :402-560`: `loc_castle town village cave tower shrine pyramid volcano demon temple`.
  Each returns `{buf, ox, oy}` relative to the cell.
* Cache: `render :693` caches per neighbourhood signature (`:702`, **fix the `join('')` before adding classes**).
  `A.worldTileCacheSize()` / `worldTileStats()` are there for monitoring.
* Standalone `tile:<id>` for world ids = the tile rendered in a neutral neighbourhood (`WORLD_IDS :771`, `:789-795`).
  It is animated only if the data tile has `anim`.
* **Adding a world tile:**
  (a) A sprite-type tile (e.g. `ruins`, `standing_stones`, `road_sign`): data tile + legend (lead), `TCLS[id]=GRASS`
  (or DERIVED), a `descriptor` case with a new letter, a `placements` branch, a sprite builder, and the id in
  `WORLD_IDS`.
  (b) A location icon: `ICONS.loc_x(t,P)` + `WORLD_IDS` + data `{warpIcon:true, enc:0}`. `descriptor` handles every
  `loc_*` automatically.
  (c) A new ground class (e.g. `ROAD`, `RIVER`, `CLIFF`, `DEEPFOREST`): a const, bump `NCLS`, add an `AMP` entry,
  `TEX[k]`, rules in `basePixel`, and `isWater` if it is water. Apply the cache-key fix first. Rivers: a 1-tile
  channel of SEA class blends into blobs, so RS1-style rivers need their own class with a smaller blend radius
  (`RAD=6 :37` is global).
* Animation speed per tile id is in `field.js:19` `ANIM_RATE` (default 16 frames). A world cell animates whenever any
  sea pixel is in it (`build :715-722`).

### 9.3 Themes (`tiles_theme.js`): themed tiles `floor wall wall_torch door door_silver door_gold pillar stairs_up stairs_down rock`
* `TH :14-28` has one row per theme `{fl: floorRamp, floor: FLOOR kind, wl: wallRamp, wall: FACE kind, door: LEAF kind, col: COL kind}`.
  Kinds: FLOOR `flags cobble tiles planks dirt slabs blocks wet ice basalt diamond marble demon` (`:105-222`).
  FACE `bricks ashlar dbricks plaster rock rubble sandstone iceblock marble` (`:224-291`). TOP (`stone rock beam`,
  chosen by `TOP_OF :330`). LEAF `wood stone ice iron shrine demon silver gold` (`:635-644`; **an unknown `door`
  kind throws**). COL `stone marble wood stalag basalt lotus ice spike` (`:708-716`).
  `ALT[theme] :371` (tile_alt second colour, falls back to generic), `MOSSY :386`, `FORMAL :387`.
* Walls are drawn in DQ5 3/4 view: a face with a lit cap where floor is behind, and a top surface inside thick walls.
  That logic is in `tiles_auto.js:210-236`.
* Registration (`:840-848`): every `TH` theme gets `tile:<theme>:<id>`. A theme that exists only in `R.DB.themes`
  gets generic art **and** `localTile` treats it as generic (§0 #10). Themed objects on the theme's floor are
  registered for every `R.DB.themes` entry except `town` (`tiles_local.js:1050-1056`).
* **New theme recipe:** add a `TH` row (reuse kinds or add a FLOOR/FACE builder), optionally `ALT/MOSSY/FORMAL`, add
  the data theme `{name, bbg}` in `data/tiles.js` (lead), and check with `sheet_tiles --only themes`. Current themes:
  `generic town castle house cave fort pyramid water ice volcano tower shrine demon`.

### 9.4 Local context tiler (`tiles_auto.js` + `tiles_local.js`): `R.Art.localTile(map,x,y)`
* `tiles_auto.js:317` dispatches: walls/doors (3/4 view, torch frames), grounds (wall/furniture shadows from the
  decor layer, floor variety by position hash, carpet gold borders, grass fringe), `housewall`/`roof`
  (ridge/eave/gable, windows on alternate cells, chimneys), liquids with banks (`water` 4f, `lava` 2f, `poison` 2f),
  and objects on the floor they actually stand on (`JOIN`: counter/table/bed/fence connect).
  It returns `null` → the field falls back to the plain `tile:<theme>:<id>` / `tile:<id>` (`field.js:34-62`).
* `tiles_local.js:1066-1087` wraps `localTile` for **outdoor** grounds: tufts, pebbles, puddles, kerbs, worn edges,
  canals with coping, bridges and fences over them.
* Object art `OBJ` (`tiles_local.js:170-500`): `pot barrel crate counter table chair bed bookshelf shelf throne altar
  statue sign well grave pedestal warp_pad seal pit tree fence lbridge_h lbridge_v`. `DEFAULT_FLOOR :1015` gives the
  floor for the generic `tile:<id>`.
* **New local object tile:** data tile (lead) + `OBJ[id] = (floorBuf, ctx) => Buf` + `DEFAULT_FLOOR[id]`
  (+ `THEME_OBJS` if it appears in dungeons, + `JOIN`/`TALL`/`ANIM_OBJ` in `tiles_auto.js:20-28` if it connects,
  casts a shadow or animates). An id with no art gets a neutral stone floor, but only after boot.
* Animated tiles return canvas arrays. Frame counts: sea/water/barrier/warp_pad 4, magma/lava/poison/wall_torch/seal 2.
  The field picks `frame / ANIM_RATE[id]`.

### 9.5 Decor layer (`decor_interior.js`, `decor_exterior.js`, `decor.js`)
* 58 ids (data `data/tiles.js:168-232`, legend `:234-247`).
  Wall: `banner_red banner_blue tapestry window window_arch sconce painting portrait emblem swords wall_shelf mirror`.
  Floor: `rug rug_blue dais crack tile_alt mosaic grate straw leaves flowers_low stool`.
  Furniture: `fireplace stove sink cupboard wardrobe dresser desk table_round table_long bench plant vase sacks crates
  armor_stand weapon_rack treasure candelabra globe anvil clock`.
  Town: `flowerbed hedge lamp sign_item sign_weapon sign_armor sign_inn sign_church stall fountain cart haystack bush
  well_small`.
* Art: `decor:<id>` is a canvas (16×16, or up to 16×32 for `tall`, bottom-aligned, real alpha for shadows/glow) or an
  array of frames. `R.Art.decorAuto[id](map,x,y)` handles joined/context pieces (`decor_interior.js:1489-1503`,
  `decor_exterior.js:189-787`). `decor.js` dispatches.
* **New decor:** data entry + legend char (free: `j H N 0 ! ? $ % & < > { } [ ] ( ) ; - / + = * # @ ~ ^ _ | : ,`) +
  a builder in `D` (`decor_interior.js:1452`) or `def('decor:…')` (`decor_exterior.js:837-848`) + the id list for the
  sheet tool (`A.INTERIOR_DECOR` / `A.DECOR_EXTERIOR`). For Chronicle a `sign_tavern` (酒場) is needed.
  Small mismatch: the data says `lamp anim:2`, but the art returns 4 frames (harmless, since the field uses `g.length`).

---------------------------------------------------------------------------------------------------
## 10. Battle backdrops (`battlebg.js`): `bbg:<id>`, 256×144
* Ids (`IDS :872`): `grass forest hills desert snow swamp wasteland sea cave fort watercave pyramid ice volcano tower
  shrine castle demon throne`. Scenes are in `S :360-870`. `make(id)` falls back to `S.grass` for an id missing from
  `S` (`:875-879`). The battle falls back to `R.BattleFX.fallbackBg` for an unregistered key (`battle_scene.js:661`).
  The battle also accepts frame arrays (`:662`), but no backdrop animates today.
* Helpers (private): `sky(b,y0,y1,stops,nBands)` (banded + dithered) `:25`, `range` (fbm ridge; `round`, `snow`,
  `haze`) `:55`, `peaks` `:104`, `cloud` `:147`, `stars`, `treeRow`, `pineRow`, `plane(b, yHorizon, [far,nearA,nearB],
  {stripes, tex(x,y,z)})` `:205`, `tiledFloor` `:221`, `brickWall`, `column`, `wallTorch`, `vignette`,
  `stageShadow(b,cy,rx,ry,k)` `:310`, `formation`, `spikes`, `mounds`.
* **Rules:** horizon at about y 84–104. Keep the strip y≈110–140 calm (the monsters stand on y=130) with a
  `stageShadow` under the group. The party windows cover the top ≈50 px (more in a 4-window layout), so do not put
  key detail there.
* **New backdrop:** add `S.<id> = (b) => { sky(…); range/peaks(…); plane(b, 97, cols, {tex}); stageShadow(b,132,110,7,0.9); }`
  and the id in `IDS` (registration loops only over `IDS`). Then point data at it (`tiles.bbg`, `themes.bbg`,
  encounter `bg`). For another file to add backdrops, export the helpers (`A.BBG = {sky, range, …}`); only TK is
  shared today.
  Likely Chronicle additions: ruins, deep forest, mine, graveyard, canyon, beach, ship deck, library, sky temple,
  final area.

---------------------------------------------------------------------------------------------------
## 11. Contact-sheet tools (verified in this container)
Playwright is found via `require('playwright')`, with fallback `/opt/node22/lib/node_modules/playwright`.
Chromium is in `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` is set). Each run takes about 1 s.
The tools load core(ns,input,gfx) + data + art only, so they work while systems are broken, **and they do not run
boot hooks**. Always pass `--out <scratch dir>`: the defaults are `/tmp/claude-0/<name>`, and each run also writes
`_sheet.html` and `_sheet_page.js` into OUT.

| Tool | Output | Status here |
|---|---|---|
| `sheet_monsters_a.js [--only sheet,context,zoom] [--ids] [--scale]` | small/medium sheets with 3 hue variants + 1× copies, `context_<bg>` at 3× | **works**. `--only zoom --ids a,b` renders **any** registered `mon:` key (tested with new and composed keys). Variant rows only show ids from its `SMALL/MEDIUM` lists. |
| `sheet_monsters_b.js [... check, grid]` | medium/large + context. `check` prints size/bbox/centring/bottom coverage/colours and exits 1 on a problem | **works** |
| `sheet_bosses.js [--only sheet,context,zoom] [--crop]` | sheet with build time + colour count, context with the 3 Crest windows | **works** |
| `sheet_rare.js [--only sheet,context,zoom,check]` | + hit-flash/target tints; `check` includes a semi-transparency test | **works** |
| `sheet_postgame.js [--only zoom,context,variants,check,roster,scene]` | default modes work. `roster` needs `pg_*` data; `scene` needs a build + Crest `R.Postgame` | default **works**; roster/scene not usable yet |
| `sheet_chars.js [--only party,all,lineup,npc,objects,icons,field] [--chars] [--jobs] [--npcs]` | party × job sheets, NPCs, objects, icons, field context | **works** (Crest ids). Breaks when `JOB_IDS` goes. Tested `--npcs bartender` and a custom `party:<id>:<x>` key. |
| `sheet_tiles.js [--only tiles,themes,objects,world,worldmap,town,bbg] [--frame]` | all tile/theme/object/world/town/backdrop sheets | `tiles,themes,bbg` work. The default run **crashes** at `objects` (missing `tools/fixtures/tiles/samples.js`). With the ref fixture copied, all modes work (tested in a scratch copy). `worldmap` is skipped until a world map exists. |
| `sheet_decor.js [--only decor,themes,rooms] [--emit room] [--list] [--zoom]` | decor on castle/house/town, one room per theme, demo rooms. `--emit` makes a `shot.js --eval` | **works** (needs `systems/field_map.js`, present) |
| `sheet_decor_ext.js [--html FILE] [--only sheet,grounds,demo,game]` | exterior decor, grounds/kerbs/canals, demo square | needs **`dist/index.html`** (`node tools/build.js` writes `dist/` and `debug.html` in chronicle). **Works** after a build (tested in a scratch copy). The build logs `pyftsubset` missing and Google Fonts is blocked (`ERR_CERT_AUTHORITY_INVALID`), so text in screenshots uses a fallback font. |

In-game check: `node tools/shot.js --out x.png [--html debug.html] --eval "<js>" --keys ...` (needs a build).

---------------------------------------------------------------------------------------------------
## 12. RS1 look and Chronicle art to-do (practical levers)
1. **Palette pass first (cheapest, biggest effect).** All art is procedural from a few ramp tables: `TK.PAL`
   (`tiles.js:252`), `TH` (`tiles_theme.js:14`), world `textures()` (`tiles_world.js:97`), local grounds
   (`tiles_local.js:16-160`), decor palettes (`decor_interior.js:17-40`, `decor_exterior.js:17-30`), and backdrop
   colours inline in `battlebg.js`. RS1 reads earthier and less saturated, with warmer shadows. Change the tables,
   not every function. Monster and character ramps are separate (§3, §7) and can stay SFC-bright (RS2 quality).
2. World: add road/path, river, cliff/escarpment and ruins/standing-stone classes or sprites (§9.2), plus RS1-style
   town/castle icons. Crest's world is DQ-like (rounded islands, tiny icons).
3. Towns: timber/stone European houses. `housewall`/`roof` are in `tiles_local.js:503-571` (`housewall :505`, `roof :540`), and the facade and window
   rule is in `tiles_auto.js:238-261`. Keep interiors dense with decor (the existing 58 ids plus new ones).
4. Figures: 16×24 chibi (8-row head). For RS2-level detail, use 4-step ramps for clothing and more hair/face parts.
   Keep the 16×24 contract unless the lead decides otherwise. The field note covers idle frame 0 and an
   above-sprite layer.
5. Volume: about 10 new monster bases or overlay lineages, 16+ rare designs, 12–16 bosses, `@gold` for every lineage,
   5+ icons, 20+ party looks, about 6 NPC types, a few themes/backdrops/decor. Put each in **new files** per owner
   (e.g. `monsters_c.js`, `mon_variants.js`, `rare_monsters_b.js`, `bosses_b.js`, `chars_party.js`) so 20 agents do not
   collide, and keep the id lists in the sheet tools in sync.
