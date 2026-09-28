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

  // 置き方は src/core/world_lm.js（R.WorldLm）。生成器が決めて map.lm に書いてある（無ければここで計算する）
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
  const plans = new WeakMap();
  T._lmPlan = function (map) {
    if (!map || !map.splat) return null;
    const c0 = plans.get(map);
    if (c0) return c0;
    // 絵が読めるまでは置かない（1 本ずつの木のまま。読めたら env.js がチャンクを焼き直す）
    if (!cat()) return null;
    const have = new Set(catalog.map((q) => q.id));
    let list = map.lm && R.WorldLm ? R.WorldLm.unpack(map.lm) : null;
    if (!list && R.WorldLm) list = R.WorldLm.plan(R.MapUtil.grid(map), map.legend || {}, map.w, map.h, catalog);
    const items = [], cov = new Uint8Array(map.w * map.h);
    for (const [id, x0, y0, w, h] of list || []) {
      if (!have.has(id)) continue;
      items.push({ id, fp: [x0, y0, w, h] });
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) cov[y * map.w + x] = 1;
    }
    const plan = { items, cov };
    plans.set(map, plan);
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
  // hd:prop の登録（画像にしかない物。env.js の起動の登録より前に node の検査でもそろう）: マップに置いた lm_* と上の名所・橋
  R.onData(() => {
    const ids = new Set(POI.concat(['lm_bridge_draw', 'lm_bridge_causeway', 'lm_bridge_arch_h', 'lm_bridge_foot_h']));
    for (const m of Object.values(R.DB.maps || {})) for (const o of (m && m.objects) || []) if (o.type === 'prop' && /^lm_/.test(o.id || '')) ids.add(o.id);
    for (const id of ids) {
      if (!R.DB.props[id]) R.def('props', id, { solid: true });
      if (T._PROP_DRAW && !T._PROP_DRAW[id]) { T._PROP_DRAW[id] = function () { return null; }; T._PROP_DRAW[id].envOnly = true; }
      if (T._PROP_META && !T._PROP_META[id]) T._PROP_META[id] = R.DB.props[id].soft ? { soft: true } : { solid: true };
      if (T._bakeProp && T._hdDef && !(R.Hd && R.Hd.has && R.Hd.has('hd:prop:' + id))) T._hdDef('hd:prop:' + id, (o) => T._bakeProp(id, o || {}), R.DB.props[id]);
    }
  });
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
