// CAST: 主人公の見た目 R.DB.looks['hero_<m|f>_<type>']（K.look、V2_PLAN §2.6.2）。5 タイプ × 2。
// 公式デザイン（A34）: 旅する剣士・赤いマフラー（design/art_ref/hero_sheet_owner.png）。hero_m_warrior はアルンの設定資料そのもの
// （原画のスプライト v2/assets/sprites/hero_m_warrior/ がある間はそちらが使われる）。ほかの 9 つは同じ「赤いマフラーの旅人」の型違い（仮の絵）。
// hue = 主色（服）の色相。silhouette = 頭の輪郭（見分け用）。
(function (R) {
  'use strict';
  const SCARF = '#9a3428';   // 赤いマフラー（全員に共通の印）
  function hero(sex, o) {
    return Object.assign({
      body: { sex, build: 'normal', age: 'youth' }, skin: 'fair', eyes: sex === 'm' ? '#3c5468' : '#4a5a70',
      extras: [], scarf: SCARF,
    }, o);
  }
  R.defs('looks', {
    // --- 男
    hero_m_warrior: hero('m', { name: '旅の剣士', hair: { style: 'spiky', color: '#b89c7c', ears: 'hidden' },
      outfit: { type: 'coat', main: '#3a4458', sub: '#b8a888', trim: '#8a6a44' }, pauldron: true, hue: 220, silhouette: 'spiky' }),
    hero_m_ranger: hero('m', { name: '旅の狩人', hair: { style: 'swept', color: '#a88c6c', ears: 'hidden' },
      outfit: { type: 'light', main: '#4a5e3a', sub: '#5a4a38', trim: '#a08a5c' }, mantle: '#3e4a34', headwear: { type: 'hood', color: '#4a5a3c' }, hue: 95, silhouette: 'hood' }),
    hero_m_mage: hero('m', { name: '旅の術師', hair: { style: 'short', color: '#b89c7c', ears: 'hidden' },
      outfit: { type: 'robe', main: '#3c3e6c', sub: '#2c2c48', trim: '#b89a5c' }, hue: 238, silhouette: 'short' }),
    hero_m_spellblade: hero('m', { name: '旅の術剣士', hair: { style: 'wild', color: '#a8906c', ears: 'hidden' },
      outfit: { type: 'coat', main: '#2e5a60', sub: '#3a3a44', trim: '#c0a060' }, mantle: '#2a3a44', hue: 186, silhouette: 'wild' }),
    hero_m_wanderer: hero('m', { name: '旅人', hair: { style: 'tail', color: '#a88c6c', ears: 'hidden' },
      outfit: { type: 'tunic', main: '#6a5238', sub: '#4a4034', trim: '#a88c5c' }, mantle: { color: '#5a4a3a', long: true }, hue: 32, silhouette: 'tail' }),
    // --- 女
    hero_f_warrior: hero('f', { name: '旅の剣士', hair: { style: 'ponytail', color: '#b89c7c', ears: 'hidden' },
      outfit: { type: 'coat', main: '#3a4458', sub: '#b8a888', trim: '#8a6a44' }, pauldron: true, hue: 220, silhouette: 'ponytail' }),
    hero_f_ranger: hero('f', { name: '旅の狩人', hair: { style: 'braid', color: '#a88c6c', ears: 'hidden' },
      outfit: { type: 'light', main: '#4a5e3a', sub: '#5a4a38', trim: '#a08a5c' }, mantle: '#3e4a34', hue: 95, silhouette: 'braid' }),
    hero_f_mage: hero('f', { name: '旅の術師', hair: { style: 'long', color: '#b89c7c', ears: 'hidden' },
      outfit: { type: 'robe', main: '#3c3e6c', sub: '#2c2c48', trim: '#b89a5c' }, hue: 238, silhouette: 'long' }),
    hero_f_spellblade: hero('f', { name: '旅の術剣士', hair: { style: 'bob', color: '#a8906c', ears: 'hidden' },
      outfit: { type: 'coat', main: '#2e5a60', sub: '#3a3a44', trim: '#c0a060' }, mantle: '#2a3a44', hue: 186, silhouette: 'bob' }),
    hero_f_wanderer: hero('f', { name: '旅人', hair: { style: 'bun', color: '#a88c6c', ears: 'hidden' },
      outfit: { type: 'tunic', main: '#6a5238', sub: '#4a4034', trim: '#a88c5c' }, mantle: { color: '#5a4a3a', long: true }, hue: 32, silhouette: 'bun' }),
  });
})(window.RPG);
