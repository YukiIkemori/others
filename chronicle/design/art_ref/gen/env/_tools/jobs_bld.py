import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from style import *
import guides
D = '/home/user/others/chronicle/design/art_ref/gen/env/bld/'
maps = json.load(open(os.path.join(os.path.dirname(__file__), 'maps_dump.json')))['maps']
THEME = {'pharos': 'harbor', 'roa': 'hill_village', 'fern': 'treetop', 'yura': 'moss_village'}
SETTING = {
 'harbor': "a stone-and-plaster harbour town on a windy northern coast",
 'hill_village': "a small old hill village of farmers and storytellers",
 'treetop': "a forest village built among giant trees (rustic log houses, carved wood, lanterns)",
 'moss_village': "a hidden forgotten village deep in a mossy forest (small bark-clad huts, moss and ferns growing on the roofs)",
}
ROOF = {'slate': "blue-grey slate roof with overlapping slates and a ridge", 'terra': "terracotta clay tile roof in warm red-orange", 'thatch': "thick golden-brown straw thatch roof",
        'shingle': "dark brown wooden shingle roof", 'moss': "roof so overgrown with thick green moss and small ferns that the shingles barely show", 'bark': "roof of overlapping bark slabs"}
WALL = {'plaster': "cream plaster walls with dark timber framing and a stone plinth", 'stone': "walls of large grey cut stone blocks", 'plank': "walls of vertical weathered wooden planks",
        'log': "walls of stacked round logs with notched corners", 'brick': "red-brown brick walls with stone corners", 'bark': "walls clad in rough bark slabs with a mossy stone base"}
SIGN = {'inn': "a hanging wooden sign with a bed icon", 'tavern': "a hanging wooden sign with a foaming mug icon", 'item': "a hanging wooden sign with a potion-flask icon",
        'weapon': "a hanging wooden sign with a crossed-swords icon", 'records': "a hanging wooden sign with a book-and-quill icon", 'guild': "a hanging wooden sign with an anchor icon"}
BLD = ("Paint ONE building for a top-down pixel-art JRPG town map, in the classic 3/4 top-down RPG view: the roof is seen from above "
       "(it fills the upper coloured block of the guide) and the front wall is seen straight on (the lower block). "
       "The attached image is an exact layout guide drawn at the final proportions: keep the outer silhouette, the roof/wall split line, "
       "the door (dark brown rectangle: it must stay exactly there, same size, at ground level, a real door you can walk through) and the windows (yellow rectangles) "
       "in exactly the same places. You may add small details (eaves, trim, drainpipe, flower boxes, crates by the wall, a chimney poking above the roof into the empty top margin).\n")
jobs, defs = [], {}
for mid, th in THEME.items():
    for o in maps[mid]['objects']:
        if o.get('type') != 'building': continue
        d = dict(o)
        im, g = guides.draw_guide(d)
        gp = D + 'guide/%s.png' % d['id']
        os.makedirs(D + 'guide', exist_ok=True); im.save(gp)
        storeys = 'two-storey' if g['wall'] >= 3 else ('one-storey' if g['wall'] == 2 else 'small low')
        role = {'inn': 'inn', 'tavern': 'tavern', 'item': 'item shop', 'weapon': 'weapon smithy', 'records': 'records office', 'guild': 'boatyard workshop'}.get(d.get('sign'), 'house')
        if d['id'] == 'roa_hall': role = 'old stone meeting hall of the village storytellers'
        if d['id'] == 'fern_b_search': role = 'search-party post'
        if d['id'] == 'fern_b_rita': role = "singer's house"
        if d['id'] == 'fern_b_shed': role = 'tool shed'
        txt = ["This building: a %s %s in %s." % (storeys, role, SETTING[th]),
               ROOF.get(d.get('roof', 'slate'), ''), WALL.get(d.get('mat', 'plaster'), '') + '.',
               "Windows have small panes glowing warm amber from inside (the only light)."]
        if d.get('sign'): txt.append(SIGN.get(d['sign'], '') + ' beside the door.')
        if d.get('awning'): txt.append('A striped red-and-cream fabric awning over a window.')
        if d.get('flowers'): txt.append('Flower boxes under some windows.')
        if d.get('lamp') and d.get('door'): txt.append('A small iron wall lamp next to the door (unlit glass).')
        txt.append("The whole image is %d x %d art pixels (each art pixel 7x7 image pixels)." % (g['W'], g['H']))
        W, H = g['W'] * 7, g['H'] * 7
        W16, H16 = (W + 15) // 16 * 16, (H + 15) // 16 * 16
        if W16 != W or H16 != H:
            from PIL import Image
            im2 = Image.new('RGB', (W16, H16), (255, 0, 255)); im2.paste(im, (0, 0)); im2.save(gp)
        jobs.append(dict(out=D + '%s/%s.png' % (th, d['id']), tag='env_bld_' + d['id'], size='%dx%d' % (W16, H16), quality='high', background='transparent', refs=[gp],
                         prompt=BLD + ' '.join(txt) + "\n" + PIXEL + "\n" + ALBEDO.replace('NO light sources, NO glow, ', '') +
                         "\nBackground: fully transparent (the magenta in the guide is background). No ground, no shadow, no people, no text, no letters."))
        defs[d['id']] = dict(d=d, theme=th, W=g['W'], H=g['H'], img=[W16, H16])
json.dump(jobs, open('/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/jobs_bld.json', 'w'))
json.dump(defs, open(os.path.join(os.path.dirname(__file__), 'bld_defs.json'), 'w'), indent=1)
print(len(jobs), [j['size'] for j in jobs][:40])
