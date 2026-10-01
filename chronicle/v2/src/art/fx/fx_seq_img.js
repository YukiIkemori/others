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
  // 塗っておく列: 1 回に 1 本ずつ、手の空いた時に（行動の始まりの 1 コマに塗りを固めない）
  const warmQ = [];
  let warming = false;
  function pump() {
    const job = warmQ.shift();
    if (!job) { warming = false; return; }
    try { I.tinted(job[0], job[1]); } catch (e) { /* ignore */ }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(pump, { timeout: 60 }); else setTimeout(pump, 16);
  }
  I.warm = function (id, pal) {
    if (tints.has(id + '|' + pal.join('|'))) return;
    warmQ.push([id, pal]);
    if (!warming) { warming = true; setTimeout(pump, 0); }
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
    // 中身の外形（meta.bb）だけを描く（空の所を合成しない。ソフトの描画では大きく効く）
    const b = m.bb && m.bb[i];
    if (b) { if (b[2] > 0) g.drawImage(src, i * m.w + b[0], b[1], b[2], b[3], (b[0] - m.anchor[0]) * sc, (b[1] - m.anchor[1]) * sc, b[2] * sc, b[3] * sc); }
    else g.drawImage(src, i * m.w, 0, m.w, m.h, -m.anchor[0] * sc, -m.anchor[1] * sc, m.w * sc, m.h * sc);
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
  // 大きさ（どれか 1 つ。無ければ L.k 倍）: L.th 的の背の何倍の高さ、L.px 論理 px の高さ、L.pxw 論理 px の幅、L.sky 空から足もとまでの高さ
  // L.rot 回り、L.spin 回る速さ（rad/s）、L.flat 平たさ、L.my / L.mx 反転、L.a 濃さ、L.env 出入りを柔らかく
  // L.u0 / L.u1 この層の中でコマを流す区間、L.seg [[u, コマ], …] 時間 → コマ（無ければ「山（一番濃いコマ）を保つ」既定）
  // L.fps（ループの部品）、L.fly（使い手から飛んでくる割合）、L.arc（飛ぶ弧の高さ）、L.grow [始まり, 終わり] 大きさの変化
  // L.foot 的の足もとへ下ろす、L.tint 塗り分けの色（無ければ部品の決まり）、L.dy2 / L.dx2 置いた後のずらし、L.rise 上へ流れる px、L.hq 品質「低」では描かない飾り
  function frameAt(m, k, L) {
    const n = m.n;
    if (n <= 1) return 0;
    const seg = L.seg || (n > 2 ? DEFSEG(m) : null);
    if (!seg) return Math.min(n - 1, k * n);
    for (let i = 1; i < seg.length; i++) {
      if (k <= seg[i][0]) {
        const [k0, f0] = seg[i - 1], [k1, f1] = seg[i];
        return Math.min(n - 1, f0 + (f1 - f0) * (k - k0) / Math.max(1e-6, k1 - k0));
      }
    }
    return n - 1;
  }
  // 既定の時間 → コマ: 山まで速く（2 割）、山を保ち（5 割まで）、残りで消えていく
  const segs = {};
  function DEFSEG(m) {
    const key = m.n + ':' + m.peak;
    if (segs[key]) return segs[key];
    const p = Math.min(m.n - 1, m.peak != null ? m.peak : Math.floor(m.n * 0.4));
    return (segs[key] = [[0, 0], [0.2, p], [0.48, p + 0.95], [1, m.n]]);
  }
  function targetH(L, c, e) {
    if (L.at === 'src' || L.at === 'srcfoot') return (c.src && c.src.h) || 60;
    const t = (L.at === 'each' || L.at === 'eachfoot') && c.tgts[e.i] ? c.tgts[e.i] : null;
    if (t) return t.h || 60;
    let h = 0;
    for (const x of c.tgts) h += x.h || 60;
    return h / Math.max(1, c.tgts.length);
  }
  S.prim('img', (g, u, L, c, e) => {
    if (!I.on) return;
    if (L.hq && c.q < 1) return;   // 飾りの層（残像・余韻のきらめき）は品質「低」で描かない
    const m = I.meta(L.id);
    if (!m) return;
    const u0 = L.u0 || 0, u1 = L.u1 == null ? 1 : L.u1;
    if (u < u0) return;
    const k = E.win(u, u0, u1);
    if (!m.loop && k >= 1) return;
    const fi = m.loop ? (e.ms * (L.fps || m.fps) / 1000) % m.n : frameAt(m, k, L);
    let a = L.a == null ? 1 : L.a;
    if (m.loop || L.env) a *= E.env(u, L.fi == null ? 0.12 : L.fi, L.fo == null ? 0.25 : L.fo);
    if (a <= 0.004) return;
    let x = 0, y = 0, rot = L.rot || 0;
    const ls = L.s || 1;
    if (L.foot) y += ((c.tc.fy - c.tc.y) || 0) / ls;
    if (L.dy2) y += L.dy2;
    if (L.dx2) x += L.dx2;
    if (L.rise) y -= L.rise * E.out(u);
    if (L.fly) {
      const kk = E.win(u, 0, L.fly);
      if (kk >= 1) return;
      const ke = E.inOut(kk) * 0.4 + kk * 0.6;
      x = e.sx * (1 - ke); y = e.sy * (1 - ke) - Math.sin(ke * Math.PI) * (L.arc || 0);
      const dx = -e.sx, dy = -e.sy - Math.cos(ke * Math.PI) * Math.PI * (L.arc || 0);
      rot += Math.atan2(dy, dx);
    }
    if (L.spin) rot += (e.ms / 1000) * L.spin;
    // 大きさ（論理 px → 部品の倍率。中身はコマの 9 割ほど）
    const base = (m.scale || 0.5) * 0.9;
    let s = L.k || 1;
    if (L.th) s = (L.th * targetH(L, c, e)) / (m.h * base * ls);
    else if (L.px) s = L.px / (m.h * base * ls);
    else if (L.pxw) s = L.pxw / (m.w * base * ls);
    else if (L.sky) s = Math.max(120, (e.y || 0) + ((c.tc.fy - c.tc.y) || 0) + 20) / (m.h * base * ls);
    if (L.grow) s *= E.lerp(L.grow[0], L.grow[1], E.out(u));
    let pal = null;
    if (m.tint || L.tint != null) pal = palOf(c, L.tint);
    if (x || y) g.translate(x, y);
    I.drawFrame(g, L.id, fi, { s, rot, flat: L.flat, my: L.my, mx: L.mx, a, pal });
  });
  // 画像の部品と重ねた手続きの層: 画像が読めていれば薄く（L.dimTo。0 なら描かない）、読めていなければそのまま
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
  // 各決まり (L, spec, part) → {add: [画像の層の値], dim: 手続きの層の濃さ（1 = そのまま、0 = 消す）} | null
  // 弧の画像（slash_*）: 右下へ振り下ろす三日月。ふくらみは左下（角 +2.36）。振りの向きが逆（sw > 0）なら上下を返す
  const ARC_BULGE = 2.36;
  const has = (id) => I.on && I.has(id);
  const pick = (...ids) => ids.find(has) || null;
  const elemOf = (spec) => palName(spec.pal) || '';
  function nativeOr(part, spec, L) {
    // 色の部品: 技・術の色が同じ系統ならそのまま、違えば塗り分ける
    if (L.col && typeof L.col === 'string' && RGB.test(L.col)) return L.col;
    const el = L.col && typeof L.col === 'string' && S.PAL[L.col] ? L.col : elemOf(spec);
    const re = NATIVE[part];
    return re && re.test(el) ? null : (L.col != null ? L.col : 0);
  }
  const lim = (v, a, b) => Math.max(a, Math.min(b, v));
  const RULES = {
    arc(L, spec) {
      if ((L.n || 1) > 1 && L.gap === 0) {
        const id = pick('slash_spin');
        return id ? { add: [{ id, px: (L.r || 40) * 3, flat: L.flat || 0.5, env: 1, tint: L.col }], dim: 0.35 } : null;
      }
      // 3 本以上の連なる弧は乱れ斬り（slash_multi）
      if ((L.n || 1) >= 3 && has('slash_multi')) return { add: [{ id: 'slash_multi', th: lim((L.r || 32) / 12, 2.4, 3.6), tint: L.col }], dim: 0.3 };
      const heavy = (L.w || 6) >= 10 || spec.tier >= 5;
      const id = heavy ? pick('slash_heavy', 'slash_arc_a') : pick('slash_arc_a');
      if (!id) return null;
      const sw = L.sw == null ? 2 : L.sw, mid = (L.a0 || 0) + sw / 2;
      const my = sw > 0 ? 1 : 0, base = my ? -ARC_BULGE : ARC_BULGE;
      const out = [];
      const n = L.n || 1, gap = L.gap != null ? L.gap : 0.18;
      const th = lim((L.r || 32) / 13, 2.3, 3.6) * (heavy ? 1.15 : 1);
      for (let j = 0; j < n; j++) {
        const rot = mid - base + (L.rot || 0) * j;
        const u0 = j * gap, u1 = Math.min(1, j * gap + 0.9);
        out.push({ id, th, rot, my, flat: L.flat, u0, u1, tint: L.col });
        // 残像（少し遅れて、少し回って、薄く大きく）と、芯を重ねて明るく
        out.push({ id, th: th * 1.12, rot: rot + (my ? -0.22 : 0.22), my, flat: L.flat, u0: Math.min(0.95, u0 + 0.07), u1: Math.min(1, u1 + 0.07), a: 0.5, tint: L.col != null ? L.col : 2, hq: 1 });
      }
      return { add: out, dim: 0.15 };
    },
    cut(L) {
      // 2 本が交わる斬り（X）は slash_x 1 枚で（二等分の向きに合わせる）
      if ((L.n || 1) === 2 && Math.abs(Math.abs(L.step || 0) - Math.PI / 2) < 0.5 && has('slash_x')) {
        const rot = (L.ang || 0) + (L.step || 0) / 2 - Math.PI / 2;
        return { add: [{ id: 'slash_x', th: lim((L.len || 80) / 30, 2.2, 3.6), rot, tint: L.col }, { id: 'slash_x', th: lim((L.len || 80) / 30, 2.2, 3.6) * 0.95, rot, a: 0.5, tint: L.col2 != null ? L.col2 : 1 }], dim: 0.25 };
      }
      const id = pick('slash_line');
      if (!id) return null;
      const out = [], n = L.n || 1, gap = L.gap || 0.12;
      for (let j = 0; j < n; j++) {
        const rot = (L.ang || 0) + (L.step || 0) * j;
        out.push({ id, pxw: lim((L.len || 80) * 1.9, 120, 900), rot, flat: 2.2, u0: j * gap, u1: Math.min(1, j * gap + 0.85), tint: L.col });
        out.push({ id, hq: 1, pxw: lim((L.len || 80) * 1.9, 120, 900) * 0.92, rot, flat: 1.4, u0: j * gap, u1: Math.min(1, j * gap + 0.85), a: 0.6, tint: L.col2 != null ? L.col2 : 1 });
      }
      return { add: out, dim: 0.3 };
    },
    bigslash(L) {
      const id = pick('slash_line');
      return id ? { add: [{ id, pxw: lim((L.len || 900) * 0.9, 300, 1400), rot: L.ang || 0, flat: 3, a: 1, tint: L.col }], dim: 0.5 } : null;
    },
    thrust(L) {
      const id = pick('thrust_streak');
      if (!id) return null;
      return { add: [{ id, pxw: lim((L.len || 80) * 2.1, 120, 600), rot: Math.PI + (L.ang || 0), tint: L.col }, { id, pxw: lim((L.len || 80) * 2.1, 120, 600) * 0.9, rot: Math.PI + (L.ang || 0), a: 0.5, tint: 1 }], dim: 0.3 };
    },
    sparks(L, spec, part) {
      if (L.star && (L.size || 0) >= 16) { const id = pick('impact_flash', 'hit_spark_a'); return id ? { add: [{ id, th: lim((L.size || 20) / 10, 1.8, 3.2), tint: L.col }], dim: 0.4 } : null; }
      if (part !== 'hit' || (L.n || 8) < 3) return null;
      const id = (spec.pal === S.PAL.greatsword || /greatsword|staff/.test(spec.key)) ? pick('hit_spark_c', 'hit_spark_a') : pick('hit_spark_a');
      if (!id) return null;
      return { add: [{ id, th: lim(1.3 + (L.v || 26) / 50, 1.5, 2.6), tint: L.col != null ? L.col : 1 }], dim: 0.6 };
    },
    flames(L, spec, part) {
      const w = L.w || 40, h = L.h || 60;
      if (part === 'hit' || w <= 50) {
        const id = pick('fire_burst');
        return id ? { add: [{ id, th: lim(Math.max(w, h) / 22, 2.0, 3.2), foot: L.at === 'tfoot' ? 0 : 0, dy2: -h * 0.3, tint: nativeOr('fire', spec, L) }], dim: 0.35 } : null;
      }
      const id = pick('fire_ground', 'flame_pillar');
      if (!id) return null;
      const out = [{ id, pxw: lim(w * 1.25, 120, 700), env: 1, tint: nativeOr('fire', spec, L) }];
      return { add: out, dim: 0.4 };
    },
    shards(L, spec) {
      const id = pick('ice_shards');
      if (!id) return null;
      return { add: [{ id, th: lim((L.r || 30) / 13, 2.0, 3.4), tint: nativeOr('ice', spec, L) }], dim: 0.4 };
    },
    crystal(L, spec) {
      const id = pick('ice_crystal');
      if (!id) return null;
      const brk = L.brk || 0.72;
      return { add: [{ id, px: (L.h || 100) * 1.7, dy2: -(L.dy || 0), seg: [[0, 0], [brk * 0.45, 3], [brk, 4.9], [Math.min(0.98, brk + 0.06), 5], [1, 8]], tint: nativeOr('ice', spec, L) }], dim: 0 };
    },
    bolt(L, spec) {
      // 稲妻そのものは bolt の部品が描いた絵で描く（fx_seq_prims.js）。ここでは落ちた所の電気の爆ぜを足す
      const eb = pick('electric_burst');
      if (!eb || L.from === 'src') return null;
      return { add: [{ id: eb, th: 2.4, u0: 0.05, tint: nativeOr('thunder', spec, L) }], dim: 1, img: 'lightning_bolt' };
    },
    motes(L, spec) {
      const el = elemOf(spec);
      const healish = /^(heal|water|wind|light|gold)$/.test(el) || spec.ally;
      const id = healish ? pick('heal_sparkles') : null;
      const tw = pick('sparkle_twinkle');
      const out = [];
      if (id) out.push({ id, th: 3.4, foot: 1, tint: el === 'heal' ? null : nativeOr('heal', spec, L) });
      if (tw) out.push({ id: tw, th: 2.6, rise: 60, env: 1, a: 0.95, tint: L.col, hq: 1 });
      return out.length ? { add: out, dim: 0.5 } : null;
    },
    runes(L, spec) {
      const id = pick('magic_circle');
      if (!id) return null;
      const px = lim((L.r || 40) * 2.7, 110, 760);
      const out = [{ id, px, flat: L.flat || 0.34, spin: (L.spin || 0.9) * 0.6, env: 1, fi: 0.18, fo: 0.3, grow: [0.6, 1], tint: L.col }];
      const b = (spec.tier >= 4 || (L.r || 0) >= 100) ? pick('magic_circle_b') : null;
      if (b) out.push({ id: b, px: px * 0.72, flat: L.flat || 0.34, spin: -(L.spin || 0.9) * 0.9, env: 1, fi: 0.25, fo: 0.3, a: 0.85, tint: L.col != null ? L.col : 1 });
      return { add: out, dim: 0.35 };
    },
    orb(L) {
      const id = pick('energy_orb');
      return id ? { add: [{ id, px: lim((L.r || 12) * 4.5, 50, 260), env: 1, tint: L.col }], dim: 0.4 } : null;
    },
    shots(L, spec) {
      const kind = L.kind || 'orb';
      const map = { flame: ['fireball', 0.9, nativeOr('fire', spec, L)], orb: ['energy_orb', 0.6, L.col], rock: ['rock_chunk', 0.35, null], arrow: ['arrow_streak', 0.45, L.col], lance: ['arrow_streak', 0.6, L.col] };
      const mm = map[kind];
      const id = mm && pick(mm[0]);
      if (!id) return null;
      const out = [], n = Math.min(5, L.n || 1);
      for (let j = 0; j < n; j++) out.push({ id, px: (kind === 'arrow' || kind === 'lance') ? null : 60 * mm[1] * 2 * (L.size || 1), pxw: (kind === 'arrow' || kind === 'lance') ? 150 * (L.size || 1) : null, fly: L.fly || 0.7, arc: L.arc || 0, u0: j * (L.gap || 0.06), tint: mm[2], dy2: (j - (n - 1) / 2) * (L.spread || 0) * 0.5 });
      return { add: out, dim: 0.35 };
    },
    ring(L, spec, part) {
      const id = pick('shockwave_ring');
      if (!id) return null;
      return { add: [{ id, px: lim((L.r || 40) * 2.6, 80, 900), flat: L.flat || 1, grow: [0.25, 1], env: 1, fi: 0.05, fo: 0.6, tint: L.col }], dim: 0.4 };
    },
    pillar(L, spec) {
      const id = pick('light_pillar');
      return id ? { add: [{ id, px: lim((L.h || 220) * 1.3, 160, 700), env: 1, fi: 0.15, fo: 0.3, tint: L.col }], dim: 0.4 } : null;
    },
    rays(L) {
      const id = pick('rays_burst');
      return id ? { add: [{ id, px: lim((L.len || 200) * 1.6, 160, 900), spin: (L.spin || 0.2) + 0.15, env: 1, a: 0.85, tint: L.col }], dim: 0.4 } : null;
    },
    void(L) {
      const id = pick('void_swirl', 'dark_orb');
      return id ? { add: [{ id, px: lim((L.r || 20) * 5, 90, 520), env: 1, tint: L.col }], dim: 0.4 } : null;
    },
    vortex(L, spec) {
      const id = pick('wind_swirl');
      return id ? { add: [{ id, px: lim((L.r || 40) * 2.8, 100, 700), flat: L.flat || 0.6, env: 1, tint: L.col != null ? L.col : 0 }], dim: 0.4 } : null;
    },
    tornado(L, spec) {
      const id = pick('tornado');
      return id ? { add: [{ id, px: lim((L.h || 240) * 1.15, 200, 640), env: 1, tint: nativeOr('wind', spec, L) }], dim: 0.35 } : null;
    },
    spikes(L, spec) {
      const kind = L.kind || 'rock';
      const id = kind === 'dark' ? pick('dark_spikes') : kind === 'rock' ? pick('earth_spikes') : pick('ice_crystal');
      if (!id) return null;
      return { add: [{ id, px: lim((L.h || 50) * 2.4, 90, 420), tint: kind === 'rock' ? null : kind === 'dark' ? nativeOr('dark', spec, L) : (L.col != null ? L.col : 0) }], dim: 0.35 };
    },
    debris(L, spec) {
      const id = pick('rock_eruption');
      return id ? { add: [{ id, th: lim((L.v || 50) / 25, 1.6, 3), foot: L.at === 'tfoot' ? 0 : 1 }], dim: 0.5 } : null;
    },
    crack(L) {
      const id = pick('ground_crack');
      return id ? { add: [{ id, pxw: lim((L.len || 60) * 2.6, 120, 900), env: 1, fo: 0.4, tint: L.col }], dim: 0.4 } : null;
    },
    smoke(L) {
      const id = pick('smoke_puff');
      return id ? { add: [{ id, px: lim((L.r || 16) * 5, 80, 400), tint: L.col || '200,195,190', blend: 'source-over', a: Math.min(1, (L.a || 0.4) * 1.8) }], dim: 0.4 } : null;
    },
    bubbles(L) {
      const id = pick('poison_bubbles');
      return id ? { add: [{ id, pxw: lim((L.w || 40) * 1.3, 90, 500), env: 1, tint: L.col }], dim: 0.4 } : null;
    },
    blades(L, spec) {
      const id = pick('wind_slash');
      return id ? { add: [{ id, th: 2.4, tint: nativeOr('wind', spec, L) }], dim: 0.4 } : null;
    },
    splash(L, spec) {
      const id = pick('water_splash');
      return id ? { add: [{ id, px: lim((L.r || 20) * 4.5, 100, 520), foot: L.at === 'tfoot' ? 0 : 1, tint: nativeOr('water', spec, L) }], dim: 0.4 } : null;
    },
    maelstrom(L, spec) {
      const id = pick('water_spiral');
      return id ? { add: [{ id, px: lim((L.r || 150) * 2, 200, 900), flat: 0.4, env: 1, a: 0.85, tint: nativeOr('water', spec, L) }], dim: 0.55 } : null;
    },
    wave(L, spec) {
      // 大波: 火の色なら燃える地面の帯を 3 つ横に、水の色なら しぶきを 3 つ横に（手続きの波は薄く下に）
      const el = L.col && S.PAL[L.col] ? L.col : elemOf(spec);
      const fire = /^(fire|blood|gold)$/.test(el) || (L.col && /^2[0-9]{2},/.test(String(L.col)) && !/water|ice/.test(el));
      const id = fire ? pick('fire_ground', 'fire_burst') : pick('water_splash');
      if (!id) return null;
      const W = L.w || 400, out = [];
      for (let j = -1; j <= 1; j++) out.push({ id, pxw: lim(W * 0.55, 160, 600), dy2: 0, rise: 0, u0: 0.08 + (1 - j) * 0.1, env: 1, tint: fire ? nativeOr('fire', spec, L) : nativeOr('water', spec, L), dx2: j * W * 0.33 });
      return { add: out, dim: 0.35 };
    },
    tendrils(L, spec) {
      const id = pick('dark_spikes');
      return id ? { add: [{ id, pxw: lim((L.w || 70) * 1.2, 100, 500), env: 1, tint: nativeOr('dark', spec, L) }], dim: 0.6 } : null;
    },
  };
  I.RULES = RULES;

  // 技・術ごとの決まりの層（どの技・術にも: 使い手の溜め・当たりの閃光・余韻）
  function extras(spec) {
    const add = { main: [], hit: [] };
    const harm = !spec.ally;
    // 技の溜め: 使い手の足もとから気がのぼる（段 2 以上。当たる瞬間まで）
    if (!/^s_/.test(spec.key) && spec.lead >= 100 && has('aura_rise')) add.main.push({ p: 'img', id: 'aura_rise', t0: 0, t1: spec.lead + 160, at: 'srcfoot', th: 1.5 + spec.tier * 0.15, env: 1, fi: 0.2, fo: 0.3, a: 0.85, blend: 'lighter' });
    // 術の溜め: 使い手の上に念の玉（段 3 未満の術にも）
    if (/^s_/.test(spec.key) && spec.tier < 3 && has('energy_orb')) add.main.push({ p: 'img', id: 'energy_orb', t0: 0, t1: Math.max(spec.lead, 300), at: 'src', dy: -16, px: 46 + spec.tier * 10, env: 1, a: 0.9, blend: 'lighter' });
    if (harm) {
      // 当たりの閃光（段 3 以上は大きな閃光、それ以下は火花が無い行だけ）
      const big = spec.tier >= 3 ? pick('impact_flash') : null;
      if (big) add.hit.push({ p: 'img', id: big, t0: 0, t1: 420, at: 'tgt', th: 1.6 + spec.tier * 0.2, a: 0.9, blend: 'lighter' });
      else if (!spec.hit.some((L) => L.p === 'img' && /^hit_spark/.test(L.id)) && has('hit_spark_a')) add.hit.push({ p: 'img', id: 'hit_spark_a', t0: 0, t1: 360, at: 'tgt', th: 1.7, tint: 1, blend: 'lighter' });
      // 余韻: きらめきがしばらく残る
      if (has('sparkle_twinkle')) add.hit.push({ p: 'img', id: 'sparkle_twinkle', t0: 90, t1: 700, at: 'tgt', th: 1.8, a: 0.75, rise: 20, env: 1, blend: 'lighter', hq: 1 });
    }
    return add;
  }

  /** 組み立てた形に画像の層を足す（初めて使う時に 1 回。S.get の後） */
  function augment(spec) {
    spec.imgParts = [];
    if (!I.on || !hasDoc || !R.Media || !R.Media.table) return spec;
    // 当たりの効果の長さの上限（test_fx_seq: 段 1 は 0.75 秒、当たりは 0.8 秒まで）
    const hitCap = spec.tier <= 1 ? 740 : 790;
    for (const part of ['main', 'hit']) {
      const src = spec[part], out = [];
      for (const L of src) {
        const rule = RULES[L.p];
        const r = rule ? rule(L, spec, part) : null;
        if (!r || !r.add || !r.add.length) { out.push(L); continue; }
        // 手続きの層を下に（薄く）、画像の層を上に
        if (r.dim !== 1) out.push(Object.assign({}, L, { p: 'imgdim', p0: L.p, img: r.img || r.add[0].id, dimTo: r.dim == null ? 0.4 : r.dim }));
        else out.push(L);
        for (const A of r.add) {
          const nl = Object.assign({ p: 'img', t0: L.t0, t1: L.t1, at: L.at, s: L.s, dx: L.dx, dy: L.dy, nf: L.nf }, A);
          // 当たりの画像は長めに（山を保って、ゆっくり消える）
          if (part === 'hit') nl.t1 = Math.min(hitCap, Math.max(nl.t1, nl.t0 + (L.t1 - L.t0) * 1.7, nl.t0 + 380));
          const m = I.meta(A.id);
          nl.blend = A.blend || (m && m.blend) || 'lighter';
          out.push(nl);
        }
      }
      spec[part] = out;
    }
    const ex = extras(spec);
    spec.main = ex.main.concat(spec.main);   // 溜めは下に
    for (const L of ex.hit) { L.t1 = Math.min(hitCap, L.t1); L.s = L.s || 1; spec.hit.push(L); }
    // 画像の層の分だけ長さを足す（main は表の長さのまま、hit は上限まで）
    spec.hitDur = Math.min(Math.max(spec.hitDur, hitCap), Math.max(spec.hitDur, ...spec.hit.map((L) => L.t1)));
    for (const L of spec.main.concat(spec.hit)) if (L.p === 'img' && !spec.imgParts.includes(L.id)) spec.imgParts.push(L.id);
    // 手続きの部品の中で画像を使う物（巨大な武器: fx_seq_hero.js の giant）
    for (const L of spec.main.concat(spec.hit)) if ((L.p === 'bolt' || L.p0 === 'bolt' || (L.p === 'storm' && L.bolts)) && has('lightning_bolt') && !spec.imgParts.includes('lightning_bolt')) spec.imgParts.push('lightning_bolt');
    for (const L of spec.main) if (L.p === 'meteor') for (const id of ['meteor', 'fire_burst']) if (has(id) && !spec.imgParts.includes(id)) spec.imgParts.push(id);
    for (const L of spec.main) if (L.p === 'giant') { const id = L.kind === 'hammer' ? 'spectral_hammer' : 'spectral_sword'; if (has(id) && !spec.imgParts.includes(id)) spec.imgParts.push(id); }
    // 読み始め、読めたら技・術の色に塗っておく（当たる瞬間に塗らない）
    for (const id of spec.imgParts) {
      const r = I.load(id);
      if (!r) continue;
      r.promise.then(() => {
        const m = I.meta(id);
        if (!m || !r.ok) return;
        const pals = new Set();
        for (const L of spec.main.concat(spec.hit)) if (L.p === 'img' && L.id === id && (m.tint || L.tint != null)) pals.add(JSON.stringify(palOf({ pal: spec.pal }, L.tint)));
        for (const L of spec.main.concat(spec.hit)) {
          // 手続きの部品が使う絵の色（巨大な武器・稲妻）
          if (L.p === 'giant' && id === (L.kind === 'hammer' ? 'spectral_hammer' : 'spectral_sword')) pals.add(JSON.stringify(palOf({ pal: spec.pal }, L.col)));
          if (id === 'lightning_bolt' && (L.p === 'bolt' || L.p === 'storm')) { const p = palOf({ pal: spec.pal }, L.col != null ? L.col : 'thunder'); if (p[0] !== S.PAL.thunder[0]) pals.add(JSON.stringify(p)); }
        }
        for (const p of pals) I.warm(id, JSON.parse(p));
      });
    }
    return spec;
  }
  I.augment = augment;
  I.frameAt = frameAt;
  const get0 = S.get;
  S.get = function (sid) {
    const sp = get0(sid);
    if (sp && !sp.imgParts) augment(sp);
    return sp;
  };

  // ---------------------------------------------------------------- 古い効果（R.BFX.defs）の画像
  // id → [{id: 部品, k（倍率）, t0（ms の遅れ）, pal, foot（体の中ほど → 足もと）, rot, my, flat, dur（ループの部品の長さ ms）, grow}]
  const W = (p) => S.PAL[p];
  const HIT = ['255,215,150', '255,250,230', '220,120,60'];
  const BLOOD = ['255,120,110', '255,225,215', '170,30,40'];
  I.LEGACY = {
    slash: [{ id: 'slash_arc_a', k: 1.0, rot: -1.4 + ARC_BULGE, my: 1, pal: W('sword') }, { id: 'slash_arc_a', k: 0.95, rot: -1.4 + ARC_BULGE, my: 1, pal: W('sword'), a: 0.5 }],
    smash: [{ id: 'hit_spark_c', k: 1.0, pal: W('greatsword') }, { id: 'shockwave_ring', k: 0.5, flat: 0.4, grow: [0.3, 1], dur: 360, foot: 30, pal: W('greatsword') }],
    thrust: [{ id: 'thrust_streak', k: 0.7, rot: 0, pal: W('dagger') }],
    shoot: [{ id: 'hit_spark_b', k: 0.8, pal: W('bow') }],
    claw: [{ id: 'claw_slash', k: 0.95, pal: BLOOD }],
    bite: [{ id: 'bite_fangs', k: 0.9, pal: BLOOD }],
    hit: [{ id: 'hit_spark_a', k: 0.85, pal: HIT }],
    crit: [{ id: 'impact_flash', k: 1.25, pal: W('gold') }, { id: 'hit_spark_a', k: 1.3, pal: W('gold') }],
    fire: [{ id: 'fire_burst', k: 1.0 }],
    ice: [{ id: 'ice_shards', k: 0.95 }],
    thunder: [{ id: 'lightning_bolt', k: 1.1, foot: 40 }, { id: 'electric_burst', k: 0.8, t0: 60 }],
    wind: [{ id: 'wind_swirl', k: 0.8, dur: 520, flat: 0.7, pal: W('wind') }],
    earth: [{ id: 'rock_eruption', k: 0.9, foot: 40 }],
    light: [{ id: 'holy_burst', k: 0.85 }],
    dark: [{ id: 'void_swirl', k: 0.7, dur: 540 }, { id: 'dark_orb', k: 0.6, dur: 540 }],
    heal: [{ id: 'heal_sparkles', k: 1.1, foot: 40 }, { id: 'sparkle_twinkle', k: 0.9, pal: W('heal') }],
    mp: [{ id: 'heal_sparkles', k: 1.1, foot: 40, pal: ['110,170,255', '225,240,255', '60,80,220'] }, { id: 'sparkle_twinkle', k: 0.9, pal: W('water') }],
    revive: [{ id: 'light_pillar', k: 0.8, foot: 60, dur: 640, pal: W('light') }, { id: 'heal_sparkles', k: 1.1, foot: 60, pal: W('light') }],
    buff: [{ id: 'aura_rise', k: 0.8, foot: 40, dur: 560, pal: W('gold') }],
    debuff: [{ id: 'debuff_smoke', k: 0.75, pal: ['150,110,220', '220,200,255', '60,30,110'] }],
    status: [{ id: 'debuff_smoke', k: 0.75, pal: ['150,110,220', '220,200,255', '60,30,110'] }],
    summon: [{ id: 'smoke_puff', k: 0.9, pal: ['120,110,150', '200,195,220', '50,45,70'] }],
    smoke: [{ id: 'smoke_puff', k: 0.9, pal: ['170,170,180', '235,235,240', '80,80,95'] }],
    cast: [{ id: 'magic_circle', k: 0.32, flat: 0.34, foot: 34, dur: 520, spin: 0.8, pal: ['120,220,230', '230,252,255', '40,120,150'] }],
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
      // 1 コマの部品・ループの部品は P.dur の間（出入りを柔らかく）、ほかは山を保って流す（コマの長さの 1.4 倍）
      const dur = P.dur || (m.n > 1 && !m.loop ? m.n / m.fps * 1000 * 1.4 : 500);
      if (tt >= dur) continue;
      const u = tt / dur;
      const fi = m.loop ? (tt * m.fps / 1000) % m.n : frameAt(m, u, P);
      alive = true;
      g.save();
      g.globalCompositeOperation = m.blend || 'lighter';
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      g.translate(x, y + (P.foot || 0));
      if (o.flip) g.scale(-1, 1);
      const a = (P.a || 1) * (P.dur || m.loop || m.n <= 1 ? E.env(u, 0.12, 0.3) : 1);
      const s = (P.k || 1) * (o.scale || 1) * (P.grow ? E.lerp(P.grow[0], P.grow[1], E.out(u)) : 1);
      I.drawFrame(g, P.id, fi, { s, rot: (P.rot || 0) + (P.spin ? tt / 1000 * P.spin : 0), my: P.my, flat: P.flat, a, pal: m.tint ? (P.pal || W('sword')) : P.pal || null });
      g.restore();
    }
    return alive;
  };

  // 起動の後、よく使う部品を先に読む（当たりの火花・剣の弧など。ほかは使う時に読む）
  I.COMMON = ['hit_spark_a', 'hit_spark_b', 'hit_spark_c', 'slash_arc_a', 'impact_flash', 'claw_slash', 'bite_fangs', 'thrust_streak', 'heal_sparkles', 'sparkle_twinkle', 'magic_circle', 'aura_rise', 'energy_orb', 'debuff_smoke'];
  if (R.onBoot) R.onBoot(function () { setTimeout(() => { try { I.preload(I.COMMON.filter(I.has)); } catch (e) { /* ignore */ } }, 1500); });
})(window.RPG);
