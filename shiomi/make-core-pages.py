#!/usr/bin/env python3
"""汐見の家 — 下層ページ（about / rooms / meals / access）を書き出す。

一度きりの雛形生成。書き出したあとは HTML の方が正。
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module
bp = import_module("build-pages".replace("-", "_")) if False else None

# build-pages.py はハイフン入りなので直接読み込む
import importlib.util
spec = importlib.util.spec_from_file_location("bp", os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)

ROOT = bp.ROOT
MAN = {m["name"]: m for m in json.load(open(os.path.join(ROOT, "img", "manifest.json")))}

def im(name, sizes, lazy=True, up="../"):
    m = MAN[name]
    widths = [s["w"] for s in m["sizes"]]
    big = m["sizes"][0]
    return bp.img(name, m["alt"], big["w"], big["h"], sizes, tuple(sorted(widths)), up, lazy)

S_FEATURE = "(min-width: 66em) 620px, (min-width: 48em) 58vw, 100vw"
S_GRID    = "(min-width: 66em) 360px, (min-width: 40em) 33vw, 100vw"
S_MEDIA   = "(min-width: 66em) 560px, (min-width: 48em) 55vw, 100vw"
S_FULL    = "100vw"

# ─────────────────────────────────────────── about
about = [
 bp.head("汐見の家について｜汐見の家",
   "瀬戸内・佐島の古民家ゲストハウス。大正期に渡米した日系一世ロバート汐見ゆかりの家を改装し、2016年4月に開業しました。素泊り1泊5,500円、定員7名。",
   "/about/"),
 bp.header("/about/"),
 bp.page_head("汐見の家について", "瀬戸内海に浮かぶ佐島の、築百年を越えた古民家です。"),
 f'''
  <section class="section">
    <div class="wrap">
      <figure class="photo">{im("engawa-garden", S_FULL)}</figure>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>この家のこと</h2>
      <div class="prose">
        <p>汐見の家は、オーナーの祖父の実家です。母の旧姓が汐見。それがそのまま宿の名前になりました。</p>
        <p>2012年4月、空き家になって久しいこの家を処分するため、30年ぶりに佐島を訪れました。ところがしまなみ海道の美しさとこの家の佇まいに心を打たれ、1年半迷った末に、再生へ舵を切ることにしたのです。</p>
        <p>そこから1年かけて手立てを探し、さらに1年半かけて第一期の改修を終え、開業を迎えたのが2016年4月でした。遠距離、知識無し、お金無しの三重苦のなか、人に助けていただくほか方法がありませんでした。再生の記録は読み物にまとめてあります。</p>
        <p>「汐見」という名は、この家に生まれ、13歳で単身アメリカへ渡って医師になった日系一世、ロバート・一（ハジメ）・汐見に由来します。彼の生涯も読み物にしました。</p>
      </div>
      <ul class="link-list">
        <li><a href="/stories/shiomi/"><span class="link-title">アメリカ日系一世 ロバート汐見の足跡</span><span class="link-desc">1904年にこの家で生まれ、13歳で渡米。日系人強制収容を経て、生涯を通じて留学生を支えた人の記録。全7回。</span></a></li>
        <li><a href="/stories/renovation/"><span class="link-title">古民家再生の記録</span><span class="link-desc">2012年の「はじまり」から、井戸、五右衛門風呂、壁塗り、第二期改修まで。</span></a></li>
      </ul>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>料金</h2>
      <dl class="facts">
        <div><dt>素泊り</dt><dd><strong>1泊 5,500円</strong><br>小学生は半額、乳幼児1人まで無料</dd></div>
        <div><dt>一棟貸し</dt><dd>1泊 30,000円</dd></div>
        <div><dt>シェアごはん</dt><dd>夕飯 1,600円 ／ 朝飯 700円</dd></div>
        <div><dt>定員</dt><dd>7名<br>超える場合や長期滞在はご相談ください</dd></div>
        <div><dt>チェックイン</dt><dd>15:00 ／ チェックアウト 10:00</dd></div>
        <div><dt>お支払い</dt><dd>現地にて</dd></div>
      </dl>
      <p class="more"><a href="/reserve/">ご予約・お問い合わせ</a></p>
    </div>
  </section>

  <section class="section">
    <div class="wrap media">
      <div class="media-photo">{im("guests-engawa", S_MEDIA)}</div>
      <div class="media-body">
        <h2>過ごし方</h2>
        <p>何をするでもなく、縁側に座って庭を眺めている方が多いです。ピアノを弾く方、井戸を汲んでみる方、五右衛門風呂を自分で焚く方もいます。</p>
        <p>夕方になると、台所からシェアごはんの支度の音が聞こえてきます。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>お願いしていること</h2>
      <dl class="facts-list">
        <div><dt>チェックイン・アウト</dt><dd>15時と10時が目安です。事前におおよその時間をご連絡ください。</dd></div>
        <div><dt>門限</dt><dd>ありません。ただし静かな集落にあり、20時を過ぎると静まり返ります。就寝中のお客さまや近隣のご迷惑にならないよう、静かな出入りをお願いします。</dd></div>
        <div><dt>お部屋</dt><dd>襖で仕切られた和室に布団を敷きます。相部屋で始めた宿ですが、いまは原則としてグループごとの個室です。</dd></div>
        <div><dt>使える時間</dt><dd>シャワー、ドライヤー、洗面台、キッチン、掘りごたつの間、玄関土間は6時〜24時。洗濯機は22時までにお願いします。</dd></div>
        <div><dt>宿帳</dt><dd>ご住所などは当日ご記帳いただきます。</dd></div>
      </dl>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>庭のこと</h2>
      <div class="prose">
        <p>庭のデザインは関晴子さん（Studio Lasso Ltd）によるものです。庭の写真は嶋谷元さんに撮っていただきました。</p>
        <p>この家の再生は、たくさんの方に助けられて進みました。お名前は Special Thanks にまとめてあります。</p>
      </div>
      <p class="more"><a href="/thanks/">Special Thanks</a></p>
    </div>
  </section>
''',
 bp.cta(),
 bp.footer(),
]

# ─────────────────────────────────────────── rooms
rooms = [
 bp.head("部屋と設備｜汐見の家",
   "襖で仕切られた和室3室、定員7名。薪で焚く五右衛門風呂、手押しポンプの井戸、簡易イスラム礼拝室、掘りごたつとピアノ。工芸家の作による洗面台もあります。",
   "/rooms/"),
 bp.header("/rooms/"),
 bp.page_head("部屋と設備", "襖で仕切られた和室に布団を敷きます。定員は7名です。"),
 f'''
  <section class="section">
    <div class="wrap">
      <h2>居室</h2>
      <div class="prose">
        <p>奥の間（6畳）、表の間（6畳）、天窓の間（3畳）の3室。ご宿泊の人数によって融通して使います。相部屋で始めた宿ですが、いまは原則としてグループごとの個室です。</p>
      </div>
      <ul class="photo-grid room-list">
        <li>{im("room-oku", S_GRID)}<span>奥の間（6畳）</span></li>
        <li>{im("room-omote", S_GRID)}<span>表の間（6畳）</span></li>
        <li>{im("room-tokonoma", S_GRID)}<span>天窓の間（3畳）</span></li>
      </ul>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>よその宿には、たぶん無いもの</h2>

      <div class="feature">
        <div class="feature-photo">{im("goemon-bath", S_FEATURE)}</div>
        <div class="feature-body">
          <h3>五右衛門風呂</h3>
          <p>薪で焚きます。井戸から汲んだ水を沸かすので、湯が軟らかい。沸くまでに時間がかかりますので、ご希望の場合はお申し付けください。焚きつけから湯加減まで、やりたい方にはお任せします。</p>
        </div>
      </div>

      <div class="feature">
        <div class="feature-photo">{im("well-pump", S_FEATURE)}</div>
        <div class="feature-body">
          <h3>井戸</h3>
          <p>土間にあります。手押しポンプ、またはバケツで汲みます。五右衛門風呂に使う水はここから。飲用には適しませんので、そこだけご注意ください。</p>
        </div>
      </div>

      <div class="feature">
        <div class="feature-photo">{im("prayer-room", S_FEATURE)}</div>
        <div class="feature-body">
          <h3>簡易イスラム礼拝室</h3>
          <p>ムスリムフレンドリーな宿でありたいと思っています。ご要望に応じて、天窓の間と棚の間を男女別の礼拝室に設えます。遠慮なくお申し出ください。</p>
          <p>クルアーン（アラビア語版、英語対訳版）、キブラシール、カーペットが2セットあります。お清めはシャワールームまたは洗面台をお使いください。お食事についても事前にご相談いただけます。</p>
        </div>
      </div>

      <div class="feature">
        <div class="feature-photo">{im("horigotatsu", S_FEATURE)}</div>
        <div class="feature-body">
          <h3>掘りごたつとピアノ</h3>
          <p>足を下ろして座れる掘りごたつの間があります。ピアノも置いてあります。弾いてください。</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap media">
      <div class="media-photo">{im("washbasin", S_MEDIA)}</div>
      <div class="media-body">
        <h2>水まわり</h2>
        <p>洗面台は2台（ドライヤー1台）。<strong>洗面台の作陶は工藤冬里さん、手洗いボウルは工藤省治さん</strong>によるものです。</p>
        <p>シャワールームにはリンスインシャンプーとボディシャンプーを置いています。トイレはウォシュレット2室と、コンポストバイオトイレが1室。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap media media-reverse">
      <div class="media-photo">{im("mizuya", S_MEDIA)}</div>
      <div class="media-body">
        <h2>台所</h2>
        <p>冷蔵庫、電子レンジ、炊飯器、土鍋2つ、カセットコンロ2つ、食器一式。自炊もシェアごはんもここでします。</p>
        <p>食器が並ぶ水屋は、譲り受けたものです。</p>
        <p class="more"><a href="/meals/">食事について</a></p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>汐見カー</h2>
      <div class="prose">
        <p>レモン色の軽自動車（ホンダ ライフ）を佐島港の駐車場に置いています。<strong>ご宿泊の方でなくても、どなたでもお使いいただけます。</strong></p>
      </div>
      <dl class="facts">
        <div><dt>使用料</dt><dd>3時間まで 1,500円<br>以降1時間ごとに 400円（ガソリン代込み）</dd></div>
        <div><dt>営業時間</dt><dd>8時〜20時<br>汐見の家がお休みの日は休業します</dd></div>
        <div><dt>ご予約</dt><dd>お電話 <a href="tel:0897729800">0897-72-9800</a><br>または <a href="mailto:shiomihouse@gmail.com">shiomihouse@gmail.com</a></dd></div>
      </dl>
      <div class="notice">
        <p>鍵の受け渡しはアナログです。お手数ですが汐見の家までおいでください。使用料には、ガソリン代・保険・車検・洗車・鍵の受け渡しの手間などが含まれています。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>設備・アメニティ</h2>
      <dl class="facts-list">
        <div><dt>お風呂・洗面</dt><dd>五右衛門風呂／シャワールーム（リンスインシャンプー、ボディシャンプー）／洗面台2台（ドライヤー1台）</dd></div>
        <div><dt>お手洗い</dt><dd>ウォシュレット2室／コンポストバイオトイレ1室</dd></div>
        <div><dt>台所</dt><dd>冷蔵庫／電子レンジ／炊飯器／土鍋2／カセットコンロ2／食器一式</dd></div>
        <div><dt>くつろぐ</dt><dd>掘りごたつ／ピアノ／縁側／庭</dd></div>
        <div><dt>洗濯</dt><dd>洗濯乾燥機（洗濯・乾燥 各100円）</dd></div>
        <div><dt>貸出</dt><dd>タオル（バスタオル・フェイスタオル 各100円）／貸自転車</dd></div>
        <div><dt>通信</dt><dd>フリーWi-Fi</dd></div>
        <div><dt>そのほか</dt><dd>井戸（手押しポンプまたはバケツ。飲用不適）／簡易イスラム礼拝室／汐見カー</dd></div>
      </dl>
    </div>
  </section>
''',
 bp.cta(),
 bp.footer(),
]

# ─────────────────────────────────────────── meals
meals = [
 bp.head("食事｜汐見の家",
   "ゲストとスタッフで作って食べて片すシェアごはん（夕飯1,600円・朝飯700円）。自炊、隣島のお店、摘み菜弁当のお取り寄せ、島の日本酒もあります。",
   "/meals/"),
 bp.header("/meals/"),
 bp.page_head("食事", "一緒に作って食べるか、自分で作るか、隣の島まで食べに行くか。"),
 f'''
  <section class="section">
    <div class="wrap">
      <figure class="photo">{im("meal-sharing", S_FULL)}</figure>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>シェアごはん</h2>
      <div class="prose">
        <p>ほかのゲストやスタッフと一緒に、作る・食べる・片すをシェアします。島の方が飛び入りで加わることもあります。</p>
        <p>料理が苦手でも大丈夫です。できることを手伝ってもらいます。得意な方は「今日は板長やるよ」と言ってください。</p>
        <p>島の人が差し入れを持って来て宴会になることもあれば、結局ひとりのこともあります。</p>
      </div>
      <dl class="facts">
        <div><dt>夕飯</dt><dd><strong>1,600円</strong></dd></div>
        <div><dt>朝飯</dt><dd><strong>700円</strong></dd></div>
        <div><dt>お休み</dt><dd>火曜の夜、日曜の夜<br>貸切のときもお休みです</dd></div>
      </dl>
      <div class="notice-important">
        <p><strong>夕飯をご希望の場合は、17時までにチェックインをお願いします。</strong>スタッフの都合でできない日もありますので、ご予約のときにお尋ねください。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap media media-reverse">
      <div class="media-photo">{im("meal-share", S_MEDIA)}</div>
      <div class="media-body">
        <h2>自炊</h2>
        <p>基本の食材セット（お米または弓削島 Kitchen 313 Kamiyuge の食パン、各種調味料）をご用意します。<strong>お1人400円。</strong>前日に自炊またはシェアごはんに参加された場合は無料です。</p>
        <p>台所にある食材はご自由にお使いください。あまり無いときもあれば、島の方の差し入れで野菜や柑橘が山盛りになっていることもあります。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>お弁当を取り寄せる</h2>
      <div class="prose">
        <p>隣の弓削島、しまでカフェの<strong>摘み菜弁当</strong>。島のお母さんたちの心尽くしのお弁当です。野山や海で育った四季折々の摘み菜が入ります。</p>
        <p>手前味噌のお味噌汁を付けて<strong>1人前 1,000円</strong>。お味噌は、管理人のけいこさんとみえさんが島のお母さんたちと仕込んだ麦味噌です。甘さと柔らかさが特徴で、サラダのディップにも好評です。</p>
        <p><strong>ご注文はご宿泊の前々日までに</strong>お願いします。</p>
      </div>
      <div class="notice">
        <p><strong>摘み菜とは</strong> — 野山や浜辺、里海で育つ野草や海藻のことです。キクイモ、ツワブキ、ハマボウフウ、ツユクサ、ホトケノザ、ツルナ、カラスノエンドウ、山茶花の花、ハマエンドウ、ギシギシ、クレソン、ヒジキ、生ノリなどから、季節のものが2〜3種類入ります。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>外で食べる</h2>
      <div class="prose">
        <p>佐島には夕食を食べられる飲食店がありません。橋で繋がっている弓削島や生名島に、おいしいお店があります。口コミはスタッフにお尋ねください。</p>
        <p>2018年9月、佐島に book cafe okappa が開業しました。朝食にご案内することが増えています。佐島の新鮮な野菜をたっぷり使ったランチやスイーツもおすすめです。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>お酒</h2>
      <div class="prose">
        <p>ビールと日本酒をご用意しています。日本酒は呉市倉橋島、榎酒造のもの。お食事とご一緒に。</p>
      </div>
      <dl class="facts">
        <div><dt>ビール</dt><dd>350ml缶 300円</dd></div>
        <div><dt>日本酒</dt><dd>榎酒造（呉市倉橋島）より数銘柄<br>銘柄と価格はスタッフにお尋ねください</dd></div>
      </dl>
      <div class="notice">
        <p>在庫が無いこともありますので、スタッフにお聞きください。持ち込みも歓迎です。</p>
      </div>
    </div>
  </section>
''',
 bp.cta(),
 bp.footer(),
]

# ─────────────────────────────────────────── access
access = [
 bp.head("アクセス｜汐見の家",
   "愛媛県越智郡上島町弓削佐島299。しまなみ海道の少し東にある離島、佐島。尾道・因島、今治、広島空港・三原のいずれからも船で渡ります。佐島港から徒歩2分。",
   "/access/"),
 bp.header("/access/"),
 bp.page_head("アクセス", "しまなみ海道の少し東にある離島です。どこかで必ず船に乗ります。"),
 f'''
  <section class="section">
    <div class="wrap">
      <figure class="photo">{im("sea-islands", S_FULL)}</figure>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="prose">
        <p>汐見の家は、瀬戸内海を渡るしまなみ海道の少し東、佐島にあります。離島なので、どこかで必ず船に乗ります。一番短い航路はたった3分ですが、対岸にはゆったりした島時間が待っています。</p>
        <p>乗り継ぎが悪いと2時間待つこともあります。不便も旅の楽しみですが、事前にご相談いただければ、その日に合う道順をご提案します。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>主な道順</h2>
      <div class="prose">
        <p>目的地は<strong>「佐島港」</strong>です。乗換案内で検索するときも、この名前で入れてください。</p>
      </div>
      <dl class="facts-list">
        <div>
          <dt>尾道・福山から</dt>
          <dd>バスで因島の土生（はぶ）港へ。土生港から芸予汽船の船で佐島港。</dd>
        </div>
        <div>
          <dt>今治・松山から</dt>
          <dd>今治桟橋まで出て、芸予汽船の船で佐島港。松山からはJRかバス、リムジンバスで今治へ。</dd>
        </div>
        <div>
          <dt>広島空港・三原から</dt>
          <dd>三原港から土生商船の高速船で生名島の立石港へ。立石港から町有バス、または自転車で佐島へ。橋で繋がっています。</dd>
        </div>
        <div>
          <dt>佐島港から</dt>
          <dd>徒歩2分です。港を背に、集落の路地へ入ってすぐ。</dd>
        </div>
      </dl>
      <div class="notice-important">
        <p><strong>運賃と時刻はこのページには載せていません。</strong>変わることがあるためです。最新の時刻表と運賃は、各社のサイトでご確認ください。分かりにくいときはお気軽にお問い合わせください。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>船とバス</h2>
      <dl class="facts-list">
        <div><dt>芸予汽船</dt><dd>今治桟橋・佐島港・弓削港・土生港を結ぶ航路</dd></div>
        <div><dt>土生商船</dt><dd>三原港・生名島（立石港）・土生港を結ぶ高速船</dd></div>
        <div><dt>上島町有バス</dt><dd>生名島・佐島・弓削島の島内路線</dd></div>
        <div><dt>せとうち交流館</dt><dd>弓削港から徒歩1分。レンタサイクル</dd></div>
      </dl>
    </div>
  </section>

  <section class="section">
    <div class="wrap media">
      <div class="media-photo">{im("lane-sign", S_MEDIA)}</div>
      <div class="media-body">
        <h2>サイクリングで来る方へ</h2>
        <p>しまなみ海道を走る方、ライダーの方も歓迎です。貸自転車もあります。</p>
        <p>レンタサイクルを借りる場合は、佐島の手前の弓削島で借りると便利です。佐島と弓削島、生名島は橋で繋がっています。</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>所在地</h2>
      <dl class="facts">
        <div><dt>住所</dt><dd>〒794-2520<br>愛媛県越智郡上島町弓削佐島299</dd></div>
        <div><dt>お電話</dt><dd><a href="tel:0897729800">0897-72-9800</a></dd></div>
        <div><dt>最寄り</dt><dd>佐島港から徒歩2分</dd></div>
      </dl>
      <div class="notice">
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
