// CAST: 顔絵の口 R.Portrait（V2_PLAN §2.5.16・§6.2）。仮の stub_art.js の Portrait と同じ順: 描いた顔 → hd:face → 無し。
//   R.Portrait.key(look, expr) → 'portrait:<look>:<expr>'
//   R.Portrait.has(look, expr) → 'painted'|'placeholder'|null      （顔の無い人は null。呼ぶ側は枠ごと出さない）
//   R.Portrait.draw(g, look, rect, {expr, dim, now})               枠（rect）の下の中央に合わせて描く。描いた顔は枠いっぱい
//     fit:'bust'（胸から上を枠いっぱい）・fit:'circle'（rect に内接する丸を顔でほぼ埋める。髪のてっぺん〜顎・首。丸で切り抜く。zoom・headroom）
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

  // ------------------------------------------------------------------ 丸い枠の顔（o.fit 'circle'）
  // 髪（帽子）のてっぺんから顎〜首までの正方形を切り出し、丸（rect に内接する円）が顔でほぼ埋まるように描く。上に空きを作らない。
  // 頭の横の中心は「頭の上の段（6〜30%）の左端・右端の中央値」の真ん中。羽根・帽子の星・背負った荷で外れすぎたら、コマの足元の中心（ox）に戻す。
  // 切る高さは絵の形で違う: 原画の顔（胸から上）0.66・歩きの原画から作った顔 0.95（もとが頭と肩だけ）・仮の顔（骨組み）0.85（絵のある高さに対する割合）。
  const CIRCLE_K = { sprite: 0.66, field: 0.95, rig: 0.85 };
  const heads = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function headBox(fr, meta) {
    const c = fr.c;
    if (heads && heads.has(c)) return heads.get(c);
    const b = opaqueBox(c);
    const kind = meta && meta.source === 'rig' ? 'rig' : meta && meta.from === 'field' ? 'field' : 'sprite';
    let cx = b.x + b.w / 2;
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const L = [], Rr = [];
      const y0 = Math.floor(b.y + b.h * 0.06), y1 = Math.max(y0 + 1, Math.floor(b.y + b.h * 0.3));
      for (let y = y0; y < y1; y++) {
        let l = -1, r = -1;
        for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] >= 24) { if (l < 0) l = x; r = x; }
        if (l >= 0) { L.push(l); Rr.push(r); }
      }
      if (L.length) {
        L.sort((a, z) => a - z); Rr.sort((a, z) => a - z);
        cx = (L[L.length >> 1] + Rr[Rr.length >> 1] + 1) / 2;
      }
    } catch (e) { /* 読めない canvas は箱の中央 */ }
    const foot = fr.ox != null ? fr.ox + 0.5 : cx;
    if (kind === 'sprite' && Math.abs(cx - foot) > c.width * 0.1) cx = foot;
    if (kind === 'rig') cx = c.width * 0.55;   // 骨組みの顔は頭が大きく左で切れ、顔は斜め右を向く（目の間がコマの 55%）   // 羽根・星・荷物に引っぱられた
    const S = b.h * CIRCLE_K[kind];
    const hb = { cx, top: b.y, S, kind };
    if (heads) heads.set(c, hb);
    return hb;
  }
  P.headBox = headBox;
  function drawCircle(g, fr, meta, rect, alpha, o) {
    const c = fr.c, hb = headBox(fr, meta);
    const D = Math.min(rect.w, rect.h);
    const px = R.SCALE || 2;
    const zoom = o.zoom || 1;
    let s = (D / hb.S) * zoom;
    // 画面の画素の整数倍に寄せる（近い整数が 15% 以内なら。ドットが崩れない）。遠ければそのままの倍率
    const sp = s * px, k = Math.round(sp);
    let crisp = sp >= 1.5;
    if (k >= 1 && Math.abs(k / sp - 1) <= 0.15) { s = k / px; crisp = true; }
    const dw = c.width * s, dh = c.height * s;
    const ccx = rect.x + rect.w / 2, ccy = rect.y + rect.h / 2;
    const top = ccy - D / 2 + D * (o.headroom != null ? o.headroom : 0.03);   // 髪のてっぺんが丸の上の縁のすぐ下
    let y = top - hb.top * s;
    const bottomGap = ccy + D / 2 - (y + opaqueBox(c).y * s + opaqueBox(c).h * s);   // 絵が丸の下まで届かないなら下に寄せる
    if (bottomGap > 0) y += bottomGap;
    g.save();
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = !crisp;
    g.beginPath(); g.arc(ccx, ccy, D / 2, 0, Math.PI * 2); g.clip();
    g.drawImage(c, Math.round((ccx - hb.cx * s) * px) / px, Math.round(y * px) / px, dw, dh);
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
      if (o.fit === 'circle') {   // 描いた顔の丸: 少し寄って上に合わせる（胸を切り、顔を丸の中に）
        const D = Math.min(rect.w, rect.h), s = (Math.max(D / iw, D / ih)) * (o.zoom || 1.3);
        g.beginPath(); g.arc(rect.x + rect.w / 2, rect.y + rect.h / 2, D / 2, 0, Math.PI * 2); g.clip();
        g.drawImage(rec.img, rect.x + (rect.w - iw * s) / 2, rect.y + rect.h / 2 - D / 2 - ih * s * 0.04, iw * s, ih * s);
        g.restore();
        return true;
      }
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
    if (o.fit === 'circle') return drawCircle(g, fr, sh.meta, rect, a0 * alpha, o);
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
