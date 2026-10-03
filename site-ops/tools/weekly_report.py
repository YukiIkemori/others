#!/usr/bin/env python3
"""Compare the last settled 28 days of Search Console with the prior 28 days, per site.

Usage: weekly_report.py [site ...]   (default: all sites)
Prints a JSON report to stdout: totals, rising/falling pages, CTR-gap pages
(high impressions, low CTR), striking-distance queries (positions 8-20), and GA4 summary.
Search Console data settles ~2-3 days late, so the window ends 3 days ago.
"""
import datetime as dt, json, sys
from googleapi import SITES, gsc_query, ga4_report, token


def window(days, offset):
    end = dt.date.today() - dt.timedelta(days=offset)
    return str(end - dt.timedelta(days=days - 1)), str(end)


def by_key(rows):
    return {r["keys"][0]: r for r in rows} if isinstance(rows, list) else {}


def main(sites):
    gtok = token("https://www.googleapis.com/auth/webmasters.readonly")
    cur, prev = window(28, 3), window(28, 31)
    out = {"current": cur, "previous": prev, "sites": {}}
    for s in sites:
        rep = {}
        pages, ppages = (gsc_query(s, *w, ["page"], 1000, gtok) for w in (cur, prev))
        queries = gsc_query(s, *cur, ["query"], 1000, gtok)
        if not isinstance(pages, list):
            rep["error"] = pages
            out["sites"][s] = rep
            continue
        tot = lambda rows: {"impressions": int(sum(r["impressions"] for r in rows)),
                            "clicks": int(sum(r["clicks"] for r in rows))}
        rep["totals"], rep["totals_prev"] = tot(pages), tot(ppages)
        pp = by_key(ppages)
        delta = [(r["keys"][0], int(r["impressions"] - pp.get(r["keys"][0], {"impressions": 0})["impressions"]))
                 for r in pages]
        rep["rising"] = sorted(delta, key=lambda x: -x[1])[:10]
        rep["falling"] = sorted(delta, key=lambda x: x[1])[:10]
        rep["ctr_gap"] = [(r["keys"][0], int(r["impressions"]), int(r["clicks"]), round(r["position"], 1))
                          for r in sorted(pages, key=lambda r: -r["impressions"])
                          if r["impressions"] >= 20 and r["ctr"] < 0.02][:15]
        rep["striking_distance"] = [(r["keys"][0], int(r["impressions"]), round(r["position"], 1))
                                    for r in sorted(queries, key=lambda r: -r["impressions"])
                                    if 8 <= r["position"] <= 20 and r["impressions"] >= 3][:20]
        try:
            g = ga4_report(s, {"dateRanges": [{"startDate": "28daysAgo", "endDate": "today"}],
                               "dimensions": [{"name": "eventName"}], "metrics": [{"name": "eventCount"}]})
            rep["ga4_events"] = {r["dimensionValues"][0]["value"]: int(r["metricValues"][0]["value"])
                                 for r in g.get("rows", [])}
        except KeyError:
            rep["ga4_events"] = "no property id"
        out["sites"][s] = rep
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:] or list(SITES))
