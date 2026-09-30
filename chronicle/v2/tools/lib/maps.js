// QA: マップの歩数と出現の模型（V2_PLAN §2.8・§3.16 の 2・6・11）。node の道具（progress・sim_zones --segments・check_*）と
// ブラウザの playthrough（tools/qa/playthrough.js がこのファイルの中身をページに入れる）の両方で使う。DOM に触れない。
//
//   const M = require('./v2/tools/lib/maps').create(R);        // R = lib/load() か、ページの window.RPG
//   M.sliceMaps()                        縦切りのマップの id（stub_・field_・t_ を除く）
//   M.portals(map, {all})                出口・階段・扉・建物の戸口 → [{kind, x, y, w, h, lv, to, cond}]（all でなければ今 cond が真の物だけ）
//   M.dest(to)                           {map, spawn} → {map, x, y, lv}
//   M.bfs(map, starts, o)                FIELD の歩き方（8 方向、斜めは両隣が通れるとき、高さ・一方通行・物の当たり）の到達
//                                        → {dist: Map('x,y,lv' → 歩数), prev, portals: [{p, x, y, lv, d}]}
//                                        o.blocked(x, y, lv) 足す当たり、o.npcs（'still' か押せない人をふさぐ、既定 true）、
//                                        o.through（出口のマスの先へも歩く。既定 false = 出口に着いたらそこで止まる）
//   M.plan(from, goal, o)                マップをまたいだ最短の道（Dijkstra、出口ごとに次のマップの spawn へ）
//                                        goal(mapId) → [{x, y, lv}]（そのマップで着けばよいマス）。→ {cost, legs:[{map, from, to, path, portal|null}]} | null
//   M.path(bfsResult, x, y, lv)          bfs の結果から (x, y, lv) までのマスの列
//   M.eventPlaces(eventId)               そのイベントを走らせる物 → [{map, kind:'npc'|'obj'|'trigger'|'enter', ref, cond}]
//   M.standCells(map, place)             その物に話しかける・調べるために立つマス（npc・obj は上下左右、trigger は範囲、enter は spawn）
//   M.zoneAt(map, x, y)                  出現表（泉の周り 3 マス・ともした灯籠の周り 5 マスは null。FIELD の safeAt と同じ）
//   M.stepChance(zone)                   1 歩の出現の率（R.Mon.stepChance）。M.avgSteps(zone) = 安全な歩数を入れた平均の間隔
//   M.expectBattles(map, path)           道のマスごとの出現の率から、戦闘の数の見込み
//   M.springs(map)                       泉の一覧
//   M.withIndex(fn)                      物の索引を使って速く（MapUtil.objectsAt を一時的に索引つきに替える）
'use strict';
(function (root) {
  function create(R) {
    const MU = R.MapUtil, F = R.Field;
    const DIR8 = [[0, 1, 's'], [0, -1, 'n'], [1, 0, 'e'], [-1, 0, 'w'], [1, 1, 'se'], [-1, 1, 'sw'], [1, -1, 'ne'], [-1, -1, 'nw']];
    const key = (x, y, lv) => x + ',' + y + ',' + (lv || 0);
    const check = (c) => { if (c == null) return true; try { return !!R.State.check(c); } catch (e) { return false; } };
    const M = {};

    M.sliceMaps = function () {
      return Object.keys(R.DB.maps).filter((id) => !/^(stub_|field_|t_)/.test(id)).sort();
    };
    const mapOf = (m) => (typeof m === 'string' ? R.DB.maps[m] : m);

    // ---------------------------------------------------------------- 物の索引（BFS を速く）
    let idx = null;
    M.withIndex = function (fn) {
      if (idx) return fn();
      const orig = MU.objectsAt;
      const byMap = new Map();
      idx = true;
      MU.objectsAt = function (map, x, y, lv) {
        if (!map || !map.objects) return [];
        let I = byMap.get(map);
        if (!I) {
          I = new Map();
          for (const o of map.objects) {
            if (o.x == null || o.y == null) continue;
            const fp = MU.footprint ? MU.footprint(o) : [o.x, o.y, o.w || 1, o.h || 1];
            for (let j = 0; j < fp[3]; j++) for (let i = 0; i < fp[2]; i++) {
              const k = (fp[0] + i) + ',' + (fp[1] + j);
              if (!I.has(k)) I.set(k, []);
              I.get(k).push(o);
            }
          }
          byMap.set(map, I);
        }
        const list = I.get(x + ',' + y);
        if (!list) return [];
        const out = [];
        for (const o of list) {
          if (lv != null && (o.lv || 0) !== lv) continue;
          if (o.cond != null && o.type !== 'trail' && !check(o.cond)) continue;
          out.push(o);
        }
        return out;
      };
      // マップの形（tilePatches の cond を毎回読む）も、索引の間（状態が変わらない BFS の中）は覚えておく（WORLD v3: ワールドが 9 倍のマスになった）
      const origGrid = MU.grid, gridMemo = new Map();
      MU.grid = function (map) { let g = gridMemo.get(map); if (!g) { g = origGrid.call(MU, map); gridMemo.set(map, g); } return g; };
      try { return fn(); } finally { MU.objectsAt = orig; MU.grid = origGrid; idx = null; }
    };

    // ---------------------------------------------------------------- 出入り口
    M.portals = function (map, o) {
      map = mapOf(map);
      o = o || {};
      const out = [];
      if (!map) return out;
      for (const e of map.exits || []) if (o.all || check(e.cond)) out.push({ kind: 'exit', x: e.x, y: e.y, w: e.w || 1, h: e.h || 1, lv: null, to: e.to, cond: e.cond });
      for (const ob of map.objects || []) {
        if ((ob.type === 'stairs' || ob.type === 'door') && ob.to && (o.all || (check(ob.cond)))) out.push({ kind: ob.type, x: ob.x, y: ob.y, w: 1, h: 1, lv: ob.lv || 0, to: ob.to, cond: ob.cond });
        else if (ob.type === 'building' && ob.door && ob.door.to && (o.all || check(ob.cond))) out.push({ kind: 'building', x: ob.door.x, y: ob.door.y, w: 1, h: 1, lv: ob.lv || 0, to: ob.door.to, cond: ob.cond, id: ob.id });
      }
      return out;
    };
    M.dest = function (to) {
      const m = R.DB.maps[to.map];
      if (!m) return null;
      const s = MU.spawn(m, to.spawn);
      const def = typeof to.spawn === 'string' ? (m.spawns || {})[to.spawn] : to.spawn;
      return { map: m.id, x: s.x, y: s.y, lv: (def && def.lv) || 0, dir: s.dir };
    };
    function portalAt(ps, x, y, lv) {
      for (const p of ps) {
        if (x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h && (p.lv == null || p.lv === lv)) return p;
      }
      return null;
    }
    M.portalAt = portalAt;

    // ---------------------------------------------------------------- 人の当たり（node には FIELD の人の状態が無いので、データから）
    function npcBlock(map) {
      const set = new Set();
      for (const n of map.npcs || []) {
        if (n.x == null || !check(n.cond)) continue;
        const still = !n.move || n.move === 'still';
        if (still || n.pushable === false) set.add(key(n.x, n.y, n.lv || 0));
      }
      return set;
    }

    // ---------------------------------------------------------------- 到達
    M.bfs = function (map, starts, o) {
      map = mapOf(map);
      o = o || {};
      return M.withIndex(() => {
        const ps = o.portals || M.portals(map);
        const nb = o.npcs === false ? null : npcBlock(map);
        const dist = new Map(), prev = new Map();
        const q = [];
        const hit = [];
        for (const s of starts) {
          const k = key(s.x, s.y, s.lv || 0);
          if (!dist.has(k)) { dist.set(k, 0); q.push([s.x, s.y, s.lv || 0]); }
        }
        const can = (x, y, lv, dx, dy, dn) => {
          if (!F._canEnter(map, x, y, x + dx, y + dy, lv, dn)) return -1;
          const to = F._lvAfter(map, x, y, x + dx, y + dy, lv);
          if (nb && nb.has(key(x + dx, y + dy, to))) return -1;
          if (o.blocked && o.blocked(x + dx, y + dy, to)) return -1;
          return to;
        };
        for (let qi = 0; qi < q.length; qi++) {
          const [x, y, lv] = q[qi];
          const d = dist.get(key(x, y, lv));
          if (qi >= starts.length || o.startIsPortal) {
            const p = portalAt(ps, x, y, lv);
            if (p && d > 0) { hit.push({ p, x, y, lv, d }); if (!o.through) continue; }
          }
          if (o.maxDist && d >= o.maxDist) continue;
          for (const [dx, dy, dn] of DIR8) {
            const to = can(x, y, lv, dx, dy, dn);
            if (to < 0) continue;
            if (dx && dy && (can(x, y, lv, dx, 0, dx > 0 ? 'e' : 'w') < 0 || can(x, y, lv, 0, dy, dy > 0 ? 's' : 'n') < 0)) continue;
            // FIELD の斜め（move.js の _step）: 片方の軸の先が戸口・階段・出口なら、斜めではなくそちらへ入る。その斜めは道にしない
            //   （千年樹 2 階の着いたマス 23,5 → 22,6 の斜めが、隣の上り階段 22,5 に入って 1 階へ戻り、行き来し続けていた）
            if (dx && dy && F._warpAt && (F._warpAt(map, x + dx, y, lv) || F._warpAt(map, x, y + dy, lv))) continue;
            const k = key(x + dx, y + dy, to);
            if (dist.has(k)) continue;
            dist.set(k, d + 1);
            prev.set(k, key(x, y, lv));
            q.push([x + dx, y + dy, to]);
          }
        }
        return { map: map.id, dist, prev, portals: hit, get(x, y, lv) { return dist.get(key(x, y, lv)); } };
      });
    };
    M.path = function (res, x, y, lv) {
      const out = [];
      let k = key(x, y, lv);
      if (!res.dist.has(k)) return null;
      while (k) { const [a, b, c] = k.split(',').map(Number); out.push({ x: a, y: b, lv: c }); k = res.prev.get(k); }
      return out.reverse();
    };

    /**
     * マップをまたいだ最短の道。from = {map, x, y, lv}。goal(mapId) → [{x, y, lv}] | null。
     * → {cost, legs:[{map, from, to:{x,y,lv}, portal}]}（最後の leg の portal は null = 着いた）| null
     */
    M.plan = function (from, goal, o) {
      o = o || {};
      return M.withIndex(() => {
        const best = new Map();
        const nodes = [{ map: from.map, x: from.x, y: from.y, lv: from.lv || 0, cost: 0, back: null, leg: null }];
        best.set(from.map + ':' + key(from.x, from.y, from.lv), 0);
        let found = null;
        const bfsCache = new Map();
        let guard = 0;
        while (nodes.length && guard++ < (o.maxNodes || 400)) {
          nodes.sort((a, b) => a.cost - b.cost);
          const n = nodes.shift();
          if (found && n.cost >= found.cost) break;
          const map = R.DB.maps[n.map];
          if (!map) continue;
          const ck = n.map + ':' + key(n.x, n.y, n.lv);
          let res = bfsCache.get(ck);
          if (!res) { res = M.bfs(map, [n], { blocked: o.blocked && ((x, y, lv) => o.blocked(n.map, x, y, lv)), npcs: o.npcs }); bfsCache.set(ck, res); }
          const gs = goal(n.map) || [];
          for (const g of gs) {
            const d = res.get(g.x, g.y, g.lv || 0);
            if (d == null) continue;
            const c = n.cost + d;
            if (!found || c < found.cost) found = { cost: c, node: n, to: { x: g.x, y: g.y, lv: g.lv || 0 }, res, goal: g };
          }
          if (o.sameMapOnly) continue;
          for (const h of res.portals) {
            const t = M.dest(h.p.to);
            if (!t) continue;
            if (o.avoidMap && o.avoidMap(t.map, h.p)) continue;
            const c = n.cost + h.d + 1;
            const bk = t.map + ':' + key(t.x, t.y, t.lv);
            if (best.has(bk) && best.get(bk) <= c) continue;
            best.set(bk, c);
            nodes.push({ map: t.map, x: t.x, y: t.y, lv: t.lv, cost: c, back: n, leg: { map: n.map, from: { x: n.x, y: n.y, lv: n.lv }, to: { x: h.x, y: h.y, lv: h.lv }, portal: h.p, res, d: h.d } });
          }
        }
        if (!found) return null;
        const legs = [{ map: found.node.map, from: { x: found.node.x, y: found.node.y, lv: found.node.lv }, to: found.to, portal: null, res: found.res, goal: found.goal }];
        for (let n = found.node; n && n.leg; n = n.back) legs.unshift(n.leg);
        return { cost: found.cost, legs };
      });
    };

    // ---------------------------------------------------------------- イベントの場所
    M.eventPlaces = function (eventId, o) {
      o = o || {};
      const out = [];
      for (const id of M.sliceMaps()) {
        const m = R.DB.maps[id];
        for (const n of m.npcs || []) {
          const t = typeof n.talk === 'string' ? n.talk : n.talk && n.talk.event;
          if (t === eventId && (o.all || check(n.cond))) out.push({ map: id, kind: 'npc', ref: n, cond: n.cond });
        }
        for (const ob of m.objects || []) {
          if (ob.event === eventId && ob.x != null && (o.all || check(ob.cond))) out.push({ map: id, kind: 'obj', ref: ob, cond: ob.cond });
        }
        for (const t of m.triggers || []) {
          if (t.event !== eventId) continue;
          if (!o.all && t.cond && !check(t.cond)) continue;
          if (!o.all && t.once && R.Game && R.Game.flags['tr_' + id + '_' + t.id]) continue;
          out.push({ map: id, kind: t.on === 'enter' ? 'enter' : 'trigger', ref: t, cond: t.cond });
        }
      }
      return out;
    };
    M.standCells = function (map, place) {
      map = mapOf(map);
      const r = place.ref;
      const lv = r.lv || 0;
      if (place.kind === 'enter') return Object.keys(map.spawns || {}).map((s) => { const d = M.dest({ map: map.id, spawn: s }); return { x: d.x, y: d.y, lv: d.lv }; });
      if (place.kind === 'trigger') {
        const out = [];
        for (let j = 0; j < (r.h || 1); j++) for (let i = 0; i < (r.w || 1); i++) out.push({ x: r.x + i, y: r.y + j, lv: r.lv || 0 });
        return out;
      }
      const w = r.type === 'spring' ? 2 : r.w || 1, h = r.type === 'spring' ? 2 : r.h || 1;
      const out = [];
      for (let i = 0; i < w; i++) { out.push({ x: r.x + i, y: r.y - 1, lv, face: 's' }); out.push({ x: r.x + i, y: r.y + h, lv, face: 'n' }); }
      for (let j = 0; j < h; j++) { out.push({ x: r.x - 1, y: r.y + j, lv, face: 'e' }); out.push({ x: r.x + w, y: r.y + j, lv, face: 'w' }); }
      // 調べる物は自分の足もとでもよい（FIELD の frontObj は足もとも見る）
      if (place.kind === 'obj' && r.type === 'examine') out.push({ x: r.x, y: r.y, lv, face: null });
      // 店の台の向こうの人（台 1 マスを挟んで話せる）
      if (place.kind === 'npc') for (const [dx, dy, f] of [[0, 2, 'n'], [0, -2, 's'], [2, 0, 'w'], [-2, 0, 'e']]) {
        const mx = r.x + dx / 2, my = r.y + dy / 2;
        if (F._objBlocks && F._objBlocks(map, mx, my, lv)) out.push({ x: r.x + dx, y: r.y + dy, lv, face: f, across: true });
      }
      return out;
    };

    // ---------------------------------------------------------------- 出現
    M.springs = function (map) { map = mapOf(map); return (map.objects || []).filter((o) => o.type === 'spring'); };
    M.safeAt = function (map, x, y) {
      map = mapOf(map);
      const G = R.Game;
      for (const o of map.objects || []) {
        if (o.type === 'spring') {
          const dx = Math.max(o.x - x, 0, x - (o.x + 1)), dy = Math.max(o.y - y, 0, y - (o.y + 1));
          if (Math.max(dx, dy) <= 3) return 'spring';
        } else if (o.type === 'waylamp' && o.id && G && (G.lamps[o.id] || (o.lit != null && check(o.lit)))) {
          if (Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 5) return 'waylamp';
        }
      }
      return null;
    };
    M.zoneAt = function (map, x, y) {
      map = mapOf(map);
      if (!map || map.kind === 'town' || map.kind === 'interior') return null;
      const z = MU.zoneAt(map, x, y);
      if (!z || M.safeAt(map, x, y)) return null;
      return z;
    };
    M.stepChance = function (zone) {
      const z = R.DB.encounters && R.DB.encounters[zone];
      if (!z || !R.Mon || !R.Mon.stepChance) return 0;
      return R.Mon.stepChance(zone, z);
    };
    M.avgSteps = function (zone) {
      const p = M.stepChance(zone);
      if (!(p > 0)) return Infinity;
      const safe = (R.Mon.K && R.Mon.K('ENC') && R.Mon.K('ENC').safeSteps) || 6;
      return safe - 1 + 1 / p;
    };
    /** 道（マスの列）を歩いたときの戦闘の数の見込み（出現表ごと）→ {total, byZone:{zone:n}, steps, zoneSteps} */
    M.expectBattles = function (map, path) {
      map = mapOf(map);
      const byZone = {};
      let total = 0, zoneSteps = 0;
      for (let i = 1; i < path.length; i++) {
        const c = path[i];
        const z = M.zoneAt(map, c.x, c.y);
        if (!z) continue;
        zoneSteps++;
        const n = 1 / M.avgSteps(z);
        byZone[z] = (byZone[z] || 0) + n;
        total += n;
      }
      return { total, byZone, steps: Math.max(0, path.length - 1), zoneSteps };
    };
    return M;
  }
  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QAMaps = api;
})(typeof window !== 'undefined' ? window : this);
