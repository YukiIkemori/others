#!/usr/bin/env node
// Spec-conformance check for area A7 (techs): compares the registered data with the
// text of DESIGN.md §6 itself — the §6.8 code blocks, every row of the eleven §6.6
// tables (lv, id, name, WP, target, row, effect text, parents, desc, power ratio),
// the §6.6 trees, §6.1.2 / §6.1.3 / §6.3.4 lists, the §6.4.1 / §6.4.5 per-lv tables, the §6.7
// summary tables, the weapon-type rows of §4.3.4 and §5.2.5 — and with the tech names of the
// previous game (§6.9.3). Exit 1 on any mismatch.
//
//   node tools/check_techs.js            all checks (quiet unless something differs)
//   node tools/check_techs.js --tree     also print the eleven trees built from the data
//   node tools/check_techs.js --table    also print the §6.6-style table built from the data
//   node tools/check_techs.js --why <id> print the §6.5 ratio breakdown of one tech
//   node tools/check_techs.js --crest <dir>  previous game's source (default /tmp/claude-0/ref/rpg)
//   node tools/check_techs.js --live     also run R.Glimmer (A8) and R.Rules (A1) on this data (warnings only)
//   node tools/check_techs.js --battle [--trials n] [-v]
//                                        also use every tech in the real battle engine R.Battle (A2): targets,
//                                        hits, WP, riders, stances, cover, heals, reach/silence, noAuto (warnings only)
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

let bad = 0, checked = 0;
const out = [];
function diff(where, msg) { bad++; out.push(`  DIFF ${where}: ${msg}`); }
function same(where, a, b, what) { checked++; if (a !== b) diff(where, `${what}: data ${JSON.stringify(a)} ≠ spec ${JSON.stringify(b)}`); }
function sectionLines(head) {
  const i = LINES.findIndex((l) => l.startsWith(head));
  if (i < 0) throw new Error('DESIGN.md: heading not found: ' + head);
  const lvl = head.match(/^#+/)[0].length;
  let j = i + 1;
  while (j < LINES.length && !(LINES[j].startsWith('#') && LINES[j].match(/^#+/)[0].length <= lvl)) j++;
  return LINES.slice(i + 1, j);
}
const cells = (l) => l.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
const unbt = (s) => s.replace(/`/g, '').trim();

// ------------------------------------------------------------------ effect text
const ST_NAME = { poison: '毒', burn: 'やけど', sleep: '眠り', paralyze: 'まひ', freeze: '凍結', stun: '気絶', confuse: '混乱', silence: '沈黙', blind: '暗闇', death: '即死' };
const STAT_NAME = { atk: '攻撃力', def: '守備力', mag: '術力', mdef: '術防', agi: '素早さ' };
const EL_NAME = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
const KIND_NAME = { slash: '斬', blunt: '打', pierce: '突' };
const RACE_NAME = { beast: '獣', bird: '鳥', insect: '虫', plant: '植物', aquatic: '水生', dragon: '竜', undead: '不死', demon: '魔族', spirit: '霊体', construct: '魔造', slime: '軟体', humanoid: '人型', fairy: '妖精', flying: '飛ぶ敵' };
const TARGET_NAME = { enemy: '敵1体', group: 'ひと群れ', enemies: '敵全体', random: 'ランダム', self: '自分', ally: '味方1人', allies: '味方全員' };
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

// ------------------------------------------------------------------ 1. §6.8 code blocks
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
  const SPEC = box.RPG.DB;
  checked++;
  if (blocks.length !== 12) diff('§6.8', `expected 12 code blocks, found ${blocks.length}`);
  for (const w of S.WTYPES) same(`§6.8.1 ${w}`, JSON.stringify(WT[w]), JSON.stringify(SPEC.weaponTypes[w]), 'weaponTypes entry');
  const specTechs = Object.keys(SPEC.actions).filter((k) => SPEC.actions[k].kind === 'tech');
  same('§6.8.2', specTechs.length, 121, 'tech count in the code blocks');
  for (const id of specTechs) {
    if (!DB.actions[id]) { diff(`§6.8.2 ${id}`, 'missing from src/data'); continue; }
    same(`§6.8.2 ${id}`, JSON.stringify(DB.actions[id]), JSON.stringify(SPEC.actions[id]), 'definition');
  }
  for (const t of techs) if (!SPEC.actions[t.id]) diff(`§6.8.2 ${t.id}`, 'not in the spec code blocks');
}

// ------------------------------------------------------------------ 2. §6.1.2 ids, §6.1.3 starters
{
  for (const l of sectionLines('#### 6.1.2 ')) {
    const m = l.match(/^- .+? `(\w+)`: (.+)$/);
    if (!m) continue;
    const ids = [...m[2].matchAll(/`(t_\w+)`/g)].map((x) => x[1]);
    same(`§6.1.2 ${m[1]}`, techs.filter((t) => t.wtype === m[1]).map((t) => t.id).join(' '), ids.join(' '), 'id list');
  }
  for (const l of sectionLines('#### 6.1.3 ')) {
    const c = cells(l);
    if (c.length < 4 || !/^`t_/.test(c[1])) continue;
    const id = unbt(c[1]);
    const name = c[2].replace(/\*\*/g, '').replace(/（.*$/, '').trim();
    same(`§6.1.3 ${id}`, byId[id] && byId[id].name, name, 'starter name');
    same(`§6.1.3 ${id}`, byId[id] && byId[id].glim.lv, 1, 'starter lv');
  }
}

// ------------------------------------------------------------------ 3. §6.6 tables and trees
const tableRows = {};
{
  for (let k = 1; k <= 11; k++) {
    const lines = sectionLines(`#### 6.6.${k} `);
    const headLine = LINES.find((l) => l.startsWith(`#### 6.6.${k} `));
    const w = (headLine.match(/`(\w+)`/) || [])[1];
    if (!S.WTYPES.includes(w)) { diff(`§6.6.${k}`, 'weapon type not found in heading'); continue; }
    same(`§6.6.${k}`, S.WTYPES.indexOf(w), k - 1, 'section order = weapon-type order');
    // table
    const rows = lines.filter((l) => /^\| \d+ \| `t_/.test(l)).map(cells);
    tableRows[w] = rows;
    same(`§6.6 ${w}`, rows.length, 11, 'table rows');
    const list = techs.filter((t) => t.wtype === w);
    rows.forEach((c, i) => {
      const [lv, idc, name, wp, target, reach, eff, from, desc, ratio] = c;
      const id = unbt(idc);
      const t = byId[id];
      const at = `§6.6 ${id}`;
      if (!t) { diff(at, 'id not in data'); return; }
      same(at, list[i] && list[i].id, id, 'row order');
      same(at, t.glim.lv, +lv, 'lv');
      same(at, t.name, name, 'name');
      same(at, t.wp, +wp, 'WP');
      same(at, TARGET_NAME[t.target], target, 'target');
      same(at, t.reach ? '○' : '×', reach, 'middle row');
      same(at, effectText(t), eff, 'effect text');
      const parents = from === '攻撃' ? ['attack'] : from.split('、').map((nm) => (byName[nm] || {}).id || '?' + nm);
      same(at, t.glim.from.join(','), parents.join(','), 'glim.from');
      same(at, t.desc, desc, 'desc');
      const r = S.ratio(t, WT);
      same(at, r ? r.ratio.toFixed(2) : '—', ratio === '—' ? '—' : (+ratio).toFixed(2), 'power ratio (§6.5)');
    });
    // tree
    const fence = lines.findIndex((l) => l.startsWith('```'));
    const end = lines.findIndex((l, j) => j > fence && l.startsWith('```'));
    const specTree = lines.slice(fence + 1, end).join('\n');
    same(`§6.6 ${w} tree`, buildTree(w), specTree, 'tree');
  }
}

/** the §6.6 tree of one weapon type from glim.from (first parent = edge, second = "＋") */
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

// ------------------------------------------------------------------ 4. §6.3.4 middle-row table
{
  for (const l of sectionLines('#### 6.3.4 ')) {
    const c = cells(l);
    if (c.length !== 2 || c[0] === '系統' || /^-+$/.test(c[0])) continue;
    const wname = c[0].replace(/（.*$/, '');
    const w = S.WTYPES.find((x) => WT[x].name === wname);
    if (!w) continue;
    const got = techs.filter((t) => t.wtype === w && t.reach);
    if (/すべての技/.test(c[1])) same(`§6.3.4 ${w}`, got.length, 11, 'all techs from the middle row');
    else if (/なし/.test(c[1])) same(`§6.3.4 ${w}`, got.length, 0, 'no middle-row tech');
    else {
      const spec = c[1].split('、').map((x) => { const m = x.match(/^(.+?)（(\d+)）$/); return m ? `${m[1]}(${m[2]})` : x; });
      same(`§6.3.4 ${w}`, got.map((t) => `${t.name}(${t.glim.lv})`).join('、'), spec.join('、'), 'middle-row techs');
    }
  }
}

// ------------------------------------------------------------------ 5. §6.7.1 / §6.7.3 summaries
{
  const ratios = Object.fromEntries(techs.map((t) => [t.id, S.ratio(t, WT)]));
  for (const l of sectionLines('#### 6.7.1 ')) {
    const c = cells(l);
    const w = (c[0].match(/`(\w+)`/) || [])[1];
    if (!w) continue;
    const list = techs.filter((t) => t.wtype === w);
    const cl = list.map(S.classify);
    const rs = list.map((t) => ratios[t.id]).filter(Boolean).map((r) => r.ratio);
    const got = [list.length, cl.filter((x) => x.single).length, cl.filter((x) => x.multi).length, cl.filter((x) => x.riders).length,
      cl.filter((x) => x.support).length, cl.filter((x) => x.reach).length,
      `${Math.min(...list.map((t) => t.wp))}〜${Math.max(...list.map((t) => t.wp))}`, (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(2)];
    same(`§6.7.1 ${w}`, got.join(' | '), c.slice(1).join(' | '), 'summary row');
  }
  const FEAT = {
    気絶: (t) => has(t, 'status', 'stun'), 毒: (t) => has(t, 'status', 'poison'), 眠り: (t) => has(t, 'status', 'sleep'),
    まひ: (t) => has(t, 'status', 'paralyze'), 暗闇: (t) => has(t, 'status', 'blind'), 沈黙: (t) => has(t, 'status', 'silence'),
    混乱: (t) => has(t, 'status', 'confuse'), やけど: (t) => has(t, 'status', 'burn'), 即死: (t) => has(t, 'status', 'death'),
    弱体: (t) => S.ENEMY_SIDE.includes(t.target) && t.effects.some((e) => e.type === 'buff' && e.stages < 0),
    強化を消す: (t) => t.effects.some((e) => e.type === 'dispel'), 守備無視: (t) => !!dmg(t, 'ignoreDef'), '会心+': (t) => !!dmg(t, 'critBonus'),
    必中: (t) => !!dmg(t, 'sure'), 鋼に効く: (t) => !!dmg(t, 'metalHit'), vs: (t) => !!dmg(t, 'vs'), 属性: (t) => !!dmg(t, 'element'),
    HP消費: (t) => !!dmg(t, 'hpCost'), 先制: (t) => !!t.quick, 構え: (t) => has(t, 'status', 'counter'),
    かばう: (t) => t.effects.some((e) => e.type === 'cover'), '回復・MP': (t) => t.effects.some((e) => e.type === 'heal' || e.type === 'healMp'),
    強化: (t) => t.effects.some((e) => e.type === 'buff' && e.stages > 0), 盗む: (t) => t.effects.some((e) => e.type === 'steal'),
    吸収: (t) => !!dmg(t, 'drain'),
  };
  const lines = sectionLines('#### 6.7.3 ');
  const header = cells(lines.find((l) => l.startsWith('| 系統')));
  for (const l of lines) {
    const c = cells(l);
    const w = S.WTYPES.find((x) => WT[x].name === c[0]);
    if (!w) continue;
    const list = techs.filter((t) => t.wtype === w);
    header.slice(1).forEach((h, i) => {
      const f = FEAT[h];
      if (!f) { diff('§6.7.3', `unknown column ${h}`); return; }
      const cnt = list.filter(f).length;
      same(`§6.7.3 ${w} ${h}`, cnt === 0 ? '·' : String(cnt), c[i + 1], 'feature count');
    });
  }
  function has(t, type, status) { return t.effects.some((e) => e.type === type && e.status === status); }
  function dmg(t, k) { const d = S.damageOf(t); return d && d[k]; }
}

// ------------------------------------------------------------------ 6. §6.7.2 per-lv power values
{
  const lines = sectionLines('#### 6.7.2 ');
  for (const l of lines) {
    const c = cells(l);
    if (!/^\d+$/.test(c[0])) continue;
    const lv = +c[0];
    const list = techs.filter((t) => t.glim.lv === lv && S.damageOf(t));
    const phys = list.filter((t) => t.wtype !== 'staff');
    const staff = list.filter((t) => t.wtype === 'staff');
    const d = (t) => S.damageOf(t);
    const tot = (t) => `${n(d(t).power * d(t).hits)}（${d(t).hits}回）`;
    const uniq = (a) => [...new Set(a)];
    const got = [
      uniq(phys.filter((t) => t.target === 'enemy' && !d(t).hits).map((t) => n(d(t).power))),
      uniq(phys.filter((t) => t.target === 'enemy' && d(t).hits).map(tot)),
      uniq(phys.filter((t) => t.target === 'group').map((t) => n(d(t).power))),
      uniq(phys.filter((t) => t.target === 'enemies').map((t) => n(d(t).power))),
      uniq(phys.filter((t) => t.target === 'random').map(tot)),
      uniq(staff.map((t) => n(d(t).power) + (t.target === 'enemies' ? '（全体）' : ''))),
    ];
    const spec = c.slice(1).map((x) => x === '—' ? [] : x.split('、'));
    const names = ['single 1-hit P', 'single multi-hit total', 'group P', 'all P', 'random total', 'staff SP'];
    names.forEach((nm, i) => same(`§6.7.2 lv${lv}`, got[i].slice().sort().join('、'), spec[i].slice().sort().join('、'), nm));
  }
}

// ------------------------------------------------------------------ 6a. §6.4.1 / §6.4.5 per-lv tables, §4.3.4 / §5.2.5 weapon-type tables
{
  const avg = (a) => a.reduce((s, t) => s + t.wp, 0) / a.length;
  const one = (x) => String(+(Math.round(x * 10) / 10).toFixed(1)).replace(/^(\d+)$/, '$1.0');
  const num1 = (s) => String(+s).replace(/^(\d+)$/, '$1.0');
  const range = (s) => s.split('〜').map(Number);
  // §6.4.1: count, base P, staff SP single / all, WP range (rule), actual WP average, rankB, stage
  for (const l of sectionLines('#### 6.4.1 ')) {
    const c = cells(l);
    if (!/^\d+$/.test(c[0])) continue;
    const lv = +c[0];
    const list = techs.filter((t) => t.glim.lv === lv);
    const at = `§6.4.1 lv${lv}`;
    same(at, list.length, +c[1], 'number of techs');
    same(at, S.G_PHYS[lv - 1], +c[2], 'base P (§6.5 G)');
    const [sp1, spA] = c[3].split('/').map((x) => x.trim());
    // (§6.4.1 prints the lv-4 staff single SP as 2.02, §6.5 as 2.03; no lv-4 staff damage tech exists — reported, not a data error)
    if (!(lv === 4 && sp1 === '2.02')) same(at, S.G_MAG_ONE[lv - 1], +sp1, 'staff single SP (§6.5)');
    same(at, S.G_MAG_ALL[lv - 1] == null ? '—' : S.G_MAG_ALL[lv - 1], spA === '—' ? '—' : +spA, 'staff all SP (§6.5)');
    same(at, S.WP_RANGE[lv].join('〜'), range(c[4]).join('〜'), 'WP range (rule)');
    same(at, one(avg(list)), num1(c[5]), 'average WP');
    same(at, `${lv} 以上`, c[6], 'rankB');
    same(at, `${lv - 1} 以上`, c[7], 'proficiency stage');
  }
  // §6.4.5: the average WP of the single-target damage techs of the newly opened lv
  for (const l of sectionLines('#### 6.4.5 ')) {
    const c = cells(l);
    const m = c[0].match(/^(\d+)/);
    if (!m || c.length < 6) continue;
    const lv = +c[4];
    const single = techs.filter((t) => t.glim.lv === lv && t.target === 'enemy' && S.damageOf(t));
    same(`§6.4.5 T${m[1]}`, one(avg(single)), num1(c[5]), `average WP of the lv ${lv} single-target techs`);
  }
  // §4.3.4: hands, middle row, kind
  const KIND_JA = { slash: '斬', blunt: '打', pierce: '突' };
  for (const l of sectionLines('#### 4.3.4 ')) {
    const c = cells(l);
    const w = (c[0] || '').split(' ')[0];
    if (!S.WTYPES.includes(w)) continue;
    const at = `§4.3.4 ${w}`;
    same(at, WT[w].name, c[0].split(' ')[1], 'name');
    same(at, WT[w].twoHanded ? '両手' : '片手', c[1], 'hands');
    same(at, WT[w].reach ? '○' : '×', c[2], 'middle row');
    same(at, KIND_JA[WT[w].kind], c[3], 'kind');
  }
  // §5.2.5: the one-line description of the favoured weapon type is DB.weaponTypes[w].desc (§6.8.1)
  for (const l of sectionLines('#### 5.2.5 ')) {
    const c = cells(l);
    if (S.WTYPES.includes(c[0])) same(`§5.2.5 ${c[0]}`, WT[c[0]].desc, c[1], 'desc');
  }
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
    const hit = techs.filter((t) => crestNames.has(t.name)).map((t) => `${t.id}「${t.name}」`);
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
  const mk = (w, pts, techsKnown) => ({ id: comp, name: 'probe', techs: techsKnown || [], spells: [], wprof: { [w]: pts }, eprof: {}, equip: {}, lv: 50, hp: 1, mp: 1, wp: 1, status: {} });
  const G = F.Glimmer;
  if (!G || !G.candidates) L(false, 'R.Glimmer.candidates not available');
  else {
    const PTS = (F.Rules && F.Rules.K && F.Rules.K.PROF_PTS) || (G.SPEC && G.SPEC.PROF_PTS) || [0, 5, 15, 30, 55, 90, 135, 190, 260, 350, 460];
    for (const w of S.WTYPES) {
      const list = techs.filter((t) => t.wtype === w);
      const ctx = (o) => Object.assign({ kind: 'tech', wtype: w, used: 'attack', rankB: 10, ef: 1, tier: 9, row: 'front', silenced: false }, o);
      const ids = (c, o) => { try { return G.candidates(c, ctx(o)).map((x) => x.id); } catch (e) { return ['ERROR ' + e.message]; } };
      const all = ids(mk(w, PTS[9]));
      L(JSON.stringify(all) === JSON.stringify(list.map((t) => t.id)), `${w}: rankB 10 + stage 9 → all 11 techs are candidates, in lv order (${all.length})`);
      L(ids(mk(w, PTS[9]), { rankB: 9 }).length === 10, `${w}: rankB 9 → 極意 excluded (§6.4.2)`);
      L(ids(mk(w, PTS[8]), { rankB: 10 }).length === 10, `${w}: stage 8 → 極意 excluded (needs stage ≥ 9)`);
      L(JSON.stringify(ids(mk(w, 0), { rankB: 1 })) === JSON.stringify(list.filter((t) => t.glim.lv === 1).map((t) => t.id)), `${w}: rankB 1 + stage 0 → the two lv 1 techs`);
      L(ids(mk(w, PTS[9]), { row: 'middle' }).length === list.filter((t) => t.reach).length, `${w}: middle row → only reach:true techs (§6.4.4-1)`);
      L(ids(mk(w, PTS[9]), { silenced: true }).length === list.filter((t) => !t.magic).length, `${w}: silenced → magic:true techs excluded (§6.4.4-2)`);
      let wts = [];
      try { wts = G.candidates(mk(w, 0), ctx({ rankB: 1 })).map((x) => x.w); } catch (e) { /* reported above */ }
      L(wts.length === 2 && wts.every((x) => x === 6), `${w}: lv 1 candidates after 攻撃 weigh 3 (from) × 2 (lowest) = 6 (${wts.join(',')})`);
      const sec = list.find((t) => t.glim.lv === 10), ou = list.find((t) => t.glim.lv === 9);
      let bs = ['?', '?'];
      try { bs = [G.banner(F.DB.actions[ou.id]).title, G.banner(F.DB.actions[sec.id]).title]; } catch (e) { /* ignore */ }
      L(bs[0] === '奥義' && bs[1] === '極意', `${w}: banner lv 9 「奥義」, lv 10 「極意」 (${bs.join('/')})`);
      try {
        const p10 = G.chance(mk(w, PTS[9]), sec.id, ctx({})), p9 = G.chance(mk(w, PTS[9]), ou.id, ctx({}));
        L(p10 > 0 && p10 < p9, `${w}: 極意 uses the secret BASE (p ${p10.toFixed(4)} < 奥義 ${p9.toFixed(4)})`);
      } catch (e) { L(false, `${w}: chance() threw ${e.message}`); }
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
      L(JSON.stringify(got) === JSON.stringify(list), `${w}: R.Rules.techList lists known techs in §6.1.2 order`);
      try {
        const bad = list.filter((id) => RU.wpCost(c, id) !== F.DB.actions[id].wp);
        L(bad.length === 0, `${w}: R.Rules.wpCost = wp with no wpCostPct ${bad.join(' ')}`);
      } catch (e) { L(false, `${w}: R.Rules.wpCost threw ${e.message}`); }
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
      console.log(`${String(t.glim.lv).padStart(2)} ${t.id.padEnd(24)} ${t.name}\tW${t.wp}\t${TARGET_NAME[t.target]}\t${t.reach ? '○' : '×'}\t${effectText(t)}\t${r ? r.ratio.toFixed(2) : '—'}`);
    }
  }
}
const why = arg('--why');
if (why) {
  const t = byId[why];
  if (!t) console.log(`no tech ${why}`);
  else { const r = S.ratio(t, WT); console.log(`${why} 「${t.name}」 lv${t.glim.lv}: ` + (r ? `${r.parts.join(' ')} = V ${r.V.toFixed(3)} / G ${r.G} = ${r.ratio.toFixed(3)}` : 'no damage (WP range only)')); }
}
console.log(out.join('\n'));
console.log(`check_techs: ${checked} comparisons with DESIGN.md §4.3.4 / §5.2.5 / §6, ${bad} difference(s)` + (argv.includes('--live') ? `; live probes: ${liveWarn} warning(s)` : '') +
  (argv.includes('--battle') ? `; battle probes: ${battleWarn} warning(s)` : ''));
process.exitCode = bad ? 1 : 0; // (not process.exit: it can cut off piped output)
