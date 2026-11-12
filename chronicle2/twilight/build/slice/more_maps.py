"""The maps beyond 麦の丘 for make_maps.py: F02 草の高原, 王都 南の大通り, 王都 城門前の広場, 崖の修道院 マップ2.
Places come from build/blockout/f02_world.py, capital_world.py, plaza_world.py, abbey2_world.py; content from the scenario tables
(maps.csv, chests.csv, 依頼12, 依頼14, 依頼1 §2, 依頼5 §2)."""
from make_maps import load, base, at, fx, CHEST, SL, DAY
from PIL import Image

def lamps(p, color='#ffc27a', intensity=.75, flicker=.06):
    """street lamps of the blockout (World.lantern): lit all day in the capital"""
    return [dict(kind='lamp', x=L['p'][0], y=L['p'][1], gx=L['g'][0], gy=L['g'][1], r=L['r'], color=color, intensity=intensity, flicker=flicker) for L in p.get('lights', [])]
def sp(mk, nm, d): return dict(x=mk[nm]['p'][0], y=mk[nm]['p'][1], dir=d)
def T(mk, nm, r, title, **kw): return dict(at(mk, nm), r=r, title=title, **kw)
def npc(mk, nm, title, **kw): return dict(at(mk, 'npc_' + nm), r=50, kind='npc', id=nm, title=title, prop=dict(src='~/npc/%s.png' % nm, block=13, shadow=1), **kw)
def chest(mk, nm, cid, **kw): return dict(at(mk, nm), r=40, kind='chest', id=cid, title='宝箱', prompt='開ける', prop=CHEST, **kw)
def crystal(mk, nm='crystal'):
    CW, CH = Image.open(f'{SL}/prop/crystal.png').size
    return dict(at(mk, nm), r=46, kind='crystal', title='セーブ結晶', prompt='触れる',
                prop=dict(src='~/prop/crystal.png', fw=CW, fh=CH, foot=[CW // 2, CH + 6], block=12, shadow=1, bob=3, glow=dict(c='#ffdc96', r=130, a=1.0, sparks=1, up=4)))
NEXT = 'ここから先は、次の一区切りで作ります。'

def f02():
    p, mk = load('f02'); m = base(p, mk, '草の高原', 'The Grass Plateau', (5.2, 2.2), 'bgm10', name='f02')
    day = dict(DAY, ambient='#e6e2e0', brighten=.68, gradeAlpha=.05, vignette=.34, mist=.36); m['moods'] = dict(gold=day, shadow=day)
    m['spawn'] = sp(mk, 'spawn_east', 'left')
    m['spawns'] = dict(east=sp(mk, 'spawn_east', 'left'), capital=sp(mk, 'spawn_capital', 'down'), south=sp(mk, 'spawn_south', 'up'))
    e, c, s = mk['exit_east']['p'], mk['exit_capital']['p'], mk['exit_south']['p']
    m['exits'] = [dict(rect=[p['w'] - 40, e[1] - 120, 40, 240], to='f01', spawn='west'),
                  dict(x=c[0], y=c[1] + 6, r=50, to='capital', spawn='east'),
                  dict(rect=[s[0] - 90, s[1] - 10, 180, 60], closed=['この坂の下は、大樹の森。\n森の魔物は、高原よりずっと強い。', NEXT])]
    m['triggers'] = [
        T(mk, 'ruin', 46, '白い門', text=['白い石の門。奥は真っ暗で、\n冷たい風が、下から吹き上げてくる。', 'お城よりも古い遺跡だという。\n……中の魔物は、外よりずっと強い。', NEXT]),
        dict(at(mk, 'remains'), r=40, kind='spot', id='ch018', title='冒険者の荷物'),
        dict(at(mk, 'hide_rock'), r=38, kind='spot', id='ch016', title='物かげ'),
        T(mk, 'rock_front', 44, '大岩', text=['見上げるほどの大岩。\n裏へ回りこめそうだ。']),
        T(mk, 'lookout', 46, '崖のふち', text=['崖の下に、森が、ずっと南まで\n広がっている。', '森の真ん中に、ひときわ大きな木が\n一本、かすんで見える。']),
        T(mk, 'milestone', 38, '道しるべ', text=['「東　麦の丘・始まりの村」\n「西　王都」「南　大樹の森」']),
    ]
    m['emitters'] = [fx(mk, 'fx_road', 900, 420, 'motes', 16), fx(mk, 'fx_east', 700, 420, 'motes', 12), fx(mk, 'fx_rim', 1200, 300, 'motes', 12), fx(mk, 'fx_ruin', 420, 300, 'motes', 10),
                     dict(kind='mist', x=0, y=0, w=p['w'], h=p['h'], n=7)]
    if mk.get('pond', {}).get('poly'): m['water'] = [dict(poly=mk['pond']['poly'])]
    se = mk['spawn_east']['p']; m['encounter'] = dict(table='f02', steps=60, near=[se[0], se[1], 760])
    m['save'] = 'any'
    return m

def capital():
    p, mk = load('capital'); m = base(p, mk, '王都', 'The Capital', (6.4, 2.0), 'bgm03', win=.9, name='capital')
    m['subtitle'] = '南の大通り'
    town = dict(DAY, ambient='#cfc8cf', brighten=.5, glow=.75, lightGain=.9); m['moods'] = dict(gold=town, shadow=town)
    m['lights'] += lamps(p)
    m['spawn'] = sp(mk, 'spawn_east', 'left')
    m['spawns'] = dict(start=sp(mk, 'spawn_east', 'left'), east=sp(mk, 'spawn_east', 'left'), west=sp(mk, 'spawn_west', 'right'), south=sp(mk, 'spawn_south', 'up'), north=sp(mk, 'spawn_north', 'down'))
    e, w_, s, n = [mk[k]['p'] for k in ('exit_east', 'exit_west', 'exit_south', 'exit_north')]
    m['exits'] = [dict(rect=[p['w'] - 44, e[1] - 96, 44, 192], to='f02', spawn='capital'),
                  dict(rect=[0, w_[1] - 96, 44, 192], closed=['西門の先は、西の街道。\n霧の港町へ続いている。', NEXT]),
                  dict(rect=[s[0] - 96, p['h'] - 40, 192, 40], closed=['南門の先は、南の街道。\n大きな湖へ続いている。', NEXT]),
                  dict(rect=[n[0] - 144, 0, 288, n[1] + 14], to='plaza', spawn='south')]
    D = lambda nm, title, **kw: T(mk, 'door_' + nm, 46, title, **kw)
    m['triggers'] = [
        npc(mk, 'garam', '酒場の主人ガラム'), npc(mk, 'ryuka', '吟遊詩人のリュカ'), npc(mk, 'nezu', '古地図売りのネズ'), npc(mk, 'hash', '冒険者くずれのハッシュ'),
        npc(mk, 'bren', '武器屋のブレン'), npc(mk, 'sara', '宿の女将サラ'), npc(mk, 'marg', '貴婦人マルグリット'), npc(mk, 'jino', '街灯番の少年ジノ'),
        D('weapon', '武器屋', kind='shop', shop='c_weapon', prompt='店に入る'), D('armor', '防具屋', kind='shop', shop='c_armor', prompt='店に入る'),
        D('item', '道具屋', kind='shop', shop='c_item', prompt='店に入る'), D('inn', '宿「灯守り亭」', kind='inn', price=30, prompt='泊まる'),
        D('tavern', '大酒場「三つ樽」', text=['中は、冒険者でいっぱいだ。\n主人は、外の樽のそばにいる。']),
        T(mk, 'board', 40, '立て札', text=['「東門　草の高原・始まりの村」\n「西門　霧の港町」「南門　湖」', '「北の石段　城門前の広場」']),
        T(mk, 'casks', 44, '三つの大樽', text=['人の背より高い樽が、三つ。\n大酒場「三つ樽」の、看板代わりだ。']),
        dict(at(mk, 'hide_alley'), r=36, kind='spot', id='ch003', title='物かげ'),
    ]
    m['emitters'] = [fx(mk, 'fx_cross', 700, 420, 'motes', 16), fx(mk, 'fx_tavern', 520, 240, 'motes', 12), fx(mk, 'fx_lane', 900, 200, 'motes', 10), dict(kind='mist', x=0, y=0, w=p['w'], h=p['h'], n=4)]
    m['save'] = 'any'
    return m

def plaza():
    p, mk = load('plaza'); m = base(p, mk, '王都', 'The Capital', (6.4, 2.0), 'bgm03', win=.9, name='plaza')
    m['subtitle'] = '城門前の広場'
    town = dict(DAY, ambient='#cfc8cf', brighten=.5, glow=.75, lightGain=.9); m['moods'] = dict(gold=town, shadow=town)
    m['lights'] += lamps(p)
    m['spawn'] = sp(mk, 'spawn_south', 'up')
    m['spawns'] = dict(south=sp(mk, 'spawn_south', 'up'), north=sp(mk, 'spawn_north', 'down'))
    s, n = mk['exit_south']['p'], mk['exit_north']['p']
    m['exits'] = [dict(rect=[s[0] - 144, p['h'] - 40, 288, 40], to='capital', spawn='north'),
                  dict(x=n[0], y=n[1] + 8, r=54, closed=['北門の先は、北の街道の丘。\n丘をこえると、雪の山道になる。', NEXT])]
    m['triggers'] = [
        npc(mk, 'guard', '門番の衛兵'), npc(mk, 'toto', '水路番のじいさんトト'), npc(mk, 'elma', '城の書記エルマ'),
        T(mk, 'castle', 50, 'お城の門', text=['かたく閉じている。']),
        T(mk, 'sewer', 44, '水路の降り口', text=['石段が、暗い水路へ降りている。\n下から、水の音がする。', NEXT]),
        T(mk, 'fountain', 50, '噴水', text=['水の底に、小銭がたくさん沈んでいる。\n……拾うのは、やめておこう。']),
        T(mk, 'nest', 40, '時計塔のてっぺん', prompt='のぞく', flag='nest', text=['塔の窓から、中をのぞいた。', '……鳩の巣が、あるだけだ。']),
        T(mk, 'wall_below', 44, '城壁の下', prompt='見上げる', text=['城壁の上に、宝箱が見える。', '時計塔の横の外階段から、\n城壁の上へ登れる。']),
        chest(mk, 'chest_wall', 'ch004'),
    ]
    m['emitters'] = [fx(mk, 'fx_square', 900, 520, 'motes', 20), fx(mk, 'fx_south', 400, 240, 'motes', 8), dict(kind='mist', x=0, y=0, w=p['w'], h=p['h'], n=4)]
    if mk.get('fountain', {}).get('poly'): m['water'] = [dict(poly=mk['fountain']['poly'])]
    m['save'] = 'any'
    return m

def abbey2():
    p, mk = load('abbey2'); m = base(p, mk, '崖の修道院', 'The Abbey on the Crag', (6.4, 2.6), 'bgm15', name='abbey2')
    m['hd']['grow'] = 6          # pews stand right behind the pillars: a wide rim would carry a pillar's height along the pew beside it
    m['subtitle'] = '身廊と回廊の泉'
    m['lights'] += lamps(p, '#ffb46a', .6, .12)                      # the candle stands: somebody still lights them
    CR = (405, 1250)                                                 # the save crystal stands in the nave, before the boss (the chancel is the boss's)
    m['lights'].append(dict(kind='crystal', x=CR[0], y=CR[1] - 26, gx=CR[0], gy=CR[1], r=240, color='#ffd08a', intensity=1.7, flicker=.14))
    m['spawn'] = sp(mk, 'spawn_south', 'up'); m['spawns'] = dict(south=sp(mk, 'spawn_south', 'up'))
    e = mk['exit_south']['p']
    m['exits'] = [dict(rect=[e[0] - 70, p['h'] - 30, 140, 30], to='abbey', spawn='altar')]
    b = mk['boss']['p']; bl = mk['boss_line']['p']
    # the mid-boss waits on the chancel: crossing the line before the steps starts the fight (rpg.js onStep); once beaten it never comes back
    m['boss'] = dict(id='bs01', rect=[190, bl[1] - 60, 590, 76], intro=['祭壇の上で、何かが、羽を広げた。', '鐘守りの大烏だ！'])
    cry = crystal(mk); cry.update(x=CR[0], y=CR[1])
    m['triggers'] = [
        cry,
        dict(x=b[0], y=b[1], r=1, kind='boss', id='bs01', title='鐘守りの大烏', prop=dict(src='~/mon/bs01.png', fw=139, fh=128, foot=[70, 122], body=118, block=34, shadow=1, bob=2)),
        T(mk, 'altar', 44, '祭壇', text=['祭壇の上に、黒い羽が、何枚も落ちている。', '燭台のろうは、ここも新しい。']),
        chest(mk, 'chest_boss', 'ch049'),
        T(mk, 'tower_door', 40, '鐘楼への扉', text=['鐘楼へ上がる扉。\n向こうで、風が鳴っている。', NEXT]),
        T(mk, 'journal', 40, '見張りの日誌', prompt='読む', text=['読み台に、古い日誌が、\n開いたままになっている。', '「鐘は、引くな。\nあれは、見張りが終わる日にだけ鳴る鐘だ。」']),
        T(mk, 'spring', 54, '回廊の泉', text=['泉の水は、澄んでいる。\n底の石まで、はっきり見える。']),
        T(mk, 'stair_ruin', 42, '崩れた階段', text=['2階へ上がる階段は、途中で崩れている。', '鐘楼の中から、回って行けそうだ。']),
    ]
    m['emitters'] = [fx(mk, 'fx_nave', 420, 700, 'motes', 18), fx(mk, 'fx_chancel', 520, 260, 'motes', 10), fx(mk, 'fx_garden', 420, 380, 'motes', 12), dict(kind='mist', x=0, y=0, w=p['w'], h=p['h'], n=3)]
    if mk.get('spring', {}).get('poly'): m['water'] = [dict(poly=mk['spring']['poly'])]
    m['encounter'] = dict(table='abbey2', steps=46)
    m['save'] = 'crystal'
    return m

MAPS = dict(f02=f02, capital=capital, plaza=plaza, abbey2=abbey2)
