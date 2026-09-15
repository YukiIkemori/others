#!/usr/bin/env python3
"""ファビコンとOGPを全ページの <head> に入れる。

title / description / canonical はページ本体から読み取るので、
ページを作り直したあとにこれを流し直せば揃う。何度実行しても増えない。
"""
import os, re, glob

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
SITE = "https://shiomihouse.com"
MARK = "<!-- head-meta -->"
MARK_END = "<!-- /head-meta -->"

ICONS = '''<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">'''


def pick(html, pat):
    m = re.search(pat, html)
    return m.group(1) if m else ""


def build(html, path):
    title = pick(html, r"<title>(.*?)</title>")
    desc = pick(html, r'<meta name="description" content="(.*?)">')
    canon = pick(html, r'<link rel="canonical" href="(.*?)">')
    if not canon:
        canon = SITE + "/" + os.path.relpath(path, ROOT).replace("index.html", "")
    is_article = "/stories/" in canon and canon.rstrip("/") != f"{SITE}/stories"
    ogtype = "article" if is_article else "website"
    return f'''{MARK}
{ICONS}
<meta property="og:type" content="{ogtype}">
<meta property="og:site_name" content="古民家ゲストハウス 汐見の家">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE}/img/ogp.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="畳の間で食卓を囲む人たちのイラスト">
<meta name="twitter:card" content="summary_large_image">
{MARK_END}
'''


def css_version():
    """style.css の中身から短い印を作る。

    ブラウザは style.css を一定時間ためこむので、中身を変えても
    古いままのことがある（HTMLだけ新しくなって表示が崩れる）。
    読み込み先に ?v=… を付けて、変わったら別物として取り直させる。
    """
    import hashlib
    css = os.path.join(ROOT, "style.css")
    return hashlib.sha1(open(css, "rb").read()).hexdigest()[:8]


def main():
    ver = css_version()
    n = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "**/*.html"), recursive=True)):
        html = open(path, encoding="utf-8").read()
        # 既存の差し込み分をいったん外してから入れ直す
        # 前に入れた分だけを外す。ここで </head> までまとめて消すと、
        # あとから入れた構造化データも道連れになる
        html = re.sub(re.escape(MARK) + r".*?" + re.escape(MARK_END) + r"\n?", "", html, flags=re.S)
        html = re.sub(re.escape(MARK) + r".*?(?=</head>)", "", html, flags=re.S)
        # 初回（印のない手書きページ）に残っている分も外す
        html = re.sub(r'<link rel="icon"[^>]*>\n?|<link rel="apple-touch-icon"[^>]*>\n?|'
                      r'<link rel="manifest"[^>]*>\n?|<meta property="og:[^>]*>\n?|'
                      r'<meta name="twitter:[^>]*>\n?', "", html)
        block = build(html, path)
        html = html.replace("</head>", block + "</head>", 1)
        html = re.sub(r'(href="[^"]*style\.css)(\?v=[0-9a-f]+)?"', rf'\1?v={ver}"', html)
        open(path, "w", encoding="utf-8").write(html)
        n += 1
    print(f"head のメタ情報を入れたページ: {n}（style.css の印 v={ver}）")


if __name__ == "__main__":
    main()
