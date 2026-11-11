"""Run cycle of the priestess, main 4 directions x 4 frames, over the run guide.
usage: python3 gen_run.py <chosen_walk_raw.png> <out_raw.png> [quality] [extra notes]"""
import sys
from PIL import Image
import common as C
GUIDE = '/home/user/tw/party/priest/guide_run.png'
PROMPT = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the RUN cycle of a party member, the young priestess, for the four main directions.

Image 1 is her approved WALK sheet (row 1 facing the viewer, row 2 back view, row 3 facing left, row 4 facing right). The run sheet shows the SAME person in exactly the same art style: the same art-pixel size (the same chunky pixels), the same head size, the same body size, palette, soft shading and soft selective outline. Nothing added, nothing left out.

Image 2 is a SIZE AND PLACEMENT GUIDE for the new sheet: grey mannequins on magenta, one per cell of a 4 x 4 grid. Each marks where one figure goes, how big the head is, how far the body leans, and (the thin pale line) on which side the staff is carried. The mannequins are crude: replace them completely with the properly drawn character and a natural running pose; no grey may remain.

Image 3 is the walk sheet of the game's protagonist: the style reference for the whole game (pixel size, level of detail, muted dusk palette). He is a different person; copy nothing of his costume.

THE CHARACTER, exactly as in image 1: long straight pale flaxen-gold hair to the middle of the back with a straight fringe and a thin white ribbon circlet; a plain small face with two tiny dark eye dots (no nose, no mouth); a long dark plum robe with wide sleeves; a cream tabard panel in front and in back edged with dull gold, tied with a thin gold cord; soft dark shoes; a slender pale wooden staff topped with a small brass crescent, as long as in image 1, in her own RIGHT hand. Her left hand is empty. Exactly ONE staff per figure.

THE RUN: a light, quick, girlish run with a SHORT stride (not a warrior's sprint), clearly faster than her walk at a glance.
- FORWARD LEAN: the whole upper body leans forward into the run by about 12-15 degrees: the head and shoulders are clearly ahead of the hips, the chin a little down.
- The long hair streams out BEHIND her, lifted almost horizontal at the ends. The robe hem and the tabard panels fly back behind her legs; the front of the robe lifts to the shins so that both shoes and ankles (dark stockings) show while she runs.
- The free LEFT arm is bent at the elbow and pumps. The RIGHT hand grips the staff at mid-shaft and holds it close against the body, the shaft tilted FORWARD about 20 degrees in the running direction (crescent end leading, ahead of and above her head; the butt trailing low behind her hip). The staff is complete in every frame, never cut off.
- Columns (the same in every row): column 1 = the LEFT foot lands in front, the right leg trails behind; column 2 = BOTH feet off the ground, knees tucked, the whole figure about 3 art px higher than in column 1; column 3 = the RIGHT foot lands in front, the left leg trails behind; column 4 = both feet off the ground again (higher), legs tucked the other way.

ROWS:
- Row 1: running TOWARD the viewer (front view). The lean shows as a lowered head (we see more of the top of the hair, the face sits lower and is a little shorter), shoulders hunched forward, the bent left arm raised, the knees lifting the front of the robe one after the other, hair and hem flying out behind to both sides. Staff on the VIEWER'S LEFT side of the body, held close.
- Row 2: running AWAY from the viewer (back view, no face, no eyes). The lean shows as the head drawn lower between the shoulders, the hair and back panel lifted and swinging, the soles of the shoes kicking up behind alternately. Staff on the VIEWER'S RIGHT side of the body, held close.
- Row 3: running to the LEFT (profile, facing left). Body leaning to the left, hair and hem streaming to the right. The staff tilts forward to the left, its crescent ahead of her head.
- Row 4: running to the RIGHT (profile, facing right). Body leaning to the right, hair and hem streaming to the left. The staff tilts forward to the right, its crescent ahead of her head, the near hand gripping it.

Within a row the four frames are the same person from the same angle at the same size; only the legs, the arms, the hem, the hair and the height above the ground change. The head is exactly as large as in image 1.

PIXEL RULES: real pixel art with the same art-pixel size as image 1, crisp squares on a regular grid. No blur, no motion lines, no speed streaks, no dust, no gradients, no noise, no dithering, no glow, no black outline (edges are a darker shade of the shape's own colour), hard edges against the background. Muted dusty colours exactly as in image 1; light from the upper left.

CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 4 columns, each cell 644x700 px, one figure per cell where the mannequin of image 2 is, never crossing into a neighbour cell or the image edge. NO shadow on the ground, no floor, no text, no labels, no numbers, no frames, no grid lines.
'''
src, out = sys.argv[1], sys.argv[2]
quality = sys.argv[3] if len(sys.argv) > 3 else 'high'
extra = sys.argv[4] if len(sys.argv) > 4 else ''
W, H = Image.open(GUIDE).size
pr = PROMPT % (W, H) + (('\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra) if extra else '')
C.gen(pr, out, [src, GUIDE, C.HERO_RAW], '%dx%d' % (W, H), quality)
