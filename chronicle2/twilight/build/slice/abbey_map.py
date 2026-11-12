"""崖の修道院 マップ1 (the shallow part) for make_maps.py.  The place comes from build/blockout/cliff_world.py, repainted for the slice's one weak sun."""
from make_maps import load, base, at, fx, CHEST, SL
from PIL import Image

def abbey():
    p, mk = load('abbey'); m = base(p, mk, '崖の修道院', 'The Abbey on the Crag', (7.6, 1.0), 'bgm15', back='#77727e', name='abbey')
    # the abbey is empty: the lanterns are cold.  Only the candles behind the nave windows burn.
    m['lights'] = [dict(kind='window', x=mk[n]['air'][0], y=mk[n]['air'][1], gx=mk[n]['p'][0], gy=mk[n]['p'][1] + 150, r=150, color='#ffb46a', intensity=.55, flicker=.1) for n in ('win_c', 'win_l', 'win_r')]
    cr = mk['crystal']['p']; m['lights'].append(dict(kind='crystal', x=cr[0], y=cr[1] - 26, gx=cr[0], gy=cr[1], r=240, color='#ffd08a', intensity=1.7, flicker=.14))
    CW, CHh = Image.open(f'{SL}/prop/crystal.png').size
    m['layers'] = dict(sky=dict(src='sky.webp', parallax=[.2, .5], y=0))
    g = mk['gate']['p']
    m['spawn'] = dict(x=g[0], y=g[1] + 320, dir='up')
    m['spawns'] = dict(gate=m['spawn'], crystal=dict(x=g[0], y=g[1], dir='up'))
    m['exits'] = [dict(rect=[g[0] - 90, p['h'] - 34, 180, 40], to='f01', spawn='abbey')]
    T = lambda nm, r, title, **kw: dict(at(mk, nm), r=r, title=title, **kw)
    chest = lambda nm, cid: dict(at(mk, nm), r=40, kind='chest', id=cid, title='宝箱', prompt='あける', prop=CHEST)
    m['triggers'] = [
        dict(at(mk, 'crystal'), r=46, kind='crystal', title='セーブ結晶', prompt='ふれる', prop=dict(src='~/prop/crystal.png', fw=CW, fh=CHh, foot=[CW // 2, CHh + 6], block=12, shadow=1, bob=3, glow=dict(c='#ffdc96', r=130, a=1.0, sparks=1, up=4))),
        T('altar', 40, '祭壇', text=['ほこりをかぶった祭壇。', '燭台のろうだけが、まだ新しい。\n……だれかが、ここへ通っている。']),
        T('tower', 38, '鐘楼の扉', text=['扉は、内側から閉ざされている。', '見上げると、大きな鐘が、\nだまったまま、ぶら下がっている。', '横の壁が、くずれている。\n……ここから先は、次の一区切りで作ります。']),
        T('lookout', 60, '見晴らし台', text=['麦の丘が、ずっと下に小さく見える。', '弱い日の光が、雲のむこうで、\nにじんでいる。']),
        T('broken', 42, '崩れた階段', kind='warp', prompt='降りる', ask='崩れた階段が、下の台まで続いている。\n降りたら、ここへは登れない。', to='f01', spawn='ledge'),
        chest('chest_nave', 'ch045'), chest('chest_plaza', 'ch047'),
        dict(at(mk, 'hide_tomb'), r=36, kind='spot', id='ch046', title='物かげ'),
    ]
    m['emitters'] = [dict(kind='leaves', x=mk['maple']['p'][0] - 120, y=mk['maple']['p'][1] - 100, w=240, h=200, n=8), fx(mk, 'nave', 300, 280, 'motes', 18),
                     fx(mk, 'graves', 900, 230, 'motes', 10), dict(kind='mist', x=0, y=0, w=p['w'], h=p['h'], n=6)]
    if 'pond' in mk and mk['pond'].get('poly'): m['water'] = [dict(poly=mk['pond']['poly'])]
    m['encounter'] = dict(table='abbey', steps=46)
    m['save'] = 'crystal'
    return m
