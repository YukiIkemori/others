// BEAST: 魔物の原画（画像）から hd:mon / hd:boss の Sheet を作る（design/art_ref/MONSTER_REQUEST.md → sprite_pipe/tools/mon_pack.py の出力）。
//   v2/assets/monsters/<sprite>.png＋.json（ビルドが RPG_MEDIA.monsters['<sprite>'] = {url, meta} にする）。
//   ボスの別の姿・構え: <sprite>@<pose>.png（pose = tele・attack・p2・p2_tele・p2_attack …、基準点は元の絵と同じ意味）。
// 画像がある sprite は画像から、無い sprite は今までどおりコードで描く（R.Beast.bakeMon・bakeBoss・bakeRare を包む）。
// 1 枚の絵から作る物:
//   待機 2（2 枚目は胴を 1 画素ちぢめる呼吸）・攻撃 1（前へ傾いて踏み込む）・被弾 1（後ろへのけぞる）、ボスは予告 tele 2（身をかがめる、@tele があればそれ）。
//   段の上の魔物（組み立て表の色替え＋部品）: 画素の色を鍵と同じ式で回し、部品（parts.js）を原画の点に合わせて重ね、段 2 以上は少し大きく（Scale2x から縮める）。
//   金色の個体: 画素の明るさを金の段へ（R.Beast.goldKeys と同じ段）。
//   失う物: 素材ごとの「fixed」（目の色も一緒に回る）、仕上げの filter（prism・chrome など。コードの絵にも未実装）、まだ無い部品。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const IMG = (BZ.IMG = BZ.IMG || {});

  const table = () => {
    const M = (R.Media && R.Media.table && R.Media.table()) || (typeof window !== 'undefined' && window.RPG_MEDIA) || {};
    return M.monsters || {};
  };
  IMG.table = table;
  IMG.meta = (sp) => { const e = table()[sp]; return (e && e.meta) || null; };
  IMG.has = (sp) => !!table()[sp];

  // 段の上の魔物 → 元の絵（meta.alsoMakes）
  let byVariant = null;
  IMG.baseOf = function (id) {
    if (IMG.has(id)) return id;
    if (!byVariant) {
      byVariant = {};
      const t = table();
      for (const k of Object.keys(t)) { const m = t[k] && t[k].meta; if (m && !m.pose) for (const v of m.alsoMakes || []) byVariant[v] = k; }
    }
    return byVariant[id] || null;
  };

  /** 画像の読み込み。→ rec（ready で使える）| null（画像なし） */
  IMG.rec = function (sp) {
    if (!IMG.has(sp) || !R.Media || !R.Media.image || typeof Image === 'undefined') return null;
    return R.Media.image(sp, 'monsters');
  };
  /** 全部の原画を読む（起動時）。→ Promise */
  let readyP = null;
  IMG.preload = function () {
    if (readyP) return readyP;
    if (!R.Media || !R.Media.preload || typeof Image === 'undefined') return (readyP = Promise.resolve(0));
    readyP = R.Media.preload('monsters').then(async (n) => {
      // 読み込み中に焼こうとして null（後でまた）にした物・コードの絵で焼いた物を忘れる
      for (const k of R.Hd.keys ? R.Hd.keys('hd:mon:').concat(R.Hd.keys('hd:boss:')) : []) {
        const id = k.split(':')[2];
        if (IMG.src(id) && R.Hd.forget) R.Hd.forget(k);
      }
      const F = R.Hd._s && R.Hd._s.failed;
      if (F) for (const ck of Array.from(F.keys())) if (/^hd:(mon|boss):/.test(ck)) F.delete(ck);
      return n;
    });
    return readyP;
  };
  BZ.imgReady = IMG.preload;
  if (R.onBoot) R.onBoot(function () { return IMG.preload(); });

  /** id（魔物データの sprite）→ {base: 画像の sprite, id, stage, variant, parts} | null */
  IMG.src = function (id) {
    const base = IMG.baseOf(id);
    if (!base) return null;
    const m = /_(\d+)$/.exec(id), mb = /_(\d+)$/.exec(base);
    const stage = m ? +m[1] : 1, stage0 = mb ? +mb[1] : 1;
    if (base === id) return { base, id, stage, grow: 1, variant: null, parts: [] };
    const row = BZ.COMPOSE_TABLE && BZ.COMPOSE_TABLE[id];
    const fix = (BZ.V2_FIX && BZ.V2_FIX[id]) || {};
    const mv = (IMG.meta(base).variants || {})[id] || {};
    const variant = 'variant' in fix ? fix.variant : row ? row[1] : mv.recolor || null;
    const parts = ((row && row[2]) || (mv.addons || []).map((a) => [a, {}])).filter(([p]) => BZ.PARTS && BZ.PARTS[p]);
    const grow = Math.min(1.24, 1 + 0.07 * Math.max(0, stage - stage0));
    return { base, id, stage, grow, variant, parts, lostParts: ((row && row[2]) || []).filter(([p]) => !(BZ.PARTS && BZ.PARTS[p])).map((p) => p[0]) };
  };

  // ------------------------------------------------------------------ 画素
  const hex = (h) => BZ.color.hex(h);
  const mk = (w, h) => BZ.mkCanvas(w, h);
  function dataOf(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); }
  function canvasOf(id) { const c = mk(id.width, id.height); c.getContext('2d').putImageData(id, 0, 0); return c; }

  /** 画素の色を回す（BZ.shiftKeys と同じ式。色ごとに覚える） */
  function recolor(id, v) {
    if (!v || (!v.hue && v.sat == null && v.bri == null)) return id;
    const { rgb2hsl, hsl2rgb } = BZ.color, d = id.data, memo = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let o = memo.get(k);
      if (!o) {
        const [h, s, l] = rgb2hsl([d[i], d[i + 1], d[i + 2]]);
        // 灰・白・黒に近い画素（目の白・輪郭・つや）はあまり回さない（コードの絵の「fixed」の代わり）
        const w = Math.max(0, Math.min(1, (s - 0.08) / 0.25)) * (l < 0.1 ? 0.4 : 1);
        const sm = v.sat == null ? 1 : 1 + (v.sat - 1) * Math.max(w, 0.5);
        o = hsl2rgb(h + (v.hue || 0) * w, Math.min(1, s * sm), Math.min(0.97, l * (v.bri == null ? 1 : v.bri))).map((x) => Math.max(0, Math.min(255, Math.round(x))));
        memo.set(k, o);
      }
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
    }
    return id;
  }
  // 金色（BZ.goldKeys と同じ段）
  const GOLD = ['#2a1206', '#5a2c0c', '#8c5418', '#c08a2c', '#e8bc4c', '#f8e090', '#fff8d8'];
  function gold(id) {
    const G = GOLD.map(hex), d = id.data, memo = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let o = memo.get(k);
      if (!o) {
        const lu = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
        const t = Math.min(1, Math.pow(lu, 0.85) * 1.12) * (G.length - 1), j = Math.min(G.length - 2, Math.floor(t)), f = t - j;
        o = [0, 1, 2].map((q) => Math.round(G[j][q] + (G[j + 1][q] - G[j][q]) * f));
        memo.set(k, o);
      }
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
    }
    return id;
  }
  /** Scale2x（EPX）: 画素の形を保って 2 倍 */
  function scale2x(id) {
    const W = id.width, H = id.height, s = new Uint32Array(id.data.buffer.slice(0)), out = new ImageData(W * 2, H * 2), o = new Uint32Array(out.data.buffer);
    const at = (x, y) => s[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      const i = y * 2 * W * 2 + x * 2;
      o[i] = e0; o[i + 1] = e1; o[i + W * 2] = e2; o[i + W * 2 + 1] = e3;
    }
    return out;
  }
  /** 大きさを k 倍（k > 1 は Scale2x してから最近傍で縮める）。→ {id, k: 実際の倍率} */
  function grow(id, k) {
    if (Math.abs(k - 1) < 0.01) return { id, kx: 1, ky: 1 };
    const src = scale2x(id), W2 = Math.round(id.width * k), H2 = Math.round(id.height * k), out = new ImageData(W2, H2);
    const s = new Uint32Array(src.data.buffer), o = new Uint32Array(out.data.buffer);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x + 0.5) / W2 * src.width)), sy = Math.min(src.height - 1, Math.floor((y + 0.5) / H2 * src.height));
      o[y * W2 + x] = s[sy * src.width + sx];
    }
    return { id: out, kx: W2 / id.width, ky: H2 / id.height };
  }
  /**
   * 画素をずらす変形（最近傍）: 出る画素 (x, y) ← 元の (x − dx(y) , y0 + (y − y0) / sy)。
   * 足元の行 fy を軸に、縦の縮み sy・横の広がり sx（中心 cx）・傾き lean（足元から上へ 1 行ごとに lean 画素前へ）・平行移動 tx, ty
   */
  function warp(id, o) {
    const W = id.width, H = id.height, pad = o.pad || 0, W2 = W + pad * 2, H2 = H + pad * 2;
    const out = new ImageData(W2, H2), s = new Uint32Array(id.data.buffer), d = new Uint32Array(out.data.buffer);
    const sy = o.sy || 1, sx = o.sx || 1, fy = o.fy, cx = o.cx, lean = o.lean || 0, tx = o.tx || 0, ty = o.ty || 0;
    for (let y = 0; y < H2; y++) {
      const yy = y - pad - ty;                                   // 元の画像の行（ずらす前）
      const ys = Math.round(fy + (yy - fy) / sy);
      if (ys < 0 || ys >= H) continue;
      const off = lean * (fy - ys);
      for (let x = 0; x < W2; x++) {
        const xx = x - pad - tx - off;
        const xs = Math.round(cx + (xx - cx) / sx);
        if (xs < 0 || xs >= W) continue;
        d[y * W2 + x] = s[ys * W + xs];
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ 部品（parts.js）を原画の点に合わせる
  /** 元のコードの土台の点（モデル座標）と外形。無ければ null */
  function codePts(src) {
    const row = BZ.COMPOSE_TABLE && BZ.COMPOSE_TABLE[src.id];
    const base = row && BZ.BASES && BZ.BASES[row[0]];
    if (!base) return null;
    try {
      const RZ = BZ.rz(), B = new RZ.Builder(), P = BZ.palette(base.pal, {});
      const pts = base.draw(B, P, { t: 0, stage: 1 }, RZ) || {};
      return { pts, box: BZ.modelBox(B), fly: !!base.fly };
    } catch (e) { return null; }
  }
  /** 原画の点（画像の px、左上が 0）→ 描く点を原点にした px */
  const rel = (p, a) => [p[0] - a[0], p[1] - a[1]];
  function partsLayer(src, meta, anchor, k, st, golden) {
    if (!src.parts.length || !BZ.PARTS) return null;
    const RZ = BZ.rz(), ST = BZ.style(), cp = codePts(src);
    // 画像の外形（描く点が原点、px）
    const iw = meta.w, ih = meta.h, ib = { x0: -anchor[0], y0: -anchor[1], x1: iw - anchor[0], y1: ih - anchor[1] };
    // モデルの単位 → px の倍率 u: コードの絵の外形の高さを原画の高さに合わせる
    let u = 1, map = (p) => p;
    const pts = { u: 1, z: 2 };
    if (cp) {
      const mb = cp.box, mh = Math.max(1, (cp.fly ? mb.y1 - mb.y0 : -mb.y0));
      const hImg = cp.fly ? ib.y1 - ib.y0 : -ib.y0;
      u = Math.max(0.5, hImg / mh);
      const mcx = (mb.x0 + mb.x1) / 2, icx = (ib.x0 + ib.x1) / 2 / u;
      const mcy = (mb.y0 + mb.y1) / 2, icy = (ib.y0 + ib.y1) / 2 / u;
      map = (p) => [p[0] - mcx + icx, cp.fly ? p[1] - mcy + icy : p[1]];
      for (const [key, v] of Object.entries(cp.pts)) {
        if (!Array.isArray(v)) { pts[key] = v; continue; }
        if (key === 'body' || key === 'shell' || key === 'cap') pts[key] = map(v).concat(v.slice(2));
        else if (key === 'eyes') pts[key] = v.map((e) => map(e).concat(e.slice(2)));
        else if (key === 'spine' || key === 'thornLines') pts[key] = key === 'spine' ? v.map(map) : v.map((ln) => ln.map(map));
        else if (key === 'stinger') pts[key] = [map(v[0]), v[1]];
        else if (v.length === 2 && typeof v[0] === 'number') pts[key] = map(v);
      }
    }
    // 原画の点で上書き（mon_pack.py の測った点と configs/mon_overrides.json の手で置いた点。画像の px）
    const P = meta.points || {};
    const toM = (p) => { const r = rel(p, anchor); return [r[0] / u, r[1] / u]; };
    for (const [key, v] of Object.entries(P)) {
      if (!Array.isArray(v)) continue;
      if (key === 'body' || key === 'shell' || key === 'cap') pts[key] = toM(v).concat(v.slice(2).map((x) => x / u));
      else if (key === 'eyes') pts[key] = v.map((e) => toM(e).concat(e.slice(2).map((x) => x / u)));
      else if (key === 'spine') pts[key] = v.map(toM);
      else if (key === 'thornLines') pts[key] = v.map((ln) => ln.map(toM));
      else if (key === 'stinger') pts[key] = [toM(v[0]), v[1]];
      else if (v.length === 2 && typeof v[0] === 'number') pts[key] = toM(v);
    }
    pts.u = (cp && cp.pts.u) || 1;
    const B = new RZ.Builder();
    for (const [name, po] of src.parts) BZ.PARTS[name](B, pts, po || {}, { P: {}, st, golden: !!golden, RZ });
    if (!B.p.some((p) => !p.mod)) return null;
    const r = RZ.render(B, { scale: u * k, light: BZ.light(), tones: ST.tones, sat: ST.sat, olMix: ST.olMix, tint: ST.tint, pad: 2 });
    BZ.finish(r.canvas);
    return r;
  }

  // ------------------------------------------------------------------ Sheet
  const BOSS_POSES = ['tele', 'attack', 'hit'];
  /** 1 枚の絵（ImageData）と基準点から、ポーズのコマを作る */
  function framesFrom(id0, anchor, meta, o) {
    const fly = !!o.fly, H = id0.height, W = id0.width, pad = Math.max(4, Math.round(Math.max(W, H) * 0.06));
    const fy = fly ? Math.round(H * 0.5) : anchor[1], cx = anchor[0];
    const mkF = (id, tx, ty) => ({ c: canvasOf(id), ox: anchor[0] + pad + (tx || 0), oy: anchor[1] + pad + (ty || 0) });
    const lean = Math.max(0.03, Math.min(0.12, 6 / Math.max(20, H)));
    const out = {
      idleA: mkF(warp(id0, { pad, fy, cx })),
      idleB: mkF(fly ? warp(id0, { pad, fy, cx, ty: -2 }) : warp(id0, { pad, fy, cx, sy: 1 - 1 / Math.max(12, H), sx: 1 + 0.5 / Math.max(12, W) })),
      attack: mkF(fly ? warp(id0, { pad, fy, cx, tx: Math.round(W * 0.06), ty: 2, lean: lean * 0.5 }) : warp(id0, { pad, fy, cx, lean, tx: Math.round(W * 0.04) })),
      hit: mkF(fly ? warp(id0, { pad, fy, cx, tx: -Math.round(W * 0.04), ty: -2, lean: -lean * 0.5 }) : warp(id0, { pad, fy, cx, lean: -lean * 0.8, tx: -Math.round(W * 0.03) })),
      teleA: mkF(warp(id0, { pad, fy, cx, sy: 0.94, sx: 1.03, lean: -lean * 0.5, tx: -Math.round(W * 0.02) })),
      teleB: mkF(warp(id0, { pad, fy, cx, sy: 0.92, sx: 1.04, lean: -lean * 0.6, tx: -Math.round(W * 0.025) })),
    };
    return out;
  }

  /**
   * 焼く（同期）。id = 魔物データの sprite（hd:mon:<id>・hd:boss:<id> の id）。画像が無ければ undefined、読み込み中なら null
   */
  IMG.bake = function (id, opts, kind) {
    const src = IMG.src(id);
    if (!src) return undefined;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    opts = opts || {};
    const rec = IMG.rec(src.base);
    if (!rec) return undefined;
    if (!rec.ready) { IMG.preload(); return null; }
    const meta = IMG.meta(src.base);
    const boss = kind === 'boss' || meta.kind === 'boss' || meta.size === 'B';
    const fly = !!meta.fly;
    const load = (sp) => {
      const r = IMG.rec(sp);
      if (!r || !r.ready) return null;
      const c = mk(r.img.naturalWidth || r.img.width, r.img.naturalHeight || r.img.height);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(r.img, 0, 0);
      return dataOf(c);
    };
    // 1 つの絵（元・別の姿）を色替え・部品・大きさ・金色まで仕上げる → {id, anchor, meta}
    const finish = (sp) => {
      const m = IMG.meta(sp);
      let d = load(sp);
      if (!d || !m) return null;
      let anchor = m.anchor.slice();
      if (src.variant) d = recolor(d, src.variant);
      if (src.parts.length) {
        const r = partsLayer(src, m, anchor, 1, { t: 0, stage: src.stage }, opts.golden);
        if (r) {
          // 部品の絵を重ねる（はみ出す分だけ広げる）
          const px = anchor[0] - r.ox, py = anchor[1] - r.oy;
          const x0 = Math.min(0, px), y0 = Math.min(0, py), x1 = Math.max(d.width, px + r.canvas.width), y1 = Math.max(d.height, py + r.canvas.height);
          const c = mk(x1 - x0, y1 - y0), g = c.getContext('2d');
          g.putImageData(d, -x0, -y0);
          g.drawImage(r.canvas, px - x0, py - y0);
          d = dataOf(c);
          anchor = [anchor[0] - x0, anchor[1] - y0];
        }
      }
      if (src.grow !== 1) {
        const gr = grow(d, src.grow);
        d = gr.id;
        anchor = [Math.round(anchor[0] * gr.kx), Math.round(anchor[1] * gr.ky)];
      }
      if (opts.golden) d = gold(d);
      return { id: d, anchor, meta: m, k: src.grow };
    };
    const main = finish(src.base);
    if (!main) return null;
    const F = framesFrom(main.id, main.anchor, main.meta, { fly });
    const frames = [], poses = {};
    const add = (pose, f) => { frames.push(f); (poses[pose] = poses[pose] || []).push(frames.length - 1); };
    add('idle', F.idleA); add('idle', F.idleB); add('attack', F.attack); add('hit', F.hit);
    const posesAvail = [];
    if (boss) {
      // 別の絵（@tele・@attack・@hit、第 2 の姿 @p2・@p2_tele…）
      const alt = {};
      for (const k of Object.keys(table())) if (k.indexOf(src.base + '@') === 0) alt[k.slice(src.base.length + 1)] = k;
      const altFrames = (name) => { const a = alt[name] && finish(alt[name]); return a ? framesFrom(a.id, a.anchor, a.meta, { fly }) : null; };
      const tele = altFrames('tele');
      if (tele) { add('tele', tele.idleA); add('tele', tele.idleB); posesAvail.push('tele'); } else { add('tele', F.teleA); add('tele', F.teleB); }
      const atk = altFrames('attack');
      if (atk) { poses.attack = []; add('attack', atk.idleA); posesAvail.push('attack'); }
      // 段階の姿（@p2・@p3…、段階の数は BATTLE の phases。その段階の予告・攻撃 @p2_tele・@p2_attack も）
      for (let n = 2; n <= 4; n++) {
        const pn = altFrames('p' + n);
        if (!pn) continue;
        const s = '_p' + n;
        add('idle' + s, pn.idleA); add('idle' + s, pn.idleB); add('attack' + s, pn.attack); add('hit' + s, pn.hit);
        const tn = altFrames('p' + n + '_tele');
        if (tn) { add('tele' + s, tn.idleA); add('tele' + s, tn.idleB); } else { add('tele' + s, pn.teleA); add('tele' + s, pn.teleB); }
        const an = altFrames('p' + n + '_attack');
        if (an) { poses['attack' + s] = []; add('attack' + s, an.idleA); }
        posesAvail.push('p' + n);
      }
      // 段階の絵が 2 のあとに無い段階（p3 だけ無いなど）は前の段階の絵を使う
      for (let n = 3; n <= 4; n++) for (const ps of ['idle', 'attack', 'hit', 'tele']) if (!poses[ps + '_p' + n] && poses[ps + '_p' + (n - 1)]) poses[ps + '_p' + n] = poses[ps + '_p' + (n - 1)];
    }
    // 基準点（描く点からの相対）
    const pt = (p) => (p ? { x: (p[0] - main.meta.anchor[0]) * main.k, y: (p[1] - main.meta.anchor[1]) * main.k } : null);
    const P = main.meta.points || {};
    const anchors = { feet: { x: 0, y: 0 } };
    for (const k of ['head', 'center', 'fx', 'top', 'eye', 'mouth', 'back']) if (P[k] && P[k].length === 2 && typeof P[k][0] === 'number') anchors[k] = pt(P[k]);
    if (!anchors.center) anchors.center = { x: 0, y: -main.id.height / 2 };
    if (!anchors.head) anchors.head = { x: anchors.center.x + 2, y: -main.id.height * 0.8 };
    if (anchors.head.x <= anchors.center.x) anchors.head.x = anchors.center.x + 1;   // 右向き（頭は胴より前）
    if (!anchors.fx) anchors.fx = { x: anchors.center.x + 2, y: anchors.center.y };
    for (const f of frames) f.anchors = anchors;
    // 外形（1 コマ目）
    const box = BZ.finish(frames[0].c);
    for (let i = 1; i < frames.length; i++) BZ.finish(frames[i].c);
    const f0 = frames[0];
    const tier = boss ? 'boss' : ({ S: 's', M: 'm', L: 'l' })[main.meta.size] || 'm';
    const T = main.meta.target || {};
    // 段（MONSTER_REQUEST §2.4 の体の長い辺）。翼・尾・触角は 1.3 倍まで（mon_pack.py の上限）、段の上の魔物は大きくした分と部品の分も
    const b0 = main.meta.size === 'B' ? [(T.long || 150) * 0.9, (T.long || 150) * 1.12] : ({ S: [48, 56], M: [72, 84], L: [100, 120] })[main.meta.size] || [40, 140];
    const band = [Math.round(b0[0] * 0.9), Math.round(b0[1] * (main.meta.size === 'B' ? 1 : 1.3) * src.grow + (src.parts.length ? 6 : 0))];
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return {
      frames, poses,
      fps: boss ? { idle: 2, tele: 5, attack: 6, hit: 6 } : { idle: 2.2, tele: 4, attack: 6, hit: 6 },
      anchors: Object.assign({}, anchors),
      w: box.w, h: Math.round(f0.oy - box.y),
      meta: {
        kind: boss ? (meta.kind === 'add' ? 'mon' : 'boss') : 'mon', id, base: src.base, stage: src.stage, tier, fly, golden: !!opts.golden, img: true,
        visH: box.h, top: Math.round(box.y - f0.oy), left: Math.round(box.x - f0.ox), right: Math.round(box.x + box.w - f0.ox), facing: 'right',
        long: Math.max(box.w, box.h), band, targetPx: Math.round(T.h || box.h), bakeMs: Math.round(ms * 10) / 10, frames: frames.length,
        altPoses: posesAvail, lostParts: src.lostParts || [], focus: 'eye',
      },
    };
  };
  /** R.Hd の factory 用（切れ端の仕事の形。画素の仕事は 1 回で済む大きさ） */
  IMG.job = function (id, opts, kind) {
    return BZ.job(function* () { return IMG.bake(id, opts, kind); }, kind === 'boss' ? 'boss' : 'mon');
  };

  // ------------------------------------------------------------------ 包む（ファイルの読み込み順に依らないよう、呼ばれた時に元を探す）
  const wrap = (name, kind) => {
    const orig = BZ[name];
    if (!orig || orig._img) return;
    const w = function (id, opts, asJob) {
      const s = IMG.src(id);
      if (s && IMG.rec(s.base)) return asJob ? IMG.job(id, opts, kind) : IMG.bake(id, opts, kind);
      return orig.apply(this, arguments);
    };
    w._img = true;
    BZ[name] = w;
  };
  /** core.js の R.onData の登録の直前に呼ばれる: 包む・画像だけの魔物（コードの絵が無い）のキーを積む */
  BZ.imgPending = function () {
    wrap('bakeMon', 'mon'); wrap('bakeRare', 'mon'); wrap('bakeBoss', 'boss');
    const have = new Set(BZ.keyList());
    const push = (key, fn, meta) => { if (!have.has(key)) { have.add(key); (BZ._pending = BZ._pending || []).push([key, fn, meta]); } };
    const t = table();
    for (const sp of Object.keys(t)) {
      const m = t[sp] && t[sp].meta;
      if (!m || m.pose || !/^[a-z0-9_]+$/.test(sp)) continue;
      const boss = m.kind === 'boss';
      push((boss ? 'hd:boss:' : 'hd:mon:') + sp, (opts) => IMG.job(sp, opts, boss ? 'boss' : 'mon'), { kind: boss ? 'boss' : 'mon', owner: 'BEAST', img: true });
      if (m.kind === 'add') push('hd:boss:' + sp, (opts) => IMG.job(sp, opts, 'boss'), { kind: 'boss', owner: 'BEAST', img: true });
      for (const v of m.alsoMakes || []) if (/^[a-z0-9_]+$/.test(v)) push('hd:mon:' + v, (opts) => IMG.job(v, opts, 'mon'), { kind: 'mon', owner: 'BEAST', img: true });
    }
  };
})(window.RPG);
