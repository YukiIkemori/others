// MENUS の node のテスト（V2_PLAN §4.4 の MENUS の行・§2.5.15・§3.11）
//   node v2/tools/test_screens.js
//   画面の登録（SCREEN_IDS 全部）・Screens の契約・仮の実装が埋まっていない・説明の札（K.tip）・表示してはいけない文字（§3.11）・
//   フィールドで使う道具と術の効き目・品の値の比べ・フィクスチャの形。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true, dev: true, fixtures: true });

const SRC = path.join(__dirname, '..', 'src', 'screens');
const S = R.Screens;

section('登録と契約');
ok('R.Contract.checkApi("Screens")', R.Contract.checkApi('Screens').ok, R.Contract.checkApi('Screens').errors);
ok('Screens claimed (no stub fills it)', !(R.Stubs.installed.Screens || []).length, R.Stubs.installed.Screens);
for (const id of R.Contract.SCREEN_IDS) ok(`screen '${id}' is defined`, !!(S._defs && S._defs[id]));
ok('every SCREEN_RESULTS key has a screen', Object.keys(R.Contract.SCREEN_RESULTS).every((k) => S._defs[k]));
ok('no screen outside SCREEN_IDS', Object.keys(S._defs).every((k) => R.Contract.SCREEN_IDS.includes(k)), Object.keys(S._defs).filter((k) => !R.Contract.SCREEN_IDS.includes(k)));
const mine = R.loadErrors.filter((e) => /screen|tips/i.test(e));
ok('no load errors from MENUS (screens, tips)', mine.length === 0, mine);

section('説明の札 R.DB.tips（K.tip）');
const tips = R.DB.tips || {};
ok('tips exist (≥ 10)', Object.keys(tips).length >= 10, Object.keys(tips).length);
for (const [id, t] of Object.entries(tips)) { const c = R.Contract.check('tip', t); ok(`tip ${id} is K.tip`, c.ok, c.errors); }

section('表示してはいけない文字（§3.11）');
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js'));
// 画面に出る文字（'…' と `…` の中）だけを見る。コメントは除く
function strings(src) {
  const out = [];
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const re = /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(noComments))) out.push(m[1] != null ? m[1] : m[2]);
  return out.filter((s) => /[぀-ヿ一-鿿]/.test(s) || /\b(Lv|WP|EXP)\b/.test(s));
}
const BAD = [
  [/Lv/, 'Lv'], [/経験値/, '経験値'], [/次のレベル/, '次のレベル'], [/レベル/, 'レベル'], [/\bWP\b/, 'WP'], [/中列/, '中列'],
  [/オート(?!セーブ)/, 'オート（オートセーブ以外）'], [/前衛|後衛/, '役割'], [/技の書|術の書/, '技の書・術の書'], [/特性/, '特性'],
];
for (const f of files) {
  const s = strings(require('./lib/i18n_src').inline(fs.readFileSync(path.join(SRC, f), 'utf8')));   // 文の表（i18n）の文に戻して確かめる
  for (const [re, name] of BAD) { const hit = s.filter((x) => re.test(x)); ok(`${f}: no ${name}`, hit.length === 0, hit.slice(0, 3)); }
}
// 得意の文字の段（S〜D）を出していない: aptLetter を画面で使わない
for (const f of files) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  ok(`${f}: no aptitude letters on screen (aptLetter)`, !/aptLetter\(/.test(src));
  ok(`${f}: no ctx.filter / setTimeout`, !/\.filter\s*=|setTimeout\(/.test(src));
  ok(`${f}: no document access at load (only inside functions)`, !/^\s{0,2}(const|let|var)\s+\w+\s*=\s*document\./m.test(src));
}

section('フィールドで使う（道具と術）');
R.Dev.applyState('menus_party');
const G = R.Game;
ok('fixture menus_party → 4 members', R.Party.members().length === 4, G.party);
const viola = G.chars.viola;
const st = R.Rules.stats(viola);
viola.hp = 10;
ok('i_salve is field-usable', S.fieldUsable(R.DB.items.i_salve));
ok('i_firepot is not field-usable', !S.fieldUsable(R.DB.items.i_firepot));
ok('i_revive targets only the fallen', !S.canTarget(R.DB.items.i_revive, viola) && S.canTarget(R.DB.items.i_revive, Object.assign({}, viola, { hp: 0 })));
const r1 = S.applyField(R.DB.items.i_salve, null, [viola]);
// 回復の品は決まった量（オーナー 2026-09-28「何％ではなく 20 回復・40 回復のように数値で」）
const im = 1 + ((R.Rules.mods(viola).itemPct || 0) / 100);
ok('salve heals a fixed 30 HP (item)', r1.changed && viola.hp === Math.min(st.maxHp, 10 + Math.floor(30 * im)), { hp: viola.hp, max: st.maxHp });
viola.hp = st.maxHp - 5;
S.applyField(R.DB.items.i_potion2, null, [viola]);
ok('a fixed heal stops at max HP', viola.hp === st.maxHp, { hp: viola.hp, max: st.maxHp });
viola.mp = 0;
S.applyField(R.DB.items.i_ether, null, [viola]);
ok('ether restores a fixed 15 MP (capped at max)', viola.mp === Math.min(st.maxMp, 15), { mp: viola.mp, max: st.maxMp });
viola.hp = 0;
S.applyField(R.DB.items.i_revive, null, [viola]);
ok('revive sets HP to min(max, 40)', viola.hp === Math.min(st.maxHp, 40), viola.hp);
ok('recovery item descs name the fixed amount (味方1人のHPを 30 回復する。)', R.DB.items.i_salve.desc.replace(/\n/g, '') === '味方1人のHPを30回復する。' && /15回復/.test(R.DB.items.i_ether.desc) && /HP40/.test(R.DB.items.i_revive.desc) && !/最大値/.test(R.DB.items.i_potion.desc + R.DB.items.i_incense.desc + R.DB.items.i_tonic.desc));
const light1 = R.DB.spells.s_light_1;
ok('s_light_1 is a field spell', S.fieldUsable(light1) && S.targetKind(light1) === 'one');
ok('s_fire_1 is not a field spell', !S.fieldUsable(R.DB.spells.s_fire_1));
viola.hp = 5;
const hero = G.chars.hero;
const r2 = S.applyField(light1, hero, [viola]);
ok('healing spell uses the caster’s heal factor', r2.changed && viola.hp > 5);

section('品の値の比べ（A17: 品の値だけ）');
const d = S.itemDiff(hero, 'weapon1', 'w_sword_2');
const atk = d.find((x) => x.k === 'atk');
ok('itemDiff atk = item values', atk && atk.before === R.DB.items[hero.equip.weapon1].atk && atk.after === R.DB.items.w_sword_2.atk, atk);
ok('itemDiff keys are item stats (no totals)', d.every((x) => ['atk', 'mag', 'def', 'mdef', 'hit', 'eva', 'crit', 'str', 'vit', 'dex', 'agi', 'int', 'mnd'].includes(x.k)));
const two = R.Rules.isTwoHanded('w_bow_short');
if (two && hero.equip.shield) {
  const db = S.itemDiff(hero, 'weapon1', 'w_bow_short').find((x) => x.k === 'def');
  ok('two-handed weapon counts the shield it pushes off', db && db.d < 0, db);
}
section('人の値の増減（R.Rules.preview。装備・店の ▲▼、A20）');
{
  const pv = R.Rules.preview(hero, 'weapon1', 'w_sword_2');
  const sd = S.statDiff(hero, 'weapon1', 'w_sword_2');
  ok('statDiff d = R.Rules.preview for every row', sd.length > 0 && sd.every((x) => x.d === (pv[x.k] || 0)), sd);
  ok('statDiff before = the member’s current value, after = before + d', sd.every((x) => x.after === x.before + x.d) && sd.find((x) => x.k === 'atk').before === S.statVal(R.Rules.stats(hero), 'atk'));
  ok('statDiff keys are R.Rules.DIFF_KEYS', sd.every((x) => R.Rules.DIFF_KEYS.includes(x.k)));
  const gs = Object.keys(R.DB.items).find((id) => R.Rules.isTwoHanded(id) && R.DB.items[id].slot === 'weapon');
  if (gs && hero.equip.shield) ok('statDiff: a two-hander counts the pushed-off shield (def goes down)', (S.statDiff(hero, 'weapon1', gs).find((x) => x.k === 'def') || {}).d < 0);
  const members = S.party();
  const per = members.map((c) => S.statDiff(c, R.Rules.defaultSlot(c, 'w_sword_2'), 'w_sword_2').map((x) => x.d).join(','));
  ok('per-member deltas differ by member (not the item values)', new Set(per).size > 1, per);
  const cands = ['w_sword_2', 'w_sword_coral', hero.equip.weapon1].filter(Boolean);
  const sorted = cands.slice().sort((a2, b2) => S.equipScore(hero, 'weapon1', b2) - S.equipScore(hero, 'weapon1', a2));
  ok('equipScore orders candidates (strongest first)', S.equipScore(hero, 'weapon1', sorted[0]) >= S.equipScore(hero, 'weapon1', sorted[sorted.length - 1]));
  ok('shop list = R.Rules.shopItems', R.Rules.shopItems('shop_pharos_arms').length > 0);
}
ok('bestDelta picks the largest change', (S.bestDelta([{ d: 1 }, { d: -5 }, { d: 3 }]) || {}).d === -5);

section('得意（名前だけ）と肩書き');
const fav = S.favorites(G.chars.selma);
ok('favorites returns names only (ids of wtypes/elements)', Array.isArray(fav.w) && fav.w.every((w) => R.Rules.WTYPES.includes(w)));
ok('title of hero is the hero type name', S.title(hero) === R.DB.heroTypes[hero.type].name);
ok('bestiary list excludes bosses', S.bestiaryList().every((e) => !R.DB.monsters[e.id].bossType));

section('フィクスチャ');
const FX = path.join(__dirname, 'fixtures');
const scenes = fs.readdirSync(path.join(FX, 'scenes')).filter((f) => /^menus_/.test(f));
for (const f of scenes) {
  const o = JSON.parse(fs.readFileSync(path.join(FX, 'scenes', f), 'utf8'));
  const c = R.Contract.check('fixtureScene', o);
  ok(`${f} is K.fixtureScene and opens a known screen`, c.ok && o.scene === 'screen' && R.Contract.SCREEN_IDS.includes(o.id), c.errors);
}
ok('a scene fixture for every screen', R.Contract.SCREEN_IDS.every((id) => scenes.includes(`menus_${id}.json`)), R.Contract.SCREEN_IDS.filter((id) => !scenes.includes(`menus_${id}.json`)));
const stc = R.Contract.check('fixtureState', JSON.parse(fs.readFileSync(path.join(FX, 'states', 'menus_party.json'), 'utf8')));
ok('menus_party is K.fixtureState', stc.ok, stc.errors);

section('技・術: 派生で覚えた技は「〇〇から派生」（design/BACKLOG「派生技の閃き」）');
{
  // 持ち主「幾つかの技は派生技といって何かの技を使ってたらその上位版を覚えるの」: 派生技だけに、親の技を説明の行に出す
  const c = { id: 'hero', techs: ['t_sword_twin', 't_sword_swallow', 't_sword_draw'], derived: { t_sword_swallow: 't_sword_twin' } };
  ok('derivedFromName: a derived tech → the parent tech name (返し刃 ← 連ね斬り)', S.derivedFromName(c, 't_sword_swallow') === '連ね斬り');
  ok('derivedFromName: a normal tech is never tagged → null', S.derivedFromName(c, 't_sword_draw') === null && S.derivedFromName(c, 't_sword_twin') === null);
  const src = fs.readFileSync(path.join(SRC, 'skills.js'), 'utf8'), det = fs.readFileSync(path.join(SRC, 'detail.js'), 'utf8');
  // 画面の文は文の表（src/i18n/ja）にある: ソースの R.T('key') の日本語の文で確かめる
  const usesText = (code, re) => [...code.matchAll(/R\.T\('([^']+)'/g)].some((m) => re.test([].concat(R.I18n.table('ja')[m[1]] || '').join('')));
  ok('skills.js shows 「から派生」 on the detail chips and passes the char to the detail screen', usesText(src, /\{from\}から派生/) && /S\.detail\(\{ kind: row\.kind, id: row\.value, c: this\.char\(\) \}\)/.test(src));
  ok('detail.js adds 「〇〇から派生」 to the sub line of a derived tech', usesText(det, /\{from\}から派生/) && /derivedFromName/.test(det));
}

section('魔石: 道具の画面で仲間に使う → その属性の最初の術を覚える');
{
  R.Dev.applyState('menus_party');
  const G2 = R.Game, water = R.DB.items.i_stone_water;
  ok('water stone is field-usable, one target', S.fieldUsable(water) && S.targetKind(water) === 'one');
  const who = R.Party.members().find((c) => !(c.spells || []).includes('s_water_1'));
  const knows = R.Party.members().find((c) => (c.spells || []).includes('s_fire_1'));
  G2.items.i_stone_water = 2; G2.items.i_stone_fire = 1;
  const v = Object.assign(Object.create(null), S._defs.items);
  v.init();
  S.targetStart(v, water, null, 'i_stone_water');
  ok('target list: a member who can learn is selectable, no reason', S.canTarget(water, who) && S.targetReason(water, who) === '');
  v.use([who]);
  ok('use on a member → knows s_water_1, one stone consumed', who.spells.includes('s_water_1') && G2.items.i_stone_water === 1, [who.spells, G2.items.i_stone_water]);
  ok('the new spell is in the member’s spell list (the spells screen reads it)', R.Rules.spellList(who).includes('s_water_1') && R.Rules.commandList(who).includes('spell'));
  ok('the same member is now greyed with 「もう覚えている」', !S.canTarget(water, who) && S.targetReason(water, who) === 'もう覚えている');
  v.use([who]);
  ok('using it again on them is blocked, not consumed', G2.items.i_stone_water === 1 && who.spells.filter((x) => x === 's_water_1').length === 1);
  if (knows) {
    S.targetStart(v, R.DB.items.i_stone_fire, null, 'i_stone_fire');
    v.use([knows]);
    ok('fire stone on someone who already knows 火の矢 → blocked, not consumed', G2.items.i_stone_fire === 1 && S.targetReason(R.DB.items.i_stone_fire, knows) === 'もう覚えている');
  }
  const ns = R.Party.members().find((c) => c !== who && !(c.spells || []).includes('s_earth_1'));
  const head0 = ns.equip.head;
  ns.equip.head = 'hd_sr_oni';   // 術を使えない兜（mods.noSpell）
  G2.items.i_stone_earth = 1;
  S.targetStart(v, R.DB.items.i_stone_earth, null, 'i_stone_earth');
  v.use([ns]);
  ok('a no-spell member is greyed 「術を使えない」, stone not consumed', S.targetReason(R.DB.items.i_stone_earth, ns) === '術を使えない' && G2.items.i_stone_earth === 1 && !ns.spells.includes('s_earth_1'));
  ns.equip.head = head0;
  const fallen = R.Party.members().find((c) => c !== who && !(c.spells || []).includes('s_light_1'));
  fallen.hp = 0;
  ok('a fallen member can still learn from a stone (learning needs no HP)', S.canTarget(R.DB.items.i_stone_light, fallen));
  fallen.hp = 1;
  v.tgt = null;
}

done('test_screens');
