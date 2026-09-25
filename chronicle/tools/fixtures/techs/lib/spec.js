// Shared spec model for area A7 (techs): the values DESIGN.md §6 fixes, and the
// §6.5 power-ratio formula. Used by tools/test_techs.js and tools/check_techs.js.
// (Lives in a subdirectory so `build.js --with tools/fixtures/techs` does not load it.)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// §6.1.1 — official order.
const WTYPES = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];

// §6.8.1 / §3.1.1 / §4.3.4 — registry values per weapon type.
const WT_EXPECT = {
  sword:      { name: '剣',   twoHanded: false, reach: false, kind: 'slash',  fx: 'slash' },
  greatsword: { name: '大剣', twoHanded: true,  reach: false, kind: 'slash',  fx: 'slash2' },
  dagger:     { name: '短剣', twoHanded: false, reach: false, kind: 'pierce', fx: 'pierce' },
  axe:        { name: '斧',   twoHanded: false, reach: false, kind: 'slash',  fx: 'slash2' },
  spear:      { name: '槍',   twoHanded: true,  reach: true,  kind: 'pierce', fx: 'pierce' },
  bow:        { name: '弓',   twoHanded: true,  reach: true,  kind: 'pierce', fx: 'arrow' },
  club:       { name: '棍棒', twoHanded: false, reach: false, kind: 'blunt',  fx: 'strike' },
  staff:      { name: '杖',   twoHanded: false, reach: false, kind: 'blunt',  fx: 'strike' },
  katana:     { name: '刀',   twoHanded: false, reach: false, kind: 'slash',  fx: 'slash' },
  fist:       { name: '体術', twoHanded: false, reach: false, kind: 'blunt',  fx: 'strike' },
  whip:       { name: '鞭',   twoHanded: false, reach: true,  kind: 'blunt',  fx: 'lash' },
};

// §6.1.2 — the 121 ids, per weapon type in lv order.
const IDS = {
  sword: 'stepcut guard twin thrust wheel bulwark purify bladewind triple dawn crest',
  greatsword: 'overhead mow flat whirl desperate rend quake crush tempest skyfall rivers',
  dagger: 'vital filch venom knives lull bees gap nape shadow dance nightfall',
  axe: 'cleave woodcut throw rage reckless whirl cliff twostroke storm earthsplit giant',
  spear: 'upthrust butt skewer receive pierce cloud ripple phalanx soar surge starpierce',
  bow: 'rapid twin blind rain hush hawk pin volley gale starrain rainbow',
  club: 'smash crumble wrist tremor bell strip shatter rumble diamond thunder upheaval',
  staff: 'mind soothe seal unward share wave clarity aegis drain oracle prayer',
  katana: 'draw mine fold riposte haze dash steel void lifecut leaves first',
  fist: 'palm onetwo willow knee breath hail farstrike throw wolves eightfold empty',
  whip: 'trip sweep bind disarm snatch serpent thorn sparks coil net twilight',
};
for (const w of WTYPES) IDS[w] = IDS[w].split(' ').map((s) => `t_${w}_${s}`);
const ALL_IDS = WTYPES.flatMap((w) => IDS[w]);

// §6.0 0.2 — glim.lv sequence of every weapon type.
const LV_SEQ = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// §6.4.1 — WP range per lv (index = lv).
const WP_RANGE = [null, [1, 2], [2, 3], [2, 4], [3, 4], [3, 5], [4, 6], [5, 7], [6, 8], [10, 11], [12, 14]];

// §6.1.3 — starter techs (id, fixed name).
const STARTERS = {
  sword: ['t_sword_stepcut', '踏み込み斬り'], greatsword: ['t_greatsword_overhead', '大上段'],
  dagger: ['t_dagger_vital', '急所ねらい'], axe: ['t_axe_cleave', 'たたき割り'],
  spear: ['t_spear_upthrust', '突き上げ'], bow: ['t_bow_rapid', '速射'], club: ['t_club_smash', '強打'],
  staff: ['t_staff_mind', '念じ打ち'], katana: ['t_katana_draw', '抜き打ち'], fist: ['t_fist_palm', '掌打'],
  whip: ['t_whip_trip', '足からめ'],
};

// §6.3.4 — techs usable from the middle row, for the weapon types that do not reach.
const REACH_TRUE = {
  sword: ['t_sword_bladewind'], greatsword: ['t_greatsword_quake'], dagger: ['t_dagger_knives'],
  axe: ['t_axe_throw', 't_axe_rage', 't_axe_storm'], club: [], katana: ['t_katana_void'],
  fist: ['t_fist_breath', 't_fist_farstrike'],
  // spear / bow / whip / staff: all 11
};

// §6.0 0.13 — noAuto techs.
const NO_AUTO = ['t_dagger_filch', 't_whip_snatch', 't_staff_share'];

// §6.2.1 — top-level fields of a tech.
const TOP_REQUIRED = ['kind', 'wtype', 'name', 'desc', 'wp', 'target', 'reach', 'effects', 'fx', 'rank', 'glim'];
const TOP_OPTIONAL = ['quick', 'magic', 'noAuto'];
const TOP_FORBIDDEN = ['mp', 'field', 'msg', 'element', 'elements'];
const TARGETS = ['enemy', 'enemies', 'group', 'random', 'ally', 'allies', 'self'];
const ENEMY_SIDE = ['enemy', 'enemies', 'group', 'random'];
const MULTI = ['enemies', 'group', 'random'];

// §6.2.2 / §6.2.3 — effect fields per type.
const EFFECT_FIELDS = {
  damage: ['formula', 'power', 'hits', 'kind', 'element', 'critBonus', 'acc', 'sure', 'ignoreDef', 'metalHit', 'drain', 'hpCost', 'vs'],
  status: ['status', 'chance', 'power', 'parry', 'critBonus'], // power/parry/critBonus only with status:'counter'
  buff: ['stat', 'stages', 'chance'],
  cover: ['mul'],
  heal: ['pct'],
  healMp: ['pct'],
  cure: ['statuses'],
  steal: [],
  dispel: ['side'],
};

// §3.1.1 shared ids.
const BAD_STATUSES = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind'];
const INCAP = ['sleep', 'paralyze', 'freeze', 'stun'];
const BUFF_STATS = ['atk', 'def', 'mag', 'mdef', 'agi'];
const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const KINDS = ['slash', 'blunt', 'pierce'];
const RACES = ['beast', 'bird', 'insect', 'plant', 'aquatic', 'dragon', 'undead', 'demon', 'spirit', 'construct', 'slime', 'humanoid', 'fairy'];
const FLAGS = ['flying'];

// §6.2.6 — fx ids a tech may use.
const FX = ['slash', 'slash2', 'slash3', 'pierce', 'pierce2', 'pierce3', 'strike', 'strike2', 'strike3', 'claw3',
  'arrow', 'arrow2', 'arrow3', 'lash', 'lash2', 'lash3', 'stance',
  'holy2', 'holy3', 'earth', 'earth2', 'earth3', 'fire2', 'wind2', 'wind3', 'dark3',
  'magic', 'magic2', 'magic3', 'drain', 'silence', 'debuff', 'buff', 'heal', 'heal3', 'mp', 'poison', 'sleep', 'steal'];

// §6.5 — base power per lv (index = lv − 1).
const G_PHYS = [1.5, 1.7, 1.9, 2.1, 2.25, 2.4, 2.6, 2.8, 3.0, 3.2];
const G_MAG_ONE = [1.17, 1.44, 1.8, 2.03, 2.25, 2.52, 2.79, 3.06, 3.33, 3.6];
const G_MAG_ALL = [null, 0.9, 0.99, 1.13, 1.26, 1.4, 1.53, 1.67, 1.8, 1.94];
// §6.5 — standard crit rate of the weapon type (base 3% + §4.3.4 type bonus).
const C0 = { katana: 0.13, dagger: 0.13, axe: 0.07, bow: 0.07, fist: 0.08 };
const c0 = (w) => C0[w] != null ? C0[w] : 0.05;
// §6.5 — pass band of the ratio.
const RATIO_BAND = (lv) => lv >= 9 ? [0.85, 1.15] : [0.85, 1.12];

const damageOf = (t) => (t.effects || []).find((e) => e.type === 'damage') || null;

/**
 * §6.5: V / G(lv) — the tech's strength converted to "single-target one-hit" terms,
 * divided by the base power of its lv. Returns null for techs without damage.
 * Also returns the factor breakdown (for check_techs --why).
 */
function ratio(t, weaponTypes) {
  const d = damageOf(t);
  if (!d) return null;
  const lv = t.glim.lv;
  const magic = d.formula === 'magic';
  const hits = d.hits || 1;
  const parts = [];
  let V = d.power * hits;
  parts.push(`P${d.power}${hits > 1 ? '×' + hits : ''}`);
  const f = (mul, why) => { V *= mul; parts.push(`${why}×${mul.toFixed(3)}`); };
  let G;
  if (magic) G = (t.target === 'enemies' ? G_MAG_ALL : G_MAG_ONE)[lv - 1];
  else G = G_PHYS[lv - 1];
  if (!magic) {
    if (t.target === 'group') f(1 / 0.65, 'group');
    else if (t.target === 'enemies') f(1 / 0.55, 'all');
  }
  if (t.target === 'random') f(1 / 1.1, 'random');
  else if (hits > 1) f(1 / 1.05, 'multi');
  for (const e of t.effects) {
    if (e === d) continue;
    if (e.type === 'status' && e.status !== 'counter') {
      const strong = e.status === 'death' || (INCAP.includes(e.status) && e.chance >= 0.5);
      f(1 / (strong ? 0.8 : 0.85), e.status);
    } else if (e.type === 'buff' && e.stages < 0) f(1 / 0.85, e.stat + e.stages);
    else if (e.type === 'dispel') f(1 / 0.85, 'dispel');
    else if (e.type === 'steal') f(1 / 0.5, 'steal');
  }
  if (d.ignoreDef) f(1.5 / (1 + 0.5 * (1 - d.ignoreDef)), 'ignoreDef');
  if (d.critBonus) {
    const b = d.critBonus / 100, c = c0(t.wtype);
    f((1 + 1.24 * (c + b)) / (1 + 1.24 * c), 'crit');
  }
  if (d.sure) f(100 / 92, 'sure');
  else if (d.acc != null) f((97 * d.acc - 5) / 92, 'acc');
  if (t.quick) f(1 / 0.9, 'quick');
  const wt = weaponTypes && weaponTypes[t.wtype];
  if (t.reach && !magic && wt && wt.reach === false) f(1 / 0.85, 'reach');
  if (d.metalHit) f(1 / 0.7, 'metal');
  if (d.drain) f(1 / (1 - 0.3 * d.drain), 'drain');
  if (d.hpCost) f(1 / (1 + 2 * d.hpCost), 'hpCost');
  if (d.vs) {
    const m = Math.max(...Object.values(d.vs));
    f(1 / (m >= 2 ? 0.9 : 0.95), 'vs');
  }
  return { ratio: V / G, V, G, parts };
}

// §1.7 — width in full-width units (half-width = 0.5).
function width(s) {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    n += (c >= 0x20 && c <= 0x7e) || (c >= 0xff61 && c <= 0xff9f) ? 0.5 : 1;
  }
  return n;
}

// STYLE_JA §7.1 (partial match) and §7.2 (exact match) name lists, and §2 allowed non-joyo kanji.
function styleLists() {
  const txt = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
  const section = (head) => {
    const i = txt.indexOf(head);
    if (i < 0) throw new Error('STYLE_JA.md: section not found: ' + head);
    const j = txt.indexOf('\n### ', i + head.length);
    return txt.slice(i, j < 0 ? undefined : j);
  };
  const words = (s) => [...s.matchAll(/`([^`]+)`/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  const partial = [];
  for (const line of section('### 7.1').split('\n')) if (/^- .+: `/.test(line)) partial.push(...words(line));
  const exact = [];
  for (const line of section('### 7.2').split('\n')) if (/^`/.test(line)) exact.push(...words(line));
  const allowLine = txt.split('\n').find((l) => l.includes('使ってよい常用外の字'));
  const allowed = new Set([...(allowLine || '').replace(/^.*?:\s*/, '').replace(/（[^）]*）/g, '')].filter((c) => /[㐀-鿿]/.test(c)));
  return { partial, exact, allowed };
}

function joyoSet() {
  const f = path.join(ROOT, 'tools', 'lib', 'joyo.txt');
  if (!fs.existsSync(f)) return null;
  return new Set([...fs.readFileSync(f, 'utf8').trim()]);
}

/** techs of the registry in registration order */
function techList(R) {
  return Object.entries(R.DB.actions).filter(([, a]) => a && a.kind === 'tech').map(([id, a]) => Object.assign({ id }, a));
}

/** §6.7.1 classification of one tech */
function classify(t) {
  const d = damageOf(t);
  const riders = t.effects.some((e) => (e.type === 'status' && e.status !== 'counter') || (e.type === 'buff' && e.stages < 0) || e.type === 'dispel');
  return {
    single: !!d && t.target === 'enemy',
    multi: !!d && MULTI.includes(t.target),
    riders,
    support: !d,
    reach: t.reach === true,
  };
}

/**
 * Load the engine core + only this area's files into a fresh sandbox (no other
 * owner's file can break it). Returns R.
 */
function loadIsolated() {
  const vm = require('vm');
  const noop = () => {};
  const sandbox = { console: { log: noop, warn: noop, error: console.error, info: noop }, Math, JSON, Date, Promise, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  // same order as tools/lib/load.js / build.js: core first, then src/data/ by file name
  const data = ['weapontypes.js', ...WTYPES.map((w) => `techs_${w}.js`)].sort((a, b) => a.localeCompare(b));
  const files = [path.join(ROOT, 'src', 'core', 'ns.js'), ...data.map((f) => path.join(ROOT, 'src', 'data', f))];
  const errors = [];
  for (const f of files) {
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
    catch (e) { errors.push(path.relative(ROOT, f) + ': ' + (e.message || e)); }
  }
  const R = sandbox.RPG;
  if (R && R.runDataHooks) R.runDataHooks();
  R._isolatedErrors = errors.concat(R.loadErrors || []);
  return R;
}

module.exports = {
  ROOT, WTYPES, WT_EXPECT, IDS, ALL_IDS, LV_SEQ, WP_RANGE, STARTERS, REACH_TRUE, NO_AUTO,
  TOP_REQUIRED, TOP_OPTIONAL, TOP_FORBIDDEN, TARGETS, ENEMY_SIDE, MULTI, EFFECT_FIELDS,
  BAD_STATUSES, INCAP, BUFF_STATS, ELEMENTS, KINDS, RACES, FLAGS, FX,
  G_PHYS, G_MAG_ONE, G_MAG_ALL, C0, c0, RATIO_BAND,
  damageOf, ratio, width, styleLists, joyoSet, techList, classify, loadIsolated,
};
