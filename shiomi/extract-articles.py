#!/usr/bin/env python3
"""旧サイトの記事を、本文と画像の順序を保ったまま取り出す。

出力: content/articles.json
  [{slug, title, date, blocks: [{type: "p"|"img"|"h", ...}]}, ...]
"""
import re, html, json, os

SP = "/tmp/claude-0/-home-user-others/a512fc05-6c7f-5691-8e6b-8077cc2dc0b5/scratchpad"
RAW = os.path.join(SP, "raw")

NAV = {"English", "日本語", "汐見の家について", "EVENT&NEWS", "部屋と施設", "ご予約", "アクセス",
       "古民家再生", "日系移民", "Google translation", "新着記事", "コメントを読み込み中…",
       "コメントをどうぞ", "メール", "名前", "サイト", "© 古民家ゲストハウス | 汐見の家",
       "日系移民記事一覧", "Special Thanks", "読み込み中…", "関連"}
STOP = re.compile(r"(共有:|いいね:|この投稿をシェア|X で共有|Facebook で共有|新着記事)")


def extract(slug):
    path = os.path.join(RAW, slug + ".html")
    if not os.path.exists(path):
        return None
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r'(?is)<div[^>]*class="[^"]*(sharedaddy|sd-sharing|jp-relatedposts)[^"]*".*?$', " ", s)

    m = re.search(r"(?is)<h1[^>]*>(.*?)</h1>(.*)", s)
    title = html.unescape(re.sub(r"(?s)<[^>]+>", "", m.group(1))).strip() if m else ""
    body = m.group(2) if m else s
    body = re.split(r"(?i)<footer|コメントを読み込み", body)[0]

    d = ""
    dm = re.search(r'datetime="(\d{4})-(\d{2})', s)
    if dm:
        d = f"{dm.group(1)}年{int(dm.group(2))}月"

    # 画像を順序つきの印に置き換える
    def mark(mo):
        src = re.search(r'src="([^"]+)"', mo.group(0))
        alt = re.search(r'alt="([^"]*)"', mo.group(0))
        if not src or "/uploads/" not in src.group(1):
            return " "
        a = html.unescape(alt.group(1)).strip() if alt else ""
        return f"\n@@IMG|{src.group(1)}|{a}@@\n"

    body = re.sub(r"(?is)<img[^>]*>", mark, body)
    body = re.sub(r"(?i)<br\s*/?>", "\n", body)
    body = re.sub(r"(?is)<h([2-4])[^>]*>(.*?)</h\1>", lambda x: f"\n@@H|{html.unescape(re.sub(r'<[^>]+>','',x.group(2))).strip()}@@\n", body)
    body = re.sub(r"(?i)<li[^>]*>", "\n@@LI@@", body)
    body = re.sub(r"(?i)</(p|div|li|tr|blockquote)>", "\n\n", body)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", body))
    text = re.sub(r"[ \t　]+", " ", text)

    blocks, seen_img = [], set()
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if STOP.search(line):
            break
        if line.startswith("@@IMG|"):
            parts = line.strip("@").split("|")
            if len(parts) >= 2 and parts[1] not in seen_img:
                seen_img.add(parts[1])
                blocks.append({"type": "img", "src": parts[1], "alt": parts[2] if len(parts) > 2 else ""})
            continue
        if line.startswith("@@H|"):
            t = line.strip("@")[2:].strip()
            if t and t not in NAV:
                blocks.append({"type": "h", "text": t})
            continue
        li = line.startswith("@@LI@@")
        line = line.replace("@@LI@@", "").strip()
        if not line or line in NAV or len(line) <= 2:
            continue
        if blocks and blocks[-1].get("type") in ("p", "li") and blocks[-1].get("text") == line:
            continue
        blocks.append({"type": "li" if li else "p", "text": line})

    return {"slug": slug, "title": title, "date": d, "blocks": blocks,
            "chars": sum(len(b.get("text", "")) for b in blocks),
            "images": sum(1 for b in blocks if b["type"] == "img")}


SLUGS = [
    # ロバート汐見
    "166", "178", "179", "193", "203", "259", "277", "318", "627", "1028", "1532", "242", "1427",
    # 古民家再生
    "renovation", "1757", "studentpj_1d", "1331", "1413", "1326", "1359", "1752",
    "656", "649", "2302", "1749", "667", "1361", "2348", "2425",
    # 島の暮らし
    "715", "3108", "1897", "175", "176",
    # メディア掲載
    "918", "920", "1130", "1165", "1172", "1174", "1180", "1185", "1187", "1190",
    "1194", "1196", "1200", "1204", "1206", "1212", "2432", "8060",
    # Special Thanks
    "special_thanks", "harukoseki",
]

if __name__ == "__main__":
    out = {}
    for sl in SLUGS:
        a = extract(sl)
        if a:
            out[sl] = a
        else:
            print("  取れない:", sl)
    json.dump(out, open("content/articles.json", "w"), ensure_ascii=False, indent=1)
    print(f"{len(out)}本を抽出")
    tot_c = sum(a["chars"] for a in out.values())
    tot_i = sum(a["images"] for a in out.values())
    print(f"本文 {tot_c:,}字 / 画像 {tot_i}点")
    for sl in ["166", "1331", "715"]:
        a = out[sl]
        print(f"\n--- /{sl}/ {a['title']}  {a['date']}  {a['chars']}字 画像{a['images']}点")
        for b in a["blocks"][:6]:
            print("   ", b["type"], (b.get("text") or b.get("src", ""))[:70])
