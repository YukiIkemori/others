#!/usr/bin/env node
// gear-b（A10b）の単体テスト: 道具 56（SYSTEMS_REWORK §2.5）・大事なもの 18・店 34・宝箱のプール 10（DESIGN.md §8.9〜§8.12、§8.14.2、§10.13.6、STYLE_JA）。
//
//   node tools/test_gear-b.js            失敗なら exit 1
//   node tools/test_gear-b.js -v         詳しく
//   node tools/test_gear-b.js --no-stub  仮の装備（tools/fixtures/gear-b/stub_gear.js）を読まない（本物の装備がそろってから）
//
// 表の正は DESIGN.md をその場で読む（tools/fixtures/gear-b/lib/spec.js）。店とプールは §8.11.3・§8.12.5 の正本のコードを
// 別の箱で動かして、src/data/shops.js・pools.js の結果と同じ品の集まりになるかを、すべてのティアと条件で比べる。
// B1 は戦闘で使える道具を本物の戦闘エンジン（R.Battle.Engine。無ければ飛ばす）で 1 つずつ使ってみる。
// DESIGN の文を BRIEF に合わせて直した所は KEY_DESC_OVERRIDE に理由と一緒に書く（DESIGN が直ったら note が出る）。
// ほかの担当の装備がまだ無い間は、仮の装備（DESIGN の表から作ったもの。本物がある id は使わない）で店とプールを確かめる。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const spec = require('./fixtures/gear-b/lib/spec');
const width = spec.width;
const VERBOSE = process.argv.includes('-v');
const NO_STUB = process.argv.includes('--no-stub');

const R = require('./lib/load')({ quiet: true, extra: NO_STUB ? [] : [path.join(ROOT, 'tools/fixtures/gear-b/stub_gear.js')] });
const S = spec();
const DB = R.DB;
const MINE_FILES = ['items_use.js', 'items_key.js', 'shops.js', 'pools.js'].map((f) => path.join(ROOT, 'src/data', f));

let pass = 0, fail = 0;
const fails = [];
function check(id, title, fn) {
  let errs;
  try { errs = fn() || []; } catch (e) { errs = ['例外: ' + (e.stack || e).split('\n').slice(0, 3).join(' / ')]; }
  if (!Array.isArray(errs)) errs = [String(errs)];
  const notes = errs.filter((e) => String(e).startsWith('note:'));
  errs = errs.filter((e) => !String(e).startsWith('note:'));
  if (errs.length) { fail++; fails.push(id); console.log(`NG  ${id} ${title}`); for (const e of errs.slice(0, VERBOSE ? 999 : 12)) console.log('      - ' + e); if (!VERBOSE && errs.length > 12) console.log(`      … ほか ${errs.length - 12}`); }
  else { pass++; console.log(`ok  ${id} ${title}`); }
  for (const n of notes) console.log('      ' + n);
}
const eq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) o[k] = canon(v[k]); return o; }
  return v;
}
const items = (pred) => Object.entries(DB.items).filter(([, it]) => it && pred(it));
const stubCount = Object.values(DB.items).filter((it) => it && it._stub).length;

// ---------------------------------------------------------------------------- 参照の実装（§3.3.5・§3.2.3）
function condOk(cond, st) {
  if (!cond) return true;
  if (typeof cond === 'string') return cond.startsWith('!') ? !st.flags[cond.slice(1)] : !!st.flags[cond];
  if (Array.isArray(cond)) return cond.every((c) => condOk(c, st));
  for (const [k, v] of Object.entries(cond)) {
    if (k === 'postgame' && !!st.postgame !== !!v) return false;
    if (k === 'cleared' && !st.cleared.includes(v)) return false;
    if (k === 'notCleared' && st.cleared.includes(v)) return false;
    if (k === 'tier' && !(st.tier >= v)) return false;
    if (k === 'tierBelow' && !(st.tier < v)) return false;
    if (k === 'flag' && !st.flags[v]) return false;
  }
  return true;
}
function shopItems(shop, st) {
  const steps = (shop.stock || []).filter((s) => s.tier <= st.tier && condOk(s.cond, st));
  const fromSteps = shop.keepOld ? steps.flatMap((s) => s.items) : (steps.length ? steps[steps.length - 1].items : []);
  return [...(shop.items || []), ...fromSteps];
}
// 調べる状態: ティア 0〜8 × クリア後 × 坑道のクリア
const STATES = [];
for (let t = 0; t <= 8; t++) for (const pg of [false, true]) for (const mine of [false, true]) {
  if (pg && t < 8) continue;               // クリア後はティア 8（全地方クリア）
  if (mine && t < 1) continue;             // 坑道をクリアしたならティア 1 以上
  STATES.push({ tier: t, postgame: pg, cleared: mine ? ['r_mine'] : [], flags: {} });
}
const stName = (st) => `T${st.tier}${st.postgame ? '+クリア後' : ''}${st.cleared.length ? '+坑道' : ''}`;

// 正本のコード（§8.11.3・§8.12.5）を別の箱で動かす
function runSpecShops() {
  const box = { window: { RPG: { DB: { shops: {} } } } };
  vm.runInNewContext(S.shopCode, box);
  return box.window.RPG.DB.shops;
}
function runSpecPools() {
  const hooks = [];
  const box = { window: { RPG: { DB: { items: DB.items, pools: {} }, onData: (f) => hooks.push(f) } } };
  vm.runInNewContext(S.poolCode, box);
  for (const f of hooks) f(box.window.RPG);
  return box.window.RPG.DB.pools;
}

console.log(`gear-b テスト（仮の装備 ${stubCount} 品${NO_STUB ? '・読まない' : ''}、読み込みの失敗 ${(R._nodeLoadErrors || []).length}、onData の失敗 ${(R.loadErrors || []).length}）`);
for (const e of (R._nodeLoadErrors || [])) if (MINE_FILES.some((f) => e.includes(path.basename(f)))) console.log('  自分のファイルの失敗: ' + e.split('\n')[0]);

// =========================================================================== 道具
const SPEC_C = S.consumables;
const MY_C = items((it) => it.type === 'consumable').map(([id]) => id);
const ICON_OK = new Set(['herb', 'potion', 'drop', 'feather', 'bomb', 'powder', 'seed', 'bell', 'flute', 'rope', 'key', 'acc',
  'mirror', 'coin', 'book',                                                     // A10b.2 (art-chars draws them)
  'el_fire', 'el_water', 'el_wind', 'el_earth', 'el_light', 'el_dark']);
const TARGETS = new Set('enemy enemies group random ally allies self ally_dead ally_any party'.split(' '));
const EFFECTS = new Set('damage heal healMp healWp revive cure status buff dispel steal scan escape grow teleport exit encounter cover summon special'.split(' '));
const FX_KINDS = new Set('slash pierce strike claw bite fire ice thunder wind earth water holy dark explosion breath drain gravity death heal mp cure revive regen buff debuff dispel steal scan smoke song grow magic warp cast'.split(' '));
const STATUSES = new Set('poison burn sleep paralyze freeze stun confuse silence blind regen veil counter nimble cover'.split(' '));
const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];

check('C1', '道具 56（§8.9 の 35 ＋ §8.9.2 の 23、SYSTEMS_REWORK §2.5 で気力の茶・気力の実を削除）の id がそろい、ほかに道具が無い', () => {
  const want = SPEC_C.map((c) => c.id), errs = [];
  if (want.length !== 56) errs.push(`DESIGN の表（改訂後）が ${want.length} 行（56 のはず）`);
  for (const id of want) if (!DB.items[id]) errs.push(`無い: ${id}`); else if (DB.items[id].type !== 'consumable') errs.push(`${id} の type が ${DB.items[id].type}`);
  for (const id of MY_C) if (!want.includes(id)) errs.push(`表に無い道具: ${id}`);
  for (const [id] of items(() => true)) if (id.startsWith('i_') && !want.includes(id)) errs.push(`i_ の id を表の外で使っている: ${id}`);
  return errs;
});
check('C2', '名前・値段・対象・効果・演出・戦闘/フィールド・説明が DESIGN の表と一致', () => {
  const errs = [];
  for (const c of SPEC_C) {
    const it = DB.items[c.id]; if (!it) continue;
    if (it.name !== c.name) errs.push(`${c.id} name ${it.name} ≠ ${c.name}`);
    if (it.price !== c.price) errs.push(`${c.id} price ${it.price} ≠ ${c.price}`);
    if (it.desc !== c.desc) errs.push(`${c.id} desc ${JSON.stringify(it.desc)} ≠ ${JSON.stringify(c.desc)}`);
    if (!c.effects) { if (it.use) errs.push(`${c.id} は「使えない」品なのに use がある`); continue; }
    const u = it.use || {};
    if (u.target !== c.target) errs.push(`${c.id} target ${u.target} ≠ ${c.target}`);
    if (!eq(u.effects, c.effects)) errs.push(`${c.id} effects ${JSON.stringify(u.effects)} ≠ ${JSON.stringify(c.effects)}`);
    if (u.fx !== c.fx) errs.push(`${c.id} fx ${u.fx} ≠ ${c.fx}`);
    if (u.battle !== c.battle || u.field !== c.field) errs.push(`${c.id} battle/field ${u.battle}/${u.field} ≠ ${c.battle}/${c.field}`);
  }
  return errs;
});
check('C3', 'grade と src（店 28 = normal/shop、5 = rare/drop、レア魔物の道具 23 = rare/relic）', () => {
  const errs = [], n = { shop: 0, drop: 0, relic: 0 };
  for (const c of SPEC_C) {
    const it = DB.items[c.id]; if (!it) continue;
    const want = c.table === '8.9.2' ? ['rare', 'relic'] : c.via.startsWith('店') ? ['normal', 'shop'] : ['rare', 'drop'];
    if (it.grade !== want[0] || it.src !== want[1]) errs.push(`${c.id} ${it.grade}/${it.src} ≠ ${want.join('/')}`);
    n[want[1]]++;
  }
  if (n.shop !== 28 || n.drop !== 5 || n.relic !== 23) errs.push(`数 shop ${n.shop} drop ${n.drop} relic ${n.relic}（28/5/23 のはず）`);
  return errs;
});
check('C4', 'レア魔物の道具の exclusive = そのレア魔物、魔石の stone = 属性（ほかの道具は持たない）', () => {
  const errs = [];
  for (const c of SPEC_C) {
    const it = DB.items[c.id]; if (!it) continue;
    if (c.table === '8.9.2') { const mon = c.via.replace(/`/g, ''); if (it.exclusive !== mon) errs.push(`${c.id} exclusive ${it.exclusive} ≠ ${mon}`); }
    else if (it.exclusive) errs.push(`${c.id} に exclusive がある`);
    const m = c.id.match(/^i_stone_(\w+)$/);
    if (m) { if (it.stone !== m[1]) errs.push(`${c.id} stone ${it.stone}`); if (!EL.includes(m[1])) errs.push(`${c.id} の属性 ${m[1]}`); }
    else if (it.stone) errs.push(`${c.id} に stone がある`);
  }
  return errs;
});
check('C5', '対象・効果の型・状態・演出が §3.1.1・§7.3 の値（演出は battle_fx の種類に解決できる）', () => {
  const errs = [];
  for (const id of MY_C) {
    const u = DB.items[id].use; if (!u) continue;
    if (!TARGETS.has(u.target)) errs.push(`${id} target ${u.target}`);
    if (!Array.isArray(u.effects) || !u.effects.length) errs.push(`${id} effects が空`);
    for (const e of u.effects || []) {
      if (!EFFECTS.has(e.type)) errs.push(`${id} effect ${e.type}`);
      if (e.type === 'damage' && e.formula !== 'tier') errs.push(`${id} damage.formula ${e.formula}（道具は tier）`);
      if (e.element && !EL.includes(e.element)) errs.push(`${id} element ${e.element}`);
      if (e.type === 'status' && !STATUSES.has(e.status)) errs.push(`${id} status ${e.status}`);
      if (e.type === 'cure' && e.statuses !== 'all' && !(e.statuses || []).every((s) => STATUSES.has(s))) errs.push(`${id} cure ${e.statuses}`);
      if (e.type === 'buff' && !['atk', 'def', 'mag', 'mdef', 'agi'].includes(e.stat)) errs.push(`${id} buff ${e.stat}`);
      if (['heal', 'healMp', 'healWp', 'revive'].includes(e.type) && !(e.pct > 0 && e.pct <= 1)) errs.push(`${id} ${e.type}.pct ${e.pct}`);
      if (e.type === 'grow' && !(['hp', 'mp', 'wp'].includes(e.stat) && e.n > 0)) errs.push(`${id} grow ${e.stat} ${e.n}`);
    }
    const kind = String(u.fx).replace(/\d+$/, '');
    const live = R.BattleFX && R.BattleFX.FX ? new Set(Object.keys(R.BattleFX.FX)) : FX_KINDS;
    if (!live.has(kind)) errs.push(`${id} fx ${u.fx}（battle_fx に無い）`);
    else if (R.BattleFX && R.BattleFX.resolve) { const r = R.BattleFX.resolve(u.fx, u); if (!r || r.kind !== kind) errs.push(`${id} fx ${u.fx} → ${r && r.kind}`); }
    if (typeof u.battle !== 'boolean' || typeof u.field !== 'boolean') errs.push(`${id} battle/field が真偽値でない`);
    if (!u.battle && !u.field) errs.push(`${id} どこでも使えない（use を消すこと）`);
  }
  return errs;
});
check('C6', '使える場面の規則（治療・戦闘の道具はフィールド×、香・実はフィールドだけ、フィールドの道具はフィールドで効く効果を持つ）', () => {
  const errs = [];
  const FIELD_OK = new Set(['heal', 'healMp', 'healWp', 'revive', 'cure', 'grow', 'encounter']);
  for (const id of MY_C) {
    const u = DB.items[id].use; if (!u) continue;
    const types = u.effects.map((e) => e.type);
    if (types.every((t) => t === 'cure') && u.field) errs.push(`${id} 治療だけの道具がフィールドで使える`);
    if (types.some((t) => ['damage', 'status', 'buff', 'scan', 'escape'].includes(t)) && u.field) errs.push(`${id} 戦闘の効果なのにフィールドで使える`);
    if (types.some((t) => ['encounter', 'grow'].includes(t)) && u.battle) errs.push(`${id} 香・実が戦闘で使える`);
    if (u.field && !types.some((t) => FIELD_OK.has(t) && t !== 'cure')) errs.push(`${id} フィールドで効く効果が無い`);
  }
  return errs;
});
check('C7', '値段: §4.15 の目安（傷薬 20・癒やしの水 80・霊水 300・蘇生 100・MP30% 150・魔石 30・香 60）、0 は実と夢の果実だけ', () => {
  const errs = [];
  const WANT = { i_salve: 20, i_potion: 80, i_elixir: 300, i_revive: 100, i_ether: 150, i_repel: 60, i_lure: 60 };
  for (const [id, p] of Object.entries(WANT)) if (DB.items[id] && DB.items[id].price !== p) errs.push(`${id} ${DB.items[id].price} ≠ ${p}`);
  for (const e of EL) if (DB.items['i_stone_' + e] && DB.items['i_stone_' + e].price !== 30) errs.push(`i_stone_${e} ≠ 30`);
  for (const id of MY_C) {
    const p = DB.items[id].price;
    if (!(Number.isInteger(p) && p >= 0)) errs.push(`${id} price ${p}`);
    if (p === 0 && !/^i_seed_|^i_dream_fruit$/.test(id)) errs.push(`${id} が売れない（price 0）`);
  }
  return errs;
});
check('C8', 'アイコン（§11.3.6 の既存と el_<属性>）・並び（sort が重ならない）・データに書かない数値が無い', () => {
  const errs = [], notes = [], sorts = new Map();
  for (const id of MY_C) {
    const it = DB.items[id];
    if (!it.icon || !String(it.icon).startsWith('icon:') || !ICON_OK.has(it.icon.slice(5))) errs.push(`${id} icon ${it.icon}（'icon:<§11.3.6 の id>'）`);
    else if (R.Gfx && R.Gfx.has && !R.Gfx.has(it.icon)) notes.push(it.icon);
    if (!Number.isInteger(it.sort)) errs.push(`${id} sort ${it.sort}`);
    else if (sorts.has(it.sort)) errs.push(`${id} と ${sorts.get(it.sort)} の sort が同じ`); else sorts.set(it.sort, id);
    for (const k of ['atk', 'mag', 'def', 'mdef', 'eva', 'stats', 'units', 'line', 'tier', 'mods']) if (it[k] !== undefined) errs.push(`${id} に ${k}`);
  }
  // 同じ種類の品は同じ絵（香は香袋 powder、魔石は属性の印）。一覧で種類が見分けられるように
  const fam = (re) => [...new Set(MY_C.filter((id) => re.test(DB.items[id].name)).map((id) => DB.items[id].icon))];
  const incense = fam(/の香$/);
  if (incense.length !== 1 || incense[0] !== 'icon:powder') errs.push(`「〜の香」のアイコンがそろっていない: ${incense.join(' ')}`);
  for (const e of EL) if (DB.items['i_stone_' + e] && DB.items['i_stone_' + e].icon !== 'icon:el_' + e) errs.push(`i_stone_${e} の icon が el_${e} でない`);
  // A10b.2: 見破りの鏡 = mirror、金の延べ板・古い金貨の袋 = coin、知恵のページ = book（絵がまだ無い版だけ前の絵に戻す）
  const FB = (R.ItemsUse && R.ItemsUse.iconFallback) ? R.ItemsUse.iconFallback() : {};
  const pending = [];
  for (const [id, want] of [['i_lens', 'icon:mirror'], ['i_gold_bar', 'icon:coin'], ['i_gold_coins', 'icon:coin'], ['i_wisdom_page', 'icon:book']]) {
    const it = DB.items[id];
    if (!it) { errs.push(`${id} が無い`); continue; }
    const drawn = R.Gfx && R.Gfx.has && R.Gfx.has(want);
    if (drawn && it.icon !== want) errs.push(`${id} の icon ${it.icon} ≠ ${want}`);
    else if (!drawn && it.icon !== FB[id]) errs.push(`${id} の icon ${it.icon}（${want} の絵が無い間は ${FB[id]}）`);
    else if (!drawn) pending.push(`${id}→${want.slice(5)}`);
  }
  if (pending.length) notes.push(...pending.map((p) => 'pending ' + p));
  const miss = [...new Set(notes)];
  if (miss.length) errs.push(`note: 絵がまだ無いアイコン（art-chars A13 の分。無い間は種別の既定で描く）: ${miss.join(' ')}`);
  return errs;
});

// =========================================================================== 大事なもの
const SPEC_K = S.keys;
// DESIGN の文より BRIEF を優先した説明（BRIEF Part A* が DESIGN に勝つ）。ここに無い品は §8.10・§10.13.6 と一字一句同じ
const KEY_DESC_OVERRIDE = {
  // Part A6: ワープ先に「入ったことのあるダンジョンの入口」も入る（DESIGN §10.6.3・§11.7.12 は取り込み済み。§10.13.6 の文が古い）
  k_quill: { desc: '行ったことのある町や\nダンジョンの入口へ一瞬で移動できる。', spec: '行ったことのある町へ\n一瞬で移動できる。', why: 'BRIEF A6' },
};
check('K1', '大事なもの 18 の id・名前・説明が §8.10 と §10.13.6 と一致（type key、price 0、grade を書かない。BRIEF で直した説明 1 つを除く）', () => {
  const errs = [];
  for (const [id, o] of Object.entries(KEY_DESC_OVERRIDE)) {
    const k = SPEC_K.find((x) => x.id === id), t = S.keys10[id];
    if (!k || !t) { errs.push(`${id} が DESIGN の表に無い`); continue; }
    if (k.desc !== o.spec || t.desc !== o.spec) errs.push(`note: ${id} の DESIGN の説明が変わった（${JSON.stringify(k.desc)}）。${o.why} の直しがまだ要るか見直すこと`);
    if (DB.items[id] && DB.items[id].desc !== o.desc) errs.push(`${id} desc ${JSON.stringify(DB.items[id].desc)} ≠ ${JSON.stringify(o.desc)}（${o.why}）`);
  }
  if (SPEC_K.length !== 18) errs.push(`§8.10 の表が ${SPEC_K.length} 行`);
  for (const k of SPEC_K) {
    const it = DB.items[k.id];
    if (!it) { errs.push(`無い: ${k.id}`); continue; }
    if (it.type !== 'key' || it.price !== 0) errs.push(`${k.id} type ${it.type} price ${it.price}`);
    if (it.grade !== undefined || it.src !== undefined) errs.push(`${k.id} に grade/src`);
    if (it.name !== k.name) errs.push(`${k.id} name ${it.name} ≠ ${k.name}`);
    const ov = KEY_DESC_OVERRIDE[k.id];
    if (!ov && it.desc !== k.desc) errs.push(`${k.id} desc ≠ §8.10`);
    const t = S.keys10[k.id];
    if (!t) errs.push(`${k.id} が §10.13.6 に無い`);
    else { if (t.name !== it.name) errs.push(`${k.id} name ≠ §10.13.6 ${t.name}`); if (!ov && t.desc !== it.desc) errs.push(`${k.id} desc ≠ §10.13.6 ${JSON.stringify(t.desc)}`); }
  }
  const mine = items((it) => it.type === 'key').map(([id]) => id);
  for (const id of mine) if (!SPEC_K.find((k) => k.id === id)) errs.push(`表に無い大事なもの: ${id}`);
  for (const [id] of items(() => true)) if (id.startsWith('k_') && DB.items[id].type !== 'key') errs.push(`${id} が k_ なのに type が key でない`);
  return errs;
});
check('K2', '使える大事なものは k_quill（teleport）と k_bell（exit）だけ。フィールドだけ・自分・減らない', () => {
  const errs = [];
  for (const k of SPEC_K) {
    const it = DB.items[k.id]; if (!it) continue;
    if (!eq(it.use || null, k.use)) errs.push(`${k.id} use ${JSON.stringify(it.use)} ≠ ${JSON.stringify(k.use)}`);
  }
  return errs;
});
check('K3', '年代記のページ 8 が地方の fragment とつながる（DB.regions がある時）', () => {
  const pages = SPEC_K.map((k) => k.id).filter((id) => id.startsWith('k_page_'));
  if (pages.length !== 8) return [`ページが ${pages.length}`];
  const regs = Object.entries(DB.regions || {}).filter(([, r]) => r && r.fragment);
  if (!regs.length) return ['note: DB.regions に fragment が無い（world A18a の分がまだ）。ページ 8 だけ確かめた'];
  const errs = [];
  for (const [rid, r] of regs) if (!DB.items[r.fragment] || DB.items[r.fragment].type !== 'key') errs.push(`地方 ${rid} の fragment ${r.fragment} が大事なものに無い`);
  for (const p of pages) if (!regs.some(([, r]) => r.fragment === p)) errs.push(`${p} を fragment にする地方が無い`);
  return errs;
});

// =========================================================================== 文
const MY_ITEMS = [...SPEC_C.map((c) => c.id), ...SPEC_K.map((k) => k.id)].filter((id) => DB.items[id]);
check('T1', '名前は全角 9 字まで、説明は 2 行 × 20 字まで（半角 0.5 字）、改行は \\n', () => {
  const errs = [];
  for (const id of MY_ITEMS) {
    const it = DB.items[id];
    if (!it.name || width(it.name) > 9) errs.push(`${id} name ${it.name}（${width(it.name)}）`);
    const ls = String(it.desc || '').split('\n');
    if (!it.desc) errs.push(`${id} desc が無い`);
    if (ls.length > 2) errs.push(`${id} desc が ${ls.length} 行`);
    for (const l of ls) if (width(l) > 20) errs.push(`${id} desc の行が ${width(l)} 字: ${l}`);
    if (/[／<]/.test(it.desc)) errs.push(`${id} desc に表の記号`);
  }
  return errs;
});
check('T2', '使ってはいけない名前（STYLE_JA §7.1 部分一致・§7.2 完全一致）と src 全体の禁止語（§7.3）', () => {
  const errs = [];
  if (S.banned.partial.length < 100 || S.banned.exact.length < 20) errs.push(`STYLE_JA の一覧が読めない（${S.banned.partial.length}/${S.banned.exact.length}）`);
  for (const id of MY_ITEMS) {
    const n = DB.items[id].name;
    for (const w of S.banned.partial) if (n.includes(w)) errs.push(`${id} ${n} が「${w}」を含む`);
    for (const w of S.banned.exact) if (n === w) errs.push(`${id} ${n} が完全一致の禁止名`);
  }
  // 自分のファイルの文字列（コメントを除く）に §7.3 の語
  for (const f of MINE_FILES) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const strs = src.match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) || [];
    for (const s of strs) for (const w of S.banned.src) if (s.includes(w)) errs.push(`${path.basename(f)} の文字列 ${s} が「${w}」を含む`);
  }
  return errs;
});
check('T3', '画面に出る字は常用漢字・STYLE_JA §2 の字・かな・記号だけ（半角カナ・全角数字なし）', () => {
  if (!S.joyo) return ['note: tools/lib/joyo.txt が無いので漢字の検査を飛ばした'];
  const ok = new Set([...S.joyo, ...S.allowedKanji]), errs = [];
  for (const id of MY_ITEMS) {
    const it = DB.items[id];
    for (const ch of it.name + it.desc) {
      const c = ch.codePointAt(0);
      if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) { if (!ok.has(ch)) errs.push(`${id} 常用外の字「${ch}」（${it.name}）`); }
      else if (c >= 0xff61 && c <= 0xff9f) errs.push(`${id} 半角カナ「${ch}」`);
      else if (c >= 0xff10 && c <= 0xff19) errs.push(`${id} 全角数字「${ch}」`);
    }
    if (/…/.test(it.desc) && !/……[。！？」]/.test(it.desc)) errs.push(`${id} 三点リーダー`);
    if (/(眠り|まひ|沈黙|混乱|凍結|気絶|暗闇|やけど)にする|にならない/.test(it.desc)) errs.push(`${id} 使わない言い方: ${it.desc}`);
    if (/[ 　]/.test(it.name + it.desc)) errs.push(`${id} スペース（分かち書き）`);
  }
  return errs;
});
check('T4', '表示名が品・魔物・技・術・敵の行動の中で重ならない（V3）', () => {
  const errs = [], names = new Map();
  const add = (kind, id, n) => { if (!n) return; if (!names.has(n)) names.set(n, []); names.get(n).push(kind + ':' + id); };
  for (const [id, it] of Object.entries(DB.items)) if (it && !it._stub) add('item', id, it.name);
  for (const [id, m] of Object.entries(DB.monsters || {})) add('mon', id, m.name);
  for (const [id, a] of Object.entries(DB.actions || {})) add('act', id, a.name);
  for (const id of MY_ITEMS) { const l = names.get(DB.items[id].name) || []; if (l.length > 1) errs.push(`${DB.items[id].name}: ${l.join(' ')}`); }
  return errs;
});

// =========================================================================== 店
const SPEC_SHOPS = runSpecShops();
const SHOP_IDS = Object.keys(SPEC_SHOPS);
check('S1', '店 34 の id が §8.11.3 の正本と同じ（§10.6.1: 33 店 ＋ coral_regnas）', () => {
  const errs = [];
  if (SHOP_IDS.length !== 34) errs.push(`正本が ${SHOP_IDS.length} 店`);
  for (const id of SHOP_IDS) if (!DB.shops[id]) errs.push(`無い: ${id}`);
  for (const id of Object.keys(DB.shops)) if (!SPEC_SHOPS[id]) errs.push(`正本に無い店: ${id}`);
  for (const id of Object.keys(DB.shops)) if (!/^[a-z]+_(item|weapon|armor|magic|regnas)$/.test(id)) errs.push(`id の形: ${id}`);
  return errs;
});
check('S2', '店の名前・kind・keepOld が正本と同じ。名前は §8.11.2 の表とも合う', () => {
  const errs = [];
  for (const id of SHOP_IDS) {
    const a = DB.shops[id], b = SPEC_SHOPS[id]; if (!a) continue;
    if (a.name !== b.name) errs.push(`${id} name ${a.name} ≠ ${b.name}`);
    if (a.kind !== b.kind) errs.push(`${id} kind ${a.kind} ≠ ${b.kind}`);
    if (!!a.keepOld !== !!(b.keepOld === undefined ? true : b.keepOld)) errs.push(`${id} keepOld ${a.keepOld} ≠ ${b.keepOld}`);
    const t = S.shopNames[id];
    if (t && !t.includes('〇〇') && !a.name.includes(t) && !t.includes(a.name)) errs.push(`${id} name ${a.name} が §8.11.2 の「${t}」と合わない`);
  }
  return errs;
});
check('S3', 'どのティア・条件でも、店に並ぶ品の集まりが正本と同じ（ティア 0〜8 × クリア後 × 坑道）', () => {
  const errs = [];
  for (const id of SHOP_IDS) {
    const a = DB.shops[id], b = Object.assign({ keepOld: true }, SPEC_SHOPS[id]); if (!a) continue;
    for (const st of STATES) {
      const x = [...new Set(shopItems(a, st))].sort(), y = [...new Set(shopItems(b, st))].sort();
      if (!eq(x, y)) { errs.push(`${id} ${stName(st)}: 多い ${x.filter((i) => !y.includes(i)).join(' ') || '-'} ／ 足りない ${y.filter((i) => !x.includes(i)).join(' ') || '-'}`); break; }
    }
  }
  return errs;
});
check('S4', '店の形（items・stock の段 {tier 0〜8, cond?, items}・keepOld）と、1 つの店の中で品が重ならない', () => {
  const errs = [];
  for (const [id, s] of Object.entries(DB.shops)) {
    if (!Array.isArray(s.items) || !Array.isArray(s.stock) || typeof s.keepOld !== 'boolean') errs.push(`${id} の形`);
    for (const st of s.stock || []) {
      if (!(Number.isInteger(st.tier) && st.tier >= 0 && st.tier <= 8)) errs.push(`${id} 段の tier ${st.tier}`);
      if (!Array.isArray(st.items) || !st.items.length) errs.push(`${id} 空の段`);
      for (const k of Object.keys(st)) if (!['tier', 'cond', 'items'].includes(k)) errs.push(`${id} 段に ${k}`);
    }
    for (const stt of STATES) { const l = shopItems(s, stt); if (new Set(l).size !== l.length) { errs.push(`${id} ${stName(stt)} で品が重なる`); break; } }
  }
  return errs;
});
check('S5', '店の品はすべて存在し、通常品（src:shop・grade normal の装備か道具）だけ', () => {
  const errs = [], seen = new Set();
  for (const [id, s] of Object.entries(DB.shops)) for (const st of STATES) for (const i of shopItems(s, st)) {
    if (seen.has(id + i)) continue; seen.add(id + i);
    const it = DB.items[i];
    if (!it) errs.push(`${id}: 無い品 ${i}`);
    else if (it.src !== 'shop' || it.grade !== 'normal' || it.unique || it.type === 'key') errs.push(`${id}: 通常品でない ${i}（${it.grade}/${it.src}）`);
  }
  return errs;
});
check('S6', 'どの通常品（src:shop の装備 532・道具 29）も、どこかの店で買える', () => {
  const sold = new Set();
  for (const s of Object.values(DB.shops)) for (const st of STATES) for (const i of shopItems(s, st)) sold.add(i);
  const want = items((it) => it.src === 'shop' && it.type !== 'key');
  // SYSTEMS_REWORK §3.2: 打ち刀 (w_sword_uchi) is a T0 normal that no shop step lists (シグレ・ヴィオラの初期装備)
  const errs = want.filter(([id]) => !sold.has(id) && id !== 'w_sword_uchi').map(([id]) => `どこにも売っていない: ${id}`);
  const nEq = want.filter(([, it]) => it.type !== 'consumable').length, nC = want.filter(([, it]) => it.type === 'consumable').length;
  errs.push(`note: 通常品 ${want.length}（装備 ${nEq}・道具 ${nC}）をすべての店・ティアで確かめた`);
  if (nEq !== 503) errs.push(`note: 装備の通常品が ${nEq}（本物と仮の合計。503 のはず: 武器 91 + 防具 300 + アクセ 112）`);
  return errs;
});
check('S7', '武器屋・防具屋は今のティアの系列の品だけ（T3 から腕章・赤布・ブローチ）、クリア後のファロスとビブリアは T9', () => {
  const errs = [];
  for (const [id, s] of Object.entries(DB.shops)) {
    if (s.kind !== 'weapon' && s.kind !== 'armor') continue;
    for (const st of STATES) {
      const l = shopItems(s, st);
      const want = st.postgame && /^(lute|biblia)_/.test(id) ? 9 : st.tier;
      for (const i of l) {
        const it = DB.items[i]; if (!it) continue;
        if (it.line && !it.line.startsWith('charm_') && it.tier !== want) errs.push(`${id} ${stName(st)}: ${i} は T${it.tier}`);
      }
      const ex = l.filter((i) => /^ac_(badge|redcloth|brooch)/.test(i));
      if (st.tier < 3 && ex.length && !(id === 'dovan_weapon' && st.cleared.length)) errs.push(`${id} ${stName(st)}: T3 より前に ${ex.join(' ')}`);
    }
  }
  return errs.slice(0, 20);
});
check('S8', '道具屋はティアとともに増える（前の品が消えない）。並び: 道具屋・術具店は道具 → アクセサリ（その中は sort）、武器屋・防具屋は枠の順・重さの順', () => {
  const errs = [];
  const sortOf = (i) => (DB.items[i] && Number.isFinite(DB.items[i].sort) ? DB.items[i].sort : 1e9);
  const TYPE_RANK = { weapon: 0, shield: 1, head: 2, body: 3, hands: 4, feet: 5, acc: 6 };
  const WEIGHT_RANK = { heavy: 0, light: 1, cloth: 2 };
  const LINE_RANK = new Map(S.lines.map((l, k) => [l.line, k]));   // §8.4 の系列の順（武器は §8.1.2 の系統の順）
  for (const [id, s] of Object.entries(DB.shops)) {
    let prev = [];
    for (const st of STATES) {
      const l = shopItems(s, st), tag = `${id} ${stName(st)}`;
      if (s.kind === 'item' && !st.postgame && !st.cleared.length) {
        for (const i of prev) if (!l.includes(i)) errs.push(`${tag} で ${i} が消えた`);
        prev = l;
      }
      if (s.kind === 'item' || s.kind === 'magic') {
        const firstAc = l.findIndex((i) => !i.startsWith('i_'));
        if (firstAc >= 0 && l.slice(firstAc).some((i) => i.startsWith('i_'))) errs.push(`${tag}: アクセサリの後に道具`);
        for (let k = 1; k < l.length; k++) if (l[k].startsWith('i_') === l[k - 1].startsWith('i_') && sortOf(l[k]) < sortOf(l[k - 1])) { errs.push(`${tag}: ${l[k - 1]} の後に ${l[k]}（sort の順でない）`); break; }
      } else if (s.kind === 'weapon' || s.kind === 'armor') {
        for (let k = 1; k < l.length; k++) {
          const a = DB.items[l[k - 1]], b = DB.items[l[k]]; if (!a || !b) continue;
          const ra = TYPE_RANK[a.type], rb = TYPE_RANK[b.type];
          const la = a.line && LINE_RANK.has(a.line) ? LINE_RANK.get(a.line) : -1, lb = b.line && LINE_RANK.has(b.line) ? LINE_RANK.get(b.line) : -1;
          const bad = rb < ra || (rb === ra && a.type !== 'acc' && a.type !== 'weapon' && WEIGHT_RANK[b.weight] < WEIGHT_RANK[a.weight]) ||
            (rb === ra && a.type === 'weapon' && lb < la);
          if (bad) { errs.push(`${tag}: ${l[k - 1]} の後に ${l[k]}（枠・重さ・系統の順でない）`); break; }
        }
      }
    }
  }
  return errs.slice(0, 20);
});
check('S9', 'R.Tier.shopItems（rules の実装がある時）が同じ品を同じ並びで返す', () => {
  if (!R.Tier || !R.Tier.shopItems) return ['note: R.Tier.shopItems がまだ無い（rules A1）。参照の実装だけで確かめた'];
  const errs = [], saved = R.Game;
  try {
    for (const st of STATES) {
      const G = (R.State && R.State.newGame) ? R.State.newGame() : {};
      G.tier = st.tier; G.gameClear = st.postgame; G.regionsCleared = st.cleared.slice(); G.flags = Object.assign(G.flags || {}, { game_clear: st.postgame });
      for (const r of st.cleared) G.flags['cleared_' + r] = true;
      R.Game = G;
      for (const id of SHOP_IDS) {
        const a = [...R.Tier.shopItems(id)], b = [...new Set(shopItems(DB.shops[id], st))];
        if (!eq([...a].sort(), [...b].sort())) { errs.push(`${id} ${stName(st)}: R.Tier ${a.length} 品 ≠ 参照 ${b.length} 品`); break; }
        if (!eq(a, b)) { errs.push(`${id} ${stName(st)}: R.Tier の並びが参照と違う（${a.slice(0, 4).join(' ')} …）`); break; }
      }
      if (errs.length > 5) break;
    }
  } finally { R.Game = saved; }
  return errs;
});

// =========================================================================== プール
const SPEC_POOLS = runSpecPools();
const RB = [1, 1, 3, 3, 5, 5, 7, 7, 9, 9];
const BAD_SRC = new Set(['super', 'relic', 'reward', 'mdrop']);
check('P1', 'プール 10 の id が正本と同じ。どれも 10 段（ティア 0〜9）で、空の段が無い', () => {
  const errs = [];
  const want = Object.keys(SPEC_POOLS);
  if (want.length !== 10) errs.push(`正本が ${want.length}`);
  for (const id of S.poolTable) if (!want.includes(id)) errs.push(`§8.12.2 の ${id} が正本に無い`);
  for (const id of want) if (!DB.pools[id]) errs.push(`無い: ${id}`);
  for (const id of Object.keys(DB.pools)) if (!want.includes(id)) errs.push(`正本に無いプール: ${id}`);
  for (const [id, p] of Object.entries(DB.pools)) {
    if (!Array.isArray(p.tiers) || p.tiers.length !== 10) { errs.push(`${id} の段の数 ${p.tiers && p.tiers.length}`); continue; }
    p.tiers.forEach((t, T) => { if (!t.length) errs.push(`${id} T${T} が空`); });
  }
  return errs;
});
check('P2', 'プールの中身（品・重み・個数・お金）が、同じ DB.items で動かした正本と一致', () => {
  const errs = [];
  for (const id of Object.keys(SPEC_POOLS)) {
    const a = DB.pools[id]; if (!a) continue;
    for (let T = 0; T < 10; T++) {
      const x = (a.tiers[T] || []).map((e) => JSON.stringify(canon(e))).sort(), y = SPEC_POOLS[id].tiers[T].map((e) => JSON.stringify(canon(e))).sort();
      if (!eq(x, y)) { errs.push(`${id} T${T}: ${x.length} ≠ ${y.length}`); break; }
    }
  }
  return errs;
});
check('P3', '段の形 {item, w, n?} か {gold, w}。w > 0、n は 1 以上の整数。品はすべて存在する', () => {
  const errs = [];
  for (const [id, p] of Object.entries(DB.pools)) (p.tiers || []).forEach((t, T) => t.forEach((e) => {
    const keys = Object.keys(e);
    if (e.gold !== undefined) { if (!(e.gold > 0) || keys.some((k) => !['gold', 'w'].includes(k))) errs.push(`${id} T${T} お金の形 ${JSON.stringify(e)}`); }
    else {
      if (!DB.items[e.item]) errs.push(`${id} T${T} 無い品 ${e.item}`);
      if (keys.some((k) => !['item', 'w', 'n'].includes(k))) errs.push(`${id} T${T} 形 ${JSON.stringify(e)}`);
      if (e.n !== undefined && !(Number.isInteger(e.n) && e.n >= 1)) errs.push(`${id} T${T} n ${e.n}`);
    }
    if (!(e.w > 0)) errs.push(`${id} T${T} w ${e.w}`);
  }));
  return errs;
});
check('P4', 'プールに超レア・遺物・報酬・魔物のレア品・一品物・大事なもの・レア魔物の道具が無い', () => {
  const errs = [];
  for (const [id, p] of Object.entries(DB.pools)) for (const t of p.tiers || []) for (const e of t) {
    const it = e.item && DB.items[e.item]; if (!it) continue;
    if (BAD_SRC.has(it.src) || it.grade === 'super' || it.unique || it.exclusive || it.type === 'key') errs.push(`${id}: ${e.item}（${it.grade}/${it.src}）`);
  }
  return [...new Set(errs)];
});
check('P5', 'p_gear はその T の通常の装備（武器 9 系列 ＋ T0 の打ち刀・防具 30・能力のアクセサリ 6、SYSTEMS_REWORK §3.3）。p_weapon/p_armor/p_acc/p_boss_mid はその一部・同じ', () => {
  const errs = [];
  for (let T = 0; T < 10; T++) {
    const g = DB.pools.p_gear.tiers[T].map((e) => e.item);
    const by = (t) => g.filter((i) => DB.items[i] && t.includes(DB.items[i].type)).length;
    const nw = S.lines.filter((l) => l.type === 'weapon').length + (T === 0 ? 1 : 0);
    if (g.length !== nw + 36 || by(['weapon']) !== nw || by(['shield', 'head', 'body', 'hands', 'feet']) !== 30 || by(['acc']) !== 6) errs.push(`T${T}: ${g.length} 品（武器 ${by(['weapon'])}・防具 ${by(['shield', 'head', 'body', 'hands', 'feet'])}・アクセ ${by(['acc'])}）`);
    for (const i of g) { const it = DB.items[i]; if (it.tier !== T || it.grade !== 'normal' || !it.line) errs.push(`T${T}: ${i} tier ${it.tier}`); }
    if (DB.pools.p_gear.tiers[T].some((e) => e.w !== 1)) errs.push(`T${T}: 重みが 1 でない`);
    const lines = new Set(g.map((i) => DB.items[i].line)); if (lines.size !== g.length) errs.push(`T${T}: 同じ系列が 2 つ`);
    const sub = (pid) => DB.pools[pid].tiers[T].map((e) => e.item);
    if (sub('p_weapon').length + sub('p_armor').length + sub('p_acc').length !== g.length || ![...sub('p_weapon'), ...sub('p_armor'), ...sub('p_acc')].every((i) => g.includes(i))) errs.push(`T${T}: p_weapon/p_armor/p_acc が p_gear を分けたものでない`);
    if (!eq(sub('p_boss_mid').sort(), g.slice().sort())) errs.push(`T${T}: p_boss_mid ≠ p_gear`);
  }
  return errs;
});
check('P6', 'p_rare・p_boss は帯 RB(T) の帯のレア品（src:drop の装備）だけ。p_rare は重み 2、T4 から道具 3 と実 2（気力の実は削除、A18）', () => {
  const errs = [], notes = [];
  for (let T = 0; T < 10; T++) {
    const band = items((it) => it.src === 'drop' && it.grade === 'rare' && it.type !== 'consumable' && it.tier === RB[T]).map(([id]) => id).sort();
    const pr = DB.pools.p_rare.tiers[T], pb = DB.pools.p_boss.tiers[T];
    const eqs = pr.filter((e) => DB.items[e.item].type !== 'consumable');
    if (!eq(eqs.map((e) => e.item).sort(), band)) errs.push(`T${T}: p_rare の装備 ${eqs.length} ≠ 帯 ${RB[T]} の ${band.length}`);
    if (eqs.some((e) => e.w !== 2)) errs.push(`T${T}: p_rare の装備の重みが 2 でない`);
    if (!eq(pb.map((e) => e.item).sort(), band) || pb.some((e) => e.w !== 1)) errs.push(`T${T}: p_boss が帯の品（重み 1）でない`);
    const cons = pr.filter((e) => DB.items[e.item].type === 'consumable').map((e) => e.item).sort();
    const wantC = T >= 4 ? ['i_grace', 'i_lifedew', 'i_phoenix', 'i_seed_hp', 'i_seed_mp'] : [];
    if (T >= 4 && (pr.find((e) => e.item === 'i_seed_mp') || {}).w !== 2) errs.push(`T${T}: p_rare の魔力の実の重みが 2 でない（SYSTEMS_REWORK §2.5）`);
    if (!eq(cons, wantC)) errs.push(`T${T}: p_rare の道具 ${cons.join(' ')}`);
    if (T % 2 === 0) notes.push(`T${T}/${T + 1}→帯${RB[T]} ${band.length}`);
  }
  errs.push('note: 帯の品の数 ' + notes.join('、'));
  return errs;
});
check('P7', 'p_supply が §8.12.2 の表のとおり（段が上がると前の段に足す。傷薬は 2 個）', () => {
  const errs = [], byName = {};
  for (const c of SPEC_C) byName[c.name] = c.id;
  for (let T = 0; T < 10; T++) {
    const want = [];
    for (const r of S.supplyTable) if (r.from <= T) for (const a of r.add) want.push({ item: byName[a.name], w: a.w, n: a.n });
    // 「T3〜T5」の行は T3 以上に足す（表の範囲の上端は、次の行が足す段の手前という意味）
    const got = DB.pools.p_supply.tiers[T].map((e) => ({ item: e.item, w: e.w, n: e.n || 1 }));
    if (!eq(got.map((e) => JSON.stringify(e)).sort(), want.map((e) => JSON.stringify(e)).sort())) errs.push(`T${T}: ${got.length} 品 ≠ 表 ${want.length} 品`);
  }
  return errs;
});
check('P8', 'p_gold = GOLD[T]（§8.12.2）、p_stone = 魔石 6 × 2 個', () => {
  const errs = [];
  for (let T = 0; T < 10; T++) {
    const g = DB.pools.p_gold.tiers[T];
    if (g.length !== 1 || g[0].gold !== S.gold[T]) errs.push(`p_gold T${T} ${JSON.stringify(g)}`);
    const s = DB.pools.p_stone.tiers[T];
    if (s.length !== 6 || !s.every((e) => /^i_stone_/.test(e.item) && e.n === 2 && e.w === 1)) errs.push(`p_stone T${T}`);
  }
  return errs;
});
check('P9', 'R.Tier.pick・R.Tier.chest（rules の実装がある時）がプールを正しく引く', () => {
  if (!R.Tier || !R.Tier.pick) return ['note: R.Tier.pick がまだ無い（rules A1）'];
  const errs = [];
  for (const [id, p] of Object.entries(DB.pools)) for (let T = 0; T < 10; T++) {
    const got = R.Tier.pick(p.tiers, T);
    if (got !== p.tiers[T] && !eq(got, p.tiers[T])) errs.push(`${id} T${T}: pick が別の段を返した`);
  }
  if (R.Tier.chest) {
    const saved = R.Game;
    try {
      R.Game = Object.assign((R.State && R.State.newGame) ? R.State.newGame() : {}, { tier: 3, chests: {} });
      for (const pid of Object.keys(DB.pools)) for (const tier of [0, 5, 9]) {
        const r = R.Tier.chest({ id: 'test_c' + pid + tier, pool: pid, tier }, { chestTier: undefined });
        const ok = r && ((r.gold > 0) || (r.item && DB.pools[pid].tiers[tier].some((e) => e.item === r.item)));
        if (!ok) errs.push(`chest ${pid} T${tier} → ${JSON.stringify(r)}`);
      }
    } catch (e) { errs.push('note: R.Tier.chest を呼べなかった: ' + e.message); } finally { R.Game = saved; }
  }
  return errs;
});

// =========================================================================== 本物の戦闘エンジンで使う
// 戦闘で使える道具（use.battle）を 1 つずつ R.Battle.Engine（battle A2 の本物。simulate と同じコード）で使い、
// 効果の型ごとに決まった出来事が出るかを見る。確率のある状態異常は種を変えて 12 回まで試す。
check('B1', '戦闘で使える道具はどれも本物の戦闘エンジンで効く（回復・生き返り・治療・状態・強化・ダメージ・見破り・逃げる・魔石の熟練度）と、使うと 1 つ減る', () => {
  if (!R.Battle || !R.Battle.Engine || !R.Battle.resolveMonsters || !R.Battle.drain) return ['note: R.Battle.Engine がまだ無い（battle A2）'];
  let PM;
  try { PM = require('./lib/party_model'); } catch (e) { return ['note: tools/lib/party_model.js が無い（qa A22）']; }
  const B = R.Battle, U = R.U, errs = [];
  const zone = DB.encounters && DB.encounters.z_prologue_lighthouse ? 'z_prologue_lighthouse' : Object.keys(DB.encounters || {})[0];
  if (!zone) return ['note: DB.encounters が空'];
  const std = PM.standard(R, 3);
  if (!std.party || std.party.length < 2) return ['note: 標準のパーティが作れない'];
  const ids = MY_C.filter((id) => DB.items[id].use && DB.items[id].use.battle);
  const savedRng = U.rng;
  try {
    PM.withGame(R, { tier: 3, party: std.party }, () => {
      for (const id of ids) {
        const u = DB.items[id].use, types = u.effects.map((e) => e.type);
        let ok = false, why = '';
        for (let seed = 1; seed <= 12 && !ok; seed++) {
          U.seed(seed * 7919 + id.length);
          const r0 = B.resolveMonsters({ zone, tier: 3, noRare: true, noGolden: true }, { mods: {} });
          if (!r0) { why = 'resolveMonsters が null'; break; }
          const inv = { [id]: 3 };
          const eng = new B.Engine({ party: std.party.map((c) => U.clone(c)), reserve: [], mons: r0.mons, inv, live: false, tier: r0.Tb, lv: r0.Lb, noSurprise: true });
          B.drain(eng.begin());
          const user = eng.party[0], others = eng.party.slice(1), tgt = others[0];
          // 効く状態を作る（傷・MP/WP 0・悪い状態・戦闘不能）
          let target;
          if (u.target === 'ally_dead') { tgt.hp = 0; target = tgt; }
          else if (/^(ally|allies|party)$/.test(u.target)) {
            // 傷は半分（毒の傷やその番の攻撃で倒れないように）。治療は「すべて」なら HP の減らない暗闇と沈黙
            for (const p of others) {
              if (types.includes('heal')) p.hp = Math.max(1, Math.floor(p.mhp / 2));
              if (types.includes('healMp')) p.mp = 0;
              if (types.includes('healWp')) p.wp = 0;
            }
            const cure = u.effects.find((e) => e.type === 'cure');
            if (cure) for (const p of others) for (const s of cure.statuses === 'all' ? ['blind', 'silence'] : cure.statuses) { p.status[s] = true; p.turns[s] = 5; }
            if (u.target === 'ally') target = tgt;
          }
          const ep0 = Object.assign({}, user.c.eprof || {});
          const evs = [];
          B.drain(eng.playRound(eng.party.map((p, i) => (i === 0 ? { type: 'item', id, target } : { type: 'defend' }))), (e) => evs.push(e));
          // 使った人の番の出来事だけ（その人の actor から次の actor まで）
          const a = evs.findIndex((e) => e.t === 'actor' && e.u === user);
          if (a < 0) { why = '使う人の番が来なかった'; continue; }
          const b = evs.findIndex((e, k) => k > a && e.t === 'actor');
          const got = evs.slice(a, b < 0 ? evs.length : b);
          const has = (f) => got.some(f);
          const miss = [];
          for (const e of u.effects) {
            if (e.type === 'heal' && !has((x) => x.t === 'heal' && x.u.isParty && !x.mp && !x.wp && x.n > 0)) miss.push('HP の回復');
            if (e.type === 'healMp' && !has((x) => x.t === 'heal' && x.u.isParty && x.mp && x.n > 0)) miss.push('MP の回復');
            if (e.type === 'healWp' && !has((x) => x.t === 'heal' && x.u.isParty && x.wp && x.n > 0)) miss.push('WP の回復');
            if (e.type === 'revive' && !has((x) => x.t === 'revive' && x.u === tgt)) miss.push('生き返り');
            if (e.type === 'cure' && !has((x) => x.t === 'status' && x.on === false && x.u.isParty)) miss.push('治療');
            if (e.type === 'buff' && !has((x) => x.t === 'buff' && x.u.isParty && x.stat === e.stat && x.d > 0)) miss.push(`${e.stat} の強化`);
            if (e.type === 'damage' && !has((x) => x.t === 'dmg' && x.kind === 'tier' && !x.u.isParty && x.n > 0)) miss.push('ティアのダメージ');
            if (e.type === 'status' && !has((x) => x.t === 'status' && x.on && x.s === e.status && (e.chance == null ? x.u.isParty : !x.u.isParty))) miss.push(`状態 ${e.status}`);
            if (e.type === 'scan' && !has((x) => x.t === 'msg' && /HP\d+\/\d+/.test(x.text))) miss.push('見破り');
            if (e.type === 'escape' && eng.result !== 'escape') miss.push('逃げる');
          }
          const it = DB.items[id];
          if (it.stone) {
            const glim = has((x) => x.t === 'glimmer');
            if (!((user.c.eprof || {})[it.stone] > (ep0[it.stone] || 0)) && !glim) miss.push(`${it.stone} の熟練度`);
            if (!glim && (inv[id] || 0) !== 2) miss.push(`魔石が減らない（${inv[id]}）`);
          } else if ((inv[id] || 0) !== 2) miss.push(`使っても減らない（残り ${inv[id]}）`);
          if (!miss.length) ok = true; else why = miss.join('・');
        }
        if (!ok) errs.push(`${id}（${DB.items[id].name}）: ${why}`);
      }
    });
  } catch (e) { errs.push('例外: ' + (e && e.stack || e).split('\n').slice(0, 3).join(' / ')); }
  finally { U.rng = savedRng; }
  errs.push(`note: ${ids.length} 品を ${zone}（ティア 3）で使った`);
  return errs;
});

// =========================================================================== 入手
check('O1', 'どの道具も手に入る（店・宝箱のプール・魔物のドロップ・ボスの bonus）。レア魔物の道具はその種の通常枠 1/2', () => {
  const errs = [], where = {};
  const note = (id, w) => { (where[id] = where[id] || new Set()).add(w); };
  for (const s of Object.values(DB.shops)) for (const st of STATES) for (const i of shopItems(s, st)) note(i, 'shop');
  for (const p of Object.values(DB.pools)) for (const t of p.tiers) for (const e of t) if (e.item) note(e.item, 'pool');
  const mons = DB.monsters || {};
  for (const [mid, m] of Object.entries(mons)) for (const [slot, d] of Object.entries(m.drops || {})) if (d && d.item) note(d.item, slot === 'bonus' ? 'bonus' : 'mon');
  const haveMons = Object.keys(mons).length > 0;
  for (const c of SPEC_C) {
    const w = where[c.id] || new Set();
    if (c.table === '8.9.2') {
      if (!haveMons) continue;
      const mon = mons[DB.items[c.id].exclusive];
      if (!mon) errs.push(`${c.id}: レア魔物 ${DB.items[c.id].exclusive} が無い`);
      else if (!(mon.drops && mon.drops.normal && mon.drops.normal.item === c.id && mon.drops.normal.rate === (c.id === 'i_dream_fruit' ? 2 : 2))) errs.push(`${c.id}: ${mon && DB.items[c.id].exclusive} の通常枠 ${JSON.stringify(mon.drops && mon.drops.normal)}`);
      const others = Object.entries(mons).filter(([mid, m]) => mid !== DB.items[c.id].exclusive && Object.values(m.drops || {}).some((d) => d && d.item === c.id));
      if (others.length) errs.push(`${c.id}: ほかの魔物も落とす ${others.map(([k]) => k).join(' ')}`);
    } else if (!w.size) errs.push(`${c.id}: どこでも手に入らない`);
    else if (c.via.startsWith('店') && !w.has('shop')) errs.push(`${c.id}: 店に無い`);
    else if (!c.via.startsWith('店') && w.has('shop')) errs.push(`${c.id}: 店に置いてはいけない`);
  }
  if (!haveMons) errs.push('note: DB.monsters が空なので、魔物の枠の確かめを飛ばした');
  return errs;
});
check('O2', '実の数（本編）: ボスの bonus で 活力 9・魔力 11（§9.12.8 の気力 5 は魔力に、A18）。よみがえりの花は魔物の通常枠 7 種（§9.12.3）', () => {
  const mons = DB.monsters || {};
  if (!Object.keys(mons).length) return ['note: DB.monsters が空'];
  const cnt = (id, slot) => Object.values(mons).filter((m) => m.drops && m.drops[slot] && m.drops[slot].item === id).length;
  const errs = [];
  const want = { i_seed_hp: 9, i_seed_mp: 11 };
  for (const [id, n] of Object.entries(want)) if (cnt(id, 'bonus') !== n) errs.push(`${id} bonus ${cnt(id, 'bonus')} ≠ ${n}`);
  if (cnt('i_phoenix', 'normal') !== 7) errs.push(`i_phoenix の通常枠 ${cnt('i_phoenix', 'normal')} ≠ 7`);
  return errs;
});
check('O3', 'ほかの担当が参照する道具・プール・店の id がすべてある（魔物のドロップ・ボスの pool・マップの宝箱・店の NPC）', () => {
  const errs = [], notes = [];
  for (const [mid, m] of Object.entries(DB.monsters || {})) for (const [slot, d] of Object.entries(m.drops || {})) {
    if (!d) continue;
    if (d.item && /^[ik]_/.test(d.item) && !DB.items[d.item]) errs.push(`${mid}.${slot}: 無い品 ${d.item}`);
    if (d.pool && !DB.pools[d.pool]) errs.push(`${mid}.${slot}: 無いプール ${d.pool}`);
  }
  let chests = 0, npcs = 0;
  for (const [mapId, map] of Object.entries(DB.maps || {})) {
    for (const c of map.chests || []) { chests++; if (c.pool && !DB.pools[c.pool]) errs.push(`${mapId} ${c.id}: 無いプール ${c.pool}`); if (c.item) errs.push(`${mapId} ${c.id}: 固定の中身の宝箱（§8.12.1）`); }
    for (const n of map.npcs || []) if (n.shop) { npcs++; if (!DB.shops[n.shop]) errs.push(`${mapId}: 店の NPC の shop ${n.shop} が無い`); }
  }
  notes.push(`note: 宝箱 ${chests}・店の NPC ${npcs} を見た（マップはまだ一部の担当だけ）`);
  return [...errs, ...notes];
});

console.log(`\n${pass} ok / ${fail} NG` + (fail ? `（${fails.join(' ')}）` : ''));
process.exit(fail ? 1 : 0);
