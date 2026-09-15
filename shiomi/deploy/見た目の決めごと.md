# 汐見の家 — 意匠の基準（第2版）

`style.css` 1枚で全ページの見た目を決めます。第1版から**部品の設計を丸ごと入れ替えました**。旧クラス名は残していません。下層ページを組み直すときは、この文書と `index.html` を手本にしてください。旧→新の対応表は末尾（§10）にあります。

---

## 1. 考え方

**夜に着いて、朝の海を見て帰る。** トップページはその1泊を上から下へ辿る構成にしています。

1. 画面いっぱいの**夜の外観**（`.hero`）。灯りのともった家が、まず目に入る
2. 障子紙の白に戻り、料金・定員（`.facts-strip`）
3. この宿にしか無いものを、写真を半段ずらしながら（`.collage`）
4. 部屋の写真を画面の端から端まで（`.strip`）
5. 食卓と海を、写真に文章の板を重ねて（`.overlap`）
6. 読み物の目次（`.index-list`）
7. **朝の海**の上で「泊まりに来ませんか」（`.cta-scene`）
8. 夜の地のフッターで閉じる（`.site-footer`）

意匠の骨は5つです。

- **写真は箱に入れない。** 主役の写真は画面の端まで伸ばす。文字はその上に置く（夜の写真なら白、朝の写真なら墨）
- **文字は大きく、細く、明朝で。** h1 は 1600px で 115px。本文は 17〜18px を下回らない
- **中央揃えはしない。左に重心を置き、余白を右に残す**。区画の見出しは PC では**縦書き**で左に立て、中身を読み進めても左に留まる（sticky）
- **番号は漢数字。** 一、二、三。CSS のカウンタで付くので文言には含まれない
- **動きは「無くても成立する飾り」だけ。** 読み込み時に文字が浮かぶ、写真がゆっくり引く、スクロールで区画が少し持ち上がる。`prefers-reduced-motion` で全部止まる。**透明度は動かさない**（どんな状態でも文字は見えている）

白ベース・差し色は青・上品・温かい、の4条件は生きています。地の白、墨の文字、汐の青はそのまま。**夜の色（`--night`）を1色足しました**。ヒーローとフッターの地で、写真の夜空から取っています。白いページを夜の色で上下から挟むことで、白がより白く見えます。

---

## 2. 色

| 変数 | 値 | 使いどころ |
|---|---|---|
| `--paper` | `#fbfaf7` | ページの地 |
| `--paper-deep` | `#f1ede4` | 一段濃い地。囲み `.note`、写真の読み込み前 |
| `--ink` | `#2a2924` | 本文・見出し・罫線の濃いほう |
| `--ink-soft` | `#6a665e` | 補足、キャプション、日付 |
| `--rule` | `#ddd7cb` | 罫線 |
| `--shio` | `#2f6b87` | 差し色。リンク、ボタン、項目名、漢数字。ロゴの青 `#73C9E5` を白地で読める濃さまで落としたもの |
| `--shio-deep` | `#1f4f66` | マウスを乗せたとき |
| `--shio-pale` | `#e6eef2` | 淡い青の地。`.note--important` |
| `--night` | `#14181c` | **新規。** 夜。ヒーローの下地、フッター、浮遊する「ご予約」 |
| `--night-soft` | `#1d2329` | 夜の一段明るい面（予備） |
| `--on-night` | `#efece6` | 夜の上の文字 |
| `--on-night-soft` | `#b3aea4` | 夜の上の補足文字 |

ロゴの緑 `#9ED3BA` は意匠では使いません。写真の庭と海の緑で足ります。ダークモードは作っていません（`color-scheme: light`）。

### ロゴ

- `img/logo-white.svg`：**トップのヘッダーとフッター**で使う（夜の写真・夜の地の上）
- `img/logo.svg`（カラー）：紙の地のヘッダー（下層ページ）で使う
- ロゴは縦組みで英字が小さいため、右に「古民家ゲストハウス／汐見の家」を文字で添える（`.brand__name` / `.brand__sub`）。ロゴの `alt` は空

---

## 3. 文字

OS に入っている書体だけ。Web フォントは読み込みません。

- **見出し（h1〜h3、数字、目次の題、フッターの屋号）**：明朝。Mac は Hiragino Mincho ProN、Windows は Yu Mincho → BIZ UDPMincho
- **本文・ナビ・ボタン・項目名**：ゴシック。Mac は Hiragino Sans、Windows は BIZ UDPGothic → Yu Gothic Medium → Meiryo
- **h4**：ゴシック太字

見出しは `font-feature-settings: "palt"` で詰め組み。本文は詰めない。

| | 390px | 1280px | 1600px | 変数 |
|---|---|---|---|---|
| 本文 | 17px | 18px | 18px | `html { font-size }` |
| h1（ヒーロー） | 47px | 94px | 115px | `--fs-display` |
| h2（横書き） | 34px | 47px | 56px | `--fs-h2` |
| h2（縦書き・`.side-layout__title`） | 横書きに戻る | 38px | 44px | 独自 clamp |
| h3 | 24px | 28px | 30px | `--fs-h3` |
| 数字（`.figure`） | 44px | 68px | 81px | `--fs-figure` |
| 数字・小（`.figure--small`） | 27px | 38px | 45px | |
| 補足・キャプション | .9〜.95rem（15.3〜17px） | | | |

**最小は `.brand__sub` の .9rem（390px で 15.3px）。13px 以下の文字は無い。**

行間は本文 1.9、見出し 1.35（h1 は 1.12）。字間は本文 .02em、見出し .08em、縦書き見出し .22em。1行の長さは `--w-text`（38rem ≒ 36〜38字）。

---

## 4. 余白と幅

| 変数 | 値 | 使いどころ |
|---|---|---|
| `--gutter` | 20〜96px（`clamp(1.25rem, 5vw, 6rem)`） | 左右の余白。**第1版（最大48px）の倍**。広い画面で余白を惜しまない |
| `--band` | 72〜144px | 区画 `.band` の上下 |
| `--s1`〜`--s6` | .5 / 1 / 1.5 / 2.5 / 4 / 6 rem | 部品の内側 |
| `--w-page` | 80rem（1440px） | 区画の内側の最大幅 |
| `--w-text` | 38rem | 文章の1行 |

`.band` が続くときは間が1つ分（`.band + .band { padding-top: 0 }`）。

---

## 5. 骨組み

### `.container` / `.container--text` / `.container--wide`

区画の内側。左右に `--gutter`、最大 `--w-page`。`--text` は文章幅、`--wide` は余白を最小にして写真を広く。

### `.band`

1区画。上下に `--band` の余白。修飾子：

- `.band--flush`：上下の余白なし（写真を端まで出す区画の外側に）
- `.band--night`：夜の地に白い文字
- `.band--deep`：一段濃い紙
- `.band--rule-top`：上に罫線

### `.band__head`

区画の見出しと導入文の組。`<h2>` と `<p>`（文章幅に絞られる）。

### `.eyebrow`

見出しの上の小さな前置き。青、字間広め。日付や区分にも使う。

### `.side-layout` — 縦書きの見出し ★

PC（62em ≒ 1116px 以上）で**左に縦書きの h2、右に中身**。h2 は sticky で、中身をスクロールしても左に留まる。h2 の上に短い墨の線が付く（`::before`）。スマホでは縦書きをやめ、普通の h2 として上に積む。

```html
<div class="side-layout">
  <h2 class="side-layout__title" id="rooms-h">部屋</h2>
  <div class="side-layout__body">
    …中身…
  </div>
</div>
```

見出しは **12字まで**（「よその宿には、たぶん無いもの」が上限）。それ以上は横書きの `.band__head` にする。数字を含む見出しは縦書きにしない。

---

## 6. ヘッダーとフッター

### `.site-header`

素の状態は**紙の地に墨の文字**（下層ページ用）。下に罫線。

```html
<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="/"><img src="../img/logo.svg" alt="" width="111" height="132"><span class="brand__name"><span class="brand__sub">古民家ゲストハウス</span>汐見の家</span></a>
    <nav class="site-nav" aria-label="メインメニュー">
      <ul>
        <li><a href="/about/">汐見の家について</a></li>
        <li><a href="/rooms/" aria-current="page">部屋と設備</a></li>
        …
        <li class="nav-reserve"><a href="/reserve/">ご予約</a></li>
      </ul>
    </nav>
  </div>
</header>
```

- `aria-current="page"` を付けたリンクに下線が付く
- 「ご予約」（`.nav-reserve`）だけ丸い枠のボタン。マウスで青く塗られる
- **`.site-header--overlay`** を足すと、写真の上に白い文字で重なる（`position: absolute`）。トップで使用。このときロゴは `logo-white.svg`
- メニューは隠さない。狭い幅では折り返す（年配の客層に迷いが無いように）

### `.site-footer`

夜の地。左にロゴ＋住所、右にメニュー、下に © 行。

```html
<footer class="site-footer">
  <div class="container site-footer__inner">
    <div>
      <a class="brand" href="/"><img src="../img/logo-white.svg" alt="" …><span class="brand__name">…</span></a>
      <p><strong>古民家ゲストハウス 汐見の家</strong><br>〒794-2520 …</p>
      <p class="site-footer__note">長く空き家だったため、…</p>
    </div>
    <nav aria-label="フッターメニュー"><ul>…</ul></nav>
    <p class="site-footer__copy">© 汐見の家合同会社</p>
  </div>
</footer>
```

### `.reserve-float`

`<a class="reserve-float" href="/reserve/">ご予約</a>` を `<body>` 直下に置くと、**スクロールしてヒーローを過ぎたら右下に現れる**夜色のボタン。スクロール連動アニメーション（`animation-timeline: scroll()`）に対応したブラウザだけで出る。非対応と reduced-motion では出ない（予約導線は他に3つある）。**下層ページにも置いてよい**が、ヒーローの無いページでは 70vh スクロールしないと出ないので、短いページでは意味が薄い。

---

## 7. ヒーロー `.hero`

画面いっぱい（`min-height: 100svh`）の写真の上に、左下寄せで h1・リード・ボタン。写真の左下から右上へ暗くする勾配が `::after` で乗る。

```html
<section class="hero" aria-labelledby="hero-h">
  <figure class="hero__media">
    <img src="…-1200.jpg" srcset="… 480w, … 800w, … 1200w, … 1800w" sizes="100vw" alt="…" width="1800" height="1350" fetchpriority="high">
  </figure>
  <div class="container hero__body">
    <h1 class="hero__title" id="hero-h"><span>小さな島、</span><span>大きな旅。</span></h1>
    <p class="hero__lead">…</p>
    <p class="hero__actions">
      <a class="button button--light button--primary button--large" href="/reserve/">空室を確認して予約する</a>
      <a class="button button--light button--large" href="/about/">汐見の家について</a>
    </p>
  </div>
  <span class="hero__hint" aria-hidden="true"></span>
</section>
```

- `.hero__title` の `<span>` は行を分けるためだけ（`display: block`）。文言は変えていない
- `.hero__lead` の `<br>` は PC でだけ効く。スマホでは消える
- `.hero__hint` は右下の細い線（下へ促す飾り、文字なし）。スマホでは出ない
- 写真の位置は `object-position: 42% 62%`。**夜の外観専用の値**なので、別の写真にするときは調整する
- 下層ページで使うなら、写真は**暗いもの**に限る（白い文字を乗せるため）。明るい写真しか無いページは `.page-head` を使う

---

## 8. 部品

### ボタン `.button`

| クラス | 見た目 |
|---|---|
| `.button` | 青い枠の丸いボタン（二番手） |
| `.button.button--primary` | 青く塗る（一番してほしい行動。1画面に1つ） |
| `.button.button--light` | 白い枠（写真・夜の上で） |
| `.button.button--light.button--primary` | 紙色で塗る（写真の上の一番手） |
| `.button.button--ink` | 墨で塗る（朝の海の上など、明るい写真の上で） |
| `.button--large` | 一段大きく |
| `.button-row` | ボタンを横に並べる行。スマホでは縦に積んで横いっぱい |

### `.more-link`

「〜を見る ——」の1行リンク。矢印の代わりに細い線。マウスで線が伸びる。

```html
<a class="more-link" href="/rooms/">部屋と設備を詳しく見る</a>
```

### `.figure` / `.figure--small`

数字を明朝で大きく。料金、定員、時刻。単位は普通の文字で続ける。

```html
<span class="figure">5,500</span><span class="price__unit">円</span>
1泊 <span class="figure figure--small">30,000</span>円
```

### `.photo`

写真の枡。はみ出しを切り、マウスでわずかに寄る。比率は `.photo--3x2` `.photo--4x3` `.photo--2x3` `.photo--wide`（21:9）。中の `<img>` は `object-fit: cover`。

```html
<figure class="photo photo--3x2">
  <img src="…-1200.jpg" srcset="…" sizes="…" alt="…" width="1200" height="800" loading="lazy">
</figure>
```

### `.numbered` / `.numbered__n`

漢数字の番号。親に `.numbered`、番号を出す場所に `<span class="numbered__n" aria-hidden="true"></span>`。CSS カウンタで 一、二、三… が入る。**文言ではない**ので読み上げからは外す。

### `.nowrap`

途中で折り返してほしくない語句に。`<span class="nowrap">チェックアウト 10:00</span>`

### `.note` / `.note--important`

囲み。`.note` は補足（薄い茶）、`--important` は必ず読んでほしいこと（淡い青、左に青い線）。

### `.def-list`

項目名＋説明を縦に並べる `<dl>`。ハウスルール、設備一覧。

### `.log-list`

日付・媒体名・一言の行。メディア掲載。

```html
<ul class="log-list">
  <li><time>2018年4月</time><span class="eyebrow">愛媛新聞</span><span>見出し</span></li>
</ul>
```

### `.timeline`

時系列の記録。左に墨の縦線と青い点、年を明朝で。

```html
<ol class="timeline">
  <li><time>2012年</time><h3>はじまり</h3><p>…</p></li>
</ol>
```

### 表・埋め込み・フォーム

- `<table>` は素のまま整う。スマホで幅が足りない表は `<div class="table-scroll">` で包む（表だけ横に動く）
- `.embed` は地図や空室カレンダーの `<iframe>` を包む。縦長は `.embed--tall`
- フォームは `<label>` `<input>` `<select>` `<textarea>` 素のまま。1項目を `<div class="form-row">`、短い入力は `.form-row--short`、選択肢の並びは `.choice`、人数の入力は `.choice-count`、必須印は `<span class="required">必須</span>`、電話番号を大きく `.tel-large`

---

## 9. トップページの区画

### `.facts-strip` — 宿のあらまし

罫で区切った項目の帯。**最初の項目（料金）だけ数字を大きく**、PC では左の広い列に2行分の高さで置く。PC は 4列、タブレットは 2列、スマホは 1列。

```html
<dl class="facts-strip">
  <div><dt>宿泊料</dt><dd><strong class="price"><span class="price__label">素泊り 1泊</span> <span class="figure">5,500</span><span class="price__unit">円</span></strong><small>小学生は半額、乳幼児1人まで無料</small></dd></div>
  <div><dt>一棟貸し</dt><dd>1泊 <span class="figure figure--small">30,000</span>円</dd></div>
  <div><dt>定員</dt><dd><span class="figure figure--small">7</span>名<small>これを超える場合や長期滞在はご相談ください</small></dd></div>
  <div><dt>チェックイン</dt><dd><span class="figure figure--small">15:00</span> / <span class="nowrap">チェックアウト 10:00</span></dd></div>
  <div><dt>所在地</dt><dd>…</dd></div>
  <div><dt>お問い合わせ</dt><dd><a href="tel:…">…</a><br><a href="mailto:…">…</a></dd></div>
</dl>
```

`<small>` は補足を1行下に落とす。6項目で組んであるが、4〜6項目なら崩れない。下層（料金表など）で使うときは 5番目・6番目の列指定が効くので、項目数が違えば `nth-child` の指定を見直す。

### `.collage` — よその宿には、たぶん無いもの

2列で、**右の列を半段（4〜10rem）ずらして**並べる。写真の比率は揃えない（縦長・横長を混ぜる）。

```html
<ol class="collage numbered">
  <li class="collage__item">
    <figure class="photo photo--2x3"><img …></figure>
    <div class="collage__body">
      <span class="numbered__n" aria-hidden="true"></span>
      <h3>五右衛門風呂</h3>
      <p>…</p>
    </div>
  </li>
  …
</ol>
```

`.side-layout__body` を兼ねられる（`class="side-layout__body collage numbered"`）。項目は偶数個が収まりがよい。「部屋と設備」の設備紹介にそのまま使える。

### `.strip` — 部屋

**画面の端から端まで**、写真を横に並べる。幅は不揃い（5:4:3）、高さは揃える。キャプションは `.strip__caption`。`.band--flush` の中、`.container` の外に置く。

```html
<ul class="strip">
  <li><figure class="photo"><img …></figure><span class="strip__caption">奥の間（6畳）</span></li>
  <li>…</li>
  <li>…</li>
</ul>
```

3枚専用。枚数を変えるなら `grid-template-columns` を書き換える。

### `.overlap` / `.overlap--flip` — シェアごはん・佐島まで

画面の端から伸びる大きな写真（12列グリッドの 8列分）に、文章の板（6列分）が**下から重なる**。`--flip` で左右反転。`.container` の外に直接置く（写真を端まで出すため）。スマホでは写真の下に文章が積まれる。

```html
<div class="overlap">
  <figure class="overlap__media photo"><img …></figure>
  <div class="overlap__panel">
    <h2 id="meals-h">シェアごはん</h2>
    <p>…</p>
    <a class="more-link" href="/meals/">食事について</a>
  </div>
</div>
```

### `.index-list` — 読み物

漢数字つきの大きな目次。1行がまるごとリンク。右端の線がマウスで伸びる。

```html
<ol class="index-list numbered">
  <li><a href="/stories/shiomi/">
    <span class="numbered__n" aria-hidden="true"></span>
    <span class="index-list__title">アメリカ日系一世 ロバート汐見の足跡</span>
    <span class="index-list__desc">この家の縁となった、…</span>
  </a></li>
</ol>
```

読み物の目次ページ（連載7回の一覧など）にそのまま使える。`<ul>` にして `.numbered` を外せば番号なし。

### `.cta-scene` — 泊まりに来ませんか

全面の写真（朝の海）の上に、墨の文字と墨のボタン。左側を紙色で霞ませて文字を読めるようにする（`::after`）。**明るい写真専用**。1ページに1つ、末尾に。

```html
<section class="cta-scene" aria-labelledby="cta-h">
  <figure class="cta-scene__media"><img src="../img/sea-dawn-1200.jpg" … sizes="100vw" loading="lazy"></figure>
  <div class="container cta-scene__body">
    <h2 id="cta-h">泊まりに来ませんか</h2>
    <p>空室の確認とご予約はこちらから。お電話でも承ります。</p>
    <p class="button-row"><a class="button button--ink button--large" href="/reserve/">予約・お問い合わせ</a></p>
  </div>
</section>
```

下層ページも末尾はこれで揃える（写真は `sea-dawn` 固定でよい）。

---

## 10. 下層ページの型と、旧部品との対応

### 型

```html
<header class="site-header">…（logo.svg、aria-current）…</header>

<main>
  <div class="container">
    <div class="page-head">
      <span class="eyebrow">部屋と設備</span>   ← 無くてもよい
      <h1>部屋と設備</h1>
      <p>一言の説明</p>
    </div>
  </div>

  <section class="band">
    <div class="container">
      <div class="side-layout">
        <h2 class="side-layout__title">居室</h2>
        <div class="side-layout__body">
          <div class="prose"><p>本文。</p></div>
          <ul class="strip">…</ul>   ← 端まで出すなら .container の外へ
        </div>
      </div>
    </div>
  </section>

  <section class="cta-scene">…</section>
</main>

<footer class="site-footer">…</footer>
```

- `.page-head`：h1（明朝、40〜80px）と一言。下に墨の罫線。ヒーローの無いページの先頭
- `.prose`：本文の幅を文章向けに絞る。中の h2 には上に短い墨の線が付く
- `.article` + `.article__meta` + `.article-nav`：読み物1本。`<article class="article"><header><h1>…</h1><span class="article__meta">2018年4月</span></header>…</article>`
- `.breadcrumb`：パンくず。`<ol class="breadcrumb"><li><a href="/">ホーム</a></li><li>部屋と設備</li></ol>`
- パスは1階層深いので `../style.css`、`../img/…`

### 旧 → 新

| 旧 | 新 | 備考 |
|---|---|---|
| `.wrap` | `.container` | |
| `.wrap-text` | `.container--text` | |
| `.wrap-wide` | `.container--wide` | |
| `.section` | `.band` | 続くときの詰めは自動 |
| `.section-title`, `main h2` の青い線 | 無し | 縦書きなら `.side-layout__title`、横書きなら `.band__head > h2`。`.prose h2` には墨の線が付く |
| `.section-intro` | `.band__head > p` | |
| `.hero-photo` + `.hero-text` + `.lead` | `.hero` 一式 | 文字は写真の上に |
| `.facts` | `.facts-strip` | 数字は `.figure` で大きく |
| `.facts-list` | `.def-list` | |
| `.feature` / `.feature-list` | `.collage` | 交互配置 → 半段ずらしの2列 |
| `.photo-grid` / `.room-list` | `.strip` | 3枚を端まで |
| `.photo` | `.photo` | 比率の修飾子が付いた。中の img は cover |
| `.media` / `.media-reverse` | `.overlap` / `.overlap--flip` | 写真が端まで出る |
| `.link-list` / `.link-title` / `.link-desc` | `.index-list` / `.index-list__title` / `.index-list__desc` | 番号は `.numbered` + `.numbered__n` |
| `ol.link-list` の漢数字 | `.index-list.numbered` | |
| `.media-list` | `.log-list` | |
| `.notice` / `.notice-important` | `.note` / `.note--important` | |
| `.cta` | `.cta-scene` | 淡い青の帯 → 朝の海の全面写真 |
| `.button-primary` | `.button--primary` | 修飾子はすべて `--` |
| `.more` | `.more-link` | `<p class="more"><a>` → `<a class="more-link">` |
| `.brand-name` / `.brand-sub` | `.brand__name` / `.brand__sub` | |
| `.article-meta` | `.article__meta` | |
| `.form-row-short` | `.form-row--short` | |
| `.embed-tall` | `.embed--tall` | |
| `.footer-info` / `.copyright` | `.site-footer__inner` 直下の `<div>` / `.site-footer__copy` | フッターは夜の地に |
| `.timeline` `.breadcrumb` `.page-head` `.prose` `.article` `.article-nav` `.eyebrow` `.table-scroll` `.embed` `.choice` `.choice-count` `.required` `.tel-large` `.form-row` `.form-note` `.visually-hidden` | 同名 | 見た目は変わる |

---

## 11. 守っていること

- 横スクロールは起きない。`html`/`body` に `overflow-x: clip`、写真は枡の中で `cover`、ずらしは縦方向だけ。320〜1920px を 40px 刻みで機械検査済み
- 本文 17px 以上（PC 18px）。最小の文字は 15.3px
- 静的 HTML と CSS のみ。JavaScript 無し。外部読み込み無し
- スクロール連動の動きは**位置だけ**を動かす。透明度は動かさないので、非対応ブラウザでも、動きを止めた設定でも、文字と写真は最初から見えている
- `prefers-reduced-motion: reduce` で全アニメーション・トランジションが止まる
- 予約への導線は4つ：ヘッダーの「ご予約」、ヒーローの「空室を確認して予約する」、末尾の「予約・お問い合わせ」、浮遊する「ご予約」（対応ブラウザのみ）
- 印刷するとナビ・ボタン・浮遊ボタンが消え、夜の地は白になる

## 12. 確認環境の注意

このリポジトリを組んだコンテナには明朝体が入っていません（IPA ゴシックのみ）。スクリーンショットは明朝がゴシックで出ています。また、コンテナの既定フォントでは縦書きの漢字が重なって描かれるため、撮影時だけ `IPAGothic` を当てています（`style.css` には含めていません）。Mac / Windows の実機では Hiragino / Yu Mincho が縦書きの字送りを持っているので、正しく並びます。
