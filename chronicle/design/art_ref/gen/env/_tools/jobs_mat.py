import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from style import *
D = '/home/user/others/chronicle/design/art_ref/gen/env/'
SZ = '1792x1792'
SCALE = "The square is about 256 x 256 art pixels (each art pixel about 7x7 image pixels)."
def tex(out, what, theme='common'):
    return dict(out=D + 'mat/%s/%s.png' % (theme, out), tag='env_mat_' + out, size=SZ, quality='high',
                prompt="Pixel-art ground texture for a top-down JRPG map: " + what + " " + SCALE + "\n" + PIXEL + "\n" + TOPDOWN + "\n" + ALBEDO + "\n" + SEAMLESS)
FACE = ("A horizontal strip of pixel art showing the vertical FRONT FACE of a raised wall/ledge, exactly as such faces look in a top-down JRPG map "
        "(we look straight at the face; it is the drop between an upper level and the floor). It fills the whole image edge to edge: "
        "the top 6% is the lit rim/lip of the upper surface, the face below gets gradually darker toward the bottom, and the bottom 8% is a dark "
        "contact band where it meets the floor. No floor, no sky, no objects in front. SEAMLESS horizontally (left edge continues into the right edge). "
        "The strip is about 256 x 128 art pixels (each art pixel about 7x7 image pixels).")
def face(out, what, theme='common'):
    return dict(out=D + 'mat/%s/face_%s.png' % (theme, out), tag='env_face_' + out, size='1792x896', quality='high',
                prompt=FACE + " Material: " + what + "\n" + PIXEL + "\n" + ALBEDO)
jobs = [
 tex('grass', "short wild meadow grass, mid green with cool blue-green shading, small grass blade clusters, a little clover, very few tiny pebbles."),
 tex('tall_grass', "dense tall grass: overlapping clumps of long grass blades seen from above, darker green, rich variation between clumps."),
 tex('flowers', "meadow grass sprinkled with small wildflowers (white, pale yellow, soft violet, a few pink), flowers 2-3 art pixels each, evenly scattered."),
 tex('dirt', "packed bare earth, warm brown, with small pebbles, tiny roots, a few cracks and darker damp patches."),
 tex('road', "a trodden country path surface: compacted light-brown earth with fine gravel, small stones and faint footprints (no wheel ruts, no direction)."),
 tex('moss_earth', "dark forest floor: soft brown soil covered in patches of green moss, fallen pine needles and a few small leaves."),
 tex('sand', "fine pale beach sand with gentle wind ripples, tiny shells and pebbles."),
 tex('cobble', "old town cobblestones: rounded grey and grey-brown stones (each about 8-14 art pixels across) set in dark mortar, worn smooth tops, a little moss in some gaps.", 'harbor'),
 tex('stone_floor', "large flat flagstone paving for a town square: rectangular pale grey-beige slabs (about 28 x 20 art pixels) in staggered rows, worn edges, small cracks, thin dark joints."),
 tex('plank', "a weathered wooden boardwalk / pier deck: long planks running horizontally (each plank about 10 art pixels wide), staggered end joints, rows of iron nail heads, thin dark gaps between planks, grey-brown sea-bleached wood."),
 tex('wood_floor', "polished indoor wooden floorboards, warm honey brown, boards running horizontally (about 8 art pixels wide), staggered joints, subtle grain."),
 tex('carpet', "a woven wool carpet: deep red field with a small repeating gold and cream geometric motif (diamonds), fine weave texture."),
 tex('cave_floor', "cave floor: cool grey-violet rock, flat worn stone slabs mixed with gravel and small rocks, faint dark cracks, patches of pale lichen."),
 tex('bark_floor', "the floor inside a giant hollow tree: living wood seen from above with wavy concentric growth-ring grain, knots, shallow cracks, warm brown."),
 tex('root_floor', "earthen floor densely crossed by twisting tree roots of different thickness, moss in between, dark brown soil."),
 tex('water', "calm dark pond water seen from above: deep blue-teal with small ripple highlights in horizontal pixel dashes."),
 tex('sea', "harbour sea water from above: deep blue with small repeating wave crests as short light pixel lines, darker troughs."),
 tex('shallow', "clear shallow water over sand and pebbles: the sandy bottom visible through turquoise water, small ripple highlights."),
 tex('forest_dark', "a dense forest canopy seen from DIRECTLY ABOVE: tightly packed rounded tree crowns of different sizes, dark green with blue-violet shadows between crowns, each crown lit on its upper-left with leaf clusters."),
 tex('rock', "the top of a rocky outcrop / cliff top seen from above: craggy grey stone, cracks, small patches of grass and moss in crevices."),
 tex('wall_cave', "the rough rocky top of cave walls seen from above: dark violet-grey jagged rock mass, deep cracks, a few stalagmite tips."),
 tex('wall_bark', "the top of thick living-wood walls inside a giant tree, seen from above: dark bark ridges and knotted wood mass with moss."),
 tex('wall_stone', "the top of thick masonry walls seen from above: large cut grey stone blocks capping the wall, mortar lines."),
 tex('wall_moss', "the top of old mossy stone walls seen from above: grey stones mostly covered with moss and small ferns."),
 tex('wall_wood', "the top of heavy timber walls seen from above: dark squared wooden beams laid side by side, iron brackets."),
 face('rock', "natural grey rock cliff with strata lines, cracks and a few grass tufts on the top lip."),
 face('cliff', "earth-and-rock cliff with a grassy overhanging lip at the top, roots hanging, layered brown rock below."),
 face('stone', "a harbour quay / town retaining wall of large cut grey stone blocks in courses, mortar lines, some moss and a dark wet waterline stain near the bottom."),
 face('brick', "a wall of old red-brown bricks in running bond, a stone coping on top."),
 face('wood', "an interior wall of vertical dark wooden planks with a horizontal rail, like inside an old inn."),
 face('moss', "old stone wall heavily overgrown with moss and ivy."),
 face('bark', "the inner wall of a giant hollow tree: vertical ridged bark and living wood, knots, moss and a few thin roots."),
 face('cave', "dark cave rock face with vertical ridges, wet highlights, small stalactite drips hanging from the top lip."),
]
json.dump(jobs, open('/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/jobs_mat.json', 'w'))
print(len(jobs))
