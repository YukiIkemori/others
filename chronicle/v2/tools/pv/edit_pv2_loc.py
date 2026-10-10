# PV 第2弾（edit_pv2.py）の言語別の差し替え表（英語・簡体字中国語・韓国語）。edit_pv2.py が PV_LANG=en|zh|ko の時だけ読む（日本語は読まない）。
#   持ち主 2026-10-10「日本語 PV の台本そのまま。使える場面は使い回す。セリフと文字をその言語に替えるだけ」。
#   txt   : 日本語の文 → その言語の文（edit_pv2.py の L(...) が引く）。用語はゲームの言語表（v2/src/i18n/<言語>/、用語集 glossary.json）に合わせた:
#           Spark（閃き）・Art / Spell（技・術）・Combined Spell（合成術）・Ultimate（必殺技）・Chronicle（年代記）・Storyteller・lights-out（消灯の刻）・
#           地方の名前は places.js の regions.*.name
#   kick  : 見出しの小さい英字（CREATE など）の言語版（英語は英字のまま）
#   ext   : カットの尺の延長（秒）。その言語の声が日本語の枠に入らないカットだけ（edit_pv2.py の dx(キー)）。
#   src   : 撮り直したカットの入点のずらし（秒）。会話の窓が声の長さで進むので、その言語で撮り直した記録から決める（edit_pv2.py の ds(キー)）
#   gain  : 声ごとの音量の補正（dB）。日本語の声との大きさの差（edit/stem で測った値）
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', '..', 'assets', 'fonts')
NUNITO = os.path.join(FONTS, 'Nunito-VF.ttf')
NOTO_SC = os.path.join(FONTS, 'cjk', 'NotoSansSC-VF.ttf')
NOTO_KR = os.path.join(FONTS, 'cjk', 'NotoSansKR-VF.ttf')

LOC = {}

# ------------------------------------------------------------------ English
LOC['en'] = dict(
    voice_dir='en',
    langline='Japanese  ·  English  ·  Simplified Chinese  ·  Traditional Chinese  ·  Korean',   # 終わりの札の対応言語（その言語の言い方）
    body=dict(font=NUNITO, var='Bold'),
    track=dict(cap=1, tag=1, big=8, big_sub=1, kick=6),
    place_cinzel=True,   # 地名は Cinzel（見出しの英字と同じ金）で
    kick={},
    txt={
        'この大陸では、物語が消えかけている。': 'On this continent, stories are fading away.',
        '白紙になりかけた八つの伝承を、\n語り直す旅へ。': 'Eight tales fading into blank pages.\nA journey to retell them.',
        'ライバル、謎の少女。': 'A rival. A mysterious girl.',
        '性別 × 5つのタイプ × 得意な武器・属性': 'Gender × 5 Types × Favored Weapon & Element',
        '20人の中から、3人の仲間を': 'Choose 3 companions from 20',
        '全員ボイス。いつでも入れ替え': 'Every companion voiced. Swap anytime.',
        '選んだ4人が、あなただけの旅になる。': 'The four you choose make the journey yours.',
        '8つの地方を、好きな順番で': 'Eight regions, in any order you like',
        'ザハラ砂漠': 'Zahara Desert', 'ノルデン雪原': 'Norden Snowfields', 'グレイモア湿原': 'Graymoor Marsh',
        'マレア諸島': 'Marea Isles', '灰の荒野': 'Ashen Wastes', 'オルビス高原': 'Orbis Plateau',
        '消灯の刻にだけ開く、一品物の市': 'One-of-a-kind goods, sold only at lights-out',
        '閃き': 'Spark',
        '128の技と79の術を、戦いの中でひらめく': '128 Arts and 79 Spells, sparked in the heat of battle',
        '属性を重ねて生まれる、50の合成術': '50 Combined Spells, born of layered elements',
        'ボスは、必殺技で牙をむく': 'Bosses bare their fangs with Ultimates',
        '予告を見抜いて、防御': 'Read the warning. Guard.',
        '金色の魔物。レア・超レアのドロップ': 'Golden monsters. Rare and Very Rare drops.',
        '1000種を超える武器と防具が、あなたを待つ': 'Over 1,000 weapons and armors await you',
        'あなたの選んだことが、年代記に残る': 'What you choose is written into the Chronicle',
        'クリア後も続く物語': 'The story goes on after the credits',
    },
    ext={'rowell': 1.45, 'eclipse': 0.15, 'king': 1.4, 's8_white': 0.35, 's8_captain': 0.1, 's8_lava': 0.4, 's8_star': 1.45, 'king_white': 1.2}, src={}, gain={'b_hagen_bigtech_1': 1.8, 'b_ilse_bigtech_1': -0.3, 'bv_sandking_ult_1': -0.2, 'v_glen_dawn_01': -2.3, 'v_hazal_tomb_01': -0.2, 'v_hazal_tomb_04': -2.0, 'v_king_altar_02': -1.5, 'v_rowell_prologue_02': -0.3},   # gain: 日本語の声のファイルとの大きさの差（LUFS。日本語の v_glen_dawn_01 などは元が小さく VBOOST で持ち上げてある。言語の声は -16 LUFS にそろっている）
)

# ------------------------------------------------------------------ 简体中文
LOC['zh'] = dict(
    voice_dir='zh',
    langline='日语  ·  英语  ·  简体中文  ·  繁体中文  ·  韩语',
    body=dict(font=NOTO_SC, var='Bold'),
    track=dict(cap=3, tag=6, big=18, big_sub=4, kick=8),
    place_cinzel=False,
    kick={'CREATE': '创建角色', 'COMPANIONS': '同伴', 'VOICE': '语音', 'WORLD': '世界', 'COMBO': '合成术', 'BOSS FINISHER': '必杀技',
          'GUARD': '防御', 'RARE': '稀有', 'EQUIP': '装备', 'CHRONICLE': '编年史'},
    txt={
        'この大陸では、物語が消えかけている。': '在这片大陆上，故事正在渐渐消逝。',
        '白紙になりかけた八つの伝承を、\n語り直す旅へ。': '八个渐渐沦为空白的传说，\n踏上重新讲述之旅。',
        'ライバル、謎の少女。': '对手，神秘少女。',
        '性別 × 5つのタイプ × 得意な武器・属性': '性别 × 5种类型 × 擅长的武器与属性',
        '20人の中から、3人の仲間を': '从20位同伴中，选出3位',
        '全員ボイス。いつでも入れ替え': '全员配音，随时可以更换',
        '選んだ4人が、あなただけの旅になる。': '你所选的四人，将成就只属于你的旅程。',
        '8つの地方を、好きな順番で': '八大地区，按你喜欢的顺序出发',
        'ザハラ砂漠': '扎哈拉沙漠', 'ノルデン雪原': '诺尔登雪原', 'グレイモア湿原': '格雷摩尔湿原',
        'マレア諸島': '马雷亚群岛', '灰の荒野': '灰之荒野', 'オルビス高原': '奥尔比斯高原',
        '消灯の刻にだけ開く、一品物の市': '只在熄灯时分开市，件件独一无二',
        '閃き': '灵光',
        '128の技と79の術を、戦いの中でひらめく': '128种技与79种术，在战斗中灵光一闪',
        '属性を重ねて生まれる、50の合成術': '属性叠加而生，50种合成术',
        'ボスは、必殺技で牙をむく': '首领亮出獠牙，祭出必杀技',
        '予告を見抜いて、防御': '看穿预兆，稳稳防御',
        '金色の魔物。レア・超レアのドロップ': '金色魔物。稀有与超稀有掉落',
        '1000種を超える武器と防具が、あなたを待つ': '超过1000种武器与防具，等待着你',
        'あなたの選んだことが、年代記に残る': '你的每个选择，都会写进编年史',
        'クリア後も続く物語': '通关之后，故事仍在继续',
    },
    ext={'berna': 1.25, 'eclipse': 0.5, 'king': 0.55, 's8_star': 1.25, 'king_white': 1.5}, src={'hazal_at': -0.4}, gain={'v_glen_dawn_01': -2.2, 'v_hazal_tomb_04': -2.1, 'v_king_altar_02': -1.4, 'v_hazal_tomb_01': 1.5, 'v_hero_f_bigtech_2': 1.0},   # gain: 日本語の声のファイルとの大きさの差（LUFS。日本語の v_glen_dawn_01 などは元が小さく VBOOST で持ち上げてある。言語の声は -16 LUFS にそろっている）
)

# ------------------------------------------------------------------ 한국어
LOC['ko'] = dict(
    voice_dir='ko',
    langline='일본어  ·  영어  ·  중국어(간체)  ·  중국어(번체)  ·  한국어',
    body=dict(font=NOTO_KR, var='Bold'),
    track=dict(cap=2, tag=4, big=14, big_sub=3, kick=6),
    place_cinzel=False,
    kick={'CREATE': '캐릭터 생성', 'COMPANIONS': '동료', 'VOICE': '보이스', 'WORLD': '월드', 'COMBO': '합성 술법', 'BOSS FINISHER': '필살기',
          'GUARD': '방어', 'RARE': '레어', 'EQUIP': '장비', 'CHRONICLE': '연대기'},
    txt={
        'この大陸では、物語が消えかけている。': '이 대륙에서, 이야기가 사라져 가고 있다.',
        '白紙になりかけた八つの伝承を、\n語り直す旅へ。': '백지가 되어 가는 여덟 개의 전승을,\n다시 이야기하는 여행으로.',
        'ライバル、謎の少女。': '라이벌, 수수께끼의 소녀.',
        '性別 × 5つのタイプ × 得意な武器・属性': '성별 × 5가지 타입 × 특기 무기·속성',
        '20人の中から、3人の仲間を': '20명 중에서, 3명의 동료를',
        '全員ボイス。いつでも入れ替え': '전원 보이스. 언제든 교체',
        '選んだ4人が、あなただけの旅になる。': '당신이 고른 네 사람이, 당신만의 여행이 된다.',
        '8つの地方を、好きな順番で': '8개의 지방을, 원하는 순서대로',
        'ザハラ砂漠': '자하라 사막', 'ノルデン雪原': '노르덴 설원', 'グレイモア湿原': '그레이모어 습원',
        'マレア諸島': '마레아 제도', '灰の荒野': '잿빛 황야', 'オルビス高原': '오르비스 고원',
        '消灯の刻にだけ開く、一品物の市': '소등의 시각에만 열리는, 하나뿐인 물건의 시장',
        '閃き': '번뜩임',
        '128の技と79の術を、戦いの中でひらめく': '128개의 기술과 79개의 술법이, 전투 중에 번뜩인다',
        '属性を重ねて生まれる、50の合成術': '속성을 겹쳐 태어나는, 50가지 합성 술법',
        'ボスは、必殺技で牙をむく': '보스는 필살기로 송곳니를 드러낸다',
        '予告を見抜いて、防御': '예고를 간파하고, 방어하라',
        '金色の魔物。レア・超レアのドロップ': '황금빛 마물. 레어·초레어 드롭',
        '1000種を超える武器と防具が、あなたを待つ': '1000종이 넘는 무기와 방어구가 당신을 기다린다',
        'あなたの選んだことが、年代記に残る': '당신의 선택이 연대기에 남는다',
        'クリア後も続く物語': '클리어 후에도 이어지는 이야기',
    },
    ext={'tomb': 2.1, 'berna': 0.6, 'glim': 0.5, 'eclipse': 0.2, 'king': 1.45, 's8_white': 0.35, 's8_star': 0.55, 'king_white': 2.55}, src={'hazal_at': -0.6}, gain={'v_fine_lighthouse_01': 0.2, 'v_glen_dawn_01': -2.3, 'v_hazal_tomb_04': -2.1, 'v_king_altar_02': -1.3, 'v_hazal_tomb_01': 1.0, 'b_hagen_bigtech_1': 2.0, 'v_hero_f_bigtech_2': 1.8},   # gain: 日本語の声のファイルとの大きさの差（LUFS。日本語の v_glen_dawn_01 などは元が小さく VBOOST で持ち上げてある。言語の声は -16 LUFS にそろっている）
)
