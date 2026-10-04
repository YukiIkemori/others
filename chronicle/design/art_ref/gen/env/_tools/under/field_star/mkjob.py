"""(star copy of ../field_isles/mkjob.py) Job for one painted map of the Orbis plateau. usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + style_<look>.png (crops of approved painted maps: rendering only).
The look (layout meta 'look': field | town | cave | ship) picks the colour key. The prompt names no other game and no artist."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']
LOOK = (d.get('meta') or {}).get('look', 'field')
SCENE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scenes.json')))

KEY = {'field': """- green = short highland GRASS (walkable, flat): cool silver-green turf of a high plateau with tiny white and blue flowers.
- olive green with short purple strokes = low purple HEATHER and tufts of tall grass (walkable, low, flat).
- green with small blue/white dots = little blue STAR FLOWERS in the grass (walkable).
- light tan band = the ROAD: an old road of pale packed earth with sunken pale paving stones showing through and small stones along its edges (walkable).
- darker brown = a narrow FOOTPATH of trodden earth (walkable).
- light grey with block lines = pale FLAGSTONES / worn stone steps / paving (walkable, flat).
- dark slate grey with small arcs = FLAT DARK ROCK (walkable): the level floor of a crater, dark rock with a few pebbles, level with the ground around it.
- blue = a small POND (not walkable).
- dark green = dense PINE WOOD on the slopes below (not walkable): dark conifer crowns packed together.
- dark green circles = single PINES (not walkable): dark alpine pines seen from above.
- round green-olive blobs = small juniper BUSHES (not walkable).
- grey circles = BOULDERS (not walkable).
- all colour areas are LEVEL GROUND unless listed as not walkable; only the cliffs below are raised.
- grey with horizontal strata and a green top edge = grey ROCK CLIFFS (not walkable): sheer layered grey stone faces, grass overhanging the top edge, fallen rocks at their foot.""",
       'town': None,
       'int': """- light grey with block lines = polished pale MARBLE FLOOR tiles (walkable).
- warm brown with plank lines = a WOODEN FLOOR of dark oak boards (walkable).
- dark red = a long faded red CARPET / rug on the floor (walkable).
- green = a small indoor GARDEN of lawn in a courtyard (walkable), blue dots = flowers.
- blue = the water of a FOUNTAIN basin or a pool (not walkable).
- mid grey with block lines = the thick STONE WALLS and partitions of the building seen from above (not walkable): pale ashlar walls, their top edge and their south face visible, straight and square like a real building.
- the darkest blue-black = outside the building (not walkable): night darkness beyond the outer walls.
- dark wood-brown circles = heavy FURNITURE (not walkable): desks, benches, bookshelves, crates, as the landmarks say.
The walls and rooms follow the guide exactly; the rooms are straight-sided (it is a built building)."""}
KEY['town'] = KEY['field'].replace("- grey with horizontal strata", "- off-white blocks with horizontal lines = pale MARBLE BUILDINGS and CITY WALLS (not walkable): flat and domed roofs of slate blue and pale stone, their south faces with windows and doors.\n- grey with horizontal strata")
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
WHAT = {'field': 'one outdoor area of a high starlit plateau of grass, heather and grey rock', 'town': 'a whole walled university town on a high plateau',
        'int': 'one floor of a grand stone building seen from above with its roof removed (a dungeon)'}[LOOK]
STYLE = {'field': 'style_field.png', 'town': 'style_town.png', 'int': 'style_int.png'}[LOOK]
# 地図ごとの足し書き（scenes.json の _extra[id]: 灯台・歌う岩・難破船・甲板など、目印をはっきり描かせる）
EXTRA = ("\n" + SCENE["_extra"][aid] + "\n") if aid in SCENE.get("_extra", {}) else ""
P = f"""Paint the COMPLETE top-down map of {WHAT} in a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

THE PLACE: {SCENE[aid]}
{EXTRA}
The FIRST attached image is an exact LAYOUT GUIDE drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output; the output is {W * T} x {H * T} px). Trace over it: your painting is laid pixel-for-pixel on top of it and used directly as the walkable game map, so every road, shore, cliff, wall, tree mass, water body and landmark must sit exactly where it is in the guide at the same size (keep every edge within a few pixels of the guide; do not shift, shrink, mirror or re-arrange anything; keep the exact width of the roads and of the one- and two-tile gaps).

The SECOND attached image is only a STYLE REFERENCE from the same game: match its pixel-art rendering (pixel size, clusters, outlines, hue-shifted ramps, level of detail), but use the palette of THE PLACE below. Do NOT copy anything from it (no buildings, piers, water or objects from it).

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
# 見やすさ優先（持ち主 2026-10-04「ギザギザ」「花々とか細かいのいらん」）: meta clean = 大きくはっきりした形、細かい物を散らさない
CLEAN = """
CLARITY (most important): this map must read clearly at a glance. Use LARGE, SIMPLE, CLEAN shapes with SMOOTH flowing outlines: broad calm areas of plain grass, one clear road, clear water, clear cliffs and clear tree masses. The edge of every area is a smooth natural curve, never a stair-stepped or zigzag tile edge. Do NOT scatter small details: NO flowers, NO flower dots, NO scattered pebbles or small stones, NO lone tiny bushes, NO speckled noise texture, NO grid-like rows of rocks or tufts. Grass is a calm, softly varied texture with gentle colour ramps; the road is a clean band with soft edges. Keep the level of detail like a clean, polished classic 16-bit JRPG overworld field: tidy, uncluttered and easy to read."""
if (d.get('meta') or {}).get('clean'):
    P = P.replace('lush natural detail', 'clean polished detail').replace(' Make it feel like a real, exciting place to explore, full of small natural detail.', ' Make it feel like a real, inviting place to explore.')
    P = P.replace(' with tiny white and blue flowers', '').replace('\nGuide colour key:', CLEAN + '\n\nGuide colour key:', 1)
    P = P.replace('- green with small blue/white dots = little blue STAR FLOWERS in the grass (walkable).\n', '')
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath(STYLE)], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
