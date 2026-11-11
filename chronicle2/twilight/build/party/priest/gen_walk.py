"""Main 4 directions of the priestess walk (front, back, left, right x stand, left step, right step) over the guide.
usage: python3 gen_walk.py <out_raw.png> [quality] [extra notes]"""
import sys
from PIL import Image
import common as C
GUIDE = '/home/user/tw/party/priest/guide_walk.png'
PROMPT = '''You are the lead pixel artist of a 2D RPG. ONE sprite sheet: the field walk cycle of a new party member, drawn fresh.

IMAGE 1 is a SIZE AND PLACEMENT GUIDE: grey mannequins on magenta, one per cell. Each mannequin marks exactly where one figure stands, how tall it is (76 art px = 532 image px), how small the head is, where the feet line is, and (the thin pale stick) on which side of the body the staff is held and how tall it is. Draw every figure over its mannequin with the same height, the same head size, the same centre and the same feet line. The mannequins themselves are crude: replace them completely with a properly drawn character; no grey mannequin may remain.

IMAGE 2 is the STYLE REFERENCE: the approved walk sheet of the game's protagonist (a silver-haired traveller in an ivory cape), drawn on the same canvas and grid. The new character must match it in every respect of craft: the same art-pixel size, the same head size and proportions, the same level of detail, the same muted dusk palette family, the same soft shading and soft selective outline, the same slightly-from-above camera. She is a DIFFERENT person: do not copy his hair, cape, tunic, boots or lantern.

%s

THE CHARACTER: %s

MOTION: a gentle, modest walk with small steps: the body bobs 1 px, the robe hem sways a little and the tip of the stepping shoe shows under it, the free (left) arm swings a little, the hair ends sway 1 px. The staff stays upright and moves with the hand.

CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 644x700 px (92x100 art px), exactly where the mannequins of image 1 stand.
Row 1: facing the viewer (walking toward us). Row 2: back view (walking away). Row 3: facing LEFT (profile). Row 4: facing RIGHT (profile).
Columns in every row: 1 = standing still; 2 = LEFT foot stepping forward; 3 = RIGHT foot stepping forward.
The camera looks slightly down on the figure (top-down RPG field view), the same angle in every cell.
STAFF SIDE (always in the character's own RIGHT hand, upright, the same in all three frames of a row):
- Row 1 (front view): the staff stands on the VIEWER'S LEFT side of the body, held by the hand at the viewer's left.
- Row 2 (back view): the staff stands on the VIEWER'S RIGHT side of the body.
- Row 3 (facing left): she holds the staff upright a little in FRONT of her body (toward the viewer's left), the forearm slightly raised; the staff shaft is not hidden behind the head.
- Row 4 (facing right): she holds the staff upright a little in FRONT of her body (toward the viewer's right), the near hand gripping it; the whole staff is visible.
BACK VIEW: the long flaxen hair hangs straight down to the middle of the back over the cream back panel of the tabard; no face, no eyes.

All figures are the same person at the same size: identical head, hair, costume, staff and colours in every cell; within a row only the hem, the shoe tips, the free arm and the hair ends move. One figure centred in each cell, never crossing into a neighbour cell or the image edge.
NO shadow on the ground, no floor, no text, no labels, no numbers, no frames, no grid lines.
'''
out = sys.argv[1]
quality = sys.argv[2] if len(sys.argv) > 2 else 'high'
extra = sys.argv[3] if len(sys.argv) > 3 else ''
W, H = Image.open(GUIDE).size
pr = PROMPT % (C.STYLE, C.CHAR, W, H) + (('\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra) if extra else '')
C.gen(pr, out, [GUIDE, C.HERO_RAW], '%dx%d' % (W, H), quality)
