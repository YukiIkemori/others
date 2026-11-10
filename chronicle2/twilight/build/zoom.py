import sys
from PIL import Image, ImageDraw
def zoom(src, box, out, scale=3, step=20):
    im = Image.open(src).convert('RGB'); x0,y0,x1,y1 = box
    c = im.crop(box).resize(((x1-x0)*scale,(y1-y0)*scale), Image.NEAREST); d = ImageDraw.Draw(c)
    for gx in range((x0//step+1)*step, x1, step):
        d.line([((gx-x0)*scale,0),((gx-x0)*scale,6)], fill=(255,255,0)); d.text(((gx-x0)*scale+2,6), str(gx), fill=(255,255,0))
    for gy in range((y0//step+1)*step, y1, step):
        d.line([(0,(gy-y0)*scale),(6,(gy-y0)*scale)], fill=(255,255,0)); d.text((8,(gy-y0)*scale-5), str(gy), fill=(255,255,0))
    c.save(out)
if __name__ == '__main__':
    src = sys.argv[1]; box = tuple(int(v) for v in sys.argv[2].split(',')); zoom(src, box, sys.argv[3], int(sys.argv[4]) if len(sys.argv)>4 else 3)
