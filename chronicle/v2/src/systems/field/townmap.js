// FIELD — 町の地図（オーナーの依頼「町で X を押したら、その町の地図」）。画面は MENUS の地図（screens/map.js、params {town}）で、
//   描くのはここ: R.Field.townmap.draw(g, area, mapId, o) → {x, y, w, h}（描いた地図の枠）
//   - 下地: 描いた下絵（map.art.image、R.Terrain.Env.under）を縮めて 1 枚。無い・読めていなければマスの色（素材の平均色・水・壁）と建物の屋根。
//   - 印: 一行の矢印（向き）・出口（金の枠と「↑ 迷いの森」の札）・建物の戸口の施設（看板と同じ種類と絵 = wayfind.js の W.info／W.pict）。
//   - 凡例: R.Field.townmap.legend(g, rect, mapId, o) 地図にある施設の絵と呼び名（武器屋・防具屋・道具屋・宿屋・酒場・教会・セーブ…）＋出口・いま。
//   マップのデータ（戸口・出口の座標）だけから作るので、町の絵を描き直しても付いていく。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const TM = (F.townmap = F.townmap || {});
  const WATER = /water|sea|shallow|pond|river/;
  const ANG = { n: 0, ne: Math.PI / 4, e: Math.PI / 2, se: Math.PI * 0.75, s: Math.PI, sw: -Math.PI * 0.75, w: -Math.PI / 2, nw: -Math.PI / 4 };
  // 凡例の呼び名（看板の種類 → 町の地図での名前）
  const NAME = {
    weapon: '武器屋', armor: '防具屋', item: '道具屋', inn: '宿屋', tavern: '酒場・仲間', church: '教会', save: 'セーブ', guild: '詰所',
    record: '記録院', records: '記録院', hall: '集会所', map: '地図屋', special: '店', shop: '店',
  };
  const ORDER = ['weapon', 'armor', 'item', 'special', 'shop', 'map', 'inn', 'tavern', 'church', 'save', 'guild', 'record', 'records', 'hall'];

  function nameOf(s) {
    if (s.kind === 'guild') return /詰所/.test(s.name || '') ? '詰所' : 'ギルド';
    return NAME[s.kind] || s.name || '店';
  }
  /** 地図の施設の一覧（看板と同じ。wayfind.js が無ければ空） */
  function signs(m) {
    const W = F.wayfind;
    if (!W || !W.info) return { exits: [], signs: [] };
    try { return W.info(m); } catch (e) { return { exits: [], signs: [] }; }
  }

  // ---------------------------------------------------------------- 下地
  function painted(m) {
    const a = m.art, E = R.Terrain && R.Terrain.Env;
    if (!a || !a.image || !E || !E.under) return null;
    for (const t of [F._tile ? F._tile() : 32, 24, 32, 40]) { const u = E.under(a.image, t); if (u && u.img) return u.img; }
    return null;
  }
  const tileCache = {};
  /** マスの色の小さな絵（1 マス 1 px）。建物の敷地は屋根の色 */
  function tiles(m) {
    const c = tileCache[m.id];
    const grid = R.MapUtil.grid(m);
    if (c && c.grid === grid) return c.cv;
    const cv = R.Gfx.canvas2d(m.w, m.h);
    if (!cv) return null;
    const g = cv.getContext('2d'), E = R.Terrain && R.Terrain.Env;
    const mean = {};
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const cell = R.MapUtil.cell(m, x, y);
      let col = '#23222c';
      if (cell) {
        if (cell.walk === false && WATER.test(cell.mat || '')) col = '#3d7ea0';
        else if (cell.solid && !cell.secret) col = /tree|forest|bush|hedge/.test(cell.mat || '') ? '#2d4a2e' : '#3a3742';
        else {
          const k = cell.mat || '';
          if (!(k in mean)) { let v = null; try { v = E && E.meanColor ? E.meanColor(k) : null; } catch (e) { v = null; } mean[k] = v || (/road|path|dirt|sand|stone|cobble|brick|plank|floor/.test(k) ? '#b59a6e' : '#5f8250'); }
          col = mean[k];
        }
      }
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    for (const o of m.objects || []) {
      if (o.type !== 'building' || (o.cond != null && !R.State.check(o.cond))) continue;
      g.fillStyle = '#7a3e32'; g.fillRect(o.x, o.y, o.w || 3, o.h || 3);
      g.fillStyle = 'rgba(255,220,170,0.35)'; g.fillRect(o.x, o.y, o.w || 3, 1);
    }
    tileCache[m.id] = { grid, cv };
    return cv;
  }

  // ---------------------------------------------------------------- 印
  function plate(g, kind, x, y, r) {
    const W = F.wayfind, K = (W && W.KIND && W.KIND[kind]) || { icon: 'shop' };
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = 'rgba(58,36,22,0.94)'; g.fill();
    g.lineWidth = Math.max(1, r * 0.14); g.strokeStyle = 'rgba(236,201,124,0.95)'; g.stroke();
    g.restore();
    const is = r * 1.45;
    if (!(W && W.pict && W.pict(g, kind, x - is / 2, y - is / 2, is))) R.UIK.icon(g, K.icon, x - is / 2, y - is / 2, is, '#ffe2a4');
  }
  function arrow(g, x, y, ang, k) {
    const T = R.UIK.T;
    g.save();
    g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, -7 * k); g.lineTo(5 * k, 5 * k); g.lineTo(0, 2 * k); g.lineTo(-5 * k, 5 * k); g.closePath();
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4 * k;
    g.fillStyle = T.color.goldHi || '#fff1c8'; g.fill();
    g.shadowBlur = 0; g.lineWidth = Math.max(1, k); g.strokeStyle = 'rgba(30,18,6,0.95)'; g.stroke();
    g.restore();
  }
  /** 字の札（濃い地に明るい字。地図の絵の上でも読める） */
  function tag(g, text, x, y, size, bounds) {
    const U = R.UIK.u, pad = U(6), h = size + U(8);
    const w = R.UIK.measure(text, { size, weight: 700 }) + pad * 2;
    let bx = x - w / 2, by = y - h / 2;
    if (bounds) { bx = Math.max(bounds.x + U(2), Math.min(bounds.x + bounds.w - w - U(2), bx)); by = Math.max(bounds.y + U(2), Math.min(bounds.y + bounds.h - h - U(2), by)); }
    g.save(); R.UIK.rr(g, bx, by, w, h, h / 2); g.fillStyle = 'rgba(14,12,24,0.9)'; g.fill(); g.strokeStyle = 'rgba(236,201,124,0.8)'; g.lineWidth = 1; g.stroke(); g.restore();
    R.UIK.text(g, text, bx + pad, by + U(4), { size, weight: 700, color: '#fff1d6' });
  }

  /** 町の地図を area（論理 px）の中に、縦横比を保って大きく描く → 描いた枠 */
  TM.draw = function (g, area, mapId, o) {
    o = o || {};
    const m = R.DB.maps[mapId];
    if (!m) return null;
    const U = R.UIK.u;
    const s = Math.min(area.w / m.w, area.h / m.h);
    const w = m.w * s, h = m.h * s, x = area.x + (area.w - w) / 2, y = o.top ? area.y + U(8) : area.y + (area.h - h) / 2;   // o.top: 縦持ちは上に寄せる
    const rect = { x, y, w, h };
    g.save();
    R.UIK.rr(g, x - U(6), y - U(6), w + U(12), h + U(12), U(10)); g.fillStyle = 'rgba(10,11,20,0.85)'; g.fill();
    g.strokeStyle = 'rgba(236,201,124,0.45)'; g.lineWidth = 1; g.stroke();
    const img = painted(m);
    g.imageSmoothingEnabled = !!img;
    const base = img || tiles(m);
    if (base) g.drawImage(base, x, y, w, h);
    g.restore();
    const I = signs(m);
    // 出口（金の枠）と行き先の札
    const fs = U(12.5);
    for (const e of I.exits) {
      g.save(); g.strokeStyle = 'rgba(255,214,140,0.95)'; g.lineWidth = Math.max(1.5, U(2)); g.fillStyle = 'rgba(255,214,140,0.28)';
      g.fillRect(x + e.x * s, y + e.y * s, e.w * s, e.h * s); g.strokeRect(x + e.x * s, y + e.y * s, e.w * s, e.h * s); g.restore();
    }
    // 施設（建物の戸口・外の売り手）
    const r = Math.max(U(9), Math.min(U(14), s * 0.9));
    for (const sg of I.signs) plate(g, sg.kind, x + (sg.x + 0.5) * s, y + (sg.y + (sg.npc ? 0.5 : -0.2)) * s, r);
    // 出口の札は最後（印の上）。地図の内側へ寄せる
    for (const e of I.exits) {
      if (!e.label) continue;
      const cx = x + (e.x + e.w / 2) * s, cy = y + (e.y + e.h / 2) * s;
      const off = U(20), d = { n: [0, off], s: [0, -off], e: [-off * 2.4, 0], w: [off * 2.4, 0] }[e.dir] || [0, 0];
      tag(g, e.label, cx + d[0], cy + d[1], fs, rect);
    }
    // 一行（いちばん上。出口の札に隠れない）
    const here = S.map && S.map.id === m.id ? { x: S.x, y: S.y, dir: S.dir } : null;
    if (here) {
      const px = x + (here.x + 0.5) * s, py = y + (here.y + 0.5) * s;
      R.UIK.glow(g, px, py, U(22), [143, 214, 216], 0.8 + 0.2 * Math.sin((R.Engine.time || 0) / 400));
      arrow(g, px, py, ANG[here.dir] || 0, Math.max(1.8, U(1.7)));
    }
    return rect;
  };

  function legendItems(m) {
    const I = signs(m), seen = new Map();
    for (const sg of I.signs) { const n = nameOf(sg); if (!seen.has(n)) seen.set(n, sg.kind); }
    const items = [...seen.entries()].sort((a, b) => ORDER.indexOf(a[1]) - ORDER.indexOf(b[1])).map(([n, k]) => ({ kind: k, name: n }));
    if (I.exits.length) items.push({ exit: true, name: '出口' });
    items.push({ here: true, name: 'いま' });
    return items;
  }
  /** 凡例の並べ方（幅 width で折り返す）→ [{it, x, row}]、rows */
  function legendLayout(items, width) {
    const U = R.UIK.u, size = U(12.5), r = U(10), gap = U(18), out = [];
    let x = U(14), row = 0;
    for (const it of items) {
      const w = r * 2 + U(6) + R.UIK.measure(it.name, { size });
      if (x > U(14) && x + w > width - U(10)) { x = U(14); row++; }
      out.push({ it, x, row });
      x += w + gap;
    }
    return { cells: out, rows: row + 1 };
  }
  /** 凡例の高さ（折り返しを含む） */
  TM.legendHeight = function (mapId, width) {
    const m = R.DB.maps[mapId];
    if (!m) return 0;
    const U = R.UIK.u;
    return U(12) + legendLayout(legendItems(m), width).rows * U(26);
  };
  /** 凡例: この町にある施設の絵と呼び名、出口、いま（rect の中に横に並べる。狭ければ折り返す） */
  TM.legend = function (g, rect, mapId) {
    const m = R.DB.maps[mapId];
    if (!m) return;
    const U = R.UIK.u, T = R.UIK.T, size = U(12.5), r = U(10);
    R.UIK.panel(g, rect, { dense: true });
    for (const c of legendLayout(legendItems(m), rect.w).cells) {
      const it = c.it, x = rect.x + c.x, y = rect.y + U(8) + c.row * U(26), cy = y + U(8);
      if (it.exit) { g.save(); g.fillStyle = 'rgba(255,214,140,0.35)'; g.strokeStyle = 'rgba(255,214,140,0.95)'; g.lineWidth = U(2); g.fillRect(x + U(2), cy - U(7), r * 2 - U(4), U(14)); g.strokeRect(x + U(2), cy - U(7), r * 2 - U(4), U(14)); g.restore(); }
      else if (it.here) arrow(g, x + r, cy, 0, U(1.2));
      else plate(g, it.kind, x + r, cy, r);
      R.UIK.text(g, it.name, x + r * 2 + U(6), y, { size, color: T.color.text });
    }
  };
})(window.RPG);
