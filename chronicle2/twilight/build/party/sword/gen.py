"""Generations for the party character `sword` (walk main, walk diagonals, run main, run diagonals).
usage: python3 gen.py <walk_main|walk_diag|run_main|run_diag> <out_raw.png> [--ref chosen_walk_raw.png] [--ref2 other.png]
                      [--quality high] [--extra "notes"]
Images sent: walk_main: guide + hero raw (style).  Others: the chosen raw of this character + guide (+ hero raw)."""
import os, sys, argparse
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build')
import img
img.LOG = '/home/user/tw/log/usage_party.jsonl'
HERE = os.path.dirname(os.path.abspath(__file__))
HERO_RAW = '/home/user/tw/hero/raw/p7b.png'

CHAR = '''a young swordswoman of about 16-17, slim and athletic, straight-backed, steady and warm. She is 2 art px shorter than the boy of the style sheet.
- Hair: AUBURN / dark copper (a muted reddish brown, not orange, not red), tied in a HIGH PONYTAIL at the back of the crown that falls to the shoulder blades; a short plain fringe. 3-4 shades, from dusty copper down to a dark red-brown. A tiny dark tie where the tail starts.
- Jacket: a SLATE-BLUE quilted jacket (gambeson) with long sleeves and a short skirt that ends at the top of the thighs; only 2-3 quiet vertical quilting lines, 1 px, one shade darker. Over it a plain BROWN LEATHER chest piece (a simple cuirass covering chest and upper belly) and a brown leather BELT. Plain leather BRACERS on the forearms. Bare hands, EMPTY.
- Legs: dark charcoal leggings, plain brown leather boots to below the knee.
- NO cape, NO cloak, NO hood, NO scarf, NO helmet, NO pauldrons, NO ornaments.
- SWORD: one plain one-handed sword in a plain dark-brown leather SCABBARD hanging from the belt at HER OWN LEFT HIP, pointing down and a little backwards; small dull-steel crossguard and pommel, the grip wrapped in dark leather. True to scale: the scabbard is about 24 art px long and 3 wide. It stays sheathed in every frame.
- SHIELD: a small ROUND WOODEN shield (about 17 art px across) with a DULL STEEL RIM and a small steel boss, strapped flat on the middle of HER BACK. Plain brown planks, no emblem, no paint.'''

STYLE = '''STYLE: the restrained, grown-up pixel art of modern "HD-2D" console RPG field sprites: small figures that sit quietly inside a richly lit pixel diorama. NOT a 16-bit / SNES-style chibi sprite. It must look drawn by the same hand as the boy of the STYLE SHEET: the same dot size, the same head size, the same level of detail, the same soft selective outline, the same dusty dusk palette.
- PROPORTIONS AND PIXEL DENSITY: about 3.3 heads tall. The whole figure is 78 art pixels tall from the top of the hair to the boot soles. The head with hair is about 24 art px high and 21 wide (a SMALL head, drawn with FINE pixels: one eye is only 1/21 of the head width), exactly the head size of the boy; natural shoulders about as wide as the head; a real torso; legs about 30 art px long. Not chibi, not super-deformed, no oversized hands or boots.
- FACE: a small plain skin plane. Eyes are tiny dots: 1 px wide, 2 px high, dark brown, about 5 px apart. NO eyelashes, NO iris, NO eye highlight, NO eyebrows, NO nose, NO mouth, NO blush. A soft shadow under the fringe is the only modelling.
- NO BLACK OUTLINE. There is no dark or blackish line around the figure, around the arms, the legs, the shield or the scabbard. The edge of every shape is simply a darker, slightly cooler shade of that shape's own colour (selective outline), 1 px, so the figure sits softly in a dusk scene. No near-black pixels anywhere except the two eye dots.
- COLOURS: muted, dusty, slightly desaturated, like cloth and leather seen at dusk. About 18-28 colours in the whole sheet, 3-4 shades per material (auburn hair, skin, slate-blue jacket, brown leather, charcoal leggings, wood, dull steel 2). No saturated highlights, no pure white, no shiny specular dots on the steel, no gloss bands on the hair.
- SHADING: soft and simple, in big calm planes: light from the upper left, a broad shadow side on the right, shadows drifting toward blue-violet. Low contrast inside each material. No dithering, no texture noise.
- PIXELS: real pixel art, the same chunky art pixels as the style sheet, on a regular grid over the whole image. Crisp squares: no blur, no anti-aliasing against the background, no gradients, no glow.'''

SIDES = '''WHICH SIDE THINGS ARE ON (never mirror them; the sword is always at HER OWN LEFT hip, the shield always on her BACK):
- FRONT view (she faces us): the scabbard hangs at the VIEWER'S RIGHT hip, slanting down and outward. The shield is on her back and is NOT visible (at most a 1 px sliver of rim beside the waist). The ponytail is behind the head: we see the gathered hair as a small bump on top of the back of the crown and the end of the tail beside the neck.
- BACK view (she walks away): the round shield sits in the middle of her back, fully visible, rim and boss; the ponytail hangs from the crown down over the top of the shield. The scabbard shows at the VIEWER'S LEFT hip, its tip pointing down and outward. No eyes.
- Facing LEFT (profile, her left side is toward us): the scabbard is fully visible on the near hip, hilt in front, tip pointing down and back (toward the viewer's right). The shield is seen edge-on as a thin slab on her back (the viewer's right side of the torso). The ponytail hangs behind the head on the viewer's right. ONE eye dot.
- Facing RIGHT (profile, her right side is toward us): the scabbard is on the FAR hip, hidden by the body: only its tip shows behind the legs on the viewer's left. The shield is seen edge-on on her back (the viewer's left side of the torso). The ponytail hangs behind the head on the viewer's left. ONE eye dot.'''

SIDES_DIAG = '''WHICH SIDE THINGS ARE ON (never mirror them; the sword is always at HER OWN LEFT hip, the shield always on her BACK):
- Row 1 (DOWN-LEFT, three-quarter front): her left hip is the near side: the scabbard hangs clearly visible on the viewer's right half of the body, tip pointing down and to the viewer's right. Of the shield only a narrow crescent of rim shows behind her on the viewer's right. The ponytail shows behind the head on the viewer's right. Both eye dots.
- Row 2 (DOWN-RIGHT, three-quarter front): her left hip is the far side: only the sword hilt peeks out at the viewer's right of the waist, the scabbard is hidden behind the body. A narrow crescent of the shield rim shows behind her on the viewer's left. The ponytail shows behind the head on the viewer's left. Both eye dots.
- Row 3 (UP-LEFT, three-quarter back): the shield on her back is seen as a foreshortened oval on the viewer's right part of the back; the ponytail hangs over it. The scabbard hangs visible at the near hip on the viewer's left edge of the body, tip pointing down and to the viewer's right. Only a sliver of cheek, NO eyes.
- Row 4 (UP-RIGHT, three-quarter back): the shield is a foreshortened oval on the viewer's left part of the back; the ponytail hangs over it. The scabbard is on the far hip: only its tip shows below the jacket on the viewer's left. Only a sliver of cheek, NO eyes.'''

TAIL = '''All figures are the same person at the same size: identical head, hair, costume and colours in every cell. One figure centred in each cell, never crossing into a neighbour cell or the image edge.
NO shadow on the ground, no floor, no dust, no speed lines, no text, no labels, no numbers, no frames, no grid lines.
'''

WALK_MAIN = '''You are the lead pixel artist of a 2D RPG. ONE sprite sheet: the field walk cycle of a party member, drawn fresh.

IMAGE 1 is a SIZE AND PLACEMENT GUIDE: grey mannequins on magenta, one per cell. Each mannequin marks exactly where one figure stands, how tall it is, how small the head is, and where the feet line is. Draw every figure over its mannequin with the same height, the same head size, the same centre and the same feet line. The mannequins themselves are crude: replace them completely with a properly drawn character; no grey mannequin may remain.

IMAGE 2 is the STYLE SHEET: the approved walk sheet of the game's protagonist (a silver-haired boy in an ivory cape), in the same grid. It is given ONLY for the art style, the pixel size, the proportions, the head size, the palette mood and the walk motion. The new character is a DIFFERENT PERSON: do not copy his hair, his cape, his hood or his lantern.

%(style)s
- MOTION: a modest, natural walk exactly like the boy's: small steps, the body bobs 1 px, arms swing a little, the ponytail sways a little, the scabbard swings 1 px. No dramatic strides.

THE CHARACTER: %(char)s

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 644x700 px, exactly where the mannequins of image 1 stand.
Row 1: facing the viewer (walking toward us). Row 2: back view (walking away). Row 3: facing LEFT (profile). Row 4: facing RIGHT (profile).
Columns in every row: 1 = standing still; 2 = LEFT foot stepping forward; 3 = RIGHT foot stepping forward.
The camera looks slightly down on the figure (top-down RPG field view), the same angle in every cell.

%(sides)s

Within a row only the legs, arms, ponytail and scabbard move.
%(tail)s'''

WALK_DIAG = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the DIAGONAL walk directions of a party member.

IMAGE 1 is the approved walk sheet of this character for the four main directions (row 1 facing the viewer, row 2 back view, row 3 facing left, row 4 facing right; three frames each: standing, one step, the other step). Draw a NEW sheet of the SAME character on the same canvas and the same 4x3 grid, in exactly the same art style, the same pixel size (the same chunky art pixels as image 1), the same figure height, feet lines, proportions (about 3.3 heads tall, small head), palette, soft shading and soft selective outline as image 1, but with these four rows:

- Row 1: walking DOWN-LEFT. A three-quarter FRONT view: we see the face and chest, the whole body turned about 45 degrees toward the viewer's left. Both eye dots visible, the far one (viewer's left) closer to the edge of the face.
- Row 2: walking DOWN-RIGHT. A three-quarter FRONT view turned about 45 degrees toward the viewer's right (the mirror situation of row 1, drawn on its own).
- Row 3: walking UP-LEFT. A three-quarter BACK view: we see the back of the head, the ponytail and the shield on the back, the body turned about 45 degrees toward the viewer's left; only a sliver of cheek and ear, NO eyes.
- Row 4: walking UP-RIGHT. A three-quarter BACK view turned about 45 degrees toward the viewer's right; only a sliver of cheek and ear, NO eyes.

Columns in every row: column 1 = standing still in that direction (feet together); column 2 = LEFT foot stepping forward; column 3 = RIGHT foot stepping forward. The walk is as modest and natural as in image 1: small steps, arms swinging a little, the ponytail swaying a little.

THE CHARACTER is exactly the person of image 1, nothing added and nothing left out: %(char)s

%(sides)s

Within a row the three frames are the same person from the same angle: identical head, hair, face, costume and colours; only the legs, arms, ponytail and scabbard move. The head turn and body angle of each row must be clearly different from the pure front, back and side views of image 1 (a true three-quarter view: the shoulders are foreshortened).

PIXEL RULES: real pixel art with the same art-pixel size as image 1, crisp squares on a regular grid. No blur, no gradients, no noise, no dithering, no glow, no black outline, hard edges against the background. Muted dusty colours exactly as in image 1; light from the upper left. Eyes are tiny dark dots (1 px wide, 2 px high); no nose, no mouth.

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 644x700 px, the figures standing exactly where the figures of image 1 stand, the same figure height as image 1.
%(tail)s'''

RUN_COMMON = '''THE RUN (the director's note: "a running motion, leaning a little forward"):
- She RUNS, clearly faster than the walk of image 1: the whole body LEANS FORWARD into the run by about 12-15 degrees (head ahead of the hips), knees lift high, the stride is long, the arms are bent at the elbows about 90 degrees and pump hard (fists near the chest in front, elbows behind), hands empty.
- The PONYTAIL STREAMS out behind her, nearly horizontal, and whips up and down a little from frame to frame. The scabbard swings back, the jacket skirt flaps back.
- Four frames per row, a full cycle:
  Column 1 = CONTACT: her LEFT foot has just landed in front (left leg forward and bearing weight, right leg kicked up behind with the heel high); right arm forward, left arm back.
  Column 2 = FLIGHT: both feet OFF the ground, legs passing and spread in the air, body at its highest (about 3 art px higher than in column 1).
  Column 3 = CONTACT: her RIGHT foot has just landed in front (right leg forward, left leg kicked up behind); left arm forward, right arm back.
  Column 4 = FLIGHT: both feet OFF the ground again, the mirror phase of column 2, body at its highest.
  Columns 1 and 3 must differ from each other (other leg and other arm in front), and so must columns 2 and 4.
- Because she leans and crouches into the run, the figure is 2-4 art px lower than her standing height; the head stays the same size as in image 1.'''

RUN_MAIN = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the field RUN cycle of a party member.

IMAGE 1 is the approved WALK sheet of this character (row 1 facing the viewer, row 2 back view, row 3 facing left, row 4 facing right). Draw the SAME character, in exactly the same art style, the same pixel size (the same chunky art pixels as image 1), the same head size, proportions (about 3.3 heads tall, small head), palette, soft shading and soft selective outline as image 1.
IMAGE 2 is a SIZE AND PLACEMENT GUIDE for the new sheet: grey mannequins on magenta, 4 rows x 4 columns. Each mannequin marks where one figure goes, its size, its ground line, and (rows 3 and 4) the forward lean. Replace the mannequins completely; no grey may remain.

%(run)s

ROWS:
- Row 1: running TOWARD the viewer (front view). The lean shows as a lowered head (chin tucked, we see more of the top of the hair), shoulders hunched forward, bent arms pumping in front of the chest, and in the contact frames one knee and boot coming big toward us while the other leg is hidden behind. The ponytail flies up and back behind the head, its end visible above one shoulder.
- Row 2: running AWAY from the viewer (back view). Head lowered and forward, elbows pumping out at the sides, in the contact frames the trailing boot sole kicks up toward us. The ponytail flies and bounces over the round shield on her back. No eyes.
- Row 3: running LEFT (profile). The body leans 12-15 degrees to the LEFT (forward), long stride, ponytail streaming to the RIGHT.
- Row 4: running RIGHT (profile). The body leans 12-15 degrees to the RIGHT, long stride, ponytail streaming to the LEFT.

THE CHARACTER is exactly the person of image 1, nothing added and nothing left out: %(char)s

%(sides)s

PIXEL RULES: real pixel art with the same art-pixel size as image 1, crisp squares on a regular grid. No blur, no gradients, no noise, no dithering, no glow, no black outline, hard edges against the background. Muted dusty colours exactly as in image 1; light from the upper left. Eyes are tiny dark dots (1 px wide, 2 px high); no nose, no mouth.

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 4 columns, each cell 644x700 px, exactly where the mannequins of image 2 stand; the ground line of each row is the mannequins' ground line (in the flight frames the feet are above it).
%(tail)s'''

RUN_DIAG = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the DIAGONAL directions of the field RUN cycle of a party member.

IMAGE 1 is the approved RUN sheet of this character for the four main directions (row 1 toward the viewer, row 2 away, row 3 running left, row 4 running right; four frames each: left foot lands, flight, right foot lands, flight). IMAGE 2 is her approved diagonal WALK sheet (rows: down-left, down-right, up-left, up-right), showing how she looks in the three-quarter views. Draw a NEW sheet of the SAME character on the same canvas and the same 4x4 grid as image 1, in exactly the same art style, the same pixel size (the same chunky art pixels), the same head size, proportions, palette, soft shading and soft selective outline.

%(run)s

ROWS (each a true three-quarter view, the same angles as image 2):
- Row 1: running DOWN-LEFT. Three-quarter FRONT view, body turned 45 degrees toward the viewer's left and leaning forward in that direction (the head is ahead of the hips: lower and further to the viewer's left). Both eye dots. Ponytail streaming up and to the viewer's right.
- Row 2: running DOWN-RIGHT. Three-quarter FRONT view turned 45 degrees toward the viewer's right, leaning that way. Both eye dots. Ponytail streaming up and to the viewer's left.
- Row 3: running UP-LEFT. Three-quarter BACK view, turned 45 degrees toward the viewer's left, leaning away and to the left. Ponytail streaming toward the viewer's right over the shield. NO eyes.
- Row 4: running UP-RIGHT. Three-quarter BACK view turned 45 degrees toward the viewer's right, leaning away and to the right. Ponytail streaming toward the viewer's left over the shield. NO eyes.

THE CHARACTER is exactly the person of images 1 and 2, nothing added and nothing left out: %(char)s

%(sides)s

PIXEL RULES: real pixel art with the same art-pixel size as image 1, crisp squares on a regular grid. No blur, no gradients, no noise, no dithering, no glow, no black outline, hard edges against the background. Muted dusty colours exactly as in image 1; light from the upper left. Eyes are tiny dark dots (1 px wide, 2 px high); no nose, no mouth.

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 4 columns, each cell 644x700 px, the figures placed exactly where the figures of image 1 are, at the same size and on the same ground lines.
%(tail)s'''


def main():
    a = argparse.ArgumentParser()
    a.add_argument('kind'); a.add_argument('out')
    a.add_argument('--ref'); a.add_argument('--ref2'); a.add_argument('--quality', default='high'); a.add_argument('--extra', default='')
    a.add_argument('--dry', action='store_true')
    x = a.parse_args()
    v = dict(style=STYLE, char=CHAR, tail=TAIL, run=RUN_COMMON, H=2800)
    if x.kind == 'walk_main':
        v.update(W=1936, sides=SIDES); pr = WALK_MAIN % v
        images = [os.path.join(HERE, 'guide_walk.png'), HERO_RAW]
    elif x.kind == 'walk_diag':
        v.update(W=1936, sides=SIDES_DIAG); pr = WALK_DIAG % v
        images = [x.ref]
    elif x.kind == 'run_main':
        v.update(W=2576, sides=SIDES); pr = RUN_MAIN % v
        images = [x.ref, os.path.join(HERE, 'guide_run_main.png')]
    elif x.kind == 'run_diag':
        v.update(W=2576, sides=SIDES_DIAG); pr = RUN_DIAG % v
        images = [x.ref, x.ref2]
    else:
        raise SystemExit('unknown kind')
    if x.extra:
        pr += '\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + x.extra
    if x.dry:
        print(pr); print(images); return
    img.gen(pr, x.out, size='%dx%d' % (v['W'], v['H']), quality=x.quality, images=images, background='opaque', tag='party_sword_' + x.kind)


if __name__ == '__main__':
    main()
