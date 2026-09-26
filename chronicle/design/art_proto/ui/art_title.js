// Title backdrop: the night sea, the lighthouse on its cliff, moon, aurora, the party looking out.
'use strict';
(function (G) {
  const { rng, vnoise } = G.RZ;
  const mk = ENV.mk;
  function title(W, H, o) {
    o = o || {};
    const c = mk(W, H), x = c.getContext('2d');
    const horizon = H * 0.6;
    BATTLE_ART.nightSky(x, W, horizon + 20, { moon: [W * 0.47, H * 0.12, H * 0.045], auroraY: 0.42, auroraW: 1, seed: 12 });
    // far islands / mountains silhouettes
    const sil = (y0, amp, col, seed, freq) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, horizon); for (let i = 0; i <= W; i += 4) { const h = (vnoise(i * freq, 0, seed) - 0.3) * amp; x.lineTo(i, y0 - Math.max(0, h)); } x.lineTo(W, horizon); x.closePath(); x.fill(); };
    sil(horizon, H * 0.12, '#1a2544', 3, 0.004); sil(horizon, H * 0.07, '#141c34', 5, 0.008);
    // sea
    const sg = x.createLinearGradient(0, horizon, 0, H); sg.addColorStop(0, '#1a2848'); sg.addColorStop(0.3, '#0e1830'); sg.addColorStop(1, '#060a18');
    x.fillStyle = sg; x.fillRect(0, horizon, W, H - horizon);
    const R = rng(4);
    for (let i = 0; i < 2600; i++) { const y = horizon + Math.pow(R(), 1.4) * (H - horizon), d = (y - horizon) / (H - horizon); const band = W * 0.47 + (R() - 0.5) * (40 + d * 500);
      const xx = R() < 0.55 ? band : R() * W; const k = R() < 0.55 ? 0.25 + R() * 0.5 : 0.05 + R() * 0.12;
      x.fillStyle = `rgba(200,215,255,${k * (1 - d * 0.4)})`; x.fillRect(Math.floor(xx / 2) * 2, Math.floor(y / 2) * 2, 4 + Math.floor(R() * 10 * (0.4 + d)), 2); }
    // cliff (right) in crisp pixels, then the lighthouse + party
    const cc = mk(W / 2, H / 2), cx = cc.getContext('2d'), img = cx.createImageData(W / 2, H / 2), D = img.data;
    const top = (i) => H / 2 * 0.56 + (vnoise(i * 0.02, 1, 7) - 0.5) * 30 + Math.max(0, (W / 2 * 0.62 - i)) * 0.9;
    for (let i = 0; i < W / 2; i++) { const t0 = top(i); for (let y = Math.floor(t0); y < H / 2; y++) { const e = y - t0; let l = 0.35 + (vnoise(i * 0.08, y * 0.03, 8) - 0.5) * 0.5 - e * 0.002; if (e < 3) l = 0.2; if (vnoise(i * 0.4, y * 0.05, 9) > 0.8) l -= 0.2;
      const grassy = e < 5 + vnoise(i * 0.2, 0, 10) * 4; const col = grassy ? [26 + l * 30, 40 + l * 40, 44 + l * 40] : [18 + l * 40, 20 + l * 42, 34 + l * 60]; const q = (y * W / 2 + i) * 4; D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255; } }
    cx.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = false; x.drawImage(cc, 0, 0, W, H);
    // lighthouse (baked prop, scaled crisp)
    const lh = TOPDOWN.prop('lighthouse', { scale: 1.5 });
    const lx = W * 0.84, ly = top(W * 0.84 / 2) * 2 + 16;
    x.drawImage(lh.canvas, Math.round(lx - lh.ox * 2), Math.round(ly - lh.oy * 2), lh.canvas.width * 2, lh.canvas.height * 2);
    const bx = lx, by = ly - 80 * 1.5 * 2;
    x.save(); x.globalCompositeOperation = 'lighter'; x.filter = 'blur(6px)';
    const beam = (a, len, w, k) => { const g = x.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len); g.addColorStop(0, `rgba(255,236,190,${k})`); g.addColorStop(1, 'rgba(255,236,190,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(a - w) * len, by + Math.sin(a - w) * len); x.lineTo(bx + Math.cos(a + w) * len, by + Math.sin(a + w) * len); x.closePath(); x.fill(); };
    beam(Math.PI * 1.04, W * 0.9, 0.06, 0.4); beam(Math.PI * 1.04, W * 0.6, 0.02, 0.35); x.restore();
    ENV.glow(x, bx, by, 160, [255, 200, 130], 0.55); ENV.glow(x, bx, by, 26, [255, 240, 200], 0.8);
    // party (back view) on the cliff edge, lantern
    const L = BATTLE_ART.LOOKS; ['viola', 'sylvan', 'arun', 'selma'].forEach((id, i) => {
      const s = FIELD_CHAR.sprite(L[id], 'up', 0, { lantern: id === 'arun', scale: 1.15 });
      const px = W * 0.64 + i * 52, py = top(px / 2) * 2 + 8;
      x.drawImage(s.canvas, Math.round(px - s.ox * 2), Math.round(py - s.oy * 2), s.canvas.width * 2, s.canvas.height * 2);
      if (id === 'arun') ENV.glow(x, px + 16, py - 16, 120, [255, 190, 110], 0.5);
    });
    BATTLE_ART.fireflies(x, 30, [W * 0.5, H * 0.55, W * 0.5, H * 0.4], 9, [[255, 200, 120], [140, 240, 220]]);
    ENV.post(x, { dofPx: 0, bloom: 0.6, thr: 0.6, vig: 0.65, grade: { sh: [-4, 2, 16], hi: [16, 8, -8], sat: 1.05, con: 1.08, lift: 0 } });
    return c;
  }
  G.TITLE_ART = { title };
})(window);
