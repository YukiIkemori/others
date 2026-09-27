// RENDER: 場面の光（R.Hd.mood）と色調（R.Hd.grade）。V2_PLAN §2.5.5、ART_REWORK §1.5.2、MODERN_UI §4.1、STYLE_REFERENCE §5.2
// 光の雰囲気の id は R.Contract.MOODS の 9 つ（map.light.mood・戦闘背景の meta.mood はこの中から。足すときは RENDER に依頼）。
// 返す物は K.mood: {ambient, lightDir, shadow, grade:{sh, hi, lift, sat}, vignette, bloom} ＋ 足した物（下の表の説明）。読むだけ（書き換えない）。
//   ambient   掛け算の環境光の色（R.Light.compose の既定。昼の色で塗った下地に掛ける）
//   lightDir  主光の向き [x, y]（月・窓・松明の方から。影は逆へ伸ばす）       shadow  落ち影の色
//   grade     仕上げの色調: sh / hi = 暗部・明部に足す色 [r, g, b]（0〜255 の足し引き）、lift = 暗部の持ち上げ（真っ黒にしない）、sat = 彩度、con = コントラスト
//   vignette  四隅の暗さ（四隅は中央の 1 − vignette 倍）   bloom = ブルームの強さ、thr = しきい
//   key/rim/rimC/rimK/mul   RZ.render の light（人物・魔物を焼くときの主光とリム。R.Hd.RZ.render(B, {light: mood.rz})）
//   moon      月の当たる面（屋根・高い所の上面）に足す色      lamp / lantern = 灯り・ランタンの色と強さ
//   spillK    spill の強さの倍率（屋内は床が明るいので控えめ。宝箱が床に溶けない）
//   spillR    光だまりの中心へ足す加算（spill）の半径の倍率
//   poolK     光だまりの強さの倍率（R.Light.compose の灯りの k に掛ける。暗い地面の場面で灯りの芯を明るく）
//   actorLift 人物を背景より少し持ち上げる割合（夜に縁が消えないように、STYLE_REFERENCE §5.6）
//   target    STYLE_REFERENCE §9 の夜の目標値（hd_sheet.js --area render が測って比べる）
(function (R) {
  'use strict';
  const Hd = (R.Hd = R.Hd || {});

  const NIGHT_TARGET = { lum: [0.14, 0.22], p5: [0.02, 0.05], p95: [0.35, 0.60], bright: [0.01, 0.07], darkHue: [250, 295], darkSat: 0.45, corner: [0.25, 0.40] };
  const DUNGEON_TARGET = Object.assign({}, NIGHT_TARGET, { corner: [0.12, 0.30] });
  const RZ_NIGHT = { key: [-0.45, -0.55, 0.7], rim: [0.6, -0.5, -0.6], rimC: [159, 192, 255], rimK: 0.9, mul: [0.98, 0.9, 0.82] };
  const RZ_WARM = { key: [-0.35, -0.62, 0.7], rim: [0.8, -0.25, -0.55], rimC: [255, 216, 160], rimK: 1.25, mul: [1, 0.96, 0.9] };

  function m(o) {
    return Object.assign({
      lightDir: [-0.6, -0.8], shadow: 'rgba(14,10,40,0.42)',
      vignette: 0.55, bloom: 0.55, thr: 0.6,
      moon: 'rgb(56,64,84)', lamp: { color: '#ffc27a', k: 0.85 }, lantern: { color: '#ffb866', k: 0.8 },
      poolMul: 1, actorLift: 0.12, target: NIGHT_TARGET, rz: RZ_NIGHT,
    }, o);
  }
  // 値は MODERN_UI の見本（town / field / dungeon / battle の out/*.png）の環境光と色調から始め、hd_sheet.js --area render の測定で合わせた
  const TABLE = {
    // 街道・ワールド・戦闘の夜（月の青紫）
    night: m({ ambient: 'rgb(116,104,196)', grade: { sh: [28, -6, 40], hi: [16, 6, -10], lift: 4, sat: 1.02, con: 1.06 }, vignette: 0.7, bloom: 0.6 }),
    // 夜の町（灯りの島。見本 town.png の rgb(92,90,160)）
    town_night: m({ ambient: 'rgb(106,88,170)', grade: { sh: [6, -4, 10], hi: [16, 6, -10], lift: 0, sat: 1.05, con: 1.08 }, vignette: 0.75, bloom: 0.65, thr: 0.6 }),
    // 家・宿・酒場の中（暖炉とランプの暖色、窓の外は青）
    interior: m({ spillK: 0.45, ambient: 'rgb(150,116,122)', lightDir: [0.2, -1], shadow: 'rgba(34,14,24,0.4)', grade: { sh: [12, 0, 14], hi: [18, 8, -8], lift: 4, sat: 1.0, con: 1.05 }, vignette: 0.5, bloom: 0.45, thr: 0.64, rz: RZ_WARM, target: Object.assign({}, NIGHT_TARGET, { lum: [0.16, 0.28], darkHue: [260, 340] }) }),
    // 夜の森（蛍とこけの緑、月は木々で細る）
    forest_night: m({ ambient: 'rgb(88,104,158)', shadow: 'rgba(8,16,30,0.45)', grade: { sh: [22, -4, 34], hi: [10, 14, -6], lift: 4, sat: 1.04, con: 1.06 }, vignette: 0.78, poolK: 1.3, spillR: 1.15, bloom: 0.62, lamp: { color: '#ffd07a', k: 0.8 }, target: DUNGEON_TARGET }),
    // 暗がりの階（ランタンの輪の中だけ見える。E6）
    dark: m({ ambient: 'rgb(54,48,104)', shadow: 'rgba(6,4,20,0.5)', grade: { sh: [8, -2, 22], hi: [18, 8, -8], lift: 3, sat: 1.02, con: 1.08 }, vignette: 0.72, bloom: 0.6, thr: 0.58, actorLift: 0.15, target: Object.assign({}, DUNGEON_TARGET, { lum: [0.08, 0.18] }) }),
    // 千年樹の中（光るこけの青緑）
    tree: m({ ambient: 'rgb(96,120,146)', lightDir: [0, -1], shadow: 'rgba(8,20,28,0.42)', grade: { sh: [6, 4, 20], hi: [12, 16, -4], lift: 4, sat: 1.04, con: 1.05 }, vignette: 0.72, bloom: 0.62, thr: 0.58, lamp: { color: '#c8ffb0', k: 0.75 }, target: DUNGEON_TARGET }),
    // 灯台の中（石と松明）
    tower: m({ ambient: 'rgb(108,98,172)', lightDir: [0.3, -1], grade: { sh: [10, -2, 20], hi: [18, 8, -8], lift: 4, sat: 1.02, con: 1.06 }, vignette: 0.74, bloom: 0.6, target: DUNGEON_TARGET }),
    // 洞窟（結晶と松明、光だまりは 1.35 倍。見本 dungeon.png の rgb(138,120,200) に周辺を強く）
    cave: m({ ambient: 'rgb(122,106,188)', lightDir: [0, -1], shadow: 'rgba(10,6,28,0.45)', grade: { sh: [10, -4, 22], hi: [14, 8, -6], lift: 3, sat: 1.04, con: 1.08 }, vignette: 0.9, bloom: 0.66, thr: 0.58, poolMul: 1.35, poolK: 1.15, target: DUNGEON_TARGET }),
    // 海辺・港の外（夜光の海、青みの強い月）
    coast: m({ ambient: 'rgb(94,102,178)', lightDir: [-0.7, -0.7], grade: { sh: [8, -2, 22], hi: [16, 8, -8], lift: 4, sat: 1.04, con: 1.06 }, vignette: 0.62, bloom: 0.6 }),
  };
  Hd.MOOD_TABLE = TABLE;

  function parse(c) {
    if (Array.isArray(c)) return c;
    const s = String(c);
    let mm = /rgba?\(([^)]+)\)/.exec(s);
    if (mm) return mm[1].split(',').slice(0, 3).map((v) => +v);
    mm = /^#([0-9a-f]{6})$/i.exec(s);
    if (mm) return [0, 2, 4].map((i) => parseInt(mm[1].slice(i, i + 2), 16));
    return [255, 255, 255];
  }
  Hd._rgb = parse;

  const warned = {};
  const tierCache = {};
  /**
   * 場面の光。id は R.Contract.MOODS。tier（0〜8）を渡すと空の段（R.Sky.at）を掛けた版（環境光を明るく、周辺減光を弱く）。
   * 知らない id は 'night'（1 回だけ警告）。
   */
  Hd.mood = function (id, tier) {
    let t = TABLE[id];
    if (!t) {
      if (id && !warned[id]) { warned[id] = true; if (typeof console !== 'undefined') console.warn('[Hd] unknown mood ' + id + ' (night)'); }
      t = TABLE.night; id = 'night';
    }
    if (tier == null || !R.Sky || !R.Sky.at) return t;
    const k = id + ':' + (tier | 0);
    if (tierCache[k]) return tierCache[k];
    const sky = R.Sky.at(tier);
    const a = parse(t.ambient).map((v) => Math.min(255, Math.round(v * sky.ambientMul)));
    return (tierCache[k] = Object.assign({}, t, {
      ambient: `rgb(${a[0]},${a[1]},${a[2]})`,
      vignette: +(t.vignette * (sky.vignetteMul != null ? sky.vignetteMul : 1)).toFixed(3),
      tier: tier | 0,
    }));
  };

  // ------------------------------------------------------------------ 色調（焼いたコマに 1 回だけ掛ける。ART_REWORK §1.5.1 の 2 段のキャッシュの 2 段目）
  const gradeCache = new Map();   // canvas → Map(moodId → canvas)
  let gradeBytes = 0;
  const GRADE_MAX = 512;
  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  /** 画素に色調を掛ける（data をその場で）。grade = {sh, hi, lift, sat, con} */
  function gradeData(d, gr) {
    const sh = gr.sh || [0, 0, 0], hi = gr.hi || [0, 0, 0];
    const sat = gr.sat != null ? gr.sat : 1, con = gr.con != null ? gr.con : 1, lift = gr.lift || 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const l = r * 0.3 + g * 0.59 + b * 0.11;
      r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      r = 0.5 + (r - 0.5) * con; g = 0.5 + (g - 0.5) * con; b = 0.5 + (b - 0.5) * con;
      const ws = (1 - l) * (1 - l), wh = l * l;
      let R2 = clamp(r * 255 + sh[0] * ws + hi[0] * wh + lift);
      let G2 = clamp(g * 255 + sh[1] * ws + hi[1] * wh + lift);
      let B2 = clamp(b * 255 + sh[2] * ws + hi[2] * wh + lift);
      if (R2 + G2 + B2 < 3) { R2 = 7; G2 = 8; B2 = 18; }
      d[i] = R2; d[i + 1] = G2; d[i + 2] = B2;
    }
    return d;
  }
  Hd._gradeData = gradeData;

  /** canvas に場面の色調を掛けた新しい canvas（同じ canvas と mood なら同じ物を返す）。moodId はオブジェクト {sh, hi, lift, sat, con} でもよい */
  Hd.grade = function (canvas, moodId) {
    if (!canvas || !canvas.width) return canvas;
    const gr = typeof moodId === 'object' && moodId ? moodId : Hd.mood(moodId || 'night').grade;
    const gk = typeof moodId === 'object' && moodId ? JSON.stringify(moodId) : moodId || 'night';
    let byMood = gradeCache.get(canvas);
    if (byMood && byMood.has(gk)) return byMood.get(gk);
    const out = Hd.RZ.canvas(canvas.width, canvas.height);
    const x = out.getContext('2d');
    x.drawImage(canvas, 0, 0);
    const id = x.getImageData(0, 0, out.width, out.height);
    gradeData(id.data, gr);
    x.putImageData(id, 0, 0);
    if (!byMood) { byMood = new Map(); gradeCache.set(canvas, byMood); }
    byMood.set(gk, out);
    gradeBytes += out.width * out.height * 4;
    // 上限: 古い canvas の分から捨てる
    while (gradeCache.size > GRADE_MAX) {
      const [k0, v0] = gradeCache.entries().next().value;
      for (const c of v0.values()) gradeBytes -= c.width * c.height * 4;
      gradeCache.delete(k0);
    }
    if (Hd.track) Hd.track('fx', 'grade', gradeBytes);
    return out;
  };
})(window.RPG);
