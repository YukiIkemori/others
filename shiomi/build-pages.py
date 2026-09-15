#!/usr/bin/env python3
"""下層ページの雛形を一度だけ書き出す。

ヘッダーとフッターを手で繰り返すと綴じ間違いが出るので、
最初の1回だけこのスクリプトで揃えて書き出す。
書き出したあとは **HTMLファイルの方が正** になる。
文言を直したいときはHTMLを直接編集すること（このスクリプトは再実行しない）。
"""
import os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")

NAV = [("/about/", "汐見の家について"), ("/rooms/", "部屋と設備"), ("/meals/", "食事"),
       ("/access/", "アクセス"), ("/stories/", "読み物")]
FOOT_NAV = NAV + [("/media/", "メディア掲載"), ("/thanks/", "Special Thanks"), ("/reserve/", "ご予約")]


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


def header(current, up="../"):
    items = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == current else ""
        items.append(f'        <li><a href="{href}"{cur}>{label}</a></li>')
    cur = ' aria-current="page"' if current == "/reserve/" else ""
    items.append(f'        <li class="nav-reserve"><a href="/reserve/"{cur}>ご予約</a></li>')
    nav = "\n".join(items)
    return f'''
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"><img src="{up}img/logo.svg" alt="" width="111" height="132"><span class="brand-name"><span class="brand-sub">古民家ゲストハウス</span>汐見の家</span></a>
    <nav class="site-nav" aria-label="メインメニュー">
      <ul>
{nav}
      </ul>
    </nav>
  </div>
</header>

<main>
'''


def page_head(h1, lead=""):
    p = f"\n      <p>{lead}</p>" if lead else ""
    return f'''
  <div class="wrap">
    <div class="page-head">
      <h1>{h1}</h1>{p}
    </div>
  </div>
'''


def cta(text="空室のご確認とご予約はこちらから。お電話でも承ります。"):
    return f'''
  <section class="section cta">
    <div class="wrap">
      <h2>泊まりに来ませんか</h2>
      <p>{text}</p>
      <p class="button-row"><a class="button button-primary" href="/reserve/">予約・お問い合わせ</a></p>
    </div>
  </section>
'''


def footer():
    items = "\n".join(f'        <li><a href="{h}">{l}</a></li>' for h, l in FOOT_NAV)
    return f'''
</main>

<footer class="site-footer">
  <div class="wrap">
    <div class="footer-info">
      <p><strong>古民家ゲストハウス 汐見の家</strong><br>〒794-2520 愛媛県越智郡上島町弓削佐島299<br>TEL <a href="tel:0897729800">0897-72-9800</a><br><a href="mailto:shiomihouse@gmail.com">shiomihouse@gmail.com</a></p>
      <p>長く空き家だったため、地図に番地が出ないことがあります。その場合は「古民家ゲストハウス汐見の家」で検索してください。</p>
    </div>
    <nav aria-label="フッターメニュー">
      <ul>
{items}
      </ul>
    </nav>
    <p class="copyright">© 汐見の家合同会社</p>
  </div>
</footer>

</body>
</html>
'''


def img(name, alt, w, h, sizes, widths=(480, 800, 1200, 1800), up="../", lazy=True):
    srcset = ", ".join(f"{up}img/{name}-{x}.jpg {x}w" for x in widths)
    lz = ' loading="lazy"' if lazy else ""
    return (f'<img src="{up}img/{name}-{widths[-1]}.jpg"\n'
            f'             srcset="{srcset}"\n'
            f'             sizes="{sizes}"\n'
            f'             alt="{alt}" width="{w}" height="{h}"{lz}>')


def write(path, parts):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if os.path.exists(full):
        print(f"  すでにある（上書きしない）: {path}")
        return
    with open(full, "w", encoding="utf-8") as f:
        f.write("".join(parts))
    print(f"  書き出し: {path}  {os.path.getsize(full)//1024}KB")


if __name__ == "__main__":
    print("このスクリプトは雛形の書き出し専用。既存ファイルは上書きしない。")
