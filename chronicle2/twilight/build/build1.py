from PIL import Image
import numpy as np, cv2
art = np.array(Image.open('map/map_art.png').convert('RGB'))
H, W = art.shape[:2]
def load_mask(name, fn):
    m = np.array(Image.open(f'raw/{name}.png').convert('RGB').resize((W, H), Image.BOX)).astype(int)
    return fn(m)
walk0 = load_mask('m_walk', lambda m: (m[...,0]>150)&(m[...,2]>150)&(m[...,1]<110))
raised0 = load_mask('m_raised', lambda m: m.sum(-1) > 384)
sky = np.load('map/sky_green.npy')
np.save('map/walk0.npy', walk0); np.save('map/raised0.npy', raised0)
def overlay(box, name, scale=2, extra=None):
    x0,y0,x1,y1 = box
    o = art[y0:y1, x0:x1].astype(float)
    w = walk0[y0:y1, x0:x1]; r = raised0[y0:y1, x0:x1]
    o[w] = o[w]*0.6 + np.array([0,255,120])*0.4
    e = cv2.morphologyEx(r.astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3,3),np.uint8))>0
    o[e] = (255,40,40)
    im = Image.fromarray(o.astype(np.uint8)).resize(((x1-x0)*scale, (y1-y0)*scale), Image.NEAREST)
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    step = 50
    for gx in range((x0//step+1)*step, x1, step):
        d.line([( (gx-x0)*scale,0),((gx-x0)*scale,8)], fill=(255,255,0)); d.text(((gx-x0)*scale+2,8), str(gx), fill=(255,255,0))
    for gy in range((y0//step+1)*step, y1, step):
        d.line([(0,(gy-y0)*scale),(8,(gy-y0)*scale)], fill=(255,255,0)); d.text((10,(gy-y0)*scale-5), str(gy), fill=(255,255,0))
    im.save(f'map/ov_{name}.png')
if __name__ == '__main__':
    overlay((470,1180,830,1600), 'gate')
    overlay((500,700,820,1020), 'navedoor')
    overlay((120,480,480,800), 'arcade')
    overlay((150,260,560,480), 'tower')
    overlay((860,330,1180,800), 'right', 2)
