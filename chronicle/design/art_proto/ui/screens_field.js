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
(function (G) {
  const { T } = K;
  const ctx = K.ctx;
  const SCREENS = G.SCREENS;
  G.fieldView = function (o, scene, vx, vy, vxT, vyT, popt) {
    const tall = o.layout === 'tall';
    const W = tall ? 540 : 960, H = tall ? 1169 : 540;
    K.begin(W, H, tall ? 1.3 : 1);
    const out = TOPDOWN.present(scene.c, tall ? vxT : vx, tall ? vyT : vy, W, H, popt);
    K.device(); ctx.drawImage(out, 0, 0); K.logical();
    return { W, H, tall, vx: tall ? vxT : vx, vy: tall ? vyT : vy };
  };
  SCREENS.town_raw = async function (o) { const s = TOPDOWN.town(); G.fieldView(o, s, 32, 70, 240, 0); };
})(window);
(function (G) {
  const { T } = K;
  const ctx = K.ctx;
  const SCREENS = G.SCREENS;
  const U = (v) => K.U(v);

  // ---- field HUD pieces (MODERN_UI.md §5.2)
  function placeCard(x, y, name, sub, icons) {
    K.diamond(x + 10, y + 14, 9, 'rgba(236,201,124,0.18)', 'rgba(236,201,124,0.85)', 1);
    K.diamond(x + 10, y + 14, 4, T.c.gold, null);
    K.text(name, x + U(28), y + U(20), { size: 19, w: 700, shadow: 'rgba(0,0,0,0.9)', blur: 6 });
    const w = K.measure(name, 19, 700);
    K.hline(x + U(24), x + U(40) + w + U(60), y + U(28), 0.45, '236,201,124');
    if (sub) K.text(sub, x + U(28), y + U(44), { size: 11.5, c: T.c.text2, shadow: 'rgba(0,0,0,0.9)', blur: 4 });
    if (icons) icons.forEach((ic, i) => { K.icon(ic, x + U(28) + i * U(20), y + U(52), U(14), T.c.text2); });
  }
  function leadCard(x, y, w, title, where, dir) {
    K.panel(x, y, w, U(54), { a: 0.55, r: 10, blur: 8 });
    K.icon('quest', x + U(10), y + U(10), U(16), T.c.gold);
    K.text('手がかり', x + U(32), y + U(22), { size: 10, w: 700, c: T.c.gold, track: 1 });
    K.text(title, x + U(32), y + U(40), { size: 13.5, w: 700 });
    if (where) K.text(where, x + w - U(12), y + U(22), { size: 10, c: T.c.text3, align: 'right' });
    if (dir != null) { // compass needle toward the pinned place
      const cx = x + w - U(22), cy = y + U(36);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir); ctx.beginPath(); ctx.moveTo(0, -U(8)); ctx.lineTo(U(4), U(4)); ctx.lineTo(0, U(1.5)); ctx.lineTo(-U(4), U(4)); ctx.closePath(); ctx.fillStyle = T.c.gold; ctx.fill(); ctx.restore();
    }
  }
  function bubble(x, y, label, btn) {
    const w = K.measure(label, 12, 700) + U(38), h = U(24);
    ctx.save(); K.rr(x - w / 2, y - h, w, h, h / 2); ctx.fillStyle = 'rgba(14,16,28,0.82)'; ctx.fill(); ctx.strokeStyle = 'rgba(236,201,124,0.6)'; ctx.lineWidth = 0.75; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - U(5), y); ctx.lineTo(x, y + U(6)); ctx.lineTo(x + U(5), y); ctx.closePath(); ctx.fillStyle = 'rgba(14,16,28,0.82)'; ctx.fill(); ctx.restore();
    K.glyph(btn || 'a', x - w / 2 + U(14), y - h / 2, { size: 11 });
    K.text(label, x - w / 2 + U(28), y - h / 2 + U(4.5), { size: 12, w: 700 });
  }
  function toast(x, y, icon, label) {
    const w = K.measure(label, 11.5, 500) + U(40);
    K.panel(x, y, w, U(28), { a: 0.6, r: 14, frost: false });
    // a small spinning-emblem look for autosave
    ctx.save(); ctx.strokeStyle = T.c.gold; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x + U(15), y + U(14), U(6), -0.3, 4.2); ctx.stroke(); ctx.restore();
    K.diamond(x + U(15), y + U(14), U(2.5), T.c.gold);
    K.text(label, x + U(28), y + U(18.5), { size: 11.5, c: T.c.text2 });
  }
  function touchControls(W, H) {
    // virtual stick (bottom-left), A/B (bottom-right), menu (top-right)
    const sx = 96, sy = H - 150;
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 62, 0, 7); ctx.fillStyle = 'rgba(12,14,24,0.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(240,228,200,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(sx + 10, sy - 6, 26, 0, 7); ctx.fillStyle = 'rgba(240,228,200,0.25)'; ctx.fill(); ctx.restore();
    const bx = W - 80, by = H - 170;
    [['A', bx, by + 20, 40], ['B', bx - 86, by + 70, 32]].forEach(([l, x, y, r]) => { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = 'rgba(12,14,24,0.45)'; ctx.fill(); ctx.strokeStyle = 'rgba(240,228,200,0.45)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); K.text(l, x, y + 8, { size: 18, w: 700, c: 'rgba(245,238,224,0.85)', align: 'center' }); });
    K.text('話す', bx, by + 20 + 60, { size: 10.5, c: T.c.text2, align: 'center' });
    K.text('走る', bx - 86, by + 70 + 50, { size: 10.5, c: T.c.text2, align: 'center' });
  }
  function menuButton(x, y) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fillStyle = 'rgba(12,14,24,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(240,228,200,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = T.c.text; [-7, 0, 7].forEach((d) => ctx.fillRect(x - 11, y + d - 1.2, 22, 2.4)); ctx.restore();
  }
  G.FIELD_HUD = { placeCard, leadCard, bubble, toast, touchControls, menuButton };

  SCREENS.town = async function (o) {
    const s = TOPDOWN.town();
    const v = G.fieldView(o, s, 32, 70, 240, 0);
    const toL = (tx, ty) => [(tx * 32 - v.vx), (ty * 32 - v.vy)];
    if (!v.tall) {
      placeCard(20, 18, '港町ファロス', '潮風と灯台の町', ['inn', 'shop', 'bag', 'journal']);
      leadCard(700, 18, 244, '森で人が消える', '西・フェルン', -Math.PI / 2);
      const [gx, gy] = toL(13.15, 11.7); bubble(gx, gy - 52, '話す');
      toast(20, 494, 'save', 'オートセーブしました');
      K.prompts([['y', 'メニュー'], ['x', '地図'], ['b', '走る']], 944, 518, { size: 11 });
    } else {
      placeCard(16, 16, '港町ファロス', '潮風と灯台の町', ['inn', 'shop', 'bag', 'journal']);
      leadCard(16, 110, 330, '森で人が消える', '西・フェルン', -Math.PI / 2);
      menuButton(v.W - 40, 44);
      const [gx, gy] = toL(13.15, 11.7); bubble(gx, gy - 60, '話す');
      toast(16, v.H - 300, 'save', 'オートセーブしました');
      touchControls(v.W, v.H);
    }
  };
})(window);
(function (G) {
  const SCREENS = G.SCREENS;
  SCREENS.dungeon_raw = async function (o) { const s = TOPDOWN.dungeon(); G.fieldView(o, s, 0, 40, 60, 0, { thr: 0.55 }); };
  SCREENS.field_raw = async function (o) { const s = TOPDOWN.world(); G.fieldView(o, s, 64, 16, 256, 0, { thr: 0.58 }); };
})(window);
(function (G) {
  const { T } = K; const ctx = K.ctx; const SCREENS = G.SCREENS; const H = G.FIELD_HUD;
  function minimap(x, y, w, h, grid, tileFn, cols, party, marks) {
    K.panel(x, y, w, h, { a: 0.55, r: 10, blur: 6 });
    const rows = grid.length, cw = (w - 16) / cols, ch = (h - 16) / rows, s = Math.min(cw, ch);
    const ox = x + (w - s * cols) / 2, oy = y + (h - s * rows) / 2;
    for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
      const t = tileFn(tx, ty); if (t === '#') continue;
      const seen = ty < 22;
      ctx.fillStyle = t === '~' ? (seen ? 'rgba(90,170,190,0.55)' : 'rgba(90,170,190,0.12)') : (seen ? 'rgba(236,226,200,0.42)' : 'rgba(236,226,200,0.08)');
      ctx.fillRect(ox + tx * s, oy + ty * s, s + 0.2, s + 0.2);
    }
    (marks || []).forEach(([tx, ty, c, ic]) => { K.diamond(ox + tx * s + s / 2, oy + ty * s + s / 2, 3.2, c, 'rgba(0,0,0,0.6)', 0.5); });
    const [px, py] = party; ctx.save(); ctx.translate(ox + px * s, oy + py * s); ctx.rotate(-Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 3.5); ctx.lineTo(0, 1.5); ctx.lineTo(-3.5, 3.5); ctx.closePath(); ctx.fillStyle = T.c.goldHi; ctx.fill(); ctx.restore();
  }
  SCREENS.dungeon = async function (o) {
    const s = TOPDOWN.dungeon();
    const v = G.fieldView(o, s, 0, 40, 60, 0, { thr: 0.55 });
    const toL = (tx, ty) => [(tx * 32 - v.vx), (ty * 32 - v.vy)];
    const DUNROWS = 33;
    if (!v.tall) {
      H.placeCard(20, 18, '潮鳴りの洞窟', '地下1階　・　潮が引いている');
      H.leadCard(700, 18, 244, '帰らずの船長', '諸島・ネレイ岬', Math.PI * 0.75);
      minimap(806, 82, 138, 150, new Array(DUNROWS), (x, y) => TOPDOWN.dunTile(x, y), 30, [12.1, 8.6], [[9.5, 8.5, '#8fe8f0'], [23.5, 6.5, T.c.gold], [24.5, 13.5, '#f0e2c0']]);
      K.text('泉', 806, 246, { size: 10, c: '#8fe8f0' }); K.text('宝箱', 832, 246, { size: 10, c: T.c.gold }); K.text('階段', 868, 246, { size: 10, c: T.c.text2 });
      const [sx, sy] = toL(9.5, 8.9); H.bubble(sx, sy - 58, '泉で休む');
      K.prompts([['y', 'メニュー'], ['x', '地図'], ['minus', '地図を隠す']], 944, 518, { size: 11 });
    }
  };
  SCREENS.field = async function (o) {
    const s = TOPDOWN.world();
    const v = G.fieldView(o, s, 64, 16, 256, 0, { thr: 0.58 });
    if (!v.tall) {
      H.placeCard(20, 18, 'ファロス街道', '西の森へ続く道');
      H.leadCard(700, 18, 244, '森で人が消える', '西・フェルン', -Math.PI / 2);
      // landmark labels in the world (discovered places), small and thin
      const lab = (tx, ty, t, c) => { const x = tx * 32 - v.vx, y = ty * 32 - v.vy; K.diamond(x, y, 3, c || T.c.gold); K.text(t, x + 8, y + 4, { size: 11, w: 700, c: T.c.text, shadow: 'rgba(0,0,0,0.95)', blur: 5 }); };
      lab(27.5, 5.8, 'ミルの村'); lab(29.5, 12.2, 'ファロス灯台'); lab(8.4, 13.4, '見張りの塔跡', '#8fe8f0');
      H.toast(20, 494, 'save', '街道に出た　・　オートセーブ');
      K.prompts([['y', 'メニュー'], ['x', '地図'], ['b', '走る']], 944, 518, { size: 11 });
    }
  };
})(window);
