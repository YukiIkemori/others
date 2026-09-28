// TERRAIN / BEAST: 描いた地形・物・建物・戦闘背景の画像（v2/assets/env、v2/design/ENV_ASSETS.md）。
// ビルドが RPG_MEDIA.env['<theme>/<sub>/<name>@<tile>'] = {url, meta} にした物を起動のときに読み、コードで描く絵の代わりに使う。
// 画像が無い（node のテスト・読めなかった・その id が無い）ときは何も返さず、呼ぶ側はコードで描く絵のまま（控え）。
//
//   T.Env.ready                      画像を読み終えたか
//   T.Env.mat(id, tile) → {S, px}    素材の 1 枚（周期 S px の正方形。Uint32Array。S は 4 マスとは限らない＝8 マスで 256）
//   T.Env.face(style, tile, h) → {S, H, px}   立ち上がりの面（上の縁＋中＋根元の帯を h マスの高さに組む）
//   T.Env.prop(id, v, o) → {img, j}  物の画像（変化 v。tree は o.leaf === 'moss' で苔の木）
//   T.Env.bld(defId) → {img:{tile:Image}, emit:{tile:Image}, j}   建物（地図の建物 id ごと。無ければ def.art の汎用の建物）
//   T.Env.bbg(id) → {layer(name), j} | null                          戦闘背景（back ground front post と _tall）。使う時に読む（読めるまで null）
//   T.Env.awaitBbg(id, ms) / T.Env.awaitMap(map, tile, ms) → Promise   戦闘背景・マップの下絵を読み終えるまで待つ（上限 ms）
//   T.Env.stats() → {heldMB, n, capMB, evicted}                       使う時に読んだ絵（下絵・戦闘背景）の展開した大きさ（LRU で CAP まで）
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
  // ------------------------------------------------------------------ 使う時に読み、遠い物を手放す（下絵・戦闘背景。2026-09-28）
  // 下絵（/under/）と戦闘背景（bbg/）は起動で読まない（全部を展開すると 1 GB を超え、ページが落ちる）。
  //   下絵: 入るマップの分（本体・_over・_emit・_closed、今のマスの大きさ）を F.enter の暗転の中で待つ（E.awaitMap）。隣のマップは map:enter で先に読む。
  //   戦闘背景: その地方の分を map:enter で先に読み、戦闘の始まりで待つ（E.awaitBbg）。読めるまでに焼いたコードの絵は、読めたら忘れて焼き直す。
  //   展開した大きさ（幅×高さ×4）の合計が CAP を超えたら、使っていない順に手放す（今のマップと待っている物は残す）。
  // 端末のメモリが少ない（navigator.deviceMemory ≤ 4 GB。スマホ）ときは小さく
  const CAP = (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 4 ? 112 : 176) * 1048576;
  const held = new Map();   // key → {bytes, used}
  const loading = {};       // key → Promise<bool>
  const pinned = new Set(); // 待っている間は手放さない
  let useN = 0;
  function curTile() { try { return ({ near: 40, normal: 32, far: 24 })[R.Settings.get('fieldZoom')] || 32; } catch (e) { return 32; } }
  function rec(k) { return R.Media && R.Media.image ? R.Media.image(k, 'env') : null; }
  function touch(k) { const h = held.get(k); if (h) h.used = ++useN; }
  function hold(k) {
    const im = img(k);
    if (!im) return false;
    if (!held.has(k)) held.set(k, { bytes: im.width * im.height * 4, used: ++useN }); else touch(k);
    return true;
  }
  /** 1 枚を読んで展開する → Promise<読めたか> */
  function loadKey(k) {
    if (hold(k)) return Promise.resolve(true);
    if (loading[k]) return loading[k];
    if (!R.Media || !R.Media.preload) return Promise.resolve(false);
    loading[k] = Promise.resolve(R.Media.preload('env', [k])).then(() => {
      const r = rec(k);
      return r && r.ready && r.img && r.img.decode ? r.img.decode().catch(() => null) : null;   // 地図帳の切り出し（canvas）は decode 不要
    }).catch(() => null).then(() => {
      delete loading[k];
      const ok = hold(k);
      if (ok) trim();
      return ok;
    });
    return loading[k];
  }
  const settled = (k) => { const r = rec(k); return !r || r.ready || r.failed; };
  /** マップの今のマスの大きさの層の key（本体・_emit・_over・_closed と map.art が指す物） */
  function mapKeys(map, tile) {
    const a = map && map.art, out = [];
    if (!E.ready || !a || !a.image) return out;
    const U = I().under, base = a.image.replace(/_(emit|over|closed)$/, '');
    const names = new Set([base, base + '_emit', base + '_over', base + '_closed']);
    for (const f of ['overlay', 'emit', 'closed']) if (a[f]) names.add(a[f]);
    for (const n of names) { const keys = U[n]; if (!keys) continue; const k = keys[tile] || keys[32]; if (k) out.push(k); }
    return out;
  }
  function curMap() { const F = R.Field; return F && F._s ? F._s.map : null; }
  function release(k) {
    const im = img(k);
    held.delete(k);
    if (T._underForget && im) T._underForget(im);   // TERRAIN のチャンクが覚えた下絵も
    if (R.Media.release) R.Media.release(k, 'env');
    E.evicted = (E.evicted || 0) + 1;
  }
  function trim() {
    let total = 0;
    for (const h of held.values()) total += h.bytes;
    if (total <= CAP) return;
    const keep = new Set(pinned);
    const m = curMap();
    if (m) for (const k of mapKeys(m, curTile())) keep.add(k);
    const list = [...held.entries()].filter(([k]) => !keep.has(k) && !loading[k]).sort((a, b) => a[1].used - b[1].used);
    for (const [k, h] of list) { if (total <= CAP) break; release(k); total -= h.bytes; }
  }
  function timeout(ms) { return R.wait && R.Engine && R.Engine.running ? R.wait(ms) : new Promise((res) => setTimeout(res, ms)); }
  function waitAll(keys, ms) {
    if (!keys.length) return Promise.resolve(true);
    for (const k of keys) pinned.add(k);
    const all = Promise.all(keys.map(loadKey)).then((r) => r.every(Boolean));
    return Promise.race([all, timeout(ms || 3000).then(() => false)]).then((ok) => { for (const k of keys) pinned.delete(k); return ok; });
  }
  E.stats = function () {
    let b = 0;
    for (const h of held.values()) b += h.bytes;
    return { heldMB: +(b / 1048576).toFixed(1), n: held.size, capMB: CAP / 1048576, loading: Object.keys(loading).length, evicted: E.evicted || 0 };
  };
  E._held = held;

  // 戦闘背景
  const bbgLoading = {}, fellBack = {};
  function bbgKeys(id) { const b = E.ready && I().bbg[id]; return b && b.back ? Object.values(b) : []; }
  function bbgLoad(id) {
    const ks = bbgKeys(id);
    if (!ks.length) return Promise.resolve(false);
    if (bbgLoading[id]) return bbgLoading[id];
    return (bbgLoading[id] = Promise.all(ks.map(loadKey)).then(() => {
      delete bbgLoading[id];
      const ok = !!img(I().bbg[id].back);
      // 読めるまでにコードの絵で焼いた物を忘れ、描いた絵で焼き直す
      if (ok && fellBack[id] && R.Hd && R.Hd.forget) {
        delete fellBack[id];
        const hk = 'hd:bbg:' + id;
        try { R.Hd.forget(hk); if (R.Hd.want && R.Hd.has && R.Hd.has(hk)) R.Hd.want(hk, { w: R.W, h: R.H }, -3); } catch (e) { /* 次に使うときに焼く */ }
      }
      return ok;
    }));
  }
  E.bbg = function (id) {
    if (!E.ready) return null;
    const b = I().bbg[id];
    if (!b || !b.back) return null;
    const ks = Object.values(b);
    if (!img(b.back) || !ks.every(settled)) { fellBack[id] = true; bbgLoad(id); return null; }
    for (const k of ks) touch(k);
    return { j: E.metaOf(b.back) || {}, layer: (name) => img(b[name]) };
  };
  /** 戦闘背景の絵を読み終えるまで待つ（上限 ms）→ Promise<読めたか> */
  E.awaitBbg = function (id, ms) {
    if (!E.ready || typeof Image === 'undefined' || !bbgKeys(id).length) return Promise.resolve(false);
    const ks = bbgKeys(id);
    for (const k of ks) pinned.add(k);
    return Promise.race([bbgLoad(id), timeout(ms || 2500).then(() => false)]).then((ok) => { for (const k of ks) pinned.delete(k); return ok; });
  };

  /** 描いた下絵（マップ 1 枚）: 32 の絵の meta も返す（_emit・_over は meta を持たないので本体の名前で引く） */
  // 下絵は使う時に読む（E.under が null を返すあいだ、チャンクはタイルで焼く。今のマップの層が全部読めたらチャンクを焼き直す）
  function loadUnder(k) {
    return loadKey(k).then((ok) => {
      try {
        const F = R.Field, m = curMap();
        if (!ok || !m || !F.chunks || !F.chunks.reset || (F._s && F._s.entering)) return ok;   // 入る途中は F.enter が焼く
        const ks = mapKeys(m, curTile());
        if (ks.indexOf(k) >= 0 && ks.every((x) => img(x))) F.chunks.reset();
      } catch (e) { /* 焼き直せなくても次に入ったときに使う */ }
      return ok;
    });
  }
  /** 下絵の本体と、その層（_emit・_over・_closed）をこのマスの大きさで読んでおく（読めていれば true）。noLoad は読み始めない */
  function underReady(key, tile, noLoad) {
    const U = I().under; let ok = true;
    for (const sfx of ['', '_emit', '_over', '_closed']) {
      const keys = U[key + sfx]; if (!keys) continue;
      const k = keys[tile] || keys[32]; if (!k) continue;
      if (noLoad ? !(held.has(k) && img(k)) : !img(k)) { ok = false; if (!noLoad) loadUnder(k); }
      else touch(k);
    }
    return ok;
  }
  E.underReady = underReady;
  /** マップの下絵を先に読む（map.art）。map:enter の隣のマップから */
  E.warmUnder = function (map, tile) {
    if (!E.ready || !map || !map.art || !map.art.image) return;
    for (const k of mapKeys(map, tile || curTile())) if (!img(k)) loadUnder(k);
  };
  /** マップの下絵が今のマスの大きさでそろっているか（無ければ読み始める）。FIELD の先焼き（CK.preload）が、タイルで焼いた物を使い回さないように */
  E.mapReady = function (map, tile) {
    const ks = mapKeys(map, tile || curTile());
    let ok = true;
    for (const k of ks) if (!img(k)) { ok = false; loadUnder(k); } else touch(k);
    return ok;
  };
  /** 入るマップの下絵を読み終えるまで待つ（F.enter の暗転の中。上限 ms）→ Promise<読めたか> */
  E.awaitMap = function (map, tile, ms) {
    if (!E.ready || typeof Image === 'undefined' || !map || !map.art) return Promise.resolve(true);
    return waitAll(mapKeys(map, tile || curTile()), ms || 4000);
  };
  E.under = function (key, tile, noLoad) {
    if (!E.ready || !key) return null;
    const keys = I().under[key];
    if (!keys) return null;
    if (!underReady(key.replace(/_(emit|over|closed)$/, ''), tile, noLoad)) return null;   // 本体と層がそろうまではタイルのまま
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
    // 起動で読むのは素材・物・建物（下絵と戦闘背景は使う時に読む。上の「使う時に読み」）の今のマスの大きさの分だけ。
    // 待つのは縦切りのテーマの分、ほかのテーマは後ろで。別の大きさはマスの大きさを変えたときに読む（2026-09-28: 全部で 1.4 GB）
    const SLICE = /^(common|harbor|hill_village|treetop|moss_village|tree_inside|lighthouse|cave|forest_dungeon|snow|desert|world)\//;   // world = WORLD v3 のワールドの素材と大きな景色
    const LAZY = /\/under\/|^bbg\//;
    const has = new Set(all);
    /** マスの大きさ t の素材・物・建物（t の絵が無い物は 32 の絵。pickTile と同じ） */
    const setOf = (t) => all.filter((k) => {
      if (LAZY.test(k)) return false;
      const m = /@(\d+)$/.exec(k);
      if (!m) return t === 32;
      if (+m[1] === t) return true;
      return +m[1] === 32 && !has.has(k.replace(/@32$/, '@' + t));
    });
    const decode = (keys) => Promise.all(keys.map((k) => { const r = R.Media.image(k, 'env'); return r && r.ready && r.img.decode ? r.img.decode().catch(() => null) : null; }));
    const loadList = async (list, n) => {
      for (let i = 0; i < list.length; i += n) {
        const b = list.slice(i, i + n);
        try { await R.Media.preload('env', b); await decode(b); } catch (e) { /* 読めた物だけ使う */ }
      }
    };
    // 読み終えたら、読めていなかった間にコードの絵で焼いた物（素材・面・物）を焼き直す
    const refresh = () => {
      idx = null;
      for (const k of Object.keys(matCache)) if (!matCache[k]) delete matCache[k];
      for (const k of Object.keys(faceCache)) if (!faceCache[k]) delete faceCache[k];
      if (R.Hd && R.Hd.keys && R.Hd.forget) for (const k of R.Hd.keys('hd:prop:')) if (T._envProp && T.Env.prop(k.slice(8), 0, {})) R.Hd.forget(k);
    };
    const tile = curTile();
    const set = setOf(tile);
    const now = set.filter((k) => SLICE.test(k));
    const later = set.filter((k) => !SLICE.test(k));
    // 32 枚ずつ（一度に全部を頼むと Chromium が ERR_INSUFFICIENT_RESOURCES で落ちる）
    await loadList(now, 32);
    E.bootMs = Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - t0); E.bootN = now.length;
    const loadedTiles = new Set([tile]);
    E.later = (async () => { await loadList(later, 12); refresh(); E.all = true; })();
    // マスの大きさを変えた: その大きさの分を後ろで読む
    if (R.on) R.on('settings', (e) => {
      if (!e || e.key !== 'fieldZoom') return;
      const t = curTile();
      if (loadedTiles.has(t)) return;
      loadedTiles.add(t);
      E.later = Promise.resolve(E.later).then(() => loadList(setOf(t), 12)).then(refresh);
    });
    idx = null;
    E.ready = true;
    E.count = all.length;
    // 先に焼かれた（コードの絵の）物を忘れる
    if (R.Hd && R.Hd.keys && R.Hd.forget) for (const p of ['hd:prop:', 'hd:bld:', 'hd:bbg:', 'hd:secret:']) for (const k of R.Hd.keys(p)) R.Hd.forget(k);
    if (T._envReset) T._envReset();
    if (T._faceReset) T._faceReset();
    // 画像にしかない物の登録（家具・木の変化などの新しい id）。R.DB.props にも足す（CONTENT が置ける）
    if (T._envRegisterProps) T._envRegisterProps();
    // WORLD v3: 画像が読めるまでに焼いたワールドのチャンク（コードの絵・大きな景色なし）を焼き直す（フィクスチャですぐワールドに入ったとき）
    try { const F = R.Field; if (F && F.chunks && F.chunks.reset && F._s && F._s.map && F._s.map.splat && !F._s.entering) F.chunks.reset(); } catch (e) { /* 次に入ったときに焼く */ }
    // 入ったマップの隣（出口・扉・階段・建物の入口の行き先）の下絵と、このマップの戦闘背景を先に読む。
    // 隣は近い順に、見積もり（幅×高さ×マス²×4×層）で WARM_MB まで（町の扉が多くても全部は読まない。遠い物は LRU が手放す）
    const WARM_MB = 64;
    if (R.on) R.on('map:enter', (e) => {
      try {
        const t = curTile();
        const M = R.DB.maps || {}, m = M[e && e.map]; if (!m) return;
        E.warmUnder(m, t);
        const F = R.Field, S = F && F._s, px = S && S.map === m ? S.x : 0, py = S && S.map === m ? S.y : 0;
        const to = new Map();
        const add = (x, y, dest) => { if (!dest || !dest.map || dest.map === m.id || !M[dest.map] || !M[dest.map].art) return; const d = Math.hypot((x || 0) - px, (y || 0) - py); if (!to.has(dest.map) || to.get(dest.map) > d) to.set(dest.map, d); };
        for (const x of m.exits || []) add(x.x, x.y, x.to);
        for (const o of m.objects || []) { add(o.x, o.y, o.to); if (o.door) add(o.door.x, o.door.y, o.door.to); }
        let mb = 0;
        for (const [id] of [...to.entries()].sort((a, b) => a[1] - b[1])) {
          const n = M[id], layers = mapKeys(n, t).length || 1;
          mb += ((n.w || 32) * (n.h || 32) * t * t * 4 * layers) / 1048576;
          if (mb > WARM_MB) break;
          E.warmUnder(n, t);
        }
        // 戦闘背景: マップの bbg と出現表の bg
        const bgs = new Set();
        if (m.bbg) bgs.add(m.bbg);
        for (const z of m.zones || []) { const en = R.DB.encounters && R.DB.encounters[z.zone]; if (en && en.bg) bgs.add(en.bg); }
        for (const id of bgs) bbgLoad(id);
      } catch (x) { /* 先読みできなくても入ったときに読む */ }
    });
  });
})(window.RPG);
