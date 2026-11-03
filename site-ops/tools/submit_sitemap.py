"""Resubmit a site's sitemap to Search Console so Google re-reads it (and the
lastmod dates in it) after a publish. Needs the service account to have Full
permission on the property (granted for sukinobi and okurinochizu on 2026-11-03).

Usage: python3 site-ops/tools/submit_sitemap.py sukinobi okurinochizu
"""
import sys, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import googleapi as g

SITEMAPS = {"sukinobi": "https://sukinobi.jp/sitemap.xml", "okurinochizu": "https://okurinochizu.jp/sitemap.xml"}


def submit(site):
    prop = urllib.parse.quote(g.SITES[site], safe="")
    feed = urllib.parse.quote(SITEMAPS[site], safe="")
    url = f"https://www.googleapis.com/webmasters/v3/sites/{prop}/sitemaps/{feed}"
    tok = g.token("https://www.googleapis.com/auth/webmasters")
    urllib.request.urlopen(urllib.request.Request(url, method="PUT", headers={"Authorization": "Bearer " + tok}), timeout=60)
    info = g.call(url, g.token("https://www.googleapis.com/auth/webmasters.readonly"))
    print(f"{site}: submitted {info.get('lastSubmitted')} (last read by Google {info.get('lastDownloaded')})")


if __name__ == "__main__":
    for s in sys.argv[1:] or list(SITEMAPS):
        submit(s)
