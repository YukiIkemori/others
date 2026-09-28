"""Painting (1x) + collision grid: red = solid cells (walk '#'), green outline = floor cells next to solid. usage: python3 check.py <map> <img@32> <out.png>"""
import sys, json
from PIL import Image, ImageDraw
m = sys.argv[1]
d = json.load(open('maps/%s/layout_data.json' % m)); W, H = d['w'], d['h']; T = 32
o = json.load(open('maps/%s/open.json' % m))
a = Image.open(sys.argv[2]).convert('RGB').resize((W * T, H * T))
ov = Image.new('RGBA', a.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        e = d['legend'].get(o['rows'][y][x], {'solid': True})
        solid = e.get('solid') or e.get('walk') is False
        if solid: g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(255, 0, 0, 120))
out = Image.alpha_composite(a.convert('RGBA'), ov); out.save(sys.argv[3])
