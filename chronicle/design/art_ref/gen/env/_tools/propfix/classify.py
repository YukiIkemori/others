import json, lib
DECOR = set('barrel crate sack flower_pot planter net hay stump log rock_small rock fern reeds bench table chair bush bollard rowboat grave tent bookshelf tree_giant well'.split())
def live_cells(mid):
    a = lib.MAPS[mid]['art']
    try: j = json.load(open('%s/%s.json' % (lib.ENV, a['image'])))
    except Exception: return set()
    s = set()
    for r in j.get('live', []) or []:
        for c in r.get('cells', []): s.add((c[0], c[1]))
    return s
def classify(mid):
    m = lib.MAPS[mid]; ex = [(o['x'], o['y']) for o in m['objects'] if o['type'] == 'examine']
    live = live_cells(mid); dec, keep = [], []
    for o in m['objects']:
        if o['type'] != 'prop' or o['id'] == 'firefly': continue
        why = None
        if o['id'] not in DECOR: why = 'functional'
        elif o.get('cond') is not None: why = 'cond'
        elif o.get('lv'): why = 'lv1'
        elif any(abs(o['x'] - x) <= 1 and abs(o['y'] - y) <= 1 for x, y in ex): why = 'exam'
        elif (o['x'], o['y']) in live or any((o['x'] + dx, o['y'] + dy) in live for dx in (-1, 0, 1) for dy in (-1, 0, 1)): why = 'live'
        elif o['id'] in (m['art'].get('painted') or []): why = 'already'
        (keep if why else dec).append((o, why))
    return dec, keep
if __name__ == '__main__':
    from collections import Counter
    for mid in lib.MAPS:
        dec, keep = classify(mid)
        print(mid, 'DECOR', len(dec), dict(Counter(o['id'] for o, _ in dec)))
        print('    KEEP', len(keep), dict(Counter((o['id'], w) for o, w in keep if w != 'functional')), dict(Counter(o['id'] for o, w in keep if w == 'functional')))
