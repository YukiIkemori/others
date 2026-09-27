#!/usr/bin/env node
// QA: 隠し通路の検査（V2_PLAN §3.16 の 3「check_secrets」、A15・A27、§3.2 のダンジョンの規則、オーナーの「見つけるまで先を見せない」）。
//
//   node v2/tools/qa/check_secrets.js [--no-build]
//
// node:
//   - 置き場所: 隠し通路（legend の secret）はダンジョンだけ（ワールド・町・屋内に 0）、床の素材（floor）を持つ、§3.2 の置き場所
//     （灯台 2 階・迷いの森 1・2 階・千年樹 1 階・古井戸）、入った瞬間に見つかる（FIELD の当たりで歩ける）。
//   - 先の部屋（R.MapUtil.secretAreas）: どの通路の先にも閉じた部屋・くぼみがある（空でない・外や虚空に開いていない＝マップの端に触れない・
//     48 マス以下・宝箱か奥の通路がある）。通路は 1〜3 マスの薄い壁で、手前（main か親の部屋）と先の部屋の両方に面する。
//     建物（石・れんが・木・砂岩の壁）の中の隠し部屋は、建物の床の広がり（main の外枠）の中にある（外壁の中に部屋を作らない）。
//   - 見つける前は隠れている: 先のマスは secretHidden（壁）、小地図の reveal で歩いた所に数えない。見つけた後は出る・歩いて宝箱に届く。
//   - 入れ子（仕組みだけ。体験版には 0）: 親の部屋の中から入る奥の通路は、親を見つけても奥を見つけるまで隠れ、両方で出る。奥の箱はレア以上。
// ブラウザ（dist/index.html）: 通路と先の部屋のあるチャンクを「見つける前」の形で焼き、通路と先の部屋をただの壁に替えたマップと
//   画素が 1 つも違わない（宝箱の絵・灯りも無い）。見つけた後はそのマスが床の絵に変わり、先の宝箱が出る。
'use strict';
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const BUILT = /^wall_(stone|brick|wood|sandstone)/;
const MAX_AREA = 48;

(async () => {
  const R = require('../lib/load')({ quiet: true });
  const M = require('../lib/maps').create(R);
  const MU = R.MapUtil;
  const maps = M.sliceMaps();
  R.State.newGame({ seed: 5 });
  section('データ');
  const found = {};
  for (const id of maps) {
    const m = R.DB.maps[id];
    const cells = [];
    MU.grid(m).forEach((row, y) => [...row].forEach((ch, x) => { const l = m.legend[ch]; if (l && l.secret) cells.push({ x, y, ch }); }));
    if (!cells.length) continue;
    found[id] = cells;
    ok(`${id}: 隠し通路はダンジョンだけ（${m.kind}）`, m.kind === 'dungeon');
    for (const ch of new Set(cells.map((c) => c.ch))) ok(`${id}: '${ch}' は床の素材を持つ（${m.legend[ch].floor}）`, !!m.legend[ch].floor && !!(R.DB.materials || {})[m.legend[ch].floor]);
    const walk = cells.filter((c) => [[1, 0, 'w'], [-1, 0, 'e'], [0, 1, 'n'], [0, -1, 's']].some(([dx, dy, d]) => R.Field._walkable(m, c.x + dx, c.y + dy, null, 0) && R.Field._canEnter(m, c.x + dx, c.y + dy, c.x, c.y, 0, d)));
    ok(`${id}: 隠し通路 ${cells.length} マスに FIELD の当たりで入れる`, walk.length > 0, cells.slice(0, 4));
  }
  for (const id of ['world', 'roa', 'pharos', 'fern', 'yura']) ok(`${id}: 隠し通路 0`, !found[id]);
  const want = ['lighthouse_2', 'verda_1', 'verda_2', 'elder_1', 'well'];
  ok('§3.2 の置き場所（灯台 2 階・迷いの森 1・2 階・千年樹 1 階・古井戸）に隠し通路', want.every((id) => found[id]), want.filter((id) => !found[id]));

  section('先の部屋の形（外や虚空に開かない・閉じた部屋かくぼみ）');
  const xy = (k) => k.split(',').map(Number);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let nestedMaps = 0;
  for (const id of Object.keys(found)) {
    const m = R.DB.maps[id], A = MU.secretAreas(m);
    const gateCells = new Set(found[id].map((c) => c.x + ',' + c.y));
    const covered = new Set(A.flatMap((a) => a.gate));
    ok(`${id}: どの隠し通路のマスも、手前から入る通路（gate）になっている`, [...gateCells].every((k) => covered.has(k)), [...gateCells].filter((k) => !covered.has(k)));
    // main の外枠（建物の床の広がり）
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    const rows = MU.grid(m);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const l = m.legend[[...rows[y]][x]];
      if (!l || l.secret || l.solid || l.walk === false) continue;
      if (A.some((a) => a.cells.includes(x + ',' + y))) continue;
      bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
    }
    const chests = (m.objects || []).filter((o) => o.type === 'chest');
    for (const a of A) {
      const tag = `${id} 通路 ${a.gate.join(' ')}`;
      const cellSet = new Set(a.cells);
      ok(`${tag}: 先に部屋がある（${a.cells.length} マス、1〜${MAX_AREA}）`, a.cells.length > 0 && a.cells.length <= MAX_AREA, a.cells.length);
      ok(`${tag}: 通路は 1〜3 マスの薄い壁`, a.gate.length >= 1 && a.gate.length <= 3, a.gate);
      const edge = a.cells.filter((k) => { const [x, y] = xy(k); return x <= 0 || y <= 0 || x >= m.w - 1 || y >= m.h - 1; });
      ok(`${tag}: 先の部屋はマップの端（外・虚空）に触れない`, edge.length === 0, edge);
      const outside = a.cells.filter((k) => { const [x, y] = xy(k); return N4.some(([dx, dy]) => { const l = MU.cell(m, x + dx, y + dy); return !l; }); });
      ok(`${tag}: 先の部屋は閉じている（まわりはマップの中の壁か床）`, outside.length === 0, outside);
      const own = chests.filter((o) => cellSet.has(o.x + ',' + o.y));
      ok(`${tag}: 先に宝箱か奥の通路がある（宝箱 ${own.length}・奥 ${a.children.length}）`, own.length > 0 || a.children.length > 0);
      // 通路のマスは手前（main か親の部屋か同じ通路）と先の部屋に面する
      const parentSet = a.parent == null ? null : new Set(A[a.parent].cells);
      const faceNear = a.gate.some((k) => { const [x, y] = xy(k); return N4.some(([dx, dy]) => { const q = (x + dx) + ',' + (y + dy); if (parentSet) return parentSet.has(q); const l = MU.cell(m, x + dx, y + dy); return !!l && !l.solid && l.walk !== false && !cellSet.has(q) && !A.some((b) => b.cells.includes(q)); }); });
      const faceFar = a.gate.some((k) => { const [x, y] = xy(k); return N4.some(([dx, dy]) => cellSet.has((x + dx) + ',' + (y + dy))); });
      ok(`${tag}: 通路は手前${a.parent == null ? '' : '（親の部屋）'}と先の部屋の両方に面する`, faceNear && faceFar);
      // 建物の中: 床の広がりの外（外壁の中）に部屋を作らない
      const gl = MU.cell(m, ...xy(a.gate[0]));
      if (gl && BUILT.test(gl.mat)) {
        const out = a.cells.filter((k) => { const [x, y] = xy(k); return x < bx0 || y < by0 || x > bx1 || y > by1; });
        ok(`${tag}: 建物の中の隠し部屋は床の広がりの中（外壁の中に部屋を作らない。外枠 ${bx0},${by0}〜${bx1},${by1}）`, out.length === 0, out.slice(0, 6));
      }
      if (a.parent != null) {
        nestedMaps++;
        const best = own.filter((o) => o.pool === 'p_super' || o.pool === 'p_rare' || o.rare);
        ok(`${tag}: 入れ子の奥にはレア以上の宝箱（${own.map((o) => o.pool || o.item).join(',')}）`, best.length > 0);
        const hint = (m.objects || []).filter((o) => o.type === 'examine' && A[a.parent].cells.includes(o.x + ',' + o.y));
        ok(`${tag}: 入れ子の通路のそばに、さりげないほのめかし（調べる物）`, hint.length > 0);
      }
    }
  }
  ok(`入れ子（二重）の隠し通路は体験版に置かない（${nestedMaps}）`, nestedMaps === 0, nestedMaps);   // オーナー「二重の隠し通路は体験版にはいらない」。上の入れ子の検査は仕組みとして残す

  section('見つける前は隠れ、見つけた後は出て届く');
  const F = R.Field, S = F._s;
  for (const id of Object.keys(found)) {
    const m = R.DB.maps[id], A = MU.secretAreas(m);
    const G = R.Game;
    G.secrets = {};
    for (const a of A) {
      const tag = `${id} 通路 ${a.gate.join(' ')}`;
      const hid0 = a.cells.filter((k) => !MU.secretHidden(m, ...xy(k)));
      ok(`${tag}: 見つける前は先の ${a.cells.length} マスが全部隠れている（壁で描く）`, hid0.length === 0, hid0);
      // 小地図: 通路の手前と先の部屋の中の近くに立っても、隠れたマスは歩いた所にならない
      if (F.minimap && F.minimap.reveal) {
        S.map = m; S.seen = {};
        const stand = [];
        for (const k of a.gate) { const [x, y] = xy(k); for (const [dx, dy] of N4) { const l = MU.cell(m, x + dx, y + dy); if (l && !l.solid && l.walk !== false && !MU.secretHidden(m, x + dx, y + dy)) stand.push([x + dx, y + dy]); } }
        for (const [x, y] of stand) { S.x = x; S.y = y; F.minimap.reveal(); }
        const leak = a.cells.filter((k) => { const [x, y] = xy(k); return F.minimap.seen(x, y); });
        ok(`${tag}: 見つける前は小地図・大きな地図に載らない（手前の ${stand.length} マスに立っても）`, leak.length === 0, leak.slice(0, 6));
      }
    }
    // 見つけた後（親から順に）
    for (const a of A) {
      const tag = `${id} 通路 ${a.gate.join(' ')}`;
      const before = (G.secrets[m.id] || []).slice();
      if (a.parent != null) {
        G.secrets[m.id] = A[a.parent].gate.slice().concat(before.filter((k) => !a.gate.includes(k)));
        const still = a.cells.filter((k) => !MU.secretHidden(m, ...xy(k)));
        ok(`${tag}: 入れ子: 手前の通路だけ見つけても、奥の部屋は隠れたまま`, still.length === 0, still);
      }
      G.secrets[m.id] = [...new Set((G.secrets[m.id] || []).concat(a.gate, a.parent != null ? A[a.parent].gate : []))];
      ok(`${tag}: 見つけた後（通路の 1 マス）は先の部屋が出る`, a.cells.every((k) => !MU.secretHidden(m, ...xy(k))));
      // 前のセーブ: 通路の 1 マスだけ書いてあっても、ひと続きの通路が全部開く
      ok(`${tag}: 通路のひと続きは 1 マスで全部開く`, a.gate.every((k) => MU.secretOpen(m, ...xy(k), [a.gate[0]])));
      if (F.minimap && F.minimap.reveal) {
        S.map = m; S.seen = {};
        const [cx, cy] = xy(a.cells[0]); S.x = cx; S.y = cy; F.minimap.reveal();
        ok(`${tag}: 見つけた後は先の部屋が小地図に載る`, F.minimap.seen(cx, cy));
      }
    }
    // 届く（全部の通路を見つけた後、spawn から FIELD の歩き方で宝箱の隣へ）
    const sp = MU.spawn(m, Object.keys(m.spawns || {})[0]);
    const res = M.bfs(m, [{ x: sp.x, y: sp.y, lv: 0 }], { npcs: false });
    const at = (x, y) => res.dist.has(x + ',' + y + ',0');
    for (const a of A) {
      const tag = `${id} 通路 ${a.gate.join(' ')}`;
      const cs = new Set(a.cells);
      const own = (m.objects || []).filter((o) => o.type === 'chest' && cs.has(o.x + ',' + o.y));
      ok(`${tag}: 見つけた後は通路に歩いて入れる`, a.gate.some((k) => at(...xy(k))));
      const miss = own.filter((o) => !N4.some(([dx, dy]) => at(o.x + dx, o.y + dy)));
      ok(`${tag}: 見つけた後は先の宝箱 ${own.length} 個の隣に歩いて届く`, miss.length === 0, miss.map((o) => o.id));
    }
    G.secrets = {};
  }
  S.map = null;

  section('見つける前は周りの壁と同じ画素（ブラウザ）');
  const B = require('../lib/browser');
  if (!require('fs').existsSync(path.join(B.V2, 'dist', 'index.html'))) require('child_process').execSync('node ' + path.join(B.V2, 'tools', 'build.js'), { stdio: 'ignore' });
  const S2 = await B.start();
  const P = await B.open(S2, 'index.html');
  try {
    const res = await P.page.evaluate((ids) => {
      const R = window.RPG, T = R.Terrain, MU = R.MapUtil, out = [];
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
      const xy = (k) => k.split(',').map(Number);
      for (const id of ids) {
        const map = R.DB.maps[id], A = MU.secretAreas(map);
        // ただの壁のマップ: 通路は同じ素材の solid、先の部屋は隠す間の壁の字（物も部屋の中の物は無し）
        const plain = Object.assign({}, map, { id: id + '__plain', legend: {}, tilePatches: [] });
        for (const [ch, l] of Object.entries(map.legend)) plain.legend[ch] = l.secret ? { mat: l.mat, solid: true, rise: l.rise } : l;
        const rows = MU.grid(map).map((r) => [...r]);
        const hid = new Set();
        A.forEach((a, i) => { const ch = String.fromCharCode(0x3040 + i); plain.legend[ch] = Object.assign({}, a.wall); delete plain.legend[ch]._hidden; for (const k of a.cells) { const [x, y] = xy(k); rows[y][x] = ch; hid.add(k); } });
        plain.rows = rows.map((r) => r.join(''));
        plain.objects = (map.objects || []).filter((o) => o.x == null || !hid.has(o.x + ',' + o.y));
        const allGate = A.flatMap((a) => a.gate);
        const chunks = new Set();
        for (const k of allGate.concat([...hid])) { const [x, y] = xy(k); chunks.add(Math.floor(x / 8) + ',' + Math.floor(y / 8)); }
        const hiddenChests = (map.objects || []).filter((o) => o.type === 'chest' && hid.has(o.x + ',' + o.y));
        for (const k of chunks) {
          const [cx, cy] = k.split(',').map(Number);
          const a = bake(map, cx, cy, { secrets: [] }), b = bake(plain, cx, cy, { secrets: [] });
          const base = cmp(a.base, b.base), over = cmp(a.over, b.over);
          const inChunk = (x, y) => Math.floor(x / 8) === cx && Math.floor(y / 8) === cy;
          const chestProps = (a.props || []).filter((p) => p.type === 'chest' && hiddenChests.some((o) => o.id === p.id)).length;
          const leakLights = (a.lights || []).filter((L) => hid.has(Math.floor(L.x / 32) + ',' + Math.floor(L.y / 32))).length;
          const f = bake(map, cx, cy, { secrets: allGate });
          const c0 = allGate.map(xy).find(([x, y]) => inChunk(x, y)) || [...hid].map(xy).find(([x, y]) => inChunk(x, y));
          const px = c0[0] * 32 - a.x, py = c0[1] * 32 - a.y;
          const changed = cellCmp(f.base, a.base, px, py);
          const shownChests = (f.props || []).filter((p) => p.type === 'chest' && hiddenChests.some((o) => o.id === p.id && inChunk(o.x, o.y))).length;
          const wantChests = hiddenChests.filter((o) => inChunk(o.x, o.y)).length;
          out.push({ map: id, chunk: k, base: base.max, over: over.max, changed: +changed.toFixed(2), chestProps, leakLights, shownChests, wantChests });
        }
      }
      return out;
    }, Object.keys(found));
    for (const r of res) {
      ok(`${r.map} チャンク ${r.chunk}: 見つける前は、通路も先の部屋もただの壁と同じ画素（base の差 ${r.base}・over の差 ${r.over}）`, r.base === 0 && r.over === 0, r);
      ok(`${r.map} チャンク ${r.chunk}: 見つける前は先の宝箱の絵も灯りも無い（宝箱 ${r.chestProps}・灯り ${r.leakLights}）`, r.chestProps === 0 && r.leakLights === 0, r);
      ok(`${r.map} チャンク ${r.chunk}: 見つけた後はそのマスが変わる（${Math.round(r.changed * 100)}% の画素）・先の宝箱が出る（${r.shownChests}/${r.wantChests}）`, r.changed > 0.3 && r.shownChests === r.wantChests, r);
    }
    ok('ページのエラー 0', P.errors.length === 0, P.errors.slice(0, 3));
  } finally { await P.close(); await B.stop(S2); }
  done('check_secrets');
})().catch((e) => { console.error(e); process.exit(2); });
