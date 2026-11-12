#!/usr/bin/env python3
"""SEOチェッカーの静的ページ（ガイド記事・サイト情報・404・sitemap.xml・robots.txt）を生成する。

    python3 seo-checker-build/build.py

出力先は ../seo-checker 。トップページ（index.html）はツール本体なので生成対象外で、手で編集する。
ドメインを変えるときは SITE を書き換えて再実行し、index.html 内の URL も同じ値に置換する。
"""
import html
import json
import pathlib

SITE = "https://seo-checker-bs4.pages.dev"
NAME = "SEOチェッカー"
TODAY = "2026-11-13"
# 運営者の表示。空なら「© SEOチェッカー」だけになる。変更したら index.html のフッターも同じ内容にする。
OPERATOR_NAME = "池森 裕毅"
OPERATOR_X_URL = "https://x.com/yuki_ikemori"
OUT = pathlib.Path(__file__).resolve().parent.parent / "seo-checker"

LOGO = ('<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><rect width="32" height="32" rx="7" fill="currentColor"/>'
        '<circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" stroke-width="3"/><path d="M19 19l6 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>')

HEADER = f'''<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="/">{LOGO}<span>{NAME}</span></a>
    <nav class="nav" aria-label="サイト内メニュー"><a href="/">SEO診断ツール</a><a href="/guide/">SEOガイド</a><a href="/about">このサイトについて</a></nav>
  </div>
</header>'''

OPERATOR = ""
if OPERATOR_NAME:
    OPERATOR = "　運営: " + html.escape(OPERATOR_NAME)
    if OPERATOR_X_URL:
        OPERATOR += f'（<a href="{html.escape(OPERATOR_X_URL, quote=True)}" target="_blank" rel="noopener me">X</a>）'

OPERATOR_SECTION = ""
if OPERATOR_NAME:
    x = f'<a href="{html.escape(OPERATOR_X_URL, quote=True)}" target="_blank" rel="noopener me">X（@{html.escape(OPERATOR_X_URL.rstrip("/").split("/")[-1])}）</a>' if OPERATOR_X_URL else ""
    OPERATOR_SECTION = f"<h2>運営者</h2>\n<p>{html.escape(OPERATOR_NAME)}{'　連絡先: ' + x if x else ''}</p>\n"

FOOTER = f'''<footer class="foot">
  <div class="wrap foot-in">
    <span>© 2026 {NAME}{OPERATOR}</span>
    <nav aria-label="フッターメニュー"><a href="/">SEO診断ツール</a><a href="/guide/">SEOガイド</a><a href="/guide/seo-checklist">SEOチェックリスト</a><a href="/about">このサイトについて</a><a href="/privacy">プライバシーポリシー</a></nav>
  </div>
</footer>'''

CTA = '''<aside class="cta">
  <p><b>あなたのページはどうなっていますか？</b>URL を入れるだけで、この記事の内容を含む約70項目を無料で採点できます。</p>
  <a class="cta-btn" href="/">SEOチェッカーで診断する</a>
</aside>'''

# ---------------------------------------------------------------------------
# ガイド記事。slug / title（<title>用）/ h1 / desc / lead / body(HTML) / related
# ---------------------------------------------------------------------------
GUIDES = [
dict(
  slug="seo-checklist", short="SEOチェックリスト",
  title="SEOチェックリスト70項目｜公開前に確認する内部対策の一覧",
  h1="SEOチェックリスト：公開前に確認したい70項目",
  desc="タイトルやメタ情報、見出し、クロール設定、リンク、構造化データ、表示速度まで、ページ公開前に確認したい内部SEOのチェック項目を7分野・約70項目の一覧にまとめました。優先順位の付け方も解説します。",
  lead="SEO の内部対策は項目が多く、どこまで確認すれば十分なのか分かりにくいものです。このページでは、SEOチェッカーが実際に採点している約70項目を7つの分野に分けて一覧にしました。上から順に確認すれば、検索エンジンに正しく読まれ、検索結果で選ばれやすいページの土台が整います。",
  body='''
<h2>最初に確認する「致命的な3項目」</h2>
<p>次の3つは、1つでも当てはまるとページが検索結果に出なくなります。他の項目より先に確認してください。</p>
<ul>
  <li><b>noindex が付いていないか。</b>meta robots タグと、HTTP ヘッダーの X-Robots-Tag の両方を確認します。</li>
  <li><b>robots.txt でクロールを禁止していないか。</b>開発中に書いた <code>Disallow: /</code> が残っている例がよくあります。</li>
  <li><b>ページが HTTP 200 を返しているか。</b>404 や 500 を返すページはインデックスされません。</li>
</ul>
<p>SEOチェッカーでは、この3項目のどれかに問題があると総合点を45点までに制限しています。ほかがどれだけ整っていても、検索に出ないページは評価のしようがないからです。詳しくは「<a href="/guide/noindex-robots-txt">noindex と robots.txt の違い</a>」で解説しています。</p>

<h2>1. 基本メタ情報（9項目）</h2>
<ul class="checklist">
  <li>タイトルタグがあり、内容を表す固有の文言になっている</li>
  <li>タイトルの長さが全角15〜32文字程度に収まっている</li>
  <li>タイトルタグが1ページに1つだけである</li>
  <li>メタディスクリプションがあり、全角70〜120文字程度で要点をまとめている</li>
  <li>メタディスクリプションがタイトルの繰り返しになっていない</li>
  <li>viewport が設定され、スマートフォンで正しく表示される</li>
  <li>html 要素に lang 属性がある</li>
  <li>文字コード（meta charset）が宣言されている</li>
  <li>canonical が1つだけあり、自分自身の絶対 URL を指している</li>
</ul>
<p>書き方の詳細は「<a href="/guide/title-tag">タイトルタグの文字数と書き方</a>」「<a href="/guide/meta-description">メタディスクリプションの書き方</a>」を参照してください。</p>

<h2>2. コンテンツ（8項目）</h2>
<ul class="checklist">
  <li>H1 が1つあり、ページの主題を表している</li>
  <li>見出しが h1 → h2 → h3 の順で、階層を飛ばしていない</li>
  <li>空の見出しがない</li>
  <li>検索意図を満たすだけの本文量がある</li>
  <li>本文が初期 HTML に含まれている（JavaScript の実行を前提にしていない）</li>
  <li>本文の主題とタイトルの語句が一致している</li>
  <li>運営者情報・問い合わせ先・プライバシーポリシーへの導線がある</li>
  <li>公開日・更新日が分かる</li>
</ul>

<h2>3. クロール・インデックス（12項目）</h2>
<ul class="checklist">
  <li>noindex が指定されていない</li>
  <li>meta robots に不要な nofollow がない</li>
  <li>robots.txt があり、対象ページのクロールを許可している</li>
  <li>robots.txt に Sitemap の場所が書かれている</li>
  <li>XML サイトマップがあり、XML として正しい</li>
  <li>対象ページがサイトマップに載っている</li>
  <li>HTTP ステータスが 200 である</li>
  <li>リダイレクトが連鎖していない（1回以内）</li>
  <li>恒久的な移転に 302 ではなく 301 を使っている</li>
  <li>URL が短く、小文字・ハイフン区切りで整理されている</li>
  <li>meta refresh によるリダイレクトを使っていない</li>
  <li>多言語サイトの場合、hreflang が相互に設定されている</li>
</ul>

<h2>4. リンク・画像（11項目）</h2>
<ul class="checklist">
  <li>リンク切れ（404 など）がない</li>
  <li>内部リンクがリダイレクトを経由していない</li>
  <li>関連ページへの内部リンクがある</li>
  <li>リンクテキストのないリンクがない</li>
  <li>「こちら」「詳細」だけのリンクテキストを避けている</li>
  <li>href が空・「#」・javascript: のリンクがない</li>
  <li>画像に alt 属性がある</li>
  <li>画像に width と height が指定されている</li>
  <li>ファーストビュー外の画像を遅延読み込みしている</li>
  <li>WebP や AVIF などの軽い画像形式を使っている</li>
  <li>リンクの数が多すぎない</li>
</ul>
<p>リンク切れの探し方は「<a href="/guide/broken-links">リンク切れの調べ方と直し方</a>」にまとめています。</p>

<h2>5. SNS・構造化データ（7項目）</h2>
<ul class="checklist">
  <li>og:title・og:description・og:image・og:url が揃っている</li>
  <li>og:image が https から始まる絶対 URL である</li>
  <li>twitter:card が設定されている</li>
  <li>ページの種類に合った構造化データ（JSON-LD）がある</li>
  <li>JSON-LD に構文エラーがない</li>
  <li>各スキーマの必須プロパティが揃っている</li>
  <li>下層ページにパンくずリストの構造化データがある</li>
</ul>
<p>構造化データの始め方は「<a href="/guide/structured-data">構造化データ（JSON-LD）の基本</a>」を参照してください。</p>

<h2>6. 技術・セキュリティ（14項目）</h2>
<ul class="checklist">
  <li>HTTPS で配信されている</li>
  <li>HTTPS ページ内で http:// のリソースを読み込んでいない</li>
  <li>DOCTYPE 宣言がある</li>
  <li>HTML のサイズが大きすぎない</li>
  <li>DOM の要素数が多すぎない（目安は1,500以下）</li>
  <li>head 内の外部スクリプトに async か defer が付いている</li>
  <li>CSS ファイルを読み込みすぎていない</li>
  <li>font や center などの廃止されたタグを使っていない</li>
  <li>ピンチズームを禁止していない</li>
  <li>HSTS（Strict-Transport-Security）を返している</li>
  <li>X-Content-Type-Options: nosniff を返している</li>
  <li>クリックジャッキング対策（X-Frame-Options など）がある</li>
  <li>HTTP/2 以上で配信されている</li>
  <li>DNS が正しく解決でき、IPv6 に対応している</li>
</ul>

<h2>7. 表示速度（11項目）</h2>
<ul class="checklist">
  <li>LCP（最大コンテンツの表示）が 2.5 秒以内</li>
  <li>INP（操作への応答）が 200 ミリ秒以内</li>
  <li>CLS（レイアウトのずれ）が 0.1 以下</li>
  <li>TBT（操作をブロックした時間）が 200 ミリ秒以内</li>
  <li>FCP（最初の描画）が 1.8 秒以内</li>
  <li>Speed Index が 3.4 秒以内</li>
  <li>Lighthouse のパフォーマンススコアが 90 以上</li>
  <li>Lighthouse の SEO スコアが 90 以上</li>
  <li>アクセシビリティスコアが 90 以上</li>
  <li>ベストプラクティススコアが 90 以上</li>
  <li>ページ全体の転送量が 1.6MB 以下</li>
</ul>
<p>各指標の意味と改善方法は「<a href="/guide/core-web-vitals">Core Web Vitals の基準と改善方法</a>」で解説しています。</p>

<h2>サイト全体で確認する項目</h2>
<p>1ページずつでは見つからない問題もあります。サイト全体では次の点を確認します。</p>
<ul class="checklist">
  <li>タイトル・メタディスクリプション・H1 がページ間で重複していない</li>
  <li>エラーを返すページがない</li>
  <li>内部リンク切れがない</li>
  <li>サイトマップに、noindex やリダイレクトされる URL が載っていない</li>
  <li>インデックスさせたいページがサイトマップから漏れていない</li>
  <li>内容の薄いページが多くない</li>
  <li>どこからもリンクされていないページがない</li>
</ul>

<h2>優先順位の付け方</h2>
<p>すべてを一度に直す必要はありません。次の順番で進めると、少ない作業で効果が出やすくなります。</p>
<ol>
  <li><b>検索に出なくなる問題を直す。</b>noindex、robots.txt のブロック、エラーページです。</li>
  <li><b>全ページに共通する問題を直す。</b>テンプレートを1か所直せば全ページに反映されるので、費用対効果が最も高くなります。</li>
  <li><b>検索結果での見え方を整える。</b>タイトルとメタディスクリプションはクリック率に直結します。</li>
  <li><b>表示速度を改善する。</b>実ユーザーのデータで「不良」と判定されている指標から着手します。</li>
</ol>
<p>なお、このチェックリストは技術的な土台を整えるためのものです。検索順位を最終的に決めるのは、検索した人の疑問に答える内容になっているかどうかです。土台を整えたうえで、内容の充実に時間を使ってください。</p>
''',
  related=["title-tag", "noindex-robots-txt", "broken-links"]),

dict(
  slug="title-tag", short="タイトルタグの文字数と書き方",
  title="タイトルタグの最適な文字数は？SEOに効く書き方と注意点",
  h1="タイトルタグの最適な文字数と書き方",
  desc="タイトルタグ（title）の文字数の目安は全角30文字前後です。検索結果で省略されない長さ、キーワードの置き方、ページごとに変えるべき理由、よくある失敗と確認方法を具体例つきで解説します。",
  lead="タイトルタグは、検索結果に青い見出しとして表示される文言です。検索順位とクリック率の両方に影響するため、内部 SEO のなかで最も費用対効果の高い項目と言えます。このページでは、文字数の目安と、検索で選ばれやすい書き方を解説します。",
  body='''
<h2>文字数の目安は全角30文字前後</h2>
<p>Google の検索結果では、タイトルは文字数ではなく表示幅で省略されます。そのため厳密な上限はありませんが、日本語の場合は<b>全角30文字前後</b>を目安にすると、パソコンでもスマートフォンでも末尾が切れにくくなります。</p>
<div class="scroll"><table>
  <thead><tr><th>長さ（全角換算）</th><th>評価</th><th>理由</th></tr></thead>
  <tbody>
    <tr><td>10文字未満</td><td>短すぎる</td><td>内容が伝わらず、検索語句との関連も示しにくい</td></tr>
    <tr><td>15〜32文字</td><td>適切</td><td>省略されにくく、必要な情報を入れられる</td></tr>
    <tr><td>33〜40文字</td><td>やや長い</td><td>末尾が省略される可能性がある</td></tr>
    <tr><td>40文字超</td><td>長すぎる</td><td>後半が表示されず、重要な語句が伝わらない</td></tr>
  </tbody>
</table></div>
<p>半角の英数字は全角の約半分の幅です。「SEO」は全角1.5文字分として数えます。SEOチェッカーも、この全角換算でタイトルの長さを判定しています。</p>

<h2>検索で選ばれるタイトルの書き方</h2>
<h3>重要な語句を前半に置く</h3>
<p>長いタイトルは末尾から省略されます。検索されたい語句と、ページの内容が一目で分かる言葉は、前半の15文字以内に入れてください。サイト名は末尾に置くのが基本です。</p>
<h3>ページの内容を具体的に書く</h3>
<p>「サービス紹介」より「法人向け勤怠管理システムの機能と料金」のほうが、検索した人は自分に関係があるかを判断できます。数字や対象者、得られる結果を入れると具体的になります。</p>
<h3>ページごとに固有のタイトルにする</h3>
<p>複数のページが同じタイトルだと、Google はどのページを検索結果に出すべきか判断できません。同じサイト内で評価を奪い合うことにもなります。すべてのページに、そのページだけの内容を表すタイトルを付けてください。</p>

<h2>良い例と悪い例</h2>
<div class="scroll"><table>
  <thead><tr><th>悪い例</th><th>良い例</th><th>改善点</th></tr></thead>
  <tbody>
    <tr><td>ホーム</td><td>山田歯科医院｜渋谷駅徒歩3分・土日診療</td><td>何のサイトかが分かる</td></tr>
    <tr><td>商品一覧 | 商品一覧 | 商品一覧</td><td>メンズ革靴の通販｜ビジネスシューズ一覧</td><td>語句の繰り返しをやめる</td></tr>
    <tr><td>株式会社〇〇｜ブログ｜確定申告のやり方</td><td>確定申告のやり方を5ステップで解説｜〇〇</td><td>重要な語句を前に出す</td></tr>
  </tbody>
</table></div>

<h2>よくある失敗</h2>
<ul>
  <li><b>キーワードの詰め込み。</b>同じ語句を何度も並べたタイトルは読みにくく、Google に書き換えられる原因にもなります。</li>
  <li><b>タイトルタグが2つある。</b>テンプレートとプラグインの両方が出力している例があります。head 内に1つだけにしてください。</li>
  <li><b>全ページが同じ文言。</b>CMS の初期設定のままになっていないか確認します。</li>
  <li><b>内容と合っていない。</b>本文に出てこない語句をタイトルに入れても評価されません。</li>
</ul>

<h2>Google がタイトルを書き換えることがある</h2>
<p>Google は、タイトルタグの内容がページに合っていないと判断すると、見出しやリンクテキストをもとに検索結果のタイトルを作り直すことがあります。書き換えを完全に防ぐ方法はありませんが、長すぎない・内容と一致している・H1 と大きく矛盾しない、の3点を守ると、設定したタイトルがそのまま使われやすくなります。</p>

<h2>確認方法</h2>
<p>ブラウザでページのソースを表示し、<code>&lt;title&gt;</code> を探すと確認できます。SEOチェッカーでは、タイトルの有無・長さ・重複に加えて、検索結果での見え方のプレビューも表示します。サイト全体診断を使うと、ページ間でタイトルが重複していないかをまとめて確認できます。</p>
''',
  related=["meta-description", "seo-checklist", "structured-data"]),

dict(
  slug="meta-description", short="メタディスクリプションの書き方",
  title="メタディスクリプションの書き方と文字数の目安【例文つき】",
  h1="メタディスクリプションの書き方と文字数の目安",
  desc="メタディスクリプション（meta description）は検索結果の説明文になる要素です。文字数の目安は全角70〜120文字。クリックされやすい書き方、例文、設定しても表示されない理由、確認方法を解説します。",
  lead="メタディスクリプションは、検索結果でタイトルの下に表示される説明文のもとになる要素です。検索順位を直接上げる効果はありませんが、クリックされるかどうかを左右します。このページでは、文字数の目安と書き方を例文つきで解説します。",
  body='''
<h2>メタディスクリプションの役割</h2>
<p>メタディスクリプションは、HTML の head 内に次のように書きます。</p>
<pre><code>&lt;meta name="description" content="ページの内容を要約した文章"&gt;</code></pre>
<p>Google は、メタディスクリプションを検索順位の評価には使わないと説明しています。それでも設定すべき理由は、検索結果での見え方を自分で決められるからです。同じ順位でも、内容が伝わる説明文のほうがクリックされます。</p>

<h2>文字数の目安は全角70〜120文字</h2>
<p>表示される長さは端末によって変わります。パソコンでは全角120文字前後、スマートフォンでは70文字前後で省略されるのが目安です。</p>
<ul>
  <li><b>伝えたいことは最初の70文字に入れる。</b>スマートフォンでも省略されずに表示されます。</li>
  <li><b>全体は120文字前後に収める。</b>それ以上書いても表示されません。</li>
  <li><b>50文字未満は短すぎる。</b>内容が伝わらず、Google が本文から抜粋した文に置き換えやすくなります。</li>
</ul>

<h2>クリックされやすい書き方</h2>
<h3>ページを読むと何が分かるかを書く</h3>
<p>検索した人は、自分の疑問が解決するかどうかを説明文で判断します。「〜について紹介します」で終わらせず、分かること・できるようになることを具体的に書いてください。</p>
<h3>検索されたい語句を自然に入れる</h3>
<p>検索語句と一致した部分は、検索結果で太字で表示されます。目に留まりやすくなるので、主要な語句を1〜2回、文章として自然な形で入れます。</p>
<h3>ページごとに書き分ける</h3>
<p>全ページ同じ説明文では、どのページも同じ内容に見えてしまいます。少なくとも主要なページには、そのページ専用の説明文を書いてください。</p>

<h2>例文</h2>
<div class="scroll"><table>
  <thead><tr><th>ページの種類</th><th>例文</th></tr></thead>
  <tbody>
    <tr><td>解説記事</td><td>確定申告のやり方を、必要書類の準備から提出まで5つの手順で解説します。会社員の副業や医療費控除など、ケース別の注意点と期限もまとめました。</td></tr>
    <tr><td>店舗</td><td>渋谷駅から徒歩3分の歯科医院です。平日は20時まで、土日も診療しています。虫歯治療・小児歯科・ホワイトニングに対応。予約は電話かウェブから。</td></tr>
    <tr><td>商品</td><td>本革を使ったメンズビジネスシューズの一覧です。24.0〜28.5cm、ストレートチップやローファーなど60種類以上。送料無料・サイズ交換1回無料。</td></tr>
  </tbody>
</table></div>

<h2>設定したのに表示されない理由</h2>
<p>Google は、検索語句に合わせて説明文を作り直すことがあります。設定した文章より本文の一部のほうが検索語句に合っていると判断された場合、本文からの抜粋が表示されます。これは不具合ではありません。</p>
<p>表示されやすくするには、ページの主題を正確に要約することです。本文と関係の薄い宣伝文句や、キーワードを並べただけの文章は使われにくくなります。</p>

<h2>よくある失敗</h2>
<ul>
  <li><b>設定していない。</b>説明文をすべて Google に任せることになります。</li>
  <li><b>タイトルと同じ文言。</b>同じ情報が2回表示されるだけで、判断材料が増えません。</li>
  <li><b>全ページ共通の文言。</b>CMS やテンプレートの設定を確認します。</li>
  <li><b>キーワードの羅列。</b>文章として読めない説明文は表示されにくくなります。</li>
</ul>

<h2>確認方法</h2>
<p>SEOチェッカーでは、メタディスクリプションの有無と長さを判定し、検索結果での見え方をプレビューで表示します。サイト全体診断では、未設定のページと、ページ間で文言が重複しているページを一覧にできます。</p>
''',
  related=["title-tag", "seo-checklist", "structured-data"]),

dict(
  slug="noindex-robots-txt", short="noindex と robots.txt の違い",
  title="noindexとrobots.txtの違いと使い分け｜検索に出ないときの確認方法",
  h1="noindex と robots.txt の違いと使い分け",
  desc="noindexは「検索結果に出さない」、robots.txtは「クロールさせない」ための設定で、役割が違います。両方を同時に使うと逆効果になる理由、正しい使い分け、ページが検索に出ないときの確認手順を解説します。",
  lead="ページが検索結果に出てこない原因として多いのが、noindex と robots.txt の設定です。どちらも検索エンジンを制御する仕組みですが、役割はまったく違います。違いを理解せずに使うと、消したいページが残り、出したいページが消えることになります。",
  body='''
<h2>役割の違い</h2>
<div class="scroll"><table>
  <thead><tr><th></th><th>noindex</th><th>robots.txt の Disallow</th></tr></thead>
  <tbody>
    <tr><th>何を止めるか</th><td>検索結果への表示（インデックス）</td><td>ページの取得（クロール）</td></tr>
    <tr><th>書く場所</th><td>各ページの HTML か HTTP ヘッダー</td><td>サイト直下の robots.txt</td></tr>
    <tr><th>検索結果から消えるか</th><td>消える</td><td>消えるとは限らない</td></tr>
    <tr><th>主な用途</th><td>検索に出したくないページ</td><td>クロールさせる必要のないページ</td></tr>
  </tbody>
</table></div>
<p>要点は、<b>robots.txt は検索結果から消すための仕組みではない</b>ということです。robots.txt でブロックしたページでも、ほかのサイトからリンクされていれば、URL だけが検索結果に表示されることがあります。</p>

<h2>noindex の書き方</h2>
<p>HTML の head 内に書く方法が一般的です。</p>
<pre><code>&lt;meta name="robots" content="noindex"&gt;</code></pre>
<p>PDF や画像など HTML 以外のファイルには、HTTP レスポンスヘッダーで指定します。</p>
<pre><code>X-Robots-Tag: noindex</code></pre>

<h2>robots.txt の書き方</h2>
<p>robots.txt は、サイトの一番上の階層（<code>https://example.com/robots.txt</code>）に置くテキストファイルです。</p>
<pre><code>User-agent: *
Disallow: /admin/
Disallow: /search

Sitemap: https://example.com/sitemap.xml</code></pre>
<p>この例は、すべてのクローラーに対して /admin/ 以下と /search で始まる URL の取得を禁止し、サイトマップの場所を伝えています。</p>

<h2>両方を同時に使ってはいけない</h2>
<p>「確実に消したいから」と、noindex を付けたページを robots.txt でもブロックするのは逆効果です。</p>
<p>robots.txt でブロックすると、Google はそのページを取得できません。取得できなければ、ページに書かれた noindex を読むこともできません。その結果、noindex が効かず、URL だけが検索結果に残り続けることがあります。</p>
<p><b>検索結果から消したいページは、クロールを許可したうえで noindex を付ける</b>のが正しい手順です。</p>

<h2>使い分けの目安</h2>
<div class="scroll"><table>
  <thead><tr><th>ページの種類</th><th>使うもの</th></tr></thead>
  <tbody>
    <tr><td>サンクスページ、会員限定ページ、テスト用ページ</td><td>noindex</td></tr>
    <tr><td>サイト内検索の結果、絞り込みで無数に生成される URL</td><td>robots.txt（クロールの無駄を減らす）</td></tr>
    <tr><td>管理画面、API</td><td>robots.txt に加えて認証をかける</td></tr>
    <tr><td>内容が重複するページ</td><td>canonical で正規 URL を示す</td></tr>
  </tbody>
</table></div>
<p>なお、robots.txt は誰でも読めるファイルです。見られて困る URL を書くと、かえって存在を知らせることになります。非公開にしたいページは認証で保護してください。</p>

<h2>ページが検索に出ないときの確認手順</h2>
<ol>
  <li><b>ページのソースで noindex を探す。</b><code>name="robots"</code> で検索します。</li>
  <li><b>HTTP ヘッダーを確認する。</b>X-Robots-Tag に noindex がないかを見ます。サーバーや CDN の設定で付いていることがあります。</li>
  <li><b>robots.txt を開く。</b>対象の URL が Disallow の対象になっていないかを確認します。</li>
  <li><b>canonical を確認する。</b>別の URL を指していると、そのページ自体は検索結果に出ません。</li>
  <li><b>Google Search Console の URL 検査で確認する。</b>Google が実際にどう認識しているかが分かります。</li>
</ol>
<p>SEOチェッカーでは、1から4をまとめて確認できます。noindex や robots.txt のブロックが見つかった場合は、最優先の改善点として表示します。</p>

<h2>よくある事故</h2>
<ul>
  <li><b>公開時に noindex を外し忘れる。</b>開発中のサイトに付けた設定が本番に残る例です。WordPress の「検索エンジンがサイトをインデックスしないようにする」のチェックも同じ働きをします。</li>
  <li><b>robots.txt に Disallow: / が残っている。</b>サイト全体がクロールされなくなります。</li>
  <li><b>CSS や JavaScript をブロックしている。</b>Google がページを正しく描画できず、評価が下がる原因になります。</li>
</ul>
''',
  related=["seo-checklist", "broken-links", "title-tag"]),

dict(
  slug="broken-links", short="リンク切れの調べ方と直し方",
  title="リンク切れ（404）の調べ方と直し方｜SEOへの影響も解説",
  h1="リンク切れの調べ方と直し方",
  desc="リンク切れ（404エラー）はユーザーの離脱とクロールの無駄につながります。リンク切れが起きる原因、無料ツールでの調べ方、内部リンク・外部リンクそれぞれの直し方、301リダイレクトの使い方を解説します。",
  lead="リンク切れとは、リンクをクリックしても「ページが見つかりません（404）」と表示される状態のことです。サイトを長く運営していると必ず発生します。このページでは、リンク切れが SEO に与える影響と、調べ方・直し方を解説します。",
  body='''
<h2>リンク切れが SEO に与える影響</h2>
<p>Google は、404 のページがあること自体はサイトの評価を下げる理由にならないと説明しています。存在しないページが 404 を返すのは正常な動作だからです。問題になるのは、<b>自分のサイト内にリンク切れを放置している場合</b>です。</p>
<ul>
  <li><b>訪問者が離脱する。</b>読みたかったページにたどり着けず、サイトへの信頼も下がります。</li>
  <li><b>評価が受け渡されない。</b>内部リンクは、ページの評価を別のページに伝える経路です。リンク先が存在しなければ、そこで途切れます。</li>
  <li><b>クロールの無駄になる。</b>クローラーが存在しないページの取得に時間を使うことになります。</li>
  <li><b>削除したページへの被リンクが無駄になる。</b>外部サイトからリンクされていたページを消すと、その評価を失います。</li>
</ul>

<h2>リンク切れが起きる原因</h2>
<ul>
  <li>ページを削除した、または URL を変更した</li>
  <li>リンクの URL を書き間違えた</li>
  <li>サイトのリニューアルでディレクトリ構成が変わった</li>
  <li>リンク先の外部サイトがページを削除した、またはサイトを閉鎖した</li>
  <li>相対パスの指定を誤り、意図しない URL になっている</li>
</ul>
<p>最後の例は気づきにくいので注意が必要です。たとえば <code>/docs/security/</code> のページに <code>docs/pages/team.md</code> という相対リンクがあると、リンク先は <code>/docs/security/docs/pages/team.md</code> になり、404 になります。</p>

<h2>リンク切れの調べ方</h2>
<h3>1ページだけ調べる</h3>
<p>SEOチェッカーの1ページ診断では、ページ内のリンクを最大60本まで実際に開いて、リンク切れを検出します。切れているリンクの URL とリンクテキストが一覧で表示されるので、該当箇所をすぐに見つけられます。</p>
<h3>サイト全体を調べる</h3>
<p>サイト全体診断では、最大50ページを巡回して内部リンクを確認します。切れているリンク先と、そのリンクを張っているページが分かります。</p>
<h3>Google Search Console で調べる</h3>
<p>Search Console の「ページ」レポートで、「見つかりませんでした（404）」に分類された URL を確認できます。Google が実際に取得しようとした URL なので、外部サイトからリンクされている削除済みページを見つけるのに向いています。</p>

<h2>ステータスコードの見方</h2>
<div class="scroll"><table>
  <thead><tr><th>コード</th><th>意味</th><th>対応</th></tr></thead>
  <tbody>
    <tr><td>200</td><td>正常</td><td>対応不要</td></tr>
    <tr><td>301 / 308</td><td>恒久的な転送</td><td>内部リンクなら、転送先の URL に書き換える</td></tr>
    <tr><td>302 / 307</td><td>一時的な転送</td><td>恒久的な移転なら 301 に変更する</td></tr>
    <tr><td>404 / 410</td><td>ページが存在しない</td><td>リンクを直すか、転送を設定する</td></tr>
    <tr><td>500 番台</td><td>サーバーエラー</td><td>サーバー側の不具合を調べる</td></tr>
    <tr><td>403 / 429</td><td>アクセス拒否・回数制限</td><td>自動アクセスが拒否されただけの場合がある。ブラウザで開いて確認する</td></tr>
  </tbody>
</table></div>
<p>SNS など一部のサイトは、ツールからの自動アクセスを拒否します。この場合はリンク切れとは限らないため、SEOチェッカーでは「判定不能」として、リンク切れには数えていません。</p>

<h2>リンク切れの直し方</h2>
<h3>内部リンクの場合</h3>
<ol>
  <li><b>リンク先の URL が間違っているなら、正しい URL に書き換える。</b></li>
  <li><b>ページを移動したなら、新しい URL に書き換える。</b>あわせて、古い URL から新しい URL へ 301 リダイレクトを設定します。</li>
  <li><b>ページを削除したなら、リンクを外す。</b>内容の近いページがあれば、そちらにリンクを張り替えます。</li>
</ol>
<h3>外部リンクの場合</h3>
<p>リンク先のサイトが移転していれば、新しい URL に書き換えます。ページがなくなっていれば、同じ内容を扱う別の信頼できるページにリンクを張り替えるか、リンクを削除します。</p>

<h2>削除したページには 301 リダイレクトを設定する</h2>
<p>ほかのサイトからリンクされていたページや、検索から訪問があったページを削除・移動するときは、内容の近いページへ 301 リダイレクトを設定します。訪問者を迷わせず、ページが得ていた評価も引き継げます。</p>
<p>注意点は、関係のないページへ転送しないことです。削除したすべてのページをトップページに転送すると、Google は「ページが存在しない」のと同じ扱いをすることがあります。内容が対応するページがない場合は、404 のままにしておくのが適切です。</p>

<h2>リダイレクトを経由する内部リンクも直す</h2>
<p>リンク切れではありませんが、内部リンクが転送を経由している状態も改善の対象です。http から https へ、末尾のスラッシュの有無などで、クリックのたびに余計な転送が発生します。リンクの href を転送後の最終 URL に書き換えると、表示が速くなり、クロールの無駄も減ります。</p>
''',
  related=["noindex-robots-txt", "seo-checklist", "core-web-vitals"]),

dict(
  slug="core-web-vitals", short="Core Web Vitals の基準と改善方法",
  title="Core Web Vitalsとは？LCP・INP・CLSの基準値と改善方法",
  h1="Core Web Vitals（LCP・INP・CLS）の基準と改善方法",
  desc="Core Web VitalsはGoogleがページ体験の評価に使う3つの指標です。LCPは2.5秒以内、INPは200ミリ秒以内、CLSは0.1以下が合格ライン。各指標の意味、実測値とラボ値の違い、原因別の改善方法を解説します。",
  lead="Core Web Vitals（コアウェブバイタル）は、ページの表示速度や操作のしやすさを数値で表した、Google の3つの指標です。検索順位を決める要素のひとつとして使われています。このページでは、各指標の意味と合格ライン、改善方法を解説します。",
  body='''
<h2>3つの指標と合格ライン</h2>
<div class="scroll"><table>
  <thead><tr><th>指標</th><th>測るもの</th><th>良好</th><th>改善が必要</th><th>不良</th></tr></thead>
  <tbody>
    <tr><th>LCP</th><td>メインの内容が表示されるまでの時間</td><td>2.5秒以内</td><td>4.0秒以内</td><td>4.0秒超</td></tr>
    <tr><th>INP</th><td>操作してから画面が反応するまでの時間</td><td>200ミリ秒以内</td><td>500ミリ秒以内</td><td>500ミリ秒超</td></tr>
    <tr><th>CLS</th><td>読み込み中に起きるレイアウトのずれ</td><td>0.1以下</td><td>0.25以下</td><td>0.25超</td></tr>
  </tbody>
</table></div>
<p>判定には、訪問者の75%が体験した値（75パーセンタイル）が使われます。平均値ではないので、一部の遅い環境での体験も結果に影響します。</p>

<h2>実測値とラボ値の違い</h2>
<p>Core Web Vitals には2種類のデータがあります。</p>
<ul>
  <li><b>実測値（フィールドデータ）。</b>Chrome を使う実際の訪問者から集めた過去28日間のデータです。Google が検索の評価に使うのはこちらです。</li>
  <li><b>ラボ値。</b>決まった条件でページを1回読み込んで測った値です。Lighthouse や PageSpeed Insights の「パフォーマンスの問題を診断する」がこれにあたります。</li>
</ul>
<p>アクセス数の少ないページには実測値がありません。その場合はラボ値を参考にします。また、INP は実際の操作がないと測れないため、ラボでは代わりに TBT（Total Blocking Time）を見ます。TBT が大きいページは、INP も悪くなりやすい傾向があります。</p>
<p>SEOチェッカーは、PageSpeed Insights から実測値とラボ値の両方を取得し、実測値がある場合はそちらを重く評価しています。</p>

<h2>LCP の改善方法</h2>
<p>LCP は、多くのページで最上部の大きな画像か、見出しのテキストが対象になります。</p>
<ul>
  <li><b>メイン画像を軽くする。</b>表示サイズに合わせて縮小し、WebP や AVIF に変換します。</li>
  <li><b>メイン画像を遅延読み込みしない。</b>最上部の画像に <code>loading="lazy"</code> を付けると、かえって遅くなります。<code>fetchpriority="high"</code> を付けて優先的に読み込ませます。</li>
  <li><b>サーバーの応答を速くする。</b>キャッシュや CDN を使い、HTML が届くまでの時間を短縮します。</li>
  <li><b>描画を止めるファイルを減らす。</b>head 内のスクリプトには defer か async を付け、使っていない CSS を削除します。</li>
  <li><b>ウェブフォントの読み込みを見直す。</b><code>font-display: swap</code> を指定し、フォントが届く前でも文字が表示されるようにします。</li>
</ul>

<h2>INP の改善方法</h2>
<p>INP は、クリックやタップ、キー入力に対する反応の遅さを測ります。原因のほとんどは JavaScript です。</p>
<ul>
  <li><b>使っていない JavaScript を削除する。</b>読み込むだけで処理時間がかかります。</li>
  <li><b>外部のタグを減らす。</b>広告、計測、チャット、SNS の埋め込みは、積み重なると大きな負荷になります。必要なものだけを残します。</li>
  <li><b>長い処理を分割する。</b>50ミリ秒を超える処理は、途中で画面の更新を挟めるように分けます。</li>
  <li><b>DOM を小さくする。</b>要素数が多いと、操作のたびに再計算に時間がかかります。</li>
</ul>

<h2>CLS の改善方法</h2>
<p>CLS は、読んでいる途中で内容が下にずれたり、押そうとしたボタンが動いたりする現象を数値にしたものです。</p>
<ul>
  <li><b>画像と動画に width と height を書く。</b>読み込み前から表示領域が確保され、後からずれなくなります。</li>
  <li><b>広告や埋め込みの領域を先に確保する。</b>CSS で高さを指定しておきます。</li>
  <li><b>ページの上部に後から要素を挿入しない。</b>お知らせのバナーなどは、領域を確保しておくか、内容に重ねて表示します。</li>
  <li><b>ウェブフォントによるずれを抑える。</b>代替フォントとの大きさの差が小さくなるように調整します。</li>
</ul>

<h2>どこから手を付けるか</h2>
<ol>
  <li><b>実測値で「不良」の指標から直す。</b>検索の評価に使われているのは実測値です。</li>
  <li><b>テンプレート単位で直す。</b>同じ作りのページは同じ問題を抱えています。1か所の修正が全ページに効きます。</li>
  <li><b>スマートフォンを優先する。</b>Google はスマートフォン向けのページを基準に評価します。回線も処理能力もパソコンより厳しい条件です。</li>
</ol>
<p>なお、Core Web Vitals は検索順位を決める多くの要素のひとつです。内容が検索意図に合っているかどうかのほうが影響は大きく、速度だけを改善しても順位が大きく上がるとは限りません。内容が同程度のページ同士で差がつく要素、と考えるのが実態に近いでしょう。</p>
''',
  related=["seo-checklist", "broken-links", "structured-data"]),

dict(
  slug="structured-data", short="構造化データ（JSON-LD）の基本",
  title="構造化データ（JSON-LD）の書き方入門｜種類と確認方法",
  h1="構造化データ（JSON-LD）の基本と書き方",
  desc="構造化データは、ページの内容を検索エンジンに正確に伝えるための記述です。JSON-LDの書き方、よく使うスキーマ（パンくず・記事・商品・組織）の例、必須項目、よくあるエラーと確認方法を解説します。",
  lead="構造化データとは、「このページは記事で、著者は誰で、公開日はいつか」といった情報を、検索エンジンが確実に読み取れる形式で書いたものです。設定すると、検索結果にパンくずや評価の星などが表示される「リッチリザルト」の対象になります。",
  body='''
<h2>構造化データで得られる効果</h2>
<ul>
  <li><b>検索結果の表示が豊かになる。</b>パンくずリスト、レビューの星、商品の価格、イベントの日時などが表示され、目に留まりやすくなります。</li>
  <li><b>内容が正確に伝わる。</b>ページの種類や、運営者・著者・公開日などの情報を、検索エンジンが推測ではなく明示された情報として読み取れます。</li>
</ul>
<p>構造化データを入れただけで検索順位が上がるわけではありません。また、設定してもリッチリザルトが必ず表示されるとは限らず、表示するかどうかは Google が判断します。</p>

<h2>JSON-LD の書き方</h2>
<p>構造化データにはいくつかの書式がありますが、Google が推奨しているのは JSON-LD です。HTML の中に script タグで書くため、ページの見た目に影響しません。</p>
<pre><code>&lt;script type="application/ld+json"&gt;
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "株式会社サンプル",
  "url": "https://example.com/",
  "logo": "https://example.com/logo.png"
}
&lt;/script&gt;</code></pre>
<p><code>@type</code> が情報の種類（スキーマ）で、その下に種類ごとに決められた項目を書きます。head 内でも body 内でも構いません。</p>

<h2>よく使うスキーマ</h2>
<div class="scroll"><table>
  <thead><tr><th>スキーマ</th><th>使うページ</th><th>主な必須・推奨項目</th></tr></thead>
  <tbody>
    <tr><td>BreadcrumbList</td><td>下層ページ全般</td><td>itemListElement（各階層の名前と URL）</td></tr>
    <tr><td>Article / BlogPosting</td><td>記事、ブログ</td><td>headline、image、datePublished、author</td></tr>
    <tr><td>Product</td><td>商品ページ</td><td>name と、offers・review・aggregateRating のいずれか</td></tr>
    <tr><td>Organization</td><td>トップページ、会社概要</td><td>name、url、logo</td></tr>
    <tr><td>LocalBusiness</td><td>店舗、医院</td><td>name、address、営業時間、電話番号</td></tr>
    <tr><td>WebSite</td><td>トップページ</td><td>name、url</td></tr>
    <tr><td>Event</td><td>イベント告知</td><td>name、startDate、location</td></tr>
    <tr><td>JobPosting</td><td>求人</td><td>title、description、datePosted、hiringOrganization</td></tr>
  </tbody>
</table></div>
<p>最初に入れるなら、ほぼすべてのサイトで使える BreadcrumbList と、トップページの Organization・WebSite がおすすめです。</p>

<h2>パンくずリストの例</h2>
<pre><code>&lt;script type="application/ld+json"&gt;
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://example.com/" },
    { "@type": "ListItem", "position": 2, "name": "ブログ", "item": "https://example.com/blog/" },
    { "@type": "ListItem", "position": 3, "name": "記事のタイトル" }
  ]
}
&lt;/script&gt;</code></pre>
<p>設定すると、検索結果の URL 表示が「example.com › ブログ」のような階層の表示になります。</p>

<h2>FAQ と HowTo の現状</h2>
<p>以前は FAQPage を設定すると、検索結果に質問と回答が展開して表示されました。現在この表示は、政府機関や医療機関など一部の権威あるサイトに限定されています。HowTo のリッチリザルトも廃止されました。これらを設定しても害はありませんが、検索結果の見た目が変わることは期待できません。</p>

<h2>よくあるエラー</h2>
<ul>
  <li><b>JSON の構文エラー。</b>末尾の余分なカンマ、引用符の閉じ忘れ、全角の引用符が原因の大半です。1か所でも誤りがあると、そのブロック全体が読み取られません。</li>
  <li><b>必須項目の不足。</b>Article に image や datePublished がない、Product に価格や評価がない、といった例です。</li>
  <li><b>ページに表示されていない内容を書く。</b>画面にない評価や価格を構造化データだけに書くことは、Google のガイドライン違反です。</li>
  <li><b>テンプレートの変数が展開されていない。</b>出力された HTML を必ず確認します。</li>
</ul>

<h2>確認方法</h2>
<ol>
  <li><b>SEOチェッカーで確認する。</b>JSON-LD の構文エラーと、主要なスキーマの必須項目の不足を検出します。検出されたスキーマの種類も一覧で表示します。</li>
  <li><b>Google のリッチリザルト テストで確認する。</b>Google がリッチリザルトの対象として認識できるかを判定します。</li>
  <li><b>Search Console の拡張レポートで確認する。</b>公開後に、サイト全体でエラーが出ていないかを継続して確認できます。</li>
</ol>
''',
  related=["seo-checklist", "title-tag", "meta-description"]),
]
BY_SLUG = {g["slug"]: g for g in GUIDES}


def esc(s):
    return html.escape(s, quote=True)


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"


def page(path, title, desc, main, *, og_type="website", jsonld=(), robots=None):
    url = SITE + path
    head = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{esc(title)}</title>",
        f'<meta name="description" content="{esc(desc)}">',
    ]
    if robots:
        head.append(f'<meta name="robots" content="{robots}">')
    else:
        head.append(f'<link rel="canonical" href="{url}">')
    head += [
        '<meta name="theme-color" content="#0f766e">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(desc)}">',
        f'<meta property="og:type" content="{og_type}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{SITE}/og.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:site_name" content="{NAME}">',
        '<meta property="og:locale" content="ja_JP">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="stylesheet" href="/style.css">',
    ]
    head += [ld(j) for j in jsonld]
    return ("<!DOCTYPE html>\n<html lang=\"ja\">\n<head>\n" + "\n".join(head) + "\n</head>\n<body>\n" + HEADER +
            "\n\n<main class=\"wrap prose\">\n" + main.strip() + "\n</main>\n\n" + FOOTER + "\n</body>\n</html>\n")


def crumbs(items):
    """items: [(name, path|None)]"""
    parts = []
    for name, path in items:
        parts.append(f'<a href="{path}">{esc(name)}</a>' if path else f'<span aria-current="page">{esc(name)}</span>')
    nav = '<nav class="crumbs" aria-label="パンくずリスト">' + " › ".join(parts) + "</nav>"
    data = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": name, **({"item": SITE + path} if path else {})}
        for i, (name, path) in enumerate(items)]}
    return nav, data


def write(rel, text):
    f = OUT / rel
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(text, encoding="utf-8")
    print("wrote", rel)


def build():
    org = {"@type": "Organization", "name": NAME, "url": SITE + "/"}

    # ---- ガイド記事 ----
    for g in GUIDES:
        path = f"/guide/{g['slug']}"
        nav, bc = crumbs([("SEOチェッカー", "/"), ("SEOガイド", "/guide/"), (g["short"], None)])
        rel = "".join(f'<li><a href="/guide/{s}">{esc(BY_SLUG[s]["h1"])}</a></li>' for s in g["related"])
        main = f'''{nav}
<article>
<h1>{esc(g["h1"])}</h1>
<p class="meta">公開日: <time datetime="{TODAY}">{TODAY.replace("-", "/")}</time>　{NAME} 編集部</p>
<p class="lead">{g["lead"]}</p>
{g["body"].strip()}
{CTA}
</article>
<section class="related">
<h2>関連するガイド</h2>
<ul>{rel}</ul>
</section>'''
        article = {"@context": "https://schema.org", "@type": "Article", "headline": g["h1"], "description": g["desc"],
                   "image": SITE + "/og.png", "datePublished": TODAY, "dateModified": TODAY, "inLanguage": "ja",
                   "mainEntityOfPage": SITE + path, "author": org, "publisher": org}
        write(f"guide/{g['slug']}.html", page(path, g["title"], g["desc"], main, og_type="article", jsonld=[article, bc]))

    # ---- ガイド一覧 ----
    nav, bc = crumbs([("SEOチェッカー", "/"), ("SEOガイド", None)])
    cards = "".join(f'<li><a href="/guide/{g["slug"]}"><b>{esc(g["h1"])}</b><span>{esc(g["desc"])}</span></a></li>' for g in GUIDES)
    main = f'''{nav}
<h1>SEOガイド：内部対策の基本を項目別に解説</h1>
<p class="lead">SEOチェッカーが診断している項目について、なぜ重要なのか、どう直せばよいのかを項目別に解説しています。診断結果で指摘された項目から読むと、すぐに改善に取りかかれます。</p>
<ul class="cards">{cards}</ul>
{CTA}'''
    write("guide/index.html", page("/guide/", "SEOガイド｜内部対策の基本を項目別に解説 - SEOチェッカー",
          "タイトルタグ、メタディスクリプション、noindexとrobots.txt、リンク切れ、Core Web Vitals、構造化データなど、内部SEOの基本を項目別に解説するガイド集です。チェックリストつき。", main, jsonld=[bc]))

    # ---- このサイトについて ----
    nav, bc = crumbs([("SEOチェッカー", "/"), ("このサイトについて", None)])
    main = f'''{nav}
<h1>このサイトについて</h1>
<p class="lead">SEOチェッカーは、URL を入力するだけでページの SEO を約70項目で採点し、優先度順の改善点を表示する無料のツールです。会員登録は不要で、回数の制限もありません。</p>

<h2>SEOチェッカーでできること</h2>
<ul>
  <li><b>1ページ診断。</b>タイトルやメタ情報、見出し、クロール設定、リンク切れ、構造化データ、表示速度までを確認し、100点満点で採点します。</li>
  <li><b>サイト全体診断。</b>最大50ページを巡回し、タイトルの重複や内部リンク切れなど、ページをまたぐ問題を検出します。</li>
  <li><b>改善点の提示。</b>問題の重さと影響の大きさから優先順位を付け、直し方とあわせて表示します。</li>
  <li><b>レポートの書き出し。</b>診断結果をテキストや CSV、PDF として保存できます。</li>
</ul>

<h2>採点の考え方</h2>
<p>診断項目を7つの分野に分け、分野ごとに100点満点で採点したうえで、重み付けして総合点を出しています。</p>
<div class="scroll"><table>
  <thead><tr><th>分野</th><th>配点の重み</th></tr></thead>
  <tbody>
    <tr><td>基本メタ情報</td><td>20%</td></tr>
    <tr><td>クロール・インデックス</td><td>20%</td></tr>
    <tr><td>コンテンツ</td><td>15%</td></tr>
    <tr><td>表示速度・Lighthouse</td><td>15%</td></tr>
    <tr><td>リンク・画像</td><td>10%</td></tr>
    <tr><td>SNS・構造化データ</td><td>10%</td></tr>
    <tr><td>技術・セキュリティ</td><td>10%</td></tr>
  </tbody>
</table></div>
<p>noindex や robots.txt によるブロックなど、検索結果に表示されなくなる問題がある場合は、総合点を45点までに制限します。項目の一覧は「<a href="/guide/seo-checklist">SEOチェックリスト</a>」に掲載しています。</p>

<h2>診断の限界</h2>
<p>このツールが確認できるのは、ページの技術的な状態です。次の点は診断の対象外です。</p>
<ul>
  <li>内容が検索した人の役に立つかどうか</li>
  <li>ほかのサイトからのリンク（被リンク）の状況</li>
  <li>実際の検索順位やクリック数</li>
  <li>JavaScript を実行した後に表示される内容</li>
</ul>
<p>点数は一般的な SEO の推奨事項にもとづく目安であり、検索順位を保証するものではありません。実際の検索での状況は、Google Search Console とあわせて確認してください。</p>

<h2>仕組みと利用しているサービス</h2>
<p>診断の処理は、お使いのブラウザの中で実行されます。診断結果がこのサイトのサーバーに保存されることはありません。ページの取得には当サイトの中継機能を、表示速度の計測には Google PageSpeed Insights を、DNS の確認には Google Public DNS を利用しています。詳しくは<a href="/privacy">プライバシーポリシー</a>をご覧ください。</p>

{OPERATOR_SECTION}
<h2>ご利用にあたって</h2>
<p>診断のために、対象のサイトへ自動でアクセスします。サイト全体診断では最大50ページと、そのリンク先を取得します。ご自身が管理するサイト、または診断の許可を得ているサイトでご利用ください。</p>
{CTA}'''
    write("about.html", page("/about", "このサイトについて｜SEOチェッカーの仕組みと採点方法",
          "SEOチェッカーは、URLを入力するだけでSEOを約70項目で採点する無料ツールです。診断できる内容、分野ごとの配点、採点の考え方、診断の限界、利用している外部サービスについて説明します。", main, jsonld=[bc]))

    # ---- プライバシーポリシー ----
    nav, bc = crumbs([("SEOチェッカー", "/"), ("プライバシーポリシー", None)])
    main = f'''{nav}
<h1>プライバシーポリシー</h1>
<p class="meta">制定日: <time datetime="{TODAY}">{TODAY.replace("-", "/")}</time></p>
<p class="lead">SEOチェッカー（以下「当サイト」）における情報の取り扱いについて説明します。当サイトは会員登録を必要とせず、氏名やメールアドレスなどの個人情報を収集しません。</p>

<h2>当サイトが保存する情報</h2>
<p>診断の処理はお使いのブラウザの中で実行されます。入力された URL や診断結果を、当サイトがデータベースなどに保存することはありません。</p>
<p>ブラウザの保存領域（ローカルストレージ）には、次の設定だけを保存します。これらはお使いの端末の中にとどまり、当サイトには送信されません。ブラウザのサイトデータを削除すると消去されます。</p>
<ul>
  <li>速度計測の対象（モバイル・PC・計測しない）</li>
  <li>サイト全体診断の最大ページ数</li>
  <li>ご自身で入力した PageSpeed API キーと取得プロキシの URL（入力した場合のみ）</li>
</ul>
<p>当サイトは Cookie を使用していません。アクセス解析ツールや広告も設置していません。</p>

<h2>診断のために外部へ送信される情報</h2>
<p>診断を実行すると、入力された URL が次の送信先に送られます。</p>
<div class="scroll"><table>
  <thead><tr><th>送信先</th><th>目的</th><th>送信される情報</th></tr></thead>
  <tbody>
    <tr><td>当サイトの中継機能（Cloudflare 上で動作）</td><td>診断対象のページ、robots.txt、サイトマップの取得と、リンク先の確認</td><td>診断対象の URL、ページ内のリンクの URL</td></tr>
    <tr><td>Google PageSpeed Insights</td><td>表示速度の計測</td><td>診断対象の URL</td></tr>
    <tr><td>Google Public DNS</td><td>DNS 設定の確認</td><td>診断対象のドメイン名</td></tr>
    <tr><td>診断対象のサイト</td><td>SNS 表示プレビューの画像の表示</td><td>画像の取得に伴う通常のアクセス情報（IP アドレスなど）</td></tr>
  </tbody>
</table></div>
<p>当サイトの中継機能が利用できない場合に限り、ページの取得に第三者が運営する公開プロキシ（cors.lol、AllOrigins、CodeTabs、corsproxy.io）を使用することがあります。この場合、診断対象の URL がこれらのサービスに送信されます。</p>
<p>各サービスに送信された情報は、それぞれの事業者のプライバシーポリシーに従って取り扱われます。ログインが必要なページや、外部に知られたくない URL は診断しないでください。</p>

<h2>アクセスログ</h2>
<p>当サイトは Cloudflare のサービス上で配信されています。配信にあたり、Cloudflare が IP アドレスやアクセス日時などの情報を、同社のポリシーに従って処理します。当サイトの運営者が、これらの情報を個人の特定に使用することはありません。</p>

<h2>免責事項</h2>
<p>診断結果は、一般的な SEO の推奨事項にもとづく目安です。内容の正確性や、検索順位の向上を保証するものではありません。診断結果を利用したことで生じた損害について、当サイトは責任を負いません。</p>

<h2>改定</h2>
<p>このポリシーの内容は、機能の追加や変更に応じて改定することがあります。改定後の内容は、このページに掲載した時点から適用されます。</p>'''
    write("privacy.html", page("/privacy", "プライバシーポリシー｜SEOチェッカー",
          "SEOチェッカーのプライバシーポリシーです。会員登録は不要で個人情報は収集しません。ブラウザに保存する設定、診断のために外部サービスへ送信される情報、アクセスログの取り扱いについて説明します。", main, jsonld=[bc]))

    # ---- 404 ----
    main = '''<h1>ページが見つかりません</h1>
<p class="lead">お探しのページは、移動または削除された可能性があります。URL に誤りがないかご確認ください。</p>
<ul>
  <li><a href="/">SEO診断ツール（トップページ）</a></li>
  <li><a href="/guide/">SEOガイド</a></li>
  <li><a href="/guide/seo-checklist">SEOチェックリスト</a></li>
</ul>'''
    write("404.html", page("/404", "ページが見つかりません｜SEOチェッカー", "お探しのページは見つかりませんでした。", main, robots="noindex"))

    # ---- sitemap.xml / robots.txt ----
    urls = ["/", "/guide/"] + [f"/guide/{g['slug']}" for g in GUIDES] + ["/about", "/privacy"]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"  <url><loc>{SITE}{u}</loc><lastmod>{TODAY}</lastmod></url>" for u in urls]
    sm.append("</urlset>")
    write("sitemap.xml", "\n".join(sm) + "\n")
    write("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: {SITE}/sitemap.xml\n")


if __name__ == "__main__":
    build()
