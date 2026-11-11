"""Generate the rogue's raw sheets (OpenAI Images API, gpt-image-2, magenta background).
  walk    : 4 main directions x (stand, L step, R step) over guide_walk.png; refs: hero raw p7b.png, mapref_4x.png
  diag    : 4 diagonal directions, same grid, from the chosen walk raw; refs: chosen walk raw, hero diagonal raw q7a.png
  run     : 4 main directions x (stand + 4 run frames) over guide_run.png; refs: chosen walk raw, hero raw p7b.png
  rundiag : 4 diagonal directions x (stand + 4 run frames) over guide_rundiag.png; refs: chosen diag raw, chosen run raw
usage: python3 gen.py <kind> <out_raw.png> [--src a.png] [--src2 b.png] [--extra "notes"] [--quality high]"""
import argparse, os, sys
from PIL import Image
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build')
import img                                                   # noqa: E402
img.LOG = '/home/user/tw/log/usage_party.jsonl'
HERE = os.path.dirname(os.path.abspath(__file__))
HERO = '/home/user/tw/hero/raw/p7b.png'
HERO_D = '/home/user/tw/hero/raw/q7a.png'
MAPREF = '/home/user/tw/hero/mapref_4x.png'

CHAR = '''a young man of about 17, the protagonist's best friend: lean, nimble, quick and clever, light on his feet. He is a touch taller and leaner than the protagonist of the style reference (82 art px against 80) with exactly the same head size.
- Hair: short, tousled, DARK BROWN (warm umber / dark chestnut shades with a slightly lighter brown on the upper left; clearly brown, NOT black), a few simple soft locks. A narrow faded-ochre HEADBAND (1-2 px high) runs across the forehead under the fringe and around the head.
- A SHORT MOSS-GREEN hooded cloak (dusty, greyish moss green) that ends at the WAIST, hood down lying on the shoulders. No trim, no clasp.
- A faded RUST-RED scarf wound once around the neck; its one short end (about 6 px) hangs behind the shoulder over the back of the cloak.
- Under the cloak a dark olive-brown sleeveless jerkin over a grey-beige long-sleeved shirt (the grey-beige sleeves show on the arms), a plain narrow belt, dark trousers, soft brown ankle boots. Bare hands, EMPTY. No gloves, no piping, no ornaments, no bag.
- GEAR, all carried on his BACK, small and true to scale: a SHORT plain wooden bow (about 34 art px long, 1-2 px thick, a gentle curve, a 1 px pale string) slung DIAGONALLY across the back over the cloak: its UPPER tip rises over the character's own LEFT shoulder, its lower tip ends near his own right hip. Beside it a SMALL brown leather quiver whose 2-3 pale arrow fletchings peek over the character's own RIGHT shoulder. A small dagger in a dark sheath lies horizontally at the BACK of the belt. Nothing in the hands, nothing on the hips.'''

STYLE = '''STYLE: the restrained, grown-up pixel art of modern "HD-2D" console RPG field sprites: small figures that sit quietly inside a richly lit pixel diorama. NOT a 16-bit / SNES-style chibi sprite. It must look drawn by the same hand as the protagonist sheet given as style reference: the same art-pixel size, the same head size, the same level of detail, the same soft shading.
- PROPORTIONS AND PIXEL DENSITY: about 3.4 heads tall. The whole figure is 82 art pixels tall from the top of the hair to the boot soles. The head with hair is about 24 art px high and 21 wide (a SMALL head, drawn with FINE pixels: one eye is only 1/21 of the head width); natural shoulders about as wide as the head or a little wider; a real, lean torso; legs about 31 art px long. Not chibi, not super-deformed, no oversized hands or boots.
- FACE: a small plain skin plane. Eyes are tiny dots: 1 px wide, 2 px high, dark brown, about 5 px apart. NO eyelashes, NO iris, NO eye highlight, NO eyebrows, NO nose, NO mouth, NO blush. A soft shadow under the fringe is the only modelling.
- NO BLACK OUTLINE. There is no dark or blackish line around the figure, around the arms, the legs, the cloak or the bow. The edge of every shape is simply a darker, slightly cooler shade of that shape's own colour (selective outline), 1 px, so the figure sits softly in a dusk scene. No near-black pixels anywhere except the two eye dots; the dark hair and the dark trousers are dark BROWN and dark slate, never black.
- COLOURS: muted, dusty, slightly desaturated, like cloth and leather seen at dusk. About 20-28 colours in the whole sheet, 3-4 shades per material (hair, skin, ochre band 2, moss cloak, rust scarf, olive jerkin, grey-beige shirt, trousers, boots, bow wood 2). No saturated highlights, no pure white, no shiny specular dots, no gloss bands on the hair.
- SHADING: soft and simple, in big calm planes: light from the upper left, a broad shadow side on the right and under the cloak, shadows drifting toward blue-violet. Low contrast inside each material. No dithering, no texture noise, no fold spaghetti: 2-3 quiet folds on the cloak are enough.
- PIXELS: real pixel art. One art pixel = exactly 7x7 image px on a regular grid over the whole image (the same grid the mannequins of the guide are built on). Crisp squares: no blur, no anti-aliasing against the background, no gradients, no glow.'''

GEAR_MAIN = '''GEAR SIDES (the bow's upper tip is ALWAYS at the character's own LEFT shoulder, the quiver's fletchings at his own RIGHT shoulder; the same in all frames of a row):
- Facing the viewer: almost everything is hidden behind the body. Only the upper bow tip peeks up about 6 px above the shoulder on the VIEWER'S RIGHT, the lower bow tip peeks out below the cloak at the VIEWER'S LEFT hip, and the fletchings peek over the shoulder on the VIEWER'S LEFT. No dagger visible.
- Back view: everything is visible on top of the cloak: the bow lies diagonally from the VIEWER'S LEFT shoulder (upper tip, above the shoulder line) down to the VIEWER'S RIGHT hip; the small quiver sits beside it with its fletchings at the VIEWER'S RIGHT shoulder; the dagger lies across the back of the belt just under the cloak hem; the scarf end hangs at the nape.
- Facing LEFT (we see his left side): the bow and quiver are on his back, that is on the VIEWER'S RIGHT side of the body: the bow's upper tip rises behind the near shoulder to about ear height, its limb runs down along the back to the hip; the quiver is a narrow shape behind it. The dagger hilt shows at the back of the belt (viewer's right).
- Facing RIGHT (we see his right side): the gear is on his back, that is on the VIEWER'S LEFT side of the body: the quiver with its fletchings is the near thing, the bow's upper tip rises behind it at the far shoulder. The dagger hilt shows at the back of the belt (viewer's left).'''

GEAR_DIAG = '''GEAR SIDES (the bow's upper tip is ALWAYS at the character's own LEFT shoulder, the quiver's fletchings at his own RIGHT shoulder; the same in all frames of a row). The rows are NOT mirror images of each other: the gear does not change sides when he turns.
- Down-left (three-quarter front, facing the viewer's left): his left shoulder is the near one, on the VIEWER'S RIGHT. ONLY the upper bow tip is visible: it peeks up about 6 px above the shoulder on the VIEWER'S RIGHT, exactly as in the front view. The quiver and its fletchings are hidden behind the head and body: draw NO fletchings in this row.
- Down-right (three-quarter front, facing the viewer's right): his right shoulder is the near one, on the VIEWER'S LEFT. ONLY the 2-3 pale fletchings of the quiver are visible: they peek over the shoulder on the VIEWER'S LEFT, exactly as in the front view. The bow's upper tip is hidden behind the head: draw NO bow tip in this row (at most the lower bow tip peeks out below the cloak behind the hip on the viewer's left).
- Up-left (three-quarter back, facing the viewer's left): we see his back and his left side. The bow lies on the cloak slanted like a BACKSLASH "\\": its UPPER tip at the UPPER LEFT (at his left shoulder, the near one, on the VIEWER'S LEFT, rising above the shoulder line beside the head), its lower tip at the LOWER RIGHT by the right hip: the same slant as in the pure back view. The quiver sits to the right of the bow with its fletchings at the shoulder on the VIEWER'S RIGHT; the dagger across the back of the belt.
- Up-right (three-quarter back, facing the viewer's right): we see his back and his right side. The bow is slanted the SAME way, like a BACKSLASH "\\": UPPER tip at the UPPER LEFT (his left shoulder, now the far one, on the VIEWER'S LEFT), lower tip at the LOWER RIGHT; the quiver with its fletchings at the near shoulder on the VIEWER'S RIGHT; the dagger across the back of the belt.
In BOTH back rows (up-left and up-right) the bow runs from upper LEFT to lower RIGHT on the canvas. A bow running from upper right to lower left is WRONG.'''

P_WALK = '''You are the lead pixel artist of a 2D RPG. ONE sprite sheet: the field walk cycle of a party member, drawn fresh.

IMAGE 1 is a SIZE AND PLACEMENT GUIDE: grey mannequins on magenta, one per cell. Each mannequin marks exactly where one figure stands, how tall it is (82 art px = 574 image px), how small the head is, and where the feet line is. Draw every figure over its mannequin with the same height, the same head size, the same centre and the same feet line. The mannequins themselves are crude: replace them completely with a properly drawn character (natural shoulders and arms, a cloak, real legs and boots); no grey mannequin may remain.

IMAGE 2 is the STYLE REFERENCE: the approved walk sheet of the game's protagonist (silver hair, ivory cape, lantern), in the same grid and at the same scale. The new character must look as if the same artist drew him for the same game: the same art-pixel size, the same small head and dot eyes, the same proportions, the same soft selective outline, the same calm shading, the same modest walk poses frame by frame. He is a DIFFERENT PERSON: do not copy the protagonist's silver hair, ivory cape, lantern or colours.

IMAGE 3 is a crop of the game's field map (there enlarged 4x), given ONLY as a reference for the dusk palette and the level of finish. Draw NO background, no ground, no stones from image 3.

%(style)s
- MOTION: a modest, natural walk: small steps, the body bobs 1 px, arms swing a little, the cloak hem and the scarf end sway a little. No dramatic strides, no flying cloak.

THE CHARACTER: %(char)s

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 644x700 px (92x100 art px), exactly where the mannequins of image 1 stand.
Row 1: facing the viewer (walking toward us). Row 2: back view (walking away, no face, no eyes). Row 3: facing LEFT (profile, one eye). Row 4: facing RIGHT (profile, one eye).
Columns in every row: 1 = standing still; 2 = LEFT foot stepping forward; 3 = RIGHT foot stepping forward.
The camera looks slightly down on the figure (top-down RPG field view), the same angle in every cell.
%(gear)s

All figures are the same person at the same size: identical head, hair, costume and colours in every cell; within a row only the legs, arms, cloak hem and scarf end move. One figure centred in each cell, never crossing into a neighbour cell or the image edge.
NO shadow on the ground, no floor, no text, no labels, no numbers, no frames, no grid lines.
'''

P_DIAG = '''You are the lead pixel artist of a 2D RPG. ONE new sprite sheet: the DIAGONAL walk directions of a party member.

IMAGE 1 is the approved walk sheet of this character for the four main directions (row 1 facing the viewer, row 2 back view, row 3 facing left, row 4 facing right; three frames each: standing, one step, the other step). Draw a NEW sheet of the SAME character on the same canvas and the same 4x3 grid, in exactly the same art style, the same pixel size (the same chunky art pixels as image 1), the same figure height, feet lines, proportions (about 3.4 heads tall, small head), palette, soft shading and soft selective outline as image 1, but with the four diagonal rows described below.

IMAGE 2 is only a POSE REFERENCE: the diagonal walk sheet of ANOTHER character of the same game (the silver-haired protagonist) in the same grid: it shows how far the body is turned in each row and how the three frames differ. Copy the body angles and the step poses, NOT that character's looks.

- Row 1: walking DOWN-LEFT. A three-quarter FRONT view: we see the face and chest, the whole body turned about 45 degrees toward the viewer's left. Both eye dots visible, the far one (viewer's left) closer to the edge of the face.
- Row 2: walking DOWN-RIGHT. A three-quarter FRONT view turned about 45 degrees toward the viewer's right (the mirror situation of row 1, drawn on its own).
- Row 3: walking UP-LEFT. A three-quarter BACK view: we see the back of the head, the hood and the back of the cloak with the bow and quiver on it, the body turned about 45 degrees toward the viewer's left; only a sliver of cheek and ear, NO eyes.
- Row 4: walking UP-RIGHT. A three-quarter BACK view turned about 45 degrees toward the viewer's right; only a sliver of cheek and ear, NO eyes.

Columns in every row: column 1 = standing still in that direction (feet together); column 2 = LEFT foot stepping forward; column 3 = RIGHT foot stepping forward. The walk is as modest and natural as in image 1: small steps, arms swinging a little, the cloak hem and scarf end swaying a little.

THE CHARACTER is exactly the person of image 1, nothing added and nothing left out: %(char)s

%(gear)s

Within a row the three frames are the same person from the same angle: identical head, hair, face, costume and colours; only the legs, arms, cloak hem and scarf end move. The head turn and body angle of each row must be clearly different from the pure front, back and side views of image 1 (a true three-quarter view: the shoulders are foreshortened).

PIXEL RULES: real pixel art with the same art-pixel size as image 1, crisp squares on a regular grid. No blur, no gradients, no noise, no dithering, no glow, no black outline (edges are a darker shade of the shape's own colour), hard edges against the background. Eyes are tiny dark dots 1 px wide and 2 px high; no nose, no mouth. Muted dusty colours exactly as in image 1; light from the upper left.

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 3 columns, each cell 644x700 px, the figures standing exactly where the figures of image 1 stand, the same figure height as image 1. One figure centred in each cell, never crossing into a neighbour cell or the image edge. NO shadow on the ground, no floor, no text, no labels, no frames.
'''

RUN_MOTION = '''THE RUN (the game's director asked for: "a running motion, leaning forward a little"): a light, quick, nimble sprint that reads as clearly FASTER than the walk at a glance.
- The whole upper body LEANS FORWARD into the run, about 12-15 degrees: the head is clearly ahead of the hips. In the side and diagonal views this lean is plainly visible as a tilted torso. In the front and back views it shows as a lowered head (chin tucked, the head a little lower and overlapping the chest in the front view; in the back view we look onto the shoulders and the top of the back), raised bent arms and a long stride.
- Arms bent about 90 degrees at the elbow and pumping, fists loosely closed, opposite to the legs. Hands EMPTY.
- A LONG stride with bent knees: the front knee lifted high, the back leg kicked up behind.
- Things STREAM BEHIND him: the tousled hair is blown back, the short cloak hem lifts and flies back, the rust-red scarf end trails out horizontally behind, the hood flaps. (In the front view they spread out to the sides behind the body; in the back view they lift a little.) The bow and quiver stay strapped tight on the back and do NOT move.
- The 4 run frames of a row, in this order (two LANDING poses and two FLIGHT poses that look clearly different from each other):
  RUN 1 = LANDING on the LEFT foot: the character's own LEFT foot is planted flat on the ground line directly under the body, the left knee a little bent and taking the weight; the body is at its LOWEST; the RIGHT leg is folded up behind him, heel toward the seat. Right arm forward, left arm back. A COMPACT pose: one nearly vertical leg under the body.
  RUN 2 = FLIGHT: BOTH feet clearly OFF the ground (the lower foot at least 4 art px above the ground line), the body at its HIGHEST (about 3 art px higher than in RUN 1); the legs split at their widest: the RIGHT knee drives far forward and up, the LEFT leg is stretched out straight behind. Left arm forward. A WIDE leaping pose.
  RUN 3 = LANDING on the RIGHT foot: as RUN 1 with the legs and arms exchanged: the own RIGHT foot planted flat under the body, the LEFT leg folded up behind. Left arm forward.
  RUN 4 = FLIGHT: as RUN 2 with the legs and arms exchanged: the LEFT knee drives forward and up, the RIGHT leg is stretched out behind. Right arm forward.
  The mannequins of image 1 show these four leg poses. In the profile rows the landing frames (one upright leg under the body, the other folded behind) and the flight frames (a wide split in the air) must have clearly different silhouettes, and the frames must loop smoothly 1-2-3-4-1.
  In the front and back rows: landing = the weight-bearing leg straight down to the ground line and the other leg lifted with its boot seen from behind / foreshortened; flight = both boots off the ground at different heights. RUN 1 and RUN 3 stand on OPPOSITE legs.'''

LIMBS_MAIN = '''LIMB TABLE: which leg and which arm is forward in each frame. The legs and arms ALTERNATE: RUN 3 is RUN 1 with the legs and arms exchanged, RUN 4 is RUN 2 exchanged. A cycle in which the same leg is in front in all four frames is WRONG (it would look like hopping). The mannequins of image 1 show it: their LIGHT grey limbs are the near / forward ones, their DARK grey limbs the far / hidden ones.
 - Row 1, front view (his own left is on the VIEWER'S RIGHT):
   RUN 1: the leg on the VIEWER'S RIGHT is planted on the ground; the leg on the viewer's left is folded up behind it (we see only its thigh and knee: it looks short). The fist on the VIEWER'S LEFT is forward, in front of the chest; the other arm is back, elbow out to the side.
   RUN 2: the knee on the VIEWER'S LEFT is lifted high toward us with its boot hanging under it; the leg on the viewer's right trails behind (short, its boot higher). Both boots off the ground.
   RUN 3: the leg on the VIEWER'S LEFT is planted on the ground; the leg on the viewer's right is folded up behind it. The fist on the VIEWER'S RIGHT is forward, in front of the chest; the other arm is back.
   RUN 4: the knee on the VIEWER'S RIGHT is lifted high toward us; the leg on the viewer's left trails behind. Both boots off the ground.
 - Row 2, back view (his own left is on the VIEWER'S LEFT):
   RUN 1: the leg on the VIEWER'S LEFT is planted on the ground; the leg on the viewer's right is kicked up behind, toward us: we see its boot lifted, sole and heel. The arm on the VIEWER'S LEFT is swung back toward us (its fist beside the hip); the other arm is forward, hidden by the body.
   RUN 2: the leg on the VIEWER'S LEFT is stretched out behind, toward us, its boot lifted; the leg on the viewer's right is short (its knee is forward, hidden). Both boots off the ground.
   RUN 3: the leg on the VIEWER'S RIGHT is planted on the ground; the leg on the viewer's left is kicked up behind, toward us. The arm on the VIEWER'S RIGHT is swung back toward us; the other arm is forward, hidden.
   RUN 4: the leg on the VIEWER'S RIGHT is stretched out behind, toward us, its boot lifted; the leg on the viewer's left is short. Both boots off the ground.
 - Row 3, LEFT profile (we see his LEFT side: his LEFT arm and LEFT leg are the NEAR limbs, drawn in front in the lighter shades; the other arm and leg are the FAR limbs, partly hidden behind the body, in darker shades):
   RUN 1: the NEAR leg is planted under the body; the FAR leg is folded up behind. The FAR arm is forward (its fist ahead of the chest), the NEAR arm is swung back (elbow behind the back).
   RUN 2: the FAR knee drives forward; the NEAR leg is stretched out behind. The NEAR arm is forward: the near fist in front of the chest.
   RUN 3: the FAR leg is planted under the body (partly behind the near thigh); the NEAR leg is folded up behind, its boot kicked up at the back. The NEAR arm is forward across the chest, the FAR arm back.
   RUN 4: the NEAR knee drives forward and up (the near thigh in front); the FAR leg is stretched out behind. The FAR arm is forward, the NEAR arm swung back.
 - Row 4, RIGHT profile (we see his RIGHT side: his RIGHT arm and RIGHT leg are the NEAR limbs, drawn in front in the lighter shades; the other arm and leg are the FAR limbs, partly hidden behind the body, in darker shades):
   RUN 1: the FAR leg is planted under the body; the NEAR leg is folded up behind, its boot kicked up at the back. The NEAR arm is forward (the near fist in front of the chest), the FAR arm back.
   RUN 2: the NEAR knee drives forward and up; the FAR leg is stretched out behind. The FAR arm is forward, the NEAR arm swung back (elbow behind the back).
   RUN 3: the NEAR leg is planted under the body; the FAR leg is folded up behind. The FAR arm is forward (its fist ahead of the chest), the NEAR arm swung back.
   RUN 4: the FAR knee drives forward; the NEAR leg is stretched out behind. The NEAR arm is forward across the chest.'''

LIMBS_DIAG = '''LIMB TABLE: which leg and which arm is forward in each frame. The legs and arms ALTERNATE: RUN 3 is RUN 1 with the legs and arms exchanged, RUN 4 is RUN 2 exchanged. A cycle in which the same leg is in front in all four frames is WRONG (it would look like hopping). The mannequins of image 1 show it: their LIGHT grey limbs are the near / forward ones, their DARK grey limbs the far / hidden ones.
 - Row 1, down-left (we see his LEFT side: his LEFT arm and LEFT leg are the NEAR limbs, drawn in front in the lighter shades; the other arm and leg are the FAR limbs, partly hidden behind the body, in darker shades):
   RUN 1: the NEAR leg is planted under the body; the FAR leg is folded up behind. The FAR arm is forward (its fist ahead of the chest), the NEAR arm is swung back (elbow behind the back).
   RUN 2: the FAR knee drives forward; the NEAR leg is stretched out behind. The NEAR arm is forward: the near fist in front of the chest.
   RUN 3: the FAR leg is planted under the body (partly behind the near thigh); the NEAR leg is folded up behind, its boot kicked up at the back. The NEAR arm is forward across the chest, the FAR arm back.
   RUN 4: the NEAR knee drives forward and up (the near thigh in front); the FAR leg is stretched out behind. The FAR arm is forward, the NEAR arm swung back.
 - Row 2, down-right (we see his RIGHT side: his RIGHT arm and RIGHT leg are the NEAR limbs, drawn in front in the lighter shades; the other arm and leg are the FAR limbs, partly hidden behind the body, in darker shades):
   RUN 1: the FAR leg is planted under the body; the NEAR leg is folded up behind, its boot kicked up at the back. The NEAR arm is forward (the near fist in front of the chest), the FAR arm back.
   RUN 2: the NEAR knee drives forward and up; the FAR leg is stretched out behind. The FAR arm is forward, the NEAR arm swung back (elbow behind the back).
   RUN 3: the NEAR leg is planted under the body; the FAR leg is folded up behind. The FAR arm is forward (its fist ahead of the chest), the NEAR arm swung back.
   RUN 4: the FAR knee drives forward; the NEAR leg is stretched out behind. The NEAR arm is forward across the chest.
 - Row 3, up-left (we see his LEFT side: his LEFT arm and LEFT leg are the NEAR limbs, drawn in front in the lighter shades; the other arm and leg are the FAR limbs, partly hidden behind the body, in darker shades):
   RUN 1: the NEAR leg is planted under the body; the FAR leg is folded up behind. The FAR arm is forward (its fist ahead of the chest), the NEAR arm is swung back (elbow behind the back).
   RUN 2: the FAR knee drives forward; the NEAR leg is stretched out behind. The NEAR arm is forward: the near fist in front of the chest.
   RUN 3: the FAR leg is planted under the body (partly behind the near thigh); the NEAR leg is folded up behind, its boot kicked up at the back. The NEAR arm is forward across the chest, the FAR arm back.
   RUN 4: the NEAR knee drives forward and up (the near thigh in front); the FAR leg is stretched out behind. The FAR arm is forward, the NEAR arm swung back.
 - Row 4, up-right (we see his RIGHT side: his RIGHT arm and RIGHT leg are the NEAR limbs, drawn in front in the lighter shades; the other arm and leg are the FAR limbs, partly hidden behind the body, in darker shades):
   RUN 1: the FAR leg is planted under the body; the NEAR leg is folded up behind, its boot kicked up at the back. The NEAR arm is forward (the near fist in front of the chest), the FAR arm back.
   RUN 2: the NEAR knee drives forward and up; the FAR leg is stretched out behind. The FAR arm is forward, the NEAR arm swung back (elbow behind the back).
   RUN 3: the NEAR leg is planted under the body; the FAR leg is folded up behind. The FAR arm is forward (its fist ahead of the chest), the NEAR arm swung back.
   RUN 4: the FAR knee drives forward; the NEAR leg is stretched out behind. The NEAR arm is forward across the chest.'''

P_RUN = '''You are the lead pixel artist of a 2D RPG. ONE sprite sheet: the field RUN cycle of a party member, for the four main directions.

IMAGE 1 is a SIZE AND PLACEMENT GUIDE: grey mannequins on magenta, one per cell: where each figure is, how tall it is, how small the head is, where the ground line is and how far the body leans. Draw every figure over its mannequin with the same size, the same head size and the same ground line. The mannequins are crude stick shapes: replace them completely with the properly drawn character; no grey may remain.

IMAGE 2 is the approved WALK sheet of this very character (row 1 facing the viewer, row 2 back view, row 3 facing left, row 4 facing right; standing, left step, right step). The run sheet shows the SAME person in exactly the same art style: the same art-pixel size (the same chunky pixels), the same head size, the same face with two tiny dot eyes, the same hair, costume, gear, palette, soft shading and soft selective outline. Column 1 of the new sheet repeats the standing figure of each row of image 2 unchanged.

IMAGE 3 is the walk sheet of the game's protagonist, for the overall style of the game only.

%(run)s

%(limbs)s

THE CHARACTER, exactly as in image 2: %(char)s

%(gear)s

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 5 columns, each cell 574x686 px, exactly where the mannequins of image 1 are.
Row 1: running TOWARD the viewer (front view). Row 2: running AWAY (back view, no face, no eyes). Row 3: running to the LEFT (profile, leaning to the left). Row 4: running to the RIGHT (profile, leaning to the right).
Columns in every row: 1 = STANDING still, upright (the same as in image 2, for scale); 2 = RUN 1; 3 = RUN 2; 4 = RUN 3; 5 = RUN 4.
The camera looks slightly down on the figure (top-down RPG field view), the same angle in every cell.

All figures are the same person at the same size: the head is exactly as big in the run frames as in the standing frame. One figure per cell, never crossing into a neighbour cell or the image edge (keep the flying scarf short enough).
PIXEL RULES: real pixel art, crisp squares on a regular grid, the same art-pixel size as image 2. No blur, no motion blur, no speed lines, no dust puffs, no gradients, no glow, no black outline, hard edges against the background. Muted dusty colours exactly as in image 2; light from the upper left.
NO shadow on the ground, no floor, no text, no labels, no numbers, no frames, no grid lines.
'''

P_RUNDIAG = '''You are the lead pixel artist of a 2D RPG. ONE sprite sheet: the field RUN cycle of a party member, for the four DIAGONAL directions.

IMAGE 1 is a SIZE AND PLACEMENT GUIDE: grey mannequins on magenta, one per cell: where each figure is, how tall it is, how small the head is, where the ground line is and which way the body leans. Draw every figure over its mannequin with the same size, the same head size and the same ground line. The mannequins are crude stick shapes: replace them completely with the properly drawn character; no grey may remain.

IMAGE 2 is the approved DIAGONAL WALK sheet of this very character (row 1 down-left, row 2 down-right, row 3 up-left, row 4 up-right; standing, left step, right step): it fixes the four three-quarter view angles and the look of the character.

IMAGE 3 is the approved RUN sheet of this very character for the four main directions (front, back, left, right; column 1 standing, columns 2-5 the four run frames): it fixes how he runs: the forward lean, the pumping arms, the long stride, the streaming hair, cloak and scarf, and the four phases.

Draw the same run, in exactly the same art style, art-pixel size, head size, palette and soft selective outline, seen from the four diagonal angles of image 2. Column 1 of the new sheet repeats the standing figure of each row of image 2 unchanged.

%(run)s

%(limbs)s

THE CHARACTER, exactly as in images 2 and 3: %(char)s

%(gear)s

CANVAS: %(W)dx%(H)d px, flat #FF00FF everywhere. 4 rows x 5 columns, each cell 574x686 px, exactly where the mannequins of image 1 are.
Row 1: running DOWN-LEFT (three-quarter FRONT view turned 45 degrees to the viewer's left; face and chest visible, both eye dots; leaning toward the lower left).
Row 2: running DOWN-RIGHT (three-quarter FRONT view turned 45 degrees to the viewer's right; leaning toward the lower right).
Row 3: running UP-LEFT (three-quarter BACK view turned 45 degrees to the viewer's left; back of the head, the cloak with bow and quiver; NO eyes; leaning toward the upper left).
Row 4: running UP-RIGHT (three-quarter BACK view turned 45 degrees to the viewer's right; NO eyes; leaning toward the upper right).
Columns in every row: 1 = STANDING still, upright (as in image 2, for scale); 2 = RUN 1; 3 = RUN 2; 4 = RUN 3; 5 = RUN 4.
The camera looks slightly down on the figure (top-down RPG field view), the same angle in every cell.

All figures are the same person at the same size: the head is exactly as big in the run frames as in the standing frame. One figure per cell, never crossing into a neighbour cell or the image edge (keep the flying scarf short enough).
PIXEL RULES: real pixel art, crisp squares on a regular grid, the same art-pixel size as image 2. No blur, no motion blur, no speed lines, no dust puffs, no gradients, no glow, no black outline, hard edges against the background. Muted dusty colours exactly as in image 2; light from the upper left.
NO shadow on the ground, no floor, no text, no labels, no numbers, no frames, no grid lines.
'''


PREV_RUN = '''
IMAGE 4 is an earlier attempt at this very sheet. Its look is RIGHT and must be kept: the character, the forward lean, the streaming hair, cloak and scarf, the landing and flight poses of the profile rows, and the bow tip and quiver fletchings that stay visible on the back in EVERY frame. Its fault: the legs and arms do not alternate: the same leg and the same arm are in front in all four frames of a row. Draw the sheet again following the LIMB TABLE and the light / dark limbs of the mannequins of image 1, so that RUN 3 and RUN 4 show the other leg and the other arm forward. In the front and back rows keep the legs under the body (a run toward / away from us, no sideways split).
'''


def main():
    a = argparse.ArgumentParser()
    a.add_argument('kind'); a.add_argument('out'); a.add_argument('--src'); a.add_argument('--src2')
    a.add_argument('--extra', default=''); a.add_argument('--quality', default='high')
    x = a.parse_args()
    W, H = (2880, 2752) if x.kind.startswith('run') else (1936, 2800)
    kw = dict(style=STYLE, char=CHAR, W=W, H=H, run=RUN_MOTION)
    g = lambda n: os.path.join(HERE, 'work', n)
    if x.kind == 'walk':
        pr, ims = P_WALK % dict(kw, gear=GEAR_MAIN), [g('guide_walk.png'), HERO, MAPREF]
    elif x.kind == 'diag':
        pr, ims = P_DIAG % dict(kw, gear=GEAR_DIAG), [x.src, HERO_D]
    elif x.kind == 'run':
        pr, ims = P_RUN % dict(kw, gear=GEAR_MAIN, limbs=LIMBS_MAIN), [g('guide_run.png'), x.src, HERO]
        if x.src2:                                             # an earlier run attempt: keep its look, redo its poses
            pr += PREV_RUN; ims.append(x.src2)
    elif x.kind == 'rundiag':
        pr, ims = P_RUNDIAG % dict(kw, gear=GEAR_DIAG, limbs=LIMBS_DIAG), [g('guide_rundiag.png'), x.src, x.src2]
    else:
        raise SystemExit('kind?')
    if x.extra:
        pr += '\nEXTRA INSTRUCTIONS FOR THIS ATTEMPT:\n' + x.extra
    img.gen(pr, x.out, size='%dx%d' % (W, H), quality=x.quality, images=ims, tag='party_rogue_' + x.kind)


if __name__ == '__main__':
    main()
