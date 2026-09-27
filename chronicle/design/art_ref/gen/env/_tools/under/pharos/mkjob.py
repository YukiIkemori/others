"""Job for the painted Pharos underlay (one generation at 1.5x = 3072 x 2304, tile 48). usage: python3 mkjob.py <name> [extra text]"""
import json, sys, os
name = sys.argv[1]
extra = sys.argv[2] if len(sys.argv) > 2 else ''
P = """Paint the COMPLETE top-down map of a very unusual fantasy PORT TOWN that clings to sea cliffs and rock stacks, as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG map view (NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

This is NOT an ordinary town of square brick or timber houses, and nothing is arranged in rows or on a grid. There are NO normal houses at all. People live in dwellings CARVED INTO THE CLIFF FACE at different heights, in an OLD BEACHED GALLEON wedged diagonally down the cliff (it holds three shops: the tavern in the stern castle, the armourer in the midship, the item shop in the bow), in UPTURNED OLD BOAT HULLS, in a round old WATCH TOWER, and in a sailcloth boat shed on stilts. Paths wind organically from ledge to ledge, joined by carved stone stairs, rope bridges and crooked wooden piers.

The attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a 64 x 48 tile grid (each tile = 48 x 48 px of the output, output is 3072 x 2304). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data.

Guide colour key:
- light warm grey-beige = walkable terraces: worn, flat, hand-cut rock ledges and flagstone paving laid on the cliff (weathered sandstone and grey stone, cracks, salt stains, a little moss and sea-pink in the cracks). Keep it FLAT ground detail only.
- grey area with circles (middle) = the "net plaza": round-cobbled old square where fishermen dry nets; a faint compass-rose pattern set into the cobbles (flat, no objects on it - the game places a well, stalls and boards there).
- small green patches = salt grass and sea-thrift tufts on the cliff edge (flat).
- brown with horizontal strata lines = VERTICAL CLIFF FACES seen from the front (layered sandstone and dark rock, ledges, streaks, gulls' nest ledges, ropes, hanging fishing nets and small wooden balconies bolted onto the rock). Each band is the drop from one terrace down to the next one below it. The wide band at the top of the map is the tall main cliff wall.
- dark grey-brown = rock seen from above (tops and sides of rock masses, rough and unwalkable).
- green strip along the very top = the grassy headland above the cliff (windswept grass, a few rocks).
- white/grey striped squares = narrow stone stairs cut into the cliff face, going down to the lower terrace.
- tan with vertical plank lines = wooden boardwalks and piers on thick posts over the water (weathered planks, iron nails, rope coils, tar); the long strip along the bottom of the cliff is the harbour boardwalk.
- pale tan planks with dark lines along both edges = ROPE BRIDGES (plank footway hung on thick ropes, rope railings with posts at both ends) crossing the sea between the cliffs and the rock stacks. Paint the sea visible below them only at their edges.
- blue = the sea: deep blue-green water, gentle waves, foam where it touches the rock and around the pier posts. The two rock masses on the right, surrounded by sea, are tall ROCK STACKS (sea pillars) with flat walkable tops.
- beige shapes with an arched top inside the cliff = CAVE DWELLINGS CARVED INTO THE CLIFF: a dressed-stone facade cut into the rock with a round-arched top, carved lintels, a wooden door, small deep-set windows with shutters, ropes and nets drying beside them. The rock around and above each facade is the cliff itself (no roof). The big one at top left is the inn, with a little wooden balcony and flower boxes.
- the big dark-brown diagonal shape in the middle = the BEACHED GALLEON: a large old three-masted wooden sailing ship run aground and wedged diagonally down the cliff, seen from above: weathered deck planks, broken mast stumps (the dark circles), coils of rope, torn sail cloth, a raised stern castle at its upper left end and a pointed bow with a carved figurehead at its lower right end. The three lighter brown bands along its lower side are the ship's planked side walls facing the viewer, with the shop doors cut into them and small square ports as windows; they are at three different heights.
- the grey-blue circle with a grey front (top middle) = a ROUND OLD STONE WATCH TOWER built on the ledge: conical slate roof seen from above, curved grey stone front with the door.
- dark brown ovals with a lighter brown front = UPTURNED OLD BOAT HULLS turned into little houses: the tarred, clinker-planked hull seen from above with its keel along the top (patched planks, barnacles, a stovepipe), and the cut-open stern end facing the viewer as a planked front wall with the door. The one in the water at the bottom stands on stilts at the end of a crooked pier.
- the triangle roof (lower right) = the boat builders' shed: a steep A-frame roof of patched old sails and timber on stilts over the water, planked front.
- small BLACK rectangles = the front DOORS. Each door must be painted exactly at that spot and size (a wooden door, bottom edge on the bottom edge of the facade). Do not add any other door or opening that looks like a door.
- small yellow squares = small windows (panes softly warm, but no glow spilling out).
- far lower right: a small rocky islet with a tall white-and-red LIGHTHOUSE (the view of the lighthouse across the water; seen from the front, lantern room at the top).
Buildings, cliffs, bridges, piers and rock stacks must not extend outside their guide shapes.

Make everything rich, detailed, handcrafted and cohesive, like a lovingly painted JRPG town map of a wind-beaten fishing port: salt-weathered stone, tarred wood, ropes, nets, buoys, seaweed on the lowest rocks. Details on walkable ground must stay flat (no tall things on the walkable areas).

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark warm outlines on buildings. Characters in this game are about 140 output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral, soft, even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO lamp light pools, NO glow, NO vignette, NO fog.
Do NOT paint any characters, animals, ships or boats on the water, lamp posts, barrels, crates, benches, wells, market stalls, signs, chests, text, labels, grid lines or UI. Leave open ground and open water for them.
""" + extra
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": "3072x2304", "quality": "high", "background": "opaque",
       "refs": ["guide_48.png"], "tag": "pharos_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
