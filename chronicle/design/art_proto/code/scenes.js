'use strict';
(function (G) {
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const Q = new URLSearchParams(location.search);
  function sheet(scale) {
    cv.width = 1400; cv.height = 900; ctx.fillStyle = '#6c7a70'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    const names = Q.get('poses') ? Q.get('poses').split(',') : ['idle', 'step', 'windup', 'slash', 'cast', 'hurt', 'kneel', 'ko', 'victory'];
    (Q.get('who') ? Q.get('who').split(',') : Object.keys(RIG.LOOKS)).forEach((k, row) => {
      names.forEach((n, col) => {
        const B = new RZ.Builder(); RIG.draw(B, RIG.LOOKS[k], RIG.pose(n));
        const r = RZ.render(B, { scale: scale || 1 });
        const s = (+Q.get('z') || 3) / (scale || 1);
        const cw = 26 * s * (scale||1) * 0 + (+Q.get('cw') || 150);
        const x = 80 + col * cw, y = (+Q.get('y0') || 190) + row * (+Q.get('rh') || 200);
        ctx.drawImage(r.canvas, x - r.ox * s, y - r.oy * s, r.canvas.width * s, r.canvas.height * s);
      });
    });
  }
  G.SCENES = { sheet };
  const v = Q.get('view') || 'sheet';
  try { G.SCENES[v](+(Q.get('scale') || 1)); document.title = 'done'; } catch (e) { console.error(e.stack); document.title = 'err'; }
})(window);
