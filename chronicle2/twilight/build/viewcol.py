import numpy as np, cv2, sys
from PIL import Image, ImageDraw
art = np.array(Image.open('map/map_art.png').convert('RGB'))
walk = np.load('map/walk.npy'); reach = np.load('map/reach.npy'); height = np.load('map/height.npy')
def ov(box, name, scale=2, step=50):
    x0,y0,x1,y1 = box
    a = art[y0:y1,x0:x1].astype(float); o = a*0.55          # non-walkable = darkened
    w = walk[y0:y1,x0:x1]; r = reach[y0:y1,x0:x1]; hh = height[y0:y1,x0:x1] > 0
    o[w] = a[w]*0.75 + np.array([0,255,140])*0.25              # walkable = green tint, full brightness
    o[w & hh] = a[w & hh]*0.6 + np.array([190,90,255])*0.4     # walkable but hidden behind something = violet
    e = cv2.morphologyEx(w.astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3,3),np.uint8)) > 0
    o[e] = (255,255,255)
    im = Image.fromarray(o.clip(0,255).astype(np.uint8)).resize(((x1-x0)*scale,(y1-y0)*scale), Image.NEAREST); d = ImageDraw.Draw(im)
    for gx in range((x0//step+1)*step, x1, step): d.text(((gx-x0)*scale+2,2), str(gx), fill=(255,255,0)); d.line([((gx-x0)*scale,0),((gx-x0)*scale,6)], fill=(255,255,0))
    for gy in range((y0//step+1)*step, y1, step): d.text((2,(gy-y0)*scale-5), str(gy), fill=(255,255,0)); d.line([(0,(gy-y0)*scale),(6,(gy-y0)*scale)], fill=(255,255,0))
    im.save(f'map/c_{name}.png')
if __name__ == '__main__':
    if len(sys.argv) > 1:
        b = tuple(int(v) for v in sys.argv[2].split(',')); ov(b, sys.argv[1], int(sys.argv[3]) if len(sys.argv) > 3 else 3, 20)
    else:
        ov((0,930,640,1500), 'SW', 2); ov((640,930,1280,1500), 'SE', 2); ov((0,250,640,930), 'NW', 2); ov((640,250,1280,930), 'NE', 2)
