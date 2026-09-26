// Mock screens: field family (town, world field, dungeon, dialogue) + the field-sprite sheet.
'use strict';
(function (G) {
  const { T } = K;
  const ctx = K.ctx;
  const SCREENS = (G.SCREENS = G.SCREENS || {});

  SCREENS.chars = async function () {
    K.begin(960, 540);
    K.logical();
    const g = ctx.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, '#1a2034'); g.addColorStop(1, '#0c0f1a'); ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
    K.text('フィールドの人物　4方向 × 3コマ（1 art px = 2 device px、32 px タイル）', 24, 34, { size: 15, w: 700 });
    const ids = ['arun', 'selma', 'sylvan', 'viola'], dirs = ['down', 'left', 'right', 'up'];
    ctx.imageSmoothingEnabled = false;
    ids.forEach((id, r) => {
      const L = BATTLE_ART.LOOKS[id];
      K.text(L.name, 24, 92 + r * 58, { size: 12, c: T.c.text2 });
      dirs.forEach((d, c) => [0, 1, 2].forEach((f) => {
        const s = FIELD_CHAR.sprite(L, d, f, { lantern: id === 'arun' });
        const x = 110 + c * 120 + f * 36, y = 100 + r * 58;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y - 1, 9, 3, 0, 0, 7); ctx.fill();
        ctx.drawImage(s.canvas, x - s.ox, y - s.oy);
      }));
    });
    // x3 zoom of the leader
    K.text('×3', 620, 92, { size: 12, c: T.c.text2 });
    dirs.forEach((d, c) => {
      const s = FIELD_CHAR.sprite(BATTLE_ART.LOOKS.arun, d, 0, { lantern: true });
      const x = 660 + (c % 2) * 150, y = 250 + Math.floor(c / 2) * 170;
      ctx.drawImage(s.canvas, x - s.ox * 3, y - s.oy * 3, s.canvas.width * 3, s.canvas.height * 3);
    });
    ['innkeeper', 'sailor', 'girl', 'merchant'].forEach((k, i) => {
      const s = FIELD_CHAR.sprite(BATTLE_ART.NPC[k], 'down', 0);
      ctx.drawImage(s.canvas, 110 + i * 60 - s.ox, 380 - s.oy);
      const s2 = FIELD_CHAR.sprite(BATTLE_ART.NPC[k], 'right', 1);
      ctx.drawImage(s2.canvas, 110 + i * 60 - s2.ox, 460 - s2.oy);
    });
    K.text('町の人（同じ骨組み・見た目データ）', 110, 500, { size: 11, c: T.c.text3 });
  };
})(window);
