"""Job for the painted bog (open state). usage: python3 mkjob.py <name> [extra]"""
import json, sys, os
name = sys.argv[1]; extra = sys.argv[2] if len(sys.argv) > 2 else ''
P = """Paint the COMPLETE top-down map of a haunted MARSH, the "Bog of the Sunken Bells", as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG dungeon map view (NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

A wide, still, murky bog: dark green-brown water with duckweed, lily pads, rotting leaves and bubbles; peat islands of spongy moss and marsh grass; a few crooked plank BOARDWALKS on posts joining them; tall reed beds and gnarled DEAD TREES around the edges. Long ago seven bell towers were sunk into this bog; three of their tops still rise out of the peat: each a broken grey stone BELFRY stub with a green-bronze BELL hanging in it (west, east and north). The water here has just drawn back, so winding causeways of wet dark MUD, still glistening, with puddles and footprints, now run where the water was. In the middle of the bog lies a round island, the heart where the mist gathers, with pale mushrooms and trampled grass. Near the north belfry stands a worn stone slab carved with lines of an old song.

The attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a 60 x 52 tile grid (each tile = about 34 x 34 px of the output, output is 2048 x 1776). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data.

Guide colour key:
- grey-teal with short light strokes = shallow bog WATER (not walkable): murky, weedy, still, with lily pads and floating leaves.
- dark navy blocks = deep black POOLS (not walkable): darker, bottomless-looking water; soften their blocky outlines into natural rounded shapes but keep them inside the navy area.
- green = PEAT islands (walkable): spongy moss, short marsh grass, tiny pale flowers, mud at the shore line. Flat.
- brown with dots = wet MUD causeways (walkable), freshly out of the water: glistening dark mud with puddles, footprints and a few stranded water weeds. Flat.
- light brown with plank lines = wooden BOARDWALKS on posts (walkable, weathered planks, flat, no rails across them).
- olive with vertical strokes = tall REED BEDS and cattails (not walkable).
- dark brown star shapes = gnarled DEAD TREES with bare twisted branches (not walkable).
- grey squares with a green circle = the tops of the sunken bell towers (broken stone belfries with a green-bronze bell) (not walkable).
- small grey slab (north island) = the old carved song stone.
Shapes must not move or change size.

Make everything rich, detailed, handcrafted and cohesive, like a lovingly painted JRPG dungeon map of an eerie, melancholy bog: roots, sunken stones, old rope, moss on the belfries. Details on walkable ground must stay flat.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark warm outlines. Characters in this game are about 100 output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral, soft, even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO light pools, NO glow, NO vignette, NO fog, NO mist.
Do NOT paint any characters, animals, ghosts, will-o'-wisps, lamps, lanterns, chests, boats, signs, text, labels, grid lines or UI.
""" + extra
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": "2048x1776", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath("guide_gen.png")], "tag": "bog_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
print('job', name)
