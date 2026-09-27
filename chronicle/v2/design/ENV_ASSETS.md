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
| Where tiles did not generate reliably | Not needed so far: all ground materials tiled cleanly after wrap-quilting. Painted per-map underlays were not used. |

## 2. Files

```
v2/assets/env/
  common/mat/<id>@24|32|40.png  + <id>.json        materials (ground, water, wall tops), derived: pier bridge deck ladder deep_water cliff wall_brick
  common/mat/face_<style>@24|32|40.png + face_<style>.json   rise faces: rock cliff stone brick wood moss bark cave
  common/props/<id>@24|32|40.png + <id>.json       props (frames side by side), variants <id>_v<n>
  harbor/props/…                                   harbour props (barrel crate sack bench lamp_post well stall board net bollard rowboat flower_pot, ship)
  <theme>/bld/<buildingId>@24|32|40.png, <buildingId>_emit@…png, <buildingId>.json
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
See §6 (updated at the end of the generation run).
