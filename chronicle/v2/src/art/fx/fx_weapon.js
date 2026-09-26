// BSCENE: 武器・打撃の効果（右向き。味方の攻撃は呼ぶ側が反転）: slash smash thrust shoot claw bite hit crit
(function (R) {
  'use strict';
  const BFX = (R.BFX = R.BFX || {});
  const add = (id, d) => BFX.add(id, d);   // fx_core.js が先に読まれる（名前順）
  const U = () => BFX.u;

  // 剣: 三日月の弧が振り抜かれる
  add('slash', {
    n: 8, w: 112, h: 112, fps: 26,
    draw(g, k) {
      const a0 = -2.2 + k * 1.2, a1 = a0 + 1.6 * U().easeOut(Math.min(1, k * 1.6));
      const fade = 1 - Math.max(0, k - 0.5) * 2;
      for (let j = 0; j < 3; j++) {
        g.strokeStyle = j === 0 ? `rgba(255,255,255,${0.95 * fade})` : j === 1 ? `rgba(255,230,170,${0.55 * fade})` : `rgba(255,200,120,${0.25 * fade})`;
        g.lineWidth = [3, 7, 13][j] * (1 - k * 0.5);
        g.lineCap = 'round';
        g.beginPath(); g.arc(-10, 4, 40, a0, a1); g.stroke();
      }
      if (k > 0.3 && k < 0.8) U().star(g, 26, 6, 14 * (1 - k), 4, '255,250,230', 0.9 * fade, k * 2);
    },
  });
  // 大剣・杖: 叩きつけ（輪が広がり、星が散る）
  add('smash', {
    n: 9, w: 120, h: 120, fps: 24,
    draw(g, k, i, rng) {
      const e = U().easeOut(k), fade = 1 - k;
      g.strokeStyle = `rgba(255,236,190,${0.8 * fade})`; g.lineWidth = 4 * fade + 1;
      g.beginPath(); g.ellipse(0, 10, 10 + e * 46, 4 + e * 16, 0, 0, 7); g.stroke();
      U().star(g, 0, 0, 30 * (1 - e * 0.6), 5, '255,255,240', 0.95 * fade, 0.3);
      U().glowDot(g, 0, 0, 40, '255,210,140', 0.5 * fade);
      for (let j = 0; j < 8; j++) {
        const a = j / 8 * Math.PI * 2 + rng.next() * 0.3, d = 12 + e * 44;
        g.fillStyle = `rgba(255,230,180,${fade})`; g.fillRect(Math.cos(a) * d, Math.sin(a) * d * 0.6, 3, 3);
      }
    },
  });
  // 短剣: 鋭い突き（細い光の線と先の火花）
  add('thrust', {
    n: 7, w: 128, h: 64, fps: 28,
    draw(g, k) {
      const e = U().easeOut(Math.min(1, k * 1.5)), fade = 1 - Math.max(0, k - 0.4) / 0.6;
      const gr = g.createLinearGradient(-60, 0, -60 + e * 110, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${0.95 * fade})`);
      g.fillStyle = gr; g.fillRect(-60, -1.5, e * 110, 3);
      g.fillStyle = `rgba(255,220,160,${0.4 * fade})`; g.fillRect(-60, -4, e * 110, 8);
      if (k > 0.25) U().star(g, -60 + e * 110, 0, 14 * fade, 4, '255,250,220', fade, 0.785);
    },
  });
  // 弓: 矢の光の筋
  add('shoot', {
    n: 7, w: 160, h: 48, fps: 28,
    draw(g, k) {
      const x = -70 + k * 140, fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      const gr = g.createLinearGradient(x - 50, 0, x, 0);
      gr.addColorStop(0, 'rgba(200,230,255,0)'); gr.addColorStop(1, `rgba(240,250,255,${0.9 * fade})`);
      g.fillStyle = gr; g.fillRect(x - 50, -1, 50, 2);
      g.fillStyle = `rgba(255,255,255,${fade})`; g.beginPath(); g.moveTo(x + 6, 0); g.lineTo(x - 2, -3); g.lineTo(x - 2, 3); g.fill();
    },
  });
  // 爪: 3 本の斜めの引っかき（敵の攻撃。赤み）
  add('claw', {
    n: 7, w: 96, h: 96, fps: 24,
    draw(g, k) {
      const e = U().easeOut(Math.min(1, k * 1.6)), fade = 1 - Math.max(0, k - 0.45) / 0.55;
      g.lineCap = 'round';
      for (let j = -1; j <= 1; j++) {
        g.strokeStyle = `rgba(255,200,190,${0.9 * fade})`; g.lineWidth = 3 * fade + 0.5;
        g.beginPath(); g.moveTo(-26 + j * 12, -30); g.lineTo(-26 + j * 12 + e * 44, -30 + e * 56); g.stroke();
        g.strokeStyle = `rgba(255,120,110,${0.35 * fade})`; g.lineWidth = 8 * fade;
        g.beginPath(); g.moveTo(-26 + j * 12, -30); g.lineTo(-26 + j * 12 + e * 44, -30 + e * 56); g.stroke();
      }
    },
  });
  // 噛みつき: 上下の弧が閉じる
  add('bite', {
    n: 7, w: 96, h: 96, fps: 24,
    draw(g, k) {
      const c = Math.min(1, k * 2), fade = 1 - Math.max(0, k - 0.5) * 2;
      g.strokeStyle = `rgba(255,236,220,${0.9 * fade})`; g.lineWidth = 3;
      g.beginPath(); g.arc(0, -30 + c * 22, 26, 0.3, Math.PI - 0.3); g.stroke();
      g.beginPath(); g.arc(0, 30 - c * 22, 26, Math.PI + 0.3, -0.3); g.stroke();
      if (c >= 1) U().star(g, 0, 0, 18 * fade, 5, '255,200,190', fade, 0);
    },
  });
  // 当たりの火花（小）
  add('hit', {
    n: 6, w: 72, h: 72, fps: 28,
    draw(g, k) {
      const fade = 1 - k;
      U().glowDot(g, 0, 0, 26, '255,240,210', 0.6 * fade);
      U().star(g, 0, 0, 22 * (0.5 + k * 0.6), 4, '255,255,255', fade, 0.4 + k);
    },
  });
  // 会心（大きな白い閃光）
  add('crit', {
    n: 8, w: 140, h: 140, fps: 26,
    draw(g, k) {
      const fade = 1 - k;
      U().glowDot(g, 0, 0, 64, '255,245,220', 0.8 * fade);
      U().star(g, 0, 0, 58 * (0.4 + k * 0.7), 8, '255,255,255', fade, k);
      g.strokeStyle = `rgba(255,220,150,${fade})`; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 20 + k * 50, 0, 7); g.stroke();
    },
  });
})(window.RPG);
