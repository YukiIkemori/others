#!/usr/bin/env python3
"""構造化データ（JSON-LD）とサイトマップ、robots.txt を入れる。

- トップ: LodgingBusiness（宿そのものの情報）
- 下層ページ: BreadcrumbList
- 読み物の各記事: Article
すでに入っているページは触らない（何度実行しても増えない）。
"""
import os, re, json, glob, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
SITE = "https://shiomihouse.com"

LODGING = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": f"{SITE}/#lodging",
    "name": "古民家ゲストハウス 汐見の家",
    "alternateName": "Shiomi House",
    "description": "しまなみ海道の東、愛媛県上島町佐島にある古民家ゲストハウス。大正期に渡米した日系一世ロバート汐見ゆかりの家を改装しました。薪で焚く五右衛門風呂と手押しポンプの井戸があります。",
    "url": f"{SITE}/",
    "telephone": "+81-897-72-9800",
    "email": "shiomihouse@gmail.com",
    "address": {
        "@type": "PostalAddress",
        "streetAddress": "弓削佐島299",
        "addressLocality": "越智郡上島町",
        "addressRegion": "愛媛県",
        "postalCode": "794-2520",
        "addressCountry": "JP",
    },
    "image": [f"{SITE}/img/exterior-night-1800.jpg", f"{SITE}/img/goemon-bath-1800.jpg"],
    "priceRange": "¥5,500〜",
    "currenciesAccepted": "JPY",
    "checkinTime": "15:00",
    "checkoutTime": "10:00",
    "numberOfRooms": {"@type": "QuantitativeValue", "value": 3},
    "maximumAttendeeCapacity": 7,
    "amenityFeature": [
        {"@type": "LocationFeatureSpecification", "name": "五右衛門風呂（前日までの要相談）", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "井戸（手押しポンプ）", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "簡易イスラム礼拝室", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "ピアノ", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "掘りごたつ", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "無料Wi-Fi", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "共用キッチン", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "洗濯乾燥機（洗濯・乾燥 各100円）", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "貸自転車（ママチャリ1台）", "value": True},
        {"@type": "LocationFeatureSpecification", "name": "駐車場（佐島港のそば）", "value": True},
    ],
    "makesOffer": [
        {"@type": "Offer", "name": "素泊り", "price": "5500", "priceCurrency": "JPY",
         "description": "1泊1名。小学生は半額、乳幼児1人まで無料。"},
        {"@type": "Offer", "name": "一棟貸し", "price": "30000", "priceCurrency": "JPY",
         "description": "1泊。"},
        {"@type": "Offer", "name": "シェアごはん（夕飯）", "price": "1600", "priceCurrency": "JPY"},
        {"@type": "Offer", "name": "シェアごはん（朝飯）", "price": "700", "priceCurrency": "JPY"},
    ],
    "sameAs": [
        "https://www.instagram.com/hostel_shiomihouse/",
        "https://www.facebook.com/shiominoie",
    ],
}

# ページの階層（パンくず用）
BREADCRUMB = {
    "about/index.html":   [("汐見の家について", "/about/")],
    "rooms/index.html":   [("部屋と設備", "/rooms/")],
    "meals/index.html":   [("食事", "/meals/")],
    "access/index.html":  [("アクセス", "/access/")],
    "cycling/index.html": [("ゆめしま海道と自転車", "/cycling/")],
    "school/index.html":  [("学校にご用の方へ", "/school/")],
    "faq/index.html":     [("よくあるご質問", "/faq/")],
    "reserve/index.html": [("ご予約・お問い合わせ", "/reserve/")],
    "media/index.html":   [("メディア掲載", "/media/")],
    "thanks/index.html":  [("Special Thanks", "/thanks/")],
    "stories/index.html": [("読み物", "/stories/")],
    "stories/shiomi/index.html":     [("読み物", "/stories/"), ("アメリカ日系一世 ロバート汐見の足跡", "/stories/shiomi/")],
    "stories/renovation/index.html": [("読み物", "/stories/"), ("古民家再生の記録", "/stories/renovation/")],
    "stories/island/index.html":     [("読み物", "/stories/"), ("島の暮らし", "/stories/island/")],
}


def jsonld(obj):
    return ('<script type="application/ld+json">\n'
            + json.dumps(obj, ensure_ascii=False, indent=1)
            + "\n</script>\n")


def breadcrumb(items):
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [{"@type": "ListItem", "position": 1, "name": "ホーム", "item": f"{SITE}/"}] + [
            {"@type": "ListItem", "position": i + 2, "name": n, "item": f"{SITE}{u}"}
            for i, (n, u) in enumerate(items)
        ],
    }


def page_meta(path):
    s = open(path, encoding="utf-8").read()
    t = re.search(r"<title>(.*?)</title>", s, re.S)
    c = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    return s, (t.group(1) if t else ""), (c.group(1) if c else "")


def inject(path, blocks):
    """構造化データを入れ直す。

    前に入れた分はいったん外してから入れる。そうしないと、
    このファイルの中身を直しても、書き出し済みのページに反映されない。
    """
    s = open(path, encoding="utf-8").read()
    s = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', "", s, flags=re.S)
    s = s.replace("</head>", "".join(blocks) + "</head>", 1)
    open(path, "w", encoding="utf-8").write(s)
    return True


def main():
    os.chdir(ROOT)
    pages = sorted(glob.glob("**/*.html", recursive=True))
    done = 0

    for f in pages:
        s, title, canon = page_meta(f)
        blocks = []

        if 'name="robots" content="noindex"' in s:
            continue

        if f == "index.html":
            blocks.append(jsonld(LODGING))
            blocks.append(jsonld({
                "@context": "https://schema.org", "@type": "WebSite",
                "name": "古民家ゲストハウス 汐見の家", "url": f"{SITE}/",
                "inLanguage": "ja",
                "publisher": {"@id": f"{SITE}/#lodging"},
            }))
        elif f == "404.html":
            continue
        else:
            # 読み物の記事
            m = re.match(r"stories/(shiomi|renovation)/([^/]+)/index\.html$", f)
            if m:
                series = ("アメリカ日系一世 ロバート汐見の足跡", "/stories/shiomi/") if m.group(1) == "shiomi" \
                         else ("古民家再生の記録", "/stories/renovation/")
                h1 = re.search(r"<h1>(.*?)</h1>", s, re.S)
                eb = re.search(r'<p class="eyebrow">(.*?)</p>', s, re.S)
                tm = re.search(r"<time>(\d{4})年(\d{1,2})月</time>", s)
                img = re.search(r'<figure class="photo">\s*<img src="\.\./\.\./\.\./(img/stories/[^"]+)"', s)
                desc = re.search(r'<meta name="description" content="([^"]*)"', s)
                art = {
                    "@context": "https://schema.org", "@type": "Article",
                    "headline": re.sub(r"<[^>]+>", "", h1.group(1)).strip() if h1 else title,
                    "description": desc.group(1) if desc else "",
                    "author": {"@type": "Person", "name": "西村 暢子"},
                    "publisher": {"@id": f"{SITE}/#lodging"},
                    "inLanguage": "ja",
                    "mainEntityOfPage": canon,
                    "isPartOf": {"@type": "CreativeWorkSeries",
                                 "name": series[0],
                                 "url": f"{SITE}{series[1]}"},
                }
                if eb:
                    art["articleSection"] = re.sub(r"<[^>]+>", "", eb.group(1)).strip()
                if tm:
                    art["datePublished"] = f"{tm.group(1)}-{int(tm.group(2)):02d}"
                if img:
                    art["image"] = f"{SITE}/{img.group(1)}"
                blocks.append(jsonld(art))
                blocks.append(jsonld(breadcrumb([
                    ("読み物", "/stories/"),
                    (series[0], series[1]),
                    (art["headline"], canon.replace(SITE, "")),
                ])))
            elif f in BREADCRUMB:
                blocks.append(jsonld(breadcrumb(BREADCRUMB[f])))

            # よくあるご質問は FAQPage にする。検索結果やAIの回答に引かれやすくなる
            if f == "faq/index.html":
                qa = re.findall(r'<div class="faq__item">\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>', s, re.S)
                blocks.append(jsonld({
                    "@context": "https://schema.org", "@type": "FAQPage",
                    "mainEntity": [
                        {"@type": "Question",
                         "name": re.sub(r"<[^>]+>", "", q).strip(),
                         "acceptedAnswer": {"@type": "Answer",
                                            "text": re.sub(r"<[^>]+>", "", a).strip()}}
                        for q, a in qa
                    ],
                }))

        if blocks and inject(f, blocks):
            done += 1

    print(f"構造化データを入れたページ: {done}")

    # sitemap.xml
    today = datetime.date.today().isoformat()
    prio = {"index.html": "1.0", "reserve/index.html": "0.9", "rooms/index.html": "0.8",
            "about/index.html": "0.8", "access/index.html": "0.8", "cycling/index.html": "0.8",
            "faq/index.html": "0.8", "meals/index.html": "0.7", "school/index.html": "0.7"}
    rows = []
    for f in pages:
        if f == "404.html":
            continue
        body, _, canon = page_meta(f)
        if not canon or 'name="robots" content="noindex"' in body:
            continue
        rows.append(f"  <url>\n    <loc>{canon}</loc>\n    <lastmod>{today}</lastmod>\n"
                    f"    <priority>{prio.get(f, '0.6')}</priority>\n  </url>")
    sm = ('<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "\n".join(rows) + "\n</urlset>\n")
    open("sitemap.xml", "w", encoding="utf-8").write(sm)
    print(f"sitemap.xml: {len(rows)} URL")

    open("robots.txt", "w", encoding="utf-8").write(
        f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")
    print("robots.txt 書き出し")


if __name__ == "__main__":
    main()
