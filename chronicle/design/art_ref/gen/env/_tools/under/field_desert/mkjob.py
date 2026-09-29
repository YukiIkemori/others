"""(desert copy of ../field/mkjob.py) Job for one painted desert FIELD area. usage: python3 mkjob.py <id> <name> [T=48]
refs: <id>/guide_<T>.png (the layout, traced) + style_field.png (a crop of the approved painted desert town: rendering only).
The prompt names no other game and no artist; the look words are generic."""
import json, sys, os
aid, name = sys.argv[1], sys.argv[2]
T = int(sys.argv[3]) if len(sys.argv) > 3 else 48
d = json.load(open(aid + '/layout.json'))
W, H = d['w'], d['h']

SCENE = {
    'd_pass': """THE EDGE OF A GREAT SAND DESERT where a road comes down out of a red sandstone gorge from the forests in the north: towering layered RED SANDSTONE CLIFFS and mesas at the top framing the road, tufts of dry golden grass and a few dusty shrubs near the gorge, then open pale sand and rippled golden dunes; a walled CARAVANSERAI of mud brick with rounded corner towers on the west; a small spring pool with date palms and green grass; in the north-east a mass of wind-carved red rock towers with a narrow gully cut into it. Palette: warm pale sand, honey-gold dunes, rust-red and ochre sandstone, touches of green at the spring. Hot, bright, the first breath of the desert.""",
    'd_west': """A WIDE DESERT PLAIN outside the west wall of an oasis trading town: pale sand and long rippled golden dunes, packed caravan roads with hoof prints and cart ruts meeting at the town's great arched gatehouse in a tall MUD-BRICK CITY WALL (east edge) with date palms along it; in the west a huge flat-topped RED ROCK MESA with sheer layered cliffs and a dark cave mouth at its foot (a bandits' den); in the middle a wide flat pan of pale CRACKED CLAY with a lone low stone slab (the place where a phantom night market appears). Palette: pale sand, honey-gold dunes, rust-red mesa, buff mud brick, bone-white clay. Vast, sunlit, mysterious.""",
    'd_east': """AN OLD PAVED DESERT ROAD running east from the east gate of an oasis town (tall mud-brick city wall on the west edge) along the sandy shore of a deep blue sea strait (north edge), across a dazzling white SALT PAN, over an old sandstone bridge spanning a dry rocky ravine (wadi), to a pass between grey-brown crags dusted with volcanic ash on the east edge. An oil caravan's covered wagon rests by the road. Palette: pale sand, white salt crust, rust and ochre rock, ash-grey crags, deep blue sea. Hot, dusty, a long road.""",
    'd_south': """A GREAT SEA OF DUNES south of an oasis town down to the southern sea: tall smooth golden dunes with sharp crests and wind ripples, hard flat sand where well-diggers dug, a tiny oasis of date palms around a blue pool with green grass in the middle, low red rock crests, a trampled nomad camp ground in the east, and at the bottom a pale beach where the carved tops of huge half-buried TEMPLE PILLARS and a stone doorway stick out of the sand, with the blue sea and white surf along the bottom edge. Palette: honey-gold and amber dunes, pale sand, rust rock, turquoise and deep blue sea. Grand, silent, sun-bleached.""",
    'd_caravan': """A CARAVAN TRACK winding across rolling golden DUNE RIDGES and scattered RED ROCK OUTCROPS in the deep desert: the packed track with camel prints and wheel ruts forks west and north-west; a ring of tall red rocks with a narrow cleft leading into it (a caravan camp with a well inside, not visible); a low rocky knoll in the south crowned with old standing stones, two tall stones carved with stars and crescent moons flanking a path onto it; the sheer sandstone walls of a wind-scoured hollow reach in from the north-west. Palette: amber and honey dunes with long ripples, pale sand, rust-red rock, bleached bones. Lonely, vast, travelled.""",
    'd_hollow': """A WIND-SCOURED DESERT HOLLOW enclosed by sheer layered SANDSTONE CLIFFS: inside, swirling curved dune ridges and streaks of wind-blown sand, strange wind-carved HOODOO rock pillars and small arches, a rocky overhang in the middle whose shadowed hollow shelters an old camp (a dark gap under the overhang); faint trail marks across the sand from an opening in the east wall to one in the west wall. Palette: ochre and amber sand streaked with pale ripples, deep rust and purple-brown cliffs. Eerie, windy, closed-in.""",
    'd_coast': """THE WESTERN SHORE OF A DESERT: a deep blue sea with white surf along the west edge, a pale beach with shells and driftwood, rolling golden dunes inland, a sandy road running north; a small square MUD-BRICK HUT with a flat palm-trunk roof and a dry stone well beside it; red sandstone cliffs on the east; at the top a great RED SANDSTONE CLIFF with a gap where the road enters a hidden oasis valley, and in front of it date palms, green grass, a tall weathered OBELISK and a broken pillar (the approach to a royal tomb). Palette: deep blue sea, pale sand, honey dunes, rust-red cliffs, green palms. Wild, windswept, sacred.""",
    'desert_camp1': """A CARAVAN CAMPSITE called "the Rock Well" in a sheltered sandy hollow among big RED SANDSTONE ROCK OUTCROPS in the deep desert: the outcrops are wind-carved layered rock masses with flat eroded tops and sheer south faces; inside the hollow flat pale sand, trampled ground and a patch of cracked clay where the camp fire burns in the middle, a trodden track leaving south between rippled golden dunes. Palette: pale sand, honey dunes, rust-red rock. Sheltered, warm, a place to rest.""",
    'desert_camp2': """A CARAVAN CAMPSITE called "the Star Stone" on open ground in the dunes: a wide sandy hollow with trampled ground and a patch of cracked clay for the camp fire in the middle, a few low blocks of eroded pale SANDSTONE (ancient ruined wall stumps) at its edges and a low red rock outcrop in the south-east, a trodden track leaving south between rippled golden dunes. Palette: pale sand, honey dunes, pale sandstone, rust rock. Open to the sky and the stars.""",
    'desert_camp3': """THE ROYAL TOMB OASIS: a hidden oasis at the foot of a sheer red sandstone cliff into which the carved facade of an ancient king's tomb is cut (top right); a paved forecourt of worn flagstones before the tomb doorway, a track across the sand from the south up to it; on the left an old half-dried spring: a small blue pool ringed by green grass; pale sand and rippled golden dunes around. Palette: pale sand, honey dunes, rust-red cliff, green grass, blue water. Sacred, hushed, ancient.""",
    'desert_mirage': """THE GROUND OF A PHANTOM NIGHT MARKET in the middle of the desert: a wide flat sandy clearing among rippled golden dunes, two crossing market streets of pale packed cracked clay (east-west and north-south) and a round plaza of worn flagstones where they meet, faint marks where stalls and carpets stood. Palette: pale sand, honey dunes, bone-white clay, grey flagstones. Strange, empty, expectant.""",

}

KEY = """- pale sand colour = open SAND (walkable): flat pale desert sand with small pebbles, footprints, faint ripples.
- pale sand with orange arc strokes = rolling DUNES (walkable): smooth honey-golden dunes with wind ripples and soft crests, their outlines free-flowing and organic (never square or stepped), blending softly into the flat sand (low, walkable, no cliffs).
- beige with crack lines = flat CRACKED CLAY or SALT PAN (walkable): dry cracked mud plates, pale crust.
- olive with short strokes = tufts of DRY DESERT GRASS (walkable, low).
- green = GRASS of an oasis (walkable, flat).
- tan-brown band = the CARAVAN ROAD: packed sand and earth with cart ruts, camel prints, small stones along its edges (walkable).
- darker brown = a narrow FOOTPATH of trodden earth (walkable).
- light grey with block lines = FLAGSTONES / worn paving (walkable, flat).
- brown boards = a BRIDGE deck (walkable).
- mid blue = a POOL of fresh water (not walkable) with a green reedy bank.
- deep blue = the SEA (not walkable): deep blue water, small waves, white surf where it meets sand or rock.
- green star shapes = DATE PALMS (not walkable): palm crowns seen from above, trunks and a little shade at their foot.
- olive circles = THORNY DESERT SCRUB / small bushes (not walkable).
- red-brown circles = BOULDERS of red sandstone (not walkable).
- red-brown with horizontal strata and a light top edge = a SANDSTONE CLIFF or rock mass (not walkable): layered red and ochre rock, flat eroded tops, sheer faces facing south, fallen rocks at the foot."""

marks = []
seen = set()
for m in d['marks']:
    if m['kind'] in seen: continue
    seen.add(m['kind'])
    c = m['color']
    marks.append(f"- the blocks in colour rgb({c[0]},{c[1]},{c[2]}) = {m['text']}{'' if m['solid'] else ''}.")
cell = T * 48 // 32
P = f"""Paint the COMPLETE top-down map of one outdoor desert area of a fantasy JRPG world as ONE finished game map image, in rich premium modern hi-bit pixel art (hand-placed crisp square pixels, hue-shifted colour ramps, dark warm outlines, lush natural detail), classic top-down RPG map view seen from above with a slight 3/4 tilt (tree crowns, rocks and buildings seen from above with their south-facing sides visible; NOT an isometric view, NOT a diorama, no depth-of-field, no tilt-shift, no 3D render, no perspective).

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
       "refs": [os.path.abspath(f'{aid}/guide_{T}.png'), os.path.abspath('style_desert.png')], "tag": f"{aid}_under"}
json.dump(job, open(f'{aid}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'], len(P))
