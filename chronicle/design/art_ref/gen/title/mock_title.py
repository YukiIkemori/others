"""Mock of the full title screen (key art + logo + menu in the UIK style) from v2/assets/title/.
usage: python3 mock_title.py wide 2.0   |   python3 mock_title.py phone 3.0   (writes mock_<tag>.png in the cwd)
The glow / vignette / particles here stand in for what the engine draws (v2/design/TITLE_ART.md)."""
import sys, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
A='/home/user/others/chronicle/v2/assets/title/'
FB='/home/user/others/chronicle/v2/assets/fonts/ZenMaruGothic-Bold.ttf'
FM='/home/user/others/chronicle/v2/assets/fonts/ZenMaruGothic-Medium.ttf'
def glow(img, x, y, r, col, a):
    W,H=img.size
    yy,xx=np.mgrid[0:H,0:W]
    d=np.sqrt((xx-x)**2+(yy-y)**2)/r
    k=np.clip(1-d,0,1)**2*a
    arr=np.array(img.convert('RGB')).astype(float)
    arr=arr+ (np.array(col)[None,None,:]*k[...,None])   # additive
    return Image.fromarray(np.clip(arr,0,255).astype('uint8'))
def particles(img, box, n, col, seed, rmax):
    rnd=random.Random(seed); lay=Image.new('RGBA',img.size,(0,0,0,0)); d=ImageDraw.Draw(lay)
    for i in range(n):
        x=rnd.uniform(box[0],box[2]); y=rnd.uniform(box[1],box[3]); r=rnd.uniform(0.6,rmax); a=int(rnd.uniform(90,230))
        d.ellipse((x-r,y-r,x+r,y+r),fill=col+(a,))
    b=lay.filter(ImageFilter.GaussianBlur(rmax*1.2))
    out=img.convert('RGBA'); out.alpha_composite(b); out.alpha_composite(lay); return out.convert('RGB')
def text(d, xy, s, font, fill, anchor='la', shadow=True, track=0):
    x,y=xy
    if track:
        tw=sum(font.getlength(c) for c in s)+track*(len(s)-1)
        if anchor[0]=='m': x-=tw/2
        for c in s:
            text(d,(x,y),c,font,fill,'l'+anchor[1],shadow); x+=font.getlength(c)+track
        return
    if shadow: d.text((x+2,y+3),s,font=font,fill=(4,6,16,170),anchor=anchor)
    d.text((x,y),s,font=font,fill=fill,anchor=anchor)
def mock(tag, s=1.0):
    key=Image.open(A+'key_%s.png'%tag).convert('RGB'); W,H=key.size
    img=key
    import json
    meta=json.load(open(A+'title_%s.json'%tag))
    lx,ly=meta['lantern'][0]*W, meta['lantern'][1]*H
    img=glow(img,lx,ly,H*0.16,(255,170,80),0.35)
    img=glow(img,lx,ly,H*0.035,(255,230,170),0.6)
    for bx,by in meta['beacons']:
        img=glow(img,bx*W,by*H,H*0.018,(255,190,110),0.35)
    # UI vignette (engine draws it): left / bottom darkening behind the menu
    vg=np.zeros((H,W),float)
    if tag=='wide':
        xs=np.clip(1-np.arange(W)/(W*0.48),0,1)**1.6; vg+=xs[None,:]*0.55
        ys=np.clip((np.arange(H)-H*0.55)/(H*0.45),0,1)**1.5; vg=np.maximum(vg, (ys[:,None]*xs[None,:]*0.75))
    else:
        ys=np.clip((np.arange(H)-H*0.66)/(H*0.34),0,1)**1.2; vg+=ys[:,None]*0.6
        yt=np.clip(1-np.arange(H)/(H*0.25),0,1)**1.5; vg=np.maximum(vg,yt[:,None]*0.35)
    arr=np.array(img).astype(float)*(1-vg[...,None])+np.array([6,8,20])[None,None,:]*vg[...,None]
    img=Image.fromarray(arr.astype('uint8'))
    # particles
    img=particles(img,(lx-W*0.05,ly-H*0.2,lx+W*0.08,ly+H*0.05),28,(255,180,90),1,2.2*s)
    img=particles(img,(W*0.55,H*0.72,W,H),14,(170,240,210),2,1.6*s)
    img=particles(img,(0,H*0.75,W*0.5,H),6,(170,240,210),4,1.4*s)
    img=particles(img,(W*0.5,H*0.7,W,H),10,(255,200,120),3,1.5*s)
    img=img.convert('RGBA')
    logo=Image.open(A+'logo.png')
    la=meta['logo_safe']
    lw=int(la['w']*W); lh=int(logo.height*lw/logo.width)
    lg=logo.resize((lw,lh),Image.LANCZOS)
    # soft dark halo under the logo for legibility
    halo=Image.new('RGBA',img.size,(0,0,0,0)); hd=ImageDraw.Draw(halo)
    cx=int(la['x']*W+lw/2); cy=int(la['y']*H+lh/2)
    hd.ellipse((cx-lw*0.55,cy-lh*0.5,cx+lw*0.55,cy+lh*0.5),fill=(4,6,18,120)); halo=halo.filter(ImageFilter.GaussianBlur(lw*0.08))
    img.alpha_composite(halo)
    img.alpha_composite(lg,(int(la['x']*W),int(la['y']*H)))
    d=ImageDraw.Draw(img)
    m=meta['menu_safe']; rows=['はじめから','つづきから','設定']
    k=s
    fsz=21 if tag=='wide' else 19
    fb=ImageFont.truetype(FB,int(fsz*k)); fm=ImageFont.truetype(FM,int(fsz*k))
    rowH=int((44 if tag=='wide' else 50)*k); mx=m['x']*W; my=m['y']*H; mw=m['w']*W
    center = tag=='phone'
    if center:
        pw=mw; px=mx
        pan=Image.new('RGBA',img.size,(0,0,0,0)); pd=ImageDraw.Draw(pan)
        pd.rounded_rectangle((px-18*k,my-18*k,px+pw+18*k,my+rowH*3+18*k),radius=int(14*k),fill=(14,16,26,120),outline=(240,228,200,40),width=max(1,int(1.5*k)))
        img.alpha_composite(pan); d=ImageDraw.Draw(img)
    for i,r in enumerate(rows):
        y=my+i*rowH
        if i==0:
            sel=Image.new('RGBA',img.size,(0,0,0,0)); sd=ImageDraw.Draw(sel)
            x0=mx; x1=mx+mw
            sd.rounded_rectangle((x0,y+4*k,x1,y+rowH-4*k),radius=int(10*k),fill=(236,201,124,40),outline=(236,201,124,150),width=max(1,int(2*k)))
            img.alpha_composite(sel); d=ImageDraw.Draw(img)
            # diamond
            dx=x0 if not center else x0+22*k; dy=y+rowH/2; r_=8*k
            d.polygon([(dx,dy-r_),(dx+r_,dy),(dx,dy+r_),(dx-r_,dy)],fill=(255,241,200,255))
        f=fb if i==0 else fm
        col=(255,241,200,255) if i==0 else (246,240,227,235)
        if center: text(d,(mx+mw/2,y+rowH/2),r,f,col,'mm',shadow=(i!=0),track=int(3*k))
        else: text(d,(mx+26*k,y+rowH/2),r,f,col,'lm',shadow=(i!=0),track=int(3*k))
    fc=ImageFont.truetype(FM,int(11.5*k))
    text(d,(26*k,H-(30 if tag=='wide' else 48)*k),'© Studio Metem      ver 2.0.0',fc,(154,145,127,255),'lm')
    if tag=='wide':
        text(d,(W-30*k,H-30*k),'Z 決定    ↑↓ 選ぶ',fc,(210,201,182,255),'rm')
    return img.convert('RGB')
tag=sys.argv[1]; s=float(sys.argv[2])
im=mock(tag,s); im.save('mock_%s.png'%tag)
