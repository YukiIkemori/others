"""RUN cycle raw sheets of the hero: 4 rows x 5 cols (col 1 = the approved standing figure, cols 2-5 = the four run frames)
over the guide of make_run_guide.py, with the hero's chosen raw sheets as character references.
usage: python3 gen_run.py <main|diag> <guide.png> <out_raw.png> [quality] [extra notes]
Image API helper: build/img.py of the demo repo (gpt-image-2). Usage log: /home/user/tw/log/usage_party.jsonl"""
import sys
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build')
import img
img.LOG = '/home/user/tw/log/usage_party.jsonl'
P7B, Q7A = '/home/user/tw/hero/raw/p7b.png', '/home/user/tw/hero/raw/q7a.png'

STYLE = '''STYLE (identical to images 2 and 3): the restrained, grown-up pixel art of modern "HD-2D" console RPG field sprites. NOT a 16-bit chibi.
- The same person at the same size as the standing figure in column 1: about 3.3 heads tall, the same SMALL head drawn with the same fine pixels, the same shoulders, the same slim limbs, the same boots. Do not enlarge the head, do not thicken the limbs, do not shrink the figure.
- FACE: a small plain skin plane; the eyes are two tiny dark dots; NO nose, NO mouth, NO eyebrows, NO blush.
- NO BLACK OUTLINE: the edge of every shape is a darker shade of that shape's own colour, exactly as in images 2 and 3.
- COLOURS: exactly the muted dusty colours of images 2 and 3, nothing new: silver-white hair shaded warm grey, pale skin, dusty-ivory cape, thin wine-red edge, charcoal-indigo tunic, dark-teal sash, dark trousers, brown boots, brass and amber for the lantern. No new hues, no saturated highlights, no pure white.
- SHADING: soft, in big calm planes, light from the upper left, 3-4 shades per material. No dithering, no noise, no motion lines, no speed streaks, no dust puffs, no glow.
- PIXELS: real pixel art with the same art-pixel size as images 2 and 3, crisp squares on a regular grid, hard edges against the flat background, no blur, no anti-aliasing, no gradients.'''

CHAR = '''THE CHARACTER is exactly the person of images 2 and 3, nothing added and nothing left out: short silver-white windswept hair; the plain small face; the dusty-ivory hooded cape that ends at the hips, hood down on the shoulders, with its thin wine-red edge and the small brass dot at the throat; the charcoal-indigo tunic; the dark-teal sash; dark trousers; brown boots; bare empty hands; and ONE prop: the small brass lantern with amber glass that hangs on a short chain at the character's own LEFT hip. No sword, no staff, no bag, no scarf.'''

RUN = '''THE RUN (the same motion in every row, seen from that row's angle): a light, fast, athletic run, clearly faster than the walk of images 2 and 3.
- LEAN: the whole body leans forward into the run by about 12-15 degrees: the head and chest are ahead of the hips, the chin is down a little, the eyes look where he runs.
- ARMS: bent at the elbow at about 90 degrees and pumping, fists closed; the arm opposite to the forward leg swings forward. The arms come out from under the cape.
- LEGS: a long stride, knees lifted. The four frames of the cycle, in this order:
  column 2 = CONTACT, LEFT: the character's own LEFT foot has just landed on the ground ahead of the body, knee slightly bent; the right leg is folded up behind, its foot off the ground.
  column 3 = FLIGHT: BOTH feet are off the ground, the body at its highest point (drawn about 3 art pixels higher than in column 2); the left leg has pushed off and stretches out behind, the right knee drives forward and up.
  column 4 = CONTACT, RIGHT: the mirror of column 2: the RIGHT foot has just landed ahead, the left leg is folded up behind.
  column 5 = FLIGHT: the mirror of column 3: both feet off the ground, the right leg stretched behind, the left knee driving forward.
- CAPE: it streams out BEHIND him, lifted by the wind of the run, almost horizontal at the hem, flapping a little differently in each frame (hem a little higher in the flight frames, a little lower in the contact frames); the wine-red edge stays a thin line. The hood bounces on the shoulders.
- HAIR: the short locks are blown back a little. The hair keeps its shape and size.
- LANTERN: it swings BACK on its chain, trailing behind the left hip at an angle (not hanging straight down), a little higher in the flight frames. An object only: no glow, no rays, no halo.'''

ROWS = {
'main': '''THE FOUR ROWS (the same angles as the standing figure in column 1 of each row):
- Row 1: running TOWARD the viewer (front view). The lean is shown by a lowered head (chin tucked, a little more of the top of the hair visible, the face a little lower in the head), shoulders hunched forward, bent arms raised with the fists at chest height, and a long stride: the landing foot is drawn low and large, toward the viewer; the other leg is folded behind with only the knee and a bit of the boot visible. The cape flares out wide behind both shoulders. Column 2: the landing foot is on the VIEWER'S RIGHT (it is his own left). Column 4: on the viewer's left. The lantern at his own left hip = the VIEWER'S RIGHT hip, swung outward and back.
- Row 2: running AWAY from the viewer (back view, no face). The head is lowered and leans away, the cape billows up and toward the viewer so that the sash and the seat of the trousers show under its lifted hem; the boot soles kick up toward the viewer. Column 2: the landing foot is on the VIEWER'S LEFT (his own left). Column 4: on the viewer's right. The lantern at the VIEWER'S LEFT hip, swung back toward the viewer.
- Row 3: running to the LEFT (pure profile, facing left). The forward lean is clearly visible: head and chest to the left of the hips. The cape streams out to the right. The lantern hangs on the near hip, fully visible, trailing back to the right.
- Row 4: running to the RIGHT (pure profile, facing right): the forward lean clearly visible, head and chest to the right of the hips, the cape streaming out to the left. The left hip is the far side: NO lantern drawn in row 4.''',
'diag': '''THE FOUR ROWS (the same angles as the standing figure in column 1 of each row; these are three-quarter views, clearly different from pure front, back and side views):
- Row 1: running DOWN-LEFT: a three-quarter FRONT view, the body turned about 45 degrees toward the viewer's left; face and chest visible, both eye dots visible. The lean goes down-left: head and chest are lower and further left than the hips. The cape streams out up-right behind him. The left hip is the near side: the lantern is clearly visible on the viewer's right half of the body, trailing back.
- Row 2: running DOWN-RIGHT: a three-quarter FRONT view turned about 45 degrees toward the viewer's right (the mirror situation of row 1, drawn on its own). The lean goes down-right; the cape streams out up-left. The left hip is the far side: NO lantern drawn in row 2.
- Row 3: running UP-LEFT: a three-quarter BACK view turned about 45 degrees toward the viewer's left; back of the head, hood and cape, only a sliver of cheek and ear, NO eyes. The lean goes up-left, away from the viewer; the cape streams back toward the lower right and lifts so that the sash and trousers show under the hem; a boot sole kicks up behind. The lantern is visible at the near hip, on the viewer's left edge of the body below the cape, trailing back.
- Row 4: running UP-RIGHT: a three-quarter BACK view turned about 45 degrees toward the viewer's right; NO eyes. The lean goes up-right; the cape streams back toward the lower left. NO lantern drawn in row 4 (hidden behind the body).
In the front rows (1, 2) the character's own left foot is on the viewer's right; in the back rows (3, 4) it is on the viewer's left.'''}

PROMPT = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the RUN cycle of the protagonist, for %s.

IMAGE 1 is the LAYOUT of the sheet you draw: a %dx%d canvas of flat magenta with 4 rows x 5 columns. Column 1 already holds the approved STANDING figure of each row's direction: keep these four figures exactly as they are (same place, same size, same pixels). Columns 2-5 hold crude grey mannequins: each one marks where one run frame goes, how tall the runner is next to the standing figure, how far the body leans and roughly what the legs do. Replace every mannequin completely with the properly drawn character in that run pose; no grey may remain. The mannequins are only rough: draw correct, natural anatomy and a well-observed run, not their stick shapes.
IMAGE 2 is the approved WALK sheet of this protagonist (front, back, left, right). IMAGE 3 is his approved walk sheet for the diagonal directions. They show exactly who he is and how he is drawn: same pixel size, same proportions, same palette, same soft shading, same level of detail. The new sheet must look like more frames from the same sheets.

%s

%s

%s

%s

SIZE: every runner is the same person as the standing figure of his row: the same head size, the same body size. Because he leans and bends his knees, the top of his hair is 2-4 art pixels lower than the standing figure's in the contact frames; never smaller than that, never bigger. Within a row the four run frames are the same person from the same angle: identical head, hair, face, costume and colours; only the pose, the cape, the hair tips and the lantern change.

CANVAS: %dx%d px, flat #FF00FF everywhere. 4 rows x 5 columns as in image 1, every figure standing where image 1 has it, one figure per cell, well separated, never touching a neighbour or the image edge (the streaming cape included). NO shadow on the ground, no floor, no text, no labels, no numbers, no frames, no grid lines.
'''


def main():
    kind, guide, out = sys.argv[1:4]
    quality = sys.argv[4] if len(sys.argv) > 4 else 'high'
    extra = sys.argv[5] if len(sys.argv) > 5 else ''
    W, H = 2880, 2800
    what = 'the four main directions' if kind == 'main' else 'the four diagonal directions'
    pr = PROMPT % (what, W, H, CHAR, RUN, ROWS[kind], STYLE, W, H)
    if extra:
        pr += '\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + extra + '\n'
    img.gen(pr, out, size='%dx%d' % (W, H), quality=quality, images=[guide, P7B, Q7A], tag='party_hero_run_' + kind)


if __name__ == '__main__':
    main()
