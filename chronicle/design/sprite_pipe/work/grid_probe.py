import numpy as np
from PIL import Image
im=np.asarray(Image.open('../art_ref/hero_sheet_owner.png').convert('RGB')).astype(float)
def probe(box,name):
    x0,y0,x1,y1=box; a=im[y0:y1,x0:x1]
    gx=np.abs(np.diff(a,axis=1)).sum(2).sum(0); gy=np.abs(np.diff(a,axis=0)).sum(2).sum(1)
    res=[]
    for g in (gx,gy):
        g=g-g.mean(); best=[]
        for p10 in range(150,1200,5):
            p=p10/100; ph=np.arange(len(g))*2*np.pi/p
            s=abs((g*np.exp(1j*ph)).sum())/len(g); best.append((s,p))
        best.sort(reverse=True); res.append(best[:4])
    print(name,[ [(round(s,1),p) for s,p in r] for r in res])
probe((440,195,1420,340),'battle')
probe((40,780,530,955),'turn')
probe((30,150,395,630),'main')
probe((430,445,650,690),'face')
probe((655,475,935,580),'faces3')
