"""マゼンタの背景で作った手前の層（bbg/<id>_front.png）の背景を抜いて透明にする（その場で書き換え、.gen.json に keyed を記す）。
   python3 key_front.py <id> [...]
   手前の層は夜の暗い紫青の影絵なので、マゼンタ寄りの画素はつながりに関係なくすべて背景（柵の間・樽の取っ手の穴も抜く）。"""
import sys, os, json
import numpy as np
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from envlib import load, save
D = '/home/user/others/chronicle/design/art_ref/gen/env/bbg/'
for bid in sys.argv[1:]:
    p = D + bid + '_front.png'
    a = load(p, 'RGBA')
    if a[..., 3].min() < 250 and (a[..., 3] == 0).mean() > 0.3:
        # もう抜いてある: 残ったマゼンタだけ見る
        pass
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mg = np.minimum(r, b) - g
    # マゼンタ（と、ふちで暗い色と混ざったマゼンタ）: 赤と青がそろって緑よりずっと強い
    m = ((mg > 70) & (np.abs(r - b) < 90)) | (a[..., 3] < 128)
    m = ndimage.binary_opening(m, iterations=1) | ((mg > 120) & (np.abs(r - b) < 70)) | (a[..., 3] < 128)
    # ふちの 1 画素の帯でマゼンタ寄りの色（混ざり）も抜く
    edge = ndimage.binary_dilation(m, iterations=2) & ~m & (mg > 25) & (r > g + 25) & (b > g + 25)
    m = m | edge
    a[..., 3] = np.where(m, 0, 255)
    a[m, :3] = 0
    save(a, p)
    j = json.load(open(D + bid + '_front.gen.json')); j['keyed'] = 'magenta -> transparent (key_front.py)'
    json.dump(j, open(D + bid + '_front.gen.json', 'w'), ensure_ascii=False, indent=1)
    print(bid, 'keyed', round(float(m.mean()), 3), 'transparent')
