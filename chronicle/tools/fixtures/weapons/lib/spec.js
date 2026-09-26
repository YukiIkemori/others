// Shared spec model for area A9 (weapons): the values DESIGN.md §4.3 / §8 / §9.12 fix for the 301 weapons,
// the §8.3.5 caps and §8.3.6 quirk ranges, the effect/quirk classifier, and the loaders.
// Used by tools/test_weapons.js and tools/check_weapons.js.
// (Lives in a subdirectory so `build.js --with tools/fixtures/weapons` does not load it.)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MY_FILES = ['items_weapons.js', 'items_weapons_monster.js', 'items_weapons_rare.js', 'items_weapons_super.js'];   // §8.1.4

// ---------------------------------------------------------------- §4.3.1・§4.3.4・§4.3.6
const W = [8, 14, 21, 30, 40, 51, 64, 78, 94, 112];
const U = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
const PRICE = [70, 160, 290, 450, 660, 900, 1200, 1500, 1900, 2600];
const GRADE_MULT = { normal: 1, rare: 2, super: 3 };
const PRICE_MULT = { normal: 1, rare: 3, super: 6 };
const gearStat = (T, n, g) => Math.max(1, Math.round(n * U[T])) * GRADE_MULT[g || 'normal'];
// DESIGN's 11 types (the old tables below are written with them); SYSTEMS_REWORK §3.1 leaves 7 (WTYPES, at the end)
const OLD_WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
const WTYPES = OLD_WTYPES;
const TWO_HANDED = ['greatsword', 'spear', 'bow'];
// §4.3.3「武器: 剣・大剣・斧・棍棒 → 腕力・体力、短剣・弓・鞭 → 器用さ・素早さ、槍・刀 → 腕力・器用さ、体術 → 腕力・素早さ、杖 → 知力・精神」
const WEAPON_STATS = { sword: ['str', 'vit'], greatsword: ['str', 'vit'], axe: ['str', 'vit'], club: ['str', 'vit'], dagger: ['dex', 'agi'], bow: ['dex', 'agi'], whip: ['dex', 'agi'], spear: ['str', 'dex'], katana: ['str', 'dex'], fist: ['str', 'agi'], staff: ['int', 'mnd'] };
// §8.6.2 の系列の振り方
const SERIES_UNITS = { sword: 's2', greatsword: 's2', axe: 's2', dagger: 'd2', bow: 'd2', spear: 's1d1', katana: 's1d1', club: 's1v1', fist: 's1a1', whip: 'd1a1', staff: 'i2' };

// ---------------------------------------------------------------- §8.1.2 系列・§8.4.1 表（攻撃 / 術・値段・名前）
const OLD_LINES = [
  ['w_sword', 'sword', 's2', 'w_sword_iron'], ['w_greatsword', 'greatsword', 's2', 'w_greatsword_iron'], ['w_dagger', 'dagger', 'd2', 'w_dagger_iron'],
  ['w_axe', 'axe', 's2', 'w_axe_hand'], ['w_spear', 'spear', 's1d1', 'w_spear_iron'], ['w_bow', 'bow', 'd2', 'w_bow_short'],
  ['w_club', 'club', 's1v1', 'w_club_wood'], ['w_staff', 'staff', 'i2', 'w_staff_novice'], ['w_staff_prayer', 'staff', 'm2', null],
  ['w_katana', 'katana', 's1d1', 'w_katana_uchi'], ['w_fist', 'fist', 's1a1', 'w_fist_leather'], ['w_whip', 'whip', 'd1a1', 'w_whip_leather'],
].map(([line, wtype, units, t0]) => ({ line, wtype, units, t0 }));
const normalId = (L, T) => (T === 0 && L.t0) || `${L.line}_${T}`;
// 攻撃/術（列: 剣 大剣 短剣 斧 槍 弓 棍棒 杖 刀 体術 鞭。杖の精神の系列は杖と同じ）と値段
const ATK_TABLE = [
  '8/4 11/4 6/4 9/4 10/4 9/4 8/4 5/8 8/4 7/4 6/4 110',
  '14/7 20/7 11/7 16/7 18/7 15/7 15/7 8/14 15/7 13/7 11/7 260',
  '21/11 29/11 16/11 24/11 26/11 23/11 22/11 13/21 22/11 19/11 17/11 460',
  '30/15 42/15 23/15 35/15 38/15 33/15 32/15 18/30 32/15 27/15 24/15 720',
  '40/20 56/20 30/20 46/20 50/20 44/20 42/20 24/40 42/20 36/20 32/20 1060',
  '51/26 71/26 38/26 59/26 64/26 56/26 54/26 31/51 54/26 46/26 41/26 1440',
  '64/32 90/32 48/32 74/32 80/32 70/32 67/32 38/64 67/32 58/32 51/32 1920',
  '78/39 109/39 59/39 90/39 98/39 86/39 82/39 47/78 82/39 70/39 62/39 2400',
  '94/47 132/47 71/47 108/47 118/47 103/47 99/47 56/94 99/47 85/47 75/47 3040',
  '112/56 157/56 84/56 129/56 140/56 123/56 118/56 67/112 118/56 101/56 90/56 4160',
].map((row) => {
  const c = row.split(' ');
  const out = { price: +c[11] };
  WTYPES.forEach((w, i) => { const [a, m] = c[i].split('/'); out[w] = { atk: +a, mag: +m }; });
  return out;
});
const OLD_NORMAL_NAMES = {
  w_sword: '鉄の剣 鋼の剣 黒鋼の剣 銀の剣 青鋼の剣 竜骨の剣 聖銀の剣 金剛の剣 星鉄の剣 天鋼の剣',
  w_greatsword: '鉄の大剣 鋼の大剣 黒鋼の大剣 銀の大剣 青鋼の大剣 竜骨の大剣 聖銀の大剣 金剛の大剣 星鉄の大剣 天鋼の大剣',
  w_dagger: '鉄の短剣 鋼の短剣 黒鋼の短剣 銀の短剣 青鋼の短剣 竜骨の短剣 聖銀の短剣 金剛の短剣 星鉄の短剣 天鋼の短剣',
  w_axe: '手斧 鋼の斧 黒鋼の斧 銀の斧 青鋼の斧 竜骨の斧 聖銀の斧 金剛の斧 星鉄の斧 天鋼の斧',
  w_spear: '鉄の槍 鋼の槍 黒鋼の槍 銀の槍 青鋼の槍 竜骨の槍 聖銀の槍 金剛の槍 星鉄の槍 天鋼の槍',
  w_bow: '短弓 長弓 合わせ弓 鋼弦の弓 蛇骨の弓 飛竜の弓 霊木の弓 竜骨の弓 星弦の弓 天馬の弓',
  w_club: '木の棍棒 鋼のメイス 黒鋼のメイス 銀のメイス 青鋼のメイス 竜骨のメイス 聖銀のメイス 金剛のメイス 星鉄のメイス 天鋼のメイス',
  w_staff: '見習いの杖 白木の杖 術士の杖 銀の杖 月の杖 精霊の杖 星の杖 聖樹の杖 天の杖 虹の杖',
  w_staff_prayer: '祈りの杖 巡礼の杖 銀の聖杖 白樺の聖杖 月の聖杖 精霊の聖杖 星の聖杖 祝福の聖杖 天の聖杖 虹の聖杖',
  w_katana: '打ち刀 鋼の刀 黒鋼の刀 銀の刀 青鋼の刀 竜骨の刀 聖銀の刀 金剛の刀 星鉄の刀 天鋼の刀',
  w_fist: '革の拳当て 鋼の拳当て 黒鋼の爪 銀の爪 青鋼の爪 竜骨の爪 聖銀の爪 金剛の爪 星鉄の爪 天鋼の爪',
  w_whip: '革の鞭 硬革の鞭 鹿革の鞭 鎖の鞭 蛇革の鞭 飛竜革の鞭 霊獣革の鞭 竜革の鞭 月狼革の鞭 天馬革の鞭',
};
for (const k of Object.keys(OLD_NORMAL_NAMES)) OLD_NORMAL_NAMES[k] = OLD_NORMAL_NAMES[k].split(' ');
// §5.1.4 の初期装備 20 品（武器 11 はこの担当、防具 9 は gear-a）
const OLD_STARTERS = {
  w_sword_iron: '鉄の剣', w_greatsword_iron: '鉄の大剣', w_dagger_iron: '鉄の短剣', w_axe_hand: '手斧', w_spear_iron: '鉄の槍', w_bow_short: '短弓',
  w_club_wood: '木の棍棒', w_staff_novice: '見習いの杖', w_katana_uchi: '打ち刀', w_fist_leather: '革の拳当て', w_whip_leather: '革の鞭',
};
const STARTERS_ARMOR = {
  bd_iron_cuirass: '鉄の胸当て', hd_iron_band: '鉄の額当て', sh_iron_buckler: '鉄の小盾', bd_leather_vest: '革の胴着', hd_leather_cap: '革の帽子',
  sh_leather: '革の盾', bd_hemp_robe: '麻の法衣', hd_wool_hood: '毛織りの頭巾', sh_primer: '術の手引き',
};

// ---------------------------------------------------------------- §8.5・§8.6.5・§8.7.2 の手作りの品の表（[T, 攻, 術, 能力, 値段]）
const OLD_HAND_TABLE = {
  w_sword_r1: [1, 14, 7, 'str:6', 780],
  w_greatsword_r1: [1, 20, 7, 'str:6', 780],
  w_dagger_r1: [1, 11, 7, 'dex:6', 780],
  w_axe_r1: [1, 16, 7, 'str:6', 780],
  w_spear_r1: [1, 18, 7, 'str:4,dex:4', 780],
  w_bow_r1: [1, 15, 7, 'dex:6', 780],
  w_club_r1: [1, 15, 7, 'str:4,vit:4', 780],
  w_staff_r1: [1, 8, 14, 'int:6', 780],
  w_katana_r1: [1, 15, 7, 'str:4,dex:4', 780],
  w_fist_r1: [1, 13, 7, 'str:4,agi:4', 780],
  w_whip_r1: [1, 11, 7, 'dex:4,agi:4,str:-2', 780],   // D3 のクセ stat:str-1u
  w_sword_r3: [3, 30, 15, 'str:10', 2160],
  w_greatsword_r3: [3, 42, 15, 'str:10', 2160],
  w_dagger_r3: [3, 23, 15, 'dex:10', 2160],
  w_axe_r3: [3, 35, 15, 'str:10', 2160],
  w_spear_r3: [3, 38, 15, 'str:6,dex:6', 2160],
  w_bow_r3: [3, 33, 15, 'dex:10', 2160],
  w_club_r3: [3, 32, 15, 'str:6,vit:6', 2160],
  w_staff_r3: [3, 18, 30, 'int:10', 2160],
  w_katana_r3: [3, 32, 15, 'str:6,dex:6', 2160],
  w_fist_r3: [3, 27, 15, 'str:6,agi:6', 2160],
  w_whip_r3: [3, 24, 15, 'dex:6,agi:6', 2160],
  w_sword_r5: [5, 51, 26, 'str:14', 4320],
  w_greatsword_r5: [5, 71, 26, 'str:14', 4320],
  w_dagger_r5: [5, 38, 26, 'dex:14', 4320],
  w_axe_r5: [5, 59, 26, 'str:14', 4320],
  w_spear_r5: [5, 64, 26, 'str:8,dex:8', 4320],
  w_bow_r5: [5, 56, 26, 'dex:14', 4320],
  w_club_r5: [5, 54, 26, 'str:8,vit:8', 4320],
  w_staff_r5: [5, 31, 51, 'int:14', 4320],
  w_katana_r5: [5, 54, 26, 'str:8,dex:8', 4320],
  w_fist_r5: [5, 46, 26, 'str:8,agi:8', 4320],
  w_whip_r5: [5, 41, 26, 'dex:8,agi:8', 4320],
  w_sword_r7: [7, 78, 39, 'str:18', 7200],
  w_greatsword_r7: [7, 109, 39, 'str:18', 7200],
  w_dagger_r7: [7, 59, 39, 'dex:18', 7200],
  w_axe_r7: [7, 90, 39, 'str:18', 7200],
  w_spear_r7: [7, 98, 39, 'str:10,dex:10', 7200],
  w_bow_r7: [7, 86, 39, 'dex:18', 7200],
  w_club_r7: [7, 82, 39, 'str:10,vit:10', 7200],
  w_staff_r7: [7, 47, 78, 'int:18', 7200],
  w_staff_r7b: [7, 47, 78, 'int:18', 7200],
  w_staff_prayer_r7: [7, 47, 78, 'mnd:18', 7200],
  w_katana_r7: [7, 82, 39, 'str:10,dex:10', 7200],
  w_fist_r7: [7, 70, 39, 'str:10,agi:10', 7200],
  w_whip_r7: [7, 62, 39, 'dex:10,agi:10', 7200],
  w_sword_r9: [9, 112, 56, 'str:24', 12480],
  w_greatsword_r9: [9, 157, 56, 'str:24', 12480],
  w_dagger_r9: [9, 84, 56, 'dex:24', 12480],
  w_axe_r9: [9, 129, 56, 'str:24', 12480],
  w_spear_r9: [9, 140, 56, 'str:12,dex:12', 12480],
  w_bow_r9: [9, 123, 56, 'dex:24', 12480],
  w_club_r9: [9, 118, 56, 'str:12,vit:12', 12480],
  w_staff_r9: [9, 67, 112, 'int:24', 12480],
  w_staff_r9b: [9, 67, 112, 'int:24', 12480],
  w_staff_prayer_r9: [9, 67, 112, 'mnd:24', 12480],
  w_katana_r9: [9, 118, 56, 'str:12,dex:12', 12480],
  w_fist_r9: [9, 101, 56, 'str:12,agi:12', 12480],
  w_whip_r9: [9, 90, 56, 'dex:12,agi:12', 12480],
  w_staff_sr_cosmos: [8, 56, 94, 'int:30', 18240],
  w_staff_sr_moon: [8, 56, 94, 'int:30', 18240],
  w_sword_sr_hegemon: [8, 94, 47, 'str:30', 18240],
  w_axe_sr_titan: [8, 108, 47, 'str:30', 18240],
  w_dagger_sr_moonfang: [8, 71, 47, 'dex:30', 18240],
  w_whip_sr_silk: [8, 75, 47, 'dex:30', 18240],
  w_greatsword_sr_frenzy: [2, 29, 11, 'str:12', 2760],
  w_dagger_sr_mirror: [5, 38, 26, 'dex:21', 8640],
  w_katana_sr_matsuyoi: [7, 82, 39, 'str:15,dex:15', 14400],
  w_sword_sr_echo: [9, 112, 56, 'str:36', 24960],
  w_staff_sr_goldquill: [8, 56, 94, 'int:30,str:-5', 18240],
  w_katana_sr_dreamcut: [9, 118, 56, 'str:18,dex:18', 24960],
};
// 手作りの超レアの落とす魔物（§8.6.5 の割り当て・§8.7.2）
const OLD_HAND_EXCLUSIVE = {
  w_staff_sr_cosmos: 'book_3', w_staff_sr_moon: 'book_2', w_sword_sr_hegemon: 'goblin_5', w_axe_sr_titan: 'golem_3',
  w_dagger_sr_moonfang: 'bat_5', w_whip_sr_silk: 'spider_4', w_greatsword_sr_frenzy: 'orc_1', w_dagger_sr_mirror: 'quicksilver_1',
  w_katana_sr_matsuyoi: 'wolf_4', w_sword_sr_echo: 'b_valzard_echo', w_staff_sr_goldquill: 'rm_golden_quill', w_katana_sr_dreamcut: 'rm_dream_tapir',
};
// §8.1.3・§9.12.6 の数
const OLD_COUNTS = { normal: 120, rare: 59, super: 10, mrare: 31, msuper: 79, fixed: 2, total: 301 };
const COUNT_BY_WTYPE = { // §9.12.6（魔物のレア / 雑魚の超レア。手作りの品を含む）
  axe: [3, 7], bow: [3, 8], club: [3, 6], dagger: [3, 8], fist: [3, 7], greatsword: [3, 4], katana: [4, 5], spear: [3, 11], staff: [2, 14], sword: [2, 9], whip: [2, 9],
};

// ---------------------------------------------------------------- §9.5.1 系統（種族の最初の語・段の出始めのティア）と srTier・band（§8.6.1）
const LINEAGES = {
  jelly: ['slime', [0,2,4,6,8]],
  rat: ['beast', [0,2,4,6]],
  bat: ['beast', [0,2,4,6,8]],
  paper: ['spirit', [2,4,6,8]],
  crab: ['aquatic', [0,2,4,6]],
  seabird: ['bird', [0,2,4,6]],
  bee: ['insect', [0,2,4,6,8]],
  mushroom: ['plant', [0,2,4,6]],
  plant: ['plant', [0,2,4,6,8]],
  fairy: ['fairy', [0,2,4,6]],
  treant: ['plant', [0,2,4,6]],
  scorpion: ['insect', [0,2,4,6,8]],
  snake: ['beast', [0,2,4,6]],
  mummy: ['undead', [0,2,4,6,8]],
  cactus: ['plant', [0,2,4,6]],
  sandworm: ['insect', [0,3,6]],
  wolf: ['beast', [0,2,4,6,8]],
  yeti: ['beast', [0,3,6]],
  frostling: ['fairy', [0,2,4,6,8]],
  owl: ['bird', [0,2,4,6]],
  mammoth: ['beast', [0,3,6]],
  ghost: ['spirit', [0,2,4,6,8]],
  wisp: ['spirit', [0,2,4,6]],
  frog: ['aquatic', [0,2,4,6]],
  doll: ['construct', [0,2,4,6]],
  lizardman: ['humanoid', [0,2,4,6]],
  spider: ['insect', [0,2,4,6]],
  merman: ['aquatic', [0,2,4,6]],
  kraken: ['aquatic', [0,3,6]],
  skeleton: ['undead', [0,2,4,6,8]],
  golem: ['construct', [0,3,6]],
  mole: ['beast', [0,2,4,6]],
  beetle: ['insect', [0,2,4,6]],
  crystal: ['construct', [0,2,4,6]],
  goblin: ['humanoid', [0,2,4,6,8]],
  salamander: ['beast', [0,2,4,6,8]],
  imp: ['demon', [0,2,4,6,8]],
  gargoyle: ['demon', [0,2,4,6]],
  orc: ['humanoid', [0,3,6]],
  chimera: ['beast', [0,3,6]],
  eyeball: ['demon', [0,2,4,6,8]],
  darkmage: ['humanoid', [0,2,4,6]],
  automaton: ['construct', [0,2,4,6]],
  armor: ['construct', [0,2,4,6]],
  wyvern: ['dragon', [0,3,6]],
  scribe: ['humanoid', [8,8,8]],
  book: ['construct', [8,8,8]],
  mimic: ['construct', [0,2,4,6]],
  void: ['spirit', [9,9,9]],
  chaos: ['beast', [9,9,9]],
  demon: ['demon', [8,9,9]],
  quicksilver: ['slime', [2,6]],
  mirror: ['insect', [5,7]],
  platinum: ['spirit', [8,9]],
};
const lineageOf = (monId) => String(monId).replace(/_\d+$/, '');
const stageOf = (monId) => +String(monId).match(/_(\d+)$/)[1];
/** §8.6.1 の srTier（段 k の出始めがティア 9 → 9、最後の段 → 8、それ以外 max(出始め, 次の段の出始め − 1)） */
function srTier(monId, lineages) {
  const L = lineageOf(monId), k = stageOf(monId) - 1;
  const st = lineages ? lineages[L] : (LINEAGES[L] || [])[1];
  if (!st || k < 0 || k >= st.length) return null;
  if (st[k] === 9) return 9;
  if (k === st.length - 1) return 8;
  return Math.max(st[k], st[k + 1] - 1);
}
const band = (t) => (t === 9 ? 9 : t === 8 ? 7 : t % 2 ? t : t - 1);
// §8.6.2 の種族の主 / 副の能力値
const RACE_STATS = {
  beast: ['str', 'agi'], bird: ['agi', 'dex'], insect: ['dex', 'agi'], plant: ['mnd', 'vit'], aquatic: ['vit', 'mnd'], dragon: ['str', 'vit'],
  undead: ['int', 'mnd'], demon: ['int', 'str'], spirit: ['mnd', 'int'], construct: ['vit', 'str'], slime: ['vit', 'mnd'], humanoid: ['dex', 'str'], fairy: ['int', 'mnd'],
};
/** §8.6.2: 08 の品の武器の units（杖は落とす魔物の種族の主の能力値が精神なら m2） */
const monsterWeaponUnits = (wtype, monId) => (wtype === 'staff' ? ((RACE_STATS[(LINEAGES[lineageOf(monId)] || [])[0]] || [])[0] === 'mnd' ? 'm2' : 'i2') : SERIES_UNITS[wtype]);

// ---------------------------------------------------------------- §3.3.16 の mods のキーと、武器の項目・品の旗
const MOD_KEYS = [
  'atk', 'def', 'mdef', 'hit', 'eva', 'crit', 'spd', 'mag', 'strPct', 'vitPct', 'dexPct', 'agiPct', 'intPct', 'mndPct', 'hpPct', 'mpPct',
  'defPct', 'mdefPct', 'physPct', 'magicPct', 'healPct', 'itemPct', 'takenPct', 'mpCostPct', 'techCostPct', 'elemBoost', 'elemResist',
  'statusImmune', 'statusResist', 'profPct', 'glimPct', 'expPct', 'goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct',
  'preemptPct', 'escapePct', 'stealPct', 'autoSteal', 'encounterPct', 'regen', 'mpRegen', 'startBuffs', 'noSpell', 'hpLoss',
  'autoRevive', 'autoCounter', 'walkHeal', 'noFloorDamage',
];
const WEAPON_FIELDS = ['element', 'onHit', 'vs', 'drain', 'sealTech', 'metalHit', 'twoHanded', 'hit', 'crit'];
const ITEM_KEYS = ['name', 'type', 'grade', 'tier', 'desc', 'price', 'units', 'line', 'src', 'exclusive', 'unique', 'quirk', 'sort', 'icon', 'mods', 'statsAdd', 'wtype',
  'atk', 'mag', 'stats', ...WEAPON_FIELDS, 'mult', 'kind', 'art'];   // + the A19 item overrides (SYSTEMS_REWORK §3.1)
const NUMERIC_FILLED = ['atk', 'mag', 'def', 'mdef', 'eva', 'stats', 'price'];   // データに書かない（§8.14.1-2）
const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const STATUSES = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind', 'death'];
const RACES = Object.keys(RACE_STATS);
const VS_FLAGS = ['flying', 'metal'];
const BUFF_STATS = ['atk', 'def', 'mag', 'mdef', 'agi'];

// ---------------------------------------------------------------- 効果とクセの見分け（§8.3.5・§8.3.6）
const GOOD_UP = ['atk', 'def', 'mdef', 'hit', 'eva', 'crit', 'spd', 'mag', 'strPct', 'vitPct', 'dexPct', 'agiPct', 'intPct', 'mndPct', 'hpPct', 'mpPct',
  'defPct', 'mdefPct', 'physPct', 'magicPct', 'healPct', 'itemPct', 'expPct', 'goldPct', 'dropPct', 'rarePct', 'superPct', 'rareEncPct', 'goldenPct',
  'preemptPct', 'escapePct', 'stealPct', 'autoSteal', 'mpRegen', 'autoRevive', 'autoCounter', 'walkHeal', 'drain'];
const GOOD_DOWN = ['mpCostPct', 'techCostPct', 'takenPct', 'hpLoss'];
/**
 * 品の特殊効果とクセを分ける。返り値 { effects: {key: value}, quirks: {key: value} }（マップのキーは中の値で分ける）。
 * 数は「キーの数」（同じキーの中の属性・状態はまとめて 1 つ。§8.3.3）。
 */
function classify(it) {
  const eff = {}, q = {};
  const put = (o, k, sub, v) => { if (sub === null) o[k] = v; else (o[k] = o[k] || {})[sub] = v; };
  const one = (k, v) => {
    if (k === 'twoHanded') { if (!TWO_HANDED.includes(it.wtype)) put(q, k, null, v); return; }
    if (k === 'sealTech' || k === 'noSpell') return put(q, k, null, v);
    if (k === 'element' || k === 'onHit' || k === 'vs' || k === 'metalHit' || k === 'regen' || k === 'noFloorDamage') return put(eff, k, null, v);
    if (k === 'statusImmune') return put(eff, k, null, v);
    if (k === 'elemResist') { for (const [e, x] of Object.entries(v)) put(x > 1 ? q : eff, k, e, x); return; }
    if (k === 'statusResist' || k === 'glimPct' || k === 'profPct' || k === 'elemBoost' || k === 'startBuffs') {
      for (const [e, x] of Object.entries(v)) put(x < 0 ? q : eff, k, e, x); return;
    }
    if (k === 'encounterPct') return put(v < 0 ? eff : q, k, null, v);
    if (GOOD_UP.includes(k)) return put(v >= 0 ? eff : q, k, null, v);
    if (GOOD_DOWN.includes(k)) return put(v <= 0 ? eff : q, k, null, v);
    put(eff, k, null, v);   // 不明なキーは効果に数える（キーの検査が別に落とす）
  };
  const adj = typeAdjust(it);
  for (const k of WEAPON_FIELDS) {
    let v = it[k];
    if ((k === 'crit' || k === 'hit') && typeof v === 'number' && adj[k]) v -= adj[k];   // SYSTEMS_REWORK §3.2: a type adjustment, not an effect
    if (v !== undefined && !((k === 'crit' || k === 'hit') && v === 0)) one(k, v);
  }
  for (const [k, v] of Object.entries(it.mods || {})) one(k, v);
  if (it.statsAdd) for (const [s, v] of Object.entries(it.statsAdd)) put(v < 0 ? q : eff, 'statsAdd', s, v);
  return { effects: eff, quirks: q };
}

// §8.3.5 の上限（絶対値。武器が使うキーと、品に付きうるキーのすべて）。f(value, item) → true なら範囲内
const T_ = (it) => it.tier;
const CAP = {
  rare: {
    element: (v) => ELEMENTS.includes(v), onHit: (v) => STATUSES.includes(v.status) && v.status !== 'death' && v.chance > 0 && v.chance <= 0.30,
    vs: (v) => Object.values(v).every((x) => x > 1 && x <= 1.5), drain: (v) => v > 0 && v <= 0.1, crit: (v) => v <= 20, hit: (v) => v <= 15,
    atk: (v) => v <= 10, def: (v) => v <= 10, mdef: (v) => v <= 10,
    elemResist: (v) => { const ks = Object.keys(v), xs = Object.values(v); return xs.every((x) => x === 0.75) ? ks.length <= 4 : xs.every((x) => x >= 0.5) ? ks.length <= 2 : xs.every((x) => x >= 0) && ks.length === 1; },
    elemBoost: (v) => Object.values(v).every((x) => x <= 20), statusResist: (v) => Object.keys(v).length <= 3 && Object.values(v).every((x) => x <= 0.5),
    statusImmune: (v) => v.length === 1, hpPct: (v) => v <= 15, mpPct: (v) => v <= 20, regen: (v) => v === true,
    mpRegen: (v) => v <= 3, startBuffs: (v) => Object.keys(v).length === 1 && Object.values(v).every((x) => x === 1),
    physPct: (v) => v <= 15, magicPct: (v) => v <= 15, healPct: (v) => v <= 35, itemPct: (v) => v <= 50, mpCostPct: (v) => v >= -25, techCostPct: (v) => v >= -25,
    mag: (v, it) => v <= T_(it), glimPct: (v) => Object.values(v).every((x) => x <= 15), profPct: (v) => Object.values(v).every((x) => x <= 35),
    dropPct: (v) => v <= 20, rarePct: (v) => v <= 20, superPct: (v) => v <= 20, goldPct: (v) => v <= 20, expPct: (v) => v <= 15, encounterPct: (v) => v >= -50,
    rareEncPct: (v) => v <= 20, goldenPct: (v) => v <= 20, stealPct: (v) => v <= 50, escapePct: (v) => v <= 50, preemptPct: (v) => v <= 5, autoSteal: (v) => v <= 75,
    spd: (v) => v <= 20, eva: (v) => v <= 10, noFloorDamage: (v) => v === true,
  },
  super: {
    element: (v) => ELEMENTS.includes(v), onHit: (v) => STATUSES.includes(v.status) && v.chance > 0 && v.chance <= (v.status === 'death' ? 0.05 : 0.40),
    vs: (v) => Object.values(v).every((x) => x > 1 && x <= 2.0), drain: (v) => v > 0 && v <= 0.2, crit: (v) => v <= 20, hit: (v) => v <= 15,
    atk: (v) => v <= 20, def: (v) => v <= 20, mdef: (v) => v <= 20,
    elemResist: (v) => { const ks = Object.keys(v), xs = Object.values(v); return xs.every((x) => x >= 0.5) ? ks.length <= 4 : xs.every((x) => x >= 0) ? ks.length <= 2 : ks.length === 1; },
    elemBoost: (v) => Object.values(v).every((x) => x <= 30), statusResist: (v) => Object.keys(v).length <= 3 && Object.values(v).every((x) => x <= 0.6),
    statusImmune: (v) => v.length <= 3, hpPct: (v) => v <= 20, mpPct: (v) => v <= 25, regen: (v) => v === true,
    mpRegen: (v) => v <= 3, startBuffs: (v) => Object.keys(v).length <= 2 && Object.values(v).every((x) => x === 1),
    physPct: (v, it) => v <= (it._id === 'w_greatsword_sr_frenzy' ? 50 : 25), magicPct: (v) => v <= 25, healPct: (v) => v <= 50, itemPct: (v) => v <= 50,
    mpCostPct: (v) => v >= -35, techCostPct: (v) => v >= -35, mag: (v, it) => v <= 2 * T_(it),
    glimPct: (v, it) => Object.values(v).every((x) => x <= (it.tier === 9 ? 25 : 20)), profPct: (v) => Object.values(v).every((x) => x <= 50),
    dropPct: (v) => v <= 30, rarePct: (v) => v <= 30, superPct: (v) => v <= 30, goldPct: (v) => v <= 30, expPct: (v) => v <= 20, encounterPct: (v) => v >= -50,
    rareEncPct: (v) => v <= 30, goldenPct: (v) => v <= 30, stealPct: (v) => v <= 50, escapePct: (v) => v <= 50, preemptPct: (v) => v <= 10, autoSteal: (v) => v <= 100,
    spd: (v) => v <= 30, eva: (v) => v <= 15, defPct: (v) => v <= 25, mdefPct: (v) => v <= 25, autoRevive: (v) => v <= 0.3, autoCounter: (v) => v <= 0.3,
    noFloorDamage: (v) => v === true, metalHit: (v) => v === true,
  },
};
CAP.rare.metalHit = (v) => v === true;
// §8.3.6 のクセの範囲（レア = 弱い方、超レア = 強い方までの大きさ。小さい値はよい）
const QCAP = {
  rare: {
    defPct: (v) => v >= -25, mdefPct: (v) => v >= -25, takenPct: (v) => v <= 15, hpPct: (v) => v >= -10, spd: (v) => v >= -15, eva: (v) => v >= -10, hit: (v) => v >= -10,
    elemResist: (v) => Object.values(v).every((x) => x <= 1.25), statusResist: (v) => Object.values(v).every((x) => x >= -0.25),
    expPct: (v) => v >= -25, goldPct: (v) => v >= -25, encounterPct: (v) => v <= 50, mpCostPct: (v) => v <= 25, techCostPct: (v) => v <= 25,
    glimPct: (v) => Object.values(v).every((x) => x >= -50), twoHanded: (v) => v === true,
    statsAdd: (v, it) => Object.values(v).every((x) => x >= -gearStat(it.tier, 1)),
  },
  super: {
    defPct: (v) => v >= -50, mdefPct: (v) => v >= -50, takenPct: (v) => v <= 30, hpPct: (v) => v >= -30, spd: (v) => v >= -30, eva: (v) => v >= -20, hit: (v) => v >= -20,
    elemResist: (v) => Object.values(v).every((x) => x <= 2), statusResist: (v) => Object.values(v).every((x) => x >= -0.5),
    expPct: (v, it) => v >= (it.tier === 9 ? -100 : -50), goldPct: (v, it) => v >= (it.tier === 9 ? -100 : -50), encounterPct: (v) => v <= 50,
    mpCostPct: (v) => v <= 50, techCostPct: (v) => v <= 50, glimPct: (v) => Object.values(v).every((x) => x >= -100), twoHanded: (v) => v === true,
    sealTech: (v) => v === true, noSpell: (v) => v === true, hpLoss: (v) => v >= 3 && v <= 5,
    statsAdd: (v, it) => Object.values(v).every((x) => x >= -gearStat(it.tier, 2)),
  },
};
// §9.12.4 の表でクセが 2 つある超レア（表の略記が正。§8.14.1-4「クセ 0〜1」の例外として報告した）
const TWO_QUIRKS_OK = { w_staff_sr_hellfire: 'res:water1.5 mpCostPct+15', w_staff_sr_abyss: 'res:light1.5 hpPct-10' };
// 表の値を §8.3.5 の上限に合わせて直した品（check_weapons.js が表との差として許す）
const SPEC_DEVIATIONS = { w_dagger_r7: 'onHit chance 0.4 → 0.3（§8.3.5 のレアの上限 0.30）' };
// 表の名前を STYLE_JA に合わせて直した品（STYLE_JA の冒頭「画面に出るすべての文と名前の正。食い違ったらこのガイドに合わせる」）
// 系列の振り方（§8.6.2）から外した魔物の武器（A10a.5: クセで下げる能力値に単位を置かない）
const UNITS_FIX = { w_axe_sr_crabclaw: 's2' };   // (was w_fist_sr_crabclaw)
const NAME_DEVIATIONS = {
  w_spear_coral: ['さんごの槍', 'サンゴの槍', 'STYLE_JA §2「珊瑚 → サンゴ」'],
  w_staff_sr_coralwand: ['さんごの杖', 'サンゴの杖', 'STYLE_JA §2「珊瑚 → サンゴ」'],
};

// ---------------------------------------------------------------- §8.6.5 の T8 の一式・§8.13.1 の倍率
const SETS_T8 = {
  int: { stat: 'int', w1: 'w_staff_sr_cosmos', w2: 'w_staff_sr_moon', shield: 'sh_sr_blank', head: 'hd_sr_dusk', body: 'bd_sr_starry', hands: 'hn_sr_words', feet: 'ft_sr_cloud', acc: ['ac_sr_owl', 'ac_sr_ink'] },
  str: { stat: 'str', w1: 'w_sword_sr_hegemon', w2: 'w_axe_sr_titan', shield: 'sh_sr_steadfast', head: 'hd_sr_oni', body: 'bd_sr_dragonhide', hands: 'hn_sr_mighty', feet: 'ft_sr_quake', acc: ['ac_sr_beastheart', 'ac_sr_bloodoath'] },
  dex: { stat: 'dex', w1: 'w_dagger_sr_moonfang', w2: 'w_dagger_sr_silk', shield: 'sh_sr_phantom', head: 'hd_sr_heaveneye', body: 'bd_sr_shadow', hands: 'hn_sr_hundred', feet: 'ft_sr_whirl', acc: ['ac_sr_eagle', 'ac_sr_needle'] },
};
// N の一式（§8.13.1。武器は同じ系統の T8 の通常品 2 本）
const SETS_N = {
  int: { w: 'w_staff_8', shield: 'sh_book_8', head: 'hd_hat_8', body: 'bd_robe_8', hands: 'hn_longglove_8', feet: 'ft_slipper_8', acc: 'ac_int_8' },
  str: { w: 'w_sword_8', shield: 'sh_buckler_8', head: 'hd_helm_8', body: 'bd_mail_8', hands: 'hn_gauntlet_8', feet: 'ft_greave_8', acc: 'ac_str_8' },
  dex: { w: 'w_dagger_8', shield: 'sh_shield_8', head: 'hd_cap_8', body: 'bd_vest_8', hands: 'hn_glove_8', feet: 'ft_boots_8', acc: 'ac_dex_8' },
};
const BASE_8131 = { int: 52, str: 50, dex: 54 };                       // 術師・戦士・狩人の基本の能力値
const EXPECT_8131 = { int: [170, 259, 435], str: [167, 256, 432], dex: [131, 197, 331] };   // Z / N / S
const RATIO_OK = { sz: [2.4, 2.7], sn: [1.6, 1.75] };                     // §4.17.3 D1・D2
/** §4.4 の攻撃力・術力: round(W × (64 + S)/64) */
const power = (w, s) => Math.round(w * (64 + s) / 64);

// ---------------------------------------------------------------- 文字（STYLE_JA §1・§2・§7）
const width = (s) => { let w = 0; for (const ch of String(s)) w += ch.codePointAt(0) < 0x100 ? 0.5 : 1; return w; };
function styleLists() {
  const t = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
  const grab = (re) => { const m = t.match(re); return m ? [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]) : []; };
  const partial = [];
  const sec71 = t.split('### 7.1')[1].split('### 7.2')[0];
  for (const line of sec71.split('\n')) if (line.startsWith('- ') && line.includes('`')) for (const m of line.split(':').slice(1).join(':').matchAll(/`([^`]+)`/g)) partial.push(...m[1].split(/\s+/));
  const sec72 = t.split('### 7.2')[1].split('### 7.3')[0];
  const exact = [...(sec72.match(/`([^`]+)`/) || ['', ''])[1].split(/\s+/)].filter(Boolean);
  const allowed = (t.match(/\*\*使ってよい常用外の字\*\*:\s*([^\n]+)/) || ['', ''])[1].split(/\s+/).filter(Boolean);
  return { partial: partial.filter(Boolean), exact, allowed };
}
function joyoSet() {
  const f = path.join(ROOT, 'tools', 'lib', 'joyo.txt');
  if (!fs.existsSync(f)) return null;
  return new Set([...fs.readFileSync(f, 'utf8').replace(/\s/g, '')]);
}
const isKanji = (ch) => /[一-鿿㐀-䶿]/.test(ch);

// ---------------------------------------------------------------- 読み込み
/** core と weapontypes.js と武器の 5 ファイルだけ（ほかの担当のファイルに依らない）。rules が無いので数値は localFill。 */
function loadIsolated(opts) {
  opts = opts || {};
  // order: 'locale'（build.js・load.js と同じ localeCompare。既定）/ 'reverse' / 'codeunit'（Array#sort の既定）。
  // §1.2-2（同じディレクトリの中のロード順に頼らない）を確かめるため、どの順でも同じ品になることを test_weapons.js が比べる。
  const vm = require('vm');
  const noop = () => {};
  const sandbox = { console: { log: noop, warn: noop, error: console.error, info: noop }, Math, JSON, Date, Promise, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  let data = ['weapontypes.js', ...MY_FILES].sort((a, b) => a.localeCompare(b));
  if (opts.order === 'reverse') data = data.reverse();
  else if (opts.order === 'codeunit') data = ['weapontypes.js', ...MY_FILES].sort();
  const files = [path.join(ROOT, 'src', 'core', 'ns.js'), ...data.map((f) => path.join(ROOT, 'src', 'data', f))];
  const errors = [];
  for (const f of files) {
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
    catch (e) { errors.push(path.relative(ROOT, f) + ': ' + (e.message || e)); }
  }
  const R = sandbox.RPG;
  R._raw = snapshot(R);
  if (R.runDataHooks && opts.dataHooks !== false) R.runDataHooks();
  R._isolatedErrors = errors.concat(R.loadErrors || []);
  return R;
}
/** 全部のファイル（tools/lib/load.js）。local:true なら rules の fillItem を使わずに localFill で埋める。 */
function loadFull(opts) {
  opts = opts || {};
  const R = require(path.join(ROOT, 'tools', 'lib', 'load'))({ quiet: true, dataHooks: false });
  R._raw = snapshot(R);
  if (opts.local && R.WeaponItems) R.WeaponItems.forceLocal = true;
  R.runDataHooks();
  return R;
}
/** 数値を埋める前の武器の品（データのファイルに書いてある値だけ） */
function snapshot(R) {
  const out = {};
  const WI = R && R.WeaponItems;
  if (!WI) return out;
  for (const id of WI.all()) if (R.DB.items[id]) out[id] = JSON.parse(JSON.stringify(R.DB.items[id]));
  return out;
}

// =====================================================================================================
// SYSTEMS_REWORK §3.2 (A19): the 7 types, 260 weapons. The DESIGN §8 tables above are translated with the save remap
// (src/data/remap_a19.js): an old weapon whose new id is a sword / dagger normal or band id was merged into that
// item (dropped); any other old katana / club / fist / whip weapon was kept under its new id with the §3.2 overrides.
// =====================================================================================================
const NEW_WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];
const REMAP = (() => {
  const vm = require('vm');
  const box = { console: { log() {}, warn() {}, error() {} } };
  box.window = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'core', 'ns.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'data', 'remap_a19.js'), 'utf8'), box);
  return (box.RPG.DB.remap || {}).items || {};
})();
const GONE = ['katana', 'club', 'fist', 'whip'];
const oldType = (id) => (String(id).match(/^w_([a-z]+?)_/) || [])[1];
const merged = (to) => /^w_(sword|dagger)_(\d|r[13579]|iron)$/.test(to);
/** new id → old id, for the kept weapons of the four removed types */
const KEPT = {};
for (const [from, to] of Object.entries(REMAP)) if (/^w_/.test(from) && GONE.includes(oldType(from)) && !merged(to)) KEPT[to] = from;
const OLD_OF = (id) => KEPT[id] || id;
const TYPE_MULT = { sword: 1, greatsword: 1.4, dagger: 0.75, axe: 1.15, spear: 1.25, bow: 1.1, staff: 0.6 };
/** §3.2 overrides of a kept item: {mult, kind, art, hit, crit} (hit / crit = what the type change adds) */
function override(newId) {
  const o = OLD_OF(newId), ot = oldType(o), nt = oldType(newId);
  if (o === newId) return {};
  if (ot === 'katana') return { mult: 1.05, art: 'katana', crit: 8 };
  if (ot === 'club' || (ot === 'fist' && nt === 'axe')) return { mult: 1.05, kind: 'blunt', art: 'club', hit: 10 };
  if (ot === 'fist') return { mult: 0.85 };
  if (ot === 'whip' && (nt === 'bow' || nt === 'spear')) return { mult: 0.95 };
  return {};
}
/** the crit / hit an item carries because of its type change (not an effect) */
function typeAdjust(it) { const o = override(it._id || it.id || ''); return { crit: o.crit || 0, hit: o.hit || 0 }; }
const expectMult = (id, wtype) => (override(id).mult != null ? override(id).mult : TYPE_MULT[wtype]);
/** the type whose series rules (units, stats) the item still follows: the old one for a kept item (§3.2 "units stay") */
const seriesType = (id, wtype) => (KEPT[id] ? oldType(KEPT[id]) : wtype);

// §3.2's new names (the fist / whip items that were renamed; the katana / club items keep their names)
const NEW_NAMES = (() => {
  const out = {};
  const txt = fs.readFileSync(path.join(ROOT, 'design', 'build', 'SYSTEMS_REWORK.md'), 'utf8');
  const sec = txt.slice(txt.indexOf('### 3.2'), txt.indexOf('### 3.3'));
  for (const l of sec.split('\n')) {
    if (!/^\| w_/.test(l)) continue;
    const c = l.split('|').slice(1, -1).map((x) => x.trim().replace(/\*\*/g, ''));
    if (/[/〜]/.test(c[0]) || /[/〜]/.test(c[1]) || !c[2] || c[2] === '—' || /名前そのまま|（/.test(c[2])) continue;
    out[c[1]] = c[2];
  }
  return out;
})();
/** DESIGN id → the id the item has now (null = merged into another item, it no longer exists) */
const NOW = (id) => { const t = oldType(id); if (!GONE.includes(t)) return id; const to = REMAP[id]; return !to || merged(to) ? null : to; };
/** a DESIGN table's mods key / value after A18 (WP keys become their MP counterparts) */
const A18_KEY = { wpCostPct: 'techCostPct', wpRegen: 'mpRegen' };

// §3.3 lines (9) and the extra T0 打ち刀
const LINES = [
  ['w_sword', 'sword', 's2', 'w_sword_iron', 'w_sword'], ['w_greatsword', 'greatsword', 's2', 'w_greatsword_iron', 'w_greatsword'], ['w_dagger', 'dagger', 'd2', 'w_dagger_iron', 'w_dagger'],
  ['w_axe', 'axe', 's2', 'w_axe_hand', 'w_axe'], ['w_axe_mace', 'axe', 's1v1', 'w_axe_cudgel', 'w_club'], ['w_spear', 'spear', 's1d1', 'w_spear_iron', 'w_spear'],
  ['w_bow', 'bow', 'd2', 'w_bow_short', 'w_bow'], ['w_staff', 'staff', 'i2', 'w_staff_novice', 'w_staff'], ['w_staff_prayer', 'staff', 'm2', null, 'w_staff_prayer'],
].map(([line, wtype, units, t0, old]) => ({ line, wtype, units, t0, old }));
const NORMAL_NAMES = Object.fromEntries(LINES.map((L) => [L.line, OLD_NORMAL_NAMES[L.old]]));
const SORT_SERIES = { sword: 0, greatsword: 1, dagger: 2, axe: 3, mace: 4, spear: 5, bow: 6, staff: 7, prayer: 8, uchi: 9 };
function sortSeries(it) {
  if (it.line === 'w_sword_uchi') return SORT_SERIES.uchi;
  if (it.wtype === 'axe' && it.art === 'club') return SORT_SERIES.mace;
  if (it.wtype === 'staff') return it.units === 'm2' ? SORT_SERIES.prayer : SORT_SERIES.staff;
  return SORT_SERIES[it.wtype];
}
// §5.1.4 starters with the §3.5 ids
const STARTERS = {
  w_sword_iron: '鉄の剣', w_greatsword_iron: '鉄の大剣', w_dagger_iron: '鉄の短剣', w_axe_hand: '手斧', w_spear_iron: '鉄の槍', w_bow_short: '短弓',
  w_axe_cudgel: '木の棍棒', w_staff_novice: '見習いの杖', w_sword_uchi: '打ち刀',
};
// §8.5 / §8.6.5 / §8.7.2 hand-made table, remapped: merged items drop, kept ones take the new id and the new atk
const HAND_TABLE = {};
for (const [id, row] of Object.entries(OLD_HAND_TABLE)) {
  const to = GONE.includes(oldType(id)) ? REMAP[id] : id;
  if (!to || (to !== id && merged(to))) continue;
  const r = row.slice();
  if (to !== id) r[1] = Math.round(W[r[0]] * expectMult(to, oldType(to)));
  HAND_TABLE[to] = r;
}
const HAND_EXCLUSIVE = {};
for (const [id, m] of Object.entries(OLD_HAND_EXCLUSIVE)) HAND_EXCLUSIVE[REMAP[id] && !merged(REMAP[id]) ? REMAP[id] : id] = m;
// the ids by group (R.WeaponItems.ids) and §3.2's per-type count [normal, band rare, mdrop, super]
const COUNTS = { normal: 91, rare: 47, super: 10, mrare: 31, msuper: 79, fixed: 2, total: 260 };
const COUNT_32 = { sword: [11, 8, 6, 16], greatsword: [10, 5, 3, 4], dagger: [10, 5, 5, 15], axe: [20, 10, 7, 15], spear: [10, 5, 4, 15], bow: [10, 5, 4, 11], staff: [20, 9, 2, 15] };
const BAND_PER_TIER = { 1: 8, 3: 8, 5: 9, 7: 11, 9: 11 };
// normal weapons whose desc is written out (not weapontypes desc + stat line): the mace line (its hit +10 would read
// 「よく当たる」, WEAPONS phase 1) and 打ち刀 (its crit +8 reads 「会心が出やすい」)
const NORMAL_DESC_OK = { w_axe_mace: /^打撃で、硬い敵や骨の敵に強い。\n腕力と体力が上がる。$/, w_sword_uchi: /^(腕力と器用さが上がる。\n会心が出やすい。|片手持ち。盾と合わせて攻守に強い。\n腕力と器用さが上がる。)$/ };   // (the second: the isolated local fill, which has no crit line)

module.exports = {
  ROOT, MY_FILES, W, U, PRICE, GRADE_MULT, PRICE_MULT, gearStat, WTYPES: NEW_WTYPES, OLD_WTYPES, TWO_HANDED, WEAPON_STATS, SERIES_UNITS,
  REMAP, KEPT, OLD_OF, NEW_NAMES, NOW, A18_KEY, oldType, override, typeAdjust, expectMult, seriesType, TYPE_MULT, COUNT_32, BAND_PER_TIER, NORMAL_DESC_OK, sortSeries, OLD_HAND_TABLE,
  LINES, normalId, ATK_TABLE, NORMAL_NAMES, STARTERS, STARTERS_ARMOR, HAND_TABLE, HAND_EXCLUSIVE, COUNTS, COUNT_BY_WTYPE,
  LINEAGES, lineageOf, stageOf, srTier, band, RACE_STATS, monsterWeaponUnits,
  MOD_KEYS, WEAPON_FIELDS, ITEM_KEYS, NUMERIC_FILLED, ELEMENTS, STATUSES, RACES, VS_FLAGS, BUFF_STATS,
  classify, CAP, QCAP, TWO_QUIRKS_OK, SPEC_DEVIATIONS, NAME_DEVIATIONS, UNITS_FIX, SETS_T8, SETS_N, BASE_8131, EXPECT_8131, RATIO_OK, power,
  width, styleLists, joyoSet, isKanji, loadIsolated, loadFull,
};
