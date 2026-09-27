// RENDER: 仕上げ（R.Post.frame）。V2_PLAN §2.5.5・§2.10「仕上げ」・§2.11、ART_REWORK §1.5.1 L8・§1.5.3、MODERN_UI §7.2 F8
//   R.Post.frame(g, {mood, vignette, bloom, grade, brightness})
//   世界を描く場面（FIELD・BSCENE）が自分の draw の最後、HUD の前に 1 回呼ぶ。実キャンバスの画素のまま（変換は中で戻す）。
//   - 周辺減光・暗部の持ち上げ（grade.sh と lift。真っ黒にしない）・明るさ（1 未満）は「焼いた膜 1 枚」を source-over で 1 回（いちばん軽い合成）
//   - 彩度（grade.sat < 1 のときだけ）は saturation の塗り 1 回。明部の色（grade.hi）は毎フレームでは掛けない（人物・物は R.Hd.grade で焼くときに）
//   - ブルームは効果「高」だけ: 1/4 に縮めて明るい所を強め（自分を 2 回掛ける ≈ 4 乗）、1/8・1/16 でぼかし、1/4 から screen で重ねる
//   - 設定「明るさ」（0.85 / 1 / 1.25）はここで掛ける（チャンクを焼き直さない）。1 未満は膜の中、1 より上は color-dodge（×b）
//   効果「切」: 明るさだけ（周辺減光・色調・ブルームなし。ART_REWORK §1.5.3）。「低」: ブルームなし。
//   値は o の物 → 無ければ mood（R.Hd.mood(o.mood || 'night')）。grade は mood の id か {sh, hi, lift, sat}、false で色調なし。
(function (R) {
  'use strict';
  const P = (R.Post = R.Post || {});
  const Hd = (R.Hd = R.Hd || {});
  const films = new Map();   // key → canvas
  const bufs = {};           // 名前 → {c, w, h}
  P.lastMs = 0;
  P.maxMs = 0;

  function buf(name, w, h) {
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    let b = bufs[name];
    if (!b || b.w !== w || b.h !== h) { b = bufs[name] = { c: Hd.RZ.canvas(w, h), w, h }; b.x = b.c.getContext('2d'); }
    return b;
  }
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  /**
   * 周辺減光・暗部の持ち上げ・明るさ（1 未満）を 1 枚にした膜（source-over で 1 回描くだけ。大きさと値ごとに 1 回焼く）。
   * 膜の画素 = 色 C・不透明度 A: 出来上がり = 下 × (1 − A) + C × A。
   *   中央: A = 持ち上げの強さ（暗部を lift 色へ少しだけ寄せる。真っ黒にしない）
   *   四隅: A = vignette、C = 藍（黒にしない）→ 四隅は中央の約 (1 − vignette) 倍
   *   明るさ b < 1 は全体に掛ける: A' = 1 − (1 − A) b、C' = C A b / A'
   * 半分の解像度で焼いて最近傍で 2 倍に置く（なだらかな膜なので段は見えない。メモリは 1/4）。
   */
  function film(W, H, vig, lift, b) {
    const key = W + 'x' + H + '|' + vig.toFixed(3) + '|' + lift.join(',') + '|' + b.toFixed(3);
    let c = films.get(key);
    if (c) return c;
    const w = Math.ceil(W / 2), h = Math.ceil(H / 2);
    c = Hd.RZ.canvas(w, h);
    const x = c.getContext('2d');
    const liftA = Math.min(0.2, (lift[0] + lift[1] + lift[2]) / 3 / 120);
    const dark = [5, 2, 15];   // 四隅の藍（黒にしない。暗部の色相 250〜295° の側）
    const stop = (a, col) => {
      const A = 1 - (1 - a) * b;
      if (A <= 0.0005) return 'rgba(0,0,0,0)';
      const C = col.map((v) => Math.max(0, Math.min(255, Math.round(v * a * b / A))));
      return `rgba(${C[0]},${C[1]},${C[2]},${A.toFixed(4)})`;
    };
    const cx = w / 2, cy = h / 2, rad = Math.hypot(w, h) / 2;
    const gr = x.createRadialGradient(cx, cy, Math.min(w, h) * 0.28, cx, cy, rad);
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, e = t * t * (3 - 2 * t);             // なめらかに
      const a = liftA + (vig - liftA) * e;
      // 足す色 = どこでも同じ持ち上げ（lift）＋ 周辺の藍（a − liftA の分）
      const col = a > 0 ? [0, 1, 2].map((k) => (lift[k] + dark[k] * (a - liftA)) / a) : [0, 0, 0];
      gr.addColorStop(t, stop(Math.max(0, a), col));
    }
    x.fillStyle = gr;
    x.fillRect(0, 0, w, h);
    films.set(key, c);
    while (films.size > 4) films.delete(films.keys().next().value);
    if (Hd.track) Hd.track('fx', 'post:film', Array.from(films.values()).reduce((s, f) => s + f.width * f.height * 4, 0));
    return c;
  }
  P._film = film;

  function bloom(g, cv, W, H, amount) {
    const q4 = buf('q4', W / 4, H / 4), q8 = buf('q8', W / 8, H / 8), q16 = buf('q16', W / 16, H / 16);
    const x4 = q4.x;
    x4.globalCompositeOperation = 'copy';
    x4.globalAlpha = 1;
    x4.imageSmoothingEnabled = true;
    x4.drawImage(cv, 0, 0, q4.w, q4.h);
    // 明るい所だけを残す（x → x^4 ≈ しきい 0.6 から上）
    x4.globalCompositeOperation = 'multiply';
    x4.drawImage(q4.c, 0, 0);
    x4.drawImage(q4.c, 0, 0);
    // ぼかし: 1/8・1/16 へ縮めて戻す
    q8.x.globalCompositeOperation = 'copy'; q8.x.imageSmoothingEnabled = true; q8.x.drawImage(q4.c, 0, 0, q8.w, q8.h);
    q16.x.globalCompositeOperation = 'copy'; q16.x.imageSmoothingEnabled = true; q16.x.drawImage(q8.c, 0, 0, q16.w, q16.h);
    x4.globalCompositeOperation = 'copy';
    x4.drawImage(q8.c, 0, 0, q4.w, q4.h);
    x4.globalCompositeOperation = 'lighter';
    x4.drawImage(q16.c, 0, 0, q4.w, q4.h);
    // 1/4 → 画面は最近傍（1/16 からなだらかにした絵なので段は目立たない。滑らかな拡大はソフトの描画で 3〜4 倍重い）
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = Math.min(1, amount);
    g.imageSmoothingEnabled = false;
    g.drawImage(q4.c, 0, 0, W, H);
    g.globalAlpha = 1;
  }

  P.frame = function (g, o) {
    if (!g || !g.canvas) return;
    const t0 = now();
    o = o || {};
    const cv = g.canvas, W = cv.width, H = cv.height;
    const quality = Hd.quality ? Hd.quality() : 'high';
    let b = o.brightness;
    if (b == null) { try { b = R.Settings.get('brightness'); } catch (e) { b = 1; } }
    b = +b || 1;
    const moodId = o.mood || (typeof o.grade === 'string' ? o.grade : 'night');
    const mood = Hd.mood(moodId);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    const bd = Math.min(1, b);   // 1 未満の明るさは膜に入れる
    if (quality !== 'off') {
      const bl = o.bloom != null ? o.bloom : mood.bloom;
      if (quality === 'high' && bl > 0) bloom(g, cv, W, H, bl);
      const gr = o.grade === false ? null : typeof o.grade === 'object' && o.grade ? o.grade : mood.grade;
      const vig = Math.max(0, Math.min(0.95, o.vignette != null ? o.vignette : mood.vignette || 0));
      const sh = gr && Array.isArray(gr.sh) ? gr.sh : [0, 0, 0];
      const lf = gr ? gr.lift || 0 : 0;
      const PS = (Hd.STYLE && Hd.STYLE.post) || {}, shL = PS.shLift != null ? PS.shLift : 0.35, lfM = PS.liftMul != null ? PS.liftMul : 1;
      const lift = gr ? sh.map((v) => Math.max(0, Math.round(Math.max(0, v) * shL + lf * lfM))) : [0, 0, 0];
      g.globalCompositeOperation = 'source-over';
      g.imageSmoothingEnabled = false;
      g.drawImage(film(W, H, vig, lift, bd), 0, 0, W, H);
      if (gr && gr.sat != null && gr.sat < 0.99) { g.globalCompositeOperation = 'saturation'; g.globalAlpha = Math.min(1, 1 - gr.sat); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    } else if (bd < 0.995) {
      g.globalCompositeOperation = 'source-over';
      g.imageSmoothingEnabled = false;
      g.drawImage(film(W, H, 0, [0, 0, 0], bd), 0, 0, W, H);
    }
    if (b > 1.005) { g.globalCompositeOperation = 'color-dodge'; const v = Math.round(255 * (1 - 1 / b)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, W, H); }
    g.restore();
    const ms = now() - t0;
    P.lastMs = ms;
    if (ms > P.maxMs) P.maxMs = ms;
  };
})(window.RPG);
