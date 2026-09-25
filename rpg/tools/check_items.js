#!/usr/bin/env node
// Validate the item catalogue (src/data/items.js) and shops (src/data/shops.js),
// then print per-band curves so balance can be eyeballed.
//
//   node tools/check_items.js            validate + tables
//   node tools/check_items.js --quiet    validate only (exit 1 on errors)
//
// Checks: schema per type, required ids, unique/short/original names, use & effect
// shapes, mods keys, shop ids/contents/bands, R.ITEM_TIERS / R.ITEM_RARE coverage,
// monotonic tiers per weapon/armor type, and (when other modules are loaded) every
// item id referenced by monsters, troops, maps and events.
'use strict';
const load = require('./lib/load');
const R = load({ quiet: true });
const I = R.DB.items;
const quiet = process.argv.includes('--quiet');

const errors = [], warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ---------------------------------------------------------------- constants
const TYPES = ['consumable', 'weapon', 'shield', 'head', 'body', 'acc', 'key'];
const WTYPES = ['sword', 'knife', 'axe', 'spear', 'staff', 'rod', 'bow', 'claw', 'katana', 'harp'];
const ATYPE_SLOT = { helm: 'head', hat: 'head', heavy: 'body', light: 'body', robe: 'body', shield: 'shield' };
const ELEMENTS = ['fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark'];
const STATUSES = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death', 'regen'];
const STATS = ['str', 'vit', 'agi', 'int', 'mnd', 'luk', 'hp', 'mp'];
const TARGETS = ['enemy', 'enemies', 'group', 'random', 'ally', 'allies', 'self', 'ally_dead', 'ally_any'];
const EFFECTS = ['damage', 'heal', 'healMp', 'revive', 'cure', 'status', 'buff', 'dispel', 'steal', 'scan', 'escape', 'regen', 'grow', 'teleport', 'exit', 'repel', 'special'];
const FIELD_ONLY = ['teleport', 'exit', 'repel'];
const BUFF_STATS = ['atk', 'def', 'mag', 'mdef', 'agi'];
const NUM_MODS = ['hpPct', 'mpPct', 'strPct', 'vitPct', 'agiPct', 'intPct', 'mndPct', 'lukPct', 'atk', 'def', 'mag', 'mdef', 'hit', 'eva', 'crit',
  'atkPct', 'defPct', 'magPct', 'mdefPct', 'physPct', 'magicPct', 'healPct', 'itemPct', 'mpCostPct', 'critPct', 'escapePct', 'preemptPct',
  'unarmed', 'expPct', 'jpPct', 'goldPct', 'dropPct', 'rarePct', 'stealPct', 'encounterPct', 'walkHeal'];
const BOOL_MODS = ['regen', 'twoSwords', 'noFloorDamage', 'treasureSense'];
const REQUIRED = ['herb', 'copper_sword', 'oak_staff', 'wooden_rod', 'traveler_clothes', 'crest_wind', 'crest_water', 'crest_earth',
  'crest_fire', 'crest_star', 'light_crest', 'silver_key', 'gold_key', 'wing', 'escape_rope', 'holy_water', 'revive_feather'];
const START_GEAR = ['copper_sword', 'oak_staff', 'wooden_rod', 'traveler_clothes'];
const LOCS = ['regnas', 'milt', 'porta', 'elfin', 'salva', 'frost', 'arcana', 'edge_shrine'];
const LOC_BAND = { regnas: 1, milt: 1, porta: 2, elfin: 3, salva: 3, frost: 4, arcana: 5, edge_shrine: 6 };
const BAND_LV = { 1: [1, 5], 2: [6, 11], 3: [12, 18], 4: [19, 26], 5: [27, 32], 6: [33, 40] };
// names that belong to Dragon Quest / Final Fantasy (must never appear). Kana spellings from the old
// all-kana era plus the kanji forms of the coined/iconic ones. Plain generic words (鉄の鎧, 薬草, 銀の盾 …)
// are fine — see STYLE_JA.md (固有名詞の権利).
const FORBIDDEN = ['ひのきのぼう', 'こんぼう', 'どうのつるぎ', 'はがねのつるぎ', 'てつのつるぎ', 'はじゃのつるぎ', 'ロトの', 'てんくうの',
  'キメラのつばさ', 'せいすい', 'せかいじゅ', 'ちからのたね', 'すばやさのたね', 'まもりのたね', 'かしこさのたね', 'いのちのきのみ',
  'ふしぎなきのみ', 'ラックのたね', 'どくけしそう', 'まんげつそう', 'かわのよろい', 'くさりかたびら', 'てつのよろい', 'ぬののふく',
  'たびびとのふく', 'かわのたて', 'うろこのたて', 'てつのたて', 'みかがみのたて', 'かわのぼうし', 'てつかぶと', 'ふしぎなぼうし',
  'ほしふるうでわ', 'いのりのゆびわ', 'しあわせのくつ', 'はやぶさのけん', 'ドラゴンキラー', 'ゾンビキラー', 'ぎんのかみかざり',
  'エリクサー', 'エーテル', 'フェニックスの尾', 'ポーション', 'ハイポーション', 'ばんのうやく', 'まんのうやく', 'リボン', 'エクスカリバー',
  'ラグナロク', 'マサムネ', 'ムラマサ', 'アルテマ', 'ライトブリンガー', 'ミスリル', 'ディフェンダー', 'アイスブランド', 'フレイムタン',
  'ルーンブレイド', 'ホイミ', 'メラ', 'ギラ', 'ヒャド', 'ルーラ', 'リレミト', 'スライム', 'ケアル', 'ファイガ', 'エスナ', 'レイズ', 'ゴールドカード',
  'イージス', 'きせきのつるぎ', 'ぎんのたてごと', 'どくがのナイフ', 'ぶとうぎ', 'まどうしのつえ', 'かしのつえ', 'ドラゴンメイル', 'みずのはごろも',
  // kanji forms
  'ひのきの棒', '檜の棒', '破邪の剣', '天空の', 'キメラの翼', '世界樹', '力の種', '素早さの種', '守りの種', '賢さの種', '命の木の実',
  '不思議な木の実', 'ラックの種', '毒消し草', '満月草', '水鏡の盾', '不思議な帽子', '星降る腕輪', '祈りの指輪', '幸せの靴', '隼の剣',
  '奇跡の剣', '銀の竪琴', '毒蛾のナイフ', '武闘着', '魔道士の杖', '樫の杖', '水の羽衣', '万能薬', '光の玉', 'ラーの鏡', '源氏の',
  'エルメスの靴', '金の針', '乙女のキッス', 'やまびこ草', '打ち出の小槌', 'うちでの小槌', '魔道士'];
// hero names are chosen by the player: text must use {yuki} {non} {metem} {leader}
const HERO_NAMES = /ユウキ|メテム|(^|[^ァ-ヶー])ノン/;

const width = (s) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x80 ? 0.5 : 1), 0);
// description boxes: shop 220px, item/equip menus 226px, battle help one line of 220px. DotGothic16 at
// 32/3 px measures 11px per full-width character in the browser, so a line holds 20 units.
const LINE_UNITS = 220 / 11;
/** lines R.Gfx.wrap would produce (char wrap + kinsoku), using the unit widths above */
function wrapLines(str, units) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && width(line + ch) > units) {
        if ('、。」』）！？…ー'.includes(ch)) { line += ch; continue; }
        out.push(line); line = ch === ' ' || ch === '　' ? '' : ch;
      } else line += ch;
    }
    out.push(line);
  }
  return out;
}
// DQ-style inter-phrase space: a half-width space next to Japanese text, or a full-width space that
// does not follow ！/？ (STYLE_JA.md allows exactly that one)
const JA = '[\\u3000-\\u30ff\\u4e00-\\u9fff\\uff01-\\uff5e]';
const DQ_SPACE = new RegExp(`${JA} | ${JA}|(^|[^！？])\u3000`);
const KANJI = /[\u4e00-\u9fff]/;
const isInt = (v) => Number.isInteger(v);

// ------------------------------------------------------------- per item
function checkMods(id, mods) {
  if (!mods) return;
  for (const k in mods) {
    const v = mods[k];
    if (NUM_MODS.includes(k)) { if (typeof v !== 'number') err(`${id}: mods.${k} must be a number`); }
    else if (BOOL_MODS.includes(k)) { if (v !== true) err(`${id}: mods.${k} must be true`); }
    else if (k === 'statusImmune') { if (!Array.isArray(v) || v.some((s) => !STATUSES.includes(s))) err(`${id}: bad statusImmune ${v}`); }
    else if (k === 'elemResist' || k === 'elemBoost') {
      for (const e in v) if (!ELEMENTS.includes(e) || typeof v[e] !== 'number') err(`${id}: bad ${k}.${e}`);
    } else if (k === 'startBuffs') {
      for (const s in v) if (!BUFF_STATS.includes(s) || !isInt(v[s])) err(`${id}: bad startBuffs.${s}`);
    } else if (k === 'equip') { if (!Array.isArray(v)) err(`${id}: mods.equip must be a list`); }
    else err(`${id}: unknown mod '${k}'`);
  }
}

function checkUse(id, use) {
  if (!use || typeof use !== 'object') return err(`${id}: consumable without use`);
  if (!TARGETS.includes(use.target)) err(`${id}: bad use.target ${use.target}`);
  if (typeof use.battle !== 'boolean' || typeof use.field !== 'boolean') err(`${id}: use.battle/field must be booleans`);
  if (!use.battle && !use.field) err(`${id}: usable nowhere`);
  if (!use.fx || typeof use.fx !== 'string') err(`${id}: use.fx missing`);
  if (!Array.isArray(use.effects) || !use.effects.length) return err(`${id}: use.effects empty`);
  const enemyTarget = ['enemy', 'enemies', 'group', 'random'].includes(use.target);
  for (const e of use.effects) {
    if (!EFFECTS.includes(e.type)) { err(`${id}: unknown effect ${e.type}`); continue; }
    if (FIELD_ONLY.includes(e.type) && use.battle) err(`${id}: ${e.type} is field-only`);
    switch (e.type) {
      case 'damage':
        if (!['phys', 'magic', 'fixed', 'percent', 'breath'].includes(e.formula)) err(`${id}: bad damage formula`);
        if (typeof e.power !== 'number') err(`${id}: damage without power`);
        if (e.element && !ELEMENTS.includes(e.element)) err(`${id}: bad element ${e.element}`);
        if (!enemyTarget) err(`${id}: damage item must target enemies`);
        break;
      case 'heal': if (typeof e.power !== 'number' && typeof e.pct !== 'number') err(`${id}: heal needs power or pct`); break;
      case 'healMp': if (typeof e.power !== 'number') err(`${id}: healMp needs power`); break;
      case 'revive': if (!(e.pct > 0 && e.pct <= 1)) err(`${id}: revive pct`); if (use.target !== 'ally_dead' && use.target !== 'ally_any') err(`${id}: revive target`); break;
      case 'cure': if (e.statuses !== 'all' && (!Array.isArray(e.statuses) || e.statuses.some((s) => !STATUSES.includes(s)))) err(`${id}: bad cure list`); break;
      case 'status': if (!STATUSES.includes(e.status) || !(e.chance > 0 && e.chance <= 1)) err(`${id}: bad status effect`); break;
      case 'buff': if (!BUFF_STATS.includes(e.stat) || !isInt(e.stages)) err(`${id}: bad buff`); break;
      case 'grow': if (!STATS.includes(e.stat) || !(e.n > 0)) err(`${id}: bad grow`); break;
      case 'repel': if (!(e.steps > 0)) err(`${id}: repel steps`); break;
      case 'special': warn(`${id}: uses 'special' effect`); break;
    }
  }
}

const names = {};
for (const id in I) {
  const it = I[id];
  if (!/^[a-z][a-z0-9_]*$/.test(id)) err(`${id}: id must be snake_case`);
  if (!TYPES.includes(it.type)) { err(`${id}: bad type ${it.type}`); continue; }
  if (!it.name || typeof it.name !== 'string') err(`${id}: missing name`);
  else {
    if (names[it.name]) err(`${id}: duplicate name ${it.name} (also ${names[it.name]})`);
    names[it.name] = id;
    if (width(it.name) > 9) err(`${id}: name too wide (${it.name}, ${width(it.name)} > 9)`);
    if (/[ \u3000]/.test(it.name)) err(`${id}: name '${it.name}' contains a space`);
    if (HERO_NAMES.test(it.name)) err(`${id}: name '${it.name}' hard-codes a hero name`);
    for (const f of FORBIDDEN) if (it.name.includes(f)) err(`${id}: name '${it.name}' contains forbidden '${f}'`);
  }
  if (!it.desc || typeof it.desc !== 'string') err(`${id}: missing desc`);
  else {
    // menus show two lines of description (the shop's third line is the gear summary)
    const lines = wrapLines(it.desc, LINE_UNITS);
    if (lines.length > 2) err(`${id}: desc needs ${lines.length} lines (max 2 at 220px): ${it.desc}`);
    for (const l of lines) if (width(l) > LINE_UNITS) err(`${id}: desc line '${l}' is wider than the box (kinsoku overflow)`);
    // a desc that wraps on its own breaks mid-word: put an explicit \n at a phrase boundary
    if (lines.length > 1 && !it.desc.includes('\n')) warn(`${id}: desc wraps mid-phrase, add a \\n: ${it.desc}`);
    // battle item help is one line; longer text gets squeezed
    if (it.type === 'consumable' && it.use && it.use.battle && width(it.desc) > LINE_UNITS)
      warn(`${id}: battle help squeezed (${width(it.desc)} > ${LINE_UNITS.toFixed(1)} units): ${it.desc}`);
    if (DQ_SPACE.test(it.desc)) err(`${id}: DQ-style space in desc: '${it.desc}'`);
    if (HERO_NAMES.test(it.desc)) err(`${id}: desc hard-codes a hero name (use {yuki} {non} {metem} {leader})`);
    if (!KANJI.test(it.desc)) warn(`${id}: desc has no kanji (old all-kana style?): ${it.desc}`);
  }
  if (!isInt(it.price) || it.price < 0) err(`${id}: bad price`);
  if (!(it.band >= 0 && it.band <= 6)) err(`${id}: band must be 0..6`);
  if (!isInt(it.sort)) err(`${id}: missing sort`);
  if (it.stats) for (const k in it.stats) if (!STATS.includes(k) || typeof it.stats[k] !== 'number') err(`${id}: bad stats.${k}`);
  checkMods(id, it.mods);
  if (it.only && (!Array.isArray(it.only) || it.only.some((c) => !R.DB.chars[c]))) err(`${id}: bad only`);
  switch (it.type) {
    case 'weapon':
      if (!WTYPES.includes(it.wtype)) err(`${id}: bad wtype ${it.wtype}`);
      if (!(it.atk > 0)) err(`${id}: weapon atk`);
      if (it.element && !ELEMENTS.includes(it.element)) err(`${id}: bad element`);
      if (it.onHit && (!STATUSES.includes(it.onHit.status) || !(it.onHit.chance > 0 && it.onHit.chance < 1))) err(`${id}: bad onHit`);
      if (it.wtype === 'bow' && !it.twoHanded) err(`${id}: bows are two-handed`);
      if (it.def || it.atype) err(`${id}: weapon with armor fields`);
      break;
    case 'shield': case 'head': case 'body':
      if (ATYPE_SLOT[it.atype] !== it.type) err(`${id}: atype ${it.atype} does not fit type ${it.type}`);
      if (!(it.def > 0)) err(`${id}: armor def`);
      if (it.atk || it.wtype) err(`${id}: armor with weapon fields`);
      break;
    case 'acc':
      if (!it.stats && !it.mods && !it.def) err(`${id}: accessory does nothing`);
      break;
    case 'consumable': checkUse(id, it.use); break;
    case 'key': if (it.price !== 0) err(`${id}: key items cost 0`); break;
  }
  if (it.type !== 'key' && it.type !== 'consumable' && !it.rare && !(it.price > 0)) err(`${id}: buyable equipment needs a price`);
  if (it.type === 'consumable' && !it.rare && !(it.price > 0)) err(`${id}: shop consumable needs a price`);
}
for (const id of REQUIRED) if (!I[id]) err(`required item missing: ${id}`);
if (I.herb && I.herb.name !== '薬草') err('herb must be named 薬草');
for (const c of Object.values(R.DB.chars)) for (const s in c.startEquip || {}) if (!I[c.startEquip[s]]) err(`start gear ${c.startEquip[s]} missing`);

// ------------------------------------------------------------------- shops
const S = R.DB.shops;
const sold = {}; // id -> earliest band
for (const loc of LOCS) for (const kind of ['item', 'weapon', 'armor']) {
  const sid = `${loc}_${kind}`;
  const shop = S[sid];
  if (!shop) { err(`shop missing: ${sid}`); continue; }
  if (!Array.isArray(shop.items) || !shop.items.length) { err(`${sid}: empty`); continue; }
  if (shop.items.length > 13) warn(`${sid}: ${shop.items.length} items (long list)`);
  const seen = new Set();
  for (const id of shop.items) {
    const it = I[id];
    if (!it) { err(`${sid}: unknown item ${id}`); continue; }
    if (seen.has(id)) err(`${sid}: duplicate ${id}`);
    seen.add(id);
    if (it.rare) err(`${sid}: sells rare item ${id}`);
    if (it.type === 'key' || !(it.price > 0)) err(`${sid}: sells unsellable ${id}`);
    if (kind === 'item' && it.type !== 'consumable') err(`${sid}: ${id} is not a consumable`);
    if (kind === 'weapon' && it.type !== 'weapon') err(`${sid}: ${id} is not a weapon`);
    if (kind === 'armor' && !['shield', 'head', 'body', 'acc'].includes(it.type)) err(`${sid}: ${id} is not armor`);
    if (it.band > LOC_BAND[loc]) err(`${sid}: ${id} is band ${it.band} (> shop band ${LOC_BAND[loc]})`);
    if (it.type !== 'consumable' && it.band < LOC_BAND[loc] - 1) warn(`${sid}: ${id} is old gear (band ${it.band})`);
    sold[id] = Math.min(sold[id] || 99, LOC_BAND[loc]);
  }
}
for (const sid in S) if (!/_(item|weapon|armor)$/.test(sid) || !LOCS.includes(sid.replace(/_(item|weapon|armor)$/, ''))) warn(`extra shop ${sid}`);
for (const id in I) {
  const it = I[id];
  if (it.type === 'key' || it.rare) continue;
  if (!sold[id]) warn(`${id}: not rare but sold nowhere`);
}

// --------------------------------------------------------- tiers & rares
const TIERS = R.ITEM_TIERS || {}, RARE = R.ITEM_RARE || {};
for (let b = 1; b <= 6; b++) {
  const list = TIERS['band' + b];
  if (!Array.isArray(list) || !list.length) { err(`ITEM_TIERS.band${b} missing`); continue; }
  const seen = new Set();
  for (const id of list) {
    if (!I[id]) err(`ITEM_TIERS.band${b}: unknown ${id}`);
    else if (I[id].type === 'key') err(`ITEM_TIERS.band${b}: key item ${id}`);
    else if (I[id].band > b) err(`ITEM_TIERS.band${b}: ${id} is from band ${I[id].band}`);
    if (seen.has(id)) err(`ITEM_TIERS.band${b}: duplicate ${id}`);
    seen.add(id);
  }
}
const rareListed = {};
for (const k in RARE) for (const id of RARE[k]) {
  if (!I[id]) { err(`ITEM_RARE.${k}: unknown ${id}`); continue; }
  if (!I[id].rare) err(`ITEM_RARE.${k}: ${id} is not rare:true`);
  if (rareListed[id]) err(`ITEM_RARE: ${id} listed twice`);
  rareListed[id] = k;
  if (k !== 'seeds' && I[id].band !== +k.slice(4)) err(`ITEM_RARE.${k}: ${id} has band ${I[id].band}`);
}
// exclusive items (a single monster's rare drop) are deliberately kept out of the shared pools
for (const id in I) if (I[id].rare && !I[id].exclusive && !rareListed[id]) err(`${id}: rare item missing from R.ITEM_RARE`);

// --------------------------------------------------- monotonic tiers
function monotonic(list, key, label) {
  const shopItems = list.filter((id) => !I[id].rare).sort((a, b) => I[a].band - I[b].band || I[a].price - I[b].price);
  for (let i = 1; i < shopItems.length; i++) {
    const a = I[shopItems[i - 1]], b = I[shopItems[i]];
    if (b[key] <= a[key] && !(b.element || b.mods)) warn(`${label}: ${shopItems[i]} (${b[key]}) not better than ${shopItems[i - 1]} (${a[key]})`);
    if (b.price < a.price && b.band > a.band) warn(`${label}: ${shopItems[i]} cheaper than earlier ${shopItems[i - 1]}`);
  }
}
const ids = Object.keys(I);
for (const w of WTYPES) monotonic(ids.filter((id) => I[id].wtype === w), w === 'rod' || w === 'staff' ? 'mag' : 'atk', w);
for (const a in ATYPE_SLOT) monotonic(ids.filter((id) => I[id].atype === a), 'def', a);

// ----------------------------------------- references from other modules
const ref = (id, where) => { if (id && !I[id]) err(`${where}: unknown item '${id}'`); };
for (const mid in R.DB.monsters) {
  const m = R.DB.monsters[mid];
  if (m.drop) ref(m.drop.item, `monster ${mid}.drop`);
  if (m.rare) ref(m.rare.item, `monster ${mid}.rare`);
  if (m.steal) { ref(m.steal.item, `monster ${mid}.steal`); ref(m.steal.rare, `monster ${mid}.steal.rare`); }
}
for (const mapId in R.DB.maps) {
  const map = R.DB.maps[mapId];
  for (const k in map.marks || {}) {
    const mk = map.marks[k];
    if (mk.chest) ref(mk.chest.item, `map ${mapId} chest ${mk.chest.id}`);
    if (mk.hidden) ref(mk.hidden.item, `map ${mapId} hidden ${mk.hidden.id}`);
  }
  for (const c of map.chests || []) ref(c.item, `map ${mapId} chest ${c.id}`);
  for (const h of map.hidden || []) ref(h.item, `map ${mapId} hidden ${h.id}`);
}
for (const eid in R.DB.events) {
  const meta = R.DB.events[eid].meta || {};
  for (const g of [].concat(meta.gives || [], meta.needs || [])) if (typeof g === 'string' && g.startsWith('item:')) ref(g.slice(5), `event ${eid}.meta`);
}

// ------------------------------------------------------------------ report
if (!quiet) {
  // terminal columns: full-width characters take two
  const cols = (s) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2e80 ? 1 : 2), 0);
  const pad = (s, n) => { s = String(s); let w = cols(s); while (w < n) { s += ' '; w++; } return s; };
  const padL = (s, n) => { s = String(s); let w = cols(s); while (w < n) { s = ' ' + s; w++; } return s; };
  console.log(`\nitems: ${ids.length}  ` + TYPES.map((t) => `${t} ${ids.filter((i) => I[i].type === t).length}`).join(' · '));
  console.log(`rare: ${ids.filter((i) => I[i].rare).length}   shops: ${Object.keys(S).length}\n`);

  // best value per type per band: shop (earliest band sold) and rare (item band)
  const table = (title, groups, key) => {
    console.log(title);
    console.log(pad('', 8) + [1, 2, 3, 4, 5, 6].map((b) => padL(`B${b} Lv${BAND_LV[b][0]}-${BAND_LV[b][1]}`, 14)).join(''));
    for (const g of groups) {
      const row = [];
      for (let b = 1; b <= 6; b++) {
        const shop = ids.filter((id) => g.test(I[id]) && sold[id] === b).map((id) => I[id][key] || 0);
        const rare = ids.filter((id) => g.test(I[id]) && I[id].rare && I[id].band === b).map((id) => I[id][key] || 0);
        const s = shop.length ? Math.max(...shop) : '-';
        row.push(padL(s + (rare.length ? ` ★${Math.max(...rare)}` : ''), 14));
      }
      console.log(pad(g.label, 8) + row.join(''));
    }
    console.log('');
  };
  table('weapon atk (best sold in band / ★best rare of band)', WTYPES.map((w) => ({ label: w, test: (it) => it.wtype === w })), 'atk');
  table('weapon mag', ['staff', 'rod'].map((w) => ({ label: w, test: (it) => it.wtype === w })), 'mag');
  table('armor def', Object.keys(ATYPE_SLOT).map((a) => ({ label: a, test: (it) => it.atype === a })), 'def');
  table('armor mdef', ['robe', 'hat', 'shield'].map((a) => ({ label: a, test: (it) => it.atype === a })), 'mdef');
  table('price (most expensive sold in band)', [{ label: 'weapon', test: (it) => it.type === 'weapon' },
    { label: 'armor', test: (it) => ['body', 'head', 'shield'].includes(it.type) }, { label: 'acc', test: (it) => it.type === 'acc' },
    { label: 'consum.', test: (it) => it.type === 'consumable' }], 'price');

  // reference party with the best purchasable gear of each band (current jobs if defined)
  const J = R.DB.jobs;
  const JOB = { yuki: 'warrior', non: 'priest', metem: 'mage' };
  const FALLBACK = {
    warrior: { mult: { hp: 1.2, str: 1.2, vit: 1.15, agi: 0.95, int: 0.7, mnd: 0.8, mp: 0.6, luk: 1 }, weapons: ['sword', 'axe'], shield: true, heads: ['helm'], bodies: ['heavy', 'light'] },
    priest: { mult: { hp: 1, str: 0.9, vit: 1, agi: 1, int: 0.9, mnd: 1.25, mp: 1.2, luk: 1 }, weapons: ['staff'], shield: false, heads: ['hat'], bodies: ['robe'] },
    mage: { mult: { hp: 0.85, str: 0.7, vit: 0.8, agi: 1, int: 1.3, mnd: 1, mp: 1.3, luk: 1 }, weapons: ['rod'], shield: false, heads: ['hat'], bodies: ['robe'] },
  };
  let usedFallback = false;
  for (const j in FALLBACK) if (!J[j]) { J[j] = FALLBACK[j]; usedFallback = true; }
  console.log('reference party (best shop gear sold up to the band, level = band midpoint' + (usedFallback ? ', FALLBACK job mults — jobs.js not loaded' : '') + ')');
  console.log(pad('', 12) + ['lv', 'hp', 'atk', 'def', 'mag', 'mdef', 'eva', 'kit G', 'hit40'].map((h) => padL(h, 7)).join(''));
  R.Game = { party: [], inv: {} };
  let totalKit = {}, refDef = 0;
  for (let b = 1; b <= 6; b++) {
    const lv = Math.round((BAND_LV[b][0] + BAND_LV[b][1]) / 2);
    for (const cid of R.PARTY_ORDER) {
      const c = R.Rules.newChar(cid);
      c.job = JOB[cid];
      c.level = lv;
      let kit = 0;
      for (const slot of R.Rules.SLOTS) {
        let best = null, bestScore = -1;
        for (const id in sold) {
          if (sold[id] > b || R.Rules.itemSlot(id) !== slot || !R.Rules.canEquip(c, id, slot)) continue;
          if (slot === 'acc') continue;
          const it = I[id];
          const sc = (it.atk || 0) + (it.mag || 0) * (cid === 'yuki' ? 0 : 2) + (it.def || 0) + (it.mdef || 0) * 0.5;
          if (sc > bestScore) { best = id; bestScore = sc; }
        }
        c.equip[slot] = best;
        if (best && sold[best] === b) kit += I[best].price;
      }
      if (c.equip.weapon && I[c.equip.weapon].twoHanded) c.equip.shield = null;
      const s = R.Rules.stats(c);
      totalKit[b] = (totalKit[b] || 0) + kit;
      // hit40: one normal hit on a same-band monster whose def = 40% of the warrior's atk
      if (cid === 'yuki') refDef = Math.round(s.atk * 0.4);
      const hit = Math.max(0, Math.round(s.atk / 2 - refDef / 4));
      console.log(pad(`B${b} ${c.name}`, 12) + [lv, s.hp, s.atk, s.def, s.mag, s.mdef, s.eva, kit, hit].map((v) => padL(v, 7)).join(''));
    }
  }
  console.log('\nfull new-band kit for the party (G): ' + [1, 2, 3, 4, 5, 6].map((b) => `B${b} ${totalKit[b]}`).join(' · '));
  console.log('phys = atk/2 - def/4 · magic = (power + mag×0.6) × 100/(100+mdef) · a same-band normal monster should take 2-3 warrior hits\n');
}

for (const w of warns) console.log('WARN  ' + w);
for (const e of errors) console.log('ERROR ' + e);
console.log(`\ncheck_items: ${errors.length} error(s), ${warns.length} warning(s)`);
if (R._nodeLoadErrors && R._nodeLoadErrors.length) console.log(`(note: ${R._nodeLoadErrors.length} source file(s) from other areas failed to load)`);
process.exitCode = errors.length ? 1 : 0;
