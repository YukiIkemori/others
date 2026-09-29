// BSCENE: 技・術の演出（組み立て式。R.BFX.seq）。技 128・術 79 の全部が専用の id（'sq:<技・術の id>'）を持つ。
// 表（fx_seq_table.js）は「部品（prims）を時間に並べた物」。部品は fx_seq_prims.js（汎用）と fx_seq_hero.js（上の段の主役）。
// 段（tier 1〜6）で派手になる: 1–2 は当たりだけの短い効果、3–4 は閃光・揺れ・範囲、5–6 は画面いっぱいの見せ場（6 は技名の差し込み）。
//   S.idFor(dbk, id)          'techs' | 'spells' と技・術の id → 'sq:<id>'（表に無ければ null）
//   S.get(sid)                組み立てた形 {id, tier, lead, dur, hitDur, main[], hit[], shakes[], pal, name}
//   S.draw(g, f, t)           1 コマ描く（f = {seq, part:'main'|'hit', c}、t = 始まってからの ms・速さの前）→ まだ続くなら true
//   S.ctx(o)                  描く時の文脈（的・使い手・向き・画面の広さ・品質）
// 時間は戦闘の時計（st.clock）。戦闘の速さで速くなる。2 回目からは f.rate（1 より大きい）で短くなる。
// 描く時は毎コマ手続きで描く（焼かない）。粒は状態を持たない（種と時間から位置を出す）ので、毎コマ物を作らない。
(function (R) {
  'use strict';
  const BFX = (R.BFX = R.BFX || {});
  const S = (BFX.seq = BFX.seq || {});
  S.prims = S.prims || {};
  S.table = S.table || {};      // 表の元: 技・術の id → 形（fx_seq_table.js が入れる）
  S.cache = {};
  S.prim = function (name, fn) { S.prims[name] = fn; };

  // ---------------------------------------------------------------- 乱数（状態なし）と曲線
  const hr = (n) => {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  };
  const hs = (str) => { let h = 2166136261; const s = String(str); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  S.hr = hr; S.hs = hs;
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const E = (S.E = {
    cl,
    out: (k) => 1 - (1 - cl(k)) * (1 - cl(k)),
    out3: (k) => 1 - Math.pow(1 - cl(k), 3),
    in: (k) => cl(k) * cl(k),
    inOut: (k) => { k = cl(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
    bell: (k) => Math.sin(cl(k) * Math.PI),
    win: (u, a, b) => cl((u - a) / Math.max(1e-6, b - a)),
    // 出て・保って・消える（fi = 出る割合、fo = 消える割合）
    env: (u, fi, fo) => Math.min(fi > 0 ? cl(u / fi) : 1, fo > 0 ? cl((1 - u) / fo) : 1),
    lerp: (a, b, k) => a + (b - a) * k,
  });

  // ---------------------------------------------------------------- 色（rgb の文字）
  S.PAL = {
    sword: ['180,215,255', '245,250,255', '110,150,255'],
    greatsword: ['255,180,100', '255,242,205', '225,100,40'],
    dagger: ['140,255,200', '235,255,245', '50,190,150'],
    bow: ['255,230,140', '255,255,232', '215,165,70'],
    staff: ['190,160,255', '246,236,255', '120,85,235'],
    fire: ['255,125,45', '255,232,150', '205,45,15'],
    water: ['80,170,255', '215,245,255', '30,90,210'],
    wind: ['120,240,170', '232,255,242', '40,175,120'],
    earth: ['215,150,80', '255,228,175', '135,85,40'],
    light: ['255,228,150', '255,255,242', '255,185,85'],
    dark: ['170,100,255', '236,212,255', '85,30,165'],
    thunder: ['255,232,110', '255,255,236', '150,160,255'],
    ice: ['150,220,255', '242,252,255', '90,150,235'],
    poison: ['150,232,90', '232,255,200', '120,50,170'],
    heal: ['140,245,160', '236,255,232', '90,205,255'],
    blood: ['255,80,90', '255,215,215', '150,20,40'],
    gold: ['255,205,90', '255,248,215', '215,140,40'],
    steel: ['200,210,230', '255,255,255', '120,130,160'],
    rainbow: ['255,140,140', '255,255,255', '140,180,255'],
  };
  const named = (v) => (S.PAL[v] ? S.PAL[v][0] : v);
  const pc = (c, v, d) => (v == null ? (d == null ? c.pal[0] : typeof d === 'number' ? c.pal[d] : named(d)) : typeof v === 'number' ? c.pal[v] || c.pal[0] : named(v));
  S.col = pc;

  // ---------------------------------------------------------------- 丸い光（焼いた小さな絵を使い回す）
  const dots = new Map();
  function dotSprite(rgb, hard) {
    if (typeof document === 'undefined') return null;
    const key = rgb + (hard ? 'h' : '');
    let c = dots.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      if (hard) { gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.55, `rgba(${rgb},0.85)`); gr.addColorStop(1, `rgba(${rgb},0)`); }
      else { gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.3, `rgba(${rgb},0.5)`); gr.addColorStop(1, `rgba(${rgb},0)`); }
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      if (dots.size > 160) dots.delete(dots.keys().next().value);
      dots.set(key, c);
    }
    return c;
  }
  /** 柔らかい丸い光（加算で重ねる物） */
  const RGB = /^\d{1,3},\d{1,3},\d{1,3}$/;
  S.dot = function (g, x, y, r, rgb, a, hard) {
    if (S.strict && !RGB.test(rgb)) throw new Error('bad color ' + rgb);
    if (!(a > 0.004) || !(r > 0.2)) return;
    const sp = dotSprite(rgb, hard);
    const ga = g.globalAlpha;
    g.globalAlpha = ga * (a > 1 ? 1 : a);
    if (sp && g.drawImage) g.drawImage(sp, x - r, y - r, r * 2, r * 2);
    else { g.fillStyle = `rgba(${rgb},0.5)`; g.beginPath(); g.arc(x, y, r * 0.6, 0, 7); g.fill(); }
    g.globalAlpha = ga;
  };
  /** 線（太さ w、色 rgb、濃さ a） */
  S.line = function (g, x0, y0, x1, y1, w, rgb, a) {
    if (S.strict && !RGB.test(rgb)) throw new Error('bad color ' + rgb);
    if (!(a > 0.004)) return;
    g.strokeStyle = `rgba(${rgb},${a > 1 ? 1 : a})`; g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  };
  /** 3 重の光る線（外の薄い光・中・白い芯） */
  S.glowLine = function (g, x0, y0, x1, y1, w, c0, c1, a) {
    g.lineCap = 'round';
    S.line(g, x0, y0, x1, y1, w * 3, c0, 0.18 * a);
    S.line(g, x0, y0, x1, y1, w * 1.5, c0, 0.55 * a);
    S.line(g, x0, y0, x1, y1, w * 0.5, c1, 0.95 * a);
  };
  S.star = function (g, x, y, r, n, rgb, a, rot) {
    if (!(a > 0.004) || !(r > 0.2)) return;
    g.fillStyle = `rgba(${rgb},${a > 1 ? 1 : a})`;
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const ang = (rot || 0) + i * Math.PI / n, rr = i % 2 ? r * 0.22 : r;
      if (i) g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); else g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    g.closePath(); g.fill();
  };

  // ---------------------------------------------------------------- 段
  /** 技・術 → 段（1〜6） */
  S.tierOf = function (d) {
    if (!d) return 1;
    if (d.kind === 'spell') {
      if (d.cls === 'triple') return 6;
      if (d.cls === 'comboA' || d.cls === 'comboB') return 5;
      return Math.max(1, Math.min(5, d.step || d.rank || 1));
    }
    const r = d.rank || 1;
    return r >= 10 ? 6 : r >= 9 ? 5 : r >= 7 ? 4 : r >= 5 ? 3 : r >= 3 ? 2 : 1;
  };
  // 段ごとの既定: 当たるまで（lead）・暗さ・閃光・揺れ
  S.TIER = {
    1: { lead: 0, dim: 0, flash: 0, shake: 0 },
    2: { lead: 120, dim: 0, flash: 0.1, shake: 0 },
    3: { lead: 260, dim: 0, flash: 0.2, shake: 2.5 },
    4: { lead: 420, dim: 0.34, flash: 0.24, shake: 3.5 },
    5: { lead: 680, dim: 0.5, flash: 0.3, shake: 5 },
    6: { lead: 950, dim: 0.6, flash: 0.34, shake: 6.5 },
  };

  // ---------------------------------------------------------------- 表の組み立て
  S.idFor = function (dbk, id) {
    if (!id || (dbk !== 'techs' && dbk !== 'spells')) return null;
    return S.table[id] ? 'sq:' + id : null;
  };
  S.has = (sid) => !!(sid && S.table[String(sid).replace(/^sq:/, '')]);
  S.all = () => Object.keys(S.table).map((k) => 'sq:' + k);
  /** 表の 1 行を組み立てる（初めて使う時に 1 回） */
  S.get = function (sid) {
    if (!sid) return null;
    if (S.cache[sid]) return S.cache[sid];
    const key = String(sid).replace(/^sq:/, '');
    const raw = S.table[key];
    if (!raw) return null;
    const db = R.DB || {};
    const d = (db.techs && db.techs[key]) || (db.spells && db.spells[key]) || {};
    const src = typeof raw === 'function' ? raw(d) : raw;
    const tier = src.tier || S.tierOf(d);
    const T = S.TIER[tier];
    const lead = src.lead != null ? src.lead : T.lead;
    const spec = {
      id: sid, key, tier, lead, name: d.name || '', pal: src.pal || S.PAL.sword, c: src.c || '',
      main: [], hit: [], shakes: [], banner: tier >= 6 && src.banner !== false, ally: !!src.ally,
    };
    // 表の時間は「当たる瞬間（impact）= 0」から数える。負の数は溜め
    for (const L of src.main || []) spec.main.push(Object.assign({}, L, { t0: L.t0 + lead, t1: L.t1 + lead }));
    // 当たりの効果は段が上がるほど少し大きく（1.15〜1.4 倍。表で s を書いた層はそのまま）
    for (const L of src.hit || []) spec.hit.push(Object.assign({ s: 1.1 + tier * 0.05 }, L));
    // 段の決まりの層（暗さ・黒帯・差し込み・閃光・集中線・術の魔法陣）
    const dim = src.dim != null ? src.dim : T.dim;
    const tailEnd = Math.max(lead + 200, ...spec.main.map((L) => L.t1));
    if (dim > 0) spec.main.unshift({ p: 'dim', t0: 0, t1: tailEnd, at: 'scr', a: dim, col: src.dimCol, fi: Math.min(0.3, 260 / tailEnd), fo: Math.min(0.35, 320 / tailEnd), blend: 'source-over' });
    if (tier >= 6 && src.bars !== false) spec.main.push({ p: 'bars', t0: 0, t1: tailEnd, at: 'scr', h: 0.085, blend: 'source-over' });
    const fl = src.flash != null ? src.flash : T.flash;
    if (fl > 0) spec.main.push({ p: 'flash', t0: lead - 20, t1: lead + 260 + tier * 30, at: 'scr', a: fl, col: src.flashCol || 1 });
    if (src.cast !== false && (d.kind === 'spell' || src.cast)) {
      const r = 20 + tier * 7;
      spec.main.unshift({ p: 'runes', t0: 0, t1: Math.max(lead, 300) + 120, at: 'srcfoot', r, flat: 0.34, sides: tier >= 5 ? 7 : tier >= 3 ? 6 : 5, rings: tier >= 4 ? 3 : 2, col: src.castCol != null ? src.castCol : 0, spin: 0.9, glyphs: 8 + tier * 3 });
      if (tier >= 3) spec.main.push({ p: 'orb', t0: 0, t1: Math.max(lead, 300), at: 'src', dy: -12, r: 8 + tier * 3, n: 8 + tier * 4, col: src.castCol != null ? src.castCol : 0 });
    }
    if (tier >= 4 && src.lines !== false && !src.ally) spec.main.push({ p: 'speedlines', t0: Math.max(0, lead - 260), t1: lead + 160, at: 'scr', n: 20 + tier * 6, col: '255,255,255', a: 0.22 + tier * 0.03, blend: 'source-over' });
    // 差し込みの帯は溜めの間だけ（当たる瞬間の前に抜ける）
    if (spec.banner) spec.main.push({ p: 'banner', t0: 60, t1: Math.max(500, lead - 40), at: 'scr', col: 0, blend: 'source-over', top: 1 });
    for (const s of src.shakes || []) spec.shakes.push([s[0] + lead, s[1], s[2] || 260]);
    const sh = src.shake != null ? src.shake : T.shake;
    if (sh > 0 && !(src.shakes || []).length) spec.shakes.push([lead, sh, 200 + tier * 60]);
    // 当たりの効果が無い行は最低の火花を足す（見えない当たりを作らない）
    if (!spec.hit.length) spec.hit.push({ p: 'sparks', t0: 0, t1: 260, at: 'tgt', n: 8, v: 26, len: 8, col: 1 });
    spec.dur = Math.max(lead + 200, ...spec.main.map((L) => L.t1));
    spec.hitDur = Math.max(120, ...spec.hit.map((L) => L.t1));
    // 層の順: 暗さ（下）→ ふつう → 差し込み（上）
    spec.main.sort((a, b) => (a.p === 'dim' ? -1 : 0) - (b.p === 'dim' ? -1 : 0) || (a.top ? 1 : 0) - (b.top ? 1 : 0));
    spec.sig = sigOf(spec);
    S.cache[sid] = spec;
    return spec;
  };
  // 見た目の署名（同じ見た目の行が無いことのテスト用）: 段の決まりの層を除いた部品と値
  function sigOf(spec) {
    const std = /^(dim|bars|flash|banner|speedlines)$/;
    const pick = (L) => { const o = {}; for (const k of Object.keys(L).sort()) if (k !== 't0' && k !== 't1') o[k] = L[k]; return o; };
    return JSON.stringify({ pal: spec.pal, main: spec.main.filter((L) => !std.test(L.p)).map(pick), hit: spec.hit.map(pick) });
  }

  // ---------------------------------------------------------------- 描く時の文脈
  /**
   * o = {src:{x,y,fy}, tgts:[{x,y,fy,h}], dir, W, H, q, rm, lf, name, seed, st}
   *   x,y = 体の中ほど、fy = 足もと。dir = 効果が進む向き（右へ +1、味方 → 敵は -1）
   */
  S.ctx = function (o) {
    const tg = o.tgts && o.tgts.length ? o.tgts : [{ x: (o.W || 960) * 0.3, y: (o.H || 540) * 0.65, fy: (o.H || 540) * 0.75, h: 50 }];
    let x = 0, y = 0, fy = 0;
    for (const t of tg) { x += t.x; y += t.y; fy += t.fy; }
    const n = tg.length;
    return Object.assign({ dir: -1, W: 960, H: 540, q: 1, rm: false, lf: false, seed: 1 }, o, {
      tgts: tg, tc: { x: x / n, y: y / n, fy: fy / n }, src: o.src || { x: (o.W || 960) * 0.7, y: (o.H || 540) * 0.65, fy: (o.H || 540) * 0.75 },
    });
  };

  // ---------------------------------------------------------------- 描く
  function anchorsOf(L, c) {
    switch (L.at) {
      case 'scr': return null;
      case 'src': return [[c.src.x, c.src.y]];
      case 'srcfoot': return [[c.src.x, c.src.fy]];
      case 'tfoot': return [[c.tc.x, c.tc.fy]];
      case 'each': return c.tgts.slice(0, 8).map((t) => [t.x, t.y]);
      case 'eachfoot': return c.tgts.slice(0, 8).map((t) => [t.x, t.fy]);
      case 'mid': return [[(c.src.x + c.tc.x) / 2, (c.src.y + c.tc.y) / 2]];
      case 'sky': return [[c.tc.x, 0]];
      default: return [[c.tc.x, c.tc.y]];
    }
  }
  /** 1 コマ（t = 始まってからの ms。f.rate で縮める）→ まだ続くなら true */
  S.draw = function (g, f, t) {
    const spec = S.get(f.seq);
    if (!spec) return false;
    const c = f.c;
    c.pal = spec.pal;
    const tt = t * (f.rate || 1);
    const main = f.part !== 'hit';
    const dur = main ? spec.dur : spec.hitDur;
    if (tt > dur) return false;
    const layers = main ? spec.main : spec.hit;
    const pr = S.prims;
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      if (tt < L.t0 || tt > L.t1) continue;
      if (L.top && c.noBanner) continue;
      if (L.rmOff && c.rm) continue;
      const fn = pr[L.p];
      if (!fn) continue;
      const u = (tt - L.t0) / Math.max(1, L.t1 - L.t0);
      const seed = (c.seed + li * 7919 + (f.hitIdx || 0) * 104729) | 0;
      g.save();
      g.globalCompositeOperation = L.blend || 'lighter';
      if (L.a2 != null) g.globalAlpha *= L.a2;
      try {
        const an = anchorsOf(L, c);
        if (!an) fn(g, u, L, c, { x: 0, y: 0, sx: c.src.x, sy: c.src.y, seed, i: 0, n: 1, ms: tt - L.t0, hit: f.hitIdx || 0 });
        else {
          for (let i = 0; i < an.length; i++) {
            const ax = an[i][0] + (L.dx || 0) * c.dir * -1, ay = an[i][1] + (L.dy || 0);
            g.save();
            g.translate(ax, ay);
            const fl = L.nf ? 1 : -c.dir;   // 表は「右から左へ」（味方 → 敵）で書く。敵 → 味方は反転
            if (fl !== 1) g.scale(fl, 1);
            if (L.s && L.s !== 1) g.scale(L.s, L.s);
            const sc = L.s || 1;
            // 使い手の位置（この点から見た向きの座標）
            const sx = ((c.src.x - ax) * fl) / sc, sy = (c.src.y - ay) / sc;
            fn(g, u, L, c, { x: ax, y: ay, sx, sy, seed: seed + i * 31, i, n: an.length, ms: tt - L.t0, hit: f.hitIdx || 0 });
            g.restore();
          }
        }
      } catch (e) {
        if (S.strict) throw e;   // テスト用
        if (!S._warned) { S._warned = true; console.error('[bfx seq]', spec.id, L.p, e); }
      }
      g.restore();
    }
    return true;
  };
  /** 揺れ（表の shakes）: 前のコマから今のコマの間に来た物を返す */
  S.shakesBetween = function (spec, t0, t1) {
    const out = [];
    for (const s of spec.shakes) if (s[0] > t0 && s[0] <= t1) out.push(s);
    return out;
  };

  // ---------------------------------------------------------------- 見た記録（2 回目からは短く。セーブごと）
  function seenSet() {
    const G = R.Game;
    if (!G || !G.vars) return null;
    const raw = typeof G.vars.fx_seen === 'string' ? G.vars.fx_seen : '';
    if (S._seenRaw !== raw || !S._seen) { S._seenRaw = raw; S._seen = new Set(raw ? raw.split(',') : []); }
    return S._seen;
  }
  S.seen = function (sid) { const s = seenSet(); return !!(s && s.has(String(sid).replace(/^sq:/, ''))); };
  S.markSeen = function (sid) {
    const s = seenSet();
    const k = String(sid).replace(/^sq:/, '');
    if (!s || s.has(k)) return;
    s.add(k);
    R.Game.vars.fx_seen = S._seenRaw = [...s].join(',');
  };
  /** 2 回目からの縮め方（1 = そのまま） */
  S.rateFor = function (spec, seen) {
    if (!seen || !spec) return 1;
    return spec.tier >= 5 ? 1.55 : spec.tier === 4 ? 1.25 : 1;
  };
})(window.RPG);
