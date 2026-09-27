#!/usr/bin/env node
// QA: 夜の測定（V2_PLAN §2.8・§3.16 の 13、STYLE_REFERENCE §5.2）。
//
//   node v2/tools/qa/measure_night.js [--json]
//
// dist/dev.html で町・街道・洞窟・迷いの森・戦闘を開き、1920×1080 の 1 フレーム（フィールドは HUD を描かずに）の画素から:
//   平均輝度 .14〜.22・暗い 5% 分位 .02〜.05・明るい 95% 分位 .35〜.60・輝度 > .75 の画素 1〜7%・暗部の色相 250〜295°・
//   四隅 / 中央 .25〜.40（町）・.12〜.30（ダンジョン・街道・戦闘は参考）
// と、縦切りの全マップのチャンクを R.Terrain.bakeChunk で焼いた平均輝度（暗がりの範囲を除く）が .12 以上、
// ティア 0 と 1 の同じ場面で 1 の方が明るいことを確かめる。輝度は sRGB の値の 0.2126R + 0.7152G + 0.0722B（0〜1）。
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('../lib/browser');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const FIELD = "RPG.Engine.top() && RPG.Engine.top().id==='field' && RPG.Engine.fade.a<0.02 && !RPG.Field._s.entering";
const IN = "RPG.Battle.debug() && RPG.Battle.debug().ui && RPG.Battle.debug().phase==='input'";
const SCENES = [
  { id: 'town', label: '町（ファロス）', page: 'dev.html?fixture=content_p_pharos', until: FIELD, corners: [0.25, 0.40] },
  { id: 'town_roa', label: '町（ロアの里）', page: 'dev.html?fixture=content_p_roa', until: FIELD, corners: [0.25, 0.40] },
  { id: 'town_fern', label: '町（フェルン）', page: 'dev.html?fixture=content_f_fern_plaza', until: FIELD, corners: [0.25, 0.40] },
  { id: 'road', label: '街道（ワールド）', page: 'dev.html?fixture=content_p_world_pharos', until: FIELD, corners: [0.12, 0.40] },
  { id: 'cave', label: '洞窟（古井戸）', page: 'dev.html?fixture=content_p_well', until: FIELD, corners: [0.12, 0.30] },
  { id: 'verda', label: '迷いの森', page: 'dev.html?fixture=content_f_verda_1', until: FIELD, corners: [0.12, 0.30] },
  { id: 'battle', label: '戦闘（迷いの森）', page: 'dev.html?scene=battle_zone_verda', until: IN, corners: [0.12, 0.40], battle: true },
];
const T = { mean: [0.14, 0.22], p5: [0.02, 0.05], p95: [0.35, 0.60], bright: [0.01, 0.07], hue: [250, 295] };

function statsJs() {
  return `(() => {
    const R = window.RPG, cv = R.Gfx.canvas;
    const hud = R.Field && R.Field.hud, keep = {};
    // HUD を描かない 1 フレーム（UI を除く）
    for (const k of ['draw', 'drawTop']) if (hud && typeof hud[k] === 'function') { keep[k] = hud[k]; hud[k] = function () {}; }
    const bs = R.Battle && R.Battle.debug && R.Battle.debug(); const ui = bs ? bs.ui : null; if (bs) bs.ui = null;
    const ov = R.Input.touchVisible; R.Input.touchVisible = () => false;
    R.Engine.pause(); R.Engine.render();
    for (const k in keep) hud[k] = keep[k];
    if (bs) bs.ui = ui;
    R.Input.touchVisible = ov;
    // 320×180 に縮めて測る（STYLE_REFERENCE §1 と同じ）
    const w = 320, h = 180, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(cv, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
    let hx = 0, hy = 0, hw = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
      L[j] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    }
    const sorted = Array.from(L).sort((a, b) => a - b), q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    const p30 = q(0.3);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      if (L[j] > p30) continue;
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), s = mx ? (mx - mn) / mx : 0;
      if (s < 0.15 || mx === mn) continue;
      let hu = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
      hu = (hu * 60 + 360) % 360;
      hx += Math.cos(hu * Math.PI / 180) * s; hy += Math.sin(hu * Math.PI / 180) * s; hw += s;
    }
    const box = (x0, y0, x1, y1) => { let s = 0, n = 0; for (let y = Math.floor(y0 * h); y < Math.floor(y1 * h); y++) for (let x = Math.floor(x0 * w); x < Math.floor(x1 * w); x++) { s += L[y * w + x]; n++; } return s / n; };
    const corners = (box(0, 0, 0.1, 0.1) + box(0.9, 0, 1, 0.1) + box(0, 0.9, 0.1, 1) + box(0.9, 0.9, 1, 1)) / 4, center = box(0.4, 0.4, 0.6, 0.6);
    const mean = L.reduce((a, b) => a + b, 0) / L.length;
    const res = { mean, p5: q(0.05), p95: q(0.95), bright: L.filter((v) => v > 0.75).length / L.length, hue: hw ? ((Math.atan2(hy, hx) * 180 / Math.PI) + 360) % 360 : null, corners: corners / Math.max(1e-6, center), tier: R.Game ? R.Game.tier : null };
    R.Engine.resume();
    return res;
  })()`;
}

(async () => {
  const S = await B.start();
  const out = { scenes: {}, maps: {} };
  try {
    section('1. 場面（1920×1080、UI を除く）');
    for (const sc of SCENES) {
      const P = await B.open(S, sc.page, { size: [1920, 1080] });
      try {
        if (!(await B.waitFor(P.page, sc.until, 20000))) { ok(`${sc.label}: 開く`, false); continue; }
        await P.page.waitForTimeout(1500);
        const r = await P.page.evaluate(statsJs());
        // ティア 1 の同じ場面（空の段が 1 つ上がる。フィールドだけ）
        let t1 = null;
        if (!sc.battle) {
          await P.page.evaluate("RPG.Game.tier = 1; RPG.emit('tier', {tier: 1})");
          await P.page.waitForTimeout(1600);
          t1 = await P.page.evaluate(statsJs());
        }
        out.scenes[sc.id] = { t0: r, t1 };
        const f = (v) => (v == null ? '-' : v.toFixed(3));
        console.log(`    ${sc.label}: 平均 ${f(r.mean)}  p5 ${f(r.p5)}  p95 ${f(r.p95)}  >.75 ${(r.bright * 100).toFixed(1)}%  暗部の色相 ${r.hue == null ? '-' : r.hue.toFixed(0)}°  四隅/中央 ${f(r.corners)}${t1 ? `  ／ ティア 1 の平均 ${f(t1.mean)}` : ''}`);
        const inR = (v, [a, b]) => v != null && v >= a && v <= b;
        ok(`${sc.label}: 平均輝度 ${f(r.mean)} ∈ .14〜.22`, inR(r.mean, T.mean));
        ok(`${sc.label}: 暗い 5% 分位 ${f(r.p5)} ∈ .02〜.05`, inR(r.p5, T.p5));
        ok(`${sc.label}: 明るい 95% 分位 ${f(r.p95)} ∈ .35〜.60`, inR(r.p95, T.p95));
        ok(`${sc.label}: 輝度 > .75 の画素 ${(r.bright * 100).toFixed(1)}% ∈ 1〜7%`, inR(r.bright, T.bright));
        ok(`${sc.label}: 暗部の色相 ${r.hue == null ? '-' : r.hue.toFixed(0)}° ∈ 250〜295°`, inR(r.hue, T.hue));
        ok(`${sc.label}: 四隅 / 中央 ${f(r.corners)} ∈ ${sc.corners.join('〜')}`, inR(r.corners, sc.corners));
        if (t1) ok(`${sc.label}: ティア 1 の方が明るい（${f(r.mean)} → ${f(t1.mean)}）`, t1.mean > r.mean);
        ok(`${sc.label}: ページのエラー 0`, P.errors.length === 0, P.errors.slice(0, 3));
      } finally { await P.close(); }
    }

    section('2. 縦切りの全マップ: 焼いたチャンクの平均輝度 ≧ .12（暗がりの範囲を除く）');
    const P = await B.open(S, 'index.html', { size: [1280, 720] });
    try {
      const maps = require('../lib/maps').create(require('../lib/load')({ quiet: true })).sliceMaps();
      const res = await P.page.evaluate((ids) => {
        const R = window.RPG, T = R.Terrain, out = {};
        for (const id of ids) {
          const map = R.DB.maps[id];
          let s = 0, n = 0, low = 0;
          for (let cy = 0; cy < Math.ceil(map.h / 8); cy++) for (let cx = 0; cx < Math.ceil(map.w / 8); cx++) {
            // 歩けるマスがあり、暗がりの範囲でないチャンクだけ
            let walk = 0, dark = 0;
            for (let y = cy * 8; y < Math.min(map.h, cy * 8 + 8); y++) for (let x = cx * 8; x < Math.min(map.w, cx * 8 + 8); x++) {
              const c = R.MapUtil.cell(map, x, y); if (c && c.walk !== false && !c.solid) walk++;
              if (map.dark && map.dark !== true && R.MapUtil.inRect && map.dark.some((e) => e.rect && R.MapUtil.inRect(x, y, e.rect))) dark++;
            }
            if (walk < 8 || dark > 16 || map.dark === true) continue;
            if (id === 'world' && (cx % 3 || cy % 3)) continue;   // ワールドは 9 つに 1 つ
            const j = T.bakeChunk(map, cx, cy, { tile: 32, tier: 0, state: { chests: [], secrets: [], lit: [], lamps: {} } });
            let k = 0; while (!j.done && k++ < 200000) j.step(8);
            const c = j.result.base, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let ls = 0, ln = 0;
            for (let i = 0; i < d.length; i += 16) { ls += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; ln++; }
            const v = ls / ln; s += v; n++; if (v < 0.12) low++;
          }
          out[id] = { mean: n ? s / n : null, chunks: n, low };
        }
        return out;
      }, maps);
      out.maps = res;
      const lowMaps = Object.entries(res).filter(([, r]) => r.mean != null && r.mean < 0.12);
      for (const [id, r] of Object.entries(res)) console.log(`    ${id.padEnd(16)} ${r.mean == null ? '-' : r.mean.toFixed(3)}  (${r.chunks} チャンク、.12 未満 ${r.low})`);
      ok(`チャンクの平均輝度 .12 未満のマップ 0（${lowMaps.map(([id, r]) => id + ' ' + r.mean.toFixed(3)).join('、') || 'なし'}）`, lowMaps.length === 0);
    } finally { await P.close(); }
  } finally { await B.stop(S); }
  if (process.argv.includes('--json')) {
    const f = path.join(V2, 'design', 'qa', 'night.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(out, null, 1));
  }
  done('measure_night');
})().catch((e) => { console.error(e); process.exit(2); });
