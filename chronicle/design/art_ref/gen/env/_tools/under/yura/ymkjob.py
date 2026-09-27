import json, sys, os
name = sys.argv[1]
extra = sys.argv[2] if len(sys.argv) > 2 else ''
STYLE = os.environ.get('STYLE_REF', '')
P = """Paint the COMPLETE top-down map of a tiny, strange hidden village in a deep forest hollow as ONE finished game map image, in rich premium hi-bit pixel art""" + STYLE + """ (flat top-down JRPG town map, NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D).

The attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a 30 x 28 tile grid (each tile = 64 x 64 px of the output, output is 1920 x 1792). Every shape in your painting must sit exactly where it is in the guide, at the same size: this image is used directly as the walkable game map, so positions are collision data.

THE VILLAGE: "Yura", a riverside mill hamlet where people who lost their names live. It must look UNUSUAL and unlike an ordinary brick/wood village: no square houses, no brick, no planks walls. The houses are ROUND, LUMPY STONE-AND-TURF HUTS: thick curved walls of rounded mossy fieldstones and river cobbles, roofs of thick living turf/grass domes seen from above (tufts, wildflowers, moss, a few little ferns growing on them, one or two with a crooked stone chimney pot or a round smoke hole), organic bulging silhouettes, each hut a different odd shape (one like a fat mushroom cap, one slightly leaning, one with two merged domes). Round-topped wooden doors, small round or arched windows. Cosy, quiet, a little melancholic and magical.

Guide colour key:
- mid green = forest-hollow grass (walkable). Rich but FLAT ground detail only: soft moss, clover, tiny pale flowers, mushrooms rings drawn flat, pebbles, worn patches. Nothing tall or solid on it.
- tan = narrow worn footpaths of packed earth with a few flat stones (walkable). Soft, slightly wavy natural edges, but stay inside the tan area.
- blue = a clear forest stream (x 24-25 flowing down from the north forest) that turns and runs west across the whole village, with a wider mill pond under the water wheel. Paint moving water, small ripples, reeds and round river stones along the banks, lily pads in the pond. Fill the whole blue area with water.
- light grey circles on the stream = STEPPING STONES: big flat round river stones exactly at those spots (2 columns of 2 stones), dry tops, water flowing between them. No bridge.
- the dark-hatched green block at top left with the pale square spiral = the GRAVE HILL: a small round grassy mound. A narrow footpath of worn flat stone slabs (the pale cells) winds around the mound as a SPIRAL, climbing to its top: it starts at the bottom right entrance, goes up the right side, along the top, down the left side, along the bottom and up into the summit. Between the turns of the spiral the mound is steep grassy slope with a low dry-stone edging on the downhill side of the path (these dark-hatched cells are NOT walkable, paint them as sloped turf and stone, clearly separating the rings). The light-green area in the middle is the small flat summit, mossy grass (leave it plain: gravestones are added by the game). Make the whole hill read as rising in the middle (lighter summit, shaded lower slopes).
- dark green circles = dense ancient forest (solid). Big layered crowns, dark blue-green and teal, some hanging moss; trunks only along the bottom edge of each forest mass. The border is thick forest; the small circles at the hill corners are single old trees.
- the rounded shapes = the huts seen from the classic top-down RPG view: the upper yellow-green part is the TURF DOME ROOF seen from above, the lower grey part is the curved FRONT WALL of rounded fieldstones facing the viewer. Keep each hut inside its guide shape (roofs may bulge out by at most a few pixels; a chimney may rise a little).
- the biggest hut at the top next to the stream is the MILL: a round stone mill house with a turf roof, and on its east side a HUGE wooden WATER WHEEL (the brown wheel in the guide, same position and size), seen face-on, with paddles, iron-bound rim and spokes, its lower part dipping into the stream, water splashing white off the paddles. The mill has NO door on the visible front.
- the long hut at the left below the stream is the inn: a double-domed long turf hut.
- small BLACK rectangles = the front DOORS: a round-topped wooden door with a small flat door stone, exactly at that spot and size, bottom edge on the bottom edge of the wall. Doors are NOT necessarily centred on the wall. Do not add any other door.
- small yellow squares = small deep-set round/arched windows with wooden frames (panes softly warm, no glow spilling out).

Pixel art rules: crisp square pixels (each art pixel = 2x2 output pixels), no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark outlines on huts. Characters in this game are about 96 output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral soft even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO lamp light pools, NO glow, NO vignette, NO fog. The game engine adds the night and all lights later.
Do NOT paint any characters, animals, lanterns, lamp posts, barrels, crates, sacks, benches, market stalls, gravestones, signs, chests, text, labels, grid lines or UI. Leave open ground for them.
""" + extra
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": "1920x1792", "quality": "high", "background": "opaque",
       "refs": ["guide_2x.png"], "tag": "yura_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
