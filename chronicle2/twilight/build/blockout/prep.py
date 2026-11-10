"""2x generation -> game-size picture (BOX), still on the magenta key.   usage: prep.py paint_2x.png paint_1x.png"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); im.resize((im.width // 2, im.height // 2), Image.BOX).save(sys.argv[2])
