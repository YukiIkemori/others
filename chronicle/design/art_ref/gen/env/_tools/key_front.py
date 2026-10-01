"""マゼンタの背景で作った手前の層（bbg/<id>_front.png）の背景を抜いて透明にする（その場で書き換え、.gen.json に keyed を記す）。
   python3 key_front.py <id> [...]
   ほぼ純色のマゼンタはつながりに関係なく背景（柵の間・樽の取っ手の穴も抜く）。ふちの混ざりは背景に接する所だけ。"""
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
    # 背景のマゼンタ: ほぼ純色（赤と青が強く、緑が弱い）。柵の間・取っ手の穴のような閉じた所もこれで抜ける
    core = ((r > 170) & (b > 170) & (g < 100) & (np.abs(r - b) < 70)) | (a[..., 3] < 128)
    # ふちの混ざり（暗い色とマゼンタの間の色）は、背景に 2 画素以内で接している所だけ抜く（物の中の桃色の貝などは残す）
    edge = ndimage.binary_dilation(core, iterations=2) & ~core & (mg > 40) & (np.abs(r - b) < 90)
    m = core | edge
    a[..., 3] = np.where(m, 0, 255)
    a[m, :3] = 0
    save(a, p)
    j = json.load(open(D + bid + '_front.gen.json')); j['keyed'] = 'magenta -> transparent (key_front.py)'
    json.dump(j, open(D + bid + '_front.gen.json', 'w'), ensure_ascii=False, indent=1)
    print(bid, 'keyed', round(float(m.mean()), 3), 'transparent')
