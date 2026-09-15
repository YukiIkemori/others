#!/usr/bin/env python3
"""汐見の家 — about / rooms / meals / access を第2版の意匠で書き出す。"""
import json, os, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bp", os.path.join(HERE, "build-pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)

ROOT = bp.ROOT
MAN = {m["name"]: m for m in json.load(open(os.path.join(ROOT, "img", "manifest.json")))}


def im(name, sizes, cls="", lazy=True, up="../"):
    m = MAN[name]
    widths = tuple(sorted(s["w"] for s in m["sizes"]))
    big = m["sizes"][0]
    return bp.img(name, m["alt"], big["w"], big["h"], sizes, widths, up, lazy, cls)


def photo(name, ratio, sizes, up="../"):
    return f'<figure class="photo photo--{ratio}">{im(name, sizes, up=up)}</figure>'


S_HALF = "(min-width: 62em) 44vw, 100vw"
S_FULL = "100vw"
S_OVER = "(min-width: 62em) 62vw, 100vw"
S_STRIP = "(min-width: 62em) 34vw, 100vw"


def collage(items, up="../"):
    """items: [(写真名, 比率, 見出し, [段落…])]"""
    out = ['        <ol class="side-layout__body collage numbered">']
    for name, ratio, h3, paras in items:
        ps = "\n".join(f"              <p>{t}</p>" for t in paras)
        out.append(f'''
          <li class="collage__item">
            {photo(name, ratio, S_HALF, up)}
            <div class="collage__body">
              <span class="numbered__n" aria-hidden="true"></span>
              <h3>{h3}</h3>
{ps}
            </div>
          </li>''')
    out.append("        </ol>")
    return "\n".join(out)


def deflist(rows):
    out = ['      <dl class="def-list">']
    for dt, dd in rows:
        out.append(f'        <div><dt>{dt}</dt><dd>{dd}</dd></div>')
    out.append("      </dl>")
    return "\n".join(out)


def overlap(name, ratio, sizes, h2, hid, paras, more=None, flip=False, up="../"):
    ps = "\n".join(f"        <p>{t}</p>" for t in paras)
    ml = f'\n        <a class="more-link" href="{more[0]}">{more[1]}</a>' if more else ""
    cls = "overlap overlap--flip" if flip else "overlap"
    return f'''
    <div class="{cls}">
      <figure class="overlap__media photo photo--{ratio}">{im(name, sizes, up=up)}</figure>
      <div class="overlap__panel">
        <h2 id="{hid}">{h2}</h2>
{ps}{ml}
      </div>
    </div>
'''


# ─────────────────────────────────────────────── about
about = [
 bp.head("汐見の家について｜汐見の家",
   "瀬戸内・佐島の古民家ゲストハウス。大正期に渡米した日系一世ロバート汐見ゆかりの家を改装し、2016年4月に開業しました。素泊り1泊5,500円、定員7名。",
   "/about/"),
 bp.header("/about/"),
 bp.breadcrumb([("汐見の家について", None)]),
 bp.page_head("汐見の家について", "瀬戸内海に浮かぶ佐島の、築百年を越えた古民家です。"),
 f'''
  <section class="band band--flush">
    <figure class="photo photo--wide">{im("garden", S_FULL)}</figure>
  </section>

  <section class="band">
    <div class="container">
{bp.side("この家のこと", f"""          <div class="prose">
            <p>汐見の家は、オーナーの祖父の実家です。母の旧姓が汐見。それがそのまま宿の名前になりました。</p>
            <p>2012年4月、空き家になって久しいこの家を処分するため、30年ぶりに佐島を訪れました。ところがしまなみ海道の美しさとこの家の佇まいに心を打たれ、1年半迷った末に、再生へ舵を切ることにしたのです。</p>
            <p>そこから1年かけて手立てを探し、さらに1年半かけて第一期の改修を終え、開業を迎えたのが2016年4月でした。遠距離、知識無し、お金無しの三重苦のなか、人に助けていただくほか方法がありませんでした。再生の記録は読み物にまとめてあります。</p>
            <p>「汐見」という名は、この家に生まれ、13歳で単身アメリカへ渡って医師になった日系一世、ロバート・一（ハジメ）・汐見に由来します。彼の生涯も読み物にしました。</p>
          </div>

          <ol class="index-list numbered">
            <li><a href="/stories/shiomi/">
              <span class="numbered__n" aria-hidden="true"></span>
              <span class="index-list__title">アメリカ日系一世 ロバート汐見の足跡</span>
              <span class="index-list__desc">1904年にこの家で生まれ、13歳で渡米。日系人強制収容を経て、生涯を通じて留学生を支えた人の記録。全7回。</span>
            </a></li>
            <li><a href="/stories/renovation/">
              <span class="numbered__n" aria-hidden="true"></span>
              <span class="index-list__title">古民家再生の記録</span>
              <span class="index-list__desc">2012年の「はじまり」から、井戸、五右衛門風呂、壁塗り、第二期改修まで。</span>
            </a></li>
          </ol>""")}
    </div>
  </section>

  <section class="band">
    <div class="container">
      <div class="band__head"><h2 id="price-h">料金</h2></div>
      <dl class="facts-strip facts-strip--price">
        <div><dt>宿泊料</dt><dd><strong class="price"><span class="price__label">素泊り 1泊</span> <span class="nowrap"><span class="figure">5,500</span><span class="price__unit">円</span></span></strong><small>小学生は半額、乳幼児1人まで無料</small></dd></div>
        <div><dt>一棟貸し</dt><dd>1泊 <span class="nowrap"><span class="figure figure--small">30,000</span>円</span></dd></div>
        <div><dt>シェアごはん</dt><dd><span class="nowrap">夕飯 1,600円</span><br><span class="nowrap">朝飯 700円</span></dd></div>
        <div><dt>定員</dt><dd><span class="nowrap"><span class="figure figure--small">7</span>名</span><small>超える場合や長期滞在はご相談ください</small></dd></div>
        <div><dt>チェックイン</dt><dd><span class="nowrap"><span class="figure figure--small">15:00</span></span><small>チェックアウト 10:00</small></dd></div>
        <div><dt>お問い合わせ</dt><dd><a class="nowrap" href="tel:0897729800">0897-72-9800</a></dd></div>
      </dl>
      <a class="more-link" href="/reserve/">ご予約・お問い合わせ</a>
    </div>
  </section>

  <section class="band band--flush">
{overlap("guests-engawa", "3x2", S_OVER, "過ごし方", "stay-h",
   ["何をするでもなく、縁側に座って庭を眺めている方が多いです。ピアノを弾く方、井戸を汲んでみる方、五右衛門風呂を自分で焚く方（前日までにご相談ください）もいます。",
    "夕方になると、台所からシェアごはんの支度の音が聞こえてきます。"])}
  </section>

  <section class="band">
    <div class="container">
{bp.side("お願いしていること", deflist([
  ("チェックイン・アウト", "15時と10時が目安です。事前におおよその時間をご連絡ください。"),
  ("門限", "ありません。ただし静かな集落にあり、20時を過ぎると静まり返ります。就寝中のお客さまや近隣のご迷惑にならないよう、静かな出入りをお願いします。"),
  ("お部屋", "襖で仕切られた和室に布団を敷きます。相部屋で始めた宿ですが、いまは原則としてグループごとの個室です。"),
  ("使える時間", "シャワー、ドライヤー、洗面台、キッチン、掘りごたつの間、玄関土間は6時〜24時。洗濯機は22時までにお願いします。"),
  ("宿帳", "ご住所などは当日ご記帳いただきます。"),
]))}
    </div>
  </section>

  <section class="band">
    <div class="container">
      <div class="band__head">
        <h2 id="garden-h">庭のこと</h2>
      </div>
      <div class="prose">
        <p>庭のデザインは関晴子さん（Studio Lasso Ltd）によるものです。庭の写真は嶋谷元さんに撮っていただきました。</p>
        <p>この家の再生は、たくさんの方に助けられて進みました。お名前は Special Thanks にまとめてあります。</p>
      </div>
      <a class="more-link" href="/thanks/">Special Thanks</a>
    </div>
  </section>
''',
 bp.cta(),
 bp.footer(),
]

# ─────────────────────────────────────────────── rooms
rooms = [
 bp.head("部屋と設備｜汐見の家",
   "襖で仕切られた和室3室、定員7名。薪で焚く五右衛門風呂、手押しポンプの井戸、簡易イスラム礼拝室、掘りごたつとピアノ。工芸家の作による洗面台もあります。",
   "/rooms/"),
 bp.header("/rooms/"),
 bp.breadcrumb([("部屋と設備", None)]),
 bp.page_head("部屋と設備", "襖で仕切られた和室に布団を敷きます。定員は7名です。"),
 f'''
  <section class="band">
    <div class="container">
{bp.side("居室", """          <div class="prose">
            <p>奥の間（6畳）、表の間（6畳）、天窓の間（3畳）の3室。ご宿泊の人数によって融通して使います。相部屋で始めた宿ですが、いまは原則としてグループごとの個室です。</p>
          </div>""")}
    </div>
  </section>

  <section class="band band--flush">
    <ul class="strip">
      <li>{photo("room-oku", "3x2", S_STRIP)}<span class="strip__caption">奥の間（6畳）</span></li>
      <li>{photo("room-omote", "3x2", S_STRIP)}<span class="strip__caption">表の間（6畳）</span></li>
      <li>{photo("room-tokonoma", "3x2", S_STRIP)}<span class="strip__caption">天窓の間（3畳）</span></li>
    </ul>
  </section>

  <section class="band" aria-labelledby="features-h">
    <div class="container">
      <div class="side-layout">
        <h2 class="side-layout__title" id="features-h">よその宿には、たぶん無いもの</h2>
{collage([
  ("goemon-bath", "2x3", "五右衛門風呂",
   ["薪で焚きます。井戸から汲んだ水を沸かすので、湯が軟らかい。焚きつけから湯加減まで、やりたい方にはお任せします。",
    "準備に時間がかかるため、ご利用は前日までのご相談をお願いしています。日によってはお受けできないこともありますので、ご予約のときにお申し付けください。"]),
  ("well-pump", "3x2", "井戸",
   ["土間にあります。手押しポンプ、またはバケツで汲みます。五右衛門風呂に使う水はここから。飲用には適しませんので、そこだけご注意ください。"]),
  ("prayer-room", "3x2", "簡易イスラム礼拝室",
   ["ムスリムフレンドリーな宿でありたいと思っています。ご要望に応じて、男女別の礼拝室に設えます。遠慮なくお申し出ください。",
    "クルアーン（アラビア語版、英語対訳版）、キブラシール、カーペットが2セットあります。お清めはシャワールームまたは洗面台をお使いください。お食事についても事前にご相談いただけます。"]),
  ("horigotatsu", "3x2", "掘りごたつとピアノ",
   ["足を下ろして座れる掘りごたつの間があります。ピアノも置いてあります。弾いてください。"]),
])}
      </div>
    </div>
  </section>

  <section class="band band--flush">
{overlap("washbasin", "3x2", S_OVER, "水まわり", "water-h",
  ["洗面台は2台（ドライヤー1台）。<strong>洗面台の作陶は工藤冬里さん、手洗いボウルは工藤省治さん</strong>によるものです。",
   "シャワールームにはリンスインシャンプーとボディシャンプーを置いています。トイレはウォシュレット2室と、コンポストバイオトイレが1室。"])}
  </section>

  <section class="band band--flush">
{overlap("mizuya", "3x2", S_OVER, "台所", "kitchen-h",
  ["冷蔵庫、電子レンジ、炊飯器、土鍋2つ、カセットコンロ2つ、食器一式。自炊もシェアごはんもここでします。",
   "食器が並ぶ水屋は、譲り受けたものです。"],
  more=("/meals/", "食事について"), flip=True)}
  </section>

  <section class="band" id="shiomicar">
    <div class="container">
      <div class="band__head">
        <h2 id="car-h">汐見カー</h2>
        <p>レモン色の軽自動車（ホンダ ライフ）を佐島港の駐車場に置いています。<strong>ご宿泊の方でなくても、どなたでもお使いいただけます。</strong></p>
      </div>
      <dl class="facts-strip">
        <div><dt>使用料</dt><dd><span class="nowrap">3時間まで <span class="figure figure--small">1,500</span>円</span><small>以降1時間ごとに400円（ガソリン代込み）</small></dd></div>
        <div><dt>営業時間</dt><dd><span class="nowrap">8時〜20時</span></dd></div>
        <div><dt>休業</dt><dd>汐見の家がお休みの日</dd></div>
        <div><dt>ご予約</dt><dd><a class="nowrap" href="tel:0897729800">0897-72-9800</a><br><a class="nowrap" href="mailto:shiomihouse@gmail.com">shiomihouse@gmail.com</a></dd></div>
      </dl>
      <div class="note">
        <p>鍵の受け渡しはアナログです。お手数ですが汐見の家までおいでください。使用料には、ガソリン代・保険・車検・洗車・鍵の受け渡しの手間などが含まれています。</p>
      </div>
    </div>
  </section>

  <section class="band">
    <div class="container">
{bp.side("設備・アメニティ", deflist([
  ("お風呂・洗面", "五右衛門風呂（前日までの要相談）／シャワールーム（リンスインシャンプー、ボディシャンプー）／洗面台2台（ドライヤー1台）"),
  ("お手洗い", "ウォシュレット2室／コンポストバイオトイレ1室"),
  ("台所", "冷蔵庫／電子レンジ／炊飯器／土鍋2／カセットコンロ2／食器一式"),
  ("くつろぐ", "掘りごたつ／ピアノ／縁側／庭"),
  ("洗濯", "洗濯乾燥機（洗濯・乾燥 各100円）"),
  ("貸出", "タオル（バスタオル・フェイスタオル 各100円）／貸自転車"),
  ("通信", "フリーWi-Fi"),
  ("そのほか", "井戸（手押しポンプまたはバケツ。飲用不適）／簡易イスラム礼拝室／汐見カー"),
]))}
    </div>
  </section>
''',
 bp.cta(),
 bp.footer(),
]

# ─────────────────────────────────────────────── meals
meals = [
 bp.head("食事｜汐見の家",
   "ゲストとスタッフで作って食べて片すシェアごはん（夕飯1,600円・朝飯700円）。自炊、隣島のお店、摘み菜弁当のお取り寄せ、島の日本酒もあります。",
   "/meals/"),
 bp.header("/meals/"),
 bp.breadcrumb([("食事", None)]),
 bp.page_head("食事", "一緒に作って食べるか、自分で作るか、隣の島まで食べに行くか。"),
 f'''
  <section class="band band--flush">
    <figure class="photo photo--wide">{im("meal-sharing", S_FULL)}</figure>
  </section>

  <section class="band">
    <div class="container">
{bp.side("シェアごはん", """          <div class="prose">
            <p>ほかのゲストやスタッフと一緒に、作る・食べる・片すをシェアします。島の方が飛び入りで加わることもあります。</p>
            <p>料理が苦手でも大丈夫です。できることを手伝ってもらいます。得意な方は「今日は板長やるよ」と言ってください。</p>
            <p>島の人が差し入れを持って来て宴会になることもあれば、結局ひとりのこともあります。</p>
          </div>""")}
      <dl class="facts-strip">
        <div><dt>夕飯</dt><dd><span class="nowrap"><span class="figure">1,600</span><span class="price__unit">円</span></span></dd></div>
        <div><dt>朝飯</dt><dd><span class="nowrap"><span class="figure figure--small">700</span>円</span></dd></div>
        <div><dt>お休み</dt><dd>火曜の夜、日曜の夜<small>貸切のときもお休みです</small></dd></div>
        <div><dt>ご予約</dt><dd>お申し込みのときにお尋ねください</dd></div>
      </dl>
      <div class="note note--important">
        <p><strong>夕飯をご希望の場合は、17時までにチェックインをお願いします。</strong>スタッフの都合でできない日もありますので、ご予約のときにお尋ねください。</p>
      </div>
    </div>
  </section>

  <section class="band band--flush">
{overlap("meal-share", "3x2", S_OVER, "自炊", "self-h",
  ["基本の食材セット（お米または弓削島 Kitchen 313 Kamiyuge の食パン、各種調味料）をご用意します。<strong>お1人400円。</strong>前日に自炊またはシェアごはんに参加された場合は無料です。",
   "台所にある食材はご自由にお使いください。あまり無いときもあれば、島の方の差し入れで野菜や柑橘が山盛りになっていることもあります。"], flip=True)}
  </section>

  <section class="band">
    <div class="container">
{bp.side("お弁当を取り寄せる", """          <div class="prose">
            <p>隣の弓削島、しまでカフェの<strong>摘み菜弁当</strong>。島のお母さんたちの心尽くしのお弁当です。野山や海で育った四季折々の摘み菜が入ります。</p>
            <p>手前味噌のお味噌汁を付けて<strong>1人前 1,000円</strong>。お味噌は、管理人のけいこさんとみえさんが島のお母さんたちと仕込んだ麦味噌です。甘さと柔らかさが特徴で、サラダのディップにも好評です。</p>
            <p><strong>ご注文はご宿泊の前々日までに</strong>お願いします。</p>
          </div>

          <div class="note">
            <p><strong>摘み菜とは</strong> — 野山や浜辺、里海で育つ野草や海藻のことです。キクイモ、ツワブキ、ハマボウフウ、ツユクサ、ホトケノザ、ツルナ、カラスノエンドウ、山茶花の花、ハマエンドウ、ギシギシ、クレソン、ヒジキ、生ノリなどから、季節のものが2〜3種類入ります。</p>
          </div>""")}
    </div>
  </section>

  <section class="band">
    <div class="container">
{bp.side("外で食べる", """          <div class="prose">
            <p>佐島には夕食を食べられる飲食店がありません。橋で繋がっている弓削島や生名島に、おいしいお店があります。口コミはスタッフにお尋ねください。</p>
            <p>2018年9月、佐島に book cafe okappa が開業しました。朝食にご案内することが増えています。佐島の新鮮な野菜をたっぷり使ったランチやスイーツもおすすめです。</p>
          </div>""")}
    </div>
  </section>

  <section class="band">
    <div class="container">
      <div class="band__head">
        <h2 id="drink-h">お酒</h2>
        <p>ビールと日本酒をご用意しています。日本酒は呉市倉橋島、榎酒造のもの。お食事とご一緒に。</p>
      </div>
      <dl class="facts-strip">
        <div><dt>ビール</dt><dd><span class="nowrap">350ml缶 <span class="figure figure--small">300</span>円</span></dd></div>
        <div><dt>日本酒</dt><dd>榎酒造（呉市倉橋島）より数銘柄<small>銘柄と価格はスタッフにお尋ねください</small></dd></div>
        <div><dt>持ち込み</dt><dd>歓迎です</dd></div>
        <div><dt>ご注意</dt><dd>在庫が無いこともあります</dd></div>
      </dl>
    </div>
  </section>

  <section class="band">
    <div class="container">
{bp.side("お土産", """          <div class="prose">
            <p>少しばかりお取り扱いがあります。価格はスタッフにお尋ねください。</p>
          </div>
""" + deflist([
  ("汐見の家オリジナル手ぬぐい", "浅緑または柑子色"),
  ("弓削塩", "島の塩です"),
  ("弓削海苔", "島の海苔です"),
  ("しまなみ島走マップ", "サイクリング用の地図"),
  ("しまなみ島走ブック", "サイクリングのガイドブック"),
]))}
    </div>
  </section>
''',
 bp.cta(),
 bp.footer(),
]

# ─────────────────────────────────────────────── access
access = [
 bp.head("アクセス｜汐見の家",
   "愛媛県越智郡上島町弓削佐島299。しまなみ海道の少し東にある離島、佐島。尾道・因島、今治、広島空港・三原のいずれからも船で渡ります。佐島港から徒歩2分。",
   "/access/"),
 bp.header("/access/"),
 bp.breadcrumb([("アクセス", None)]),
 bp.page_head("アクセス", "しまなみ海道の少し東にある離島です。どこかで必ず船に乗ります。"),
 f'''
  <section class="band band--flush">
    <figure class="photo photo--wide">{im("sea-islands", S_FULL)}</figure>
  </section>

  <section class="band">
    <div class="container">
      <div class="prose">
        <p>汐見の家は、瀬戸内海を渡るしまなみ海道の少し東、佐島にあります。離島なので、どこかで必ず船に乗ります。一番短い航路はたった3分ですが、対岸にはゆったりした島時間が待っています。</p>
        <p>乗り継ぎが悪いと2時間待つこともあります。不便も旅の楽しみですが、事前にご相談いただければ、その日に合う道順をご提案します。</p>
      </div>
    </div>
  </section>

  <section class="band">
    <div class="container">
{bp.side("主な道順", """          <div class="prose">
            <p>目的地は<strong>「佐島港」</strong>です。乗換案内で検索するときも、この名前で入れてください。</p>
          </div>
""" + deflist([
  ("尾道・福山から", "バスで因島の土生（はぶ）港へ。土生港から芸予汽船の船で佐島港。"),
  ("今治・松山から", "今治桟橋まで出て、芸予汽船の船で佐島港。松山からはJRかバス、リムジンバスで今治へ。"),
  ("広島空港・三原から", "三原港から土生商船の高速船で生名島の立石港へ。立石港から町有バス、または自転車で佐島へ。橋で繋がっています。"),
  ('しまなみ海道・生口島から<br><span class="eyebrow">自転車の方向け</span>',
   "生口島の洲江（すのえ）港から船で、岩城島の小漕（こぎ）港へ。そこから佐島までは橋を渡って自転車で。しまなみ海道を走っている途中で立ち寄るなら、この道順が早いです。<br>平日はオンデマンドバスもありますが、公共交通機関でお越しの方は、上の3つのいずれかをお使いください。"),
  ("佐島港から", "徒歩2分です。港を背に、集落の路地へ入ってすぐ。"),
]) + """
          <div class="note note--important">
            <p><strong>運賃と時刻はこのページには載せていません。</strong>変わることがあるためです。最新の時刻表と運賃は、各社のサイトでご確認ください。分かりにくいときはお気軽にお問い合わせください。</p>
          </div>""")}
    </div>
  </section>

  <section class="band">
    <div class="container">
{bp.side("船とバス", deflist([
  ("芸予汽船", "今治桟橋・佐島港・弓削港・土生港を結ぶ航路"),
  ("土生商船", "三原港・生名島（立石港）・土生港を結ぶ高速船"),
  ("上島町有バス", "生名島・佐島・弓削島の島内路線"),
  ("せとうち交流館", "弓削港から徒歩1分。レンタサイクル"),
]))}
    </div>
  </section>

  <section class="band band--flush">
{overlap("lane-sign", "3x2", S_OVER, "サイクリングで来る方へ", "cycle-h",
  ["しまなみ海道を走る方、ライダーの方も歓迎です。貸自転車もあります。",
   "レンタサイクルを借りる場合は、佐島の手前の弓削島で借りると便利です。佐島と弓削島、生名島、岩城島は橋で繋がっていて、この四島を結ぶ道を「ゆめしま海道」と呼びます。",
   '自転車を船に載せるときのことや、しまなみ海道からの渡り方は<a href="/cycling/">ゆめしま海道と自転車</a>にまとめました。'])}
  </section>

  <section class="band">
    <div class="container">
      <div class="band__head"><h2 id="place-h">所在地</h2></div>
      <dl class="facts-strip">
        <div><dt>住所</dt><dd><span class="nowrap">〒794-2520</span><br>愛媛県越智郡上島町弓削佐島299</dd></div>
        <div><dt>お電話</dt><dd><a class="nowrap" href="tel:0897729800">0897-72-9800</a></dd></div>
        <div><dt>最寄り</dt><dd><span class="nowrap">佐島港から徒歩2分</span></dd></div>
        <div><dt>駐車場</dt><dd>あります</dd></div>
      </dl>
      <div class="note">
        <p>長く空き家だったため、地図に番地が登録されていないことがあります。その場合は「古民家ゲストハウス汐見の家」で検索してください。</p>
      </div>
    </div>
  </section>
''',
 bp.cta("道順が分かりにくいときは、遠慮なくお問い合わせください。"),
 bp.footer(),
]


if __name__ == "__main__":
    for path, parts in [("about/index.html", about), ("rooms/index.html", rooms),
                        ("meals/index.html", meals), ("access/index.html", access)]:
        bp.write(path, parts)
