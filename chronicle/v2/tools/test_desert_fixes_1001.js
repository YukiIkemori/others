#!/usr/bin/env node
// 持ち主の製品版の試遊（2026-10-01）の砂漠の報告で直した物の戻りの確かめ: node v2/tools/test_desert_fixes_1001.js
//   カシムの門の入口（ワープ）は描いた門の前（西 d_west x 55・東 d_east x 4）で、門の口の幅ぜんぶ。町から出て着く所は入口の外。
//   砂の王墓の入口の印が 2 つ出ていた（1 マスの階段を 2 つ並べていた）→ w 2 の階段 1 つ。同じ形（隣り合う同じ行き先の入口が 2 つ）が他に無いこと。
//   砂の王墓 1 階の封じの扉の脇の壁に印（switch の物）、入口の広間の壁に看板がめり込んでいた → 印は無し・看板は床へ。
//   本物の入力で門・王墓へ歩いて入るのは test_desert_fixes_1001_browser.js。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const V2 = path.resolve(__dirname, '..');
const GEN = path.resolve(V2, '..', 'design/art_ref/gen/env/_tools/under/field_desert');
const R = require('./lib/load')({ quiet: true });
R.DB.config.slice = false;   // 製品版の形
R.State.newGame({ seed: 1 });
const M = R.DB.maps;
const F = R.Field;
const pass = (m, x, y) => !!F._walkable(m, x, y, null, 0);
const inRect = (r, x, y) => x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1);

section('カシムの門の入口');
for (const g of [
  { map: 'd_west', gate: 'gate_w', x: 55, y: 19, h: 3, front: 54, dir: 'e', wallX: [55, 59] },
  { map: 'd_east', gate: 'gate_e', x: 4, y: 17, h: 2, front: 5, dir: 'w', wallX: [0, 4] },
]) {
  const m = M[g.map];
  const ex = (m.exits || []).filter((e) => e.to && e.to.map === 'kasim');
  ok(`${g.map}: カシムへの入口は 1 つ`, ex.length === 1, ex);
  const e = ex[0] || {};
  ok(`${g.map}: 入口は描いた門の前（x ${g.x}、y ${g.y}〜${g.y + g.h - 1}）`, e.x === g.x && e.y === g.y && (e.w || 1) === 1 && e.h === g.h && e.to.spawn === g.gate, e);
  // 門の列（壁の厚みの外の 1 列目）の歩けるマスはぜんぶ入口の中（脇から門の奥へすり抜けない）
  const leak = [];
  for (let y = 0; y < m.h; y++) if (pass(m, g.x, y) && !inRect(e, g.x, y)) leak.push(y);
  ok(`${g.map}: 門の列 x ${g.x} の歩けるマスはぜんぶ入口`, leak.length === 0, leak);
  // 道から入口へ歩いて行ける（入口の前の列が歩ける）
  const fr = [];
  for (let y = e.y; y < e.y + e.h; y++) if (pass(m, g.front, y)) fr.push(y);
  ok(`${g.map}: 入口の前 x ${g.front} から歩いて入れる`, fr.length >= 2, fr);
  // 町から出て着く所: 入口の外で、入口の隣（すぐには入り直さない・門の前に立つ）
  const link = ((M.kasim.exits || []).find((q) => q.to && q.to.map === g.map) || {}).to;   // カシムの「ワールドへ」の出口は R.FieldArea.LINKS で付け替え済み
  const sp = m.spawns.kasim;
  ok(`${g.map}: 町から出た所（spawn kasim）は入口の外の門の前`, !!sp && !inRect(e, sp.x, sp.y) && sp.x === g.front && sp.y >= e.y && sp.y < e.y + e.h && pass(m, sp.x, sp.y), sp);
  ok(`${g.map}: 着いた向きは門から離れる向き`, !!sp && sp.dir === (g.dir === 'e' ? 'w' : 'e'), sp);
  ok(`${g.map}: カシムの門を出ると spawn kasim に着く（links）`, !!link && link.map === g.map && link.spawn === 'kasim', link);
  ok(`${g.map}: どの出口も spawn kasim に重ならない`, (m.exits || []).every((q) => !inRect(q, sp.x, sp.y)));
  // 入口の印（wayfind）は入口の四角ぜんたいで、門の奥へ向く
  const info = F.wayfind.info(m).exits.filter((q) => q.to.map === 'kasim');
  ok(`${g.map}: 入口の印は 1 つで入口と同じ四角・向き ${g.dir}`, info.length === 1 && info[0].x === e.x && info[0].y === e.y && info[0].w === 1 && info[0].h === g.h && info[0].dir === g.dir, info);
  // 下絵の生成（areas_desert.py → layout.json）と同じ
  const lp = path.join(GEN, g.map, 'layout.json');
  if (fs.existsSync(lp)) {
    const L = JSON.parse(fs.readFileSync(lp, 'utf8'));
    const le = (L.exits || []).find((q) => q.to && q.to.map === 'kasim');
    ok(`${g.map}: 生成の layout.json の入口・spawn と同じ`, !!le && le.x === e.x && le.y === e.y && le.h === e.h && JSON.stringify(L.spawns.kasim) === JSON.stringify(sp), { le, sp: L.spawns.kasim });
    const fit = L.rows_fit || L.rows;
    ok(`${g.map}: 生成の当たり（rows_fit）がマップの rows と同じ`, JSON.stringify(fit) === JSON.stringify(m.rows));
  }
}

section('砂の王墓の入口');
{
  const m = M.desert_camp3;
  const st = (m.objects || []).filter((o) => (o.type === 'stairs' || o.type === 'door') && o.to && o.to.map === 'desert_tomb_1');
  ok('王墓へ入る階段は 1 つ', st.length === 1, st.map((o) => [o.x, o.y]));
  const s = st[0] || {};
  ok('階段は描いた戸口（x 21〜22・y 5）の 2 マス幅', s.x === 21 && s.y === 5 && s.w === 2 && (s.h || 1) === 1, s);
  const seal = (m.objects || []).filter((o) => o.type === 'examine' && o.event === 'desert_tomb_sealed');
  ok('閉じている間の「調べる」も 1 つで戸口の 2 マス', seal.length === 1 && seal[0].x === 21 && seal[0].y === 5 && seal[0].w === 2, seal);
  for (const x of [21, 22]) {
    const at = R.MapUtil.objectsAt(m, x, 5, 0).map((o) => o.type);
    ok(`戸口の (${x},5) で階段が働く`, at.includes('stairs') || !R.State.check('desert_camp3_done'), at);
  }
  const G = R.Game; const f0 = G.flags.desert_camp3_done;
  G.flags.desert_camp3_done = true; R.MapUtil.invalidate && R.MapUtil.invalidate();
  const mk = F.wayfind.info(m).exits.filter((q) => q.to.map === 'desert_tomb_1');
  ok('入口の印（wayfind）は 1 つで、戸口の 2 マスのまん中（x 22.0）', mk.length === 1 && mk[0].x + mk[0].w / 2 === 22 && mk[0].dir === 'n', mk);
  ok('2 マスとも階段が働く（解いた後）', [21, 22].every((x) => R.MapUtil.objectsAt(m, x, 5, 0).some((o) => o.type === 'stairs')));
  if (f0 === undefined) delete G.flags.desert_camp3_done; else G.flags.desert_camp3_done = f0;
  R.MapUtil.invalidate && R.MapUtil.invalidate();
}

section('同じ行き先の入口が隣り合って 2 つ（入口の印が 2 つ出る形）');
{
  // 町・ダンジョン・フィールドで、別のマップ（屋内でない）へ通じる出口・戸口・階段のうち、行き先のマップ・条件・階が同じで
  // すき間 1 マス以下の物の組。ダンジョンの階段どうし（印を出さない）は除く
  const bad = [];
  for (const m of Object.values(M)) {
    if (!['town', 'dungeon', 'field'].includes(m.kind)) continue;
    const ents = [];
    for (const e of m.exits || []) if (e.to) ents.push({ warp: false, x: e.x, y: e.y, w: e.w || 1, h: e.h || 1, to: e.to, cond: e.cond, lv: e.lv || 0 });
    for (const o of m.objects || []) if ((o.type === 'door' || o.type === 'stairs') && o.to) ents.push({ warp: true, x: o.x, y: o.y, w: o.w || 1, h: o.h || 1, to: o.to, cond: o.cond, lv: o.lv || 0 });
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
      const a = ents[i], b = ents[j];
      if (a.to.map !== b.to.map || a.to.map === m.id || a.lv !== b.lv || JSON.stringify(a.cond) !== JSON.stringify(b.cond)) continue;
      const d = M[a.to.map] || {};
      if (d.kind === 'interior' || (m.kind === 'dungeon' && d.kind === 'dungeon' && a.warp && b.warp)) continue;
      const gx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0), gy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
      if (Math.max(gx, gy) <= 1) bad.push(`${m.id}@${a.x},${a.y}+${b.x},${b.y}→${a.to.map}`);
    }
  }
  ok('隣り合う同じ行き先の入口の組が無い（幅のある入口は w・h の 1 つの物で）', bad.length === 0, bad);
  const gs = (M.ghost_ship_1.objects || []).filter((o) => o.type === 'door' && o.to && o.to.map === 'nerei');
  ok('幽霊船の渡り板（ネレイへ戻る）も 1 つの戸口で w 2', gs.length === 1 && gs[0].x === 28 && gs[0].w === 2, gs);
}

section('砂の王墓の壁にめり込んだ物（1〜3 階）');
{
  // 戸口・階段・出口（壁のマスに置く物）のほかは、床のマスに置く。流砂の「調べる」は流砂（shallow）の上で良い
  const bad = [];
  for (const id of ['desert_tomb_1', 'desert_tomb_2', 'desert_tomb_3']) {
    const m = M[id];
    for (const o of m.objects || []) {
      if (['door', 'stairs', 'exit'].includes(o.type) || o.x == null) continue;
      const c = R.MapUtil.cell(m, o.x, o.y) || {};
      if ((c.solid || c.walk === false) && !(o.type === 'examine' && c.mat === 'shallow')) bad.push(`${id} ${o.type}:${o.id || o.event || ''}@${o.x},${o.y}`);
    }
  }
  ok('王墓の物はどれも床の上（壁の中に印・看板が立たない）', bad.length === 0, bad);
  const m = M.desert_tomb_1;
  ok('1 階の封じの扉の脇の壁に印（switch の物）が無い', !(m.objects || []).some((o) => o.type === 'prop' && o.id === 'switch'));
  const sg = (m.objects || []).find((o) => o.type === 'sign');
  ok('1 階の看板は入口の広間の床（26,35）で、前の床から読める', !!sg && sg.x === 26 && sg.y === 35 && pass(m, 26, 36), sg);
}

section('王墓のオアシスの満ちた泉（cleared_r_desert の後の絵）');
{
  // 前は満ちた泉の絵（desert_camp3_closed）がマスの形の青い四角を並べた物で、描いた下絵の上に四角い水が貼りついて見えた
  //   → 下絵の泉の水の筆致から作った、丸い岸・やわらかい縁の絵。絵のある画素のマスは全部 live のマス（マスの端で絵が切れない）
  const zlib = require('zlib');
  function png(file) {   // 8 bit RGB / RGBA・インターレース無しの PNG を読む（このテストの絵だけ）
    const b = fs.readFileSync(file), chunks = [], idat = [];
    let i = 8, w = 0, h = 0, ct = 0;
    while (i < b.length) {
      const n = b.readUInt32BE(i), t = b.toString('latin1', i + 4, i + 8), d = b.subarray(i + 8, i + 8 + n);
      chunks.push(t);
      if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
      if (t === 'IDAT') idat.push(d);
      i += 12 + n;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, st = w * bpp, px = Buffer.alloc(w * h * bpp);
    for (let y = 0; y < h; y++) {
      const f = raw[y * (st + 1)], src = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
      for (let x = 0; x < st; x++) {
        const a = x >= bpp ? px[y * st + x - bpp] : 0, up = y ? px[(y - 1) * st + x] : 0, c = x >= bpp && y ? px[(y - 1) * st + x - bpp] : 0;
        const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
        const pr = f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : (pa <= pb && pa <= pc ? a : pb <= pc ? up : c);
        px[y * st + x] = (src[x] + pr) & 255;
      }
    }
    return { w, h, ct, px, chunks };
  }
  const m = M.desert_camp3, dir = path.join(V2, 'assets/env/desert/under');
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'desert_camp3.json'), 'utf8'));
  ok('desert_camp3 は満ちた泉の層（art.closed）を持つ', m.art && m.art.closed === 'desert/under/desert_camp3_closed', m.art);
  const L = (meta.live || [])[0] || {};
  ok('live は 1 つで、cleared_r_desert の後に出る（cond = not cleared_r_desert）', meta.live.length === 1 && JSON.stringify(L.cond) === JSON.stringify({ not: 'cleared_r_desert' }), L.cond);
  const cells = new Set((L.cells || []).map((c) => c.join(',')));
  for (const t of [24, 32, 40]) {
    const im = png(path.join(dir, `desert_camp3_closed@${t}.png`));
    ok(`@${t}: RGBA で、付きの chunk が無い`, im.ct === 6 && im.chunks.every((c) => ['IHDR', 'IDAT', 'IEND'].includes(c)), im.chunks);
    const out = new Set();
    let soft = 0, solid = 0;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
      const a = im.px[(y * im.w + x) * 4 + 3];
      if (!a) continue;
      if (a < 255) soft++; else solid++;
      const k = Math.floor(x / t) + ',' + Math.floor(y / t);
      if (!cells.has(k)) out.add(k);
    }
    ok(`@${t}: 絵のある画素のマスはどれも live のマス（マスの端で絵が切れない）`, out.size === 0, [...out].slice(0, 8));
    ok(`@${t}: 縁がやわらかい（半透明の画素がある）`, soft > solid * 0.01, { soft, solid });
    // 継ぎ目が見えない: 絵の外周の画素（隣が透明）では、下絵に重ねた色が下絵とほとんど同じ
    const base = png(path.join(dir, `desert_camp3@${t}.png`)), bc = base.ct === 6 ? 4 : 3;
    let seam = 0, n = 0;
    for (let y = 1; y < im.h - 1; y++) for (let x = 1; x < im.w - 1; x++) {
      const q = (y * im.w + x) * 4, a = im.px[q + 3];
      if (!a || [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => im.px[((y + dy) * im.w + x + dx) * 4 + 3] > 0)) continue;
      const bq = (y * im.w + x) * bc;
      for (let c = 0; c < 3; c++) seam += Math.abs(im.px[q + c] - base.px[bq + c]) * a / 255;
      n += 3;
    }
    ok(`@${t}: 絵の外周で下絵との差が小さい（平均 < 3）`, n > 0 && seam / n < 3, { mean: n && +(seam / n).toFixed(2), n });
    // マスの四角が見えない: live のマスの外周（隣が live でない辺）に不透明の画素が並ばない
    let edge = 0;
    for (const k of cells) {
      const [cx, cy] = k.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (cells.has((cx + dx) + ',' + (cy + dy))) continue;
        for (let s = 0; s < t; s++) {
          const x = dx > 0 ? cx * t + t - 1 : dx < 0 ? cx * t : cx * t + s, y = dy > 0 ? cy * t + t - 1 : dy < 0 ? cy * t : cy * t + s;
          if (im.px[(y * im.w + x) * 4 + 3] > 0) edge++;
        }
      }
    }
    ok(`@${t}: live の外周の辺に絵の画素が無い`, edge === 0, edge);
  }
  // 当たり: 泉の水のマスは解決の前も後も歩けない（tilePatches は描いた当たりと同じ水）
  const wcells = [];
  m.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'w') wcells.push([x, y]); }));
  const before = wcells.filter(([x, y]) => pass(m, x, y));
  R.Game.flags.cleared_r_desert = true; R.MapUtil.invalidate && R.MapUtil.invalidate(m);
  const after = wcells.filter(([x, y]) => pass(m, x, y));
  delete R.Game.flags.cleared_r_desert; R.MapUtil.invalidate && R.MapUtil.invalidate(m);
  ok(`泉の水のマス（${wcells.length}）は解決の前も後も歩けない`, wcells.length >= 20 && !before.length && !after.length, { before, after });
}

done('test_desert_fixes_1001');
