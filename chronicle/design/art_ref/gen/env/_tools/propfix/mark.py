"""Write the painted props of applied.json into each map's art.painted (entries 'id@x,y'; ids without '@' are kept).
usage: python3 mark.py [map ...]"""
import json, os, re, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
import lib
A = json.load(open(os.path.join(HERE, 'applied.json')))
maps = sys.argv[1:] or sorted({k.rsplit('_w', 1)[0] for k in A})
for mid in maps:
    ents = sorted({'%s@%d,%d' % (i, x, y) for k, v in A.items() if k.rsplit('_w', 1)[0] == mid for i, x, y in v['painted']}, key=lambda e: (int(e.split('@')[1].split(',')[1]), int(e.split(',')[1]) if False else int(e.split('@')[1].split(',')[0])))
    img = lib.MAPS[mid]['art']['image']
    hits = []
    for f in glob.glob(lib.V2 + '/src/maps/*.js'):
        s = open(f).read()
        pat = re.compile(r"(art:\s*\{\s*image:\s*'" + re.escape(img) + r"'[^\n]*?painted:\s*)\[([^\]]*)\]")
        m = pat.search(s)
        if not m: continue
        keep = [e.strip().strip("'") for e in m.group(2).split(',') if e.strip() and '@' not in e]
        lst = ', '.join("'%s'" % e for e in keep + ents)
        s = s[:m.start()] + m.group(1) + '[' + lst + ']' + s[m.end():]
        open(f, 'w').write(s); hits.append(os.path.basename(f))
    print(mid, len(ents), 'painted ->', hits)
