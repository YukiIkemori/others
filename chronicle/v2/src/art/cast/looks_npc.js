// CAST: 物語の人・名前のある町の人・町の人の型の見た目 R.DB.looks（K.look、V2_PLAN §2.6.2・§3.8）。
//   物語の人 berna rowell fine otto elm、名前のある町の人 npc_hanna … npc_yura_elder（顔あり）、
//   町の人の型 npc_<型>_<1〜4>（型 12 × 色の組 4。顔なし）。原画（A35）が届くまでの仮の絵のデータ。
//   CONTENT はこの一覧から選ぶ。足りない型は CAST に依頼（requests.jsonl）。
(function (R) {
  'use strict';
  const m = (build, age) => ({ sex: 'm', build: build || 'normal', age: age || 'adult' });
  const f = (build, age) => ({ sex: 'f', build: build || 'slim', age: age || 'adult' });
  const hueOf = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round(h * 60) % 360;
  };
  const T = {};
  // --- 物語の人（顔あり）
  T.berna = { name: R.T('art.looks_npc.berna.name'), body: f('normal', 'old'), skin: 'fair', eyes: '#5a4a3a', hair: { style: 'bun', color: '#b8b0a8', ears: 'hidden' },
    outfit: { type: 'coat', main: '#7a3c34', sub: '#e0d4bc', trim: '#c8a860' }, mantle: '#4a3a44', extras: ['glasses'], silhouette: 'bun_glasses' };
  T.rowell = { name: R.T('art.looks_npc.rowell.name'), body: m('slim'), skin: 'fair', eyes: '#3a4a5a', hair: { style: 'swept', color: '#3a3440', ears: 'hidden' },
    outfit: { type: 'robe', main: '#2c3a54', sub: '#1c2436', trim: '#c8b070' }, mantle: { color: '#262c40', long: true }, extras: ['glasses'], silhouette: 'swept' };
  T.fine = { name: R.T('art.looks_npc.fine.name'), body: f('slim', 'youth'), skin: 'pale', eyes: '#6a7a8a', hair: { style: 'long', color: '#c8ccd4', ears: 'hidden' },
    outfit: { type: 'coat', main: '#6a6c74', sub: '#4a4c54', trim: '#a8aab0' }, mantle: { color: '#5c5e66', long: true }, headwear: { type: 'hood', color: '#5c5e66' }, silhouette: 'grey_hood' };
  T.otto = { name: R.T('art.looks_npc.otto.name'), body: m('sturdy', 'old'), skin: 'tan', eyes: '#3a4a5a', hair: { style: 'crop', color: '#d0ccc4', ears: 'hidden' },
    outfit: { type: 'coat', main: '#2c4a64', sub: '#e0d8c4', trim: '#c8a048' }, headwear: { type: 'cap', color: '#2a3a50' }, extras: ['beard'], beard: '#d8d4cc', silhouette: 'cap_beard' };
  T.elm = { name: R.T('art.looks_npc.elm.name'), body: m('slim', 'old'), skin: 'spirit', eyes: '#a8e0ff', hair: { style: 'long', color: '#c8e4f0', ears: 'elf' },
    outfit: { type: 'robe', main: '#6a9ab8', sub: '#4a7090', trim: '#d8f0ff' }, extras: ['beard'], beard: '#d8ecf4', spirit: true, silhouette: 'spirit' };
  // --- 名前のある町の人（顔あり）
  T.npc_hanna = { name: R.T('art.looks_npc.npc_hanna.name'), body: f('normal'), skin: 'fair', eyes: '#4a5a3a', hair: { style: 'ponytail', color: '#8a5a30', ears: 'hidden' },
    outfit: { type: 'tunic', main: '#a05840', sub: '#e8e0cc', trim: '#e0b860' }, headwear: { type: 'bandana', color: '#e8e0cc' }, silhouette: 'bandana_tail' };
  T.npc_rita = { name: R.T('art.looks_npc.npc_rita.name'), body: f('slim', 'youth'), skin: 'fair', eyes: '#3a5a6a', hair: { style: 'bob', color: '#c89048', ears: 'hidden' },
    outfit: { type: 'light', main: '#3c7a8a', sub: '#4a4034', trim: '#e0d0a0' }, silhouette: 'bob' };
  T.npc_gord = { name: R.T('art.looks_npc.npc_gord.name'), body: m('sturdy'), skin: 'tan', eyes: '#3a3024', hair: { style: 'short', color: '#4a3020', ears: 'hidden' },
    outfit: { type: 'tunic', main: '#7a4a2c', sub: '#3c4a30', trim: '#a88a50' }, extras: ['beard'], silhouette: 'woodsman_beard' };
  T.npc_pim_mother = { name: R.T('art.looks_npc.npc_pim_mother.name'), body: f('normal'), skin: 'fair', eyes: '#4a3a2c', hair: { style: 'bun', color: '#5a3a24', ears: 'hidden' },
    outfit: { type: 'robe', main: '#6a7a4a', sub: '#e0d8c0', trim: '#c89a5a' }, headwear: { type: 'bandana', color: '#c8b890' }, silhouette: 'bun_scarf' };
  T.npc_pim = { name: R.T('art.looks_npc.npc_pim.name'), body: m('slim', 'short'), skin: 'fair', eyes: '#4a3a2c', hair: { style: 'wild', color: '#6a4228', ears: 'hidden' },
    outfit: { type: 'light', main: '#6a8a3c', sub: '#5a4630', trim: '#d8c890' }, silhouette: 'child_wild' };
  T.npc_hans = { name: R.T('art.looks_npc.npc_hans.name'), body: m('sturdy'), skin: 'tan', eyes: '#3a3024', hair: { style: 'crop', color: '#7a5a38', ears: 'show' },
    outfit: { type: 'tunic', main: '#5a6a3c', sub: '#4a3a2c', trim: '#a88a50' }, headwear: { type: 'cap', color: '#6a4a30' }, silhouette: 'cap' };
  T.npc_ben = { name: R.T('art.looks_npc.npc_ben.name'), body: m('normal'), skin: 'fair', eyes: '#3a4a3a', hair: { style: 'spiky', color: '#a8702c', ears: 'hidden' },
    outfit: { type: 'tunic', main: '#8a5c30', sub: '#3c4a30', trim: '#c8a860' }, extras: ['beard'], silhouette: 'spiky_beard' };
  T.npc_roy = { name: R.T('art.looks_npc.npc_roy.name'), body: m('slim', 'youth'), skin: 'fair', eyes: '#3a4a5a', hair: { style: 'short', color: '#3a2c20', ears: 'hidden' },
    outfit: { type: 'tunic', main: '#4a6a5a', sub: '#4a3a2c', trim: '#c0a060' }, headwear: { type: 'headband', color: '#a8402e' }, silhouette: 'headband' };
  // ファロス（CONTENT-P の依頼）: 灯守組合の油売り・静夜会の説き手（顔は neutral だけ使う）
  T.npc_tadeo = { name: R.T('art.looks_npc.npc_tadeo.name'), body: m('sturdy'), skin: 'tan', eyes: '#4a3a2c', hair: { style: 'short', color: '#5a3c24', ears: 'show' },
    outfit: { type: 'coat', main: '#a0582c', sub: '#e0cfa8', trim: '#d8a040' }, headwear: { type: 'cap', color: '#6a4228' }, extras: ['beard'], beard: '#5a3c24', silhouette: 'cap_oilseller' };
  T.npc_yena = { name: R.T('art.looks_npc.npc_yena.name'), body: f('slim'), skin: 'fair', eyes: '#5a6a7a', hair: { style: 'long', color: '#4a4454', ears: 'hidden' },
    outfit: { type: 'robe', main: '#5a6a84', sub: '#3c4658', trim: '#b8c0cc' }, mantle: { color: '#4c5a70', long: true }, headwear: { type: 'hood', color: '#4c5a70' }, silhouette: 'blue_hood' };
  T.npc_yura_elder = { name: R.T('art.looks_npc.npc_yura_elder.name'), body: f('slim', 'old'), skin: 'forest', eyes: '#6a7a5a', hair: { style: 'long', color: '#e0dcd0', ears: 'hidden' },
    outfit: { type: 'robe', main: '#5a6c4c', sub: '#3a4a34', trim: '#d8c890' }, headwear: { type: 'veil', color: '#8a9a78' }, silhouette: 'elder_veil' };

  // --- 町の人の型（色の組 1〜4。顔なし）。[体, 髪の型, かぶり物, 服の型, 色の組[main, sub, trim, hair]×4]
  const TYPES = {
    man: [m(), 'short', null, 'tunic', [['#6a5238', '#4a4034', '#a88c5c', '#4a3020'], ['#3c5a6c', '#4a4238', '#c0a060', '#2a2420'], ['#6a3c34', '#3c3a34', '#c8a860', '#8a5a30'], ['#4a6040', '#4a3a2c', '#b09050', '#5a4030']]],
    woman: [f(), 'bob', null, 'robe', [['#8a4a4a', '#e0d8c4', '#d8b060', '#5a3a24'], ['#4a5a7a', '#e0d8c4', '#c8a860', '#8a5a30'], ['#6a7a4a', '#e0d8c4', '#c89a5a', '#2a2420'], ['#7a5a8a', '#e0d8c4', '#d8c080', '#b07030']]],
    old_m: [m('normal', 'old'), 'short', null, 'coat', [['#5a4a3a', '#4a4034', '#a88c5c', '#c8c4bc'], ['#4a5a6a', '#3c3a34', '#a8a080', '#d8d4cc'], ['#6a5a3c', '#4a4238', '#b09050', '#a8a4a0'], ['#4a3c4c', '#3c3a34', '#a89070', '#e0dcd4']]],
    old_f: [f('slim', 'old'), 'bun', null, 'robe', [['#6a4a54', '#d8d0bc', '#c8a870', '#c8c4bc'], ['#4a5a5a', '#d8d0bc', '#b8a070', '#d8d4cc'], ['#7a6040', '#d8d0bc', '#c8a060', '#a8a4a0'], ['#5a4a6a', '#d8d0bc', '#c8b080', '#e0dcd4']]],
    child: [m('slim', 'short'), 'wild', null, 'light', [['#8a6a3c', '#5a4630', '#d8c890', '#6a4228'], ['#3c6a8a', '#4a4034', '#e0d0a0', '#2a2420'], ['#8a3c3c', '#4a4034', '#e0d0a0', '#b07030'], ['#5a7a3c', '#4a4034', '#e0d0a0', '#8a5a30']]],
    sailor: [m('sturdy'), 'crop', 'bandana', 'tunic', [['#2c3a5a', '#d8d0c0', '#c8b890', '#3a2c20'], ['#e0dccc', '#2c3a5a', '#3c5a8a', '#6a4228'], ['#3a4a6a', '#6a5a4a', '#e0d8c0', '#2a2420'], ['#2c4a5a', '#d8d0c0', '#a83c3c', '#8a5a30']]],
    merchant: [m('sturdy'), 'short', 'cap', 'coat', [['#6a4a2a', '#e0d4b0', '#d8b050', '#3a2c20'], ['#2c5a4a', '#d8ccb0', '#d8b050', '#5a3a24'], ['#6a2c3c', '#d8ccb0', '#d8b050', '#2a2420'], ['#4a3a6a', '#d8ccb0', '#d8b050', '#8a6a44']]],
    woodcutter: [m('sturdy'), 'short', 'cap', 'tunic', [['#7a4a2c', '#3c4a30', '#a88a50', '#4a3020'], ['#6a3a2a', '#4a4a34', '#a88a50', '#8a5a30'], ['#5a6a3c', '#4a3a2c', '#a88a50', '#3a2c20'], ['#8a5c30', '#3c3a30', '#a88a50', '#6a4228']]],
    guard: [m('normal'), 'short', 'helm', 'armor', [['#4a5a7a', '#4a4450', '#c8a860', '#3a2c20'], ['#7a3c34', '#4a4450', '#c8a860', '#6a4228'], ['#3c5a4a', '#4a4450', '#c8a860', '#2a2420'], ['#5a4a6a', '#4a4450', '#c8a860', '#8a5a30']]],
    keeper: [f('normal'), 'ponytail', null, 'coat', [['#7a5a3a', '#e8e0cc', '#c8a060', '#5a3a24'], ['#5a3a4a', '#e8e0cc', '#c8a060', '#2a2420'], ['#3a5a5a', '#e8e0cc', '#c8a060', '#8a5a30'], ['#6a6a3a', '#e8e0cc', '#c8a060', '#b07030']]],
    bard: [m('slim'), 'swept', 'feather', 'tunic', [['#3c6c9c', '#d8ccb0', '#c84868', '#6a4a2c'], ['#8a3c5c', '#d8ccb0', '#d8b050', '#2a2420'], ['#3c7a5a', '#d8ccb0', '#c8a060', '#8a5a30'], ['#6a4a8a', '#d8ccb0', '#d8b050', '#3a2c20']]],
    yura_folk: [f('slim'), 'long', 'veil', 'robe', [['#5a6c4c', '#3a4a34', '#d8c890', '#4a3a2c'], ['#6a5a3c', '#3a4a34', '#d8c890', '#2a2420'], ['#4c5a6c', '#3a3a4a', '#d8c890', '#6a4a30'], ['#6c4c4c', '#4a3a34', '#d8c890', '#8a6a44']]],
  };
  for (const [ty, [body, hs, hw, of, sets]] of Object.entries(TYPES)) {
    sets.forEach((c, i) => {
      const id = `npc_${ty}_${i + 1}`;
      T[id] = { name: '', body, skin: ['fair', 'tan', 'fair', 'brown'][i], eyes: '#3a4a5a', hair: { style: hs, color: c[3], ears: hs === 'bald' ? 'show' : 'hidden' },
        outfit: { type: of, main: c[0], sub: c[1], trim: c[2] }, silhouette: ty, face: false };
      if (hw) T[id].headwear = hw === 'helm' || hw === 'feather' ? hw : { type: hw, color: c[2] };
      if (ty === 'old_m') T[id].extras = ['beard'];
    });
  }
  // 町の人の型の呼び名（話者の名前が npc.name に無いとき）
  const NAME = { man: R.T('art.looks_npc.NAME.man'), woman: R.T('art.looks_npc.NAME.woman'), old_m: R.T('art.looks_npc.NAME.old_m'), old_f: R.T('art.looks_npc.NAME.old_f'), child: R.T('art.looks_npc.NAME.child'), sailor: R.T('art.looks_npc.NAME.sailor'), merchant: R.T('art.looks_npc.NAME.merchant'), woodcutter: R.T('art.looks_npc.NAME.woodcutter'),
    guard: R.T('art.looks_npc.NAME.guard'), keeper: R.T('art.looks_npc.NAME.keeper'), bard: R.T('art.looks_npc.NAME.bard'), yura_folk: R.T('art.looks_npc.NAME.yura_folk') };
  for (const id of Object.keys(T)) {
    const mm = /^npc_([a-z_]+)_\d$/.exec(id);
    if (mm && NAME[mm[1]]) T[id].name = NAME[mm[1]];
    if (T[id].hue == null) T[id].hue = hueOf(T[id].outfit.main);
    if (!T[id].extras) T[id].extras = [];
  }
  R.defs('looks', T);
})(window.RPG);
