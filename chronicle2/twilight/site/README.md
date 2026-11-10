# twilight/site — 黄昏のフィールド（ブラウザで歩けるデモ）

ドット絵の世界はくっきり、光と霧はなめらかに重ねる、という作りのフィールド画面です。
`index.html` と `game.js` だけで動きます（ビルド不要、外部スクリプトなし、フォントは Google Fonts）。
絵とデータを差し替えるだけで別のマップになります。データの決まりはこの文書のとおりです。

- 世界の 1 単位 = 絵の 1 ドット = 主人公の 1 ドット。画面は 960×540 ドット。
- 裏のキャンバスは 1920×1080（1 ドット = 2×2）。とても大きい画面では 2880×1620、狭い画面や遅い端末では 960×540 に自動で切り替えます。
- 手元で見る: `python3 -m http.server` をこのフォルダで動かして `http://localhost:8000/` を開く。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 画面の枠と UI（題字、月の表示、会話窓、操作の案内）の見た目 |
| `game.js` | 読み込み、移動と当たり、描画、光、霧、粒、UI の動き |
| `map.json` | マップの全データ（下の表） |
| `hero.png` / `hero.json` | 主人公の歩行シート |
| `*_placeholder.*` | 絵ができるまでの仮の素材。`../build/placeholder.py` が作る。本番では `map.json` から外す |

## map.json

書かなかった項目は既定値になります。座標はすべてマップ画像のドット（左上が 0,0）。

| キー | 中身 |
|---|---|
| `title`, `titleEn` | 題字（日本語と欧文の小見出し） |
| `w`, `h` | マップの大きさ。省くと画像の大きさ |
| `image` | マップの絵。空が抜ける所は透明にしておくと、後ろの `layers` が見える |
| `spawn` | `{x, y, dir}` 主人公の出発点（足元）。`dir` は `down/left/right/up/down_left/down_right/up_left/up_right` |
| `walk` | 歩ける所のマスク画像。白 = 歩ける。マップの 1/1, 1/2, 1/4 … の大きさ。省くと全面歩ける |
| `height` | 高さの地図。マップと同じ大きさ（または整数分の 1）の PNG で、各ドットが「自分の接地線から画面上でどれだけ上にあるか」を `h = R + 256×G` で持つ（地面は 0）。足元が `y_f` の人物のドット `(x, y)` は `y + h(x,y) > y_f + heightBias` のとき隠れる。柱・壁・アーチ・木の後ろに自動で回り込める。**不透明の RGB で保存すること**（透明や色管理が入ると数値が変わる）。省くと無効 |
| `heightBias` | 上の式のゆとり（既定 2） |
| `floor` | 段差のあるマップ用（任意）。`height` と同じ詰め方・同じ単位の PNG で、歩ける場所の各ドットが「その地面の持ち上がり量」を持つ（歩けない場所は 0）。指定すると式が `min(y, y_f) + h(x,y) > y_f + floor(足元) + heightBias` になり、`height` は「接地線から」ではなく「基準の高さから」の値として読む（`build/blockout/vox.py` の冒頭に説明）。平らなマップでは不要 |
| `hd` | HD-2D 表示（任意、`hd.js` と three.js を使う）。`{S, A, B, depth, dof, fogTop, fogBottom, raised}`。`S, A, B` は骨組みの投影（`vox.py` の `bake` と同じ値）、`depth` は立体感 0〜3（0 は絵そのまま）、`dof` はぼかし 0〜2、`fogTop`/`fogBottom` は崖が雲海に溶け始める高さと溶けきる高さ、`raised` は絵描きが立っていると見なした物の白黒画像（`check.py` が書く、無くても動く）。`height` と `floor` があるマップ専用。画面右上のボタンか P / B / H キーで切り替え。`?hd=0` で無効 |
| `occluders` | 手で切る前後関係（任意）。`[{poly:[[x,y],…], base:y}]` または `{rect:[x,y,w,h], base}`。足元が `base` より上にいる人物の上に、その形でマップの絵を描き直す。`height` と併用できる |
| `lights` | `[{kind, x, y, gx, gy, r, color, intensity, flicker}]`。`kind` は `lantern`（地面に楕円の光だまり + 光源の光輪、ゆらぐ）/ `window`（丸い光、ほぼゆらがない）/ `moon`（空の月のにじみだけ）。`x,y` は光源、`gx,gy` は光だまりの中心（省くと光源と同じ）。`r` は半径、`intensity` は強さ（既定 1）、`flicker` はゆらぎ（lantern 0.15）。`moon` に `layer:"sky"` を付けると `x,y` はその層の画像内の座標になり、層と一緒に動く |
| `water` | `[{poly:[[x,y],…]}]` 水面。中の絵が 1〜2 ドット横にゆれ、きらめきが出る |
| `triggers` | `[{x, y, r, title, label, text:[…], pan:[dx,dy], action}]`。近づくと頭上に「調べる」（`label` で文言変更）が出て、Z / Enter / Space かタップで会話窓。`text` は **1 要素 = 1 ページ**、改行は `\n`。`pan` は会話中にカメラをずらす量、`action:"mood"` は閉じたとき月を替える |
| `emitters` | `[{kind, x, y, w, h, n}]` 四角い範囲に粒を置く。`leaves`（木の枝の範囲に置く。そこから舞い落ちて地面に残る）/ `fireflies` / `motes`（光の中のほこり）/ `mist`（地をはう霧のかたまり）/ `wisps`（影の月の刻だけ出る青緑の灯。省くと fireflies の範囲に少し出る） |
| `props` | `[{src, x, y, fw, fh, foot:[x,y], frames, ms, shadow}]` 置き物や立っている人。横に並んだコマを `ms` ごとに送る。主人公と同じ並べ替え・隠れ方をする |
| `layers` | 奥と手前の層。`sky`（一番奥）、`far`（遠景、透明あり）、`clouds`（横に流れる雲、透明あり）、`fg`（手前の影絵、世界の上に描く）。値は画像名か `{src, parallax, x, y, drift, alpha, scale, repeatX, anchorX, anchorY}` |
| `hero` | `{sheet, spec, speed, run, radius, shadow, shadowR, light:{r, color, intensity}}` 歩く速さ 150、走る速さ 250（ドット/秒）、当たりの半径 6、足元の影の濃さ、持っているランタンの光 |
| `mood` | 始めの刻。`gold` か `shadow` |
| `moodSeconds` | 刻が替わる時間（既定 2.5 秒） |
| `moods` | `{gold:{…}, shadow:{…}}` 刻ごとの調子（下の表）。書いた項目だけ上書き |
| `post` | `{grain, mistScale}` フィルムの粒の強さ（既定 0.035、0 で切る）と霧全体の倍率 |

### layers の置き方

層の画像の左上は、カメラが (0,0) のとき画面の `(x, y)` に来て、カメラが動くと `parallax` 倍だけ動きます（`[横, 縦]` でも書ける）。
`anchorY:"bottom"` にすると「カメラが一番下のとき、層の下端が画面の下端」に合い、`anchorX:"center"` は横の真ん中合わせです（`x`,`y` はそこからのずれ）。
`drift` は横に流れる速さ（ドット/秒）で、流す層は横につながる絵にします。
必要な大きさの目安: 幅 `960 + (w − 960) × parallax`、高さ `540 + (h − 540) × parallax` 以上。空は透明な所からしか見えないので、見える範囲だけ足りれば十分です。
既定の parallax: sky 0.08、far 0.25、clouds 0.12（drift 4）、fg 1.2。

### moods（刻ごとの調子）

| キー | 意味 | gold | shadow |
|---|---|---|---|
| `name` | 表示名 | 金の月の刻 | 影の月の刻 |
| `ambient` | 世界全体に掛ける色（白 = 絵のまま） | `#efe6f1` | `#5a66ae` |
| `lightGain` | 光だまりが `ambient` の暗さをどれだけ戻すか | 0.5 | 1.05 |
| `lightRadius` | 光の半径の倍率 | 1 | 1.28 |
| `brighten`, `brightenMode` | 光だまりが当たった所を明るく暖かくする強さと合成（`soft-light` / `overlay` / `color-dodge` / `screen`） | 0.5 | 0.78 |
| `glow` | 光源のにじみ | 0.55 | 1 |
| `heroLight` | 主人公のランタン | 0.7 | 1.15 |
| `skyTint`, `moonGlow` | 奥の層に掛ける色、月のにじみ | 白, 1 | `#6f74c2`, 0.8 |
| `mist`, `mistColor` | 霧の濃さと色 | 0.3 | 0.9 |
| `fireflies`, `wisps`, `motes` | 蛍の割合、青緑の灯、ほこり | 0.3 / 0 / 0.8 | 1 / 1 / 0.5 |
| `rays` | 左上からの光の筋 | 0.5 | 0 |
| `grade`, `gradeAlpha`, `gradeMode` | 仕上げの色かぶせ | 橙 0.05 | 青 0.12 |
| `vignette`, `vignetteColor` | 四隅の落とし | 0.42 | 0.62 |
| `sparkle` | 水のきらめきの色 | | |

## hero.json

`{frame:[96,128], foot:[48,120], body:80, ms:160, lantern:[[ [x,y]×4 ]×8]}`
シートは 8 行（下・左・右・上・左下・右下・左上・右上）× 4 列（立ち・左足・通過・右足）。4 行だけなら斜めは左右で代用します。
`body` は体の高さ（頭上の表示とカメラの中心、影の大きさに使う）。`lantern` は各コマでランタンがある位置で、そこから光が出ます（無ければ体の中ほど）。大きさはすべてこのファイルから読みます。

## 描く順番

1. 奥の層（空 → 遠景 → 雲）と月のにじみ　2. マップ　3. 水のゆらぎ　4. 地面の落ち葉、人物と手前の物（奥から順）、舞う葉
5. 光: 半分の解像度で作った光の地図を掛け算し、もう一度明るくする合成を重ねる（ここまでドットの解像度）
6. 光源のにじみ　7. 霧と光の筋　8. 蛍・灯・ほこり　9. 手前の層　10. 色かぶせ、四隅、粒　11. UI（HTML の重ね）

## 操作

矢印 / WASD で移動、Shift で走る、Z / Enter / Space で調べる・会話を送る、M か月の表示のタップで刻を替える。
タッチは画面のドラッグで移動（大きく倒すと走る）、表示のタップで調べる。

## 確認用の URL

- `?x=640&y=1500&dir=up` 出発点、`?mood=shadow` 始めの刻、`?ui=0` UI と開幕の演出なし（撮影用）
- `?debug=1` 歩けない所（赤）、手切りの前後関係、光、調べる範囲、粒の範囲、座標を表示。クリックでその場所のマップ座標をコンソールに出す
- `?q=low` / `?q=high` 裏のキャンバスを 960×540 / 1920×1080 に固定、`?off=mist,rays,grain,light,brighten,glow,fg,vignette,grade,particles` 個別に切る、`?map=other.json` 別のマップ
- `window.__game`: `hero`, `cam`, `mood`, `moodT`, `fps`, `frameMs`, `scale`, `dialog`, `near`, `map`, `setMood(name, instant)`, `toggleMood()`, `teleport(x, y, dir)`, `interact()`, `walkable(x,y)`, `free(x,y)`, `step(n, dt)`
