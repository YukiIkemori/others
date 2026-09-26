# STYLE_PROMPT — キャラクターのドット絵の絵柄（画像生成用）

`design/sprite_pipe/tools/gen_sheets.py` が、この文書の「English prompt」の枠の中を、毎回のプロンプトの先頭にそのまま入れる。
日本語の節は人が読むための説明（数値の根拠は `design/build/STYLE_REFERENCE.md` §2）。目標は「現代の高精細な 2D ドットの RPG の戦闘・フィールドの人物」の質感で、
特定の作品の人物・衣装・名前・ロゴは写さない。見本は `hero_sheet_owner.png`（オーナーの基準）と `arun_sheets/`（届いたアルンのシート）。

## 絵柄の要点（日本語）

| 項目 | 決まり |
|---|---|
| 頭身 | **約 2.7 頭身**。頭が大きい（頭の幅 ≒ 裾・袖の一番広い所）、首で細くくびれ、裾が広がる「大きな頭・くびれ・広がる裾」の 3 段の輪郭。背の違いは頭の大きさをほぼ変えず体の長さで出す |
| 大きさ | 戦闘 64 ドット・フィールド 48 ドット・顔 80 ドット角（1 ドット = 8×8 px）。戦闘の人物は横幅 30〜40 ドット（武器を除く） |
| 塊 | 髪・顔・上着・下衣・靴・持ち物の **6〜8 の大きな塊**で読ませる。増えた画素は塊の中の陰影に使い、細かい模様やノイズで埋めない |
| 輪郭 | **1 ドットの暗い色の線**。純黒は使わず、黒に近い暖かい暗色（#1c1410 前後）とその素材の一番暗い色の混ぜ。内側の線は塊の境（髪と顔、上着と帯、手と武器）だけ。夜の背景でも縁が消えない明るさ（輝度 .12〜.22） |
| 光 | **左上前から**の柔らかい光（戦闘は左向きなので顔の側が明るい）。明るい面は上と左、影は右下。**顔のまわりを一番明るく**。服の最明段は肌より暗い。リム光・逆光・発光はゲームが後から足すので描かない |
| 段数 | 肌 3〜4 段、髪 4〜5 段、主役の服 5〜6 段、そのほか 3〜4 段。1 人 45〜55 色。**影は赤・紫へ色相を 10〜20° 回し彩度を上げ、明部は黄へ 8〜15° 回し彩度を下げる**。灰や黒の影にしない |
| ディザ | **使わない**（市松模様の混色なし）。段の境ははっきりした面で、髪の毛束や布の襞の形に沿って切る |
| 髪 | 3〜5 ドット幅の**毛束の塊**。毛束ごとに明→中→暗の 3 段と、上の面に 1〜2 ドットの明るい「つやの帯」。外周は毛先がぎざぎざに飛び出す。前髪は目のすぐ上まで |
| 布・マント | 大きな面で 2〜3 段の襞。先は動きの向きへなびき、端は 1 ドットの尖りで終わる。戦闘では体の後ろ（右側）へ流れる |
| 目 | 2×2〜3 ドット：上に暗いまつげの列、瞳の色、1 ドットの白い点。口は基本描かない |
| 金属 | 冷たい灰の 3〜4 段と 1〜2 ドットの白いハイライト。刃は明るい一本の線＋暗い縁 |
| ポーズ | 待機でも**重心を落とした前傾・足を開いた構え**で、武器の先・布の端に斜めの線を作る。攻撃は体全体をひねって大きく伸び、振りかぶりと振り抜きで体の向きがはっきり変わる。のけぞり・ひざつきは体の縮尺を変えずに形だけ縮める |
| 向き | 戦闘は左向きの 4 分の 3 の斜め横（体が少しこちらを向く）。フィールドは少し見下ろした正面寄り |
| 背景 | 単色のマゼンタ #FF00FF。影・床・文字・枠・エフェクトなし |

## English prompt

<!-- PROMPT:BEGIN -->
STYLE: premium modern 2D pixel-art RPG character sprites (hi-bit, "HD pixel art" JRPG look), hand-placed pixels.
- Proportions: about 2.7 heads tall (big head, slim neck, flaring coat/skirt hem). The head is as wide as the widest part of the clothes. Clear readable silhouette built from 6-8 big shapes (hair, face, torso garment, belt, legs, boots, held item).
- Real pixel art: every art pixel is a crisp square of the same size across the whole image. No anti-aliasing, no blur, no gradients, no soft brushes, no noise or texture, no semi-transparency, no dithering / checkerboard mixing.
- Outline: a 1-pixel dark outline around the whole figure, NOT pure black: a warm near-black (#1c1410-ish) mixed with the darkest shade of each material. Interior lines only between big shapes.
- Lighting: soft key light from the upper left front. Lit planes top/left, shade bottom/right. The face area is the brightest part of the sprite. No rim light, no glow, no backlight, no light effects.
- Colour ramps: skin 3-4 shades, hair 4-5, main garment 5-6, others 3-4; about 45-55 colours per character. Hue-shifted shading: shadows shift 10-20 degrees toward red/purple and get MORE saturated, highlights shift toward yellow and get less saturated. Never grey or black shadows. Rich but earthy, worn, practical colours.
- Hair: chunky locks 3-5 px wide, each lock with light/mid/dark bands plus a 1-2 px glossy highlight band; jagged tips breaking the outline.
- Cloth: big folds in 2-3 shade planes, cloth ends flutter backward and end in 1-px points.
- Eyes: 2x3 px — a dark lash row, iris colour, one white highlight pixel. Usually no mouth.
- Metal: cool grey 3-4 shades with 1-2 bright white highlight pixels; blades are a bright line with a dark edge.
- Poses: dynamic and weighty — low centre of gravity, legs apart, torso leaning into the action, weapon and cloth making strong diagonals; attacks twist the whole body.
- Background: one flat solid magenta #FF00FF everywhere. No floor shadow, no ground, no text, no labels, no numbers, no frames, no grid lines, no effects (no slash trails, sparkles, magic light).
<!-- PROMPT:END -->
