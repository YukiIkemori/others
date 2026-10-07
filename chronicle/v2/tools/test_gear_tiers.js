#!/usr/bin/env node
// test_gear_tiers（RULES）: 装備のティアの見直し（持ち主 2026-10-04。design/notes/gear_tiers.md）
//   店はティア 8 まで／レア T+1・超レア T+2（T8 でレア 9・超レア 10）／クリア後 T9 はレア 11・超レア 12（12 は 13 の強さ）／
//   クリア後の専用の品（系統ごと・防具の枠 × 重さごとに 11 と 12、アクセサリ、全耐性の組ひも）／出どころの網羅／クリア後の率／古いセーブ
//
//   node v2/tools/test_gear_tiers.js
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB, Ru = R.Rules, K = Ru.K;
const ARMOR = ['shield', 'head', 'body', 'hands', 'feet'];
const WEIGHTS = ['heavy', 'light', 'cloth'];
const GEAR = ['weapon', ...ARMOR];

section('tables reach item tier 13');
ok('K.ITEM_TIER_MAX 13, WA / PRICE / W / ACC_W have 14 rising entries', K.ITEM_TIER_MAX === 13 && [K.WA, K.PRICE, K.W, K.ACC_W].every((a) => a.length === 14 && a.every((v, i) => !i || v > a[i - 1] || a === K.ACC_W)));
ok('WA 10..13 continue the curve (steps 54..65, growing)', K.WA.slice(9).every((v, i, a) => !i || (v - a[i - 1] >= 50 && v - a[i - 1] <= 70)), K.WA.slice(9));
ok('D(T) is defined up to 13', K.D(13) > K.D(12) && K.D(12) > K.D(9));

section('value tier table (K.ACQ, R.Rules.valueTier)');
{
  const row = (g) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((T) => Ru.valueTier(g, T)).join();
  ok('rare: T+1 for T0..8, 11 post-clear', row('rare') === '1,2,3,4,5,6,7,8,9,11', row('rare'));
  ok('super: T+2 for T0..8, 12 post-clear', row('super') === '2,3,4,5,6,7,8,9,10,12', row('super'));
  ok('normal (shop): T, capped at 8', row('normal') === '0,1,2,3,4,5,6,7,8,8', row('normal'));
  // grow 'drop' の武器と防具で同じ（旧: 武器だけ T+1）
  const arm = DB.items.hn_st_ironwarden, wpn = DB.items.w_dagger_st_wolfking;
  const a8 = Ru.fillItem(arm, { tier: 8 }), a9 = Ru.fillItem(arm, { tier: 9 }), w8 = Ru.fillItem(wpn, { tier: 8 }), w9 = Ru.fillItem(wpn, { tier: 9 });
  const D = (t) => K.D(t), B = arm.tier;
  ok('super armor at T8 has tier-10 values, at T9 tier-12 values', Math.abs(a8.def - Math.round(arm.def * D(10) / D(B))) <= 1 && Math.abs(a9.def - Math.round(arm.def * D(12) / D(B))) <= 1, [arm.def, a8.def, a9.def]);
  ok('super weapon at T9 has tier-12 values', Math.abs(w9.atk - Math.round(wpn.atk * K.WA[12] / K.WA[wpn.tier])) <= 1 && w9.atk > w8.atk, [wpn.atk, w8.atk, w9.atk]);
}

section('shops: tier 8 is the ceiling (also final chapter and post-clear)');
{
  const over = [];
  for (const sid of Object.keys(DB.shops)) for (let T = 0; T <= 9; T++) for (const id of Ru.shopItems(sid, T)) { const it = DB.items[id]; if (it && GEAR.concat('acc').includes(it.slot) && (it.tier | 0) > 8) over.push(`${sid}@${T}:${id}`); }
  ok('no shop sells gear above tier 8 (any tier 0..9)', over.length === 0, over.slice(0, 8));
  const k8 = Ru.shopItems('shop_kasim_arms', 8);
  ok('Kasim’s stall at T8 still lists the tier-8 weapons of every line', ['w_sword_8', 'w_greatsword_8', 'w_dagger_8', 'w_bow_8', 'w_staff_8'].every((id) => k8.includes(id)), k8);
  ok('the hawks still sell tier-8 daggers and bows at T8', ['w_dagger_8', 'w_bow_8'].every((id) => Ru.shopItems('shop_hawks', 8).includes(id)));
}

section('post-clear gear (items_postclear.js)');
const post = Object.entries(DB.items).filter(([, it]) => it && it.fixedTier);
const t11 = post.filter(([, it]) => it.tier === 11).map(([id]) => id), t12 = post.filter(([, it]) => it.tier === 12).map(([id]) => id);
{
  ok('24 tier-11 rare + 25 tier-12 super items (+ platinum embers, owner 2026-10-05)', t11.length === 24 && t12.length === 25 && t11.every((id) => DB.items[id].grade === 'rare') && t12.every((id) => DB.items[id].grade === 'super'), [t11.length, t12.length]);
  const wt = Object.keys(DB.weaponTypes || {}).filter((w) => w !== 'fist');
  const wtypes = wt.length ? wt : Ru.WTYPES;
  ok('every weapon type has a tier-11 and a tier-12 weapon', wtypes.every((w) => [11, 12].every((t) => post.some(([, it]) => it.slot === 'weapon' && it.wtype === w && it.tier === t))), wtypes);
  ok('every armor slot × weight has tier 11 and 12', ARMOR.every((s) => WEIGHTS.every((g) => [11, 12].every((t) => post.some(([, it]) => it.slot === s && it.weight === g && it.tier === t)))));
  ok('accessories: tier 11 and tier 12 present', [11, 12].every((t) => post.filter(([, it]) => it.slot === 'acc' && it.tier === t).length >= 3));
  ok('tier 12 gear is filled at tier-13 strength (valueTier 13)', t12.every((id) => DB.items[id].valueTier === 13));
  const sw12 = DB.items.w_sword_p12, plain13 = Ru.fillItem({ slot: 'weapon', wtype: 'sword', grade: 'super', tier: 13 });
  ok('e.g. the tier-12 sword hits like a tier-13 super sword', sw12.atk === plain13.atk && sw12.atk > Ru.fillItem({ slot: 'weapon', wtype: 'sword', grade: 'super', tier: 12 }).atk, [sw12.atk, plain13.atk]);
  ok('post-clear items never grow (fixedTier) and are in no chest pool or shop', post.every(([id, it]) => it.grow !== 'drop' && !JSON.stringify(DB.pools).includes('"' + id + '"') && !JSON.stringify(DB.shops).includes('"' + id + '"')));
  const names = post.map(([, it]) => it.name);
  const others = new Set(Object.entries(DB.items).filter(([, it]) => it && !it.fixedTier).map(([, it]) => it.name));
  ok('names are unique and not shared with other items', new Set(names).size === names.length && names.every((n) => !others.has(n)));
  const langs = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];
  const miss = [];
  for (const [id] of post) for (const l of langs) if (!R.I18n.has('items.' + id + '.name', l)) miss.push(`${id}:${l}`);
  ok('names are translated in 5 languages', miss.length === 0, miss.slice(0, 6));
  ok('autoDesc / desc fits 2 lines of 20', post.every(([, it]) => String(it.desc).split('\n').length <= 2 && String(it.desc).split('\n').every((l) => Ru.textWidth(l) <= 20)), post.filter(([, it]) => String(it.desc).split('\n').some((l) => Ru.textWidth(l) > 20)).map(([id]) => id));
}

section('the all-status accessory (星結びの組ひも) blocks every status');
{
  const id = 'ac_st_p12_braid', it = DB.items[id];
  const bad = Object.keys(DB.statuses).filter((s) => DB.statuses[s].bad);
  ok('statusImmune lists every bad status', bad.every((s) => it.mods.statusImmune.includes(s)), bad.filter((s) => !it.mods.statusImmune.includes(s)));
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 3 });
  const c = R.Game.chars[R.Game.hero || 'hero'];
  c.equip.acc1 = id;
  const eng = new R.BattleCore.Engine({ party: [JSON.parse(JSON.stringify(c))], mons: ['void_3'], inv: {}, gold: 0, tier: 9, lv: 64, rng: R.Mon.mkRng('braid') });
  const pu = eng.party[0], mu = eng.mons[0];
  const drain = (g) => { let x = g.next(); while (!x.done) x = g.next(); return x.value; };
  const got = [];
  for (const s of bad) for (let i = 0; i < 20; i++) { if (drain(eng.inflict(mu, pu, s, 1, { quiet: true, sf: 1.8 }))) got.push(s); }
  ok('20 tries × every status at chance 1: none lands, the wearer stays up', got.length === 0 && pu.alive, got);
  const c2 = JSON.parse(JSON.stringify(c)); c2.equip.acc1 = null;
  const eng2 = new R.BattleCore.Engine({ party: [c2], mons: ['void_3'], inv: {}, gold: 0, tier: 9, lv: 64, rng: R.Mon.mkRng('braid2') });
  let landed = 0;
  for (let i = 0; i < 20; i++) { if (drain(eng2.inflict(eng2.mons[0], eng2.party[0], 'poison', 1, { quiet: true }))) { landed++; delete eng2.party[0].status.poison; } }
  ok('control: without it poison lands', landed > 0, landed);
}

section('sources: post-clear monsters cover every tier-11 / tier-12 item');
const postMons = (() => {
  const set = new Set();
  for (const [zid, z] of Object.entries(DB.encounters)) {
    if (!z || z.region !== 'postgame') continue;
    for (const g of z.groups || []) for (const e of g.mons || []) { const m = R.Mon.resolve(e[0], 9); if (m) set.add(m); }
    for (const r of [].concat((DB.rareEncounters || {})[zid] || [])) if (r && r.mon) set.add(r.mon);
  }
  for (const t of Object.values(DB.troops)) if (t && t.tier === 9) for (const e of t.mons || []) set.add(Array.isArray(e) ? e[0] : e);
  return [...set];
})();
{
  const rareSrc = new Set(), superSrc = new Set(), normal = new Set(), where = {};
  for (const m of postMons) {
    const d = (DB.monsters[m] || {}).drops || {};
    if (d.rare) for (const id of [d.rare.item, d.rare.steal]) if (id) { rareSrc.add(id); (where[id] = where[id] || []).push(m); }
    for (const id of [d.super && d.super.item, d.steal && d.steal.item]) if (id) { superSrc.add(id); (where[id] = where[id] || []).push(m); }
    if (d.normal && d.normal.item) normal.add(d.normal.item);
  }
  ok(`post-clear monsters found (${postMons.length})`, postMons.length >= 20 && postMons.includes('b_ouroboros') && postMons.includes('b_valzard_echo'));
  ok('every tier-11 item: steal-rare ∪ rare-drop of a post-clear monster', t11.every((id) => rareSrc.has(id)), t11.filter((id) => !rareSrc.has(id)));
  ok('every tier-12 item: steal-super ∪ super-drop of a post-clear monster', t12.every((id) => superSrc.has(id)), t12.filter((id) => !superSrc.has(id)));
  ok('tier-12 steal-only items sit in drops.steal only; the others in drops.super', t12.every((id) => (DB.items[id].stealOnly ? postMons.some((m) => ((DB.monsters[m].drops || {}).steal || {}).item === id) : postMons.some((m) => ((DB.monsters[m].drops || {}).super || {}).item === id))));
  ok('the post-clear items drop nowhere else', Object.entries(DB.monsters).filter(([m]) => !postMons.includes(m)).every(([, d]) => !JSON.stringify(d.drops || {}).match(/_p1[12]/)));
  const n9 = Object.keys(DB.items).filter((id) => { const it = DB.items[id]; return it && GEAR.includes(it.slot) && it.grade === 'normal' && it.tier === 9; });
  ok(`the ${n9.length} tier-9 normal pieces (天鋼・天馬革・虹絹…) are all post-clear normal drops / steals`, n9.length === 22 && n9.every((id) => normal.has(id)), n9.filter((id) => !normal.has(id)));
  // 終章（T8）の通常の枠は装備を出さない
  const t8 = new Set();
  for (const z of Object.values(DB.encounters)) if (z && z.region === 'finale') for (const g of z.groups || []) for (const e of g.mons || []) t8.add(R.Mon.resolve(e[0], 8));
  const gearN = [...t8].filter((m) => { const n = ((DB.monsters[m] || {}).drops || {}).normal; const it = n && n.item && DB.items[n.item]; return it && GEAR.concat('acc').includes(it.slot); });
  ok('final chapter (T8) normal drops / steals are not equipment', gearN.length === 0, gearN);
}

section('post-clear rates (K.DROP.post)');
{
  // the multiplier itself (a plain slot: rare 16, super 256)
  const d = Object.assign({}, DB.monsters.void_3, { drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'i_ether', rate: 16 }, super: { item: 'i_elixir', rate: 256 } } });
  const c8 = R.Mon.dropChances(d, { tier: 8 }), c9 = R.Mon.dropChances(d, { tier: 9 });
  ok('rare 1/16 → 1/24 post-clear', Math.abs(c8.rare - 1 / 16) < 1e-9 && Math.abs(c9.rare - 1 / 24) < 1e-9, [c8.rare, c9.rare]);
  ok('super halves post-clear', Math.abs(c9.super - c8.super / 2) < 1e-9, [c8.super, c9.super]);
  ok('normal is unchanged', c8.normal === c9.normal);
  // owner 2026-10-05: oblivion mobs offset the multiplier (rare 1/16, super ×2 back)
  const v9 = R.Mon.dropChances(DB.monsters.void_3, { tier: 9 });
  ok('oblivion mobs: rare 1/16, super 1/256 (void_3)', Math.abs(v9.rare - 1 / 16) < 1e-9 && Math.abs(v9.super - 1 / 256) < 1e-9, [v9.rare, v9.super]);
  const boss = R.Mon.dropChances(DB.monsters.b_ouroboros, { tier: 9 });
  ok('the boss’s sure normal slot (rate 1) stays sure', boss.normal === 1);
  // 盗み専用（超レア）の率: 本編のティアは 1/16、クリア後は 1/32
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 4 });
  const c = JSON.parse(JSON.stringify(R.Game.chars[R.Game.hero || 'hero']));
  const mk = (tier) => new R.BattleCore.Engine({ party: [c], mons: ['jelly_5'], inv: {}, gold: 0, tier, lv: 60, rng: R.Mon.mkRng('st') });
  const e8 = mk(8), e9 = mk(9);
  const p8 = e8.stealOnlyChance(e8.party[0], e8.mons[0], false), p9 = e9.stealOnlyChance(e9.party[0], e9.mons[0], false);
  ok('steal-super 1/16 → 1/32 post-clear', Math.abs(p8 - 1 / 16) < 1e-9 && Math.abs(p9 - 1 / 32) < 1e-9, [p8, p9]);
  // 盗みのレアはレアの枠の steal（落とす品と別）
  let stolen = null;
  for (let i = 0; i < 400 && !stolen; i++) { const p = e9.stealPick(e9.mons[0], 50); if (p && p.grade === 'rare') stolen = p.item; }
  ok('steal-rare takes drops.rare.steal (not the dropped rare)', stolen === DB.monsters.jelly_5.drops.rare.steal && stolen !== DB.monsters.jelly_5.drops.rare.item, stolen);
}

section('acquisition tier and old saves');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 5 });
  const G = R.Game;
  G.tier = 8;
  R.State.gain('w_dagger_st_wolfking', 1, { tier: 9 });
  ok('a post-clear battle gain (tier 9) records tier-12 values for a super steal item', G.uniques.w_dagger_st_wolfking.tier === 9 && Ru.itemOf('w_dagger_st_wolfking').atk === Ru.fillItem(DB.items.w_dagger_st_wolfking, { tier: 9 }).atk);
  R.State.gain('hn_st_ironwarden', 1);
  ok('a normal gain uses the game tier (8 → super value 10)', G.uniques.hn_st_ironwarden.tier === 8);
  R.State.gain('w_sword_p12', 1, { tier: 9 });
  ok('fixed post-clear items keep their own values', !G.uniques.w_sword_p12 && Ru.itemOf('w_sword_p12').atk === DB.items.w_sword_p12.atk);
  // 古いセーブ: 旧の値の uniques（防具はティア T の値）・店で買ったティア 9 の通常品・旧の盗みの品
  const old = R.State.serialize();
  old.items = Object.assign({}, old.items, { w_sword_9: 1, bd_mail_9: 1, hn_st_ironwarden: 1 });
  old.uniques = { hn_st_ironwarden: { tier: 5, def: 40, mdef: 8, price: 1000 }, w_sword_tide: { tier: 3, atk: 60, mag: 30, price: 500 } };
  let err = null;
  try { R.State.deserialize(JSON.parse(JSON.stringify(old))); } catch (e) { err = e; }
  ok('an old save with old-rule uniques loads', !err && R.Game.items.w_sword_9 === 1 && Ru.itemOf('hn_st_ironwarden').def === 40, err && err.message);
  R.State.gain('hn_st_ironwarden', 1);
  ok('…and a later gain raises the old record to the new value', R.Game.uniques.hn_st_ironwarden.tier === 8 && Ru.itemOf('hn_st_ironwarden').def > 40);
}

section('balance (tools/sim_gear_bosses.js, quick)');
{
  const S = require('./sim_gear_bosses');
  const n = 30;
  const a = S.run(R, 'tr_b_nemrea2', 'F-a', n, 'test').winPct, c = S.run(R, 'tr_b_nemrea2', 'F-c', n, 'test').winPct;
  ok('last boss: shop 8 alone usually loses, rare 9 + super 10 wins', a <= 45 && c >= 60, [a, c]);
  const pc = S.run(R, 'tr_b_ouroboros', 'P-c', n, 'test').winPct, pf = S.run(R, 'tr_b_ouroboros', 'P-f', n, 'test').winPct;
  ok('super boss: main-game best loses, a tier 11–12 set wins', pc <= 20 && pf >= 50, [pc, pf]);
}

done('test_gear_tiers');
