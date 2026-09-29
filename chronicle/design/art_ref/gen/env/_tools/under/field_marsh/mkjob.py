"""(marsh copy of ../field_desert/mkjob.py) Job for one painted marsh FIELD area. usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + style_field.png (a crop of the approved painted marsh bog: rendering only).
The prompt names no other game and no artist; the look words are generic."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']

SCENE = {
    'm_north': """THE NORTHERN EDGE OF A MISTY PEAT MARSH where a mountain road comes down through a notch in a grey rocky ridge (top edge, grey weathered rock with heather and scree at its foot): below it open olive-green peat meadows with sedge tussocks and tiny white and yellow marsh flowers, black still pools fringed with tall golden-brown reeds, a slow dark reedy channel crossing the land from west to east with a small plank boardwalk carrying the muddy road over it, a crumbling round stone watchtower on a knoll, a turf-roofed peat-cutter's hut with stacks of cut peat, a few gnarled willows. Palette: olive and moss green peat, golden-brown reeds, black-teal water, grey stone. Damp, quiet, the first breath of the marsh.""",
    'm_west': """THE MISTY WEST SHORE OF A SHALLOW MARSH LAKE: the east half is calm grey-teal lake water with lily pads, a long wide boardwalk pier on posts runs straight out over the water to the edge of a lake town (east edge, fringed by a border of tall reeds), two small wooden bell towers on tall stilts stand in the lake; the west shore is peat meadow with sedge, black pools ringed with reeds, clumps of weeping willows, a muddy road running north to south, a thatched fisherman's hut on short stilts with nets drying on poles and a short jetty, and a collapsed stilt hut leaning over the water. Palette: teal-grey water, olive peat, golden reeds, weathered brown timber. Hushed, grey-green, wistful.""",
    'm_manor': """A DROWNED DEAD-WILLOW WOOD east of a lake town: on the west edge the town's lake with reeds and an old grey stone causeway with low mossy parapets crossing it; then masses of dark, dense, half-drowned dead trees and black pools, a winding muddy footpath through them; in the north-east the grounds of a gloomy manor: a rusted wrought-iron fence with square stone posts around an overgrown garden of long grass and a few dark willows, a paved forecourt and the grey stone manor house with steep dark slate roofs, gables, chimneys and a tall pointed spire, its arched door facing south. Palette: dark olive, black-green, slate grey, rust. Eerie, still, abandoned.""",
    'm_fen': """AN OPEN PEAT FEN WITH SUNKEN RUINS: in the middle a wide sheet of still teal water in which stand the broken pointed arches, pillar stumps and apse wall of a drowned grey stone chapel, part of its flagstone nave still above the water with a plank walkway leading out to it from the shore; around it olive peat meadows with sedge tussocks and marsh flowers, many black pools ringed by tall golden-brown reeds, a few dead trees and stumps, a muddy road curving round the west of the water with worn old flagstones showing through in places, a footpath east along the south shore. Palette: olive peat, golden reeds, teal and black water, mossy grey stone. Melancholy, open, haunted by old bells.""",
    'm_lotus': """A HIDDEN LOTUS POOL in the marsh: a round pool of calm teal water densely covered with big round lotus leaves and closed pale lotus buds, a plank jetty running out from the south shore to a little platform in the middle, a fringe of reeds; around it low peat hummocks with soft green grass, sedge, many tiny white and violet marsh flowers, clusters of pale mushrooms, a few clumps of weeping willows and two small black pools; a trodden footpath looping round the pool from the west to the north. Palette: teal water, fresh green leaves, olive peat, soft pale flowers. Secret, gentle, dreamlike.""",
    'm_bog': """THE EDGE OF A DARK BOG: on the west a solid wall of drowned black dead trees with twisted bare branches and a narrow dark gap where a path disappears into the bog; black still pools ringed with reeds and sedge; in a larger black pool on the east the mossy top of an old square stone bell tower sunk to its belfry, a rusted tilted bell visible in its open arches, a short plank walk leading to it; an old weathered stone stele beside a footpath; muddy road running north to south across olive peat with patches of bare wet mud; more dead trees in the north-east corner. Palette: black-teal water, dark olive, grey-brown mud, mossy grey stone. Ominous, cold, the place where the mist comes from.""",
}

KEY = """- olive green = PEAT MEADOW (walkable): soft damp olive-green grass on peat, small tufts, puddles, footprints.
- olive with short strokes = SEDGE TUSSOCKS (walkable, low).
- green with little dots = MARSH FLOWERS in the grass (walkable, low).
- mid brown band = the MUDDY ROAD: trodden wet earth with ruts, puddles and a few flat stones (walkable).
- darker brown = a narrow FOOTPATH of trodden earth (walkable).
- grey-brown patch = bare wet MUD FLAT (walkable).
- brown boards = a BOARDWALK / plank bridge on posts (walkable deck).
- light grey with block lines = old worn FLAGSTONES (walkable, flat).
- teal = OPEN LAKE / POOL WATER (not walkable): calm grey-teal water with lily pads and ripples.
- black-teal = a BLACK BOG POOL (not walkable): dark still water, a little duckweed.
- golden with vertical strokes = a dense bed of TALL REEDS / bulrushes (not walkable).
- round green crowns = WILLOWS / gnarled swamp trees (not walkable).
- very dark green masses = DROWNED DEAD WOOD: dense dark twisted dead trees standing in black water (not walkable).
- grey circles = BOULDERS or old tree STUMPS (not walkable).
- grey with horizontal strata = a grey ROCK RIDGE (not walkable): weathered grey rock with heather, sheer faces facing south."""

marks = []
seen = set()
for m in d['marks']:
    if m['kind'] in seen: continue
    seen.add(m['kind'])
    c = m['color']
    marks.append(f"- the blocks in colour rgb({c[0]},{c[1]},{c[2]}) = {m['text']}{'' if m['solid'] else ''}.")
cell = T * 48 // 32
P = f"""Paint the COMPLETE top-down map of one outdoor marsh area of a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

THE PLACE: {SCENE[aid]}

The FIRST attached image is an exact LAYOUT GUIDE drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output; the output is {W * T} x {H * T} px). Trace over it: your painting is laid pixel-for-pixel on top of it and used directly as the walkable game map, so every road, shore, cliff, tree mass, water body and landmark must sit exactly where it is in the guide at the same size (keep every edge within a few pixels of the guide; do not shift, shrink, mirror or re-arrange anything; keep the exact width of the roads and of the one- and two-tile gaps).

The SECOND attached image is only a STYLE REFERENCE from the same game: match its pixel-art rendering (pixel size, clusters, outlines, colour ramps, level of detail). Do NOT copy anything from it (no houses, towers, ponds, paths or objects from it).

The guide is soft colour-coding only (its blurred edges only mean the edge is natural and free-flowing): do NOT copy its flat colours, straight tile steps, circles or stripes. Interpret every area as the real material with rich natural variation, and give shores, woods, meadows and cliffs natural, organic, slightly irregular outlines (bulging or receding by at most a third of a tile around the guide edge). Make it feel like a real, exciting place to explore, full of small natural detail.

Guide colour key:
{KEY}
Landmarks (paint each exactly on its block, at the block's size):
{chr(10).join(marks)}
Walkable areas must stay walkable-looking: no boulders, trees, fences or objects standing on them unless the guide shows them.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it into night at runtime and adds lamp light on top). Neutral, soft, even daylight-like light as in the style reference; NO darkness, NO night tint, NO long cast shadows, NO light pools, NO glow, NO vignette, NO mist, NO fog, NO clouds over the map.
Do NOT paint any characters, people, animals, monsters, birds, treasure chests, lanterns, lamp posts, torches, campfires, tents, signs, signposts, text, letters, numbers, labels, grid lines, borders, frames or UI. Those are added later as separate sprites: leave the ground open for them.
"""
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath('style_marsh.png')], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
