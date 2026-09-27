"""Job for the painted Fern underlay. usage: python3 mkjob_fern.py <name> <x0> <y0> <w> <h> <px_per_tile> [extra]
Crops the tile-32 guide to the tile rect, scales it to px_per_tile and writes <name>_guide.png + <name>.job.json."""
import json, sys, os
from PIL import Image
name = sys.argv[1]; x0, y0, w, h, k = map(int, sys.argv[2:7]); extra = sys.argv[7] if len(sys.argv) > 7 else ''
gd = Image.open('guide_1x.png').crop((x0 * 32, y0 * 32, (x0 + w) * 32, (y0 + h) * 32)).resize((w * k, h * k), Image.NEAREST)
gd.save(name + '_guide.png')
W, H = w * k, h * k
whole = (w, h) == (60, 56)
P = f"""Paint the {'COMPLETE' if whole else 'part of the'} top-down map of a fantasy FOREST VILLAGE built among colossal ancient trees, as ONE finished game map image, in rich premium hi-bit pixel art like a modern HD pixel-art JRPG town map (flat top-down 3/4 map view, NOT an HD-2D diorama, no depth-of-field, no tilt-shift, no 3D render).

The attached image is an exact LAYOUT GUIDE drawn on a {w} x {h} tile grid (each tile = {k} x {k} px of the output, output is {W} x {H}). Trace over it: your painting is laid pixel-for-pixel on top of it and used directly as the walkable game map, so every shape must stay exactly where it is in the guide, at the same size (keep every edge within a few pixels). Do not shift, shrink, add or re-arrange anything.

Guide colour key:
- darker olive green = mossy forest-floor earth (walkable): moss, fallen leaves, tiny ferns, clover, small roots flat on the ground. FLAT ground detail only.
- lighter green = soft grass and moss meadow (walkable), flat.
- tan = winding packed-earth footpaths (walkable): paint them as soft, naturally curving paths following the guide (smooth the stair-stepped edges into curves), leaf litter, a few flat stepping stones.
- light brown area = bare earth clearing (walkable). In the lower right it is a cut-over clearing: bare earth with sawdust and wood chips (no stumps, the game places them).
- grey shape with pink centre in the middle = the village plaza: a ROUND ring of old fitted flat stones with faint carved spiral patterns, the pink centre is a round bed of blue and violet night flowers and glowing moss (flat; a standing song-stone is placed there by the game).
- pink oval with dark-brown inside (lower left) = a small round herb garden: dark soil beds of herbs, bordered by flowers (the game adds its fence).
- blue = a winding forest stream (water fills the whole blue band), mossy banks, a few stones; three small plank footbridges (brown with plank lines) cross it exactly where drawn.
- very dark green circle clusters = dense deep forest (solid) around the map edge; mid-green circle clusters = small thickets of young trees and ferns (solid). Lush layered crowns, trunks only visible along the bottom edge of each mass.
- the other huge brown masses with a dark-green crown on top = COLOSSAL ANCIENT TREES seen from the front-top: a giant leafy crown at the top, below it an enormous gnarled bark trunk that spreads into huge root flares at its base filling the whole brown area. The small tan ovals with a yellow round window on the trunks are little round seed-pod homes grown into the bark (round windows, hanging moss, NO doors on them).
- light plank areas with horizontal lines = RAISED WOODEN PLATFORMS built against the south side of those trunks (a railing along their edges), clearly higher than the ground. The plank band between the two top platforms is a ROPE BRIDGE of planks with rope railings hung high between them, spanning over the north path and the little thickets below it. The dark-brown row with light vertical stripes directly under each platform = its front face: thick wooden support posts and roots under the platform edge. The small yellow ladders on those faces are wooden ladders leaning up to the platforms (paint a clear ladder exactly there).
- orange bands across the road at the top and bottom = ROOT-ARCH GATEWAYS: giant twisted tree roots rising from the brown-striped root masses on both sides of the road and arching over it (the road passes under the arch).
- the big brown mass with a crown in the centre-left = the GREAT HOLLOW TREE, the heart of the village: one colossal ancient tree whose huge root lobes hold three establishments, each a warm wooden facade (the light wood-coloured rounded panels) set into the bark with its own round door: the INN (the widest facade, bottom middle of the tree: carved wooden frame, round windows, a little porch roof of shingles), the ITEM SHOP (the facade on the right lobe: a shop window with shelves of potions and a small cloth awning), and the GUARD POST of the forest search party (the facade on the left lobe: a crossed-axes crest and a green banner). No text anywhere.
- the other odd-shaped houses (all doors face the viewer), scattered irregularly:
  * teal cap with white spots (right, near the stream) and violet cap with pale spots (lower middle right) = giant mushroom houses, pale stems with round windows and a round door.
  * ring-patterned top with brown wall (top right, under the tallest tree) = a house carved into a huge felled-tree stump: tree rings on top, bark wall, round door.
  * yellow-ochre dome (lower left) = a gourd-shaped house made of a big dried gourd with a woven leaf roof and a little sprout on top.
  * violet dome (top right corner, among the roots of the tallest tree) = a flower-bud seed-pod house with a petal-shaped roof.
  * small brown-capped shapes = acorn-shaped pod houses (acorn cap roof, nut-shell wall).
- small BLACK round-topped shapes = the front DOORS. Paint each door exactly at that spot and size (round-topped wooden door with a small stone step), its bottom edge on the bottom of the wall. Do not add any other door anywhere.
- small yellow circles = round windows with wooden frames (panes softly warm, no glow spilling out).
Buildings, trees, platforms, bridges and forest must not extend outside their guide shapes (roofs/caps may overhang by a few pixels).

Mood: a magical, cozy, ancient forest village where people live around and up in giant trees; glowing blue-green mushrooms and moss patches on roots and trunks (small, painted flat on surfaces), hanging vines, little firefly jars hanging from the platform railings, lived-in details. Distinctive and whimsical, but still a readable game map.

Pixel art rules: crisp square pixels, no blur, no anti-aliasing, no painterly brush strokes, no noise, clear clusters, hue-shifted ramps, dark warm outlines on buildings. Characters in this game are about {int(1.5 * k)} output px tall, so details should be at that scale.
Lighting: this is the ALBEDO base layer. Neutral, soft, even daylight-like light; NO night, NO cast shadows longer than a few pixels, NO lamp light pools, NO glow halos, NO vignette, NO fog.
Do NOT paint any characters, animals, lamp posts, lanterns on the ground, barrels, crates, benches, wells, signs, chests, stumps, fences, text, labels, grid lines or UI. Leave open ground for them.
""" + extra
job = {"out": os.path.abspath(name + '.png'), "prompt": P, "size": f"{W}x{H}", "quality": "high", "background": "opaque",
       "refs": [os.path.abspath(name + '_guide.png')], "tag": "fern_under"}
json.dump(job, open(name + '.job.json', 'w'), ensure_ascii=False, indent=1)
print(W, H)
