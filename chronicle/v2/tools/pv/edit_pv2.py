# PV 第2弾「名前を呼ぶ物語」（締めた版・約 2 分 40 秒）の台本。compose.py（映像）と audio.py（音）が読む。秒は台本の時刻。
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
    'b_shigure_attack_2': 0.82, 'b_zafira_attack_2': 1.03, 'b_rouga_attack_1': 1.10,
    'v_hazal_tomb_01': 5.26, 'v_fine_lighthouse_01': 5.06, 'v_berna_lute_04': 8.10, 'v_berna_lute_05': 8.37, 'v_rowell_prologue_02': 4.76,
    'v_fine_t1_02': 4.55, 'b_shigure_victory_1': 2.04, 'b_zafira_victory_1': 2.92, 'b_rouga_victory_1': 2.99, 'v_hero_f_glimmer_1': 1.64,
    'v_hero_f_attack_3': 0.96, 'v_hero_f_spell_2': 0.75, 'v_rowell_t2_03': 3.61, 'b_shigure_bigtech_2': 1.32, 'b_zafira_bigtech_1': 2.31,
    'b_noela_bigtech_1': 2.29, 'b_dokka_bigtech_2': 2.42, 'b_rouga_bigtech_2': 2.87, 'b_ilse_bigtech_1': 2.39, 'v_king_altar_02': 6.19,
    'v_neve_peak_02': 8.42, 'v_glen_ship_03': 8.00, 'v_marina_dawn_01': 2.79, 'v_glen_dawn_01': 4.92, 'v_hazal_tomb_04': 7.20,
    'v_fine_ash_01': 4.39, 'v_fine_isles_01': 4.68, 'b_rouga_attack_3': 0.71, 'b_shigure_attack_3': 1.54, 'b_rouga_hurt_1': 0.79,
}
SUBS = {
    'b_shigure_attack_2': 'シグレ「遅い。」', 'b_zafira_attack_2': 'ザフィラ「ステップ！」', 'b_rouga_attack_1': 'ロウガ「おりゃあ！」',
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
VBOOST = {'v_hero_f_glimmer_1': 4, 'v_hero_f_attack_3': 2, 'v_hero_f_spell_2': 2, 'v_glen_dawn_01': 4, 'v_hazal_tomb_04': 2, 'v_rowell_t2_03': 3,
          'b_noela_bigtech_1': 2, 'b_dokka_bigtech_2': 2, 'b_rouga_bigtech_2': 2, 'b_ilse_bigtech_1': 2, 'v_fine_t1_02': 2, 'v_hazal_tomb_01': 1,
          'b_shigure_attack_2': 2, 'v_king_altar_02': 2}
NOSUB = {'b_rouga_hurt_1', 'b_rouga_attack_3', 'v_hero_f_attack_3'}   # 短い掛け声は字幕にしない


def sub(text, t0, t1, y=1015, size=None):
    """声の字幕（帯の中、または画面の下）"""
    st = dict(size=size) if size else {}
    T.append(dict(kind='sub', text=text, style=st, t0=t0, t1=t1, x=960, y=y, fin=0.2, fout=0.3))


CLIPPED = []   # 場面の終わりで止めた声（確かめ用）


def vo(vid, at, gain=0, y=1015, nosub=False, size=None, tmax=None, until=None):
    """声を置いて、字幕も出す。
    until: その場面の終わり（秒）。声は場面をまたがない: 越える声はそこで短く消し、字幕も切る（持ち主 2026-10-01）"""
    d = dict(file=vid, at=at, gain=gain + VBOOST.get(vid, 0))
    end = at + VDUR.get(vid, 3.0)
    if until is not None and end > until:
        d.update(dur=max(0.2, until - at), fout=0.12)
        CLIPPED.append((vid, round(at, 2), round(end - until, 2)))
    VOICE.append(d)
    if not nosub and vid in SUBS and vid not in NOSUB:
        t1 = at + VDUR.get(vid, 3.0) + 0.35
        for lim in (tmax, until):
            if lim is not None:
                t1 = min(t1, lim)
        sub(SUBS[vid], at - 0.05, t1, y=y, size=size)


def cut(clip, at, dur, src=0.0, ev=False, ev_voice=True, ev_jingle=True, vgain=0, jgain=-5, suby=1015, nosub=False, until_pad=0, **k):
    """until_pad: 同じ場面が次のカットへ続く時だけ、声をその秒だけ先まで許す"""
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
                    vo(e['id'], at + tc, gain=vgain, y=suby, nosub=nosub, until=at + dur + (until_pad or 0))
                elif ev_jingle and e['fn'] == 'jingle':
                    SFX.append(dict(id='jingle_' + e['id'], at=at + tc, gain=jgain))


def cap(kicker, text, t0, t1, band=260, ja=False, size=None, top=False):
    """機能の見出し（左下）: 小さい金（英字。ja=True で地名などの日本語）＋ 大きい白。
    top=True は左上（画面の下に本物の窓が出るカット）"""
    ks = dict(font=FONT_JA_PATH, size=42, track=8) if ja else dict(font=FONT_EN_PATH)
    yk, yt = (128, 205) if top else (838, 915)
    T.append(dict(kind='cap_k', text=kicker, style=ks, t0=t0, t1=t1, x=110, y=yk, anchor=(0, 0.5), anim='slide', fin=0.3, fout=0.3, band=band, band_k=0.75))
    if text:
        st = dict(size=size) if size else {}
        T.append(dict(kind='cap', text=text, style=st, t0=t0 + 0.08, t1=t1, x=104, y=yt, anchor=(0, 0.5), anim='slide', fin=0.3, fout=0.3))


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
# 持ち主 2026-10-01「全体的に間延びしてる」: どの節も一番いい物だけに絞った（台本の 4 分の版は 5d69b2f）
DIP.append((0.0, 2.0))   # 黒から
bars(0.0, LB, 0.01)
MUSIC.append(dict(file='omen', at=0.0, src=0.0, dur=7.0, fout=1.6, gain=-3))
cut('s1_tomb_clean', 0.0, 6.3, src=0.6, zoom=(1.0, 1.14), center=(0.5, 0.42))
vo('v_hazal_tomb_01', 0.9, until=6.3)
# 白い紙に飲まれる → 真っ白
SFX.append(dict(id='page', at=6.15, gain=-2))
cut('s1_white', 6.3, 1.4, src=0.6, xin=0.4, wash=(0.3, 1.0), zoom=(1.06, 1.14))
cut(None, 7.7, 1.9, color=(1.0, 1.0, 1.0))
bars(7.2, 0, 0.6)
tag('この大陸では、物語が消えかけている。', 7.3, 9.5, dark=True, size=72)
# 色が戻る: 白崖の道（左→右）＋ フィーネ
T_CLIFF = 9.6
bars(T_CLIFF, LB, 0.8)
MUSIC.append(dict(file='title', at=T_CLIFF, src=0.0, dur=0, fin=0.8, gain=-1))
T_TITLE = T_CLIFF + DB_TITLE + 2 * BAR_TITLE   # 題字は曲の小節の頭に
cut('s1_cliff', T_CLIFF, T_TITLE - T_CLIFF, src=0.6, xin=0.9, zoom=(1.04, 1.0))
vo('v_fine_lighthouse_01', T_CLIFF + 0.08, until=T_TITLE)
FLASH.append((T_TITLE, 0.25, 0.8, 0.95))
SFX.append(dict(id='bell', at=T_TITLE - 0.05, gain=-3))
bars(T_TITLE - 0.1, 0, 0.3)
cut('s1_title', T_TITLE, 4.0, src=1.2, zoom=(1.0, 1.04), center=(0.3, 0.35))

# ================================================================== 2 物語のはじまり（home・ベルナ 1 行、ロウェルとフィーネは短く）
T2 = T_TITLE + 4.0
MUSIC[-1]['dur'] = T2 - T_CLIFF + 0.4
MUSIC[-1]['fout'] = 0.8
MUSIC.append(dict(file='home', at=T2, src=DB_HOME, dur=0, fin=0.2, gain=-3))
DIP.append((T2, 0.4))
cut('s2_berna', T2, 8.9, src=8.6, ev=True, nosub=True)   # v_berna_lute_05「どこから回ってもいい。…」（本物の会話の窓）
tag('白紙になりかけた八つの伝承を、\n語り直す旅へ。', T2 + 1.0, T2 + 8.7, y=420, size=66)
t = T2 + 8.9
SFX.append(dict(id='page', at=t - 0.05, gain=-6))
cut('s2_rowell', t, 5.15, src=0.05, page=0.45, ev=True, nosub=True)   # v_rowell_prologue_02（本物の会話の窓）
t += 5.15
bars(t, LB, 0.3)
cut('s2_fine', t, 4.9, src=0.2, zoom=(2.3, 2.5), center=(0.6, 0.32))
vo('v_fine_t1_02', t + 0.15, until=t + 4.9)
tag('ライバル、謎の少女。', t + 1.0, t + 4.8, y=430, size=62)
t += 4.9

# ================================================================== 3 主人公と仲間（tavern）
T3 = t
MUSIC[-1]['dur'] = T3 - T2 + 0.3
MUSIC[-1]['fout'] = 0.5
MUSIC.append(dict(file='tavern', at=T3, src=DB_TAVERN, dur=0, fin=0.1, gain=-3))
bars(T3 - 0.25, 0, 0.25)
cut('s3_create', T3, 2.5, src=1.6, gamesfx=-10)                    # 5つのタイプを送る
cut('s3_create', T3 + 2.5, 1.6, src=15.3, xin=0.2, gamesfx=-10)   # リーネの顔の絵
cap('CREATE', '性別 × 5つのタイプ × 得意な武器・属性', T3 + 0.2, T3 + 4.0, size=64)
t = T3 + 4.1
SFX.append(dict(id='page', at=t - 0.05, gain=-6))
# 潮風亭: 20人をなめる → 選ぶ所は少しゆっくりにして、カーソルが乗った瞬間に、その仲間の短い声
T_TAV = t
cut('s3_tavern', t, 1.9, src=2.7, page=0.45, gamesfx=-10)
cap('COMPANIONS', '20人の中から、3人の仲間を', t + 0.3, t + 3.9)
SP = 0.6
TB = t + 1.9
T_TAV_END = TB + (7.12 - 4.6) / SP   # 7.12 秒で酒場の画面が終わる
cut('s3_tavern', TB, T_TAV_END - TB, src=4.6, speed=SP, gamesfx=-10)
PICKS = (('b_shigure_attack_2', 4.98), ('b_zafira_attack_2', 5.85), ('b_rouga_attack_1', 6.50))   # カーソルがその人に乗る時刻（カットの秒）
for k, (vid, land) in enumerate(PICKS):
    nxt = TB + (PICKS[k + 1][1] - 4.6) / SP - 0.05 if k + 1 < len(PICKS) else T_TAV_END
    vo(vid, TB + (land - 4.6) / SP, y=80, until=T_TAV_END, tmax=nxt)   # 字幕は次の人に乗る前に消す
cap('VOICE', '全員ボイス。いつでも入れ替え', t + 4.0, T_TAV_END - 0.1)
t = T_TAV_END
bars(t, LB, 0.3)
cut('s3_coral', t, 3.6, src=1.0, xin=0.3)
tag('どの4人でも、クリアできる。', t + 0.6, t + 3.5, size=62)
t += 3.6

# ================================================================== 4 世界（legend・ページめくり・拍で切る・6 つの地方）
T4 = t
MUSIC[-1]['dur'] = T4 - T3 + 0.3
MUSIC[-1]['fout'] = 0.5
bars(T4 - 0.25, 0, 0.25)
B = BEAT_LEG
WORLD = [  # (カット, src, 拍の数, 地名, 一言)
    ('s4_world', 0.6, 4, None, None),
    ('s4_mirage', 0.3, 3.5, 'ザハラ砂漠', '消灯の刻にだけ開く、一品物の市'),
    ('s4_yule_night', 0.3, 3, 'ノルデン雪原', None),
    ('s4_loch_bells', 0.3, 3, 'グレイモア湿原', None),
    ('s4_cove', 0.4, 3, 'マレア諸島', None),
    ('s4_lava', 0.4, 3, '灰の荒野', None),
    ('s4_crater', 0.4, 3.5, 'オルビス高原', None),
]
MUSIC.append(dict(file='legend', at=T4 - DB_LEG, src=0.0, dur=0, fin=0.05, gain=-2))
for i, (c, src, nb, place, line) in enumerate(WORLD):
    d = nb * B
    cut(c, t, d, src=src, page=0.45 if i else None, gamesfx=-10, zoom=(1.0, 1.05) if i % 2 else (1.05, 1.0))
    if i:
        SFX.append(dict(id='page', at=t - 0.05, gain=-9))
        cap(place, line or '', t + 0.4, t + d - 0.1, ja=True, top=True, band=200 if line else 120)
    else:
        cap('WORLD', '8つの地方を、好きな順番で', t + 0.3, t + d - 0.1)
    t += d

# ================================================================== 5 戦いのしくみ（battle・4 つだけ）
T5 = t
MUSIC[-1]['dur'] = T5 - MUSIC[-1]['at'] + 0.3
MUSIC[-1]['fout'] = 0.4
cut('s5_enc', T5, 1.3, src=0.3, page=0.45)
T_SH = T5 + 0.68          # カットの 0.98 秒で画面が砕ける
SFX.append(dict(id='crit', at=T_SH - 0.03, gain=-4))
MUSIC.append(dict(file='battle', at=T_SH, src=DB_BT, dur=0, gain=-3))
t = T5 + 1.3
# 閃き（技・術の数もここで）
cut('s5_glimmer', t, 1.6, src=6.15, gamesfx=-7)
T_FRZ = t + 1.6
cut('s5_glimmer', T_FRZ, 1.5, src=7.78, freeze=True, grade=dict(sat=0.75, bright=0.8))
FLASH.append((T_FRZ, 0.06, 0.35, 0.5))
SFX.append(dict(id='glimmer', at=T_FRZ, gain=-4))
vo('v_hero_f_glimmer_1', T_FRZ + 0.05, y=1000, until=T_FRZ + 4.75)   # 止め絵から同じ戦闘が続くので、場面の終わりは戦闘の終わり
big('閃き', T_FRZ + 0.02, T_FRZ + 2.7, y=480, subtext='技128・術79が、戦いの中でひらめく', band=440)
cut('s5_glimmer', T_FRZ + 1.5, 3.25, src=7.78, gamesfx=-6, ev=True, ev_jingle=False)   # 抜き打ち → 10.53 で一撃
t = T_FRZ + 4.75
# 合成術
cut('s5_combo', t, 3.2, src=7.0, gamesfx=-6, ev=True, ev_jingle=False, suby=1000)   # 7.57 唱える → 8.27 当たる
FLASH.append((t + 1.27, 0.06, 0.4, 0.3, (1.0, 0.8, 0.6)))
cap('COMBO', '属性を重ねて、合成術。50種', t + 0.2, t + 3.1)
t += 3.2
# 大技の予告 → しのぐ
cut('s5_tell', t, 2.0, src=11.7, gamesfx=-8)          # 「砂に身を沈めはじめた……」
cut('s5_tell', t + 2.0, 2.8, src=35.5, gamesfx=-6)    # 吹き出す砂 → 全員しのぐ
cap('GUARD', '予告を見抜いて、防御', t + 0.2, t + 4.7)
t += 4.8
# 金色の魔物 → レアのドロップ（装備の数もここで）
cut('s5_gold', t, 2.2, src=0.4, gamesfx=-7, ev=True, jgain=-6)
cut('s5_gold', t + 2.2, 1.2, src=6.25, gamesfx=-6)
cut('s5_gold', t + 3.4, 2.4, src=13.05, gamesfx=-8, ev=True, jgain=-5)
cap('RARE', '金色の魔物。レア・超レアのドロップ', t + 0.3, t + 3.3, size=64)
cap('EQUIP', '武器301・防具とアクセサリ745', t + 3.45, t + 5.7)
t += 5.8

# ================================================================== 6 年代記（sorrow の頭に 1 つだけ）
T6 = t
MUSIC[-1]['dur'] = T6 - T_SH + 0.3
MUSIC[-1]['fout'] = 0.5
MUSIC.append(dict(file='sorrow', at=T6 - DB_SOR, src=0.0, dur=0, fin=0.6, gain=-4))
SFX.append(dict(id='page', at=T6 - 0.05, gain=-6))
cut('s6_chapter', T6, 4.6, src=1.7, page=0.5, gamesfx=-8, ev=True, ev_voice=False, jgain=-6)
cap('CHRONICLE', 'あなたの選んだことが、年代記に残る', T6 + 0.4, T6 + 4.5)
t = T6 + 4.6

# ================================================================== 7 想い（帯・字幕・3 つだけ）
T7 = t
bars(T7 - 0.3, LB, 0.6)
STORY7 = [  # (カット, src, 長さ)
    ('s7_hazal_clean', 20.5, 7.75),
    ('s7_marina_clean', 5.75, 8.75),
    ('s7_fine_ash_clean', 2.75, 4.85),
]
for i, (c, src, d) in enumerate(STORY7):
    cut(c, t, d, src=src, xin=0.5, ev=True, gamesfx=-12, zoom=(1.0, 1.06) if i % 2 == 0 else (1.06, 1.0))
    t += d

# ================================================================== 8 戦い（boss2・ロウェルは一瞬、ボスは 4 つ）
T8 = t
MUSIC[-1]['dur'] = T8 - MUSIC[-1]['at'] + 0.3
MUSIC[-1]['fout'] = 0.6
bars(T8 - 0.2, 0, 0.25)
MUSIC.append(dict(file='boss2', at=T8 - DB_BOSS, src=0.0, dur=0, fin=0.05, gain=-3))
cut('s8_rowell', T8, 1.5, src=4.65, gamesfx=-6)   # 戦闘の頭の名の札「ロウェル」
t = T8 + 1.5
BOSS = [  # (カット, src, 長さ, 光の時刻（カットの秒）)
    ('s8_white', 8.0, 2.4, 9.28),      # シグレ
    ('s8_captain', 10.3, 2.6, 11.43),  # ザフィラ
    ('s8_lava', 9.35, 3.1, 10.80),     # ロウガ
    ('s8_star', 9.25, 2.7, 10.52),     # イルゼ
]
for c, src, d, hit in BOSS:
    cut(c, t, d, src=src, ev=True, ev_jingle=False, suby=1000, gamesfx=-6)
    FLASH.append((t + hit - src, 0.04, 0.3, 0.35))
    t += d
# 黒い影 → 白（名前は出さない）。王の声は白の中で終わる（同じ場面）
cut('s8_shadow', t, 2.8, src=2.8, gamesfx=-8, zoom=(1.0, 1.08), center=(0.35, 0.55))
vo('v_king_altar_02', t + 0.2, y=1000, nosub=True, until=t + 6.5)
sub(SUBS['v_king_altar_02'], t + 0.15, t + 4.25, y=1000)
cut('s8_shadow', t + 2.8, 1.4, src=12.65, gamesfx=-6, wash=(0.0, 0.7))
cut(None, t + 4.2, 2.3, color=(1.0, 1.0, 1.0))
FLASH.append((t + 4.2, 0.4, 0.01, 1.0, (1.0, 1.0, 1.0)))
T.append(dict(kind='sub', text=SUBS['v_king_altar_02'], style=dict(color=(40, 30, 24), stroke=0, shadow=False), t0=t + 4.2, t1=t + 6.45, x=960, y=1000, fin=0.05, fout=0.3))
MUSIC[-1]['dur'] = t + 4.3 - MUSIC[-1]['at']
MUSIC[-1]['fout'] = 1.4
t += 6.5

# ================================================================== 9 結び（白 → 年代記の 1 ページ → 灯 4 つ → 題字 → 終わりの札）
T9 = t
cut('s9_page', T9, 5.3, src=0.4, xin=0.8, zoom=(1.05, 1.12), center=(0.5, 0.45), grade=dict(bright=1.05))
vo('v_fine_isles_01', T9 + 0.3, y=1000, until=T9 + 5.3)
t = T9 + 5.3
T_BEACON = t
MUSIC.append(dict(file='dawn', at=T_BEACON, src=21.375, dur=0, fin=0.2, gain=-1))
for i, n in enumerate((3, 5, 7, 8)):   # 白竜・船長・火の鳥・星（森の灯は使わない）
    c = 's9_beacon_%d' % n
    cut(c, t, 0.85, src=0.95, xin=0.12 if i else 0.3)
    cut(c, t + 0.85, BAR_DAWN * 0.75 - 0.85, src=2.75)
    SFX.append(dict(id='light', at=t + 0.02, gain=-10))
    t += BAR_DAWN * 0.75
tag('クリア後も続く物語', t - 4.0, t - 0.1, y=860, size=70)
# 題字
T_LOGO = t
FLASH.append((T_LOGO, 0.2, 0.8, 0.8))
SFX.append(dict(id='bell', at=T_LOGO - 0.05, gain=-4))
cut('s9_title', T_LOGO, 4.0, src=1.0, zoom=(1.0, 1.03), center=(0.3, 0.35))
# 終わりの札（題字の前の夜の大陸の絵の上に）
E0 = T_LOGO + 4.0
cut('s9_title_slow', E0, 6.0, src=2.0, xin=0.7, grade=dict(bright=0.7))


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


# 持ち主 2026-10-01「最後、体験版云々はいらない。これで製品の Steam の動画にする」: 体験版・配信予定の札は出さない（言葉の一覧と会社名だけ）
T.append(dict(kind='end_sub', image=lang_line(), width=1000, t0=E0 + 0.9, t1=E0 + 5.8, x=960, y=560, anim='rise', fin=0.6, fout=0.8))
T.append(dict(kind='end_credit', text='Studio Metem', style=dict(font=FONT_EN_PATH, size=46), t0=E0 + 1.4, t1=E0 + 5.8, x=960, y=760, anim='fade', fin=0.8, fout=0.8))
DIP.append((E0 + 6.0, 1.2))
DURATION = E0 + 6.0
MUSIC[-1]['dur'] = DURATION - T_BEACON
MUSIC[-1]['fout'] = 3.5
