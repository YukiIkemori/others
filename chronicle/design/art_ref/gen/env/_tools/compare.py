"""before/after comparison: python3 compare.py out.png before.png after.png [title]"""
import sys
from PIL import Image, ImageDraw, ImageFont
out, a, b = sys.argv[1:4]
title = sys.argv[4] if len(sys.argv) > 4 else ''
A = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')
W = 1920
A = A.resize((W, round(A.height * W / A.width))); B = B.resize((W, round(B.height * W / B.width)))
bar = 56
C = Image.new('RGB', (W, A.height + B.height + bar * 2), (14, 14, 22))
d = ImageDraw.Draw(C)
try:
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception:
    f = ImageFont.load_default()
d.text((20, 12), 'BEFORE  (code-drawn)  ' + title, fill=(200, 200, 210), font=f)
C.paste(A, (0, bar))
d.text((20, A.height + bar + 12), 'AFTER  (generated environment art, real engine)  ' + title, fill=(255, 214, 140), font=f)
C.paste(B, (0, A.height + bar * 2))
C.save(out, optimize=True)
print(out, C.size)
