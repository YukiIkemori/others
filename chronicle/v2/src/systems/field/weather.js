// FIELD: 天気の層（map.weather）。雪原（snow_*.js）が使う。地面と人の上・暗がりの膜の下に、画面の座標で降る雪を描く。
//   'snow'     しんしんと降る雪（ゆっくり、少し横に流れる）
//   'blizzard' 吹雪（多く、速く、横に流れる。うすい白い幕）
//   'mist'     内海の白い霧（少なく大きい粒がゆっくり流れる。うすい白い幕）
//   map.weatherCond があれば、その条件（R.State.check）が真の間だけ。設定の reduceMotion か効果 off なら描かない。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const KIND = {
    snow: { n: 70, vy: 26, vx: 8, sway: 10, r: [1.2, 2.6], a: 0.75, veil: 0 },
    blizzard: { n: 170, vy: 70, vx: 120, sway: 18, r: [1, 2.8], a: 0.8, veil: 0.1 },
    // 内海の白い霧（STORY_BIBLE §4.3 の T4〜T7。maps/story_links.js）: 粒は少なく、ゆっくり横に流れる白いもや
    mist: { n: 26, vy: 2, vx: 10, sway: 6, r: [10, 22], a: 0.08, veil: 0.09 },
  };
  function h(i, k) { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }
  F._weather = function (g, m, cx, cy, t) {
    let kind = m.weather;
    if (m.weatherCond != null) { let ok = false; try { ok = !!R.State.check(m.weatherCond); } catch (e) { ok = false; } if (!ok) kind = m.weatherElse || null; }
    const K = KIND[kind];
    if (!K) return;
    try { if (R.Settings.get('reduceMotion')) return; } catch (e) { /* */ }
    const q = R.Hd && R.Hd.quality ? R.Hd.quality() : 'high';
    if (q === 'off') return;
    const W = R.W, H = R.H, tm = R.Engine.time / 1000, n = q === 'low' ? K.n >> 1 : K.n;
    g.save();
    if (K.veil) { g.fillStyle = `rgba(220,228,244,${K.veil})`; g.fillRect(0, 0, W, H); }
    // カメラに合わせて少しずらす（歩くと雪が流れて見える）
    const ox = cx * 0.6, oy = cy * 0.6;
    for (let i = 0; i < n; i++) {
      const sp = 0.6 + h(i, 1) * 0.8, r = K.r[0] + h(i, 2) * (K.r[1] - K.r[0]);
      let x = h(i, 3) * (W + 40) + (K.vx * sp) * tm + Math.sin(tm * 1.3 + i) * K.sway - ox;
      let y = h(i, 4) * (H + 40) + (K.vy * sp) * tm - oy;
      x = ((x % (W + 40)) + (W + 40)) % (W + 40) - 20; y = ((y % (H + 40)) + (H + 40)) % (H + 40) - 20;
      g.globalAlpha = K.a * (0.45 + 0.55 * h(i, 5));
      g.fillStyle = '#eef3ff';
      g.fillRect(x, y, r, r);
    }
    g.restore();
  };
})(window.RPG);
