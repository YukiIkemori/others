"""Pad a small painted map (interiors) to whole chunks (R.Terrain.CHUNK = 8 tiles) so the chunk area outside the map is not left transparent
(the light multiply turns transparent pixels white when the camera shows beyond a small room). Fill = flat dark outside colour (RGB) / transparent (RGBA layers).
usage: python3 pad.py <outdir> <name> <w tiles> <h tiles>"""
import sys, os, glob
from PIL import Image
out, name, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
C = 8; PW, PH = -(-W // C) * C, -(-H // C) * C
if (PW, PH) == (W, H): sys.exit(0)
for f in glob.glob(os.path.join(out, name + '@*.png')):
    t = int(f.rsplit('@', 1)[1][:-4]); im = Image.open(f)
    new = Image.new(im.mode, (PW * t, PH * t), (58, 44, 38) if im.mode == 'RGB' else (0, 0, 0, 0))
    new.paste(im, (0, 0)); new.save(f, optimize=True)
    print('padded', f, im.size, '->', new.size)
