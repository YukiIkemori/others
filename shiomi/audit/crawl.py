import os, re, csv, json, time, urllib.request, urllib.error, gzip, io, html

SP = "/tmp/claude-0/-home-user-others/a512fc05-6c7f-5691-8e6b-8077cc2dc0b5/scratchpad"
RAW = os.path.join(SP, "raw"); os.makedirs(RAW, exist_ok=True)
UA = "Mozilla/5.0 (compatible; ShiomiAudit/1.0; site renewal inventory)"

# sitemap URLs + pages the handover named that the sitemap may omit
urls = [l.strip() for l in open(os.path.join(SP, "urls.txt")) if l.strip()]
extra = [
 "http://shiomihouse.com/category/blog/",
 "http://shiomihouse.com/category/eventnews/",
 "http://shiomihouse.com/en/category/blog/",
 "http://shiomihouse.com/en/category/eventnews/",
 "http://shiomihouse.com/en/category/access/",
 "http://shiomihouse.com/en/",
 "http://shiomihouse.com/media/",
 "http://shiomihouse.com/nikkeiarticlelist/",
]
seen, order = set(), []
for u in urls + extra:
    if u not in seen:
        seen.add(u); order.append(u)

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept-Encoding": "gzip",
        "Accept": "text/html,application/xhtml+xml"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                data = gzip.decompress(data)
            return r.status, dict(r.headers), data, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), (e.read() or b""), url
    except Exception as e:
        return 0, {}, str(e).encode(), url

def txt(m): return html.unescape(re.sub(r"\s+", " ", m).strip()) if m else ""

def grab(pat, s, g=1, flags=re.I|re.S):
    m = re.search(pat, s, flags)
    return txt(m.group(g)) if m else ""

rows = []
for i, u in enumerate(order, 1):
    st, hdr, body, final = fetch(u)
    s = body.decode("utf-8", "replace")
    slug = re.sub(r"[^A-Za-z0-9]+", "_", u.replace("http://shiomihouse.com", "")).strip("_") or "root"
    open(os.path.join(RAW, slug + ".html"), "w", encoding="utf-8").write(s)

    # strip script/style/nav chrome for a body-text estimate
    core = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", s)
    entry = re.search(r'(?is)<(?:article|div)[^>]*class="[^"]*\b(entry-content|post-content|type-page|type-post)\b[^"]*"[^>]*>(.*?)$', core)
    scope = entry.group(2) if entry else core
    plain = txt(re.sub(r"(?s)<[^>]+>", " ", scope))

    imgs  = re.findall(r'(?i)<img[^>]+src=["\']([^"\']+)', s)
    links = re.findall(r'(?i)<a[^>]+href=["\']([^"\']+)', s)
    internal = [l for l in links if "shiomihouse.com" in l or l.startswith("/")]

    rows.append({
        "url": u,
        "status": st,
        "final_url": final,
        "redirected": "Y" if final.rstrip("/") != u.rstrip("/") else "",
        "title": grab(r"<title[^>]*>(.*?)</title>", s),
        "description": grab(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', s),
        "canonical": grab(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](.*?)["\']', s),
        "h1": grab(r"<h1[^>]*>(.*?)</h1>", s),
        "h2_count": len(re.findall(r"(?i)<h2[^>]*>", s)),
        "body_chars": len(plain),
        "img_count": len(imgs),
        "internal_links": len(internal),
        "has_gcal": "Y" if "calendar.google.com" in s else "",
        "has_form": "Y" if re.search(r"(?i)<form[^>]", s) else "",
        "lang": "en" if "/en/" in u else "ja",
        "numeric_id": "Y" if re.match(r"^http://shiomihouse\.com/(en/)?\d+/?$", u) else "",
        "bytes": len(body),
    })
    print(f"[{i}/{len(order)}] {st} {u}", flush=True)
    time.sleep(0.8)

with open(os.path.join(SP, "inventory.csv"), "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
json.dump(rows, open(os.path.join(SP, "inventory.json"), "w"), ensure_ascii=False, indent=1)
print("DONE", len(rows))
