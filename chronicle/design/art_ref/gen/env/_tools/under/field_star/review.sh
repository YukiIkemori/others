#!/bin/sh
# 描いた絵の当たりの確かめの縮小（w_star/c_<id>.jpg）。usage: sh review.sh <id>
S=/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/w_star
python3 -c "
from PIL import Image
im=Image.open('$1/check.png'); im.thumbnail((1600,1600)); im.convert('RGB').save('$S/c_$1.jpg',quality=80)"
