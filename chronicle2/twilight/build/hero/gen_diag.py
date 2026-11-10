"""Diagonal walk rows of the new hero, as a new sheet in the same grid as the chosen 4-direction raw (image 1).
usage: python3 gen_diag.py <sprite_pipe/tools dir> <chosen_raw.png> <out_raw.png> [pose_ref.png|-] [quality] [extra notes]"""
import os, sys
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_api            # noqa: E402
import gen_sheets as G    # noqa: E402
from design import CHAR   # noqa: E402

PROMPT = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the DIAGONAL walk directions of the protagonist.

Image 1 is the approved walk sheet of this protagonist for the four main directions (row 1 facing the viewer, row 2 back view, row 3 facing left, row 4 facing right; three frames each: standing, one step, the other step). Draw a NEW sheet of the SAME character on the same canvas and grid, in exactly the same art style, pixel size (one art pixel = 4x4 image px, high-resolution pixel art), figure size, feet lines, proportions (about 2.7 heads, big head), palette, shading and outline as image 1, but with these four rows:

- Row 1: walking DOWN-LEFT. A three-quarter FRONT view: we see the face and chest, turned about 45 degrees toward the viewer's left. Both eyes visible, the far eye narrower.
- Row 2: walking DOWN-RIGHT. A three-quarter FRONT view turned about 45 degrees toward the viewer's right (the mirror situation of row 1, but painted on its own, lit from the upper left like everything else).
- Row 3: walking UP-LEFT. A three-quarter BACK view: we see the back of the head, the hood and the back of the mantle with the sword on it, turned about 45 degrees toward the viewer's left; only a sliver of cheek and ear, no eyes or at most the corner of one.
- Row 4: walking UP-RIGHT. A three-quarter BACK view turned about 45 degrees toward the viewer's right.

Columns in every row: column 1 = standing still in that direction (feet together); column 2 = LEFT foot stepping forward; column 3 = RIGHT foot stepping forward. The strides are as long and lively as in image 1; the mantle hem swings backward with each step and shows flashes of its crimson lining.
%s
THE CHARACTER is exactly the person of image 1, nothing added and nothing left out: silver-white windswept hair with lavender shadows, the small stray lock on top and the longer lock beside the cheek, amber-gold eyes, fair skin; the short ivory hooded mantle with crimson lining, thin gold edge and the gold crescent-moon clasp at the throat; the charcoal-indigo tunic with gold piping, the wide dark-teal sash, dark trousers, tall brown leather boots, brown fingerless gloves, empty hands; the sword in its dark scabbard across the back; the small brass lantern with amber glass hanging on its chain from the sash.

GEAR, the same in all three frames of a row (as in image 1, the sword hilt rises over the character's own LEFT shoulder and the lantern hangs at the character's own LEFT hip):
- Row 1 (down-left): the character's left side is the near side: the lantern hangs clearly visible at the near hip (toward the viewer's right of the body); the sword hilt rises behind the shoulder on the viewer's right.
- Row 2 (down-right): the character's left side is the far side: the lantern is hidden behind the body (at most its edge peeks out past the far hip); only the top of the sword hilt peeks above the far shoulder.
- Row 3 (up-left): the lantern hangs visible at the near hip on the viewer's left of the body; the whole sword is seen lying across the back, hilt up.
- Row 4 (up-right): the whole sword is seen lying across the back, hilt up; the lantern is on the far side, hidden behind the body.
The lantern is an object only: no glow, no rays, no halo.

Within a row the three frames are the same person from the same angle: identical head, hair, face, costume and colours; only the legs, arms, mantle hem, hair lock and lantern move. The head turn of each row must be clearly different from the pure front, back and side views of image 1.

PIXEL RULES: real hand-placed pixel art, every art pixel a crisp square of the same size as in image 1. No blur, no soft gradients, no noise, no dithering, no glow, hard edges against the background. Warm light from the upper left front, blue-violet shadows, dark coloured outline (never pure black).

CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 640x512 px. One pose centred in each cell, the same figure height as image 1 (about %d px on the canvas), never crossing into a neighbour cell or the image edge. NO shadow on the ground, no floor, no text, no labels, no frames.
'''
REF2 = '''
Image 2 is ONLY a reference for the four body angles, the head turns and the leg strides of these four rows (it shows a different, older character in the same grid). Take the angles and strides from it, but nothing of its character: no black hair, no long navy cape, no staff.
'''

def main():
    src, out = sys.argv[2], sys.argv[3]
    ref = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None
    quality = sys.argv[5] if len(sys.argv) > 5 else 'high'
    extra = sys.argv[6] if len(sys.argv) > 6 else ''
    raw = G.load_rgb(src)
    W, H = raw.size
    pr = PROMPT % (REF2 if ref else '', W, H, 400) + (('\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra) if extra else '')
    open(os.path.splitext(out)[0] + '_prompt.txt', 'w', encoding='utf-8').write(pr)
    imgs = [raw] + ([G.load_rgb(ref)] if ref else [])
    png, info = gen_api.generate(pr, imgs, size='%dx%d' % (W, H), quality=quality, background='opaque', tag='twilight_hero_diag')
    open(out, 'wb').write(png)
    print(out, info.get('secs'), info.get('call_meta'))

if __name__ == '__main__':
    main()
