#!/usr/bin/env node
// 顔の枠の配置の確かめ（CAST、オーナー 2026-10-01「NPC の顔、顔ウインドウの真ん中に置かれて上に空白ができる。主人公や仲間と同じ大きさの配置に」）
//   - 顔のある人（主人公・仲間・物語の主な人）すべて × 表情 5 つ × 枠の大きさ（会話 118・店 / ハブ 52〜72・100）で
//     R.Portrait.faceLayout の頭の上の空き（top）と顔の倍率（scale）が仲間の基準（中央値）から外れない
//   - 実際に描いた画素: 枠の上の帯（上 10%）に絵がある（空きの帯ができていない）・枠の下まで絵が届く
//   - 会話の窓（K.say）の顔の枠も同じ配置で描かれる
//   node v2/tools/test_faces_browser.js（ビルドが先）
'use strict';
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

(async () => {
  const S = await B.start();
  try {
    const P = await B.open(S, 'dev.html?scene=uik_talk');
    const pg = P.page;
    const res = await pg.evaluate(`(async () => {
      const R = RPG; R.DB.config.slice = false;
      const looks = Object.keys(R.DB.looks).filter((l) => R.UIK.hasFace(l));
      const comps = Object.keys(R.DB.companions || {}).map((id) => R.DB.companions[id].look || id);
      for (const l of looks) R.Portrait.warm(l);
      const SIZES = [118, 100, 72, 52];
      const out = { looks, comps, lay: {}, px: {} };
      for (const l of looks) {
        out.lay[l] = {};
        for (const e of R.Portrait.EXPRS) for (const n of SIZES) {
          const L = R.Portrait.faceLayout(l, { x: 0, y: 0, w: n, h: n }, { expr: e });
          out.lay[l][e + n] = L ? { top: L.top / n, scale: L.scale } : null;
        }
        // 描いた画素（透明の canvas に 118 の枠で）
        const k = R.SCALE || 2, n = 118, c = document.createElement('canvas'); c.width = c.height = n * k;
        const g = c.getContext('2d'); g.scale(k, k);
        R.Portrait.draw(g, l, { x: 0, y: 0, w: n, h: n }, { expr: 'neutral' });
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let first = -1, last = -1;
        for (let y = 0; y < c.height; y++) { let any = false; for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 24) { any = true; break; } if (any) { if (first < 0) first = y; last = y; } }
        out.px[l] = { first: first / c.height, last: last / c.height };
      }
      // 会話の窓
      R.UIK.Message.say({ name: 'X', face: 'berna:smile', text: 'テスト' });
      await new Promise((r) => setTimeout(r, 300));
      const st = R.UIK.Message.state();
      out.msgFace = st && st.face;
      out.msgLay = st && st.face && R.Portrait.faceLayout('berna', st.face, { expr: 'smile' });
      R.UIK.Message.close();
      return out;
    })()`);

    section('顔の枠の配置（仲間の基準と同じ）');
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
    const SIZES = [118, 100, 72, 52];
    const bad = [];
    for (const n of SIZES) {
      const ct = med(res.comps.map((l) => res.lay[l] && res.lay[l]['neutral' + n] && res.lay[l]['neutral' + n].top).filter((v) => v != null));
      const cs = med(res.comps.map((l) => res.lay[l] && res.lay[l]['neutral' + n] && res.lay[l]['neutral' + n].scale).filter((v) => v != null));
      for (const l of res.looks) for (const e of ['neutral', 'smile', 'sad', 'angry', 'surprise']) {
        const v = res.lay[l][e + n];
        if (!v) { bad.push([l, e, n, 'none']); continue; }
        if (Math.abs(v.top - ct) > 0.03 || Math.abs(v.scale / cs - 1) > 0.05 || v.top > 0.08) bad.push([l, e, n, +v.top.toFixed(3), +v.scale.toFixed(3), 'std', +ct.toFixed(3), +cs.toFixed(3)]);
      }
    }
    ok(`顔のある ${res.looks.length} 人 × 表情 5 × 枠 4: 頭の上の空き ±3%・倍率 ±5% が仲間の基準どおり`, res.looks.length >= 40 && bad.length === 0, bad.slice(0, 12));
    const scales = res.looks.map((l) => res.lay[l].neutral118.scale);
    ok('会話の枠で顔の高さが枠の 1 倍以上（枠を埋める、小さく浮かない）', scales.every((s) => s >= 0.98), Math.min(...scales));
    const px = Object.entries(res.px).filter(([, v]) => !(v.first <= 0.1 && v.last >= 0.97));
    ok('描いた画素: 上 10% の内に頭・下の縁まで絵がある（上に空きの帯なし）', px.length === 0, px.slice(0, 8));
    ok('会話の窓の顔も同じ配置（頭の上の空き 8% 以内）', res.msgFace && res.msgLay && res.msgLay.top / res.msgFace.h <= 0.08 && res.msgLay.scale >= 0.98, { f: res.msgFace, L: res.msgLay });
    ok('エラーなし', P.errors.length === 0, P.errors.slice(0, 3));
  } finally {
    await B.stop(S);
  }
  done();
})().catch((e) => { console.error(e); process.exit(1); });
