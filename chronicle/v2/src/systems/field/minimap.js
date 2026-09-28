// FIELD — 小地図（MODERN_UI §5.9・§6.2、dungeon.png。E11・E12）
//   ダンジョンの右上（手がかりの札の下）。X で 小地図 → 大きな地図（drawBig、画面の中ほど）→ 出さない（設定 fieldMap、hud.js）。
//   歩いた所の周り（4 マス）が埋まる。見つけた泉（青緑）・開けていない宝箱（金）・階段（白）の印、
//   一行の向きの矢印。下に「泉（ダンジョンでは女神の像） 宝箱 階段」の凡例。
//   埋まった所はマップごとに R.Game.explored[mapId] に書く（セーブ・合言葉に残る。オーナーの報告「通ったはずの通路が地図に表示されてない」:
//     前はこのセッションの間だけで、読み込み・再読み込みのあとは歩いた所が消えていた）。形は 'w x h : 連の長さ'（下の enc・dec）。
//     R.Game が入れ替わったら（読み込み・新しい旅・戦闘のやり直し）手元の写し S.seen を捨てて、R.Game.explored から読み直す。
//   地図の画像は 1 マス 1 px の小さなキャンバスに、見えた所だけ足していく（毎フレームは drawImage と印だけ）。
//     キャンバスの中身が消えたとき（tilePatches の変化・スマホで裏に回したときの context lost）は bits から描き直す（sync）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const M = (F.minimap = F.minimap || {});
  const REVEAL = 4;
  const WATER = /water|sea|shallow/;
  const ANG = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };

  /**
   * 歩いた所の書き方: 'w x h : 連'。連 = 埋まっていない数・埋まった数・…を交互に 36 進で '.' つなぎ（左上から行ごと）。
   * 歩いた所はひと固まりなので、ビットをそのまま書くより短い（合言葉が長くなりすぎない）
   */
  function enc(r) {
    const out = [];
    let v = 0, n = 0;
    for (let i = 0; i < r.bits.length; i++) {
      const b = r.bits[i] ? 1 : 0;
      if (b === v) { n++; continue; }
      out.push(n.toString(36)); v = b; n = 1;
    }
    if (v === 1) out.push(n.toString(36));   // 最後の埋まっていない連は書かない
    return r.w + 'x' + r.h + ':' + out.join('.');
  }
  /** enc の逆。形が合わない（マップの大きさが変わった・壊れた）ときは null（埋まっていない所から数え直す） */
  function dec(s, w, h) {
    const m = typeof s === 'string' && /^(\d+)x(\d+):([0-9a-z.]*)$/.exec(s);
    if (!m || +m[1] !== w || +m[2] !== h) return null;
    const bits = new Uint8Array(w * h);
    if (!m[3]) return bits;
    let i = 0, v = 0;
    for (const t of m[3].split('.')) {
      const n = parseInt(t, 36);
      if (!(n >= 0) || i + n > bits.length) return null;
      if (v) bits.fill(1, i, i + n);
      i += n; v ^= 1;
    }
    return bits;
  }
  M._enc = enc; M._dec = dec;

  /** 今の R.Game の歩いた所の記録（無ければ作る）。g を渡せばそのマップ（M.seenAt・テスト） */
  function recOf(m) {
    const G = R.Game || null;
    if (S.seenG !== G) { S.seen = {}; S.seenG = G; }   // 読み込み・新しい旅: 前の旅の手元の写しを使わない
    const all = (S.seen = S.seen || {});
    let r = all[m.id];
    if (!r || r.w !== m.w || r.h !== m.h) {
      const saved = G && G.explored && G.explored[m.id];
      const bits = (saved && dec(saved, m.w, m.h)) || new Uint8Array(m.w * m.h);
      r = all[m.id] = { w: m.w, h: m.h, bits, cv: R.Gfx.canvas2d(m.w, m.h), grid: null, lost: false };
      // スマホで裏に回すと 2D のキャンバスも中身が消えることがある: 戻ったら描き直す
      if (r.cv && r.cv.addEventListener) r.cv.addEventListener('contextrestored', () => { r.grid = null; });
    }
    return r;
  }
  function rec() { return recOf(S.map); }
  /** キャンバスを bits に合わせる: tilePatches が変わった・キャンバスの中身が消えた → 全部描き直す */
  function sync(m, r) {
    const g = r.cv && r.cv.getContext('2d');
    if (!g) return null;
    if (g.isContextLost && g.isContextLost()) { r.lost = true; return null; }
    const grid = R.MapUtil.grid(m);
    if (r.grid !== grid || r.lost) {
      r.grid = grid; r.lost = false;
      g.clearRect(0, 0, m.w, m.h);
      for (let i = 0; i < r.bits.length; i++) if (r.bits[i]) paint(g, m, i % m.w, (i / m.w) | 0);
    }
    return g;
  }
  /** 手元の bits を R.Game に書く（セーブに残す） */
  function store(m, r) {
    const G = R.Game;
    if (!G) return;
    if (!G.explored || typeof G.explored !== 'object') G.explored = {};
    G.explored[m.id] = enc(r);
  }
  /** 一行の周りを埋める（入ったとき・1 歩ごと） */
  M.reveal = function () {
    const m = S.map;
    if (!m || m.kind !== 'dungeon') return;
    const r = rec();
    const g = sync(m, r);
    let added = 0;
    for (let y = S.y - REVEAL; y <= S.y + REVEAL; y++) {
      if (y < 0 || y >= m.h) continue;
      for (let x = S.x - REVEAL; x <= S.x + REVEAL; x++) {
        if (x < 0 || x >= m.w) continue;
        if ((x - S.x) * (x - S.x) + (y - S.y) * (y - S.y) > REVEAL * REVEAL + 1) continue;
        const i = y * m.w + x;
        if (r.bits[i]) continue;
        if (R.MapUtil.secretHidden && R.MapUtil.secretHidden(m, x, y)) continue;   // 見つける前の隠し通路の先は地図に載せない（secrets.js）
        r.bits[i] = 1; added++;
        if (g) paint(g, m, x, y);
      }
    }
    if (added) store(m, r);
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
    if (!S.map) return false;
    const r = rec();
    return !!(r && r.bits[y * r.w + x]);
  };
  /** そのマップの歩いた所か（今のマップでなくてもよい。R.Game.explored から読む。テスト・QA 用） */
  M.seenAt = function (mapId, x, y) {
    const m = R.DB.maps[mapId];
    if (!m || x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    return !!recOf(m).bits[y * m.w + x];
  };

  M.draw = function (g, x, y, w, h) {
    const m = S.map, r = rec();
    if (!r.cv || !sync(m, r)) return;
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
    if (!r.cv || !sync(m, r)) return;
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
    const reveal = !!(R.Tester && R.Tester.opt('reveal'));   // テスト用メニュー（src/tester/）: 宝箱・隠し通路を地図に出す
    for (const o of m.objects || []) {
      if (o.cond != null && !R.State.check(o.cond)) continue;
      let col = null, cx = o.x + 0.5, cy = o.y + 0.5;
      if (o.type === 'spring' && (springs.includes(o.id) || M.seen(o.x, o.y))) { col = '#8fe8f0'; cx += 0.5; cy += 0.5; }
      else if (o.type === 'chest' && !opened.includes(o.id) && (M.seen(o.x, o.y) || reveal)) col = T.color.gold;
      else if (o.type === 'stairs' && M.seen(o.x, o.y)) col = '#f0e2c0';
      if (!col) continue;
      dia(g, ox + cx * s, oy + cy * s, d, col);
    }
    if (reveal && R.MapUtil.secretAreas) {
      for (const a of R.MapUtil.secretAreas(m)) for (const k of a.gate) {
        const [gx, gy] = k.split(',').map(Number);
        if (!R.MapUtil.secretFound(m.id, gx, gy)) dia(g, ox + (gx + 0.5) * s, oy + (gy + 0.5) * s, d, '#ff7ad0');
      }
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
    const U = R.UIK.u, T = R.UIK.T, m = S.map;
    // 回復の場所の名前: ダンジョンの中は女神の像（R.MapUtil.springLook）、町・井戸・オアシスは泉
    const heal = m && (m.objects || []).some((o) => o.type === 'spring' && R.MapUtil.springLook(m, o) === 'goddess') ? '女神の像' : '泉';
    const size = U(10 * z), gap = U(12 * z);
    let cx = x + U(2 * z);
    for (const [t, color] of [[heal, '#8fe8f0'], ['宝箱', T.color.gold], ['階段', T.color.text2]]) {
      R.UIK.text(g, t, cx, y, { size, color, shadow: true });
      cx += (R.UIK.measure ? R.UIK.measure(t, { size }) : size * t.length) + gap;
    }
  }
  function dia(g, x, y, r, col) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(10,10,20,0.6)'; g.lineWidth = 0.5; g.stroke();
  }
})(window.RPG);
