#!/usr/bin/env python3
"""書き出したサイトを点検する。

- リンク切れ（サイト内）
- アンカー（#…）の飛び先があるか
- <img> と srcset が指すファイルが実在するか
- 旧サイトの意匠のクラス名が残っていないか
"""
import os, re, sys, glob

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
OLD_CLASSES = ["wrap", "wrap-text", "section", "link-list", "article-meta", "media-list",
               "brand-name", "button-primary", "facts", "facts-list", "notice-important",
               "breadcrumbs", "page-title", "lead-text", "card-grid"]


def local(url):
    return not re.match(r"^(https?:|mailto:|tel:|#|data:)", url)


def resolve(page, url):
    url = url.split("#")[0].split("?")[0]
    if not url:
        return None
    if url.startswith("/"):
        p = os.path.join(ROOT, url.lstrip("/"))
    else:
        p = os.path.normpath(os.path.join(os.path.dirname(page), url))
    if p.endswith("/") or os.path.isdir(p):
        p = os.path.join(p, "index.html")
    return p


def main():
    pages = sorted(glob.glob(os.path.join(ROOT, "**/*.html"), recursive=True))
    ids = {}
    for p in pages:
        h = open(p, encoding="utf-8").read()
        ids[p] = set(re.findall(r'id="([^"]+)"', h))

    bad_links, bad_anchors, bad_imgs, old_cls = [], [], [], []
    for p in pages:
        rel = os.path.relpath(p, ROOT)
        h = open(p, encoding="utf-8").read()

        for href in re.findall(r'href="([^"]+)"', h):
            if not local(href):
                continue
            if href.endswith((".css", ".ico", ".svg", ".png", ".webmanifest")):
                t = resolve(p, href)
                if t and not os.path.exists(t):
                    bad_links.append((rel, href))
                continue
            t = resolve(p, href)
            if t and not os.path.exists(t):
                bad_links.append((rel, href))
            if "#" in href:
                base, anc = href.split("#", 1)
                tgt = resolve(p, base) if base else p
                if anc and tgt and os.path.exists(tgt) and anc not in ids.get(tgt, set()):
                    bad_anchors.append((rel, href))

        for m in re.finditer(r'<img[^>]*>', h):
            tag = m.group(0)
            srcs = re.findall(r'src="([^"]+)"', tag)
            for ss in re.findall(r'srcset="([^"]+)"', tag):
                srcs += [x.strip().split(" ")[0] for x in ss.split(",")]
            for s in srcs:
                if not local(s):
                    continue
                t = resolve(p, s)
                if t and not os.path.exists(t):
                    bad_imgs.append((rel, s))

        used = set()
        for attr in re.findall(r'class="([^"]*)"', h):
            used |= set(attr.split())
        for c in OLD_CLASSES:
            if c in used:
                old_cls.append((rel, c))

    print(f"ページ {len(pages)} / リンク切れ {len(bad_links)} / アンカー切れ {len(bad_anchors)} "
          f"/ 画像欠落 {len(bad_imgs)} / 旧クラス {len(set(x[0] for x in old_cls))}ページ")
    for name, rows in [("リンク切れ", bad_links), ("アンカー切れ", bad_anchors),
                       ("画像欠落", bad_imgs), ("旧クラス", old_cls)]:
        for r in sorted(set(rows))[:20]:
            print(f"   [{name}] {r[0]} → {r[1]}")
    return 1 if (bad_links or bad_anchors or bad_imgs) else 0


if __name__ == "__main__":
    sys.exit(main())
