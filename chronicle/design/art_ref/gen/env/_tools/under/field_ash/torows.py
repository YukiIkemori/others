"""Fitted rows of a repainted volcano floor (dng_ash.py -> fit.py) in the map's VOLCANO legend, as a JS array literal to paste into
v2/src/maps/ash_volcano.js. usage: python3 torows.py ash_volcano_2"""
import json, sys, os
MAP = {'R': '#', 'r': '#', 'T': '#', 'b': '#', '~': '%', 'w': '%', 'l': '%', 's': '.', 'u': '.', ':': '.', '.': '.', ',': '.', ';': '.', 'c': '.', '_': '.', '=': '.', 'k': 'o', 'X': 'X'}
for mid in sys.argv[1:]:
    d = json.load(open(mid + '/layout.json'))
    rows = [list(r) for r in (d.get('rows_fit') or d['rows'])]
    fx = json.load(open(mid + '/fix.json')) if os.path.exists(mid + '/fix.json') else {}
    for q in fx.get('solid', []): rows[q[1]][q[0]] = q[2] if len(q) > 2 else 'X'
    out = [''.join(MAP[c] for c in r) for r in rows]
    print('      const ROWS = [')
    for r in out: print('        %s,' % json.dumps(r))
    print('      ];')
