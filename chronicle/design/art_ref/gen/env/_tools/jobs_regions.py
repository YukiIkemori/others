import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from style import *
import guides
from jobs_mat import tex, face, D
from jobs_props import sheet
from jobs_bbg import bbg, front
from PIL import Image
R = {
 'desert': dict(
   mats=[('dune_sand', "desert dune sand, cool moonlit beige with fine wind ripples and a few small stones"),
         ('cracked_clay', "dry cracked clay ground of a dried-up oasis, polygonal cracks, small pebbles"),
         ('sandstone_floor', "ancient tomb floor of worn sandstone tiles with faint carved glyph borders, sand drifted in the joints"),
         ('wall_sandstone', "the top of thick sandstone walls seen from above: big weathered sandstone blocks with sand on top")],
   face=('sandstone', "weathered layered sandstone cliff / tomb wall with carved horizontal bands"),
   props=["tall date palm tree", "short palm tree", "round cactus with flowers", "desert market stall with a striped cloth canopy and spice sacks", "stack of clay water jars",
          "rolled carpets on a rack", "sandstone obelisk with glyphs", "broken sandstone pillar", "tomb urn with a lid", "animal skull and bones in sand", "dry thorn bush", "stone oasis well (dry)",
          "copper brazier on a tripod (unlit)", "wooden cart with barrels", "small sand dune mound"],
   bld=("an oasis market town of mud-brick", "flat-roofed sandy mud-brick", "smooth sand-coloured adobe walls with wooden beam ends and small deep-set windows"),
   bbg="Setting: moonlit desert dunes. Back (top 42%): huge starry sky with a big pale moon, rolling dunes into the distance, half-buried ancient sandstone ruins and an obelisk silhouette, faint violet horizon glow. Ground (lower 58%): cool rippled sand with scattered stones, dry grass tufts and a broken column at the sides. Light: cold blue moonlight, long soft shadows.",
   front="dune sand ridges, dry grass and a broken sandstone block."),
 'snow': dict(
   mats=[('snow', "fresh deep snow with soft wind-sculpted bumps, a few footprints, blue-white"),
         ('snow_path', "a trodden snowy path: packed snow with footprints and a little frozen mud showing"),
         ('ice', "frozen lake ice: blue-grey with white crack lines and trapped bubbles"),
         ('wall_snow', "the snowy tops of rock walls seen from above: rock mostly covered by thick snow with icy edges")],
   face=('snow_cliff', "icy rock cliff with a thick snow cornice on the top lip, icicles and frosted strata"),
   props=["snow-laden fir tree", "small snowy fir", "snow-covered boulder", "stack of firewood under snow", "wooden sled", "frozen stone well with icicles", "snowman-free snow bank mound",
          "ice crystal formation", "iron stove chimney pipe (unlit)", "wooden ice-fishing hole frame", "snowy wooden fence", "barrel with snow on top", "hanging lantern post with snow (unlit)", "reindeer-free hay sled with sacks", "icicle-covered signpost (blank)"],
   bld=("a snow-buried northern village", "snow-covered steep", "dark log walls with snow drifts against them, small warm windows"),
   bbg="Setting: a snowy mountain pass at night. Back (top 42%): a vivid green-teal aurora curtain over jagged snowy peaks, stars, the far slopes bluish. Ground (lower 58%): deep snow with footprints, snowy rocks and frosted fir trees at the sides. Light: aurora and moonlight, cold blue with teal glints.",
   front="snow drifts, frosted fir branches and icy rocks."),
 'marsh': dict(
   mats=[('mud', "wet dark marsh mud with puddles, footprints and bits of reed"),
         ('marsh_water', "murky green-brown swamp water with duckweed patches and small lily pads"),
         ('peat_grass', "soggy marsh grass on peat: dark olive grass clumps with wet dark gaps and small reeds"),
         ('wall_marsh', "the tops of overgrown earth banks seen from above: dense reeds, moss and tangled roots")],
   face=('mud_bank', "a steep muddy riverbank with exposed roots, reeds hanging over the lip, wet dark earth"),
   props=["weeping willow tree", "twisted swamp tree with hanging moss", "clump of tall reeds", "lily pads with a white flower", "wooden stilt posts with rope", "old bronze bell on a wooden frame",
          "leaning gravestone with moss", "will-o-wisp lantern post (lantern unlit, pale glass)", "rotten stump in water", "wooden boardwalk steps", "mangrove root cluster", "fishing trap basket",
          "small rowboat stuck in mud", "crooked signpost (blank)", "cluster of glowing pale mushrooms"],
   bld=("a misty lake town built on stilts over shallow water", "dark wooden shingle", "weathered grey-green planks on stilts, a narrow wooden walkway in front, round lamps"),
   bbg="Setting: a misty swamp at night. Back (top 42%): layers of fog, silhouettes of twisted swamp trees and a distant bell tower with one faint lamp, a dim moon behind mist. Ground (lower 58%): muddy ground and shallow still water with reeds, lily pads and roots at the sides. Light: pale green-blue fog glow, deep shadows.",
   front="reeds, swamp grass and a twisted root in the water."),
 'isles': dict(
   mats=[('white_paving', "white-washed stone paving of a southern harbour town, pale limestone slabs, a few blue tile accents"),
         ('coral_sand', "pale pink-white coral sand with shell fragments and small coral pieces"),
         ('tide_rock', "tide-pool rock: dark volcanic rock shelves with pools, barnacles and seaweed"),
         ('glow_sea', "night sea water with bioluminescent plankton: deep blue water with sparse bright cyan sparkles in the wave crests")],
   face=('white_wall', "a white-washed limestone terrace wall with blue trim at the top, some plaster cracks and climbing flowers"),
   props=["coconut palm", "small palm", "pink coral cluster", "ship anchor leaning", "stack of floats and buoys", "fishing net drying on a frame", "white clay flower pot with bougainvillea",
          "blue-painted wooden bench", "seashell pile", "barrel of fish", "rope bollard", "small stone lighthouse lamp pillar (unlit)", "driftwood log", "beach umbrella of palm leaves", "treasure map signboard (blank)"],
   bld=("a white terraced port town on sea cliffs", "flat teal-blue", "white-washed plaster walls with blue window frames and doors, arched windows"),
   bbg="Setting: a tropical island beach at night. Back (top 42%): starry sky, calm sea glowing with cyan bioluminescent plankton along the waves, a ghostly old ship silhouette far out with pale blue will-o-wisp lights, palm silhouettes. Ground (lower 58%): pale sand with shells, coral pieces and tide pools at the sides. Light: moonlight and cyan sea glow.",
   front="palm fronds, coral chunks and shells."),
 'mine': dict(
   mats=[('mine_floor', "mine tunnel floor: packed dark rock and gravel with scattered ore chips and boot prints"),
         ('scaffold', "wooden mine scaffold platform: rough planks with iron brackets and ore dust"),
         ('ore_rock', "the top of rock walls in a mine seen from above: dark rock with veins of glinting copper and blue ore"),
         ('iron_grate', "an iron floor grating over a dark shaft, riveted plates around it")],
   face=('mine_wall', "a mine tunnel wall of dark rock braced with wooden support beams and a horizontal timber, ore veins"),
   props=["mine cart full of ore on rails", "empty mine cart", "short straight rail track piece", "pile of glowing blue ore crystals", "pile of copper ore", "timber support frame",
          "blacksmith anvil on a stump", "stone forge furnace (cold)", "rack of pickaxes and shovels", "hanging lantern on a hook post (unlit)", "wooden crate of tools", "dwarf-sized stone oath monument with carved runes",
          "bellows", "barrel of coal", "iron lift cage frame"],
   bld=("an underground city carved inside a huge cave", "carved stone overhang", "walls carved directly into grey rock with iron-bound wooden doors and small round windows, pipes"),
   bbg="Setting: deep inside a mine / underground forge city. Back (top 42%): a vast cavern with wooden scaffolds, rope lifts, rail bridges and distant molten-orange forge glow, hanging chains. Ground (lower 58%): dark rock floor with rail tracks curving at the sides, ore chunks and a cart. Light: orange forge glow from the far back, cool blue ore light, deep shadows.",
   front="ore rocks, a rail end and a wooden beam."),
 'ash': dict(
   mats=[('ash', "grey volcanic ash ground with small cinders and dark pumice stones"),
         ('basalt_floor', "hexagonal basalt column tops forming a paved floor, dark grey"),
         ('lava', "molten lava from above: bright orange-yellow flowing veins between dark cooling crust plates"),
         ('obsidian', "glossy black obsidian ground with sharp purple-black facets and red reflections")],
   face=('basalt', "a cliff of dark basalt columns with a crusty ash-covered top lip and faint red cracks"),
   props=["dead charred tree", "small charred stump", "steaming ground vent", "sharp obsidian shard cluster", "cooled lava rock", "hot spring pool with stone rim", "iron brazier (unlit)",
          "arena banner on a pole (red cloth, no letters)", "stone phoenix statue", "pile of volcanic rocks", "sulphur crystal cluster", "rope barrier post", "wooden weapon rack", "clay water urn", "ash-covered bush"],
   bld=("a town built on terraces inside a volcanic crater", "dark red clay tile", "heavy dark basalt stone walls with red-orange accents and iron fittings"),
   bbg="Setting: the rim of a volcano crater at night. Back (top 42%): smoky dark red sky with embers, a volcano cone glowing with lava rivers, black basalt ridges. Ground (lower 58%): dark ash and basalt ground with glowing orange cracks at the sides, steam vents. Light: red-orange lava glow from below and behind, violet shadows.",
   front="obsidian shards, basalt rocks and glowing cinders."),
 'star': dict(
   mats=[('marble_floor', "polished blue-grey marble floor tiles of an academic city, fine veins, thin gold inlay lines"),
         ('star_mosaic', "dark blue mosaic floor with small gold star and constellation patterns"),
         ('garden_hedge_top', "the top of a clipped garden hedge seen from above: dense small dark-green leaves"),
         ('wall_marble', "the top of pale stone city walls seen from above: large pale blocks with a walkway edge")],
   face=('marble', "a pale grey-blue stone city wall with carved star motifs in a band and a cornice on top"),
   props=["brass telescope on a tripod", "brass orrery / armillary sphere", "lectern with an open book", "stone statue of a robed scholar", "star-shaped lamp post (unlit glass)", "marble bench",
          "small stone fountain", "clipped topiary bush", "stack of books", "globe on a stand", "bookshelf cart", "sundial-shaped star dial", "hanging banner with a star emblem (no letters)", "potted blue flowers", "iron gate section"],
   bld=("a walled academic city of scholars and astronomers", "blue-slate", "pale stone walls with tall arched windows, carved star ornaments"),
   bbg="Setting: the open top of an old star-reading tower. Back (top 42%): an overwhelming starry sky with the milky way and falling stars, brass astronomical rings and a great telescope silhouette, city walls far below. Ground (lower 58%): a round stone platform floor with an inlaid star map, brass rails at the sides. Light: starlight, cool blue with gold glints.",
   front="brass railing ends, stacked books and a star lamp."),
}
jobs = []
for th, r in R.items():
    for mid, what in r['mats']:
        jobs.append(tex(mid, what, th))
    jobs.append(face(r['face'][0], r['face'][1], th))
    jobs.append(sheet('%s_a' % th, 15, 3, 5, r['props'],
                      "Scale: trees are about 60-70 art pixels tall, small items about 16-24 art pixels; each art pixel is about 6x6 image pixels."))
    sett, roof, wall = r['bld']
    for bid, w, h, wall_n, role in [('house_s', 5, 4, 2, 'small house'), ('shop_m', 6, 5, 2, 'shop with a hanging sign (no letters, just an icon)'), ('hall_l', 8, 6, 3, 'large two-storey hall or inn')]:
        d = dict(id='%s_%s' % (th, bid), x=0, y=0, w=w, h=h, wall=wall_n, door=dict(x=w // 2, y=h - 1), windows=2 if w < 8 else 3)
        im, g = guides.draw_guide(d)
        gp = D + 'bld/guide/%s.png' % d['id']
        W16, H16 = (g['W'] * 7 + 15) // 16 * 16, (g['H'] * 7 + 15) // 16 * 16
        im2 = Image.new('RGB', (W16, H16), (255, 0, 255)); im2.paste(im, (0, 0)); im2.save(gp)
        from jobs_bld import BLD
        jobs.append(dict(out=D + 'bld/%s/%s.png' % (th, d['id']), tag='env_bld_' + d['id'], size='%dx%d' % (W16, H16), quality='high', background='transparent', refs=[gp],
             prompt=BLD + "This building: a %s in %s. %s roof. %s. Windows glow warm amber from inside (the only light). The whole image is %d x %d art pixels (each art pixel 7x7 image pixels).\n" % (role, sett, roof.capitalize(), wall.capitalize(), g['W'], g['H'])
                    + PIXEL + "\n" + ALBEDO.replace('NO light sources, NO glow, ', '') + "\nBackground: fully transparent (the magenta in the guide is background). No ground, no shadow, no people, no text, no letters."))
    j = bbg(th, r['bbg']); jobs.append(j)
    jobs.append(front(th, r['front']))
json.dump(jobs, open('/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/jobs_regions.json', 'w'))
json.dump({th: dict(mats=[m for m, _ in r['mats']], face=r['face'][0], props=r['props']) for th, r in R.items()}, open(os.path.join(os.path.dirname(__file__), 'regions.json'), 'w'), indent=1)
print(len(jobs))
