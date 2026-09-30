"""Fitted rows + art of the painted towns / dungeon floors -> v2/src/maps/mine_painted_rows.js (R.Mine.PAINTED[id] = {rows, art, blds}),
read by the hand-written map files (mine_dovan.js, mine_deep.js). Chars stay the lib chars
(the map files use R.Isles.kit legends). usage: python3 put_rows.py <id> [...]   (ids not given keep their current entry)"""
import json, sys, os, re
V2 = '/home/user/others/chronicle/v2'
P = os.path.join(V2, 'src/maps/mine_painted_rows.js')
cur = {}
if os.path.exists(P):
    s = open(P).read()
    m = re.search(r'/\*DATA\*/(.*?)/\*END\*/', s, re.S)
    if m: cur = json.loads(m.group(1))
for mid in sys.argv[1:]:
    d = json.load(open(mid + '/layout.json'))
    rows = [list(r) for r in (d.get('rows_fit') or d['rows'])]
    fx = json.load(open(mid + '/fix.json')) if os.path.exists(mid + '/fix.json') else {}
    for q in fx.get('solid', []): rows[q[1]][q[0]] = q[2] if len(q) > 2 else 'X'
    und = os.path.join(V2, 'assets/env/mine/under/')
    art = {'image': 'mine/under/' + mid, 'painted': []}
    if os.path.exists(und + mid + '_over@32.png'): art['overlay'] = 'mine/under/' + mid + '_over'
    if os.path.exists(und + mid + '_closed@32.png'): art['closed'] = 'mine/under/' + mid + '_closed'
    cur[mid] = dict(rows=[''.join(r) for r in rows], art=art, blds=(d.get('meta') or {}).get('blds', []))
out = """// 生成物（design/art_ref/gen/env/_tools/under/field_mine/ の areas_mine.py・dng_mine.py → fit.py → put_rows.py）。手で直さない。
// 描いた下絵に合わせた鉱山都市ドヴァンと深き坑道の当たり（rows、字は field_mine/lib.py と同じ）・絵（art）・建物の敷地と戸口（blds）。
// mine_dovan.js・mine_deep.js が R.Mine.PAINTED[id] を読む。
(function (R) {
  'use strict';
  const I = (R.Mine = R.Mine || {});
  I.PAINTED = /*DATA*/""" + json.dumps(cur, ensure_ascii=False, indent=1) + """/*END*/;
})(window.RPG);
"""
open(P, 'w').write(out)
print(P, sorted(cur))
