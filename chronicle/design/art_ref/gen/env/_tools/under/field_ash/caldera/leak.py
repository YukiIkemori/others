import json, sys
from collections import deque
rows=json.load(open('caldera/rows_fit.json'))
d=json.load(open('caldera/map_dump.json'))
bl={(o['x']+i,o['y']+j) for o in d['objects'] if o['type']=='building' for i in range(o['w']) for j in range(o['h'])}
dr={(o['door']['x'],o['door']['y']) for o in d['objects'] if o['type']=='building'}
def ok(u,v,block): return 0<=u<54 and 0<=v<54 and rows[v][u] in 'aceb' and rows[v][u] not in block and ((u,v) not in bl or (u,v) in dr)
def path(st,goal,block):
    prev={st:None}; q=deque([st])
    while q:
        x,y=q.popleft()
        for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
            u,v=x+dx,y+dy
            if ok(u,v,block) and (u,v) not in prev: prev[(u,v)]=(x,y); q.append((u,v))
    if goal not in prev: return None
    p=goal; out=[]
    while p: out.append(p); p=prev[p]
    return out[::-1]
print('rim->terrace w/o e:', path((2,26),(12,29),'e'))
print('rim->terrace (east start) w/o e:', path((51,26),(40,36),'e'))
print('terrace->flag w/o b:', path((12,29),(22,20),'b'))
