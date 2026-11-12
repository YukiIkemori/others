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
    # ---- beyond the wheat hills: F02 草の高原, 崖の修道院 マップ2 (依頼21)
    mn006="a leaping hare: a horned hare with very thick, long hind legs, risen on its hind legs and coiled to jump, forelegs tucked, one short straight horn on its forehead, ears laid back. A wild animal, not a pet. Reddish brown fur, the belly grey-white, the horn bone white. Standing up it reaches a person's hip.",
    mn017="an armour beetle as big as an ox: a round, thick, domed shell and six short legs, the head held low and pushing forward, one short blunt horn. The shell is a dark mossy green with a dull shine and long scratches, the belly brown. Its back reaches a person's chest; it is one and a half times as long as a person is tall.",
    mn037="a grass snake: coiled in a neat pile with its head raised and a thin forked tongue out. Bands of grass green and dull ochre. Small: the raised head reaches a person's knee.",
    mn046="a goblin archer: a small hunched goblin with long arms in a ragged fur pelt, holding a crude short bow with an arrow on the string, a quiver of arrows on its back. Pointed ears, a big nose, small dark eyes. Yellowish grey-green skin, brown fur pelt. Not comical. It reaches a person's chest.",
    mn049="a bone soldier: a human skeleton in rusted armour pieces (a dented breastplate, one shoulder guard), pointing a chipped sword forward. Its helmet is split in half, the eye holes are dark and empty. The bones are a yellowed white, the armour rust brown. As tall as a person.",
    mn053="a lost ghost: a legless, see-through human figure with both arms stretched forward. The face is blurred, only the places of the eyes are dark. From the waist down it thins out and vanishes like smoke. Bluish grey-white, pale. As tall as a person. It floats: draw it in the middle of the picture.",
    mn097="a will-o'-the-wisp: one small floating ball of flame with a bright core and a short tail hanging below it, and a thin faint ring of light around it. Milk white to pale yellow. Small: as big as a person's head. It floats: draw it in the middle of the picture, large.",
    mn101="a coin bug: a small heap of old copper coins with six thin black insect legs under it; two tiny eyes peep out of a gap between the coins. It is backing away, about to run. Dull copper, the legs black. Small: it reaches a person's knee.",
    bs01="THE BELL WARDEN, a boss: a huge crow as tall as a person, swooping down with both wings spread wide (its wingspan is twice a person's width), claws forward, beak open. An old bell rope of faded red-brown is tangled around one wing and trails behind it. Ink black and deep indigo feathers. Menacing and old, not comical. It flies: draw it in the middle of the picture, filling most of it.",
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
    # ---- the capital (依頼5 2-3)
    npc_c="""1. A tavern keeper: a big burly man with a smooth bald head, a dark brown apron over a rolled-sleeve shirt, arms folded.
2. A wandering minstrel: a faded blue-green coat, holding an old small harp (lyre) in his arms.
3. A map seller: a thin man in a wide-brimmed hat, with a bundle of rolled parchment scrolls under one arm.
4. A washed-up adventurer: one forearm wrapped in bandages, worn-out leather armour, unshaven, tired look.
5. A weapon-shop mistress: a sturdy woman with sooty leather gloves, a leather apron, hair tied up.""",
    npc_d="""1. An inn landlady: a brisk middle-aged woman with a white headscarf, a grey-blue dress and a clean apron.
2. A noble lady: a dull grape-purple dress, a hat with a feather, holding a small closed parasol.
3. A lamplighter boy (a child): soot on his cheeks, a cap, holding a long lighting pole taller than himself.
4. A city gate guard: a grey-blue cloak over mail, a plain helmet, holding a long spear upright, serious face.
5. An old sewer warden: a bent old man in tall rubber-like leather boots, holding a small lantern (unlit), a patched coat.""",
    npc_e="""1. A castle scribe: a slim woman with thin round glasses and an ink-dark coat, hugging two books to her chest.
2. An armourer: a broad man with a short grey beard, a padded vest and a small hammer at his belt.
3. An item-shop keeper: a cheerful thin man with a green cap and a satchel full of small bottles.
4. A town woman: a brown shawl, carrying a market basket with bread.
5. A merchant: a long dull-red coat with a fur collar, a round belly, a ledger under his arm.""",
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
    bg_f02=("short wind-combed grey-green highland grass with heather, thistles and small pale flowers and a packed-earth highway with ruts",
            "scattered grey boulders and a wind-bent lone tree, then an ancient gate of weathered bone-white stone with broken columns standing alone on the bare plateau before a grassy burial mound, and far behind, hazy, the long grey wall and red-brown roofs of a great city."),
    bg_abbey2=("worn stone floor slabs of an old church with a faded dark-red carpet runner along it",
               "rows of old wooden pews, tall stone pillars, iron candle stands with a few burning candles, pointed arches, tall narrow stained-glass windows glowing a dull amber, and at the far end a stone altar under a great round window. It is the INSIDE of an abandoned abbey church: instead of a sky, the upper part of the picture is the dark vaulted ceiling with stone ribs, lost in shadow."),
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
TALL = dict(mn001=50, mn005=64, mn009=66, mn025=90, mn045=70, mn033=66, mn013=58, mn029=86, mn021=84,
            mn006=74, mn017=62, mn037=44, mn046=70, mn049=88, mn053=88, mn097=40, mn101=40, bs01=124)      # dots on screen (the heroes are 80), as in make_sprites.py
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
