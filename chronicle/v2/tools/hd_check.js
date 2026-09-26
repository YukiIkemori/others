#!/usr/bin/env node
// 絵の図書館の検査（RENDER、V2_PLAN §2.8・§4.4、ART_REWORK §7.5、STYLE_REFERENCE §9）。各図書館の担当が --area で使う。
//
//   node v2/tools/hd_check.js --area <cast|mons|boss|bbg|terrain|props|fx|all> [--only <部分文字列>] [--json <file>] [--strict]
//
// 調べること（キーごと、焼いた全コマ）:
//   shape    Sheet の形（K.sheet、戦闘背景は K.bbgSheet）
//   black    純粋な黒の画素 0（不透明で r = g = b = 0）
//   same     同じキーで同じ画素（forget して焼き直し、全コマの画素のハッシュが同じ）
//   colors   1 コマの色数（人: 戦闘 40〜80・フィールド 25〜55 = STYLE.colors。ほかは表示だけ）
//   sat      彩度 > 0.8 の画素の割合（強い彩度は小さな所だけ。15% まで。効果 fx は数えない）
//   outline  外周の画素のうち輝度 < 0.24 の割合（人・魔物・ボス 90% 以上、STYLE_REFERENCE §9）
//   facing   魔物・ボスは右向き（meta.facing が 'right'、または anchors.head の x が 0 以上）
//   size     魔物の高さの段（R.DB.monsters の size s/m/l → STYLE.size）、ボス 90〜120（論理 px）
// 失敗が 1 つでもあれば終了コード 1（--strict では「見るだけ」の項目も失敗に数える）。ビルドは先に。
'use strict';
const fs = require('fs');
const B = require('./lib/browser');
const { AREAS } = require('./hd_sheet');

function args(argv) {
  const o = { area: 'all', only: null, json: null, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--area') { o.area = v; i++; } else if (a === '--only') { o.only = v; i++; } else if (a === '--json') { o.json = v; i++; } else if (a === '--strict') o.strict = true;
  }
  return o;
}

// ページの中で: キーの一覧を調べる
function inspect(o) {
  const R = window.RPG, Hd = R.Hd, ST = Hd.STYLE;
  let keys = [];
  for (const p of o.prefixes) keys = keys.concat(Hd.keys(p));
  if (o.only) keys = keys.filter((k) => k.indexOf(o.only) >= 0);
  const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const hashFrames = (sh) => { let h = 2166136261; for (const f of sh.frames) { if (!f || !f.c) continue; const d = f.c.getContext('2d').getImageData(0, 0, f.c.width, f.c.height).data; for (let i = 0; i < d.length; i += 3) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } h ^= f.c.width * 31 + f.c.height; } return h; };
  const monSize = {};
  for (const m of Object.values(R.DB.monsters || {})) if (m && m.sprite) monSize[m.sprite] = m.size;
  const out = [];
  for (const key of keys) {
    const kind = Hd.kindOf(key), id = key.split(':').slice(2).join(':');
    const opts = key.startsWith('hd:bbg:') ? { w: 480, h: 270 } : undefined;
    const r = { key, kind, fail: [], warn: [], info: {} };
    let sh = null;
    try { sh = Hd.now(key, opts); } catch (e) { r.fail.push('bake threw: ' + e.message); }
    if (!sh) { if (!r.fail.length) r.fail.push('no sheet (factory returned null)'); out.push(r); continue; }
    const chk = R.Contract.check(key.startsWith('hd:bbg:') ? 'bbgSheet' : 'sheet', sh);
    if (!chk.ok) r.fail.push('shape: ' + chk.errors.slice(0, 3).join('; '));
    const frames = (sh.frames || []).filter((f) => f && f.c && f.c.width);
    if (!frames.length) { r.fail.push('no frames'); out.push(r); continue; }
    let black = 0, maxColors = 0, minColors = 1e9, satHi = 0, opaque = 0, edge = 0, edgeDark = 0, hMax = 0;
    for (const f of frames) {
      const w = f.c.width, h = f.c.height, d = f.c.getContext('2d').getImageData(0, 0, w, h).data;
      const cols = new Set();
      let y0 = 1e9, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const q = (y * w + x) * 4, a = d[q + 3];
        if (a < 128) continue;
        const R8 = d[q], G8 = d[q + 1], B8 = d[q + 2];
        opaque++;
        if (R8 === 0 && G8 === 0 && B8 === 0) black++;
        cols.add((R8 << 16) | (G8 << 8) | B8);
        const mx = Math.max(R8, G8, B8), mn = Math.min(R8, G8, B8);
        if (mx > 0 && (mx - mn) / mx > 0.8 && mx > 60) satHi++;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        const tr = (xx, yy) => xx < 0 || yy < 0 || xx >= w || yy >= h || d[(yy * w + xx) * 4 + 3] < 128;
        if (tr(x - 1, y) || tr(x + 1, y) || tr(x, y - 1) || tr(x, y + 1)) { edge++; if (lum(R8, G8, B8) < ST.outlineDark) edgeDark++; }
      }
      maxColors = Math.max(maxColors, cols.size); minColors = Math.min(minColors, cols.size);
      if (y1 >= y0) hMax = Math.max(hMax, y1 - y0 + 1);
    }
    r.info = { frames: frames.length, w: sh.w, h: sh.h, colors: [minColors, maxColors], sat: +(satHi / (opaque || 1)).toFixed(3), outline: +(edgeDark / (edge || 1)).toFixed(3), height: hMax };
    if (black) r.fail.push(`pure black pixels: ${black}`);
    // 同じキーで同じ画素
    const h1 = hashFrames(sh);
    Hd.forget(key);
    const sh2 = Hd.now(key, opts);
    if (!sh2 || hashFrames(sh2) !== h1) r.fail.push('same key → different pixels (seed the rng from the key)');
    // 色数（人だけ判定）
    const cb = kind === 'btl' ? ST.colors.btl : kind === 'field' ? ST.colors.field : null;
    if (cb && (maxColors > cb[1] || minColors < cb[0])) r.fail.push(`colors per frame ${minColors}..${maxColors} (want ${cb[0]}..${cb[1]})`);
    if (kind !== 'fx' && r.info.sat > 0.15) r.warn.push(`saturation > .8 on ${(r.info.sat * 100).toFixed(1)}% of pixels (small spots only)`);
    if (['btl', 'field', 'mon', 'boss'].includes(kind) && r.info.outline < 0.9) r.warn.push(`dark outline ${(r.info.outline * 100).toFixed(0)}% (want ≥ 90%)`);
    if (kind === 'mon' || kind === 'boss') {
      const m = (sh.meta || {}), head = sh.anchors && sh.anchors.head;
      const hx = head ? (Array.isArray(head) ? head[0] : head.x) : null;
      if (m.facing === 'left' || (m.facing == null && hx != null && hx < 0)) r.fail.push('faces left (monsters face right)');
      if (m.facing == null && hx == null) r.warn.push('no meta.facing / anchors.head to check facing');
      const lh = r.info.height;   // art px = 論理 px
      if (kind === 'boss' && (lh < ST.size.boss[0] || lh > ST.size.boss[1] * 1.3)) r.warn.push(`boss height ${lh} (want ${ST.size.boss[0]}..${ST.size.boss[1]})`);
      const sz = monSize[id];
      if (kind === 'mon' && sz && ST.size[sz]) { const b = ST.size[sz]; if (lh < b[0] * 0.9 || lh > b[1] * 1.1) r.warn.push(`size '${sz}' height ${lh} (want ${b[0]}..${b[1]})`); }
    }
    out.push(r);
  }
  return out;
}

async function run(o) {
  const prefixes = o.area === 'all' ? [].concat(...Object.values(AREAS)) : AREAS[o.area];
  if (!prefixes) throw new Error('unknown area ' + o.area);
  const S = await B.start();
  let res, errors;
  try {
    const P = await B.open(S, 'dev.html');
    res = await P.page.evaluate(`(${inspect})(${JSON.stringify({ prefixes, only: o.only })})`);
    errors = P.errors;
    await P.close();
  } finally { await B.stop(S); }
  return { res, errors };
}

if (require.main === module) {
  (async () => {
    const o = args(process.argv.slice(2));
    const { res, errors } = await run(o);
    let fails = 0, warns = 0;
    for (const r of res) {
      const i = r.info || {};
      const tag = r.fail.length ? 'FAIL' : r.warn.length ? 'warn' : 'ok  ';
      console.log(`${tag}  ${r.key.padEnd(34)} ${String(i.frames || 0).padStart(3)}f  ${String(i.w || '')}x${String(i.h || '')}  colors ${(i.colors || []).join('..')}  sat ${i.sat}  outline ${i.outline}  h ${i.height}`);
      for (const f of r.fail) console.log('        ✗ ' + f);
      for (const w of r.warn) console.log('        · ' + w);
      if (r.fail.length) fails++;
      if (r.warn.length) warns++;
    }
    console.log(`\nhd_check ${o.area}${o.only ? ' ' + o.only : ''}: ${res.length} keys, ${fails} failed, ${warns} with warnings`);
    if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
    if (o.json) fs.writeFileSync(o.json, JSON.stringify(res, null, 1));
    if (fails || errors.length || (o.strict && warns)) process.exitCode = 1;
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { inspect, run };
