// RENDER: R.Sky.at(tier) → {ambientMul, horizon, tint} ＋ 足した物。ティア（解いた地方の数）0〜8 の 9 段（V2_PLAN §0.2、WORLD_REDESIGN §1.3）
// 0 と 1 は同じ「深い夜」の範囲で 1 の方が少し明るい → 2〜3 群青 → 4〜5 薄紫 → 6〜7 薄紅 → 8 暁の手前。
// 使い方: 環境光に ambientMul を掛ける（R.Hd.mood(id, tier) がやる）、空の見える画面は horizon（地平の色）と zenith（天頂）で空を塗る、
// tint は光だまりの外の色に薄く足す色。空の段が変わるのは地方の解決の演出の中だけ（R.on('tier') で引き直す）。
// 平均輝度は .16 → .30、四隅比は .3 → .5 へ少しずつ（STYLE_REFERENCE §5.2 の最後の段落）→ vignetteMul・lum。
(function (R) {
  'use strict';
  const Sky = (R.Sky = R.Sky || {});
  //          ambientMul  horizon     zenith      tint       vignetteMul  lum（目標の平均輝度）  stars
  const STEPS = [
    [1.00, '#1c1a3e', '#07081a', '#5a58a0', 1.00, 0.16, 1.00],   // 0 深い夜。月と星だけ
    [1.04, '#221f4a', '#08091c', '#5c5aa4', 0.97, 0.17, 0.95],   // 1 深い夜（少し明るい）
    [1.10, '#1f3470', '#0a0f2a', '#5a64b0', 0.92, 0.19, 0.85],   // 2 地平が群青
    [1.16, '#2a4486', '#0c1330', '#5e6cb8', 0.88, 0.21, 0.75],   // 3 群青
    [1.23, '#5a4a92', '#141638', '#7066b4', 0.83, 0.23, 0.62],   // 4 薄紫のうす明かり
    [1.30, '#74559a', '#1a1a40', '#7a6cb4', 0.78, 0.25, 0.50],   // 5 薄紫
    [1.38, '#a0607e', '#22204a', '#8a70b0', 0.74, 0.27, 0.38],   // 6 地平が薄紅
    [1.46, '#c47476', '#2a2652', '#9474ac', 0.70, 0.29, 0.26],   // 7 薄紅
    [1.55, '#e09a7c', '#34305e', '#a07ca8', 0.66, 0.30, 0.15],   // 8 暁の手前
  ];
  const cache = [];
  /** tier 0〜8（範囲の外は端に丸める）→ {ambientMul, horizon, tint, zenith, vignetteMul, lum, stars, tier} */
  Sky.at = function (tier) {
    const t = Math.max(0, Math.min(8, Math.floor(+tier || 0)));
    if (cache[t]) return cache[t];
    const s = STEPS[t];
    return (cache[t] = { ambientMul: s[0], horizon: s[1], tint: s[3], zenith: s[2], vignetteMul: s[4], lum: s[5], stars: s[6], tier: t });
  };
  /** 色（'rgb(..)'・'#rrggbb'・[r,g,b]）にティアの環境光を掛けた 'rgb(..)' */
  Sky.ambient = function (color, tier) {
    const a = R.Hd._rgb(color), k = Sky.at(tier).ambientMul;
    return `rgb(${a.map((v) => Math.min(255, Math.round(v * k))).join(',')})`;
  };
  Sky.STEPS = STEPS.length;
})(window.RPG);
