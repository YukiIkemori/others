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
    'f_cross': """VAST OPEN PLAINS below the foothills of the northern mountains in late summer: rolling prairie of GOLDEN and ochre grass waving in the wind with swathes of taller grass and cornflowers, a grand three-way crossroads of wide packed-earth roads, an old milestone cairn at its corner; a reedy lake with a wooden fishing jetty; the grassy ruin of an old coaching inn; a lone rune stone; a travellers' camp and a caravan wagon; grey crags and dark firs along the mountain foot at the top; the strait with the drawbridge's far end at the bottom. Palette: gold, straw, ochre and sage, blue lake, grey rock. Wide, open, full of wind and distance.""",
    'f_hut': """A LOGGING CLEARING AT THE EDGE OF A GREAT OLD FOREST: a sunny felled clearing full of cut stumps, sawdust and wood chips, stacks of cut logs and felled trunks, a sturdy log cabin with a stone chimney (the woodcutters' rest hut), a sawhorse; a clear creek running north to south with a small waterfall over a mossy rock ledge in the north and a log footbridge where the road crosses; bracken and ferns; tall oaks, beeches and firs closing in thick on the west, north and south; the road runs east out to the plains and west into the dark forest. Palette: warm honey browns of cut wood, fresh green bracken, deep forest green, clear blue water. Busy, homely, earthy.""",
    'f_fern': """A DEEP ANCIENT ENCHANTED FOREST on the road to a forest village: colossal mossy trees with buttress roots and enormous crowns, a thick unbroken canopy with glades and small clearings, a winding old forest road of packed earth with roots across it, the great root arch of the village's south gate at the top edge, a DEEP RAVINE with mossy rock walls and a stream at its bottom cutting across the south-west, crossed by a rope-railed log bridge, a small ledge on its far side; moss-covered boulders, ferns, a fairy ring of pale mushrooms. Palette: deep emerald and moss green, dark bark browns, cool blue-green shade, specks of pale glowing fungus. Hushed, ancient, magical.""",
    'f_windhill': """WINDY HIGHLAND DOWNS at the north-west edge of the great forest, under a big sky: pale silvery-green windswept grass and heath, grey granite tors, a BALD GRASSY HILL ringed by a low rock rim with worn steps, its top crowned by tall wind-worn rocks pierced with holes that hum in the wind, a dark cold tarn among boulders, a fallen colossal statue of a robed figure lying in a woodland clearing, a travellers' camp; the road to a moss village leaves at the top-left and a road climbs to a narrow mountain pass between crags at the top-right; dense dark forest to the south-west where the enormous crown of the THOUSAND-YEAR TREE rises far above every other tree. Palette: silver-green and pale straw grass, cool grey granite, dark pine green, steel-blue tarn. Bleak, lofty, windswept, mysterious.""",
    'f_south': """SUNLIT FOREST GLADES in early autumn on the southern edge of a great forest: broad grassy glades linked by a winding road and trails through mixed woods of oak, birch and pine turning gold, amber and russet; a clear brook meandering west to east with stepping-stone fords where the paths cross it; a woodcutters' camp in a sunny glade; the forest's south square, a clearing ringed by old mossy stone pillars around a carved floor stone; the twin watchtowers under repair with scaffolding and ladders; the crumbling old forest tower overgrown with roots in the west; three leaning standing stones; at the bottom the road enters a narrow rocky pass of reddish sandstone crags where the grass turns dry and sandy (the way to the desert). Palette: gold, amber, russet and olive, warm sandstone red at the pass. Warm, golden, nostalgic.""",
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
# 見やすさの作り直し（持ち主 2026-10-04「ギザギザ」「汚い」「花々とか細かいのいらん」）: meta clean = 大きくはっきりした形、細かい物を散らさない。
#   絵の手本は ../field_marsh/style_clean.png（描き直した山あいの街道 s_road の切り抜き。STYLE=... で替えられる）。配置は areas.py の CLEAN_AREAS
SCENE_CLEAN = {
    'f_cross': """VAST OPEN PLAINS below the foothills of the northern mountains in late summer: broad calm rolling grassland of soft golden-green grass, a grand three-way crossroads of wide packed-earth roads (west, east, and south to the bridge landing), an old milestone cairn at its corner; a calm blue lake with a smooth grassy shore and a wooden fishing jetty; the grassy ruin of an old coaching inn with a flagstone floor and low broken walls; a lone rune stone; a small trodden camp ground and a caravan wagon; along the top edge a continuous band of dark fir forest and grey crags at the mountain foot; along the bottom a smooth pale beach and the deep blue strait with the drawbridge's far end and its flagstone landing. Palette: golden-green and sage grass, warm tan road, blue water, dark fir green, grey rock. Wide, open, calm and clear.""",
}
CLEAN = """
CLARITY (most important): this map must read clearly at a glance. Use LARGE, SIMPLE, CLEAN shapes with SMOOTH flowing outlines: broad calm areas of plain grass, clear wide roads, clear water with smooth shores, clear tree masses and clear rock. The edge of every area is a smooth natural curve, never a stair-stepped, zigzag or ragged tile edge. Do NOT scatter small details: NO flowers, NO flower dots, NO scattered pebbles or small stones, NO lone tiny bushes or tufts on the grass, NO tiny puddles, NO speckled noise texture, NO grid-like rows of rocks or tufts. The grass is a calm, softly varied texture with gentle colour ramps; the road is a clean band of packed earth with soft edges. Keep the level of detail like a clean, polished classic 16-bit JRPG overworld field: tidy, uncluttered, calm and easy to read."""
STYLE_REF = 'style_field.png'
if (d.get('meta') or {}).get('clean'):
    STYLE_REF = os.environ.get('STYLE', '../field_marsh/style_clean.png')
    P = P.replace(SCENE[aid], SCENE_CLEAN.get(aid, SCENE[aid]))
    P = P.replace('lush natural detail', 'clean polished detail').replace(' Make it feel like a real, exciting place to explore, full of small natural detail.', ' Make it feel like a real, quiet place to explore.')
    P = P.replace('short grass with natural variation, clover, tiny flowers, worn patches', 'calm short grass with gentle natural variation')
    P = P.replace(' with cart ruts, small stones, grassy edges, natural width', ' with soft grassy edges, natural width').replace(', with a few pebbles', '')
    P = P.replace('- green with coloured dots = WILD FLOWERS in the grass (walkable, flat).\n', '').replace('- darker green with short strokes = TALL MEADOW GRASS or heather (walkable, low).\n', '')
    P = P.replace('\nGuide colour key:', CLEAN + '\n\nGuide colour key:', 1)
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath(STYLE_REF)], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
