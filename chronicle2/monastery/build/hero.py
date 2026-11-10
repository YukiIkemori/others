"""Stand-in hero sprite, typed in by hand: the traveller in the navy cloak with a lantern on a staff.

Sheet: 4 columns x 4 rows of 32x48.  Rows: facing down, left, right, up.  Columns: walk cycle (0 doubles as standing).
Feet rest on row 45, centred on x=16.  A generated sprite can replace site/hero.png as long as it keeps this layout.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.environ.get('SITE', os.path.join(HERE, '..', 'site'))
WORK = os.environ.get('WORK', os.path.join(HERE, 'work'))

PAL = {
    'o': '#1d1626', 'H': '#262838', 'h': '#474b6c', 'S': '#ecd6bf', 's': '#c49f8b', 'E': '#1d1626',
    'C': '#2f3d5c', 'c': '#1f2942', 'L': '#4a6088', 'T': '#d2bd8c', 't': '#8f7a52',
    'W': '#b9b0a0', 'w': '#857c78', 'G': '#4a4258', 'B': '#4a3530', 'b': '#2b2024',
    'P': '#7a5a3c', 'p': '#4a3424', 'A': '#fff0b8', 'a': '#f6a23c', 'i': '#2b2630', 'r': '#a8323c',
}

FRONT = [
    "....oooooooo....",
    "..ooHHHHHHHHoo..",
    ".oHHhhhHHHHHHHo.",
    ".oHhhHHHHHHHHHo.",
    "oHHHHHHHHHHHHHHo",
    "oHHHHSHHHHHSHHHo",
    "oHHSSSSHHSSSSHHo",
    "oHSSESSSSSSESSHo",
    "oHSSESSSSSSESSHo",
    ".osSSSSSSSSSSso.",
    ".oosSSSssSSSsoo.",
    "...oosSSSSsoo...",
    "..ooCCTrrTCCoo..",
    ".oCLCCCTTCCCCCo.",
    ".oCLCCCCCCCCCCo.",
    "oCLLCCCCCCCCCcCo",
    "oCLCCCCWWCCCCcCo",
    "oCLCCCWWWWCCCcCo",
    "oCLCCCWWWWCCCcCo",
    "oCLCCCWWWWCCCcCo",
    "oCLCCCttttCCCcCo",
    "oCLCCCWWWWCCCcCo",
    "oCCLCCwWWwCCccCo",
    "oCCLCCwwwwCCccCo",
    "oCCLCCCwwCCCccCo",
    ".oCLCCCCCCCCcCo.",
    ".oCCLCCCCCCccCo.",
    ".oCCLCCCCCCccCo.",
    ".oTTTCCCCCCTTTo.",
    "..ooTTTTTTTToo..",
]
BACK = [
    "....oooooooo....",
    "..ooHHHHHHHHoo..",
    ".oHHHhhhHHHHHHo.",
    ".oHHhhHHHHHHHHo.",
    "oHHHhHHHHHHHHHHo",
    "oHHHHHHHHHHHHHHo",
    "oHHHHHHHHHHHHHHo",
    "oHHHHHHHHHHHHHHo",
    "oHHHHHHHHHHHHHHo",
    ".oHHHHHHHHHHHHo.",
    ".ooHHHHHHHHHHoo.",
    "...ooHHHHHHoo...",
    "..ooCCCCCCCCoo..",
    ".oCLLLLLLLLLCCo.",
    ".oCCLLLLLLLCCCo.",
    "oCLCCCCCCCCCCcCo",
    "oCLCCCCCCCCCCcCo",
    "oCLCCCCcCCCCCcCo",
    "oCLCCCCcCCCCCcCo",
    "oCLCCCCcCCCCCcCo",
    "oCLCCCCcCCCCCcCo",
    "oCLCCCCcCCCCCcCo",
    "oCCLCCCcCCCCccCo",
    "oCCLCCCcCCCCccCo",
    "oCCLCCCCcCCCccCo",
    ".oCLCCCCcCCCcCo.",
    ".oCCLCCCcCCccCo.",
    ".oCCLCCCCCCccCo.",
    ".oTTTCCCCCCTTTo.",
    "..ooTTTTTTTToo..",
]
SIDE = [   # facing right
    ".....ooooooo....",
    "...ooHHHHHHHoo..",
    "..oHHHhhhHHHHHo.",
    ".oHHHhhHHHHHHHo.",
    ".oHHHHHHHHHHHHHo",
    ".oHHHHHHHHHHSSHo",
    ".oHHHHHHHHSSSSSo",
    ".oHHHHHHHSSSSESo",
    ".oHHHHHHHSSSSESo",
    ".oHHHHHHsSSSSSo.",
    "..oHHHHHsSSSSo..",
    "...ooHHHsSSoo...",
    "...oCCCCCTrTo...",
    "..oCCCCCCCTCo...",
    "..oCcCCCCCLCo...",
    ".oCCcCCCCCLCCo..",
    ".oCcCCCCCCLLCo..",
    ".oCcCCCCCCCWWo..",
    ".oCcCCCCCCWWWo..",
    ".oCcCCCCCCWWWo..",
    ".oCcCCCCCCtttto.",
    ".oCcCCCCCCWWWo..",
    ".oCcCCCCCCwWWo..",
    ".oCCcCCCCCwwWo..",
    ".oCCcCCCCCCwo...",
    ".oCCcCCCCCCCo...",
    "..oCcCCCCCCCo...",
    "..oCCcCCCCCLo...",
    "..oTTTCCCCTTo...",
    "...ooTTTTToo....",
]
LEGS_F = {
    'stand': ["....oGGooGGo....", "....oGGooGGo....", "....oGGooGGo....", "....oBBooBBo....", "....oBBooBBo....", "...oBBBooBBBo...", "...obbboobbbo...", "....ooo..ooo...."],
    'a':     ["....oGGooGGo....", "....oGGooGGo....", "....oGGooBBo....", "....oBBooBBo....", "....oBBoobbo....", "...oBBBo.oo.....", "...obbbo........", "....ooo........."],
    'b':     ["....oGGooGGo....", "....oGGooGGo....", "....oBBooGGo....", "....oBBooBBo....", "....obbooBBo....", ".....oo.oBBBo...", "........obbbo...", ".........ooo...."],
}
LEGS_S = {
    'stand': [".....oGGGGo.....", ".....oGGGGo.....", ".....oGGGGo.....", ".....oBBBBo.....", ".....oBBBBo.....", ".....oBBBBBo....", ".....obbbbbbo...", "......oooooo...."],
    'a':     ["....oGGGGGGo....", "....oGGooGGo....", "...oGGo..oGGo...", "...oBBo..oBBo...", "..oBBo...oBBo...", "..oBBo...oBBBo..", "..obbbo..obbbbo.", "...ooo....oooo.."],
    'b':     [".....oGGGGo.....", ".....oGGGGo.....", "....oGGGGGo.....", "....oBBoBBo.....", "...oBBooBBo.....", "...obbo.oBBBo...", "....oo..obbbbo..", ".........oooo..."],
}


def hexrgb(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def put(img, rows, x0, y0):
    for j, row in enumerate(rows):
        assert len(row) == 16, (len(row), row)
        for i, ch in enumerate(row):
            if ch != '.':
                img[y0 + j, x0 + i] = hexrgb(PAL[ch])


def staff(img, x, top, bottom, lantern_dx, sway=0, behind=None):
    """Pole with a small crook, and the lantern hanging from it."""
    px = []
    for y in range(top, bottom + 1):
        px.append((x, y, 'P' if (y % 5) else 'p'))
    lx = x + lantern_dx
    for xx in range(min(x, lx), max(x, lx) + 1):
        px.append((xx, top, 'P'))
    px.append((lx, top + 1, 'i'))
    lx += sway
    for dx in (-1, 0, 1):
        px.append((lx + dx, top + 2, 'i'))
        px.append((lx + dx, top + 3, 'A' if dx == 0 else 'a'))
        px.append((lx + dx, top + 4, 'A' if dx == 0 else 'a'))
        px.append((lx + dx, top + 5, 'a' if dx == 0 else 'i'))
    for (xx, yy, ch) in px:
        if behind is not None and behind[yy, xx, 3]:
            continue
        img[yy, xx] = hexrgb(PAL[ch])
    return (lx, top + 3)


def outline(img):
    a = img[..., 3] > 0
    nb = np.zeros_like(a)
    nb[1:] |= a[:-1]
    nb[:-1] |= a[1:]
    nb[:, 1:] |= a[:, :-1]
    nb[:, :-1] |= a[:, 1:]
    img[nb & ~a] = hexrgb(PAL['o'])


def frame(direction, step):
    img = np.zeros((48, 32, 4), np.uint8)
    bob = 1 if step in ('a', 'b') else 0
    sway = {'stand': 0, 'a': -1, 'b': 1}[step] if direction != 'side' else {'stand': 0, 'a': 1, 'b': 0}[step]
    body = {'down': FRONT, 'up': BACK, 'side': SIDE}[direction]
    legs = (LEGS_S if direction == 'side' else LEGS_F)[step]
    put(img, legs, 8, 38)
    put(img, body, 8, 8 + bob)
    if direction == 'down':
        lp = staff(img, 6, 4 + bob, 44, -2, sway, behind=img.copy())
        img[26 + bob, 6] = hexrgb(PAL['S'])
        img[27 + bob, 6] = hexrgb(PAL['s'])
        img[26 + bob, 7] = hexrgb(PAL['S'])
    elif direction == 'up':
        lp = staff(img, 25, 4 + bob, 44, 2, sway, behind=img.copy())
        img[26 + bob, 24] = hexrgb(PAL['S'])
        img[26 + bob, 25] = hexrgb(PAL['S'])
        img[27 + bob, 25] = hexrgb(PAL['s'])
    else:
        lp = staff(img, 23, 4 + bob, 44, 3, sway, behind=img.copy())
        img[27 + bob, 22] = hexrgb(PAL['S'])
        img[27 + bob, 23] = hexrgb(PAL['S'])
        img[28 + bob, 23] = hexrgb(PAL['s'])
    outline(img)
    return img, lp


CYCLE = ['stand', 'a', 'stand', 'b']
sheet = np.zeros((48 * 4, 32 * 4, 4), np.uint8)
lant = {}
for r, d in enumerate(['down', 'left', 'right', 'up']):
    for c, st in enumerate(CYCLE):
        if d in ('left', 'right'):
            img, lp = frame('side', 'stand' if st == 'stand' else ('a' if c == 1 else 'b'))
            if d == 'left':
                img = img[:, ::-1]
                lp = (31 - lp[0], lp[1])
        else:
            img, lp = frame(d, st)
        sheet[r * 48:(r + 1) * 48, c * 32:(c + 1) * 32] = img
        if c == 0:
            lant[d] = lp
os.makedirs(SITE, exist_ok=True)
Image.fromarray(sheet, 'RGBA').save(os.path.join(SITE, 'hero.png'), optimize=True)
bg = Image.new('RGBA', (128, 192), (93, 74, 102, 255))
bg.alpha_composite(Image.fromarray(sheet, 'RGBA'))
bg.resize((128 * 5, 192 * 5), Image.NEAREST).convert('RGB').save(os.path.join(WORK, 'hero_preview.png'))
print('hero ok; lantern pixel per direction', lant)
