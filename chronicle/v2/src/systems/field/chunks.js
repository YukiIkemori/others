// FIELD — チャンクの焼きと持ち方（V2_PLAN §2.5.8・§2.10・§2.11）
//   焼くのは TERRAIN（R.Terrain.bakeChunk(map, cx, cy, {tile, tier, state}) → Job）。FIELD は仕事を R.Hd.schedule(job, prio) に積み、
//   量を R.Hd.track('chunk', id, bytes) で届け、持つ範囲（見えている範囲＋周り 1 チャンク＋進む向きに 2 チャンク先）を決め、外れた物を捨てる。
//   state = {grid: R.MapUtil.grid(map), chests, lit, lamps, secrets}（R.Game の今の値）。
//   マップに入る暗転の中で prewarm と見える範囲を焼く。見える範囲に焼けていないチャンクが来たら、その場で焼き切る（stat.miss に数える）。
//   TERRAIN の結果に base が無い間（仮の実装）は、ここで素材の色から仮の地面を焼く（fb）。宝箱・燭台・隠し通路・tilePatches が変わったら、
//   そのチャンクだけ焼き直す（焼き終わるまで古い絵を出す）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const CK = (F.chunks = F.chunks || {});
  const CH = () => (R.Terrain && R.Terrain.CHUNK) || 8;
  const KEYW = 4096;
  const view = { x0: 0, y0: 0, x1: -1, y1: -1 };
  const camTmp = {};

  function map() { return S.map; }
  function all() { return S.chunks || (S.chunks = new Map()); }
  function state() {
    const G = R.Game || {}, id = S.map.id;
    return {
      grid: R.MapUtil.grid(S.map), chests: (G.chests && G.chests[id]) || [], lit: (G.lit && G.lit[id]) || [],
      lamps: G.lamps || {}, secrets: (G.secrets && G.secrets[id]) || [],
    };
  }
  function tid(e) { return S.map.id + ':' + S.chTile + ':' + e.cx + ',' + e.cy; }

  /** 全部捨てる（マップ・広さが変わった） */
  CK.reset = function () {
    for (const e of all().values()) drop(e);
    all().clear();
    S.chGen = (S.chGen || 0) + 1;
    S.chTile = F._tile();
    S.lastGrid = S.map ? R.MapUtil.grid(S.map) : null;
  };
  function drop(e) {
    e.dead = true;
    if (e.bytes) R.Hd.track('chunk', e.tid, null);
  }

  function request(cx, cy, prio) {
    const e = { cx, cy, key: cy * KEYW + cx, ready: false, base: null, over: null, lights: null, glows: null, props: null, fb: false, bytes: 0, used: R.Engine.frame, gen: S.chGen, dead: false, job: null, next: null };
    e.tid = tid(e);
    all().set(e.key, e);
    e.job = makeJob(e, prio);
    return e;
  }
  /** TERRAIN の仕事を包む（K.bakeJob）。終わったら結果を当てる（base が無ければ仮の地面） */
  function makeJob(e, prio, rebake) {
    const m = S.map, tile = S.chTile, gen = S.chGen;
    let tj = null;
    const job = {
      kind: 'chunk', done: false, result: null,
      step(ms) {
        if (job.done) return true;
        if (!canBake()) { job.done = true; if (!e.dead) apply(e, null, rebake); return true; }   // node（キャンバスなし）: 焼かずに済ませる
        try {
          if (!tj) tj = R.Terrain.bakeChunk(m, e.cx, e.cy, { tile, tier: R.Tier.get(), state: state() });
          if (tj && !tj.done) tj.step(ms);
        } catch (err) {
          if (!S.bakeErr) { S.bakeErr = true; console.error('[field] chunk bake failed (the plain ground is used)', err); }
          tj = null;
        }
        if (!tj || tj.done) {
          job.done = true;
          job.result = tj ? tj.result : null;
          if (!e.dead && gen === S.chGen && S.map === m) apply(e, job.result, rebake);
        }
        return job.done;
      },
    };
    if (rebake) e.next = job; else e.job = job;
    if (prio != null) R.Hd.schedule(job, prio);
    return job;
  }
  function apply(e, res, rebake) {
    if (!res || !res.base) res = fallback(S.map, e.cx, e.cy, S.chTile, res);
    e.base = res.base; e.over = res.over || null;
    e.lights = res.lights || []; e.glows = res.glows || []; e.props = res.props || [];
    e.fb = !!res.fb;
    e.ready = true;
    if (rebake) e.next = null;
    const px = CH() * S.chTile;
    const bytes = (e.base ? px * px * 4 : 0) + (e.over ? px * px * 4 : 0);
    if (bytes !== e.bytes) { e.bytes = bytes; R.Hd.track('chunk', e.tid, bytes || null); }
  }
  /** 仕事をその場で進める（暗転の中・見える範囲に焼けていない物が来たとき）。capMs で終わらなければ、仮の地面を今すぐ出し、
   *  本物は列の先頭で続ける（終わったら差し替わる） */
  function finishNow(e, job, capMs) {
    const t0 = now();
    while (!job.done && now() - t0 < (capMs || 60)) job.step(4);
    if (!job.done && !e.ready) {
      apply(e, null);
      R.Hd.schedule(job, 120);
    }
  }
  let canvasOk = null;
  function canBake() { if (canvasOk == null) canvasOk = !!(R.Gfx.canvas2d && R.Gfx.canvas2d(1, 1)); return canvasOk; }
  function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  /** 見えている範囲（チャンク座標） */
  CK.view = function (out) {
    out = out || view;
    const m = map(), n = CH(), cam = F._cam(camTmp), cs = n * cam.t;
    const mx = Math.ceil(m.w / n) - 1, my = Math.ceil(m.h / n) - 1;
    out.x0 = Math.max(0, Math.floor(cam.cx / cs)); out.y0 = Math.max(0, Math.floor(cam.cy / cs));
    out.x1 = Math.min(mx, Math.floor((cam.cx + R.W - 1) / cs)); out.y1 = Math.min(my, Math.floor((cam.cy + R.H - 1) / cs));
    out.mx = mx; out.my = my;
    return out;
  };

  /** 毎フレーム（描く前）: 持つ範囲を積み、外れた物を捨てる。見える範囲に焼けていない物があれば焼き切る */
  CK.sync = function () {
    if (!S.map) return;
    if (S.chTile !== F._tile()) CK.reset();
    const v = CK.view(view), A = all(), f = R.Engine.frame;
    // 進む向きに 2 チャンク先まで
    const mv = S.mv;
    const ax0 = v.x0 - 1 - (mv && mv.dx < 0 ? 1 : 0), ax1 = v.x1 + 1 + (mv && mv.dx > 0 ? 1 : 0);
    const ay0 = v.y0 - 1 - (mv && mv.dy < 0 ? 1 : 0), ay1 = v.y1 + 1 + (mv && mv.dy > 0 ? 1 : 0);
    for (let cy = Math.max(0, ay0); cy <= Math.min(v.my, ay1); cy++) {
      for (let cx = Math.max(0, ax0); cx <= Math.min(v.mx, ax1); cx++) {
        let e = A.get(cy * KEYW + cx);
        const inView = cx >= v.x0 && cx <= v.x1 && cy >= v.y0 && cy <= v.y1;
        if (!e) {
          const d = Math.max(cx < v.x0 ? v.x0 - cx : cx > v.x1 ? cx - v.x1 : 0, cy < v.y0 ? v.y0 - cy : cy > v.y1 ? cy - v.y1 : 0);
          e = request(cx, cy, null);
          R.Hd.schedule(e.job, inView ? 100 : 60 - d * 10);
        }
        e.used = f;
        if (inView && !e.ready) {
          // 焼けていないチャンクが画面に出る: ここで焼き切る（ダッシュの試験で 0 であること）
          S.stat.miss++;
          finishNow(e, e.job, 12);
        }
      }
    }
    if ((f & 31) === 0) evict(ax0 - 1, ay0 - 1, ax1 + 1, ay1 + 1);
  };
  /** 持つ範囲の外（ヒステリシス 1）と、予算（BUDGET.mb.chunk）を超えた分を古い順に捨てる */
  function evict(x0, y0, x1, y1) {
    const A = all();
    let total = 0;
    for (const e of A.values()) {
      if (e.cx < x0 || e.cx > x1 || e.cy < y0 || e.cy > y1) { drop(e); A.delete(e.key); continue; }
      total += e.bytes;
    }
    const cap = (((R.Hd.BUDGET && R.Hd.BUDGET.mb && R.Hd.BUDGET.mb.chunk) || 40) * 1048576);
    if (total > cap) {
      const list = [...A.values()].sort((a, b) => a.used - b.used);
      for (const e of list) { if (total <= cap) break; if (e.used === R.Engine.frame) continue; total -= e.bytes; drop(e); A.delete(e.key); }
    }
  }

  /** 暗転の中: 素材・物の下焼き（TERRAIN の prewarm）と見える範囲のチャンクを焼き切る（§2.10 マップに入る 150 ms） */
  CK.prewarm = function () {
    if (!S.map) return;
    const t0 = now();
    try {
      const pj = canBake() ? R.Terrain.prewarm(S.map, { tile: S.chTile }) : null;
      const t1 = now();
      while (pj && !pj.done && now() - t1 < 150) pj.step(4);
      if (pj && !pj.done) R.Hd.schedule(pj, 130);
    } catch (e) { console.error('[field] prewarm', e); }
    const v = CK.view(view);
    for (let cy = v.y0; cy <= v.y1; cy++) for (let cx = v.x0; cx <= v.x1; cx++) {
      const e = request(cx, cy, null);
      finishNow(e, e.job, 60);
    }
    S.stat.enterMs = now() - t0;
    CK.sync();
  };

  /** (x, y) のマスが変わった（宝箱・燭台・隠し通路・灯籠）: TERRAIN に知らせ、光の届く範囲のチャンクを焼き直す */
  CK.dirtyAt = function (x, y, r) {
    if (!S.map) return;
    try { R.Terrain.dirty(S.map, x, y); } catch (e) { console.error(e); }
    const n = CH(), rr = r == null ? 4 : r;
    const cx0 = Math.floor((x - rr) / n), cx1 = Math.floor((x + rr) / n), cy0 = Math.floor((y - rr) / n), cy1 = Math.floor((y + rr) / n);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) rebake(cx, cy);
  };
  CK.dirtyAll = function () { for (const e of all().values()) rebake(e.cx, e.cy); };
  function rebake(cx, cy) {
    const e = all().get(cy * KEYW + cx);
    if (!e) return;
    if (!e.ready) { e.job.done = true; e.job = makeJob(e, 150); return; }
    makeJob(e, 150, true);
  }
  /** tilePatches の結果が変わったか（フラグ・変数・品の後）。変わったマスのチャンクだけ焼き直す */
  CK.checkGrid = function () {
    const g = R.MapUtil.grid(S.map), old = S.lastGrid;
    if (g === old) return;
    S.lastGrid = g;
    if (!old) { CK.dirtyAll(); return; }
    for (let y = 0; y < g.length; y++) {
      if (g[y] === old[y]) continue;
      const a = g[y], b = old[y] || '';
      for (let x = 0; x < a.length; x++) if (a.charAt(x) !== b.charAt(x)) CK.dirtyAt(x, y, 1);
    }
  };
  /** 見えている範囲の焼けたチャンク（描く用）。fn(e) */
  CK.eachVisible = function (fn) {
    const v = CK.view(view), A = all();
    for (let cy = v.y0; cy <= v.y1; cy++) for (let cx = v.x0; cx <= v.x1; cx++) { const e = A.get(cy * KEYW + cx); if (e && e.ready) fn(e); }
  };
  /** マス (x, y) を含むチャンク（無ければ null） */
  CK.at = function (x, y) { const n = CH(); return all().get(Math.floor(y / n) * KEYW + Math.floor(x / n)) || null; };
  CK.stats = function () {
    let n = 0, ready = 0, bytes = 0, fb = 0;
    for (const e of all().values()) { n++; if (e.ready) ready++; if (e.fb) fb++; bytes += e.bytes; }
    return { n, ready, bytes, fb, miss: S.stat.miss, enterMs: S.stat.enterMs || 0 };
  };

  // ================================================================ 仮の地面（TERRAIN の base が来るまで）
  // 素材の色（R.Terrain.material(id).bake）に、壁の立ち上がり・根元の影・水のさざ波・木の葉・足場を足し、
  // 環境光（掛け算）と止まった灯りの光だまり（足し算）を焼き込む。純黒は使わない。
  const WATER = /water|sea|shallow/;
  const TREE = /tree|forest|bush/;
  function legendAt(m, grid, x, y) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
    const row = grid[y];
    const ch = row.length === m.w ? row.charAt(x) : [...row][x];
    const L = m.legend[ch];
    if (L && L.secret) return R.MapUtil.secretFound(m.id, x, y) ? { mat: L.floor || 'stone_floor', _found: true } : L;
    return L || null;
  }
  const isWall = (L) => !!(L && L.solid && !L._found);
  const isWater = (L) => !!(L && !L.solid && L.walk === false && WATER.test(L.mat));

  function fallback(m, cx, cy, tile, res) {
    const n = CH(), size = n * tile;
    const out = { base: null, over: null, lights: (res && res.lights) || [], glows: (res && res.glows) || [], props: (res && res.props) || [], fb: true };
    const cv = R.Gfx.canvas2d ? R.Gfx.canvas2d(size, size) : null;
    if (!cv) return out;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const grid = R.MapUtil.grid(m);
    const x0 = cx * n, y0 = cy * n;
    let og = null;
    const rect = { x: 0, y: 0, w: tile, h: tile };
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const mx = x0 + x, my = y0 + y;
        const L = legendAt(m, grid, mx, my) || { mat: m.outside || 'forest_dark', solid: true };
        const rng = R.rng(m.id + ':' + mx + ',' + my);
        rect.x = x * tile; rect.y = y * tile; rect.w = tile; rect.h = tile;
        const mat = L.deck ? (m.meta && m.meta.underDeck) || 'moss_earth' : L.mat;
        paintMat(g, mat, rect, rng, tile);
        texture(g, rect, rng, tile, L);
        const up = legendAt(m, grid, mx, my - 1), dn = legendAt(m, grid, mx, my + 1);
        if (isWall(L)) {
          if (TREE.test(L.mat)) canopy(g, rect, rng, tile, L.mat);
          else rise(g, rect, tile, !isWall(dn) && dn != null, !isWall(up));
        } else if (isWall(up) && !TREE.test(up.mat)) {
          // 壁の根元の影（AO）
          const gr = g.createLinearGradient(0, rect.y, 0, rect.y + tile * 0.3);
          gr.addColorStop(0, 'rgba(8,8,26,0.45)'); gr.addColorStop(1, 'rgba(8,8,26,0)');
          g.fillStyle = gr; g.fillRect(rect.x, rect.y, tile, tile * 0.3);
        }
        if (isWater(L)) ripples(g, rect, rng, tile);
        if (L.ladder) ladder(g, rect, tile);
        if (L.deck) {
          if (!og) { const oc = R.Gfx.canvas2d(size, size); og = oc.getContext('2d'); out.over = oc; }
          deck(og, rect, rng, tile, L.mat, legendAt(m, grid, mx, my + 1));
          // 足場の影（下の地面）
          g.fillStyle = 'rgba(10,10,30,0.35)'; g.fillRect(rect.x, rect.y, tile, tile);
        }
      }
    }
    light(g, m, x0 * tile, y0 * tile, size, tile);
    out.base = cv;
    return out;
  }
  function paintMat(g, mat, rect, rng, tile) {
    try { R.Terrain.material(mat).bake(g, rect, rng, tile); } catch (e) { g.fillStyle = '#2a2c44'; g.fillRect(rect.x, rect.y, rect.w, rect.h); }
  }
  function texture(g, rect, rng, tile, L) {
    const k = Math.max(1, Math.round(tile / 16));
    for (let i = 0; i < 7; i++) {
      g.fillStyle = rng.chance(0.5) ? 'rgba(255,244,220,0.05)' : 'rgba(6,6,24,0.10)';
      g.fillRect(rect.x + rng.int(0, tile - 2 * k), rect.y + rng.int(0, tile - 2 * k), 2 * k, k * (rng.chance(0.5) ? 1 : 2));
    }
    if (L && /road|cobble|stone_floor|cave_floor|pier|plank|wood_floor/.test(L.mat)) {
      g.fillStyle = 'rgba(6,6,24,0.16)';
      g.fillRect(rect.x, rect.y + tile - k, tile, k);
      g.fillRect(rect.x + tile - k, rect.y, k, tile);
    }
  }
  /** 壁の立ち上がり: 上面（明るい縁）と正面（下へ暗く） */
  function rise(g, rect, tile, face, cap) {
    if (cap) { g.fillStyle = 'rgba(230,220,255,0.16)'; g.fillRect(rect.x, rect.y, tile, Math.max(1, tile / 16)); }
    if (!face) return;
    const fy = rect.y + tile * 0.45, fh = tile * 0.55;
    const gr = g.createLinearGradient(0, fy, 0, fy + fh);
    gr.addColorStop(0, 'rgba(10,10,32,0.18)'); gr.addColorStop(1, 'rgba(10,10,32,0.5)');
    g.fillStyle = gr; g.fillRect(rect.x, fy, tile, fh);
    g.fillStyle = 'rgba(236,226,255,0.14)'; g.fillRect(rect.x, fy, tile, Math.max(1, tile / 16));
  }
  function canopy(g, rect, rng, tile, mat) {
    const dark = mat === 'forest_dark';
    for (let i = 0; i < 3; i++) {
      const r = tile * (0.28 + rng.next() * 0.16);
      const x = rect.x + tile * (0.25 + rng.next() * 0.5), y = rect.y + tile * (0.3 + rng.next() * 0.4);
      g.fillStyle = dark ? 'rgba(14,26,34,0.85)' : 'rgba(28,52,52,0.9)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark ? 'rgba(60,90,110,0.18)' : 'rgba(120,170,150,0.22)';
      g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, Math.PI * 2); g.fill();
    }
  }
  function ripples(g, rect, rng, tile) {
    g.fillStyle = 'rgba(150,190,255,0.14)';
    for (let i = 0; i < 3; i++) g.fillRect(rect.x + rng.int(0, tile / 2), rect.y + rng.int(2, tile - 3), rng.int(tile / 5, tile / 2), 1);
  }
  function ladder(g, rect, tile) {
    g.fillStyle = 'rgba(160,120,80,0.95)';
    g.fillRect(rect.x + tile * 0.22, rect.y, tile * 0.08, tile); g.fillRect(rect.x + tile * 0.70, rect.y, tile * 0.08, tile);
    for (let i = 0; i < 4; i++) g.fillRect(rect.x + tile * 0.22, rect.y + tile * (0.12 + i * 0.25), tile * 0.56, tile * 0.07);
  }
  function deck(g, rect, rng, tile, mat, below) {
    paintMat(g, mat, rect, rng, tile);
    g.fillStyle = 'rgba(8,8,24,0.28)';
    for (let i = 1; i < 4; i++) g.fillRect(rect.x, rect.y + (tile * i) / 4, tile, 1);
    if (!below || !below.deck) {   // 足場の縁（下に厚み）
      g.fillStyle = 'rgba(40,26,20,0.95)'; g.fillRect(rect.x, rect.y + tile - tile * 0.18, tile, tile * 0.18);
      g.fillStyle = 'rgba(255,230,190,0.18)'; g.fillRect(rect.x, rect.y + tile - tile * 0.18, tile, 1);
    }
  }
  /** 光: 環境光（掛け算）と、止まった灯りの光だまり（足し算、地面に楕円） */
  function light(g, m, ox, oy, size, tile) {
    const amb = S.amb || R.Terrain.ambient(m, R.Tier.get()) || {};
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = Math.min(0.75, (amb.k != null ? amb.k : 0.45) * 1.4);
    g.fillStyle = amb.ambient || '#5c5aa0';
    g.fillRect(0, 0, size, size);
    g.restore();
    const L = F._lights(tile);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      const lx = l.x - ox, ly = l.y - oy;
      if (lx + l.r < 0 || ly + l.r < 0 || lx - l.r > size || ly - l.r > size) continue;
      g.save();
      g.translate(lx, ly); g.scale(1, 0.64);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, l.r);
      gr.addColorStop(0, l.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = l.k;
      g.fillStyle = gr; g.fillRect(-l.r, -l.r, l.r * 2, l.r * 2);
      g.restore();
    }
    g.restore();
  }
})(window.RPG);
