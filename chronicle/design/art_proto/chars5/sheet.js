// chars5 sheets: per-variant sheet (1:1 and 6×), comparison sheet (1:1 night + 4×), and the
// battle / town mock composites (reusing design/art_proto/ui renderers with the hero swapped).
'use strict';
(function (G) {
  const C = G.C5, V = G.VARIANTS;
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const ORDER = ['v1', 'v2', 'v3', 'v4', 'v5'].filter((v) => V[v]);

  // all frames of a variant, painted: { key: {base, lit, f} }
  function build(v) {
    const Vr = V[v]; if (Vr._built) return Vr._built;
    const F = C.frames(Vr), out = {};
    for (const k in F) {
      const f = F[k], side = f.view.lightSide == null ? -1 : f.view.lightSide;
      out[k] = { f, base: C.paint(Vr, f.g), lit: C.light(Vr, f.g, side) };
      // mirrored side view (facing left) for the town
      if (k.startsWith('side')) {
        const g2 = C.flipG(f.g);
        out[k + 'L'] = { f: Object.assign({}, f, { g: g2, ox: g2.w - f.ox }), base: C.paint(Vr, g2), lit: C.light(Vr, g2, -side) };
      }
    }
    return (Vr._built = out);
  }
  const FIELD_ROW = [['idle0', 'down0'], ['idle1', 'idle1'], ['idle2', 'idle2'], ['down1'], ['down2'], ['side0'], ['side1'], ['side2'], ['up0'], ['up1'], ['up2']];
  const BAT_ROW = ['battle0', 'battle1', 'battle2'];

  function bgNight(x, W, H) {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0d1c'); g.addColorStop(1, '#171a33'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  function text(x, s, px, py, size, col, w) { x.save(); x.font = `${w || 500} ${size}px ZenMaru, sans-serif`; x.fillStyle = col || '#d8d0c0'; x.fillText(s, px, py); x.restore(); }
  function blit(x, c, px, py, z) { x.imageSmoothingEnabled = false; x.drawImage(c, Math.round(px), Math.round(py), c.width * z, c.height * z); }

  // ---------------------------------------------------------------- per-variant sheet
  function sheet(v, z) {
    const B = build(v), Vr = V[v];
    const keysF = ['down0', 'idle1', 'idle2', 'down1', 'down2', 'side0', 'side1', 'side2', 'up0', 'up1', 'up2'];
    const labF = ['idle 1', 'idle 2', 'idle 3', 'walk↓ a', 'walk↓ b', 'side', 'walk→ a', 'walk→ b', 'up', 'walk↑ a', 'walk↑ b'];
    const maxW = Math.max(...Object.values(B).map((b) => b.base.width)), maxH = Math.max(...Object.values(B).map((b) => b.base.height));
    const cw = (maxW + 6) * z, ch = (maxH + 6) * z;
    const head = z >= 4 ? 70 : 16, lab = z >= 4 ? 22 : 0;
    const W = Math.max(keysF.length * cw, (BAT_ROW.length * 2 + 3) * ((maxW + 10) * z)) + 40;
    const H = head + (ch + lab) * 3 + 40;
    cv.width = W; cv.height = H;
    ctx.fillStyle = '#1b1a22'; ctx.fillRect(0, 0, W, H);
    // lit bands on night blue
    const y1 = head, y2 = head + ch + lab, y3 = head + (ch + lab) * 2;
    { ctx.save(); ctx.translate(0, y2); bgNight(ctx, W, ch + lab); ctx.restore(); }
    if (z >= 4) {
      text(ctx, `${Vr.id.toUpperCase()}  ${Vr.name}`, 20, 34, 24, '#f2e6c8', 700);
      text(ctx, Vr.desc, 20, 58, 14, '#b8b0a0');
    }
    const st = C.stats(B.down0.base), sb = C.stats(B.battle0.base);
    if (z >= 4) text(ctx, `field ↓: ${st.h}px tall · ${st.colors} colours · outline dark ${st.olDark}% (near-black ${st.olNeutral}%)    battle: ${sb.h}px · ${sb.colors} colours · outline dark ${sb.olDark}%`, W - 20 - 860, 34, 13, '#9a917f');
    const place = (b, which, i, y, cellW) => {
      const c = b[which], f = b.f;
      const x0 = 20 + i * cellW + cellW / 2 - f.ox * z, yy = y + ch - 3 * z - f.oy * z;
      // soft ground shadow
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(20 + i * cellW + cellW / 2, y + ch - 3 * z, 7 * z, 2 * z, 0, 0, 7); ctx.fill(); ctx.restore();
      blit(ctx, c, x0, yy, z);
    };
    keysF.forEach((k, i) => { place(B[k], 'base', i, y1, cw); place(B[k], 'lit', i, y2, cw); if (z >= 4) { text(ctx, labF[i], 24 + i * cw, y1 + ch + 16, 12, '#8a8272'); } });
    // battle row: base ×3, lit ×3
    const bw = (maxW + 10) * z;
    BAT_ROW.forEach((k, i) => { place(B[k], 'base', i, y3, bw); place(B[k], 'lit', i + 4, y3, bw); });
    ctx.save(); ctx.fillStyle = 'rgba(12,14,30,0.9)'; ctx.fillRect(20 + 3.5 * bw, y3, 0, 0); ctx.restore();
    if (z >= 4) {
      text(ctx, 'battle idle ×3 (base)', 24, y3 + ch + 16, 12, '#8a8272');
      text(ctx, 'battle idle ×3 (lamp-lit: warm key from the left, cool rim)', 24 + 4 * bw, y3 + ch + 16, 12, '#8a8272');
      text(ctx, 'lamp-lit (warm lantern key, cool night ambient)', 24, y2 + ch + 16, 12, '#8a92b8');
    }
    // night band behind the lit battle frames
    return { W, H };
  }

  // ---------------------------------------------------------------- comparison
  function compare(z) {
    const keys = ['down0', 'side0', 'up0', 'battle0'];
    const colW = [], cellH = 56;
    ORDER.forEach((v) => { const B = build(v); colW.push(keys.reduce((s, k) => s + B[k].base.width + 4, 0)); });
    const gap = 14, head = z >= 4 ? 18 : 6;
    const W0 = colW.reduce((a, b) => a + b + gap, gap), H0 = head + cellH * 2 + 8;
    cv.width = W0 * z; cv.height = H0 * z;
    ctx.save(); ctx.scale(z, z); bgNight(ctx, W0, H0);
    // lamp glow band on the lit row
    let x = gap;
    ORDER.forEach((v, vi) => {
      const B = build(v);
      let cx = x;
      keys.forEach((k) => {
        const b = B[k], f = b.f;
        [['base', head + cellH - 4], ['lit', head + cellH * 2 - 2]].forEach(([w, gy]) => {
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx + f.ox, gy, 6, 1.6, 0, 0, 7); ctx.fill();
          ctx.imageSmoothingEnabled = false; ctx.drawImage(b[w], cx, gy - f.oy);
        });
        cx += b.base.width + 4;
      });
      if (z >= 4) text(ctx, `${v.toUpperCase()} ${V[v].short || ''}`, x, 12, 7.5, '#e8dcc0', 700);
      x += colW[vi] + gap;
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- composites (battle / town)
  function up(c, k) { const o = C.mk(c.width * k, c.height * k), x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, o.width, o.height); return o; }
  function heroPatch(v) {
    const B = build(v), Vr = V[v];
    const zb = Vr.battleZoom || 4; // device px per sprite px in battle
    // battle: swap the rig hero for the base sprite (so the stage's shadows / lightmap work), then paint the lamp-lit one on top
    const bf = B.battle0, k = zb / 2;
    const pipe = { canvas: up(bf.base, k), ox: bf.f.ox * k, oy: bf.f.oy * k };
    if (!RIG.__c5) {
      RIG.__c5 = true;
      const oD = RIG.draw, oR = RZ.render;
      RIG.draw = function (Bd, L) { if (L === BATTLE_ART.LOOKS.arun && G.__hero) { Bd.__hero = true; return; } return oD.apply(this, arguments); };
      RZ.render = function (Bd) { if (Bd.__hero) return G.__hero.pipe; return oR.apply(this, arguments); };
      const oS = BATTLE_ART.stage;
      BATTLE_ART.stage = function (o) {
        const st = oS(o), a = st.actors.find((q) => q.id === 'arun');
        if (G.__hero && a) { const x = st.canvas.getContext('2d'); x.imageSmoothingEnabled = false; const lit = G.__hero.lit; x.drawImage(lit, Math.round(a.x - G.__hero.bf.ox * G.__hero.zb), Math.round(a.y - G.__hero.bf.oy * G.__hero.zb), lit.width * G.__hero.zb, lit.height * G.__hero.zb); }
        return st;
      };
      const oF = FIELD_CHAR.sprite;
      FIELD_CHAR.sprite = function (L, dir, frame, o) {
        if (L === BATTLE_ART.LOOKS.arun && G.__hero) {
          const key = (dir === 'down' ? 'down' : dir === 'up' ? 'up' : 'side') + frame + (dir === 'left' ? 'L' : '');
          const b = G.__hero.B[key], f = b.f, lamp = f.view.lamp;
          const r = { canvas: b.base, ox: f.ox, oy: f.oy, __hero: key, meta: null };
          if (lamp) { const lx = dir === 'left' ? (b.base.width - 1 - lamp[0]) : lamp[0]; r.meta = { light: [lx - f.ox + 0.5, lamp[1] - f.oy] }; }
          return r;
        }
        return oF.apply(this, arguments);
      };
    }
    G.__hero = { v, B, bf: bf.f, pipe, lit: bf.lit, zb };
  }

  async function battleShot(v) {
    heroPatch(v);
    await SCREENS.battle({ layout: 'wide', Q: new URLSearchParams() });
  }
  async function townShot(v) {
    heroPatch(v);
    const s = TOPDOWN.town();
    const it = s.list.find((q) => q.r && q.r.__hero);
    const H = G.FIELD_HUD;
    const vx = 32, vy = 70;
    const v2 = G.fieldView({ layout: 'wide' }, s, vx, vy, 240, 0, {
      after: (o) => {
        if (!it) return;
        const b = G.__hero.B[it.r.__hero];
        o.imageSmoothingEnabled = false;
        o.drawImage(b.lit, (it.x - it.r.ox - vx) * 2, (it.y - it.r.oy - vy) * 2, b.lit.width * 2, b.lit.height * 2);
      },
    });
    const toL = (tx, ty) => [(tx * 32 - v2.vx), (ty * 32 - v2.vy)];
    H.placeCard(20, 18, '港町ファロス', '潮風と灯台の町', ['inn', 'shop', 'bag', 'journal']);
    H.leadCard(700, 18, 244, '森で人が消える', '西・フェルン', -Math.PI / 2);
    const [gx, gy] = toL(13.15, 11.7); H.bubble(gx, gy - 52, '話す');
    H.toast(20, 494, 'save', 'オートセーブしました');
    K.prompts([['y', 'メニュー'], ['x', '地図'], ['b', '走る']], 944, 518, { size: 11 });
  }
  // close-up crop of the town around the party (for review): 2× of the final screen
  G.C5S = { build, sheet, compare, battleShot, townShot, ORDER };

  (async function () {
    const Q = new URLSearchParams(location.search);
    const view = Q.get('view') || 'sheet', v = Q.get('v') || 'v1';
    try {
      await document.fonts.load('700 20px ZenMaru', 'あア亜'); await document.fonts.load('500 20px ZenMaru', 'あア亜');
      if (G.K) { await document.fonts.load('700 20px Cinzel', 'A'); await document.fonts.load('400 20px Cinzel', 'A'); }
      if (view === 'sheet') sheet(v, +(Q.get('z') || 6));
      else if (view === 'preview') {
        // quick look: listed frames, base + lit, big zoom, on grey / night
        const ks = (Q.get('k') || 'down0,side0,up0,battle0').split(','), z = +(Q.get('z') || 8), B = build(v);
        const cells = ks.map((k) => B[k]); const cw = Math.max(...cells.map((b) => b.base.width)) + 4, chh = Math.max(...cells.map((b) => b.base.height)) + 4;
        cv.width = cw * z * ks.length; cv.height = chh * z * 2;
        ctx.fillStyle = '#6a6870'; ctx.fillRect(0, 0, cv.width, chh * z); ctx.save(); ctx.translate(0, chh * z); bgNight(ctx, cv.width, chh * z); ctx.restore();
        cells.forEach((b, i) => { blit(ctx, b.base, i * cw * z + 2 * z, 2 * z, z); blit(ctx, b.lit, i * cw * z + 2 * z, chh * z + 2 * z, z); });
      }
      else if (view === 'compare') compare(+(Q.get('z') || 1));
      else if (view === 'battle') await battleShot(v);
      else if (view === 'town') await townShot(v);
      else if (view === 'stats') {
        const res = {};
        for (const vv of ORDER) { if (!V[vv]) continue; const B = build(vv); res[vv] = {}; for (const k of ['down0', 'side0', 'up0', 'battle0']) res[vv][k] = Object.assign(C.stats(B[k].base), { lit: C.stats(B[k].lit).colors }); }
        document.body.setAttribute('data-stats', JSON.stringify(res));
      }
      document.title = 'done';
    } catch (e) { console.error(e.stack || e); document.title = 'err'; }
  })();
})(window);
