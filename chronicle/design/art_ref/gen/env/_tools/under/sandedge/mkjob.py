"""Job for the painted Sandedge underlay (one generation at 1.5x = 1920 x 1440, tile 48). usage: python3 mkjob.py <name> [extra text]"""
import json, sys, os
name = sys.argv[1]
extra = sys.argv[2] if len(sys.argv) > 2 else ''
P = """Paint the COMPLETE top-down map of a small, very unusual fantasy CARAVAN STOP at the edge where a forest ends and the desert begins, as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG map view (NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

THE PLACE: "Sandedge", a waystation built around a single colossal PETRIFIED TREE, the last giant of a forest that turned to stone long ago. It is NOT an ordinary inn: there are no square houses, no brick or timber boxes, nothing in rows. The inn is carved into the hollow of the huge stone trunk; the stone roots sprawl out into the courtyard; a sweet-water well bubbles up between the roots; camels are stabled under a natural rock arch.

The attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a 40 x 30 tile grid (each tile = 48 x 48 px of the output, output is 1920 x 1440). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data.

Guide colour key:
- orange with wavy lines = rolling SAND DUNES (not walkable), wind ripples and soft crests.
- dark green circles along the top = the last edge of the FOREST: dense dry scrub, thorny bushes, a few small gnarled trees and tall grass turning yellow towards the sand (not walkable).
- small plain green strips = patches of tough grass (flat).
- pale sand = walkable packed sand of the courtyard: footprints, camel tracks, pebbles, dry tufts, FLAT.
- red-brown = trodden reddish clay ground (walkable): the road coming in from the south gate, the market corner on the east, and the floor of the stable on the west. Flat, cracked, hoof prints.
- light grey squares = old worn FLAGSTONES around the well in the middle of the courtyard (walkable, flat, sand in the joints). Leave the very centre plain paving: the game draws the well itself.
- the big grey mass at the top = the PETRIFIED GIANT TREE seen from above: a colossal trunk of grey, banded, crystalline stone wood with rings and deep bark cracks, its broken stone crown rising out of the top of the map, and huge petrified ROOTS (the grey wings to the left and right) sprawling into the courtyard. Amber and quartz glints in the cracks, a little green lichen.
- the tan band with the door in the trunk = the INN carved into the hollow of the stone trunk: a smoothed front cut into the bark with a round-topped wooden door (black mark), two small deep windows (yellow squares), a hanging lantern hook and a faded carpet curtain. The grey cells directly below the door band are root feet on either side of the doorstep.
- the brown U-shape on the left = a natural ROCK ARCH / overhang of red sandstone (not walkable) forming the STABLE: the rock wall on its west side and its roof edges at top and bottom; its opening faces east into the courtyard; the clay floor under it has straw scattered on it.
- the round shape with spokes at top left = a nomad's round felt TENT-HUT (yurt) seen from above: felt roof with a smoke ring and rope bands (no door visible).
- the plain dome at top right = a round mud STOREHOUSE dome with a small vent (no door).
- small BLACK rectangle = the only DOOR. Paint it exactly at that spot and size. Do not add any other door or opening that looks like a door anywhere.
- the lane at the bottom leaves the map between the dunes: that is the south gate; mark it with two short weathered wooden posts with cloth streamers standing ON THE DUNES beside the lane (not on the lane).
Shapes must not extend outside their guide shapes (by at most a few pixels).

Make everything rich, detailed, handcrafted and cohesive: grey stone wood, warm sand, red rock, faded madder and indigo cloth, brass. Details on walkable ground must stay flat.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark warm outlines. Characters in this game are about 140 output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral, soft, even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO lamp light pools, NO glow, NO vignette, NO fog.
Do NOT paint any characters, animals, camels, lamp posts, braziers, barrels, crates, sacks, jars, hay, market stalls, tables, signs, chests, the well, text, labels, grid lines or UI. Leave open ground for them.
""" + extra
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": "1920x1440", "quality": "high", "background": "opaque",
       "refs": ["guide_48.png"], "tag": "sandedge_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
