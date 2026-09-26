#!/usr/bin/env node
// Spec-conformance check for area A7 (techs) after the systems rework: compares the registered data with the text of
// design/build/SYSTEMS_REWORK.md (A19; normative over DESIGN.md §6 until the lead folds it back in, §4.2-4):
//   - every row of the §3.4 tables (id, 元, name, lv, from, MP, ★ blunt, the 変更 column's powers),
//   - the §3.1 weapon-type table (name, hands, back row, kind, desc),
//   - DESIGN.md §6.8's code blocks for everything §3.4 keeps as it was (effects, target, fx, desc, quick, noAuto…),
//     with the rework's changes applied (wp → mp = round(wp × 1.5), the new type / id / lv / from / reach),
//   - the 13 deleted techs are gone and DB.remap.actions sends every old id to a live tech,
// plus DESIGN's other tables (no tech name reused) and the previous game's names (§6.9.3). Exit 1 on any mismatch.
//
//   node tools/check_techs.js            all checks (quiet unless something differs)
//   node tools/check_techs.js --tree     also print the seven trees built from the data
//   node tools/check_techs.js --table    also print a §6.6-style table built from the data
//   node tools/check_techs.js --why <id> print the §6.5 ratio breakdown of one tech
//   node tools/check_techs.js --crest <dir>  previous game's source (default /tmp/claude-0/ref/rpg)
//   node tools/check_techs.js --live     also run R.Glimmer and R.Rules on this data (warnings only)
//   node tools/check_techs.js --battle [--trials n] [-v]
//                                        also use every tech in the real battle engine R.Battle: targets,
//                                        hits, MP, riders, stances, cover, heals, reach/silence, noAuto (warnings only)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const S = require('./fixtures/techs/lib/spec');

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const R = S.loadIsolated();
const DB = R.DB, WT = DB.weaponTypes;
const techs = S.techList(R);
const byId = Object.fromEntries(techs.map((t) => [t.id, t]));
const byName = Object.fromEntries(techs.map((t) => [t.name, t]));
const DESIGN = fs.readFileSync(path.join(S.ROOT, 'DESIGN.md'), 'utf8');
const LINES = DESIGN.split('\n');
const REWORK = fs.readFileSync(S.REWORK, 'utf8');
const RLINES = REWORK.split('\n');

let bad = 0, checked = 0;
const out = [];
function diff(where, msg) { bad++; out.push(`  DIFF ${where}: ${msg}`); }
function same(where, a, b, what) { checked++; if (a !== b) diff(where, `${what}: data ${JSON.stringify(a)} ≠ spec ${JSON.stringify(b)}`); }
function sectionLines(head, lines) {
  lines = lines || LINES;
  const i = lines.findIndex((l) => l.startsWith(head));
  if (i < 0) throw new Error('heading not found: ' + head);
  const lvl = head.match(/^#+/)[0].length;
  let j = i + 1;
  while (j < lines.length && !(lines[j].startsWith('#') && lines[j].match(/^#+/)[0].length <= lvl)) j++;
  return lines.slice(i + 1, j);
}
const cells = (l) => l.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
const unbt = (s) => s.replace(/`/g, '').trim();
const clone = (o) => JSON.parse(JSON.stringify(o));
/** JSON with sorted keys (the rework adds / moves fields, the order of keys is not the spec) */
const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));

// ------------------------------------------------------------------ effect text
const ST_NAME = { poison: '毒', burn: 'やけど', sleep: '眠り', paralyze: 'まひ', freeze: '凍結', stun: '気絶', confuse: '混乱', silence: '沈黙', blind: '暗闇', death: '即死' };
const STAT_NAME = { atk: '攻撃力', def: '守備力', mag: '術力', mdef: '術防', agi: '素早さ' };
const EL_NAME = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
const KIND_NAME = { slash: '斬', blunt: '打', pierce: '突' };
const RACE_NAME = { beast: '獣', bird: '鳥', insect: '虫', plant: '植物', aquatic: '水生', dragon: '竜', undead: '不死', demon: '魔族', spirit: '霊体', construct: '魔造', slime: '軟体', humanoid: '人型', fairy: '妖精', flying: '飛ぶ敵' };
const TARGET_NAME = { enemy: '敵1体', group: 'ひと群れ', enemies: '敵全体', random: 'ランダム', self: '自分', ally: '味方1人', allies: '味方全員', ally_other: 'ほかの味方1人' };
const pct = (x) => `${Math.round(x * 100)}%`;
const n = (x) => String(+x.toFixed(4));
const sign = (s) => (s > 0 ? '+' : '−') + Math.abs(s);

/** the §6.6 table notation of a tech's effects (the 効果 column) */
function effectText(t) {
  const parts = [];
  for (const e of t.effects) {
    let s = '';
    if (e.type === 'damage') {
      s = (e.formula === 'magic' ? '術 ' : '物理 ') + n(e.power) + (e.hits ? `×${e.hits}回` : '');
      const q = [];
      if (e.kind) q.push(KIND_NAME[e.kind]);
      if (e.element) q.push(EL_NAME[e.element]);
      if (e.critBonus) q.push(`会心+${e.critBonus}`);
      if (e.acc != null) q.push(`命中×${n(e.acc)}`);
      if (e.sure) q.push('必中');
      if (e.ignoreDef) q.push(`守備${pct(e.ignoreDef)}無視`);
      if (e.metalHit) q.push('鋼に効く');
      if (e.hpCost) q.push(`HP${pct(e.hpCost)}消費`);
      if (e.vs) {
        const ks = Object.keys(e.vs);
        if (ks.every((k) => ST_NAME[k]) && new Set(Object.values(e.vs)).size === 1) q.push(ks.map((k) => ST_NAME[k]).join('・') + `の敵×${n(e.vs[ks[0]])}`);
        else q.push(ks.map((k) => `${RACE_NAME[k] || k}×${n(e.vs[k])}`).join(' '));
      }
      if (e.drain) q.push(`吸収${pct(e.drain)}`);
      if (q.length) s += `（${q.join('・')}）`;
    } else if (e.type === 'status' && e.status === 'counter') {
      const q = [`反撃 ${n(e.power)}`];
      if (e.parry) q.push(`受け流し ${pct(e.parry)}`);
      if (e.critBonus) q.push(`会心+${e.critBonus}`);
      s = `反撃の構え（${q.join('・')}）`;
    } else if (e.type === 'status') s = `${ST_NAME[e.status]} ${pct(e.chance)}`;
    else if (e.type === 'buff') s = `${STAT_NAME[e.stat]} ${sign(e.stages)}` + (e.chance != null && e.chance < 1 ? `（${pct(e.chance)}）` : '');
    else if (e.type === 'cover') s = `かばう（受けるダメージ×${n(e.mul)}）`;
    else if (e.type === 'heal') s = `HP ${pct(e.pct)} 回復`;
    else if (e.type === 'healMp') s = `MP ${pct(e.pct)} 回復`;
    else if (e.type === 'cure') s = `治療（${e.statuses.map((x) => ST_NAME[x]).join('・')}）`;
    else if (e.type === 'steal') s = '盗む';
    else if (e.type === 'dispel') s = '強化を消す';
    parts.push(s);
  }
  const tags = [];
  if (t.quick) tags.push('先制');
  if (t.magic) tags.push('術扱い');
  if (t.noAuto) tags.push('オート×');
  return parts.join('＋') + (tags.length ? `［${tags.join('・')}］` : '');
}


// ------------------------------------------------------------------ 1. SYSTEMS_REWORK §3.4 rows (+ the 変更 column)
const ROWS = {};   // id → the §3.4 row {id, old, name, lv, from, mp, blunt, change}
{
  for (const l of sectionLines('### 3.4', RLINES)) {
    if (!/^\| t_/.test(l)) continue;
    const c = cells(l);
    const id = c[0].replace(/[★\s]/g, '');
    ROWS[id] = Object.assign({}, S.SPEC_BY_ID[id], { change: c[6] || '' });
  }
  same('§3.4', Object.keys(ROWS).length, 108, 'rows in the §3.4 tables');
  same('§3.4', techs.length, 108, 'techs registered');
  for (const w of S.WTYPES) same(`§3.4 ${w}`, techs.filter((t) => t.wtype === w).map((t) => t.id).join(' '), S.IDS[w].join(' '), 'id list in table order');
  for (const [id, r] of Object.entries(ROWS)) {
    const t = byId[id];
    if (!t) { diff(`§3.4 ${id}`, 'missing from src/data'); continue; }
    same(`§3.4 ${id}`, t.name, r.name, 'name' + (S.RENAMED[id] ? ' (renamed by TECHS: STYLE_JA §7 / enemy action clash)' : ''));
    same(`§3.4 ${id}`, t.glim.lv, r.lv, 'lv');
    same(`§3.4 ${id}`, t.rank, r.lv, 'rank');
    same(`§3.4 ${id}`, JSON.stringify(t.glim.from), JSON.stringify(r.from), 'from');
    same(`§3.4 ${id}`, t.mp, r.mp, 'MP');
    same(`§3.4 ${id}`, 'wp' in t, false, 'no wp field (A18)');
    if (r.blunt) same(`§3.4 ${id}`, (S.damageOf(t) || {}).kind, 'blunt', '★ damage kind');
    const w = t.wtype;
    if (['spear', 'bow', 'staff'].includes(w)) same(`§3.4 ${id}`, t.reach, true, `${w} techs reach:true`);
    if (w === 'staff') same(`§3.4 ${id}`, t.magic, true, 'staff techs magic:true');
    if (/^t_whip_/.test(r.old) && w === 'dagger') same(`§3.4 ${id}`, t.reach, false, 'a whip tech on the dagger is reach:false');
    // the 変更 column: 「威力 a→b」 / 「威力 b」 / 「敵全体 a→b」 / 「0.47×5 → 0.5×5」 / 「random 0.72×4」 / 「magic 2.0」
    const d = S.damageOf(t);
    const pw = r.change.match(/(?:威力|敵全体|magic|random)\s*(?:[\d.]+\s*(?:×\d+)?\s*→\s*)?([\d.]+)(?:×(\d+))?/) || r.change.match(/[\d.]+×(\d+)\s*→\s*([\d.]+)×(\d+)/);
    if (pw && d) {
      const m2 = r.change.match(/[\d.]+×\d+\s*→\s*([\d.]+)×(\d+)/);
      const want = m2 ? +m2[1] : +pw[1];
      same(`§3.4 ${id}`, d.power, want, `power (変更: ${r.change})`);
      if (m2) same(`§3.4 ${id}`, d.hits, +m2[2], 'hits');
    }
    if (/kind slash/.test(r.change) && d) same(`§3.4 ${id}`, d.kind || WT[w].kind, 'slash', 'kind (変更)');
    if (/element:'fire'/.test(r.change) && d) same(`§3.4 ${id}`, d.element, 'fire', 'element (変更)');
    if (/target `ally_other`/.test(r.change)) same(`§3.4 ${id}`, t.target, 'ally_other', 'target (変更)');
    if (/healMp 0\.10/.test(r.change)) same(`§3.4 ${id}`, (t.effects.find((e) => e.type === 'healMp') || {}).pct, 0.1, 'healMp (変更)');
  }
  // §3.4: the 13 deleted techs are gone; DB.remap.actions (remap_a19.js) sends every old id to a live tech
  const del = (REWORK.match(/\*\*消す技（13）とセーブの置き換え先\*\*: (.+)/) || [])[1] || '';
  const pairs = [...del.matchAll(/(t_\w+)→(t_\w+)/g)].map((m) => [m[1], m[2]]);
  same('§3.4 deleted', pairs.length, 13, 'deleted techs listed');
  const remapActions = (() => {
    const box = { console: { log() {}, warn() {}, error() {} } };
    box.window = box; vm.createContext(box);
    vm.runInContext(fs.readFileSync(path.join(S.ROOT, 'src', 'core', 'ns.js'), 'utf8'), box);
    vm.runInContext(fs.readFileSync(path.join(S.ROOT, 'src', 'data', 'remap_a19.js'), 'utf8'), box);
    return ((box.RPG.DB.remap || {}).actions) || {};
  })();
  for (const [from, to] of pairs) {
    same(`§3.4 deleted ${from}`, !!DB.actions[from], false, 'deleted');
    same(`§3.4 deleted ${from}`, remapActions[from], to, 'save remap');
  }
  for (const [id, r] of Object.entries(ROWS)) if (r.old !== id) same(`§3.4 moved ${r.old}`, remapActions[r.old], id, 'save remap');
  const dead = Object.entries(remapActions).filter(([, to]) => !byId[to]).map(([a, b]) => `${a}→${b}`);
  checked++;
  if (dead.length) diff('remap_a19', 'actions remapped to techs that do not exist: ' + dead.join(' '));
}

// ------------------------------------------------------------------ 2. DESIGN §6.8 code blocks, with the rework applied
{
  const lines = sectionLines('### 6.8 ');
  const blocks = [];
  let cur = null;
  for (const l of lines) {
    if (l.startsWith('```js')) { cur = []; continue; }
    if (l.startsWith('```') && cur) { blocks.push(cur.join('\n')); cur = null; continue; }
    if (cur) cur.push(l);
  }
  const box = { console: { log() {}, warn() {}, error() {} } };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(S.ROOT, 'src', 'core', 'ns.js'), 'utf8'), box);
  for (const b of blocks) vm.runInContext(b, box);
  const OLD = box.RPG.DB.actions;
  let strict = 0, moved = 0;
  for (const [id, r] of Object.entries(ROWS)) {
    const t = DB.actions[id], o = OLD[r.old];
    if (!t) continue;
    if (!o) { diff(`§6.8 ${r.old}`, `the old definition of ${id} is not in DESIGN §6.8`); continue; }
    const exp = clone(o);
    delete exp.wp;
    Object.assign(exp, { wtype: t.wtype, name: r.name, mp: r.mp, rank: r.lv, glim: { lv: r.lv, from: r.from } });
    if (['spear', 'bow', 'staff'].includes(t.wtype)) exp.reach = true;
    if (/^t_whip_/.test(r.old) && t.wtype === 'dagger') exp.reach = false;
    if (t.wtype === 'staff') exp.magic = true;
    if (r.old === id && !r.change) {
      // kept as it was: the whole definition = DESIGN §6.8 with wp → mp
      strict++;
      same(`§6.8 ${id}`, canon(t), canon(exp), 'definition (kept; wp → mp)');
    } else {
      // moved or changed: the fields §3.4 does not touch still follow the old tech
      moved++;
      for (const k of ['target', 'quick', 'noAuto']) if (!(k === 'target' && /ally_other|self|§2\.5/.test(r.change))) same(`§6.8 ${id} ← ${r.old}`, JSON.stringify(t[k]), JSON.stringify(exp[k]), k);
      if (!/→|威力|敵全体|magic|random|desc|self|heal|§2\.5/.test(r.change)) same(`§6.8 ${id} ← ${r.old}`, t.effects.length, exp.effects.length, 'effect count');
    }
  }
  out.push(`  ok   §6.8: ${strict} kept techs compared whole with DESIGN (wp → mp), ${moved} moved / changed techs compared field by field`);
}

// ------------------------------------------------------------------ 3. §3.1 weapon types, §3.4 starters
{
  for (const l of sectionLines('### 3.1', RLINES)) {
    const c = cells(l);
    if (c.length < 11 || !S.WTYPES.includes(c[0])) continue;
    const w = c[0], t = WT[w] || {};
    same(`§3.1 ${w}`, t.name, c[1], 'name');
    same(`§3.1 ${w}`, !!t.twoHanded, c[2] === '両手', 'twoHanded');
    same(`§3.1 ${w}`, !!t.reach, /○/.test(c[3]), 'reach (back row)');
    same(`§3.1 ${w}`, t.kind, c[4], 'kind');
    same(`§3.1 ${w}`, t.order, S.WTYPES.indexOf(w), 'order');
    // desc: the §3.1 text, or its first sentences when it would not fit the 20-wide line of autoDesc (TECHS, phase 1)
    checked++;
    if (!(t.desc === c[10] || (c[10].startsWith(t.desc) && S.width(c[10]) > 20))) diff(`§3.1 ${w}`, `desc ${JSON.stringify(t.desc)} ≠ ${JSON.stringify(c[10])}`);
    same(`§3.1 ${w}`, S.width(t.desc) <= 20, true, 'desc fits one line of 20');
  }
  same('§3.1', Object.keys(WT).join(' '), S.WTYPES.join(' '), 'weaponTypes (fist is not a type)');
  for (const w of S.WTYPES) { const [id, name] = S.STARTERS[w]; same(`§3.4 starter ${w}`, byId[id] && byId[id].name, name, 'starter'); same(`§3.4 starter ${w}`, byId[id] && byId[id].glim.lv, 1, 'starter lv'); }
}

function buildTree(w) {
  const list = techs.filter((t) => t.wtype === w);
  const kids = (pid) => list.filter((t) => t.glim.from[0] === pid);
  const lines = ['攻撃'];
  const rec = (pid, prefix) => {
    const ks = kids(pid);
    ks.forEach((t, i) => {
      const last = i === ks.length - 1;
      const extra = t.glim.from[1] ? '　＋' + byId[t.glim.from[1]].name : '';
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${t.name}（${t.glim.lv}）${extra}`);
      rec(t.id, prefix + (last ? '   ' : '│  '));
    });
  };
  rec('attack', '');
  return lines.join('\n');
}

// ------------------------------------------------------------------ 6b. names of every other id in DESIGN's tables
// (spells §7.6, enemy actions §9, items §8, monsters §9…: §6.9.1-3 and validate V3 — no display name is shared)
{
  const s6 = LINES.findIndex((l) => l.startsWith('## 6. '));
  const s7 = LINES.findIndex((l) => l.startsWith('## 7. '));
  let rows = 0;
  const hits = [];
  LINES.forEach((l, i) => {
    if (i >= s6 && i < s7) return; // this chapter's own tables
    const m = l.match(/^\|\s*`([a-z][a-z0-9_]*)`\s*\|\s*([^|]+?)\s*\|/);
    if (!m) return;
    rows++;
    const nm = m[2].replace(/\*\*/g, '').replace(/（.*$/, '').trim();
    if (byName[nm]) hits.push(`line ${i + 1}: ${m[1]}「${nm}」 = ${byName[nm].id}`);
  });
  checked++;
  if (hits.length) diff('names', 'a tech name is used by another id in DESIGN.md: ' + hits.join(', '));
  else out.push(`  ok   no tech name appears as the name of another id in DESIGN.md's tables (${rows} rows outside §6)`);
}

// ------------------------------------------------------------------ 7. previous game's names (§6.9.3)
{
  const dir = arg('--crest') || '/tmp/claude-0/ref/rpg';
  const loader = path.join(dir, 'tools', 'lib', 'load.js');
  if (fs.existsSync(loader)) {
    const C = require(loader)({ quiet: true });
    const crestNames = new Set(Object.values(C.DB.abilities || {}).map((a) => a.name).concat(Object.values(C.DB.actions || {}).map((a) => a.name)));
    // names SYSTEMS_REWORK §3.4 itself gives (the lead's call, reported in the phase-2 notes): 毒矢
    const SPEC_NAMED = ['t_bow_venom'];
    const hit = techs.filter((t) => crestNames.has(t.name) && !SPEC_NAMED.includes(t.id)).map((t) => `${t.id}「${t.name}」`);
    const specHit = techs.filter((t) => crestNames.has(t.name) && SPEC_NAMED.includes(t.id)).map((t) => `${t.id}「${t.name}」`);
    if (specHit.length) out.push(`  NOTE §6.9.3: a name §3.4 gives is also a Crest tech/action (lead to confirm): ${specHit.join(', ')}`);
    checked++;
    if (hit.length) diff('§6.9.3', 'same name as a Crest tech/action: ' + hit.join(', '));
    else out.push(`  ok   no tech shares a name with the ${crestNames.size} Crest techs/actions (${dir})`);
    const itemNames = new Set(Object.values(C.DB.items || {}).map((a) => a.name));
    const ih = techs.filter((t) => itemNames.has(t.name)).map((t) => `${t.name}`);
    if (ih.length) out.push(`  info tech names that were Crest item names (allowed; not in this game's items): ${ih.join(' ')}`);
  } else out.push(`  info Crest reference not found at ${dir} (git -C /home/user/others archive 8259156 rpg | tar -x -C /tmp/claude-0/ref)`);
}

// ------------------------------------------------------------------ 8. --live: other areas' code on this data
// (warnings only: these modules belong to spells A8 / rules A1 and may be mid-rewrite)
let liveWarn = 0;
if (argv.includes('--live')) {
  const F = require('./lib/load')({ quiet: true });
  const L = (ok, msg) => { if (ok) out.push('  live ok   ' + msg); else { liveWarn++; out.push('  live WARN ' + msg); } };
  const comp = Object.keys(F.DB.companions || {})[0] || 'probe';
  const mk = (w, pts, techsKnown) => ({ id: comp, name: 'probe', techs: techsKnown || [], spells: [], wprof: { [w]: pts }, eprof: {}, equip: {}, lv: 50, hp: 1, mp: 1, status: {} });
  const G = F.Glimmer;
  const K = (F.Rules && F.Rules.K) || {};
  if (!G || !G.candidates || !K.PROF_PTS || !K.TECH_PROF) L(false, 'R.Glimmer.candidates / K.PROF_PTS / K.TECH_PROF not available');
  else {
    const PTS = K.PROF_PTS, TP = K.TECH_PROF;
    for (const w of S.WTYPES) {
      const list = techs.filter((t) => t.wtype === w);
      const ctx = (o) => Object.assign({ kind: 'tech', wtype: w, used: 'attack', rankB: 10, ef: 1, tier: 9, row: 'front', silenced: false }, o);
      const ids = (c, o) => { try { return G.candidates(c, ctx(o)).map((x) => x.id); } catch (e) { return ['ERROR ' + e.message]; } };
      const all = ids(mk(w, PTS[TP[10]]));
      L(all.length === list.length, `${w}: rankB 10 + weapon rank ${TP[10]} → all ${list.length} techs are candidates (${all.length})`);
      L(ids(mk(w, PTS[TP[10] - 1])).length === list.length - 1, `${w}: weapon rank ${TP[10] - 1} → 極意 excluded (TECH_PROF[10] = ${TP[10]})`);
      L(JSON.stringify(ids(mk(w, 0), { rankB: 1 })) === JSON.stringify(list.filter((t) => t.glim.lv === 1).map((t) => t.id)), `${w}: rankB 1 + rank 1 → the two lv 1 techs`);
      for (let lv = 2; lv <= 9; lv++) {
        const n0 = ids(mk(w, PTS[TP[lv] - 1] || 0)).filter((id) => byId[id].glim.lv === lv).length, n1 = ids(mk(w, PTS[TP[lv]])).filter((id) => byId[id].glim.lv === lv).length;
        L(n0 === 0 && n1 === list.filter((t) => t.glim.lv === lv).length, `${w}: lv ${lv} opens at weapon rank ${TP[lv]} (A17 TECH_PROF)`);
      }
      L(ids(mk(w, PTS[TP[10]]), { row: 'middle' }).length === list.filter((t) => t.reach).length, `${w}: middle row → only reach:true techs (§6.4.4-1)`);
      L(ids(mk(w, PTS[TP[10]]), { silenced: true }).length === list.filter((t) => !t.magic).length, `${w}: silenced → magic:true techs excluded (§6.4.4-2)`);
      const sec = list.find((t) => t.glim.lv === 10), ou = list.find((t) => t.glim.lv === 9);
      let bs = ['?', '?'];
      try { bs = [G.banner(F.DB.actions[ou.id]).title, G.banner(F.DB.actions[sec.id]).title]; } catch (e) { /* ignore */ }
      L(bs[0] === '奥義' && bs[1] === '極意', `${w}: banner lv 9 「奥義」, lv 10 「極意」 (${bs.join('/')})`);
    }
  }
  const RU = F.Rules;
  if (!RU || !RU.techList) L(false, 'R.Rules.techList not available');
  else {
    for (const w of S.WTYPES) {
      const list = techs.filter((t) => t.wtype === w).map((t) => t.id);
      const c = mk(w, 0, list.slice().reverse());
      let got = [];
      try { got = RU.techList(c, w); } catch (e) { got = ['ERROR ' + e.message]; }
      L(JSON.stringify(got) === JSON.stringify(list), `${w}: R.Rules.techList lists known techs in §3.4 order`);
      try {
        const bad2 = list.filter((id) => RU.mpCost(c, id) !== F.DB.actions[id].mp);
        L(bad2.length === 0 && typeof RU.wpCost !== 'function', `${w}: R.Rules.mpCost = mp with no techCostPct; no wpCost (A18) ${bad2.join(' ')}`);
      } catch (e) { L(false, `${w}: R.Rules.mpCost threw ${e.message}`); }
      try {
        const info = RU.wtypeInfo(w);
        L(info.reach === WT[w].reach && info.twoHanded === WT[w].twoHanded && info.kind === WT[w].kind, `${w}: R.Rules.wtypeInfo agrees with DB.weaponTypes`);
      } catch (e) { L(false, `${w}: R.Rules.wtypeInfo threw ${e.message}`); }
    }
  }
}

// ------------------------------------------------------------------ 9. --battle: every tech through the real battle engine
// (warnings only: R.Battle is A2's and may be mid-rewrite; tools/fixtures/techs/lib/battle_probe.js says what is checked)
let battleWarn = 0;
if (argv.includes('--battle')) {
  const F = require('./lib/load')({ quiet: true });
  const P = require('./fixtures/techs/lib/battle_probe');
  let r;
  try { r = P.run(F, S, { trials: +(arg('--trials') || 24) }); } catch (e) { r = { skipped: 'probe threw: ' + (e.stack || e).split('\n').slice(0, 3).join(' '), results: [] }; }
  if (r.skipped) { battleWarn++; out.push('  battle WARN ' + r.skipped); }
  else {
    const bad = r.results.filter((x) => !x.ok);
    battleWarn += bad.length;
    for (const x of r.results) if (!x.ok || argv.includes('-v')) out.push(`  battle ${x.ok ? 'ok  ' : 'WARN'} ${x.id}: ${x.msg}`);
    out.push(`  battle: ${r.results.length - bad.length}/${r.results.length} probes ok over ${r.techs} techs (weapons ${r.cast.weapons.map((s) => s.split(':')[1]).join(' ')}; monsters ${r.cast.base}, ${r.cast.other})`);
  }
}

// ------------------------------------------------------------------ output
if (argv.includes('--tree')) for (const w of S.WTYPES) console.log(`\n${WT[w].name} ${w}\n` + buildTree(w));
if (argv.includes('--table')) {
  for (const w of S.WTYPES) {
    console.log(`\n${WT[w].name} ${w}`);
    for (const t of techs.filter((x) => x.wtype === w)) {
      const r = S.ratio(t, WT);
      console.log(`${String(t.glim.lv).padStart(2)} ${t.id.padEnd(24)} ${t.name}\tM${t.mp}\t${TARGET_NAME[t.target]}\t${t.reach ? '○' : '×'}\t${effectText(t)}\t${r ? r.ratio.toFixed(2) : '—'}`);
    }
  }
}
const why = arg('--why');
if (why) {
  const t = byId[why];
  if (!t) console.log(`no tech ${why}`);
  else { const r = S.ratio(t, WT); console.log(`${why} 「${t.name}」 lv${t.glim.lv}: ` + (r ? `${r.parts.join(' ')} = V ${r.V.toFixed(3)} / G ${r.G} = ${r.ratio.toFixed(3)}` : 'no damage (MP range only)')); }
}
console.log(out.join('\n'));
console.log(`check_techs: ${checked} comparisons with SYSTEMS_REWORK §3.1 / §3.4 and DESIGN.md §6, ${bad} difference(s)` + (argv.includes('--live') ? `; live probes: ${liveWarn} warning(s)` : '') +
  (argv.includes('--battle') ? `; battle probes: ${battleWarn} warning(s)` : ''));
process.exitCode = bad ? 1 : 0; // (not process.exit: it can cut off piped output)
