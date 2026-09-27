import json, sys, os
name = sys.argv[1]
P = """Paint the COMPLETE top-down map of a very unusual fantasy MOUNTAIN-PASS INN, as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG map view (NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

This is NOT an ordinary inn building. High in a snowy mountain saddle stands the RUIN OF AN ANCIENT BORDER GATEHOUSE that once closed the pass: two old stone towers joined by a thick crenellated curtain wall with a great arched gateway. Travellers have made it into an inn: the WEST TOWER is the inn (a round-ish, taller tower, its broken top rebuilt with a steep timber roof, a carved wooden inn door, shutters and warm windows, a wooden gallery with hanging lanterns and drying furs), the EAST TOWER is the trading post (square, partly collapsed, patched with planks and a lean-to timber roof, its own door and a painted sign). The great GATE ARCH between them is choked by a ROCKSLIDE of broken boulders and ice that blocks the road beyond (the pass is closed). In front lies the old gate court of cracked flagstones. East of the road, natural HOT SPRINGS melt the snow: three steaming, stepped TERRACE POOLS of turquoise water in rims of orange-cream mineral stone (travertine), with snow-free wet rock around them, a small wooden screen/shelter by the top pool with a bamboo-like wooden pipe; west of the road a travellers' camp on the snow. A trodden road winds up from the bottom edge to the gate court.

The attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a 34 x 26 tile grid (each tile = 48 x 48 px of the output, output is 1632 x 1248). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data.

Guide colour key:
- dark grey-brown = the MOUNTAIN (unwalkable): snow-covered rock, crags and boulders, a few snow-laden firs; where a brown band with lines runs along the bottom edge, paint a short vertical ROCK AND ICE CLIFF face (layered stone, icicles, snow on the ledges) dropping to the snow below.
- off-white = open snow of the saddle (walkable): smooth snow, footprints, a few tufts of dry grass poking through. Flat.
- warm tan = the trodden ROAD (walkable): packed dirty snow, cart ruts and hoofprints. Flat.
- grey with squares = FLAGSTONES (walkable): the old gate court (big worn square stones, snow swept aside) and the warm, wet stone rims around the hot-spring pools (orange-cream travertine near the water). Flat.
- turquoise with small circles = the HOT-SPRING POOLS (not walkable): steaming turquoise water, bubbles, mineral crust at the edges, a soft wisp of steam (keep the steam thin and local).
- the two tall grey blocks at the top with a brown triangle = the two gate TOWERS seen from above (the triangle = the timber roof rebuilt on top; battlements around), with their stone fronts facing the viewer (light grey band) holding the doors and windows.
- the grey block between them with the dark arch = the CURTAIN WALL with the GATE ARCH filled by the rockslide (grey circles = boulders). No door there.
- small brown plank box on the right = the wooden screen of the bath's water inlet.
- small BLACK rectangles = the two DOORS. Each door must be painted exactly at that spot and size (a heavy wooden door, bottom edge on the bottom edge of the tower front). Do not add any other door or opening that looks like a door.
- small yellow squares = windows (panes softly warm, but no glow spilling out).
Buildings, pools and cliffs must not extend outside their guide shapes.

Make everything rich, detailed, handcrafted and cohesive: ancient weathered granite with moss and old carved border crests, newer warm timber repairs, ropes, furs, icicles, snow on every ledge. Details on walkable ground must stay flat.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark warm outlines on buildings. Characters in this game are about 140 output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral, soft, even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO lamp light pools, NO glow, NO vignette, NO fog, no falling snow.
Do NOT paint any characters, animals, lamp posts, lanterns on the ground, barrels, crates, benches, tents, sleds, signposts, notice boards, chests, text, labels, grid lines or UI. Leave open ground for them.
"""
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": "1632x1248", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath("guide_48.png")], "tag": "pass_inn_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
