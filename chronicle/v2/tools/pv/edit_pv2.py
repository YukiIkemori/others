# PV 第2弾「名前を呼ぶ物語」（約 4 分）の台本。compose.py（映像）と audio.py（音）が読む。秒は台本の時刻。
#   台本の元: v2/design/pv/PV2_SCENARIO.md。書き方は edit_main.py と同じ（cut・sub・cap・big、V・T・BARS・FLASH・DIP、MUSIC・VOICE・SFX）。
#   ここで足した物:
#     cut(..., page=秒)            前のコマを紙のようにめくって出す（compose.py の page_turn）
#     cut(..., wash=(a, b))        白く飛ばす（ホワイトアウト）
#     cut(None, ..., color=(1,1,1)) 単色の間
#     cut(..., ev=True)            カットの音の記録（clips/<id>.audio.json）から、声・戦闘の声・ジングルを置く（字幕も自動）
# 台詞はすべてゲームの中の文そのまま（src/i18n/ja/*.js、design/voice/battle_lines.csv）。「」の外の見出しは宣伝の言葉（ゲームのデータから数えた数）。
# 書き出し（PV2 の作業のディレクトリで）:
#   PV_FONTS=<cinzel-700.ttf のディレクトリ> PV_CLIPS=<clips> PV_WORK=<作業のディレクトリ>
#   python3 compose.py edit_pv2.py <clips> video.mp4
#   python3 audio.py edit_pv2.py audio.wav --bgm ../../../assets/bgm --voice ../../../assets/voice --sfx <効果音の WAV> --clips <clips>
#   ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -b:a 256k out.mp4
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_EN_PATH = os.path.join(os.environ.get('PV_FONTS', ''), 'cinzel-700.ttf')
FONT_JA_PATH = os.path.join(HERE, '..', '..', 'assets', 'fonts', 'ZenMaruGothic-Bold.ttf')
CLIPS = os.environ.get('PV_CLIPS', '')
WORK = os.environ.get('PV_WORK', HERE)

# 曲の小節（秒）と、曲の頭から最初の小節の頭までの秒（拍の強さから測った値）
#   title 92BPM 3/4・home 76BPM 3/4・tavern 116BPM・legend 66BPM 4/4・battle 164BPM 4/4・sorrow 66BPM 4/4・boss2 148BPM 4/4・dawn 84BPM 3/4
BAR_TITLE, DB_TITLE = 60 / 92 * 3, 1.282
BAR_HOME, DB_HOME = 60 / 76 * 3, 0.844
DB_TAVERN = 1.049
BEAT_LEG, DB_LEG = 60 / 66, 0.035
BAR_BT, DB_BT = 60 / 164 * 4, 0.711
BAR_SOR, DB_SOR = 60 / 66 * 4, 0.035
BAR_BOSS, DB_BOSS = 60 / 148 * 4, 0.400
BAR_DAWN = 60 / 84 * 3

V, T, SFX, VOICE, MUSIC = [], [], [], [], []
BARS, FLASH, DIP = [], [], []
LB = 130   # 帯の高さ（px）

# 声の長さ（秒）と字幕の文
VDUR = {
    'v_hazal_tomb_01': 5.26, 'v_fine_lighthouse_01': 5.06, 'v_berna_lute_04': 8.10, 'v_berna_lute_05': 8.37, 'v_rowell_prologue_02': 4.76,
    'v_fine_t1_02': 4.55, 'b_shigure_victory_1': 2.04, 'b_zafira_victory_1': 2.92, 'b_rouga_victory_1': 2.99, 'v_hero_f_glimmer_1': 1.64,
    'v_hero_f_attack_3': 0.96, 'v_hero_f_spell_2': 0.75, 'v_rowell_t2_03': 3.61, 'b_shigure_bigtech_2': 1.32, 'b_zafira_bigtech_1': 2.31,
    'b_noela_bigtech_1': 2.29, 'b_dokka_bigtech_2': 2.42, 'b_rouga_bigtech_2': 2.87, 'b_ilse_bigtech_1': 2.39, 'v_king_altar_02': 6.19,
    'v_neve_peak_02': 8.42, 'v_glen_ship_03': 8.00, 'v_marina_dawn_01': 2.79, 'v_glen_dawn_01': 4.92, 'v_hazal_tomb_04': 7.20,
    'v_fine_ash_01': 4.39, 'v_fine_isles_01': 4.68, 'b_rouga_attack_3': 0.71, 'b_shigure_attack_3': 1.54, 'b_rouga_hurt_1': 0.79,
}
SUBS = {
    'v_hazal_tomb_01': '……わが名を……　わが名を、返せ……！',
    'v_fine_lighthouse_01': '言葉を失った灯は、言葉で取り戻すの。',
    'v_berna_lute_05': 'どこから回ってもいい。あなたの足で、あなたの順番で語り直していけばいいのさ。',
    'v_fine_t1_02': 'わたし？　ただの、通りすがりよ。',
    'b_shigure_victory_1': 'シグレ「……他愛ない。」',
    'b_zafira_victory_1': 'ザフィラ「拍手はいらないわ。光る物なら歓迎よ。」',
    'b_rouga_victory_1': 'ロウガ「よっしゃあ！次はもっと強いやつだ！」',
    'v_hero_f_glimmer_1': 'リーネ「……見えた！」',
    'v_hero_f_attack_3': 'リーネ「くらえっ！」',
    'v_hero_f_spell_2': 'リーネ「届けっ！」',
    'v_rowell_t2_03': 'ロウェル「口で言っても分からないなら、力ずくで止める。」',
    'b_shigure_bigtech_2': 'シグレ「一太刀で、足りる。」',
    'b_zafira_bigtech_1': 'ザフィラ「さあ、踊りましょ！」',
    'b_noela_bigtech_1': 'ノエラ「泉の神さま、お力を！」',
    'b_dokka_bigtech_2': 'ドッカ「岩をも割る一撃じゃ！」',
    'b_rouga_bigtech_2': 'ロウガ「この一撃に、全部のせる！」',
    'b_ilse_bigtech_1': 'イルゼ「星の巡りは、こちらに味方。」',
    'b_rouga_attack_3': 'ロウガ「でりゃっ！」',
    'v_king_altar_02': '「無駄だ。名なきものは、消えぬ。」',
    'v_neve_peak_02': 'ネーヴェ「……あたたかい。人の子らは、わたしを忘れてはいなかったのか。」',
    'v_glen_ship_03': 'グレン「……マリナ。そうだ、おれは帰ると約束したんだ。」',
    'v_marina_dawn_01': 'マリナ「おかえりなさい、グレン。」',
    'v_glen_dawn_01': 'グレン「ただいま、マリナ。」',
    'v_hazal_tomb_04': 'ハザル「民は、約束を覚えていてくれたのだな……。」',
    'v_fine_ash_01': 'フィーネ「燃え尽きることと、忘れられることは、違うわ。」',
    'v_fine_isles_01': 'フィーネ「待っている人がいる限り、物語は終わらない。」',
}
# 曲と効果音に埋もれやすい声を少し上げる（dB。stem を測って決めた）
VBOOST = {'v_hero_f_glimmer_1': 4, 'v_hero_f_attack_3': 2, 'v_hero_f_spell_2': 2, 'v_glen_dawn_01': 3, 'v_hazal_tomb_04': 2, 'v_rowell_t2_03': 3,
          'b_noela_bigtech_1': 2, 'b_dokka_bigtech_2': 2, 'b_rouga_bigtech_2': 2, 'b_ilse_bigtech_1': 2, 'v_fine_t1_02': 2, 'v_hazal_tomb_01': 1}
NOSUB = {'b_rouga_hurt_1', 'b_rouga_attack_3', 'v_hero_f_attack_3'}   # 短い掛け声は字幕にしない


def sub(text, t0, t1, y=1015, size=None):
    """声の字幕（帯の中、または画面の下）"""
    st = dict(size=size) if size else {}
    T.append(dict(kind='sub', text=text, style=st, t0=t0, t1=t1, x=960, y=y, fin=0.2, fout=0.3))


def vo(vid, at, gain=0, y=1015, nosub=False, size=None):
    """声を置いて、字幕も出す"""
    VOICE.append(dict(file=vid, at=at, gain=gain + VBOOST.get(vid, 0)))
    if not nosub and vid in SUBS and vid not in NOSUB:
        sub(SUBS[vid], at - 0.05, at + VDUR.get(vid, 3.0) + 0.35, y=y, size=size)


def cut(clip, at, dur, src=0.0, ev=False, ev_voice=True, ev_jingle=True, vgain=0, jgain=-5, suby=1015, nosub=False, **k):
    V.append(dict(clip=clip, at=at, dur=dur, src=src, **k))
    if ev and clip:
        # カットの中で鳴った声・ジングル（audio.py の GAMESFX は効果音だけを写すので、ここで足す）
        p = os.path.join(CLIPS, clip + '.audio.json')
        if os.path.exists(p):
            sp = k.get('speed', 1.0)
            for e in json.load(open(p)):
                tc = (e['f'] / 60.0 - src) / sp
                if not (0 <= tc < dur - 0.05) or not e.get('id'):
                    continue
                if ev_voice and e['fn'] in ('voice', 'battleVoiceId'):
                    vo(e['id'], at + tc, gain=vgain, y=suby, nosub=nosub)
                elif ev_jingle and e['fn'] == 'jingle':
                    SFX.append(dict(id='jingle_' + e['id'], at=at + tc, gain=jgain))


def cap(kicker, text, t0, t1, band=260, ja=False, size=None):
    """機能の見出し（左下）: 小さい金（英字。ja=True で地名などの日本語）＋ 大きい白"""
    ks = dict(font=FONT_JA_PATH, size=42, track=8) if ja else dict(font=FONT_EN_PATH)
    T.append(dict(kind='cap_k', text=kicker, style=ks, t0=t0, t1=t1, x=110, y=838, anchor=(0, 0.5), anim='slide', fin=0.3, fout=0.3, band=band, band_k=0.75))
    if text:
        st = dict(size=size) if size else {}
        T.append(dict(kind='cap', text=text, style=st, t0=t0 + 0.08, t1=t1, x=104, y=915, anchor=(0, 0.5), anim='slide', fin=0.3, fout=0.3))


def tag(text, t0, t1, y=540, size=None, dark=False):
    st = dict(size=size) if size else {}
    if dark:   # 白い画面の上の字（墨の色）
        st.update(color=(52, 40, 30), glow=0, shadow=False)
    T.append(dict(kind='tag', text=text, style=st, t0=t0, t1=t1, x=960, y=y, anim='rise', fin=0.7, fout=0.5))


def big(text, t0, t1, y=500, size=None, subtext=None, band=None):
    st = dict(size=size) if size else {}
    T.append(dict(kind='big', text=text, style=st, t0=t0, t1=t1, x=960, y=y, anim='pop', move=0.3, fin=0.18, fout=0.3, sweep=0.8, sweep_at=0.2, band=band))
    if subtext:
        T.append(dict(kind='big_sub', text=subtext, t0=t0 + 0.2, t1=t1, x=960, y=y + (size or 210) * 0.5 + 60, anim='rise', fin=0.25, fout=0.3))


def kick(text, t0, t1, y=150):
    """節の頭の英字（BATTLE・CHRONICLE など）: 画面の上に金で"""
    T.append(dict(kind='cap_k', text=text, style=dict(font=FONT_EN_PATH, size=64, track=22, glow=14, glow_color=(255, 190, 90), glow_k=0.7),
                  t0=t0, t1=t1, x=960, y=y, anim='rise', fin=0.3, fout=0.35))


def bars(t, h, ramp=0.5):
    """帯を t 秒から ramp 秒かけて h px に"""
    cur = BARS[-1][1] if BARS else 0
    BARS.extend([(t, cur), (t + ramp, h)])


# ================================================================== 1 つかみ（omen → 白 → title）
DIP.append((0.0, 2.4))   # 黒から
bars(0.0, LB, 0.01)
MUSIC.append(dict(file='omen', at=0.0, src=0.0, dur=9.6, fout=2.0, gain=-3))
cut('s1_tomb_clean', 0.0, 7.0, src=0.3, zoom=(1.0, 1.14), center=(0.5, 0.42))
vo('v_hazal_tomb_01', 1.8)
# 白い紙に飲まれる（記録院の白い広間 → 真っ白）
SFX.append(dict(id='page', at=6.85, gain=-2))
cut('s1_white', 7.0, 2.2, src=0.6, xin=0.6, wash=(0.25, 1.0), zoom=(1.06, 1.16))
cut(None, 9.2, 2.7, color=(1.0, 1.0, 1.0))
bars(8.4, 0, 0.8)
tag('この大陸では、物語が消えかけている。', 8.9, 11.8, dark=True, size=72)
# 色が戻る: 白崖の道を夜明け前に歩くリーネ（左→右）
T_CLIFF = 11.9
bars(T_CLIFF, LB, 1.0)
MUSIC.append(dict(file='title', at=T_CLIFF, src=0.0, dur=0, fin=1.2, gain=-1))   # dur は下で決める
T_TITLE = T_CLIFF + DB_TITLE + 3 * BAR_TITLE   # 題字は曲の小節の頭に
cut('s1_cliff', T_CLIFF, T_TITLE - T_CLIFF, src=0.25, xin=1.4, zoom=(1.04, 1.0), center=(0.5, 0.5))
vo('v_fine_lighthouse_01', T_CLIFF + 1.0)
# 題字
FLASH.append((T_TITLE, 0.3, 0.9, 0.95))
SFX.append(dict(id='bell', at=T_TITLE - 0.05, gain=-3))
SFX.append(dict(id='light', at=T_TITLE + 1.35, gain=-8))
bars(T_TITLE - 0.1, 0, 0.3)
cut('s1_title', T_TITLE, 5.0, src=1.0, zoom=(1.0, 1.04), center=(0.3, 0.35))

# ================================================================== 2 物語のはじまり（home）
T2 = T_TITLE + 5.0
MUSIC[-1]['dur'] = T2 - T_CLIFF + 0.6
MUSIC[-1]['fout'] = 1.0
MUSIC.append(dict(file='home', at=T2, src=DB_HOME, dur=0, fin=0.3, gain=-2))
DIP.append((T2, 0.5))
bars(T2, LB, 0.4)
cut('s2_roa_dawn', T2, 4.0, src=0.3, zoom=(1.0, 1.07), center=(0.5, 0.5))
tag('あなたは、語り部の見習い。', T2 + 0.5, T2 + 3.9)
# ベルナ（本物の会話の窓）: 窓を帯で隠さない
t = T2 + 4.0
bars(t - 0.35, 0, 0.35)
cut('s2_berna', t, 8.9, src=8.6, page=0.55, ev=True, nosub=True)   # v_berna_lute_05（8.9 秒）
SFX.append(dict(id='page', at=t - 0.05, gain=-6))
tag('白紙になりかけた八つの伝承を、\n語り直す旅へ。', t + 3.0, t + 8.7, y=420, size=68)   # 年代記の画面のカットは尺のため外した（s2_chronicle）
t += 8.9
# ロウェル（本物の会話の窓）
cut('s2_rowell', t, 5.3, src=0.0, ev=True, nosub=True)   # v_rowell_prologue_02（0.3 秒）
t += 5.3
# 灰色のマントの少女フィーネ（小さな後ろ姿に寄る）
bars(t, LB, 0.4)
cut('s2_fine', t, 5.6, src=0.2, zoom=(2.3, 2.5), center=(0.6, 0.32))
vo('v_fine_t1_02', t + 0.4)
tag('ライバル、謎の少女。\n旅の先で、何が待つのか。', t + 2.2, t + 5.5, y=430, size=62)
t += 5.6

# ================================================================== 3 主人公と仲間（tavern）
T3 = t
MUSIC[-1]['dur'] = T3 - T2 + 0.5
MUSIC[-1]['fout'] = 0.8
MUSIC.append(dict(file='tavern', at=T3, src=DB_TAVERN, dur=0, fin=0.2, gain=-3))
bars(T3 - 0.3, 0, 0.3)
cut('s3_create', T3, 6.4, src=0.3, gamesfx=-10)          # 性別 → 5つのタイプ → 得意の武器・属性
cut('s3_create', T3 + 6.4, 2.8, src=14.6, xin=0.3, gamesfx=-10)   # 名前 → リーネの顔の絵（15.5 秒）
cap('CREATE', '性別 × 5つのタイプ × 得意な武器・属性', T3 + 0.4, T3 + 6.3, size=64)
cap('HERO', 'あなただけの主人公', T3 + 6.6, T3 + 9.1)
t = T3 + 9.2
SFX.append(dict(id='page', at=t - 0.05, gain=-6))
cut('s3_tavern', t, 9.2, src=0.4, page=0.5, gamesfx=-10)
cap('COMPANIONS', '20人の中から、3人の仲間を', t + 0.4, t + 3.7)
cap('VOICE', '全員ボイス。いつでも入れ替え', t + 3.9, t + 9.1)
# 選んだ 3 人の勝ち名乗り（選ぶ時刻 4.2・5.3・6.5 に合わせ、重ならないよう順に）
vo('b_shigure_victory_1', t + 3.9, y=80)
vo('b_zafira_victory_1', t + 6.0, y=80)
vo('b_rouga_victory_1', t + 9.0, y=80)
t += 9.2
# 4人で港町コーラルの道を奥へ
bars(t, LB, 0.4)
cut('s3_coral', t, 5.4, src=0.3, xin=0.4)
T.append(dict(kind='tag', text='強い仲間が後から入ることはない。\nどの4人でも、クリアできる。', style=dict(size=58), t0=t + 1.6, t1=t + 5.3,
              x=960, y=540, anim='rise', fin=0.6, fout=0.5))
t += 5.4

# ================================================================== 4 どこから旅してもいい世界（legend・ページめくり・拍で切る）
T4 = t
MUSIC[-1]['dur'] = T4 - T3 + 0.4
MUSIC[-1]['fout'] = 0.6
bars(T4 - 0.3, 0, 0.3)
B = BEAT_LEG
WORLD = [  # (カット, src, 拍の数, 地名, 一言)
    ('s4_world', 0.5, 5, None, None),
    ('s4_mirage', 0.3, 3.5, 'ザハラ砂漠', '消灯の刻にだけ開く、一品物の市'),
    ('s4_yule_night', 0.3, 2.5, 'ノルデン雪原', None),
    ('s4_snow_base', 2.9, 4, 'ノルデン雪原', '合言葉、謎解き、寄り道'),
    ('s4_loch_bells', 0.3, 2.5, 'グレイモア湿原', None),
    ('s4_loch_naming', 0.5, 3.5, 'グレイモア湿原', '証拠を集めて、犯人を名指し'),
    ('s4_tide', 3.1, 3.5, 'マレア諸島', '潮の満ち引きで変わる洞窟'),
    ('s4_cove', 0.4, 2, 'マレア諸島', None),
    ('s4_rail', 0.4, 2.5, 'ガルド山地', None),
    ('s4_dovan', 0.4, 2.5, 'ガルド山地', None),
    ('s4_spa', 0.4, 2.5, '灰の荒野', None),
    ('s4_lava', 0.4, 2.5, '灰の荒野', None),
    ('s4_crater', 0.4, 2.5, 'オルビス高原', None),
    ('s4_orbis', 0.4, 2.5, 'オルビス高原', None),
    ('s4_leads', 0.3, 4, None, None),
]
t = T4
MUSIC.append(dict(file='legend', at=T4 - DB_LEG, src=0.0, dur=38.07, fin=0.05, gain=-2))
MUSIC.append(dict(file='legend', at=T4 - DB_LEG + 38.07, src=9.009, dur=0, fin=0.03, gain=-2))   # 曲の輪（loopStart へ戻る）
spans = []
for i, (c, src, nb, place, line) in enumerate(WORLD):
    d = nb * B
    cut(c, t, d, src=src, page=0.5 if i else None, xin=None if i else 0.3, gamesfx=-10, zoom=(1.0, 1.04) if i % 2 else (1.04, 1.0))
    if i:
        SFX.append(dict(id='page', at=t - 0.05, gain=-9))
    spans.append((t, t + d, place, line))
    t += d
T_LEADS = spans[-1][0]
cap('WORLD', '8つの地方を、好きな順番で', T4 + 0.5, spans[0][1] - 0.1)
# 地名（同じ地名の続くカットは 1 つの札）と一言
k = 1
while k < len(spans) - 1:
    j = k
    while j + 1 < len(spans) - 1 and spans[j + 1][2] == spans[k][2]:
        j += 1
    lines = [s[3] for s in spans[k:j + 1] if s[3]]
    cap(spans[k][2], lines[0] if lines else '', spans[k][0] + 0.45, spans[j][1] - 0.1, ja=True)
    k = j + 1
cap('LEADS', 'うわさを追えば、次の行き先が見える', T_LEADS + 0.4, t - 0.15)

# ================================================================== 5 戦いのしくみ（battle）
T5 = t
MUSIC[-1]['dur'] = T5 - MUSIC[-1]['at'] + 0.4
MUSIC[-1]['fout'] = 0.5
cut('s5_enc', T5, 1.75, src=0.3, page=0.5)
T_SH = T5 + 0.68          # カットの 0.98 秒で画面が砕ける
SFX.append(dict(id='crit', at=T_SH - 0.03, gain=-4))
MUSIC.append(dict(file='battle', at=T_SH, src=DB_BT, dur=0, gain=-3))
t = T5 + 1.75
# 閃き: リーネの頭に電球 → 止めて大きく「閃き」→ その技（抜き打ち）で一撃
cut('s5_glimmer', t, 1.85, src=5.9, gamesfx=-7)
T_FRZ = t + 1.85
cut('s5_glimmer', T_FRZ, 1.5, src=7.78, freeze=True, grade=dict(sat=0.75, bright=0.8))
FLASH.append((T_FRZ, 0.06, 0.35, 0.5))
SFX.append(dict(id='glimmer', at=T_FRZ, gain=-4))
vo('v_hero_f_glimmer_1', T_FRZ + 0.05, y=1000)
big('閃き', T_FRZ + 0.02, T_FRZ + 2.6, y=480, subtext='戦いの中で、技も術もひらめく', band=440)
cut('s5_glimmer', T_FRZ + 1.5, 3.3, src=7.78, gamesfx=-6, ev=True, ev_jingle=False)   # 抜き打ちの名 → 10.53 で一撃
t = T_FRZ + 4.8
# 技・術の一覧（閃いた技に NEW の札）
cut('s5_book', t, 3.8, src=0.5, xin=0.25, gamesfx=-12)
cap('SKILLS', '技128・術79', t + 0.3, t + 3.7)
t += 3.8
# 合成術（煮え湯の雨＝火×水）
cut('s5_combo', t, 3.3, src=6.9, gamesfx=-6, ev=True, ev_jingle=False, suby=1000)   # 7.57 唱える → 8.27 当たる
FLASH.append((t + 1.37, 0.06, 0.4, 0.3, (1.0, 0.8, 0.6)))
cap('COMBO', '属性を重ねて、合成術。50種', t + 0.2, t + 3.2)
t += 3.3
# 大技の予告 → 防御 → しのぐ（砂もぐり）
cut('s5_tell', t, 2.4, src=11.5, gamesfx=-8)          # 「砂に身を沈めはじめた……」
cut('s5_tell', t + 2.4, 3.0, src=35.5, gamesfx=-6)    # 吹き出す砂 → 全員しのぐ
cap('GUARD', '予告を見抜いて、防御', t + 0.2, t + 5.3)
t += 5.4
# 金色の魔物 → レアのジングル → サンゴの細剣★
cut('s5_gold', t, 2.3, src=0.35, gamesfx=-7, ev=True, jgain=-6)
cut('s5_gold', t + 2.3, 1.3, src=6.2, gamesfx=-6)
cut('s5_gold', t + 3.6, 2.2, src=13.05, gamesfx=-8, ev=True, jgain=-5)
cap('RARE', '金色の魔物。レア・超レアのドロップ', t + 0.3, t + 5.7, size=64)
t += 5.8
# 図鑑
cut('s5_bestiary', t, 3.4, src=0.3, xin=0.25, gamesfx=-12)
cap('BESTIARY', '集めて、埋める', t + 0.3, t + 3.3)
t += 3.4
# 装備: 8つの枠 →「いちばん強く」で一発で整う
cut('s5_equip', t, 3.6, src=2.3, gamesfx=-10)
cap('EQUIP', '武器301・防具とアクセサリ745', t + 0.3, t + 3.5)
t += 3.6
# リピートと速さの切り替え
cut('s5_speed', t, 3.0, src=1.2, gamesfx=-9)
cut('s5_speed', t + 3.0, 2.5, src=9.84, gamesfx=-9, ev=True, ev_voice=False, jgain=-7)
cap('SPEED', 'リピート・速さ切り替え', t + 0.3, t + 3.0)
cap('RETRY', '全滅しても、直前からやり直し', t + 3.1, t + 5.4)
t += 5.5

# ================================================================== 6 あなたの選択が、年代記になる
T6 = t
MUSIC[-1]['dur'] = T6 - T_SH + 0.3
MUSIC[-1]['fout'] = 0.6
MUSIC.append(dict(file='title', at=T6, src=48.9, dur=0, fin=0.4, gain=-4))
cut('s6_write', T6, 3.3, src=1.6, page=0.55, gamesfx=-10)
SFX.append(dict(id='page', at=T6 - 0.05, gain=-6))
cut('s6_write', T6 + 3.3, 2.4, src=6.3, xin=0.25, gamesfx=-8)
cap('CHRONICLE', 'あなたの選んだことが、年代記に残る', T6 + 0.4, T6 + 5.6)
t = T6 + 5.7
cut('s6_chapter', t, 4.8, src=1.6, xin=0.3, gamesfx=-8, ev=True, ev_voice=False, jgain=-6)
cap('CHRONICLE', '8つの地方 × あなたの選択', t + 2.5, t + 4.7)
t += 4.8

# ================================================================== 7 想い（sorrow・帯・字幕）
T7 = t
MUSIC[-1]['dur'] = T7 - T6 + 0.4
MUSIC[-1]['fout'] = 1.2
MUSIC.append(dict(file='sorrow', at=T7 - DB_SOR, src=0.0, dur=0, fin=0.8, gain=-4))
bars(T7 - 0.4, LB, 0.8)
DIP.append((T7, 0.8))
STORY7 = [  # (カット, src, 長さ)
    ('s7_neve_clean', 1.55, 9.4),
    # ('s7_glen_clean', 8.25, 8.9),   # 幽霊船のグレン: 尺のため外した（岬の夜明けの 2 人の声で伝わる）
    ('s7_marina_clean', 5.65, 9.2),
    ('s7_hazal_clean', 20.45, 7.9),
    ('s7_fine_ash_clean', 2.65, 5.2),
]
for i, (c, src, d) in enumerate(STORY7):
    cut(c, t, d, src=src, xin=0.6 if i else None, ev=True, gamesfx=-12, zoom=(1.0, 1.06) if i % 2 == 0 else (1.06, 1.0))
    t += d
# 火の鳥の灯がともる（光の柱）
cut('s7_firebird', t, 3.6, src=20.2, xin=0.5, gamesfx=-6, zoom=(1.0, 1.05))
FLASH.append((t + 0.85, 0.25, 0.9, 0.55, (1.0, 0.85, 0.6)))
t += 3.6

# ================================================================== 8 戦い（boss2・1 カット 2 小節ほど）
T8 = t
MUSIC[-1]['dur'] = T8 - MUSIC[-1]['at'] + 0.3
MUSIC[-1]['fout'] = 0.8
bars(T8 - 0.2, 0, 0.3)
MUSIC.append(dict(file='boss2', at=T8 - DB_BOSS, src=0.0, dur=0, fin=0.05, gain=-3))
# ロウェルと向き合う（会話の窓）→ 画面が砕けて戦闘へ
cut('s8_rowell', T8, 2.95, src=1.5, ev=True, nosub=True, gamesfx=-6)
SFX.append(dict(id='crit', at=T8 + 1.62, gain=-5))
cut('s8_rowell', T8 + 2.95, 2.0, src=4.6, gamesfx=-6)
sub(SUBS['v_rowell_t2_03'], T8 + 1.7, T8 + 4.4, y=1000)   # 会話の窓が消えた後も声は続くので、窓が消える所から字幕
t = T8 + 4.95
BOSS = [  # (カット, src, 長さ, 光の時刻（カットの秒）)
    ('s8_white', 7.9, 2.6, 9.28),
    ('s8_captain', 10.05, 2.6, 11.43),
    ('s8_mist', 6.95, 1.2, None),
    ('s8_mist', 15.2, 2.3, 16.28),
    ('s8_iron', 9.1, 2.6, 10.52),
    ('s8_lava', 9.1, 2.8, 10.80),
    ('s8_star', 9.1, 2.6, 10.52),
]
for c, src, d, hit in BOSS:
    cut(c, t, d, src=src, ev=True, ev_jingle=False, suby=1000, gamesfx=-6)
    if hit:
        FLASH.append((t + hit - src, 0.04, 0.3, 0.35))
    t += d
# 黒い影が覆い、白くなる（名前は出さない）
T_SH8 = t
cut('s8_shadow', t, 3.0, src=2.6, gamesfx=-8, zoom=(1.0, 1.08), center=(0.35, 0.55))
vo('v_king_altar_02', t + 0.3, y=1000)
cut('s8_shadow', t + 3.0, 1.5, src=12.6, gamesfx=-6, wash=(0.0, 0.7))
cut(None, t + 4.5, 1.8, color=(1.0, 1.0, 1.0))
FLASH.append((t + 4.5, 0.4, 0.01, 1.0, (1.0, 1.0, 1.0)))
MUSIC[-1]['dur'] = t + 4.6 - MUSIC[-1]['at']
MUSIC[-1]['fout'] = 1.4
t += 6.3

# ================================================================== 9 結び（白 → 年代記の 1 ページ → 八つの灯 → 題字 → 終わりの札）
T9 = t
cut('s9_page', T9, 5.3, src=0.4, xin=1.2, zoom=(1.05, 1.12), center=(0.5, 0.45), grade=dict(bright=1.05))
vo('v_fine_isles_01', T9 - 0.6, y=1000)   # 白の中から声
t = T9 + 5.3
T_BEACON = t
MUSIC.append(dict(file='dawn', at=T_BEACON, src=21.375, dur=0, fin=0.2, gain=-1))
for i in range(8):
    c = 's9_beacon_%d' % (i + 1)
    cut(c, t, 0.78, src=0.9, xin=0.12 if i else 0.3)
    cut(c, t + 0.78, BAR_DAWN * 0.6 - 0.78, src=2.75)
    SFX.append(dict(id='light', at=t + 0.02, gain=-10))
    t += BAR_DAWN * 0.6
tag('クリア後も続く物語', t - 4.2, t - 0.1, y=860, size=70)
# 題字
T_LOGO = t
FLASH.append((T_LOGO, 0.2, 0.8, 0.8))
SFX.append(dict(id='bell', at=T_LOGO - 0.05, gain=-4))
cut('s9_title', T_LOGO, 5.0, src=0.9, zoom=(1.0, 1.03), center=(0.3, 0.35))
# 終わりの札（題字の前の夜の大陸の絵の上に）
E0 = T_LOGO + 5.0
cut('s9_title_slow', E0, 7.5, src=2.0, xin=0.8, grade=dict(bright=0.7))


def lang_line():
    """日本語・English・简体中文・繁體中文・한국어 を、それぞれの字が出る書体で 1 枚の絵に"""
    out = os.path.join(WORK, 'pv2_lang.png')
    if os.path.exists(out):
        return out
    from PIL import Image, ImageDraw, ImageFont
    cjk = os.path.join(HERE, '..', '..', 'assets', 'fonts', 'cjk')

    def vf(name, size):
        f = ImageFont.truetype(os.path.join(cjk, name), size)
        try:
            f.set_variation_by_name('Medium')
        except Exception:
            pass
        return f
    S = 44
    ja = ImageFont.truetype(os.path.join(HERE, '..', '..', 'assets', 'fonts', 'ZenMaruGothic-Medium.ttf'), S)
    parts = [('日本語', ja), ('・', ja), ('English', ja), ('・', ja), ('简体中文', vf('NotoSansSC-VF.ttf', S - 2)), ('・', ja),
             ('繁體中文', vf('NotoSansTC-VF.ttf', S - 2)), ('・', ja), ('한국어', vf('NotoSansKR-VF.ttf', S - 2))]
    w = int(sum(f.getlength(s) for s, f in parts)) + 40
    h = S * 2
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(im), ImageDraw.Draw(sh)
    x = 20
    for s, f in parts:
        ds.text((x + 2, h // 2 + 3), s, font=f, fill=(0, 0, 0, 200), anchor='lm')
        d.text((x, h // 2), s, font=f, fill=(236, 226, 204, 255), anchor='lm')
        x += f.getlength(s)
    from PIL import ImageFilter
    sh = sh.filter(ImageFilter.GaussianBlur(3))
    Image.alpha_composite(sh, im).save(out)
    return out


T.append(dict(kind='end_main', text='体験版 配信中', style=dict(size=96), t0=E0 + 0.9, t1=E0 + 7.3, x=960, y=400, anim='rise', fin=0.6, fout=0.8, sweep=1.1, sweep_at=0.6))
T.append(dict(kind='end_sub', text='Steamにて配信予定', t0=E0 + 1.4, t1=E0 + 7.3, x=960, y=530, anim='rise', fin=0.6, fout=0.8))
T.append(dict(kind='end_sub', image=lang_line(), width=1000, t0=E0 + 1.9, t1=E0 + 7.3, x=960, y=640, anim='rise', fin=0.6, fout=0.8))
T.append(dict(kind='end_credit', text='Studio Metem', style=dict(font=FONT_EN_PATH, size=46), t0=E0 + 2.5, t1=E0 + 7.3, x=960, y=850, anim='fade', fin=0.8, fout=0.8))
DIP.append((E0 + 7.5, 1.2))
DURATION = E0 + 7.5
MUSIC[-1]['dur'] = DURATION - T_BEACON
MUSIC[-1]['fout'] = 3.5
