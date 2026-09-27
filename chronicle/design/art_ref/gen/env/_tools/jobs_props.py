import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from style import *
D = '/home/user/others/chronicle/design/art_ref/gen/env/props/'
def sheet(out, n, rows, cols, items, scale, extra='', size='1536x1024'):
    lst = '; '.join('%d) %s' % (i + 1, t) for i, t in enumerate(items))
    return dict(out=D + out + '.png', tag='env_props_' + out, size=size, quality='high', background='transparent',
        prompt=("A sprite sheet of %d separate props for a top-down pixel-art JRPG, drawn from the classic 3/4 top-down RPG angle "
                "(you see the top surface and the front face; objects stand upright, feet/base at the bottom). "
                "Arrange them in a %d x %d grid in reading order (left to right, top to bottom), with wide empty space between them; every prop is fully separate, "
                "none touching or overlapping, nothing cut off by the image edge. The props, in order: %s.\n%s\n%s\n%s\n"
                "Background: fully transparent. No ground under the props, no drop shadows, no text, no labels, no numbers.") % (n, rows, cols, lst, scale, PIXEL, ALBEDO + extra))
jobs = [
 sheet('town_a', 12, 3, 4, ["simple wooden chair", "small round wooden table with a single candle stub (unlit)", "bale of hay tied with twine", "long wooden planter box with herbs and small flowers",
       "standing wooden signboard on a post (blank board, no letters)", "short wooden picket fence section", "small iron lantern standing on the ground (glass panes, unlit)",
       "weathered stone grave marker", "small canvas tent", "cut log lying on its side", "tree stump with roots", "small mossy rock"],
       "Scale: the chair is about 22 art pixels tall, the table about 26, the tent about 32 tall; each art pixel is about 6x6 image pixels."),
 sheet('interior_a', 12, 3, 4, ["single bed with a patchwork quilt and white pillow, head end at the top (seen from above at a steep angle)", "tall wooden bookshelf full of colourful books",
       "long wooden shop counter with a ledger, scales and a small bell", "stone kitchen hearth / cooking stove with an iron pot (fire not lit, cold ashes)",
       "tall wooden cupboard with two doors", "low dresser with drawers and a small mirror", "wooden stool", "clay pot with a leafy house plant",
       "wooden shelf rack with jars and bottles", "wooden wash tub", "rolled up rug", "wooden weapon rack holding two swords and a spear"],
       "Scale: the bed is about 34 art pixels tall, the bookshelf about 40, the stool about 16; each art pixel is about 6x6 image pixels.", '\nInterior furniture of a cosy old inn and shops.'),
 sheet('dungeon_a', 12, 3, 4, ["closed treasure chest (red-brown wood, iron bands, gold lock)", "the SAME treasure chest opened, lid up, empty inside",
       "closed rare treasure chest (deep blue wood with gold trim and a star emblem)", "the SAME rare chest opened, lid up",
       "stone brazier bowl on a short pedestal, cold and unlit (grey ash, no fire)", "the SAME brazier lit with bright orange flames",
       "stone lantern post / way-lamp with a glass lantern on top, unlit (dark glass)", "the SAME way-lamp lit (warm yellow glass)",
       "wooden torch on an iron stand, unlit", "the SAME torch burning", "round stone floor pressure plate with a teal rune, raised (off)", "the SAME pressure plate pressed down, rune glowing teal"],
       "Scale: the chest is about 24 art pixels wide, the way-lamp about 50 art pixels tall, the torch about 22 tall; each art pixel is about 6x6 image pixels. Each pair (1-2, 3-4, 5-6, 7-8, 9-10, 11-12) must be identical in size, shape and colours except for the stated change.",
       '\nException: in the lit variants the flames / glass / rune may be bright, but no light spills onto anything around them.'),
 sheet('dungeon_b', 12, 3, 4, ["stone stairs going up: a short flight of steps rising toward the top of the image", "stairs going down: a square opening in the floor with stone steps descending into darkness",
       "heavy wooden door set in a stone arch frame, closed, seen front-on", "iron wall lever pointing up (off)", "the SAME lever pulled down (on)",
       "wooden ladder leaning upright", "short section of rope-and-plank bridge seen from above", "small round spring pool with a mossy stone rim and clear turquoise water (about 2 x 2 map tiles)",
       "cluster of glowing pale-blue crystals growing from rock", "tall carved standing stone with a spiral rune (a singing stone)", "cluster of small glowing teal mushrooms", "large iron beacon brazier for the top of a lighthouse (unlit)"],
       "Scale: the stairs are about 32 art pixels wide, the door about 24 wide and 34 tall, the spring pool about 60 wide, the singing stone about 44 tall; each art pixel is about 6x6 image pixels.",
       '\nException: crystals, mushrooms and the spring water may be softly luminous in colour, but no light spills around them.'),
 sheet('trees_broad', 6, 2, 3, ["large round-crowned oak tree", "tall slender broadleaf tree", "wide leafy tree with a split trunk", "young tree", "old gnarled tree with a hollow", "bushy maple-like tree"],
       "Scale: each tree is about 60-70 art pixels tall (the young tree about 46); each art pixel is about 6x6 image pixels. Foliage: dense leaf clusters, deep greens with blue-violet shading and yellow-green highlights on the upper left; visible trunk and roots at the base.", size='1536x1024'),
 sheet('trees_conifer', 6, 2, 3, ["tall dark fir tree", "spruce with layered drooping branches", "narrow cypress-like conifer", "young small fir", "old pine with a bare lower trunk and a flat crown", "snow-free mountain fir, very full"],
       "Scale: each tree is about 64-76 art pixels tall (the young fir about 46); each art pixel is about 6x6 image pixels. Deep blue-green needles in layered tiers.", size='1536x1024'),
 sheet('trees_forest', 6, 2, 3, ["gigantic ancient tree with a massive trunk and huge spreading roots, crown of dark leaves", "second gigantic ancient tree, mossy trunk, different shape",
       "moss-draped tree with hanging moss strands and blue-green foliage", "twisted old forest tree with lichen", "dead grey tree with bare branches", "tree with softly glowing pale blue-green blossoms"],
       "Scale: the gigantic trees are about 110-120 art pixels tall and 90 wide, the others about 64-70 tall; each art pixel is about 6x6 image pixels.", size='1536x1024'),
 sheet('nature_a', 15, 3, 5, ["round leafy bush", "bush with small berries", "fern clump", "cluster of thick gnarled tree roots breaking out of the ground (wide, low)", "second root cluster, mossy",
       "large mossy boulder", "grey boulder with cracks", "fallen mossy log", "small grass tuft", "second grass tuft, taller", "tiny clump of wildflowers", "few small pebbles", "scatter of fallen leaves", "two small brown mushrooms", "small reed clump"],
       "Scale: bushes about 28 art pixels wide, the root clusters about 46 wide and 20 tall, grass tufts about 12 wide, pebbles about 12 wide; each art pixel is about 6x6 image pixels."),
 dict(out=D + 'ship.png', tag='env_props_ship', size='1536x1024', quality='high', background='transparent',
      prompt="One single moored wooden two-masted sailing ship for a top-down pixel-art JRPG harbour map, seen from the classic steep 3/4 top-down RPG angle, "
             "hull pointing to the right, sails furled on the yards, coiled ropes, crates on deck, a lantern on the stern (unlit). About 160 art pixels long "
             "(each art pixel about 6x6 image pixels).\n" + PIXEL + "\n" + ALBEDO + "\nBackground: fully transparent, no water, no shadow, no text."),
]
json.dump(jobs, open('/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/jobs_props.json', 'w'))
print(len(jobs))
