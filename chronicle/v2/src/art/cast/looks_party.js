// CAST: 仲間 20 人の見た目 R.DB.looks[<companion id>]（K.look、V2_PLAN §2.6.2・§3.8）。id は R.DB.companions の look と同じ。
// 原画（A35）が届くまでの仮の絵の骨組みのデータ。色は夜の落ち着いた彩度、主色の色相 hue は 20 人で散らす（STYLE_REFERENCE §0.7）。
// セルマ＝赤茶・ヴィオラ＝薄紫（A33 ④）。頭の輪郭 silhouette は 20 人ですべて違う。
(function (R) {
  'use strict';
  const m = (build, age) => ({ sex: 'm', build: build || 'normal', age: age || 'adult' });
  const f = (build, age) => ({ sex: 'f', build: build || 'slim', age: age || 'adult' });
  R.defs('looks', {
    selma: { name: 'セルマ', body: f('normal'), skin: 'fair', eyes: '#3c6848', hair: { style: 'ponytail', color: '#8a3a22', ears: 'hidden' },
      outfit: { type: 'armor', main: '#8c4632', sub: '#4a3a32', trim: '#c09a5a' }, headwear: 'circlet', hue: 15, silhouette: 'ponytail_circlet' },
    hagen: { name: 'ハーゲン', body: m('sturdy'), skin: 'tan', eyes: '#4a3a2c', hair: { style: 'wild', color: '#7a4428', ears: 'hidden' },
      outfit: { type: 'tunic', main: '#6e4c30', sub: '#4a4238', trim: '#a88a58' }, mantle: '#4a3426', pauldron: true, extras: ['eyepatch', 'beard'], hue: 28, silhouette: 'wild_beard' },
    dokka: { name: 'ドッカ', body: m('sturdy', 'short'), skin: 'tan', eyes: '#3a3024', hair: { style: 'crop', color: '#9a3c22', ears: 'show' },
      outfit: { type: 'dwarf', main: '#7a6a3a', sub: '#5a4a3a', trim: '#3a3430' }, headwear: 'goggles', extras: ['beard'], hue: 55, silhouette: 'goggles_beard' },
    basil: { name: 'バジル', body: m('sturdy'), skin: 'fair', eyes: '#4a4030', hair: { style: 'bald', color: '#5a4030', ears: 'show' },
      outfit: { type: 'robe', main: '#8a8458', sub: '#6a6448', trim: '#c8b880' }, mantle: '#6a5a40', headwear: { type: 'hood', color: '#6a5a40' }, hue: 68, silhouette: 'monk_cowl' },
    bartolo: { name: 'バルトロ', body: m('normal', 'old'), skin: 'fair', eyes: '#4a4a52', hair: { style: 'short', color: '#d8d4cc', ears: 'hidden' },
      outfit: { type: 'armor', main: '#7a2434', sub: '#4a4450', trim: '#c8a860' }, mantle: { color: '#6c1a2c', long: true }, headwear: { type: 'plume', color: '#a02c3a' }, extras: ['mustache'], hue: 350, silhouette: 'plume_helm' },
    viola: { name: 'ヴィオラ', body: f(), skin: 'pale', eyes: '#6a4a86', hair: { style: 'bob', color: '#5a4270', ears: 'hidden' },
      outfit: { type: 'coat', main: '#9a86b8', sub: '#5c4c70', trim: '#d8c080' }, headwear: 'circlet', metal: 'gold', hue: 280, silhouette: 'bob_circlet' },
    shigure: { name: 'シグレ', body: m('slim'), skin: 'fair', eyes: '#2c2c34', hair: { style: 'tail', color: '#26242c', ears: 'hidden' },
      outfit: { type: 'hakama', main: '#3c4a6c', sub: '#2c3040', trim: '#d8d2c0' }, hue: 225, silhouette: 'topknot' },
    rouga: { name: 'ロウガ', body: m('normal', 'youth'), skin: 'tan', eyes: '#3a2c24', hair: { style: 'spiky', color: '#2a2422', ears: 'hidden' },
      outfit: { type: 'gi', main: '#a8402e', sub: '#3a2c24', trim: '#e0d0a0' }, headwear: { type: 'headband', color: '#d8d0b8' }, bareArms: true, hue: 4, silhouette: 'spiky_headband' },
    titta: { name: 'ティッタ', body: f('slim', 'youth'), skin: 'fair', eyes: '#4a6a3a', hair: { style: 'pigtails', color: '#b0502a', ears: 'hidden' },
      outfit: { type: 'light', main: '#4a7a44', sub: '#5a4030', trim: '#e0d0a0' }, headwear: { type: 'bandana', color: '#c8a040' }, extras: ['freckles'], hue: 112, silhouette: 'pigtails_bandana' },
    brigitta: { name: 'ブリギッタ', body: f('normal'), skin: 'fair', eyes: '#4a5a3a', hair: { style: 'braid', color: '#7a4a2a', ears: 'hidden' },
      outfit: { type: 'tunic', main: '#6a7040', sub: '#4a4a44', trim: '#b89050' }, pauldron: true, headwear: 'kettle', hue: 78, silhouette: 'kettle_braid' },
    sylvain: { name: 'シルヴァン', body: m('slim'), skin: 'forest', eyes: '#2c6a4c', hair: { style: 'long', color: '#9aa66a', ears: 'elf' },
      outfit: { type: 'light', main: '#2c5c4c', sub: '#5a4a34', trim: '#d0c890' }, mantle: '#2a4a3a', headwear: { type: 'feather', color: '#3a5a44' }, hue: 158, silhouette: 'feather_elf' },
    zafira: { name: 'ザフィラ', body: f('slim'), skin: 'brown', eyes: '#6a3a50', hair: { style: 'wave', color: '#5a2448', ears: 'show' },
      outfit: { type: 'light', main: '#c08a30', sub: '#8c2c5c', trim: '#f0d060' }, bareArms: true, headwear: 'circlet', extras: ['earrings'], metal: 'gold', hue: 40, silhouette: 'wave_circlet' },
    ferno: { name: 'フェルノ', body: m('slim'), skin: 'fair', eyes: '#3a4a5a', hair: { style: 'short', color: '#6a4a2c', ears: 'hidden' },
      outfit: { type: 'tunic', main: '#3c6c9c', sub: '#d8ccb0', trim: '#c84868' }, mantle: '#2c4a6c', headwear: { type: 'beret', color: '#a83c50' }, hue: 208, silhouette: 'beret' },
    belladonna: { name: 'ベラドナ', body: f(), skin: 'fair', eyes: '#3c6c54', hair: { style: 'bun', color: '#2c5a44', ears: 'hidden' },
      outfit: { type: 'coat', main: '#6a3c64', sub: '#d8d0bc', trim: '#6aa04a' }, headwear: { type: 'wide', color: '#4a2c48' }, hue: 312, silhouette: 'wide_hat' },
    boden: { name: 'ボーデン', body: m('sturdy', 'old'), skin: 'tan', eyes: '#4a4030', hair: { style: 'bald', color: '#a8a4a0', ears: 'show' },
      outfit: { type: 'coat', main: '#5c6a48', sub: '#4a4a54', trim: '#d0a848' }, headwear: 'kettle', extras: ['glasses', 'beard'], beard: '#b0aca8', hue: 95, silhouette: 'kettle_glasses' },
    teo: { name: 'テオ', body: m('slim', 'short'), skin: 'fair', eyes: '#6a3c2c', hair: { style: 'swept', color: '#c46a2c', ears: 'hidden' },
      outfit: { type: 'robe', main: '#54408c', sub: '#3a2c5c', trim: '#e0b048' }, headwear: { type: 'pointed', color: '#48387a' }, hue: 262, silhouette: 'pointed_hat' },
    ilse: { name: 'イルゼ', body: f(), skin: 'pale', eyes: '#3c4a86', hair: { style: 'long', color: '#d8d0c0', ears: 'hidden' },
      outfit: { type: 'robe', main: '#3a4a8a', sub: '#262c54', trim: '#e8d890' }, extras: ['glasses'], hue: 238, silhouette: 'long_glasses' },
    morga: { name: 'モルガ', body: f('slim', 'old'), skin: 'pale', eyes: '#5a4a6a', hair: { style: 'long', color: '#8a8490', ears: 'hidden' },
      outfit: { type: 'robe', main: '#4c2c54', sub: '#2c1c34', trim: '#8a8a70' }, headwear: { type: 'hood', color: '#3a2442' }, mantle: '#34203a', hue: 292, silhouette: 'hood' },
    marta: { name: 'マルタ', body: f(), skin: 'fair', eyes: '#3c5a5a', hair: { style: 'bun', color: '#5a3a2a', ears: 'hidden' },
      outfit: { type: 'coat', main: '#3c7a80', sub: '#e0dccc', trim: '#e0e0d8' }, headwear: { type: 'cap', color: '#e8e4d8' }, hue: 185, silhouette: 'nurse_cap' },
    noela: { name: 'ノエラ', body: f('slim', 'youth'), skin: 'fair', eyes: '#6a3a3a', hair: { style: 'long', color: '#2a2430', ears: 'hidden' },
      outfit: { type: 'hakama', main: '#e8e2d8', sub: '#a03848', trim: '#c8a048' }, headwear: { type: 'veil', color: '#f0ece4' }, hue: 340, silhouette: 'veil' },
  });
})(window.RPG);
