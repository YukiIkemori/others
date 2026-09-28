"""Job for one painted snow INTERIOR underlay (the rooms of the painted Yule and the pass inn, so they match their painted exteriors).
usage: python3 mkjob_in.py <map> <T> <name>
refs: <map>/guide_<T>.png + a crop of the building's painted exterior (style and materials only)."""
import json, sys, os
m, T, name = sys.argv[1], int(sys.argv[2]), sys.argv[3]
d = json.load(open(m + '/layout_data.json'))
W, H = d['w'], d['h']
dx = [x for x in range(W) if d['rows'][H - 1][x] == 'd'][0]
ROOMS = {
    'yule_sonja': ('the inside of the FIRE-KEEPER\'S ICE DOME: a round snow-house built of big translucent blue-white ice blocks laid in a spiral, the blocks glowing faintly blue where daylight comes through; the floor of packed snow is covered with reindeer furs and woven rugs; a round ring of dark hearth stones with old ashes in the back middle of the room (the fire itself is added later, leave the middle of the ring empty); a few carved wooden pegs with hanging herbs.',
                   'the WALLS are thick blocks of clear blue-white ice with frosty joints (the wall top seen from above is the rounded top of the ice-block dome); the FLOOR is packed snow with overlapping fur rugs and a woven red-and-white rug.'),
    'yule_brenda': ('the inside of a TURF PIT-HOUSE: an old sunken house dug into the ground, its walls of stacked turf and fieldstone held by rough timber posts and wattle, a low roof of turf on birch poles; a floor of packed earth strewn with reed mats and sheepskins; warm and cramped, with dried herbs and strings of onions hanging.',
                    'the WALLS are layered turf blocks and grey fieldstone between rough timber posts (top seen from above: the turf of the roof edge, grass tufts and snow); the FLOOR is dark packed earth with worn reed mats; the red area is a hand-woven woollen rug.'),
    'yule_hunter': ('the inside of the old hunter\'s MAMMOTH-TUSK LODGE: a long hide tent whose frame is made of huge curved mammoth tusks and ribs lashed together, covered with stitched reindeer hides; the floor is covered with thick furs and pelts over packed snow; antlers, snowshoes and bows hang on the tusk frame.',
                    'the WALLS are stitched brown and cream hides stretched over the pale curved ivory tusks of the frame (the tusks show as big pale arches along the wall; the wall top seen from above is the hide roof edge); the FLOOR is a patchwork of thick furs and pelts, grey wolf, white fox, brown bear.'),
    'yule_jorn': ('the inside of the village chief\'s ROUND STONE TOWER-HOUSE: a sturdy round room of dressed grey granite, a timber ceiling on beams, carved dragon-head wooden brackets, shields with painted clan signs on the wall; a floor of big flagstones with a faded red woollen carpet in the middle.',
                  'the WALLS are dressed grey granite blocks curving around the room, with timber wall plates on top (the wall top seen from above: the granite wall crown with snow); the FLOOR is big worn flagstones; the red area is a faded red woollen carpet with a woven border.'),
    'yule_branch': ('the inside of the empty NORDEN BRANCH OFFICE at the edge of the village: a cold, square room of plain cut grey stone, formal and foreign-looking, abandoned: dust, frost creeping in at the corners, a few scattered papers and a torn record-office banner on the wall.',
                    'the WALLS are plain cut grey ashlar stone with a dark slate cornice (the wall top seen from above: the flat stone wall crown with frost); the FLOOR is cold grey square slate tiles laid in a grid, dusty, with frost patches and a few scattered sheets of paper lying flat.'),
    'yule_base': ('the CHILDREN\'S SECRET DEN dug into a big snowbank: a small cave hollowed out of packed snow, its walls shaped with little shelves and niches carved into the snow, children\'s drawings pinned up, an old blanket and a stolen sack for a rug.',
                  'the WALLS are packed white-blue snow scraped smooth, with carved niches (the wall top seen from above: the snowbank\'s rounded snowy top); the FLOOR is trampled packed snow with an old patched blanket and straw spread on it.'),
    'pass_inn_in': ('the inside of the PASS INN in the WEST TOWER of an ancient ruined border gatehouse: a big room of ancient weathered granite, the broken upper storey rebuilt with warm new timber, heavy beams, a huge old stone fireplace on the west wall; warm plank floors laid over the old stone, bear-skin rugs, drying furs and ropes hung on pegs; cosy and busy.',
                    'the WALLS are ancient weathered granite blocks with old carved border crests, patched with newer warm timber planks and beams (the wall top seen from above: the stone wall crown with battlements and snow); the FLOOR is warm honey-brown planks; the red area is a big red-and-ochre woven rug.'),
    'pass_inn_shop': ('the inside of the TRADING POST in the EAST TOWER of an ancient ruined border gatehouse: a square room of old granite, partly collapsed and patched with rough planks and a lean-to timber roof; a plank floor over the old stone; furs, rope coils and lanterns hang from the beams.',
                      'the WALLS are old granite blocks, one corner patched with rough grey planks (the wall top seen from above: the broken stone wall crown with snow and a few planks); the FLOOR is worn planks laid over the old stone.'),
}
title, mats = ROOMS[m]
P = f"""Paint the COMPLETE top-down map of ONE ROOM INTERIOR of a fantasy JRPG as ONE finished game map image, in rich premium modern hi-bit pixel art (the "HD pixel art" JRPG look: hand-placed crisp square pixels, hue-shifted ramps, dark warm outlines), in the classic top-down JRPG interior view: the room seen from above with the roof taken away; the back (top) wall shows its vertical face towards the viewer, the side and front walls are seen only as their tops (NOT an HD-2D diorama, no depth-of-field, no 3D render).

THE ROOM: {title}

The FIRST attached image is an exact LAYOUT GUIDE (trace over it: your painting will be laid pixel-for-pixel on top of it, so do not shift, shrink, mirror or re-arrange anything; keep every edge within a few pixels of the guide) drawn on a {W} x {H} tile grid (each tile = {T} x {T} px of the output, output is {W * T} x {H * T}). Every shape must sit exactly where it is in the guide: this image is used directly as the walkable game map.

The SECOND attached image is only a STYLE REFERENCE: the painted exterior of the same village from this game. Match its pixel-art rendering and palette. Do NOT copy anything from it.

Guide colour key:
- the dark border all around = the TOPS of the walls (not walkable), 1 tile thick at the sides and at the bottom.
- the band with vertical or horizontal lines along the top = the BACK WALL's vertical face towards the viewer, exactly 2 tiles tall, its foot exactly on the floor edge.
- the plain inside = the FLOOR (walkable, FLAT: nothing standing on it).
- the gap in the bottom wall (column {dx}, the bottom row) = the ENTRANCE: an open doorway through the front wall with a worn threshold and a small door mat, leading out of the map at the bottom edge.
Materials: {mats}

Make it rich, detailed, handcrafted and cohesive, cosy but northern. Small wall decorations may be painted ON THE BACK WALL FACE only (hangings, pegs, shelves painted flat on the wall).
Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly strokes, no noise, clear clusters, hue-shifted ramps. Characters in this game are about {T * 3 // 2} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer (the game adds lamp and fire light on top). Neutral, soft, even light; NO dark corners, NO cast shadows longer than a few pixels, NO light pools, NO glow, NO vignette.
Do NOT paint any characters, animals, furniture standing on the floor (no beds, tables, chairs, counters, stoves, fire, barrels, crates, sacks, shelves on the floor, chests, lamps, candles), no text, no labels, no grid lines, no UI. Furniture is added later as separate sprites: leave the floor open (flat rugs and mats are fine).
"""
job = {"out": os.path.abspath(f'{m}/{name}.png'), "prompt": P, "size": f"{W * T}x{H * T}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(f'{m}/guide_{T}.png'), os.path.abspath('style_%s.png' % ('pass' if m.startswith('pass') else 'yule_bld'))], "tag": f"{m}_under"}
json.dump(job, open(f'{m}/{name}.job.json', 'w'), ensure_ascii=False, indent=1)
print(job['out'], job['size'])
