"""Shared text and the image call for the priestess sheets (gpt-image-2 over the Images API, via build/img.py)."""
import os, sys
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build')
import img
img.LOG = '/home/user/tw/log/usage_party.jsonl'
HERO_RAW = '/home/user/tw/hero/raw/p7b.png'
HERO_DIAG = '/home/user/tw/hero/raw/q7a.png'

CHAR = '''a young priestess of about 17, slender, gentle and composed, a healer.
- Hair: long, straight, pale flaxen gold, with a plain straight fringe, falling loose down the back to the middle of the back; shaded pale straw to dusty ochre-brown. A thin white ribbon circlet (a 1 px pale line) runs around the head just above the fringe.
- A LONG robe of deep plum-indigo (a dark, dusty violet) that reaches the ankles, with wide sleeves that cover the wrists. Over it a cream TABARD: one long narrow panel hanging down the front from the collar to the shins and one down the back, each edged with a 1 px line of dull gold; tied at the waist with a thin dull-gold cord. Only the tips of soft dark shoes show under the hem. NO hood, NO cape, NO jewellery, NO bag.
- ONE prop only: a slender holy STAFF of pale wood, 2 art px thick, perfectly straight, about as tall as she is (its top stands a little above the top of her head), topped with a small open brass crescent ring about 6 art px across. She carries it upright in her own RIGHT hand, the butt just above the ground. No glow, no rays, no gem, no ribbons on the staff.'''

STYLE = '''STYLE: the restrained, grown-up pixel art of modern "HD-2D" console RPG field sprites: small figures that sit quietly inside a richly lit pixel diorama. NOT a 16-bit / SNES-style chibi sprite. It must look drawn by the same hand as the silver-haired traveller of the style reference image: the same size of art pixel, the same head size, the same amount of detail, the same soft shading and the same soft own-colour edges.
- PROPORTIONS AND PIXEL DENSITY: about 3.2 heads tall. The whole figure is 76 art pixels tall from the top of the hair to the shoe soles (she is slightly shorter than the traveller, who is 80). The head with hair is about 24 art px high and 21 wide, exactly the traveller's head size (a SMALL head, drawn with FINE pixels); narrow natural shoulders; a real torso; the robe falls straight and slim, widening only a little toward the hem (about 24 art px wide at the hem in front view). Not chibi, not super-deformed, no oversized hands.
- FACE: a small plain skin plane. Eyes are tiny dots: 1 px wide, 2 px high, dark brown, about 5 px apart. NO eyelashes, NO iris, NO eye highlight, NO eyebrows, NO nose, NO mouth, NO blush. A soft shadow under the fringe is the only modelling.
- NO BLACK OUTLINE. There is no dark or blackish line around the figure, the arms, the robe or the staff. The edge of every shape is simply a darker, slightly cooler shade of that shape's own colour (selective outline), 1 px. No near-black pixels anywhere except the two eye dots. The plum robe is dark but clearly violet, never black.
- COLOURS: muted, dusty, slightly desaturated, like cloth seen at dusk. About 18-26 colours in the whole sheet, 3-4 shades per material (flaxen hair 4, skin 3, plum robe 4, cream tabard 3, dull gold 2, pale wood 2, brass 2, white ribbon 1, shoes 2). No saturated highlights, no pure white, no shiny specular dots, no gloss bands on the hair.
- SHADING: soft and simple, in big calm planes: light from the upper left, a broad shadow side on the right, shadows drifting toward blue-violet. Low contrast inside each material. No dithering, no texture noise, no fold spaghetti: 2-3 quiet vertical folds on the robe are enough.
- PIXELS: real pixel art. One art pixel = exactly 7x7 image px on a regular grid over the whole image (the same grid the mannequins of the guide image are built on). Crisp squares: no blur, no anti-aliasing against the background, no gradients, no glow.'''


def gen(prompt, out, images, size, quality='high', tag='party_priest'):
    return img.gen(prompt, out, size=size, quality=quality, images=images, tag=tag)
