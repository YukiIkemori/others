#!/usr/bin/env node
// port_mons.js（BATTLE）: 今の木の魔物・行動・出現・編成・ボス・レアのデータを v2 へ移す（V2_PLAN §1.2・§4.1 の BATTLE の行）
//
//   node v2/tools/port/port_mons.js            移して v2/src/data/ に書く（手で足した @@V2 の区画は残す）
//   node v2/tools/port/port_mons.js --check    書かずに、今の v2 のファイルと食い違う所を数える（終了コード 1）
//   node v2/tools/port/port_mons.js --list-items   ドロップ・盗みが参照する品の id の一覧（RULES への依頼用）
//
// 移すときに当てる決まり（手で書き直さない。この道具が 1 か所）:
//   - 行動の登録先: R.DB.actions → R.DB.enemyActions（e_*）・R.DB.bossActions（eb_*）（v2 の DB の名前、core/ns.js）
//   - ドロップの枠（STATS_REWORK §10.1）: 通常の魔物のレア枠は系統の最後の段だけ、超レア枠は 5 段の系統の最後の段と
//     void_3・chaos_3・demon_3・book_3・paper_4 だけ。ボス・レア魔物は今のまま
//   - 品の付け替え（§8.3）: 斧の魔物の品 w_axe_* → w_greatsword_*、槍の品は表のとおり剣・大剣へ。実（§10.2）は i_ether・i_elixir へ
//   - 盗み専用（§7.2、V2_PLAN §2.6.6）: 36 体に drops.steal = {item, rate}（通常の魔物 32・レア魔物 16・ボス 16）
//   - 経験値は無い（§9.4）: データには元から書いていない（R.Mon.fillStats が作らない）
// 手で足す物（縦切りの出現表・狼の群れ頭・予告の行動など）は各ファイルの「// @@V2-BEGIN」〜「// @@V2-END」の中に書く。
// この道具はその区画を読み、書き直したファイルの最後（`})(window.RPG);` の前）にそのまま戻す。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..');   // chronicle/
const SRC = path.join(ROOT, 'src', 'data');
const DST = path.join(ROOT, 'v2', 'src', 'data');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const LIST = argv.includes('--list-items');

const FILES = [
  'lineages.js', 'enemy_actions.js', 'bosses_actions.js', 'encounters.js', 'troops.js', 'bosses.js', 'rare.js', 'rare_encounters.js',
  ...fs.readdirSync(SRC).filter((f) => /^monsters_[a-z]+\.js$/.test(f)).sort(),
];

// ---------------------------------------------------------------- 品の付け替え（STATS_REWORK §8.3・§10.2）
const SPEAR = {
  w_spear_sr_irontusk: 'w_greatsword_sr_irontusk', w_spear_sr_chaincurse: 'w_greatsword_sr_chaincurse', w_spear_sr_harpoon: 'w_greatsword_sr_harpoon',
  w_spear_sr_venomjelly: 'w_sword_sr_venomjelly', w_spear_sr_whiteline: 'w_sword_sr_whiteline', w_spear_sr_stormbeak: 'w_sword_sr_stormbeak',
  w_spear_sr_venomneedle: 'w_sword_sr_venomneedle', w_spear_sr_marsh: 'w_sword_sr_marsh', w_spear_sr_eightarm: 'w_sword_sr_eightarm',
  w_spear_sr_sparkhorn: 'w_sword_sr_sparkhorn', w_spear_sr_flamehorn: 'w_sword_sr_flamehorn', w_spear_sr_soot_fork: 'w_sword_sr_soot_fork',
  w_spear_sr_windcutter: 'w_sword_sr_windcutter', w_spear_sr_quicksilver: 'w_sword_sr_quicksilver', w_spear_sr_mirrorhorn: 'w_sword_sr_mirrorhorn',
  w_spear_coral: 'w_sword_coral', w_spear_mist: 'w_sword_mist', w_spear_reed: 'w_sword_reed', w_spear_hornet: 'w_sword_hornet',
};
const SEEDS = { i_seed_hp: 'i_elixir', i_seed_mp: 'i_ether', i_dream_fruit: 'i_elixir' };
/** 旧の品の id → 新の id（消える品は null） */
function remapItem(id) {
  if (!id || typeof id !== 'string') return id;
  if (SEEDS[id]) return SEEDS[id];
  if (id.startsWith('w_spear_')) return SPEAR[id] || null;
  if (id.startsWith('w_axe_')) {
    const rest = id.slice(6);
    if (/^(\d|hand$)/.test(rest)) return null;             // 斧の通常品（消える）
    if (/^r[13579]$/.test(rest)) return null;              // 斧の帯のレア（消える）
    return 'w_greatsword_' + rest;                          // メイスの帯のレア・魔物の斧は大剣へ
  }
  return id;
}

// ---------------------------------------------------------------- 盗み専用（STATS_REWORK §7.2、率は V2_PLAN §2.6.6）
const STEAL = {
  b_rooteater: 'ac_st_rooteater', b_sandking: 'ac_st_sandking', b_whitedragon: 'ac_st_whitedragon', b_mistbeast: 'ac_st_mistbeast',
  b_captain: 'ac_st_captain', b_ironwarden: 'hn_st_ironwarden', b_lavabeast: 'ac_st_lavabeast', b_stareater: 'ac_st_stareater',
  b_rowell2: 'ac_st_rowell', b_lazaro: 'ac_st_lazaro', b_shade_star: 'ac_st_shade_star', b_ouroboros: 'bd_st_ouroboros',
  rm_jewel_hare: 'ft_st_jewel_hare', rm_gold_idol: 'hn_st_gold_idol', rm_treasure_crab: 'sh_st_treasure_crab', rm_star_whale: 'bd_st_star_whale',
  rm_clock_bird: 'ft_st_clock_bird', rm_ghost_teapot: 'ac_st_ghost_teapot', rm_volcano_turtle: 'sh_st_volcano_turtle', rm_prisma: 'w_staff_st_prisma',
  rm_bookworm: 'sh_st_bookworm', rm_dream_tapir: 'ac_st_dream_tapir',
  seabird_3: 'ac_st_thief_gull', rat_4: 'ac_st_rat_boss', mimic_4: 'ac_st_abyss_gem', fairy_4: 'hd_st_fairy_queen', doll_4: 'ac_st_lady_fan',
  lizardman_4: 'w_greatsword_st_stoneaxe', mummy_5: 'bd_st_royal_linen', wolf_5: 'w_dagger_st_wolfking', skeleton_5: 'ac_st_admiral',
  goblin_5: 'hd_st_goblin_king', imp_5: 'w_staff_st_strategist', eyeball_5: 'ac_st_heaven_eye', scribe_3: 'ac_st_librarian', demon_3: 'ac_st_demon_heart',
};
const STEAL_RATE = { mob: 32, rare: 16, boss: 16 };
const SUPER_EXTRA = new Set(['void_3', 'chaos_3', 'demon_3', 'book_3', 'paper_4']);

// ---------------------------------------------------------------- 今のデータを読む（判断のためだけ。書くのは元の文の書き直し）
function readOld() {
  const DB = {};
  for (const k of ['actions', 'monsters', 'lineages', 'encounters', 'troops', 'rareEncounters', 'pools', 'items', 'music']) DB[k] = {};
  const R = { DB, onData() {}, warn() {}, Gfx: null };
  const sb = { window: { RPG: R }, console };
  vm.createContext(sb);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), sb, { filename: f });
  return DB;
}

/** 系統の最後の段・5 段の系統 */
function lineageInfo(DB) {
  const last = new Set(), five = new Set();
  for (const id of Object.keys(DB.lineages)) {
    const st = DB.lineages[id].stages || [];
    if (!st.length) continue;
    last.add(st[st.length - 1].mon);
    if (st.length >= 5) five.add(st[st.length - 1].mon);
  }
  return { last, five };
}

// ---------------------------------------------------------------- 文の書き直し
const lit = (o) => {
  // { normal: { item: 'x', rate: 8 }, … } を元と同じ 1 行の書き方で
  const one = (v) => {
    if (v === null) return 'null';
    if (typeof v === 'string') return `'${v}'`;
    if (typeof v !== 'object') return String(v);
    const ks = Object.keys(v);
    if (!ks.length) return '{}';
    return '{ ' + ks.map((k) => `${k}: ${one(v[k])}`).join(', ') + ' }';
  };
  return one(o);
};

function rewriteDrops(line, id, kind, info, stats) {
  const m = line.match(/^(\s*)drops: (\{.*\}),\s*$/);
  if (!m) return line;
  let d;
  try { d = Function('"use strict"; return (' + m[2] + ');')(); } catch (e) { return line; }
  const out = {};
  for (const g of ['normal', 'rare', 'super', 'bonus']) {
    if (!d[g]) continue;
    const slot = Object.assign({}, d[g]);
    if (kind === 'mob') {
      if (g === 'rare' && !info.last.has(id)) { stats.rareCut++; continue; }
      if (g === 'super' && !(info.five.has(id) || SUPER_EXTRA.has(id))) { stats.superCut++; continue; }
    }
    if (slot.item) {
      const n = remapItem(slot.item);
      if (n !== slot.item) stats.remapped++;
      if (!n) { stats.lost.push(`${id}.${g} ${slot.item}`); continue; }
      slot.item = n;
    }
    out[g] = slot;
  }
  if (STEAL[id]) out.steal = { item: STEAL[id], rate: STEAL_RATE[kind] };
  return `${m[1]}drops: ${lit(out)},`;
}

function header(f) {
  return `// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/${f} から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）\n`;
}

function splitV2(text) {
  const blocks = [];
  const re = /^[ \t]*\/\/ @@V2-BEGIN[^\n]*\n[\s\S]*?^[ \t]*\/\/ @@V2-END[^\n]*\n/gm;
  let m;
  while ((m = re.exec(text))) blocks.push(m[0]);
  return blocks;
}

function port(f, DB, info, stats) {
  let text = fs.readFileSync(path.join(SRC, f), 'utf8');
  if (f === 'enemy_actions.js') text = text.replace(/R\.DB\.actions/g, 'R.DB.enemyActions');
  if (f === 'bosses_actions.js') text = text.replace(/R\.DB\.actions/g, 'R.DB.bossActions');
  if (/^monsters_/.test(f) || f === 'rare.js' || f === 'bosses.js') {
    const kind = f === 'rare.js' ? 'rare' : f === 'bosses.js' ? 'boss' : 'mob';
    const lines = text.split('\n');
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const hm = lines[i].match(/^    ([a-z][a-z0-9_]*): (?:rare\()?\{/);
      if (hm) cur = hm[1];
      if (/^\s*drops: \{.*\},\s*$/.test(lines[i]) && cur) lines[i] = rewriteDrops(lines[i], cur, kind, info, stats);
      else if (/^\s*drops: /.test(lines[i]) && cur) {
        // MID('i_seed_mp') / REGION(…) / DROPS(…) は品の id だけ付け替え、盗み専用は後ろに足す
        lines[i] = lines[i].replace(/'([a-z][a-z0-9_]*)'/g, (all, id) => { const n = remapItem(id); if (n !== id) stats.remapped++; return n ? `'${n}'` : all; });
        if (STEAL[cur] && !stats.stealLater.some(([ff, id]) => ff === f && id === cur)) stats.stealLater.push([f, cur]);
      }
    }
    text = lines.join('\n');
    // 付け替えの残り（コメントの中の旧 id は変えない。データの文字列だけ）
    text = text.replace(/'(w_spear_[a-z0-9_]+|w_axe_[a-z0-9_]+|i_seed_hp|i_seed_mp|i_dream_fruit)'/g, (all, id) => { const n = remapItem(id); return n ? `'${n}'` : all; });
  }
  if (f === 'troops.js') {
    // 旧の R.Gfx.has('bbg:…') の差し替え（P2 の背景）は v2 に無い（背景は BEAST の hd:bbg）。onData の中はそのまま動くが何もしない
    text = text.replace(/R\.Gfx && R\.Gfx\.has && R\.Gfx\.has\('bbg:' \+ id\)/g, "R.Hd && R.Hd.has && R.Hd.has('hd:bbg:' + id)");
  }
  // 盗み専用: DROPS()/MID()/REGION() で書く魔物（ボス・レア）は、登録の後で drops に足す
  const late = stats.stealLater.filter(([ff]) => ff === f);
  let add = '';
  if (late.length) {
    const kind = f === 'rare.js' ? 'rare' : 'boss';
    add += '  // port_mons.js: 盗み専用（STATS_REWORK §7.2、率は V2_PLAN §2.6.6）。倒しても落ちない（R.Mon.rollDrops は steal を見ない）\n';
    for (const [, id] of late) add += `  LIST.${id}.drops = Object.assign({}, LIST.${id}.drops, { steal: { item: '${STEAL[id]}', rate: ${STEAL_RATE[kind]} } });\n`;
  }
  if (f === 'bosses.js') {
    // v2: ボスは R.DB.monsters（戦闘の計算）と R.DB.bosses（K.boss、絵の hd:boss:<sprite>）の両方に。大きさは 'l'（お供は 'm'）
    add += "  // port_mons.js: v2 の形（K.monster の size、K.boss の登録）\n";
    add += "  for (const id in LIST) { const d = LIST[id]; if (!d.size) d.size = d.bossType === 'add' ? 'm' : 'l'; if (!R.DB.bosses[id]) R.DB.bosses[id] = d; }\n";
  }
  text = text.replace(/^(\/\/.*\n)/, (h) => header(f) + h);
  if (add) {
    const at = text.lastIndexOf('})(window.RPG);');
    // bosses.js / rare.js: LIST を DB に入れる行の後（同じ物を指すので後から足してよい）
    text = text.slice(0, at) + add + text.slice(at);
  }
  // 手で足した区画を戻す
  const dst = path.join(DST, f);
  const old = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : '';
  const blocks = splitV2(old);
  if (blocks.length) {
    const at = text.lastIndexOf('})(window.RPG);');
    text = text.slice(0, at) + blocks.join('') + text.slice(at);
  }
  return text;
}

function main() {
  const DB = readOld();
  const info = lineageInfo(DB);
  const stats = { rareCut: 0, superCut: 0, remapped: 0, lost: [], stealLater: [] };
  // 盗み専用の後回し（DROPS()/MID() の魔物）を先に数えるため 2 回まわす: 1 回目で stealLater を集める
  for (const f of FILES) port(f, DB, info, stats);
  const outs = {};
  const s2 = { rareCut: 0, superCut: 0, remapped: 0, lost: [], stealLater: stats.stealLater };
  for (const f of FILES) outs[f] = port(f, DB, info, s2);
  if (LIST) {
    const ids = new Set();
    for (const t of Object.values(outs)) for (const m of t.matchAll(/item: '([a-z][a-z0-9_]*)'/g)) ids.add(m[1]);
    for (const t of Object.values(outs)) for (const m of t.matchAll(/(?:MID|REGION|DROPS)\(([^)]*)\)/g)) for (const x of m[1].matchAll(/'([a-z][a-z0-9_]*)'/g)) ids.add(x[1]);
    for (const t of Object.values(outs)) for (const m of t.matchAll(/pool: '([a-z][a-z0-9_]*)'/g)) ids.add('pool:' + m[1]);
    console.log([...ids].sort().join('\n'));
    return;
  }
  let diff = 0;
  for (const f of FILES) {
    const dst = path.join(DST, f);
    const cur = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : null;
    if (cur === outs[f]) continue;
    diff++;
    if (CHECK) { console.log('differs:', f); continue; }
    fs.mkdirSync(DST, { recursive: true });
    fs.writeFileSync(dst, outs[f]);
    console.log('wrote', path.relative(ROOT, dst), crypto.createHash('sha256').update(outs[f]).digest('hex').slice(0, 12));
  }
  console.log(`port_mons: ${FILES.length} files, rare slots cut ${s2.rareCut}, super slots cut ${s2.superCut}, item ids remapped ${s2.remapped}, ` +
    `steal-only ${Object.keys(STEAL).length}, slots lost ${s2.lost.length}${s2.lost.length ? ' (' + s2.lost.join(', ') + ')' : ''}`);
  if (CHECK && diff) process.exitCode = 1;
}

module.exports = { remapItem, STEAL, STEAL_RATE, SUPER_EXTRA, FILES };
if (require.main === module) main();
