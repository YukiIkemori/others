#!/usr/bin/env python3
"""読み物・メディア掲載・Special Thanks・404 を書き出す。一度きりの生成。"""
import json, os, html, importlib.util, re

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bp", os.path.join(HERE, "build-pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)
ROOT = bp.ROOT

ART = json.load(open(os.path.join(HERE, "content/articles.json")))
IMG = json.load(open(os.path.join(HERE, "content/stories-images.json")))

SERIES_NAME = "アメリカ日系一世 ロバート汐見の足跡"

# slug -> (URL片, 見出し, 連載の肩書き)
SHIOMI = [
    ("166",  "",                   "はじめに",                     SERIES_NAME),
    ("178",  "1-tobei",            "父、佐市の渡米",               SERIES_NAME + "（1）"),
    ("179",  "2-tanshin",          "汐見一、13歳で単身海を渡る",   SERIES_NAME + "（2）"),
    ("193",  "column-inochi",      "ロバートに命を救われた女性の話", SERIES_NAME + "（コラム）"),
    ("203",  "3-seishun",          "ロバート汐見の青春",           SERIES_NAME + "（3）"),
    ("259",  "4-shuyojo",          "日系人強制収容",               SERIES_NAME + "（4）"),
    ("277",  "5-american-dream",   "アメリカン・ドリーム",         SERIES_NAME + "（5）"),
    ("318",  "column-tanaka",      "同郷 田中宇八氏の足跡",        SERIES_NAME + "（コラム）"),
    ("627",  "6-bunkazai",         "社会貢献 — 文化財寄贈",        SERIES_NAME + "（6）"),
    ("1028", "7-ryugakusei",       "社会貢献 — 留学生支援",        SERIES_NAME + "（7）"),
    ("1532", "owarini",            "おわりに",                     SERIES_NAME),
    ("242",  "tasaka-sumigama",    "佐島・田坂伊三郎氏の炭窯をカナダで発見", "日系移民をめぐって"),
    ("1427", "nikkei-canadian",    "戦後の日系カナダ人 — 佐島根岸邸3通の文書", "日系移民をめぐって"),
]

RENOVATION = [
    ("1757", "hajimari",        "はじまり"),
    ("studentpj_1d", "gakusei", "学生による古民家再生プロジェクト"),
    ("1331", "ido",             "井戸のリノベーション"),
    ("1413", "kabenuri",        "壁塗りワークショップ"),
    ("1326", "niwa",            "庭のリノベーション"),
    ("1359", "nagayamon",       "長屋門の屋根と瓦"),
    ("1752", "furudategu",      "古建具の追加購入"),
    ("656",  "goemon-hontai",   "五右衛門風呂（本体編）"),
    ("649",  "goemon-naiso",    "五右衛門風呂（内装編）"),
    ("2302", "naiso",           "内装・仕上げ"),
    ("1749", "itadakimono-1",   "頂きもの① 食器・布団"),
    ("667",  "itadakimono-2",   "頂きもの② 水屋・格子戸"),
    ("1361", "baiotoire",       "コンポストバイオトイレ"),
    ("2348", "dai2ki",          "第二期リノベーション"),
    ("2425", "tanden",          "木炭蓄電器「TANDEN」"),
]

ISLAND = [
    ("715",  "shimashikoku", "佐島の島四国"),
    ("3108", "shimaoya",     "汐見の家、島親やります"),
    ("1897", "komanan",      "小出さんと実録こまなん自動車"),
    ("175",  "kotsu",        "三島のなかの交通手段"),
    ("life_shopping", "kaimono", "お買いもの"),
]

MEDIA = ["1206", "1204", "1130", "920", "1180", "1172", "918", "1174", "1196",
         "1200", "1165", "1185", "1187", "1190", "1194", "1212", "2432", "8060"]


def esc(t):
    return html.escape(t, quote=False)


def render_img(src, alt, up, sizes="(min-width: 62em) 44rem, (min-width: 48em) 90vw, 100vw", cap=""):
    m = IMG.get(src)
    if not m or not m["sizes"]:
        return ""
    big = m["sizes"][0]
    srcset = ", ".join(f"{up}img/stories/{s['file']} {s['w']}w" for s in sorted(m["sizes"], key=lambda x: x["w"]))
    a = esc(alt) if alt else ""
    capline = f'        <figcaption>{esc(cap)}</figcaption>\n' if cap else ""
    return (f'      <figure class="photo photo--natural">\n'
            f'        <img src="{up}img/stories/{big["file"]}"\n'
            f'             srcset="{srcset}"\n'
            f'             sizes="{sizes}"\n'
            f'             alt="{a}" width="{big["w"]}" height="{big["h"]}" loading="lazy">\n'
            f'{capline}'
            f'      </figure>\n')


CAPNUM = re.compile(r"^写真\s*[0-9０-９一二三四五六七八九十]+\s*[．.、:：]?\s*")


def caption_of(text):
    """画像の直前の短い行をキャプションに変える。
    「写真1」のような番号だけの行は本文中の参照を指すだけなので捨てる。"""
    t = CAPNUM.sub("", text).strip()
    t = t.strip("（）()　 ")
    return t


def render_blocks(blocks, up, hlevel=3):
    out, in_ul = [], False
    i = 0
    while i < len(blocks):
        b = blocks[i]
        if b["type"] == "li":
            if not in_ul:
                out.append("      <ul>"); in_ul = True
            out.append(f"        <li>{esc(b['text'])}</li>")
            i += 1; continue
        if in_ul:
            out.append("      </ul>"); in_ul = False

        # 短い行のすぐ後ろが画像なら、その行をキャプションとして使う
        if (b["type"] == "p" and len(b["text"]) <= 34
                and i + 1 < len(blocks) and blocks[i + 1]["type"] == "img"):
            cap = caption_of(b["text"])
            nxt = blocks[i + 1]
            s = render_img(nxt["src"], nxt.get("alt") or cap, up, cap=cap)
            if s:
                out.append(s.rstrip())
                i += 2; continue
            i += 1; continue

        if b["type"] == "p":
            out.append(f"      <p>{esc(b['text'])}</p>")
        elif b["type"] == "h":
            out.append(f"      <h{hlevel}>{esc(b['text'])}</h{hlevel}>")
        elif b["type"] == "img":
            s = render_img(b["src"], b.get("alt", ""), up)
            if s:
                out.append(s.rstrip())
        i += 1
    if in_ul:
        out.append("      </ul>")
    return "\n".join(out)


def article_page(slug, path_slug, title, eyebrow, prev_, next_, up="../../../"):
    a = ART[slug]
    canon = f"/stories/shiomi/{path_slug}/" if path_slug else "/stories/shiomi/"
    first_text = next((b["text"] for b in a["blocks"] if b["type"] == "p"), "")
    desc = esc(first_text[:110].replace('"', ""))
    nav = []
    if prev_:
        nav.append(f'<a href="{prev_[0]}">← {esc(prev_[1])}</a>')
    if next_:
        nav.append(f'<a href="{next_[0]}">{esc(next_[1])} →</a>')
    navhtml = ('\n  <div class="container"><nav class="article-nav" aria-label="連載の移動">'
               + "".join(nav) + "</nav></div>\n") if nav else ""
    body = render_blocks(a["blocks"], up)
    date = f'<p class="article__meta"><time>{a["date"]}</time>　西村 暢子</p>' if a["date"] else '<p class="article__meta">西村 暢子</p>'
    nav_items = [("/stories/shiomi/", "はじめに")] + [
        (f"/stories/shiomi/{p2}/", esc(t2)) for _, p2, t2, _ in SHIOMI if p2]
    here = f"/stories/shiomi/{path_slug}/" if path_slug else "/stories/shiomi/"
    side = bp.reading_nav("目次", ("/stories/shiomi/", esc(SERIES_NAME)), nav_items, here)
    return [
        bp.head(f"{title}｜{SERIES_NAME}｜汐見の家", desc, canon, up),
        bp.header("/stories/", up),
        f'''
  <div class="container">
    <ol class="breadcrumb">
      <li><a href="/">ホーム</a></li>
      <li><a href="/stories/">読み物</a></li>
      <li><a href="/stories/shiomi/">{esc(SERIES_NAME)}</a></li>
      <li>{esc(title)}</li>
    </ol>
  </div>

  <article class="band">
    <div class="container">
{bp.reading(side, f"""      <div class="article">
        <header>
          <p class="eyebrow">{esc(eyebrow)}</p>
          <h1>{esc(title)}</h1>
          {date}
        </header>
{body}
      </div>""")}
    </div>
  </article>
{navhtml}''',
        bp.cta("この家に泊まってみませんか。", up),
        bp.footer(up),
    ]


def build_shiomi():
    links = []
    for i, (slug, ps, title, eyebrow) in enumerate(SHIOMI):
        if not ps:
            continue
        a = ART[slug]
        lead = next((b["text"] for b in a["blocks"] if b["type"] == "p"), "")[:80]
        links.append(f'''        <li><a href="/stories/shiomi/{ps}/"><span class="index-list__title">{esc(title)}</span><span class="index-list__desc">{esc(eyebrow)}　{esc(lead)}…</span></a></li>''')

    # 各記事
    items = [(s, p, t, e) for s, p, t, e in SHIOMI if p]
    for i, (slug, ps, title, eyebrow) in enumerate(items):
        prev_ = (f"/stories/shiomi/{items[i-1][1]}/", items[i-1][2]) if i > 0 else ("/stories/shiomi/", "はじめに")
        next_ = (f"/stories/shiomi/{items[i+1][1]}/", items[i+1][2]) if i + 1 < len(items) else None
        bp.write(f"stories/shiomi/{ps}/index.html", article_page(slug, ps, title, eyebrow, prev_, next_))

    # 目次（はじめに を兼ねる）
    a = ART["166"]
    body = render_blocks(a["blocks"], "../../")
    bp.write("stories/shiomi/index.html", [
        bp.head(f"{SERIES_NAME}｜汐見の家",
                "1904年に汐見の家で生まれ、13歳で単身渡米して医師になった日系一世ロバート汐見の生涯。日系人排斥と強制収容を経て、留学生支援に生涯を捧げた人の記録。全7回とコラム2本。",
                "/stories/shiomi/", "../../"),
        bp.header("/stories/", "../../"),
        f'''
  <div class="container">
    <ol class="breadcrumb"><li><a href="/">ホーム</a></li><li><a href="/stories/">読み物</a></li></ol>
    <div class="page-head">
      <h1>{esc(SERIES_NAME)}</h1>
      <p>この家に生まれ、13歳で海を渡った人の話。</p>
    </div>
  </div>

  <article class="band">
    <div class="container">
{bp.side("はじめに", f"""        <div class="article">
          <p class="article__meta"><time>{a["date"]}</time>　西村 暢子</p>
{body}
        </div>""")}
    </div>
  </article>

  <section class="band">
    <div class="container">
      <h2>目次</h2>
      <ol class="index-list numbered">
{chr(10).join(links)}
      </ol>
    </div>
  </section>
''',
        bp.cta("この家に泊まってみませんか。", "../../"),
        bp.footer("../../"),
    ])


def merged_page(path, canon, title, lead, desc, entries, intro_slug=None, up="../../"):
    body = []
    if intro_slug:
        body.append(f'        <div class="prose">\n{render_blocks(ART[intro_slug]["blocks"], up)}\n        </div>')
    for slug, anc, t in entries:
        a = ART.get(slug)
        if not a:
            continue
        d = f'<p class="article__meta"><time>{a["date"]}</time></p>' if a["date"] else ""
        body.append(f'''        <section class="article" id="{anc}">
          <header><h2>{esc(t)}</h2>{d}</header>
{render_blocks(a["blocks"], up)}
        </section>''')
    side = bp.reading_nav("目次", ("/stories/", "読み物"),
                          [(f"#{anc}", esc(t)) for _, anc, t in entries])
    parts = [f'''
  <section class="band">
    <div class="container">
{bp.reading(side, chr(10).join(body))}
    </div>
  </section>
''']
    return [
        bp.head(title, desc, canon, up),
        bp.header("/stories/", up),
        f'''
  <div class="container">
    <ol class="breadcrumb"><li><a href="/">ホーム</a></li><li><a href="/stories/">読み物</a></li></ol>
    <div class="page-head">
      <h1>{esc(lead[0])}</h1>
      <p>{esc(lead[1])}</p>
    </div>
  </div>
''',
        "".join(parts),
        bp.cta("この家に泊まってみませんか。", up),
        bp.footer(up),
    ]


def build_media():
    rows = []
    for slug in MEDIA:
        a = ART.get(slug)
        if not a:
            continue
        t = a["title"]
        m = re.match(r"^(\d{4})(\d{2})(\d{2})?\s*(.*)$", t)
        when, rest = "", t
        if m:
            when = f"{m.group(1)}年{int(m.group(2))}月"
            rest = m.group(4)
        elif a["date"]:
            when = a["date"]
        rows.append(f'        <li><time>{esc(when)}</time><span>{esc(rest)}</span></li>')
    return [
        bp.head("メディア掲載｜汐見の家",
                "新聞・雑誌・ガイドブックなどで汐見の家をご紹介いただいた記録です。",
                "/media/"),
        bp.header(""),
        bp.page_head("メディア掲載", "新聞・雑誌・ガイドブックなどでご紹介いただきました。"),
        f'''
  <section class="band">
    <div class="container">
      <ul class="log-list">
{chr(10).join(rows)}
      </ul>
    </div>
  </section>
''',
        bp.cta(),
        bp.footer(),
    ]


def build_thanks():
    parts = []
    for slug, t in [("special_thanks", "お世話になった皆さま"), ("harukoseki", "関 晴子さんのこと")]:
        a = ART.get(slug)
        if not a:
            continue
        anc = "seki-haruko" if slug == "harukoseki" else "list"
        body = render_blocks(a["blocks"], "../")
        parts.append(f'''
  <section class="band" id="{anc}">
    <div class="container">
{bp.side(esc(t), f"""        <div class="prose">
{body}
        </div>""")}
    </div>
  </section>
''')
    return [
        bp.head("Special Thanks｜汐見の家",
                "汐見の家の再生を支えてくださった皆さまへ。庭のデザインを手がけた関晴子さんのことも。",
                "/thanks/"),
        bp.header(""),
        bp.page_head("Special Thanks", "この家の再生は、たくさんの方に助けられて進みました。"),
        "".join(parts),
        bp.cta(),
        bp.footer(),
    ]


if __name__ == "__main__":
    build_shiomi()

    bp.write("stories/renovation/index.html", merged_page(
        "stories/renovation/index.html", "/stories/renovation/",
        "古民家再生の記録｜汐見の家",
        ("古民家再生の記録", "2012年の「はじまり」から、井戸、五右衛門風呂、壁塗り、第二期改修まで。"),
        "空き家だった古民家を、2012年から作り直した記録。井戸、五右衛門風呂、壁塗りワークショップ、長屋門の屋根、コンポストバイオトイレまで。",
        RENOVATION, intro_slug="renovation"))

    bp.write("stories/island/index.html", merged_page(
        "stories/island/index.html", "/stories/island/",
        "島の暮らし｜汐見の家",
        ("島の暮らし", "島四国、島親、こまなん自動車。佐島で起きていること。"),
        "佐島の島四国、弓削高校の島留学生を支える島親、島の移動サービス「こまなん自動車」。佐島・弓削島・生名島の交通と買い物の情報も。",
        ISLAND))

    bp.write("stories/index.html", [
        bp.head("読み物｜汐見の家",
                "ロバート汐見の足跡、古民家再生の記録、島の暮らし。汐見の家にまつわる読み物です。",
                "/stories/"),
        bp.header("/stories/"),
        bp.page_head("読み物", "この家と、この島にまつわる話。"),
        '''
  <section class="band">
    <div class="container">
      <ul class="index-list">
        <li><a href="/stories/shiomi/"><span class="index-list__title">アメリカ日系一世 ロバート汐見の足跡</span><span class="index-list__desc">1904年にこの家で生まれ、13歳で単身渡米して医師になった人の生涯。日系人排斥と強制収容を経て、留学生を支え続けました。全7回とコラム2本。</span></a></li>
        <li><a href="/stories/renovation/"><span class="index-list__title">古民家再生の記録</span><span class="index-list__desc">2012年の「はじまり」から、井戸、五右衛門風呂、壁塗りワークショップ、長屋門の屋根、第二期改修まで。</span></a></li>
        <li><a href="/stories/island/"><span class="index-list__title">島の暮らし</span><span class="index-list__desc">島四国、島親、こまなん自動車。佐島・弓削島・生名島の交通と買い物のことも。</span></a></li>
      </ul>
    </div>
  </section>
''',
        bp.cta(),
        bp.footer(),
    ])

    bp.write("media/index.html", build_media())
    bp.write("thanks/index.html", build_thanks())

    bp.write("404.html", [
        bp.head("ページが見つかりません｜汐見の家", "お探しのページは見つかりませんでした。", "/404.html", ""),
        bp.header("", ""),
        bp.page_head("ページが見つかりません",
                     "お探しのページは、移動したか、公開を終えた可能性があります。"),
        '''
  <section class="band">
    <div class="container">
      <ul class="index-list">
        <li><a href="/"><span class="index-list__title">トップページ</span><span class="index-list__desc">汐見の家について、はじめから</span></a></li>
        <li><a href="/reserve/"><span class="index-list__title">ご予約・お問い合わせ</span><span class="index-list__desc">空室の確認とお申し込み</span></a></li>
        <li><a href="/stories/"><span class="index-list__title">読み物</span><span class="index-list__desc">ロバート汐見の足跡、古民家再生の記録、島の暮らし</span></a></li>
      </ul>
      <p>お探しのものが見つからないときは、<a href="tel:0897729800">0897-72-9800</a> までお気軽にどうぞ。</p>
    </div>
  </section>
''',
        bp.footer(""),
    ])
