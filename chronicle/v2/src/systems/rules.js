// R.Rules（RULES）: 数の規則のすべて — 6 つの能力値（0〜25、固定）・導かれる値・装備枠 8・武器 5 系統・最強装備・熟練度 1〜100・
// 戦闘の命令の一覧・品の数値（fillItem）と説明・宝箱の中身・店の並び。V2_PLAN §2.5.12、STATS_REWORK（A20・A22・A28・A29・A30）、
// SYSTEMS_REWORK（熟練度 1〜100・WP なし）。今の木の src/systems/rules.js から移して直した。
// DOM に触れない（node の tools も読む）。定数はすべて R.Rules.K（§2.4「数値の定数は 1 か所」）。
//
// CharState（V2_PLAN §2.6.3。R.Party.makeChar が作る）:
//   { id, name, look, type?(主人公のタイプ), fav?(得意: 5 系統か 6 属性), sex, gl, hp, mp,
//     equip:{weapon1 shield head body hands feet acc1 acc2}, wprof:{wtype:点}, eprof:{属性:点}, techs:[], spells:[], status:[], row:'front'|'back' }
// 能力値・適性・成長の文字は保存しない（毎回 R.DB.heroTypes / companions から引く）。
(function (R) {
  'use strict';
  R.Stubs.claim('Rules');
  const DB = R.DB;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------ 名前（§3.1.1）
  const ABILS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
  const STATS = ABILS;
  const MAXES = ['hp', 'mp'];
  const SLOTS = ['weapon1', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];   // 装備枠 8（A29。表示は「武器」）
  const WEAPON_SLOTS = ['weapon1'];
  const ACC_SLOTS = ['acc1', 'acc2'];
  const ARMOR_SLOTS = ['shield', 'head', 'body', 'hands', 'feet'];
  const ITEM_SLOTS = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc', 'use', 'key'];   // K.item.slot
  const EQUIP_GROUPS = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const WTYPES = ['sword', 'greatsword', 'dagger', 'bow', 'staff'];                   // A29: 5 系統、この順
  const UNARMED = 'fist';
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const LETTERS = ['S', 'A', 'B', 'C', 'D'];
  const GRADES = ['normal', 'rare', 'super'];
  const CAPS = { hp: 999, mp: 250, stat: 40, eva: 60, crit: 60 };

  const STAT_NAMES = { str: R.T('sys.rules.STAT_NAMES.str'), vit: R.T('sys.rules.STAT_NAMES.vit'), dex: R.T('sys.rules.STAT_NAMES.dex'), agi: R.T('sys.rules.STAT_NAMES.agi'), int: R.T('sys.rules.STAT_NAMES.int'), mnd: R.T('sys.rules.STAT_NAMES.mnd'), hp: R.T('sys.rules.STAT_NAMES.hp'), mp: R.T('sys.rules.STAT_NAMES.mp') };
  const SLOT_NAMES = { weapon1: R.T('sys.rules.SLOT_NAMES.weapon1'), shield: R.T('sys.rules.SLOT_NAMES.shield'), head: R.T('sys.rules.SLOT_NAMES.head'), body: R.T('sys.rules.SLOT_NAMES.body'), hands: R.T('sys.rules.SLOT_NAMES.hands'), feet: R.T('sys.rules.SLOT_NAMES.feet'), acc1: R.T('sys.rules.SLOT_NAMES.acc1'), acc2: R.T('sys.rules.SLOT_NAMES.acc2') };
  const GROUP_NAMES = { weapon: R.T('sys.rules.GROUP_NAMES.weapon'), shield: R.T('sys.rules.GROUP_NAMES.shield'), head: R.T('sys.rules.GROUP_NAMES.head'), body: R.T('sys.rules.GROUP_NAMES.body'), hands: R.T('sys.rules.GROUP_NAMES.hands'), feet: R.T('sys.rules.GROUP_NAMES.feet'), acc: R.T('sys.rules.GROUP_NAMES.acc'), use: R.T('sys.rules.GROUP_NAMES.use'), key: R.T('sys.rules.GROUP_NAMES.key') };
  const WTYPE_NAMES = { sword: R.T('sys.rules.WTYPE_NAMES.sword'), greatsword: R.T('sys.rules.WTYPE_NAMES.greatsword'), dagger: R.T('sys.rules.WTYPE_NAMES.dagger'), bow: R.T('sys.rules.WTYPE_NAMES.bow'), staff: R.T('sys.rules.WTYPE_NAMES.staff') };
  const UNARMED_NAME = R.T('sys.rules.UNARMED_NAME');
  const ELEMENT_NAMES = { fire: R.T('sys.rules.ELEMENT_NAMES.fire'), water: R.T('sys.rules.ELEMENT_NAMES.water'), wind: R.T('sys.rules.ELEMENT_NAMES.wind'), earth: R.T('sys.rules.ELEMENT_NAMES.earth'), light: R.T('sys.rules.ELEMENT_NAMES.light'), dark: R.T('sys.rules.ELEMENT_NAMES.dark') };
  const GRADE_NAMES = { normal: R.T('sys.rules.GRADE_NAMES.normal'), rare: R.T('sys.rules.GRADE_NAMES.rare'), super: R.T('sys.rules.GRADE_NAMES.super') };
  const ROW_NAMES = { front: R.T('sys.rules.ROW_NAMES.front'), back: R.T('sys.rules.ROW_NAMES.back') };
  const WEIGHT_NAMES = { heavy: R.T('sys.rules.WEIGHT_NAMES.heavy'), light: R.T('sys.rules.WEIGHT_NAMES.light'), cloth: R.T('sys.rules.WEIGHT_NAMES.cloth') };
  // 比べる値 15（§8.2: atk1/atk2 → atk）。装備の画面・店の ▲▼ の並び
  const DIFF_KEYS = ['atk', 'mag', 'def', 'mdef', 'hit', 'eva', 'crit', 'str', 'vit', 'dex', 'agi', 'int', 'mnd', 'hp', 'mp'];
  const DIFF_NAMES = { atk: R.T('sys.rules.DIFF_NAMES.atk'), mag: R.T('sys.rules.DIFF_NAMES.mag'), def: R.T('sys.rules.DIFF_NAMES.def'), mdef: R.T('sys.rules.DIFF_NAMES.mdef'), hit: R.T('sys.rules.DIFF_NAMES.hit'), eva: R.T('sys.rules.DIFF_NAMES.eva'), crit: R.T('sys.rules.DIFF_NAMES.crit'),
    str: R.T('sys.rules.DIFF_NAMES.str'), vit: R.T('sys.rules.DIFF_NAMES.vit'), dex: R.T('sys.rules.DIFF_NAMES.dex'), agi: R.T('sys.rules.DIFF_NAMES.agi'), int: R.T('sys.rules.DIFF_NAMES.int'), mnd: R.T('sys.rules.DIFF_NAMES.mnd'), hp: R.T('sys.rules.DIFF_NAMES.hp'), mp: R.T('sys.rules.DIFF_NAMES.mp') };

  // ------------------------------------------------------------ 定数（DESIGN §4.18.1 ＋ STATS_REWORK §2.1・§5.2・§7.3・§9.3）
  const Wt = [8, 14, 21, 30, 40, 51, 64, 78, 94, 112];                 // 旧の K.W: 道具の formula:'tier' と値段・sim の目安だけ
  const PRICE = [70, 160, 290, 450, 660, 900, 1200, 1500, 1900, 2600];
  const WT = (hands, reach, kind, mult, hit, crit, stat, magMult) => ({ hands, twoHanded: hands === 2, reach, kind, mult, hit, crit, stat, magMult });
  const K = {
    // 契約の名前（V2_PLAN §2.5.12）
    SLOTS, WTYPES, ELEMENTS, ABILS, ITEM_SLOTS,
    DK: (L) => 40 + 5 * L,
    W: Wt, PRICE,
    D: (T) => 70 + 30 * T,
    LZ: (T) => 6 + 6 * T,
    // §2.1 能力値の効き目: abilMul(a, k) = max(minMul, 1 + k × (a − mid))
    ABIL: { mid: 16, cap: 40, minMul: 0.5, atk: 0.045, mag: 0.045, heal: 0.04, tech: 0.01, vit: 0.025, mdef: 0.03, sf: 0.04, gf: 0.04, healStat: 'mnd' },
    WA: [11, 22, 35, 52, 71, 96, 122, 156, 193, 246],                 // 武器の攻撃力・術力の土台（§2.3）
    GRADE_ATK: { normal: 1, rare: 1.06, super: 1.12 },
    GRADE_DEF: { normal: 1, rare: 1.10, super: 1.20 },
    ACC_W: [1, 1, 1, 2, 3, 4, 5, 7, 8, 10],                            // 通常の腕輪・耳飾り（§3.2）
    ABIL_GEAR: {                                                        // 能力値を上げる装備（§3.1）
      rare: { weapon: [0, 0, 0, 0, 0, 1, 1, 1, 1, 2], body: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1], acc: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1], armor: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      super: { weapon: [1, 1, 1, 1, 1, 2, 2, 2, 3, 4], body: [1, 1, 1, 1, 1, 1, 1, 2, 2, 3], acc: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2], armor: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
    },
    PRICE_GRADE: { normal: 1, rare: 3, super: 6 },
    // §8.1 系統の表。品は mult・kind・hit・crit・astat（攻撃力の能力値）を上書きできる
    WTYPE: {
      sword: WT(1, false, 'slash', 1.00, 0, 2, ['str'], 0.5),
      greatsword: WT(2, false, 'slash', 1.40, -5, 2, ['str'], 0.5),
      dagger: WT(1, false, 'pierce', 0.75, 8, 10, ['dex'], 0.5),
      bow: WT(2, true, 'pierce', 1.10, 5, 4, ['dex'], 0.5),
      staff: WT(1, true, 'blunt', 0.60, 0, 0, ['str', 'int'], 1.0),
      fist: WT(1, false, 'blunt', 0.90, 5, 5, ['str', 'agi'], 0.5),   // 素手（内部だけ）
    },
    UNARMED: { atk: 4, mag: 4 },
    WEIGHT: { heavy: { def: 1, mdef: 0.2, eva: 8 }, light: { def: 0.65, mdef: 0.35, eva: 5 }, cloth: { def: 0.4, mdef: 0.6, eva: 2 } },
    SLOT_SHARE: { shield: 0.20, head: 0.15, body: 0.40, hands: 0.10, feet: 0.15 },
    PRICE_SLOT: { weapon: 1.6, body: 1.4, shield: 1.0, head: 0.8, hands: 0.6, feet: 0.6, acc: 1.2 },
    RELIC_PRICE: { rare: 1500, super: 3000 },
    // §9.2 HP・MP の曲線（成長の点 gl で読む）と成長の文字
    HP: { a: 17.5, b: 14.7, p: 0.90, cap: 999 },
    MP: { a: 8, b: 2.6, p: 0.85, cap: 250 },
    GROWTH_LETTER: {
      hp: { S: 1.25, A: 1.12, B: 1.00, C: 0.90, D: 0.80 },
      mp: { S: 1.30, A: 1.15, B: 1.00, C: 0.85, D: 0.70 },
    },
    // §9.3 戦闘のあとの伸び（R.Growth）。slope 0.07 → 0.08（sim_growth E1: T0 の地方ボスで LZ+5.2 → +4.9。伸びなくなるのは d ≤ −3.75）
    GROW: { p0: 0.30, slope: 0.08, pmax: 0.90, add: { boss: 4, rare: 2, golden: 1, metal: 6 }, mul: { boss: 2, metal: 2 },
      reserve: 0.6, fallen: 0.5, join: 0.9, capOff: 6, bplMax: 16, bplAmp: 12, bplTau: 12, rf: [0.8, 1.2], glMin: 1, glMax: 99 },
    // §4.5.3 隊列（back = 後列。旧の middle と同じ）
    ROW: { middleTaken: 0.7, backTaken: 0.7, weight: { front: 2, middle: 1, back: 1 }, aimMiddle: { front: 1, middle: 3 }, aimBack: { front: 1, back: 3 } },
    STAGE: [0.63, 0.77, 1, 1.3, 1.6],
    MOB: { atk: 0.6, mag: 0.6 },
    // §4.9.1 熟練度（SYSTEMS_REWORK §1。点を保存し、段階 1〜100 は計算）
    PROF_PTS: [0].concat(Array.from({ length: 100 }, (_, i) => Math.round(11 * Math.pow(i, 1.18)))),
    PROF_CAP: 2490,
    PROF_GAIN: { weapon: 1, techHigh: 2, techHighLv: 6, single12: 2, single35: 5, pair: 5, triple: 7 },
    CATCHUP: 2,
    PEXP: [25, 227, 311, 445, 585, 730, 880, 1034, 1191, 1352],                 // §5.2: [1] 186 → 227
    PROF_SOFT: { rank: [8, 28, 36, 44, 52, 60, 67, 74, 80, 90], mul: 0.3 },     // §5.2: T0 20 → 8
    START_PROF: { S: 25, A: 11 },
    JOIN_PROF: { S: 0.8, A: 0.7, B: 0.5, C: 0.3, D: 0.1 },
    PROF_TRACK: [135, 280, 455, 635, 825, 1015, 1205, 1395, 1565, 1740],        // §5.2: 模型の目安（主な武器、ティアの中ほど）
    TECH_PROF: [0, 1, 3, 8, 14, 20, 26, 32, 40, 50, 60],
    PROF_POWER: { max: 0.30, exp: 0.75 },
    PROF_MP: { freeRank: 14, freeStep: 1, halfRank: 32, halfStep: 2 },
    MON_HP_PROF: { perLv: 0.0035, max: 0.18 },
    MOB_TIER: {
      on: false,
      hp: [1.12, 1.2, 1.45, 1.72, 1.72, 1.9, 2.14, 2.3, 2.35, 2.06],
      dmg: [1.25, 1.25, 0.95, 0.75, 0.72, 0.61, 0.58, 0.58, 0.58, 0.45],
    },
    // §4.9.3〜4.9.4 閃き（R.Glimmer）。GF = clamp(abilMul(S, ABIL.gf), gf.min, gf.max)（§2.2）
    GLIM: {
      base: { tech: 0.0095, secret: 0.00475, single: 0.015, comboA: 0.012, comboB: 0.010, triple: 0.008 },
      techLv: [1, 10], spellLv: [1, 8], cap: 0.35,
      apt: { S: 2, A: 1.5, B: 1, C: 0.6, D: 0.3 },
      expect: [2, 4, 6, 8, 10, 12, 14, 16, 17, 19],
      fkSlope: 0.6, fkFree: 2, fkMax: 6,
      ef: { normal: 1, golden: 1.5, rare: 2, boss: 2.5 },
      rank: { boss: 2, rare: 2, golden: 1, metal: 1 }, rankBase: 1, secretLv: 10,
      margin: 0.1, marginMax: 5, wFrom: 3, wLowest: 2,
      gf: { min: 0.7, max: 1.8 },
      tier0: 2.15, tier0Known: 3, bossLate: { from: 4, slope: 0.4, max: 2 },
    },
    // 派生技（R.Glimmer.deriveRoll。design/BACKLOG「派生技の閃き」）: レアな技。親の技を使ったときだけ、閃きに似た確率で振る（確定は無い）:
    //   p = min(cap[段], base[段] × 相性（K.GLIM.apt）× GF（器用さ）× RANK × PROF × USE × (1 + glimPct/100))
    //   RANK = clamp(1 + rankSlope × (rankB − derived.lv), rankMin, rankMax)   … 強い相手ほど上がる
    //   PROF = clamp(1 + profSlope × (段階 − TECH_PROF[derived.lv]), profMin, profMax)   USE = min(useMax, 1 + useSlope × 回数)（どちらも小さく。確定は cap[段] が止める）
    //   段 = 1（親がふつうの技）・2（親も派生技）。使った回数が minUses 未満は 0
    DERIVE: { minUses: 3, base: [0, 0.002, 0.0006], cap: [0, 0.006, 0.0009], rankSlope: 0.3, rankMin: 0.3, rankMax: 2.5,
      profSlope: 0.01, profMin: 0.7, profMax: 1.25, useSlope: 0.02, useMax: 2.5, maxCount: 9999 },
    // §4.10 落とし物・盗み（§7.3 盗み専用の枠）
    DROP: { rate: { normal: 8, rare: 32, super: 256 }, cap: { normal: 0.75, rare: 0.5, super: 0.125 }, modCap: 150, golden: { normal: 2, rare: 8, super: 8 } },
    // 盗みのレア枠: min(rareCap, レアの落ちる率 × rareMul)。4・0.5 → 1.5・0.15（オーナー 2026-09-28「ティッタのレアを盗む確率が高すぎる。レアばかり持つ」）。
    //   成功 1 回あたり 縦切りの雑魚 段 1（率 32）4.7%・段 2（率 16）9.4%、ついでに（autoRare 0.5）はその半分。めずらしい魔物（率 6）は 15%
    STEAL: { base: 0.35, agiDiv: 200, min: 0.1, max: 0.8, boss: 0.5, rareMul: 1.5, rareCap: 0.15, autoRare: 0.5, autoMul: 0.4, autoPerBattle: 1,
      only: { cap: 0.5, autoMul: 0.5, golden: 2 }, rate: { mob: 32, rare: 16, boss: 16 } },
    // §3.3.16 効果の合計の上限（exp → grow。§9.4）
    MODCAP: { party: 150, partyMin: -100, preempt: 30, grow: 30, growMin: -100, glim: 40, glimMin: -100, prof: 50, profMin: -100, cost: -50, encounter: 50, autoSteal: 100 },
    PARTY_KEYS: ['goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct', 'preemptPct', 'escapePct'],
    // §4.11 出現・先制・逃走
    ENC: { world: 52, dungeon: 22, randLo: 0.6, randHi: 1.4, safeSteps: 6 },   // world: WORLD v3（2026-09-28）でワールドが 3 倍に広がった → 平均の間隔 26 → 52（旅 1 回の戦闘は前の約 1.5 倍。scratchpad worldv3/DESIGN.md §1.4）
    DARK: { ambush: 0.08, stat: 1.1 },   // 暗がりの闇の強まり（E6。BATTLE が読む：先手を取られる率・闇の魔物の能力の倍率）
    ENC_ITEM: { repel: { pct: -100, steps: 100, weakOnly: true }, lure: { pct: 100, steps: 100 }, weakMargin: 3 },
    PREEMPT: 1 / 16, PREEMPT_RATIO: [0.5, 2],
    ESCAPE: { base: 0.55, step: 0.12, agi: 0.5, min: 0.25, max: 0.95 },
    AFTER: { mpPct: 0.10, mpByProf: [[80, 0.10], [60, 0.07], [40, 0.04]] },   // 勝ったあとの MP は基本 10% 戻る（持ち主 2026-09-27「魔法がもたない」）。一番高い熟練度が 40・60・80 以上ならさらに 4・7・10% 足す（最大 20%）
    INN: [10, 16, 24, 32, 42, 54, 66, 80, 96, 112],
    // §4.10.2〜4.10.5 金色・レア・鋼（経験値は無い。A30）
    GOLDEN: { rate: 1 / 40, hp: 2, stat: 1.2, gold: 5, lvShow: 2 },
    RARE_ENC: 80,
    RARE_MON: { lvOff: 2, gold: 5, flee: 0.25, fleeFrom: 2, eva: 15, evaFlying: 20 },
    METAL: { gold: 10, flee: 0.5, eva: 30, agi: 2.5, hp: [6, 12], dmg: 1, critDmg: 2, hitMul: 3 },
    // §2.2 命中・会心・回避・速さ・術防（旧 34 ＝ 新 16）
    HIT: { base: 98, per: 1.0, min: 20, max: 100, blind: 0.5, mon: 95 },
    CRIT: { base: 4, per: 0.5, mult: 1.5, cap: 60, mon: 2, boss: 3 },
    EVA: { base: 6, per: 0.7, cap: 60, nimble: 25 },
    SPD: { base: 34, per: 3.4 },
    MDEF: { flat: 16 },
    MON_EVA: { base: 5, flying: 12, fast: 15, fastAgi: 1.3, metal: 30, rare: 15, rareFlying: 20, boss: 5, bossFlying: 10 },
    DEFEND: 0.5,
    DMG: { physRand: [0.90, 1.10], magRand: [0.95, 1.05], breathRand: [0.9, 1.1], fixedRand: [0.95, 1.05], max: 9999 },
    SF: { min: 0.6, max: 1.8 },
    HEALF: { min: 0.6, max: 2.0 },
    STATUS: { mndPer: 0.005, resistCap: 0.9, pCap: 0.95, bossDebuff: 0.5 },
    BOSS_RES: { death: 1, sleep: 0.75, paralyze: 0.75, freeze: 0.75, confuse: 0.75, stun: 0.5, silence: 0.5, blind: 0.5, poison: 0.25, burn: 0.25 },
    // §4.14.2 魔物の曲線（R.Mon が読む。魔物の側は変えない、§2.5）
    CURVE: { hp: [6, 2.6, 0.1], atk: [4, 3.15, 0.9], magMul: 0.85, def: [20, 2.5], agi: [24, 0.6], gold: [2, 0.5, 0.07] },
    SIZE: { s: { hp: 0.7, atk: 0.9, def: 0.9, rw: 0.7 }, m: { hp: 1, atk: 1, def: 1, rw: 1 }, l: { hp: 2.0, atk: 1.15, def: 1.1, rw: 1.8 } },
    KIND: { mob: { gold: 1 }, rare: { gold: 5 }, metal: { gold: 10 } },
    BOSS: {
      prologue: { lv: 8, hpMul: 11, atk: 1.25, mag: 1.25, def: 1.1, agi: 1.0, acts: 1, gold: 15 },
      mid: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, gold: 15 },
      region: { lvOff: 3, hpMul: 18, atk: 1.5, mag: 1.4, def: 1.2, agi: 1.2, acts: 2, gold: 15 },
      rival: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, gold: 15 },
      fmid: { lvOff: 2, hpMul: 20, atk: 1.5, mag: 1.5, def: 1.2, agi: 1.2, acts: 2, gold: 15 },
      last1: { lvOff: 4, hpMul: 30, atk: 1.6, mag: 1.6, def: 1.25, agi: 1.3, acts: 2, gold: 15 },
      last2: { lvOff: 4, hpMul: 17, atk: 0.68, mag: 0.68, def: 0.65, agi: 0.65, acts: 3, gold: 15 },
      echo: { lvOff: 4, hpMul: 30, atk: 1.7, mag: 1.7, def: 1.25, agi: 1.3, acts: 2, gold: 15 },
      super: { lvOff: 8, hpMul: 56, atk: 1.25, mag: 1.25, def: 1.3, agi: 1.4, acts: 3, gold: 15 },
      add: { hpMul: null, acts: 1, gold: 2 },
    },
    MAX_ITEM: 99,
    MAX_GOLD: 9999999,
  };
  K.mobTier = function (L) {
    const M = K.MOB_TIER, n = M.hp.length - 1;
    const t = clamp((L - 6) / 6, 0, n), i = Math.min(n - 1, Math.floor(t)), f = t - i;
    return { hp: M.hp[i] + (M.hp[i + 1] - M.hp[i]) * f, dmg: M.dmg[i] + (M.dmg[i + 1] - M.dmg[i]) * f };
  };
  /** 魔物の曲線（§4.14.2。経験値は無い） */
  K.curve = function (L, kind) {
    const C = K.CURVE;
    const mt = kind === 'mob' && K.MOB_TIER.on ? K.mobTier(L) : null;
    const atk = (C.atk[0] + C.atk[1] * Math.pow(Math.max(0, L - 1), C.atk[2])) * (mt ? mt.dmg : 1);
    const d = C.def[0] + C.def[1] * L;
    return {
      hp: (C.hp[0] + C.hp[1] * L + C.hp[2] * L * L) * (1 + Math.min(K.MON_HP_PROF.max, K.MON_HP_PROF.perLv * Math.max(0, L))) * (mt ? mt.hp : 1),
      atk, mag: C.magMul * atk, def: d, mdef: d, agi: C.agi[0] + C.agi[1] * L,
      gold: C.gold[0] + C.gold[1] * L + C.gold[2] * L * L,
    };
  };
  K.hpBoss = (L) => K.curve(L).hp * (0.65 + 0.025 * (clamp(L, 18, 51) - 18));

  const LIST_MODS = { statusImmune: 1 };
  const MAP_MODS = { elemResist: 1, elemBoost: 1, statusResist: 1, glimPct: 1, profPct: 1, startBuffs: 1 };
  const round2 = (v) => Math.round(v * 100) / 100;
  const gameInv = () => (R.Game && R.Game.items) || {};
  const uniq = (a) => Array.from(new Set(a || []));
  const letter = (v) => (LETTERS.includes(v) ? v : 'C');
  const tierNow = () => { try { return R.Tier && R.Tier.effective ? R.Tier.effective() | 0 : ((R.Game && R.Game.tier) | 0); } catch (e) { return 0; } };
  const actionOf = (id) => (id && ((DB.techs && DB.techs[id]) || (DB.spells && DB.spells[id]) || (DB.actions && DB.actions[id]))) || null;

  // ------------------------------------------------------------ 伸びる一品物の個体（R.Game.uniques）
  const uniqCache = {};
  /** 品の定義。u_* で R.Game.uniques[id] があればその個体の数値を重ねた物（R.DB.items は書き換えない） */
  function itemOf(id) {
    if (!id) return null;
    // 消した品の id（R.DB.itemAlias。古いセーブ・古い参照）は残した品として読む
    if (!DB.items[id] && DB.itemAlias && DB.itemAlias[id]) id = DB.itemAlias[id];
    const it = DB.items[id];
    if (!it) return null;
    const u = it.grow === 'tier' && R.Game && R.Game.uniques && R.Game.uniques[id];
    if (!u) return it;
    const c = uniqCache[id];
    if (c && c.u === u && c.it === it && c.t === u.tier) return c.v;
    const v = Object.assign({}, it, u, { stats: u.stats || it.stats });
    uniqCache[id] = { u, it, t: u.tier, v };
    return v;
  }
  const slotGroupOfItem = (it) => (it && EQUIP_GROUPS.includes(it.slot) ? it.slot : null);

  const Rules = (R.Rules = R.Rules || {});
  Object.assign(Rules, {
    K, STATS, ABILS, MAXES, SLOTS, WEAPON_SLOTS, ACC_SLOTS, ARMOR_SLOTS, ITEM_SLOTS, EQUIP_GROUPS, WTYPES, UNARMED, ELEMENTS, LETTERS, GRADES, CAPS,
    STAT_NAMES, SLOT_NAMES, GROUP_NAMES, WTYPE_NAMES, UNARMED_NAME, ELEMENT_NAMES, GRADE_NAMES, ROW_NAMES, WEIGHT_NAMES, DIFF_KEYS, DIFF_NAMES,
    itemOf, actionOf,

    // ------------------------------------------------------------ 小さな式
    /** 能力値の効き目（§2.1）: max(0.5, 1 + k × (a − 16))。a が無ければ 16 */
    abilMul(a, k) { return Math.max(K.ABIL.minMul, 1 + k * ((a == null ? K.ABIL.mid : a) - K.ABIL.mid)); },
    /** 魔物の速さ（旧の尺度）→ 能力値の尺度（§1.4、図鑑の表示） */
    spdToAbil(agi) { return clamp(Math.round(K.ABIL.mid + ((agi || 0) - K.SPD.base) / K.SPD.per), 0, K.ABIL.cap); },
    /** 魔物に能力値が要る所は 16（普通。§2.5） */
    monAbil() { return K.ABIL.mid; },
    /** 回復の倍率 HEALF = clamp(abilMul(精神, 0.04), 0.6, 2.0)（§2.2。healStat で知力・平均にも切り替えられる） */
    healF(c) {
      const fs = c && c.str !== undefined && c.mnd !== undefined && !c.equip ? c : Rules.finalStats(c);
      const hs = K.ABIL.healStat;
      const a = hs === 'int' ? fs.int : hs === 'avg' ? (fs.int + fs.mnd) / 2 : fs.mnd;
      return clamp(Rules.abilMul(a, K.ABIL.heal), K.HEALF.min, K.HEALF.max);
    },
    /** 状態異常の決まりやすさ SF = clamp(abilMul(S, 0.04), 0.6, 1.8)（S = 術は知力、技は器用さ） */
    sfOf(a) { return clamp(Rules.abilMul(a, K.ABIL.sf), K.SF.min, K.SF.max); },
    /** 状態異常の防ぎの土台 = 0.005 × 精神（statusResist を足して上限 0.9 は戦闘の側） */
    statusGuard(mnd) { return K.STATUS.mndPer * (mnd || 0); },
    /** 閃きの能力値の倍率 GF = clamp(abilMul(S, 0.04), 0.7, 1.8) */
    gfOf(a) { return clamp(Rules.abilMul(a, K.ABIL.gf), K.GLIM.gf.min, K.GLIM.gf.max); },
    dk(L) { return K.DK(L); },
    lz(T) { return K.LZ(T); },
    /** 戦闘のティアとレベル（§4.14.1）: Tb = zone.tier か R.Game.tier（解決した地方は R.Tier.forZone の固定ティア）、Lb = LZ(Tb) + (map.lvOff ?? zone.lvOff ?? 0) */
    zoneLevel(zone, map, opts) {
      const z = typeof zone === 'string' ? DB.encounters[zone] : zone;
      let md = typeof map === 'string' ? DB.maps[map] : map;
      if (md === undefined && R.Game && R.Game.pos) md = DB.maps[R.Game.pos.map];
      const gt = (R.Game && R.Game.tier) || 0;
      const Tb = z && typeof z.tier === 'number' ? z.tier : z && R.Tier && R.Tier.forZone ? R.Tier.forZone(z, gt) : gt;   // 解決した地方は固定のティア
      if (z && Array.isArray(z.lv)) {
        const lo = z.lv[0], hi = z.lv[1] != null ? z.lv[1] : z.lv[0];
        const rng = opts && opts.rng;
        const roll = opts && opts.roll ? lo + Math.floor((rng ? rng() : Math.random()) * (hi - lo + 1)) : hi;
        return { Tb, Lb: roll, lvMin: lo, lvMax: hi };
      }
      const off = md && md.lvOff != null ? md.lvOff : (z && z.lvOff) || 0;
      const Lb = K.LZ(Tb) + off;
      return { Tb, Lb, lvMin: Lb, lvMax: Lb };
    },

    // ------------------------------------------------------------ 人のデータ
    isHero(c) { return !!c && c.id === 'hero'; },
    /** 人の元のデータ: 主人公は R.DB.heroTypes[type]、仲間は R.DB.companions[id] */
    source(c) { return !c ? null : c.id === 'hero' ? DB.heroTypes[c.type] || null : DB.companions[c.id] || null; },
    /** 得意の種類: 'weapon'|'element'|null */
    favKind(c) { const f = c && c.fav; return !f ? null : WTYPES.includes(f) ? 'weapon' : ELEMENTS.includes(f) ? 'element' : null; },
    /** 装備の前の 6 つの能力値（固定、0〜25。保存しない） */
    baseStats(c) {
      const src = Rules.source(c);
      const st = (src && src.stats) || { str: 16, vit: 16, dex: 16, agi: 16, int: 16, mnd: 15 };
      const out = {};
      for (const k of STATS) out[k] = st[k] | 0;
      return out;
    },
    /** 適性の文字 {w:{sword…}, e:{fire…}}。主人公は得意を S（術師は組の属性を A） */
    aptLetters(c) {
      const src = Rules.source(c);
      const a = (src && src.apt) || {};
      const out = { w: {}, e: {} };
      for (const w of WTYPES) out.w[w] = letter(a.w && a.w[w]);
      for (const e of ELEMENTS) out.e[e] = letter(a.e && a.e[e]);
      const fk = Rules.favKind(c);
      if (c && c.id === 'hero' && fk) {
        const k = fk === 'element' ? 'e' : 'w';
        out[k][c.fav] = 'S';
        if (k === 'e' && src && src.pairElement) {
          const kit = DB.starterKit || {};
          const pair = (kit.pair || { fire: 'wind', wind: 'fire', water: 'light', light: 'water', earth: 'dark', dark: 'earth' })[c.fav];
          if (pair) out.e[pair] = 'A';
        }
      }
      return out;
    },
    aptLetter(c, kind, id) { const L = Rules.aptLetters(c)[kind === 'e' ? 'e' : 'w']; return L[id] || 'C'; },
    /** 閃きの適性の倍率（§4.9.4）: S 2.0 A 1.5 B 1.0 C 0.6 D 0.3 */
    aptitude(c) {
      const L = Rules.aptLetters(c), A = K.GLIM.apt;
      const out = { w: {}, e: {} };
      for (const w of WTYPES) out.w[w] = A[L.w[w]];
      for (const e of ELEMENTS) out.e[e] = A[L.e[e]];
      return out;
    },
    /** 成長の文字 {hp, mp}（S〜D） */
    growth(c) { const src = Rules.source(c); const g = (src && src.growth) || {}; return { hp: letter(g.hp), mp: letter(g.mp) }; },

    // ------------------------------------------------------------ 効果の合計
    /**
     * 装備 8 つの mods ⊕ 生まれつき（companions[id].innate.mods / heroTypes[type].mods）。数は足し、一覧はつなぎ、
     * elemResist は属性ごとに小さい方、ほかの表は足す、真偽はどれか。1 人の上限をかける（§3.3.16）
     */
    mods(c, opts) {
      const out = {};
      const add = (m) => {
        if (!m) return;
        for (const k in m) {
          const v = m[k];
          if (v == null) continue;
          if (LIST_MODS[k]) out[k] = uniq((out[k] || []).concat(v));
          else if (MAP_MODS[k] && typeof v === 'object') {
            const o = (out[k] = out[k] || {});
            for (const e in v) o[e] = k === 'elemResist' ? (o[e] == null ? v[e] : Math.min(o[e], v[e])) : (o[e] || 0) + v[e];
          } else if (typeof v === 'number') out[k] = (out[k] || 0) + v;
          else if (typeof v === 'boolean') out[k] = out[k] || v;
          else out[k] = v;
        }
      };
      const src = Rules.source(c);
      if (src) add(c.id === 'hero' ? src.mods : src.innate && src.innate.mods);
      if (!(opts && opts.noEquip)) for (const s of SLOTS) { const it = itemOf(c.equip && c.equip[s]); if (it) add(it.mods); }
      const C = K.MODCAP;
      if (out.growPct != null) out.growPct = clamp(out.growPct, C.growMin, C.grow);
      if (out.mpCostPct != null) out.mpCostPct = Math.max(C.cost, out.mpCostPct);
      if (out.techCostPct != null) out.techCostPct = Math.max(C.cost, out.techCostPct);
      if (out.encounterPct != null) out.encounterPct = clamp(out.encounterPct, -C.encounter, C.encounter);
      if (out.autoSteal != null) out.autoSteal = clamp(out.autoSteal, 0, C.autoSteal);
      if (out.glimPct) for (const k in out.glimPct) out.glimPct[k] = clamp(out.glimPct[k], C.glimMin, C.glim);
      if (out.profPct) for (const k in out.profPct) out.profPct[k] = clamp(out.profPct[k], C.profMin, C.prof);
      if (out.statusResist) for (const k in out.statusResist) out.statusResist[k] = clamp(out.statusResist[k], -1, 1);
      return out;
    },
    /** 一行の 8 つのキー（§3.3.16）: 出撃中の生きている人の合計、上限つき。party は CharState か id の配列（既定は R.Game.party） */
    partyMods(party) {
      const list = charsOf(party);
      const out = {};
      for (const k of K.PARTY_KEYS) out[k] = 0;
      for (const c of list) {
        if (!c || !(c.hp > 0)) continue;
        const m = Rules.mods(c);
        for (const k of K.PARTY_KEYS) out[k] += m[k] || 0;
      }
      for (const k of ['goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct']) out[k] = Math.min(K.MODCAP.party, out[k]);
      out.preemptPct = Math.min(K.MODCAP.preempt, out.preemptPct);
      for (const k of K.PARTY_KEYS) out[k] = Math.max(K.MODCAP.partyMin, out[k]);
      return out;
    },

    // ------------------------------------------------------------ 能力値と導かれる値（§2.2）
    /** 装備込みの 6 つの能力値: 基本 ＋ 装備の stats（能力値の品と、残したクセの −）。0〜40。割合（XPct）は無い */
    finalStats(c) {
      const b = Rules.baseStats(c);
      for (const s of SLOTS) {
        const it = itemOf(c.equip && c.equip[s]);
        if (!it || !it.stats) continue;
        for (const k of STATS) if (it.stats[k]) b[k] += it.stats[k];
      }
      for (const k of STATS) b[k] = clamp(b[k], 0, CAPS.stat);
      return b;
    },
    wtypeInfo(wtype) {
      const k = K.WTYPE[wtype] || K.WTYPE.fist;
      const d = DB.weaponTypes && DB.weaponTypes[wtype];
      if (!d) return k;
      return Object.assign({}, k, { twoHanded: d.twoHanded != null ? !!d.twoHanded : k.twoHanded, reach: d.reach != null ? !!d.reach : k.reach, kind: d.kind || k.kind });
    },
    /** 1 つの武器の枠（slot null = 素手）の値 */
    weaponInfo(c, slot, fs, m) {
      fs = fs || Rules.finalStats(c);
      m = m || Rules.mods(c);
      const it = slot ? itemOf(c.equip && c.equip[slot]) : null;
      if (slot && !it) return null;
      const wtype = it ? it.wtype : UNARMED;
      const T = Rules.wtypeInfo(wtype);
      const astat = (it && it.astat) || T.stat;
      const S = astat.reduce((a, k) => a + fs[k], 0) / astat.length;
      const Wv = it ? (it.atk || 0) : K.UNARMED.atk;
      return {
        id: it ? c.equip[slot] : null, slot: slot || null, wtype,
        atk: Math.max(0, Math.round((Wv + (m.atk || 0)) * Rules.abilMul(S, K.ABIL.atk))),
        hit: Math.round(K.HIT.base + K.HIT.per * (fs.dex - K.ABIL.mid)) + T.hit + ((it && it.hit) || 0) + (m.hit || 0),
        crit: clamp(Math.floor(K.CRIT.base + K.CRIT.per * (fs.dex - K.ABIL.mid)) + T.crit + ((it && it.crit) || 0) + (m.crit || 0), 0, CAPS.crit),
        element: (it && it.element) || null,
        onHit: (it && it.onHit) || null,
        reach: Rules.reach(it ? c.equip[slot] : null),
        twoHanded: it ? Rules.isTwoHanded(c.equip[slot]) : false,
        kind: (it && it.kind) || T.kind,
        vs: (it && it.vs) || null,
        drain: (it && it.drain) || 0,
        sealTech: !!(it && it.sealTech),
        metalHit: !!(it && it.metalHit),
        mag: it ? (it.mag || 0) : K.UNARMED.mag,
      };
    },
    /**
     * 導かれる値（K.stats の名前）: {maxHp, maxMp, atk, mag, def, mdef, hit, eva, crit, spd, str…mnd, wtype}
     * ＋ hp/mp（= maxHp/maxMp）、w:{weapon1, fist}、elemResist・elemBoost・statusImmune・statusResist・mods（戦闘が読む）
     */
    stats(c) {
      const m = Rules.mods(c);
      const fs = Rules.finalStats(c);
      const s = Object.assign({}, fs);
      s.maxHp = s.hp = Rules.maxOf(c, 'hp', { mods: m, vit: fs.vit });
      s.maxMp = s.mp = Rules.maxOf(c, 'mp', { mods: m });
      const w1 = Rules.weaponInfo(c, 'weapon1', fs, m);
      const fist = Rules.weaponInfo(c, null, fs, m);
      s.w = { weapon1: w1, fist };
      const main = w1 || fist;
      s.wtype = w1 ? w1.wtype : null;
      s.atk = main.atk; s.hit = main.hit; s.crit = main.crit;
      const wm = (w1 && w1.mag) || K.UNARMED.mag;
      s.mag = Math.max(0, Math.round((wm + (m.mag || 0)) * Rules.abilMul(fs.int, K.ABIL.mag)));
      let def = 0, mdef = 0, sheva = 0;
      for (const sl of ARMOR_SLOTS) {
        const it = itemOf(c.equip && c.equip[sl]);
        if (!it) continue;
        def += it.def || 0; mdef += it.mdef || 0;
        if (sl === 'shield') sheva += it.eva || 0;
      }
      s.def = Math.max(0, Math.round((def + (m.def || 0)) * (1 + (m.defPct || 0) / 100)));
      s.mdef = Math.max(0, Math.round(Math.round((mdef + (m.mdef || 0) + K.MDEF.flat) * Rules.abilMul(fs.mnd, K.ABIL.mdef)) * (1 + (m.mdefPct || 0) / 100)));
      s.eva = clamp(Math.max(0, Math.round(K.EVA.base + K.EVA.per * (fs.agi - K.ABIL.mid))) + sheva + (m.eva || 0), 0, CAPS.eva);
      s.spd = Math.max(1, Math.round(K.SPD.base + K.SPD.per * (fs.agi - K.ABIL.mid)) + (m.spd || 0));
      const er = {};
      for (const e of ELEMENTS) er[e] = m.elemResist && m.elemResist[e] != null ? m.elemResist[e] : 1;
      s.elemResist = er;
      s.elemBoost = m.elemBoost || {};
      s.statusImmune = m.statusImmune || [];
      s.statusResist = m.statusResist || {};
      s.healF = Rules.healF(fs);
      s.mods = m;
      return s;
    },
    /**
     * 最大 HP・MP（§9.2）: HP = min(999, round(round(HPbase × abilMul(体力, 0.025)) × (1 + hpPct/100)))、
     * MP = min(250, round(MPbase × (1 + mpPct/100)))。HPbase・MPbase は R.Growth.baseMax（gl と成長の文字）
     */
    maxOf(c, key, pre) {
      const m = (pre && pre.mods) || Rules.mods(c);
      const base = R.Growth.baseMax(c, key);
      let v;
      if (key === 'hp') {
        const vit = pre && pre.vit != null ? pre.vit : Rules.finalStats(c).vit;
        v = Math.round(Math.round(base * Rules.abilMul(vit, K.ABIL.vit)) * (1 + (m.hpPct || 0) / 100));
      } else v = Math.round(base * (1 + (m.mpPct || 0) / 100));
      return clamp(v, key === 'hp' ? 1 : 0, K[key.toUpperCase()].cap);
    },
    isAlive(c) { return !!c && c.hp > 0; },
    /** hp・mp を 0〜最大に */
    clampHpMp(c) {
      const st = Rules.stats(c);
      if (!(c.hp >= 0)) c.hp = 0;
      if (!(c.mp >= 0)) c.mp = 0;
      if (c.hp > st.maxHp) c.hp = st.maxHp;
      if (c.mp > st.maxMp) c.mp = st.maxMp;
      return c;
    },
    /** HP・MP を満たし、状態を消す（生き返る）。1 人だけ。一行は R.Party.restoreAll */
    fullRestore(c) { const st = Rules.stats(c); c.hp = st.maxHp; c.mp = st.maxMp; c.status = []; return c; },
    /**
     * フィールド（メニュー）で道具・術を使ったときの効き目（MENUS の依頼。式は戦闘と同じ = R.Mon.healAmount の決まり）。
     * action は品か技・術の定義（a.use があればそれ）、caster は術を唱える人（道具は null）、targets は CharState の配列。
     * MP の支払いと品の数は呼ぶ側（MENUS）。→ {changed, lines:[文]}
     *   heal: 最大HP × pct × 回復の力（術: HEALF(精神) × (1 + healPct) × 熟練、道具: 1 + 使う人の itemPct）
     *   healMp: ceil(最大MP × pct)、revive: 倒れた人を最大HP × pct（既定 0.25）で、cure: 状態を消す
     *   決まった量 amount があれば 最大値 × pct の代わりにそれ（heal は回復の力を掛ける。revive は最大HP まで、1 以上）
     *   encounter（魔除けの香 pct < 0）・light（松明）は R.Field.encounter.ward / R.Field.light があれば渡す
     *   learnSpell（魔石）: その属性の最初の術を覚える（R.Glimmer.useStone）
     */
    fieldUse(action, caster, targets, o) {
      const a = action || {};
      const use = a.use || a;
      const lines = [];
      let changed = false;
      const cm = caster ? Rules.mods(caster) : null;
      for (const c of targets || []) {
        if (!c) continue;
        const st = Rules.stats(c);
        const hp0 = c.hp, mp0 = c.mp, dead = !(c.hp > 0);
        const mul = caster
          ? Rules.healF(caster) * (1 + ((cm.healPct || 0) / 100)) * (Rules.profPowerMul(caster, a) || 1)
          : 1 + ((Rules.mods(c).itemPct || 0) / 100);
        for (const e of use.effects || []) {
          if (e.type === 'revive' && dead) {
            c.hp = e.amount != null ? Math.max(1, Math.min(st.maxHp, Math.floor(e.amount))) : Math.max(1, Math.floor(st.maxHp * (e.pct != null ? e.pct : 0.25)));
            c.status = [];
          } else if (e.type === 'heal' && c.hp > 0) {
            const n = e.amount != null ? e.amount : e.pct != null ? st.maxHp * e.pct : e.power || 0;
            if (n > 0) c.hp = Math.min(st.maxHp, c.hp + Math.max(1, Math.round(n * mul)));
          } else if (e.type === 'healMp' && c.hp > 0) {
            const n = e.amount != null ? Math.round(e.amount) : e.pct != null ? Math.ceil(st.maxMp * e.pct) : e.power || 0;
            if (n > 0) c.mp = Math.min(st.maxMp, (c.mp || 0) + n);
          } else if (e.type === 'cure' && c.hp > 0 && Array.isArray(c.status) && c.status.length) {
            const list = e.statuses === 'all' || !e.statuses ? null : e.statuses;
            const before = c.status.length;
            c.status = list ? c.status.filter((s) => !list.includes(s)) : [];
            if (c.status.length !== before) { changed = true; lines.push(R.T('sys.rules.fieldUse', { name: c.name })); }
          } else if (e.type === 'learnSpell' && R.Glimmer && R.Glimmer.useStone) {
            // 魔石: その属性の最初の術を覚える（覚えている人・術を使えない人には効かない。R.Glimmer.useStone）
            const r = R.Glimmer.useStone(c, a);
            if (r.ok) { changed = true; lines.push(r.line); }
          }
        }
        if (c.hp !== hp0) { changed = true; lines.push(dead ? R.T('sys.rules.fieldUse_2', { name: c.name }) : R.T('sys.rules.fieldUse_3', { name: c.name, p1: c.hp - hp0 })); }
        if (c.mp !== mp0) { changed = true; lines.push(R.T('sys.rules.fieldUse_4', { name: c.name, p1: c.mp - mp0 })); }
      }
      const F = R.Field;
      for (const e of use.effects || []) {
        if (e.type === 'encounter' && (e.pct || 0) < 0 && F && F.encounter && F.encounter.ward) {
          F.encounter.ward(e.steps || 100); changed = true; lines.push(R.T('sys.rules.fieldUse_5'));
        } else if (e.type === 'encounter' && (e.pct || 0) > 0 && F && F.encounter && F.encounter.lure) {
          F.encounter.lure(e.steps || 100, e.pct); changed = true; lines.push(R.T('sys.rules.fieldUse_6'));
        } else if (e.type === 'light' && F && F.light) {
          F.light(e.r || 6, e.steps || 200); changed = true; lines.push(R.T('sys.rules.fieldUse_7'));
        }
      }
      return { changed, lines };
    },

    // ------------------------------------------------------------ 熟練度（SYSTEMS_REWORK §1、STATS_REWORK §5）
    prof(c, kind, id) { const t = kind === 'e' ? c.eprof : c.wprof; return (t && t[id]) || 0; },
    /** 点 → 段階 1〜100 */
    profRank(pts) {
      const P = K.PROF_PTS;
      pts = +pts || 0;
      let r = 1;
      for (let i = 2; i < P.length; i++) { if (pts >= P[i]) r = i; else break; }
      return r;
    },
    /** 段階 → その段階の最初の点 */
    profPtsOf(rank) { return K.PROF_PTS[clamp(rank | 0, 1, 100)]; },
    rankOf(c, kind, id) { return Rules.profRank(Rules.prof(c, kind, id)); },
    /** 勝ったあとに戻る MP の割合: 武器・属性の熟練度のうち一番高い段階で決まる（K.AFTER.mpByProf） */
    afterWinMpPct(c) {
      const A = K.AFTER || {};
      let top = 0;
      for (const t of [c && c.wprof, c && c.eprof]) if (t) for (const v of Object.values(t)) top = Math.max(top, Rules.profRank(v));
      for (const [r, pct] of (A.mpByProf || [])) if (top >= r) return (A.mpPct || 0) + pct;
      return A.mpPct || 0;
    },
    /** 行動の熟練度の段階: 術 → 属性の段階の平均、技・攻撃 → 今の武器の系統（素手・道具は null） */
    profPowerRank(c, action) {
      if (!c) return null;
      const a = typeof action === 'string' ? (action === 'attack' ? null : actionOf(action)) : action;
      if (a && a.kind === 'spell') {
        const els = (a.elements || []).filter((e) => ELEMENTS.includes(e));
        if (!els.length) return null;
        return els.reduce((s, e) => s + Rules.rankOf(c, 'e', e), 0) / els.length;
      }
      if (a && a.kind !== 'tech') return null;
      const it = itemOf(c.equip && c.equip.weapon1);
      const w = it ? it.wtype : null;
      if (!w || !WTYPES.includes(w)) return null;
      return Rules.rankOf(c, 'w', w);
    },
    profPowerMul(c, action) { const r = Rules.profPowerRank(c, action); return r == null ? 1 : Rules.profPowerOf(r); },
    profPowerOf(r) { const P = K.PROF_POWER; const f = clamp(((+r || 1) - 1) / 99, 0, 1); return 1 + P.max * Math.pow(f, P.exp); },
    profPowerPct(c, action) { return Math.round((Rules.profPowerMul(c, action) - 1) * 100); },
    pexp(T) { if (T == null) T = tierNow(); return K.PEXP[clamp(T | 0, 0, K.PEXP.length - 1)]; },
    profSoft(T) { if (T == null) T = tierNow(); const S = K.PROF_SOFT.rank; return S[clamp(T | 0, 0, S.length - 1)]; },
    /**
     * 標準の進み方の熟練度（点）: そのティアの中ほどの主な武器（K.PROF_TRACK）。フィクスチャ（'auto'）と sim が共有する。
     * kind: 'party'|'main'（主な武器・主な属性）| 'second'（2 つ目、半分）| 'start'（ティアの初め = PEXP）| 'prologue'（序章の終わり、段階 6）
     */
    profAt(tier, kind) {
      const T = clamp(tier | 0, 0, 9);
      if (kind === 'prologue') return K.PROF_PTS[6];
      if (kind === 'start') return K.PEXP[T];
      const v = K.PROF_TRACK[T];
      return kind === 'second' ? Math.round(v / 2) : v;
    },
    /** 点を足す（× (1 + profPct/100)、PEXP より下なら × CATCHUP、柔らかい線より上なら × 0.3）→ {rank, up, pts, from（足す前の段階）} */
    addProf(c, kind, id, pts, opts) {
      const t = kind === 'e' ? (c.eprof = c.eprof || {}) : (c.wprof = c.wprof || {});
      const cur = t[id] || 0;
      let v = pts;
      if (!(opts && opts.raw)) {
        const m = (opts && opts.mods) || Rules.mods(c);
        const T = opts && opts.tier;
        v *= 1 + ((m.profPct && m.profPct[id]) || 0) / 100;
        if (cur < Rules.pexp(T)) v *= K.CATCHUP;
        if (Rules.profRank(cur) >= Rules.profSoft(T)) v *= K.PROF_SOFT.mul;
      }
      const r0 = Rules.profRank(cur);
      t[id] = clamp(round2(cur + v), 0, K.PROF_CAP);
      const r1 = Rules.profRank(t[id]);
      return { rank: r1, up: r1 > r0, pts: t[id], from: r0 };
    },
    /**
     * 熟練度を伸ばす。2 つの呼び方:
     *   train(c, kind, key, n)  kind 'w'|'weapon'|'e'|'element'、key = 系統か属性、n = 点（上の倍率をかける）
     *   train(c, info)          戦闘の 1 行動ごと: info = {kind:'attack'|'tech'|'spell'|'item', wtype?, elements?, actionId?, tier?}（道具は伸ばさない。魔石は術を覚える品になった）
     * → [{kind:'w'|'e', id, rank, from}]（段階が上がったもの。from = 上がる前の段階）
     */
    train(c, kind, key, n) {
      if (!c) return [];
      if (typeof kind === 'string') {
        const k = kind === 'e' || kind === 'element' ? 'e' : 'w';
        if (k === 'w' && !WTYPES.includes(key)) return [];
        if (k === 'e' && !ELEMENTS.includes(key)) return [];
        const r = Rules.addProf(c, k, key, n == null ? 1 : n);
        return r.up ? [{ kind: k, id: key, rank: r.rank, from: r.from }] : [];
      }
      const info = kind;
      if (!info) return [];
      const G = K.PROF_GAIN, ups = [];
      const o = { mods: Rules.mods(c), tier: info.tier };
      const tm = R.Tester ? R.Tester.mul('prof') : 1;   // テスト用メニュー（src/tester/）: 熟練度 ×N。無い・無効なら 1
      const bump = (k, id, pts) => { const r = Rules.addProf(c, k, id, pts * tm, o); if (r.up) ups.push({ kind: k, id, rank: r.rank, from: r.from }); };
      const a = info.actionId && actionOf(info.actionId);
      if (info.kind === 'attack' || info.kind === 'tech') {
        let w = info.wtype;
        if (!w) { const it = itemOf(c.equip && c.equip.weapon1); w = it ? it.wtype : UNARMED; }
        if (!WTYPES.includes(w)) return ups;
        const lv = a && ((a.glim && a.glim.lv) || (a.derived && a.derived.lv));   // 派生技は derived.lv
        bump('w', w, info.kind === 'tech' && lv >= G.techHighLv ? G.techHigh : G.weapon);
      } else if (info.kind === 'spell') {
        const els = (info.elements || (a && a.elements) || []).filter((e) => ELEMENTS.includes(e));
        if (!els.length) return ups;
        const pts = els.length >= 3 ? G.triple : els.length === 2 ? G.pair : spellStep(a) <= 2 ? G.single12 : G.single35;
        for (const e of els) bump('e', e, pts);
      }
      return ups;
    },
    /** 途中で加わる人の熟練度（§4.9.1）: 各系統・属性 max(今, round(PEXP(T) × {S .8 A .7 B .5 C .3 D .1})) */
    catchUpProf(c, T) {
      const P = Rules.pexp(T), L = Rules.aptLetters(c), J = K.JOIN_PROF;
      for (const w of WTYPES) c.wprof[w] = Math.max(c.wprof[w] || 0, Math.round(P * J[L.w[w]]));
      for (const e of ELEMENTS) c.eprof[e] = Math.max(c.eprof[e] || 0, Math.round(P * J[L.e[e]]));
      return c;
    },

    // ------------------------------------------------------------ 装備
    /** 品の枠のまとまり 'weapon'|'shield'|…|'acc'|null */
    slotGroup(itemId) { return slotGroupOfItem(itemOf(itemId)); },
    /** 品が入る人の枠: weapon → weapon1、acc → acc1/acc2、ほかは同じ名前 */
    slotsFor(itemId) {
      const g = Rules.slotGroup(itemId);
      if (!g) return [];
      if (g === 'weapon') return WEAPON_SLOTS.slice();
      if (g === 'acc') return ACC_SLOTS.slice();
      return [g];
    },
    groupOfSlot(slot) { return slot === 'weapon1' ? 'weapon' : slot === 'acc1' || slot === 'acc2' ? 'acc' : slot; },
    /** 品の既定の枠（その人の空いた枠、無ければ最初） */
    defaultSlot(c, itemId) {
      const list = Rules.slotsFor(itemId);
      if (!list.length) return null;
      if (c && c.equip) for (const s of list) if (!c.equip[s]) return s;
      return list[0];
    },
    /** 'weapon' や 'acc' の書き方も人の枠の名前にする */
    charSlot(slot, c, itemId) {
      if (SLOTS.includes(slot)) return slot;
      if (slot === 'weapon') return 'weapon1';
      if (slot === 'acc') return itemId ? Rules.defaultSlot(c, itemId) : 'acc1';
      return slot;
    },
    isTwoHanded(itemId) {
      const it = itemOf(itemId);
      if (!it || it.slot !== 'weapon') return false;
      return !!it.twoHanded || Rules.wtypeInfo(it.wtype).twoHanded;
    },
    hasTwoHanded(c) { return !!(c.equip && c.equip.weapon1 && Rules.isTwoHanded(c.equip.weapon1)); },
    /** 'any'（後列から届く: 弓・杖）か 'front' */
    reach(itemId) {
      const it = itemOf(itemId);
      if (!it || it.slot !== 'weapon') return 'front';
      if (it.reach != null) return it.reach === true || it.reach === 'any' ? 'any' : 'front';
      return Rules.wtypeInfo(it.wtype).reach ? 'any' : 'front';
    },
    /** 装備できない理由（画面の文）か null */
    equipIssue(c, itemOrId, slot) {
      const id = typeof itemOrId === 'string' ? itemOrId : itemOrId && itemOrId.id;
      const it = typeof itemOrId === 'string' ? itemOf(itemOrId) : itemOrId;
      if (!it || !EQUIP_GROUPS.includes(it.slot)) return R.T('sys.rules.equipIssue.ret');
      slot = slot ? Rules.charSlot(slot, c, id) : (id ? Rules.defaultSlot(c, id) : Rules.charSlot(it.slot, c));
      if (!SLOTS.includes(slot) || Rules.groupOfSlot(slot) !== it.slot) return R.T('sys.rules.equipIssue.ret_2');
      if (it.only && !it.only.includes(c.id)) return R.T('sys.rules.equipIssue.ret_3', { name: c.name });
      if (it.gender && c.sex && it.gender !== c.sex) return R.T('sys.rules.equipIssue.ret_3', { name: c.name });
      if (slot === 'shield' && Rules.hasTwoHanded(c)) return R.T('sys.rules.equipIssue.ret_4');
      return null;
    },
    /** 装備できるか（item は id か品の定義） */
    canEquip(c, item, slot) { return !!c && Rules.equipIssue(c, item, slot) === null; },
    /**
     * 袋（R.Game.items、opts.inv）から slot に付ける／外す（itemId null）。前の品は袋へ。両手の武器は盾も外す。
     * → {ok, removed:[id], shieldRemoved, reason?}。失敗したら何も変えない
     */
    equip(c, slot, itemId, opts) {
      const inv = (opts && opts.inv) || gameInv();
      const fail = (reason) => ({ ok: false, removed: [], shieldRemoved: null, reason });
      slot = Rules.charSlot(slot, c, itemId);
      if (!SLOTS.includes(slot)) return fail(R.T('sys.rules.equip.fail'));
      itemId = itemId || null;
      if (itemId && !DB.items[itemId] && DB.itemAlias && DB.itemAlias[itemId]) itemId = DB.itemAlias[itemId];   // 消した品の id → 残した品
      const old = c.equip[slot] || null;
      if (old === itemId) return { ok: true, removed: [], shieldRemoved: null };
      if (itemId) {
        const issue = Rules.equipIssue(c, itemId, slot);
        if (issue) return fail(issue);
        if (!((inv[itemId] || 0) >= 1)) return fail(R.T('sys.rules.equip.fail_2'));
      }
      const back = [];
      if (old) back.push(old);
      const shield = itemId && slot === 'weapon1' && Rules.isTwoHanded(itemId) && c.equip.shield ? c.equip.shield : null;
      if (shield) back.push(shield);
      const cnt = {};
      for (const id of back) cnt[id] = (cnt[id] || 0) + 1;
      for (const id in cnt) {
        const after = (inv[id] || 0) - (id === itemId ? 1 : 0) + cnt[id];
        if (after > K.MAX_ITEM) return fail(R.T('sys.rules.equip.fail_3'));
      }
      if (itemId) invTake(inv, itemId);
      c.equip[slot] = itemId;
      if (shield) c.equip.shield = null;
      for (const id of back) invPut(inv, id);
      Rules.clampHpMp(c);
      return { ok: true, removed: back, shieldRemoved: shield };
    },
    /** 全部外して袋へ（99 を超える品は付けたまま）→ {ok, removed, kept} */
    unequipAll(c, opts) {
      const removed = [], kept = [];
      for (const s of SLOTS) {
        if (!c.equip[s]) continue;
        const id = c.equip[s];
        const r = Rules.equip(c, s, null, opts);
        if (r.ok) removed.push(id); else kept.push(s);
      }
      return { ok: kept.length === 0, removed, kept };
    },
    /** 2 つの stats() の差（DIFF_KEYS 15） */
    diffStats(a, b) { const d = {}; for (const k of DIFF_KEYS) d[k] = statKey(b, k) - statKey(a, k); return d; },
    /**
     * 付け替えたときの差（契約の preview）: slot に itemId（null = 外す）→ {atk, mag, def, mdef, hit, eva, crit, str…mnd, hp, mp}。
     * c と袋は変えない。両手の武器が押し出す盾も数える。slot は 'weapon1'…'acc2' か品の枠の名前（'weapon' 'acc'）
     */
    preview(c, slot, itemId) {
      slot = Rules.charSlot(slot, c, itemId);
      const before = Rules.stats(c);
      const v = virtualChar(c);
      v.equip[slot] = itemId || null;
      if (itemId && slot === 'weapon1' && Rules.isTwoHanded(itemId)) v.equip.shield = null;
      return Rules.diffStats(before, Rules.stats(v));
    },
    previewStats(c, slot, itemId) { return Rules.preview(c, slot, itemId); },
    /**
     * 術の向き（おまかせ装備が武器・防具の mods を量るため）→ {heal, attack}（0〜1）。
     * 仲間の役目が先: healer = 回復だけ {1, 0}、caster = 攻めだけ {0, 1}。ほかの人（主人公も）は覚えた術の割合:
     * 味方に効く回復・蘇生・状態回復の術 = heal、ダメージの術 = attack（補助だけの術は数えない）。術が無ければ {0, 0}
     */
    spellLean(c) {
      const src = c && c.id !== 'hero' ? Rules.source(c) : null;
      const role = src && src.role;
      if (role === 'healer') return { heal: 1, attack: 0 };
      if (role === 'caster') return { heal: 0, attack: 1 };
      let h = 0, a = 0;
      for (const id of (c && c.spells) || []) {
        const d = DB.spells && DB.spells[id];
        if (!d) continue;
        const ef = d.effects || [];
        if (ef.some((e) => e.type === 'damage')) a++;
        else if (/^(ally|allies|ally_dead|party)$/.test(d.target || '') && ef.some((e) => e.type === 'heal' || e.type === 'revive' || e.type === 'cure')) h++;
      }
      const n = h + a;
      return n ? { heal: h / n, attack: a / n } : { heal: 0, attack: 0 };
    },
    /** おまかせ装備の向き: 役目が healer・caster か、回復の術が半分より多い → magic。ほかは 術力の能力（int）が腕力より上なら magic */
    loadoutMode(c) {
      const src = c && c.id !== 'hero' ? Rules.source(c) : null;
      if (src && (src.role === 'healer' || src.role === 'caster')) return 'magic';
      if (Rules.spellLean(c).heal > 0.5) return 'magic';
      const fs = Rules.finalStats(c);
      return fs.int > fs.str ? 'magic' : 'phys';
    },
    /**
     * 最強装備の点（§4.4.1）: phys | magic | balance。
     * lean（Rules.spellLean）と s.mods があれば術の mods も量る（術力に換えて）: 術力 × (attack × magicPct + heal × healPct) / 100。
     * magic は ×1、balance は ×0.5、phys は数えない（戦士の点は前と同じ）。
     * 回復は術力を使わないが、同じ物差しに乗せるため術力を単位にする（祈りの杖: 術力 × 0.9 でも healPct +20 で 回復役には上）
     */
    loadoutScore(s, mode, lean) {
      const phys = statKey(s, 'atk') + 0.6 * s.def + 0.3 * s.mdef;
      const magic = s.mag + 0.6 * s.mdef + 0.3 * s.def;
      const m = s.mods, w = mode === 'magic' ? 1 : mode === 'balance' ? 0.5 : 0;
      const modV = lean && m && w ? w * (s.mag || 0) * ((lean.attack || 0) * (m.magicPct || 0) + (lean.heal || 0) * (m.healPct || 0)) / 100 : 0;
      if (mode === 'magic') return magic + modV;
      if (mode === 'balance') return (phys + magic) / 2 + modV;
      return phys;
    },
    /**
     * 最強装備（§4.4.1。A3: アクセ 2 枠は変えない）— 計算だけ（c・袋・ほかの人は変えない）。
     * 変えるのは武器・盾・頭・体・手・足。クセの品・武器の系統・空の武器の枠はそのまま。候補は袋と今付けている品。
     * → Plan {mode, equip, changes:[{slot, from, to}], diff, score}
     */
    optimize(c, mode, opts) {
      mode = mode === 'magic' || mode === 'balance' ? mode : 'phys';
      const inv = Object.assign({}, (opts && opts.inv) || gameInv());
      const before = Rules.stats(c);
      const lean = Rules.spellLean(c);
      const locked = {};
      for (const s of OPT_SLOTS) { const it = itemOf(c.equip[s]); if (it && it.quirk) locked[s] = true; }
      const v = virtualChar(c);
      for (let pass = 0; pass < 2; pass++) {
        for (const s of OPT_ORDER) {
          if (locked[s]) continue;
          if (s === 'shield' && Rules.hasTwoHanded(v)) { if (v.equip.shield) { invPut(inv, v.equip.shield, true); v.equip.shield = null; } continue; }
          const cur = v.equip[s];
          let wtype = null;
          if (s === 'weapon1') { const it = itemOf(cur); if (!it) continue; wtype = it.wtype; }
          const cands = [cur];
          for (const id in inv) {
            if (!(inv[id] > 0) || id === cur) continue;
            const it = itemOf(id);
            if (!it || it.quirk || Rules.groupOfSlot(s) !== it.slot) continue;
            if (wtype && it.wtype !== wtype) continue;
            if (it.only && !it.only.includes(c.id)) continue;
            if (it.gender && c.sex && it.gender !== c.sex) continue;
            cands.push(id);
          }
          let best = cur, bestScore = -Infinity;
          for (const id of cands) {
            const t = virtualChar(v);
            t.equip[s] = id;
            if (id && s === 'weapon1' && Rules.isTwoHanded(id)) t.equip.shield = null;
            const sc = Rules.loadoutScore(Rules.stats(t), mode, lean);
            if (sc > bestScore + 1e-9 || (Math.abs(sc - bestScore) <= 1e-9 && better(itemOf(id), itemOf(best), id === cur, best === cur))) { best = id; bestScore = sc; }
          }
          if (best !== cur) {
            if (cur) invPut(inv, cur, true);
            if (best) inv[best] = (inv[best] || 0) - 1;
            v.equip[s] = best;
            if (best && s === 'weapon1' && Rules.isTwoHanded(best) && v.equip.shield) { invPut(inv, v.equip.shield, true); v.equip.shield = null; }
          }
        }
      }
      const equip = {};
      for (const s of OPT_SLOTS) equip[s] = v.equip[s] || null;
      const changes = [];
      for (const s of OPT_ORDER) if ((c.equip[s] || null) !== equip[s]) changes.push({ slot: s, from: c.equip[s] || null, to: equip[s] });
      return { mode, equip, changes, diff: Rules.diffStats(before, Rules.stats(v)), score: round2(Rules.loadoutScore(Rules.stats(v), mode, lean)) };
    },
    /** Plan を当てる（R.Rules.equip を枠の順に）。途中で失敗したら全部戻す → {ok, removed, reason?} */
    applyLoadout(c, plan, opts) {
      const inv = (opts && opts.inv) || gameInv();
      const changes = (plan && plan.changes) || [];
      if (!changes.length) return { ok: true, removed: [] };
      const snapEquip = Object.assign({}, c.equip), snapInv = Object.assign({}, inv), snapHp = [c.hp, c.mp];
      const restore = () => {
        Object.assign(c.equip, snapEquip);
        for (const k of Object.keys(inv)) delete inv[k];
        Object.assign(inv, snapInv);
        c.hp = snapHp[0]; c.mp = snapHp[1];
      };
      const o = { inv };
      const alive = c.hp > 0;
      const wanted = new Set(changes.map((ch) => ch.to).filter(Boolean));
      for (const ch of changes) if (ch.from && wanted.has(ch.from)) { const r = Rules.equip(c, ch.slot, null, o); if (!r.ok) { restore(); return { ok: false, removed: [], reason: r.reason }; } }
      for (const ch of changes) { const r = Rules.equip(c, ch.slot, ch.to, o); if (!r.ok) { restore(); return { ok: false, removed: [], reason: r.reason }; } }
      if (alive && c.hp <= 0) c.hp = 1;
      const now = new Set(SLOTS.map((s) => c.equip[s]).filter(Boolean));
      const removed = [];
      for (const s of SLOTS) { const id = snapEquip[s]; if (id && !now.has(id) && !removed.includes(id)) removed.push(id); }
      return { ok: true, removed };
    },

    // ------------------------------------------------------------ 戦闘の命令（§3.3.3、A29）
    /** 命令の一覧（契約の commandList）: ['attack', 'skill'?, 'spell'?, 'defend', 'item']。技は今の武器の系統の技を覚えていれば */
    commandList(c) {
      const out = ['attack'];
      if (Rules.techList(c).length) out.push('skill');
      if ((c.spells || []).length && !Rules.mods(c).noSpell) out.push('spell');
      out.push('defend', 'item');
      return out;
    },
    /** 今の武器の系統（素手は 'fist'） */
    weaponType(c) { const it = itemOf(c && c.equip && c.equip.weapon1); return it ? it.wtype : UNARMED; },
    /** 覚えた技のうち、その系統の技（既定は今の武器の系統。技を封じる武器なら []）。データの順 */
    techList(c, wtype) {
      const it = itemOf(c.equip && c.equip.weapon1);
      if (wtype == null) wtype = it ? it.wtype : UNARMED;
      if (it && it.sealTech && wtype === it.wtype) return [];
      return sortActions((c.techs || []).filter((id) => { const a = actionOf(id); return a && a.kind === 'tech' && a.wtype === wtype; }));
    },
    /** 技が今使えない理由: null | 'noweapon'（その系統の武器を持っていない。A29）| 'reach'（後列から届かない） */
    techIssue(c, id, row) {
      const a = actionOf(id);
      if (!a || a.kind !== 'tech') return null;
      if (Rules.weaponType(c) !== a.wtype) return 'noweapon';
      if ((row === 'back' || row === 'middle') && !a.reach) return 'reach';
      return null;
    },
    spellList(c) { return sortActions((c.spells || []).filter((id) => actionOf(id))); },
    /** 覚えた技すべて（系統の順 → データの順） */
    allTechs(c) { const out = []; for (const w of WTYPES) out.push(...Rules.techList(c, w)); return out; },
    fieldSpells(c) { return Rules.spellList(c).filter((id) => actionOf(id).field === true); },
    /** 行動の MP（A18: 技も術も MP）。技 max(1, round(mp × (1 + techCostPct/100)))、術は熟練の割引の後に mpCostPct */
    mpCost(c, actionId) { return costOf(c, actionId); },
    profMpKind(c, actionId) {
      const a = typeof actionId === 'string' ? actionOf(actionId) : actionId;
      if (!a || !a.mp) return null;
      const b = profMpBase(c, a);
      return b === a.mp ? null : b === 0 ? 'free' : 'half';
    },
    /** 後列の人は、生きている前列の人がいなければ前列として扱う（§4.5.3） */
    effectiveRow(c, party) {
      const row = rowOf(c);
      if (row !== 'back') return 'front';
      const list = charsOf(party);
      return list.some((m) => m && rowOf(m) !== 'back' && m.hp > 0) ? 'back' : 'front';
    },

    // ------------------------------------------------------------ 品の数値（§3.1〜§3.3、DESIGN §8.2.9）
    /** 能力値の品の値（§3.1）: it.abil（{str:1} か 0）が優先、無ければ ABIL_GEAR[等級][枠][T] を units の文字に配る */
    abilOf(it) {
      if (!it) return {};
      if (it.abil === 0) return {};
      if (it.abil && typeof it.abil === 'object') return Object.assign({}, it.abil);
      const t = K.ABIL_GEAR[it.grade];
      if (!t) return {};
      const g = it.slot === 'weapon' || it.slot === 'body' || it.slot === 'acc' ? it.slot : 'armor';
      const v = t[g][clamp(it.tier | 0, 0, 9)];
      const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
      const letters = String(it.units || '').replace(/\d/g, '').split('').filter((ch) => SK[ch]);
      const out = {};
      if (!v || !letters.length) return out;
      if (letters.length === 1) out[SK[letters[0]]] = v;
      else {
        out[SK[letters[0]]] = Math.ceil(v / 2);
        if (Math.floor(v / 2)) out[SK[letters[1]]] = (out[SK[letters[1]]] || 0) + Math.floor(v / 2);
      }
      return out;
    },
    /**
     * 品の数値を埋める（書いてある値は残す）: stats（能力値。abil ＋ クセの statsAdd）・atk・mag・twoHanded・def・mdef・eva・price・sort・icon・desc。
     *   武器 atk = round(WA[T] × (mult ?? 系統の mult) × GRADE_ATK)、mag = round(WA[T] × (magMult ?? 系統の magMult) × GRADE_ATK)
     *   （品の magMult: 祈りの杖の系列 0.9。持ち主「見習いの杖と祈りの杖、効果同じじゃねえかｗ」で杖の 2 系列を役目で分けた）
     *   防具 def = round(割合 × D(T) × 重さの def × GRADE_DEF)、mdef も同じ
     * fillItem(item, {tier}) で item.grow === 'tier'（伸びる一品物）なら、そのティアの値の新しい物を返す（元は変えない）。
     */
    fillItem(it, o) {
      if (!it) return it;
      if (o && o.tier != null && it.grow === 'tier') {
        const copy = Object.assign({}, it, { tier: clamp(o.tier | 0, 0, 9) });
        for (const k of ['atk', 'mag', 'def', 'mdef', 'eva', 'stats', 'twoHanded', 'sort']) delete copy[k];
        Object.defineProperty(copy, '_filled', { value: false, enumerable: false, writable: true });
        return Rules.fillItem(copy);
      }
      const T = clamp(it.tier | 0, 0, 9), g = it.grade || 'normal';
      if (it.stats === undefined && EQUIP_GROUPS.includes(it.slot)) {
        const st = Rules.abilOf(it);
        if (it.statsAdd) for (const k in it.statsAdd) st[k] = (st[k] || 0) + it.statsAdd[k];
        it.stats = st;
      }
      if (it.slot === 'weapon') {
        const w = K.WTYPE[it.wtype] || K.WTYPE.fist;
        const ga = K.GRADE_ATK[g] || 1;
        if (it.atk === undefined) it.atk = Math.round(K.WA[T] * (typeof it.mult === 'number' ? it.mult : w.mult) * ga);
        if (it.mag === undefined) it.mag = Math.round(K.WA[T] * (typeof it.magMult === 'number' ? it.magMult : w.magMult) * ga);
        if (Rules.wtypeInfo(it.wtype).twoHanded) it.twoHanded = true;
      } else if (K.SLOT_SHARE[it.slot] !== undefined) {
        const wt = K.WEIGHT[it.weight] || K.WEIGHT.light, D = K.D(T), sh = K.SLOT_SHARE[it.slot], gd = K.GRADE_DEF[g] || 1;
        if (it.def === undefined) it.def = Math.round(sh * D * wt.def * gd);
        if (it.mdef === undefined) it.mdef = Math.round(sh * D * wt.mdef * gd);
        if (it.slot === 'shield' && it.eva === undefined) it.eva = wt.eva;
      }
      if (it.price === undefined && EQUIP_GROUPS.includes(it.slot)) {
        if (it.src === 'relic') it.price = K.RELIC_PRICE[g] || K.RELIC_PRICE.rare;
        else if (it.src === 'reward' || it.src === 'unique' || it.unique) it.price = 0;
        else it.price = Math.round(K.PRICE[T] * K.PRICE_SLOT[it.slot] / 10) * 10 * (K.PRICE_GRADE[g] || 1);
      }
      if (it.icon === undefined) it.icon = Rules.defaultIcon(it);
      if (it.sort === undefined && EQUIP_GROUPS.includes(it.slot)) {
        const off = it.src === 'relic' || it.src === 'reward' || it.src === 'unique' ? 90 : it.src === 'steal' ? 80 : g === 'super' ? 70 : g === 'rare' ? 50 : 0;
        it.sort = T * 100 + (it.lineNo | 0) + off;
      }
      if (!it.desc) it.desc = Rules.autoDesc(it);
      return it;
    },
    /** 全部の品を埋める（R.onData。companions.js の hook が呼ぶ）→ 埋めた数 */
    fillAll() {
      let n = 0;
      for (const id of Object.keys(DB.items)) {
        const it = DB.items[id];
        if (!it || it.slot === 'key') continue;
        try { Rules.fillItem(it); n++; } catch (e) { R.loadErrors.push(`fillItem ${id}: ${e && e.message}`); }
      }
      return n;
    },
    /** R.Contract.ICONS の名前 */
    defaultIcon(it) {
      if (it.slot === 'weapon') return it.wtype || 'sword';
      return { shield: 'shield', head: 'helm', body: 'armor', hands: 'glove', feet: 'boots', acc: 'ring', key: 'key' }[it.slot] || 'potion';
    },
    /** 品の説明（2 行 × 20 字、DESIGN §8.2.7）。効果の文 → クセの文（「ただし〜」） */
    autoDesc(it) {
      if (!it) return '';
      const statKeys = STATS.filter((k) => it.stats && it.stats[k] > 0);
      const statLine = statKeys.length ? R.T('sys.rules.autoDesc.statLine', { joinTo: joinTo(statKeys.map((k) => STAT_NAMES[k])) }) : '';
      const fx = effectSentences(it);
      if (!fx.good.length && !fx.bad.length) {
        let first = '';
        if (it.slot === 'weapon') first = (DB.weaponTypes[it.wtype] && DB.weaponTypes[it.wtype].desc) || (R.T('sys.rules.autoDesc.first', { wtypeName: wtypeName(it.wtype) }));
        else if (K.SLOT_SHARE[it.slot] !== undefined) first = { heavy: R.T('sys.rules.autoDesc.first.heavy'), light: R.T('sys.rules.autoDesc.first.light'), cloth: R.T('sys.rules.autoDesc.first.cloth') }[it.weight] || R.T('sys.rules.autoDesc.first_2');
        else if (it.slot === 'acc') first = R.T('sys.rules.autoDesc.first_3');
        return [first, statLine].filter(Boolean).join('\n');
      }
      const d = packDesc(fx.good, fx.bad, statLine);
      // 通常品の武器: 効果が 1 行に収まれば、2 行目に系統の説明（後列から届く など）を残す。同じ系統の店の品の違いが 1 行目で見える
      //（持ち主「見習いの杖と祈りの杖、効果同じじゃねえかｗ」）
      // 系統より術力が低い杖（祈りの杖の系列 magMult 0.9）は、系統の説明「術力が高く、〜」の代わりに「術力は控えめで、〜」
      //（テスター 2026-09-30 1-8: 説明は「術力が高い」なのに、見習いの杖と比べると術力が下がる）
      const magLow = it.slot === 'weapon' && it.wtype === 'staff' && K.WTYPE.staff && typeof it.magMult === 'number' && it.magMult < K.WTYPE.staff.magMult;
      if (it.slot === 'weapon' && (it.grade || 'normal') === 'normal' && d && !/\n/.test(d)) {
        const wd = magLow ? R.T('sys.rules.autoDesc.staffLowMag') : DB.weaponTypes[it.wtype] && DB.weaponTypes[it.wtype].desc;
        if (wd && Rules.textWidth(wd) <= 20) return d + '\n' + wd;
      }
      return d;
    },
    textWidth(s) { let w = 0; for (const ch of String(s)) w += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.5 : 1; return w; },

    // ------------------------------------------------------------ 宝箱・店
    /**
     * 宝箱の中身（V2_PLAN §2.11）→ K.chestLoot {item, n, grade} | {gold}。chest = objects[type:'chest']、tier = 開けたときのティア、
     * rng = R.rng(seed + ':' + map + ':' + chestId)（{next} か関数）。pool: 'p_T'（ティア宝箱）| 'p_rare'（レアの箱）| ほかのプール
     */
    chestLoot(chest, tier, rng) {
      chest = chest || {};
      if (chest.gold) return { gold: chest.gold };
      if (chest.item) { const it = itemOf(chest.item); return { item: chest.item, n: chest.n || 1, grade: (it && it.grade) || 'normal' }; }
      const next = typeof rng === 'function' ? rng : rng && typeof rng.next === 'function' ? () => rng.next() : Math.random;
      const T = clamp((tier == null ? tierNow() : tier) | 0, 0, 9);
      const pick = (poolId) => {
        const P = DB.pools[poolId];
        const list = P && P.tiers && P.tiers[T];
        if (!list || !list.length) return null;
        let total = 0;
        for (const e of list) total += e.w || 1;
        let r = next() * total;
        for (const e of list) { r -= e.w || 1; if (r < 0) return e; }
        return list[list.length - 1];
      };
      const e = pick(chest.pool || 'p_T') || pick('p_T') || pick('p_supply');
      if (!e) return { gold: (R.Pools && R.Pools.GOLD[T]) || 50 };
      if (e.gold) return { gold: e.gold };
      const it = itemOf(e.item);
      return { item: e.item, n: e.n || 1, grade: (it && it.grade) || (chest.pool === 'p_rare' ? 'rare' : 'normal') };
    },
    /** 店に並ぶ品（R.DB.shops[id]、tier の既定は R.Tier.get()）: keepOld なら段を足し、そうでなければ条件を満たすいちばん新しい段 */
    shopItems(id, tier) {
      const s = DB.shops[id];
      if (!s) return [];
      const T = tier == null ? ((R.Tier && R.Tier.get ? R.Tier.get() : (R.Game && R.Game.tier)) | 0) : tier | 0;
      const steps = Object.keys(s.tier || {}).map(Number).filter((t) => t <= T).sort((a, b) => a - b);
      if (s.keepOld === false) return (steps.length ? s.tier[steps[steps.length - 1]] : s.items).slice();
      let out = (s.items || []).slice();
      for (const t of steps) out = out.concat(s.tier[t]);
      return uniq(out);
    },
    /** 売値（半分、0 は売れない） */
    sellPrice(id) { const it = itemOf(id); return it && it.price > 0 && it.slot !== 'key' ? Math.floor(it.price / 2) : 0; },
  });

  // ------------------------------------------------------------ 補助
  const OPT_SLOTS = ['weapon1', 'shield', 'head', 'body', 'hands', 'feet'];
  const OPT_ORDER = ['weapon1', 'body', 'shield', 'head', 'hands', 'feet'];
  function charsOf(list) {
    const G = R.Game;
    if (!list) list = (G && G.party) || [];
    return list.map((x) => (typeof x === 'string' ? G && G.chars && G.chars[x] : x)).filter(Boolean);
  }
  function wtypeName(w) { if (w === UNARMED) return UNARMED_NAME; return (DB.weaponTypes[w] && DB.weaponTypes[w].name) || WTYPE_NAMES[w] || w; }
  function rowOf(m) { const r = (m && m.row) || 'front'; return r === 'middle' ? 'back' : r; }
  function statKey(s, k) {
    if (k === 'atk') return s.w && s.w.weapon1 ? s.w.weapon1.atk : s.w ? s.w.fist.atk : s.atk || 0;
    if (k === 'hit') return s.w && s.w.weapon1 ? s.w.weapon1.hit : s.w ? s.w.fist.hit : s.hit || 0;
    if (k === 'crit') return s.w && s.w.weapon1 ? s.w.weapon1.crit : s.w ? s.w.fist.crit : s.crit || 0;
    if (k === 'hp') return s.maxHp != null ? s.maxHp : s.hp || 0;
    if (k === 'mp') return s.maxMp != null ? s.maxMp : s.mp || 0;
    return s[k] || 0;
  }
  function virtualChar(c) { return Object.assign({}, c, { equip: Object.assign({}, c.equip) }); }
  function invTake(inv, id) { inv[id] = (inv[id] || 0) - 1; if (inv[id] <= 0) delete inv[id]; }
  function invPut(inv, id, noCap) { inv[id] = noCap ? (inv[id] || 0) + 1 : Math.min(K.MAX_ITEM, (inv[id] || 0) + 1); }
  function better(a, b, aCur, bCur) {
    const ta = (a && a.tier) || 0, tb = (b && b.tier) || 0;
    if (ta !== tb) return ta > tb;
    const pa = (a && a.price) || 0, pb = (b && b.price) || 0;
    if (pa !== pb) return pa > pb;
    return aCur && !bCur;
  }
  function spellStep(a) {
    if (!a) return 1;
    if (a.step) return a.step;
    const lv = (a.glim && a.glim.lv) || a.rank || 1;
    return lv <= 1 ? 1 : lv === 2 ? 2 : lv <= 4 ? 3 : lv <= 6 ? 4 : 5;
  }
  function profMpBase(c, a) {
    if (!a || a.kind !== 'spell' || !a.mp || !c) return a ? a.mp || 0 : 0;
    const els = a.elements || [];
    if (els.length !== 1) return a.mp;
    const P = K.PROF_MP, r = Rules.rankOf(c, 'e', els[0]), step = Number(a.step) || 0;
    // いちばん下の段は「ただ」にしない（持ち主 2026-10-01「MP0 になると常時満タンにできてバランスがおかしい。MP は最低 1 か 2 は使う」）:
    //   攻めの術は 1、回復の術は 2（元の MP より高くはしない）
    if (step === P.freeStep && r >= P.freeRank) return Math.min(a.mp, (a.effects || []).some((e) => e && (e.type === 'heal' || e.type === 'revive')) ? 2 : 1);
    if (step === P.halfStep && r >= P.halfRank) return Math.max(1, Math.ceil(a.mp / 2));
    return a.mp;
  }
  function costOf(c, actionId) {
    const a = typeof actionId === 'string' ? actionOf(actionId) : actionId;
    if (!a || !a.mp) return 0;
    const m = Rules.mods(c), cap = K.MODCAP.cost;
    if (a.kind === 'tech') return Math.max(1, Math.round(a.mp * (1 + Math.max(cap, m.techCostPct || 0) / 100)));
    const b = profMpBase(c, a);
    if (!b) return 0;
    const pct = Math.max(cap, m.mpCostPct || 0);
    const v = b * (100 + pct) / 100;
    return Math.max(1, pct < 0 ? Math.floor(v + 1e-9) : Math.ceil(v - 1e-9));
  }
  let actIdx = null, actIdxN = -1;
  function sortActions(ids) {
    const A = Object.assign({}, DB.techs || {}, DB.spells || {});
    const keys = Object.keys(A);
    if (!actIdx || actIdxN !== keys.length) { actIdx = {}; keys.forEach((k, i) => { actIdx[k] = i; }); actIdxN = keys.length; }
    const ord = (id) => { const a = actionOf(id); if (a && a.order != null) return a.order; return 1e6 + (actIdx[id] || 0); };
    return uniq(ids).sort((x, y) => ord(x) - ord(y) || (actIdx[x] || 0) - (actIdx[y] || 0));
  }
  function joinTo(names) { return names.length <= 1 ? names.join('') : R.T('sys.rules.joinTo.ret', { join: names.slice(0, -1).join(R.T('sys.rules.joinTo.join')), p1: names[names.length - 1] }); }
  function joinDot(names) { return names.join(R.T('sys.rules.joinDot.join')); }

  // ------------------------------------------------------------ 効果の文（DESIGN §8.2.7）
  const STATUS_NAMES = { poison: R.T('sys.rules.STATUS_NAMES.poison'), burn: R.T('sys.rules.STATUS_NAMES.burn'), sleep: R.T('sys.rules.STATUS_NAMES.sleep'), paralyze: R.T('sys.rules.STATUS_NAMES.paralyze'), freeze: R.T('sys.rules.STATUS_NAMES.freeze'), stun: R.T('sys.rules.STATUS_NAMES.stun'), confuse: R.T('sys.rules.STATUS_NAMES.confuse'), silence: R.T('sys.rules.STATUS_NAMES.silence'), blind: R.T('sys.rules.STATUS_NAMES.blind'), death: R.T('sys.rules.STATUS_NAMES.death') };
  const STATUS_VERB = { poison: R.T('sys.rules.STATUS_VERB.poison'), burn: R.T('sys.rules.STATUS_VERB.burn'), sleep: R.T('sys.rules.STATUS_VERB.sleep'), paralyze: R.T('sys.rules.STATUS_VERB.paralyze'), freeze: R.T('sys.rules.STATUS_VERB.freeze'), stun: R.T('sys.rules.STATUS_VERB.stun'), confuse: R.T('sys.rules.STATUS_VERB.confuse'), silence: R.T('sys.rules.STATUS_VERB.silence'), blind: R.T('sys.rules.STATUS_VERB.blind'), death: R.T('sys.rules.STATUS_VERB.death') };
  const RACE_NAMES = { beast: R.T('sys.rules.RACE_NAMES.beast'), bird: R.T('sys.rules.RACE_NAMES.bird'), insect: R.T('sys.rules.RACE_NAMES.insect'), plant: R.T('sys.rules.RACE_NAMES.plant'), aquatic: R.T('sys.rules.RACE_NAMES.aquatic'), dragon: R.T('sys.rules.RACE_NAMES.dragon'), undead: R.T('sys.rules.RACE_NAMES.undead'), demon: R.T('sys.rules.RACE_NAMES.demon'), spirit: R.T('sys.rules.RACE_NAMES.spirit'), construct: R.T('sys.rules.RACE_NAMES.construct'), slime: R.T('sys.rules.RACE_NAMES.slime'), humanoid: R.T('sys.rules.RACE_NAMES.humanoid'), fairy: R.T('sys.rules.RACE_NAMES.fairy'), boss: R.T('sys.rules.RACE_NAMES.boss'), rare: R.T('sys.rules.RACE_NAMES.rare'), metal: R.T('sys.rules.RACE_NAMES.metal'), flying: R.T('sys.rules.RACE_NAMES.flying') };
  const BUFF_NAMES = { atk: R.T('sys.rules.BUFF_NAMES.atk'), def: R.T('sys.rules.BUFF_NAMES.def'), mag: R.T('sys.rules.BUFF_NAMES.mag'), mdef: R.T('sys.rules.BUFF_NAMES.mdef'), agi: R.T('sys.rules.BUFF_NAMES.agi') };
  const elName = (e) => (DB.elements[e] && DB.elements[e].name) || ELEMENT_NAMES[e] || e;
  const stName = (s) => (DB.statuses[s] && DB.statuses[s].name) || STATUS_NAMES[s] || s;
  const keyName = (k) => (ELEMENT_NAMES[k] ? elName(k) : WTYPE_NAMES[k] ? wtypeName(k) : k);
  function effectSentences(it) {
    const good = [], bad = [];
    const m = it.mods || {};
    const G = (l, s) => good.push([l, s || l]);
    const B = (l, s) => bad.push([l, s || l]);
    if (it.slot === 'weapon') {
      if (it.element) G(R.T('sys.rules.effectSentences.G', { elName: elName(it.element) }), R.T('sys.rules.effectSentences.G_2', { elName: elName(it.element) }));
      if (it.onHit && it.onHit.status) { const v = STATUS_VERB[it.onHit.status] || R.T('sys.rules.effectSentences.v', { stName: stName(it.onHit.status) }); G(R.T('sys.rules.effectSentences.G_3', { v }), R.T('sys.rules.effectSentences.G_3s', { v })); }
      if (it.vs) { const ks = Object.keys(it.vs).filter((k) => it.vs[k] > 1); if (ks.length) G(R.T('sys.rules.effectSentences.G_4', { joinDot: joinDot(ks.map((k) => RACE_NAMES[k] || stName(k))) })); }
      if (it.drain) G(R.T('sys.rules.effectSentences.G_5'), R.T('sys.rules.effectSentences.G_6'));
      if (it.metalHit) G(R.T('sys.rules.effectSentences.G_7'));
      if (it.crit > 0) G(R.T('sys.rules.effectSentences.G_8'));
      if (it.hit > 0 && !(it.art === 'club' || it.art === 'rapier')) G(R.T('sys.rules.effectSentences.G_9'));
      if (it.hit < 0) B(R.T('sys.rules.effectSentences.B'));
      if (it.sealTech) B(R.T('sys.rules.effectSentences.B_2'));
    }
    if (it.quirk && K.SLOT_SHARE[it.slot] !== undefined && it.def === 0 && it.mdef === 0) B(R.T('sys.rules.effectSentences.B_3'), R.T('sys.rules.effectSentences.B_4'));
    if (m.elemResist) {
      const by = {};
      for (const e of ELEMENTS) if (m.elemResist[e] != null) (by[m.elemResist[e]] = by[m.elemResist[e]] || []).push(elName(e));
      for (const v of Object.keys(by).map(Number).sort((a, b) => a - b)) {
        const n = joinDot(by[v]);
        if (v < 0) G(R.T('sys.rules.effectSentences.G_10', { n }), R.T('sys.rules.effectSentences.G_11', { n }));
        else if (v === 0) G(R.T('sys.rules.effectSentences.G_12', { n }), R.T('sys.rules.effectSentences.G_13', { n }));
        else if (v < 1) G(R.T('sys.rules.effectSentences.G_14', { n }), R.T('sys.rules.effectSentences.G_15', { n }));
        else if (v > 1) B(R.T('sys.rules.effectSentences.B_5', { n }), R.T('sys.rules.effectSentences.B_6', { n }));
      }
    }
    if (m.elemBoost) { const ks = ELEMENTS.filter((e) => m.elemBoost[e] > 0); if (ks.length) { const n = joinDot(ks.map(elName)); G(R.T('sys.rules.effectSentences.G_16', { n }), R.T('sys.rules.effectSentences.G_17', { n })); } }
    if (m.statusImmune && m.statusImmune.length) G(R.T('sys.rules.effectSentences.G_18', { joinDot: joinDot(m.statusImmune.map(stName)) }));
    if (m.statusResist) {
      const pos = Object.keys(m.statusResist).filter((s) => m.statusResist[s] > 0);
      const neg = Object.keys(m.statusResist).filter((s) => m.statusResist[s] < 0);
      if (pos.length) G(R.T('sys.rules.effectSentences.G_19', { joinDot: joinDot(pos.map(stName)) }));
      if (neg.length) B(R.T('sys.rules.effectSentences.B_7', { joinDot: joinDot(neg.map(stName)) }));
    }
    if (it.statsAdd) { const ks = STATS.filter((k) => it.statsAdd[k] < 0); if (ks.length) B(R.T('sys.rules.effectSentences.B_8', { joinTo: joinTo(ks.map((k) => STAT_NAMES[k])) })); }
    for (const k of ['hp', 'mp']) { const v = m[k + 'Pct'], nm = STAT_NAMES[k]; if (v > 0) G(R.T('sys.rules.effectSentences.G_20', { nm })); else if (v < 0) B(R.T('sys.rules.effectSentences.B_9', { nm })); }
    if (m.regen) G(R.T('sys.rules.effectSentences.G_21'), R.T('sys.rules.effectSentences.G_22'));
    if (m.mpRegen > 0) G(R.T('sys.rules.effectSentences.G_23'), R.T('sys.rules.effectSentences.G_24'));
    if (m.startBuffs) {
      const ks = Object.keys(m.startBuffs).filter((k) => m.startBuffs[k] > 0);
      if (ks.length) { const n = joinTo(ks.map((k) => BUFF_NAMES[k] || k)); G(R.T('sys.rules.effectSentences.G_25', { n }), R.T('sys.rules.effectSentences.G_26', { n })); }
    }
    if (m.atk > 0) G(R.T('sys.rules.effectSentences.G_27'));
    if (m.mag > 0) G(R.T('sys.rules.effectSentences.G_28'));
    if (m.def > 0) G(R.T('sys.rules.effectSentences.G_29'));
    if (m.mdef > 0) G(R.T('sys.rules.effectSentences.G_30'));
    if (m.defPct > 0) G(R.T('sys.rules.effectSentences.G_31'), R.T('sys.rules.effectSentences.G_29'));
    if (m.mdefPct > 0) G(R.T('sys.rules.effectSentences.G_32'), R.T('sys.rules.effectSentences.G_30'));
    if (m.physPct > 0) G(R.T('sys.rules.effectSentences.G_33'), R.T('sys.rules.effectSentences.G_34'));
    // magicPct は術のダメージだけに効く（battle_core の magic。回復は healPct）ので「攻撃の術」と書く
    if (m.magicPct > 0) G(R.T('sys.rules.effectSentences.G_35'), R.T('sys.rules.effectSentences.G_36'));
    if (m.physPct < 0) B(R.T('sys.rules.effectSentences.B_10'), R.T('sys.rules.effectSentences.B_11'));
    if (m.magicPct < 0) B(R.T('sys.rules.effectSentences.B_12'), R.T('sys.rules.effectSentences.B_13'));
    if (m.healPct > 0) G(R.T('sys.rules.effectSentences.G_37'), R.T('sys.rules.effectSentences.G_38'));
    if (m.itemPct > 0) G(R.T('sys.rules.effectSentences.G_39'));
    if (m.mpCostPct < 0 && m.techCostPct < 0) G(R.T('sys.rules.effectSentences.G_40'), R.T('sys.rules.effectSentences.G_41'));
    else if (m.mpCostPct < 0) G(R.T('sys.rules.effectSentences.G_42'), R.T('sys.rules.effectSentences.G_41'));
    else if (m.techCostPct < 0) G(R.T('sys.rules.effectSentences.G_43'), R.T('sys.rules.effectSentences.G_44'));
    if (m.mpCostPct > 0 && m.techCostPct > 0) B(R.T('sys.rules.effectSentences.B_14'), R.T('sys.rules.effectSentences.B_15'));
    else if (m.mpCostPct > 0) B(R.T('sys.rules.effectSentences.B_16'), R.T('sys.rules.effectSentences.B_15'));
    else if (m.techCostPct > 0) B(R.T('sys.rules.effectSentences.B_17'), R.T('sys.rules.effectSentences.B_18'));
    if (m.glimPct) {
      const pos = Object.keys(m.glimPct).filter((k) => m.glimPct[k] > 0);
      const neg = Object.keys(m.glimPct).filter((k) => m.glimPct[k] < 0);
      if (pos.length) {
        const t = pos.includes('tech'), s = pos.includes('spell');
        const rest = pos.filter((k) => k !== 'tech' && k !== 'spell');
        if (t && s) G(R.T('sys.rules.effectSentences.G_45'), R.T('sys.rules.effectSentences.G_46'));
        else if (t) G(R.T('sys.rules.effectSentences.G_47'), R.T('sys.rules.effectSentences.G_46'));
        else if (s) G(R.T('sys.rules.effectSentences.G_48'), R.T('sys.rules.effectSentences.G_46'));
        if (rest.length) {
          const ws = rest.filter((k) => WTYPE_NAMES[k]), es = rest.filter((k) => ELEMENT_NAMES[k]);
          if (ws.length) G(R.T('sys.rules.effectSentences.G_49', { joinDot: joinDot(ws.map(keyName)) }), R.T('sys.rules.effectSentences.G_46'));
          if (es.length) G(R.T('sys.rules.effectSentences.G_50', { joinDot: joinDot(es.map(keyName)) }), R.T('sys.rules.effectSentences.G_46'));
        }
      }
      if (neg.length) B(R.T('sys.rules.effectSentences.B_19'));
    }
    if (m.profPct) { const ks = Object.keys(m.profPct).filter((k) => m.profPct[k] > 0); if (ks.length) G(R.T('sys.rules.effectSentences.G_51', { joinDot: joinDot(ks.map(keyName)) }), R.T('sys.rules.effectSentences.G_52')); }
    if (m.dropPct > 0) G(R.T('sys.rules.effectSentences.G_53'), R.T('sys.rules.effectSentences.G_54'));
    if (m.rarePct > 0 && m.superPct > 0) G(R.T('sys.rules.effectSentences.G_55'), R.T('sys.rules.effectSentences.G_56'));
    else if (m.rarePct > 0) G(R.T('sys.rules.effectSentences.G_57'), R.T('sys.rules.effectSentences.G_58'));
    else if (m.superPct > 0) G(R.T('sys.rules.effectSentences.G_59'), R.T('sys.rules.effectSentences.G_60'));
    if (m.goldPct > 0) G(R.T('sys.rules.effectSentences.G_61'), R.T('sys.rules.effectSentences.G_62'));
    if (m.goldPct < 0) B(R.T('sys.rules.effectSentences.B_20'));
    if (m.growPct > 0) G(R.T('sys.rules.effectSentences.G_63'));
    if (m.growPct <= -100) B(R.T('sys.rules.effectSentences.B_21'));
    else if (m.growPct < 0) B(R.T('sys.rules.effectSentences.B_22'));
    if (m.goldenPct > 0) G(R.T('sys.rules.effectSentences.G_64'));
    if (m.rareEncPct > 0) G(R.T('sys.rules.effectSentences.G_65'));
    if (m.encounterPct < 0) G(R.T('sys.rules.effectSentences.G_66'), R.T('sys.rules.effectSentences.G_67'));
    if (m.encounterPct > 0) { if (it.quirk) B(R.T('sys.rules.effectSentences.B_23')); else G(R.T('sys.rules.effectSentences.G_68')); }
    if (m.stealPct > 0) G(R.T('sys.rules.effectSentences.G_69'));
    if (m.autoSteal > 0) G(R.T('sys.rules.effectSentences.G_70'), R.T('sys.rules.effectSentences.G_71'));
    if (m.escapePct > 0) G(R.T('sys.rules.effectSentences.G_72'));
    if (m.preemptPct > 0) G(R.T('sys.rules.effectSentences.G_73'));
    if (m.spd > 0) G(R.T('sys.rules.effectSentences.G_74'), R.T('sys.rules.effectSentences.G_75'));
    if (m.spd < 0) B(R.T('sys.rules.effectSentences.B_24'), R.T('sys.rules.effectSentences.B_25'));
    if (m.eva > 0) G(R.T('sys.rules.effectSentences.G_76'), R.T('sys.rules.effectSentences.G_77'));
    if (m.eva < 0) B(R.T('sys.rules.effectSentences.B_26'));
    if (m.hit > 0 && it.slot !== 'weapon') G(R.T('sys.rules.effectSentences.G_9'));
    if (m.hit < 0) B(R.T('sys.rules.effectSentences.B'));
    if (m.crit > 0 && it.slot !== 'weapon') G(R.T('sys.rules.effectSentences.G_8'));
    if (m.autoRevive > 0) G(R.T('sys.rules.effectSentences.G_78'));
    if (m.autoCounter > 0) G(R.T('sys.rules.effectSentences.G_79'), R.T('sys.rules.effectSentences.G_80'));
    if (m.noFloorDamage) G(R.T('sys.rules.effectSentences.G_81'));
    if (m.walkHeal > 0) G(R.T('sys.rules.effectSentences.G_82'), R.T('sys.rules.effectSentences.G_83'));
    if (m.defPct < 0) B(R.T('sys.rules.effectSentences.B_27'), R.T('sys.rules.effectSentences.B_28'));
    if (m.mdefPct < 0) B(R.T('sys.rules.effectSentences.B_29'));
    if (m.takenPct < 0) G(R.T('sys.rules.effectSentences.G_84'), R.T('sys.rules.effectSentences.G_85'));
    if (m.takenPct > 0) B(R.T('sys.rules.effectSentences.B_30'), R.T('sys.rules.effectSentences.B_31'));
    if (m.noSpell) B(R.T('sys.rules.effectSentences.B_32'));
    if (m.hpLoss > 0) B(R.T('sys.rules.effectSentences.B_33'), R.T('sys.rules.effectSentences.B_34'));
    const downs = [];
    const rest = bad.filter((p) => { const mt = /^ただし(.+)が下がる。$/.exec(p[0]); if (!mt || /と/.test(mt[1])) return true; downs.push(mt[1]); return false; });
    if (downs.length >= 2) { rest.push([R.T('sys.rules.effectSentences.0', { p0: downs.length === 2 ? downs.join(R.T('sys.rules.effectSentences.0.join')) : joinDot(downs) })]); return { good, bad: rest }; }
    return { good, bad };
  }
  function packDesc(good, bad, statLine) {
    const MAXW = 20, W = Rules.textWidth;
    const layout = (list) => {
      const lines = [''];
      for (const s of list) {
        const cur = lines[lines.length - 1];
        if (!cur) lines[lines.length - 1] = s;
        else if (W(cur + s) <= MAXW) lines[lines.length - 1] = cur + s;
        else lines.push(s);
      }
      return lines;
    };
    const fits = (list) => { const l = layout(list); return l.length <= 2 && l.every((x) => W(x) <= MAXW); };
    let g = good.map((p) => p[0]), b = bad.map((p) => p[0]);
    const all = () => g.concat(b);
    const shortenOne = () => {
      let bi = -1, bw = -1;
      const pairs = good.concat(bad), cur = all();
      cur.forEach((s, i) => { const p = pairs[i]; if (p && p[1] !== s && W(s) > bw) { bw = W(s); bi = i; } });
      if (bi < 0) return false;
      if (bi < g.length) g[bi] = good[bi][1]; else b[bi - g.length] = bad[bi - g.length][1];
      return true;
    };
    while (!fits(all()) && shortenOne()) { /* 短くし続ける */ }
    while (!fits(all()) && g.length) { g.pop(); good = good.slice(0, g.length); }
    while (!fits(all()) && b.length > 1) { b.pop(); bad = bad.slice(0, b.length); }
    let lines = layout(all()).filter(Boolean);
    if (statLine && lines.length === 1 && W(statLine) <= MAXW && !b.length) lines = [statLine, lines[0]];
    return lines.slice(0, 2).join('\n');
  }
})(window.RPG);
