#!/usr/bin/env python3
"""Side-by-side check: source crop (scaled to the same height) | final sprite at N×, on a mid-grey.
  python3 tools/compare.py arun [ids…] [--scale 4] [--out file]"""
import json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
char = args.pop(0)
scale = 4; out = None
if '--scale' in args: i = args.index('--scale'); scale = int(args[i + 1]); del args[i:i + 2]
if '--out' in args: i = args.index('--out'); out = args[i + 1]; del args[i:i + 2]
od = os.path.join(HERE, 'out', char)
rep = json.load(open(os.path.join(od, 'extract.json')))
_sheets = {}
def sheet_of(sid):
    p = rep['sprites'][sid].get('sheet', rep['sheet'])
    if p not in _sheets: _sheets[p] = Image.open(os.path.join(HERE, 'configs', p)).convert('RGB')
    return _sheets[p]
ids = args or list(rep['sprites'])
tiles = []
for sid in ids:
    s = Image.open(os.path.join(od, 'sprites', sid + '.png'))
    big = s.resize((s.width * scale, s.height * scale), Image.NEAREST)
    src = sheet_of(sid).crop(tuple(rep['sprites'][sid]['src_box']))
    if rep['sprites'][sid]['flipped']: src = src.transpose(Image.FLIP_LEFT_RIGHT)
    k = big.height / src.height
    src = src.resize((max(1, int(src.width * k)), big.height), Image.LANCZOS)
    t = Image.new('RGB', (src.width + big.width + 12, big.height), (92, 92, 104))
    t.paste(src, (0, 0)); t.paste(big, (src.width + 12, 0), big)
    tiles.append(t)
W = max(t.width for t in tiles); H = sum(t.height + 8 for t in tiles)
if W > 2400 or len(tiles) > 3:  # grid
    cols = 2; rows = (len(tiles) + 1) // 2
    cw = max(t.width for t in tiles); ch = max(t.height for t in tiles)
    sheet = Image.new('RGB', (cw * cols + 8, ch * rows + 8 * rows), (40, 40, 48))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * (cw + 8), (i // cols) * (ch + 8)))
else:
    sheet = Image.new('RGB', (W, H), (40, 40, 48)); y = 0
    for t in tiles: sheet.paste(t, (0, y)); y += t.height + 8
sheet.save(out or os.path.join(HERE, 'work', 'cmp_' + '_'.join(ids)[:60] + '.png'))
print(sheet.size, out)
