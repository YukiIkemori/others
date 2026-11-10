"""New hero in the restrained HD-2D field-sprite direction (3.3 heads, 80 art px, muted, selective outline).
Fresh drawing over a grey mannequin guide (image 1: size / placement), with a crop of the game map (image 2) as the
pixel-density and palette reference.
usage: python3 gen_o.py <sprite_pipe/tools dir> <guide.png> <mapref.png> <out_raw.png> <3|6> [quality] [extra notes]"""
import os, sys
sys.path.insert(0, sys.argv[1])
import gen_api            # noqa: E402
import gen_sheets as G    # noqa: E402

CHAR = '''a young traveller of about 16, slim, androgynous-boyish, quiet and watchful.
- Hair: short, silver-white, slightly windswept, in a few simple soft locks; shaded pale warm grey to dusty lavender-grey. No tall antenna tuft.
- A SHORT hooded cape of dusty ivory (unbleached linen colour) that ends at the hips, hood down on the shoulders; a muted wine-red lining of which only a thin 1 px hint shows at the hem and inside the hood (no thick red border). A single 1-2 px brass dot closes it at the throat.
- Charcoal-indigo tunic, a dark-teal sash at the waist, dark trousers, plain brown leather boots. Bare hands, EMPTY. No gloves detail, no piping, no ornaments.
- ONE small prop only: a little brass lantern with amber glass (about 5 art px wide, 8 high) hanging at the character's own LEFT hip. No glow, no rays, no halo. NO sword, NO staff, NO bag, NO scarf.'''

STYLE = '''STYLE: the restrained, grown-up pixel art of modern "HD-2D" console RPG field sprites: small figures that sit quietly inside a richly lit pixel diorama. NOT a 16-bit / SNES-style chibi sprite.
- PROPORTIONS AND PIXEL DENSITY: 3.3 heads tall. The whole figure is 80 art pixels tall from the top of the hair to the boot soles: count them, 80 rows of pixels. The head with hair is about 24 art px high and 21 wide (a SMALL head, drawn with FINE pixels: one eye is only 1/21 of the head width); natural shoulders about as wide as the head or a little wider; a real torso; legs about 30 art px long. Not chibi, not super-deformed, no oversized hands or boots.
- FACE: a small plain skin plane. Eyes are tiny dots: 1 px wide, 2 px high, dark brown, about 5 px apart. NO eyelashes, NO iris, NO eye highlight, NO eyebrows, NO nose, NO mouth, NO blush. A soft shadow under the fringe is the only modelling.
- NO BLACK OUTLINE. There is no dark or blackish line around the figure, around the arms, the legs or the cape. The edge of every shape is simply a darker, slightly cooler shade of that shape's own colour (selective outline), 1 px, so the figure sits softly in a dusk scene. No near-black pixels anywhere except the two eye dots.
- COLOURS: muted, dusty, slightly desaturated, like cloth and leather seen at dusk. About 18-28 colours in the whole sheet, 3-4 shades per material (hair, skin, ivory cape, wine lining 2, tunic, teal sash 2, trousers, boots, brass 2, amber 2). No saturated highlights, no pure white, no shiny specular dots, no gloss bands on the hair.
- SHADING: soft and simple, in big calm planes: light from the upper left, a broad shadow side on the right and under the cape, shadows drifting toward blue-violet. Low contrast inside each material. No dithering, no texture noise, no fold spaghetti: 2-3 quiet folds on the cape are enough.
- MOTION: a modest, natural walk: small steps, the body bobs 1 px, arms swing a little, the cape hem sways a little, the lantern swings 1 px. No dramatic strides, no flying cape.
- PIXELS: real pixel art. One art pixel = exactly 7x7 image px on a regular grid over the whole image (the same grid the mannequins of image 1 are built on). Crisp squares: no blur, no anti-aliasing against the background, no gradients, no glow.'''

LAYOUT3 = '''CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 644x700 px (92x100 art px), exactly where the mannequins of image 1 stand.
Row 1: facing the viewer (walking toward us). Row 2: back view (walking away). Row 3: facing LEFT (profile). Row 4: facing RIGHT (profile).
Columns in every row: 1 = standing still; 2 = LEFT foot stepping forward; 3 = RIGHT foot stepping forward.
The camera looks slightly down on the figure (top-down RPG field view), the same angle in every cell.
LANTERN SIDE (the character's own left hip): row 1 on the VIEWER'S RIGHT hip; row 2 on the VIEWER'S LEFT hip; row 3 fully visible on the near hip; row 4 hidden behind the body in ALL three frames (no lantern drawn in row 4).'''

LAYOUT6 = '''CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 6 columns, each cell 640x512 px (160x128 art px). The LEFT half (columns 1-3) holds the four main directions, the RIGHT half (columns 4-6) the four diagonal directions:
LEFT HALF  - Row 1: facing the viewer (walking toward us). Row 2: back view (walking away). Row 3: facing LEFT (profile). Row 4: facing RIGHT (profile).
RIGHT HALF - Row 1: walking DOWN-LEFT, a three-quarter FRONT view turned about 45 degrees toward the viewer's left (face and chest visible, both eye dots visible). Row 2: walking DOWN-RIGHT, three-quarter FRONT view turned 45 degrees toward the viewer's right. Row 3: walking UP-LEFT, a three-quarter BACK view turned 45 degrees toward the viewer's left (back of the head and cape, no eyes). Row 4: walking UP-RIGHT, three-quarter BACK view turned 45 degrees toward the viewer's right.
In each half the three columns of a row are: standing still; LEFT foot stepping forward; RIGHT foot stepping forward.
The camera looks slightly down on the figure (top-down RPG field view), the same angle in every cell. The head turn and body angle of each diagonal row must be clearly different from the pure front, back and side rows.
LANTERN SIDE (always the character's own left hip): front view: on the VIEWER'S RIGHT hip. Back view: on the VIEWER'S LEFT hip. Facing left: fully visible on the near hip. Facing right: hidden behind the body. Down-left: visible on the near hip (viewer's right of the body). Down-right: hidden behind the body. Up-left: visible on the near hip (viewer's left of the body). Up-right: hidden behind the body.'''

PROMPT = '''You are the lead pixel artist of a 2D RPG. ONE sprite sheet: the field walk cycle of the protagonist, drawn fresh.

IMAGE 1 is a SIZE AND PLACEMENT GUIDE: grey mannequins on magenta, one per cell. Each mannequin marks exactly where one figure stands, how tall it is (80 art px = 560 image px), how small the head is, and where the feet line is. Draw every figure over its mannequin with the same height, the same head size, the same centre and the same feet line. The mannequins themselves are crude: replace them completely with a properly drawn character (natural shoulders and arms, a cape, real legs and boots); no grey mannequin may remain.

IMAGE 2 is a crop of the game's field map at the same pixel size (one art pixel = 4x4 image px), (there enlarged 4x; your sheet is drawn at 7 image px per art pixel) given ONLY as a reference for the pixel language, the dusk palette and the level of finish the character must match: he must look as if he was drawn by the same artist and is standing in that place at dusk. Draw NO background, no ground, no stones, no lantern posts from image 2.

%s

THE CHARACTER: %s

%s

All figures are the same person at the same size: identical head, hair, costume and colours in every cell; within a row only the legs, arms, cape hem and lantern move. One figure centred in each cell, never crossing into a neighbour cell or the image edge.
NO shadow on the ground, no floor, no text, no labels, no numbers, no frames, no grid lines.
'''

def main():
    guide, mapref, out, cols = sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
    quality = sys.argv[6] if len(sys.argv) > 6 else 'high'
    extra = sys.argv[7] if len(sys.argv) > 7 else ''
    g = G.load_rgb(guide)
    W, H = g.size
    lay = (LAYOUT3 if cols == 3 else LAYOUT6) % (W, H)
    pr = PROMPT % (STYLE, CHAR, lay) + (('\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra) if extra else '')
    open(os.path.splitext(out)[0] + '_prompt.txt', 'w', encoding='utf-8').write(pr)
    png, info = gen_api.generate(pr, [g, G.load_rgb(mapref)], size='%dx%d' % (W, H), quality=quality, background='opaque', tag='twilight_hero_o7')
    open(out, 'wb').write(png)
    print(out, info.get('secs'), info.get('call_meta'))

if __name__ == '__main__':
    main()
