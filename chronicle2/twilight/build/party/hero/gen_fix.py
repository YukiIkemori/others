"""Correction pass on one raw run sheet: the same sheet again with a short list of changes (image 1 = the sheet).
usage: python3 gen_fix.py <raw_in.png> <out.png> <changes.txt> [quality]"""
import sys
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build')
import img
img.LOG = '/home/user/tw/log/usage_party.jsonl'
src, out, ch = sys.argv[1:4]
quality = sys.argv[4] if len(sys.argv) > 4 else 'high'
PROMPT = '''IMAGE 1 is a finished pixel-art sprite sheet for a 2D RPG: 4 rows x 5 columns of one character on flat magenta #FF00FF (column 1 standing, columns 2-5 the four frames of his run cycle; row 1 front view, row 2 back view, row 3 running left, row 4 running right).
IMAGE 2 is the approved walk sheet of the same character, as a reference for how he looks from each side.

Redraw IMAGE 1 exactly as it is: the same canvas size, every figure in the same place at the same size, in the same pose, with the same pixels, the same colours, the same pixel size, the same hard edges against the flat magenta. Change ONLY the following:

%s

Everything else stays untouched. Real pixel art: crisp squares, no blur, no anti-aliasing, no gradients, no glow, no black outline, no shadow on the ground, no text.
'''
img.gen(PROMPT % open(ch).read().strip(), out, size='2880x2800', quality=quality, images=[src, '/home/user/tw/hero/raw/p7b.png'], tag='party_hero_run_fix')
