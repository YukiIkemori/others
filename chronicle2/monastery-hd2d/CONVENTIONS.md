# 鐘のならない修道院 HD-2D 試作: shared conventions

Read this first. Every file in this folder follows it.

## What we are making

A browser demo of one map, "the abbey whose bell does not ring" (a ruined Gothic abbey on a hilltop at dusk, under two
moons: a white moon setting, a black moon rising). The method is **HD-2D** (as in Octopath Traveler): the world is real
3D drawn in real time with three.js, with pixel-art textures, soft light, shadows, depth of field and bloom, and the
hero is a 96-dot pixel-art sprite standing in it as an upright card. It is a command RPG field, so the player only walks.

The person judging this disliked an earlier attempt because "the buildings are rectilinear and the detail looks cheap"
and "the character and the background do not match in tone". So the two things that matter most:

1. **Rich, non-boxy architecture.** Pointed arches, tracery, buttresses with weathered offsets, string courses,
   columns with bases and capitals, round and polygonal forms, ragged ruin edges stepped by course and block,
   leaning/tilted/fallen pieces, rubble, layered depth (trim standing proud of the wall, recessed openings).
   Never a bare box with a texture. Silhouettes must be interesting.
2. **One tone for sprite and world.** All surfaces use pixel-art textures at the hero's dot size (below), from the
   shared palette ramps (`HD.P`), with near-black outline/mortar lines like the sprite's outlines.

3. **Muted, deep colour.** The person asked for "くぐもった色使い": hue and saturation that are too high read as
   Super Famicom. Aim for the restrained, filmic grading of modern HD-2D games: low saturation, deep violet-brown
   shadows, soft warm highlights, colour coming mostly from light (lamps, moonlight, stained glass) rather than from
   vivid local colours. Greens are olive-grey, reds are rust, blues are slate. Nothing candy-coloured.

## Stack and file rules

- three.js **r149**, global build: `vendor/three.min.js` (global `THREE`). No ES modules, no `import`, no bundler,
  no other libraries, no network requests. WebGL2 is assumed.
- Every source file is a classic script wrapped in an IIFE that attaches to the global `HD` (`window.HD = window.HD || {}`).
- Plain modern JavaScript. No external images: draw textures on a `<canvas>` in code.
- Do not edit files you do not own. If a shared helper is missing, write a local one in your own file and say so in your report.
- Legacy lighting (`renderer.physicallyCorrectLights = false`, the r149 default), no tone mapping. Colour textures use
  `texture.encoding = THREE.sRGBEncoding`. Materials: `MeshPhongMaterial` with `specular: 0x000000` (per-pixel Lambert)
  unless there is a reason. Never `MeshLambertMaterial` (per-vertex in r149) and avoid `MeshStandardMaterial` (cost).

## Space and scale

- Right-handed three.js space: **x = east, y = up, z = south**. North is **-z**. The camera always looks north and
  down (pitch about 36°, vertical FOV 26°, about 36 units from the hero) and never rotates. So faces whose normal points
  +z (south) and +y (up) are what the player sees; north faces are never seen (skip detail there, keep them closed for shadows).
- 1 unit is about 0.57 m. **The hero is 3 units tall** and about 1.2 wide. A door is about 4.2 high, 2.6 wide.
- **Texel density: 32 texels per unit** everywhere at the hero's depth (the hero is 96 dots tall = 3 units).
  Pixel textures are sampled crisp (nearest look). On a 1080p frame one texel is about 2 screen pixels.

## Light (see `src/core/light.js`, use `HD.Light.setup(scene, renderer)` in test pages)

- Key: the setting white moon, warm `#ffd6a8`, from the north-north-west and above (direction to light about
  (-0.40, 0.66, -0.64)). Shadows fall toward the camera and to the right. Ground and tops are lit; south faces are in
  shade, lit only by the fill and by local lamps. Design for that: put warm lamp light and bright trim where a
  south face must read; let rims and tops catch the key.
- Fill: the black moon, rose-violet `#b08cc8`, weak, from the south-east. Hemisphere ambient violet.
- Fog: `FogExp2('#3a2f4e', 0.0052)`. Local lights: warm `#ffb060` lanterns and `#ffc070` candles.

## Palette (`src/core/pal.js`, `HD.P`)

Ramps go dark to light: `stone` (cool grey-violet), `sand` (warm dressed stone), `slate` (roof blues), `grass`, `dirt`,
`wood`, `moss`, `autumn`, `water`, `iron`, `gold`, `glass` (a set), `sky`. `HD.P.ink` is the outline colour. Shadows lean
navy/violet, lights lean warm cream. Do not invent colours outside the ramps except for emissive glows.
`HD.rng(seed)` gives a deterministic random function (`r()`, `r.range(a,b)`, `r.int(a,b)`, `r.pick(arr)`);
`HD.hash2`, `HD.vnoise`, `HD.fbm` are 2D hash/noise. Never use `Math.random()` (results must be reproducible).

## Performance budget

Must hold 60 fps on a laptop with integrated graphics, and run on a phone. Whole scene: under about 350k triangles and
150 draw calls. Merge static geometry per material into few meshes; use `InstancedMesh` for repeated things.
No per-frame allocation. No shadow-casting point lights.

## Testing your work (headless)

A static server serves this folder on port 8765 (`node tools/serve.mjs 8765 &` if `curl localhost:8765` fails;
it is harmless if it is already running). Take screenshots with software WebGL:

```
node tools/shot.cjs "dev/yourpage.html?x=1" shots/yours_01.png --w 1280 --h 720 --wait 1500   # saves the WebGL canvas itself
```

The tool waits for `window.HD_READY === true` (set it when your first frame is drawn), prints console errors and
page errors (fix all of them), and takes `--eval "js"` and `--keys "ArrowUp:800"`. `require('playwright')` works from any
directory; do not install anything. Software WebGL is slow (a frame can take a second): that is not a performance signal.
**Look at your screenshots** (Read the PNG) and iterate until it looks good, not merely until it runs. Put screenshots
in `shots/` with your own prefix.
