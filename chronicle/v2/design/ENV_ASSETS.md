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

Roa doors (2026-09-28): the model painted the guide's black door marks as black empty doorways on every house except the hall (which got a wooden door). The engine does not draw building sprites on a painted map, so the houses looked doorless. `_tools/under/roa_doors.py` finds each black doorway on the door tile and paints a closed plank door in the same painting's wood (taken from the hall's door) with two iron bands, a ring handle and a lintel shadow, at @24/@32/@40. It skips doorways that are already painted. A new painted map should ask the prompt for closed wooden doors, not black recesses.

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

Loch (`moss_village/under/loch*`, 56×52, 2026-09-28, marsh region): a lake town on stilts. Crooked boardwalks wind between peat islets over a shallow lake; a deep canal crosses the town with one humped stone bridge and a pole ferry. The strange big building is a colossal fallen bronze bell lying on its side at the north, its mouth boarded over, holding three shops with their own 1-tile doors (item shop, tavern 「鐘の腹」, arms). Also: an assembly hall under a heron-wing reed roof, a square stone bell tower, six single-stilt bell towers in the lake (seven in all, the south-east one new), the inn as a ring of moored barges, the mayor's house in a willow's roots, a leaning doll-maker's house, a cold stone records outpost, a night-market raft. The folder is the map's theme (`moss_village`) so it is in the boot preload. Tools in `_tools/under/marsh/loch/` (`guide.py` from a node dump of the map → `mkjob.py` → `gen_env.py` → `process.py`, `run.sh`). 1 generation at 36 px/tile (2016×1872), chosen (`under/loch_gen1_raw.png`); the painting sat ~8 px low (`DY=-8`), doors within 12 px, and the bell tower's data was moved one tile west to match the painting (no door surgery). Three islet cells painted as water were set to water in the data.

Marsh dungeons (§8 form, 2026-09-28): the Mist Manor floors (`lighthouse/under/manor_1*`, 48×40; `manor_2*`, 48×36; 40 px/tile, 1 generation each, no shift) and the Bog of the Sunken Bells (`forest_dungeon/under/bog*`, 60×52, 1 generation at 2048×1776). The bog is painted in the open state (all three bells rung: the mud causeways out of the water); `bog_closed@t.png` is RGBA, opaque only on the causeway cells, filled with water texture sampled from the painting, and `bog.json` has `live: [{cells, patch: 0}, {cells, patch: 1}]` for the two tilePatches that raise the causeways (`cond` = the bells). Tools in `_tools/under/marsh/{manor,bog}/` and `_tools/under/marsh/process_dun.py`. Note: an RGB (fully opaque) closed layer made the headless browser crash at boot; keep it RGBA with transparent pixels zeroed.

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

**Desert (2026-09-28, `desert/under/*`):** hawks_1, hawks_2, temple_1, temple_2, tomb_1, tomb_2, tomb_3, rocks, oldcamp, wellroom, plus the Kasim and Sandedge interiors, painted to match the new exteriors (`kasim_inn` whitewashed mud domes, `kasim_tavern` inside the toppled jar, `kasim_shop` / `kasim_mapshop` / `kasim_fortune` stone rooms in the colossus plinth, `kasim_guild` the beast's ribcage, `kasim_abul` rock-cut, `kasim_digger` mud-brick dome, `sandedge_inn` the petrified tree's hollow). Tools: `_tools/under/desert2/` (the demo tools adapted: `fullmap.js` dumps several maps in one browser, `guide_dg.py` = `guide.py` with desert colours and textured wall tops, `mkjob.py` with a crop of the painted Kasim as the style reference `style_desert.png`, `process_dg.py` = `process.py` plus the quicksand closed look). What differed:
- **Alignment, map by map.** Always compare the raw painting (`align.py` with no warp) against the collision grid first (`check.py`). temple_1 gen2 was pixel-exact raw, and the automatic warp made it worse. `warp2.py` (row/column DTW) + `flow.py` (block matching of the floor mask, smoothed) fixed tomb_1, tomb_2, tomb_3, temple_2, hawks_1, hawks_2 and rocks, which had drifted by up to about 1.5 tiles. oldcamp was a plain one-tile shift (`warp_shift.json`). The rooms use `roomwarp.py`, which maps the painted wall feet and rug edges onto the grid. `cellclass.py` / `fitcells.py` give an ascii per-cell comparison.
- **Quicksand (tomb_2).** The painting shows the open state, plain sand. The closed look for the `desert_worm` tilePatches is the painted sand darkened and wetted, with spiral sink bands, only on sand-coloured pixels (`process_dg.py` `quicksand()`).
- **Secret room (tomb_1).** Uses the §8 closed layer. The painted black recess of the sealed door was patched with a wall face (`EXTRA_PATCH`); the door sprite stays on top. For temple_1 the prompt asked for a carved sun gate instead of a black recess (`DOORTXT`).
- **hawks_1** came back with a flat wall-top colour. `toptex.py` adds the tile render's rock texture as a high-pass on wall-top cells (`TOPTEX=0.7`).
- The rooms are padded to whole chunks (`PAD=1`, `pad.py`); otherwise the light multiply turns the transparent area below a small room white.
- Images: 20 generations in all, one per map except temple_1. temple_1 gen1 was rejected, but its pillar row was lost to my warp, not to the model; the raw gen1 was fine. Five small-room calls were rejected as too small (768×640 is under the model's minimum pixel budget; 12×10 rooms now use 80 px/tile, which gives 960×800). Emit: none. Torches, braziers and lamps stay sprites and keep their lights.

### Ash region (r_ash, 2026-09-28)

Three paintings in `assets/env/ash/under/`, one `gen_env.py` call each, no retries: `caldera` (town, 54×54, generated 1728² = 32 px/tile), `ash_volcano_1` (56×48, 1792×1536, with a `_closed` layer for the two lava crossings) and `ash_volcano_2` (crater, 44×36, 1408×1152). `caldera_arena` and the interiors stay tiled (budget). Decorative props were drawn by the guide/prompt, so the maps keep only functional sprites (braziers, levers, board) and the invisible `lava_glow` light (`art.painted`).
- Town: the painting's rings did not match the generated ring grid, so the map rows were fitted to the painting (`FIT` rows in `ash_caldera.js`); a few buildings painted a tile off their door were moved as whole 16 px blocks (`SHIFT` in the scratch `process.py`).
- Emit: warm window panes + molten lava pixels. On the crater the dark crust inside the lava lake turned teal under the cave's cool light, so the crust on lava cells is also in the emit layer (warm, alpha 150).
- Closed layer: the lava texture is tiled from 64 px blocks that are entirely lava, so no bank edges show on the crossing cells. The crossings use the `{cells, cond}` form (`!ash_sluice` / `ash_sluice`); the tiles themselves change by `tilePatches` with the same conds.

## 9. Props painted into the paintings, and themed functional sprites (2026-09-28, demo slice)

The owner found the small props on the painted maps "floating" and wrongly sized (「小物…明らかに浮いてない？サイズ感全然合ってないし。」). The props were separate generated sprites with flat light, a harder pixel style and no contact shadow, laid over a softer painting. Plan A+B was approved on two conditions: **edit the existing paintings, do not regenerate the maps** (「ベースはもうあるからソレ使ってね？もったいないから」), and generate with the OpenAI API. The budget is limited (「節約できるところは節約してね」), so every call covers a whole cluster of props.

**Scale check.** On a painted map, sprites are not mis-scaled by the engine. The painting is box-downscaled to @24/@32/@40 (`T.Env.under(key, tile)`), and a sprite is drawn from its own @tile image (`E.prop` → `envProp`), so both are at t px per tile. The mismatch came from how the sprites were drawn (flat, outlined, no shadow), not from the renderer. `props.js` scaling is therefore unchanged.

### A. Paint decorative props into the painting (`_tools/propfix/`)

1. `node dump.js` writes `maps.json` (objects, grid and art of the scope maps).
2. `classify.py` sorts each prop:
   - **Decorative** (painted in): barrel, crate, sack, flower_pot, planter, net, hay, stump, log, rock_small, rock, fern, reeds, bench, table, chair, bush, bollard, rowboat, grave, tent, bookshelf, tree_giant, well.
   - **Kept as sprites**: every other id (lamps, lanterns, braziers, torches, crystals, glowing mushrooms, songstones, boards, stalls, ships, stairs, doors, chests, springs); any prop with a `cond` or `lv`; any prop within one tile of a `K.exam` target; any prop on or next to a closed-layer `live` cell (secrets, tilePatches); ids already in `art.painted`.
3. `windows.py` and `mkjob.py` greedily cover the decorative props with edit windows of 32×21, 21×21 or 21×32 tiles. A prop must be at least 1.5 tiles inside the window. A window with fewer than 3 props, or with only tiny stones, is not worth a call, and its props stay sprites (`plan.json` `leftover`). The model input is the current @32 painting with **only that window's decorative sprites** composited, upscaled ×1.5 to 48 px/tile (the paintings' native generation scale: 1536×1008, 1008×1008 or 1008×1536). The prompt lists the objects with a natural size in tiles for each, and asks for: the same place and footprint, a natural size, the painting's upper-left light, palette and brushwork, a soft contact shadow, everything else unchanged, nothing removed, no light effects. One `gen_env.py` call per window (quality high, 1 reference = the crop).
4. `apply.py <map> <k>` composites the edit back:
   - **Alignment**: the model sometimes reframes the crop slightly (up to about 2 % zoom and 7 px). A scale and offset are fitted on normalised luminance away from the props.
   - **Colour**: per-channel moment matching away from the props. A least-squares fit underestimates the gain on re-rendered texture.
   - **Did the model paint it?** For each prop, the change inside the sprite box is divided by the change in a ring around it. A ratio below 1.6 means the spot was left empty; that prop is not masked, and it stays a sprite.
   - **Mask**: the sprite box + 5 px (+3 px below for the shadow), Gaussian-feathered. The edit is resampled for each tile size (24/32/40) with the same warp and blended in place. Outside the masks the painting stays pixel-identical.
   - The untouched paintings are kept in `work/orig/` and the results are recorded in `applied.json`.
5. **Review is required.** `contact.py <map> out.png` shows old sprite | new painting, 3×3 tiles per painted prop. The ratio test misses some removals (a sack at 1.93 had been erased) and flags some real paintings as removed (Yura's graves at 1.6). Fix with `apply.py … id@x,y` (force keep), `--all` (after a visual check), or `revert.py <map> <id> <x> <y>` (copies the original pixels back and keeps the sprite).
6. `mark.py` writes the painted props into the map's `art.painted` as `'id@x,y'` entries (plain ids keep their old meaning, "every prop of this id").
   - `chunks.js` skips a sprite whose id **or** `id@x,y` is listed.
   - The object stays in the data, so collision (and the town clutter rule in `collide.js`), density counts, light pools (`props_light.js` reads objects) and interactions are unchanged.
   - The painted object sits on the same tile as its collision.
   - A lit prop (e.g. a table with a candle) keeps its light without its sprite, the same trick as the snow hearth.

**Density tests**: `test_content_p` / `test_content_f` / `check_density` count objects, and painted props are still objects, so no test change was needed (roa median 35, pharos median 25).

### B. Themed functional sprites (`sheets.py`)

- Each set is **one sheet** generated with one call. The style reference is that region's first edited window (`propfix/<map>_w0.png`, which shows the painting and painted-in props at the right scale). The background is transparent. The sheet is cut with `proc_props.grouped/reading_order`.
- `sheets.py cut <set>`:
  - `pixelize_sprite` with 32 colours and **no dark outline** (the outline was part of the stuck-on look).
  - Height = the old sprite's @32 height, so light anchors and footprints are unchanged; width is capped at 115 % of the old sprite.
  - A **baked soft contact shadow**: an ellipse under the base, offset to the lower right for the upper-left light, alpha 0.45 for soft props and 0.28 for solid props (the engine adds its blob under solid props too). Stairs get none.
  - `light32` is scaled from the base sprite.
- Files: `assets/env/<folder>/props/<id>__<set>@24/32/40.png` + json (`set`, `base`).
- Lookup:
  - Map theme → set is `PROP_SET` in `props.js`: harbor→harbor, hill_village→village, treetop and moss_village→forest, forest_dungeon and tree_inside→wood, cave→cave, lighthouse→lighthouse. `map.propSet` overrides it.
  - `T._propSet` (called by `planOf` in `chunks.js`, one line) adds `opts.set` to the plan items and dyn items whose id has a `<id>__<set>` image.
  - `bakeProp` then prefers `T.Env.prop(id + '__' + set)`. Hd caches per opts, so each set bakes separately.
  - `<id>__<set>` ids are not registered as placeable props.
  - Other regions and ids are unaffected. Chests stay common: they are meant to stand out on every floor (WORLD_REDESIGN §6.3).

### Applying this to another region (desert, snow, marsh, ash…)

Add the maps to `dump.js`, then run the pipeline: `node dump.js` → `python3 mkjob.py <maps>` → `gen_env.py work/jobs.json` → `apply.py` per window → `contact.py` review (+ `revert.py`) → `mark.py`. Then add a set to `sheets.py SETS` and to `props.js PROP_SET` → `sheets.py jobs <set>` → `gen_env.py work/sheet_jobs.json` → `sheets.py cut <set>` → build.
- Extend `classify.DECOR` if the region has its own decorative ids (desert `clay_jars`, snow `firewood`…).
- Delete `work/` afterwards; keep `plan.json`, `applied.json` and the raw edits.

### Results (demo slice)

| Map | Windows | Painted in | Still sprites (all ids) | …of which decorative |
|---|---|---|---|---|
| roa | 3 | 18 | 24 | 10 (a ring of 6 small stones and 1 bench the model erased, 1 flower pot, 1 ghosted barrel reverted, 1 stone) |
| pharos | 5 | 48 | 40 | 4 (next to an exam target, or in a window below 3 props) |
| fern | 5 | 52 | 71 | 5 |
| yura | 1 | 8 | 27 | 5 (2 reeds, 2 graves, 1 reed next to the stone) |
| well | 1 | 11 | 19 | 1 |
| lighthouse_1 | 2 | 45 | 13 | 2 |
| lighthouse_2 | 1 | 22 | 23 | 2 (+6 on the bricked store room's live cells) |
| lighthouse_3 | 1 | 7 | 9 | 0 |
| elder_1 / elder_2 | 0 | 0 | 28 / 24 | 6 / 3 small stones (not worth a call) |
| verda_1 | 3 | 14 | 27 | 5 (the camp tent, sack and crate were erased by the model, so they stay sprites) |
| verda_2 | 3 | 14 | 19 | 0 (the giant tree is now painted) |

"Still sprites" counts every drawn prop except fireflies and ids already in `art.painted` (Roa fences, Fern roots). Total: **239 props painted in**, 25 window edits.

Themed sheets, one each: harbor (lamp_post, lantern, board, stall, signboard, flower_pot, barrel, crate, bollard), village (lamp_post with a hanging lantern, lantern, signboard, mushroom_glow), forest (lantern, mushroom_glow, board, signboard, stall, reeds), cave (crystal, mushroom_glow, stairs_up, grave, signboard), lighthouse (lantern, lamp_post, stairs_up, stairs_down, crate, barrel, sack, table, signboard), wood (mushroom_glow, crystal, lantern, stump, log, rock_small, signboard).

API: 31 successful calls (25 windows + 6 sheets; the log counts 35 images because some sheet calls returned 2). The proxy dropped many long sheet requests (`RemoteDisconnected`, 28 retries), and those do not appear in the spend log. If this happens again, run the sheets with `GEN_PAR=1`.

Raw edits and sheets: `design/art_ref/gen/env/propfix/`, each with `.gen.json`. Plan and results: `_tools/propfix/plan.json`, `applied.json`. The untouched paintings for `revert.py` are in `_tools/propfix/work/orig/` (69 MB; delete once the owner has approved).

Not done yet:
- chests, doors, the lighthouse beacon, braziers, torches (frames), ships and songstones keep their old sprites;
- the town interiors are tile-built (no painting), so A does not apply to them;
- desert, snow, marsh and ash, which follow the same method.

## 10. Area-switching field (2026-09-28, demo scope)

The owner replaced the walkable world map with **field areas**: each area is one rectangular painted map (`kind: 'field'`, `maps/field_*.js`), and walking off a road at an area's edge fades into the neighbouring area. Borders need not match; exits line up and the biomes roughly agree. The old world map stays in the build for the regions outside the demo; the world-map screen (X) still shows the old world picture and places the player inside an area through `meta.worldRect`.

**Engine** (small): `maps/field_00_kit.js` (`R.FieldArea.def`, the shared legend, defaults: night light, BGM `overworld`, `art` = `field/under/<id>`, prop set village/forest; a data hook rewires every "to world" exit of Roa, Pharos, lighthouse_1, the well, the hut, Fern and Yura to its area through `LINKS`, so those map files are unchanged; the three demo passes lead into the old world at `f_cross_e` / `f_south_s` / `f_windhill_n`, and the old world's pass cells lead back). Contract kind `'field'`, terrain theme `field`, wayfind exit labels on field maps, and the map screen position (`screens/map.js`). Encounters use the zw_* tables through `zones` at the world rate (`K.ENC.world`). The lamp quest event reads the lamp from `ctx.map`.

**Areas** (identity, size, generations):

| id | name | size | identity | images |
|---|---|---|---|---|
| f_roa | ロアの丘 | 52×40 | early-summer sheep downs: a walled knoll of standing stones, the travellers' old well (well dungeon), a giant oak, a creek under an arched stone bridge, an old windmill, a pasture | 1 |
| f_cape | 灯台の岬 | 56×44 | windswept cape: sea cliffs, sea stacks, a sandy cove with the chest, a round ruin, the harbour gatehouse, the lighthouse on the tip (door → lighthouse_1) | 1 |
| f_lookout | 見晴らし台 | 48×40 | purple heather heath: the drawbridge on stone piers (raised until `prologue_done`: tilePatch + `_closed` layer), a walled bluff with the lookout tower, birches, a shingle beach | 1 |
| f_cross | 北の野 | 60×40 | golden late-summer plains: the three-way crossroads, the coaching-inn ruin, a lake with a jetty (chest), a wagon, the eastern pass (rockslide in the demo) | 1 |
| f_hut | きこりの野 | 52×40 | logging clearing: the woodcutters' cabin (→ hut), a waterfall over a rock step, a log bridge, stumps, a shrine | 1 |
| f_fern | 森の街道 | 56×44 | deep emerald forest: colossal buttress-rooted trees, Fern's root-arch gate, a ravine with a rope-railed bridge, a fairy ring (chest) | 1 + 1 edit (the east road continued to the edge) |
| f_south | 森の南 | 56×48 | golden autumn glades: the old forest tower, the stone-pillar ring, the twin watchtowers, a brook with stepping stones, the red sandstone pass south (rockslide) | 1 |
| f_windhill | 風鳴りの丘 | 52×44 | silver-green windy downs: a ringed bald hill with humming holed stones, a tarn, a fallen colossus, the northern pass (rockslide), Yura's road | 1 |

9 images in all (8 areas + 1 edit), one at a time.

**Tools** (`design/art_ref/gen/env/_tools/under/field/`): `areas.py` (layouts: noise-shaped regions, spline roads and rivers, landmark marks, exits, objects, meta) → `guide.py` (colour guide at 48 px/tile) → `mkjob.py` (per-area scene prompt + the guide + `style_field.png`, a crop of the painted Roa and Pharos) → `gen.sh` (one `gen_env.py` call; the stored `.gen.json` says `generated` for the model) → `fit.py` (the collision fitted to the painting: a per-cell classifier seeded from the layout or from colour rules `rules.py`, then `<id>/fix.json` hand fits read off `check.py` pictures, unreachable pockets closed) → `process.py` (brightness matched to Roa's grass, canopy overlay over the row north of trees, `_closed` layer for tilePatches as `{cells, cond: {not: cond}}`) → `tomap.py` (writes `v2/src/maps/field_<id>.js`; moves objects per fix.json, puts lamps beside roads). `apply_edit.py` composites one box of an edited painting back (scale/shift fitted on a ring). `shots.js` takes in-game screenshots.

**Tests**: `tools/test_field_areas.js` (in `check_all`): shape, every exit/door/stair lands on a walkable spawn, everything reachable in each area, no rewired "to world" exit left, and Roa → Pharos / lighthouse / well / Fern / Yura / hut without passing through the old world.

**Next** (not done): the world-map screen could draw the areas instead of the old world picture; areas for the regions beyond the passes (snow, desert, mines, marsh, ash) would replace the old world there too.

## 11. Parchment world map (map screen, 2026-09-28)

The map screen (X in a field area, or the menu's 地図) draws one painted **old parchment chart** of the whole continent (`assets/env/world/under/parchment@32.png`, 2048×1536, no text in the image; packed as its own lossy WebP group) instead of the old world thumbnail. It was generated once, with a biome guide made from the old world grid (`design/art_ref/gen/env/_tools/worldmap/guide.py` → `gen1.job.json`). The model kept the guide's layout, so the default transform (world cell → painting px: ×2.6667, +128 px) places everything; `src/data/worldmap.js` also has `anchors` and `areas` for hand fixes (empty so far) and the fog circles per region.

Screen (`screens/map.js` `drawParchment`, keyboard/gamepad): opens zoomed ×1.9 on the current position; arrow keys pan (dash = faster), L/R (Q/E) and the mouse wheel zoom (×1 to ×4). Overlays: ink names with a paper stroke for visited field areas, towns (red diamond) and dungeons (dark dot), the pinned lead, and a pulsing red arrow for "you are here". Regions not visited yet get a parchment-coloured fog; locked demo regions a denser one. The old picture is still used when the painting can't load. Tests: `tools/test_worldmap.js` (node: table, markers inside the picture for every demo area/town/dungeon, fog per region; `--browser`: opens the map in areas/town/dungeon, no console errors).
