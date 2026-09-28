"""before (orig painting + all prop sprites) | after (edited painting + the sprites that stay) for a tile rect. usage: view.py map x0 y0 w h out.png"""
import sys, json, os
from PIL import Image
import lib
HERE = os.path.dirname(os.path.abspath(__file__))
mid = sys.argv[1]; x0, y0, w, h = map(int, sys.argv[2:6]); out = sys.argv[6]
A = json.load(open(os.path.join(HERE, 'applied.json')))
pk = {(i, x, y) for k, v in A.items() if k.rsplit('_w', 1)[0] == mid for i, x, y in v['painted']}
props = [o for o in lib.MAPS[mid]['objects'] if o['type'] == 'prop' and o['id'] not in (lib.MAPS[mid]['art'].get('painted') or [])]
b = lib.composite(mid, 32, props, base=Image.open(os.path.join(HERE, 'work/orig/%s@32.png' % mid)).convert('RGBA'))
a = lib.composite(mid, 32, [o for o in props if (o['id'], o['x'], o['y']) not in pk])
box = (x0 * 32, y0 * 32, (x0 + w) * 32, (y0 + h) * 32)
W = Image.new('RGB', (w * 32 * 2 + 8, h * 32)); W.paste(b.crop(box).convert('RGB'), (0, 0)); W.paste(a.crop(box).convert('RGB'), (w * 32 + 8, 0)); W.save(out)
