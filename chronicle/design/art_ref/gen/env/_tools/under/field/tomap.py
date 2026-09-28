"""Write the game map file of a FIELD area from <id>/layout.json: v2/src/maps/field_<short>.js (generated; do not edit by hand).
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
    short = aid[2:] if aid.startswith('f_') else aid
    edges = ', '.join('%s → %s.%s' % (e['edge'], e['to']['map'], e['to']['spawn']) for e in d['exits'])
    out = f"""// 生成物（design/art_ref/gen/env/_tools/under/field/ の areas.py → fit.py → tomap.py）。手で直さない: 配置は areas.py、当たりは fit.py で作り直す。
// エリア {aid}「{M['name']}」（{M.get('sub', '')}、{d['w']}×{d['h']}）。エリア切り替えのフィールド（maps/field_00_kit.js）。
//   出口: {edges}
//   絵: field/under/{aid}（v2/assets/env/field/under/。無ければマスから焼く）
(function (R) {{
  'use strict';
  R.FieldArea.def({js(aid)}, {{
    name: {js(M['name'])}, region: {js(M['region'])}, outside: {js(M.get('outside', 'forest_dark'))},
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
    p = os.path.join(V2, 'src/maps/field_%s.js' % short)
    open(p, 'w').write(out)
    print(p, len(out))
