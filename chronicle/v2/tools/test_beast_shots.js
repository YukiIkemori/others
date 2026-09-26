// BEAST の一覧表とスクショ（V2_PLAN §4.4 の BEAST の行）。撮った PNG は必ず Read で見る（§2.9）。
//
//   node v2/tools/build.js && node v2/tools/test_beast_shots.js            全部 → v2/design/shots/beast/
//   node v2/tools/test_beast_shots.js --only mons,frames,golden,boss,bbg,stage,phone
//   node v2/tools/test_beast_shots.js --ids jelly_1,wolf_1 --only frames
//
// 1:1 は 1 art px = 2 device px（1920×1080 の画面と同じ）、×4 の拡大は frames・boss_zoom。
// 光: R.Light.compose が本物（RENDER）ならそれ、仮の実装のときは R.Beast.stageLight（bbg/kit.js の控え）で夜にする。
'use strict';
const path = require('path');
const fs = require('fs');
const Bw = require('./lib/browser');

const OUT = path.join(Bw.V2, 'design', 'shots', 'beast');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const only = (opt('only') || 'mons,frames,golden,boss,bbg,stage,phone').split(',');
const ids = opt('ids') ? opt('ids').split(',') : null;

// ---------------------------------------------------------------- ページの中で動く描き方
function pageLib() {
  const R = window.RPG, BZ = R.Beast;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const MOOD_FALLBACK = {
    night: { ambient: 'rgb(92,84,150)', ground: ['#1c1a30', '#2c2840'] },
    cave: { ambient: 'rgb(138,120,200)', ground: ['#1a1822', '#2a2632'] },
    forest_night: { ambient: 'rgb(84,96,150)', ground: ['#141c1c', '#1e2a26'] },
    coast: { ambient: 'rgb(96,100,168)', ground: ['#1c2030', '#2a3040'] },
    tree: { ambient: 'rgb(100,110,160)', ground: ['#18201a', '#26302a'] },
    tower: { ambient: 'rgb(110,96,160)', ground: ['#201c26', '#302a36'] },
  };
  const realLight = () => !((R.Stubs.installed.Light || []).includes('compose'));
  const realMood = () => !((R.Stubs.installed.Hd || []).includes('mood'));
  function ambientOf(mood) {
    if (realMood()) { const m = R.Hd.mood(mood); if (m && m.ambient) return m.ambient; }
    return (MOOD_FALLBACK[mood] || MOOD_FALLBACK.night).ambient;
  }
  function frame(g, sh, i, x, y, o) { R.Hd.draw(g, sh.frames[i], x, y, o || {}); }
  function shadow(g, x, y, w) {
    g.save(); g.translate(x, y); g.scale(1, 0.28);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
    gr.addColorStop(0, 'rgba(10,8,22,0.55)'); gr.addColorStop(1, 'rgba(10,8,22,0)');
    g.fillStyle = gr; g.fillRect(-w, -w, w * 2, w * 2); g.restore();
  }
  // 夜の光の見本: 各マスの右（味方の側）にランタンの光だまり。R.Light.compose が本物ならそれ
  function light(g, rect, mood, pools) {
    const amb = ambientOf(mood);
    const lights = pools.map(([x, y]) => ({ x, y, r: 120, color: 'rgb(255,205,140)', k: 0.8, sy: 0.55 }));
    if (realLight()) return R.Light.compose(g, rect, { ambient: amb, k: 1, lights, mood });
    if (BZ.stageLight) return BZ.stageLight(g, rect, { ambient: amb, top: rect.y, feather: 1, lights });
  }
  function label(g, s, x, y, o) {
    o = o || {};
    g.save(); g.font = `${o.size || 9}px sans-serif`; g.textAlign = o.align || 'center'; g.fillStyle = o.color || '#d8d2c4'; g.fillText(s, x, y); g.restore();
  }
  // 1:1（論理 W×H を ×2 で出す）
  function show(c, k) {
    k = k || 2;
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
    const v = mk(c.width * k, c.height * k), x = v.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, v.width, v.height);
    v.style.cssText = 'display:block;image-rendering:pixelated';
    document.body.appendChild(v);
    return [v.width, v.height];
  }
  return { mk, frame, shadow, light, label, show, ambientOf, realLight, realMood, MOOD_FALLBACK };
}

// ---------------------------------------------------------------- 一覧表
async function monsSheet(P, list, mood, file, title) {
  const r = await P.page.evaluate(([list, mood, title, lib]) => {
    const L = eval('(' + lib + ')')();
    const R = window.RPG;
    const W = 960, H = 540, c = L.mk(W, H), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    const G = (L.MOOD_FALLBACK[mood] || L.MOOD_FALLBACK.night).ground;
    gr.addColorStop(0, mood ? '#3c4250' : '#5a6070'); gr.addColorStop(1, mood ? '#50525a' : '#6a7080');
    g.fillStyle = mood ? '#8a8272' : '#646a78'; g.fillRect(0, 0, W, H);
    if (!mood) { g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    const cols = Math.min(list.length > 4 && list.some((id) => /boss/.test(id)) ? 3 : 6, list.length), rows = Math.ceil(list.length / cols);
    const cw = W / cols, ch = (H - 20) / rows;
    const info = [];
    list.forEach((id, i) => {
      const key = id.startsWith('hd:') ? id : 'hd:mon:' + id;
      const sh = R.Hd.now(key, {});
      const cx = (i % cols) * cw + cw / 2, fy = 20 + Math.floor(i / cols) * ch + ch - 22;
      if (!sh) { L.label(g, 'なし ' + id, cx, fy); return; }
      L.shadow(g, cx, fy, Math.max(30, sh.w));
      L.frame(g, sh, 0, cx, fy);
      info.push([id, sh.w, sh.h, sh.meta.bakeMs]);
    });
    if (mood) L.light(g, { x: 0, y: 0, w: W, h: H }, mood, list.map((id, i) => [(i % cols) * cw + cw * 0.78, 20 + Math.floor(i / cols) * ch + ch - 26]));
    list.forEach((id, i) => {
      const cx = (i % cols) * cw + cw / 2, fy = 20 + Math.floor(i / cols) * ch + ch - 22;
      const sh = R.Hd.now(id.startsWith('hd:') ? id : 'hd:mon:' + id, {});
      L.label(g, id + (sh ? `  ${sh.meta.visH || sh.h}px` : ''), cx, fy + 14);
    });
    L.label(g, title + (mood ? '  mood=' + mood + (L.realMood() ? '' : '（控えの色）') : '  光なし'), 8, 13, { align: 'left', size: 10 });
    L.show(c, 2);
    return info;
  }, [list, mood, title, pageLib.toString()]);
  await Bw.shot(P.page, file);
  return r;
}

async function framesSheet(P, keys, file, zoom, optsList) {
  return P.page.evaluate(([keys, zoom, optsList, lib]) => {
    const L = eval('(' + lib + ')')();
    const R = window.RPG;
    const sheets = [];
    keys.forEach((k, i) => (optsList || [{}]).forEach((o) => sheets.push([k, o, R.Hd.now(k, o)])));
    const maxF = Math.max(...sheets.map((s) => (s[2] ? s[2].frames.length : 1)));
    const cellW = Math.max(...sheets.map((s) => (s[2] ? Math.max(...s[2].frames.map((f) => f.c.width)) : 40))) + 12;
    const cellH = Math.max(...sheets.map((s) => (s[2] ? Math.max(...s[2].frames.map((f) => f.c.height)) : 40))) + 16;
    zoom = Math.max(1, Math.min(zoom, Math.floor(1920 / (maxF * cellW + 12)), Math.floor(1080 / (sheets.length * cellH + 8))));
    const W = Math.ceil(1920 / zoom), H = Math.ceil(1080 / zoom);
    const c = L.mk(W, H), g = c.getContext('2d');
    g.fillStyle = '#646a78'; g.fillRect(0, 0, W, H);
    sheets.forEach(([k, o, sh], r) => {
      if (!sh) return;
      const names = {};
      for (const p of Object.keys(sh.poses)) sh.poses[p].forEach((fi, j) => (names[fi] = p + (sh.poses[p].length > 1 ? j : '')));
      sh.frames.forEach((f, i) => {
        const x = 6 + i * cellW + cellW / 2, y = 4 + r * cellH + cellH - 12;
        L.frame(g, sh, i, x, y);
        const a = f.anchors || {};
        const dot = (p, col) => { if (p) { g.fillStyle = col; g.fillRect(Math.round(x + p.x), Math.round(y + p.y), 1, 1); } };
        dot(a.head, '#ff4060'); dot(a.center, '#40ff80'); dot(a.fx, '#40c0ff'); dot({ x: 0, y: 0 }, '#ffff40');
        g.save(); g.font = '6px sans-serif'; g.fillStyle = '#e8e4d8'; g.textAlign = 'center'; g.fillText(names[i] || '', x, y + 9); g.restore();
      });
      g.save(); g.font = '6px sans-serif'; g.fillStyle = '#fff'; g.fillText(k.replace('hd:', '') + (o.golden ? ' 金' : ''), 4, 4 + r * cellH + 8); g.restore();
    });
    L.show(c, zoom);
    return zoom;
  }, [keys, zoom, optsList || null, pageLib.toString()]).then((z) => Bw.shot(P.page, file).then(() => z));
}

// 戦闘背景に 4 人と敵を置いた見本（MODERN_UI §2.3 の配置）
async function stageShot(P, bbg, foes, file, o) {
  o = o || {};
  const r = await P.page.evaluate(([bbg, foes, o, lib]) => {
    const L = eval('(' + lib + ')')();
    const R = window.RPG, BZ = R.Beast;
    const W = R.W, H = R.H;
    const sh = R.Hd.now('hd:bbg:' + bbg, { w: W, h: H });
    const c = L.mk(W, H), g = c.getContext('2d');
    const t0 = performance.now();
    const res = BZ.stage(g, sh, { foes, layout: R.layout, W, H, frame: o.frame || 0, t: o.t || 0 });
    return { ms: performance.now() - t0, bake: sh && sh.meta.bakeMs, size: L.show(c, R.SCALE), res };
  }, [bbg, foes, o, pageLib.toString()]);
  await Bw.shot(P.page, file);
  return r;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const S = await Bw.start();
  const shots = [];
  try {
    const P = await Bw.open(S, 'dev.html');
    await P.page.evaluate(() => { RPG.Engine.stop && RPG.Engine.stop(); });
    const BZ = await P.page.evaluate(() => ({ slice: RPG.Beast.SLICE_MONS, rare: RPG.Beast.RARE_IDS || [], bosses: RPG.Beast.BOSS_KEYS || [], bbg: RPG.Beast.BBG_IDS || [] }));
    const mons = ids || BZ.slice;
    const small = mons.filter((id) => /^(jelly|rat|bat|bee|mushroom|fairy)_/.test(id));
    const big = mons.filter((id) => !small.includes(id));
    if (only.includes('mons')) {
      for (const mood of [null, 'night', 'cave', 'forest_night']) {
        const tag = mood || 'plain';
        if (small.length) { const f = path.join(OUT, `mons_s_${tag}.png`); console.log(f, JSON.stringify(await monsSheet(P, small, mood, f, 'S の土台 × 段'))); shots.push(f); }
        if (big.length) { const f = path.join(OUT, `mons_ml_${tag}.png`); console.log(f, JSON.stringify(await monsSheet(P, big, mood, f, 'M・L の土台 × 段'))); shots.push(f); }
      }
      if (BZ.rare.length) { const f = path.join(OUT, 'mons_rare_night.png'); console.log(f, JSON.stringify(await monsSheet(P, BZ.rare, 'night', f, 'レア 3'))); shots.push(f); }
    }
    if (only.includes('frames')) {
      const list = mons.map((id) => 'hd:mon:' + id);
      for (let i = 0; i < list.length; i += 2) {
        const f = path.join(OUT, `frames_${list[i].split(':').pop()}.png`);
        console.log(f, 'zoom', await framesSheet(P, list.slice(i, i + 2), f, 4)); shots.push(f);
      }
      if (BZ.rare.length) { const f = path.join(OUT, 'frames_x4_rare.png'); await framesSheet(P, BZ.rare, f, 4); shots.push(f); }
    }
    if (only.includes('golden')) {
      const f = path.join(OUT, 'golden_x2.png');
      await framesSheet(P, ['hd:mon:wolf_1', 'hd:mon:jelly_1', 'hd:mon:bee_1'], f, 2, [{}, { golden: true }]); shots.push(f);
    }
    if (only.includes('boss') && BZ.bosses.length) {
      for (let i = 0; i < BZ.bosses.length; i += 1) {
        const f = path.join(OUT, `boss_${BZ.bosses[i].split(':').pop()}_x2.png`);
        await framesSheet(P, [BZ.bosses[i]], f, 2); shots.push(f);
      }
      const f = path.join(OUT, 'boss_all_night.png');
      console.log(f, JSON.stringify(await monsSheet(P, BZ.bosses, 'night', f, 'ボス（待機）'))); shots.push(f);
    }
    const STAGES = { coast: ['jelly_1', 'crab_1', 'seabird_1'], tower: ['boss:boss_pageeater'], forest: ['wolf_1', 'plant_1', 'bee_1'], tree: ['mon:b_root', 'boss:boss_rooteater', 'mon:b_root'], cave: ['bat_1', 'rat_2', 'crab_2'] };
    if (only.includes('bbg') && BZ.bbg.length) {
      for (const id of BZ.bbg) {
        const f = path.join(OUT, `bbg_${id}_1920.png`);
        console.log(f, JSON.stringify(await stageShot(P, id, STAGES[id] || [], f))); shots.push(f);
      }
    }
    if (only.includes('stage') && BZ.bbg.length) {
      const f = path.join(OUT, 'stage_forest_wolflord_1920.png');
      console.log(f, JSON.stringify(await stageShot(P, 'forest', ['wolf_1', 'boss:boss_wolflord', 'wolf_1'], f))); shots.push(f);
      const f2 = path.join(OUT, 'stage_tower_moth_1920.png');
      console.log(f2, JSON.stringify(await stageShot(P, 'tower', ['boss:boss_moth'], f2, { frame: 'tele' }))); shots.push(f2);
    }
    await P.close();
    if (only.includes('phone') && BZ.bbg.length) {
      const PP = await Bw.open(S, 'dev.html', { phone: true });
      await PP.page.evaluate(() => { RPG.Engine.stop && RPG.Engine.stop(); });
      const f = path.join(OUT, 'bbg_forest_phone.png');
      console.log(f, JSON.stringify(await stageShot(PP, 'forest', ['wolf_1', 'plant_2', 'fairy_1'], f))); shots.push(f);
      if (PP.errors.length) console.log('phone errors', PP.errors);
      await PP.close();
    }
    if (P.errors.length) { console.log('ERRORS', P.errors); process.exitCode = 1; }
  } finally { await Bw.stop(S); }
  console.log('shots:\n  ' + shots.map((f) => path.relative(path.join(Bw.V2, '..'), f)).join('\n  '));
}
main().catch((e) => { console.error(e); process.exit(1); });
