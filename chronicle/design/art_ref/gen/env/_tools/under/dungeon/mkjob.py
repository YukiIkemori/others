"""Job for one painted DUNGEON underlay (generic). usage: python3 mkjob.py <map> <T> <name> [extra text]
refs: <map>/guide_<T>.png (the layout, traced) + a style reference crop of an approved painted town (style_rock.png / style_forest.png)."""
import json, sys, os
m, T, name = sys.argv[1], int(sys.argv[2]), sys.argv[3]
extra = sys.argv[4] if len(sys.argv) > 4 else ''
d = json.load(open(m + '/layout_data.json'))
W, H = d['w'], d['h']

CAVE_KEY = """- dark purple-grey = the SOLID ROCK of the cave seen from above (not walkable): rough dark rock tops with cracks, a few pale roots hanging in from above, damp patches, and here and there a small vein of faintly glowing pale-blue crystal (few, small, only inside the rock).
- grey-brown bands = the VERTICAL ROCK FACES of the cave walls facing the viewer (south): natural rough limestone cliffs with ledges, cracks, strata, small stalactite drips and wet streaks, moss and pebbles at the foot, a lit lip along the top edge (NOT wooden planks or a palisade); each face is exactly as tall as its band and its foot ends exactly on the floor edge below it."""
TOWER_KEY = """- dark slate = the thick MASONRY of the lighthouse walls seen from above (not walkable): the dark top of old grey stone walls, mortar lines, a little moss and salt stain.
- light grey brick bands = the VERTICAL FACES of those stone walls facing the viewer (south): dressed grey stone blocks of old solid masonry, some chipped, salt-stained, a little moss at the foot, with a lit lip on top (NOT a fence), exactly as tall as the band, the foot ending exactly on the floor edge below."""
BARK_KEY = """- dark brown = the SOLID LIVING WOOD of the colossal tree around the hollows (not walkable): seen from above as dark, deeply furrowed heartwood and bark with knots, moss, small shelf fungi and a few faintly glowing blue-green mushrooms growing in the cracks.
- lighter brown bands = the VERTICAL WALLS of living wood facing the viewer (south): a natural wall of fibrous, furrowed living bark and grown-in roots (NOT planks, NOT a fence), with a lit lip on top, exactly as tall as the band (one tile), the foot ending exactly on the floor edge below."""

MAPS = {
    'well': ('THE TRAVELLERS\' OLD WELL: beneath a dry well at a fork in the road lies a small, surprisingly wide natural limestone cave: a winding chain of chambers and narrow passages, damp and cool, with moss, roots from the fields above, drip stones and puddles. A family of jewel rabbits nests in a flowery hollow at the south-east.', 'rock', CAVE_KEY + """
- grey-blue = the walkable CAVE FLOOR: varied and natural: packed damp earth, patches of worn flat flagstones and gravel, small puddle stains, drip marks, tufts of pale moss and tiny mushrooms along the wall feet, slightly darker and damper near the walls (FLAT, no rocks standing on it).
- blue = a small still POOL of clear water at the bottom of the well (not walkable), with a pale stone rim.
- plain green = a soft carpet of MOSS on the floor (walkable, flat).
- green with pink dots = the jewel rabbits' NEST: a sunken hollow of short grass and tiny pink and white wild flowers (walkable, flat)."""),
    'lighthouse_1': ('THE PHAROS LIGHTHOUSE, GROUND FLOOR, seen from above with its roof taken away (a cut-away): the great square stone base of an old lighthouse on a grassy headland in the night sea. Inside, stone partition walls divide the ground floor into old storerooms of the lighthouse keeper with warm wooden plank floors.', 'rock', TOWER_KEY + """
- warm brown with lines = the wooden PLANK FLOORS of the storerooms (walkable): long worn planks running left-right, nail heads, scuffs, a few loose boards (FLAT).
- red = a faded red woven RUG lying on the planks (flat).
- the black arch in the middle of the long south wall = the tower's MAIN DOORWAY: paint a sturdy arched stone door frame with a dark recess exactly there (a wooden double door is added later on top).
- green = the grassy HEADLAND outside (walkable): short wind-bent grass, clover, a worn footpath from the doorway straight down to the bottom edge; pink dots = small wild flowers.
- dark blue = the SEA around the headland (not walkable): deep blue-green water with small waves and white foam where it meets the low rocky shore of the headland."""),
    'lighthouse_2': ('THE PHAROS LIGHTHOUSE, SECOND FLOOR, seen from above with the floor above taken away: a spiral of three concentric ring corridors inside the round-ish stone tower, divided by thick stone walls; wooden plank floors; a bricked-up old store room at the south.', 'rock', TOWER_KEY + """
- warm brown with lines = the wooden PLANK FLOORS of the ring corridors (walkable): long worn planks, nail heads, scuffs (FLAT)."""),
    'lighthouse_3': ('THE PHAROS LIGHTHOUSE, LAMP FLOOR, seen from above with the roof taken away: a small antechamber with plank floors in the south, and to the north the round LAMP ROOM where the great lamp stands on a round raised dais covered by a red cloth.', 'rock', TOWER_KEY + """
- warm brown with lines = the wooden PLANK FLOORS (walkable): worn planks, nail heads (FLAT).
- red = the round DAIS of the great lamp covered with a faded red cloth and a brass rim (flat on the floor; the lamp itself is added later, leave the middle of the dais empty)."""),
    'elder_1': ('INSIDE THE THOUSAND-YEAR TREE, LOWER TRUNK: the colossal elder tree of the forest is hollow inside; round chambers carved by nature out of the living wood are linked by corridors of old roots, spiralling around the heartwood towards the core of the trunk.', 'forest', BARK_KEY + """
- warm tan-brown = the walkable FLOOR of the hollows: smooth, polished living wood with swirling growth rings and grain, a few fallen leaves and sawdust (FLAT).
- grey-brown with a line = CORRIDORS OF ROOTS (walkable): a floor of thick old roots grown flat and worn smooth by feet, packed earth between them (FLAT).
- dark brown with thick crossing strokes = KNOTS OF TANGLED THICK ROOTS standing up from the floor (not walkable), gnarled and mossy."""),
    'elder_2': ('INSIDE THE THOUSAND-YEAR TREE, THE ROOT HALLS: deep under the trunk, among the great roots: hollows of packed earth and roots, a cut-open chamber showing old growth rings, a quiet antechamber of smooth wood and, deepest in the south, the ROOT ALTAR where the forest lord sleeps.', 'forest', BARK_KEY + """
- warm tan-brown = smooth polished living WOOD FLOOR with growth rings (walkable, FLAT).
- grey-brown with a line = FLOORS OF ROOTS AND PACKED EARTH (walkable): thick flat roots worn smooth, damp earth between them (FLAT).
- dark brown with thick crossing strokes = KNOTS OF TANGLED THICK ROOTS standing up from the floor (not walkable).
- blue = a small POOL of dark water seeping among the roots (not walkable)."""),
    'verda_1': ('THE LOST FOREST (VERDA), FIRST PART, AT NIGHT-TIME BUT PAINTED AS ALBEDO: an old, dense, enchanted forest; small grassy clearings linked by winding dirt paths through deep woods; a travellers\' camp clearing in the middle; a mossy old hollow tree in the south-west.', 'forest', """- dark green circles = the DENSE OLD FOREST seen from above (not walkable): a thick unbroken mass of big broad-leaf and fir tree crowns, layered, with deep shadows between crowns (painted flat as albedo), a few trunks and roots visible only at its edges.
- mid green circles on a clearing = single big TREES standing in a clearing (not walkable, crown within its tile and a little over).
- light green small circles = low BUSHES (not walkable).
- green = grassy CLEARINGS (walkable): short grass, clover, tiny flowers, fallen leaves (FLAT).
- darker green with strokes = TALL GRASS and ferns patches (walkable, low).
- olive green = MOSS-covered earth (walkable, flat).
- green with pink dots = a patch of wild FLOWERS (walkable, flat).
- pale tan = the old main PATH (walkable): packed pale earth, some flat stones.
- brown = narrow DIRT TRAILS (walkable), soft natural edges.
- blue = a small STREAM or pond (not walkable); light blue = a shallow ford of pebbles (walkable)."""),
    'verda_2': ('THE LOST FOREST (VERDA), DEEP PART: the old, dense, enchanted forest near the thousand-year tree; clearings linked by trails, a stream crossing the west, a small abandoned log hut with a mossy roof in the dark northern clearing, and at the very north the trail leading on towards the great tree.', 'forest', """- dark green circles = the DENSE OLD FOREST seen from above (not walkable): a thick unbroken mass of big broad-leaf and fir tree crowns, layered (painted flat as albedo), trunks and roots visible only at its edges.
- mid green circles on a clearing = single big TREES in a clearing (not walkable).
- light green small circles = low BUSHES (not walkable).
- green = grassy CLEARINGS (walkable): short grass, clover, tiny flowers, fallen leaves (FLAT).
- olive green = MOSS-covered earth (walkable, flat).
- green with pink dots = a patch of wild FLOWERS (walkable, flat).
- pale tan = the old main PATH (walkable): packed pale earth, some flat stones.
- brown = narrow DIRT TRAILS (walkable), soft natural edges.
- blue = a STREAM (not walkable); light blue = a shallow pebbly ford across it (walkable).
- the small box with a green top and brown front = a small ABANDONED LOG HUT: a mossy turf roof seen from above and its log front wall with a closed shutter (no door)."""),
}
title, style, key = MAPS[m]
cell = T * 48 // 32   # character height in output px ~ 1.5 tiles
P = f"""Paint the COMPLETE top-down map of a fantasy JRPG DUNGEON as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG map view (walls seen from above with their south-facing vertical faces showing, like a classic JRPG dungeon; NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

THE PLACE: {title}

The FIRST attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output, output is {W * T} x {H * T}). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data. Keep the exact outline of every room and passage, including the one-tile-wide ones and small dead ends.

The SECOND attached image is only a STYLE REFERENCE from the same game: match its pixel-art rendering (pixel size, clusters, outlines, colour ramps, level of detail). Do NOT copy anything from it (no houses, no paths, no objects from it).

The guide is flat colour-coding only: do NOT copy its flat colours, straight tile steps or stripes. Interpret every area as the real material with rich natural variation and texture, and give the rock and wall edges a natural, slightly irregular outline (bulging or receding by at most a quarter tile around the guide edge).

Guide colour key:
{key}
Walkable areas must stay walkable-looking: no boulders, pillars, trees or furniture standing on them.

Make it rich, detailed, handcrafted and cohesive, with the mood of a {'quiet, damp, ancient place' if style == 'rock' else 'deep, old, enchanted wood'}.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it at runtime and adds torchlight on top). Neutral, soft, even light as in the style reference; NO darkness, NO cast shadows longer than a few pixels, NO light pools, NO glow halos, NO vignette, NO fog.
Do NOT paint any characters, animals, monsters, treasure chests, stairs, ladders, holes, lanterns, torches, braziers, candles, standing crystals, barrels, crates, sacks, furniture, bookshelves, tables, signs, statues, tents, campfires, logs, stumps, text, labels, grid lines or UI. Those are added later as separate sprites: leave the floor open for them.
""" + extra
job = {"out": os.path.abspath(f'{m}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{m}/guide_{T}.png'), os.path.abspath('style_%s.png' % style)], "tag": f"{m}_under"}
json.dump(job, open(f'{m}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'])
