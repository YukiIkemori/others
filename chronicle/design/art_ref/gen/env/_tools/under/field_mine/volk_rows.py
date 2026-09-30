"""(2026-09-30) ヴォルクの当たりを描いた絵（volk/gen1b.png = gen1 + 沢の小さな橋を焼いた物）から手で作る（fit.py は下絵の案からのずれが大きすぎて
追いつかなかった: 宿・大鍛冶場・家が絵では案より 1 行ずつ大きい）。layout.json の rows_fit と meta.blds を書く。usage: python3 volk_rows.py"""
import json
W, H = 32, 28
g = [['R'] * W for _ in range(H)]
def put(x, y, c):
    if 0 <= x < W and 0 <= y < H: g[y][x] = c
def rect(x, y, w, h, c):
    for j in range(y, y + h):
        for i in range(x, x + w): put(i, j, c)
# 谷底の草地（絵の草の縁）
rect(7, 3, 15, 1, ',')
rect(2, 4, 20, 21, ',')            # 西と中（沢の西）
rect(21, 9, 9, 16, ',')            # 東の岸
rect(22, 4, 6, 5, ',')             # 滝つぼのまわり（下で水）
# 沢（滝 → 滝つぼ → 南西）
rect(23, 0, 4, 4, 'X')             # 滝（描いた物）
rect(22, 4, 6, 5, 'w')
for y in range(9, 14): rect(21, y, 3, 1, 'w')
rect(21, 14, 3, 1, '=')            # 焼いた小さな橋
for (y, x0, x1) in [(15, 21, 23), (16, 21, 22), (17, 21, 22), (18, 20, 22), (19, 20, 22), (20, 18, 21), (21, 18, 21), (22, 16, 20), (23, 16, 20), (24, 14, 17), (25, 13, 15), (26, 13, 15), (27, 13, 15)]:
    rect(x0, y, x1 - x0 + 1, 1, 'w')
# 建物（描いた敷地）と戸口
blds = [('volk_inn', 3, 4, 8, 8, (6, 11)), ('volk_forge', 12, 7, 9, 7, (17, 13)), ('volk_house', 3, 17, 6, 5, (5, 21)), ('volk_elder', 23, 16, 6, 5, (26, 20))]
for bid, x, y, w, h, d in blds:
    rect(x, y, w, h, 'X'); put(d[0], d[1], 'c')
# 石段（北西の崖）: 上の 3 マスは描いた石段、足もと (6,3) が戸口
rect(6, 0, 1, 3, 'X'); put(6, 3, 'c')
# 庭の石畳・金床・水車・研ぎ車・祠
rect(14, 14, 7, 5, 'c'); put(15, 16, 'X')
rect(20, 15, 1, 2, 'X'); put(20, 14, '=')
# 研ぎ車（27,21）は小さい: 当たりにしない（老鍛冶の家の前へ東の岸から回れるように）
rect(27, 11, 2, 1, 'X')
# 木と岩
rect(5, 23, 4, 2, 'T'); rect(27, 22, 4, 3, 'T'); rect(28, 6, 3, 4, 'T')
for (x, y) in [(3, 13), (10, 13), (24, 9), (24, 10), (24, 11), (24, 12)]: put(x, y, 'r')
# 南の吊り橋（出口）と崖の縁
rect(2, 25, 30, 3, 'R'); rect(9, 25, 2, 3, '='); rect(13, 25, 3, 3, 'w')
rect(29, 4, 3, 5, 'R'); rect(30, 9, 2, 16, 'R')
d = json.load(open('volk/layout.json'))
d['rows_fit'] = [''.join(r) for r in g]
d['meta']['blds'] = [dict(id=b, x=x, y=y, w=w, h=h, door=list(dd)) for b, x, y, w, h, dd in blds]
json.dump(d, open('volk/layout.json', 'w'), ensure_ascii=False, indent=0)
for y, r in enumerate(d['rows_fit']): print('%2d' % y, r)
