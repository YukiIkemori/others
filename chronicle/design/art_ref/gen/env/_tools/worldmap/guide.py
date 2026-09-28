"""Layout guide for the parchment WORLD MAP painting (the map screen), from the game's world grid.
usage: python3 guide.py <world.json> -> guide.png (2048x1536: biome colours, softened; the model redraws it as old cartography)
world.json: node dump of R.DB.maps.world {w, h, rows, legend}. The world (672x576) is scaled by S and centred with sea margins."""
import sys, json, numpy as np
from PIL import Image, ImageFilter
d = json.load(open(sys.argv[1]))
W, H = d['w'], d['h']; OW, OH = 2048, 1536
S = min(OW / W, OH / H); OX, OY = (OW - W * S) / 2, (OH - H * S) / 2
BIOME = {'~': 'sea', 'O': 'sea', 'w': 'lake', '_': 'shore', 's': 'sand', ',': 'grass', ';': 'grass', '"': 'grass', '.': 'road', 'd': 'road',
         'h': 'forest', 'T': 'forest', 'F': 'forest', 'b': 'forest', 'Y': 'forest', 'V': 'forest', 'v': 'forest', 't': 'forest',
         'm': 'mount', 'c': 'mount', '^': 'mount', 'n': 'snow', 'M': 'snow', 'I': 'ice', 'P': 'snow', 'a': 'ash', 'j': 'ash', '%': 'lava',
         'u': 'desert', 'k': 'desert', 'X': 'desert', 'Q': 'desert', 'G': 'marsh', 'W': 'marsh', 'R': 'marsh', 'K': 'marsh', 'Z': 'marsh', '=': 'road'}
COL = {'sea': (40, 70, 120), 'lake': (60, 110, 170), 'shore': (120, 170, 200), 'sand': (220, 200, 150), 'grass': (130, 170, 90), 'road': (130, 170, 90),
       'forest': (40, 100, 50), 'mount': (130, 120, 110), 'snow': (235, 240, 245), 'ice': (190, 220, 240), 'ash': (80, 70, 70), 'lava': (200, 70, 30),
       'desert': (220, 180, 110), 'marsh': (90, 110, 80)}
a = np.zeros((H, W, 3), np.uint8)
for y, r in enumerate(d['rows']):
    for x, ch in enumerate(r):
        a[y, x] = COL[BIOME.get(ch, 'sea')]
im = Image.fromarray(a).resize((int(W * S), int(H * S)), Image.NEAREST).filter(ImageFilter.GaussianBlur(10))
out = Image.new('RGB', (OW, OH), COL['sea']); out.paste(im, (int(OX), int(OY)))
out.save('guide.png')
json.dump({'S': S, 'OX': OX, 'OY': OY, 'W': OW, 'H': OH}, open('xform.json', 'w'))
print(S, OX, OY)
