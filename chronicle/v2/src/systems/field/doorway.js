// FIELD — 屋内の出口の戸口（持ち主 2026-09-28「全ての建物内部のグラフィック、出口部分がぽっかり空間空いてるだけで違和感ある」）。
//   屋内（kind 'interior'）の出口のマスが下の壁の切れ目なら、部屋の絵を描き直さずに、その上へ戸口を重ねて描く:
//     両側の戸の柱（壁の材で木か石）・壁の厚みの影・敷居・外の夜へ沈む通り道・内側の足ふきマット・外からのやわらかい光のさし込み。
//     先頭が 2 マス以内に来たら、外へ向く小さな矢印（町の出口の矢印と同じ形）。
//   出口のデータ（exits の座標）と壁の材だけから作るので、どの屋内にも付く。描いた絵（map.art.image）の屋内は絵に戸口があるので既定では付けない
//   （map.doorway: true で付ける、false で付けない）。マットは戸口の内のマスが絨毯・物・人の立つ所なら置かない。
//   R.Field.doorways(map) → [{x, y, dir, pal, mat}]（テスト用・キャッシュ）
//   F._doorways(g, t, cx, cy)（地面の上・人の下。layers.js）/ F._doorwayArrows(g, t, cx, cy)（膜の上、町の道しるべと同じ所）
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});

  // 戸の柱の色（壁の材ごと）: base 塗り・hi 上と左の明かり・lo 縁と影・sill 敷居
  const WOOD = { base: '#553820', hi: '#7a5534', lo: '#22150b', sill: '#6e5236', sillHi: '#8e6e4a' };
  const PAL = {
    wall_wood: WOOD,
    wall_bark: { base: '#4a3220', hi: '#6c4c31', lo: '#1e120a', sill: '#634a31', sillHi: '#826346' },
    wall_moss: { base: '#4c3c26', hi: '#6e5a3a', lo: '#1c150c', sill: '#645436', sillHi: '#84704c' },
    wall_stone: { base: '#5c5a55', hi: '#7c7972', lo: '#252422', sill: '#6c6963', sillHi: '#8c8880' },
    wall_brick: { base: '#6a574a', hi: '#8a7262', lo: '#2a1f19', sill: '#6c6963', sillHi: '#8c8880' },
    wall_sandstone: { base: '#8c7454', hi: '#ac9270', lo: '#4a3726', sill: '#9a8462', sillHi: '#b8a07c' },
  };
  const MAT = { base: '#5a2f24', edge: '#3a2016', band: '#7a4a2c', mid: '#8a5a34', fringe: '#8c6c4a' };
  const RUGS = { carpet: 1, rug: 1 };
  const cache = {};

  function cellOf(m, x, y) { return R.MapUtil.cell(m, x, y); }
  function solidAt(m, x, y) { const c = cellOf(m, x, y); return !c || !!c.solid || c.walk === false; }
  function objAt(m, x, y) { return (m.objects || []).some((o) => o.x === x && o.y === y && o.type !== 'trail'); }
  function npcAt(m, x, y) { return (m.npcs || []).some((n) => n.x === x && n.y === y && (n.move == null || n.move === 'still')); }

  /** 屋内の戸口の一覧（マップごとに 1 回） */
  F.doorways = function (m) {
    if (!m) return [];
    if (cache[m.id] && cache[m.id].m === m) return cache[m.id].list;
    const list = [];
    const painted = !!(m.art && m.art.image);
    if (m.kind === 'interior' && m.doorway !== false && (!painted || m.doorway === true)) {
      for (const e of m.exits || []) {
        for (let i = 0; i < (e.w || 1); i++) for (let j = 0; j < (e.h || 1); j++) {
          const x = e.x + i, y = e.y + j;
          // 下の壁の切れ目: 両隣が壁、内（上）が床、外（下）はマップの外か壁
          if (!solidAt(m, x - 1, y) || !solidAt(m, x + 1, y) || solidAt(m, x, y - 1)) continue;
          if (y < (m.h || m.rows.length) - 1 && !solidAt(m, x, y + 1)) continue;
          const wall = (cellOf(m, x - 1, y) || {}).mat;
          const up = cellOf(m, x, y - 1) || {};
          const mat = !RUGS[up.mat] && !objAt(m, x, y - 1) && !npcAt(m, x, y - 1);
          list.push({ x, y, dir: 's', pal: PAL[wall] || (/stone|brick|basalt|sand/.test(wall || '') ? PAL.wall_stone : WOOD), mat });
        }
      }
    }
    cache[m.id] = { m, list };
    return list;
  };

  function post(g, x, y, w, h, p, u) {
    g.fillStyle = p.lo; g.fillRect(x - u, y - u, w + 2 * u, h + 2 * u);
    g.fillStyle = p.base; g.fillRect(x, y, w, h);
    g.fillStyle = p.hi; g.fillRect(x, y, w, Math.max(1, Math.round(1.5 * u))); g.fillRect(x, y, Math.max(1, Math.round(u)), h);
    // 木目か石の継ぎ目（2 本の細い線）
    g.fillStyle = p.lo; g.globalAlpha = 0.35;
    g.fillRect(x + Math.round(w * 0.55), y + Math.round(h * 0.2), Math.max(1, Math.round(u * 0.8)), Math.round(h * 0.35));
    g.fillRect(x + Math.round(w * 0.3), y + Math.round(h * 0.62), Math.max(1, Math.round(u * 0.8)), Math.round(h * 0.28));
    g.globalAlpha = 1;
  }

  /** 地面の上・人の下: 戸口の絵 */
  F._doorways = function (g, t, cx, cy) {
    const m = S.map;
    if (!m || m.kind !== 'interior') return;
    const list = F.doorways(m);
    if (!list.length) return;
    const u = t / 32, r = Math.round, px1 = Math.max(1, r(u));
    g.save();
    for (let i = 0; i < list.length; i++) {
      const d = list[i], p = d.pal;
      const X = r(d.x * t - cx), Y = r(d.y * t - cy);
      if (X < -t * 2 || Y < -t * 2 || X > R.W + t * 2 || Y > R.H + t * 2) continue;
      // 敷居（壁の厚みのまん中の横木／石）。この後の暗がりで外側ほど沈む
      const sy = r(Y + 0.4 * t), sh = r(0.13 * t);
      g.fillStyle = p.lo; g.fillRect(X, sy - px1, t, sh + 2 * px1);
      g.fillStyle = p.sill; g.fillRect(X, sy, t, sh);
      g.fillStyle = p.sillHi; g.fillRect(X, sy, t, px1);
      // 外の夜へ沈む通り道（床の続きが下ほど暗く）＋外の石段のふち
      const gr = g.createLinearGradient(0, Y + 0.12 * t, 0, Y + t);
      gr.addColorStop(0, 'rgba(10,12,24,0)'); gr.addColorStop(0.45, 'rgba(10,12,24,0.45)'); gr.addColorStop(1, 'rgba(6,7,14,0.92)');
      g.fillStyle = gr; g.fillRect(X, r(Y + 0.12 * t), t, t - r(0.12 * t));
      g.fillStyle = 'rgba(150,165,205,0.16)'; g.fillRect(X + r(0.14 * t), r(Y + 0.74 * t), t - r(0.28 * t), px1);
      // 壁の厚みの影（戸口の両の内側）
      g.fillStyle = 'rgba(0,0,0,0.32)';
      g.fillRect(X, Y, r(0.12 * t), t); g.fillRect(X + t - r(0.12 * t), Y, r(0.12 * t), t);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(X + r(0.12 * t), Y, r(0.06 * t), t); g.fillRect(X + t - r(0.18 * t), Y, r(0.06 * t), t);
      // 両側の戸の柱（壁の帯の中に収める細い枠。上に小さな頭）
      const pw = r(0.14 * t), py = r(Y - 0.02 * t), ph = t + r(0.02 * t);
      for (const x0 of [X - r(0.08 * t), X + t - r(0.06 * t)]) {
        g.fillStyle = p.lo; g.fillRect(x0 - px1, py - px1, pw + 2 * px1, ph + px1);
        g.fillStyle = p.base; g.fillRect(x0, py, pw, ph);
        g.fillStyle = p.hi; g.fillRect(x0, py, px1, ph);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 + pw - px1, py, px1, ph);
        // 柱の頭（床の縁の高さ）
        g.fillStyle = p.lo; g.fillRect(x0 - 2 * px1, py - 2 * px1, pw + 4 * px1, r(0.1 * t) + px1);
        g.fillStyle = p.hi; g.fillRect(x0 - px1, py - px1, pw + 2 * px1, r(0.06 * t));
      }
      // 足ふきマット（戸口の内のマス。敷居の手前の床に。横長の織りの敷物、短い辺に房）
      if (d.mat) {
        const mw = r(0.78 * t), mh = r(0.3 * t), mx = X + r(0.11 * t), my = r(Y - 0.37 * t);
        g.fillStyle = 'rgba(6,4,2,0.28)'; g.fillRect(mx + px1, my + px1 * 2, mw, mh);
        g.fillStyle = MAT.edge; g.fillRect(mx, my + px1, mw, mh - 2 * px1); g.fillRect(mx + px1, my, mw - 2 * px1, mh);
        g.fillStyle = MAT.band; g.fillRect(mx + px1, my + px1, mw - 2 * px1, mh - 2 * px1);
        g.fillStyle = MAT.base; g.fillRect(mx + r(2.5 * u), my + r(2.5 * u), mw - r(5 * u), mh - r(5 * u));
        // まん中の菱形の柄
        const kx = mx + r(mw / 2), ky = my + r(mh / 2), kr = Math.max(2, r(mh * 0.28));
        g.fillStyle = MAT.mid;
        g.beginPath(); g.moveTo(kx - kr * 1.6, ky); g.lineTo(kx, ky - kr); g.lineTo(kx + kr * 1.6, ky); g.lineTo(kx, ky + kr); g.closePath(); g.fill();
        // 房（左右の短い辺）
        g.fillStyle = MAT.fringe;
        for (let k = 0; k < 3; k++) { const fy = my + r(2 * u) + r(k * (mh - 4 * u) / 2); g.fillRect(mx - r(1.5 * u), fy, r(1.5 * u), px1); g.fillRect(mx + mw, fy, r(1.5 * u), px1); }
      }
      // 外からの光のさし込み（戸口から部屋へ、青白い夜の光。加算でうっすら）
      g.globalCompositeOperation = 'lighter';
      const top = Y - 1.3 * t, bot = Y + 0.25 * t;
      const lg = g.createLinearGradient(0, bot, 0, top);
      lg.addColorStop(0, 'rgba(90,120,180,0.16)'); lg.addColorStop(0.5, 'rgba(80,110,170,0.06)'); lg.addColorStop(1, 'rgba(80,110,170,0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(X + 0.14 * t, bot); g.lineTo(X + 0.86 * t, bot); g.lineTo(X + 1.35 * t, top); g.lineTo(X - 0.35 * t, top); g.closePath();
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  };

  /** 膜の上: 先頭が近いときの外へ向く矢印（↓、外へ少し揺れる） */
  F._doorwayArrows = function (g, t, cx, cy) {
    const m = S.map;
    if (!m || m.kind !== 'interior') return;
    const list = F.doorways(m);
    if (!list.length) return;
    const u = t / 32, tm = R.Engine.time;
    const v = F._vis({});
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const dist = Math.max(Math.abs(v.px - d.x), Math.abs(v.py - d.y));
      if (dist > 2.5) continue;
      const a = Math.min(1, (2.5 - dist) / 0.8);
      const bob = (0.5 + 0.5 * Math.sin(tm / 300)) * 3 * u;
      const x = (d.x + 0.5) * t - cx, y = (d.y + 0.66) * t - cy + bob;
      g.save();
      g.globalAlpha = 0.9 * a;
      g.translate(x, y);
      const s = 8 * u;
      g.beginPath(); g.moveTo(-s * 0.7, -s * 0.5); g.lineTo(0, s * 0.4); g.lineTo(s * 0.7, -s * 0.5); g.lineTo(0, -s * 0.15); g.closePath();
      g.lineJoin = 'round'; g.lineWidth = Math.max(1, s * 0.28); g.strokeStyle = 'rgba(28,16,10,0.85)'; g.stroke();
      g.fillStyle = '#ffe3a0'; g.fill();
      g.restore();
    }
  };
})(window.RPG);
