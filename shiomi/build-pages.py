#!/usr/bin/env python3
"""下層ページの雛形を書き出す（第2版の意匠に対応）。

ヘッダーとフッターを手で繰り返すと綴じ間違いが出るので、ここで揃えて書き出す。
書き出したあとは **HTMLファイルの方が正**。
文言を直したいときは HTML を直接編集すること。
"""
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")

NAV = [("/about/", "汐見の家について"), ("/rooms/", "部屋と設備"), ("/meals/", "食事"),
       ("/access/", "アクセス"), ("/cycling/", "サイクリング"), ("/stories/", "読み物")]
FOOT_NAV = NAV + [("/faq/", "よくあるご質問"), ("/school/", "学校にご用の方へ"),
                  ("/media/", "メディア掲載"), ("/thanks/", "Special Thanks"), ("/reserve/", "ご予約")]


def head(title, desc, canon, up="../"):
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://shiomihouse.com{canon}">
<meta name="theme-color" content="#fbfaf7">
<link rel="stylesheet" href="{up}style.css">
</head>
<body>
'''


def brand(up, white=False):
    logo = "logo-white.svg" if white else "logo.svg"
    return (f'<a class="brand" href="/"><img src="{up}img/{logo}" alt="" width="111" height="132">'
            f'<span class="brand__name"><span class="brand__sub">古民家ゲストハウス</span>汐見の家</span></a>')


def header(current, up="../", brand_html=None):
    """ヘッダー。狭い画面ではメニューを畳んで、ボタンで開く。

    開け閉めは JavaScript ではなく、チェックボックスの状態で行う。
    input は header より前に置くこと（CSS の ~ で参照するため）。
    """
    items = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == current else ""
        items.append(f'          <li><a href="{href}"{cur}>{label}</a></li>')
    nav = "\n".join(items)
    cur = ' aria-current="page"' if current == "/reserve/" else ""
    return f'''
<a class="reserve-float" href="/reserve/">ご予約</a>

<input class="nav-toggle" type="checkbox" id="nav-open">

<header class="site-header">
  <div class="container site-header__inner">
    {brand_html or brand(up)}
    <nav class="site-nav" aria-label="メインメニュー">
      <label class="nav-close" for="nav-open"><span class="visually-hidden">メニューを閉じる</span></label>
      <ul>
{nav}
      </ul>
      <ul class="nav-sub">
        <li><a href="/faq/">よくあるご質問</a></li>
        <li><a href="/school/">学校にご用の方へ</a></li>
        <li><a href="/media/">メディア掲載</a></li>
        <li><a href="/thanks/">Special Thanks</a></li>
      </ul>
      <div class="nav-extra">
        <p class="button-row"><a class="button button--primary button--large" href="/reserve/">予約・お問い合わせ</a></p>
        <p>お電話でも承ります<br><a class="tel-large" href="tel:0897729800">0897-72-9800</a></p>
      </div>
    </nav>
    <a class="nav-reserve" href="/reserve/"{cur}>ご予約</a>
    <label class="nav-button" for="nav-open"><span class="nav-button__bars" aria-hidden="true"></span><span class="visually-hidden">メニューを開く</span></label>
  </div>
</header>

<main>
'''


def page_head(h1, lead="", eyebrow=""):
    eb = f'\n      <span class="eyebrow">{eyebrow}</span>' if eyebrow else ""
    p = f'\n      <p>{lead}</p>' if lead else ""
    return f'''
  <div class="container">
    <div class="page-head">{eb}
      <h1>{h1}</h1>{p}
    </div>
  </div>
'''


def breadcrumb(items):
    """items: [(表示名, URL or None)] — 最後の要素は URL なしにする"""
    lis = ['    <li><a href="/">ホーム</a></li>']
    for name, url in items:
        lis.append(f'    <li><a href="{url}">{name}</a></li>' if url else f'    <li>{name}</li>')
    return '\n  <div class="container">\n    <ol class="breadcrumb">\n' + "\n".join(lis) + '\n    </ol>\n  </div>\n'


def cta(text="空室のご確認とご予約はこちらから。お電話でも承ります。", up="../"):
    return f'''
  <section class="cta-scene" aria-labelledby="cta-h">
    <figure class="cta-scene__media">
      <img src="{up}img/sea-dawn-1800.jpg"
           srcset="{up}img/sea-dawn-480.jpg 480w, {up}img/sea-dawn-800.jpg 800w, {up}img/sea-dawn-1200.jpg 1200w, {up}img/sea-dawn-1800.jpg 1800w"
           sizes="100vw" alt="夜明けの瀬戸内海" width="1800" height="1350" loading="lazy">
    </figure>
    <div class="container cta-scene__body">
      <h2 id="cta-h">泊まりに来ませんか</h2>
      <p>{text}</p>
      <p class="button-row"><a class="button button--ink button--large" href="/reserve/">予約・お問い合わせ</a></p>
    </div>
  </section>
'''


def footer(up="../"):
    items = "\n".join(f'        <li><a href="{h}">{l}</a></li>' for h, l in FOOT_NAV)
    return f'''
</main>

<footer class="site-footer">
  <div class="container site-footer__inner">
    <div>
      {brand(up, white=True)}
      <p><strong>古民家ゲストハウス 汐見の家</strong><br>〒794-2520 愛媛県越智郡上島町弓削佐島299<br>TEL <a class="nowrap" href="tel:0897729800">0897-72-9800</a><br><a class="nowrap" href="mailto:shiomihouse@gmail.com">shiomihouse@gmail.com</a></p>
      <p class="site-footer__note">長く空き家だったため、地図に番地が出ないことがあります。その場合は「古民家ゲストハウス汐見の家」で検索してください。</p>
    </div>
    <nav aria-label="フッターメニュー">
      <ul>
{items}
      </ul>
    </nav>
    <p class="site-footer__copy">© 汐見の家合同会社</p>
  </div>
</footer>

</body>
</html>
'''


def img(name, alt, w, h, sizes, widths=(480, 800, 1200, 1800), up="../", lazy=True, cls=""):
    srcset = ", ".join(f"{up}img/{name}-{x}.jpg {x}w" for x in widths)
    lz = ' loading="lazy"' if lazy else ""
    c = f' class="{cls}"' if cls else ""
    return (f'<img{c} src="{up}img/{name}-{widths[-1]}.jpg"\n'
            f'             srcset="{srcset}"\n'
            f'             sizes="{sizes}"\n'
            f'             alt="{alt}" width="{w}" height="{h}"{lz}>')


def reading(side_html, body_html):
    """PCで左に案内、右に本文の2段組。1段のまま中央に細く置くと両脇が空きすぎる"""
    return f'''      <div class="reading">
        <aside class="reading__side">
{side_html}
        </aside>
        <div class="reading__body">
{body_html}
        </div>
      </div>'''


def reading_nav(label, back, items, current=None):
    """左の案内。items は [(リンク先, 見出し)]。current と一致する項目に印を付ける"""
    lis = []
    for href, text in items:
        cur = ' aria-current="page"' if current and href == current else ""
        lis.append(f'            <li><a href="{href}"{cur}>{text}</a></li>')
    back_html = f'          <a class="reading-nav__back" href="{back[0]}">← {back[1]}</a>\n' if back else ""
    return (f'{back_html}'
            f'          <span class="reading-nav__label">{label}</span>\n'
            f'          <ul class="reading-nav">\n' + "\n".join(lis) + '\n          </ul>')


def side(title, body):
    """PC で左に縦書きの見出し、右に中身。見出しは12字まで"""
    return f'''      <div class="side-layout">
        <h2 class="side-layout__title">{title}</h2>
        <div class="side-layout__body">
{body}
        </div>
      </div>'''


def write(path, parts, force=True):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if os.path.exists(full) and not force:
        print(f"  すでにある（上書きしない）: {path}")
        return
    with open(full, "w", encoding="utf-8") as f:
        f.write("".join(parts))
    print(f"  書き出し: {path}  {os.path.getsize(full)//1024}KB")


if __name__ == "__main__":
    print("このスクリプトは雛形の書き出し用。単体では何もしない。")
