// CAST: 見た目のデータ（R.DB.looks[id]、K.look）→ 骨組みの素材の組（仮の絵）。服の型・体つき・年・小物。
//   R.Art.rig.fromLook(id | look) → L（rig.draw に渡す。id ごとに覚える）
//   R.Art.rig.shades(hex, n?) → 段の色（暗い → 明るい。影は寒色へ、光は暖色へ。夜の落ち着いた彩度）
(function (R) {
  'use strict';
  const rig = (R.Art = R.Art || {}).rig = (R.Art.rig || {});
  const cache = {};

  function hexToHsl(h) {
    h = String(h).replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let hh = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hh *= 60;
    }
    return [hh, s, l];
  }
  function hsl(hh, s, l) {
    hh = ((hh % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0.03, Math.min(0.97, l));
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
    const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
  }
  rig.hexToHsl = hexToHsl;
  /** 1 色 → 段（暗 → 明）。影は色相を青へ 12°、光は黄へ 8° ずらす（STYLE_REFERENCE の夜の色の決まり） */
  rig.shades = function (hex, n) {
    n = n || 5;
    const [h, s, l] = hexToHsl(hex);
    const toward = (a, target, k) => { let d = ((target - a + 540) % 360) - 180; return a + d * k; };
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);                       // 0 暗 … 1 明
      const lt = l * (0.28 + t * 0.95) + (t > 0.8 ? (t - 0.8) * 0.35 : 0);
      const hh = t < 0.6 ? toward(h, 235, (0.6 - t) * 0.22) : toward(h, 50, (t - 0.6) * 0.18);
      const ss = s * (0.8 + 0.2 * Math.sin(t * Math.PI));
      out.push(hsl(hh, ss, lt));
    }
    return out;
  };
  const SKIN = {
    fair: ['#46282a', '#84523f', '#bb866a', '#deb496', '#f4d8c0'],
    tan: ['#3e2220', '#74442f', '#a86e52', '#cc9a78', '#e8c2a2'],
    brown: ['#2c1814', '#583222', '#86553a', '#aa7a58', '#cca080'],
    pale: ['#4a3034', '#8c6660', '#c4a090', '#e4cab8', '#f8e8dc'],
    forest: ['#3a2c24', '#6c5646', '#a08870', '#c8b096', '#e6d6c0'],
    spirit: ['#2a3450', '#4a5c84', '#7890bc', '#a8c0e4', '#dceaff'],
  };
  rig.SKINS = SKIN;

  /** 見た目 → L */
  rig.fromLook = function (idOrLook) {
    const id = typeof idOrLook === 'string' ? idOrLook : null;
    if (id && cache[id]) return cache[id];
    const lk = id ? (R.DB.looks || {})[id] : idOrLook;
    if (!lk) return null;
    const { mat } = R.Hd.RZ;
    const MM = rig.M();
    const cloth = (hex, o) => mat(Object.assign({ keys: rig.shades(hex, 5), n: 6, wrap: 0.3, tex: 0.5, tsx: 1.4, tsy: 0.3 }, o));
    const hairM = (hex) => mat({ keys: rig.shades(hex, 6), n: 6, sheen: [-0.62, -0.28], wrap: 0.35, amb: 0.22, tex: 1.1, tsx: 0.25, tsy: 1.6 });
    const b = lk.body || {}, hr = lk.hair || {}, of = lk.outfit || {};
    const skinKeys = SKIN[lk.skin] || (String(lk.skin || '').charAt(0) === '#' ? rig.shades(lk.skin, 5) : SKIN.fair);
    const L = {
      id, name: lk.name,
      skin: mat({ keys: skinKeys, n: 6, rim: '#fff0d8', wrap: 0.45, amb: 0.3 }),
      skinHex: skinKeys.slice(1, 5),
      hair: hairM(hr.color || '#4a3424'), hairStyle: hr.style || 'short', ears: hr.ears || 'hidden',
      eye: mat({ keys: rig.shades(lk.eyes || '#46687c', 4), n: 4, flat: true }),
      top: cloth(of.main || '#56607a'), trim: cloth(of.trim || '#b89a60'),
      pants: cloth(of.sub || '#4a4238'), boots: MM.leather, belt: MM.leatherDk, metal: MM.steel,
      weapon: 'sword', fem: b.sex === 'f', bw: b.build === 'slim' ? 0.9 : b.build === 'sturdy' ? 1.14 : 1,
      old: b.age === 'old', hunch: b.age === 'old' ? 0.08 : 0, extras: lk.extras || [],
    };
    if (lk.metal === 'gold') L.metal = MM.gold;
    // 服の型（K.look.outfit.type）
    switch (of.type) {
      case 'armor': L.armor = 'plate'; L.pauldron = true; break;
      case 'robe': L.robe = true; L.skirt = { flare: 9.5, hem: 14.2 }; L.pants = L.top; break;
      case 'coat': L.skirt = { flare: 8.6, hem: 10.5 }; L.pauldron = false; break;
      case 'hakama': L.skirt = { flare: 9.2, hem: 12.5 }; L.skirtM = L.pants; L.gi = true; break;
      case 'gi': L.gi = true; L.skirt = { flare: 7.4, hem: 5.5 }; break;
      case 'light': L.skirt = { flare: 6.6, hem: 2.6 }; L.bareArms = !!lk.bareArms; break;
      case 'dwarf': L.armor = 'vest'; L.vest = cloth(of.sub || '#6a5a48'); L.pants = cloth(of.trim || '#4a4238'); L.bw = Math.max(L.bw, 1.18); break;
      default: L.skirt = { flare: 7.2, hem: 4.6 }; if (lk.pauldron) L.pauldron = true;
    }
    if (lk.mantle) { const mc = typeof lk.mantle === 'string' ? lk.mantle : lk.mantle.color; L.cape = cloth(mc); L.capeLong = !!(lk.mantle && lk.mantle.long); }
    if (lk.scarf) L.scarf = cloth(lk.scarf);
    const hw = lk.headwear;
    if (hw) { L.headwear = typeof hw === 'string' ? hw : hw.type; const hc = typeof hw === 'object' && hw.color; if (hc) L.hwM = cloth(hc); else if (!L.cape) L.hwM = L.trim; }
    if (L.headwear === 'hood') L.hood = true;
    if (lk.beard) L.beardM = hairM(lk.beard);
    // 年・背の高さ（短い人はふとももとすねを縮め、頭は大きめ）
    if (b.age === 'short' || b.age === 'youth') {
      L.legK = b.age === 'short' ? 0.78 : 0.9;
      L.headScale = b.age === 'short' ? 0.94 : 0.9;
    }
    L.heightK = b.age === 'short' ? 0.8 : b.age === 'youth' ? 0.92 : 1;
    L.animal = lk.animal || null;
    if (id) cache[id] = L;
    return L;
  };
  rig.forget = function (id) { if (id) delete cache[id]; else for (const k of Object.keys(cache)) delete cache[k]; };
})(window.RPG);
