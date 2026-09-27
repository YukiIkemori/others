"""Colour-coded layout guide for the painted Fern underlay (tile 32), v2 (organic layout). usage: python3 guide_fern.py [data.json]"""
import json, random, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'fern_data.json'))
T = 32; W, H = d['w'], d['h']; rows = d['rows']
im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im)
COL = {'.': (92, 118, 64), ',': (104, 150, 72), 'r': (192, 152, 100), 'e': (165, 125, 82), 'c': (150, 150, 160), '*': (205, 120, 190), 'h': (105, 72, 48),
       '~': (40, 100, 200), 'k': (175, 112, 60), 'F': (22, 58, 32), 'T': (30, 82, 40), 'R': (118, 66, 40), '=': (222, 180, 112), ':': (222, 180, 112)}
at = lambda x, y: rows[y][x] if 0 <= x < W and 0 <= y < H else 'F'
blds = [o for o in d['objects'] if o['type'] == 'building']
bcell = np.zeros((H, W), bool)
for o in blds: bcell[o['y']:o['y'] + o['h'], o['x']:o['x'] + o['w']] = True
for y in range(H):
    for x in range(W):
        c = at(x, y)
        g.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], fill=COL['.'] if (bcell[y, x] and c == 'R') else COL[c])
rnd = random.Random(5)
for y in range(H):
    for x in range(W):
        c = at(x, y)
        if c in 'FT':
            cx, cy = x * T + 16 + rnd.randint(-4, 4), y * T + 14 + rnd.randint(-4, 4)
            col = (30, 76, 42) if c == 'F' else (48, 112, 52)
            g.ellipse([cx - 19, cy - 19, cx + 19, cy + 19], fill=col, outline=(12, 36, 20))
        if c == '~': g.line([x * T + 4, y * T + 12, x * T + 14, y * T + 12], fill=(90, 150, 230), width=2)
        if c == 'k':
            for k in range(0, T, 8): g.line([x * T + k, y * T, x * T + k, y * T + T - 1], fill=(120, 72, 36), width=2)
# R cells: platform frames (next to a deck / ladder) = posts; the rest = colossal trees (big masses) or gate roots (small masses)
Rm = np.array([[at(x, y) == 'R' for x in range(W)] for y in range(H)])
DK = np.array([[at(x, y) in '=:' for x in range(W)] for y in range(H)])
frame = Rm & (np.roll(DK, 1, 0) | np.roll(DK, 1, 1) | np.roll(DK, -1, 1) | (np.roll(DK, 1, 0) & False))
frame |= Rm & np.roll(frame, 1, 1) & np.roll(np.roll(DK, 1, 0), 1, 1)
for y in range(H):
    for x in range(W):
        if not frame[y, x]: continue
        x0, y0 = x * T, y * T
        g.rectangle([x0, y0, x0 + T - 1, y0 + T - 1], fill=(70, 44, 28))
        for px in (x0 + 5, x0 + 21): g.rectangle([px, y0, px + 6, y0 + T - 1], fill=(140, 92, 52))
lab, n = ndimage.label((Rm & ~frame) | bcell & ndimage.binary_dilation(Rm, iterations=1))
trees, roots = [], []
for i, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; size = (lab[sl] == i + 1).sum()
    (trees if size > 30 else roots).append((xs.start, ys.start, xs.stop - 1, ys.stop - 1, i + 1))
# the colossal trees: crown on top, huge bark trunk with root flares below (drawn only on the tree cells)
treemask = Image.new('L', (W * T, H * T), 0); tg = ImageDraw.Draw(treemask)
for (x0, y0, x1, y1, li) in trees:
    for (yy, xx) in zip(*np.where(lab == li)):
        if not bcell[yy, xx] or Rm[yy, xx]: tg.rectangle([xx * T, yy * T, xx * T + T - 1, yy * T + T - 1], fill=255)
tree = Image.new('RGB', (W * T, H * T)); tr = ImageDraw.Draw(tree)
for (x0, y0, x1, y1, li) in trees:
    px0, py0, px1, py1 = x0 * T, y0 * T, (x1 + 1) * T - 1, (y1 + 1) * T - 1
    hgt = py1 - py0; cw = px1 - px0
    tr.rectangle([px0, py0, px1, py1], fill=(128, 76, 46))
    for k in range(px0 + 10, px1, 18): tr.line([k, py0 + hgt * 0.35, k + (8 if (k // 18) % 2 else -8), py1 - 6], fill=(92, 52, 32), width=3)
    for i in range(int(cw * hgt / 1400) + 8):
        cx = px0 + rnd.random() * cw; cy = py0 + rnd.random() * hgt * 0.42; r = 20 + rnd.random() * 18
        tr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(26, 92, 44), outline=(10, 40, 20))
im.paste(tree, (0, 0), treemask)
# pod homes grown into the trunks above the platforms (round windows, no doors)
for (qx, qy) in [(7, 8.6), (10.5, 9.0), (15.5, 8.6), (37.5, 8.6), (41, 7.4), (44.5, 9.0), (4.5, 41.2), (8.2, 41.2)]:
    cx, cy = qx * T, qy * T
    g.ellipse([cx - 22, cy - 20, cx + 22, cy + 22], fill=(214, 186, 120), outline=(50, 30, 16), width=2)
    g.ellipse([cx - 7, cy - 4, cx + 7, cy + 10], fill=(255, 220, 120), outline=(40, 30, 30))
# gate roots (small R masses) and the arches over the road
for (x0, y0, x1, y1, li) in roots:
    for (yy, xx) in zip(*np.where(lab == li)):
        g.rectangle([xx * T, yy * T, xx * T + T - 1, yy * T + T - 1], fill=(150, 90, 45))
        g.line([xx * T, yy * T + 8, xx * T + T - 1, yy * T + 24], fill=(90, 50, 25), width=4)
for (ax0, ax1, ay) in ((25, 34, 3), (24, 35, 50)):
    g.rectangle([ax0 * T, ay * T - 6, (ax1 + 1) * T - 1, ay * T + 12], fill=(200, 120, 50), outline=(60, 30, 10))
# deck planks, ladder rungs
for y in range(H):
    for x in range(W):
        c = at(x, y); x0, y0 = x * T, y * T
        if c == '=':
            for k in range(0, T, 8): g.line([x0, y0 + k, x0 + T - 1, y0 + k], fill=(160, 118, 66), width=2)
            if at(x, y - 1) != '=': g.rectangle([x0, y0, x0 + T - 1, y0 + 3], fill=(90, 60, 30))
            if at(x, y + 1) != '=': g.rectangle([x0, y0 + T - 4, x0 + T - 1, y0 + T - 1], fill=(90, 60, 30))
        if c == ':':
            g.rectangle([x0 + 6, y0, x0 + 9, y0 + T - 1], fill=(80, 50, 25)); g.rectangle([x0 + 22, y0, x0 + 25, y0 + T - 1], fill=(80, 50, 25))
            for k in range(3, T, 8): g.rectangle([x0 + 6, y0 + k, x0 + 25, y0 + k + 2], fill=(250, 220, 90))
# buildings
SH = {
 'fern_u_inn':    dict(kind='facade', wall=(196, 150, 96)),
 'fern_u_shop':   dict(kind='facade', wall=(196, 150, 96)),
 'fern_u_search': dict(kind='facade', wall=(196, 150, 96)),
 'fern_u_gord':   dict(kind='stump', roof=(220, 185, 120), wall=(120, 72, 44)),
 'fern_u_rita':   dict(kind='pod', roof=(150, 110, 200), wall=(190, 170, 120)),
 'fern_u_pim':    dict(kind='gourd', roof=(200, 170, 70), wall=(215, 185, 110)),
 'fern_u_house1': dict(kind='mush', roof=(140, 80, 190), wall=(235, 220, 190)),
 'fern_u_house2': dict(kind='acorn', roof=(140, 95, 50), wall=(200, 150, 90)),
 'fern_u_house3': dict(kind='mush', roof=(40, 150, 160), wall=(235, 220, 190)),
 'fern_u_shed':   dict(kind='acorn', roof=(140, 95, 50), wall=(200, 150, 90)),
}
out = []
for o in blds:
    s = SH[o['id']]
    x0, y0, w, h = o['x'] * T, o['y'] * T, o['w'] * T, o['h'] * T
    wall = o.get('wall', 2) * T
    ol = (40, 24, 16)
    k = s['kind']
    if k == 'facade':   # a face of the great tree: warm wooden wall panel in the bark (the part above is the trunk)
        g.rounded_rectangle([x0 + 2, y0 + h - wall - 6, x0 + w - 3, y0 + h - 1], radius=12, fill=s['wall'], outline=ol, width=3)
    else:
        g.rectangle([x0, y0, x0 + w - 1, y0 + h - 1], fill=COL['.'])
    if k == 'mush':
        g.rounded_rectangle([x0 + 5, y0 + h - wall - 6, x0 + w - 6, y0 + h - 1], radius=10, fill=s['wall'], outline=ol, width=2)
        g.ellipse([x0, y0, x0 + w - 1, y0 + (h - wall) + 18], fill=s['roof'], outline=ol, width=2)
        for (fx, fy) in ((0.3, 0.3), (0.62, 0.22), (0.5, 0.55), (0.18, 0.55), (0.8, 0.5)):
            g.ellipse([x0 + fx * w - 5, y0 + fy * (h - wall) - 4, x0 + fx * w + 5, y0 + fy * (h - wall) + 4], fill=(245, 240, 225))
    elif k == 'stump':
        g.rounded_rectangle([x0, y0 + 12, x0 + w - 1, y0 + h - 1], radius=16, fill=s['wall'], outline=ol, width=2)
        g.ellipse([x0, y0, x0 + w - 1, y0 + (h - wall) + 10], fill=s['roof'], outline=ol, width=2)
        cx, cy = x0 + w / 2, y0 + ((h - wall) + 10) / 2
        for r in range(8, int(w / 2), 10): g.ellipse([cx - r, cy - r * 0.55, cx + r, cy + r * 0.55], outline=(170, 130, 80), width=2)
    elif k in ('gourd', 'pod', 'acorn'):
        g.ellipse([x0 + 2, y0 + 6, x0 + w - 3, y0 + h + 10], fill=s['wall'], outline=ol, width=2)
        g.rectangle([x0 + 2, y0 + h - 14, x0 + w - 3, y0 + h - 1], fill=s['wall'])
        g.line([x0 + 2, y0 + h - 1, x0 + w - 3, y0 + h - 1], fill=ol, width=2)
        g.chord([x0 + 1, y0 + 1, x0 + w - 2, y0 + 2 * (h - wall) + 6], 180, 360, fill=s['roof'], outline=ol, width=2)
        if k != 'acorn': g.polygon([(x0 + w / 2 - 6, y0 + 4), (x0 + w / 2, y0 - 10), (x0 + w / 2 + 6, y0 + 4)], fill=(80, 140, 60))
    dx, dy = o['door']['x'] * T, o['door']['y'] * T
    g.rounded_rectangle([dx + 5, dy + 2, dx + T - 6, dy + T - 1], radius=8, fill=(15, 8, 8))
    nw = o.get('windows', 2)
    if nw:
        wy = y0 + h - wall + (wall - T) // 2 + 2 if wall > T else y0 + h - wall + 2
        slots = [x0 + int((i + 0.5) * w / nw) for i in range(nw)] if nw > 1 else [dx + 16 + (40 if dx + 56 < x0 + w else -40)]
        for sx in slots:
            if abs(sx - (dx + 16)) < 26: sx += 40 if sx >= dx + 16 else -40
            if sx < x0 + 10 or sx > x0 + w - 10: continue
            g.ellipse([sx - 7, wy, sx + 7, wy + 14], fill=(255, 220, 120), outline=(40, 30, 30))
    out.append(dict(id=o['id'], x=o['x'], y=o['y'], w=o['w'], h=o['h'], wall=o.get('wall', 2), door=[o['door']['x'], o['door']['y']], kind=k))
for o in d['objects']:
    if o['type'] == 'prop' and o['id'] == 'fence':
        x, y = o['x'] * T, o['y'] * T
        g.rectangle([x, y + 12, x + T - 1, y + 20], fill=(110, 70, 40)); g.rectangle([x + 13, y + 4, x + 19, y + 28], fill=(80, 50, 28))
im.save('guide_1x.png')
json.dump(out, open('blds.json', 'w'), indent=1)
print('trees', [(t[:4]) for t in trees], 'roots', len(roots))
