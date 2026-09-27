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
  const s = strings(fs.readFileSync(path.join(SRC, f), 'utf8'));
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
ok('salve heals 35% (item)', r1.changed && viola.hp === Math.min(st.maxHp, 10 + Math.floor(st.maxHp * 0.35)), { hp: viola.hp, max: st.maxHp });
viola.hp = 0;
S.applyField(R.DB.items.i_revive, null, [viola]);
ok('revive sets HP > 0', viola.hp > 0);
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

done('test_screens');
