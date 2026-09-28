"""Painting (1x) with the OPEN-state collision grid: red = solid cells, yellow box = live (closed-able) cells. usage: python3 check.py <map> <img.png> <out.png> [scale]"""
import sys, json
from PIL import Image, ImageDraw
m = sys.argv[1]; d = json.load(open(m + '/layout_data.json')); W, H = d['w'], d['h']; T = 32
op = json.load(open(m + '/open.json'))['rows']
L = d['legend']
a = Image.open(sys.argv[2]).convert('RGB').resize((W * T, H * T), Image.BOX)
ov = Image.new('RGBA', a.size, (0, 0, 0, 0)); g = ImageDraw.Draw(ov)
for y in range(H):
    for x in range(W):
        e = L.get(op[y][x], {}); mi = d['mats'].get(e.get('mat'), {})
        solid = (e.get('solid') and not e.get('secret')) or e.get('walk') is False or mi.get('walk') is False
        if solid: g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(255, 0, 0, 120))
out = Image.alpha_composite(a.convert('RGBA'), ov)
sc = float(sys.argv[4]) if len(sys.argv) > 4 else 1
if sc != 1: out = out.resize((int(out.width * sc), int(out.height * sc)), Image.LANCZOS)
out.save(sys.argv[3])
