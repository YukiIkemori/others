#!/usr/bin/env node
// QA: 宝箱の検査（V2_PLAN §3.16 の 3「check_chests」、WORLD_REDESIGN §6.3・E12、§2.6.1）。
//
//   node v2/tools/qa/check_chests.js [--no-build]
//
// node: ワールドに宝箱 0（A27）・宝箱は歩ける床の上・上に重なる物（overChars）の下に無い・id が重ならない・中身がある。
// ブラウザ（dist/index.html、R.Terrain.bakeChunk で本物のマップを焼く）: 縦切りの全部の宝箱について、閉じた箱の絵
// （hd:prop:chest の closed、レアの箱は rare_closed）の明るさと、その箱の周りの焼いた床の明るさの差が 0.08 以上（どの床の上でも見分けられる）。
'use strict';
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

(async () => {
  const R = require('../lib/load')({ quiet: true });
  const M = require('../lib/maps').create(R);
  const maps = M.sliceMaps();
  section('データ');
  const all = [];
  for (const id of maps) {
    const m = R.DB.maps[id];
    const chests = (m.objects || []).filter((o) => o.type === 'chest');
    if (m.kind === 'world') ok(`${id}: ワールドに宝箱 0（A27）`, chests.length === 0, chests.map((c) => c.id));
    const ids = new Set();
    for (const c of chests) {
      all.push({ map: id, id: c.id, x: c.x, y: c.y, lv: c.lv || 0, rare: c.pool === 'p_rare' || c.pool === 'p_super' });
      const cell = R.MapUtil.cell(m, c.x, c.y) || {};
      const floor = cell.walk !== false && !(cell.solid && !cell.secret) && ((c.lv || 0) === 0 || cell.deck);
      const over = (m.objects || []).filter((o) => o !== c && o.type === 'prop' && (R.DB.props[o.id] || {}).overChars && Math.abs(o.x - c.x) <= 1 && o.y >= c.y && o.y - c.y <= 1 && (o.lv || 0) === (c.lv || 0));
      if (!floor || over.length || ids.has(c.id) || !(c.item || c.pool || c.gold)) {
        ok(`${id}.${c.id}: 床の上・重なる物なし・id が一つ・中身あり`, false, { floor, over: over.map((o) => o.id), dup: ids.has(c.id) });
      }
      ids.add(c.id);
    }
  }
  ok(`縦切りの宝箱 ${all.length} 個: 床の上・重なる物の下でない・id が一つ・中身あり`, true);

  if (!process.argv.includes('--no-build') && !require('fs').existsSync(path.join(__dirname, '..', '..', 'dist', 'index.html'))) require('child_process').execSync('node ' + path.join(__dirname, '..', 'build.js'), { stdio: 'ignore' });
  section('焼いた床との明るさの差（ブラウザ）');
  const B = require('../lib/browser');
  const S = await B.start();
  const P = await B.open(S, 'index.html');
  try {
    const res = await P.page.evaluate((list) => {
      const R = window.RPG, T = R.Terrain;
      const stat = (c, x, y, w, h, alphaOnly) => {
        x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y)); w = Math.min(c.width - x, Math.round(w)); h = Math.min(c.height - y, Math.round(h));
        if (w <= 0 || h <= 0) return null;
        const d = c.getContext('2d').getImageData(x, y, w, h).data; let s = 0, r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { if (alphaOnly && d[i + 3] < 200) continue; s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        return n ? { l: s / n, r: r / n, g: g / n, b: b / n } : null;
      };
      const out = [];
      const cache = {};
      for (const c of list) {
        const map = R.DB.maps[c.map];
        const t = 32, cx = Math.floor(c.x / 8), cy = Math.floor(c.y / 8);
        const k = c.map + ':' + cx + ',' + cy;
        // 床は「この箱を開けた」形で焼く（閉じた箱の光だまりを床の明るさに入れない）
        const j = T.bakeChunk(map, cx, cy, { tile: t, tier: 0, state: { chests: [c.id], secrets: [], lit: [], lamps: {} } });
        let n = 0; while (!j.done && n++ < 200000) j.step(8);
        const r = j.result;
        void cache; void k;
        const amb = (T.ambient(map, 0) || {}).ambient;
        const sh = R.Hd.now('hd:prop:chest', { amb });
        if (!sh) { out.push({ c, err: 'no chest sprite' }); continue; }
        const pose = c.rare && sh.poses.rare_closed ? 'rare_closed' : 'closed';
        const fr = sh.frames[sh.poses[pose][0]];
        const cs = stat(fr.c, 0, 0, fr.c.width, fr.c.height, true);
        const px = c.x * t - (r.x != null ? r.x : cx * 8 * t), py = c.y * t - (r.y != null ? r.y : cy * 8 * t);
        const fs = stat(r.base, px, py, t, t);   // 箱の下の床（開けた形なので床だけ）
        if (!fs) { out.push({ c, err: 'no floor pixels' }); continue; }
        const dl = cs.l - fs.l, dc = Math.hypot(cs.r - fs.r, cs.g - fs.g, cs.b - fs.b) / 255;
        out.push({ map: c.map, id: c.id, pose, chest: +cs.l.toFixed(3), floor: +fs.l.toFixed(3), diff: +dl.toFixed(3), color: +dc.toFixed(3) });
      }
      return out;
    }, all);
    let worst = null;
    for (const q of res) {
      if (q.err) { ok(`${q.c.map}.${q.c.id}: ${q.err}`, false); continue; }
      if (!worst || q.diff < worst.diff) worst = q;
      if (!(Math.abs(q.diff) >= 0.08 || q.color >= 0.15)) ok(`${q.map}.${q.id}: 明るさの差 ${q.diff}（箱 ${q.chest}・床 ${q.floor}）・色の差 ${q.color}`, false, q);
    }
    const good = (q) => Math.abs(q.diff) >= 0.08 || q.color >= 0.15;
    ok(`${res.length} 個の宝箱すべてで 床との明るさの差 ≧ 0.08 か色の差 ≧ 0.15（明るさの差がいちばん小さい ${worst ? worst.map + '.' + worst.id + ' ' + worst.diff + '／色 ' + worst.color : '-'}）`, res.every(good));
    ok('ページのエラー 0', P.errors.length === 0, P.errors.slice(0, 3));
  } finally { await P.close(); await B.stop(S); }
  done('check_chests');
})().catch((e) => { console.error(e); process.exit(2); });
