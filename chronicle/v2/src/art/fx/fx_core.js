// BSCENE: 戦闘の効果の絵（hd:bfx:<id>）。右向きで描き、呼ぶ側が反転する（§2.5.7）。
// 効果は「コマ数・大きさ・描き方 draw(ctx, k, i, rng, w, h)」の表（R.BFX.defs）で、R.Hd に登録して焼く（同じキーで同じ画素、種はキー）。
// 焼けていないとき（列で待ち）・R.Hd が無いときは、同じ draw をその場で描く（見た目は同じ）。
//   R.BFX.add(id, def)   def = {n, w, h, fps, blend:'lighter'|'source-over', draw}
//   R.BFX.draw(g, id, x, y, t, o)   t = 始まってからの ms、o = {flip, scale, alpha} → まだ続くなら true
//   R.BFX.dur(id) → ms
(function (R) {
  'use strict';
  const BFX = (R.BFX = R.BFX || {});
  BFX.defs = BFX.defs || {};
  BFX.add = function (id, def) {
    BFX.defs[id] = Object.assign({ n: 8, w: 96, h: 96, fps: 24, blend: 'lighter' }, def);
  };
  BFX.key = (id) => 'hd:bfx:' + id;
  BFX.dur = function (id) { const d = BFX.defs[id]; return d ? d.n / d.fps * 1000 : 0; };

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  /** 焼く（factory）。1 art px = 1 論理 px。描く点はコマの中央 */
  BFX.bake = function (id) {
    const d = BFX.defs[id];
    if (!d || typeof document === 'undefined') return null;
    const frames = [];
    for (let i = 0; i < d.n; i++) {
      const c = canvas(d.w, d.h);
      const g = c.getContext('2d');
      g.translate(d.w / 2, d.h / 2);
      try { d.draw(g, d.n > 1 ? i / (d.n - 1) : 1, i, R.rng('bfx:' + id + ':' + i), d.w, d.h); } catch (e) { console.error('[bfx]', id, e); }
      frames.push({ c, ox: d.w / 2, oy: d.h / 2 });
    }
    const all = frames.map((f, i) => i);
    return { frames, poses: { play: all }, fps: { play: d.fps }, anchors: { center: [0, 0] }, w: d.w, h: d.h, meta: { blend: d.blend } };
  };

  /** 効果を 1 コマ描く → まだ続くなら true */
  BFX.draw = function (g, id, x, y, t, o) {
    const d = BFX.defs[id];
    if (!d) return false;
    o = o || {};
    const i = Math.floor(Math.max(0, t) / 1000 * d.fps);
    if (i >= d.n) return false;
    const sc = o.scale || 1;
    g.save();
    g.globalCompositeOperation = d.blend;
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    const key = BFX.key(id);
    const sh = R.Hd && R.Hd.has && R.Hd.has(key) ? R.Hd.get(key) : null;
    if (sh && sh.frames && sh.frames[i] && sc === 1) {
      R.Hd.draw(g, sh.frames[i], x, y, { flip: !!o.flip });
    } else {
      g.translate(Math.round(x), Math.round(y));
      if (o.flip) g.scale(-1, 1);
      if (sc !== 1) g.scale(sc, sc);
      d.draw(g, d.n > 1 ? i / (d.n - 1) : 1, i, R.rng('bfx:' + id + ':' + i), d.w, d.h);
    }
    g.restore();
    return true;
  };

  // 全部の効果を R.Hd に登録（データの後処理の時。R.Hd は仮の実装か RENDER の本物）
  R.onData(function () {
    if (!R.Hd || typeof R.Hd.def !== 'function') return;
    for (const id of Object.keys(BFX.defs)) {
      const key = BFX.key(id);
      if (R.Hd.has && R.Hd.has(key)) continue;
      R.Hd.def(key, () => BFX.bake(id), { kind: 'fx', frames: BFX.defs[id].n });
    }
  });

  // ---------------------------------------------------------------- 描く道具（効果のファイルが使う）
  const U = (BFX.u = {});
  U.glowDot = function (g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  U.star = function (g, x, y, r, n, rgb, a, rot) {
    g.fillStyle = `rgba(${rgb},${a})`;
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const ang = (rot || 0) + i * Math.PI / n, rr = i % 2 ? r * 0.28 : r;
      g[i ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    g.closePath(); g.fill();
  };
  U.easeOut = (k) => 1 - (1 - k) * (1 - k);
  U.bell = (k) => Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
  // 属性の色（rgb の文字）
  BFX.ELEM = {
    fire: ['255,150,60', '255,230,160'], ice: ['120,200,255', '230,250,255'], thunder: ['255,230,110', '255,255,230'],
    wind: ['130,230,170', '230,255,240'], earth: ['200,150,90', '250,220,170'], light: ['255,236,170', '255,255,240'],
    dark: ['160,110,230', '230,200,255'], heal: ['140,240,140', '230,255,220'], mp: ['120,170,255', '220,235,255'],
  };
})(window.RPG);
