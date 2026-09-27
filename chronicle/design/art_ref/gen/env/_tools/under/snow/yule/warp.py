"""apply warp.json (vertical) to the generation-scale image -> warped.png (same size)"""
import sys, json, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
S = np.asarray(Image.open(src).convert('RGB'))
Hs = S.shape[0]; H1 = 50 * 32; k = Hs / H1
wp = np.array(json.load(open('warp.json')))
rows = np.arange(Hs)
gy = rows / k
py = np.interp(gy, np.arange(H1), wp) * k
idx = np.clip(np.rint(py).astype(int), 0, Hs - 1)
Image.fromarray(S[idx]).save(out)
print('warped', out)
