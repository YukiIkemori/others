"""Job for the painted Loch underlay (one generation, 2016 x 1872 = 56 x 52 tiles at 36 px). usage: python3 mkjob.py <name> [extra]"""
import json, sys, os
name = sys.argv[1]
extra = sys.argv[2] if len(sys.argv) > 2 else ''
P = """Paint the COMPLETE top-down map of a very unusual fantasy LAKE TOWN built on stilts over a misty marsh lake in a land of endless night, as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG map view (NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

This is NOT an ordinary town of houses in rows, and nothing is arranged on a grid. The whole town stands in a shallow, still, greenish lake; crooked wooden BOARDWALKS on posts wind between little peat islands and houses on stilts. The strangest thing: at the north, a COLOSSAL ancient BRONZE BELL, as big as a cathedral, fell from a tower centuries ago and lies tipped on its side in the lake, green with verdigris, its crown loop pointing north and its huge open mouth facing south towards the town square; the mouth is closed off with a thick wall of old planks and three doors are cut into it (the item shop, the tavern in the middle, the armourer), with sign boards. In front of it is a small cobbled island square. West stands the town's ASSEMBLY HALL, a long hall on tall piles under one great steep thatched roof of pale reeds shaped like the folded wings of a grey heron. East, on its own island, a square grey stone BELL TOWER with a bronze bell under its slate cap. Six more slender wooden bell towers on single stilts stand out in the water around the town (seven towers in all), each with a small bronze bell (the one in the south-east is new and shinier). A deep dark CANAL crosses the whole town from west to east, spanned by one old humped STONE BRIDGE in the middle. South of the canal: the inn, a ring of old flat-bottomed barges moored together in a circle and roofed over; the mayor's house held in the roots of a giant weeping WILLOW; a little fisher's hut on stilts; a tall, narrow, crooked LEANING house painted in faded plum and ochre (the doll maker's); and one cold, square, grey cut-stone building with iron shutters that looks foreign and out of place (an outpost office). In the south a big wooden RAFT platform floats on the lake (the night market). Tall reed beds ring the whole lake at the edges of the map.

The attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a 56 x 52 tile grid (each tile = 36 x 36 px of the output, output is 2016 x 1872). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data.

Guide colour key:
- muted teal with short light strokes = the shallow LAKE (not walkable): still, murky green-teal marsh water with lily pads, duckweed, reflections of posts, a few floating leaves, faint ripples. Keep it calm.
- dark blue with wavy lines (the band across the middle) = the deep CANAL: darker, slowly flowing water with gentle current lines, stone-lined edges where it meets the land.
- olive with vertical strokes = tall REED BEDS and cattails (not walkable): dense, rustling, some bent, with a few small mossy stones.
- brown with plank lines = wooden BOARDWALKS on posts (walkable): weathered grey-brown planks, some patched, rope rails only at the very edges, small posts along the water side. Keep them flat and open (do not put crates or rails across them).
- green = small PEAT ISLANDS (walkable): soft damp moss and short marsh grass, a few tiny pale flowers, a little mud at the shore. Flat.
- light grey tiles = the cobbled TOWN SQUARE island (walkable): old worn flagstones with moss in the joints. Flat and open.
- pale grey strip with dark edges crossing the canal = the humped stone BRIDGE (walkable deck, low stone parapets on both sides).
- round dark-green blobs = big weeping WILLOW crowns hanging over the islands.
- teal trapezoid with rings at the top middle = the great fallen BRONZE BELL (verdigris green, raised rings, the crown loop at the north end); the brown band under it with three black doors = its mouth, walled with planks.
- tan triangular roof = the heron-wing reed roof of the assembly hall; dark brown band under it = its wooden front wall on piles.
- grey block with a gold circle = the stone bell tower seen from above (slate cap, the bronze bell visible in the open belfry); grey band under it = its stone front.
- brown oval with a dark centre = the ring of moored barges (the inn): hulls in a circle with a roofed-over middle; the brown band under it = its plank front wall.
- green blob over a rust roof = the willow-root house of the mayor.
- plum slanted roof = the crooked leaning doll maker's house; ochre band = its front.
- grey rectangle = the cold stone outpost office (flat grey roof, iron shutters, no decoration).
- small tan triangle roof = the fisher's hut on stilts with drying nets.
- small brown boxes with a gold circle (in the water) = the slender stilt bell towers with small bronze bells.
- small BLACK rectangles = the front DOORS. Each door must be painted exactly at that spot and size (a wooden door, bottom edge on the bottom edge of the wall). Do not add any other door or opening that looks like a door.
- small yellow squares = small windows (panes softly warm, but no glow spilling out).
Buildings, towers and the bell must not extend outside their guide shapes.

Make everything rich, detailed, handcrafted and cohesive, like a lovingly painted JRPG town map of a mysterious fog-bound lake town of bells: hanging fishing nets and eel traps on the stilts, little bells hung under eaves, moss and lichen on old wood, reed thatch, bronze gone green. Details on walkable ground must stay flat (no tall things on the walkable areas).

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark warm outlines on buildings. Characters in this game are about 105 output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral, soft, even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO lamp light pools, NO glow, NO vignette, NO fog, NO mist.
Do NOT paint any characters, animals, lamp posts, lanterns, braziers, barrels, crates, benches, market stalls, signs on the ground, boats on the water, chests, text, labels, grid lines or UI. Leave open ground for them.
""" + extra
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": "2016x1872", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath("guide_36.png")], "tag": "loch_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
print('job', name)
