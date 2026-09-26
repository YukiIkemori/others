// TERRAIN: テーマ（R.Contract.THEMES）と光の既定、ワールドの一枚絵（V2_PLAN §2.5.8 worldThumb・ambient、MODERN_UI §7.3・§7.6）
//
//   R.Terrain.theme(map) → テーマの表（id, ground, tree, leaf, mood, decor, air…）   map.theme か、無ければ kind と素材から決める
//   R.Terrain.ambient(map, tier) → {ambient, k, mood}
//       ambient = 掛ける環境光の色（map.light.ambient か mood の色 × R.Sky.at(tier).ambientMul）、mood = R.Contract.MOODS の 1 つ、
//       k = R.Light.compose の k（環境光の効き。1 = そのまま掛ける）。map.light.k は ART_REWORK §1.4 の「明るさ」（夜の町 0.45・ダンジョン 0.55〜0.7・
//       屋内 0.85・昼 1.0）なので、ここで効きに直す（0.45 以下 → 1、1.0 → 0）。
//   R.Terrain.worldThumb(tier) → canvas   ワールド（kind 'world' のマップ）の 1 マス 3 論理 px の一枚絵（MENUS の地図・FIELD の小地図）
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});

  // ground = 木・藪の下の地面、tree = 木の素材のマスに立てる木、leaf = 葉の色、decor = 地面の小さな飾り（1 マスあたりの割合）、
  // fireflies = 1 チャンクの蛍の数、pools = 水が光る（洞窟）、edgeTrees = 深い森の縁に木を並べる
  const THEMES = {
    harbor: { ground: 'cobble', tree: ['tree'], leaf: 'leaf', mood: 'town_night', decor: { dec_pebbles: 0.03 }, fireflies: 3, outside: 'sea' },
    treetop: { ground: 'moss_earth', tree: ['tree_giant', 'tree'], leaf: 'moss', mood: 'forest_night', decor: { dec_tuft: 0.12, dec_mush: 0.05, dec_flowers: 0.03 }, fireflies: 10, outside: 'forest_dark', edgeTrees: true },
    moss_village: { ground: 'moss_earth', tree: ['tree'], leaf: 'moss', mood: 'forest_night', decor: { dec_tuft: 0.1, dec_mush: 0.06, dec_pebbles: 0.03 }, fireflies: 8, outside: 'forest_dark', edgeTrees: true },
    forest_dungeon: { ground: 'grass', tree: ['tree', 'pine'], leaf: 'dk', mood: 'forest_night', decor: { dec_tuft: 0.14, dec_mush: 0.05, dec_leaves: 0.05 }, fireflies: 8, outside: 'forest_dark', edgeTrees: true },
    tree_inside: { ground: 'bark_floor', tree: ['tree'], leaf: 'moss', mood: 'tree', decor: { dec_mush: 0.08 }, fireflies: 6, outside: 'wall_bark' },
    lighthouse: { ground: 'stone_floor', tree: ['tree'], leaf: 'leaf', mood: 'tower', decor: { dec_pebbles: 0.03 }, fireflies: 0, outside: 'wall_stone' },
    cave: { ground: 'cave_floor', tree: ['tree'], leaf: 'dk', mood: 'cave', decor: { dec_pebbles: 0.05, dec_mush: 0.03 }, fireflies: 5, outside: 'wall_cave', pools: true },
    world: { ground: 'grass', tree: ['pine', 'tree'], leaf: 'leaf', mood: 'night', decor: { dec_tuft: 0.06, dec_flowers: 0.02, dec_pebbles: 0.02 }, fireflies: 5, outside: 'sea', edgeTrees: true, twoTrees: true },
    hill_village: { ground: 'grass', tree: ['tree'], leaf: 'leaf', mood: 'town_night', decor: { dec_tuft: 0.07, dec_flowers: 0.05 }, fireflies: 4, outside: 'grass' },
    interior: { ground: 'wood_floor', tree: ['tree'], leaf: 'leaf', mood: 'interior', decor: {}, fireflies: 0, outside: 'wall_wood' },
  };
  for (const id of Object.keys(THEMES)) THEMES[id].id = id;
  T.THEMES = THEMES;

  const themeCache = new WeakMap();
  T.theme = function (map) {
    if (!map) return THEMES.world;
    if (map.theme && THEMES[map.theme]) return THEMES[map.theme];
    let t = themeCache.get(map);
    if (t) return t;
    const mats = {};
    for (const k of Object.keys(map.legend || {})) { const e = map.legend[k]; if (e && e.mat) mats[e.mat] = 1; }
    const has = (...ids) => ids.some((i) => mats[i]);
    let id;
    if (map.kind === 'world') id = 'world';
    else if (map.kind === 'interior') id = has('stone_floor', 'wall_stone') && !has('wood_floor', 'carpet') ? 'lighthouse' : 'interior';
    else if (map.kind === 'dungeon') id = has('wall_cave', 'cave_floor') ? 'cave' : has('wall_bark', 'bark_floor', 'root_floor') ? 'tree_inside' : has('forest_dark', 'tree', 'tall_grass') ? 'forest_dungeon' : has('wall_stone', 'stone_floor') ? 'lighthouse' : 'cave';
    else id = has('deck', 'ladder') ? 'treetop' : has('pier', 'sea', 'cobble') ? 'harbor' : has('moss_earth', 'wall_moss') ? 'moss_village' : 'hill_village';
    t = THEMES[id];
    themeCache.set(map, t);
    return t;
  };

  /** map.light.k（明るさ）→ R.Light.compose の k（効き） */
  function effect(k) {
    if (k == null) return 1;
    return Math.max(0, Math.min(1, (1 - k) / 0.55));
  }
  T.ambient = function (map, tier) {
    const th = T.theme(map), l = (map && map.light) || {};
    const mood = l.mood && (!R.Contract || R.Contract.MOODS.includes(l.mood)) ? l.mood : th.mood;
    let base = l.ambient;
    if (!base) { const m = R.Hd && R.Hd.mood ? R.Hd.mood(mood) : null; base = (m && m.ambient) || '#5c5aa0'; }
    const t = tier == null ? (R.Tier && R.Tier.get ? R.Tier.get() : 0) : tier;
    let ambient = base;
    if (R.Sky && R.Sky.at) {
      const mul = R.Sky.at(t).ambientMul / R.Sky.at(0).ambientMul;
      const c = T._u.hex(toHex(base));
      ambient = '#' + c.map((v) => Math.min(255, Math.round(v * mul)).toString(16).padStart(2, '0')).join('');
    } else ambient = toHex(base);
    return { ambient, k: effect(l.k), mood };
  };
  function toHex(c) {
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    const m = /rgba?\(([^)]+)\)/.exec(String(c));
    if (m) return '#' + m[1].split(',').slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('');
    return '#5c5aa0';
  }

  // ------------------------------------------------------------------ ワールドの一枚絵
  const thumbs = {};
  T.worldThumb = function (tier) {
    const t = tier == null ? (R.Tier && R.Tier.get ? R.Tier.get() : 0) : tier;
    const map = R.DB.maps.world || Object.values(R.DB.maps).find((m) => m && m.kind === 'world');
    if (!map) return null;
    const key = map.id + '|' + t;
    if (thumbs[key]) return thumbs[key];
    const K = 3, W = map.w * K, H = map.h * K, c = T._u.canvas(W, H);
    if (!c) return null;
    const g = c.getContext('2d'), img = g.createImageData(W, H), d32 = new Uint32Array(img.data.buffer), U = T._u;
    const amb = U.hex(T.ambient(map, t).ambient), lum = 0.55 + Math.min(8, t) * 0.04;
    const grid = R.MapUtil.grid(map), colors = {};
    const colorOf = (mat) => colors[mat] || (colors[mat] = U.hex(rgbHex(T.matColor(mat))));
    for (let y = 0; y < map.h; y++) {
      const row = grid[y] || '';
      const chars = row.length === map.w ? null : [...row];
      for (let x = 0; x < map.w; x++) {
        const ch = chars ? chars[x] : row.charAt(x), e = (map.legend && map.legend[ch]) || { mat: map.outside || 'sea' };
        const base = colorOf(e.mat);
        for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
          const n = (U.h3(x * K + i, y * K + j, 5) - 0.5) * 0.12;
          const f = (1 + n) * lum;
          let c2 = [base[0] * f * (0.55 + (amb[0] / 255) * 0.6), base[1] * f * (0.55 + (amb[1] / 255) * 0.6), base[2] * f * (0.55 + (amb[2] / 255) * 0.6)];
          const m = T._matInfo(e.mat);
          if ((m.tall === 'tree' || m.tall === 'canopy') && ((i + j + x + y) & 1)) c2 = c2.map((v) => v * 0.7);
          d32[(y * K + j) * W + x * K + i] = U.pack(c2);
        }
      }
    }
    g.putImageData(img, 0, 0);
    // 町・ダンジョンの入口に灯りの点（地図の読みやすさ）
    for (const o of map.objects || []) {
      if (o.type !== 'building' && o.type !== 'waylamp' && !(o.type === 'prop' && /lamp|beacon/.test(o.id || ''))) continue;
      g.fillStyle = 'rgba(255,208,128,0.9)';
      g.fillRect(o.x * K + 1, o.y * K + 1, K - 1, K - 1);
    }
    return (thumbs[key] = c);
  };
  function rgbHex(css) { const m = /rgb\(([^)]+)\)/.exec(css); return m ? '#' + m[1].split(',').map((v) => (+v | 0).toString(16).padStart(2, '0')).join('') : '#304030'; }
  R.on && R.on('tier', () => { for (const k of Object.keys(thumbs)) delete thumbs[k]; });
})(window.RPG);
