# Building an area of the abbey

Read `CONVENTIONS.md` first. This file is the contract for area files (`src/areas/<name>.js`).

## How an area plugs in

```js
(function () { const HD = window.HD; HD.areas = HD.areas || {};
HD.areas.nave = function (ctx) { const K = ctx.K, M = ctx.M, L = ctx.L; const B = ctx.batch();
  // build geometry with the kit, collect it per material, declare what is solid and what is floor
  B.add(M.stone, K.box(...), ...); B.build();
}; })();
```

The game calls every registered area once at start, then paints the ground, plants vegetation and computes where the
hero can walk. `src/areas/_example.js` is a small working example (shown only with `?probe=1`): read it.
Read the header comments in `src/core/kit.js`, `src/core/mat.js`, `src/core/tex.js` and `src/core/world.js`: every
function is documented there. Summary:

### ctx (from `world.js`)

- `ctx.batch()` → `B.add(material, geom, geom, [geoms]...)`, `B.build({cast, receive})`: merges per material into one mesh each. Use one or two batches for your whole area (few draw calls). Use a second batch with `cast:false` for tiny things that need no shadow.
- `ctx.add(object3D, {cast, receive})` for anything you assemble yourself (animated parts, instanced meshes, custom shader meshes).
- Collision: `ctx.block.rect(x0,z0,x1,z1)`, `ctx.block.circle(x,z,r)`, `ctx.block.seg(ax,az,bx,bz,halfThickness)`. Declare every wall, pier, column, tomb, bench: anything the hero must not walk through. Do not block doorways and arch openings that the hero walks through.
- `ctx.floor(x0,z0,x1,z1,h)`: a built walkable surface at height `h` (number, or `fn(x,z)` for stairs). The hero can step up or down at most 0.42 between neighbouring spots, so build real steps (≤ 0.3 each, each tread ≥ 0.5 deep) wherever levels change, and declare each tread (or a height function).
- `ctx.walk(x0,z0,x1,z1)` / `ctx.walkCircle(x,z,r)`: extra walkable ground at terrain height. The hero can otherwise only walk on the footpaths (`L.PATHS`) and on floors. Walkable ground is painted as trodden earth automatically.
- `ctx.heightAt(x,z)` terrain/floor height; `L.terrain(x,z)` bare terrain; `L.pathDist(x,z)` (< 1 on a footpath; keep solid things at > 1.4 so paths stay clear and readable).
- `ctx.light({x,y,z,color,intensity,distance,flicker})`: warm point light, no shadow. **Budget: the number given in your brief.** `ctx.glow({x,y,z,color,size,strength})`: additive halo sprite, cheap, use for every flame and lit pane.
- `ctx.spot({id,x,z,r,label,kind})` interaction prompt (`kind:'exit'|'look'|'read'`); `ctx.camZone({x,z,r,fall,pitch,dist,lift,pan})`; `ctx.onUpdate(fn(time,dt))` for animation.
- `ctx.plant(type, {...})`: ask for vegetation (trees, bushes, ivy on a wall face, grass clumps, fallen leaves): see the comment in `world.js`. You do not build plants yourself; a later pass does. Ask generously for ivy on ruined walls, weeds at wall feet, grass in floor cracks.
- `ctx.rng(seed)` deterministic random. Never `Math.random()`.

### Materials (`ctx.M`, from `mat.js`): no UVs needed

`M.stone` (grey-violet coursed ashlar: main walls), `M.stoneDark` (plinths, damp or shaded masonry), `M.stoneWarm` (finer warm ashlar),
`M.rubble` (irregular field-stone: boundary walls, cores of broken walls), `M.flag` (big flagstones), `M.cobble`, `M.paver`, `M.paverChecker` (church floor),
`M.slate` (roofs), `M.wood`, `M.woodDark`, `M.sand` (dressed pale stone without joints: trim, tracery, capitals, crosses, statues), `M.sandBlock`, `M.stonePlain`, `M.stoneDeep` (very dark stone),
`M.rock`, `M.iron`, `M.bronze`, `M.moss`, `M.earth`, `M.void` (the dark inside a doorway or window), `M.flame`, `M.lampGlass` (HDR emissive).
`M.make(canvasOrName, {color, mode})` for your own pixel texture (draw it with `HD.T.paint(w, h, (x,y) => [rampName, tone])`, 32 texels per unit), `M.emissive(hex, strength)`, `M.glass(canvas, strength)` for stained glass on a `W.pane`, `M.beam(hex, strength)` for additive light shafts on a `K.quad`.
The shader maps textures onto every flat face by itself at 32 texels per unit (walls: courses horizontal; slopes: rows run along the slope; floors: plan view). `K.tint(geom, grey)` darkens or lightens one piece (0.8 … 1.15) for variety and depth: use it a lot, e.g. darker inside reveals and under overhangs, lighter on sunlit caps.

### Kit (`ctx.K`, from `kit.js`)

`K.box`, `K.boxc`, `K.poly` (prism on a plan polygon), `K.ngon`, `K.extrude`, `K.lathe` (turned profiles), `K.tube` (bent tapered tube), `K.spire`, `K.gable`, `K.steps`, `K.rock`, `K.chunk`, `K.rubble`, `K.quad`, `K.column`, `K.drum`, `K.arch` (pointed-arch outline), `K.archTop`, `K.ruin` (stone-by-stone broken top profile), `K.topAt`,
`K.wall(a, b, y0)` → `W.solid({t, h|top, holes})`, `W.box`, `W.archTrim`, `W.tracery`, `W.pane`, `W.buttress`, `W.pt`, `W.xz`, `W.put`; helpers `K.merge`, `K.tint`, `K.shade`, `K.xform`, `K.flat`, `K.wobble`, `K.flipWinding`.
The kit is a start, not a limit: write your own helpers in your file for anything it lacks (statues, crosses, finials, crockets, gargoyles, bell, iron gates, benches, fountains...). Faces must be wound counter-clockwise seen from outside (three.js default); if something renders inside-out or black, that is the cause.

## The map (three.js coordinates: x east, z south; north = -z; plateau ground y = 0)

See `HD.Layout` in `world.js` for the numbers. Overview (walking north from the bottom of the screen):

```
 z=-67 ......................... cliff edge (ragged, about z=-62.5), sea of clouds beyond, two moons in the north sky
        [bell tower]            [ nave: north wall with the great window ]      [lookout terrace on the cliff]
        x -18.6..-10.6          x -10..10, z -57..-29.6, floor y=0.6            x 12.5..26, z -63.5..-57.5
        z -58..-50               chancel (raised) north of z=-51.5               ^ east path ends here
 cloister garth x -27..-11, z -50..-32:                                      east graveyard (monks' plot)
   north arcade z=-47.4, pool (-19,-40), red tree (-23.6,-43.6)               x 3..26, z -56..-11.5, path runs up x≈19
 west graveyard x -26..-3, z -28..-11.5      approach (flagged)               mausoleum (21.5,-18), door south
 ======== boundary wall z=-10 ======== [ gate arch x -3.2..3.2 ] ======== boundary wall ========   walls also at x=±27.4
                                          hill steps x -1.75..1.75, z -8.5 (top, y 0) .. 3.5 (foot, y -6)
 forest on the slopes all round
```

Footpaths (`L.PATHS`, the only walkable ground besides floors): `approach` gate → church door (flagged, half-width 1.7);
`west` → cloister gap → pool; `east` → through the graves → lookout; `cloisterDoor` pool → nave side door at (-10.9,-40);
`tower` round the pool → through an arcade arch at (x=-22, z=-47.4) → tower door at (-14.6,-50); `mausoleum`.

## Looking at your work

```
node tools/shot.cjs "play?only=<your area>&at=<x>,<z>&k=1&shadow=1024&nopost=1&nosky=1&noveg=1" shots/<area>_01.png --wait 300
```

`/play` assembles the game from `src/` on every request. Each screenshot takes about 25 s. Useful switches: `only=a,b` (areas to build;
add neighbours to see joins, e.g. `only=nave,tower`), `at=x,z` (stand the hero there; the game camera follows him: fov 26, pitch 36° down, 36.5 away),
`free=px,py,pz,tx,ty,tz` (free camera position and target, for close inspection; add `&fov=40`), `walk=1` (green dots = where the hero can walk: check it!),
`noground=1`, `k=1|2` (960×540 or 1920×1080). Always pass `nopost=1&nosky=1&noveg=1`: those parts are being written by others right now and may be half-finished.
Other areas are being built at the same time in the same folder; a broken neighbour file only logs an error. Fix every console error that comes from your file.

Judge the picture from the **game camera** at several hero positions along the paths through your area (that is what the player sees), then use the free camera to check craftsmanship up close. Iterate many rounds. The bar: a player should want to stop and look.

## Rules of thumb for this look

- Build big forms first (mass, silhouette), then the second read (openings, buttresses, string courses, plinths, caps), then the small read (rubble, chips, props, lamp glow). Every wall gets a plinth or footing course standing proud, most get a cap or a broken top; openings get trim in `M.sand`; corners get quoins or buttresses.
- Ruin logic: walls break stone by stone (`K.ruin`), the fallen stones lie at the foot (`K.rubble`, `K.chunk`, `K.drum`), moss and ivy take the shaded side. Lean and tilt freestanding things a few degrees. Nothing is perfectly aligned.
- South faces are in shade (the key light is behind): make them read with pale trim, lamp glow, and the lit tops/rims of everything that projects. Avoid large blank dark faces.
- Keep it muted: stone is the main colour. Warm only where there is flame; one or two rust or blue accents at most.
- Tall things between the camera and a path hide the hero. The camera looks north from 30 units south and 21 above him: something of height h hides the ground for about 1.4·h north of it. Keep things south of and close to a path low, or open (arches, railings).
- Triangles: the budget in your brief. Check `HD.game.renderer.info.render` with `--eval`. Collision for every solid. Deterministic.
