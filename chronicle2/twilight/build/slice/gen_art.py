"""Generates the raw art of the first slice with gpt-image-2 (monsters, villagers, props, battle backgrounds).
usage: gen_art.py out_dir [name ...]     (no names = everything that is not there yet)
References are made from the game's own art so that everything looks painted by the same hand."""
import sys, os, numpy as np
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); TW = os.path.join(HERE, '../..')
sys.path.insert(0, os.path.join(HERE, '..'))
from img import gen
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)

def refs():
    a, b = f'{OUT}/ref_map.png', f'{OUT}/ref_party.png'
    if not os.path.exists(a):
        m = Image.open(f'{TW}/slice/village/map.webp').convert('RGB').crop((760, 700, 1400, 1340)); m.resize((1280, 1280), Image.NEAREST).save(a)
    if not os.path.exists(b):
        c = Image.new('RGB', (4 * 96, 128), (255, 0, 255))
        for i, n in enumerate(('hero', 'sword', 'rogue', 'priest')):
            s = Image.open(f'{TW}/site/party/{n}.png').convert('RGBA').crop((0, 0, 96, 128)); c.paste(s, (i * 96, 0), s)
        c.resize((4 * 96 * 4, 128 * 4), Image.NEAREST).save(b)
    return a, b

MON = """Image 1 is a piece of this game's background art (enlarged 2x) and image 2 shows the game's four heroes (enlarged 4x). Together they define the pixel-art craft, the size of the dots, the muted earthy palette and the level of detail of this HD-2D RPG.
Paint ONE monster for the game's side-view battle screen so that it looks painted by the same hand: premium detailed pixel art, crisp deliberate pixel clusters with dots as fine as in image 2, the texture of fur, shell, slime or flesh clearly readable, 3 to 5 shades per material with hue-shifted shading, outlines in a darker shade of the body's own colour (never black lines). Colours are muted, deep and calm (moss green, rust brown, earth, amber, indigo grey); no saturated primary colours, no bright 16-bit console colours.
The monster stands alone and still. Its body faces RIGHT and is turned slightly toward the viewer (three-quarter front view). The whole body is inside the picture with a clear margin on every side and fills about two thirds of the picture.
It is a solid living creature of a dim, melancholy storybook world: not chibi, no oversized head, not cute, no smile, no large manga eyes; eyes are small and dark. Not comical.
Light: a weak pale light from the upper right front; the lower left side lies in deep shade.
Background: perfectly flat pure magenta #FF00FF everywhere. No ground, no cast shadow, no smoke, no glow, no text, no frame.

THE MONSTER: """
MONSTERS = dict(
    mn001="a moss slime: a wobbly half-transparent lump, rounded on top and squashed at the bottom like a heavy drop. Two or three small pebbles and dead leaves are sunk inside its body. No eyes, no mouth. Moss green, a little lighter at the rim and darker inside, with a dull wet sheen on its surface. Small: it reaches a person's knee.",
    mn005="a horned hare: a large wild hare with one straight horn on its forehead, crouching low on four legs with the horn pointed forward, ears raised in alarm. A wild animal, not a pet. Dry-grass brown and grey fur, the horn bone white. Small: knee to hip height of a person.",
    mn009="a stray dog: a lean wild dog with ribs showing and thin patchy fur, head held low, teeth bared, one ear torn. Earth brown and dull ochre. It reaches a person's hip.",
    mn025="a walking mushroom as tall as a person: a thick pale stalk on two short root-like legs under a round cap. It has no face; only the shadow under the gills of the cap looks a little like one. The cap is a dull brown, the stalk unbleached cream.",
    mn045="a small goblin: short, hunched, with long arms, wearing a ragged fur pelt and holding a wooden club low at its side. Pointed ears, a big nose, small dark eyes. Greenish-grey skin, brown fur pelt. Not comical. It reaches a person's chest.",
    mn033="an ash crow: a grey crow perched on a small rock, head tilted, holding one small shining coin in its black beak. Grey and ink-dark feathers. Small: the bird itself is knee height.",
    mn013="a cave bat: a large bat hovering with its torn wings spread wide, two or three holes in the wing membrane. Dark brown body, membranes a slightly reddish brown. Wingspan about a person's shoulder width. It floats: draw it in the middle of the picture.",
    mn029="a bud-eater: a man-eating flower that has not bloomed yet. A closed bud on a thick stem, the tip of the bud split a little so that teeth show; its roots are spread like feet. Dull green, the bud tip a dark red-violet. It reaches a person's hip.",
    mn021="a thread spider: a spider with a small body and very long thin legs, its two front legs raised, drawing a strand of silk between them. Grey-brown, with black bands at the leg joints. With legs spread it stands hip high.",
)
NPC = """Image 1 shows the four heroes of an HD-2D RPG as field sprites (enlarged 4x, front view, standing). Draw FIVE villagers of the same game in exactly the same style so that they look drawn by the same hand: the same dot size, the same body proportions (about 3.3 heads tall, small head), eyes as tiny dark dots, no nose, no mouth, no black outlines (edges are a darker shade of the shape's own colour), muted dusty colours, 3-4 shades per material, calm shading from the upper left.
Each villager stands still facing the viewer, seen slightly from above exactly like the heroes in image 1, in ONE ROW, evenly spaced with clear gaps, all drawn at the same scale as the heroes, feet on one common line. Adults are as tall as the heroes; children reach the adults' chest.
Background: perfectly flat pure magenta #FF00FF. No ground, no shadows, no text, no frame.
From left to right:
"""
NPCS = dict(
    npc_a="""1. An old gossip: white beard, a patched travel cloak, a leather glove on one hand only, sitting on a wooden barrel with his hands on his knees.
2. A farmer's wife, the hero's mother: sleeves rolled up, an unbleached linen dress, an apron dusted with flour, brown hair tied back.
3. A small old herbalist woman: bent back, a deep green shawl, a bundle of dried herbs hanging at her waist.
4. A village smith: thick bare arms, a sooty leather apron, short dark beard, silent look.
5. A plump shopkeeper woman: a dull red headscarf, a brown dress with a cream apron.""",
    npc_b="""1. The village elder: a thin old man in a long grey coat, leaning on a walking stick.
2. An old priest: short white beard, a faded indigo robe, hands folded.
3. A shepherd boy (a child): freckles, a wool vest, holding a long shepherd's crook taller than himself.
4. A young girl (a child): dark curly hair tied with an ochre ribbon, a simple brown dress.
5. A travelling pedlar: a big wooden pack box on his back, a wide-brimmed sun hat, dusty boots.""",
)
PROPS = """Image 1 is a piece of this game's background art (enlarged 2x): it defines the pixel-art craft, the dot size and the muted earthy palette. Draw THREE separate objects for the same game in one row, evenly spaced with wide gaps, seen from the front and slightly from above (the same 3/4 overhead view as image 1), in the same pixel-art style:
1. A closed treasure chest: weathered dark wood with dull iron bands and a small brass lock, about as wide as a person.
2. The same chest with its lid swung open toward the back, a faint warm glow inside.
3. A save crystal: a slender warm amber crystal pointed at both ends, a little taller than the chest, with a tiny warm light in its heart and soft facets (the crystal only, floating: nothing under it).
Background: perfectly flat pure magenta #FF00FF. No ground, no shadows, no text, no frame."""
BG = """Image 1 is a map of this place from the same HD-2D RPG, seen from above: copy its pixel-art craft, its muted earthy palette, its density of small detail and its motifs. Paint the BATTLE BACKGROUND of this place: the same landscape seen from the SIDE, with the eye a little above head height, like a stage.
The lower 40 percent of the picture is a wide, flat, open strip of ground running across the whole width, where the fighters will stand later: %s. It must be EMPTY: nothing stands on it, only low texture.
Behind it, in layers that get paler and hazier with distance: %s
The sky: a heavy, dim overcast of an endless late afternoon with ONE weak pale sun disc behind thin cloud. It is not night; there is no moon and no stars. Colours are muted, deep and earthy; a faint cool violet-grey haze lies in the distance.
Premium detailed pixel art, crisp deliberate pixel clusters, dark plum-brown outlines (never pure black). No characters, no animals, no monsters, no text, no UI, no frame."""
BGS = dict(
    bg_f01=("short mossy grass with clover and small wild flowers and a packed-earth cart track with ruts",
            "a low dry-stone wall and a field of ripe dull-gold wheat, haystacks, two old broadleaf trees at the sides, then rolling wheat hills with a small thatched village on one of them, amber windows glowing, and far behind a long dark rock cliff with fir trees on top."),
    bg_abbey=("worn flagstones with moss and grass in the cracks and a few fallen leaves",
              "old leaning headstones and stone crosses of a graveyard, a broken stone gate arch at one side, the roofless walls and tall pointed windows of a ruined abbey nave, a dead tree, and far behind a silent bell tower on the edge of a cliff above a sea of cloud."),
)
# Second pass for the monsters (ユウキ: the first ones looked stippled next to the party).  The design of the first pass is kept;
# the drawing is redone with the heroes' own technique: big dots, flat shades in large clusters, a clean dark outline.
FLAT = """Image 1 shows the four heroes of an HD-2D RPG as game sprites, enlarged 4 times: every dot of a hero is a clean square block. Image 2 is a monster of the same game, but drawn with the wrong technique: its surface is speckled with single light and dark dots like a pointillist painting, and its dots are too fine.
Redraw the monster of image 2 as a game sprite in EXACTLY the technique of the heroes in image 1, so that it stands beside them as if drawn by the same pixel artist:
- Big square dots of the same size as the heroes' dots: the monster is about %d dots tall, and each dot is a clean square block of about %d by %d pixels of this picture, on one regular grid.
- Flat cel shading. Every material has only three or four flat shades, laid in LARGE, calm, connected areas with clean edges. Absolutely no dithering, no stippling, no speckle, no noise, no checker patterns, no single stray dots.
- Fur, feathers, moss and bark are NOT drawn hair by hair: they are shown by the jagged shape of the outline and by a few broad tufts or bands of the darker shade.
- One continuous outline, one dot wide, in a very dark shade of the body's own colour (dark brown, dark olive, dark slate; never pure black), exactly as around the heroes.
- A few small highlights only where the weak light from the upper right front falls.
Keep the monster itself as it is in image 2: the same creature, the same pose facing right, the same silhouette and proportions, the same muted earthy colours, the same size in the picture.
Background: perfectly flat pure magenta #FF00FF everywhere. No ground, no cast shadow, no glow, no text, no frame."""
TALL = dict(mn001=50, mn005=64, mn009=66, mn025=90, mn045=70, mn033=66, mn013=58, mn029=86, mn021=84)      # dots on screen (the heroes are 80), as in make_sprites.py
def flat(name):
    """raw/<name>.png (first pass) -> raw/<name>_flat.png"""
    src = Image.open(f'{OUT}/{name}.png'); px = max(6, min(12, round(src.height * .66 / TALL[name])))
    return gen(FLAT % (TALL[name], px, px), f'{OUT}/{name}_flat.png', '1024x1024', 'high', images=[refs()[1], f'{OUT}/{name}.png'], tag='slice_flat_' + name)

def job(name):
    if name.endswith('_flat'): return flat(name[:-5])
    out = f'{OUT}/{name}.png'
    a, b = refs()
    if name in MONSTERS: return gen(MON + MONSTERS[name], out, '1024x1024', 'high', images=[a, b], tag='slice_' + name)
    if name in NPCS: return gen(NPC + NPCS[name], out, '1536x1024', 'high', images=[b], tag='slice_' + name)
    if name == 'props': return gen(PROPS, out, '1536x1024', 'high', images=[a], tag='slice_props')
    if name in BGS:
        ref = f'{OUT}/ref_{name}.png'
        return gen(BG % BGS[name], out, '1920x1088', 'high', images=[ref], tag='slice_' + name)
names = sys.argv[2:] or [n for n in list(MONSTERS) + list(NPCS) + ['props'] + list(BGS) if not os.path.exists(f'{OUT}/{n}.png')]
refs()
with ThreadPoolExecutor(8) as ex:
    for n, r in zip(names, ex.map(lambda n: (lambda: job(n))() if True else None, names)): print('done', n)
