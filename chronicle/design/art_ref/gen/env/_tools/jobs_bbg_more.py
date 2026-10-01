"""戦闘背景の追加分（描いた絵が無くてコードの夜の絵に落ちていた id）。jobs_bbg.py の HEAD・GROUND・TAIL と bbg()・front() をそのまま使う。
   python3 jobs_bbg_more.py <out.json> [id ...]   → gen_env.py に渡す job の列（id を並べるとそれだけ。<id>_front は front だけ）"""
import json, os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
# jobs_bbg.py は import すると job を書き出すので、jobs = [ より前（定数と関数）だけを読む
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'jobs_bbg.py')).read()
exec(_src[:_src.index('\njobs = [')])

SCENES = {
 'ship': "Setting: on the deck of a drifting ghost ship in thick sea fog. Back (top 42%): the ship's broken masts and yardarms rise into the fog with tattered, "
         "torn grey sails and slack rigging, the raised stern deck with a ship's wheel and a carved railing at the back, beyond the rail only a wall of fog and a black sea. "
         "No lanterns: an eerie pale cyan-green spectral glow seeps from the fog itself and from the cracks between the planks, faint ghost-light wisps drift high in the rigging. "
         "Ground (lower 58%): the main deck of old, grey, waterlogged wooden planks receding to the stern, nail heads, a few barnacles; coiled ropes, a broken barrel, "
         "a fallen spar and a hatch grating at the sides. Light: cold spectral green-cyan from the fog, grey-violet shadows, wisps of mist over the deck.",
 'watercave': "Setting: inside a sea tide cave at night. Back (top 42%): a high vaulted cave of wet, glossy black-teal rock with layered strata, dripping water, "
         "a wide arched opening at the back right through which the night sea and a few stars are seen, the tide washing in. "
         "Clusters of shells and barnacles on the rock glow softly pearl-pink and aqua; blue bioluminescent plankton light the water at the back. "
         "Ground (lower 58%): a broad flat shelf of wet dark rock and packed wet sand, glistening, with shallow tide pools at the left and right edges reflecting the glow, "
         "starfish, kelp strands and glowing shells at the sides. Light: aqua-blue glow from the water and pearl-pink from the shells, deep teal and violet shadows, everything wet and shining.",
 'swamp': "Setting: the bell-sunk bog, a drowned village swallowed by a black bog. Back (top 42%): still black water stretching away under a low, flat, lavender-grey mist; "
         "the tops of half-sunken stone bell towers and a leaning belfry roof rise out of the water at different distances, a huge old verdigris-green bronze bell "
         "lies tilted half-submerged at the back left, a few bare pale birch trunks, a pale moon behind the mist. No lamps. "
         "Ground (lower 58%): a low island of dark peat and mud with sunken wooden boardwalk planks running into the water at the sides, ochre and olive sedge tufts, "
         "drowned stone rubble and a toppled small bell at the sides. Light: cold silver moonlight through mist, olive and lavender-grey tones, bronze-green accents, deep violet shadows.",
 'manor': "Setting: the music room / small ballroom of an abandoned haunted manor at night. Back (top 42%): a low wooden stage at the back with torn, faded wine-red velvet curtains, "
         "empty chairs and music stands for a little orchestra on it, dust sheets, a tall arched window at the side with pale moonlight, faded patterned wallpaper peeling, "
         "gilded picture frames hanging crooked, a large unlit crystal chandelier hanging high, cobwebs in the corners. "
         "Ground (lower 58%): a dusty parquet ballroom floor with a faded diamond pattern receding to the stage, a moonlight square from the window on it, "
         "a grand piano under a dust sheet at one side, a toppled chair, fallen sheet music at the sides. "
         "Light: cold blue moonlight, dusty wine-red and faded gold, deep violet shadows, dust motes in the moonbeam.",
 'oblivion': "Setting: the bottom of oblivion, the place under the world where forgotten, endless stories sink. Back (top 42%): an ink-black void with no sky, "
         "torn white tears and rips in the darkness like ripped paper edges, countless loose white pages and open books drifting and sinking slowly in the air, "
         "fragments of forgotten places floating upside down far away (a broken staircase, a door frame, a piece of a town wall, a chair), all pale, grey and drained of colour, "
         "with faint violet edges. Ground (lower 58%): a vast floating floor made of huge dim grey-violet stone slabs like old paper, with faint ruled lines and torn edges, "
         "in deep night shadow (dark mid-grey, not white, not bright), drifts of blank pages, broken quills and a few cracked slabs at the sides, the edges of the floor crumbling into the void far away. "
         "Light: only a cold faint glow from the drifting pages, ink-black, slate grey and grey-violet, almost monochrome with a faint violet tint; the scene stays dark. "
         "Crisp blocky pixel clusters, not a sketch, not ink drawing.",
 'volcano': "Setting: deep inside the crater of a volcano. Back (top 42%): the sheer black crater walls rising all around in a ring, far above them only a small circle of night sky "
         "with a few stars seen through smoke; molten lava falls pour down the crater walls into a wide bright lava lake, glowing orange-yellow, with dark cooled crust plates floating on it, "
         "an island of black rock with jagged spires in the far middle of the lake. Ground (lower 58%): a broad causeway of black basalt and cooled lava crust, "
         "cracked, with thin glowing seams at the far left and right edges where it meets the lava, heaps of black rock at the sides. "
         "Light: strong orange-yellow lava light from below and behind, heat shimmer and embers, black and deep red-violet shadows.",
 'pyramid': "Setting: inside the royal burial hall of an ancient desert tomb, underground. Back (top 42%): a long sandstone hall with tall square pillars, "
         "walls covered with painted murals of invented hieroglyph-like symbols, kings, birds and boats in faded turquoise, lapis blue, ochre and gold (pictures only, no readable writing), "
         "a stepped dais at the far back with a closed golden sarcophagus, a thin shaft of moonlight falling from a crack in the ceiling. No braziers lit. "
         "Ground (lower 58%): large worn sandstone floor slabs receding to the dais, drifts of fine sand blown over them, "
         "broken pottery jars, a toppled statue head and sand piles at the sides. Light: cool blue moonlight shaft and a faint gold sheen from the paint, warm ochre stone, deep blue-violet shadows.",
 'ice': "Setting: before a giant frozen icefall on a mountain at night. Back (top 42%): a towering wall of deep blue glacier ice fills the background, "
         "with huge vertical cracks, frozen waterfall columns and enormous icicles, clear turquoise and cobalt ice with trapped bubbles and faint inner light, "
         "a narrow strip of starry night sky above it. Ground (lower 58%): the surface of a frozen mountain lake: smooth dark clear ice with white cracks and frozen bubbles, "
         "a thin dusting of snow swept into drifts at the sides, ice boulders and broken ice slabs at the left and right edges. "
         "Light: cold moonlight refracted through the ice wall, cyan and cobalt glows, deep indigo-violet shadows. Not a snowfield: this is ice, blue and glassy.",
 'peak': "Setting: the wind-swept summit of the highest mountain, above the clouds, the white dragon's peak. Back (top 42%): a vast sea of clouds far below, lit silver by "
         "a huge low full moon, a starry sky, a few distant icy peaks poking through the clouds; on the summit at the back, an ancient ring of weathered standing stones "
         "carved with dragon reliefs and an old altar of rime ice, banners of blown snow streaming from the ridges. "
         "Ground (lower 58%): a wide summit plateau of wind-scoured grey rock and hard-packed snow, rime crystals and frost feathers on the rocks at the sides, "
         "the edge of the plateau falling away into the clouds at the far left and right. Light: bright silver moonlight, pale violet and silver-white, deep blue shadows, crisp thin air.",
 'road': "Setting: a night road just outside the gate of a small walled town. Back (top 42%): the town wall and an arched town gate at the back right with a few warm lamplit windows "
         "and rooftops behind it far away, a starry sky with a crescent moon, dark rolling fields and low hills, a line of old fence posts, a lone bare tree on the left. "
         "Ground (lower 58%): a wide old road of packed earth and worn cobbles coming from the gate toward the viewer, cart ruts, "
         "short grass and wildflowers at the road edges, a wooden signpost with blank boards and a mossy milestone at the sides. "
         "Light: cool moonlight, faint warm glow only from the distant town windows, deep blue-violet shadows.",
}
FRONTS = {
 'ship': "the edge of a broken wooden rail, a coil of rope, a barrel and a torn piece of sail.",
 'watercave': "wet dark rocks with barnacles, glowing shells and strands of kelp.",
 'swamp': "sedge tufts, a rotten boardwalk plank and the rim of a small sunken bell in the mud.",
 'manor': "the edge of a dust sheet, a toppled chair leg, scattered sheet music and a cracked music stand.",
 'oblivion': "drifting torn pages and broken pale slabs with ruled lines.",
 'volcano': "jagged black basalt rocks with thin glowing cracks.",
 'pyramid': "broken sandstone blocks, a cracked clay jar and a small sand drift.",
 'ice': "broken ice slabs and small icicles, a little snow.",
 'peak': "wind-carved rime-covered rocks and frost feathers.",
 'road': "tall grass, wildflowers and the edge of a mossy stone.",
}

def front_key(id_, what):
    # 今のモデルは透明の背景を作れない: 一色のマゼンタの背景で作り、key_front.py でマゼンタを抜く（envlib.key_bg と同じ考え）
    j = front(id_, what)
    j['background'] = 'opaque'; j['key'] = 'magenta'
    j['prompt'] = j['prompt'].replace('Everything else is fully transparent (the middle and top of the image are empty).',
                                      'Everything else is a flat, solid, pure magenta (#FF00FF) background with no gradient, no texture and no shading '
                                      '(the middle and top of the image are empty magenta); no magenta inside the foreground objects.')
    return j


if __name__ == '__main__':
    out = sys.argv[1]
    want = sys.argv[2:]
    jobs = []
    for i, sc in SCENES.items():
        if not want or i in want: jobs.append(bbg(i, sc))
        if not want or (i + '_front') in want: jobs.append(front_key(i, FRONTS[i]))
    json.dump(jobs, open(out, 'w'), ensure_ascii=False)
    print(len(jobs), [os.path.basename(j['out']) for j in jobs])
