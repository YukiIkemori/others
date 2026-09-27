// RENDER: 光の地図（R.Light）。V2_PLAN §2.5.5、MODERN_UI §4.1・§7.2（F5・F6）、STYLE_REFERENCE §5.3・§6.4
//   R.Light.compose(ctx, rect, {ambient, bright | k, lights:[{x, y, r, color, k, kind}], moon:[rects], mood, res})
//       掛け算の環境光＋足し算の光だまり。rect = [x, y, w, h]（ctx の今の座標。灯りの x, y も同じ座標）に掛ける（rect の外は描かない）。
//       ambient = 環境光の色（既定は mood の ambient）
//       ── 明るさの決まり（P2 で一本化）──
//       bright = 場面の明るさ = map.light.k（ART_REWORK §1.4 の意味: 夜の町 0.45・ダンジョン 0.55〜0.7・屋内 0.85・昼 1）。こちらを渡す。
//       k      = 環境光の効き（1 = そのまま掛ける、0 = 掛けない）。bright から R.Light.effect(bright) で決まる。bright が無いときだけ直に読む（前の呼び方）
//       R.Terrain.ambient(map, tier) → {ambient, bright, k, mood} の bright は map.light.k そのまま、k は effect(bright)（同じ関数）
//       lights: kind 'pool'（既定。地面に縦 0.62 の楕円）| 'point'（丸）| 'window'（縦 0.5 の低い楕円）| 'wide'（横に長い、戸口・大灯火の足元）
//               k = 中心の強さ（0〜1.5、既定 0.85）。r は半径（mood.poolMul を掛ける。洞窟は 1.35 倍）
//       moon: 月の当たる面（屋根・高い所の上面）の矩形 [x, y, w, h] の一覧。淡い青を足してから掛ける
//       res: 光の地図の解像度（既定 0.5 = 半分。滑らかに拡大するので絵は崩れない）。spill: 掛けた後に光だまりの中心へ足す加算の強さ（既定 0.16）
//       → 光の地図の canvas（使い回し。次の compose で上書き）
//   R.Light.map(rect, o) → 光の地図の canvas だけ（チャンクに焼き込むときに。compose と同じ中身、使い回さない新しい canvas）
//   R.Light.glow(g, x, y, {r, color, core, halo}, t)   発光の描き直し: 白に近い芯（半径 core、既定 6）＋芯の 3 倍のにじみ（加算、半径 halo、r でも可）。
//       t（ms）を渡すと小さくゆらぐ（±8%、3 Hz。効果「高」だけ）。効果「切」は芯だけ
//   R.Light.ring(g, x, y, r, t, o?)   先頭の人のランタンの光の輪（r = 88 art px、暗がりの階は 4 マス）。掛けた後の画面を暖色の灯りの下の色へ戻す
//       （color-dodge。色は環境光から決める: o.mood / o.ambient、無ければ最後の compose の環境光）
//       ゆらぎ ±5%、2 Hz（効果「高」だけ）。効果「切」では描かない
// 毎フレームの物（glow・ring）は、焼いた光の絵（色ごとに 1 枚）を置くだけ（§2.10「灯り」）。
(function (R) {
  'use strict';
  const L = (R.Light = R.Light || {});
  const Hd = (R.Hd = R.Hd || {});
  const SPR = 128;
  const sprites = new Map();   // 'pool|color' → canvas
  const scratch = { c: null, w: 0, h: 0 };

  function st() { return (Hd.STYLE && Hd.STYLE.light) || {}; }
  function rgbOf(c) { return Hd._rgb(c); }
  function q() { return Hd.quality ? Hd.quality() : 'high'; }
  function reduced() { try { return !!(R.Settings && R.Settings.get('reduceMotion')); } catch (e) { return false; } }

  // 光の絵（中心 1 → 外 0 の色のぼかし）。shape: 'pool'（光だまりの滑らかな落ち方）| 'halo'（にじみ）| 'core'（芯）| 'ring'（ランタン）
  function sprite(shape, color) {
    const key = shape + '|' + color;
    let c = sprites.get(key);
    if (c) return c;
    c = Hd.RZ.canvas(SPR, SPR);
    const x = c.getContext('2d');
    const [r, g, b] = rgbOf(color);
    const h = SPR / 2;
    const gr = x.createRadialGradient(h, h, 0, h, h, h);
    const col = (a) => `rgba(${r},${g},${b},${a})`;
    if (shape === 'pool') { gr.addColorStop(0, col(1)); gr.addColorStop(0.3, col(0.72)); gr.addColorStop(0.65, col(0.24)); gr.addColorStop(1, col(0)); }
    else if (shape === 'halo') { gr.addColorStop(0, col(0.8)); gr.addColorStop(0.22, col(0.45)); gr.addColorStop(0.55, col(0.12)); gr.addColorStop(1, col(0)); }
    else if (shape === 'core') {
      const w = [Math.round(r + (255 - r) * 0.8), Math.round(g + (255 - g) * 0.8), Math.round(b + (255 - b) * 0.75)];
      gr.addColorStop(0, `rgba(${w[0]},${w[1]},${w[2]},1)`); gr.addColorStop(0.45, `rgba(${w[0]},${w[1]},${w[2]},0.95)`); gr.addColorStop(0.75, col(0.5)); gr.addColorStop(1, col(0));
    } else if (shape === 'ring') {
      // color-dodge 用: 中心で ×(1/(1−v))。中心 +50〜80%、外へ滑らかに
      gr.addColorStop(0, col(1)); gr.addColorStop(0.3, col(0.8)); gr.addColorStop(0.65, col(0.3)); gr.addColorStop(1, col(0));
    }
    x.fillStyle = gr;
    x.fillRect(0, 0, SPR, SPR);
    sprites.set(key, c);
    if (sprites.size > 96) sprites.delete(sprites.keys().next().value);
    return c;
  }
  L._sprite = sprite;

  /**
   * 明るさ（map.light.k、ART_REWORK §1.4）→ 環境光の効き（compose の k）。STYLE.light.nightBright（0.45 = 夜の町）で 1（そのまま掛ける）、
   * 1（昼）で 0（掛けない）。その間はまっすぐ。null は夜（1）
   */
  L.effect = function (bright) {
    if (bright == null || isNaN(bright)) return 1;
    const nb = st().nightBright != null ? st().nightBright : 0.45;
    return Math.max(0, Math.min(1, (1 - bright) / (1 - nb)));
  };
  /** compose・map の o から効きを決める（bright が先） */
  function effectOf(o) { return o.bright != null ? L.effect(o.bright) : o.k != null ? o.k : 1; }
  L._effectOf = effectOf;

  /**
   * 夜の環境光の色を STYLE_REFERENCE §5.2 の暗部の色相（250〜295° 青紫）へ寄せる（青 200〜250° のときだけ、STYLE.light.ambientHue の割合）。
   * 地図の ambient（CONTENT の色）はそのまま書き、色相だけをここで揃える（明るさ V は変えない）
   */
  const ambCache = new Map();
  function nightAmbient(rgb, gainOver) {
    const S = st(), shift = S.ambientHueShift != null ? S.ambientHueShift : 0;
    const gain = gainOver != null ? gainOver : S.ambientGain || 1;
    if (!shift && gain === 1) return rgb;
    const key = rgb.join(',') + '|' + gain;
    let v = ambCache.get(key);
    if (v) return v;
    if (gain !== 1) rgb = rgb.map((x) => Math.min(255, x * gain));
    const [r, g, b] = rgb.map((x) => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 0) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const [h0, h1] = S.ambientHue || [250, 295];
    v = rgb.map((x) => Math.round(x));
    if (shift && d > 0 && h >= 195 && h < h0) {
      const nh = h + (h0 - h) * shift, sat = Math.min(1, (d / mx) * (S.ambientSat || 1));
      const V = mx, C = V * sat, X = C * (1 - Math.abs(((nh / 60) % 2) - 1)), m0 = V - C;
      const seg = Math.floor(nh / 60) % 6;
      const t = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][seg];
      v = t.map((c) => Math.round((c + m0) * 255));
    }
    ambCache.set(key, v);
    if (ambCache.size > 64) ambCache.delete(ambCache.keys().next().value);
    return v;
  }
  L._nightAmbient = nightAmbient;

  function asRect(rect) {
    if (!rect) return [0, 0, R.W, R.H];
    if (Array.isArray(rect)) return rect;
    return [rect.x || 0, rect.y || 0, rect.w != null ? rect.w : rect.width, rect.h != null ? rect.h : rect.height];
  }

  // 光の地図を lm（canvas）に描く
  function paint(lm, rect, o, res) {
    const x = lm.getContext('2d');
    const [rx, ry, rw, rh] = rect;
    const mood = Hd.mood(o.mood || 'night');
    // 戦闘の光の地図（R.Light.map、層ごとに掛ける）は明るい砂・地面に大きな光だまりを 1 つ置くので、環境光の倍率と中心の足し算は控えめ（mapGain・mapPoolCore）
    const isMap = !!o._map;
    const amb = nightAmbient(rgbOf(o.ambient || mood.ambient), isMap ? (st().mapGain != null ? st().mapGain : 1) : null);
    const k = effectOf(o);
    L.current = { ambient: amb, mood: o.mood || 'night', k, bright: o.bright };
    const a = amb.map((v) => Math.round(255 - (255 - v) * k));
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.fillStyle = `rgb(${a[0]},${a[1]},${a[2]})`;
    x.fillRect(0, 0, lm.width, lm.height);
    x.setTransform(res, 0, 0, res, -rx * res, -ry * res);
    x.globalCompositeOperation = 'lighter';
    x.imageSmoothingEnabled = true;
    if (o.moon && o.moon.length) {
      x.fillStyle = mood.moon || 'rgb(56,64,84)';
      for (const m of o.moon) { const mr = asRect(m); x.fillRect(mr[0], mr[1], mr[2], mr[3]); }
    }
    const poolMul = (mood.poolMul || 1) * (isMap ? 1 : st().poolR || 1);
    const sq = st().poolSquash || 0.62;
    const white = st().poolWhite != null ? st().poolWhite : 0.35;
    const list = [];
    for (const li of o.lights || []) {
      const r = (li.r || 60) * poolMul;
      if (li.x + r < rx || li.x - r > rx + rw || li.y + r < ry || li.y - r > ry + rh) continue;
      const kind = li.kind || 'pool';
      const sy = kind === 'point' ? 1 : kind === 'window' ? 0.5 : kind === 'wide' ? 0.45 : sq;
      const sx = kind === 'wide' ? 1.5 : 1;
      const c = rgbOf(li.color || st().lampColor || '#ffc27a').map((v) => Math.round(v + (255 - v) * white));
      list.push({ li, r, sx, sy, col: `rgb(${c[0]},${c[1]},${c[2]})`, k: Math.max(0, li.k != null ? li.k : 0.85) });
    }
    // ① 光だまりの中は環境光から灯りの色へ寄せる（重なっても白く飛ばない。暖色が残る）
    x.globalCompositeOperation = 'source-over';
    for (const p of list) {
      x.globalAlpha = Math.min(1, p.k);
      x.drawImage(sprite('pool', p.col), p.li.x - p.r * p.sx, p.li.y - p.r * p.sy, p.r * 2 * p.sx, p.r * 2 * p.sy);
    }
    // ② 重なった所と中心を少し足す（中心 +40〜60%、STYLE_REFERENCE §5.3）
    x.globalCompositeOperation = 'lighter';
    const core = isMap ? (st().mapPoolCore != null ? st().mapPoolCore : 0.6) : st().poolCore != null ? st().poolCore : 0.6;
    for (const p of list) {
      x.globalAlpha = Math.min(1, p.k * core);
      x.drawImage(sprite('pool', p.col), p.li.x - p.r * p.sx * 0.6, p.li.y - p.r * p.sy * 0.6, p.r * 1.2 * p.sx, p.r * 1.2 * p.sy);
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.setTransform(1, 0, 0, 1, 0, 0);
    return lm;
  }

  L.map = function (rect, o) {
    o = o || {};
    rect = asRect(rect);
    const res = o.res || 0.5;
    const lm = Hd.RZ.canvas(Math.ceil(rect[2] * res), Math.ceil(rect[3] * res));
    return paint(lm, rect, Object.assign({ _map: true }, o), res);
  };

  L.compose = function (ctx, rect, o) {
    o = o || {};
    rect = asRect(rect);
    const res = o.res || 0.5;
    const w = Math.ceil(rect[2] * res), h = Math.ceil(rect[3] * res);
    if (!scratch.c || scratch.w !== w || scratch.h !== h) { scratch.c = Hd.RZ.canvas(w, h); scratch.w = w; scratch.h = h; }
    const lm = paint(scratch.c, rect, o, res);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lm, 0, 0, w, h, rect[0], rect[1], rect[2], rect[3]);
    // ③ 光だまりの中心は下地より明るく（掛け算だけでは下地の色を超えない。加算で少し。STYLE_REFERENCE §5.3 の +40〜60%）
    const spill = o.spill != null ? o.spill : st().spill != null ? st().spill : 0.16;
    if (spill > 0 && o.lights && o.lights.length) {
      const mood = Hd.mood(o.mood || 'night'), poolMul = (mood.poolMul || 1) * (st().poolR || 1), sq = st().poolSquash || 0.62;
      ctx.globalCompositeOperation = 'lighter';
      const [rx, ry, rw, rh] = rect;
      // rect の外へ描かない（帯に分けて掛けても 2 度足さない）
      ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
      for (const li of o.lights) {
        if (li.kind === 'window') continue;
        const r = (li.r || 60) * poolMul * 0.55;
        if (li.x + r < rx || li.x - r > rx + rw || li.y + r < ry || li.y - r > ry + rh) continue;
        const sy = li.kind === 'point' ? 1 : li.kind === 'wide' ? 0.45 : sq, sx = li.kind === 'wide' ? 1.5 : 1;
        ctx.globalAlpha = Math.min(1, spill * (li.k != null ? li.k : 0.85));
        ctx.drawImage(sprite('pool', li.color || st().lampColor || '#ffc27a'), li.x - r * sx, li.y - r * sy, r * 2 * sx, r * 2 * sy);
      }
    }
    ctx.restore();
    return lm;
  };

  // ゆらぎ（位置から決まる位相で、灯りごとにずれる）
  function flick(x, y, t, amp, hz) {
    if (t == null || q() !== 'high' || reduced()) return 1;
    const ph = ((x * 12.9898 + y * 78.233) % 6.283);
    const s = t / 1000 * hz * 6.283;
    return 1 + amp * (0.6 * Math.sin(s + ph) + 0.4 * Math.sin(s * 2.31 + ph * 1.7));
  }
  L._flick = flick;

  L.glow = function (g, x, y, o, t) {
    o = o || {};
    const S = st();
    const color = o.color || S.lampColor || '#ffc27a';
    const core = o.core != null ? o.core : S.coreR || 6;
    const halo = o.halo != null ? o.halo : o.r != null ? o.r : core * (S.haloMul || 3);
    const f = flick(x, y, t, (S.flicker && S.flicker.lamp[0]) || 0.08, (S.flicker && S.flicker.lamp[1]) || 3);
    const quality = q();
    const a0 = g.globalAlpha, op = g.globalCompositeOperation, sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'lighter';
    const k = o.k != null ? o.k : 1;
    if (quality !== 'off') {
      const hr = halo * f;
      g.globalAlpha = a0 * Math.min(1, k * f);
      g.drawImage(sprite('halo', color), x - hr, y - hr, hr * 2, hr * 2);
    }
    const cr = core * (quality === 'off' ? 1 : f);
    g.globalAlpha = a0 * Math.min(1, k);
    g.drawImage(sprite('core', color), x - cr, y - cr, cr * 2, cr * 2);
    g.globalAlpha = a0; g.globalCompositeOperation = op; g.imageSmoothingEnabled = sm;
  };

  // ランタンの輪の色: 掛けた後の画面（下地 × 環境光）を「下地 × 暖色」に近づける color-dodge の色。
  // dodge は ×1/(1−s) なので、s = 1 − 環境光 / 暖色（チャンネルごと、1〜3 倍）
  function dodgeColor(amb, warm) {
    const s = [0, 1, 2].map((i) => { const f = Math.max(1, Math.min(3, warm[i] / Math.max(1, amb[i]))); return Math.round((1 - 1 / f) * 255); });
    return `rgb(${s[0]},${s[1]},${s[2]})`;
  }
  L._dodgeColor = dodgeColor;

  /**
   * o（足した物）= {mood, ambient, color}: 掛けた環境光（既定は最後の compose の値 → 'night'）とランタンの色（既定 STYLE.light.lanternColor）
   */
  L.ring = function (g, x, y, r, t, o) {
    const quality = q();
    if (quality === 'off') return;
    o = o || {};
    const S = st();
    r = r || S.ringR || 88;
    const f = flick(x, y, t, (S.flicker && S.flicker.ring[0]) || 0.05, (S.flicker && S.flicker.ring[1]) || 2);
    const rr = r * f;
    const sy = 0.86;
    const amb = o.ambient ? rgbOf(o.ambient) : o.mood ? rgbOf(Hd.mood(o.mood).ambient) : (L.current && L.current.ambient) || rgbOf(Hd.mood('night').ambient);
    const warm = rgbOf(o.color || S.lanternColor || '#ffd49a');
    const a0 = g.globalAlpha, op = g.globalCompositeOperation, sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = true;
    // ① 掛けた後の画面を暖色の灯りの下の色へ戻す（色のある所ほど明るく。暗い所は暗いまま）
    g.globalCompositeOperation = 'color-dodge';
    g.globalAlpha = a0;
    g.drawImage(sprite('ring', dodgeColor(amb, warm)), x - rr, y - rr * sy, rr * 2, rr * 2 * sy);
    // ② ごく薄い暖色のもや（輪の中心の空気）
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a0 * 0.1;
    g.drawImage(sprite('pool', '#ffb060'), x - rr * 0.7, y - rr * 0.7 * sy, rr * 1.4, rr * 1.4 * sy);
    g.globalAlpha = a0; g.globalCompositeOperation = op; g.imageSmoothingEnabled = sm;
  };
})(window.RPG);
