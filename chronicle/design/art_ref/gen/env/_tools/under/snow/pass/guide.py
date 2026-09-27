import json, sys
from PIL import Image, ImageDraw
d = json.load(open('layout.json')); W, H = d['w'], d['h']; rows = d['rows']; B = d['blds']
def at(x, y): return rows[y][x] if 0 <= x < W and 0 <= y < H else '#'
WALK = set('.,c')
COL = {'.': (238, 238, 232), ',': (206, 186, 150), 'c': (150, 146, 140), '~': (70, 170, 190), '#': (96, 86, 80)}
def draw(T):
    im = Image.new('RGB', (W * T, H * T)); g = ImageDraw.Draw(im); lw = max(1, T // 24)
    R = lambda x, y, w=1, h=1: [x * T, y * T, (x + w) * T - 1, (y + h) * T - 1]
    for y in range(H):
        for x in range(W):
            ch = at(x, y); g.rectangle(R(x, y), fill=COL.get(ch, COL['#']))
            if ch == '#' and at(x, y + 1) in WALK | {'~'}:
                g.rectangle([x * T, y * T + T // 3, x * T + T - 1, y * T + T - 1], fill=(128, 98, 76))
                for k in range(1, 3): g.line([x * T, y * T + T // 3 + k * T // 5, x * T + T - 1, y * T + T // 3 + k * T // 5], fill=(100, 76, 60), width=lw)
            if ch == 'c' and (x + y) % 2 == 0: g.rectangle([x * T + T // 6, y * T + T // 6, x * T + T - T // 6, y * T + T - T // 6], outline=(116, 112, 108), width=lw)
            if ch == '~': g.ellipse([x * T + T // 4, y * T + T // 4, x * T + T // 2, y * T + T // 2], outline=(230, 250, 255), width=lw)
            if ch == ',' and (x * 7 + y * 3) % 5 == 0: g.ellipse([x * T + T // 3, y * T + T // 3, x * T + T // 2, y * T + T // 2], fill=(170, 150, 120))
    for b in B:
        x0, y0, w, h = b['x'] * T, b['y'] * T, b['w'] * T, b['h'] * T; wall = b['wall'] * T; rb = y0 + h - wall; k = b['kind']
        if k == 'tower':
            g.rectangle([x0, y0, x0 + w - 1, rb], fill=(120, 116, 112), outline=(40, 36, 34), width=lw * 2)   # flat battlemented top
            for i in range(0, w, T): g.rectangle([x0 + i + T // 4, y0, x0 + i + 3 * T // 4, y0 + T // 3], fill=(90, 86, 84))
            g.polygon([(x0 + T // 2, rb), (x0 + w // 2, y0 + T // 2), (x0 + w - T // 2, rb)], fill=(140, 96, 60), outline=(50, 30, 20))   # timber roof added on top
            g.rectangle([x0, rb, x0 + w - 1, y0 + h - 1], fill=(168, 160, 150), outline=(40, 36, 34), width=lw)
        elif k == 'gate':
            g.rectangle([x0, y0, x0 + w - 1, rb], fill=(110, 106, 102), outline=(40, 36, 34), width=lw * 2)
            for i in range(0, w, T): g.rectangle([x0 + i + T // 4, y0, x0 + i + 3 * T // 4, y0 + T // 3], fill=(84, 80, 78))
            g.rectangle([x0, rb, x0 + w - 1, y0 + h - 1], fill=(160, 152, 144), outline=(40, 36, 34), width=lw)
            ax0, ax1 = x0 + 4 * T, x0 + w - 4 * T
            g.pieslice([ax0, rb - T // 2, ax1, y0 + h + 2 * T], 180, 360, fill=(70, 60, 54))
            g.rectangle([ax0, rb + T, ax1, y0 + h - 1], fill=(70, 60, 54))
            for i in range(6): g.ellipse([ax0 + (i * 37) % (ax1 - ax0 - T // 2), rb + T // 2 + (i * 23) % (wall - T), ax0 + (i * 37) % (ax1 - ax0 - T // 2) + T // 2, rb + T // 2 + (i * 23) % (wall - T) + T // 2], fill=(120, 110, 100))   # rubble
        elif k == 'screen':
            g.rectangle([x0, y0, x0 + w - 1, y0 + h - 1], fill=(130, 92, 58), outline=(40, 24, 16), width=lw)
            for i in range(0, w, T // 3): g.line([x0 + i, y0, x0 + i, y0 + h - 1], fill=(100, 70, 44), width=lw)
        if b.get('door'):
            dx, dy = b['door'][0] * T, b['door'][1] * T
            g.rectangle([dx + T * 5 // 32, dy + T // 16, dx + T - 1 - T * 5 // 32, dy + T - 1], fill=(20, 10, 10))
            for sx in (x0 + T, x0 + w - T):
                if abs(sx - (dx + T // 2)) < T: continue
                wy = rb + T // 3
                g.rectangle([sx - T * 7 // 32, wy, sx + T * 7 // 32, wy + T * 12 // 32], fill=(255, 220, 120), outline=(40, 30, 30))
    return im
T = int(sys.argv[1]) if len(sys.argv) > 1 else 48
draw(T).save('guide_%d.png' % T); draw(32).save('guide_1x.png')
json.dump([dict(id=b['id'], kind=b['kind'], x=b['x'], y=b['y'], w=b['w'], h=b['h'], wall=b['wall'], door=b.get('door')) for b in B], open('blds.json', 'w'), indent=1)
print('ok')
