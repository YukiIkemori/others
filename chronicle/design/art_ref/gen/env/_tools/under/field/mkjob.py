"""Job for one painted FIELD area. usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + style_field.png (crops of the approved painted village and harbour: rendering only).
The prompt names no other game and no artist; the look words are generic."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']

SCENE = {
    'f_roa': """ROLLING SHEEP HILLS on a quiet peninsula at the edge of a storytellers' hill village: soft green pasture hills, patches of taller meadow grass and wild flowers, a winding packed-earth road with cart ruts and grass down its middle, a clear little creek with pebbly banks meandering north to south, an arched grey stone bridge where the road crosses it, old woods along the west and south edges, a rocky ridge of grey crags in the north-east beyond the creek, groves of broad-leaf trees, a pond with reeds, an old stone windmill on the far bank of the creek. Early-summer palette: fresh bright greens, buttercup yellows, pale stone. Calm, pastoral, lived-in and a little mysterious (the old stones, the old well).""",
    'f_cape': """A WINDSWEPT SEA CAPE at the southern end of a green peninsula: a grassy plateau of wind-combed grass and heather with a packed-earth road running east to the grey stone gatehouse of a harbour town, a narrow footpath winding south along the cape's spine to a tall old lighthouse standing on the rocky tip; HIGH SEA CLIFFS of layered brown-grey rock drop into a deep blue-green sea along the south-east with white surf at their foot; on the west a sheltered cove with a pale sandy beach, tide pools and wet rocks, turquoise shallows; a few rugged sea stacks with birds' ledges stand offshore; groves of wind-bent trees. Palette: sea-washed greens, heather mauve and sea-pink thrift on the cliff tops, grey-brown rock, deep blue-green sea, pale sand. Dramatic, fresh, open to the sky.""",
    'f_lookout': """A HEATHER HEATH ON THE NORTH SHORE of a green peninsula, facing a grey-green sea strait: rolling moorland carpeted with purple and pink heather and gorse, a packed-earth road running north to a stone abutment and a long timber DRAWBRIDGE on massive stone piers striding out across the strait to the far shore (the far end leaves the top edge), a shingle beach of grey pebbles with an upturned old boat, a copse of white-barked birches, and in the east a high grassy BLUFF above the sea behind a rock face with a stair cut through it, a wooden lookout tower and a bench at its top. Palette: heather purple and mauve, gorse yellow, silver birch, slate-grey sea. Wild, airy, a little lonely.""",
}

KEY = """- mid green = open GRASS (walkable): short grass with natural variation, clover, tiny flowers, worn patches (FLAT, no objects standing on it).
- darker green with short strokes = TALL MEADOW GRASS or heather (walkable, low).
- green with coloured dots = WILD FLOWERS in the grass (walkable, flat).
- tan = the ROAD: packed earth with cart ruts, small stones, grassy edges, natural width (walkable).
- brown = a narrow FOOTPATH of trodden earth (walkable).
- pale sand = SAND / BEACH (walkable), with a few pebbles.
- light blue = SHALLOW water (walkable tidal flat / ford): wet sand and pebbles under clear water.
- mid blue = a CREEK or POND of fresh water (not walkable) with natural banks.
- deep blue = the SEA (not walkable): deep blue-green water, small waves, white surf where it meets rock or sand.
- light grey with block lines = FLAGSTONES (walkable, flat).
- brown boards = a BRIDGE deck (walkable); on a creek it is an arched stone bridge with low parapets on both sides of the deck.
- mid green circles on grass = TREES (not walkable): big leafy crowns seen from above with trunks and roots at their foot.
- dark green overlapping circles = DENSE FOREST (not walkable): an unbroken mass of tree crowns.
- light green small circles = BUSHES (not walkable).
- grey circles = BOULDERS or rocks (not walkable) lying on the grass or sand.
- brown with horizontal strata and a light top edge = a CLIFF or rock face (not walkable): natural layered rock, cracks, tufts of grass on ledges; where it borders the sea, surf at its foot."""

marks = []
seen = set()
for m in d['marks']:
    if m['kind'] in seen: continue
    seen.add(m['kind'])
    c = m['color']
    marks.append(f"- the blocks in colour rgb({c[0]},{c[1]},{c[2]}) = {m['text']}{'' if m['solid'] else ''}.")
cell = T * 48 // 32
P = f"""Paint the COMPLETE top-down map of one outdoor area of a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

THE PLACE: {SCENE[aid]}

The FIRST attached image is an exact LAYOUT GUIDE drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output; the output is {W * T} x {H * T} px). Trace over it: your painting is laid pixel-for-pixel on top of it and used directly as the walkable game map, so every road, shore, cliff, tree mass, water body and landmark must sit exactly where it is in the guide at the same size (keep every edge within a few pixels of the guide; do not shift, shrink, mirror or re-arrange anything; keep the exact width of the roads and of the one- and two-tile gaps).

The SECOND attached image is only a STYLE REFERENCE from the same game: match its pixel-art rendering (pixel size, clusters, outlines, colour ramps, level of detail). Do NOT copy anything from it (no houses, towers, ponds, paths or objects from it).

The guide is flat colour-coding only: do NOT copy its flat colours, straight tile steps, circles or stripes. Interpret every area as the real material with rich natural variation, and give shores, woods, meadows and cliffs natural, organic, slightly irregular outlines (bulging or receding by at most a third of a tile around the guide edge). Make it feel like a real, exciting place to explore, full of small natural detail.

Guide colour key:
{KEY}
Landmarks (paint each exactly on its block, at the block's size):
{chr(10).join(marks)}
Walkable areas must stay walkable-looking: no boulders, trees, fences or objects standing on them unless the guide shows them.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it into night at runtime and adds lamp light on top). Neutral, soft, even daylight-like light as in the style reference; NO darkness, NO night tint, NO long cast shadows, NO light pools, NO glow, NO vignette, NO fog, NO clouds over the map.
Do NOT paint any characters, people, animals, monsters, birds, treasure chests, lanterns, lamp posts, torches, campfires, tents, signs, signposts, text, letters, numbers, labels, grid lines, borders, frames or UI. Those are added later as separate sprites: leave the ground open for them.
"""
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath('style_field.png')], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
