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
