// Battle harness only (NOT shipped): stand-in monster sprites and backdrops for
// keys the art owners have not registered yet, so scene screenshots are readable.
// Never overrides an existing key.
(function (R) {
  'use strict';
  const G = R.Gfx;
  const def = (k, f) => { if (!G.has(k)) G.def(k, f); };
  const ramp = (c, n) => G.ramp(c, n || 5, 0.55);

  function eyes(p, x, y, dx, col) {
    p.rect(x, y, 3, 3, '#ffffff'); p.set(x + 1, y + 1, col || '#101010');
    p.rect(x + dx, y, 3, 3, '#ffffff'); p.set(x + dx + 1, y + 1, col || '#101010');
  }
  def('mon:jelly', () => {
    const p = G.pix(32, 32);
    p.shadeEllipse(16, 21, 12, 9, ramp('#3c8cff'));
    p.poly([[10, 16], [22, 16], [16, 4]], '#5aa0ff');
    p.shadeEllipse(16, 12, 4, 6, ramp('#5aa0ff', 4));
    p.set(12, 17, '#ffffff'); p.set(13, 16, '#ffffff');
    eyes(p, 11, 19, 7);
    p.hline(13, 18, 25, '#20206a'); p.set(12, 24, '#20206a'); p.set(19, 24, '#20206a');
    p.outline('#101830');
    return p.toCanvas();
  });
  def('mon:goblin', () => {
    const p = G.pix(48, 48);
    p.shadeEllipse(24, 34, 10, 10, ramp('#8a5a2a'));
    p.rect(17, 41, 5, 6, '#4a8a2a'); p.rect(27, 41, 5, 6, '#4a8a2a');
    p.shadeEllipse(24, 17, 10, 9, ramp('#5aaa3a'));
    p.poly([[13, 14], [5, 9], [15, 19]], '#5aaa3a'); p.poly([[35, 14], [43, 9], [33, 19]], '#5aaa3a');
    eyes(p, 18, 15, 9, '#c02010');
    p.hline(20, 28, 22, '#1a3a10'); p.set(21, 23, '#ffffff'); p.set(27, 23, '#ffffff');
    p.shadeEllipse(11, 32, 3, 6, ramp('#5aaa3a', 4)); p.shadeEllipse(37, 32, 3, 6, ramp('#5aaa3a', 4));
    p.line(38, 36, 44, 22, '#6a4020', 3); p.shadeEllipse(44, 20, 3, 4, ramp('#7a5030', 4));
    p.outline('#101a08');
    return p.toCanvas();
  });
  def('mon:wolf', () => {
    const p = G.pix(48, 48);
    p.shadeEllipse(24, 32, 14, 9, ramp('#8a8a9a'));
    p.rect(13, 36, 4, 10, '#6a6a7a'); p.rect(31, 36, 4, 10, '#6a6a7a'); p.rect(19, 38, 4, 9, '#7a7a8a'); p.rect(26, 38, 4, 9, '#7a7a8a');
    p.shadeEllipse(24, 20, 9, 8, ramp('#9a9aaa'));
    p.poly([[16, 16], [14, 5], [21, 13]], '#8a8a9a'); p.poly([[32, 16], [34, 5], [27, 13]], '#8a8a9a');
    p.shadeEllipse(24, 25, 5, 4, ramp('#c0c0cc', 4));
    eyes(p, 18, 17, 9, '#e0c020');
    p.set(24, 24, '#101010'); p.hline(22, 26, 28, '#501010');
    p.outline('#181820');
    return p.toCanvas();
  });
  def('mon:skeleton', () => {
    const p = G.pix(48, 48);
    const b = '#e8e4d8', s = '#a8a498';
    p.shadeEllipse(24, 12, 8, 8, ramp(b, 4));
    p.rect(19, 10, 4, 4, '#200808'); p.rect(26, 10, 4, 4, '#200808'); p.set(20, 11, '#ff4020'); p.set(27, 11, '#ff4020');
    p.hline(20, 28, 17, s);
    p.vline(24, 20, 34, b); for (let i = 0; i < 4; i++) p.hline(18, 30, 22 + i * 3, i % 2 ? s : b);
    p.line(18, 22, 10, 32, b, 2); p.line(30, 22, 38, 32, b, 2);
    p.line(21, 34, 18, 46, b, 2); p.line(27, 34, 30, 46, b, 2);
    p.line(38, 34, 44, 12, '#b0b8c8', 2); p.hline(36, 42, 30, '#806030');
    p.outline('#201810');
    return p.toCanvas();
  });
  def('mon:darkmage', () => {
    const p = G.pix(48, 48);
    p.poly([[24, 4], [38, 46], [10, 46]], '#5a2a8a');
    p.shadeEllipse(24, 34, 12, 12, ramp('#6a3aa0'));
    p.shadeEllipse(24, 16, 7, 7, ramp('#2a1a3a', 4));
    p.rect(20, 15, 2, 2, '#ffe040'); p.rect(26, 15, 2, 2, '#ffe040');
    p.line(38, 44, 42, 10, '#8a6030', 2); p.shadeEllipse(42, 8, 3, 3, ramp('#ff60c0', 4));
    p.outline('#140820');
    return p.toCanvas();
  });
  def('mon:wyvern', () => {
    const p = G.pix(64, 64);
    p.poly([[30, 26], [2, 8], [8, 30], [22, 36]], '#3a8a4a'); p.poly([[34, 26], [62, 8], [56, 30], [42, 36]], '#3a8a4a');
    p.shadeEllipse(32, 40, 12, 14, ramp('#4aaa5a'));
    p.shadeEllipse(32, 42, 6, 10, ramp('#d8c888', 4));
    p.shadeEllipse(32, 18, 8, 8, ramp('#4aaa5a'));
    eyes(p, 27, 16, 7, '#ff3020');
    p.poly([[28, 24], [36, 24], [32, 30]], '#f0e8d0');
    p.rect(22, 52, 5, 10, '#3a8a4a'); p.rect(37, 52, 5, 10, '#3a8a4a');
    p.outline('#0c2010');
    return p.toCanvas();
  });
  def('mon:orc', () => {
    const p = G.pix(64, 64);
    p.shadeEllipse(32, 40, 17, 16, ramp('#6a8a3a'));
    p.shadeEllipse(32, 42, 12, 10, ramp('#8a5a2a'));
    p.shadeEllipse(32, 18, 11, 10, ramp('#6a8a3a'));
    eyes(p, 25, 15, 11, '#ff2010');
    p.set(27, 24, '#ffffff'); p.set(37, 24, '#ffffff'); p.hline(28, 36, 25, '#2a1a08');
    p.rect(20, 54, 8, 9, '#4a3a20'); p.rect(36, 54, 8, 9, '#4a3a20');
    p.line(52, 50, 58, 20, '#7a5a30', 4);
    p.outline('#101808');
    return p.toCanvas();
  });
  def('mon:boss_goblin_chief', () => {
    const p = G.pix(64, 64);
    p.poly([[32, 22], [56, 62], [8, 62]], '#a02020');
    p.shadeEllipse(32, 44, 14, 14, ramp('#8a5a2a'));
    p.shadeEllipse(32, 22, 13, 11, ramp('#5aaa3a'));
    p.poly([[20, 18], [6, 10], [22, 24]], '#5aaa3a'); p.poly([[44, 18], [58, 10], [42, 24]], '#5aaa3a');
    for (let i = 0; i < 5; i++) p.poly([[21 + i * 5, 12], [25 + i * 5, 12], [23 + i * 5, 4 + (i % 2) * 3]], '#ffd24a');
    p.rect(21, 11, 23, 3, '#e0b030');
    eyes(p, 25, 19, 11, '#c02010');
    p.hline(26, 38, 28, '#1a3a10'); p.set(27, 29, '#ffffff'); p.set(37, 29, '#ffffff');
    p.line(50, 50, 60, 16, '#6a4020', 4); p.shadeEllipse(60, 14, 4, 5, ramp('#8a8a8a', 4));
    p.outline('#101a08');
    return p.toCanvas();
  });

  function backdrop(sky0, sky1, far, g0, g1, deco) {
    return () => {
      const cv = G.makeCanvas(256, 144), c = cv.getContext('2d');
      let gr = c.createLinearGradient(0, 0, 0, 100);
      gr.addColorStop(0, sky0); gr.addColorStop(1, sky1);
      c.fillStyle = gr; c.fillRect(0, 0, 256, 100);
      c.fillStyle = far;
      for (let x = 0; x < 256; x += 2) { const h = 12 + Math.sin(x / 23) * 6 + Math.sin(x / 7) * 2; c.fillRect(x, 100 - h, 2, h); }
      gr = c.createLinearGradient(0, 98, 0, 144);
      gr.addColorStop(0, g1); gr.addColorStop(1, g0);
      c.fillStyle = gr; c.fillRect(0, 98, 256, 46);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 90; i++) c.fillRect((i * 97) % 256, 100 + ((i * 53) % 44), 3, 1);
      if (deco) deco(c);
      return cv;
    };
  }
  def('bbg:grass', backdrop('#4a8ae8', '#bfe0ff', '#5a8a6a', '#3c9a32', '#62b84a', (c) => {
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, w] of [[30, 20, 34], [150, 12, 46], [210, 34, 26]]) { c.fillRect(x, y, w, 6); c.fillRect(x + 6, y - 4, w - 14, 4); }
  }));
  def('bbg:castle', backdrop('#1a0c14', '#4a1a2a', '#2a1418', '#5a1a1a', '#8a2a2a', (c) => {
    c.fillStyle = '#3a2028';
    for (let x = 12; x < 256; x += 48) c.fillRect(x, 10, 14, 90);
    c.fillStyle = '#ffb040'; for (let x = 16; x < 256; x += 48) c.fillRect(x + 2, 40, 3, 5);
  }));
  def('bbg:cave', backdrop('#0c0a10', '#241c24', '#1a1418', '#2a2018', '#4a3a2a'));
})(window.RPG);
