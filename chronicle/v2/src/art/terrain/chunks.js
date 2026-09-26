// TERRAIN: チャンクを焼く仕事（V2_PLAN §2.5.8・§2.10・§2.11、MODERN_UI §7.2）。R.Terrain の契約の口はここで全部そろう。
//
//   R.Terrain.CHUNK = 8
//   R.Terrain.bakeChunk(map, cx, cy, {tile, tier, state}) → Job（K.bakeJob: step(ms), done, result, kind:'chunk', onDone?）
//       Job.step(ms) は ms 以内に戻る（R.Hd.schedule に積むか、暗転の中で呼び続ける）。終われば Job.result（K.chunkResult）:
//       {base, over, lights, glows, props, x, y, size, map, cx, cy, bytes}
//         base  = CHUNK × tile 四方の canvas（マップの論理 px の (x, y) に置く）: 地面・境目・立ち上がり・水の縁・影・建物・木・止まった物・
//                 光の地図（環境光の掛け算と止まった灯りの光だまり）・窓の描き直し・水面の照り返しまで焼き込み済み
//         over  = 人より上に描く物（屋根の張り出し・木の上半分・足場・つり橋・lv 1 の物）の canvas。無ければ null
//         lights = このチャンクにある灯り（K.light ＋ type。暗がりの計算・ゆらぎに）、glows = 毎フレームの発光（R.Light.glow にそのまま）
//         props = FIELD が人と一緒に y の順で描く物 {key, x, y, sortY, frame, lv, opts, id, type, cond?}（宝箱・泉・かがり火・灯籠・スイッチ・
//                 足あと・動く物）。絵は R.Hd.get(p.key, p.opts) の poses[p.frame]（無ければ default）。opts は夜の環境光を掛けて焼くための物
//   R.Terrain.dirty(map, x, y) → [[cx, cy]…]   そのマスの物・隠し通路が変わった → 焼き直すチャンク（R.emit('terrain:dirty', {map, chunks})）
//   R.Terrain.takeDirty(mapId) → [[cx, cy]…]   たまった焼き直しを受け取って空にする（FIELD）
//   R.Terrain.prewarm(map, {tile, tier}) → Job   マップの素材のタイル・建物・物・木の絵を先に焼く（暗転の中で）
//   R.Terrain.chunkOf(x, y) → [cx, cy]          マス → チャンク
//
// 1 チャンクの仕事の順: 準備（マスの読み・要る絵の一覧）→ 素材のタイル → 絵（建物・物・木）→ 地面（dual grid）→ 立ち上がり・水の縁 →
//   大きなゆらぎ → base に置く → 足場 → 影 → 建物・木・物（足もとより上は over）→ 光の地図（R.Light.map）→ 窓・戸口の描き直し・照り返し → 結果
(function (R) {
  'use strict';
  R.Stubs && R.Stubs.claim && R.Stubs.claim('Terrain');
  const T = (R.Terrain = R.Terrain || {});
  const CHUNK = 8;
  T.CHUNK = CHUNK;
  const TILE = { near: 40, normal: 32, far: 24 };
  function tileOf(o) {
    if (o && o.tile) return o.tile;
    try { return TILE[R.Settings.get('fieldZoom')] || 32; } catch (e) { return 32; }
  }
  const U = () => T._u;

  // ------------------------------------------------------------------ 状態（§2.11: state = {grid, chests, lit, lamps, secrets}）
  function listOf(v, mapId) { if (Array.isArray(v)) return v; if (v && typeof v === 'object') return v[mapId] || []; return []; }
  function stateOf(map, st) {
    const G = R.Game || {};
    st = st || {};
    return {
      grid: st.grid || R.MapUtil.grid(map),
      chests: listOf(st.chests !== undefined ? st.chests : G.chests, map.id),
      lit: listOf(st.lit !== undefined ? st.lit : G.lit, map.id),
      lamps: st.lamps || G.lamps || {},
      secrets: listOf(st.secrets !== undefined ? st.secrets : G.secrets, map.id),
    };
  }
  T._stateOf = stateOf;

  // ------------------------------------------------------------------ マスの読み（チャンクの周りも。範囲の外は map.outside）
  const QUAY = { cobble: 1, stone_floor: 1, plank: 1, pier: 1, bridge: 1, deck: 1, ladder: 1, wood_floor: 1, carpet: 1 };
  function cellReader(map, st, theme, x0, y0, x1, y1) {
    const W = x1 - x0, H = y1 - y0, cache = new Array(W * H);
    const grid = st.grid, outside = map.outside || theme.outside || theme.ground;
    const outE = { mat: outside, solid: !(T._matInfo(outside).walk) };
    const legend = map.legend || {};
    const make = (x, y) => {
      let e;
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) e = outE;
      else {
        const row = grid[y] || '';
        const ch = row.length === map.w ? row.charAt(x) : [...row][x];
        e = legend[ch] || outE;
      }
      const m = T._matInfo(e.mat);
      const c = { e, mat: e.mat, raw: e.mat, raised: false, rise: 1, face: null, water: !!m.water, hard: m.edge === 'hard' || !!QUAY[e.mat], tall: m.tall || null, deck: !!e.deck, secret: !!e.secret, found: false, walk: !e.solid && e.walk !== false && m.walk !== false };
      if (e.secret) {
        c.found = st.secrets.indexOf(x + ',' + y) >= 0;
        if (c.found) {
          c.mat = e.floor || theme.ground; c.walk = true; c.hard = !!QUAY[c.mat];
          const fm = T._matInfo(c.mat); c.water = !!fm.water; c.tall = null;
          return c;
        }
      }
      if (m.face && (e.solid || e.rise || e === outE) && e.rise !== 0) { c.raised = true; c.rise = Math.max(1, e.rise || 1); c.face = m.face; }
      if (m.tall && m.tall !== 'canopy') c.mat = T._underOf(e.mat, theme);
      if (e.deck) c.mat = theme.ground === 'cobble' ? 'dirt' : theme.ground;
      return c;
    };
    const fn = function (x, y) {
      if (x < x0 || y < y0 || x >= x1 || y >= y1) return make(x, y);
      const k = (y - y0) * W + (x - x0);
      return cache[k] || (cache[k] = make(x, y));
    };
    return fn;
  }
  T._cellReader = cellReader;

  // ------------------------------------------------------------------ 描く物の一覧
  // {key, opts, x, y (描く点), ft (足もとの行の上端 px: ここより上は over), layer:'split'|'base'|'over', shadow:'tall'|'block'|null, sortY}
  function variantOf(x, y, k) { return U().h3(x, y, k); }
  function treeSprite(theme, x, y, k, s) {
    const types = theme.tree || ['tree'];
    let id = types[Math.floor(variantOf(x, y, 71 + k) * types.length)];
    if (id === 'tree_giant' && variantOf(x, y, 73) > 0.35) id = 'tree';
    const v = Math.floor(variantOf(x, y, 75 + k) * 6), h = id === 'tree_giant' ? 96 : 44 + Math.floor(variantOf(x, y, 77 + k) * 3) * 8;
    const o = { v, h };
    if (theme.leaf && theme.leaf !== 'leaf' && id !== 'pine') o.leaf = theme.leaf;
    if (s !== 1) o.s = s;
    return { key: 'hd:prop:' + id, opts: o };
  }
  function optsS(o, s) { if (s !== 1) o.s = s; return o; }
  /** Sheet のコマ（pose の最初のコマ。無ければ default・0） */
  function frameOf(sh, name) { const p = (name && sh.poses && sh.poses[name]) || (sh.poses && sh.poses.default) || [0]; return sh.frames[p[0]] || sh.frames[0]; }
  T._frameOf = frameOf;

  /** マップ全体の「焼いて置く物」と「FIELD が描く物」を作る（地図と状態が同じ間は使い回す） */
  const planCache = new WeakMap();
  function planOf(map, st, theme, tile, amb) {
    const sig = tile + '|' + st.chests.join(',') + '|' + st.lit.join(',') + '|' + JSON.stringify(st.lamps) + '|' + (R.Game && R.Game.flags ? Object.keys(R.Game.flags).length : 0) + '|' + amb.ambient;
    let c = planCache.get(map);
    if (c && c.sig === sig) return c.plan;
    const s = tile / 32, items = [], dyn = [], occ = new Set();
    const ambHex = amb.ambient;
    for (const o of map.objects || []) {
      if (o.x == null || o.y == null) continue;
      if (o.cond != null && o.type !== 'trail') { let ok = false; try { ok = !!(R.State && R.Game && R.State.check(o.cond)); } catch (e) { ok = false; } if (!ok) continue; }
      const [fx, fy] = T._objFeet(o, tile), stt = T._objState(map, o, st), lv = o.lv || 0;
      const lay = lv ? 'over' : null;
      switch (o.type) {
        case 'building': {
          const key = T.building(o), bx = o.x * tile, by = (o.y + (o.h || 3)) * tile;
          for (let j = 0; j < (o.h || 3); j++) for (let i = 0; i < (o.w || 3); i++) occ.add((o.x + i) + ',' + (o.y + j));
          items.push({ key, opts: { tile }, x: bx, y: by, ft: o.y * tile, layer: lay || 'split', shadow: 'block', sortY: by, bld: o, w: (o.w || 3) * tile, h: ((o.h || 3) + 1) * tile });
          break;
        }
        case 'prop': {
          if (!T._PROP_DRAW[o.id]) break;
          const meta = T._PROP_META[o.id] || {};
          const anim = /^(beacon)$/.test(o.id);
          const opts = optsS({ v: o.variant || 0 }, s);
          if (anim) { dyn.push({ key: 'hd:prop:' + o.id, x: fx, y: fy, sortY: fy, frame: 'f0', lv, opts: optsS({ amb: ambHex }, s), id: o.id, type: 'prop' }); break; }
          if (o.id === 'firefly') break;
          occ.add(o.x + ',' + o.y);
          const layer = lay || (meta.overChars ? 'over' : meta.soft ? 'base' : 'split');
          items.push({ key: 'hd:prop:' + o.id, opts, frame: /^(torch|brazier|waylamp)$/.test(o.id) ? 'on' : o.frame, x: fx, y: fy, ft: o.y * tile, layer, shadow: meta.soft || meta.overChars ? null : meta.shadow === 'long' || /tree|pine|lamp_post/.test(o.id) ? 'tall' : 'blob', sortY: fy, flip: !!o.flip });
          break;
        }
        case 'sign':
          items.push({ key: 'hd:prop:signboard', opts: optsS({}, s), x: fx, y: fy, ft: o.y * tile, layer: lay || 'split', shadow: 'blob', sortY: fy });
          break;
        case 'stairs':
          items.push({ key: 'hd:prop:' + (o.look === 'up' || o.dir === 'up' ? 'stairs_up' : 'stairs_down'), opts: optsS({}, s), x: fx, y: (o.y + 1) * tile - 2 * s, ft: o.y * tile, layer: lay || 'base', shadow: null, sortY: fy });
          break;
        case 'door':
          if (o.look !== 'none') items.push({ key: 'hd:prop:door', opts: optsS({}, s), x: fx, y: (o.y + 1) * tile, ft: o.y * tile, layer: lay || 'base', shadow: null, sortY: fy, doorCell: true, cx: o.x, cy: o.y });
          break;
        case 'chest':
          dyn.push({ key: 'hd:prop:chest', x: fx, y: fy, sortY: fy, frame: (stt.rare ? 'rare_' : '') + (stt.open ? 'open' : 'closed'), lv, opts: optsS({ amb: ambHex }, s), id: o.id, type: 'chest' });
          occ.add(o.x + ',' + o.y);
          break;
        case 'spring':
          dyn.push({ key: 'hd:prop:spring', x: fx, y: fy, sortY: fy, frame: 'f0', lv, opts: optsS({ amb: ambHex }, s), id: o.id, type: 'spring' });
          for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) occ.add((o.x + i) + ',' + (o.y + j));
          break;
        case 'brazier': case 'waylamp': case 'switch': {
          const opts = optsS({ amb: ambHex }, s);
          if (o.type === 'switch') { opts.look = o.look || 'plate'; opts.color = o.color || 'teal'; }
          dyn.push({ key: 'hd:prop:' + o.type, x: fx, y: fy, sortY: fy, frame: stt.on ? 'on' : 'off', lv, opts, id: o.id, type: o.type });
          occ.add(o.x + ',' + o.y);
          break;
        }
        case 'trail':
          (o.path || []).forEach((p, i) => dyn.push({ key: 'hd:prop:footprint', x: (p[0] + 0.5) * tile, y: (p[1] + 0.7) * tile, sortY: (p[1] + 0.7) * tile - tile, frame: 'default', lv, opts: optsS({ amb: ambHex }, s), id: o.id + ':' + i, type: 'trail', cond: o.cond }));
          break;
        default: break;
      }
    }
    const plan = { items, dyn, occ };
    planCache.set(map, { sig, plan });
    return plan;
  }

  // ------------------------------------------------------------------ 仕事
  function Job(map, cx, cy, o) {
    o = o || {};
    this.kind = 'chunk';
    this.done = false;
    this.result = null;
    this.map = map; this.cx = cx; this.cy = cy;
    this.tile = tileOf(o);
    this.tier = o.tier;
    this.o = o;
    this.phase = 0;
    this.ms = 0;       // 使った時間の合計（step の中だけ）
    this.steps = 0;
    this.maxStep = 0;
    this.i = 0;
    this.prof = {};    // 仕事の順ごとの時間（G1 の報告・perf 用）
  }
  const PHASES = ['prep', 'mats', 'sprites', 'ground', 'rise', 'macro', 'put', 'deck', 'shadow', 'draw', 'light', 'emissive', 'finish'];
  Job.prototype.step = function (ms) {
    if (this.done) return true;
    const t0 = U().now(), deadline = t0 + (ms == null ? 3 : ms);
    try {
      while (!this.done) {
        const ph = PHASES[this.phase], p0 = U().now();
        const fin = this['_' + ph](deadline);
        this.prof[ph] = (this.prof[ph] || 0) + U().now() - p0;
        if (fin) { this.phase++; this.i = 0; if (this.phase >= PHASES.length) { this.done = true; break; } }
        if (U().now() >= deadline) break;
      }
    } catch (e) {
      console.error('[Terrain] chunk', this.map && this.map.id, this.cx, this.cy, PHASES[this.phase], e);
      R.loadErrors && R.loadErrors.push('terrain chunk: ' + (e && e.message));
      this.done = true;
      this.result = this.result || { base: null, over: null, lights: [], glows: [], props: [] };
    }
    const dt = U().now() - t0;
    this.ms += dt; this.steps++; if (dt > this.maxStep) this.maxStep = dt;
    return this.done;
  };

  Job.prototype._prep = function () {
    const map = this.map, t = this.tile, s = t / 32;
    this.s = s;
    this.theme = T.theme(map);
    this.amb = T.ambient(map, this.tier);
    this.st = stateOf(map, this.o.state);
    this.size = CHUNK * t;
    this.X0 = this.cx * CHUNK * t; this.Y0 = this.cy * CHUNK * t;
    const c0x = this.cx * CHUNK, c0y = this.cy * CHUNK;
    this.cells = [c0x, c0y, c0x + CHUNK, c0y + CHUNK];
    this.C = cellReader(map, this.st, this.theme, c0x - 5, c0y - 3, c0x + CHUNK + 5, c0y + CHUNK + 6);
    const plan = planOf(map, this.st, this.theme, t, this.amb);
    this.plan = plan;
    // 要る素材
    const mats = new Set();
    for (let y = c0y - 1; y <= c0y + CHUNK; y++) for (let x = c0x - 1; x <= c0x + CHUNK; x++) mats.add(this.C(x, y).mat);
    mats.add('deck');
    this.mats = Array.from(mats);
    // 描く物（チャンクに掛かる物だけ）
    const X0 = this.X0, Y0 = this.Y0, S = this.size, M = 48 * s;
    const hit = (x0, y0, x1, y1) => x1 > X0 - M && x0 < X0 + S + M && y1 > Y0 - M && y0 < Y0 + S + M;
    const draw = [];
    for (const it of plan.items) {
      if (it.bld) { if (hit(it.x - 8 * s, it.y - it.h - 24 * s, it.x + it.w + 40 * s, it.y + 24 * s)) draw.push(it); }
      else if (hit(it.x - 96 * s, it.y - 120 * s, it.x + 96 * s, it.y + 32 * s)) draw.push(it);
    }
    // 木・藪・根・深い森の縁の木、地面の小さな飾り（マスから決まる）
    const th = this.theme, C = this.C;
    for (let y = c0y - 1; y < c0y + CHUNK + 4; y++) for (let x = c0x - 3; x < c0x + CHUNK + 3; x++) {
      const c = C(x, y);
      if (c.found || !c.tall) continue;
      const fy = (y + 0.86) * t;
      if (c.tall === 'tree') {
        const n = th.twoTrees ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const sp = treeSprite(th, x, y, k, s), jx = n === 2 ? (k ? 0.72 : 0.28) : 0.5 + (variantOf(x, y, 81) - 0.5) * 0.3;
          draw.push({ key: sp.key, opts: sp.opts, x: (x + jx) * t, y: fy - (n === 2 && k ? 4 * s : 0), ft: y * t, layer: 'split', shadow: 'tall', sortY: fy + k });
        }
      } else if (c.tall === 'bush') {
        draw.push({ key: 'hd:prop:bush', opts: optsS(th.leaf === 'moss' ? { v: Math.floor(variantOf(x, y, 83) * 4), leaf: 'moss' } : { v: Math.floor(variantOf(x, y, 83) * 4) }, s), x: (x + 0.5) * t, y: fy, ft: y * t, layer: 'split', shadow: 'blob', sortY: fy });
      } else if (c.tall === 'roots') {
        draw.push({ key: 'hd:prop:roots', opts: optsS({ v: Math.floor(variantOf(x, y, 85) * 4) }, s), x: (x + 0.5) * t, y: fy, ft: y * t, layer: 'split', shadow: 'blob', sortY: fy });
      } else if (c.tall === 'canopy' && th.edgeTrees) {
        // 深い森: 縁（下か横が歩ける所）には幹の見える木、奥はときどき木の頭
        const edge = !C(x, y + 1).tall || (!C(x - 1, y).tall && !C(x - 1, y).raised) || (!C(x + 1, y).tall && !C(x + 1, y).raised);
        if (edge || variantOf(x, y, 87) < 0.3) {
          const sp = treeSprite(th, x, y, 0, s);
          draw.push({ key: sp.key, opts: sp.opts, x: (x + 0.5 + (variantOf(x, y, 89) - 0.5) * 0.4) * t, y: fy, ft: y * t, layer: edge ? 'split' : 'base', shadow: edge ? 'tall' : null, sortY: fy });
        }
      }
    }
    // 地面の飾り（歩ける地面の上だけ。建物・物のマスは避ける）
    const dec = th.decor || {};
    for (let y = c0y; y < c0y + CHUNK; y++) for (let x = c0x; x < c0x + CHUNK; x++) {
      const c = C(x, y);
      if (!c.walk || c.water || c.hard || c.raised || c.tall || plan.occ.has(x + ',' + y) || x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      if (c.mat === 'road' || c.mat === 'sand') continue;
      let k = 0;
      for (const id of Object.keys(dec)) {
        k++;
        if (variantOf(x, y, 100 + k) >= dec[id]) continue;
        const px = (x + 0.2 + variantOf(x, y, 110 + k) * 0.6) * t, py = (y + 0.3 + variantOf(x, y, 120 + k) * 0.6) * t;
        const o2 = { v: Math.floor(variantOf(x, y, 130 + k) * 4) };
        if (th.leaf === 'moss') o2.leaf = 'moss';
        draw.push({ key: 'hd:prop:' + id, opts: optsS(o2, s), x: px, y: py, ft: py, layer: 'base', shadow: null, sortY: py, decor: id });
        break;
      }
    }
    draw.sort((a, b) => a.sortY - b.sortY || a.x - b.x);
    this.draw = draw;
    return true;
  };

  Job.prototype._mats = function (deadline) {
    while (this.i < this.mats.length) {
      if (!T._sheet(this.mats[this.i], this.tile, deadline).done) return false;
      this.i++;
      if (U().now() > deadline) return this.i >= this.mats.length;
    }
    return true;
  };

  Job.prototype._sprites = function (deadline) {
    const Hd = R.Hd;
    while (this.i < this.draw.length) {
      const it = this.draw[this.i++];
      it.sheet = Hd.now(it.key, it.opts);   // 先に prewarm で焼いてあれば取り出すだけ
      if (U().now() > deadline) break;
    }
    return this.i >= this.draw.length;
  };

  Job.prototype._ground = function (deadline) {
    const t = this.tile, S = this.size;
    if (!this.px) this.px = new Uint32Array(S * S);
    const c0x = this.cells[0] - 1, c0y = this.cells[1] - 1, n = CHUNK + 1;
    while (this.i < n) {
      const dy = c0y + this.i;
      for (let k = 0; k < n; k++) {
        const dx = c0x + k;
        T._dgTile(this.px, S, this.X0, this.Y0, dx, dy, [this.C(dx, dy).mat, this.C(dx + 1, dy).mat, this.C(dx, dy + 1).mat, this.C(dx + 1, dy + 1).mat], t);
      }
      this.i++;
      if (U().now() > deadline) return this.i >= n;
    }
    return true;
  };

  Job.prototype._rise = function () {
    const [x0, y0, x1, y1] = this.cells;
    T._rise(this.px, this.size, this.X0, this.Y0, this.C, this.tile, x0, y0, x1, y1);
    T._waterEdges(this.px, this.size, this.X0, this.Y0, this.C, this.tile, x0, y0, x1, y1);
    return true;
  };

  // 大きなゆらぎ（4 マスで一周する素材の繰り返しを見えなくする。4×4 px ごとに世界の座標のノイズで明暗）
  Job.prototype._macro = function () {
    const t = this.tile, S = this.size, px = this.px, u = U(), X0 = this.X0, Y0 = this.Y0, B = 4;
    for (let by = 0; by < S; by += B) for (let bx = 0; bx < S; bx += B) {
      const wx = X0 + bx + 2, wy = Y0 + by + 2;
      const c = this.C(Math.floor(wx / t), Math.floor(wy / t));
      if (c.raised) continue;
      const amp = T._matInfo(c.mat).macro;
      if (!amp) continue;
      const k = 32 / t, n = u.vn(wx * k, wy * k, 176, 7) * 0.7 + u.vn(wx * k, wy * k, 56, 8) * 0.3;
      const f = (n - 0.5) * 2 * amp;
      if (f > -0.01 && f < 0.01) continue;
      for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) px[y * S + x] = T._shade(px[y * S + x], f);
    }
    return true;
  };

  Job.prototype._put = function () {
    const S = this.size, c = U().canvas(S, S);
    if (!c) throw new Error('no canvas');
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    new Uint32Array(img.data.buffer).set(this.px);
    g.putImageData(img, 0, 0);
    this.base = c; this.bg = g;
    this.px = null;
    return true;
  };

  function overCtx(job) {
    if (!job.over) { job.over = U().canvas(job.size, job.size); job.og = job.over.getContext('2d'); job.og.imageSmoothingEnabled = false; }
    return job.og;
  }

  // 足場（lv 1。over に描く）と支柱・下の影（base）
  Job.prototype._deck = function () {
    const [x0, y0, x1, y1] = this.cells, t = this.tile, s = this.s, C = this.C;
    let any = false;
    for (let y = y0 - 1; y < y1 + 1 && !any; y++) for (let x = x0 - 1; x < x1 + 1; x++) if (C(x, y).deck) { any = true; break; }
    if (!any) return true;
    const S = this.size, buf = new Uint32Array(S * S), sh = T._sheet('deck', t), SS = sh.S, bg = this.bg;
    for (let y = y0 - 1; y < y1 + 1; y++) for (let x = x0; x < x1; x++) {
      const c = C(x, y);
      if (!c.deck) continue;
      const px0 = x * t - this.X0, py0 = y * t - this.Y0;
      const up = C(x, y - 1).deck, dn = C(x, y + 1).deck, lf = C(x - 1, y).deck, rt = C(x + 1, y).deck;
      const faceH = dn ? 0 : Math.round(7 * s);
      for (let yy = 0; yy < t + faceH; yy++) {
        const ly = py0 + yy; if (ly < 0 || ly >= S) continue;
        for (let xx = 0; xx < t; xx++) {
          const lx = px0 + xx; if (lx < 0 || lx >= S) continue;
          let p;
          if (yy >= t) p = U().pack(U().pick(T._PAL.plank, 0.35 - (yy - t) * 0.04 + (((x * t + xx) % 16) < 3 ? -0.15 : 0)));
          else {
            p = sh.px[(((y * t + yy) % SS) + SS) % SS * SS + (((x * t + xx) % SS) + SS) % SS];
            if (!up && yy < 2) p = T._shade(p, 0.25);
            if (!lf && xx < 2) p = T._shade(p, xx ? -0.2 : 0.2);
            if (!rt && xx >= t - 2) p = T._shade(p, -0.45);
            if (!dn && yy >= t - 2) p = T._shade(p, 0.18);
          }
          buf[ly * S + lx] = p;
        }
      }
      // 支柱と、足場の下の地面の影（base）
      if (!dn) {
        bg.save(); bg.fillStyle = 'rgba(8,6,20,0.35)'; bg.fillRect(px0, py0 + t + faceH, t, Math.round(10 * s)); bg.restore();
        for (const px of [px0 + 4 * s, px0 + t - 7 * s]) { bg.fillStyle = '#3a2616'; bg.fillRect(Math.round(px), py0 + t + faceH, Math.round(3 * s), Math.round(14 * s)); bg.fillStyle = '#5c3e26'; bg.fillRect(Math.round(px), py0 + t + faceH, Math.round(s), Math.round(14 * s)); }
      }
    }
    const g = overCtx(this), tmp = U().canvas(S, S), tg = tmp.getContext('2d'), img = tg.createImageData(S, S);
    new Uint32Array(img.data.buffer).set(buf); tg.putImageData(img, 0, 0);
    g.drawImage(tmp, 0, 0);
    return true;
  };

  Job.prototype._shadow = function (deadline) {
    const g = this.bg, X0 = this.X0, Y0 = this.Y0, s = this.s;
    while (this.i < this.draw.length) {
      const it = this.draw[this.i++];
      if (!it.shadow || !it.sheet || it.layer === 'over') continue;
      const fr = frameOf(it.sheet, it.frame);
      if (it.shadow === 'blob') {
        const w = Math.max(6 * s, fr.c.width * 0.42), h = Math.max(2.5 * s, fr.c.width * 0.14);
        blob(g, it.x - X0 + 2 * s, it.y - Y0 - s, w, h, 0.5);
        continue;
      }
      const sh = T._shadowOf(fr, it.shadow, s);
      if (!sh) continue;
      g.save(); g.globalAlpha = it.shadow === 'block' ? 0.5 : 0.42; g.globalCompositeOperation = 'multiply';
      g.drawImage(sh.c, Math.round(it.x - X0 - sh.ox), Math.round(it.y - Y0 - sh.oy));
      g.restore();
      if (it.shadow === 'tall') blob(g, it.x - X0, it.y - Y0 - s, Math.max(6 * s, fr.c.width * 0.3), Math.max(2.5 * s, fr.c.width * 0.1), 0.55);
      if (it.bld) {
        // 壁の根元の AO（9 px）
        const gr = g.createLinearGradient(0, it.y - Y0, 0, it.y - Y0 + 9 * s);
        gr.addColorStop(0, 'rgba(6,4,16,0.55)'); gr.addColorStop(1, 'rgba(6,4,16,0)');
        g.fillStyle = gr; g.fillRect(it.x - X0 - 2 * s, it.y - Y0, it.w + 4 * s, 9 * s);
      }
      if (U().now() > deadline) return this.i >= this.draw.length;
    }
    return true;
  };
  function blob(g, x, y, rx, ry, a) {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(6,6,16,${a})`); gr.addColorStop(0.6, `rgba(6,6,16,${a * 0.6})`); gr.addColorStop(1, 'rgba(6,6,16,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }

  Job.prototype._draw = function (deadline) {
    const X0 = this.X0, Y0 = this.Y0, S = this.size;
    while (this.i < this.draw.length) {
      const it = this.draw[this.i++];
      const sh = it.sheet;
      if (!sh || !sh.frames || !sh.frames[0]) continue;
      const fr = frameOf(sh, it.frame), c = fr.c, w = c.width, h = c.height;
      const dx = Math.round(it.x - X0 - fr.ox), dy = Math.round(it.y - Y0 - fr.oy);
      if (dx >= S || dy >= S || dx + w <= 0 || dy + h <= 0) continue;
      if (it.layer === 'base') { this.bg.drawImage(c, dx, dy); continue; }
      if (it.layer === 'over') { overCtx(this).drawImage(c, dx, dy); continue; }
      const split = Math.round(it.ft - Y0) - dy; // 絵の中の行: ここより上は over
      if (split <= 0) this.bg.drawImage(c, dx, dy);
      else if (split >= h) overCtx(this).drawImage(c, dx, dy);
      else {
        this.bg.drawImage(c, 0, split, w, h - split, dx, dy + split, w, h - split);
        overCtx(this).drawImage(c, 0, 0, w, split, dx, dy, w, split);
      }
      if (U().now() > deadline) return this.i >= this.draw.length;
    }
    // 見つけた隠し通路の印（床の上）
    const [x0, y0, x1, y1] = this.cells, t = this.tile;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = this.C(x, y); if (c.found) T._secretMark(this.bg, x * t - X0, y * t - Y0, t, c.raw); }
    return true;
  };

  Job.prototype._light = function () {
    const map = this.map, t = this.tile, s = this.s, X0 = this.X0, Y0 = this.Y0, S = this.size;
    const env = { tile: t, st: this.st, bld: (o) => { try { return R.Hd.now(T.building(o), { tile: t }); } catch (e) { return null; } } };
    const all = lightsCached(map, env, this.plan);
    const lights = all.lights.slice(), glows = [];
    // 洞窟の水は淡く光る（MODERN_UI §4.1-3 の光る苔・結晶と同じ青緑）
    const [x0, y0, x1, y1] = this.cells;
    if (this.theme.pools) for (let y = y0 - 3; y < y1 + 3; y++) for (let x = x0 - 3; x < x1 + 3; x++) {
      const c = this.C(x, y);
      if (c.water && U().h3(x, y, 5) > 0.55) lights.push({ x: (x + 0.5) * t, y: (y + 0.5) * t, r: 48 * s, color: '#3cc8c8', k: 0.35, kind: 'pool', type: 'pool' });
    }
    this.chunkLights = lights.filter((L) => L.x >= X0 && L.x < X0 + S && L.y >= Y0 && L.y < Y0 + S);
    for (const G of all.glows) if (G.x >= X0 && G.x < X0 + S && G.y >= Y0 && G.y < Y0 + S) glows.push(G);
    // 蛍（テーマの空気。位置はチャンクから決まる）
    const nf = this.theme.fireflies || 0, rr = R.rng('ff:' + map.id + ':' + this.cx + ':' + this.cy);
    for (let i = 0; i < nf; i++) {
      const x = X0 + rr.next() * S, y = Y0 + rr.next() * S, c = this.C(Math.floor(x / t), Math.floor(y / t));
      if (c.raised && !this.theme.pools) continue;
      glows.push({ x, y, r: 7 * s, core: 1 * s, halo: 7 * s, color: rr.next() < 0.6 ? '#ffd278' : '#96f0dc', k: 0.55, type: 'firefly' });
    }
    this.glows = glows;
    this.emissive = all.emissive.filter((e) => e.x + (e.w || 4) > X0 && e.x < X0 + S && e.y + (e.h || 4) > Y0 && e.y < Y0 + S);
    // 光の地図（RENDER）を base と over に掛ける
    const o = { ambient: this.amb.ambient, k: this.amb.k, mood: this.amb.mood, lights, moon: all.moon };
    const rect = [X0, Y0, S, S];
    let lm = null;
    if (R.Light && R.Light.map) lm = R.Light.map(rect, o);
    else lm = fallbackMap(rect, o);
    const bg = this.bg;
    bg.save(); bg.globalCompositeOperation = 'multiply'; bg.imageSmoothingEnabled = true; bg.drawImage(lm, 0, 0, lm.width, lm.height, 0, 0, S, S); bg.restore();
    if (this.over) {
      const og = this.og, keep = U().canvas(S, S), kg = keep.getContext('2d');
      kg.drawImage(this.over, 0, 0);
      og.save(); og.globalCompositeOperation = 'multiply'; og.imageSmoothingEnabled = true; og.drawImage(lm, 0, 0, lm.width, lm.height, 0, 0, S, S);
      og.globalCompositeOperation = 'destination-in'; og.drawImage(keep, 0, 0); og.restore();
    }
    return true;
  };
  // 光の地図の予備（R.Light がまだ読めないとき。RENDER の light.js と同じ考え方の簡単な物）
  function fallbackMap(rect, o) {
    const c = U().canvas(rect[2], rect[3]), g = c.getContext('2d'), a = U().hex(o.ambient || '#5c5aa0'), k = o.k != null ? o.k : 1;
    g.fillStyle = `rgb(${a.map((v) => Math.round(255 - (255 - v) * k)).join(',')})`; g.fillRect(0, 0, rect[2], rect[3]);
    g.globalCompositeOperation = 'lighter';
    for (const L of o.lights || []) {
      const x = L.x - rect[0], y = L.y - rect[1], cc = U().hex(L.color || '#ffc27a');
      g.save(); g.translate(x, y); g.scale(1, 0.62);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, L.r); gr.addColorStop(0, `rgba(${cc},${L.k})`); gr.addColorStop(0.35, `rgba(${cc},${L.k * 0.6})`); gr.addColorStop(1, `rgba(${cc},0)`);
      g.fillStyle = gr; g.fillRect(-L.r, -L.r, L.r * 2, L.r * 2); g.restore();
    }
    return c;
  }
  // 地図の光の一覧は状態が変わるまで使い回す
  const lightCache = new WeakMap();
  function lightsCached(map, env, plan) {
    const c = lightCache.get(map);
    if (c && c.plan === plan && c.tile === env.tile) return c.v;
    const v = T._lightsOf(map, env);
    lightCache.set(map, { plan, tile: env.tile, v });
    return v;
  }

  Job.prototype._emissive = function () {
    const g = this.bg, X0 = this.X0, Y0 = this.Y0, S = this.size, t = this.tile, C = this.C;
    T._drawEmissive(g, this.emissive, X0, Y0, this.s);
    let water = false;
    const [x0, y0, x1, y1] = this.cells;
    for (let y = y0; y < y1 && !water; y++) for (let x = x0; x < x1; x++) if (C(x, y).water) { water = true; break; }
    if (water) {
      const lights = this.chunkLights.concat(lightsCached(this.map, { tile: t }, this.plan).lights.filter((L) => L.r >= 60 && Math.abs(L.x - (X0 + S / 2)) < S && L.y < Y0 + S && L.y > Y0 - 90));
      T._waterGlints(g, X0, Y0, S, (wx, wy) => C(Math.floor(wx / t), Math.floor(wy / t)).water, lights, this.map.id + ':' + this.cx + ':' + this.cy);
    }
    return true;
  };

  Job.prototype._finish = function () {
    const S = this.size, X0 = this.X0, Y0 = this.Y0;
    const props = this.plan.dyn.filter((p) => p.x >= X0 && p.x < X0 + S && p.y - 1 >= Y0 && p.y - 1 < Y0 + S).map((p) => Object.assign({}, p));
    this.result = {
      base: this.base, over: this.over || null, lights: this.chunkLights, glows: this.glows, props,
      x: X0, y: Y0, size: S, map: this.map.id, cx: this.cx, cy: this.cy, tile: this.tile,
      bytes: S * S * 4 * (this.over ? 2 : 1),
    };
    this.draw = null; this.C = null; this.bg = null; this.og = null;
    return true;
  };

  T.bakeChunk = function (map, cx, cy, o) {
    return new Job(map, cx | 0, cy | 0, o || {});
  };
  T._Job = Job;

  // ------------------------------------------------------------------ 焼き直し
  const dirtyMaps = {};
  T.chunkOf = function (x, y) { return [Math.floor(x / CHUNK), Math.floor(y / CHUNK)]; };
  T.dirty = function (map, x, y) {
    const id = typeof map === 'string' ? map : map && map.id;
    if (!id) return [];
    const m = typeof map === 'string' ? R.DB.maps[map] : map;
    if (m) { planCache.delete(m); lightCache.delete(m); }
    R.MapUtil && R.MapUtil.invalidate && R.MapUtil.invalidate(id);
    const out = [], add = (cx, cy) => { if (!out.some((q) => q[0] === cx && q[1] === cy)) out.push([cx, cy]); };
    add(Math.floor(x / CHUNK), Math.floor(y / CHUNK));
    // 物の灯りが隣のチャンクに届く（かがり火・灯籠）、隠し通路の上の壁の面が変わる
    const objs = m ? R.MapUtil.objectsAt(m, x, y) : [];
    const reach = objs.some((o) => o.type === 'brazier' || o.type === 'waylamp' || o.type === 'spring') ? 5 : 0;
    const cell = m && R.MapUtil.cell(m, x, y);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) add(Math.floor((x + dx) / CHUNK), Math.floor((y + dy) / CHUNK));
    if (cell && cell.secret) add(Math.floor(x / CHUNK), Math.floor((y - 1) / CHUNK));
    const set = (dirtyMaps[id] = dirtyMaps[id] || []);
    for (const q of out) if (!set.some((p) => p[0] === q[0] && p[1] === q[1])) set.push(q);
    R.emit && R.emit('terrain:dirty', { map: id, chunks: out });
    return out;
  };
  T.takeDirty = function (mapId) { const l = dirtyMaps[mapId] || []; dirtyMaps[mapId] = []; return l; };

  // ------------------------------------------------------------------ 先に焼く
  T.prewarm = function (map, o) {
    o = o || {};
    const tile = tileOf(o), theme = T.theme(map), s = tile / 32;
    const todo = [];
    const mats = new Set([theme.ground, map.outside || theme.outside, 'deck']);
    for (const k of Object.keys(map.legend || {})) { const e = map.legend[k]; mats.add(T._underOf(e.mat, theme)); if (e.floor) mats.add(e.floor); if (T._matInfo(e.mat).face) todo.push({ face: T._matInfo(e.mat).face, rise: Math.max(1, e.rise || 1) }); }
    for (const m of mats) if (m) todo.push({ mat: m });
    const st = stateOf(map, o.state), amb = T.ambient(map, o.tier), plan = planOf(map, st, theme, tile, amb);
    const seen = new Set();
    for (const it of plan.items.concat(plan.dyn)) { const k = it.key + JSON.stringify(it.opts || null); if (!seen.has(k)) { seen.add(k); todo.push({ key: it.key, opts: it.opts }); } }
    // 木の絵（テーマの種類 × 形の変化）
    const hasTall = Object.keys(map.legend || {}).some((k) => { const m = T._matInfo(map.legend[k].mat); return m.tall === 'tree' || m.tall === 'canopy'; });
    if (hasTall) for (let v = 0; v < 6; v++) for (let hh = 0; hh < 3; hh++) for (const id of theme.tree || ['tree']) {
      const opts = { v, h: id === 'tree_giant' ? 96 : 44 + hh * 8 };
      if (theme.leaf && theme.leaf !== 'leaf' && id !== 'pine') opts.leaf = theme.leaf;
      if (s !== 1) opts.s = s;
      if (id === 'tree_giant' && hh) continue;
      todo.push({ key: 'hd:prop:' + id, opts });
    }
    const job = { kind: 'prewarm', done: false, result: null, i: 0, n: todo.length, ms: 0,
      step(ms) {
        const t0 = U().now(), deadline = t0 + (ms == null ? 3 : ms);
        while (job.i < todo.length) {
          const w = todo[job.i];
          if (w.mat) { if (!T._sheet(w.mat, tile, deadline).done) break; }
          else if (w.face) T._faceSheet(w.face, tile, w.rise);
          else if (w.key && R.Hd.has(w.key) && !R.Hd.ready(w.key, w.opts)) { try { R.Hd.now(w.key, w.opts); } catch (e) { console.error('[Terrain] prewarm', w.key, e); } }
          job.i++;
          if (U().now() > deadline) break;
        }
        job.ms += U().now() - t0;
        if (job.i >= todo.length) job.done = true;
        return job.done;
      } };
    return job;
  };
})(window.RPG);
