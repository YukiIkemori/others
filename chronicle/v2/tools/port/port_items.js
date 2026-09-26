// port_items.js（RULES）: 今の木（chronicle/src。P0 の写しのハッシュは port/manifest.json）の品を v2 の形に移す。
//   node v2/tools/port/port_items.js           → v2/src/data/items_*.js（key を除く）と items_steal.js を書く
//   node v2/tools/port/port_items.js --check   → 書かずに数・名前の付け替え・クセの削り方を表示する
//   node v2/tools/port/port_items.js --rename  → 旧 id → 新 id と消えた品の JSON（魔物の drops・プールの参照を直すため）
// 出力のファイルが以後の正（V2_PLAN §1.2）。数値（atk mag def mdef eva price abil）は書かない: R.Rules.fillItem が R.onData で決める。
//
// 変換（STATS_REWORK。§ はその文書の節）
//   - 旧 type → slot（weapon shield head body hands feet acc use key。K.item）、武器は wtype を 5 系統に（§8.1・§8.3）
//   - 斧・槍の品の付け替えと削除（§8.3）。大槌の系列 w_greatsword_club・w_greatsword_maul_1〜9
//   - クセ: 付録 A で「残す」の 35 品だけ残す（§4.1、w_axe_r7 は消える）。ほかは悪い効果を消して desc を付録 A の文に（§4.2）
//   - 能力値: 旧の stats・units の数・XPct（strPct…）は使わない。付録 A の「新の能力」が §3.1 の表と違う品だけ abil を書く（遺物・報酬など）
//   - 固定値の atk・mag の効果のかけ直し（§3.3-3）、通常の能力のアクセ 60 品の効果（§3.2）
//   - expPct → growPct（§9.4）、実（grow）の品を消す（§10.2）
//   - icon は R.Contract.ICONS の名前
//   - 盗み専用 36 品（§7.2）を items_steal.js に（能力値は §3.1 の超レアの表。ボスの率は V2_PLAN §2.6.6 で 16）
// ほかの道具（port_techs.js など）もここの loadOld・lit を使う。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const V2 = path.resolve(__dirname, '..', '..');
const ROOT = path.resolve(V2, '..');

/** 今の木の src を node で読む（DOM なし。onData は既定で走らせない = 品は登録の直後の生の形）。
 *  R.__fileOf[kind][id] = その品を登録したファイルの名前 */
function loadOld(opts) {
  opts = opts || {};
  const SRC = path.join(ROOT, 'src');
  const DIRS = ['core', 'ui', 'data', 'art', 'audio', 'maps', 'events', 'systems'];
  const CORE_FIRST = ['ns.js', 'input.js', 'gfx.js', 'engine.js', 'save.js'];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = [];
  for (const d of DIRS) {
    const dir = path.join(SRC, d);
    if (!fs.existsSync(dir)) continue;
    if (opts.only && !opts.only.includes(d)) continue;
    files.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => {
      if (d === 'core') {
        const ia = CORE_FIRST.indexOf(path.basename(a)), ib = CORE_FIRST.indexOf(path.basename(b));
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.localeCompare(b);
    }));
  }
  const noop = () => {};
  const sb = {
    console: { log: noop, warn: noop, error: noop, info: noop }, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Math, JSON, Date,
    performance: { now: () => Date.now() }, requestAnimationFrame: noop, addEventListener: noop, removeEventListener: noop,
    navigator: { getGamepads: () => [] }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, TextEncoder, TextDecoder,
  };
  sb.window = sb;
  vm.createContext(sb);
  const fileOf = { items: {}, actions: {} };
  const seen = { items: new Set(), actions: new Set() };
  for (const f of files) {
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), sb, { filename: f }); } catch (e) { /* 絵などの読み込みの失敗は品に関係しない */ }
    const R = sb.RPG;
    if (!R || !R.DB) continue;
    for (const k of ['items', 'actions']) for (const id of Object.keys(R.DB[k] || {})) if (!seen[k].has(id)) { seen[k].add(id); fileOf[k][id] = path.basename(f); }
  }
  const R = sb.RPG;
  if (opts.dataHooks && R.runDataHooks) R.runDataHooks();
  R.__fileOf = fileOf;
  return R;
}

/** JS の値 → ソースの文字列（キーは識別子なら引用なし、文字列は '…'） */
function lit(v, ind, lvl) {
  ind = ind || 2; lvl = lvl || 1;
  const pad = ' '.repeat(ind * lvl), pad0 = ' '.repeat(ind * (lvl - 1));
  if (v === null) return 'null';
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => lit(x, ind, lvl + 1));
    const one = '[' + parts.join(', ') + ']';
    return one.length <= 100 && !one.includes('\n') ? one : '[\n' + parts.map((p) => pad + p).join(',\n') + ',\n' + pad0 + ']';
  }
  const keys = Object.keys(v).filter((k) => v[k] !== undefined);
  const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'");
  const parts = keys.map((k) => key(k) + ': ' + lit(v[k], ind, lvl + 1));
  const one = '{ ' + parts.join(', ') + ' }';
  if (!keys.length) return '{}';
  if (lvl > 2 && one.length <= 140 && !one.includes('\n')) return one;
  if (lvl > 1 && one.length <= 150 && !one.includes('\n')) return one;
  return '{\n' + parts.map((p) => pad + p).join(',\n') + ',\n' + pad0 + '}';
}
function header(title) { return `// ${title}\n// 生成: node v2/tools/port/*.js（今の木から移した結果。以後はこのファイルが正）\n`; }

module.exports = { loadOld, lit, header, ROOT, V2 };
if (require.main !== module) return;

// =====================================================================================================
const CHECK = process.argv.includes('--check');
const R = loadOld();
const I = R.DB.items;
const FILE = R.__fileOf.items;
const WT5 = ['sword', 'greatsword', 'dagger', 'bow', 'staff'];
const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const STATS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
const ABBR = { '腕': 'str', '体': 'vit', '器': 'dex', '素': 'agi', '知': 'int', '精': 'mnd' };
const clone = (o) => JSON.parse(JSON.stringify(o));
const W = (s) => { let w = 0; for (const ch of String(s)) w += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.5 : 1; return w; };

// ------------------------------------------------------------ 付録 A を読む（id → {abil, keep, desc}）
const SR = fs.readFileSync(path.join(ROOT, 'design', 'build', 'STATS_REWORK.md'), 'utf8');
const APPX = {};
{
  const part = SR.slice(SR.indexOf('## 付録 A'));
  for (const line of part.split('\n')) {
    const m = /^\| ([a-z][a-z0-9_]+) \| ([^|]*) \| ([^|]*) \| ([RS])(\d) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$/.exec(line);
    if (!m) continue;
    const abil = {};
    for (const t of m[7].trim().split(/[\s・]+/)) { const mm = /^(.)\+(\d)$/.exec(t); if (mm && ABBR[mm[1]]) abil[ABBR[mm[1]]] = (abil[ABBR[mm[1]]] || 0) + +mm[2]; }
    const how = m[9].trim();
    APPX[m[1]] = { abil, keep: /^残す/.test(how), desc: /→/.test(how) ? how.split('→')[1].trim() : null, oldQuirk: m[8].trim() };
  }
}

// ------------------------------------------------------------ 付け替え（§8.3）
const SPEAR_TO = {
  w_spear_sr_irontusk: ['w_greatsword_sr_irontusk', '鉄牙の大剣'], w_spear_sr_chaincurse: ['w_greatsword_sr_chaincurse', '呪い鎖の大鎌'],
  w_spear_sr_harpoon: ['w_greatsword_sr_harpoon', '魚人の大銛'], w_spear_sr_venomjelly: ['w_sword_sr_venomjelly', '毒ゼリーの細剣'],
  w_spear_sr_whiteline: ['w_sword_sr_whiteline', '白線の細剣'], w_spear_sr_stormbeak: ['w_sword_sr_stormbeak', '嵐のくちばし剣'],
  w_spear_sr_venomneedle: ['w_sword_sr_venomneedle', '蜂針の細剣'], w_spear_sr_marsh: ['w_sword_sr_marsh', '沼の突き剣'],
  w_spear_sr_eightarm: ['w_sword_sr_eightarm', '八本腕の細剣'], w_spear_sr_sparkhorn: ['w_sword_sr_sparkhorn', '火花角の細剣'],
  w_spear_sr_flamehorn: ['w_sword_sr_flamehorn', '炎角の細剣'], w_spear_sr_soot_fork: ['w_sword_sr_soot_fork', 'すす悪魔の刺し剣'],
  w_spear_sr_windcutter: ['w_sword_sr_windcutter', '風切りの竜剣'], w_spear_sr_quicksilver: ['w_sword_sr_quicksilver', '白銀の流れ剣'],
  w_spear_sr_mirrorhorn: ['w_sword_sr_mirrorhorn', '鏡角の細剣'], w_spear_coral: ['w_sword_coral', 'サンゴの細剣'],
  w_spear_mist: ['w_sword_mist', '霧の細剣'], w_spear_reed: ['w_sword_reed', 'アシの細剣'], w_spear_hornet: ['w_sword_hornet', '大バチの細剣'],
};
/** 旧 id → 新 id（null = 消す） */
function renameId(id) {
  const it = I[id];
  if (it && it.type === 'weapon') {
    if (/^w_axe_(hand|\d)$/.test(id)) return null;
    if (/^w_spear_(iron|\d)$/.test(id)) return null;
    if (/^w_(axe|spear)_r\d$/.test(id)) return null;
    if (id === 'w_axe_cudgel') return 'w_greatsword_club';
    let m;
    if ((m = /^w_axe_mace_(\d)$/.exec(id))) return 'w_greatsword_maul_' + m[1];
    if (SPEAR_TO[id]) return SPEAR_TO[id][0];
    if (/^w_spear_/.test(id)) return null;   // 表に無い槍の品（無いはず）
    if ((m = /^w_axe_(.+)$/.exec(id))) return 'w_greatsword_' + m[1];
  }
  if (it && it.use && JSON.stringify(it.use).includes('"grow"')) return null;   // 実（§10.2）
  if (id === 'ac_badge_axe' || id === 'ac_badge_spear') return null;             // 斧・槍の腕章（§8.1）
  if (id === 'ac_otto_lantern') return 'ac_keeper_lantern';                       // オットーの灯台守のランタン（V2_PLAN §3.7）
  return id;
}
const RENAME = {};
const DROPPED = [];
for (const id of Object.keys(I)) {
  if (I[id].type === 'key') continue;
  const n = renameId(id);
  if (n === null) DROPPED.push(id);
  else if (n !== id) RENAME[id] = n;
}

// ------------------------------------------------------------ クセ（§4）
const QUIRK_KEEP_41 = ['hd_sr_oni', 'hd_sr_berserk', 'w_greatsword_sr_frenzy', 'bd_sr_starry', 'ac_sr_bloodoath', 'ac_rs_thorn', 'ac_sr_ouroboros',
  'ac_sr_beastheart', 'ac_sr_firebird', 'bd_sr_dragonhide', 'bd_sr_chimera_hide', 'bd_sr_salamander', 'ac_rs_tide', 'sh_sr_void_aegis', 'bd_r5_str',
  'sh_r7_dex', 'hd_sr_blizzard_hat', 'bd_sr_whirlpool', 'ac_sr_cursed_lock', 'ac_rs_clover', 'ac_sr_coin', 'w_dagger_sr_mirror', 'w_sword_sr_matsuyoi',
  'sh_sr_steadfast', 'w_sword_sr_echo', 'w_sword_r5k', 'w_spear_sr_quicksilver', 'w_spear_sr_mirrorhorn', 'w_sword_sr_platinum', 'ac_sr_glass',
  'ac_rs_prism', 'ac_sr_demon_eye', 'w_staff_sr_abyss', 'w_axe_sr_chaos', 'bd_sr_chaos_hide'];   // w_axe_r7 は消える（35 品）
// 「高いほど良い」数と「低いほど良い」数（クセ = 悪い向きの値）
const LOWER_GOOD = { mpCostPct: 1, techCostPct: 1, takenPct: 1, hpLoss: 1 };
const BOOL_BAD = { noSpell: 1 };
/** クセの効果を消す。→ 消したキーの一覧 */
function stripQuirk(o, id) {
  const gone = [];
  const m = o.mods || {};
  for (const k of Object.keys(m)) {
    const v = m[k];
    if (BOOL_BAD[k] && v) { delete m[k]; gone.push(k); continue; }
    if (k === 'encounterPct' && v > 0) { delete m[k]; gone.push(k); continue; }
    if (typeof v === 'number') {
      if (LOWER_GOOD[k] ? v > 0 : v < 0) { delete m[k]; gone.push(k); }
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const e of Object.keys(v)) {
        const bad = k === 'elemResist' ? v[e] > 1 : v[e] < 0;
        if (bad) { delete v[e]; gone.push(k + '.' + e); }
      }
      if (!Object.keys(v).length) delete m[k];
    }
  }
  if (o.mods && !Object.keys(o.mods).length) delete o.mods;
  if (o.statsAdd) { delete o.statsAdd; gone.push('statsAdd'); }
  if (o.slot === 'weapon') {
    if (o.hit < 0) { delete o.hit; gone.push('hit'); }
    if (o.sealTech) { delete o.sealTech; gone.push('sealTech'); }
    if (o.twoHanded) { delete o.twoHanded; gone.push('twoHanded'); }
  } else {
    // 守りを下げるクセ（def・mdef を低く書いた品）は書いた値を消して式で埋める
    if (typeof o.def === 'number') { delete o.def; gone.push('def'); }
    if (typeof o.mdef === 'number') { delete o.mdef; gone.push('mdef'); }
  }
  delete o.quirk;
  return gone;
}

// ------------------------------------------------------------ 能力値（§3.1）: port 時の検算用（rules.js の fillItem と同じ表）
const ABIL_GEAR = {
  rare: { weapon: [0, 0, 0, 0, 0, 1, 1, 1, 1, 2], body: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1], acc: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1], armor: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  super: { weapon: [1, 1, 1, 1, 1, 2, 2, 2, 3, 4], body: [1, 1, 1, 1, 1, 1, 1, 2, 2, 3], acc: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2], armor: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
};
const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
function ruleAbil(o) {
  const t = ABIL_GEAR[o.grade];
  if (!t) return {};
  const g = o.slot === 'weapon' || o.slot === 'body' || o.slot === 'acc' ? o.slot : 'armor';
  const v = t[g][Math.max(0, Math.min(9, o.tier | 0))];
  const letters = String(o.units || '').replace(/\d/g, '').split('').filter((c) => SK[c]);
  const out = {};
  if (!v || !letters.length) return out;
  if (letters.length === 1) out[SK[letters[0]]] = v;
  else { out[SK[letters[0]]] = Math.ceil(v / 2); if (Math.floor(v / 2)) out[SK[letters[1]]] = (out[SK[letters[1]]] || 0) + Math.floor(v / 2); }
  return out;
}
const sameAbil = (a, b) => STATS.every((k) => (a[k] || 0) === (b[k] || 0));

// §3.3-3 固定値の atk・mag のかけ直し（旧の id で）
const FIXED = { ac_r5_int: ['mag', 9], ac_r7_int: ['mag', 14], ac_r9_int: ['mag', 20], ac_sr_demon_eye: ['mag', 22], hd_sr_cursed_wrap: ['mag', 10],
  bd_sr_flame_robe: ['mag', 10], hd_sr_blizzard_hat: ['mag', 11], hd_sr_sapphire: ['mag', 11], sh_sr_memory_bowl: ['mag', 33], w_staff_r7b: ['mag', 14],
  w_staff_r9b: ['mag', 20], w_staff_sr_abyss: ['mag', 16], w_staff_sr_goldquill: ['mag', 31], w_staff_sr_cosmos: ['mag', 33], hn_sr_digger: ['atk', 6],
  hn_sr_chimera_paw: ['atk', 7], hn_sr_iron_tooth: ['atk', 11], hd_sr_demon_general: ['atk', 26] };
// §3.2 通常の能力のアクセ 60 品
const ACC_W = [1, 1, 1, 2, 3, 4, 5, 7, 8, 10];
const ACC_LINES = {
  ac_str: (T) => [{ atk: ACC_W[T] }, '攻撃力が上がる。'],
  ac_int: (T) => [{ mag: ACC_W[T] }, '術力が上がる。'],
  ac_vit: (T) => [{ hpPct: [3, 3, 4, 4, 5, 5, 6, 6, 7, 8][T] }, '最大HPが上がる。'],
  ac_dex: (T) => [{ hit: [2, 2, 3, 3, 4, 4, 5, 5, 6, 6][T], crit: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4][T] }, 'よく当たる。\n会心が出やすい。'],
  ac_agi: (T) => [{ spd: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12][T], eva: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4][T] }, 'すばやく動ける。\nかわしやすい。'],
  ac_mnd: (T) => [{ mdef: [4, 6, 8, 10, 11, 13, 15, 17, 19, 21][T], healPct: [3, 3, 4, 4, 5, 5, 6, 6, 7, 8][T] }, '術防が上がる。\n回復がよく効く。'],
};
// icon（R.Contract.ICONS の名前）
const SLOT_ICON = { shield: 'shield', head: 'helm', body: 'armor', hands: 'glove', feet: 'boots', acc: 'ring', key: 'key' };
const EL_ICON = { fire: 'fire', water: 'ice', wind: 'wind', earth: 'earth', light: 'light', dark: 'dark' };   // 水の印は ICONS に無い（CORE に依頼）
const USE_ICON = { herb: 'heal', potion: 'potion', drop: 'potion', feather: 'star', bomb: 'fire', powder: 'bag', seed: 'gem', bell: 'bulb', flute: 'chat',
  rope: 'exit', mirror: 'search', coin: 'coin', book: 'book', acc: 'ring', key: 'key' };
const TYPE_SLOT = { weapon: 'weapon', shield: 'shield', head: 'head', body: 'body', hands: 'hands', feet: 'feet', acc: 'acc', consumable: 'use', key: 'key' };

/** 付録 A の desc を 1 行 20 字・2 行に詰める */
function packDesc(s) {
  const sents = s.split('。').filter(Boolean).map((x) => x + '。');
  const lines = [''];
  for (const t of sents) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = t;
    else if (W(cur + t) <= 20) lines[lines.length - 1] = cur + t;
    else lines.push(t);
  }
  return lines.join('\n');
}

// ------------------------------------------------------------ 変換
const out = {};            // file → {id: item}
const log = { stripped: 0, kept: [], abilWritten: 0, noQuirkFound: [], descFromAppx: 0, renamed: 0 };
const keepSet = new Set(Object.keys(APPX).filter((id) => APPX[id].keep));
for (const id of Object.keys(I)) {
  const it = I[id];
  if (it.type === 'key') continue;            // 大事な物は EVENTS（items_key.js）
  const nid = renameId(id);
  if (nid === null) continue;
  const o = clone(it);
  o.slot = TYPE_SLOT[o.type];
  delete o.type;
  // --- 武器の系統（§8.1・§8.3）
  if (o.slot === 'weapon') {
    if (o.wtype === 'axe') {
      o.wtype = 'greatsword';
      if (o.kind === 'blunt' || o.art === 'club' || /mace|cudgel|_r\dm$/.test(id)) {
        o.kind = 'blunt'; o.art = 'club'; o.mult = 1.35; o.hit = Math.max(o.hit || 0, 5);
        if (id === 'w_axe_cudgel') o.name = '木の大棍棒';
        else o.name = o.name.replace(/メイス|ハンマー|棍棒/, '大槌');
        if (o.line === 'w_axe_mace') o.line = 'w_greatsword_maul';
      } else {
        o.art = 'axe'; o.mult = 1.40; o.crit = (o.crit || 0) + 2;
        if (o.name === '小鬼の手斧') o.name = '小鬼の大斧';
      }
      if (o.icon) delete o.icon;
    } else if (o.wtype === 'spear') {
      const [to, name] = SPEAR_TO[id];
      o.name = name;
      if (to.startsWith('w_greatsword')) { o.wtype = 'greatsword'; o.kind = o.kind || 'pierce'; }
      else { o.wtype = 'sword'; o.art = 'rapier'; o.astat = ['str', 'dex']; o.kind = 'pierce'; o.hit = (o.hit || 0) + 5; }
      if (o.icon) delete o.icon;
    }
    if (!WT5.includes(o.wtype)) throw new Error('weapon type ' + o.wtype + ' ' + id);
  }
  // --- 効果の中の系統のキー（斧 → 大剣、槍 → 剣。§8.1）
  if (o.mods) for (const k of ['glimPct', 'profPct']) {
    const mm = o.mods[k];
    if (!mm || typeof mm !== 'object') continue;
    for (const [from, to] of [['axe', 'greatsword'], ['spear', 'sword']]) if (mm[from] != null) { mm[to] = Math.max(mm[to] || 0, mm[from]); delete mm[from]; }
  }
  // --- 能力値: 旧の stats と XPct は使わない
  delete o.stats;
  if (o.mods) for (const k of STATS) delete o.mods[k + 'Pct'];
  // --- expPct → growPct（§9.4）
  if (o.mods && o.mods.expPct != null) { o.mods.growPct = o.mods.expPct; delete o.mods.expPct; }
  if (id === 'ac_sr_ouroboros') { o.mods = o.mods || {}; o.mods.growPct = -100; }
  // --- クセ（§4）
  const ap = APPX[id];
  const keep = keepSet.has(id) || QUIRK_KEEP_41.includes(id);
  if (it.quirk && !keep) {
    const gone = stripQuirk(o, id);
    if (!gone.length) log.noQuirkFound.push(id);
    log.stripped++;
    if (ap && ap.desc) { o.desc = packDesc(ap.desc); log.descFromAppx++; }
    else if (o.desc && /ただし/.test(o.desc)) o.desc = o.desc.split(/[／\n]?ただし/)[0].replace(/\n$/, '');
  } else if (keep) {
    o.quirk = true;
    // 能力値を下げるクセ: 旧 −X → −max(1, round(X / (T ≥ 7 ? 6 : 4)))（§3.1）
    if (o.statsAdd) for (const k of Object.keys(o.statsAdd)) if (o.statsAdd[k] < 0) o.statsAdd[k] = -Math.max(1, Math.round(-o.statsAdd[k] / ((o.tier | 0) >= 7 ? 6 : 4)));
    log.kept.push(nid);
  }
  // 残した品の desc の「経験値」は伸びの文に
  if (o.desc) o.desc = o.desc.replace('経験値が入らない', 'HPとMPが伸びなくなる').replace('経験値が減る', 'HPとMPが伸びにくい').replace('経験値が増える', 'HPとMPが伸びやすい')
    .replace(/(.)が割合で上がる/, '$1が上がる');
  // --- 能力値の上書き（付録 A が §3.1 の表と違う品だけ）
  if (ap) {
    const rule = ruleAbil(o);
    if (!sameAbil(ap.abil, rule)) { o.abil = Object.keys(ap.abil).length ? ap.abil : 0; log.abilWritten++; }
  } else if ((o.src === 'relic' || o.src === 'reward') && it.mods) {
    const a = {};
    for (const k of STATS) if (it.mods[k + 'Pct'] > 0) a[k] = 1;
    if (Object.keys(a).length) { o.abil = a; log.abilWritten++; }
  }
  // --- §3.3-3 固定値のかけ直し、§3.2 通常のアクセ
  if (FIXED[id]) { o.mods = o.mods || {}; o.mods[FIXED[id][0]] = FIXED[id][1]; }
  const lm = /^(ac_(?:str|int|vit|dex|agi|mnd))_(\d)$/.exec(id);
  if (lm && o.grade === 'normal') { const [mods, desc] = ACC_LINES[lm[1]](+lm[2]); o.mods = mods; o.desc = desc; }
  // --- icon
  if (o.slot === 'weapon') o.icon = o.wtype;
  else if (SLOT_ICON[o.slot]) o.icon = SLOT_ICON[o.slot];
  else if (o.slot === 'use') {
    const k = String(o.icon || '').replace(/^icon:/, '');
    o.icon = /^el_/.test(k) ? EL_ICON[k.slice(3)] : USE_ICON[k] || 'potion';
  }
  // 数値は fillItem が決める（書いてあった値は §3 の式の外なので消す。遺物の値段は残す）
  if (o.slot === 'weapon') { delete o.atk; if (!FIXED[id]) delete o.mag; }
  if (o.price !== undefined && !(o.src === 'relic' || o.src === 'reward' || o.slot === 'use')) delete o.price;
  delete o.units_;   // （無い）
  if (nid !== id) log.renamed++;
  const file = FILE[id] || 'items_misc.js';
  (out[file] = out[file] || {})[nid] = o;
}

// ------------------------------------------------------------ v2 で足す道具（V2_PLAN §3.7: ファロスの道具屋の松明）
(out['items_use.js'] = out['items_use.js'] || {}).i_torch = {
  name: '松明', grade: 'normal', src: 'shop', price: 30, slot: 'use', icon: 'fire', sort: 460,
  desc: '暗い所で、しばらく\n一行の周りを明るく照らす。',
  use: { target: 'party', effects: [{ type: 'light', r: 6, steps: 200 }], fx: 'fire', battle: false, field: true },
};

// ------------------------------------------------------------ 盗み専用（§7.2。V2_PLAN §2.6.6: ボスの率は 16）
const E6 = (v) => Object.fromEntries(ELEMENTS.map((e) => [e, v]));
const ST = (slot, T, name, mods, abil, o) => Object.assign({ name, slot, grade: 'super', tier: T, src: 'steal', stealOnly: true }, o || {}, mods ? { mods } : {}, abil ? { abil } : {});
const STEAL = {
  // [品, 魔物, rate]（rate は BATTLE が drops.steal に書く。通常 32・レア 16・ボス 16）
  ac_st_rooteater: [ST('acc', 5, '千年樹の若芽', { regen: 1, hpPct: 10 }, { mnd: 1 }), 'b_rooteater', 16],
  ac_st_sandking: [ST('acc', 5, '名を返した王の指輪', { goldPct: 25, escapePct: 50 }, { agi: 1 }), 'b_sandking', 16],
  ac_st_whitedragon: [ST('acc', 5, '白竜の逆鱗', { elemResist: { water: 0.5, wind: 0.5 } }, { vit: 1 }), 'b_whitedragon', 16],
  ac_st_mistbeast: [ST('acc', 5, '霧の核', { eva: 10, statusResist: { confuse: 0.5 } }, { dex: 1 }), 'b_mistbeast', 16],
  ac_st_captain: [ST('acc', 5, '船長の羅針盤', { preemptPct: 15, rareEncPct: 20 }, { agi: 1 }), 'b_captain', 16],
  hn_st_ironwarden: [ST('hands', 5, '番人の鍵束', { stealPct: 40, def: 8 }, 0, { weight: 'heavy' }), 'b_ironwarden', 16],
  ac_st_lavabeast: [ST('acc', 5, '溶岩の心臓', { elemBoost: { fire: 20 }, elemResist: { fire: 0.5 } }, { str: 1 }), 'b_lavabeast', 16],
  ac_st_stareater: [ST('acc', 5, '星のしずく', { glimPct: { spell: 15 }, mpRegen: 2 }, { int: 1 }), 'b_stareater', 16],
  ac_st_rowell: [ST('acc', 6, '記録院の金筆', { techCostPct: -20, mpCostPct: -10 }, { dex: 1 }), 'b_rowell2', 16],
  ac_st_lazaro: [ST('acc', 8, '大書記の栞', { growPct: 20, glimPct: { tech: 10, spell: 10 } }, { int: 1 }), 'b_lazaro', 16],
  ac_st_shade_star: [ST('acc', 8, '杖の勇者の指輪', { magicPct: 15, mpCostPct: -10 }, { int: 1 }), 'b_shade_star', 16],
  bd_st_ouroboros: [ST('body', 9, '円環竜の逆鱗鎧', { elemResist: E6(0.75), hpPct: 10 }, { vit: 3 }, { weight: 'heavy' }), 'b_ouroboros', 16],
  ft_st_jewel_hare: [ST('feet', 3, '宝石ウサギの靴', { spd: 12, escapePct: 25 }, 0, { weight: 'light' }), 'rm_jewel_hare', 16],
  hn_st_gold_idol: [ST('hands', 3, '黄金の手袋', { stealPct: 50, autoSteal: 50 }, 0, { weight: 'light' }), 'rm_gold_idol', 16],
  sh_st_treasure_crab: [ST('shield', 3, 'ヤドカリの宝殻', { dropPct: 20, def: 6 }, 0, { weight: 'heavy' }), 'rm_treasure_crab', 16],
  bd_st_star_whale: [ST('body', 3, '星くじらの衣', { mpRegen: 2, mdef: 10 }, { mnd: 1 }, { weight: 'cloth' }), 'rm_star_whale', 16],
  ft_st_clock_bird: [ST('feet', 3, 'ぜんまいの靴', { spd: 12, preemptPct: 10 }, 0, { weight: 'light' }), 'rm_clock_bird', 16],
  ac_st_ghost_teapot: [ST('acc', 3, '幽霊の茶さじ', { healPct: 15, itemPct: 25 }, { mnd: 1 }), 'rm_ghost_teapot', 16],
  sh_st_volcano_turtle: [ST('shield', 3, '火山ガメの大甲', { elemResist: { fire: 0.5, earth: 0.75 }, def: 8 }, 0, { weight: 'heavy' }), 'rm_volcano_turtle', 16],
  w_staff_st_prisma: [ST('weapon', 3, '虹のかけらの杖', { elemBoost: E6(10) }, { int: 1 }, { wtype: 'staff' }), 'rm_prisma', 16],
  sh_st_bookworm: [ST('shield', 8, '虫食いの魔導書', { glimPct: { spell: 20 }, magicPct: 10 }, 0, { weight: 'cloth' }), 'rm_bookworm', 16],
  ac_st_dream_tapir: [ST('acc', 9, '夢食いの角笛', { statusImmune: ['sleep', 'confuse'], mpRegen: 3 }, { mnd: 2 }), 'rm_dream_tapir', 16],
  ac_st_thief_gull: [ST('acc', 4, '盗人カモメの羽', { autoSteal: 50, stealPct: 25 }, { agi: 1 }), 'seabird_3', 32],
  ac_st_rat_boss: [ST('acc', 6, '頭領の合い鍵', { stealPct: 40, dropPct: 15 }, { dex: 1 }), 'rat_4', 32],
  ac_st_abyss_gem: [ST('acc', 6, '奈落の底の宝石', { rarePct: 20, goldPct: 20 }, { vit: 1 }), 'mimic_4', 32],
  hd_st_fairy_queen: [ST('head', 6, '妖精姫の髪飾り', { healPct: 15, statusResist: { sleep: 0.5, confuse: 0.5 } }, 0, { weight: 'cloth' }), 'fairy_4', 32],
  ac_st_lady_fan: [ST('acc', 6, '貴婦人の扇', { eva: 10, preemptPct: 10 }, { agi: 1 }), 'doll_4', 32],
  w_greatsword_st_stoneaxe: [ST('weapon', 6, '族長の石斧', null, { str: 2 }, { wtype: 'greatsword', art: 'axe', element: 'earth', onHit: { status: 'poison', chance: 0.3 } }), 'lizardman_4', 32],
  bd_st_royal_linen: [ST('body', 8, '王家の聖布', { regen: 1, statusImmune: ['poison', 'silence'] }, { mnd: 2 }, { weight: 'cloth' }), 'mummy_5', 32],
  w_dagger_st_wolfking: [ST('weapon', 8, '氷牙の王爪', null, { dex: 3 }, { wtype: 'dagger', element: 'water', crit: 10 }), 'wolf_5', 32],
  ac_st_admiral: [ST('acc', 8, '提督の遠眼鏡', { rareEncPct: 20, goldenPct: 20 }, { agi: 1 }), 'skeleton_5', 32],
  hd_st_goblin_king: [ST('head', 8, '小鬼王の冠', { goldPct: 25, crit: 10 }, 0, { weight: 'heavy' }), 'goblin_5', 32],
  w_staff_st_strategist: [ST('weapon', 8, '軍師の采配', { glimPct: { tech: 10, spell: 10 }, mag: 20 }, { int: 3 }, { wtype: 'staff' }), 'imp_5', 32],
  ac_st_heaven_eye: [ST('acc', 8, '天の瞳', { hit: 15, preemptPct: 15 }, { dex: 1 }), 'eyeball_5', 32],
  ac_st_librarian: [ST('acc', 8, '司書長の眼鏡', { growPct: 20, glimPct: { spell: 15 } }, { int: 1 }), 'scribe_3', 32],
  ac_st_demon_heart: [ST('acc', 9, '魔神の心臓', { physPct: 15, magicPct: 15 }, { str: 1, int: 1 }), 'demon_3', 32],
};
const stealItems = {};
const stealSources = {};
for (const id of Object.keys(STEAL)) {
  const [o, mon, rate] = STEAL[id];
  o.icon = o.slot === 'weapon' ? o.wtype : SLOT_ICON[o.slot];
  if (o.abil === 0) delete o.abil;
  stealItems[id] = o;
  stealSources[id] = { mon, rate };
}

// ------------------------------------------------------------ 表示と書き出し
const counts = {};
let total = 0;
for (const f of Object.keys(out)) { counts[f] = Object.keys(out[f]).length; total += counts[f]; }
const bySlot = {};
for (const f of Object.keys(out)) for (const id of Object.keys(out[f])) { const o = out[f][id]; const k = o.slot === 'weapon' ? 'w:' + o.wtype : o.slot; bySlot[k] = (bySlot[k] || 0) + 1; }
// 付け替えのぶつかり
const allNew = {};
const dup = [];
for (const f of Object.keys(out)) for (const id of Object.keys(out[f])) { if (allNew[id]) dup.push(id); allNew[id] = f; }
for (const id of Object.keys(stealItems)) if (allNew[id]) dup.push(id);
console.log('items', total, '+ steal', Object.keys(stealItems).length, counts);
console.log('by slot', bySlot);
console.log('renamed', log.renamed, 'dropped', DROPPED.length, 'quirk stripped', log.stripped, 'kept', log.kept.length, 'desc from appendix', log.descFromAppx, 'abil written', log.abilWritten);
if (log.noQuirkFound.length) console.log('quirk items with nothing removed:', log.noQuirkFound.join(' '));
if (dup.length) { console.log('DUPLICATE ids:', dup.join(' ')); process.exitCode = 1; }
if (log.kept.length !== 35) { console.log('kept quirk items != 35:', log.kept.join(' ')); process.exitCode = 1; }

// --rename: 旧 id → 新 id と消えた品を JSON で出す（BATTLE の port_mons・QA が参照を直すのに使う）
if (process.argv.includes('--rename')) { process.stdout.write(JSON.stringify({ rename: RENAME, dropped: DROPPED }, null, 1) + '\n'); process.exit(0); }
if (!CHECK) {
  const dir = path.join(V2, 'src', 'data');
  fs.mkdirSync(dir, { recursive: true });
  const NOTE = {
    'items_weapons.js': '武器の通常品（5 系統＋大槌の系列）', 'items_weapons_rare.js': '武器の帯のレア', 'items_weapons_monster.js': '魔物の武器（レア・超レア）',
    'items_weapons_super.js': '武器の超レア', 'items_armor.js': '防具の通常品', 'items_armor_rare.js': '防具のレア', 'items_armor_monster.js': '魔物の防具',
    'items_armor_super.js': '防具の超レア', 'items_acc.js': 'アクセサリの通常品', 'items_acc_rare.js': 'アクセサリのレア', 'items_acc_monster.js': '魔物のアクセサリ',
    'items_acc_super.js': 'アクセサリの超レア', 'items_acc_relic.js': '遺物（レア魔物の落とし物）', 'items_acc_reward.js': '語りの報酬', 'items_use.js': '使う道具',
  };
  for (const f of Object.keys(out)) {
    const body = header(`${f} — ${NOTE[f] || '品'} ${counts[f]}（RULES。K.item。数値は R.Rules.fillItem が R.onData で埋める）`) +
      `(function (R) {\n  'use strict';\n  R.defs('items', ${lit(out[f], 2)});\n})(window.RPG);\n`;
    fs.writeFileSync(path.join(dir, f), body);
  }
  const sbody = header(`items_steal.js — 盗み専用の超レア ${Object.keys(stealItems).length}（RULES。STATS_REWORK §7.2、率は V2_PLAN §2.6.6。クセなし）`) +
    `// 盗める魔物と率（drops.steal = {item, rate}）は BATTLE が魔物のデータに書く。R.DB.stealSources はその照合用（validate・test_rules）。\n` +
    `(function (R) {\n  'use strict';\n  R.defs('items', ${lit(stealItems, 2)});\n  R.DB.stealSources = ${lit(stealSources, 2)};\n})(window.RPG);\n`;
  fs.writeFileSync(path.join(dir, 'items_steal.js'), sbody);
  console.log('wrote', Object.keys(out).length + 1, 'files');
}
