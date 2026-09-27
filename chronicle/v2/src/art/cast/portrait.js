// CAST: 顔絵の口 R.Portrait（V2_PLAN §2.5.16・§6.2）。仮の stub_art.js の Portrait と同じ順: 描いた顔 → hd:face → 無し。
//   R.Portrait.key(look, expr) → 'portrait:<look>:<expr>'
//   R.Portrait.has(look, expr) → 'painted'|'placeholder'|null      （顔の無い人は null。呼ぶ側は枠ごと出さない）
//   R.Portrait.draw(g, look, rect, {expr, dim, now})               枠（rect）の下の中央に合わせて描く。描いた顔は枠いっぱい
//   R.Portrait.parse('berna:smile') → {look, expr}                  （無い表情は neutral）
// 描いた顔の画像は初めて使うときに読み込む（decode の間は仮の顔）。仮の顔・原画の顔はぼかさずに拡大（0.5 刻みの倍率）。
(function (R) {
  'use strict';
  R.Stubs.claim('Portrait');
  const EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise'];
  const P = (R.Portrait = R.Portrait || {});

  P.EXPRS = EXPRS;
  P.key = function (look, expr) { return `portrait:${look}:${expr || 'neutral'}`; };
  function painted(look, expr) {
    if (!R.Media || !R.Media.has) return null;
    if (R.Media.has('portraits', P.key(look, expr))) return P.key(look, expr);
    if (expr !== 'neutral' && R.Media.has('portraits', P.key(look, 'neutral'))) return P.key(look, 'neutral');
    return null;
  }
  P.has = function (look, expr) {
    if (!look) return null;
    if (painted(look, expr || 'neutral')) return 'painted';
    if (R.Hd && R.Hd.has && R.Hd.has('hd:face:' + look)) return 'placeholder';
    return null;
  };
  P.parse = function (s) {
    const str = String(s || '');
    const i = str.indexOf(':');
    const look = i < 0 ? str : str.slice(0, i), expr = i < 0 ? '' : str.slice(i + 1);
    return { look, expr: EXPRS.includes(expr) ? expr : 'neutral' };
  };
  /** 仮の顔のシートを先に焼く（会話の前など）。→ 焼けたか */
  P.warm = function (look) {
    const k = 'hd:face:' + look;
    if (!R.Hd || !R.Hd.has(k)) return false;
    return !!R.Hd.now(k);
  };
  // ------------------------------------------------------------------ 胸から上（o.fit 'bust'）
  // 顔のコマの絵のある範囲（透明でない画素の箱）を求め、頭を枠の上に、肩を枠の下に合わせて枠いっぱいに描く（はみ出しは切る）。
  // 小さな枠でも「顔が小さく真ん中に浮く」ことがない（仲間選びの札など）。倍率は画面の画素の整数倍に丸める（ドットが崩れない）。
  const boxes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function opaqueBox(c) {
    if (boxes && boxes.has(c)) return boxes.get(c);
    let b = { x: 0, y: 0, w: c.width, h: c.height };
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] < 24) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 >= x0) b = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) { /* 読めない canvas は全体 */ }
    if (boxes) boxes.set(c, b);
    return b;
  }
  P.opaqueBox = opaqueBox;
  function drawBust(g, c, rect, alpha, o) {
    const b = opaqueBox(c);
    const zoom = o.zoom || 1.08;              // 少し寄る（肩の端は切れてよい）
    let s = (rect.w / b.w) * zoom;
    if (b.h * s < rect.h * 0.96) s = (rect.h * 0.96) / b.h;   // 縦が足りなければ縦で合わせる
    const px = R.SCALE || 2;                  // 論理 1 px = 画面 px 個
    s = s * px >= 1 ? Math.ceil(s * px - 0.15) / px : s;     // 画面の画素の整数倍（上へ丸める = 枠いっぱい）
    const dw = c.width * s, dh = c.height * s;
    const cx = b.x + b.w / 2;
    const top = rect.y + rect.h * (o.headroom != null ? o.headroom : 0.05) - b.y * s;
    let y = top;
    const bottom = rect.y + rect.h - (b.y + b.h) * s;   // 肩の下が枠の下より上に来るなら下に合わせる
    if (bottom > y) y = bottom;
    g.save();
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = s * px < 1;
    g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
    g.drawImage(c, Math.round((rect.x + rect.w / 2 - cx * s) * px) / px, Math.round(y * px) / px, dw, dh);
    g.restore();
    return true;
  }

  P.draw = function (g, look, rect, o) {
    o = o || {};
    const expr = EXPRS.includes(o.expr) ? o.expr : 'neutral';
    const a0 = g.globalAlpha;
    const alpha = o.dim ? 0.5 : 1;
    // 1. 描いた顔
    const pk = painted(look, expr);
    const rec = pk && R.Media.image(pk);
    if (rec && rec.ready) {
      g.save();
      g.globalAlpha = a0 * alpha;
      g.imageSmoothingEnabled = true;
      const iw = rec.img.naturalWidth || rec.img.width, ih = rec.img.naturalHeight || rec.img.height;
      const s = Math.max(rect.w / iw, rect.h / ih);   // 枠いっぱい（はみ出しは切る）
      g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
      g.drawImage(rec.img, rect.x + (rect.w - iw * s) / 2, rect.y + (rect.h - ih * s) / 2, iw * s, ih * s);
      g.restore();
      return true;
    }
    // 2. 仮の顔・原画の顔（hd:face）
    const key = 'hd:face:' + look;
    if (!R.Hd || !R.Hd.has || !R.Hd.has(key)) return false;
    const sh = R.Hd.get(key) || (o.now !== false ? R.Hd.now(key) : null);
    if (!sh || !sh.poses) return false;
    const fr = sh.frames[(sh.poses[expr] || sh.poses.neutral || [0])[0]];
    if (!fr || !fr.c) return false;
    const w = fr.c.width, h = fr.c.height;
    if (o.fit === 'bust') return drawBust(g, fr.c, rect, a0 * alpha, o);
    let s = Math.min(rect.w / w, rect.h / h);
    s = s >= 1 ? Math.max(1, Math.floor(s * 2) / 2) : Math.max(0.25, Math.floor(s * 4) / 4);
    const dw = Math.round(w * s), dh = Math.round(h * s);
    g.save();
    g.globalAlpha = a0 * alpha;
    g.imageSmoothingEnabled = false;
    g.beginPath(); g.rect(rect.x, rect.y, rect.w, rect.h); g.clip();
    g.drawImage(fr.c, Math.round(rect.x + (rect.w - dw) / 2), Math.round(rect.y + rect.h - dh), dw, dh);
    g.restore();
    return true;
  };
})(window.RPG);
