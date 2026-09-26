// BSCENE: 術の効果（属性ごと）と詠唱の輪・回復: cast fire ice thunder wind earth light dark heal mp revive
(function (R) {
  'use strict';
  const BFX = R.BFX;
  const U = () => BFX.u;
  const E = (k) => BFX.ELEM[k];

  // 詠唱: 足もとの魔法陣（楕円の輪と文字の点）＋立ちのぼる光
  BFX.add('cast', {
    n: 12, w: 128, h: 128, fps: 24,
    draw(g, k, i) {
      const a = U().bell(k);
      g.save();
      g.translate(0, 34);
      g.scale(1, 0.34);
      g.strokeStyle = `rgba(160,230,235,${0.8 * a})`; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 44, 0, 7); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.stroke();
      for (let j = 0; j < 12; j++) {
        const ang = j / 12 * Math.PI * 2 + i * 0.12;
        g.fillStyle = `rgba(220,250,255,${a})`; g.fillRect(Math.cos(ang) * 39 - 2, Math.sin(ang) * 39 - 2, 4, 4);
      }
      g.restore();
      const gr = g.createLinearGradient(0, 34, 0, -50);
      gr.addColorStop(0, `rgba(143,214,216,${0.35 * a})`); gr.addColorStop(1, 'rgba(143,214,216,0)');
      g.fillStyle = gr; g.fillRect(-30, -50, 60, 84);
    },
  });

  BFX.add('fire', {
    n: 12, w: 128, h: 144, fps: 22,
    draw(g, k, i, rng) {
      const a = U().bell(k), [c, hi] = E('fire');
      U().glowDot(g, 0, 20, 60, c, 0.45 * a);
      for (let j = 0; j < 14; j++) {
        const x = (rng.next() - 0.5) * 60, rise = (k * 90 + j * 9) % 90, s = 10 + rng.next() * 12;
        const y = 40 - rise, f = 1 - rise / 90;
        g.fillStyle = `rgba(${j % 3 ? c : hi},${0.8 * a * f})`;
        g.beginPath(); g.moveTo(x - s * 0.5 * f, y); g.quadraticCurveTo(x, y - s * 2 * f, x + s * 0.5 * f, y); g.quadraticCurveTo(x, y + s * 0.4, x - s * 0.5 * f, y); g.fill();
      }
    },
  });
  BFX.add('ice', {
    n: 11, w: 128, h: 128, fps: 22,
    draw(g, k, i, rng) {
      const a = U().bell(k), [c, hi] = E('ice'), e = U().easeOut(Math.min(1, k * 1.8));
      U().glowDot(g, 0, 0, 56, c, 0.4 * a);
      for (let j = 0; j < 7; j++) {
        const ang = -Math.PI / 2 + (j - 3) * 0.42 + (rng.next() - 0.5) * 0.2, len = (22 + rng.next() * 26) * e;
        g.fillStyle = `rgba(${j % 2 ? hi : c},${0.9 * a})`;
        g.beginPath();
        g.moveTo(Math.cos(ang - 0.12) * 6, 26 + Math.sin(ang - 0.12) * 6);
        g.lineTo(Math.cos(ang) * len, 26 + Math.sin(ang) * len);
        g.lineTo(Math.cos(ang + 0.12) * 6, 26 + Math.sin(ang + 0.12) * 6);
        g.fill();
      }
      for (let j = 0; j < 10; j++) { g.fillStyle = `rgba(${hi},${a})`; g.fillRect((rng.next() - 0.5) * 90, (rng.next() - 0.5) * 90, 2, 2); }
    },
  });
  BFX.add('thunder', {
    n: 9, w: 96, h: 200, fps: 24,
    draw(g, k, i, rng) {
      const a = k < 0.6 ? 1 : (1 - k) / 0.4, [c, hi] = E('thunder');
      if (i % 3 === 2) return;
      U().glowDot(g, 0, 70, 50, c, 0.5 * a);
      g.lineJoin = 'miter';
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? `rgba(${hi},${a})` : `rgba(${c},${0.5 * a})`; g.lineWidth = pass ? 2.5 : 8;
        g.beginPath(); let x = (rng.next() - 0.5) * 10, y = -100; g.moveTo(x, y);
        while (y < 80) { y += 14 + rng.next() * 16; x += (rng.next() - 0.5) * 26; g.lineTo(x, y); }
        g.stroke();
      }
    },
  });
  BFX.add('wind', {
    n: 12, w: 128, h: 128, fps: 24,
    draw(g, k, i) {
      const a = U().bell(k), [c, hi] = E('wind');
      g.lineCap = 'round';
      for (let j = 0; j < 4; j++) {
        const r = 14 + j * 11, a0 = k * 9 + j * 1.7;
        g.strokeStyle = `rgba(${j % 2 ? hi : c},${0.8 * a})`; g.lineWidth = 3 - j * 0.4;
        g.beginPath(); g.ellipse(0, 10 - j * 8, r * 1.3, r * 0.5, 0, a0, a0 + 2.2); g.stroke();
      }
    },
  });
  BFX.add('earth', {
    n: 10, w: 128, h: 128, fps: 22,
    draw(g, k, i, rng) {
      const a = U().bell(k), [c, hi] = E('earth');
      for (let j = 0; j < 9; j++) {
        const x = (rng.next() - 0.5) * 80, up = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (26 + rng.next() * 30), s = 6 + rng.next() * 9;
        g.fillStyle = `rgba(${j % 3 ? c : hi},${0.95 * a})`;
        g.beginPath(); g.moveTo(x - s, 40 - up); g.lineTo(x, 40 - up - s * 1.2); g.lineTo(x + s, 40 - up); g.lineTo(x + s * 0.4, 40 - up + s * 0.6); g.closePath(); g.fill();
      }
      g.fillStyle = `rgba(${c},${0.35 * a})`; g.beginPath(); g.ellipse(0, 42, 50, 10, 0, 0, 7); g.fill();
    },
  });
  BFX.add('light', {
    n: 12, w: 144, h: 144, fps: 24,
    draw(g, k) {
      const a = U().bell(k), [c, hi] = E('light');
      U().glowDot(g, 0, 0, 64, c, 0.55 * a);
      for (let j = 0; j < 12; j++) {
        const ang = j / 12 * Math.PI * 2 + k, len = 30 + 30 * a;
        g.strokeStyle = `rgba(${hi},${0.7 * a})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(Math.cos(ang) * 10, Math.sin(ang) * 10); g.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); g.stroke();
      }
      const gr = g.createLinearGradient(0, -72, 0, 40);
      gr.addColorStop(0, 'rgba(255,245,210,0)'); gr.addColorStop(1, `rgba(255,245,210,${0.5 * a})`);
      g.fillStyle = gr; g.fillRect(-10, -72, 20, 112);
    },
  });
  BFX.add('dark', {
    n: 12, w: 128, h: 128, fps: 22,
    draw(g, k, i, rng) {
      const a = U().bell(k), [c, hi] = E('dark');
      U().glowDot(g, 0, 0, 52, c, 0.5 * a);
      for (let j = 0; j < 16; j++) {
        const ang = j / 16 * Math.PI * 2 + k * 4, d = 44 * (1 - k) + 6;
        g.fillStyle = `rgba(${j % 2 ? hi : c},${a})`; g.fillRect(Math.cos(ang) * d, Math.sin(ang) * d * 0.8, 3, 3);
      }
      g.strokeStyle = `rgba(${hi},${0.6 * a})`; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 16 + 20 * (1 - k), k * 6, k * 6 + 4); g.stroke();
    },
  });
  // 回復: 立ちのぼる光の粒と十字
  function sparkle(id, elem) {
    BFX.add(id, {
      n: 14, w: 96, h: 128, fps: 24,
      draw(g, k, i, rng) {
        const a = U().bell(k), [c, hi] = E(elem);
        U().glowDot(g, 0, 20, 44, c, 0.35 * a);
        for (let j = 0; j < 12; j++) {
          const x = (rng.next() - 0.5) * 50, y = 40 - ((k * 100 + j * 13) % 100), s = 1.5 + (j % 3);
          g.fillStyle = `rgba(${j % 2 ? hi : c},${a})`;
          g.fillRect(x - s / 2, y - s * 1.5, s, s * 3); g.fillRect(x - s * 1.5, y - s / 2, s * 3, s);
        }
      },
    });
  }
  sparkle('heal', 'heal');
  sparkle('mp', 'mp');
  // 立ち上がり（蘇生）: 光の柱
  BFX.add('revive', {
    n: 14, w: 96, h: 176, fps: 22,
    draw(g, k) {
      const a = U().bell(k);
      const gr = g.createLinearGradient(0, -88, 0, 60);
      gr.addColorStop(0, 'rgba(255,250,220,0)'); gr.addColorStop(0.7, `rgba(255,240,200,${0.6 * a})`); gr.addColorStop(1, `rgba(255,240,200,${0.2 * a})`);
      g.fillStyle = gr; g.fillRect(-18 * a, -88, 36 * a, 150);
      BFX.u.glowDot(g, 0, 50, 40, '255,236,180', 0.5 * a);
    },
  });
})(window.RPG);
