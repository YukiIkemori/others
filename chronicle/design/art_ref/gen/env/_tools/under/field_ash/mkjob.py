"""(ash copy of ../field_desert/mkjob.py) Job for one painted ash-land FIELD area. usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + style_field.png (a crop of the approved painted Caldera town: rendering only).
The prompt names no other game and no artist; the look words are generic."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']

SCENE = {
    'a_pass': """A HIGH PASS WHERE A DESERT ROAD ENTERS A VOLCANIC ASH LAND: tall jagged GREY-BROWN CRAGS dusted with pale ash frame the west entrance and run along the north-east; the old packed road runs east across rolling drifts of pale grey VOLCANIC ASH with a few patches of black cooled lava crust; groups of CHARRED DEAD TREES (bare black trunks and branches); a big rock that shelters a small trodden campsite; beside the road a toppled ancient waygate arch of black basalt; a side road forks south. Palette: ash greys from pale dove-grey to charcoal, warm grey-brown rock, black trees, dusty tan road; a faint warm haze. Desolate, quiet, the first breath of the fire land.""",
    'a_battle': """AN ANCIENT BATTLEFIELD in a shallow basin of grey VOLCANIC ASH ringed by low grey-brown crags: on the west the RUINED WALLS of a small square stone watch-fort with a paved yard; scattered clusters of RUSTED SWORDS, SPEARS AND BROKEN SHIELDS stuck upright in the ash; burial cairns of dark stones; a band of old cooled black lava crust across the east; a few charred dead trees; a trodden footpath from the north to a low paved mound in the south where a tall weathered stone monument shaped like a huge broken sword stands. Palette: ash greys, rust red-brown metal, bone-white stone, charcoal. Melancholy, still, centuries old.""",
    'a_lava': """A BLACK LAVA PLAIN in a volcanic land: wide fields of cooled black ROPEY LAVA CRUST (pahoehoe swirls and folds) mixed with patches of grey ash; bright glowing orange MOLTEN LAVA flows in a winding channel from the north into a large glowing LAVA LAKE in the south-west, and a second channel feeds the lake from the east; the main road crosses the northern channel on a raised causeway of fitted black basalt blocks; sharp glassy black OBSIDIAN RIDGES; on the east edge the tall rock wall of a crater town with carved basalt gate towers where the road passes through. Palette: charcoal and jet black crust with purple-grey sheen, ash grey, vivid orange-yellow lava with dark crust plates floating in it. Hot, dangerous, spectacular.""",
    'a_spa': """A SHELTERED HOT-SPRING VALLEY among grey-brown volcanic crags: a chain of TERRACED TURQUOISE HOT-SPRING POOLS with pale cream mineral rims (travertine ledges) steps down the valley from the dark round mouth of an old lava tube in the north cliff; lush green MOSS and hardy grass around the pools, grey ash ground, patches of dry sulphur-tinged grass, a few steaming rocks and small bushes; a footpath climbs from the south between the pools. Palette: turquoise and milky-blue water, cream rims, fresh moss green, warm greys. Warm, steamy, a hidden oasis of rest.""",
    'a_foot': """THE FOOT OF A GREAT ASH VOLCANO: on the west edge the tall rock wall of a crater town with carved black basalt gate towers where the road comes out; the steep black and dark-grey rocky FLANKS of the volcano's cone fill the east; cut into its west face an ancient carved ROCK DOOR (a round slab of black stone with bird-shaped hollows) with a small paved landing; a glowing orange LAVA STREAM pours down the cone's south side; boulder-strewn slopes of grey ash and black crust, a few charred trees; the road forks north and south. Palette: charcoal, basalt black, ash greys, glowing orange lava. Brooding, mighty, sacred.""",
    'a_bridge': """THE NORTH SHORE OF A VOLCANIC LAND AT A SEA STRAIT: dark blue-grey sea fills the north with small white-capped waves; a long old STONE BRIDGE on arched piers with low parapets runs straight north across the water from the shore; at its foot on the west a squat roadside INN of grey fieldstone with a steep dark slate roof and a chimney, a little paved yard before its door; a black shingle and cooled-lava shore with small tide pools; grey-brown crags east and west; grey ash ground and a road leading south. Palette: slate blue sea, grey stone, black shore, ash greys. Windy, lonely, a traveller's refuge.""",
    'a_beach': """A BLACK-SAND BEACH ON A VOLCANIC COAST: steaming dark crags along the north with two gaps where paths come down; a wide beach of BLACK VOLCANIC SAND with drifts of grey ash; clusters of HEXAGONAL BASALT COLUMNS; warm turquoise tide pools; huge rounded grey-green rocks that look like giant TURTLE SHELLS; in the east a glowing LAVA FLOW runs down into the surf; shallow foamy water, then the dark blue sea along the south. Palette: jet-black sand, charcoal basalt, grey-green shell rocks, turquoise pools, white surf, deep blue sea, orange lava. Wild, primeval, strange.""",
}

KEY = """- mid grey = open VOLCANIC ASH ground (walkable): flat grey ash with small pebbles, footprints, a few dry tufts.
- pale grey soft areas = ASH DRIFTS (walkable): smooth low drifts of pale grey ash with wind ripples, outlines free-flowing and organic (never square or stepped), blending softly into the flat ash (low, walkable, no cliffs).
- dark grey with light swirl strokes = COOLED LAVA CRUST (walkable, FLAT GROUND): black-grey ropey pahoehoe lava lying level with the ash around it, flat folds and swirls, slight purple-grey sheen; it blends softly into the ash with ragged natural edges: NO raised edges, NO rims, NO walls, NO steps, NO plateaus.
- green = MOSS and hardy GRASS (walkable, flat).
- grey-olive with short strokes = dry ash-grey SCRUB GRASS (walkable, low).
- dusty tan band = the ROAD: packed ash and earth with ruts and small stones along its edges (walkable).
- darker brown = a narrow FOOTPATH of trodden earth (walkable).
- slate grey with block lines = BASALT PAVING / flagstones or mineral ledges (walkable, flat).
- turquoise = warm WATER: hot-spring pools / tide pools (not walkable).
- dull teal = SHALLOW foamy water at the shore (walkable wet sand and surf).
- deep blue = the SEA (not walkable): dark water, small waves, white surf where it meets the shore.
- bright orange with yellow cracks = molten LAVA (not walkable): glowing orange-yellow molten rock with dark crust plates, a thin dark cooled rim at its banks.
- black branching marks = CHARRED DEAD TREES (not walkable): bare black trunks and branches.
- grey-olive circles = small hardy BUSHES (not walkable).
- dark grey circles = BOULDERS of dark volcanic rock (not walkable).
- all colour areas are LEVEL GROUND unless listed as not walkable; only the crags below are raised.
- grey-brown with horizontal strata and a light top edge = CRAGS / rock cliffs (not walkable): jagged layered grey-brown volcanic rock dusted with ash on top, sheer faces facing south, fallen rocks at the foot."""

# dungeon floors repainted from dng_ash.py (organic layouts): their own scene and key
DSCENE = {
    'ash_volcano_2': """THE CRATER AT THE TOP OF AN ASH VOLCANO, seen from above: a great LAKE OF MOLTEN LAVA fills the crater floor (bright orange-yellow molten rock with drifting plates of dark crust, cracks of yellow light); a natural ledge of dark basalt rock runs around the crater's inner wall from rough stone steps in the south, up the west side to a wide rim of glassy black OBSIDIAN in the north, and on along the east side; from the obsidian rim a narrow causeway of black stone runs south out over the lava to a small round island of obsidian in the middle, where a huge smooth glowing red-bronze EGG rests in a nest of black shards; outside the ledges, the dark jagged rock walls of the crater. Palette: basalt greys, jet black obsidian, charcoal walls, vivid orange lava. Awe-inspiring, sacred, hot.""",
    'ash_volcano_1': """THE FIRST FLOOR OF A VOLCANO'S CAVE, seen from above: winding caves of rough dark-grey basalt rock floor with smooth natural rounded walls; a round entrance hall in the south with a passage out at the bottom; a river of glowing MOLTEN LAVA runs north-south on its west side and a lava crevasse runs east-west across the passage north; where the passages cross them the lava has cooled into a walkable crossing of black crust; small lava pools; beyond, a big central cave with a west chamber and an east chamber (glassy black obsidian floor), and a passage north to a chamber of black obsidian before a round carved rock door; three ancient MURALS painted in red and gold on the rock walls. Palette: basalt greys, charcoal and rust-brown rock walls, jet black obsidian, vivid orange lava. Hot, ancient, sacred.""",
}
DKEY = """- mid grey = the walkable rock LEDGE / floor: rough dark-grey basalt with small stones and cinders, organic edges (never square or stepped).
- dark grey with light swirl strokes = walkable glassy black OBSIDIAN floor (flat).
- bright orange with yellow cracks = molten LAVA (not walkable): glowing orange-yellow molten rock with dark crust plates; the ledge ends in a thin broken lip of cooled rock where it meets the lava.
- dark grey circles = BOULDERS and heaps of cinders (not walkable).
- dark grey-brown = solid ROCK (not walkable): the cave / crater walls, jagged dark volcanic rock seen from above, their sheer faces showing where they rise above the floor; the wall outlines are smooth, rounded and natural like real lava caves: NEVER square, stepped or staircase-shaped, no right angles; everything outside the floors is solid rock."""
if aid in DSCENE:
    SCENE[aid] = DSCENE[aid]; KEY = DKEY

marks = []
seen = set()
for m in d['marks']:
    if m['kind'] in seen: continue
    seen.add(m['kind'])
    c = m['color']
    marks.append(f"- the blocks in colour rgb({c[0]},{c[1]},{c[2]}) = {m['text']}{'' if m['solid'] else ''}.")
cell = T * 48 // 32
WHAT = 'one floor of a volcanic cave dungeon' if aid in DSCENE else 'one outdoor area of a volcanic ash land'
P = f"""Paint the COMPLETE top-down map of {WHAT} in a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

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
Lighting: this is the ALBEDO base layer (the game darkens it into night at runtime and adds lamp light on top). Neutral, soft, even daylight-like light as in the style reference; NO darkness, NO night tint, NO long cast shadows, NO light pools, NO glow halo (molten lava is painted bright orange as a material, but casts no light onto its surroundings), NO vignette, NO fog, NO clouds over the map.
Do NOT paint any characters, people, animals, monsters, birds, treasure chests, lanterns, lamp posts, torches, campfires, tents, signs, signposts, text, letters, numbers, labels, grid lines, borders, frames or UI. Those are added later as separate sprites: leave the ground open for them.
"""
job = {"out": os.path.abspath(f'{aid}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath('style_ash.png')], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
