import json, sys, os
name = sys.argv[1]
extra = sys.argv[2] if len(sys.argv) > 2 else ''
P = """Paint the COMPLETE top-down map of a small fantasy hill village as ONE finished game map image, in rich premium hi-bit pixel art <STYLE: the live prompt names the owner-approved reference game here; it is not written to repo files> (flat top-down map, NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D).

The attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a 44 x 36 tile grid (each tile = 64 x 64 px of the output, output is 2816 x 2304). Every shape in your painting must sit exactly where it is in the guide, at the same size: this image is used directly as the walkable game map, so positions are collision data.
Guide colour key:
- mid green = grass (walkable open ground). Make it rich: varied grass with small flowers, clover, tiny pebbles, worn patches — but keep it FLAT ground detail only (nothing tall or solid on the grass).
- tan = packed earth village road (walkable). Soft natural edges, cart ruts, a few stones.
- grey area in the middle = the "storyteller's plaza": round cobblestone plaza of fitted old stones, with a faint carved ring pattern in the paving around its centre (flat, no objects on it — a standing stone is placed there by the game).
- brown rectangle with pink inside (left) = a tilled vegetable/herb garden: dark soil rows around, the pink area is a bed of flowers and herbs in neat rows.
- brown wooden fence along the top and right side of the garden: paint a rustic wooden post-and-rail fence exactly on those lines (with the same gaps).
- blue = a small pond (fill the whole blue area with water, reeds and lily pads at its edge).
- dark brown horizontal band across the map = a low earthen/rocky ledge (the upper village sits on a terrace): the top 1/4 of the band is the grassy lip, the rest is the vertical rock-and-earth face seen from the front, 1 tile tall. The road crosses the ledge through a gap as a short sloped path. The small light-grey square at the left end of the band is a narrow set of stone steps down through the ledge.
- dark green blobs of circles = dense old forest trees (solid). Paint lush layered deciduous tree crowns, deep and varied, trunks visible only along the bottom edge of each forest mass. The whole border of the map is thick forest; the two blobs in the lower half are small groves.
- rectangles = the 8 village houses seen from the classic top-down RPG view: the top part (roof colour) is the ROOF seen from above (yellow = golden thatch, dark red = wooden shingles, green = old stone roof overgrown with moss and ferns), the lower part is the FRONT WALL facing the viewer (cream = timber-framed white plaster, brown = log-cabin logs, grey = fieldstone). The big grey-walled house at top centre is the village hall of the storytellers (old stone, mossy roof). The big log house at the bottom is the old storyteller's home.
- small BLACK rectangles = the front DOORS. Each door must be painted exactly at that spot and size (a wooden door with a small stone step), bottom edge on the bottom edge of the wall. Do not add any other door.
- small yellow squares = windows with wooden frames and flower boxes (panes softly warm, but no glow spilling out).
Buildings, fence, ledge, pond and forest must not extend outside their guide shapes (roofs may overhang by at most a few pixels; chimneys may rise a little above the roof).

Make everything rich, detailed, handcrafted and cohesive, like a lovingly painted JRPG town map. The village is the storytellers' village on an old hill at the edge of an ancient forest: cosy, old, lived-in, moss on stones, worn paths, little garden details on the grass (flat only), stepping stones.

Pixel art rules: crisp square pixels (each art pixel = 2x2 output pixels), no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark warm outlines on buildings. Characters in this game are about 96 output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral, soft, even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO lamp light pools, NO glow, NO vignette, NO fog. The game engine adds the night and all lights later.
Do NOT paint any characters, animals, lamp posts, barrels, crates, benches, wells, signs, chests, text, labels, grid lines or UI. Leave open ground for them.
""" + extra
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": "2816x2304", "quality": "high", "background": "opaque",
       "refs": ["guide_2x.png"], "tag": "roa_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
