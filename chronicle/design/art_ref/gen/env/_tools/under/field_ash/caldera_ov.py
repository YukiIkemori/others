"""確かめの絵: 絵（1 マス 48 px か 32 px）に今の地図の当たり・建物・戸口を重ねる。usage: python3 caldera_ov.py <img> <out.jpg> [rows.json]"""
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'caldera')
d = json.load(open(os.path.join(D, 'map_dump.json')))
rows = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else d['rows']
im = Image.open(sys.argv[1]).convert('RGB').resize((54 * 32, 54 * 32), Image.BOX); T = 32
dr = ImageDraw.Draw(im, 'RGBA')
CL = {'M': (255, 0, 0, 60), 'F': (255, 255, 0, 90), '%': (255, 128, 0, 70), 'X': (255, 0, 255, 50), 'h': (0, 128, 255, 70)}
for y, r in enumerate(rows):
    for x, c in enumerate(r):
        if c in CL: dr.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=CL[c])
for o in d['objects']:
    if o['type'] == 'building':
        dr.rectangle([o['x'] * T, o['y'] * T, (o['x'] + o['w']) * T - 1, (o['y'] + o['h']) * T - 1], outline=(0, 255, 255, 255), width=2)
        q = o['door']; dr.rectangle([q['x'] * T, q['y'] * T, q['x'] * T + T - 1, q['y'] * T + T - 1], outline=(0, 255, 0, 255), width=3)
for n in d['npcs']: dr.ellipse([n['x'] * T + 8, n['y'] * T + 8, n['x'] * T + 24, n['y'] * T + 24], fill=(0, 255, 0, 200))
im.save(sys.argv[2], quality=85)
