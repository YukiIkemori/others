"""(desert copy of ../field/tomap.py: v2/src/maps/field_desert_<id without d_>.js, desert legend/theme/bgm/bbg) Write the game map file of a FIELD area from <id>/layout.json: v2/src/maps/field_<short>.js (generated; do not edit by hand).
Rows: layout.json 'rows_fit' (the collision fitted to the painting, fit.py) when present, else 'rows'.
usage: python3 tomap.py <id> [...]"""
import json, sys, os
V2 = '/home/user/others/chronicle/v2'


def js(v):
    return json.dumps(v, ensure_ascii=False, separators=(',', ':'))


for aid in sys.argv[1:]:
    d = json.load(open(aid + '/layout.json'))
    M = d['meta']
    rows = d.get('rows_fit') or d['rows']
    painted, objects = list(d.get('painted_extra') or []), []
    fx = json.load(open(aid + '/fix.json')) if os.path.exists(aid + '/fix.json') else {}
    for mv in fx.get('objects', []):   # move objects to where the painting put their landmark
        for o in d['objects']:
            if all(o.get(k) == v for k, v in mv['match'].items()): o.update(mv['set'])
    for k, v in fx.get('spawns', {}).items(): d['spawns'][k] = v
    # fix.json: drop_exits ['e', ...] = edge exits removed by hand (one way in only), solid [[x, y, ch?]] also over rows_fit,
    # objects_add [...] = extra objects (a bump note on a closed road end)
    rows = [list(r) for r in rows]
    for q in fx.get('solid', []): rows[q[1]][q[0]] = q[2] if len(q) > 2 else 'X'
    rows = [''.join(r) for r in rows]
    d['exits'] = [e for e in d['exits'] if e.get('edge') not in set(fx.get('drop_exits', []))]
    d['objects'] = d['objects'] + list(fx.get('objects_add', []))
    # lamps (waylamp / lamp_post) stand beside the road, never on it and never in a narrow gap (tools/qa/check_lamps.js):
    # the nearest cell whose 5x5 neighbourhood is all walkable, which is not road itself, with a road cell within 2
    WALKC, ROADC = set(',;".:s_=cuk'), set('.:c=')
    H_, W_ = len(rows), len(rows[0])
    taken = {(o['x'], o['y']) for o in d['objects']}
    def good(x, y):
        if not (2 <= x < W_ - 2 and 2 <= y < H_ - 2) or rows[y][x] in ROADC or (x, y) in taken: return False
        if any(rows[y + j][x + i] not in WALKC for i in range(-2, 3) for j in range(-2, 3)): return False
        return any(rows[y + j][x + i] in ROADC for i in range(-2, 3) for j in range(-2, 3))
    for o in d['objects']:
        if o.get('type') in ('waylamp',) or o.get('id') == 'lamp_post':
            if good(o['x'], o['y']): continue
            c = sorted(((abs(x - o['x']) + abs(y - o['y']), x, y) for y in range(H_) for x in range(W_) if good(x, y)))
            if c and c[0][0] <= 8:
                taken.discard((o['x'], o['y'])); o['x'], o['y'] = c[0][1], c[0][2]; taken.add((o['x'], o['y']))
    for o in d['objects']:
        if o.get('type') == 'none_removed': continue   # dropped by fix.json (painted into the picture)
        o = dict(o)
        p = o.pop('painted', None)
        if p: painted.append('%s@%d,%d' % (p, o['x'], o['y']))
        objects.append(o)
    exits = [{k: v for k, v in e.items() if k != 'edge'} for e in d['exits'] + fx.get('exits', [])]
    has_over = os.path.exists(os.path.join(V2, 'assets/env/field/under/%s_over@32.png' % aid))
    art = {'image': 'field/under/' + aid, 'painted': painted}
    if has_over: art['overlay'] = 'field/under/%s_over' % aid
    if os.path.exists(os.path.join(V2, 'assets/env/field/under/%s_closed@32.png' % aid)): art['closed'] = 'field/under/%s_closed' % aid
    short = aid[2:] if aid.startswith('d_') else aid
    edges = ', '.join('%s → %s.%s' % (e.get('edge', '門'), e['to']['map'], e['to']['spawn']) for e in d['exits'])
    out = f"""// 生成物（design/art_ref/gen/env/_tools/under/field_desert/ の areas_desert.py → fit.py → tomap.py）。手で直さない: 配置は areas_desert.py、当たりは fit.py で作り直す。
// エリア {aid}「{M['name']}」（{M.get('sub', '')}、{d['w']}×{d['h']}）。エリア切り替えのフィールド（maps/field_00_kit.js、砂漠の凡例は field_desert_00_kit.js）。
//   出口: {edges}
//   絵: field/under/{aid}（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {{
  'use strict';
  R.FieldArea.def({js(aid)}, {{
    name: {js(M['name'])}, region: {js(M['region'])}, outside: {js(M.get('outside', 'dune_sand'))},
    legend: R.FieldArea.DESERT_LEGEND, theme: 'desert', bgm: 'desert', bbg: 'desert',
    rows: [
{chr(10).join('      ' + js(r) + ',' for r in rows)}
    ],
    objects: [
{chr(10).join('      ' + js(o) + ',' for o in objects)}
    ],
    npcs: [
{chr(10).join('      ' + js(n) + ',' for n in M.get('npcs', []))}
    ],
    spawns: {js(d['spawns'])},
    exits: {js(exits)},
    triggers: {js(M.get('triggers', []))},
    tilePatches: {js(M.get('tilePatches', []))},
    zones: {js(M['zones'])},
    art: {js(art)},
    meta: {js(dict(sub=M.get('sub', ''), worldRect=M['worldRect']))},
    links: {js(M.get('links', {}))},
  }});
}})(window.RPG);
"""
    if M.get('bbg'): out = out.replace("    art: ", "    bbg: %s,\n    art: " % js(M['bbg']), 1)
    p = os.path.join(V2, 'src/maps/field_desert_%s.js' % short)
    open(p, 'w').write(out)
    print(p, len(out))
