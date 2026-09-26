#!/usr/bin/env node
// gear-a (A10a) — spec conformance of the armor / accessory data against DESIGN.md.
//
//   node tools/check_gear-a.js            → compares R.DB.items with the DESIGN tables, exit 1 on mismatch
//   node tools/check_gear-a.js --dump     → prints the parsed spec rows as JSON (for review)
//   const C = require('./check_gear-a');  → { spec(), conformance(R) }   (used by tools/test_gear.js)
//
// The tables read here are the normative item definitions of DESIGN §8 and §9.12:
//   §8.4.2 armor names / def,mdef   §8.4.3 ability accessories   §8.3.8 prices   §8.4.4 support accessories
//   §8.5 band rares   §8.6.5 hand-made supers (+ their monsters)   §8.7.1 relics   §8.7.2 fixed-tier supers
//   §8.8 story rewards   §9.12.4 monster supers   §9.12.5 monster rares   §9.5.1 lineage races
// Monster-chapter items (§9.12.4 / §9.12.5) are rebuilt from the shorthand with the rules of §8.6.2 / §9.12.2
// (units from the race of the first monster, stat quirks in units U(T), desc checked for shape only).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DESIGN = path.join(ROOT, 'DESIGN.md');

// ------------------------------------------------------------------ vocab
const STAT_JA = { 腕力: 'str', 体力: 'vit', 器用さ: 'dex', 素早さ: 'agi', 知力: 'int', 精神: 'mnd' };
const STAT_UNIT = { str: 's', vit: 'v', dex: 'd', agi: 'a', int: 'i', mnd: 'm' };
const TYPE_JA = { 体: 'body', 頭: 'head', 盾: 'shield', 手: 'hands', 足: 'feet', アクセ: 'acc' };
const WEIGHT_JA = { 重装: 'heavy', 軽装: 'light', 布: 'cloth' };
const RACE_JA = { 獣: 'beast', 鳥: 'bird', 虫: 'insect', 植物: 'plant', 水生: 'aquatic', 竜: 'dragon', 不死: 'undead',
  魔族: 'demon', 霊体: 'spirit', 魔造: 'construct', 軟体: 'slime', 人型: 'humanoid', 妖精: 'fairy' };
// §8.6.2: main / sub stat of a race
const RACE_STATS = { beast: ['str', 'agi'], bird: ['agi', 'dex'], insect: ['dex', 'agi'], plant: ['mnd', 'vit'], aquatic: ['vit', 'mnd'],
  dragon: ['str', 'vit'], undead: ['int', 'mnd'], demon: ['int', 'str'], spirit: ['mnd', 'int'], construct: ['vit', 'str'],
  slime: ['vit', 'mnd'], humanoid: ['dex', 'str'], fairy: ['int', 'mnd'] };
const WEIGHT_STATS = { heavy: ['str', 'vit'], light: ['dex', 'agi'], cloth: ['int', 'mnd'] };
const U = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
const GM = { normal: 1, rare: 2, super: 3 };
const gearStat = (T, u, g) => Math.max(1, Math.round(u * U[T])) * GM[g || 'normal'];

// ------------------------------------------------------------------ markdown helpers
function lines() { return fs.readFileSync(DESIGN, 'utf8').split('\n'); }
/** rows of every markdown table between the heading that starts with `head` and the next heading of the same or higher level */
function section(L, head, untilRe) {
  const i0 = L.findIndex((l) => l.startsWith(head));
  if (i0 < 0) throw new Error('DESIGN heading not found: ' + head);
  const lvl = head.match(/^#+/)[0].length;
  const out = [];
  for (let i = i0 + 1; i < L.length; i++) {
    const m = L[i].match(/^(#+) /);
    if (m && m[1].length <= lvl) break;
    if (untilRe && untilRe.test(L[i])) break;
    out.push(L[i]);
  }
  return out;
}
function rows(sec) {
  return sec.filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l))
    .map((l) => l.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()));
}
const bt = (s) => [...String(s).matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const lit = (src) => Function('"use strict"; return ({' + src + '});')();       // spec JS fragments like  elemResist:{fire:0}
function mergeInto(dst, src) {
  for (const [k, v] of Object.entries(src)) {
    if (Array.isArray(v)) dst[k] = [...(dst[k] || []), ...v.filter((x) => !(dst[k] || []).includes(x))];
    else if (v && typeof v === 'object') dst[k] = Object.assign({}, dst[k] || {}, v);
    else dst[k] = v;
  }
  return dst;
}
const litAll = (cell) => bt(cell).reduce((o, s) => mergeInto(o, lit(s)), {});
const desc = (s) => s.replace(/<br>/g, '\n').replace(/／/g, '\n');
/** "腕力+6" / "腕力+4 体力+4" → {str:6} */
function statCell(cell) {
  const o = {};
  for (const m of String(cell).matchAll(/(腕力|体力|器用さ|素早さ|知力|精神)\+(\d+)/g)) o[STAT_JA[m[1]]] = +m[2];
  return o;
}
/** "体・重装" → {type:'body', weight:'heavy'}; "アクセ" → {type:'acc'} */
function kindCell(cell) {
  const [t, w] = String(cell).split('・');
  const type = TYPE_JA[t];
  if (!type) return null;
  return w ? { type, weight: WEIGHT_JA[w.replace(/\s.*$/, '')] } : { type };
}
/** unit string from shown stats (e.g. {int:30} at T8 super, body → 'i2') */
function unitsFrom(stats, T, grade) {
  let s = '';
  for (const [k, v] of Object.entries(stats)) {
    let n = 0;
    for (const u of [1, 2]) if (gearStat(T, u, grade) === v) { n = u; break; }
    if (!n) throw new Error(`no unit count for ${k}+${v} at T${T} ${grade}`);
    s += STAT_UNIT[k] + n;
  }
  return s;
}

// ------------------------------------------------------------------ §9.12.2 shorthand → item fields
const EL = { fire: 1, water: 1, wind: 1, earth: 1, light: 1, dark: 1 };
/**
 * Parse "sres:paralyze60 hit+8" (effects) and "res:fire1.5 stat:agi-1u" (quirk) into
 * { mods, statsAdd, def, mdef } for an item of tier T / type / weight (halving needs the normal value).
 */
function shorthand(fxStr, qStr, T, ctx) {
  const mods = {}; const item = {};
  const put = (k, v) => mergeInto(mods, { [k]: v });
  const one = (tok, quirk) => {
    let m;
    if (!tok) return;
    if ((m = tok.match(/^res:([a-z]+)(-?[\d.]+)$/))) return put('elemResist', { [m[1]]: +m[2] });
    if ((m = tok.match(/^boost:([a-z]+)(\d+)$/))) return put('elemBoost', { [m[1]]: +m[2] });
    if ((m = tok.match(/^imm:([a-z]+)$/))) return put('statusImmune', [m[1]]);
    if ((m = tok.match(/^sres:([a-z]+)(\d+)$/))) return put('statusResist', { [m[1]]: +m[2] / 100 });
    if ((m = tok.match(/^glim:([a-z]+)(\d+)$/))) return put('glimPct', { [m[1]]: +m[2] });
    if ((m = tok.match(/^prof:([a-z]+)(\d+)$/))) return put('profPct', { [m[1]]: +m[2] });
    if ((m = tok.match(/^buff:([a-z]+)\+(\d)$/))) return put('startBuffs', { [m[1]]: +m[2] });
    if ((m = tok.match(/^stat:([a-z]+)-(\d)u$/))) { item.statsAdd = Object.assign(item.statsAdd || {}, { [m[1]]: -gearStat(T, +m[2], 'normal') }); return; }
    if ((m = tok.match(/^(def|mdef)-50%$/))) { item[m[1]] = Math.round(ctx.normal(m[1]) / 2); return; }
    if (tok === 'defHalf') { item.def = Math.round(ctx.normal('def') / 2); return; }
    if (tok === 'regen' || tok === 'noFloorDamage') return put(tok, true);
    if ((m = tok.match(/^([a-zA-Z]+)([+-]\d+)$/))) return put(m[1], +m[2]);
    throw new Error('unknown shorthand token: ' + tok + (quirk ? ' (quirk)' : ''));
  };
  for (const t of fxStr.split(/\s+/)) one(t, false);
  for (const t of (qStr || '').split(/\s+/)) one(t, true);
  return { mods, ...item };
}

// STYLE_JA is the rule for every in-game string (§3: 兜, not かぶと). Two §9.12.5 names are written the STYLE way
// in the data; the expected table applies the same renames (reported to the lead to fix DESIGN §9.12.5).
const STYLE_RENAMES = { hd_sentry_helm: ['番兵のかぶと', '番兵の兜'], hd_blackgold_helm: ['黒金のかぶと', '黒金の兜'] };

// Lead decisions that are binding but not yet written into the DESIGN tables (tools/fixtures/gear-a/lead_overlay.json):
//   d3      LEAD_DECISIONS D3 (BRIEF Part A「レア装備は…クセもある」): every rare ★ armor / accessory — band rares (§8.5),
//           monster rares (§9.12.5), rare relics (§8.7.1) and story rewards (§8.8) — carries exactly one weak §8.3.6 quirk.
//           Each row adds the quirk's mods (merged into the spec mods), sets quirk:true and gives the new desc
//           (「効果の文 → ただし〜」; absent for monster-chapter rows, whose desc the spec does not fix).
//   wording BRIEF A1.3 / A10a.1 and STYLE_JA §8: the on-screen word is 「アイテム」, not 「品」 (§8.2.7 wrote 品を落としやすい).
// `node tools/check_gear-a.js --overlay` prints the rows to fold into DESIGN; once DESIGN has them the overlay is a no-op.
const OVERLAY_FILE = path.join(__dirname, 'fixtures', 'gear-a', 'lead_overlay.json');
function overlay() { return fs.existsSync(OVERLAY_FILE) ? JSON.parse(fs.readFileSync(OVERLAY_FILE, 'utf8')) : { d3: {}, wording: {} }; }

// ------------------------------------------------------------------ the spec
let cached = null;
function spec() {
  if (cached) return cached;
  const L = lines();
  const S = { armorLines: [], accLines: [], defTable: {}, priceTable: {}, support: [], band: [], hand: [], handMon: {},
    relic: [], fixed: [], reward: [], mSuper: [], mRare: [], lineageRace: {}, lineageStages: {} };

  // §9.5.1 lineages → race (first word), stage start tiers
  for (const r of rows(section(L, '#### 9.5.1'))) {
    const id = bt(r[0])[0];
    if (!id) continue;
    const raceJa = r[3].split('・')[0];
    S.lineageRace[id] = RACE_JA[raceJa];
    const st = r[4].match(/\[([\d,]+)\]/);
    if (st) S.lineageStages[id] = st[1].split(',').map(Number);
  }
  // §9.11.4 bosses → race (the two post-game bosses drop monster rares)
  S.bossRace = {};
  for (const r of rows(section(L, '#### 9.11.4'))) {
    const id = bt(r[0])[0];
    if (id && id.startsWith('b_') && RACE_JA[r[5]]) S.bossRace[id] = RACE_JA[r[5]];
  }

  // §8.4.2 def/mdef table and names
  const s842 = section(L, '#### 8.4.2');
  const cols = [];
  for (const t of ['body', 'head', 'shield', 'hands', 'feet']) for (const w of ['heavy', 'light', 'cloth']) cols.push([t, w]);
  for (const r of rows(s842)) {
    if (/^\d$/.test(r[0]) && r.length === 16) {
      const T = +r[0];
      r.slice(1).forEach((c, i) => { const [d, m] = c.split('/').map(Number); S.defTable[`${cols[i][0]}.${cols[i][1]}.${T}`] = { def: d, mdef: m }; });
    } else if (/^`[a-z]+_[a-z]+_<T>`/.test(r[0])) {
      const line = r[0].match(/`([a-z_]+)_<T>`/)[1];
      const t0 = (r[0].match(/T0 = `([a-z_]+)`/) || [])[1] || null;
      const stat = STAT_JA[r[3].replace(/×\d/, '')];
      const n = +r[3].match(/×(\d)/)[1];
      S.armorLines.push({ line, type: TYPE_JA[r[1]], weight: WEIGHT_JA[r[2]], units: STAT_UNIT[stat] + n, t0, names: r.slice(4, 14) });
    }
  }
  // §8.4.3 ability accessories
  for (const r of rows(section(L, '#### 8.4.3'))) {
    const m = r[0].match(/^`(ac_[a-z]+)_<T>`$/);
    if (m) S.accLines.push({ line: m[1], type: 'acc', units: STAT_UNIT[STAT_JA[r[1]]] + '1', t0: null, names: r.slice(2, 12) });
  }
  // §8.3.8 price table (T | 体 頭 盾 手 足 アクセ)
  const s838 = section(L, '#### 8.3.8');
  for (const r of rows(s838)) if (/^\d$/.test(r[0]) && r.length === 7) {
    const [body, head, shield, hands, feet, acc] = r.slice(1).map(Number);
    S.priceTable[+r[0]] = { body, head, shield, hands, feet, acc };
  }
  // §8.4.4 support accessories
  for (const r of rows(section(L, '#### 8.4.4'))) {
    const id = bt(r[0])[0];
    if (!id || !id.startsWith('ac_')) continue;
    S.support.push({ id, name: r[1], tier: +r[2], price: +r[3], mods: litAll(r[4]), desc: desc(r[5]) });
  }
  // §8.5 band rares (armor + accessories only)
  const s85 = section(L, '### 8.5');
  for (const r of rows(s85)) {
    const id = bt(r[0])[0];
    if (!id || !/^(bd|hd|sh|hn|ft|ac)_r\d_/.test(id)) continue;
    const k = kindCell(r[2]);
    const T = +r[3];
    const stats = statCell(r[5]);
    const fx = litAll(r[6]), q = r[7] === '—' ? {} : litAll(r[7]);
    S.band.push({ id, name: r[1], ...k, tier: T, stats, units: unitsFrom(stats, T, 'rare'), fx, q, price: +r[8], desc: desc(r[9]) });
  }
  // §8.6.5 hand-made supers + assignment
  const s865 = section(L, '#### 8.6.5');
  for (const l of s865) for (const m of l.matchAll(/`((?:bd|hd|sh|hn|ft|ac|w_[a-z]+)_sr_[a-z_]+)` → `([a-z_0-9]+)`/g)) S.handMon[m[1]] = m[2];
  for (const r of rows(s865)) {
    const id = bt(r[0])[0];
    if (!id || !/^(bd|hd|sh|hn|ft|ac)_sr_/.test(id) || r.length < 10) continue;
    const k = kindCell(r[2]);
    const T = +r[3];
    const stats = statCell(r[5]);
    const fx = litAll(r[6]);
    const qAll = litAll(r[7]);
    const item = {};
    for (const key of ['def', 'mdef', 'statsAdd']) if (key in qAll) { item[key] = qAll[key]; delete qAll[key]; }
    S.hand.push({ id, name: r[1], ...k, tier: T, stats, units: unitsFrom(stats, T, 'super'), fx, q: qAll, item,
      price: +r[8], desc: desc(r[9]), exclusive: S.handMon[id] });
  }
  // §8.7.1 relics
  for (const r of rows(section(L, '#### 8.7.1'))) {
    const mon = bt(r[0])[0];
    if (!mon || !mon.startsWith('rm_')) continue;
    const [dr, ds] = r[7].split('‖').map((s) => desc(s.trim()));
    const rl = r[2].match(/`(ac_rl_[a-z]+)`\s*(\S+)/);
    S.relic.push({ id: rl[1], name: rl[2], grade: 'rare', mods: litAll(r[3]), q: {}, desc: dr, exclusive: mon, key: r[1].replace(/`/g, '') });
    const rs = r[4].match(/`(ac_rs_[a-z]+)`\s*(\S+)/);
    if (rs) S.relic.push({ id: rs[1], name: rs[2], grade: 'super', mods: litAll(r[5]), q: litAll(r[6]), desc: ds, exclusive: mon, key: r[1].replace(/`/g, '') });
  }
  // §8.7.2 fixed-tier supers (armor / acc only)
  for (const r of rows(section(L, '#### 8.7.2'))) {
    const mon = bt(r[0])[0];
    const id = bt(r[1])[0];
    if (!mon || !id || !/^(sh|hd|bd|hn|ft|ac)_/.test(id)) continue;
    const k = kindCell(r[3]);
    const T = +r[4];
    const units = bt(r[6])[0];
    const qAll = litAll(r[8]);
    const item = {};
    for (const key of ['def', 'mdef', 'statsAdd']) if (key in qAll) { item[key] = qAll[key]; delete qAll[key]; }
    S.fixed.push({ id, name: r[2], ...k, tier: T, units, stats: statCell(r[6]), fx: litAll(r[7]), q: qAll, item, price: +r[9], desc: desc(r[10]), exclusive: mon });
  }
  // §8.8 rewards
  for (const r of rows(section(L, '### 8.8'))) {
    const ev = bt(r[0])[0];
    const id = bt(r[1])[0];
    if (!ev || !id) continue;
    const k = kindCell(r[3].split(/\s/)[0]);
    const row = { id, name: r[2], ...k, event: ev, mods: litAll(r[6]), desc: desc(r[7]) };
    if (k.type !== 'acc') { row.weight = WEIGHT_JA[r[3].split('・')[1].split(/\s/)[0]]; row.tier = +r[4]; row.stats = statCell(r[5]); row.units = unitsFrom(row.stats, row.tier, 'rare'); }
    S.reward.push(row);
  }
  // §9.12.4 monster supers (non-§8.6.5 rows, armor + accessories)
  for (const r of rows(section(L, '#### 9.12.4'))) {
    const mon = bt(r[0])[0], id = bt(r[1])[0];
    if (!mon || !id || !/^(bd|hd|sh|hn|ft|ac)_sr_/.test(id) || r[3].includes('8.6.5')) continue;
    const k = kindCell(r[3]);
    const [fx, q] = r[6].split('｜').map((s) => s.trim());
    S.mSuper.push({ id, name: r[2], ...k, tier: +r[4], rate: r[5], fxStr: fx, qStr: q.replace(/^Q:\s*/, ''), exclusive: mon });
  }
  // §9.12.5 monster rares (armor + accessories)
  for (const r of rows(section(L, '#### 9.12.5'))) {
    const id = bt(r[0])[0];
    if (!id || !/^(bd|hd|sh|hn|ft|ac)_/.test(id)) continue;
    let name = r[1];
    if (STYLE_RENAMES[id] && STYLE_RENAMES[id][0] === name) name = STYLE_RENAMES[id][1];
    S.mRare.push({ id, name, ...kindCell(r[2]), tier: +r[3], fxStr: r[4], mons: bt(r[5]) });
  }
  cached = S;
  return S;
}

// §8.6.2 units of a monster-chapter item. `lowered` = the stats a `stat:<s>-Nu` quirk lowers: a unit on that very stat
// would cancel the quirk (腕力+9 −3 = +6 under 「ただし腕力が下がる」), so it is skipped like a stat that does not fit the
// weight (main → sub → the weight's first stat). Two §9.12.4 accessories hit this (ac_sr_rattle_charm, ac_sr_lullaby_quill).
function monsterUnits(S, monId, type, weight, lowered) {
  const lin = monId.replace(/_\d+$/, '');
  const race = S.bossRace[monId] || S.lineageRace[lin];
  if (!race) throw new Error('no race for monster ' + monId);
  const [main, sub] = RACE_STATS[race];
  const n = type === 'body' ? 2 : 1;
  const ok = type === 'acc' ? ['str', 'vit', 'dex', 'agi', 'int', 'mnd'] : WEIGHT_STATS[weight];
  const fits = (st) => ok.includes(st) && !(lowered || []).includes(st);
  const st = fits(main) ? main : fits(sub) ? sub : ok.find(fits);
  return STAT_UNIT[st] + n;
}

// §8.6.1 srTier / band from lineage stage tiers
function srTier(S, monId) {
  const lin = monId.replace(/_\d+$/, '');
  const st = S.lineageStages[lin];
  const k = +monId.match(/_(\d+)$/)[1] - 1;
  if (!st) return null;
  if (st[k] === 9) return 9;
  if (k === st.length - 1) return 8;
  return Math.max(st[k], st[k + 1] - 1);
}
const band = (t) => (t === 9 ? 9 : t === 8 ? 7 : t % 2 ? t : t - 1);

// ------------------------------------------------------------------ expected items (the whole gear-a set)
/** normal def/mdef of a tier × type × weight, from the §8.4.2 table */
function normalDef(S, type, weight, T) { return S.defTable[`${type}.${weight}.${T}`]; }

function expected() {
  const S = spec();
  const X = {};
  const add = (id, o) => { if (X[id]) throw new Error('duplicate expected id ' + id); X[id] = o; };
  for (const ln of [...S.armorLines, ...S.accLines]) {
    ln.names.forEach((name, T) => add(T === 0 && ln.t0 ? ln.t0 : `${ln.line}_${T}`,
      { name, type: ln.type, weight: ln.weight, grade: 'normal', tier: T, units: ln.units, line: ln.line, src: 'shop' }));
  }
  // support accessories: line = 'charm_<kind>' (§8.2.1; the kind is free), tier = the shop tier of §8.4.4
  for (const s of S.support) add(s.id, { name: s.name, type: 'acc', grade: 'normal', tier: s.tier, price: s.price, mods: s.mods, desc: s.desc, src: 'shop', line: /^charm_[a-z]+$/ });
  for (const b of S.band) add(b.id, { name: b.name, type: b.type, weight: b.weight, grade: 'rare', tier: b.tier, units: b.units,
    mods: mergeInto(mergeInto({}, b.fx), b.q), quirk: Object.keys(b.q).length > 0, price: b.price, desc: b.desc, src: 'drop' });
  for (const h of S.hand) add(h.id, { name: h.name, type: h.type, weight: h.weight, grade: 'super', tier: h.tier, units: h.units,
    mods: mergeInto(mergeInto({}, h.fx), h.q), ...h.item, quirk: true, price: h.price, desc: h.desc, src: 'super', exclusive: h.exclusive });
  for (const f of S.fixed) add(f.id, { name: f.name, type: f.type, weight: f.weight, grade: 'super', tier: f.tier, units: f.units,
    mods: mergeInto(mergeInto({}, f.fx), f.q), ...f.item, quirk: true, price: f.price, desc: f.desc, src: 'super', exclusive: f.exclusive });
  for (const r of S.relic) add(r.id, { name: r.name, type: 'acc', grade: r.grade, tier: 0, mods: mergeInto(mergeInto({}, r.mods), r.q),
    quirk: Object.keys(r.q).length > 0, price: r.grade === 'rare' ? 1500 : 3000, desc: r.desc, src: 'relic', exclusive: r.exclusive });
  for (const r of S.reward) {
    const o = { name: r.name, type: r.type, grade: 'rare', tier: r.tier || 0, mods: r.mods, desc: r.desc, src: 'reward', unique: true, price: 0 };
    if (r.units) Object.assign(o, { weight: r.weight, units: r.units });
    add(r.id, o);
  }
  for (const m of S.mSuper) {
    const ctx = { normal: (k) => normalDef(S, m.type, m.weight, m.tier)[k] };
    const p = shorthand(m.fxStr, m.qStr, m.tier, ctx);
    const o = { name: m.name, type: m.type, grade: 'super', tier: m.tier, units: monsterUnits(S, m.exclusive, m.type, m.weight, Object.keys(p.statsAdd || {})),
      mods: p.mods, quirk: true, src: 'super', exclusive: m.exclusive };
    if (m.weight) o.weight = m.weight;
    for (const k of ['statsAdd', 'def', 'mdef']) if (p[k] !== undefined) o[k] = p[k];
    add(m.id, o);
  }
  for (const m of S.mRare) {
    const p = shorthand(m.fxStr, '', m.tier, { normal: () => 0 });
    const o = { name: m.name, type: m.type, grade: 'rare', tier: m.tier, units: monsterUnits(S, m.mons[0], m.type, m.weight), mods: p.mods, src: 'mdrop' };
    if (m.weight) o.weight = m.weight;
    add(m.id, o);
  }
  // lead overlay (D3 quirks, アイテム wording) on top of the DESIGN tables
  const OV = overlay();
  for (const [id, r] of Object.entries(OV.d3 || {})) {
    const x = X[id];
    if (!x) throw new Error('lead_overlay d3: unknown id ' + id);
    if (x.grade !== 'rare') throw new Error('lead_overlay d3: ' + id + ' is not a rare');
    x.mods = mergeInto(mergeInto({}, x.mods || {}), r.mods);
    x.quirk = true;
    if (r.desc !== undefined) x.desc = r.desc;
    x.d3 = r.mods;
  }
  for (const [id, d] of Object.entries(OV.wording || {})) {
    if (!X[id]) throw new Error('lead_overlay wording: unknown id ' + id);
    if (X[id].desc !== undefined) X[id].desc = d;
  }
  // SYSTEMS_REWORK (A18 §2.5 WP → MP / techCostPct, A19 §3.8 the 7 weapon types) on top of DESIGN + d3
  for (const [id, r] of Object.entries(OV.rework || {})) {
    const x = X[id];
    if (!x) throw new Error('lead_overlay rework: unknown id ' + id);
    x.mods = Object.assign({}, x.mods || {});
    for (const k of r.replaceKeys || []) delete x.mods[k];
    for (const [k, v] of Object.entries(r.mods || {})) { if (v === null) delete x.mods[k]; else x.mods[k] = v; }
    if (r.desc !== undefined) x.desc = r.desc;
  }
  for (const id of OV.removed || []) delete X[id];
  return X;
}

// ------------------------------------------------------------------ comparison with the loaded data
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : Array.isArray(x) ? [...x].sort() : x));

/** compare the raw (pre-fill) item definitions with the spec; returns a list of problems */
function conformance(raw, filled) {
  const X = expected();
  const errs = [];
  const mine = Object.keys(raw);
  for (const id of Object.keys(X)) if (!raw[id]) errs.push(`${id}: missing (spec ${X[id].name})`);
  for (const id of mine) if (!X[id]) errs.push(`${id}: not in the spec tables`);
  for (const [id, x] of Object.entries(X)) {
    const it = raw[id]; if (!it) continue;
    for (const k of ['name', 'type', 'weight', 'grade', 'tier', 'units', 'line', 'src', 'exclusive', 'unique', 'statsAdd', 'def', 'mdef']) {
      if (x[k] === undefined && it[k] === undefined) continue;
      if (x[k] instanceof RegExp) { if (!x[k].test(it[k] || '')) errs.push(`${id}.${k}: data ${canon(it[k])} does not match ${x[k]}`); continue; }
      if (canon(x[k]) !== canon(it[k])) errs.push(`${id}.${k}: data ${canon(it[k])} ≠ spec ${canon(x[k])}`);
    }
    if (canon(x.mods || {}) !== canon(it.mods || {})) errs.push(`${id}.mods: data ${canon(it.mods || {})} ≠ spec ${canon(x.mods || {})}`);
    if (!!x.quirk !== !!it.quirk && x.grade !== 'normal') errs.push(`${id}.quirk: data ${!!it.quirk} ≠ spec ${!!x.quirk}`);
    if (x.desc !== undefined && x.desc !== it.desc) errs.push(`${id}.desc: data ${JSON.stringify(it.desc)} ≠ spec ${JSON.stringify(x.desc)}`);
    const f = filled && filled[id];
    if (f && x.price !== undefined && f.price !== x.price) errs.push(`${id}.price: ${f.price} ≠ spec ${x.price}`);
  }
  return errs;
}

module.exports = { STYLE_RENAMES, overlay, spec, expected, conformance, shorthand, monsterUnits, srTier, band, gearStat, U, GM,
  STAT_JA, STAT_UNIT, RACE_STATS, WEIGHT_STATS, mergeInto, canon };

if (require.main === module) {
  if (process.argv.includes('--dump')) { console.log(JSON.stringify(spec(), null, 1)); process.exit(0); }
  if (process.argv.includes('--overlay')) {
    const OV = overlay(), S = spec();
    const where = (id) => (S.band.some((x) => x.id === id) ? '§8.5' : S.relic.some((x) => x.id === id) ? '§8.7.1' : S.reward.some((x) => x.id === id) ? '§8.8'
      : S.mRare.some((x) => x.id === id) ? '§9.12.5' : S.mSuper.some((x) => x.id === id) ? '§9.12.4' : S.support.some((x) => x.id === id) ? '§8.4.4' : '§8.6.5/§8.7.2');
    console.log('D3 quirks to add to the DESIGN rows (クセ column / desc):');
    for (const [id, r] of Object.entries(OV.d3)) console.log(`  ${where(id).padEnd(8)} ${id.padEnd(20)} ${canon(r.mods).padEnd(34)} ${r.desc ? JSON.stringify(r.desc) : '(desc not in the table)'}`);
    console.log('品 → アイテム wording:');
    for (const [id, d] of Object.entries(OV.wording)) console.log(`  ${where(id).padEnd(8)} ${id.padEnd(20)} ${JSON.stringify(d)}`);
    process.exit(0);
  }
  const load = require('./lib/load');
  const R0 = load({ quiet: true, dataHooks: false });
  const R = load({ quiet: true });
  const X = expected();
  const pick = (DB) => Object.fromEntries(Object.keys(DB.items).filter((id) => /^(bd|hd|sh|hn|ft|ac)_/.test(id)).map((id) => [id, DB.items[id]]));
  const raw = JSON.parse(JSON.stringify(pick(R0.DB)));
  const errs = conformance(raw, pick(R.DB));
  console.log(`check_gear-a: ${Object.keys(X).length} spec items, ${Object.keys(raw).length} armor/acc items in DB, ${errs.length} problems`);
  for (const e of errs.slice(0, 80)) console.log('  ' + e);
  if (errs.length > 80) console.log(`  … ${errs.length - 80} more`);
  process.exit(errs.length ? 1 : 0);
}
