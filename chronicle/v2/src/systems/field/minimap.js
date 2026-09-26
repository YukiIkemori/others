// FIELD — 小地図（MODERN_UI §5.9・§6.2、dungeon.png。E11・E12）
//   ダンジョンの右上（手がかりの札の下）。歩いた所の周り（4 マス）が埋まる。見つけた泉（青緑）・開けていない宝箱（金）・階段（白）の印、
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
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(r.cv, ox, oy, m.w * s, m.h * s);
    const G = R.Game || {};
    const springs = (G.springs && G.springs[m.id]) || [], opened = (G.chests && G.chests[m.id]) || [];
    const d = Math.max(2.2, s * 1.1);
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
    const ang = ANG[S.dir] || 0;
    g.translate(ox + (S.x + 0.5) * s, oy + (S.y + 0.5) * s); g.rotate(ang);
    const k = Math.max(1, s / 2.5);
    g.beginPath(); g.moveTo(0, -5 * k); g.lineTo(3.5 * k, 3.5 * k); g.lineTo(0, 1.5 * k); g.lineTo(-3.5 * k, 3.5 * k); g.closePath();
    g.fillStyle = T.color.goldHi; g.fill();
    g.restore();
    // 凡例
    const lyy = y + h + U(6);
    R.UIK.text(g, '泉', x + U(2), lyy, { size: U(10), color: '#8fe8f0', shadow: true });
    R.UIK.text(g, '宝箱', x + U(28), lyy, { size: U(10), color: T.color.gold, shadow: true });
    R.UIK.text(g, '階段', x + U(64), lyy, { size: U(10), color: T.color.text2, shadow: true });
  };
  function dia(g, x, y, r, col) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(10,10,20,0.6)'; g.lineWidth = 0.5; g.stroke();
  }
})(window.RPG);
