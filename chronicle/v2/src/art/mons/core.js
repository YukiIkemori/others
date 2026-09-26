// BEAST の土台: 魔物・ボス・戦闘背景の焼き方の共通部分（V2_PLAN §2.5.7・§2.11「絵の描き方」、ART_REWORK §2.5、STYLE_REFERENCE §4）
//
//   R.Beast.rz()                        ラスタライザ（R.Hd.RZ。まだ無ければ mons/rz_fallback.js の写し）
//   R.Beast.bakeSheet(o) → K.sheet      2.5D の部品を描く関数からコマを焼いて Sheet にする（右向き・描く点は足元の中央）
//   R.Beast.defKey(key, factory, meta)  R.Hd.def の予約（全ファイルの読み込みと仮の実装の後 = R.onData で登録する）
//   R.Beast.tierPx(tier) → [lo, hi]     大きさの段（論理 px の高さ）
//   R.Beast.palette(defs, {variant, golden})   素材の組（色替えは鍵の色を回す。金色は明るさを保って金へ）
//
// 大きさの段: STYLE_REFERENCE R1・R2 の数字（S 22〜30・M 30〜45・地方ボス 90〜120）は「人物 = 30」の物差し（§4.3）。
// v2 の戦闘の人物は全高 約 70 論理 px（MODERN_UI §2.1）なので、同じ比（人物に対する大きさ）を保つよう 70/30 倍して使う。
// こうしないと雑魚が人物の 1/3 になり、R2 の「雑魚でも人物より少し大きい」（§4.1）と逆になる（リードへの確認は requests.jsonl）。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});

  /** ラスタライザ: RENDER の R.Hd.RZ があればそれ、無ければ控えの写し */
  BZ.rz = function () {
    const Z = R.Hd && R.Hd.RZ;
    return Z && Z.Builder && Z.render && Z.mat ? Z : BZ.RZ_LOCAL;
  };

  // ------------------------------------------------------------------ 大きさの段
  // 人物の全高は R.Hd.STYLE.height.btl（RENDER）の中ほど、段の数字は R.Hd.STYLE.size（人物 = 30 の物差し）
  BZ.PERSON_REF = 30;             // STYLE_REFERENCE §4.3 の物差しの人物
  BZ.TIERS_REF = { s: [22, 30], m: [30, 45], l: [45, 90], add: [40, 70], boss: [90, 120] };
  BZ.person = function () {
    const S = (R.Hd && R.Hd.STYLE) || {}, h = S.height && S.height.btl;
    return h ? (h[0] + h[1]) / 2 : 60;
  };
  BZ.tierRef = function (t) {
    const S = (R.Hd && R.Hd.STYLE) || {};
    return (S.size && S.size[t]) || BZ.TIERS_REF[t] || BZ.TIERS_REF.m;
  };
  BZ.tierPx = function (t) {
    const r = BZ.tierRef(t), k = BZ.person() / BZ.PERSON_REF;
    return [Math.round(r[0] * k), Math.round(r[1] * k)];
  };
  /** 段の中の高さ（stage 1 は下寄り、2 は +10% ほど上。ART_REWORK §2.5「段が上がるほど少し大きく」） */
  BZ.targetPx = function (tier, stage, at) {
    const [a, b] = BZ.tierPx(tier);
    const f = at != null ? at : (stage >= 2 ? 0.86 : 0.5);
    return a + (b - a) * f;
  };

  // ------------------------------------------------------------------ 色
  const hex = (h) => { h = String(h).replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function rgb2hsl(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  BZ.color = { hex, toHex, rgb2hsl, hsl2rgb };
  /** 鍵の色を回す（組み立て表の {hue, sat, bri}。画素の HSV ずらしではなく素材の鍵、ART_REWORK §3） */
  BZ.shiftKeys = function (keys, v) {
    if (!v || (!v.hue && v.sat == null && v.bri == null)) return keys;
    return keys.map((k) => {
      const [h, s, l] = rgb2hsl(hex(k));
      return toHex(hsl2rgb(h + (v.hue || 0), Math.min(1, s * (v.sat == null ? 1 : v.sat)), Math.min(0.97, l * (v.bri == null ? 1 : v.bri))));
    });
  };
  // 金色の個体（ART_REWORK §2.1「明るさを保って金へ」）。暗い段は赤茶へ、明るい段は淡い金へ（影の色相のずらしを保つ）
  const GOLD = ['#2a1206', '#5a2c0c', '#8c5418', '#c08a2c', '#e8bc4c', '#f8e090', '#fff8d8'].map(hex);
  BZ.goldKeys = function (keys) {
    return keys.map((k) => {
      const c = hex(k), lu = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
      const t = Math.min(1, Math.pow(lu, 0.85) * 1.12) * (GOLD.length - 1), i = Math.min(GOLD.length - 2, Math.floor(t)), f = t - i;
      return toHex([0, 1, 2].map((j) => GOLD[i][j] + (GOLD[i + 1][j] - GOLD[i][j]) * f));
    });
  };
  /** 1 色から 5 つの鍵（影は色相を −40° 寄せて暗く、明るい段は淡く）。部品の色 {c} に使う */
  BZ.keysFrom = function (c, o) {
    o = o || {};
    const [h, s, l] = rgb2hsl(hex(c)), sh = o.shadowHue == null ? -40 : o.shadowHue;
    return [
      toHex(hsl2rgb(h + sh, Math.min(1, s * 0.9 + 0.1), Math.max(0.06, l * 0.22))),
      toHex(hsl2rgb(h + sh * 0.6, Math.min(1, s * 0.95), l * 0.45)),
      toHex(hsl2rgb(h + sh * 0.25, s, l * 0.72)),
      toHex(hsl2rgb(h, s, l)),
      toHex(hsl2rgb(h + 8, s * 0.7, Math.min(0.95, l + (1 - l) * 0.45))),
    ];
  };

  // ------------------------------------------------------------------ 素材
  const matCache = new Map();
  BZ.mat = function (o) {
    const k = JSON.stringify(o);
    let m = matCache.get(k);
    if (!m) { m = BZ.rz().mat(Object.assign({}, o)); matCache.set(k, m); }
    return m;
  };
  /**
   * 素材の組を作る。defs = {name: {keys, fixed?, noGold?, …mat の値}}。
   * variant（組み立て表の {hue, sat, bri}）は fixed でない素材だけ、golden は noGold でない素材だけ。
   */
  BZ.palette = function (defs, o) {
    o = o || {};
    const P = {};
    for (const name of Object.keys(defs)) {
      const d = Object.assign({}, defs[name]);
      let keys = d.keys;
      if (o.variant && !d.fixed) keys = BZ.shiftKeys(keys, o.variant);
      if (o.golden && !d.noGold) keys = BZ.goldKeys(keys);
      delete d.fixed; delete d.noGold;
      d.keys = keys;
      if (d.rim && Array.isArray(d.rim)) d.rim = toHex(d.rim);
      P[name] = BZ.mat(d);
    }
    return P;
  };

  // ------------------------------------------------------------------ 決まりの値（R.Hd.STYLE にあればそちら）
  BZ.style = function () {
    const S = (R.Hd && R.Hd.STYLE) || {};
    return {
      tones: S.tones || 5,
      sat: S.satMon != null ? S.satMon : 0.78,            // ART_REWORK §2.1 の仕上げの彩度（魔物 0.78）
      olMix: S.olMix != null ? S.olMix : 0.82,
      tint: S.monTint || [6, -2, 10, 10, 4, -8],           // 影は青紫へ・明るい所は暖色へ
    };
  };
  /**
   * 魔物を焼く光: R.Hd.mood('night').rz（RENDER の人物の光）を左右に返した物。魔物は右向きで、味方の側（右）のランタンから
   * 暖かい鍵の光が当たり、後ろ（左上）から月の青いリム。mood の光が無いときは同じ向きの控え
   */
  BZ.light = function () {
    const md = R.Hd && R.Hd.mood && !((R.Stubs && R.Stubs.installed && R.Stubs.installed.Hd) || []).includes('mood') ? R.Hd.mood('night') : null;
    const z = md && md.rz;
    if (z && z.key && z.rim) {
      return Object.assign({}, z, { key: [Math.abs(z.key[0]), z.key[1], z.key[2]], rim: [-Math.abs(z.rim[0]), z.rim[1], z.rim[2]], rimC: Array.isArray(z.rimC) ? z.rimC : hex(String(z.rimC)) });
    }
    return { key: [0.45, -0.55, 0.7], rim: [-0.6, -0.5, -0.6], rimC: [159, 192, 255], rimK: 0.9, mul: [0.98, 0.9, 0.82] };
  };

  // ------------------------------------------------------------------ 焼く
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  BZ.mkCanvas = mkCanvas;
  /** 純粋な黒と黒に近すぎる画素を色つきの暗い色へ（STYLE_REFERENCE §9「純黒 0」）。不透明の画素の外形 bbox も返す */
  BZ.finish = function (c) {
    const x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      if (d[i + 3] < 8) { d[i + 3] = 0; continue; }
      if (d[i] < 12 && d[i + 1] < 10 && d[i + 2] < 22) { d[i] = Math.max(d[i], 12); d[i + 1] = Math.max(d[i + 1], 9); d[i + 2] = Math.max(d[i + 2], 22); }
      const px = p % c.width, py = (p / c.width) | 0;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    x.putImageData(id, 0, 0);
    return x1 < 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  const pt = (p, s) => (p ? { x: Math.round(p[0] * s * 10) / 10, y: Math.round(p[1] * s * 10) / 10 } : null);

  /**
   * コマを焼いて Sheet（K.sheet）にする。
   * o = {draw(B, P, st, RZ) → 点の表 {head, center, fx, …}（モデル座標、足元が原点、+x が前）,
   *      pal, variant, golden, parts:[[name, opts]], scale, frames:[{pose, st}], fps, meta}
   * 描く点 = 足元の中央（frame.ox, oy）。anchors は描く点からの相対の論理 px（コマごとの上書きは frame.anchors）。
   */
  BZ.bakeSheet = function (o) {
    const RZ = BZ.rz(), S = BZ.style(), L = o.light || BZ.light();
    const P = BZ.palette(o.pal, { variant: o.variant, golden: o.golden });
    const frames = [], poses = {};
    let box0 = null;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    o.frames.forEach((f, i) => {
      const B = new RZ.Builder();
      const st = Object.assign({ t: 0, stage: o.stage || 1, golden: !!o.golden }, f.st || {});
      const pts = o.draw(B, P, st, RZ) || {};
      pts.u = pts.u || 1;
      for (const [name, po] of o.parts || []) {
        const fn = BZ.PARTS && BZ.PARTS[name];
        if (fn) fn(B, pts, po || {}, { P, st, golden: !!o.golden, RZ });
      }
      const r = RZ.render(B, { scale: o.scale, light: L, tones: S.tones, sat: S.sat, olMix: S.olMix, tint: S.tint, pad: 2 });
      const box = BZ.finish(r.canvas);
      if (i === 0) box0 = { box, ox: r.ox, oy: r.oy };
      const anchors = {};
      for (const k of ['head', 'center', 'fx', 'eye', 'mouth', 'back', 'top']) if (pts[k]) anchors[k] = pt(pts[k], o.scale);
      anchors.feet = { x: 0, y: 0 };
      frames.push({ c: r.canvas, ox: Math.round(r.ox), oy: Math.round(r.oy), anchors });
      (poses[f.pose] = poses[f.pose] || []).push(i);
    });
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    const a0 = frames[0].anchors;
    const b = box0.box;
    return {
      frames, poses,
      fps: o.fps || { idle: 2.2, tele: 4 },
      anchors: Object.assign({}, a0),
      // 見た目の大きさ（足元から上の高さ・外形の幅。BSCENE の並べ方 enemyLayout が読む）
      w: b.w, h: Math.round(box0.oy - b.y),
      meta: Object.assign({ bakeMs: Math.round(ms * 10) / 10, frames: frames.length, visH: b.h, top: Math.round(b.y - box0.oy), left: Math.round(b.x - box0.ox), right: Math.round(b.x + b.w - box0.ox) }, o.meta || {}),
    };
  };

  // ------------------------------------------------------------------ ボス（hd:boss:<sprite>）
  /** 待機 2・攻撃 1・被弾 1・予告の構え tele 2（ART_REWORK §2.5、V2_PLAN §2.5.7）。spec.frames で足してよい */
  BZ.BOSS_FRAMES = [
    { pose: 'idle', st: { t: 0 } }, { pose: 'idle', st: { t: 0.5 } },
    { pose: 'attack', st: { t: 0.1, atk: 1 } }, { pose: 'hit', st: { t: 0.3, hit: 1 } },
    { pose: 'tele', st: { t: 0, tele: 1 } }, { pose: 'tele', st: { t: 0.5, tele: 1 } },
  ];
  BZ.BOSSES = BZ.BOSSES || {};
  /** spec = {tier:'boss'|'add', at: 段の中の位置 0〜1, h, pal, draw, frames?} */
  BZ.bakeBoss = function (id, opts) {
    const b = BZ.BOSSES[id];
    if (!b) return null;
    opts = opts || {};
    const px = BZ.targetPx(b.tier || 'boss', 1, b.at != null ? b.at : 0.5);
    return BZ.bakeSheet({ draw: b.draw, pal: b.pal, golden: !!opts.golden, scale: px / (b.vis || b.h), frames: b.frames || BZ.BOSS_FRAMES,
      fps: { idle: 2, tele: 5 }, meta: { kind: b.tier === 'add' ? 'mon' : 'boss', id, tier: b.tier || 'boss', fly: !!b.fly, targetPx: Math.round(px), focus: b.focus || 'eye' } });
  };
  /** ボスの登録（ファイルの読み込み順に依らない）。keys = 登録するキーの一覧 */
  BZ.defBoss = function (id, spec, keys) {
    BZ.BOSSES[id] = spec;
    for (const k of keys || ['hd:boss:' + id]) (BZ._pending = BZ._pending || []).push([k, (opts) => BZ.bakeBoss(id, opts), { kind: k.split(':')[1], owner: 'BEAST', boss: id }]);
    (BZ.BOSS_KEYS = BZ.BOSS_KEYS || []).push((keys || ['hd:boss:' + id])[0]);
  };
  // boss/*.js は名前順でこのファイルより先に読まれるので、BZ._bossDefs に積んだ物をここで登録する
  for (const a of BZ._bossDefs || []) BZ.defBoss(a[0], a[1], a[2]);
  BZ._bossDefs = { push: (a) => BZ.defBoss(a[0], a[1], a[2]) };

  // ------------------------------------------------------------------ 登録（R.Hd は仮の実装の後にそろうので R.onData で）
  // 各ファイルは読み込み時に BZ._pending へ積むだけ（art/ の中の読み込み順に依らない）。ここで R.Hd.def する
  BZ.defKey = function (key, factory, meta) { (BZ._pending = BZ._pending || []).push([key, factory, meta || {}]); };
  BZ.keyList = function () { return (BZ._pending || []).map((p) => p[0]); };
  if (R.onData) {
    R.onData(function () {
      if (!R.Hd || !R.Hd.def) return;
      for (const [key, factory, meta] of BZ._pending || []) R.Hd.def(key, factory, meta);
    });
  }
})(window.RPG);
