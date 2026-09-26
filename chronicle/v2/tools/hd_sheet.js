#!/usr/bin/env node
// 絵の図書館の一覧表と、RENDER の光の見本（RENDER、V2_PLAN §2.8・§4.4）。dev.html を lib/browser.js で開いて撮る。
//
//   node v2/tools/hd_sheet.js --area render [--out v2/design/shots/render] [--phone]
//        光の地図の見本（灯り 10 個）・夜の色調の mood・仕上げの有無・効果 高/低/切・ティア 0/4/8 を撮り、
//        STYLE_REFERENCE §9 の夜の目標値（320×180 に縮めて測る）を measure.json に書く
//   node v2/tools/hd_sheet.js --area <cast|mons|boss|bbg|terrain|props|fx|all> [--only <部分文字列>] [--poses] [--mood <id>] [--out <dir>]
//        登録されたキー（hd:field/btl/face・hd:mon・hd:boss・hd:bbg・hd:bld/secret・hd:prop・hd:bfx）の 1:1 と ×4 の一覧表
//        --poses で全ポーズの全コマ、--mood でその場面の色調（R.Hd.grade）を掛けて並べる
// ビルドは先に（node v2/tools/build.js）。撮った PNG は必ず Read で見る（§2.9）。
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');

const AREAS = {
  cast: ['hd:field:', 'hd:btl:', 'hd:face:'],
  mons: ['hd:mon:'],
  boss: ['hd:boss:'],
  bbg: ['hd:bbg:'],
  terrain: ['hd:bld:', 'hd:secret:'],
  props: ['hd:prop:'],
  fx: ['hd:bfx:'],
};

function args(argv) {
  const o = { area: 'render', out: null, only: null, poses: false, mood: null, phone: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    if (a === '--area') { o.area = v; i++; } else if (a === '--out') { o.out = v; i++; } else if (a === '--only') { o.only = v; i++; }
    else if (a === '--poses') o.poses = true; else if (a === '--mood') { o.mood = v; i++; } else if (a === '--phone') o.phone = true;
  }
  if (!o.out) o.out = path.join(B.V2, 'design', 'shots', o.area === 'render' ? 'render' : 'hd_' + o.area);
  return o;
}

// ==================================================================== ページの中で動く物（関数ごと文字にして渡す）

/** 光の見本の場面（render_lab）を積む。夜の港町の広場: 昼の色で塗った下地 → 光の地図 → 発光 → 光の輪 → 仕上げ */
function labInstall() {
  const R = window.RPG, Hd = R.Hd, RZ = Hd.RZ;
  const LAB = (window.__lab = window.__lab || { mood: 'town_night', post: true, lights: 10, tier: null, show: 'scene', ring: true });
  const W = () => R.W, H = () => R.H;
  const cache = {};
  const rng = RZ.rng(RZ.seed('render_lab'));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ---- 配置（論理 px。R.W × R.H に合わせて決める）
  function layout() {
    const w = W(), h = H();
    const key = w + 'x' + h;
    if (cache.layout && cache.layout.key === key) return cache.layout;
    const wallTop = Math.round(h * 0.07), wallBot = Math.round(h * 0.28), plazaBot = Math.round(h * 0.8), quayBot = Math.round(h * 0.86);
    const blds = [];
    let x = -10, i = 0;
    while (x < w) {
      const bw = 170 + Math.floor(rng() * 90);
      blds.push({ x, w: bw, roof: i % 3 === 1 ? 'terra' : 'slate', wall: i % 2 ? 'stone' : 'plaster', i });
      x += bw + 14 + Math.floor(rng() * 10);
      i++;
    }
    const windows = [], doors = [];
    for (const b of blds) {
      const n = Math.max(2, Math.floor((b.w - 30) / 44));
      for (let k = 0; k < n; k++) {
        const wx = b.x + 20 + k * ((b.w - 40) / n) + ((b.w - 40) / n - 14) / 2;
        windows.push({ x: Math.round(wx), y: wallTop + Math.round((wallBot - wallTop) * 0.22), w: 14, h: 16 });
        if (k !== (n >> 1)) windows.push({ x: Math.round(wx), y: wallTop + Math.round((wallBot - wallTop) * 0.58), w: 14, h: 16 });
      }
      doors.push({ x: Math.round(b.x + b.w / 2 - 10), y: wallBot - 30, w: 20, h: 30, open: b.i === 1 });
    }
    // 灯り 10: 広場のまわり 8 と中央の大きな街灯 1、桟橋 1
    const lamps = [];
    const px = [0.07, 0.3, 0.52, 0.74, 0.93];
    for (const f of px) lamps.push({ x: Math.round(w * f), y: wallBot + 26 });
    for (const f of [0.1, 0.36, 0.64, 0.9]) lamps.push({ x: Math.round(w * f), y: plazaBot - 14 });
    lamps.push({ x: Math.round(w * 0.5), y: plazaBot - 4, fire: true });
    const cx = Math.round(w * 0.47), cy = Math.round((wallBot + plazaBot) / 2) + 18;
    const party = [0, 1, 2, 3].map((k) => ({ x: cx - k * 20, y: cy + (k % 2) * 2 }));
    const props = [];
    for (let k = 0; k < 14; k++) {
      const onWall = k < 8;
      props.push({ kind: k % 3 === 0 ? 'crate' : 'barrel', x: Math.round(onWall ? 20 + rng() * (w - 40) : 30 + rng() * (w - 60)), y: onWall ? wallBot + 8 + Math.round(rng() * 6) : plazaBot - 30 + Math.round(rng() * 18) });
    }
    return (cache.layout = { key, w, h, wallTop, wallBot, plazaBot, quayBot, blds, windows, doors, lamps, party, props });
  }

  // ---- 下地（昼の色。画素で焼く）
  function ground(L) {
    const key = L.key;
    if (cache.ground && cache.ground.key === key) return cache.ground.c;
    const c = RZ.canvas(L.w, L.h), x = c.getContext('2d');
    const img = x.createImageData(L.w, L.h), D = img.data;
    const set = (px, py, col) => { const q = (py * L.w + px) * 4; D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255; };
    const cell = 13;
    const pts = {};
    const pt = (gx, gy) => { const k = gx + ',' + gy; if (!pts[k]) { const r = RZ.rng(RZ.seed(k)); pts[k] = [(gx + 0.15 + r() * 0.7) * cell, (gy + 0.15 + r() * 0.7) * cell, r()]; } return pts[k]; };
    const stone = [[118, 110, 104], [132, 124, 114], [108, 104, 102], [126, 116, 104], [140, 130, 118]];
    const mortar = [58, 54, 56];
    for (let py = 0; py < L.h; py++) for (let px = 0; px < L.w; px++) {
      let col;
      const n = RZ.vnoise(px * 0.08, py * 0.08, 7), n2 = RZ.vnoise(px * 0.5, py * 0.5, 9);
      if (py < L.wallTop) {
        // 屋根（瓦の段）
        const b = L.blds.find((q) => px >= q.x && px < q.x + q.w);
        if (!b) col = [22, 20, 30];
        else {
          const row = Math.floor((py - (px % 2)) / 5), tile = Math.floor((px + (row % 2) * 6) / 12);
          const base = b.roof === 'slate' ? [82, 94, 128] : [150, 78, 58];
          const edge = (py % 5 === 4) || ((px + (row % 2) * 6) % 12 === 0);
          const v = RZ.rng(RZ.seed(tile + ':' + row))() * 0.16 - 0.08;
          col = base.map((u) => u * (1 + v + (n2 - 0.5) * 0.08) * (edge ? 0.66 : 1));
          if (py > L.wallTop - 3) col = col.map((u) => u * 0.55);
        }
      } else if (py < L.wallBot) {
        const b = L.blds.find((q) => px >= q.x && px < q.x + q.w);
        if (!b) col = [22, 20, 30];
        else if (b.wall === 'plaster') {
          col = [206, 196, 178].map((u) => u * (0.94 + n * 0.1));
          const beam = (px - b.x) % 40 < 4 || (py - L.wallTop) % 46 < 4 || px - b.x < 4 || b.x + b.w - px < 4;
          if (beam) col = [104, 76, 54].map((u) => u * (0.9 + n2 * 0.2));
        } else {
          const row = Math.floor((py - L.wallTop) / 8), off = (row % 2) * 10;
          const edge = (py - L.wallTop) % 8 === 7 || (px - b.x + off) % 20 === 0;
          const v = RZ.rng(RZ.seed((Math.floor((px - b.x + off) / 20)) + ':' + row + ':' + b.i))();
          col = edge ? [72, 70, 76] : [150, 146, 140].map((u) => u * (0.86 + v * 0.22 + (n2 - 0.5) * 0.06));
        }
        // 壁の根元の陰
        const d = L.wallBot - py;
        if (d < 9) col = col.map((u) => u * (0.6 + d * 0.045));
      } else if (py < L.plazaBot) {
        // 石畳（ボロノイ）
        const gx = Math.floor(px / cell), gy = Math.floor(py / cell);
        let d1 = 1e9, d2 = 1e9, best = null;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const p = pt(gx + ox, gy + oy), dx = px - p[0], dy = py - p[1], d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        if (e < 1.4) col = mortar.map((u) => u * (0.9 + n2 * 0.2));
        else {
          col = stone[Math.floor(best[2] * stone.length)].slice();
          const lit = (px - best[0]) * -0.5 + (py - best[1]) * -0.7;
          if (e < 3) col = col.map((u) => u * (lit > 0 ? 1.12 : 0.84));
          col = col.map((u) => u * (0.94 + n2 * 0.12));
        }
        // 端の草
        const gEdge = Math.min(px, L.w - 1 - px);
        if (gEdge < 34 + RZ.vnoise(py * 0.1, 3, 5) * 16) col = [70, 108, 52].map((u) => u * (0.8 + n2 * 0.35 + n * 0.1));
      } else if (py < L.quayBot) {
        // 岸壁の正面（石積み、上端に明るい縁）
        const row = Math.floor((py - L.plazaBot) / 7), off = (row % 2) * 9;
        const edge = (py - L.plazaBot) % 7 === 6 || (px + off) % 18 === 0;
        col = edge ? [60, 58, 66] : [120, 116, 118].map((u) => u * (0.85 + n2 * 0.2));
        if (py - L.plazaBot < 2) col = [176, 170, 160];
        col = col.map((u) => u * (1 - (py - L.plazaBot) / (L.quayBot - L.plazaBot) * 0.3));
      } else {
        // 水
        const wv = Math.sin(px * 0.09 + py * 0.6 + RZ.vnoise(px * 0.02, py * 0.1, 2) * 6);
        col = [26, 50, 72].map((u, k) => u * (0.9 + wv * 0.08) + (k === 2 ? 6 : 0));
        if (py - L.quayBot < 5) col = col.map((u) => u * 0.6);
      }
      set(px, py, col.map((u) => clamp(Math.round(u), 8, 255)));
    }
    x.putImageData(img, 0, 0);
    // 窓の枠・ガラス（昼は暗い）、戸
    for (const wd of L.windows) { x.fillStyle = '#4a3424'; x.fillRect(wd.x - 2, wd.y - 2, wd.w + 4, wd.h + 4); x.fillStyle = '#2a3446'; x.fillRect(wd.x, wd.y, wd.w, wd.h); x.fillStyle = '#4a3424'; x.fillRect(wd.x + wd.w / 2 - 1, wd.y, 2, wd.h); x.fillRect(wd.x, wd.y + wd.h / 2 - 1, wd.w, 2); }
    for (const d of L.doors) { x.fillStyle = '#3c2a1c'; x.fillRect(d.x - 2, d.y - 2, d.w + 4, d.h + 2); x.fillStyle = d.open ? '#20160e' : '#6a4a30'; x.fillRect(d.x, d.y, d.w, d.h); }
    cache.ground = { key, c };
    return c;
  }

  // ---- 物と人（RZ で焼く）
  function mats() {
    if (cache.mats) return cache.mats;
    const m = RZ.mat;
    return (cache.mats = {
      metal: m({ keys: ['#16161e', '#2a2c36', '#44485a', '#6a7084'], n: 5, metal: true, spec: 0.6 }),
      wood: m({ keys: ['#2a1a12', '#4a3020', '#6c4c32', '#907050', '#b09070'], n: 5, tex: 2, tsx: 0.2, tsy: 1.4 }),
      band: m({ keys: ['#26262c', '#4a4a52', '#72727a'], n: 4, metal: true }),
      glass: m({ keys: ['#806030', '#e0b060', '#fff0c0'], n: 3, flat: true, noOutline: true }),
      skin: m({ keys: ['#46282a', '#84523f', '#bb866a', '#deb496', '#f4d8c0'], n: 5, wrap: 0.45, amb: 0.3 }),
      cloth: (c) => m({ keys: c, n: 5, wrap: 0.3, amb: 0.2, tex: 0.8, tsx: 0.4, tsy: 0.4 }),
    });
  }
  function bakeRZ(name, build, o) {
    if (cache[name]) return cache[name];
    const Bd = new RZ.Builder();
    build(Bd, mats());
    const r = RZ.render(Bd, Object.assign({ scale: 1, tones: Hd.STYLE.tones, olMix: Hd.STYLE.olMix, sat: Hd.STYLE.sat }, o || {}));
    return (cache[name] = RZ.frame(r));
  }
  function lampPost() {
    return bakeRZ('lamp', (Bd, M) => {
      Bd.ell(0, -1, 4, 2, M.metal, 0); Bd.cap(0, -2, 0, -40, 1.6, 1.2, M.metal, 0.1);
      Bd.cap(0, -37, 5, -39, 0.7, 0.7, M.metal, 0.2);
      Bd.rect(-3.5, -48, 7, 8, M.glass, 0.3);
      Bd.poly([[-4.5, -48], [4.5, -48], [0, -53]], M.metal, 0.4, { bevel: 1 });
    });
  }
  function brazier() {
    return bakeRZ('brazier', (Bd, M) => {
      Bd.cap(-4, -1, -2, -9, 1, 0.8, M.metal, 0); Bd.cap(4, -1, 2, -9, 1, 0.8, M.metal, 0);
      Bd.ell(0, -11, 7, 3.2, M.metal, 0.2, { bulge: 0.6 });
      Bd.ell(0, -13, 5, 2, M.cloth(['#401008', '#a03010', '#f08020', '#ffd060']), 0.3, { bulge: 0.5 });
    });
  }
  function barrel() {
    return bakeRZ('barrel', (Bd, M) => {
      Bd.ell(0, -8, 6, 8, M.wood, 0, { bulge: 0.9 });
      Bd.rect(-6, -12, 12, 1.2, M.band, 0.5); Bd.rect(-6, -5, 12, 1.2, M.band, 0.5);
      Bd.ell(0, -15.5, 5.2, 1.6, M.wood, 0.6, { bulge: 0.4, shadeOff: 1 });
    });
  }
  function crate() {
    return bakeRZ('crate', (Bd, M) => {
      Bd.poly([[-8, -1], [8, -1], [8, -13], [-8, -13]], M.wood, 0, { bevel: 1.5 });
      Bd.poly([[-8, -13], [8, -13], [5, -17], [-5, -17]], M.wood, 0.2, { bevel: 1, ny: -0.5 });
      Bd.cap(-7, -2, 7, -12, 0.7, 0.7, M.wood, 0.3, { shadeOff: -1 });
    });
  }
  const PARTY = [['#1a2440', '#2c3e6c', '#44609c', '#7090c8'], ['#3a1410', '#6a2a1e', '#9a4430', '#c87050'], ['#16280e', '#2c4a1c', '#4a7030', '#78a050'], ['#261a38', '#46305e', '#6a5090', '#9a80c0']];
  const HAIR = [['#2a1a10', '#5a3a20', '#8a6038'], ['#3a1008', '#7a2a14', '#b04a28'], ['#1a2010', '#3a4a24', '#607038'], ['#241a30', '#4a3a60', '#7a6a98']];
  function person(k) {
    // CAST のフィールドの絵があればそれを、無ければ簡単な人の形（RENDER の見本だけの仮）
    const looks = Object.keys(R.DB.looks || {});
    const look = looks.filter((l) => R.Hd.has('hd:field:' + l))[k];
    if (look) { const sh = R.Hd.now('hd:field:' + look); if (sh) return R.Hd.frameAt(sh, 'down', 0) || sh.frames[0]; }
    return bakeRZ('person' + k, (Bd, M) => {
      const cl = M.cloth(PARTY[k]), hr = M.cloth(HAIR[k]), bt = M.cloth(['#1a120c', '#2e2016', '#4a3424']);
      Bd.cap(-2.6, -11, -2.8, -2, 2.3, 2.1, cl, 1); Bd.cap(2.6, -11, 2.8, -2, 2.3, 2.1, cl, 1);
      Bd.ell(-2.9, -1.5, 2.6, 1.8, bt, 1.2); Bd.ell(2.9, -1.5, 2.6, 1.8, bt, 1.2);
      Bd.ell(0, -16, 6.2, 7, cl, 2, { bulge: 0.85 });
      Bd.cap(-6, -20, -7, -12, 1.8, 1.6, cl, 2.1); Bd.cap(6, -20, 7, -12, 1.8, 1.6, cl, 2.1);
      Bd.ell(0, -27, 6.4, 6.2, M.skin, 3);
      Bd.ell(0, -30, 6.9, 5, hr, 3.2, { bulge: 0.8 });
      Bd.rect(-2.6, -27.5, 1.3, 1.8, M.cloth(['#101018', '#202030']), 3.4); Bd.rect(1.4, -27.5, 1.3, 1.8, M.cloth(['#101018', '#202030']), 3.4);
    }, { light: Hd.mood('night').rz });
  }

  function lights(L, moodId) {
    const S = Hd.STYLE.light;
    const out = [];
    const n = LAB.lights;
    L.lamps.slice(0, n).forEach((l, i) => out.push({ x: l.x, y: l.y + 2, r: l.fire ? S.lampR * S.fireMul : i === 2 ? S.lampR * 1.25 : S.lampR, color: l.fire ? S.fireColor : S.lampColor, k: 0.9, kind: 'pool' }));
    for (const w of L.windows) out.push({ x: w.x + w.w / 2, y: L.wallBot + 6, r: 34, color: S.windowColor, k: 0.4, kind: 'window' });
    for (const d of L.doors) if (d.open) out.push({ x: d.x + d.w / 2, y: L.wallBot + 8, r: 70, color: S.windowColor, k: 1.0, kind: 'wide' });
    void moodId;
    return out;
  }

  const scene = {
    id: 'render_lab',
    opaque: true,
    enter() {}, exit() {}, update() {},
    draw(g) {
      const L = layout();
      const moodId = LAB.mood;
      const tier = LAB.tier;
      const mood = Hd.mood(moodId, tier);
      g.imageSmoothingEnabled = false;
      g.drawImage(ground(L), 0, 0);
      // 立っている物（足元の y で並べる）
      const items = [];
      for (const l of L.lamps) items.push({ y: l.y, f: l.fire ? brazier() : lampPost(), x: l.x });
      for (const p of L.props) items.push({ y: p.y, f: p.kind === 'crate' ? crate() : barrel(), x: p.x });
      L.party.forEach((p, k) => items.push({ y: p.y, f: person(k), x: p.x }));
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        // 足もとの影（月の向きへ少しずらす）
        g.fillStyle = 'rgba(20,16,40,0.35)';
        g.beginPath(); g.ellipse(it.x + 2, it.y, it.f.c.width * 0.34, 2.6, 0, 0, Math.PI * 2); g.fill();
        Hd.draw(g, it.f, it.x, it.y);
      }
      if (LAB.show === 'day') return;
      // 光の地図（掛け算の環境光＋光だまり）
      const lm = R.Light.compose(g, [0, 0, L.w, L.h], { mood: moodId, ambient: mood.ambient, lights: lights(L, moodId), moon: L.blds.map((b) => [b.x, 0, b.w, L.wallTop]) });
      if (LAB.show === 'map') { g.save(); g.globalCompositeOperation = 'copy'; g.imageSmoothingEnabled = true; g.drawImage(lm, 0, 0, L.w, L.h); g.restore(); return; }
      // 発光の描き直し: 窓は暖色でべったり、開いた戸口が一番明るい、灯りの芯とにじみ
      const t = R.Engine.time;
      for (const w of L.windows) { g.fillStyle = '#ffd488'; g.fillRect(w.x, w.y, w.w, w.h); g.fillStyle = '#fff0c8'; g.fillRect(w.x + 2, w.y + 2, w.w / 2 - 3, w.h / 2 - 3); g.fillStyle = '#5a3c26'; g.fillRect(w.x + w.w / 2 - 1, w.y, 2, w.h); g.fillRect(w.x, w.y + w.h / 2 - 1, w.w, 2); }
      for (const w of L.windows) R.Light.glow(g, w.x + w.w / 2, w.y + w.h / 2, { core: 0.1, halo: 20, color: Hd.STYLE.light.windowColor, k: 0.6 }, t);
      for (const d of L.doors) if (d.open) { g.fillStyle = '#ffeec8'; g.fillRect(d.x, d.y, d.w, d.h); R.Light.glow(g, d.x + d.w / 2, d.y + d.h / 2, { core: 0.1, halo: 30, color: '#ffd9a0', k: 0.8 }, t); }
      L.lamps.slice(0, LAB.lights).forEach((l, i) => R.Light.glow(g, l.x, l.fire ? l.y - 15 : l.y - 44, { core: l.fire ? 5 : i === 2 ? 8 : 6, halo: l.fire ? 26 : undefined, color: l.fire ? Hd.STYLE.light.fireColor : Hd.STYLE.light.lampColor }, t));
      // 先頭の人のランタンの光の輪
      const lead = L.party[0];
      if (LAB.ring) { R.Light.ring(g, lead.x, lead.y - 4, Hd.STYLE.light.ringR, t); R.Light.glow(g, lead.x + 6, lead.y - 12, { core: 3, halo: 12, color: '#ffc070' }, t); }
      // 仕上げ
      if (LAB.post) R.Post.frame(g, { mood: moodId, vignette: mood.vignette });
    },
  };
  // タイトルの流れを止める（この見本のページだけ。画面を閉じても次の画面が開かないように）
  const never = () => new Promise(() => {});
  R.Screens.open = never;
  if (R.Field) R.Field.enter = never;
  if (R.Flow) { R.Flow.title = never; R.Flow.newGame = never; }
  R.Engine.clear();
  R.Engine.fade.a = 0;
  R.Engine.push(scene);
  return { w: R.W, h: R.H };
}

/** 画面を 320×180 に縮めて STYLE_REFERENCE §9 の夜の値を測る（UI は無い前提） */
function measure() {
  const R = window.RPG, cv = R.Gfx.canvas;
  const w = 320, h = Math.round(320 * cv.height / cv.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(cv, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const lums = new Float32Array(w * h);
  const px = [];
  for (let i = 0, k = 0; i < d.length; i += 4, k++) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lums[k] = l;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
    let hue = 0;
    if (mx !== mn) { if (mx === r) hue = 60 * (((g - b) / (mx - mn)) % 6); else if (mx === g) hue = 60 * ((b - r) / (mx - mn) + 2); else hue = 60 * ((r - g) / (mx - mn) + 4); }
    if (hue < 0) hue += 360;
    px.push([l, hue, s]);
  }
  const sorted = Array.from(lums).sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const bright = sorted.filter((v) => v > 0.75).length / sorted.length;
  const cut = q(0.3);
  let sx = 0, sy = 0, ss = 0, n = 0;
  for (const p of px) if (p[0] <= cut) { const a = p[1] * Math.PI / 180; sx += Math.cos(a) * p[2]; sy += Math.sin(a) * p[2]; ss += p[2]; n++; }
  let darkHue = Math.atan2(sy, sx) * 180 / Math.PI; if (darkHue < 0) darkHue += 360;
  const region = (x0, y0, rw, rh) => { let s = 0, m = 0; for (let yy = y0; yy < y0 + rh; yy++) for (let xx = x0; xx < x0 + rw; xx++) { s += lums[yy * w + xx]; m++; } return s / m; };
  const bw = Math.round(w * 0.12), bh = Math.round(h * 0.12);
  const corners = (region(0, 0, bw, bh) + region(w - bw, 0, bw, bh) + region(0, h - bh, bw, bh) + region(w - bw, h - bh, bw, bh)) / 4;
  const center = region(Math.round(w * 0.375), Math.round(h * 0.375), Math.round(w * 0.25), Math.round(h * 0.25));
  const f = (v) => +v.toFixed(3);
  return { lum: f(mean), p5: f(q(0.05)), p95: f(q(0.95)), bright: f(bright), darkHue: Math.round(darkHue), darkSat: f(ss / (n || 1)), corner: f(corners / (center || 1e-6)) };
}

/** 登録されたキーの一覧表（1:1 と ×4）→ dataURL */
function contactSheet(o) {
  const R = window.RPG, Hd = R.Hd;
  let keys = [];
  for (const p of o.prefixes) keys = keys.concat(Hd.keys(p));
  if (o.only) keys = keys.filter((k) => k.indexOf(o.only) >= 0);
  const cells = [];
  const errors = [];
  for (const key of keys) {
    let sh = null;
    try { sh = Hd.now(key, key.startsWith('hd:bbg:') ? { w: 480, h: 270 } : undefined); } catch (e) { errors.push(key + ': ' + e.message); }
    if (!sh || !sh.frames || !sh.frames.length) { errors.push(key + ': no sheet'); continue; }
    let idx = [0];
    if (o.poses) { idx = []; for (const p of Object.keys(sh.poses || {})) for (const i of sh.poses[p]) if (!idx.includes(i)) idx.push(i); if (!idx.length) idx = sh.frames.map((_, i) => i); }
    cells.push({ key, frames: idx.map((i) => sh.frames[i]).filter((f) => f && f.c) });
  }
  const pad = 10, label = 16;
  const zoom = keys.some((k) => k.startsWith('hd:bbg:')) ? 1 : 4;
  let W = 1800, x = pad, y = pad, rowH = 0;
  const place = [];
  for (const c of cells) {
    const w1 = c.frames.reduce((s, f) => s + f.c.width + 4, 0), h1 = Math.max(...c.frames.map((f) => f.c.height));
    const w4 = c.frames.reduce((s, f) => s + f.c.width * zoom + 4, 0), h4 = Math.max(...c.frames.map((f) => f.c.height * zoom));
    const cw = Math.max(w1 + 8 + w4, 120), ch = label + Math.max(h1, h4);
    if (x + cw > W - pad) { x = pad; y += rowH + pad; rowH = 0; }
    place.push({ c, x, y, w1, h1, cw });
    x += cw + pad; rowH = Math.max(rowH, ch);
  }
  const H = Math.max(60, y + rowH + pad);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#1b1c2a'; g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;
  for (const p of place) {
    g.fillStyle = '#e8e2d4'; g.font = '12px sans-serif'; g.fillText(p.c.key, p.x, p.y + 12);
    let xx = p.x;
    for (const f of p.c.frames) { const c = o.mood ? Hd.grade(f.c, o.mood) : f.c; g.drawImage(c, xx, p.y + label); xx += f.c.width + 4; }
    xx += 8;
    for (const f of p.c.frames) { const c = o.mood ? Hd.grade(f.c, o.mood) : f.c; g.drawImage(c, xx, p.y + label, f.c.width * zoom, f.c.height * zoom); xx += f.c.width * zoom + 4; }
  }
  return { url: cv.toDataURL('image/png'), n: cells.length, keys: keys.length, errors };
}

// ==================================================================== node 側
async function shotCanvas(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file });
  return path.relative(path.join(B.V2, '..'), file);
}

async function renderArea(o) {
  const S = await B.start();
  const results = { date: new Date().toISOString().slice(0, 10), shots: [], measure: {} };
  const errors = [];
  try {
    const P = await B.open(S, 'dev.html', o.phone ? { phone: true } : {});
    await P.page.evaluate(`(${labInstall})()`);
    const set = async (lab, extra) => {
      await P.page.evaluate(`Object.assign(window.__lab, ${JSON.stringify(lab)}); ${extra || ''} RPG.Engine.render && RPG.Engine.render();`);
      await P.page.waitForTimeout(250);
    };
    const snap = async (name, lab, extra, noMeasure) => {
      await set(lab, extra);
      const file = path.join(o.out, (o.phone ? 'phone_' : '') + name + '.png');
      results.shots.push(await shotCanvas(P.page, file));
      if (!noMeasure) results.measure[name] = await P.page.evaluate(`(${measure})()`);
    };
    const base = { mood: 'town_night', post: true, lights: 10, tier: null, show: 'scene', ring: true };
    await P.page.evaluate("RPG.Settings.set('fx', 'high'); RPG.Settings.set('brightness', 1); RPG.Hd.autoQuality(null);");
    // 光の地図の見本（灯り 10 個）: 地図そのもの・昼の下地・掛けた後
    await snap('lightmap_map', Object.assign({}, base, { show: 'map' }), '', true);
    await snap('lightmap_day', Object.assign({}, base, { show: 'day' }), '', true);
    await snap('lightmap_10', base);
    // 夜の色調の mood（3 つ＋残り）
    for (const m of ['town_night', 'forest_night', 'cave', 'night', 'interior', 'dark', 'tree', 'tower', 'coast']) await snap('mood_' + m, Object.assign({}, base, { mood: m }));
    // 仕上げの有無・効果の 3 段・明るさ
    await snap('post_off', Object.assign({}, base, { post: false }));
    await snap('post_on', base);
    await snap('fx_low', base, "RPG.Settings.set('fx','low');");
    await snap('fx_off', base, "RPG.Settings.set('fx','off');");
    await P.page.evaluate("RPG.Settings.set('fx','high');");
    await snap('bright_085', base, "RPG.Settings.set('brightness',0.85);");
    await snap('bright_125', base, "RPG.Settings.set('brightness',1.25);");
    await P.page.evaluate("RPG.Settings.set('brightness',1);");
    // ティアの空（0・4・8）
    for (const t of [0, 4, 8]) await snap('tier_' + t, Object.assign({}, base, { tier: t }));
    errors.push(...P.errors);
    await P.close();
  } finally { await B.stop(S); }
  fs.mkdirSync(o.out, { recursive: true });
  fs.writeFileSync(path.join(o.out, (o.phone ? 'phone_' : '') + 'measure.json'), JSON.stringify(results, null, 1));
  return { results, errors };
}

async function libraryArea(o) {
  const prefixes = o.area === 'all' ? [].concat(...Object.values(AREAS)) : AREAS[o.area];
  if (!prefixes) throw new Error('unknown area ' + o.area + ' (render|' + Object.keys(AREAS).join('|') + '|all)');
  const S = await B.start();
  let out, errors = [];
  try {
    const P = await B.open(S, 'dev.html');
    const r = await P.page.evaluate(`(${contactSheet})(${JSON.stringify({ prefixes, only: o.only, poses: o.poses, mood: o.mood })})`);
    fs.mkdirSync(o.out, { recursive: true });
    out = path.join(o.out, `sheet_${o.area}${o.only ? '_' + o.only.replace(/[^a-z0-9_]/gi, '') : ''}${o.mood ? '_' + o.mood : ''}.png`);
    fs.writeFileSync(out, Buffer.from(r.url.split(',')[1], 'base64'));
    console.log(`${r.n}/${r.keys} keys → ${path.relative(process.cwd(), out)}`);
    for (const e of r.errors) console.log('  ! ' + e);
    errors = P.errors;
    await P.close();
  } finally { await B.stop(S); }
  return { out, errors };
}

if (require.main === module) {
  (async () => {
    const o = args(process.argv.slice(2));
    if (o.area === 'render') {
      const { results, errors } = await renderArea(o);
      console.log(results.shots.join('\n'));
      for (const [k, m] of Object.entries(results.measure)) console.log(k.padEnd(18), JSON.stringify(m));
      if (errors.length) { console.log('errors:\n  ' + errors.join('\n  ')); process.exitCode = 1; }
    } else {
      const { errors } = await libraryArea(o);
      if (errors.length) { console.log('errors:\n  ' + errors.join('\n  ')); process.exitCode = 1; }
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { labInstall, measure, contactSheet, AREAS };
