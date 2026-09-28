"""Review sheet: for each painted prop of a map, the old sprite on the old painting (left) and the edited painting (right), 3x3 tiles.
usage: python3 contact.py <map> <out.png> [window k]"""
import sys, json, os
from PIL import Image, ImageDraw
import lib
HERE = os.path.dirname(os.path.abspath(__file__))
mid, out = sys.argv[1], sys.argv[2]; only = sys.argv[3] if len(sys.argv) > 3 else None
A = json.load(open(os.path.join(HERE, 'applied.json')))
items = [(k, i, x, y) for k, v in A.items() if k.rsplit('_w', 1)[0] == mid and (only is None or k.endswith('_w' + only)) for i, x, y in v['painted']]
old = lib.composite(mid, 32, base=Image.open(os.path.join(HERE, 'work/orig/%s@32.png' % mid)).convert('RGBA'),
                    objs=[o for o in lib.MAPS[mid]['objects'] if o['type'] == 'prop' and o['id'] not in (lib.MAPS[mid]['art'].get('painted') or [])]).convert('RGB')
new = lib.painting(mid).convert('RGB')
C = 6; S = 96; n = len(items); rows = (n + C - 1) // C
W = Image.new('RGB', (C * (2 * S + 12), rows * (S + 14)), (20, 20, 20)); d = ImageDraw.Draw(W)
for j, (k, i, x, y) in enumerate(items):
    bx = ((x - 1) * 32, (y - 1) * 32, (x + 2) * 32, (y + 2) * 32)
    X, Y = (j % C) * (2 * S + 12), (j // C) * (S + 14)
    W.paste(old.crop(bx), (X, Y + 12)); W.paste(new.crop(bx), (X + S + 2, Y + 12))
    d.text((X + 2, Y), '%d %s %d,%d %s' % (j, i, x, y, k.rsplit('_', 1)[1]), fill=(255, 255, 120))
W.save(out); print(n, 'items')
