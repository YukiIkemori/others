// Swap the code-drawn hero ("arun") of the approved UI mocks for the pipeline's sprite sheets.
// Loaded after the mock modules and before main.js (see index.html). The sheets arrive as data URLs in
// window.__HERO (set by tools/preview.js via addInitScript) so canvases stay untainted on file://.
//   ?hero_btl=<frame id>   battle frame for the command view (default idle_a)
//   ?hero_fld=<frame id>   field frame in the town (default walk_left_1)
//   ?hero_light=0          skip the sprite night relight (warm key / blue rim)
'use strict';
(function (G) {
  const H = G.__HERO;
  if (!H) { console.warn('hero_patch: no __HERO'); return; }
  const Q = new URLSearchParams(location.search);
  const LIGHT = Q.get('hero_light') !== '0';
  const ready = Promise.all(['battle', 'field'].map((k) => new Promise((res) => {
    const im = new Image(); im.onload = () => { H[k].img = im; res(); }; im.src = H[k].png;
  })));

  // cut one frame out of a sheet → canvas + anchor in the {canvas, ox, oy} shape RZ.render returns
  function frame(set, id, o) {
    o = o || {};
    const S = H[set], f = S.json.frames[id];
    if (!f) throw new Error('hero_patch: no frame ' + set + '/' + id);
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    const x = c.getContext('2d'); x.drawImage(S.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    if (LIGHT && o.key) relight(c, o);
    return { canvas: c, ox: f.anchor[0], oy: f.anchor[1] };
  }
  // pixel-exact night relight: silhouette pixels facing the key light get a warm lift, pixels on the
  // opposite edge a cold moon rim; the stage's own lightmap (blue ambient × warm pool) goes on top.
  function relight(c, o) {
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height), p = d.data, W = c.width, Hh = c.height;
    const A = (i, j) => (i < 0 || j < 0 || i >= W || j >= Hh) ? 0 : p[(j * W + i) * 4 + 3];
    const src = new Uint8ClampedArray(p);
    const kx = o.key < 0 ? -1 : 1; // key light side
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 4; if (!src[k + 3]) continue;
      const lum = (src[k] * 0.3 + src[k + 1] * 0.59 + src[k + 2] * 0.11);
      let r = src[k], g = src[k + 1], b = src[k + 2];
      // key side edge (1–2 px deep) + top edge
      const keyEdge = !A(i + kx, j) || !A(i + kx * 2, j) ? (!A(i + kx, j) ? 1 : 0.55) : 0;
      const top = !A(i, j - 1) ? 0.5 : 0;
      const kk = Math.max(keyEdge, top * 0.6) * (lum > 30 ? 1 : 0.5);
      if (kk) { r += (255 - r) * 0.30 * kk; g += (205 - g) * 0.22 * kk; b += (150 - b) * 0.10 * kk; }
      // rim on the far side
      if (o.rim && !A(i - kx, j) && lum > 36) { r += (170 - r) * 0.22; g += (200 - g) * 0.26; b += (255 - b) * 0.38; }
      p[k] = r; p[k + 1] = g; p[k + 2] = b;
    }
    x.putImageData(d, 0, 0);
  }

  // ---- battle: RIG.draw(B, LOOKS.arun, pose) + RZ.render(B, …) → our frame
  const POSE_TO_FRAME = { ready: 'idle_a', idle: 'idle_a', slash: 'slash', thrust: 'thrust', victory: 'victory_a', hurt: 'hit', down: 'ko' };
  const pose0 = RIG.pose;
  RIG.pose = function (name, extra) { const r = pose0(name, extra); Object.defineProperty(r, '__name', { value: name, enumerable: false }); return r; };
  const draw0 = RIG.draw;
  RIG.draw = function (B, L, P) {
    if (G.BATTLE_ART && L === BATTLE_ART.LOOKS.arun) { B.__hero = (P && POSE_TO_FRAME[P.__name]) || 'idle_a'; return; }
    return draw0.apply(this, arguments);
  };
  const render0 = RZ.render;
  RZ.render = function (B, o) {
    if (B && B.__hero) {
      const id = Q.get('hero_btl') && B.__hero === 'idle_a' ? Q.get('hero_btl') : B.__hero;
      return frame('battle', id, { key: -1, rim: true }); // lantern is to the party's left (front)
    }
    return render0.apply(this, arguments);
  };
  // ---- field / town: FIELD_CHAR.sprite(LOOKS.arun, dir, frame, o) → our frame
  const fsprite0 = FIELD_CHAR.sprite;
  FIELD_CHAR.sprite = function (L, dir, fr, o) {
    if (L === BATTLE_ART.LOOKS.arun) {
      const id = Q.get('hero_fld') || ('walk_' + dir + '_' + (fr || 0));
      return frame('field', id, { key: 1 });
    }
    return fsprite0.apply(this, arguments);
  };
  // wait for the sheets before any screen draws
  for (const k of Object.keys(SCREENS)) {
    const f = SCREENS[k];
    SCREENS[k] = async function (o) { await ready; return f.call(this, o); };
  }
})(window);
