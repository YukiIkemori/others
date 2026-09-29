"""Painting + fitted collision: solid cells tinted red (hatched), exits green, objects cyan. usage: python3 check.py <id> <gen.png> [out]"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
aid, src = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else aid + '/check.png'
d = json.load(open(aid + '/layout.json')); W, H, T = d['w'], d['h'], 32
rows = d.get('rows_fit') or d['rows']
im = Image.open(src).convert('RGB').resize((W * T, H * T), Image.BOX).convert('RGBA')
ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        if rows[y][x] in '~wTFbrRX':
            g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(255, 0, 0, 55))
            g.line([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=(255, 60, 60, 120))
for e in d['exits']:
    g.rectangle([e['x'] * T, e['y'] * T, (e['x'] + e['w']) * T - 1, (e['y'] + e['h']) * T - 1], outline=(0, 255, 0, 255), width=3)
for o in d['objects']:
    g.rectangle([o['x'] * T + 6, o['y'] * T + 6, o['x'] * T + T - 7, o['y'] * T + T - 7], outline=(0, 255, 255, 255), width=2)
for s in d['spawns'].values():
    g.ellipse([s['x'] * T + 10, s['y'] * T + 10, s['x'] * T + 22, s['y'] * T + 22], fill=(255, 255, 0, 255))
Image.alpha_composite(im, ov).save(out)
