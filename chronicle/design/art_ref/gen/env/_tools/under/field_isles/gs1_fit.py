"""幽霊船 甲板（ghost_ship_1、描き直し gen3）の当たりを絵から測った形で作る（fit.py の色の分類は甲板の板と船べりを分けられない）。
甲板の内側の縁（船べりの手すりの内側）を多角形にして、マスの中心が内なら歩ける 'u'。船尾楼・船首楼の手すりと階段、折れた帆柱・
舵輪・天窓・巻き上げ機・格子の昇降口・倒れた帆桁は、gen3.png に格子を重ねて読んだ位置（w_isles2 の作業、2026-09-30）。
usage: python3 gs1_fit.py -> ghost_ship_1/layout.json の rows_fit"""
import json
d = json.load(open('ghost_ship_1/layout.json')); W, H = d['w'], d['h']
top = [(5.0, 7.0), (37.0, 7.0), (40.0, 8.3), (44.0, 9.7), (48.0, 11.6), (51.4, 13.9)]
bot = [(5.0, 21.0), (36.0, 21.0), (40.0, 20.1), (44.0, 19.2), (48.0, 16.8), (51.4, 14.3)]


def edge(pts, x):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return None


g = [['~'] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        cx, cy = x + 0.5, y + 0.5
        if cx < 6.3: continue
        t, b = edge(top, cx), edge(bot, cx)
        if t is None or b is None: continue
        if t < cy < b: g[y][x] = 'u'
for (x, y) in [(6, 7), (6, 20)]: g[y][x] = 'X'          # 船尾の丸い角
for x in range(5, 52):                                     # 下の船べり（手すり、渡り板の口は開ける）
    if g[20][x] == 'u' and g[21][x] == '~': g[21][x] = 'X'
for x in range(6, 38): g[21][x] = 'X'
solid = []
solid += [(x, y) for x in (14, 15) for y in range(9, 19)]          # 船尾楼の手すり（階段は y 7・8 と 19・20）
solid += [(x, y) for x in (44, 45) for y in range(13, 18)]         # 船首楼の手すり（階段は y 10〜12 と 18・19）
solid += [(7, 14), (8, 14), (10, 14), (11, 14)]                    # 舵輪・天窓
solid += [(18, 14), (18, 15), (19, 15), (22, 12), (22, 13), (32, 13), (32, 14), (33, 14), (42, 13), (42, 14)]   # 折れた帆柱 4
solid += [(24, 10), (25, 10), (26, 10), (25, 11), (26, 11)]        # 下へのはしごの口（24,11 は階段の物）
solid += [(x, y) for x in range(34, 38) for y in (16, 17)]         # 格子の昇降口
solid += [(x, 19) for x in range(20, 28)]                          # 倒れた帆桁
solid += [(48, 14)]                                                # 巻き上げ機
for (x, y) in solid: g[y][x] = 'X' if g[y][x] != '~' else '~'
for (x, y) in [(28, y) for y in range(21, 26)] + [(29, y) for y in range(21, 26)]: g[y][x] = '='   # 渡り板
g[21][28] = g[21][29] = 'u'
for (x, y) in [(24, 11), (24, 12), (8, 9), (46, 15), (28, 20), (10, 13)]: assert g[y][x] in 'u=', (x, y, g[y][x])
d['rows_fit'] = [''.join(r) for r in g]
json.dump(d, open('ghost_ship_1/layout.json', 'w'), ensure_ascii=False, indent=0)
# 届くか
from collections import deque
seen = {(28, 25)}; q = deque([(28, 25)])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        i, j = x + dx, y + dy
        if 0 <= i < W and 0 <= j < H and (i, j) not in seen and g[j][i] in 'u=': seen.add((i, j)); q.append((i, j))
walk = [(x, y) for y in range(H) for x in range(W) if g[y][x] in 'u=']
print('walk', len(walk), 'unreached', [p for p in walk if p not in seen])
print('\n'.join('%2d %s' % (y, r) for y, r in enumerate(d['rows_fit'][4:24], 4)))
