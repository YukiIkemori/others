"""Layout guide images for building generations (drawn in art px, then scaled up)."""
from PIL import Image, ImageDraw
TS = 32; OV = 8; TOP = 32
ROOFC = {'slate': (70, 88, 122), 'terra': (156, 78, 52), 'thatch': (170, 140, 80), 'shingle': (112, 80, 54), 'moss': (70, 104, 60), 'bark': (80, 62, 44)}
WALLC = {'plaster': (214, 204, 184), 'stone': (140, 128, 112), 'plank': (130, 96, 64), 'log': (120, 84, 52), 'brick': (160, 84, 58), 'bark': (98, 76, 54)}

def layout(d):
    """d: building def (tiles). -> dict with art-px geometry (sprite coordinates)."""
    w, h = d['w'], d['h']
    wall = d.get('wall', 2)
    W, H = w * TS + 2 * OV, h * TS + TOP
    roofH = (h - wall) * TS
    g = dict(W=W, H=H, OV=OV, TOP=TOP, w=w, h=h, wall=wall)
    g['roof'] = (OV - 6, TOP - 4, OV + w * TS + 6, TOP + roofH + 6)
    g['wallr'] = (OV, TOP + roofH, OV + w * TS, H)
    small = d.get('small') or wall <= 1
    dw, dh = (18, 26) if small else (22, 32)
    door = None
    if d.get('door'):
        dx = d['door'].get('x')
        cx = OV + ((dx - d['x']) * TS + TS // 2 if dx is not None else w * TS // 2)
        door = (cx - dw // 2, H - dh, cx + dw // 2, H)
    g['door'] = door
    # windows on each wall storey
    nwin = d.get('windows', max(1, w // 2))
    wins = []
    stories = 2 if wall >= 3 else 1
    for s in range(stories):
        y0 = H - 32 - s * 44
        if isinstance(nwin, list):
            xs = [OV + t * TS + TS // 2 for t in nwin]
        else:
            n = nwin + (1 if s and door else 0)
            xs = []
            cand = [x for x in range(OV + 18, OV + w * TS - 18, 2) if s or not door or abs(x - (door[0] + door[2]) / 2) > 28]
            for i in range(n):
                if cand:
                    xs.append(cand[min(len(cand) - 1, int((i + 0.5) / n * len(cand)))])
        for x in xs:
            wins.append((x - 8, y0, x + 8, y0 + 20))
    g['windows'] = wins
    return g

def draw_guide(d, scale=7, bg=(255, 0, 255)):
    g = layout(d)
    im = Image.new('RGB', (g['W'] * scale, g['H'] * scale), bg)
    dr = ImageDraw.Draw(im)
    S = lambda r: tuple(v * scale for v in r)
    dr.rectangle(S(g['wallr']), fill=WALLC.get(d.get('mat', 'plaster'), (200, 190, 170)))
    rc = ROOFC.get(d.get('roof', 'slate'), (80, 90, 120))
    x0, y0, x1, y1 = g['roof']
    dr.rectangle(S(g['roof']), fill=rc)
    # ridge line hint
    dr.line([(x0 * scale, (y0 + (y1 - y0) * 0.45) * scale), (x1 * scale, (y0 + (y1 - y0) * 0.45) * scale)], fill=tuple(max(0, c - 40) for c in rc), width=scale * 2)
    for wr in g['windows']:
        dr.rectangle(S(wr), fill=(250, 200, 90), outline=(60, 40, 30), width=scale)
    if g['door']:
        dr.rectangle(S(g['door']), fill=(70, 40, 24), outline=(30, 18, 12), width=scale)
    return im, g
