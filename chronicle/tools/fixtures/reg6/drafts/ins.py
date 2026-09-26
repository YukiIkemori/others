import sys,subprocess,re
mapfile, draft, mid = sys.argv[1], sys.argv[2], sys.argv[3]
rows = subprocess.check_output(['node', draft, '--js']).decode().rstrip('\n')
s = open(mapfile).read()
a = s.index('    // @rows ' + mid)
a = s.index('\n', a) + 1
b = s.index('    // @end ' + mid)
s = s[:a] + rows + '\n' + s[b:]
open(mapfile, 'w').write(s)
