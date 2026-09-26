# SYSTEMS_REWORK — 熟練度 1〜100・WP 廃止・武器 7 系統（BRIEF A17・A18・A19）の実装仕様

作成 2026-09-26（リード補佐）。対象: BRIEF Part A13 / A13b / A17 / A18 / A19。
この文書は **並列の実装者が互いに重ならないファイルを受け持って** 一度に作り直すための正本。DESIGN.md への反映は、QA の作業が終わった後にリードがまとめて行う（§4.4）。
数値は下の現状の計測（2026-09-26、`tools/sim_glimmer.js` の模型に熟練度の点数の書き出しを足して測定）に合わせてある。調整の余地がある値は「つまみ」と明記した。

---------------------------------------------------------------------------------------------------
## 0. 要約（決定の一覧）

| # | 決定 |
|---|---|
| 0.1 | 熟練度は **点数（`c.wprof[w]` `c.eprof[e]`）を保存し、段階 1〜100 を計算する** 形のまま。段階表 `PROF_PTS` を 100 段にし、段階 0 は無くなる（最低 1）。 |
| 0.2 | 武器の点数の入り方（1 行動 +1、lv6 以上の技 +2）は変えない。術は **×2〜2.5**（術は 1 戦の行動に占める割合が小さいため）。 |
| 0.3 | 伸びの目安: 序章（灯台まで）の主な武器 **段階 5〜8**、本編クリア時 **70〜85**、100 は裏の稼ぎでだけ（「ティアの目安線」を超えると伸び ×0.3）。 |
| 0.4 | 段階の境目（閃きの候補・A13b の MP 軽減・威力の補正）はすべて新しい段階に換算した（§1.4）。威力は `+30% × ((段階−1)/99)^0.75`。 |
| 0.5 | WP を廃止。技も `mp` を持ち、**技の MP = 旧 WP × 1.5（四捨五入、.5 は切り上げ）**。成長の MP の文字 = 旧 MP と旧 WP のうち良い方。上限 MP 250。 |
| 0.6 | WP の効果は MP に置き換え: `wpRegen`→`mpRegen`、`wpCostPct`→**`techCostPct`（技の MP）**、`healWp`・`grow wp`・`wpPct` は削除。`mpCostPct` は「術の MP」のまま。 |
| 0.7 | 武器系統は `sword greatsword dagger axe spear bow staff` の 7 つ。刀→剣、棍棒→斧（**打撃の「メイス・槌」の系列**として残す）、体術・鞭は廃止し品は近い系統へ移す。素手は内部キー `fist`（系統ではない。技・熟練度・品なし）として残す。 |
| 0.8 | 杖は **後列から届く**（`reach:true`）。槍・弓・杖が後列から届く系統。両手持ちは 大剣・槍・弓（系統）と `w_axe_r7`（品）。 |
| 0.9 | 武器 301 → **260**（剣 41・大剣 22・短剣 35・斧 52・槍 34・弓 30・杖 46）。技 121 → **108**（剣 17・大剣 15・短剣 15・斧 16・槍 15・弓 15・杖 15）。 |
| 0.10 | 消える・名前の変わる id は `src/data/remap_a19.js`（新規）の表で古いセーブを直す。データの参照は各担当がその場で新しい id に書き換える（表は **セーブ専用**）。 |

---------------------------------------------------------------------------------------------------
## 1. 熟練度 1〜100（A17）

### 1.1 現状の計測（旧仕様、変更の根拠）
`sim_glimmer` の模型（序章 35 戦、1 地方 95 戦＋ボス 2、1 戦 1 人 3 行動）で測った点数の平均（旧 `PROF_CAP 999` で頭打ち）。

| 時点 | 主人公 剣（主な武器 62%） | 2 つ目の武器（30%） | 弓だけ（92%） | 術師の主属性（0.75 回/戦） | 術師（1.5 回/戦） |
|---|---|---|---|---|---|
| 序章の終わり | 86 | 44 | 114 | 23〜29 | 35 |
| T0 の終わり | 274 | 134 | 397 | 55〜61 | 85 |
| T3 の終わり | 841 | 408 | 999 | 156〜187 | 278 |
| T7 の終わり | （1600 相当） | 801 | 999 | 335〜383 | 552 |
| 本編クリア | （1750 相当） | 882 | 999 | 415〜461 | 652 |

旧 `PROF_PTS=[0,5,15,30,55,90,135,190,260,350,460]` では主な武器が T2 で段階 10 に達する（オーナーの「すぐカンスト」）。

### 1.2 新しい段階表（`R.Rules.K`、担当 RULES）
```js
// 段階 r（1〜100）になる点数。PROF_PTS[0] は使わない（0）。profRank(pts) = PROF_PTS[r] ≤ pts の最大の r（最低 1）
PROF_PTS: [0, ...Array.from({length:100}, (_, i) => Math.round(11 * Math.pow(i, 1.18)))],   // r = i + 1
PROF_CAP: 2490,                      // = PROF_PTS[100]（旧 999）
```
展開した値（r: 点数）— テストはこの表と一致を確かめる:
```
1:0 2:11 3:25 4:40 5:56 6:73 7:91 8:109 9:128 10:147 11:166 12:186 13:206 14:227 15:248 16:269 17:290 18:311 19:333 20:355
21:377 22:400 23:422 24:445 25:468 26:491 27:514 28:538 29:561 30:585 31:609 32:633 33:657 34:681 35:706 36:730 37:755 38:780 39:805 40:830
41:855 42:880 43:905 44:931 45:956 46:982 47:1008 48:1034 49:1060 50:1086 51:1112 52:1138 53:1165 54:1191 55:1218 56:1245 57:1271 58:1298 59:1325 60:1352
61:1379 62:1406 63:1434 64:1461 65:1488 66:1516 67:1543 68:1571 69:1599 70:1626 71:1654 72:1682 73:1710 74:1738 75:1766 76:1795 77:1823 78:1851 79:1880 80:1908
81:1937 82:1965 83:1994 84:2023 85:2051 86:2080 87:2109 88:2138 89:2167 90:2196 91:2225 92:2255 93:2284 94:2313 95:2343 96:2372 97:2401 98:2431 99:2461 100:2490
```

### 1.3 伸び方（`train` / `addProf`、担当 RULES）
```js
PROF_GAIN: { weapon: 1, techHigh: 2, techHighLv: 6,          // 武器は旧のまま
             single12: 2, single35: 5, pair: 5, triple: 7,    // 術: 旧 1 / 2 / 2 / 3（つまみ。§4.3 P3 で合わせる）
             stone: 2 },                                      // 魔石: 旧 1
CATCHUP: 2,
PEXP: [25, 186, 311, 445, 585, 730, 880, 1034, 1191, 1352],  // 追いつきの線（点数）= 段階 [3,12,18,24,30,36,42,48,54,60] の点数。T = R.Tier.effective()
PROF_SOFT: { rank: [20, 28, 36, 44, 52, 60, 67, 74, 80, 90], mul: 0.3 },   // ティアの目安線（段階）。これ以上は伸び ×0.3
START_PROF: { S: 25, A: 11 },                                // 開始の点数（段階 3 / 2）。starterKit.prof も同じ値にする
JOIN_PROF: { S: 0.8, A: 0.7, B: 0.5, C: 0.3, D: 0.1 },       // 途中加入 = max(開始, round(PEXP(T) × 倍率))（式は旧のまま）
PROF_TRACK: [180, 370, 555, 745, 935, 1125, 1315, 1505, 1675, 1850], // 模型用: ティア T の途中の、ふつうに使う主な武器の点数（party_model・sim が使う）
```
加算の式（1 行動ごと。旧 §4.9.1 の置き換え）:
```
v = 基本の点 × (1 + profPct[その系統か属性]/100)
    × (今の点 < PEXP(T) ? CATCHUP : 1)
    × (今の段階 ≥ PROF_SOFT.rank[T] ? PROF_SOFT.mul : 1)
点 = min(PROF_CAP, 今の点 + v)（小数 2 桁で丸め。旧と同じ）
```
- 素手（内部 `fist`）の攻撃は熟練度を上げない（`train` は WTYPES に無い系統を無視する。旧のまま）。
- 伸びの目安（上の式で 1.1 の模型に当てた計算。§4.3 の P1〜P4 で確かめる）:

| 時点 | 主な武器（62%） | 2 つ目（30%） | 弓だけ（92%） | 術師の主属性 0.75 回 | 術師 1.5 回 |
|---|---|---|---|---|---|
| 灯台に入る時 | 3〜5 | 2〜3 | 4〜6 | 2〜4 | 3〜5 |
| 序章の終わり | **6〜8** | 4〜5 | 8〜9 | 4〜6 | 6〜8 |
| T0 の終わり | 16 | 10〜12 | 20（目安線） | 9〜12 | 13〜15 |
| T3 の終わり | 40 | 24〜28 | 44 | 20〜24 | 28〜32 |
| T7 の終わり | 69 | 45〜50 | 74 | 38〜45 | 55〜60 |
| 本編クリア | **74（70〜85）** | 50〜55 | 80〜84 | 45〜55 | 60〜75 |
| 裏 50 戦 | 76 | 55 | 85 | 50〜57 | 65〜78 |

- 段階 100 には、1 系統だけを使い続けても裏で **200〜500 戦** かかる（目安線 90 の上は ×0.3）。腕章（profPct +20）を付ければ少し早い。

### 1.4 旧い段階の境目 → 新しい段階（担当 RULES・TECHS・SPELLS・GLIMMER）
換算の考え方: 術は「旧の点 × 2.5（術の伸びの倍率）」の段階、技は主な武器が困らず 2 つ目の武器が少し遅れる線に置いた。

| 旧の境目 | 旧 | 新 | どこに書くか |
|---|---|---|---|
| 技の候補 `profRank ≥ glim.lv − 1`（lv1〜10） | 0,1,2,…,9 | **`TECH_PROF[lv]` = lv1:1 lv2:3 lv3:8 lv4:14 lv5:20 lv6:26 lv7:32 lv8:40 lv9:50 lv10:60** | `K.TECH_PROF = [0,1,3,8,14,20,26,32,40,50,60]`（添え字 = lv）。glimmer.js の `pr < lv - 1` を `pr < K.TECH_PROF[lv]` に。party_model の techOk も同じ |
| 単属性 1段 `glim.prof` | 0 | **1** | spells_single.js の glim.prof |
| 単属性 2段 | 2 | **4** | 〃 |
| 単属性 3段 | 4 | **10** | 〃 |
| 合成A（combo A） | 5 | **14** | spells_pair.js（`_a`） |
| 単属性 4段 | 6 | **19** | spells_single.js |
| 合成B（combo B） | 7 | **25** | spells_pair.js（`_b`） |
| 単属性 5段 | 8 | **32** | spells_single.js |
| 3 属性（triple） | 8 | **34**（3 つとも）＋組の条件は旧のまま | spells_triple.js |
| A13b: 1段目の単属性が MP 0 | 段階 5 | **14** | `K.PROF_MP.freeRank` |
| A13b: 2段目の単属性が MP 半分 | 段階 8 | **32** | `K.PROF_MP.halfRank` |
| 極意（lv10）の熟練度 | 9 | **60**（`TECH_PROF[10]`） | 〃 |
| 威力 `+3%/段階、最大 +30%（段階 10）` | 1 + min(0.30, 0.03r) | **1 + 0.30 × ((r − 1)/99)^0.75** | `K.PROF_POWER = { max: 0.30, exp: 0.75 }`（`perRank` を削除）。合成術は属性の段階の平均 r で同じ式 |
| 魔石 熟練度 +1 | +1 | **+2 点**（`PROF_GAIN.stone`） | rules |
| 伸びの装備 `profPct`（腕章・精霊石 +20、レア +35、超レア +50、紙の魔物 +25） | 同じ | **値は変えない**（上限 `MODCAP.prof` 50 も同じ）。目安線 ×0.3 の前にかける | items_acc*.js は系統のキーだけ直す（§3.8） |

威力の値の早見（テスト用）: r1 0% / r5 2.7% / r10 5.0% / r20 8.7% / r30 11.9% / r40 14.9% / r50 17.7% / r60 20.3% / r70 22.9% / r80 25.3% / r90 27.7% / r100 30.0%。
- 敵の側の補正 `K.MON_HP_PROF {perLv 0.004, max 0.20}` は、模型の味方の補正（T0 約 +6% → T7 約 +24%）に合わせて作った。新しい式・`PROF_TRACK` では T0 +5.6% → T7 +20.8% になるので、**sim の結果で `perLv` を 0.0035 前後に下げる**のが第一の調整手段（地方のデータには触らない）。
- 画面には補正の % も MP 軽減の説明も出さない（A17。旧のまま）。強さの熟練度のページは `PROF_PTS.length − 1`（= 100）を棒の最大として既に追従する。

### 1.5 古いセーブの熟練度（担当 RULES、`state.js`）
- 武器の点数は **そのまま**（伸び方が変わらないため）。新しい段階は表から計算される。旧 段階→新 段階の目安: 0→1、1→1、2→2、3→3、4→4、5→6、6→9、7→12、8→15、9→19、10（460 点）→24、旧上限 999 点→45。
- 属性の点数は **×2.5**（術の伸びを 2〜2.5 倍にしたので、同じ遊び方の位置に戻す）、上限 2490。例: 旧 段階 5（90 点）→ 225 点 → 新 13、旧 段階 8（260）→ 650 → 新 32（2 段目の半分がそのまま効く）。
- 消えた系統の点数は `max` で移す: `sword = max(sword, katana)`、`axe = max(axe, club, fist)`、`dagger = max(dagger, whip)`。

---------------------------------------------------------------------------------------------------
## 2. WP の廃止（A18）

### 2.1 数値（`R.Rules.K`、担当 RULES）
```js
MAXES = ['hp', 'mp'];                                  // 'wp' を外す
CAPS.mp = 250; K.MP = { a: 8, b: 2.6, p: 0.85, cap: 250 };   // 曲線は旧のまま、上限だけ 150 → 250
K.GROW = { hp: {S:1.25,A:1.12,B:1.00,C:0.90,D:0.80}, mp: { S: 1.30, A: 1.15, B: 1.00, C: 0.85, D: 0.70 } };  // C・D を少し上げた
K.BONUS_CAP = { hp: 200, mp: 50 };                     // 魔力の実の上限 30 → 50
K.AFTER = { mpPct: 0.12 };                             // 勝った後の回復 10% → 12%（技の分。つまみ。§4.3 A3）
K.MODCAP.cost = -50;                                   // mpCostPct・techCostPct それぞれに
// 削除: K.WP, K.GROW.wp, K.BONUS_CAP.wp, K.AFTER.wpPct, CAPS.wp, STAT_NAMES.wp, DIFF_KEYS の 'wp'（17 → 16 キー）
```
- 最大MP の式は旧のまま（`round(MPlv × GM) × (1 + mpPct/100) + bonus.mp`、上限 250）。Lv30（T4）の目安: 成長 B 54・A 62・S 70。Lv54: B 84・S 109。

### 2.2 技の MP（担当 TECHS）
- 技のデータの `wp` を `mp` に置き換える。**値 = round(旧 wp × 1.5)（.5 は上へ）**: 1→2, 2→3, 3→5, 4→6, 5→8, 6→9, 7→11, 8→12, 10→15, 11→17, 12→18, 13→20, 14→21。
  （MP の曲線は WP の 1.44 倍なので、同じ成長の文字なら「満タンで使える技の回数」は旧とほぼ同じ。）
- 移した技・lv の変わった技の値は §3.4 の表が正。validate の範囲（旧 `C.TECH_WP`）は **`C.TECH_MP = {1:[2,3],2:[3,5],3:[3,6],4:[5,6],5:[5,8],6:[6,9],7:[8,11],8:[9,12],9:[15,17],10:[18,21]}`**。
- 消費の計算は 1 か所 `R.Rules.mpCost(c, id)`（技も術も）:
```
技: max(1, round(a.mp × (1 + max(MODCAP.cost, techCostPct)/100)))
術: profMpBase（A13b）→ 0 は 0 のまま、それ以外 max(1, round(b × (1 + max(MODCAP.cost, mpCostPct)/100)))（旧のまま）
```
  `R.Rules.wpCost` は削除。`profMpKind` は術だけ（旧のまま）。閃いた技・術は MP を使わない（旧のまま）。

### 2.3 仲間・主人公の成長の文字（担当 NEWGAME）
`growth: {hp, mp}`（`wp` を削除）。**新しい mp = 旧 mp と旧 wp の良い方**。validate の合計の規則は「hp＋mp（S4〜D0）が 4〜6」。

| id | 旧 hp/mp/wp | 新 hp/mp | | id | 旧 | 新 |
|---|---|---|---|---|---|---|
| selma | A C B | A B | | zafira | C B A | C A |
| hagen | S D B | S B | | ferno | C A B | C A |
| dokka | S C C | S C | | belladonna | B B B | B B |
| basil | A B C | A B | | boden | B A C | B A |
| bartolo | A C B | A B | | teo | C S C | C S |
| viola | B B B | B B | | ilse | C S C | C S |
| shigure | B D S | B S | | morga | C A B | C A |
| rouga | A D A | A A | | marta | B S D | B S |
| titta | B C A | B A | | noela | C A B | C A |
| brigitta | B C A | B A | | 主人公 warrior | A C B | A B |
| sylvain | C B A | C A | | ranger / mage | B C A / C S C | B A / C S |
| | | | | spellblade / wanderer | B B B | B B |

### 2.4 MP の回復手段
| 手段 | 新 |
|---|---|
| 宿屋・休息の灯・酒場の全快 | HP/MP 全快（WP の行を消すだけ） |
| 勝った後 | MP +12%（`K.AFTER.mpPct`、切り上げ） |
| レベルアップ | 増えた最大 MP の分だけ今の MP も増える（旧のまま、WP を外す） |
| 道具 | §2.5 |
| 装備の `mpRegen`（手番ごとに固定値） | 旧のまま。WP の効果は §2.5 のとおり移す |

### 2.5 WP に触れる品・技・術の全一覧（置き換え表）
効果キーの変更（担当 RULES が `mods`・`describe` を、各データ担当が品を直す）:
- `wpRegen: n` → `mpRegen: n`（同じ値。MP もある品は合算して丸める、下表）
- `wpCostPct: v` → **`techCostPct: v`**（技の MP。文「技のMPの消費が減る／増える。」）
- `mpCostPct` は **術の MP** のまま（文「術のMPの消費が…」）
- `wpPct`・`healWp`・`grow('wp')` は削除（使っている品は無い／下表で置換）

| id | ファイル（担当） | 旧 | 新 | 新しい説明（desc） |
|---|---|---|---|---|
| ac_hourglass_wp 気力の砂時計 | items_acc.js（GEAR） | wpCostPct −15 | techCostPct −15 | 技のMPの消費が減る。 |
| ac_ouroboros_ring 円環のかけら | items_acc_monster.js（GEAR） | wpRegen 3, mpRegen 3 | mpRegen 4 | 戦闘中、MPが少しずつ戻る。\nただし受けるダメージが増える。 |
| ac_rl_peak どんぐりの帽子飾り | items_acc_relic.js（GEAR） | wpRegen 1（クセ mpCostPct +25） | mpRegen 1（クセそのまま） | 体力が割合で上がる。MPが戻る。\nただし術のMPの消費が増える。 |
| ac_rs_peak どんぐり王子の紋章 | items_acc_relic.js | wpRegen 2 | mpRegen 2 | 体力と腕力が上がる。MPが戻る。\nただしかわしにくい。 |
| ac_tale_isles 潮騒の耳飾り | items_acc_reward.js | wpRegen 1（クセ mpCostPct +25） | mpRegen 1 | 器用さが割合で上がる。MPが戻る。\nただし術のMPの消費が増える。 |
| ac_rival_pen 記録院の銀筆 | items_acc_reward.js | mpCostPct −15, wpCostPct −15 | mpCostPct −15, techCostPct −15 | 術と技のMPの消費が減る。\nただし術防が下がる。 |
| ac_sr_ouroboros 円環の指輪 | items_acc_super.js | mpRegen 2, wpRegen 2 | mpRegen 3 | 閃きやすい。MPが戻る。\nただし経験値が入らない。 |
| hn_r5_int 術師の長手袋 | items_armor_rare.js | クセ wpCostPct +25 | クセ techCostPct +25 | 術のMPの消費が減る。\nただし技のMPの消費が増える。 |
| sh_r9_int 始原の魔導書 | items_armor_rare.js | 同上 | 同上 | 同上 |
| hn_sr_hundred 百発の手袋 | items_armor_super.js | クセ wpCostPct +50 | クセ techCostPct +50 | 会心が出やすい。\nただし技のMPの消費が増える。 |
| w_club_r9 審判の槌 → **w_axe_r9m** | items_weapons_rare.js（WEAPONS） | クセ wpCostPct +25 | クセ techCostPct +25 | 魔族に大きなダメージ。／ただし技のMPの消費が増える。 |
| i_tonic 気力の茶 | items_use.js（GEAR） | WP 30% | **削除**（セーブは i_ether へ） | — |
| i_lifedew 命のしずく | items_use.js | HP・MP・WP 全快 | heal 1, healMp 1 | 味方1人のHPとMPを\nすべて回復する。 |
| i_seed_mp 魔力の実 | items_use.js | 最大MP +2 | **最大MP +3** | 食べると最大MPが\n3増える。 |
| i_seed_wp 気力の実 | items_use.js | 最大WP +2 | **削除**（セーブは i_seed_mp へ） | — |
| i_jewel_carrot 宝石にんじん | items_use.js | HP・MP・WP 全快 | heal 1, healMp 1 | 味方1人のHPとMPを\nすべて回復する。 |
| i_moon_wool 月見の毛糸 | items_use.js | 全員 WP 30% | 1 人 MP 50%（ally, healMp 0.5） | 味方1人のMPを\n最大値の50%回復する。 |
| i_spring_key ぜんまいの鍵 | items_use.js | 1 人 WP 全快 | 全員 MP 20%（allies, healMp 0.2） | 味方全員のMPを\n最大値の20%回復する。 |
| i_wisdom_page 知恵のページ | items_use.js | 1 人 MP・WP 全快 | 全員 MP 50%（allies, healMp 0.5） | 味方全員のMPを\n最大値の50%回復する。 |
| i_golden_ink 黄金のインク | items_use.js | 全員 MP・WP 50% | 全員 MP 70%（allies, healMp 0.7） | 味方全員のMPを\n最大値の70%回復する。 |
| i_dream_fruit 夢の果実 | items_use.js | HP+20, MP+5, WP+5 | HP+20, MP+8 | 食べると最大HPが20、\n最大MPが8増える。 |
| s_fire_light_b 勇気の灯火 | spells_pair.js（TECHS） | buff atk+1, healWp 0.25, field:true | buff atk+1, `st('regen')`, **field:false** | 全員の攻撃力を上げ、再生の状態にする。 |
| t_staff_share 魔力分け | techs_staff.js（TECHS） | wp 4, healMp 0.15, target ally | **mp 6, healMp 0.10, target `ally_other`**, noAuto | 自分のMPを分け、仲間1人のMPを回復する。 |
| t_staff_prayer 千年の祈り | techs_staff.js | wp 13（heal 0.4, healMp 0.1） | mp 20（効果そのまま） | 変えない |
- 店・宝箱: `i_tonic` を `shops.js` の ITEM_TABLE（tier 1）と `pools.js` の S1 から外す。`i_seed_wp` を `pools.js` p_rare から外し `i_seed_mp` の重みを 1 → 2。`items_use.js` のコメントの「MP・WP」の段は「MP」に。

### 2.6 オートの MP の使い方（共有の MP。担当 BATTLE、`battle_ai.js`）
- `abilityOptions`: 技も `mp = eng.mpCost(u, id)`、`cost = mp`。`wp` の項目を消す。`spend(u,o) = o.mp / max(1, u.mmp)`。
- **戦士（回復・蘇生の術を 1 つも持たない人）**: 雑魚戦の節約は旧と同じ（`lowPool` = MP < 30% では技・術を使わない、`mobGate` を通ったときだけ使う）。
- **術師・回復役（味方への `heal` か `revive` の術を持つ人）**: 雑魚戦で、回復・蘇生・状態治し以外の MP 行動（技も術も）は **使った後に `max(0.3 × 最大MP, 2 × 一番安い回復の術の MP)` 以上が残るときだけ**。ボス戦は旧の「回復 1 回分を残す」を技にも広げる（`o.mp` に技が入るので `healer && o.mp && u.mp − o.mp < healCost` の判定がそのまま効く）。
- MP 0 の術（A13b）の特別扱いは旧のまま（関門なし、攻撃より当たりが大きければ使う）。
- `GLIM_REACH`（後列の閃きねらい）: `{ mpMin: 0.5, perBattle: 2 }`。術を覚えている人は `mpMin 0.6` かつ技の MP ≤ 最大MP の 5%。杖が後列から届くようになる（§3.1）ので、後列の杖の「攻撃」自体が届き、この経路は他の系統（例: 短剣の刃つぶて）だけに効く。
- 閃きねらいの術（`glimCast`）の「MP ≥ 50%」は旧のまま。
- `tryHeal` などは旧のまま（MP は共有なので、技で減った MP でも回復の術は判定どおり）。

### 2.7 画面（担当 UI・BATTLE。数値の細かな効果は出さない A17 のまま）
| 場所 | ファイル | 変更 |
|---|---|---|
| 戦闘のステータス窓 | battle_scene.js（BATTLE） | 1 行 = `前/後の札・名前・H 現在/最大・M 現在/最大`。`SCOL` の目安 `{tag:4, name:18, nameW:36, h:56, hp:100, m:104, mp:154}`（hp・mp は右寄せの右端。`999/999` と `250/250` が重ならないこと、名前は `fitText`）。W の列を消す |
| 戦闘の対象選びの 1 行（`HP a/b　MP c/d　WP …`、1574 行付近） | battle_scene.js | `HP a/b　MP c/d` |
| 戦闘の技の一覧の消費 | battle_scene.js | `Rules.mpCost`、表示は `M` の列（術と同じ）。足りない時の文 `MPが足りない！`（`UNUSABLE_TEXT.wp` を消す） |
| 数字の色（`ev.wp` オレンジ） | battle_scene.js・battle_fx.js | `ev.wp` を消す。MP の回復はシアンのまま。`FX.wp` と `healWp` の演出の対応は消してよい |
| 戦闘の結果・レベルアップの「最大WP+n」 | battle.js（BATTLE） | `['hp','mp']` だけ |
| メニューの人の窓（498 行・1303 行・1325 行付近） | menu.js（UI） | WP の欄を消し `MP 現在/最大` を出す |
| 強さの能力のページ | menu_status.js（UI） | `HP` `MP` の 2 行（WP の行を消す） |
| 技の一覧・技の詳細（Y）・技の書 | menu_status.js・menu_items.js・menu_book.js | 消費は `M n`（`Rules.mpCost`）。`W` を使わない |
| 装備の比較（差分） | menu.js・menu_equip.js | `DIFF_KEYS` から `wp`（16 キー） |
| 品の詳細の効果の行 | menu_items.js | `wpPct`・`wpRegen`・`wpCostPct`・`healWp` を消し、`techCostPct: ['技の消費MP', 1, 1]` を足す（文は「技のMPが減る」など。数字は旧の他のキーと同じ出し方） |
| 移動中の道具・術の使用 | menu.js（UI） | `healWp`・`grow wp` の分岐を消す |
| 店 | shop.js（UI） | 品の説明は `Rules.describe` を通るだけなので変更なし（WP の行が消える）。気力の茶が並ばないことを確認 |
| 休息の灯・デバッグ | events_runtime.js・debug.js（UI） | `c.wp` の代入を消す |

### 2.8 セーブ（担当 RULES、`state.js` の `deserialize` と `repairChar`）
- `g.rev`（新しい数値のキー）が 19 未満なら §3.9 の移行を 1 回だけ行い、`g.rev = 19`。
- 人ごと: `c.mp = c.mp + round(1.5 × (c.wp || 0))`（その後 `clampHpMp`）、`c.bonus.mp = min(50, bonus.mp + bonus.wp)`、`delete c.wp`、`delete c.bonus.wp`。`template()`・`newChar`・`healAll` から `wp` を消す。

---------------------------------------------------------------------------------------------------
## 3. 武器 7 系統（A19）

### 3.1 系統の表（担当 RULES＝`K.WTYPE`、TECHS＝`weapontypes.js`）
| id | 名前 | 手 | 後列から | 打撃の種類 | mult | 命中 | 会心 | 能力値 | magMult | desc（weapontypes.js） |
|---|---|---|---|---|---|---|---|---|---|---|
| sword | 剣 | 片手 | × | slash | 1.00 | 0 | 2 | str | 0.5 | 片手持ち。盾と合わせて攻守に強い。刀もこの系統。 |
| greatsword | 大剣 | 両手 | × | slash | 1.40 | −5 | 2 | str | 0.5 | 両手持ち。重い一撃で敵をなぎ倒す。 |
| dagger | 短剣 | 片手 | × | pierce | 0.75 | 8 | 10 | dex | 0.5 | 器用さで戦う。会心が出やすい。爪もこの系統。 |
| axe | 斧 | 片手 | × | slash | 1.15 | −10 | 4 | str | 0.5 | 一撃が重い。打撃の槌やメイスもこの系統。 |
| spear | 槍 | 両手 | ○ | pierce | 1.25 | 0 | 2 | str・dex | 0.5 | 両手持ち。後列からでも届く。 |
| bow | 弓 | 両手 | ○ | pierce | 1.10 | 5 | 4 | dex | 0.5 | 両手持ち。後列から確実に射る。 |
| staff | 杖 | 片手 | **○（新）** | blunt | 0.60 | 0 | 0 | str・int | 1.0 | 術の威力を高める。後列からも届く。 |
- 並び（`order`）: sword 0, greatsword 1, dagger 2, axe 3, spear 4, bow 5, staff 6。`WTYPES`・`WTYPE_NAMES`・menu.js・charcreate.js・shops.js・validate の `C.WTYPES` をすべてこの 7 つに。
- **素手**: `K.WTYPE.fist = WT(1, false, 'blunt', 0.90, 5, 5, ['str','agi'], 0.5)` と `K.UNARMED` を残し、`R.Rules.UNARMED = 'fist'` として公開。WTYPES・DB.weaponTypes には入れない。コマンド名は「素手」（`rules.js` の `commandList` の `wtypeName('fist')` を固定文字「素手」に）。熟練度・技・閃きなし（`techCands` は技の一覧が空なので自然に候補なし）。
- **品の上書き（新しい任意の項目、担当 RULES が `fillItem`・`weaponInfo` に入れる）**:
  - `mult`（数）: `atk = round(W[T] × (it.mult ?? 系統の mult))`
  - `kind`（`slash|pierce|blunt`）: 既に `weaponInfo` が `it.kind || T.kind` を読む（変更なし）
  - `art`（`'katana'|'club'` など、戦闘の絵の形）と `icon`（`'icon:katana'|'icon:club'`）: 絵だけ。規則には効かない
  - `crit`・`hit`（既存）: 系統の値に足す
- 敵のデータは武器の系統を参照していない（弱点・耐性は `slash/pierce/blunt` と属性だけ）。打撃（blunt）の出どころは **杖・斧のメイス系列（`kind:'blunt'`）・斧の打撃の技（§3.4 で `kind:'blunt'`）** になる。`monsters_*.js` の `slash/pierce/blunt` の値は変えない。

### 3.2 武器の id の対応（全 301 本、担当 WEAPONS）
残る系統（sword・greatsword・dagger・axe・spear・bow・staff）の 216 本は **id も中身もそのまま**（`w_club_r9` のクセだけ §2.5）。
下は消える 4 系統の 100 本（85 本を移し、15 本の通常品の重複と帯のレアを消す。消す品はセーブで右の id に置き換わる）。

**刀（katana 25）→ 剣**。残す品は `art:'katana'`、`icon:'icon:katana'`、`mult:1.05`、`crit = 旧の品の crit + 8`（旧の系統の会心 10 − 剣 2）。
| 旧 id | 新 id | 名前 | 扱い |
|---|---|---|---|
| w_katana_uchi | **w_sword_uchi** | 打ち刀 | 残す（T0・normal・src shop・line `w_sword_uchi`。店の段には置かない。シグレ・ヴィオラの初期装備） |
| w_katana_1〜9 | w_sword_1〜9 | — | 消す（剣の通常品と重複） |
| w_katana_r1 / r3 | w_sword_r1 / w_sword_r3 | — | 消す |
| w_katana_r5 / r7 / r9 | **w_sword_r5k / w_sword_r7k / w_sword_r9k** | 残照の刀 / しらさぎ丸 / 夜叉丸 | 残す（帯のレア） |
| w_katana_sand / moon / tide / ash | **w_sword_sand / w_sword_moon / w_sword_tide / w_sword_ash** | 名前そのまま | 残す（mdrop） |
| w_katana_sr_crimson / sr_snowgeneral / sr_matsuyoi / sr_clockwork / sr_platinum / sr_dreamcut | **w_sword_sr_crimson / w_sword_sr_snowgeneral / w_sword_sr_matsuyoi / w_sword_sr_clockwork / w_sword_sr_platinum / w_sword_sr_dreamcut** | 名前そのまま | 残す（超レア。落とす魔物は同じ） |

**棍棒（club 24）→ 斧（打撃のメイス系列）**。すべて `kind:'blunt'`、`art:'club'`、`icon:'icon:club'`、`mult:1.05`、`hit: +10`（斧の −10 を打ち消す。旧の棍棒と同じ攻撃力・命中）。
| 旧 id | 新 id | 名前 |
|---|---|---|
| w_club_wood | **w_axe_cudgel** | 木の棍棒（T0、line `w_axe_mace` の T0） |
| w_club_1〜9 | **w_axe_mace_1〜9** | 鋼のメイス〜天鋼のメイス（line `w_axe_mace`、units s1v1 のまま） |
| w_club_r1 / r3 / r5 / r7 / r9 | **w_axe_r1m / w_axe_r3m / w_axe_r5m / w_axe_r7m / w_axe_r9m** | 墓守の棍棒 / 歯車砕きの槌 / 聖鐘の槌 / 岩震の槌 / 審判の槌 |
| w_club_ashen / w_club_rat / w_club_forgehammer | **w_axe_ashen / w_axe_rat / w_axe_forgehammer** | 名前そのまま |
| w_club_sr_wander / sr_goblin / sr_toadstool / sr_bullfrog / sr_ironore / sr_cactus_king | **w_axe_sr_wander / w_axe_sr_goblinclub / w_axe_sr_toadstool / w_axe_sr_bullfrog / w_axe_sr_ironore / w_axe_sr_cactusking** | 名前そのまま |

**体術（fist 25）**
| 旧 id | 新 id | 新しい名前 | 扱い・上書き |
|---|---|---|---|
| w_fist_leather / w_fist_1〜9 | w_dagger_iron / w_dagger_1〜9 | — | 消す |
| w_fist_r1 / r3 / r5 / r7 / r9 | w_dagger_r1 / r3 / r5 / r7 / r9 | — | 消す |
| w_fist_sr_greywolf | **w_dagger_sr_greywolf** | 灰色オオカミの爪 | 短剣、`mult:0.85` |
| w_fist_sr_icicle_child | **w_dagger_sr_icicle** | こおり小僧の爪 | 短剣、`mult:0.85` |
| w_fist_sr_scorpion | **w_dagger_sr_scorptail** | 毒尾の爪 | 短剣、`mult:0.85` |
| w_fist_sr_ironclaw | **w_dagger_sr_ironclaw** | 鉄のかぎ爪 | 短剣、`mult:0.85` |
| w_fist_wormtooth | **w_dagger_wormtooth** | 大ミミズの牙爪 | 短剣（mdrop）、`mult:0.85` |
| w_fist_sr_triple_fang | **w_dagger_sr_triplefang** | 三つ牙の爪 | 短剣、`mult:0.85` |
| w_fist_wolfking | **w_dagger_wolfking** | オオカミ王の牙爪 | 短剣（mdrop）、`mult:0.85` |
| w_fist_sr_crabclaw | **w_axe_sr_crabclaw** | カニばさみの槌 | 斧・打撃（メイスと同じ上書き） |
| w_fist_sr_yeti | **w_axe_sr_yeti** | 雪男の大槌 | 斧・打撃 |
| w_fist_brimstone | **w_axe_brimstone** | 硫黄の槌 | 斧・打撃（mdrop） |

**鞭（whip 26）**。弓・槍へ移す品は `mult:0.95`（両手持ちは系統のとおり付く）。
| 旧 id | 新 id | 新しい名前 | 扱い |
|---|---|---|---|
| w_whip_leather / w_whip_1〜9 | w_dagger_iron / w_dagger_1〜9 | — | 消す |
| w_whip_r1 / r3 / r5 / r7 / r9 | w_dagger_r1 / r3 / r5 / r7 / r9 | — | 消す |
| w_whip_sr_vine | **w_bow_sr_vine** | 花づるの弓 | 弓 |
| w_whip_snakeskin | **w_bow_snakeskin** | 大蛇の弓 | 弓（mdrop） |
| w_whip_sr_spidersilk | **w_bow_sr_spidersilk** | 毒糸の弓 | 弓 |
| w_whip_sr_python | **w_bow_sr_python** | 大蛇王の弓 | 弓 |
| w_whip_mist | **w_spear_mist** | 霧の槍 | 槍（mdrop） |
| w_whip_sr_venomjelly | **w_spear_sr_venomjelly** | 毒ゼリーの槍 | 槍 |
| w_whip_sr_chain_curse | **w_spear_sr_chaincurse** | 呪い鎖の鎌槍 | 槍 |
| w_whip_sr_eightarm | **w_spear_sr_eightarm** | 八本腕のもり | 槍 |
| w_whip_sr_quicksilver | **w_spear_sr_quicksilver** | 白銀の流れ槍 | 槍（metalHit そのまま） |
| w_whip_sr_reaper | **w_dagger_sr_reaper** | 死神の尾針 | 短剣 |
| w_whip_sr_silk | **w_dagger_sr_silk** | 銀糸の短剣 | 短剣（片手のまま：`items_armor.js` の器用さビルドの S 列が盾と両立するため） |

- 品の効果・クセ・`exclusive`・desc の効果の文は旧のまま（desc の「鞭」などの語は新しい名前に合わせて直す）。レアのクセの規則（D3）はそのまま満たす。
- 系統ごとの本数（通常 / 帯のレア / mdrop / 超レア。node で数えた値）: 剣 11/8/6/16＝41、大剣 10/5/3/4＝22（変更なし）、短剣 10/5/5/15＝35、斧 20/10/7/15＝52（斧とメイスの 2 系列。杖の 2 系列と同じ扱い）、槍 10/5/4/15＝34、弓 10/5/4/11＝30、杖 20/9/2/15＝46。計 **260**（≥150）。
- 参照の書き換え（WEAPONS がその場で直す）: `monsters_{common,forest,desert,snow,marsh,isles,mine,ash,star}.js` の `drops`（grep で 40 か所）、`rare.js` 250 行（`w_katana_sr_dreamcut`）、`items_armor.js` の BUILDS の `w_whip_sr_silk` → `w_dagger_sr_silk`（この 1 か所は GEAR の担当ファイルだが、GEAR が直す）、`tools/sim_loot.js` の同じ列（QA）。

### 3.3 店・宝箱（担当 WEAPONS、`shops.js`・`pools.js`）
```js
const ALLW = ['w_sword', 'w_greatsword', 'w_dagger', 'w_axe', 'w_axe_mace', 'w_spear', 'w_bow', 'w_staff', 'w_staff_prayer'];   // 9 系列
T0ID: w_axe_mace → 'w_axe_cudgel'（w_katana・w_fist・w_whip・w_club を消す）
const WT = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];   // 腕章 7 つ
```
| 店 | 旧の系列 | 新の系列 |
|---|---|---|
| lute_weapon・biblia_weapon | ALLW（12） | ALLW（9）＋腕章 7 |
| fern_weapon | bow spear dagger staff staff_prayer whip | bow spear dagger staff staff_prayer |
| kasim_weapon | sword katana dagger whip axe | sword dagger axe greatsword |
| yule_weapon | axe spear club greatsword bow | axe spear axe_mace greatsword bow |
| loch_weapon | staff staff_prayer whip dagger bow fist | staff staff_prayer dagger bow axe_mace |
| coral_weapon | sword katana spear fist bow whip | sword spear bow dagger |
| dovan_weapon | sword greatsword axe club spear（r_mine 後 ALLW＋腕章） | sword greatsword axe axe_mace spear（r_mine 後 ALLW＋腕章 7） |
| caldera_weapon | fist katana axe greatsword club staff | sword axe greatsword axe_mace staff |
| orbis_weapon | staff staff_prayer dagger bow whip | staff staff_prayer dagger bow spear |
| 道具屋 ITEM_TABLE tier 1 | i_tonic あり | i_tonic を消す |
| orbis_magic・biblia_item | ac_hourglass_wp | そのまま（効果が技の MP に変わるだけ） |
| coral_regnas | 腕章 11 | 腕章 7 |
- `pools.js` は品の `line`・`src`・`tier` から作るので、品が直れば武器のプールは自動で直る。S1 から `i_tonic`、p_rare から `i_seed_wp` を消す（§2.5）。

### 3.4 技の再配置（121 → 108、担当 TECHS）
- 各系統のファイル `techs_<wtype>.js` を下の表のとおりに書き直し、`techs_katana.js` `techs_club.js` `techs_fist.js` `techs_whip.js` は **削除**。
- id は `t_<新しい系統>_…`（validate の規則）。`wtype`・`glim.lv`・`glim.from`・`mp`・`rank`（= lv）を表のとおりに。効果・演出・`quick`・`noAuto`・`magic` は、表に書いた変更のほかは元の技のまま。
- 後列: 槍・弓・杖の技はすべて `reach:true`。剣・大剣・短剣・斧の技は元の `reach` のまま（鞭から短剣に来た技は `reach:false`、体術から槍に来た技は `reach:true`）。
- 斧に来た棍棒の技は、ダメージの効果に **`kind:'blunt'`** を足す（打撃の技）。
- 「威力」の列は変えるものだけ（§6.4.1 の目安 G(lv) = [1.5,1.7,1.9,2.1,2.25,2.4,2.6,2.8,3.0,3.2]、状態つきは −0.3 前後）。

**剣（17）**
| 新 id | 元 | 名前 | lv | from | MP | 変更 |
|---|---|---|---|---|---|---|
| t_sword_stepcut | 同じ | 踏み込み斬り | 1 | attack | 2 | |
| t_sword_guard | 同じ | 受け太刀 | 1 | attack | 3 | |
| t_sword_draw | t_katana_draw | 抜き打ち | 2 | attack | 3 | 威力 1.2→1.4（quick のまま） |
| t_sword_twin | 同じ | 連ね斬り | 2 | stepcut | 3 | |
| t_sword_mine | t_katana_mine | 峰打ち | 3 | draw | 3 | 威力 1.25→1.5（気絶） |
| t_sword_thrust | 同じ | 刺し貫き | 3 | stepcut | 5 | |
| t_sword_wheel | 同じ | 風車斬り | 4 | twin | 6 | |
| t_sword_haze | t_katana_haze | 陽炎斬り | 4 | mine | 5 | |
| t_sword_bulwark | 同じ | 城壁の構え | 5 | guard | 5 | |
| t_sword_purify | 同じ | 清めの剣 | 6 | thrust, bulwark | 8 | |
| t_sword_void | t_katana_void | 虚空斬り | 6 | haze, wheel | 9 | |
| t_sword_bladewind | 同じ | 刃風 | 7 | wheel | 11 | |
| t_sword_lifecut | t_katana_lifecut | 命断ち | 7 | void | 11 | |
| t_sword_triple | 同じ | 三つ星斬り | 8 | twin, purify | 12 | |
| t_sword_first | t_katana_first | 一の太刀 | 9 | lifecut, draw | 15 | 威力 2.3→2.6（quick のまま） |
| t_sword_dawn | 同じ | 日の出の剣 | 9 | triple, bladewind | 15 | |
| t_sword_crest | 同じ | 光紋剣 | 10 | dawn | 20 | |

**大剣（15）**
| 新 id | 元 | 名前 | lv | from | MP | 変更 |
|---|---|---|---|---|---|---|
| t_greatsword_overhead | 同じ | 大上段 | 1 | attack | 3 | |
| t_greatsword_mow | 同じ | なぎ倒し | 1 | attack | 3 | |
| t_greatsword_flat | 同じ | 平打ち | 2 | overhead | 3 | |
| t_greatsword_parry | t_fist_willow | 受け流し | 2 | mow | 3 | desc「大剣で受け流し、斬り返す構え。」 |
| t_greatsword_whirl | 同じ | 渦巻き斬り | 3 | mow | 6 | |
| t_greatsword_desperate | 同じ | 決死斬り | 4 | overhead | 5 | |
| t_greatsword_helmsplit | t_club_smash | 兜割り | 4 | flat | 6 | 威力 1.3→2.0、気絶 0.25、kind slash、desc「兜ごと断ち割る一撃。気絶させることがある。」 |
| t_greatsword_rend | 同じ | 鎧断ち | 5 | flat | 6 | |
| t_greatsword_shatter | t_club_shatter | 鎧くずし | 5 | flat, parry | 8 | 威力 2.0（守備 −1） |
| t_greatsword_quake | 同じ | 地割り | 6 | whirl, desperate | 9 | |
| t_greatsword_crush | 同じ | 鉄砕き | 7 | rend | 9 | |
| t_greatsword_adamant | t_club_diamond | 金剛断ち | 7 | helmsplit, shatter | 11 | 威力 2.4（気絶） |
| t_greatsword_tempest | 同じ | 大嵐斬り | 8 | whirl, quake | 12 | |
| t_greatsword_skyfall | 同じ | 天崩し | 9 | crush, desperate | 17 | |
| t_greatsword_rivers | 同じ | 山河断ち | 10 | skyfall, tempest | 21 | |

**短剣（15）**
| 新 id | 元 | 名前 | lv | from | MP | 変更 |
|---|---|---|---|---|---|---|
| t_dagger_vital | 同じ | 急所ねらい | 1 | attack | 2 | |
| t_dagger_filch | 同じ | かすめ取り | 1 | attack | 2 | noAuto |
| t_dagger_venom | 同じ | 毒の一刺し | 2 | vital | 3 | |
| t_dagger_numb | t_whip_bind | しびれ針 | 2 | filch | 3 | reach:false、威力 1.45（まひ） |
| t_dagger_knives | 同じ | 刃つぶて | 3 | filch | 5 | |
| t_dagger_pommel | t_fist_knee | 柄当て | 3 | vital | 5 | 威力 1.6（気絶） |
| t_dagger_lull | 同じ | まどろみ刺し | 4 | venom | 5 | |
| t_dagger_serpent | t_whip_serpent | 蛇の舞 | 4 | numb | 6 | reach:false、威力 1.9→1.8（混乱） |
| t_dagger_bees | 同じ | 蜂の群れ | 5 | knives | 8 | |
| t_dagger_hail | t_fist_hail | 雨あられ突き | 5 | knives, pommel | 8 | 0.47×5 → 0.5×5 |
| t_dagger_gap | 同じ | すきま通し | 6 | vital, lull | 6 | |
| t_dagger_nape | 同じ | 寝首かき | 7 | lull | 9 | |
| t_dagger_shadow | 同じ | 影の一刺し | 8 | gap, bees | 11 | |
| t_dagger_dance | 同じ | 影の舞 | 9 | bees, nape | 15 | |
| t_dagger_nightfall | 同じ | 闇夜の刃 | 10 | dance | 20 | |

**斧（16）**（★ = ダメージに `kind:'blunt'`）
| 新 id | 元 | 名前 | lv | from | MP | 変更 |
|---|---|---|---|---|---|---|
| t_axe_cleave | 同じ | たたき割り | 1 | attack | 2 | |
| t_axe_woodcut | 同じ | 木こり割り | 1 | attack | 2 | |
| t_axe_crumble ★ | t_club_crumble | 打ち崩し | 2 | attack | 3 | 威力 1.25→1.4（守備 −1） |
| t_axe_throw | 同じ | 回し投げ | 2 | cleave | 5 | |
| t_axe_rage | 同じ | 荒ぶる心 | 3 | woodcut | 3 | |
| t_axe_tremor ★ | t_club_tremor | 地揺らし | 3 | crumble | 6 | |
| t_axe_reckless | 同じ | 荒くれ割り | 4 | cleave, rage | 5 | |
| t_axe_bell ★ | t_club_bell | 鐘打ち | 4 | crumble | 6 | |
| t_axe_whirl | 同じ | 旋風の斧 | 5 | throw | 8 | |
| t_axe_strip ★ | t_club_strip | はがし打ち | 5 | bell | 6 | |
| t_axe_cliff | 同じ | 断崖落とし | 6 | reckless | 9 | |
| t_axe_twostroke | 同じ | 鬼の二振り | 7 | woodcut, cliff | 9 | |
| t_axe_storm | 同じ | 嵐投げ | 8 | throw, whirl | 12 | |
| t_axe_earthsplit | 同じ | 大地割り | 9 | cliff, twostroke | 15 | |
| t_axe_thunder ★ | t_club_thunder | 神鳴り打ち | 9 | bell, strip | 15 | |
| t_axe_giant | 同じ | 巨人の一振り | 10 | earthsplit | 21 | |

**槍（15、すべて reach:true）**
| 新 id | 元 | 名前 | lv | from | MP | 変更 |
|---|---|---|---|---|---|---|
| t_spear_upthrust | 同じ | 突き上げ | 1 | attack | 2 | |
| t_spear_butt | 同じ | 石突き | 1 | attack | 2 | |
| t_spear_skewer | 同じ | 穂先払い | 2 | upthrust | 5 | |
| t_spear_disarm | t_whip_disarm | 武器落とし | 2 | butt | 3 | 威力 1.6→1.45（攻撃 −1） |
| t_spear_receive | 同じ | 迎え槍 | 3 | butt | 3 | |
| t_spear_pierce | 同じ | 徹し突き | 4 | upthrust, skewer | 5 | |
| t_spear_cloud | 同じ | 雲突き | 5 | upthrust | 6 | |
| t_spear_vault | t_fist_throw | かち上げ | 5 | butt, receive | 8 | 威力 2.25→2.0（気絶）、desc「石突きで敵をかち上げる。気絶させることがある。」 |
| t_spear_ripple | 同じ | さざ波突き | 6 | skewer, receive | 8 | |
| t_spear_whirl | t_whip_coil | 大車輪 | 6 | disarm, skewer | 9 | 敵全体 1.3→1.2（素早さ −1） |
| t_spear_phalanx | 同じ | 槍ぶすま | 7 | ripple | 11 | |
| t_spear_soar | 同じ | 天翔ける槍 | 8 | cloud, pierce | 12 | |
| t_spear_heavennet | t_whip_net | 天網の槍 | 8 | whirl | 12 | 敵全体 1.45→1.3（まひ） |
| t_spear_surge | 同じ | 荒波の槍 | 9 | ripple, soar | 15 | |
| t_spear_starpierce | 同じ | 星貫き | 10 | surge | 20 | |

**弓（15、すべて reach:true）**
| 新 id | 元 | 名前 | lv | from | MP | 変更 |
|---|---|---|---|---|---|---|
| t_bow_rapid | 同じ | 速射 | 1 | attack | 2 | |
| t_bow_twin | 同じ | 二つ矢 | 1 | attack | 3 | |
| t_bow_hobble | t_whip_trip | 足止めの矢 | 2 | rapid | 3 | 威力 1.25→1.35（素早さ −1）、fx arrow |
| t_bow_blind | 同じ | 目つぶしの矢 | 2 | rapid | 3 | |
| t_bow_rain | 同じ | 矢しぐれ | 3 | twin | 6 | |
| t_bow_hush | 同じ | 静寂の矢 | 4 | blind | 5 | |
| t_bow_venom | t_whip_thorn | 毒矢 | 4 | hobble | 6 | 威力 2.05→1.8（毒）、fx arrow |
| t_bow_hawk | 同じ | 鷹の一矢 | 5 | rapid | 6 | |
| t_bow_pin | 同じ | 射すくめ | 6 | hush | 8 | |
| t_bow_volley | 同じ | つるべ射ち | 7 | twin, rain | 9 | |
| t_bow_firerain | t_whip_sparks | 火矢の雨 | 7 | venom, rain | 11 | random 0.72×4、`element:'fire'` を足す、fx fire2 |
| t_bow_gale | 同じ | 大風の矢 | 8 | rain, hawk | 12 | |
| t_bow_dusk | t_whip_twilight | 宵闇の矢 | 8 | pin, hobble | 12 | 敵全体 1.35→1.2（素早さ −1・攻撃 −1） |
| t_bow_starrain | 同じ | 星しぐれ | 9 | volley, rain | 15 | |
| t_bow_rainbow | 同じ | 虹の矢 | 10 | starrain | 20 | |

**杖（15、すべて reach:true・magic:true）**
| 新 id | 元 | 名前 | lv | from | MP | 変更 |
|---|---|---|---|---|---|---|
| t_staff_mind | 同じ | 念じ打ち | 1 | attack | 2 | |
| t_staff_soothe | 同じ | いたわり | 1 | attack | 3 | |
| t_staff_seal | 同じ | 封じの印 | 2 | mind | 3 | |
| t_staff_weaken | t_club_wrist | 力封じ | 2 | mind | 3 | 術力で打つ（magic）1.2、攻撃 −1 |
| t_staff_unward | 同じ | 守りほどき | 3 | mind | 5 | |
| t_staff_calm | t_fist_breath | 調息 | 3 | soothe | 5 | self、heal＋cure はそのまま、quick なし |
| t_staff_share | 同じ | 魔力分け | 4 | soothe | 6 | §2.5 |
| t_staff_wave | 同じ | 念の波 | 5 | mind, unward | 8 | |
| t_staff_bolt | t_fist_farstrike | 念弾 | 5 | weaken, seal | 8 | magic 2.0、desc「念をこめた弾を放つ。」 |
| t_staff_clarity | 同じ | 心澄まし | 6 | share | 6 | |
| t_staff_aegis | 同じ | 術よけの輪 | 7 | soothe, clarity | 8 | |
| t_staff_rumble | t_club_rumble | 地鳴りの杖 | 7 | wave | 11 | magic、敵全体 1.25 土＋気絶 |
| t_staff_drain | 同じ | 生気吸い | 8 | seal, wave | 11 | |
| t_staff_oracle | 同じ | 天啓の杖 | 9 | wave, drain | 15 | |
| t_staff_prayer | 同じ | 千年の祈り | 10 | aegis, oracle | 20 | |

**消す技（13）とセーブの置き換え先**: t_katana_fold→t_sword_twin、t_katana_riposte→t_sword_guard、t_katana_steel→t_sword_thrust、t_katana_leaves→t_sword_triple、t_katana_dash→t_sword_wheel、t_fist_palm→t_axe_cleave、t_fist_onetwo→t_axe_woodcut、t_fist_wolves→t_dagger_dance、t_fist_eightfold→t_dagger_dance、t_fist_empty→t_axe_giant、t_whip_sweep→t_spear_skewer、t_whip_snatch→t_dagger_filch、t_club_upheaval→t_axe_giant。

- 合計 108（lv1〜9 が 101、lv10 が 7）。各系統の lv の数: 各ティアの普通の戦闘で、どの系統にも新しい候補が 1 つ以上開く（lv1〜10 がすべての系統にある）。
- 入門技（starterKit.tech）: sword `t_sword_stepcut`・greatsword `t_greatsword_overhead`・dagger `t_dagger_vital`・axe `t_axe_cleave`・spear `t_spear_upthrust`・bow `t_bow_rapid`・staff `t_staff_mind`。
- `weapontypes.js` の `sortTechs` はそのまま（系統の順 → lv の順）。

### 3.5 仲間 20 人・主人公の得手不得手（担当 NEWGAME、`companions.js`・`herotypes.js`）
- `A(w, e)` の武器の文字列は **7 文字** `[sword greatsword dagger axe spear bow staff]`。機械的な規則: 剣 = max(剣, 刀)、斧 = max(斧, 棍棒)、ロウガの体術→斧、ザフィラの鞭→短剣、ほかの体術・鞭は捨てる。属性の文字は変えない。
- validate の新しい規則: 武器 7 つの合計（S4〜D0）**10〜13**、属性 8〜12（旧のまま）、合計 27 の規則は削除。各系統で S か A の仲間が 3 人以上（下の表で 剣 4・大剣 3・短剣 4・斧 5・槍 3・弓 3・杖 4）。

| id | 旧 11（sw gs dg ax sp bw cl st kt fs wh） | **新 7（sw gs dg ax sp bw st）** | 合計 | 属性（旧のまま） | 得意な武器（酒場の表示） |
|---|---|---|---|---|---|
| selma | S A C B B D B D B C D | **S A C B B D D** | 12 | BBCBAD | 剣 |
| hagen | B S C A C C B D C B D | **B S C A C C D** | 12 | ACCBCB | 大剣 |
| dokka | B B D S B D A C D B C | **B B D S B D C** | 11 | ACDACB | 斧 |
| basil | B B D B B D S B D A D | **B B D S B D B** | 12 | CBCBAC | 斧（旧 棍棒） |
| bartolo | B A C B A C B C C C D | **B A C B A C C** | 13 | BBCBAD | 大剣・槍 |
| viola | S C C C B C C B A D C | **S C C C B C B** | 12 | ACACCC | 剣 |
| shigure | A C B D B C D C S B C | **S C B D B C C** | 11 | CABCBC | 剣（旧 刀） |
| rouga | C D C C B D A B A S C | **A D C S B D B** | 12 | ACBCCC | 斧（旧 体術・棍棒） |
| titta | B D S D C B C C C B A | **B D S C C B C** | 11 | CBBCCA | 短剣 |
| brigitta | B C B C S A C D C D B | **B C B C S A D** | 13 | CABBBD | 槍 |
| sylvain | C D B B B S D B C C B | **C D B B B S B** | 13 | DBABBC | 弓 |
| zafira | B D B D C B C C C A S | **B D S C C B C** | 11 | BCADCA | 短剣（旧 鞭） |
| ferno | B D A D B B C B C C B | **B D A C B B B** | 12 | CAACBC | — |
| belladonna | B D A C C A C B D C B | **B D A C C A B** | 12 | CACACB | — |
| boden | B B C A B D B B D C D | **B B C A B D B** | 12 | BBDSBB | 斧 |
| teo | B D B D C B C A C C B | **B D B C C B A** | 11 | SCCACB | 杖 |
| ilse | B D B D B B C A C D B | **B D B C B B A** | 12 | CBSCCA | 杖 |
| morga | C D B C C C B A C D A | **C D B B C B A**（機械的には C D B B C C A＝10。弓 C→B に上げて 11） | 11 | BBBBDS | 杖 |
| marta | C D B D B B B A D C B | **C D B B B B A** | 12 | CSBBAD | 杖 |
| noela | B D B D A B B B C D C | **B D B B A B B** | 13 | CBBASD | 槍 |
| 主人公 warrior | B B C B B C B D B B C | **B B C B B C D** | 10（＋得意 S） | BCCBCC | 選べる: 剣・大剣・斧・槍 |
| 主人公 ranger | C D B C B B C C B B B | **B D B C B B C** | 10 | CCACCB | 選べる: 短剣・槍・弓 |
| 主人公 mage | B D B D C B B A C C B | **B D B B C B A** | 12 | CCCCCC | 属性 |
| 主人公 spellblade | B C B C B C C B B D C | **B C B C B C B** | 11 | BCBCBC | 選べる: 剣・大剣・槍・杖（属性も） |
| 主人公 wanderer | B C B C B B C C C C C | **B C B C B B C** | 11 | CBBCBC | 選べる: 7 系統すべて（属性も） |

初期装備・技（validate の「技の系統の武器を持つ」を満たす）:
| id | 旧 | 新 |
|---|---|---|
| dokka | w_axe_hand, w_club_wood, 盾 / t_axe_cleave | w_axe_hand, **w_axe_cudgel**, 盾 / t_axe_cleave |
| basil | w_club_wood, w_fist_leather, 盾 / t_club_smash, s_light_1 | **w_axe_cudgel**, 武器2なし, 盾 / **t_axe_crumble**, s_light_1 |
| viola | w_sword_iron, w_katana_uchi, 盾 | w_sword_iron, **w_sword_uchi**, 盾 |
| shigure | w_katana_uchi / t_katana_draw | **w_sword_uchi** / **t_sword_draw** |
| rouga | w_fist_leather, w_club_wood / t_fist_palm | **w_axe_cudgel**, 武器2なし / **t_axe_cleave** |
| titta | w_dagger_iron, w_whip_leather, 盾 | w_dagger_iron, 武器2なし, 盾 |
| zafira | w_whip_leather, w_dagger_iron, 盾 / t_whip_trip / row middle | **w_dagger_iron**, 武器2なし, 盾 / **t_dagger_numb** / **row front** |
| teo・ilse・morga・marta | w_staff_novice, w_whip_leather, sh_primer | w_staff_novice, 武器2なし, sh_primer（杖が後列から届く） |
- 文（表示はされないが直す）: basil のプロフィール「祈りと棍棒で」→「祈りと槌で」、titta「短剣と鞭で」→「短剣ひとつで」、zafira「鞭さばきも舞のうち」→「短剣さばきも舞のうち」。rouga の「拳と棍で」は残してよい。
- `herotypes.js`: `favorOptions`（上の表）、`starterKit.weapon`・`tech` を 7 系統に、`favorDesc` の club・katana・fist・whip を消し、sword「片手持ち。盾と合わせて攻守に強い。」、axe「一撃が重い。打撃の槌もある。」、staff「術の威力を高め、後列からも届く。」（1 行 20 字以内）。
- `charcreate.js`（NEWGAME）: `W`・`WN` を 7 系統、`REACH_ANY = {spear, bow, staff}`、`ICON_ALT` から club・fist・whip を消す、29〜30 行の初期の品の名前の表から w_club_wood・w_katana_uchi・w_fist_leather・w_whip_leather を消す。
- 酒場の「得意な武器」の表示は apt から出るので、データが直れば直る（tavern.js の変更は不要。あれば NEWGAME）。

### 3.6 戦闘の絵（担当 ART、`src/art/battlers*.js`）
- `A.battlerWtype(c, slot)` は **品の `art` があればそれ、なければ `wtype`**（`FAMILY[art]` にある形）を返す。武器が無ければ `'fist'`。
- 形の対応（`FAMILY`・`battlers_pose.js STYLE`・`battlers_weapons.js SHAPES`）: sword／katana（`art:'katana'` の剣）→ 'one'、axe／club（`art:'club'` の斧）→ 'one'、fist（素手）→ 'fist'。**whip の形はどの品からも使われなくなる**（コードは消してよい。消さなくてもよい）。
- 絵のキー `btl:<look>:<形>[:grade]` は形の名前のままなので、刀の剣は `btl:…:katana`、メイスは `btl:…:club` のまま（シートの作り直しは不要）。`tools/sheet_battlers.js`（QA）で ザフィラ（短剣）・バジル／ロウガ／ドッカ（club の形）・シグレ（katana の形）を撮り直して確認。
- `battle_scene.js` の `FAMILY`（BATTLE）: `{sword:'slash', greatsword:'slash', dagger:'thrust', axe:'smash', spear:'thrust', bow:'shoot', staff:'smash', fist:'punch', katana:'slash', club:'smash'}`（katana・club は絵の形のキーとして残す）。`battle.js` の `WEAPON_FX` と 128 行付近の系統の表も 7 系統＋fist に。

### 3.7 文と説明（担当は各ファイル）
| 場所 | 旧 | 新 |
|---|---|---|
| src/events/prologue.js 49 行（UI） | 槍・弓・鞭の\nほかは、前まで届かんぞ。 | 槍・弓・杖の\nほかは、前まで届かんぞ。 |
| weapontypes.js の desc（TECHS） | 11 系統 | §3.1 の 7 つ |
| items_weapons.js の `LOCAL_WT_DESC`・`LK.WTYPE`・`TWO_HANDED`（WEAPONS） | 11 系統 | 7 系統（fist は素手用に `{mult:0.9}` を残してよい） |
| items_weapons_monster.js の文の作り方（126〜142 行、WEAPONS） | wpPct・wpRegen・wpCostPct | 消して `techCostPct` を足す |
| rules.js `describe`・`autoDesc`（RULES） | WP の行 | §2.5 の文。`techCostPct` の行を足す |
| 各品の desc の WP | §2.5 の表 | 同表 |
| 道具の並びのコメント（items_use.js・shops.js） | MP・WP | MP |
- 魔物の説明の「刀」「棍棒」（monsters_isles・marsh・mine）は魔物自身の持ち物なので変えない。

### 3.8 系統のキーを持つほかの品（担当 GEAR）
| id | 旧 | 新 |
|---|---|---|
| ac_badge_katana / ac_badge_club / ac_badge_fist / ac_badge_whip | profPct 刀・棍棒・体術・鞭 | **削除**（セーブは ac_badge_sword / ac_badge_axe / ac_badge_axe / ac_badge_dagger） |
| hn_sr_poisonfrog（items_armor_monster.js 357〜360 行） | glimPct {whip:20}、コメント glim:whip20 | glimPct {dagger:20}、desc の系統名も短剣に |
| ac_*（items_acc_monster.js 194〜196 行） | glimPct {dagger:20} | そのまま |

### 3.9 古いセーブの直し方（担当 RULES、`src/data/remap_a19.js` 新規 ＋ `state.js`）
`remap_a19.js`（読み込み時に登録するだけ。コードは書かない）:
```js
R.DB.remap = { rev: 19,
  items: { /* §3.2 の「旧 id → 新 id」全部（残す品の改名と、消す品の置き換え先）＋
            ac_badge_katana:'ac_badge_sword', ac_badge_club:'ac_badge_axe', ac_badge_fist:'ac_badge_axe', ac_badge_whip:'ac_badge_dagger',
            i_tonic:'i_ether', i_seed_wp:'i_seed_mp' */ },
  actions: { /* §3.4 の「元 → 新 id」全部と、消す技 13 の置き換え先 */ },
  wtypes: { katana: 'sword', club: 'axe', fist: 'axe', whip: 'dagger' },   // 点数の max でまとめる先
  favor: { katana: 'sword', club: 'axe', fist: 'axe', whip: 'dagger' },    // 主人公の得意分野（型が選べない時は §下）
};
```
`deserialize` で、`g.rev < 19` のときだけ（ids の削除の**前**に）:
1. `g.inv`: 各 id を `remap.items` で置き換え、個数を足して 99 で止める（あふれた分は捨てる）。
2. 全員の `equip` の各枠を置き換え（その後の `repairChar` が、両手持ちになった品の横の盾を持ち物に戻す — 鞭 → 弓・槍の品）。
3. `c.techs`・`c.spells`: 置き換えて重複を除く。`c.mem.list`（系統ごとのカーソル）は空にする。
4. `g.book.tech`: キーを置き換え、覚えた人の一覧を合わせる。
5. 熟練度: §1.5（武器は点数 max で移す、属性は ×2.5）。
6. 主人公の `favor`（kind weapon）: `remap.favor` で置き換え、その型の `favorOptions.weapon` に無ければ一覧の先頭（ranger で fist → axe が無いので dagger）。
7. WP: §2.8。
8. `g.rev = 19`。新しいゲームの `template()` は最初から `rev: 19`。

---------------------------------------------------------------------------------------------------
## 4. 担当の分け方・順番・確かめ方

### 4.1 担当ファイル（重ならない）
| 担当 | ファイル（これ以外は触らない） | 主な仕事 |
|---|---|---|
| **RULES** | src/systems/rules.js・glimmer.js・party.js・state.js、src/data/remap_a19.js（新規） | §1.2〜1.5 の K と `profRank`・`train`・`profPowerMul`・`profMpBase`、`TECH_PROF` の関門、`WTYPES`/`MAXES`/`UNARMED`、`mpCost`（技と術）・`techCostPct` の上限・`wpCost` の削除、`fillItem` の `mult`、`describe`/`autoDesc` の文、`afterBattle` の MP 12%、セーブの移行（§2.8・§3.9）、`K.MON_HP_PROF` の再調整（§4.3 の後） |
| **BATTLE** | src/systems/battle.js・battle_ai.js・battle_fx.js・battle_scene.js | WP の削除（支払い・回復・regen・結果の数字・simulate の戻り値 `partyWpPct` `wpUsed` `wpUsedBy` の削除）、技の支払いを `mpCost` に、`techCostPct`、`ally_other`（既存）の確認、`FAMILY`・`WEAPON_FX`・系統の控えの表、ステータス窓（§2.7）、オート（§2.6） |
| **UI** | src/systems/menu.js・menu_status.js・menu_items.js・menu_book.js・menu_equip.js・shop.js・events_runtime.js・debug.js、src/events/prologue.js（1 行） | §2.7 の表（戦闘以外）、`WTYPES_DEFAULT`・`WTYPE_NAMES`・`ICON_ALT` を 7 系統に |
| **TECHS** | src/data/weapontypes.js、techs_{sword,greatsword,dagger,axe,spear,bow,staff}.js、techs_{katana,club,fist,whip}.js の削除、spells_single.js・spells_pair.js・spells_triple.js | §3.1 の系統データ、§3.4 の 108 技、術の `glim.prof`（§1.4）、`s_fire_light_b`・`healWp` の削除 |
| **WEAPONS** | src/data/items_weapons.js・items_weapons_rare.js・items_weapons_monster.js・items_weapons_super.js、src/data/shops.js・pools.js・rare.js、src/data/monsters_*.js（`drops` の id だけ） | §3.2・§3.3、`w_axe_r9m` のクセ、`i_tonic`・`i_seed_wp` の店・宝箱からの削除 |
| **GEAR** | src/data/items_use.js・items_acc.js・items_acc_monster.js・items_acc_rare.js・items_acc_relic.js・items_acc_reward.js・items_acc_super.js・items_armor.js・items_armor_monster.js・items_armor_rare.js・items_armor_super.js | §2.5 の表、腕章 4 つの削除、§3.8、BUILDS の `w_dagger_sr_silk` |
| **NEWGAME** | src/data/companions.js・herotypes.js、src/systems/charcreate.js・tavern.js | §2.3・§3.5 |
| **ART** | src/art/battlers.js・battlers_pose.js・battlers_weapons.js | §3.6 |
| **QA** | tools/**（validate・test_*・check_*・sim_*・lib/party_model.js・fixtures）、debug_*.html | §4.3 |

約束（並列の間、互いのファイルを待たずに書けるように）:
- データの項目名: 技は `mp`（`wp` なし）、品は `mult` `kind` `art` `icon` `hit` `crit`、mods は `techCostPct` `mpRegen` `mpCostPct`、効果 `healMp`（`healWp` なし）、`grow` は `hp|mp`。
- `R.Rules` の公開: `WTYPES`（7）、`UNARMED`（'fist'）、`MAXES`（hp mp）、`mpCost(c,id)`（技と術）、`profRank(pts)`（1〜100）、`K.PROF_PTS`（101 要素）、`K.TECH_PROF`、`K.PROF_SOFT`、`K.PROF_TRACK`、`K.PROF_POWER {max, exp}`、`K.PROF_MP {freeRank:14, freeStep:1, halfRank:32, halfStep:2}`、`profPowerMul`（式だけ変わる）。`wpCost` は無い。
- 戦闘の出来事: `{t:'heal', u, n, mp}`（`wp` なし）。`Battle.simulate` の戻り値に `wp*` は無い。

### 4.2 順番
1. **第 1 段（並列）**: RULES・BATTLE・UI・TECHS・WEAPONS・GEAR・NEWGAME・ART が §4.1 のとおり同時に書く。各自 `node tools/build.js` が通り、自分のファイルに関わる `R.loadErrors` が無いことまで。
2. **第 2 段（QA、統合）**: `node tools/validate.js` と全テストを新しい仕様に合わせて直し、壊れた所を各担当に戻す（直すのはそのファイルの担当）。
3. **第 3 段（調整）**: §4.3 の sim を回し、外れたら **RULES の K（`PROF_GAIN` の術、`AFTER.mpPct`、`MON_HP_PROF.perLv`、`PROF_SOFT`）→ TECHS の技の MP・威力 → 最後に敵** の順で直す。
4. **第 4 段（リード）**: DESIGN.md に反映（§4.2.2 HP/MP、§4.3.4 系統の表、§4.9 熟練度と閃き、§4.12 回復、§4.13 オート、§4.16 mods、§4.17 検査、§4.18.1 定数、§5.1〜5.3 仲間・主人公、§6 技の章ぜんぶ（121 → 108）、§7.1 術の glim.prof、§8 の武器・品の表・店・宝箱、§11 の画面、§12 の検査）。BRIEF B5・B6 の「11 系統・WP・技 110」も注記。URL の再公開はオーナーの指示があるまでしない（A17）。

### 4.3 確かめること（QA）
**データ・テスト**
- `node tools/validate.js`: `C.WTYPES`（7）、`C.REACH = ['spear','bow','staff']`、`C.TWO_HANDED = ['greatsword','spear','bow']`、`C.TECH_MP`（§2.2）、`weaponTypes` が 7 つの順、技の id 規則、仲間の文字の新しい規則（§3.5）と成長の hp＋mp 4〜6、`grow` は hp|mp、`glim.prof` の範囲（1〜34）、`techCostPct` の値の範囲（mods の表）、`WEAPON_FIELDS` に `mult` `kind` `art`、同じ超レアは 1 種の魔物だけ（H2）、`mdrop` の品は魔物の rare 枠にある。WP の語が品・技・術の desc に残っていないこと（`/WP/` の検索 0 件）。
- 直すテスト（WP・系統・id・段階を見ているもの）: test_rules, test_techs, test_weapons, test_gear, test_gear-b, test_newgame, test_battle, test_battlers, test_bui, test_menu, test_spells, test_boss, test_qa, test_field, test_art-chars、check_battle, check_boss, check_bui, check_gear-b, check_newgame, check_prologue, check_rules, check_spells, check_techs, check_weapons、smoke.js・shots.js・sheet_battlers.js・sheet_bosses.js、fixtures（battle, boss, bui, gear-b, menu, mons-base, newgame, qa, rules, spells/harness, techs, weapons）。
- 新しく足すテスト（test_rules）: `PROF_PTS` の 100 段が §1.2 の表と一致、`profRank(0)=1`・`profRank(2490)=100`、威力の早見（§1.4）、目安線 ×0.3、`TECH_PROF`、`mpCost`（技 = round(旧 wp×1.5)、`techCostPct −15/+50`、上限 −50）、セーブの移行（§3.9 の 8 つ。刀・鞭・体術の持ち物と装備、消えた技、属性 ×2.5、WP → MP）。

**シミュレーター（目標）**
| sim | 項目 | 合格 |
|---|---|---|
| sim_glimmer | **P1** 序章の終わりの主な武器の段階 | 5〜8（灯台に入る時 2〜5） |
| sim_glimmer | **P2** 本編クリアの段階 | 主な武器（62%）70〜85、1 系統だけ（92%）≤ 90、2 つ目の武器 45〜60 |
| sim_glimmer | **P3** 術師の主属性（クリア時） | 0.75 回/戦の型 45〜65、1.5 回の型 55〜75。1段目の MP 0（段階 14）に届くのは T1〜T2 |
| sim_glimmer | **P4** 100 | 本編の間は誰も 100 にならない。裏 50 戦の後も ≤ 95。1 系統だけで稼ぐと 200〜500 戦で 100 |
| sim_glimmer | G（§4.9.5 の読み替え） | 序章 ≥ 4 回、地方ごと平均 7〜11 回、T1 以降のボス戦で誰かが閃く ≥ 50%、クリア時: 戦士型 20〜26（主な武器の lv1〜9 の技の 75% 以上、2 つ目 6〜11）、術師型 24〜34（杖の技 4〜11）、技の書 35〜50%（lv1〜9 の 101 で数える）、入れ替えた仲間 T4: 30 戦で 5 個・50 戦で 7 個（中央値）、極意: 裏 50 戦の後に 1 人以上（`rank ≥ TECH_PROF[10]`） |
| sim_balance / sim_zones | A1 | 2.3〜3.0 撃 |
| sim_balance / sim_zones | A2 雑魚戦 | 勝率 ≥ 99.5%、平均 **2.5〜3.5 ラウンド**、HP の減り平均 8〜12%（**どのゾーンも 5〜15%**）、**p95 ≤ 20%**、誰か倒れる ≤ 3%、全滅 ≤ 0.1% |
| sim_balance | A3 | 1 戦の MP の使用 ≤ 最大の 12%（技と術の合計）、オートの術師 ≥ 0.75 回/戦 |
| sim_balance / sim_spells | A3b 1 フロア（8〜12 戦、休息の灯なし） | 術師の MP ≥ 30% 残る、**戦士の MP ≥ 20% 残る（新）** |
| sim_bosses | B1 | 勝率 ≥ 85%、中ボス 5〜7・地方ボス 8〜11 ラウンド、倒れる人 ≤ 1.0 |
| sim_balance | B2・B3・B4 | 旧のまま（B2 の組は新しい仲間の文字で作り直す） |
| sim_bosses | C1・C2・C3 | 最終の中ボス 9〜12、ラスボス 2 段で 16〜22 ラウンド・勝率 ≥ 75%、裏ボス レア装備 ≥ 50%・通常品 ≤ 20%（18〜25 ラウンド） |
| sim_spells / sim_balance | D1〜D4 | 旧のまま |
| sim_growth | E1・E2・上限 | 旧のまま＋ Lv99・実を上限まで食べて MP ≤ 250。成長の文字ごとの MP の表を出す |
| sim_loot | H1〜H3 | 旧のまま（新しい id で） |
- 模型（`tools/lib/party_model.js`・`sim_zones.js` の中の控え）: `WTYPES`・系統の表を 7 つに、`WPlv`・`mwp`・`wp` を消し、成長の文字を §2.3 に、技の `mp` を見る。熟練度は **使う武器 = `PROF_TRACK[T]`、2 つ目 = 0.5 倍、選んだ属性 = 0.8 倍**（旧 PEXP(T)）、`techOk` は `TECH_PROF`。`sim_zones` の雑魚戦は MP 60% で始める（WP の行を消す）。
- 失敗したときの直し方の順は §4.2-3。敵のデータ（地方の魔物・ボスの `s`）には、K とプレイヤー側の値で入らないときだけ触る。
