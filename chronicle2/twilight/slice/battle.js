// Side-view battle of the slice.  rpg.js calls BATTLE.transition() and then BATTLE.run(env, { group, bg }) -> 'win' | 'flee' | 'lose'.
// The picture is drawn at the field's dot size (960x540); effects, lights and numbers go on a smooth canvas above it.
// Rules: 依頼11 (damage, order, rows, steal, flee); look of the effects: 依頼22.
window.BATTLE = (function () {
  'use strict';
  const $ = id => document.getElementById(id), TAU = Math.PI * 2, W = 960, H = 540;
  // The stage is laid out on 960x540, but the picture shows a little more around it (the view is pulled back like the field's):
  // the canvas is CW x CH dots and the stage sits in it at (OX, OY), with most of the extra room above and at the sides.
  const PULL = 1.2, CW = W * PULL, CH = H * PULL, OX = (CW - W) / 2, OY = Math.round((CH - H) * .7);
  const lerp = (a, b, k) => a + (b - a) * k, eio = k => k * k * (3 - 2 * k), eout = k => 1 - (1 - k) * (1 - k);
  const C = { slash: '#D8D6CC', cream: '#F1E6CC', fire: ['#C9783C', '#9C3B2A', '#E8C27A'], water: ['#3F7C86', '#CFE0DC'], earth: ['#A88752', '#7A7468'], wind: ['#A9B8A6', '#E6EAE2'],
              light: ['#F0DFA8', '#FFF6DC'], holy: ['#D9C27A', '#F3EEDD'], steal: '#D9C98A', dust: '#8c8273', heal: '#a9c58a', bad: '#d99a80' };
  const SLOTS = { 1: [[280, 430]], 2: [[320, 385], [215, 470]], 3: [[330, 360], [205, 425], [315, 495]], 4: [[340, 350], [220, 395], [335, 455], [205, 505]] };
  const WORD = { teto: 'わざ', metem: '術', pamp: 'わざ', bani: '祈り' };
  let E, D, S, G, B = null, lastCmds = null;
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ------------------------------------------------------------------ the cut from the field to the battle
  function blocks(x, c, open) {            // dark squares that close from the edges (open: they shrink away from the middle first)
    x.clearRect(0, 0, 240, 135); x.fillStyle = '#070607';
    for (let j = 0; j < 9; j++) for (let i = 0; i < 16; i++) {
      const d = Math.hypot(i - 7.5, (j - 4) * 1.3) / 9.2, s = open ? clamp(1 - (c * 2 - d), 0, 1) : clamp(c * 2 - (1 - d), 0, 1);
      if (s > 0) x.fillRect(i * 15 + 7.5 - 8 * s, j * 15 + 7.5 - 8 * s, 16 * s, 16 * s);
    }
  }
  function cut(ms, open, flash) {
    const cv = $('trans'), x = cv.getContext('2d'); cv.width = 240; cv.height = 135; cv.style.imageRendering = 'pixelated';
    return new Promise(res => {
      const t0 = performance.now();
      (function f(now) {
        const k = clamp((now - t0) / ms, 0, 1);
        blocks(x, flash ? clamp((k - .3) / .7, 0, 1) : k, open);
        if (flash && k < .3) { x.fillStyle = `rgba(241,230,204,${.55 * Math.sin(k / .3 * TAU) ** 2})`; x.fillRect(0, 0, 240, 135); }
        if (k < 1) requestAnimationFrame(f); else { if (open) x.clearRect(0, 0, 240, 135); res(); }
      })(t0);
    });
  }
  const transition = () => cut(760, false, true);

  // ------------------------------------------------------------------ scene clock (F = double speed: everything in the scene runs on it)
  function loop(now) {
    if (!B) return;
    const dt = Math.min(.05, Math.max(0, (now - B.last) / 1000)) * B.speed; B.last = now; B.t += dt;
    for (const w of B.waits.slice()) { w.t += dt; const k = w.d <= 0 ? 1 : Math.min(1, w.t / w.d); if (w.f) w.f(k); if (k >= 1) { B.waits.splice(B.waits.indexOf(w), 1); w.res(); } }
    for (const p of B.parts) { p.t += dt; if (p.t < 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if (p.drag) { const q = Math.exp(-p.drag * dt); p.vx *= q; p.vy *= q; } }
    B.parts = B.parts.filter(p => p.t < p.d);
    for (const l of B.lights) l.t += dt; B.lights = B.lights.filter(l => l.t < l.d);
    for (const n of B.nums) n.t += dt; B.nums = B.nums.filter(n => n.t < n.d);
    B.shake = Math.max(0, B.shake - dt * 30);
    draw(); requestAnimationFrame(loop);
  }
  const tw = (d, f) => new Promise(res => B.waits.push({ t: 0, d, f, res }));
  const sleep = d => tw(d);

  // ------------------------------------------------------------------ drawing
  const body = a => a.side === 'pc' ? 80 : a.h, lift = a => a.float ? 26 + Math.sin(B.t * 2.4 + a.ph) * 3 : 0;
  const cx = a => a.x + a.ox, cy = a => a.y + a.oy - body(a) * .52 - lift(a), top = a => a.y + a.oy - body(a) - lift(a);
  let scratch = null;
  function sprite(c, a) {
    const x = Math.round(a.x + a.ox), y = Math.round(a.y + a.oy);
    if (a.alpha <= 0) return;
    // contact shadow
    const rx = a.side === 'pc' ? 19 : a.w * .36;
    c.globalAlpha = .34 * a.alpha * (a.float ? .7 : 1); c.fillStyle = '#141016'; c.beginPath(); c.ellipse(x, Math.round(a.y) + 1, rx, rx * .3, 0, 0, TAU); c.fill();
    let im, sx, sy, sw, sh, dx, dy;
    if (a.side === 'pc') {
      const run = a.dash && a.run; im = run ? a.run : a.img; sw = 96; sh = 128; sy = 128;
      sx = (run ? Math.floor(B.t * 1000 / 105) % 4 : a.walk ? [1, 2, 3, 0][Math.floor(B.t * 1000 / 170) % 4] : 0) * 96; dx = x - 48; dy = y - 120 - Math.round(a.hop || 0);
    } else { im = a.img; sx = sy = 0; sw = a.w; sh = a.h; dx = x - Math.round(a.w / 2); dy = y - a.h - Math.round(lift(a)); }
    const br = a.lie || a.walk || a.dash || a.hop ? 0 : Math.round((Math.sin(B.t * (a.side === 'pc' ? 2.6 : 2.1) + (a.ph || a.i * 1.7)) + 1) * .5);      // breathing: one dot taller and back
    c.globalAlpha = a.alpha;
    let src = im;
    if (a.flash > 0) {                       // hit: the sprite turns cream for a moment
      if (!scratch) scratch = document.createElement('canvas');
      scratch.width = sw; scratch.height = sh; const s = scratch.getContext('2d');
      s.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh); s.globalCompositeOperation = 'source-atop'; s.globalAlpha = a.flash; s.fillStyle = a.tint || C.cream; s.fillRect(0, 0, sw, sh);
      src = scratch; sx = sy = 0;
    }
    if (a.lie > 0) {                         // down: lying on the ground
      c.save(); c.translate(x, y - 6); c.rotate(Math.PI / 2 * a.lie); c.globalAlpha = a.alpha * (1 - .25 * a.lie); c.drawImage(src, sx, sy, sw, sh, -48, -112, sw, sh); c.restore();
    } else c.drawImage(src, sx, sy, sw, sh, dx, dy - br, sw, sh + br);
    c.globalAlpha = 1;
  }
  function draw() {
    const c = B.cx; c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
    const sh = B.shake > 0 ? [Math.round(rnd(-1, 1) * B.shake), Math.round(rnd(-1, 1) * B.shake)] : [0, 0];
    c.drawImage(B.bg, sh[0] - 4, sh[1] - 4, CW + 8, CH + 8);
    c.fillStyle = 'rgba(18,14,22,.16)'; c.fillRect(0, 0, CW, CH);                                   // the weak sun: a little dimmer than the painting
    c.translate(sh[0] + OX, sh[1] + OY);
    for (const a of B.all.filter(a => !a.gone).sort((a, b) => a.y - b.y)) sprite(c, a);
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (B.dark > 0) { c.fillStyle = `rgba(10,8,12,${B.dark})`; c.fillRect(0, 0, CW, CH); }
    // effects, on the smooth canvas (same coordinates)
    const f = B.fx; f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, CW * 2, CH * 2); f.setTransform(2, 0, 0, 2, OX * 2, OY * 2);
    f.globalCompositeOperation = 'lighter';
    for (const l of B.lights) {
      const i = (l.t < .05 ? l.t / .05 : (1 - (l.t - .05) / (l.d - .05)) ** 2) * l.peak; if (i <= 0) continue;
      const g = f.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); g.addColorStop(0, rgba(l.col, i)); g.addColorStop(.45, rgba(l.col, i * .35)); g.addColorStop(1, rgba(l.col, 0));
      f.fillStyle = g; f.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      const g2 = f.createRadialGradient(0, 0, 0, 0, 0, l.r * 1.3); g2.addColorStop(0, rgba(l.col, i * .32)); g2.addColorStop(1, rgba(l.col, 0));      // the same light lying on the ground
      f.save(); f.translate(l.x, l.gy == null ? l.y + 40 : l.gy); f.scale(1, .3); f.fillStyle = g2; f.fillRect(-l.r * 1.3, -l.r * 1.3, l.r * 2.6, l.r * 2.6); f.restore();
    }
    for (const p of B.parts) {
      if (p.t < 0) continue;
      const k = p.t / p.d; f.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      if (p.draw) { f.globalAlpha = 1; p.draw(f, p, k); continue; }
      f.globalAlpha = p.a * (p.hold ? Math.min(1, (1 - k) / (1 - p.hold)) : 1 - k * k);
      const r = p.r1 == null ? p.r : lerp(p.r, p.r1, eout(k));
      if (p.shape === 'ring') { f.strokeStyle = p.col; f.lineWidth = p.w * (1 - k * .6); f.beginPath(); f.ellipse(p.x, p.y, r, r * (p.fy || 1), 0, 0, TAU); f.stroke(); }
      else if (p.shape === 'spark') { const v = Math.hypot(p.vx, p.vy) || 1; f.strokeStyle = p.col; f.lineWidth = p.w || 1.5; f.lineCap = 'round'; f.beginPath(); f.moveTo(p.x, p.y); f.lineTo(p.x - p.vx / v * p.len, p.y - p.vy / v * p.len); f.stroke(); }
      else { f.fillStyle = p.col; f.beginPath(); f.arc(p.x, p.y, Math.max(.3, r), 0, TAU); f.fill(); }
    }
    f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1;
    // who is being chosen
    if (B.cursor && !B.cursor.gone) {
      const a = B.cursor, x = a.side === 'pc' ? cx(a) - 40 : cx(a), y = a.side === 'pc' ? cy(a) : top(a) - 14, b = Math.sin(B.t * 6) * 2;
      f.save(); f.translate(x + (a.side === 'pc' ? b : 0), y + (a.side === 'pc' ? 0 : b)); if (a.side === 'pc') f.rotate(-Math.PI / 2);
      f.fillStyle = '#c9ad73'; f.strokeStyle = 'rgba(13,11,12,.9)'; f.lineWidth = 1.5; f.beginPath(); f.moveTo(-7, -9); f.lineTo(7, -9); f.lineTo(0, 3); f.closePath(); f.stroke(); f.fill(); f.restore();
    }
    // numbers
    f.textAlign = 'center'; f.textBaseline = 'middle'; f.lineJoin = 'round';
    for (const n of B.nums) {
      if (n.t < 0) continue;
      const k = n.t / n.d, y = n.y - 16 * eout(Math.min(1, k * 1.8)), pop = k < .12 ? 1 + .5 * (1 - k / .12) : 1;
      f.globalAlpha = k > .75 ? (1 - k) / .25 : 1;
      f.font = `${n.jp ? 500 : 600} ${n.size * pop}px ${n.jp ? '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif' : '"Cormorant Garamond", "Shippori Mincho", Georgia, serif'}`;
      f.strokeStyle = 'rgba(16,12,14,.92)'; f.lineWidth = 3; f.strokeText(n.text, n.x, y); f.fillStyle = n.col; f.fillText(n.text, n.x, y);
      if (n.sub) { f.font = '500 8px "Shippori Mincho", "Hiragino Mincho ProN", serif'; f.lineWidth = 2.5; f.strokeText(n.sub, n.x, y - n.size * .8); f.fillStyle = '#c9ad73'; f.fillText(n.sub, n.x, y - n.size * .8); }
    }
    f.globalAlpha = 1;
  }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${clamp(a, 0, 1)})`; }

  // ------------------------------------------------------------------ effect parts
  const P = o => { const p = Object.assign({ t: 0, d: .4, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, r: 2, r1: null, col: '#fff', a: 1, add: false, shape: 'dot' }, o); if (o.delay) p.t = -o.delay; B.parts.push(p); return p; };
  const L = (x, y, r, col, d, peak, gy) => B.lights.push({ x, y, r, col, d, t: 0, peak: peak == null ? .5 : peak, gy });       // lights: 小 r90, 中 r150, 大 r230
  function num(a, text, col, o) { B.nums.push(Object.assign({ x: cx(a) + rnd(-4, 4), y: top(a) - 4, text: String(text), col: col || C.cream, size: 17, t: 0, d: .6 / .75 }, o)); }
  function ring(x, y, r0, r1, col, d, w, fy, add) { P({ shape: 'ring', x, y, r: r0, r1, col, d: d || .22, w: w || 2, fy, add }); }
  function sparks(x, y, n, col, v, o) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(.45, 1) * (v || 200); P(Object.assign({ shape: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .8, drag: 5, d: rnd(.16, .3), len: rnd(4, 9), col, add: true }, o)); } }
  function dust(x, y, n, col) { for (let i = 0; i < (n || 5); i++) P({ x: x + rnd(-10, 10), y: y + rnd(-2, 2), vx: rnd(-34, 34), vy: rnd(-22, -4), drag: 2, r: rnd(2, 4), r1: rnd(6, 10), col: col || C.dust, a: .42, d: rnd(.4, .65) }); }
  // a crescent that sweeps along its length (a sword stroke, a claw, a blade of wind)
  function crescent(x, y, len, ang, d, col, wid, bulge, delay, add) {
    P({ d, delay, add, draw(c, p, k) {
      const s = eout(Math.min(1, k / .42)), fade = k < .42 ? 1 : 1 - (k - .42) / .58, L0 = -len / 2, L1 = L0 + len * s, m = (L0 + L1) / 2, b = (bulge == null ? len * .26 : bulge) * s;
      c.save(); c.translate(x, y); c.rotate(ang); c.globalAlpha = fade; c.fillStyle = col;
      c.beginPath(); c.moveTo(L0, 0); c.quadraticCurveTo(m, -b * 2, L1, 0); c.quadraticCurveTo(m, -b * 2 + wid * 2 * (1 - k * .5), L0, 0); c.fill(); c.restore();
    } });
  }
  function star(x, y, r, col, d, delay) {      // a four-pointed glint
    P({ d, delay, add: true, draw(c, p, k) { const s = Math.sin(Math.min(1, k * 1.2) * Math.PI) * r; c.save(); c.translate(x, y); c.rotate(k * .8); c.fillStyle = col; c.globalAlpha = 1 - k * k;
      for (let i = 0; i < 2; i++) { c.rotate(Math.PI / 2 * i); c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(0, -s * .12, s, 0); c.quadraticCurveTo(0, s * .12, -s, 0); c.fill(); } c.restore(); } });
  }
  const shakeBy = v => { B.shake = Math.max(B.shake, v); };

  // ------------------------------------------------------------------ hits, numbers, falling
  async function recoil(t, dir) { t.flash = 1; tw(.07, k => { t.flash = 1 - k; }); await tw(.2, k => { t.ox = dir * 8 * Math.sin(k * Math.PI); }); t.ox = 0; }
  function setHp(a, v) { a.hp = clamp(Math.round(v), 0, a.mhp); if (a.side === 'pc') a.p.hp = a.hp; hud(); tags(); }
  async function hurt(t, dmg, o) {            // -> true when it fell
    o = o || {};
    setHp(t, t.hp - dmg);
    num(t, dmg, o.crit ? '#e8c27a' : t.side === 'pc' ? '#f0d9c8' : C.cream, { size: o.crit ? 23 : o.weak ? 20 : 17, sub: o.weak ? '弱点！' : o.crit ? 'かいしん！' : '' });
    if (o.crit) shakeBy(5);
    recoil(t, t.side === 'pc' ? 1 : -1);
    if (t.hp > 0) return false;
    await sleep(.22);
    if (t.side === 'en') { S.sfx('edie'); dust(t.x, t.y - 4, 7); t.tint = '#2a2228'; t.flash = .0; await tw(.42, k => { t.alpha = 1 - k; t.flash = k * .8; }); t.gone = true; B.killed.push(t); tags(); chips(); }
    else { S.sfx('down'); t.guard = false; t.slow = 0; for (const q of B.pcs) if (q.cover === t) q.cover = null; await tw(.3, k => { t.lie = eio(k); }); dust(t.x + 20, t.y, 4); hud(); chips(); say(`${t.name}は、たおれた`); await sleep(.5); }
    return true;
  }
  const miss = t => { S.sfx('miss'); num(t, 'ミス', '#cfc8c0', { jp: true, size: 13 }); return tw(.18, k => { t.ox = (t.side === 'pc' ? 1 : -1) * 10 * Math.sin(k * Math.PI); }).then(() => { t.ox = 0; }); };
  const alive = a => !a.gone && a.hp > 0, foes = () => B.ens.filter(alive), friends = () => B.pcs.filter(alive);

  // ------------------------------------------------------------------ the party's moves
  async function stepIn(a, d) { a.walk = true; await tw(.15, k => { a.ox = -d * eout(k); }); a.walk = false; }
  async function stepOut(a) { const o = a.ox; a.walk = true; await tw(.2, k => { a.ox = o * (1 - eio(k)); }); a.walk = false; a.ox = 0; }
  async function raise(a, col) { ring(cx(a) - 6, a.y - 2, 6, 30, col, .35, 1.5, .32, true); L(cx(a) - 10, cy(a) - 10, 90, col, .45, .35, a.y); for (let i = 0; i < 6; i++) P({ x: cx(a) + rnd(-14, 14), y: a.y - rnd(0, 20), vy: rnd(-70, -30), r: 1.4, col, add: true, d: rnd(.3, .5), delay: i * .03 }); await tw(.2, k => { a.hop = 3 * Math.sin(k * Math.PI); }); a.hop = 0; }
  function physDamage(a, t, mult) {
    const s = a.st; let d = (s.str + s.atk) * mult - t.d.def / 2;
    if (a.row === 'back' && s.wtype !== 'bow') d *= .5;
    const crit = Math.random() * 100 < 5 + s.dex / 20; if (crit) d *= 2;
    return { dmg: Math.max(1, Math.floor(d * rnd(.9, 1.1))), crit };
  }
  const dodged = t => Math.random() >= .95 || Math.random() < (t.d.evade || 0);
  async function strike(a, t, mult, heavy) {
    const wt = a.st.wtype, x = cx(t), y = cy(t);
    await stepIn(a, wt === 'bow' ? 10 : 30);
    if (wt === 'bow') {
      S.sfx('thrust'); const x0 = cx(a) - 20, y0 = cy(a) - 6;
      const p = P({ d: .16, draw(c, p, k) { const px = lerp(x0, x, k), py = lerp(y0, y, k) - Math.sin(k * Math.PI) * 14, an = Math.atan2(y - y0, x - x0); c.save(); c.translate(px, py); c.rotate(an); c.strokeStyle = '#cdbf9c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-12, 0); c.lineTo(4, 0); c.stroke(); c.restore(); } });
      await sleep(.16);
    } else if (wt === 'sword' || wt === 'great' || wt === 'dagger') {
      S.sfx(heavy || wt === 'great' ? 'heavy' : 'slash');
      const big = heavy || wt === 'great', len = wt === 'dagger' ? 44 : big ? 92 : 68;
      crescent(x, y + 4, len, big ? -2.25 : -2.5, .24, C.slash, big ? 5 : 3.2, undefined, 0, true);
      if (wt === 'dagger') crescent(x, y + 2, 40, -.7, .2, C.slash, 2.6, undefined, .08, true);
      if (heavy) { crescent(x, y + 4, 110, -2.25, .3, '#e8c27a', 2.2, 34, .03, true); L(x, y, 150, '#E8C27A', .4, .4, t.y); }
      await sleep(.08);
    } else { S.sfx('thud'); await sleep(.04); }
    if (dodged(t)) { await miss(t); await stepOut(a); return; }
    const r = physDamage(a, t, mult);
    if (wt !== 'sword' && wt !== 'great' && wt !== 'dagger') { ring(x, y, 4, wt === 'bow' ? 16 : 26, C.cream, .22, 2.2, 1, true); }
    sparks(x, y, r.crit ? 12 : 6, C.slash, r.crit ? 260 : 190); L(x, y, 90, C.cream, .25, r.crit ? .5 : .3, t.y);
    if (r.crit) { S.sfx('crit'); ring(x, y, 6, 44, '#E8C27A', .3, 2.5, 1, true); } else S.sfx('hit');
    if (heavy) { dust(t.x, t.y, 6); shakeBy(4); }
    await Promise.all([hurt(t, r.dmg, r), sleep(.6)]);
    await stepOut(a);
  }
  // element spells
  const SPELL = {
    async fire(a, t) {
      const x0 = cx(a) - 24, y0 = cy(a) - 18, x = cx(t), y = cy(t); S.sfx('fire');
      let lt = 0;
      await tw(.3, k => { const px = lerp(x0, x, k), py = lerp(y0, y, k) - Math.sin(k * Math.PI) * 26;
        for (let i = 0; i < 2; i++) P({ x: px + rnd(-3, 3), y: py + rnd(-3, 3), vx: rnd(-20, 20), vy: rnd(-30, 5), r: rnd(3, 5.5), r1: .5, col: Math.random() < .5 ? C.fire[0] : C.fire[1], add: true, d: rnd(.18, .3) });
        P({ x: px, y: py, r: 4.5, r1: 3, col: C.fire[2], add: true, d: .06 });
        if ((lt += 1) % 3 === 0) L(px, py, 90, C.fire[0], .16, .3, lerp(a.y, t.y, k)); });
      P({ x, y, r: 6, r1: 26, col: C.fire[2], add: true, d: .18 }); ring(x, y, 8, 40, C.fire[0], .3, 3, 1, true);
      sparks(x, y, 10, C.fire[2], 240, { g: 260, d: .45 });
      for (let i = 0; i < 32; i++) { const an = rnd(0, TAU), s = rnd(20, 150); P({ x: x + rnd(-10, 10), y: y + rnd(-4, 12), vx: Math.cos(an) * s, vy: Math.sin(an) * s * .6 - rnd(30, 110), g: -70, drag: 2.2, r: rnd(5, 11), r1: .6, col: [C.fire[0], C.fire[1], C.fire[2]][i % 3], add: true, d: rnd(.3, .6) }); }
      L(x, y, 230, C.fire[0], .55, .62, t.y); shakeBy(3);
    },
    async water(a, t) {
      const x = cx(t), y = cy(t); S.sfx('water');
      const dr = []; for (let i = 0; i < 7; i++) { const an = -Math.PI / 2 + rnd(-1.3, 1.3), r = rnd(54, 80); dr.push([x + Math.cos(an) * r, y + Math.sin(an) * r - 10]); }
      await tw(.26, k => { for (const q of dr) { const e = k * k; P({ x: lerp(q[0], x, e), y: lerp(q[1], y, e), r: 3.2, r1: 2, col: C.water[0], d: .07, a: .95 }); P({ x: lerp(q[0], x, e) - 1, y: lerp(q[1], y, e) - 1, r: 1.2, col: C.water[1], d: .05, add: true }); } });
      for (let i = 0; i < 16; i++) P({ x: x + rnd(-10, 10), y: y + rnd(-6, 8), vx: rnd(-90, 90), vy: rnd(-170, -50), g: 420, r: rnd(1.6, 3.2), col: i % 3 ? C.water[0] : C.water[1], d: rnd(.35, .55), a: .95 });
      ring(x, t.y - 2, 6, 34, C.water[1], .4, 2, .32); ring(x, y, 4, 24, C.water[1], .2, 2.4, 1, true); L(x, y, 150, C.water[0], .4, .4, t.y);
    },
    async earth(a, t) {
      const x = cx(t), y = cy(t); S.sfx('earth');
      for (let i = 0; i < 3; i++) {
        const tx = x + [-10, 12, 0][i], ty = [y + 6, y + 14, y - 6][i], sz = [12, 10, 15][i], seed = [[-1, -.5], [.2, -1], [1, -.2], [.8, .8], [-.3, 1], [-1, .4]];
        P({ d: .2, delay: i * .11, draw(c, p, k) { const e = k * k, px = lerp(tx + 120, tx, e), py = lerp(ty - 170, ty, e); c.save(); c.translate(px, py); c.rotate(k * 3 + i);
          c.strokeStyle = '#3b3632'; c.lineWidth = 2; c.fillStyle = C.earth[1]; c.beginPath(); seed.forEach((q, j) => j ? c.lineTo(q[0] * sz, q[1] * sz) : c.moveTo(q[0] * sz, q[1] * sz)); c.closePath(); c.stroke(); c.fill();
          c.fillStyle = C.earth[0]; c.beginPath(); c.moveTo(-sz, -sz * .5); c.lineTo(sz * .2, -sz); c.lineTo(0, 0); c.closePath(); c.fill(); c.restore(); } });
        setTimeout(() => { if (!B) return; sparks(tx, ty, 8, C.earth[0], 210, { add: false, w: 2.2, g: 300, d: .4 }); dust(tx, t.y, 6, '#9a9082'); ring(tx, ty, 4, 26, '#d8c9a4', .2, 2.4, 1, true); L(tx, ty, 90, C.earth[0], .3, .3, t.y); shakeBy(4 + i * 2); }, (i * .11 + .2) * 1000 / B.speed);
      }
      await sleep(.44); ring(x, t.y - 2, 8, 40, C.earth[0], .35, 2, .32);
    },
    async wind(a, t) {
      const x = cx(t), y = cy(t); S.sfx('wind');
      [[-.5, 0, 84], [-2.5, .1, 76], [-1.2, .2, 96], [-2.0, .3, 70]].forEach(([an, dl, len], i) => { crescent(x + rnd(-6, 6), y + rnd(-8, 8), len, an, .28, C.wind[i % 2], 5.5, len * .3, dl, true); });
      for (let i = 0; i < 12; i++) P({ shape: 'spark', x: x + rnd(-50, 30), y: y + rnd(-30, 30), vx: rnd(160, 300), vy: rnd(-30, 30), len: rnd(10, 22), w: 1, col: C.wind[1], d: rnd(.2, .35), delay: rnd(0, .3), a: .7 });
      L(x, y, 150, C.wind[1], .6, .34, t.y); await sleep(.5);
    },
    async light(a, t) {
      const x = cx(t), y = cy(t); S.sfx('light');
      await tw(.26, k => { P({ x, y: lerp(y - 70, y, eio(k)), r: 3 + 6 * k, r1: 1, col: C.light[0], add: true, d: .1 }); P({ x, y: lerp(y - 70, y, eio(k)), r: 2 + 2 * k, col: C.light[1], add: true, d: .05 }); });
      P({ x, y, r: 6, r1: 24, col: C.light[0], add: true, d: .2, a: .55 }); ring(x, y, 8, 46, C.light[0], .35, 2.5, 1, true);
      for (let i = 0; i < 10; i++) { const an = i / 10 * TAU + .2; P({ shape: 'spark', x: x + Math.cos(an) * 8, y: y + Math.sin(an) * 8, vx: Math.cos(an) * 230, vy: Math.sin(an) * 230, drag: 5, len: 16, w: 1.6, col: C.light[1], add: true, d: .32 }); }
      L(x, y, 230, C.light[0], .6, .5, t.y);
    },
  };
  async function castSpell(a, s, t) {
    await stepIn(a, 14); await raise(a, { fire: C.fire[0], water: C.water[1], earth: C.earth[0], wind: C.wind[1], light: C.light[0] }[s.el]);
    await SPELL[s.fx](a, t);
    const weak = t.d.weak === s.el; let d = (a.st.int + a.st.mag) * s.power - t.d.def / 4; if (weak) d *= 1.5;
    if (weak) { (G.seen[t.mid] = G.seen[t.mid] || {}).weak = 1; tags(); }
    await Promise.all([hurt(t, Math.max(1, Math.floor(d * rnd(.9, 1.1))), { weak }), sleep(.6)]);
    await stepOut(a);
  }
  async function healFx(t, n) {
    S.sfx('heal'); const x = cx(t);
    ring(x, t.y - 1, 6, 34, C.holy[0], .6, 2, .32, true); ring(x, t.y - 1, 4, 22, C.holy[1], .45, 1.5, .32, true);
    for (let i = 0; i < 14; i++) P({ x: x + rnd(-18, 18), y: t.y - rnd(0, 30), vy: rnd(-60, -24), r: rnd(1, 2.2), col: i % 2 ? C.holy[0] : C.holy[1], add: true, d: rnd(.5, .9), delay: rnd(0, .3) });
    L(x, cy(t), 150, C.holy[0], .8, .42, t.y);
    setHp(t, t.hp + n); num(t, n, C.heal); await sleep(.6);
  }
  function shieldFx(a) {
    S.sfx('buff'); const x = cx(a) - 26, y = cy(a);
    P({ d: .6, add: true, draw(c, p, k) { c.globalAlpha = Math.sin(Math.min(1, k * 1.4) * Math.PI) * .9; c.strokeStyle = C.holy[1]; c.lineWidth = 2.4; c.beginPath(); c.ellipse(x + 26, y, 34, 46, 0, Math.PI * .72, Math.PI * 1.28); c.stroke(); c.strokeStyle = C.holy[0]; c.lineWidth = 1; c.beginPath(); c.ellipse(x + 26, y, 39, 52, 0, Math.PI * .76, Math.PI * 1.24); c.stroke(); } });
    L(x, y, 90, C.holy[0], .5, .3, a.y);
  }
  async function pcAct(a, c) {
    const need = () => { let t = c.t; if (!t || !alive(t)) t = foes()[0]; return t; };
    if (c.k === 'guard') { say(`${a.name}は、身を守っている`); await sleep(.3); return; }
    if (c.k === 'atk') { const t = need(); if (!t) return; say(`${a.name}のこうげき`); await strike(a, t, 1); return; }
    if (c.k === 'steal') {
      const t = need(); if (!t) return; band('ぬすむ'); say(`${a.name}は、${t.name}の持ち物をねらった`);
      const x0 = a.x, y0 = a.y, tx = t.x + t.w / 2 + 22, ty = t.y + 2;
      a.dash = true; S.sfx('flee'); await tw(.2, k => { a.ox = (tx - x0) * eout(k); a.oy = (ty - y0) * eout(k); });
      a.dash = false; let ch = 30 + (a.st.dex - t.d.spd) * .5 + a.st.steal; ch = clamp(ch, 5, 90); if (a.row === 'back') ch /= 2;
      crescent(cx(t) + 6, cy(t), 30, -2.6, .16, C.steal, 2, undefined, 0, true); await sleep(.1);
      let msg;
      if (t.stolen || !t.d.steal) msg = 'もう、何も持っていない';
      else if (Math.random() * 100 < ch) { t.stolen = true; const it = t.d.steal, got = E.give(it, 1); S.sfx('steal'); star(cx(t) + 14, cy(t) - 8, 13, C.steal, .45); star(cx(t) + 2, cy(t) + 4, 7, '#fff6dc', .35, .12); L(cx(t), cy(t), 90, C.steal, .4, .35, t.y); msg = got ? `${D.items[it].name}をぬすんだ！` : `${D.items[it].name}は、これ以上持てない`; }
      else { S.sfx('miss'); msg = 'ぬすめなかった'; }
      say(msg); await sleep(.25);
      a.dash = true; await tw(.22, k => { a.ox = (tx - x0) * (1 - eio(k)); a.oy = (ty - y0) * (1 - eio(k)); }); a.dash = false; a.ox = a.oy = 0; await sleep(.35);
      return;
    }
    if (c.k === 'item') {
      const d = D.items[c.item]; let t = c.t; if (!alive(t)) t = a;
      if (!E.count(c.item)) { say(`${d.name}は、もう持っていない`); await sleep(.6); return; }
      band(d.name); say(`${a.name}は、${d.name}を使った`); E.take(c.item); await stepIn(a, 14); await healFx(t, Math.min(d.heal, t.mhp - t.hp)); await stepOut(a); return;
    }
    const s = D.skills[c.s];
    if (a.mp < s.mp) { say('MPが足りない！'); S.sfx('buzz'); await sleep(.6); return; }
    a.mp -= s.mp; a.p.mp = a.mp; hud(); band(s.name); say(`${a.name}の${s.name}`);
    if (s.kind === 'phys') { const t = need(); if (t) await strike(a, t, s.power, true); }
    else if (s.kind === 'spell') { const t = need(); if (t) await castSpell(a, s, t); }
    else if (s.kind === 'heal') { let t = c.t; if (!alive(t)) t = a; await stepIn(a, 14); await raise(a, C.holy[0]); await healFx(t, Math.min(Math.floor((a.st.int + a.st.healp) * s.power * rnd(.95, 1.05)), t.mhp - t.hp)); await stepOut(a); }
    else if (s.kind === 'cure') { let t = c.t; if (!alive(t)) t = a; await stepIn(a, 14); await raise(a, C.holy[0]); S.sfx('heal'); ring(cx(t), t.y - 1, 6, 34, C.holy[1], .6, 2, .32, true); L(cx(t), cy(t), 150, C.holy[1], .7, .4, t.y); say(t.slow ? `${t.name}の体が、軽くなった` : '何も起きなかった'); t.slow = 0; hud(); await sleep(.6); await stepOut(a); }
    else if (s.kind === 'blind') {
      const t = need(); if (!t) return; await stepIn(a, 30); S.sfx('quill');
      const x0 = cx(a) - 20, y0 = cy(a), x = cx(t), y = top(t) + t.h * .3;
      await tw(.2, k => { for (let i = 0; i < 2; i++) P({ x: lerp(x0, x, k) + rnd(-4, 4), y: lerp(y0, y, k) - Math.sin(k * Math.PI) * 18 + rnd(-4, 4), r: 1.6, col: '#b9ad94', d: .14, a: .8 }); });
      for (let i = 0; i < 14; i++) P({ x: x + rnd(-12, 12), y: y + rnd(-8, 8), vx: rnd(-26, 26), vy: rnd(-22, 8), drag: 2, r: rnd(3, 5), r1: rnd(8, 12), col: i % 2 ? '#a79c86' : '#8a8172', a: .5, d: rnd(.5, .8) });
      S.sfx('debuff'); t.blind = 3; say(`${t.name}の目が、くらんだ！`); tags(); await sleep(.6); await stepOut(a);
    }
  }

  // ------------------------------------------------------------------ the monsters' moves
  async function lunge(m, t, d, fx) {
    const dx = (t.x - 46) - m.x, dy = t.y - m.y; await tw(d, k => { const e = k * k; m.ox = dx * e; m.oy = dy * e; });
    await fx(); await tw(.22, k => { m.ox = dx * (1 - eio(k)); m.oy = dy * (1 - eio(k)); }); m.ox = m.oy = 0;
  }
  const STYLE = {
    tackle(t) { S.sfx('thud'); ring(cx(t) - 8, cy(t) + 8, 4, 28, C.cream, .22, 2.4, 1, true); dust(t.x - 10, t.y, 4); shakeBy(3); },
    bite(t) { S.sfx('bite'); const x = cx(t) - 4, y = cy(t); crescent(x, y - 12, 40, 0, .2, C.cream, 3, 14, 0, true); crescent(x, y + 12, 40, Math.PI, .2, C.cream, 3, 14, 0, true); sparks(x, y, 4, C.cream, 120); },
    claw(t) { S.sfx('claw'); for (let i = 0; i < 3; i++) crescent(cx(t) - 12 + i * 11, cy(t), 52, 1.05, .2, C.cream, 1.8, 8, i * .05, true); },
    thrust(t) { S.sfx('thrust'); P({ shape: 'spark', x: cx(t) + 14, y: cy(t) + 6, vx: 300, vy: 0, len: 46, w: 2.4, col: C.cream, add: true, d: .14 }); ring(cx(t), cy(t) + 6, 3, 18, C.cream, .18, 2, 1, true); },
    club(t) { S.sfx('heavy'); crescent(cx(t) - 6, cy(t) - 6, 70, 1.35, .22, '#cbbf9f', 5, 20, 0, true); dust(t.x, t.y, 6); shakeBy(5); },
    peck(t) { S.sfx('thrust'); sparks(cx(t) - 4, cy(t) - 14, 4, C.cream, 140); ring(cx(t) - 4, cy(t) - 14, 2, 12, C.cream, .14, 1.6, 1, true); S.sfx('thrust', .1); },
  };
  function pickTarget() {
    const fs = friends(); let tot = 0; for (const f of fs) tot += f.row === 'front' ? 3 : 1;
    let r = Math.random() * tot, t = fs[0]; for (const f of fs) { r -= f.row === 'front' ? 3 : 1; if (r <= 0) { t = f; break; } }
    const cov = B.pcs.find(q => q.cover === t && alive(q) && q !== t);
    return cov ? { t: cov, covered: t } : { t };
  }
  async function enAct(m) {
    const d = m.d, r = Math.random();
    if (d.ai === 'runs' && m.hp < m.mhp * .35 && r < .5) { say(`${m.name}は、にげだした！`); S.sfx('flee'); await tw(.45, k => { m.ox = -260 * k * k; m.alpha = 1 - k; }); m.gone = true; m.fled = true; tags(); chips(); await sleep(.3); return; }
    if (d.ai === 'split' && r < .15 && foes().length < 4) {
      say(`${m.name}は、ふたつに分かれた！`); S.sfx('split'); await tw(.25, k => { m.flash = Math.sin(k * Math.PI) * .7; });
      const n = mkEn(m.mid); n.x = m.x; n.y = m.y; n.hp = Math.max(1, Math.ceil(m.hp / 2)); setHp(m, Math.max(1, Math.ceil(m.hp / 2))); n.img = m.img; n.w = m.w; n.h = m.h; B.ens.push(n); B.all.push(n); rename(); B.order.push(n); n.acted = true;
      const fs = foes(), sl = SLOTS[fs.length], from = fs.map(q => [q.x, q.y]); ring(m.x, m.y - m.h / 2, 6, 40, '#b8c7a0', .3, 2, 1, true);
      await tw(.3, k => fs.forEach((q, i) => { q.x = lerp(from[i][0], sl[i][0], eio(k)); q.y = lerp(from[i][1], sl[i][1], eio(k)); tags(); }));
      tags(); chips(); await sleep(.3); return;
    }
    const pk = pickTarget(), t = pk.t;
    if (d.ai === 'pickpocket' && r < .25 && G.gold > 0) {
      const n = Math.min(G.gold, Math.round(rnd(8, 20)));
      await lunge(m, t, .2, async () => { S.sfx('steal'); star(cx(t) - 14, cy(t), 10, C.steal, .4); G.gold -= n; m.took += n; say(`${m.name}は、お金を${n}枚ぬすんだ！`); await sleep(.25); });
      await sleep(.45); return;
    }
    if (d.ai === 'web' && r < .3 && !t.slow) {
      say(`${m.name}は、糸をはいた！`); S.sfx('web'); const x0 = cx(m) + 20, y0 = cy(m);
      P({ d: .7, draw(c, p, k) { const e = Math.min(1, k / .3); c.globalAlpha = k < .6 ? .85 : .85 * (1 - (k - .6) / .4); c.strokeStyle = '#e6e2d6'; c.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(lerp(x0, cx(t), .5), lerp(y0, cy(t), .5) - 30 + i * 6, lerp(x0, cx(t) + i * 5, e), lerp(y0, cy(t) + i * 12, e)); c.stroke(); } } });
      await sleep(.35); S.sfx('debuff'); t.slow = 3; t.flash = .6; t.tint = '#e6e2d6'; tw(.4, k => { t.flash = .6 * (1 - k); }).then(() => { t.tint = null; });
      say(`${t.name}に、糸がからみついた！　すばやさが下がった`); hud(); await sleep(.7); return;
    }
    say(pk.covered ? `${m.name}のこうげき！　${t.name}が、${pk.covered.name}をかばった` : `${m.name}のこうげき`);
    const hit = Math.random() < (m.blind ? .6 : .9);
    await lunge(m, t, d.act === 'thrust' || d.act === 'peck' ? .14 : .2, async () => {
      if (pk.covered) shieldFx(t);
      if (!hit) { await miss(t); return; }
      STYLE[d.act](t);
      let dm = d.atk - (t.st.def + t.st.arm) / 2; if (t.row === 'back') dm *= .5; if (t.guard) dm *= .5;
      if (t.guard && !pk.covered) shieldFx(t);
      L(cx(t), cy(t), 90, C.cream, .22, .25, t.y);
      await Promise.all([hurt(t, Math.max(1, Math.floor(dm * rnd(.9, 1.1)))), sleep(.3)]);
    });
    await sleep(.3);
  }

  // ------------------------------------------------------------------ actors
  const letter = i => 'ABCD'[i] || '';
  function mkEn(mid) { const d = D.monsters[mid]; return { side: 'en', mid, d, name: d.name, tag: d.name[0], x: 0, y: 0, ox: 0, oy: 0, hp: d.hp, mhp: d.hp, w: 64, h: 64, float: d.float, ph: rnd(0, TAU), flash: 0, alpha: 1, blind: 0, stolen: false, took: 0, img: null }; }
  function rename() { const by = {}; for (const m of B.ens) (by[m.mid] = by[m.mid] || []).push(m); for (const k in by) by[k].forEach((m, i) => { m.name = m.d.name + (by[k].length > 1 ? letter(i) : ''); m.tag = m.d.name[0] + (by[k].length > 1 ? letter(i) : ''); }); }
  function mkPc(id, i) {
    const p = G.party[id], s = E.stats(id), c = D.chars[id];
    return { side: 'pc', id, i, p, st: s, name: c.name, tag: c.name[0], row: p.row, x: 690 + 22 * i + (p.row === 'back' ? 64 : 0), y: 318 + 52 * i, ox: 0, oy: 0, hp: p.hp, mp: p.mp, mhp: s.mhp, mmp: s.mmp,
             flash: 0, alpha: 1, lie: p.hp > 0 ? 0 : 1, guard: false, slow: 0, cover: null, img: null, run: null, hop: 0 };
  }

  // ------------------------------------------------------------------ the words and boxes around the picture
  let hb = null;
  const say = t => hb && hb.set(t);
  let bandT = 0;
  function band(t) { const b = $('bband'); b.textContent = t; b.classList.add('on'); clearTimeout(bandT); bandT = setTimeout(() => b.classList.remove('on'), 1100 / B.speed); }
  function hud() {
    if (!B || !B.rows) return;
    B.pcs.forEach((a, i) => {
      const r = B.rows[i]; r.classList.toggle('down', a.hp <= 0); r.classList.toggle('act', B.active === a);
      r.querySelector('.hpv').textContent = a.hp; r.querySelector('.mpv').textContent = a.mp;
      const hb2 = r.querySelector('.bar'); hb2.classList.toggle('low', a.hp < a.mhp * .3); hb2.firstChild.style.width = 100 * a.hp / a.mhp + '%'; r.querySelector('.bar.mp').firstChild.style.width = (a.mmp ? 100 * a.mp / a.mmp : 0) + '%';
      r.querySelector('.st').textContent = a.hp <= 0 ? 'たおれた' : [a.guard ? 'まもる' : '', a.cover ? 'かばう' : '', a.slow ? 'おそい' : ''].filter(Boolean).join(' ');
    });
  }
  function tags() {
    if (!B || !B.ui) return;
    for (const m of B.ens) {
      if (!m.el) { m.el = E.el('div', 'etag', '<span class="wk"></span><span class="nm"></span><span class="hpb"><i></i></span>'); B.ui.appendChild(m.el); }
      if (m.gone) { m.el.remove(); continue; }
      m.el.style.left = ((m.x + OX) / CW * 100) + '%'; m.el.style.top = ((m.y + 8 + OY) / CH * 100) + '%';
      const seen = G.seen[m.mid] && G.seen[m.mid].weak;
      const wk = m.el.querySelector('.wk'); wk.textContent = '弱点：' + (seen ? D.EL[m.d.weak] : '？') + (m.blind ? '　目くらみ' : ''); wk.classList.toggle('known', !!seen);
      m.el.querySelector('.nm').textContent = m.name; m.el.querySelector('i').style.width = 100 * m.hp / m.mhp + '%';
      m.el.classList.toggle('sel', B.cursor === m);
    }
  }
  function chips() {
    if (!B || !B.orderEl) return;
    B.orderEl.innerHTML = '<span class="lab">じゅんばん</span>';
    for (const a of B.order) { if (a.gone && a.side === 'en' && !a.shown) continue; B.orderEl.appendChild(E.el('span', 'chip ' + (a.side === 'pc' ? 'pc' : 'en') + (B.now === a ? ' now' : '') + (a.acted || !alive(a) ? ' gone' : ''), a.tag)); }
  }
  function setActive(a) { if (B.active && B.active !== a && alive(B.active)) { const q = B.active; tw(.12, k => { q.ox = -22 * (1 - k); }).then(() => { if (B && B.active !== q) q.ox = 0; }); } B.active = a; if (a) tw(.12, k => { a.ox = -22 * eout(k); }); hud(); }
  function speedBtn() { const b = $('bkF'); if (b) { b.classList.toggle('on', B.speed === 2); b.querySelector('span').textContent = B.speed === 2 ? '倍速中' : '倍速'; } }
  function toggleSpeed() { B.speed = B.speed === 2 ? 1 : 2; G.set.speed = B.speed; S.sfx('cursor'); speedBtn(); }

  // ------------------------------------------------------------------ choosing
  function pickFrom(listOf, help, startAt) {          // -> actor or null
    return new Promise(res => {
      const es = listOf.slice().sort((a, b) => a.y - b.y); let i = Math.max(0, es.indexOf(startAt)); const hits = [], prev = hb.el.querySelector('.t').textContent;
      const paint = () => { B.cursor = es[i]; tags(); B.rows.forEach((r, j) => { r.style.boxShadow = B.pcs[j] === es[i] ? 'inset 0 0 0 1px #c9ad73' : ''; }); };
      const end = v => { E.drop(o); B.cursor = null; tags(); B.rows.forEach(r => { r.style.boxShadow = ''; r.onclick = null; r.style.cursor = ''; r.style.pointerEvents = ''; }); hits.forEach(h => h.remove()); say(prev); res(v); };
      const o = E.push({ key(e) { const k = E.KEY(e), n = es.length;
        if (k === 'up' || k === 'left') { i = (i + n - 1) % n; S.sfx('cursor'); paint(); } else if (k === 'down' || k === 'right') { i = (i + 1) % n; S.sfx('cursor'); paint(); }
        else if (k === 'ok') { S.sfx('ok'); end(es[i]); } else if (k === 'cancel') { S.sfx('cancel'); end(null); } else if (k === 'f' || k === 'F') toggleSpeed(); } });
      es.forEach(a => {
        if (a.side === 'pc') { const r = B.rows[B.pcs.indexOf(a)]; r.style.cursor = 'pointer'; r.style.pointerEvents = 'auto'; r.onclick = ev => { ev.stopPropagation(); S.sfx('ok'); end(a); }; }
        const h = E.el('div', 'ehit'), w = a.side === 'pc' ? 60 : a.w + 16, hh = body(a) + 20; h.style.cssText = `left:${(a.x - w / 2 + OX) / CW * 100}%;top:${(a.y - hh - (a.float ? 26 : 0) + OY) / CH * 100}%;width:${w / CW * 100}%;height:${(hh + 10) / CH * 100}%`;
        h.onclick = ev => { ev.stopPropagation(); S.sfx('ok'); end(a); }; B.ui.appendChild(h); hits.push(h);
      });
      say(help); paint();
    });
  }
  function askCommand(a, first) {                       // -> command | 'back' | 'repeat'
    return new Promise(res => {
      const ask = `${a.name}は、どうする？`, sk = E.skillsOf(a.id), usable = () => Object.keys(G.items).filter(k => D.items[k].heal && E.count(k) > 0);
      const items = [{ label: 'たたかう', k: 'atk' }, { label: WORD[a.id], k: 'skill', dim: !sk.length }];
      if (a.id === 'pamp') items.push({ label: 'ぬすむ', k: 'steal' });
      items.push({ label: 'まもる', k: 'guard' }, { label: 'どうぐ', k: 'item', dim: !usable().length }, { label: 'にげる', k: 'flee' });
      let l = null, moved = false; const done = v => { l.close(); res(v); };
      const HELP = { atk: '武器でこうげきする', skill: sk.length ? '覚えた' + WORD[a.id] + 'を使う' : 'まだ、何も覚えていない', steal: '魔物の持ち物をぬすむ。前の列のほうが成功しやすい', guard: 'このターン、受けるダメージを半分にする', item: '持っている物を使う', flee: '4人で、戦いからにげる' };
      l = E.list(B.ui, items, { id: 'bcmd', index: Math.min(a.ci || 0, items.length - 1), onMove: it => say(moved ? HELP[it.k] : ask),
        onDim: it => say(it.k === 'skill' ? 'まだ、何も覚えていない' : '使える物を、持っていない'),
        onCancel: () => { if (first) say(ask); else done('back'); },
        onKey: k => { if (k === 'f' || k === 'F') toggleSpeed(); else if (k === 'r' || k === 'R') { if (lastCmds) { S.sfx('ok'); done('repeat'); } else S.sfx('buzz'); } },
        onPick: async (it, i) => {
          a.ci = i;
          if (it.k === 'atk' || it.k === 'steal') { const t = await pickFrom(foes(), 'どの魔物をねらう？', B.lastT); if (t) { B.lastT = t; done({ k: it.k, t }); } }
          else if (it.k === 'guard' || it.k === 'flee') done({ k: it.k });
          else if (it.k === 'skill') {
            const shield = !!a.p.equip.shield;
            const l2 = E.list(B.ui, sk.map(s => ({ label: s.name, r: 'MP ' + s.mp, s, dim: a.mp < s.mp || (s.need === 'shield' && !shield) })), { id: 'bsub', title: WORD[a.id], index: a.si || 0, onMove: s => say(s.s.help),
              onDim: s => say(a.mp < s.s.mp ? 'MPが足りない' : '盾を持っていないと、使えない'), onCancel: () => { l2.close(); say(ask); }, onKey: k => { if (k === 'f' || k === 'F') toggleSpeed(); },
              onPick: async (s, j) => { a.si = j; const en = s.s.target === 'enemy', t = await pickFrom(en ? foes() : friends().filter(q => s.s.kind !== 'cover' || q !== a), en ? 'どの魔物をねらう？' : s.s.kind === 'cover' ? 'だれをかばう？' : 'だれに使う？', en ? B.lastT : a);
                if (t) { if (en) B.lastT = t; l2.close(); done({ k: 'skill', s: s.s.id, t }); } } });
          } else if (it.k === 'item') {
            const l2 = E.list(B.ui, usable().map(k => ({ label: D.items[k].name, r: '×' + E.count(k), id: k })), { id: 'bsub', title: 'どうぐ', onMove: s => say(D.items[s.id].help), onCancel: () => { l2.close(); say(ask); }, onKey: k => { if (k === 'f' || k === 'F') toggleSpeed(); },
              onPick: async s => { const t = await pickFrom(friends(), 'だれに使う？', a); if (t) { l2.close(); done({ k: 'item', item: s.id, t }); } } });
          }
        } });
      say(ask); moved = true;
    });
  }
  function repeatCmds() {            // last round's choices again, as far as they are still possible
    const out = {};
    for (const a of friends()) {
      const c = lastCmds[a.id] || { k: 'atk' }; let k = c.k, o = { k };
      if (k === 'skill') { const s = D.skills[c.s]; if (a.mp < s.mp || s.lv > a.p.lv) o = { k: 'atk' }; else { o.s = c.s; o.t = s.target === 'enemy' ? (B.ens[c.ti] && alive(B.ens[c.ti]) ? B.ens[c.ti] : foes()[0]) : B.pcs.find(q => q.id === c.tid && alive(q)) || a; } }
      else if (k === 'item') { if (!E.count(c.item)) o = { k: 'atk' }; else { o.item = c.item; o.t = B.pcs.find(q => q.id === c.tid && alive(q)) || a; } }
      if (o.k === 'atk' || o.k === 'steal') o.t = B.ens[c.ti] && alive(B.ens[c.ti]) ? B.ens[c.ti] : foes()[0];
      out[a.id] = o;
    }
    return out;
  }
  function remember(cmds) { lastCmds = {}; for (const id in cmds) { const c = cmds[id]; lastCmds[id] = { k: c.k, s: c.s, item: c.item, ti: c.t && c.t.side === 'en' ? B.ens.indexOf(c.t) : -1, tid: c.t && c.t.side === 'pc' ? c.t.id : null }; } $('bkR').classList.remove('dim'); }
  async function inputPhase() {      // -> { id: command } | 'flee'
    const fs = friends(), cmds = {}; let i = 0;
    while (i < fs.length) {
      const a = fs[i]; setActive(a);
      const c = await askCommand(a, i === 0);
      if (c === 'back') { i--; continue; }
      if (c === 'repeat') { setActive(null); return repeatCmds(); }
      if (c.k === 'flee') { setActive(null); return 'flee'; }
      cmds[a.id] = c; i++;
    }
    setActive(null); remember(cmds); return cmds;
  }
  function pages(texts, snd) {       // the parchment box in the middle; Z or a tap turns the page
    return new Promise(async res => {
      const box = E.el('div', 'parch hit'); box.id = 'bresult'; B.ui.appendChild(box);
      for (const t of texts) {
        box.textContent = typeof t === 'string' ? t : t.text; if (t.sfx) S.sfx(t.sfx); if (t.fx) t.fx();
        await new Promise(next => { const o = E.push({ key(e) { const k = E.KEY(e); if (k === 'ok' || k === 'cancel') go(); } }); const go = () => { E.drop(o); box.onclick = null; S.sfx('cursor'); next(); }; box.onclick = go; });
      }
      box.remove(); res();
    });
  }

  // ------------------------------------------------------------------ one battle
  async function run(env, opt) {
    E = env; D = E.D; S = E.S; G = E.G;
    const root = E.el('div', ''); root.id = 'battle';
    root.innerHTML = '<canvas id="bcv" width="' + CW + '" height="' + CH + '"></canvas><canvas id="bfx" width="' + CW * 2 + '" height="' + CH * 2 + '"></canvas><div id="bui"><div id="border"></div><div id="bband"></div><div id="bparty"></div>' +
      '<div id="bkeys"><span class="btn dim" id="bkR"><b class="keycap">R</b><span>リピート</span></span><span class="btn" id="bkF"><b class="keycap">F</b><span>倍速</span></span></div></div>';
    E.root.appendChild(root);
    B = { t: 0, last: performance.now(), speed: G.set.speed === 2 ? 2 : 1, waits: [], parts: [], lights: [], nums: [], shake: 0, dark: 0, cx: $('bcv').getContext('2d'), fx: $('bfx').getContext('2d'), ui: $('bui'), orderEl: $('border'),
          pcs: E.D.order.map(mkPc), ens: opt.group.map(mkEn), order: [], killed: [], fails: 0, active: null, cursor: null, now: null };
    B.all = B.pcs.concat(B.ens); rename();
    const sl = SLOTS[B.ens.length]; B.ens.forEach((m, i) => { m.x = sl[i][0]; m.y = sl[i][1]; });
    hb = E.helpbar(B.ui, '<span><b class="keycap">Z</b>決める</span><span><b class="keycap">X</b>もどる</span>');
    B.rows = B.pcs.map(a => { const r = E.el('div', 'brow', `<span class="st"></span><span class="nm">${a.name}</span><span class="k">HP</span><span class="v hpv"></span><span class="bar"><i></i></span><span class="k">MP</span><span class="v mpv"></span><span class="bar mp"><i></i></span>`); $('bparty').appendChild(r); return r; });
    if (lastCmds) $('bkR').classList.remove('dim');
    $('bkF').onclick = ev => { ev.stopPropagation(); toggleSpeed(); }; $('bkR').onclick = ev => { ev.stopPropagation(); const t = E.top(); if (t) t.key({ key: 'r' }); };
    const base = E.push({ key(e) { const k = E.KEY(e); if (k === 'f' || k === 'F') toggleSpeed(); } });
    // pictures
    const [bg] = await Promise.all([E.img('bg/' + opt.bg + '.webp'),
      ...B.pcs.map(a => E.img(D.chars[a.id].sprite + '.png').then(im => { a.img = im; })), ...B.pcs.map(a => E.img(D.chars[a.id].sprite + '_run.png').then(im => { a.run = im; }).catch(() => {})),
      ...B.ens.map(m => E.img('mon/' + m.mid + '.png').then(im => { m.img = im; m.w = im.width; m.h = im.height; }))]);
    B.bg = bg; hud(); speedBtn();
    // they come in from both sides
    for (const a of B.all) a.ox = a.side === 'pc' ? 240 : -300;
    requestAnimationFrame(loop);
    cut(380, true);
    await tw(.4, k => { for (const a of B.all) a.ox = (a.side === 'pc' ? 240 : -300) * (1 - eout(k)); });
    for (const a of B.all) a.ox = 0;
    tags();
    const names = [...new Set(B.ens.map(m => m.d.name))];
    say(names.join('と、') + 'が、あらわれた！'); await sleep(.8);

    let result = null;
    const over = () => !foes().length ? 'win' : !friends().length ? 'lose' : null;
    while (!result) {
      // the order of this round (rolled before the choices, so it can be read)
      for (const a of B.all) { a.acted = false; a.roll = (a.side === 'pc' ? a.st.spd * (a.slow ? .5 : 1) : a.d.spd) * rnd(.8, 1.2); }
      B.order = B.all.filter(alive).sort((a, b) => b.roll - a.roll); B.now = null; chips();
      const cmds = await inputPhase();
      let partyActs = true;
      if (cmds === 'flee') {
        const ch = clamp(50 + Math.max(...friends().map(a => a.st.spd)) - Math.max(...foes().map(m => m.d.spd)) + 10 * B.fails + (E.hasPassive('nigeashi') ? 15 : 0), 10, 95);
        if (Math.random() * 100 < ch) {
          say('4人は、にげだした！'); S.sfx('flee'); for (const a of friends()) { a.dash = true; dust(a.x, a.y, 3); }
          await tw(.5, k => { for (const a of friends()) a.ox = 320 * k * k; }); result = 'flee'; break;
        }
        B.fails++; say('にげられなかった！'); S.sfx('buzz'); await sleep(.7); partyActs = false;
      } else {
        for (const a of friends()) {             // まもる and かばう hold from the start of the round
          const c = cmds[a.id]; if (!c) continue;
          if (c.k === 'guard') { a.guard = true; }
          if (c.k === 'skill' && D.skills[c.s].kind === 'cover' && a.mp >= D.skills[c.s].mp && alive(c.t)) { a.mp -= D.skills[c.s].mp; a.p.mp = a.mp; a.cover = c.t; band('かばう'); shieldFx(a); say(`${a.name}は、${c.t.name}をかばっている`); await sleep(.5); c.done = true; }
        }
        hud();
      }
      for (let n = 0; n < B.order.length && !result; n++) {
        const a = B.order[n]; if (a.acted || !alive(a)) continue;
        B.now = a; chips();
        if (a.side === 'pc') { if (partyActs && cmds[a.id] && !cmds[a.id].done) await pcAct(a, cmds[a.id]); } else await enAct(a);
        a.acted = true; a.shown = true; result = over();
        await sleep(.12);
      }
      B.now = null;
      for (const a of B.pcs) { a.guard = false; a.cover = null; if (a.slow) a.slow--; }
      for (const m of B.ens) if (m.blind) m.blind--;
      hud(); tags();
    }
    E.drop(base); $('border').style.display = 'none'; $('bkeys').style.display = 'none';

    if (result === 'win') {
      const exp = B.killed.reduce((s, m) => s + m.d.exp, 0), gold = B.killed.reduce((s, m) => s + m.d.gold + m.took, 0);
      say(''); S.bgm('jg01', { fade: .15, in: .02, once: true, restart: true });
      const ps = friends(); tw(.9, k => { for (const a of ps) a.hop = Math.abs(Math.sin(k * Math.PI * 2 + a.i * .5)) * 9; }).then(() => { for (const a of ps) a.hop = 0; });
      for (const a of B.pcs) if (a.hp <= 0) { a.hp = a.p.hp = 1; tw(.4, k => { a.lie = 1 - eio(k); }); }      // those who fell get up with 1 HP
      hud();
      const out = [B.killed.length ? '戦いに勝った！' : '魔物は、いなくなった'];
      if (exp || gold) out.push(`けいけん値　${exp}\nお金　${gold}枚`);
      G.gold += gold; G.wins++;
      for (const m of B.killed) if (m.d.drop && Math.random() < .25) { const got = E.give(m.d.drop, 1); out.push({ text: got ? `${D.items[m.d.drop].name}を\n手に入れた` : `${D.items[m.d.drop].name}は、\nこれ以上持てない`, sfx: 'get' }); }
      if (exp) for (const a of B.pcs) for (const msg of E.gainExp(a.id, exp)) out.push({ text: msg.text, sfx: msg.lv ? 'levelup' : 'get', fx: () => { if (msg.lv) { const s = E.stats(a.id); a.mhp = s.mhp; a.mmp = s.mmp; a.hp = a.p.hp; a.mp = a.p.mp; hud();
        L(cx(a), cy(a), 150, C.light[0], .9, .55, a.y); ring(cx(a), a.y - 1, 6, 40, C.light[0], .7, 2, .32, true); for (let i = 0; i < 16; i++) P({ x: cx(a) + rnd(-16, 16), y: a.y - rnd(0, 20), vy: rnd(-90, -40), r: rnd(1, 2.2), col: C.light[i % 2], add: true, d: rnd(.5, .9), delay: rnd(0, .25) }); } } });
      await sleep(.5); await pages(out);
    } else if (result === 'lose') {
      S.bgm(null, { fade: 1.2 }); S.sfx('lose'); say(''); await tw(1.2, k => { B.dark = .55 * k; });
      await pages(['4人は、力つきた…', '最後に書きとめた所から、\nやりなおします']);
    }
    for (const a of B.pcs) { a.p.hp = a.hp; a.p.mp = a.mp; }
    await cut(300, false);
    B = null; hb = null; root.remove();
    if (result === 'lose') setTimeout(() => { const cv = $('trans'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }, 500);
    else setTimeout(() => cut(380, true), 80);
    return result;
  }
  return { transition, run, get state() { return B; }, _t: { SPELL, STYLE, strike, castSpell, healFx, shieldFx, pcAct, enAct } };
})();
