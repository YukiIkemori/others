// CAST: 仮の絵のかぶり物（プロトの helm・hood・circlet に型を足した）。R.DB.looks[id].headwear = 型の名前 か {type, color}
//   R.Art.rig.headwear.TYPES / draw(ctx)
(function (R) {
  'use strict';
  const rig = (R.Art = R.Art || {}).rig = (R.Art.rig || {});
  const hw = (rig.headwear = rig.headwear || {});
  hw.TYPES = ['hood', 'helm', 'plume', 'circlet', 'headband', 'bandana', 'beret', 'wide', 'kettle', 'pointed', 'cap', 'veil', 'goggles', 'feather', 'straw'];

  hw.draw = function (c) {
    const { L, H, ha, grp, E, C, S, Pl, F, M, z0 } = c;
    const t = L.headwear;
    if (!t) return;
    const m = L.hwM || L.cape || L.trim;
    const gem = () => R.Hd.RZ.mat({ keys: ['#400c30', '#a0206a', '#ff5ab0', '#ffd0f0'], n: 5, spec: 1 });
    switch (t) {
      case 'circlet': {
        C(H(-10, -4), H(10.5, -5.2), 0.7, 0.7, M.gold, z0 + 0.5, { g: grp('circlet') });
        const q = H(6.5, -6.3); E(q[0], q[1], 1.3, 1.3, L.gemM || gem(), z0 + 0.52, { g: grp('gem') });
        break;
      }
      case 'headband': case 'bandana': {
        C(H(-11.5, -3.6), H(10.8, -5.6), 1.3, 1.3, m, z0 + 0.5, { g: grp('band') });
        if (t === 'bandana') { E(H(-3, -10)[0], H(-3, -10)[1], 11, 5.5, m, z0 + 0.49, { g: grp('bandtop'), rot: ha }); }
        S([H(-11.5, -3.5), H(-15, 0), H(-16, 5)], 1.2, 0.5, m, 9.4, {});
        S([H(-11.5, -3.5), H(-14, 2), H(-13, 7)], 1.0, 0.4, m, 9.41, {});
        break;
      }
      case 'helm': case 'plume': {
        const gm = grp('helm'), mt = L.metal || M.iron;
        E(H(-1.2, -6.2)[0], H(-1.2, -6.2)[1], 12.4, 7.8, mt, 10.7, { g: gm, rot: ha });
        C(H(-12.8, -2.6), H(11.6, -3.8), 1.5, 1.5, mt, 10.72, { g: grp('helmrim'), shadeOff: -0.5 });
        for (let i = 0; i < 5; i++) { const q = H(-9 + i * 4.4, -3.3 - i * 0.1); E(q[0], q[1], 0.7, 0.7, M.gold, 10.74, { g: grp('rivet' + i) }); }
        C(H(9.8, -3.2), H(10.8, 1.2), 1.0, 0.7, mt, 10.73, { g: grp('nasal') });
        F(H(-6, -10), H(6, -9), 0.8, gm, -1);
        if (t === 'plume') { S([H(-2, -13), H(-8, -20), H(-17, -17), H(-20, -9)], 2.6, 0.8, m, 10.69, {}); }
        break;
      }
      case 'hood': {
        const gh = grp('hood');
        Pl([H(-13, -3), H(-8, -13), H(2, -14), H(11, -9.5), H(12.5, -3), H(8, -8), H(-2, -9), H(-8, -4), H(-10, 6)], m, z0 + 0.6, { g: gh, bevel: 3 });
        E(H(-3.5, -1)[0], H(-3.5, -1)[1], 10, 11, m, 9.2, { g: grp('hoodback'), rot: ha });
        F(H(-4, -12), H(-10, 2), 0.8, gh, -1);
        break;
      }
      case 'veil': {
        const gv = grp('veil');
        Pl([H(-12, -6), H(-4, -12.5), H(6, -12), H(11, -7), H(7, -8.5), H(-2, -8.5), H(-9, -2), H(-12, 14), H(-16, 12)], m, z0 + 0.6, { g: gv, bevel: 3 });
        C(H(-10, -5), H(10, -7.5), 0.8, 0.8, L.trim, z0 + 0.62, { g: grp('veilband') });
        break;
      }
      case 'beret': case 'cap': {
        E(H(-1.5, -9.5)[0], H(-1.5, -9.5)[1], 11.5, 5.2, m, z0 + 0.55, { g: grp('beret'), rot: ha - 0.2 });
        if (t === 'beret') { const q = H(-4, -14.2); E(q[0], q[1], 1.1, 1.1, m, z0 + 0.56, { g: grp('nub') }); }
        else C(H(4, -6.5), H(12, -5), 1.1, 0.6, m, z0 + 0.57, { g: grp('visor') });
        break;
      }
      case 'feather': {
        E(H(-1.5, -9.5)[0], H(-1.5, -9.5)[1], 11.5, 5.4, m, z0 + 0.55, { g: grp('cap'), rot: ha - 0.15 });
        S([H(-7, -11), H(-13, -18), H(-20, -17)], 1.6, 0.3, L.featherM || L.trim, z0 + 0.56, {});
        break;
      }
      case 'wide': case 'straw': {
        const gw = grp('brim');
        E(H(-0.5, -6.2)[0], H(-0.5, -6.2)[1], 17.5, 3.4, m, z0 + 0.6, { g: gw, rot: ha });
        E(H(-1, -10.5)[0], H(-1, -10.5)[1], 9.5, 6.2, m, z0 + 0.61, { g: grp('crown'), rot: ha });
        C(H(-9.5, -7.5), H(8.5, -8.5), 0.9, 0.9, L.trim, z0 + 0.62, { g: grp('hatband') });
        break;
      }
      case 'kettle': {
        E(H(-0.5, -6)[0], H(-0.5, -6)[1], 15.5, 2.6, L.metal || M.iron, z0 + 0.6, { g: grp('kbrim'), rot: ha });
        E(H(-1, -9.5)[0], H(-1, -9.5)[1], 10.5, 6.5, L.metal || M.iron, z0 + 0.61, { g: grp('kcrown'), rot: ha });
        break;
      }
      case 'pointed': {
        const gp = grp('pointed');
        E(H(-0.5, -6.2)[0], H(-0.5, -6.2)[1], 15.5, 3.0, m, z0 + 0.6, { g: gp, rot: ha });
        Pl([H(-9, -7), H(8, -8), H(1, -18), H(-9, -27), H(-4, -16)], m, z0 + 0.61, { g: grp('cone'), bevel: 2 });
        C(H(-8.5, -8), H(7.5, -8.6), 0.8, 0.8, L.trim, z0 + 0.62, { g: grp('pband') });
        break;
      }
      case 'goggles': {
        C(H(-11.5, -4.5), H(10.5, -6.5), 0.9, 0.9, M.leatherDk, z0 + 0.5, { g: grp('gstrap') });
        [[1.5, -7], [7.8, -7.5]].forEach((q, i) => { const p = H(q[0], q[1]); E(p[0], p[1], 2.4, 2.1, M.glass, z0 + 0.52, { g: grp('lens' + i) }); });
        break;
      }
    }
  };
})(window.RPG);
