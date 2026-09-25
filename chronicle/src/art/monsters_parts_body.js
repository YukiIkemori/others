// Monster parts, back / body / silhouette / tail (A14a mons-parts, DESIGN §9.4.4):
// wings_bat wings_feather wings_insect cape shell_tower spikes thorns armor_plates chain runes coral crystals
// moss frost spots drips skull_mark stinger rattle teeth_iron tusks claws pins bell.
// Same contract as monsters_parts_head.js: (pix, anchor, opts), solid pixels in `pix`, glints in opts.fx.
// Silhouette parts (spikes, thorns, coral, crystals, moss, frost, drips) follow the base's own outline
// (opts.info), so they fit any base, including the bosses of A15 that have no anchor table.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const PARTS = (A.PARTS = A.PARTS || {});
  const TK = () => A.PartTK;

  // ---------------------------------------------------------------- shared helpers
  /** is (x,y) at least d px inside the base silhouette (4 directions) */
  function deep(info, x, y, d) {
    for (let i = 0; i <= d; i++) if (!info.on(x + i, y) || !info.on(x - i, y) || !info.on(x, y + i) || !info.on(x, y - i)) return false;
    return true;
  }
  /** body region: inner base pixels inside an ellipse around the body anchor */
  function bodyRegion(o, a, fx, fy, d) {
    const info = o.info, b = info.bbox;
    // an anchor override may carry its own region size: [x, y, fx, fy]
    if (a.length >= 4) { fx = a[2]; fy = a[3]; }
    const rx = Math.max(3, (b.x1 - b.x0) * (fx || 0.33)), ry = Math.max(3, (b.y1 - b.y0) * (fy || 0.24));
    const pts = [];
    for (let y = Math.floor(a[1] - ry); y <= Math.ceil(a[1] + ry); y++) for (let x = Math.floor(a[0] - rx); x <= Math.ceil(a[0] + rx); x++) {
      const dx = (x - a[0]) / rx, dy = (y - a[1]) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (deep(info, x, y, d == null ? 1 : d)) pts.push([x, y]);
    }
    return { pts, rx, ry, has: (x, y) => { const dx = (x - a[0]) / rx, dy = (y - a[1]) / ry; return dx * dx + dy * dy <= 1 && deep(info, x, y, d == null ? 1 : d); } };
  }
  /** pick points from a list with a minimum spacing (deterministic by rng) */
  function spaced(list, gap, max, rng, score) {
    const pool = list.slice();
    if (score) pool.sort((p, q) => score(q) - score(p) + (rng() - 0.5) * 0.001);
    else for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const out = [];
    for (const p of pool) {
      if (out.length >= max) break;
      if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= gap)) out.push(p);
    }
    return out;
  }
  /** upper contour points of the main body (not the extreme thin tips), sorted left → right */
  function upper(o, minNy) {
    const T = TK(), info = o.info, b = info.bbox;
    return T.contour(info, 'up').filter((q) => q.ny <= (minNy == null ? -0.5 : minNy) && q.y < b.y1 - (b.y1 - b.y0) * 0.25).sort((p, q) => p.x - q.x);
  }
  /** a shaded straight spike (triangle) from (x,y) along (nx,ny), length L, half-width w */
  function spike(m, x, y, nx, ny, L, w) {
    const px = -ny, py = nx;
    const x0 = x - nx * 1, y0 = y - ny * 1;
    m.poly([[x0 + px * w, y0 + py * w], [x0 - px * w, y0 - py * w], [x + nx * L, y + ny * L]], 1);
  }
  /** fill a mask with a two-face ramp: faces toward the upper-left light are lighter */
  function facet(p, m, rmp, cx) {
    const T = TK(), b = T.bboxOf(m);
    if (!b) return;
    const n = rmp.length;
    m.each((x, y) => {
      const edgeR = m.get(x + 1, y) == null, edgeL = m.get(x - 1, y) == null, edgeT = m.get(x, y - 1) == null;
      let k = x < (cx == null ? (b.x0 + b.x1) / 2 : cx) ? n - 2 : 1;
      if (edgeL || edgeT) k = Math.min(n - 1, k + 1);
      if (edgeR) k = Math.max(0, k - 1);
      p.set(x, y, rmp[k]);
      return undefined;
    });
  }
  const sideOf = (o, x) => (x < o.anchors.body[0] ? -1 : 1);

  // ---------------------------------------------------------------- wings (back layer)
  function wingSpan(o, a) {
    const info = o.info, b = info.bbox;
    const sz = o.size;
    const f = sz === 's' ? 0.62 : sz === 'l' ? 1 : 0.82;
    const halfW = Math.max(6, Math.min(a[0] - 1, info.w - 2 - a[0]));
    return { reach: Math.round(halfW * f), top: Math.max(1, Math.round(a[1] - (b.y1 - b.y0) * (sz === 's' ? 0.3 : sz === 'l' ? 0.55 : 0.42))) };
  }
  PARTS.wings_bat = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const c = o.c || '#503060';
    const mem = T.ramp(c, 5, { dark: 0.6, light: 0.45 }), bone = T.ramp(T.dk(c, 0.7), 4, { dark: 0.55, light: 0.5 });
    const { reach, top } = wingSpan(o, a);
    for (const s of [-1, 1]) {
      const sx = a[0] + s * Math.round(2 * k), sy = a[1];
      const wx = a[0] + s * Math.round(reach * 0.55), wy = top;             // wrist
      const fingers = [[a[0] + s * reach, top + Math.round(reach * 0.25)], [a[0] + s * Math.round(reach * 0.92), sy + Math.round(reach * 0.35)], [a[0] + s * Math.round(reach * 0.6), sy + Math.round(reach * 0.55)]];
      const m = T.mask(p.w, p.h);
      // membrane: polygon from the shoulder over the wrist and finger tips, scalloped between tips
      const poly = [[sx, sy - Math.round(k)], [wx, wy]].concat(fingers).concat([[sx, sy + Math.round(reach * 0.45)]]);
      m.poly(poly, 1);
      // scallops: bite half-circles out of the edge between neighbouring finger tips
      for (let i = 0; i < fingers.length; i++) {
        const p0 = fingers[i], p1 = i + 1 < fingers.length ? fingers[i + 1] : [sx, sy + Math.round(reach * 0.45)];
        const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
        const r = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 0.38;
        const cxs = mx - s * r * 0.35 + (i === 0 ? s * 0.5 : 0), cys = my + r * 0.4;
        m.ellipse(cxs, cys, r, r * 0.8, null);
      }
      const shaded = T.shade(m, mem, { depth: 2.5, global: 0.5 });
      p.blit(shaded, 0, 0);
      // bones: arm to the wrist, fingers fanning out
      const bm = T.mask(p.w, p.h);
      T.capsule(bm, sx, sy - k, wx, wy, 0.7 * k, 0.6 * k, 1);
      for (const f of fingers) T.capsule(bm, wx, wy, f[0], f[1], 0.45 * k + 0.1, 0.3, 1);
      bm.each((x, y) => (m.get(x, y) == null && Math.hypot(x - wx, y - wy) > 1.5 * k ? null : undefined));
      p.blit(T.shade(bm, bone, { depth: 1 }), 0, 0);
      // claw at the wrist
      p.set(wx, wy - 1, bone[3]); if (k >= 1.5) p.set(wx - s, wy - 2, bone[2]);
    }
  };
  PARTS.wings_feather = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rmp = T.ramp(o.c || '#ffffff', 5, { dark: 0.42, light: 0.5 });
    const { reach, top } = wingSpan(o, a);
    for (const s of [-1, 1]) {
      const sx = a[0] + s * Math.round(2 * k), sy = a[1];
      // a curved arm rising up and out; feathers hang from it in three rows
      const arm = [[sx, sy], [a[0] + s * reach * 0.55, top - Math.round(2 * k)], [a[0] + s * reach, top + Math.round(reach * 0.2)]];
      const rows = [
        { n: 6, len: reach * 0.95, r: 1.1 * k, t0: 0.25 },  // primaries (long)
        { n: 5, len: reach * 0.6, r: 1.2 * k, t0: 0.1 },    // secondaries
        { n: 4, len: reach * 0.32, r: 1.3 * k, t0: 0.0 },   // coverts
      ];
      rows.forEach((row, ri) => {
        const m = T.mask(p.w, p.h);
        for (let i = 0; i < row.n; i++) {
          const t = row.t0 + ((1 - row.t0) * (i + 0.5)) / row.n;
          const [x0, y0] = T.bez(arm, t);
          const ang = Math.PI / 2 + s * (-0.2 - t * 1.1);
          const L = row.len * (0.55 + 0.45 * t);
          T.capsule(m, x0, y0, x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L, row.r, row.r * 0.55, 1);
        }
        T.tube(m, arm, 1.2 * k, 0.9 * k, 1, 14);
        const sh = T.shade(m, rmp, { depth: 1.5, bias: ri * 0.06 });
        // separate the feathers with thin darker gaps
        p.blit(sh, 0, 0);
        m.each((x, y) => { if ((x * 3 + y) % Math.max(3, Math.round(2 + k)) === 0 && m.get(x, y - 1) != null && ri === 0) p.set(x, y, rmp[1]); return undefined; });
      });
    }
  };
  PARTS.wings_insect = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rim = T.ramp(o.c || '#c0f0ff', 4, { dark: 0.45, light: 0.6 });
    const { reach, top } = wingSpan(o, a);
    for (const s of [-1, 1]) {
      const wings = [
        { x: a[0] + s * reach * 0.5, y: top + reach * 0.05, rx: reach * 0.52, ry: reach * 0.28, rot: s * -0.55 },
        { x: a[0] + s * reach * 0.42, y: a[1] + reach * 0.3, rx: reach * 0.4, ry: reach * 0.2, rot: s * 0.35 },
      ];
      for (const w of wings) {
        const cos = Math.cos(w.rot), sin = Math.sin(w.rot);
        const inside = (x, y) => {
          const dx = x - w.x, dy = y - w.y;
          const u = (dx * cos + dy * sin) / w.rx, v = (-dx * sin + dy * cos) / w.ry;
          return u * u + v * v <= 1;
        };
        for (let y = Math.floor(w.y - w.rx); y <= Math.ceil(w.y + w.rx); y++) for (let x = Math.floor(w.x - w.rx); x <= Math.ceil(w.x + w.rx); x++) {
          if (!inside(x, y)) continue;
          const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
          if (edge) p.set(x, y, rim[x - w.x < 0 === s < 0 ? 1 : 2]);
          else if ((x + y) % 2 === 0) o.fx.set(x, y, T.mix(rim[3], '#ffffff', ((x * 7 + y * 3) % 5) / 10)); // see-through: checker dither
        }
        // veins from the root
        const rx0 = a[0] + s * Math.round(2 * k), ry0 = a[1];
        for (let v = -1; v <= 1; v++) {
          const ang = w.rot + (s < 0 ? Math.PI : 0) + v * 0.35;
          for (let r = 2; r < w.rx * 1.7; r++) {
            const x = Math.round(rx0 + Math.cos(ang) * r), y = Math.round(ry0 + Math.sin(ang) * r);
            if (inside(x, y) && p.get(x, y) == null) { o.fx.set(x, y, rim[1]); }
          }
        }
      }
    }
  };

  // ---------------------------------------------------------------- cape マント (back layer + a collar in front)
  PARTS.cape = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info, an = o.anchors;
    const outer = T.ramp(o.c || '#301020', 5, { dark: 0.6, light: 0.45 });
    const lining = T.ramp(o.c2 || '#c02030', 5, { dark: 0.55, light: 0.5 });
    const b = info.bbox;
    const sh = Math.max(4, Math.round((b.x1 - b.x0) * 0.26));
    const y0 = a[1] - Math.round(1 * k), feet = an.feet ? an.feet[1] : b.y1;
    // a floating body (ghosts, wisps) has a shorter mantle that ends in the air
    const bottom = an.float ? Math.round(an.body[1] + (feet - an.body[1]) * 0.55) : Math.min(info.h - 2, feet - Math.round(1 * k));
    const near = (x, y, d) => { for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) if (info.on(x + i, y + j)) return true; return false; };
    /** the lining shows only where the cloth comes out sideways from behind the body */
    const beside = (x, y) => info.on(x - 1, y) || info.on(x + 1, y) || info.on(x - 2, y) || info.on(x + 2, y);
    if (o.style === 'tailcoat') {
      // two long coat tails behind the legs, split in the middle, lining on the inner edges
      const waist = an.body ? an.body[1] : Math.round((y0 + feet) / 2);
      for (const s2 of [-1, 1]) {
        const m = T.mask(p.w, p.h);
        m.poly([[a[0], waist], [a[0] + s2 * sh * 0.95, waist - Math.round(k)], [a[0] + s2 * sh * 1.35, bottom], [a[0] + s2 * sh * 0.75, bottom - Math.round(2 * k)], [a[0] + s2 * Math.round(1 * k), bottom - Math.round(3 * k)]], 1);
        p.blit(T.shade(m, outer, { depth: 2, global: 0.4 }), 0, 0);
        m.each((x, y) => { if (m.get(x - s2, y) == null || (near(x, y, 1) && y > waist + 2)) p.set(x, y, lining[2]); return undefined; });
      }
      return;
    }
    // the drape: shoulders to the ground, flaring, with folds and a wavy hem
    const flare = Math.round(sh * 1.6);
    const m = T.mask(p.w, p.h);
    m.poly([[a[0] - sh, y0], [a[0] + sh + 1, y0], [a[0] + flare + 1, bottom], [a[0] - flare, bottom]], 1);
    for (let x = a[0] - flare - 1; x <= a[0] + flare + 1; x++) {
      const dip = Math.round((Math.sin((x - a[0]) * (1.25 / k)) + 1) * 0.6 * k);
      for (let y = bottom - dip + 1; y <= bottom; y++) m.set(x, y, null);
    }
    const mb = T.bboxOf(m);
    if (!mb) return;
    const fold = Math.max(3, Math.round(2.5 * k));
    m.each((x, y) => {
      const t = (x - mb.x0) / Math.max(1, mb.x1 - mb.x0);
      const u = (y - mb.y0) / Math.max(1, mb.y1 - mb.y0);
      // lining shows where the cloth comes out from behind the body; the outside everywhere else
      if (beside(x, y) && u > 0.06 && u < 0.62) { p.set(x, y, lining[T.clamp(3 - Math.round(u * 2), 1, 3)]); return undefined; }
      const f = Math.sin(((x - a[0]) / fold) * Math.PI) * (0.4 + u * 0.8);
      const k2 = T.clamp(Math.round(T.cyl(t, 5) * 0.6 + 1 + f), 0, 4);
      p.set(x, y, outer[k2]);
      return undefined;
    });
    // hem: a turned edge of lining along the bottom
    for (let x = mb.x0; x <= mb.x1; x++) for (let y = mb.y1; y >= mb.y0; y--) if (m.get(x, y) != null) { p.set(x, y, lining[1]); break; }
    // collar: a stiff standing collar flaring up beside the head, in front of the shoulders
    const hx = an.head[0], hw = an.headW || Math.round(10 * k);
    const hy = an.head[1], my = an.mouth ? an.mouth[1] : hy + Math.round(hw * 0.6);
    const hcx = hx, hcy = (hy + my) / 2 + 0.5, hrx = hw / 2 + 0.8, hry = (my - hy) / 2 + 1.5;
    const col = o.extra('front');
    const ny = an.neck ? an.neck[1] : my + 2;
    for (const s2 of an.collar === false ? [] : [-1, 1]) {
      const cm = T.mask(p.w, p.h);
      const topY = Math.max(1, hy + Math.round(hw * 0.3));
      cm.poly([
        [hx + s2 * Math.round(hw * 0.2), ny + 1],
        [hx + s2 * Math.round(hw / 2 + 1), ny + Math.round(1.5 * k)],
        [hx + s2 * Math.round(hw / 2 + 3.2 * k), Math.round((topY + ny) / 2)],
        [hx + s2 * Math.round(hw / 2 + 3.6 * k), topY],
        [hx + s2 * Math.round(hw / 2 + 0.5 * k), topY + Math.round(2 * k)],
      ], 1);
      cm.each((x, y) => (((x - hcx) / hrx) ** 2 + ((y - hcy) / hry) ** 2 <= 1 ? null : undefined));
      const cb = T.bboxOf(cm);
      if (!cb) continue;
      cm.each((x, y) => {
        // inner face (lining) toward the head, a dark outer rim, ribs every few px
        const outerEdge = cm.get(x + s2, y) == null || cm.get(x, y - 1) == null;
        const innerFace = ((x - hcx) / (hrx + 1.6 * k)) ** 2 + ((y - hcy) / (hry + 1.2 * k)) ** 2 <= 1;
        col.set(x, y, outerEdge ? outer[1] : innerFace ? lining[2] : (x + y) % Math.max(3, Math.round(2.5 * k)) === 0 ? lining[1] : lining[3]);
        return undefined;
      });
    }
    // clasp at the throat
    const clx = hx, cly = ny;
    col.set(clx, cly, '#e8c850'); if (k >= 1.5) { col.set(clx - 1, cly, '#b08830'); col.set(clx + 1, cly, '#b08830'); }
    o.fx.set(clx, cly, '#fff0a0');
  };

  // ---------------------------------------------------------------- shell_tower 背中の城 (back)
  PARTS.shell_tower = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info, an = o.anchors;
    const stone = T.ramp(o.c || '#d8c8a0', 5, { dark: 0.55, light: 0.5 });
    const roof = T.ramp(o.c2 || '#c04830', 4, { dark: 0.55, light: 0.5 });
    const w = Math.round(3 + 2.5 * k) | 1, H = Math.min(a[1] - 2, Math.round(9 * k + 3));
    const x0 = a[0] - Math.floor(w / 2), yb = a[1] + Math.round(1.5 * k), yt = Math.max(Math.round(3.5 * k) + 2, yb - H);
    // the tower stands on the back; the eyes (and their stalks) stay in front of it
    const er = 1.5 + 1.6 * k;
    const hidden = (x, y) => an.eyes.some((e) => Math.hypot(x - e[0], y - e[1]) <= er || (Math.abs(x - e[0]) <= 1 && y > e[1] && y < yb - 1 && info.on(x, y)));
    const put1 = (x, y, c) => { if (!hidden(x, y)) p.set(x, y, c); };
    // walls: courses of dressed stone, lit from the left
    for (let y = yt; y <= yb; y++) for (let x = x0; x < x0 + w; x++) {
      const t = (x - x0) / Math.max(1, w - 1);
      const course = (y - yt) % 3 === 2, joint = (x + Math.floor((y - yt) / 3) * 2) % 4 === 0;
      put1(x, y, course || (joint && (y - yt) % 3 === 1) ? stone[1] : stone[T.cyl(t, 5)]);
    }
    // crenellations
    for (let x = x0 - 1; x <= x0 + w; x++) { put1(x, yt, stone[3]); if ((x - x0) % 2 === 0) put1(x, yt - 1, stone[x < a[0] ? 3 : 2]); }
    // arched window with a warm light, a door at the foot
    const wx = a[0], wy = yt + Math.round(2 * k) + 1;
    for (let j = 0; j < (k < 1.3 ? 2 : 3); j++) put1(wx, wy + j, '#302028');
    if (k >= 1.5) { put1(wx + 1, wy + 1, '#302028'); put1(wx + 1, wy + 2, '#302028'); }
    if (!hidden(wx, wy + 1)) o.fx.set(wx, wy + 1, '#ffd070');
    // conical roof and a pennant on a pole
    const rh = Math.round(2 + 1.5 * k);
    const rm = T.mask(p.w, p.h);
    rm.poly([[x0 - 1, yt - 1], [x0 + w + 1, yt - 1], [a[0] + 0.5, Math.max(0, yt - 1 - rh)]], 1);
    const rs = T.shade(rm, roof, { depth: 1 });
    rs.each((x, y, c) => { put1(x, y, c); return undefined; });
    const pole = Math.max(0, yt - 1 - rh);
    const ph = Math.round(2 * k);
    for (let y = Math.max(0, pole - ph); y <= pole; y++) put1(a[0], y, '#504038');
    const fy = Math.max(0, pole - ph);
    for (let i = 1; i <= Math.round(2.2 * k); i++) for (let j = 0; j < Math.max(1, Math.round(k * 0.8)); j++) put1(a[0] + i, fy + j + (i > 1.5 * k ? 1 : 0), roof[i === 1 ? 3 : 2]);
  };

  // ---------------------------------------------------------------- spikes とげ (upper contour)
  PARTS.spikes = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rmp = T.ramp(o.c || '#302020', 4, { dark: 0.5, light: 0.55 });
    const pts = upper(o, -0.55);
    const gap = Math.round(3 + 1.6 * k), L = Math.round(1.5 + 1.5 * k), w = 0.9 + 0.35 * k;
    const pick = spaced(pts, gap, 14, o.rng, (q) => -q.y * 0.2 + o.rng());
    for (const q of pick) {
      const m = T.mask(p.w, p.h);
      spike(m, q.x, q.y, q.nx * 0.6, q.ny, L, w);
      facet(p, m, rmp, q.x + 0.5);
    }
  };
  // ---------------------------------------------------------------- thorns いばら (whole contour)
  PARTS.thorns = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rmp = T.ramp(o.c || '#2a5020', 3, { dark: 0.5, light: 0.6 });
    const pts = T.contour(o.info, 'any');
    const pick = spaced(pts, Math.round(3 + k), 40, o.rng);
    for (const q of pick) {
      const L = k < 1.3 ? 1 : 2;
      for (let i = 1; i <= L; i++) p.set(Math.round(q.x + q.nx * i), Math.round(q.y + q.ny * i), i === L ? rmp[2] : rmp[1]);
      p.set(q.x, q.y, rmp[0]);
    }
  };
  // ---------------------------------------------------------------- armor_plates 装甲板 (body)
  PARTS.armor_plates = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info;
    const st = o.style;
    const reg = bodyRegion(o, a, 0.3, 0.2, 1);
    if (!reg.pts.length) return;
    const rmp = st === 'rock' ? T.ramp(o.c || '#7a7060', 5, { dark: 0.55, light: 0.45 }) : T.metal(o.c || '#8890a0', 5);
    const pw = Math.round(3 + 2 * k), ph = Math.round(2 + 1.6 * k);
    const r = o.rng;
    if (st === 'rock') {
      // irregular slabs: jittered cells, each shaded as a bevelled stone
      const cells = [];
      for (let y = Math.floor(a[1] - reg.ry); y <= a[1] + reg.ry; y += ph + 1) for (let x = Math.floor(a[0] - reg.rx) + ((y / (ph + 1)) & 1 ? Math.round(pw / 2) : 0); x <= a[0] + reg.rx; x += pw + 1) cells.push([x + Math.round((r() - 0.5) * 2), y + Math.round((r() - 0.5) * 1.5)]);
      for (const [cx, cy] of cells) {
        const m = T.mask(p.w, p.h);
        m.poly([[cx, cy + 1], [cx + 1, cy], [cx + pw - 1, cy], [cx + pw, cy + 1], [cx + pw, cy + ph - 1], [cx + pw - 1, cy + ph], [cx + 1, cy + ph], [cx, cy + ph - 1]], 1);
        m.each((x, y) => (reg.has(x, y) ? undefined : null));
        if (!T.bboxOf(m)) continue;
        p.blit(T.shade(m, rmp, { depth: 1.5 }), 0, 0);
        m.each((x, y) => { if ((x * 13 + y * 7) % 9 === 0) p.set(x, y, rmp[1]); return undefined; });
      }
      return;
    }
    if (st === 'rivet') {
      // one riveted iron plate over the chest, rows of rivets, a seam down the middle
      const m = T.mask(p.w, p.h);
      for (const [x, y] of reg.pts) m.set(x, y, 1);
      p.blit(T.shade(m, rmp, { depth: 2, global: 0.45 }), 0, 0);
      for (const [x, y] of reg.pts) {
        const edge = !reg.has(x, y - 1) || !reg.has(x - 1, y);
        if (edge) p.set(x, y, rmp[3]);
        if ((y - Math.round(a[1] - reg.ry)) % Math.round(1.5 + 1.2 * k) === 1 && (x + y) % Math.round(2 + k) === 0) { p.set(x, y, rmp[4]); if (reg.has(x + 1, y + 1)) p.set(x + 1, y + 1, rmp[0]); }
      }
      for (let y = Math.floor(a[1] - reg.ry); y <= a[1] + reg.ry; y++) if (reg.has(a[0], y)) p.set(a[0], y, rmp[0]);
      return;
    }
    // lamellar plates: rows of overlapping plates over the chest, staggered seams, a dark rim around the
    // whole piece, highlights on the top edge of every row, rivets on the plate corners
    const x0 = Math.floor(a[0] - reg.rx), x1 = Math.ceil(a[0] + reg.rx);
    const y0 = Math.floor(a[1] - reg.ry);
    for (const [x, y] of reg.pts) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      const row = Math.floor((y - y0) / (ph + 1)), ry = (y - y0) % (ph + 1);
      const off = row % 2 ? Math.round(pw / 2) : 0;
      const col = (x - x0 + off) % (pw + 1);
      const rim = !reg.has(x - 1, y) || !reg.has(x + 1, y) || !reg.has(x, y - 1) || !reg.has(x, y + 1);
      const base = T.clamp(T.cyl(t, 5), 1, 3);
      let c;
      if (rim) c = rmp[0];
      else if (ry === ph) c = rmp[0];                         // seam under the row
      else if (col === pw) c = rmp[Math.max(0, base - 1)];    // seam between plates
      else if (ry === 0) c = rmp[Math.min(4, base + 1)];      // lit top edge
      else if (ry === ph - 1) c = rmp[Math.max(1, base - 1)];
      else c = rmp[base];
      p.set(x, y, c);
      if (k >= 1.3 && !rim && ry === 1 && col === 1) p.set(x, y, rmp[4]);
    }
    void info;
  };
  // ---------------------------------------------------------------- chain 鎖 (body, diagonal)
  PARTS.chain = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info, b = info.bbox;
    const rmp = T.metal(o.c || '#6a6480', 4);
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    const x0 = a[0] - w * 0.4, y0 = a[1] - h * 0.28, x1 = a[0] + w * 0.42, y1 = a[1] + h * 0.2;
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(L / (2 + k));
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (let i = 0; i <= n; i++) {
      const cx = x0 + ux * i * (2 + k), cy = y0 + uy * i * (2 + k);
      const X = Math.round(cx), Y = Math.round(cy);
      if (!info.on(X, Y) && !info.on(X, Y + 1) && !info.on(X, Y - 1)) continue;
      if (i % 2 === 0) {
        // link seen flat: a ring
        const r = k < 1.3 ? 1 : 1.5;
        for (let t = 0; t < 360; t += 30) { const ang = (t * Math.PI) / 180; p.set(Math.round(cx + Math.cos(ang) * r * 1.2), Math.round(cy + Math.sin(ang) * r), rmp[Math.sin(ang) < 0 ? 3 : 1]); }
      } else {
        // link seen edge-on: a short bar
        p.set(X, Y, rmp[2]); p.set(X + Math.round(ux), Y + Math.round(uy), rmp[1]);
        if (k >= 1.5) p.set(X - Math.round(ux), Y - Math.round(uy), rmp[3]);
      }
    }
    // a shackle where the chain meets the body edge
    o.fx.set(Math.round(x0), Math.round(y0), rmp[3]);
  };
  // ---------------------------------------------------------------- runes 紋様 (body)
  const GLYPHS = [
    ['#..', '##.', '#.#', '#..'], ['.#.', '###', '.#.', '.#.'], ['#.#', '.#.', '#.#', '..#'], ['##.', '#.#', '##.', '#..'],
    ['.#.', '#.#', '.#.', '#.#'], ['#..', '#.#', '###', '..#'],
  ];
  PARTS.runes = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const c = o.c || '#80ffff', core = T.mix(c, '#ffffff', 0.55), dim = T.dk(c, 0.6);
    const reg = bodyRegion(o, a, 0.3, 0.24, 1);
    const n = k < 1.3 ? 3 : k < 1.8 ? 4 : 6;
    const places = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + o.rng() * 0.5;
      places.push([Math.round(a[0] + Math.cos(ang) * reg.rx * 0.62) - 1, Math.round(a[1] + Math.sin(ang) * reg.ry * 0.62) - 2]);
    }
    // a thin circuit joining the glyphs
    for (let i = 0; i < places.length; i++) {
      const [x0, y0] = places[i], [x1, y1] = places[(i + 1) % places.length];
      T.line(p, x0 + 1, y0 + 2, x1 + 1, y1 + 2, (x, y) => (reg.has(x, y) && (x + y) % 2 === 0 ? dim : null));
    }
    places.forEach(([x, y], i) => {
      const g = GLYPHS[(i + (o.seed & 7)) % GLYPHS.length];
      g.forEach((row, j) => { for (let q = 0; q < row.length; q++) if (row[q] === '#' && reg.has(x + q, y + j)) { p.set(x + q, y + j, c); if (j === 1) o.fx.set(x + q, y + j, core); } });
    });
  };
  // ---------------------------------------------------------------- coral サンゴ (upper contour)
  PARTS.coral = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rmp = T.ramp(o.c || '#e08070', 5, { dark: 0.55, light: 0.55 });
    const shell = T.ramp('#c8c0a8', 4);
    const pts = upper(o, -0.6);
    const pick = spaced(pts, Math.round(6 * k), k < 1.3 ? 3 : 4, o.rng, (q) => -q.y + o.rng() * 4);
    for (const q of pick) {
      const m = T.mask(p.w, p.h);
      const L = Math.round(3 + 2.5 * k);
      const tip = [q.x + q.nx * L * 0.3, q.y - L];
      T.tube(m, [[q.x, q.y + 1], [q.x, q.y - L * 0.5], tip], 0.8 * k, 0.5 * k, 1, 10);
      // two forks
      for (const s of [-1, 1]) {
        const fx0 = q.x + s * 0.3, fy0 = q.y - L * 0.45;
        T.tube(m, [[fx0, fy0], [fx0 + s * L * 0.35, fy0 - L * 0.1], [fx0 + s * L * 0.45, fy0 - L * 0.45]], 0.6 * k, 0.4 * k, 1, 8);
      }
      p.blit(T.shade(m, rmp, { depth: 1.2 }), 0, 0);
      m.each((x, y) => { if (m.get(x, y - 1) == null && (x + y) % 2) o.fx.set(x, y, rmp[4]); return undefined; });
    }
    // barnacles along the rest of the top edge
    const bar = spaced(pts, Math.round(4 * k), k < 1.3 ? 3 : 5, o.rng);
    for (const q of bar) {
      if (pick.some((c) => Math.hypot(c.x - q.x, c.y - q.y) < 3 * k)) continue;
      p.set(q.x, q.y, shell[2]); p.set(q.x + 1, q.y, shell[1]); p.set(q.x, q.y - 1, shell[3]);
      if (k >= 1.5) { p.set(q.x - 1, q.y, shell[2]); p.set(q.x, q.y - 1, '#403830'); p.set(q.x - 1, q.y - 1, shell[3]); p.set(q.x + 1, q.y - 1, shell[1]); }
    }
  };
  // ---------------------------------------------------------------- crystals 結晶 (upper contour)
  PARTS.crystals = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rmp = T.ramp(o.c || '#a0e0ff', 5, { dark: 0.5, light: 0.75 });
    const pts = upper(o, -0.45);
    const pick = spaced(pts, Math.round(4 + 2 * k), k < 1.3 ? 4 : 6, o.rng, (q) => -q.y * 0.3 + o.rng() * 3);
    pick.forEach((q, i) => {
      const m = T.mask(p.w, p.h);
      const L = Math.round((2.5 + 2.5 * k) * (i % 2 ? 0.7 : 1));
      const w = 0.9 + 0.5 * k;
      const nx = q.nx * 0.7 + (i % 3 - 1) * 0.25, ny = Math.min(-0.5, q.ny);
      const l = Math.hypot(nx, ny);
      const ux = nx / l, uy = ny / l;
      // hexagonal prism seen from the side: a long hexagon with a pointed top
      const px = -uy, py = ux;
      const bx = q.x - ux, by = q.y - uy;
      m.poly([[bx + px * w, by + py * w], [bx + ux * L * 0.75 + px * w, by + uy * L * 0.75 + py * w], [q.x + ux * L, q.y + uy * L], [bx + ux * L * 0.75 - px * w, by + uy * L * 0.75 - py * w], [bx - px * w, by - py * w]], 1);
      facet(p, m, rmp, q.x + 0.3);
      o.fx.set(Math.round(q.x + ux * L), Math.round(q.y + uy * L), '#ffffff');
      if (L > 4) o.fx.set(Math.round(bx + ux * L * 0.5 + px * (w - 0.5)), Math.round(by + uy * L * 0.5 + py * (w - 0.5)), rmp[4]);
    });
  };
  // ---------------------------------------------------------------- moss 苔 (upper contour)
  PARTS.moss = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info;
    const rmp = T.ramp(o.c || '#58a040', 5, { dark: 0.6, light: 0.5 });
    const pts = upper(o, -0.4);
    const pick = spaced(pts, Math.round(3 + 1.5 * k), 18, o.rng);
    for (const q of pick) {
      const r = (0.9 + o.rng() * 0.9) * k;
      const m = T.mask(p.w, p.h);
      m.ellipse(q.x, q.y + 0.5, r * 1.3, r, 1);
      m.each((x, y) => (y > q.y + 1 && !info.on(x, y) ? null : undefined));
      p.blit(T.shade(m, rmp, { depth: 1.2 }), 0, 0);
      // speckle and a leaf or a dangling strand
      m.each((x, y) => { if ((x * 5 + y * 3 + q.x) % 4 === 0) p.set(x, y, rmp[(x + y) % 2 ? 1 : 3]); return undefined; });
      if (o.rng() < 0.4) { p.set(q.x + 1, q.y - Math.round(r) - 1, rmp[3]); p.set(q.x + 2, q.y - Math.round(r) - 2, rmp[4]); }
      if (o.rng() < 0.35 && q.nx !== 0) for (let j = 1; j <= Math.round(1.5 * k); j++) p.set(Math.round(q.x + q.nx * 1.5), q.y + j, rmp[1]);
    }
  };
  // ---------------------------------------------------------------- frost 霜 (upper contour + icicles)
  PARTS.frost = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info;
    const rmp = T.ramp(o.c || '#e8fcff', 4, { dark: 0.3, light: 0.8 });
    // an ice skin: the top 1–2 rows of every upward-facing edge turn to rime, with a light rim above
    const th = k < 1.3 ? 1 : 2;
    for (const q of T.contour(info, 'up')) {
      if (q.ny > -0.4) continue;
      for (let i = 1; i <= th; i++) { const x = q.x, y = q.y + i; if (info.inner(x, y)) p.set(x, y, i === 1 ? rmp[2] : rmp[1]); }
      p.set(q.x, q.y, rmp[3]);
      if ((q.x + q.y) % 3 === 0) o.fx.set(q.x, q.y, '#ffffff');
    }
    // icicles hanging from downward-facing ledges
    const down = T.contour(info, 'down').filter((q) => q.ny >= 0.7 && q.y < info.bbox.y1 - 2);
    const pick = spaced(down, Math.round(3 + 1.5 * k), k < 1.3 ? 5 : 8, o.rng, (q) => o.rng());
    for (const q of pick) {
      const L = Math.round((1.5 + o.rng() * 2) * k);
      let free = 0;
      for (let j = 1; j <= L; j++) if (!info.on(q.x, q.y + j)) free++;
      if (free < 2) continue;
      for (let j = 0; j <= L; j++) {
        if (info.on(q.x, q.y + j) && j > 0) break;
        p.set(q.x, q.y + j, j === L ? rmp[3] : rmp[j < L / 2 ? 2 : 1]);
        if (k >= 1.5 && j < L / 2) p.set(q.x + 1, q.y + j, rmp[1]);
      }
      o.fx.set(q.x, q.y + L, '#ffffff');
    }
  };
  // ---------------------------------------------------------------- spots 斑点 (body)
  PARTS.spots = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info;
    const c = o.c || '#f0e060';
    const rmp = T.ramp(c, 4, { dark: 0.45, light: 0.6 });
    const st = o.style;
    if (st === 'stripes') {
      const reg = bodyRegion(o, a, 0.4, 0.34, 0);
      const step = Math.round(2 + 1.4 * k);
      for (const [x, y] of reg.pts) {
        const wv = Math.round(Math.sin(x * 0.45) * 0.8);
        if ((y + wv - Math.round(a[1])) % step === 0 || (k >= 1.5 && (y + wv - Math.round(a[1])) % step === 1)) p.set(x, y, (y + wv) % step === 0 ? rmp[2] : rmp[1]);
      }
      return;
    }
    if (st === 'suckers') {
      // rows of suckers just inside the lower edges (tentacle undersides)
      const down = T.contour(info, 'down').filter((q) => q.y > info.bbox.y0 + (info.bbox.y1 - info.bbox.y0) * 0.35);
      const pick = spaced(down, Math.round(2.5 + k), 30, o.rng, (q) => o.rng());
      for (const q of pick) {
        const x = Math.round(q.x - q.nx * 2), y = Math.round(q.y - q.ny * 2);
        if (!info.inner(x, y)) continue;
        p.set(x, y, rmp[2]);
        if (k >= 1.5) { p.set(x + 1, y, rmp[1]); p.set(x, y - 1, rmp[3]); p.set(x + 1, y - 1, rmp[2]); }
        o.fx.set(x + (k >= 1.5 ? 1 : 0), y, T.dk(c, 0.45));
      }
      return;
    }
    const reg = bodyRegion(o, a, 0.36, 0.3, Math.round(k));
    const list = reg.pts.map(([x, y]) => ({ x, y }));
    const r = k < 1.3 ? 1 : k < 1.8 ? 1.8 : 2.4;
    const pick = spaced(list, r * 3 + 1, k < 1.3 ? 5 : 8, o.rng);
    pick.forEach((q, i) => {
      const rr = r * (i % 3 === 0 ? 1.25 : 0.85);
      for (let y = -Math.ceil(rr); y <= Math.ceil(rr); y++) for (let x = -Math.ceil(rr); x <= Math.ceil(rr); x++) {
        if (Math.hypot(x, y) > rr + 0.3 || !info.inner(q.x + x, q.y + y)) continue;
        p.set(q.x + x, q.y + y, x + y < 0 ? rmp[2] : rmp[1]);
      }
      if (rr >= 1) o.fx.set(q.x - 1 + (rr < 1.3 ? 1 : 0), q.y - 1 + (rr < 1.3 ? 1 : 0), rmp[3]);
    });
  };
  // ---------------------------------------------------------------- drips したたり (lower contour / tears)
  PARTS.drips = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info, an = o.anchors, bb = info.bbox;
    const rmp = T.ramp(o.c || '#a060e0', 4, { dark: 0.5, light: 0.65 });
    const wide = k >= 1.5;
    /** a drop: a short neck and a round bulb with a glint */
    const bulb = (x, y) => {
      p.set(x, y, rmp[2]); p.set(x, y + 1, rmp[1]);
      if (wide) { p.set(x + 1, y, rmp[1]); p.set(x + 1, y + 1, rmp[0]); p.set(x, y + 2, rmp[1]); }
      o.fx.set(x, y, rmp[3]);
    };
    if (o.style === 'tears') {
      for (const e of an.eyes) {
        const L = Math.round(2 + 2 * k);
        const x = e[0] + (e[0] < an.body[0] ? -1 : 1) * (wide ? 1 : 0), y = e[1] + Math.round(1 + k * 0.5);
        for (let j = 0; j < L; j++) p.set(x, y + j, j % 2 ? rmp[2] : rmp[1]);
        bulb(x, y + L);
      }
      return;
    }
    // ooze sliding down the sides: runs hugging the outside of the silhouette, each with a fat drop
    for (const s2 of [-1, 1]) {
      const y0 = Math.round(bb.y0 + (bb.y1 - bb.y0) * (0.22 + o.rng() * 0.15));
      const L = Math.round((3 + o.rng() * 2) * k);
      let last = null;
      for (let y = y0; y < Math.min(bb.y1 - 2, y0 + L); y++) {
        const e = s2 < 0 ? info.left[y] : info.right[y];
        if (e < 0) break;
        const x = e + s2;
        if (x < 1 || x > p.w - 2) break;
        p.set(x, y, rmp[y === y0 ? 3 : 2]);
        last = [x, y];
      }
      if (last && !info.on(last[0], last[1] + 1)) bulb(last[0] + (wide ? (s2 < 0 ? -1 : 0) : 0), last[1] + 1);
    }
    // ooze running down over the body from the top edge, each run ending in a fat drop
    const up = T.contour(info, 'up').filter((q) => q.ny < -0.5 && q.y < bb.y0 + (bb.y1 - bb.y0) * 0.5);
    for (const q of spaced(up, Math.round(4 + 2 * k), wide ? 4 : 3, o.rng)) {
      const L = Math.round((2.5 + o.rng() * 3) * k);
      let j = 1;
      for (; j <= L; j++) {
        if (!info.on(q.x, q.y + j) || !info.inner(q.x, q.y + j + 1)) break;
        p.set(q.x, q.y + j, j === 1 ? rmp[3] : rmp[2]);
        if (wide && info.inner(q.x + 1, q.y + j) && j < L - 1) p.set(q.x + 1, q.y + j, rmp[1]);
      }
      if (j >= 2 && info.inner(q.x - 1, q.y + j) && info.inner(q.x + 1, q.y + j + 1)) {
        p.set(q.x, q.y + j, rmp[2]); p.set(q.x - 1, q.y + j, rmp[2]); p.set(q.x + 1, q.y + j, rmp[1]);
        p.set(q.x, q.y + j + 1, rmp[1]); if (wide) { p.set(q.x - 1, q.y + j + 1, rmp[1]); p.set(q.x + 1, q.y + j + 1, rmp[0]); }
        o.fx.set(q.x - 1, q.y + j, rmp[3]);
      }
    }
    // drops hanging off lower edges, where there is room under them
    const hang = T.contour(info, 'any').filter((q) => q.y > bb.y0 + (bb.y1 - bb.y0) * 0.3 && q.y < bb.y1 - 3 && q.ny > 0.3);
    for (const q of spaced(hang, Math.round(4 + 2 * k), wide ? 4 : 3, o.rng, (q2) => q2.ny + o.rng())) {
      const L = Math.round(1 + o.rng() * 1.6 * k);
      let free = true;
      for (let j = 1; j <= L + 3; j++) if (info.on(q.x, q.y + j)) { free = false; break; }
      if (!free) continue;
      for (let j = 1; j <= L; j++) p.set(q.x, q.y + j, rmp[1]);
      bulb(q.x, q.y + L + 1);
    }
    // a puddle spreading on the ground beside the feet, and a drop falling beside the body
    const gy = Math.min(p.h - 2, bb.y1);
    for (const s2 of [-1, 1]) {
      let x = s2 < 0 ? info.left[gy] : info.right[gy];
      if (x < 0) continue;
      const len = Math.round(2 + 1.5 * k);
      for (let i = 1; i <= len; i++) { const X = x + s2 * i; if (X < 1 || X > p.w - 2) break; p.set(X, gy, i === len ? rmp[1] : rmp[2]); if (i < len - 1 && wide) p.set(X, gy - 1, rmp[3]); }
    }
    const side = o.rng() < 0.5 ? -1 : 1;
    const fy0 = Math.round(bb.y0 + (bb.y1 - bb.y0) * 0.55);
    const edge = side < 0 ? info.left[fy0] : info.right[fy0];
    const fx0 = edge + side * Math.round(2 + k);
    if (edge >= 0 && fx0 > 1 && fx0 < p.w - 3 && !info.on(fx0, fy0) && !info.on(fx0, fy0 + 2)) { p.set(fx0, fy0 - 1, rmp[1]); bulb(fx0, fy0); }
  };

  // ---------------------------------------------------------------- skull_mark 髑髏の印 (body)
  const SKULL = {
    s: ['.###.', '#####', '#.#.#', '#####', '.#.#.'],
    m: ['..###..', '.#####.', '#######', '#..#..#', '#######', '.##.##.', '.#.#.#.'],
    l: ['...###...', '.#######.', '#########', '##..#..##', '##..#..##', '#########', '.###.###.', '..#.#.#..', '..#.#.#..'],
  };
  PARTS.skull_mark = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rows = SKULL[k < 1.3 ? 's' : k < 1.8 ? 'm' : 'l'];
    const rmp = T.ramp(o.c || '#f0e0ff', 3, { dark: 0.35, light: 0.4 });
    const x0 = a[0] - Math.floor(rows[0].length / 2), y0 = a[1] - Math.floor(rows.length / 2);
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; p.set(x0 + i, y0 + j, ch === '#' ? (j < 2 ? rmp[2] : i > row.length / 2 ? rmp[0] : rmp[1]) : null); } });
    // the holes stay as the body shows through, darkened
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '.' && j > 1 && j < rows.length - 1 && i > 0 && i < row.length - 1) { const c = o.base.get(x0 + i, y0 + j); if (c) p.set(x0 + i, y0 + j, T.dk(c, 0.4)); } });
  };
  // ---------------------------------------------------------------- stinger 大きな針 (tail)
  PARTS.stinger = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, info = o.info;
    const c = o.c || '#a040c0';
    const rmp = T.ramp(c, 5, { dark: 0.55, light: 0.7 });
    // point away from the body; curl toward the ground at the end
    let dx = a[0] - an.body[0], dy = a[1] - an.body[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    if (an.tailDir != null) { dx = Math.cos((an.tailDir * Math.PI) / 180); dy = Math.sin((an.tailDir * Math.PI) / 180); }
    const L = Math.round(4 + 3 * k), w = 1.4 + 0.8 * k;
    const m = T.mask(p.w, p.h);
    // venom bulb over the tail tip
    m.ellipse(a[0], a[1], w * 1.25, w * 1.15, 1);
    // the hooked needle: out along the tail, then bending down (or toward the target)
    const bend = dy < -0.5 ? [dx * 0.3 + (dx >= 0 ? -0.9 : 0.9), 0.4] : [dx, dy + 0.9];
    const mid = [a[0] + dx * L * 0.55, a[1] + dy * L * 0.55];
    const tip = [mid[0] + bend[0] * L * 0.55, mid[1] + bend[1] * L * 0.55];
    T.tube(m, [[a[0], a[1]], mid, tip], w * 0.85, 0.35, 1, 14);
    p.blit(T.shade(m, rmp, { depth: 1.6, bias: 0.05 }), 0, 0);
    // venom sheen, the glinting point and a glow around it
    o.fx.set(Math.round(a[0] - w * 0.5), Math.round(a[1] - w * 0.5), rmp[4]);
    o.fx.set(Math.round(tip[0]), Math.round(tip[1]), '#ffffff');
    const glow = T.mix(c, '#ffffff', 0.35);
    for (const [gx, gy] of [[tip[0] + 1, tip[1]], [tip[0] - 1, tip[1]], [tip[0], tip[1] + 1], [a[0] - w * 1.8, a[1] - w * 0.6], [a[0] + w * 1.8, a[1] + w * 0.4]]) {
      const X = Math.round(gx), Y = Math.round(gy);
      if (m.get(X, Y) == null && !info.on(X, Y)) o.fx.set(X, Y, (X + Y) % 2 ? glow : rmp[3]);
    }
    const drop = [Math.round(tip[0]), Math.round(tip[1]) + 2];
    if (!info.on(drop[0], drop[1])) { o.fx.set(drop[0], drop[1], rmp[3]); o.fx.set(drop[0], drop[1] + 1, rmp[2]); }
  };
  // ---------------------------------------------------------------- rattle 鈴の尾 (tail)
  PARTS.rattle = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, info = o.info;
    const rmp = T.ramp(o.c || '#e0c080', 4, { dark: 0.5, light: 0.55 });
    // grow away from the body along the tail: find the free direction at the tip
    let best = [0, -1], bestFree = -1;
    for (let t = 0; t < 16; t++) {
      const ang = (t / 16) * Math.PI * 2, d = [Math.cos(ang), Math.sin(ang)];
      let free = 0;
      for (let r = 1; r <= 6 * k; r++) if (!info.on(Math.round(a[0] + d[0] * r), Math.round(a[1] + d[1] * r))) free++;
      const pref = free - (d[1] > 0.3 ? 3 : 0) - Math.hypot(a[0] + d[0] * 4 - an.body[0], a[1] + d[1] * 4 - an.body[1]) * -0.02;
      if (pref > bestFree) { bestFree = pref; best = d; }
    }
    const n = k < 1.3 ? 3 : 4, seg = 1.5 + 0.8 * k;
    for (let i = 0; i < n; i++) {
      const cx = a[0] + best[0] * (i * seg + 0.5), cy = a[1] + best[1] * (i * seg + 0.5);
      const r = (1.3 + 0.5 * k) * (1 - i * 0.12);
      const m = T.mask(p.w, p.h);
      m.ellipse(cx, cy, r, r, 1);
      p.blit(T.shade(m, rmp, { depth: 1.2 }), 0, 0);
      // ring grooves between segments
      p.set(Math.round(cx + best[0] * r * 0.9), Math.round(cy + best[1] * r * 0.9), rmp[0]);
    }
  };
  // ---------------------------------------------------------------- teeth_iron 鉄の歯 (mouth)
  PARTS.teeth_iron = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rmp = T.metal(o.c || '#c8ccd8', 4);
    // two (s) to four (l) square-cut metal teeth with a dark gap, lit on the left, dark at the tips
    const tw = k < 1.8 ? 2 : 3, th = k < 1.3 ? 3 : k < 1.8 ? 3 : 4, n = k < 1.3 ? 2 : k < 1.8 ? 3 : 4;
    const total = n * tw + (n - 1);
    const x0 = a[0] - Math.floor(total / 2);
    for (let i = 0; i < n; i++) {
      const tx = x0 + i * (tw + 1);
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) p.set(tx + x, a[1] + y, y === th - 1 ? rmp[1] : x === 0 ? rmp[3] : rmp[2]);
      if (i < n - 1) for (let y = 0; y < th - 1; y++) p.set(tx + tw, a[1] + y, '#302830');
      o.fx.set(tx, a[1], '#ffffff');
    }
    // the rivets of the metal cap along the gum line
    for (let i = 0; i < n; i++) p.set(x0 + i * (tw + 1) + (tw >> 1), a[1] - 1, rmp[1]);
  };
  // ---------------------------------------------------------------- tusks 牙 (mouth)
  PARTS.tusks = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, hw = (an.headW || 12), info = o.info;
    const iron = o.style === 'iron';
    const ivory = T.ramp('#f0e8d8', 4, { dark: 0.4, light: 0.5 }), ir = T.metal(o.c || '#b8c0d0', 4);
    if (an.tuskTips) {
      // the base has its own tusks: shoe their ends with iron (or add ivory points)
      for (const tip of an.tuskTips) {
        const r = 1.5 + 1.1 * k;
        for (let y = Math.floor(tip[1] - r - 1); y <= Math.ceil(tip[1] + r + 1); y++) for (let x = Math.floor(tip[0] - r - 1); x <= Math.ceil(tip[0] + r + 1); x++) {
          if (!info.on(x, y) || info.isOut(x, y)) continue;
          const d = Math.hypot(x - tip[0], y - tip[1]);
          if (d > r + 1) continue;
          const c = o.base.get(x, y);
          if (!c || T.lum(c) < 0.55) continue; // only the light tusk pixels, not the fur behind them
          p.set(x, y, d > r ? ir[1] : iron ? ir[(x + y) % 3 === 0 ? 3 : 2] : ivory[3]);
        }
        // a sharpened point and a band of rivets
        o.fx.set(tip[0], tip[1] - 1, '#ffffff');
      }
      return;
    }
    const roots = an.tusks || [[a[0] - Math.round(hw * 0.3), a[1]], [a[0] + Math.round(hw * 0.3), a[1]]];
    for (const r of roots) {
      const s2 = r[0] < a[0] ? -1 : 1;
      const L = Math.round(3 + 2.5 * k);
      const m = T.mask(p.w, p.h);
      const tip = [r[0] + s2 * L * 0.55, r[1] - L * 0.8];
      T.tube(m, [[r[0], r[1] + 1], [r[0] + s2 * L * 0.55, r[1] + 0.5], tip], 0.8 + 0.35 * k, 0.4, 1, 12);
      p.blit(T.shade(m, ivory, { depth: 1.2 }), 0, 0);
      if (iron) {
        // an iron cap on the outer half with a band
        m.each((x, y) => { if (y < r[1] - L * 0.25) p.set(x, y, ir[x * s2 > tip[0] * s2 - 1 ? 1 : 2]); return undefined; });
        m.each((x, y) => { if (Math.abs(y - (r[1] - Math.round(L * 0.25))) < 0.6) p.set(x, y, ir[3]); return undefined; });
        o.fx.set(Math.round(tip[0]), Math.round(tip[1]), '#ffffff');
      }
    }
  };
  // ---------------------------------------------------------------- claws かぎ爪 (hand + hand2)
  PARTS.claws = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    const rmp = T.metal(o.c || '#b0b8c8', 4);
    // bases with big hands say where the claws go (anchors.clawAt / clawDir); others: down and out
    const hands = an.clawAt || [an.hand, an.hand2];
    for (const h of hands) {
      const s2 = h[0] < an.body[0] ? -1 : 1;
      const base = an.clawDir != null ? (an.clawDir * Math.PI) / 180 : Math.PI / 2 + s2 * 0.5;
      const L = Math.round(3 + 1.8 * k), n = k < 1.3 ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : i / (n - 1) - 0.5;
        const ang = base + u * 0.9;
        const x0 = h[0] + Math.round(u * 2 * k * Math.abs(Math.sin(base))), y0 = h[1] + Math.round(u * 2 * k * Math.abs(Math.cos(base)));
        const m = T.mask(p.w, p.h);
        const tip = [x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L];
        // a curved blade: straight out, the point hooking a little
        T.tube(m, [[x0, y0], [x0 + Math.cos(ang) * L * 0.6, y0 + Math.sin(ang) * L * 0.6], [tip[0] + Math.cos(ang + s2 * 0.6), tip[1] + Math.sin(ang + s2 * 0.6)]], 0.55 + 0.3 * k, 0.3, 1, 8);
        p.blit(T.shade(m, rmp, { depth: 1 }), 0, 0);
        o.fx.set(Math.round(x0 + Math.cos(ang) * L * 0.45), Math.round(y0 + Math.sin(ang) * L * 0.45), rmp[3]);
      }
    }
  };
  // ---------------------------------------------------------------- pins まち針 (body)
  PARTS.pins = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info;
    const steel = T.metal(o.c || '#d0d0d0', 3);
    const heads = ['#e03040', '#f0c030', '#4070e0', '#40b060', '#e060c0'];
    const reg = bodyRegion(o, a, 0.4, 0.34, 1);
    const pick = spaced(reg.pts.map(([x, y]) => ({ x, y })), 3 + 1.5 * k, 5, o.rng);
    pick.forEach((q, i) => {
      const ang = -Math.PI / 2 + (i - 2) * 0.55 + (o.rng() - 0.5) * 0.3;
      const L = Math.round(2.5 + 1.5 * k);
      // the shaft sticks out of the body, the round head on its end
      const hx = Math.round(q.x + Math.cos(ang) * L), hy = Math.round(q.y + Math.sin(ang) * L);
      T.line(p, q.x, q.y, hx, hy, (x, y) => (x === q.x && y === q.y ? steel[0] : steel[(x + y) % 2 ? 2 : 1]));
      const hc = T.ramp(heads[i % heads.length], 3);
      p.set(hx, hy, hc[1]);
      if (k >= 1.5) { p.set(hx + 1, hy, hc[0]); p.set(hx, hy - 1, hc[2]); p.set(hx + 1, hy - 1, hc[1]); }
      o.fx.set(hx, hy - (k >= 1.5 ? 1 : 0), '#ffffff');
      void info;
    });
  };
  // ---------------------------------------------------------------- bell 鐘 (neck)
  PARTS.bell = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info;
    const rmp = T.metal(o.c || '#c89040', 5);
    // collar strap across the neck
    let l = a[0], r = a[0];
    while (info.on(l - 1, a[1]) && a[0] - l < 8 * k) l--;
    while (info.on(r + 1, a[1]) && r - a[0] < 8 * k) r++;
    for (let x = l; x <= r; x++) { p.set(x, a[1], '#6a2820'); if (k >= 1.5) p.set(x, a[1] + 1, '#4a1810'); }
    // the bell
    const w = 1.5 + 1.2 * k, h = 2 + 1.5 * k;
    const top = a[1] + (k >= 1.5 ? 2 : 1);
    const m = T.mask(p.w, p.h);
    m.poly([[a[0] - w * 0.55, top], [a[0] + w * 0.55 + 1, top], [a[0] + w + 1, top + h], [a[0] - w, top + h]], 1);
    m.ellipse(a[0] + 0.5, top, w * 0.55, Math.max(0.8, w * 0.35), 1);
    for (let x = Math.round(a[0] - w - 0.5); x <= Math.round(a[0] + w + 1); x++) m.set(x, Math.round(top + h), 1);
    const b = T.bboxOf(m);
    m.each((x, y) => { const t = (x - b.x0) / Math.max(1, b.x1 - b.x0); p.set(x, y, rmp[T.clamp(T.cyl(t, 5) + (y === b.y1 ? -1 : 0), 0, 4)]); return undefined; });
    // clapper and the loop
    p.set(Math.round(a[0]), b.y1 + 1, '#302018'); if (k >= 1.5) p.set(Math.round(a[0]) + 1, b.y1 + 1, '#302018');
    p.set(Math.round(a[0]), top - 1, rmp[3]);
    o.fx.set(b.x0 + 1, b.y0 + 1, '#fff8e0');
  };
})(window.RPG);
