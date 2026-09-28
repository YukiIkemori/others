import json,sys
for m in sys.argv[1:]:
    d=json.load(open('before/%s_data.json'%m))
    rows=[list(r) for r in d['rows']]
    tag={}
    for i,o in enumerate(d['objects']):
        if 'x' not in o: continue
        k=o['type'][0].upper() if o['type']!='prop' else '*'
        tag.setdefault((o['x'],o['y']),[]).append((k,o.get('id',o.get('event','')), i))
    for n in d.get('npcs') or []:
        tag.setdefault((n['x'],n['y']),[]).append(('@',n['id'],-1))
    print('==',m, d['w'],d['h'])
    print('   '+''.join(str(x%10) for x in range(d['w'])))
    for y,r in enumerate(rows):
        s=''
        for x,c in enumerate(r):
            t=tag.get((x,y))
            s+= t[0][0] if t else c
        print('%2d %s'%(y,s))
    for (x,y),l in sorted(tag.items(), key=lambda a:(a[0][1],a[0][0])):
        print('  (%d,%d) %s under=%s'%(x,y,' | '.join('%s:%s'%(a,b) for a,b,_ in l), rows[y][x]))
