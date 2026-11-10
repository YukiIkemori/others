"""Diagonal walk rows of the new restrained hero: a new sheet in the same grid as the chosen 4-direction raw (image 1).
usage: python3 gen_diag7.py <sprite_pipe/tools dir> <chosen_raw.png> <out_raw.png> [quality] [extra notes]"""
import os, sys
sys.path.insert(0, sys.argv[1])
import gen_api            # noqa: E402
import gen_sheets as G    # noqa: E402

PROMPT = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the DIAGONAL walk directions of the protagonist.

Image 1 is the approved walk sheet of this protagonist for the four main directions (row 1 facing the viewer, row 2 back view, row 3 facing left, row 4 facing right; three frames each: standing, one step, the other step). Draw a NEW sheet of the SAME character on the same canvas and the same 4x3 grid, in exactly the same art style, the same pixel size (the same chunky art pixels as image 1), the same figure height, feet lines, proportions (about 3.4 heads tall, small head), palette, soft shading and soft selective outline as image 1, but with these four rows:

- Row 1: walking DOWN-LEFT. A three-quarter FRONT view: we see the face and chest, the whole body turned about 45 degrees toward the viewer's left. Both eye marks visible, the far one (viewer's left) closer to the edge of the face.
- Row 2: walking DOWN-RIGHT. A three-quarter FRONT view turned about 45 degrees toward the viewer's right (the mirror situation of row 1, drawn on its own).
- Row 3: walking UP-LEFT. A three-quarter BACK view: we see the back of the head, the hood and the back of the cape, the body turned about 45 degrees toward the viewer's left; only a sliver of cheek and ear, NO eyes.
- Row 4: walking UP-RIGHT. A three-quarter BACK view turned about 45 degrees toward the viewer's right; only a sliver of cheek and ear, NO eyes.

Columns in every row: column 1 = standing still in that direction (feet together); column 2 = LEFT foot stepping forward; column 3 = RIGHT foot stepping forward. The walk is as modest and natural as in image 1: small steps, arms swinging a little, the cape hem swaying a little.

THE CHARACTER is exactly the person of image 1, nothing added and nothing left out: short silver-white hair, the plain small face with the two small dark eye marks (no nose, no mouth), the dusty-ivory hooded cape with its thin wine-red edge and the small brass dot at the throat, the charcoal-indigo tunic, the dark-teal sash, dark trousers, brown boots, bare empty hands, and the small brass lantern with amber glass hanging at the character's own LEFT hip. No sword, no staff, no bag.

LANTERN (always at the character's own left hip, the same in all three frames of a row):
- Row 1 (down-left): the left hip is the near side: the lantern hangs clearly visible in front of the hip, on the viewer's right half of the body.
- Row 2 (down-right): the left hip is the far side: NO lantern visible (hidden behind the body).
- Row 3 (up-left): the lantern hangs visible at the near hip, on the viewer's left edge of the body, below the cape hem.
- Row 4 (up-right): NO lantern visible (hidden behind the body).
The lantern is an object only: no glow, no rays, no halo.

Within a row the three frames are the same person from the same angle: identical head, hair, face, costume and colours; only the legs, arms, cape hem and lantern move. The head turn and body angle of each row must be clearly different from the pure front, back and side views of image 1 (a true three-quarter view: the shoulders are foreshortened, the nose side of the face points diagonally).

PIXEL RULES: real pixel art with the same art-pixel size as image 1, crisp squares on a regular grid. No blur, no gradients, no noise, no dithering, no glow, no black outline, hard edges against the background. Muted dusty colours exactly as in image 1; light from the upper left.

CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 644x700 px, the figures standing exactly where the figures of image 1 stand, the same figure height as image 1 (about 500 px on the canvas). One figure centred in each cell, never crossing into a neighbour cell or the image edge. NO shadow on the ground, no floor, no text, no labels, no frames.
'''

def main():
    src, out = sys.argv[2], sys.argv[3]
    quality = sys.argv[4] if len(sys.argv) > 4 else 'high'
    extra = sys.argv[5] if len(sys.argv) > 5 else ''
    raw = G.load_rgb(src)
    W, H = raw.size
    pr = PROMPT % (W, H) + (('\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra) if extra else '')
    open(os.path.splitext(out)[0] + '_prompt.txt', 'w', encoding='utf-8').write(pr)
    png, info = gen_api.generate(pr, [raw], size='%dx%d' % (W, H), quality=quality, background='opaque', tag='twilight_hero_diag7')
    open(out, 'wb').write(png)
    print(out, info.get('secs'), info.get('call_meta'))

if __name__ == '__main__':
    main()
