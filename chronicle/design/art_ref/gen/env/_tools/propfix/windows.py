import lib, classify
WSZ = [(32, 21), (21, 21), (21, 32)]
def plan(mid, margin=1.5):
    m = lib.MAPS[mid]; W, H = m['w'], m['h']
    dec, _ = classify.classify(mid)
    pts = [(o['x'], o['y'], o) for o, _ in dec]
    todo = set(range(len(pts))); wins = []
    while todo:
        best = None
        for (ww, wh) in WSZ:
            for y0 in range(min(0, H - wh), max(1, H - wh + 1)):
                for x0 in range(min(0, W - ww), max(1, W - ww + 1)):
                    cov = [i for i in todo if x0 + margin <= pts[i][0] + 0.5 <= x0 + ww - margin and y0 + margin + 1 <= pts[i][1] + 0.5 <= y0 + wh - margin]
                    sc = len(cov) - (0.001 * ww * wh)
                    if not best or sc > best[0]: best = (sc, (x0, y0, ww, wh), cov)
        if not best[2]:
            print('uncoverable', [pts[i][2]['id'] for i in todo]); break
        wins.append((best[1], [pts[i][2] for i in best[2]])); todo -= set(best[2])
    return wins
if __name__ == '__main__':
    tot = 0
    for mid in lib.MAPS:
        ws = plan(mid); tot += len(ws)
        print(mid, lib.MAPS[mid]['w'], lib.MAPS[mid]['h'], [(w, len(c)) for w, c in ws])
    print('total windows', tot)
