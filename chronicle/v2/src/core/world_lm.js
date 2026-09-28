// CORE: ワールドの大きな景色の置き方（WORLD v3、2026-09-28）。マスの木・森・岩・葦・砂岩の塊を、描いた大きな絵（lm_*）で覆う置き方を決める。
// 生成器（tools/gen_world.js）が一度決めて map.lm に書く（ゲームの中で毎回計算しない。重い: ワールドで 0.5〜1 秒）。
// 絵が無い・map.lm が無いときは src/art/terrain/landmarks.js が同じ関数で計算する（控え）。node からは require でも使える。
//
//   R.WorldLm.plan(rows, legend, W, H, catalog) → [[id, x0, y0, w, h]…]   rows = 文字列か配列の行、catalog = [{id, fam, fp:[w,h]}]
//   R.WorldLm.pack(items) / unpack(lm) → map.lm {ids:[…], a:[i, x0, y0, w, h, …]}
(function (root) {
  'use strict';
  // 種類 → 使う絵の fam（先頭ほど優先。数 = その塊の大きさの下限: 山は大きな塊にだけ）と、使ってよい絵の id
  const FAMS = {
    tree: [['broad', 0], ['conifer', 0]], forest: [['broad', 0], ['conifer', 0]], snowtree: [['snowfir', 0]], marshtree: [['marsh', 0]],
    ashtree: [['ash', 0]], reeds: [['marsh', 0]], snowrock: [['snowmount', 60], ['snowfir', 0]], sandrock: [['desert', 0]],
    rock: [['mount', 60], ['rock', 0]], ashrock: [['ash', 0]],
  };
  const OK = {
    marshtree: /^lm_marsh_(dead3|swamptree)$/, reeds: /^lm_marsh_reeds/, ashtree: /^lm_ash_charred/, snowtree: /^lm_snowfir_(s1|m1|l1|xl)$/,
    snowrock: /^lm_(snowmount_|snowfir_(rock1|crag1))/, sandrock: /^lm_desert_(mesa1|hoodoo|boulders)$/, rock: /^lm_(mount_|rock_)/, ashrock: /^lm_ash_(lavarock|crag|spire)$/,
  };
  function classOf(e) {
    if (!e) return null;
    const mat = e.mat || '';
    if (e.tree) { const t = e.tree[0] || ''; return /snow/.test(t) ? 'snowtree' : /swamp/.test(t) ? 'marshtree' : /charred/.test(t) ? 'ashtree' : 'tree'; }
    if (mat === 'tree') return 'tree';
    if (mat === 'forest_dark') return 'forest';
    if (e.solid && /tall_grass|reeds/.test(mat)) return 'reeds';
    if (e.solid && /wall_snow/.test(mat)) return 'snowrock';
    if (e.solid && /sandstone/.test(mat)) return 'sandrock';
    if (e.solid && /^(rock|wm_rock|cliff)$/.test(mat)) return 'rock';
    return null;
  }
  // 決まった乱数（materials.js の h3・vn と同じ式）
  function h3(i, j, k) { let h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 1274126177); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  const sm = (t) => t * t * (3 - 2 * t);
  function vn(x, y, L, s) { x /= L; y /= L; const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j); const a = h3(i, j, s), b = h3(i + 1, j, s), c = h3(i, j + 1, s), d = h3(i + 1, j + 1, s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }

  function plan(rows, legend, W, H, C) {
    const CN = Object.keys(FAMS), ci = new Uint8Array(W * H), cov = new Uint8Array(W * H), cr = new Uint8Array(W * H);
    const byCh = {}, regCh = {};
    const regionOf = (mat) => (/snow|ice/.test(mat) ? 'snowrock' : /ash|obsidian|lava/.test(mat) ? 'ashrock' : null);
    for (const ch of Object.keys(legend)) {
      const c = classOf(legend[ch]);
      byCh[ch] = c ? CN.indexOf(c) + 1 : 0;
      const r = regionOf(legend[ch].mat || ''); if (r) regCh[ch] = CN.indexOf(r) + 1;
    }
    for (let y = 0; y < H; y++) { const row = rows[y], o = y * W; for (let x = 0; x < W; x++) { const ch = row[x]; ci[o + x] = byCh[ch] || 0; cr[o + x] = regCh[ch] || 0; } }
    // 岩の地方: まわりの地面が雪・灰なら、その地方の岩（岩の凡例は地方で共通）
    const iRock = CN.indexOf('rock') + 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ci[i] !== iRock) continue;
      let a = 0, b = 0, v = 0;
      for (let j = -4; j <= 4; j += 2) { const Y = y + j; if (Y < 0 || Y >= H) continue; for (let k = -4; k <= 4; k += 2) { const X = x + k; if (X < 0 || X >= W) continue; const r = cr[Y * W + X]; if (r) { if (!v || r === v) { a++; v = r; } else b++; } } }
      if (v && a >= 3 && a >= b) ci[i] = v;
    }
    // 塊の大きさ（4 方向でつながる同じ種類のマスの数）
    const comp = new Int32Array(W * H).fill(-1), compN = [], q = new Int32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!ci[i] || comp[i] >= 0) continue;
      const k = compN.length; let qh = 0, qt = 0; q[qt++] = i; comp[i] = k;
      while (qh < qt) {
        const j = q[qh++], x = j % W, c = ci[j];
        if (x > 0 && comp[j - 1] < 0 && ci[j - 1] === c) { comp[j - 1] = k; q[qt++] = j - 1; }
        if (x < W - 1 && comp[j + 1] < 0 && ci[j + 1] === c) { comp[j + 1] = k; q[qt++] = j + 1; }
        if (j >= W && comp[j - W] < 0 && ci[j - W] === c) { comp[j - W] = k; q[qt++] = j - W; }
        if (j + W < W * H && comp[j + W] < 0 && ci[j + W] === c) { comp[j + W] = k; q[qt++] = j + W; }
      }
      compN.push(qt);
    }
    const fits = (x0, y0, w, h, c) => {
      if (x0 < 0 || y0 < 0 || x0 + w > W || y0 + h > H) return false;
      for (let y = y0; y < y0 + h; y++) { const r = y * W; for (let x = x0; x < x0 + w; x++) { const i = r + x; if (cov[i] || ci[i] !== c) return false; } }
      return true;
    };
    // 置く順: マスをハッシュの順に（鍵と番号を 1 つの数にまとめて型付き配列のまま並べる）
    let n = 0;
    for (let i = 0; i < W * H; i++) if (ci[i]) n++;
    const packed = new Float64Array(n);
    n = 0;
    for (let i = 0; i < W * H; i++) if (ci[i]) { packed[n] = Math.floor(h3(i % W, (i / W) | 0, 911) * 1048576) * 1048576 + i; n++; }
    packed.sort();
    const pools = {};
    for (const c of CN) {
      const list = [];
      for (const [fam, minArea] of FAMS[c]) for (const sp of C) if (sp.fam === fam && (!OK[c] || OK[c].test(sp.id))) list.push(Object.assign({ minArea }, sp));
      list.sort((a, b) => b.fp[0] * b.fp[1] - a.fp[0] * a.fp[1] || (a.id < b.id ? -1 : 1));
      for (const sp of list) sp.alt = list.filter((o) => o.fp[0] === sp.fp[0] && o.fp[1] === sp.fp[1] && o.fam === sp.fam);
      pools[c] = { list, mixed: list.some((o) => o.fam !== (list[0] && list[0].fam)) };
    }
    const items = [];
    for (let k = 0; k < n; k++) {
      const i = packed[k] % 1048576;
      if (cov[i]) continue;
      const c = CN[ci[i] - 1], P = pools[c];
      if (!P || !P.list.length) continue;
      const x = i % W, y = (i / W) | 0, area = compN[comp[i]], cc = ci[i];
      const rr = h3(x, y, 917);
      const fam0 = (c === 'tree' || c === 'forest') && P.mixed ? (vn(x, y, 40, 919) > 0.5 ? 'broad' : 'conifer') : null;
      for (const sp of P.list) {
        if (area < sp.minArea || (fam0 && sp.fam !== fam0)) continue;
        const pick = sp.alt[Math.floor(rr * sp.alt.length)] || sp;
        const fw = pick.fp[0], fh = pick.fp[1];
        let placed = false;
        for (const [ox, oy] of [[0, fh - 1], [fw >> 1, fh - 1], [0, 0]]) {
          const x0 = x - ox, y0 = y - oy;
          if (!fits(x0, y0, fw, fh, cc)) continue;
          for (let yy = y0; yy < y0 + fh; yy++) for (let xx = x0; xx < x0 + fw; xx++) cov[yy * W + xx] = 1;
          items.push([pick.id, x0, y0, fw, fh]);
          placed = true; break;
        }
        if (placed) break;
      }
    }
    return items;
  }
  function pack(items) {
    const ids = [], at = {}, a = [];
    for (const [id, x, y, w, h] of items) { if (!(id in at)) { at[id] = ids.length; ids.push(id); } a.push(at[id], x, y, w, h); }
    return { ids, a };
  }
  function unpack(lm) {
    const out = [];
    if (!lm || !lm.a) return out;
    for (let i = 0; i + 4 < lm.a.length; i += 5) out.push([lm.ids[lm.a[i]], lm.a[i + 1], lm.a[i + 2], lm.a[i + 3], lm.a[i + 4]]);
    return out;
  }
  const api = { plan, pack, unpack, classOf, FAMS };
  if (root && root.RPG) root.RPG.WorldLm = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
