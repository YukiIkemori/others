// Modern UI toolkit for the mock screens (MODERN_UI.md §3). Everything is drawn in LOGICAL units
// (960×540 for 16:9, 540×H for phone portrait); the backing canvas is 2 device px per logical px.
// The same names are proposed for the game's R.UIK (MODERN_UI.md §6.3).
'use strict';
(function (G) {
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const S = 2; // device px per logical px (1080p backing)

  // ------------------------------------------------------------------ design tokens
  const T = {
    size: { display: 40, h1: 26, h2: 20, title: 17, body: 15, label: 13, caption: 11.5, micro: 10 },
    space: { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 },
    radius: { s: 4, m: 8, l: 12 },
    c: {
      text: '#f6f0e3', text2: '#d2c9b6', text3: '#9a917f', disabled: '#6c675f',
      line: 'rgba(240,228,200,0.14)', line2: 'rgba(240,228,200,0.30)',
      gold: '#ecc97c', gold2: '#b98f47', goldHi: '#fff1c8', teal: '#8fd6d8',
      hp: ['#5f9e5a', '#a9dc8e'], hpLow: ['#c0852a', '#f4c86c'], hpCrit: ['#a8402f', '#f07a60'], mp: ['#3d6aa6', '#92bdf0'], exp: ['#8a6a2a', '#f0cf7c'],
      up: '#8ee08a', down: '#f47e6c', same: '#8e8878',
      rare: '#86c8ff', super: '#ffb65e', front: '#f2c28a', back: '#a9d2f2',
      fire: '#ff8a5a', water: '#6ab8ff', wind: '#8ee0a8', earth: '#d8b070', light: '#fff0a0', dark: '#b08ae0',
    },
    // motion (ms) — MODERN_UI.md §3.6
    motion: { tap: 80, focus: 120, panelIn: 180, panelOut: 140, screen: 260, toast: 2400, dmgRise: 520 },
  };
  let uiScale = 1; // phone portrait uses 1.3 (text & row heights), see MODERN_UI.md §1.5
  const U = (v) => v * uiScale;

  const F = (w, px, fam) => `${w} ${px}px ${fam === 'latin' ? 'Cinzel' : 'ZenMaru'}, sans-serif`;

  function begin(w, h, scaleUI) {
    cv.width = w * S; cv.height = h * S; uiScale = scaleUI || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    return { W: w, H: h };
  }
  const logical = () => ctx.setTransform(S, 0, 0, S, 0, 0);
  const device = () => ctx.setTransform(1, 0, 0, 1, 0, 0);

  function rr(x, y, w, h, r, c) {
    c = c || ctx; r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ------------------------------------------------------------------ text
  function text(s, x, y, o) {
    o = Object.assign({ size: T.size.body, w: 500, c: T.c.text, align: 'left', base: 'alphabetic', shadow: false, fam: 'jp', track: 0, alpha: 1 }, o);
    ctx.save(); ctx.globalAlpha *= o.alpha;
    ctx.font = F(o.w, U(o.size), o.fam); ctx.textAlign = o.align; ctx.textBaseline = o.base;
    if (o.track) ctx.letterSpacing = o.track + 'px';
    if (o.shadow) { ctx.shadowColor = o.shadow === true ? 'rgba(0,0,0,0.8)' : o.shadow; ctx.shadowBlur = o.blur != null ? o.blur : 4; ctx.shadowOffsetY = 1; }
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke[1]; ctx.strokeStyle = o.stroke[0]; ctx.strokeText(s, x, y); }
    if (o.grad) { const g = ctx.createLinearGradient(0, y - U(o.size), 0, y); o.grad.forEach((c, i) => g.addColorStop(i / (o.grad.length - 1), c)); ctx.fillStyle = g; }
    else ctx.fillStyle = o.c;
    if (o.maxW) { let t = s; while (ctx.measureText(t).width > o.maxW && t.length > 1) t = t.slice(0, -1); if (t !== s) t = t.slice(0, -1) + '…'; s = t; }
    ctx.fillText(s, x, y);
    const m = ctx.measureText(s).width; ctx.restore(); return m;
  }
  function measure(s, size, w, fam) { ctx.save(); ctx.font = F(w || 500, U(size || T.size.body), fam); const m = ctx.measureText(s).width; ctx.restore(); return m; }
  // number with a small "/ max"
  function frac(cur, max, x, y, o) {
    o = Object.assign({ size: T.size.body, c: T.c.text, sub: T.c.text3 }, o);
    const sw = measure('/ ' + max, o.size * 0.72, 500);
    text('/ ' + max, x, y, { size: o.size * 0.72, c: o.sub, align: 'right', shadow: o.shadow });
    text(String(cur), x - sw - U(4), y, { size: o.size, w: 700, c: o.c, align: 'right', shadow: o.shadow });
  }

  // ------------------------------------------------------------------ panels
  // glass: dark translucent panel with a frosted copy of what's behind (the game blurs one snapshot
  // of the scene when a menu opens; MODERN_UI.md §3.3).
  function frost(x, y, w, h, r, blur) {
    const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
    const tx = t.getContext('2d'); tx.filter = `blur(${(blur || 10) * S}px)`; tx.drawImage(cv, 0, 0);
    ctx.save(); rr(x, y, w, h, r); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(t, 0, 0); ctx.restore(); logical();
  }
  function panel(x, y, w, h, o) {
    o = Object.assign({ r: T.radius.l, a: 0.74, frost: true, shadow: true, line: true, tone: [14, 16, 24] }, o);
    const [r0, g0, b0] = o.tone;
    if (o.shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; rr(x, y, w, h, o.r); ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fill(); ctx.restore(); }
    if (o.frost) frost(x, y, w, h, o.r, o.blur);
    ctx.save(); rr(x, y, w, h, o.r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(${r0 + 8},${g0 + 8},${b0 + 12},${o.a})`); g.addColorStop(1, `rgba(${r0},${g0},${b0},${Math.min(1, o.a + 0.08)})`);
    ctx.fillStyle = g; ctx.fill();
    if (o.line) {
      ctx.lineWidth = 1; ctx.strokeStyle = T.c.line; ctx.stroke();
      // top highlight
      ctx.clip(); const hg = ctx.createLinearGradient(0, y, 0, y + 18); hg.addColorStop(0, 'rgba(255,245,220,0.07)'); hg.addColorStop(1, 'rgba(255,245,220,0)');
      ctx.fillStyle = hg; ctx.fillRect(x, y, w, 18);
    }
    ctx.restore();
  }
  // a panel that fades out toward one side (battle party list, dialogue band, hub rails)
  function fadePanel(x, y, w, h, side, a) {
    a = a == null ? 0.62 : a;
    ctx.save();
    let g;
    if (side === 'right') g = ctx.createLinearGradient(x + w, 0, x, 0);
    else if (side === 'left') g = ctx.createLinearGradient(x, 0, x + w, 0);
    else if (side === 'bottom') g = ctx.createLinearGradient(0, y + h, 0, y);
    else g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(10,11,18,${a})`); g.addColorStop(0.55, `rgba(10,11,18,${a * 0.7})`); g.addColorStop(1, 'rgba(10,11,18,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  function hline(x0, x1, y, a, c) {
    ctx.save(); const g = ctx.createLinearGradient(x0, 0, x1, 0); const col = c || '240,228,200';
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.12, `rgba(${col},${a})`); g.addColorStop(0.88, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, 1 / S * 2); ctx.restore();
  }
  function rule(x0, x1, y, a) { ctx.save(); ctx.fillStyle = `rgba(240,228,200,${a == null ? 0.14 : a})`; ctx.fillRect(x0, y, x1 - x0, 0.5); ctx.restore(); }

  function diamond(x, y, r, fill, stroke, lw) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } ctx.restore();
  }
  // focus row: gold edge + warm gradient + diamond cursor (MODERN_UI.md §3.5)
  function focus(x, y, w, h, o) {
    o = Object.assign({ r: 6, cursor: true, strong: true }, o);
    ctx.save(); rr(x, y, w, h, o.r); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, `rgba(236,201,124,${o.strong ? 0.30 : 0.16})`); g.addColorStop(0.7, 'rgba(236,201,124,0.07)'); g.addColorStop(1, 'rgba(236,201,124,0.02)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = T.c.gold; ctx.fillRect(x, y, 2, h);
    ctx.restore();
    ctx.save(); rr(x, y, w, h, o.r); ctx.strokeStyle = 'rgba(236,201,124,0.45)'; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
    if (o.cursor) { glow(x + 1, y + h / 2, 10, [255, 220, 150], 0.5); diamond(x + 1, y + h / 2, 4, T.c.goldHi, 'rgba(90,60,20,0.8)', 0.75); }
  }
  function glow(x, y, r, c, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); g.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.4})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }

  // ------------------------------------------------------------------ gauges
  function gauge(x, y, w, t, kind, o) {
    o = Object.assign({ h: 3, ghost: null }, o);
    const cols = Array.isArray(kind) ? kind : kind === 'mp' ? T.c.mp : kind === 'exp' ? T.c.exp : t < 0.25 ? T.c.hpCrit : t < 0.5 ? T.c.hpLow : T.c.hp;
    ctx.save();
    rr(x, y, w, o.h, o.h / 2); ctx.fillStyle = 'rgba(6,8,12,0.6)'; ctx.fill();
    if (o.ghost != null && o.ghost > t) { rr(x, y, w * o.ghost, o.h, o.h / 2); ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.fill(); }
    if (t > 0) {
      rr(x, y, Math.max(o.h, w * t), o.h, o.h / 2);
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x + 1, y, Math.max(0, w * t - 2), Math.max(0.5, o.h * 0.35));
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ icons (vector, 24-unit box)
  function icon(name, x, y, size, color, o) {
    o = o || {};
    const s = size / 24;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = color || T.c.text; ctx.fillStyle = color || T.c.text; ctx.lineWidth = o.lw || 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const P = (d) => { const p = new Path2D(d); ctx.stroke(p); return p; };
    const Fp = (d) => { const p = new Path2D(d); ctx.fill(p); return p; };
    switch (name) {
      case 'bag': P('M6 9h12l-1.2 11H7.2z'); P('M9 9V7a3 3 0 0 1 6 0v2'); P('M10 13h4'); break;
      case 'arts': P('M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z'); Fp('M19 3.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z'); break;
      case 'equip': P('M5 19L16 8'); P('M14 5l5 0 0 5'); P('M5 15l4 4'); P('M3 21l2-2'); break;
      case 'sword': P('M5 19L17 7'); P('M15 5h4v4'); P('M5.5 14.5l4 4'); P('M3.5 20.5l2-2'); break;
      case 'greatsword': P('M4 20L16 8'); P('M13 5l6-1-1 6'); P('M5 14l5 5'); P('M3 21l1.5-1.5'); ctx.lineWidth = 3.2; P('M8 16L17 7'); break;
      case 'dagger': P('M7 17l8-8'); P('M14 7l3 0 0 3'); P('M6.5 13.5l4 4'); P('M5 19l1.5-1.5'); break;
      case 'axe': P('M7 20L16 6'); P('M13.5 4.5c3 0 6 2.2 6 5.5-2.5-.6-4.5-.2-6.8 1.2'); break;
      case 'spear': P('M4 20L18 6'); P('M16 4l4 0 0 4-3 1-2-2z'); break;
      case 'bow': P('M7 3c7 3 11 7 14 14'); P('M7 3l14 14'); P('M4 20l10-10'); P('M4 16v4h4'); break;
      case 'staff': P('M6 21L15 9'); ctx.beginPath(); ctx.arc(16.5, 7, 3.2, 0, 7); ctx.stroke(); Fp('M16.5 5.6a1.4 1.4 0 1 1 0 2.8a1.4 1.4 0 1 1 0-2.8'); break;
      case 'shield': P('M12 3l7 2.5v6c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5v-6z'); P('M12 7v10'); break;
      case 'helm': P('M5 15a7 7 0 0 1 14 0v3H5z'); P('M9 15v3M15 15v3'); P('M12 6V4'); break;
      case 'armor': P('M8 4l4 2 4-2 3 3-2 3v10H7V10L5 7z'); P('M12 6v14'); break;
      case 'glove': P('M8 21v-6L5 11l1.5-1.5L9 12V5a1.3 1.3 0 0 1 2.6 0v5M11.6 9V4a1.3 1.3 0 0 1 2.6 0v6M14.2 10V5.5a1.3 1.3 0 0 1 2.6 0V16c0 3-2 5-5 5z'); break;
      case 'boots': P('M8 3h6v11l5 2.5V20H6v-4c1.5 0 2-1 2-3z'); P('M6 18h13'); break;
      case 'ring': ctx.beginPath(); ctx.arc(12, 14, 6, 0, 7); ctx.stroke(); P('M9 6l3-3 3 3-3 2z'); break;
      case 'potion': P('M10 3h4M10.5 3v5L6.5 15a5 5 0 0 0 4.4 6h2.2a5 5 0 0 0 4.4-6l-4-7V3'); P('M7.5 14h9'); break;
      case 'gem': P('M7 4h10l4 5-9 12L3 9z'); P('M3 9h18M9 4l3 5 3-5M12 9v12'); break;
      case 'coin': ctx.beginPath(); ctx.arc(12, 12, 8, 0, 7); ctx.stroke(); P('M12 7.5v9M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4'); break;
      case 'clock': ctx.beginPath(); ctx.arc(12, 12, 8.5, 0, 7); ctx.stroke(); P('M12 7v5l3.5 2'); break;
      case 'pin': P('M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z'); ctx.beginPath(); ctx.arc(12, 10, 2.2, 0, 7); ctx.stroke(); break;
      case 'order': P('M5 7h6M5 12h6M5 17h6'); P('M15 5l3-2 3 2M18 3v18M15 19l3 2 3-2'); break;
      case 'book': P('M4 5.5C7 4 9.5 4 12 6c2.5-2 5-2 8-.5V19c-3-1.5-5.5-1.5-8 .5-2.5-2-5-2-8-.5z'); P('M12 6v13.5'); break;
      case 'beast': P('M5 9l1-5 4 3h4l4-3 1 5c1 2 1 5-1 7l-3 3.5h-6L6 16c-2-2-2-5-1-7z'); Fp('M9.5 12a1.1 1.1 0 1 1 0 .1zM14.5 12a1.1 1.1 0 1 1 0 .1z'); P('M11 16h2'); break;
      case 'journal': P('M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z'); P('M9 3v18'); P('M12 8h3M12 12h3'); break;
      case 'map': P('M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z'); P('M9 4v14M15 6v14'); break;
      case 'save': P('M12 3l6 6-6 12-6-12z'); P('M6 9h12M12 3v18'); break;
      case 'gear': ctx.beginPath(); ctx.arc(12, 12, 3.2, 0, 7); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6); ctx.lineTo(12 + Math.cos(a) * 8.8, 12 + Math.sin(a) * 8.8); ctx.stroke(); } ctx.beginPath(); ctx.arc(12, 12, 6.2, 0, 7); ctx.stroke(); break;
      case 'heal': P('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'); P('M12 10v5M9.5 12.5h5'); break;
      case 'warp': P('M12 3v4M12 17v4M3 12h4M17 12h4'); ctx.beginPath(); ctx.arc(12, 12, 5, 0, 7); ctx.stroke(); break;
      case 'exit': P('M14 4h5v16h-5'); P('M4 12h10M10 8l4 4-4 4'); break;
      case 'star': Fp('M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'); break;
      case 'bulb': P('M9 17h6M10 20h4'); P('M8.5 14.5C6.5 13 5.5 11 5.5 9a6.5 6.5 0 0 1 13 0c0 2-1 4-3 5.5V17h-7z'); break;
      case 'chat': P('M4 5h16v11H10l-4 4v-4H4z'); break;
      case 'search': ctx.beginPath(); ctx.arc(10.5, 10.5, 6, 0, 7); ctx.stroke(); P('M15 15l5 5'); break;
      case 'door': P('M6 21V4h12v17'); P('M3 21h18'); Fp('M14.5 12.5a1 1 0 1 1 0 .1z'); break;
      case 'inn': P('M3 18h18M4 18v-7h16v7'); P('M4 11c0-2 1-3 3-3h4v3'); P('M3 21v-3M21 21v-3'); break;
      case 'shop': P('M4 9l1.5-5h13L20 9'); P('M4 9h16c0 2-1.5 3-3.2 3S14 11 14 9c0 2-1 3-2 3s-2-1-2-3c0 2-1.3 3-3 3S4 11 4 9z'); P('M5.5 12v8h13v-8'); break;
      case 'auto': P('M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3'); P('M18 3v4h-4M6 21v-4h4'); break;
      case 'ff': Fp('M3 6l8 6-8 6zM12 6l8 6-8 6z'); break;
      case 'log': P('M5 5h14M5 10h14M5 15h9'); P('M16 18l2 2 3-4'); break;
      case 'skip': Fp('M4 6l8 6-8 6zM13 6l6 6-6 6z'); P('M20.5 6v12'); break;
      case 'person': ctx.beginPath(); ctx.arc(12, 8, 3.8, 0, 7); ctx.stroke(); P('M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6'); break;
      case 'quest': P('M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z'); P('M10 8.5a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.4'); Fp('M12 13.6a.9.9 0 1 1 0 .1z'); break;
      case 'lock': P('M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3'); break;
      case 'check': P('M5 12.5l4.5 4.5L19 7.5'); break;
      case 'up': Fp('M12 5l6 8H6z'); break;
      case 'down': Fp('M12 19l6-8H6z'); break;
      case 'sun': ctx.beginPath(); ctx.arc(12, 12, 4, 0, 7); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P(`M${12 + Math.cos(a) * 6.5} ${12 + Math.sin(a) * 6.5}L${12 + Math.cos(a) * 9} ${12 + Math.sin(a) * 9}`); } break;
      default: ctx.strokeRect(4, 4, 16, 16);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ button prompts (keyboard / pad / touch)
  // device: 'pad' (face-button position glyph + letter), 'kb' (keycap), 'touch' (tap target hint)
  const PAD_POS = { a: 'right', b: 'bottom', x: 'top', y: 'left' };      // Settings.padConfirm = right (default)
  const PAD_LETTER = { a: 'A', b: 'B', x: 'X', y: 'Y', l: 'L', r: 'R', zl: 'ZL', zr: 'ZR', plus: '+', minus: '−', stick: 'L', dpad: '' };
  const KB = { a: 'Z', b: 'X', x: 'C', y: 'V', l: 'Q', r: 'E', zl: '1', zr: '3', plus: 'Esc', minus: 'Tab', dpad: '↑↓' };
  let DEVICE = 'pad';
  function glyph(btn, x, y, o) {
    o = Object.assign({ size: 11, device: DEVICE }, o);
    const r = U(o.size) / 2 + U(1.5);
    ctx.save();
    if (o.device === 'kb') {
      const label = KB[btn] || btn.toUpperCase();
      const w = Math.max(r * 2, measure(label, o.size * 0.82, 700) + U(8));
      rr(x - r, y - r, w, r * 2, U(3.5)); ctx.fillStyle = 'rgba(245,238,224,0.92)'; ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - r + 1, y + r - U(2), w - 2, U(1.5));
      text(label, x - r + w / 2, y + U(o.size) * 0.3, { size: o.size * 0.82, w: 700, c: '#1c1a18', align: 'center' });
      ctx.restore(); return w;
    }
    if (o.device === 'touch') {
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.strokeStyle = 'rgba(245,238,224,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, 7); ctx.fillStyle = 'rgba(245,238,224,0.9)'; ctx.fill();
      ctx.restore(); return r * 2;
    }
    if (btn === 'l' || btn === 'r' || btn === 'zl' || btn === 'zr') {
      const label = PAD_LETTER[btn], w = Math.max(r * 2.4, measure(label, o.size * 0.8, 700) + U(10));
      rr(x - r, y - r * 0.85, w, r * 1.7, r * 0.85); ctx.fillStyle = 'rgba(245,238,224,0.92)'; ctx.fill();
      text(label, x - r + w / 2, y + U(o.size) * 0.3, { size: o.size * 0.8, w: 700, c: '#1c1a18', align: 'center' });
      ctx.restore(); return w;
    }
    if (btn === 'plus' || btn === 'minus') {
      ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, 7); ctx.fillStyle = 'rgba(245,238,224,0.92)'; ctx.fill();
      text(PAD_LETTER[btn], x, y + U(o.size) * 0.33, { size: o.size, w: 700, c: '#1c1a18', align: 'center' });
      ctx.restore(); return r * 2;
    }
    if (btn === 'dpad' || btn === 'stick') {
      ctx.fillStyle = 'rgba(245,238,224,0.92)'; const k = r * 0.36;
      if (btn === 'stick') { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.strokeStyle = '#1c1a18'; ctx.lineWidth = 1; ctx.stroke(); }
      else { rr(x - k, y - r, k * 2, r * 2, 1); ctx.fill(); rr(x - r, y - k, r * 2, k * 2, 1); ctx.fill(); }
      ctx.restore(); return r * 2;
    }
    // face button: filled disc + tiny position dots (which of the 4 is meant, brand-neutral)
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = 'rgba(245,238,224,0.94)'; ctx.fill();
    text(PAD_LETTER[btn] || '?', x, y + U(o.size) * 0.34, { size: o.size * 0.92, w: 700, c: '#1c1a18', align: 'center' });
    ctx.restore(); return r * 2;
  }
  // a row of [button, label] prompts; align 'right' grows leftwards from x
  function prompts(list, x, y, o) {
    o = Object.assign({ size: 12, gap: 18, align: 'right', device: DEVICE, c: T.c.text2, shadow: true }, o);
    const items = list.map(([b, l]) => ({ b, l, w: (o.device === 'kb' ? Math.max(U(o.size) + U(3), measure(KB[b] || b, o.size * 0.82, 700) + U(8)) : (b === 'l' || b === 'r' || b === 'zl' || b === 'zr') ? U(o.size) * 1.5 + U(6) : U(o.size) + U(3)) + U(6) + measure(l, o.size, 500) }));
    const total = items.reduce((s, it) => s + it.w, 0) + U(o.gap) * (items.length - 1);
    let cx = o.align === 'right' ? x - total : o.align === 'center' ? x - total / 2 : x;
    for (const it of items) {
      const r = U(o.size) / 2 + U(1.5);
      const gw = glyph(it.b, cx + r, y, { size: o.size, device: o.device });
      text(it.l, cx + gw + U(6), y + U(o.size) * 0.36, { size: o.size, c: o.c, shadow: o.shadow });
      cx += it.w + U(o.gap);
    }
    return total;
  }

  // ------------------------------------------------------------------ portraits (rig bust, crisp art px)
  const bustCache = {};
  function bust(look, o) {
    o = Object.assign({ scale: 2.4, pose: 'idle', flip: false, light: null }, o);
    const key = (look.name || '') + o.scale + o.pose + o.flip + (o.key || '');
    if (!bustCache[key]) {
      const B = new RZ.Builder(); RIG.draw(B, look, RIG.pose(o.pose, o.poseX || {}));
      bustCache[key] = RZ.render(B, Object.assign({ tones: 5, sat: 0.9, olMix: 0.82, flip: o.flip, scale: o.scale, light: o.light || G.ART_LIGHT }));
    }
    return bustCache[key];
  }
  // draw a bust cropped into a rounded frame; (x, y, w, h) logical; art px = 1 logical px
  function portrait(look, x, y, w, h, o) {
    o = Object.assign({ scale: 2.4, dy: 0, bg: ['#3a3440', '#1a1820'], ring: true }, o);
    const r = bust(look, o);
    ctx.save(); rr(x, y, w, h, o.r == null ? T.radius.m : o.r); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.bg[0]); g.addColorStop(1, o.bg[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    glow(x + w * 0.62, y + h * 0.2, w * 0.9, [255, 220, 170], 0.18);
    ctx.imageSmoothingEnabled = false;
    // head top near the frame top: bust origin = feet; place feet far below
    // put the head (≈42 model units above the feet) at 55% of the frame height
    const hcx = x + w / 2 + (o.dx || 0), hcy = y + h * (o.at || 0.56) + o.dy;
    const left = hcx - (r.ox + 2 * o.scale * (o.flip ? -1 : 1)), top = hcy - (r.oy - 35 * o.scale);
    ctx.drawImage(r.canvas, Math.round(left * S) / S, Math.round(top * S) / S, r.canvas.width, r.canvas.height);
    ctx.restore();
    if (o.ring) { ctx.save(); rr(x, y, w, h, o.r == null ? T.radius.m : o.r); ctx.strokeStyle = o.ringC || 'rgba(240,228,200,0.28)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
  }

  // ------------------------------------------------------------------ misc widgets
  function chip(label, x, y, o) {
    o = Object.assign({ size: 11, c: T.c.text, bg: 'rgba(240,228,200,0.12)', line: 'rgba(240,228,200,0.25)', pad: 7, icon: null }, o);
    const iw = o.icon ? U(o.size) + U(4) : 0;
    const w = measure(label, o.size, 700) + U(o.pad) * 2 + iw, h = U(o.size) + U(8);
    ctx.save(); rr(x, y, w, h, h / 2); ctx.fillStyle = o.bg; ctx.fill(); ctx.strokeStyle = o.line; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
    if (o.icon) icon(o.icon, x + U(o.pad) - U(1), y + (h - U(o.size)) / 2, U(o.size), o.c);
    text(label, x + U(o.pad) + iw, y + h / 2 + U(o.size) * 0.36, { size: o.size, w: 700, c: o.c });
    return w;
  }
  function stars(n, x, y, size, col) { for (let i = 0; i < n; i++) icon('star', x + i * size * 0.9, y, size, col); }
  function tag(row, x, y, size) {
    const front = row === '前';
    const s = U(size || 11), w = s + U(6);
    ctx.save(); rr(x, y - s, w, s + U(4), U(3)); ctx.fillStyle = front ? 'rgba(242,194,138,0.18)' : 'rgba(169,210,242,0.16)'; ctx.fill();
    ctx.strokeStyle = front ? 'rgba(242,194,138,0.6)' : 'rgba(169,210,242,0.55)'; ctx.lineWidth = 0.75; ctx.stroke(); ctx.restore();
    text(row, x + w / 2, y - U(1), { size: size || 11, w: 700, c: front ? T.c.front : T.c.back, align: 'center' });
    return w;
  }
  function vignette(W, H, a) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(4,5,10,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function dim(W, H, a) { ctx.fillStyle = `rgba(6,7,12,${a})`; ctx.fillRect(0, 0, W, H); }
  // blur the whole current frame (menus opened over the field)
  function blurAll(px, W, H) {
    const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
    const tx = t.getContext('2d'); tx.filter = `blur(${px * S}px)`; tx.drawImage(cv, 0, 0);
    device(); ctx.drawImage(t, 0, 0); logical();
  }

  G.K = {
    cv, ctx, S, T, F, U, begin, logical, device, rr, text, measure, frac, frost, panel, fadePanel, hline, rule, diamond, focus, glow,
    gauge, icon, glyph, prompts, bust, portrait, chip, stars, tag, vignette, dim, blurAll,
    setDevice: (d) => { DEVICE = d; }, get dev() { return DEVICE; }, get uiScale() { return uiScale; },
  };
})(window);
