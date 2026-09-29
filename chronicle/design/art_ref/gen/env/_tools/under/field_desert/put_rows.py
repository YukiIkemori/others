"""Fitted rows of the painted desert camps / mirage back into the game: v2/src/maps/desert_painted_rows.js (generated; do not edit by hand).
The map files (desert_camps.js, desert_optional.js) take R.Desert.PAINTED[id].rows / .art when present.
Chars go back to the desert legend (desert_00_kit.js K.LEGEND): a solid cell keeps its old solid char (rock m / sandstone X), new solids are rock m.
usage: python3 put_rows.py <map id> [...]   (all ids already in the file are kept)"""
import json, sys, os, re
V2 = '/home/user/others/chronicle/v2'
OUT = os.path.join(V2, 'src/maps/desert_painted_rows.js')
SRC = json.load(open('camps_rows.json'))
WALK = {'u': 'u', 's': 's', 'k': 'k', '.': 'd', ':': 'd', ',': 'g', ';': 'u', '"': 'g', 'c': 'Q', '_': '_', '=': 'd'}
have = {}
if os.path.exists(OUT):
    m = re.search(r'/\*DATA\*/(.*)/\*END\*/', open(OUT).read(), re.S)
    if m: have = json.loads(m.group(1))
for mid in sys.argv[1:]:
    d = json.load(open(mid + '/layout.json')); fit = d.get('rows_fit') or d['rows']; old = SRC[mid]['rows']
    rows = []
    for y, r in enumerate(fit):
        s = ''
        for x, ch in enumerate(r):
            o = old[y][x]
            if ch in WALK: s += WALK[ch] if o not in 'mXxw' else 's'
            elif ch in '~w': s += 'w'
            else: s += o if o in 'mXx' else 'm'
        rows.append(s)
    have[mid] = {'rows': rows, 'art': {'image': 'desert/under/' + mid, 'painted': []}}
    if os.path.exists(os.path.join(V2, 'assets/env/desert/under/%s_closed@32.png' % mid)): have[mid]['art']['closed'] = 'desert/under/%s_closed' % mid
body = json.dumps(have, ensure_ascii=False, indent=1)
open(OUT, 'w').write("""// 生成物（design/art_ref/gen/env/_tools/under/field_desert/ の camps.py → fit.py → put_rows.py）。手で直さない。
// 描いた下絵に合わせた野営地・しんきろうの市の当たり（rows）と絵（art）。desert_camps.js・desert_optional.js が R.Desert.PAINTED[id] を読む。
(function (R) {
  'use strict';
  const D = (R.Desert = R.Desert || {});
  D.PAINTED = /*DATA*/%s/*END*/;
})(window.RPG);
""" % body)
print(OUT, list(have))
