// CAST: 動物の見た目と絵 R.DB.looks['ani_<cat|dog|hen|fawn>']（V2_PLAN §2.6.2・§3.8）。フィールドだけ（戦闘・顔なし）。仮の絵。
//   hd:field:ani_* は fieldchar.js が登録し、ここの R.Art.cast.animalField(look, opts) が焼く（4 方向 × 3 コマ、演技は立ちのまま）。
(function (R) {
  'use strict';
  const Art = (R.Art = R.Art || {});
  const cast = (Art.cast = Art.cast || {});
  const base = (name, animal, main, sub, hue) => ({ name, animal, body: { sex: 'm', build: 'slim', age: 'short' }, skin: 'fair', eyes: '#2a2a30',
    hair: { style: 'bald', color: main, ears: 'show' }, outfit: { type: 'light', main, sub, trim: sub }, extras: [], hue, silhouette: 'ani_' + animal, face: false });
  R.defs('looks', {
    ani_cat: base('ねこ', 'cat', '#7a6a5c', '#d8ccbc', 28),
    ani_dog: base('いぬ', 'dog', '#8a6038', '#e0d0b0', 30),
    ani_hen: base('にわとり', 'hen', '#e8e0d4', '#c83a2c', 40),
    ani_fawn: base('子じか', 'fawn', '#a86a3c', '#f0e4d0', 25),
  });

  // 形: [胴の半径 rx, ry, 胴の高さ, 頭の半径, 頭の前の位置, 脚の長さ, しっぽ]
  const SHAPE = {
    cat: { rx: 6.5, ry: 3.6, by: 7, hr: 3.6, hx: 6, hy: 11, leg: 4, tail: [[-6, 7], [-10, 10], [-11, 15]], ears: 'point' },
    dog: { rx: 7.5, ry: 4.2, by: 8.5, hr: 4.2, hx: 7.5, hy: 13, leg: 5, tail: [[-7, 9], [-10, 12], [-11, 15]], ears: 'flop' },
    hen: { rx: 4.8, ry: 4.4, by: 6.5, hr: 2.8, hx: 3.6, hy: 12, leg: 3, tail: [[-4, 8], [-7, 12], [-6, 14]], comb: true },
    fawn: { rx: 7.5, ry: 4.0, by: 11, hr: 3.8, hx: 7.5, hy: 17, leg: 8, tail: [[-7, 12], [-8.5, 13], [-9, 14]], ears: 'long', spots: true },
  };

  function build(B, L, kind, dir, fr) {
    const { mat } = R.Hd.RZ, rig = R.Art.rig, MM = rig.M();
    const S = SHAPE[kind];
    const lk = R.DB.looks['ani_' + kind];
    const fur = mat({ keys: rig.shades(lk.outfit.main, 5), n: 6, wrap: 0.35, tex: 0.8, tsx: 0.4, tsy: 1.2 });
    const belly = mat({ keys: rig.shades(lk.outfit.sub, 5), n: 5, wrap: 0.35 });
    const eye = MM.lash;
    const step = fr === 0 ? 0 : fr === 1 ? 1 : -1;
    const Y = (y) => -y;
    if (dir === 'right') {
      // 横: 脚 4 本（奥・手前）、胴、頭、しっぽ
      const legs = [[S.rx * 0.6, 1, 1.6], [-S.rx * 0.6, -1, 1.6], [S.rx * 0.6, -1, 4], [-S.rx * 0.6, 1, 4]];
      legs.forEach(([x, ph, z]) => { const sw = step * ph * 1.4; B.cap(x, Y(S.by - 1), x + sw, Y(0.8), 1.1, 0.9, kind === 'hen' ? mat({ keys: ['#8a5a1c', '#e0a040'], n: 3, flat: true }) : fur, z); });
      if (kind !== 'hen' || true) B.strand(S.tail.map((q) => [q[0], Y(q[1])]), 1.4, 0.5, kind === 'hen' ? fur : fur, 2.5);
      B.ell(0, Y(S.by + S.ry * 0.3), S.rx, S.ry, fur, 3, { bulge: 0.9 });
      B.ell(1, Y(S.by - S.ry * 0.4), S.rx * 0.7, S.ry * 0.5, belly, 3.1, { bulge: 0.6 });
      if (S.spots) for (let i = 0; i < 3; i++) B.ell(-3 + i * 3, Y(S.by + S.ry * 0.7), 0.8, 0.6, belly, 3.2, { bulge: 0.2 });
      B.cap(S.rx * 0.7, Y(S.by + 1), S.hx, Y(S.hy - 1), 1.8, 1.6, fur, 3.5);
      B.ell(S.hx, Y(S.hy), S.hr, S.hr * 0.9, fur, 4, { bulge: 0.9 });
      B.ell(S.hx + S.hr * 0.7, Y(S.hy - 0.8), S.hr * 0.55, S.hr * 0.45, kind === 'hen' ? mat({ keys: ['#8a5a1c', '#e8b040'], n: 3, flat: true }) : belly, 4.1, { bulge: 0.6 });
      B.rect(S.hx + S.hr * 0.25, Y(S.hy + 0.6), 1, 1, eye, 4.2);
      if (S.ears === 'point') B.poly([[S.hx - 2, Y(S.hy + 2)], [S.hx, Y(S.hy + 2.5)], [S.hx - 1.8, Y(S.hy + 5.5)]], fur, 3.9, { bevel: 0.5 });
      if (S.ears === 'flop') B.ell(S.hx - 2, Y(S.hy - 0.5), 1.3, 2.4, belly, 4.15, { bulge: 0.5 });
      if (S.ears === 'long') B.cap(S.hx - 1.5, Y(S.hy + 2), S.hx - 4, Y(S.hy + 4.5), 1.1, 0.9, fur, 3.9);
      if (S.comb) B.ell(S.hx, Y(S.hy + S.hr), 1.4, 1.1, belly, 4.3, { bulge: 0.5 });
    } else {
      const back = dir === 'up';
      [-1, 1].forEach((s) => { const lift = step * s > 0 ? 1 : 0; B.cap(s * S.rx * 0.45, Y(S.by - 1), s * S.rx * 0.45, Y(0.8 + lift), 1.1, 0.9, fur, 2); });
      B.ell(0, Y(S.by + S.ry * 0.2), S.rx * 0.62, S.ry * 1.1, fur, 3, { bulge: 0.9 });
      if (back) { B.strand(S.tail.map((q) => [q[0] * 0.3, Y(q[1] - 2)]), 1.3, 0.5, fur, 3.4); B.ell(0, Y(S.hy), S.hr, S.hr * 0.9, fur, 3.5, { bulge: 0.9 }); }
      else {
        B.ell(0, Y(S.by), S.rx * 0.38, S.ry * 0.7, belly, 3.1, { bulge: 0.6 });
        B.ell(0, Y(S.hy), S.hr, S.hr * 0.9, fur, 4, { bulge: 0.9 });
        [-1, 1].forEach((s) => B.rect(s * S.hr * 0.4 - 0.5, Y(S.hy + 0.4), 1, 1, eye, 4.2));
        B.ell(0, Y(S.hy - S.hr * 0.45), S.hr * 0.4, S.hr * 0.3, kind === 'hen' ? mat({ keys: ['#8a5a1c', '#e8b040'], n: 3, flat: true }) : belly, 4.1, { bulge: 0.5 });
      }
      if (S.ears === 'point') [-1, 1].forEach((s) => B.poly([[s * 1.2, Y(S.hy + 2)], [s * 3.4, Y(S.hy + 2)], [s * 2.8, Y(S.hy + 5.5)]], fur, 4.3, { bevel: 0.5 }));
      if (S.ears === 'flop') [-1, 1].forEach((s) => B.ell(s * S.hr * 0.9, Y(S.hy), 1.2, 2.3, belly, 4.3, { bulge: 0.5 }));
      if (S.ears === 'long') [-1, 1].forEach((s) => B.cap(s * 2, Y(S.hy + 2), s * 4.8, Y(S.hy + 4), 1.1, 0.8, fur, 4.3));
      if (S.comb) B.ell(0, Y(S.hy + S.hr), 1.2, 1.1, belly, 4.4, { bulge: 0.5 });
    }
  }

  cast.animalField = function (look, o) {
    const lk = R.DB.looks[look];
    if (!lk || !SHAPE[lk.animal]) return null;
    const RZ = R.Hd.RZ, rig = R.Art.rig;
    const sc = ((o && o.scale) || 1.15) * 1.35;   // 人の背（約 50）に対して猫・犬は膝より上くらい
    const order = [], tasks = [];
    const DIR = { s: 'down', n: 'up', e: 'right' };
    for (const d of ['s', 'n', 'e']) for (let fr = 0; fr < 3; fr++) {
      order.push([d, fr]);
      tasks.push(() => {
        const B = new RZ.Builder();
        build(B, null, lk.animal, DIR[d], fr);
        return RZ.frame(RZ.render(B, rig.renderOpts({ scale: sc, light: rig.light('field') })));
      });
    }
    return cast.job(tasks, (made) => {
      const sh = cast._finishField(look, made, order, { sc, lantern: false, L: null, source: 'rig' });
      // 動物は演技を立ちのまま（うなずき等は人だけ）
      return sh;
    }, 'field');
  };
})(window.RPG);
