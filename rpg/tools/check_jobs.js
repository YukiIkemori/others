#!/usr/bin/env node
// Jobs & abilities checker (owner: jobs). Validates src/data/jobs.js and
// src/data/abilities*.js against DESIGN §5.2–5.5 and §6, checks the job tree and
// prints balance tables.
//
//   node tools/check_jobs.js              validation + JP table + damage & heal tables
//   node tools/check_jobs.js --quiet      validation + JP table only
//   node tools/check_jobs.js --job mage   tables for one job only
//
// Balance model (documented assumptions, used only for the tables):
//   * reference party: ユウキ (physical), ノン (healing), メテム (magic) in the ability's job,
//     wearing the best non-rare weapon of the job's weapon types from the level's item band.
//   * monster of the same level: def = 2.2·Lv, mdef = Lv, eva 3, no elemental weakness.
//   * JP income: a character has earned ≈ 12·Lv² JP in total at level Lv; a player spends
//     ≈ 1.6× the strict minimum (detours, other jobs) before an ability is bought. The
//     "Lv" column is the level at which the ability typically becomes available.
//   * ratio = expected damage (all targets for group ×2.5 / enemies ×3.5 / random: all hits)
//     divided by ユウキ's normal attack as a せんし at that level (crits included).
// Exit code 1 on errors.
'use strict';
const load = require('./lib/load');

const R = load({ quiet: true });
const DB = R.DB;
const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const ONLY = argv.includes('--job') ? argv[argv.indexOf('--job') + 1] : null;

const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
for (const e of R._nodeLoadErrors || []) if (/data\/(jobs|abilities)/.test(e)) E('load: ' + e.split('\n')[0]);

// ------------------------------------------------------------------ contract
const JOB_TREE = {
  warrior: [1, 'せんし', []], priest: [1, 'そうりょ', []], mage: [1, 'まほうつかい', []], thief: [1, 'とうぞく', []],
  knight: [2, 'ナイト', [['warrior', 3]]], monk: [2, 'ぶとうか', [['warrior', 2], ['priest', 2]]],
  whitemage: [2, 'しろまどうし', [['priest', 3]]], blackmage: [2, 'くろまどうし', [['mage', 3]]],
  hunter: [2, 'かりゅうど', [['thief', 3]]], bard: [2, 'ぎんゆうしじん', [['priest', 2], ['thief', 2]]],
  alchemist: [2, 'くすりし', [['mage', 2], ['thief', 2]]],
  spellblade: [3, 'まほうけんし', [['knight', 3], ['blackmage', 3]]], paladin: [3, 'パラディン', [['knight', 5], ['whitemage', 4]]],
  ninja: [3, 'にんじゃ', [['hunter', 4], ['monk', 3]]], sage: [3, 'けんじゃ', [['whitemage', 5], ['blackmage', 5]]],
  dragoon: [3, 'りゅうきし', [['knight', 4], ['hunter', 4]]], timemage: [3, 'じくうまどうし', [['blackmage', 4], ['bard', 3]]],
  darkknight: [3, 'あんこくきし', [['warrior', 6], ['blackmage', 4]]],
  hero: [4, 'ゆうしゃ', [['paladin', 5], ['spellblade', 5]]],
};
const START = { warrior_power_slash: 'warrior', priest_heal: 'priest', mage_fire: 'mage' };
const JP_RANGE = { 1: [30, 300], 2: [100, 600], 3: [200, 900], 4: [400, 1200] };
const COUNTS = { action: [6, 10], reaction: [1, 2], support: [1, 3], field: [0, 1] };
const STATS = ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'mnd', 'luk'];
const WTYPES = ['sword', 'knife', 'axe', 'spear', 'staff', 'rod', 'bow', 'claw', 'katana', 'harp'];
const ELEMENTS = ['fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark'];
const STATUSES = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death', 'regen'];
const TARGETS = ['enemy', 'enemies', 'group', 'random', 'ally', 'allies', 'self', 'ally_dead', 'ally_any'];
const FOE = { enemy: 1, enemies: 1, group: 1, random: 1 };
const FORMULAS = ['phys', 'magic', 'fixed', 'percent', 'breath'];
const BUFFS = ['atk', 'def', 'mag', 'mdef', 'agi'];
const TRIGGERS = ['hitPhys', 'hitMagic', 'hitAny', 'lowHp', 'allyLowHp', 'ko'];
const FLAGS = ['boss', 'metal', 'undead', 'flying', 'dragon', 'flee'];
const FIELD_MODS = new Set(['encounterPct', 'walkHeal', 'noFloorDamage', 'treasureSense']);
const MODS = new Set(('hpPct mpPct strPct vitPct agiPct intPct mndPct lukPct atk def mag mdef hit eva crit atkPct defPct magPct mdefPct ' +
  'physPct magicPct healPct itemPct mpCostPct critPct escapePct preemptPct elemBoost elemResist statusImmune startBuffs regen ' +
  'twoSwords unarmed equip expPct jpPct goldPct dropPct rarePct stealPct encounterPct walkHeal noFloorDamage treasureSense').split(' '));
const EFFECT_FIELDS = {
  damage: ['formula', 'power', 'scale', 'element', 'hits', 'ignoreDef', 'drain', 'mp', 'critBonus', 'acc', 'vs', 'hpCost'],
  heal: ['power', 'scale', 'pct', 'hpCost'], healMp: ['power'], revive: ['pct'], cure: ['statuses'], status: ['status', 'chance'],
  buff: ['stat', 'stages', 'chance', 'hpCost'], dispel: [], steal: ['rareBonus'], scan: [], escape: [], regen: [], grow: ['stat', 'n'],
  teleport: [], exit: [], repel: ['steps'],
};
const FIELD_OK = { heal: 1, cure: 1, revive: 1, teleport: 1, exit: 1, repel: 1, healMp: 1, grow: 1, regen: 1 };
const FX_WORDS = ('slash pierce strike claw bite fire ice thunder wind earth water holy dark explosion breath drain gravity death ' +
  'heal mp cure revive regen buff debuff dispel sleep poison paralyze confuse silence blind steal scan smoke song grow magic warp jump meteor').split(' ');
// DQ / FF proprietary names that must never appear (DESIGN §0 originality)
const BANNED = ('メラ ギラ ヒャド バギ イオナズン イオラ デイン ドルマ ホイミ ベホ ザオ キアリ ルーラ リレミト トヘロス ラリホー マホトーン メダパニ ' +
  'ルカニ ルカナン スカラ スクルト バイキルト ピオリム ボミオス ザキ マヌーサ マホカンタ アストロン ニフラム シャナク インパス アバカム フバーハ ' +
  'マダンテ パルプンテ はやぶさぎり まじんぎり メタルぎり かえんぎり いなずまぎり ばくれつけん せいけんづき まわしげり しっぷうづき きあいため ' +
  'めいそう しのびあし とうぞくのはな もろばぎり ギガスラッシュ ギガブレイク グランドクロス みなごろし ' +
  'ケアル レイズ エスナ ファイア ファイラ ファイガ ブリザ サンダー サンダラ サンダガ エアロ ホーリー フレア アルテマ メテオ デジョン テレポ ' +
  'グラビデ ヘイスト スロウ ストップ プロテス シェル リフレク リジェネ バイオ ドレイン アスピル ポイズン ブライン サイレス スリプル コンフュ ' +
  'ライブラ デスペル チャクラ とんずら ぶんどる みだれうち けりをいれる ためる ちょうごう くすりのちしき おうきゅうてあて ジャンプ').split(' ');
const BANNED_OK = ['ファイアボール']; // explicitly allowed by DESIGN §0

// ------------------------------------------------------------------ helpers
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// DotGothic16 at the default size: full-width 11px, ASCII 5.5px, space 5px (measured in the browser)
const width = (s) => { let w = 0; for (const ch of String(s)) w += ch === ' ' ? 5 : ch.charCodeAt(0) < 0x80 ? 5.5 : 11; return w; };
const fmt = (n, d = 0) => (n == null || !isFinite(n) ? '-' : n.toFixed(d));
const pad = (s, n) => { s = String(s); const w = width(s) / 5.5; return s + ' '.repeat(Math.max(0, n - Math.round(w))); };
const padL = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; };
const hex = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
function banned(s) {
  let t = String(s);
  for (const ok of BANNED_OK) t = t.split(ok).join('');
  return BANNED.filter((b) => b && t.includes(b));
}

function checkMods(where, m, kind) {
  if (!m || typeof m !== 'object') { E(`${where}: mods missing`); return; }
  if (!Object.keys(m).length) E(`${where}: empty mods`);
  for (const k in m) {
    if (!MODS.has(k)) E(`${where}: unknown mod '${k}'`);
    if (kind === 'field' && !FIELD_MODS.has(k)) E(`${where}: field ability with battle mod '${k}' (it would apply everywhere)`);
    if (kind === 'support' && FIELD_MODS.has(k)) W(`${where}: support with field-only mod '${k}'`);
    const v = m[k];
    if ((k === 'elemBoost' || k === 'elemResist')) for (const e in v) if (!ELEMENTS.includes(e)) E(`${where}: bad element ${e}`);
    if (k === 'statusImmune') for (const s of v) if (!STATUSES.includes(s)) E(`${where}: bad status ${s}`);
    if (k === 'startBuffs') for (const s in v) if (!BUFFS.includes(s)) E(`${where}: bad buff ${s}`);
    if (k === 'equip') for (const t of v) if (![...WTYPES, 'shield', 'helm', 'hat', 'heavy', 'light', 'robe'].includes(t)) E(`${where}: bad equip ${t}`);
  }
}

function checkEffect(where, f, ab) {
  if (!f || !EFFECT_FIELDS[f.type]) { E(`${where}: bad effect type ${f && f.type}`); return; }
  for (const k in f) if (k !== 'type' && !EFFECT_FIELDS[f.type].includes(k)) E(`${where}: effect ${f.type} has unknown field '${k}'`);
  switch (f.type) {
    case 'damage':
      if (!FORMULAS.includes(f.formula)) E(`${where}: bad formula ${f.formula}`);
      if (typeof f.power !== 'number' || f.power <= 0) E(`${where}: damage power`);
      if (f.element && !ELEMENTS.includes(f.element)) E(`${where}: bad element ${f.element}`);
      if (f.hits != null && !(Array.isArray(f.hits) ? f.hits.length === 2 && f.hits[0] <= f.hits[1] : f.hits >= 1)) E(`${where}: bad hits`);
      if (f.acc != null && !(f.acc > 0 && f.acc <= 2)) E(`${where}: bad acc`);
      if (f.drain != null && !(f.drain > 0 && f.drain <= 1)) E(`${where}: bad drain`);
      if (f.hpCost != null && !(f.hpCost > 0 && f.hpCost < 1)) E(`${where}: bad hpCost`);
      if (f.vs) for (const k in f.vs) if (!FLAGS.includes(k)) E(`${where}: bad vs flag ${k}`);
      if (f.formula === 'magic' && f.scale == null) W(`${where}: magic without explicit scale`);
      if (f.formula === 'percent' && !(f.power > 0 && f.power <= 1)) E(`${where}: percent power must be 0..1`);
      if (!FOE[ab.target]) E(`${where}: damage on non-enemy target ${ab.target}`);
      break;
    case 'heal':
      if (f.pct == null && typeof f.power !== 'number') E(`${where}: heal without power/pct`);
      if (f.pct != null && !(f.pct > 0 && f.pct <= 1)) E(`${where}: bad heal pct`);
      if (f.pct == null && f.scale == null) W(`${where}: heal without explicit scale`);
      break;
    case 'healMp': if (!(f.power > 0)) E(`${where}: healMp power`); break;
    case 'revive': if (!(f.pct > 0 && f.pct <= 1)) E(`${where}: revive pct`); if (!['ally_dead', 'allies', 'ally_any'].includes(ab.target)) E(`${where}: revive on target ${ab.target}`); break;
    case 'cure': if (f.statuses !== 'all' && !(Array.isArray(f.statuses) && f.statuses.length && f.statuses.every((s) => STATUSES.includes(s)))) E(`${where}: bad cure statuses`); break;
    case 'status':
      if (!STATUSES.includes(f.status)) E(`${where}: bad status ${f.status}`);
      if (!(f.chance > 0 && f.chance <= 1)) E(`${where}: bad status chance`);
      break;
    case 'buff':
      if (!BUFFS.includes(f.stat)) E(`${where}: bad buff stat ${f.stat}`);
      if (!f.stages || Math.abs(f.stages) > 2) E(`${where}: bad stages`);
      if (f.stages < 0 && !FOE[ab.target]) E(`${where}: debuff on own side`);
      if (f.stages > 0 && FOE[ab.target]) E(`${where}: buff on enemies`);
      break;
    case 'repel': if (!(f.steps > 0)) E(`${where}: repel steps`); break;
  }
}

// ------------------------------------------------------------------ validation
const jobs = DB.jobs, abil = DB.abilities;
const listed = {};
for (const id in JOB_TREE) if (!jobs[id]) E(`job '${id}' missing`);
for (const id in jobs) {
  const j = jobs[id], w = `job ${id}`, T = JOB_TREE[id];
  if (!T) { E(`${w}: not in DESIGN §5.2`); continue; }
  if (j.tier !== T[0]) E(`${w}: tier ${j.tier} ≠ ${T[0]}`);
  if (j.name !== T[1]) E(`${w}: name ${j.name} ≠ ${T[1]}`);
  if (JSON.stringify(j.req || []) !== JSON.stringify(T[2])) E(`${w}: req ${JSON.stringify(j.req)} ≠ ${JSON.stringify(T[2])}`);
  if (!j.command) E(`${w}: no command`); else if (width(j.command) > 55) E(`${w}: command '${j.command}' too wide for the battle menu (${fmt(width(j.command))}px > 55)`);
  // the job board wraps at 226px and shows 2 lines: break explicitly at a phrase boundary
  if (!j.desc) E(`${w}: no desc`);
  else {
    const lines = j.desc.split('\n');
    if (lines.length > 2) E(`${w}: desc has ${lines.length} lines (max 2)`);
    for (const l of lines) if (width(l) > 226) E(`${w}: desc line too wide (${fmt(width(l))}px > 226): ${l}`);
    if (lines.length === 1 && width(j.desc) > 226) W(`${w}: long desc without an explicit line break`);
  }
  for (const s of STATS) { const v = j.mult && j.mult[s]; if (!(v >= 0.6 && v <= 1.4)) E(`${w}: mult.${s} = ${v} (0.6..1.4)`); }
  if (!Array.isArray(j.weapons) || !j.weapons.length) E(`${w}: no weapons`);
  for (const t of j.weapons || []) if (!WTYPES.includes(t)) E(`${w}: bad weapon ${t}`);
  if (typeof j.shield !== 'boolean') E(`${w}: shield must be boolean`);
  for (const t of j.heads || []) if (!['helm', 'hat'].includes(t)) E(`${w}: bad head ${t}`);
  for (const t of j.bodies || []) if (!['heavy', 'light', 'robe'].includes(t)) E(`${w}: bad body ${t}`);
  if (!(j.heads || []).length || !(j.bodies || []).length) E(`${w}: must allow some head and body armour`);
  if (j.tier === 1 && !(j.bodies || []).includes('light')) E(`${w}: tier-1 job cannot wear 'light' clothes (start gear たびじのふく)`);
  if (j.innate) checkMods(`${w} innate`, j.innate, 'innate');
  if (!j.outfit || !hex(j.outfit.main) || !hex(j.outfit.sub) || !hex(j.outfit.trim)) E(`${w}: outfit needs main/sub/trim #rrggbb`);
  for (const b of banned(j.command || '')) E(`${w}: command contains banned name '${b}'`);
  const n = { action: 0, reaction: 0, support: 0, field: 0 };
  const seen = new Set();
  for (const a of j.abilities || []) {
    if (seen.has(a)) E(`${w}: ability ${a} listed twice`);
    seen.add(a);
    if (listed[a]) E(`${w}: ability ${a} also listed by ${listed[a]}`);
    listed[a] = id;
    const ab = abil[a];
    if (!ab) { E(`${w}: ability ${a} missing`); continue; }
    if (ab.job !== id) E(`${w}: ability ${a} has job ${ab.job}`);
    if (n[ab.kind] != null) n[ab.kind]++;
  }
  for (const k in COUNTS) if (n[k] < COUNTS[k][0] || n[k] > COUNTS[k][1]) E(`${w}: ${n[k]} ${k} abilities (want ${COUNTS[k].join('–')})`);
  // menu order: kinds grouped action → reaction → support → field
  const order = (j.abilities || []).map((a) => abil[a] && ['action', 'reaction', 'support', 'field'].indexOf(abil[a].kind));
  for (let i = 1; i < order.length; i++) if (order[i] < order[i - 1]) { W(`${w}: abilities not grouped by kind`); break; }
}

const names = {};
for (const id in abil) {
  if (id.startsWith('en_')) continue;
  const a = abil[id], w = `ability ${id}`;
  const j = jobs[a.job];
  if (!j) { E(`${w}: unknown job ${a.job}`); continue; }
  if (!id.startsWith(a.job + '_')) E(`${w}: id must start with '${a.job}_'`);
  if (!listed[id]) E(`${w}: not listed in job ${a.job}`);
  if (!a.name) E(`${w}: no name`);
  const maxW = a.kind === 'action' ? 77 : 88; // battle list column / set screen
  if (width(a.name) > maxW) E(`${w}: name '${a.name}' too wide (${fmt(width(a.name))}px > ${maxW})`);
  if (names[a.name]) E(`${w}: name '${a.name}' also used by ${names[a.name]}`);
  names[a.name] = id;
  for (const b of banned(a.name)) E(`${w}: name contains banned '${b}'`);
  if (!a.desc) E(`${w}: no desc`);
  else if (width(a.desc) > 226 * 2) E(`${w}: desc does not fit the menu (${fmt(width(a.desc))}px)`);
  else if (a.kind === 'action' && width(a.desc) > 236) W(`${w}: desc squeezed in the one-line battle help (${fmt(width(a.desc))}px > 236)`);
  else if (a.kind !== 'action' && width(a.desc) > 226) W(`${w}: desc cut off on the one-line セット screen (${fmt(width(a.desc))}px > 226)`);
  if (/[a-zA-Z]{2,}/.test((a.desc || '').replace(/HP|MP|JP/g, ''))) W(`${w}: latin text in desc`);
  const [lo, hi] = JP_RANGE[j.tier];
  if (typeof a.jp !== 'number' || a.jp < lo || a.jp > hi) E(`${w}: jp ${a.jp} outside tier ${j.tier} range ${lo}–${hi}`);
  if (a.jp % 10) W(`${w}: jp ${a.jp} not a multiple of 10`);
  switch (a.kind) {
    case 'action': {
      if (!TARGETS.includes(a.target)) E(`${w}: bad target ${a.target}`);
      if (typeof a.mp !== 'number' || a.mp < 0) E(`${w}: mp must be a number ≥ 0`);
      if (a.magic != null && typeof a.magic !== 'boolean') E(`${w}: magic must be boolean`);
      if (!Array.isArray(a.effects) || !a.effects.length) { E(`${w}: effects missing`); break; }
      for (const f of a.effects) checkEffect(w, f, a);
      if (!a.fx) E(`${w}: no fx`);
      else if (!FX_WORDS.some((k) => a.fx.replace(/\d+$/, '').includes(k))) W(`${w}: fx '${a.fx}' not in the battle_fx vocabulary`);
      const fieldy = a.effects.some((f) => ['teleport', 'exit', 'repel'].includes(f.type));
      const healy = a.effects.some((f) => ['heal', 'revive'].includes(f.type)) && !a.effects.some((f) => f.hpCost) && !FOE[a.target];
      if (a.fieldUse && !a.effects.every((f) => FIELD_OK[f.type])) E(`${w}: fieldUse with a battle-only effect`);
      if (fieldy && !a.fieldUse) E(`${w}: field effect without fieldUse`);
      if (healy && !a.fieldUse && a.mp > 0) W(`${w}: healing action not usable in the field`);
      if (a.msg && !/\{user\}/.test(a.msg)) W(`${w}: msg without {user}`);
      break;
    }
    case 'reaction':
      if (!TRIGGERS.includes(a.trigger)) E(`${w}: bad trigger ${a.trigger}`);
      if (!(a.chance > 0 && a.chance <= 1)) E(`${w}: bad chance ${a.chance}`);
      if (!a.react) { E(`${w}: no react`); break; }
      switch (a.react.type) {
        case 'counter': case 'autoItem': case 'cover': break;
        case 'heal': if (!(a.react.pct > 0 && a.react.pct <= 1)) E(`${w}: react heal pct`); break;
        case 'buff': if (!BUFFS.includes(a.react.stat) || !a.react.stages) E(`${w}: react buff`); break;
        case 'revive': if (!(a.react.pct > 0 && a.react.pct <= 1)) E(`${w}: react revive pct`); if (a.trigger !== 'ko') E(`${w}: revive reaction needs trigger 'ko'`); break;
        case 'mp': if (!(a.react.power > 0)) E(`${w}: react mp power`); break;
        default: E(`${w}: bad react ${a.react.type}`);
      }
      if (a.react.type === 'cover' && a.trigger !== 'allyLowHp') W(`${w}: cover reaction should use trigger allyLowHp`);
      break;
    case 'support': case 'field': checkMods(w, a.mods, a.kind); break;
    default: E(`${w}: bad kind ${a.kind}`);
  }
}
for (const id in START) {
  const a = abil[id];
  if (!a) E(`start ability ${id} missing`);
  else if (a.job !== START[id]) E(`start ability ${id} in job ${a.job}`);
}
for (const cid in DB.chars) for (const a of DB.chars[cid].startLearned || []) if (!abil[a]) E(`char ${cid}: startLearned ${a} missing`);
const fieldEff = (t) => Object.keys(abil).filter((id) => abil[id].kind === 'action' && abil[id].fieldUse && abil[id].effects.some((f) => f.type === t));
if (!fieldEff('teleport').some((id) => ['mage', 'blackmage', 'timemage', 'sage'].includes(abil[id].job))) E('no teleport spell in the mage line');
if (!fieldEff('exit').length) E('no dungeon exit ability');
if (!fieldEff('repel').length) E('no repel-like field ability');
for (const k of ['heal', 'cure', 'revive']) if (!fieldEff(k).length) E(`no field-usable ${k} ability`);

// ------------------------------------------------------------------ job tree
const { JP_TABLE } = R.Rules;
const reqClosure = (id, acc = {}, stack = []) => {
  if (stack.includes(id)) { E(`job tree cycle: ${[...stack, id].join(' → ')}`); return acc; }
  for (const [rj, lv] of (jobs[id] && jobs[id].req) || []) {
    if (!jobs[rj]) continue;
    if (jobs[rj].tier >= jobs[id].tier) E(`job ${id}: requirement ${rj} is not a lower tier`);
    acc[rj] = Math.max(acc[rj] || 0, lv);
    reqClosure(rj, acc, [...stack, id]);
  }
  return acc;
};
const unlockJP = {};
for (const id in jobs) {
  const cl = reqClosure(id);
  unlockJP[id] = Object.keys(cl).reduce((s, j) => s + JP_TABLE[cl[j] - 1], 0);
  // reachability: a fresh character (only tier-1 jobs open) can meet every requirement
  const roots = Object.keys(cl).filter((j) => !(jobs[j].req || []).length);
  if ((jobs[id].req || []).length && !roots.length) E(`job ${id}: not reachable from a tier-1 job`);
}
{ // the real rules agree: a character who reached the closure levels has the job
  const c = R.Rules.newChar('yuki');
  for (const id in jobs) {
    const cl = reqClosure(id);
    const t = { jobs: {}, job: 'warrior', set: {}, equip: {} };
    for (const j in cl) t.jobs[j] = { jp: 0, total: JP_TABLE[cl[j] - 1], learned: [] };
    if (!R.Rules.isJobUnlocked(t, id)) E(`job ${id}: Rules.isJobUnlocked disagrees with its requirement closure`);
  }
  if (!c) E('Rules.newChar failed');
}

// ------------------------------------------------------------------ JP table
const kindsOf = (id) => (jobs[id].abilities || []).map((a) => abil[a]).filter(Boolean);
const jpTotal = (id) => kindsOf(id).reduce((s, a) => s + (a.jp || 0), 0);
console.log('\n=== JOBS ===  (JP to master vs the Lv8 threshold 2000; unlock = minimum JP spent elsewhere first)');
console.log(pad('job', 12) + pad('名前', 16) + 'T  cmd' + ' '.repeat(10) + 'act rea sup fld   JP   ×Lv8  unlock');
for (const id in jobs) {
  const j = jobs[id], ks = kindsOf(id);
  const n = (k) => ks.filter((a) => a.kind === k).length;
  const tot = jpTotal(id);
  const ratio = tot / 2000;
  if (ratio < 1.4 || ratio > 2.6) W(`job ${id}: mastery JP ${tot} is ${ratio.toFixed(2)}× Lv8 (want ≈1.5–2.5×)`);
  console.log(pad(id, 12) + pad(j.name, 16) + j.tier + '  ' + pad(j.command, 14) +
    padL(n('action'), 3) + padL(n('reaction'), 4) + padL(n('support'), 4) + padL(n('field'), 4) +
    padL(tot, 6) + padL(ratio.toFixed(2), 6) + padL(unlockJP[id], 7));
}
console.log(`abilities: ${Object.keys(abil).filter((k) => !k.startsWith('en_')).length}   start: ${Object.keys(START).join(' ')}`);

// ------------------------------------------------------------------ balance model
const BAND_LV = [5, 11, 18, 26, 32, 40];
const bandOf = (L) => { for (let b = 0; b < BAND_LV.length; b++) if (L <= BAND_LV[b]) return b + 1; return 6; };
const cumJp = (L) => 12 * L * L;
const levelFor = (jp) => { let L = 1; while (L < 60 && cumJp(L) < jp * 1.6) L++; return L; };
function bestWeapon(job, L, key) {
  const band = bandOf(L);
  let best = null, bv = -1;
  for (const id in DB.items) {
    const it = DB.items[id];
    if (it.type !== 'weapon' || it.rare || !(job.weapons || []).includes(it.wtype)) continue;
    if ((it.band || 1) > band) continue;
    const v = key === 'mag' ? (it.mag || 0) * 2 + (it.atk || 0) * 0.1 : key === 'mnd' ? ((it.stats && it.stats.mnd) || 0) * 2 + (it.mag || 0) : (it.atk || 0);
    if (v > bv) { best = id; bv = v; }
  }
  return best;
}
function refChar(charId, jobId, L, key) {
  const c = R.Rules.newChar(charId);
  c.level = L; c.job = jobId;
  for (const s of R.Rules.SLOTS) c.equip[s] = null;
  c.equip.weapon = bestWeapon(jobs[jobId], L, key);
  c.st = R.Rules.stats(c);
  return c;
}
const MON = (L) => ({ def: 2.2 * L, mdef: L, eva: 3 });
function physHit(st, eff, L, crit) {
  const m = MON(L), p = eff.power;
  const def = eff.ignoreDef ? 0 : m.def;
  const base = (st.atk * p) / 2 - def / 4;
  const mul = (1 + (st.mods.physPct || 0) / 100);
  const normal = base < 1 ? 0.5 : base * mul;
  const hit = Math.min(1, Math.max(0.05, (st.hit * (eff.acc != null ? eff.acc : 1) - m.eva) / 100));
  if (!crit) return normal * hit;
  const pc = Math.min(1, (st.crit + (eff.critBonus || 0)) / 100);
  return hit * ((1 - pc) * normal + pc * st.atk * p * mul);
}
function effDamage(st, eff, L, crit) {
  const m = MON(L);
  const boost = eff.element && st.mods.elemBoost && st.mods.elemBoost[eff.element] ? 1 + st.mods.elemBoost[eff.element] / 100 : 1;
  const hits = Array.isArray(eff.hits) ? (eff.hits[0] + eff.hits[1]) / 2 : eff.hits || 1;
  let d;
  switch (eff.formula) {
    case 'phys': d = physHit(st, eff, L, crit); break;
    case 'magic': d = (eff.power + st.mag * (eff.scale != null ? eff.scale : 0.6)) * (100 / (100 + m.mdef)) * (1 + (st.mods.magicPct || 0) / 100) * (eff.acc != null && eff.acc < 1 ? eff.acc : 1); break;
    case 'breath': case 'fixed': d = eff.power; break;
    default: return null; // percent
  }
  return { per: eff.formula === 'breath' ? d : d * boost, hits };
}
const TARGET_N = { enemy: 1, group: 2.5, enemies: 3.5, random: 1 };
const attackRef = (L) => { const c = refChar('yuki', 'warrior', L, 'atk'); return physHit(c.st, { power: 1 }, L, true); };
const heroOf = (a) => {
  const dm = a.effects.find((f) => f.type === 'damage');
  if (a.effects.some((f) => f.type === 'heal' || f.type === 'revive')) return ['non', 'mnd'];
  if (dm && dm.formula === 'magic') return ['metem', 'mag'];
  return ['yuki', 'atk'];
};

// optional cross-check with the real battle engine (expect mode, no crits)
let engineOk = 0, engineBad = 0;
function engineCheck(c, a, L, mine) {
  const B = R.Battle;
  if (!B || !B.Engine) return;
  try {
    DB.monsters.__cj = { name: 'ダミー', sprite: 'jelly', lv: L, hp: 99999, mp: 0, atk: 1, def: MON(L).def, agi: 1, mag: 1, mdef: MON(L).mdef, eva: 3, exp: 0, gold: 0, jp: 0, actions: [{ id: 'attack', w: 1 }] };
    const eng = new B.Engine({ party: [R.U.clone(Object.assign({}, c, { st: undefined }))], mons: ['__cj'], inv: {}, noSurprise: true });
    const d = eng.expectDamage(eng.party[0], a, eng.mons[0]);
    if (mine > 0 && Math.abs(d - mine) / mine > 0.03) { engineBad++; W(`engine disagrees on ${a.name} at Lv${L}: engine ${fmt(d, 1)} vs model ${fmt(mine, 1)}`); } else engineOk++;
  } catch (e) { engineBad++; W(`engine check failed for ${a.name}: ${String(e.message || e).split('\n')[0]}`); }
  finally { delete DB.monsters.__cj; }
}

{ // JP pacing target for the monster owner (monster jp values)
  console.log('\n=== JP PACING ===  (model: a character has earned ≈ 12·Lv² JP; typical job = when ≈1.6× its minimum unlock JP is earned)');
  const firstLv = {};
  for (const id in jobs) firstLv[id] = levelFor(unlockJP[id] + Math.min(...kindsOf(id).map((a) => a.jp)));
  let prev = 0;
  for (const L of [3, 5, 8, 10, 15, 20, 25, 30, 35, 40]) {
    const exp = R.Rules.expForLevel(L);
    const open = Object.keys(jobs).filter((j) => firstLv[j] > prev && firstLv[j] <= L);
    prev = L;
    console.log(`Lv${padL(L, 2)}  JP earned ≈ ${padL(cumJp(L), 5)}  (total EXP ${padL(exp, 6)} → JP/EXP ${fmt(cumJp(L) / Math.max(1, exp), 2)})  new jobs: ${open.map((j) => jobs[j].name).join(' ') || '-'}`);
  }
}

if (!QUIET) {
  console.log('\n=== DAMAGE ===  (Lv = typical level when bought; vs monster def 2.2·Lv, mdef Lv; ratio vs せんし ユウキ normal attack)');
  console.log(pad('ability', 24) + pad('target', 8) + ' Lv   per-hit  hits  total   atk   ratio   MP  dmg/MP  note');
  for (const jid in jobs) {
    if (ONLY && jid !== ONLY) continue;
    let prefix = 0;
    const list = kindsOf(jid).slice().sort((x, y) => x.jp - y.jp);
    for (const a of list) {
      prefix += a.jp;
      if (a.kind !== 'action') continue;
      const dmgs = a.effects.filter((f) => f.type === 'damage');
      if (!dmgs.length) continue;
      const L = Math.max(1, levelFor(unlockJP[jid] + prefix));
      const [cid, key] = heroOf(a);
      const c = refChar(cid, jid, L, key);
      let total = 0, per = 0, hits = 1, note = [];
      for (const f of dmgs) {
        if (f.formula === 'percent') { note.push(`${Math.round(f.power * 100)}%HP×${f.acc != null ? f.acc : 1}`); continue; }
        if (f.mp) { note.push('MPdmg'); continue; }
        const r = effDamage(c.st, f, L, true);
        per += r.per; hits = r.hits;
        total += r.per * r.hits;
        if (f.hpCost) note.push(`HP-${Math.round(f.hpCost * 100)}%`);
        if (f.drain) note.push('drain');
        if (f.element) note.push(f.element);
        if (f.vs) note.push('vs ' + Object.keys(f.vs).map((k) => k + '×' + f.vs[k]).join(','));
      }
      if (!total) { console.log(pad(`${jid}.${a.name}`, 24) + pad(a.target, 8) + padL(L, 3) + '   ' + note.join(' ')); continue; }
      const value = total * (TARGET_N[a.target] || 1);
      const ref = attackRef(L);
      const cost = R.Rules.mpCost({ job: jid, set: {}, equip: {}, jobs: {} }, Object.keys(abil).find((k) => abil[k] === a)) || a.mp;
      if (a.target !== 'random' && dmgs[0].formula !== 'percent') engineCheck(c, a, L, dmgs.reduce((s, f) => { const r = f.formula === 'percent' || f.mp ? null : effDamage(c.st, f, L, false); return s + (r ? r.per * r.hits : 0); }, 0));
      console.log(pad(`${jid}.${a.name}`, 24) + pad(a.target, 8) + padL(L, 3) + padL(fmt(per, 1), 10) + padL(fmt(hits, 1), 6) +
        padL(fmt(total, 0), 7) + padL(fmt(ref, 0), 6) + padL(fmt(value / ref, 2), 8) + padL(a.mp, 5) +
        padL(a.mp ? fmt(value / a.mp, 1) : '∞', 8) + '  ' + note.join(' '));
    }
  }
  if (R.Battle && R.Battle.Engine) console.log(`engine cross-check: ${engineOk} agree, ${engineBad} differ`);
  else console.log('engine cross-check skipped (R.Battle.Engine not loaded)');

  console.log('\n=== HEALING ===  (healer ノン in the job; % of せんし ユウキ max HP at that level)');
  console.log(pad('ability', 26) + pad('target', 10) + ' Lv   amount  %maxHP   MP');
  for (const jid in jobs) {
    if (ONLY && jid !== ONLY) continue;
    let prefix = 0;
    for (const a of kindsOf(jid).slice().sort((x, y) => x.jp - y.jp)) {
      prefix += a.jp;
      if (a.kind !== 'action') continue;
      const h = a.effects.find((f) => f.type === 'heal' || f.type === 'revive');
      if (!h) continue;
      const L = Math.max(1, levelFor(unlockJP[jid] + prefix));
      const c = refChar('non', jid, L, 'mnd');
      const ref = refChar('yuki', 'warrior', L, 'atk').st.hp;
      let amt;
      if (h.type === 'revive') amt = h.pct * ref;
      else if (h.pct) amt = h.pct * ref;
      else amt = (h.power + c.st.mnd * (h.scale != null ? h.scale : 0.6)) * (1 + (c.st.mods.healPct || 0) / 100);
      console.log(pad(`${jid}.${a.name}`, 26) + pad(a.target, 10) + padL(L, 3) + padL(fmt(amt, 0), 9) +
        padL(fmt((amt / ref) * 100, 0) + '%', 8) + padL(a.mp, 5) + (h.type === 'revive' ? '  (revive)' : ''));
    }
  }

  console.log('\n=== REFERENCE ===  (Lv: せんし ユウキ atk / normal hit · くろまどうし メテム mag · そうりょ ノン mnd · monster def/mdef)');
  for (const L of [1, 5, 10, 15, 20, 25, 30, 35, 40]) {
    const y = refChar('yuki', 'warrior', L, 'atk'), m = refChar('metem', 'blackmage', L, 'mag'), n = refChar('non', 'priest', L, 'mnd');
    console.log(`Lv${padL(L, 2)}  atk ${padL(y.st.atk, 3)} hit ${padL(fmt(attackRef(L), 1), 5)} HP ${padL(y.st.hp, 3)}  |  mag ${padL(m.st.mag, 3)} MP ${padL(m.st.mp, 3)}  |  mnd ${padL(n.st.mnd, 3)} MP ${padL(n.st.mp, 3)}  |  def ${fmt(MON(L).def)} mdef ${L}`);
  }
}

// ------------------------------------------------------------------ report
console.log('');
for (const w of warns) console.log('WARN  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(`\ncheck_jobs: ${Object.keys(jobs).length} jobs, ${Object.keys(abil).filter((k) => !k.startsWith('en_')).length} abilities — ${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
