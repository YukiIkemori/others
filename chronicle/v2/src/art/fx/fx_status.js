// BSCENE: 状態・強化・弱体・呼び出し・逃げるの効果と、状態の小さな印（右上の一覧の名前の右・敵の頭の上）
//   R.BFX.statusMark(g, id, x, y, r)   印は色の丸と 1 字（毒・眠り…。17 種の名前は R.DB.statuses[id].name、無ければ id の頭）
(function (R) {
  'use strict';
  const BFX = R.BFX;
  const U = () => BFX.u;

  BFX.add('status', {
    n: 12, w: 96, h: 96, fps: 22,
    draw(g, k, i, rng) {
      const a = U().bell(k);
      for (let j = 0; j < 9; j++) {
        const x = (rng.next() - 0.5) * 50, y = 20 - ((k * 70 + j * 11) % 70), r = 3 + (j % 3) * 2;
        g.strokeStyle = `rgba(200,150,255,${0.8 * a})`; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
      }
    },
  });
  function arrows(id, rgb, up) {
    BFX.add(id, {
      n: 12, w: 96, h: 112, fps: 22,
      draw(g, k) {
        const a = U().bell(k);
        for (let j = 0; j < 3; j++) {
          const x = (j - 1) * 18, off = ((k * 60 + j * 20) % 60) * (up ? -1 : 1);
          const y = (up ? 30 : -30) + off, s = up ? -1 : 1;
          g.fillStyle = `rgba(${rgb},${0.85 * a})`;
          g.beginPath(); g.moveTo(x, y + 10 * s); g.lineTo(x - 7, y); g.lineTo(x - 2.5, y); g.lineTo(x - 2.5, y - 10 * s); g.lineTo(x + 2.5, y - 10 * s); g.lineTo(x + 2.5, y); g.lineTo(x + 7, y); g.closePath(); g.fill();
        }
      },
    });
  }
  arrows('buff', '255,220,140', true);
  arrows('debuff', '190,140,255', false);
  // 煙（呼び出し・逃げる）
  function smoke(id, rgb) {
    BFX.add(id, {
      n: 12, w: 128, h: 112, fps: 20, blend: 'source-over',
      draw(g, k, i, rng) {
        const a = 1 - k;
        for (let j = 0; j < 10; j++) {
          const ang = rng.next() * Math.PI * 2, d = 8 + k * 40 * (0.6 + rng.next() * 0.6);
          g.fillStyle = `rgba(${rgb},${0.5 * a})`;
          g.beginPath(); g.arc(Math.cos(ang) * d, Math.sin(ang) * d * 0.6 - k * 10, 10 + k * 14, 0, 7); g.fill();
        }
      },
    });
  }
  smoke('summon', '120,110,150');
  smoke('smoke', '150,150,170');
  // 盗む（光る手と品の粒）
  BFX.add('steal', {
    n: 10, w: 96, h: 96, fps: 22,
    draw(g, k) {
      const a = U().bell(k);
      U().glowDot(g, 0, 0, 30, '255,236,170', 0.5 * a);
      U().star(g, -20 + k * 40, -10 - Math.sin(k * Math.PI) * 18, 9, 4, '255,250,230', a, k * 3);
    },
  });

  // ---------------------------------------------------------------- 状態の印
  const MARK = {
    poison: ['#8fd06a', '毒'], sleep: ['#8fb0f0', '眠'], paralysis: ['#f0d060', '麻'], paralyze: ['#f0d060', '麻'], confuse: ['#f09ad0', '混'],
    blind: ['#a0a0b0', '暗'], silence: ['#b0c8e0', '封'], stone: ['#b8b0a0', '石'], charm: ['#ff9ab0', '魅'], stun: ['#ffe080', '気'],
    slow: ['#90a8d0', '遅'], haste: ['#8ee08a', '速'], regen: ['#8ee08a', '再'], protect: ['#ecc97c', '守'], shell: ['#8fd6d8', '護'],
    berserk: ['#f47e6c', '狂'], doom: ['#c090f0', '死'], guard: ['#ecc97c', '防'],
  };
  BFX.statusMark = function (g, id, x, y, r) {
    const key = typeof id === 'string' ? id : (id && (id.id || id.key)) || '';
    const d = R.DB.statuses && R.DB.statuses[key];
    const m = MARK[key] || [`hsl(${(R.U && R.U.hash ? R.U.hash(key) : 0) % 360},55%,65%)`, (d && d.name ? [...d.name][0] : [...key][0] || '?')];
    g.save();
    g.fillStyle = 'rgba(14,16,28,0.85)'; g.beginPath(); g.arc(x + r, y, r + 1.5, 0, 7); g.fill();
    g.strokeStyle = m[0]; g.lineWidth = 1.2; g.beginPath(); g.arc(x + r, y, r, 0, 7); g.stroke();
    g.fillStyle = m[0]; g.font = R.Gfx.font(r * 1.3, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(m[1], x + r, y + 0.5);
    g.restore();
  };
  BFX.statusName = function (id) {
    const d = R.DB.statuses && R.DB.statuses[id];
    if (d && d.name) return d.name;
    const N = { poison: '毒', sleep: '眠り', paralysis: 'まひ', paralyze: 'まひ', confuse: '混乱', blind: '暗闇', silence: '沈黙', stone: '石化', charm: '魅了', stun: '気絶', slow: 'スロウ', haste: '身軽', regen: '再生', protect: '守り', shell: '魔よけ', berserk: '狂戦士', doom: '死の宣告', guard: '防御' };
    return N[id] || id;
  };
})(window.RPG);
