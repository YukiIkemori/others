// BSCENE: 画像の効果の部品（assets/fx/<id>.webp ＋ .json。tools/vfx/gen_vfx.py で描いて切り出した帯）。
// 部品は「コマを横に並べた帯」。白黒の部品（meta.tint）は技・術の 3 色に塗り分けて使う（明るさ → 深い色・主の色・明るい色・白）。
// 演出の表（fx_seq_table.js）の層は手続きの部品（prims）のまま。ここで「手続きの部品 → 画像の部品」の決まり（RULES）で
// 画像の層を足し、手続きの層は薄くして重ねる（閃光・揺れ・粒・暗さはそのまま）。画像が無い・まだ読めていない時は手続きだけ（今までと同じ見た目）。
// 古い効果（R.BFX.defs の slash・hit・fire …。ふつうの攻撃・敵の攻撃・回復・状態）も、画像があれば画像で描く（LEGACY）。
//   R.BFX.img.has(id) / load(id) / ready(id) / preload(ids)
//   R.BFX.img.drawFrame(g, id, fi, o)   原点に基準の点。o = {s, rot, flat, my, mx, a, pal}
//   R.BFX.img.set(on)                   false で画像を使わない（比べる用。dev の見本・書き出し）
(function (R) {
  'use strict';
  const BFX = (R.BFX = R.BFX || {});
  const S = BFX.seq;
  const I = (BFX.img = BFX.img || {});
  const E = S.E;
  const hasDoc = typeof document !== 'undefined';
  I.on = true;

  // ---------------------------------------------------------------- 読み込み
  I.meta = function (id) {
    const e = R.Media && R.Media.entry ? R.Media.entry('fx', id) : null;
    return (e && e.meta) || null;
  };
  I.has = (id) => !!I.meta(id);
  const recs = {};
  /** 読み始める → {ok, img}（ok = 読めて解けた） */
  I.load = function (id) {
    if (recs[id]) return recs[id];
    if (!hasDoc || !R.Media || !R.Media.image || !I.meta(id)) return null;
    const r = R.Media.image(id, 'fx');
    if (!r) return null;
    const rec = (recs[id] = { ok: false, img: null, promise: null });
    // 画素は decode() で裏の糸で解いてから使う（初めて描くコマで主の糸が止まらない）
    rec.promise = r.promise.then((x) => {
      if (!x || !x.ready) return rec;
      const img = x.img;
      const done = () => { rec.img = img; rec.ok = true; return rec; };
      return img && img.decode ? img.decode().then(done, done) : done();
    }, () => rec);
    return rec;
  };
  I.ready = (id) => { const r = I.load(id); return !!(r && r.ok); };
  I.preload = (ids) => Promise.all(ids.map(I.load).filter(Boolean).map((r) => r.promise));
  I.set = function (on) { I.on = !!on; S.cache = {}; };

  // ---------------------------------------------------------------- 塗り分け（白黒の部品 → 3 色）
  const tints = new Map();
  let tintPx = 0;
  const TINT_MAX = 24e6;   // 塗った帯の画素の上限（約 96 MB）。超えたら古い物から捨てる
  const num = (s) => String(s).split(',').map(Number);
  function lut(pal) {
    // 明るさ 0..1 → 深い色（暗い所）→ 主の色 → 明るい色 → 白（芯）
    const deep = num(pal[2]), main = num(pal[0]), light = num(pal[1]);
    const stops = [[0, deep.map((v) => v * 0.55)], [0.32, deep], [0.6, main], [0.84, light], [1, [255, 255, 255]]];
    const t = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const L = i / 255;
      let j = 0;
      while (j < stops.length - 2 && L > stops[j + 1][0]) j++;
      const [l0, c0] = stops[j], [l1, c1] = stops[j + 1];
      const k = Math.max(0, Math.min(1, (L - l0) / Math.max(1e-6, l1 - l0)));
      for (let ch = 0; ch < 3; ch++) t[i * 3 + ch] = c0[ch] + (c1[ch] - c0[ch]) * k;
    }
    return t;
  }
  /** 塗った帯（canvas）。pal = [主, 明るい, 深い]（'r,g,b'） */
  I.tinted = function (id, pal) {
    const r = I.load(id);
    if (!r || !r.ok) return null;
    const key = id + '|' + pal.join('|');
    let c = tints.get(key);
    if (c) { tints.delete(key); tints.set(key, c); return c; }
    const img = r.img, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    try {
      const d = x.getImageData(0, 0, w, h), p = d.data, t = lut(pal);
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const L = (p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8;
        p[i] = t[L * 3]; p[i + 1] = t[L * 3 + 1]; p[i + 2] = t[L * 3 + 2];
      }
      x.putImageData(d, 0, 0);
    } catch (e) {
      // 画素が読めない（file: など）: 主の色を掛けて、α を戻す
      x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${pal[0]})`; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
    }
    tints.set(key, c);
    tintPx += w * h;
    while (tintPx > TINT_MAX && tints.size > 1) {
      const k0 = tints.keys().next().value, c0 = tints.get(k0);
      tintPx -= c0.width * c0.height; tints.delete(k0);
    }
    return c;
  };
  I.stats = () => ({ loaded: Object.values(recs).filter((r) => r.ok).length, requested: Object.keys(recs).length, tints: tints.size, tintMPx: +(tintPx / 1e6).toFixed(1) });

  /** 1 コマ（fi は 0..n-1。原点に基準の点）→ 描けたら true */
  I.drawFrame = function (g, id, fi, o) {
    const m = I.meta(id), r = I.load(id);
    if (!m || !r || !r.ok) return false;
    o = o || {};
    const src = o.pal ? I.tinted(id, o.pal) : r.img;
    if (!src) return false;
    const i = Math.max(0, Math.min(m.n - 1, fi | 0));
    const sc = (m.scale || 0.5) * (o.s || 1);
    if (!(sc > 0.001)) return true;
    g.save();
    if (o.rot) g.rotate(o.rot);
    if (o.flat && o.flat !== 1) g.scale(1, o.flat);
    if (o.my) g.scale(1, -1);
    if (o.mx) g.scale(-1, 1);
    if (o.a != null) g.globalAlpha *= o.a > 1 ? 1 : o.a;
    g.drawImage(src, i * m.w, 0, m.w, m.h, -m.anchor[0] * sc, -m.anchor[1] * sc, m.w * sc, m.h * sc);
    g.restore();
    return true;
  };

  // ---------------------------------------------------------------- 色
  const RGB = /^\d{1,3},\d{1,3},\d{1,3}$/;
  const mixc = (a, b, k) => { const x = num(a), y = num(b); return x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(','); };
  /** 層の色 → 塗り分けの 3 色。v = 名前（S.PAL）・'r,g,b'・番号（技・術の色の何番目）・無し（技・術の色） */
  function palOf(c, v) {
    const P = c.pal || S.PAL.sword;
    if (v == null) return P;
    if (typeof v === 'number') { const m = P[v] || P[0]; return [m, mixc(m, '255,255,255', 0.6), mixc(m, '0,0,0', 0.45)]; }
    if (S.PAL[v]) return S.PAL[v];
    if (RGB.test(v)) return [v, mixc(v, '255,255,255', 0.6), mixc(v, '0,0,0', 0.45)];
    return P;
  }
  I.palOf = palOf;
  // 色の部品（炎・氷…）を、その色のままで使える技・術の色の系統
  const NATIVE = {
    fire: /^(fire|greatsword|gold|blood)$/, ice: /^(ice|water)$/, thunder: /^(thunder|gold|light)$/, heal: /^(heal|wind|water)$/,
    water: /^(water|ice)$/, earth: /^(earth|greatsword)$/, dark: /^(dark|poison)$/, wind: /^(wind|heal)$/, light: /^(light|gold)$/,
  };
  function palName(p) {
    for (const k of Object.keys(S.PAL)) if (S.PAL[k][0] === p[0]) return k;
    return '';
  }

  // ---------------------------------------------------------------- 画像の層（prim 'img'）
  // L.id 部品、L.k 大きさ（論理 px の倍率）、L.rot 回り、L.spin 回る速さ（rad/s）、L.flat 平たさ、L.my 上下の反転、L.a 濃さ
  // L.u0 / L.u1 この層の中でコマを流す区間、L.fps（ループの部品）、L.fly（使い手から飛んでくる割合）、L.arc（飛ぶ弧の高さ）
  // L.grow [始まり, 終わり] 大きさの変化、L.foot 的の足もとへ下ろす、L.tint 塗り分けの色（無ければ部品の決まり）、L.dy2 置いた後のずらし
  S.prim('img', (g, u, L, c, e) => {
    if (!I.on) return;
    const m = I.meta(L.id);
    if (!m) return;
    const u0 = L.u0 || 0, u1 = L.u1 == null ? 1 : L.u1;
    if (u < u0) return;
    const k = E.win(u, u0, u1);
    if (!m.loop && k >= 1) return;
    const fi = m.loop ? (e.ms * (L.fps || m.fps) / 1000) % m.n : Math.min(m.n - 1, k * m.n);
    let a = L.a == null ? 1 : L.a;
    if (m.loop || L.env) a *= E.env(u, L.fi == null ? 0.12 : L.fi, L.fo == null ? 0.25 : L.fo);
    if (a <= 0.004) return;
    let x = 0, y = 0, rot = L.rot || 0;
    if (L.foot) y += ((c.tc.fy - c.tc.y) || 0) / (L.s || 1);
    if (L.dy2) y += L.dy2;
    if (L.fly) {
      const kk = E.win(u, 0, L.fly);
      if (kk >= 1) return;
      const ke = E.inOut(kk) * 0.4 + kk * 0.6;
      x = e.sx * (1 - ke); y = e.sy * (1 - ke) - Math.sin(ke * Math.PI) * (L.arc || 0);
      const dx = -e.sx, dy = -e.sy - Math.cos(ke * Math.PI) * Math.PI * (L.arc || 0);
      rot += Math.atan2(dy, dx);
    }
    if (L.spin) rot += (e.ms / 1000) * L.spin;
    const s = (L.k || 1) * (L.grow ? E.lerp(L.grow[0], L.grow[1], E.out(u)) : 1);
    let pal = null;
    if (m.tint) pal = palOf(c, L.tint);
    else if (L.tint != null) pal = palOf(c, L.tint);
    if (x || y) g.translate(x, y);
    I.drawFrame(g, L.id, fi, { s, rot, flat: L.flat, my: L.my, mx: L.mx, a, pal });
  });
  // 画像の部品と重ねた手続きの層: 画像が読めていれば薄く（L.dimTo）、読めていなければそのまま
  S.prim('imgdim', (g, u, L, c, e) => {
    const fn = S.prims[L.p0];
    if (!fn) return;
    if (I.on && I.ready(L.img)) {
      if (L.dimTo <= 0) return;
      g.globalAlpha *= L.dimTo;
    }
    fn(g, u, L, c, e);
  });

  // ---------------------------------------------------------------- 決まり: 手続きの部品 → 画像の層
  // 各決まり (L, spec, part) → {add: [画像の層の値], dim: 手続きの層の濃さ（1 = そのまま）} | null
  // 弧の画像（slash_arc_*）: 右下へ振り下ろす三日月。ふくらみは左下（角 +2.36）。振りの向きが逆（sw > 0）なら上下を返す
  const ARC_BULGE = 2.36;
  const has = (id) => I.on && I.has(id);
  const pick = (...ids) => ids.find(has) || null;
  const elemOf = (spec) => palName(spec.pal) || '';
  function nativeOr(part, spec, L) {
    // 色の部品: 技・術の色が同じ系統ならそのまま、違えば塗り分ける
    const el = L.col && typeof L.col === 'string' && S.PAL[L.col] ? L.col : elemOf(spec);
    const re = NATIVE[part];
    if (L.col && typeof L.col === 'string' && RGB.test(L.col)) return L.col;
    return re && re.test(el) ? null : (L.col != null ? L.col : 0);
  }
  const RULES = {
    arc(L) {
      if ((L.n || 1) > 1 && L.gap === 0) return null;   // 風車（回り続ける弧）は手続きのまま
      const heavy = (L.w || 6) >= 10;
      const id = heavy ? pick('slash_heavy', 'slash_arc_a') : pick('slash_arc_a');
      if (!id) return null;
      const sw = L.sw == null ? 2 : L.sw, mid = (L.a0 || 0) + sw / 2;
      const my = sw > 0 ? 1 : 0, base = my ? -ARC_BULGE : ARC_BULGE;
      const out = [];
      const n = L.n || 1, gap = L.gap != null ? L.gap : 0.18;
      for (let j = 0; j < n; j++) {
        const rot = mid - base + (L.rot || 0) * j;
        out.push({ id, k: (L.r || 32) / 52 * (heavy ? 1.1 : 1), rot, my, flat: L.flat, u0: j * gap, u1: Math.min(1, j * gap + 0.85), tint: L.col });
      }
      return { add: out, dim: 0.3 };
    },
    cut(L) {
      const id = pick('slash_line');
      if (!id) return null;
      const out = [], n = L.n || 1;
      for (let j = 0; j < n; j++) out.push({ id, k: (L.len || 80) / 120, rot: (L.ang || 0) + (L.step || 0) * j, u0: j * (L.gap || 0.12), u1: Math.min(1, j * (L.gap || 0.12) + 0.8), tint: L.col });
      return { add: out, dim: 0.4 };
    },
    thrust(L) {
      const id = pick('thrust_streak');
      if (!id) return null;
      return { add: [{ id, k: (L.len || 80) / 100, rot: Math.PI + (L.ang || 0), tint: L.col }], dim: 0.4 };
    },
    sparks(L, spec, part) {
      if (L.star && (L.size || 0) >= 16) { const id = pick('impact_flash', 'hit_spark_a'); return id ? { add: [{ id, k: (L.size || 20) / 30, tint: L.col }], dim: 0.4 } : null; }
      if (part !== 'hit' || (L.n || 8) < 3) return null;
      const id = pick('hit_spark_a');
      if (!id) return null;
      return { add: [{ id, k: Math.min(1.3, 0.55 + (L.v || 26) / 70), tint: L.col != null ? L.col : 1, rot: (L.ang || 0) }], dim: 0.6 };
    },
    flames(L, spec, part) {
      const id = part === 'hit' ? pick('fire_burst') : pick('flame_pillar', 'fire_burst');
      if (!id) return null;
      const w = L.w || 40, h = L.h || 60;
      const k = id === 'fire_burst' ? Math.max(0.45, Math.min(1.6, Math.max(w, h) / 70)) : Math.max(0.5, Math.min(2.2, h / 90));
      return { add: [{ id, k, tint: nativeOr('fire', spec, L), dy2: id === 'fire_burst' ? -h * 0.35 : 0, env: id !== 'fire_burst' }], dim: 0.45 };
    },
    shards(L, spec) {
      const id = pick('ice_shards');
      if (!id) return null;
      return { add: [{ id, k: Math.max(0.5, Math.min(1.5, (L.r || 30) / 34)), tint: nativeOr('ice', spec, L) }], dim: 0.45 };
    },
    bolt(L, spec) {
      const id = pick('lightning_bolt');
      if (!id || L.from === 'src') return null;
      const n = Math.min(3, L.n || 1), out = [];
      for (let j = 0; j < n; j++) out.push({ id, k: 1.15, foot: 1, u0: j * 0.15, u1: Math.min(1, j * 0.15 + 0.8), tint: nativeOr('thunder', spec, L), mx: j % 2 });
      return { add: out, dim: 0.35 };
    },
    motes(L, spec) {
      const el = elemOf(spec);
      if (!/^(heal|water|wind|light|gold)$/.test(el) && !spec.ally) return null;
      const id = pick('heal_sparkles');
      if (!id) return null;
      return { add: [{ id, k: Math.max(0.6, Math.min(1.4, (L.h || 60) / 60)), foot: 1, tint: el === 'heal' ? null : nativeOr('heal', spec, L) }], dim: 0.6 };
    },
  };
  I.RULES = RULES;
  /** 組み立てた形に画像の層を足す（初めて使う時に 1 回。S.get の後） */
  function augment(spec) {
    spec.imgParts = [];
    if (!I.on || !hasDoc || !R.Media || !R.Media.table) return spec;
    for (const part of ['main', 'hit']) {
      const src = spec[part], out = [];
      for (const L of src) {
        const rule = RULES[L.p];
        const r = rule ? rule(L, spec, part) : null;
        if (!r || !r.add || !r.add.length) { out.push(L); continue; }
        // 手続きの層を下に（薄く）、画像の層を上に
        out.push(Object.assign({}, L, { p: 'imgdim', p0: L.p, img: r.add[0].id, dimTo: r.dim == null ? 0.4 : r.dim }));
        for (const A of r.add) {
          const nl = Object.assign({ p: 'img', t0: L.t0, t1: L.t1, at: L.at, s: L.s, dx: L.dx, dy: L.dy, nf: L.nf }, A);
          if (A.blend) nl.blend = A.blend; else { const m = I.meta(A.id); nl.blend = (m && m.blend) || 'lighter'; }
          out.push(nl);
          if (!spec.imgParts.includes(A.id)) spec.imgParts.push(A.id);
        }
      }
      spec[part] = out;
    }
    // 読み始め、読めたら技・術の色に塗っておく（当たる瞬間に塗らない）
    for (const id of spec.imgParts) {
      const r = I.load(id);
      if (!r) continue;
      r.promise.then(() => {
        const m = I.meta(id);
        if (!m || !r.ok) return;
        const pals = new Set();
        for (const L of spec.main.concat(spec.hit)) if (L.p === 'img' && L.id === id && (m.tint || L.tint != null)) pals.add(JSON.stringify(palOf({ pal: spec.pal }, L.tint)));
        for (const p of pals) I.tinted(id, JSON.parse(p));
      });
    }
    return spec;
  }
  I.augment = augment;
  const get0 = S.get;
  S.get = function (sid) {
    const sp = get0(sid);
    if (sp && !sp.imgParts) augment(sp);
    return sp;
  };

  // ---------------------------------------------------------------- 古い効果（R.BFX.defs）の画像
  // id → [{id: 部品, k, t0（ms の遅れ）, pal, foot（体の中ほど → 足もと）, rot}]
  const W = (p) => S.PAL[p];
  I.LEGACY = {
    slash: [{ id: 'slash_arc_a', k: 0.62, rot: -1.4 + ARC_BULGE, my: 1, pal: W('sword') }],
    hit: [{ id: 'hit_spark_a', k: 0.62, pal: ['255,215,150', '255,250,230', '220,120,60'] }],
    crit: [{ id: 'impact_flash', k: 0.9, pal: W('gold') }, { id: 'hit_spark_a', k: 1.1, pal: W('gold') }],
    fire: [{ id: 'fire_burst', k: 0.62 }],
    ice: [{ id: 'ice_shards', k: 0.6 }],
    thunder: [{ id: 'lightning_bolt', k: 0.9, foot: 40 }],
    heal: [{ id: 'heal_sparkles', k: 0.75, foot: 40 }],
    mp: [{ id: 'heal_sparkles', k: 0.75, foot: 40, pal: ['110,170,255', '225,240,255', '60,80,220'] }],
  };
  const draw0 = BFX.draw;
  BFX.draw = function (g, id, x, y, t, o) {
    const list = I.on && I.LEGACY[id];
    if (!list || !list.every((P) => !I.has(P.id) || I.ready(P.id)) || !list.some((P) => I.ready(P.id))) return draw0(g, id, x, y, t, o);
    o = o || {};
    let alive = false;
    for (const P of list) {
      const m = I.meta(P.id);
      if (!m || !I.ready(P.id)) continue;
      const tt = Math.max(0, t) - (P.t0 || 0);
      if (tt < 0) { alive = true; continue; }
      const fi = Math.floor(tt / 1000 * m.fps);
      if (fi >= m.n) continue;
      alive = true;
      g.save();
      g.globalCompositeOperation = m.blend || 'lighter';
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      g.translate(x, y + (P.foot || 0));
      if (o.flip) g.scale(-1, 1);
      I.drawFrame(g, P.id, fi, { s: (P.k || 1) * (o.scale || 1), rot: P.rot, my: P.my, pal: m.tint ? (P.pal || W('sword')) : P.pal || null });
      g.restore();
    }
    return alive;
  };

  // 起動の後、よく使う部品を先に読む（当たりの火花・剣の弧など。ほかは使う時に読む）
  I.COMMON = ['hit_spark_a', 'slash_arc_a', 'impact_flash', 'fire_burst', 'ice_shards', 'lightning_bolt', 'heal_sparkles', 'magic_circle'];
  if (R.onBoot) R.onBoot(function () { setTimeout(() => { try { I.preload(I.COMMON.filter(I.has)); } catch (e) { /* ignore */ } }, 1500); });
})(window.RPG);
