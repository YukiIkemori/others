"""Job for one painted DESERT dungeon underlay (adapted from ../dungeon/mkjob.py). usage: python3 mkjob.py <map> <T> <name> [extra text]
refs: maps/<map>/guide_<T>.png (the layout, traced; OPEN state) + style_desert.png (a crop of the approved painted Kasim, style only)."""
import json, sys, os
m, T, name = sys.argv[1], int(sys.argv[2]), sys.argv[3]
extra = sys.argv[4] if len(sys.argv) > 4 else ''
md = 'maps/' + m
d = json.load(open(md + '/layout_data.json'))
W, H = d['w'], d['h']

SAND_WALL = """- dark brown = the SOLID MASONRY and bedrock around the halls seen from above (not walkable): the dark tops of massive old sandstone walls, big weathered blocks with deep joints, drifted sand in the cracks, a few fallen stones; it reads clearly as solid, unlit mass.
- tan bands with vertical strokes (one or two tiles tall) = the VERTICAL FACES of those sandstone walls facing the viewer (south): large dressed sandstone blocks in courses, carved bands of faded hieroglyph-like sun and eye motifs, chipped edges, a lit lip along the top edge; each face is exactly as tall as its band and its foot ends exactly on the floor edge below it.
- a single tan square alone on the floor = a thick square SANDSTONE PILLAR seen from above: its square base fills exactly that one tile, the top of the column (carved capital) shows inside the same tile; nothing of it spills onto the neighbouring floor tiles."""
CAVE_WALL = """- dark purple-grey = the SOLID ROCK of the mesa seen from above (not walkable): rough dark red-brown rock tops with cracks and ledges, drifted sand in the hollows.
- brown bands with vertical strokes (two tiles tall) = the VERTICAL ROCK FACES of the cave walls facing the viewer (south): layered red and ochre sandstone strata with a lit lip along the top edge; each face is exactly as tall as its band and its foot ends exactly on the floor edge below it."""
PAVE = "- pale beige with thin joints = the walkable FLOOR of big worn SANDSTONE FLAGSTONES (FLAT): cracked slabs, sand in the joints, faded carved border lines here and there."
SAND = "- pale yellow with dots = SAND drifted in over the floor (walkable, FLAT): soft ripples and footprints, its edges blending naturally into the paving."
CARPET = "- red with gold lines = a long faded ROYAL CARPET / woven runner lying flat on the floor (walkable), deep madder red with a gold and indigo border pattern."
MAPS = {
    'desert_tomb_1': ("THE TOMB OF THE NAMELESS SAND KING, FIRST FLOOR (\"the tomb keepers' galleries\"): a great buried royal tomb of sandstone deep under the desert. A wide entrance hall in the south, a long central gallery running north, a great gallery in the north, two wings with square pillars west and east, and small side chambers. Ancient, silent, dusty.", SAND_WALL + "\n" + PAVE + "\n" + SAND),
    'desert_tomb_2': ("THE TOMB OF THE NAMELESS SAND KING, SECOND FLOOR (\"the hall of quicksand\"): deeper, older and more ruined: a long western gallery, a pillared lamp hall in the middle, and in the south a great sunken chamber whose floor is buried under deep SAND (the lair of a giant sand worm), with a winding channel of sand running east and then north along a wall.", SAND_WALL + "\n" + PAVE + "\n" + "- pale yellow with dots = deep drifted SAND covering the floor (walkable, FLAT): soft wind ripples, a few half-buried stone blocks at its edges only, old bones sticking out at the very edges."),
    'desert_tomb_3': ("THE TOMB OF THE NAMELESS SAND KING, THIRD FLOOR (\"the king's hall\"): the deepest floor: a southern hall, two long side wings, a pillared antechamber with a small spring basin, and in the north the THRONE HALL of the nameless king, covered with a great faded royal carpet.", SAND_WALL + "\n" + PAVE + "\n" + CARPET),
    'desert_temple_1': ("THE SUNKEN TEMPLE OF THE SUN PEOPLE, FIRST FLOOR (\"the hall of pillars\"): an old temple swallowed by the dunes; a great hall full of regular rows of square sandstone pillars, sand pouring in through breaches, small side chambers west and east, an entrance chamber in the north and an inner chamber in the south behind a sealed wall. Sun-disc motifs everywhere, a lighter, more golden sandstone than the tomb.", SAND_WALL.replace('massive old sandstone walls', 'massive golden sandstone walls') + "\n" + PAVE + "\n" + SAND),
    'desert_temple_2': ("THE SUNKEN TEMPLE OF THE SUN PEOPLE, SECOND FLOOR (\"the sanctum of the sun disc\"): a great sanctum with four square pillars and an altar carpet at its north end, an antechamber west, a treasure room east, and a stair hall in the south. Gold-leaf sun discs inlaid in the floor paving of the sanctum, golden sandstone.", SAND_WALL.replace('massive old sandstone walls', 'massive golden sandstone walls') + "\n" + PAVE + "\n" + SAND + "\n" + CARPET),
    'desert_hawks_1': ("THE HIDEOUT OF THE SAND HAWKS, LOWER CAVE (\"the lookout cave\"): a bandit gang's hideout in natural caves inside a red rock mesa: a big entrance cavern in the south, one narrow passage north to a central cavern, a sleeping cave west with an old rug, a store cave east with a small pool of stolen water, a lookout nook and a sand-filled nook.", CAVE_WALL + """
- brown = the walkable CAVE FLOOR of packed reddish earth and flat worn rock (FLAT), boot prints, scattered straw and pebbles.
- pale yellow with dots = SAND blown in (walkable, FLAT).
- red-brown with cracks = trodden cracked CLAY (walkable, FLAT).
- red with gold lines = an old woven RUG lying flat on the floor (walkable).
- blue = a small POOL of clear water in a rock basin (not walkable)."""),
    'desert_hawks_2': ("THE HIDEOUT OF THE SAND HAWKS, UPPER CAVE (\"the chief's hall\"): a big cavern in the red rock mesa where the bandit chief holds court, with a long woven carpet leading to a raised flat stone dais (the chief's seat) at the north, a small side cave west and a treasure nook east.", CAVE_WALL + """
- brown = the walkable CAVE FLOOR of packed reddish earth and flat worn rock (FLAT).
- red with gold lines = a big woven CARPET of the bandits lying flat on the floor (walkable), madder red and indigo with a gold border.
- light grey = a low flat DAIS of smooth pale stone slabs at the head of the carpet (walkable, flat)."""),
    'desert_rocks': ("THE DIAMOND LIZARDS' ROCKS: an open, sun-baked hollow among jagged red rocks in the desert (outdoors, seen from above), a sandy floor with patches of cracked clay, a few big boulders standing in the middle, a sandy track coming in from the south.", """- grey circles on grey = jagged RED SANDSTONE ROCKS and boulders (not walkable): seen from above as rough rock tops, fissures, a little dry scrub in cracks.
- orange-brown bands (one tile) = the low vertical ROCK FACES of those rocks facing the viewer (south), with a lit lip on top, exactly one tile tall, the foot ending exactly on the ground below.
- pale yellow with dots = walkable desert SAND (FLAT): wind ripples, pebbles, lizard tracks.
- red-brown with cracks = patches of sun-cracked CLAY (walkable, flat).
- brown = the dirt TRACK leading in from the south edge (walkable, flat)."""),
    'desert_oldcamp': ("AN OLD ABANDONED CARAVAN CAMP in the lee of four sandstone rock outcrops in the middle of the dunes (outdoors, seen from above): an open sandy hollow, the cracked clay patch of an old fire place in the middle, a track leaving to the east.", """- dark brown = the tops of big SANDSTONE ROCK OUTCROPS (not walkable): wind-carved, layered, sand on their ledges.
- tan bands with vertical strokes (two tiles tall) = the vertical wind-carved FACES of those outcrops facing the viewer (south), layered strata, a lit lip on top, the foot ending exactly on the sand below.
- orange with wavy lines = low rolling DUNE sand (walkable here, FLAT to walk on): wind ripples.
- pale yellow with dots = packed SAND of the hollow (walkable, flat), old footprints.
- red-brown with cracks = cracked CLAY around an old burnt-out fire place (walkable, flat), a few ash stains.
- brown = the track going off the east edge (walkable, flat)."""),
    'desert_wellroom': ("AN OLD WELL-KEEPER'S HUT, INSIDE (seen from above with the roof taken away): one small room with thick sandstone and mud-brick walls, a sandstone floor with woven rugs, cosy and poor.", SAND_WALL.replace('massive old sandstone walls', 'thick plastered mud-brick walls') + "\n" + PAVE + "\n" + CARPET + "\n- the doorway in the bottom wall (the lower middle) stays a plain floor gap: the door is added later."),
}
IN_KEY = """(The guide's colours only mark the areas; paint them in the materials described above, not in the guide's colours.)
- dark brown along the left, right and bottom edges and above the top band = the THICK OUTER WALLS seen from above (not walkable): their dark tops, one tile thick on the sides and bottom.
- tan band with vertical strokes (the two tile rows at the top) = the BACK WALL of the room facing the viewer: exactly two tiles tall, its foot ending exactly on the floor edge below it. This is where the character of the room shows most.
- pale beige with joints = the walkable FLOOR (flat).
- red with gold lines = a woven RUG / carpet lying flat on the floor exactly over those tiles (walkable).
- the one-tile gap in the bottom wall = the doorway (plain floor, the way out)."""
ROOMS = {
    'kasim_inn': "INSIDE THE INN \"THE SPRING STAR\" of the desert oasis town Kasim, a house of fused whitewashed MUD DOMES: the back wall is smooth, softly curved whitewashed mud plaster with rounded arched niches, a band of blue-and-white glazed tiles, and small pierced brass star-shaped lantern holders set in the wall (unlit); rounded soft corners; the floor is worn pale sandstone flags. Homely, cool and clean.",
    'kasim_tavern': "INSIDE THE TAVERN \"THE HOURGLASS\" of the desert oasis town Kasim, built INSIDE A GIANT TOPPLED CLAY JAR lying on its side: the back wall is the curved inner belly of the jar, warm fired terracotta with horizontal painted bands of ochre, madder red and faded teal glaze and potter's ridges curving across it; the floor is fired terracotta tiles with a few old wine stains. Warm, cosy, a little smoky.",
    'kasim_shop': "INSIDE THE ITEM SHOP, a chamber cut into the PLINTH OF A COLOSSAL SEATED STONE STATUE: the back wall is made of huge dressed sandstone blocks with a carved frieze of the nameless king's procession (hieroglyph-like figures, sun discs), wooden shelf pegs driven into the joints; floor of big worn sandstone flags.",
    'kasim_mapshop': "INSIDE THE MAP MAKER'S ROOM, a chamber cut into the PLINTH OF A COLOSSAL SEATED STONE STATUE: huge dressed sandstone blocks; on the back wall a large faded painted fresco of an old map of the desert (dunes, oases, caravan routes in red lines, a compass star) between carved pilasters; floor of big worn sandstone flags.",
    'kasim_fortune': "THE FORTUNE TELLER'S CHAMBER in the middle of the PLINTH OF A COLOSSAL SEATED STONE STATUE: dim and mysterious; the back wall of huge dark sandstone blocks is painted with a deep indigo star chart (constellations in gold dots and lines, a crescent moon), hanging strings of small brass charms; floor of dark sandstone flags.",
    'kasim_guild': "INSIDE THE CARAVAN GUILD of Kasim, built in the RIBCAGE OF A GIANT ANCIENT BEAST: the back wall is formed by huge pale bone ribs curving up out of the floor at regular intervals, with heavy indigo and madder red cloth hangings stretched between the ribs; a thick bone spine runs along the top; the floor is packed earth covered with woven reed mats.",
    'kasim_abul': "INSIDE THE TOMB KEEPER'S HOUSE, a dwelling CUT INTO THE LIVING ROCK of a sandstone outcrop: the back wall is rough rock with visible chisel marks, a small carved shrine niche with worn royal symbols in the middle of the wall, a few old faded carvings; floor of smoothed bedrock and flat stones.",
    'kasim_digger': "INSIDE THE WELL-DIGGER'S HOUSE, a round MUD-BRICK DOME: the back wall is curved mud brick with wooden beams, coils of rope, buckets and digging tools hung on pegs painted flat on the wall, a small round window with a glimpse of a wooden water wheel; floor of packed earth and flat stones.",
    'sandedge_inn': "INSIDE THE INN OF SANDEDGE, carved into the HOLLOW OF A COLOSSAL PETRIFIED TREE: the back wall is the inside of the stone trunk, grey banded crystalline stone wood with curved growth rings, deep bark cracks with amber and quartz glints and a little lichen; the floor is polished cross-cut petrified wood showing concentric growth rings. Warm, quiet, unusual.",
}
for k, v in ROOMS.items(): MAPS[k] = (v, IN_KEY)
title, key = MAPS[m]
DOOR = os.environ.get('DOORTXT') or '- black rectangle = a big SEALED STONE DOORWAY in the wall face: paint a deep, dark doorway recess with a carved sandstone frame exactly there and exactly that wide (the door leaf itself is added later as a sprite).\n' if any(o.get('type') == 'door' and o.get('look') != 'none' for o in d['objects']) else ''
cell = T * 48 // 32
P = f"""Paint the COMPLETE top-down map of a fantasy JRPG {'DUNGEON' if m.startswith('desert_') and m not in ('desert_rocks', 'desert_oldcamp', 'desert_wellroom') else 'LOCATION (a room interior)' if m in ROOMS else 'LOCATION'} as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG map view (walls seen from above with their south-facing vertical faces showing, like a classic JRPG dungeon; NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

THE PLACE: {title}

The FIRST attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output, output is {W * T} x {H * T}). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data. Keep the exact outline of every room and passage, including the one-tile-wide ones and small dead ends.

The SECOND attached image is only a STYLE REFERENCE from the same game (a desert town): match its pixel-art rendering (pixel size, clusters, outlines, warm desert colour ramps, level of detail). Do NOT copy anything from it (no statue, no houses, no paths, no objects from it).

Guide colour key:
{key}
{DOOR}The solid (not walkable) masses must be fully textured, detailed pixel-art rock or masonry (never a flat colour field), and every edge between floor and solid must look natural and hand-painted, following the guide's outline within a few pixels.
Walkable areas must stay walkable-looking: no boulders, pillars, rubble heaps or furniture standing on them.

Make it rich, detailed, handcrafted and cohesive: warm sandstone, ochre, faded madder red, indigo and old gold.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it at runtime and adds torchlight on top). Neutral, soft, even light as in the style reference; NO darkness, NO cast shadows longer than a few pixels, NO light pools, NO glow halos, NO vignette, NO fog.
Do NOT paint any characters, animals, monsters, treasure chests, stairs, ladders, holes, doors, lanterns, torches, braziers, candles, statues, obelisks, urns, jars, bones, skulls, barrels, crates, sacks, tents, campfires, logs, furniture, beds, tables, signs, pressure plates, switches, text, labels, grid lines or UI. Those are added later as separate sprites: leave the floor open for them.
""" + extra
job = {"out": os.path.abspath(f'{md}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{md}/guide_{T}.png'), os.path.abspath('style_desert.png')], "tag": f"{m}_under"}
json.dump(job, open(f'{md}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'])
