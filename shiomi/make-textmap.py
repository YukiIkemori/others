#!/usr/bin/env python3
"""「この文はどのファイルのどこにあるか」の一覧を作る。

先方が文言を直すときの地図。見出しをたどれば、直したい文が
どのファイルの何行目あたりにあるか分かるようにする。
"""
import os, re, glob, html as H

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deploy", "文言の置き場所.md")

ORDER = ["index.html", "about/index.html", "rooms/index.html", "meals/index.html",
         "access/index.html", "cycling/index.html", "school/index.html",
         "faq/index.html", "reserve/index.html", "stories/index.html",
         "stories/shiomi/index.html", "stories/renovation/index.html",
         "stories/island/index.html", "media/index.html", "thanks/index.html",
         "404.html", "reserve/done/index.html", "reserve/preview/index.html"]


def strip(t):
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", H.unescape(t)).strip()


def scan(path):
    lines = open(path, encoding="utf-8").read().split("\n")
    body = "\n".join(lines)
    title = strip(re.search(r"<title>(.*?)</title>", body, re.S).group(1))
    rows = []
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r"<(h[1-3])[^>]*>(.*?)</\1>", line, re.S):
            txt = strip(m.group(2))
            if txt:
                rows.append((i, m.group(1), txt))
        # 見出しの無いページ（404 など）でも、最初の一文は拾う
    return title, rows


def main():
    out = ["# 文言の置き場所",
           "",
           "直したい文がどのファイルにあるかの一覧です。",
           "見出し（大きい文字）を手がかりに探してください。",
           "行番号はだいたいの目安です。写真の差し替えなどで前後します。",
           "",
           "**サイト全体で使い回している文言**（1か所直すと全ページに影響するもの）は",
           "この一覧の最後にまとめてあります。",
           ""]
    files = [f for f in ORDER if os.path.exists(os.path.join(ROOT, f))]
    files += [os.path.relpath(p, ROOT) for p in sorted(glob.glob(os.path.join(ROOT, "stories/*/*/index.html")))]
    for f in files:
        title, rows = scan(os.path.join(ROOT, f))
        url = "/" + f.replace("index.html", "")
        out.append(f"## {title}")
        out.append("")
        out.append(f"- ページ: `{url}`")
        out.append(f"- ファイル: `{f}`")
        out.append("")
        if rows:
            out.append("| だいたいの行 | 見出し |")
            out.append("|---|---|")
            for ln, tag, txt in rows:
                indent = {"h1": "", "h2": "　", "h3": "　　"}[tag]
                out.append(f"| {ln} | {indent}{txt} |")
            out.append("")

    out += ["## サイト全体で使い回している文言", "",
            "次のものは **全45ページに同じ文が入っています**。",
            "直すときは、45ファイルすべてを一括置換してください。",
            "（テキストエディタの「フォルダ内を検索して置換」を使うと確実です）", "",
            "| 文言 | どこに出るか |",
            "|---|---|",
            "| 古民家ゲストハウス 汐見の家 | ヘッダーのロゴ、フッター |",
            "| 〒794-2520 愛媛県越智郡上島町弓削佐島299 | フッター |",
            "| 0897-72-9800 | ヘッダー、フッター、各所 |",
            "| shiomihouse@gmail.com | フッター |",
            "| 長く空き家だったため、地図に番地が出ないことがあります… | フッター |",
            "| 泊まりに来ませんか | 各ページ下の大きな区画 |",
            "| 空室のご確認とご予約はこちらから。お電話でも承ります。 | 同上（ページにより文が違います） |",
            "| © 汐見の家合同会社 | フッター |",
            "| メニューの並び（汐見の家について／部屋と設備／食事／アクセス／サイクリング／読み物） | ヘッダー、スマホのメニュー |",
            ""]
    open(OUT, "w", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"書き出し: {os.path.relpath(OUT)}  {len(files)}ページ分")


if __name__ == "__main__":
    main()
