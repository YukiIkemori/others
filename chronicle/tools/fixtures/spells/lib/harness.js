// A8 (spells) の node 用の土台: tools/test_spells.js・tools/sim_glimmer.js・tools/sim_spells.js・tools/check_spells.js が使う。
//
//   const H = require('./fixtures/spells/lib/harness')({ rules: 'auto' | 'shim' | 'real' });
//   H.R        … tools/lib/load で読んだゲーム（R.Glimmer・R.DB は本物）
//   H.info     … { specData: [足した DESIGN のデータ], rules: 'real' | 'shim' }
//   H.makeChar({ id, heroType?, favor?, level?, techs?, spells?, wprof?, eprof?, row?, add?, mods?, wm? })
//
// 並列の作業中は、他の担当のデータ（技 121・仲間・主人公のタイプ・武器系統）や新しい R.Rules がまだ無いことがある。
//  - データが無いときは、DESIGN.md の「そのまま置ける形」のコード（§5.2.10・§5.3.9・§6.8.1・§6.8.2）をこの sandbox にだけ読み込む。
//  - R.Rules に新しい API（K.GLIM・profRank・aptitude・train・stats）が無いときは、§4 の式の最小の写し（shim）を入れる。
// どちらを使ったかは H.info に残し、シミュレーターは出力の先頭に書く。src のファイルは変えない。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function designBlocks(fromHeading, toHeading) {
  const L = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8').split('\n');
  const a = L.findIndex((l) => l.startsWith(fromHeading));
  if (a < 0) return [];
  let b = L.findIndex((l, i) => i > a && l.startsWith(toHeading));
  if (b < 0) b = L.length;
  const out = [];
  let cur = null;
  for (let i = a + 1; i < b; i++) {
    const l = L[i];
    if (cur === null && /^```js\s*$/.test(l)) { cur = []; continue; }
    if (cur !== null && /^```\s*$/.test(l)) { out.push(cur.join('\n')); cur = null; continue; }
    if (cur !== null) cur.push(l);
  }
  return out;
}

function evalBlocks(R, blocks) {
  for (const code of blocks) new Function('window', code)({ RPG: R });
}

function ensureData(R, info) {
  const DB = R.DB;
  const techCount = () => Object.keys(DB.actions).filter((k) => DB.actions[k] && DB.actions[k].kind === 'tech').length;
  if (!Object.keys(DB.weaponTypes).length) { evalBlocks(R, designBlocks('#### 6.8.1', '#### 6.8.2')); info.specData.push('weaponTypes(§6.8.1)'); }
  if (techCount() < 108) {   // A19: 108 techs (SYSTEMS_REWORK §3.4)
    const have = techCount();
    const before = new Set(Object.keys(DB.actions));
    const tmp = { DB: { actions: {} } };
    evalBlocks(tmp, designBlocks('#### 6.8.2', '### 6.9'));
    let added = 0;
    for (const k in tmp.DB.actions) if (!before.has(k)) { DB.actions[k] = tmp.DB.actions[k]; added++; }
    info.specData.push(`techs(§6.8.2: +${added}, had ${have})`);
  }
  if (!Object.keys(DB.heroTypes).length) { evalBlocks(R, designBlocks('#### 5.2.10', '### 5.3')); info.specData.push('heroTypes(§5.2.10)'); }
  if (Object.keys(DB.companions).length < 20) { evalBlocks(R, designBlocks('#### 5.3.9', '### 5.4')); info.specData.push('companions(§5.3.9)'); }
}

// ---------------------------------------------------------------- §4 の最小の写し（新しい rules.js が入るまで）
function makeShim(R) {
  const U = R.U, DB = R.DB;
  const G = R.Glimmer.SPEC;
  const K = {
    GLIM: JSON.parse(JSON.stringify(G.GLIM)),
    PROF_PTS: G.PROF_PTS.slice(),
    PEXP: [25, 186, 311, 445, 585, 730, 880, 1034, 1191, 1352],   // A17
    PROF_CAP: 2490,
    MODCAP: { party: 150, preempt: 30, exp: 30, expMin: -100, glim: 40, prof: 50, cost: -50, encounter: 50 },
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112],
    U: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6],
    LZ: (T) => 6 + 6 * T, DK: (L) => 40 + 5 * L,
    HP: { a: 17.5, b: 14.7, p: 0.9 }, MP: { a: 8, b: 2.6, p: 0.85, cap: 250 },
    GROW: { hp: { S: 1.25, A: 1.12, B: 1, C: 0.9, D: 0.8 }, mp: { S: 1.3, A: 1.15, B: 1, C: 0.8, D: 0.6 } },
    STAGE: [0.63, 0.77, 1, 1.3, 1.6],
    AFTER: { mpPct: 0.12 },
  };
  const def = (c) => (c.id === 'hero' || c.heroType) ? DB.heroTypes[c.heroType] : DB.companions[c.id];
  const Rules = {
    _shim: true, K,
    ELEMENTS: ['fire', 'water', 'wind', 'earth', 'light', 'dark'],
    WTYPES: ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'],   // SYSTEMS_REWORK §3.1
    profRank(pts) { let r = 0; for (let i = 0; i < K.PROF_PTS.length; i++) if ((pts || 0) >= K.PROF_PTS[i]) r = i; return r; },
    aptitude(c) {
      const d = def(c) || {}, apt = K.GLIM.apt, w = {}, e = {};
      for (const k in (d.apt && d.apt.w) || {}) w[k] = apt[d.apt.w[k]];
      for (const k in (d.apt && d.apt.e) || {}) e[k] = apt[d.apt.e[k]];
      if (c.favor && c.favor.kind === 'weapon') w[c.favor.id] = apt.S;
      if (c.favor && c.favor.kind === 'element') {
        e[c.favor.id] = apt.S;
        const pair = DB.starterKit && DB.starterKit.pair && DB.starterKit.pair[c.favor.id];
        if (d.pairElement && pair) e[pair] = Math.max(e[pair] || 0, apt.A);
      }
      return { w, e };
    },
    aptLetter(c, kind, id) {
      const d = def(c) || {};
      if (c.favor && c.favor.id === id) return 'S';
      return (d.apt && d.apt[kind] && d.apt[kind][id]) || 'C';
    },
    baseStats(c) { return Object.assign({}, (def(c) || {}).stats || {}); },
    mods(c) { return c._mods || {}; },
    maxAt(c, key, L) {
      const d = def(c) || {}, g = (d.growth && d.growth[key]) || 'B', k = K[key.toUpperCase()];
      const base = k.a + k.b * Math.pow(Math.max(0, L - 1), k.p);
      const vit = key === 'hp' ? (160 + Rules.stat(c, 'vit')) / 200 : 1;
      const cap = key === 'hp' ? 999 : 250;
      const m = Rules.mods(c);
      return Math.min(cap, Math.round(base * K.GROW[key][g] * vit) * (1 + (m[key + 'Pct'] || 0) / 100) + ((c.bonus && c.bonus[key]) || 0));
    },
    stat(c, k) { const b = Rules.baseStats(c); return (b[k] || 0) + ((c._add && c._add[k]) || 0); },
    stats(c) {
      const s = {};
      for (const k of ['str', 'vit', 'dex', 'agi', 'int', 'mnd']) s[k] = Rules.stat(c, k);
      const m = Rules.mods(c);
      s.mag = Math.round(((c._wm != null ? c._wm : 4) + (m.mag || 0)) * (64 + s.int) / 64);
      s.hp = Rules.maxAt(c, 'hp', c.level || 1); s.mp = Rules.maxAt(c, 'mp', c.level || 1);
      s.mods = m;
      return s;
    },
    prof(c, kind, id) { return ((kind === 'w' ? c.wprof : c.eprof) || {})[id] || 0; },
    addProf(c, kind, id, pts, opts) {
      const bag = kind === 'w' ? (c.wprof = c.wprof || {}) : (c.eprof = c.eprof || {});
      const m = Rules.mods(c);
      const T = opts && opts.tier != null ? opts.tier : (R.Game ? (R.Game.gameClear ? 9 : R.Game.tier || 0) : 0);
      const cur = bag[id] || 0;
      let add = pts * (1 + Math.min(K.MODCAP.prof, ((m.profPct || {})[id] || 0)) / 100);
      if (cur < K.PEXP[U.clamp(T, 0, 9)]) add *= 2;
      const before = Rules.profRank(cur);
      bag[id] = Math.min(K.PROF_CAP, cur + add);
      const rank = Rules.profRank(bag[id]);
      return { rank, up: rank > before };
    },
    train(c, info) {
      const out = [];
      if (!info) return out;
      const o = { tier: info.tier };
      if (info.stone) {
        for (const e of info.elements || []) { const r = Rules.addProf(c, 'e', e, 1, o); if (r.up) out.push({ kind: 'e', id: e, rank: r.rank }); }
        return out;
      }
      if ((info.kind === 'attack' || info.kind === 'tech') && info.wtype) {
        const a = info.actionId && DB.actions[info.actionId];
        const pts = a && a.kind === 'tech' && a.glim && a.glim.lv >= 6 ? 2 : 1;
        const r = Rules.addProf(c, 'w', info.wtype, pts, o);
        if (r.up) out.push({ kind: 'w', id: info.wtype, rank: r.rank });
      } else if (info.kind === 'spell' && info.elements) {
        const a = info.actionId && DB.actions[info.actionId];
        let pts = 1;
        if (a && a.kind === 'spell') pts = a.elements.length === 3 ? 3 : a.elements.length === 2 ? 2 : (a.step >= 3 ? 2 : 1);
        for (const e of info.elements) {
          const r = Rules.addProf(c, 'e', e, pts, o);
          if (r.up) out.push({ kind: 'e', id: e, rank: r.rank });
        }
      }
      return out;
    },
  };
  return Rules;
}

function rulesReady(R) {
  const Ru = R.Rules;
  return !!(Ru && Ru.K && Ru.K.GLIM && Ru.K.PEXP && typeof Ru.profRank === 'function' && typeof Ru.aptitude === 'function' &&
    typeof Ru.train === 'function' && typeof Ru.stats === 'function' && typeof Ru.addProf === 'function');
}

module.exports = function harness(opts) {
  opts = opts || {};
  const R = require(path.join(ROOT, 'tools', 'lib', 'load'))({ quiet: true, extra: opts.extra || [] });
  const info = { specData: [], rules: 'real', loadErrors: (R._nodeLoadErrors || []).length };
  if (!R.Glimmer) throw new Error('R.Glimmer がありません（src/systems/glimmer.js の読み込みに失敗）');
  ensureData(R, info);
  const want = opts.rules || 'auto';
  if (want === 'shim' || (want === 'auto' && !rulesReady(R))) {
    R.Rules = makeShim(R);
    info.rules = 'shim';
  } else if (want === 'real' && !rulesReady(R)) {
    throw new Error('新しい R.Rules（K.GLIM・profRank・aptitude・train・stats・addProf）がまだありません');
  } else {
    // 本物の rules のときも、シミュレーターの仮の装備（c._add = 能力値の足し算、c._mods = 補正、c._wm = 術力の元）を重ねる。
    // （装備品のデータがそろっていなくても Z/N/S の術師などを作れるように。c に _add などが無ければ本物のまま）
    const Ru = R.Rules, stats0 = Ru.stats.bind(Ru), mods0 = Ru.mods.bind(Ru);
    Ru.mods = function (c) {
      const m = mods0(c);
      if (!c || !c._mods) return m;
      const out = Object.assign({}, m);
      for (const k in c._mods) {
        const v = c._mods[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = Object.assign({}, out[k] || {}, v);
        else out[k] = v;
      }
      return out;
    };
    Ru.stats = function (c) {
      const s = stats0(c);
      if (!c || (!c._add && c._wm == null && !c._mods)) return s;
      const o = Object.assign({}, s);
      for (const k in c._add || {}) o[k] = (o[k] || 0) + c._add[k];
      if (c._add && c._add.int || c._wm != null || c._mods) {
        const m = Ru.mods(c);
        const wm = c._wm != null ? c._wm : 4;
        o.mag = Math.round((wm + (m.mag || 0)) * (64 + o.int) / 64);
      }
      o.mods = Ru.mods(c);
      return o;
    };
    info.rules = 'real+overlay';
  }
  R.Glimmer.reindex();
  R.Game = R.Game || null;

  const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const WT = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];   // SYSTEMS_REWORK §3.1
  const EQ = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];

  /** §3.2.2 の CharState を作る（装備は空。能力値の足し算は add、術力の元は wm、補正は mods）。startProf は §5.0 の 0.6 */
  function makeChar(o) {
    const d = o.heroType ? R.DB.heroTypes[o.heroType] : R.DB.companions[o.id];
    if (!d) throw new Error('unknown char ' + (o.heroType || o.id));
    const c = {
      id: o.heroType ? 'hero' : o.id, name: o.name || (d && d.name) || o.id, gender: d.gender || 'm',
      level: o.level || 1, exp: 0, hp: 1, mp: 1, bonus: { hp: 0, mp: 0 }, status: {},
      equip: {}, wprof: {}, eprof: {}, techs: (o.techs || []).slice(), spells: (o.spells || []).slice(),
      row: o.row || d.row || 'front', mem: { cmd: 0, list: {}, item: 0, target: null }, joined: { tier: 0, frame: 0 },
      counts: { battles: 0, kills: 0, glimmers: 0 },
    };
    if (o.heroType) { c.heroType = o.heroType; c.favor = o.favor || { kind: 'weapon', id: 'sword' }; }
    for (const s of EQ) c.equip[s] = (o.equip && o.equip[s]) || null;
    const apt = R.Rules.aptitude(c);
    const letter = (v) => { const t = R.Glimmer.SPEC.GLIM.apt; for (const k in t) if (t[k] === v) return k; return 'C'; };
    const prof = (R.DB.starterKit && R.DB.starterKit.prof) || { S: 25, A: 11 };
    for (const w of WT) c.wprof[w] = (o.wprof && o.wprof[w] != null) ? o.wprof[w] : (prof[letter(apt.w[w])] || 0);
    for (const e of EL) c.eprof[e] = (o.eprof && o.eprof[e] != null) ? o.eprof[e] : (prof[letter(apt.e[e])] || 0);
    if (o.add) c._add = o.add;
    if (o.mods) c._mods = o.mods;
    if (o.wm != null) c._wm = o.wm;
    return c;
  }
  /** シミュレーター専用の仮の仲間（DB.companions に sandbox の中だけで登録） */
  function defineSimChar(id, base, over) {
    const b = R.DB.companions[base];
    R.DB.companions[id] = Object.assign(JSON.parse(JSON.stringify(b)), over || {});
    return id;
  }
  return { R, info, EL, WT, makeChar, defineSimChar, designBlocks, ROOT };
};
