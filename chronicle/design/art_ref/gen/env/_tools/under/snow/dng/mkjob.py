"""Job for one painted SNOW dungeon underlay (adapted from ../../dungeon/mkjob.py, the demo-dungeon pilot).
usage: python3 mkjob.py <map> <T> <name> [extra text]
refs: <map>/guide_<T>.png (the layout, traced) + style_snow.png (a crop of the approved painted Yule, style only)."""
import json, sys, os
m, T, name = sys.argv[1], int(sys.argv[2]), sys.argv[3]
extra = sys.argv[4] if len(sys.argv) > 4 else ''
d = json.load(open(m + '/layout_data.json'))
W, H = d['w'], d['h']

ROCK = """- dark slate blue-grey = the HIGH MOUNTAIN ROCK seen from above (not walkable): dark grey-blue crags and boulders, deep cracks, wind-packed snow lying in the hollows and on the ledges, a few small snow-laden firs clinging to it; it must read clearly darker than the walkable snow.
- light blue bands with vertical strokes and a white top line = the VERTICAL CLIFF FACES facing the viewer (south): layered ice-glazed rock with long icicles, a thick lip of snow along the top; each face is exactly as tall as its band and its foot ends exactly on the ground edge below it."""
ICE_ROCK = """- dark slate blue-grey = SOLID FROZEN ROCK AND GLACIER ICE seen from above (not walkable): dark blue-grey rock with veins and lumps of old blue glacier ice, frost, a few small pale ice crystals growing in the cracks.
- light blue bands with vertical strokes and a white top line = the VERTICAL WALLS of the ice cave facing the viewer (south): walls of translucent blue glacier ice and frozen rock with hanging icicles, a frosty lip on top; each wall is exactly as tall as its band and its foot ends exactly on the floor edge below it."""
SNOW = """- off-white = open SNOW (walkable): smooth wind-packed snow, soft drifts, footprints, a few tufts of dry grass (FLAT).
- warm tan = a TRODDEN PATH (walkable): packed, dirty trampled snow with footprints and sled tracks (FLAT)."""
MAPS = {
    'snow_woods': ('THE SNOWY WOODS OUTSIDE YULE: a quiet winter forest where the villagers gather firewood. Small snowy clearings are linked by trodden paths through a dense forest of snow-laden firs; a woodcutters\' camp clearing lies in the middle; in the east a half-frozen stream runs north-south under the trees with a short frozen stretch where the path crosses it; along the top edge rises a line of snowy rock cliffs.', """- dark green triangles packed together = the DENSE FIR FOREST seen from above (not walkable): an unbroken mass of dark fir and spruce crowns heavy with snow, layered, with blue shadows between the crowns (painted flat as albedo); trunks visible only at its southern edges.
- a single dark green triangle standing on white = one big SNOW-LADEN FIR standing in a clearing (not walkable), its crown within its tile and a little above.
""" + SNOW + """
- blue with small circles = the unfrozen STREAM (not walkable): dark, cold running water between snowy banks and icy stones.
- pale cyan = the frozen stretch of the stream where the path crosses it (walkable): clear blue-white ice with cracks, flat.
""" + ROCK),
    'peak_1': ('THE WHITE DRAGON\'S PEAK, THE MOUNTAIN PATH: a high, wind-swept mountain. Snowy terraces and plateaus of different sizes are linked by steep trodden paths through narrow gaps between towering rock cliffs; in the middle plateau a small hot spring steams in a rock basin, melting the snow around its rim; the path at the very top leaves the map towards the summit.', ROCK + "\n" + SNOW + """
- dark green triangle = a single small SNOW-LADEN FIR on the terrace (not walkable).
- blue with small circles = the HOT SPRING pool (not walkable): steaming turquoise water in a basin of dark wet rock and orange mineral crust, snow melted away around its rim.
- the few small single slate cells on the edges of the snow = low snowy BOULDERS (not walkable)."""),
    'peak_top': ('THE SUMMIT OF THE WHITE DRAGON\'S PEAK: a flat, wind-swept snowy summit above the clouds, ringed by jagged rocks. In the north lies a raised ALTAR of clear blue ice where the white dragon alights. In the south, just below the summit, a small old SHRINE CAVE with a floor of ancient carved flagstones opens onto a path that climbs to the summit.', ROCK + "\n" + SNOW + """
- pale cyan = the ICE ALTAR (walkable): a flat platform of clear, blue-white ancient ice, smooth and glassy, with faint carved circles and a frosty rim.
- grey with squares = the SHRINE CAVE floor (walkable): big worn square flagstones with faint old carved runes, frost in the joints (FLAT)."""),
    'icicle_1': ('THE ICICLE CORRIDORS, UPPER FLOOR: a cave of ice inside a western cliff. Chambers and corridors of smooth blue ice, hung with icicles; a drift of snow blown into the central chamber; the entrance hall is in the east.', ICE_ROCK + """
- pale cyan = the ICE FLOOR (walkable): smooth, glassy blue-white ice with cracks, frozen bubbles and a light dusting of frost (FLAT).
- off-white = a DRIFT OF SNOW blown in (walkable, flat).
- warm tan = a TRODDEN PATH of packed dirty snow and grit strewn on the ice (walkable, flat)."""),
    'icicle_2': ('THE ICICLE CORRIDORS, LOWER FLOOR: the deeper, older part of the ice cave, darker blue ice, big halls linked by narrow corridors; at the north end a small inner chamber.', ICE_ROCK + """
- pale cyan = the ICE FLOOR (walkable): smooth, glassy deep-blue ice with cracks and frozen bubbles (FLAT).
- warm tan = a TRODDEN PATH of packed dirty snow and grit on the ice (walkable, flat)."""),
    'aurora': ('THE AURORA CLIFF on the northern ice floe: an open, wind-swept snowy clifftop high above the frozen sea, ringed by rocks. At the north end a smooth sheet of clear ice lies at the cliff edge where travellers stand to watch the aurora; a small sheltered rocky nook lies in the west.', ROCK + "\n" + SNOW + """
- pale cyan = a SHEET OF CLEAR ICE on the clifftop (walkable): glassy, blue-white, with long cracks (FLAT)."""),
    'frost_ship_1': ('THE FROZEN GALLEON: a great old three-masted sailing ship of a lost fleet, locked for a hundred years in the sea ice of the northern floe, seen from straight above (flat top-down map view). Its long open DECK points east (bow at the right, stern at the left); the masts have snapped off, only their round sawn-off bases remain flush with the deck; frost, snow drifts and icicles cover everything. Two smaller wrecks of the same fleet stick out of the ice nearby.', """- warm brown with lines = the ship's open DECK of weathered grey-brown planks (walkable): long planks running left-right, frost and thin snow drifts, ropes lying flat, round mast bases flush with the planks, iron rings (FLAT).
- the dark red-brown band with a lighter line all around the deck = the ship's BULWARK (not walkable): a thick wooden rail with frost and icicles following the curved outline of the hull (rounded stern at the left, pointed bow with a short bowsprit at the right); just outside it, where the hull meets the ice, show a thin strip of the dark tarred outer hull planks and heaped ice.
- the narrow strip of planks running down from the middle of the south side = a wooden GANGPLANK from the ice up to the deck (walkable).
- the two dark brown blocks with wooden fronts in the upper left and upper right = the tilted, half-sunken STERN CASTLES of two smaller wrecked ships of the fleet sticking out of the ice (not walkable): dark timbers, a broken carved window frame, icicles.
- pale cyan = the frozen SEA ICE around the ship (walkable): blue-white sea ice with long cracks, pressure ridges drawn flat, patches of snow (FLAT).
- warm tan = a TRODDEN PATH of packed snow over the ice (walkable).
""" + ROCK.replace('HIGH MOUNTAIN ROCK', 'PACK ICE AND ICE RIDGES').replace('dark grey-blue crags and boulders', 'jumbled blocks of old grey-blue sea ice and snow')),
    'frost_ship_2': ('THE HOLD OF THE FROZEN GALLEON: below the deck of the ice-locked ship, seen from above with the deck taken away (a cut-away): the cargo hold in the west with plank floors; a thick wooden bulkhead with a doorway divides it from the east part; the captain\'s cabin in the south-east lies on a faded red carpet. Frost and ice crust on every timber, icicles hanging from the beams.', """- dark brown = the heavy TIMBERS of the hull and bulkheads seen from above (not walkable): thick dark oak frames and ribs, tarred seams, frost on top.
- brown bands with horizontal lines = the WOODEN WALLS facing the viewer (south): old tarred planking with iron bolts, frost and icicles, a lit lip on top; exactly as tall as the band, the foot ending exactly on the floor edge below.
- warm brown with lines = the PLANK FLOOR of the hold (walkable): worn, frosted planks running left-right, nail heads (FLAT).
- red = the captain's faded red CARPET with a worn gold border (walkable, flat)."""),
}
title, key = MAPS[m]
cell = T * 48 // 32
P = f"""Paint the COMPLETE top-down map of a fantasy JRPG DUNGEON as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), flat classic top-down RPG map view (walls and cliffs seen from above with their south-facing vertical faces showing, like a classic JRPG map; NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

THE PLACE: {title}

The FIRST attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it and checked against it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output, output is {W * T} x {H * T}). Every shape must sit exactly where it is in the guide at the same size: this image is used directly as the walkable game map, so positions are collision data. Keep the exact outline of every area and passage, including the narrow ones and small dead ends.

The SECOND attached image is only a STYLE REFERENCE from the same game (a painted snow village): match its pixel-art rendering (pixel size, clusters, snow and ice colours, outlines, level of detail). Do NOT copy anything from it (no houses, no paths, no objects from it).

Guide colour key:
{key}
Walkable areas must stay walkable-looking: no boulders, pillars, trees or furniture standing on them.

Make it rich, detailed, handcrafted and cohesive, with the mood of a cold, silent, beautiful northern place.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {cell} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game darkens it at runtime and adds lamp light on top). Neutral, soft, even light as in the style reference; NO night, NO cast shadows longer than a few pixels, NO light pools, NO glow halos, NO vignette, NO fog, no falling snow.
Do NOT paint any characters, animals, monsters, treasure chests, stairs, ladders, holes, lanterns, torches, braziers, standing ice crystals, barrels, crates, sacks, furniture, bookshelves, tables, signs, statues, tents, campfires, logs, stumps, sleds, text, labels, grid lines or UI. Those are added later as separate sprites: leave the ground open for them.
""" + extra
job = {"out": os.path.abspath(f'{m}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{m}/guide_{T}.png'), os.path.abspath('style_snow.png')], "tag": f"{m}_under"}
json.dump(job, open(f'{m}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'])
