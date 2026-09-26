// 仮の実装: TERRAIN（R.Terrain）と CAST の顔絵の口（R.Portrait）。本物は src/art/terrain/*・src/art/cast/portrait.js。
// V2_PLAN §2.5.8・§2.5.16。絵は色の箱（仮の箱は dev でも index でも見える。P3 の check_stubs で 0 にする）
(function (R) {
  'use strict';
  /** 素材の id → 仮の色（夜の色。純粋な黒は使わない） */
  const FIXED = { stub_grass: '#2c3b4a', stub_road: '#5a5470', stub_tree: '#1a2233', stub_water: '#1d2d5c' };
  function matColor(mat, solid) {
    if (FIXED[mat]) return FIXED[mat];
    const h = R.U.hash(mat || 'x');
    const hue = 200 + (h % 90), sat = 18 + (h >> 8) % 20, lit = solid ? 14 + (h >> 16) % 8 : 22 + (h >> 16) % 12;
    return `hsl(${hue},${sat}%,${lit}%)`;
  }

  // 素材と物の一覧（版 2: R.DB.materials・R.DB.props。TERRAIN の本物が同じ id を登録したら使われない）
  for (const id of Object.keys(FIXED)) R.Stubs.defineData('materials', id, { name: id, edge: 'soft', walk: id !== 'stub_tree' && id !== 'stub_water' });

  R.Stubs.define('Terrain', {
    CHUNK: 8,
    matColor,
    bakeChunk(map, cx, cy, o) {
      const job = { done: false, result: null, step() { job.done = true; job.result = { base: null, over: null, lights: [], glows: [], props: [] }; return true; } };
      return job;
    },
    dirty() {},
    prewarm() { return { done: true, result: null, step() { return true; } }; },
    building(def) { return 'hd:bld:' + R.U.hash(JSON.stringify(def || {})).toString(36); },
    material(id) {
      return {
        bake(ctx, rect) { ctx.fillStyle = matColor(id); ctx.fillRect(rect.x, rect.y, rect.w, rect.h); },
        edge: 'soft', walk: true,
      };
    },
    ambient(map, tier) {
      const l = (map && map.light) || {};
      return { ambient: l.ambient || '#5c5aa0', k: l.k != null ? l.k : 0.45, mood: l.mood || 'night' };
    },
    worldThumb() { return null; },
  });

  const EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise'];
  R.Stubs.define('Portrait', {
    key(look, expr) { return `portrait:${look}:${expr || 'neutral'}`; },
    has(look, expr) {
      if (R.Media && R.Media.has('portraits', R.Portrait.key(look, expr))) return 'painted';
      if (R.Hd && R.Hd.has && R.Hd.has('hd:face:' + look)) return 'placeholder';
      return null;
    },
    draw(g, look, rect, o) {
      o = o || {};
      const expr = o.expr || 'neutral';
      let rec = R.Media && R.Media.image(R.Portrait.key(look, expr));
      if (!rec && expr !== 'neutral') rec = R.Media && R.Media.image(R.Portrait.key(look, 'neutral'));
      if (rec && rec.ready) { g.save(); g.imageSmoothingEnabled = true; g.drawImage(rec.img, rect.x, rect.y, rect.w, rect.h); g.restore(); return; }
      const sh = R.Hd && R.Hd.has && R.Hd.has('hd:face:' + look) && R.Hd.get('hd:face:' + look);
      if (sh && sh.poses && sh.poses[expr]) { R.Hd.draw(g, sh.frames[sh.poses[expr][0]], rect.x, rect.y, { alpha: o.dim ? 0.5 : 1 }); return; }
      // 仮の箱（頭と肩の形）
      const cx = rect.x + rect.w / 2;
      g.save();
      g.globalAlpha = o.dim ? 0.5 : 1;
      g.fillStyle = `hsl(${R.U.hash(look) % 360},30%,42%)`;
      g.beginPath(); g.arc(cx, rect.y + rect.h * 0.42, rect.w * 0.2, 0, Math.PI * 2); g.fill();
      g.fillRect(rect.x + rect.w * 0.22, rect.y + rect.h * 0.68, rect.w * 0.56, rect.h * 0.3);
      g.restore();
    },
    parse(s) {
      const [look, expr] = String(s || '').split(':');
      return { look: look || '', expr: EXPRS.includes(expr) ? expr : 'neutral' };
    },
  });
})(window.RPG);
