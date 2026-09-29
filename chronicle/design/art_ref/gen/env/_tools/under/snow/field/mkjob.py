"""Job for one painted SNOW FIELD area (copy of ../../field/mkjob.py with the snow scenes and key). usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + ../dng/style_snow.png (crop of the approved painted snow village Yule: rendering only).
The prompt names no other game and no artist; the look words are generic."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']

SCENE = {
    'f_snowpass': """A BLIZZARD MOUNTAIN PASS leading out of a great forest into a northern snowfield: a packed-snow road with sled ruts climbs north through a canyon between two massifs of grey crags heavy with snow, whose inner faces are steep ICE-GLAZED CLIFFS hung with icicles; a field of avalanche boulders half buried in snow on the canyon floor; a tall frozen waterfall on the east cliff with a frozen pool at its foot; an old stone cairn with a prayer post at the road's bend; the roofless ruin of a stone watch hut; a sheltered hollow among snowy firs in the south-west; dark snow-laden fir forest along the bottom edge (the forest side). Palette: blue-white snow with cool lilac shadows, slate-grey rock, glassy pale-blue ice, dark fir green, warm tan packed road. Harsh, windswept, grand.""",
    'f_lake': """A GREAT NORTHERN LAKE beside a snow village in deep winter: the lake has NOT frozen solid this year: its water is dark slate-blue and open, with drifting plates of thin ice and grey slush, ringed by a shelf of solid pale-blue shore ice; one straight band of thick solid white-blue ice crosses the lake from the south shore to the top edge (a frozen causeway); a rocky islet with a lone dead wind-bent tree; frozen reeds along the shores; on the west a towering wall of blue ICICLE CLIFFS of glacier ice hung with enormous icicles, the dark mouth of an ice cave in it; a packed-snow road from the south to the village's log palisade and gate on the east edge; snowy fir woods along the south and north-east. Palette: blue-white snow, slate and ink-blue water, glassy cyan ice, warm tan road, dark fir green, brown timber. Cold, still, eerie and beautiful.""",
    'f_peakfoot': """THE FOOT OF THE WHITE DRAGON'S MOUNTAIN above a snow village: a wind-swept snowfield with wind-carved drifts under a great massif of grey crags and snow that fills the top of the map and ends in a steep ice cliff; a monumental ancient stone arch carved with a coiled dragon set into the cliff foot, stairs vanishing into the dark passage behind it, a small flagstone forecourt; the colossal weathered rib bones and horned skull of an ancient dragon rising out of the snow beside the road; a frozen shrine: a ring of six tall snow-capped standing stones carved with flame runes around a round stone fire bowl on flagstones; groves of snow-laden firs; the village's log palisade along the bottom edge; a packed-snow road from the village north to the arch. Palette: blue-white snow, ivory bone, pale grey stone, slate crags, dark fir green, warm tan road. Solemn, mythic, vast.""",
    'f_eastroad': """A ROAD THROUGH A SNOWY PINE FOREST between a snow village and a mountain inn: a winding packed-snow road with sled ruts through a broad snowy clearing; dense dark fir forest heavy with snow along the top and bottom edges; a frozen stream from north to south with dark water under ice lips, crossed by a sturdy timber bridge; a giant ancient fir towering over the others by the road; a huge hollow fallen fir log half buried in snow; a woodcutter's lean-to of bark and boughs with split logs stacked under it; a trodden footpath branching south into the dark woods; the village's log palisade along the west edge; scattered firs, snowy shrubs and rocks. Palette: blue-white snow, deep fir green, bark browns, ink-blue stream, warm tan road. Quiet, deep, a little lonely, full of small tracks and fallen needles.""",
    'f_passinn': """A HIGH MOUNTAIN PASS WITH NATURAL HOT SPRINGS at the east end of a snowfield: several steaming pools of milky turquoise hot water among dark wet rocks and orange-and-cream mineral terraces, the snow melted away around them to bare wet stone; a warm stream running from them north-east along the foot of the crags with a small stone bridge where the road crosses; a packed-snow road from the west that forks north to the timber fence and roofed gate of a mountain inn at the top edge and east into a narrow gorge between massive grey crags heavy with snow (the gorge leaves the right edge); a tall stone cairn at the gorge mouth; snowy firs, dense fir forest along the bottom. Palette: blue-white snow, turquoise water, orange-cream mineral crust, dark wet stone, slate crags, warm tan road, brown timber. Welcoming warmth in a hard cold land.""",
    'f_floe': """PACK ICE ON A DARK NORTHERN SEA: several big floes of snow-covered ice with patches of bare glassy blue ice, separated by leads of black-blue open sea with small white ice chunks, joined by narrow necks of solid ice; pressure ridges of tumbled ice blocks on the floes; small icebergs in the leads; on the north-west a towering wall of translucent blue GLACIER ICE (the aurora cliffs) with the dark mouth of an ice cave; on the north-east an old three-masted sailing ship frozen fast in the pack ice, seen from above with snow on its deck and frost-white furled sails, its gangplank down to the ice on its south side; a large flat landing of smooth ice in the south. The ship and the ice cave are the ONLY structures: no huts, igloos, domes, houses, tents or doors anywhere else, and no trees or shrubs at all on the ice. Palette: ink-blue sea, blue-white snow, cyan and turquoise ice with faint green-violet glints, dark ship timber. Silent, remote, otherworldly.""",
}

KEY = """- white / very pale blue-white = open SNOW (walkable): soft snow with subtle drifts, footprints and wind ripples, cool lilac-blue shadows (flat, no objects standing on it).
- white with faint arcs = WIND-RIPPLED SNOW (walkable, flat, level with the snow around it).
- white with little tan strokes = SNOW with dry frozen grass tufts poking through (walkable, flat).
- tan = the ROAD: packed snow and earth with sled runner ruts, exactly like the paths of the style reference (walkable).
- darker brown-tan = a narrow trodden FOOTPATH (walkable).
- light cyan = solid thick ICE (walkable): glassy pale blue ice with white cracks and snow dust.
- dark slate blue with pale plates = OPEN WATER (not walkable): dark cold water with drifting thin ice plates and slush; in the hot springs it is milky turquoise and steaming.
- deep ink blue = the SEA (not walkable): black-blue cold sea with small ice chunks, white rims where it meets the ice.
- light grey with block lines = FLAGSTONES (walkable, flat, snow swept aside).
- brown boards = a timber BRIDGE deck (walkable) with low rails on both sides.
- dark green star-shaped crowns with white = SNOW-LADEN FIR TREES (not walkable), seen from above like in the style reference.
- dark green overlapping circles with white = DENSE SNOWY FIR FOREST (not walkable): an unbroken mass of snow-laden fir crowns.
- small brown-white blobs = low SHRUBS / frozen reeds under snow (not walkable).
- grey circles with white tops = BOULDERS / rocks capped with snow (not walkable).
- flat slate grey with white patches = a mass of high CRAGS / mountain rock heavy with snow (not walkable).
- blue-grey with horizontal strata and a white top edge = a steep ICE CLIFF / snowbank face (not walkable): vertical blue-white icy face with hanging icicles, snow on its lip, like the snowbank edges of the style reference."""

marks = []
seen = set()
for m in d['marks']:
    if m['kind'] in seen: continue
    seen.add(m['kind'])
    c = m['color']
    marks.append(f"- the blocks in colour rgb({c[0]},{c[1]},{c[2]}) = {m['text']}{'' if m['solid'] else ''}.")
cell = T * 48 // 32
P = f"""Paint the COMPLETE top-down map of one outdoor area of a snowy northern region of a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

THE PLACE: {SCENE[aid]}

The FIRST attached image is an exact LAYOUT GUIDE drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output; the output is {W * T} x {H * T} px). Trace over it: your painting is laid pixel-for-pixel on top of it and used directly as the walkable game map, so every road, shore, cliff, tree mass, water body and landmark must sit exactly where it is in the guide at the same size (keep every edge within a few pixels of the guide; do not shift, shrink, mirror or re-arrange anything; keep the exact width of the roads and of the one- and two-tile gaps).

The SECOND attached image is only a STYLE REFERENCE from the same game: match its pixel-art rendering (pixel size, clusters, outlines, colour ramps, level of detail). Do NOT copy anything from it (no houses, huts, ponds, paths or objects from it).

The guide is soft colour-coding only (its blurred edges only mean the edge is natural and free-flowing): do NOT copy its flat colours, straight tile steps, circles or stripes. Interpret every area as the real material with rich natural variation, and give shores, woods, meadows and cliffs natural, organic, slightly irregular outlines (bulging or receding by at most a third of a tile around the guide edge). Every shore, floe edge, ice edge and forest edge must be smooth and organic, NEVER stair-stepped along the tile grid. Make it feel like a real, exciting place to explore, full of small natural detail.

Guide colour key:
{KEY}
Landmarks (paint each exactly on its block, at the block's size):
{chr(10).join(marks)}
The snow ground is ONE CONTINUOUS LEVEL SNOWFIELD: do NOT paint raised snow terraces, plateaus, ledges, snowbank edges or icy blue rims anywhere on the open snow; the only raised faces are the ice cliffs drawn in the guide (blue-grey strata). Walkable areas must stay walkable-looking: no boulders, trees, fences or objects standing on them unless the guide shows them.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it into night at runtime and adds lamp light on top). Neutral, soft, even daylight-like light as in the style reference; NO darkness, NO night tint, NO long cast shadows, NO light pools, NO glow, NO vignette, NO fog, NO falling snow, NO blizzard haze, NO clouds over the map (weather is added at runtime).
Do NOT paint any characters, people, animals, monsters, birds, treasure chests, lanterns, lamp posts, torches, campfires, tents, signs, signposts, text, letters, numbers, labels, grid lines, borders, frames or UI. Those are added later as separate sprites: leave the ground open for them.
"""
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath('../dng/style_snow.png')], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
