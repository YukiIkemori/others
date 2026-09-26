// Vector UI for the 1024×896 screen (smooth text, gradient windows).
'use strict';
(function (G) {
  const F = (w, px) => `${w} ${px}px ZenMaru, sans-serif`;
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function win(ctx, x, y, w, h, o) {
    o = Object.assign({ a: 0.86, r: 10 }, o);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    rr(ctx, x, y, w, h, o.r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(30,40,78,${o.a})`); g.addColorStop(1, `rgba(10,14,34,${o.a + 0.06})`);
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.save();
    // top sheen
    rr(ctx, x + 3, y + 3, w - 6, Math.min(40, h * 0.35), o.r - 3); ctx.clip();
    const s = ctx.createLinearGradient(0, y, 0, y + 40); s.addColorStop(0, 'rgba(160,180,255,0.14)'); s.addColorStop(1, 'rgba(160,180,255,0)');
    ctx.fillStyle = s; ctx.fillRect(x, y, w, 44); ctx.restore();
    ctx.save();
    rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, o.r); ctx.lineWidth = 3;
    const b = ctx.createLinearGradient(0, y, 0, y + h); b.addColorStop(0, '#f2e2b0'); b.addColorStop(0.5, '#b89a5e'); b.addColorStop(1, '#8a7042');
    ctx.strokeStyle = b; ctx.stroke();
    rr(ctx, x + 6, y + 6, w - 12, h - 12, o.r - 4); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(240,226,176,0.22)'; ctx.stroke();
    ctx.restore();
  }
  function text(ctx, s, x, y, o) {
    o = Object.assign({ px: 30, w: 500, c: '#f4f0e6', align: 'left', sh: true }, o);
    ctx.save(); ctx.font = F(o.w, o.px); ctx.textAlign = o.align; ctx.textBaseline = 'alphabetic';
    if (o.sh) { ctx.fillStyle = 'rgba(0,0,10,0.75)'; ctx.fillText(s, x + 2, y + 2); }
    ctx.fillStyle = o.c; ctx.fillText(s, x, y); ctx.restore();
    ctx.save(); ctx.font = F(o.w, o.px); const m = ctx.measureText(s).width; ctx.restore(); return m;
  }
  function bar(ctx, x, y, w, h, t, c1, c2) {
    ctx.save(); rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    if (t > 0) { rr(ctx, x + 1, y + 1, Math.max(h, (w - 2) * t), h - 2, (h - 2) / 2); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fill(); }
    ctx.restore();
  }
  function cursor(ctx, x, y, s) {
    ctx.save(); ctx.shadowColor = 'rgba(255,220,120,0.9)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 0.6); ctx.closePath();
    const g = ctx.createLinearGradient(x, y - s, x, y + s); g.addColorStop(0, '#fff6d0'); g.addColorStop(1, '#e0a840'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }
  function tab(ctx, s, x, y) {
    ctx.save(); ctx.font = F(700, 26); const w = ctx.measureText(s).width + 36; ctx.restore();
    win(ctx, x, y, w, 44, { r: 8, a: 0.95 });
    text(ctx, s, x + 18, y + 32, { px: 26, w: 700, c: '#ffe8a8' });
  }

  // battle UI: 3 windows, rows 「前 名前 HP 現在/最大 MP 現在/最大」
  function battle(ctx, st) {
    const top = 606;
    win(ctx, 18, 12, 988, 72, { a: 0.8 });
    text(ctx, st.title, 512, 60, { px: 32, w: 700, align: 'center' });
    // command window
    win(ctx, 18, top + 26, 330, 250);
    tab(ctx, st.actor, 36, top);
    st.cmds.forEach((c, i) => {
      const x = 76 + (i % 2) * 140, y = top + 102 + Math.floor(i / 2) * 64;
      text(ctx, c, x, y, { px: 34, w: 500, c: c === '術' && st.noSpell ? '#8088a0' : '#f4f0e6' });
      if (i === st.sel) cursor(ctx, x - 34, y - 11, 20);
    });
    // status window
    win(ctx, 362, top + 12, 644, 264);
    st.party.forEach((p, i) => {
      const y = top + 70 + i * 60;
      if (i === st.cur) {
        ctx.save(); rr(ctx, 376, y - 40, 616, 56, 8); const g = ctx.createLinearGradient(376, 0, 992, 0);
        g.addColorStop(0, 'rgba(255,220,140,0.26)'); g.addColorStop(1, 'rgba(255,220,140,0.02)'); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      }
      const front = p.row === '前';
      text(ctx, p.row, 386, y, { px: 30, w: 700, c: front ? '#ffb45c' : '#7cc8ff' });
      text(ctx, p.name, 426, y, { px: 30, w: 500, c: p.hp / p.mhp < 0.25 ? '#ffd060' : '#f4f0e6' });
      // HP
      text(ctx, 'HP', 618, y, { px: 20, w: 700, c: '#a8c0e8' });
      text(ctx, String(p.hp), 718, y, { px: 30, w: 500, align: 'right' });
      text(ctx, '/' + p.mhp, 720, y, { px: 20, w: 500, c: '#b8c0d8' });
      bar(ctx, 618, y + 7, 150, 6, p.hp / p.mhp, p.hp / p.mhp < 0.25 ? '#ffd060' : '#8cf0a0', p.hp / p.mhp < 0.25 ? '#c07010' : '#2c9a58');
      // MP
      text(ctx, 'MP', 800, y, { px: 20, w: 700, c: '#a8c0e8' });
      text(ctx, String(p.mp), 890, y, { px: 30, w: 500, align: 'right' });
      text(ctx, '/' + p.mmp, 892, y, { px: 20, w: 500, c: '#b8c0d8' });
      bar(ctx, 800, y + 7, 180, 6, p.mp / p.mmp, '#90c8ff', '#3a64d0');
    });
  }
  G.UI = { win, text, bar, cursor, tab, battle, rr, F };
})(window);
