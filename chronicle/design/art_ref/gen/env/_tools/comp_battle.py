"""Battle background preview composite (mimics the BSCENE order with the new layers)."""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
ENV = '/home/user/others/chronicle/v2/assets/env/bbg/'
SPR = '/home/user/others/chronicle/v2/assets/sprites/hero_m_warrior/'

def L(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255.0

def over(dst, src, x=0, y=0):
    h, w = src.shape[:2]
    H, W = dst.shape[:2]
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    a = s[..., 3:4]
    dst[y0:y1, x0:x1, :3] = dst[y0:y1, x0:x1, :3] * (1 - a) + s[..., :3] * a

def radial(W, H, cx, cy, rx, ry, p=1.6):
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return np.clip(1 - d, 0, 1) ** p

def comp(bid, out, tall=False, sprite=True):
    sfx = '_tall' if tall else ''
    W, H = (540, 643) if tall else (960, 540)
    back = L(ENV + bid + '/back%s.png' % sfx); ground = L(ENV + bid + '/ground%s.png' % sfx); lit = L(ENV + bid + '/ground_lit%s.png' % sfx)
    post = L(ENV + bid + '/post%s.png' % sfx)
    img = back[..., :4].copy(); img[..., 3] = 1
    over(img, ground)
    if tall:
        k = W / 540; lan = (300 * k, 236 * 643 / 540 + 170)
        party = [[350, 400], [436, 423], [385, 465], [465, 495]]
    else:
        lan = (505, 386); party = [[575, 338], [668, 361], [616, 395], [726, 425]]
    m = radial(W, H, lan[0], lan[1], 210, 120, 1.3)[..., None] * lit[..., 3:4]
    img[..., :3] = img[..., :3] * (1 - m) + lit[..., :3] * m
    # actors
    if sprite:
        sheet = L(SPR + 'battle.png'); cell = (130, 87); anc = (68, 84)
        fr = sheet[0:87, 0:130]
        for i, (px, py) in enumerate(party):
            # long shadow away from the lantern
            sh = np.zeros((H, W)); dx, dy = px - lan[0], py - lan[1]; n = max(1, np.hypot(dx, dy))
            for t in np.linspace(0, 1, 40):
                cx, cy = px + dx / n * 60 * t, py + dy / n * 22 * t + 1
                sh += radial(W, H, cx, cy, 10, 3.5, 1.0) * (1 - t) * 0.12
            img[..., :3] *= (1 - np.clip(sh, 0, 0.55))[..., None]
            f = fr.copy()
            dist = np.hypot(px - lan[0], (py - lan[1]) * 1.6)
            warm = np.clip(1 - dist / 260, 0.15, 1)
            f[..., :3] = f[..., :3] * (np.array([0.62, 0.62, 0.8]) * (1 - warm) + np.array([1.08, 0.96, 0.8]) * warm)
            over(img, f, int(px - anc[0]), int(py - anc[1]))
    # lantern
    img[..., :3] += radial(W, H, lan[0], lan[1] - 9, 120, 90, 2.2)[..., None] * np.array([1.0, 0.72, 0.4]) * 0.45
    img[..., :3] += radial(W, H, lan[0], lan[1] - 9, 16, 16, 1.2)[..., None] * np.array([1.0, 0.95, 0.8]) * 0.9
    ln = np.zeros((14, 8, 4)); ln[..., 3] = 1; ln[..., :3] = [0.12, 0.1, 0.12]; ln[3:11, 1:7, :3] = [1.0, 0.92, 0.7]
    over(img, ln, int(lan[0] - 4), int(lan[1] - 14))
    fp = ENV + bid + '/front%s.png' % sfx
    if os.path.exists(fp):
        f = L(fp); fs = np.stack([ndimage.gaussian_filter(f[..., c] * (f[..., 3] if c < 3 else 1), 2.2) for c in range(4)], -1)
        fs[..., :3] /= np.maximum(fs[..., 3:4], 1e-3)
        over(img, fs)
    img[..., :3] += post[..., :3] * post[..., 3:4] * 0.8
    rs = np.random.RandomState(5)
    for _ in range(18):
        x, y = rs.uniform(0, W), rs.uniform(H * 0.4, H * 0.95)
        c = np.array([1.0, 0.8, 0.45]) if rs.rand() < 0.5 else np.array([0.55, 1.0, 0.9])
        img[..., :3] += radial(W, H, x, y, 5, 5, 2.0)[..., None] * c * 0.6
    img[..., :3] *= (0.55 + 0.45 * (1 - radial(W, H, W / 2, H / 2, W * 0.75, H * 0.85, 1.0) * 0 - np.clip(((np.mgrid[0:H, 0:W][1] - W / 2) / (W * 0.62)) ** 2 + ((np.mgrid[0:H, 0:W][0] - H / 2) / (H * 0.7)) ** 2, 0, 1) * 1.0))[..., None]
    o = Image.fromarray((np.clip(img[..., :3], 0, 1) * 255).astype(np.uint8)).resize((W * 2, H * 2), Image.NEAREST)
    o.save(out)
    return out

if __name__ == '__main__':
    comp(sys.argv[1], sys.argv[2], tall='--tall' in sys.argv)
