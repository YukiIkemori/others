# ENV_ASSETS — painted environment art (terrain, props, buildings, battle backgrounds)

Written 2026-09-27 by the environment-art agent. The code-drawn towns, dungeons, field and battle backgrounds are replaced by pixel art generated with the image API and normalised to the engine's pixel grid. **Every asset is optional**: when an image is missing (node tests, a load failure, an id with no art yet), the engine draws the old code-drawn version. Collision, walkability, chunking, lighting and the map data are unchanged.

Sources for the look: BRIEF A16 / A23 to A25 / A32 / A33, `design/build/STYLE_REFERENCE.md`, `MODERN_UI.md`, `ART_REWORK.md`, the approved mocks in `design/art_proto/ui/out/`, and `design/art_ref/STYLE_PROMPT.md` (the character style). The look is rich hi-bit pixel art, top-down for maps, with night lighting added by the engine. No other game's names or assets are used in prompts or files.

## 1. Format decisions

| Decision | Why |
|---|---|
| **1 art pixel = 1 logical pixel** (960×540, drawn ×2 or ×4). Tile = 32 px. Field characters are about 48 px tall, and a door is 22×32 px (18×26 on small houses). | The environment then has the same pixel density as the character sprites (`v2/assets/sprites/*/field.png`). |
| **Field art is painted as "albedo"**: soft, even light, with no night, no cast shadows and no light pools. | TERRAIN already makes the night with its light map (the ambient multiply plus lamp pools, window light, the lantern ring). Albedo art therefore gets correct warm pools wherever the engine puts a light, and moves with the lantern and tier. Brightness was calibrated to the old code palettes (`design/art_ref/gen/env/_tools/proc_targets.json`), so the existing light tuning still applies. |
| **Materials are seamless textures with a period of 256 px (8×8 tiles) at tile 32.** They come in 192 / 256 / 320 px versions for tile 24 / 32 / 40. | These plug directly into the dual grid. `dualgrid.js` samples the sheet with `mod S`, where S is the image width, so an 8-tile period only needs the sheet object to carry S. The 16 edge shapes, the soft/hard edges, rim/halo and the macro variation still come from the engine. The period is 8 tiles instead of 4 so the pattern repeats less visibly. |
| **Rise faces are 256×128 strips**: a lit lip at the top, the face, and a 10 px contact band at the bottom. | One strip serves rise 1, 2 and 3: the engine keeps the top rows and the foot band (`T.Env.face`). |
| **Props are strips of frames on a transparent background**, with a feet anchor (bottom centre), an optional `light32` point and variants `<id>_v<n>`. | This matches the `hd:prop:<id>` Sheet and `opts.v`. `opts.amb` multiplies the ambient exactly as `bakeProp` does. |
| **Buildings are one painted sprite per map building id** (`def.id`), generated from a layout guide with the exact footprint, roof/wall split, door and windows. There are also three generic buildings per region (`def.art`). | The door is painted exactly where the map's door tile is, so walking into the door works without any data change. The sprite anchor is the bottom-left of the footprint, the same as the code building. |
| **Building emission layer** (`<id>_emit@<t>.png`): the lit window pixels only. | After the light map, TERRAIN draws this layer over the chunk, so the painted windows glow and the synthetic pane is not drawn. Window lights (pools) still come from `emit32` rectangles. |
| **Battle backgrounds are full painted night scenes.** The source is 3840×2160, pixelised to 960×540, plus a phone crop at 540×643 for the portrait battlefield (top 55 %). They are split into `back` (sky and far, drawn unlit), `ground` (below the horizon, 12 px feather), an optional `front` (foreground overlay) and `post` (glow from luminous colours, drawn with `lighter`). | BSCENE multiplies ground and front by the light map. `K.envLayers` therefore divides those layers by the mood's ambient, so the multiply gives back the painted night colours away from the lantern and a warm, bright pool near it. No BSCENE change is needed. |
| **Painted per-map underlay** (`map.art`, §7) | Used for Roa (2026-09-27): the owner found the tile-built village too plain, so the whole village is one painted image. The tile path stays as the fallback. |

## 2. Files

```
v2/assets/env/
  common/mat/<id>@24|32|40.png  + <id>.json        materials (ground, water, wall tops), derived: pier bridge deck ladder deep_water cliff wall_brick
  common/mat/face_<style>@24|32|40.png + face_<style>.json   rise faces: rock cliff stone brick wood moss bark cave
  common/props/<id>@24|32|40.png + <id>.json       props (frames side by side), variants <id>_v<n>
  harbor/props/…                                   harbour props (barrel crate sack bench lamp_post well stall board net bollard rowboat flower_pot, ship)
  <theme>/bld/<buildingId>@24|32|40.png, <buildingId>_emit@…png, <buildingId>.json
  <theme>/under/<map>@24|32|40.png, <map>_over@…, <map>_emit@…, <map>.json   painted map underlay (§7)
  <region>/mat|props|bld/…                         other regions (desert snow marsh isles mine ash star) — unique material ids, generic buildings <region>_house_s|shop_m|hall_l
  bbg/<id>/back.png ground.png front.png post.png (+ _tall variants), <id>.json
design/art_ref/gen/env/                            raw generations (+ .gen.json with the exact prompt), guides, tools
design/art_ref/gen/env/_tools/                     gen_env.py (API, logs kind 'env'), proc.py / build_all.py (normalise), env_inject.js (runtime preview without editing src), env_shot.js, comp_battle.py
```

JSON sidecars:
- **Material**: `{id, kind:'material', period:{24:192, 32:256, 40:320}, files:{…}, native_px}`.
- **Face**: `{style, kind:'face', period, height:{32:128}, foot32:10}`.
- **Prop**: `{id, kind:'props', frames:[names], cell:{t:[w,h]}, feet:{t:[x,y]}, light32?:[dx,dy], files}`.
- **Building**: `{id, footprint:[w,h], wall, anchor32:[8, H], door32:{x,y,w,h}, emit32:[{kind:'win',x,y,w,h}], roof32:[x0,y0,x1,y1], wallTop32, files, emitFiles}`. Coordinates are relative to the draw point, which is the footprint's bottom-left.
- **BBG**: `{id, prelit:true, layers:{…}, horizon:{wide, tall}, blend:{…}}`.

## 3. How the engine uses them (wired 2026-09-27)

- **Build** (`v2/tools/build.js`): `scanEnv` puts every PNG under `v2/assets/env` into `RPG_MEDIA.env['<theme>/<sub>/<name>@<tile>']` as `{url, meta}`. The meta is stored once per id (on the @32 image, or on `back` for a bbg), and the files are copied to `dist/env.*.png`. The table adds about 60 KB of JSON; the images total about 30 MB for the slice.
- **`v2/src/art/terrain/env.js`** (new): at boot (`R.onBoot`) it preloads and decodes all env images, then sets `T.Env.ready` and forgets code-baked `hd:prop` / `hd:bld` / `hd:bbg` / `hd:secret` sheets. API:
  - `T.Env.mat(id, tile)`, `face(style, tile, h)`, `prop(base, v, opts)`, `bld(def)`, `bbg(id)`, `meanColor(id)`.
  - A missing tile size falls back to nearest-neighbour scaling of @32.
- **`materials.js`** `sheetOf`: returns `{S: image width, px, done:true}` when an env material exists. `matColor` uses the image mean for the minimap and world thumbnail. Unknown ids still use the procedural fallback. `T._envReset` clears the code-baked sheets.
- **`rise.js`** `faceSheet`: returns the env face composed for height h.
- **`props.js`** `bakeProp` → `envProp`:
  - It keeps frame names; `on` is aliased to `on0..on2`, and missing META frame names are aliased to the nearest frame.
  - `opts.amb` multiplies the ambient, except for the chest, which stays near albedo so it stands out on every floor (WORLD_REDESIGN §6.3).
  - `opts.leaf === 'dk'` darkens trees, and `opts.leaf === 'moss'` picks `tree_moss_v*`.
  - Env-only ids are registered statically (`ENV_ONLY`), so content can place them: `cupboard dresser stool house_plant shelf_jars wash_tub rug_roll weapon_rack ladder_prop lever fern reeds log_moss tree_moss tree_dead tree_glow`.
- **`buildings.js`**:
  - The factory is now `envBuilding(def) || draw(norm(def))`. The key includes `def.art`, so content can point a building at a generic sprite: `art: 'desert_house_s'`. For a generic sprite the door is on the footprint's middle column, `x + floor(w/2)`.
  - `meta.emitLayer` and `meta.envAnchor` are set.
- **`props_light.js`**: a building with `emitLayer` pushes one `{kind:'img'}` emissive entry. `_drawEmissive` draws it, and the synthetic pane is skipped for those windows. Window pools and glows are unchanged.
- **`bbg/kit.js`** `bakeGen` → `K.envLayers(id, def, g, W, H, L)`:
  - It loads back/ground/front/post (the `_tall` set when `g.tall`), scales them to cover the canvas, and divides ground and front by the mood ambient ("unlight").
  - The lantern sprite is added to ground and its glow to post. An empty front is used until a front overlay exists.
  - Actors are still lit by the light map as before.

### Tree / variant mapping
| Engine key | Images |
|---|---|
| `hd:prop:tree` (`opts.v` 0..5) | `tree_v0..v5`. With `leaf:'moss'`: `tree_moss_v0..v1`. |
| `hd:prop:pine` | `pine_v0..v5` |
| `hd:prop:tree_giant` | `tree_giant_v0..v1` (about 120 px tall) |
| `hd:prop:bush`, `hd:prop:roots`, `hd:prop:rock`, `hd:prop:dec_tuft` | `_v0/_v1` |
| Other `dec_*` | single images |

`opts.h` (the old tree heights) is ignored; heights come from the variants.

### Not done in code (small follow-ups)
- `chunks.js` `_emissive` could redraw the emission layer into `over` with `source-atop`, so that roof dormer windows also glow. My edit to `chunks.js` was not permitted, so dormers stay unlit at night (see `requests.jsonl`).
- Animated frames (spring f0..f3, brazier/torch flicker) are single frames; the engine's glow flicker carries the motion.

## 4. Adding or replacing art

1. Add a job (prompt, size, refs) to one of the `_tools/jobs_*.py` files. For buildings, the guide is drawn from the map def by `guides.py`.
2. Run `python3 _tools/gen_env.py jobs.json`. It needs `OPENAI_API_KEY` and `OPENAI_MODEL` from the owner's env file and logs to the spend log outside the repo.
3. Run `python3 _tools/build_all.py [mat|face|props|bld]` and `proc.bbg(...)` for battle backgrounds, then `node v2/tools/build.js`.
4. Preview in the real engine with `node _tools/env_shot.js out.png <map> <spawn|x,y> --before`. With `--before` the shot uses the wired dist; without it, the assets are injected at runtime by `env_inject.js`.

## 5. Asset list
See §6.

## 6. Asset list (generated 2026-09-27)

- **ash/mat** (5): ash, basalt_floor, face_basalt, lava, obsidian
- **ash/props** (15): arena_banner, ash_bush, ash_weapon_rack, charred_stump, charred_tree, hot_spring, iron_brazier, lava_rock, obsidian_shards, phoenix_statue, rope_post, steam_vent, sulphur, volcanic_rocks, water_urn
- **ash/bld** (3): ash_hall_l, ash_house_s, ash_shop_m
- **common/mat** (40): bark_floor, bridge, carpet, cave_floor, cliff, cobble, deck, deep_water, dirt, face_bark, face_brick, face_cave, face_cliff, face_moss, face_rock, face_stone, face_wood, flowers, forest_dark, grass, ladder, moss_earth, pier, plank, road, rock, root_floor, sand, sea, shallow, stone_floor, tall_grass, wall_bark, wall_brick, wall_cave, wall_moss, wall_stone, wall_wood, water, wood_floor
- **common/props** (73): beacon, bed, bookshelf, brazier, bush_v0, bush_v1, chair, chest, counter, crystal, cupboard, dec_flowers, dec_leaves, dec_mush, dec_pebbles, dec_tuft, dec_tuft_v1, door, dresser, fence, fern, grave, hay, house_plant, ladder_prop, lantern, lever, log, log_moss, mushroom_glow, pine_v0, pine_v1, pine_v2, pine_v3, pine_v4, pine_v5, planter, reeds, rock, rock_small, rock_v1, roots_v0, roots_v1, rope_bridge, rug_roll, shelf_jars, signboard, songstone, spring, stairs_down, stairs_up, stool, stove, stump, switch, table, tent, torch, tree_dead_v0, tree_giant_v0, tree_giant_v1, tree_glow_v0, tree_moss_v0, tree_moss_v1, tree_v0, tree_v1, tree_v2, tree_v3, tree_v4, tree_v5, wash_tub, waylamp, weapon_rack
- **desert/mat** (5): cracked_clay, dune_sand, face_sandstone, sandstone_floor, wall_sandstone
- **desert/props** (15): bones, broken_pillar, cactus, carpet_rack, cart_barrels, clay_jars, copper_brazier, desert_palm_v0, desert_palm_v1, desert_stall, dry_well, obelisk, sand_mound, thorn_bush, tomb_urn
- **desert/bld** (3): desert_hall_l, desert_house_s, desert_shop_m
- **harbor/props** (12): barrel, bench, board, bollard, crate, flower_pot, lamp_post, net, rowboat, sack, stall, well
- **harbor/bld** (12): ph_house1, ph_house2, ph_house3, ph_house4, ph_house5, ph_house6, ph_inn, ph_record, ph_shipyard, ph_shop, ph_smith, ph_tavern
- **hill_village/bld** (8): roa_berna, roa_h1, roa_h2, roa_h3, roa_h4, roa_h5, roa_h6, roa_hall
- **isles/mat** (5): coral_sand, face_white_wall, glow_sea, tide_rock, white_paving
- **isles/props** (15): anchor, blue_bench, buoys, coco_palm, coral, driftwood, fish_barrel, lamp_pillar, map_sign, net_frame, palm_small, palm_umbrella, rope_bollard, shells, white_pot
- **isles/bld** (3): isles_hall_l, isles_house_s, isles_shop_m
- **marsh/mat** (5): face_mud_bank, marsh_water, mud, peat_grass, wall_marsh
- **marsh/props** (15): bell_frame, board_steps, crooked_sign, fish_trap, grave_moss, lily_pads, mangrove_roots, mud_boat, pale_mushrooms, reeds_tall, rotten_stump, stilt_posts, swamp_tree, willow, wisp_lamp
- **marsh/bld** (3): marsh_hall_l, marsh_house_s, marsh_shop_m
- **mine/mat** (5): face_mine_wall, iron_grate, mine_floor, ore_rock, scaffold
- **mine/props** (15): anvil, bellows, coal_barrel, forge, hook_lamp, lift_cage, mine_cart, mine_cart_ore, oath_stone, ore_blue, ore_copper, rail, timber_frame, tool_crate, tool_rack
- **mine/bld** (3): mine_hall_l, mine_house_s, mine_shop_m
- **moss_village/bld** (6): yura_b_elder, yura_b_h1, yura_b_h2, yura_b_h3, yura_b_h4, yura_b_inn
- **snow/mat** (5): face_snow_cliff, ice, snow, snow_path, wall_snow
- **snow/props** (15): firewood, frozen_well, hay_sled, ice_crystal, ice_hole, sled, snow_bank, snow_barrel, snow_fence, snow_fir_v0, snow_fir_v1, snow_lamp, snow_rock, snow_sign, stove_pipe
- **snow/bld** (3): snow_hall_l, snow_house_s, snow_shop_m
- **star/mat** (5): face_marble, garden_hedge_top, marble_floor, star_mosaic, wall_marble
- **star/props** (15): blue_flowers, book_cart, book_stack, fountain, globe, iron_gate, lectern, marble_bench, orrery, scholar_statue, star_banner, star_dial, star_lamp, telescope, topiary
- **star/bld** (3): star_hall_l, star_house_s, star_shop_m
- **treetop/bld** (10): fern_b_gord, fern_b_house1, fern_b_house2, fern_b_house3, fern_b_inn, fern_b_pim, fern_b_rita, fern_b_search, fern_b_shed, fern_b_shop
- **bbg** (12, each back/ground/front/post + _tall): ash, cave, coast, desert, forest, isles, marsh, mine, snow, star, tower, tree

Raw generations: `design/art_ref/gen/env/{mat,props,bld,bbg}/` (197 images, each with a `.gen.json` that records the prompt). Before/after screenshots: `v2/design/shots/env/`.

## 7. Painted map underlay (`map.art`, wired 2026-09-27, first map: Roa)

A whole map can be one painted image instead of tiles + building sprites. Map data:

```js
art: { image: 'hill_village/under/roa', overlay: 'hill_village/under/roa_over', emit: 'hill_village/under/roa_emit', painted: ['fence'] }
```

- **image** (`<map>@t.png`, map px = tiles × t, 1 art px = 1 logical px at t 32): replaces the ground, rises, water edges, buildings, tile trees, ground decor and the prop ids in `painted`. `chunks.js` copies the same rectangle into each chunk's `base`.
- **overlay** (`<map>_over@t.png`, RGBA): drawn into `over`, above people and above the props' upper halves (tree canopy that hangs over the walkable row north of a tree mass, roof eaves). A chunk with no overlay pixels gets no `over` canvas.
- **emit** (`<map>_emit@t.png`, RGBA): the lit window panes, drawn after the light map like a building `_emit` layer. `<map>.json` `windows32` gives one window light and glow per pane (the building sprites' window lights are not used for that map).
- Everything else still comes from the map data: collision, doors, NPCs, chests, lamps and other props (drawn as sprites with their lights), zones, lamp and door lights, fireflies, the light map. Without the image (node, a load failure, `art` removed) the map bakes from tiles as before.
- `T.Env.under(key, tile)` reads `RPG_MEDIA.env['<theme>/under/<name>@<tile>']`; a missing tile size scales @32 (nearest).

### Making one (tools in `design/art_ref/gen/env/_tools/under/`)
1. Dump the map and a reference render: `node fullmap.js <map> before` (writes `before_data.json`, albedo and lit renders).
2. `guide.py`: colour-coded layout guide at tile 32 (ground types, paths, water, cliff, tree masses, building roof/wall split, black door marks on the exact door tiles, window marks, solid fence lines).
3. `mkjob.py` + `gen_env.py`: one generation at 2× (Roa: 2816×2304, quality high) with only the guide attached. Attaching the old render as a second image made the model copy its door positions; leave it out. Tell it to leave props (lamps, barrels, benches, wells, signs, chests) out: they stay sprites from the data.
4. Check it: `check.py` (painting + guide + collision grid), `mismatch.py` (cells where painted canopy and the tree cells disagree), `doorsheet.py` / `wallsheet.py` (zoomed door crops on the tile grid).
5. `process.py` (see `run4.sh`): optional west-forest shear, **door surgery** (slides each building sideways so its painted door is centred on the door tile; Roa needed −21…+16 px on 5 houses), box-downscale to 1×, window emit detection (warm panes inside wall bands), canopy overlay (colour likelihood canopy vs meadow in the band north of tree cells, kept only where connected to the tree mass), writes @24/@32/@40 and the json.
6. Any painted solid that is not in the data gets a collider in the data (Roa: the garden's west and south fence), then `check_reach` and `check_doors`.

Roa result: 5 generations (1 lost to a path bug, 3 tries, 1 chosen). The raw chosen image and the guide are in `design/art_ref/gen/env/under/`.

Fern result (`treetop/under/fern`, 60×56, tools in `_tools/under/fern/`, raw `under/fern_gen3_raw.png`): the non-orthodox forest village (colossal trees with pod homes, one great hollow tree holding the inn, the item shop and the search post, mushroom, gourd, acorn and stump houses, winding paths, root-arch gates). 6 generations: 1 crop test (multi-level readability), 2 of a first grid layout (dropped for the owner's "no rows" note), 2 of the organic layout, 1 chosen. Notes:
- Size: 2880×2688 (48 px/tile) is accepted. The model drifts rows downwards (up to 2 tiles mid-map, the same in every sample), so `rowwarp.py` fits a monotone row map (DTW over per-row path/water/green profiles against the guide) and `process_fern.py` warps before the door surgery.
- Two levels: platforms (`=`) sit south of solid trunks with a 1-row post face (`R`) and a ladder (`:`, 2 wide where the painted ladder straddles 2 columns), so ground walkers never go under a platform. Only the rope bridge over the path goes in the overlay; the 4 cells beside the path under it take a `roots` collider (`painted: ['roots']`). With a painted image the engine does not draw its own deck planks (`chunks.js` `_deck`).
- No @40: 60 tiles × 40 = 2400 px is over the 2048 atlas page (`tools/pack_web.py`); tile 40 scales @32.
- The meta also carries `doors32`, so `check_doors` checks the painted doors.

Yura (`moss_village/under/yura*`, 2026-09-27): the second painted map, and the first non-orthodox one: round stone-and-turf huts, a mill with a big water wheel, a stream crossed by stepping stones, and a grave hill with a spiral path (`h` = slope, solid; `p` = spiral path; `g` = summit). Tools in `_tools/under/yura/` (`yguide.py` → `ymkjob.py` (the style reference is passed via `STYLE_REF`, not stored) → `gen_env.py` → `run_yura.sh`). There were 2 generations and the first was chosen (`under/yura_gen1_raw.png`, guide `under/yura_guide.png`). Door surgery moved the huts by −3…+2 px. `yura.json` also carries `doors32`, which `check_doors` compares. The overlay covers tree canopy and the tops of the hut roofs over the walkable row north of each mass. Building ids are `yura_hut_*`/`yura_mill`, so the old per-building sprites (`moss_village/bld/yura_b_*`) and their `door32` no longer apply to this map.

Pharos (`harbor/under/pharos*`, 2026-09-27): a cliff port with no ordinary houses. It has dwellings carved into the cliff at different heights, a round stone watch tower (the record office), and a beached galleon wedged diagonally down the cliff that holds three shops, each with its own 1-tile door on a different level: the tavern at the stern, the arms shop in the midship, and the item shop at the bow. It also has upturned-hull houses (one on stilts at the end of a crooked pier), a sailcloth boat shed on stilts, and two sea stacks joined by rope bridges. The terrain is a 48-row stamp in `pharos_town.js` (`G` = headland grass, solid; `#` = rock/cliff; `.` = ledge; `c` = net plaza; `e` = stairs; `p` = planks; `b` = rope bridge).
- Tools are in `_tools/under/pharos/`: `fullmap.js pharos layout` → `guide.py 48` → `mkjob.py` → `gen_env.py` → `run.sh`, which calls `process.py` and `doorsheet.py`.
- There were two generations at 1.5× (3072×2304, tile 48), each with the guide as the only reference. The first was on an earlier grid layout and was dropped when the layout was made more organic; the second was chosen (`under/pharos_gen2_raw.png`, guide `under/pharos_guide.png`).
- Door surgery: three buildings were moved whole (−7…+13 px) and three door patches were moved on the plank walls (+7…+8 px). Every move is feathered 10 px into the painting.
- The overlay is the front rope rail of the two east-west rope bridges; each rail is traced as a fitted parabola.
- `pharos.json` also has `doors32`.
- The building ids are unchanged. Each building's `x` keeps the old sprite's `door32` offset, so the `check_reach` sprite-door rule still holds.

Kasim (`desert/under/kasim*`, 62×56, 2026-09-27): the desert oasis town, rebuilt as a non-orthodox painted town. A colossal seated statue of the nameless king (worn blank face, striped head-cloth) is half-buried in the north dune; its plinth holds three shops, each with its own 1-tile door (item shop, fortune teller, map maker). The spring is the hollow of a giant broken-off stone hand lying palm-up in the square (steps down at the wrist; `tilePatches` fill the palm with water after `cleared_r_desert`). Other buildings: the inn as fused mud domes with a star-lantern wind tower, the tavern in a giant toppled clay jar, the caravan guild in a beast's ribcage under indigo and madder cloth, the tomb keeper's rock-cut dwelling, the well-digger's dome with a water wheel, plus doorless cistern, granary, dovecote and wind-catcher. Terrain: `D` = dunes (solid), `P` = palm groves (solid), `X` = statue, `x` = stone hand. Tools in `_tools/under/kasim/` (`fullmap.js kasim layout` → `guide.py 48` → `mkjob.py` → `gen_env.py` → `rowwarp.py` → `run.sh`). 2 generations at 1.5× (2976×2688), the first chosen (`under/kasim_gen1_raw.png`, guide `under/kasim_guide.png`). The model drifted rows down by up to 0.65 tile in the south (`rowwarp.py`, desert classes); door surgery moved five buildings by +4…+15 px; one stray door-like mark on the square was patched out. Collision was then fitted to the painting (the hand, the palm grove, the jar's neck, the water wheel, the south domes). No @40 (62 × 40 > 2048).

Sandedge (`desert/under/sandedge*`, 40×30, 2026-09-27): the caravan stop, rebuilt around a colossal petrified tree at the forest's edge. The inn is carved into the hollow of the stone trunk (the only door), stone roots sprawl into the courtyard, the sweet-water well sits on the flagstones in the middle, and camels are stabled under a red rock arch; a felt yurt and a mud storehouse dome have no doors. Tools in `_tools/under/sandedge/` (the Kasim scripts adapted). 2 generations at 1.5× (1920×1440), the first chosen (`under/sandedge_gen1_raw.png`); drift ≤ 0.12 tile, no door surgery; the root feet beside the door and the two gate posts got colliders.

Yule (`snow/under/yule*`, 2026-09-27, 56×50, no @40): the snow village redesigned as a non-orthodox painted town. Deep wind-carved snowdrifts (solid) with trodden lanes winding between them; a round stone fire circle with the great hearth; one serpentine "dragon-back longhouse" curled round the north of the circle, holding four places each with its own 1-tile door (item shop at the carved dragon-head end, inn, great hall, arms); a round stone tower-house (chief), an ice-block dome (fire-keeper), a turf pit-house (Brenda), a mammoth-tusk hide lodge (Olaf), a fishing hut on sled runners on the frozen pond, a cold square stone outsiders' office (Norden branch), a timber watchtower with a bell and lookout deck, a stilt food store and a lean-to sled shed. `yule_night` uses the same art. Tools in `_tools/under/snow/yule/` (README there). 2 generations at 1.5× (2688×2400), the first chosen (`under/yule_gen1_raw.png`). The model drew the lower half about 2 tiles low: `rowwarp.py` (DTW over per-row class profiles) gives a vertical warp; then door surgery (whole buildings −23…+12 px, the hall and arms door patches). No overlay (every painted building stays inside its footprint or over drift). `yule.json` carries `doors32`.

Pass inn (`snow/under/pass_inn*`, 34×26): the inn lives in the ruin of an old border gatehouse astride the pass; the west tower is the inn (door → `pass_inn_in`), the east tower the trading post (door → `pass_inn_shop`, new interior), the gate arch between them is blocked by a rockslide; stepped travertine hot-spring pools (water, not walkable) east of the road, a travellers' camp west. 2 generations at 1.5× (1632×1248), the second chosen (`under/pass_inn_gen2_raw.png`); the gatehouse moved up 18 px and both door patches centred (+7, +18 px). Tools in `_tools/under/snow/pass/`.

## 8. Painted dungeons (2026-09-28, pilot: the demo dungeons)

The owner asked for dungeons as single paintings too (「街、ダンジョンは一枚絵で」). Dungeons use the same `map.art` as §7, with one addition: a **closed layer** for the cells whose look depends on the game state. The existing layouts, puzzles and data are kept; the painting follows the tile grid exactly.

**Tools:** `design/art_ref/gen/env/_tools/under/dungeon/`. They are generic, so you run them with a map id instead of copying a per-town script.
1. `node fullmap.js <map> <map>/layout`: the dump. On top of the §7 dump it writes `tilePatches`, the secret areas (`R.MapUtil.secretAreas`: gate cells plus the hidden cells behind) and the material info (`face`, `tall`).
2. `python3 guide.py <map> <T>`: the layout guide in the **open state**, with every tilePatch applied and every secret cell drawn as its floor. It draws wall faces with the engine's rule (`rise.js`): a raised solid cell shows its face on the `rise` wall cells above a lower cell, and the face's foot sits on the floor edge. Buildings and door objects are marked too; the engine does not draw buildings on a painted map.
3. `python3 mkjob.py <map> <T> genN`, then `gen_env.py`. It sends two images: the guide and a style reference, which is a crop of an approved painted town (`style_rock.png` for caves and towers, `style_forest.png` for forests and tree interiors). The prompt says to trace the guide, not to copy the style reference's content, and to leave props out.
   - T ≤ 2048 / max(w, h), and the image size must be a multiple of 16 (the demo maps used 48, 36 and 32).
   - Lesson from the well (gen1 → gen2): a guide face drawn as vertical stripes came back as wooden palisades. Draw faces with a few horizontal strata, and tell the model the guide is flat colour-coding to be interpreted as natural material.
4. `python3 check.py <map> genN.png out.png`: the painting with the solid cells outlined. `zoom.py` gives tile-grid crops.
5. `python3 process.py <map> genN.png <theme> [name]` writes into `<map>/out/` and does the following:
   - box-downscales the painting to 1×;
   - applies a brightness gain on walkable cells, matched to the tile render, as in §7;
   - applies a **wall-top contrast** step that keeps the tile render's top/floor luminance ratio (painted rock tops come out close to the floor);
   - builds the closed layer and the `live` regions (below);
   - builds an optional emit layer (`EMIT=cyan`: glowing crystal or fungus pixels inside solid cells);
   - writes @24/@32, plus @40 when 40 × max(w, h) ≤ 2048.
   Copy the output to `v2/assets/env/<theme>/under/`.
   - **Use the map's theme as the folder** (`cave`, `lighthouse`, `tree_inside`, `forest_dungeon`, `snow`, `desert`…). Only those prefixes are in the boot preload (`env.js` `SLICE`). Any other folder loads in the background, so the first visit shows the tile fallback.
6. Map data: `art: { image: '<theme>/under/<map>', closed: '<theme>/under/<map>_closed', emit?: …, painted: [] }`.

**What stays a sprite on top of the painting** (leave it out of the painting and out of `painted`):
- chests, springs/goddess statues (`springLook`), switches, levers, braziers, lamps, torches, crystals, mushrooms, stairs, doors (for example the lighthouse's big door), signs, NPCs, trails, beacons;
- every prop with a `cond`, such as the lighthouse lamp before and after the boss, or the fallen log;
- every lamp or light prop, which also keeps its light.
The painting is albedo; the dark mood comes from the map's `light`/`dark` exactly as before.

**Closed layer (things a painting can't change):**
- The painting shows the **open** state. `<map>_closed@t.png` is RGBA and opaque only on the live cells.
- The meta has `live: [{cells: [[x, y]…], secret: 'x,y'} | {cells, patch: i} | {cells, cond}]`.
- When the chunk is baked (`chunks.js` `_put`), each region that is still closed is drawn over the painting, whole cells only. The region is closed when:
  - the secret gate is not found (`MapUtil.secretOpen`), or
  - `tilePatches[i].cond` is false, or
  - `cond` is false.
- Re-baking already follows secret discovery (`secrets.js` re-bakes the gate, the hidden cells and 2 rows above) and grid changes (`checkGrid`). A pure `cond` region with no grid change is **not** re-baked by itself; tie it to a tilePatch.
- What `process.py` puts in the closed look:
  - **Secret area** (gate + hidden cells, plus the open-state faces above the hidden floor, plus a ring of plain wall-top cells): wall top cloned from painted rock nearby with one common offset. A face is cloned from a painted face with the same rise row when the cell below stays open.
  - **tilePatch** (cells whose base char differs from the patch): `tall: 'roots'`/`'bush'` cells get the engine's own prop sprites (`roots_v*`, `bush_v*`) composited at the cell's feet. `canopy` or `b` cells in a forest get painted forest canopy cloned from nearby. The region is every cell where the result differs from the painting, so a sprite top reaching into the cell above is included.
- For melting or breakable walls (snow/desert), use the same pattern: paint the open state, then make the closed look by cloning the painted wall or compositing the wall's sprite, tied to the tilePatch or the secret.
- Hidden objects (a chest behind a secret) are still hidden by `secretHidden`.
- The minimap still uses the tiles.

**Engine changes for this** (small, all in `chunks.js` apart from one regex in `env.js`):
- `underOf` loads `art.closed`, `liveClosed()` decides the state, and `_putUnder` draws the closed cells. `env.js` `E.under` also finds the meta for `_closed` keys.
- **The edges of non-town painted maps are mirrored.** When a chunk reaches past the map, the painting is drawn mirrored across the map edge into the out-of-map part. Before this, small dungeons (lighthouse_3 is 26 wide) showed a flat band in the "outside" colour next to the painting, or a seam against tile-baked walls. Town maps are unchanged.

**Guide and prompt lessons** (guide symbols get copied literally):
- Vertical stripes on faces came back as wooden palisades. Use a few horizontal strata and say "raw cave rock, not bricks or a dry-stone wall".
- A flat dark wall-top colour came back as flat black (lighthouse gen1). Masonry block lines on the wall tops give textured stone.
- Crossed strokes for root knots came back as X-marked crates (elder_1 gen1). Use an irregular dark blob. `process.py STAMP=roots` also puts the engine's roots sprite on static `roots` cells over a floor clone.
- Circles per forest cell work: at full size the model paints a varied canopy.
- Rounder, prettier results (elder_1 gen2) can cut the room corners and thin the 2-wide corridors. Prefer the one that keeps the grid.
- Generate one image at a time and regenerate only when the result is actually wrong (owner, 2026-09-28).

**Results (demo dungeons, 15 images in all):**

| Map | Painting | Size, px/tile | Live regions | Notes |
|---|---|---|---|---|
| well | `cave/under/well` gen3 | 1728×1440, 48 | secret (26 cells) | gen1: flat, palisade faces. gen2: dry-stone look. gen4: a redundant candidate. Emit = crystal veins in the rock (`EMIT=cyan`). |
| lighthouse_1 | `lighthouse/under/lighthouse_1` gen2 | 1728×1536, 48 | – | The big door stays a sprite in the painted arch; cape, path and sea are painted. |
| lighthouse_2 | `lighthouse/under/lighthouse_2` gen2 | 1632×1440, 48 | secret (49 cells: bricked store room) | Thin walls: no block of wall is big enough to clone as a whole, so each cell is cloned from the nearest clean wall cell. |
| lighthouse_3 | `lighthouse/under/lighthouse_3` gen2 | 1248×1056, 48 | – | gen1 had flat black wall tops. |
| elder_1 | `tree_inside/under/elder_1` gen1 | 1872×1728, 36 | secret (32), root gate `forest_sw1` (4) | Root knots stamped (`STAMP=roots`). gen2 (rounder) was rejected. No @40 (52 × 40 > 2048). |
| elder_2 | `tree_inside/under/elder_2` gen1 | 1872×1728, 36 | root gate `forest_sw2` (4) | Stamped root knots. |
| verda_1 | `forest_dungeon/under/verda_1` gen1 | 1920×1664, 32 | secret (33: the hollow tree) | – |
| verda_2 | `forest_dungeon/under/verda_2` gen1 | 1920×1664, 32 | secret (32), vine wall (18), fawn trail (22) | The hut is painted (the engine skips buildings). Thickets: painted canopy clone plus a darkened bush sprite as the hint. |

Raw paintings and guides: `design/art_ref/gen/env/under/<map>_genN_raw.png` and `<map>_guide.png`. The working files are in `_tools/under/dungeon/<map>/`, and `shot_map.sh <map> x y out.png [js]` takes an in-game screenshot (the js can set flags or `RPG.Game.secrets` to show the open state).

**Snow (2026-09-28, `snow/under/*`):** snow_woods, peak_1, peak_top, icicle_1, icicle_2, aurora, frost_ship_1, frost_ship_2, plus the Yule interiors whose look clashed with the painted exteriors (yule_sonja ice dome, yule_brenda turf pit-house, yule_hunter tusk lodge, yule_jorn stone tower-house, yule_branch stone office, yule_base snow den) and the pass-inn towers (pass_inn_in, pass_inn_shop). Tools: `_tools/under/snow/dng/` (README in `_tools/under/snow/README.txt`). What differed from the demo pilot:
- The model drifted areas by up to ~1.5 tiles (not only rows), so `align.py` block-matches the painting to the guide and warps it locally before processing; `fitcheck.py` then lists cells where the painting and the collision disagree, and the map data got explicit fits (snow_woods firs/clearings, peak_1 pool rim, icicle_2 1 rock, aurora cliff corner, frost_ship_1 mast stumps, south bank and side columns).
- frost_ship_1: the deck is now a hull shape in the data (rounded stern, pointed bow, solid bulwark `R`, boarding plank as the only way up); two wreck stern-castles stand on the ice.
- Dynamic things stay sprites: chests, ice-crystal walls (`cond` props), the icicle_2 ice seal (crystals over the open painting), braziers, lamps, stairs. peak_1's secret wall and hidden room use the §8 closed layer.
- Interiors are `kind: 'interior'`: `chunks.js` does not mirror the painting outside them (`map.kind !== 'interior'`), and `process.py PAD=` pads the image to whole 8-tile chunks with the dark outside colour.
- Light without a sprite: a lit prop listed in `art.painted` keeps its light (props_light.js reads the objects) but loses its sprite. Used for the Yule great hearth (`copper_brazier` ×2 over the painted fire pit, the standing fire bowl is gone) and the pass-inn fireplace (`fireplace`).
