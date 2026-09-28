// WORLD v3（2026-09-28）: 広げたワールドの空いた所を埋める段（tools/world_scale.js の後、gen_world.js が呼ぶ。scratchpad の worldv3/DESIGN.md §2）
//   1. 森の中の木は「森の地面の木」（'t'）にする（木の下の地面が森の地面）
//   2. 島（小さな入口）・町の spawn から一番近い道まで、1 マスの小道を引く（K 倍で道から離れた入口）
//   3. 街道の脇に 30〜40 歩ごとの道しるべ（祠・野営の跡・道標・立石…。地方で絵が変わる）。野営の跡は灯籠で安全
//   4. 道から少し入った名所（遺跡・物見の塔・立石の輪・沈んだ鐘楼…）と小さな隠し物。道から小道を引く
//   5. ワールドの凡例の素材を wm_*（src/art/terrain/wmats.js、描いた素材）に替える
// 置く物の絵は v2/assets/env/world/props/lm_*（type 'prop'、w・h・lm: true。当たりは w×h の枠。src/art/terrain/landmarks.js が描く）。
'use strict';

// ワールドの凡例の素材 → ワールドの素材（src/art/terrain/wmats.js の T.WORLD_MATS と同じ表）
const WM = { grass: 'wm_grass', flowers: 'wm_flowers', tall_grass: 'wm_tall_grass', moss_earth: 'wm_forest_floor', dirt: 'wm_dirt', road: 'wm_road', mud: 'wm_mud',
  sand: 'wm_sand', dune_sand: 'wm_dune', cracked_clay: 'wm_clay', snow: 'wm_snow', snow_path: 'wm_snow_path', ice: 'wm_ice', peat_grass: 'wm_peat',
  marsh_water: 'wm_marsh_water', rock: 'wm_rock', ash: 'wm_ash', obsidian: 'wm_obsidian', sea: 'wm_sea', deep_water: 'wm_deep', shallow: 'wm_shallow', water: 'wm_lake' };
// 名所・道しるべの絵（src/art/terrain/landmarks.js の POI と同じ id。[幅, 高さ] は当たりの枠）
const FP = {
  lm_way_shrine: [2, 2], lm_way_post: [2, 1], lm_way_caravan: [4, 3], lm_way_stones: [4, 3], lm_way_tower: [3, 3], lm_way_lookout: [3, 3],
  lm_ruin_wall: [4, 1], lm_ruin_arch: [3, 1], lm_ruin_pillars: [4, 3], lm_ruin_tower: [3, 3], lm_ruin_found: [4, 3], lm_ruin_statue: [4, 2],
  lm_desert_camp: [3, 2], lm_desert_ruin: [4, 2], lm_marsh_stilt: [3, 3], lm_marsh_belltower: [2, 2], lm_ash_shrine: [3, 2], lm_ash_fumarole: [2, 2],
};

module.exports = Object.assign(function worldPoi(A) {
  const { g, W, H, LEGEND, SCALE, objects, npcs, exits, spawns, h2 } = A;
  const info = {};
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x, y) => (inB(x, y) ? g[y][x] : 'O');
  const kind = SCALE.kind, tcore = SCALE.tcore;
  const walkCh = (c) => { const l = LEGEND[c]; return !!l && !l.solid && l.walk !== false; };
  const ROADCH = new Set(SCALE.roadsW.map((r) => r.ch).concat(['.', 'd', 'P', 'Z', 'K']));

  // ---------------------------------------------------------------- 1. 森の地面の木
  LEGEND.t = { mat: 'tree', solid: true, under: 'moss_earth' };
  let nt = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'T' || tcore[y * W + x] === 0) continue;
    let h = 0, o = 0;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const c = get(x + i, y + j); if (c === 'h') h++; else if (',;"s'.includes(c)) o++; }
    if (h > o) { g[y][x] = 't'; nt++; }
  }
  info.forestTrees = nt;

  // ---------------------------------------------------------------- 物の場所（当たり・目印）
  const occ = new Set();
  const mark = [];   // 目印（名所どうしを離す）
  const addOcc = (x, y, w, h) => { for (let j = 0; j < (h || 1); j++) for (let i = 0; i < (w || 1); i++) occ.add((x + i) + ',' + (y + j)); };
  for (const o of objects) if (o.x != null) { addOcc(o.x, o.y, o.w || (o.type === 'spring' ? 2 : 1), o.h || (o.type === 'spring' ? 2 : 1)); if (/waylamp|sign|building|stairs|examine/.test(o.type) || (o.type === 'prop' && /tent|lamp|lantern|beacon|ship|tree_giant|obelisk/.test(o.id))) mark.push([o.x, o.y]); }
  for (const n of npcs) { addOcc(n.x - 1, n.y - 1, 3, 3); mark.push([n.x, n.y]); }
  for (const e of exits) addOcc(e.x - 1, e.y - 1, (e.w || 1) + 2, (e.h || 1) + 2);
  for (const k of Object.keys(spawns)) addOcc(spawns[k].x - 1, spawns[k].y - 1, 3, 3);
  const nearMark = (x, y, r) => mark.some(([a, b]) => Math.abs(a - x) <= r && Math.abs(b - y) <= r);
  /** 枠 + まわり m マスがすべて空いた歩ける地面（道・水・壁・core の外） */
  function free(x0, y0, w, h, m) {
    for (let y = y0 - m; y < y0 + h + m; y++) for (let x = x0 - m; x < x0 + w + m; x++) {
      if (!inB(x, y) || tcore[y * W + x] === 0 || occ.has(x + ',' + y)) return false;
      const c = g[y][x];
      if (ROADCH.has(c) || !walkCh(c) || kind(c) !== 'ground') return false;
    }
    return true;
  }
  /** 木（森）を切り開いてもよい版: 地面か木なら可（名所の空き地を森の中に作る） */
  function clearable(x0, y0, w, h, m) {
    for (let y = y0 - m; y < y0 + h + m; y++) for (let x = x0 - m; x < x0 + w + m; x++) {
      if (!inB(x, y) || tcore[y * W + x] === 0 || occ.has(x + ',' + y)) return false;
      const c = g[y][x], k = kind(c);
      if (ROADCH.has(c) || !(k === 'ground' || k === 'feature')) return false;
    }
    return true;
  }
  const groundOf = (x, y) => {
    const cnt = {};
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const c = get(x + i, y + j); if (kind(c) === 'ground' && !ROADCH.has(c)) cnt[c] = (cnt[c] || 0) + 1; }
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || ',';
  };
  function clearRect(x0, y0, w, h, m) {
    const gr = groundOf(x0 + (w >> 1), y0 + (h >> 1));
    for (let y = y0 - m; y < y0 + h + m; y++) for (let x = x0 - m; x < x0 + w + m; x++) if (inB(x, y) && kind(g[y][x]) === 'feature') g[y][x] = gr;
  }
  function biome(x, y) {
    const cnt = { plains: 0, forest: 0, desert: 0, snow: 0, marsh: 0, ash: 0 };
    for (let j = -4; j <= 4; j += 2) for (let i = -4; i <= 4; i += 2) {
      const c = get(x + i, y + j);
      if (',;"'.includes(c)) cnt.plains++; else if ('ht'.includes(c)) cnt.forest++; else if ('sukXQ'.includes(c)) cnt.desert++;
      else if ('nIYM'.includes(c)) cnt.snow++; else if ('GWRVZ'.includes(c)) cnt.marsh++; else if ('ajv%'.includes(c)) cnt.ash++;
    }
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  }
  let nObj = 0;
  function place(id, x0, y0, extra) {
    const [w, h] = FP[id];
    objects.push(Object.assign({ type: 'prop', id, x: x0, y: y0, w, h, lm: true }, extra || {}));
    addOcc(x0 - 1, y0 - 1, w + 2, h + 2); mark.push([x0 + (w >> 1), y0 + h - 1]); nObj++;
  }

  // ---------------------------------------------------------------- 2. 入口から道への小道（BFS。木は切り開く、水・壁・建物は通らない）
  const isRoad = (x, y) => ROADCH.has(get(x, y));
  function pathTo(sx, sy, goal, lim) {
    const seen = new Map(), q = [[sx, sy]]; seen.set(sx + ',' + sy, null);
    for (let i = 0; i < q.length && i < 20000; i++) {
      const [x, y] = q[i];
      if (goal(x, y) && (x !== sx || y !== sy)) { const path = []; let k = x + ',' + y; while (k) { path.push(k.split(',').map(Number)); k = seen.get(k); } return path.reverse(); }
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = X + ',' + Y;
        if (!inB(X, Y) || seen.has(k) || Math.abs(X - sx) + Math.abs(Y - sy) > lim) continue;
        const c = g[Y][X], kk = kind(c);
        if (!(walkCh(c) || kk === 'feature')) continue;
        if (occ.has(k) && !goal(X, Y)) continue;
        seen.set(k, x + ',' + y); q.push([X, Y]);
      }
    }
    return null;
  }
  function carve(path, ch) {
    for (const [x, y] of path) {
      if (tcore[y * W + x] === 0) continue;
      const c = g[y][x];
      if (ROADCH.has(c)) continue;
      if (kind(c) === 'feature' || (walkCh(c) && kind(c) === 'ground')) g[y][x] = ch;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (inB(X, Y) && tcore[Y * W + X] !== 0 && kind(g[Y][X]) === 'feature' && !occ.has(X + ',' + Y)) g[Y][X] = groundOf(X, Y); }
    }
  }
  const pathCh = (x, y) => { const b = biome(x, y); return b === 'snow' ? 'P' : b === 'marsh' ? 'Z' : 'd'; };
  let links = 0;
  for (const k of Object.keys(spawns)) {
    const s = spawns[k];
    if (tcore[s.y * W + s.x] !== 0) continue;   // （core の中の spawn だけ: 島・町）
    let near = false;
    for (let j = -3; j <= 3 && !near; j++) for (let i = -3; i <= 3; i++) if (isRoad(s.x + i, s.y + j)) { near = true; break; }
    if (near) continue;
    const p = pathTo(s.x, s.y, isRoad, 70);
    if (p && p.length > 3) { carve(p, pathCh(s.x, s.y)); links++; }
  }
  info.links = links;

  // ---------------------------------------------------------------- 3. 街道の道しるべ（30〜40 歩ごと）
  const CYCLE = {
    plains: ['lm_way_shrine', 'lm_way_post', 'lm_way_caravan', 'lm_way_stones'], forest: ['lm_way_post', 'lm_way_shrine', 'lm_way_caravan', 'lm_ruin_arch'],
    desert: ['lm_desert_camp', 'lm_way_post', 'lm_desert_ruin'], snow: ['lm_way_post', 'lm_way_shrine', 'lm_way_caravan'],
    marsh: ['lm_way_post', 'lm_marsh_stilt', 'lm_marsh_belltower'], ash: ['lm_way_post', 'lm_ash_shrine', 'lm_ash_fumarole'],
  };
  const turn = {};
  let nWay = 0, nRest = 0;
  SCALE.roadsW.forEach((r, ri) => {
    const pts = r.pts;
    let acc = 0, next = 16 + Math.floor(h2(ri, 1, 71) * 10);
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc < next || pts[i].t < 0.5) continue;
      const p = pts[i], a = pts[Math.max(0, i - 4)], b = pts[Math.min(pts.length - 1, i + 4)];
      let dx = b.x - a.x, dy = b.y - a.y; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      if (nearMark(Math.round(p.x), Math.round(p.y), 11)) { next = acc + 6; continue; }
      const bio = biome(Math.round(p.x), Math.round(p.y)), cyc = CYCLE[bio] || CYCLE.plains;
      turn[bio] = (turn[bio] || 0) + 1;
      const id = cyc[turn[bio] % cyc.length], [fw, fh] = FP[id];
      let done = false;
      const side0 = h2(ri, i, 73) < 0.5 ? 1 : -1;
      for (const side of [side0, -side0]) for (const off of [2, 3, 4, 5]) {
        if (done) break;
        const cx = p.x + -dy * side * (off + fw / 2 + r.wd / 2), cy = p.y + dx * side * (off + fh / 2 + r.wd / 2);
        const x0 = Math.round(cx - fw / 2), y0 = Math.round(cy - fh / 2);
        if (!free(x0, y0, fw, fh, 1)) continue;
        place(id, x0, y0);
        const fx = x0 + (fw >> 1), fy = y0 + fh - 1;
        if (id === 'lm_way_shrine' || id === 'lm_ash_shrine') objects.push({ type: 'examine', x: fx, y: fy, event: 'world_poi_shrine' });
        if (id === 'lm_way_stones') objects.push({ type: 'examine', x: fx, y: fy, event: 'world_poi_stones' });
        if (id === 'lm_way_caravan' || id === 'lm_desert_camp') {
          // 野営の跡: そばに灯した灯籠（灯りの 5 マスは魔物が出ない＝旅の休み所）
          for (const [lx, ly] of [[x0 + fw + 1, y0 + fh - 1], [x0 - 2, y0 + fh - 1], [x0 + (fw >> 1), y0 + fh + 1]]) {
            if (!free(lx, ly, 1, 1, 0)) continue;
            objects.push({ type: 'waylamp', id: 'wl_rest_' + (++nRest), x: lx, y: ly, lit: true }); addOcc(lx, ly, 1, 1); break;
          }
        }
        nWay++; done = true;
      }
      next = acc + (done ? 30 + Math.floor(h2(ri, i, 77) * 10) : 5);
    }
  });
  info.waypoints = nWay; info.rests = nRest;

  // ---------------------------------------------------------------- 4. 道から少し入った名所（L の座標で決め、W の近くの空き地を探して置く）
  const SITES = [
    // ヴェルダの森
    { at: [30, 100], id: 'lm_ruin_tower', ev: 'world_poi_forest_tower', cache: 'i_ether' },
    { at: [50, 110], id: 'lm_ruin_pillars', ev: 'world_poi_forest_ring' },
    { at: [20, 72], id: 'lm_ruin_statue', ev: 'world_poi_forest_statue' },
    // 北の野
    { at: [103, 52], id: 'lm_way_stones', ev: 'world_poi_stones' },
    { at: [76, 50], id: 'lm_ruin_found', ev: 'world_poi_plains_found', cache: 'i_potion' },
    // ファロス半島
    { at: [84, 116], id: 'lm_ruin_wall', ev: 'world_poi_pen_wall' },
    { at: [108, 92], id: 'lm_way_lookout', ev: 'world_poi_pen_lookout' },
    // 雪原・砂漠・湿原（縦切りの外。絵と調べる物だけ）
    { at: [30, 38], id: 'lm_way_tower', ev: 'world_poi_snow_tower' },
    { at: [72, 132], id: 'lm_desert_ruin', ev: 'world_poi_desert_ruin', cache: 'i_ether' },
    { at: [196, 100], id: 'lm_marsh_belltower', ev: 'world_poi_marsh_bell' },
    { at: [164, 92], id: 'lm_marsh_stilt', ev: 'world_poi_marsh_stilt' },
  ];
  let nSite = 0;
  for (const s of SITES) {
    const [wx, wy] = SCALE.toW(s.at[0] + 0.5, s.at[1] + 0.5), [fw, fh] = FP[s.id];
    let best = null;
    for (let r = 0; r <= 14 && !best; r++) for (let j = -r; j <= r && !best; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const x0 = Math.round(wx) + i - (fw >> 1), y0 = Math.round(wy) + j - fh + 1;
      if (clearable(x0, y0, fw, fh, 2) && !nearMark(x0, y0, 7)) { best = [x0, y0]; break; }
    }
    if (!best) continue;
    const [x0, y0] = best;
    clearRect(x0, y0, fw, fh, 2);
    place(s.id, x0, y0);
    const fx = x0 + (fw >> 1), fy = y0 + fh - 1;
    objects.push({ type: 'examine', x: fx, y: fy, event: s.ev });
    if (s.cache) { const cx = x0 + fw, cy = y0 + fh - 1; objects.push({ type: 'examine', x: cx, y: cy, event: 'world_poi_cache', item: s.cache, key: s.ev }); }
    const p = pathTo(fx, fy + 1, isRoad, 60);
    if (p && p.length > 2) carve(p, pathCh(fx, fy));
    nSite++;
  }
  info.sites = nSite;

  // ---------------------------------------------------------------- 5. 凡例の素材をワールドの素材に
  for (const ch of Object.keys(LEGEND)) {
    const e = LEGEND[ch];
    if (e.solid && e.mat === 'tall_grass') e.mat = 'wm_reeds';
    else if (WM[e.mat]) e.mat = WM[e.mat];
    if (e.under && WM[e.under]) e.under = WM[e.under];
    if (e.mat === 'tree' && !e.under) e.under = 'wm_grass';
  }
  A.info = info;
  return info;
}, { FP, WM });
