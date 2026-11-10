# twilight — 「絵作りを自由に試す」デモ（鐘のならない修道院・黄昏）

遊べるページ: https://claude.ai/artifact/Dxboo2qWWr9PzAeP2iSCo9

- `site/` ブラウザで歩けるデモ本体。データの決まりは `site/README.md`。
- `build/` 背景とデータの作り方。
  1. `img.py` と `prompts/map.txt` で、マップ全体を 1 枚のドット絵として画像生成（2560×3200、2 分の 1 にして 1280×1600 が本番）。
  2. 同じ絵を「編集」して、空の範囲（`mask_sky`）、歩ける所（`mask_walk`）、立っている物（`mask_raised`）、島を消した空と雲海（`backdrop`）を作る。
  3. `build1.py`（マスクの読み込みと確認用の重ね絵）→ `build2.py`（歩ける所 `walk.png`、物の後ろに回り込むための `height.png`、空を抜いた `map.png`）→ `build3.py`（`map.json` と配布用の画像）。
  4. `publish.py` が公開用の `index.html` を作る。
- `build/hero/` 主人公（3.3 頭身、点の目、黒フチなし、28 色、8 方向）の生成と仕上げ。

元の生成画像と作業ファイルはリポジトリには入れていない（プロジェクトの共有フォルダ `twilight-rpg/` に見本あり）。
