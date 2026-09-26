// V4 — "Soft": the V1 drawing re-rendered with a softer, lighter palette and a selective outline
// (every outline pixel becomes the darkest tone of the material it borders; no black anywhere),
// warm-brown lashes, lower contrast. Shows how much the rendering treatment alone changes the feel.
'use strict';
(function (G) {
  const C = G.C5, R = C.ramp, V1 = G.VARIANTS.v1;
  const pal = {};
  const put = (keys, list) => keys.split('').forEach((k, i) => (pal[k] = list[i]));
  put('X', ['#3a2a36']);                         // only used where no material borders (fallback)
  put('Z', ['#5a2e30']);                         // lashes: warm brown, not black
  put('1234', R([[10, 0.50, 0.58], [17, 0.40, 0.80], [24, 0.25, 0.96], [34, 0.11, 1.0]]));
  put('5', ['#f2a898']);
  put('abcde', R([[354, 0.44, 0.34], [8, 0.48, 0.47], [18, 0.50, 0.62], [27, 0.46, 0.77], [38, 0.34, 0.91]]));
  put('ABCDEF', R([[244, 0.36, 0.30], [230, 0.34, 0.41], [220, 0.32, 0.54], [212, 0.28, 0.66], [204, 0.22, 0.78], [192, 0.14, 0.89]]));
  put('mnop', R([[8, 0.46, 0.60], [20, 0.42, 0.78], [32, 0.34, 0.91], [44, 0.18, 0.99]]));    // dusty coral-amber scarf
  put('ghij', R([[330, 0.22, 0.26], [355, 0.20, 0.36], [12, 0.20, 0.47], [24, 0.18, 0.58]]));
  put('KLMN', R([[354, 0.42, 0.30], [10, 0.46, 0.44], [22, 0.46, 0.59], [32, 0.38, 0.74]]));
  put('OPRSW', R([[240, 0.20, 0.36], [226, 0.14, 0.55], [212, 0.10, 0.74], [200, 0.05, 0.90], [50, 0.04, 1.0]]));
  put('GHJ', R([[24, 0.60, 0.56], [36, 0.52, 0.80], [48, 0.32, 0.97]]));
  put('yY', R([[196, 0.56, 0.58], [178, 0.40, 0.86]]));
  put('TUV', ['#fff8dc', '#ffc85a', '#e0802a']);

  const v = {};
  for (const k in V1.views) v[k] = Object.assign({}, V1.views[k]);

  G.VARIANTS.v4 = {
    id: 'v4', short: 'soft sel-out', name: 'やわらかい配色＋選択的な縁（黒を使わない）',
    desc: 'V1 と同じ形を、明るく低めの彩度の配色と「素材の暗色で縁取る」選択的な縁で描き直したもの。黒は一切なし、まつ毛も焦げ茶。',
    pal, selout: true, selDefault: '#3a2a36',
    mats: V1.mats,
    emissive: 'TUV', noLit: 'ZWyY', outlineKeys: 'X',
    lit: { half: 0.7, amb: [0.46, 0.46, 0.68], ambAdd: [16, 12, 30], rimK: 0.4 },
    battleZoom: 4,
    views: v,
  };
})(window);
