# PV の確かめ用: 仕上がった動画から、台本の各カットの真ん中の 1 コマを並べた一覧（コンタクトシート）を作る。
#   python3 v2/tools/pv/contact.py <edit.py> <動画.mp4> <出力.png> [列の数]
import os
import runpy
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

FF = os.environ.get('FFMPEG', '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'fonts', 'ZenMaruGothic-Medium.ttf')


def main():
    edit, video, out = sys.argv[1:4]
    cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
    E = runpy.run_path(edit)
    segs, seen = [], set()
    for s in sorted(E['V'], key=lambda s: s['at']):
        k = round(s['at'], 1)
        if k in seen:   # 4 分割は 1 枚
            continue
        seen.add(k)
        segs.append(s)
    w, h = 384, 216
    rows = (len(segs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * w, rows * (h + 26)), (12, 12, 16))
    f = ImageFont.truetype(FONT, 15)
    d = ImageDraw.Draw(sheet)
    for i, s in enumerate(segs):
        t = s['at'] + s['dur'] / 2
        raw = subprocess.run([FF, '-v', 'error', '-ss', '%.3f' % t, '-i', video, '-frames:v', '1', '-vf', 'scale=%d:%d' % (w, h), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
        x, y = (i % cols) * w, (i // cols) * (h + 26)
        if len(raw) == w * h * 3:
            sheet.paste(Image.frombytes('RGB', (w, h), raw), (x, y))
        m, sec = divmod(s['at'], 60)
        d.text((x + 6, y + h + 4), '%d:%05.2f  %s' % (m, sec, s['clip']), font=f, fill=(230, 220, 200))
    sheet.save(out)
    print('[contact]', out, len(segs), 'cuts')


if __name__ == '__main__':
    main()
