import sys; sys.path.insert(0,'tools')
import numpy as np
from PIL import Image
import pixlib as P
im=np.asarray(Image.open('../art_ref/hero_sheet_owner.png').convert('RGB'))
box=(435,200,575,342)
c=im[box[1]:box[3],box[0]:box[2]]
fg,bg=P.key_out(c)
fg=P.largest_components(fg)
Image.fromarray((fg*255).astype(np.uint8)).resize((c.shape[1]*3,c.shape[0]*3),Image.NEAREST).save('work/t1_mask.png')
ys=np.where(fg.any(1))[0]; print('h src',ys[0],ys[-1],ys[-1]-ys[0]+1)
xs,ysl,p=P.fit_grid(c,fg); print('p',p,len(xs)-1,len(ysl)-1)
nat=P.sample_grid(c,fg,xs,ysl)
for tgt in (64,):
  pp=(ys[-1]-ys[0]+1)/tgt
  xs2,ys2,_=P.fit_grid(c,fg,p_hint=pp)
  n2=P.sample_grid(c,fg,xs2,ys2)
  Image.fromarray(n2).resize((n2.shape[1]*6,n2.shape[0]*6),Image.NEAREST).save('work/t1_%d.png'%tgt)
Image.fromarray(nat).resize((nat.shape[1]*8,nat.shape[0]*8),Image.NEAREST).save('work/t1_nat.png')
print(nat.shape)
