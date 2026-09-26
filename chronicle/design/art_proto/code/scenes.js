'use strict';
(function (G) {
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const Q = new URLSearchParams(location.search);
  function sheet(scale) {
    const names = Q.get('poses') ? Q.get('poses').split(',') : ['idle', 'step', 'windup', 'slash', 'cast', 'hurt', 'kneel', 'ko', 'victory'];
    const who = Q.get('who') ? Q.get('who').split(',') : Object.keys(RIG.LOOKS);
    const z = +(Q.get('z') || 3), cw = +(Q.get('cw') || 150), rh = +(Q.get('rh') || 210);
    cv.width = Math.max(400, names.length * cw + 40); cv.height = who.length * rh + 40;
    ctx.fillStyle = Q.get('bg') || '#6c7a70'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = scale > 1;
    who.forEach((k, row) => names.forEach((n, col) => {
      const B = new RZ.Builder(); RIG.draw(B, RIG.LOOKS[k], RIG.pose(n));
      const r = RZ.render(B, { scale: scale || 1, ssaa: scale > 1 ? 2 : 1 });
      const s = z / (scale || 1);
      const x = 20 + col * cw + cw / 2, y = 20 + row * rh + rh * 0.85;
      ctx.drawImage(r.canvas, x - r.ox * s, y - r.oy * s, r.canvas.width * s, r.canvas.height * s);
    }));
  }
  G.SCENES = { sheet };
  const v = Q.get('view') || 'sheet';
  try { G.SCENES[v](+(Q.get('scale') || 1)); document.title = 'done'; } catch (e) { console.error(e.stack); document.title = 'err'; }
})(window);
