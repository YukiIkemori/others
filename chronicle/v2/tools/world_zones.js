// CONTENT-P: ワールドの出現表を地形に合わせる（tools/gen_world.js が K 倍の後に呼ぶ。qa/check_world_zones.js も同じ分け方で数える）
//
// 出現表（zones）は四角で、上から最初に合う物が効く。地方の生成器が大きな地方の箱を先頭に足す（zones.unshift）ので、
// 箱の角が隣の地方の地面にかかっていた（灯台の岬の緑の草地で灰の荒野の魔物・火山の背景が出た）。
//   1. 歩けるマスの地方を地面の素材で決める（草・森の床 → 緑、雪・氷 → 雪、灰・黒曜石 → 灰、泥炭・泥 → 湿原、砂丘・赤土 → 砂漠）。
//      砂浜・道・橋・浅瀬などどの地方にもある素材は、8 マス以内でいちばん近い地方の素材に合わせる（無ければ歩けるマスを伝って近い方）。
//   2. そのマスで最初に合う出現表の地方が違えば、正しい地方の条件の無い出現表で、そのマスを含む物（無ければいちばん近い物）に付け替える。
//      条件つきの表（隊商など）は、条件が付いた時と外れた時の両方で見る。
//   3. 付け替えるマスを四角にまとめて zones の先頭に置く（同じ入力なら同じ出力）。
'use strict';

const ORDER = ['green', 'snow', 'desert', 'marsh', 'ash'];
/** 出現表の id → 地方（緑 = 序章・半島・北の野・森） */
function zoneRegion(id) {
  if (/^zw_(prologue|peninsula|forest)/.test(id)) return 'green';
  if (/^(zw|z)_snow/.test(id)) return 'snow';
  if (/^zw_desert/.test(id)) return 'desert';
  if (/^zw_marsh/.test(id)) return 'marsh';
  if (/^zw_ash/.test(id)) return 'ash';
  return null;
}
const MAT_REGION = {
  wm_grass: 'green', wm_tall_grass: 'green', wm_flowers: 'green', wm_forest_floor: 'green', forest_dark: 'green', bush: 'green',
  wm_snow: 'snow', wm_ice: 'snow', wm_snow_path: 'snow', wall_snow: 'snow',
  wm_dune: 'desert', wm_clay: 'desert', wall_sandstone: 'desert', sandstone_floor: 'desert',
  wm_peat: 'marsh', wm_mud: 'marsh', wm_marsh_water: 'marsh', wm_reeds: 'marsh',
  wm_ash: 'ash', wm_obsidian: 'ash', lava: 'ash',
};
/** 素材の字 → 地方（木は下の地面で決める。無ければ null = どの地方にもある素材） */
function charRegion(LEGEND, ch) {
  const l = LEGEND[ch];
  if (!l) return null;
  if (l.mat === 'tree') return MAT_REGION[l.under] || null;
  return MAT_REGION[l.mat] || null;
}
const walkOf = (LEGEND, ch) => { const l = LEGEND[ch]; return !!l && !l.solid && l.walk !== false; };
const inRect = (x, y, r) => x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];

/**
 * 地面の地方（マスごと。歩けないマスと決まらないマスは -1）。rows は字の行（文字列か配列）
 * 近い素材の数え方: 1〜R マスの輪（チェビシェフ）を内から見て、最初に素材がある輪で数の多い地方（同じなら ORDER の順）
 */
function terrainRegions(rows, LEGEND, R = 8) {
  const H = rows.length, W = rows[0].length;
  const own = new Int8Array(W * H).fill(-1), out = new Int8Array(W * H).fill(-1);
  const idx = {}; ORDER.forEach((r, i) => { idx[r] = i; });
  const cr = {}, wk = {};
  for (const ch of Object.keys(LEGEND)) { const r = charRegion(LEGEND, ch); cr[ch] = r == null ? -1 : idx[r]; wk[ch] = walkOf(LEGEND, ch); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = cr[rows[y][x]]; own[y * W + x] = c == null ? -1 : c; }
  const cnt = new Int32Array(ORDER.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!wk[rows[y][x]]) continue;
    const o = own[y * W + x];
    if (o >= 0) { out[y * W + x] = o; continue; }
    for (let d = 1; d <= R; d++) {
      cnt.fill(0); let any = false;
      for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== d) continue;
        const X = x + i, Y = y + j;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const c = own[Y * W + X];
        if (c >= 0) { cnt[c]++; any = true; }
      }
      if (!any) continue;
      let b = 0; for (let k = 1; k < cnt.length; k++) if (cnt[k] > cnt[b]) b = k;
      out[y * W + x] = b; break;
    }
  }
  // 8 マス以内に素材が無いマス（山あいの土の道・砂漠の奥の砂）は、歩けるマスを伝って近い方に合わせる（道の途中で地方がまだらにならないように）
  let q = [];
  for (let k = 0; k < W * H; k++) if (out[k] >= 0 || own[k] >= 0) q.push(k);
  const walk = (k) => wk[rows[(k / W) | 0][k % W]];
  while (q.length) {
    const nq = [], got = new Map();
    for (const k of q) {
      const x = k % W, y = (k / W) | 0, r = out[k] >= 0 ? out[k] : own[k];
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const X = x + i, Y = y + j;
        if ((!i && !j) || X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const n = Y * W + X;
        if (out[n] >= 0 || own[n] >= 0 || !walk(n)) continue;
        if (!got.has(n)) { got.set(n, new Int32Array(ORDER.length)); nq.push(n); }
        got.get(n)[r]++;
      }
    }
    for (const n of nq) { const c = got.get(n); let b = 0; for (let k = 1; k < c.length; k++) if (c[k] > c[b]) b = k; out[n] = b; }
    q = nq;
  }
  return { W, H, reg: out, own };
}

/** そのマスで最初に合う出現表（cond は on = true なら「付いている」として見る） */
function firstZone(zones, x, y, on) {
  for (const z of zones) if (inRect(x, y, z.rect) && (z.cond == null || on)) return z;
  return null;
}

/** 地面の地方と出現表の地方の食い違い（「出現表の地方 over 地面の地方」ごとの数と、マスの一覧） */
function scan(rows, LEGEND, zones, T) {
  T = T || terrainRegions(rows, LEGEND);
  const { W, H, reg } = T;
  const pairs = {}, bad = [];
  let judged = 0, unknown = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!walkOf(LEGEND, rows[y][x])) continue;
    const t = reg[y * W + x];
    if (t < 0) { unknown++; continue; }
    judged++;
    for (const on of [false, true]) {
      const z = firstZone(zones, x, y, on);
      const zr = z && zoneRegion(z.zone);
      if (!zr || zr === ORDER[t]) continue;
      const k = zr + ' over ' + ORDER[t];
      pairs[k] = (pairs[k] || 0) + 1; bad.push([x, y, z.zone, ORDER[t]]);
      break;
    }
  }
  return { pairs, bad, judged, unknown, T };
}

/**
 * 出現表を地形に合わせる。zones をその場で直し（付け替えの四角を先頭に）、{ before, after, added } を返す
 * @param {{rows: (string|string[])[], LEGEND: object, zones: object[], tilePatches?: object[]}} A
 */
function fit(A) {
  const { rows, LEGEND, zones } = A;
  const T = terrainRegions(rows, LEGEND);
  const { W, H, reg } = T;
  const before = scan(rows, LEGEND, zones, T);
  // 条件の無い表（地方ごと、zones の順）
  const plain = zones.filter((z) => z.cond == null && zoneRegion(z.zone));
  const rectDist = (x, y, r) => { const dx = Math.max(r[0] - x, 0, x - (r[0] + r[2] - 1)), dy = Math.max(r[1] - y, 0, y - (r[1] + r[3] - 1)); return dx * dx + dy * dy; };
  function pick(x, y, region) {
    let best = null, bd = Infinity;
    for (const z of plain) {
      if (zoneRegion(z.zone) !== region) continue;
      const d = rectDist(x, y, z.rect);
      if (d < bd) { bd = d; best = z; if (!d) break; }
    }
    return best && best.zone;
  }
  // 付け替えるマス（行き先の表 → マスの集合）
  const want = new Map();
  for (const [x, y, , tr] of before.bad) {
    const zid = pick(x, y, tr);
    if (!zid) continue;
    if (!want.has(zid)) want.set(zid, new Set());
    want.get(zid).add(y * W + x);
  }
  // 条件で形の変わるマス（tilePatches）は歩けないとは見ない
  const patched = new Uint8Array(W * H);
  for (const p of A.tilePatches || []) { const [px, py, pw, ph] = p.rect; for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) if (px + i < W && py + j < H) patched[(py + j) * W + px + i] = 1; }
  const same = (x, y, zid) => { const a = firstZone(zones, x, y, false), b = firstZone(zones, x, y, true); return a && b && a.zone === zid && b.zone === zid; };
  const added = [];
  const zids = [...want.keys()].sort((a, b) => ORDER.indexOf(zoneRegion(a)) - ORDER.indexOf(zoneRegion(b)) || (a < b ? -1 : a > b ? 1 : 0));
  for (const zid of zids) {
    const S = want.get(zid), done = new Set();
    // 四角に入れてよいマス: 付け替えるマス・歩けないマス（条件で変わらない）・もうこの表のマス
    const okAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (S.has(y * W + x) || (!walkOf(LEGEND, rows[y][x]) && !patched[y * W + x]) || same(x, y, zid));
    const keys = [...S].sort((a, b) => a - b);
    for (const k of keys) {
      if (done.has(k)) continue;
      const x0 = k % W, y0 = (k / W) | 0;
      let x1 = x0; while (okAt(x1 + 1, y0)) x1++;
      let y1 = y0;
      for (;;) { let all = true; for (let x = x0; x <= x1; x++) if (!okAt(x, y1 + 1)) { all = false; break; } if (!all) break; y1++; }
      // 付け替えるマスの外枠まで縮める
      let bx0 = x1, bx1 = x0, by0 = y1, by1 = y0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (S.has(y * W + x)) { done.add(y * W + x); bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
      added.push({ rect: [bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1], zone: zid });
    }
  }
  zones.unshift(...added);
  const after = scan(rows, LEGEND, zones, T);
  return { before, after, added };
}

module.exports = { ORDER, zoneRegion, charRegion, terrainRegions, firstZone, scan, fit };
