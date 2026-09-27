// FIELD — 小地図（MODERN_UI §5.9・§6.2、dungeon.png。E11・E12）
//   ダンジョンの右上（手がかりの札の下）。X で 小地図 → 大きな地図（drawBig、画面の中ほど）→ 出さない（設定 fieldMap、hud.js）。
//   歩いた所の周り（4 マス）が埋まる。見つけた泉（青緑）・開けていない宝箱（金）・階段（白）の印、
//   一行の向きの矢印。下に「泉 宝箱 階段」の凡例。埋まった所はマップごとに覚える（このセッションの間。R.Game には持たない）。
//   地図の画像は 1 マス 1 px の小さなキャンバスに、見えた所だけ足していく（毎フレームは drawImage と印だけ）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const M = (F.minimap = F.minimap || {});
  const REVEAL = 4;
  const WATER = /water|sea|shallow/;
  const ANG = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };

  function rec() {
    const m = S.map;
    const all = (S.seen = S.seen || {});
    let r = all[m.id];
    if (!r || r.w !== m.w || r.h !== m.h) {
      r = all[m.id] = { w: m.w, h: m.h, bits: new Uint8Array(m.w * m.h), cv: R.Gfx.canvas2d(m.w, m.h), grid: null };
    }
    return r;
  }
  /** 一行の周りを埋める（入ったとき・1 歩ごと） */
  M.reveal = function () {
    const m = S.map;
    if (!m || m.kind !== 'dungeon') return;
    const r = rec();
    const g = r.cv && r.cv.getContext('2d');
    const grid = R.MapUtil.grid(m);
    if (r.grid !== grid) { r.grid = grid; if (g) { g.clearRect(0, 0, m.w, m.h); for (let i = 0; i < r.bits.length; i++) if (r.bits[i]) paint(g, m, i % m.w, (i / m.w) | 0); } }
    for (let y = S.y - REVEAL; y <= S.y + REVEAL; y++) {
      if (y < 0 || y >= m.h) continue;
      for (let x = S.x - REVEAL; x <= S.x + REVEAL; x++) {
        if (x < 0 || x >= m.w) continue;
        if ((x - S.x) * (x - S.x) + (y - S.y) * (y - S.y) > REVEAL * REVEAL + 1) continue;
        const i = y * m.w + x;
        if (r.bits[i]) continue;
        if (R.MapUtil.secretHidden && R.MapUtil.secretHidden(m, x, y)) continue;   // 見つける前の隠し通路の先は地図に載せない（secrets.js）
        r.bits[i] = 1;
        if (g) paint(g, m, x, y);
      }
    }
  };
  function paint(g, m, x, y) {
    const c = R.MapUtil.cell(m, x, y);
    if (!c) return;
    const found = c.secret && R.MapUtil.secretFound(m.id, x, y);
    if (c.solid && !found) return;
    g.fillStyle = c.walk === false ? (WATER.test(c.mat) ? 'rgba(90,170,190,0.6)' : 'rgba(120,110,150,0.25)') : 'rgba(236,226,200,0.46)';
    g.fillRect(x, y, 1, 1);
  }
  M.seen = function (x, y) {
    const r = S.seen && S.map && S.seen[S.map.id];
    return !!(r && r.bits[y * r.w + x]);
  };

  M.draw = function (g, x, y, w, h) {
    const m = S.map, r = rec();
    if (!r.cv) return;
    const U = R.UIK.u, T = R.UIK.T;
    R.UIK.panel(g, { x, y, w, h }, { r: U(10) });
    const pad = U(8), s = Math.min((w - pad * 2) / m.w, (h - pad * 2) / m.h);
    const ox = x + (w - s * m.w) / 2, oy = y + (h - s * m.h) / 2;
    body(g, m, r, ox, oy, s, 1);
    legend(g, x, y + h + U(6), 1);
  };

  /**
   * 大きな地図（X で 小地図 → 大きな地図 → 出さない、の 2 番目。hud.js）: 今の階の歩いた所を画面の中ほどに大きく、
   * 下が透けるすりガラス（歩ける。字と印は読める濃さ）。上に階の名前、下に凡例。(cx, cy) = 中心、maxW × maxH に収める
   */
  M.drawBig = function (g, cx, cy, maxW, maxH) {
    const m = S.map, r = rec();
    if (!r.cv) return;
    const U = R.UIK.u, T = R.UIK.T;
    const pad = U(18), head = U(40), foot = U(28);
    const s = Math.max(1, Math.min((maxW - pad * 2) / m.w, (maxH - pad * 2 - head - foot) / m.h));
    const w = Math.round(m.w * s + pad * 2), h = Math.round(m.h * s + pad * 2 + head + foot);
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    R.UIK.panel(g, { x, y, w, h }, { r: U(12), a: 0.46, shadow: false });
    const meta = m.meta || {};
    R.UIK.text(g, m.name || m.id, x + pad, y + U(12), { size: U(17), weight: 700, shadow: true });
    const nw = R.UIK.measure(m.name || m.id, { size: U(17), weight: 700 });
    const sub = [meta.floor, meta.sub].filter(Boolean).join('　');
    if (sub) R.UIK.text(g, sub, x + pad + nw + U(14), y + U(17), { size: U(12), color: T.color.text2, shadow: true });
    body(g, m, r, x + pad, y + head + pad, s, 2);
    legend(g, x + pad, y + h - foot, 1.25);
  };

  const ARROW_ANG = Object.assign({ ne: Math.PI / 4, se: Math.PI * 0.75, sw: -Math.PI * 0.75, nw: -Math.PI / 4 }, ANG);
  /** 地図の中身（歩いた所・泉・宝箱・階段・出口・一行の矢印）。big = 印の大きさの倍率（小地図 1・大きな地図 2） */
  function body(g, m, r, ox, oy, s, big) {
    const T = R.UIK.T;
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(r.cv, ox, oy, m.w * s, m.h * s);
    const G = R.Game || {};
    const springs = (G.springs && G.springs[m.id]) || [], opened = (G.chests && G.chests[m.id]) || [];
    const d = Math.max(2.2 * big, Math.min(s * 1.1, 2.2 * big + s * 0.4));
    for (const o of m.objects || []) {
      if (o.cond != null && !R.State.check(o.cond)) continue;
      let col = null, cx = o.x + 0.5, cy = o.y + 0.5;
      if (o.type === 'spring' && (springs.includes(o.id) || M.seen(o.x, o.y))) { col = '#8fe8f0'; cx += 0.5; cy += 0.5; }
      else if (o.type === 'chest' && !opened.includes(o.id) && M.seen(o.x, o.y)) col = T.color.gold;
      else if (o.type === 'stairs' && M.seen(o.x, o.y)) col = '#f0e2c0';
      if (!col) continue;
      dia(g, ox + cx * s, oy + cy * s, d, col);
    }
    for (const e of m.exits || []) {
      if (!M.seen(e.x, e.y)) continue;
      g.fillStyle = 'rgba(240,226,192,0.8)'; g.fillRect(ox + e.x * s, oy + e.y * s, Math.max(1, e.w * s), Math.max(1, e.h * s));
    }
    // 一行（向きの矢印）
    const ang = ARROW_ANG[S.dir] || 0;
    g.translate(ox + (S.x + 0.5) * s, oy + (S.y + 0.5) * s); g.rotate(ang);
    const k = Math.max(big, Math.min(s / 2.5, big * 1.6));
    g.beginPath(); g.moveTo(0, -5 * k); g.lineTo(3.5 * k, 3.5 * k); g.lineTo(0, 1.5 * k); g.lineTo(-3.5 * k, 3.5 * k); g.closePath();
    g.fillStyle = T.color.goldHi; g.fill();
    g.restore();
  }
  /** 凡例（泉・宝箱・階段） */
  function legend(g, x, y, z) {
    const U = R.UIK.u, T = R.UIK.T;
    R.UIK.text(g, '泉', x + U(2 * z), y, { size: U(10 * z), color: '#8fe8f0', shadow: true });
    R.UIK.text(g, '宝箱', x + U(28 * z), y, { size: U(10 * z), color: T.color.gold, shadow: true });
    R.UIK.text(g, '階段', x + U(64 * z), y, { size: U(10 * z), color: T.color.text2, shadow: true });
  }
  function dia(g, x, y, r, col) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(10,10,20,0.6)'; g.lineWidth = 0.5; g.stroke();
  }
})(window.RPG);
