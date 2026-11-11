"""Register each 3x tile onto the current map's geometry, bring it to 2x and stitch all tiles along low-difference seams.
usage: stitch.py DIR  (reads full1x.png, g_JI.png; writes full2x.png, seams.png)"""
import sys, subprocess, numpy as np, cv2
from PIL import Image
sys.path.insert(0, '/home/user/others/chronicle2/twilight/build/blockout')
from warp import fit
D = sys.argv[1]
TW, TH = 1088, 800; XS = [0, 832]; YS = [0, 495, 990]
full = Image.open(f'{D}/full1x.png').convert('RGB'); FW, FH = full.size
tiles = {}
for j, y0 in enumerate(YS):
    for i, x0 in enumerate(XS):
        g = Image.open(f'{D}/g_{j}{i}.png').convert('RGB')
        old2 = full.crop((x0, y0, x0 + TW, y0 + TH)).resize((TW * 2, TH * 2), Image.NEAREST); old2.save(f'{D}/o2_{j}{i}.png')
        g.resize((TW * 2, TH * 2), Image.BOX).save(f'{D}/d2_{j}{i}.png')
        subprocess.run(['python3', '/home/user/others/chronicle2/twilight/build/blockout/match.py', f'{D}/o2_{j}{i}.png', f'{D}/d2_{j}{i}.png', f'{D}/pts_{j}{i}.npy', '200'], check=True, capture_output=True)
        DX, DY, _ = fit(np.load(f'{D}/pts_{j}{i}.npy'), TH * 2, TW * 2, quiet=True)
        print(j, i, 'shift p95', round(float(np.percentile(np.abs(DX), 95)), 1), round(float(np.percentile(np.abs(DY), 95)), 1))
        # pull the 3x picture onto the old geometry (nearest, so no new colours), then down to 2x
        H3, W3 = TH * 3, TW * 3
        DX3 = cv2.resize(DX, (W3, H3)) * 1.5; DY3 = cv2.resize(DY, (W3, H3)) * 1.5
        xx, yy = np.meshgrid(np.arange(W3, dtype=np.float32), np.arange(H3, dtype=np.float32))
        a = cv2.remap(np.array(g), xx + DX3.astype(np.float32), yy + DY3.astype(np.float32), cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE)
        tiles[(j, i)] = np.array(Image.fromarray(a).resize((TW * 2, TH * 2), Image.BOX)).astype(np.int16)
def seam_v(a, b):          # a left, b right, same shape: column per row where b starts
    c = np.abs(a - b).sum(2).astype(np.float64); H, W = c.shape
    c[:, :24] += 1e5; c[:, -24:] += 1e5           # keep away from the tile borders
    acc = c.copy(); back = np.zeros((H, W), np.int8)
    for y in range(1, H):
        p = acc[y - 1]; l = np.r_[np.inf, p[:-1]]; r = np.r_[p[1:], np.inf]
        st = np.stack([l, p, r]); k = st.argmin(0); acc[y] += st.min(0); back[y] = k - 1
    s = np.zeros(H, int); s[-1] = int(acc[-1].argmin())
    for y in range(H - 1, 0, -1): s[y - 1] = s[y] + back[y, s[y]]
    return s
def join_h(A, B, ov):      # B overlaps the last ov columns of A
    s = seam_v(A[:, -ov:], B[:, :ov]); H = A.shape[0]
    out = np.concatenate([A, B[:, ov:]], 1); m = np.zeros(out.shape[:2], np.uint8)
    for y in range(H): out[y, A.shape[1] - ov + s[y]:A.shape[1]] = B[y, s[y]:ov]; m[y, A.shape[1] - ov + s[y]] = 1
    return out, m
rows = []; ovx = (XS[0] + TW - XS[1]) * 2
seams = np.zeros((FH * 2, FW * 2), np.uint8)
for j in range(3):
    r, m = join_h(tiles[(j, 0)], tiles[(j, 1)], ovx); rows.append(r); seams[YS[j] * 2:YS[j] * 2 + TH * 2] |= m
out = rows[0]
for j in range(1, 3):
    ov = out.shape[0] - YS[j] * 2
    o2, m = join_h(out[-ov:].transpose(1, 0, 2).copy() if False else out.transpose(1, 0, 2), rows[j].transpose(1, 0, 2), ov)
    out = o2.transpose(1, 0, 2); seams[:out.shape[0]] |= m.T[:out.shape[0]]
out = np.clip(out, 0, 255).astype(np.uint8)
print('size', out.shape)
Image.fromarray(out).save(f'{D}/full2x.png'); Image.fromarray(seams * 255).save(f'{D}/seams.png')
