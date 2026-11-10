"""raw generated sheet (4x3 grid, magenta) -> pipeline output at 96 art px.
usage: python3 run_pipe.py <sprite_pipe/tools dir> <raw.png> <work dir> <char id> [colors]"""
import os, shutil, sys
tools, raw, work, char = sys.argv[1:5]
colors = sys.argv[5] if len(sys.argv) > 5 else '96'
sys.path.insert(0, tools)
os.makedirs(os.path.join(work, 'sheets'), exist_ok=True)
shutil.copy(raw, os.path.join(work, 'sheets', 'sheet1.png'))
import brief_spec
brief_spec.SHEETS[1]['target_h'] = 96
brief_spec.SHEETS[1]['body_h'] = 96
import sheets
sys.argv = ['sheets.py', os.path.join(work, 'sheets'), '--char', char, '--out', os.path.join(work, 'pipe'), '--only', '1',
            '--no-autofix', '--no-manifest', '--colors', colors]
sheets.main()
