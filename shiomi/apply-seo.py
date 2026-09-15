#!/usr/bin/env python3
"""content/seo.json のタイトルと説明文を、書き出したHTMLに当てる。

ページを作り直すと生成スクリプトの文言に戻るので、
作り直したあとは必ずこれを流すこと。
（このあと add-head-meta.py を流すと、OGPにも同じ文言が入る）
"""
import os, re, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "site")
SEO = os.path.join(HERE, "content", "seo.json")


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def main():
    data = json.load(open(SEO, encoding="utf-8"))
    n = miss = 0
    for path, v in data.items():
        if path.startswith("_"):
            continue
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            print(f"  ページが無い: {path}")
            miss += 1
            continue
        s = open(full, encoding="utf-8").read()
        s2 = re.sub(r"<title>.*?</title>", f"<title>{esc(v['title'])}</title>", s, count=1, flags=re.S)
        s2 = re.sub(r'<meta name="description" content=".*?">',
                    f'<meta name="description" content="{esc(v["description"])}">', s2, count=1, flags=re.S)
        if s2 != s:
            open(full, "w", encoding="utf-8").write(s2)
            n += 1
    print(f"タイトルと説明文を当てたページ: {n}" + (f" / 見つからなかった: {miss}" if miss else ""))


if __name__ == "__main__":
    main()
