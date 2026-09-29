"""(isles copy of ../field_ash/mkjob.py) Job for one painted map of the Marea isles. usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + style_isles.png (a crop of the approved painted Pharos harbour: rendering only).
The look (layout meta 'look': field | town | cave | ship) picks the colour key. The prompt names no other game and no artist."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']
LOOK = (d.get('meta') or {}).get('look', 'field')
SCENE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scenes.json')))

KEY = {'field': """- green = short island GRASS (walkable, flat): fresh green turf with tiny clover and daisies.
- green with short strokes = wind-bent MEADOW GRASS and pink sea thrift (walkable, low, flat).
- green with small pink/white dots = WILD FLOWERS in the grass (walkable).
- light tan band = the ROAD: packed pale earth and crushed white shell with small stones along its edges (walkable).
- darker brown = a narrow FOOTPATH of trodden earth (walkable).
- pale cream = WHITE SAND beach (walkable, flat), fine and bright, with a few shells and bits of driftwood.
- light turquoise with white arcs = SHALLOW SURF / wet sand at the water's edge (walkable): transparent turquoise water over pale sand, lines of white foam.
- grey with light arcs = FLAT ROCK SHELF (walkable): level wet dark-grey rock with small pools and barnacles, level with the ground around it.
- light grey with block lines = pale FLAGSTONES / white paving (walkable, flat).
- brown with plank lines = WOODEN PLANKS of a jetty / bridge on posts (walkable deck).
- turquoise = a TIDE POOL or pond (not walkable).
- deep blue = the SEA (not walkable): deep blue water with small waves, turquoise near the shore, white surf where it meets rocks and sand.
- dark green circles = PINES / PALMS (not walkable): wind-bent sea pines with dark green crowns, or coconut palms on the sand.
- round green-olive blobs = small BUSHES (not walkable).
- grey circles = BOULDERS and reef rocks (not walkable).
- all colour areas are LEVEL GROUND unless listed as not walkable; only the cliffs below are raised.
- pale cream-white with horizontal strata and a green top edge = WHITE CHALK CLIFFS / white rock (not walkable): sheer layered white and pale grey rock, grass overhanging the top edge, fallen white rocks and surf at the foot where they meet the sea.""",
       'town': None, 'cave': """- light grey-blue with small arcs = the walkable cave FLOOR: flat wet dark-grey rock shelves with barnacles, small pebbles and shells, organic edges (never square or stepped).
- pale beige = patches of wet SAND on the floor (walkable, flat).
- teal = sea WATER inside the cave (not walkable): dark teal water, luminous plankton specks, gentle ripples, a thin wet rim where it meets the rock.
- dark blue = deep water (not walkable).
- grey circles = BOULDERS and heaps of shells (not walkable).
- very dark grey = solid ROCK (not walkable): the cave walls, jagged dark wet sea rock seen from above, their sheer faces showing where they rise above the floor, streaked with green weed and white barnacles; the wall outlines are smooth, rounded and natural like real sea caves: NEVER square, stepped or staircase-shaped, no right angles; everything outside the floors is solid rock.""",
       'ship': """- brown with plank lines = the walkable wooden DECK / floor of the ship: old dark planks, grey-green with age and damp, a few loose boards, rope coils flat on the deck.
- dark reddish with block lines = an old faded CARPET / rug on the floor (walkable).
- grey with arcs = puddles of bilge and wet planks (walkable).
- teal = sea water that has flooded in through the broken hull (not walkable).
- dark brown with lines = the ship's WALLS, bulkheads, the hull sides and the RAILS (not walkable): thick timbers and ribs.
- the darkest brown-black = the space outside / under the ship (not walkable): shadowed hull timbers.
- deep dark blue = the sea around the ship (not walkable): dark swell, drifts of pale fog on the water.
- grey circles = crates, barrels, fallen rigging (not walkable).
The walls and bulkheads follow the guide exactly; the ship's rooms are straight-sided (it is a built ship), but the hull outline is a smooth curved ship shape."""}
KEY['town'] = KEY['field'].replace("- pale cream-white with horizontal strata", "- off-white blocks with horizontal lines = whitewashed BUILDINGS and white retaining WALLS of the town terraces (not walkable).\n- pale cream-white with horizontal strata")

marks = []
seen = set()
for m in d['marks']:
    if m['kind'] in seen: continue
    seen.add(m['kind'])
    c = m['color']
    if m['kind'] == 'door':
        marks.append("- small BLACK rectangles = the front DOORS / openings. Paint each door exactly at that spot and size (a wooden door or a dark opening, its bottom edge on the bottom edge of the wall). Do not add any other door or opening that looks like a door.")
        continue
    marks.append(f"- the blocks in colour rgb({c[0]},{c[1]},{c[2]}) = {m['text']}.")
cell = T * 48 // 32
WHAT = {'field': 'one outdoor area of a sunny archipelago of white islands', 'town': 'a whole small town of a sunny archipelago of white islands',
        'cave': 'one floor of a sea-cave dungeon', 'ship': 'one level of a derelict ghost ship (a dungeon)'}[LOOK]
P = f"""Paint the COMPLETE top-down map of {WHAT} in a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

THE PLACE: {SCENE[aid]}

The FIRST attached image is an exact LAYOUT GUIDE drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output; the output is {W * T} x {H * T} px). Trace over it: your painting is laid pixel-for-pixel on top of it and used directly as the walkable game map, so every road, shore, cliff, wall, tree mass, water body and landmark must sit exactly where it is in the guide at the same size (keep every edge within a few pixels of the guide; do not shift, shrink, mirror or re-arrange anything; keep the exact width of the roads and of the one- and two-tile gaps).

The SECOND attached image is only a STYLE REFERENCE from the same game: match its pixel-art rendering (pixel size, clusters, outlines, colour ramps, level of detail). Do NOT copy anything from it (no houses, piers, ships or objects from it).

The guide is soft colour-coding only (its blurred edges only mean the edge is natural and free-flowing): do NOT copy its flat colours, straight tile steps, circles or stripes. Interpret every area as the real material with rich natural variation, and give shores, meadows, rocks and cliffs natural, organic, slightly irregular outlines (bulging or receding by at most a third of a tile around the guide edge). Make it feel like a real, exciting place to explore, full of small natural detail.

Guide colour key:
{KEY[LOOK]}
Landmarks (paint each exactly on its block, at the block's size):
{chr(10).join(marks)}
Walkable areas must stay walkable-looking: no boulders, trees, fences, crates or objects standing on them unless the guide shows them.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it into night at runtime and adds lamp light on top). Neutral, soft, even daylight-like light as in the style reference; NO darkness, NO night tint, NO long cast shadows, NO light pools, NO glow halo, NO vignette, NO fog over the map, NO clouds over the map.
Do NOT paint any characters, people, animals, monsters, birds, boats or ships on the water (unless a landmark says so), treasure chests, lanterns, lamp posts, torches, campfires, signs, signposts, text, letters, numbers, labels, grid lines, borders, frames or UI. Those are added later as separate sprites: leave the ground open for them.
"""
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath('style_isles.png')], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
