"""Write the game map file of a SNOW FIELD area from <id>/layout.json: v2/src/maps/snow_field_<short>.js (generated; do not edit by hand)
and its Japanese strings into v2/src/i18n/ja/maps_snow.js (the block between the snow_field markers, rewritten each time).
Same rules as ../../field/tomap.py (rows_fit, fix.json objects/spawns/drop_exits/solid/objects_add, lamps moved beside the road).
usage: python3 tomap.py <id> [...]"""
import json, sys, os, re
V2 = '/home/user/others/chronicle/v2'
JA = os.path.join(V2, 'src/i18n/ja/maps_snow.js')
B0, B1 = '    // ---- snow_field（生成物: design/art_ref/gen/env/_tools/under/snow/field/tomap.py。手で直さない）', '    // ---- snow_field ここまで'


def js(v):
    s = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    return re.sub(r'"@@T:([^@]+)@@"', lambda m: "R.T('%s')" % m.group(1), s)


def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


strings = {}
if os.path.exists(JA):
    t = open(JA).read()
    if B0 in t:
        blk = t[t.index(B0) + len(B0):t.index(B1)]
        for m in re.finditer(r"^    '(map\.snow_field\.[^']+)': (.+),$", blk, re.M):
            strings[m.group(1)] = m.group(2)

for aid in sys.argv[1:]:
    d = json.load(open(aid + '/layout.json'))
    M = d['meta']
    short = aid[2:] if aid.startswith('f_') else aid
    P = 'map.snow_field.' + short
    for k in [k for k in strings if k.startswith(P + '.')]: del strings[k]

    def T(key, val):
        k = P + '.' + key
        strings[k] = q(val) if isinstance(val, str) else '[' + ', '.join(q(v) for v in val) + ']'
        return '@@T:%s@@' % k
    rows = d.get('rows_fit') or d['rows']
    painted, objects = list(d.get('painted_extra') or []), []
    fx = json.load(open(aid + '/fix.json')) if os.path.exists(aid + '/fix.json') else {}
    for mv in fx.get('objects', []):
        for o in d['objects']:
            if all(o.get(k) == v for k, v in mv['match'].items()): o.update(mv['set'])
    for k, v in fx.get('spawns', {}).items(): d['spawns'][k] = v
    rows = [list(r) for r in rows]
    for qq in fx.get('solid', []): rows[qq[1]][qq[0]] = qq[2] if len(qq) > 2 else 'X'
    rows = [''.join(r) for r in rows]
    d['exits'] = [e for e in d['exits'] if e.get('edge') not in set(fx.get('drop_exits', []))]
    d['objects'] = d['objects'] + list(fx.get('objects_add', []))
    WALKC, ROADC = set(',;".:s_=c'), set('.:c=')
    H_, W_ = len(rows), len(rows[0])
    taken = {(o['x'], o['y']) for o in d['objects']}

    def good(x, y):
        if not (2 <= x < W_ - 2 and 2 <= y < H_ - 2) or rows[y][x] in ROADC or (x, y) in taken: return False
        if any(rows[y + j][x + i] not in WALKC for i in range(-2, 3) for j in range(-2, 3)): return False
        return any(rows[y + j][x + i] in ROADC for i in range(-2, 3) for j in range(-2, 3))
    for o in d['objects']:
        if o.get('type') in ('waylamp',) or o.get('id') in ('lamp_post', 'snow_lamp'):
            if good(o['x'], o['y']): continue
            c = sorted(((abs(x - o['x']) + abs(y - o['y']), x, y) for y in range(H_) for x in range(W_) if good(x, y)))
            if c and c[0][0] <= 8:
                taken.discard((o['x'], o['y'])); o['x'], o['y'] = c[0][1], c[0][2]; taken.add((o['x'], o['y']))
    for i, o in enumerate(d['objects']):
        if o.get('type') == 'none_removed': continue
        o = dict(o)
        p = o.pop('painted', None)
        if p: painted.append('%s@%d,%d' % (p, o['x'], o['y']))
        if 'text' in o: o['text'] = T('objects.%d.text' % i, o['text'])
        objects.append(o)
    npcs = []
    for n in M.get('npcs', []):
        n = json.loads(json.dumps(n))
        n['name'] = T('%s.name' % n['id'], n['name'])
        if isinstance(n.get('talk'), dict):
            for j, L in enumerate(n['talk'].get('lines', [])): L['text'] = T('%s.lines.%d' % (n['id'], j), L['text'])
        npcs.append(n)
    exits = [{k: v for k, v in e.items() if k != 'edge'} for e in d['exits'] + fx.get('exits', [])]
    has_over = os.path.exists(os.path.join(V2, 'assets/env/field/under/%s_over@32.png' % aid))
    art = {'image': 'field/under/' + aid, 'painted': painted}
    if has_over: art['overlay'] = 'field/under/%s_over' % aid
    if os.path.exists(os.path.join(V2, 'assets/env/field/under/%s_closed@32.png' % aid)): art['closed'] = 'field/under/%s_closed' % aid
    edges = ', '.join('%s → %s.%s' % (e['edge'], e['to']['map'], e['to']['spawn']) for e in d['exits'])
    extra = ''
    for k in ('weather', 'weatherCond', 'bbg'):
        if M.get(k): extra += '    %s: %s,\n' % (k, js(M[k]))
    out = f"""// 生成物（design/art_ref/gen/env/_tools/under/snow/field/ の areas.py → fit.py → tomap.py）。手で直さない: 配置は areas.py、当たりは fit.py で作り直す。
// 雪原のエリア {aid}「{M['name']}」（{M.get('sub', '')}、{d['w']}×{d['h']}）。エリア切り替えのフィールド（maps/field_00_kit.js・snow_field_00_kit.js）。
//   出口: {edges}
//   絵: field/under/{aid}（v2/assets/env/field/under/。無ければマスから焼く）。文は src/i18n/ja/maps_snow.js（map.snow_field.{short}.*）
(function (R) {{
  'use strict';
  R.Snow.fieldArea({js(aid)}, {{
    name: {js(T('name', M['name']))}, region: {js(M['region'])}, outside: {js(M.get('outside', 'wall_snow'))},
    rows: [
{chr(10).join('      ' + js(r) + ',' for r in rows)}
    ],
    objects: [
{chr(10).join('      ' + js(o) + ',' for o in objects)}
    ],
    npcs: [
{chr(10).join('      ' + js(n) + ',' for n in npcs)}
    ],
    spawns: {js(d['spawns'])},
    exits: {js(exits)},
    triggers: {js(M.get('triggers', []))},
    tilePatches: {js(M.get('tilePatches', []))},
    zones: {js(M['zones'])},
{extra}    art: {js(art)},
    meta: {js(dict(sub=T('meta.sub', M.get('sub', '')), worldRect=M['worldRect']))},
    links: {js(M.get('links', {}))},
  }});
}})(window.RPG);
"""
    p = os.path.join(V2, 'src/maps/snow_field_%s.js' % short)
    open(p, 'w').write(out)
    print(p, len(out))

# the strings block in maps_snow.js
t = open(JA).read()
blk = B0 + '\n' + ''.join("    '%s': %s,\n" % (k, strings[k]) for k in sorted(strings)) + B1
if B0 in t:
    t = t[:t.index(B0)] + blk + t[t.index(B1) + len(B1):]
else:
    i = t.rindex('  });')
    t = t[:i] + blk + '\n' + t[i:]
open(JA, 'w').write(t)
print(JA, len(strings), 'strings')
