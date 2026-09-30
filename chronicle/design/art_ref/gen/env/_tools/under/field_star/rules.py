"""Rule-based first labels of a painting's cells (independent of the layout), for fit.py's classifier seed. Prints a preview.
usage: python3 rules.py <id> <gen.png> [out.png]"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
def labels(A, W, H, T=32):
    lum = A @ np.array([0.299, 0.587, 0.114])
    C4 = lambda a: a.reshape(H, T, W, T)
    dark = C4((lum < 58).astype(float)).mean((1, 3))
    blue = C4(((A[..., 2] > A[..., 1] + 6) & (A[..., 2] > A[..., 0] + 18)).astype(float)).mean((1, 3))
    tan = C4(((A[..., 0] > A[..., 1]) & (A[..., 1] > A[..., 2] + 12) & (lum > 110)).astype(float)).mean((1, 3))
    grey = C4(((np.abs(A[..., 0] - A[..., 1]) < 14) & (np.abs(A[..., 1] - A[..., 2]) < 14) & (lum > 70)).astype(float)).mean((1, 3))
    lab = np.full((H, W), '', dtype=object)
    lab[(dark < 0.14) & (blue < 0.2)] = 'ground'
    lab[(tan > 0.45)] = 'ground'
    lab[(dark > 0.34) & (blue < 0.2) & (tan < 0.2)] = 'tree'
    lab[blue > 0.4] = 'water'
    lab[(grey > 0.45) & (blue < 0.2)] = 'rock'
    return lab, dict(dark=dark, blue=blue, tan=tan, grey=grey)
if __name__ == '__main__':
    aid, src = sys.argv[1], sys.argv[2]
    d = json.load(open(aid + '/layout.json')); W, H = d['w'], d['h']
    A = np.asarray(Image.open(src).convert('RGB').resize((W * 32, H * 32), Image.BOX)).astype(float)
    lab, f = labels(A, W, H)
    im = Image.fromarray(A.astype(np.uint8)).convert('RGBA'); ov = Image.new('RGBA', im.size); g = ImageDraw.Draw(ov)
    col = {'ground': (0, 255, 0, 60), 'tree': (255, 0, 0, 80), 'water': (0, 0, 255, 90), 'rock': (255, 255, 0, 90)}
    for y in range(H):
        for x in range(W):
            if lab[y, x]: g.rectangle([x * 32, y * 32, x * 32 + 31, y * 32 + 31], fill=col[lab[y, x]])
    Image.alpha_composite(im, ov).resize((W * 20, H * 20)).save(sys.argv[3] if len(sys.argv) > 3 else aid + '/rules.png')
