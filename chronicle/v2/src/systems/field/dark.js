// FIELD — 暗がり（E6、V2_PLAN §2.5.9、WORLD_REDESIGN §6.4）
//   map.dark（true = 全体、[{rect, cond}] = その範囲）の中は、一行の周り 4 マス・ともしたしょく台の周り 3 マス・泉の周り 3 マスの外を
//   暗い膜で覆う。膜は 1/4 の解像度の 1 枚に、焼いておいた穴の絵を destination-out で抜く（毎フレーム新しい物を作らない）。
//   宝箱と泉のきらめきは膜の上（layers.js）。範囲に入ったら場所の名前の横に「暗い」（hud.js）。
//   灯りの外で始まった戦闘は setup.dark（R.Mon.encounter の o.dark）。一行のランタンは数えない（しょく台・泉の灯りだけ）。
//   松明（i_torch、RULES の use {type:'light', r, steps}）: R.Field.light(r, steps) の間は一行の灯りが r マスになり、灯りの中として数える。
//   範囲の縁は 1.5 マスかけて少しずつ暗くする（四角い線に見せない、CONTENT-F の依頼）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const D = (F.dark = F.dark || {});
  D.PARTY_R = 4; D.LAMP_R = 3; D.SPRING_R = 3;
  let mask = null, mg = null, hole = null;
  const vis = { px: 0, py: 0 };

  D.on = function () { return !!(S.map && S.map.dark); };
  /** 一行の灯りの半径（マス）: 松明の間は広い */
  D.partyR = function () { return S.torch && S.torch.steps > 0 ? Math.max(D.PARTY_R, S.torch.r) : D.PARTY_R; };
  /** (x, y) がしょく台（ともした）・泉の光の中か */
  D.litAt = function (x, y) {
    const m = S.map, G = R.Game || {};
    if (!m) return false;
    const lit = (G.lit && G.lit[m.id]) || [];
    for (const o of m.objects || []) {
      if (o.type === 'brazier' && lit.includes(o.id)) { if (Math.hypot(o.x - x, o.y - y) <= D.LAMP_R + 0.01) return true; }
      else if (o.type === 'spring') { if (Math.hypot(o.x + 0.5 - x, o.y + 0.5 - y) <= D.SPRING_R + 0.72) return true; }
    }
    return false;
  };
  /** 見えるか（暗がりの外、一行の周り、灯りの中）。テスト・小地図用 */
  D.visibleAt = function (x, y) {
    if (!D.on() || !R.MapUtil.darkAt(S.map, x, y)) return true;
    if (Math.hypot(S.x - x, S.y - y) <= D.partyR() + 0.01) return true;
    return D.litAt(x, y);
  };
  /** 出現の setup.dark: 暗がりの中で、灯りの外 */
  D.battleDark = function (x, y) {
    if (S.torch && S.torch.steps > 0) return false;   // 松明を掲げている間は灯りの中
    return !!(S.map && R.MapUtil.darkAt(S.map, x, y) && !D.litAt(x, y));
  };

  function ensure() {
    const w = Math.ceil(R.W / 4) + 2, h = Math.ceil(R.H / 4) + 2;
    if (!mask || mask.width !== w || mask.height !== h) {
      mask = R.Gfx.canvas2d(w, h);
      mg = mask && mask.getContext('2d');
    }
    if (!hole) {
      hole = R.Gfx.canvas2d(64, 64);
      if (hole) {
        const g = hole.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.62, 'rgba(0,0,0,0.92)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }
    }
    return !!(mask && hole);
  }
  function punch(x, y, r) {
    // x, y, r は画面の論理 px → 膜は 1/4
    const s = (r * 2) / 4;
    mg.drawImage(hole, x / 4 - s / 2 + 1, y / 4 - s / 2 + 1, s, s);
  }

  D.draw = function (g, cam) {
    if (!D.on()) return;
    if (!ensure()) return;
    const m = S.map, t = cam.t, cx = cam.cx, cy = cam.cy, G = R.Game || {};
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, mask.width, mask.height);
    mg.fillStyle = 'rgba(5,6,18,0.93)';
    const d = m.dark;
    if (d === true) mg.fillRect(0, 0, mask.width, mask.height);
    else {
      for (let i = 0; i < d.length; i++) {
        const e = d[i];
        if (e.cond != null && !R.State.check(e.cond)) continue;
        if (!e.rect) { mg.fillRect(0, 0, mask.width, mask.height); continue; }
        const r = e.rect;
        // 縁をぼかす: 外へ 1.5 マス・内へ 0.5 マスの間を 6 枚の薄い膜で重ねる（重なった内側が 0.93 になる）
        const x0 = (r[0] * t - cx) / 4 + 1, y0 = (r[1] * t - cy) / 4 + 1, w0 = (r[2] * t) / 4, h0 = (r[3] * t) / 4, q = t / 4;
        mg.fillStyle = 'rgba(5,6,18,0.36)';
        for (let k = 0; k < 6; k++) {
          const o = q * (1.5 - (k * 2) / 5);   // 1.5 → -0.5 マス
          mg.fillRect(x0 - o, y0 - o, w0 + o * 2, h0 + o * 2);
        }
        mg.fillStyle = 'rgba(5,6,18,0.93)';
      }
    }
    mg.globalCompositeOperation = 'destination-out';
    // 一行のランタン（4 マス）: 少し揺らぐ
    F._vis(vis);
    const fl = 1 + Math.sin(R.Engine.time / 170) * 0.025;
    punch((vis.px + 0.5) * t - cx, (vis.py + 0.5) * t - cy, (D.partyR() + 0.9) * t * fl);
    const lit = (G.lit && G.lit[m.id]) || [];
    for (const o of m.objects || []) {
      if (o.type === 'brazier' && lit.includes(o.id)) punch((o.x + 0.5) * t - cx, (o.y + 0.5) * t - cy, (D.LAMP_R + 0.9) * t);
      else if (o.type === 'spring') punch((o.x + 1) * t - cx, (o.y + 1) * t - cy, (D.SPRING_R + 1.4) * t);
    }
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(mask, -4, -4, mask.width * 4, mask.height * 4);
    g.restore();
    // 消えたしょく台は遠くからでも輪郭が見える（WORLD §6.4）
    g.save();
    g.strokeStyle = 'rgba(190,180,230,0.35)'; g.lineWidth = 1;
    for (const o of m.objects || []) {
      if (o.type !== 'brazier' || lit.includes(o.id)) continue;
      const x = (o.x + 0.5) * t - cx, y = (o.y + 1) * t - cy;
      if (x < -t || y < -t || x > R.W + t || y > R.H + t) continue;
      g.strokeRect(Math.round(x - 8 * t / 32) + 0.5, Math.round(y - 24 * t / 32) + 0.5, Math.round(16 * t / 32), Math.round(8 * t / 32));
      g.beginPath(); g.moveTo(x, y - 16 * t / 32); g.lineTo(x, y - 2); g.stroke();
    }
    g.restore();
  };
})(window.RPG);
