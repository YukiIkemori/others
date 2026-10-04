"""Fitted rows + art of the painted floors of 忘却の底 -> v2/src/maps/oblivion_painted_rows.js (R.Oblivion.PAINTED[id] = {rows, art}),
read by v2/src/maps/oblivion.js. Chars stay the layout chars (dng_oblivion.py; the map file's legend reads them).
usage: python3 put_rows.py <id> [...]   (ids not given keep their current entry)"""
import json, sys, os, re
V2 = '/home/user/others/chronicle/v2'
P = os.path.join(V2, 'src/maps/oblivion_painted_rows.js')
cur = {}
if os.path.exists(P):
    m = re.search(r'/\*DATA\*/(.*?)/\*END\*/', open(P).read(), re.S)
    if m: cur = json.loads(m.group(1))
for mid in sys.argv[1:]:
    d = json.load(open(mid + '/layout.json'))
    rows = d.get('rows_fit') or d['rows']
    und = os.path.join(V2, 'assets/env/oblivion/under/')
    art = {'image': 'oblivion/under/' + mid, 'painted': []}
    if os.path.exists(und + mid + '_over@32.png'): art['overlay'] = 'oblivion/under/' + mid + '_over'
    cur[mid] = dict(rows=list(rows), art=art)
out = """// 生成物（design/art_ref/gen/env/_tools/under/oblivion/ の dng_oblivion.py → gen.sh → fit.py → process.py → put_rows.py）。手で直さない。
// 忘却の底（クリア後のダンジョン oblivion_1〜5）の描いた下絵に合わせた当たり（rows、字は dng_oblivion.py と同じ）と絵（art）。
// maps/oblivion.js が R.Oblivion.PAINTED[id] を読む。
(function (R) {
  'use strict';
  const O = (R.Oblivion = R.Oblivion || {});
  O.PAINTED = /*DATA*/""" + json.dumps(cur, ensure_ascii=False, indent=1) + """/*END*/;
})(window.RPG);
"""
open(P, 'w').write(out)
print(P, sorted(cur))
