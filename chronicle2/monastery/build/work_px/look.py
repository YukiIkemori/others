import sys
from PIL import Image
im=Image.open('../site/px/map.webp').convert('RGBA')
bg=Image.new('RGBA',im.size,(93,74,102,255)); bg.alpha_composite(im)
hero=Image.open('../site/hero_hd.png').convert('RGBA')
spots=[(700,1500,0,(240,250)),(760,900,3,(300,200)),(250,1050,2,(250,150)),(1200,700,1,(240,150))]
tiles=[]
for n,(x,y,row,(hx,hy)) in enumerate(spots):
    c=bg.crop((x,y,x+480,y+300))
    f=hero.crop((0,row*128,96,row*128+128)); c.alpha_composite(f,(hx-48,hy-120))
    tiles.append(c.resize((960,600),Image.NEAREST))
o=Image.new('RGB',(1920,1200))
for n,t in enumerate(tiles): o.paste(t,((n%2)*960,(n//2)*600))
o.save(sys.argv[1])
