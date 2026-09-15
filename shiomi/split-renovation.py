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
    navhtml = ('\n  <div class="container"><nav class="article-nav" aria-label="記録の移動">'
               + "".join(nav) + "</nav></div>\n")
    d = f'<p class="article__meta"><time>{a["date"]}</time>　西村 暢子</p>' if a["date"] else '<p class="article__meta">西村 暢子</p>'
    side = bp.reading_nav("目次", ("/stories/renovation/", SERIES),
                          [(f"/stories/renovation/{p2}/", ms.esc(t2)) for _, p2, t2 in ITEMS],
                          f"/stories/renovation/{ps}/")
    return [
        bp.head(f"{title}｜{SERIES}｜汐見の家", desc, canon, up),
        bp.header("/stories/", up),
        f'''
  <div class="container">
    <ol class="breadcrumb">
      <li><a href="/">ホーム</a></li>
      <li><a href="/stories/">読み物</a></li>
      <li><a href="/stories/renovation/">{ms.esc(SERIES)}</a></li>
      <li>{ms.esc(title)}</li>
    </ol>
  </div>

  <article class="band">
    <div class="container">
{bp.reading(side, f"""      <div class="article">
        <header>
          <p class="eyebrow">{ms.esc(SERIES)}</p>
          <h1>{ms.esc(title)}</h1>
          {d}
        </header>
{ms.render_blocks(a["blocks"], up)}
      </div>""")}
    </div>
  </article>
{navhtml}''',
        bp.cta("この家に泊まってみませんか。", up),
        bp.footer(up),
    ]


def index_page():
    up = "../../"
    links = []
    for slug, ps, title in ITEMS:
        a = ms.ART[slug]
        lead = next((b["text"] for b in a["blocks"] if b["type"] == "p"), "")[:76]
        when = f'{a["date"]}　' if a["date"] else ""
        links.append(f'        <li><a href="/stories/renovation/{ps}/">'
                     f'<span class="index-list__title">{ms.esc(title)}</span>'
                     f'<span class="index-list__desc">{ms.esc(when)}{ms.esc(lead)}…</span></a></li>')
    intro = ms.render_blocks(ms.ART["renovation"]["blocks"], up)
    return [
        bp.head(f"{SERIES}｜汐見の家",
                "空き家だった古民家を2012年から作り直した記録。井戸、五右衛門風呂、壁塗りワークショップ、長屋門の屋根、コンポストバイオトイレまで全15回。",
                "/stories/renovation/", up),
        bp.header("/stories/", up),
        f'''
  <div class="container">
    <ol class="breadcrumb"><li><a href="/">ホーム</a></li><li><a href="/stories/">読み物</a></li></ol>
    <div class="page-head">
      <h1>{ms.esc(SERIES)}</h1>
      <p>2012年の「はじまり」から、井戸、五右衛門風呂、壁塗り、第二期改修まで。</p>
    </div>
  </div>

  <section class="band">
    <div class="container">
{bp.side("この記録について", f"""        <div class="prose">
{intro}
        </div>""")}
    </div>
  </section>

  <section class="band">
    <div class="container">
      <h2>目次</h2>
      <ol class="index-list numbered">
{chr(10).join(links)}
      </ol>
    </div>
  </section>
''',
        bp.cta("この家に泊まってみませんか。", up),
        bp.footer(up),
    ]


if __name__ == "__main__":
    old = os.path.join(bp.ROOT, "stories/renovation/index.html")
    if os.path.exists(old):
        os.remove(old)
    for i, (slug, ps, title) in enumerate(ITEMS):
        bp.write(f"stories/renovation/{ps}/index.html", page(i, slug, ps, title))
    bp.write("stories/renovation/index.html", index_page())
