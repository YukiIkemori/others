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
    await E.narr(ev, n === 1 ? '道ばたの小さなほこら。\n旅の無事を願う石の像が\nまつられている。' : 'ほこらに手を合わせた。');
    await E.narr(ev, [ '供えられた野の花が、\nまだ新しい。', 'だれかが灯したろうそくの跡が\n石に残っている。', '風が、少しだけやわらいだ\n気がした。' ][n % 3]);
  } };
  D.world_poi_stones = lines(['古い立石が輪になって並んでいる。', '石の肌に、読めない文字が\nかすかに刻まれている。\n……灯火の印に、似ている。']);
  D.world_poi_forest_tower = lines(['崩れかけた見張りの塔。', '石段の奥は、根と土で\nふさがっている。\n昔はここから森を見わたしたのだろう。']);
  D.world_poi_forest_ring = lines(['こけむした柱が、円く並んでいる。', 'まん中の床石に、\n千年樹の葉の模様。']);
  D.world_poi_forest_statue = lines(['倒れた大きな石像。\n衣をまとった人の姿だ。', '顔はもう、すり減って\nわからない。']);
  D.world_poi_plains_found = lines(['草に埋もれた石の土台。\n三段の石段だけが残っている。', '昔の宿場の跡だろうか。']);
  D.world_poi_pen_wall = lines(['海を見下ろす、古い石の壁。', '窓の穴から、灯台の光が\n遠くに見える。']);
  D.world_poi_pen_lookout = lines(['木組みの物見台。', '上から見ると、半島の牧草地と\n北の海が一望できる。']);
  D.world_poi_snow_tower = lines(['雪に埋もれた石の塔。', '北の流氷原の方角に、\n窓がひとつだけ開いている。']);
  D.world_poi_desert_ruin = lines(['砂に半分埋もれた神殿の顔。', '二本の柱のあいだから、\n冷たい風が吹いてくる。']);
  D.world_poi_marsh_bell = lines(['沼から突き出た、古い鐘楼。', 'こけの中に、さびた鐘が\n傾いて下がっている。\n……鳴らない。']);
  D.world_poi_marsh_stilt = lines(['高床の小屋の跡。', '床板は抜け、屋根だけが\n沼の上に傾いている。']);
  D.world_poi_cache = { meta: { needs: [], gives: ['item:i_ether', 'item:i_potion'] }, run: async (ev, args) => {
    const E = X(), m = R.DB.maps[(args && args.map) || 'world'];
    const o = m && (R.MapUtil.objectsAt(m, args.x, args.y) || []).find((q) => q.type === 'examine' && q.item);
    const key = 'world_cache_' + ((o && o.key) || (args.x + '_' + args.y));
    if (!o || ev.flag(key)) { await E.narr(ev, '石のすきまには、もう何もない。'); return; }
    await E.narr(ev, '石のすきまに、旅人の\n小さな包みが押しこまれている。');
    await E.give(ev, o.item, 1, { say: true });
    ev.setFlag(key);
  } };
})(window.RPG);
