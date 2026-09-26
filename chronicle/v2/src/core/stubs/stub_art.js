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
  // 最初の素材・物の id の一覧（P0 のレビュー、版 2）。CONTENT はこの id で書き始めてよい。TERRAIN は P1 の 1 日目に同じ id で本物を登録し、
  // 足りない・名前を変えたい物は requests.jsonl で知らせる（名前を消すのは P2 の後）。walk:false は水・壁の類
  const MATS = {
    // 床・地面
    grass: 1, moss_earth: 1, dirt: 1, road: 1, cobble: 1, sand: 1, plank: 1, deck: 1, bridge: 1, ladder: 1, stone_floor: 1, wood_floor: 1,
    carpet: 1, cave_floor: 1, bark_floor: 1, root_floor: 1, flowers: 1, tall_grass: 1, pier: 1,
    // 壁・崖・木（solid は legend の側で付ける）
    rock: 0, cliff: 0, wall_stone: 0, wall_brick: 0, wall_wood: 0, wall_moss: 0, wall_bark: 0, wall_cave: 0, tree: 0, forest_dark: 0, bush: 0, roots: 0,
    // 水
    water: 0, sea: 0, deep_water: 0, shallow: 1,
  };
  for (const id of Object.keys(MATS)) R.Stubs.defineData('materials', id, { name: id, edge: /^wall_|cliff|rock/.test(id) ? 'hard' : 'soft', walk: !!MATS[id] });
  const PROPS = {
    barrel: { soft: false, solid: true }, crate: { solid: true }, sack: { soft: true }, bench: { soft: true }, chair: { soft: true }, table: { solid: true },
    bed: { solid: true }, bookshelf: { solid: true }, counter: { solid: true }, stove: { solid: true, light: true }, lamp_post: { solid: true, light: true, glow: true },
    lantern: { soft: true, light: true, glow: true }, fence: { solid: true }, flower_pot: { soft: true }, well: { solid: true }, signboard: { solid: true },
    rock_small: { soft: true }, stump: { solid: true }, log: { solid: true }, mushroom_glow: { soft: true, glow: true }, firefly: { soft: true, glow: true },
    rope_bridge: { overChars: true }, leaves_over: { overChars: true },
    // 仕掛けの物（map.objects の type から FIELD が使う。絵は TERRAIN）
    chest: { solid: true, frames: ['closed', 'open', 'rare_closed', 'rare_open'] }, spring: { solid: true, light: true, glow: true, footprint: [2, 2] },
    brazier: { solid: true, frames: ['off', 'on'], light: true }, waylamp: { solid: true, frames: ['off', 'on'], light: true }, switch: { soft: true, frames: ['off', 'on'] },
    songstone: { solid: true, glow: true }, footprint: { soft: true, glow: true }, beacon: { light: true, glow: true }, stairs_up: {}, stairs_down: {}, door: {},
  };
  for (const id of Object.keys(PROPS)) R.Stubs.defineData('props', id, PROPS[id]);

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
