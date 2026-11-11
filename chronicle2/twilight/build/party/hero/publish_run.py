"""Deliver the hero's party files: hero.png (the approved walk sheet, byte for byte), hero_run.png, hero.json
(site/hero.json + "run" + "runLantern") and the owner previews.
usage: python3 publish_run.py <final dir of build_run.py>"""
import sys, os, json, shutil, filecmp, subprocess
final = sys.argv[1]
SITE = '/home/user/others/chronicle2/twilight/site'
PARTY = SITE + '/party'
PV = '/mnt/project-files/twilight-rpg/party/'
os.makedirs(PARTY, exist_ok=True); os.makedirs(PV, exist_ok=True)
shutil.copyfile(SITE + '/hero.png', PARTY + '/hero.png')
assert filecmp.cmp(SITE + '/hero.png', PARTY + '/hero.png', shallow=False)
shutil.copyfile(final + '/hero_run.png', PARTY + '/hero_run.png')
meta = json.load(open(SITE + '/hero.json'))
meta['run'] = {'src': 'hero_run.png', 'cols': 4, 'ms': 105}
meta['runLantern'] = json.load(open(final + '/run_meta.json'))['runLantern']
json.dump(meta, open(PARTY + '/hero.json', 'w'))
here = os.path.dirname(os.path.abspath(__file__))
subprocess.check_call([sys.executable, here + '/preview_run.py', PARTY + '/hero.png', PARTY + '/hero_run.png', final + '/preview'])
for n in ('hero_preview.png', 'hero_walk.gif', 'hero_run.gif'):
    shutil.copyfile(final + '/preview/' + n, PV + n)
print('published', sorted(os.listdir(PARTY)), '->', PV)
