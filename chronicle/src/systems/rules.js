// Rules (R.Rules): the numbers of ルミナス・クロニクル — the 6 fixed stats, derived
// stats, 9 equipment slots, levels/EXP, HP/MP growth, proficiency 1–100, battle
// command lists, item number filling and descriptions. DESIGN.md §3.3.3, §4, §8.2.
// Pure logic (no DOM): node tools load this file too. Every constant lives in
// R.Rules.K (§4.18.1) so balance changes touch one place.
// Systems rework (BRIEF A17 / A18 / A19, design/build/SYSTEMS_REWORK.md): proficiency ranks 1–100, no WP (techs pay
// MP too), 7 weapon types (bare hands stay as the internal key 'fist': no type, no techs, no proficiency).
//
// CharState (§3.2.2):
//   { id, name, gender, heroType?, favor?, level, exp, hp, mp, bonus:{hp,mp},
//     status:{}, equip:{weapon1 … acc2}, wprof:{wtype:pts}, eprof:{el:pts},
//     techs:[], spells:[], row, mem, joined, counts }
// Stats and aptitudes are never saved: they are derived from DB.heroTypes /
// DB.companions every time, so balance changes reach old saves.
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;

  // ------------------------------------------------------------ ids (§3.1.1)
  const STATS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
  const MAXES = ['hp', 'mp'];
  const SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
  const WEAPON_SLOTS = ['weapon1', 'weapon2'];
  const ACC_SLOTS = ['acc1', 'acc2'];
  const WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];   // A19: 7 types, in this order
  const UNARMED = 'fist';   // bare hands: an internal key only (not in WTYPES / DB.weaponTypes; no techs, no proficiency)
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const EQUIP_TYPES = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const ITEM_TYPES = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc', 'consumable', 'key'];
  const LETTERS = ['S', 'A', 'B', 'C', 'D'];
  const MAX_LEVEL = 99;
  const CAPS = { hp: 999, mp: 250, stat: 999, eva: 60, crit: 60 };

  const STAT_NAMES = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神', hp: '最大HP', mp: '最大MP' };
  const SLOT_NAMES = { weapon1: '武器1', weapon2: '武器2', shield: '盾', head: '頭', body: '体', hands: '手', feet: '足', acc1: 'アクセ1', acc2: 'アクセ2' };
  const TYPE_NAMES = { weapon: '武器', shield: '盾', head: '頭', body: '体', hands: '手', feet: '足', acc: 'アクセサリ', consumable: '道具', key: '大事なもの' };
  const WTYPE_NAMES = { sword: '剣', greatsword: '大剣', dagger: '短剣', axe: '斧', spear: '槍', bow: '弓', staff: '杖' };
  const UNARMED_NAME = '素手';
  const ELEMENT_NAMES = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
  const GRADE_NAMES = { normal: '通常', rare: 'レア', super: '超レア' };
  const ROW_NAMES = { front: '前列', middle: '後列' };
  const WEIGHT_NAMES = { heavy: '重装', light: '軽装', cloth: '布' };
  // the 16 keys of a previewStats / optimize diff (§3.3.3), in the equip screen's order (§11.7.5)
  const DIFF_KEYS = ['atk1', 'atk2', 'mag', 'def', 'mdef', 'hit', 'eva', 'crit', 'str', 'vit', 'dex', 'agi', 'int', 'mnd', 'hp', 'mp'];
  const DIFF_NAMES = { atk1: '攻撃1', atk2: '攻撃2', mag: '術力', def: '守備', mdef: '術防', hit: '命中', eva: '回避', crit: '会心',
    str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神', hp: '最大HP', mp: '最大MP' };

  // ------------------------------------------------------ constants (§4.18.1)
  const Wt = [8, 14, 21, 30, 40, 51, 64, 78, 94, 112];
  const Ut = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
  const PRICE = [70, 160, 290, 450, 660, 900, 1200, 1500, 1900, 2600];
  const WT = (hands, reach, kind, mult, hit, crit, stat, magMult) => ({ hands, twoHanded: hands === 2, reach, kind, mult, hit, crit, stat, magMult });
  const K = {
    STAT_K: 64,
    DK: (L) => 40 + 5 * L,
    W: Wt, U: Ut, PRICE,
    D: (T) => 70 + 30 * T,
    LZ: (T) => 6 + 6 * T,
    GRADE_MULT: { normal: 1, rare: 2, super: 3 },
    PRICE_GRADE: { normal: 1, rare: 3, super: 6 },
    // §4.3.4 — weapon type table (the data file weapontypes.js carries names and fx only). A19 (SYSTEMS_REWORK §3.1):
    // 7 types; 刀 → 剣 (art:'katana'), 棍棒 → 斧's blunt mace line (kind:'blunt', art:'club'), 体術・鞭 gone; the staff
    // now reaches from the back row. An item may override mult / kind / hit / crit (fillItem, weaponInfo).
    WTYPE: {
      sword: WT(1, false, 'slash', 1.00, 0, 2, ['str'], 0.5),
      greatsword: WT(2, false, 'slash', 1.40, -5, 2, ['str'], 0.5),
      dagger: WT(1, false, 'pierce', 0.75, 8, 10, ['dex'], 0.5),
      axe: WT(1, false, 'slash', 1.15, -10, 4, ['str'], 0.5),
      spear: WT(2, true, 'pierce', 1.25, 0, 2, ['str', 'dex'], 0.5),
      bow: WT(2, true, 'pierce', 1.10, 5, 4, ['dex'], 0.5),
      staff: WT(1, true, 'blunt', 0.60, 0, 0, ['str', 'int'], 1.0),
      fist: WT(1, false, 'blunt', 0.90, 5, 5, ['str', 'agi'], 0.5),   // bare hands only (R.Rules.UNARMED)
    },
    UNARMED: { atk: 4, mag: 4 },            // bare hands (素手): W 4 with the 'fist' row above (§4.3.4); Wm 4 with no weapon
    WEIGHT: { heavy: { def: 1, mdef: 0.2, eva: 8 }, light: { def: 0.65, mdef: 0.35, eva: 5 }, cloth: { def: 0.4, mdef: 0.6, eva: 2 } },
    SLOT_SHARE: { shield: 0.20, head: 0.15, body: 0.40, hands: 0.10, feet: 0.15 },
    SLOT_UNITS: { weapon: 2, shield: 1, head: 1, body: 2, hands: 1, feet: 1, acc: 1 },
    PRICE_SLOT: { weapon: 1.6, body: 1.4, shield: 1.0, head: 0.8, hands: 0.6, feet: 0.6, acc: 1.2 },
    RELIC_PRICE: { rare: 1500, super: 3000 },
    // §4.2.2 — growth
    HP: { a: 17.5, b: 14.7, p: 0.90, cap: 999 },
    MP: { a: 8, b: 2.6, p: 0.85, cap: 250 },   // A18: WP gone, techs pay MP too — the curve stays, the cap 150 → 250
    VIT: { base: 160, div: 200 },
    GROW: {
      hp: { S: 1.25, A: 1.12, B: 1.00, C: 0.90, D: 0.80 },
      mp: { S: 1.30, A: 1.15, B: 1.00, C: 0.85, D: 0.70 },   // A18: C / D a little higher (techs pay MP)
    },
    BONUS_CAP: { hp: 200, mp: 50 },   // `grow` (seeds) — §8.2.5 (A18: MP 30 → 50)
    // §4.2.3 — EXP
    EXP: { a: 3, b: 1.2, c: 0.06, bplMax: 16, bplAmp: 12, bplTau: 12, perBattle: 3.3 },
    FALLOFF: { up: 0.75, downStep: 0.1, downMax: 10, min: 0.03 },
    RESERVE_RATE: 0.6,
    MAX_LEVEL,
    JOIN_LEVEL: 0.9,
    // §4.5.3 — rows
    ROW: { middleTaken: 0.7, weight: { front: 2, middle: 1 }, aimMiddle: { front: 1, middle: 3 } },
    STAGE: [0.63, 0.77, 1, 1.3, 1.6],
    MOB: { atk: 0.6, mag: 0.6 },
    // §4.9.1 — proficiency. A17 (SYSTEMS_REWORK §1): points are saved, the rank 1–100 is computed.
    // PROF_PTS[r] = the points of rank r (r = 1..100; [0] unused = 0): round(11 × (r − 1)^1.18). profRank(0) = 1.
    PROF_PTS: [0].concat(Array.from({ length: 100 }, (_, i) => Math.round(11 * Math.pow(i, 1.18)))),
    PROF_CAP: 2490,                        // = PROF_PTS[100]
    // points per action: weapons as before (1, lv6+ techs 2); spells ×2–2.5 (a caster acts with spells less often)
    PROF_GAIN: { weapon: 1, techHigh: 2, techHighLv: 6, single12: 2, single35: 5, pair: 5, triple: 7, stone: 2 },
    CATCHUP: 2,
    // the catch-up line PEXP(T) (points) = the points of rank [3,12,18,24,30,36,42,48,54,60]; T = R.Tier.effective()
    PEXP: [25, 186, 311, 445, 585, 730, 880, 1034, 1191, 1352],
    // the tier's soft line (rank): at or above PROF_SOFT.rank[T] a gain is × mul (rank 100 only by grinding after the game)
    PROF_SOFT: { rank: [20, 28, 36, 44, 52, 60, 67, 74, 80, 90], mul: 0.3 },
    START_PROF: { S: 25, A: 11 },          // starting points (rank 3 / 2); starterKit.prof holds the same values
    JOIN_PROF: { S: 0.8, A: 0.7, B: 0.5, C: 0.3, D: 0.1 },
    // party model / sims: the points of the main weapon in normal use in the middle of tier T
    PROF_TRACK: [180, 370, 555, 745, 935, 1125, 1315, 1505, 1675, 1850],
    // the tech glimmer gate: a tech of glim.lv L is a candidate from weapon rank TECH_PROF[L] (index = lv; [0] unused)
    TECH_PROF: [0, 1, 3, 8, 14, 20, 26, 32, 40, 50, 60],
    // Part A13 / A17: proficiency raises power — × 1 + max × ((r − 1) / 99)^exp, r = the rank of the spell's element
    // (the average for combos / triples) or of the used weapon's type (techs, plain attacks). Damage and healing only.
    PROF_POWER: { max: 0.30, exp: 0.75 },
    // Part A13b / A17: element rank 14 → that element's 1段目 single spells cost MP 0; rank 32 → its 2段目 single
    // spells cost half (rounded up, at least 1). Combo / triple spells are not affected.
    PROF_MP: { freeRank: 14, freeStep: 1, halfRank: 32, halfStep: 2 },
    // Part A13 retune: monster HP x (1 + min(max, perLv x L)) - the enemy side of the proficiency bonus (the party's
    // weapon / element rank grows with the tier: about +6 % at T0 to +24 % at T7). Folded into K.curve's hp (§4.14.2).
    MON_HP_PROF: { perLv: 0.004, max: 0.20 },
    // A11 review (2026-09-26): the regular monsters' side of the curve against the party, per battle tier (index T = (L−6)/6,
    // linear between tiers): K.curve(L, 'mob') multiplies hp by hp[T] and atk / mag by dmg[T]. Was tuning.json 'global'
    // (per monster, at the middle tier of its stage); in the curve it follows the battle level, so a stage met away from
    // its middle tier (dyn zones, a boss's '@lineage' adds) gets the factor of the battle. Bosses, rare and metal
    // monsters use the plain curve (R.Mon asks for 'mob' only for the others). `on` stays false until R.Mon passes the
    // kind (the switch-over also deletes tuning.json 'global' and regenerates the monsters, so nothing counts twice).
    // Fitted by battle level (not per stage as 'global' is): a sandbox with R.Mon passing the kind and 'global' deleted,
    // sim_balance --full --only A2 --n 20 (seed 20260925): rounds 2.54–2.85 and HP lost 8.4–9.9 % in every tier T0–T9
    // (A2 2.70 rounds / 9.0 %, C1a 2.62 / 9.1 %); 'global' copied as is gave T4 2.38 rounds and T8 2.43 / 7.8 %.
    MOB_TIER: {
      on: false,
      hp: [1.12, 1.2, 1.45, 1.72, 1.72, 1.9, 2.14, 2.3, 2.35, 2.06],
      dmg: [1.25, 1.25, 0.95, 0.75, 0.72, 0.61, 0.58, 0.58, 0.58, 0.45],
    },
    // §4.9.3–4.9.4 — glimmer (R.Glimmer reads these)
    GLIM: {
      base: { tech: 0.012, secret: 0.006, single: 0.015, comboA: 0.012, comboB: 0.010, triple: 0.008 },
      techLv: [1, 10], spellLv: [1, 8], cap: 0.35,
      apt: { S: 2, A: 1.5, B: 1, C: 0.6, D: 0.3 },
      expect: [2, 4, 6, 8, 10, 12, 14, 16, 17, 19],
      fkSlope: 0.4, fkFree: 2, fkMax: 4, stoneEntry: 10,
      ef: { normal: 1, golden: 1.5, rare: 2, boss: 2.5 },
      rank: { boss: 2, rare: 2, golden: 1, metal: 1 }, rankBase: 1, secretLv: 10,
      margin: 0.1, marginMax: 5, wFrom: 3, wLowest: 2,
      gf: { base: 100, div: 150, min: 0.7, max: 2.0 },
    },
    // §4.10 — loot
    DROP: {
      rate: { normal: 8, rare: 32, super: 256 },
      cap: { normal: 0.75, rare: 0.5, super: 0.125 },
      modCap: 150,
      golden: { normal: 2, rare: 8, super: 8 },
    },
    STEAL: { base: 0.35, agiDiv: 200, min: 0.1, max: 0.8, boss: 0.5, rareMul: 4, rareCap: 0.5, autoRare: 0.5 },
    // §3.3.16 — caps of summed mods
    MODCAP: { party: 150, partyMin: -100, preempt: 30, exp: 30, expMin: -100, glim: 40, glimMin: -100, prof: 50, profMin: -100, cost: -50, encounter: 50, autoSteal: 100 },
    PARTY_KEYS: ['goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct', 'preemptPct', 'escapePct'],
    // §4.11 — encounters, pre-emptive strike, escape
    ENC: { world: 26, dungeon: 22, randLo: 0.6, randHi: 1.4, safeSteps: 6 },
    ENC_ITEM: { repel: { pct: -100, steps: 100, weakOnly: true }, lure: { pct: 100, steps: 100 }, weakMargin: 3 },
    PREEMPT: 1 / 16, PREEMPT_RATIO: [0.5, 2],
    ESCAPE: { base: 0.55, step: 0.12, agi: 0.5, min: 0.25, max: 0.95 },
    // §4.12 — after battle, inn
    AFTER: { mpPct: 0.12 },   // A18: 10 → 12 % (techs pay MP too; a knob, SYSTEMS_REWORK §4.3 A3)
    INN: [10, 16, 24, 32, 42, 54, 66, 80, 96, 112],
    // §4.10.2–4.10.5 — golden, rare and metal monsters
    GOLDEN: { rate: 1 / 40, hp: 2, stat: 1.2, exp: 3, gold: 5, lvShow: 2 },
    RARE_ENC: 80,
    RARE_MON: { lvOff: 2, exp: 5, gold: 5, flee: 0.25, fleeFrom: 2, eva: 15, evaFlying: 20 },
    METAL: { exp: 30, gold: 10, flee: 0.5, eva: 30, agi: 2.5, hp: [6, 12], dmg: 1, critDmg: 2, hitMul: 3 },
    // §4.4, §4.6 — hit, crit, damage
    HIT: { base: 90, dexDiv: 4, min: 20, max: 100, blind: 0.5, mon: 95 },
    CRIT: { base: 2, dexDiv: 16, mult: 1.5, cap: 60, mon: 2, boss: 3 },
    EVA: { agiDiv: 5, cap: 60, nimble: 25 },
    MON_EVA: { base: 5, flying: 12, fast: 15, fastAgi: 1.3, metal: 30, rare: 15, rareFlying: 20, boss: 5, bossFlying: 10 },
    DEFEND: 0.5,
    DMG: { physRand: [0.90, 1.10], magRand: [0.95, 1.05], breathRand: [0.9, 1.1], fixedRand: [0.95, 1.05], max: 9999 },
    MNDF: { base: 128, div: 168, min: 0.75, max: 2.2 },
    SF: { base: 128, div: 168, min: 0.6, max: 2.0 },
    STATUS: { mndDiv: 500, resistCap: 0.9, pCap: 0.95, bossDebuff: 0.5 },
    BOSS_RES: { death: 1, sleep: 0.75, paralyze: 0.75, freeze: 0.75, confuse: 0.75, stun: 0.5, silence: 0.5, blind: 0.5, poison: 0.25, burn: 0.25 },
    // §4.14.2 — monster curve (R.Mon.curve reads K.curve), §9.1.2 size/kind, §9.11.2 bosses
    CURVE: { hp: [6, 2.6, 0.1], atk: [4, 3.15, 0.9], magMul: 0.85, def: [20, 2.5], agi: [24, 0.6], gold: [2, 0.5, 0.07] },
    SIZE: { s: { hp: 0.7, atk: 0.9, def: 0.9, rw: 0.7 }, m: { hp: 1, atk: 1, def: 1, rw: 1 }, l: { hp: 2.0, atk: 1.15, def: 1.1, rw: 1.8 } },
    KIND: { mob: { exp: 1, gold: 1 }, rare: { exp: 5, gold: 5 }, metal: { exp: 30, gold: 10 } },
    DRAGON_EXP: 1.2,
    BOSS: {
      prologue: { lv: 8, hpMul: 11, atk: 1.25, mag: 1.25, def: 1.1, agi: 1.0, acts: 1, exp: 10, gold: 15 },
      mid: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, exp: 10, gold: 15 },
      region: { lvOff: 3, hpMul: 18, atk: 1.5, mag: 1.4, def: 1.2, agi: 1.2, acts: 2, exp: 20, gold: 15 },
      rival: { lvOff: 2, hpMul: 10, atk: 1.3, mag: 1.3, def: 1.1, agi: 1.1, acts: 1, exp: 10, gold: 15 },
      fmid: { lvOff: 2, hpMul: 20, atk: 1.5, mag: 1.5, def: 1.2, agi: 1.2, acts: 2, exp: 20, gold: 15 },
      last1: { lvOff: 4, hpMul: 30, atk: 1.6, mag: 1.6, def: 1.25, agi: 1.3, acts: 2, exp: 40, gold: 15 },
      // A2.2 (2026-09-26): the ×36 / ×1.6 / ×1.25 / ×1.3 row needed b_nemrea2's s at the 0.5 floor on every stat and still
      // lost (C2 48–56 % with the A12.0 hpBoss); these are the values the Lv58 standard party can beat (C2 ≈ 84 %,
      // 17.8 rounds, sim_balance seed 20260925 --n 200), so b_nemrea2 needs no s at all (§9.11.2's ±20 %)
      last2: { lvOff: 4, hpMul: 17, atk: 0.68, mag: 0.68, def: 0.65, agi: 0.65, acts: 3, exp: 40, gold: 15 },
      echo: { lvOff: 4, hpMul: 30, atk: 1.7, mag: 1.7, def: 1.25, agi: 1.3, acts: 2, exp: 30, gold: 15 },
      // A12.1 (b): atk/mag 1.8 → 1.25 so that b_ouroboros' own s stays inside §4.14.2's 0.5–2.0 (it sat at the 0.5 floor)
      // hpMul 45 → 56 (2026-09-26): with the party model's 'real' gear really wearing rare / super items (all have a quirk),
      // C3 read 96 % strong / 45–54 % normal at 45; 56 gives X4 85 % (22.2 rounds) strong / 13 % normal (seed 20260925)
      super: { lvOff: 8, hpMul: 56, atk: 1.25, mag: 1.25, def: 1.3, agi: 1.4, acts: 3, exp: 40, gold: 15 },
      add: { hpMul: null, acts: 1, exp: 2, gold: 2 },   // お供: hpShare, the other multipliers are the main boss's
    },
    MAX_ITEM: 99,
    MAX_GOLD: 9999999,
  };
  /** K.MOB_TIER at level L: {hp, dmg} (linear between the tiers, T = (L − 6) / 6 clamped to 0–9) */
  K.mobTier = function (L) {
    const M = K.MOB_TIER, n = M.hp.length - 1;
    const t = Math.max(0, Math.min(n, (L - 6) / 6)), i = Math.min(n - 1, Math.floor(t)), f = t - i;
    return { hp: M.hp[i] + (M.hp[i + 1] - M.hp[i]) * f, dmg: M.dmg[i] + (M.dmg[i + 1] - M.dmg[i]) * f };
  };
  /** monster stat curve at level L (§4.14.2). R.Mon.curve returns this; kind 'mob' = a regular monster (× K.mobTier) */
  K.curve = function (L, kind) {
    const C = K.CURVE;
    const mt = kind === 'mob' && K.MOB_TIER.on ? K.mobTier(L) : null;
    const atk = (C.atk[0] + C.atk[1] * Math.pow(Math.max(0, L - 1), C.atk[2])) * (mt ? mt.dmg : 1);
    const d = C.def[0] + C.def[1] * L;
    return {
      hp: (C.hp[0] + C.hp[1] * L + C.hp[2] * L * L) * (1 + Math.min(K.MON_HP_PROF.max, K.MON_HP_PROF.perLv * Math.max(0, L))) * (mt ? mt.hp : 1),
      atk, mag: C.magMul * atk, def: d, mdef: d,
      agi: C.agi[0] + C.agi[1] * L,
      exp: K.EXP.a + K.EXP.b * L + K.EXP.c * L * L,
      gold: C.gold[0] + C.gold[1] * L + C.gold[2] * L * L,
    };
  };
  /** boss HP curve (§4.14.3) */
  // A12.0 (2026-09-26): was 0.65 + 0.05·clamp((L−6)/6, 0, 10) — too flat against the party's growth (region bosses
  // ran 11.7 rounds at T0 and 7.0 at T7, §4.17.3-B4). The lead's 0.48 + 0.125·clamp((L−6)/6, 0, 10) overshot at T0 and
  // left a hump at T2 (the T0–T2 party grows about as fast as the curve), so the tier term starts at L18 (T2), rises
  // 0.15 per 6 levels and stops at L51 (T7's region boss): T0–T1 −4 %, L51 ×1.44; the fixed-tier bosses (L56–68, their
  // own s) get ×1.38 / ×1.36 / ×1.28 at L56 / 58 / 68 (sim_bosses X1, 2026-09-26).
  K.hpBoss = (L) => K.curve(L).hp * (0.65 + 0.025 * (U.clamp(L, 18, 51) - 18));

  // mods whose values are lists / maps rather than plain numbers (§3.3.16)
  const LIST_MODS = { statusImmune: 1 };
  const MAP_MODS = { elemResist: 1, elemBoost: 1, statusResist: 1, glimPct: 1, profPct: 1, startBuffs: 1 };

  const itemOf = (id) => (id && DB.items[id]) || null;
  const round2 = (v) => Math.round(v * 100) / 100;
  const gameInv = () => (R.Game && R.Game.inv) || {};

  const Rules = (R.Rules = {
    K, STATS, MAXES, SLOTS, WEAPON_SLOTS, ACC_SLOTS, WTYPES, UNARMED, ELEMENTS, EQUIP_TYPES, ITEM_TYPES, LETTERS, MAX_LEVEL, CAPS,
    STAT_NAMES, SLOT_NAMES, TYPE_NAMES, WTYPE_NAMES, ELEMENT_NAMES, GRADE_NAMES, ROW_NAMES, WEIGHT_NAMES, DIFF_KEYS, DIFF_NAMES,

    // ------------------------------------------------------- small formulas
    dk(L) { return K.DK(L); },
    lz(T) { return K.LZ(T); },
    /** stat gain of a gear piece: max(1, round(units × U(T))) × {1,2,3} (§4.3.2) */
    gearStat(T, units, grade) {
      const t = U.clamp(T | 0, 0, K.U.length - 1);
      return Math.max(1, Math.round(units * K.U[t])) * (K.GRADE_MULT[grade || 'normal'] || 1);
    },
    /**
     * battle tier and level of an encounter zone on a map (§4.14.1, §9.0 0.17):
     * Tb = zone.tier if numeric else R.Game.tier ('dyn'); Lb = LZ(Tb) + (map.lvOff ?? zone.lvOff ?? 0).
     * Prologue zones give lv:[min,max] directly: {roll:true} picks one, otherwise the max.
     */
    zoneLevel(zone, map, opts) {
      const z = typeof zone === 'string' ? DB.encounters[zone] : zone;
      let md = map;
      if (typeof md === 'string') md = DB.maps[md];
      else if (md && md.def) md = md.def;
      if (md === undefined && R.Game && R.Game.pos) md = DB.maps[R.Game.pos.map];
      const gt = (R.Game && R.Game.tier) || 0;
      const Tb = z && typeof z.tier === 'number' ? z.tier : gt;
      if (z && Array.isArray(z.lv)) {
        const lo = z.lv[0], hi = z.lv[1] != null ? z.lv[1] : z.lv[0];
        return { Tb, Lb: opts && opts.roll ? U.ri(lo, hi) : hi, lvMin: lo, lvMax: hi };
      }
      const off = md && md.lvOff != null ? md.lvOff : (z && z.lvOff) || 0;
      const Lb = K.LZ(Tb) + off;
      return { Tb, Lb, lvMin: Lb, lvMax: Lb };
    },

    // ------------------------------------------------------------ creation
    /** the hero spec used when none is given (DB.config.defaultHero, §10.13.11) */
    defaultHeroSpec() {
      const d = DB.config && DB.config.defaultHero;
      return U.clone(d || { name: 'アルン', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } });
    },
    /**
     * newChar({id:'hero', heroSpec}) or newChar({id:companionId, level?}) → CharState (§5.2.7).
     * Unknown item / action ids are dropped with a warning (data may still be missing
     * while other areas are being written).
     */
    newChar(spec) {
      if (typeof spec === 'string') spec = { id: spec };
      spec = spec || { id: 'hero' };
      const kit = DB.starterKit || {};
      const c = {
        id: spec.id, name: '', gender: 'm', level: 1, exp: 0, hp: 1, mp: 0,
        bonus: { hp: 0, mp: 0 }, status: {},
        equip: Rules.emptyEquip(), wprof: {}, eprof: {}, techs: [], spells: [], row: 'front',
        mem: { cmd: 0, list: {}, item: 0, target: null },
        joined: { tier: 0, frame: 0 },
        counts: { battles: 0, kills: 0, glimmers: 0 },
      };
      let equip = {}, techs = [], spells = [];
      if (spec.id === 'hero') {
        const hs = Object.assign(Rules.defaultHeroSpec(), spec.heroSpec || {});
        if (!hs.favor || !hs.favor.kind) hs.favor = Rules.defaultHeroSpec().favor;
        const T = DB.heroTypes[hs.type];
        if (!T) R.warn('newChar: unknown hero type', hs.type);
        c.name = hs.name; c.gender = hs.gender === 'f' ? 'f' : 'm';
        c.heroType = hs.type; c.favor = { kind: hs.favor.kind === 'element' ? 'element' : 'weapon', id: hs.favor.id };
        const fw = c.favor.kind === 'weapon';
        equip.weapon1 = fw ? (kit.weapon && kit.weapon[c.favor.id]) : T && T.defaultWeapon;
        const se = (T && T.startEquip) || {};
        for (const s of ['body', 'head', 'shield', 'hands', 'feet']) if (se[s]) equip[s] = se[s];
        const on = (T && T.onFavor && T.onFavor[c.favor.kind]) || {};
        techs = (fw && kit.tech && kit.tech[c.favor.id] ? [kit.tech[c.favor.id]] : []).concat(on.techs || []);
        spells = (!fw && kit.spell && kit.spell[c.favor.id] ? [kit.spell[c.favor.id]] : []).concat(on.spells || []);
      } else {
        const D = DB.companions[spec.id];
        if (!D) R.warn('newChar: unknown companion', spec.id);
        c.name = (D && D.name) || spec.id; c.gender = D && D.gender === 'f' ? 'f' : 'm';
        equip = Object.assign({}, (D && D.startEquip) || {});
        if (equip.weapon && !equip.weapon1) { equip.weapon1 = equip.weapon; delete equip.weapon; }
        techs = (D && D.startTechs) || [];
        spells = (D && D.startSpells) || [];
      }
      for (const s of SLOTS) {
        const id = equip[s];
        if (!id) continue;
        if (!DB.items[id]) { R.warn('newChar: unknown start item', id); continue; }
        c.equip[s] = id;
      }
      if (Rules.hasTwoHanded(c)) c.equip.shield = null;
      c.techs = uniq(techs).filter((id) => Rules.knownAction(id, 'newChar'));
      c.spells = uniq(spells).filter((id) => Rules.knownAction(id, 'newChar'));
      // starting proficiency from the aptitude letters: S 25, A 11 points (rank 3 / 2; §5.0 0.6, A17)
      const L = Rules.aptLetters(c), sp = kit.prof || K.START_PROF;
      for (const w of WTYPES) c.wprof[w] = sp[L.w[w]] || 0;
      for (const e of ELEMENTS) c.eprof[e] = sp[L.e[e]] || 0;
      // row
      if (spec.id === 'hero') {
        const T = DB.heroTypes[c.heroType];
        const r = (T && T.row) || 'auto';
        c.row = r === 'auto' ? (Rules.reach(c.equip.weapon1) === 'any' || c.favor.kind === 'element' ? 'middle' : 'front') : r === 'middle' ? 'middle' : 'front';
      } else {
        const D = DB.companions[spec.id];
        c.row = D && D.row === 'middle' ? 'middle' : 'front';
      }
      const lv = U.clamp((spec.level | 0) || 1, 1, MAX_LEVEL);
      c.level = lv; c.exp = Rules.expForLevel(lv);
      Rules.fullHeal(c);
      return c;
    },
    emptyEquip() { const e = {}; for (const s of SLOTS) e[s] = null; return e; },
    knownAction(id, where) {
      if (DB.actions[id]) return true;
      R.warn((where || 'rules') + ': unknown action', id);
      return false;
    },
    /** is this CharState the hero? */
    isHero(c) { return !!c && c.id === 'hero'; },
    /** the data record behind a CharState: DB.heroTypes[type] or DB.companions[id] */
    source(c) { return c.id === 'hero' ? DB.heroTypes[c.heroType] || null : DB.companions[c.id] || null; },

    // ------------------------------------------------ fixed stats & aptitude
    /** fixed base stats {str,vit,dex,agi,int,mnd} (§4.2.1). Never saved */
    baseStats(c) {
      const src = Rules.source(c);
      const st = (src && src.stats) || { str: 34, vit: 34, dex: 34, agi: 33, int: 33, mnd: 32 };
      const out = {};
      for (const k of STATS) out[k] = st[k] | 0;
      return out;
    },
    /** aptitude letters { w:{sword:'B',…}, e:{fire:'C',…} } — the hero's favor becomes S (its pair A for mages, §5.2.4) */
    aptLetters(c) {
      const src = Rules.source(c);
      const a = (src && src.apt) || {};
      const out = { w: {}, e: {} };
      for (const w of WTYPES) out.w[w] = letter(a.w && a.w[w]);
      for (const e of ELEMENTS) out.e[e] = letter(a.e && a.e[e]);
      if (c.id === 'hero' && c.favor) {
        const k = c.favor.kind === 'element' ? 'e' : 'w';
        if (out[k][c.favor.id] !== undefined) out[k][c.favor.id] = 'S';
        const kit = DB.starterKit || {};
        if (k === 'e' && src && src.pairElement) {
          const pair = (kit.pair || { fire: 'wind', wind: 'fire', water: 'light', light: 'water', earth: 'dark', dark: 'earth' })[c.favor.id];
          if (pair) out.e[pair] = 'A';
        }
      }
      return out;
    },
    /** one aptitude letter: kind 'w' (weapon type) or 'e' (element) */
    aptLetter(c, kind, id) { const L = Rules.aptLetters(c)[kind === 'e' ? 'e' : 'w']; return L[id] || 'C'; },
    /** aptitude multipliers for glimmer odds (§4.9.4): S 2.0 A 1.5 B 1.0 C 0.6 D 0.3 */
    aptitude(c) {
      const L = Rules.aptLetters(c), A = K.GLIM.apt;
      const out = { w: {}, e: {} };
      for (const w of WTYPES) out.w[w] = A[L.w[w]];
      for (const e of ELEMENTS) out.e[e] = A[L.e[e]];
      return out;
    },
    /** growth letters {hp,mp} */
    growth(c) {
      const src = Rules.source(c);
      const g = (src && src.growth) || {};
      return { hp: letter(g.hp), mp: letter(g.mp) };
    },

    // ------------------------------------------------------------ HP/MP
    /** the raw level curve of hp|mp before type and equipment (§4.2.2) */
    lvCurve(key, L) {
      const P = K[key.toUpperCase()];
      return P.a + P.b * Math.pow(Math.max(0, L - 1), P.p);
    },
    /**
     * max hp|mp at `level` with c's current equipment:
     * HP = min(999, round(HPlv × GH × VIT) × (1 + hpPct/100) + bonus.hp), VIT = (160 + 体力)/200
     */
    maxAt(c, key, level, pre) {
      const L = level || c.level || 1;
      const g = K.GROW[key][Rules.growth(c)[key]];
      const m = (pre && pre.mods) || Rules.mods(c);
      const vit = pre && pre.vit != null ? pre.vit : Rules.finalStats(c, m).vit;
      let base = Rules.lvCurve(key, L) * g;
      if (key === 'hp') base *= (K.VIT.base + vit) / K.VIT.div;
      const bonus = (c.bonus && c.bonus[key]) || 0;
      const v = Math.round(Math.round(base) * (1 + (m[key + 'Pct'] || 0) / 100) + bonus);
      return U.clamp(v, key === 'hp' ? 1 : 0, K[key.toUpperCase()].cap);
    },
    /** raise a max by an item (`grow`): returns the amount added (0 = already at the cap, §8.2.5) */
    grow(c, key, n) {
      if (!MAXES.includes(key)) return 0;
      c.bonus = c.bonus || { hp: 0, mp: 0 };
      const cur = c.bonus[key] || 0, cap = K.BONUS_CAP[key];
      const add = Math.max(0, Math.min(n | 0, cap - cur));
      if (!add) return 0;
      const before = Rules.stats(c)[key];
      c.bonus[key] = cur + add;
      const after = Rules.stats(c)[key];
      if (key !== 'hp' || c.hp > 0) c[key] = Math.min(after, (c[key] || 0) + (after - before));
      return add;
    },
    canGrow(c, key) { return MAXES.includes(key) && ((c.bonus && c.bonus[key]) || 0) < K.BONUS_CAP[key]; },

    // ------------------------------------------------------------ mods
    /**
     * the summed modifiers of c: the mods of all 9 equipped items ⊕ the innate
     * (DB.companions[id].innate.mods, or DB.heroTypes[type].mods). §3.3.16:
     * numbers add, lists concatenate (unique), elemResist takes the minimum per
     * element, the other maps add per key, booleans OR. Personal caps applied.
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
      // personal caps (§3.3.16, §8.3.5)
      const C = K.MODCAP;
      if (out.expPct != null) out.expPct = U.clamp(out.expPct, C.expMin, C.exp);
      if (out.mpCostPct != null) out.mpCostPct = Math.max(C.cost, out.mpCostPct);
      if (out.techCostPct != null) out.techCostPct = Math.max(C.cost, out.techCostPct);   // A18: the techs' MP
      if (out.encounterPct != null) out.encounterPct = U.clamp(out.encounterPct, -C.encounter, C.encounter);
      if (out.autoSteal != null) out.autoSteal = U.clamp(out.autoSteal, 0, C.autoSteal);
      if (out.glimPct) for (const k in out.glimPct) out.glimPct[k] = U.clamp(out.glimPct[k], C.glimMin, C.glim);
      if (out.profPct) for (const k in out.profPct) out.profPct[k] = U.clamp(out.profPct[k], C.profMin, C.prof);
      if (out.statusResist) for (const k in out.statusResist) out.statusResist[k] = U.clamp(out.statusResist[k], -1, 1);
      return out;
    },
    /**
     * the 8 party-wide keys (§3.3.16 *): sums over the living active party, capped
     * (drop/encounter keys +150, preemptPct +30, escapePct uncapped — the chance stops at 1).
     * Every sum stops at −100 so quirks (goldPct −50 on several members) never turn a
     * reward or a chance negative.
     */
    partyMods(party) {
      party = party || (R.Game && R.Game.party) || [];
      const out = {};
      for (const k of K.PARTY_KEYS) out[k] = 0;
      for (const c of party) {
        if (!c || !(c.hp > 0)) continue;
        const m = Rules.mods(c);
        for (const k of K.PARTY_KEYS) out[k] += m[k] || 0;
      }
      for (const k of ['goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct']) out[k] = Math.min(K.MODCAP.party, out[k]);
      out.preemptPct = Math.min(K.MODCAP.preempt, out.preemptPct);
      for (const k of K.PARTY_KEYS) out[k] = Math.max(K.MODCAP.partyMin, out[k]);
      return out;
    },

    // ----------------------------------------------------------- stats
    /** the 6 stats with equipment and %-mods: (base + gear stats) × (1 + XPct/100), 0..999 */
    finalStats(c, m) {
      m = m || Rules.mods(c);
      const b = Rules.baseStats(c);
      for (const s of SLOTS) {
        const it = itemOf(c.equip && c.equip[s]);
        if (!it || !it.stats) continue;
        for (const k of STATS) if (it.stats[k]) b[k] += it.stats[k];
      }
      for (const k of STATS) b[k] = U.clamp(Math.floor(b[k] * (1 + (m[k + 'Pct'] || 0) / 100)), 0, CAPS.stat);
      return b;
    },
    /** weapon type table row (K.WTYPE), with DB.weaponTypes' twoHanded/reach/kind when given */
    wtypeInfo(wtype) {
      const k = K.WTYPE[wtype] || K.WTYPE.fist;
      const d = DB.weaponTypes[wtype];
      if (!d) return k;
      return Object.assign({}, k, {
        twoHanded: d.twoHanded != null ? !!d.twoHanded : k.twoHanded,
        reach: d.reach != null ? d.reach === true || d.reach === 'any' : k.reach,
        kind: d.kind || k.kind,
      });
    },
    /** the weapon record W of one slot (null slot = bare hands) — §3.3.3 */
    weaponInfo(c, slot, fs, m) {
      const it = slot ? itemOf(c.equip[slot]) : null;
      if (slot && !it) return null;
      const wtype = it ? it.wtype : UNARMED;
      const T = Rules.wtypeInfo(wtype);
      const S = T.stat.reduce((a, k) => a + fs[k], 0) / T.stat.length;
      const Wv = it ? (it.atk || 0) : K.UNARMED.atk;
      return {
        id: it ? c.equip[slot] : null, slot: slot || null, wtype,
        atk: Math.max(0, Math.round((Wv + (m.atk || 0)) * (K.STAT_K + S) / K.STAT_K)),
        hit: K.HIT.base + Math.floor(fs.dex / K.HIT.dexDiv) + T.hit + ((it && it.hit) || 0) + (m.hit || 0),
        crit: U.clamp(K.CRIT.base + Math.floor(fs.dex / K.CRIT.dexDiv) + T.crit + ((it && it.crit) || 0) + (m.crit || 0), 0, CAPS.crit),
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
     * full derived stats (§4.4):
     * { hp,mp (max), str…mnd, atk/atk1/atk2, mag, def, mdef, hit, eva, crit, spd,
     *   w:{weapon1, weapon2, fist}, elemResist, elemBoost, statusImmune, statusResist, mods }
     */
    stats(c) {
      const m = Rules.mods(c);
      const fs = Rules.finalStats(c, m);
      const s = Object.assign({}, fs);
      for (const k of MAXES) s[k] = Rules.maxAt(c, k, c.level, { mods: m, vit: fs.vit });
      const w1 = Rules.weaponInfo(c, 'weapon1', fs, m);
      const w2 = Rules.weaponInfo(c, 'weapon2', fs, m);
      const fist = Rules.weaponInfo(c, null, fs, m);
      s.w = { weapon1: w1, weapon2: w2, fist };
      const main = w1 || fist;
      s.atk1 = main.atk; s.atk = main.atk; s.atk2 = w2 ? w2.atk : 0;
      s.hit = main.hit; s.crit = main.crit;
      // 術力: the larger weapon mag of the two slots (4 with none), §4.3.5
      const wm = Math.max(w1 ? w1.mag : 0, w2 ? w2.mag : 0) || K.UNARMED.mag;
      s.mag = Math.max(0, Math.round((wm + (m.mag || 0)) * (K.STAT_K + fs.int) / K.STAT_K));
      let def = 0, mdef = 0, sheva = 0;
      for (const sl of ['shield', 'head', 'body', 'hands', 'feet']) {
        const it = itemOf(c.equip[sl]);
        if (!it) continue;
        def += it.def || 0; mdef += it.mdef || 0;
        if (sl === 'shield') sheva += it.eva || 0;
      }
      s.def = Math.max(0, Math.round((def + (m.def || 0)) * (1 + (m.defPct || 0) / 100)));
      s.mdef = Math.max(0, Math.round((mdef + Math.floor(fs.mnd / 2) + (m.mdef || 0)) * (1 + (m.mdefPct || 0) / 100)));
      s.eva = U.clamp(Math.floor(fs.agi / K.EVA.agiDiv) + sheva + (m.eva || 0), 0, CAPS.eva);
      s.spd = Math.max(1, fs.agi + (m.spd || 0));
      const er = {};
      for (const e of ELEMENTS) er[e] = m.elemResist && m.elemResist[e] != null ? m.elemResist[e] : 1;
      s.elemResist = er;
      s.elemBoost = m.elemBoost || {};
      s.statusImmune = m.statusImmune || [];
      s.statusResist = m.statusResist || {};
      s.mods = m;
      return s;
    },
    isAlive(c) { return !!c && c.hp > 0; },
    /** keep hp/mp within 0..max (hp of a living member stays ≥ 1) */
    clampHpMp(c) {
      const st = Rules.stats(c);
      for (const k of MAXES) {
        if (!(c[k] >= 0)) c[k] = 0;
        if (c[k] > st[k]) c[k] = st[k];
      }
      return c;
    },
    /** HP/MP to max, statuses cleared (revives) */
    fullHeal(c) {
      const st = Rules.stats(c);
      c.hp = st.hp; c.mp = st.mp; c.status = {};
      return c;
    },

    // -------------------------------------------------------- EXP & levels
    /** EXP of a standard monster of level L = mexp(L) (§4.2.3, §4.14.2) */
    mexp(L) { return K.EXP.a + K.EXP.b * L + K.EXP.c * L * L; },
    /** battles per level against same-level foes */
    bpl(L) { return K.EXP.bplMax - K.EXP.bplAmp * Math.exp(-L / K.EXP.bplTau); },
    /** EXP needed from L to L+1 */
    need(L) { return Math.round(Rules.mexp(L) * K.EXP.perBattle * Rules.bpl(L)); },
    /** total EXP to reach level L */
    expForLevel(L) {
      L = Math.min(L | 0, MAX_LEVEL);
      if (!expCache.length) { expCache.push(0, 0); for (let l = 2; l <= MAX_LEVEL; l++) expCache.push(expCache[l - 1] + Rules.need(l - 1)); }
      return L <= 1 ? 0 : expCache[L];
    },
    expToNext(c) { return c.level >= MAX_LEVEL ? 0 : Math.max(0, Rules.expForLevel(c.level + 1) - c.exp); },
    /** the level-gap factor f(d), d = own level − monster level (§4.2.3) */
    falloff(d) {
      const F = K.FALLOFF;
      if (d <= 0) return 1 + F.downStep * Math.min(F.downMax, -d);
      return Math.max(F.min, Math.pow(F.up, d));
    },
    /**
     * EXP for one member from the killed monsters (§4.2.3):
     * Σ round(exp × f(level − monLv)) × share × (1 + expPct/100), at least 1.
     * killed: [monDef | {def, golden} | {id, golden} | {exp, lv}]
     */
    battleExp(c, killed, share) {
      if (!killed || !killed.length) return 0;
      let sum = 0;
      for (const k of killed) {
        const e = monExp(k);
        if (!e) continue;
        sum += Math.round(e.exp * Rules.falloff(c.level - e.lv));
      }
      const m = Rules.mods(c);
      const v = Math.round(sum * (share == null ? 1 : share) * (1 + (m.expPct || 0) / 100));
      return Math.max(1, v);
    },
    /**
     * add EXP → {levels, gains:{hp,mp}, level}. Current HP/MP rise with the
     * maxima (a fallen member's HP stays 0). Emits 'levelup'(c, level) for members of R.Game.
     */
    gainExp(c, n) {
      const res = { levels: 0, gains: { hp: 0, mp: 0 }, level: c.level };
      n = Math.max(0, Math.floor(n || 0));
      if (c.level >= MAX_LEVEL) { c.exp = Math.min(c.exp + n, Rules.expForLevel(MAX_LEVEL)); return res; }
      const before = Rules.stats(c);
      c.exp += n;
      while (c.level < MAX_LEVEL && c.exp >= Rules.expForLevel(c.level + 1)) { c.level++; res.levels++; }
      if (c.level >= MAX_LEVEL) c.exp = Math.min(c.exp, Rules.expForLevel(MAX_LEVEL));
      res.level = c.level;
      if (res.levels) {
        const after = Rules.stats(c);
        for (const k of MAXES) {
          const g = Math.max(0, after[k] - before[k]);
          res.gains[k] = g;
          if (k === 'hp' && !(c.hp > 0)) continue;
          c[k] = Math.min(after[k], (c[k] || 0) + g);
        }
        if (inGame(c)) R.emit('levelup', c, c.level);
      }
      return res;
    },
    /** set a level directly (debug / party model): exp and maxima follow, HP/MP refilled */
    setLevel(c, L) {
      c.level = U.clamp(L | 0, 1, MAX_LEVEL);
      c.exp = Rules.expForLevel(c.level);
      Rules.fullHeal(c);
      return c;
    },

    // -------------------------------------------------------- proficiency
    prof(c, kind, id) { const t = kind === 'e' ? c.eprof : c.wprof; return (t && t[id]) || 0; },
    /** the rank 1–100 of a point total: the largest r with PROF_PTS[r] ≤ pts (at least 1; A17) */
    profRank(pts) {
      const P = K.PROF_PTS;
      pts = +pts || 0;
      let r = 1;
      for (let i = 2; i < P.length; i++) { if (pts >= P[i]) r = i; else break; }
      return r;
    },
    rankOf(c, kind, id) { return Rules.profRank(Rules.prof(c, kind, id)); },
    /**
     * Part A13 — the proficiency rank behind an action: a spell → the average rank of its elements; a tech or a plain
     * attack (action null / 'attack') → the rank of the weapon type in `slot` ('weapon1'|'weapon2'; undefined = the
     * default weapon). Bare hands (素手, no proficiency), items and anything else → null (no bonus).
     */
    profPowerRank(c, action, slot) {
      if (!c) return null;
      const a = typeof action === 'string' ? (action === 'attack' ? null : DB.actions[action]) : action;
      if (a && a.kind === 'spell') {
        const els = (a.elements || []).filter((e) => ELEMENTS.includes(e));
        if (!els.length) return null;
        return els.reduce((s, e) => s + Rules.rankOf(c, 'e', e), 0) / els.length;
      }
      if (a && a.kind !== 'tech') return null;
      const eq = c.equip || {};
      let s = slot;
      if (s !== 'weapon1' && s !== 'weapon2') s = eq.weapon1 ? 'weapon1' : eq.weapon2 ? 'weapon2' : null;
      const it = s ? itemOf(eq[s]) : null;
      let w = it && it.wtype;
      if (!w) w = !eq.weapon1 && !eq.weapon2 ? UNARMED : (a && a.wtype) || null;
      if (!w || !WTYPES.includes(w)) return null;
      return Rules.rankOf(c, 'w', w);
    },
    /** Part A13 / A17 — power multiplier of profPowerRank: 1 + max × ((r − 1)/99)^exp (1 when nothing applies) */
    profPowerMul(c, action, slot) {
      const r = Rules.profPowerRank(c, action, slot);
      if (r == null) return 1;
      return Rules.profPowerOf(r);
    },
    /** the multiplier of a rank r (1–100; a combo's average rank may be fractional): r1 ×1.00 … r100 ×1.30 */
    profPowerOf(r) {
      const P = K.PROF_POWER, top = K.PROF_PTS.length - 1;
      const f = U.clamp(((+r || 1) - 1) / (top - 1), 0, 1);
      return 1 + P.max * Math.pow(f, P.exp);
    },
    /** Part A13 — the bonus as a whole percentage for the screens (「熟練の補正 +9%」) */
    profPowerPct(c, action, slot) { return Math.round((Rules.profPowerMul(c, action, slot) - 1) * 100); },
    /** PEXP(T) — the catch-up line (T = R.Tier.effective()) */
    pexp(T) {
      if (T == null) T = R.Tier ? R.Tier.effective() : 0;
      return K.PEXP[U.clamp(T | 0, 0, K.PEXP.length - 1)];
    },
    /** PROF_SOFT.rank[T] — the tier's soft line (rank); gains at or above it are × PROF_SOFT.mul */
    profSoft(T) {
      if (T == null) T = R.Tier ? R.Tier.effective() : 0;
      const S = K.PROF_SOFT.rank;
      return S[U.clamp(T | 0, 0, S.length - 1)];
    },
    /**
     * add raw points (A17, SYSTEMS_REWORK §1.3): × (1 + profPct/100), × CATCHUP while below PEXP(T),
     * × PROF_SOFT.mul at or above the soft line of T. opts.raw skips all three. → {rank, up, pts}
     */
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
      t[id] = U.clamp(round2(cur + v), 0, K.PROF_CAP);
      const r1 = Rules.profRank(t[id]);
      return { rank: r1, up: r1 > r0, pts: t[id] };
    },
    /**
     * called by the battle after every party action (§3.3.3, §4.9.1):
     * info = {kind:'attack'|'tech'|'spell'|'item', slot?, wtype?, elements?, actionId?, stone?, tier?}
     * → [{kind:'w'|'e', id, rank}] for every rank that went up
     */
    train(c, info) {
      if (!c || !info) return [];
      const G = K.PROF_GAIN, ups = [];
      const m = Rules.mods(c);
      const o = { mods: m, tier: info.tier };
      const bump = (kind, id, pts) => { const r = Rules.addProf(c, kind, id, pts, o); if (r.up) ups.push({ kind, id, rank: r.rank }); };
      const a = info.actionId && DB.actions[info.actionId];
      if (info.stone || (info.kind === 'item' && a == null && info.elements)) {
        for (const e of info.elements || []) if (ELEMENTS.includes(e)) bump('e', e, G.stone);
        return ups;
      }
      if (info.kind === 'attack' || info.kind === 'tech') {
        let w = info.wtype;
        if (!w) { const it = itemOf(info.slot && c.equip[info.slot]); w = it ? it.wtype : UNARMED; }
        if (!WTYPES.includes(w)) return ups;   // bare hands (素手) train nothing
        const lv = a && a.glim && a.glim.lv;
        bump('w', w, info.kind === 'tech' && lv >= G.techHighLv ? G.techHigh : G.weapon);
      } else if (info.kind === 'spell') {
        const els = (info.elements || (a && a.elements) || []).filter((e) => ELEMENTS.includes(e));
        if (!els.length) return ups;
        let pts;
        if (els.length >= 3) pts = G.triple;
        else if (els.length === 2) pts = G.pair;
        else pts = spellStep(a) <= 2 ? G.single12 : G.single35;
        for (const e of els) bump('e', e, pts);
      }
      return ups;
    },
    /**
     * proficiency of a companion joining mid-game (§4.9.1): each wtype/element gets
     * max(start, round(PEXP(T) × {S .8, A .7, B .5, C .3, D .1}))
     */
    catchUpProf(c, T) {
      const P = Rules.pexp(T), L = Rules.aptLetters(c), J = K.JOIN_PROF;
      for (const w of WTYPES) c.wprof[w] = Math.max(c.wprof[w] || 0, Math.round(P * J[L.w[w]]));
      for (const e of ELEMENTS) c.eprof[e] = Math.max(c.eprof[e] || 0, Math.round(P * J[L.e[e]]));
      return c;
    },

    // ------------------------------------------------------------ equipment
    /** 'weapon'|'shield'|'head'|'body'|'hands'|'feet'|'acc'|null */
    slotGroup(itemId) {
      const it = itemOf(itemId);
      return it && EQUIP_TYPES.includes(it.type) ? it.type : null;
    },
    /** the slots an item fits: weapon → weapon1/weapon2, acc → acc1/acc2, others their own */
    slotsFor(itemId) {
      const g = Rules.slotGroup(itemId);
      if (!g) return [];
      if (g === 'weapon') return WEAPON_SLOTS.slice();
      if (g === 'acc') return ACC_SLOTS.slice();
      return [g];
    },
    /** the group of a slot name ('weapon1' → 'weapon') */
    groupOfSlot(slot) { return slot === 'weapon1' || slot === 'weapon2' ? 'weapon' : slot === 'acc1' || slot === 'acc2' ? 'acc' : slot; },
    /** the slot an item goes to by default (the first empty fitting slot of c, else the first) */
    defaultSlot(c, itemId) {
      const list = Rules.slotsFor(itemId);
      if (!list.length) return null;
      if (c && c.equip) for (const s of list) if (!c.equip[s]) return s;
      return list[0];
    },
    itemSlot(itemId, c) { return Rules.defaultSlot(c || null, itemId); },
    isTwoHanded(itemId) {
      const it = itemOf(itemId);
      if (!it || it.type !== 'weapon') return false;
      return !!it.twoHanded || Rules.wtypeInfo(it.wtype).twoHanded;
    },
    /** does c hold a two-handed weapon in weapon1 or weapon2? */
    hasTwoHanded(c) { return WEAPON_SLOTS.some((s) => c.equip && c.equip[s] && Rules.isTwoHanded(c.equip[s])); },
    /** 'any' (reaches from the middle row: spear, bow, staff) or 'front' (bare hands: front) */
    reach(itemId) {
      const it = itemOf(itemId);
      if (!it || it.type !== 'weapon') return 'front';
      if (it.reach != null) return it.reach === true || it.reach === 'any' ? 'any' : 'front';
      return Rules.wtypeInfo(it.wtype).reach ? 'any' : 'front';
    },
    /** why c cannot put itemId into slot (menu text), or null (§3.3.3 rules 1–5) */
    equipIssue(c, itemId, slot) {
      const it = itemOf(itemId);
      if (!it || !EQUIP_TYPES.includes(it.type)) return 'これは装備できない。';
      slot = slot || Rules.defaultSlot(c, itemId);
      if (!SLOTS.includes(slot) || Rules.groupOfSlot(slot) !== it.type) return 'この枠には付けられない。';
      if (it.only && !it.only.includes(c.id)) return c.name + 'には装備できない。';
      if (it.gender && it.gender !== c.gender) return c.name + 'には装備できない。';
      if (slot === 'shield' && Rules.hasTwoHanded(c)) return '両手持ちの武器を装備している。';
      return null;
    },
    canEquip(c, itemId, slot) { return Rules.equipIssue(c, itemId, slot) === null; },
    /**
     * put itemId (from the inventory) into slot, or take the slot off (itemId null).
     * The old item goes back to the inventory; a two-handed weapon also takes the
     * shield off. → {ok, removed:[itemId], shieldRemoved, reason?}. Nothing changes
     * on failure (unknown slot, cannot equip, not in the inventory, over 99).
     */
    equip(c, slot, itemId, opts) {
      const inv = (opts && opts.inv) || gameInv();
      const fail = (reason) => ({ ok: false, removed: [], shieldRemoved: null, reason });
      if (!SLOTS.includes(slot)) return fail('この枠には付けられない。');
      itemId = itemId || null;
      const old = c.equip[slot] || null;
      if (old === itemId) return { ok: true, removed: [], shieldRemoved: null };
      if (itemId) {
        const issue = Rules.equipIssue(c, itemId, slot);
        if (issue) return fail(issue);
        if (!((inv[itemId] || 0) >= 1)) return fail('持ち物にない。');
      }
      const back = [];
      if (old) back.push(old);
      const shield = itemId && WEAPON_SLOTS.includes(slot) && Rules.isTwoHanded(itemId) && c.equip.shield ? c.equip.shield : null;
      if (shield) back.push(shield);
      // room check: every item going back must fit under 99 (after the new one leaves)
      const cnt = {};
      for (const id of back) cnt[id] = (cnt[id] || 0) + 1;
      for (const id in cnt) {
        const after = (inv[id] || 0) - (id === itemId ? 1 : 0) + cnt[id];
        if (after > K.MAX_ITEM && DB.items[id] && DB.items[id].type !== 'key') return fail('これ以上は持てない。');
      }
      if (itemId) invTake(inv, itemId);
      c.equip[slot] = itemId;
      if (shield) c.equip.shield = null;
      for (const id of back) invPut(inv, id);
      Rules.clampHpMp(c);
      return { ok: true, removed: back, shieldRemoved: shield };
    },
    /**
     * take everything off into the inventory (酒場の「装備をあずかる」); pieces that would
     * pass 99 stay on → {ok, removed:[id], kept:[slot]}
     */
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
    /** Diff (after − before) of the 17 keys between two stats() results */
    diffStats(a, b) {
      const d = {};
      for (const k of DIFF_KEYS) d[k] = statKey(b, k) - statKey(a, k);
      return d;
    },
    /**
     * the change if c put itemId into slot (null = take it off): Diff of 17 keys
     * (§3.3.3). c and the inventory are not touched; a shield a two-handed weapon
     * would push off is counted.
     */
    previewStats(c, slot, itemId) {
      const before = Rules.stats(c);
      const v = virtualChar(c);
      v.equip[slot] = itemId || null;
      if (itemId && WEAPON_SLOTS.includes(slot) && Rules.isTwoHanded(itemId)) v.equip.shield = null;
      return Rules.diffStats(before, Rules.stats(v));
    },
    /** the §4.4.1 score of a stats() result: phys | magic | balance */
    loadoutScore(s, mode) {
      const phys = statKey(s, 'atk1') + 0.5 * statKey(s, 'atk2') + 0.6 * s.def + 0.3 * s.mdef;
      const magic = s.mag + 0.6 * s.mdef + 0.3 * s.def;
      if (mode === 'magic') return magic;
      if (mode === 'balance') return (phys + magic) / 2;
      return phys;
    },
    /**
     * 最強装備 (§4.4.1) — a pure calculation: nothing on c, the inventory or other
     * members changes. Changes weapon1 weapon2 shield head body hands feet only;
     * accessories, quirk items, other members' gear, the weapon types of the weapon
     * slots and empty weapon slots are left alone. Candidates are the inventory and what
     * c wears (two weapons of the same type may trade slots when that scores higher).
     * → Plan {mode, equip, changes, diff, score}
     */
    optimize(c, mode, opts) {
      mode = mode === 'magic' || mode === 'balance' ? mode : 'phys';
      const inv = Object.assign({}, (opts && opts.inv) || gameInv());
      const base = virtualChar(c);
      const before = Rules.stats(c);
      const locked = {};
      for (const s of OPT_SLOTS) { const it = itemOf(c.equip[s]); if (it && it.quirk) locked[s] = true; }
      const w1 = itemOf(c.equip.weapon1), w2 = itemOf(c.equip.weapon2);
      const run = (forceNoW2) => {
        const v = virtualChar(base);
        const vinv = Object.assign({}, inv);
        if (forceNoW2 && v.equip.weapon2) { invPut(vinv, v.equip.weapon2, true); v.equip.weapon2 = null; }
        for (let pass = 0; pass < 2; pass++) {
          for (const s of OPT_ORDER) {
            if (locked[s]) continue;
            if (s === 'weapon2' && forceNoW2) continue;
            if (s === 'shield' && Rules.hasTwoHanded(v)) { if (v.equip.shield) { invPut(vinv, v.equip.shield, true); v.equip.shield = null; } continue; }
            const cur = v.equip[s];
            let wtype = null, other = null;
            if (s === 'weapon1' || s === 'weapon2') {
              const it = itemOf(cur);
              if (!it) continue;            // an empty weapon slot stays empty
              wtype = it.wtype;
              other = s === 'weapon1' ? 'weapon2' : 'weapon1';
            }
            // candidates: the current item, the inventory, and the piece c wears in the other
            // weapon slot when it is of this slot's type (the two swap places; §4.4.1 「その人が今付けている品」)
            const cands = [{ id: cur }];
            for (const id in vinv) {
              if (!(vinv[id] > 0) || id === cur) continue;
              const it = DB.items[id];
              if (!it || it.quirk || Rules.groupOfSlot(s) !== it.type) continue;
              if (wtype && it.wtype !== wtype) continue;
              if (it.only && !it.only.includes(c.id)) continue;
              if (it.gender && it.gender !== c.gender) continue;
              cands.push({ id });
            }
            if (other && !locked[other] && !(forceNoW2 && other === 'weapon2')) {
              const oid = v.equip[other], oit = itemOf(oid);
              if (oit && oid !== cur && oit.wtype === wtype && !oit.quirk && !cands.some((x) => x.id === oid)) cands.push({ id: oid, swap: true });
            }
            let best = cands[0], bestScore = -Infinity, bestIt = itemOf(cur);
            for (const cand of cands) {
              const t = virtualChar(v);
              t.equip[s] = cand.id;
              if (cand.swap) t.equip[other] = cur;
              if (cand.id && (s === 'weapon1' || s === 'weapon2') && Rules.isTwoHanded(cand.id)) t.equip.shield = null;
              const sc = Rules.loadoutScore(Rules.stats(t), mode);
              const it = itemOf(cand.id);
              // a swap must raise the score (on a tie the two slots would just trade places back and forth)
              if (sc > bestScore + 1e-9 || (!cand.swap && Math.abs(sc - bestScore) <= 1e-9 && better(it, bestIt, cand.id === cur, best.id === cur))) {
                best = cand; bestScore = sc; bestIt = it;
              }
            }
            if (best.swap) {
              v.equip[other] = cur;
              v.equip[s] = best.id;
            } else if (best.id !== cur) {
              if (cur) invPut(vinv, cur, true);
              if (best.id) vinv[best.id] = (vinv[best.id] || 0) - 1;
              v.equip[s] = best.id;
              if (best.id && (s === 'weapon1' || s === 'weapon2') && Rules.isTwoHanded(best.id) && v.equip.shield) { invPut(vinv, v.equip.shield, true); v.equip.shield = null; }
            }
          }
        }
        return { v, score: Rules.loadoutScore(Rules.stats(v), mode) };
      };
      let res = run(false);
      // weapon2 of a two-handed type: also try "weapon2 off, shield on" and keep the better (§4.4.1)
      if (w2 && Rules.wtypeInfo(w2.wtype).twoHanded && !(w1 && Rules.isTwoHanded(c.equip.weapon1)) && !locked.weapon2) {
        const alt = run(true);
        if (alt.v.equip.shield && alt.score > res.score + 1e-9) res = alt;
      }
      const equip = {};
      for (const s of OPT_SLOTS) equip[s] = res.v.equip[s] || null;
      const changes = [];
      for (const s of OPT_ORDER) if ((c.equip[s] || null) !== equip[s]) changes.push({ slot: s, from: c.equip[s] || null, to: equip[s] });
      changes.sort((a, b) => APPLY_ORDER.indexOf(a.slot) - APPLY_ORDER.indexOf(b.slot));
      return { mode, equip, changes, diff: Rules.diffStats(before, Rules.stats(res.v)), score: round2(res.score) };
    },
    /**
     * apply a Plan: its changes in slot order through R.Rules.equip. On any failure
     * (the inventory changed, over 99) everything is put back → {ok:false}
     */
    applyLoadout(c, plan, opts) {
      const inv = (opts && opts.inv) || gameInv();
      const changes = (plan && plan.changes) || [];
      if (!changes.length) return { ok: true, removed: [] };
      const snapEquip = Object.assign({}, c.equip);
      const snapInv = Object.assign({}, inv);
      const snapHp = [c.hp, c.mp];
      const restore = () => {
        Object.assign(c.equip, snapEquip);
        for (const k of Object.keys(inv)) delete inv[k];
        Object.assign(inv, snapInv);
        c.hp = snapHp[0]; c.mp = snapHp[1];
      };
      const o = { inv };
      const alive = c.hp > 0;
      // take off first every changed slot whose new item is worn elsewhere (moving a piece between slots)
      const wanted = new Set(changes.map((ch) => ch.to).filter(Boolean));
      for (const ch of changes) {
        if (ch.from && wanted.has(ch.from)) { const r = Rules.equip(c, ch.slot, null, o); if (!r.ok) { restore(); return { ok: false, removed: [], reason: r.reason }; } }
      }
      for (const ch of changes) {
        const r = Rules.equip(c, ch.slot, ch.to, o);
        if (!r.ok) { restore(); return { ok: false, removed: [], reason: r.reason }; }
      }
      if (alive && c.hp <= 0) c.hp = 1;
      const now = new Set(SLOTS.map((s) => c.equip[s]).filter(Boolean));
      const removed = [];
      for (const s of SLOTS) { const id = snapEquip[s]; if (id && !now.has(id) && !removed.includes(id)) removed.push(id); }
      return { ok: true, removed };
    },

    // -------------------------------------------------------- battle commands
    /**
     * battle command list (§3.3.3): one per equipped weapon slot (both empty → 素手),
     * 術 when spells are known (and no noSpell), 防御, 道具
     */
    commands(c) {
      const out = [];
      for (const s of WEAPON_SLOTS) {
        const it = itemOf(c.equip[s]);
        if (!it) continue;
        out.push({ type: 'weapon', slot: s, wtype: it.wtype, name: wtypeName(it.wtype), sealed: !!it.sealTech });
      }
      if (!out.length) out.push({ type: 'weapon', slot: null, wtype: UNARMED, name: UNARMED_NAME, sealed: false });
      const m = Rules.mods(c);
      if ((c.spells || []).length && !m.noSpell) out.push({ type: 'spell', name: '術' });
      out.push({ type: 'defend', name: '防御' });
      out.push({ type: 'item', name: '道具' });
      return out;
    },
    /** techs of one weapon type that c knows, in tech data order; [] for a sealTech weapon's slot */
    techList(c, wtype, slot) {
      if (slot && itemOf(c.equip[slot]) && itemOf(c.equip[slot]).sealTech) return [];
      return sortActions((c.techs || []).filter((id) => { const a = DB.actions[id]; return a && a.wtype === wtype; }));
    },
    /** known spells in the spell order (§7.2.2) */
    spellList(c) { return sortActions((c.spells || []).filter((id) => DB.actions[id])); },
    /** all known techs, by weapon type order then tech order */
    allTechs(c) {
      const out = [];
      for (const w of WTYPES) out.push(...Rules.techList(c, w));
      return out;
    },
    /** spells usable from the field menu (action.field === true), in spell order */
    fieldSpells(c) { return Rules.spellList(c).filter((id) => DB.actions[id].field === true); },
    /**
     * the MP an action costs c (A18: techs and spells both pay MP; SYSTEMS_REWORK §2.2):
     *   tech  max(1, round(a.mp × (1 + max(MODCAP.cost, techCostPct)/100)))
     *   spell the A13b base (0 stays 0), then mpCostPct as before (at least 1; cuts round down, raises round up)
     * 0 for an action with no MP. Glimmered actions are free in battle (the battle decides that, not this).
     */
    mpCost(c, actionId) { return costOf(c, actionId); },
    /** Part A13b — 'free' | 'half' | null: the proficiency discount on this spell's MP for c */
    profMpKind(c, actionId) {
      const a = typeof actionId === 'string' ? DB.actions[actionId] : actionId;
      if (!a || !a.mp) return null;
      const b = profMpBase(c, a);
      return b === a.mp ? null : b === 0 ? 'free' : 'half';
    },
    /** the row c acts from: a middle-row member counts as front when no living front-row member remains (§4.5.3) */
    effectiveRow(c, party) {
      const row = rowOf(c);
      if (row !== 'middle') return 'front';
      party = party || (R.Game && R.Game.party) || [];
      const anyFront = party.some((m) => m && rowOf(m) !== 'middle' && hpOf(m) > 0);
      return anyFront ? 'middle' : 'front';
    },

    // ------------------------------------------------------- item numbers
    /**
     * fill the numbers of an item from its tier/grade/units (§8.2.9): stats, atk,
     * mag, twoHanded, def, mdef, eva, price, desc, icon. Values already written are kept.
     * A weapon's `mult` overrides its type's (atk = round(W[T] × (it.mult ?? type mult)), A19).
     */
    fillItem(it) {
      if (!it) return it;
      const T = U.clamp(it.tier | 0, 0, K.W.length - 1), g = it.grade || 'normal', GM = K.GRADE_MULT[g] || 1;
      const U1 = (u) => Math.max(1, Math.round(u * K.U[T])) * GM;
      const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
      if (it.units && !it.stats) {
        it.stats = {};
        const re = /([svdaim])(\d+)/g;
        let mt;
        while ((mt = re.exec(it.units))) it.stats[SK[mt[1]]] = (it.stats[SK[mt[1]]] || 0) + U1(+mt[2]);
      }
      if (it.statsAdd && !it._statsAdded) {
        it.stats = it.stats || {};
        for (const k in it.statsAdd) it.stats[k] = (it.stats[k] || 0) + it.statsAdd[k];
        Object.defineProperty(it, '_statsAdded', { value: true, enumerable: false });
      }
      if (it.type === 'weapon') {
        const w = K.WTYPE[it.wtype] || K.WTYPE[UNARMED];
        if (it.atk === undefined) it.atk = Math.round(K.W[T] * (typeof it.mult === 'number' ? it.mult : w.mult));
        if (it.mag === undefined) it.mag = Math.round(K.W[T] * w.magMult);
        if (Rules.wtypeInfo(it.wtype).twoHanded) it.twoHanded = true;
      } else if (K.SLOT_SHARE[it.type] !== undefined) {
        const wt = K.WEIGHT[it.weight] || K.WEIGHT.light, D = K.D(T), sh = K.SLOT_SHARE[it.type];
        if (it.def === undefined) it.def = Math.round(sh * D * wt.def);
        if (it.mdef === undefined) it.mdef = Math.round(sh * D * wt.mdef);
        if (it.type === 'shield' && it.eva === undefined) it.eva = wt.eva;
      }
      if (it.price === undefined && EQUIP_TYPES.includes(it.type)) {
        if (it.src === 'relic') it.price = K.RELIC_PRICE[g] || K.RELIC_PRICE.rare;
        else if (it.src === 'reward' || it.unique) it.price = 0;
        else it.price = Math.round(K.PRICE[T] * K.PRICE_SLOT[it.type] / 10) * 10 * (K.PRICE_GRADE[g] || 1);
      }
      if (it.icon === undefined) it.icon = Rules.defaultIcon(it);
      if (it.sort === undefined && EQUIP_TYPES.includes(it.type)) {
        const off = it.src === 'relic' || it.src === 'reward' ? 90 : g === 'super' ? 70 : g === 'rare' ? 50 : 0;
        it.sort = T * 100 + (it.lineNo | 0) + off;
      }
      if (!it.desc) it.desc = Rules.autoDesc(it);
      return it;
    },
    /** the icon key of an item (§8.2.8) */
    defaultIcon(it) {
      if (it.type === 'weapon') return 'icon:' + (it.wtype || 'sword');
      if (EQUIP_TYPES.includes(it.type)) return 'icon:' + it.type;
      if (it.type === 'key') return 'icon:key';
      if (it.stone) return 'icon:el_' + it.stone;
      const eff = (it.use && it.use.effects) || [];
      if (eff.some((e) => e && (e.type === 'heal' || e.type === 'revive' || e.type === 'grow'))) return 'icon:herb';
      return 'icon:potion';
    },
    /**
     * item description, 2 lines × 20 full-width chars (§8.2.7). Normal gear: the
     * type sentence + 「〇が上がる。」. Items with effects: the effect sentences
     * (long forms, shortened until they fit) then the quirk sentences (「ただし〜」).
     */
    autoDesc(it) {
      if (!it) return '';
      const statKeys = STATS.filter((k) => it.stats && it.stats[k] > 0);
      const statLine = statKeys.length ? joinTo(statKeys.map((k) => STAT_NAMES[k])) + 'が上がる。' : '';
      const fx = effectSentences(it);
      if (!fx.good.length && !fx.bad.length) {
        let first = '';
        if (it.type === 'weapon') first = (DB.weaponTypes[it.wtype] && DB.weaponTypes[it.wtype].desc) || (wtypeName(it.wtype) + 'の武器。');
        else if (K.SLOT_SHARE[it.type] !== undefined) first = { heavy: '重くて守りが固い。', light: '軽くて動きやすい。', cloth: '術から身を守る。' }[it.weight] || '身を守る防具。';
        else if (it.type === 'acc') first = '身につける飾り。';
        return [first, statLine].filter(Boolean).join('\n');
      }
      return packDesc(fx.good, fx.bad, statLine);
    },
    /** display width in full-width characters (half-width counts 0.5) */
    textWidth(s) {
      let w = 0;
      for (const ch of String(s)) w += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.5 : 1;
      return w;
    },
  });

  // ------------------------------------------------------------- helpers
  const expCache = [];
  const OPT_SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet'];
  const OPT_ORDER = ['weapon1', 'weapon2', 'body', 'shield', 'head', 'hands', 'feet'];   // §4.4.1 choice order
  const APPLY_ORDER = OPT_ORDER;

  function uniq(a) { return Array.from(new Set(a || [])); }
  function letter(v) { return LETTERS.includes(v) ? v : 'C'; }
  function wtypeName(w) { if (w === UNARMED) return UNARMED_NAME; return (DB.weaponTypes[w] && DB.weaponTypes[w].name) || WTYPE_NAMES[w] || w; }
  function rowOf(m) { const c = m && m.c ? m.c : m; return (m && m.row) || (c && c.row) || 'front'; }
  function hpOf(m) { if (m && typeof m.hp === 'number') return m.hp; return m && m.c ? m.c.hp : 0; }
  function inGame(c) {
    const g = R.Game;
    return !!g && ((g.party || []).includes(c) || (g.reserve || []).includes(c));
  }
  function statKey(s, k) {
    if (k === 'atk1') return s.w && s.w.weapon1 ? s.w.weapon1.atk : s.w ? s.w.fist.atk : s.atk || 0;
    if (k === 'atk2') return s.w && s.w.weapon2 ? s.w.weapon2.atk : 0;
    if (k === 'hit') return s.w && s.w.weapon1 ? s.w.weapon1.hit : s.w ? s.w.fist.hit : s.hit || 0;
    if (k === 'crit') return s.w && s.w.weapon1 ? s.w.weapon1.crit : s.w ? s.w.fist.crit : s.crit || 0;
    return s[k] || 0;
  }
  /** a copy of c that can be re-equipped freely (stats() reads id, type, favor, level, bonus, equip) */
  function virtualChar(c) { return Object.assign({}, c, { equip: Object.assign({}, c.equip) }); }
  function invTake(inv, id) { inv[id] = (inv[id] || 0) - 1; if (inv[id] <= 0) delete inv[id]; }
  function invPut(inv, id, noCap) {
    const it = DB.items[id];
    const cap = it && it.type === 'key' ? 1 : K.MAX_ITEM;
    inv[id] = noCap ? (inv[id] || 0) + 1 : Math.min(cap, (inv[id] || 0) + 1);
  }
  /** tie-break of optimize: higher tier, then higher price, then the current item */
  function better(a, b, aCur, bCur) {
    const ta = (a && a.tier) || 0, tb = (b && b.tier) || 0;
    if (ta !== tb) return ta > tb;
    const pa = (a && a.price) || 0, pb = (b && b.price) || 0;
    if (pa !== pb) return pa > pb;
    return aCur && !bCur;
  }
  function monExp(k) {
    if (!k) return null;
    // a monster def itself (§3.3.3 battleExp(c, [monDef])): its `def` is the 守備力 number, not a wrapper
    if (typeof k.exp === 'number' && (typeof k.lv === 'number' || typeof k.lvBase === 'number') && (!k.def || typeof k.def !== 'object')) {
      return { exp: k.exp, lv: typeof k.lv === 'number' ? k.lv : k.lvBase };
    }
    let d = k.def && typeof k.def === 'object' ? k.def : null;
    if (!d && k.id) {
      try { d = R.Mon && R.Mon.def ? R.Mon.def(k.id, { tier: k.tier, golden: k.golden }) : null; } catch (e) { d = null; }
      if (!d) d = DB.monsters[k.id] || null;
    }
    if (!d && typeof k.exp === 'number') d = k;
    if (!d) return null;
    const lv = d.lvBase != null ? d.lvBase : d.lv != null ? d.lv : 1;
    return { exp: d.exp || 0, lv };
  }
  /** single-element spell step 1..5 (from action.step, or the glim level: 1,2,3,5,7 → 1..5) */
  function spellStep(a) {
    if (!a) return 1;
    if (a.step) return a.step;
    const lv = (a.glim && a.glim.lv) || a.rank || 1;
    return lv <= 1 ? 1 : lv === 2 ? 2 : lv <= 4 ? 3 : lv <= 6 ? 4 : 5;
  }
  /** Part A13b — the MP of a single-element spell after the proficiency discount: 0 (free), half, or a.mp */
  function profMpBase(c, a) {
    if (!a || a.kind !== 'spell' || !a.mp || !c) return a ? a.mp || 0 : 0;
    const els = a.elements || [];
    if (els.length !== 1) return a.mp;
    const P = K.PROF_MP, r = Rules.rankOf(c, 'e', els[0]), step = Number(a.step) || 0;
    if (step === P.freeStep && r >= P.freeRank) return 0;
    if (step === P.halfStep && r >= P.halfRank) return Math.max(1, Math.ceil(a.mp / 2));
    return a.mp;
  }
  function costOf(c, actionId) {
    const a = typeof actionId === 'string' ? DB.actions[actionId] : actionId;
    if (!a || !a.mp) return 0;
    const m = Rules.mods(c), cap = K.MODCAP.cost;
    if (a.kind === 'tech') {
      const pct = Math.max(cap, m.techCostPct || 0);
      return Math.max(1, Math.round(a.mp * (1 + pct / 100)));
    }
    const b = profMpBase(c, a);
    if (!b) return 0;
    const pct = Math.max(cap, m.mpCostPct || 0);
    const v = b * (100 + pct) / 100;
    return Math.max(1, pct < 0 ? Math.floor(v + 1e-9) : Math.ceil(v - 1e-9));
  }
  let actIdx = null, actIdxN = -1;
  /** spells by their `order` (§7.2.2), techs in tech data order (§3.3.3, §6.1.2) */
  function sortActions(ids) {
    const keys = Object.keys(DB.actions);
    if (!actIdx || actIdxN !== keys.length) { actIdx = {}; keys.forEach((k, i) => { actIdx[k] = i; }); actIdxN = keys.length; }
    const idx = actIdx;
    const ord = (id) => {
      const a = DB.actions[id];
      if (a.order != null) return a.order;
      return 1e6 + (idx[id] || 0);
    };
    return uniq(ids).sort((x, y) => ord(x) - ord(y) || (idx[x] || 0) - (idx[y] || 0));
  }
  function joinTo(names) { return names.length <= 1 ? names.join('') : names.slice(0, -1).join('、') + 'と' + names[names.length - 1]; }
  function joinDot(names) { return names.join('・'); }

  // ----------------------------------------------- effect sentences (§8.2.7)
  const STATUS_NAMES = { poison: '毒', burn: 'やけど', sleep: '眠り', paralyze: 'まひ', freeze: '凍結', stun: '気絶', confuse: '混乱', silence: '沈黙', blind: '暗闇', death: '即死' };
  const STATUS_VERB = { poison: '毒にする', burn: 'やけどを負わせる', sleep: '眠らせる', paralyze: 'まひさせる', freeze: '凍らせる', stun: '気絶させる', confuse: '混乱させる', silence: '術を封じる', blind: '目をくらませる', death: '一撃で倒す' };
  const RACE_NAMES = { beast: '獣', bird: '鳥', insect: '虫', plant: '植物', aquatic: '水生の魔物', dragon: '竜', undead: '不死の魔物', demon: '魔族', spirit: '霊体', construct: '魔造の魔物', slime: '軟体の魔物', humanoid: '人型の魔物', fairy: '妖精', boss: 'ボス', rare: 'めずらしい魔物', metal: '鋼の魔物', flying: '飛ぶ魔物' };
  const BUFF_NAMES = { atk: '攻撃力', def: '守備力', mag: '術力', mdef: '術防', agi: '素早さ' };
  const elName = (e) => (DB.elements[e] && DB.elements[e].name) || ELEMENT_NAMES[e] || e;
  const stName = (s) => (DB.statuses[s] && DB.statuses[s].name) || STATUS_NAMES[s] || s;
  const keyName = (k) => ELEMENT_NAMES[k] ? elName(k) : WTYPE_NAMES[k] ? wtypeName(k) : k;
  /** [long, short] pairs for good effects and quirks of an item */
  function effectSentences(it) {
    const good = [], bad = [];
    const m = it.mods || {};
    const G = (l, s) => good.push([l, s || l]);
    const B = (l, s) => bad.push([l, s || l]);
    if (it.type === 'weapon') {
      if (it.element) G(elName(it.element) + 'の属性で攻撃する。', elName(it.element) + 'の属性。');
      if (it.onHit && it.onHit.status) { const v = STATUS_VERB[it.onHit.status] || stName(it.onHit.status) + 'にする'; G(v + 'ことがある。', v + '。'); }
      if (it.vs) { const ks = Object.keys(it.vs).filter((k) => it.vs[k] > 1); if (ks.length) G(joinDot(ks.map((k) => RACE_NAMES[k] || stName(k))) + 'に大きなダメージ。'); }
      if (it.drain) G('与えた傷の一部を吸い取る。', '傷を吸う。');
      if (it.metalHit) G('鋼の魔物にも傷を与える。');
      if (it.crit > 0) G('会心が出やすい。');
      if (it.hit > 0) G('よく当たる。');
      if (it.hit < 0) B('ただし当たりにくい。');
      if (it.sealTech) B('ただし技が使えない。');
      if (it.twoHanded && !Rules.wtypeInfo(it.wtype).twoHanded) B('ただし両手持ちで盾は不可。', 'ただし両手持ち。');
    }
    if (it.quirk && K.SLOT_SHARE[it.type] !== undefined) {
      // a quirk written as a lowered def / mdef (§8.3.6): compare with the §4.3.3 value of its tier and weight
      if (it.def === 0 && it.mdef === 0) B('ただし守備力と術防は0。', 'ただし守りは0。');
      else {
        const T = U.clamp(it.tier | 0, 0, K.W.length - 1), wt = K.WEIGHT[it.weight] || K.WEIGHT.light, sh = K.SLOT_SHARE[it.type];
        const low = (v, full) => typeof v === 'number' && full >= 4 && v < full * 0.75;
        if (low(it.def, Math.round(sh * K.D(T) * wt.def)) && !(m.defPct < 0) && !(m.def > 0)) B('ただし守備力が下がる。', 'ただし守備が下がる。');
        if (low(it.mdef, Math.round(sh * K.D(T) * wt.mdef)) && !(m.mdefPct < 0) && !(m.mdef > 0)) B('ただし術防が下がる。');
      }
    }
    // resistances, grouped by value
    if (m.elemResist) {
      const by = {};
      for (const e of ELEMENTS) if (m.elemResist[e] != null) (by[m.elemResist[e]] = by[m.elemResist[e]] || []).push(elName(e));
      for (const v of Object.keys(by).map(Number).sort((a, b) => a - b)) {
        const n = joinDot(by[v]);
        if (v < 0) G(n + 'の攻撃を吸い取る。', n + 'を吸う。');
        else if (v === 0) G(n + 'の攻撃を受けない。', n + 'が効かない。');
        else if (v < 1) G(n + 'のダメージを減らす。', n + 'に強い。');
        else if (v > 1) B('ただし' + n + 'に弱くなる。', 'ただし' + n + 'に弱い。');
      }
    }
    if (m.elemBoost) { const ks = ELEMENTS.filter((e) => m.elemBoost[e] > 0); if (ks.length) { const n = joinDot(ks.map(elName)); G(n + 'の攻撃が強くなる。', n + 'が強くなる。'); } }
    if (m.statusImmune && m.statusImmune.length) G(joinDot(m.statusImmune.map(stName)) + 'が効かない。');
    if (m.statusResist) {
      const pos = Object.keys(m.statusResist).filter((s) => m.statusResist[s] > 0);
      const neg = Object.keys(m.statusResist).filter((s) => m.statusResist[s] < 0);
      if (pos.length) G(joinDot(pos.map(stName)) + 'にかかりにくい。');
      if (neg.length) B('ただし' + joinDot(neg.map(stName)) + 'にかかりやすい。');
    }
    const pctUp = STATS.filter((k) => m[k + 'Pct'] > 0), pctDown = STATS.filter((k) => m[k + 'Pct'] < 0);
    if (pctUp.length) { const n = joinTo(pctUp.map((k) => STAT_NAMES[k])); G(n + 'が割合で上がる。', n + 'が上がる。'); }
    if (pctDown.length) B('ただし' + joinTo(pctDown.map((k) => STAT_NAMES[k])) + 'が下がる。');
    if (it.statsAdd) { const ks = STATS.filter((k) => it.statsAdd[k] < 0); if (ks.length) B('ただし' + joinTo(ks.map((k) => STAT_NAMES[k])) + 'が下がる。'); }
    for (const k of ['hp', 'mp']) {
      const v = m[k + 'Pct'], nm = STAT_NAMES[k];
      if (v > 0) G(nm + 'が上がる。');
      else if (v < 0) B('ただし' + nm + 'が下がる。');
    }
    if (m.regen) G('戦闘中、HPが少しずつ戻る。', 'HPが戻る。');
    if (m.mpRegen > 0) G('戦闘中、MPが少しずつ戻る。', 'MPが戻る。');
    if (m.startBuffs) {
      const ks = Object.keys(m.startBuffs).filter((k) => m.startBuffs[k] > 0);
      if (ks.length) { const n = joinTo(ks.map((k) => BUFF_NAMES[k] || k)); G('戦闘の始めに' + n + 'が上がる。', '始めに' + n + 'が上がる。'); }
    }
    if (m.atk > 0) G('攻撃力が上がる。');
    if (m.mag > 0) G('術力が上がる。');
    if (m.def > 0) G('守備力が上がる。');
    if (m.mdef > 0) G('術防が上がる。');
    if (m.defPct > 0) G('守備力が割合で上がる。', '守備力が上がる。');
    if (m.mdefPct > 0) G('術防が割合で上がる。', '術防が上がる。');
    if (m.physPct > 0) G('物理攻撃の威力が上がる。', '物理が強くなる。');
    if (m.magicPct > 0) G('術の威力が上がる。', '術が強くなる。');
    if (m.physPct < 0) B('ただし物理攻撃が弱くなる。', 'ただし物理が弱い。');
    if (m.magicPct < 0) B('ただし術が弱くなる。');
    if (m.healPct > 0) G('回復の術がよく効く。');
    if (m.itemPct > 0) G('回復の道具がよく効く。');
    // A18: mpCostPct = the spells' MP, techCostPct = the techs' MP (SYSTEMS_REWORK §2.5)
    if (m.mpCostPct < 0 && m.techCostPct < 0) G('術と技のMPの消費が減る。', 'MPの消費が減る。');
    else if (m.mpCostPct < 0) G('術のMPの消費が減る。', 'MPの消費が減る。');
    else if (m.techCostPct < 0) G('技のMPの消費が減る。', '技のMPが減る。');
    if (m.mpCostPct > 0 && m.techCostPct > 0) B('ただし術と技のMPの消費が増える。', 'ただしMPの消費が増える。');
    else if (m.mpCostPct > 0) B('ただし術のMPの消費が増える。', 'ただしMPの消費が増える。');
    else if (m.techCostPct > 0) B('ただし技のMPの消費が増える。', 'ただし技のMPが増える。');
    if (m.glimPct) {
      const pos = Object.keys(m.glimPct).filter((k) => m.glimPct[k] > 0);
      const neg = Object.keys(m.glimPct).filter((k) => m.glimPct[k] < 0);
      if (pos.length) {
        const t = pos.includes('tech'), s = pos.includes('spell');
        const rest = pos.filter((k) => k !== 'tech' && k !== 'spell');
        if (t && s) G('技と術を閃きやすい。', '閃きやすい。');
        else if (t) G('技を閃きやすい。', '閃きやすい。');
        else if (s) G('術を閃きやすい。', '閃きやすい。');
        if (rest.length) {
          const ws = rest.filter((k) => WTYPE_NAMES[k]), es = rest.filter((k) => ELEMENT_NAMES[k]);
          if (ws.length) G(joinDot(ws.map(keyName)) + 'の技を閃きやすい。', '閃きやすい。');
          if (es.length) G(joinDot(es.map(keyName)) + 'の術を閃きやすい。', '閃きやすい。');
        }
      }
      if (neg.length) B('ただし閃きにくい。');
    }
    if (m.profPct) { const ks = Object.keys(m.profPct).filter((k) => m.profPct[k] > 0); if (ks.length) G(joinDot(ks.map(keyName)) + 'の熟練度が伸びやすい。', '熟練度が伸びやすい。'); }
    if (m.dropPct > 0) G('魔物がアイテムを落としやすい。', 'アイテムをよく落とす。');
    if (m.rarePct > 0 && m.superPct > 0) G('レアと超レアのアイテムを落としやすい。', 'レア・超レアをよく落とす。');
    else if (m.rarePct > 0) G('レアアイテムを落としやすい。', 'レアをよく落とす。');
    else if (m.superPct > 0) G('超レアアイテムを落としやすい。', '超レアをよく落とす。');
    if (m.goldPct > 0) G('手に入るお金が増える。', 'お金が増える。');
    if (m.goldPct < 0) B('ただしお金が減る。');
    if (m.expPct > 0) G('経験値が増える。');
    if (m.expPct < 0) B('ただし経験値が減る。');
    if (m.goldenPct > 0) G('金色の魔物に出会いやすい。');
    if (m.rareEncPct > 0) G('めずらしい魔物に出会いやすい。');
    if (m.encounterPct < 0) G('魔物に出会いにくい。', '魔物に会いにくい。');
    if (m.encounterPct > 0) { if (it.quirk) B('ただし魔物を呼ぶ。'); else G('魔物に出会いやすい。'); }
    if (m.stealPct > 0) G('盗みが成功しやすい。');
    if (m.autoSteal > 0) G('攻撃が当たると、ついでに盗むことがある。', 'ついでに盗む。');
    if (m.escapePct > 0) G('逃げやすくなる。');
    if (m.preemptPct > 0) G('先制しやすくなる。');
    if (m.spd > 0) G('すばやく動ける。', 'すばやい。');
    if (m.spd < 0) B('ただし動きが遅くなる。', 'ただし遅くなる。');
    if (m.eva > 0) G('攻撃をかわしやすい。', 'かわしやすい。');
    if (m.eva < 0) B('ただしかわしにくい。');
    if (m.hit > 0 && it.type !== 'weapon') G('よく当たる。');
    if (m.hit < 0) B('ただし当たりにくい。');
    if (m.crit > 0 && it.type !== 'weapon') G('会心が出やすい。');
    if (m.autoRevive > 0) G('倒れても一度だけ起き上がる。');
    if (m.autoCounter > 0) G('攻撃を受けると反撃する。', '反撃する。');
    if (m.noFloorDamage) G('毒の沼や熱い床で傷つかない。');
    if (m.walkHeal > 0) G('歩くとHPが少しずつ戻る。', '歩くとHPが戻る。');
    if (m.defPct < 0) B('ただし守備力が下がる。', 'ただし守備が下がる。');
    if (m.mdefPct < 0) B('ただし術防が下がる。');
    if (m.takenPct < 0) G('受けるダメージを減らす。', '傷が減る。');
    if (m.takenPct > 0) B('ただし受けるダメージが増える。', 'ただし傷が増える。');
    if (m.noSpell) B('ただし術が使えない。');
    if (m.hpLoss > 0) B('ただし戦闘中にHPが減る。', 'ただしHPが減る。');
    // several 「ただし〇が下がる。」 become one sentence (「ただし素早さと術防が下がる。」)
    const downs = [];
    const rest = bad.filter((p) => {
      const mt = /^ただし(.+)が下がる。$/.exec(p[0]);
      if (!mt || /と/.test(mt[1])) return true;
      downs.push(mt[1]);
      return false;
    });
    if (downs.length >= 2) {
      const n = downs.length === 2 ? downs.join('と') : joinDot(downs);
      rest.push(['ただし' + n + 'が下がる。']);
      return { good, bad: rest };
    }
    return { good, bad };
  }
  /**
   * pack sentences into ≤ 2 lines of ≤ 20: good effects first, quirks last. Long forms
   * first; the longest sentences are shortened until it fits; then trailing good ones
   * are dropped (quirks always stay). When the effects take one line and there is no
   * quirk, the stat line (「〇が上がる。」) goes first so the second line is not wasted.
   */
  function packDesc(good, bad, statLine) {
    const MAXW = 20;
    const W = Rules.textWidth;
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
      // shorten the longest sentence that still has a shorter form
      let bi = -1, bw = -1;
      const pairs = good.concat(bad), cur = all();
      cur.forEach((s, i) => { const p = pairs[i]; if (p && p[1] !== s && W(s) > bw) { bw = W(s); bi = i; } });
      if (bi < 0) return false;
      if (bi < g.length) g[bi] = good[bi][1]; else b[bi - g.length] = bad[bi - g.length][1];
      return true;
    };
    while (!fits(all()) && shortenOne()) { /* keep shortening */ }
    while (!fits(all()) && g.length) { g.pop(); good = good.slice(0, g.length); }
    while (!fits(all()) && b.length > 1) { b.pop(); bad = bad.slice(0, b.length); }
    let lines = layout(all()).filter(Boolean);
    if (statLine && lines.length === 1 && W(statLine) <= MAXW && !b.length) lines = [statLine, lines[0]];
    return lines.slice(0, 2).join('\n');
  }
})(window.RPG);
