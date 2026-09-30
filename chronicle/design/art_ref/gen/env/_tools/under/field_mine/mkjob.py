"""(mine copy of ../field_isles/mkjob.py) Job for one painted map of the Gard mountains / Dovan. usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + a style crop (rendering only): style_mine.png (a crop of the approved painted wind hill:
the fields) or style_mine_cave.png (a crop of the approved painted volcano floor: the cavern town and the mine floors).
The look (layout meta 'look': field | town | cave) picks the colour key. The prompt names no other game and no artist."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']
LOOK = (d.get('meta') or {}).get('look', 'field')
SCENE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scenes.json')))

KEY = {'field': """- green = short ALPINE GRASS (walkable, flat): tough mountain turf with small stones, moss and tiny white and yellow flowers.
- olive with short strokes = HEATHER and tall mountain grass (walkable, low, flat).
- green with small pink/white dots = MOUNTAIN FLOWERS in the grass (walkable).
- light tan band = the GRAVEL ROAD: packed grey-brown gravel and cart ruts, small stones along its edges (walkable).
- darker brown = a narrow FOOTPATH of trodden earth (walkable).
- white with pale blue arcs = patches of OLD SNOW and loose scree (walkable, flat).
- grey with arcs = FLAT ROCK SHELVES (walkable): level bare grey rock, cracks and lichen, level with the ground around it.
- brown with steel lines = a RAIL TRACK for mine carts (walkable): dark wooden sleepers across, two steel rails along the line, gravel ballast.
- brown with plank lines = WOODEN PLANKS of a bridge / trestle / boardwalk (walkable deck).
- light blue = a shallow FORD of the stream (walkable): clear water over pebbles.
- blue = a mountain STREAM or pool (not walkable): clear cold water over stones, white riffles.
- dark blue = deep water (not walkable).
- dark green triangles = CONIFERS (not walkable): dark fir and spruce seen from above, their crowns overlapping into dark masses.
- round green-olive blobs = DWARF PINES and bushes (not walkable).
- grey circles = BOULDERS, ore heaps and slag heaps (not walkable).
- all colour areas are LEVEL GROUND unless listed as not walkable; only the cliffs below are raised.
- grey-brown with horizontal strata and a green top edge = MOUNTAIN CLIFFS / rock faces (not walkable): sheer layered grey-brown rock, cracked ledges, grass overhanging the top edge, scree at the foot; their outlines are natural and rounded, never square or stepped.
- black = a deep CHASM (not walkable): a sheer drop into darkness.""",
       'cave': """- light brown with arcs = the walkable mine FLOOR: packed earth and grey-brown rock of the galleries, cart ruts, small stones and ore crumbs, organic edges (never square or stepped).
- grey-brown with arcs = patches of loose GRAVEL / slag on the floor (walkable, flat).
- brown with steel lines = a RAIL TRACK for mine carts (walkable): dark wooden sleepers, two steel rails.
- brown with plank lines = TIMBER PLANKS: a boardwalk or a bridge of beams over a drop (walkable deck).
- teal = underground WATER (not walkable): dark still water with faint reflections.
- black = a deep CHASM / shaft (not walkable): a sheer drop into darkness.
- grey circles = BOULDERS, heaps of ore and rubble (not walkable).
- brown with vertical lines = TIMBER structures (not walkable): heavy wooden beams and props, scaffolds, sheds.
- very dark grey = solid ROCK (not walkable): the mountain's rock around the galleries, dark and jagged, seen from above, the sheer faces showing where it rises above the floor, streaked with ore veins; the gallery walls are shored with timber frames here and there; the outlines are natural and rounded, NEVER square, stepped or staircase-shaped; everything outside the floors is solid rock.""",
       'town': """- light grey-beige with block lines = STONE PAVING of the streets and terraces (walkable, flat): worn flagstones.
- light brown with arcs = packed EARTH floor of the cavern (walkable, flat).
- brown with steel lines = a RAIL TRACK for mine carts running through the town (walkable): dark sleepers, two steel rails.
- brown with plank lines = TIMBER PLANKS: walkways, bridges and the lift platforms (walkable deck).
- teal = underground WATER, a channel or cistern (not walkable).
- black = a deep CHASM / shaft between the tiers (not walkable).
- grey circles = heaps of ore, crates and barrels (not walkable).
- brown with vertical lines = BUILDINGS of the cavern town (not walkable): houses and halls of dark timber and stone built against the rock, slate and timber roofs seen from above with their south faces visible, small warm windows (unlit in this layer), chimneys.
- very dark grey = the solid ROCK of the great cavern (not walkable): the cavern walls and the rock faces between the tiers, dark and jagged, veins of glowing blue ore, their sheer faces visible where a tier drops to the one below; natural rounded outlines, never square or stepped."""}

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
WHAT = {'field': 'one outdoor area of rugged mining mountains', 'town': 'a whole mining town built inside a huge cavern under a mountain',
        'cave': 'one floor of an old mine dungeon (timbered galleries dug into a mountain)'}[LOOK]
STYLE = 'style_mine.png' if LOOK == 'field' else 'style_mine_cave.png'
P = f"""Paint the COMPLETE top-down map of {WHAT} in a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

THE PLACE: {SCENE[aid]}

The FIRST attached image is an exact LAYOUT GUIDE drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output; the output is {W * T} x {H * T} px). Trace over it: your painting is laid pixel-for-pixel on top of it and used directly as the walkable game map, so every road, rail, shore, cliff, wall, tree mass, water body and landmark must sit exactly where it is in the guide at the same size (keep every edge within a few pixels of the guide; do not shift, shrink, mirror or re-arrange anything; keep the exact width of the roads and of the one- and two-tile gaps).

The SECOND attached image is only a STYLE REFERENCE from the same game: match its pixel-art rendering (pixel size, clusters, outlines, colour ramps, level of detail). Do NOT copy anything from it (no objects, signs or buildings from it).

The guide is soft colour-coding only (its blurred edges only mean the edge is natural and free-flowing): do NOT copy its flat colours, straight tile steps, circles, triangles or stripes. Interpret every area as the real material with rich natural variation, and give cliffs, rock walls, streams and meadows natural, organic, slightly irregular outlines (bulging or receding by at most a third of a tile around the guide edge). Make it feel like a real, exciting place to explore, full of small natural detail.

Guide colour key:
{KEY[LOOK]}
Landmarks (paint each exactly on its block, at the block's size):
{chr(10).join(marks)}
Walkable areas must stay walkable-looking: no boulders, trees, fences, crates, carts or objects standing on them unless the guide shows them.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it into night at runtime and adds lamp light on top). Neutral, soft, even daylight-like light as in the style reference; NO darkness, NO night tint, NO long cast shadows, NO light pools, NO glow halo, NO vignette, NO fog over the map, NO clouds over the map.
Do NOT paint any characters, people, animals, monsters, birds, mine carts on the rails, treasure chests, lanterns, lamp posts, torches, campfires, signs, signposts, text, letters, numbers, labels, grid lines, borders, frames or UI. Those are added later as separate sprites: leave the ground open for them.
"""
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath(STYLE)], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
