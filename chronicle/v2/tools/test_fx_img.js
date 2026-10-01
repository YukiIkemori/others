#!/usr/bin/env node
// 画像の効果の部品（assets/fx、src/art/fx/fx_seq_img.js）のテスト。ビルドは先に: node v2/tools/build.js
//   1. 部品のファイル: 表（tools/vfx/vfx_parts.json）の部品がそろい、帯の大きさが meta と合い、付随の情報（EXIF・XMP）が無い
//   2. ビルド: dist の RPG_MEDIA.fx に全部の部品が入る（地方に縛られない）
//   3. ブラウザ: 全部の技・術を画像つきで描いてエラーが無く、画像の層が実際に描かれ、色を塗った帯が作られる。
//      画像を切る（R.BFX.img.set(false)）と今までの手続きの効果に戻る。古い効果（ふつうの攻撃・回復など）も画像で描く
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const B = require('./lib/browser');

const V2 = path.resolve(__dirname, '..');
const FX = path.join(V2, 'assets', 'fx');
const parts = JSON.parse(fs.readFileSync(path.join(V2, 'tools', 'vfx', 'vfx_parts.json'), 'utf8')).parts;

function webpSize(buf) {
  // RIFF/WEBP: VP8X（幅・高さ 24 bit -1）か VP8L・VP8 の頭
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) { const t = buf.toString('latin1', i, i + 4), n = buf.readUInt32LE(i + 4); chunks.push(t); i += 8 + n + (n & 1); }
  let w = 0, h = 0;
  if (buf.toString('latin1', 12, 16) === 'VP8X') { w = 1 + buf.readUIntLE(24, 3); h = 1 + buf.readUIntLE(27, 3); }
  return { w, h, chunks };
}

(async () => {
  section('部品のファイル');
  const have = fs.existsSync(FX) ? fs.readdirSync(FX).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)) : [];
  const missing = parts.map((p) => p.id).filter((id) => !have.includes(id));
  ok('every part in vfx_parts.json has a strip in assets/fx', !missing.length, missing);
  ok('at least 40 parts', have.length >= 40, have.length);
  const bad = [], meta = [];
  for (const id of have) {
    const js = path.join(FX, id + '.json');
    if (!fs.existsSync(js)) { meta.push(id + ': no json'); continue; }
    const m = JSON.parse(fs.readFileSync(js, 'utf8'));
    const s = webpSize(fs.readFileSync(path.join(FX, id + '.webp')));
    if (!(m.n >= 1 && m.w > 0 && m.h > 0 && m.fps > 0 && Array.isArray(m.anchor))) meta.push(id + ': bad meta');
    if (s.w && (s.w !== m.n * m.w || s.h !== m.h)) meta.push(`${id}: ${s.w}x${s.h} vs ${m.n}x${m.w}x${m.h}`);
    if (s.chunks.some((c) => c === 'EXIF' || c === 'XMP ' || c === 'ICCP')) bad.push(id + ': ' + s.chunks.join(','));
    if (m.peak != null && !(m.peak >= 0 && m.peak < m.n)) meta.push(id + ': peak');
  }
  ok('strips match their meta (frames × size, peak in range)', !meta.length, meta);
  ok('no metadata chunks in the WebP strips', !bad.length, bad);
  const words = /gpt|dall-?e|openai|midjourney|stable.?diffusion/i;
  const named = have.filter((id) => words.test(fs.readFileSync(path.join(FX, id + '.json'), 'utf8')));
  ok('no tool or model names in the meta', !named.length, named);

  section('ビルド');
  const html = fs.readFileSync(path.join(V2, 'dist', 'index.html'), 'utf8');
  const mm = /window\.RPG_MEDIA=(.*?);<\/script>/s.exec(html);
  const media = mm ? JSON.parse(mm[1]) : {};
  const inDist = Object.keys(media.fx || {});
  ok('dist RPG_MEDIA.fx lists every part', have.every((id) => inDist.includes(id)), have.filter((id) => !inDist.includes(id)));
  ok('the fx files are copied next to dist', inDist.every((id) => fs.existsSync(path.join(V2, 'dist', media.fx[id].url.split('?')[0]))));

  section('ブラウザ');
  const S = await B.start();
  const P = await B.open(S, 'dev.html?fixture=core_stub_road');
  const p = P.page;
  await B.waitFor(p, `${B.TOP}==='field'`, 20000);
  const r = await p.evaluate(async () => {
    const I = RPG.BFX.img, Sq = RPG.BFX.seq;
    const ids = Object.keys(RPG_MEDIA.fx || {});
    const t0 = performance.now();
    await I.preload(ids);
    const loadMs = performance.now() - t0;
    const loaded = ids.filter((id) => I.ready(id)).length;
    // 描いた数を数える（drawImage を包む）
    const c = document.createElement('canvas'); c.width = 960; c.height = 540;
    const g = c.getContext('2d');
    let draws = 0;
    const di = g.drawImage.bind(g);
    g.drawImage = function () { draws++; return di.apply(null, arguments); };
    Sq.strict = true;
    Sq.cache = {};
    const errs = [], noImg = [];
    let frames = 0, imgLayers = 0;
    const tgts = [{ x: 260, y: 330, fy: 380, h: 64 }, { x: 320, y: 340, fy: 390, h: 50 }];
    for (const key of Object.keys(Sq.table)) {
      const sid = 'sq:' + key, sp = Sq.get(sid);
      const n = sp.main.concat(sp.hit).filter((L) => L.p === 'img').length;
      imgLayers += n;
      if (!n && !(sp.imgParts || []).length) noImg.push(key);
      for (const dir of [-1, 1]) {
        const cx = Sq.ctx({ src: { x: dir < 0 ? 700 : 200, y: 330, fy: 380, h: 60 }, tgts: dir < 0 ? tgts : [{ x: 700, y: 330, fy: 380, h: 60 }], dir, W: 960, H: 540, name: key, seed: 7 });
        for (const part of ['main', 'hit']) {
          const dur = part === 'main' ? sp.dur : sp.hitDur;
          for (let t = 0; t <= dur + 40; t += 50) {
            try { Sq.draw(g, { seq: sid, part, c: cx, rate: 1 }, t); frames++; } catch (e) { errs.push(key + ':' + part + ':' + t + ':' + e.message); }
          }
        }
      }
    }
    // 長さの決まり（段 1 は 0.75 秒、当たりは 0.8 秒まで）は画像を足しても守る
    const long = Object.keys(Sq.table).map((k) => Sq.get('sq:' + k)).filter((s) => s.hitDur > 800 || (s.tier === 1 && (s.dur > 750 || s.hitDur > 750))).map((s) => s.id);
    const st = I.stats();
    // 古い効果
    const legacy = {};
    for (const id of ['slash', 'smash', 'thrust', 'shoot', 'claw', 'bite', 'hit', 'crit', 'fire', 'ice', 'thunder', 'wind', 'earth', 'light', 'dark', 'heal', 'mp', 'revive', 'buff', 'debuff', 'status', 'summon', 'smoke', 'cast']) {
      const d0 = draws;
      let alive = 0;
      for (let t = 0; t < 400; t += 40) if (RPG.BFX.draw(g, id, 300, 300, t, { flip: true })) alive++;
      legacy[id] = { draws: draws - d0, alive };
    }
    // 画像を切ると今までどおり
    I.set(false);
    const off = Sq.get('sq:t_sword_stepcut');
    const offOk = !off.main.concat(off.hit).some((L) => L.p === 'img' || L.p === 'imgdim');
    I.set(true);
    const on = Sq.get('sq:t_sword_stepcut');
    const onOk = on.main.concat(on.hit).some((L) => L.p === 'img');
    Sq.strict = false;
    // 1 コマの描画の時間: 画像の層の多い見せ場（色を塗った帯は作り済み）
    const sp6 = Sq.get('sq:s_fire_wind_earth'), cx6 = Sq.ctx({ tgts, W: 960, H: 540, seed: 3 });
    const ms = [];
    for (let t = 0; t < sp6.dur; t += 33) { const a = performance.now(); Sq.draw(g, { seq: 'sq:s_fire_wind_earth', part: 'main', c: cx6, rate: 1 }, t); g.getImageData(0, 0, 1, 1); ms.push(performance.now() - a); }
    ms.sort((a, b) => a - b);
    return { ids: ids.length, loaded, loadMs, draws, errs: errs.slice(0, 5), nerr: errs.length, frames, imgLayers, noImg, long, st, legacy, offOk, onOk, med: ms[ms.length >> 1], max: ms[ms.length - 1] };
  });
  ok('every part loads and decodes in the page', r.loaded === r.ids, [r.loaded, r.ids]);
  console.log(`  load+decode all ${r.ids} parts: ${Math.round(r.loadMs)} ms`);
  ok('every tech / spell / action row draws with images on, both directions, no errors', !r.nerr, r.errs);
  ok('frames drawn', r.frames > 5000, r.frames);
  ok('image layers are used across the table (≥ 600)', r.imgLayers >= 600, r.imgLayers);
  ok('every row uses at least one image part', !r.noImg.length, r.noImg);
  ok('image layers keep the length rules (tier 1 ≤ 0.75 s, hits ≤ 0.8 s)', !r.long.length, r.long);
  ok('tinted strips are made and kept under the cap', r.st.tints > 0 && r.st.tintMPx <= 24, r.st);
  const legBad = Object.entries(r.legacy).filter(([, v]) => !v.draws || !v.alive).map(([k]) => k);
  ok('old effects (plain attack, enemy attack, heal, status …) draw with images', !legBad.length, legBad);
  ok('R.BFX.img.set(false) returns to the code effects', r.offOk && r.onOk);
  console.log(`  tier-6 set piece frame (2d canvas, this machine): median ${r.med.toFixed(1)} ms, max ${r.max.toFixed(1)} ms`);
  ok('page errors', !P.errors.length, P.errors.slice(0, 3));
  await B.stop(S);
  done('test_fx_img');
})().catch((e) => { console.error(e); process.exit(1); });
