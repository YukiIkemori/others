"""New hero, 4 main directions, 96 art px tall: an EDIT of the old approved HD raw sheet (same grid, poses, pixel size).
usage: python3 gen_new4.py <sprite_pipe/tools dir> <old_raw.png> <out_raw.png> [quality] [extra notes]"""
import os, sys
sys.path.insert(0, sys.argv[1]); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_api            # noqa: E402
import gen_sheets as G    # noqa: E402
from design import CHAR   # noqa: E402

PROMPT = '''You are the lead pixel artist of a 2D RPG. ONE sprite sheet: the field walk cycle of the NEW protagonist.

TASK: EDIT image 1. It is a finished walk sheet of an older character, drawn as premium high-resolution pixel art (one art pixel = 4x4 image px, the figure about 96 art px tall; row 1 facing the viewer, row 2 back view, row 3 facing LEFT, row 4 facing RIGHT; column 1 standing, columns 2 and 3 the two steps). REPAINT EVERY FIGURE AS A COMPLETELY DIFFERENT, NEW CHARACTER, described below. The old character's black hair, long navy cape, crook staff and staff lantern must disappear completely.

KEEP from image 1 exactly: the canvas size, the 4x3 grid and cell positions, the facing of every frame, every leg pose and stride, the feet line of each row, the figure height on the canvas, the body proportions (about 2.7 heads tall, big head, slim neck), the pixel size (4x4 px per art pixel), the art style, the outline weight and the level of finish.

THE NEW CHARACTER: %s

HOW EACH VIEW SHOWS THE GEAR (the character's own left is the viewer's right when the character faces us):
- Row 1 (facing the viewer): the lantern hangs at the hip on the VIEWER'S RIGHT; the sword hilt shows above the shoulder on the VIEWER'S LEFT; the crescent clasp is at the throat; the mantle is open in front so the tunic, gold piping and teal sash are visible; arms swing naturally with empty hands.
- Row 2 (back view): the hood lies on the back of the shoulders with its crimson inside visible; the sword crosses the back from the hilt at the upper RIGHT of the viewer to the scabbard tip at the lower LEFT; the lantern hangs at the hip on the VIEWER'S LEFT.
- Row 3 (facing left): we see the character's LEFT side: the lantern hangs clearly visible on the near hip; the sword is seen on the back behind the shoulder, hilt up.
- Row 4 (facing right): we see the character's RIGHT side: the sword hilt rises behind the near shoulder; the lantern is on the far side, hidden behind the body (at most its lower edge peeks out).
- Walking frames: the mantle hem and its two points swing backward and show flashes of the crimson lining; the lantern swings slightly on its chain; the hair lock sways.

FINISH (this is high-resolution pixel art, 96 art px figure):
- Smooth clean outlines built from tidy pixel runs; a 1 art px dark coloured outline (very dark plum-brown, never pure black).
- Face: readable eyes with a lash line, amber-gold iris and one tiny highlight, a hint of nose and mouth, soft cheek shading.
- Hair: separate glossy locks in 4-5 shades from near-white through pale lavender to a dusty violet-grey shadow; thin bright highlight strands.
- Cloth: real folds; the ivory mantle in 5-6 shades (warm cream light, lavender-grey and dusty violet shade), crimson lining in 3-4 shades, tunic in 4-5 charcoal-indigo shades, gold piping with a light and a dark edge.
- Sword: dark scabbard with a gold chape and throat, a wrapped grip and a small gold pommel and crossguard. Lantern: brass cap and ring, four panes with dark bars, amber glass with a pale core.
- About 80-110 colours in total. Hue-shifted shading: warm light from the upper left front, blue-violet shadows. The silver hair and the ivory mantle are the brightest masses of the sprite and give it a clear light silhouette, but they keep full shading.

STRICT PIXEL RULES: every art pixel is a crisp 4x4 px square on a regular grid across the whole image. No blur, no soft airbrush gradients, no painterly smearing, no noise or texture grain, no dithering, no semi-transparent edges, no glow effects. The outer edge of every figure is hard against the background.

Within a row the three frames are the same person from the same side: identical head, hair, face, costume and colours; only the legs, arms, mantle hem, hair lock and lantern move.

CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 640x512 px (160x128 art px). One pose centred in each cell, never crossing into a neighbour cell or the image edge.
POSES (reading order):
%s
NO shadow on the ground, no floor, no text, no labels, no frames.
'''
IDS = [['walk_%s_%d' % (d, i) for i in range(3)] for d in ('down', 'up', 'left', 'right')]

def main():
    src, out = sys.argv[2], sys.argv[3]
    quality = sys.argv[4] if len(sys.argv) > 4 else 'high'
    extra = sys.argv[5] if len(sys.argv) > 5 else ''
    raw = G.load_rgb(src)
    W, H = raw.size
    order = ['row %d: %s' % (r + 1, ' | '.join(G.POSE_EN.get(s, s) for s in IDS[r])) for r in range(4)]
    pr = PROMPT % (CHAR, W, H, '\n'.join(order)) + (('\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra) if extra else '')
    open(os.path.splitext(out)[0] + '_prompt.txt', 'w', encoding='utf-8').write(pr)
    png, info = gen_api.generate(pr, [raw], size='%dx%d' % (W, H), quality=quality, background='opaque', tag='twilight_hero4')
    open(out, 'wb').write(png)
    print(out, info.get('secs'), info.get('call_meta'))

if __name__ == '__main__':
    main()
