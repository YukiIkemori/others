// TERRAIN / BEAST: 描いた地形・物・建物・戦闘背景の画像（v2/assets/env、v2/design/ENV_ASSETS.md）。
// ビルドが RPG_MEDIA.env['<theme>/<sub>/<name>@<tile>'] = {url, meta} にした物を起動のときに読み、コードで描く絵の代わりに使う。
// 画像が無い（node のテスト・読めなかった・その id が無い）ときは何も返さず、呼ぶ側はコードで描く絵のまま（控え）。
//
//   T.Env.ready                      画像を読み終えたか
//   T.Env.mat(id, tile) → {S, px}    素材の 1 枚（周期 S px の正方形。Uint32Array。S は 4 マスとは限らない＝8 マスで 256）
//   T.Env.face(style, tile, h) → {S, H, px}   立ち上がりの面（上の縁＋中＋根元の帯を h マスの高さに組む）
//   T.Env.prop(id, v, o) → {img, j}  物の画像（変化 v。tree は o.leaf === 'moss' で苔の木）
//   T.Env.bld(defId) → {img:{tile:Image}, emit:{tile:Image}, j}   建物（地図の建物 id ごと。無ければ def.art の汎用の建物）
//   T.Env.bbg(id) → {img:{layer:Image}, j}                           戦闘背景（back ground front post と _tall）
//   T.Env.meanColor(id) → css | null 素材の代表の色（小地図・地図）
//   T.Env.under(key, tile) → {img, k, j} | null   マップ 1 枚の描いた下絵（使う時に読む。読めるまで null、読めたら今のマップのチャンクを焼き直す）（'<theme>/under/<name>'。map.art.image・overlay・emit が指す。
//                                    k = tile / 画像のマスの大きさ。j = <name>.json の meta: windows32 など）
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  const E = (T.Env = T.Env || { ready: false });
  const TILES = [24, 32, 40];
  let idx = null;   // {mat:{id:{t:key}}, face:{style:{t:key}}, prop:{id:{t:key}}, bld:{id:{t:key, emit:{t:key}}}, bbg:{id:{layer:key}}, meta:{key:meta}}

  function table() { return (R.Media && R.Media.table && R.Media.table().env) || {}; }
  function build() {
    const t = table(), out = { mat: {}, face: {}, prop: {}, bld: {}, bbg: {}, under: {}, meta: {} };
    for (const key of Object.keys(t)) {
      const parts = key.split('/'), meta = t[key].meta || {};
      out.meta[key] = meta;
      if (parts[0] === 'bbg') { const b = (out.bbg[parts[1]] = out.bbg[parts[1]] || {}); b[parts[2]] = key; continue; }
      const sub = parts[1], name = parts[2] || '';
      if (sub === 'under') { const mu = /^(.*)@(\d+)$/.exec(name); if (mu) { const uk = parts[0] + '/under/' + mu[1]; (out.under[uk] = out.under[uk] || {})[+mu[2]] = key; } continue; }
      const m = /^(.*?)(_emit)?@(\d+)$/.exec(name);
      if (!m) continue;
      const id = m[1], tile = +m[3];
      if (sub === 'mat') {
        if (/^face_/.test(id)) { const st = id.slice(5); (out.face[st] = out.face[st] || {})[tile] = key; }
        else (out.mat[id] = out.mat[id] || {})[tile] = key;
      } else if (sub === 'props') (out.prop[id] = out.prop[id] || {})[tile] = key;
      else if (sub === 'bld') {
        const b = (out.bld[id] = out.bld[id] || { emit: {} });
        if (m[2]) b.emit[tile] = key; else b[tile] = key;
      }
    }
    // 変化: <base>_v<n>（<base> そのものは v0）
    out.variants = {};
    for (const id of Object.keys(out.prop)) {
      const mv = /^(.*)_v(\d+)$/.exec(id), base = mv ? mv[1] : id, v = mv ? +mv[2] : 0;
      (out.variants[base] = out.variants[base] || [])[v] = id;
    }
    for (const b of Object.keys(out.variants)) out.variants[b] = out.variants[b].filter(Boolean);
    return out;
  }
  function I() { return idx || (idx = build()); }
  function img(key) {
    if (!key || !R.Media || !R.Media.image) return null;
    const r = R.Media.image(key, 'env');
    return r && r.ready ? r.img : null;
  }
  const cv = (w, h) => (T._u && T._u.canvas ? T._u.canvas(w, h) : R.Hd.RZ.canvas(w, h));
  function pxOf(image, w, h, sx, sy, sw, sh) {
    const c = cv(w, h), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(image, sx || 0, sy || 0, sw || image.width, sh || image.height, 0, 0, w, h);
    return new Uint32Array(g.getImageData(0, 0, w, h).data.buffer);
  }
  /** tile の画像が無ければ 32 の画像を最近傍で拡大縮小 */
  function pickTile(keys, tile) {
    if (!keys) return null;
    if (keys[tile]) { const im = img(keys[tile]); if (im) return { im, k: 1 }; }
    const im = img(keys[32]);
    return im ? { im, k: tile / 32 } : null;
  }

  E.has = function (kind, id) { if (!E.ready) return false; const x = I()[kind]; return !!(x && x[id]); };
  E.metaOf = function (key) { return I().meta[key] || null; };

  const matCache = {};
  E.mat = function (id, tile) {
    if (!E.ready) return null;
    const ck = id + '|' + tile;
    if (ck in matCache) return matCache[ck];
    const p = pickTile(I().mat[id], tile);
    if (!p) return (matCache[ck] = null);
    const S = Math.round(p.im.width * p.k);
    if (R.Hd && R.Hd.track) R.Hd.track('chunk', 'terrain:envmat:' + ck, S * S * 4);
    return (matCache[ck] = { S, px: pxOf(p.im, S, S) });
  };
  const faceCache = {};
  E.face = function (style, tile, h) {
    if (!E.ready) return null;
    const ck = style + '|' + tile + '|' + h;
    if (ck in faceCache) return faceCache[ck];
    const keys = I().face[style], p = pickTile(keys, tile);
    if (!p) return (faceCache[ck] = null);
    const j = E.metaOf(keys[32] || keys[tile]) || {};
    const S = Math.round(p.im.width * p.k), full = Math.round(p.im.height * p.k), H = tile * h;
    const foot = Math.min(Math.round((j.foot32 || 10) * tile / 32), H >> 1);
    const c = cv(S, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const top = Math.min(H - foot, full - foot);
    g.drawImage(p.im, 0, 0, p.im.width, top / p.k, 0, 0, S, top);
    if (H - foot > top) g.drawImage(p.im, 0, (full - foot - (H - foot - top)) / p.k, p.im.width, (H - foot - top) / p.k, 0, top, S, H - foot - top);
    g.drawImage(p.im, 0, (full - foot) / p.k, p.im.width, foot / p.k, 0, H - foot, S, foot);
    return (faceCache[ck] = { S, H, px: new Uint32Array(g.getImageData(0, 0, S, H).data.buffer) });
  };
  /** 物: base id と変化 → {id, im, k, j}（j = meta: frames, cell, feet, light32） */
  E.prop = function (base, v, o) {
    if (!E.ready) return null;
    const X = I();
    let list = X.variants[base];
    if (base === 'tree' && o && o.leaf === 'moss' && X.variants.tree_moss) list = X.variants.tree_moss;
    if (!list || !list.length) return null;
    const id = list[(((v | 0) % list.length) + list.length) % list.length];
    const tile = Math.round(((o && o.s) || 1) * 32), keys = X.prop[id], p = pickTile(keys, tile);
    if (!p) return null;
    const j = E.metaOf(keys[32] || keys[tile]) || {};
    return { id, im: p.im, k: p.k, tile: keys[tile] ? tile : 32, j };
  };
  E.propIds = function () { return E.ready ? Object.keys(I().variants) : []; };
  E.bld = function (def) {
    if (!E.ready || !def) return null;
    const X = I(), id = X.bld[def.id] ? def.id : def.art && X.bld[def.art] ? def.art : null;
    if (!id) return null;
    const b = X.bld[id];
    return { id, b, j: E.metaOf(b[32]) || {}, img: (t) => pickTile(b, t), emit: (t) => pickTile(b.emit, t) };
  };
  E.bbg = function (id) {
    if (!E.ready) return null;
    const b = I().bbg[id];
    if (!b || !b.back) return null;
    const out = { j: E.metaOf(b.back) || {}, layer: (name) => img(b[name]) };
    return out.layer('back') ? out : null;
  };
  /** 描いた下絵（マップ 1 枚）: 32 の絵の meta も返す（_emit・_over は meta を持たないので本体の名前で引く） */
  // 下絵は使う時に読む（E.under が null を返すあいだ、チャンクはタイルで焼く。読めたら今のマップの物ならチャンクを焼き直す）
  const underLoad = {};
  function loadUnder(k) {
    if (underLoad[k] || !R.Media || !R.Media.preload) return underLoad[k] || null;
    underLoad[k] = Promise.resolve(R.Media.preload('env', [k])).then(() => {
      const r = R.Media.image(k, 'env'); return r && r.ready && r.img && r.img.decode ? r.img.decode().catch(() => null) : null;
    }).catch(() => null).then(() => {
      try {
        const F = R.Field, m = F && F._s && F._s.map, a = m && m.art;
        if (a && [a.image, a.overlay, a.emit, a.closed].some((x) => x && k.indexOf(x + '@') === 0) && F.chunks && F.chunks.reset) F.chunks.reset();
      } catch (e) { /* 焼き直せなくても次に入ったときに使う */ }
    });
    return underLoad[k];
  }
  /** 下絵の本体と、その層（_emit・_over・_closed）をこのマスの大きさで読んでおく（読めていれば true） */
  function underReady(key, tile) {
    const U = I().under; let ok = true;
    for (const sfx of ['', '_emit', '_over', '_closed']) {
      const keys = U[key + sfx]; if (!keys) continue;
      const k = keys[tile] || keys[32]; if (!k) continue;
      if (!img(k)) { ok = false; loadUnder(k); }
    }
    return ok;
  }
  E.underReady = underReady;
  /** マップ（とその隣のマップ）の下絵を先に読む（map.art）。FIELD の map:enter から */
  E.warmUnder = function (map, tile) {
    if (!E.ready || !map || !map.art || !map.art.image) return;
    underReady(map.art.image.replace(/_(emit|over|closed)$/, ''), tile || 32);
  };
  E.under = function (key, tile) {
    if (!E.ready || !key) return null;
    const keys = I().under[key];
    if (!keys) return null;
    if (!underReady(key.replace(/_(emit|over|closed)$/, ''), tile)) return null;   // 本体と層がそろうまではタイルのまま
    const p = pickTile(keys, tile);
    if (!p) return null;
    const baseKey = key.replace(/_(emit|over|closed)$/, ''), bk = I().under[baseKey];
    return { img: p.im, k: p.k, j: (bk && E.metaOf(bk[32])) || {} };
  };
  const meanCache = {};
  E.meanColor = function (id) {
    if (!E.ready) return null;
    if (id in meanCache) return meanCache[id];
    const s = E.mat(id, 32);
    if (!s) return (meanCache[id] = null);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < s.px.length; i += 7) { const p = s.px[i]; r += p & 255; g += (p >>> 8) & 255; b += (p >>> 16) & 255; n++; }
    return (meanCache[id] = `rgb(${(r / n) | 0},${(g / n) | 0},${(b / n) | 0})`);
  };

  // ------------------------------------------------------------------ 起動のときに読む（読めなかった物はコードの絵のまま）
  R.onBoot(async function () {
    if (!R.Media || !R.Media.preload || typeof Image === 'undefined') return;
    const all = Object.keys(table());
    if (!all.length) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    // 起動で待つのは縦切りの分（共通・序章と森のテーマ・縦切りの戦闘背景）の今のマスの大きさの絵だけ。ほかの地方と別の大きさは後ろで読む
    let tile = 32;
    try { tile = ({ near: 40, normal: 32, far: 24 })[R.Settings.get('fieldZoom')] || 32; } catch (e) { tile = 32; }
    const SLICE = /^(common|harbor|hill_village|treetop|moss_village|tree_inside|lighthouse|cave|forest_dungeon|snow|desert)\//, SLICE_BBG = /^bbg\/(coast|tower|forest|tree|cave|snow|desert)\//;
    // マップ 1 枚の下絵（/under/）は起動でもあとでも読まない: 入ったマップとその隣の分だけ E.under が読む（全部で数百 MB になり、
    // 起動で全部を展開すると Chromium のページが落ちる。2026-09-28）
    const UNDER = /\/under\//;
    const now = all.filter((k) => !UNDER.test(k) && ((SLICE.test(k) && new RegExp('@' + tile + '$').test(k)) || SLICE_BBG.test(k)));
    const later = all.filter((k) => !UNDER.test(k) && now.indexOf(k) < 0);
    const decode = (keys) => Promise.all(keys.map((k) => { const r = R.Media.image(k, 'env'); return r && r.ready && r.img.decode ? r.img.decode().catch(() => null) : null; }));
    // 32 枚ずつ（一度に全部を頼むと、描いた下絵が増えた今は Chromium が ERR_INSUFFICIENT_RESOURCES で落ちる。2026-09-28）
    for (let i = 0; i < now.length; i += 32) {
      const b = now.slice(i, i + 32);
      try { await R.Media.preload('env', b); await decode(b); } catch (e) { /* 読めた物だけ使う */ }
    }
    E.bootMs = Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0); E.bootN = now.length;
    // 残りは少しずつ（12 枚ずつ読み、展開してから次へ）。読み終えたら物の絵を焼き直す（地方の物・別の大きさ）
    E.later = (async () => {
      for (let i = 0; i < later.length; i += 12) {
        const b = later.slice(i, i + 12);
        try { await R.Media.preload('env', b); await decode(b); } catch (e) { /* 読めた物だけ */ }
      }
      idx = null; E.all = true;
      for (const k of Object.keys(matCache)) if (!matCache[k]) delete matCache[k];
      for (const k of Object.keys(faceCache)) if (!faceCache[k]) delete faceCache[k];
      if (R.Hd && R.Hd.keys && R.Hd.forget) for (const k of R.Hd.keys('hd:prop:')) if (T._envProp && T.Env.prop(k.slice(8), 0, {})) R.Hd.forget(k);
    })();
    const keys = all;
    idx = null;
    E.ready = true;
    E.count = keys.length;
    // 先に焼かれた（コードの絵の）物を忘れる
    if (R.Hd && R.Hd.keys && R.Hd.forget) for (const p of ['hd:prop:', 'hd:bld:', 'hd:bbg:', 'hd:secret:']) for (const k of R.Hd.keys(p)) R.Hd.forget(k);
    if (T._envReset) T._envReset();
    if (T._faceReset) T._faceReset();
    // 画像にしかない物の登録（家具・木の変化などの新しい id）。R.DB.props にも足す（CONTENT が置ける）
    if (T._envRegisterProps) T._envRegisterProps();
    // 入ったマップの隣（出口・扉・階段の行き先）の下絵を先に読む
    if (R.on) R.on('map:enter', (e) => {
      try {
        let t = 32; try { t = ({ near: 40, normal: 32, far: 24 })[R.Settings.get('fieldZoom')] || 32; } catch (x) { t = 32; }
        const M = R.DB.maps || {}, m = M[e && e.map]; if (!m) return;
        E.warmUnder(m, t);
        const to = new Set();
        for (const x of m.exits || []) if (x.to && x.to.map) to.add(x.to.map);
        for (const o of m.objects || []) { if (o.to && o.to.map) to.add(o.to.map); if (o.door && o.door.to && o.door.to.map) to.add(o.door.to.map); }
        for (const id of to) E.warmUnder(M[id], t);
      } catch (x) { /* 先読みできなくても入ったときに読む */ }
    });
  });
})(window.RPG);
