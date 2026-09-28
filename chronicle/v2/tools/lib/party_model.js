// 模型のパーティ（RULES。v2 の sim が共有する。V2_PLAN §1.2・§2.8、STATS_REWORK §4.17.1・§8.4・§9.5）。
// 今の木の tools/lib/party_model.js から移して直した: 武器枠 1 つ・5 系統・gl（レベルなし）・能力値 0〜25。
// gl と熟練度は **ゲームの中の R.Growth.glAt・R.Rules.profAt を呼ぶだけ**（dev.html のフィクスチャと sim が同じ値を使う）。
//
//   const PM = require('./lib/party_model');
//   PM.build(R, {tier, members:['hero', …], heroType, fav, build:'phys'|'magic'|'balance', gear:'none'|'shop'|'real'|'rare'|'super',
//                kind?('party'|'mid'|'boss'|'prologue'…、gl の段), gl?, rows?, learned?, rareSlots?, superSlots?})
//     → {party:[CharState], inv, notes, spec}
//   PM.glAt(R, tier, kind) / PM.profAt(R, tier, kind)   ゲームの関数そのもの
//   PM.withGame(R, {tier, party?, reserve?, items?}, fn)  仮の R.Game で fn を動かして元に戻す
//   PM.runBattle(R, o) → R.BattleCore.simulate(o) ＋ hpLostPct・downs・mpUsedPct（BATTLE の engine が無ければ null）
//   PM.afterBattle(R, party, result)                      戦闘のあとの回復（R.Party.afterBattle）
//   PM.standard(R, tier, o)   標準のパーティ（§8.4: 主人公 戦士・剣 ＋ bartolo・marta・sylvain）
//   PM.COMBOS / PM.HERO_VARIANTS / PM.COMPANIONS / PM.BUILD_SETS
'use strict';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const clone = (o) => JSON.parse(JSON.stringify(o));
const RB = [1, 1, 3, 3, 5, 5, 7, 7, 9, 9];                 // ティア → レアの帯
const UPGRADE_ORDER = ['weapon1', 'body', 'head', 'shield', 'hands', 'feet', 'acc1', 'acc2'];
const SLOT_GROUP = { weapon1: 'weapon', shield: 'shield', head: 'head', body: 'body', hands: 'hands', feet: 'feet', acc1: 'acc', acc2: 'acc' };
const WSTAT = { sword: 'str', greatsword: 'str', dagger: 'dex', bow: 'dex', staff: 'int' };
// §8.13.1 の T8 の一式（STATS_REWORK §3.1・§8.2: 武器 1 本の 8 枠。A29 で大斧 → 大剣）
const BUILD_SETS = {
  int: {
    N: ['w_staff_8', 'sh_book_8', 'hd_hood_8', 'bd_robe_8', 'hn_longglove_8', 'ft_sandal_8', 'ac_int_8', 'ac_int_8'],
    R7: ['w_staff_r7', 'sh_r7_int', 'hd_r7_int', 'bd_r7_int', 'hn_r7_int', 'ft_r7_int', 'ac_r7_int', 'ac_r7_int'],
    R9: ['w_staff_r9', 'sh_r9_int', 'hd_r9_int', 'bd_r9_int', 'hn_r9_int', 'ft_r9_int', 'ac_r9_int', 'ac_r9_int'],
    S: ['w_staff_sr_cosmos', 'sh_sr_blank', 'hd_sr_dusk', 'bd_sr_starry', 'hn_sr_words', 'ft_sr_cloud', 'ac_sr_owl', 'ac_sr_ink'],
  },
  str: {
    N: ['w_sword_8', 'sh_buckler_8', 'hd_helm_8', 'bd_mail_8', 'hn_gauntlet_8', 'ft_greave_8', 'ac_str_8', 'ac_str_8'],
    R7: ['w_sword_r7', 'sh_r7_str', 'hd_r7_str', 'bd_r7_str', 'hn_r7_str', 'ft_r7_str', 'ac_r7_str', 'ac_r7_str'],
    R9: ['w_sword_r9', 'sh_r9_str', 'hd_r9_str', 'bd_r9_str', 'hn_r9_str', 'ft_r9_str', 'ac_r9_str', 'ac_r9_str'],
    S: ['w_sword_sr_hegemon', 'sh_sr_steadfast', 'hd_sr_oni', 'bd_sr_dragonhide', 'hn_sr_mighty', 'ft_sr_quake', 'ac_sr_beastheart', 'ac_sr_bloodoath'],
  },
  dex: {
    N: ['w_dagger_8', 'sh_shield_8', 'hd_cap_8', 'bd_vest_8', 'hn_glove_8', 'ft_boots_8', 'ac_dex_8', 'ac_dex_8'],
    R7: ['w_dagger_r7', 'sh_r7_dex', 'hd_r7_dex', 'bd_r7_dex', 'hn_r7_dex', 'ft_r7_dex', 'ac_r7_dex', 'ac_r7_dex'],
    R9: ['w_dagger_r9', 'sh_r9_dex', 'hd_r9_dex', 'bd_r9_dex', 'hn_r9_dex', 'ft_r9_dex', 'ac_r9_dex', 'ac_r9_dex'],
    S: ['w_dagger_sr_moonfang', 'sh_sr_phantom', 'hd_sr_heaveneye', 'bd_sr_shadow', 'hn_sr_hundred', 'ft_sr_whirl', 'ac_sr_eagle', 'ac_sr_needle'],
  },
};
const BUILD_SLOTS = ['weapon1', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];

function glAt(R, tier, kind) { return R.Growth.glAt(tier, kind); }
function profAt(R, tier, kind) { return R.Rules.profAt(tier, kind); }

/** 仮の R.Game で fn を動かす（戻り値を返し、元の R.Game に戻す） */
function withGame(R, o, fn) {
  o = o || {};
  const saved = R.Game;
  try {
    R.State.newGame({ seed: o.seed != null ? o.seed : 1 });
    const g = R.Game;
    g.tier = clamp(o.tier | 0, 0, 9);
    for (const c of o.party || []) { g.chars[c.id] = c; g.party.push(c.id); g.joined.push(c.id); }
    for (const c of o.reserve || []) { g.chars[c.id] = c; g.reserve.push(c.id); g.joined.push(c.id); }
    if (o.items) g.items = o.items;
    return fn(g);
  } finally { R.Game = saved; }
}

// ------------------------------------------------------------ 品の選び方
function index(R) {
  if (R.__pmIndex) return R.__pmIndex;
  const by = {};
  for (const id of Object.keys(R.DB.items)) {
    const it = R.DB.items[id];
    if (!it || !R.Rules.EQUIP_GROUPS.includes(it.slot)) continue;
    (by[it.slot] = by[it.slot] || []).push(id);
  }
  return (R.__pmIndex = by);
}
/** その人の「伸ばす能力値」: 武器の系統から（術師は知力） */
function buildStat(R, c, build) {
  if (build === 'magic') return 'int';
  const w = R.Rules.weaponType(c);
  return WSTAT[w] || 'str';
}
function roleOf(R, c) { const d = c && R.DB.companions && R.DB.companions[c.id]; return (d && d.role) || null; }
/** 枠 slot に、ティア T・等級 grade の品で、stat の印（units）を持つ物を 1 つ（無ければ同じ等級・ティアの何か、無ければ null） */
function pick(R, c, slot, T, grade, stat, wtype) {
  const SK = { str: 's', vit: 'v', dex: 'd', agi: 'a', int: 'i', mnd: 'm' };
  const list = (index(R)[SLOT_GROUP[slot]] || []).map((id) => [id, R.DB.items[id]]).filter(([id, it]) => {
    if (it.quirk || it.src === 'steal' || it.src === 'unique' || it.src === 'reward' || it.src === 'relic') return false;
    if ((it.grade || 'normal') !== grade) return false;
    if (grade === 'rare' ? it.tier !== RB[T] : grade === 'super' ? it.tier > T : it.tier !== T) return false;
    if (slot === 'weapon1' && wtype && it.wtype !== wtype) return false;
    if (grade === 'normal' && it.src !== 'shop') return false;
    return R.Rules.canEquip(c, id, slot);
  });
  if (!list.length) return null;
  // 回復役（role 'healer'）の武器は回復の杖（healPct）を選ぶ。持ち主「見習いの杖と祈りの杖、効果同じじゃねえかｗ」で杖の 2 系列を
  // 攻撃の術（w_staff、magicPct）と回復の術（w_staff_prayer、healPct）に分けたので、町医者が攻撃の杖を持つ模型にしない
  const healer = slot === 'weapon1' && roleOf(R, c) === 'healer';
  const sc = ([, it]) => (String(it.units || '').includes(SK[stat]) ? 10 : 0) + (it.tier || 0) + (slot === 'acc1' || slot === 'acc2' ? (it.line === 'ac_' + stat ? 20 : 0) : 0) +
    (healer && it.mods && it.mods.healPct > 0 ? 20 : 0);
  list.sort((a, b) => sc(b) - sc(a) || (b[1].sort || 0) - (a[1].sort || 0));
  return list[0][0];
}
function equipMember(R, c, o, notes) {
  const T = clamp(o.tier | 0, 0, 9);
  const stat = buildStat(R, c, o.build);
  const wtype = R.Rules.weaponType(c) === 'fist' ? null : R.Rules.weaponType(c);
  const gear = o.gear || 'shop';
  // T8 の決まった一式
  if (T === 8 && o.buildSets !== false && BUILD_SETS[stat] && (gear === 'shop' || gear === 'rare' || gear === 'super' || gear === 'none')) {
    const set = BUILD_SETS[stat][gear === 'super' ? 'S' : gear === 'rare' ? 'R9' : 'N'];
    const w = R.DB.items[set[0]];
    if (w && (!wtype || w.wtype === wtype || o.buildSets === true)) {
      BUILD_SLOTS.forEach((s, i) => { if (R.DB.items[set[i]]) c.equip[s] = set[i]; else notes.push('missing set item ' + set[i]); });
      if (R.Rules.hasTwoHanded(c)) c.equip.shield = null;
      return;
    }
  }
  const baseGrade = gear === 'rare' ? 'rare' : gear === 'super' ? 'super' : 'normal';
  for (const s of UPGRADE_ORDER) {
    if (s === 'shield' && R.Rules.hasTwoHanded(c)) { c.equip.shield = null; continue; }
    const id = pick(R, c, s, T, baseGrade, stat, wtype) || pick(R, c, s, T, 'normal', stat, wtype);
    if (id) c.equip[s] = id;
  }
  // 'real' = 通常品 ＋ 3 枠をレアの帯へ、rareSlots / superSlots で上乗せ
  const up = (n, grade) => {
    let k = 0;
    for (const s of UPGRADE_ORDER) {
      if (k >= n) break;
      if (s === 'shield' && R.Rules.hasTwoHanded(c)) continue;
      const id = pick(R, c, s, T, grade, stat, wtype);
      if (id) { c.equip[s] = id; k++; }
    }
  };
  if (gear === 'real') up(3, 'rare');
  if (o.rareSlots) up(o.rareSlots, 'rare');
  if (o.superSlots) up(o.superSlots, 'super');
  if (gear === 'none') for (const s of BUILD_SLOTS) if (/^ac_/.test(c.equip[s] || '')) c.equip[s] = null;
  if (R.Rules.hasTwoHanded(c)) c.equip.shield = null;
}
/** その人がティア T で覚えている見込みの技・術: EXPECT(T) 個（今の武器の系統の技 → 得意の属性の術、glim.lv の順） */
function learnFor(R, c, o) {
  const T = clamp(o.tier | 0, 0, 9);
  const n = o.learned != null ? o.learned : R.Rules.K.GLIM.expect[T];
  const w = R.Rules.weaponType(c);
  const L = R.Rules.aptLetters(c);
  const els = R.Rules.ELEMENTS.filter((e) => /[SA]/.test(L.e[e]));
  const techs = Object.keys(R.DB.techs).filter((id) => R.DB.techs[id].wtype === w && R.DB.techs[id].glim && R.DB.techs[id].glim.lv <= T + 2).sort((a, b) => R.DB.techs[a].glim.lv - R.DB.techs[b].glim.lv);
  const spells = Object.keys(R.DB.spells).filter((id) => { const s = R.DB.spells[id]; return s.elements.length === 1 && s.elements.every((e) => els.includes(e)) && s.glim.lv <= T + 2; })
    .sort((a, b) => R.DB.spells[a].glim.lv - R.DB.spells[b].glim.lv);
  const want = [];
  let i = 0, j = 0;
  while (want.length < n && (i < techs.length || j < spells.length)) {
    if (i < techs.length) want.push(techs[i++]);
    if (want.length < n && j < spells.length) want.push(spells[j++]);
  }
  for (const id of want) {
    if (R.DB.techs[id]) { if (!c.techs.includes(id)) c.techs.push(id); } else if (!c.spells.includes(id)) c.spells.push(id);
  }
}

/** 模型のパーティを作る */
function build(R, o) {
  o = o || {};
  const notes = [];
  const T = clamp(o.tier | 0, 0, 9);
  const members = o.members || ['hero'];
  const party = [];
  withGame(R, { tier: T }, (g) => {
    for (const id of members) {
      const c = id === 'hero'
        ? R.Party.makeChar('hero', { hero: { type: o.heroType || 'warrior', sex: o.sex || 'm', name: 'アルン', fav: o.fav || 'sword' }, tier: T, joinFrom: 'start' })
        : R.Party.makeChar(id, { tier: T, joinFrom: 'tavern', catchUp: false });
      g.chars[c.id] = c;
      party.push(c);
    }
    for (const c of party) {
      c.gl = o.gl != null ? o.gl : glAt(R, T, o.kind || 'party');
      equipMember(R, c, Object.assign({}, o, { tier: T }), notes);
      // 熟練度: 主な武器 = profAt(T)、ほかの系統は半分、得意の属性は 0.8（SYSTEMS_REWORK §4.3）
      const main = R.Rules.weaponType(c), P = profAt(R, T, 'party');
      for (const w of R.Rules.WTYPES) c.wprof[w] = Math.max(c.wprof[w] || 0, w === main ? P : Math.round(P / 2 * (/[SA]/.test(R.Rules.aptLetter(c, 'w', w)) ? 1 : 0.5)));
      for (const e of R.Rules.ELEMENTS) c.eprof[e] = Math.max(c.eprof[e] || 0, /[SA]/.test(R.Rules.aptLetter(c, 'e', e)) ? Math.round(P * 0.8) : Math.round(P * 0.2));
      learnFor(R, c, Object.assign({}, o, { tier: T }));
      if (o.rows && o.rows[c.id]) c.row = o.rows[c.id];
      R.Rules.fullRestore(c);
    }
  });
  return { party, inv: standardInv(R), notes, spec: o };
}
function standardInv(R) {
  const inv = {};
  for (const [id, n] of [['i_salve', 6], ['i_potion', 3], ['i_ether', 2], ['i_revive', 2], ['i_antidote', 2], ['i_waker', 1]]) if (R.DB.items[id]) inv[id] = n;
  return inv;
}
/** 標準のパーティ（STATS_REWORK §8.4: ブリギッタが弓で後列に行くので、前列の 2 人目は bartolo） */
function standard(R, tier, o) {
  return build(R, Object.assign({ tier, members: ['hero', 'bartolo', 'marta', 'sylvain'], heroType: 'warrior', fav: 'sword',
    rows: { hero: 'front', bartolo: 'front', marta: 'back', sylvain: 'back' }, gear: 'shop' }, o || {}));
}
function afterBattle(R, party, result) {
  withGame(R, { party }, () => R.Party.afterBattle(result));
}
/** 1 戦（BATTLE の R.BattleCore.simulate）。o = {party, inv, troop | zone | mons, tier, seed, …}。engine が無ければ null */
function runBattle(R, o) {
  if (!R.BattleCore || !R.BattleCore.simulate || (R.Stubs.installed.BattleCore || []).includes('simulate')) return null;
  const party0 = o.party;
  const st0 = party0.map((c) => R.Rules.stats(c));
  const hp0 = party0.map((c) => c.hp), mp0 = party0.map((c) => c.mp);
  const r = R.BattleCore.simulate(o);
  if (!r) return null;
  const end = r.party || party0;
  let hpMax = 0, hpLost = 0, mpMax = 0, mpUsed = 0, downs = 0;
  party0.forEach((c, i) => {
    const e = end[i] || c;
    hpMax += st0[i].maxHp; hpLost += Math.max(0, hp0[i] - Math.max(0, e.hp || 0));
    mpMax += st0[i].maxMp; mpUsed += Math.max(0, mp0[i] - (e.mp || 0));
    if (!((e.hp || 0) > 0)) downs++;
  });
  return Object.assign(r, { hpLostPct: r.hpLossPct != null ? r.hpLossPct : hpMax ? 100 * hpLost / hpMax : 0, mpUsedPct: mpMax ? 100 * mpUsed / mpMax : 0, downs, anyDown: downs > 0 });
}

// §5.4.3 の必ず試す 12 組（A29: 斧・槍の主人公は大剣・剣に、ブリギッタは弓）
const COMBOS = [
  { no: 1, name: '標準', heroType: 'warrior', fav: 'sword', members: ['bartolo', 'marta', 'sylvain'] },
  { no: 2, name: '全員術師', heroType: 'mage', fav: 'fire', members: ['teo', 'ilse', 'morga'] },
  { no: 3, name: '回復なしの前衛', heroType: 'warrior', fav: 'greatsword', members: ['hagen', 'rouga', 'titta'] },
  { no: 4, name: '全員後列', heroType: 'ranger', fav: 'bow', members: ['brigitta', 'sylvain', 'zafira'] },
  { no: 5, name: '重装の壁', heroType: 'warrior', fav: 'greatsword', members: ['selma', 'dokka', 'bartolo'] },
  { no: 6, name: '回復だらけ', heroType: 'mage', fav: 'light', members: ['marta', 'noela', 'basil'] },
  { no: 7, name: '万能型', heroType: 'wanderer', fav: 'staff', members: ['viola', 'ferno', 'belladonna'] },
  { no: 8, name: '年長組', heroType: 'spellblade', fav: 'earth', members: ['boden', 'bartolo', 'morga'] },
  { no: 9, name: '速さ', heroType: 'ranger', fav: 'dagger', members: ['rouga', 'titta', 'zafira'] },
  { no: 10, name: '斬るだけ', heroType: 'warrior', fav: 'greatsword', members: ['hagen', 'viola', 'shigure'] },
  { no: 11, name: '属性が1つだけ', heroType: 'warrior', fav: 'sword', members: ['selma', 'basil', 'bartolo'] },
  { no: 12, name: 'レア狙い', heroType: 'wanderer', fav: 'dark', members: ['ferno', 'noela', 'boden'] },
];
const HERO_VARIANTS = [
  { heroType: 'warrior', fav: 'sword' }, { heroType: 'warrior', fav: 'greatsword' }, { heroType: 'ranger', fav: 'bow' },
  { heroType: 'mage', fav: 'fire' }, { heroType: 'spellblade', fav: 'wind' }, { heroType: 'wanderer', fav: 'staff' },
];
const COMPANIONS = ['selma', 'hagen', 'dokka', 'basil', 'bartolo', 'viola', 'shigure', 'rouga', 'titta', 'brigitta', 'sylvain', 'zafira', 'ferno', 'belladonna', 'boden', 'teo', 'ilse', 'morga', 'marta', 'noela'];

module.exports = { build, standard, glAt, profAt, withGame, afterBattle, runBattle, COMBOS, HERO_VARIANTS, COMPANIONS, BUILD_SETS, BUILD_SLOTS, RB };
