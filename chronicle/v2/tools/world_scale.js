// WORLD v3（2026-09-28）: 論理の座標 L（224×192、地方の生成器が描いた物）→ ワールドの座標 W（K 倍）にする段。gen_world.js が
// 全部の地方の生成器（雪原・砂漠・湿原・灰…）の後、街灯をならす前に 1 回呼ぶ。地方の生成器は何も知らなくてよい。
// 考え方は scratchpad の worldv3/DESIGN.md §1。変換そのものは src/core/world_xform.js（ゲームとテストも同じ関数を使う）。
//
//   1. core（町・門・閉じ方・出口・spawn…の塊）を物から自動で見つける。core の中は平行移動（マスをそのまま写す）
//   2. 地形: core の外は L の「下地」（木・道を抜いた地面）を滑らかな多数決で K 倍にし、木・森は密度から生やす（3×3 の塊にしない）
//   3. 道: road() が記録した折れ線を W に写し、core の外では丸めて蛇行させ、元の幅で描き直す
//   4. tilePatches・出口・引き金・spawn・物・人・出現表・地名を写す（core の外の物は小さな組ごと道に沿わせる）
//   5. 1 マスごとの飾り（小石・切り株・蛍…）は捨てる（K² 倍に薄まる）。ワールドの大きさの飾りと名所は tools/world_poi.js
'use strict';
const XF = require('../src/core/world_xform.js');

module.exports = function scaleWorld(A) {
  const { g: G0, K, LEGEND, ROADS, objects, npcs, exits, triggers, tilePatches, spawns, zones, areas, h2, vn } = A;
  const LW = A.W, LH = A.H, W = LW * K, H = LH * K;
  const info = {};
  const Lget = (x, y) => (x >= 0 && y >= 0 && x < LW && y < LH ? G0[y][x] : 'O');

  // ---------------------------------------------------------------- 凡例の種類
  const kindOf = {};
  for (const ch of Object.keys(LEGEND)) {
    const e = LEGEND[ch], mat = e.mat || '';
    if (mat === 'bridge') kindOf[ch] = 'bridge';
    else if (e.solid && (/^(tree|forest_dark|bush|tall_grass|roots)$/.test(mat) || e.tree)) kindOf[ch] = 'feature';
    else if (e.solid) kindOf[ch] = 'solid';
    else if (e.walk === false) kindOf[ch] = 'water';
    else kindOf[ch] = 'ground';
  }
  const kind = (ch) => kindOf[ch] || 'water';
  const blocks = (ch) => kind(ch) !== 'ground' && kind(ch) !== 'bridge';

  // ---------------------------------------------------------------- 道の印（road() の折れ線が塗ったマス）
  const roadMask = new Uint8Array(LW * LH);
  const roadCh = new Set();
  for (const r of ROADS) {
    const wd = r.wd || 2, ch = r.ch || '.';
    roadCh.add(ch);
    for (const [x, y] of stair(r.pts)) for (let j = 0; j < wd; j++) for (let q = 0; q < wd; q++) {
      const X = x + q, Y = y + j;
      if (X >= 0 && Y >= 0 && X < LW && Y < LH && G0[Y][X] === ch) roadMask[Y * LW + X] = 1;
    }
  }
  /** 折れ線（road() と同じ歩き方: 先に x、次に y）のマスの列 */
  function stair(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
      if (i === 0) out.push([x, y]);
      while (x !== x2 || y !== y2) { if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y); out.push([x, y]); }
    }
    return out;
  }
  /** 折れ線の角の点の列（先に x、次に y の角を足す） */
  function corners(pts) {
    const out = [pts[0].slice()];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [x2, y2] = pts[i + 1];
      if (x !== x2 && y !== y2) out.push([x2, y]);
      out.push([x2, y2]);
    }
    return out;
  }

  // ---------------------------------------------------------------- 1. core（物の塊）
  const rects = [];
  const addR = (x0, y0, x1, y1, why) => rects.push({ x0, y0, x1, y1, why: [why] });
  for (const o of objects) {
    if (o.type === 'building') addR(o.x, o.y, o.x + o.w - 1, o.y + o.h - 1, o.id);
    else if (o.type === 'stairs' || o.type === 'door' || o.type === 'examine') addR(o.x, o.y, o.x, o.y, o.type);
    else if (o.type === 'spring') addR(o.x, o.y, o.x + 1, o.y + 1, 'spring');
  }
  for (const e of exits) addR(e.x, e.y, e.x + (e.w || 1) - 1, e.y + (e.h || 1) - 1, 'exit:' + e.to.map);
  for (const t of triggers) if (!isRoadTrigger(t)) addR(t.x, t.y, t.x + (t.w || 1) - 1, t.y + (t.h || 1) - 1, 'trigger:' + t.id);
  for (const k of Object.keys(spawns)) addR(spawns[k].x, spawns[k].y, spawns[k].x, spawns[k].y, 'spawn:' + k);
  for (const p of tilePatches) { if (bigPatch(p)) continue; const [x, y, w, h] = p.rect; addR(x, y, x + w - 1, y + h - 1, 'patch'); }
  for (const n of npcs) if (n.cond) addR(n.x, n.y, n.x, n.y, 'npc:' + n.id);
  // 橋（'='）の塊も core（橋の長さと水の幅がずれない。灰の潮見橋など）
  {
    const seen = new Uint8Array(LW * LH);
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      if (seen[y * LW + x] || kind(G0[y][x]) !== 'bridge') continue;
      let x0 = x, y0 = y, x1 = x, y1 = y; const q = [[x, y]]; seen[y * LW + x] = 1;
      while (q.length) {
        const [cx, cy] = q.pop();
        x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < LW && ny < LH && !seen[ny * LW + nx] && kind(G0[ny][nx]) === 'bridge') { seen[ny * LW + nx] = 1; q.push([nx, ny]); } }
      }
      addR(x0, y0 - 1, x1, y1 + 1, 'bridge');
    }
  }
  function isRoadTrigger(t) { return /ambush/.test(t.id || '') || /ambush/.test(t.event || ''); }
  function bigPatch(p) { return Math.max(p.rect[2], p.rect[3]) >= 10; }
  const GAP = 2, PAD = 1, TAU_MAX = A.tauMax || 6, TAU_MIN = A.tauMin || 3.3;
  mergeRects(rects, GAP);
  function mergeRects(R, gap) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
        const a = R[i], b = R[j];
        const gx = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1) - 1, gy = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1) - 1;
        if (Math.max(gx, gy) <= gap) { join(a, b); R.splice(j, 1); changed = true; j--; }
      }
    }
  }
  function join(a, b) { a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1); a.why.push(...b.why); }
  // 帯のある core（地形ごと動かないと困る塊: 閉じ方・橋・建物のある町、5×5 より大きな塊）と、島（小さな入口と spawn だけ: 平行移動だけ）
  // 帯（地形ごとつなぐ）が要るのは、閉じ方・橋の塊と、海に面した塊（港町: 船・岸が町の並びの一部）だけ。ほかの町は島（まわりの地面で埋めた所に 1:1 で置く）。
  //   帯の中は放射状に引き伸ばすので、町のまわりに筋が見える（2026-09-28 の試し: フェルンのまわり）。島なら筋が出ない
  const seaShare = (r) => { let n = 0, s = 0; for (let y = r.y0 - PAD; y <= r.y1 + PAD; y++) for (let x = r.x0 - PAD; x <= r.x1 + PAD; x++) { n++; if ('~O'.includes(Lget(x, y))) s++; } return s / n; };
  const needsWarp = (r) => r.why.some((w) => w === 'patch' || w === 'bridge') || seaShare(r) >= 0.08;
  const warpR = rects.filter(needsWarp), islandR = rects.filter((r) => !needsWarp(r));
  const mustWarp = (r) => r.why.some((w) => w === 'patch' || w === 'bridge');
  // 錨と帯の幅。帯（W で core を 1 + tau 倍に広げた枠）が重なるなら tau を縮め、TAU_MIN でも重なるなら core をまとめる
  let cores;
  for (let pass = 0; pass < 80; pass++) {
    cores = warpR.map((r) => {
      const x0 = r.x0 - PAD, y0 = r.y0 - PAD, x1 = r.x1 + PAD, y1 = r.y1 + PAD;
      const ax = x0 + Math.floor((x1 - x0 + 1) / 2), ay = y0 + Math.floor((y1 - y0 + 1) / 2);
      return { r, x0, y0, x1, y1, ax, ay, hx0: ax - x0, hx1: x1 + 1 - ax, hy0: ay - y0, hy1: y1 + 1 - ay, tau: TAU_MAX };
    });
    let merged = false;
    for (let i = 0; i < cores.length && !merged; i++) for (let j = i + 1; j < cores.length && !merged; j++) {
      const a = cores[i], b = cores[j];
      // その軸で離れていられる最大の tau（どちらかの軸で離れていればよい）
      const sep = (pa, pb, ha1, hb0) => (pb > pa ? (K * (pb - pa)) / (ha1 + hb0) - 1 : -1);
      const tx = Math.max(sep(a.ax, b.ax, a.hx1, b.hx0), sep(b.ax, a.ax, b.hx1, a.hx0));
      const ty = Math.max(sep(a.ay, b.ay, a.hy1, b.hy0), sep(b.ay, a.ay, b.hy1, a.hy0));
      const t = Math.max(tx, ty);
      if (t >= TAU_MAX) continue;
      if (t < TAU_MIN) {
        // 閉じ方・橋のない方は島にする（帯を作らない）。両方とも閉じ方・橋ならまとめる
        const ma = mustWarp(a.r), mb = mustWarp(b.r);
        if (ma && mb) { join(a.r, b.r); warpR.splice(warpR.indexOf(b.r), 1); }
        else { const d = !mb ? b.r : !ma ? a.r : b.r; const da = (x) => (x.x1 - x.x0 + 1) * (x.y1 - x.y0 + 1); const loser = !ma && !mb ? (da(a.r) < da(b.r) ? a.r : b.r) : d; warpR.splice(warpR.indexOf(loser), 1); islandR.push(loser); }
        merged = true; break;
      }
      a.tau = Math.min(a.tau, t); b.tau = Math.min(b.tau, t);
    }
    if (!merged) break;
    mergeRects(warpR, GAP);
  }
  const xform = { K, cores: cores.map((c) => [c.x0, c.y0, c.x1, c.y1, c.ax, c.ay, +c.tau.toFixed(3)]), islands: [] };
  XF.make(xform);
  // 島: 真ん中の点を W に写した所へ平行移動
  const islands = islandR.map((r) => {
    const x0 = r.x0 - PAD, y0 = r.y0 - PAD, x1 = r.x1 + PAD, y1 = r.y1 + PAD;
    const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, [wx, wy] = XF.toW(xform, cx, cy);
    return { r, x0, y0, x1, y1, dx: Math.round(wx - cx), dy: Math.round(wy - cy) };
  });
  const xform2 = { K, cores: xform.cores, islands: islands.map((q) => [q.x0, q.y0, q.x1, q.y1, q.dx, q.dy]) };
  XF.make(xform2);
  info.cores = cores.length; info.islands = islands.length;
  info.coreArea = cores.reduce((s, c) => s + (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1), 0);
  info.tau = cores.map((c) => +c.tau.toFixed(2)).sort((a, b) => a - b).slice(0, 5);
  const toW = (x, y) => XF.toW(xform2, x, y), toL = (x, y) => XF.toL(xform2, x, y);
  const cellW = (x, y) => XF.cell(xform2, x, y);
  const band = (x, y) => XF.band(xform2, x + 0.5, y + 0.5);

  // ---------------------------------------------------------------- 下地（木・道・橋を抜いた地面）
  const base = [];
  for (let y = 0; y < LH; y++) {
    const row = new Array(LW);
    for (let x = 0; x < LW; x++) {
      const ch = G0[y][x], k = kind(ch);
      if (k === 'feature' || k === 'bridge' || (roadMask[y * LW + x] && roadCh.has(ch))) row[x] = under(x, y, k === 'bridge' ? 'water' : 'ground', ch);
      else row[x] = ch;
    }
    base.push(row);
  }
  // 島の枠は、まわりの地面で塗りつぶす（K 倍の地形に町の中身の 3 倍の写しを作らない。島そのものは下で 1:1 に置く）
  for (const q of islands) {
    const cnt = {};
    for (let y = q.y0 - 2; y <= q.y1 + 2; y++) for (let x = q.x0 - 2; x <= q.x1 + 2; x++) {
      if (x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) continue;
      const c = y >= 0 && x >= 0 && y < LH && x < LW ? base[y][x] : 'O';
      if (kind(c) === 'ground') cnt[c] = (cnt[c] || 0) + 1;
    }
    const fill = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1))[0] || ',';
    for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) if (y >= 0 && x >= 0 && y < LH && x < LW) base[y][x] = fill;
  }
  function under(x, y, want, ch) {
    const cnt = {};
    for (let r = 1; r <= 3; r++) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const c = Lget(x + i, y + j);
        if (kind(c) !== want || (roadMask[(y + j) * LW + x + i] && roadCh.has(c))) continue;
        cnt[c] = (cnt[c] || 0) + 1 / r;
      }
      const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1))[0];
      if (best) return best;
    }
    if (want === 'water') return '~';
    const e = LEGEND[ch] || {};
    if (e.under) { const u = Object.keys(LEGEND).find((c) => LEGEND[c].mat === e.under && kind(c) === 'ground'); if (u) return u; }
    return ',';
  }


  // ---------------------------------------------------------------- 2. 地形
  const g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W));
  const inW = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const tcore = new Float32Array(W * H);   // 帯の t（0 = core の中）
  const FEAT = Object.keys(kindOf).filter((c) => kindOf[c] === 'feature');
  const nz = (x, y, L, s) => vn(x, y, L, s) * 0.6 + vn(x, y, L / 2, s + 7) * 0.3 + vn(x, y, L / 4, s + 13) * 0.1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = band(x, y), p = toL(x + 0.5, y + 0.5);
    tcore[y * W + x] = b.t;
    if (b.t === 0) { g[y][x] = Lget(Math.floor(p[0]), Math.floor(p[1])); continue; }
    const amp = Math.max(0.45, b.t);   // 帯の中でも少しゆらす（帯の放射状の筋を崩す）
    // 座標のゆらぎ（W のノイズ、L で ±0.45 まで）
    const px = p[0] + (nz(x, y, 9, 901) - 0.5) * 0.9 * amp, py = p[1] + (nz(x, y, 9, 907) - 0.5) * 0.9 * amp;
    const ux = px - 0.5, uy = py - 0.5, ix = Math.floor(ux), iy = Math.floor(uy), fx = ux - ix, fy = uy - iy;
    const cells = [[ix, iy, (1 - fx) * (1 - fy)], [ix + 1, iy, fx * (1 - fy)], [ix, iy + 1, (1 - fx) * fy], [ix + 1, iy + 1, fx * fy]];
    const vote = {};
    for (const [cx, cy, w] of cells) { const c = cx >= 0 && cy >= 0 && cx < LW && cy < LH ? base[cy][cx] : 'O'; vote[c] = (vote[c] || 0) + w; }
    let best = null, bv = -1;
    for (const c of Object.keys(vote)) {
      const v = vote[c] + (h2s(c) ? (nz(x, y, 6, h2s(c)) - 0.5) * 0.16 * amp : 0);
      if (v > bv || (v === bv && c < best)) { bv = v; best = c; }
    }
    let ch = best;
    // 木・森は密度から（下地が地面のときだけ）
    if (kind(ch) === 'ground') {
      let fb = null, fv = 0;
      for (const f of FEAT) {
        let d = 0;
        for (const [cx, cy, w] of cells) if (Lget(cx, cy) === f) d += w;
        if (!d) continue;
        d += (nz(x, y, 5, 911 + f.charCodeAt(0)) - 0.5) * 0.5 * amp;
        if (d > fv) { fv = d; fb = f; }
      }
      if (fb && fv > 0.5) ch = fb;
    }
    g[y][x] = ch;
  }
  function h2s(c) { return 700 + c.charCodeAt(0) * 3; }
  // 塞ぐ物の斜めの継ぎ目（L で斜めにだけ接する 2 マスの塞ぐ物は、その角を W でも塞ぐ）
  let repaired = 0;
  for (let y = 0; y < LH - 1; y++) for (let x = 0; x < LW - 1; x++) {
    for (const [a, b, c, d] of [[[x, y], [x + 1, y + 1], [x + 1, y], [x, y + 1]], [[x + 1, y], [x, y + 1], [x, y], [x + 1, y + 1]]]) {
      const ca = Lget(a[0], a[1]), cb = Lget(b[0], b[1]);
      if (!blocks(ca) || !blocks(cb) || blocks(Lget(c[0], c[1])) || blocks(Lget(d[0], d[1]))) continue;
      const [wx, wy] = toW(x + 1, y + 1);
      for (let j = -2; j <= 1; j++) for (let i = -2; i <= 1; i++) {
        const X = Math.floor(wx) + i, Y = Math.floor(wy) + j;
        if (!inW(X, Y) || tcore[Y * W + X] === 0 || blocks(g[Y][X])) continue;
        if (Math.hypot(X + 0.5 - wx, Y + 0.5 - wy) > 1.6) continue;
        g[Y][X] = ca; repaired++;
      }
    }
  }
  info.repaired = repaired;

  // ---------------------------------------------------------------- 3. 道（折れ線を写し、丸めて蛇行させ、元の幅で描き直す）
  const roadsW = [];
  const MEANDER = A.meander != null ? A.meander : 2.6;
  ROADS.forEach((r, ri) => {
    const wd = r.wd || 2, half = wd / 2;
    const cs = corners(r.pts).map(([x, y]) => [x + half, y + half]);
    // L で 0.25 ごとに点を取り、W に写す
    const pts = [];
    for (let i = 0; i < cs.length - 1; i++) {
      const [x0, y0] = cs[i], [x1, y1] = cs[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25));
      for (let k = i ? 1 : 0; k <= n; k++) {
        const lx = x0 + ((x1 - x0) * k) / n, ly = y0 + ((y1 - y0) * k) / n;
        const [wx, wy] = toW(lx, ly), b = XF.band(xform2, wx, wy);
        pts.push({ lx, ly, x: wx, y: wy, t: b.t });
      }
    }
    // 丸める（core の中は動かさない）: W の弧長で ±6 の移動平均、t で重み
    const sm = pts.map((p) => ({ x: p.x, y: p.y }));
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].t === 0) continue;
      let sx = 0, sy = 0, sw = 0;
      for (let j = i; j >= 0 && acc[i] - acc[j] <= 6; j--) { const w = 1 - (acc[i] - acc[j]) / 7; sx += pts[j].x * w; sy += pts[j].y * w; sw += w; }
      for (let j = i + 1; j < pts.length && acc[j] - acc[i] <= 6; j++) { const w = 1 - (acc[j] - acc[i]) / 7; sx += pts[j].x * w; sy += pts[j].y * w; sw += w; }
      const k = Math.min(1, pts[i].t * 1.5);
      sm[i].x = pts[i].x + (sx / sw - pts[i].x) * k; sm[i].y = pts[i].y + (sy / sw - pts[i].y) * k;
    }
    // 蛇行（道の向きに直角のずれ。両端と core の近くは 0）
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = sm[Math.max(0, i - 3)], b = sm[Math.min(pts.length - 1, i + 3)];
      let dx = b.x - a.x, dy = b.y - a.y; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const ends = Math.min(1, acc[i] / 10, (acc[acc.length - 1] - acc[i]) / 10);
      const m = (vn(acc[i], ri * 37, 16, 941) - 0.5) * 2 * MEANDER * Math.min(1, pts[i].t * 1.3) * Math.max(0, ends);
      out.push({ x: sm[i].x - dy * m, y: sm[i].y + dx * m, lx: pts[i].lx, ly: pts[i].ly, t: pts[i].t });
    }
    roadsW.push({ pts: out, wd, ch: r.ch || '.', zone: r.zone, wet: r.wet, src: r });
  });
  // 描く（core の中はもう L のマスのまま。水の上は描かない。wet は沼の水の上を板に）
  const roadCells = new Set();
  for (const r of roadsW) {
    const wd = r.wd, half = wd / 2;
    let px = null, py = null;
    const paint = (cx, cy) => {
      for (let j = 0; j < wd; j++) for (let q = 0; q < wd; q++) {
        const X = cx + q, Y = cy + j;
        if (!inW(X, Y) || tcore[Y * W + X] === 0) continue;
        const c = g[Y][X], k = kind(c);
        if (k === 'bridge') continue;
        if (k === 'water') { if (r.wet && (LEGEND[c] || {}).mat === 'marsh_water') { g[Y][X] = r.wet; roadCells.add(X + ',' + Y); } continue; }
        g[Y][X] = r.ch; roadCells.add(X + ',' + Y);
      }
    };
    for (const p of r.pts) {
      const cx = Math.round(p.x - half), cy = Math.round(p.y - half);
      if (px === null) { paint(cx, cy); px = cx; py = cy; continue; }
      while (px !== cx || py !== cy) {
        // 4 方向で 1 マスずつ（斜めに飛ばない）: 残りの大きい方の軸
        if (Math.abs(cx - px) >= Math.abs(cy - py)) px += Math.sign(cx - px); else py += Math.sign(cy - py);
        paint(px, py);
      }
    }
  }
  // 道の両側 1 マスの木をどける（core の外）
  for (const k of roadCells) {
    const [x, y] = k.split(',').map(Number);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = x + i, Y = y + j;
      if (!inW(X, Y) || tcore[Y * W + X] === 0 || kind(g[Y][X]) !== 'feature') continue;
      const [lx, ly] = toL(X + 0.5, Y + 0.5);
      g[Y][X] = base[Math.max(0, Math.min(LH - 1, Math.floor(ly)))][Math.max(0, Math.min(LW - 1, Math.floor(lx)))];
      if (kind(g[Y][X]) !== 'ground') g[Y][X] = ',';
    }
  }
  info.roadCells = roadCells.size;

  // ---------------------------------------------------------------- 4. 範囲の写し
  /** L の枠 [x, y, w, h] → W の枠 [x, y, w, h]（角を写した外枠） */
  function rectW(x, y, w, h, pad) {
    const a = toW(x, y), b = toW(x + w, y + h);
    const X0 = Math.floor(a[0] + 1e-6) - (pad || 0), Y0 = Math.floor(a[1] + 1e-6) - (pad || 0), X1 = Math.ceil(b[0] - 1e-6) + (pad || 0), Y1 = Math.ceil(b[1] - 1e-6) + (pad || 0);
    return [X0, Y0, Math.max(1, X1 - X0), Math.max(1, Y1 - Y0)];
  }
  for (const p of tilePatches) {
    const [x, y, w, h] = p.rect, R2 = rectW(x, y, w, h), rows = [];
    for (let j = 0; j < R2[3]; j++) {
      let s = '';
      for (let i = 0; i < R2[2]; i++) {
        const [lx, ly] = XF.lcell(xform2, R2[0] + i, R2[1] + j);
        s += lx >= x && lx < x + w && ly >= y && ly < y + h ? p.rows[ly - y][lx - x] || ' ' : ' ';
      }
      rows.push(s);
    }
    p.rect = R2; p.rows = rows;
  }
  for (const e of exits) { const R2 = rectW(e.x, e.y, e.w || 1, e.h || 1); e.x = R2[0]; e.y = R2[1]; e.w = R2[2]; e.h = R2[3]; }
  { const done = new Set(); for (const k of Object.keys(spawns)) { const s = spawns[k]; if (done.has(s)) continue; done.add(s); const [x, y] = cellW(s.x, s.y); s.x = x; s.y = y; } }   // 同じ物を 2 つの名前で指すことがある（yule = yule_w）

  // ---------------------------------------------------------------- 5. 物と人
  const inCore = (x, y) => cores.some((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) || islands.some((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);
  const DECOR = /^(rock_small|firefly|stump|log|rock|mushroom_glow|cactus|thorn_bush|sand_mound|bones|swamp_tree|pale_mushrooms|rotten_stump|snow_rock|ice_crystal|charred_tree|ash_rock|lava_rock|bush|fern|reeds|dec_.*)$/;
  // 道の点（L）→ その道の W の点
  const roadIndex = [];
  for (const r of roadsW) for (const p of r.pts) roadIndex.push(p);
  function nearestRoad(lx, ly, lim) {
    let best = null, bd = lim * lim;
    for (const p of roadIndex) { const d = (p.lx - lx) ** 2 + (p.ly - ly) ** 2; if (d < bd) { bd = d; best = p; } }
    return best;
  }
  const keepObj = [], dropped = [];
  const loose = [];   // core の外の物と人（小さな組にして動かす）
  for (const o of objects) {
    if (o.x == null) { keepObj.push(o); continue; }
    const W1 = o.type === 'building' ? o.w : o.type === 'spring' ? 2 : 1, H1 = o.type === 'building' ? o.h : o.type === 'spring' ? 2 : 1;
    if (inCore(o.x, o.y) && inCore(o.x + W1 - 1, o.y + H1 - 1)) { moveRigid(o); keepObj.push(o); continue; }
    if (o.type === 'prop' && DECOR.test(o.id) && !o.cond) { dropped.push(o.id); continue; }
    keepObj.push(o); loose.push({ o, x: o.x, y: o.y });
  }
  function moveRigid(o) {
    const [x, y] = cellW(o.x, o.y), dx = x - o.x, dy = y - o.y;
    o.x = x; o.y = y;
    if (o.door) { o.door.x += dx; o.door.y += dy; }
    if (o.path) o.path = o.path.map(([a, b]) => cellW(a, b));
  }
  for (const n of npcs) {
    if (inCore(n.x, n.y)) { const [x, y] = cellW(n.x, n.y); n.x = x; n.y = y; }
    else loose.push({ o: n, x: n.x, y: n.y });
  }
  objects.length = 0; objects.push(...keepObj);
  // 小さな組（2 マス以内でつながる）: 組の真ん中を道に沿わせる（5 マス以内に道があれば）か、W に写す。組の中の並びはそのまま
  const groups = [];
  for (const it of loose) {
    let gp = groups.find((q) => q.items.some((j) => Math.max(Math.abs(j.x - it.x), Math.abs(j.y - it.y)) <= 2));
    if (!gp) groups.push((gp = { items: [] }));
    gp.items.push(it);
  }
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    if (groups[i].items.some((a) => groups[j].items.some((b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 2))) { groups[i].items.push(...groups[j].items); groups.splice(j, 1); j = i; }
  }
  let attached = 0;
  for (const gp of groups) {
    const cx = gp.items.reduce((s, q) => s + q.x, 0) / gp.items.length, cy = gp.items.reduce((s, q) => s + q.y, 0) / gp.items.length;
    const q = nearestRoad(cx + 0.5, cy + 0.5, 5);
    let ax, ay;
    if (q) { ax = q.x + (cx + 0.5 - q.lx); ay = q.y + (cy + 0.5 - q.ly); attached++; }
    else [ax, ay] = toW(cx + 0.5, cy + 0.5);
    for (const it of gp.items) {
      const x = Math.floor(ax + (it.x - cx)), y = Math.floor(ay + (it.y - cy));
      it.o.x = x; it.o.y = y;
      if (it.o.path) it.o.path = it.o.path.map(([a, b]) => [a - it.x + x, b - it.y + y]);
    }
  }
  info.groups = groups.length; info.attached = attached; info.droppedDecor = dropped.length;
  // 引き金: 道の引き金は道の上へ（向きは道で変わるので四角に広げる）、ほかは枠を写す
  for (const t of triggers) {
    if (isRoadTrigger(t)) {
      const q = nearestRoad(t.x + (t.w || 1) / 2, t.y + (t.h || 1) / 2, 6);
      const s = Math.max(t.w || 1, t.h || 1) + 2, [cx, cy] = q ? [q.x, q.y] : toW(t.x + (t.w || 1) / 2, t.y + (t.h || 1) / 2);
      t.x = Math.round(cx - s / 2); t.y = Math.round(cy - s / 2); t.w = s; t.h = s;
    } else { const R2 = rectW(t.x, t.y, t.w || 1, t.h || 1); t.x = R2[0]; t.y = R2[1]; t.w = R2[2]; t.h = R2[3]; }
  }
  // 出現表・地名: 枠を写す。細い枠（道の出現表）は蛇行の分だけ広げる
  for (const z of zones) { const [x, y, w, h] = z.rect; z.rect = rectW(x, y, w, h, Math.min(w, h) <= 3 ? Math.ceil(MEANDER) + 1 : 0); }
  for (const a of areas) { const [x, y, w, h] = a.rect; a.rect = rectW(x, y, w, h); }

  return { g, W, H, xform: xform2, roadsW, tcore, kind, base, info, toW, toL, cellW };
};
