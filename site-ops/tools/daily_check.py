"""Daily health check: HTTP status of top/sitemap/robots and sampled sitemap URLs,
Search Console daily totals, and 404/5xx sweep of pages with impressions.

Usage: python3 site-ops/tools/daily_check.py [site ...]   (default: active sites)
"""
import datetime as dt, random, re, sys, urllib.error, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import googleapi as g

ACTIVE = {"sukinobi": "sukinobi.jp", "okurinochizu": "okurinochizu.jp"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def status(url):
    for _ in range(2):  # one retry: some hosts drop the first connection
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 site-ops"})
            return opener.open(req, timeout=30).status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception as e:
            err = str(e)[:40]
    return err


def fetch(url):
    return urllib.request.urlopen(url, timeout=60).read().decode()


def sitemap_urls(base):
    idx = fetch(base + "/sitemap.xml")
    locs = re.findall(r"<loc>(.*?)</loc>", idx)
    if "<sitemapindex" not in idx:
        return locs
    urls = []
    for loc in locs:
        urls += re.findall(r"<loc>(.*?)</loc>", fetch(loc))
    return urls


def main(sites):
    tok = g.token("https://www.googleapis.com/auth/webmasters.readonly")
    end = dt.date.today() - dt.timedelta(days=2)
    for site in sites:
        base = "https://" + ACTIVE[site]
        bad = [(u, c) for u in (base + "/", base + "/sitemap.xml", base + "/robots.txt") if (c := status(u)) != 200]
        urls = sitemap_urls(base)
        bad += [(u, c) for u in random.sample(urls, min(6, len(urls))) if (c := status(u)) != 200]
        rows = g.gsc_query(site, str(end - dt.timedelta(days=13)), str(end), ["date"], tok=tok)
        daily = {r["keys"][0]: (int(r["impressions"]), int(r["clicks"])) for r in rows}
        pages = g.gsc_query(site, str(end - dt.timedelta(days=13)), str(end), ["page"], row_limit=300, tok=tok)
        broken = []
        for r in pages:
            c = status(r["keys"][0])
            if isinstance(c, str) or c in (404, 410) or c >= 500:
                broken.append((r["keys"][0], c, int(r["impressions"])))
        last7 = sum(v[0] for k, v in daily.items() if k > str(end - dt.timedelta(days=7)))
        print(f"{site}: sitemap={len(urls)} bad={bad} {end}={daily.get(str(end))} last7_imps={last7} broken={broken}")


if __name__ == "__main__":
    main(sys.argv[1:] or list(ACTIVE))
