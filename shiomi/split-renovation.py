#!/usr/bin/env python3
"""古民家再生の記録を、1記事1ページに分ける。

統合1ページだと画像157点・PCで19MBになり重すぎる。
また「井戸のリノベーション」のような題材は単体で検索される。
"""
import os, json, importlib.util, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ms", os.path.join(HERE, "make-stories.py"))
ms = importlib.util.module_from_spec(spec)
# make-stories の __main__ ブロックを走らせないために直接読み込む
src = open(os.path.join(HERE, "make-stories.py"), encoding="utf-8").read()
src = src.split('if __name__ == "__main__":')[0]
exec(compile(src, "make-stories.py", "exec"), ms.__dict__)
bp = ms.bp

SERIES = "古民家再生の記録"
ITEMS = ms.RENOVATION   # [(slug, url片, 見出し)]


def page(i, slug, ps, title):
    a = ms.ART[slug]
    up = "../../../"
    canon = f"/stories/renovation/{ps}/"
    first = next((b["text"] for b in a["blocks"] if b["type"] == "p"), "")
    desc = ms.esc(first[:110].replace('"', ""))
    nav = []
    if i > 0:
        nav.append(f'<a href="/stories/renovation/{ITEMS[i-1][1]}/">← {ms.esc(ITEMS[i-1][2])}</a>')
    else:
        nav.append('<a href="/stories/renovation/">← 古民家再生の記録</a>')
    if i + 1 < len(ITEMS):
        nav.append(f'<a href="/stories/renovation/{ITEMS[i+1][1]}/">{ms.esc(ITEMS[i+1][2])} →</a>')
    navhtml = ('\n  <div class="wrap"><nav class="article-nav" aria-label="記録の移動">'
               + "".join(nav) + "</nav></div>\n")
    d = f'<p class="article-meta"><time>{a["date"]}</time>　西村 暢子</p>' if a["date"] else '<p class="article-meta">西村 暢子</p>'
    return [
        bp.head(f"{title}｜{SERIES}｜汐見の家", desc, canon, up),
        bp.header("/stories/", up),
        f'''
  <div class="wrap">
    <nav class="breadcrumb" aria-label="現在の位置">
      <a href="/stories/">読み物</a> ／ <a href="/stories/renovation/">{ms.esc(SERIES)}</a>
    </nav>
  </div>

  <article class="section">
    <div class="wrap-text article">
      <header>
        <p class="eyebrow">{ms.esc(SERIES)}</p>
        <h1>{ms.esc(title)}</h1>
        {d}
      </header>
{ms.render_blocks(a["blocks"], up)}
    </div>
  </article>
{navhtml}''',
        bp.cta("この家に泊まってみませんか。"),
        bp.footer(),
    ]


def index_page():
    up = "../../"
    links = []
    for slug, ps, title in ITEMS:
        a = ms.ART[slug]
        lead = next((b["text"] for b in a["blocks"] if b["type"] == "p"), "")[:76]
        when = f'{a["date"]}　' if a["date"] else ""
        links.append(f'        <li><a href="/stories/renovation/{ps}/">'
                     f'<span class="link-title">{ms.esc(title)}</span>'
                     f'<span class="link-desc">{ms.esc(when)}{ms.esc(lead)}…</span></a></li>')
    intro = ms.render_blocks(ms.ART["renovation"]["blocks"], up)
    return [
        bp.head(f"{SERIES}｜汐見の家",
                "空き家だった築百年の古民家を2012年から作り直した記録。井戸、五右衛門風呂、壁塗りワークショップ、長屋門の屋根、コンポストバイオトイレまで全15回。",
                "/stories/renovation/", up),
        bp.header("/stories/", up),
        f'''
  <div class="wrap">
    <nav class="breadcrumb" aria-label="現在の位置"><a href="/stories/">読み物</a></nav>
    <div class="page-head">
      <h1>{ms.esc(SERIES)}</h1>
      <p>2012年の「はじまり」から、井戸、五右衛門風呂、壁塗り、第二期改修まで。</p>
    </div>
  </div>

  <section class="section">
    <div class="wrap-text prose">
{intro}
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2>目次</h2>
      <ol class="link-list">
{chr(10).join(links)}
      </ol>
    </div>
  </section>
''',
        bp.cta("この家に泊まってみませんか。"),
        bp.footer(),
    ]


if __name__ == "__main__":
    old = os.path.join(bp.ROOT, "stories/renovation/index.html")
    if os.path.exists(old):
        os.remove(old)
    for i, (slug, ps, title) in enumerate(ITEMS):
        bp.write(f"stories/renovation/{ps}/index.html", page(i, slug, ps, title))
    bp.write("stories/renovation/index.html", index_page())
