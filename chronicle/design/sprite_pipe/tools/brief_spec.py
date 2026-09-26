"""Sheet layouts of design/art_ref/ARUN_REQUEST.md (シート1〜9). One entry per sheet.

Per sheet
  rows, cols      grid of poses (reading order = frame order)
  kind            'field' | 'battle' | 'weapon_row' | 'face'   (palette group + target height)
  target_h        art px, head to feet (face: bust height)
  ids[r][c]       canonical frame ids (the game and the packer use these)
  ja[r][c]        pose names as written in the brief (validator messages quote them)
  face[r]         expected facing per row: 'down' 'up' 'left' 'right' (battle = 'left', face = 'right')
  stand           ids whose height defines the sheet's scale (upright poses)
  air             ids allowed to float above the row's ground line (run / jump / evade)
  no_facing       ids exempt from the facing check (lying, turning back, fleeing, weapons)
  register        {id: base_id} — frames aligned to another frame by body registration
                  (walk steps to the stand frame, breathing B to A, weapon-less to armed)
Rows of sheet 7: row 1 = weapon-less poses, row 2 = weapons ('weapon_row').
"""

FIELD_H, BATTLE_H, FACE_H = 48, 64, 80

SHEETS = {
    1: dict(name='walk', title='歩き（ランタン）', kind='field', rows=4, cols=3, target_h=FIELD_H, required=True,
            ids=[['walk_%s_%d' % (d, i) for i in range(3)] for d in ('down', 'up', 'left', 'right')],
            ja=[['%s・%s' % (d, p) for p in ('立ち', '右足前', '左足前')] for d in ('下向き', '上向き')] +
               [['%s・%s' % (d, p) for p in ('立ち', '前の足', '後ろの足')] for d in ('左向き', '右向き')],
            face=['down', 'up', 'left', 'right']),
    2: dict(name='run', title='走り', kind='field', rows=4, cols=4, target_h=FIELD_H, required=True,
            ids=[['run_%s_%d' % (d, i) for i in range(4)] for d in ('down', 'up', 'left', 'right')],
            ja=[['%s・%s' % (d, p) for p in ('右足で着地', '浮く1', '左足で着地', '浮く2')] for d in ('下向き', '上向き', '左向き', '右向き')],
            face=['down', 'up', 'left', 'right']),
    3: dict(name='act', title='演技ポーズ（下向き）', kind='field', rows=3, cols=4, target_h=FIELD_H, required=True,
            ids=[['act_nod', 'act_surprise', 'act_think', 'act_bow'],
                 ['act_kneel', 'act_sit', 'act_call', 'act_look'],
                 ['act_lie', 'act_draw', 'act_resolve', 'act_sad']],
            ja=[['うなずく', '驚く', '首をかしげる', 'お辞儀'], ['片ひざをつく', '地面に座る', '手を挙げて呼びかける', '見回す'],
                ['倒れて横たわる', '剣を抜いて構える', '胸に手を当てる', 'うつむく']],
            face=['down', 'down', 'down'],
            stand=['act_nod', 'act_surprise', 'act_think', 'act_call', 'act_resolve'],
            no_facing=['act_lie', 'act_look', 'act_bow', 'act_kneel', 'act_sit', 'act_sad']),
    4: dict(name='act2', title='演技ポーズ（上・左向き）', kind='field', rows=2, cols=4, target_h=FIELD_H, required=False,
            ids=[['act_up_nod', 'act_up_surprise', 'act_up_call', 'act_up_draw'],
                 ['act_left_nod', 'act_left_surprise', 'act_left_call', 'act_left_draw']],
            ja=[['上向き・%s' % p for p in ('うなずく', '驚く', '手を挙げる', '剣を構える')],
                ['左向き・%s' % p for p in ('うなずく', '驚く', '手を挙げる', '剣を構える')]],
            face=['up', 'left']),
    5: dict(name='battle_base', title='戦闘の基本ポーズ', kind='battle', rows=2, cols=5, target_h=BATTLE_H, required=True,
            ids=[['idle_a', 'idle_b', 'step', 'guard', 'hit'], ['weak', 'ko', 'victory_a', 'victory_b', 'glimmer']],
            ja=[['待機A', '待機B', '一歩前に踏み出す', '防御', 'ダメージ'], ['瀕死', '戦闘不能', '勝利A', '勝利B', '閃き']],
            face=['left', 'left'],
            stand=['idle_a', 'idle_b', 'step', 'glimmer'],
            no_facing=['ko', 'victory_b'],
            register={'idle_b': 'idle_a'}),
    6: dict(name='battle_action', title='戦闘の行動ポーズ', kind='battle', rows=2, cols=5, target_h=BATTLE_H, required=True,
            ids=[['windup', 'slash', 'thrust_ready', 'thrust', 'charge'], ['smash', 'cast_a', 'cast_b', 'item', 'evade']],
            ja=[['振りかぶり', '振り抜き', '突きの構え', '突き', '大技のため'], ['大技の一撃', '詠唱A', '詠唱B', '道具を使う', '身をかわす']],
            face=['left', 'left'],
            stand=['cast_a', 'cast_b', 'item'],
            air=['smash', 'evade']),
    7: dict(name='battle_bare', title='武器なし版と武器', kind='battle', rows=2, cols=5, target_h=BATTLE_H, required=True,
            ids=[['bare_idle', 'bare_windup', 'bare_slash', 'bare_thrust', 'bare_cast'],
                 ['wpn_sword', 'wpn_greatsword', 'wpn_dagger', 'wpn_bow', 'wpn_staff']],
            ja=[['武器なし・待機A', '武器なし・振りかぶり', '武器なし・振り抜き', '武器なし・突き', '武器なし・詠唱A'],
                ['片手剣', '大剣', '短剣', '弓', '杖']],
            face=['left', None],
            row_kind=[None, 'weapon_row'],
            stand=['bare_idle', 'bare_cast'],
            no_facing=['wpn_sword', 'wpn_greatsword', 'wpn_dagger', 'wpn_bow', 'wpn_staff'],
            # weapon-less pose -> the armed pose it copies (sheet 5 / 6)
            armed={'bare_idle': 'idle_a', 'bare_windup': 'windup', 'bare_slash': 'slash',
                   'bare_thrust': 'thrust', 'bare_cast': 'cast_a'}),
    8: dict(name='battle_extra', title='戦闘の追加ポーズ', kind='battle', rows=1, cols=4, target_h=BATTLE_H, required=False,
            ids=[['flee', 'sleep', 'confuse', 'cover']],
            ja=[['逃げる', '眠り', '混乱', '仲間をかばう']],
            face=['left'],
            stand=['cover'],
            air=['flee'],
            no_facing=['flee', 'sleep']),
    9: dict(name='face', title='顔の表情', kind='face', rows=2, cols=4, target_h=FACE_H, required=True,
            ids=[['face_neutral', 'face_serious', 'face_smile', 'face_laugh'],
                 ['face_surprise', 'face_sad', 'face_angry', 'face_tired']],
            ja=[['通常', '真剣', '微笑み', '笑う'], ['驚き', '悲しみ', '怒り', '疲れ（汗）']],
            face=['right', 'right'],
            stand=['face_neutral', 'face_serious', 'face_smile', 'face_laugh', 'face_surprise', 'face_sad', 'face_angry', 'face_tired'],
            register={k: 'face_neutral' for k in ('face_serious', 'face_smile', 'face_laugh', 'face_surprise', 'face_sad', 'face_angry', 'face_tired')}),
}

# walk / run steps are registered to the row's stand frame (same body position, only the legs move)
for d in ('down', 'up', 'left', 'right'):
    SHEETS[1].setdefault('register', {}).update({'walk_%s_%d' % (d, i): 'walk_%s_0' % d for i in (1, 2)})
    SHEETS[2].setdefault('air', []).extend(['run_%s_1' % d, 'run_%s_3' % d])
SHEETS[1]['stand'] = [i for row in SHEETS[1]['ids'] for i in row]
SHEETS[2]['stand'] = [r[0] for r in SHEETS[2]['ids']] + [r[2] for r in SHEETS[2]['ids']]
SHEETS[4]['stand'] = [i for row in SHEETS[4]['ids'] for i in row]
for s in SHEETS.values():
    s.setdefault('stand', [])
    s.setdefault('air', [])
    s.setdefault('no_facing', [])
    s.setdefault('register', {})
    s.setdefault('row_kind', [None] * s['rows'])

# order in which the brief asks for the sheets (validator prints in this order)
ORDER = [1, 2, 3, 5, 6, 7, 9, 4, 8]


def slot_name(n, r, c):
    return 'シート%d の %d 番（%s）' % (n, r * SHEETS[n]['cols'] + c + 1, SHEETS[n]['ja'][r][c])
