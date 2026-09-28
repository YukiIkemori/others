#!/usr/bin/env node
// 地方ごとの出現の固定のテスト（node）: 解決した地方の雑魚は解決する直前のティアの強さと顔ぶれのまま（R.Tier.forZone）。
//   解決していない地方は全体のティアで伸びる / セーブと読み込みで固定が残る / 固定の無い古いセーブも動く（章の並びから埋める）。
//   node v2/tools/test_zone_lock.js
'use strict';
const load = require('./lib/load');
const { ok, section, done } = require('./lib/testkit');

const R = load({ quiet: true });
const DB = R.DB, M = R.Mon, T = R.Tier;

function newGame() {
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 4242 });
  M.resetEncounter();
}
/** 表の n 歩ぶん（force）の出現: 戦闘レベルの集合と魔物の id の集合 */
function sample(zone, n) {
  const lvs = new Set(), ids = new Set(), tiers = new Set();
  for (let s = 0; s < n; s++) {
    const st = M.encounter(zone, { tier: T.get(), steps: 10000 + s * 7, force: true, noRare: true, noGolden: true, partySize: 4 });
    if (!st) continue;
    tiers.add(st.tier); lvs.add(st.lv);
    for (const [id] of st.mons) ids.add(id);
  }
  return { lvs: [...lvs].sort((a, b) => a - b), ids: [...ids].sort(), tiers: [...tiers] };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** ev.clearRegion の状態の所だけ（演出なし） */
async function clear(rid) {
  const cel = T.celebrate;
  T.celebrate = async () => true;
  try { await R.Events._clearRegion(rid); } finally { T.celebrate = cel; }
}

(async () => {
  section('API');
  ok('R.Tier.forZone / lockOf / lockRegion / migrateLocks', ['forZone', 'lockOf', 'lockRegion', 'migrateLocks'].every((k) => typeof T[k] === 'function'));
  ok('every dyn zone has a region in DB.regions', Object.keys(DB.encounters).filter((z) => DB.encounters[z].tier === 'dyn' && !DB.regions[DB.encounters[z].region]).length === 0,
    Object.keys(DB.encounters).filter((z) => DB.encounters[z].tier === 'dyn' && !DB.regions[DB.encounters[z].region]));

  section('clear region A at tier t, then advance');
  newGame();
  const G = () => R.Game;
  G().tier = 1;   // 森を先に（t = 1 で戦っていた）— ここでは砂漠を t=1 で解決する
  const zA = 'zw_desert', zA2 = 'z_desert_tomb', zB = 'zw_snow';
  const beforeA = sample(zA, 200), beforeA2 = sample(zA2, 200);
  ok('uncleared region A rolls at the global tier', beforeA.tiers.length === 1 && beforeA.tiers[0] === 1 && same(beforeA.lvs, [M.LZ(1) + (DB.encounters[zA].lvOff || 0)]), beforeA);
  await clear('r_desert');
  ok('clearRegion records the tier before the increment', G().regionTier.r_desert === 1 && G().tier === 2, { rt: G().regionTier, tier: G().tier });
  G().tier = 4;   // さらに 2 地方ぶん進んだ（t + 3）
  M.clearCache();
  const afterA = sample(zA, 200), afterA2 = sample(zA2, 200);
  ok('region A: battle level stays LZ(t)+lvOff', afterA.tiers[0] === 1 && same(afterA.lvs, beforeA.lvs), afterA);
  ok('region A: same species set', same(afterA.ids, beforeA.ids), { before: beforeA.ids, after: afterA.ids });
  ok('region A dungeon zone: same level and species', same(afterA2.lvs, beforeA2.lvs) && same(afterA2.ids, beforeA2.ids), { beforeA2, afterA2 });
  {
    // 確かめ: 固定が無ければティア 4 では別の段が出る（上の「同じ顔ぶれ」が意味を持つ）
    delete G().cleared.r_desert; delete G().flags.cleared_r_desert;
    const u = sample(zA, 200);
    G().cleared.r_desert = true; G().flags.cleared_r_desert = true;
    ok('(sanity) without the lock tier 4 rolls other species and level', !same(u.ids, beforeA.ids) && u.lvs[0] > beforeA.lvs[0], u);
  }
  ok('forZone of region A = 1 at tier 4', T.forZone(zA) === 1 && T.forZone(zA2) === 1);
  const B = sample(zB, 200);
  ok('uncleared region B scales with the global tier', B.tiers[0] === 4 && same(B.lvs, [M.LZ(4) + (DB.encounters[zB].lvOff || 0)]), B);
  ok('fixed-tier zones keep their number', T.forZone('zw_center') === 8 && T.forZone('zw_peninsula') === 0);
  ok('unknown / region-less zone → global tier', T.forZone('z_nope') === 4 && (DB.encounters.z_stub ? T.forZone('z_stub') === 4 : true));
  {
    const zl = R.Rules.zoneLevel(zA, null);
    ok('Rules.zoneLevel uses the lock', zl.Tb === 1 && zl.Lb === M.LZ(1) + (DB.encounters[zA].lvOff || 0), zl);
  }
  // 解決した地方の方が魔除けの香で避けられる（固定の低い戦闘レベルで判定）
  ok('ward check uses the locked level (zoneLb)', M.zoneLb(DB.encounters[zA], T.forZone(zA)).hi === M.LZ(1) + (DB.encounters[zA].lvOff || 0));

  section('prologue');
  ok('prologue not cleared yet → z_well follows the global tier', T.forZone('z_well') === 4);
  R.Game.chronicle.chapters.unshift({ id: 'prologue', summaryKey: 'prologue' });
  ok('prologue chapter → z_well locks at tier 0', T.forZone('z_well') === 0 && R.Game.regionTier.prologue === 0);
  ok('prologue / peninsula zones stay at tier 0', ['zw_prologue', 'zw_peninsula', 'z_lighthouse'].every((z) => T.forZone(z) === 0));
  {
    const w = sample('z_well', 100);
    ok('z_well rolls LZ(0)+1 at tier 4', same(w.lvs, [M.LZ(0) + 1]), w);
  }

  section('save / load');
  const snap = JSON.parse(JSON.stringify(R.State.serialize()));
  ok('regionTier is saved', snap.regionTier && snap.regionTier.r_desert === 1);
  newGame();
  ok('fresh game has no locks', same(R.Game.regionTier, {}) && T.forZone(zA) === 0);
  ok('deserialize ok', R.State.deserialize(JSON.parse(JSON.stringify(snap))));
  ok('lock survives load', R.Game.regionTier.r_desert === 1 && T.forZone(zA) === 1 && T.forZone(zB) === 4);
  ok('contract accepts the game', R.Contract.check('game', R.Game).ok, R.Contract.check('game', R.Game).errors);

  section('old save without locks');
  {
    // 序章 → 森（T0）→ 砂漠（T1）→ 雪原（T2）の順に解決した、regionTier の無いセーブ
    newGame();
    const g = R.Game;
    g.tier = 3; g.chapter = 3;
    for (const r of ['r_forest', 'r_desert', 'r_snow']) { g.cleared[r] = true; g.flags['cleared_' + r] = true; }
    g.chronicle.chapters = ['prologue', 'r_forest', 'r_snow', 'r_desert'].map((id) => ({ id, summaryKey: id }));   // 雪原を砂漠より先に
    const old = JSON.parse(JSON.stringify(R.State.serialize()));
    delete old.regionTier;
    ok('old save loads', R.State.deserialize(old));
    const rt = R.Game.regionTier;
    ok('locks derived from the chapter order', rt.prologue === 0 && rt.r_forest === 0 && rt.r_snow === 1 && rt.r_desert === 2, rt);
    ok('uncleared region still global', T.forZone('zw_marsh') === 3 && T.lockOf('r_marsh') === null);
    ok('derived lock is used by encounters', sample('zw_snow', 50).tiers[0] === 1);
    // 章にも無い（テストの状態など）: min(n − 1, tier − 1)
    newGame();
    R.Game.tier = 5; R.Game.cleared.r_marsh = true;
    ok('no chapter entry → min(n-1, tier-1)', T.lockOf('r_marsh') === 3 && R.Game.regionTier.r_marsh === 3);
    newGame();
    R.Game.tier = 1; R.Game.cleared.r_ash = true;
    ok('no chapter entry, early → tier-1', T.lockOf('r_ash') === 0);
    // 版 2 の古いセーブで regionTier が変な形でも壊れない
    const bad = JSON.parse(JSON.stringify(R.State.serialize()));
    bad.regionTier = [1, 2];
    ok('bad regionTier shape is replaced', R.State.deserialize(bad) && !Array.isArray(R.Game.regionTier) && typeof R.Game.regionTier === 'object');
  }

  section('clearRegion twice does not move the lock');
  newGame();
  R.Game.tier = 2;
  await clear('r_marsh');
  R.Game.tier = 6;
  await clear('r_marsh');
  ok('lock stays at 2', R.Game.regionTier.r_marsh === 2 && T.forZone('zw_marsh') === 2);

  done('test_zone_lock');
})().catch((e) => { console.error(e); process.exitCode = 1; });
