// 属性 6 つ（火・水・風・土・光・闇）。DESIGN §7.9.1 が正本。この並びが正式な並び順（§3.1.1）。
//   name   表示名（1 字）        color  数字・術の書の印・閃きの札の色（§11.5.7）
//   fx     演出の既定（光は holy）  sfx    効果音（light は無い間 holy で鳴らす。§3.1.3）
//   icon   8×8 の印（art-chars）   weakTo その属性の親和を持つ魔物の弱点（§4.7.2 の輪と対）
(function (R) {
  'use strict';
  Object.assign(R.DB.elements, {
    fire:  { name: '火', color: '#ff7038', fx: 'fire',  sfx: 'fire',  icon: 'icon:el_fire',  weakTo: 'water' },
    water: { name: '水', color: '#48a8ff', fx: 'water', sfx: 'water', icon: 'icon:el_water', weakTo: 'earth' },
    wind:  { name: '風', color: '#68dc88', fx: 'wind',  sfx: 'wind',  icon: 'icon:el_wind',  weakTo: 'fire' },
    earth: { name: '土', color: '#c89850', fx: 'earth', sfx: 'earth', icon: 'icon:el_earth', weakTo: 'wind' },
    light: { name: '光', color: '#fff0a0', fx: 'holy',  sfx: 'light', icon: 'icon:el_light', weakTo: 'dark' },
    dark:  { name: '闇', color: '#a068e0', fx: 'dark',  sfx: 'dark',  icon: 'icon:el_dark',  weakTo: 'light' },
  });
})(window.RPG);
