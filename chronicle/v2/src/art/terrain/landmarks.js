// TERRAIN: ワールドの大きな景色（WORLD v3、2026-09-28。map.splat のマップ = ワールド）。オーナーの報告「フィールドマップの小物もしょぼい」への答え。
// マスの木・森・岩・葦・砂岩の塊を、描いた大きな絵（v2/assets/env/world/props/lm_*、gpt-6-sol のシート）の「木立・山・岩場…」で覆う。
// マップごとに 1 回だけ、マスから決まる順（ハッシュ）で大きい絵から置いていく（同じマップなら必ず同じ置き方。チャンクの境でつながる）。
// 覆ったマスの 1 本ずつの木は描かない（chunks.js の _prep が T._lmCovered を見る）。覆い切れない小さな所は今までどおり 1 本の木。
//
//   T._lmPlan(map, tile) → {items:[{id, x, y, fp:[x0,y0,w,h]}], cov:Uint8Array} | null（絵が無い・ワールドでない）
//   T._lmDraw(job, draw, map)   チャンクに掛かる絵を draw に足す（chunks.js の _prep）
//   T._lmCovered(map, x, y)     そのマスが絵に覆われているか
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  const U = () => T._u;

  // 素材・凡例 → 覆う絵の種類（fam）の候補。big = 山のように大きな塊にだけ使う絵の種類
  function classOf(e, m) {
    if (!e) return null;
    const mat = e.mat || '';
    if (e.tree) {
      const t = e.tree[0] || '';
      if (/snow/.test(t)) return 'snowtree';
      if (/swamp/.test(t)) return 'marshtree';
      if (/charred/.test(t)) return 'ashtree';
      return 'tree';
    }
    if (m.tall === 'tree') return 'tree';
    if (m.tall === 'canopy') return 'forest';
    if (e.solid && /tall_grass|reeds/.test(mat)) return 'reeds';
    if (e.solid && /wall_snow/.test(mat)) return 'snowrock';
    if (e.solid && /sandstone/.test(mat)) return 'sandrock';
    if (e.solid && /^(rock|wm_rock|cliff)$/.test(mat)) return 'rock';
    return null;
  }
  // 種類 → 使う絵の fam（先頭ほど優先）。area = その塊の大きさの下限（マス。山は大きな塊にだけ）
  const FAMS = {
    tree: [['broad', 0], ['conifer', 0]],
    forest: [['broad', 0], ['conifer', 0]],
    snowtree: [['snowfir', 0]],
    marshtree: [['marsh', 0]],
    ashtree: [['ash', 0]],
    reeds: [['marsh', 0]],
    snowrock: [['snowmount', 60], ['snowfir', 0]],
    sandrock: [['desert', 0]],
    rock: [['mount', 60], ['rock', 0]],
    ashrock: [['ash', 0]],
  };
  // fam の中で、その種類に使ってよい絵（id の末尾）
  const OK = {
    marshtree: /^lm_marsh_(dead3|swamptree)$/, reeds: /^lm_marsh_reeds/, ashtree: /^lm_ash_charred/, snowtree: /^lm_snowfir_(s1|m1|l1|xl)$/,
    snowrock: /^lm_(snowmount_|snowfir_(rock1|crag1))/, sandrock: /^lm_desert_(mesa1|hoodoo|boulders)$/, rock: /^lm_(mount_|rock_)/, ashrock: /^lm_ash_(lavarock|crag|spire)$/,
  };

  let catalog = null;
  function cat() {
    if (catalog) return catalog;
    if (!T.Env || !T.Env.ready || !T.Env.propIds) return null;
    const out = [];
    for (const id of T.Env.propIds()) {
      if (!/^lm_/.test(id)) continue;
      const p = T.Env.prop(id, 0, {});
      if (!p || !p.j || !p.j.fp) continue;
      out.push({ id, fam: p.j.fam || id.split('_')[1], fp: p.j.fp });
    }
    if (!out.length) return null;
    return (catalog = out);
  }
  if (R.on) R.on('settings', () => { catalog = null; });

  const plans = new WeakMap();
  T._lmPlan = function (map) {
    if (!map || !map.splat) return null;
    const grid = R.MapUtil.grid(map);
    const c0 = plans.get(map);
    if (c0 && c0.grid === grid) return c0.plan;
    const C = cat();
    if (!C) return null;
    const W = map.w, H = map.h, legend = map.legend || {}, u = U();
    const cls = new Array(W * H).fill(null), cov = new Uint8Array(W * H);
    const byCh = {};
    for (const ch of Object.keys(legend)) byCh[ch] = classOf(legend[ch], T._matInfo(legend[ch].mat));
    for (let y = 0; y < H; y++) { const row = grid[y]; for (let x = 0; x < W; x++) cls[y * W + x] = byCh[row[x]] || null; }
    // 岩の地方: まわりの地面の素材で雪・灰・砂漠の岩に分ける（岩の凡例は地方で共通）
    const regionOf = (mat) => (/snow|ice/.test(mat) ? 'snowrock' : /ash|obsidian|lava/.test(mat) ? 'ashrock' : /dune|sand|clay/.test(mat) ? 'sandrock' : null);
    const matAt = (x, y) => { const e = legend[(grid[y] || '')[x]]; return e ? e.mat || '' : ''; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (cls[y * W + x] !== 'rock') continue;
      const cnt = {};
      for (let j = -4; j <= 4; j += 2) for (let i = -4; i <= 4; i += 2) { const r = regionOf(matAt(x + i, y + j)); if (r) cnt[r] = (cnt[r] || 0) + 1; }
      const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      if (best && cnt[best] >= 3) cls[y * W + x] = best === 'sandrock' ? 'rock' : best;   // 砂漠の岩場は緑の岩でなく…（砂岩の塊は X が別）→ 灰色の岩のまま
    }
    // 塊の大きさ（4 方向でつながる同じ種類のマスの数）
    const comp = new Int32Array(W * H).fill(-1), compN = [];
    for (let i = 0; i < W * H; i++) {
      if (!cls[i] || comp[i] >= 0) continue;
      const k = compN.length, q = [i]; comp[i] = k; let n = 0;
      while (q.length) {
        const j = q.pop(); n++;
        const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const jj = Y * W + X; if (comp[jj] < 0 && cls[jj] === cls[i]) { comp[jj] = k; q.push(jj); } }
      }
      compN.push(n);
    }
    // 地方の色（山の絵の種類）: 岩のそばの地面が雪・灰・砂なら、その地方の岩
    const items = [];
    const fits = (x0, y0, w, h, c) => {
      if (x0 < 0 || y0 < 0 || x0 + w > W || y0 + h > H) return false;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = y * W + x; if (cov[i] || cls[i] !== c) return false; }
      return true;
    };
    // 置く順: 種類ごとに、マスをハッシュの順に並べ、大きい絵から試す
    const order = [];
    for (let i = 0; i < W * H; i++) if (cls[i]) order.push(i);
    order.sort((a, b) => u.h3(a % W, (a / W) | 0, 911) - u.h3(b % W, (b / W) | 0, 911));
    const pools = {};
    for (const c of Object.keys(FAMS)) {
      const list = [];
      for (const [fam, minArea] of FAMS[c]) for (const s of C) if (s.fam === fam && (!OK[c] || OK[c].test(s.id))) list.push(Object.assign({ minArea }, s));
      list.sort((a, b) => b.fp[0] * b.fp[1] - a.fp[0] * a.fp[1] || (a.id < b.id ? -1 : 1));
      pools[c] = list;
    }
    for (const i of order) {
      if (cov[i]) continue;
      const c = cls[i], pool = pools[c];
      if (!pool || !pool.length) continue;
      const x = i % W, y = (i / W) | 0, area = compN[comp[i]];
      // 大きさの同じ絵どうしはハッシュで選ぶ（同じ形が並ばない）
      const rr = u.h3(x, y, 917);
      for (let k = 0; k < pool.length; k++) {
        const s = pool[k];
        if (area < s.minArea) continue;
        // 木の種類: 広葉樹と針葉樹はゆるいノイズで地域ごとに
        if ((c === 'tree' || c === 'forest') && s.fam !== (u.vn(x, y, 40, 919) > 0.5 ? 'broad' : 'conifer') && pool.some((q) => q.fam !== s.fam)) continue;
        const alt = pool.filter((q) => q.fp[0] === s.fp[0] && q.fp[1] === s.fp[1] && q.fam === s.fam);
        const pick = alt[Math.floor(rr * alt.length)] || s;
        const [fw, fh] = pick.fp;
        // (x, y) を足もとの行の左の方に含む置き方を 2 つ試す
        let placed = false;
        for (const [ox, oy] of [[0, fh - 1], [Math.floor(fw / 2), fh - 1], [0, 0]]) {
          const x0 = x - ox, y0 = y - oy;
          if (!fits(x0, y0, fw, fh, c)) continue;
          for (let yy = y0; yy < y0 + fh; yy++) for (let xx = x0; xx < x0 + fw; xx++) cov[yy * W + xx] = 1;
          items.push({ id: pick.id, fp: [x0, y0, fw, fh] });
          placed = true; break;
        }
        if (placed) break;
      }
    }
    const plan = { items, cov };
    plans.set(map, { grid, plan });
    return plan;
  };
  T._lmCovered = function (map, x, y) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    const plan = T._lmPlan(map);
    return !!(plan && plan.cov[y * map.w + x]);
  };
  // 生成器（tools/world_poi.js）が置く名所・道しるべの絵（type 'prop'、w×h の当たり、lm: true）。node の検査でも当たりがあるように先に登録
  const POI = ['lm_way_shrine', 'lm_way_post', 'lm_way_caravan', 'lm_way_stones', 'lm_way_tower', 'lm_way_lookout', 'lm_ruin_wall', 'lm_ruin_arch', 'lm_ruin_pillars',
    'lm_ruin_tower', 'lm_ruin_found', 'lm_ruin_statue', 'lm_desert_camp', 'lm_desert_ruin', 'lm_marsh_stilt', 'lm_marsh_belltower', 'lm_ash_shrine', 'lm_ash_fumarole'];
  for (const id of POI) if (!(R.DB.props && R.DB.props[id])) R.def('props', id, { solid: true });
  for (const id of ['lm_bridge_draw', 'lm_bridge_causeway', 'lm_bridge_arch_h', 'lm_bridge_foot_h']) if (!(R.DB.props && R.DB.props[id])) R.def('props', id, { soft: true });   // 橋の絵（歩ける）
  /** チャンクの描く物に足す（足もと = 覆う枠の下の辺のまん中、足もとの行より上は over）。名所の物（map.objects の lm）も */
  T._lmDraw = function (job, draw, map) {
    const plan = T._lmPlan(map);
    const t = job.tile, s = t / 32, X0 = job.X0, Y0 = job.Y0, S = job.size;
    const list = [];
    for (const o of map.objects || []) {
      if (!o.lm || o.type !== 'prop') continue;
      if (o.cond != null) { let ok = false; try { ok = !!(R.State && R.Game && R.State.check(o.cond)); } catch (e) { ok = false; } if (!ok) continue; }
      list.push({ id: o.id, fp: [o.x, o.y, o.w || 1, o.h || 1], walk: !!o.walk });
    }
    for (const it of plan ? plan.items.concat(list) : list) {
      const [x0, y0, fw, fh] = it.fp;
      const fx = (x0 + fw / 2) * t, fy = (y0 + fh) * t - 2 * s;
      // 絵の大きさの見積もり（幅は枠 + 1 マス、高さは 7 マスまで）
      if (fx + (fw / 2 + 1) * t < X0 || fx - (fw / 2 + 1) * t > X0 + S || fy < Y0 - 2 * t || fy - Math.max(7, fh + 2) * t > Y0 + S) continue;
      const o = { v: 0 }; if (s !== 1) o.s = s;
      // 橋（walk）は人より下: 足もとを枠の下の辺、絵は枠の真ん中に合わせて base に描く
      if (it.walk) { draw.push({ key: 'hd:prop:' + it.id, opts: o, x: fx, y: fy + 3 * s, ft: fy, layer: 'base', shadow: null, sortY: -1e9, lm: true }); continue; }
      draw.push({ key: 'hd:prop:' + it.id, opts: o, x: fx, y: fy, ft: (y0 + fh - 1) * t, layer: 'split', shadow: null, sortY: fy, lm: true });
    }
  };
})(window.RPG);
