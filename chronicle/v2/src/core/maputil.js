// MapUtil（CORE、契約の版 2）: マップのデータ（§2.6.1）を読む共通の道具。FIELD（当たり）・TERRAIN（焼く）・QA（tools/lib/maps.js）が
// 同じ答えを使うために 1 か所に置く。DOM に触れない（node でも使える）。R.Game が無いときは条件をすべて偽とみなす。
//
//   R.MapUtil.grid(map) → string[]                 tilePatches（cond が真の物）を当てた後の行。結果はキャッシュ（invalidate で捨てる）
//   R.MapUtil.cell(map, x, y) → legend の 1 字 | null   マップの外は null
//   R.MapUtil.spawn(map, spawn) → {x, y, dir}       spawn は名前か {x, y, dir}。無い名前は最初の spawn（警告）
//   R.MapUtil.inRect(x, y, r) → bool                r = [x, y, w, h] か {x, y, w?, h?}（w・h の既定 1）
//   R.MapUtil.objectsAt(map, x, y, lv?) → [obj]      その マスに掛かる物（泉 2×2・建物 w×h、ほかは 1×1）。cond が偽の物は除く
//   R.MapUtil.zoneAt(map, x, y) → zoneId | null     zones の上から最初に合う物（rect null は全体。cond があれば真のときだけ、版 3）
//   R.MapUtil.darkAt(map, x, y) → bool              map.dark（true／範囲の配列 [{rect, cond}]）
//   R.MapUtil.secretFound(mapId, x, y) → bool       R.Game.secrets[mapId] に 'x,y' があるか（見つけた隠し通路の書き方は 'x,y'）
//   R.MapUtil.invalidate(mapId?)                    フラグ・変数が変わったときなど（FIELD が 'flag' 'var' 'item:gain' で呼ぶ）
//   R.MapUtil.secretAreas(map) → [area]             隠し通路の先（下の「隠し通路の先」）。マップごとに 1 度だけ数える
//   R.MapUtil.secretOpen(map, x, y, list?) → bool   (x, y) の隠し通路のひと続き（gate）のどれかが見つかっているか
//   R.MapUtil.secretHidden(map, x, y, list?) → legend | null   見つける前の隠し通路の先のマスなら、代わりに描く壁（gate の壁）
//   R.MapUtil.secretGateAt(map, x, y) → area | null  (x, y) が入口（gate）のマスになっている area
//     list = 見つけた 'x,y' の一覧（既定は R.Game.secrets[map.id]）
//
// 隠し通路の先（オーナーの指示「見つけるまで先の部屋・宝箱を見せない」）: ひと続きの secret のセル（gate）ごとに、spawn・階段・出口から
//   secret を通らずに歩ける所（main）の外で、gate から歩いて行ける床を area.cells に集める（その先の gate は入れ子で parent を持つ）。
//   見つけるまで area.cells は gate の壁（mat・rise）で描き、上の物（宝箱・灯り）も出さない。小地図にも載せない（minimap.reveal）。
//   歩けるかは legend だけで数え、tilePatches はどれか 1 つでも歩ければ歩ける（閉じた扉の奥を隠し部屋と間違えない）。
//
// secret のセル（legend の secret: true）は「通れる壁」: solid でも通れる。見つけるまでは mat で、見つけたら floor（無ければ隣の床）で描く。
(function (R) {
  'use strict';
  const cache = {}; // mapId → {sig, rows}

  function check(cond) {
    if (cond == null) return true;
    if (!R.Game || !R.State || !R.State.check) return false;
    try { return !!R.State.check(cond); } catch (e) { return false; }
  }
  function inRect(x, y, r) {
    if (!r) return false;
    if (Array.isArray(r)) return x >= r[0] && y >= r[1] && x < r[0] + (r[2] || 1) && y < r[1] + (r[3] || 1);
    return x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1);
  }
  function footprint(o) {
    if (o.type === 'spring') return [o.x, o.y, 2, 2];
    if (o.type === 'building') return [o.x, o.y, o.w || 1, o.h || 1];
    return [o.x, o.y, o.w || 1, o.h || 1];
  }

  // ------------------------------------------------------------------ 隠し通路の先（上の説明）
  const areaCache = new WeakMap();
  function listOf(map, list) {
    if (Array.isArray(list)) return list;
    const s = R.Game && R.Game.secrets && map && R.Game.secrets[map.id];
    return Array.isArray(s) ? s : [];
  }
  function gateOpen(a, list) {
    if (!list.length) return false;
    for (let i = 0; i < a.gate.length; i++) if (list.indexOf(a.gate[i]) >= 0) return true;
    return false;
  }
  const passL = (l) => !!l && (!!l.deck || !!l.ladder || (!l.solid && l.walk !== false));
  function analyse(map) {
    const c = areaCache.get(map);
    if (c && c.rows === map.rows && c.patches === map.tilePatches) return c;
    const W = map.w | 0, H = map.h | 0, N = W * H, L = map.legend || {};
    const out = { rows: map.rows, patches: map.tilePatches, w: W, h: H, areas: [], areaOf: new Int16Array(N).fill(-1), gateOf: new Int16Array(N).fill(-1), main: null };
    areaCache.set(map, out);
    if (!N || !map.rows || !Object.values(L).some((l) => l && l.secret)) return out;
    const walk = new Uint8Array(N), sec = new Uint8Array(N), secL = new Array(N);
    const at = (row, x) => (row.length === W ? row.charAt(x) : [...row][x]);
    map.rows.forEach((row, y) => { if (y >= H) return; for (let x = 0; x < W; x++) { const l = L[at(row, x)]; const i = y * W + x; if (l && l.secret) { sec[i] = 1; secL[i] = l; } else if (passL(l)) walk[i] = 1; } });
    for (const p of map.tilePatches || []) {   // どれか 1 つでも歩ければ歩ける
      const put = (x, y, ch) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const l = L[ch]; if (passL(l) && !(l && l.secret)) walk[y * W + x] = 1; };
      if (p.rows && p.rect) p.rows.forEach((r, dy) => [...r].forEach((ch, dx) => { if (ch !== ' ') put(p.rect[0] + dx, p.rect[1] + dy, ch); }));
      else if (p.ch != null) put(p.x, p.y, p.ch);
    }
    // main: spawn・階段・扉・出口から secret を通らずに歩ける所
    const main = new Uint8Array(N), q = [];
    const seed = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (!main[i] && walk[i]) { main[i] = 1; q.push(i); } };
    for (const s of Object.values(map.spawns || {})) if (s) seed(s.x, s.y);
    for (const o of map.objects || []) if (o && (o.type === 'stairs' || o.type === 'door') && o.x != null) { seed(o.x, o.y); for (const [dx, dy] of D4) seed(o.x + dx, o.y + dy); }
    for (const e of map.exits || []) for (let y = e.y; y < e.y + (e.h || 1); y++) for (let x = e.x; x < e.x + (e.w || 1); x++) seed(x, y);
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (walk[j] && !main[j]) { main[j] = 1; q.push(j); } } }
    out.main = main;
    // gate（ひと続きの secret）
    const gates = [];
    for (let i = 0; i < N; i++) {
      if (!sec[i] || out.gateOf[i] >= 0) continue;
      const g = { cells: [], legend: secL[i] }, st = [i]; out.gateOf[i] = gates.length;
      while (st.length) { const j = st.pop(); g.cells.push(j); const x = j % W, y = (j / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const k = ny * W + nx; if (sec[k] && out.gateOf[k] < 0) { out.gateOf[k] = gates.length; st.push(k); } } }
      gates.push(g);
    }
    const touches = (g, pred) => g.cells.some((j) => { const x = j % W, y = (j / W) | 0; return D4.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && pred(ny * W + nx); }); });
    // main に面した gate から順に、先の床を area にする（その先の gate は入れ子）
    const done = new Array(gates.length).fill(false), areaIdx = new Array(gates.length).fill(-1);
    const todo = [];
    gates.forEach((g, k) => { if (touches(g, (j) => main[j])) { done[k] = true; todo.push([k, null]); } });
    for (let h = 0; h < todo.length; h++) {
      const [k, parent] = todo[h], g = gates[k], idx = out.areas.length;
      const l = g.legend;
      const area = { i: idx, gate: g.cells.map((j) => (j % W) + ',' + ((j / W) | 0)), cells: [], parent, wall: { mat: l.mat, solid: true, rise: l.rise, _hidden: true }, children: [] };
      out.areas.push(area); areaIdx[k] = idx;
      for (const j of g.cells) out.gateOf[j] = idx;
      if (parent != null) out.areas[parent].children.push(idx);
      const st = [];
      const visit = (j) => { if (walk[j] && !main[j] && out.areaOf[j] < 0) { out.areaOf[j] = idx; area.cells.push((j % W) + ',' + ((j / W) | 0)); st.push(j); } };
      for (const j of g.cells) { const x = j % W, y = (j / W) | 0; for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) visit(ny * W + nx); } }
      while (st.length) {
        const j = st.pop(), x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          visit(n);
          if (sec[n]) { const gk = gateIndexOf(gates, n); if (gk >= 0 && !done[gk]) { done[gk] = true; todo.push([gk, idx]); } }
        }
      }
    }
    // 隠す間に描く壁: area の周りでいちばん多い壁（secret でない solid）。無ければ gate の壁
    for (const a of out.areas) {
      const cnt = new Map();
      for (const k of a.cells) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of D4.concat([[1, 1], [-1, 1], [1, -1], [-1, -1]])) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const l = L[at(map.rows[ny], nx)];
          if (l && l.solid && !l.secret && !l.walk) cnt.set(l, (cnt.get(l) || 0) + 1);
        }
      }
      let best = null, bn = 0;
      for (const [l, n] of cnt) if (n > bn) { best = l; bn = n; }
      if (best) a.wall = Object.assign({}, best, { _hidden: true });
    }
    // 届かない gate（どこにもつながらない）は area を持たない
    for (let i = 0; i < N; i++) if (sec[i] && areaIdx[gateIndexOf(gates, i)] < 0) out.gateOf[i] = -1;
    return out;
  }
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function gateIndexOf(gates, j) { for (let k = 0; k < gates.length; k++) if (gates[k].cells.indexOf(j) >= 0) return k; return -1; }

  const MU = (R.MapUtil = {
    inRect,
    grid(map) {
      if (!map || !map.rows) return [];
      const patches = map.tilePatches || [];
      if (!patches.length) return map.rows;
      const on = patches.map((p) => check(p.cond));
      const sig = on.map((b) => (b ? 1 : 0)).join('');
      const c = cache[map.id];
      if (c && c.sig === sig && c.src === map.rows && c.patches === patches) {
        // invalidate の後（2026-09-29 性能）: 行は cond の真偽と tilePatches の中身だけで決まるので、中身が同じなら作り直さない
        // （ワールドに入るとき道しるべの灯籠 39 個ぶんの焼き直しの印で、672×576 の行を 39 回作り直していた）
        if (!c.stale) return c.rows;
        const pj = JSON.stringify(patches), rs = c.rowsAt;
        if (pj === c.pj && rs.length === map.rows.length && rs.every((r, i) => r === map.rows[i])) { c.stale = false; return c.rows; }
      }
      const rows = map.rows.map((r) => [...r]);
      patches.forEach((p, i) => {
        if (!on[i]) return;
        if (p.rows && p.rect) {
          const [px, py] = p.rect;
          p.rows.forEach((r, dy) => [...r].forEach((ch, dx) => { if (ch !== ' ' && rows[py + dy] && px + dx < rows[py + dy].length) rows[py + dy][px + dx] = ch; }));
        } else if (p.ch != null && rows[p.y]) rows[p.y][p.x] = p.ch;
      });
      const out = rows.map((r) => r.join(''));
      cache[map.id] = { sig, rows: out, src: map.rows, patches, pj: JSON.stringify(patches), rowsAt: map.rows.slice(), stale: false };
      return out;
    },
    cell(map, x, y) {
      if (!map || x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
      const row = MU.grid(map)[y];
      if (row == null) return null;
      const ch = row.length === map.w ? row.charAt(x) : [...row][x];
      return (map.legend && map.legend[ch]) || null;
    },
    spawn(map, sp) {
      if (sp && typeof sp === 'object') return { x: sp.x | 0, y: sp.y | 0, dir: sp.dir || 's' };
      const all = (map && map.spawns) || {};
      let s = all[sp];
      if (!s) {
        if (sp != null) R.warn && R.warn(`map ${map && map.id}: no spawn '${sp}', using the first`);
        s = all[Object.keys(all)[0]] || { x: 1, y: 1 };
      }
      return { x: s.x, y: s.y, dir: s.dir || 's' };
    },
    objectsAt(map, x, y, lv) {
      const out = [];
      for (const o of (map && map.objects) || []) {
        if (o.x == null || o.y == null) continue;
        if (lv != null && (o.lv || 0) !== lv) continue;
        if (!inRect(x, y, footprint(o))) continue;
        if (o.cond != null && o.type !== 'trail' && !check(o.cond)) continue;
        out.push(o);
      }
      return out;
    },
    zoneAt(map, x, y) {
      for (const z of (map && map.zones) || []) if ((!z.rect || inRect(x, y, z.rect)) && (z.cond == null || check(z.cond))) return z.zone;
      return null;
    },
    darkAt(map, x, y) {
      const d = map && map.dark;
      if (!d) return false;
      if (d === true) return true;
      return d.some((e) => (!e.rect || inRect(x, y, e.rect)) && check(e.cond));
    },
    secretFound(mapId, x, y) {
      const s = R.Game && R.Game.secrets && R.Game.secrets[mapId];
      if (!s || !s.length) return false;
      if (s.indexOf(x + ',' + y) >= 0) return true;
      const map = R.DB && R.DB.maps && R.DB.maps[mapId];
      return !!(map && MU.secretOpen(map, x, y, s));   // 同じ gate のほかのマスで見つけた（前のセーブは 1 マスずつ）
    },
    secretAreas(map) { return analyse(map).areas; },
    secretGateAt(map, x, y) {
      const A = analyse(map);
      if (x < 0 || y < 0 || x >= A.w || y >= A.h) return null;
      const k = A.gateOf[y * A.w + x];
      return k >= 0 ? A.areas[k] : null;
    },
    secretOpen(map, x, y, list) {
      const a = MU.secretGateAt(map, x, y);
      list = listOf(map, list);
      if (!a) return list.indexOf(x + ',' + y) >= 0;
      return gateOpen(a, list);
    },
    secretHidden(map, x, y, list) {
      if (!map || !map.legend) return null;
      const A = analyse(map);
      if (!A.areas.length || x < 0 || y < 0 || x >= A.w || y >= A.h) return null;
      let k = A.areaOf[y * A.w + x];
      if (k < 0) return null;
      list = listOf(map, list);
      const wall = A.areas[k].wall;
      for (let n = 0; k >= 0 && n < 16; n++) { const a = A.areas[k]; if (!gateOpen(a, list)) return wall; k = a.parent == null ? -1 : a.parent; }
      return null;
    },
    invalidate(mapId) { if (mapId) { if (cache[mapId]) cache[mapId].stale = true; } else for (const k of Object.keys(cache)) cache[k].stale = true; },
    /**
     * 回復の場所（type 'spring'）の見た目: 'goddess'（女神の像）| 'water'（泉）。
     * 持ち主の決まり（2026-09）:「泉がいきなりあるのは違和感」→ ダンジョンの中は女神の像。町・宿場・井戸・オアシスなど本当に水のある所は泉のまま。
     * o.look で個別に決められる。データ・当たり・R.Game.springs・check_springs は type 'spring' のまま。
     */
    springLook(map, o) {
      if (o && (o.look === 'goddess' || o.look === 'water')) return o.look;
      return map && map.kind === 'dungeon' ? 'goddess' : 'water';
    },
    /** 女神の像の石の変化: 0 灰色の石（灯台・洞窟）・1 苔むした白い石（千年樹・森）・2 砂岩（王墓・砂漠） */
    goddessVariant(map, o) {
      if (o && o.variant != null) return o.variant | 0;
      const th = (map && map.theme) || '';
      return /tree|forest|marsh/.test(th) ? 1 : /tomb|desert/.test(th) ? 2 : 0;
    },
    footprint,
  });
})(window.RPG);
