"""Writes slice/<map>/map.json from the staged places (build/blockout/stage.py) and the content below.
usage: make_maps.py [village] [f01] [abbey]        (no names = all that are staged)"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); SL = os.path.join(HERE, '../../slice')

# one mood for the whole slice: the weak pale sun of a late afternoon that never ends
DAY = dict(name='', ambient='#d6d0d4', lightGain=.75, lightRadius=1, brighten=.55, glow=.6, heroLight=0, skyTint='#ffffff', moonGlow=0,
           mist=.3, mistColor='#cfc8d2', fireflies=0, wisps=0, motes=.5, rays=0, grade='#6f6a8a', gradeAlpha=.07, vignette=.38, vignetteColor='#120e16', sparkle='#fff0d0')
PARTY = dict(hero=dict(sheet='~/party/hero.png', spec='~/party/hero.json', light=dict(r=150, color='#ffb76a', intensity=0)),
             party=['~/party/sword', '~/party/rogue', '~/party/priest'])

PULL = 1.2          # the camera stands a little further back than one map dot = one 960x540 dot (ユウキ: the first cut felt too close)
def load(name):
    p = json.load(open(f'{SL}/{name}/places.json')); return p, p['marks']
# a chest still shut glints, a save crystal glows and hovers (hd.js / game.js "glow": colour, radius in dots, strength, sparks 1 rising 2 glint)
CHEST = dict(src='~/prop/chest.png', fw=64, fh=64, foot=[32, 54], block=16, shadow=0, glow=dict(c='#ffd27a', r=60, a=.8, sparks=2, up=2))
def at(mk, nm, dx=0, dy=0): return dict(x=mk[nm]['p'][0] + dx, y=mk[nm]['p'][1] + dy)
def base(p, mk, title, en, fog, bgm, back='#2a2630', win=1.0, name=None):
    lights = [dict(kind='window', x=v['air'][0], y=v['air'][1], gx=v['p'][0], gy=v['p'][1], r=v['light']['r'], color=v['light']['color'], intensity=v['light']['intensity'] * win, flicker=.05)
              for nm, v in mk.items() if 'light' in v]
    m = dict(title=title, titleEn=en, subtitle='', w=p['w'], h=p['h'], pull=PULL, image='map.webp', walk='walk.png', height='height.png', floor='floor.png', heightBias=3,
             occluders=[], lights=lights, water=[], mood='gold', moodFixed=True, moods=dict(gold=DAY, shadow=DAY), bgm=bgm,
             hd=dict(S=p['S'], A=p['A'], B=p['B'], depth=3, dof=2, fogTop=fog[0], fogBottom=fog[1], raised='raised.png', back=back, noBar=True, **{n: n + '.png' for n in p['far']}))
    if name and os.path.exists(f'{SL}/{name}/solid.txt'): m['hd']['solid'] = 'solid.txt'; m['hd']['grow'] = 22       # side walls and far roof slopes (build/blockout/solids.py)
    m.update(PARTY); return m
def fx(mk, nm, w, h, kind, n, **kw): return dict(kind=kind, x=mk[nm]['p'][0] - w // 2, y=mk[nm]['p'][1] - h // 2, w=w, h=h, n=n, **kw)

def village():
    p, mk = load('village'); m = base(p, mk, '始まりの村', 'The Village of Beginnings', (6.4, 2.0), 'bgm02', name='village')
    d = mk['door_teto']['p']
    m['spawn'] = dict(x=d[0], y=d[1] + 34, dir='down')
    m['spawns'] = dict(start=m['spawn'], gate=dict(x=mk['spawn_gate']['p'][0], y=mk['spawn_gate']['p'][1], dir='right'))
    g = mk['exit_gate']['p']
    m['exits'] = [dict(rect=[0, g[1] - 110, g[0] + 22, 220], to='f01', spawn='village')]
    T = lambda nm, r, title, **kw: dict(at(mk, nm), r=r, title=title, **kw)
    npc = lambda nm, who, title, dx=0, dy=0, **kw: dict(at(mk, 'npc_' + nm, dx, dy), r=50, kind='npc', id=nm, title=title, prop=dict(src='~/npc/%s.png' % nm, block=13, shadow=1), **kw)
    m['triggers'] = [
        npc('moku', 'モクじい', 'モクじい'), npc('mother', 'テトの母ちゃん', 'テトの母ちゃん'), npc('yomo', 'ヨモばあ', 'ヨモばあ'), npc('dorgo', 'ドルゴ', 'ドルゴ'),
        npc('hanna', 'ハンナ', 'ハンナ'), npc('oz', '村長のオズ', '村長のオズ'), npc('sem', '老神官のセム', '老神官のセム'), npc('pico', '羊飼いのピコ', '羊飼いのピコ'),
        npc('mil', 'ミル', 'ミル'), npc('bart', '行商人のバルト', '行商人のバルト'),
        T('door_teto', 46, 'テトの家', kind='inn', prompt='休む'), T('door_shop', 46, 'よろず屋', kind='shop', shop='goods', prompt='店に入る'),
        T('door_smith', 46, '鍛冶屋', kind='shop', shop='smith', prompt='店に入る'),
        T('door_elder', 46, '村長の家', text=['かぎがかかっている']), T('door_herb', 46, '薬師の家', text=['戸口から、薬草を煮る匂いがする。']),
        T('door_chapel', 46, '小さな礼拝堂', text=['扉の向こうに、小さな灯がひとつ、\nともっている。']),
        T('well', 46, '井戸', text=['深い井戸。のぞきこむと、\n弱い日の光が、底でゆれている。']),
        dict(at(mk, 'chest_roof'), r=40, kind='chest', id='ch002', title='宝箱', prompt='あける', prop=CHEST),
        dict(at(mk, 'hide_chapel'), r=36, kind='spot', id='ch001', title='物かげ'),
    ]
    m['emitters'] = [fx(mk, 'fx_plaza', 700, 420, 'motes', 26), fx(mk, 'fx_orchard', 420, 300, 'leaves', 6), fx(mk, 'fx_pasture', 520, 300, 'motes', 12),
                     dict(kind='mist', x=0, y=0, w=p['w'], h=p['h'], n=5)]
    m['save'] = 'any'
    return m

def f01():
    p, mk = load('f01'); m = base(p, mk, '麦の丘', 'The Wheat Hills', (5.2, 2.2), 'bgm10', win=.9, name='f01')
    day = dict(DAY, ambient='#e9e2de', brighten=.7, gradeAlpha=.04, vignette=.34); m['moods'] = dict(gold=day, shadow=day)
    sp = lambda nm, d: dict(x=mk[nm]['p'][0], y=mk[nm]['p'][1], dir=d)
    m['spawn'] = sp('spawn_village', 'left')
    m['spawns'] = dict(village=sp('spawn_village', 'left'), abbey=sp('spawn_abbey', 'down'), ledge=sp('spawn_ledge', 'left'), west=sp('spawn_west', 'right'))
    v, a, w_ = mk['exit_village']['p'], mk['exit_abbey']['p'], mk['exit_west']['p']
    m['exits'] = [dict(x=v[0], y=v[1], r=46, to='village', spawn='gate'), dict(rect=[a[0] - 70, 0, 140, a[1] + 12], to='abbey', spawn='gate'),
                  dict(rect=[0, w_[1] - 120, w_[0] + 24, 240], closed=['この先は、草の高原。\nここから先は、次の一区切りで作ります。'])]
    T = lambda nm, r, title, **kw: dict(at(mk, nm), r=r, title=title, **kw)
    m['triggers'] = [
        T('sign', 40, '道しるべ', text=['「東　始まりの村」\n「北　崖の修道院」「西　王都」']),
        T('shrine', 40, '道ばたのほこら', text=['旅の無事をいのる、小さなほこら。\nだれかが、麦の穂をそなえている。']),
        T('cedar', 46, '一本杉の根もと', kind='dig', id='cedar', prompt='ほる'),
        dict(at(mk, 'hide_wall'), r=38, kind='spot', id='ch014', title='物かげ'),
        dict(at(mk, 'chest_ledge'), r=40, kind='chest', id='ch015', title='宝箱', prompt='あける', prop=CHEST),
    ]
    c = at(mk, 'chest_ledge')      # the chest nobody reaches from below (chests.csv ch015): say where the way is
    m['triggers'].append(dict(x=c['x'], y=c['y'] + 143, r=44, title='岩棚の下', prompt='見上げる',
                              text=['岩棚の上に、宝箱が見える。\nここからは、登れそうにない。', '崖の上の修道院から、\n降りてくる道があるのかもしれない。']))
    l = mk['spawn_ledge']['p']
    m['triggers'].append(dict(x=l[0], y=l[1] + 46, r=34, kind='jump', title='台のふち', prompt='飛び降りる', to=[l[0], l[1] + 170]))
    m['emitters'] = [fx(mk, 'fx_fields', 700, 500, 'motes', 18), fx(mk, 'fx_road', 700, 300, 'motes', 14), fx(mk, 'fx_cedar', 420, 420, 'leaves', 8),
                     dict(kind='mist', x=0, y=0, w=p['w'], h=p['h'], n=6)]
    m['encounter'] = dict(table='f01', steps=60, near=[v[0], v[1], 620])     # near the village gate only the weakest monsters come out
    m['save'] = 'any'
    return m

if __name__ == '__main__':
    MAPS = dict(village=village, f01=f01)
    try:
        from abbey_map import abbey; MAPS['abbey'] = abbey
    except ImportError: pass
    for name in sys.argv[1:] or [n for n in MAPS if os.path.exists(f'{SL}/{n}/places.json')]:
        m = MAPS[name](); json.dump(m, open(f'{SL}/{name}/map.json', 'w'), ensure_ascii=False, indent=1)
        print(name, 'triggers', len(m['triggers']), 'exits', len(m.get('exits', [])), 'lights', len(m['lights']))
