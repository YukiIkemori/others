"""Overlay the painting (1x) with the collision grid: red tint = solid cells, cyan box = door tiles. usage: python3 check.py <gen.png> <out.png>"""
import sys, json
from PIL import Image, ImageDraw
d = json.load(open('layout_data.json')); W, H = d['w'], d['h']; T = 32
a = Image.open(sys.argv[1]).convert('RGB').resize((W * T, H * T), Image.BOX)
ov = Image.new('RGBA', a.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        if d['walk'][y][x] == '#': g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(255, 0, 0, 110))
for b in json.load(open('blds.json')):
    if b['door']:
        dx, dy = b['door']; g.rectangle([dx * T, dy * T, dx * T + T - 1, dy * T + T - 1], outline=(0, 255, 255, 255), width=2)
out = Image.alpha_composite(a.convert('RGBA'), ov)
out.save(sys.argv[2])
