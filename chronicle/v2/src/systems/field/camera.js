// FIELD — カメラ（V2_PLAN §2.5.9、MODERN_UI §2.2）: 一行の先頭を中心に追い、マップの端では止める。
// マップが画面より小さい向きは中央に置く（足りない側はマップの外の色で埋まる）。
//   R.Field.camera.focus(x, y, {ms}) → Promise（マス座標へ動かす）/ follow()（先頭へ戻す）
//   R.Field._cam(out) → {cx, cy, t}（画面の左上のマップの論理 px。揺れを含む・整数）
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const C = (F.camera = F.camera || {});
  const tmp = { px: 0, py: 0 };

  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /** 追う点（マス単位の中心）。focus の間はその点、戻る間は補間 */
  function target(out) {
    F._vis(tmp);
    let x = tmp.px, y = tmp.py;
    const c = S.cam;
    if (c) {
      const k = c.ms > 0 ? Math.min(1, (R.Engine.time - c.t0) / c.ms) : 1;
      const e = ease(k);
      if (c.mode === 'focus') { x = c.fx + (c.x - c.fx) * e; y = c.fy + (c.y - c.fy) * e; }
      else if (c.mode === 'back') { x = c.fx + (x - c.fx) * e; y = c.fy + (y - c.fy) * e; if (k >= 1) S.cam = null; }
    }
    out.x = x; out.y = y;
    return out;
  }
  const tg = { x: 0, y: 0 };

  /** 画面の左上（マップの論理 px）。端で止まる。小さいマップは中央 */
  F._cam = function (out) {
    out = out || {};
    const m = S.map, t = F._tile();
    target(tg);
    let cx = tg.x * t + t / 2 - R.W / 2, cy = tg.y * t + t / 2 - R.H / 2;
    const mw = m.w * t, mh = m.h * t;
    cx = mw <= R.W ? (mw - R.W) / 2 : Math.max(0, Math.min(mw - R.W, cx));
    cy = mh <= R.H ? (mh - R.H) / 2 : Math.max(0, Math.min(mh - R.H, cy));
    const sh = S.shakeFx;
    if (sh) {
      const k = (R.Engine.time - sh.t0) / sh.ms;
      if (k >= 1) S.shakeFx = null;
      else { const a = sh.px * (1 - k); cx += Math.sin(R.Engine.time * 0.09) * a; cy += Math.cos(R.Engine.time * 0.113) * a * 0.6; }
    }
    out.cx = Math.round(cx); out.cy = Math.round(cy); out.t = t;
    return out;
  };

  C.focus = function (x, y, o) {
    const ms = (o && o.ms) != null ? o.ms : 400;
    const cur = target({ x: 0, y: 0 });
    S.cam = { mode: 'focus', fx: cur.x, fy: cur.y, x, y, t0: R.Engine.time, ms };
    return R.wait(ms);
  };
  C.follow = function (o) {
    if (!S.cam) return Promise.resolve();
    const cur = target({ x: 0, y: 0 });
    const ms = (o && o.ms) != null ? o.ms : 300;
    S.cam = { mode: 'back', fx: cur.x, fy: cur.y, t0: R.Engine.time, ms };
    return R.wait(ms);
  };
  C._snap = function () { S.cam = null; };
  C._tick = function () {};
})(window.RPG);
