"""Makes the copy of site/index.html that is published as an Artifact (the publisher adds its own document skeleton).
usage: python3 publish.py ../site/index.html out/index.html"""
import re, sys, os
s = open(sys.argv[1], encoding='utf-8').read()
for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</html>\s*', r'<head>\s*', r'</head>\s*', r'<body>\s*', r'</body>\s*',
            r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*']:
    s = re.sub(pat, '', s, flags=re.I)
s = s.replace('<title>鐘のならない修道院</title>', '<title>二つの月の修道院</title>')
s = s.replace(':root {', ':root {\n  color-scheme: dark;', 1)
os.makedirs(os.path.dirname(sys.argv[2]), exist_ok=True)
open(sys.argv[2], 'w', encoding='utf-8').write(s)
