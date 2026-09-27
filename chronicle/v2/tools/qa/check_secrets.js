#!/usr/bin/env node
// QA: 隠し通路の検査（V2_PLAN §3.16 の 3「check_secrets」、A15・A27、§3.2 のダンジョンの規則）。
//
//   node v2/tools/qa/check_secrets.js [--no-build]
//
// node: 隠し通路（legend の secret）はダンジョンだけ（ワールド・町・屋内に 0）、床の素材（floor）を持つ、§3.2 の置き場所
//       （灯台 2 階・迷いの森 1・2 階・千年樹 1 階・古井戸）、入った瞬間に見つかる（FIELD の当たりで歩ける）、物語に必須の物の道ではない（progress）。
// ブラウザ（dist/index.html）: 縦切りの本物のマップで、隠し通路のあるチャンクを「見つける前」の形で焼き、同じマップの隠し通路を
//       ただの壁（同じ素材の solid）に替えたものと画素が 1 つも違わない。見つけた後はそのマスが床の絵に変わる。
'use strict';
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

(async () => {
  const R = require('../lib/load')({ quiet: true });
  const M = require('../lib/maps').create(R);
  const maps = M.sliceMaps();
  section('データ');
  const found = {};
  for (const id of maps) {
    const m = R.DB.maps[id];
    const cells = [];
    R.MapUtil.grid(m).forEach((row, y) => [...row].forEach((ch, x) => { const l = m.legend[ch]; if (l && l.secret) cells.push({ x, y, ch }); }));
    if (!cells.length) continue;
    found[id] = cells;
    ok(`${id}: 隠し通路はダンジョンだけ（${m.kind}）`, m.kind === 'dungeon');
    for (const ch of new Set(cells.map((c) => c.ch))) ok(`${id}: '${ch}' は床の素材を持つ（${m.legend[ch].floor}）`, !!m.legend[ch].floor && !!(R.DB.materials || {})[m.legend[ch].floor]);
    // 歩ける（入った瞬間に見つかる）: どこかの隣から入れる
    const walk = cells.filter((c) => [[1, 0, 'w'], [-1, 0, 'e'], [0, 1, 'n'], [0, -1, 's']].some(([dx, dy, d]) => R.Field._walkable(m, c.x + dx, c.y + dy, null, 0) && R.Field._canEnter(m, c.x + dx, c.y + dy, c.x, c.y, 0, d)));
    ok(`${id}: 隠し通路 ${cells.length} マスに FIELD の当たりで入れる`, walk.length > 0, cells.slice(0, 4));
  }
  for (const id of ['world', 'roa', 'pharos', 'fern', 'yura']) ok(`${id}: 隠し通路 0`, !found[id]);
  const want = ['lighthouse_2', 'verda_1', 'verda_2', 'elder_1', 'well'];
  ok('§3.2 の置き場所（灯台 2 階・迷いの森 1・2 階・千年樹 1 階・古井戸）に隠し通路', want.every((id) => found[id]), want.filter((id) => !found[id]));

  section('見つける前は周りの壁と同じ画素（ブラウザ）');
  const B = require('../lib/browser');
  if (!require('fs').existsSync(path.join(B.V2, 'dist', 'index.html'))) require('child_process').execSync('node ' + path.join(B.V2, 'tools', 'build.js'), { stdio: 'ignore' });
  const S = await B.start();
  const P = await B.open(S, 'index.html');
  try {
    const res = await P.page.evaluate((found) => {
      const R = window.RPG, T = R.Terrain, out = [];
      const bake = (map, cx, cy, st) => { const j = T.bakeChunk(map, cx, cy, { tile: 32, tier: 0, state: Object.assign({ chests: [], lit: [], lamps: {} }, st) }); let n = 0; while (!j.done && n++ < 200000) j.step(8); return j.result; };
      const cmp = (a, b) => {
        if (!a || !b) return { max: a === b ? 0 : 255, over: 1 };
        if (a.width !== b.width || a.height !== b.height) return { max: 255, over: 1 };
        const A = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, Bd = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
        let max = 0, over = 0;
        for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - Bd[i]), Math.abs(A[i + 1] - Bd[i + 1]), Math.abs(A[i + 2] - Bd[i + 2]), Math.abs(A[i + 3] - Bd[i + 3])); if (d > max) max = d; if (d > 8) over++; }
        return { max, over: over / (A.length / 4) };
      };
      const cellCmp = (a, b, x, y) => {
        const A = a.getContext('2d').getImageData(x, y, 32, 32).data, Bd = b.getContext('2d').getImageData(x, y, 32, 32).data;
        let over = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - Bd[i]) + Math.abs(A[i + 1] - Bd[i + 1]) + Math.abs(A[i + 2] - Bd[i + 2]) > 24) over++;
        return over / 1024;
      };
      for (const [id, cells] of Object.entries(found)) {
        const map = R.DB.maps[id];
        const plain = Object.assign({}, map, { id: id + '__plain', legend: {} });
        for (const [ch, l] of Object.entries(map.legend)) plain.legend[ch] = l.secret ? { mat: l.mat, solid: true, rise: l.rise } : l;
        const chunks = [...new Set(cells.map((c) => Math.floor(c.x / 8) + ',' + Math.floor(c.y / 8)))];
        for (const k of chunks) {
          const [cx, cy] = k.split(',').map(Number);
          const a = bake(map, cx, cy, { secrets: [] }), b = bake(plain, cx, cy, { secrets: [] });
          const base = cmp(a.base, b.base), over = cmp(a.over, b.over);
          const c0 = cells.find((c) => Math.floor(c.x / 8) === cx && Math.floor(c.y / 8) === cy);
          const f = bake(map, cx, cy, { secrets: cells.map((c) => c.x + ',' + c.y) });
          const px = c0.x * 32 - (a.x != null ? a.x : cx * 256), py = c0.y * 32 - (a.y != null ? a.y : cy * 256);
          const changed = cellCmp(f.base, a.base, px, py);
          out.push({ map: id, chunk: k, base: base.max, over: over.max, changed: +changed.toFixed(2) });
        }
      }
      return out;
    }, found);
    for (const r of res) {
      ok(`${r.map} チャンク ${r.chunk}: 見つける前は、ただの壁と同じ画素（base の差 ${r.base}・over の差 ${r.over}）`, r.base === 0 && r.over === 0, r);
      ok(`${r.map} チャンク ${r.chunk}: 見つけた後はそのマスが変わる（${Math.round(r.changed * 100)}% の画素）`, r.changed > 0.3, r);
    }
    ok('ページのエラー 0', P.errors.length === 0, P.errors.slice(0, 3));
  } finally { await P.close(); await B.stop(S); }
  done('check_secrets');
})().catch((e) => { console.error(e); process.exit(2); });
