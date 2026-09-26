// CONTENT-P: マップを組み立てる小道具（序章・ファロス・古井戸のマップが使う。V2_PLAN §2.6.1）
//   R.ContentP.kit.grid(w, h, ch) / rect / put / hline / vline / path / blob / border / stamp / rows / def
//   各マップのファイルは R.onData(() => …) の中で組み立てる（読み込みの順に依らない。§2.4）。
//   prop(id, x, y, o) / b(id, x, y, w, h, o)（建物）/ chest / spring / sign / npc の短い書き方も置く。
(function (R) {
  'use strict';
  const C = (R.ContentP = R.ContentP || {});
  const K = (C.kit = C.kit || {});

  K.grid = function (w, h, ch) { const a = []; for (let y = 0; y < h; y++) a.push(new Array(w).fill(ch)); return a; };
  K.put = function (g, x, y, ch) { if (g[y] && x >= 0 && x < g[y].length) g[y][x] = ch; };
  K.rect = function (g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) K.put(g, i, j, ch); };
  K.hline = function (g, x0, x1, y, ch) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) K.put(g, x, y, ch); };
  K.vline = function (g, x, y0, y1, ch) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) K.put(g, x, y, ch); };
  K.border = function (g, ch, t) { const h = g.length, w = g[0].length, n = t || 1; K.rect(g, 0, 0, w, n, ch); K.rect(g, 0, h - n, w, n, ch); K.rect(g, 0, 0, n, h, ch); K.rect(g, w - n, 0, n, h, ch); };
  /** 折れ線（縦横の順に歩く）を幅 wd で塗る */
  K.path = function (g, pts, ch, wd) {
    const n = wd || 1;
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
      K.rect(g, x, y, n, n, ch);
      while (x !== x2 || y !== y2) {
        if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y);
        K.rect(g, x, y, n, n, ch);
      }
    }
  };
  /** 楕円の塊（縁は種で決まるゆらぎ。同じ種なら同じ形） */
  K.blob = function (g, cx, cy, rx, ry, ch, seed, only) {
    const rng = R.rng('cp_blob:' + seed);
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const d = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
      const r = rng.next();
      if (d < 1 - r * 0.28 && (!only || (g[y] && only.includes(g[y][x])))) K.put(g, x, y, ch);
    }
  };
  /** 文字の絵を (x, y) に置く（' ' はそのまま） */
  K.stamp = function (g, x, y, art) { art.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ' ') K.put(g, x + i, y + j, ch); })); };
  K.rows = function (g) { return g.map((r) => r.join('')); };
  K.at = function (g, x, y) { return g[y] ? g[y][x] : undefined; };

  /** マップを登録（rows が配列の配列なら文字列にし、w・h を数える） */
  K.def = function (id, m) {
    m.id = id;
    if (Array.isArray(m.rows) && Array.isArray(m.rows[0])) m.rows = K.rows(m.rows);
    m.h = m.rows.length; m.w = [...m.rows[0]].length;
    R.def('maps', id, m);
    return m;
  };

  // ---------------------------------------------------------------- 物の短い書き方
  K.prop = (id, x, y, o) => Object.assign({ type: 'prop', id, x, y }, o || {});
  K.props = (id, pts, o) => pts.map(([x, y]) => K.prop(id, x, y, o));
  K.b = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'slate', mat: 'plaster', windows: 2 }, o || {});
  K.chest = (id, x, y, o) => Object.assign({ type: 'chest', id, x, y }, o || {});
  K.spring = (id, x, y) => ({ type: 'spring', id, x, y });
  K.sign = (x, y, text, o) => Object.assign({ type: 'sign', x, y, text }, o || {});
  K.exam = (x, y, event, o) => Object.assign({ type: 'examine', x, y, event }, o || {});
  K.stairs = (x, y, to, o) => Object.assign({ type: 'stairs', x, y, to }, o || {});

  // ---------------------------------------------------------------- 屋内の型（壁・床・戸口）
  /**
   * 屋内の箱: w×h、上の 2 行は壁（立ち上がり）、左右と下は壁、下の中ほどに戸口（2 マスの隙間）。
   * → {g, door:{x, y}}。戸口の下の行は外（出口の範囲）
   */
  K.room = function (w, h, o) {
    o = o || {};
    const g = K.grid(w, h, o.floor || 'f');
    K.rect(g, 0, 0, w, 2, 'W');
    K.vline(g, 0, 0, h - 1, 'W'); K.vline(g, w - 1, 0, h - 1, 'W');
    K.hline(g, 0, w - 1, h - 1, 'W');
    const dx = o.doorX != null ? o.doorX : Math.floor(w / 2) - 1;
    K.put(g, dx, h - 1, 'd'); K.put(g, dx + 1, h - 1, 'd');
    return { g, door: { x: dx, y: h - 1 } };
  };
  K.ROOM_LEGEND = function (wall, floor) {
    return {
      W: { mat: wall || 'wall_wood', solid: true, rise: 2 },
      f: { mat: floor || 'wood_floor' },
      c: { mat: 'carpet' },
      d: { mat: floor || 'wood_floor', name: 'door' },
    };
  };
})(window.RPG);
