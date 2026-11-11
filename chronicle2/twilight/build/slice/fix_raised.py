"""The painter's mask of what stands up has holes (dark doors and windows) and calls cliff faces flat.
Inside the 3D outline the bake knows better: raised = mask OR (standing shrunk by a few dots).
usage: fix_raised.py slice/<map> [shrink=7]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ni
d = sys.argv[1]; k = int(sys.argv[2]) if len(sys.argv) > 2 else 7
m = np.array(Image.open(f'{d}/raised.png').convert('L')) > 127
st = np.load(f'{d}/standing_paint.npy').astype(bool)
out = m | ni.binary_erosion(st, iterations=k)
print(d, 'raised %.1f %% -> %.1f %%' % (100 * m.mean(), 100 * out.mean()))
Image.fromarray(out.astype(np.uint8) * 255).convert('1').save(f'{d}/raised.png')
