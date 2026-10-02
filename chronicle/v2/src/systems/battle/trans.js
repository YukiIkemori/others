// BSCENE: 戦闘に入る・出る移り（2026-09-27 の遊びの声「戦闘に急に入るし、急に終わるのおかしい」）。
//   入る: 短い効果音 → 今の画面（フィールド）を写して、白い光 → 砕けて飛び散る（ボスは赤い光 → 渦を巻いて闇に閉じる → 間）
//         → 真っ暗で戦闘の場面を積む → 場面の中で暗さが明ける（scene.js の intro: 一行が右から入り、敵が浮かび上がる）。
//   出る: 場面の中で暗くなる（R.Engine.fadeTo）→ 場面を外す → フィールドが明ける。
//   設定 reduceMotion: ただの暗転（0.3 秒）。
//   _.trans.cover(info) → Promise（画面が真っ暗になったら解決）。_.trans.drop() で重ね描きを外す。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const T = (_.trans = {});
  const BG = '#070812';
  const OV = 'battle:trans';

  T.MS = { normal: 760, boss: 1500, reduce: 300 };
  T.reduce = function () {
    try { return !!(R.Settings.get('reduceMotion') || (R.UIK && R.UIK.reduceMotion && R.UIK.reduceMotion())); } catch (e) { return false; }
  };

  // ---------------------------------------------------------------- 効果音（無ければ足す。CORE の id 表の外なので戦闘の中だけで使う）
  function ensureSfx() {
    const X = R.DB && R.DB.sfx;
    if (!X) return;
    if (!X.encounter) {
      X.encounter = (S) => {
        S.noise({ a: 0.01, d: 0.16, r: 0.12, vol: 0.22, bp: 700, bp2: 5200, q: 1.1 });
        S.tone({ w: 'sawtooth', f: 180, f2: 1400, sd: 0.16, d: 0.14, r: 0.04, vol: 0.07, lp: 5000 });
        S.seq([76, 83, 88, 95], 0.035, { t: 0.1, w: 'p25', d: 0.03, r: 0.06, vol: 0.09, lp: 7000 });
        S.noise({ t: 0.16, d: 0.02, r: 0.45, vol: 0.34, hp: 2500 });
        S.fm({ n: 91, t: 0.16, ratio: 3.5, index: 2.2, md: 0.2, d: 0.01, r: 0.5, vol: 0.08 });
        S.tone({ w: 'sine', f: 110, f2: 55, sd: 0.3, t: 0.16, d: 0.04, r: 0.3, vol: 0.3 });
        S.wet(0.35);
      };
    }
    if (!X.encounter_boss) {
      X.encounter_boss = (S) => {
        S.tone({ w: 'sine', f: 72, f2: 34, sd: 1.3, a: 0.01, d: 1.0, r: 0.5, vol: 0.5 });
        S.noise({ a: 0.02, d: 0.5, r: 0.9, vol: 0.4, lp: 320, rate: 0.5 });
        S.tone({ w: 'sawtooth', n: 38, a: 0.2, d: 0.9, r: 0.5, vol: 0.09, lp: 700, vib: [5, 25] });
        S.tone({ w: 'sawtooth', n: 39, a: 0.2, d: 0.9, r: 0.5, vol: 0.08, lp: 700, vib: [6, 30] });
        S.fm({ n: 81, t: 0.02, ratio: 1.41, index: 3, md: 0.8, d: 0.02, r: 1.4, vol: 0.07 });
        S.noise({ t: 0.9, a: 0.3, d: 0.2, r: 0.4, vol: 0.12, bp: 900, q: 0.8 });
        S.wet(0.45);
      };
    }
  }
  function sfx(id) { try { ensureSfx(); if (R.Audio && R.Audio.sfx) R.Audio.sfx(id); } catch (e) { /* 音が無くても止めない */ } }

  // ---------------------------------------------------------------- 写し
  function snapshot() {
    const cv = R.Gfx && R.Gfx.canvas;
    if (!cv || typeof document === 'undefined' || !cv.width) return null;
    // 今の場面を描き直してから写す（前のフレームには閉じたばかりのキャプションが残っていることがある。テスター 2026-10-01 P20）
    try { if (R.Engine && R.Engine.render) R.Engine.render(); } catch (e) { /* 写しは前のフレームのまま */ }
    try {
      const c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height;
      c.getContext('2d').drawImage(cv, 0, 0);
      return c;
    } catch (e) { return null; }
  }

  /** 画面を三角のかけらに分ける（格子の頂点を少しずらす。隣り合う三角は頂点を共有して隙間なし） */
  function shards(W, H, seed) {
    const cols = 9, rows = 5, rng = R.rng ? R.rng('shatter:' + seed) : { next: Math.random };
    const P = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++) {
        const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
        const jx = edgeX ? 0 : (rng.next() - 0.5) * W / cols * 0.7, jy = edgeY ? 0 : (rng.next() - 0.5) * H / rows * 0.7;
        row.push([i * W / cols + jx, j * H / rows + jy]);
      }
      P.push(row);
    }
    const cx = W * 0.5, cy = H * 0.52, out = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
        const tris = (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        for (const t of tris) {
          const mx = (t[0][0] + t[1][0] + t[2][0]) / 3, my = (t[0][1] + t[1][1] + t[2][1]) / 3;
          const dx = mx - cx, dy = my - cy, dist = Math.max(1, Math.hypot(dx, dy));
          const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
          out.push({
            t, mx, my, ux: dx / dist, uy: dy / dist, dist,
            sp: 0.7 + rng.next() * 0.6, rot: (rng.next() - 0.5) * 2.4, delay: (dist / Math.hypot(cx, cy)) * 0.18 + rng.next() * 0.06,
            bb: [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1],
          });
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- 描く
  function drawNormal(g, s, t) {
    const W = R.W, H = R.H, snap = s.snap, S = snap ? snap.width / W : 1;
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    const crackT = 110, flyMs = s.ms - crackT - 80;
    if (!snap) {
      g.globalAlpha = Math.min(1, t / s.ms); g.fillStyle = BG; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
      return;
    }
    const e0 = Math.max(0, (t - crackT) / flyMs);
    for (const p of s.shards) {
      const e = Math.max(0, Math.min(1, (e0 - p.delay) / (1 - p.delay)));
      if (e >= 1) continue;
      const ee = e * e;
      const push = (p.dist * 0.6 + 120) * ee * p.sp;
      const sc = 1 + ee * 0.9;
      const alpha = 1 - Math.pow(e, 1.6);
      g.save();
      g.globalAlpha = alpha;
      g.translate(p.mx + p.ux * push, p.my + p.uy * push + ee * 60);
      g.rotate(p.rot * ee);
      g.scale(sc, sc);
      g.translate(-p.mx, -p.my);
      g.beginPath(); g.moveTo(p.t[0][0], p.t[0][1]); g.lineTo(p.t[1][0], p.t[1][1]); g.lineTo(p.t[2][0], p.t[2][1]); g.closePath();
      g.save(); g.clip();
      const [x0, y0, x1, y1] = p.bb;
      g.drawImage(snap, Math.max(0, x0 * S), Math.max(0, y0 * S), Math.max(1, (x1 - x0) * S), Math.max(1, (y1 - y0) * S), x0, y0, x1 - x0, y1 - y0);
      if (e > 0) { g.fillStyle = `rgba(255,248,230,${0.35 * (1 - e)})`; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
      g.restore();
      g.strokeStyle = `rgba(255,250,236,${(t < crackT ? t / crackT : 1) * 0.7 * (1 - e)})`; g.lineWidth = 1.2; g.stroke();
      g.restore();
    }
    // 白い光（ひびの前に一度強く、砕けた瞬間にもう一度）
    const fl = t < crackT ? Math.sin(Math.PI * t / crackT) * 0.85 : Math.max(0, 0.45 - (t - crackT) / 260);
    if (fl > 0) { g.fillStyle = `rgba(255,252,242,${fl})`; g.fillRect(0, 0, W, H); }
    // 終わりに向けて闇が濃くなる
    const dk = Math.max(0, (t - s.ms * 0.7) / (s.ms * 0.3));
    if (dk > 0) { g.fillStyle = BG; g.globalAlpha = Math.min(1, dk); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  }

  function drawBoss(g, s, t) {
    const W = R.W, H = R.H, snap = s.snap;
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    const flashT = 200, closeT = s.ms - 380;   // 最後の 380 ms は闇のまま（間）
    const e = Math.max(0, Math.min(1, (t - flashT) / (closeT - flashT)));
    const ee = e * e * (3 - 2 * e);
    if (snap && e < 1) {
      g.save();
      const shake = t < flashT + 260 ? (1 - Math.max(0, t - flashT) / 260) * 5 : 0;
      g.translate(W / 2 + Math.sin(t / 17) * shake, H / 2 + Math.cos(t / 23) * shake * 0.6);
      // 渦: 大きくなりながら少しずつ回る。いくつかの層をずらして重ねる（ひずみの代わり）
      const sc = 1 + ee * 0.35;
      for (let k = 0; k < 3; k++) {
        g.save();
        g.globalAlpha = k === 0 ? 1 : 0.28 * ee;
        g.rotate(ee * (0.35 + k * 0.12));
        g.scale(sc + k * 0.05 * ee, sc + k * 0.05 * ee);
        g.drawImage(snap, -W / 2, -H / 2, W, H);
        g.restore();
      }
      g.restore();
      // 赤く沈む
      g.fillStyle = `rgba(70,6,16,${0.45 * ee})`; g.fillRect(0, 0, W, H);
      // 丸い闇が外から閉じる（縁は暗い紅）
      const R0 = Math.hypot(W, H) * 0.56, r = Math.max(0, R0 * Math.pow(1 - ee, 1.2));
      const cx = W / 2, cy = H * 0.5;
      g.save();
      g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2, true);
      g.fillStyle = BG; g.fill('evenodd');
      const gr = g.createRadialGradient(cx, cy, Math.max(0, r * 0.55), cx, cy, Math.max(1, r));
      gr.addColorStop(0, 'rgba(120,10,24,0)'); gr.addColorStop(0.8, 'rgba(120,14,30,0.45)'); gr.addColorStop(1, 'rgba(7,8,18,1)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // 赤みの光
    const fl = t < flashT ? Math.sin(Math.PI * t / flashT) : 0;
    if (fl > 0) { g.fillStyle = `rgba(255,214,200,${0.8 * fl})`; g.fillRect(0, 0, W, H); }
  }

  function drawReduce(g, s, t) {
    g.globalAlpha = Math.min(1, t / s.ms);
    g.fillStyle = BG; g.fillRect(0, 0, R.W, R.H);
    g.globalAlpha = 1;
  }

  /**
   * 戦闘に入る移り（場面を積む前）。info = {boss}。→ Promise（画面が真っ暗になったら解決。重ね描きは残る。drop() で外す）
   */
  T.cover = function (info) {
    info = info || {};
    const reduce = T.reduce();
    const kind = reduce ? 'reduce' : info.boss ? 'boss' : 'normal';
    const s = { kind, t0: R.Engine.time, ms: T.MS[kind], snap: reduce ? null : snapshot() };
    if (kind === 'normal' && s.snap) s.shards = shards(R.W, R.H, (R.Game && R.Game.steps) || 0);
    T.state = s;
    sfx(kind === 'boss' ? 'encounter_boss' : 'encounter');
    R.Engine.overlay(OV, (g) => {
      const t = Math.min(s.ms, R.Engine.time - s.t0);
      if (s.done) { g.fillStyle = BG; g.fillRect(0, 0, R.W, R.H); return; }
      if (kind === 'boss') drawBoss(g, s, t);
      else if (kind === 'normal') drawNormal(g, s, t);
      else drawReduce(g, s, t);
    }, 900);
    return R.until(() => R.Engine.time - s.t0 >= s.ms).then(() => { s.done = true; });
  };
  /** 入る移りの重ね描きを外す（戦闘の場面が真っ暗の幕を引き継いだ後） */
  T.drop = function () { R.Engine.overlay(OV, null); if (T.state) T.state.snap = null; T.state = null; };
})(window.RPG);
