// WORLD v3（2026-09-28）: 広げたワールドの道しるべと寄り道の名所（tools/world_poi.js が置く examine）。ボイスなし、短い地の文だけ。
//   world_poi_shrine   街道の祠（手を合わせる。何も起きない、旅の一息）
//   world_poi_stones   立石の輪（古い刻み）
//   world_poi_cache    名所の裏の小さな隠し物（1 回だけ。物の item、覚えの鍵は key）
//   world_poi_*        名所ごとの一言（遺跡・物見の塔・沈んだ鐘楼…）
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;
  const lines = (list) => ({ meta: { needs: [], gives: [] }, run: async (ev) => { const E = X(); for (const t of list) await E.narr(ev, t); } });

  D.world_poi_shrine = { meta: { needs: [], gives: [] }, run: async (ev) => {
    const E = X();
    const n = (ev.var('world_shrine_prayers') || 0) + 1;
    ev.setVar('world_shrine_prayers', n);
    await E.narr(ev, n === 1 ? R.T('ev.world_poi.world_poi_shrine.run.narr') : R.T('ev.world_poi.world_poi_shrine.run.narr_2'));
    await E.narr(ev, R.T('ev.world_poi.world_poi_shrine.run.narr_3')[n % 3]);
  } };
  // ロアの丘の古い風車の戸（オーナー 2026-09-28「今は特に入れなくていいから、今は入れないようだ、みたいなメッセージが調べると出るように」）
  D.world_poi_windmill = lines([R.T('ev.world_poi.lines.0')]);
  D.world_poi_stones = lines(R.T('ev.world_poi.lines'));
  D.world_poi_forest_tower = lines(R.T('ev.world_poi.lines_2'));
  D.world_poi_forest_ring = lines(R.T('ev.world_poi.lines_3'));
  D.world_poi_forest_statue = lines(R.T('ev.world_poi.lines_4'));
  D.world_poi_plains_found = lines(R.T('ev.world_poi.lines_5'));
  D.world_poi_pen_wall = lines(R.T('ev.world_poi.lines_6'));
  D.world_poi_pen_lookout = lines(R.T('ev.world_poi.lines_7'));
  D.world_poi_snow_tower = lines(R.T('ev.world_poi.lines_8'));
  D.world_poi_desert_ruin = lines(R.T('ev.world_poi.lines_9'));
  D.world_poi_marsh_bell = lines(R.T('ev.world_poi.lines_10'));
  D.world_poi_marsh_stilt = lines(R.T('ev.world_poi.lines_11'));
  D.world_poi_cache = { meta: { needs: [], gives: ['item:i_ether', 'item:i_potion'] }, run: async (ev, args) => {
    const E = X(), m = R.DB.maps[(args && args.map) || 'world'];
    const o = m && (R.MapUtil.objectsAt(m, args.x, args.y) || []).find((q) => q.type === 'examine' && q.item);
    const key = 'world_cache_' + ((o && o.key) || (args.x + '_' + args.y));
    if (!o || ev.flag(key)) { await E.narr(ev, R.T('ev.world_poi.world_poi_cache.run.narr')); return; }
    await E.narr(ev, R.T('ev.world_poi.world_poi_cache.run.narr_2'));
    await E.give(ev, o.item, 1, { say: true });
    ev.setFlag(key);
  } };
})(window.RPG);
