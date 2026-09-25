# 08 魔物（系統・雑魚・出現表・レア魔物・金色・鋼・ボス）— DESIGN.md 用ドラフト

この章は、雑魚の**系統と段**、**敵の行動**、**出現表**、**金色の個体**、**鋼の魔物**、**レア魔物**、**ボス**、**戦利品の id** を決める。
担当は mons（A11: 雑魚・行動・出現表）、boss（A12: ボス・レア魔物・編成）、art-mons（A14: 雑魚の絵と組み立て）、art-boss（A15: ボスとレア魔物の絵）。
ドロップ品の**定義**（数値）は weapons（A9）・gear（A10）が書く。この章は**魔物 id → 品 id と、その品の性格**を先に決める（エンジン章 §7 補足）。

- 01 エンジン章の ID・API、02 成長章の式・数値、03 ワールド章の地方・ゾーン・ボスの編成 id、05 技章・06 術章の行動と状態に合わせてある。変えた所は §0 に理由つきで書いた。
- **この章の表はすべて、1本の node スクリプトのデータから生成し、検算した**（名前の長さ、禁止語、技・術との名前の重なり、出現表の組の大きさと横幅、全種が出現表のどこかに出ること、超レアの一品物、レア品の共有数とティア、弱点の片寄り）。表どうしが食い違ったら、§5 の系統の表と §7 の出現表のデータ（コードブロック）を正とする。
- 画面に出す文（名前・図鑑の説明・行動のメッセージ）はそのまま使える完成文。名前は全角8字まで、図鑑の説明は20字×2行まで（エンジン章 §1.7）。

---------------------------------------------------------------------------------------------------
## 0. 決定の一覧（他章からの具体化と変更。理由つき）

| # | 決定 | 理由 |
|---|---|---|
| 0.1 | **54 系統・雑魚 209 種**（鋼の魔物 6 種を含む）、**レア魔物 23 種**、**ボス 26 編成・34 体**（お供を含む）。魔物の定義は計 266。 | Part A「200種前後、レア20以上、ボス20〜30」。系統の段は 2〜5（鋼と裏は2、通常は3〜5）。 |
| 0.2 | 段の出始めのティア（`DB.lineages[*].stages[].tier`）は **5段 [0,2,4,6,8] / 4段 [0,2,4,6] / 3段 [0,3,6]**（成長章 §14.1 の目安どおり）。虚ろの使いは [2,4,6,8]、鋼は [2,6] [5,7] [8,9]、終盤の系統は [8,…]、裏の系統は [9,…]。 | **第5段はティア8（8地方をすべてクリアしたあと）でしか出ない**。終盤とクリア後に中盤の地方へ戻ると、見たことのない上位種が現れる（図鑑を埋める理由になる）。 |
| 0.3 | 雑魚の出現表は `'@<系統>'` で書く（エンジン章 §0.4）。**固定ティアのゾーン（序章・終盤・裏）だけは段の id を直接書く**。 | 固定ティアでは `@` が常に同じ段になり、下の段を混ぜられないため。 |
| 0.4 | 魔物データは **名目のレベル `lv`・大きさ `size`・能力の倍率 `s`・報酬の倍率 `rw`** を持ち、`hp atk …` の絶対値は **`R.Mon.fillStats` が `R.onData` で埋める**（§1.2）。絶対値を直接書いた項目はそのまま使う。成長章 §14.2 の「データが絶対値を持つ」を変更。 | 曲線の式は `R.Rules.K`（rules.js）の1か所にしかない。データのファイルは読み込み時に他のファイルを読めない（エンジン章 §1.2-2）ので、式を各ファイルに写すと食い違う。onData なら式が1つで済む。 |
| 0.5 | 属性の倍率 `elem`・打撃の倍率 `phys`・状態の耐性 `statusRes` は**最終の値をデータに書く**（§5 の表の値）。種族の既定・親和・飛ぶことからの作り方は §3 に書き、新しい種を足すときだけ使う。 | 実行時に組み立てると、実装ごとに優先順位が食い違う。表の値が正、作り方は検算用。 |
| 0.6 | **絵は全種 `mon:<魔物id>` として art-mons が登録する**。中身は組み立て表 `R.Art.MON_COMPOSE`（元絵・色替え・パーツ・フィルター。§4.6）。**魔物データは `hue/sat/bri` を持たない**（エンジン章 §3.2 の「色違いは魔物データの hue/sat/bri」を変更）。 | パーツは固有の色で描くので、実行時に全体の色相を回すとパーツの色まで変わる。見た目の決まりを1つの表に集めると、絵とデータが別々に進められる。 |
| 0.7 | 「虚ろの使い」（ワールド章 §1.2）は**既存の元絵に紙のフィルター `paper` をかけた系統**（`paper`）。小鬼 → 獣 → 騎士 → 竜 と、段ごとに元絵が変わる。ティア2から全地方に出る。 | 新しい元絵を作らずに「白く紙のように欠けた魔物」が作れ、どの地方にもなじむ。 |
| 0.8 | **新しい元絵は 14**（小 5・中 7・大 2。§4.2）。パーツ 66 種・フィルター 6 種で段を描き分ける（§4.4・§4.5）。 | ブリーフの 12〜16。既存 36 と合わせて 50 の元絵。 |
| 0.9 | **金色の個体は全種に自動で存在する**（鋼・レア魔物・ボス・呼ばれた魔物を除く）。データは作らず、`R.Mon.def(id, {golden:true})` が作る（§8）。 | 成長章 §10.2 のとおり。定義の数を増やさない。 |
| 0.10 | **鋼の魔物は 3 系統 × 2 段 = 6 種**。名前は「白銀の」「鏡の」「白金の」（§9）。鋼にも通る武器（`metalHit:true` の超レア武器 3 本）を用意する。 | 成長章 §10.5。「メタル」「はぐれ」は使わない。 |
| 0.11 | **レア魔物 23 種**（既存の絵 6 ＋ 新しい絵 17）。**1つのゾーンに1種**（26 ゾーンのうち 23）。裏ダンジョンの `rm_dream_tapir`（夢食いバク）は**超レアモンスター**（1/200、行動2回、ドロップ率が高い）。 | ブリーフ「22以上、5既存＋17新」。地方ごとに 2〜3 種いる。 |
| 0.12 | **ボスの絵は、既存の 8 枚を使い（そのまま 3、色替え・フィルター 5）、新しい絵は 16 体**（ほかにお供の小さな絵 2 つ）。お供・楽団などは元絵の組み立てで作る。 | 既存のボス絵（クレスト）を流用しつつ、物語の要のボス（白竜・ラザロ・虚ろの王など）は専用にする。 |
| 0.13 | ボスに **段階の変化 `phases`** と、行動の効果 **`summon`（仲間を呼ぶ）** を足す（§1.6・§11.1）。条件に **`countBelow` `allyDown`** を足す（§1.7）。 | 「HP が半分を切ると弱点が変わる」「お供を先に倒す」などの仕掛けを、データだけで書くため。 |
| 0.14 | **すべての雑魚に 通常・レア・超レア の3枠**。超レアは**その種だけの一品物**（雑魚 209・レア魔物 23・裏ボス 2 = **234 品**）。レア品は同じティアの 3 種までで共有（134 品）。品のティアは「その段の出始めのティア + 1」（§12.1）。 | Part A「超レアはそのモンスターからしか出ない一品物」「図鑑は3枠」。ティアに合った品にすると、どの順番で回っても強すぎない。 |
| 0.15 | **ボスの通常枠（確定）は成長の実**（最大HP・MP・WP の上乗せ。§12.3）。**裏の2体（魔王の残影・円環竜）だけはレア枠・超レア枠を持つ**（成長章 §10.1「ボス: なし」の例外）。 | 本編のボスは1回しか戦わないので、装備より実が合う。裏の2体はワールド章 §12 で再戦でき、「超レアを狙うため」とされている。 |
| 0.16 | 裏ダンジョンのゾーンと裏の編成は **ティア 9 固定**（ワールド章 §13.5 の「8 固定（クリア後の強さ）」を、成長章 §0.11・§14.1 のティア 9 に合わせた）。 | 成長章の数値（裏ボス Lb 68、HP 33389）がティア 9 を前提にしている。 |
| 0.17 | 出現表の戦闘レベルは `Lb = LZ(Tb) + lvOff`。**`lvOff` はゾーンに書き、マップの `lvOff` があればそちらを使う**（ダンジョンの2階以降は地方担当がマップに `lvOff: 2` を書く）。 | 1つのゾーンを複数の階で使うため（成長章 §14.1 の「1階 +1、2階以降 +2」）。 |
| 0.18 | `DB.rareEncounters[zone].rate` は**分母**で書く（`80` = 1/80。ドロップの `rate` と同じ）。 | 確率を分子で書く所と分母で書く所が混ざると事故が起きる。 |
| 0.19 | **呼ばれた魔物**（`summon` で出た魔物）は、経験値とお金は普通にくれるが、**ドロップと金色の抽選をしない**。 | 呼ばせ続けてレアを稼ぐ遊び方を防ぐ。 |

---------------------------------------------------------------------------------------------------
## 1. データの形（normative）

### 1.1 `R.DB.monsters[id]`（担当: 雑魚 A11 `monsters_*.js`、レア魔物・ボス A12 `rare*.js` `bosses*.js`）
| 項目 | 型 | 意味 |
|---|---|---|
| `name` | 文字列 | 全角8字まで。**同じ名前の魔物は作らない**（ボスのロウェル2つだけ例外） |
| `sprite` | 文字列 | `mon:<sprite>` のキー。雑魚は**自分の id と同じ**（§4.6）。レア魔物は `rare_*`、ボスは `boss_*` か組み立ての id |
| `lineage` `stage` | 文字列・数 | 雑魚だけ。系統の id と段（1〜） |
| `lv` | 数 | 名目のレベル。雑魚は `7 + 6 × 出始めのティア`（T9 は 61）。ボス・レア魔物は §11.2・§10.2 |
| `size` | `'s' 'm' 'l'` | 元絵の大きさ（32/48/64 → s/m/l）。ボスは大きさの倍率を使わない（§11.2） |
| `race` | 成長章 §1 の種族 | 図鑑の表示、技の `vs` |
| `affinity` | 属性 か 無し | 親和（図鑑のヒント・AI 用。倍率は `elem` に反映済み） |
| `s` | `{hp, atk, mag, def, mdef, agi}` | 能力の倍率（書かないものは 1）。雑魚は 0.5〜2.0、レア魔物の hp は 2.8〜3.6、鋼の agi は 2.5 |
| `rw` | `{exp, gold}` | 報酬の倍率（書かないものは 1） |
| `hpFixed` | 数 | 鋼の魔物だけ。HP をこの値に固定（伸縮しない） |
| `elem` `phys` `statusRes` | マップ | 最終の値（§3）。書かない属性・種類は 1、状態は 0 |
| `eva` | 数 | 回避（§2.3 の規則で決まる。個別に書いてもよい） |
| `actions` | `[{id, w, cond?}]` | 行動（§6）。`'attack'` は通常攻撃 |
| `actsPerTurn` | 1〜3 | 1ラウンドの行動回数（既定 1） |
| `drops` | `{normal:{item, rate}, rare:{item, rate}, super:{item, rate}}` | rate は分母。ボスは `normal` だけ（裏の2体を除く） |
| `flags` | 配列 | `flying` `metal` `rare` `boss`（金色は戦闘時に付く `golden`、呼ばれた魔物は `summoned`） |
| `fleeRate` | 0〜1 | レア魔物 0.25、鋼 0.5（成長章 §10.3・§10.5） |
| `rankAdd` | 0〜1 | 閃きのランクの上乗せ（夢食いバクだけ 1） |
| `phases` | 配列 | ボスの段階の変化（§11.1） |
| `hpShare` | 数 | 複数体のボス編成で、その体の HP の取り分（§11.2） |
| `bossType` | 文字列 | `prologue mid region rival fmid last1 last2 echo super add`（§11.2） |
| `desc` | 文字列 | 図鑑の説明。20字×2行まで（`\n` で改行） |

### 1.2 `R.Mon.fillStats`（担当 battle A2。`R.onData` で1回だけ実行する）
データに絶対値の無い魔物について、次で `hp atk mag def mdef agi exp gold eva` を埋める（`R.Mon.curve` と `K` は成長章 §14.2・§18.1）。
```
c    = R.Mon.curve(lv)
SIZE = { s:{hp:0.7, atk:0.9, def:0.9, rw:0.7}, m:{hp:1, atk:1, def:1, rw:1}, l:{hp:2.0, atk:1.15, def:1.1, rw:1.8} }   // 成長章 §14.2
hp   = round(c.hp  × SIZE.hp  × s.hp)          // 鋼は hpFixed
atk  = round(c.atk × SIZE.atk × s.atk)         mag  = round(c.mag  × s.mag)
def  = round(c.def × SIZE.def × s.def)         mdef = round(c.mdef × s.mdef)        agi = round(c.agi × s.agi)
exp  = round(c.exp  × SIZE.rw × rw.exp  × KIND.exp  × (race==='dragon' ? 1.2 : 1))
gold = round(c.gold × SIZE.rw × rw.gold × KIND.gold)
KIND: 雑魚 {exp:1, gold:1} / レア魔物 {5, 5} / 鋼 {30, 10} / ボスは §11.2 の表
```
- ボス（`flags` に `boss`）は §11.2 の式で作る（hp は `hpBoss(lv) × hpShare`）。
- 戦闘では `R.Mon.def(id, {tier, golden})` が、成長章 §14.2 のとおり**能力値 × 曲線(Lb)/曲線(lv)** で伸縮する（ボスの hp は hpBoss の比、鋼の hp は伸縮しない）。
- 命中 95、会心（痛恨）2%（ボス 3%）は全員共通（成長章 §6.5）。

### 1.3 `R.DB.lineages`（担当 A11 `lineages.js`。そのまま写してよい）
```js
Object.assign(R.DB.lineages, {
  jelly: { name: 'ゼリー', stages: [{ mon: 'jelly_1', tier: 0 }, { mon: 'jelly_2', tier: 2 }, { mon: 'jelly_3', tier: 4 }, { mon: 'jelly_4', tier: 6 }, { mon: 'jelly_5', tier: 8 }] },
  rat: { name: 'ネズミ', stages: [{ mon: 'rat_1', tier: 0 }, { mon: 'rat_2', tier: 2 }, { mon: 'rat_3', tier: 4 }, { mon: 'rat_4', tier: 6 }] },
  bat: { name: 'コウモリ', stages: [{ mon: 'bat_1', tier: 0 }, { mon: 'bat_2', tier: 2 }, { mon: 'bat_3', tier: 4 }, { mon: 'bat_4', tier: 6 }, { mon: 'bat_5', tier: 8 }] },
  paper: { name: '虚ろの使い', stages: [{ mon: 'paper_1', tier: 2 }, { mon: 'paper_2', tier: 4 }, { mon: 'paper_3', tier: 6 }, { mon: 'paper_4', tier: 8 }] },
  crab: { name: 'カニ', stages: [{ mon: 'crab_1', tier: 0 }, { mon: 'crab_2', tier: 2 }, { mon: 'crab_3', tier: 4 }, { mon: 'crab_4', tier: 6 }] },
  seabird: { name: 'カモメ', stages: [{ mon: 'seabird_1', tier: 0 }, { mon: 'seabird_2', tier: 2 }, { mon: 'seabird_3', tier: 4 }, { mon: 'seabird_4', tier: 6 }] },
  bee: { name: 'ハチ', stages: [{ mon: 'bee_1', tier: 0 }, { mon: 'bee_2', tier: 2 }, { mon: 'bee_3', tier: 4 }, { mon: 'bee_4', tier: 6 }, { mon: 'bee_5', tier: 8 }] },
  mushroom: { name: 'キノコ', stages: [{ mon: 'mushroom_1', tier: 0 }, { mon: 'mushroom_2', tier: 2 }, { mon: 'mushroom_3', tier: 4 }, { mon: 'mushroom_4', tier: 6 }] },
  plant: { name: '人食い花', stages: [{ mon: 'plant_1', tier: 0 }, { mon: 'plant_2', tier: 2 }, { mon: 'plant_3', tier: 4 }, { mon: 'plant_4', tier: 6 }, { mon: 'plant_5', tier: 8 }] },
  fairy: { name: '妖精', stages: [{ mon: 'fairy_1', tier: 0 }, { mon: 'fairy_2', tier: 2 }, { mon: 'fairy_3', tier: 4 }, { mon: 'fairy_4', tier: 6 }] },
  treant: { name: '魔木', stages: [{ mon: 'treant_1', tier: 0 }, { mon: 'treant_2', tier: 2 }, { mon: 'treant_3', tier: 4 }, { mon: 'treant_4', tier: 6 }] },
  scorpion: { name: 'サソリ', stages: [{ mon: 'scorpion_1', tier: 0 }, { mon: 'scorpion_2', tier: 2 }, { mon: 'scorpion_3', tier: 4 }, { mon: 'scorpion_4', tier: 6 }, { mon: 'scorpion_5', tier: 8 }] },
  snake: { name: 'ヘビ', stages: [{ mon: 'snake_1', tier: 0 }, { mon: 'snake_2', tier: 2 }, { mon: 'snake_3', tier: 4 }, { mon: 'snake_4', tier: 6 }] },
  mummy: { name: 'ミイラ', stages: [{ mon: 'mummy_1', tier: 0 }, { mon: 'mummy_2', tier: 2 }, { mon: 'mummy_3', tier: 4 }, { mon: 'mummy_4', tier: 6 }, { mon: 'mummy_5', tier: 8 }] },
  cactus: { name: 'サボテン', stages: [{ mon: 'cactus_1', tier: 0 }, { mon: 'cactus_2', tier: 2 }, { mon: 'cactus_3', tier: 4 }, { mon: 'cactus_4', tier: 6 }] },
  sandworm: { name: 'ミミズ', stages: [{ mon: 'sandworm_1', tier: 0 }, { mon: 'sandworm_2', tier: 3 }, { mon: 'sandworm_3', tier: 6 }] },
  wolf: { name: 'オオカミ', stages: [{ mon: 'wolf_1', tier: 0 }, { mon: 'wolf_2', tier: 2 }, { mon: 'wolf_3', tier: 4 }, { mon: 'wolf_4', tier: 6 }, { mon: 'wolf_5', tier: 8 }] },
  yeti: { name: '雪男', stages: [{ mon: 'yeti_1', tier: 0 }, { mon: 'yeti_2', tier: 3 }, { mon: 'yeti_3', tier: 6 }] },
  frostling: { name: '氷の小鬼', stages: [{ mon: 'frostling_1', tier: 0 }, { mon: 'frostling_2', tier: 2 }, { mon: 'frostling_3', tier: 4 }, { mon: 'frostling_4', tier: 6 }, { mon: 'frostling_5', tier: 8 }] },
  owl: { name: 'フクロウ', stages: [{ mon: 'owl_1', tier: 0 }, { mon: 'owl_2', tier: 2 }, { mon: 'owl_3', tier: 4 }, { mon: 'owl_4', tier: 6 }] },
  mammoth: { name: 'マンモス', stages: [{ mon: 'mammoth_1', tier: 0 }, { mon: 'mammoth_2', tier: 3 }, { mon: 'mammoth_3', tier: 6 }] },
  ghost: { name: '霊', stages: [{ mon: 'ghost_1', tier: 0 }, { mon: 'ghost_2', tier: 2 }, { mon: 'ghost_3', tier: 4 }, { mon: 'ghost_4', tier: 6 }, { mon: 'ghost_5', tier: 8 }] },
  wisp: { name: '鬼火', stages: [{ mon: 'wisp_1', tier: 0 }, { mon: 'wisp_2', tier: 2 }, { mon: 'wisp_3', tier: 4 }, { mon: 'wisp_4', tier: 6 }] },
  frog: { name: 'カエル', stages: [{ mon: 'frog_1', tier: 0 }, { mon: 'frog_2', tier: 2 }, { mon: 'frog_3', tier: 4 }, { mon: 'frog_4', tier: 6 }] },
  doll: { name: '人形', stages: [{ mon: 'doll_1', tier: 0 }, { mon: 'doll_2', tier: 2 }, { mon: 'doll_3', tier: 4 }, { mon: 'doll_4', tier: 6 }] },
  lizardman: { name: 'トカゲ兵', stages: [{ mon: 'lizardman_1', tier: 0 }, { mon: 'lizardman_2', tier: 2 }, { mon: 'lizardman_3', tier: 4 }, { mon: 'lizardman_4', tier: 6 }] },
  spider: { name: 'クモ', stages: [{ mon: 'spider_1', tier: 0 }, { mon: 'spider_2', tier: 2 }, { mon: 'spider_3', tier: 4 }, { mon: 'spider_4', tier: 6 }] },
  merman: { name: '魚人', stages: [{ mon: 'merman_1', tier: 0 }, { mon: 'merman_2', tier: 2 }, { mon: 'merman_3', tier: 4 }, { mon: 'merman_4', tier: 6 }] },
  kraken: { name: 'タコ', stages: [{ mon: 'kraken_1', tier: 0 }, { mon: 'kraken_2', tier: 3 }, { mon: 'kraken_3', tier: 6 }] },
  skeleton: { name: '骸骨', stages: [{ mon: 'skeleton_1', tier: 0 }, { mon: 'skeleton_2', tier: 2 }, { mon: 'skeleton_3', tier: 4 }, { mon: 'skeleton_4', tier: 6 }, { mon: 'skeleton_5', tier: 8 }] },
  golem: { name: '石くれ兵', stages: [{ mon: 'golem_1', tier: 0 }, { mon: 'golem_2', tier: 3 }, { mon: 'golem_3', tier: 6 }] },
  mole: { name: 'モグラ', stages: [{ mon: 'mole_1', tier: 0 }, { mon: 'mole_2', tier: 2 }, { mon: 'mole_3', tier: 4 }, { mon: 'mole_4', tier: 6 }] },
  beetle: { name: 'カブト', stages: [{ mon: 'beetle_1', tier: 0 }, { mon: 'beetle_2', tier: 2 }, { mon: 'beetle_3', tier: 4 }, { mon: 'beetle_4', tier: 6 }] },
  crystal: { name: '水晶', stages: [{ mon: 'crystal_1', tier: 0 }, { mon: 'crystal_2', tier: 2 }, { mon: 'crystal_3', tier: 4 }, { mon: 'crystal_4', tier: 6 }] },
  goblin: { name: '小鬼', stages: [{ mon: 'goblin_1', tier: 0 }, { mon: 'goblin_2', tier: 2 }, { mon: 'goblin_3', tier: 4 }, { mon: 'goblin_4', tier: 6 }, { mon: 'goblin_5', tier: 8 }] },
  salamander: { name: '火トカゲ', stages: [{ mon: 'salamander_1', tier: 0 }, { mon: 'salamander_2', tier: 2 }, { mon: 'salamander_3', tier: 4 }, { mon: 'salamander_4', tier: 6 }, { mon: 'salamander_5', tier: 8 }] },
  imp: { name: '悪魔', stages: [{ mon: 'imp_1', tier: 0 }, { mon: 'imp_2', tier: 2 }, { mon: 'imp_3', tier: 4 }, { mon: 'imp_4', tier: 6 }, { mon: 'imp_5', tier: 8 }] },
  gargoyle: { name: '石像鬼', stages: [{ mon: 'gargoyle_1', tier: 0 }, { mon: 'gargoyle_2', tier: 2 }, { mon: 'gargoyle_3', tier: 4 }, { mon: 'gargoyle_4', tier: 6 }] },
  orc: { name: '大鬼', stages: [{ mon: 'orc_1', tier: 0 }, { mon: 'orc_2', tier: 3 }, { mon: 'orc_3', tier: 6 }] },
  chimera: { name: '三頭獣', stages: [{ mon: 'chimera_1', tier: 0 }, { mon: 'chimera_2', tier: 3 }, { mon: 'chimera_3', tier: 6 }] },
  eyeball: { name: '目玉', stages: [{ mon: 'eyeball_1', tier: 0 }, { mon: 'eyeball_2', tier: 2 }, { mon: 'eyeball_3', tier: 4 }, { mon: 'eyeball_4', tier: 6 }, { mon: 'eyeball_5', tier: 8 }] },
  darkmage: { name: '魔術師', stages: [{ mon: 'darkmage_1', tier: 0 }, { mon: 'darkmage_2', tier: 2 }, { mon: 'darkmage_3', tier: 4 }, { mon: 'darkmage_4', tier: 6 }] },
  automaton: { name: 'からくり', stages: [{ mon: 'automaton_1', tier: 0 }, { mon: 'automaton_2', tier: 2 }, { mon: 'automaton_3', tier: 4 }, { mon: 'automaton_4', tier: 6 }] },
  armor: { name: '鎧', stages: [{ mon: 'armor_1', tier: 0 }, { mon: 'armor_2', tier: 2 }, { mon: 'armor_3', tier: 4 }, { mon: 'armor_4', tier: 6 }] },
  wyvern: { name: '飛竜', stages: [{ mon: 'wyvern_1', tier: 0 }, { mon: 'wyvern_2', tier: 3 }, { mon: 'wyvern_3', tier: 6 }] },
  scribe: { name: '白衣の書記', stages: [{ mon: 'scribe_1', tier: 8 }, { mon: 'scribe_2', tier: 8 }, { mon: 'scribe_3', tier: 8 }] },
  book: { name: '魔書', stages: [{ mon: 'book_1', tier: 8 }, { mon: 'book_2', tier: 8 }, { mon: 'book_3', tier: 8 }] },
  mimic: { name: '宝箱', stages: [{ mon: 'mimic_1', tier: 0 }, { mon: 'mimic_2', tier: 2 }, { mon: 'mimic_3', tier: 4 }, { mon: 'mimic_4', tier: 6 }] },
  void: { name: '虚無の騎士', stages: [{ mon: 'void_1', tier: 9 }, { mon: 'void_2', tier: 9 }] },
  chaos: { name: '混沌獣', stages: [{ mon: 'chaos_1', tier: 9 }, { mon: 'chaos_2', tier: 9 }] },
  demon: { name: '魔神', stages: [{ mon: 'demon_1', tier: 8 }, { mon: 'demon_2', tier: 9 }, { mon: 'demon_3', tier: 9 }] },
  quicksilver: { name: '白銀のしずく', stages: [{ mon: 'quicksilver_1', tier: 2 }, { mon: 'quicksilver_2', tier: 6 }] },
  mirror: { name: '鏡の甲虫', stages: [{ mon: 'mirror_1', tier: 5 }, { mon: 'mirror_2', tier: 7 }] },
  platinum: { name: '白金の灯', stages: [{ mon: 'platinum_1', tier: 8 }, { mon: 'platinum_2', tier: 9 }] },
});
```
- `R.Mon.resolve('@<系統>', T)` は、`tier ≤ T` の段のうち最後のもの。どの段も当てはまらなければ `null`（その組は出さない）。

### 1.4 `R.DB.encounters[zone]` と `R.DB.rareEncounters[zone]`（担当 A11・A12）
```js
encounters[zone] = {
  region,                     // ワールド章の地方 id か 'prologue' 'finale' 'postgame'
  tier: 'dyn' | 0..9,          // 'dyn' = R.Game.tier（中盤の8地方）
  lv: [min, max],             // 序章のゾーンだけ。戦闘レベルを直接決める（戦闘ごとに一様に選ぶ）
  lvOff: n,                   // それ以外。Lb = LZ(Tb) + (map.lvOff ?? lvOff)
  bg: 'bbg id' | null,        // null はフィールドの地形の背景
  groups: [{ w, mons: [[ref, min, max], …], tierMin?, tierMax?, solo? }],
}
rareEncounters[zone] = { mon: 'rm_…', rate: 80 }   // rate は分母（§0.18）。成長章 §10.3 の補正をかける
```
- 1つの組は **3種まで・8体まで・横幅 256px まで**（小 32・中 48・大 64 を最大数で足す）。`solo:true` は「1体だけで出る特別な組」（宝箱もどき）で、シミュレーターの平均から外す印（戦闘は普通に扱う）。
- 組の強さ: 標準の魔物に直して（小 0.7・中 1・大 1.8）**平均 3.0〜3.4 体分**（成長章 §14.2 の 2.5〜4.5・平均 3.3）。序章は主人公1人でも勝てるよう 1〜2 体分。§7 の表は全ゾーン・全ティアで検算済み。

### 1.5 `R.DB.troops[id]`（担当 A12 `troops.js`）
```js
troops[id] = { mons: [[monId | '@系統', n], …],   // 左から並べる順
               scale: 'tier' | undefined,        // 'tier' = R.Game.tier（中盤の地方ボス）
               tier: n,                          // 固定のティア（序章 0・ライバル 2/5・終盤 8・裏 9）
               lv: n,                            // 序章のボスだけ。Lb を直接決める
               lvOff: n,                         // Lb = LZ(T) + lvOff
               bg, bgm, noEscape: true }
```
- 編成の中の `'@系統'`（お供の雑魚）は、その戦闘のティアで段を選び、同じ Lb で伸縮する。

### 1.6 行動 `R.DB.actions['e_…' | 'eb_…']`（担当 A11 `enemy_actions.js`、A12 `bosses_actions.js`）
```js
{ name, kind: 'enemy', target, effects: [ … ], fx, msg, aim?, elements? }
```
- `target`: `enemy enemies random self ally allies ally_dead`（クレストと同じ）。魔物の `ally` は **HP の割合が一番低い仲間**、`ally_dead` は倒れた仲間（逃げた者は除く）を選ぶ。
- `aim`（成長章 §5.3）: `'middle'`（中列の重み 3）。術師や弓の魔物に付けた。
- 効果の型（成長章 §6、術章 §3.3、技章 §2.3 の定義のまま使う）:
  - `damage`: `formula:'phys'|'magic'|'breath'`、`power`、`hits?`、`element?`（その発の属性。無ければ行動の `elements` の中で相手に一番効くもの）、`kind?`（斬打突）、`acc?`、`critBonus?`、`drain?`、`vs?`、**`mp:true`**（HP ではなく MP を減らす。`drain` があれば、減らした MP と同じ量だけ**使った魔物の HP を回復**する。魔物は MP を持たないため）
  - `status`（悪い状態は `chance` つき、良い状態は必ず）、`buff`、`heal`（`pct`）、`revive`（`pct`）、`dispel`（`side:'good'`）
  - **`summon`（新）**: `{type:'summon', mon, n, max}`。`mon` は `'same'`（同じ種）・`'lower'`（同じ系統の1段下。1段目なら同じ種）・魔物 id・`'@系統'`。戦闘の Lb で作り、右端に足す。生きている魔物が `max` 体以上、または合わせて 8 体になるときは何もしない（「しかし、誰も来なかった。」）。呼ばれた魔物には `summoned` の旗が付く（§0.19）。
  - **`on:'self'`**（術章 §3.4-3 の `on` と同じ仕組み）: その効果だけ、対象のくり返しの後で使った本人にかける（`eb_rewind` で使用）。
- 敵の行動は閃きの対象にならない（`glim` を持たない）。`s_` の術は使わない（術章 §0.13）。
- 状態異常の強さの上限（成長章 §14.3 を雑魚にも当てはめた。検算済み）: **全体への状態異常は 30% まで**、単体は 60% まで、**即死は単体だけで 12% まで**。

### 1.7 行動の条件 `cond`（担当 battle A2 `battle_ai.js`）
クレストの `hpBelow hpAbove every once round alone` に 2 つ足す。1つのオブジェクトに複数書くと、すべてを満たすときに真。
| キー | 真になる条件 |
|---|---|
| `hpBelow: x` / `hpAbove: x` | 自分の HP の割合が x より下 / 上 |
| `every: [n, k]` | 自分の行動回数 `acts % n === k`（`acts` は戦闘の最初から数えた自分の行動の数。1ラウンドに2回動く魔物は2つ進む） |
| `once: true` | その行動をまだ使っていない |
| `round: n` | ラウンド n 以降 |
| **`countBelow: n`（新）** | 自分の側の生きている魔物が n 体より少ない（仲間を呼ぶ行動に使う） |
| **`allyDown: true`（新）** | 自分の側に倒れた魔物がいる（蘇生の行動に使う） |
- 条件を満たす行動の中から重み `w` で選ぶ。選んだ行動に対象がいなければ、その行動を外して選び直す（クレストと同じ）。

---------------------------------------------------------------------------------------------------
## 2. 能力値の決め方

### 2.1 名目のレベルと伸縮
- 雑魚の `lv` は `7 + 6 × 出始めのティア`（T0 = 7、T2 = 19、T4 = 31、T6 = 43、T8 = 55、T9 = 61）。戦闘ではその戦闘の Lb に伸縮するので、`lv` は図鑑に出す目安と、呼ばれたときの基準にしか使わない。
- **同じ段が2つのティアにまたがって出ても、強さはティアに合う**（成長章 §0.8）。段の違いは見た目・属性・行動の違い。

### 2.2 能力の倍率 `s` の型（新しい種を足すときの目安。§5 の値が正）
| 型 | 目安 | 例 |
|---|---|---|
| 標準 | すべて 1 | 灰色オオカミ |
| すばやい | hp 0.85〜0.9、agi 1.3〜1.4 | 花バチ、小コウモリ |
| 固い | hp 1.2〜1.4、def 1.3〜1.8、agi 0.6〜0.8 | 鉄甲ガニ、金剛カブト |
| 力持ち | hp 1.15〜1.35、atk 1.15〜1.25、agi 0.8 | 大鬼、雪男 |
| 術師 | hp 0.9、atk 0.75〜0.8、mag 1.25〜1.4、mdef 1.2〜1.3 | 魔術師、呪術師 |
| 長 | hp 1.3〜1.5、ほかを 1.1〜1.25（系統の最後の段） | 女王バチ、冬将軍 |
- 1つのゾーンの組の平均が「標準の魔物 3.0〜3.4 体分」に入るように、固い種・長の種は少なめの数で出す（§7）。

### 2.3 回避・命中・報酬の規則
- 回避 `eva`: 既定 5。`flying` の種は 12。`s.agi ≥ 1.3` の種は 15。鋼は 30。レア魔物は 15（飛ぶものは 20）。ボスは 5（飛ぶものは 10）。
- 経験値・お金: §1.2 の式。種ごとの `rw`（お金が多い小鬼 ×1.3、宝箱もどき ×3、ぬすみカモメ ×2 など）は §5 の表の「能力 s」の欄に書いた。
- 閃きのランク（成長章 §9.2）: 雑魚 Tb+1、金色 +1、レア魔物 +2、鋼 +1、ボス +2。夢食いバクは `rankAdd:1`。

---------------------------------------------------------------------------------------------------
## 3. 属性・打撃・状態の耐性

### 3.1 作り方（新しい種を足すときの規則。§5 の表はこの規則で作った最終の値）
1. 種族の既定（成長章 §7.3）から始める。
2. `flying` の種は **風 1.5・土 0.5**。鳥・獣・竜・妖精の飛ぶものは **突 1.25** も（射落とせる）。虫の飛ぶものは突の上乗せなし。
3. 系統ごとの上書き（例: 虚ろの使い = 火 1.5・闇 1.5・光 0.25、斬 1.25・打 0.75。紙は燃え、墨がしみる）。
4. 親和 X があれば **X を 0.25**、**X の弱点属性を 1.5 以上**（成長章 §7.2: 火←水、水←土、土←風、風←火、光←闇、闇←光）。
5. 竜は、親和とその弱点以外の属性で、まだ決まっていないものを 0.75 にする。
6. 種ごとの上書き（例: 砂漠のサソリは暑さに強く 火 1.0、氷の小鬼は 火 1.25、鉄の魔造はさびて 水 1.5、溶岩の種は 火 −1（吸収））。
- **ボスの状態の耐性**は、表の値と成長章 §8.3 の「ボスの既定の耐性」の大きい方を使う（battle が実行時にかける。表にはボス固有の分だけ書いた）。

### 3.2 片寄りの検査（成長章 §7.3・§17.3-I。検算の結果）
弱点（1.5 以上）をもつものの割合。雑魚 203 種（鋼を除く）と、段の半分以上がその弱点をもつ系統（51 系統）で数えた。
| 属性 | 火 | 水 | 風 | 土 | 光 | 闇 |
|---|---|---|---|---|---|---|
| 種の割合 | 23.2% | 14.8% | 24.1% | 16.3% | 23.6% | 15.3% |
| 系統の割合 | 23.5% | 13.7% | 23.5% | 15.7% | 17.6% | 13.7% |
- 打撃の種類（1.25 以上）: 斬 12.8%、打 21.7%、突 11.8%（種）。すべて規則の範囲（属性 12〜25%、種類 10% 以上）。
- 水の弱点は火の親和の種（火トカゲ・悪魔・大鬼・三頭獣・鬼火）とさびる魔造、闇の弱点は妖精・光の親和（からくり・騎士の鎧・星見の目玉・書記）と虚ろの使いが受け持つ。
- 系統の中で段ごとに親和を変えた（例: ゼリーは 無→水→無→無→全属性 0.75、コウモリは 無→無→無→闇→闇、水晶は 光→火→水→闇）。同じ見た目でも、戦うと弱点が違う（Part A「派生ごとに属性・行動・ドロップを変える」）。

### 3.3 状態の耐性の方針
- 種族の既定（成長章 §7.3）に、系統の性格で 1 つ 2 つ足すだけにした（毒の系統は毒 1、など）。**1 つの系統で「無効（1）」を新しく足すのは 1 つまで**（術章 §8.2 の目安）。不死・魔造・霊体は種族の既定で 3〜4 個が無効になるので、足していない。
- 霊体（成長章: 斬打突 0.5）は、雑魚の出る数が多い **霊の系統 `ghost` と虚無の騎士だけ 0.75 に上げた**（物理だけのパーティでも霧の館を抜けられるように。§13.1 の M3）。鬼火（小）は 0.5 のまま。


---------------------------------------------------------------------------------------------------
## 4. 絵（担当 art-mons A14。ボスとレア魔物は art-boss A15）

### 4.1 既存の元絵（36。クレストの `src/art/monsters_a.js` `monsters_b.js`、そのまま使う）
| 大きさ | 元絵 → 使う系統 |
|---|---|
| 小 32 | `jelly`→ゼリー・白銀のしずく　`bat`→コウモリ　`rat`→ネズミ　`mushroom`→キノコ　`bee`→ハチ　`wisp`→鬼火・白金の灯　`imp`→悪魔・白紙の小鬼　`mimic`→宝箱　`eyeball`→目玉 |
| 中 48 | `goblin`→小鬼　`snake`→ヘビ　`wolf`→オオカミ・白紙の獣　`plant`→人食い花　`skeleton`→骸骨　`ghost`→霊・霧の分身　`lizardman`→トカゲ兵　`scorpion`→サソリ　`mummy`→ミイラ　`crab`→カニ　`merman`→魚人　`darkmage`→魔術師　`armor`→鎧・白紙の騎士　`gargoyle`→石像鬼　`salamander`→火トカゲ　`cactus`→サボテン　`frostling`→氷の小鬼　`harpy`→（予備） |
| 大 64 | `orc`→大鬼　`golem`→石くれ兵　`wyvern`→飛竜・白紙の竜　`chimera`→三頭獣　`yeti`→雪男　`kraken`→タコ・深みの大ダコ　`demon`→魔神　`sandworm`→ミミズ・岩食らい　`minotaur`→（予備） |
| 裏 | `void_wraith`（48）→虚無の騎士　`chaos_beast`（64）→混沌獣（クレストの `postgame.js`） |
- `harpy` と `minotaur` は予備（あとで系統を足すときに使う。今は出さない）。
- 元絵の既定の色は §5 の表の「色相」の出発点（例: `jelly` は青緑 #34c090、`wolf` は青灰 #6c80aa、`bat` は藤色 #8a6c96）。

### 4.2 新しい元絵（14。art-mons が `src/art/monsters_c.js` に描く）
クレストの元絵と同じ作り（輪郭 1px `#120c16`、内側の線 `#1c1420`、左上からの光、陰は紫寄り・明るい所は黄寄りの色の段 `ramp`）。正面か正面寄りの 3/4 の向き。**足もと（最下段）を接地線**にする。
| id | 大きさ | 形（シルエット・ポーズ） | 既定の色 |
|---|---|---|---|
| `beetle` | 32 | 正面やや上から見た甲虫。丸く盛り上がった甲殻（左右の翅鞘の合わせ目に縦の線と帯のハイライト）、頭から前へ反った太い一本角、左右に3本ずつの短い脚、小さな黒い目2つ。 | 甲殻 #6a5040→#b08858、角 #504030、脚 #302820 |
| `fairy` | 32 | 宙に浮く手のひらほどの妖精。大きめの頭にふわふわの髪、葉っぱの服、背中に透ける蝶の羽4枚を左右に広げる、はだしのつま先をそろえ、片手を口に当てて笑う。羽のふちに光の粒2〜3。 | 髪 #f0d060、服 #70c050、肌 #f8d8c0、羽 #c0f0ff（半分の点で透ける） |
| `book` | 32 | 分厚い革表紙の本が半開きで浮き、表紙と裏表紙が上下のあご。頁のすき間に白い歯、表紙の2つの丸い金具が目のように光る、しおりのひもが舌のように垂れる。 | 表紙 #804830→#b87850、金具 #e0c060、頁 #f0e8d0、ひも #c03030 |
| `crystal` | 32 | 宙に浮く六角柱の水晶の群れ（大1本・小2本が根もとでつながる）。大きな結晶の中の丸い核が目のように光る。底から細い光のすじ2本。 | 結晶 #a0e0f0→#f0ffff、核 #ffffff、ふち #6090b0 |
| `frog` | 48 | 正面を向いてどっしり座る大ガエル。幅広の口、飛び出た金色の目、白っぽい腹、前足をそろえ、後ろ足を左右に張る。背中に小さなイボ。 | 背 #58a040→#90d060、腹 #e0f0c0、目 #f0d040 |
| `doll` | 48 | 陶器の頭のドレス人形が立つ（足もとが少し浮く）。白い陶器の顔に丸いほお紅とガラスの目、茶色の巻き毛、フリルの長いドレス、球体の関節の手。左のほおに小さなひび。 | 陶器 #f4f0ec、ほお #f0a0a0、髪 #a06040、ドレス #80a0e0・フリル #ffffff |
| `seabird` | 48 | 翼を半分広げて波がしらにとまるカモメ。白い頭と胸、灰色の背と翼、翼の先が黒、黄色いくちばしの先に赤い点、黄色い脚。目つきが少しふてぶてしい。 | 白 #f8f8f4、灰 #a0a8b8、翼の先 #303038、くちばし #f0c030 |
| `mole` | 48 | 二本足で立つ大きなモグラ。ビロードのような黒茶の毛、ピンクの長い鼻、ほとんど見えない小さな目、シャベルのような大きな両手に白い爪5本ずつ、明るい腹。 | 毛 #403028→#705848、鼻 #f090a0、爪 #f0e8d8 |
| `automaton` | 48 | 真ちゅうのからくり兵。丸い頭に一つ目のガラスのレンズ（青く光る）、樽形の胴の胸にふたと小さな歯車の窓、関節ごとに歯車のある腕、背中に大きなぜんまいのねじ、短い円筒の脚、リベットの点。 | 真ちゅう #c09040→#f0d890、影 #806020、レンズ #60d0ff、ねじ #a0a8b8 |
| `scribe` | 48 | 白い上着の記録院の書記。深いフードで顔は影（光る丸めがねだけが見える）、胸に記録院の紋（開いた本）、左腕に分厚い帳面、右手に大きな羽ペン、長いすそ。 | 上着 #f0f0ec→#b8bcc8、紋 #d0b040、帳面 #403028、ペン #ffffff、めがね #fff0a0 |
| `owl` | 48 | 枝にとまった正面向きのフクロウ。丸い顔盤、大きな金色の目、耳のような羽角、胸の縞、たたんだ翼、枝（画面の下端）をつかむ爪。 | 羽 #a07850→#e0c8a0、顔盤 #f0e0c8、目 #f0c030、枝 #604830 |
| `spider` | 48 | 正面を向いた大グモ。後ろに盛り上がる丸い腹と小さめの頭胸部、左右に大きく広げた8本の脚（関節が上へ折れる）、頭に黒い目6つ（前の2つが大きい）、牙2本、点で描く毛。 | 体 #604830→#9a7858、目 #200808、牙 #f0e0d0 |
| `treant` | 64 | 動く古木。太い幹に樹皮の顔（うろの目2つと裂けた口）、腕のようにのびた枝2本（先が指のように分かれる）、頭の上の葉のしげみ、足のように広がる根3〜4本。 | 樹皮 #6a4a30→#a07850、葉 #4c9a3a→#8ac050、うろ #201008（目の奥に #c0f060 の光） |
| `mammoth` | 64 | 正面を向いた長い毛のマンモス。大きく反り返った白い牙2本、下に垂らして先を丸めた鼻、小さな目、盛り上がった頭頂、肩から下へ長く垂れる毛、柱のような足。 | 毛 #8a5a30→#c09060、牙 #f0e8d8、目 #201810 |
- 登録: `R.Gfx.def('mon:<id>', factory)` と `R.Art.monstersC = {ids, sizes}`（クレストの A・B と同じ形）。

### 4.3 組み立て `R.Art.compose`（担当 art-mons `src/art/monsters_parts.js`）
```js
R.Art.compose(base, hsb, parts, filter) → canvas        // 例: R.Art.compose('wolf', {hue:20, sat:0.6, bri:1.15}, [['frost', {c:'#e8fcff'}]], null)
R.Art.MON_ANCHORS[base] = { head, brow, eyes:[[x,y],…], mouth, neck, back, body, hand, hand2, tail, feet }   // 元絵の座標（ピクセル）
R.Art.MON_COMPOSE[spriteId] = [base, hsb, parts, filter?]   // §4.6。onData ではなく読み込み時に登録してよい（データではなく絵の表）
// 登録: for (const id in MON_COMPOSE) R.Gfx.def('mon:' + id, () => R.Art.compose(...MON_COMPOSE[id]))
```
手順（規則）:
1. `R.Gfx.variant('mon:' + base, {hue, sat, bri})` で元絵を色替えする（`hsb` のキーは `hue`（度）`sat`（倍）`bri`（倍））。
2. 後ろの層のパーツ（§4.4 の「層: 後」）を元絵の**後ろ**に描き、前の層のパーツを上に描く。パーツの色は**指定の色そのまま**（色替えしない）。
3. フィルター（§4.5）を全体にかける。
4. 足した画素の外側に 1px の輪郭 `#120c16` を付け直す（クレストの `finish` と同じ）。
5. **キャンバスの大きさは元絵と同じ**（32/48/64）。はみ出す部分は切る。冠・角は頭の上の余白に収まる大きさで描く（小の元絵なら 6〜8px、中 8〜12px、大 12〜16px）。
- アンカーは 50 の元絵（既存 36 ＋ 新 14）のすべてに付ける（`boss_*` `rare_*` には不要）。無いアンカーは `body` を使う。手の無い元絵（ゼリー・目玉など）の武器は、体の横に浮かせて描く。
- 金色の個体は、組み立て後の絵に `R.Gfx.variant(key, {tint:'#ffd24a'})`（エンジン章 §3.2）。キャッシュのキーは `mon:<id>` ＋ 金色かどうか。
- 確認用: `tools/sheet_monsters_parts.js`（A14）が、`MON_COMPOSE` の全 id を名前つきの一覧表（1枚に 48 体）にして PNG で出す。**描いたら必ず見て確かめる**。

### 4.4 パーツ（66。`R.Art.PARTS[id] = (pix, anchor, opts) => void`）
`opts` の共通: `c`（主の色）、`c2`（二番目の色）、`gem`（宝石の色）、`size`（`'s' 'm' 'l'`。既定は元絵の大きさ）、`style`（形の種類）、`len`（角の長さ `s m l`）。
| id | 名前 | アンカー | 層 | 形（style） |
|---|---|---|---|---|
| `horns` | 角 | brow | 前 | 左右に反った一対の角。`len` s/m/l |
| `crown` | 冠 | head | 前 | 金の山形の冠と宝石1つ。style `leaf`（葉の冠）`nemes`（王家の頭巾）`ice`（氷の結晶）`feather`（羽根飾り）`barnacle`（フジツボの冠） |
| `tiara` | 小冠 | head | 前 | 細い輪と中央の宝石 |
| `helm` | かぶと | head | 前 | style `cap`（鉢形）`horned`（角付き）`plume`（羽根飾り）`kabuto`（くわがた付きのかぶと）`kabuto_big`（大きなくわがた）`fin`（ひれ飾り） |
| `hood` | 頭巾 | head | 前 | 頭をおおう布。style `cobra`（コブラの頸の広がり）`witch`（とがった魔女の頭巾） |
| `hat` | 帽子 | head | 前 | style `night`（ナイトキャップ）`wizard`（とんがり帽）`lady`（つば広の婦人帽）`tricorn`（三角帽）`bicorne`（二角帽）`miner`（ランプ付きの鉱夫帽）`tophat`（シルクハット）`shako`（筒形の軍帽） |
| `halo` | 光輪 | head の上 | 後 | 楕円の光の輪 |
| `bandana` | バンダナ | head | 前 | 結び目が横にたれる布 |
| `flower` | 花 | head | 前 | 5弁の花1〜2輪 |
| `beard` | ひげ | mouth | 前 | あごひげ。style `mustache`（口ひげ） |
| `eyepatch` | 眼帯 | eyes[0] | 前 | 黒い眼帯とひも |
| `monocle` | 片めがね | eyes[1] | 前 | 金の輪と鎖 |
| `goggles` | ゴーグル | eyes | 前 | 額のゴーグル |
| `eyes_glow` | 光る目 | eyes | 前 | 目の画素を `c` に置き換え、1px の光を足す。style `spiral`（うずまき）`face`（顔を描き足す: 火の玉用）`many`（小さな目を 4〜6 個足す） |
| `eye3` | 第三の目 | brow | 前 | 縦長の目1つ |
| `mask` | 面 | eyes | 前 | style `bone`（骨の面） |
| `wings_bat` | こうもり翼 | back | 後 | 骨と膜の翼一対 |
| `wings_feather` | 羽の翼 | back | 後 | 白い羽の翼一対 |
| `wings_insect` | 虫の翅 | back | 後 | 半透明の翅4枚（点で透かす） |
| `cape` | マント | back | 後 | 肩から下がる布。`c` 表・`c2` 裏地。style `tailcoat`（燕尾服） |
| `shell_tower` | 背中の城 | back | 前 | 甲羅の上に小さな塔と旗 |
| `spikes` | とげ | 輪郭の上側 | 前 | 背・頭の輪郭にそって並ぶとげ |
| `thorns` | いばら | 輪郭 | 前 | 小さなとげの散らばり |
| `armor_plates` | 装甲板 | body | 前 | リベットの付いた板（体の中だけ）。style `rock`（岩の板）`rivet`（鋲だらけの鉄） |
| `chain` | 鎖 | body | 前 | 体を斜めに横切る鎖 |
| `runes` | 紋様 | body | 前 | 光る線の紋様 |
| `coral` | 珊瑚 | 輪郭の上側 | 前 | 珊瑚の枝とフジツボ |
| `crystals` | 結晶 | 輪郭の上側 | 前 | 生えた結晶のとげ |
| `moss` | 苔 | 輪郭の上側 | 前 | 苔の塊と葉 |
| `frost` | 霜 | 輪郭の上側 | 前 | 氷の皮とつらら |
| `embers` | 火の粉 | body | 前 | 体の割れ目の光と、浮かぶ火の粉 |
| `spots` | 斑点 | body | 前 | 丸い斑点。style `stripes`（縞）`suckers`（吸盤の列） |
| `drips` | したたり | 輪郭の下側 | 前 | 下へ垂れるしずく。style `tears`（目から垂れる涙） |
| `bubbles` | 泡 | 体のまわり | 前 | 浮かぶ泡 3〜5 |
| `sparks` | 火花 | 体のまわり | 前 | ぱちぱちした電気・火花 |
| `aura` | オーラ | 輪郭の外 | 後 | 輪郭の外に 1〜2px の光（`c`、外側ほど点を間引く） |
| `smoke` | 煙 | 体のまわり | 後 | 煙の塊 |
| `mist` | 霧 | feet | 前 | 足もとの霧の帯 |
| `storm` | 風の渦 | 体のまわり | 後 | 風の線。style `whirl`（渦潮） |
| `flame` | 炎 | head・back | 前 | 燃えるたてがみ。style `mouth`（口から出る炎） |
| `sword` | 剣 | hand | 前 | style `ice`（氷の剣）`great`（大剣） |
| `spear` `axe` `staff` `bow` `club_iron` `pick` `bomb` `cannon` `baton` `quill` `parasol` | 槍・斧・杖・弓・金棒・つるはし・火薬玉・大砲・指揮棒・羽ペン・日傘 | hand | 前 | 杖は style `coral`（珊瑚）`coil`（コイル）、`gem` で先の宝石 |
| `shield` `book` | 盾・本 | hand2 | 前 | |
| `violin` `drum` `flute` | バイオリン・太鼓・笛 | hand（太鼓は body） | 前 | 楽団の人形用 |
| `bell` | 鐘 | neck | 前 | 首にさげた鐘 |
| `ribbon` | リボン | head か neck | 前 | |
| `skull_mark` | 髑髏の印 | body | 前 | 体の模様としての髑髏 |
| `stinger` | 大きな針 | tail | 前 | 大きく光る針 |
| `rattle` | 鈴の尾 | tail | 前 | しっぽの先の輪の連なり |
| `teeth_iron` | 鉄の歯 | mouth | 前 | 金属の前歯 |
| `tusks` | 牙 | mouth | 前 | style `iron`（鉄のかぶせ） |
| `claws` | 鉄爪 | hand・hand2 | 前 | 金属の爪 |
| `pins` | まち針 | body | 前 | 刺さった針 4〜5 本 |

### 4.5 フィルター（6。`R.Art.FILTERS[id] = (pix, seed) => void`。`seed` は spriteId の文字から作る）
| id | 使う所 | 働き |
|---|---|---|
| `paper` | 虚ろの使い | 明るさを紙の色の段（#f8f6ee → #c8c4b8 → #8a8a98）に置き換え、輪郭を墨の青灰 #5a5a68 にする。輪郭の右と上に、欠けた三角（2〜4px）を 3〜6 か所あける（seed で決める）。体の上に薄い文字の線（1px の点線 #a0a0b0）を 2〜3 本。 |
| `shade` | 霧の分身・魔王の残影 | 明るさを白と青の段に置き換え、内側を市松の点で半分透かす。輪郭を明るい #a0b0e0 に。 |
| `chrome` | 白銀のしずく | 明るさを鋼の段（#303848 #6a7890 #b0c0d8 #f0f8ff）に置き換え、斜めの白い光の帯（2px）を1本。 |
| `mirror` | 鏡の甲虫 | chrome と同じにしたうえで、虹色の帯（色相を 3px で一回り）と、十字の光を 2 つ。 |
| `platinum` | 白金の灯 | 明るさを白金の段（#6a6048 #c0b890 #f0ecd8 #ffffff）に置き換え、光の点を 3〜4。 |
| `prism` | 虹ゼリー | 明るさを保ったまま、上から下へ色相を 300° 回す（彩度 0.8）。 |

### 4.6 組み立て表 `R.Art.MON_COMPOSE`（normative。雑魚 209 ＋ ボスの組み立て 14）
```js
R.Art.MON_COMPOSE = {
  // jelly ゼリー
  jelly_1: ['jelly', {}, []],
  jelly_2: ['jelly', { hue: 170 }, [['bubbles', { c: '#c8f0ff' }]]],
  jelly_3: ['jelly', { hue: 110, sat: 1.1, bri: 0.85 }, [['drips', { c: '#a060e0' }], ['skull_mark', { c: '#f0e0ff' }]]],
  jelly_4: ['jelly', { hue: -40, sat: 1.1 }, [['helm', { c: '#9aa0b0', style: 'horned' }], ['sword', { c: '#d8dce8' }]]],
  jelly_5: ['jelly', {}, [['tiara', { c: '#ffe070', gem: '#ff60c0' }]], 'prism'],
  // rat ネズミ
  rat_1: ['rat', {}, []],
  rat_2: ['rat', { hue: 80, sat: 0.8 }, [['eyes_glow', { c: '#a0ff60' }]]],
  rat_3: ['rat', { sat: 0.3, bri: 0.9 }, [['teeth_iron', { c: '#c8ccd8' }], ['armor_plates', { c: '#8890a0' }]]],
  rat_4: ['rat', { hue: -20, bri: 0.8 }, [['eyepatch'], ['bandana', { c: '#c03030' }], ['sword', { c: '#c0c4d0', size: 's' }]]],
  // bat コウモリ
  bat_1: ['bat', {}, []],
  bat_2: ['bat', { hue: 330, sat: 1.2 }, [['eyes_glow', { c: '#ff4040' }]]],
  bat_3: ['bat', { hue: 260 }, [['aura', { c: '#c090ff' }]]],
  bat_4: ['bat', { sat: 0.5, bri: 0.55 }, [['eyes_glow', { c: '#ff3050' }], ['aura', { c: '#502070' }]]],
  bat_5: ['bat', { hue: 330, sat: 1.1, bri: 0.7 }, [['crown', { c: '#e0c050', gem: '#c02040' }], ['cape', { c: '#301020', c2: '#c02030' }]]],
  // paper 虚ろの使い
  paper_1: ['imp', {}, [], 'paper'],
  paper_2: ['wolf', {}, [], 'paper'],
  paper_3: ['armor', {}, [], 'paper'],
  paper_4: ['wyvern', {}, [], 'paper'],
  // crab カニ
  crab_1: ['crab', {}, []],
  crab_2: ['crab', { hue: 200, sat: 0.35 }, [['armor_plates', { c: '#7c8898' }]]],
  crab_3: ['crab', { hue: 160 }, [['bubbles', { c: '#e0ffff' }]]],
  crab_4: ['crab', { hue: 30, sat: 0.6, bri: 1.1 }, [['shell_tower', { c: '#d8c8a0' }]]],
  // seabird カモメ
  seabird_1: ['seabird', {}, []],
  seabird_2: ['seabird', { sat: 0.3, bri: 0.75 }, [['storm', { c: '#c0d8f0' }]]],
  seabird_3: ['seabird', { hue: 30, sat: 0.7 }, [['bandana', { c: '#2040a0' }]]],
  seabird_4: ['seabird', { bri: 1.15 }, [['beard', { c: '#f8f8f0' }], ['aura', { c: '#90c0ff' }]]],
  // bee ハチ
  bee_1: ['bee', {}, []],
  bee_2: ['bee', { hue: 250, sat: 0.9 }, [['stinger', { c: '#a040c0' }]]],
  bee_3: ['bee', { hue: 190 }, [['sparks', { c: '#fff080' }]]],
  bee_4: ['bee', { hue: -30, sat: 1.1, bri: 0.8 }, [['spikes', { c: '#302020' }]]],
  bee_5: ['bee', { hue: 15, sat: 1.2 }, [['crown', { c: '#ffd040', gem: '#ff4080' }], ['wings_insect', { c: '#ffe8a0', size: 'l' }]]],
  // mushroom キノコ
  mushroom_1: ['mushroom', {}, []],
  mushroom_2: ['mushroom', { hue: 260 }, [['spots', { c: '#f0e060' }]]],
  mushroom_3: ['mushroom', { hue: 120, sat: 1.2 }, [['spots', { c: '#ff80ff' }], ['aura', { c: '#ffa0ff' }]]],
  mushroom_4: ['mushroom', { hue: 20, sat: 0.5, bri: 1.05 }, [['beard', { c: '#f4f0e0' }], ['staff', { c: '#8a6040', gem: '#80ff80' }]]],
  // plant 人食い花
  plant_1: ['plant', {}, []],
  plant_2: ['plant', { hue: -20, sat: 0.9, bri: 0.85 }, [['thorns', { c: '#2a5020' }]]],
  plant_3: ['plant', { hue: 200, sat: 1.1 }, [['smoke', { c: '#b080e0' }]]],
  plant_4: ['plant', { hue: 230, sat: 0.9, bri: 0.65 }, [['aura', { c: '#8090ff' }]]],
  plant_5: ['plant', { hue: 40, sat: 0.6, bri: 1.2 }, [['halo', { c: '#fff4b0' }], ['flower', { c: '#ffffff' }]]],
  // fairy 妖精
  fairy_1: ['fairy', {}, []],
  fairy_2: ['fairy', { hue: 300 }, [['flower', { c: '#ff90c0' }]]],
  fairy_3: ['fairy', { hue: 180, sat: 0.6, bri: 1.1 }, [['mist', { c: '#d0f0ff' }]]],
  fairy_4: ['fairy', { hue: 40, sat: 0.7, bri: 1.2 }, [['tiara', { c: '#ffe070', gem: '#80e0ff' }], ['wings_feather', { c: '#fff8e0', size: 's' }]]],
  // treant 魔木
  treant_1: ['treant', {}, []],
  treant_2: ['treant', { hue: -30, sat: 0.9, bri: 0.9 }, [['thorns', { c: '#402810' }]]],
  treant_3: ['treant', { hue: 30, sat: 0.8 }, [['moss', { c: '#58a040' }], ['flower', { c: '#ffe080' }]]],
  treant_4: ['treant', { hue: 50, sat: 0.7, bri: 0.9 }, [['moss', { c: '#407838' }], ['crown', { c: '#78c050', style: 'leaf' }], ['eyes_glow', { c: '#ffe070' }]]],
  // scorpion サソリ
  scorpion_1: ['scorpion', {}, []],
  scorpion_2: ['scorpion', { hue: 100 }, [['stinger', { c: '#80e040' }]]],
  scorpion_3: ['scorpion', { sat: 0.25, bri: 0.95 }, [['armor_plates', { c: '#8a94a4' }]]],
  scorpion_4: ['scorpion', { hue: 260, sat: 0.6, bri: 0.6 }, [['skull_mark', { c: '#e0e0e0' }], ['eyes_glow', { c: '#ff2040' }]]],
  scorpion_5: ['scorpion', { hue: 30, sat: 0.8, bri: 0.8 }, [['crown', { c: '#f0c030', gem: '#40c0ff' }], ['armor_plates', { c: '#c09030' }]]],
  // snake ヘビ
  snake_1: ['snake', { hue: 35, sat: 0.7, bri: 1.1 }, []],
  snake_2: ['snake', { hue: 20, sat: 0.8, bri: 0.85 }, [['rattle', { c: '#e0c080' }]]],
  snake_3: ['snake', { hue: 60, sat: 1.1 }, [['eyes_glow', { c: '#ff3030' }], ['hood', { c: '#5a8030', style: 'cobra' }]]],
  snake_4: ['snake', { hue: 30, sat: 0.9, bri: 0.9 }, [['horns', { c: '#d8c090', len: 's' }], ['armor_plates', { c: '#a88040' }]]],
  // mummy ミイラ
  mummy_1: ['mummy', {}, []],
  mummy_2: ['mummy', { hue: 250, sat: 0.4, bri: 0.9 }, [['eyes_glow', { c: '#b040ff' }]]],
  mummy_3: ['mummy', { hue: 20, sat: 0.5 }, [['hood', { c: '#d8b040' }], ['staff', { c: '#c09030', gem: '#40e0c0' }]]],
  mummy_4: ['mummy', { hue: 10, sat: 0.6 }, [['helm', { c: '#d0a830', style: 'plume' }], ['sword', { c: '#e0c060' }], ['shield', { c: '#b08830' }]]],
  mummy_5: ['mummy', { hue: 20, sat: 0.7, bri: 1.05 }, [['crown', { c: '#f0c040', gem: '#30c0a0', style: 'nemes' }], ['cape', { c: '#304080', c2: '#d0b040' }]]],
  // cactus サボテン
  cactus_1: ['cactus', {}, []],
  cactus_2: ['cactus', { hue: -15, sat: 1.1, bri: 0.9 }, [['spikes', { c: '#f0f0d0' }]]],
  cactus_3: ['cactus', { hue: 10 }, [['flower', { c: '#ff4060' }]]],
  cactus_4: ['cactus', { hue: -10, sat: 1.2, bri: 0.85 }, [['beard', { c: '#f0f0e0', style: 'mustache' }], ['spikes', { c: '#ffffe0' }], ['helm', { c: '#d0a030', style: 'kabuto' }]]],
  // sandworm ミミズ
  sandworm_1: ['sandworm', {}, []],
  sandworm_2: ['sandworm', { sat: 0.3, bri: 0.85 }, [['armor_plates', { c: '#7a7060', style: 'rock' }]]],
  sandworm_3: ['sandworm', { hue: -20, sat: 1.1, bri: 0.75 }, [['spikes', { c: '#d0a070' }], ['crystals', { c: '#f0a040' }]]],
  // wolf オオカミ
  wolf_1: ['wolf', { sat: 0.5 }, []],
  wolf_2: ['wolf', { hue: 20, sat: 0.6, bri: 1.15 }, [['frost', { c: '#e8fcff' }]]],
  wolf_3: ['wolf', { sat: 0.2, bri: 1.3 }, [['frost', { c: '#ffffff' }], ['mist', { c: '#e0f0ff' }]]],
  wolf_4: ['wolf', { hue: 40, sat: 0.8, bri: 0.5 }, [['eyes_glow', { c: '#ffe040' }], ['aura', { c: '#303870' }]]],
  wolf_5: ['wolf', { sat: 0.3, bri: 1.2 }, [['crown', { c: '#b0e8ff', style: 'ice' }], ['frost', { c: '#ffffff' }], ['aura', { c: '#80d0ff' }]]],
  // yeti 雪男
  yeti_1: ['yeti', {}, []],
  yeti_2: ['yeti', { hue: 20, sat: 1.2 }, [['crystals', { c: '#a0e0ff' }], ['frost', { c: '#e0ffff' }]]],
  yeti_3: ['yeti', { hue: 20, sat: 0.8, bri: 0.9 }, [['mask', { c: '#e8e0d0', style: 'bone' }], ['horns', { c: '#f0e8d8', len: 'm' }]]],
  // frostling 氷の小鬼
  frostling_1: ['frostling', {}, []],
  frostling_2: ['frostling', { hue: 15 }, [['crystals', { c: '#c0f0ff' }]]],
  frostling_3: ['frostling', { sat: 0.4, bri: 1.2 }, [['mist', { c: '#f0f8ff' }]]],
  frostling_4: ['frostling', { hue: 20, sat: 1.1 }, [['helm', { c: '#c0e8ff', style: 'kabuto' }], ['sword', { c: '#e0f8ff', style: 'ice' }]]],
  frostling_5: ['frostling', { hue: 30, sat: 1.2, bri: 0.9 }, [['helm', { c: '#9ad0ff', style: 'kabuto_big' }], ['cape', { c: '#e0f0ff', c2: '#6090d0' }], ['aura', { c: '#c0e8ff' }]]],
  // owl フクロウ
  owl_1: ['owl', {}, []],
  owl_2: ['owl', { hue: 30, sat: 0.7 }, [['hat', { c: '#6070c0', style: 'night' }]]],
  owl_3: ['owl', { hue: 270, sat: 1.1 }, [['eyes_glow', { c: '#ff80ff', style: 'spiral' }]]],
  owl_4: ['owl', { hue: 200, sat: 0.8 }, [['hat', { c: '#304890', style: 'wizard' }], ['book', { c: '#c04040' }], ['monocle']]],
  // mammoth マンモス
  mammoth_1: ['mammoth', {}, []],
  mammoth_2: ['mammoth', { hue: -10, sat: 0.8, bri: 0.85 }, [['tusks', { c: '#b8c0d0', style: 'iron' }], ['armor_plates', { c: '#7c8494' }]]],
  mammoth_3: ['mammoth', { sat: 0.2, bri: 1.25 }, [['crown', { c: '#e0c050', gem: '#60c0ff' }], ['frost', { c: '#ffffff' }]]],
  // ghost 霊
  ghost_1: ['ghost', {}, []],
  ghost_2: ['ghost', { hue: 20, sat: 1.2 }, [['drips', { c: '#a0d0ff', style: 'tears' }]]],
  ghost_3: ['ghost', { hue: 120, sat: 0.8, bri: 0.8 }, [['eyes_glow', { c: '#ff3050' }], ['chain', { c: '#6a6480' }]]],
  ghost_4: ['ghost', { hue: 330, sat: 1.2, bri: 0.7 }, [['chain', { c: '#503040' }], ['aura', { c: '#801030' }]]],
  ghost_5: ['ghost', { hue: 250, sat: 1.2, bri: 0.6 }, [['crown', { c: '#b0a0e0', gem: '#ff4080' }], ['cape', { c: '#201030', c2: '#8040c0' }], ['aura', { c: '#6030a0' }]]],
  // wisp 鬼火
  wisp_1: ['wisp', { hue: -170, sat: 1.2 }, []],
  wisp_2: ['wisp', { hue: -100, sat: 1.2 }, [['eyes_glow', { c: '#ffffff', style: 'face' }]]],
  wisp_3: ['wisp', { sat: 0.4, bri: 1.2 }, [['aura', { c: '#c0e0ff' }]]],
  wisp_4: ['wisp', { hue: 80, sat: 1.2, bri: 0.7 }, [['aura', { c: '#502080' }], ['skull_mark', { c: '#d0c0ff' }]]],
  // frog カエル
  frog_1: ['frog', {}, []],
  frog_2: ['frog', { hue: 180, sat: 1.3 }, [['spots', { c: '#ffd020' }]]],
  frog_3: ['frog', { hue: 40, sat: 0.8, bri: 0.9 }, []],
  frog_4: ['frog', { hue: 20, sat: 0.7, bri: 0.95 }, [['bell', { c: '#c89040' }]]],
  // doll 人形
  doll_1: ['doll', {}, []],
  doll_2: ['doll', { hue: 300, sat: 0.9 }, [['ribbon', { c: '#ff70a0' }]]],
  doll_3: ['doll', { sat: 0.4, bri: 0.7 }, [['pins', { c: '#d0d0d0' }], ['eyes_glow', { c: '#ff2020' }]]],
  doll_4: ['doll', { hue: 200, sat: 0.8 }, [['hat', { c: '#403060', style: 'lady' }], ['parasol', { c: '#e0d0f0' }]]],
  // lizardman トカゲ兵
  lizardman_1: ['lizardman', {}, []],
  lizardman_2: ['lizardman', { hue: 20 }, [['spear', { c: '#c0c0c8' }], ['helm', { c: '#8a7a50', style: 'cap' }]]],
  lizardman_3: ['lizardman', { hue: 250, sat: 0.8 }, [['hood', { c: '#6040a0' }], ['staff', { c: '#7a5a3a', gem: '#40ffc0' }]]],
  lizardman_4: ['lizardman', { hue: -20, sat: 1.1 }, [['crown', { c: '#e0a040', style: 'feather' }], ['axe', { c: '#c8ccd0' }], ['shield', { c: '#806030' }]]],
  // spider クモ
  spider_1: ['spider', {}, []],
  spider_2: ['spider', { hue: 250, sat: 1.1 }, [['spots', { c: '#80ff40' }]]],
  spider_3: ['spider', { sat: 0.3, bri: 0.4 }, [['eyes_glow', { c: '#ff2020', style: 'many' }]]],
  spider_4: ['spider', { hue: 40, sat: 1.3, bri: 0.9 }, [['eyes_glow', { c: '#ffd040', style: 'many' }], ['spots', { c: '#ffd040', style: 'stripes' }]]],
  // merman 魚人
  merman_1: ['merman', {}, []],
  merman_2: ['merman', { hue: -30 }, [['helm', { c: '#708090', style: 'fin' }]]],
  merman_3: ['merman', { hue: 90, sat: 0.8 }, [['hood', { c: '#5030a0' }], ['staff', { c: '#e07080', gem: '#ffffff', style: 'coral' }]]],
  merman_4: ['merman', { hue: 190, sat: 0.7 }, [['armor_plates', { c: '#80a0b0' }], ['helm', { c: '#a0b8c8', style: 'fin' }], ['shield', { c: '#6080a0' }]]],
  // kraken タコ
  kraken_1: ['kraken', {}, []],
  kraken_2: ['kraken', { hue: -20, sat: 1.2 }, [['spots', { c: '#ffe0e0', style: 'suckers' }]]],
  kraken_3: ['kraken', { hue: 200, sat: 0.9, bri: 0.8 }, [['storm', { c: '#80c0ff', style: 'whirl' }]]],
  // skeleton 骸骨
  skeleton_1: ['skeleton', {}, [['bandana', { c: '#c03030' }]]],
  skeleton_2: ['skeleton', {}, [['hat', { c: '#302020', style: 'tricorn' }], ['eyepatch']]],
  skeleton_3: ['skeleton', { hue: 20, sat: 0.6 }, [['bandana', { c: '#303030' }], ['cannon', { c: '#404048' }]]],
  skeleton_4: ['skeleton', {}, [['hat', { c: '#203050', style: 'tricorn' }], ['cape', { c: '#203050', c2: '#c0a040' }]]],
  skeleton_5: ['skeleton', {}, [['hat', { c: '#e0c050', style: 'bicorne' }], ['cape', { c: '#302050', c2: '#e0c050' }], ['sword', { c: '#f0d060' }]]],
  // golem 石くれ兵
  golem_1: ['golem', {}, []],
  golem_2: ['golem', { hue: 180, sat: 0.4, bri: 0.8 }, [['armor_plates', { c: '#9a5a40', style: 'rivet' }]]],
  golem_3: ['golem', { hue: 60, sat: 0.8, bri: 1.1 }, [['crystals', { c: '#ff60c0' }], ['runes', { c: '#80ffff' }]]],
  // mole モグラ
  mole_1: ['mole', {}, []],
  mole_2: ['mole', { hue: -10, sat: 0.8 }, [['hat', { c: '#d0a030', style: 'miner' }], ['claws', { c: '#b0b8c8' }]]],
  mole_3: ['mole', { hue: 10, sat: 1.1 }, [['hat', { c: '#d0a030', style: 'miner' }], ['bomb', { c: '#303030' }]]],
  mole_4: ['mole', { hue: 20, sat: 0.7, bri: 0.85 }, [['hat', { c: '#f0c040', style: 'miner' }], ['beard', { c: '#e0e0e0' }], ['pick', { c: '#c0c8d0' }]]],
  // beetle カブト
  beetle_1: ['beetle', {}, []],
  beetle_2: ['beetle', { sat: 0.2, bri: 0.7 }, []],
  beetle_3: ['beetle', { hue: -40, sat: 1.2 }, [['sparks', { c: '#ffb040' }]]],
  beetle_4: ['beetle', { sat: 0.3, bri: 1.3 }, [['crystals', { c: '#e0f8ff' }]]],
  // crystal 水晶
  crystal_1: ['crystal', {}, []],
  crystal_2: ['crystal', { hue: -60, sat: 1.4 }, []],
  crystal_3: ['crystal', { hue: 180, sat: 1.3 }, []],
  crystal_4: ['crystal', { hue: 250, sat: 1.3, bri: 0.85 }, []],
  // goblin 小鬼
  goblin_1: ['goblin', {}, []],
  goblin_2: ['goblin', { hue: 20 }, [['axe', { c: '#b8c0c8' }], ['helm', { c: '#807060', style: 'cap' }]]],
  goblin_3: ['goblin', { hue: -40 }, [['bandana', { c: '#e08020' }], ['goggles'], ['bomb', { c: '#303030' }]]],
  goblin_4: ['goblin', { hue: 40, sat: 1.1 }, [['helm', { c: '#a08050', style: 'horned' }], ['sword', { c: '#c0c8d0' }], ['shield', { c: '#806040' }]]],
  goblin_5: ['goblin', { hue: 60, sat: 1.2 }, [['crown', { c: '#f0c030', gem: '#ff3030' }], ['cape', { c: '#802020', c2: '#f0c030' }], ['sword', { c: '#f0d060' }]]],
  // salamander 火トカゲ
  salamander_1: ['salamander', {}, []],
  salamander_2: ['salamander', { hue: 10, sat: 1.1 }, [['flame', { c: '#ffc040', style: 'mouth' }]]],
  salamander_3: ['salamander', { hue: -20, sat: 1.2, bri: 0.7 }, [['embers', { c: '#ff7020' }]]],
  salamander_4: ['salamander', { hue: -10, sat: 1.2 }, [['horns', { c: '#ffa030', len: 'm' }], ['embers', { c: '#ffb040' }]]],
  salamander_5: ['salamander', { hue: -30, sat: 1.2, bri: 0.9 }, [['crown', { c: '#f0c030', gem: '#ff2020' }], ['wings_bat', { c: '#a02010', size: 's' }], ['aura', { c: '#ff6020' }]]],
  // imp 悪魔
  imp_1: ['imp', { sat: 0.2, bri: 0.6 }, []],
  imp_2: ['imp', {}, [['embers', { c: '#ffa040' }]]],
  imp_3: ['imp', { sat: 0.1, bri: 1.1 }, [['smoke', { c: '#a0a0a0' }]]],
  imp_4: ['imp', { hue: 20, sat: 1.2 }, [['horns', { c: '#301010', len: 'l' }], ['flame', { c: '#ff8020' }]]],
  imp_5: ['imp', { hue: 260, sat: 1 }, [['hat', { c: '#302050', style: 'wizard' }], ['book', { c: '#6030a0' }], ['monocle']]],
  // gargoyle 石像鬼
  gargoyle_1: ['gargoyle', {}, []],
  gargoyle_2: ['gargoyle', { sat: 0.3, bri: 0.45 }, [['eyes_glow', { c: '#ff3020' }]]],
  gargoyle_3: ['gargoyle', { hue: -150, sat: 1.3 }, [['embers', { c: '#ff6020' }]]],
  gargoyle_4: ['gargoyle', { sat: 0.5, bri: 0.85 }, [['horns', { c: '#606070', len: 'l' }], ['crown', { c: '#a0a0b0' }]]],
  // orc 大鬼
  orc_1: ['orc', { hue: 20, sat: 0.8 }, []],
  orc_2: ['orc', { hue: -30, sat: 0.9 }, [['club_iron', { c: '#505860' }], ['helm', { c: '#706050', style: 'horned' }]]],
  orc_3: ['orc', { hue: -60, sat: 1.1 }, [['horns', { c: '#e8e0d0', len: 'l' }], ['armor_plates', { c: '#604030' }]]],
  // chimera 三頭獣
  chimera_1: ['chimera', { hue: 20, sat: 0.8 }, []],
  chimera_2: ['chimera', { hue: -10, sat: 1.1 }, [['horns', { c: '#e8d8b0', len: 'm' }]]],
  chimera_3: ['chimera', { hue: -30, sat: 1.3, bri: 0.85 }, [['flame', { c: '#ff6020' }], ['horns', { c: '#301010', len: 'l' }]]],
  // eyeball 目玉
  eyeball_1: ['eyeball', {}, []],
  eyeball_2: ['eyeball', { hue: -60, sat: 1.2 }, [['eyes_glow', { c: '#ff2020' }]]],
  eyeball_3: ['eyeball', { hue: 120, sat: 1.2 }, [['eye3', { c: '#ffff80' }]]],
  eyeball_4: ['eyeball', { hue: 200, sat: 1.1, bri: 1.1 }, [['halo', { c: '#fff0a0' }]]],
  eyeball_5: ['eyeball', { hue: 180, sat: 0.6, bri: 1.25 }, [['crown', { c: '#ffe070', gem: '#80c0ff' }], ['wings_feather', { c: '#ffffff', size: 'm' }], ['aura', { c: '#fff0b0' }]]],
  // darkmage 魔術師
  darkmage_1: ['darkmage', { hue: 20, sat: 0.8 }, []],
  darkmage_2: ['darkmage', { hue: 140, sat: 1.2 }, []],
  darkmage_3: ['darkmage', { hue: -150, sat: 1.1 }, []],
  darkmage_4: ['darkmage', { hue: 30, sat: 1.1, bri: 0.6 }, [['aura', { c: '#502080' }], ['staff', { c: '#302030', gem: '#c040ff' }]]],
  // automaton からくり
  automaton_1: ['automaton', {}, []],
  automaton_2: ['automaton', { hue: 20, sat: 0.8 }, [['bow', { c: '#a08040' }]]],
  automaton_3: ['automaton', { hue: 160, sat: 0.8 }, [['staff', { c: '#c0a040', gem: '#80e0ff', style: 'coil' }], ['runes', { c: '#80e0ff' }]]],
  automaton_4: ['automaton', { hue: 20, sat: 1.1 }, [['helm', { c: '#d0a030', style: 'kabuto' }], ['sword', { c: '#e0e0e8' }], ['cape', { c: '#a02020', c2: '#d0a030' }]]],
  // armor 鎧
  armor_1: ['armor', { sat: 0.6, bri: 0.9 }, []],
  armor_2: ['armor', { hue: 20 }, [['shield', { c: '#6070a0' }], ['spear', { c: '#c0c4d0' }]]],
  armor_3: ['armor', { hue: 200, sat: 0.8 }, [['helm', { c: '#c0c8e0', style: 'plume' }], ['cape', { c: '#3050a0', c2: '#e0c060' }], ['sword', { c: '#e0e4f0' }]]],
  armor_4: ['armor', { sat: 0.5, bri: 0.45 }, [['horns', { c: '#e0c060', len: 'm' }], ['aura', { c: '#402060' }], ['sword', { c: '#302030', style: 'great' }]]],
  // wyvern 飛竜
  wyvern_1: ['wyvern', {}, []],
  wyvern_2: ['wyvern', { hue: 30, sat: 1.1 }, [['horns', { c: '#e8d890', len: 'm' }]]],
  wyvern_3: ['wyvern', { sat: 0.3, bri: 0.7 }, [['storm', { c: '#c0d0ff' }], ['sparks', { c: '#ffffa0' }]]],
  // scribe 白衣の書記
  scribe_1: ['scribe', {}, []],
  scribe_2: ['scribe', {}, [['book', { c: '#f0f0f0' }], ['quill', { c: '#ffffff' }]]],
  scribe_3: ['scribe', {}, [['hood', { c: '#f0e8c0' }], ['staff', { c: '#d0c080', gem: '#ffffff' }], ['aura', { c: '#fff8d0' }]]],
  // book 魔書
  book_1: ['book', {}, []],
  book_2: ['book', { hue: 250, sat: 1.2, bri: 0.8 }, [['chain', { c: '#808090' }], ['eyes_glow', { c: '#ff40ff' }]]],
  book_3: ['book', { sat: 0, bri: 1.3 }, [['aura', { c: '#ffffff' }]]],
  // mimic 宝箱
  mimic_1: ['mimic', {}, []],
  mimic_2: ['mimic', { hue: 100, sat: 0.8 }, [['drips', { c: '#80e040' }]]],
  mimic_3: ['mimic', { hue: 240, sat: 0.7 }, [['chain', { c: '#707080' }], ['eyes_glow', { c: '#ff40ff' }]]],
  mimic_4: ['mimic', { sat: 0.5, bri: 0.45 }, [['crown', { c: '#e0c050' }], ['aura', { c: '#402060' }]]],
  // void 虚無の騎士
  void_1: ['void_wraith', {}, []],
  void_2: ['void_wraith', {}, [['crown', { c: '#d0c060' }], ['cape', { c: '#100818', c2: '#6040a0' }]]],
  // chaos 混沌獣
  chaos_1: ['chaos_beast', {}, []],
  chaos_2: ['chaos_beast', { hue: 40, sat: 1.1 }, [['crown', { c: '#f0c030' }], ['crystals', { c: '#c080ff' }], ['aura', { c: '#8040c0' }]]],
  // demon 魔神
  demon_1: ['demon', { sat: 0.6, bri: 0.8 }, []],
  demon_2: ['demon', { hue: 200, sat: 0.8, bri: 0.7 }, [['armor_plates', { c: '#403050' }], ['helm', { c: '#302030', style: 'horned' }], ['sword', { c: '#503060', style: 'great' }]]],
  demon_3: ['demon', { hue: 240, sat: 0.9, bri: 0.65 }, [['crown', { c: '#e0c050', gem: '#ff2040' }], ['eye3', { c: '#ff4040' }], ['aura', { c: '#502070' }]]],
  // quicksilver 白銀のしずく
  quicksilver_1: ['jelly', {}, [], 'chrome'],
  quicksilver_2: ['jelly', {}, [['tiara', { c: '#e8f0ff' }]], 'chrome'],
  // mirror 鏡の甲虫
  mirror_1: ['beetle', {}, [], 'mirror'],
  mirror_2: ['beetle', {}, [['horns', { c: '#f0f8ff', len: 'l' }]], 'mirror'],
  // platinum 白金の灯
  platinum_1: ['wisp', {}, [], 'platinum'],
  platinum_2: ['wisp', {}, [['crown', { c: '#fff8e0' }]], 'platinum'],
  // bosses (owner art-boss A15 registers these with the same R.Art.compose)
  b_sandworm: ['boss_serpent', { hue: 25, sat: 0.7, bri: 1.05 }, []],
  b_sandking: ['boss_general_b', { hue: 60, sat: 0.6, bri: 1.1 }, []],
  b_doll_conductor: ['doll', { sat: 0.4, bri: 0.9 }, [['hat', { c: '#202020', style: 'tophat' }], ['cape', { c: '#202020', c2: '#c02030', style: 'tailcoat' }], ['baton', { c: '#f0f0f0' }]]],
  b_doll_violin: ['doll', { hue: 330, sat: 0.8 }, [['violin', { c: '#a05020' }], ['ribbon', { c: '#c02040' }]]],
  b_doll_drum: ['doll', { hue: 200, sat: 0.8 }, [['drum', { c: '#c03030' }], ['hat', { c: '#2040a0', style: 'shako' }]]],
  b_doll_flute: ['doll', { hue: 90, sat: 0.7 }, [['flute', { c: '#d0c080' }], ['flower', { c: '#ffe080' }]]],
  b_mist_double: ['ghost', { sat: 0.1, bri: 0.9 }, [['hood', { c: '#8890a0', style: 'witch' }]], 'shade'],
  b_octopus: ['kraken', { hue: 250, sat: 0.9, bri: 0.8 }, [['coral', { c: '#e08070' }], ['crown', { c: '#c0c0a0', style: 'barnacle' }]]],
  b_captain: ['boss_bandit', { hue: 170, sat: 0.45, bri: 1.1 }, []],
  b_rockeater: ['sandworm', { sat: 0.25, bri: 0.8 }, [['armor_plates', { c: '#707078', style: 'rock' }], ['crystals', { c: '#80e0ff' }]]],
  b_ironwarden: ['boss_general_a', { hue: 15, sat: 0.5, bri: 1.15 }, []],
  b_lavabeast_cold: ['boss_flame_lord', { sat: 0.35, bri: 0.55 }, []],
  b_rowell2: ['boss_rowell', { bri: 0.95 }, [['aura', { c: '#ffffff' }]]],
  b_valzard_echo: ['boss_demon_king', { sat: 0.2, bri: 0.85 }, [], 'shade'],
};
```


---------------------------------------------------------------------------------------------------
## 5. 系統と段（normative。担当 A11 `monsters_<地方>.js`）

### 5.1 系統の一覧（54）
名前の付け方（Part A「系統が分かる名前」）: 系統の語を名前の後ろか前に必ず残す（〇〇ゼリー、〇〇オオカミ、〇〇小僧 → 雪の大将 → 冬将軍、白紙の〇〇、骸骨の〇〇、小鬼 → 小鬼の〇〇 → 小鬼の王）。
**ドラクエ・FF・サガの固有の魔物名は使っていない**（スライム・ドラキー・キメラ・ゴーレム・ミミック・人食い箱・メタル〇〇・はぐれ〇〇 などは検査で弾いた）。

| 系統 id | 系統名 | 元絵（大きさ） | 種族 | 段と出始めのティア | 主な出現ゾーン |
|---|---|---|---|---|---|
| `jelly` | ゼリー | jelly（s） | 軟体 | 5段 [0,2,4,6,8] | zw_prologue zw_forest zw_marsh zw_isles z_r_marsh_bog / oblivion_hi(5) |
| `rat` | ネズミ | rat（s） | 獣 | 4段 [0,2,4,6] | zw_prologue z_prologue_lighthouse zw_desert zw_mine z_r_mine_mine z_r_isles_ship |
| `bat` | コウモリ | bat（s） | 獣・飛 | 5段 [0,2,4,6,8] | z_prologue_lighthouse z_r_desert_tomb z_r_snow_peak z_r_isles_cave z_r_mine_mine z_r_ash_volcano / oblivion_hi(5) |
| `paper` | 虚ろの使い | (imp/wolf/armor/wyvern)（var） | 霊体 | 4段 [2,4,6,8] | 全地方のワールドとダンジョン（ティア2から）、白の大書庫、ビブリア島 |
| `crab` | カニ | crab（m） | 水棲 | 4段 [0,2,4,6] | zw_prologue(1) zw_isles z_r_isles_cave |
| `seabird` | カモメ | seabird（m） | 鳥・飛 | 4段 [0,2,4,6] | zw_prologue(1) zw_isles z_r_isles_ship |
| `bee` | ハチ | bee（s） | 虫・飛 | 5段 [0,2,4,6,8] | zw_forest z_r_forest_maze / oblivion_lo(5) |
| `mushroom` | キノコ | mushroom（s） | 植物 | 4段 [0,2,4,6] | zw_forest z_r_forest_tree z_r_marsh_bog |
| `plant` | 人食い花 | plant（m） | 植物 | 5段 [0,2,4,6,8] | zw_forest z_r_forest_maze z_r_forest_tree / oblivion_lo(5) |
| `fairy` | 妖精 | fairy（s） | 妖精・飛 | 4段 [0,2,4,6] | zw_forest z_r_forest_maze z_r_forest_tree |
| `treant` | 魔木 | treant（l） | 植物 | 4段 [0,2,4,6] | zw_forest(T2+) z_r_forest_maze z_r_forest_tree |
| `scorpion` | サソリ | scorpion（m） | 虫 | 5段 [0,2,4,6,8] | zw_desert z_r_desert_tomb / oblivion_lo(5) |
| `snake` | ヘビ | snake（m） | 獣 | 4段 [0,2,4,6] | zw_desert |
| `mummy` | ミイラ | mummy（m） | 不死 | 5段 [0,2,4,6,8] | z_r_desert_tomb / oblivion_lo(5) |
| `cactus` | サボテン | cactus（m） | 植物 | 4段 [0,2,4,6] | zw_desert |
| `sandworm` | ミミズ | sandworm（l） | 虫 | 3段 [0,3,6] | zw_desert(T1+) z_r_desert_tomb |
| `wolf` | オオカミ | wolf（m） | 獣 | 5段 [0,2,4,6,8] | zw_snow z_r_snow_peak / oblivion_lo(5) |
| `yeti` | 雪男 | yeti（l） | 獣 | 3段 [0,3,6] | zw_snow z_r_snow_peak |
| `frostling` | 氷の小鬼 | frostling（m） | 妖精 | 5段 [0,2,4,6,8] | zw_snow z_r_snow_peak / oblivion_lo(5) |
| `owl` | フクロウ | owl（m） | 鳥・飛 | 4段 [0,2,4,6] | zw_snow z_r_snow_peak |
| `mammoth` | マンモス | mammoth（l） | 獣 | 3段 [0,3,6] | zw_snow |
| `ghost` | 霊 | ghost（m） | 霊体 | 5段 [0,2,4,6,8] | zw_marsh z_r_marsh_manor z_r_marsh_bog / oblivion_hi(5) |
| `wisp` | 鬼火 | wisp（s） | 霊体 | 4段 [0,2,4,6] | zw_marsh z_r_marsh_bog z_r_marsh_manor |
| `frog` | カエル | frog（m） | 水棲 | 4段 [0,2,4,6] | zw_marsh z_r_marsh_bog |
| `doll` | 人形 | doll（m） | 魔造 | 4段 [0,2,4,6] | z_r_marsh_manor |
| `lizardman` | トカゲ兵 | lizardman（m） | 人型 | 4段 [0,2,4,6] | zw_marsh z_r_marsh_bog |
| `spider` | クモ | spider（m） | 虫 | 4段 [0,2,4,6] | z_r_marsh_manor z_r_forest_maze |
| `merman` | 魚人 | merman（m） | 水棲 | 4段 [0,2,4,6] | zw_isles z_r_isles_cave z_r_isles_ship |
| `kraken` | タコ | kraken（l） | 水棲 | 3段 [0,3,6] | z_r_isles_cave z_r_isles_ship |
| `skeleton` | 骸骨 | skeleton（m） | 不死 | 5段 [0,2,4,6,8] | z_r_isles_ship / oblivion_hi(5) |
| `golem` | 石くれ兵 | golem（l） | 魔造 | 3段 [0,3,6] | zw_mine z_r_mine_mine |
| `mole` | モグラ | mole（m） | 獣 | 4段 [0,2,4,6] | zw_mine z_r_mine_mine |
| `beetle` | カブト | beetle（s） | 虫 | 4段 [0,2,4,6] | zw_mine z_r_mine_mine |
| `crystal` | 水晶 | crystal（s） | 魔造 | 4段 [0,2,4,6] | z_r_mine_mine z_r_star_tower |
| `goblin` | 小鬼 | goblin（m） | 人型 | 5段 [0,2,4,6,8] | zw_mine z_r_mine_mine / oblivion_hi(5) |
| `salamander` | 火トカゲ | salamander（m） | 獣 | 5段 [0,2,4,6,8] | zw_ash z_r_ash_volcano / oblivion_hi(5) |
| `imp` | 悪魔 | imp（s） | 魔族 | 5段 [0,2,4,6,8] | zw_ash z_r_ash_volcano / oblivion_hi(5) |
| `gargoyle` | 石像鬼 | gargoyle（m） | 魔族・飛 | 4段 [0,2,4,6] | z_r_ash_volcano z_r_star_tower |
| `orc` | 大鬼 | orc（l） | 人型 | 3段 [0,3,6] | zw_ash |
| `chimera` | 三頭獣 | chimera（l） | 獣 | 3段 [0,3,6] | zw_ash z_r_ash_volcano |
| `eyeball` | 目玉 | eyeball（s） | 魔族 | 5段 [0,2,4,6,8] | zw_star z_r_star_tower / oblivion_hi(5) |
| `darkmage` | 魔術師 | darkmage（m） | 人型 | 4段 [0,2,4,6] | zw_star z_r_star_tower |
| `automaton` | からくり | automaton（m） | 魔造 | 4段 [0,2,4,6] | zw_star z_r_star_tower |
| `armor` | 鎧 | armor（m） | 魔造 | 4段 [0,2,4,6] | z_r_star_tower z_finale_archive_lo(4) |
| `wyvern` | 飛竜 | wyvern（l） | 竜・飛 | 3段 [0,3,6] | zw_star |
| `scribe` | 白衣の書記 | scribe（m） | 人型 | 3段 [8,8,8] | z_finale_archive_lo z_finale_archive_hi zw_center |
| `book` | 魔書 | book（s） | 魔造 | 3段 [8,8,8] | z_finale_archive_lo z_finale_archive_hi zw_center |
| `mimic` | 宝箱 | mimic（s） | 魔造 | 4段 [0,2,4,6] | z_r_desert_tomb z_r_marsh_manor z_r_isles_ship z_r_star_tower z_finale_archive_lo(4) |
| `void` | 虚無の騎士 | void_wraith（m） | 霊体 | 2段 [9,9] | z_postgame_oblivion_lo z_postgame_oblivion_hi |
| `chaos` | 混沌獣 | chaos_beast（l） | 獣 | 2段 [9,9] | z_postgame_oblivion_lo z_postgame_oblivion_hi |
| `demon` | 魔神 | demon（l） | 魔族 | 3段 [8,9,9] | z_finale_archive_hi(1) z_postgame_oblivion_lo(2) z_postgame_oblivion_hi(3) |
| `quicksilver` | 白銀のしずく | jelly（s） | 軟体・鋼 | 2段 [2,6] | 中盤8地方のワールド（ティア2から、組の重み 2〜3%） |
| `mirror` | 鏡の甲虫 | beetle（s） | 虫・鋼 | 2段 [5,7] | 中盤8地方のダンジョン（ティア5から） |
| `platinum` | 白金の灯 | wisp（s） | 霊体・鋼 | 2段 [8,9] | zw_center z_finale_archive_hi z_postgame_oblivion_lo/hi |

- ファイルの分け方（A11）: `monsters_common.js`（jelly rat bat paper crab seabird mimic と鋼の3系統）、`monsters_forest.js` `monsters_desert.js` `monsters_snow.js` `monsters_marsh.js` `monsters_isles.js` `monsters_mine.js` `monsters_ash.js` `monsters_star.js`（その地方の系統。spider は marsh、gargoyle は ash、crystal は mine）、`monsters_finale.js`（scribe book demon）、`monsters_postgame.js`（void chaos）。

### 5.2 段の表（各系統）
表の見方:
- 「段T / lv」= 出始めのティアと名目のレベル。大きさが系統と違う段は括弧で書いた（虚ろの使い）。
- 「絵」= §4.6 の組み立ての読み下し（元絵・色相・彩度・明度・パーツ・〔フィルター〕）。正は §4.6。
- 「属性の倍率」「打撃」「状態の耐性」= データに書く最終の値（`吸収` = −1）。書いていないものは 1（状態は 0）。
- 「能力 s」= `s` の倍率（書いていないものは 1）と、報酬の倍率・旗。
- 「行動」= `id重み[条件]`。条件の略: `HP<50%` `HP>50%` `1回`（once）`3手ごと@0`（every [3,0]）`数<6`（countBelow 6）`倒れた仲間あり`（allyDown）。
- 「通常 / レア / 超レア」= 品の id と確率の分母（§12）。
- 列とデータの項目（§1.1）の対応: id → キー、名前 → `name`、段T / lv → `stage`（id の番号）と `lv`、絵 → `sprite: '<id>'`、属性の倍率 → `elem`（「親和X」は `affinity`）、打撃 → `phys`、状態の耐性 → `statusRes`、能力 s → `s`（「飛」は `flags:['flying']`、「鋼」は `flags:['metal']`・`fleeRate:0.5`、「HP固定n」は `hpFixed`、「お金×n」は `rw.gold`）、行動 → `actions`（「攻撃」は `'attack'`）、通常 / レア / 超レア → `drops`、図鑑の説明 → `desc`。系統の見出しの種族・大きさは全段の `race` `size`（虚ろの使いは段ごとの大きさ）、`lineage` は系統の id。

#### `jelly` ゼリー（軟体・s）
どこにでもいる水辺のゼリー。段が上がるほど、泡・毒・兵隊・虹と姿を変える。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `jelly_1` | ぷちゼリー | T0 / 7 | jelly | 火1.25 | 斬1.25 打.5 | — | hp1.1 atk.9 agi.8 | 攻撃6 · e_tackle2 | i_herb 1/8<br>ac_jelly_ring 1/32<br>ac_jelly_heart 1/256 | ぷるぷる震える小さなゼリー。<br>道ばたで群れをつくる。 |
| `jelly_2` | あわゼリー | T2 / 19 | jelly 色相+170 ＋泡 | 火1.25 水.25 土1.5（親和水） | 斬1.25 打.5 | — | hp1.05 mag1.1 agi.9 | 攻撃4 · e_water_bolt2 · e_bubbles2 | i_stone_water 1/8<br>sh_bubble 1/32<br>w_staff_bubble 1/256 | 体の中で泡がはじけるゼリー。<br>泡を吐いて目をくらます。 |
| `jelly_3` | 毒ゼリー | T4 / 31 | jelly 色相+110 彩1.1 明.85 ＋したたり・髑髏の印 | 火1.25 | 斬1.25 打.5 | 毒1 | hp1.1 | 攻撃3 · e_poison_spit3 · e_split1[HP>50%,数<6] | i_antidote 1/8<br>hn_jelly_glove 1/32<br>w_whip_venomjelly 1/256 | 毒をためこんだ紫のゼリー。<br>傷つくと二つに分かれる。 |
| `jelly_4` | ゼリー将軍 | T6 / 43 | jelly 色相-40 彩1.1 ＋かぶと(horned)・剣 | 火1.25 | 斬1.25 打.5 | — | hp1.3 atk1.1 def1.1 | 攻撃4 · e_howl2[3手ごと@0] · e_crush2 | i_herb2 1/8<br>hd_jelly_helm 1/32<br>w_sword_jellygeneral 1/256 | かぶとをかぶった赤いゼリー。<br>ゼリーの群れを率いる。 |
| `jelly_5` | 虹ゼリー | T8 / 55 | jelly ＋小冠 〔虹〕 | 火.75 水.75 風.75 土.75 光.75 闇.75 | 斬1.25 打.5 | — | hp1.2 mag1.2 mdef1.2 | 攻撃2 · e_prism_ray3 · e_split1[HP>50%,数<6] | i_elixir 1/8<br>ac_rainbow_drop 1/32<br>ac_rainbow_core 1/256 | 七色に光るまぼろしのゼリー。<br>どの属性もはね返しがち。 |

#### `rat` ネズミ（獣・s）
人里と坑道と船にすみつくネズミ。歯と数で押してくる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `rat_1` | 野ネズミ | T0 / 7 | rat | 火1.25 | — | — | hp.9 agi1.2 | 攻撃5 · e_bite2 | i_herb 1/8<br>ft_rat_sandal 1/32<br>w_dagger_rattooth 1/256 | 野原を走り回る灰色のネズミ。<br>食べ物のにおいに寄ってくる。 |
| `rat_2` | 毒牙ネズミ | T2 / 19 | rat 色相+80 彩.8 ＋光る目 | 火1.25 | — | — | hp.9 atk1.05 agi1.2 | 攻撃4 · e_poison_bite3 · e_call1[数<6] | i_antidote 1/8<br>hn_rat_claw 1/32<br>ac_plague_tail 1/256 | 牙に毒をもつネズミ。<br>噛まれると体がしびれて痛む。 |
| `rat_3` | 鉄歯ネズミ | T4 / 31 | rat 彩.3 明.9 ＋鉄の歯・装甲板 | 火1.25 | — | — | atk1.1 def1.25 | 攻撃3 · e_gnaw3 · e_bite1 | i_herb2 1/8<br>w_club_rat 1/32<br>hn_iron_tooth 1/256 | 鉄のように硬い歯のネズミ。<br>鎧さえかじって穴をあける。 |
| `rat_4` | ネズミの頭領 | T6 / 43 | rat 色相-20 明.8 ＋眼帯・バンダナ・剣 | 火1.25 | — | — | hp1.2 atk1.1 | 攻撃3 · e_call_lesser2[数<6] · e_double2 · e_howl1 | i_herb2 1/8<br>hd_rat_bandana 1/32<br>ac_rat_king_ring 1/256 | 片目の大ネズミ。手下を呼び<br>集めては荷を奪う。 |

#### `bat` コウモリ（獣・s・飛ぶ）
暗い所ならどこにでも。血を吸い、音で惑わせ、最後は闇の貴族になる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `bat_1` | 小コウモリ | T0 / 7 | bat | 火1.25 風1.5 土.5 | 突1.25 | — | hp.85 agi1.4・飛 | 攻撃5 · e_bite1 | i_eyedrop 1/8<br>ac_bat_fang 1/32<br>ft_bat_wing 1/256 | 暗がりから飛び出す小さな<br>コウモリ。すばしこい。 |
| `bat_2` | 血吸いコウモリ | T2 / 19 | bat 色相+330 彩1.2 ＋光る目 | 火1.25 風1.5 土.5 | 突1.25 | — | hp.9 agi1.35・飛 | 攻撃3 · e_drain_bite3 | i_herb 1/8<br>w_dagger_bloodbat 1/32<br>w_katana_crimson 1/256 | 血を吸うと体が赤く染まる。<br>傷口をねらってくる。 |
| `bat_3` | 音波コウモリ | T4 / 31 | bat 色相+260 ＋オーラ | 火1.25 風1.5 土.5 | 突1.25 | — | hp.9 mag1.1 agi1.3・飛 | 攻撃3 · e_sonic3 | i_eyedrop 1/8<br>hd_sonic_band 1/32<br>hd_echo_hood 1/256 | 耳をつんざく音を出して、<br>相手の頭を惑わせる。 |
| `bat_4` | 闇コウモリ | T6 / 43 | bat 彩.5 明.55 ＋光る目・オーラ | 火1.25 風1.5 土.5 光1.5 闇.25（親和闇） | 突1.25 | — | hp.95 mag1.15 agi1.35・飛 | 攻撃3 · e_dark_bolt2 · e_drain_bite2 | i_stone_dark 1/8<br>bd_night_cloak 1/32<br>w_bow_nightwing 1/256 | 夜そのもののような黒い翼。<br>闇の玉を吐き出す。 |
| `bat_5` | コウモリ公 | T8 / 55 | bat 色相+330 彩1.1 明.7 ＋冠・マント | 火1.25 風1.5 土.5 光1.5 闇.25（親和闇） | 突1.25 | — | hp1.3 mag1.2 agi1.25・飛 | 攻撃2 · e_life_suck3 · e_call_lesser1[数<5] · e_dark_mist2 | i_ether2 1/8<br>ac_count_brooch 1/32<br>bd_count_mantle 1/256 | 夜の城に住むというコウモリの<br>貴族。命を吸って生きる。 |

#### `paper` 虚ろの使い（霊体・var）
伝承が忘れられた場所に生まれる、白い紙のような魔物。記憶と力を「白紙」にする。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `paper_1` | 白紙の小鬼 | T2 / 19（s） | imp 〔紙（虚ろ）〕 | 火1.5 光.25 闇1.5 | 斬1.25 打.75 | 毒1 死1 混.5 眠.5 | hp.9 mag1.1 agi1.1 | 攻撃3 · e_forget3 · e_paper_cut2 | i_ether 1/8<br>ac_blank_page 1/32<br>ac_first_letter 1/256 | 紙を切り抜いたような白い小鬼。<br>ふれた者の記憶を消す。 |
| `paper_2` | 白紙の獣 | T4 / 31（m） | wolf 〔紙（虚ろ）〕 | 火1.5 光.25 闇1.5 | 斬1.25 打.75 | 毒1 死1 混.5 眠.5 | atk1.05 agi1.1 | 攻撃3 · e_bite2 · e_forget2 · e_erase_all1[4手ごと@1] | i_herb2 1/8<br>bd_blank_coat 1/32<br>w_spear_whiteline 1/256 | 忘れられた狼の物語から<br>生まれた白い獣。 |
| `paper_3` | 白紙の騎士 | T6 / 43（m） | armor 〔紙（虚ろ）〕 | 火1.5 光.25 闇1.5 | 斬1.25 打.75 | 毒1 死1 混.5 眠.5 | hp1.2 atk1.1 def1.2 agi.85 | 攻撃3 · e_slash2 · e_forget2 · e_erase_all1[3手ごと@2] | i_panacea 1/8<br>sh_blank_shield 1/32<br>sh_unwritten 1/256 | 名を忘れられた騎士の影。<br>白紙の剣で守りを消す。 |
| `paper_4` | 白紙の竜 | T8 / 55（l） | wyvern 〔紙（虚ろ）〕 | 火1.5 風1.5 土.5 光.25 闇1.5 | 斬1.25 打.75 | 毒1 死1 混.5 眠.5 | hp1.1 atk1.1 mag1.1・飛 | 攻撃2 · e_blank_breath3 · e_forget2 · e_tail1 | i_elixir 1/8<br>w_greatsword_blank 1/32<br>w_greatsword_eraser 1/256 | 古い竜の伝承の抜けがら。<br>吐く息は何もかも白くする。 |

#### `crab` カニ（水棲・m）
浜から洞窟まで。甲羅はだんだん城のように大きくなる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `crab_1` | 浜ガニ | T0 / 7 | crab | 火.75 水.5 土1.25 | — | — | hp.95 def1.4 agi.8 | 攻撃5 · e_pincer2 | i_herb 1/8<br>sh_crab_shell 1/32<br>w_fist_crabclaw 1/256 | 浜辺を横歩きする赤いカニ。<br>はさみに気をつけて。 |
| `crab_2` | 鉄甲ガニ | T2 / 19 | crab 色相+200 彩.35 ＋装甲板 | 火.75 水.25 土1.5（親和水） | — | — | def1.7 mdef.8 agi.7 | 攻撃3 · e_pincer2 · e_harden2[1回] | i_stone_water 1/8<br>bd_crab_plate 1/32<br>sh_ironshell 1/256 | 鉄のような甲羅のカニ。<br>身を固めると刃が通らない。 |
| `crab_3` | 泡吹きガニ | T4 / 31 | crab 色相+160 ＋泡 | 火.75 水.25 土1.5（親和水） | — | — | mag1.1 def1.4 | 攻撃3 · e_bubbles2 · e_water_bolt2 | i_ether 1/8<br>hd_foam_cap 1/32<br>w_bow_foamshot 1/256 | 青いカニ。泡で目をくらませ、<br>水の弾を撃ってくる。 |
| `crab_4` | 城ガニ | T6 / 43 | crab 色相+30 彩.6 明1.1 ＋背中の城 | 火.75 水.25 土1.5（親和水） | — | — | hp1.4 def1.6 agi.6 | 攻撃3 · e_pincer2 · e_harden1[1回] · e_crush2 | i_elixir 1/8<br>sh_castle_shell 1/32<br>bd_castle_carapace 1/256 | 背中に小さな城を背負った<br>大ガニ。まるで動く砦。 |

#### `seabird` カモメ（鳥・m・飛ぶ）
海辺と船の上を飛ぶカモメ。嵐を呼び、光り物を盗む。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `seabird_1` | 浜カモメ | T0 / 7 | seabird | 風1.5 土.5 | 突1.25 | — | hp.9 agi1.3・飛 | 攻撃5 · e_peck2 | i_herb 1/8<br>ac_gull_feather 1/32<br>ft_gull_boots 1/256 | 港の空をわがもの顔で飛ぶ。<br>魚も弁当もねらってくる。 |
| `seabird_2` | 嵐カモメ | T2 / 19 | seabird 彩.3 明.75 ＋風の渦 | 火1.5 風.25 土.5（親和風） | 突1.25 | — | hp.95 mag1.1 agi1.3・飛 | 攻撃3 · e_gust3 | i_stone_wind 1/8<br>w_bow_gull 1/32<br>w_spear_stormbeak 1/256 | 嵐の前に群れで現れる灰色の<br>カモメ。翼で突風を起こす。 |
| `seabird_3` | ぬすみカモメ | T4 / 31 | seabird 色相+30 彩.7 ＋バンダナ | 風1.5 土.5 | 突1.25 | — | hp.9 atk1.05 agi1.35・飛 お金×2 | 攻撃3 · e_peck_eyes2 · e_dive2 | i_eyedrop 1/8<br>hd_thief_bandana 1/32<br>ac_gull_loot 1/256 | 光るものに目がないカモメ。<br>目をつついてすきを作る。 |
| `seabird_4` | 長老カモメ | T6 / 43 | seabird 明1.15 ＋ひげ・オーラ | 火1.5 風.25 土.5（親和風） | 突1.25 | — | hp1.2 mag1.15 agi1.2・飛 | 攻撃2 · e_dive2 · e_gust2 · e_call_lesser1[数<5] | i_elixir 1/8<br>bd_gull_robe 1/32<br>hd_sea_wind 1/256 | 白いひげのような羽の老鳥。<br>海の風を思いのままに操る。 |

#### `bee` ハチ（虫・s・飛ぶ）
森の花畑のハチ。針は毒・しびれ・雨のような連射へ。最後は女王。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `bee_1` | 花バチ | T0 / 7 | bee | 火1.5 風1.5 土.5 | — | 毒.5 | hp.85 agi1.35・飛 | 攻撃4 · e_sting2 | i_herb 1/8<br>w_bow_leaf 1/32<br>w_dagger_stinger 1/256 | 花の蜜を守る黄色いハチ。<br>近づく者に針を向ける。 |
| `bee_2` | 毒針バチ | T2 / 19 | bee 色相+250 彩.9 ＋大きな針 | 火1.5 風1.5 土.5 | — | 毒1 | hp.85 atk1.05 agi1.35・飛 | 攻撃3 · e_poison_sting3 | i_antidote 1/8<br>w_staff_sprout 1/32<br>w_spear_venomneedle 1/256 | 紫の縞のハチ。毒針に刺されると<br>じわじわ体力を失う。 |
| `bee_3` | しびれバチ | T4 / 31 | bee 色相+190 ＋火花 | 火1.5 風1.5 土.5 | — | 毒.5 | hp.9 agi1.35・飛 | 攻撃3 · e_numb_sting3 | i_panacea 1/8<br>bd_leaf_mail 1/32<br>hn_numb_gloves 1/256 | 体にぱちぱち火花をまとう。<br>針で刺されると動けなくなる。 |
| `bee_4` | 千本バチ | T6 / 43 | bee 色相-30 彩1.1 明.8 ＋とげ | 火1.5 風1.5 土.5 | — | 毒.5 | hp.9 atk1.1 agi1.35・飛 | 攻撃2 · e_needles3 · e_poison_sting1 | i_herb2 1/8<br>w_spear_hornet 1/32<br>w_bow_thousand 1/256 | 体じゅうが針のハチ。針を<br>雨のように撃ちこんでくる。 |
| `bee_5` | 女王バチ | T8 / 55 | bee 色相+15 彩1.2 ＋冠・虫の翅 | 火1.5 風1.5 土.5 | — | 毒.5 | hp1.4 atk1.05 mag1.1 agi1.2・飛 | 攻撃2 · e_call_lesser2[数<6] · e_heal_all2[HP<70%] · e_poison_sting2 | i_elixir 1/8<br>ac_millennium_seed 1/32<br>hd_queen_crown 1/256 | 森いちばんの巣を治める女王。<br>千本バチを呼び寄せる。 |

#### `mushroom` キノコ（植物・s）
胞子で眠らせ、毒にし、惑わせる。長老は森を癒やす。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `mushroom_1` | ころりダケ | T0 / 7 | mushroom | 火1.5 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.3 atk.9 agi.6 | 攻撃4 · e_sleep_spore2 | i_herb 1/8<br>hd_mushroom_cap 1/32<br>hd_nap_cap 1/256 | 胞子を吸うところりと眠って<br>しまう。のんきな赤いキノコ。 |
| `mushroom_2` | まだらダケ | T2 / 19 | mushroom 色相+260 ＋斑点 | 火1.5 水.5 土.75 | 斬1.25 | 眠.5 毒1 | hp1.3 atk.9 agi.6 | 攻撃3 · e_poison_spore3 | i_antidote 1/8<br>w_staff_sprout 1/32<br>w_club_toadstool 1/256 | 紫にまだらの毒キノコ。<br>胞子を吸うと毒がまわる。 |
| `mushroom_3` | まどいダケ | T4 / 31 | mushroom 色相+120 彩1.2 ＋斑点・オーラ | 火1.5 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.2 mag1.1 agi.7 | 攻撃3 · e_confuse_spore3 · e_sleep_spore1 | i_panacea 1/8<br>ac_fairy_dust 1/32<br>ac_dream_spore 1/256 | あやしく光るキノコ。胞子を<br>吸うと敵も味方も分からない。 |
| `mushroom_4` | 長老ダケ | T6 / 43 | mushroom 色相+20 彩.5 明1.05 ＋ひげ・杖 | 火1.5 水.5 風1.5 土.25（親和土） | 斬1.25 | 眠.5 毒.5 | hp1.4 mag1.2 mdef1.2 agi.6 | 攻撃2 · e_spore_storm2 · e_heal_all2[HP<70%] · e_confuse_spore1 | i_elixir 1/8<br>hd_fairy_circlet 1/32<br>w_staff_elder_cap 1/256 | 白いひげをたくわえた古キノコ。<br>胞子の嵐で森を守る。 |

#### `plant` 人食い花（植物・m）
噛みつく花。いばら、毒の息、夜咲き、そして千年咲き続ける光の花へ。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `plant_1` | かみつき花 | T0 / 7 | plant | 火1.5 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.1 atk1.05 agi.8 | 攻撃4 · e_bite2 | i_herb 1/8<br>w_bow_leaf 1/32<br>w_whip_vine 1/256 | 道ばたの花のふりをして、<br>通る者に噛みつく。 |
| `plant_2` | いばら花 | T2 / 19 | plant 色相-20 彩.9 明.85 ＋いばら | 火1.5 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.1 atk1.1 agi.8 | 攻撃3 · e_thorn_vine2 · e_bind2 | i_antidote 1/8<br>w_staff_sprout 1/32<br>bd_thorn_mail 1/256 | とげだらけのつるをのばし、<br>絡めとって動けなくする。 |
| `plant_3` | 毒吹き花 | T4 / 31 | plant 色相+200 彩1.1 ＋煙 | 火1.5 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.1 mag1.1 agi.8 | 攻撃2 · e_poison_breath3 · e_bite2 | i_panacea 1/8<br>bd_leaf_mail 1/32<br>ac_poison_bloom 1/256 | 紫の花びらから毒の息を吐く。<br>風下に立ってはいけない。 |
| `plant_4` | 夜咲き花 | T6 / 43 | plant 色相+230 彩.9 明.65 ＋オーラ | 火1.5 水.5 土.75 光1.5 闇.25（親和闇） | 斬1.25 | 眠.5 毒.5 | hp1.15 mag1.15 agi.85 | 攻撃2 · e_sleep_pollen2 · e_life_suck2 · e_bite1 | i_stone_dark 1/8<br>w_spear_hornet 1/32<br>w_staff_moonbloom 1/256 | 月の夜にだけ開く青い花。<br>眠らせて命を吸う。 |
| `plant_5` | 千年花 | T8 / 55 | plant 色相+40 彩.6 明1.2 ＋光輪・花 | 火1.5 水.5 土.75 光.25 闇1.5（親和光） | 斬1.25 | 眠.5 毒.5 | hp1.3 mag1.2 mdef1.2 agi.8 | 攻撃2 · e_heal_all2[HP<80%] · e_flash2 · e_spore_storm1 · e_regen_self1[1回] | i_elixir 1/8<br>ac_millennium_seed 1/32<br>bd_thousand_petal 1/256 | 千年咲き続ける白い花。<br>光を放って仲間を癒やす。 |

#### `fairy` 妖精（妖精・s・飛ぶ）
森の小さな住人。いたずら、花の癒やし、霧の歌、そして妖精の姫。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `fairy_1` | いたずら妖精 | T0 / 7 | fairy | 風1.5 土.5 光.5 闇1.5 | 突1.25 | 混.5 | hp.8 mag1.1 agi1.4・飛 | 攻撃4 · e_prank2 · e_wind_blade1 | i_herb 1/8<br>w_bow_leaf 1/32<br>ft_prank_shoes 1/256 | くすくす笑って人を転ばせる<br>森の妖精。悪気はない。 |
| `fairy_2` | 花の妖精 | T2 / 19 | fairy 色相+300 ＋花 | 風1.5 土.5 光.25 闇1.5（親和光） | 突1.25 | 混.5 | hp.85 mag1.2 mdef1.1 agi1.3・飛 | 攻撃2 · e_heal_ally3[HP<70%] · e_light_ray2 | i_ether 1/8<br>ac_honey_charm 1/32<br>w_staff_petal 1/256 | 花から生まれる妖精。傷ついた<br>仲間に花の粉を振りかける。 |
| `fairy_3` | 霧の妖精 | T4 / 31 | fairy 色相+180 彩.6 明1.1 ＋霧 | 水.25 風1.5 土1.5 光.5 闇1.5（親和水） | 突1.25 | 混.5 | hp.85 mag1.2 agi1.3・飛 | 攻撃2 · e_lullaby2 · e_water_bolt2 · e_hush1 | i_ether 1/8<br>ac_fairy_dust 1/32<br>hd_mist_veil 1/256 | 朝霧にまぎれて歌う妖精。<br>歌を聞くとまぶたが重くなる。 |
| `fairy_4` | 妖精姫 | T6 / 43 | fairy 色相+40 彩.7 明1.2 ＋小冠・羽の翼 | 風1.5 土.5 光.25 闇1.5（親和光） | 突1.25 | 混.5 | mag1.3 mdef1.2 agi1.3・飛 | 攻撃1 · e_heal_all2[HP<80%] · e_charm2 · e_light_ray2 · e_veil_ally1[4手ごと@0] | i_ether2 1/8<br>hd_fairy_circlet 1/32<br>ac_fairy_tiara 1/256 | 妖精たちの小さなお姫さま。<br>魅了のまなざしで人を惑わす。 |

#### `treant` 魔木（植物・l）
森を歩き回る木。根で縛り、いばらで打ち、最後は森の古老になる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `treant_1` | さまよい木 | T0 / 7 | treant | 火1.5 水.5 風1.5 土.25（親和土） | 斬1.25 | 眠.5 毒.5 | hp1.3 def1.2 agi.7 | 攻撃4 · e_root_bind2 · e_sweep1 | i_herb 1/8<br>hd_mushroom_cap 1/32<br>w_club_wander 1/256 | 夜のうちに場所を変える木。<br>森の道が変わるのはこのせい。 |
| `treant_2` | いばら木 | T2 / 19 | treant 色相-30 彩.9 明.9 ＋いばら | 火1.5 水.5 風1.5 土.25（親和土） | 斬1.25 | 眠.5 毒.5 | hp1.3 atk1.1 def1.2 agi.7 | 攻撃3 · e_thorn_vine2 · e_sweep2 | i_antidote 1/8<br>ac_honey_charm 1/32<br>sh_bramble 1/256 | とげの生えた枝をふり回す。<br>近づくだけで傷だらけになる。 |
| `treant_3` | こけむし大木 | T4 / 31 | treant 色相+30 彩.8 ＋苔・花 | 火1.5 水.5 風1.5 土.25（親和土） | 斬1.25 | 眠.5 毒.5 | hp1.4 def1.25 mdef1.1 agi.65 | 攻撃2 · e_regen_self1[1回] · e_root_bind2 · e_stomp2 | i_herb2 1/8<br>bd_leaf_mail 1/32<br>bd_moss_bark 1/256 | 全身がこけと花におおわれた老木。<br>根を張って傷をふさぐ。 |
| `treant_4` | 古老の木 | T6 / 43 | treant 色相+50 彩.7 明.9 ＋苔・冠(leaf)・光る目 | 火1.5 水.5 風1.5 土.25（親和土） | 斬1.25 | 眠.5 毒.5 | hp1.5 mag1.15 def1.25 agi.6 | 攻撃2 · e_quake2 · e_heal_all1[HP<60%] · e_root_bind2 | i_elixir 1/8<br>w_spear_hornet 1/32<br>w_staff_elder_root 1/256 | 千年樹の兄弟とも呼ばれる木。<br>大地を揺らして森を守る。 |

#### `scorpion` サソリ（虫・m）
砂漠の毒虫。毒の尾、鋼の殻、死神の一刺し、そして皇帝。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `scorpion_1` | 赤サソリ | T0 / 7 | scorpion | 風1.5 土.25（親和土） | — | 毒.5 | def1.2 | 攻撃4 · e_pincer2 · e_poison_sting1 | i_antidote 1/8<br>w_dagger_scorpion 1/32<br>w_dagger_redtail 1/256 | 砂の中から現れる赤いサソリ。<br>はさみと毒の尾で襲う。 |
| `scorpion_2` | 毒尾サソリ | T2 / 19 | scorpion 色相+100 ＋大きな針 | 風1.5 土.25（親和土） | — | 毒1 | atk1.05 def1.2 | 攻撃3 · e_poison_sting3 | i_antidote 1/8<br>w_whip_snakeskin 1/32<br>w_fist_scorpion 1/256 | 尾の先が緑に光るサソリ。<br>猛毒で知られる。 |
| `scorpion_3` | 鋼殻サソリ | T4 / 31 | scorpion 彩.25 明.95 ＋装甲板 | 風1.5 土.25（親和土） | — | 毒.5 | hp1.1 def1.5 agi.85 | 攻撃3 · e_pincer2 · e_harden1[1回] · e_numb_sting2 | i_herb2 1/8<br>sh_scorpion_shell 1/32<br>bd_steel_carapace 1/256 | 鋼のような殻をもつサソリ。<br>剣がはね返されるほど硬い。 |
| `scorpion_4` | 死神サソリ | T6 / 43 | scorpion 色相+260 彩.6 明.6 ＋髑髏の印・光る目 | 風1.5 土.25（親和土） | — | 毒.5 | hp1.05 atk1.15 def1.2 | 攻撃2 · e_death_sting2 · e_poison_sting2 · e_double1 | i_revive 1/8<br>w_katana_sand 1/32<br>w_whip_reaper 1/256 | 背にどくろの模様があるサソリ。<br>一刺しで命を奪うこともある。 |
| `scorpion_5` | 皇帝サソリ | T8 / 55 | scorpion 色相+30 彩.8 明.8 ＋冠・装甲板 | 風1.5 土.25（親和土） | — | 毒.5 | hp1.3 atk1.1 def1.4 agi.9 | 攻撃2 · e_death_sting1 · e_pincer2 · e_quake1 · e_harden1[1回] | i_elixir 1/8<br>ac_royal_ankh 1/32<br>hn_emperor_claw 1/256 | 黄金の殻をまとう砂漠の皇帝。<br>砂を揺らして獲物を追いこむ。 |

#### `snake` ヘビ（獣・m）
砂漠の蛇。毒、鈴の音のおどし、にらみ、丸のみの大蛇へ。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `snake_1` | 砂ヘビ | T0 / 7 | snake 色相+35 彩.7 明1.1 | 火1.25 | — | — | atk1.05 agi1.05 | 攻撃4 · e_poison_bite2 | i_antidote 1/8<br>w_dagger_scorpion 1/32<br>ft_sandsnake 1/256 | 砂と同じ色のヘビ。<br>足もとに気をつけて。 |
| `snake_2` | 鈴尾ヘビ | T2 / 19 | snake 色相+20 彩.8 明.85 ＋鈴の尾 | 火1.25 | — | — | atk1.05 agi1.1 | 攻撃3 · e_scare2 · e_poison_bite2 | i_herb 1/8<br>w_whip_snakeskin 1/32<br>ac_rattle_charm 1/256 | しっぽを鈴のように鳴らして<br>おどかしてくる。 |
| `snake_3` | にらみヘビ | T4 / 31 | snake 色相+60 彩1.1 ＋光る目・頭巾(cobra) | 火1.25 | — | — | hp1.05 mag1.1 agi1.05 | 攻撃3 · e_gaze2 · e_bind2 | i_panacea 1/8<br>sh_scorpion_shell 1/32<br>hd_gaze_circlet 1/256 | 赤い目でにらまれると、<br>体が石のように固まる。 |
| `snake_4` | 砂の大蛇 | T6 / 43 | snake 色相+30 彩.9 明.9 ＋角・装甲板 | 火1.25 風1.5 土.25（親和土） | — | — | hp1.35 atk1.15 agi.95 | 攻撃2 · e_bind2 · e_poison_bite2 · e_swallow1 | i_herb2 1/8<br>w_katana_sand 1/32<br>w_whip_python 1/256 | 人ひとりのみこむ砂漠の主。<br>角のようなうろこが目じるし。 |

#### `mummy` ミイラ（不死・m）
王墓を守る死者たち。兵、呪い、神官、将軍、そして王家の者。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `mummy_1` | ミイラ兵 | T0 / 7 | mummy | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | hp1.15 agi.8 | 攻撃4 · e_bandage2 | i_herb 1/8<br>bd_wrap_cloth 1/32<br>hn_tomb_wrap 1/256 | 包帯を巻かれた王墓の兵。<br>包帯をのばして縛りつける。 |
| `mummy_2` | 呪いミイラ | T2 / 19 | mummy 色相+250 彩.4 明.9 ＋光る目 | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | hp1.1 mag1.1 agi.8 | 攻撃3 · e_curse2 · e_bandage2 | i_panacea 1/8<br>hn_curse_wrap 1/32<br>hd_cursed_wrap 1/256 | 呪いの言葉を刻んだ包帯。<br>声を聞くと術が使えなくなる。 |
| `mummy_3` | ミイラ神官 | T4 / 31 | mummy 色相+20 彩.5 ＋頭巾・杖 | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | atk.8 mag1.3 mdef1.3 | 攻撃2 · e_dark_bolt2 · e_revive_ally1[倒れた仲間あり] · e_heal_ally1[HP<60%] · e_curse1 | i_ether 1/8<br>w_staff_tombpriest 1/32<br>w_staff_ankh 1/256 | 王墓の祭りを続ける死者の神官。<br>倒れた仲間を起こす。 |
| `mummy_4` | ミイラ将軍 | T6 / 43 | mummy 色相+10 彩.6 ＋かぶと(plume)・剣・盾 | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | hp1.25 atk1.2 def1.15 agi.85 | 攻撃3 · e_slash2 · e_howl1 · e_bandage1 | i_revive 1/8<br>ac_scarab 1/32<br>w_sword_tombgeneral 1/256 | 千年前の王の軍を率いた将軍。<br>今も墓の兵に号令をかける。 |
| `mummy_5` | 王家のミイラ | T8 / 55 | mummy 色相+20 彩.7 明1.05 ＋冠(nemes)・マント | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | hp1.3 mag1.25 mdef1.2 agi.85 | 攻撃2 · e_death_word1 · e_dark_mist2 · e_revive_ally1[倒れた仲間あり] · e_curse1 | i_elixir 1/8<br>ac_royal_ankh 1/32<br>bd_royal_linen 1/256 | 王家の血をひく古いミイラ。<br>死の言葉で生者を招く。 |

#### `cactus` サボテン（植物・m）
砂漠をうろつくサボテン。針を飛ばし、花を咲かせ、大将になる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `cactus_1` | サボテン小僧 | T0 / 7 | cactus | 火1.25 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.1 def1.1 agi.85 | 攻撃4 · e_needles2 | i_herb 1/8<br>bd_wrap_cloth 1/32<br>sh_cactus 1/256 | とことこ歩くサボテンの子。<br>抱きつくと痛い目にあう。 |
| `cactus_2` | 針サボテン | T2 / 19 | cactus 色相-15 彩1.1 明.9 ＋とげ | 火1.25 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.1 atk1.05 def1.1 agi.85 | 攻撃2 · e_needles4 | i_herb 1/8<br>hn_curse_wrap 1/32<br>w_bow_needlecactus 1/256 | 全身の針を雨のように飛ばす。<br>遠くにいても安心できない。 |
| `cactus_3` | 花咲きサボテン | T4 / 31 | cactus 色相+10 ＋花 | 火1.25 水.5 土.75 | 斬1.25 | 眠.5 毒.5 | hp1.15 mag1.1 agi.85 | 攻撃2 · e_sleep_pollen2 · e_needles2 · e_heal_self1[HP<50%] | i_ether 1/8<br>sh_scorpion_shell 1/32<br>ac_desert_rose 1/256 | 真っ赤な花を咲かせたサボテン。<br>甘い香りで眠りを誘う。 |
| `cactus_4` | サボテン大将 | T6 / 43 | cactus 色相-10 彩1.2 明.85 ＋ひげ(mustache)・とげ・かぶと(kabuto) | 火1.25 水.5 風1.5 土.25（親和土） | 斬1.25 | 眠.5 毒.5 | hp1.3 atk1.15 def1.2 agi.85 | 攻撃2 · e_needles3 · e_focus1[1回] · e_heavy1 | i_herb2 1/8<br>w_katana_sand 1/32<br>w_club_cactus_king 1/256 | ひげのような針が自慢の大将。<br>砂漠のサボテンを束ねる。 |

#### `sandworm` ミミズ（虫・l）
砂の下を泳ぐ巨大なミミズ。砂ぼこり、岩の体、大地の揺れ。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `sandworm_1` | 砂ミミズ | T0 / 7 | sandworm | 風1.5 土.25（親和土） | — | 毒.5 | hp1.2 atk1.05 agi.7 | 攻撃4 · e_swallow1 · e_dust2 | i_stone_earth 1/8<br>w_dagger_scorpion 1/32<br>bd_sandworm_hide 1/256 | 砂の下からいきなり現れる。<br>大きな口で何でものみこむ。 |
| `sandworm_2` | 岩ミミズ | T3 / 25 | sandworm 彩.3 明.85 ＋装甲板(rock) | 風1.5 土.25（親和土） | — | 毒.5 | hp1.25 def1.3 agi.65 | 攻撃3 · e_crush2 · e_quake2 | i_herb2 1/8<br>w_fist_wormtooth 1/32<br>w_greatsword_rockworm 1/256 | 岩をまとったミミズ。<br>地面を揺らして獲物を倒す。 |
| `sandworm_3` | 大地ミミズ | T6 / 43 | sandworm 色相-20 彩1.1 明.75 ＋とげ・結晶 | 風1.5 土.25（親和土） | — | 毒.5 | hp1.35 atk1.15 def1.2 agi.65 | 攻撃2 · e_swallow2 · e_quake2 · e_dust1 | i_elixir 1/8<br>w_axe_dune 1/32<br>w_greatsword_duneworm 1/256 | 大陸の地下をめぐるという主。<br>動くたびに大地が鳴る。 |

#### `wolf` オオカミ（獣・m）
雪原の群れ。霜の牙、吹雪の息、月影、そして狼王。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `wolf_1` | 灰色オオカミ | T0 / 7 | wolf 彩.5 | 火1.25 | — | — | atk1.05 agi1.15 | 攻撃4 · e_bite2 · e_howl1[1回] | i_herb 1/8<br>bd_wolf_pelt 1/32<br>w_fist_greywolf 1/256 | 雪原を群れで走るオオカミ。<br>遠吠えで仲間を奮い立たせる。 |
| `wolf_2` | 霜牙オオカミ | T2 / 19 | wolf 色相+20 彩.6 明1.15 ＋霜 | 火1.25 水.25 土1.5（親和水） | — | — | atk1.1 agi1.15 | 攻撃3 · e_frost_bite3 | i_stone_water 1/8<br>w_dagger_frost 1/32<br>w_dagger_frostfang 1/256 | 牙に霜をまとうオオカミ。<br>噛まれた所から凍りつく。 |
| `wolf_3` | 吹雪オオカミ | T4 / 31 | wolf 彩.2 明1.3 ＋霜・霧 | 火1.25 水.25 土1.5（親和水） | — | — | hp1.05 atk1.05 mag1.1 agi1.15 | 攻撃2 · e_frost_breath2 · e_bite2 · e_howl1[1回] | i_herb2 1/8<br>ac_blizzard_charm 1/32<br>bd_blizzard_fur 1/256 | 吹雪の中から現れる白い狼。<br>凍てつく息で群れを守る。 |
| `wolf_4` | 月影オオカミ | T6 / 43 | wolf 色相+40 彩.8 明.5 ＋光る目・オーラ | 火1.25 光1.5 闇.25（親和闇） | — | — | atk1.15 agi1.25 | 攻撃3 · e_double2 · e_shadow_bite2 · e_howl1[1回] | i_stone_dark 1/8<br>w_katana_moon 1/32<br>w_katana_moonshadow 1/256 | 月の出ている夜だけ現れる。<br>影から影へと跳び回る。 |
| `wolf_5` | 氷牙の狼王 | T8 / 55 | wolf 彩.3 明1.2 ＋冠(ice)・霜・オーラ | 火1.25 水.25 土1.5（親和水） | — | — | hp1.3 atk1.15 agi1.2 | 攻撃2 · e_frost_breath2 · e_frost_bite2 · e_call_lesser1[数<5] · e_howl1[1回] | i_elixir 1/8<br>w_fist_wolfking 1/32<br>w_greatsword_wolfking 1/256 | 氷の冠をいただく狼たちの王。<br>一声で吹雪を呼ぶという。 |

#### `yeti` 雪男（獣・l）
雪山の大男。雪玉、氷の拳、雪崩。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `yeti_1` | 雪男 | T0 / 7 | yeti | 火1.5 水.25 土1.5（親和水） | — | — | hp1.2 atk1.15 agi.8 | 攻撃4 · e_crush1 · e_snowball2 · e_headbutt1 | i_herb 1/8<br>bd_wolf_pelt 1/32<br>w_fist_yeti 1/256 | 雪山に住む毛むくじゃらの大男。<br>大きな雪玉を投げてくる。 |
| `yeti_2` | 氷の雪男 | T3 / 25 | yeti 色相+20 彩1.2 ＋結晶・霜 | 火1.5 水.25 土1.5（親和水） | — | — | hp1.25 atk1.2 def1.1 agi.8 | 攻撃3 · e_frost_fist2 · e_frost_breath1 · e_focus1[1回] | i_herb2 1/8<br>w_greatsword_beastfang 1/32<br>w_axe_icefist 1/256 | 体に氷の結晶が生えた雪男。<br>氷の拳は岩をもくだく。 |
| `yeti_3` | 大雪男 | T6 / 43 | yeti 色相+20 彩.8 明.9 ＋面(bone)・角 | 火1.5 水.25 土1.5（親和水） | — | — | hp1.35 atk1.2 agi.8 | 攻撃2 · e_crush2 · e_avalanche2 · e_roar1[4手ごと@1] | i_elixir 1/8<br>hd_yeti_fur 1/32<br>hd_yeti_skull 1/256 | 雪男たちの長。骨の面をかぶり、<br>雪崩を呼んで山を守る。 |

#### `frostling` 氷の小鬼（妖精・m）
雪の子どもの小鬼。こおり・つらら・ふぶき小僧から雪の大将、冬将軍へ。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `frostling_1` | こおり小僧 | T0 / 7 | frostling | 火1.25 水.25 土1.5 光.5 闇1.5（親和水） | — | 混.5 | hp.9 mag1.2 agi1.1 | 攻撃4 · e_frost2 | i_stone_water 1/8<br>ac_snow_crystal 1/32<br>w_fist_icicle_child 1/256 | 雪の日に生まれる小さな小鬼。<br>冷たい息で遊び相手を探す。 |
| `frostling_2` | つらら小僧 | T2 / 19 | frostling 色相+15 ＋結晶 | 火1.25 水.25 土1.5 光.5 闇1.5（親和水） | — | 混.5 | hp.9 mag1.2 agi1.1 | 攻撃3 · e_icicle3 | i_herb 1/8<br>w_dagger_frost 1/32<br>w_dagger_icicle 1/256 | 頭につららを生やした小鬼。<br>つららを次々に落としてくる。 |
| `frostling_3` | ふぶき小僧 | T4 / 31 | frostling 彩.4 明1.2 ＋霧 | 火1.25 水.25 土1.5 光.5 闇1.5（親和水） | — | 混.5 | hp.95 mag1.25 agi1.15 | 攻撃2 · e_frost2 · e_frost_breath2 · e_hush1 | i_ether 1/8<br>ac_blizzard_charm 1/32<br>hd_blizzard_hat 1/256 | 吹雪をまとって現れる小鬼。<br>通ったあとは真っ白になる。 |
| `frostling_4` | 雪の大将 | T6 / 43 | frostling 色相+20 彩1.1 ＋かぶと(kabuto)・剣(ice) | 火1.25 水.25 土1.5 光.5 闇1.5（親和水） | — | 混.5 | hp1.15 atk1.15 mag1.1 agi1.05 | 攻撃3 · e_frost_fist2 · e_frost2 · e_howl1[1回] | i_herb2 1/8<br>w_katana_moon 1/32<br>w_katana_snowgeneral 1/256 | 氷のかぶとをかぶった小鬼の<br>大将。雪の子らを率いる。 |
| `frostling_5` | 冬将軍 | T8 / 55 | frostling 色相+30 彩1.2 明.9 ＋かぶと(kabuto_big)・マント・オーラ | 火1.25 水吸収 土1.5 光.5 闇1.5（親和水） | — | 混.5 | hp1.3 atk1.1 mag1.2 agi1.05 | 攻撃2 · e_frost2 · e_icicle2 · e_freeze_gaze1 · e_haste1[1回] | i_elixir 1/8<br>w_fist_wolfking 1/32<br>bd_winter_armor 1/256 | 冬そのものといわれる小鬼の王。<br>来ると、春が遠のく。 |

#### `owl` フクロウ（鳥・m・飛ぶ）
雪の夜のフクロウ。眠りの歌、惑わしの目、そして術を使う賢者。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `owl_1` | 雪フクロウ | T0 / 7 | owl | 風1.5 土.5 | 突1.25 | — | hp.95 agi1.2・飛 | 攻撃4 · e_peck2 | i_stone_wind 1/8<br>bd_wolf_pelt 1/32<br>hd_owl_feather 1/256 | 雪原の夜を音もなく飛ぶ。<br>暗がりでもよく目が見える。 |
| `owl_2` | ねむりフクロウ | T2 / 19 | owl 色相+30 彩.7 ＋帽子(night) | 風1.5 土.5 | 突1.25 | — | hp.95 mag1.1 agi1.15・飛 | 攻撃2 · e_lullaby3 | i_herb 1/8<br>w_dagger_frost 1/32<br>ac_lullaby_quill 1/256 | ナイトキャップのフクロウ。<br>子守歌で旅人を眠らせる。 |
| `owl_3` | まどいフクロウ | T4 / 31 | owl 色相+270 彩1.1 ＋光る目(spiral) | 風1.5 土.5 | 突1.25 | — | hp.95 mag1.15 agi1.2・飛 | 攻撃2 · e_evil_eye2 · e_gust2 | i_panacea 1/8<br>ac_blizzard_charm 1/32<br>hd_spiral_monocle 1/256 | うずまきの目でじっと見つめる。<br>見返すと頭がくらくらする。 |
| `owl_4` | 賢者フクロウ | T6 / 43 | owl 色相+200 彩.8 ＋帽子(wizard)・本・片めがね | 風1.5 土.5 光.25 闇1.5（親和光） | 突1.25 | — | hp1.05 mag1.3 mdef1.25 agi1.1・飛 | 攻撃1 · e_light_ray2 · e_gust2 · e_ward1[1回] · e_heal_all1[HP<60%] | i_ether2 1/8<br>w_katana_moon 1/32<br>w_staff_owl_sage 1/256 | 本を抱えたフクロウの学者。<br>術を使いこなし仲間を守る。 |

#### `mammoth` マンモス（獣・l）
雪原の巨獣。突進と踏み鳴らし。鉄の牙、そして大王。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `mammoth_1` | 雪原マンモス | T0 / 7 | mammoth | 火1.25 | — | — | hp1.3 atk1.1 def1.2 agi.7 | 攻撃4 · e_charge2 · e_stomp1 | i_herb 1/8<br>ac_snow_crystal 1/32<br>bd_mammoth_fur 1/256 | 長い毛におおわれた雪原の巨獣。<br>群れを守って突進してくる。 |
| `mammoth_2` | 鉄牙マンモス | T3 / 25 | mammoth 色相-10 彩.8 明.85 ＋牙(iron)・装甲板 | 火1.25 | — | — | hp1.35 atk1.15 def1.3 agi.65 | 攻撃3 · e_charge2 · e_stomp2 · e_harden1[1回] | i_herb2 1/8<br>w_greatsword_beastfang 1/32<br>w_spear_irontusk 1/256 | 牙に鉄のかぶせをはめられた<br>マンモス。昔の戦の名残。 |
| `mammoth_3` | 大王マンモス | T6 / 43 | mammoth 彩.2 明1.25 ＋冠・霜 | 火1.25 水.25 土1.5（親和水） | — | — | hp1.45 atk1.2 def1.25 agi.65 | 攻撃2 · e_charge2 · e_avalanche2 · e_roar1[4手ごと@2] | i_elixir 1/8<br>hd_yeti_fur 1/32<br>sh_mammoth_king 1/256 | 白い毛の大王。一歩ごとに<br>雪原の雪が震えて落ちる。 |

#### `ghost` 霊（霊体・m）
霧の湿原にさまよう霊。泣き、呪い、恨み、やがて冥界の王になる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `ghost_1` | 迷い霊 | T0 / 7 | ghost | 光1.5 | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp.95 mag1.1 mdef1.2 | 攻撃4 · e_scare1 · e_water_bolt2 | i_herb 1/8<br>hd_mist_hood 1/32<br>ac_lost_lantern 1/256 | 霧の中で道に迷ったままの霊。<br>冷たい水を浴びせてくる。 |
| `ghost_2` | 泣き霊 | T2 / 19 | ghost 色相+20 彩1.2 ＋したたり(tears) | 光1.5 | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp.95 mag1.15 mdef1.2 | 攻撃2 · e_wail2 · e_water_bolt2 | i_ether 1/8<br>w_whip_mist 1/32<br>bd_mourning_veil 1/256 | すすり泣く声が霧に響く。<br>聞いた者は眠りに落ちる。 |
| `ghost_3` | 呪い霊 | T4 / 31 | ghost 色相+120 彩.8 明.8 ＋光る目・鎖 | 光1.5 闇.25（親和闇） | 斬.5 打.5 突.5 | 毒1 死1 気1 | mag1.2 mdef1.2 | 攻撃2 · e_curse2 · e_dark_bolt2 · e_mind_suck1 | i_panacea 1/8<br>sh_bell_shield 1/32<br>w_whip_chain_curse 1/256 | 鎖を引きずる紫の霊。<br>呪いの声で術を封じる。 |
| `ghost_4` | 恨み霊 | T6 / 43 | ghost 色相+330 彩1.2 明.7 ＋鎖・オーラ | 光1.5 闇.25（親和闇） | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp1.05 mag1.25 mdef1.2 | 攻撃2 · e_death_word1 · e_dark_mist2 · e_life_suck2 | i_revive 1/8<br>w_sword_bellringer 1/32<br>w_katana_grudge 1/256 | 深い恨みを抱いて消えない霊。<br>死の言葉をささやく。 |
| `ghost_5` | 冥界の霊王 | T8 / 55 | ghost 色相+250 彩1.2 明.6 ＋冠・マント・オーラ | 光1.5 闇.25（親和闇） | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp1.3 mag1.3 mdef1.25 | 攻撃1 · e_death_word1 · e_dark_mist2 · e_life_suck2 · e_call_lesser1[数<5] · e_curse1 | i_elixir 1/8<br>ac_underworld_bell 1/32<br>bd_underworld_robe 1/256 | 冥界から霊を率いて現れる王。<br>命あるものを妬んでいる。 |

#### `wisp` 鬼火（霊体・s）
沼に灯る火。鬼火・化け火は火、人魂・黄泉の火は闇。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `wisp_1` | 鬼火 | T0 / 7 | wisp 色相-170 彩1.2 | 火.25 水1.5 光1.5（親和火） | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp.85 mag1.2 agi1.2 | 攻撃3 · e_fire_bolt3 | i_stone_fire 1/8<br>hd_mist_hood 1/32<br>ac_ember_lamp 1/256 | 夜の沼にぽっと灯る火の玉。<br>近づく者を火の玉で焼く。 |
| `wisp_2` | 化け火 | T2 / 19 | wisp 色相-100 彩1.2 ＋光る目(face) | 火.25 水1.5 光1.5（親和火） | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp.85 mag1.2 agi1.2 | 攻撃2 · e_fire_bolt2 · e_evil_eye2 | i_herb 1/8<br>w_whip_mist 1/32<br>w_staff_goblinfire 1/256 | 顔のある緑の火。にやりと<br>笑って人を惑わせる。 |
| `wisp_3` | 人魂 | T4 / 31 | wisp 彩.4 明1.2 ＋オーラ | 光1.5 闇.25（親和闇） | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp.9 mag1.2 agi1.2 | 攻撃2 · e_mind_suck2 · e_dark_bolt2 | i_ether 1/8<br>sh_bell_shield 1/32<br>ac_soul_bead 1/256 | 青白くゆれる魂の火。<br>魔力を吸い取っていく。 |
| `wisp_4` | 黄泉の火 | T6 / 43 | wisp 色相+80 彩1.2 明.7 ＋オーラ・髑髏の印 | 光1.5 闇.25（親和闇） | 斬.5 打.5 突.5 | 毒1 死1 気1 | hp.95 mag1.3 agi1.2 | 攻撃1 · e_dark_mist2 · e_life_suck2 · e_yomi_fire2 | i_stone_dark 1/8<br>w_sword_bellringer 1/32<br>w_bow_yomi 1/256 | 黄泉の国から燃え移った火。<br>青黒い炎は消えにくい。 |

#### `frog` カエル（水棲・m）
沼のカエル。舌、毒、丸のみ、そして鐘のように鳴く大ガエル。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `frog_1` | 沼ガエル | T0 / 7 | frog | 火.75 水.25 土1.5（親和水） | 突1.25 | — | hp1.1 | 攻撃4 · e_tongue2 | i_herb 1/8<br>bd_marsh_coat 1/32<br>ft_frog_boots 1/256 | 湿原のどこにでもいるカエル。<br>長い舌でぴしゃりと打つ。 |
| `frog_2` | 毒ガエル | T2 / 19 | frog 色相+180 彩1.3 ＋斑点 | 火.75 水.25 土1.5（親和水） | 突1.25 | 毒1 | hp1.05 atk1.05 agi1.05 | 攻撃3 · e_poison_spit3 | i_antidote 1/8<br>w_spear_reed 1/32<br>hn_poisonfrog 1/256 | 青と黄色のあざやかなカエル。<br>その色は毒のしるし。 |
| `frog_3` | 大口ガエル | T4 / 31 | frog 色相+40 彩.8 明.9 | 火.75 水.25 土1.5（親和水） | 突1.25 | — | hp1.3 atk1.15 agi.85 | 攻撃3 · e_swallow2 · e_tongue1 · e_heal_self1[HP<50%] | i_herb2 1/8<br>bd_bog_mail 1/32<br>w_club_bullfrog 1/256 | 何でものみこむ大きな口。<br>人の子どもほどの大きさ。 |
| `frog_4` | 鐘鳴りガエル | T6 / 43 | frog 色相+20 彩.7 明.95 ＋鐘 | 火.75 水.25 土1.5（親和水） | 突1.25 | — | hp1.3 mag1.1 agi.9 | 攻撃2 · e_bell_croak3 · e_tongue1 | i_panacea 1/8<br>w_sword_bellringer 1/32<br>ac_frog_bell 1/256 | 首に鐘をさげた大ガエル。<br>鳴き声が鐘のように響く。 |

#### `doll` 人形（魔造・m）
霧の館の古い陶器人形。針、踊り、呪い、そして貴婦人。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `doll_1` | ひび割れ人形 | T0 / 7 | doll | 水1.25 風.75 | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | def1.1 | 攻撃4 · e_needle2 | i_herb 1/8<br>hd_mist_hood 1/32<br>hd_porcelain_mask 1/256 | 顔にひびの入った陶器の人形。<br>夜な夜な廊下を歩き回る。 |
| `doll_2` | 踊り人形 | T2 / 19 | doll 色相+300 彩.9 ＋リボン | 水1.25 風.75 | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | agi1.2 | 攻撃2 · e_dance2 · e_double2 | i_eyedrop 1/8<br>w_whip_mist 1/32<br>ft_dance_shoes 1/256 | いつまでも踊り続ける人形。<br>見ていると目が回ってくる。 |
| `doll_3` | 呪い人形 | T4 / 31 | doll 彩.4 明.7 ＋まち針・光る目 | 水1.25 風.75 光1.5 闇.25（親和闇） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.05 mag1.2 mdef1.1 | 攻撃2 · e_curse2 · e_hex2 | i_panacea 1/8<br>sh_bell_shield 1/32<br>w_dagger_hexpin 1/256 | 針を刺された人形。刺した者の<br>恨みを代わりに晴らすという。 |
| `doll_4` | 貴婦人人形 | T6 / 43 | doll 色相+200 彩.8 ＋帽子(lady)・日傘 | 水1.25 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.1 mag1.25 mdef1.2 agi1.05 | 攻撃2 · e_haste1[1回] · e_charm2 · e_dark_bolt1 · e_heal_ally1[HP<50%] | i_ether2 1/8<br>ac_soul_candle 1/32<br>sh_lady_parasol 1/256 | 館の主が愛した大きな人形。<br>今も客をもてなそうとする。 |

#### `lizardman` トカゲ兵（人型・m）
沼に暮らすトカゲの戦士たち。兵・槍兵・呪術師・族長。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `lizardman_1` | 沼トカゲ兵 | T0 / 7 | lizardman | 水.25 土1.5（親和水） | — | — | hp1.05 atk1.05 | 攻撃4 · e_slash2 | i_herb 1/8<br>bd_marsh_coat 1/32<br>sh_reed_shield 1/256 | 沼の見回りをするトカゲの兵。<br>曲がった刀で斬りつける。 |
| `lizardman_2` | トカゲの槍兵 | T2 / 19 | lizardman 色相+20 ＋槍・かぶと(cap) | 水.25 土1.5（親和水） | — | — | hp1.05 atk1.1 | 攻撃3 · e_thrust3 | i_herb 1/8<br>w_spear_reed 1/32<br>w_spear_marsh 1/256 | 槍を構えたトカゲの兵。<br>水辺ではめっぽう強い。 |
| `lizardman_3` | トカゲの呪術師 | T4 / 31 | lizardman 色相+250 彩.8 ＋頭巾・杖 | 水.25 土1.5（親和水） | — | — | hp.95 atk.8 mag1.3 mdef1.2 | 攻撃1 · e_water_bolt2 · e_heal_ally2[HP<60%] · e_hush1 | i_ether 1/8<br>bd_bog_mail 1/32<br>w_staff_swampcharm 1/256 | 沼の精霊と話すトカゲの術師。<br>仲間の傷をふさぐ。 |
| `lizardman_4` | トカゲの族長 | T6 / 43 | lizardman 色相-20 彩1.1 ＋冠(feather)・斧・盾 | 水.25 土1.5（親和水） | — | — | hp1.3 atk1.2 def1.1 | 攻撃3 · e_heavy2 · e_howl2[1回] · e_tide1 | i_herb2 1/8<br>ac_soul_candle 1/32<br>w_axe_chieftain 1/256 | 羽根飾りのトカゲの族長。<br>大斧で沼の一族を守る。 |

#### `spider` クモ（虫・m）
古い館と森の奥の大グモ。糸、毒、影、そして女郎グモ。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `spider_1` | 糸吐きグモ | T0 / 7 | spider | 火1.5 | — | 毒.5 | agi1.1 | 攻撃3 · e_web2 · e_bite1 | i_antidote 1/8<br>bd_marsh_coat 1/32<br>hn_silk_gloves 1/256 | 天井から糸を吐きかける。<br>絡まると手足が重くなる。 |
| `spider_2` | 毒グモ | T2 / 19 | spider 色相+250 彩1.1 ＋斑点 | 火1.5 | — | 毒1 | atk1.05 agi1.1 | 攻撃3 · e_poison_bite3 · e_web1 | i_antidote 1/8<br>w_spear_reed 1/32<br>w_whip_spidersilk 1/256 | 背に緑の斑点がある毒グモ。<br>噛まれると毒がまわる。 |
| `spider_3` | 影グモ | T4 / 31 | spider 彩.3 明.4 ＋光る目(many) | 火1.5 光1.5 闇.25（親和闇） | — | 毒.5 | atk1.1 agi1.2 | 攻撃2 · e_shadow_bite2 · e_web1 · e_ink1 | i_stone_dark 1/8<br>bd_bog_mail 1/32<br>bd_shadow_silk 1/256 | 影にまぎれる黒いクモ。<br>赤い目だけが闇に光る。 |
| `spider_4` | 女郎グモ | T6 / 43 | spider 色相+40 彩1.3 明.9 ＋光る目(many)・斑点(stripes) | 火1.5 | — | 毒.5 | hp1.25 atk1.1 mag1.1 agi1.1 | 攻撃2 · e_bind2 · e_poison_bite2 · e_call_lesser1[数<5] · e_web1 | i_panacea 1/8<br>ac_soul_candle 1/32<br>ac_golden_web 1/256 | 金と黒の縞の大グモ。<br>巣には宝物が引っかかっている。 |

#### `merman` 魚人（水棲・m）
南の海の魚人たち。見張り、銛兵、呪い師、騎士。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `merman_1` | 魚人の見張り | T0 / 7 | merman | 火.75 水.25 土1.5（親和水） | — | — | hp1.05 atk1.05 | 攻撃4 · e_thrust2 | i_herb 1/8<br>w_spear_coral 1/32<br>ft_fin_boots 1/256 | 岩礁から海を見張る魚人。<br>三つ叉の槍で突いてくる。 |
| `merman_2` | 魚人の銛兵 | T2 / 19 | merman 色相-30 ＋かぶと(fin) | 火.75 水.25 土1.5（親和水） | — | — | hp1.05 atk1.15 | 攻撃3 · e_thrust2 · e_tide1 | i_stone_water 1/8<br>sh_tide_shield 1/32<br>w_spear_harpoon 1/256 | 銛を投げて船を沈める魚人。<br>狙った獲物は逃さない。 |
| `merman_3` | 魚人の呪い師 | T4 / 31 | merman 色相+90 彩.8 ＋頭巾・杖(coral) | 火.75 水.25 土1.5（親和水） | — | — | hp.95 atk.8 mag1.3 mdef1.2 | 攻撃1 · e_water_bolt2 · e_tide2 · e_heal_ally1[HP<60%] | i_ether 1/8<br>ac_pearl_ear 1/32<br>w_staff_coralwand 1/256 | さんごの杖をもつ魚人の術師。<br>海の水を思いのままに操る。 |
| `merman_4` | 魚人の騎士 | T6 / 43 | merman 色相+190 彩.7 ＋装甲板・かぶと(fin)・盾 | 火.75 水.25 土1.5（親和水） | — | — | hp1.25 atk1.15 def1.25 | 攻撃3 · e_thrust2 · e_harden1[1回] · e_tide1 | i_herb2 1/8<br>w_katana_tide 1/32<br>w_sword_merknight 1/256 | 海の王に仕える魚人の騎士。<br>うろこの鎧は刃を通さない。 |

#### `kraken` タコ（水棲・l）
洞窟と船底の大ダコ。墨、八本の腕、渦潮。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `kraken_1` | 墨吹きダコ | T0 / 7 | kraken | 火.75 水.25 土1.5（親和水） | — | — | hp1.15 agi.85 | 攻撃3 · e_ink2 · e_tentacles2 | i_eyedrop 1/8<br>w_spear_coral 1/32<br>hd_octopus_cap 1/256 | 岩のすき間にひそむ大ダコ。<br>墨を吐いて目をくらます。 |
| `kraken_2` | 八本腕ダコ | T3 / 25 | kraken 色相-20 彩1.2 ＋斑点(suckers) | 火.75 水.25 土1.5（親和水） | — | — | hp1.2 atk1.1 agi.85 | 攻撃2 · e_tentacles3 · e_bind2 | i_herb2 1/8<br>w_fist_wormtooth 1/32<br>w_whip_eightarm 1/256 | 八本の腕で同時に襲いかかる。<br>捕まったら逃げられない。 |
| `kraken_3` | 渦潮ダコ | T6 / 43 | kraken 色相+200 彩.9 明.8 ＋風の渦(whirl) | 火.75 水.25 土1.5（親和水） | — | — | hp1.25 atk1.1 mag1.15 agi.85 | 攻撃2 · e_tentacles2 · e_tide2 · e_ink1 | i_elixir 1/8<br>w_katana_tide 1/32<br>bd_whirlpool 1/256 | 体のまわりに渦をまとう大ダコ。<br>船ごと海に引きこむ。 |

#### `skeleton` 骸骨（不死・m）
幽霊船の骸骨の船乗り。水夫・海賊・砲手・航海士・提督。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `skeleton_1` | 骸骨の水夫 | T0 / 7 | skeleton ＋バンダナ | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | atk1.05 | 攻撃4 · e_slash2 | i_herb 1/8<br>w_spear_coral 1/32<br>w_sword_cutlass 1/256 | 沈んだ船から戻ってきた水夫。<br>さびた刀で斬りかかる。 |
| `skeleton_2` | 骸骨の海賊 | T2 / 19 | skeleton ＋帽子(tricorn)・眼帯 | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | atk1.1 agi1.05・お金×1.5 | 攻撃3 · e_double2 · e_slash1 | i_herb 1/8<br>sh_tide_shield 1/32<br>ac_pirate_coin 1/256 | 宝を探し続ける骸骨の海賊。<br>金貨の音にだけは反応する。 |
| `skeleton_3` | 骸骨の砲手 | T4 / 31 | skeleton 色相+20 彩.6 ＋バンダナ・大砲 | 火.25 水1.5 光2 闇吸収（親和火） | 打1.25 | 毒1 死1 眠1 混.5 | hp1.05 atk1.1 | 攻撃2 · e_cannon3 | i_bomb 1/8<br>ac_pearl_ear 1/32<br>w_bow_cannon_arm 1/256 | 腕ごと大砲になった骸骨。<br>船の上でも撃ってくる。 |
| `skeleton_4` | 骸骨の航海士 | T6 / 43 | skeleton ＋帽子(tricorn)・マント | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | hp1.1 atk1.1 mag1.1 | 攻撃2 · e_slash2 · e_howl1[1回] · e_curse1 | i_revive 1/8<br>w_katana_tide 1/32<br>ac_ghost_compass 1/256 | 死んでも航路を探す航海士。<br>行き先はもう誰も知らない。 |
| `skeleton_5` | 骸骨の提督 | T8 / 55 | skeleton ＋帽子(bicorne)・マント・剣 | 火1.5 光2 闇吸収 | 打1.25 | 毒1 死1 眠1 混.5 | hp1.3 atk1.15 mag1.1 | 攻撃2 · e_cannon2 · e_call_lesser1[数<5] · e_howl1[1回] · e_slash2 | i_elixir 1/8<br>ac_admiral_medal 1/32<br>w_sword_admiral 1/256 | 沈んだ艦隊を率いる提督。<br>号令ひとつで大砲が鳴る。 |

#### `golem` 石くれ兵（魔造・l）
鉱山を守る石の兵。石・鉄鉱・宝玉。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `golem_1` | 石くれ兵 | T0 / 7 | golem | 水1.25 風1.5 土.25（親和土） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.3 atk1.05 def1.3 agi.65 | 攻撃4 · e_crush1 · e_harden1[1回] | i_stone_earth 1/8<br>sh_ore_shield 1/32<br>sh_rubble 1/256 | 坑道の石が集まってできた兵。<br>動きはのろいが力は強い。 |
| `golem_2` | 鉄鉱兵 | T3 / 25 | golem 色相+180 彩.4 明.8 ＋装甲板(rivet) | 水1.5 風1.5 土.25（親和土） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.35 atk1.1 def1.4 agi.6 | 攻撃3 · e_crush2 · e_stomp2 · e_rock1 | i_herb2 1/8<br>w_fist_wormtooth 1/32<br>w_club_ironore 1/256 | 鉄鉱石の体をもつ兵。<br>さびた鉄が赤く浮いている。 |
| `golem_3` | 宝玉兵 | T6 / 43 | golem 色相+60 彩.8 明1.1 ＋結晶・紋様 | 水1.25 風1.5 土.25（親和土） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.4 atk1.1 mag1.15 def1.35 agi.6 | 攻撃2 · e_crush2 · e_gem_beam2 · e_harden1[1回] | i_elixir 1/8<br>ac_gem_core 1/32<br>bd_gem_plate 1/256 | 宝石をちりばめた石の兵。<br>胸の宝玉から光線を撃つ。 |

#### `mole` モグラ（獣・m）
坑道を掘るモグラ。爪、火薬、そして鉱夫の親方。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `mole_1` | 穴掘りモグラ | T0 / 7 | mole | 火1.25 風1.5 土.25（親和土） | — | — | hp1.1 atk1.05 agi.9 | 攻撃4 · e_claw2 | i_stone_earth 1/8<br>hn_mole_claw 1/32<br>hn_digger 1/256 | 坑道のあちこちに穴をあける。<br>暗がりでも鼻がきく。 |
| `mole_2` | 鉄爪モグラ | T2 / 19 | mole 色相-10 彩.8 ＋帽子(miner)・鉄爪 | 火1.25 風1.5 土.25（親和土） | — | — | hp1.1 atk1.15 agi.9 | 攻撃3 · e_claw2 · e_dust2 | i_herb 1/8<br>w_axe_pick 1/32<br>w_fist_ironclaw 1/256 | 鉄の爪をはめたモグラ。<br>鉱夫の帽子を失敬している。 |
| `mole_3` | 火薬モグラ | T4 / 31 | mole 色相+10 彩1.1 ＋帽子(miner)・火薬玉 | 火.25 水1.5（親和火） | — | — | hp1.05 atk1.1 agi.95 | 攻撃2 · e_bomb3 · e_claw1 | i_bomb 1/8<br>ac_gem_eye 1/32<br>ac_blasting_cap 1/256 | 火薬玉を抱えたモグラ。<br>坑道で投げるのはやめてほしい。 |
| `mole_4` | モグラ大親方 | T6 / 43 | mole 色相+20 彩.7 明.85 ＋帽子(miner)・ひげ・つるはし | 火1.25 風1.5 土.25（親和土） | — | — | hp1.3 atk1.15 def1.1 agi.85 | 攻撃2 · e_quake2 · e_call_lesser1[数<5] · e_claw2 | i_herb2 1/8<br>w_club_forgehammer 1/32<br>w_axe_mole_boss 1/256 | 白ひげのモグラの親方。<br>地響きで坑道をゆさぶる。 |

#### `beetle` カブト（虫・s）
岩山の甲虫。石・鉄・火花・金剛と殻が硬くなる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `beetle_1` | 石カブト | T0 / 7 | beetle | 火1.25 風1.5 土.25（親和土） | 斬.75 打1.25 | 毒.5 | def1.4 agi.8 | 攻撃4 · e_horn2 | i_stone_earth 1/8<br>sh_ore_shield 1/32<br>hd_beetle_horn 1/256 | 石のような殻の甲虫。<br>大きな角で突き上げる。 |
| `beetle_2` | 鉄カブト | T2 / 19 | beetle 彩.2 明.7 | 火1.25 風1.5 土.25（親和土） | 斬.75 打1.25 | 毒.5 | def1.6 agi.8 | 攻撃3 · e_horn2 · e_harden1[1回] | i_herb 1/8<br>w_axe_pick 1/32<br>sh_beetle_shell 1/256 | 鉄の殻をもつ甲虫。<br>鉱石を食べて殻を育てる。 |
| `beetle_3` | 火花カブト | T4 / 31 | beetle 色相-40 彩1.2 ＋火花 | 火.25 水1.5（親和火） | 斬.75 打1.25 | 毒.5 | mag1.15 def1.4 agi.85 | 攻撃2 · e_horn2 · e_fire_bolt2 | i_stone_fire 1/8<br>ac_gem_eye 1/32<br>w_spear_sparkhorn 1/256 | 殻をこすって火花を散らす。<br>坑道の火事の元になる。 |
| `beetle_4` | 金剛カブト | T6 / 43 | beetle 彩.3 明1.3 ＋結晶 | 火1.25 風1.5 土.25（親和土） | 斬.75 打1.25 | 毒.5 | hp1.1 def1.8 agi.8 | 攻撃2 · e_horn2 · e_harden1[1回] · e_charge2 | i_herb2 1/8<br>w_club_forgehammer 1/32<br>bd_diamond_shell 1/256 | 金剛石のように光る甲虫。<br>どんな刃もはね返す。 |

#### `crystal` 水晶（魔造・s）
坑道の奥で生まれる、浮かぶ水晶。色で属性が変わる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `crystal_1` | 水晶くず | T0 / 7 | crystal | 水1.25 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp.9 mag1.2 def1.2 | 攻撃3 · e_light_ray2 | i_stone_light 1/8<br>sh_ore_shield 1/32<br>ac_quartz_shard 1/256 | 坑道の奥に浮かぶ透明な水晶。<br>光を集めて撃ってくる。 |
| `crystal_2` | 紅水晶 | T2 / 19 | crystal 色相-60 彩1.4 | 火.25 水1.5 風.75（親和火） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp.9 mag1.25 def1.2 | 攻撃2 · e_fire_bolt3 | i_stone_fire 1/8<br>ac_ruby_chip 1/32<br>w_staff_ruby 1/256 | 炎を閉じこめた赤い水晶。<br>中で火がゆれている。 |
| `crystal_3` | 青水晶 | T4 / 31 | crystal 色相+180 彩1.3 | 水.25 風.75 土1.5（親和水） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp.95 mag1.25 def1.2 | 攻撃2 · e_water_bolt2 · e_frost1 | i_stone_water 1/8<br>ac_sapphire_chip 1/32<br>hd_sapphire 1/256 | 冷たい水を閉じこめた水晶。<br>さわると指が凍える。 |
| `crystal_4` | 紫水晶 | T6 / 43 | crystal 色相+250 彩1.3 明.85 | 水1.25 風.75 光1.5 闇.25（親和闇） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | mag1.3 def1.2 mdef1.2 | 攻撃1 · e_dark_bolt2 · e_mind_suck2 · e_ward1[1回] | i_stone_dark 1/8<br>ac_gem_core 1/32<br>ac_amethyst 1/256 | 闇を吸いこんだ紫の水晶。<br>近くの者の魔力を奪う。 |

#### `goblin` 小鬼（人型・m）
山の坑道にすむ小鬼の一族。斧兵、火薬師、隊長、王。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `goblin_1` | 小鬼 | T0 / 7 | goblin | — | — | — | atk1.1・お金×1.3 | 攻撃4 · e_heavy1 | i_herb 1/8<br>hn_mole_claw 1/32<br>w_club_goblin 1/256 | 光り物が大好きな緑の小鬼。<br>こん棒を振り回して襲う。 |
| `goblin_2` | 小鬼の斧兵 | T2 / 19 | goblin 色相+20 ＋斧・かぶと(cap) | — | — | — | hp1.05 atk1.15・お金×1.3 | 攻撃3 · e_heavy2 · e_double1 | i_herb 1/8<br>w_axe_pick 1/32<br>w_axe_goblin 1/256 | 手斧をもった小鬼の兵。<br>数で押してくる。 |
| `goblin_3` | 小鬼の火薬師 | T4 / 31 | goblin 色相-40 ＋バンダナ・ゴーグル・火薬玉 | 火.25 水1.5（親和火） | — | — | hp.95 atk1.1 agi1.05・お金×1.3 | 攻撃2 · e_bomb3 | i_bomb 1/8<br>ac_gem_eye 1/32<br>ac_powder_pouch 1/256 | ゴーグルをかけた小鬼。<br>火薬玉を投げるのが得意。 |
| `goblin_4` | 小鬼の隊長 | T6 / 43 | goblin 色相+40 彩1.1 ＋かぶと(horned)・剣・盾 | — | — | — | hp1.2 atk1.15 def1.1・お金×1.3 | 攻撃3 · e_howl2[1回] · e_double1 · e_slash1 | i_herb2 1/8<br>w_club_forgehammer 1/32<br>w_sword_goblincaptain 1/256 | 角かぶとの小鬼の隊長。<br>手下を奮い立たせて戦う。 |
| `goblin_5` | 小鬼の王 | T8 / 55 | goblin 色相+60 彩1.2 ＋冠・マント・剣 | — | — | — | hp1.35 atk1.2 def1.1・お金×2 | 攻撃2 · e_call_lesser2[数<5] · e_howl1[1回] · e_heavy2 · e_bomb1 | i_elixir 1/8<br>ac_goblin_hoard 1/32<br>ac_goblin_crown 1/256 | 山の小鬼すべての王。<br>宝の山の上にふんぞり返る。 |

#### `salamander` 火トカゲ（獣・m）
火山の火トカゲ。火を吹き、溶岩をまとい、角を生やし、竜の王になる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `salamander_1` | 火トカゲ | T0 / 7 | salamander | 火.25 水1.5（親和火） | — | — | atk1.05 agi1.05 | 攻撃4 · e_fire_bite2 | i_stone_fire 1/8<br>hd_ash_mask 1/32<br>ft_salamander 1/256 | 熱い岩の上で昼寝するトカゲ。<br>燃える牙で噛みつく。 |
| `salamander_2` | 火吹きトカゲ | T2 / 19 | salamander 色相+10 彩1.1 ＋炎(mouth) | 火.25 水1.5（親和火） | — | — | atk1.05 mag1.1 | 攻撃3 · e_fire_breath2 · e_fire_bite1 | i_herb 1/8<br>w_axe_ember 1/32<br>w_bow_firebreath 1/256 | 口から炎を吹くトカゲ。<br>草原ならすぐ火事になる。 |
| `salamander_3` | 溶岩トカゲ | T4 / 31 | salamander 色相-20 彩1.2 明.7 ＋火の粉 | 火吸収 水1.5（親和火） | — | — | hp1.1 atk1.1 def1.15 | 攻撃3 · e_lava_spit2 · e_harden1[1回] | i_herb2 1/8<br>bd_ash_cloak 1/32<br>bd_lava_scale 1/256 | 溶岩の中を泳ぐトカゲ。<br>火を浴びるほど元気になる。 |
| `salamander_4` | 炎角トカゲ | T6 / 43 | salamander 色相-10 彩1.2 ＋角・火の粉 | 火.25 水1.5（親和火） | — | — | hp1.1 atk1.15 mag1.1 | 攻撃2 · e_fire_breath2 · e_horn2 · e_focus1[1回] | i_stone_fire 1/8<br>w_katana_ash 1/32<br>w_spear_flamehorn 1/256 | 燃える角を生やした火トカゲ。<br>竜の血をひくといわれる。 |
| `salamander_5` | 竜王トカゲ | T8 / 55 | salamander 色相-30 彩1.2 明.9 ＋冠・こうもり翼・オーラ | 火吸収 水1.5（親和火） | — | — | hp1.3 atk1.15 mag1.1 | 攻撃2 · e_inferno_breath2 · e_fire_bite2 · e_roar1[4手ごと@1] | i_elixir 1/8<br>ac_phoenix_ash 1/32<br>w_greatsword_dragonking 1/256 | 竜になりかけた火トカゲの王。<br>吐く炎は岩をも溶かす。 |

#### `imp` 悪魔（魔族・s）
灰の荒野の小悪魔。すす・火の粉・灰・業火、そして軍師。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `imp_1` | すす悪魔 | T0 / 7 | imp 彩.2 明.6 | 火.25 水1.5 光1.5 闇.5（親和火） | — | 死.8 | hp.9 atk1.05 agi1.2 | 攻撃4 · e_thrust2 · e_fire_bolt1 | i_herb 1/8<br>hd_ash_mask 1/32<br>w_spear_soot_fork 1/256 | すすにまみれた小さな悪魔。<br>三叉のほこで突いてくる。 |
| `imp_2` | 火の粉悪魔 | T2 / 19 | imp ＋火の粉 | 火.25 水1.5 光1.5 闇.5（親和火） | — | 死.8 | hp.9 mag1.15 agi1.2 | 攻撃3 · e_fire_bolt2 · e_fire_rain1 | i_stone_fire 1/8<br>w_axe_ember 1/32<br>ac_ember_horn 1/256 | 火の粉をまき散らす赤い悪魔。<br>焚き火のいたずら者。 |
| `imp_3` | 灰の悪魔 | T4 / 31 | imp 彩.1 明1.1 ＋煙 | 火.25 水1.5 光1.5 闇.5（親和火） | — | 死.8 | hp.95 mag1.15 agi1.2 | 攻撃2 · e_ash_cloud2 · e_fire_rain2 | i_panacea 1/8<br>bd_ash_cloak 1/32<br>bd_ash_cloak_devil 1/256 | 灰をかぶって白くなった悪魔。<br>熱い灰で目をふさぐ。 |
| `imp_4` | 業火の悪魔 | T6 / 43 | imp 色相+20 彩1.2 ＋角・炎 | 火.25 水1.5 光1.5 闇.5（親和火） | — | 死.8 | mag1.25 agi1.2 | 攻撃2 · e_fire_rain2 · e_fire_bolt2 · e_haste1[1回] | i_herb2 1/8<br>w_katana_ash 1/32<br>w_staff_hellfire 1/256 | 炎をまとう大角の悪魔。<br>火の雨で荒野を焼く。 |
| `imp_5` | 悪魔の軍師 | T8 / 55 | imp 色相+260 彩1 ＋帽子(wizard)・本・片めがね | 光1.5 闇.25（親和闇） | — | 死.8 | hp1.1 mag1.3 mdef1.25 agi1.15 | 攻撃1 · e_dark_bolt2 · e_dispel1[3手ごと@1] · e_haste1[1回] · e_ward1[1回] · e_gloom1 | i_ether2 1/8<br>ac_phoenix_ash 1/32<br>hd_strategist 1/256 | 悪魔たちに策を授ける軍師。<br>味方を固め、守りを消す。 |

#### `gargoyle` 石像鬼（魔族・m・飛ぶ）
古い神殿や塔の屋根に止まる石の鬼。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `gargoyle_1` | 石像鬼 | T0 / 7 | gargoyle | 風1.5 土.5 光1.5 闇.5 | 斬.75 打1.25 突.75 | 死.8 | hp1.05 def1.3 agi.95・飛 | 攻撃4 · e_claw2 · e_harden1[1回] | i_herb 1/8<br>hd_ash_mask 1/32<br>hd_gargoyle_face 1/256 | 屋根の飾りのふりをした石の鬼。<br>近づくと羽を広げる。 |
| `gargoyle_2` | 黒曜の石像鬼 | T2 / 19 | gargoyle 彩.3 明.45 ＋光る目 | 風1.5 土.5 光1.5 闇.5 | 斬.75 打1.25 突.75 | 死.8 | hp1.05 atk1.1 def1.35・飛 | 攻撃3 · e_dive2 · e_claw1 | i_herb 1/8<br>w_axe_ember 1/32<br>w_dagger_obsidian 1/256 | 黒曜石でできた石像鬼。<br>刃のような翼で切り裂く。 |
| `gargoyle_3` | 火炎の石像鬼 | T4 / 31 | gargoyle 色相-150 彩1.3 ＋火の粉 | 火.25 水1.5 風1.5 土.5 光1.5 闇.5（親和火） | 斬.75 打1.25 突.75 | 死.8 | hp1.1 atk1.1 mag1.1 def1.3・飛 | 攻撃2 · e_fire_breath2 · e_claw2 | i_stone_fire 1/8<br>bd_ash_cloak 1/32<br>sh_lava_gargoyle 1/256 | 溶岩で焼き固められた石像鬼。<br>体の割れ目が赤く光る。 |
| `gargoyle_4` | 石像鬼の長 | T6 / 43 | gargoyle 彩.5 明.85 ＋角・冠 | 風1.5 土.5 光1.5 闇.5 | 斬.75 打1.25 突.75 | 死.8 | hp1.25 atk1.15 def1.35・飛 | 攻撃2 · e_gaze2 · e_dive2 · e_harden1[1回] | i_herb2 1/8<br>w_katana_ash 1/32<br>w_axe_gargoyle 1/256 | 大角の石像鬼の長。<br>にらまれると体が石になる。 |

#### `orc` 大鬼（人型・l）
荒野をのし歩く大鬼。力まかせと鉄棒。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `orc_1` | 荒野の大鬼 | T0 / 7 | orc 色相+20 彩.8 | 火.25 水1.5（親和火） | — | — | hp1.2 atk1.2 def.95 mdef.85 agi.8・お金×1.3 | 攻撃4 · e_heavy2 | i_herb 1/8<br>w_club_ashen 1/32<br>w_club_wasteland 1/256 | 荒野をうろつく大きな鬼。<br>丸太を軽々と振り回す。 |
| `orc_2` | 鉄棒の大鬼 | T3 / 25 | orc 色相-30 彩.9 ＋金棒・かぶと(horned) | 火.25 水1.5（親和火） | — | — | hp1.25 atk1.25 mdef.85 agi.8・お金×1.3 | 攻撃3 · e_heavy2 · e_sweep2 · e_armor_break1 | i_herb2 1/8<br>w_greatsword_beastfang 1/32<br>w_club_kanabo 1/256 | とげのついた鉄棒の大鬼。<br>なぎ払われると吹き飛ぶ。 |
| `orc_3` | 大鬼の頭目 | T6 / 43 | orc 色相-60 彩1.1 ＋角・装甲板 | 火.25 水1.5（親和火） | — | — | hp1.35 atk1.25 def1.05 agi.8 | 攻撃2 · e_rampage2 · e_focus1[1回] · e_sweep2 · e_roar1[4手ごと@2] | i_elixir 1/8<br>w_fist_brimstone 1/32<br>bd_oni_armor 1/256 | 赤い肌の大鬼の頭目。<br>怒ると誰にも止められない。 |

#### `chimera` 三頭獣（獣・l）
シシ・ヤギ・ヘビの頭をもつ獣。火の息が強くなっていく。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `chimera_1` | まだら獣 | T0 / 7 | chimera 色相+20 彩.8 | 火.25 水1.5（親和火） | — | — | hp1.15 atk1.1 | 攻撃3 · e_bite2 · e_fire_breath1 · e_poison_bite1 | i_herb 1/8<br>w_club_ashen 1/32<br>hn_chimera_paw 1/256 | シシとヤギとヘビが一つになった<br>獣。三つの口で襲う。 |
| `chimera_2` | 三頭獣 | T3 / 25 | chimera 色相-10 彩1.1 ＋角 | 火.25 水1.5（親和火） | — | — | hp1.2 atk1.15 mag1.1 | 攻撃2 · e_fire_breath2 · e_poison_bite1 · e_bite2 | i_herb2 1/8<br>sh_wyvern_scale 1/32<br>w_fist_triple_fang 1/256 | 三つの頭がそれぞれに吠える。<br>シシの頭は火を吐く。 |
| `chimera_3` | 業火の三頭獣 | T6 / 43 | chimera 色相-30 彩1.3 明.85 ＋炎・角 | 火吸収 水1.5（親和火） | — | — | hp1.3 atk1.2 mag1.15 | 攻撃2 · e_inferno_breath2 · e_bite2 · e_roar1[4手ごと@0] | i_elixir 1/8<br>w_fist_brimstone 1/32<br>bd_chimera_hide 1/256 | 燃えるたてがみの三頭獣。<br>吐く業火は荒野を焦がす。 |

#### `eyeball` 目玉（魔族・s）
高原と塔に浮かぶ目玉。にらみ、惑わし、星見、天の大目玉。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `eyeball_1` | のぞき目玉 | T0 / 7 | eyeball | 光1.5 闇.5 | — | 死.8 | hp.9 mag1.1 agi1.1 | 攻撃4 · e_gaze1 | i_eyedrop 1/8<br>hd_star_hood 1/32<br>ac_peeping_eye 1/256 | ふわふわ浮かぶ目玉。<br>物かげからじっと見ている。 |
| `eyeball_2` | にらみ目玉 | T2 / 19 | eyeball 色相-60 彩1.2 ＋光る目 | 光1.5 闇.5 | — | 死.8 | hp.9 mag1.15 agi1.1 | 攻撃2 · e_gaze3 | i_herb 1/8<br>w_bow_star 1/32<br>hd_glare_band 1/256 | 赤い目でにらみつける目玉。<br>にらまれると体が動かない。 |
| `eyeball_3` | まどわし目玉 | T4 / 31 | eyeball 色相+120 彩1.2 ＋第三の目 | 光.25 闇1.5（親和光） | — | 死.8 | hp.95 mag1.2 agi1.1 | 攻撃2 · e_evil_eye3 | i_panacea 1/8<br>ac_astrolabe 1/32<br>ac_mind_eye 1/256 | 瞳の色がくるくる変わる目玉。<br>見ていると気が遠くなる。 |
| `eyeball_4` | 星見の目玉 | T6 / 43 | eyeball 色相+200 彩1.1 明1.1 ＋光輪 | 光.25 闇1.5（親和光） | — | 死.8 | mag1.25 mdef1.2 agi1.1 | 攻撃1 · e_light_ray2 · e_flash2 · e_ward1[1回] | i_stone_light 1/8<br>w_sword_starblade 1/32<br>w_bow_stargazer 1/256 | 瞳に星を映す目玉。<br>夜空を見上げて光を放つ。 |
| `eyeball_5` | 天の大目玉 | T8 / 55 | eyeball 色相+180 彩.6 明1.25 ＋冠・羽の翼・オーラ | 光.25 闇1.5（親和光） | — | 死.8 | hp1.3 mag1.3 mdef1.25 agi1.05 | 攻撃1 · e_holy_beam2 · e_light_ray2 · e_gaze1 · e_dispel1[4手ごと@2] | i_elixir 1/8<br>ac_heaven_feather 1/32<br>hd_heaven_eye 1/256 | 白い翼をもつ大きな目玉。<br>天からすべてを見下ろす。 |

#### `darkmage` 魔術師（人型・m）
星読みの塔に集まったはぐれ術師。見習い・炎・風・闇。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `darkmage_1` | 見習い魔術師 | T0 / 7 | darkmage 色相+20 彩.8 | — | — | — | hp.9 atk.75 mag1.3 def.85 mdef1.3 | 攻撃2 · e_fire_bolt2 · e_water_bolt2 | i_ether 1/8<br>hd_star_hood 1/32<br>w_staff_apprentice 1/256 | 塔で術を学ぶ見習い。<br>火と水の術を覚えたばかり。 |
| `darkmage_2` | 炎の魔術師 | T2 / 19 | darkmage 色相+140 彩1.2 | 火.25 水1.5（親和火） | — | — | hp.9 atk.75 mag1.35 def.85 mdef1.3 | 攻撃1 · e_fire_bolt2 · e_fire_rain2 · e_ward1[1回] | i_stone_fire 1/8<br>w_bow_star 1/32<br>bd_flame_robe 1/256 | 赤い法衣の魔術師。<br>火の雨で何でも焼きはらう。 |
| `darkmage_3` | 風の魔術師 | T4 / 31 | darkmage 色相-150 彩1.1 | 火1.5 風.25（親和風） | — | — | hp.9 atk.75 mag1.35 def.85 mdef1.3 agi1.15 | 攻撃1 · e_wind_blade2 · e_gust2 · e_hush1 · e_haste1[1回] | i_stone_wind 1/8<br>ac_astrolabe 1/32<br>ft_wind_sandals 1/256 | 緑の法衣の魔術師。<br>風の刃と沈黙の霧を使う。 |
| `darkmage_4` | 闇の魔術師 | T6 / 43 | darkmage 色相+30 彩1.1 明.6 ＋オーラ・杖 | 光1.5 闇.25（親和闇） | — | — | hp.95 atk.75 mag1.4 def.85 mdef1.3 | 攻撃1 · e_dark_bolt2 · e_dark_mist2 · e_gloom1 · e_mind_suck1 | i_ether2 1/8<br>w_sword_starblade 1/32<br>w_staff_abyss 1/256 | 禁じられた闇の術を学んだ者。<br>塔の奥で人を待ち伏せる。 |

#### `automaton` からくり（魔造・m）
賢者カペラが残したからくり兵。兵・弓兵・術兵・大将。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `automaton_1` | からくり兵 | T0 / 7 | automaton | 水1.5 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.05 def1.2 agi.95 | 攻撃4 · e_double2 | i_herb 1/8<br>hd_star_hood 1/32<br>hn_gear_gauntlet 1/256 | ぜんまいで動く真ちゅうの兵。<br>命令をいまも守り続ける。 |
| `automaton_2` | からくり弓兵 | T2 / 19 | automaton 色相+20 彩.8 ＋弓 | 水1.5 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | def1.15 | 攻撃2 · e_arrow3 | i_eyedrop 1/8<br>w_bow_star 1/32<br>w_bow_clockwork 1/256 | 弓を組みこまれたからくり兵。<br>中列の者もねらってくる。 |
| `automaton_3` | からくり術兵 | T4 / 31 | automaton 色相+160 彩.8 ＋杖(coil)・紋様 | 水1.25 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | mag1.25 def1.1 mdef1.2 | 攻撃1 · e_light_ray2 · e_zap2 · e_ward1[1回] | i_ether 1/8<br>ac_astrolabe 1/32<br>ac_tesla_coil 1/256 | 術の回路を組みこまれた兵。<br>電撃で相手をしびれさせる。 |
| `automaton_4` | からくり大将 | T6 / 43 | automaton 色相+20 彩1.1 ＋かぶと(kabuto)・剣・マント | 水1.5 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.25 atk1.15 def1.25 | 攻撃3 · e_double2 · e_harden1[1回] · e_howl1[1回] · e_zap1 | i_herb2 1/8<br>w_sword_starblade 1/32<br>w_katana_clockwork 1/256 | かぶとを飾ったからくりの大将。<br>塔の兵を指揮する。 |

#### `armor` 鎧（魔造・m）
中身のない鎧。番兵、騎士、そして闇の黒金。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `armor_1` | からっぽの鎧 | T0 / 7 | armor 彩.6 明.9 | 水1.5 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.2 def1.35 agi.8 | 攻撃4 · e_slash2 | i_herb 1/8<br>sh_star_buckler 1/32<br>bd_hollow_mail 1/256 | 中に誰もいない古い鎧。<br>兜の奥で赤い光がゆれる。 |
| `armor_2` | 番兵の鎧 | T2 / 19 | armor 色相+20 ＋盾・槍 | 水1.5 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.2 def1.4 agi.8 | 攻撃3 · e_thrust2 · e_harden1[1回] | i_herb 1/8<br>hd_sentry_helm 1/32<br>sh_sentinel 1/256 | 塔の門を守る鎧の番兵。<br>盾を構えて槍で突く。 |
| `armor_3` | 騎士の鎧 | T4 / 31 | armor 色相+200 彩.8 ＋かぶと(plume)・マント・剣 | 水1.25 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.25 atk1.1 def1.35 | 攻撃3 · e_slash2 · e_double1 · e_focus1[1回] | i_herb2 1/8<br>bd_knight_mail 1/32<br>w_sword_knightless 1/256 | 騎士の姿のまま動く鎧。<br>主の名はとうに忘れられた。 |
| `armor_4` | 黒金の鎧 | T6 / 43 | armor 彩.5 明.45 ＋角・オーラ・剣(great) | 水1.25 風.75 光1.5 闇.25（親和闇） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.3 atk1.2 def1.35 | 攻撃2 · e_dark_slash2 · e_slash1 · e_harden1[1回] | i_revive 1/8<br>hd_blackgold_helm 1/32<br>w_greatsword_blackgold 1/256 | 黒と金の重い鎧。<br>闇をまとった大剣をふるう。 |

#### `wyvern` 飛竜（竜・l・飛ぶ）
高原の空を飛ぶ竜。風を起こし、嵐の息を吐く。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `wyvern_1` | 若飛竜 | T0 / 7 | wyvern | 火1.5 水.75 風.25 土.5 光.75 闇.75（親和風） | 斬.75 突1.25 | 死1 眠.5 混.5 | hp1.1 atk1.1 agi1.1・飛 | 攻撃3 · e_bite2 · e_gust2 | i_stone_wind 1/8<br>sh_star_buckler 1/32<br>hd_wyvern_crest 1/256 | 高原の岩場に巣をつくる竜。<br>まだ若いが、気は荒い。 |
| `wyvern_2` | 風切り飛竜 | T3 / 25 | wyvern 色相+30 彩1.1 ＋角 | 火1.5 水.75 風.25 土.5 光.75 闇.75（親和風） | 斬.75 突1.25 | 死1 眠.5 混.5 | hp1.15 atk1.15 agi1.15・飛 | 攻撃2 · e_dive2 · e_gust2 · e_tail1 | i_herb2 1/8<br>sh_wyvern_scale 1/32<br>w_spear_windcutter 1/256 | 風を切る音だけを残して飛ぶ。<br>急降下で獲物をさらう。 |
| `wyvern_3` | 嵐飛竜 | T6 / 43 | wyvern 彩.3 明.7 ＋風の渦・火花 | 火1.5 水.75 風.25 土.5 光.75 闇.75（親和風） | 斬.75 突1.25 | 死1 眠.5 混.5 | hp1.25 atk1.15 mag1.1 agi1.15・飛 | 攻撃2 · e_storm_breath2 · e_dive2 · e_tail1 | i_elixir 1/8<br>hd_blackgold_helm 1/32<br>bd_storm_scale 1/256 | 雷雲を連れて飛ぶ灰色の竜。<br>嵐の息で空を荒らす。 |

#### `scribe` 白衣の書記（人型・m）
記録院の書記たち。白の書の力で相手の力と記憶を書き写して消す。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `scribe_1` | 白衣の書記 | T8 / 55 | scribe | 光.25 闇1.5（親和光） | — | — | mag1.2 mdef1.2 | 攻撃2 · e_transcribe2 · e_ink2 · e_light_ray1 | i_ether2 1/8<br>hd_scribe_hood 1/32<br>w_dagger_penknife 1/256 | 記録院の白衣の書記。<br>相手の力を書き写して消す。 |
| `scribe_2` | 白衣の写本師 | T8 / 55 | scribe ＋本・羽ペン | 光.25 闇1.5（親和光） | — | — | hp1.05 mag1.25 mdef1.25 | 攻撃1 · e_transcribe2 · e_forget2 · e_heal_ally1[HP<60%] · e_ward1[1回] | i_ether2 1/8<br>bd_scribe_coat 1/32<br>sh_copy_book 1/256 | 白の書を写し続ける写本師。<br>ふれた記憶を奪っていく。 |
| `scribe_3` | 白衣の司書長 | T8 / 55 | scribe ＋頭巾・杖・オーラ | 光.25 闇1.5（親和光） | — | — | hp1.15 mag1.3 mdef1.3 | 攻撃1 · e_forget2 · e_erase_all1[3手ごと@1] · e_light_ray2 · e_heal_all1[HP<60%] · e_call_lesser1[数<5] | i_elixir 1/8<br>ac_archive_key 1/32<br>w_staff_librarian 1/256 | 大書庫を取りしきる司書長。<br>書記たちを呼び集める。 |

#### `book` 魔書（魔造・s）
大書庫の本が魔物になったもの。紙なので火に弱い。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `book_1` | かみつき本 | T8 / 55 | book | 火1.5 水1.25 風.75 | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp.95 atk1.1 agi1.1 | 攻撃3 · e_bite2 · e_paper_cut2 | i_herb2 1/8<br>hd_scribe_hood 1/32<br>sh_biting_tome 1/256 | 表紙を口のように開く本。<br>読もうとすると噛みつく。 |
| `book_2` | 呪いの書 | T8 / 55 | book 色相+250 彩1.2 明.8 ＋鎖・光る目 | 火1.5 水1.25 風.75 光1.5 闇.25（親和闇） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | mag1.3 mdef1.2 | 攻撃1 · e_curse2 · e_dark_bolt2 · e_gloom1 | i_panacea 1/8<br>bd_scribe_coat 1/32<br>ac_cursed_bookmark 1/256 | 鎖でしばられた呪いの書。<br>読んだ者の声を奪う。 |
| `book_3` | 白紙の書 | T8 / 55 | book 彩0 明1.3 ＋オーラ | 火1.5 水1.25 風.75 光.25 闇1.5（親和光） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.05 mag1.3 mdef1.3 | 攻撃1 · e_forget3 · e_erase_all1[3手ごと@0] · e_light_ray2 | i_ether2 1/8<br>ac_archive_key 1/32<br>ac_blank_book 1/256 | 文字が一つもない白い本。<br>ふれた記憶を白紙にする。 |

#### `mimic` 宝箱（魔造・s）
宝箱に化けた魔物。お金をたくさん持ち、レアを落としやすい。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `mimic_1` | 牙の宝箱 | T0 / 7 | mimic | 水1.25 風.75 | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.2 atk1.15 def1.2 agi.9・お金×3 | 攻撃3 · e_bite3 | i_herb2 1/8<br>ac_mimic_tongue 1/16<br>ac_treasure_nose 1/128 | 宝箱のふりをした魔物。<br>ふたを開けると牙が並ぶ。 |
| `mimic_2` | 毒牙の宝箱 | T2 / 19 | mimic 色相+100 彩.8 ＋したたり | 水1.25 風.75 | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.2 atk1.15 def1.2 agi.9・お金×3 | 攻撃2 · e_poison_bite2 · e_bite2 | i_antidote 1/8<br>ac_mimic_key 1/16<br>hn_greedy_hand 1/128 | ふたのすき間から毒がしたたる。<br>中身はたいてい空っぽ。 |
| `mimic_3` | 呪いの宝箱 | T4 / 31 | mimic 色相+240 彩.7 ＋鎖・光る目 | 水1.25 風.75 | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.25 atk1.2 def1.2 agi.9・お金×3 | 攻撃2 · e_curse1 · e_abyss_fang2 · e_bite1 | i_revive 1/8<br>ac_mimic_chain 1/16<br>ac_cursed_lock 1/128 | 鎖を巻かれた古い宝箱。<br>開けた者を奈落へ引きこむ。 |
| `mimic_4` | 奈落の宝箱 | T6 / 43 | mimic 彩.5 明.45 ＋冠・オーラ | 水1.25 風.75 光1.5 闇.25（親和闇） | 斬.75 打1.5 突.75 | 毒1 眠1 混1 死1 | hp1.3 atk1.2 mag1.15 def1.25 agi.9・お金×3 | 攻撃2 · e_abyss_fang2 · e_dark_mist2 | i_elixir 1/8<br>ac_abyss_key 1/16<br>ac_abyss_hoard 1/128 | 底の見えない黒い宝箱。<br>中には何があるのだろう。 |

#### `void` 虚無の騎士（霊体・m）
忘れられた騎士たちの虚無。闇の剣と虚無の波。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `void_1` | 虚無の騎士 | T9 / 61 | void_wraith | 光1.5 闇.25（親和闇） | 斬.75 打.75 突.75 | 毒1 死1 気1 | hp1.15 atk1.2 mag1.15 | 攻撃3 · e_dark_slash2 · e_void_wave2 · e_curse1 | i_elixir 1/8<br>ac_void_shard 1/32<br>w_sword_void 1/256 | 名を忘れられた騎士の成れの果て。<br>鎧の中は星のない夜。 |
| `void_2` | 虚無の騎士団長 | T9 / 61 | void_wraith ＋冠・マント | 光1.5 闇.25（親和闇） | 斬.75 打.75 突.75 | 毒1 死1 気1 | hp1.3 atk1.25 mag1.2 | 攻撃2 · e_dark_slash2 · e_void_wave2 · e_death_word1 · e_dispel1[3手ごと@2] | i_revive2 1/8<br>ac_void_shard 1/32<br>sh_void_aegis 1/256 | 虚無の騎士たちを率いる団長。<br>守りの力を打ち消してくる。 |

#### `chaos` 混沌獣（獣・l）
忘れられた恐れが寄り集まった獣。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `chaos_1` | 混沌の獣 | T9 / 61 | chaos_beast | 火1.25 光1.5 闇.25（親和闇） | — | — | hp1.25 atk1.2 agi.9 | 攻撃3 · e_rampage2 · e_roar1[4手ごと@1] · e_chaos_breath2 | i_elixir 1/8<br>w_greatsword_chaoshorn 1/32<br>w_axe_chaos 1/256 | 七つの目をもつ混沌の獣。<br>恐れの形が集まってできた。 |
| `chaos_2` | 混沌の王獣 | T9 / 61 | chaos_beast 色相+40 彩1.1 ＋冠・結晶・オーラ | 火1.25 光1.5 闇.25（親和闇） | — | — | hp1.4 atk1.25 mag1.1 agi.9 | 攻撃2 · e_rampage2 · e_chaos_breath2 · e_quake1 · e_focus1[1回] | i_revive2 1/8<br>w_greatsword_chaoshorn 1/32<br>bd_chaos_hide 1/256 | 冠のような角をもつ混沌の王。<br>忘却の底の奥深くにひそむ。 |

#### `demon` 魔神（魔族・l）
海の向こうの伝説に語られた魔王の軍勢の、忘れられた影。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `demon_1` | 忘れられた魔兵 | T8 / 55 | demon 彩.6 明.8 | 光1.5 闇.25（親和闇） | — | 死.8 | hp1.15 atk1.2 mag1.1 | 攻撃3 · e_dark_slash2 · e_fire_rain1 · e_howl1[1回] | i_elixir 1/8<br>ac_archive_key 1/32<br>w_fist_demon_claw 1/256 | 伝説の魔王の兵の影。<br>名も顔も忘れられている。 |
| `demon_2` | 忘れられた魔将 | T9 / 61 | demon 色相+200 彩.8 明.7 ＋装甲板・かぶと(horned)・剣(great) | 光1.5 闇.25（親和闇） | — | 死.8 | hp1.3 atk1.25 def1.15 | 攻撃3 · e_dark_slash2 · e_sweep2 · e_gloom1 | i_revive2 1/8<br>ac_void_shard 1/32<br>hd_demon_general 1/256 | 魔王軍の将だった影。<br>三百年たっても剣を振るう。 |
| `demon_3` | 忘れられた魔神 | T9 / 61 | demon 色相+240 彩.9 明.65 ＋冠・第三の目・オーラ | 光1.5 闇.25（親和闇） | — | 死.8 | hp1.4 atk1.25 mag1.25 | 攻撃2 · e_dark_mist2 · e_inferno_breath1 · e_death_word1 · e_gloom1 · e_dispel1[4手ごと@3] | i_revive2 1/8<br>w_greatsword_chaoshorn 1/32<br>ac_demon_eye 1/256 | 第三の眼をもつ魔神の影。<br>恐れの記憶だけで動いている。 |

#### `quicksilver` 白銀のしずく（軟体・s・鋼）
水銀のようなゼリー。硬く、すぐ逃げるが、経験値とお金が多い。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `quicksilver_1` | 白銀のしずく | T2 / 19 | jelly 〔白銀〕 | 火1.25 | 斬1.25 打.5 | — | agi2.5・鋼 HP固定8 | 攻撃3 · e_water_bolt1 | i_ether 1/4<br>ac_silver_drop 1/16<br>ac_quicksilver 1/128 | 水銀のように光るゼリー。<br>打っても打ってもびくともしない。 |
| `quicksilver_2` | 白銀の大しずく | T6 / 43 | jelly ＋小冠 〔白銀〕 | 火1.25 | 斬1.25 打.5 | — | agi2.5・鋼 HP固定10 | 攻撃2 · e_tide1 · e_water_bolt1 | i_ether2 1/4<br>ac_silver_orb 1/16<br>w_whip_quicksilver 1/128 | 白銀のしずくが集まった大玉。<br>出会えたら運がいい。 |

#### `mirror` 鏡の甲虫（虫・s・鋼）
全身が鏡の甲虫。光をはね返して逃げる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `mirror_1` | 鏡の甲虫 | T5 / 37 | beetle 〔鏡〕 | 火1.5 | — | 毒.5 | agi2.5・鋼 HP固定8 | 攻撃3 · e_flash1 | i_ether2 1/4<br>ac_mirror_scale 1/16<br>sh_mirror_shell 1/128 | 鏡のような殻をもつ甲虫。<br>まぶしく光ってすぐ逃げる。 |
| `mirror_2` | 鏡の大甲虫 | T7 / 49 | beetle ＋角 〔鏡〕 | 火1.5 | — | 毒.5 | agi2.5・鋼 HP固定10 | 攻撃2 · e_flash1 · e_light_ray1 | i_elixir 1/4<br>ac_mirror_crest 1/16<br>w_spear_mirrorhorn 1/128 | 鏡の角をもつ大きな甲虫。<br>見た者は自分の顔に驚く。 |

#### `platinum` 白金の灯（霊体・s・鋼）
白金色に燃える灯。最終地方と裏ダンジョンにだけ現れる。

| id | 名前 | 段T / lv | 絵 | 属性の倍率 | 打撃 | 状態の耐性 | 能力 s | 行動（重み・条件） | 通常 / レア / 超レア | 図鑑の説明 |
|---|---|---|---|---|---|---|---|---|---|---|
| `platinum_1` | 白金の灯 | T8 / 55 | wisp 〔白金〕 | 光1.5 | 斬.5 打.5 突.5 | 毒1 死1 気1 | agi2.5・鋼 HP固定10 | 攻撃2 · e_light_ray2 · e_fire_bolt1 | i_elixir 1/4<br>ac_platinum_flame 1/16<br>ac_platinum_heart 1/128 | 白金色に燃える小さな灯。<br>見つけたら逃がしたくない。 |
| `platinum_2` | 白金の大灯 | T9 / 61 | wisp ＋冠 〔白金〕 | 光1.5 | 斬.5 打.5 突.5 | 毒1 死1 気1 | agi2.5・鋼 HP固定12 | 攻撃1 · e_light_ray2 · e_holy_beam1 · e_flash1 | i_revive2 1/4<br>ac_platinum_crown 1/16<br>w_katana_platinum 1/128 | 冠をいただく白金の大きな灯。<br>忘却の底の宝といわれる。 |


---------------------------------------------------------------------------------------------------
## 6. 敵の行動（雑魚用 `e_` 124。担当 A11 `enemy_actions.js`）

### 6.1 決まり
- 威力の規模は成長章 §14.2（特技の物理 P 1.3〜1.8、全体 0.6〜0.8、術 SP 1.0〜1.6・全体 0.6〜0.9、息 0.5〜0.8）に合わせた。メッセージの `{user}` は使った魔物の名前（エンジンが置き換えるのは `{user}` と `{name}`（行動の名前）だけ）。
- 効果の読み方は §1.6。`element` を書いていない `damage` は無属性（`elements` を持つ行動はその中で相手に一番効く属性）。
- 名前は技（05章）・術（06章）の名前と重ならない（検査済み）。ボス・レア魔物の行動（`eb_`）は §11.5。レア魔物は `e_` の行動も使ってよい（`e_gust` `e_water_bolt`）。
- 大まかな分類（id の並び順と同じ）: 物理の単体 32 → 物理の全体・ランダム 10 → 状態異常 39 → 術 23 → 息 6 → 自分・仲間への行動 14（計 124）。

### 6.2 データ（normative。そのまま写してよい形）
```js
Object.assign(R.DB.actions, {
  e_bite: {name: '噛みつき', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}], fx: 'bite', msg: '{user}は鋭い牙で噛みついた！'},
  e_claw: {name: 'ひっかき', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.75, hits: 2}], fx: 'claw', msg: '{user}は爪でひっかいた！'},
  e_tackle: {name: '体当たり', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.35, acc: 0.9}], fx: 'strike', msg: '{user}は体当たりしてきた！'},
  e_peck: {name: 'くちばし', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, kind: 'pierce'}], fx: 'pierce', msg: '{user}はくちばしでつついた！'},
  e_sting: {name: '針で刺す', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.35, kind: 'pierce'}], fx: 'pierce', msg: '{user}は針を突き立てた！'},
  e_horn: {name: '角で突く', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4, kind: 'pierce', critBonus: 8}], fx: 'pierce', msg: '{user}は角を突き立てた！'},
  e_pincer: {name: 'はさみ打ち', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.45, critBonus: 10}], fx: 'claw', msg: '{user}は大きなはさみで打ちすえた！'},
  e_heavy: {name: '力まかせ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.7, acc: 0.8}], fx: 'strike2', msg: '{user}は力まかせに殴りかかった！'},
  e_charge: {name: '突進', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6, acc: 0.85}], fx: 'strike2', msg: '{user}は勢いよく突進してきた！'},
  e_crush: {name: '押しつぶす', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8, acc: 0.8}], fx: 'strike3', msg: '{user}はのしかかってきた！'},
  e_slash: {name: '斬りつけ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4, kind: 'slash'}], fx: 'slash', msg: '{user}は鋭く斬りつけた！'},
  e_double: {name: '二段攻撃', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.8, hits: 2}], fx: 'slash', msg: '{user}はすばやく2回攻撃した！'},
  e_thrust: {name: '突き', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.45, kind: 'pierce'}], fx: 'pierce', msg: '{user}は鋭く突いてきた！'},
  e_arrow: {name: '矢を射る', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, kind: 'pierce'}], fx: 'arrow', msg: '{user}は矢を放った！', aim: 'middle'},
  e_dive: {name: '急降下', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6, acc: 0.9}], fx: 'strike2', msg: '{user}は空から襲いかかった！'},
  e_swallow: {name: '丸のみ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.9, acc: 0.75}], fx: 'bite2', msg: '{user}は大きな口でのみこもうとした！'},
  e_gnaw: {name: 'かじる', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1}, {type: 'buff', stat: 'def', stages: -1, chance: 0.5}], fx: 'bite', msg: '{user}はがりがりとかじりついた！'},
  e_armor_break: {name: '鎧くだき', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2}, {type: 'buff', stat: 'def', stages: -1, chance: 0.6}], fx: 'strike2', msg: '{user}は鎧ごと打ちくだこうとした！'},
  e_drain_bite: {name: '吸血', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9, drain: 0.5}], fx: 'drain', msg: '{user}は血を吸おうと噛みついた！'},
  e_headbutt: {name: '頭突き', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'strike', msg: '{user}は頭から突っこんできた！'},
  e_fire_bite: {name: '炎の牙', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, element: 'fire'}], fx: 'fire', msg: '{user}は燃える牙で噛みついた！'},
  e_frost_bite: {name: '霜の牙', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.1}], fx: 'ice', msg: '{user}は凍てつく牙で噛みついた！'},
  e_shadow_bite: {name: '影の牙', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, element: 'dark'}, {type: 'status', status: 'blind', chance: 0.2}], fx: 'dark', msg: '{user}は影の牙で噛みついた！'},
  e_frost_fist: {name: '氷の拳', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6, element: 'water', acc: 0.9}], fx: 'ice2', msg: '{user}は氷の拳を振り下ろした！'},
  e_dark_slash: {name: '闇の剣', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6, element: 'dark'}], fx: 'dark2', msg: '{user}は闇をまとった剣で斬りつけた！'},
  e_snowball: {name: '雪玉投げ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, element: 'water'}], fx: 'ice', msg: '{user}は大きな雪玉を投げつけた！'},
  e_tongue: {name: '舌をのばす', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2, acc: 1.1}], fx: 'strike', msg: '{user}は長い舌をのばしてきた！'},
  e_needle: {name: '針仕事', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.25, kind: 'pierce'}], fx: 'pierce', msg: '{user}は縫い針を突き刺した！'},
  e_root_bind: {name: '根っこ絡み', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.8}, {type: 'status', status: 'paralyze', chance: 0.2}], fx: 'strike', msg: '{user}は根っこで絡みついた！'},
  e_thorn_vine: {name: 'とげのつる', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2}, {type: 'status', status: 'poison', chance: 0.25}], fx: 'strike', msg: '{user}はとげのつるを振るった！'},
  e_peck_eyes: {name: '目つつき', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9, kind: 'pierce'}, {type: 'status', status: 'blind', chance: 0.4}], fx: 'pierce', msg: '{user}は目をねらってつついた！'},
  e_abyss_fang: {name: '奈落の牙', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2}, {type: 'status', status: 'death', chance: 0.08}], fx: 'bite2', msg: '{user}は奈落のような口で噛みついた！'},
  e_sweep: {name: 'なぎ払い', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.65}], fx: 'slash2', msg: '{user}は大きくなぎ払った！'},
  e_tail: {name: 'しっぽ打ち', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.6}], fx: 'strike', msg: '{user}はしっぽでなぎ払った！'},
  e_stomp: {name: '踏み鳴らし', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.65, element: 'earth'}], fx: 'earth', msg: '{user}は地面を踏み鳴らした！'},
  e_rampage: {name: '暴れ回る', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.6, hits: 3}], fx: 'strike', msg: '{user}はめちゃくちゃに暴れ回った！'},
  e_needles: {name: '針の雨', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 4, kind: 'pierce'}], fx: 'pierce', msg: '{user}は針を次々に飛ばした！'},
  e_tentacles: {name: '足の乱舞', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 4}], fx: 'strike', msg: '{user}はたくさんの足で襲いかかった！'},
  e_cannon: {name: '大砲', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.75, element: 'fire'}], fx: 'explosion', msg: '{user}は大砲をぶっ放した！'},
  e_bomb: {name: '火薬玉投げ', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.7, element: 'fire'}], fx: 'explosion', msg: '{user}は火薬玉を投げつけた！'},
  e_avalanche: {name: '雪崩', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.75, element: 'water'}, {type: 'status', status: 'stun', chance: 0.1}], fx: 'ice2', msg: '{user}は雪崩を起こした！'},
  e_paper_cut: {name: '紙の刃', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 3, kind: 'slash'}], fx: 'slash', msg: '{user}の紙の体が刃になって舞った！'},
  e_poison_bite: {name: '毒の牙', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1}, {type: 'status', status: 'poison', chance: 0.35}], fx: 'bite', msg: '{user}は毒の牙で噛みついた！'},
  e_poison_sting: {name: '毒針', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9, kind: 'pierce'}, {type: 'status', status: 'poison', chance: 0.45}], fx: 'pierce', msg: '{user}は毒針で刺した！'},
  e_numb_sting: {name: 'しびれ針', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9, kind: 'pierce'}, {type: 'status', status: 'paralyze', chance: 0.2}], fx: 'pierce', msg: '{user}はしびれ針で刺した！'},
  e_death_sting: {name: '死の一刺し', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1, kind: 'pierce'}, {type: 'status', status: 'death', chance: 0.1}], fx: 'death', msg: '{user}は死の針を突き立てた！'},
  e_poison_spit: {name: '毒の粘液', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9}, {type: 'status', status: 'poison', chance: 0.45}], fx: 'poison', msg: '{user}は毒の粘液を吐きかけた！'},
  e_bind: {name: 'しめつけ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.8}, {type: 'status', status: 'paralyze', chance: 0.25}], fx: 'strike', msg: '{user}は巻きついてしめつけた！'},
  e_bandage: {name: '包帯しばり', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'paralyze', chance: 0.3}], fx: 'paralyze', msg: '{user}は包帯をのばして巻きつけた！'},
  e_web: {name: '糸を吐く', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.6}], fx: 'debuff', msg: '{user}はねばつく糸を吐き出した！'},
  e_sleep_spore: {name: '眠りの胞子', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'sleep', msg: '{user}は眠りの胞子をまき散らした！'},
  e_poison_spore: {name: '毒の胞子', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'poison', chance: 0.3}], fx: 'poison', msg: '{user}は毒の胞子をまき散らした！'},
  e_confuse_spore: {name: '惑いの胞子', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'confuse', chance: 0.2}], fx: 'confuse', msg: '{user}は不思議な胞子をまき散らした！'},
  e_spore_storm: {name: '胞子の嵐', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'poison', chance: 0.25}, {type: 'status', status: 'sleep', chance: 0.15}], fx: 'poison', msg: '{user}は胞子の嵐を巻き起こした！'},
  e_sleep_pollen: {name: '眠りの花粉', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.3}], fx: 'sleep', msg: '{user}は甘い花粉を振りまいた！'},
  e_ink: {name: '墨吹き', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'smoke', msg: '{user}は真っ黒な墨を吹きかけた！'},
  e_bubbles: {name: '泡をはく', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.25}], fx: 'water', msg: '{user}は泡をぶくぶくと吐いた！'},
  e_dust: {name: '砂ぼこり', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'earth'}, {type: 'status', status: 'blind', chance: 0.2}], fx: 'earth', msg: '{user}は砂ぼこりを巻き上げた！'},
  e_ash_cloud: {name: '灰かぶせ', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'smoke', msg: '{user}は熱い灰をまき散らした！'},
  e_gaze: {name: 'にらみ', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'paralyze', chance: 0.35}], fx: 'paralyze', msg: '{user}はぎろりとにらみつけた！'},
  e_evil_eye: {name: '妖しい目', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'confuse', chance: 0.2}], fx: 'confuse', msg: '{user}の目が妖しく光った！'},
  e_charm: {name: '魅了のまなざし', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'confuse', chance: 0.4}], fx: 'confuse', msg: '{user}はうっとりするまなざしを向けた！'},
  e_lullaby: {name: '子守歌', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'song', msg: '{user}は眠りを誘う歌を歌った！'},
  e_dance: {name: '惑わしの踊り', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'confuse', chance: 0.2}], fx: 'song', msg: '{user}はくるくると踊りだした！'},
  e_curse: {name: '呪いの声', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'silence', chance: 0.45}], fx: 'silence', msg: '{user}は呪いの声をあげた！', aim: 'middle'},
  e_hush: {name: 'しじまの霧', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'silence', chance: 0.25}], fx: 'silence', msg: '{user}は音を消す霧を広げた！'},
  e_death_word: {name: '死のささやき', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'death', chance: 0.12}], fx: 'death', msg: '{user}は死の言葉をささやいた！'},
  e_scare: {name: 'おどかし', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'atk', stages: -1, chance: 0.5}], fx: 'debuff', msg: '{user}は恐ろしい声でおどかした！'},
  e_wail: {name: '嘆きの声', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.2}], fx: 'song', msg: '{user}はすすり泣くような声をあげた！'},
  e_gloom: {name: '絶望の影', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'atk', stages: -1, chance: 0.5}, {type: 'buff', stat: 'mag', stages: -1, chance: 0.5}], fx: 'dark', msg: '{user}は絶望の影を広げた！'},
  e_roar: {name: '雄たけび', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'stun', chance: 0.15}], fx: 'debuff', msg: '{user}は大地を揺るがす雄たけびをあげた！'},
  e_sonic: {name: '超音波', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.4}, {type: 'status', status: 'confuse', chance: 0.15}], fx: 'magic', msg: '{user}は耳をつんざく音を出した！'},
  e_freeze_gaze: {name: '凍てつく眼', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'freeze', chance: 0.35}], fx: 'ice', msg: '{user}の眼が青白く光った！'},
  e_prank: {name: 'いたずら', kind: 'enemy', target: 'enemy', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.6}, {type: 'buff', stat: 'def', stages: -1, chance: 0.3}], fx: 'debuff', msg: '{user}はくすくす笑っていたずらをした！'},
  e_forget: {name: '忘れさせる手', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.8, mp: true}, {type: 'status', status: 'silence', chance: 0.2}], fx: 'mp', msg: '{user}の白い手が記憶をなでた！'},
  e_transcribe: {name: '書き写し', kind: 'enemy', target: 'enemy', effects: [{type: 'dispel', side: 'good'}, {type: 'status', status: 'silence', chance: 0.3}], fx: 'dispel', msg: '{user}は相手の力を書き写して消した！'},
  e_erase_all: {name: '白紙の波', kind: 'enemy', target: 'enemies', effects: [{type: 'dispel', side: 'good'}, {type: 'status', status: 'silence', chance: 0.15}], fx: 'dispel', msg: '{user}から白い波が広がった！'},
  e_blank_breath: {name: '白い息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.55}, {type: 'status', status: 'silence', chance: 0.2}], fx: 'breath', msg: '{user}は何もかも白くする息を吐いた！'},
  e_bell_croak: {name: '鐘の鳴き声', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'earth'}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'song', msg: '{user}はゴーンと鐘のように鳴いた！'},
  e_hex: {name: '呪いのくぎ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2, element: 'dark'}, {type: 'buff', stat: 'def', stages: -1, chance: 0.5}], fx: 'dark', msg: '{user}は呪いのくぎを打ちこんだ！'},
  e_dispel: {name: '打ち消しの波', kind: 'enemy', target: 'enemies', effects: [{type: 'dispel', side: 'good'}], fx: 'dispel', msg: '{user}はすべての守りを打ち消す波を放った！'},
  e_fire_bolt: {name: '火の玉', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'fire'}], fx: 'fire', msg: '{user}は火の玉を放った！'},
  e_fire_rain: {name: '火の雨', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'fire'}], fx: 'fire2', msg: '{user}は火の雨を降らせた！'},
  e_lava_spit: {name: '溶岩吐き', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.25}], fx: 'fire2', msg: '{user}は煮えたぎる溶岩を吐いた！'},
  e_water_bolt: {name: '水の弾', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'water'}], fx: 'water', msg: '{user}は水の弾を放った！'},
  e_tide: {name: '押し寄せる波', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'water'}], fx: 'water2', msg: '{user}は大波を呼んだ！'},
  e_frost: {name: '冷気', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.1}], fx: 'ice', msg: '{user}は凍える冷気を放った！'},
  e_icicle: {name: 'つらら落とし', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'water', hits: 3}], fx: 'ice', msg: '{user}はつららを次々に落とした！'},
  e_gust: {name: '突風', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'wind'}], fx: 'wind', msg: '{user}は突風を巻き起こした！'},
  e_wind_blade: {name: '風の刃', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'wind'}], fx: 'wind', msg: '{user}は風の刃を放った！'},
  e_zap: {name: '電撃', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2, element: 'wind'}, {type: 'status', status: 'paralyze', chance: 0.15}], fx: 'thunder', msg: '{user}はばちばちと電撃を放った！'},
  e_rock: {name: '岩落とし', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.35, element: 'earth'}], fx: 'earth', msg: '{user}は大きな岩を落とした！'},
  e_quake: {name: '地響き', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'earth'}, {type: 'status', status: 'stun', chance: 0.1}], fx: 'earth2', msg: '{user}は地面を揺るがした！'},
  e_light_ray: {name: '光線', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'light'}], fx: 'holy', msg: '{user}はまぶしい光線を放った！'},
  e_holy_beam: {name: '天の光', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'light'}], fx: 'holy2', msg: '{user}は天から光を降らせた！'},
  e_flash: {name: 'まばゆい光', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.4, element: 'light'}, {type: 'status', status: 'blind', chance: 0.25}], fx: 'holy', msg: '{user}はまばゆく光った！'},
  e_dark_bolt: {name: '闇の玉', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'dark'}], fx: 'dark', msg: '{user}は闇の玉を放った！'},
  e_dark_mist: {name: '闇の霧', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'dark'}], fx: 'dark2', msg: '{user}は闇の霧を広げた！'},
  e_life_suck: {name: '命吸い', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.1, element: 'dark', drain: 0.5}], fx: 'drain', msg: '{user}は命を吸い取ろうとした！'},
  e_mind_suck: {name: '魔力吸い', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.8, mp: true, drain: 1}], fx: 'mp', msg: '{user}は魔力を吸い取ろうとした！', aim: 'middle'},
  e_prism_ray: {name: '七色の光', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.4}], fx: 'magic2', msg: '{user}は七色の光を放った！', elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
  e_gem_beam: {name: '宝玉の光線', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.5}], fx: 'magic2', msg: '{user}の宝玉が光線を放った！', elements: ['fire', 'water', 'light']},
  e_void_wave: {name: '虚無の波', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.85, element: 'dark'}], fx: 'dark3', msg: '{user}は虚無の波を放った！'},
  e_yomi_fire: {name: '黄泉の炎', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'dark'}, {type: 'status', status: 'burn', chance: 0.2}], fx: 'dark2', msg: '{user}は青黒い炎を燃え上がらせた！'},
  e_fire_breath: {name: '炎の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.6, element: 'fire'}], fx: 'breath_fire', msg: '{user}は炎を吐いた！'},
  e_inferno_breath: {name: '業火の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.75, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.2}], fx: 'breath_fire', msg: '{user}は業火を吐き出した！'},
  e_frost_breath: {name: '凍てつく息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.55, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.1}], fx: 'breath_ice', msg: '{user}は凍てつく息を吐いた！'},
  e_poison_breath: {name: '毒の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.35}, {type: 'status', status: 'poison', chance: 0.3}], fx: 'breath_poison', msg: '{user}は毒の息を吐き出した！'},
  e_storm_breath: {name: '嵐の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.65, element: 'wind'}], fx: 'breath', msg: '{user}は嵐のような息を吐いた！'},
  e_chaos_breath: {name: '混沌の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.7}], fx: 'breath_dark', msg: '{user}は混沌の息を吐き出した！', elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
  e_heal_self: {name: '傷をなめる', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}], fx: 'heal', msg: '{user}は傷をなめている。'},
  e_heal_ally: {name: '癒やしの粉', kind: 'enemy', target: 'ally', effects: [{type: 'heal', pct: 0.3}], fx: 'heal', msg: '{user}は癒やしの粉を振りかけた！'},
  e_heal_all: {name: '癒やしの歌', kind: 'enemy', target: 'allies', effects: [{type: 'heal', pct: 0.2}], fx: 'heal', msg: '{user}は癒やしの歌を歌った！'},
  e_regen_self: {name: '根を張る', kind: 'enemy', target: 'self', effects: [{type: 'status', status: 'regen'}], fx: 'regen', msg: '{user}は大地に根を張った！'},
  e_harden: {name: '身を固める', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: '{user}は身を固めた！'},
  e_focus: {name: '力をためる', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'atk', stages: 2}], fx: 'buff', msg: '{user}は力をためている！'},
  e_howl: {name: '遠吠え', kind: 'enemy', target: 'allies', effects: [{type: 'buff', stat: 'atk', stages: 1}], fx: 'buff', msg: '{user}は仲間を奮い立たせた！'},
  e_haste: {name: '追い風', kind: 'enemy', target: 'allies', effects: [{type: 'buff', stat: 'agi', stages: 1}], fx: 'buff', msg: '{user}は追い風を呼んだ！'},
  e_ward: {name: '守りの輪', kind: 'enemy', target: 'allies', effects: [{type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: '{user}は守りの輪を広げた！'},
  e_veil_ally: {name: '加護の祈り', kind: 'enemy', target: 'ally', effects: [{type: 'status', status: 'veil'}], fx: 'buff', msg: '{user}は仲間に加護を祈った！'},
  e_revive_ally: {name: '死者起こし', kind: 'enemy', target: 'ally_dead', effects: [{type: 'revive', pct: 0.5}], fx: 'revive', msg: '{user}は倒れた仲間を呼び起こした！'},
  e_call: {name: '仲間を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'same', n: 1, max: 6}], fx: 'song', msg: '{user}は仲間を呼んだ！'},
  e_call_lesser: {name: '手下を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'lower', n: 1, max: 6}], fx: 'song', msg: '{user}は手下を呼んだ！'},
  e_split: {name: '分裂', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'same', n: 1, max: 6}], fx: 'magic', msg: '{user}はぷるんと分裂した！'},
});
```

---------------------------------------------------------------------------------------------------
## 7. 地方と系統・出現表（担当 A11 `encounters.js`、レア魔物の行は A12 `rare_encounters.js`）

### 7.1 地方ごとの系統（ワールド章 §15 の「地方の魔物の雰囲気」に合わせた）
| 地方 | ゾーン | 出る系統（`@` は段がティアで変わる） | レア魔物 | ボス（ワールド章 §13.5） |
|---|---|---|---|---|
| `prologue` | `zw_prologue` | jelly_1 rat_1 seabird_1 crab_1 | `rm_jewel_hare` | tr_b_pageeater |
| `prologue` | `z_prologue_lighthouse` | bat_1 rat_1 jelly_1 crab_1 seabird_1 | — |  |
| `r_forest` | `zw_forest` | bee mushroom plant fairy jelly treant paper quicksilver | `rm_bloom_fawn` | tr_b_moth → tr_b_rooteater |
| `r_forest` | `z_r_forest_maze` | bee plant spider fairy treant paper mirror | `rm_glass_moth` |  |
| `r_forest` | `z_r_forest_tree` | treant mushroom plant fairy paper mirror | `rm_acorn_prince` |  |
| `r_desert` | `zw_desert` | scorpion snake cactus rat sandworm paper quicksilver | `rm_diamond_lizard` | tr_b_sandworm → tr_b_sandking |
| `r_desert` | `z_r_desert_tomb` | mummy scorpion bat snake sandworm mimic paper mirror | `rm_gold_idol` |  |
| `r_snow` | `zw_snow` | wolf frostling owl yeti mammoth paper quicksilver | `rm_aurora_bird` | tr_b_icegiant → tr_b_whitedragon |
| `r_snow` | `z_r_snow_peak` | frostling wolf bat yeti owl paper mirror | `rm_icetail_fox` |  |
| `r_marsh` | `zw_marsh` | frog lizardman jelly wisp ghost paper quicksilver | `rm_lotus_sprite` | tr_b_dolls → tr_b_mistbeast |
| `r_marsh` | `z_r_marsh_manor` | ghost doll spider wisp mimic paper mirror | `rm_ghost_teapot` |  |
| `r_marsh` | `z_r_marsh_bog` | frog wisp lizardman mushroom ghost jelly paper mirror | `rm_bell_snail` |  |
| `r_isles` | `zw_isles` | seabird crab merman jelly paper quicksilver | `rm_star_whale` | tr_b_octopus → tr_b_captain |
| `r_isles` | `z_r_isles_cave` | crab merman bat kraken paper mirror | — |  |
| `r_isles` | `z_r_isles_ship` | skeleton merman rat seabird kraken mimic paper mirror | `rm_treasure_crab` |  |
| `r_mine` | `zw_mine` | goblin mole beetle golem rat paper quicksilver | `rm_gem_hedgehog` | tr_b_rockeater → tr_b_ironwarden |
| `r_mine` | `z_r_mine_mine` | goblin mole crystal bat beetle golem rat paper mirror | `rm_prisma` |  |
| `r_ash` | `zw_ash` | salamander imp orc chimera paper quicksilver | `rm_spa_monkey` | tr_b_hellhound → tr_b_lavabeast |
| `r_ash` | `z_r_ash_volcano` | salamander gargoyle imp bat chimera paper mirror | `rm_volcano_turtle` |  |
| `r_star` | `zw_star` | eyeball darkmage automaton wyvern paper quicksilver | `rm_moon_sheep` | tr_b_orrery → tr_b_stareater |
| `r_star` | `z_r_star_tower` | automaton armor eyeball darkmage gargoyle crystal mimic paper mirror | `rm_clock_bird` |  |
| `finale` | `zw_center` | paper_4 scribe_1 book_1 platinum_1 | — | tr_b_bookgolem tr_b_heroshades tr_b_lazaro tr_b_nemrea1 → tr_b_nemrea2 |
| `finale` | `z_finale_archive_lo` | scribe_1 book_1 scribe_2 book_2 paper_3 paper_4 armor_4 mimic_4 platinum_1 | `rm_bookworm` |  |
| `finale` | `z_finale_archive_hi` | scribe_2 book_3 book_2 scribe_3 scribe_1 demon_1 paper_4 platinum_1 | `rm_golden_quill` |  |
| `postgame` | `z_postgame_oblivion_lo` | void_1 chaos_1 demon_2 plant_5 scorpion_5 wolf_5 frostling_5 bee_5 mummy_5 platinum_1 | `rm_memory_fish` | tr_b_valzard_echo tr_b_ouroboros |
| `postgame` | `z_postgame_oblivion_hi` | void_2 void_1 chaos_2 demon_3 demon_2 ghost_5 goblin_5 salamander_5 imp_5 eyeball_5 skeleton_5 jelly_5 bat_5 platinum_2 | `rm_dream_tapir` |  |

- **虚ろの使い `paper`**（ワールド章 §9.1: ティア2から）は、中盤の全ゾーンに `tierMin: 2` で入れた。ティア2〜3は小（白紙の小鬼）、4〜7は中（白紙の獣・騎士）、8は大（白紙の竜）なので、**大きさごとに組を3つに分けた**（数が変わるため）。
- **鋼**: 白銀のしずく（`@quicksilver`）は中盤のワールドの全ゾーンにティア2から、鏡の甲虫（`@mirror`）は中盤のダンジョンの全ゾーンにティア5から、白金の灯は終盤・裏にだけ。組の重み 1.5（全体の 2.5〜3%。成長章 §10.5）。
- **宝箱もどき `@mimic`** は、王墓・霧の館・幽霊船・星読みの塔と大書庫に重み 2 で1体だけ（`solo`）。お金が多く、レア・超レアが出やすい（§12）。
- 同じ地方でも、ワールドとダンジョンで系統の顔ぶれを変えた（例: 森のワールドはハチ・キノコ・花・妖精・ゼリー、迷いの森はクモと魔木が加わる）。
- 町・村にはゾーンを置かない（ワールド章 §13.4）。

### 7.2 組の規則（検算済み。変えたら `tools/sim_zones.js` で確かめる）
- 各ゾーン・各ティア（中盤は 0〜8）で、出られる組が 4 つ以上。
- 1つの組は 3 種・8 体・横幅 256px まで。組の強さ（標準の魔物に直した数、小 0.7・中 1・大 1.8）は 2.2〜4.8、ゾーンの平均は **3.0〜3.4**（下の表）。
- 序章は主人公1人のときも出る（ワールド章 §7 P3）ので、`zw_prologue` は 1〜2 体分、灯台は 1.5〜2.5 体分。

| ゾーン | 組の強さの平均（T0 / T4 / T8） |
|---|---|
| `zw_prologue` | 1.15 |
| `z_prologue_lighthouse` | 1.91 |
| `zw_forest` | 3.22 / 3.14 / 3.16 |
| `z_r_forest_maze` | 3.15 / 3.08 / 3.10 |
| `z_r_forest_tree` | 3.08 / 3.01 / 3.03 |
| `zw_desert` | 3.15 / 3.09 / 3.12 |
| `z_r_desert_tomb` | 3.27 / 3.17 / 3.20 |
| `zw_snow` | 3.11 / 3.04 / 3.06 |
| `z_r_snow_peak` | 3.27 / 3.17 / 3.19 |
| `zw_marsh` | 3.20 / 3.11 / 3.13 |
| `z_r_marsh_manor` | 3.04 / 2.97 / 2.99 |
| `z_r_marsh_bog` | 3.14 / 3.06 / 3.09 |
| `zw_isles` | 3.15 / 3.07 / 3.09 |
| `z_r_isles_cave` | 3.08 / 3.01 / 3.03 |
| `z_r_isles_ship` | 3.12 / 3.05 / 3.07 |
| `zw_mine` | 3.10 / 3.03 / 3.05 |
| `z_r_mine_mine` | 3.18 / 3.10 / 3.13 |
| `zw_ash` | 3.12 / 3.05 / 3.07 |
| `z_r_ash_volcano` | 3.15 / 3.07 / 3.09 |
| `zw_star` | 3.09 / 3.02 / 3.04 |
| `z_r_star_tower` | 3.26 / 3.17 / 3.19 |
| `zw_center` | 3.04 |
| `z_finale_archive_lo` | 3.15 |
| `z_finale_archive_hi` | 3.16 |
| `z_postgame_oblivion_lo` | 3.21 |
| `z_postgame_oblivion_hi` | 3.41 |

### 7.3 出現表のデータ（normative。そのまま写してよい形）
組は `{w, mons:[[ref, 最少, 最多]…], tierMin?, tierMax?, solo?}`（§1.4）。`@` はその戦闘のティアで段を選ぶ。
```js
Object.assign(R.DB.encounters, {
  zw_prologue: { region: 'prologue', tier: 0, lv: [1,3], bg: null, groups: [
    { w: 10, mons: [['jelly_1', 1, 2]] },
    { w: 8, mons: [['rat_1', 1, 2]] },
    { w: 6, mons: [['seabird_1', 1, 1]] },
    { w: 6, mons: [['jelly_1', 1, 1], ['rat_1', 1, 1]] },
    { w: 5, mons: [['crab_1', 1, 1]] },
    { w: 3, mons: [['jelly_1', 2, 3]] },
  ] },
  z_prologue_lighthouse: { region: 'prologue', tier: 0, lv: [3,5], bg: 'tower', groups: [
    { w: 9, mons: [['bat_1', 2, 3]] },
    { w: 8, mons: [['rat_1', 2, 3]] },
    { w: 7, mons: [['jelly_1', 2, 3]] },
    { w: 7, mons: [['bat_1', 1, 2], ['rat_1', 1, 2]] },
    { w: 5, mons: [['crab_1', 1, 2], ['jelly_1', 1, 1]] },
    { w: 4, mons: [['seabird_1', 1, 2], ['bat_1', 1, 1]] },
  ] },
  zw_forest: { region: 'r_forest', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@bee', 4, 5]] },
    { w: 8, mons: [['@mushroom', 2, 4], ['@bee', 1, 3]] },
    { w: 8, mons: [['@plant', 2, 4]] },
    { w: 7, mons: [['@fairy', 2, 4], ['@mushroom', 1, 2]] },
    { w: 6, mons: [['@jelly', 4, 5]] },
    { w: 6, mons: [['@plant', 1, 3], ['@fairy', 1, 3]] },
    { w: 5, mons: [['@treant', 1, 1], ['@bee', 1, 3]], tierMin: 2 },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_forest_maze: { region: 'r_forest', tier: 'dyn', lvOff: 1, bg: 'forest', groups: [
    { w: 8, mons: [['@bee', 4, 5]] },
    { w: 8, mons: [['@plant', 2, 4]] },
    { w: 7, mons: [['@spider', 2, 4]] },
    { w: 7, mons: [['@fairy', 2, 4], ['@bee', 1, 2]] },
    { w: 6, mons: [['@treant', 1, 1], ['@plant', 1, 2]] },
    { w: 6, mons: [['@spider', 1, 3], ['@bee', 2, 3]] },
    { w: 5, mons: [['@treant', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  z_r_forest_tree: { region: 'r_forest', tier: 'dyn', lvOff: 1, bg: 'tree', groups: [
    { w: 8, mons: [['@treant', 1, 2]] },
    { w: 8, mons: [['@mushroom', 4, 5]] },
    { w: 7, mons: [['@plant', 2, 4]] },
    { w: 7, mons: [['@fairy', 2, 3], ['@mushroom', 1, 3]] },
    { w: 6, mons: [['@treant', 1, 1], ['@fairy', 1, 3]] },
    { w: 6, mons: [['@plant', 1, 3], ['@mushroom', 1, 3]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_desert: { region: 'r_desert', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@scorpion', 2, 4]] },
    { w: 8, mons: [['@snake', 2, 4]] },
    { w: 8, mons: [['@cactus', 2, 4]] },
    { w: 7, mons: [['@scorpion', 1, 3], ['@snake', 1, 2]] },
    { w: 6, mons: [['@rat', 4, 5]] },
    { w: 6, mons: [['@sandworm', 1, 1], ['@scorpion', 1, 2]], tierMin: 1 },
    { w: 5, mons: [['@cactus', 1, 3], ['@rat', 1, 3]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_desert_tomb: { region: 'r_desert', tier: 'dyn', lvOff: 1, bg: 'pyramid', groups: [
    { w: 9, mons: [['@mummy', 2, 4]] },
    { w: 8, mons: [['@scorpion', 2, 4]] },
    { w: 7, mons: [['@bat', 4, 5]] },
    { w: 7, mons: [['@mummy', 1, 3], ['@bat', 1, 3]] },
    { w: 6, mons: [['@snake', 2, 3], ['@scorpion', 1, 2]] },
    { w: 5, mons: [['@sandworm', 1, 1], ['@mummy', 1, 2]] },
    { w: 2, mons: [['@mimic', 1, 1]], solo: true },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_snow: { region: 'r_snow', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@wolf', 2, 4]] },
    { w: 8, mons: [['@frostling', 2, 4]] },
    { w: 7, mons: [['@owl', 2, 4]] },
    { w: 6, mons: [['@yeti', 1, 1], ['@wolf', 1, 2]] },
    { w: 6, mons: [['@mammoth', 1, 1], ['@owl', 1, 2]] },
    { w: 6, mons: [['@wolf', 1, 3], ['@frostling', 1, 2]] },
    { w: 5, mons: [['@yeti', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_snow_peak: { region: 'r_snow', tier: 'dyn', lvOff: 1, bg: 'ice', groups: [
    { w: 9, mons: [['@frostling', 2, 4]] },
    { w: 8, mons: [['@wolf', 2, 4]] },
    { w: 7, mons: [['@bat', 4, 5]] },
    { w: 7, mons: [['@yeti', 1, 1], ['@frostling', 1, 3]] },
    { w: 6, mons: [['@owl', 2, 3], ['@wolf', 1, 2]] },
    { w: 5, mons: [['@yeti', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_marsh: { region: 'r_marsh', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@frog', 2, 4]] },
    { w: 8, mons: [['@lizardman', 2, 4]] },
    { w: 7, mons: [['@jelly', 4, 5]] },
    { w: 7, mons: [['@wisp', 4, 5]] },
    { w: 6, mons: [['@frog', 1, 3], ['@lizardman', 1, 2]] },
    { w: 6, mons: [['@ghost', 2, 3], ['@wisp', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_marsh_manor: { region: 'r_marsh', tier: 'dyn', lvOff: 1, bg: 'manor', groups: [
    { w: 9, mons: [['@ghost', 2, 3]] },
    { w: 8, mons: [['@doll', 2, 4]] },
    { w: 7, mons: [['@spider', 2, 4]] },
    { w: 7, mons: [['@wisp', 4, 5]] },
    { w: 6, mons: [['@doll', 1, 3], ['@ghost', 1, 2]] },
    { w: 5, mons: [['@spider', 1, 3], ['@wisp', 1, 3]] },
    { w: 2, mons: [['@mimic', 1, 1]], solo: true },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  z_r_marsh_bog: { region: 'r_marsh', tier: 'dyn', lvOff: 1, bg: 'swamp', groups: [
    { w: 9, mons: [['@frog', 2, 4]] },
    { w: 8, mons: [['@wisp', 4, 5]] },
    { w: 7, mons: [['@lizardman', 2, 4]] },
    { w: 7, mons: [['@mushroom', 4, 5]] },
    { w: 6, mons: [['@ghost', 1, 3], ['@frog', 1, 2]] },
    { w: 6, mons: [['@jelly', 2, 4], ['@wisp', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_isles: { region: 'r_isles', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@seabird', 2, 4]] },
    { w: 8, mons: [['@crab', 2, 4]] },
    { w: 8, mons: [['@merman', 2, 4]] },
    { w: 7, mons: [['@jelly', 4, 5]] },
    { w: 6, mons: [['@crab', 1, 3], ['@seabird', 1, 2]] },
    { w: 6, mons: [['@merman', 1, 3], ['@jelly', 1, 3]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_isles_cave: { region: 'r_isles', tier: 'dyn', lvOff: 1, bg: 'watercave', groups: [
    { w: 9, mons: [['@crab', 2, 4]] },
    { w: 8, mons: [['@merman', 2, 4]] },
    { w: 7, mons: [['@bat', 4, 5]] },
    { w: 6, mons: [['@kraken', 1, 1], ['@crab', 1, 2]] },
    { w: 6, mons: [['@kraken', 1, 2]] },
    { w: 6, mons: [['@merman', 1, 3], ['@bat', 1, 3]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  z_r_isles_ship: { region: 'r_isles', tier: 'dyn', lvOff: 1, bg: 'ship', groups: [
    { w: 9, mons: [['@skeleton', 2, 4]] },
    { w: 8, mons: [['@merman', 2, 4]] },
    { w: 7, mons: [['@rat', 4, 5]] },
    { w: 7, mons: [['@seabird', 2, 4]] },
    { w: 6, mons: [['@kraken', 1, 1], ['@skeleton', 1, 2]] },
    { w: 6, mons: [['@skeleton', 1, 3], ['@rat', 1, 3]] },
    { w: 2, mons: [['@mimic', 1, 1]], solo: true },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_mine: { region: 'r_mine', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@goblin', 2, 4]] },
    { w: 8, mons: [['@mole', 2, 4]] },
    { w: 7, mons: [['@beetle', 4, 5]] },
    { w: 6, mons: [['@golem', 1, 1], ['@goblin', 1, 2]] },
    { w: 6, mons: [['@rat', 4, 5]] },
    { w: 6, mons: [['@mole', 1, 3], ['@beetle', 1, 3]] },
    { w: 5, mons: [['@golem', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_mine_mine: { region: 'r_mine', tier: 'dyn', lvOff: 1, bg: 'mine', groups: [
    { w: 9, mons: [['@goblin', 2, 4]] },
    { w: 8, mons: [['@mole', 2, 4]] },
    { w: 7, mons: [['@crystal', 4, 5]] },
    { w: 7, mons: [['@bat', 4, 5]] },
    { w: 6, mons: [['@beetle', 2, 4], ['@crystal', 1, 2]] },
    { w: 6, mons: [['@golem', 1, 1], ['@mole', 1, 2]] },
    { w: 5, mons: [['@goblin', 1, 3], ['@rat', 2, 3]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_ash: { region: 'r_ash', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@salamander', 2, 4]] },
    { w: 8, mons: [['@imp', 4, 5]] },
    { w: 7, mons: [['@orc', 1, 1], ['@imp', 1, 3]] },
    { w: 7, mons: [['@chimera', 1, 1], ['@salamander', 1, 2]] },
    { w: 6, mons: [['@orc', 1, 2]] },
    { w: 6, mons: [['@salamander', 1, 3], ['@imp', 1, 3]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_ash_volcano: { region: 'r_ash', tier: 'dyn', lvOff: 1, bg: 'volcano', groups: [
    { w: 9, mons: [['@salamander', 2, 4]] },
    { w: 8, mons: [['@gargoyle', 2, 4]] },
    { w: 7, mons: [['@imp', 4, 5]] },
    { w: 7, mons: [['@bat', 4, 5]] },
    { w: 6, mons: [['@chimera', 1, 1], ['@imp', 1, 3]] },
    { w: 6, mons: [['@gargoyle', 1, 3], ['@salamander', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_star: { region: 'r_star', tier: 'dyn', lvOff: 0, bg: null, groups: [
    { w: 9, mons: [['@eyeball', 4, 5]] },
    { w: 8, mons: [['@darkmage', 2, 4]] },
    { w: 8, mons: [['@automaton', 2, 4]] },
    { w: 6, mons: [['@wyvern', 1, 1], ['@eyeball', 1, 3]] },
    { w: 6, mons: [['@wyvern', 1, 2]] },
    { w: 6, mons: [['@darkmage', 1, 3], ['@automaton', 1, 2]] },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@quicksilver', 1, 2]], tierMin: 2 },
  ] },
  z_r_star_tower: { region: 'r_star', tier: 'dyn', lvOff: 1, bg: 'tower', groups: [
    { w: 9, mons: [['@automaton', 2, 4]] },
    { w: 8, mons: [['@armor', 2, 4]] },
    { w: 7, mons: [['@eyeball', 4, 5]] },
    { w: 7, mons: [['@darkmage', 2, 3], ['@eyeball', 1, 2]] },
    { w: 6, mons: [['@gargoyle', 2, 3], ['@crystal', 1, 2]] },
    { w: 6, mons: [['@armor', 1, 3], ['@darkmage', 1, 2]] },
    { w: 2, mons: [['@mimic', 1, 1]], solo: true },
    { w: 6, mons: [['@paper', 3, 4]], tierMin: 2, tierMax: 3 },
    { w: 6, mons: [['@paper', 2, 3]], tierMin: 4, tierMax: 7 },
    { w: 6, mons: [['@paper', 1, 2]], tierMin: 8 },
    { w: 1.5, mons: [['@mirror', 1, 2]], tierMin: 5 },
  ] },
  zw_center: { region: 'finale', tier: 8, lvOff: 0, bg: null, groups: [
    { w: 8, mons: [['paper_4', 1, 2]] },
    { w: 8, mons: [['scribe_1', 2, 4]] },
    { w: 7, mons: [['book_1', 4, 5]] },
    { w: 6, mons: [['scribe_1', 1, 3], ['book_1', 1, 3]] },
    { w: 3, mons: [['platinum_1', 1, 1]] },
  ] },
  z_finale_archive_lo: { region: 'finale', tier: 8, lvOff: 1, bg: 'library', groups: [
    { w: 9, mons: [['scribe_1', 2, 4]] },
    { w: 8, mons: [['book_1', 4, 5]] },
    { w: 8, mons: [['scribe_2', 1, 3], ['book_1', 1, 3]] },
    { w: 7, mons: [['book_2', 3, 4]] },
    { w: 6, mons: [['paper_3', 2, 4]] },
    { w: 6, mons: [['paper_4', 1, 1], ['scribe_1', 1, 2]] },
    { w: 5, mons: [['armor_4', 2, 3], ['scribe_2', 1, 2]] },
    { w: 2, mons: [['mimic_4', 1, 1]], solo: true },
    { w: 2, mons: [['platinum_1', 1, 1]] },
  ] },
  z_finale_archive_hi: { region: 'finale', tier: 8, lvOff: 2, bg: 'library', groups: [
    { w: 9, mons: [['scribe_2', 2, 4]] },
    { w: 8, mons: [['book_3', 2, 4], ['book_2', 1, 2]] },
    { w: 8, mons: [['scribe_3', 1, 2], ['scribe_1', 2, 3]] },
    { w: 7, mons: [['demon_1', 1, 1], ['book_2', 1, 3]] },
    { w: 6, mons: [['paper_4', 1, 2]] },
    { w: 6, mons: [['demon_1', 1, 2]] },
    { w: 3, mons: [['platinum_1', 1, 1]] },
  ] },
  z_postgame_oblivion_lo: { region: 'postgame', tier: 9, lvOff: 0, bg: 'oblivion', groups: [
    { w: 8, mons: [['void_1', 2, 4]] },
    { w: 7, mons: [['chaos_1', 1, 1], ['void_1', 1, 2]] },
    { w: 7, mons: [['demon_2', 1, 1], ['void_1', 1, 2]] },
    { w: 6, mons: [['plant_5', 2, 4]] },
    { w: 6, mons: [['scorpion_5', 2, 4]] },
    { w: 6, mons: [['wolf_5', 2, 4]] },
    { w: 5, mons: [['frostling_5', 2, 3], ['bee_5', 2, 3]] },
    { w: 5, mons: [['mummy_5', 2, 4]] },
    { w: 3, mons: [['platinum_1', 1, 2]] },
  ] },
  z_postgame_oblivion_hi: { region: 'postgame', tier: 9, lvOff: 2, bg: 'oblivion', groups: [
    { w: 8, mons: [['void_2', 1, 3], ['void_1', 1, 2]] },
    { w: 7, mons: [['chaos_2', 1, 1], ['void_1', 1, 2]] },
    { w: 7, mons: [['demon_3', 1, 1], ['demon_2', 1, 1]] },
    { w: 6, mons: [['ghost_5', 2, 4]] },
    { w: 6, mons: [['goblin_5', 2, 4]] },
    { w: 6, mons: [['salamander_5', 2, 3], ['imp_5', 1, 3]] },
    { w: 5, mons: [['eyeball_5', 4, 5]] },
    { w: 5, mons: [['skeleton_5', 2, 4]] },
    { w: 5, mons: [['jelly_5', 3, 5], ['bat_5', 1, 3]] },
    { w: 3, mons: [['platinum_2', 1, 1]] },
  ] },
});
Object.assign(R.DB.rareEncounters, {
  zw_prologue: { mon: 'rm_jewel_hare', rate: 80 },
  zw_forest: { mon: 'rm_bloom_fawn', rate: 80 },
  z_r_forest_maze: { mon: 'rm_glass_moth', rate: 80 },
  z_r_forest_tree: { mon: 'rm_acorn_prince', rate: 80 },
  zw_desert: { mon: 'rm_diamond_lizard', rate: 80 },
  z_r_desert_tomb: { mon: 'rm_gold_idol', rate: 80 },
  zw_snow: { mon: 'rm_aurora_bird', rate: 80 },
  z_r_snow_peak: { mon: 'rm_icetail_fox', rate: 80 },
  zw_marsh: { mon: 'rm_lotus_sprite', rate: 80 },
  z_r_marsh_manor: { mon: 'rm_ghost_teapot', rate: 80 },
  z_r_marsh_bog: { mon: 'rm_bell_snail', rate: 80 },
  zw_isles: { mon: 'rm_star_whale', rate: 80 },
  z_r_isles_ship: { mon: 'rm_treasure_crab', rate: 80 },
  zw_mine: { mon: 'rm_gem_hedgehog', rate: 80 },
  z_r_mine_mine: { mon: 'rm_prisma', rate: 80 },
  zw_ash: { mon: 'rm_spa_monkey', rate: 80 },
  z_r_ash_volcano: { mon: 'rm_volcano_turtle', rate: 80 },
  zw_star: { mon: 'rm_moon_sheep', rate: 80 },
  z_r_star_tower: { mon: 'rm_clock_bird', rate: 80 },
  z_finale_archive_lo: { mon: 'rm_bookworm', rate: 80 },
  z_finale_archive_hi: { mon: 'rm_golden_quill', rate: 80 },
  z_postgame_oblivion_lo: { mon: 'rm_memory_fish', rate: 80 },
  z_postgame_oblivion_hi: { mon: 'rm_dream_tapir', rate: 200 },
});
```

### 7.4 ゾーンごとに出る種（参考。上のデータから計算したもの）
- `zw_prologue`（ティア 0 固定・Lv 1〜3・レア rm_jewel_hare）: jelly_1 rat_1 seabird_1 crab_1
- `z_prologue_lighthouse`（ティア 0 固定・Lv 3〜5）: bat_1 rat_1 jelly_1 crab_1 seabird_1
- `zw_forest`（ティア 0〜8・lvOff 0・レア rm_bloom_fawn）: T0 bee_1 mushroom_1 plant_1 fairy_1 jelly_1 ／ T2 bee_2 mushroom_2 plant_2 fairy_2 jelly_2 treant_2 paper_1 quicksilver_1 ／ T4 bee_3 mushroom_3 plant_3 fairy_3 jelly_3 treant_3 paper_2 quicksilver_1 ／ T6 bee_4 mushroom_4 plant_4 fairy_4 jelly_4 treant_4 paper_3 quicksilver_2 ／ T8 bee_5 mushroom_4 plant_5 fairy_4 jelly_5 treant_4 paper_4 quicksilver_2
- `z_r_forest_maze`（ティア 0〜8・lvOff 1・レア rm_glass_moth）: T0 bee_1 plant_1 spider_1 fairy_1 treant_1 ／ T2 bee_2 plant_2 spider_2 fairy_2 treant_2 paper_1 ／ T4 bee_3 plant_3 spider_3 fairy_3 treant_3 paper_2 ／ T6 bee_4 plant_4 spider_4 fairy_4 treant_4 paper_3 mirror_1 ／ T8 bee_5 plant_5 spider_4 fairy_4 treant_4 paper_4 mirror_2
- `z_r_forest_tree`（ティア 0〜8・lvOff 1・レア rm_acorn_prince）: T0 treant_1 mushroom_1 plant_1 fairy_1 ／ T2 treant_2 mushroom_2 plant_2 fairy_2 paper_1 ／ T4 treant_3 mushroom_3 plant_3 fairy_3 paper_2 ／ T6 treant_4 mushroom_4 plant_4 fairy_4 paper_3 mirror_1 ／ T8 treant_4 mushroom_4 plant_5 fairy_4 paper_4 mirror_2
- `zw_desert`（ティア 0〜8・lvOff 0・レア rm_diamond_lizard）: T0 scorpion_1 snake_1 cactus_1 rat_1 ／ T2 scorpion_2 snake_2 cactus_2 rat_2 sandworm_1 paper_1 quicksilver_1 ／ T4 scorpion_3 snake_3 cactus_3 rat_3 sandworm_2 paper_2 quicksilver_1 ／ T6 scorpion_4 snake_4 cactus_4 rat_4 sandworm_3 paper_3 quicksilver_2 ／ T8 scorpion_5 snake_4 cactus_4 rat_4 sandworm_3 paper_4 quicksilver_2
- `z_r_desert_tomb`（ティア 0〜8・lvOff 1・レア rm_gold_idol）: T0 mummy_1 scorpion_1 bat_1 snake_1 sandworm_1 mimic_1 ／ T2 mummy_2 scorpion_2 bat_2 snake_2 sandworm_1 mimic_2 paper_1 ／ T4 mummy_3 scorpion_3 bat_3 snake_3 sandworm_2 mimic_3 paper_2 ／ T6 mummy_4 scorpion_4 bat_4 snake_4 sandworm_3 mimic_4 paper_3 mirror_1 ／ T8 mummy_5 scorpion_5 bat_5 snake_4 sandworm_3 mimic_4 paper_4 mirror_2
- `zw_snow`（ティア 0〜8・lvOff 0・レア rm_aurora_bird）: T0 wolf_1 frostling_1 owl_1 yeti_1 mammoth_1 ／ T2 wolf_2 frostling_2 owl_2 yeti_1 mammoth_1 paper_1 quicksilver_1 ／ T4 wolf_3 frostling_3 owl_3 yeti_2 mammoth_2 paper_2 quicksilver_1 ／ T6 wolf_4 frostling_4 owl_4 yeti_3 mammoth_3 paper_3 quicksilver_2 ／ T8 wolf_5 frostling_5 owl_4 yeti_3 mammoth_3 paper_4 quicksilver_2
- `z_r_snow_peak`（ティア 0〜8・lvOff 1・レア rm_icetail_fox）: T0 frostling_1 wolf_1 bat_1 yeti_1 owl_1 ／ T2 frostling_2 wolf_2 bat_2 yeti_1 owl_2 paper_1 ／ T4 frostling_3 wolf_3 bat_3 yeti_2 owl_3 paper_2 ／ T6 frostling_4 wolf_4 bat_4 yeti_3 owl_4 paper_3 mirror_1 ／ T8 frostling_5 wolf_5 bat_5 yeti_3 owl_4 paper_4 mirror_2
- `zw_marsh`（ティア 0〜8・lvOff 0・レア rm_lotus_sprite）: T0 frog_1 lizardman_1 jelly_1 wisp_1 ghost_1 ／ T2 frog_2 lizardman_2 jelly_2 wisp_2 ghost_2 paper_1 quicksilver_1 ／ T4 frog_3 lizardman_3 jelly_3 wisp_3 ghost_3 paper_2 quicksilver_1 ／ T6 frog_4 lizardman_4 jelly_4 wisp_4 ghost_4 paper_3 quicksilver_2 ／ T8 frog_4 lizardman_4 jelly_5 wisp_4 ghost_5 paper_4 quicksilver_2
- `z_r_marsh_manor`（ティア 0〜8・lvOff 1・レア rm_ghost_teapot）: T0 ghost_1 doll_1 spider_1 wisp_1 mimic_1 ／ T2 ghost_2 doll_2 spider_2 wisp_2 mimic_2 paper_1 ／ T4 ghost_3 doll_3 spider_3 wisp_3 mimic_3 paper_2 ／ T6 ghost_4 doll_4 spider_4 wisp_4 mimic_4 paper_3 mirror_1 ／ T8 ghost_5 doll_4 spider_4 wisp_4 mimic_4 paper_4 mirror_2
- `z_r_marsh_bog`（ティア 0〜8・lvOff 1・レア rm_bell_snail）: T0 frog_1 wisp_1 lizardman_1 mushroom_1 ghost_1 jelly_1 ／ T2 frog_2 wisp_2 lizardman_2 mushroom_2 ghost_2 jelly_2 paper_1 ／ T4 frog_3 wisp_3 lizardman_3 mushroom_3 ghost_3 jelly_3 paper_2 ／ T6 frog_4 wisp_4 lizardman_4 mushroom_4 ghost_4 jelly_4 paper_3 mirror_1 ／ T8 frog_4 wisp_4 lizardman_4 mushroom_4 ghost_5 jelly_5 paper_4 mirror_2
- `zw_isles`（ティア 0〜8・lvOff 0・レア rm_star_whale）: T0 seabird_1 crab_1 merman_1 jelly_1 ／ T2 seabird_2 crab_2 merman_2 jelly_2 paper_1 quicksilver_1 ／ T4 seabird_3 crab_3 merman_3 jelly_3 paper_2 quicksilver_1 ／ T6 seabird_4 crab_4 merman_4 jelly_4 paper_3 quicksilver_2 ／ T8 seabird_4 crab_4 merman_4 jelly_5 paper_4 quicksilver_2
- `z_r_isles_cave`（ティア 0〜8・lvOff 1）: T0 crab_1 merman_1 bat_1 kraken_1 ／ T2 crab_2 merman_2 bat_2 kraken_1 paper_1 ／ T4 crab_3 merman_3 bat_3 kraken_2 paper_2 ／ T6 crab_4 merman_4 bat_4 kraken_3 paper_3 mirror_1 ／ T8 crab_4 merman_4 bat_5 kraken_3 paper_4 mirror_2
- `z_r_isles_ship`（ティア 0〜8・lvOff 1・レア rm_treasure_crab）: T0 skeleton_1 merman_1 rat_1 seabird_1 kraken_1 mimic_1 ／ T2 skeleton_2 merman_2 rat_2 seabird_2 kraken_1 mimic_2 paper_1 ／ T4 skeleton_3 merman_3 rat_3 seabird_3 kraken_2 mimic_3 paper_2 ／ T6 skeleton_4 merman_4 rat_4 seabird_4 kraken_3 mimic_4 paper_3 mirror_1 ／ T8 skeleton_5 merman_4 rat_4 seabird_4 kraken_3 mimic_4 paper_4 mirror_2
- `zw_mine`（ティア 0〜8・lvOff 0・レア rm_gem_hedgehog）: T0 goblin_1 mole_1 beetle_1 golem_1 rat_1 ／ T2 goblin_2 mole_2 beetle_2 golem_1 rat_2 paper_1 quicksilver_1 ／ T4 goblin_3 mole_3 beetle_3 golem_2 rat_3 paper_2 quicksilver_1 ／ T6 goblin_4 mole_4 beetle_4 golem_3 rat_4 paper_3 quicksilver_2 ／ T8 goblin_5 mole_4 beetle_4 golem_3 rat_4 paper_4 quicksilver_2
- `z_r_mine_mine`（ティア 0〜8・lvOff 1・レア rm_prisma）: T0 goblin_1 mole_1 crystal_1 bat_1 beetle_1 golem_1 rat_1 ／ T2 goblin_2 mole_2 crystal_2 bat_2 beetle_2 golem_1 rat_2 paper_1 ／ T4 goblin_3 mole_3 crystal_3 bat_3 beetle_3 golem_2 rat_3 paper_2 ／ T6 goblin_4 mole_4 crystal_4 bat_4 beetle_4 golem_3 rat_4 paper_3 mirror_1 ／ T8 goblin_5 mole_4 crystal_4 bat_5 beetle_4 golem_3 rat_4 paper_4 mirror_2
- `zw_ash`（ティア 0〜8・lvOff 0・レア rm_spa_monkey）: T0 salamander_1 imp_1 orc_1 chimera_1 ／ T2 salamander_2 imp_2 orc_1 chimera_1 paper_1 quicksilver_1 ／ T4 salamander_3 imp_3 orc_2 chimera_2 paper_2 quicksilver_1 ／ T6 salamander_4 imp_4 orc_3 chimera_3 paper_3 quicksilver_2 ／ T8 salamander_5 imp_5 orc_3 chimera_3 paper_4 quicksilver_2
- `z_r_ash_volcano`（ティア 0〜8・lvOff 1・レア rm_volcano_turtle）: T0 salamander_1 gargoyle_1 imp_1 bat_1 chimera_1 ／ T2 salamander_2 gargoyle_2 imp_2 bat_2 chimera_1 paper_1 ／ T4 salamander_3 gargoyle_3 imp_3 bat_3 chimera_2 paper_2 ／ T6 salamander_4 gargoyle_4 imp_4 bat_4 chimera_3 paper_3 mirror_1 ／ T8 salamander_5 gargoyle_4 imp_5 bat_5 chimera_3 paper_4 mirror_2
- `zw_star`（ティア 0〜8・lvOff 0・レア rm_moon_sheep）: T0 eyeball_1 darkmage_1 automaton_1 wyvern_1 ／ T2 eyeball_2 darkmage_2 automaton_2 wyvern_1 paper_1 quicksilver_1 ／ T4 eyeball_3 darkmage_3 automaton_3 wyvern_2 paper_2 quicksilver_1 ／ T6 eyeball_4 darkmage_4 automaton_4 wyvern_3 paper_3 quicksilver_2 ／ T8 eyeball_5 darkmage_4 automaton_4 wyvern_3 paper_4 quicksilver_2
- `z_r_star_tower`（ティア 0〜8・lvOff 1・レア rm_clock_bird）: T0 automaton_1 armor_1 eyeball_1 darkmage_1 gargoyle_1 crystal_1 mimic_1 ／ T2 automaton_2 armor_2 eyeball_2 darkmage_2 gargoyle_2 crystal_2 mimic_2 paper_1 ／ T4 automaton_3 armor_3 eyeball_3 darkmage_3 gargoyle_3 crystal_3 mimic_3 paper_2 ／ T6 automaton_4 armor_4 eyeball_4 darkmage_4 gargoyle_4 crystal_4 mimic_4 paper_3 mirror_1 ／ T8 automaton_4 armor_4 eyeball_5 darkmage_4 gargoyle_4 crystal_4 mimic_4 paper_4 mirror_2
- `zw_center`（ティア 8 固定・lvOff 0）: paper_4 scribe_1 book_1 platinum_1
- `z_finale_archive_lo`（ティア 8 固定・lvOff 1・レア rm_bookworm）: scribe_1 book_1 scribe_2 book_2 paper_3 paper_4 armor_4 mimic_4 platinum_1
- `z_finale_archive_hi`（ティア 8 固定・lvOff 2・レア rm_golden_quill）: scribe_2 book_3 book_2 scribe_3 scribe_1 demon_1 paper_4 platinum_1
- `z_postgame_oblivion_lo`（ティア 9 固定・lvOff 0・レア rm_memory_fish）: void_1 chaos_1 demon_2 plant_5 scorpion_5 wolf_5 frostling_5 bee_5 mummy_5 platinum_1
- `z_postgame_oblivion_hi`（ティア 9 固定・lvOff 2・レア rm_dream_tapir）: void_2 void_1 chaos_2 demon_3 demon_2 ghost_5 goblin_5 salamander_5 imp_5 eyeball_5 skeleton_5 jelly_5 bat_5 platinum_2

---------------------------------------------------------------------------------------------------
## 8. 金色の個体（担当 battle A2 の `R.Mon.def`・`R.Mon.rollGolden`。データは作らない）
- **全種に自動で存在する**。対象外: `metal` `rare` `boss` の旗をもつ魔物、呼ばれた魔物、イベント戦（`troop` か `mons` を指定した戦闘）。データは作らない。
- 出方（成長章 §10.2）: ゾーンでのランダム戦闘で、1戦につき `1/40 × (1 + goldenPct合計/100)`（上限 +300%）。当たったら、対象の魔物から1体をランダムに金色にする（1戦に1体まで）。鋼だけの組・レア魔物への差し替えが起きた戦闘では抽選しない。
- `R.Mon.def(id, {golden:true})` が作る定義:
  - 名前: 「金色の」＋名前。名前が6字以上なら「金の」＋名前（例: 金色のぷちゼリー、金の氷牙の狼王）。
  - HP ×2、攻撃・術力・守備・術防・素早さ ×1.2、表示のレベル +2、経験値 ×3、お金 ×5。
  - ドロップ: 通常の確率 ×2、レア ×8、超レア ×8（上限は成長章 §10.1）。**品は元の種と同じ**（金色専用の品は無い）。
  - 閃き: rank +1、EF 1.5。
  - 絵: 組み立て後の `mon:<id>` に `tint:'#ffd24a'`。bui が 0.5 秒ごとにキラキラ（`obj:sparkle`）を体の上に重ねる。
- 演出: 「金色の〇〇が現れた！」、効果音 `golden`、BGM `rarebattle`、**手動で始まる**（オートを続けていても止まる）。
- 図鑑: 元の種の欄に「金色を倒した数」を出す（エンジン章 §5.12 の bookScreen）。
- 目安（成長章 §17.3-H3）: 1地方 95 戦で 2〜3 回。

---------------------------------------------------------------------------------------------------
## 9. 鋼の魔物（3 系統 × 2 段。担当 A11。規則は成長章 §10.5）
| 系統 | 段（出始め） | 元絵とフィルター | 出る所 | 特徴 |
|---|---|---|---|---|
| `quicksilver` 白銀のしずく | `quicksilver_1` 白銀のしずく（T2）→ `quicksilver_2` 白銀の大しずく（T6） | `jelly` 〔chrome〕 | 中盤のワールド全部（ティア2〜） | 水の術を少し使う。いちばん出会いやすい |
| `mirror` 鏡の甲虫 | `mirror_1` 鏡の甲虫（T5）→ `mirror_2` 鏡の大甲虫（T7） | `beetle` 〔mirror〕 | 中盤のダンジョン全部（ティア5〜） | まばゆい光（暗闇）で逃げるすきを作る |
| `platinum` 白金の灯 | `platinum_1` 白金の灯（T8）→ `platinum_2` 白金の大灯（T9） | `wisp` 〔platinum〕 | ビブリア島・大書庫・忘却の底 | 光線を撃つ。裏の稼ぎ役 |
- 規則: HP は `hpFixed`（8〜12、伸縮しない）、素早さ ×2.5、回避 30。**受けるダメージは1回の命中につき 1**（会心 2）、`metalHit:true` の技と**武器**だけ `ceil(3 × P)`。状態異常・即死・`percent`・弱体はすべて効かない。自分の手番ごとに 50% で逃げる（1ラウンド目から）。経験値 = 曲線 × 30、お金 × 10。閃き rank +1。**手動で始まる**（成長章 §13.1）。
- 鋼の組は同じ種の 1〜2 体だけ（ほかの魔物と混ざらない）。
- **鋼に通る武器**（`metalHit:true` の超レア武器。技章 §2.2 の `metalHit` を武器の項目にも広げる。§14 の依頼）: 白銀の流れ鞭（`quicksilver_2`）・鏡角の槍（`mirror_2`）・白金の太刀（`platinum_2`）の 3 本。鋼を倒すと鋼に強い武器が手に入る、という回り道。
- ドロップの枠: 通常 1/4、レア 1/16、超レア 1/128（成長章 §10.1）。品は §5 の表。


---------------------------------------------------------------------------------------------------
## 10. レア魔物（23。担当 A12 `rare.js`、絵は A15 `rare_monsters*.js`）

### 10.1 規則（成長章 §10.3 の具体化）
- `DB.rareEncounters[zone] = {mon, rate}`（rate は分母）。そのゾーンのランダム戦闘が、確率 `1/rate × (1 + rareEncPct合計/100) × 誘い寄せの香(2)` でレア魔物1体に差し替わる。
- 戦闘レベルはそのゾーンの Lb + 2。能力値は §1.2（KIND = 経験値・お金 ×5）で、`s.hp` は 2.8〜3.6（「HP ×3 前後」）。旗 `rare`、`fleeRate: 0.25`（2ラウンド目から、自分の手番ごと）、状態の耐性はボスの既定（成長章 §8.3）、即死は効かない、弱体の成功率 ×0.5。閃き rank +2、EF 2.0。
- **3つの枠すべてが専用の品**: 通常 1/2（専用の道具）、レア 1/6（専用のアクセサリ）、超レア 1/24（専用の超レア品）。夢食いバクは 1/2・1/4・1/12。
- 品のティア（§12.1）: 中盤の地方は**ティアが変わる**ので、レア枠・超レア枠は**アクセサリ**にした（能力値が少なく、特殊効果が主役なので、早く手に入っても崩れない）。レア枠 T4・超レア枠 T6。序章の宝石ウサギは T1・T2、大書庫は T8、忘却の底は T9（武器・盾も置く）。
- 演出: 「めったに出会えない魔物が現れた！」、キラキラ、BGM `rarebattle`、**手動で始まる**。倒すと図鑑に専用の印。
- 目安（成長章 §17.3-H3）: 1地方 0.8〜1.5 回。

### 10.2 一覧
| id | 名前 | 絵 | 種族 | ゾーン・確率 | 属性の倍率 | 打撃 / 耐性 | 能力 s | 行動 | 通常 / レア / 超レア（すべて専用） | 図鑑 |
|---|---|---|---|---|---|---|---|---|---|---|
| `rm_jewel_hare` | 宝石ウサギ | `rare_hare`（m）既存 | 獣 | `zw_prologue` 1/80 | 火1.25 | — / — | hp3 atk.9 def1.3 mdef1.3 agi1.8 | 攻撃3 · eb_hare_kick2 · eb_jewel_shine2 · eb_hop_rest1[HP<50%,1回] | i_jewel_carrot 1/2<br>ac_hare_charm 1/6<br>ac_moon_hare 1/24 | 額にサファイアを光らせる金色の<br>ウサギ。すぐに跳ねて逃げる。 |
| `rm_bloom_fawn` | 花角の小鹿 | `rare_fawn`（m）新 | 獣 | `zw_forest` 1/80 | 火1.25 光.25 闇1.5 | — / — | hp3 atk.9 mag1.2 mdef1.3 agi1.6 | 攻撃2 · eb_antler_thrust2 · eb_petal_storm2 · eb_fawn_bloom1[HP<60%,1回] | i_bloom_nectar 1/2<br>ac_bloom_antler 1/6<br>ac_forest_crown 1/24 | 角に花を咲かせた子鹿。<br>森の主の使いだという。 |
| `rm_glass_moth` | ガラスアゲハ | `rare_glassmoth`（m）新 | 虫・飛 | `z_r_forest_maze` 1/80 | 火1.5 風1.5 土.5 | — / 毒.5 | hp2.8 atk.8 mag1.3 mdef1.2 agi1.8 | 攻撃1 · eb_glass_scale2 · eb_prism_wing3 · eb_flutter1[1回] | i_glass_dust 1/2<br>ac_glass_wing 1/6<br>ac_stained_wing 1/24 | 羽がステンドグラスのように<br>光るチョウ。森の奥で舞っている。 |
| `rm_acorn_prince` | どんぐり王子 | `rare_acorn`（s）新 | 植物 | `z_r_forest_tree` 1/80 | 火1.5 水.5 土.75 | 斬1.25 / 眠.5 毒.5 | hp3.2 def1.5 agi1.4 | 攻撃2 · eb_acorn_barrage3 · eb_shell_guard1[1回] | i_golden_acorn 1/2<br>ac_acorn_cap 1/6<br>ac_prince_badge 1/24 | 千年樹の根もとで生まれた<br>どんぐりの王子さま。 |
| `rm_diamond_lizard` | 金剛トカゲ | `rare_lizard`（m）既存 | 獣 | `zw_desert` 1/80 | 火1.25 風1.5 土.25 | — / — | hp3 def1.8 mdef1.2 agi1.5 | 攻撃3 · eb_tail_whip2 · eb_jewel_shine2 · eb_diamond_scales1[1回] | i_diamond_dust 1/2<br>ac_diamond_scale 1/6<br>ac_diamond_heart 1/24 | 背中に金剛石のうろこが並ぶ<br>トカゲ。砂漠の岩場にひそむ。 |
| `rm_gold_idol` | 黄金の守護像 | `rare_idol`（m）既存 | 魔造 | `z_r_desert_tomb` 1/80 | 水1.25 風.75 光.25 闇1.5 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | hp3.2 atk.9 mag1.3 def1.5 mdef1.5 agi1.3 | 攻撃1 · eb_idol_ray3 · eb_idol_curse2 · eb_idol_ward1[1回] | i_gold_bar 1/2<br>ac_idol_jade 1/6<br>ac_idol_halo 1/24 | 王墓の奥で宙に浮かぶ黄金の像。<br>墓の宝を守り続けている。 |
| `rm_aurora_bird` | オーロラ鳥 | `rare_bird`（m）既存 | 鳥・飛 | `zw_snow` 1/80 | 風1.5 土.5 光.25 闇1.5 | 突1.25 / — | hp2.8 atk.9 mag1.3 mdef1.3 agi1.8 | 攻撃1 · eb_aurora_ray3 · e_gust2 · eb_aurora_veil1[1回] | i_aurora_feather 1/2<br>ac_aurora_plume 1/6<br>ac_aurora_orb 1/24 | 吹雪がやんだ夜にだけ飛ぶ、<br>オーロラ色の翼の鳥。 |
| `rm_icetail_fox` | 氷尾ギツネ | `rare_icefox`（m）新 | 獣 | `z_r_snow_peak` 1/80 | 火1.25 水.25 土1.5 | — / — | hp3 mag1.2 agi1.8 | 攻撃2 · eb_ice_foxfire2 · eb_nine_tails2 · eb_fox_trick1 | i_fox_icicle 1/2<br>ac_icetail 1/6<br>ac_icefox_mask 1/24 | 五本の氷の尾をもつキツネ。<br>旅人を化かして遊ぶ。 |
| `rm_lotus_sprite` | はすの精 | `rare_lotus`（s）新 | 妖精 | `zw_marsh` 1/80 | 水.25 土1.5 光.5 闇1.5 | — / 混.5 | hp3 atk.8 mag1.3 mdef1.3 agi1.6 | 攻撃1 · e_water_bolt2 · eb_lotus_bubble2 · eb_lotus_dew1[HP<60%] | i_lotus_dew 1/2<br>ac_lotus_bloom 1/6<br>ac_mud_pearl 1/24 | 湿原のはすの花に住む精。<br>霧の朝にだけ顔を出す。 |
| `rm_ghost_teapot` | おばけ茶器 | `rare_teapot`（s）新 | 魔造 | `z_r_marsh_manor` 1/80 | 水1.25 風.75 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | hp3 atk.9 mag1.3 def1.3 agi1.5 | 攻撃1 · eb_hot_tea3 · eb_steam_puff2 · eb_tea_party1[HP<60%,1回] | i_ghost_tea 1/2<br>ac_teacup 1/6<br>ac_teapot_lid 1/24 | 館で一人お茶会を続ける茶器。<br>誰かを待っているらしい。 |
| `rm_bell_snail` | 鐘カタツムリ | `rare_bellsnail`（m）新 | 水棲 | `z_r_marsh_bog` 1/80 | 火.75 水.5 土1.25 | — / — | hp3.4 atk.9 def1.6 mdef1.4 agi1.2 | 攻撃2 · eb_bell_toll2 · eb_slime_trail2 · eb_shell_retreat1[1回] | i_snail_bell 1/2<br>ac_snail_shell 1/6<br>ac_seven_bells 1/24 | 鐘を背負ったカタツムリ。<br>沈んだ鐘の一つだという噂も。 |
| `rm_star_whale` | 星くじら | `rare_whale`（l）既存 | 水棲・飛 | `zw_isles` 1/80 | 火.75 水.5 風1.5 土.5 光.25 闇1.5 | — / — | hp2.8 atk.9 mag1.3 mdef1.3 agi1.3 | 攻撃1 · eb_stardust_spout3 · eb_whale_song2 · eb_star_tide1[HP<60%,1回] | i_stardust 1/2<br>ac_star_ambergris 1/6<br>ac_skywhale_shell 1/24 | 夜の海の上を泳ぐ小さな空の<br>くじら。背中に星がまたたく。 |
| `rm_treasure_crab` | 財宝ヤドカリ | `rare_hermit`（m）新 | 水棲 | `z_r_isles_ship` 1/80 | 火.75 水.5 土1.25 | — / — | hp3.2 def1.7 agi1.3 | 攻撃2 · eb_coin_toss2 · eb_greed_claw2 · eb_goblet_guard1[1回] | i_gold_coins 1/2<br>ac_pirate_goblet 1/6<br>ac_treasure_map 1/24 | 沈没船の宝の杯を背負った<br>ヤドカリ。金貨を投げてくる。 |
| `rm_gem_hedgehog` | 宝石ハリネズミ | `rare_hedgehog`（s）新 | 獣 | `zw_mine` 1/80 | 火1.25 風1.5 土.25 | — / — | hp3 def1.6 agi1.6 | 攻撃2 · eb_gem_quills3 · eb_sparkle1 · eb_curl_up1[1回] | i_gem_quill 1/2<br>ac_gem_brooch 1/6<br>ac_hedgehog_crown 1/24 | 背中の針が宝石のハリネズミ。<br>鉱夫たちのあこがれ。 |
| `rm_prisma` | プリズマ | `rare_prism`（m）既存 | 魔造 | `z_r_mine_mine` 1/80 | 水1.25 風.75 光.25 闇1.5 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | hp3 atk.8 mag1.4 def1.4 mdef1.5 agi1.5 | 攻撃1 · eb_prism_beam3 · eb_sparkle2 · eb_refract1[1回] | i_prism_shard 1/2<br>ac_prism_ring 1/6<br>ac_prism_heart 1/24 | 坑道の奥で生まれた生きた結晶。<br>光を七色に割って放つ。 |
| `rm_spa_monkey` | 湯けむり猿 | `rare_monkey`（m）新 | 獣 | `zw_ash` 1/80 | 火1.25 水.25 土1.5 | — / — | hp3.2 mag1.1 agi1.5 | 攻撃2 · eb_hot_splash2 · eb_towel_snap2 · eb_bath_heal1[HP<60%,1回] | i_spa_egg 1/2<br>ac_spa_towel 1/6<br>ac_monkey_bucket 1/24 | カルデラの温泉が大好きな猿。<br>湯おけごと現れる。 |
| `rm_volcano_turtle` | 火山ガメ | `rare_turtle`（m）新 | 獣 | `z_r_ash_volcano` 1/80 | 火.25 水1.5 | — / — | hp3.4 def1.8 mdef1.3 agi1.1 | 攻撃2 · eb_shell_eruption3 · eb_lava_bite1 · eb_shell_retreat1[1回] | i_volcano_stone 1/2<br>ac_turtle_shell 1/6<br>ac_volcano_heart 1/24 | 背中の火山で卵を温めるカメ。<br>百年に一度しか姿を見せない。 |
| `rm_moon_sheep` | 月見ヒツジ | `rare_sheep`（m）新 | 獣 | `zw_star` 1/80 | 火1.25 光.25 闇1.5 | — / — | hp3.2 atk.8 mag1.3 def1.3 mdef1.3 agi1.4 | 攻撃1 · eb_moonbeam2 · eb_moon_lullaby2 · eb_wool_puff1[1回] | i_moon_wool 1/2<br>ac_moon_bell 1/6<br>ac_crescent_horn 1/24 | 月の夜に高原をただよう羊。<br>毛の中に星をためている。 |
| `rm_clock_bird` | ぜんまい鳥 | `rare_clockbird`（s）新 | 魔造・飛 | `z_r_star_tower` 1/80 | 水1.25 風1.5 土.5 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | hp2.8 def1.4 agi1.9 | 攻撃2 · eb_gear_peck2 · eb_alarm2 · eb_tick_tock1[1回] | i_spring_key 1/2<br>ac_clock_feather 1/6<br>ac_perpetual_gear 1/24 | 賢者カペラが作ったといわれる<br>からくりの小鳥。 |
| `rm_bookworm` | 本の虫 | `rare_bookworm`（s）新 | 虫 | `z_finale_archive_lo` 1/80 | 火1.5 | — / 毒.5 | hp3 atk.9 mag1.3 mdef1.3 agi1.5 | 攻撃2 · eb_nibble_page2 · eb_spectacle_glare2 · eb_study1[1回] | i_wisdom_page 1/2<br>ac_worm_spectacles 1/6<br>ac_scholar_monocle 1/24 | 大書庫の本を食べて育った虫。<br>物知りだが、めがねが手放せない。 |
| `rm_golden_quill` | 黄金の羽ペン | `rare_quill`（s）新 | 魔造・飛 | `z_finale_archive_hi` 1/80 | 水1.25 風1.5 土.5 光.25 闇1.5 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | hp2.8 atk.8 mag1.4 mdef1.4 agi1.8 | 攻撃1 · eb_golden_script3 · eb_ink_blot2 · eb_rewrite_self1[HP<50%,1回] | i_golden_ink 1/2<br>ac_golden_nib 1/6<br>w_staff_goldquill 1/24 | 最初の語り部が使ったという<br>伝説の羽ペン。ひとりでに書く。 |
| `rm_memory_fish` | 記憶の金魚 | `rare_goldfish`（s）新 | 水棲 | `z_postgame_oblivion_lo` 1/80 | 火.75 水.25 土1.5 | — / — | hp3 atk.9 mag1.4 mdef1.4 agi1.7 | 攻撃1 · eb_memory_bubble2 · eb_forget_splash2 · eb_fin_heal1[HP<60%] | i_memory_bubble 1/2<br>ac_goldfish_scale 1/6<br>sh_memory_bowl 1/24 | 忘れられた思い出を泡に<br>とじこめて泳ぐ金魚。 |
| `rm_dream_tapir` | 夢食いバク | `rare_tapir`（l）新 | 獣 | `z_postgame_oblivion_hi` 1/200 | 火1.25 | — / — | hp3.6 atk1.1 mag1.4 def1.3 mdef1.4 agi1.4・行動2回 | 攻撃1 · eb_dream_eat3 · eb_sleep_mist2 · eb_nightmare2 · eb_tapir_nap1[HP<50%,1回] | i_dream_fruit 1/2<br>ac_dream_pillow 1/4<br>w_katana_dreamcut 1/12 | 忘却の底で、忘れられた夢を<br>食べて生きるという幻の獣。 |

HP の目安（成長章 §14.2 の曲線 × 大きさ × `s.hp`。戦闘レベル = ゾーンの Lb + 2）:
| id | 出る所の Lb（例） | HP の例 | 経験値・お金 |
|---|---|---|---|
| `rm_jewel_hare` | zw_prologue | T0: Lb5 HP65 | 曲線×大きさ×5 |
| `rm_bloom_fawn` | zw_forest | T0: Lb8 HP100 / T4: Lb32 HP575 / T7: Lb50 HP1158 | 曲線×大きさ×5 |
| `rm_glass_moth` | z_r_forest_maze | T0: Lb9 HP105 / T4: Lb33 HP562 / T7: Lb51 HP1116 | 曲線×大きさ×5 |
| `rm_acorn_prince` | z_r_forest_tree | T0: Lb9 HP84 / T4: Lb33 HP450 / T7: Lb51 HP893 | 曲線×大きさ×5 |
| `rm_diamond_lizard` | zw_desert | T0: Lb8 HP100 / T4: Lb32 HP575 / T7: Lb50 HP1158 | 曲線×大きさ×5 |
| `rm_gold_idol` | z_r_desert_tomb | T0: Lb9 HP120 / T4: Lb33 HP642 / T7: Lb51 HP1276 | 曲線×大きさ×5 |
| `rm_aurora_bird` | zw_snow | T0: Lb8 HP93 / T4: Lb32 HP536 / T7: Lb50 HP1081 | 曲線×大きさ×5 |
| `rm_icetail_fox` | z_r_snow_peak | T0: Lb9 HP113 / T4: Lb33 HP602 / T7: Lb51 HP1196 | 曲線×大きさ×5 |
| `rm_lotus_sprite` | zw_marsh | T0: Lb8 HP70 / T4: Lb32 HP402 / T7: Lb50 HP811 | 曲線×大きさ×5 |
| `rm_ghost_teapot` | z_r_marsh_manor | T0: Lb9 HP79 / T4: Lb33 HP421 / T7: Lb51 HP837 | 曲線×大きさ×5 |
| `rm_bell_snail` | z_r_marsh_bog | T0: Lb9 HP128 / T4: Lb33 HP682 / T7: Lb51 HP1356 | 曲線×大きさ×5 |
| `rm_star_whale` | zw_isles | T0: Lb8 HP186 / T4: Lb32 HP1073 / T7: Lb50 HP2162 | 曲線×大きさ×5 |
| `rm_treasure_crab` | z_r_isles_ship | T0: Lb9 HP120 / T4: Lb33 HP642 / T7: Lb51 HP1276 | 曲線×大きさ×5 |
| `rm_gem_hedgehog` | zw_mine | T0: Lb8 HP70 / T4: Lb32 HP402 / T7: Lb50 HP811 | 曲線×大きさ×5 |
| `rm_prisma` | z_r_mine_mine | T0: Lb9 HP113 / T4: Lb33 HP602 / T7: Lb51 HP1196 | 曲線×大きさ×5 |
| `rm_spa_monkey` | zw_ash | T0: Lb8 HP106 / T4: Lb32 HP613 / T7: Lb50 HP1235 | 曲線×大きさ×5 |
| `rm_volcano_turtle` | z_r_ash_volcano | T0: Lb9 HP128 / T4: Lb33 HP682 / T7: Lb51 HP1356 | 曲線×大きさ×5 |
| `rm_moon_sheep` | zw_star | T0: Lb8 HP106 / T4: Lb32 HP613 / T7: Lb50 HP1235 | 曲線×大きさ×5 |
| `rm_clock_bird` | z_r_star_tower | T0: Lb9 HP74 / T4: Lb33 HP393 / T7: Lb51 HP781 | 曲線×大きさ×5 |
| `rm_bookworm` | z_finale_archive_lo | T8: Lb57 HP1006 | 曲線×大きさ×5 |
| `rm_golden_quill` | z_finale_archive_hi | T8: Lb58 HP967 | 曲線×大きさ×5 |
| `rm_memory_fish` | z_postgame_oblivion_lo | T9: Lb62 HP1158 | 曲線×大きさ×5 |
| `rm_dream_tapir` | z_postgame_oblivion_hi | T9: Lb64 HP4190 | 曲線×大きさ×5 |

### 10.3 新しい絵（17。A15 が `src/art/rare_monsters_b.js` に描く。既存の6つはクレストの絵をそのまま使う）
「ひと目でレアと分かる」こと（宝石・金・虹・光の点を必ず入れる）。大きさは括弧のとおり（s 32 / m 48 / l 64）。
- `rare_fawn`（花角の小鹿）: 48×48。白い斑点の子鹿が前足をそろえて立つ。角は若木の枝で、先に桃色と白の小花が咲き、葉が2〜3枚。目は大きく潤んだ黒。足もとに花びらが3〜4枚舞う。色: 毛 #c89060→#f0d8b0、斑点 #fff8e8、花 #ff90c0/#ffffff、葉 #60b040。
- `rare_glassmoth`（ガラスアゲハ）: 48×48。大きなアゲハチョウが羽を広げて正面を向く。4枚の羽はステンドグラスのように黒い枠で区切られ、区画ごとに赤・青・緑・黄の半透明の色（明るい点を1つずつ）。体は細い銀色、触角の先に小さな光の粒。羽の下に落ちる色つきの光のかけらを数点。
- `rare_acorn`（どんぐり王子）: 32×32。丸々としたどんぐりに短い手足と、帽子（殻斗）の上に葉っぱ2枚の小さな冠。ぱっちりした目、赤いほっぺ、小さな木の枝の笏を片手に。色: 実 #b07038→#e0a868、帽子 #806040 の網目、冠の葉 #70c050、ふち #ffd040。
- `rare_icefox`（氷尾ギツネ）: 48×48。白いキツネが座って振り返る。背後に扇のように広がる5本の尾は先が透明な氷の結晶になり、青い光を帯びる。額に水色の菱形の印、切れ長の金色の目。足もとに青いきつね火を2つ。色: 毛 #f0f4ff、影 #a0b0d8、氷 #c0f0ff/#ffffff、狐火 #60c0ff。
- `rare_lotus`（はすの精）: 32×32。大きなはすの葉の上、開いた桃色のはすの花の中に、緑の髪の小さな精がひざを抱えて座る。頭に水滴の冠、背中に葉脈の透ける羽。葉のふちに水玉が光る。色: 花 #ffa0c8→#fff0f4、葉 #50a060、髪 #80e0a0、水玉 #e0ffff。
- `rare_teapot`（おばけ茶器）: 32×32。白地に青い花模様の陶器のティーポットが宙に浮く。ふたが少し持ち上がり、すき間から2つの丸い目がのぞく。注ぎ口から湯気がくるりと出て、まわりにカップとソーサーが2組ぷかぷか浮かぶ。色: 陶器 #f4f4f0、模様 #4060c0、ふちの金 #e0c060、湯気 #e0e8ff。
- `rare_bellsnail`（鐘カタツムリ）: 48×48。殻の代わりに緑青の浮いた青銅の鐘を背負ったカタツムリ。鐘の口は後ろ向きで、中に小さな舌（鐘の玉）が見える。のびた目の先は金色、体は薄緑の半透明で、這った跡が光る。色: 鐘 #b08040/#60a090(緑青)、体 #c0e8c0、跡 #e0fff0。
- `rare_hermit`（財宝ヤドカリ）: 48×48。宝石をはめた大きな黄金の杯を殻の代わりに背負ったヤドカリ。杯からは金貨と真珠の首飾りがあふれ、はさみの一方に金貨を1枚つまむ。赤い体、黒い点の目。色: 杯 #f0c030→#fff0a0、宝石 #e02040/#30a0e0、体 #d05030、真珠 #f8f0f0。
- `rare_hedgehog`（宝石ハリネズミ）: 32×32。背中の針がすべて細長い宝石（赤・青・緑・紫・透明）になったハリネズミ。丸い黒目と小さな鼻、前足を上げて立つ。針の先に白い光の点。色: 体 #c8a080、腹 #f0e0c8、宝石 #ff4060/#40a0ff/#40e080/#c060ff/#e0f8ff。
- `rare_monkey`（湯けむり猿）: 48×48。木の湯おけにつかった赤い顔の猿。頭に白い手ぬぐいをのせ、片手に温泉たまごを持って目を細める。おけのふちから湯があふれ、湯けむりが2〜3すじ立つ。色: 毛 #c0a080、顔 #f07060、おけ #a07040、湯 #80c0e0、手ぬぐい #ffffff。
- `rare_turtle`（火山ガメ）: 48×48。甲羅が小さな火山になったカメ。甲羅の頂に赤く光る火口があり、細い煙が立ちのぼる。甲羅の割れ目にルビーのような結晶が点々と光り、首をのばして正面を見る。色: 甲羅 #504040、溶岩 #ff6020/#ffd040、ルビー #e02040、皮 #807050。
- `rare_sheep`（月見ヒツジ）: 48×48。雲のようにふわふわの白い毛のヒツジが宙に浮く。頭に金色の三日月形の角が1本、首に小さな銀の鈴。毛の中に小さな星がちらちら光る。眠そうな半目。色: 毛 #f8f8ff/#c0c8f0(影)、角 #ffe070、星 #fff8c0、鈴 #d0d8e0。
- `rare_clockbird`（ぜんまい鳥）: 32×32。真ちゅうの歯車を組んだ小鳥。胸に時計の文字盤、背中に大きなぜんまいのねじ。羽は薄い金属板の重なり、目は赤いガラス玉。小さな歯車が1〜2個宙に飛ぶ。色: 真ちゅう #d0a040/#f0d890、文字盤 #f8f0e0、ねじ #a0a8b8、目 #ff3030。
- `rare_bookworm`（本の虫）: 32×32。丸めがねをかけた太った緑のいも虫が、開いた本の上に寝そべる。本の頁にかじった穴があき、いも虫の口に紙の切れはし。背中の節ごとに小さな文字模様。色: 体 #90d060/#60a040、めがね #d0c060、本 #c04040(表紙)/#f0e8d0(頁)。
- `rare_quill`（黄金の羽ペン）: 32×32。金色に光る大きな羽ペンがななめに宙に浮き、ペン先から金のインクで書いた光の文字（3〜4文字の曲線）がリボンのように流れる。羽の付け根に小さな白い翼が一対。色: 羽 #f0c030→#fff4b0、ペン先 #c09020、光の文字 #fff8d0、翼 #ffffff。
- `rare_goldfish`（記憶の金魚）: 32×32。大きな泡の中を泳ぐ、ひらひらの尾の金魚。泡の表面に、ぼんやりした景色（家・木・人の影）がうつる。金魚の目はやさしい黒。泡のまわりに小さな泡を数個。色: 金魚 #ff8040/#fff0c0(尾)、泡 #c0f0ff 半透明、景色 #a0b0c0。
- `rare_tapir`（夢食いバク）: 64×64。紺色の夜空のような体に白い星の模様をもつバク。長い鼻の先から、七色のしゃぼん玉のような夢の泡を吸いこんでいる。背中は白く、月のように淡く光る。目は閉じて満足げ。まわりに夢の泡（中に小さな城・花・月）が3つ浮く。色: 体 #283060→#5060a0、背 #e0e8ff、星 #ffffff、泡 虹色の縁。

---------------------------------------------------------------------------------------------------
## 11. ボス（26 編成・34 体。担当 A12 `bosses.js` `troops.js`、絵は A15 `bosses*.js`）

### 11.1 段階の変化 `phases`（新。担当 battle A2）
```js
phases: [{ hpBelow: 0.5, msg: '…', set: { actsPerTurn?, elem?, phys?, buffs?: {stat: 段階}, sprite? } }]
```
- ダメージを受けて HP の割合が初めて `hpBelow` を下回ったとき、その行動の終わりに1回だけ: `msg` を出し（イベント `{t:'phase', u, msg}`、効果音 `shake`）、`set` を当てはめる。
  - `actsPerTurn`: 置き換える。`elem` `phys`: キーごとに上書き。`buffs`: 段階を足す（−2〜+2 に収める。強化を消す `dispel` で消えるのは足した分も同じ）。`sprite`: 絵を差し替える（bui は `mon:<sprite>` を読み直し、白く光らせて入れ替える）。
- 1体に複数の段階があれば、上から順に判定する。

### 11.2 能力値（成長章 §14.3 の表を `bossType` ごとに当てはめる。担当 battle A2 の `R.Mon.fillStats`）
| bossType | 使う編成 | lvOff | hpMul（`hpShare` が無いとき） | atk | mag | def・mdef | agi | 行動回数 | 経験値・お金 |
|---|---|---|---|---|---|---|---|---|---|
| `prologue` | 序章 | （lv 8 固定） | 11 | ×1.25 | ×1.25 | ×1.1 | ×1.0 | 1（段階で 2） | ×10・×15 |
| `mid` | 地方の中ボス | +2 | 10 | ×1.3 | ×1.3 | ×1.1 | ×1.1 | 1（段階で 2。楽団は各1） | ×10・×15 |
| `region` | 地方ボス | +3 | 18 | ×1.5 | ×1.4 | ×1.2 | ×1.2 | 2 | ×20・×15 |
| `rival` | ロウェル | +2 | 10 | ×1.3 | ×1.3 | ×1.1 | ×1.1 | 1 / 2 | ×10・×15 |
| `fmid` | 終盤の中ボス | +2 | 20 | ×1.5 | ×1.5 | ×1.2 | ×1.2 | 2（ラザロは 1→2） | ×20・×15 |
| `last1` | ラスボス1 | +4 | 30 | ×1.6 | ×1.6 | ×1.25 | ×1.3 | 2 | ×40・×15 |
| `last2` | ラスボス2 | +4 | 36 | ×1.6 | ×1.6 | ×1.25 | ×1.3 | 3 | ×40・×15 |
| `echo` | 魔王の残影 | +4 | 30 | ×1.7 | ×1.7 | ×1.25 | ×1.3 | 2（段階で 3） | ×30・×15 |
| `super` | 円環竜 | +8 | 45 | ×1.8 | ×1.8 | ×1.3 | ×1.4 | 3 | ×40・×15 |
| `add` | お供 | 編成と同じ | `hpShare` | 主のボスと同じ | 同じ | 同じ | 同じ | 1 | ×2・×2 |
```
hp = round(hpBoss(lv) × (hpShare ?? hpMul))        hpBoss は成長章 §14.3
ほか = 曲線(lv) × 上の倍率（ボスには大きさ s/m/l の倍率をかけない）
```
- `lv` は編成の Lb（`scale:'tier'` の編成は、データの `lv` を LZ(0)+lvOff で書いておき、戦闘で伸縮する）。お供の雑魚（`'@mummy'` など）は雑魚の規則のまま、同じ Lb で出る。
- 地方の中ボス・ボスの**ボスごとの個性は `s`（±20%）で付けてよい**（シミュレーターの結果で直す）。この表では全員 1 にしてある。
- HP の例（成長章 §14.3 の検算と同じ値になる）:

| 編成 | HP（ティア / Lb） |
|---|---|
| `tr_b_pageeater` | T0(Lb8): pageeater 243 |
| `tr_b_moth` | T0(Lb8): moth 221<br>T3(Lb26): moth 1153<br>T7(Lb50): moth 3924 |
| `tr_b_rooteater` | T0(Lb9): root 38 / rooteater 380<br>T3(Lb27): root 185 / rooteater 1845<br>T7(Lb51): root 613 / rooteater 6130 |
| `tr_b_sandworm` | T0(Lb8): sandworm 221<br>T3(Lb26): sandworm 1153<br>T7(Lb50): sandworm 3924 |
| `tr_b_sandking` | T0(Lb9): sandking 405<br>T3(Lb27): sandking 1968<br>T7(Lb51): sandking 6539 |
| `tr_b_icegiant` | T0(Lb8): icegiant 221<br>T3(Lb26): icegiant 1153<br>T7(Lb50): icegiant 3924 |
| `tr_b_whitedragon` | T0(Lb9): whitedragon 456<br>T3(Lb27): whitedragon 2214<br>T7(Lb51): whitedragon 7356 |
| `tr_b_dolls` | T0(Lb8): doll_violin 44 / doll_conductor 89 / doll_drum 44 / doll_flute 44<br>T3(Lb26): doll_violin 231 / doll_conductor 461 / doll_drum 231 / doll_flute 231<br>T7(Lb50): doll_violin 785 / doll_conductor 1570 / doll_drum 785 / doll_flute 785 |
| `tr_b_mistbeast` | T0(Lb9): mistbeast 456<br>T3(Lb27): mistbeast 2214<br>T7(Lb51): mistbeast 7356 |
| `tr_b_octopus` | T0(Lb8): tentacle 33 / octopus 155<br>T3(Lb26): tentacle 173 / octopus 807<br>T7(Lb50): tentacle 589 / octopus 2747 |
| `tr_b_captain` | T0(Lb9): captain 405<br>T3(Lb27): captain 1968<br>T7(Lb51): captain 6539 |
| `tr_b_rockeater` | T0(Lb8): rockeater 221<br>T3(Lb26): rockeater 1153<br>T7(Lb50): rockeater 3924 |
| `tr_b_ironwarden` | T0(Lb9): ironwarden 456<br>T3(Lb27): ironwarden 2214<br>T7(Lb51): ironwarden 7356 |
| `tr_b_hellhound` | T0(Lb8): hellhound 221<br>T3(Lb26): hellhound 1153<br>T7(Lb50): hellhound 3924 |
| `tr_b_lavabeast` | T0(Lb9): lavabeast 456<br>T3(Lb27): lavabeast 2214<br>T7(Lb51): lavabeast 7356 |
| `tr_b_orrery` | T0(Lb8): orrery 221<br>T3(Lb26): orrery 1153<br>T7(Lb50): orrery 3924 |
| `tr_b_stareater` | T0(Lb9): stareater 456<br>T3(Lb27): stareater 2214<br>T7(Lb51): stareater 7356 |
| `tr_b_rowell1` | T2(Lb20): rowell1 751 |
| `tr_b_rowell2` | T5(Lb38): rowell2 2284 |
| `tr_b_bookgolem` | T8(Lb56): bookgolem 9924 |
| `tr_b_heroshades` | T8(Lb56): shade_sword 3970 / shade_prayer 2977 / shade_star 2977 |
| `tr_b_lazaro` | T8(Lb56): lazaro 9924 |
| `tr_b_nemrea1` | T8(Lb58): nemrea1 16029 |
| `tr_b_nemrea2` | T8(Lb58): nemrea2 19235 |
| `tr_b_valzard_echo` | T9(Lb64): valzard_echo 19788 |
| `tr_b_ouroboros` | T9(Lb68): ouroboros 33389 |

### 11.3 ボスごとの仕掛け（何が効くか）
| 編成 | 仕掛け |
|---|---|
| `tr_b_pageeater` ページ食らい | 紙の体: **火・闇 1.5**、光 0.5、斬 1.25・打 0.75。3手ごとに「言葉を食べる」（中列の術師をねらう MP 減らし＋沈黙40%）。HP 半分で2回行動。最初のボスなので状態異常は暗闇だけ。 |
| `tr_b_moth` ダストウィング | 虫・飛ぶ: **火・風 1.5**、土 0.5、槍の対空技がよく効く。眠り・毒のりん粉を全体に（25〜30%）。HP 半分で2回行動。 |
| `tr_b_rooteater` 根食らい | 左右に**根の触手**（HP の取り分 1.5 ずつ）。触手は2手ごとに本体を 5% 回復させ、本体は4手ごとに根を呼び足す（3体まで）。**根を先に払う**のが定石。土の親和: 風 1.5・土 0.25、火 1.5。 |
| `tr_b_sandworm` 砂もぐり | 3手ごとに「砂にもぐる」（守備力+2）→ 次の手で「砂中の一撃」（物理 1.9）。**もぐったら防御**。土の親和: 風 1.5。 |
| `tr_b_sandking` 名なき砂の王 | 不死: **光 2.0**、火 1.5、闇は吸収。「名を奪う呪い」で術師を沈黙。4手ごとにミイラを呼ぶ（地方のミイラの段）。HP 40% で攻撃力・術力+1。 |
| `tr_b_icegiant` 氷壁の巨人 | 水の親和: 土 1.5、火 1.25。HP 60% で「氷の壁」（守備力+2・術防+1）→ **強化を消す技・術**で消せる。 |
| `tr_b_whitedragon` 白竜ネーヴェ | 竜・飛ぶ・水の親和: **水は吸収**、土 1.5・風 1.5、火 1.25、ほか 0.75、斬 0.75。HP 半分で「胸の氷にひび」→ **火 1.5** になり、氷河落とし（術 1.6）を使い始める。 |
| `tr_b_dolls` 人形の楽団 | 4体（弦ひき・指揮者・太鼓・笛）。魔造: 打 1.5、水 1.25、毒・眠り・混乱・即死は効かない（気絶・まひ・暗闇・沈黙は効く）。**指揮者が3手ごとに倒れた楽士をよみがえらせる**ので、指揮者を先に倒すか、楽士をまとめて倒す。 |
| `tr_b_mistbeast` 霧食らい | 霊体: 斬打突 0.75、**風・光 1.5**。4手ごとに魔女の分身（HP の取り分 1）を呼び、4手ごとに霧を吸って 8% 回復。HP 半分で本当の口が現れ、**物理が 1.0 で通る**ようになる。 |
| `tr_b_octopus` 深みの大ダコ | 左右に**大ダコの足**（まひ25%の巻きつき）。本体は4手ごとに足を生やす（3体まで）。水の親和: 土 1.5。墨の雲（全体暗闇30%）。 |
| `tr_b_captain` 亡霊船長グレン | 不死: **光 2.0**、火 1.5。左右に骸骨の船員（地方の骸骨の段）。一斉砲撃（全体・火）、亡霊の舟歌（全体眠り25%）。HP 半分で攻撃力+1。 |
| `tr_b_rockeater` 岩食らい | 3手ごとに「岩をかみ砕く」（10%回復・守備力+1）。土の親和: 風 1.5（火は 1.0）。落盤（全体・気絶15%）。 |
| `tr_b_ironwarden` 鉄の番人 | 魔造: **水 1.5（さび）**、打 1.5、風 0.75、毒・眠り・混乱・即死は無効。最初は1回行動 → HP 75% で2回行動 → **HP 30% で炉心が燃え、水 2.0**・攻撃力+1。最後は水で押す。 |
| `tr_b_hellhound` 炎の番犬 | 火の親和: **水 1.5**。2回行動。炎の遠吠え（全体やけど25%）→ 凍結でやけどは消える（成長章 §8.1）。HP 半分で猛り（攻撃力+2、1回）。 |
| `tr_b_lavabeast` 溶岩の巨獣 | 前半: **火を吸収、水 1.5**。HP 半分で「溶岩が冷えて固まる」→ 火 0.5・水 1.0・**風 1.5**・土 0.25、守備力+2・素早さ−1、絵が黒い岩（`b_lavabeast_cold`）に変わり、行動も黒曜の拳・灰の嵐に変わる。**属性を切り替える**のが仕掛け。 |
| `tr_b_orrery` 天球の番人 | 魔造・光の親和: **闇 1.5**、打 1.5。行動が太陽（火・単体）→ 月（水・全体）→ 星（光・3回）の順にくり返す（読める）。HP 60% で術防+2。 |
| `tr_b_stareater` 星食らい | 魔族・闇の親和: **光 1.5**。3手ごとに星を飲んで 10% 回復・術力+1（**強化を消す**で消せる）。HP 半分で**光 2.0**。 |
| `tr_b_rowell1` / `tr_b_rowell2` ロウェル | 人型・光の親和: 闇 1.5。「力の書き写し」でこちらの強化を消して沈黙。負けても続く（`canLose`、ワールド章 §9.2）。2戦目は2回行動と白紙の頁（全体沈黙25%）。 |
| `tr_b_bookgolem` 本の巨人 | 魔造・紙: **火 1.5**、打 1.5、水 1.25。4手ごとに製本しなおして 10% 回復、本（かみつき本）を呼ぶ。 |
| `tr_b_heroshades` 伝説の三つの影 | 霊体（物理は 1.0 で通る）・光の親和: **闇 1.5**。剣の影（取り分 8、物理の主力）、祈りの影（取り分 6、回復と**1回だけの蘇生**）、星の影（取り分 6、全体の術）。祈りの影を先に。 |
| `tr_b_lazaro` 大書記ラザロ | 人型・光の親和: **闇 1.5**。白の書（単体の沈黙50%＋強化を消す。中列をねらう）、記憶を消す（全体の MP 減らし）。4手ごとに書記を呼ぶ。HP 半分で2回行動。 |
| `tr_b_nemrea1` 虚ろの王 | 霊体（物理 1.0）: 火・闇 1.25、光 0.5。「白紙に還す」でこちらの強化を消す（3手ごと）。名を消す（単体の沈黙60%＋攻撃力−1）。 |
| `tr_b_nemrea2` ネムレア | 3回行動。「八つの伝承」は6属性のうち**こちらに一番効く属性**で8回撃つ（属性の守りを固めた装備が効く）。HP 半分で名が体に刻まれ、**全属性 1.25**。HP 30% で1回だけ 8% 回復。 |
| `tr_b_valzard_echo` 魔王の残影 | 魔族・闇の親和: **光 1.5**。2回行動 → HP 半分で3回。恐れのまなざし（全体の気絶20%）。**再戦できる**（ワールド章 §12）。レア・超レア枠あり。 |
| `tr_b_ouroboros` 円環竜オウロボラ | 竜: **全属性 0.75、弱点なし**、斬 0.75。3回行動。5手ごとに「巻き戻し」（こちらの強化を消し、自分を 10% 回復）。**HP 25% で円環がほどけ**、巻き戻しをやめ、守備力・術防−1。再戦できる。 |
- 全ボス共通: 即死は効かない。状態の耐性はボスの既定（成長章 §8.3）とデータの大きい方。逃げられない（`noEscape`）。
- 強化の行動をもつボス（強化を消す技・術の出番。術章 §8.2）: 氷壁の巨人・岩食らい・鉄の番人・星食らい・天球の番人・ラザロ・楽団・円環竜。

### 11.4 一覧と編成
| id | 名前 | 種類 | 編成 | 絵 | 種族 | 属性の倍率 | 打撃 / 耐性の追加 | 行動 | 段階の変化 | 落とす物 |
|---|---|---|---|---|---|---|---|---|---|---|
| `b_pageeater` | ページ食らい | 序章 | `tr_b_pageeater` | `boss_pageeater` | 霊体 | 火1.5 光.5 闇1.5 | 斬1.25 打.75 / 毒1 死1 気1 眠.5 混.5 | 攻撃4 · eb_page_storm2 · eb_eat_words1[3手ごと@2] · eb_ink_spit1[4手ごと@1] · eb_devour1 | HP<50%:「ページ食らいの体がめくれあがった！」→ {actsPerTurn:2} | i_fruit_wp 1/1 |
| `b_moth` | ダストウィング | 中ボス | `tr_b_moth` | `boss_moth` | 虫・飛 | 火1.5 風1.5 土.5 | — / 毒.5 | 攻撃3 · eb_scale_sleep2[3手ごと@0] · eb_scale_poison2 · eb_wing_gale2 · eb_eye_spots1[4手ごと@2] · eb_moth_dive2 | HP<50%:「ダストウィングの羽から、りん粉が噴き出した！」→ {actsPerTurn:2} | i_fruit_wp 1/1 |
| `b_rooteater` | 根食らい | 地方ボス（HP の取り分 15） | `tr_b_rooteater` | `boss_rooteater` | 虫 | 火1.5 風1.5 土.25 | — / 毒.5 | 攻撃3 · eb_root_drain2 · eb_rot_breath2[3手ごと@1] · eb_call_roots1[4手ごと@3,数<3] · eb_body_slam2 | HP<50%:「根食らいの白い体が、ぬらりと光った！」→ {buffs:{atk:1}} | i_fruit_hp 1/1 |
| `b_root` | 根の触手 | お供（HP の取り分 1.5） | `tr_b_rooteater` | `boss_root` | 植物 | 火1.5 水.5 風1.5 土.25 | 斬1.25 / 眠.5 毒.5 | 攻撃2 · eb_root_whip3 · eb_feed2[2手ごと@1] | — | — |
| `b_sandworm` | 砂もぐり | 中ボス | `tr_b_sandworm` | `b_sandworm` | 獣 | 火1.25 風1.5 土.25 | — / — | 攻撃2 · eb_sink2[3手ごと@0] · eb_sand_strike3[3手ごと@1] · eb_quicksand2 · eb_swallow_whole1 | — | i_fruit_mp 1/1 |
| `b_sandking` | 名なき砂の王 | 地方ボス（HP の取り分 16） | `tr_b_sandking` | `b_sandking` | 不死 | 火1.5 光2 闇吸収 | 打1.25 / 毒1 死1 眠1 混.5 | 攻撃2 · eb_steal_name2 · eb_king_sand2 · eb_raise_guard1[4手ごと@2,数<3] · eb_withering2 | HP<40%:「王の顔の包帯がほどけ、うつろな目がのぞいた……」→ {buffs:{atk:1,mag:1}} | i_fruit_hp 1/1 |
| `b_icegiant` | 氷壁の巨人 | 中ボス | `tr_b_icegiant` | `boss_frost_giant` | 人型 | 火1.25 水.25 土1.5 | — / — | 攻撃3 · eb_ice_hammer2 · eb_avalanche_drop2 · eb_frost_exhale1 · eb_ice_wall1[HP<60%,1回] | — | i_fruit_wp 1/1 |
| `b_whitedragon` | 白竜ネーヴェ | 地方ボス | `tr_b_whitedragon` | `boss_whitedragon` | 竜・飛 | 火1.25 水吸収 風1.5 土1.5 光.75 闇.75 | 斬.75 突1.25 / 死1 眠.5 混.5 | 攻撃2 · eb_white_blizzard2 · eb_ice_claw2 · eb_dragon_tail2 · eb_frozen_roar1[4手ごと@1] · eb_glacier_fall2[HP<50%] | HP<50%:「白竜の胸の氷に、ひびが入った！」→ {elem:{fire:1.5}} | i_fruit_hp 1/1 |
| `b_doll_conductor` | 指揮者人形 | 中ボス（HP の取り分 4） | `tr_b_dolls` | `b_doll_conductor` | 魔造 | 水1.25 風.75 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | 攻撃2 · eb_baton2 · eb_encore3[3手ごと@2,倒れた仲間あり] · eb_crescendo1[4手ごと@0] | — | i_fruit_mp 1/1 |
| `b_doll_violin` | 弦ひき人形 | お供（HP の取り分 2） | `tr_b_dolls` | `b_doll_violin` | 魔造 | 水1.25 風.75 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | 攻撃2 · eb_sad_tune2 · eb_bow_slash2 | — | — |
| `b_doll_drum` | 太鼓人形 | お供（HP の取り分 2） | `tr_b_dolls` | `b_doll_drum` | 魔造 | 水1.25 風.75 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | 攻撃2 · eb_drum_roll3 | — | — |
| `b_doll_flute` | 笛人形 | お供（HP の取り分 2） | `tr_b_dolls` | `b_doll_flute` | 魔造 | 水1.25 風.75 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | 攻撃1 · eb_flute_lullaby2 · eb_shrill2 | — | — |
| `b_mistbeast` | 霧食らい | 地方ボス（HP の取り分 18） | `tr_b_mistbeast` | `boss_mistbeast` | 霊体 | 風1.5 光1.5 | 斬.75 打.75 突.75 / 毒1 死1 気1 | 攻撃2 · eb_mist_hand2 · eb_mist_breath2 · eb_call_double1[4手ごと@1,数<3] · eb_witch_mimic2 · eb_inhale_mist1[4手ごと@3] | HP<50%:「霧が薄れて、霧食らいの本当の口がのぞいた！」→ {phys:{slash:1,blunt:1,pierce:1}} | i_fruit_hp 1/1 |
| `b_mist_double` | 霧の分身 | お供（HP の取り分 1） | `tr_b_mistbeast` | `b_mist_double` | 霊体 | 風1.5 光1.5 | 斬.75 打.75 突.75 / 毒1 死1 気1 | 攻撃2 · eb_cold_touch2 | — | — |
| `b_octopus` | 深みの大ダコ | 中ボス（HP の取り分 7） | `tr_b_octopus` | `b_octopus` | 水棲 | 火.75 水.25 土1.5 | — / — | 攻撃2 · eb_ink_cloud1[3手ごと@0] · eb_crush_hug2 · eb_regrow2[4手ごと@3,数<3] · eb_whirl2 | — | i_fruit_wp 1/1 |
| `b_tentacle` | 大ダコの足 | お供（HP の取り分 1.5） | `tr_b_octopus` | `boss_tentacle` | 水棲 | 火.75 水.25 土1.5 | — / — | 攻撃2 · eb_tentacle_bind3 | — | — |
| `b_captain` | 亡霊船長グレン | 地方ボス（HP の取り分 16） | `tr_b_captain` | `b_captain` | 不死 | 火1.5 光2 闇吸収 | 打1.25 / 毒1 死1 眠1 混.5 | 攻撃2 · eb_cutlass2 · eb_fire_volley2 · eb_ghost_shanty1[4手ごと@2] · eb_call_crew1[4手ごと@0,数<3] · eb_anchor_throw1 | HP<50%:「船長の目に、かすかな光が戻った……」→ {buffs:{atk:1}} | i_fruit_hp 1/1 |
| `b_rockeater` | 岩食らい | 中ボス | `tr_b_rockeater` | `b_rockeater` | 虫 | 風1.5 土.25 | — / 毒.5 | 攻撃2 · eb_rock_crunch2[3手ごと@2] · eb_gravel_spit2 · eb_cave_in2 · eb_grind2 | — | i_fruit_mp 1/1 |
| `b_ironwarden` | 鉄の番人 | 地方ボス・行動1回 | `tr_b_ironwarden` | `b_ironwarden` | 魔造 | 水1.5 風.75 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | 攻撃2 · eb_iron_fist2 · eb_anvil_drop2 · eb_forge_breath2 · eb_iron_wall1[HP<70%,1回] | HP<75%:「鉄の番人が、完全に目を覚ました！」→ {actsPerTurn:2}<br>HP<30%:「炉心が赤く燃え上がった！　鎧のすき間から湯気が噴く！」→ {elem:{water:2},buffs:{atk:1}} | i_fruit_hp 1/1 |
| `b_hellhound` | 炎の番犬 | 中ボス・行動2回 | `tr_b_hellhound` | `boss_hellhound` | 獣 | 火.25 水1.5 | — / — | 攻撃2 · eb_twin_fang2 · eb_flame_howl1[3手ごと@1] · eb_lava_breath2 · eb_hound_fury1[HP<50%,1回] | — | i_fruit_wp 1/1 |
| `b_lavabeast` | 溶岩の巨獣 | 地方ボス | `tr_b_lavabeast` | `boss_flame_lord` | 魔族 | 火吸収 水1.5 光1.5 闇.5 | — / 死.8 | 攻撃2 · eb_lava_wave2[HP>50%] · eb_eruption2[HP>50%] · eb_magma_fist2[HP>50%] · eb_obsidian_crush3[HP<50%] · eb_ash_storm2[HP<50%] | HP<50%:「溶岩が冷えて、黒い岩に固まった！」→ {elem:{fire:0.5,water:1,wind:1.5,earth:0.25},buffs:{def:2,agi:-1},sprite:b_lavabeast_cold} | i_fruit_hp 1/1 |
| `b_orrery` | 天球の番人 | 中ボス | `tr_b_orrery` | `boss_star_guardian` | 魔造 | 水1.25 風.75 光.25 闇1.5 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | 攻撃1 · eb_sun_orb3[3手ごと@0] · eb_moon_orb3[3手ごと@1] · eb_star_orb3[3手ごと@2] · eb_orbit_shield1[HP<60%,1回] | — | i_fruit_mp 1/1 |
| `b_stareater` | 星食らい | 地方ボス | `tr_b_stareater` | `boss_stareater` | 魔族 | 光1.5 闇.25 | — / 死.8 | 攻撃2 · eb_swallow_star2[3手ごと@2] · eb_star_spit2 · eb_void_fang2 · eb_dark_nova2 | HP<50%:「飲みこんだ星が、腹の中で光っている……！」→ {elem:{light:2}} | i_fruit_hp 1/1 |
| `b_rowell1` | ロウェル | ライバル | `tr_b_rowell1` | `boss_rowell` | 人型 | 光.25 闇1.5 | — / — | 攻撃3 · eb_silver_thrust2 · eb_copy_power2 · eb_ink_guard1[1回] · eb_record_light2 | — | — |
| `b_rowell2` | ロウェル | ライバル・行動2回 | `tr_b_rowell2` | `b_rowell2` | 人型 | 光.25 闇1.5 | — / — | 攻撃2 · eb_silver_thrust2 · eb_pen_flurry2 · eb_copy_power1 · eb_white_page1[3手ごと@1] · eb_record_light1 | — | — |
| `b_bookgolem` | 本の巨人 | 終盤の中ボス | `tr_b_bookgolem` | `boss_bookgolem` | 魔造 | 火1.5 水1.25 風.75 | 斬.75 打1.5 突.75 / 毒1 眠1 混1 死1 | 攻撃2 · eb_page_blizzard2 · eb_tome_slam2 · eb_rebind1[4手ごと@3] · eb_call_books1[4手ごと@1,数<3] · eb_dust_of_ages1 | — | i_fruit_mp 1/1 |
| `b_shade_sword` | 剣の勇者の影 | 終盤の中ボス（HP の取り分 8） | `tr_b_heroshades` | `boss_shade_sword` | 霊体 | 光.25 闇1.5 | — / 毒1 死1 気1 | 攻撃2 · eb_shade_blade2 · eb_shade_crest2 · eb_shade_sweep1 | — | — |
| `b_shade_prayer` | 祈りの勇者の影 | 終盤の中ボス（HP の取り分 6） | `tr_b_heroshades` | `boss_shade_prayer` | 霊体 | 光.25 闇1.5 | — / 毒1 死1 気1 | 攻撃1 · eb_shade_heal2[HP<80%] · eb_shade_raise3[1回,倒れた仲間あり] · eb_shade_holy2 | — | i_fruit_mp 1/1 |
| `b_shade_star` | 星の勇者の影 | 終盤の中ボス（HP の取り分 6） | `tr_b_heroshades` | `boss_shade_star` | 霊体 | 光.25 闇1.5 | — / 毒1 死1 気1 | 攻撃1 · eb_shade_meteor2 · eb_shade_frost2 · eb_shade_fire2 | — | — |
| `b_lazaro` | 大書記ラザロ | 終盤の中ボス・行動1回 | `tr_b_lazaro` | `boss_lazaro` | 人型 | 光.25 闇1.5 | — / — | 攻撃1 · eb_white_book2 · eb_erase_memory2 · eb_silver_quill3 · eb_page_shield1[HP<70%,1回] · eb_call_scribes1[4手ごと@2,数<3] | HP<50%:「ラザロの手が、かすかに震えている……」→ {actsPerTurn:2} | i_fruit_hp 1/1 |
| `b_nemrea1` | 虚ろの王 | ラスボス1 | `tr_b_nemrea1` | `boss_nemrea1` | 霊体 | 火1.25 光.5 闇1.25 | — / 毒1 死1 気1 | 攻撃1 · eb_whiteout2[3手ごと@0] · eb_oblivion_wave2 · eb_paper_hand3 · eb_erase_name1[4手ごと@2] · eb_blank_storm2 | — | — |
| `b_nemrea2` | ネムレア | ラスボス2 | `tr_b_nemrea2` | `boss_nemrea2` | 霊体 | 光1.5 | — / 毒1 死1 気1 | 攻撃1 · eb_eight_legends2[3手ごと@1] · eb_oblivion_breath2 · eb_unwrite3 · eb_dream_sleep1[4手ごと@3] · eb_nemrea_rewrite1[HP<30%,1回] | HP<50%:「その名が、体に刻まれていく……！」→ {elem:{fire:1.25,water:1.25,wind:1.25,earth:1.25,light:1.25,dark:1.25}} | — |
| `b_valzard_echo` | 魔王の残影 | 裏の中ボス・行動2回 | `tr_b_valzard_echo` | `b_valzard_echo` | 魔族 | 光1.5 闇.25 | — / 死.8 | 攻撃1 · eb_echo_despair2 · eb_echo_claw2 · eb_echo_flame2 · eb_echo_gaze1[4手ごと@2] · eb_echo_gather1[4手ごと@3] | HP<50%:「……光の……紋章……。残影が大きく揺らいだ！」→ {actsPerTurn:3} | i_revive2 1/1<br>ac_crest_fragment 1/4<br>w_sword_echo 1/16 |
| `b_ouroboros` | 円環竜オウロボラ | 裏ボス・行動3回 | `tr_b_ouroboros` | `boss_ouroboros` | 竜 | 火.75 水.75 風.75 土.75 光.75 闇.75 | 斬.75 / 死1 眠.5 混.5 | 攻撃1 · eb_rewind2[HP>25%,5手ごと@4] · eb_eternal_breath2 · eb_ring_crush2 · eb_time_loop1[4手ごと@1] · eb_scale_storm2 · eb_tail_devour1[HP<50%,1回] | HP<25%:「円環が、ほどけかけている！」→ {buffs:{def:-1,mdef:-1}} | i_elixir 1/1<br>ac_ouroboros_ring 1/4<br>w_greatsword_ouroboros 1/16 |

| 編成 id | 並び（左→右） | ティア | lv / lvOff | 背景 | BGM |
|---|---|---|---|---|---|
| `tr_b_pageeater` | `b_pageeater` | 0 固定 | lv 8 | `tower` | `boss` |
| `tr_b_moth` | `b_moth` | `scale:'tier'`（0〜7） | +2 | `forest` | `boss` |
| `tr_b_rooteater` | `b_root` `b_rooteater` `b_root` | `scale:'tier'`（0〜7） | +3 | `tree` | `boss2` |
| `tr_b_sandworm` | `b_sandworm` | `scale:'tier'`（0〜7） | +2 | `pyramid` | `boss` |
| `tr_b_sandking` | `@mummy` `b_sandking` `@mummy` | `scale:'tier'`（0〜7） | +3 | `pyramid` | `boss2` |
| `tr_b_icegiant` | `b_icegiant` | `scale:'tier'`（0〜7） | +2 | `ice` | `boss` |
| `tr_b_whitedragon` | `b_whitedragon` | `scale:'tier'`（0〜7） | +3 | `snow` | `boss2` |
| `tr_b_dolls` | `b_doll_violin` `b_doll_conductor` `b_doll_drum` `b_doll_flute` | `scale:'tier'`（0〜7） | +2 | `manor` | `boss` |
| `tr_b_mistbeast` | `b_mistbeast` | `scale:'tier'`（0〜7） | +3 | `swamp` | `boss2` |
| `tr_b_octopus` | `b_tentacle` `b_octopus` `b_tentacle` | `scale:'tier'`（0〜7） | +2 | `watercave` | `boss` |
| `tr_b_captain` | `@skeleton` `b_captain` `@skeleton` | `scale:'tier'`（0〜7） | +3 | `ship` | `boss2` |
| `tr_b_rockeater` | `b_rockeater` | `scale:'tier'`（0〜7） | +2 | `mine` | `boss` |
| `tr_b_ironwarden` | `b_ironwarden` | `scale:'tier'`（0〜7） | +3 | `mine` | `boss2` |
| `tr_b_hellhound` | `b_hellhound` | `scale:'tier'`（0〜7） | +2 | `volcano` | `boss` |
| `tr_b_lavabeast` | `b_lavabeast` | `scale:'tier'`（0〜7） | +3 | `volcano` | `boss2` |
| `tr_b_orrery` | `b_orrery` | `scale:'tier'`（0〜7） | +2 | `tower` | `boss` |
| `tr_b_stareater` | `b_stareater` | `scale:'tier'`（0〜7） | +3 | `tower` | `boss2` |
| `tr_b_rowell1` | `b_rowell1` | 2 固定 | +2 | （その場） | `rival` |
| `tr_b_rowell2` | `b_rowell2` | 5 固定 | +2 | （その場） | `rival` |
| `tr_b_bookgolem` | `b_bookgolem` | 8 固定 | +2 | `library` | `boss2` |
| `tr_b_heroshades` | `b_shade_sword` `b_shade_prayer` `b_shade_star` | 8 固定 | +2 | `library` | `boss2` |
| `tr_b_lazaro` | `b_lazaro` | 8 固定 | +2 | `library` | `tension` |
| `tr_b_nemrea1` | `b_nemrea1` | 8 固定 | +4 | `library` | `boss2` |
| `tr_b_nemrea2` | `b_nemrea2` | 8 固定 | +4 | `library` | `lastboss` |
| `tr_b_valzard_echo` | `b_valzard_echo` | 9 固定 | +4 | `oblivion` | `boss2` |
| `tr_b_ouroboros` | `b_ouroboros` | 9 固定 | +8 | `oblivion` | `superboss` |
- 編成の `bg` は戦闘背景（ワールド章 §6.2 の新しい背景を含む。無いときの代わりはワールド章 §15）。ライバル戦は町で戦うので `bg` を書かない（その場の背景）。

### 11.5 ボス・レア魔物の行動（`eb_` 191。担当 A12 `bosses_actions.js`。normative）
並び: レア魔物の行動 64 → ボスの行動 127（編成の順）。読み方は §1.6。
```js
Object.assign(R.DB.actions, {
  eb_hare_kick: {name: 'ウサギ蹴り', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}], fx: 'strike', msg: '{user}は後ろ足で蹴り飛ばした！'},
  eb_jewel_shine: {name: '宝石のきらめき', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'holy', msg: '{user}の宝石がきらりと光った！'},
  eb_hop_rest: {name: 'ひと休み', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.2}], fx: 'heal', msg: '{user}は耳をたたんでひと休みした。'},
  eb_petal_storm: {name: '花吹雪', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'wind', msg: '{user}のまわりに花びらが舞った！'},
  eb_antler_thrust: {name: '花角突き', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4, kind: 'pierce'}], fx: 'pierce', msg: '{user}は花の咲いた角で突いた！'},
  eb_fawn_bloom: {name: '花の香り', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}, {type: 'status', status: 'regen'}], fx: 'regen', msg: '{user}から甘い花の香りが広がった。'},
  eb_glass_scale: {name: 'ガラスのりん粉', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'confuse', chance: 0.2}, {type: 'status', status: 'blind', chance: 0.2}], fx: 'confuse', msg: '{user}はきらめくりん粉をまいた！'},
  eb_prism_wing: {name: '虹の羽ばたき', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2}], fx: 'magic2', msg: '{user}の羽が七色に光った！', elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
  eb_flutter: {name: 'ひらり舞い', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'agi', stages: 2}], fx: 'buff', msg: '{user}はひらりと宙に舞った！'},
  eb_acorn_barrage: {name: 'どんぐりの雨', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 4}], fx: 'strike', msg: '{user}はどんぐりを次々に投げた！'},
  eb_shell_guard: {name: '殻にこもる', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: '{user}は固い殻にこもった！'},
  eb_diamond_scales: {name: '金剛のうろこ', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: '{user}のうろこが金剛石のように光った！'},
  eb_tail_whip: {name: 'しっぽの一撃', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4}], fx: 'strike', msg: '{user}はしっぽを打ちつけた！'},
  eb_idol_ray: {name: '黄金の光線', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.4, element: 'light'}], fx: 'holy2', msg: '{user}の目から黄金の光線が走った！'},
  eb_idol_ward: {name: '守護の結界', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 1}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: '{user}のまわりに結界が張られた！'},
  eb_idol_curse: {name: '黄金の呪い', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'atk', stages: -1, chance: 0.5}, {type: 'buff', stat: 'agi', stages: -1, chance: 0.5}], fx: 'debuff', msg: '{user}は黄金の呪いをかけた！'},
  eb_aurora_veil: {name: 'オーロラの帳', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}, {type: 'status', status: 'veil'}], fx: 'buff', msg: '{user}はオーロラの帳をまとった！'},
  eb_aurora_ray: {name: '極光', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8}], fx: 'holy2', msg: '{user}は極光を放った！', elements: ['water', 'light']},
  eb_ice_foxfire: {name: '氷のきつね火', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.15}], fx: 'ice2', msg: '{user}は青いきつね火を飛ばした！'},
  eb_nine_tails: {name: '尾の乱舞', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 4}], fx: 'strike', msg: '{user}の氷の尾が次々に打ちつけた！'},
  eb_fox_trick: {name: '化かし', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'confuse', chance: 0.4}], fx: 'confuse', msg: '{user}はこん、と鳴いて化かした！'},
  eb_lotus_dew: {name: 'はすの露', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.3}], fx: 'heal', msg: '{user}ははすの露を浴びた。'},
  eb_lotus_bubble: {name: '泡の舞', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'water', msg: '{user}のまわりに泡が舞った！'},
  eb_hot_tea: {name: '熱いお茶', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.3}], fx: 'fire', msg: '{user}は煮えたったお茶を浴びせた！'},
  eb_tea_party: {name: 'お茶会', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}, {type: 'buff', stat: 'agi', stages: 1}], fx: 'heal', msg: '{user}はひとりでお茶会を始めた。'},
  eb_steam_puff: {name: '湯気', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.25}], fx: 'smoke', msg: '{user}はもくもくと湯気を吹いた！'},
  eb_bell_toll: {name: '鐘の音', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'stun', chance: 0.2}], fx: 'song', msg: '{user}の殻の鐘が、ゴーンと鳴った！'},
  eb_shell_retreat: {name: '殻の守り', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}, {type: 'buff', stat: 'mdef', stages: 2}], fx: 'buff', msg: '{user}は殻の中に引っこんだ！'},
  eb_slime_trail: {name: 'ねばる跡', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.6}], fx: 'debuff', msg: '{user}はねばねばした跡を残した！'},
  eb_stardust_spout: {name: '星くずの潮吹き', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'light', hits: 4}], fx: 'magic2', msg: '{user}は星くずを高く吹き上げた！'},
  eb_whale_song: {name: 'くじらの歌', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'song', msg: '{user}は遠くまで響く歌を歌った！'},
  eb_star_tide: {name: '星の潮', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.2}], fx: 'heal', msg: '{user}は星の光を浴びた。'},
  eb_coin_toss: {name: '金貨投げ', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 3}], fx: 'strike', msg: '{user}は金貨を投げつけた！'},
  eb_goblet_guard: {name: '杯にこもる', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: '{user}は黄金の杯に身をひそめた！'},
  eb_greed_claw: {name: '欲ばりのはさみ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4}, {type: 'buff', stat: 'agi', stages: -1, chance: 0.5}], fx: 'claw', msg: '{user}は欲ばりのはさみではさんだ！'},
  eb_gem_quills: {name: '宝石の針', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 4, kind: 'pierce'}], fx: 'pierce', msg: '{user}は宝石の針を飛ばした！'},
  eb_curl_up: {name: '丸まる', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: '{user}はくるりと丸まった！'},
  eb_sparkle: {name: 'きらめき', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'holy', msg: '{user}の針がまぶしくきらめいた！'},
  eb_prism_beam: {name: '七色の光線', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.5}], fx: 'magic3', msg: '{user}は七色の光線を放った！', elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
  eb_refract: {name: '屈折', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}], fx: 'buff', msg: '{user}の体が光を曲げた！'},
  eb_hot_splash: {name: '湯かけ', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}, {type: 'status', status: 'burn', chance: 0.2}], fx: 'water2', msg: '{user}は熱い湯をばしゃりとかけた！'},
  eb_bath_heal: {name: 'ひと風呂', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.3}, {type: 'status', status: 'regen'}], fx: 'regen', msg: '{user}はのんびり湯につかった。'},
  eb_towel_snap: {name: '手ぬぐい打ち', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}], fx: 'strike', msg: '{user}は手ぬぐいをぴしゃりと打った！'},
  eb_shell_eruption: {name: '甲羅の噴火', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.55, element: 'fire', hits: 3}], fx: 'fire2', msg: '{user}の甲羅が噴火した！'},
  eb_lava_bite: {name: '溶岩の噛みつき', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, element: 'fire'}], fx: 'fire', msg: '{user}は熱い口で噛みついた！'},
  eb_moon_lullaby: {name: '月の子守歌', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.3}], fx: 'song', msg: '{user}は月の子守歌を歌った！'},
  eb_wool_puff: {name: 'ふわもこ', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 1}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: '{user}の毛がふくらんだ！'},
  eb_moonbeam: {name: '月光', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'light'}], fx: 'holy', msg: '{user}は月の光を集めて放った！'},
  eb_tick_tock: {name: '時のさえずり', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'agi', stages: 2}], fx: 'buff', msg: '{user}はチクタクとさえずった！'},
  eb_gear_peck: {name: '歯車つつき', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 3}], fx: 'pierce', msg: '{user}は歯車のくちばしでつついた！'},
  eb_alarm: {name: '目覚まし', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'stun', chance: 0.2}], fx: 'song', msg: '{user}はけたたましく鳴いた！'},
  eb_nibble_page: {name: '頁かじり', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.8, mp: true}], fx: 'mp', msg: '{user}は記憶の頁をかじった！'},
  eb_spectacle_glare: {name: 'めがね光線', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'holy', msg: '{user}のめがねがぎらりと光った！'},
  eb_study: {name: '読書', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mag', stages: 2}], fx: 'buff', msg: '{user}は本を読みふけった。'},
  eb_golden_script: {name: '黄金の筆跡', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'light'}], fx: 'holy2', msg: '{user}は空中に黄金の文字を書いた！'},
  eb_rewrite_self: {name: '書き直し', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}], fx: 'heal', msg: '{user}は自分の傷を書き直した！'},
  eb_ink_blot: {name: 'インクのしみ', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'smoke', msg: '{user}はインクをまき散らした！'},
  eb_memory_bubble: {name: '思い出の泡', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.3}], fx: 'water', msg: '{user}は思い出の泡を吐いた！'},
  eb_forget_splash: {name: '忘れ水', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.9, mp: true}], fx: 'mp', msg: '{user}は忘れ水をはねかけた！'},
  eb_fin_heal: {name: 'ひれの舞', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}], fx: 'heal', msg: '{user}はひれをゆらして傷を癒やした。'},
  eb_dream_eat: {name: '夢を食べる', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1, mp: true, drain: 1}, {type: 'damage', formula: 'phys', power: 1.2, vs: {sleep: 2}}], fx: 'drain', msg: '{user}は夢を食べようとした！'},
  eb_sleep_mist: {name: '眠りの霧', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.3}], fx: 'sleep', msg: '{user}は眠りの霧を吐いた！'},
  eb_nightmare: {name: '悪夢', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'dark'}], fx: 'dark2', msg: '{user}は悪夢を見せた！'},
  eb_tapir_nap: {name: '昼寝', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}], fx: 'heal', msg: '{user}はうとうと昼寝した。'},
  eb_page_storm: {name: '紙吹雪', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 3, kind: 'slash'}], fx: 'slash', msg: '{user}の体から紙片が舞い散った！'},
  eb_eat_words: {name: '言葉を食べる', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.8, mp: true}, {type: 'status', status: 'silence', chance: 0.4}], fx: 'mp', msg: '{user}は言葉を食べてしまった！', aim: 'middle'},
  eb_ink_spit: {name: '墨吐き', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.25}], fx: 'smoke', msg: '{user}は黒い墨を吐いた！'},
  eb_devour: {name: '丸かじり', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'bite2', msg: '{user}は大きな口でかじりついた！'},
  eb_scale_sleep: {name: '眠りのりん粉', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'sleep', msg: '{user}は眠りのりん粉を振りまいた！'},
  eb_scale_poison: {name: '毒のりん粉', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'poison', chance: 0.3}], fx: 'poison', msg: '{user}は毒のりん粉を振りまいた！'},
  eb_wing_gale: {name: '羽ばたき', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'wind'}], fx: 'wind2', msg: '{user}は大きく羽ばたいた！'},
  eb_eye_spots: {name: '目玉模様', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'confuse', chance: 0.2}], fx: 'confuse', msg: '{user}の羽の目玉模様がぎょろりと動いた！'},
  eb_moth_dive: {name: '体ごと突進', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5}], fx: 'strike2', msg: '{user}は体ごとぶつかってきた！'},
  eb_root_drain: {name: '根で吸う', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2, element: 'earth', drain: 0.5}], fx: 'drain', msg: '{user}の根が命を吸い上げた！'},
  eb_rot_breath: {name: '腐れの息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.5}, {type: 'status', status: 'poison', chance: 0.3}], fx: 'breath_poison', msg: '{user}は腐った息を吐いた！'},
  eb_call_roots: {name: '根を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'b_root', n: 1, max: 3}], fx: 'earth', msg: '地面から新しい根がのびてきた！'},
  eb_body_slam: {name: 'のしかかり', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5}], fx: 'strike2', msg: '{user}は体を持ち上げて、のしかかった！'},
  eb_root_whip: {name: '根のむち', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2}, {type: 'status', status: 'paralyze', chance: 0.15}], fx: 'strike', msg: '{user}は根をむちのように振るった！'},
  eb_feed: {name: '養分を送る', kind: 'enemy', target: 'ally', effects: [{type: 'heal', pct: 0.05}], fx: 'regen', msg: '{user}は根食らいに養分を送った！'},
  eb_sink: {name: '砂にもぐる', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: '{user}は砂の中にもぐった！'},
  eb_sand_strike: {name: '砂中の一撃', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.9}], fx: 'strike3', msg: '{user}が足もとの砂から飛び出した！'},
  eb_quicksand: {name: '流砂', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.6, element: 'earth'}, {type: 'buff', stat: 'agi', stages: -1, chance: 0.4}], fx: 'earth2', msg: '{user}は流砂を起こした！'},
  eb_swallow_whole: {name: 'ひとのみ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.9, acc: 0.75}], fx: 'bite2', msg: '{user}は大きな口でのみこもうとした！'},
  eb_steal_name: {name: '名を奪う呪い', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'silence', chance: 0.5}, {type: 'damage', formula: 'magic', power: 0.6, mp: true}], fx: 'silence', msg: '{user}は名を奪う呪いをかけた！', aim: 'middle'},
  eb_king_sand: {name: '王の砂塵', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'earth'}, {type: 'status', status: 'blind', chance: 0.25}], fx: 'earth2', msg: '{user}は砂塵を巻き起こした！'},
  eb_raise_guard: {name: '墓の兵を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: '@mummy', n: 1, max: 3}], fx: 'dark', msg: '{user}の呼び声で、墓の兵が起き上がった！'},
  eb_withering: {name: '命を枯らす', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'dark', drain: 0.5}], fx: 'drain', msg: '{user}は命を枯らす手をのばした！'},
  eb_ice_wall: {name: '氷の壁', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: '{user}の前に分厚い氷の壁ができた！'},
  eb_ice_hammer: {name: '氷の大槌', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.7, element: 'water'}], fx: 'ice3', msg: '{user}は氷の大槌を振り下ろした！'},
  eb_avalanche_drop: {name: '雪崩落とし', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.7, element: 'water'}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'ice2', msg: '{user}は峰の雪を崩した！'},
  eb_frost_exhale: {name: '凍える吐息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.5, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.12}], fx: 'breath_ice', msg: '{user}は凍える吐息を吐いた！'},
  eb_white_blizzard: {name: '白い吹雪', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.7, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.15}], fx: 'breath_ice', msg: '{user}は白い吹雪を吐いた！'},
  eb_ice_claw: {name: '氷の爪', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, element: 'water'}], fx: 'claw', msg: '{user}は氷の爪で引き裂いた！'},
  eb_dragon_tail: {name: '竜の尾', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.65}], fx: 'strike2', msg: '{user}は長い尾でなぎ払った！'},
  eb_frozen_roar: {name: '凍てつく咆哮', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.5}], fx: 'debuff', msg: '{user}の咆哮が空気を凍らせた！'},
  eb_glacier_fall: {name: '氷河落とし', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.6, element: 'water'}], fx: 'ice3', msg: '{user}は空から氷河を落とした！'},
  eb_encore: {name: 'アンコール', kind: 'enemy', target: 'ally_dead', effects: [{type: 'revive', pct: 0.5}], fx: 'revive', msg: '{user}の指揮棒で、倒れた楽士が立ち上がった！'},
  eb_baton: {name: '指揮棒', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2}], fx: 'strike', msg: '{user}は指揮棒で打った！'},
  eb_crescendo: {name: 'クレッシェンド', kind: 'enemy', target: 'allies', effects: [{type: 'buff', stat: 'atk', stages: 1}, {type: 'buff', stat: 'mag', stages: 1}], fx: 'buff', msg: '{user}は演奏をどんどん大きくさせた！'},
  eb_sad_tune: {name: '悲しい調べ', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'atk', stages: -1, chance: 0.5}], fx: 'song', msg: '{user}は悲しい調べをかなでた！'},
  eb_bow_slash: {name: '弓で斬る', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2, kind: 'slash'}], fx: 'slash', msg: '{user}はバイオリンの弓で斬りつけた！'},
  eb_drum_roll: {name: '太鼓の連打', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.45}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'strike', msg: '{user}は太鼓を打ち鳴らした！'},
  eb_flute_lullaby: {name: '眠りの笛', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'song', msg: '{user}は眠りを誘う笛を吹いた！'},
  eb_shrill: {name: '甲高い音', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2, element: 'wind'}], fx: 'wind', msg: '{user}の笛が甲高く鳴った！'},
  eb_mist_hand: {name: '霧の手', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}, {type: 'status', status: 'sleep', chance: 0.15}], fx: 'strike', msg: '{user}の霧の手がのびてきた！'},
  eb_mist_breath: {name: '白い霧の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.55}, {type: 'status', status: 'blind', chance: 0.25}], fx: 'breath', msg: '{user}は白い霧を吐いた！'},
  eb_call_double: {name: '分身を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'b_mist_double', n: 1, max: 3}], fx: 'smoke', msg: '霧の中から、魔女の姿がもう一つ現れた！'},
  eb_inhale_mist: {name: '霧を吸う', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.08}], fx: 'regen', msg: '{user}はあたりの霧を吸いこんだ！'},
  eb_witch_mimic: {name: '魔女のまね', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'dark'}], fx: 'dark2', msg: '{user}は魔女のまねをして、偽りの呪いを放った！'},
  eb_cold_touch: {name: '冷たい手', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.1, element: 'water'}], fx: 'ice', msg: '{user}の冷たい手がふれた！'},
  eb_ink_cloud: {name: '墨の雲', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'smoke', msg: '{user}は墨の雲を吐いた！'},
  eb_crush_hug: {name: '抱きしめる', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'strike2', msg: '{user}は太い腕で抱きしめた！'},
  eb_regrow: {name: '足が生える', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'b_tentacle', n: 1, max: 3}], fx: 'regen', msg: '{user}の足がまた生えてきた！'},
  eb_whirl: {name: '渦', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}], fx: 'water2', msg: '{user}は渦を巻き起こした！'},
  eb_tentacle_bind: {name: '巻きつき', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9}, {type: 'status', status: 'paralyze', chance: 0.25}], fx: 'strike', msg: '{user}が巻きついてきた！'},
  eb_cutlass: {name: '亡霊のカトラス', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, kind: 'slash'}], fx: 'slash2', msg: '{user}は青白いカトラスで斬りつけた！'},
  eb_fire_volley: {name: '一斉砲撃', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.75, element: 'fire'}], fx: 'explosion', msg: '{user}の号令で、大砲が一斉に火を噴いた！'},
  eb_ghost_shanty: {name: '亡霊の舟歌', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'song', msg: '{user}は古い舟歌を歌いだした……。'},
  eb_call_crew: {name: '船員を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: '@skeleton', n: 1, max: 3}], fx: 'dark', msg: '{user}の呼び声に、骸骨の船員が集まってきた！'},
  eb_anchor_throw: {name: 'いかり投げ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8, acc: 0.85}], fx: 'strike3', msg: '{user}はいかりを投げつけた！'},
  eb_rock_crunch: {name: '岩をかみ砕く', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.1}, {type: 'buff', stat: 'def', stages: 1}], fx: 'earth', msg: '{user}は壁の岩をかみ砕いて食べた！'},
  eb_gravel_spit: {name: '石つぶて吐き', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 3, element: 'earth'}], fx: 'earth', msg: '{user}は石つぶてを吐き出した！'},
  eb_cave_in: {name: '落盤', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.7, element: 'earth'}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'earth2', msg: '{user}が暴れて、天井が崩れた！'},
  eb_grind: {name: 'すりつぶす', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'bite2', msg: '{user}は岩のあごですりつぶそうとした！'},
  eb_iron_fist: {name: '鉄の拳', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'strike2', msg: '{user}は鉄の拳を打ちつけた！'},
  eb_anvil_drop: {name: '金床落とし', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 2, acc: 0.8}], fx: 'strike3', msg: '{user}は金床のような腕を振り下ろした！'},
  eb_forge_breath: {name: '炉の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.6, element: 'fire'}], fx: 'breath_fire', msg: '{user}の胸の炉から炎が噴き出した！'},
  eb_iron_wall: {name: '鉄の守り', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: '{user}は鉄の腕を組んで守りを固めた！'},
  eb_twin_fang: {name: '二つの牙', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9, hits: 2, element: 'fire'}], fx: 'bite', msg: '{user}の二つの頭が噛みついた！'},
  eb_flame_howl: {name: '炎の遠吠え', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'burn', chance: 0.25}], fx: 'fire2', msg: '{user}の遠吠えで、炎が燃え広がった！'},
  eb_hound_fury: {name: '猛り', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'atk', stages: 2}], fx: 'buff', msg: '{user}は怒りに燃えている！'},
  eb_lava_breath: {name: '溶岩の息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.6, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.15}], fx: 'breath_fire', msg: '{user}は溶岩を吐き出した！'},
  eb_lava_wave: {name: '溶岩の波', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.2}], fx: 'fire3', msg: '{user}は溶岩の波を起こした！'},
  eb_eruption: {name: '噴火', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.6, hits: 4, element: 'fire'}], fx: 'explosion2', msg: '{user}の背中が噴火した！'},
  eb_magma_fist: {name: '溶岩の拳', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6, element: 'fire'}], fx: 'fire2', msg: '{user}は溶岩の拳を振り下ろした！'},
  eb_obsidian_crush: {name: '黒曜の拳', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8, element: 'earth'}], fx: 'strike3', msg: '{user}は黒い岩の拳でたたきつぶそうとした！'},
  eb_ash_storm: {name: '灰の嵐', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'earth'}, {type: 'status', status: 'blind', chance: 0.25}], fx: 'earth2', msg: '{user}は灰の嵐を巻き起こした！'},
  eb_sun_orb: {name: '太陽の球', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'fire'}], fx: 'fire2', msg: '{user}の太陽の球が燃え上がった！'},
  eb_moon_orb: {name: '月の球', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}], fx: 'water2', msg: '{user}の月の球が冷たく光った！'},
  eb_star_orb: {name: '星の球', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'light', hits: 3}], fx: 'holy2', msg: '{user}の星の球から光が飛び散った！'},
  eb_orbit_shield: {name: '軌道の守り', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}], fx: 'buff', msg: '{user}のまわりを球がめぐり、守りを固めた！'},
  eb_swallow_star: {name: '星を飲む', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.1}, {type: 'buff', stat: 'mag', stages: 1}], fx: 'dark', msg: '{user}は夜空の星をひとつ飲みこんだ！'},
  eb_star_spit: {name: '星くず吐き', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'light', hits: 5}], fx: 'holy2', msg: '{user}は星くずを吐き散らした！'},
  eb_void_fang: {name: '虚空の牙', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, element: 'dark', drain: 0.3}], fx: 'dark2', msg: '{user}は虚空の牙で噛みついた！'},
  eb_dark_nova: {name: '闇の爆発', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'dark'}], fx: 'dark3', msg: '{user}のまわりで闇がはじけた！'},
  eb_silver_thrust: {name: '銀筆の突き', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4, kind: 'pierce'}], fx: 'pierce', msg: '{user}は銀のペンを細剣のように突き出した！'},
  eb_copy_power: {name: '力の書き写し', kind: 'enemy', target: 'enemy', effects: [{type: 'dispel', side: 'good'}, {type: 'status', status: 'silence', chance: 0.4}], fx: 'dispel', msg: '{user}は相手の力を手帳に書き写した！'},
  eb_ink_guard: {name: '墨の壁', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 1}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: '{user}は墨で守りの文字を書いた！'},
  eb_record_light: {name: '記録の光', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'light'}], fx: 'holy2', msg: '{user}の手帳が白く光った！'},
  eb_white_page: {name: '白紙の頁', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'silence', chance: 0.25}, {type: 'damage', formula: 'magic', power: 0.5, mp: true}], fx: 'dispel', msg: '{user}は白紙の頁を広げた！'},
  eb_pen_flurry: {name: '連続突き', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.6, hits: 3, kind: 'pierce'}], fx: 'pierce2', msg: '{user}はペンで連続して突いた！'},
  eb_page_blizzard: {name: '紙吹雪の嵐', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 4, kind: 'slash'}], fx: 'slash2', msg: '{user}の体から紙片が嵐のように舞った！'},
  eb_tome_slam: {name: '大書の一撃', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8}], fx: 'strike3', msg: '{user}は分厚い本の腕を打ちつけた！'},
  eb_rebind: {name: '製本しなおす', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.1}], fx: 'regen', msg: '{user}は散らばった頁を集めてとじなおした！'},
  eb_call_books: {name: '本を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'book_1', n: 1, max: 4}], fx: 'magic', msg: '書棚から本が飛び出してきた！'},
  eb_dust_of_ages: {name: '古い埃', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.25}], fx: 'smoke', msg: '{user}は古い埃を巻き上げた！'},
  eb_shade_blade: {name: '影の剣', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, kind: 'slash'}], fx: 'slash2', msg: '{user}は白い剣を振るった！'},
  eb_shade_crest: {name: '紋章の剣', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, element: 'light'}], fx: 'holy2', msg: '{user}の剣に紋章の光が宿った！'},
  eb_shade_sweep: {name: '影の一閃', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.65, kind: 'slash'}], fx: 'slash2', msg: '{user}は剣で大きく払った！'},
  eb_shade_heal: {name: '祈りの光', kind: 'enemy', target: 'allies', effects: [{type: 'heal', pct: 0.2}], fx: 'heal', msg: '{user}は静かに祈った。'},
  eb_shade_raise: {name: 'よみがえりの祈り', kind: 'enemy', target: 'ally_dead', effects: [{type: 'revive', pct: 0.4}], fx: 'revive', msg: '{user}の祈りで、影がふたたび立ち上がった！'},
  eb_shade_holy: {name: '聖なる光', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'light'}], fx: 'holy2', msg: '{user}は聖なる光を放った！'},
  eb_shade_meteor: {name: '流れ星', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.55, hits: 4}], fx: 'explosion2', msg: '{user}は流れ星を降らせた！'},
  eb_shade_frost: {name: '氷の嵐', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.1}], fx: 'ice2', msg: '{user}は氷の嵐を呼んだ！'},
  eb_shade_fire: {name: '炎の嵐', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'fire'}], fx: 'fire2', msg: '{user}は炎の嵐を呼んだ！'},
  eb_white_book: {name: '白の書', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'silence', chance: 0.5}, {type: 'dispel', side: 'good'}], fx: 'dispel', msg: '{user}は白の書を開いた！', aim: 'middle'},
  eb_erase_memory: {name: '記憶を消す', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.6, mp: true}], fx: 'mp', msg: '{user}の筆が、記憶を消していく……！'},
  eb_silver_quill: {name: '銀の筆', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.4, element: 'light'}], fx: 'holy2', msg: '{user}は銀の筆で光の文字を書いた！'},
  eb_page_shield: {name: '頁の盾', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}, {type: 'buff', stat: 'def', stages: 1}], fx: 'buff', msg: '{user}のまわりに白い頁が舞った！'},
  eb_call_scribes: {name: '書記を呼ぶ', kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'scribe_1', n: 1, max: 3}], fx: 'magic', msg: '{user}の呼び声に、書記たちが駆けつけた！'},
  eb_whiteout: {name: '白紙に還す', kind: 'enemy', target: 'enemies', effects: [{type: 'dispel', side: 'good'}, {type: 'damage', formula: 'magic', power: 0.7}], fx: 'dispel', msg: '{user}はすべてを白紙に還そうとした！'},
  eb_oblivion_wave: {name: '忘却の波', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.6, mp: true}, {type: 'status', status: 'silence', chance: 0.2}], fx: 'mp', msg: '忘却の波が押し寄せた！'},
  eb_paper_hand: {name: '紙の手', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'strike2', msg: '巨大な紙の手が振り下ろされた！'},
  eb_erase_name: {name: '名を消す', kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'silence', chance: 0.6}, {type: 'buff', stat: 'atk', stages: -1, chance: 0.6}], fx: 'dispel', msg: '{user}は名を消そうとした！'},
  eb_blank_storm: {name: '白い嵐', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 4, kind: 'slash'}], fx: 'slash2', msg: '白い紙片の嵐が吹き荒れた！'},
  eb_eight_legends: {name: '八つの伝承', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, hits: 8}], fx: 'magic3', msg: '{user}のまわりで、八つの伝承の光がはじけた！', elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
  eb_oblivion_breath: {name: '忘却の吐息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.7}, {type: 'status', status: 'silence', chance: 0.25}], fx: 'breath', msg: '{user}は忘却の吐息を吐いた！'},
  eb_unwrite: {name: '書き消し', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8}, {type: 'dispel', side: 'good'}], fx: 'strike3', msg: '{user}は物語を書き消そうとした！'},
  eb_dream_sleep: {name: '眠りの誘い', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'sleep', msg: '{user}は深い眠りへ誘った……。'},
  eb_nemrea_rewrite: {name: '物語の書き直し', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.08}], fx: 'regen', msg: '{user}は自分の体を書き直した！'},
  eb_echo_despair: {name: '絶望の残響', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'dark'}, {type: 'buff', stat: 'atk', stages: -1, chance: 0.3}], fx: 'dark3', msg: '{user}の声が、絶望となって響いた！'},
  eb_echo_claw: {name: '残影の爪', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.1, hits: 2, element: 'dark'}], fx: 'claw', msg: '{user}は闇の爪で引き裂いた！'},
  eb_echo_flame: {name: '魔炎', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'fire'}], fx: 'fire3', msg: '{user}は魔の炎を放った！'},
  eb_echo_gaze: {name: '恐れのまなざし', kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'stun', chance: 0.2}], fx: 'debuff', msg: '{user}のまなざしに、体がすくんだ！'},
  eb_echo_gather: {name: '闇をまとう', kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.06}], fx: 'dark', msg: '{user}は闇をまとって傷をふさいだ。'},
  eb_rewind: {name: '巻き戻し', kind: 'enemy', target: 'enemies', effects: [{type: 'dispel', side: 'good'}, {type: 'heal', pct: 0.1, on: 'self'}], fx: 'warp', msg: '時が巻き戻っていく……！'},
  eb_eternal_breath: {name: '終わらない息', kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.8}], fx: 'breath_dark', msg: '{user}は終わりのない息を吐き続けた！'},
  eb_ring_crush: {name: '円環の締めつけ', kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.9}, {type: 'status', status: 'paralyze', chance: 0.15}], fx: 'strike3', msg: '{user}は長い体で締めつけた！'},
  eb_time_loop: {name: 'くり返しの呪い', kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.6}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'debuff', msg: '同じ時が、何度もくり返される……！'},
  eb_scale_storm: {name: 'うろこの嵐', kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.6, hits: 5}], fx: 'slash2', msg: '{user}のうろこが嵐のように飛んだ！'},
  eb_tail_devour: {name: '尾をのむ', kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'atk', stages: 1}, {type: 'buff', stat: 'mag', stages: 1}], fx: 'buff', msg: '{user}は自分の尾をのみこんで、力を増した！'},
});
```

### 11.6 ボスの新しい絵（16 ＋ お供 2。A15 が `src/art/bosses_b.js` に描く）
既存のボスの絵（クレスト）を使うもの: `boss_frost_giant`（氷壁の巨人）・`boss_flame_lord`（溶岩の巨獣）・`boss_star_guardian`（天球の番人）はそのまま。`boss_serpent`（砂もぐり）・`boss_general_b`（名なき砂の王）・`boss_bandit`（亡霊船長）・`boss_general_a`（鉄の番人）・`boss_demon_king`（魔王の残影）は §4.6 の色替え・フィルター。
ボスの絵の大きさは括弧のとおり（エンジン章 §3.2: 〜128×112）。戦闘画面では上の 18 行ほどがステータス窓に隠れるので、**顔は上から 20px より下**に置く（クレストと同じ注意）。
- `boss_pageeater`（ページ食らい）: 80×64（新）。紙を何枚も重ねてできた巨大な白い紙魚（しみ）。平たい体に細い足が左右に8本ずつ、頭の先は丸いやつめうなぎのような口で、墨色の小さな歯が輪になって並ぶ。体の表面に消えかけた文字の列がうっすら残り、まわりに破れた紙片が5〜6枚舞う。色: 紙 #f4f0e4→#c8c0b0（影は青灰）、文字 #9090a0、口の中 #302030、歯 #202028。
- `boss_moth`（ダストウィング）: 96×80（新）。灰茶色の巨大なガが羽を大きく広げる。前の羽に黄色と黒のふちの大きな目玉模様が一対。胸はふさふさの毛、触角は羽根のように広い櫛形。羽のふちからりん粉が粉雪のように落ちる（明るい点を散らす）。色: 羽 #8a7860→#c8b898、目玉 #f0c040/#201810、毛 #d8c8a8、りん粉 #f0e8d0。
- `boss_rooteater`（根食らい）: 96×80（新）。千年樹の根にからみつく、白くぶよぶよした巨大な虫。体の節は紙のように白く一部が破れて中が空っぽ。頭には根のようにのびた曲がったあごが何本もあり、病んだ黄緑の樹液の筋が体を走る。背景側に太い根が2本。色: 体 #e8e4d8→#a8a498、樹液 #b0d040、あご #604830、根 #6a4a30。
- `boss_root`（根の触手）: 48×48（新・小さい）。地面から突き出た太い根の先が蛇の頭のように持ち上がる。先端に白い紙のような皮、樹液のしずく。色: 根 #6a4a30→#a07850、先端 #e8e4d8。
- `b_sandworm`（砂もぐり）: 既存 boss_serpent を砂色に色替え（青緑 → 黄土。水面は砂の波に見える）。
- `b_sandking`（名なき砂の王）: 既存 boss_general_b（冠の髑髏の術師）を色替え: 紫の頭巾と衣 → 砂色と金、骨 → 包帯のような生成り。
- `boss_frost_giant`（氷壁の巨人）: 既存 boss_frost_giant をそのまま使う。
- `boss_whitedragon`（白竜ネーヴェ）: 112×96（新）。真珠色のうろこの白い竜が翼を半ば広げて首をもたげる。たてがみはつららの列、角は氷の結晶が伸びたもの、翼膜は淡い水色で透ける。胸の中央に暗い青の氷の塊（凍った心）が光る。目は白く濁った水色。足もとに雪煙。色: うろこ #f4f8ff→#b8c8e0、翼膜 #c0e8ff、氷 #e0ffff、凍った心 #3050a0/#80a0ff。
- `boss_mistbeast`（霧食らい）: 96×96（新）。灰色の霧が、腰から上は頭巾をかぶった魔女の姿（イルザのまね）をかたどり、腰から下は大きく開いた丸い口になる。口には針のように細い歯。頭巾の奥に白いランタンのような目が2つ。霧のすそが左右に流れ、子どもの赤いリボンが1本からまっている。色: 霧 #b8c0c8→#606878（半透明のディザ）、目 #fffff0、口の中 #201828、リボン #e03040。
- `boss_tentacle`（大ダコの足）: 48×48（新・小さい）。水面から突き出たタコの太い足が1本、先を丸めて持ち上げる。吸盤の列が見える。色: 足 #704880→#c090c0、吸盤 #f0d0e0、水しぶき #c0e0ff。
- `b_captain`（亡霊船長グレン）: 既存 boss_bandit を青白い亡霊の色に色替え（肌 → 青白、赤いバンダナ → 青緑）。
- `b_ironwarden`（鉄の番人）: 既存 boss_general_a（黒い騎士）を色替え: 黒い鎧 → 鉄灰とさびの赤茶、燃える面頬 → 炉のようなだいだい。
- `boss_hellhound`（炎の番犬）: 96×80（新）。黒い毛の二つ頭の巨大な犬が身を低くして構える。毛皮の割れ目から溶岩の光がのぞき、両方の口から溶岩がしたたる。首に鎖の首輪、ちぎれた鉄の輪がぶら下がる。たてがみは炎。目は燃えるだいだい。色: 毛 #201818→#503830、溶岩 #ff6020/#ffd040、鎖 #707078、炎 #ff8030/#ffe080。
- `boss_flame_lord`（溶岩の巨獣）: 既存 boss_flame_lord をそのまま使う。第2段階の絵 b_lavabeast_cold = boss_flame_lord を 彩度0.35・明度0.55 に色替え（黒い岩）。
- `boss_star_guardian`（天球の番人）: 既存 boss_star_guardian をそのまま使う。
- `boss_stareater`（星食らい）: 112×96（新）。夜空に開いた穴のような、細長い狼と蛇の合いの子。体は真っ黒で輪郭だけが紫にふちどられ、内側に飲みこんだ星座がかすかに光る。口に星がいくつもはさまり、星くずのよだれが垂れる。白く淡い目が3つ。尾は細く長く空に溶ける。色: 体 #080810 と星 #c0c8ff、ふち #8050c0、目 #e0e8ff。
- `boss_rowell`（ロウェル）: 64×80（新）。20歳ほどの青年の正面の上半身。記録院の白い上着（金の縁取り、襟を立てる）、黒髪を後ろで結ぶ。左手に開いた黒い手帳、右手に細剣のように構えた銀のペン。きつい目つき。色: 上着 #f0f0f0/#c8c8d0、縁 #d0b040、髪 #202028、手帳 #202020、ペン #c0c8d8。
- `boss_bookgolem`（本の巨人）: 96×96（新）。何千冊もの本を積み上げて鎖でしばった、背をかがめた巨人。肋骨は本棚の板、両腕は分厚い本を重ねた柱。顔は開いた巨大な本で、頁の上に光る文字が2つ（目）。すき間から頁が何枚もはためく。色: 本の背 #804030/#306040/#304880/#a08030、頁 #f0e8d0、鎖 #808088、目の文字 #fff0a0。
- `boss_shade_sword`（剣の勇者の影）: 64×80（新）。白く半透明の若い剣士の影。長剣を立てて構え、左手に丸い盾、短いマント。顔は描かず、光がにじむだけ。足もとは光の粒になって消える。色: 本体 #f8f8ff（輪郭 #a0b0e0、半分ディザで透ける）、剣 #ffffff、光 #fff0b0。
- `boss_shade_prayer`（祈りの勇者の影）: 64×80（新）。白く半透明の神殿の娘の影。長いベールと法衣、両手で持つ杖の先に太陽の円盤。顔は描かない。色は剣の影と同じ。
- `boss_shade_star`（星の勇者の影）: 64×80（新）。白く半透明の魔法使いの娘の影。とんがり帽子、星の先の杖を掲げ、腰に本。顔は描かない。色は剣の影と同じ。
- `boss_lazaro`（大書記ラザロ）: 80×96（新）。60歳ほどの男の全身。銀の刺しゅうの長い白衣、灰色のひげ、穏やかで悲しげな顔。右手の銀の羽ペンの先から白い光の線が流れ、左側に白い本（白の書）が開いて宙に浮き、頁が帯になって流れ出る。色: 衣 #f4f4f0/#c0c4cc、刺しゅう #c0c8d8、ひげ #a0a0a8、白の書 #ffffff と光 #e8f0ff。
- `boss_nemrea1`（虚ろの王）: 128×112（新）。白い紙片が渦を巻いてできた、冠をかぶり頭巾をかぶった巨大な影。胸の中心にラザロの姿（目を閉じ、白紙の帯でしばられる）。左右に紙でできた巨大な手。輪郭の文字がはがれて舞い、白く溶ける。色: 紙 #f8f8f4→#9098a8、冠 #d0d0d8、ラザロ #c8ccd4、はがれる文字 #606878。
- `boss_nemrea2`（ネムレア）: 128×112（新）。名を与えられた真の姿。白い大理石のような、眠たげで静かな顔の巨大な人影。背に頁でできた翼が8枚（1枚ずつ色合いが違う: 緑・砂・氷・霧・潮・鉄・灰・星）。体の半分に光る文字が広がりつつある。頭に折れた羽ペンの冠。まわりに星とインクの渦。色: 体 #f0eee8、文字 #fff0a0、翼 #b0d0a0/#e0c890/#c0e8ff/#c0c8d0/#90d0e0/#a0a0a8/#b0a0a0/#c0c0ff。
- `boss_ouroboros`（円環竜オウロボラ）: 128×112（新）。自分の尾をくわえて完全な輪になった巨大な竜。うろこは輪を一周するあいだに金から黒へ移り変わる（昼から夜）。輪の内側に頁と星が渦巻く銀河。背にそって小さな翼が何対も並ぶ。目は時計の文字盤のような金色の輪。色: 金 #f0c040→黒 #181020、銀河 #6040a0/#c0c8ff、頁 #f0e8d0、目 #ffe070。

---------------------------------------------------------------------------------------------------
## 12. 戦利品（担当: 魔物の側は A11・A12。品の定義は weapons A9・gear A10）

### 12.1 規則（normative）
- **3つの枠を別々に抽選する**（成長章 §10.1）。確率の分母の既定: 雑魚 8 / 32 / 256、宝箱もどき 8 / 16 / 128、鋼 4 / 16 / 128、レア魔物 2 / 6 / 24、ボス 1（通常だけ）。
- **品のティア** = その段の出始めのティア + 1（T8 の段は 8、裏の段は 9）。例: 灰色オオカミ（T0）の品は T1、月影オオカミ（T6）は T7。レア魔物は §10.1。
- **超レア品**: 1つの品はちょうど1種の魔物の超レア枠にだけ置く（234 品）。宝箱・店・盗みでは手に入らない（成長章 §10.1）。能力値は成長章 §3.2 の「超レア = ×3」、特殊効果 1〜2 と、たいていクセ 1。
- **レア品**: 同じティアの 3 種まで共有（134 品）。能力値 ×2 と特殊効果 1。レア魔物の品はその種だけ。
- **通常枠**: 道具（§12.3）。系統と段の性格で選んだ（植物 → 傷薬、毒の種 → 解毒の葉、術師 → 魔力の水、親和の種 → その属性の魔石、宝箱 → 高い道具、段が上がると 良薬 → 命の水）。
- **盗む**（技章の `steal`）はレア枠 → 通常枠の順（成長章 §10.1）。超レアは盗めない。
- 呼ばれた魔物はドロップしない（§0.19）。

### 12.2 効果の略記（§12.4〜12.6 の「特殊効果 ｜ クセ」の読み方。weapons・gear はこれを `mods` などに直す）
| 略記 | 意味（成長章 §16 のキー） |
|---|---|
| `key+N` / `key-N` | `mods[key] = ±N`（`atk def mdef hit eva crit spd mag hpPct mpPct physPct magicPct healPct itemPct mpCostPct expPct goldPct dropPct rarePct superPct stealPct encounterPct rareEncPct goldenPct preemptPct escapePct`） |
| `el:火` など `el:<属性>` | 武器の属性 `element` |
| `onHit:<状態><%>` | 武器の追加効果 `onHit: {status, chance}` |
| `metalHit` | 武器の項目 `metalHit: true`（その武器での攻撃・技を `metalHit` 扱いにする。§14 の依頼） |
| `boost:<属性><N>` | `elemBoost: {属性: N}` |
| `res:<属性><倍率>` | `elemResist: {属性: 倍率}`（0.5 半減、0 無効、−1 吸収、1.5・2 は弱くなるクセ） |
| `imm:<状態>` | `statusImmune` に足す |
| `sres:<状態><%>` | `statusResist: {状態: %/100}` |
| `glim:<系統か属性か tech か spell><N>` | `glimPct` |
| `prof:<系統か属性><N>` | `profPct` |
| `regen` / `mpRegen+N` / `wpRegen+N` / `walkHeal:N` / `noFloorDamage` | 同名の mods |
| `buff:<能力>+1` | `startBuffs: {能力: 1}` |
| `stat:<能力>-1u` / `-2u` | クセ: 能力値を「その品のティアの 1 単位（U）」ぶん下げる（`stats[能力] = −U(T)`。成長章 §3.1） |
| `defHalf` / `mdef-50%` | クセ: その品の守備力（術防）を半分にする |
| `twoHanded` | クセ: 片手の系統でも両手持ちにする（盾が付けられない） |
- 能力値の単位の振り方は、成長章 §3.3 の規則（重さ・系統ごと）のまま。特殊効果の値が成長章 §16 の目安より大きいものは、超レアの「突き抜けた性能」として意図したもの。

### 12.3 道具（通常枠。gear A10 がこの id で定義する。名前は gear が直してよい）
| id | 名前（案） | 効果 | 値段 | 落とす魔物 |
|---|---|---|---|---|
| `i_herb` | 傷薬 | 味方1人 HP 35% 回復 | 20 | 42種 |
| `i_herb2` | 良薬 | 味方1人 HP 70% 回復 | 80 | 32種 |
| `i_elixir` | 命の水 | 味方1人 HP 100% 回復 | 300 | 33種 |
| `i_revive` | 気付けの花 | 戦闘不能の1人を HP 30% で蘇生 | 100 | `scorpion_4` `mummy_4` `ghost_4` `skeleton_4` `armor_4` `mimic_3` |
| `i_revive2` | よみがえりの花 | 戦闘不能の1人を HP 100% で蘇生 | 600 | `void_2` `chaos_2` `demon_2` `demon_3` `platinum_2` `b_valzard_echo` |
| `i_ether` | 魔力の水 | 味方1人 MP 30% 回復 | 150 | 14種 |
| `i_ether2` | 魔力の泉水 | 味方1人 MP 60% 回復 | 400 | 11種 |
| `i_antidote` | 解毒の葉 | 毒を治す（戦闘中） | 15 | 13種 |
| `i_eyedrop` | 目薬 | 暗闇を治す（戦闘中） | 15 | `bat_1` `bat_3` `seabird_3` `doll_2` `kraken_1` `eyeball_1` `automaton_2` |
| `i_panacea` | なおし薬 | 悪い状態をすべて治す（戦闘中） | 60 | 14種 |
| `i_bomb` | 火薬玉 | 敵全体に火の tier ダメージ SP 0.8 | 50 | `skeleton_3` `mole_3` `goblin_3` |
| `i_stone_fire` | 火の魔石 | 成長章 §9.6 | 30 | `wisp_1` `beetle_3` `crystal_2` `salamander_1` `salamander_4` `imp_2` `gargoyle_3` `darkmage_2` |
| `i_stone_water` | 水の魔石 | 同上 | 30 | `jelly_2` `crab_2` `wolf_2` `frostling_1` `merman_2` `crystal_3` |
| `i_stone_wind` | 風の魔石 | 同上 | 30 | `seabird_2` `owl_1` `darkmage_3` `wyvern_1` |
| `i_stone_earth` | 土の魔石 | 同上 | 30 | `sandworm_1` `golem_1` `mole_1` `beetle_1` |
| `i_stone_light` | 光の魔石 | 同上 | 30 | `crystal_1` `eyeball_4` |
| `i_stone_dark` | 闇の魔石 | 同上 | 30 | `bat_4` `plant_4` `wolf_4` `wisp_4` `spider_3` `crystal_4` |
| `i_fruit_hp` | 大樹の実 | 使った人の最大HP +8（grow） | 0 | 9種 |
| `i_fruit_mp` | 月のしずく | 使った人の最大MP +2（grow） | 0 | `b_sandworm` `b_doll_conductor` `b_rockeater` `b_orrery` `b_bookgolem` `b_shade_prayer` |
| `i_fruit_wp` | 闘志の実 | 使った人の最大WP +2（grow） | 0 | `b_pageeater` `b_moth` `b_icegiant` `b_octopus` `b_hellhound` |
| `i_jewel_carrot` | 宝石にんじん | 味方1人の HP・MP・WP 全快 | 1000 | `rm_jewel_hare` |
| `i_bloom_nectar` | 花角の蜜 | 味方全員 HP 50% 回復 | 1200 | `rm_bloom_fawn` |
| `i_glass_dust` | ガラスのりん粉 | 敵全体に暗闇 60% | 1200 | `rm_glass_moth` |
| `i_golden_acorn` | 黄金のどんぐり | 売ると 2500 ゴールド（使えない） | 5000 | `rm_acorn_prince` |
| `i_diamond_dust` | 金剛石の粉 | 味方1人の守備力 +2段階（戦闘中） | 1200 | `rm_diamond_lizard` |
| `i_gold_bar` | 金の延べ板 | 売ると 3000 ゴールド（使えない） | 6000 | `rm_gold_idol` |
| `i_aurora_feather` | オーロラの羽根 | 味方全員 MP 30% 回復 | 1500 | `rm_aurora_bird` |
| `i_fox_icicle` | キツネのつらら | 敵1体に凍結 60% | 1200 | `rm_icetail_fox` |
| `i_lotus_dew` | はすの朝露 | 味方全員の悪い状態を治し、再生 | 1200 | `rm_lotus_sprite` |
| `i_ghost_tea` | おばけの紅茶 | 味方1人 HP 100% 回復・悪い状態を治す | 1200 | `rm_ghost_teapot` |
| `i_snail_bell` | 小さな鐘 | 味方全員の眠り・混乱・気絶を治す | 1000 | `rm_bell_snail` |
| `i_stardust` | 星くずの砂 | 味方全員 MP 30% 回復 | 1500 | `rm_star_whale` |
| `i_gold_coins` | 古い金貨の袋 | 売ると 2000 ゴールド（使えない） | 4000 | `rm_treasure_crab` |
| `i_gem_quill` | 宝石の針 | 敵1体に tier ダメージ SP 2.0（属性なし） | 1200 | `rm_gem_hedgehog` |
| `i_prism_shard` | 虹晶のかけら | 味方1人の MP 全快 | 1500 | `rm_prisma` |
| `i_spa_egg` | 温泉たまご | 味方全員 HP 70% 回復 | 1200 | `rm_spa_monkey` |
| `i_volcano_stone` | 火山の熱石 | 敵全体に火の tier ダメージ SP 1.5 | 1200 | `rm_volcano_turtle` |
| `i_moon_wool` | 月見の毛糸 | 味方全員 WP 30% 回復 | 1500 | `rm_moon_sheep` |
| `i_spring_key` | ぜんまいの鍵 | 味方1人の WP 全快 | 1500 | `rm_clock_bird` |
| `i_wisdom_page` | 知恵の頁 | 味方1人の MP・WP 全快 | 3000 | `rm_bookworm` |
| `i_golden_ink` | 黄金のインク | 味方全員 MP 50%・WP 50% 回復 | 4000 | `rm_golden_quill` |
| `i_memory_bubble` | 思い出の泡 | 味方全員 HP・MP 100% 回復 | 6000 | `rm_memory_fish` |
| `i_dream_fruit` | 夢の果実 | 使った人の最大HP +20・最大MP +5・最大WP +5（grow） | 0 | `rm_dream_tapir` |
- `i_fruit_*` と `i_dream_fruit` は `grow`（エンジン章 §3.1）。本編のボスの確定ドロップ（1回だけ）と、めったに出ない夢食いバク（1/200・通常枠 1/2）だけから手に入る。本編で手に入る数: 大樹の実 9（地方ボス 8・ラザロ）、月のしずく 6（砂もぐり・指揮者人形・岩食らい・天球の番人・本の巨人・祈りの勇者の影）、闘志の実 5（ページ食らい・ダストウィング・氷壁の巨人・深みの大ダコ・炎の番犬）。ロウェル・ネムレア・お供は落とさない。
- レア魔物の通常枠（`i_jewel_carrot` から `i_dream_fruit` まで）は**その種だけ**の道具。「売るとお金」の3つは使えない換金用（`use` を持たない）。

### 12.4 超レア品（234。魔物 → 品）
| 魔物 | 超レア品 id | 名前 | 種別 | T | 特殊効果 ｜ クセ |
|---|---|---|---|---|---|
| `jelly_1` | `ac_jelly_heart` | ぷるぷるの心 | アクセ | 1 | hpPct+10 regen ｜ Q: stat:agi-1u |
| `jelly_2` | `w_staff_bubble` | あぶくの杖 | 武器・staff | 3 | el:water boost:water20 ｜ Q: res:earth1.5 |
| `jelly_3` | `w_whip_venomjelly` | 毒ゼリーの鞭 | 武器・whip | 5 | onHit:poison40 ｜ Q: res:fire1.5 |
| `jelly_4` | `w_sword_jellygeneral` | ゼリー将軍の剣 | 武器・sword | 7 | buff:atk+1 sres:stun50 ｜ Q: stat:agi-1u |
| `jelly_5` | `ac_rainbow_core` | 虹の核 | アクセ | 8 | res:fire0.5 res:water0.5 res:wind0.5 res:earth0.5 ｜ Q: hpPct-15 |
| `rat_1` | `w_dagger_rattooth` | ネズミの前歯 | 武器・dagger | 1 | crit+10 stealPct+25 ｜ Q: stat:vit-1u |
| `rat_2` | `ac_plague_tail` | 毒ネズミのしっぽ | アクセ | 3 | imm:poison glim:dagger30 ｜ Q: res:fire1.5 |
| `rat_3` | `hn_iron_tooth` | 鉄歯の手甲 | 手・重装 | 5 | atk+6 def+6 ｜ Q: stat:agi-1u |
| `rat_4` | `ac_rat_king_ring` | 頭領の指輪 | アクセ | 7 | goldPct+50 stealPct+50 ｜ Q: hpPct-10 |
| `bat_1` | `ft_bat_wing` | コウモリの羽ぐつ | 足・軽装 | 1 | eva+8 escapePct+25 ｜ Q: res:wind1.5 |
| `bat_2` | `w_katana_crimson` | 紅吸いの刀 | 武器・katana | 3 | crit+10 hpPct+5 ｜ Q: res:light1.5 |
| `bat_3` | `hd_echo_hood` | 反響のずきん | 頭・布 | 5 | imm:confuse sres:sleep50 ｜ Q: mpCostPct+20 |
| `bat_4` | `w_bow_nightwing` | 夜翼の弓 | 武器・bow | 7 | el:dark onHit:blind25 ｜ Q: res:light1.5 |
| `bat_5` | `bd_count_mantle` | 夜の公爵の外套 | 体・布 | 8 | mag+10 regen ｜ Q: res:light2 res:fire1.5 |
| `paper_1` | `ac_first_letter` | 最初の一文字 | アクセ | 3 | glim:spell20 prof:fire25 ｜ Q: res:dark1.5 |
| `paper_2` | `w_spear_whiteline` | 白線の槍 | 武器・spear | 5 | el:light crit+8 ｜ Q: res:dark1.5 |
| `paper_3` | `sh_unwritten` | 書かれざる盾 | 盾・重装 | 7 | res:dark0.5 sres:silence50 ｜ Q: res:fire1.5 |
| `paper_4` | `w_greatsword_eraser` | 白紙の大剣 | 武器・greatsword | 8 | onHit:silence30 physPct+10 ｜ Q: hpPct-10 |
| `crab_1` | `w_fist_crabclaw` | カニばさみの籠手 | 武器・fist | 1 | crit+8 def+4 ｜ Q: stat:agi-1u |
| `crab_2` | `sh_ironshell` | 鉄甲の盾 | 盾・重装 | 3 | def+10 sres:stun50 ｜ Q: stat:agi-1u |
| `crab_3` | `w_bow_foamshot` | 泡しぶきの弓 | 武器・bow | 5 | el:water onHit:blind25 ｜ Q: res:earth1.5 |
| `crab_4` | `bd_castle_carapace` | 城ガニの甲羅 | 体・重装 | 7 | def+15 res:water0.5 ｜ Q: stat:agi-2u |
| `seabird_1` | `ft_gull_boots` | カモメの羽ぐつ | 足・軽装 | 1 | spd+10 preemptPct+5 ｜ Q: res:wind1.5 |
| `seabird_2` | `w_spear_stormbeak` | 嵐のくちばし槍 | 武器・spear | 3 | el:wind boost:wind15 ｜ Q: res:fire1.5 |
| `seabird_3` | `ac_gull_loot` | カモメの宝袋 | アクセ | 5 | goldPct+40 dropPct+25 ｜ Q: res:wind1.5 |
| `seabird_4` | `hd_sea_wind` | 潮風のかんむり | 頭・軽装 | 7 | res:wind0.5 eva+10 ｜ Q: res:fire1.5 |
| `bee_1` | `w_dagger_stinger` | 花バチの針 | 武器・dagger | 1 | crit+12 hit+5 ｜ Q: res:fire1.5 |
| `bee_2` | `w_spear_venomneedle` | 毒針の槍 | 武器・spear | 3 | onHit:poison40 ｜ Q: stat:vit-1u |
| `bee_3` | `hn_numb_gloves` | しびれ針の手袋 | 手・軽装 | 5 | hit+6 sres:paralyze50 ｜ Q: res:fire1.5 |
| `bee_4` | `w_bow_thousand` | 千本針の弓 | 武器・bow | 7 | crit+8 hit+10 ｜ Q: stat:vit-1u |
| `bee_5` | `hd_queen_crown` | 女王の冠 | 頭・布 | 8 | healPct+25 mpRegen+2 ｜ Q: res:fire1.5 res:wind1.5 |
| `mushroom_1` | `hd_nap_cap` | ひるねの帽子 | 頭・布 | 1 | imm:sleep hpPct+10 ｜ Q: stat:agi-1u |
| `mushroom_2` | `w_club_toadstool` | まだらの棍棒 | 武器・club | 3 | onHit:poison35 ｜ Q: res:fire1.5 |
| `mushroom_3` | `ac_dream_spore` | 夢見の胞子 | アクセ | 5 | imm:confuse glim:spell15 ｜ Q: mpCostPct+15 |
| `mushroom_4` | `w_staff_elder_cap` | 長老ダケの杖 | 武器・staff | 7 | healPct+20 sres:poison50 ｜ Q: stat:agi-1u |
| `plant_1` | `w_whip_vine` | 花づるの鞭 | 武器・whip | 1 | onHit:paralyze15 hit+5 ｜ Q: res:fire1.5 |
| `plant_2` | `bd_thorn_mail` | いばらの鎧 | 体・軽装 | 3 | def+8 sres:paralyze50 ｜ Q: res:fire1.5 |
| `plant_3` | `ac_poison_bloom` | 毒花のコサージュ | アクセ | 5 | imm:poison boost:dark15 ｜ Q: hpPct-10 |
| `plant_4` | `w_staff_moonbloom` | 月下美人の杖 | 武器・staff | 7 | el:dark boost:dark20 ｜ Q: res:light1.5 |
| `plant_5` | `bd_thousand_petal` | 千年花の衣 | 体・布 | 8 | regen healPct+15 ｜ Q: res:dark1.5 res:fire1.5 |
| `fairy_1` | `ft_prank_shoes` | いたずら妖精の靴 | 足・布 | 1 | preemptPct+8 escapePct+30 ｜ Q: stat:vit-1u |
| `fairy_2` | `w_staff_petal` | 花びらの杖 | 武器・staff | 3 | el:light healPct+15 ｜ Q: res:dark1.5 |
| `fairy_3` | `hd_mist_veil` | 霧の妖精のベール | 頭・布 | 5 | eva+8 sres:silence50 ｜ Q: res:earth1.5 |
| `fairy_4` | `ac_fairy_tiara` | 妖精姫のティアラ | アクセ | 7 | glim:light40 mpRegen+2 ｜ Q: res:dark1.5 |
| `treant_1` | `w_club_wander` | さまよい木の枝 | 武器・club | 1 | hpPct+10 sres:stun40 ｜ Q: res:fire1.5 |
| `treant_2` | `sh_bramble` | いばらの盾 | 盾・軽装 | 3 | def+6 eva+6 ｜ Q: res:fire1.5 |
| `treant_3` | `bd_moss_bark` | こけむした樹皮 | 体・重装 | 5 | regen res:earth0.5 ｜ Q: stat:agi-1u res:fire1.5 |
| `treant_4` | `w_staff_elder_root` | 古老の根杖 | 武器・staff | 7 | boost:earth25 mdef+8 ｜ Q: stat:agi-1u |
| `scorpion_1` | `w_dagger_redtail` | 赤い尾の短剣 | 武器・dagger | 1 | onHit:poison35 crit+5 ｜ Q: res:wind1.5 |
| `scorpion_2` | `w_fist_scorpion` | 毒尾の爪 | 武器・fist | 3 | onHit:poison35 crit+6 ｜ Q: res:wind1.5 |
| `scorpion_3` | `bd_steel_carapace` | 鋼殻のよろい | 体・重装 | 5 | def+12 sres:poison50 ｜ Q: stat:agi-1u |
| `scorpion_4` | `w_whip_reaper` | 死神の尾鞭 | 武器・whip | 7 | onHit:death5 crit+6 ｜ Q: hpPct-15 |
| `scorpion_5` | `hn_emperor_claw` | 皇帝のはさみ | 手・重装 | 8 | atk+10 crit+8 ｜ Q: stat:agi-1u res:wind1.5 |
| `snake_1` | `ft_sandsnake` | 砂ヘビのくつ | 足・軽装 | 1 | spd+8 noFloorDamage ｜ Q: res:fire1.5 |
| `snake_2` | `ac_rattle_charm` | 鈴尾の根付け | アクセ | 3 | encounterPct-25 escapePct+25 ｜ Q: stat:str-1u |
| `snake_3` | `hd_gaze_circlet` | にらみの額当て | 頭・軽装 | 5 | sres:paralyze60 hit+8 ｜ Q: res:fire1.5 |
| `snake_4` | `w_whip_python` | 大蛇の皮鞭 | 武器・whip | 7 | onHit:paralyze20 physPct+8 ｜ Q: res:wind1.5 |
| `mummy_1` | `hn_tomb_wrap` | 墓守の手甲 | 手・軽装 | 1 | sres:paralyze50 def+4 ｜ Q: res:fire1.5 |
| `mummy_2` | `hd_cursed_wrap` | 呪いの包帯 | 頭・布 | 3 | mag+6 glim:dark25 ｜ Q: res:light1.5 |
| `mummy_3` | `w_staff_ankh` | 冥府の杖 | 武器・staff | 5 | boost:dark20 mpCostPct-15 ｜ Q: res:light1.5 |
| `mummy_4` | `w_sword_tombgeneral` | 王墓の将軍剣 | 武器・sword | 7 | crit+6 imm:death ｜ Q: res:light1.5 |
| `mummy_5` | `bd_royal_linen` | 王家の亜麻衣 | 体・布 | 8 | mag+10 imm:death sres:silence40 ｜ Q: res:fire1.5 res:light1.5 |
| `cactus_1` | `sh_cactus` | サボテンの盾 | 盾・軽装 | 1 | def+5 eva+5 ｜ Q: res:fire1.5 |
| `cactus_2` | `w_bow_needlecactus` | 針サボテンの弓 | 武器・bow | 3 | crit+10 hit+5 ｜ Q: stat:mnd-1u |
| `cactus_3` | `ac_desert_rose` | 砂漠のバラ | アクセ | 5 | regen sres:sleep50 ｜ Q: res:fire1.5 |
| `cactus_4` | `w_club_cactus_king` | 大将の針棍棒 | 武器・club | 7 | crit+8 onHit:stun15 ｜ Q: res:wind1.5 |
| `sandworm_1` | `bd_sandworm_hide` | 砂ミミズの革鎧 | 体・軽装 | 1 | hpPct+10 res:earth0.5 ｜ Q: res:wind1.5 |
| `sandworm_2` | `w_greatsword_rockworm` | 岩ミミズの骨剣 | 武器・greatsword | 4 | onHit:stun20 ｜ Q: stat:agi-1u |
| `sandworm_3` | `w_greatsword_duneworm` | 大地ミミズの牙剣 | 武器・greatsword | 7 | boost:earth20 physPct+8 ｜ Q: res:wind1.5 |
| `wolf_1` | `w_fist_greywolf` | 灰色狼の爪 | 武器・fist | 1 | preemptPct+8 crit+5 ｜ Q: res:fire1.5 |
| `wolf_2` | `w_dagger_frostfang` | 霜牙の短剣 | 武器・dagger | 3 | el:water onHit:freeze15 ｜ Q: res:earth1.5 |
| `wolf_3` | `bd_blizzard_fur` | 吹雪の毛皮 | 体・軽装 | 5 | res:water0.5 eva+6 ｜ Q: res:earth1.5 |
| `wolf_4` | `w_katana_moonshadow` | 月影の刀 | 武器・katana | 7 | el:dark crit+12 ｜ Q: res:light1.5 |
| `wolf_5` | `w_greatsword_wolfking` | 狼王の大牙剣 | 武器・greatsword | 8 | el:water crit+10 preemptPct+5 ｜ Q: res:earth1.5 |
| `yeti_1` | `w_fist_yeti` | 雪男の大こぶし | 武器・fist | 1 | physPct+8 res:water0.5 ｜ Q: res:fire1.5 |
| `yeti_2` | `w_axe_icefist` | 氷拳の斧 | 武器・axe | 4 | el:water onHit:freeze15 ｜ Q: res:fire1.5 |
| `yeti_3` | `hd_yeti_skull` | 大雪男の骨面 | 頭・重装 | 7 | atk+8 sres:freeze60 ｜ Q: stat:int-1u |
| `frostling_1` | `w_fist_icicle_child` | こおり小僧の爪 | 武器・fist | 1 | el:water boost:water15 ｜ Q: res:fire1.5 |
| `frostling_2` | `w_dagger_icicle` | つららの短剣 | 武器・dagger | 3 | el:water crit+8 ｜ Q: res:fire1.5 |
| `frostling_3` | `hd_blizzard_hat` | ふぶきの帽子 | 頭・布 | 5 | res:water0 mag+6 ｜ Q: res:fire2 |
| `frostling_4` | `w_katana_snowgeneral` | 雪大将の刀 | 武器・katana | 7 | el:water onHit:freeze15 ｜ Q: res:fire1.5 |
| `frostling_5` | `bd_winter_armor` | 冬将軍の鎧 | 体・重装 | 8 | res:water-1 buff:def+1 ｜ Q: res:fire2 stat:agi-1u |
| `owl_1` | `hd_owl_feather` | 雪フクロウの羽飾り | 頭・軽装 | 1 | hit+8 preemptPct+5 ｜ Q: res:wind1.5 |
| `owl_2` | `ac_lullaby_quill` | 子守歌の羽根 | アクセ | 3 | imm:sleep mpRegen+1 ｜ Q: stat:agi-1u |
| `owl_3` | `hd_spiral_monocle` | まどいの片めがね | 頭・布 | 5 | sres:confuse60 glim:spell15 ｜ Q: res:wind1.5 |
| `owl_4` | `w_staff_owl_sage` | 賢者フクロウの杖 | 武器・staff | 7 | mag+10 glim:wind30 ｜ Q: res:fire1.5 |
| `mammoth_1` | `bd_mammoth_fur` | マンモスの毛皮 | 体・重装 | 1 | hpPct+15 res:water0.5 ｜ Q: stat:agi-1u |
| `mammoth_2` | `w_spear_irontusk` | 鉄牙の大槍 | 武器・spear | 4 | physPct+10 onHit:stun15 ｜ Q: stat:agi-1u |
| `mammoth_3` | `sh_mammoth_king` | 大王の牙盾 | 盾・重装 | 7 | def+15 imm:stun ｜ Q: stat:agi-2u |
| `ghost_1` | `ac_lost_lantern` | 迷い霊のランタン | アクセ | 1 | encounterPct-25 sres:confuse40 ｜ Q: res:light1.5 |
| `ghost_2` | `bd_mourning_veil` | 嘆きの喪服 | 体・布 | 3 | mdef+10 imm:sleep ｜ Q: res:light1.5 |
| `ghost_3` | `w_whip_chain_curse` | 呪い鎖の鞭 | 武器・whip | 5 | el:dark onHit:silence25 ｜ Q: res:light1.5 |
| `ghost_4` | `w_katana_grudge` | 恨み霊の刀 | 武器・katana | 7 | el:dark boost:dark20 ｜ Q: res:light2 hpPct-10 |
| `ghost_5` | `bd_underworld_robe` | 冥王の法衣 | 体・布 | 8 | mag+12 res:dark-1 ｜ Q: res:light2 stat:vit-1u |
| `wisp_1` | `ac_ember_lamp` | 鬼火のカンテラ | アクセ | 1 | boost:fire15 res:fire0.5 ｜ Q: res:water1.5 |
| `wisp_2` | `w_staff_goblinfire` | 化け火の杖 | 武器・staff | 3 | el:fire onHit:confuse15 ｜ Q: res:water1.5 |
| `wisp_3` | `ac_soul_bead` | 人魂の玉 | アクセ | 5 | mpRegen+2 glim:dark25 ｜ Q: hpPct-10 |
| `wisp_4` | `w_bow_yomi` | 黄泉火の弓 | 武器・bow | 7 | el:dark onHit:burn20 ｜ Q: res:light1.5 |
| `frog_1` | `ft_frog_boots` | カエルの水かきぐつ | 足・軽装 | 1 | noFloorDamage eva+6 ｜ Q: res:earth1.5 |
| `frog_2` | `hn_poisonfrog` | 毒ガエルの手袋 | 手・軽装 | 3 | imm:poison glim:whip25 ｜ Q: res:earth1.5 |
| `frog_3` | `w_club_bullfrog` | 大口ガエルの棍 | 武器・club | 5 | hpPct+10 onHit:stun15 ｜ Q: stat:agi-1u |
| `frog_4` | `ac_frog_bell` | 鐘鳴りの首鈴 | アクセ | 7 | imm:stun sres:sleep50 ｜ Q: res:earth1.5 |
| `doll_1` | `hd_porcelain_mask` | 陶器の仮面 | 頭・軽装 | 1 | sres:confuse50 mdef+4 ｜ Q: res:earth1.5 |
| `doll_2` | `ft_dance_shoes` | 踊り人形の靴 | 足・布 | 3 | spd+12 eva+6 ｜ Q: stat:str-1u |
| `doll_3` | `w_dagger_hexpin` | 呪いのまち針 | 武器・dagger | 5 | onHit:silence20 boost:dark15 ｜ Q: res:light1.5 |
| `doll_4` | `sh_lady_parasol` | 貴婦人の日傘 | 盾・布 | 7 | res:light0.5 mdef+10 eva+6 ｜ Q: res:dark1.5 |
| `lizardman_1` | `sh_reed_shield` | 葦の盾 | 盾・軽装 | 1 | eva+8 res:water0.5 ｜ Q: res:earth1.5 |
| `lizardman_2` | `w_spear_marsh` | 沼の銛槍 | 武器・spear | 3 | el:water hit+8 ｜ Q: res:earth1.5 |
| `lizardman_3` | `w_staff_swampcharm` | 沼の呪術杖 | 武器・staff | 5 | boost:water20 healPct+10 ｜ Q: res:earth1.5 |
| `lizardman_4` | `w_axe_chieftain` | 族長の大斧 | 武器・axe | 7 | physPct+10 crit+6 ｜ Q: res:earth1.5 |
| `spider_1` | `hn_silk_gloves` | クモ糸の手袋 | 手・布 | 1 | hit+10 stealPct+25 ｜ Q: res:fire1.5 |
| `spider_2` | `w_whip_spidersilk` | 毒糸の鞭 | 武器・whip | 3 | onHit:poison35 hit+8 ｜ Q: res:fire1.5 |
| `spider_3` | `bd_shadow_silk` | 影糸の衣 | 体・布 | 5 | eva+12 boost:dark15 ｜ Q: res:light1.5 res:fire1.5 |
| `spider_4` | `ac_golden_web` | 金糸の巣飾り | アクセ | 7 | dropPct+50 rarePct+25 ｜ Q: res:fire1.5 |
| `merman_1` | `ft_fin_boots` | 魚人のひれぐつ | 足・軽装 | 1 | spd+8 res:water0.5 ｜ Q: res:earth1.5 |
| `merman_2` | `w_spear_harpoon` | 魚人の大銛 | 武器・spear | 3 | el:water crit+8 ｜ Q: res:earth1.5 |
| `merman_3` | `w_staff_coralwand` | さんごの杖 | 武器・staff | 5 | boost:water20 mpRegen+1 ｜ Q: res:earth1.5 |
| `merman_4` | `w_sword_merknight` | 魚人騎士の剣 | 武器・sword | 7 | el:water def+6 ｜ Q: res:earth1.5 |
| `kraken_1` | `hd_octopus_cap` | タコのずきん | 頭・布 | 1 | sres:blind60 mdef+4 ｜ Q: res:earth1.5 |
| `kraken_2` | `w_whip_eightarm` | 八本腕の鞭 | 武器・whip | 4 | onHit:paralyze20 hit+8 ｜ Q: res:earth1.5 |
| `kraken_3` | `bd_whirlpool` | 渦潮の外套 | 体・布 | 7 | res:water0 eva+8 ｜ Q: res:earth2 |
| `skeleton_1` | `w_sword_cutlass` | 骸骨水夫のカトラス | 武器・sword | 1 | crit+6 hit+5 ｜ Q: res:light1.5 |
| `skeleton_2` | `ac_pirate_coin` | 呪われた金貨 | アクセ | 3 | goldPct+75 ｜ Q: hpPct-10 res:light1.5 |
| `skeleton_3` | `w_bow_cannon_arm` | 骸骨砲手の大弓 | 武器・bow | 5 | el:fire physPct+10 ｜ Q: stat:agi-1u |
| `skeleton_4` | `ac_ghost_compass` | 亡霊の羅針盤 | アクセ | 7 | rareEncPct+50 escapePct+25 ｜ Q: res:light1.5 |
| `skeleton_5` | `w_sword_admiral` | 提督の金剣 | 武器・sword | 8 | crit+10 buff:atk+1 ｜ Q: res:light2 |
| `golem_1` | `sh_rubble` | 石くれの大盾 | 盾・重装 | 1 | def+10 sres:stun50 ｜ Q: stat:agi-1u |
| `golem_2` | `w_club_ironore` | 鉄鉱の大槌 | 武器・club | 4 | onHit:stun20 physPct+8 ｜ Q: stat:agi-1u |
| `golem_3` | `bd_gem_plate` | 宝玉のよろい | 体・重装 | 7 | res:fire0.5 res:water0.5 mdef+10 ｜ Q: stat:agi-2u |
| `mole_1` | `hn_digger` | 穴掘りの手甲 | 手・軽装 | 1 | atk+4 noFloorDamage ｜ Q: res:wind1.5 |
| `mole_2` | `w_fist_ironclaw` | 鉄爪 | 武器・fist | 3 | crit+8 hit+5 ｜ Q: res:wind1.5 |
| `mole_3` | `ac_blasting_cap` | 発破の火打ち石 | アクセ | 5 | itemPct+30 boost:fire15 ｜ Q: res:fire1.5 |
| `mole_4` | `w_axe_mole_boss` | 大親方のつるはし | 武器・axe | 7 | crit+8 onHit:stun15 ｜ Q: res:wind1.5 |
| `beetle_1` | `hd_beetle_horn` | カブトの角かぶと | 頭・重装 | 1 | crit+6 def+4 ｜ Q: res:fire1.5 |
| `beetle_2` | `sh_beetle_shell` | 鉄カブトの殻盾 | 盾・重装 | 3 | def+8 res:earth0.5 ｜ Q: res:fire1.5 |
| `beetle_3` | `w_spear_sparkhorn` | 火花角の槍 | 武器・spear | 5 | el:fire onHit:burn20 ｜ Q: res:water1.5 |
| `beetle_4` | `bd_diamond_shell` | 金剛の甲殻 | 体・重装 | 7 | def+20 res:earth0.5 ｜ Q: stat:agi-2u mdef-50% |
| `crystal_1` | `ac_quartz_shard` | 水晶のかけら | アクセ | 1 | boost:light15 mdef+4 ｜ Q: res:dark1.5 |
| `crystal_2` | `w_staff_ruby` | 紅水晶の杖 | 武器・staff | 3 | el:fire boost:fire20 ｜ Q: res:water1.5 |
| `crystal_3` | `hd_sapphire` | 青水晶の額飾り | 頭・布 | 5 | mag+6 res:water0.5 ｜ Q: res:earth1.5 |
| `crystal_4` | `ac_amethyst` | 紫水晶の耳飾り | アクセ | 7 | mpRegen+2 boost:dark20 ｜ Q: res:light1.5 |
| `goblin_1` | `w_club_goblin` | 小鬼のこん棒 | 武器・club | 1 | crit+6 goldPct+20 ｜ Q: stat:int-1u |
| `goblin_2` | `w_axe_goblin` | 小鬼の手斧 | 武器・axe | 3 | crit+8 physPct+5 ｜ Q: stat:mnd-1u |
| `goblin_3` | `ac_powder_pouch` | 火薬師の小袋 | アクセ | 5 | itemPct+25 boost:fire20 ｜ Q: hpPct-10 |
| `goblin_4` | `w_sword_goblincaptain` | 小鬼の隊長の剣 | 武器・sword | 7 | buff:atk+1 sres:confuse50 ｜ Q: stat:int-1u |
| `goblin_5` | `ac_goblin_crown` | 小鬼の王冠 | アクセ | 8 | goldPct+100 dropPct+25 ｜ Q: stat:mnd-1u stat:int-1u |
| `salamander_1` | `ft_salamander` | 火トカゲのくつ | 足・軽装 | 1 | res:fire0.5 noFloorDamage ｜ Q: res:water1.5 |
| `salamander_2` | `w_bow_firebreath` | 火吹きの弓 | 武器・bow | 3 | el:fire boost:fire15 ｜ Q: res:water1.5 |
| `salamander_3` | `bd_lava_scale` | 溶岩のうろこ鎧 | 体・重装 | 5 | res:fire-1 def+8 ｜ Q: res:water2 |
| `salamander_4` | `w_spear_flamehorn` | 炎角の槍 | 武器・spear | 7 | el:fire crit+10 ｜ Q: res:water1.5 |
| `salamander_5` | `w_greatsword_dragonking` | 竜王トカゲの大剣 | 武器・greatsword | 8 | el:fire boost:fire20 ｜ Q: res:water2 |
| `imp_1` | `w_spear_soot_fork` | すす悪魔の三叉 | 武器・spear | 1 | crit+6 onHit:blind15 ｜ Q: res:light1.5 |
| `imp_2` | `ac_ember_horn` | 火の粉の角笛 | アクセ | 3 | boost:fire20 glim:fire25 ｜ Q: res:water1.5 |
| `imp_3` | `bd_ash_cloak_devil` | 灰悪魔の外套 | 体・布 | 5 | eva+10 sres:blind60 ｜ Q: res:light1.5 |
| `imp_4` | `w_staff_hellfire` | 業火の杖 | 武器・staff | 7 | el:fire boost:fire25 ｜ Q: res:water1.5 mpCostPct+15 |
| `imp_5` | `hd_strategist` | 軍師の帽子 | 頭・布 | 8 | mag+10 buff:mag+1 ｜ Q: res:light1.5 stat:vit-1u |
| `gargoyle_1` | `hd_gargoyle_face` | 石像鬼の面 | 頭・重装 | 1 | def+6 sres:paralyze50 ｜ Q: res:wind1.5 |
| `gargoyle_2` | `w_dagger_obsidian` | 黒曜の短剣 | 武器・dagger | 3 | crit+12 ｜ Q: stat:vit-1u |
| `gargoyle_3` | `sh_lava_gargoyle` | 火炎石の盾 | 盾・重装 | 5 | res:fire0.5 def+8 ｜ Q: res:water1.5 |
| `gargoyle_4` | `w_axe_gargoyle` | 石像鬼の大斧 | 武器・axe | 7 | onHit:paralyze15 physPct+8 ｜ Q: stat:agi-1u |
| `orc_1` | `w_club_wasteland` | 大鬼の丸太 | 武器・club | 1 | physPct+10 ｜ Q: twoHanded stat:dex-1u |
| `orc_2` | `w_club_kanabo` | 鬼の金棒 | 武器・club | 4 | crit+10 onHit:stun20 ｜ Q: stat:agi-1u |
| `orc_3` | `bd_oni_armor` | 鬼の頭目の鎧 | 体・重装 | 7 | atk+10 hpPct+10 ｜ Q: stat:agi-1u res:water1.5 |
| `chimera_1` | `hn_chimera_paw` | まだら獣の籠手 | 手・軽装 | 1 | crit+8 atk+4 ｜ Q: res:fire1.5 |
| `chimera_2` | `w_fist_triple_fang` | 三つ牙の爪 | 武器・fist | 4 | el:fire crit+8 ｜ Q: res:water1.5 |
| `chimera_3` | `bd_chimera_hide` | 業火の獣皮 | 体・軽装 | 7 | res:fire-1 hpPct+10 ｜ Q: res:water2 |
| `eyeball_1` | `ac_peeping_eye` | のぞき目玉の護符 | アクセ | 1 | preemptPct+10 hit+6 ｜ Q: res:light1.5 |
| `eyeball_2` | `hd_glare_band` | にらみの鉢巻き | 頭・軽装 | 3 | sres:paralyze60 crit+5 ｜ Q: res:light1.5 |
| `eyeball_3` | `ac_mind_eye` | 心眼の玉 | アクセ | 5 | imm:confuse glim:tech20 ｜ Q: hpPct-10 |
| `eyeball_4` | `w_bow_stargazer` | 星見の弓 | 武器・bow | 7 | el:light hit+10 ｜ Q: res:dark1.5 |
| `eyeball_5` | `hd_heaven_eye` | 天眼の冠 | 頭・布 | 8 | boost:light25 mag+10 ｜ Q: res:dark2 |
| `darkmage_1` | `w_staff_apprentice` | 見習いの杖 | 武器・staff | 1 | mpCostPct-15 glim:spell15 ｜ Q: stat:vit-1u |
| `darkmage_2` | `bd_flame_robe` | 炎術師の法衣 | 体・布 | 3 | boost:fire25 mag+6 ｜ Q: res:water1.5 |
| `darkmage_3` | `ft_wind_sandals` | 風術師のサンダル | 足・布 | 5 | spd+12 boost:wind20 ｜ Q: res:fire1.5 |
| `darkmage_4` | `w_staff_abyss` | 深淵の杖 | 武器・staff | 7 | boost:dark25 mag+8 ｜ Q: res:light1.5 hpPct-10 |
| `automaton_1` | `hn_gear_gauntlet` | 歯車の籠手 | 手・重装 | 1 | hit+8 def+5 ｜ Q: res:water1.5 |
| `automaton_2` | `w_bow_clockwork` | からくり弓 | 武器・bow | 3 | hit+15 crit+6 ｜ Q: stat:agi-1u |
| `automaton_3` | `ac_tesla_coil` | 雷のぜんまい | アクセ | 5 | boost:wind20 mpRegen+1 ｜ Q: res:water1.5 |
| `automaton_4` | `w_katana_clockwork` | からくり大将の刀 | 武器・katana | 7 | crit+10 buff:agi+1 ｜ Q: res:water1.5 |
| `armor_1` | `bd_hollow_mail` | からっぽの鎧 | 体・重装 | 1 | def+10 imm:confuse ｜ Q: stat:agi-1u |
| `armor_2` | `sh_sentinel` | 番兵の大盾 | 盾・重装 | 3 | def+10 sres:stun50 ｜ Q: stat:agi-1u |
| `armor_3` | `w_sword_knightless` | 主なき騎士剣 | 武器・sword | 5 | crit+8 def+6 ｜ Q: res:water1.5 |
| `armor_4` | `w_greatsword_blackgold` | 黒金の大剣 | 武器・greatsword | 7 | el:dark physPct+12 ｜ Q: res:light1.5 stat:agi-1u |
| `wyvern_1` | `hd_wyvern_crest` | 若飛竜の兜 | 頭・重装 | 1 | res:wind0.5 spd+6 ｜ Q: res:fire1.5 |
| `wyvern_2` | `w_spear_windcutter` | 風切りの竜槍 | 武器・spear | 4 | el:wind crit+10 ｜ Q: res:fire1.5 |
| `wyvern_3` | `bd_storm_scale` | 嵐竜のうろこ鎧 | 体・重装 | 7 | res:wind0 imm:paralyze ｜ Q: res:fire2 |
| `scribe_1` | `w_dagger_penknife` | 書記の小刀 | 武器・dagger | 8 | onHit:silence25 crit+8 ｜ Q: res:dark1.5 |
| `scribe_2` | `sh_copy_book` | 写本師の書 | 盾・布 | 8 | mag+12 glim:spell25 ｜ Q: res:dark1.5 |
| `scribe_3` | `w_staff_librarian` | 司書長の銀杖 | 武器・staff | 8 | mag+12 mpCostPct-20 ｜ Q: res:dark2 |
| `book_1` | `sh_biting_tome` | かみつく書 | 盾・布 | 8 | mag+10 def+6 ｜ Q: res:fire1.5 |
| `book_2` | `ac_cursed_bookmark` | 呪いのしおり | アクセ | 8 | boost:dark25 glim:dark30 ｜ Q: hpPct-15 |
| `book_3` | `ac_blank_book` | 白紙の古書 | アクセ | 8 | imm:silence glim:spell30 ｜ Q: res:dark2 res:fire1.5 |
| `mimic_1` | `ac_treasure_nose` | 宝物さがしの鼻飾り | アクセ | 1 | rarePct+50 superPct+25 ｜ Q: hpPct-15 |
| `mimic_2` | `hn_greedy_hand` | 欲ばりの手袋 | 手・布 | 3 | dropPct+75 stealPct+50 ｜ Q: def-50% |
| `mimic_3` | `ac_cursed_lock` | 呪いの錠前 | アクセ | 5 | superPct+75 ｜ Q: stat:agi-1u hpPct-10 |
| `mimic_4` | `ac_abyss_hoard` | 奈落の財宝 | アクセ | 7 | goldPct+100 rarePct+50 ｜ Q: res:light1.5 hpPct-10 |
| `void_1` | `w_sword_void` | 虚無の剣 | 武器・sword | 9 | el:dark crit+12 physPct+10 ｜ Q: res:light2 |
| `void_2` | `sh_void_aegis` | 虚無の大盾 | 盾・重装 | 9 | res:dark-1 res:light0.5 def+20 ｜ Q: stat:agi-2u |
| `chaos_1` | `w_axe_chaos` | 混沌の大斧 | 武器・axe | 9 | crit+12 physPct+12 ｜ Q: stat:dex-2u |
| `chaos_2` | `bd_chaos_hide` | 混沌の獣皮 | 体・重装 | 9 | res:fire0.5 res:water0.5 res:wind0.5 res:earth0.5 ｜ Q: res:light1.5 stat:agi-2u |
| `demon_1` | `w_fist_demon_claw` | 魔兵の爪 | 武器・fist | 8 | el:dark crit+10 ｜ Q: res:light1.5 |
| `demon_2` | `hd_demon_general` | 魔将の角かぶと | 頭・重装 | 9 | atk+12 imm:stun ｜ Q: res:light2 |
| `demon_3` | `ac_demon_eye` | 魔神の第三の眼 | アクセ | 9 | boost:dark30 boost:fire20 mag+10 ｜ Q: res:light2 hpPct-10 |
| `quicksilver_1` | `ac_quicksilver` | 白銀の涙 | アクセ | 3 | expPct+50 escapePct+25 ｜ Q: hpPct-10 |
| `quicksilver_2` | `w_whip_quicksilver` | 白銀の流れ鞭 | 武器・whip | 7 | hit+15 crit+10 metalHit ｜ Q: stat:str-1u |
| `mirror_1` | `sh_mirror_shell` | 鏡の殻盾 | 盾・重装 | 6 | res:light0.5 res:dark0.5 mdef+12 ｜ Q: stat:agi-1u |
| `mirror_2` | `w_spear_mirrorhorn` | 鏡角の槍 | 武器・spear | 8 | crit+15 metalHit ｜ Q: res:dark1.5 |
| `platinum_1` | `ac_platinum_heart` | 白金の心 | アクセ | 8 | expPct+75 glim:tech15 glim:spell15 ｜ Q: hpPct-15 |
| `platinum_2` | `w_katana_platinum` | 白金の太刀 | 武器・katana | 9 | crit+15 metalHit hit+10 ｜ Q: res:dark1.5 |
| `rm_jewel_hare` | `ac_moon_hare` | うさぎの月長石 | アクセ | 2 | rareEncPct+50 goldenPct+50 ｜ Q: stat:vit-1u |
| `rm_bloom_fawn` | `ac_forest_crown` | 森の小さな冠 | アクセ | 6 | healPct+25 prof:light50 ｜ Q: res:fire1.5 |
| `rm_glass_moth` | `ac_stained_wing` | ステンドの羽 | アクセ | 6 | boost:fire15 boost:water15 boost:wind15 boost:earth15 ｜ Q: hpPct-15 |
| `rm_acorn_prince` | `ac_prince_badge` | どんぐり王子の紋章 | アクセ | 6 | dropPct+50 goldPct+50 ｜ Q: stat:agi-1u |
| `rm_diamond_lizard` | `ac_diamond_heart` | 金剛トカゲの心臓石 | アクセ | 6 | imm:stun imm:paralyze def+15 ｜ Q: stat:agi-1u |
| `rm_gold_idol` | `ac_idol_halo` | 黄金の光輪 | アクセ | 6 | goldPct+100 superPct+50 ｜ Q: hpPct-15 |
| `rm_aurora_bird` | `ac_aurora_orb` | 極光の宝珠 | アクセ | 6 | mag+12 glim:spell30 ｜ Q: res:earth1.5 |
| `rm_icetail_fox` | `ac_icefox_mask` | 氷ギツネの面 | アクセ | 6 | imm:confuse imm:freeze crit+10 ｜ Q: res:fire1.5 |
| `rm_lotus_sprite` | `ac_mud_pearl` | 泥中の真珠 | アクセ | 6 | regen mpRegen+2 ｜ Q: res:earth1.5 |
| `rm_ghost_teapot` | `ac_teapot_lid` | 茶器のふた | アクセ | 6 | itemPct+50 healPct+20 ｜ Q: stat:str-1u |
| `rm_bell_snail` | `ac_seven_bells` | 七つ鐘の首飾り | アクセ | 6 | imm:sleep imm:confuse imm:stun mdef+10 ｜ Q: stat:agi-1u |
| `rm_star_whale` | `ac_skywhale_shell` | 空くじらの歌貝 | アクセ | 6 | expPct+30 rareEncPct+75 ｜ Q: hpPct-10 |
| `rm_treasure_crab` | `ac_treasure_map` | 財宝の地図 | アクセ | 6 | dropPct+75 rarePct+50 ｜ Q: hpPct-15 |
| `rm_gem_hedgehog` | `ac_hedgehog_crown` | 宝石ハリネズミの冠 | アクセ | 6 | crit+15 rarePct+25 ｜ Q: stat:vit-1u |
| `rm_prisma` | `ac_prism_heart` | 虹晶の心 | アクセ | 6 | boost:fire15 boost:water15 boost:wind15 boost:earth15 boost:light15 boost:dark15 ｜ Q: hpPct-15 |
| `rm_spa_monkey` | `ac_monkey_bucket` | 猿の湯おけ | アクセ | 6 | regen walkHeal:2 hpPct+10 ｜ Q: stat:agi-1u |
| `rm_volcano_turtle` | `ac_volcano_heart` | 火山ガメの心石 | アクセ | 6 | res:fire-1 boost:fire25 ｜ Q: res:water1.5 |
| `rm_moon_sheep` | `ac_crescent_horn` | 三日月の角 | アクセ | 6 | mag+12 healPct+20 ｜ Q: res:dark1.5 |
| `rm_clock_bird` | `ac_perpetual_gear` | 止まらない歯車 | アクセ | 6 | wpRegen+2 buff:agi+1 ｜ Q: hpPct-10 |
| `rm_bookworm` | `ac_scholar_monocle` | 学者の片めがね | アクセ | 8 | expPct+50 glim:spell30 ｜ Q: stat:vit-1u |
| `rm_golden_quill` | `w_staff_goldquill` | 黄金の羽ペン杖 | 武器・staff | 8 | mag+15 glim:spell30 mpCostPct-15 ｜ Q: stat:str-1u |
| `rm_memory_fish` | `sh_memory_bowl` | 記憶の金魚鉢 | 盾・布 | 9 | mag+15 imm:silence imm:sleep ｜ Q: defHalf |
| `rm_dream_tapir` | `w_katana_dreamcut` | 夢断ちの太刀 | 武器・katana | 9 | crit+15 onHit:sleep20 physPct+10 ｜ Q: hpPct-15 |
| `b_valzard_echo` | `w_sword_echo` | 残影の魔剣 | 武器・sword | 9 | el:dark crit+15 physPct+15 ｜ Q: res:light2 hpPct-10 |
| `b_ouroboros` | `w_greatsword_ouroboros` | 円環竜の大剣 | 武器・greatsword | 9 | crit+15 physPct+15 wpRegen+3 ｜ Q: stat:agi-2u |

### 12.5 レア品（134）
| レア品 id | 名前 | 種別 | T | 特殊効果 | 落とす魔物 |
|---|---|---|---|---|---|
| `ac_jelly_ring` | ゼリーの指輪 | アクセ | 1 | hpPct+5 | `jelly_1` |
| `sh_bubble` | 泡の盾 | 盾・布 | 3 | res:water0.5 | `jelly_2` |
| `hn_jelly_glove` | ゼリーの手袋 | 手・布 | 5 | sres:poison40 | `jelly_3` |
| `hd_jelly_helm` | ゼリーのかぶと | 頭・重装 | 7 | hpPct+8 | `jelly_4` |
| `ac_rainbow_drop` | 虹のしずく | アクセ | 8 | res:fire0.75 res:water0.75 res:wind0.75 res:earth0.75 | `jelly_5` |
| `ft_rat_sandal` | ネズミ革のサンダル | 足・軽装 | 1 | eva+4 | `rat_1` |
| `hn_rat_claw` | ネズミのかぎ爪 | 手・軽装 | 3 | stealPct+25 | `rat_2` |
| `w_club_rat` | 鉄歯の棍棒 | 武器・club | 5 | crit+6 | `rat_3` |
| `hd_rat_bandana` | 頭領のバンダナ | 頭・軽装 | 7 | goldPct+25 | `rat_4` |
| `ac_bat_fang` | コウモリの牙飾り | アクセ | 1 | escapePct+25 | `bat_1` |
| `w_dagger_bloodbat` | 血吸いの短剣 | 武器・dagger | 3 | crit+8 | `bat_2` |
| `hd_sonic_band` | 音波の鉢巻き | 頭・軽装 | 5 | sres:confuse40 | `bat_3` |
| `bd_night_cloak` | 夜の外套 | 体・布 | 7 | res:dark0.5 | `bat_4` |
| `ac_count_brooch` | 夜公爵のブローチ | アクセ | 8 | regen | `bat_5` |
| `ac_blank_page` | 白紙の一枚 | アクセ | 3 | sres:silence40 | `paper_1` |
| `bd_blank_coat` | 白紙の外套 | 体・布 | 5 | sres:silence40 | `paper_2` |
| `sh_blank_shield` | 白紙の盾 | 盾・重装 | 7 | sres:silence50 | `paper_3` |
| `w_greatsword_blank` | 白紙の刃 | 武器・greatsword | 8 | onHit:silence20 | `paper_4` |
| `sh_crab_shell` | カニの甲羅盾 | 盾・重装 | 1 | def+4 | `crab_1` |
| `bd_crab_plate` | 甲羅の胸当て | 体・重装 | 3 | res:water0.5 | `crab_2` |
| `hd_foam_cap` | 泡の帽子 | 頭・布 | 5 | res:water0.5 | `crab_3` |
| `sh_castle_shell` | 城ガニの盾 | 盾・重装 | 7 | def+10 | `crab_4` |
| `ac_gull_feather` | カモメの羽根飾り | アクセ | 1 | spd+6 | `seabird_1` |
| `w_bow_gull` | カモメの弓 | 武器・bow | 3 | el:wind | `seabird_2` |
| `hd_thief_bandana` | 盗人のバンダナ | 頭・軽装 | 5 | stealPct+30 | `seabird_3` |
| `bd_gull_robe` | 潮風の羽衣 | 体・布 | 7 | res:wind0.5 | `seabird_4` |
| `w_bow_leaf` | 木の葉の弓 | 武器・bow | 1 | hit+8 | `bee_1` `plant_1` `fairy_1` |
| `w_staff_sprout` | 芽吹きの杖 | 武器・staff | 3 | healPct+10 | `bee_2` `mushroom_2` `plant_2` |
| `bd_leaf_mail` | 葉の鎧 | 体・軽装 | 5 | res:earth0.5 | `bee_3` `plant_3` `treant_3` |
| `w_spear_hornet` | 大バチの槍 | 武器・spear | 7 | onHit:poison30 | `bee_4` `plant_4` `treant_4` |
| `ac_millennium_seed` | 千年の種 | アクセ | 8 | hpPct+10 | `bee_5` `plant_5` |
| `hd_mushroom_cap` | キノコの帽子 | 頭・布 | 1 | sres:sleep30 | `mushroom_1` `treant_1` |
| `ac_fairy_dust` | 妖精の粉袋 | アクセ | 5 | mpRegen+1 | `mushroom_3` `fairy_3` |
| `hd_fairy_circlet` | 妖精の冠 | 頭・布 | 7 | healPct+15 | `mushroom_4` `fairy_4` |
| `ac_honey_charm` | 蜂蜜のお守り | アクセ | 3 | regen | `fairy_2` `treant_2` |
| `w_dagger_scorpion` | サソリの小刀 | 武器・dagger | 1 | onHit:poison25 | `scorpion_1` `snake_1` `sandworm_1` |
| `w_whip_snakeskin` | 蛇皮の鞭 | 武器・whip | 3 | onHit:poison25 | `scorpion_2` `snake_2` |
| `sh_scorpion_shell` | サソリの甲羅盾 | 盾・重装 | 5 | sres:poison40 | `scorpion_3` `snake_3` `cactus_3` |
| `w_katana_sand` | 砂塵の刀 | 武器・katana | 7 | el:earth | `scorpion_4` `snake_4` `cactus_4` |
| `ac_royal_ankh` | 王家の護符 | アクセ | 8 | imm:death | `scorpion_5` `mummy_5` |
| `bd_wrap_cloth` | 砂よけの布 | 体・布 | 1 | sres:blind30 | `mummy_1` `cactus_1` |
| `hn_curse_wrap` | 呪い布の手甲 | 手・布 | 3 | glim:dark20 | `mummy_2` `cactus_2` |
| `w_staff_tombpriest` | 墓守の杖 | 武器・staff | 5 | boost:dark15 | `mummy_3` |
| `ac_scarab` | 聖甲虫の護符 | アクセ | 7 | imm:death | `mummy_4` |
| `w_fist_wormtooth` | 大ミミズの牙爪 | 武器・fist | 4 | crit+6 | `sandworm_2` `kraken_2` `golem_2` |
| `w_axe_dune` | 大地の斧 | 武器・axe | 7 | el:earth | `sandworm_3` |
| `bd_wolf_pelt` | 狼の毛皮 | 体・軽装 | 1 | res:water0.75 | `wolf_1` `yeti_1` `owl_1` |
| `w_dagger_frost` | 霜の短剣 | 武器・dagger | 3 | el:water | `wolf_2` `frostling_2` `owl_2` |
| `ac_blizzard_charm` | 吹雪のお守り | アクセ | 5 | res:water0.5 | `wolf_3` `frostling_3` `owl_3` |
| `w_katana_moon` | 月の刀 | 武器・katana | 7 | el:dark | `wolf_4` `frostling_4` `owl_4` |
| `w_fist_wolfking` | 狼王の牙爪 | 武器・fist | 8 | crit+10 | `wolf_5` `frostling_5` |
| `w_greatsword_beastfang` | 大獣の牙剣 | 武器・greatsword | 4 | physPct+8 | `yeti_2` `mammoth_2` `orc_2` |
| `hd_yeti_fur` | 雪男の毛帽 | 頭・軽装 | 7 | res:water0.5 | `yeti_3` `mammoth_3` |
| `ac_snow_crystal` | 雪の結晶 | アクセ | 1 | sres:freeze30 | `frostling_1` `mammoth_1` |
| `hd_mist_hood` | 霧のずきん | 頭・布 | 1 | sres:confuse30 | `ghost_1` `wisp_1` `doll_1` |
| `w_whip_mist` | 霧の鞭 | 武器・whip | 3 | onHit:blind20 | `ghost_2` `wisp_2` `doll_2` |
| `sh_bell_shield` | 鐘の盾 | 盾・重装 | 5 | sres:sleep40 | `ghost_3` `wisp_3` `doll_3` |
| `w_sword_bellringer` | 鐘つきの剣 | 武器・sword | 7 | onHit:stun15 | `ghost_4` `wisp_4` `frog_4` |
| `ac_underworld_bell` | 冥界の鈴 | アクセ | 8 | res:dark0.5 | `ghost_5` |
| `bd_marsh_coat` | 沼の雨よけ | 体・軽装 | 1 | sres:poison30 | `frog_1` `lizardman_1` `spider_1` |
| `w_spear_reed` | 葦の槍 | 武器・spear | 3 | hit+8 | `frog_2` `lizardman_2` `spider_2` |
| `bd_bog_mail` | 沼の鎖かたびら | 体・重装 | 5 | sres:paralyze40 | `frog_3` `lizardman_3` `spider_3` |
| `ac_soul_candle` | 魂のろうそく | アクセ | 7 | res:dark0.5 | `doll_4` `lizardman_4` `spider_4` |
| `w_spear_coral` | さんごの槍 | 武器・spear | 1 | el:water | `merman_1` `kraken_1` `skeleton_1` |
| `sh_tide_shield` | 潮の盾 | 盾・軽装 | 3 | res:water0.5 | `merman_2` `skeleton_2` |
| `ac_pearl_ear` | 真珠の耳飾り | アクセ | 5 | mdef+6 | `merman_3` `skeleton_3` |
| `w_katana_tide` | 潮の刀 | 武器・katana | 7 | el:water | `merman_4` `kraken_3` `skeleton_4` |
| `ac_admiral_medal` | 提督の勲章 | アクセ | 8 | buff:atk+1 | `skeleton_5` |
| `sh_ore_shield` | 鉱石の盾 | 盾・重装 | 1 | sres:stun30 | `golem_1` `beetle_1` `crystal_1` |
| `ac_gem_core` | 宝玉の核 | アクセ | 7 | mdef+8 | `golem_3` `crystal_4` |
| `hn_mole_claw` | モグラの爪 | 手・軽装 | 1 | crit+5 | `mole_1` `goblin_1` |
| `w_axe_pick` | 鉱夫のつるはし | 武器・axe | 3 | crit+6 | `mole_2` `beetle_2` `goblin_2` |
| `ac_gem_eye` | 宝石の目 | アクセ | 5 | hit+8 | `mole_3` `beetle_3` `goblin_3` |
| `w_club_forgehammer` | 鍛冶場の大槌 | 武器・club | 7 | physPct+8 | `mole_4` `beetle_4` `goblin_4` |
| `ac_ruby_chip` | 紅水晶のかけら | アクセ | 3 | boost:fire15 | `crystal_2` |
| `ac_sapphire_chip` | 青水晶のかけら | アクセ | 5 | boost:water15 | `crystal_3` |
| `ac_goblin_hoard` | 小鬼の財宝袋 | アクセ | 8 | goldPct+50 | `goblin_5` |
| `hd_ash_mask` | 灰よけの面 | 頭・軽装 | 1 | sres:blind30 | `salamander_1` `imp_1` `gargoyle_1` |
| `w_axe_ember` | 残り火の斧 | 武器・axe | 3 | el:fire | `salamander_2` `imp_2` `gargoyle_2` |
| `bd_ash_cloak` | 灰の外套 | 体・布 | 5 | res:fire0.5 | `salamander_3` `imp_3` `gargoyle_3` |
| `w_katana_ash` | 灰かぶりの刀 | 武器・katana | 7 | el:fire | `salamander_4` `imp_4` `gargoyle_4` |
| `ac_phoenix_ash` | 火の鳥の灰 | アクセ | 8 | boost:fire20 | `salamander_5` `imp_5` |
| `w_club_ashen` | 灰の棍棒 | 武器・club | 1 | onHit:stun15 | `orc_1` `chimera_1` |
| `w_fist_brimstone` | 硫黄の拳 | 武器・fist | 7 | el:fire | `orc_3` `chimera_3` |
| `sh_wyvern_scale` | 飛竜のうろこ盾 | 盾・重装 | 4 | res:wind0.5 | `chimera_2` `wyvern_2` |
| `hd_star_hood` | 星見のずきん | 頭・布 | 1 | glim:spell10 | `eyeball_1` `darkmage_1` `automaton_1` |
| `w_bow_star` | 星明かりの弓 | 武器・bow | 3 | hit+10 | `eyeball_2` `darkmage_2` `automaton_2` |
| `ac_astrolabe` | 小さな天球儀 | アクセ | 5 | glim:spell15 | `eyeball_3` `darkmage_3` `automaton_3` |
| `w_sword_starblade` | 星の剣 | 武器・sword | 7 | el:light | `eyeball_4` `darkmage_4` `automaton_4` |
| `ac_heaven_feather` | 天の羽根 | アクセ | 8 | res:light0.5 | `eyeball_5` |
| `sh_star_buckler` | 星の小盾 | 盾・軽装 | 1 | mdef+4 | `armor_1` `wyvern_1` |
| `hd_sentry_helm` | 番兵のかぶと | 頭・重装 | 3 | sres:stun30 | `armor_2` |
| `bd_knight_mail` | 騎士の古鎧 | 体・重装 | 5 | def+8 | `armor_3` |
| `hd_blackgold_helm` | 黒金のかぶと | 頭・重装 | 7 | sres:stun50 | `armor_4` `wyvern_3` |
| `hd_scribe_hood` | 書記の頭巾 | 頭・布 | 8 | sres:silence50 | `scribe_1` `book_1` |
| `bd_scribe_coat` | 記録院の白衣 | 体・布 | 8 | mdef+10 | `scribe_2` `book_2` |
| `ac_archive_key` | 書庫の鍵 | アクセ | 8 | glim:spell20 | `scribe_3` `book_3` `demon_1` |
| `ac_mimic_tongue` | 宝箱の舌 | アクセ | 1 | goldPct+25 | `mimic_1` |
| `ac_mimic_key` | 宝箱の合い鍵 | アクセ | 3 | dropPct+25 | `mimic_2` |
| `ac_mimic_chain` | 呪い宝箱の鎖 | アクセ | 5 | rarePct+25 | `mimic_3` |
| `ac_abyss_key` | 奈落の鍵 | アクセ | 7 | rarePct+30 | `mimic_4` |
| `ac_void_shard` | 虚無のかけら | アクセ | 9 | res:dark0.5 | `void_1` `void_2` `demon_2` |
| `w_greatsword_chaoshorn` | 混沌の角剣 | 武器・greatsword | 9 | physPct+10 | `chaos_1` `chaos_2` `demon_3` |
| `ac_silver_drop` | 白銀のひとしずく | アクセ | 3 | expPct+15 | `quicksilver_1` |
| `ac_silver_orb` | 白銀の玉 | アクセ | 7 | expPct+20 | `quicksilver_2` |
| `ac_mirror_scale` | 鏡のうろこ | アクセ | 6 | res:light0.5 | `mirror_1` |
| `ac_mirror_crest` | 鏡の紋章 | アクセ | 8 | mdef+10 | `mirror_2` |
| `ac_platinum_flame` | 白金の炎 | アクセ | 8 | expPct+25 | `platinum_1` |
| `ac_platinum_crown` | 白金の灯冠 | アクセ | 9 | expPct+30 | `platinum_2` |
| `ac_hare_charm` | 宝石ウサギのお守り | アクセ | 1 | escapePct+50 preemptPct+10 | `rm_jewel_hare` |
| `ac_bloom_antler` | 花角の髪飾り | アクセ | 4 | regen | `rm_bloom_fawn` |
| `ac_glass_wing` | ガラスの羽 | アクセ | 4 | eva+10 sres:blind50 | `rm_glass_moth` |
| `ac_acorn_cap` | どんぐりの帽子飾り | アクセ | 4 | hpPct+15 | `rm_acorn_prince` |
| `ac_diamond_scale` | 金剛のうろこ | アクセ | 4 | def+10 | `rm_diamond_lizard` |
| `ac_idol_jade` | 守護像のひすい | アクセ | 4 | mdef+10 sres:silence30 | `rm_gold_idol` |
| `ac_aurora_plume` | オーロラの羽飾り | アクセ | 4 | mpRegen+2 | `rm_aurora_bird` |
| `ac_icetail` | 氷尾の毛飾り | アクセ | 4 | res:water0.5 eva+8 | `rm_icetail_fox` |
| `ac_lotus_bloom` | はすの花飾り | アクセ | 4 | imm:poison healPct+15 | `rm_lotus_sprite` |
| `ac_teacup` | 幽霊のティーカップ | アクセ | 4 | itemPct+30 | `rm_ghost_teapot` |
| `ac_snail_shell` | 鐘の殻 | アクセ | 4 | imm:sleep imm:confuse | `rm_bell_snail` |
| `ac_star_ambergris` | 星の香玉 | アクセ | 4 | rareEncPct+25 goldenPct+25 | `rm_star_whale` |
| `ac_pirate_goblet` | 海賊の杯 | アクセ | 4 | goldPct+50 | `rm_treasure_crab` |
| `ac_gem_brooch` | 宝石針のブローチ | アクセ | 4 | crit+10 | `rm_gem_hedgehog` |
| `ac_prism_ring` | 虹晶の指輪 | アクセ | 4 | res:fire0.75 res:water0.75 res:wind0.75 res:earth0.75 res:light0.75 res:dark0.75 | `rm_prisma` |
| `ac_spa_towel` | 湯けむりの手ぬぐい | アクセ | 4 | regen | `rm_spa_monkey` |
| `ac_turtle_shell` | 火山ガメの甲羅片 | アクセ | 4 | res:fire0.5 def+8 | `rm_volcano_turtle` |
| `ac_moon_bell` | 月見の鈴 | アクセ | 4 | imm:sleep mpRegen+1 | `rm_moon_sheep` |
| `ac_clock_feather` | 歯車の羽根 | アクセ | 4 | spd+12 preemptPct+5 | `rm_clock_bird` |
| `ac_worm_spectacles` | 本の虫のめがね | アクセ | 8 | glim:spell25 glim:tech25 | `rm_bookworm` |
| `ac_golden_nib` | 黄金のペン先 | アクセ | 8 | mag+10 mpCostPct-15 | `rm_golden_quill` |
| `ac_goldfish_scale` | 金魚のうろこ | アクセ | 9 | res:water0 mpRegen+2 | `rm_memory_fish` |
| `ac_dream_pillow` | 夢見のまくら | アクセ | 9 | imm:sleep regen mpRegen+3 | `rm_dream_tapir` |
| `ac_crest_fragment` | 紋章のかけら | アクセ | 9 | res:dark0.5 imm:death boost:light20 | `b_valzard_echo` |
| `ac_ouroboros_ring` | 円環の指輪 | アクセ | 9 | wpRegen+3 mpRegen+3 | `b_ouroboros` |

### 12.6 数（weapons・gear の品の数に足される）
| 種別 | レア | 超レア |
|---|---|---|
| ac | 62 | 56 |
| bd | 12 | 25 |
| ft | 1 | 9 |
| hd | 14 | 21 |
| hn | 4 | 10 |
| sh | 10 | 16 |
| w:axe | 3 | 6 |
| w:bow | 3 | 9 |
| w:club | 3 | 8 |
| w:dagger | 3 | 8 |
| w:fist | 3 | 8 |
| w:greatsword | 3 | 7 |
| w:katana | 4 | 7 |
| w:spear | 3 | 11 |
| w:staff | 2 | 16 |
| w:sword | 2 | 9 |
| w:whip | 2 | 8 |

ティアごと:
| T | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| レア | 22 | 0 | 21 | 21 | 20 | 1 | 24 | 18 | 7 |
| 超レア | 45 | 1 | 39 | 8 | 38 | 19 | 47 | 26 | 11 |

- §12.4・§12.5 の表が正（id・名前・種別・ティア・効果）。weapons・gear は表から定義を作る（§15-1）。


---------------------------------------------------------------------------------------------------
## 13. シミュレーターと検査

### 13.1 `tools/sim_zones.js`（担当 A11。qa の `tools/lib/party_model.js` を使う）
各ゾーン × ティア 0〜8（固定ティアのゾーンはそのティア）× 組をすべて、標準のパーティ（成長章 §17.1）のオートで 200 戦ずつ。
| # | 項目 | 合格 |
|---|---|---|
| M1 | 雑魚戦（成長章 §17.3-A2） | 勝率 ≥ 99.5%、平均 2.5〜3.5 ラウンド、HP の減り 15〜35%、誰かが倒れる戦闘 ≤ 8%、全滅 ≤ 0.2% |
| M2 | 順番に依らない（同 B4） | 同じ地方のゾーンを T0〜T7 で戦わせたとき、ラウンド数・HP の減り・勝率が平均の ±15% |
| M3 | 物理だけ・術だけのパーティ | 全員戦士型（剣・槍・斧・弓）、全員術師型で、M1 の勝率 ≥ 98%（霊体・魔造の多いゾーンでも詰まない） |
| M4 | 1人の主人公（序章） | `zw_prologue` を Lv1〜3 の主人公1人で、勝率 ≥ 97% |
| M5 | 組の強さ（静的） | §7.2 の表のとおり（平均 3.0〜3.4、各組 2.2〜4.8、4組以上、256px・8体以内） |
- 合格しないゾーンは、組の数（最少〜最多）と重みを直す。系統の `s` は、同じ系統の全段を同じ向きに動かす（段ごとの個性を崩さない）。

### 13.2 `tools/sim_bosses.js`（担当 A12）
| # | 項目 | 合格 |
|---|---|---|
| X1 | 中ボス・地方ボス（成長章 §17.3-B1）を T0〜T7 で | 勝率 ≥ 85%、ラウンド数 中 5〜7・地方 8〜11、倒れる人の平均 ≤ 1.0 |
| X2 | どの3人でも（同 B2） | 主人公6通り × 仲間の3人組 200 通り以上で、全ボスの勝率 ≥ 70%（中央値 ≥ 88%） |
| X3 | 仕掛けが動く | 楽団のアンコール、根の触手の養分、分身、足の生え直し、鉄の番人と溶岩の巨獣の段階、円環竜の巻き戻しが、1戦に1回以上起きる |
| X4 | ラスボス（2形態続けて）・裏ボス | 成長章 §17.3-C2・C3 |
| X5 | ボス戦の閃き（成長章 §9.5） | 1戦で誰かが閃く確率 ≥ 50%（T1 以降） |

### 13.3 `tools/sim_loot.js`（担当 A12）
| # | 項目 | 合格 |
|---|---|---|
| L1 | ドロップの確率（成長章 §17.3-H1） | 10 万体の抽選で式の ±10%、上限を超えない |
| L2 | 金色・レア魔物（同 H3） | 1地方 95 戦で 金色 2〜3 回、レア魔物 0.8〜1.5 回 |
| L3 | 1地方の品の数（補正なし） | 通常 30〜45、レア 7〜12、超レア 0.8〜1.6 |
| L4 | レア狙いの装備（dropPct・rarePct・superPct を合わせて +300%） | レア・超レアの数が L3 の 3.5〜4.5 倍 |
| L5 | 一品物（同 H2） | 超レア品はちょうど 1 種の魔物の super 枠にだけ。宝箱・店・盗みに無い |

### 13.4 `validate.js` に足す検査（担当 qa。この章の分）
1. すべての魔物に `mon:<sprite>` があり、雑魚はすべて `MON_COMPOSE` にある。`MON_COMPOSE` の元絵とパーツ・フィルターがすべてある。
2. 雑魚・レア魔物・ボスが `hue sat bri` を持たない（§0.6）。
3. `elem` の値が 2 / 1.5 / 1.25 / 1 / 0.75 / 0.5 / 0.25 / 0 / −1 のどれか（成長章 §7.1）。`phys` と `statusRes` も成長章の範囲。
4. 名前 ≤ 8 字、図鑑の説明 ≤ 20 字 × 2 行。魔物の名前が重ならない（ロウェルを除く）。行動の名前が技・術と重ならない。
5. 行動の参照がすべてある。雑魚は `eb_` を使わない。魔物は `s_` を使わない。全体への状態異常 ≤ 30%、即死は単体で ≤ 12%。
6. 系統の段の魔物がすべてあり、`lineage` `stage` が合っている。出現表・編成の参照が解決する。全種がどこかのゾーン・ティアで出る。
7. ドロップの品がすべて `DB.items` にある（A9・A10 の完成後）。超レアは一品物、レアは同じティアの 3 種まで。
8. 弱点の片寄り（§3.2 の割合が 12〜25%、打撃の種類が 10% 以上）。
9. 組の規則（§1.4: 3種・8体・256px）。`rareEncounters` の rate ≥ 1。

---------------------------------------------------------------------------------------------------
## 14. 担当のファイルと、他の担当への依頼

### 14.1 この章の担当のファイル（エンジン章 §7 のグロブの中）
| 担当 | ファイル |
|---|---|
| mons A11 | `src/data/lineages.js`、`src/data/monsters_{common,forest,desert,snow,marsh,isles,mine,ash,star,finale,postgame}.js`、`src/data/enemy_actions.js`、`src/data/encounters.js`、`tools/sim_zones.js` |
| boss A12 | `src/data/bosses.js`（ボス 34 体）、`src/data/bosses_actions.js`（`eb_` 191）、`src/data/troops.js`（26）、`src/data/rare.js`（レア魔物 23）、`src/data/rare_encounters.js`、`tools/sim_bosses.js`、`tools/sim_loot.js` |
| art-mons A14 | `src/art/monsters_c.js`（新しい元絵 14）、`src/art/monsters_parts.js`（`R.Art.compose` `MON_ANCHORS` `PARTS` `FILTERS` と雑魚の `MON_COMPOSE` 209）、`tools/sheet_monsters_parts.js` |
| art-boss A15 | `src/art/bosses_b.js`（新しいボス 16 ＋ お供 2）、`src/art/bosses_compose.js`（ボスの組み立て 14 を `R.Art.compose` で登録）、`src/art/rare_monsters_b.js`（新しいレア魔物 17）、`tools/sheet_bosses.js` `tools/sheet_rare.js` の更新 |
- A15 の組み立ては A14 の `R.Art.compose` を**実行時に**呼ぶ（factory の中で呼ぶので、読み込み順には頼らない。エンジン章 §1.2）。A14 が未完成のあいだは、元絵をそのまま返す仮の関数で自分の絵を確かめる。

### 14.2 依頼
| 相手 | 依頼 |
|---|---|
| lead（A0） | ① 成長章 §14.2 の「データが絶対値を持つ」を §0.4（`R.Mon.fillStats`）に、エンジン章 §3.2 の「色違いは魔物データの hue/sat/bri」を §0.6（組み立て表）に直す。② ワールド章 §13.5 の裏の編成「8 固定」をティア 9 に（§0.16）。③ 装備の章の道具の id が §12.3 と違う場合の突き合わせ。 |
| rules（A1） | `K` に §1.2 の `SIZE` `KIND`、§11.2 の `BOSS` の表（`prologue rival fmid echo add` を足す）、§2.3 の回避の規則を置く。`R.Rules.zoneLevel(zone, map)` はマップの `lvOff` を優先する（§0.17）。成長章 §10.1 のボスのドロップ「なし」に、裏の2体の例外を書く（§0.15）。 |
| battle（A2） | ① `R.Mon.fillStats`（onData、§1.2）と `R.Mon.resolve` の `'lower'`。② 効果 `summon`（§1.6）、`mp:true` の `drain` は HP の回復、`on:'self'`、行動の `elements`（多属性は相手に一番効くもの）。③ 条件 `countBelow` `allyDown`（§1.7）。④ `phases`（§11.1。イベント `{t:'phase'}`）。⑤ 呼ばれた魔物の旗 `summoned`（ドロップ・金色なし）。⑥ 武器の `metalHit:true`（その武器での攻撃・技を metalHit 扱い）。⑦ ボスの状態の耐性 = データとボスの既定の大きい方。⑧ `rareEncounters.rate` は分母。⑨ 金色の対象外（§8）。⑩ 魔物の `ally` は HP の割合が一番低い仲間、`ally_dead` は倒れた仲間。 |
| bui（A3） | ① 段階の変化の演出（`{t:'phase'}`: 文・画面の揺れ・`sprite` の差し替え）。② 呼ばれた魔物の登場（並び直して、左右から出てくる）。③ 金色のキラキラ（0.5 秒ごと）とレア魔物のキラキラ。④ 使う fx: `arrow bite bite2 breath(_fire _ice _poison _dark) buff claw confuse dark dark2 dark3 death debuff dispel drain earth earth2 explosion explosion2 fire fire2 fire3 heal holy holy2 ice ice2 ice3 magic magic2 magic3 mp paralyze pierce pierce2 poison regen revive silence slash slash2 sleep smoke song strike strike2 strike3 thunder warp water water2 wind wind2`（無いものはクレストの `resolve` の代わりでよい）。⑤ 8体・横幅 256px の並び（クレストの `layout` のまま）。 |
| field（A4） | マップの `lvOff` を `R.Battle.start` に渡す（§0.17）。 |
| menu（A5） | 図鑑: 雑魚 209・レア魔物 23・ボス 34 の順（雑魚は §5 の系統の順 → 段の順、次にレア魔物、ボスは戦う順）。3枠（通常・レア・超レア。未入手は「？？？」、ボスのレア・超レア枠は「―」、ただし裏の2体は枠あり）、金色を倒した数、レア魔物の印、親和の属性のヒント（倒したあと）。 |
| weapons（A9）・gear（A10） | §12.4〜12.7 の 368 品（超レア 234・レア 134）を**この id で**定義する（名前は直してよい。ティア・種別・効果の略記は正）。値段は成長章 §3.6（レア ×3・超レア ×6）。gear は §12.3 の道具 43 を定義する。武器の項目 `metalHit` を使う。 |
| art-tiles（A16） | 出現表と編成が使う戦闘背景: `tower forest tree pyramid ice snow manor swamp watercave ship mine volcano library oblivion`（ワールド章 §6.2・§15 と同じ。無いときの代わりもワールド章のとおり）。 |
| audio（A17） | BGM `rarebattle`（金色・レア魔物・鋼）、`boss` `boss2` `rival` `tension` `lastboss` `superboss`（編成の表）。効果音 `golden`（金色）、`shake`（段階の変化）、`roar`。 |
| world・story・reg-a・reg-b（A18〜A21） | ① ダンジョンの2階以降のマップに `lvOff: 2`（ボスの階は書かない。ボスは編成の lvOff を使う）。② ボスのイベントは §11.4 の編成 id で `ev.battle`。ロウェルは `canLose:true`。③ ラスボスは `tr_b_nemrea1` → 名を記す場面 → `tr_b_nemrea2`（ワールド章 §10.4）。④ 見えるボスの絵（NPC `boss` の `mon:<絵>`）は §11.4 の「絵」の欄。 |
| spells（A8） | 魔物が使う状態は `poison burn sleep paralyze freeze stun confuse silence blind death regen veil` だけ（新しい状態は作らない）。 |
| techs（A7） | 旗と種族: 飛ぶ雑魚 30 種（鳥 8・コウモリ 5・ハチ 5・妖精 4・石像鬼 4・飛竜 3・白紙の竜 1）、種族の内訳は 獣 38・魔造 26・虫 23・人型 19・霊体 17・植物 17・魔族 17・水棲 15・不死 10・妖精 9・鳥 8・軟体 7・竜 3。 |
| qa（A22） | §13.4 の検査。`check_text.js` の禁止語に、この章で避けた語（スライム・ドラキー・キメラ・ゴーレム・ミミック・人食い箱・メタル・はぐれ・キング）を足す。 |

---------------------------------------------------------------------------------------------------
## 15. 未決事項・注意
1. **品の数が多い**（魔物からだけで 368 品）。weapons・gear の作業が重すぎるときは、§12.7 の表から成長章 §3 の規則で数値を作る生成関数（`items_monster.js` の中で1回回す）にしてよい。id・ティア・種別・効果の略記は変えない。
2. 道具の id（§12.3）は、装備の章が別の id を決めていたら lead が突き合わせる（魔物データの `drops` を置き換えるだけで済む）。
3. ボスごとの `s`（±20%）は `sim_bosses.js` の結果で決める。ここでは全員 1。
4. 霧食らいの段階（物理 0.75 → 1.0）と溶岩の巨獣の段階（属性の入れ替え）は、battle の `phases` の実装が前提。実装が間に合わないときは、`phases` を読まずに前半の値のまま戦える（勝てなくなることはない）。
5. 裏ダンジョンをティア 9 にしたこと（§0.16）は、ワールド章の担当と lead の確認が要る。
6. 予備の元絵 `harpy` `minotaur` は、系統を足すときに使う（高原の鳥女、王墓の牛頭など）。足すときも §3.2 の片寄りの検査をやり直す。
7. レア魔物の図鑑の説明と、行動のメッセージは完成文。ボスの説明は台本（ワールド章）と矛盾しないように、物語担当が見直してよい。
