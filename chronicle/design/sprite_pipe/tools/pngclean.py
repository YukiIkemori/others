"""PNG の付随チャンクを落とす（stdlib だけ）。生成の出力に付く来歴の札（caBX = C2PA、tEXt/iTXt/zTXt、eXIf など）に
作った道具の名前が入るので、リポジトリに入る PNG には残さない（持ち主の決まり）。

  strip_png(bytes) -> bytes     IHDR/PLTE/IDAT/IEND/tRNS/gAMA/sRGB/iCCP/pHYs だけ残す（画素は変えない）
  strip_png_file(path)          ファイルをその場で書き直す（落とす物が無ければ書かない）

生成の API の出口（gen_api.generate・art_ref/gen/env/_tools/gen_env.py）と、v2 へ写す所（to_v2.py）で呼ぶ。
"""
import struct

SIG = b'\x89PNG\r\n\x1a\n'
KEEP = (b'IHDR', b'PLTE', b'IDAT', b'IEND', b'tRNS', b'gAMA', b'sRGB', b'iCCP', b'pHYs')


def strip_png(b):
    """付随チャンクを落とした PNG。PNG でなければそのまま返す"""
    if not b or b[:8] != SIG:
        return b
    out = [SIG]
    i, n = 8, len(b)
    while i + 8 <= n:
        ln, t = struct.unpack('>I4s', b[i:i + 8])
        end = i + 12 + ln
        if t in KEEP:
            out.append(b[i:end])
        i = end
        if t == b'IEND':
            break
    return b''.join(out)


def strip_png_file(path):
    """path の PNG を書き直す。書き直したら True"""
    with open(path, 'rb') as f:
        b = f.read()
    c = strip_png(b)
    if c == b:
        return False
    with open(path, 'wb') as f:
        f.write(c)
    return True


if __name__ == '__main__':
    import sys
    for p in sys.argv[1:]:
        print(('stripped ' if strip_png_file(p) else 'clean    ') + p)
